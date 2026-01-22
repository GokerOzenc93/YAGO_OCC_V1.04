import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { panelJointTypesService, PanelJointType } from '../PanelJointTypesDatabase';

interface SaveAsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  onLoad: (settings: PanelJointType['settings']) => void;
}

export function SaveAsDialog({ isOpen, onClose, onSave, onLoad }: SaveAsDialogProps) {
  const [profiles, setProfiles] = useState<PanelJointType[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('new');
  const [newProfileName, setNewProfileName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await panelJointTypesService.list();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = async (profileId: string) => {
    setSelectedProfileId(profileId);

    if (profileId !== 'new') {
      try {
        const profile = await panelJointTypesService.get(profileId);
        if (profile && profile.settings) {
          onLoad(profile.settings);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    }
  };

  const handleSave = () => {
    if (selectedProfileId === 'new') {
      if (newProfileName.trim()) {
        onSave(newProfileName.trim());
        onClose();
      }
    } else {
      const selectedProfile = profiles.find(p => p.id === selectedProfileId);
      if (selectedProfile) {
        onSave(selectedProfile.name);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h3 className="text-sm font-semibold text-slate-800">Save Panel Joint Type</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 rounded transition-colors"
          >
            <X size={16} className="text-stone-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-stone-500">Loading profiles...</div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Select Profile
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => handleProfileSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-orange-500"
                >
                  <option value="new">Create New Profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProfileId === 'new' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Enter profile name"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-stone-200">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-white text-stone-700 border border-stone-300 rounded hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selectedProfileId === 'new' && !newProfileName.trim()}
            className="flex-1 px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
