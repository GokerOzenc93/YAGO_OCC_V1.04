import { BasePanelGeometry, PanelMeshData } from './BasePanelGeometry';
import { PanelGeometry } from '../../types/Panel';

export class ShelfPanelGeometry extends BasePanelGeometry {
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
    const offsetY = this.getParameter('offsetY', 0);

    return {
      x: 0,
      y: offsetY,
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
