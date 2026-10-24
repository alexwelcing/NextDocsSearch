// Symmetric int8 with one float32 scale per row (scale = max|v| / 127), for any dims. On disk:
// Int8Array[rows × dims] followed by Float32Array[rows] scales, little-endian.

export interface Int8RowMatrix {
  rows: number
  dims: number
  data: Int8Array
  /** 0 marks a missing row (no vector), which never scores. */
  scales: Float32Array
}

/** L2-normalize in place; a zero vector stays zero. */
export function normalize(vector: Float32Array): Float32Array {
  let sum = 0
  for (let i = 0; i < vector.length; i++) sum += vector[i] * vector[i]
  const norm = Math.sqrt(sum)
  if (norm > 0) for (let i = 0; i < vector.length; i++) vector[i] /= norm
  return vector
}

/** Matryoshka truncation: a normalized copy of the first `dims` components. */
export function truncateNormalize(vector: ArrayLike<number>, dims: number): Float32Array {
  if (vector.length < dims) throw new Error(`vector has ${vector.length} dims, need ${dims}`)
  return normalize(Float32Array.from({ length: dims }, (_, i) => vector[i]))
}

/** Quantize one row into `out` at `offset`; returns its scale (0 for a zero or invalid row). */
export function quantizeRow(vector: ArrayLike<number>, out: Int8Array, offset = 0): number {
  let max = 0
  for (let i = 0; i < vector.length; i++) max = Math.max(max, Math.abs(vector[i]))
  if (!(max > 0) || !Number.isFinite(max)) {
    out.fill(0, offset, offset + vector.length)
    return 0
  }
  const scale = max / 127
  for (let i = 0; i < vector.length; i++) {
    out[offset + i] = Math.max(-127, Math.min(127, Math.round(vector[i] / scale)))
  }
  return scale
}

/** Quantize row-major float vectors, normalizing each so that dot products are cosines. */
export function quantizeRows(vectors: Float32Array, dims: number): Int8RowMatrix {
  if (!(dims > 0) || vectors.length % dims) throw new Error('quantize: length is not rows × dims')
  const rows = vectors.length / dims
  const data = new Int8Array(vectors.length)
  const scales = new Float32Array(rows)
  for (let row = 0; row < rows; row++) {
    scales[row] = quantizeRow(
      normalize(vectors.slice(row * dims, (row + 1) * dims)),
      data,
      row * dims
    )
  }
  return { rows, dims, data, scales }
}

export function dequantizeRow(matrix: Int8RowMatrix, row: number): Float32Array {
  const out = new Float32Array(matrix.dims)
  const scale = matrix.scales[row]
  const offset = row * matrix.dims
  for (let i = 0; i < matrix.dims; i++) out[i] = matrix.data[offset + i] * scale
  return out
}

export function encodeInt8Rows(matrix: Int8RowMatrix): Uint8Array {
  const size = matrix.rows * matrix.dims
  const out = new Uint8Array(size + matrix.rows * 4)
  out.set(new Uint8Array(matrix.data.buffer, matrix.data.byteOffset, size))
  const scales = new DataView(out.buffer, size)
  matrix.scales.forEach((scale, row) => scales.setFloat32(row * 4, scale, true))
  return out
}

function bytesOf(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

export function decodeInt8Rows(
  bytes: ArrayBuffer | Uint8Array,
  rows: number,
  dims: number
): Int8RowMatrix {
  const view = bytesOf(bytes)
  const size = rows * dims
  if (view.byteLength !== size + rows * 4) {
    throw new Error(`vectors: expected ${size + rows * 4} bytes, got ${view.byteLength}`)
  }
  const data = new Int8Array(size)
  data.set(new Int8Array(view.buffer, view.byteOffset, size))
  const scales = new Float32Array(rows)
  const tail = new DataView(view.buffer, view.byteOffset + size, rows * 4)
  for (let row = 0; row < rows; row++) scales[row] = tail.getFloat32(row * 4, true)
  return { rows, dims, data, scales }
}

/** Row-major little-endian float32 rows, as an external embedding job may write them. */
export function decodeFloat32Rows(
  bytes: ArrayBuffer | Uint8Array,
  rows: number,
  dims: number
): Float32Array {
  const view = bytesOf(bytes)
  if (view.byteLength !== rows * dims * 4) {
    throw new Error(`vectors: expected ${rows * dims * 4} bytes, got ${view.byteLength}`)
  }
  const out = new Float32Array(rows * dims)
  const data = new DataView(view.buffer, view.byteOffset, view.byteLength)
  for (let i = 0; i < out.length; i++) out[i] = data.getFloat32(i * 4, true)
  return out
}
