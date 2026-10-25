# arcforge runner bootstrap: the static body of every runner VM's startup-script.
# arcforge.runner.bootstrap.render() prepends the ARC_* assignments; do not edit on the VM.
#
# Protocol with the laptop (arcforge.runner.session):
#   $ARC_STATUS_URL/status.json     written at each phase change: booting, host, pulling,
#                                   running, then done with the job's exit code
#   $ARC_STATUS_URL/heartbeat.json  rewritten every 30 s while the VM is alive
#   $ARC_STATUS_URL/job.log         the job's combined output, pushed every 30 s and at exit
# The job itself resumes from the content-addressed GCS cache, so a recreated VM rerunning this
# script after a preemption repeats only the unfinished work.
set -uo pipefail

META=http://metadata.google.internal/computeMetadata/v1/instance
NAME=$(curl -sf -H 'Metadata-Flavor: Google' "$META/name")
ZONE=$(curl -sf -H 'Metadata-Flavor: Google' "$META/zone" | awk -F/ '{print $NF}')
WORK=${ARC_WORK:-/var/lib/arcforge}  # overridable for the tests only
LOG=$WORK/job.log
mkdir -p "$WORK"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

put() {  # put OBJECT JSON
  printf '%s\n' "$2" | gcloud storage cp - "$ARC_STATUS_URL/$1" --quiet >/dev/null 2>&1
}

status() {  # status PHASE [EXIT_CODE]
  echo "$1" >"$WORK/phase"
  put status.json "{\"phase\": \"$1\", \"exit_code\": ${2:-null}, \"instance\": \"$NAME\", \"zone\": \"$ZONE\", \"updated_utc\": \"$(now)\"}"
}

push_log() { gcloud storage cp "$LOG" "$ARC_STATUS_URL/job.log" --quiet >/dev/null 2>&1 || true; }

# A spot VM is deleted, never restarted, so a second boot means something reset the VM. Never
# run a job twice on one VM: report and stop instead.
if [ -e "$WORK/started" ]; then
  status done 125
  poweroff
  exit 0
fi
touch "$WORK/started"

finish() {
  local rc=$1
  kill "$HEARTBEAT" 2>/dev/null
  wait "$HEARTBEAT" 2>/dev/null
  echo "arcforge: job exited $rc at $(now)" >>"$LOG"
  push_log
  status done "$rc"
  # The VM-side exit trap: delete this instance if its service account may, otherwise power
  # off so the GPU stops billing at once. The laptop's exit trap (or `arcforge gc`) deletes
  # whatever is left, and --max-run-duration deletes it regardless.
  gcloud compute instances delete "$NAME" --zone "$ZONE" --quiet >/dev/null 2>&1 || poweroff
}

job() {
  echo "arcforge runner $NAME ($ZONE), run $ARC_RUN_ID attempt $ARC_ATTEMPT, started $(now)"
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader || true
  if [ -n "$ARC_HOST_SCRIPT" ]; then
    status host
    bash -euo pipefail -c "$ARC_HOST_SCRIPT" || return $?
  fi
  if [ -n "$ARC_IMAGE" ]; then
    status pulling
    gcloud auth configure-docker "${ARC_IMAGE%%/*}" --quiet || return $?
    docker pull --quiet "$ARC_IMAGE" || return $?
    status running
    docker run --rm --gpus all --network host "${ARC_DOCKER_ENV[@]}" "${ARC_ENTRYPOINT[@]}" \
      "$ARC_IMAGE" "${ARC_ARGV[@]}" || return $?
  fi
  return 0
}

status booting
(
  while sleep 30; do
    push_log
    put heartbeat.json "{\"phase\": \"$(cat "$WORK/phase")\", \"instance\": \"$NAME\", \"updated_utc\": \"$(now)\"}"
  done
) &
HEARTBEAT=$!
# Set after forking the heartbeat so only this shell runs it, on any exit.
trap 'finish $?' EXIT

job >>"$LOG" 2>&1
