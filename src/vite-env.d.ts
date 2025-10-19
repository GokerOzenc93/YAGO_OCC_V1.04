/// <reference types="vite/client" />

declare module 'opencascade.js' {
  function initOpenCascade(): Promise<any>;
  export default initOpenCascade;
}

interface Window {
  opencascadeLoaded?: boolean;
}

export type OpenCascadeInstance = any;
export type TopoDS_Shape = any;
