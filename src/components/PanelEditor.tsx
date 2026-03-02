import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, MousePointer, Layers, RotateCw, Plus, Trash2 } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { useAppStore } from '../store';
import type { FaceRole } from '../store';
import { resolveAllPanelJoints, restoreAllPanels, rebuildAllPanels } from './PanelJointService';
import * as THREE from 'three';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const { selectedShapeId, shapes, updateShape, deleteShape, showOutlines, setShowOutlines, showRoleNumbers, setShowRoleNumbers, selectedPanelRow, selectedPanelRowExtraId, setSelectedPanelRow, panelSelectMode, setPanelSelectMode, raycastMode, setRaycastMode } = useAppStore();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const prevProfileRef = useRef<string>('none');
  const prevGeometryRef = useRef<string>('');

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  useEffect(() => {
    setSelectedPanelRow(null);
  }, [selectedShapeId, setSelectedPanelRow]);

  const getArrowTargetAxis = (geometry: THREE.BufferGeometry, faceRole?: string, arrowRotated?: boolean): number => {
    if (!geometry) return 0;

    const posAttr = geometry.getAttribute('position');
    if (!posAttr) return 0;

    const bbox = new THREE.Box3().setFromBufferAttribute(posAttr as THREE.BufferAttribute);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const axes = [
      { index: 0, value: size.x },
      { index: 1, value: size.y },
      { index: 2, value: size.z }
    ];
    axes.sort((a, b) => a.value - b.value);

    const planeAxes = axes.slice(1).map(a => a.index).sort((a, b) => a - b);

    const role = faceRole?.toLowerCase();
    let defaultAxis = planeAxes[0];
    let altAxis = planeAxes[1];

    if (role === 'left' || role === 'right') {
      if (planeAxes.includes(1)) {
        defaultAxis = 1;
        altAxis = planeAxes.find(a => a !== 1) ?? planeAxes[1];
      }
    } else if (role === 'top' || role === 'bottom') {
      if (planeAxes.includes(0)) {
        defaultAxis = 0;
        altAxis = planeAxes.find(a => a !== 0) ?? planeAxes[1];
      }
    }

    return arrowRotated ? altAxis : defaultAxis;
  };

  const computeDimensionsFromPanel = (panel: any): { primary: number; secondary: number; thickness: number; w: number; h: number; d: number } | null => {
    if (!panel || !panel.geometry) return null;
    const box = new THREE.Box3().setFromBufferAttribute(panel.geometry.getAttribute('position'));
    const size = new THREE.Vector3();
    box.getSize(size);

    const dimensions = {
      w: Math.round(size.x * 10) / 10,
      h: Math.round(size.y * 10) / 10,
      d: Math.round(size.z * 10) / 10
    };

    const targetAxis = getArrowTargetAxis(
      panel.geometry,
      panel.parameters?.faceRole,
      panel.parameters?.arrowRotated
    );

    const posAttr = panel.geometry.getAttribute('position');
    const bbox = new THREE.Box3().setFromBufferAttribute(posAttr as THREE.BufferAttribute);
    const sizeVec = new THREE.Vector3();
    bbox.getSize(sizeVec);

    const axes = [
      { index: 0, value: sizeVec.x },
      { index: 1, value: sizeVec.y },
      { index: 2, value: sizeVec.z }
    ];
    axes.sort((a, b) => a.value - b.value);

    const thicknessAxis = axes[0].index;
    const planeAxes = axes.slice(1).map(a => a.index);
    const secondaryAxis = planeAxes.find(a => a !== targetAxis) ?? planeAxes[0];

    let primary: number;
    let secondary: number;
    let thickness: number;

    if (targetAxis === 0) {
      primary = dimensions.w;
    } else if (targetAxis === 1) {
      primary = dimensions.h;
    } else {
      primary = dimensions.d;
    }

    if (secondaryAxis === 0) {
      secondary = dimensions.w;
    } else if (secondaryAxis === 1) {
      secondary = dimensions.h;
    } else {
      secondary = dimensions.d;
    }

    if (thicknessAxis === 0) {
      thickness = dimensions.w;
    } else if (thicknessAxis === 1) {
      thickness = dimensions.h;
    } else {
      thickness = dimensions.d;
    }

    return {
      primary,
      secondary,
      thickness,
      ...dimensions
    };
  };

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    } else {
      setSelectedPanelRow(null);
      setPanelSelectMode(false);
    }
  }, [isOpen, setSelectedPanelRow, setPanelSelectMode]);

  useEffect(() => {
    if (prevProfileRef.current === selectedProfile) return;
    prevProfileRef.current = selectedProfile;
    if (!selectedShapeId) return;

    if (selectedProfile !== 'none') {
      setResolving(true);
      resolveAllPanelJoints(selectedShapeId, selectedProfile).finally(() =>
        setResolving(false)
      );
    } else {
      restoreAllPanels(selectedShapeId);
    }
  }, [selectedProfile, selectedShapeId]);

  const hasRaycastChildren = selectedShapeId ? shapes.some(
    s => s.type === 'panel' && s.parameters?.parentShapeId === selectedShapeId && s.parameters?.isRaycastPanel
  ) : false;

  useEffect(() => {
    if (!selectedShape || !selectedShapeId) return;
    if (selectedProfile === 'none' && !hasRaycastChildren) return;

    const geometryKey = [
      selectedShape.parameters?.width,
      selectedShape.parameters?.height,
      selectedShape.parameters?.depth,
      selectedShape.geometry?.uuid,
      (selectedShape.subtractionGeometries || []).length,
      JSON.stringify(selectedShape.position),
      JSON.stringify(selectedShape.scale)
    ].join('|');

    if (prevGeometryRef.current && prevGeometryRef.current !== geometryKey) {
      console.log('Geometry changed, rebuilding and updating panels...');
      setResolving(true);
      rebuildAllPanels(selectedShapeId)
        .then(() => {
          if (selectedProfile !== 'none') {
            return resolveAllPanelJoints(selectedShapeId, selectedProfile);
          }
        })
        .finally(() => setResolving(false));
    }

    prevGeometryRef.current = geometryKey;
  }, [
    selectedShape?.parameters?.width,
    selectedShape?.parameters?.height,
    selectedShape?.parameters?.depth,
    selectedShape?.geometry?.uuid,
    selectedShape?.subtractionGeometries?.length,
    selectedShape?.position,
    selectedShape?.scale,
    selectedShapeId,
    selectedProfile,
    hasRaycastChildren
  ]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await globalSettingsService.listProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
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
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
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
        width: '560px',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg select-none"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Panel Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRaycastMode(!raycastMode)}
            className={`p-0.5 rounded transition-colors ${
              raycastMode
                ? 'text-amber-600 bg-amber-100 ring-1 ring-amber-400'
                : 'text-slate-600 hover:bg-stone-200'
            }`}
            title={raycastMode ? 'Raycast Modu Aktif (kapat)' : 'Raycast Modunu Aç'}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setPanelSelectMode(!panelSelectMode)}
            className={`p-0.5 hover:bg-stone-200 rounded transition-colors ${
              panelSelectMode ? 'text-orange-600' : 'text-slate-600'
            }`}
            title={panelSelectMode ? 'Panel Mode' : 'Body Mode'}
          >
            {panelSelectMode ? <MousePointer size={14} /> : <Layers size={14} />}
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
        {selectedShape ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  Select Body Profile
                </label>
                {loading ? (
                  <div className="px-2 py-0.5 text-xs text-stone-400 bg-white border border-gray-300 rounded" style={{ width: '30mm' }}>
                    Loading...
                  </div>
                ) : (
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="px-2 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded focus:outline-none focus:border-orange-500"
                    style={{ width: '30mm' }}
                  >
                    <option value="none">None</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  Outline
                </label>
                <input
                  type="checkbox"
                  checked={showOutlines}
                  onChange={(e) => setShowOutlines(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  Role numbers
                </label>
                <input
                  type="checkbox"
                  checked={showRoleNumbers}
                  onChange={(e) => setShowRoleNumbers(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            </div>

            {resolving && (
              <div className="text-[10px] font-normal text-orange-500 animate-pulse">
                resolving joints...
              </div>
            )}

            {(() => {
              const raycastPanels = shapes.filter(
                s => s.type === 'panel' &&
                s.parameters?.parentShapeId === selectedShape.id &&
                s.parameters?.isRaycastPanel === true &&
                s.parameters?.extraRowId
              );

              if (raycastPanels.length === 0) return null;

              const roleOptions: FaceRole[] = ['Left', 'Right', 'Top', 'Bottom', 'Back', 'Door'];

              return (
                <div className="pt-2 border-t border-stone-300 space-y-0.5">
                  <div className="text-xs font-semibold text-sky-700 mb-1">
                    Raycast Panels ({raycastPanels.length})
                  </div>
                  {raycastPanels.map((panel) => {
                    const extraRowId = panel.parameters?.extraRowId;
                    const fIdx = panel.parameters?.faceIndex;
                    const isRowSelected = selectedPanelRow === fIdx &&
                      selectedPanelRowExtraId === extraRowId;
                    const dimensions = computeDimensionsFromPanel(panel);

                    return (
                      <div
                        key={panel.id}
                        className={`flex gap-0.5 items-center p-0.5 rounded transition-colors cursor-pointer ${
                          isRowSelected
                            ? 'bg-sky-50 ring-1 ring-sky-400'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedPanelRow(fIdx ?? null, extraRowId);
                        }}
                      >
                        <input
                          type="radio"
                          name="panel-selection"
                          checked={isRowSelected}
                          onChange={() => {
                            setSelectedPanelRow(fIdx ?? null, extraRowId);
                          }}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input
                          type="text"
                          value={`N`}
                          readOnly
                          tabIndex={-1}
                          className="w-7 px-1 py-0.5 text-xs font-mono border rounded text-center bg-sky-50 text-sky-700 border-sky-200"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <select
                          value={panel.parameters?.faceRole || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const newRole = e.target.value === '' ? null : e.target.value as FaceRole;
                            updateShape(panel.id, {
                              parameters: {
                                ...panel.parameters,
                                faceRole: newRole
                              }
                            });
                            setResolving(true);
                            resolveAllPanelJoints(
                              selectedShape.id,
                              selectedProfile !== 'none' ? selectedProfile : null
                            ).finally(() => setResolving(false));
                          }}
                          style={{ width: '35mm' }}
                          className="px-1 py-0.5 text-xs border rounded bg-white text-gray-800 border-gray-300"
                        >
                          <option value="">none</option>
                          {roleOptions.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={panel.parameters?.description || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            updateShape(panel.id, {
                              parameters: {
                                ...panel.parameters,
                                description: e.target.value
                              }
                            });
                          }}
                          placeholder="description"
                          style={{ width: '40mm' }}
                          className="px-2 py-0.5 text-xs border rounded bg-white text-gray-800 border-gray-300"
                        />
                        <input
                          type="text"
                          value={dimensions?.primary || 'NaN'}
                          readOnly
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[48px] px-1 py-0.5 text-xs font-mono border rounded text-center bg-orange-50 text-gray-800 border-orange-300 font-semibold"
                          title="Arrow Direction Dimension"
                        />
                        <input
                          type="text"
                          value={dimensions?.secondary || 'NaN'}
                          readOnly
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[48px] px-1 py-0.5 text-xs font-mono border rounded text-center bg-blue-50 text-gray-800 border-blue-300 font-semibold"
                          title="Perpendicular to Arrow Direction"
                        />
                        <input
                          type="text"
                          value={dimensions?.thickness || 'NaN'}
                          readOnly
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[48px] px-1 py-0.5 text-xs font-mono border rounded text-center bg-green-50 text-gray-800 border-green-300 font-semibold"
                          title="Panel Thickness"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = panel.parameters?.arrowRotated || false;
                            updateShape(panel.id, {
                              parameters: {
                                ...panel.parameters,
                                arrowRotated: !current
                              }
                            });
                          }}
                          className={`p-0.5 rounded transition-colors ${
                            panel.parameters?.arrowRotated
                              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                              : 'text-slate-500 hover:bg-stone-100'
                          }`}
                          title="Rotate arrow direction"
                        >
                          <RotateCw size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isRowSelected) setSelectedPanelRow(null);
                            deleteShape(panel.id);
                          }}
                          className="p-0.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete raycast panel"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="text-center text-stone-500 text-xs py-4">
            No shape selected
          </div>
        )}
      </div>
    </div>
  );
}
