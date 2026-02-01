export interface PanelGeometry {
  id: string;
  catalogId: string;
  name: string;
  description: string;
  role: string;
  faceIndex: number;
  geometryType: string;
  parameters: Record<string, number>;
}

export interface PanelInstance {
  id: string;
  panelGeometry: PanelGeometry;
  customDescription?: string;
  visible: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface PanelJointTypeData {
  id: string;
  profile_id: string;
  catalog_geometry_id: string;
  role: string;
  joint_type: string;
  offset_x: number;
  offset_y: number;
  offset_z: number;
  created_at: string;
}

export type PanelRole =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'back'
  | 'front'
  | 'shelf'
  | 'divider'
  | 'door';
