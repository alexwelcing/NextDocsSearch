declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three'

  export interface ViewerOptions {
    cameraUp?: number[]
    initialCameraPosition?: number[]
    initialCameraLookAt?: number[]
    renderer?: THREE.WebGLRenderer
    camera?: THREE.Camera
    useBuiltInControls?: boolean
    rootElement?: HTMLElement | null
    selfDrivenMode?: boolean
    gpuAcceleratedSort?: boolean
    sharedMemoryForWorkers?: boolean
    integerBasedSort?: boolean
    sceneRevealMode?: SceneRevealMode
    logLevel?: LogLevel
  }

  export interface SplatSceneOptions {
    position?: number[]
    rotation?: number[]
    scale?: number[]
    showLoadingUI?: boolean
  }

  export enum SceneRevealMode {
    Default,
    Gradual,
    Instant,
  }

  export enum LogLevel {
    None,
    Error,
    Warning,
    Info,
    Debug,
  }

  export class Viewer {
    constructor(options?: ViewerOptions)
    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>
    start(): void
    stop(): void
    dispose(): void
    render(): void
  }

  export class DropInViewer extends THREE.Group {
    constructor(options?: ViewerOptions)
    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>
    removeSplatScenes(indexes: number[], showLoadingUI?: boolean): Promise<void>
    getSceneCount(): number
    dispose(): Promise<void>
  }
}
