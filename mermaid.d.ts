declare module 'mermaid' {
    export function initialize(config: any): void;
    export function render(id: string, txt: string, cb: any): void;

    export type RenderCallback = (svgCode: string, bindFunctions: any) => void;
  }
