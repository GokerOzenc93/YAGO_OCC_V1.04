import React, { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Edit2, Save } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { panelGeneratorService } from '../services/PanelGeneratorService';
import { PanelInstance } from '../types/Panel';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [panels, setPanels] = useState<PanelInstance[]>([]);
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProfile) {
      loadPanels();
    }
  }, [selectedProfile]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await globalSettingsService.listProfiles();
      setProfiles(data);
      if (data.length > 0 && !selectedProfile) {
        setSelectedProfile(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPanels = async () => {
    try {
      const panelData = await panelGeneratorService.getPanelsForProfile(selectedProfile);
      setPanels(panelData);
    } catch (error) {
      console.error('Failed to load panels:', error);
    }
  };

  const startEditingDescription = (panel: PanelInstance) => {
    setEditingDescriptionId(panel.id);
    setEditingDescriptionValue(panel.customDescription || panel.panelGeometry.description);
  };

  const saveDescription = async (panel: PanelInstance) => {
    try {
      await panelGeneratorService.updatePanelDescription(
        panel.panelGeometry.catalogId,
        editingDescriptionValue
      );

      setPanels(panels.map(p =>
        p.id === panel.id
          ? { ...p, customDescription: editingDescriptionValue }
          : p
      ));

      setEditingDescriptionId(null);
    } catch (error) {
      console.error('Failed to update description:', error);
    }
  };

  const groupedPanels = panelGeneratorService.groupPanelsByRole(panels);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '410px',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Panel Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-1 text-[10px] font-medium rounded transition-colors bg-stone-200 text-slate-700 hover:bg-stone-300"
            title="Add Panel"
          >
            ADD
          </button>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-stone-200 rounded transition-colors"
          >
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      </div>

      <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-800 whitespace-nowrap">
              Select Body Profile
            </label>
            {loading ? (
              <div className="flex-1 px-2 py-0.5 text-xs text-stone-400 bg-white border border-gray-300 rounded">
                Loading profiles...
              </div>
            ) : (
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded focus:outline-none focus:border-orange-500"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="border-t border-stone-200 pt-3 mt-3">
            {panels.length === 0 ? (
              <div className="text-center text-stone-500 text-xs py-8">
                No panels configured for this profile
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(groupedPanels.entries()).map(([role, rolePanels]) => (
                  <div key={role} className="space-y-2">
                    <div className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                      {role}
                    </div>
                    <div className="space-y-2">
                      {rolePanels.map((panel, index) => (
                        <div
                          key={panel.id}
                          className="bg-stone-50 border border-stone-200 rounded p-2 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[10px] text-stone-500 font-mono">
                                Face #{panel.panelGeometry.faceIndex}
                              </span>
                              <span className="text-xs text-stone-600">
                                {panel.panelGeometry.name}
                              </span>
                            </div>
                            <button
                              onClick={() => startEditingDescription(panel)}
                              className="p-1 hover:bg-stone-200 rounded transition-colors"
                              title="Edit Description"
                            >
                              <Edit2 size={12} className="text-stone-600" />
                            </button>
                          </div>

                          {editingDescriptionId === panel.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingDescriptionValue}
                                onChange={(e) => setEditingDescriptionValue(e.target.value)}
                                className="flex-1 px-1.5 py-0.5 text-xs bg-white border border-orange-400 rounded focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => saveDescription(panel)}
                                className="p-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                title="Save"
                              >
                                <Save size={12} />
                              </button>
                              <button
                                onClick={() => setEditingDescriptionId(null)}
                                className="p-1 bg-stone-200 rounded hover:bg-stone-300 transition-colors"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-stone-500 italic">
                              {panel.customDescription || panel.panelGeometry.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
