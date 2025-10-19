/// <reference types="vite/client" />

declare module 'opencascade.js' {
  interface InitOpenCascadeOptions {
    locateFile?: (path: string) => string;
  }

  function initOpenCascade(options?: InitOpenCascadeOptions): Promise<any>;
  export default initOpenCascade;
}

interface Window {
  opencascadeLoaded?: boolean;
}

export type OpenCascadeInstance = any;
export type TopoDS_Shape = any;
