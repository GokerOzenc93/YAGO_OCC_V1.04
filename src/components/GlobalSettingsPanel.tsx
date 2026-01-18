import React, { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store';

interface GlobalSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingOption {
  id: string;
  label: string;
}

interface Profile {
  id: string;
  name: string;
  isEditing?: boolean;
}

const settingOptions: SettingOption[] = [
  { id: 'panel_joint', label: 'Panel Birleşim Tipleri' },
  { id: 'backrest', label: 'Arkalık Ayarları' }
];

export function GlobalSettingsPanel({ isOpen, onClose }: GlobalSettingsPanelProps) {
  const [position, setPosition] = useState({ x: 500, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([
    { id: 'default', name: 'Default' }
  ]);
  const [selectedProfile, setSelectedProfile] = useState<string>('default');
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);

  const panelJointSettings = useAppStore((state) => state.panelJointSettings);
  const setPanelJointSetting = useAppStore((state) => state.setPanelJointSetting);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleAddProfile = () => {
    const newProfile: Profile = {
      id: `profile-${Date.now()}`,
      name: `Default ${profiles.length + 1}`,
      isEditing: false
    };
    setProfiles([...profiles, newProfile]);
    setSelectedProfile(newProfile.id);
  };

  const handleProfileNameChange = (profileId: string, newName: string) => {
    setProfiles(profiles.map(p =>
      p.id === profileId ? { ...p, name: newName } : p
    ));
  };

  const handleStartEditing = (profileId: string) => {
    setProfiles(profiles.map(p =>
      p.id === profileId ? { ...p, isEditing: true } : { ...p, isEditing: false }
    ));
  };

  const handleStopEditing = (profileId: string) => {
    setProfiles(profiles.map(p =>
      p.id === profileId ? { ...p, isEditing: false } : p
    ));
  };

  const handleDeleteProfile = (profileId: string) => {
    if (profiles.length === 1) {
      return;
    }

    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(updatedProfiles);

    if (selectedProfile === profileId) {
      setSelectedProfile(updatedProfiles[0].id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '700px',
        height: '500px'
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Global Settings</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddProfile}
            className="p-0.5 hover:bg-stone-200 rounded transition-colors"
            title="Add Profile"
          >
            <Plus size={14} className="text-stone-600" />
          </button>
          <button
            onClick={() => handleDeleteProfile(selectedProfile)}
            className={`p-0.5 hover:bg-red-100 rounded transition-colors ${
              profiles.length === 1 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            title="Delete Selected Profile"
            disabled={profiles.length === 1}
          >
            <Trash2 size={14} className="text-red-600" />
          </button>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-stone-200 rounded transition-colors"
          >
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100%-44px)]">
        <div className="w-48 border-r border-stone-200 bg-white p-2 space-y-1">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => setSelectedProfile(profile.id)}
              onDoubleClick={() => handleStartEditing(profile.id)}
              onMouseEnter={() => setHoveredProfile(profile.id)}
              onMouseLeave={() => setHoveredProfile(null)}
              className={`relative text-xs px-2 py-0.5 bg-white border border-stone-200 rounded cursor-pointer transition-all ${
                selectedProfile === profile.id
                  ? 'text-slate-700 border-l-4 border-l-orange-500'
                  : hoveredProfile === profile.id
                  ? 'text-slate-700 border-l-4 border-l-orange-300'
                  : 'text-slate-700'
              }`}
            >
              {profile.isEditing ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleProfileNameChange(profile.id, e.target.value)}
                  onBlur={() => handleStopEditing(profile.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleStopEditing(profile.id);
                    }
                  }}
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-xs"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="select-none">{profile.name}</span>
              )}
            </div>
          ))}
        </div>

        <div className="w-48 border-r border-stone-200 bg-white p-2 space-y-1">
          {settingOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={`w-full text-xs text-left px-2 py-0.5 bg-white border border-stone-200 rounded transition-all ${
                selectedOption === option.id
                  ? 'text-slate-700 border-l-4 border-l-orange-500'
                  : 'text-slate-700 hover:border-l-4 hover:border-l-orange-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-4 overflow-y-auto">
          {selectedOption === 'panel_joint' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-orange-500 text-sm font-semibold mb-3">Üst Birleşim</h3>
                <div className="flex gap-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      onClick={() => setPanelJointSetting('topJoint', index)}
                      className={`relative cursor-pointer border-2 rounded-lg p-2 transition-all ${
                        panelJointSettings.topJoint === index
                          ? 'border-orange-500'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="absolute top-1 left-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          panelJointSettings.topJoint === index
                            ? 'border-orange-500 bg-white'
                            : 'border-stone-300 bg-white'
                        }`}>
                          {panelJointSettings.topJoint === index && (
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          )}
                        </div>
                      </div>
                      <div className="w-24 h-20 bg-stone-100 rounded flex items-start justify-start p-1">
                        <div className="relative">
                          <div className="w-8 h-12 bg-orange-300 border-r-4 border-orange-600"></div>
                          <div className="absolute top-0 left-8 w-16 h-8 bg-amber-100 border-l border-t border-stone-300"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-orange-500 text-sm font-semibold mb-3">Alt Birleşim</h3>
                <div className="flex gap-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      onClick={() => setPanelJointSetting('bottomJoint', index)}
                      className={`relative cursor-pointer border-2 rounded-lg p-2 transition-all ${
                        panelJointSettings.bottomJoint === index
                          ? 'border-orange-500'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="absolute top-1 left-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          panelJointSettings.bottomJoint === index
                            ? 'border-orange-500 bg-white'
                            : 'border-stone-300 bg-white'
                        }`}>
                          {panelJointSettings.bottomJoint === index && (
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          )}
                        </div>
                      </div>
                      <div className="w-24 h-20 bg-stone-100 rounded flex items-start justify-start p-1">
                        <div className="relative">
                          <div className="w-8 h-12 bg-orange-300 border-r-4 border-orange-600"></div>
                          <div className="absolute top-0 left-8 w-16 h-8 bg-amber-100 border-l border-t border-stone-300"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-orange-500 text-sm font-semibold mb-3">Pl. ayak</h3>
                <div className="flex gap-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      onClick={() => setPanelJointSetting('plinthFoot1', index)}
                      className={`relative cursor-pointer border-2 rounded-lg p-2 transition-all ${
                        panelJointSettings.plinthFoot1 === index
                          ? 'border-orange-500'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="absolute top-1 left-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          panelJointSettings.plinthFoot1 === index
                            ? 'border-orange-500 bg-white'
                            : 'border-stone-300 bg-white'
                        }`}>
                          {panelJointSettings.plinthFoot1 === index && (
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          )}
                        </div>
                      </div>
                      <div className="w-24 h-20 bg-stone-100 rounded flex items-start justify-start p-1">
                        <div className="relative">
                          <div className="w-8 h-12 bg-orange-300 border-r-4 border-orange-600"></div>
                          {index === 0 && (
                            <div className="absolute bottom-0 left-0 w-12 h-6 bg-amber-600 border-t-2 border-amber-800"></div>
                          )}
                          <div className="absolute top-0 left-8 w-16 h-8 bg-amber-100 border-l border-t border-stone-300"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-orange-500 text-sm font-semibold mb-3">Pl. ayak</h3>
                <div className="flex items-start gap-6">
                  <div
                    onClick={() => setPanelJointSetting('plinthFoot2', 0)}
                    className={`relative cursor-pointer border-2 rounded-lg p-2 transition-all ${
                      panelJointSettings.plinthFoot2 === 0
                        ? 'border-orange-500'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="absolute top-1 left-1">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        panelJointSettings.plinthFoot2 === 0
                          ? 'border-orange-500 bg-white'
                          : 'border-stone-300 bg-white'
                      }`}>
                        {panelJointSettings.plinthFoot2 === 0 && (
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        )}
                      </div>
                    </div>
                    <div className="w-24 h-20 bg-stone-100 rounded flex items-start justify-start p-1">
                      <div className="relative">
                        <div className="w-12 h-12 bg-orange-300 border-r-4 border-orange-600"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-6 bg-amber-600 border-t-2 border-amber-800"></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 block mb-2">Var</label>
                      <div className="flex gap-3">
                        <div
                          onClick={() => setPanelJointSetting('plinthFootEnabled', true)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            panelJointSettings.plinthFootEnabled
                              ? 'border-orange-500 bg-white'
                              : 'border-stone-300 bg-white'
                          }`}>
                            {panelJointSettings.plinthFootEnabled && (
                              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            )}
                          </div>
                          <span className="text-sm text-slate-700">Var</span>
                        </div>
                        <div
                          onClick={() => setPanelJointSetting('plinthFootEnabled', false)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            !panelJointSettings.plinthFootEnabled
                              ? 'border-orange-500 bg-white'
                              : 'border-stone-300 bg-white'
                          }`}>
                            {!panelJointSettings.plinthFootEnabled && (
                              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            )}
                          </div>
                          <span className="text-sm text-slate-700">Yok</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 block mb-2">Ayak Yüksekliği</label>
                      <div className="flex items-center gap-1 w-32">
                        <input
                          type="number"
                          value={panelJointSettings.plinthFootHeight}
                          onChange={(e) => setPanelJointSetting('plinthFootHeight', parseFloat(e.target.value) || 0)}
                          className="flex-1 px-2 py-1 text-sm border border-stone-300 rounded focus:outline-none focus:border-orange-500"
                        />
                        <div className="flex flex-col">
                          <button
                            onClick={() => setPanelJointSetting('plinthFootHeight', panelJointSettings.plinthFootHeight + 1)}
                            className="p-0.5 hover:bg-stone-100 rounded"
                          >
                            <ChevronUp size={12} className="text-stone-600" />
                          </button>
                          <button
                            onClick={() => setPanelJointSetting('plinthFootHeight', Math.max(0, panelJointSettings.plinthFootHeight - 1))}
                            className="p-0.5 hover:bg-stone-100 rounded"
                          >
                            <ChevronDown size={12} className="text-stone-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200">
                <button
                  onClick={() => {
                    console.log('Panel Birleşim Ayarları:', panelJointSettings);
                  }}
                  className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
                >
                  Ayarları Konsola Yazdır
                </button>
              </div>
            </div>
          )}

          {selectedOption === 'backrest' && (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              Arkalık Ayarları İçeriği
            </div>
          )}

          {!selectedOption && (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              Bir ayar seçin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
