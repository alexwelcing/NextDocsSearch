#!/usr/bin/env bash
# SPIKE (H1 sky): encode a sky_prep.py mip chain into the KTX2 variants the runtime spike loads.
#   sky_encode.sh <chain-dir> <out-dir> <world-id>
# Uses our own seam/pole-correct mip chain (--levels + one PNG per level) instead of
# --generate-mipmap, whose --mipmap-wrap is one mode for both axes.
set -euo pipefail
CHAIN=$1; OUT=$2; ID=$3
mkdir -p "$OUT"
mapfile -t L < <(ls "$CHAIN"/L*.png | sort)
N=${#L[@]}
COMMON=(--format R8G8B8_SRGB --assign-tf srgb --assign-primaries bt709)
UASTC=(--encode uastc --uastc-quality 2 --uastc-rdo --uastc-rdo-l 1.0 --zstd 19)
ETC1S=(--encode basis-lz --clevel 4 --qlevel 255)
enc() { # name args...
  local name=$1; shift
  local t0=$(date +%s.%N)
  ktx create "${COMMON[@]}" "$@" "$OUT/$ID-$name.ktx2"
  local t1=$(date +%s.%N)
  printf '%s %s bytes=%s encode_s=%.1f\n' "$ID" "$name" "$(stat -c %s "$OUT/$ID-$name.ktx2")" "$(echo "$t1 - $t0" | bc)"
}
enc 8k-uastc "${UASTC[@]}" --levels $N "${L[@]}" &
enc 8k-etc1s "${ETC1S[@]}" --levels $N "${L[@]}" &
wait
enc 4k-uastc "${UASTC[@]}" --levels $((N - 1)) "${L[@]:1}" &
enc 4k-etc1s "${ETC1S[@]}" --levels $((N - 1)) "${L[@]:1}" &
wait
cp "$CHAIN/preview-1024.webp" "$OUT/$ID-preview-1024.webp"
for f in "$OUT/$ID"-*.ktx2; do ktx info "$f" | grep -E 'vkFormat|pixelWidth|pixelHeight|levelCount|supercompressionScheme|KTXorientation' | tr -s ' ' | paste -sd' ' | sed "s|^|$(basename "$f"): |"; done
