import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, RotateCw, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { useAppStore } from '../store';
import type { FaceRole } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';
import { resolveAllPanelJoints, restoreAllPanels, rebuildAllPanels } from './PanelJointService';
import * as THREE from 'three';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const {
    selectedShapeId,
    shapes,
    updateShape,
    addShape,
    deleteShape,
    showOutlines,
    setShowOutlines,
    showRoleNumbers,
    setShowRoleNumbers,
    selectedPanelRow,
    setSelectedPanelRow,
    panelSelectMode,
    setPanelSelectMode
  } = useAppStore();

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const prevProfileRef = useRef<string>('none');
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  useEffect(() => {
    setSelectedPanelRow(null);
  }, [selectedShapeId, setSelectedPanelRow]);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    } else {
      setSelectedPanelRow(null);
      setPanelSelectMode(false);
    }
  }, [isOpen, setSelectedPanelRow, setPanelSelectMode]);

  useEffect(() => {
    if (selectedPanelRow !== null) {
      const rowElement = rowRefs.current.get(selectedPanelRow as number);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedPanelRow]);

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

  const createPanelForFace = async (faceIndex: number) => {
    if (!selectedShape || !selectedShape.replicadShape || !selectedShape.geometry) {
      return;
    }

    try {
      const faces = extractFacesFromGeometry(selectedShape.geometry);
      const faceGroups = groupCoplanarFaces(faces);
      if (faceIndex >= faceGroups.length) return;

      const faceGroup = faceGroups[faceIndex];
      const { createPanelFromFace, convertReplicadToThreeGeometry } = await import('./ReplicadService');

      const localVertices: THREE.Vector3[] = [];
      faceGroup.faceIndices.forEach((idx: number) => {
        const face = faces[idx];
        face.vertices.forEach((v: THREE.Vector3) => localVertices.push(v.clone()));
      });

      const localNormal = faceGroup.normal.clone().normalize();
      const localBox = new THREE.Box3().setFromPoints(localVertices);
      const localCenter = new THREE.Vector3();
      localBox.getCenter(localCenter);

      const panelThickness = 18;

      const replicadPanel = await createPanelFromFace(
        selectedShape.replicadShape,
        [localNormal.x, localNormal.y, localNormal.z],
        [localCenter.x, localCenter.y, localCenter.z],
        panelThickness
      );

      if (!replicadPanel) return;

      const geometry = convertReplicadToThreeGeometry(replicadPanel);
      const faceRole = selectedShape.faceRoles?.[faceIndex];

      const panelId = `panel-${Date.now()}`;
      addShape({
        id: panelId,
        type: 'panel',
        geometry,
        replicadShape: replicadPanel,
        position: [...selectedShape.position] as [number, number, number],
        rotation: selectedShape.rotation,
        scale: [...selectedShape.scale] as [number, number, number],
        color: '#ffffff',
        parameters: {
          parentShapeId: selectedShapeId,
          faceIndex,
          faceRole,
          thickness: panelThickness
        }
      });

      updateShape(selectedShapeId!, {
        facePanels: { ...(selectedShape.facePanels || {}), [faceIndex]: true }
      });
    } catch (error) {
      console.error('Failed to create panel:', error);
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
        width: '480px',
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
            onClick={() => setPanelSelectMode(!panelSelectMode)}
            className={`p-0.5 hover:bg-stone-200 rounded transition-colors ${
              panelSelectMode ? 'text-orange-600 bg-orange-50' : 'text-slate-600'
            }`}
            title="Panel Select Mode"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => setShowRoleNumbers(!showRoleNumbers)}
            className={`p-0.5 hover:bg-stone-200 rounded transition-colors ${
              showRoleNumbers ? 'text-orange-600 bg-orange-50' : 'text-slate-600'
            }`}
            title="Show Role Numbers"
          >
            <Eye size={13} />
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
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                Profile:
              </label>
              {loading ? (
                <div className="px-2 py-0.5 text-xs text-stone-400">Loading...</div>
              ) : (
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded bg-white"
                >
                  <option value="none">None</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => rebuildAllPanels(selectedShapeId!)}
                disabled={resolving}
                className="flex-1 px-2 py-1 text-[10px] font-medium bg-stone-200 text-slate-700 hover:bg-stone-300 rounded disabled:opacity-50"
              >
                REBUILD
              </button>
              <button
                onClick={() => resolveAllPanelJoints(selectedShapeId!, selectedProfile)}
                disabled={resolving || selectedProfile === 'none'}
                className="flex-1 px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded disabled:opacity-50"
              >
                {resolving ? <RotateCw size={10} className="inline animate-spin mr-1" /> : null}
                RESOLVE
              </button>
              <button
                onClick={() => restoreAllPanels(selectedShapeId!)}
                disabled={resolving}
                className="flex-1 px-2 py-1 text-[10px] font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 rounded disabled:opacity-50"
              >
                RESTORE
              </button>
            </div>

            {selectedShape.geometry && (() => {
              const faces = extractFacesFromGeometry(selectedShape.geometry);
              const faceGroups = groupCoplanarFaces(faces);
              const faceRoles = selectedShape.faceRoles || {};
              const facePanels = selectedShape.facePanels || {};
              const roleOptions: FaceRole[] = ['Left', 'Right', 'Top', 'Bottom', 'Back', 'Door'];

              return (
                <div className="border-t border-stone-200 pt-2">
                  <div className="text-xs font-semibold text-stone-600 mb-1">
                    Face Groups ({faceGroups.length})
                  </div>
                  <div className="space-y-1">
                    {faceGroups.map((group, i) => {
                      const isRowSelected = selectedPanelRow === i;
                      const hasPanel = facePanels[i];

                      return (
                        <div
                          key={`face-${i}`}
                          ref={(el) => {
                            if (el) rowRefs.current.set(i, el);
                            else rowRefs.current.delete(i);
                          }}
                          className={`flex gap-1 items-center p-1 rounded border text-xs transition-colors ${
                            isRowSelected
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-white border-stone-200 hover:bg-stone-50'
                          }`}
                          onClick={() => setSelectedPanelRow(isRowSelected ? null : i)}
                        >
                          <span className="w-5 text-center font-mono text-stone-500 text-[10px]">
                            {i + 1}
                          </span>

                          <select
                            value={faceRoles[i] || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const newRole = (e.target.value === '' ? null : e.target.value) as FaceRole;
                              const newRoles = { ...faceRoles, [i]: newRole };
                              if (!newRole) delete newRoles[i];
                              updateShape(selectedShapeId!, { faceRoles: newRoles });
                            }}
                            className="flex-1 px-1 py-0.5 text-xs border border-stone-300 rounded bg-white"
                          >
                            <option value="">role</option>
                            {roleOptions.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>

                          <span className="text-stone-400 text-[9px]">
                            [{group.normal.x.toFixed(1)}, {group.normal.y.toFixed(1)}, {group.normal.z.toFixed(1)}]
                          </span>

                          {hasPanel ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const panelToDelete = shapes.find(
                                  (s) =>
                                    s.type === 'panel' &&
                                    s.parameters?.parentShapeId === selectedShapeId &&
                                    s.parameters?.faceIndex === i
                                );
                                if (panelToDelete) {
                                  deleteShape(panelToDelete.id);
                                }
                                const newFacePanels = { ...facePanels };
                                delete newFacePanels[i];
                                updateShape(selectedShapeId!, { facePanels: newFacePanels });
                              }}
                              className="p-0.5 hover:bg-red-100 rounded text-red-500 transition-colors"
                              title="Delete panel"
                            >
                              <Trash2 size={11} />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                createPanelForFace(i);
                              }}
                              className="p-0.5 hover:bg-green-100 rounded text-green-600 transition-colors"
                              title="Create panel"
                            >
                              <Plus size={11} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="text-center text-stone-500 text-xs py-4">
            Select a shape to manage panels
          </div>
        )}
      </div>
    </div>
  );
}
