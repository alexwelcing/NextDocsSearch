// The windfoil coverage shader, adapted from upstream src/windfoil.wgsl for three.js TSL wgslFn.
//
// Upstream renders 2D screen-space quads under its own camera; here the vertex stage lives in TSL
// (glyph quads become instanced geometry in 3D world space) and only the fragment-side winding
// integral survives as raw WGSL. The pixel footprint in glyph space comes from fwidth(rc), so the
// same closed-form box-filter coverage works under any 3D projection.
//
// Storage buffers are passed as pointer parameters (WGSL language feature
// 'unrestricted_pointer_parameters', supported by Dawn/Chrome-class WebGPU — the only tier this
// site targets).

/** Helper function library injected ahead of the main coverage function. */
export const WINDFOIL_WGSL_HELPERS = /* wgsl */ `
// Bands with count > SORT_MIN are x-sorted at build time so the gather can break at the first
// piece fully left of the box. MUST equal BAND_SORT_MIN in lib/windfoil/bands.ts.
const WF_SORT_MIN : u32 = 4u;

// Row-table layout — MUST match bands.ts rowOut.push(start, count, areaBits, xMinBits, xMaxBits).
const WF_ROW_STRIDE : u32 = 5u;
const WF_ROW_AREA : u32 = 2u;
const WF_ROW_XMIN : u32 = 3u;
const WF_ROW_XMAX : u32 = 4u;

// Below WF_GUARD_PX device pixels (whole glyph, both axes) coverage comes from the banded ink
// profile instead of the exact gather.
const WF_GUARD_PX : f32 = 3.7;

// Period-2 triangle wave: folds signed winding to even-odd coverage, range [0, 1].
fn wf_tri_wave(t : f32) -> f32 {
  let m = t - 2.0 * floor(t * 0.5);
  return 1.0 - abs(1.0 - m);
}

// Opt-in perceptual styling; (1, 1) leaves the exact coverage untouched.
fn wf_style_coverage(cov : f32, gamma : f32, sharp : f32) -> f32 {
  if (gamma == 1.0 && sharp == 1.0) { return cov; }
  let g = pow(cov, gamma);
  var s : f32;
  if (g < 0.5) {
    s = 0.5 * pow(2.0 * g, sharp);
  } else {
    s = 1.0 - 0.5 * pow(2.0 * (1.0 - g), sharp);
  }
  return clamp(s, 0.0, 1.0);
}

// Fold the pixel-averaged winding number to coverage by fill rule (0 = nonzero, 1 = even-odd).
fn wf_fold(f : f32, fillRule : f32) -> f32 {
  if (fillRule > 0.5) { return wf_tri_wave(f); }
  return clamp(abs(f), 0.0, 1.0);
}

// Solve the monotone quadratic component A2·t² + A1·t + A0 = v on [0,1], saturating to endpoints.
fn wf_mono_root(a2 : f32, a1 : f32, a0 : f32, e1 : f32, v : f32, rising : bool) -> f32 {
  if (rising) {
    if (a0 >= v) { return 0.0; }
    if (e1 <= v) { return 1.0; }
  } else {
    if (a0 <= v) { return 0.0; }
    if (e1 >= v) { return 1.0; }
  }
  let c = a0 - v;
  if (abs(a2) < 1e-12 * max(abs(a1), 1.0)) {
    return clamp(-c / a1, 0.0, 1.0);
  }
  let disc = max(a1 * a1 - 4.0 * a2 * c, 0.0);
  let sq = sqrt(disc);
  let qq = -0.5 * (a1 + select(-sq, sq, a1 >= 0.0));
  let r1 = qq / a2;
  let r2 = select(0.0, c / qq, qq != 0.0);
  let t = select(r2, r1, (a1 < 0.0) == rising);
  return clamp(t, 0.0, 1.0);
}

// Exact integral of (x(t)+hx)·y′(t) over [ta,tb]: midpoint rule, exact for this cubic integrand.
fn wf_integrate_inside(a2 : vec2<f32>, a1 : vec2<f32>, x0 : f32, ta : f32, tb : f32, hx : f32) -> f32 {
  if (tb <= ta) { return 0.0; }
  let tm = 0.5 * (ta + tb);
  let d = 0.5 * (tb - ta);
  let x_mid = (a2.x * tm + a1.x) * tm + x0 + hx;
  let dmid = 2.0 * a2 * tm + a1;
  return 2.0 * d * x_mid * dmid.y + (2.0 * d * d * d / 3.0) * (a2.x * dmid.y + 2.0 * a2.y * dmid.x);
}

// One xy-monotone piece's contribution over the y-window [lo, hi]: LEFT (0) / INSIDE (exact) /
// RIGHT (full width) zones.
fn wf_integrate_piece(q1 : vec2<f32>, q2 : vec2<f32>, q3 : vec2<f32>, lo : f32, hi : f32, hx : f32) -> f32 {
  let a2 = q1 - 2.0 * q2 + q3;
  let a1 = 2.0 * (q2 - q1);
  let y_rising = q3.y >= q1.y;
  let t_lo = wf_mono_root(a2.y, a1.y, q1.y, q3.y, select(hi, lo, y_rising), y_rising);
  let t_hi = wf_mono_root(a2.y, a1.y, q1.y, q3.y, select(lo, hi, y_rising), y_rising);
  if (t_hi <= t_lo) { return 0.0; }
  let x_rising = q3.x >= q1.x;
  let t_left = clamp(wf_mono_root(a2.x, a1.x, q1.x, q3.x, -hx, x_rising), t_lo, t_hi);
  let t_right = clamp(wf_mono_root(a2.x, a1.x, q1.x, q3.x, hx, x_rising), t_lo, t_hi);
  let t1 = select(t_right, t_left, x_rising);
  let t2 = max(select(t_left, t_right, x_rising), t1);
  var acc = wf_integrate_inside(a2, a1, q1.x, t1, t2, hx);
  let ra = select(t_lo, t2, x_rising);
  let rb = select(t1, t_hi, x_rising);
  if (rb > ra) {
    let tm = 0.5 * (ra + rb);
    acc += (rb - ra) * (2.0 * a2.y * tm + a1.y) * (2.0 * hx);
  }
  return acc;
}

// A piece's y-span clipped to the window, as a difference of clamped endpoints (telescopes over
// piece chains). Signed: clamp(y3) − clamp(y1).
fn wf_clipped_dy(y1 : f32, y3 : f32, wlo : f32, whi : f32) -> f32 {
  return clamp(y3, wlo, whi) - clamp(y1, wlo, whi);
}

// Accumulate one row band's pieces over the rc-relative y-window [wlo, whi].
fn wf_integrate_band(
  curves : ptr<storage, array<vec2<f32>>, read>,
  start : u32, count : u32, rc : vec2<f32>, wlo : f32, whi : f32, sx : f32
) -> f32 {
  var acc : f32 = 0.0;
  let hx = sx * 0.5;
  let sorted = count > WF_SORT_MIN;
  let coord_ulp = max(abs(rc.x), abs(rc.y)) * 1.2e-7;
  for (var i : u32 = 0u; i < count; i = i + 1u) {
    let base = (start + i) * 3u;
    let q1 = curves[base] - rc;
    let q2 = curves[base + 1u] - rc;
    let q3 = curves[base + 2u] - rc;
    let x_hull_max = max(q1.x, max(q2.x, q3.x));
    if (x_hull_max <= -hx) {
      if (sorted) { break; }
      continue;
    }
    let py_lo = min(q1.y, q3.y);
    let py_hi = max(q1.y, q3.y);
    let lo = max(wlo, py_lo);
    let hi = min(whi, py_hi);
    if (hi <= lo) { continue; }
    let x_hull_min = min(q1.x, min(q2.x, q3.x));
    if (x_hull_min >= hx) {
      acc += sx * wf_clipped_dy(q1.y, q3.y, wlo, whi);
      continue;
    }
    if (x_hull_max - x_hull_min + (py_hi - py_lo) <= coord_ulp * 16.0) {
      let xm = clamp((q1.x + q3.x) * 0.5, -hx, hx) + hx;
      acc += xm * wf_clipped_dy(q1.y, q3.y, wlo, whi);
      continue;
    }
    acc += wf_integrate_piece(q1, q2, q3, lo, hi, hx);
  }
  return acc;
}

// Band index for a y-offset from the band origin: floor(dy·invH) clamped.
fn wf_band_index(dy : f32, invH : f32, R : u32) -> u32 {
  return u32(clamp(floor(dy * invH), 0.0, f32(R) - 1.0));
}

// Band ri's y-range relative to base. R ≤ 64, so f32(ri) + 1.0 is exact.
fn wf_band_edges(base : f32, ri : u32, invH : f32) -> vec2<f32> {
  let r = f32(ri);
  return vec2<f32>(base + r / invH, base + (r + 1.0) / invH);
}

// Length of the overlap of intervals [a0, a1] and [b0, b1] (0 when disjoint).
fn wf_overlap1d(a0 : f32, a1 : f32, b0 : f32, b1 : f32) -> f32 {
  return max(min(a1, b1) - max(a0, b0), 0.0);
}

// One glyph's winding integral over the pixel box (rc ± s/2), gathered through its row bands.
fn wf_integrate_face(
  curves : ptr<storage, array<vec2<f32>>, read>,
  rows : ptr<storage, array<u32>, read>,
  band : vec4<f32>, rc : vec2<f32>, s : vec2<f32>
) -> f32 {
  let rowBase = u32(band.x);
  let R = u32(band.y);
  let invH = band.w;
  let sy2 = s.y * 0.5;
  let dy0 = band.z - rc.y;
  var ri0 : u32 = 0u;
  var ri1 : u32 = 0u;
  if (invH > 0.0) {
    ri0 = wf_band_index(-dy0 - sy2, invH, R);
    ri1 = wf_band_index(-dy0 + sy2, invH, R);
  }
  var f_int : f32 = 0.0;
  for (var ri = ri0; ri <= ri1; ri = ri + 1u) {
    var w_lo = -sy2;
    var w_hi = sy2;
    if (invH > 0.0) {
      let e = wf_band_edges(dy0, ri, invH);
      w_lo = max(w_lo, e.x);
      w_hi = min(w_hi, e.y);
    }
    if (w_hi <= w_lo) { continue; }
    let rIdx = (rowBase + ri) * WF_ROW_STRIDE;
    f_int += wf_integrate_band(curves, rows[rIdx], rows[rIdx + 1u], rc, w_lo, w_hi, s.x);
  }
  return f_int;
}

// Minification twin of wf_integrate_face: the same integral approximated from the precomputed
// banded ink profile — a few table taps, no curve reads.
fn wf_profile_face(
  rows : ptr<storage, array<u32>, read>,
  band : vec4<f32>, bbox : vec4<f32>, rc : vec2<f32>, s : vec2<f32>
) -> f32 {
  let pixLo = rc - s * 0.5;
  let pixHi = rc + s * 0.5;
  if (wf_overlap1d(pixLo.x, pixHi.x, bbox.x, bbox.z) <= 0.0) { return 0.0; }
  let rowBase = u32(band.x);
  let R = u32(band.y);
  let invH = select(band.w, 1.0 / max(bbox.w - bbox.y, 1e-30), band.w == 0.0);
  let y0 = band.z;
  var ri0 : u32 = 0u;
  var ri1 : u32 = 0u;
  if (R > 1u) {
    ri0 = wf_band_index(pixLo.y - y0, invH, R);
    ri1 = wf_band_index(pixHi.y - y0, invH, R);
  }
  var ink : f32 = 0.0;
  for (var ri = ri0; ri <= ri1; ri = ri + 1u) {
    let rIdx = (rowBase + ri) * WF_ROW_STRIDE;
    let e = wf_band_edges(y0, ri, invH);
    let ov = wf_overlap1d(pixLo.y, pixHi.y, e.x, e.y);
    let hull0 = bitcast<f32>(rows[rIdx + WF_ROW_XMIN]);
    let hull1 = bitcast<f32>(rows[rIdx + WF_ROW_XMAX]);
    let fx = wf_overlap1d(pixLo.x, pixHi.x, hull0, hull1) / max(hull1 - hull0, 1e-30);
    ink += bitcast<f32>(rows[rIdx + WF_ROW_AREA]) * (ov * invH) * fx;
  }
  return ink;
}
`

/**
 * Main coverage entry consumed via wgslFn: glyph-space position rc (from a varying), the
 * per-instance band header + ink bbox + fill rule, style (gamma, sharp), and the two storage
 * buffers. Returns styled coverage in [0, 1].
 */
export const WINDFOIL_WGSL_COVERAGE = /* wgsl */ `
fn wf_coverage(
  rc : vec2<f32>,
  band : vec4<f32>,
  bbox : vec4<f32>,
  fillRule : f32,
  style : vec2<f32>,
  curves : ptr<storage, array<vec2<f32>>, read>,
  rows : ptr<storage, array<u32>, read>
) -> f32 {
  // units_per_pixel from screen-space gradients — the device pixel's preimage in glyph space.
  let s = max(fwidth(rc), vec2<f32>(1e-9));
  var f : f32;
  if (all(s * WF_GUARD_PX >= bbox.zw - bbox.xy)) {
    f = wf_profile_face(rows, band, bbox, rc, s) / (s.x * s.y);
  } else {
    f = wf_integrate_face(curves, rows, band, rc, s) / (s.x * s.y);
  }
  return wf_style_coverage(wf_fold(f, fillRule), style.x, style.y);
}
`
