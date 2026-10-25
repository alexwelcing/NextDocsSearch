// Reads from the static export (env.ASSETS) by site path. The binding ignores the origin, so a fixed
// internal one is used: nothing here derives a URL from the request's Host header.
import type { AssetsLike } from '../env'

const ASSETS_ORIGIN = 'https://assets.internal'

export function fetchAsset(
  assets: AssetsLike,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return assets.fetch(new Request(new URL(path, ASSETS_ORIGIN), init))
}
