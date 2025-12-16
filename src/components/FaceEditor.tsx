import React, { useEffect, useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useAppStore } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  type FaceData,
  type CoplanarFaceGroup
} from '../services/faceEditor';

interface FaceEditorProps {
  shape: any;
  isActive: boolean;
}

export const FaceEditor: React.FC<FaceEditorProps> = ({ shape, isActive }) => {
  const { camera, raycaster, gl } = useThree();
  const {
    hoveredFaceIndex,
    setHoveredFaceIndex,
    selectedFaceIndex,
    setSelectedFaceIndex,
    filletMode,
    selectedFilletFaces,
    addFilletFace
  } = useAppStore();

  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const highlightMeshRef = useRef<THREE.Mesh>(null);

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

  useEffect(() => {
    if (!isActive) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!meshRef.current || faces.length === 0) return;

      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObject(meshRef.current, false);

      if (intersects.length > 0 && intersects[0].faceIndex !== undefined) {
        const faceIndex = intersects[0].faceIndex;

        const groupIndex = faceGroups.findIndex(group =>
          group.faceIndices.includes(faceIndex)
        );

        if (groupIndex !== -1) {
          setHoveredGroupIndex(groupIndex);
          setHoveredFaceIndex(faceIndex);
        }
      } else {
        setHoveredGroupIndex(null);
        setHoveredFaceIndex(null);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (event.button === 2) {
        if (hoveredGroupIndex !== null) {
          if (filletMode && selectedFilletFaces.length < 2) {
            addFilletFace(hoveredGroupIndex);
            console.log(`✅ Fillet face ${selectedFilletFaces.length + 1} selected:`, hoveredGroupIndex);

            if (selectedFilletFaces.length === 1) {
              console.log('🎯 Two faces selected! Ready for fillet operation. Enter radius in terminal.');
            }
          } else {
            setSelectedFaceIndex(hoveredGroupIndex);
            console.log('✅ Face group selected:', hoveredGroupIndex);
          }
        }
      }
    };

    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('mousedown', handleClick);

    return () => {
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('mousedown', handleClick);
    };
  }, [isActive, faces, faceGroups, hoveredGroupIndex, camera, raycaster, gl, setHoveredFaceIndex, setSelectedFaceIndex]);

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

  if (!isActive) return null;

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={shape.geometry}
        visible={false}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
      />

      {selectedFilletGeometries.map((geom, idx) => (
        <mesh
          key={`selected-${idx}`}
          geometry={geom}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      ))}

      {highlightGeometry && !selectedFilletFaces.includes(hoveredGroupIndex!) && (
        <mesh
          ref={highlightMeshRef}
          geometry={highlightGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}
    </>
  );
};
