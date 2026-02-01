import React, { useState, useEffect } from 'react';
import { X, GripVertical, RefreshCw, Box, Trash2 } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { panelManagerService, PanelJointConfig, BackPanelConfig } from './PanelManager';
import { useAppStore, GeneratedPanel } from '../store';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [panelJointConfig, setPanelJointConfig] = useState<PanelJointConfig | null>(null);
  const [backPanelConfig, setBackPanelConfig] = useState<BackPanelConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    shapes,
    selectedShapeId,
    generatedPanels,
    setGeneratedPanels,
    selectedPanelId,
    setSelectedPanelId,
    clearGeneratedPanels
  } = useAppStore();

  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProfile !== 'none' && selectedShape) {
      loadProfileAndGeneratePanels();
    } else if (selectedProfile === 'none') {
      clearGeneratedPanels();
      setPanelJointConfig(null);
      setBackPanelConfig(null);
      setError(null);
    }
  }, [selectedProfile, selectedShapeId]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await globalSettingsService.listProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileAndGeneratePanels = async () => {
    if (selectedProfile === 'none') return;

    setLoadingPanels(true);
    setError(null);

    try {
      const success = await panelManagerService.loadProfileSettings(selectedProfile);
      if (!success) {
        setError('Failed to load profile settings');
        return;
      }

      setPanelJointConfig(panelManagerService.getPanelJointConfig());
      setBackPanelConfig(panelManagerService.getBackPanelConfig());

      if (selectedShape) {
        if (!selectedShape.faceRoles || Object.keys(selectedShape.faceRoles).length === 0) {
          setError('Assign face roles (Left, Right, Top, Bottom, Back) to the selected geometry first');
          setGeneratedPanels([]);
          return;
        }

        const panels = panelManagerService.generatePanelsFromFaceRoles(selectedShape);
        setGeneratedPanels(panels);

        if (panels.length === 0) {
          setError('No panels generated. Check face roles.');
        }
      } else {
        setError('Select a geometry to generate panels');
        setGeneratedPanels([]);
      }
    } catch (err) {
      console.error('Failed to generate panels:', err);
      setError('Failed to generate panels');
    } finally {
      setLoadingPanels(false);
    }
  };

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

  const getBodyTypeLabel = (type: string) => {
    switch (type) {
      case 'ayakli': return 'With Legs';
      case 'ayaksiz': return 'Without Legs';
      case 'bazali': return 'With Base';
      default: return type;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'left': return 'Left Panel';
      case 'right': return 'Right Panel';
      case 'top': return 'Top Panel';
      case 'bottom': return 'Bottom Panel';
      case 'back': return 'Back Panel';
      case 'base-front': return 'Base Front';
      case 'base-back': return 'Base Back';
      default: return role;
    }
  };

  const handlePanelClick = (panelId: string) => {
    setSelectedPanelId(selectedPanelId === panelId ? null : panelId);
  };

  const handleClearPanels = () => {
    clearGeneratedPanels();
    setSelectedProfile('none');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '380px',
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
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-stone-200 rounded transition-colors"
        >
          <X size={14} className="text-stone-600" />
        </button>
      </div>

      <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                Body Profile
              </label>
              {loading ? (
                <div className="px-2 py-0.5 text-xs text-stone-400 bg-white border border-gray-300 rounded flex-1">
                  Loading...
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1">
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded focus:outline-none focus:border-orange-500"
                  >
                    <option value="none">None</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  {selectedProfile !== 'none' && (
                    <button
                      onClick={loadProfileAndGeneratePanels}
                      disabled={loadingPanels}
                      className="p-1 hover:bg-stone-100 rounded transition-colors"
                      title="Refresh panels"
                    >
                      <RefreshCw size={12} className={`text-stone-500 ${loadingPanels ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedProfile === 'none' ? (
            <div className="text-center text-stone-500 text-xs py-6 border-t border-stone-200">
              Select a body profile to generate panels
            </div>
          ) : loadingPanels ? (
            <div className="text-center text-stone-500 text-xs py-6 border-t border-stone-200">
              Generating panels...
            </div>
          ) : error ? (
            <div className="text-center text-amber-600 text-xs py-4 border-t border-stone-200">
              {error}
            </div>
          ) : (
            <>
              {panelJointConfig && (
                <div className="border-t border-stone-200 pt-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Joint Settings</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium text-slate-800">{getBodyTypeLabel(panelJointConfig.selectedBodyType)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Top In-Between:</span>
                      <span className="font-medium text-slate-800">
                        {panelJointConfig.topLeftExpanded ? 'L' : '-'}/{panelJointConfig.topRightExpanded ? 'R' : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bottom In-Between:</span>
                      <span className="font-medium text-slate-800">
                        {panelJointConfig.bottomLeftExpanded ? 'L' : '-'}/{panelJointConfig.bottomRightExpanded ? 'R' : '-'}
                      </span>
                    </div>
                    {panelJointConfig.selectedBodyType === 'bazali' && (
                      <div className="flex justify-between">
                        <span>Base Height:</span>
                        <span className="font-medium text-slate-800">{panelJointConfig.bazaHeight}mm</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {backPanelConfig && (
                <div className="border-t border-stone-200 pt-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Back Panel</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Thickness:</span>
                      <span className="font-medium text-slate-800">{backPanelConfig.backPanelThickness}mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Groove:</span>
                      <span className="font-medium text-slate-800">{backPanelConfig.grooveOffset}/{backPanelConfig.grooveDepth}mm</span>
                    </div>
                  </div>
                </div>
              )}

              {generatedPanels.length > 0 && (
                <div className="border-t border-stone-200 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Box size={12} />
                      Panels ({generatedPanels.length})
                    </div>
                    <button
                      onClick={handleClearPanels}
                      className="p-1 hover:bg-red-50 rounded transition-colors"
                      title="Clear all panels"
                    >
                      <Trash2 size={12} className="text-red-400 hover:text-red-500" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {generatedPanels.map((panel) => {
                      const isSelected = selectedPanelId === panel.id;
                      return (
                        <div
                          key={panel.id}
                          onClick={() => handlePanelClick(panel.id)}
                          className={`flex items-center justify-between text-xs px-2 py-1.5 rounded cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-red-100 border border-red-300'
                              : 'bg-stone-50 hover:bg-stone-100 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded border"
                              style={{
                                backgroundColor: isSelected ? '#ef4444' : panel.color,
                                borderColor: isSelected ? '#dc2626' : '#a8a29e'
                              }}
                            />
                            <span className={`font-medium ${isSelected ? 'text-red-700' : 'text-slate-700'}`}>
                              {getRoleLabel(panel.role)}
                            </span>
                          </div>
                          <span className={isSelected ? 'text-red-600' : 'text-stone-500'}>
                            {panel.dimensions[0].toFixed(0)} x {panel.dimensions[1].toFixed(0)} x {panel.dimensions[2].toFixed(0)} mm
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
