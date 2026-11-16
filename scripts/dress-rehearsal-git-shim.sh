#!/usr/bin/env bash
# Dress rehearsal git shim. nightly-dress-rehearsal.mjs copies it into a temp
# bin dir at the front of PATH, so bash steps and node child processes hit it.
# - push and pull to a network remote are blocked. A blocked push moves only
#   the local dress-rehearsal-throwaway branch. A remote that is a local path
#   (the bare repos unit tests build in a temp dir) still works.
# - config writes are blocked for --global, --system, --file, and for the
#   rehearsal checkout itself (DRESS_ROOT). Reads always work.
REAL="__REAL_GIT__"
args=("$@")
n=${#args[@]}
i=0
sub=""
cdir=()
while [ "$i" -lt "$n" ]; do
  a="${args[$i]}"
  case "$a" in
    -C) cdir+=("-C" "${args[$((i+1))]}"); i=$((i+2));;
    -c)
      case "${args[$((i+1))]}" in *url*|*insteadof*|*insteadOf*) sub="__override__"; break;; esac
      i=$((i+2));;
    --git-dir|--work-tree|--namespace|--exec-path|--super-prefix|--config-env) i=$((i+2));;
    -*) i=$((i+1));;
    *) sub="$a"; break;;
  esac
done
rest=("${args[@]:$((i+1))}")

is_local() {
  case "$1" in
    /*|./*|../*|file://*) return 0;;
    *://*|*@*:*) return 1;;
  esac
  [ -e "$1" ] && return 0
  return 1
}

block() {
  echo "dress rehearsal: blocked git $1" >&2
  if [ "$2" = "push" ]; then "$REAL" "${cdir[@]}" branch -f dress-rehearsal-throwaway HEAD >/dev/null 2>&1 || true; fi
  exit 0
}

case "$sub" in
  __override__)
    block "url override";;
  push|pull)
    remote=""
    for r in "${rest[@]}"; do
      case "$r" in
        --repo=*) remote="${r#--repo=}"; break;;
        -*) ;;
        *) remote="$r"; break;;
      esac
    done
    if [ -z "$remote" ]; then
      br=$("$REAL" "${cdir[@]}" symbolic-ref --quiet --short HEAD 2>/dev/null)
      remote=$("$REAL" "${cdir[@]}" config --get "branch.$br.remote" 2>/dev/null)
      [ -z "$remote" ] && remote="origin"
    fi
    if is_local "$remote"; then exec "$REAL" "$@"; fi
    if [ "$sub" = "push" ]; then url=$("$REAL" "${cdir[@]}" remote get-url --push "$remote" 2>/dev/null)
    else url=$("$REAL" "${cdir[@]}" remote get-url "$remote" 2>/dev/null); fi
    if [ -n "$url" ] && is_local "$url"; then exec "$REAL" "$@"; fi
    block "$sub" "$sub";;
  send-pack|request-pull)
    block "$sub" push;;
  config)
    write=0; pos=0; first=""; scope=""
    for r in "${rest[@]}"; do
      case "$r" in
        --get|--get-all|--get-regexp|--get-urlmatch|--get-color|--get-colorbool|-l|--list) ;;
        --global|--system|--file|-f|--file=*|--blob|--blob=*) scope="outside";;
        --add|--unset|--unset-all|--replace-all|--rename-section|--remove-section|-e|--edit) write=1;;
        -*) ;;
        *) pos=$((pos+1)); [ -z "$first" ] && first="$r";;
      esac
    done
    case "$first" in
      get|list) write=0; pos=0;;
      set|unset|rename-section|remove-section|edit) write=1;;
    esac
    [ "$pos" -ge 2 ] && write=1
    for r in "${rest[@]}"; do case "$r" in --get|--get-all|--get-regexp|--get-urlmatch|-l|--list) [ "$first" != "set" ] && write=0;; esac; done
    if [ "$write" = 0 ]; then exec "$REAL" "$@"; fi
    if [ -z "$scope" ] && [ -n "$DRESS_ROOT" ]; then
      top=$("$REAL" "${cdir[@]}" rev-parse --show-toplevel 2>/dev/null)
      want=$(cd "$DRESS_ROOT" 2>/dev/null && pwd -P)
      if [ -n "$top" ] && [ "$(cd "$top" && pwd -P)" != "$want" ]; then exec "$REAL" "$@"; fi
    fi
    block "config write";;
esac
exec "$REAL" "$@"
