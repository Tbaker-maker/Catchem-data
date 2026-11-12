#!/usr/bin/env bash
# usage: r.sh "<step name>" <script file>. Runs the step body like GitHub does
# (bash -eo pipefail), logs it, and records exit code, seconds and peak RSS.
name="$1"; file="$2"
mkdir -p /tmp/reh/logs
n=$(( $(ls /tmp/reh/logs | wc -l) + 1 ))
slug=$(printf '%s' "$name" | tr -c 'A-Za-z0-9' '_' | cut -c1-50)
log=$(printf '/tmp/reh/logs/%03d_%s.log' "$n" "$slug")
export REH_STEP="$name"
start=$(date +%s)
{ echo 'source .github/rehearsal/rt.sh'; cat "$file"; } > /tmp/reh/body.sh
set +e
${TIMEBIN:-/usr/bin/time} -f "%M" -o /tmp/reh/step-rss.txt bash --noprofile --norc -eo pipefail /tmp/reh/body.sh 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
secs=$(( $(date +%s) - start ))
rss=$(tail -1 /tmp/reh/step-rss.txt 2>/dev/null)
printf '%s\t%s\t%s\t%s\t%s\n' "$n" "$name" "$code" "$secs" "$rss" >> /tmp/reh/results.tsv
echo "[rehearsal] step '$name' exit=$code ${secs}s peakRSS=${rss}KB"
exit $code
