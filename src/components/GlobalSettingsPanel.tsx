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
        <div className="w-32 border-r border-stone-200 bg-white p-2 space-y-1">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => setSelectedProfile(profile.id)}
              onDoubleClick={() => handleStartEditing(profile.id)}
              onMouseEnter={() => setHoveredProfile(profile.id)}
              onMouseLeave={() => setHoveredProfile(null)}
              className={`text-xs font-medium px-2 py-1.5 border rounded cursor-pointer transition-colors ${
                selectedProfile === profile.id
                  ? 'text-slate-800 bg-stone-50 border-stone-300'
                  : hoveredProfile === profile.id
                  ? 'text-orange-800 bg-orange-50 border-orange-300'
                  : 'text-slate-700 bg-white border-stone-200 hover:bg-stone-50'
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
                  className="w-full bg-transparent border-none outline-none text-xs font-medium"
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
              className={`w-full text-xs font-medium text-left px-2 py-1.5 rounded transition-colors ${
                selectedOption === option.id
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-white text-slate-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-4">
          {selectedOption ? (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              {selectedOption === 'panel_joint' && 'Panel Birleşim Tipleri İçeriği'}
              {selectedOption === 'backrest' && 'Arkalık Ayarları İçeriği'}
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
