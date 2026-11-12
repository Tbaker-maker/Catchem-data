# Sourced by every rehearsal step. RT wraps one command: peak RSS (KB), seconds, exit code.
RT() {
  local c=0
  ${TIMEBIN:-/usr/bin/time} -f "%M %e %x" -o /tmp/reh/rt.txt "$@" || c=$?
  printf '%s\t%s\t%s\n' "${REH_STEP:-?}" "$*" "$(tail -1 /tmp/reh/rt.txt 2>/dev/null)" >> /tmp/reh/scripts.tsv
  return $c
}
