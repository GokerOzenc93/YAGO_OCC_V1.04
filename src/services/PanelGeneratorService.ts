import { supabase } from '../components/Database';
import { PanelGeometry, PanelJointTypeData, PanelInstance } from '../types/Panel';

export class PanelGeneratorService {
  async getPanelsForProfile(profileId: string): Promise<PanelInstance[]> {
    try {
      const { data: profilePanels, error: panelError } = await supabase
        .from('profile_panels')
        .select('*')
        .eq('profile_id', profileId)
        .order('order');

      if (panelError) throw panelError;
      if (!profilePanels || profilePanels.length === 0) return [];

      const catalogIds = [...new Set(profilePanels.map(pp => pp.catalog_geometry_id))];

      const { data: geometries, error: geoError } = await supabase
        .from('geometry_catalog')
        .select('*')
        .in('id', catalogIds);

      if (geoError) throw geoError;
      if (!geometries) return [];

      const panels: PanelInstance[] = [];

      for (const profilePanel of profilePanels) {
        const geometry = geometries.find(g => g.id === profilePanel.catalog_geometry_id);
        if (!geometry) continue;

        const geometryData = geometry.geometry_data || {};

        const panelGeometry: PanelGeometry = {
          id: geometry.id,
          catalogId: geometry.id,
          name: geometry.code,
          description: geometry.description || geometry.code,
          role: profilePanel.role,
          faceIndex: 0,
          geometryType: geometryData.type || 'box',
          parameters: {
            width: geometryData.width || 100,
            height: geometryData.height || 100,
            depth: geometryData.depth || 18,
            ...geometry.shape_parameters
          },
        };

        const panelInstance: PanelInstance = {
          id: `${profilePanel.id}`,
          panelGeometry,
          customDescription: geometry.description || geometry.code,
          visible: profilePanel.visible !== false,
          position: {
            x: Number(profilePanel.offset_x) || 0,
            y: Number(profilePanel.offset_y) || 0,
            z: Number(profilePanel.offset_z) || 0,
          },
          rotation: {
            x: Number(profilePanel.rotation_x) || 0,
            y: Number(profilePanel.rotation_y) || 0,
            z: Number(profilePanel.rotation_z) || 0
          },
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
