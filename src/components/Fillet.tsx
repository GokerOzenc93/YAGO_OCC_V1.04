import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createGroupBoundaryEdges,
  createFaceDescriptor
} from './FaceEditor';
import { convertReplicadToThreeGeometry } from './ReplicadService';
import { getReplicadVertices } from './VertexEditorService';

export interface FilletData {
  face1Descriptor: any;
  face2Descriptor: any;
  face1Data: any;
  face2Data: any;
  radius: number;
  originalSize: {
    width: number;
    height: number;
    depth: number;
  };
}

export async function applyFilletToShape(
  shape: any,
  selectedFilletFaces: number[],
  selectedFilletFaceData: any[],
  radius: number
): Promise<{ geometry: THREE.BufferGeometry; replicadShape: any; filletData: FilletData }> {
  if (!shape || !shape.replicadShape) {
    throw new Error('Shape or replicadShape not found');
  }

  if (selectedFilletFaces.length !== 2 || selectedFilletFaceData.length !== 2) {
    throw new Error('Two faces must be selected for fillet operation');
  }

  console.log(`🔵 Applying fillet with radius ${radius} to faces:`, selectedFilletFaces);
  console.log('📍 Fillet - Current shape position:', shape.position);

  console.log('📐 Face 1 - Normal:', selectedFilletFaceData[0].normal, 'Center:', selectedFilletFaceData[0].center);
  console.log('📐 Face 2 - Normal:', selectedFilletFaceData[1].normal, 'Center:', selectedFilletFaceData[1].center);

  const face1Center = new THREE.Vector3(...selectedFilletFaceData[0].center);
  const face2Center = new THREE.Vector3(...selectedFilletFaceData[1].center);
  const face1Normal = new THREE.Vector3(...selectedFilletFaceData[0].normal);
  const face2Normal = new THREE.Vector3(...selectedFilletFaceData[1].normal);

  const faces = extractFacesFromGeometry(shape.geometry);
  const faceGroups = groupCoplanarFaces(faces);
  const group1 = faceGroups[selectedFilletFaces[0]];
  const group2 = faceGroups[selectedFilletFaces[1]];

  const face1Data = faces.find(f => group1.faceIndices.includes(f.faceIndex));
  const face2Data = faces.find(f => group2.faceIndices.includes(f.faceIndex));

  if (!face1Data || !face2Data) {
    throw new Error('Could not find face data for descriptors');
  }

  const face1Descriptor = createFaceDescriptor(face1Data, shape.geometry);
  const face2Descriptor = createFaceDescriptor(face2Data, shape.geometry);

  console.log('🆔 Face 1 Descriptor:', face1Descriptor);
  console.log('🆔 Face 2 Descriptor:', face2Descriptor);

  let replicadShape = shape.replicadShape;
  let edgeCount = 0;
  let foundEdgeCount = 0;

  const filletedShape = replicadShape.fillet((edge: any) => {
    edgeCount++;
    try {
      const start = edge.startPoint;
      const end = edge.endPoint;

      if (!start || !end) return null;

      const startVec = new THREE.Vector3(start.x, start.y, start.z);
      const endVec = new THREE.Vector3(end.x, end.y, end.z);
      const centerVec = new THREE.Vector3(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        (start.z + end.z) / 2
      );

      const maxDimension = Math.max(shape.parameters.width || 1, shape.parameters.height || 1, shape.parameters.depth || 1);
      const tolerance = maxDimension * 0.05;

      const startDistFace1 = Math.abs(startVec.clone().sub(face1Center).dot(face1Normal));
      const startDistFace2 = Math.abs(startVec.clone().sub(face2Center).dot(face2Normal));
      const endDistFace1 = Math.abs(endVec.clone().sub(face1Center).dot(face1Normal));
      const endDistFace2 = Math.abs(endVec.clone().sub(face2Center).dot(face2Normal));
      const centerDistFace1 = Math.abs(centerVec.clone().sub(face1Center).dot(face1Normal));
      const centerDistFace2 = Math.abs(centerVec.clone().sub(face2Center).dot(face2Normal));

      const allPointsOnFace1 = startDistFace1 < tolerance && endDistFace1 < tolerance && centerDistFace1 < tolerance;
      const allPointsOnFace2 = startDistFace2 < tolerance && endDistFace2 < tolerance && centerDistFace2 < tolerance;

      if (allPointsOnFace1 && allPointsOnFace2) {
        foundEdgeCount++;
        console.log('Found shared edge #' + foundEdgeCount + ' - applying fillet radius:', radius);
        console.log(`  Start: (${startVec.x.toFixed(2)}, ${startVec.y.toFixed(2)}, ${startVec.z.toFixed(2)})`);
        console.log(`  End: (${endVec.x.toFixed(2)}, ${endVec.y.toFixed(2)}, ${endVec.z.toFixed(2)})`);
        return radius;
      }

      return null;
    } catch (e) {
      console.error('Error checking edge:', e);
      return null;
    }
  });

  console.log('🔢 Total edges checked:', edgeCount);
  console.log('🔢 Edges selected for fillet:', foundEdgeCount);

  const newGeometry = convertReplicadToThreeGeometry(filletedShape);
  const newBaseVertices = await getReplicadVertices(filletedShape);

  const filletData: FilletData = {
    face1Descriptor,
    face2Descriptor,
    face1Data: selectedFilletFaceData[0],
    face2Data: selectedFilletFaceData[1],
    radius,
    originalSize: {
      width: shape.parameters.width || 1,
      height: shape.parameters.height || 1,
      depth: shape.parameters.depth || 1
    }
  };

  console.log(`✅ Fillet with radius ${radius} applied successfully!`);

  return {
    geometry: newGeometry,
    replicadShape: filletedShape,
    filletData
  };
}

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
