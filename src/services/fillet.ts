import * as THREE from 'three';
import { initReplicad, convertReplicadToThreeGeometry } from './replicad';

export interface EdgeInfo {
  index: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  midpoint: THREE.Vector3;
  replicadEdge?: any;
}

export interface FilletOperation {
  edgeIndex: number;
  radius: number;
  description: string;
}

export const getEdgesFromReplicadShape = async (replicadShape: any): Promise<EdgeInfo[]> => {
  await initReplicad();

  console.log('🔍 Extracting edges from Replicad shape...');

  try {
    const edges = replicadShape.edges();
    console.log(`✅ Found ${edges.length} edges in shape`);

    const edgeInfos: EdgeInfo[] = [];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];

      try {
        const start = edge.startPoint;
        const end = edge.endPoint;

        const startVec = new THREE.Vector3(start.x, start.y, start.z);
        const endVec = new THREE.Vector3(end.x, end.y, end.z);
        const midpoint = new THREE.Vector3().lerpVectors(startVec, endVec, 0.5);

        edgeInfos.push({
          index: i,
          start: startVec,
          end: endVec,
          midpoint,
          replicadEdge: edge
        });

        console.log(`  Edge ${i}: [${startVec.x.toFixed(1)}, ${startVec.y.toFixed(1)}, ${startVec.z.toFixed(1)}] → [${endVec.x.toFixed(1)}, ${endVec.y.toFixed(1)}, ${endVec.z.toFixed(1)}]`);
      } catch (error) {
        console.warn(`⚠️ Could not process edge ${i}:`, error);
      }
    }

    return edgeInfos;
  } catch (error) {
    console.error('❌ Failed to extract edges:', error);
    return [];
  }
};

export const findClosestEdge = (
  clickPoint: THREE.Vector3,
  edges: EdgeInfo[],
  threshold: number = 50
): EdgeInfo | null => {
  let closestEdge: EdgeInfo | null = null;
  let minDistance = threshold;

  console.log('🎯 Finding closest edge to click point:', clickPoint);

  for (const edge of edges) {
    const distanceToStart = clickPoint.distanceTo(edge.start);
    const distanceToEnd = clickPoint.distanceTo(edge.end);
    const distanceToMidpoint = clickPoint.distanceTo(edge.midpoint);

    const minEdgeDistance = Math.min(distanceToStart, distanceToEnd, distanceToMidpoint);

    if (minEdgeDistance < minDistance) {
      minDistance = minEdgeDistance;
      closestEdge = edge;
    }
  }

  if (closestEdge) {
    console.log(`✅ Found closest edge: #${closestEdge.index} (distance: ${minDistance.toFixed(1)})`);
  } else {
    console.log('❌ No edge found within threshold');
  }

  return closestEdge;
};

export const applyFilletToShape = async (
  replicadShape: any,
  edgeIndices: number[],
  radius: number
): Promise<any> => {
  await initReplicad();

  console.log('🔨 Applying fillet operation...', {
    edgeIndices,
    radius
  });

  try {
    const allEdges = replicadShape.edges();
    const selectedEdges = edgeIndices.map(idx => allEdges[idx]).filter(e => e !== undefined);

    if (selectedEdges.length === 0) {
      throw new Error('No valid edges selected for fillet operation');
    }

    console.log(`✅ Selected ${selectedEdges.length} edge(s) for filleting`);

    const filletedShape = replicadShape.fillet(radius, selectedEdges);

    console.log('✅ Fillet operation completed successfully');

    return filletedShape;
  } catch (error) {
    console.error('❌ Fillet operation failed:', error);
    throw error;
  }
};

export const createEdgeVisualization = (edges: EdgeInfo[]): THREE.BufferGeometry[] => {
  const geometries: THREE.BufferGeometry[] = [];

  for (const edge of edges) {
    const points = [edge.start, edge.end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometries.push(geometry);
  }

  return geometries;
};

export const createEdgeSphereMarkers = (edges: EdgeInfo[]): THREE.Vector3[] => {
  const markers: THREE.Vector3[] = [];

  for (const edge of edges) {
    markers.push(edge.midpoint);
  }

  return markers;
};
