import React, { useEffect, useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  createGroupBoundaryEdges,
  type FaceData,
  type CoplanarFaceGroup
} from './FaceEditorService';

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
  const groupRef = useRef<THREE.Group>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;

  useFrame(() => {
    if (groupRef.current) {
      const currentShape = shapeRef.current;
      if (currentShape) {
        groupRef.current.position.set(currentShape.position[0], currentShape.position[1], currentShape.position[2]);
        groupRef.current.rotation.set(currentShape.rotation[0], currentShape.rotation[1], currentShape.rotation[2]);
        groupRef.current.scale.set(currentShape.scale[0], currentShape.scale[1], currentShape.scale[2]);
      }
    }
  });

  const geometryUuid = shape.geometry?.uuid || '';

  useEffect(() => {
    if (!shape.geometry) return;

    console.log('🔍 Extracting faces from geometry...', geometryUuid);
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    console.log(`✅ Extracted ${extractedFaces.length} faces`);

    setFaces(extractedFaces);

    const groups = groupCoplanarFaces(extractedFaces);
    console.log(`✅ Grouped into ${groups.length} coplanar face groups`);

    setFaceGroups(groups);
  }, [shape.geometry, shape.id, geometryUuid]);

  const handleFaceSelection = (groupIndex: number) => {
    if (filletMode && selectedFilletFaces.length < 2) {
      const group = faceGroups[groupIndex];
      if (group) {
        addFilletFace(groupIndex);
        addFilletFaceData({
          normal: [group.normal.x, group.normal.y, group.normal.z],
          center: [group.center.x, group.center.y, group.center.z]
        });
        console.log(`✅ Fillet face ${selectedFilletFaces.length + 1} selected:`, groupIndex);
        console.log('   Normal:', [group.normal.x.toFixed(2), group.normal.y.toFixed(2), group.normal.z.toFixed(2)]);
        console.log('   Center:', [group.center.x.toFixed(2), group.center.y.toFixed(2), group.center.z.toFixed(2)]);

        if (selectedFilletFaces.length === 1) {
          console.log('🎯 Two faces selected! Ready for fillet operation. Enter radius in terminal.');
        }
      }
    } else {
      setSelectedFaceIndex(groupIndex);
      console.log('✅ Face group selected:', groupIndex);
    }
  };

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
      handleFaceSelection(hoveredGroupIndex);
    }
  };

  const selectedFilletGeometries = useMemo(() => {
    if (!filletMode || selectedFilletFaces.length === 0) return [];

    return selectedFilletFaces.map(faceGroupIndex => {
      const group = faceGroups[faceGroupIndex];
      if (!group) return null;
      return createFaceHighlightGeometry(faces, group.faceIndices);
    }).filter(g => g !== null);
  }, [filletMode, selectedFilletFaces, faceGroups, faces]);

  const highlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;

    const group = faceGroups[hoveredGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const boundaryEdgesGeometry = useMemo(() => {
    if (faces.length === 0 || faceGroups.length === 0) return null;
    return createGroupBoundaryEdges(faces, faceGroups);
  }, [faces, faceGroups]);

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      <mesh
        geometry={shape.geometry}
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.stopPropagation()}
      />

      {selectedFilletGeometries.map((geom, idx) => (
        <mesh
          key={`selected-${idx}`}
          geometry={geom}
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
        >
          <lineBasicMaterial color={0x00ffff} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
};
