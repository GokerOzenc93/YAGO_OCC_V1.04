import React, { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Trash2 } from 'lucide-react';

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
  const [altPanelType, setAltPanelType] = useState<string>('bazalı');

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

        <div className="flex-1 bg-white p-4">
          {selectedOption === 'panel_joint' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 pb-2 border-b border-stone-200">
                Panel Birleşim Ayarları
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-700 w-32 px-2">
                  Alt Panel
                </label>
                <select
                  value={altPanelType}
                  onChange={(e) => setAltPanelType(e.target.value)}
                  className="flex-1 text-xs px-2 py-0.5 bg-white border border-stone-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="bazalı">Bazalı</option>
                  <option value="alt arada">Alt Arada</option>
                  <option value="yanlar arada">Yanlar Arada</option>
                  <option value="ayaklı">Ayaklı</option>
                </select>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-200">
                <p className="text-xs text-slate-600 mb-3">Ön Görünüm</p>
                <div className="flex justify-center">
                  <svg width="200" height="240" viewBox="0 0 200 240" className="border border-stone-300 bg-stone-50 rounded">
                    {altPanelType === 'bazalı' && (
                      <>
                        <rect x="40" y="20" width="120" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="40" y="35" width="8" height="170" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="152" y="35" width="8" height="170" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="30" y="205" width="140" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <line x1="48" y1="35" x2="48" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                        <line x1="152" y1="35" x2="152" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                      </>
                    )}

                    {altPanelType === 'alt arada' && (
                      <>
                        <rect x="40" y="20" width="120" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="40" y="35" width="8" height="185" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="152" y="35" width="8" height="185" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="48" y="205" width="104" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <line x1="48" y1="35" x2="48" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                        <line x1="152" y1="35" x2="152" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                      </>
                    )}

                    {altPanelType === 'yanlar arada' && (
                      <>
                        <rect x="40" y="20" width="120" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="30" y="205" width="140" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="40" y="50" width="8" height="155" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="152" y="50" width="8" height="155" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <line x1="48" y1="50" x2="48" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                        <line x1="152" y1="50" x2="152" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                      </>
                    )}

                    {altPanelType === 'ayaklı' && (
                      <>
                        <rect x="40" y="20" width="120" height="15" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="40" y="35" width="8" height="170" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="152" y="35" width="8" height="170" fill="#A0826D" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="48" y="205" width="104" height="8" fill="#8B7355" stroke="#6B5345" strokeWidth="1.5" />
                        <rect x="55" y="213" width="8" height="20" fill="#6B5345" stroke="#4A3A2A" strokeWidth="1.5" />
                        <rect x="96" y="213" width="8" height="20" fill="#6B5345" stroke="#4A3A2A" strokeWidth="1.5" />
                        <rect x="137" y="213" width="8" height="20" fill="#6B5345" stroke="#4A3A2A" strokeWidth="1.5" />
                        <line x1="48" y1="35" x2="48" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                        <line x1="152" y1="35" x2="152" y2="205" stroke="#6B5345" strokeWidth="0.5" opacity="0.3" />
                      </>
                    )}

                    <rect x="48" y="35" width="104" height="170" fill="none" stroke="#D4A574" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
                  </svg>
                </div>
                <p className="text-xs text-slate-500 text-center mt-3">
                  {altPanelType === 'bazalı' && 'Alt panel yan panellerin altında'}
                  {altPanelType === 'alt arada' && 'Alt panel yan paneller arasında'}
                  {altPanelType === 'yanlar arada' && 'Yan paneller alt panelin üzerinde'}
                  {altPanelType === 'ayaklı' && 'Alt panelde ayaklar mevcut'}
                </p>
              </div>
            </div>
          ) : selectedOption === 'backrest' ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 pb-2 border-b border-stone-200">
                Arkalık Ayarları
              </h3>
              <div className="flex items-center justify-center h-full text-stone-400 text-sm">
                İçerik yakında eklenecek
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              Bir ayar seçin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
