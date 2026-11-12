#!/usr/bin/env bash
# Lists every failed step with its error lines, plus per-script memory and time.
out=/tmp/reh/summary.md
{
  echo "## Rehearsal ($REH_JOB)"
  echo "| # | step | exit | sec | peak RSS MB |"; echo "|---|---|---|---|---|"
  awk -F'\t' '{printf "| %s | %s | %s | %s | %d |\n", $1, $2, ($3=="0"?"ok":"**"$3"**"), $4, $5/1024}' /tmp/reh/results.tsv
  echo; echo "### Failed steps"
  awk -F'\t' '$3!="0"{print $1"\t"$2}' /tmp/reh/results.tsv | while IFS=$'\t' read -r n name; do
    f=$(ls /tmp/reh/logs/$(printf '%03d' "$n")_* 2>/dev/null | head -1)
    echo "#### $name"; echo '```'
    grep -nE "Error|error:|FAIL|✗|refused|NOT pushed|WOULD NOT|exit [1-9]|ENOENT|heap|Killed|signal" "$f" | head -25
    echo "--- tail ---"; tail -12 "$f"; echo '```'
  done
  echo; echo "### Scripts by peak RSS (top 25)"; echo '```'
  awk -F'\t' '{split($3,a," "); printf "%7d MB %7.0f s exit=%s  %s :: %s\n", a[1]/1024, a[2], a[3], $1, $2}' /tmp/reh/scripts.tsv | sort -rn | head -25
  echo '```'; echo "### Scripts by duration (top 25)"; echo '```'
  awk -F'\t' '{split($3,a," "); printf "%7.0f s %7d MB exit=%s  %s :: %s\n", a[2], a[1]/1024, a[3], $1, $2}' /tmp/reh/scripts.tsv | sort -rn | head -25
  echo '```'; echo "### Memory monitor (min available)"; echo '```'
  awk '{for(i=1;i<=NF;i++) if($i=="avail"){print $(i+1)+0, $0}}' /tmp/reh/mem.log 2>/dev/null | sort -n | head -5; echo '--- last ---'; tail -3 /tmp/reh/mem.log; echo '```'
} > "$out"
cat "$out"; cat "$out" >> "$GITHUB_STEP_SUMMARY"
bad=$(awk -F'\t' '$3!="0"' /tmp/reh/results.tsv | wc -l)
echo "failed steps: $bad"
[ "$bad" = "0" ]
