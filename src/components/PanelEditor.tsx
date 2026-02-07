import React, { useState, useEffect, useMemo } from 'react';
import { X, GripVertical } from 'lucide-react';
import { globalSettingsService, GlobalSettingsProfile } from './GlobalSettingsDatabase';
import { useAppStore } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';
import * as THREE from 'three';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PanelInfo {
  role: string;
  groupIndex: number;
  dimensions: { width: number; height: number };
}

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [profiles, setProfiles] = useState<GlobalSettingsProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    selectedShapeId,
    shapes,
    autoAssignPanelRoles,
    selectedPanelProfileId,
    setSelectedPanelProfileId
  } = useAppStore();

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

  const handleProfileChange = (profileId: string) => {
    const newProfileId = profileId === 'none' ? null : profileId;
    setSelectedPanelProfileId(newProfileId);

    if (newProfileId && selectedShapeId) {
      autoAssignPanelRoles(selectedShapeId);
    }
  };

  const selectedShape = useMemo(() => {
    return shapes.find(s => s.id === selectedShapeId);
  }, [shapes, selectedShapeId]);

  const panelList = useMemo((): PanelInfo[] => {
    if (!selectedShape || !selectedShape.geometry || !selectedShape.faceRoles) {
      return [];
    }

    const faces = extractFacesFromGeometry(selectedShape.geometry);
    const groups = groupCoplanarFaces(faces);
    const panels: PanelInfo[] = [];

    Object.entries(selectedShape.faceRoles).forEach(([idxStr, role]) => {
      if (!role) return;
      const gi = parseInt(idxStr);
      const group = groups[gi];
      if (!group) return;

      const allVerts: THREE.Vector3[] = [];
      group.faceIndices.forEach(faceIdx => {
        const face = faces[faceIdx];
        if (face) allVerts.push(...face.vertices);
      });

      if (allVerts.length === 0) return;

      const bbox = new THREE.Box3();
      allVerts.forEach(v => bbox.expandByPoint(v));
      const size = new THREE.Vector3();
      bbox.getSize(size);

      const n = group.normal;
      const absX = Math.abs(n.x);
      const absY = Math.abs(n.y);
      const absZ = Math.abs(n.z);

      let width = 0, height = 0;
      if (absX > absY && absX > absZ) {
        width = size.z;
        height = size.y;
      } else if (absY > absX && absY > absZ) {
        width = size.x;
        height = size.z;
      } else {
        width = size.x;
        height = size.y;
      }

      panels.push({
        role: role,
        groupIndex: gi,
        dimensions: { width, height }
      });
    });

    return panels;
  }, [selectedShape]);

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
                  value={selectedPanelProfileId || 'none'}
                  onChange={(e) => handleProfileChange(e.target.value)}
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

          {!selectedShapeId && (
            <div className="text-center text-stone-500 text-xs py-8 border-t border-stone-200">
              No shape selected
            </div>
          )}

          {selectedShapeId && panelList.length === 0 && selectedPanelProfileId && (
            <div className="text-center text-amber-600 text-xs py-8 border-t border-stone-200">
              Select a profile to auto-assign panels
            </div>
          )}

          {panelList.length > 0 && (
            <div className="space-y-2 border-t border-stone-200 pt-3">
              <div className="text-xs font-semibold text-slate-800 mb-2">
                Panels ({panelList.length})
              </div>
              <div className="space-y-1">
                {panelList.map((panel, idx) => (
                  <div
                    key={`panel-${panel.groupIndex}-${idx}`}
                    className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs"
                  >
                    <div className="w-16 font-medium text-slate-700">
                      {panel.role}
                    </div>
                    <div className="flex-1 flex items-center gap-2 text-stone-600">
                      <span>W: {panel.dimensions.width.toFixed(1)}</span>
                      <span className="text-stone-400">×</span>
                      <span>H: {panel.dimensions.height.toFixed(1)}</span>
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      18mm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
