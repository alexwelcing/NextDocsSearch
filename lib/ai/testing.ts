// Test helpers: SSE transcripts from providers/__fixtures__, replayed as byte streams.
import { readFileSync } from 'node:fs'

export type SseFixture =
  | 'workers-ai-gemma-4'
  | 'workers-ai-llama-4-scout'
  | 'workers-ai-qwen3-think'
  | 'huggingface-router'

export function sseFixture(name: SseFixture): string {
  return readFileSync(new URL(`./providers/__fixtures__/${name}.sse`, import.meta.url), 'utf8')
}

/** The text as a byte stream cut every `size` bytes, so lines and code points split mid-chunk. */
export function byteStream(text: string, size = Infinity): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close()
        return
      }
      const end = Math.min(bytes.length, offset + Math.max(1, Math.min(size, bytes.length)))
      controller.enqueue(bytes.slice(offset, end))
      offset = end
    },
  })
}
