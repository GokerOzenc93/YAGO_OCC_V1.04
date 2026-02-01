import React, { useState, useEffect } from 'react';
import { X, GripVertical, RefreshCw, Box } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { panelManagerService, GeneratedPanels, PanelJointConfig, BackPanelConfig } from './PanelManager';
import { useAppStore } from '../store';

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
  const [generatedPanels, setGeneratedPanels] = useState<GeneratedPanels | null>(null);
  const [panelJointConfig, setPanelJointConfig] = useState<PanelJointConfig | null>(null);
  const [backPanelConfig, setBackPanelConfig] = useState<BackPanelConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { shapes, selectedShapeId } = useAppStore();
  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProfile !== 'none') {
      loadProfileAndGeneratePanels();
    } else {
      setGeneratedPanels(null);
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
        const panels = panelManagerService.generatePanels(selectedShape);
        setGeneratedPanels(panels);

        if (!panels) {
          setError('No geometry selected or geometry has no face roles defined');
        }
      } else {
        setError('Select a geometry to generate panels');
        setGeneratedPanels(null);
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
                Select Body Profile
              </label>
              {loading ? (
                <div className="px-2 py-0.5 text-xs text-stone-400 bg-white border border-gray-300 rounded flex-1">
                  Loading profiles...
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
            <div className="text-center text-stone-500 text-xs py-8 border-t border-stone-200">
              Select a body profile to configure panels
            </div>
          ) : loadingPanels ? (
            <div className="text-center text-stone-500 text-xs py-8 border-t border-stone-200">
              Loading configuration...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 text-xs py-4 border-t border-stone-200">
              {error}
            </div>
          ) : (
            <>
              {panelJointConfig && (
                <div className="border-t border-stone-200 pt-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Panel Joint Settings</div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Body Type:</span>
                      <span className="font-medium text-slate-800">{getBodyTypeLabel(panelJointConfig.selectedBodyType)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Top Panel In-Between (L/R):</span>
                      <span className="font-medium text-slate-800">
                        {panelJointConfig.topLeftExpanded ? 'Yes' : 'No'} / {panelJointConfig.topRightExpanded ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bottom Panel In-Between (L/R):</span>
                      <span className="font-medium text-slate-800">
                        {panelJointConfig.bottomLeftExpanded ? 'Yes' : 'No'} / {panelJointConfig.bottomRightExpanded ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {panelJointConfig.selectedBodyType === 'bazali' && (
                      <>
                        <div className="flex justify-between">
                          <span>Base Height:</span>
                          <span className="font-medium text-slate-800">{panelJointConfig.bazaHeight} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Front/Back Offset:</span>
                          <span className="font-medium text-slate-800">{panelJointConfig.frontBaseDistance} / {panelJointConfig.backBaseDistance} mm</span>
                        </div>
                      </>
                    )}
                    {panelJointConfig.selectedBodyType === 'ayakli' && (
                      <>
                        <div className="flex justify-between">
                          <span>Leg Height:</span>
                          <span className="font-medium text-slate-800">{panelJointConfig.legHeight} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Leg Diameter:</span>
                          <span className="font-medium text-slate-800">{panelJointConfig.legDiameter} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Leg Offsets (F/B/S):</span>
                          <span className="font-medium text-slate-800">
                            {panelJointConfig.legFrontDistance} / {panelJointConfig.legBackDistance} / {panelJointConfig.legSideDistance} mm
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {backPanelConfig && (
                <div className="border-t border-stone-200 pt-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Back Panel Settings</div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Thickness:</span>
                      <span className="font-medium text-slate-800">{backPanelConfig.backPanelThickness} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Groove Offset:</span>
                      <span className="font-medium text-slate-800">{backPanelConfig.grooveOffset} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Groove Depth:</span>
                      <span className="font-medium text-slate-800">{backPanelConfig.grooveDepth} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Loose (W/D):</span>
                      <span className="font-medium text-slate-800">{backPanelConfig.looseWid} / {backPanelConfig.looseDep} mm</span>
                    </div>
                  </div>
                </div>
              )}

              {generatedPanels && (
                <div className="border-t border-stone-200 pt-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Box size={12} />
                    Generated Panels ({generatedPanels.panels.length})
                  </div>
                  <div className="space-y-1.5">
                    {generatedPanels.panels.map((panel) => (
                      <div key={panel.id} className="flex items-center justify-between text-xs bg-stone-50 px-2 py-1 rounded">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: panel.color }}
                          />
                          <span className="capitalize font-medium text-slate-700">{panel.role}</span>
                        </div>
                        <span className="text-stone-500">
                          {(panel.dimensions[0] * 1000).toFixed(0)} x {(panel.dimensions[1] * 1000).toFixed(0)} x {(panel.dimensions[2] * 1000).toFixed(0)} mm
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-stone-500">
                    Body Bounds: {generatedPanels.bodyBounds.width.toFixed(0)} x {generatedPanels.bodyBounds.height.toFixed(0)} x {generatedPanels.bodyBounds.depth.toFixed(0)} mm
                  </div>
                </div>
              )}

              {!generatedPanels && selectedShape && (
                <div className="border-t border-stone-200 pt-3 text-center text-stone-500 text-xs py-4">
                  Assign face roles (Left, Right, Top, Bottom, Back) to the selected geometry to generate panels
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
