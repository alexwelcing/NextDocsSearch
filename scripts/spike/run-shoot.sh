#!/usr/bin/env bash
# SPIKE (H1 sky): serve the existing build and run sky-shoot.mjs on the forge L4.
#   scripts/spike/run-shoot.sh plan.json OUTNAME   (run from the forge worktree, after pnpm build)
set -uo pipefail
PLAN=$1; NAME=$2; PORT=${PORT:-3971}; OUT=~/work/shots/h1-sky-spike/$NAME
(fuser -k $PORT/tcp >/dev/null 2>&1 || true)
(PORT=$PORT nohup pnpm start >/tmp/serve-h1-sky-spike.log 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null localhost:$PORT/ && break; sleep 1; done
rm -rf "$OUT"; mkdir -p "$OUT"
xvfb-run -a -s '-screen 0 1920x1080x24' node scripts/spike/sky-shoot.mjs http://localhost:$PORT "$OUT" "$PLAN"
fuser -k $PORT/tcp >/dev/null 2>&1
cd "$OUT" && for f in *.png; do convert "$f" -resize 1200x -quality 84 "${f%.png}.jpg"; done
ls "$OUT" | head -50
