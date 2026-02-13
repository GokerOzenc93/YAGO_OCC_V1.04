import React, { useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';

interface ExtraPanelFaceSelectorProps {
  geometry: THREE.BufferGeometry;
  shapeId: string;
  onFaceSelect: (faceIndex: number) => void;
  onFaceConfirm: (faceIndex: number) => void;
  highlightedFace: number | null;
}

export function ExtraPanelFaceSelector({
  geometry,
  shapeId,
  onFaceSelect,
  onFaceConfirm,
  highlightedFace
}: ExtraPanelFaceSelectorProps) {
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);

  const { faces, faceGroups } = useMemo(() => {
    const extractedFaces = extractFacesFromGeometry(geometry);
    const groups = groupCoplanarFaces(extractedFaces);
    return { faces: extractedFaces, faceGroups: groups };
  }, [geometry]);

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const faceIndex = e.faceIndex;

    if (faceIndex !== undefined) {
      const groupIndex = faceGroups.findIndex(group =>
        group.faceIndices.includes(faceIndex)
      );

      if (groupIndex !== -1) {
        setHoveredFace(groupIndex);
      }
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredFace(null);
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (hoveredFace !== null) {
      onFaceSelect(hoveredFace);
    }
  };

  const handleContextMenu = (e: any) => {
    e.stopPropagation();
    if (highlightedFace !== null) {
      onFaceConfirm(highlightedFace);
    }
  };

  const displayFaceIndex = highlightedFace !== null ? highlightedFace : hoveredFace;

  return (
    <mesh
      geometry={geometry}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <meshBasicMaterial
        color={displayFaceIndex !== null ? "#ff0000" : "#ffffff"}
        opacity={displayFaceIndex !== null ? 0.3 : 0}
        transparent
        side={THREE.DoubleSide}
        depthTest={false}
      />
    </mesh>
  );
}
