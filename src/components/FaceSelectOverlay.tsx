import React, { useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';

interface FaceSelectOverlayProps {
  shape: any;
}

export const FaceSelectOverlay: React.FC<FaceSelectOverlayProps> = React.memo(({ shape }) => {
  const {
    extraRowFaceSelectMode,
    extraRowHoveredFaceGroup,
    setExtraRowHoveredFaceGroup,
    confirmExtraRowFace
  } = useAppStore(useShallow(state => ({
    extraRowFaceSelectMode: state.extraRowFaceSelectMode,
    extraRowHoveredFaceGroup: state.extraRowHoveredFaceGroup,
    setExtraRowHoveredFaceGroup: state.setExtraRowHoveredFaceGroup,
    confirmExtraRowFace: state.confirmExtraRowFace
  })));

  const geometry = shape.geometry;

  const { faces, faceGroups } = useMemo(() => {
    if (!geometry) return { faces: [], faceGroups: [] };
    const f = extractFacesFromGeometry(geometry);
    const g = groupCoplanarFaces(f);
    return { faces: f, faceGroups: g };
  }, [geometry]);

  const groupMap = useMemo(() => {
    const map: number[] = new Array(faces.length).fill(-1);
    faceGroups.forEach((group, gi) => {
      group.faceIndices.forEach(fi => {
        map[fi] = gi;
      });
    });
    return map;
  }, [faces, faceGroups]);

  const highlightGeometry = useMemo(() => {
    const activeGroup = extraRowHoveredFaceGroup;
    if (activeGroup === null || activeGroup >= faceGroups.length) return null;
    const group = faceGroups[activeGroup];
    const vertices: number[] = [];
    group.faceIndices.forEach(fi => {
      const face = faces[fi];
      face.vertices.forEach(v => {
        vertices.push(v.x, v.y, v.z);
      });
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }, [extraRowHoveredFaceGroup, faces, faceGroups]);

  const handlePointerMove = useCallback((e: any) => {
    if (!extraRowFaceSelectMode) return;
    e.stopPropagation();
    if (e.faceIndex !== undefined) {
      const gi = groupMap[e.faceIndex];
      if (gi >= 0 && gi !== extraRowHoveredFaceGroup) {
        setExtraRowHoveredFaceGroup(gi);
      }
    }
  }, [extraRowFaceSelectMode, groupMap, extraRowHoveredFaceGroup, setExtraRowHoveredFaceGroup]);

  const handlePointerOut = useCallback(() => {
    if (!extraRowFaceSelectMode) return;
    setExtraRowHoveredFaceGroup(null);
  }, [extraRowFaceSelectMode, setExtraRowHoveredFaceGroup]);

  const handleClick = useCallback((e: any) => {
    if (!extraRowFaceSelectMode) return;
    e.stopPropagation();
    if (e.faceIndex !== undefined) {
      const gi = groupMap[e.faceIndex];
      if (gi >= 0) {
        setExtraRowHoveredFaceGroup(gi);
      }
    }
  }, [extraRowFaceSelectMode, groupMap, setExtraRowHoveredFaceGroup]);

  const handleContextMenu = useCallback((e: any) => {
    if (!extraRowFaceSelectMode) return;
    e.stopPropagation();
    e.nativeEvent?.preventDefault?.();
    if (extraRowHoveredFaceGroup !== null) {
      confirmExtraRowFace(extraRowHoveredFaceGroup);
    }
  }, [extraRowFaceSelectMode, extraRowHoveredFaceGroup, confirmExtraRowFace]);

  if (!extraRowFaceSelectMode || !geometry) return null;

  return (
    <>
      <mesh
        geometry={geometry}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        raycast={THREE.Mesh.prototype.raycast}
      >
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {highlightGeometry && (
        <mesh geometry={highlightGeometry} renderOrder={999}>
          <meshBasicMaterial
            color="#eab308"
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      )}
    </>
  );
});
