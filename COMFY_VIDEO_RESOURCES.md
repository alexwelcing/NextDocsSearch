# Comfy + NextDocsSearch video resources

This repo generates article teaser videos by queueing a ComfyUI workflow (CogVideoX wrapper) and copying the resulting mp4 into the Next.js public folder.

## Key folders (ComfyUI)

- ComfyUI root: `ComfyUI_windows_portable/ComfyUI/`
- Text encoders (T5): `ComfyUI/models/text_encoders/`
  - Example used by the generator: `fluxTextencoderT5XxlFp8_v10.safetensors`
- Video outputs:
  - Saved outputs: `ComfyUI/output/`
  - Temporary outputs: `ComfyUI/temp/`

## Key folders (NextDocsSearch)

- Articles (MDX): `NextDocsSearch/pages/docs/articles/*.mdx`
- Init images (inputs):
  - `NextDocsSearch/public/images/articles/`
  - `NextDocsSearch/public/images/og/`
- Generated teaser videos (outputs): `NextDocsSearch/public/videos/articles/`
- Debug history dumps (optional): `NextDocsSearch/.cache/comfy_history/`

## Useful commands

- Validate ComfyUI has required nodes + list installed text encoders:
  - `pnpm run comfy:doctor`

- Generate one video and wait for completion:
  - `pnpm run generate:videos -- --article <slug> --force --debug`

- Queue a job but do not wait (recommended for long runs / batching):
  - `pnpm run generate:videos -- --article <slug> --force --no-wait`

- Use a specific preset (defaults to 'quality', auto-downgrades on failure):
  - `pnpm run generate:videos -- --preset fast`
  - Available presets: `quality` (bf16, 720p), `balanced` (fp8, 720p), `fast` (fp8, 512p).

- Faster iteration model (if installed/available in the wrapper list):
  - `pnpm run generate:videos -- --article <slug> --force --model NimVideo/cogvideox-2b-img2vid`
