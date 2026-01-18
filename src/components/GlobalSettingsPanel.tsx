import React, { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Trash2, Check } from 'lucide-react';
import { useAppStore, JoinType } from '../store';

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
  const { joinType, setJoinType } = useAppStore();
  const [position, setPosition] = useState({ x: 500, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([
    { id: 'default', name: 'Default' }
  ]);
  const [selectedProfile, setSelectedProfile] = useState<string>('default');
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);

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
          {selectedOption ? (
            <>
              {selectedOption === 'panel_joint' && (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-slate-800 mb-4">
                    Panel Birleşim Tipini Seçin
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div
                      onClick={() => setJoinType(JoinType.WITH_LEGS)}
                      className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all hover:shadow-lg ${
                        joinType === JoinType.WITH_LEGS
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-stone-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      {joinType === JoinType.WITH_LEGS && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white rounded-full p-1">
                          <Check size={14} />
                        </div>
                      )}
                      <div className="aspect-square bg-stone-100 rounded mb-3 flex items-end justify-center p-4">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <rect x="20" y="20" width="60" height="50" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
                          <line x1="25" y1="70" x2="25" y2="95" stroke="#475569" strokeWidth="3" />
                          <line x1="75" y1="70" x2="75" y2="95" stroke="#475569" strokeWidth="3" />
                          <circle cx="25" cy="95" r="3" fill="#334155" />
                          <circle cx="75" cy="95" r="3" fill="#334155" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-slate-700">Ayaklı</div>
                        <div className="text-xs text-slate-500 mt-1">Ayaklar ile</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setJoinType(JoinType.WITHOUT_LEGS)}
                      className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all hover:shadow-lg ${
                        joinType === JoinType.WITHOUT_LEGS
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-stone-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      {joinType === JoinType.WITHOUT_LEGS && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white rounded-full p-1">
                          <Check size={14} />
                        </div>
                      )}
                      <div className="aspect-square bg-stone-100 rounded mb-3 flex items-end justify-center p-4">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <rect x="20" y="30" width="60" height="65" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
                          <line x1="20" y1="95" x2="80" y2="95" stroke="#334155" strokeWidth="4" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-slate-700">Ayaksız</div>
                        <div className="text-xs text-slate-500 mt-1">Direkt zemin</div>
                      </div>
                    </div>

                    <div
                      onClick={() => setJoinType(JoinType.WITH_BASE)}
                      className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all hover:shadow-lg ${
                        joinType === JoinType.WITH_BASE
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-stone-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      {joinType === JoinType.WITH_BASE && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white rounded-full p-1">
                          <Check size={14} />
                        </div>
                      )}
                      <div className="aspect-square bg-stone-100 rounded mb-3 flex items-end justify-center p-4">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <rect x="20" y="20" width="60" height="50" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
                          <rect x="15" y="70" width="70" height="15" fill="#64748b" stroke="#475569" strokeWidth="2" />
                          <line x1="15" y1="85" x2="85" y2="85" stroke="#334155" strokeWidth="4" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-slate-700">Bazalı</div>
                        <div className="text-xs text-slate-500 mt-1">Kaide ile</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-stone-200">
                    <div className="text-sm font-semibold text-slate-800 mb-3">
                      Önizleme
                    </div>
                    <div className="bg-stone-50 rounded-lg p-6 flex items-center justify-center">
                      <div className="transform scale-75">
                        {joinType === JoinType.WITH_LEGS && (
                          <svg viewBox="0 0 200 300" className="w-48 h-64">
                            <rect x="40" y="40" width="120" height="160" fill="#94a3b8" stroke="#475569" strokeWidth="3" />
                            <rect x="50" y="55" width="100" height="130" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
                            <line x1="50" y1="200" x2="50" y2="280" stroke="#475569" strokeWidth="6" />
                            <line x1="150" y1="200" x2="150" y2="280" stroke="#475569" strokeWidth="6" />
                            <circle cx="50" cy="280" r="8" fill="#334155" />
                            <circle cx="150" cy="280" r="8" fill="#334155" />
                            <rect x="80" y="100" width="40" height="60" fill="#64748b" stroke="#475569" strokeWidth="2" />
                            <circle cx="115" cy="130" r="4" fill="#334155" />
                          </svg>
                        )}
                        {joinType === JoinType.WITHOUT_LEGS && (
                          <svg viewBox="0 0 200 300" className="w-48 h-64">
                            <rect x="40" y="60" width="120" height="220" fill="#94a3b8" stroke="#475569" strokeWidth="3" />
                            <rect x="50" y="75" width="100" height="190" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
                            <line x1="40" y1="280" x2="160" y2="280" stroke="#334155" strokeWidth="8" />
                            <rect x="80" y="120" width="40" height="80" fill="#64748b" stroke="#475569" strokeWidth="2" />
                            <circle cx="115" cy="160" r="4" fill="#334155" />
                          </svg>
                        )}
                        {joinType === JoinType.WITH_BASE && (
                          <svg viewBox="0 0 200 300" className="w-48 h-64">
                            <rect x="40" y="40" width="120" height="160" fill="#94a3b8" stroke="#475569" strokeWidth="3" />
                            <rect x="50" y="55" width="100" height="130" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
                            <rect x="30" y="200" width="140" height="40" fill="#64748b" stroke="#475569" strokeWidth="3" />
                            <line x1="30" y1="240" x2="170" y2="240" stroke="#334155" strokeWidth="8" />
                            <rect x="80" y="90" width="40" height="60" fill="#64748b" stroke="#475569" strokeWidth="2" />
                            <circle cx="115" cy="120" r="4" fill="#334155" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {selectedOption === 'backrest' && (
                <div className="flex items-center justify-center h-full text-stone-400 text-sm">
                  Arkalık Ayarları İçeriği
                </div>
              )}
            </>
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
