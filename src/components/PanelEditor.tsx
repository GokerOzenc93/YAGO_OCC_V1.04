import React, { useState, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { useAppStore } from '../store';
import type { FaceRole } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces, FaceData, CoplanarFaceGroup } from './FaceEditor';
import * as THREE from 'three';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const { selectedShapeId, shapes, updateShape, addShape, showOutlines, setShowOutlines } = useAppStore();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('none');
  const [loading, setLoading] = useState(true);

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

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

      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(selectedShape.rotation[0], selectedShape.rotation[1], selectedShape.rotation[2])
      );
      const worldNormal = faceGroup.normal.clone().normalize().applyQuaternion(quaternion);

      const worldVertices: THREE.Vector3[] = localVertices.map(v => {
        const rotated = v.clone().applyQuaternion(quaternion);
        const scaled = rotated.multiply(new THREE.Vector3(...selectedShape.scale));
        return scaled.add(new THREE.Vector3(...selectedShape.position));
      });

      const box = new THREE.Box3().setFromPoints(worldVertices);
      const center = new THREE.Vector3();
      box.getCenter(center);

      console.log('📐 Face center and normal:', {
        center: center,
        worldNormal: worldNormal
      });

      const panelThickness = 18;

      const { createPanelFromFace, convertReplicadToThreeGeometry } = await import('./ReplicadService');

      const localNormal = worldNormal.clone()
        .applyQuaternion(quaternion.clone().invert())
        .normalize();

      console.log('🔄 Using local normal for face matching:', localNormal);

      let replicadPanel = await createPanelFromFace(
        selectedShape.replicadShape,
        [localNormal.x, localNormal.y, localNormal.z],
        [center.x, center.y, center.z],
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
        color: '#8b5cf6',
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
        {selectedShape ? (
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

              const handleTogglePanel = async (faceIndex: number) => {
                const newFacePanels = { ...facePanels };
                if (newFacePanels[faceIndex]) {
                  delete newFacePanels[faceIndex];
                  console.log(`Panel removed from face ${faceIndex + 1}`);

                  const panelToRemove = shapes.find(s =>
                    s.type === 'panel' &&
                    s.parameters?.parentShapeId === selectedShape.id &&
                    s.parameters?.faceIndex === faceIndex
                  );
                  if (panelToRemove) {
                    const { deleteShape } = useAppStore.getState();
                    deleteShape(panelToRemove.id);
                    console.log(`🗑️ Panel shape removed: ${panelToRemove.id}`);
                  }
                } else {
                  newFacePanels[faceIndex] = true;
                  console.log(`Panel added to face ${faceIndex + 1} with role: ${faceRoles[faceIndex] || 'none'}`);

                  await createPanelForFace(faceGroups[faceIndex], faces, faceIndex);
                }
                updateShape(selectedShape.id, { facePanels: newFacePanels });
              };

              return (
                <div className="space-y-2 pt-2 border-t border-stone-300">
                  <div className="text-xs font-semibold text-purple-700 mb-1">Face Roles ({faceGroups.length} faces)</div>
                  {faceGroups.map((group, i) => (
                    <div key={`face-${i}`} className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={i + 1}
                        readOnly
                        tabIndex={-1}
                        className="w-10 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded text-center"
                      />
                      <select
                        value={faceRoles[i] || ''}
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
                          }
                        }}
                        className="w-20 px-1 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded"
                      >
                        <option value="">none</option>
                        {roleOptions.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={faceDescriptions[i] || ''}
                        onChange={(e) => {
                          const newDescriptions = { ...faceDescriptions, [i]: e.target.value };
                          updateShape(selectedShape.id, { faceDescriptions: newDescriptions });
                        }}
                        placeholder="description"
                        className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded"
                      />
                      <input
                        type="checkbox"
                        checked={facePanels[i] || false}
                        onChange={() => handleTogglePanel(i)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                        title={`Toggle panel for face ${i + 1}`}
                      />
                    </div>
                  ))}
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
