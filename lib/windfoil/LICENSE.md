# Windfoil — vendored text rendering core

The algorithm, WGSL shader derivation, and the geometry/banding pipeline in this
directory are adapted from **windfoil** by Matt DesLauriers / texel-org:

- Upstream: https://github.com/texel-org/windfoil
- License: Apache-2.0 (see below)

Windfoil computes exact box-filter coverage for shapes built from quadratic
Bezier contours as a per-pixel winding integral in a WebGPU fragment shader —
no signed-distance fields, no glyph atlas textures. This vendored port adapts
the upstream Deno/raw-WebGPU implementation to TypeScript + three.js
`WebGPURenderer` node materials for in-scene 3D text.

Local adaptations (this repository):

- `geometry.ts` / `bands.ts` — TypeScript ports of upstream `src/geometry.js`
  and `src/bands.js`, restructured for a build-time atlas over a fixed charset.
- `wgsl.ts` — upstream `src/windfoil.wgsl` refactored into a function library
  consumed through three.js TSL `wgslFn` (vertex placement moves to TSL; the
  camera model is the three.js projection instead of upstream's 2D camera).
- `atlas.ts` / `layout.ts` — binary atlas loader and a word-wrapping,
  multi-line layout engine (upstream ships a single-line demo layout).

Fonts under `public/fonts/` (VT323, Share Tech Mono) are licensed under the
SIL Open Font License 1.1 — see `public/fonts/OFL-*.txt`.

---

Apache License 2.0 — Copyright (c) 2026 texel-org / Matt DesLauriers

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use these files except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0. Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
OF ANY KIND, either express or implied.
