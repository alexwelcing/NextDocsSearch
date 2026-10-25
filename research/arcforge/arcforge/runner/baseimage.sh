#!/bin/bash
# Startup-script of the one-off builder VM behind `python -m arcforge.runner base-image build`.
# It turns Google's Deep Learning VM image (NVIDIA driver 580, no Docker) into the runner's boot
# image: Docker + the NVIDIA container toolkit, at pinned versions, with the nvidia runtime
# configured so `docker run --gpus all` works. Runner VMs have no external address and so no
# apt, which is why this is baked into an image instead of installed at boot.
# baseimage.py prepends DOCKER_VERSION and CTK_VERSION; the result is reported on the serial port.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
report() { echo "ARCFORGE-BASE $*" | tee /dev/ttyS0; }
trap 'report FAILED line $LINENO; poweroff' ERR

apt-get update -q
apt-get install -y -q --no-install-recommends ca-certificates curl gnupg "docker.io=${DOCKER_VERSION}"

curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  >/etc/apt/sources.list.d/nvidia-container-toolkit.list
apt-get update -q
apt-get install -y -q --no-install-recommends \
  "nvidia-container-toolkit=${CTK_VERSION}" "nvidia-container-toolkit-base=${CTK_VERSION}" \
  "libnvidia-container-tools=${CTK_VERSION}" "libnvidia-container1=${CTK_VERSION}"
apt-mark hold docker.io nvidia-container-toolkit nvidia-container-toolkit-base libnvidia-container-tools libnvidia-container1

nvidia-ctk runtime configure --runtime=docker
systemctl enable docker
systemctl restart docker
docker info --format '{{json .Runtimes}}' | grep -q nvidia

# Leave nothing instance-specific behind.
apt-get clean
rm -rf /var/lib/apt/lists/* /var/lib/arcforge /root/.docker
journalctl --rotate && journalctl --vacuum-time=1s || true

report "OK docker=$(docker version --format '{{.Server.Version}}') ctk=$(nvidia-ctk --version | head -1 | awk '{print $NF}')"
sync
poweroff
