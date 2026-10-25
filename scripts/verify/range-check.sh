#!/usr/bin/env bash
# HTTP Range check for the site's MP4 films (WS2-B). Safari and iOS only play a <video> (and so the
# in-scene VideoTexture) when the server answers byte ranges, and Workers Static Assets do not
# document 206 support, so this proves it per origin before any cutover:
#
#   scripts/verify/range-check.sh <origin> [<origin>...] [</path.mp4>...]
#
# With no paths it checks the *.mp4 lines of scripts/verify/must-serve.txt. For every origin and
# path it requires:
#   - HEAD: 200, a video/* Content-Type, Accept-Ranges: bytes and a Content-Length N;
#   - Range: bytes=0-1 (Safari's first probe): 206, Content-Range bytes 0-1/N, exactly 2 bytes,
#     twice in a row (a cache miss, then usually a hit; the cache headers are printed);
#   - a mid-file range bytes=1000-1999 (or the middle of a small file): 206 with exactly that slice;
#   - the suffix range bytes=-2: 206, Content-Range bytes N-2-N-1/N;
#   - the same bytes from every origin (when more than one is given), and the same N.
# An unsatisfiable range (bytes=N-) should answer 416 with Content-Range bytes */N; a different
# answer is printed as a WARN but does not fail the run (no player depends on it).
#
# Exit 0 when every required check passes, 1 when any fails, 2 on bad usage. Requires bash (3.2+,
# so macOS's own works) and curl. Polite: one request at a time, at most 7 per file and origin,
# and never more than 1 MiB of a body (an origin that ignores Range is caught from its headers).

set -uo pipefail

usage() {
  # The header comment, up to the first line that is not a comment.
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
  exit 2
}

origins=()
paths=()
for arg in "$@"; do
  case "$arg" in
    -h | --help) usage ;;
    http://* | https://*) origins+=("${arg%/}") ;;
    /*) paths+=("$arg") ;;
    *)
      echo "range-check: unexpected argument '$arg' (origins start with http(s)://, paths with /)" >&2
      exit 2
      ;;
  esac
done
[ ${#origins[@]} -gt 0 ] || usage

if [ ${#paths[@]} -eq 0 ]; then
  list="$(dirname "$0")/must-serve.txt"
  [ -r "$list" ] || { echo "range-check: no paths given and $list is unreadable" >&2; exit 2; }
  while IFS= read -r line; do
    line="${line%%#*}"
    line="${line//[[:space:]]/}"
    case "$line" in /*.mp4 | /*.MP4) paths+=("$line") ;; esac
  done <"$list"
  [ ${#paths[@]} -gt 0 ] || { echo "range-check: $list lists no .mp4 paths" >&2; exit 2; }
fi

UA='alexwelcing-range-check/1 (+https://github.com/alexwelcing/NextDocsSearch; scripts/verify/range-check.sh)'
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

failures=0
warnings=0
pass() { printf '  ok    %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; failures=$((failures + 1)); }
warn() { printf '  WARN  %s\n' "$*"; warnings=$((warnings + 1)); }

# header NAME FILE: the value of the last NAME header in a curl -D dump (the final response).
header() {
  awk -v name="$1" 'BEGIN { name = tolower(name) }
    /^HTTP\// { value = "" }
    { line = $0; sub(/\r$/, "", line); split(line, kv, ":") }
    tolower(kv[1]) == name { sub(/^[^:]*:[ \t]*/, "", line); value = line }
    END { print value }' "$2"
}
status_of() { awk '/^HTTP\// { code = $2 } END { print code }' "$1"; }

MAX_BODY=1048576

# fetch NAME URL [RANGE]: GET (or HEAD when RANGE is "HEAD") into $tmp/NAME.{h,b}. A body over
# MAX_BODY is not downloaded (curl stops after the headers): $tmp/NAME.b stays empty and
# $tmp/NAME.capped exists.
fetch() {
  local name=$1 url=$2 range=${3:-} rc
  local args=(-sS --max-time 60 --max-filesize "$MAX_BODY" -A "$UA" -D "$tmp/$name.h" -o "$tmp/$name.b")
  if [ "$range" = HEAD ]; then
    args+=(-I)
  elif [ -n "$range" ]; then
    args+=(-H "Range: bytes=$range")
  fi
  : >"$tmp/$name.h"
  : >"$tmp/$name.b"
  rm -f "$tmp/$name.capped"
  curl "${args[@]}" "$url" 2>"$tmp/$name.err"
  rc=$?
  if [ "$rc" = 63 ]; then
    : >"$tmp/$name.b"
    : >"$tmp/$name.capped"
  elif [ "$rc" != 0 ]; then
    fail "$url ($range): curl failed: $(tr '\n' ' ' <"$tmp/$name.err")"
    return 1
  fi
}

# body NAME: the size of a fetched body, in words.
body() {
  if [ -e "$tmp/$1.capped" ]; then
    echo "a body over $MAX_BODY bytes (not downloaded)"
  else
    echo "$(wc -c <"$tmp/$1.b" | tr -d ' ') bytes"
  fi
}

# expect_range NAME LABEL FIRST LAST TOTAL: a 206 carrying exactly bytes FIRST-LAST of TOTAL.
expect_range() {
  local name=$1 label=$2 first=$3 last=$4 total=$5
  local code cr size want=$(($4 - $3 + 1))
  code=$(status_of "$tmp/$name.h")
  cr=$(header content-range "$tmp/$name.h")
  size=$(wc -c <"$tmp/$name.b" | tr -d ' ')
  if [ "$code" = 206 ] && [ "$cr" = "bytes $first-$last/$total" ] && [ "$size" = "$want" ] &&
    [ ! -e "$tmp/$name.capped" ]; then
    pass "$label: 206, $cr, $size bytes"
  else
    fail "$label: want 206 'bytes $first-$last/$total' and $want bytes, got ${code:-nothing} '${cr:-no Content-Range}' and $(body "$name")"
  fi
}

for origin in "${origins[@]}"; do
  for path in "${paths[@]}"; do
    url="$origin$path"
    echo "$url"

    fetch head "$url" HEAD || continue
    code=$(status_of "$tmp/head.h")
    type=$(header content-type "$tmp/head.h")
    ranges=$(header accept-ranges "$tmp/head.h")
    total=$(header content-length "$tmp/head.h")
    if [ "$code" != 200 ]; then
      fail "HEAD: want 200, got ${code:-nothing}"
      continue
    fi
    case "$type" in video/*) pass "HEAD: 200, $type" ;; *) fail "HEAD: want a video/* Content-Type, got '${type:-none}'" ;; esac
    if [ "$(printf '%s' "$ranges" | tr '[:upper:]' '[:lower:]')" = bytes ]; then pass "Accept-Ranges: bytes"; else fail "want Accept-Ranges: bytes, got '${ranges:-none}'"; fi
    if ! [[ "$total" =~ ^[0-9]+$ ]] || [ "$total" -lt 4 ]; then
      # Without a usable HEAD length, learn N from the first ranged answer.
      fetch probe "$url" 0-1 || continue
      code=$(status_of "$tmp/probe.h")
      if [ "$code" != 206 ]; then
        fail "bytes=0-1: want 206, got ${code:-nothing} with $(body probe) (the origin ignores Range)"
        continue
      fi
      total=$(header content-range "$tmp/probe.h")
      total=${total##*/}
      [[ "$total" =~ ^[0-9]+$ ]] || { fail "no file length from HEAD or Content-Range"; continue; }
      warn "HEAD sent no usable Content-Length; using N=$total from Content-Range"
    fi

    for attempt in 1 2; do
      fetch first "$url" 0-1 || continue 2
      expect_range first "bytes=0-1 (#$attempt)" 0 1 "$total"
      cache="$(header cf-cache-status "$tmp/first.h")$(header x-vercel-cache "$tmp/first.h")"
      printf '        cache: %s; cache-control: %s\n' "${cache:-n/a}" "$(header cache-control "$tmp/first.h")"
    done
    head_hex=$(od -An -tx1 "$tmp/first.b" | tr -d ' \n')

    if [ "$total" -gt 2000 ]; then first=1000 last=1999; else first=$((total / 4)) last=$((total / 2)); fi
    fetch mid "$url" "$first-$last" || continue
    expect_range mid "bytes=$first-$last" "$first" "$last" "$total"
    mid_sum=$(cksum <"$tmp/mid.b" | cut -d' ' -f1)

    fetch suffix "$url" -2 || continue
    expect_range suffix "bytes=-2" $((total - 2)) $((total - 1)) "$total"

    fetch beyond "$url" "$total-" || continue
    code=$(status_of "$tmp/beyond.h")
    cr=$(header content-range "$tmp/beyond.h")
    if [ "$code" = 416 ] && [ "$cr" = "bytes */$total" ]; then
      pass "bytes=$total-: 416, $cr"
    else
      warn "bytes=$total-: want 416 'bytes */$total', got $code '${cr:-no Content-Range}'"
    fi

    # The first origin's length and bytes are the reference for the others.
    fingerprint="$total:$head_hex:$mid_sum"
    ref="$tmp/ref-$(printf '%s' "$path" | cksum | cut -d' ' -f1)"
    if [ ! -e "$ref" ]; then
      printf '%s' "$fingerprint" >"$ref"
    elif [ "$(cat "$ref")" != "$fingerprint" ]; then
      fail "differs from ${origins[0]}: length:head:mid-checksum $fingerprint vs $(cat "$ref")"
    else
      pass "same length and bytes as ${origins[0]}"
    fi
  done
done

echo
echo "range-check: ${#origins[@]} origin(s) x ${#paths[@]} file(s): $failures failure(s), $warnings warning(s)"
[ "$failures" -eq 0 ]
