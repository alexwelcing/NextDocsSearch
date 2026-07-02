# ACC ComfyUI Queue Manager Integration

This directory contains the TypeScript integration layer for the **Agent Command Center (ACC)** Elixir ComfyUI queue manager.

The ACC repo lives at `../../agent-command-center-ex` and provides a managed queue with backpressure, job lifecycle tracking, and PubSub updates for ComfyUI workflow execution.

## Architecture

```
NextDocsSearch (this repo)
    │
    ├── lib/orchestrator/orchestrator.ts    ← Unified stack manager
    ├── lib/orchestrator/acc-service.ts     ← ACC lifecycle manager
    ├── lib/acc-queue/client.ts             ← HTTP client for ACC API
    ├── lib/image-grading/grader.ts         ← Image evaluation
    └── scripts/acc-batch-generate-and-grade.ts  ← Pipeline script
              │
              ▼ HTTP/JSON
    agent-command-center-ex (port 4000)
              │
              ▼ Elixir Queue Manager
    ComfyUI (port 8188)
```

## Quick Start (Recommended)

Use the **Generation Stack Manager** to start and monitor both services as a unified, crash-resistant stack:

```bash
# Start ComfyUI + ACC together
pnpm genstack:start

# Check health in another terminal
pnpm genstack:status

# Stop everything
pnpm genstack:stop
```

### Why use the stack manager?

- **Correct startup order**: ComfyUI first, then ACC
- **Crash recovery**: Auto-restarts either service if it dies
- **Health monitoring**: Verifies ACC ↔ ComfyUI link before allowing generation
- **Graceful shutdown**: Handles Ctrl+C cleanly on Windows
- **VRAM circuit breaker**: Pauses generation if GPU memory exceeds 95%
- **Queue throttling**: Slows down submissions if ACC queue gets too deep

## Generate & Grade Images

Once the stack is running:

```bash
# Preview what would be generated
pnpm acc:generate:preview

# Generate images for articles that don't have them yet
pnpm acc:generate

# Force regenerate all
pnpm acc:generate:force

# Strict grading (min score 7.0, auto-retry on failure)
pnpm acc:generate:strict

# Limit to 5 articles for testing
pnpm acc:generate -- --limit 5
```

### Automatic service recovery

By default, `pnpm acc:generate` will:
1. Check if ComfyUI and ACC are running
2. Start either one if missing
3. Verify the ACC ↔ ComfyUI connection
4. During the batch, re-check health every 5 images and auto-recover if needed

To skip auto-start (fail fast if services are down):
```bash
pnpm acc:generate -- --no-ensure-services
```

### Circuit breaker & throttling

The batch script automatically:
- **Pauses** if VRAM usage goes above 95% (waits until it drops below 85%)
- **Throttles** if the ACC queue depth reaches 5 or more (waits until it drains)

## CLI Flags

All flags can be passed via `pnpm acc:generate -- <flags>`:

| Flag | Description |
|------|-------------|
| `--preview` | Show prompts without submitting workflows |
| `--limit N` | Only process N articles |
| `--force` | Regenerate even if image already exists |
| `--min-score N` | Minimum grade to accept (default: 5.0) |
| `--auto-retry` | Re-queue with a new seed if grade is too low |
| `--svg-only` | Only process articles that currently have SVG images |
| `--no-ensure-services` | Don't auto-start ComfyUI/ACC if they're down |

## Testing & Validation

### Unit tests

```bash
# Test image grader
pnpm test:grader

# Test ACC client
pnpm test:acc-client

# Test orchestrator
pnpm vitest run --config vitest.node.config.ts tests/orchestrator.test.ts

# Run all Node tests
pnpm test:node
```

### Stack validation (no image generation)

```bash
# Validate connectivity and health checks
pnpm validate:stack

# Validate with live service startup
pnpm validate:stack:live
```

## Files

| File | Purpose |
|------|---------|
| `lib/orchestrator/orchestrator.ts` | Unified stack orchestrator: manages ComfyUI + ACC together |
| `lib/orchestrator/acc-service.ts` | ACC process lifecycle (start, stop, restart, health check) |
| `lib/acc-queue/client.ts` | HTTP client for ACC's `/api/comfy/*` and proxy endpoints |
| `lib/image-grading/grader.ts` | Programmatic image quality analysis |
| `scripts/generation-stack-manager.ts` | CLI for `pnpm genstack:*` commands |
| `scripts/acc-batch-generate-and-grade.ts` | End-to-end pipeline with circuit breaker & throttling |
| `scripts/validate-generation-stack.ts` | Diagnostic script for testing stack health |
| `vitest.node.config.ts` | Vitest config for Node.js tests |

## Environment Variables

```bash
# ACC location (default: http://localhost:4000)
ACC_URL=http://localhost:4000

# ComfyUI location for direct image downloads (default: http://localhost:8188)
COMFYUI_URL=http://localhost:8188
```

## Manual Start (if not using stack manager)

If you prefer to manage processes yourself:

1. **Start ComfyUI:**
   ```powershell
   cd ..\..\ComfyUI_windows_portable
   .\run_nvidia_gpu.bat
   ```

2. **Start ACC:**
   ```powershell
   cd ..\..\agent-command-center-ex
   mix phx.server
   ```

## Grading System

Images are scored on two dimensions:

- **Technical Score** (0-10): resolution, file size, sharpness
- **Aesthetic Score** (0-10): contrast, saturation balance, color variety
- **Overall Score**: weighted 60% technical / 40% aesthetic

Grades are persisted to `lib/generated/image-grades.json`.

### Rejected Images

If `--min-score` is set and an image scores below it, the pipeline will:
1. Flag it as rejected in the grade database
2. If `--auto-retry` is enabled, resubmit with a different seed (up to 2 retries)
3. Never update the image manifest for rejected images

## Using the Client Directly

```typescript
import { getACCClient } from '../lib/acc-queue/client'

const acc = getACCClient()

// Submit a workflow
const { job_id } = await acc.submitWorkflow(myWorkflow, { priority: 0 })

// Wait for completion
const job = await acc.waitForCompletion(job_id)

// Download output
const buffer = await acc.downloadOutput('ComfyUI_00001_.png')
```

## Troubleshooting

### "ACC is not running"

Start the full stack:
```bash
pnpm genstack:start
```

Or manually:
```powershell
cd ../../agent-command-center-ex
mix phx.server
```

### "ComfyUI link: DOWN"

ACC cannot reach ComfyUI. Restart the stack:
```bash
pnpm genstack:restart
```

### Jobs timeout

The default wait timeout is 10 minutes. For very slow workflows, increase it in `client.ts` or check ComfyUI/ACC logs.

### ACC crashes on startup

Check that the ACC directory exists at `../../agent-command-center-ex` and that Elixir/Mix are installed:
```bash
mix --version
```

### VRAM circuit breaker keeps opening

- Reduce batch size with `--limit`
- Use `--no-ensure-services` and manually manage ComfyUI with lower VRAM settings
- Check `pnpm genstack:status` for current VRAM usage
