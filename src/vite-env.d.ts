/// <reference types="vite/client" />

interface Window {
  opencascadeLoaded?: boolean;
  initOpenCascade?: (options?: any) => Promise<any>;
}

export type OpenCascadeInstance = any;
export type TopoDS_Shape = any;
