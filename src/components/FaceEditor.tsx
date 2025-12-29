import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  createGroupBoundaryEdges,
  type FaceData,
  type CoplanarFaceGroup
} from '../services/faceEditor';

interface FaceEditorProps {
  shape: any;
  isActive: boolean;
}

export const FaceEditor: React.FC<FaceEditorProps> = ({ shape, isActive }) => {
  const {
    hoveredFaceIndex,
    setHoveredFaceIndex,
    selectedFaceIndex,
    setSelectedFaceIndex,
    filletMode,
    selectedFilletFaces,
    addFilletFace,
    addFilletFaceData
  } = useAppStore();

  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!shape.geometry) return;

    console.log('🔍 Extracting faces from geometry...');
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    console.log(`✅ Extracted ${extractedFaces.length} faces`);

    setFaces(extractedFaces);

    const groups = groupCoplanarFaces(extractedFaces);
    console.log(`✅ Grouped into ${groups.length} coplanar face groups`);

    setFaceGroups(groups);
  }, [shape.geometry, shape.id]);

  const handlePointerMove = (e: any) => {
    if (!isActive || faces.length === 0) return;

    e.stopPropagation();
    const faceIndex = e.faceIndex;

    if (faceIndex !== undefined) {
      const groupIndex = faceGroups.findIndex(group =>
        group.faceIndices.includes(faceIndex)
      );

      if (groupIndex !== -1) {
        setHoveredGroupIndex(groupIndex);
        setHoveredFaceIndex(faceIndex);
      }
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredGroupIndex(null);
    setHoveredFaceIndex(null);
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();

    if (e.button === 2 && hoveredGroupIndex !== null) {
      if (filletMode && selectedFilletFaces.length < 2) {
        const group = faceGroups[hoveredGroupIndex];
        if (group) {
          addFilletFace(hoveredGroupIndex);
          addFilletFaceData({
            normal: [group.normal.x, group.normal.y, group.normal.z],
            center: [group.center.x, group.center.y, group.center.z]
          });
          console.log(`✅ Fillet face ${selectedFilletFaces.length + 1} selected:`, hoveredGroupIndex);
          console.log('   Normal:', [group.normal.x.toFixed(2), group.normal.y.toFixed(2), group.normal.z.toFixed(2)]);
          console.log('   Center:', [group.center.x.toFixed(2), group.center.y.toFixed(2), group.center.z.toFixed(2)]);

          if (selectedFilletFaces.length === 1) {
            console.log('🎯 Two faces selected! Ready for fillet operation. Enter radius in terminal.');
          }
        }
      } else {
        setSelectedFaceIndex(hoveredGroupIndex);
        console.log('✅ Face group selected:', hoveredGroupIndex);
      }
    }
  };

  const shapePositionKey = JSON.stringify(shape.position);
  const shapeRotationKey = JSON.stringify(shape.rotation);
  const shapeScaleKey = JSON.stringify(shape.scale);

  const selectedFilletGeometries = useMemo(() => {
    if (!filletMode || selectedFilletFaces.length === 0) return [];

    return selectedFilletFaces.map(faceGroupIndex => {
      const group = faceGroups[faceGroupIndex];
      if (!group) return null;
      return createFaceHighlightGeometry(faces, group.faceIndices);
    }).filter(g => g !== null);
  }, [filletMode, selectedFilletFaces, faceGroups, faces, shapePositionKey, shapeRotationKey, shapeScaleKey]);

  const highlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;

    const group = faceGroups[hoveredGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces, shapePositionKey, shapeRotationKey, shapeScaleKey]);

  const boundaryEdgesGeometry = useMemo(() => {
    if (faces.length === 0 || faceGroups.length === 0) return null;
    return createGroupBoundaryEdges(faces, faceGroups);
  }, [faces, faceGroups, shapePositionKey, shapeRotationKey, shapeScaleKey]);

  if (!isActive) return null;

  const position: [number, number, number] = [shape.position[0], shape.position[1], shape.position[2]];
  const rotation: [number, number, number] = [shape.rotation[0], shape.rotation[1], shape.rotation[2]];
  const scale: [number, number, number] = [shape.scale[0], shape.scale[1], shape.scale[2]];

  return (
    <>
      <mesh
        geometry={shape.geometry}
        visible={false}
        position={position}
        rotation={rotation}
        scale={scale}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.stopPropagation()}
      />

      {selectedFilletGeometries.map((geom, idx) => (
        <mesh
          key={`selected-${idx}`}
          geometry={geom}
          position={position}
          rotation={rotation}
          scale={scale}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}

      {highlightGeometry && !selectedFilletFaces.includes(hoveredGroupIndex!) && (
        <mesh
          geometry={highlightGeometry}
          position={position}
          rotation={rotation}
          scale={scale}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {boundaryEdgesGeometry && (
        <lineSegments
          geometry={boundaryEdgesGeometry}
          position={position}
          rotation={rotation}
          scale={scale}
        >
          <lineBasicMaterial color={0x00ffff} linewidth={2} />
        </lineSegments>
      )}
    </>
  );
};
