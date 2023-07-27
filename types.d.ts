declare module 'three/addons/controls/OrbitControls.js' {
    import { Camera, EventDispatcher } from 'three';

    export class OrbitControls extends EventDispatcher {
      constructor(object: Camera, domElement?: HTMLElement);

      enabled: boolean;
      target: THREE.Vector3;

      // Add all other properties from the documentation that you will use
      enableZoom: boolean;
      minPolarAngle: number;
      maxPolarAngle: number;
      enableRotate: boolean;

      update(): void;
      // ... You can continue to add other methods or properties you plan to use
    }
  }


  interface Window {
    gtag(type: 'config', googleAnalyticsId: string, { page_path: string });
    // ... any other types or methods you might want to add or override
  }