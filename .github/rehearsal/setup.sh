#!/usr/bin/env bash
# Rehearsal safety + monitoring. No push can leave this runner.
set -e
mkdir -p /tmp/reh/logs
: > /tmp/reh/results.tsv; : > /tmp/reh/scripts.tsv
command -v /usr/bin/time >/dev/null 2>&1 || [ -x /usr/bin/time ] || (sudo apt-get update -qq && sudo apt-get install -y -qq time)
# Every git push to github.com (this repo, catchem-data-private clones) goes to a dead host.
git config --global url."https://push-blocked.invalid/".pushInsteadOf "https://github.com/"
git config --global --add url."https://push-blocked.invalid/".pushInsteadOf "git@github.com:"
git remote set-url --push origin https://push-blocked.invalid/blocked.git
nohup bash -c 'while true; do
  m=$(free -m | awk "/Mem:/{print \$3\"/\"\$2\"MB used, avail \"\$7}");
  s=$(free -m | awk "/Swap:/{print \$3\"/\"\$2}");
  d=$(df -m / | awk "NR==2{print \$4}");
  t=$(ps -eo rss=,args= --sort=-rss | head -2 | awk "{printf \"%dMB %s %s | \", \$1/1024, \$2, \$3}");
  echo "$(date -u +%H:%M:%S) mem=$m swap=$s diskFree=${d}MB top: $t";
  sleep 15; done' > /tmp/reh/mem.log 2>&1 &
echo "rehearsal setup done: pushes blocked, monitor pid $!"
