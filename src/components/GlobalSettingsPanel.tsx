import React, { useState } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import { useAppStore } from '../store';
import type { GlobalSetting, PanelJoinType } from '../store';

const panelJoinTypes: PanelJoinType[] = ['Dowel', 'Pocket', 'Slot', 'Butt', 'Mortise', 'Dovetail'];

const GlobalSettingsPanel: React.FC = () => {
  const {
    showGlobalSettings,
    setShowGlobalSettings,
    globalSettings,
    selectedSettingId,
    selectGlobalSetting,
    addGlobalSetting,
    updateGlobalSetting,
    deleteGlobalSetting,
    getSelectedSetting,
    getDefaultSetting
  } = useAppStore();

  const [newSettingName, setNewSettingName] = useState('');
  const [showNewSettingInput, setShowNewSettingInput] = useState(false);
  const selectedSetting = getSelectedSetting();
  const defaultSetting = getDefaultSetting();

  const handleCreateNewSetting = () => {
    if (!newSettingName.trim()) return;

    const newSetting: GlobalSetting = {
      id: `setting-${Date.now()}`,
      name: newSettingName,
      isDefault: false,
      panelJoinType: 'Dowel',
      settings: {},
      createdAt: new Date()
    };

    addGlobalSetting(newSetting);
    selectGlobalSetting(newSetting.id);
    setNewSettingName('');
    setShowNewSettingInput(false);
  };

  const handlePanelJoinTypeChange = (type: PanelJoinType) => {
    if (!selectedSetting) return;
    updateGlobalSetting(selectedSetting.id, { panelJoinType: type });
  };

  const handleSettingValueChange = (key: string, value: any) => {
    if (!selectedSetting) return;
    updateGlobalSetting(selectedSetting.id, {
      settings: {
        ...selectedSetting.settings,
        [key]: value
      }
    });
  };

  if (!showGlobalSettings) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">Global Settings</h2>
          <button
            onClick={() => setShowGlobalSettings(false)}
            className="p-1 hover:bg-stone-100 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Settings List */}
          <div className="w-64 border-r border-stone-200 overflow-y-auto bg-stone-50">
            <div className="p-3 space-y-2">
              <div className="text-xs font-semibold text-stone-600 px-2">PRESETS</div>

              {globalSettings.map((setting) => (
                <div
                  key={setting.id}
                  onClick={() => selectGlobalSetting(setting.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    selectedSettingId === setting.id
                      ? 'bg-white border-blue-300 shadow-sm'
                      : 'bg-stone-100 border-transparent hover:bg-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-stone-700 truncate">
                        {setting.name}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {setting.panelJoinType}
                      </div>
                    </div>
                    {setting.isDefault && (
                      <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium flex-shrink-0">
                        Default
                      </div>
                    )}
                  </div>
                  {selectedSettingId === setting.id && !setting.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGlobalSetting(setting.id);
                      }}
                      className="w-full mt-2 p-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-1 justify-center"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              ))}

              {showNewSettingInput ? (
                <div className="p-2 space-y-2 bg-white rounded-lg border border-stone-300">
                  <input
                    type="text"
                    placeholder="Setting name..."
                    value={newSettingName}
                    onChange={(e) => setNewSettingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNewSetting();
                      if (e.key === 'Escape') setShowNewSettingInput(false);
                    }}
                    autoFocus
                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-blue-400"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleCreateNewSetting}
                      className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                    >
                      <Check size={12} />
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewSettingInput(false)}
                      className="flex-1 px-2 py-1 text-xs bg-stone-300 text-stone-700 rounded hover:bg-stone-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewSettingInput(true)}
                  className="w-full p-2 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1 font-medium"
                >
                  <Plus size={12} />
                  New Preset
                </button>
              )}
            </div>
          </div>

          {/* Right Panel - Settings Details */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedSetting ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-3">
                    Panel Join Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {panelJoinTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => handlePanelJoinTypeChange(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedSetting.panelJoinType === type
                            ? 'bg-blue-500 text-white'
                            : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-6">
                  <h3 className="text-sm font-semibold text-stone-700 mb-3">Settings</h3>

                  <div className="space-y-4">
                    {/* Back Panel Type */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-2">
                        Back Panel Settings
                      </label>
                      <select
                        value={selectedSetting.settings.backPanelType || 'Solid'}
                        onChange={(e) => handleSettingValueChange('backPanelType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
                      >
                        <option>Solid</option>
                        <option>Veneer</option>
                        <option>Mesh</option>
                        <option>None</option>
                      </select>
                    </div>

                    {/* Adjustable Shelves */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="adjustableShelves"
                        checked={selectedSetting.settings.adjustableShelves || false}
                        onChange={(e) => handleSettingValueChange('adjustableShelves', e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 cursor-pointer"
                      />
                      <label htmlFor="adjustableShelves" className="text-sm font-medium text-stone-700 cursor-pointer">
                        Adjustable Shelves
                      </label>
                    </div>

                    {/* Edge Banding */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-2">
                        Edge Banding
                      </label>
                      <select
                        value={selectedSetting.settings.edgeBanding || 'PVC'}
                        onChange={(e) => handleSettingValueChange('edgeBanding', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
                      >
                        <option>PVC</option>
                        <option>ABS</option>
                        <option>Wood Veneer</option>
                        <option>None</option>
                      </select>
                    </div>

                    {/* Shelf Thickness */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-2">
                        Shelf Thickness (mm)
                      </label>
                      <input
                        type="number"
                        value={selectedSetting.settings.shelfThickness || 18}
                        onChange={(e) => handleSettingValueChange('shelfThickness', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-stone-500">
                Select a preset to view settings
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettingsPanel;
