import React, { useState } from 'react';
import { X, GripVertical, Plus, Check, Trash2 } from 'lucide-react';
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

  const [position, setPosition] = useState({ x: 150, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [newSettingName, setNewSettingName] = useState('');
  const [showNewSettingInput, setShowNewSettingInput] = useState(false);

  const selectedSetting = getSelectedSetting();
  const defaultSetting = getDefaultSetting();

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCreateNewSetting = () => {
    if (!newSettingName.trim()) return;

    const newSetting: GlobalSetting = {
      id: `setting-${Date.now()}`,
      name: newSettingName,
      isDefault: false,
      panelJoinType: 'Dowel',
      settings: {
        backPanelType: 'Solid',
        adjustableShelves: false,
        edgeBanding: 'PVC',
        shelfThickness: 18
      },
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
    <div
      className="fixed inset-0 z-40"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setShowGlobalSettings(false)}
      />

      {/* Modal Window */}
      <div
        className="absolute bg-white rounded-lg shadow-2xl flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '1000px',
          height: '600px',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between p-3 border-b border-gray-300 bg-gradient-to-r from-stone-50 to-stone-100 cursor-grab active:cursor-grabbing rounded-t-lg"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-gray-500" />
            <h2 className="text-sm font-bold text-gray-800">Global Parameters</h2>
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setShowGlobalSettings(false)}
            className="p-1 hover:bg-stone-200 rounded transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Settings List */}
          <div className="w-72 border-r border-gray-300 bg-stone-50 flex flex-col overflow-hidden">
            {/* Default Section */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                <div className="text-xs font-bold text-gray-700 px-2 py-1.5 bg-stone-200 rounded">
                  DEFAULT
                </div>
                {globalSettings.filter(s => s.isDefault).map((setting) => (
                  <button
                    key={setting.id}
                    onClick={() => selectGlobalSetting(setting.id)}
                    className={`w-full text-left p-2 rounded text-xs font-semibold transition-all border ${
                      selectedSettingId === setting.id
                        ? 'bg-white border-blue-400 shadow-sm text-gray-900'
                        : 'bg-stone-100 border-gray-300 text-gray-700 hover:bg-stone-200'
                    }`}
                  >
                    {setting.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets Section */}
            <div className="flex-1 overflow-y-auto border-t border-gray-300">
              <div className="p-2 space-y-1">
                <div className="text-xs font-bold text-gray-700 px-2 py-1.5 bg-stone-200 rounded">
                  PRESETS
                </div>

                {globalSettings.filter(s => !s.isDefault).map((setting) => (
                  <button
                    key={setting.id}
                    onClick={() => selectGlobalSetting(setting.id)}
                    className={`w-full text-left p-2 rounded text-xs transition-all border group ${
                      selectedSettingId === setting.id
                        ? 'bg-white border-blue-400 shadow-sm text-gray-900'
                        : 'bg-stone-100 border-gray-300 text-gray-700 hover:bg-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold truncate">{setting.name}</span>
                      {selectedSettingId === setting.id && (
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteGlobalSetting(setting.id);
                          }}
                          className="p-0.5 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} className="text-red-600" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {setting.panelJoinType}
                    </div>
                  </button>
                ))}

                {showNewSettingInput ? (
                  <div className="p-1.5 space-y-1 bg-white rounded border border-blue-400 shadow-sm">
                    <input
                      type="text"
                      placeholder="Name"
                      value={newSettingName}
                      onChange={(e) => setNewSettingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateNewSetting();
                        if (e.key === 'Escape') setShowNewSettingInput(false);
                      }}
                      autoFocus
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"
                    />
                    <div className="flex gap-1">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={handleCreateNewSetting}
                        className="flex-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-0.5 font-semibold"
                      >
                        <Check size={11} />
                        Create
                      </button>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setShowNewSettingInput(false)}
                        className="flex-1 px-1.5 py-0.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setShowNewSettingInput(true)}
                    className="w-full p-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1 font-semibold border border-dashed border-blue-300"
                  >
                    <Plus size={12} />
                    New Preset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Settings Details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {selectedSetting ? (
              <>
                {/* Panel Join Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 bg-stone-100 px-2 py-1 rounded">
                    Panel Join Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {panelJoinTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => handlePanelJoinTypeChange(type)}
                        className={`px-2 py-1.5 rounded text-xs font-semibold transition-all border ${
                          selectedSetting.panelJoinType === type
                            ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                            : 'bg-stone-100 text-gray-700 border-gray-300 hover:bg-stone-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-4">
                  <label className="block text-xs font-bold text-gray-700 mb-3 bg-stone-100 px-2 py-1 rounded">
                    Settings Details
                  </label>

                  <div className="space-y-3">
                    {/* Back Panel Type */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Back Panel
                      </label>
                      <select
                        value={selectedSetting.settings.backPanelType || 'Solid'}
                        onChange={(e) => handleSettingValueChange('backPanelType', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:border-blue-400 font-mono"
                      >
                        <option>Solid</option>
                        <option>Veneer</option>
                        <option>Mesh</option>
                        <option>None</option>
                      </select>
                    </div>

                    {/* Adjustable Shelves */}
                    <div className="flex items-center gap-2.5 p-2 bg-stone-50 rounded border border-gray-300">
                      <input
                        type="checkbox"
                        id="adjustableShelves"
                        checked={selectedSetting.settings.adjustableShelves || false}
                        onChange={(e) => handleSettingValueChange('adjustableShelves', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-400 cursor-pointer"
                      />
                      <label
                        htmlFor="adjustableShelves"
                        className="text-xs font-semibold text-gray-700 cursor-pointer flex-1"
                      >
                        Adjustable Shelves
                      </label>
                    </div>

                    {/* Edge Banding */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Edge Banding
                      </label>
                      <select
                        value={selectedSetting.settings.edgeBanding || 'PVC'}
                        onChange={(e) => handleSettingValueChange('edgeBanding', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:border-blue-400 font-mono"
                      >
                        <option>PVC</option>
                        <option>ABS</option>
                        <option>Wood Veneer</option>
                        <option>None</option>
                      </select>
                    </div>

                    {/* Shelf Thickness */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Shelf Thickness (mm)
                      </label>
                      <input
                        type="number"
                        value={selectedSetting.settings.shelfThickness || 18}
                        onChange={(e) => handleSettingValueChange('shelfThickness', parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:border-blue-400 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
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
