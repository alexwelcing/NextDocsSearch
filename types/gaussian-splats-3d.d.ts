declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three'

  export interface ViewerOptions {
    cameraUp?: number[]
    initialCameraPosition?: number[]
    initialCameraLookAt?: number[]
    renderer?: THREE.WebGLRenderer
    camera?: THREE.Camera
    useBuiltInControls?: boolean
    rootElement?: HTMLElement
  }

  export interface SplatSceneOptions {
    position?: number[]
    rotation?: number[]
    scale?: number[]
  }

  export class Viewer {
    constructor(options?: ViewerOptions)
    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>
    start(): void
    stop(): void
    dispose(): void
    render(): void
  }
}
