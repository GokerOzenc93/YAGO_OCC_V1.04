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
import { useResponsiveLineWidth } from '../hooks/useResponsiveLineWidth';

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
  const lineWidths = useResponsiveLineWidth();
  const groupRef = useRef<THREE.Group>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;

  useEffect(() => {
    console.log('🔷 FilletEdgeLines mounted/updated, shape.id:', shape.id, 'groupRef.current:', groupRef.current);
  }, [shape.id]);

  useEffect(() => {
    if (groupRef.current && shape) {
      console.log('🔷 FilletEdgeLines - Setting transform:', { position: shape.position, shape_id: shape.id });
      groupRef.current.position.set(shape.position[0], shape.position[1], shape.position[2]);
      groupRef.current.rotation.set(shape.rotation[0], shape.rotation[1], shape.rotation[2]);
      groupRef.current.scale.set(shape.scale[0], shape.scale[1], shape.scale[2]);
    } else {
      console.warn('🔷 FilletEdgeLines - groupRef not set or shape missing');
    }
  }, [shape.position, shape.rotation, shape.scale, shape.id]);

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

  const faces = useMemo(() => {
    if (!shape.geometry) return [];
    try {
      const extracted = extractFacesFromGeometry(shape.geometry);
      console.log(`🔷 FilletEdgeLines - Extracted ${extracted.length} faces from geometry uuid: ${shape.geometry.uuid}`);
      if (extracted.length > 0) {
        console.log('🔷 First face center:', extracted[0].center);
      }
      return extracted;
    } catch (e) {
      console.error('🔷 Error extracting faces:', e);
      return [];
    }
  }, [shape.geometry, shape.geometry?.uuid, shape.fillets?.length, shape.replicadShape, shape.parameters?.width, shape.parameters?.height, shape.parameters?.depth]);

  const faceGroups = useMemo(() => {
    if (faces.length === 0) return [];
    return groupCoplanarFaces(faces);
  }, [faces]);

  const boundaryEdgesGeometry = useMemo(() => {
    if (faces.length === 0 || faceGroups.length === 0) {
      console.warn('🔷 No boundary edges: faces.length=', faces.length, 'faceGroups.length=', faceGroups.length);
      return null;
    }
    const geom = createGroupBoundaryEdges(faces, faceGroups);
    console.log('🔷 Created boundary edges geometry, faces:', faces.length, 'groups:', faceGroups.length);
    return geom;
  }, [faces, faceGroups]);

  if (!boundaryEdgesGeometry) {
    console.warn('🔷 FilletEdgeLines - No boundaryEdgesGeometry, returning null');
    return null;
  }

  console.log('🔷 FilletEdgeLines - Rendering group with geometry', shape.id);
  return (
    <group ref={groupRef}>
      <lineSegments geometry={boundaryEdgesGeometry}>
        <lineBasicMaterial color={0x00ffff} linewidth={lineWidths.normal} transparent opacity={0.8} />
      </lineSegments>
    </group>
  );
};
