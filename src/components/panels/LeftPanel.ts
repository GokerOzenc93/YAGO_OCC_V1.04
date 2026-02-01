import { BasePanelGeometry, PanelMeshData } from './BasePanelGeometry';
import { PanelGeometry } from '../../types/Panel';

export class LeftPanelGeometry extends BasePanelGeometry {
  constructor(geometry: PanelGeometry) {
    super(geometry);
  }

  async generateMesh(): Promise<PanelMeshData> {
    const height = this.getParameter('height', 2000);
    const depth = this.getParameter('depth', 600);
    const thickness = this.getParameter('thickness', 18);

    return this.createPanelWithReplicad(depth, height, thickness);
  }

  getPosition(): { x: number; y: number; z: number } {
    const width = this.getParameter('width', 1000);
    const thickness = this.getParameter('thickness', 18);

    return {
      x: -width / 2 - thickness / 2,
      y: 0,
      z: 0,
    };
  }

  getRotation(): { x: number; y: number; z: number } {
    return {
      x: 0,
      y: Math.PI / 2,
      z: 0,
    };
  }
}
