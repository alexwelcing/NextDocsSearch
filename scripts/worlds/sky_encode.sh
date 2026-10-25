#!/usr/bin/env bash
# Sky v2 encode: a sky_prep.py mip chain -> one UASTC KTX2, content-hashed.
#
#   sky_encode.sh CHAIN_DIR OUT_DIR TIER      e.g. sky_encode.sh /tmp/stacks-4k out k4
#
# Writes OUT_DIR/TIER.<sha256:8>.ktx2 and prints its name, size and `ktx info` summary. The chain
# is passed level by level (--levels + one PNG per level) so the mips keep sky_prep's wrap-x /
# across-the-pole resampling; `--generate-mipmap` would redo them with one wrap mode for both axes.
#
# UASTC + RDO + zstd for every tier above the preview: ETC1S fails the banding gate on dark
# gradients (65-76% of smooth dark blocks flattened, 36-41 dB; see the H1 sky spike, PR #203).
# Row 0 is the zenith (KTXorientation rd); the runtime samples with flipY=false. Needs KTX-Software
# 4.4 (`ktx`) on the forge VM; never run on the Mac.
set -euo pipefail
CHAIN=$1
OUT=$2
TIER=$3
mkdir -p "$OUT"
mapfile -t LEVELS < <(ls "$CHAIN"/L*.png | sort)
N=${#LEVELS[@]}
TMP="$OUT/.$TIER.tmp.ktx2"
t0=$(date +%s.%N)
ktx create \
  --format R8G8B8_SRGB --assign-tf srgb --assign-primaries bt709 \
  --encode uastc --uastc-quality 2 --uastc-rdo --uastc-rdo-l 1.0 --zstd 19 \
  --levels "$N" "${LEVELS[@]}" "$TMP"
t1=$(date +%s.%N)
HASH=$(sha256sum "$TMP" | cut -c1-8)
NAME="$TIER.$HASH.ktx2"
mv "$TMP" "$OUT/$NAME"
printf '%s bytes=%s levels=%s encode_s=%.1f\n' "$NAME" "$(stat -c %s "$OUT/$NAME")" "$N" \
  "$(echo "$t1 - $t0" | bc)"
ktx info "$OUT/$NAME" | grep -E 'vkFormat|pixelWidth|pixelHeight|levelCount|supercompressionScheme|KTXorientation' \
  | tr -s ' ' | paste -sd' '
