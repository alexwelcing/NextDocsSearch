#!/usr/bin/env bash
# SPIKE (H1 sky): a labelled 6-face test cubemap (+X -X +Y -Y +Z -Z) as ETC1S and UASTC KTX2,
# for the CompressedCubeTexture-under-WebGPU repro (?sky=cube).
set -euo pipefail
OUT=$1; T=$(mktemp -d)
declare -A COL=([px]='#c0392b' [nx]='#16a085' [py]='#2980b9' [ny]='#8e44ad' [pz]='#d35400' [nz]='#27ae60')
declare -A LAB=([px]='+X' [nx]='-X' [py]='+Y' [ny]='-Y' [pz]='+Z' [nz]='-Z')
for f in px nx py ny pz nz; do
  convert -size 256x256 "xc:${COL[$f]}" -fill white -stroke white -strokewidth 4 -draw 'line 0,0 255,0' \
    -draw 'line 0,0 0,255' -gravity center -pointsize 110 -annotate 0 "${LAB[$f]}" \
    -gravity north -pointsize 28 -annotate +0+8 "top" -depth 8 "PNG24:$T/$f.png"
done
mkdir -p "$OUT"
F=("$T"/px.png "$T"/nx.png "$T"/py.png "$T"/ny.png "$T"/pz.png "$T"/nz.png)
ktx create --format R8G8B8_SRGB --assign-tf srgb --assign-primaries bt709 --cubemap --generate-mipmap --encode basis-lz --qlevel 192 "${F[@]}" "$OUT/test-cube-etc1s.ktx2"
ktx create --format R8G8B8_SRGB --assign-tf srgb --assign-primaries bt709 --cubemap --generate-mipmap --encode uastc --uastc-quality 2 --zstd 19 "${F[@]}" "$OUT/test-cube-uastc.ktx2"
# A 2D control in the same codec proves the transcoder + CompressedTexture path itself works.
ktx create --format R8G8B8_SRGB --assign-tf srgb --assign-primaries bt709 --generate-mipmap --encode uastc --uastc-quality 2 --zstd 19 "$T/pz.png" "$OUT/test-2d-uastc.ktx2"
ls -la "$OUT"; rm -rf "$T"
