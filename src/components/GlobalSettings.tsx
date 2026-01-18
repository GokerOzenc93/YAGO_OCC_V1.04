import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronRight } from 'lucide-react';
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

interface GlobalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ isOpen, onClose }) => {
  const [customGroups, setCustomGroups] = useState<CustomSettingsGroup[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
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
      const [groupsRes, settingsRes] = await Promise.all([
        supabase
          .from('custom_settings_groups')
          .select('*')
          .order('order', { ascending: true }),
        supabase
          .from('system_settings')
          .select('*')
          .order('category', { ascending: true })
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

  const handleSaveSetting = async (setting: SystemSetting) => {
    const newValue = editingValues[setting.id];
    if (newValue === setting.value) return;

    try {
      await supabase
        .from('system_settings')
        .update({ value: newValue, updated_at: new Date().toISOString() })
        .eq('id', setting.id);

      setSystemSettings(systemSettings.map(s =>
        s.id === setting.id ? { ...s, value: newValue } : s
      ));
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  };

  const groupedSettings = systemSettings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const categories = Object.keys(groupedSettings).sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 max-w-4xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between h-14 px-6 border-b border-stone-200">
          <h1 className="text-lg font-semibold text-slate-800">Global Settings</h1>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-56 border-r border-stone-200 bg-stone-50 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2">
                <h3 className="text-xs font-semibold text-stone-600 px-2 mb-3">SİSTEM AYARLARI</h3>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedGroup(category)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                      selectedGroup === category
                        ? 'bg-orange-100 text-orange-900 font-medium'
                        : 'text-slate-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="truncate">{category}</span>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-200 p-3 bg-white space-y-2">
              <h3 className="text-xs font-semibold text-stone-600 px-2 mb-2">ÖZEL AYARLAR</h3>
              {customGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                    selectedGroup === group.id
                      ? 'bg-blue-100 text-blue-900 font-medium'
                      : 'text-slate-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="truncate">{group.name}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteGroup(group.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </button>
              ))}

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Yeni grup adı..."
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddGroup()}
                  className="flex-1 px-2 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={handleAddGroup}
                  disabled={!newGroupName.trim()}
                  className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-stone-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-stone-600">Yükleniyor...</p>
                </div>
              </div>
            ) : selectedGroup && groupedSettings[selectedGroup] ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 mb-4">{selectedGroup}</h2>
                  <div className="space-y-3">
                    {groupedSettings[selectedGroup].map(setting => (
                      <div key={setting.id} className="flex items-end gap-3 pb-3 border-b border-stone-100">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {setting.name}
                          </label>
                          {setting.type === 'number' ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={editingValues[setting.id] || ''}
                                onChange={e => handleSettingChange(setting.id, e.target.value)}
                                min={setting.min_value || undefined}
                                max={setting.max_value || undefined}
                                className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 text-sm"
                              />
                              {setting.unit && (
                                <span className="px-3 py-2 bg-stone-100 rounded-lg text-sm text-stone-600">
                                  {setting.unit}
                                </span>
                              )}
                            </div>
                          ) : setting.type === 'select' ? (
                            <select
                              value={editingValues[setting.id] || ''}
                              onChange={e => handleSettingChange(setting.id, e.target.value)}
                              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 text-sm"
                            >
                              <option value="">Seçin...</option>
                              <option value={editingValues[setting.id] || setting.value}>
                                {editingValues[setting.id] || setting.value}
                              </option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={editingValues[setting.id] || ''}
                              onChange={e => handleSettingChange(setting.id, e.target.value)}
                              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 text-sm"
                            />
                          )}
                        </div>
                        <button
                          onClick={() => handleSaveSetting(setting)}
                          disabled={editingValues[setting.id] === setting.value}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          Kaydet
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-stone-600 text-center">
                  {selectedGroup ? 'Bu grupta ayar bulunmamaktadır.' : 'Soldan bir kategori seçiniz.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;
