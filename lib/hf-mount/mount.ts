/**
 * HF-Mount Core Implementation
 */

import { execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface HfMountConfig {
  mountPath: string
  hfToken?: string
  backend?: 'nfs' | 'fuse'
  cacheDir?: string
  cacheSize?: number
  pollIntervalSecs?: number
  readOnly?: boolean
}

export interface HfMountStatus {
  mountPath: string
  repoOrBucket: string
  type: 'repo' | 'bucket'
  pid?: number
  active: boolean
}

export interface MountedModel {
  localPath: string
  repoId: string
  unmount: () => Promise<void>
  readFile: (relativePath: string) => Buffer
  exists: (relativePath: string) => boolean
  listDir: (relativePath?: string) => string[]
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CACHE_SIZE = 10_000_000_000
const DEFAULT_POLL_INTERVAL = 30

function getHfMountBinary(backend: 'nfs' | 'fuse' = 'nfs'): string {
  const homeDir = process.env.HOME || '/home/codespace'
  const binName = backend === 'fuse' ? 'hf-mount-fuse' : 'hf-mount-nfs'
  const localBin = path.join(homeDir, '.local', 'bin', binName)
  
  if (fs.existsSync(localBin)) {
    return localBin
  }
  
  try {
    execSync(`which ${binName}`, { encoding: 'utf8' })
    return binName
  } catch {
    throw new Error(
      `${binName} not found. Install: curl -fsSL https://raw.githubusercontent.com/huggingface/hf-mount/main/install.sh | sh`
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// MOUNT OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function mountRepo(
  repoId: string,
  mountPath: string,
  config: Omit<HfMountConfig, 'mountPath'> = {}
): Promise<MountedModel> {
  const {
    hfToken = process.env.HF_TOKEN,
    backend = 'nfs',
    cacheDir = '/tmp/hf-mount-cache',
    cacheSize = DEFAULT_CACHE_SIZE,
    pollIntervalSecs = DEFAULT_POLL_INTERVAL,
  } = config

  if (!fs.existsSync(mountPath)) {
    fs.mkdirSync(mountPath, { recursive: true })
  }

  const binary = getHfMountBinary(backend)
  const args: string[] = [
    'repo',
    repoId,
    mountPath,
    '--cache-dir', cacheDir,
    '--cache-size', String(cacheSize),
    '--poll-interval-secs', String(pollIntervalSecs),
  ]

  if (hfToken) {
    args.push('--hf-token', hfToken)
  }

  const proc = spawn(binary, args, { detached: true, stdio: 'ignore' })
  proc.unref()

  await waitForMount(mountPath, 30000)
  return createMountedModel(mountPath, repoId, proc.pid)
}

export async function mountBucket(
  bucketPath: string,
  mountPath: string,
  config: Omit<HfMountConfig, 'mountPath'> & { readOnly?: boolean } = {}
): Promise<MountedModel> {
  const {
    hfToken = process.env.HF_TOKEN,
    backend = 'nfs',
    cacheDir = '/tmp/hf-mount-cache',
    cacheSize = DEFAULT_CACHE_SIZE,
    pollIntervalSecs = DEFAULT_POLL_INTERVAL,
    readOnly = false,
  } = config

  if (!hfToken) {
    throw new Error('HF_TOKEN is required for bucket mounting')
  }

  if (!fs.existsSync(mountPath)) {
    fs.mkdirSync(mountPath, { recursive: true })
  }

  const binary = getHfMountBinary(backend)
  const args: string[] = [
    'bucket',
    bucketPath,
    mountPath,
    '--hf-token', hfToken,
    '--cache-dir', cacheDir,
    '--cache-size', String(cacheSize),
    '--poll-interval-secs', String(pollIntervalSecs),
  ]

  if (readOnly) {
    args.push('--read-only')
  }

  const proc = spawn(binary, args, { detached: true, stdio: 'ignore' })
  proc.unref()

  await waitForMount(mountPath, 30000)
  return createMountedModel(mountPath, bucketPath, proc.pid)
}

function createMountedModel(
  mountPath: string,
  repoId: string,
  pid?: number
): MountedModel {
  return {
    localPath: mountPath,
    repoId,
    readFile: (relativePath: string): Buffer => {
      return fs.readFileSync(path.join(mountPath, relativePath))
    },
    exists: (relativePath: string): boolean => {
      return fs.existsSync(path.join(mountPath, relativePath))
    },
    listDir: (relativePath: string = ''): string[] => {
      const fullPath = path.join(mountPath, relativePath)
      if (!fs.existsSync(fullPath)) return []
      return fs.statSync(fullPath).isDirectory() 
        ? fs.readdirSync(fullPath) 
        : []
    },
    unmount: async (): Promise<void> => {
      await unmount(mountPath)
    },
  }
}

async function waitForMount(mountPath: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      fs.readdirSync(mountPath)
      return
    } catch {
      await new Promise(r => setTimeout(r, 100))
    }
  }
  throw new Error(`Mount timeout: ${mountPath}`)
}

export async function unmount(mountPath: string): Promise<void> {
  try {
    execSync(`hf-mount stop "${mountPath}"`, { stdio: 'ignore' })
  } catch {
    try {
      execSync(`umount "${mountPath}" 2>/dev/null || fusermount -u "${mountPath}" 2>/dev/null`, { stdio: 'ignore' })
    } catch {}
  }
  try {
    fs.rmdirSync(mountPath)
  } catch {}
}

export function getMountStatus(): HfMountStatus[] {
  try {
    execSync('hf-mount status', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    return []
  } catch {
    return []
  }
}

export class HfModelLoader {
  private mountedModel?: MountedModel
  constructor(private repoId: string, private mountBase: string = '/tmp/hf-mounts') {}

  async doMount(config?: Omit<HfMountConfig, 'mountPath'>): Promise<MountedModel> {
    const safeRepoName = this.repoId.replace(/[/:]/g, '-')
    const mountPath = path.join(this.mountBase, safeRepoName)
    this.mountedModel = await mountRepo(this.repoId, mountPath, config)
    return this.mountedModel
  }

  getLocalPath(relativePath: string): string {
    if (!this.mountedModel) throw new Error('Not mounted')
    return path.join(this.mountedModel.localPath, relativePath)
  }

  readConfig<T = unknown>(configPath: string = 'config.json'): T {
    if (!this.mountedModel) throw new Error('Not mounted')
    return JSON.parse(this.mountedModel.readFile(configPath).toString('utf-8'))
  }

  findFiles(extension: string, subdir: string = ''): string[] {
    if (!this.mountedModel) throw new Error('Not mounted')
    const dirPath = path.join(this.mountedModel.localPath, subdir)
    if (!fs.existsSync(dirPath)) return []
    
    const files: string[] = []
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(path.join(subdir, entry.name))
      } else if (entry.isDirectory()) {
        files.push(...this.findFiles(extension, path.join(subdir, entry.name)))
      }
    }
    return files
  }

  async unmount(): Promise<void> {
    if (this.mountedModel) {
      await this.mountedModel.unmount()
      this.mountedModel = undefined
    }
  }
}

export async function cleanup(): Promise<void> {
  const mounts = getMountStatus()
  for (const m of mounts) {
    await unmount(m.mountPath)
  }
  try {
    fs.rmSync('/tmp/hf-mount-cache', { recursive: true, force: true })
  } catch {}
}
