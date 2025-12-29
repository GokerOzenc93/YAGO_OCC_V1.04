import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createGroupBoundaryEdges
} from '../services/faceEditor';

interface FilletEdgeLinesProps {
  shape: any;
}

export const FilletEdgeLines: React.FC<FilletEdgeLinesProps> = ({ shape }) => {
  const groupRef = useRef<THREE.Group>(null);
  const shapeRef = useRef(shape);

  useEffect(() => {
    shapeRef.current = shape;
  }, [shape]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(shape.position[0], shape.position[1], shape.position[2]);
      groupRef.current.rotation.set(shape.rotation[0], shape.rotation[1], shape.rotation[2]);
      groupRef.current.scale.set(shape.scale[0], shape.scale[1], shape.scale[2]);
    }
  }, [shape.position, shape.rotation, shape.scale]);

  useFrame(() => {
    if (groupRef.current) {
      const s = shapeRef.current;
      groupRef.current.position.set(s.position[0], s.position[1], s.position[2]);
      groupRef.current.rotation.set(s.rotation[0], s.rotation[1], s.rotation[2]);
      groupRef.current.scale.set(s.scale[0], s.scale[1], s.scale[2]);
    }
  });

  const boundaryEdgesGeometry = useMemo(() => {
    if (!shape.geometry) return null;
    try {
      const faces = extractFacesFromGeometry(shape.geometry);
      if (faces.length === 0) return null;
      const faceGroups = groupCoplanarFaces(faces);
      if (faceGroups.length === 0) return null;
      return createGroupBoundaryEdges(faces, faceGroups);
    } catch (e) {
      return null;
    }
  }, [shape.geometry, shape.geometry?.uuid, shape.fillets?.length, shape.replicadShape, shape.parameters?.width, shape.parameters?.height, shape.parameters?.depth]);

  if (!boundaryEdgesGeometry) return null;

  return (
    <group ref={groupRef}>
      <lineSegments geometry={boundaryEdgesGeometry}>
        <lineBasicMaterial color={0x00ffff} linewidth={2} transparent opacity={0.8} />
      </lineSegments>
    </group>
  );
};
