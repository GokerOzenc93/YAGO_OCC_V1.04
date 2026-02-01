import { BasePanelGeometry, PanelMeshData } from './BasePanelGeometry';
import { PanelGeometry } from '../../types/Panel';

export class BottomPanelGeometry extends BasePanelGeometry {
  constructor(geometry: PanelGeometry) {
    super(geometry);
  }

  async generateMesh(): Promise<PanelMeshData> {
    const width = this.getParameter('width', 1000);
    const depth = this.getParameter('depth', 600);
    const thickness = this.getParameter('thickness', 18);

    return this.createPanelWithReplicad(width, depth, thickness);
  }

  getPosition(): { x: number; y: number; z: number } {
    const height = this.getParameter('height', 2000);
    const thickness = this.getParameter('thickness', 18);

    return {
      x: 0,
      y: -height / 2 - thickness / 2,
      z: 0,
    };
  }

  getRotation(): { x: number; y: number; z: number } {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }
}
