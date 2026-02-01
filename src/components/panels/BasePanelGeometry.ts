import { PanelGeometry } from '../../types/Panel';

export interface PanelMeshData {
  vertices: Float32Array;
  faces: Uint32Array;
  normals?: Float32Array;
}

export abstract class BasePanelGeometry {
  protected geometry: PanelGeometry;

  constructor(geometry: PanelGeometry) {
    this.geometry = geometry;
  }

  abstract generateMesh(): Promise<PanelMeshData>;

  protected getParameter(key: string, defaultValue: number = 0): number {
    return this.geometry.parameters[key] ?? defaultValue;
  }

  protected async createBoxMesh(
    width: number,
    height: number,
    depth: number
  ): Promise<PanelMeshData> {
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    const vertices = new Float32Array([
      -hw, -hh, -hd,
      hw, -hh, -hd,
      hw, hh, -hd,
      -hw, hh, -hd,
      -hw, -hh, hd,
      hw, -hh, hd,
      hw, hh, hd,
      -hw, hh, hd,
    ]);

    const faces = new Uint32Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      0, 4, 5, 0, 5, 1,
      2, 6, 7, 2, 7, 3,
      0, 3, 7, 0, 7, 4,
      1, 5, 6, 1, 6, 2,
    ]);

    return { vertices, faces };
  }

  protected async createPanelWithReplicad(
    width: number,
    height: number,
    thickness: number
  ): Promise<PanelMeshData> {
    try {
      const replicad = await import('replicad');

      const panel = replicad
        .drawRectangle(width, height)
        .sketchOnPlane('XY')
        .extrude(thickness);

      const mesh = panel.mesh({ tolerance: 0.1, angularTolerance: 30 });

      return {
        vertices: new Float32Array(mesh.vertices),
        faces: new Uint32Array(mesh.faces),
      };
    } catch (error) {
      console.error('Error creating panel with Replicad:', error);
      return this.createBoxMesh(width, height, thickness);
    }
  }
}
