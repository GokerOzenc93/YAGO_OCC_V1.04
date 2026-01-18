import React, { useState, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface CustomSettingsGroup {
  id: string;
  name: string;
  icon: string;
  order: number;
}

interface SystemSetting {
  id: string;
  category: string;
  name: string;
  value: string;
  type: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  order: number;
}

interface CustomSetting {
  id: string;
  group_id: string;
  name: string;
  value: string;
  type: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  order: number;
}

interface GlobalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ isOpen, onClose }) => {
  const [customGroups, setCustomGroups] = useState<CustomSettingsGroup[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [customSettings, setCustomSettings] = useState<CustomSetting[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newSettingName, setNewSettingName] = useState('');
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, settingsRes, customSettingsRes] = await Promise.all([
        supabase
          .from('custom_settings_groups')
          .select('*')
          .order('order', { ascending: true }),
        supabase
          .from('system_settings')
          .select('*')
          .order('category', { ascending: true })
          .order('order', { ascending: true }),
        supabase
          .from('custom_settings')
          .select('*')
          .order('order', { ascending: true })
      ]);

      if (groupsRes.data) setCustomGroups(groupsRes.data);
      if (settingsRes.data) {
        setSystemSettings(settingsRes.data);
        const initialValues: Record<string, string> = {};
        settingsRes.data.forEach(setting => {
          initialValues[setting.id] = setting.value || '';
        });
        setEditingValues(initialValues);
      }
      if (customSettingsRes.data) {
        setCustomSettings(customSettingsRes.data);
        const customValues: Record<string, string> = {};
        customSettingsRes.data.forEach(setting => {
          customValues[setting.id] = setting.value || '';
        });
        setEditingValues(prev => ({ ...prev, ...customValues }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const maxOrder = Math.max(...customGroups.map(g => g.order), -1);
      const { data } = await supabase
        .from('custom_settings_groups')
        .insert([{
          name: newGroupName,
          icon: 'Settings',
          order: maxOrder + 1
        }])
        .select()
        .single();

      if (data) {
        setCustomGroups([...customGroups, data]);
        setNewGroupName('');
      }
    } catch (error) {
      console.error('Error adding group:', error);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await supabase
        .from('custom_settings_groups')
        .delete()
        .eq('id', id);

      setCustomGroups(customGroups.filter(g => g.id !== id));
      if (selectedGroup === id) setSelectedGroup(null);
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const handleSettingChange = (id: string, value: string) => {
    setEditingValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSaveSetting = async (setting: SystemSetting | CustomSetting) => {
    const newValue = editingValues[setting.id];
    if (newValue === setting.value) return;

    try {
      const isCustomSetting = 'group_id' in setting;
      const tableName = isCustomSetting ? 'custom_settings' : 'system_settings';

      await supabase
        .from(tableName)
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('id', setting.id);

      if (isCustomSetting) {
        setCustomSettings(customSettings.map(s =>
          s.id === setting.id ? { ...s, value: newValue } : s
        ));
      } else {
        setSystemSettings(systemSettings.map(s =>
          s.id === setting.id ? { ...s, value: newValue } : s
        ));
      }
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  };

  const handleAddCustomSetting = async () => {
    if (!newSettingName.trim() || !selectedGroup) return;

    const group = customGroups.find(g => g.id === selectedGroup);
    if (!group) return;

    try {
      const maxOrder = Math.max(
        ...customSettings.filter(s => s.group_id === selectedGroup).map(s => s.order),
        -1
      );

      const { data } = await supabase
        .from('custom_settings')
        .insert([{
          group_id: selectedGroup,
          name: newSettingName,
          value: '',
          type: 'text',
          order: maxOrder + 1
        }])
        .select()
        .single();

      if (data) {
        setCustomSettings([...customSettings, data]);
        setEditingValues(prev => ({ ...prev, [data.id]: '' }));
        setNewSettingName('');
      }
    } catch (error) {
      console.error('Error adding custom setting:', error);
    }
  };

  const handleDeleteCustomSetting = async (id: string) => {
    try {
      await supabase
        .from('custom_settings')
        .delete()
        .eq('id', id);

      setCustomSettings(customSettings.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting custom setting:', error);
    }
  };

  const groupedSettings = systemSettings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const groupedCustomSettings = customSettings.reduce((acc, setting) => {
    if (!acc[setting.group_id]) {
      acc[setting.group_id] = [];
    }
    acc[setting.group_id].push(setting);
    return acc;
  }, {} as Record<string, CustomSetting[]>);

  const categories = Object.keys(groupedSettings).sort();

  const isCustomGroup = selectedGroup && customGroups.some(g => g.id === selectedGroup);
  const currentSettings: (SystemSetting | CustomSetting)[] = isCustomGroup
    ? groupedCustomSettings[selectedGroup] || []
    : groupedSettings[selectedGroup] || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white w-[800px] h-[600px] flex flex-col shadow-lg" onClick={e => e.stopPropagation()}>
        {/* Windows-style title bar */}
        <div className="flex items-center justify-between h-8 px-3 bg-white border-b border-gray-300">
          <h1 className="text-xs font-normal text-gray-800">Global Settings</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-6 h-5 flex items-center justify-center hover:bg-gray-200 transition-colors"
              title="Minimize"
            >
              <Minus size={12} className="text-gray-700" />
            </button>
            <button
              onClick={onClose}
              className="w-6 h-5 flex items-center justify-center hover:bg-gray-200 transition-colors"
              title="Maximize"
            >
              <Square size={9} className="text-gray-700" />
            </button>
            <button
              onClick={onClose}
              className="w-6 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
              title="Close"
            >
              <X size={12} className="text-gray-700 hover:text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Settings List */}
          <div className="w-[220px] border-r border-gray-300 bg-gray-50 flex flex-col">
            {/* System Settings Header */}
            <div className="h-7 px-2 bg-white border-b border-gray-300 flex items-center">
              <h3 className="text-xs font-normal text-gray-700">System Settings</h3>
            </div>

            {/* System Settings List */}
            <div className="flex-1 overflow-y-auto bg-white">
              {categories.map(category => (
                <div
                  key={category}
                  onClick={() => setSelectedGroup(category)}
                  className={`h-7 px-2 flex items-center cursor-pointer border-b border-gray-100 ${
                    selectedGroup === category && !isCustomGroup
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100 text-gray-800'
                  }`}
                >
                  <span className="text-xs font-normal truncate">{category}</span>
                </div>
              ))}
            </div>

            {/* Custom Settings Section */}
            <div className="border-t border-gray-300">
              {/* Custom Settings Header */}
              <div className="h-7 px-2 bg-white border-b border-gray-300 flex items-center">
                <h3 className="text-xs font-normal text-gray-700">Custom Settings</h3>
              </div>

              {/* Custom Settings List */}
              <div className="max-h-40 overflow-y-auto bg-white">
                {customGroups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={`h-7 px-2 flex items-center cursor-pointer border-b border-gray-100 ${
                      selectedGroup === group.id
                        ? 'bg-blue-500 text-white'
                        : 'hover:bg-gray-100 text-gray-800'
                    }`}
                  >
                    <span className="text-xs font-normal truncate flex-1">{group.name}</span>
                  </div>
                ))}
              </div>

              {/* Add Group Input */}
              <div className="h-9 px-2 py-1.5 bg-white border-t border-gray-200 flex gap-1">
                <input
                  type="text"
                  placeholder="New group..."
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddGroup()}
                  className="flex-1 px-1.5 py-0.5 text-xs bg-white border border-gray-300 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddGroup}
                  disabled={!newGroupName.trim()}
                  className="px-2 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 border border-gray-300"
                >
                  Add
                </button>
              </div>

              {/* Delete Selected Group Button */}
              {selectedGroup && isCustomGroup && (
                <div className="h-8 px-2 bg-gray-50 border-t border-gray-300 flex items-center">
                  <button
                    onClick={() => handleDeleteGroup(selectedGroup)}
                    className="text-xs text-gray-700 hover:text-red-600 font-normal"
                  >
                    Seçilen Seti Sil
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Settings Details */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="h-7 px-2 bg-white border-b border-gray-300 flex items-center justify-between">
              <h3 className="text-xs font-normal text-gray-700">
                {selectedGroup && (isCustomGroup
                  ? customGroups.find(g => g.id === selectedGroup)?.name
                  : selectedGroup)}
              </h3>
              {isCustomGroup && selectedGroup && (
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Setting name..."
                    value={newSettingName}
                    onChange={e => setNewSettingName(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddCustomSetting()}
                    className="w-32 px-1.5 py-0.5 text-xs bg-white border border-gray-300 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddCustomSetting}
                    disabled={!newSettingName.trim()}
                    className="px-2 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 border border-gray-300"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-500">Loading...</p>
                </div>
              )}

              {!loading && selectedGroup && currentSettings.length > 0 && (
                <div className="p-3">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-1.5 px-2 text-xs font-normal text-gray-700 bg-gray-50">Setting</th>
                        <th className="text-left py-1.5 px-2 text-xs font-normal text-gray-700 bg-gray-50">Value</th>
                        <th className="text-left py-1.5 px-2 text-xs font-normal text-gray-700 bg-gray-50">Unit</th>
                        <th className="w-16 py-1.5 px-2 text-xs font-normal text-gray-700 bg-gray-50"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSettings.map((setting) => (
                        <tr key={setting.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-1.5 px-2">
                            <span className="text-xs text-gray-800">{setting.name}</span>
                          </td>
                          <td className="py-1.5 px-2">
                            {setting.type === 'number' ? (
                              <input
                                type="number"
                                value={editingValues[setting.id] || ''}
                                onChange={e => handleSettingChange(setting.id, e.target.value)}
                                min={setting.min_value || undefined}
                                max={setting.max_value || undefined}
                                className="w-20 px-1.5 py-0.5 text-xs border border-gray-300 focus:outline-none focus:border-blue-500"
                              />
                            ) : setting.type === 'select' ? (
                              <select
                                value={editingValues[setting.id] || ''}
                                onChange={e => handleSettingChange(setting.id, e.target.value)}
                                className="w-32 px-1.5 py-0.5 text-xs border border-gray-300 focus:outline-none focus:border-blue-500"
                              >
                                <option value="">Select...</option>
                                <option value={editingValues[setting.id] || setting.value}>
                                  {editingValues[setting.id] || setting.value}
                                </option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={editingValues[setting.id] || ''}
                                onChange={e => handleSettingChange(setting.id, e.target.value)}
                                className="w-32 px-1.5 py-0.5 text-xs border border-gray-300 focus:outline-none focus:border-blue-500"
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            {setting.unit && (
                              <span className="text-xs text-gray-600">{setting.unit}</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button
                              onClick={() => handleSaveSetting(setting)}
                              disabled={editingValues[setting.id] === setting.value}
                              className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
                            >
                              Save
                            </button>
                            {isCustomGroup && (
                              <button
                                onClick={() => handleDeleteCustomSetting(setting.id)}
                                className="ml-1 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 border border-gray-300"
                                title="Delete"
                              >
                                Del
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && selectedGroup && currentSettings.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-500">No settings available</p>
                </div>
              )}

              {!loading && !selectedGroup && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-500">Select a category from the left</p>
                </div>
              )}
            </div>

            {/* Bottom Button */}
            {selectedGroup && isCustomGroup && currentSettings.length > 0 && (
              <div className="h-8 px-2 bg-gray-50 border-t border-gray-300 flex items-center">
                <button
                  onClick={() => {
                    if (selectedGroup) {
                      currentSettings.forEach(setting => {
                        handleDeleteCustomSetting(setting.id);
                      });
                    }
                  }}
                  className="text-xs text-gray-700 hover:text-red-600 font-normal"
                >
                  Seçilen Reçeteyi Sil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;
