import React, { useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  FaceData,
  CoplanarFaceGroup,
} from './FaceEditor';

interface FaceRaycastOverlayProps {
  shape: any;
  allShapes?: any[];
}

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape, allShapes = [] }) => {
  const { raycastMode, setRaycastMode, triggerPanelCreationForFace } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);

  const geometryUuid = shape.geometry?.uuid || '';

  const parentPos = useMemo(() => new THREE.Vector3(
    shape.position[0], shape.position[1], shape.position[2]
  ), [shape.position[0], shape.position[1], shape.position[2]]);

  useEffect(() => {
    if (!shape.geometry) return;
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    setFaces(extractedFaces);
    setFaceGroups(groupCoplanarFaces(extractedFaces));
  }, [shape.geometry, shape.id, geometryUuid]);

  useEffect(() => {
    if (!raycastMode) {
      setHoveredGroupIndex(null);
    }
  }, [raycastMode]);


  const childPanels = useMemo(() => {
    return allShapes.filter(
      s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id
    );
  }, [allShapes, shape.id]);

  const hoverHighlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;
    return createFaceHighlightGeometry(faces, faceGroups[hoveredGroupIndex].faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const handlePointerMove = useCallback((e: any) => {
    if (!raycastMode || faces.length === 0) return;
    e.stopPropagation();
    const fi = e.faceIndex;
    if (fi !== undefined) {
      const gi = faceGroups.findIndex(g => g.faceIndices.includes(fi));
      if (gi !== -1) setHoveredGroupIndex(gi);
    }
  }, [raycastMode, faces, faceGroups]);

  const handlePointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHoveredGroupIndex(null);
  }, []);

  const handlePointerDown = useCallback((e: any) => {
    if (!raycastMode) return;
    e.stopPropagation();

    if (e.button !== 0) return;
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return;

    const group = faceGroups[hoveredGroupIndex];
    const faceGroupIndex = hoveredGroupIndex;
    const clickWorld: THREE.Vector3 = e.point.clone();

    const shapePos = new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]);
    const shapeRot = shape.rotation as [number, number, number];
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(shapeRot[0], shapeRot[1], shapeRot[2], 'XYZ'));

    const worldNormal = group.normal.clone().applyQuaternion(rot).normalize();

    triggerPanelCreationForFace(faceGroupIndex, shape.id, {
      center: [clickWorld.x, clickWorld.y, clickWorld.z],
      normal: [worldNormal.x, worldNormal.y, worldNormal.z],
      constraintPanelId: `raycast-face-${faceGroupIndex}`
    });

    setRaycastMode(false);
  }, [raycastMode, hoveredGroupIndex, faceGroups, shape.position, shape.rotation, shape.id, setRaycastMode, triggerPanelCreationForFace]);

  if (!raycastMode) return null;

  return (
    <>
      <mesh
        geometry={shape.geometry}
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
      />

      {hoverHighlightGeometry && (
        <mesh geometry={hoverHighlightGeometry}>
          <meshBasicMaterial
            color={0xfbbf24}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
    </>
  );
};
