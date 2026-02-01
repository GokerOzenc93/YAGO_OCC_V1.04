import { supabase } from '../components/Database';
import { PanelGeometry, PanelJointTypeData, PanelInstance } from '../types/Panel';

export class PanelGeneratorService {
  async getPanelsForProfile(profileId: string): Promise<PanelInstance[]> {
    try {
      const { data: jointTypes, error: jointError } = await supabase
        .from('panel_joint_types')
        .select('*')
        .eq('profile_id', profileId);

      if (jointError) throw jointError;
      if (!jointTypes || jointTypes.length === 0) return [];

      const catalogIds = [...new Set(jointTypes.map(jt => jt.catalog_geometry_id))];

      const { data: geometries, error: geoError } = await supabase
        .from('geometry_catalog')
        .select('*')
        .in('id', catalogIds);

      if (geoError) throw geoError;
      if (!geometries) return [];

      const panels: PanelInstance[] = [];

      for (const jointType of jointTypes) {
        const geometry = geometries.find(g => g.id === jointType.catalog_geometry_id);
        if (!geometry) continue;

        const panelGeometry: PanelGeometry = {
          id: geometry.id,
          catalogId: geometry.id,
          name: geometry.name,
          description: geometry.description,
          role: jointType.role,
          faceIndex: 0,
          geometryType: geometry.geometry_type || 'box',
          parameters: geometry.parameters || {},
        };

        const panelInstance: PanelInstance = {
          id: `${jointType.id}`,
          panelGeometry,
          customDescription: geometry.description,
          visible: true,
          position: {
            x: jointType.offset_x || 0,
            y: jointType.offset_y || 0,
            z: jointType.offset_z || 0,
          },
          rotation: { x: 0, y: 0, z: 0 },
        };

        panels.push(panelInstance);
      }

      return panels;
    } catch (error) {
      console.error('Error fetching panels for profile:', error);
      throw error;
    }
  }

  groupPanelsByRole(panels: PanelInstance[]): Map<string, PanelInstance[]> {
    const grouped = new Map<string, PanelInstance[]>();

    for (const panel of panels) {
      const role = panel.panelGeometry.role;
      if (!grouped.has(role)) {
        grouped.set(role, []);
      }
      grouped.get(role)?.push(panel);
    }

    return grouped;
  }

  async updatePanelDescription(panelId: string, newDescription: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('geometry_catalog')
        .update({ description: newDescription })
        .eq('id', panelId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating panel description:', error);
      throw error;
    }
  }
}

export const panelGeneratorService = new PanelGeneratorService();
