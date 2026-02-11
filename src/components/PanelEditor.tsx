import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { useAppStore } from '../store';
import type { FaceRole } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces, FaceData, CoplanarFaceGroup } from './FaceEditor';
import { resolveAllPanelJoints, restoreAllPanels } from './PanelJointService';
import * as THREE from 'three';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const { selectedShapeId, shapes, updateShape, addShape, showOutlines, setShowOutlines, showRoleNumbers, setShowRoleNumbers, selectShape, selectedPanelRow, setSelectedPanelRow } = useAppStore();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const prevProfileRef = useRef<string>('none');
  const prevGeometryRef = useRef<string>('');
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  useEffect(() => {
    setSelectedPanelRow(null);
  }, [selectedShapeId, setSelectedPanelRow]);

  const getPanelDimensions = (faceIndex: number): { w: number; h: number; d: number } | null => {
    if (!selectedShape) return null;
    const panel = shapes.find(
      s => s.type === 'panel' &&
      s.parameters?.parentShapeId === selectedShape.id &&
      s.parameters?.faceIndex === faceIndex
    );
    if (!panel || !panel.geometry) return null;
    const box = new THREE.Box3().setFromBufferAttribute(panel.geometry.getAttribute('position'));
    const size = new THREE.Vector3();
    box.getSize(size);
    return {
      w: Math.round(size.x * 10) / 10,
      h: Math.round(size.y * 10) / 10,
      d: Math.round(size.z * 10) / 10
    };
  };

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    } else {
      setSelectedPanelRow(null);
    }
  }, [isOpen, setSelectedPanelRow]);

  useEffect(() => {
    if (!selectedShapeId || !selectedShape) return;
    const panel = shapes.find(s => s.id === selectedShapeId && s.type === 'panel');
    if (!panel || panel.parameters?.parentShapeId !== selectedShape.id) return;
    const faceIndex = panel.parameters?.faceIndex;
    if (faceIndex !== undefined && faceIndex !== null) {
      const rowElement = rowRefs.current.get(faceIndex);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedShapeId, shapes, selectedShape]);

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

  useEffect(() => {
    if (!selectedShape || !selectedShapeId || selectedProfile === 'none') return;

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
      console.log('🔄 Geometry changed, updating panels...');
      setResolving(true);
      resolveAllPanelJoints(selectedShapeId, selectedProfile).finally(() =>
        setResolving(false)
      );
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
    selectedProfile
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

  const createPanelForFace = async (faceGroup: CoplanarFaceGroup, faces: FaceData[], faceIndex: number) => {
    if (!selectedShape || !selectedShape.replicadShape) {
      console.error('❌ No replicad shape available for panel creation');
      return;
    }

    console.log(`📦 Creating panel from face ${faceIndex + 1}...`);

    try {
      const localVertices: THREE.Vector3[] = [];
      faceGroup.faceIndices.forEach(idx => {
        const face = faces[idx];
        face.vertices.forEach(v => {
          localVertices.push(v.clone());
        });
      });

      const localNormal = faceGroup.normal.clone().normalize();
      const localBox = new THREE.Box3().setFromPoints(localVertices);
      const localCenter = new THREE.Vector3();
      localBox.getCenter(localCenter);

      const panelThickness = 18;

      const { createPanelFromFace, convertReplicadToThreeGeometry } = await import('./ReplicadService');

      let replicadPanel = await createPanelFromFace(
        selectedShape.replicadShape,
        [localNormal.x, localNormal.y, localNormal.z],
        [localCenter.x, localCenter.y, localCenter.z],
        panelThickness
      );

      if (!replicadPanel) {
        console.warn('⚠️ Panel creation from face failed, skipping...');
        return;
      }

      const geometry = convertReplicadToThreeGeometry(replicadPanel);

      const faceRole = selectedShape.faceRoles?.[faceIndex];

      const newPanel = {
        id: `panel-${Date.now()}`,
        type: 'panel',
        geometry,
        replicadShape: replicadPanel,
        position: [...selectedShape.position] as [number, number, number],
        rotation: selectedShape.rotation,
        scale: [...selectedShape.scale] as [number, number, number],
        color: '#ffffff',
        parameters: {
          width: 0,
          height: 0,
          depth: panelThickness,
          parentShapeId: selectedShape.id,
          faceIndex: faceIndex,
          faceRole: faceRole
        }
      };

      addShape(newPanel);
      console.log(`✅ Panel created from face ${faceIndex + 1}`);
    } catch (error) {
      console.error('❌ Failed to create panel:', error);
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
        {selectedShape ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-orange-700 whitespace-nowrap">
                  Select Body Profile
                </label>
                {loading ? (
                  <div className="px-2 py-0.5 text-xs text-stone-400 bg-white border border-gray-300 rounded flex-1">
                    Loading profiles...
                  </div>
                ) : (
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
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-800 whitespace-nowrap flex-1">
                  Show Reference Volume Edges
                </label>
                <input
                  type="checkbox"
                  checked={showOutlines}
                  onChange={(e) => setShowOutlines(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-800 whitespace-nowrap flex-1">
                  Show Role Numbers
                </label>
                <input
                  type="checkbox"
                  checked={showRoleNumbers}
                  onChange={(e) => setShowRoleNumbers(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
              </div>
            </div>

            {(() => {
              const geometry = selectedShape.geometry;
              if (!geometry) return null;

              const faces = extractFacesFromGeometry(geometry);
              const faceGroups = groupCoplanarFaces(faces);
              const faceRoles = selectedShape.faceRoles || {};
              const faceDescriptions = selectedShape.faceDescriptions || {};
              const facePanels = selectedShape.facePanels || {};
              const roleOptions: FaceRole[] = ['Left', 'Right', 'Top', 'Bottom', 'Back', 'Door'];
              const isDisabled = selectedProfile === 'none';

              const handleTogglePanel = async (faceIndex: number) => {
                if (isDisabled) return;
                const newFacePanels = { ...facePanels };
                if (newFacePanels[faceIndex]) {
                  delete newFacePanels[faceIndex];

                  const panelToRemove = shapes.find(s =>
                    s.type === 'panel' &&
                    s.parameters?.parentShapeId === selectedShape.id &&
                    s.parameters?.faceIndex === faceIndex
                  );
                  if (panelToRemove) {
                    const { deleteShape } = useAppStore.getState();
                    deleteShape(panelToRemove.id);
                  }
                } else {
                  newFacePanels[faceIndex] = true;
                  await createPanelForFace(faceGroups[faceIndex], faces, faceIndex);
                }
                updateShape(selectedShape.id, { facePanels: newFacePanels });

                if (selectedProfile !== 'none') {
                  setResolving(true);
                  try {
                    await resolveAllPanelJoints(selectedShape.id, selectedProfile);
                  } finally {
                    setResolving(false);
                  }
                }
              };

              const handleRowClick = (faceIndex: number) => {
                if (!facePanels[faceIndex]) return;
                setSelectedPanelRow(faceIndex);
              };

              return (
                <div className={`space-y-0.5 pt-2 border-t border-stone-300 ${isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className={`text-xs font-semibold mb-1 flex items-center gap-2 ${isDisabled ? 'text-stone-400' : 'text-orange-700'}`}>
                    <span>Face Roles ({faceGroups.length} faces)</span>
                    {resolving && (
                      <span className="text-[10px] font-normal text-orange-500 animate-pulse">
                        resolving joints...
                      </span>
                    )}
                  </div>
                  {faceGroups.map((_group, i) => {
                    const dimensions = getPanelDimensions(i);
                    const isRowSelected = selectedPanelRow === i;
                    return (
                      <div
                        key={`face-${i}`}
                        ref={(el) => {
                          if (el) rowRefs.current.set(i, el);
                          else rowRefs.current.delete(i);
                        }}
                        className={`flex gap-0.5 items-center p-0.5 rounded transition-colors ${isRowSelected ? 'bg-orange-50 ring-1 ring-orange-400' : 'hover:bg-gray-50'} ${facePanels[i] ? 'cursor-pointer' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (facePanels[i]) handleRowClick(i);
                        }}
                      >
                        <input
                          type="radio"
                          name="panel-selection"
                          checked={isRowSelected}
                          disabled={isDisabled || !facePanels[i]}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleRowClick(i);
                          }}
                          className={`w-4 h-4 ${isDisabled || !facePanels[i] ? 'text-stone-300 cursor-not-allowed' : 'text-orange-600 focus:ring-orange-500 cursor-pointer'}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input
                          type="text"
                          value={i + 1}
                          readOnly
                          tabIndex={-1}
                          disabled={isDisabled}
                          className={`w-7 px-1 py-0.5 text-xs font-mono border rounded text-center ${isDisabled ? 'bg-stone-100 text-stone-400 border-stone-200' : 'bg-white text-gray-800 border-gray-300'}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <select
                          value={faceRoles[i] || ''}
                          disabled={isDisabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const newRole = e.target.value === '' ? null : e.target.value as FaceRole;
                            const newFaceRoles = { ...faceRoles, [i]: newRole };
                            if (newRole === null) {
                              delete newFaceRoles[i];
                            }
                            updateShape(selectedShape.id, { faceRoles: newFaceRoles });

                            const panelShape = shapes.find(s =>
                              s.type === 'panel' &&
                              s.parameters?.parentShapeId === selectedShape.id &&
                              s.parameters?.faceIndex === i
                            );
                            if (panelShape) {
                              updateShape(panelShape.id, {
                                parameters: {
                                  ...panelShape.parameters,
                                  faceRole: newRole
                                }
                              });
                              if (selectedProfile !== 'none') {
                                setResolving(true);
                                resolveAllPanelJoints(selectedShape.id, selectedProfile).finally(() =>
                                  setResolving(false)
                                );
                              }
                            }
                          }}
                          className={`w-20 px-1 py-0.5 text-xs border rounded ${isDisabled ? 'bg-stone-100 text-stone-400 border-stone-200' : 'bg-white text-gray-800 border-gray-300'}`}
                        >
                          <option value="">none</option>
                          {roleOptions.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={faceDescriptions[i] || ''}
                          disabled={isDisabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const newDescriptions = { ...faceDescriptions, [i]: e.target.value };
                            updateShape(selectedShape.id, { faceDescriptions: newDescriptions });
                          }}
                          placeholder="description"
                          className={`w-[200px] px-2 py-0.5 text-xs border rounded ${isDisabled ? 'bg-stone-100 text-stone-400 border-stone-200 placeholder:text-stone-300' : 'bg-white text-gray-800 border-gray-300'}`}
                        />
                        <input
                          type="text"
                          value={dimensions?.w || 'NaN'}
                          readOnly
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[48px] px-1 py-0.5 text-xs font-mono border rounded text-center bg-gray-50 text-gray-600 border-gray-200"
                          title="Width"
                        />
                        <input
                          type="text"
                          value={dimensions?.h || 'NaN'}
                          readOnly
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[48px] px-1 py-0.5 text-xs font-mono border rounded text-center bg-gray-50 text-gray-600 border-gray-200"
                          title="Height"
                        />
                        <input
                          type="text"
                          value={dimensions?.d || 'NaN'}
                          readOnly
                          tabIndex={-1}
                          onClick={(e) => e.stopPropagation()}
                          className="w-[48px] px-1 py-0.5 text-xs font-mono border rounded text-center bg-gray-50 text-gray-600 border-gray-200"
                          title="Depth"
                        />
                        <input
                          type="checkbox"
                          checked={facePanels[i] || false}
                          disabled={isDisabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleTogglePanel(i)}
                          className={`w-4 h-4 border-gray-300 rounded ${isDisabled ? 'text-stone-300 cursor-not-allowed' : 'text-green-600 focus:ring-green-500 cursor-pointer'}`}
                          title={`Toggle panel for face ${i + 1}`}
                        />
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
