import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PanelJointType {
  id: string;
  name: string;
  settings: {
    selectedBodyType?: string;
    bazaHeight?: number;
    frontBaseDistance?: number;
    backBaseDistance?: number;
    legHeight?: number;
    legDiameter?: number;
    legFrontDistance?: number;
    legBackDistance?: number;
    legSideDistance?: number;
    topPanelWidth?: number;
    bottomPanelWidth?: number;
    topPanelPositionX?: number;
    bottomPanelPositionX?: number;
    topLeftExpanded?: boolean;
    topRightExpanded?: boolean;
    bottomLeftExpanded?: boolean;
    bottomRightExpanded?: boolean;
    leftPanelHeight?: number;
    leftPanelPositionY?: number;
    rightPanelHeight?: number;
    rightPanelPositionY?: number;
  };
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

class PanelJointTypesService {
  async list(): Promise<PanelJointType[]> {
    const { data, error } = await supabase
      .from('panel_joint_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to list panel joint types:', error);
      throw error;
    }

    return data || [];
  }

  async get(id: string): Promise<PanelJointType | null> {
    const { data, error } = await supabase
      .from('panel_joint_types')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Failed to get panel joint type:', error);
      throw error;
    }

    return data;
  }

  async create(panelJointType: Omit<PanelJointType, 'id' | 'created_at' | 'updated_at'>): Promise<PanelJointType> {
    const { data, error } = await supabase
      .from('panel_joint_types')
      .insert([panelJointType])
      .select()
      .single();

    if (error) {
      console.error('Failed to create panel joint type:', error);
      throw error;
    }

    return data;
  }

  async update(id: string, updates: Partial<PanelJointType>): Promise<PanelJointType> {
    const { data, error } = await supabase
      .from('panel_joint_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update panel joint type:', error);
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('panel_joint_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete panel joint type:', error);
      throw error;
    }
  }
}

export const panelJointTypesService = new PanelJointTypesService();
