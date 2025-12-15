import * as THREE from 'three';

export interface EdgeFilletModification {
  edgeIndex: number;
  radius: number;
  edgeStart: [number, number, number];
  edgeEnd: [number, number, number];
  description?: string;
}

export function extractEdgesFromGeometry(geometry: THREE.BufferGeometry): Array<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  index: number;
}> {
  const edges: Array<{ start: THREE.Vector3; end: THREE.Vector3; index: number }> = [];
  const edgesGeometry = new THREE.EdgesGeometry(geometry, 1);
  const positions = edgesGeometry.getAttribute('position');

  for (let i = 0; i < positions.count; i += 2) {
    const start = new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
    const end = new THREE.Vector3(
      positions.getX(i + 1),
      positions.getY(i + 1),
      positions.getZ(i + 1)
    );
    edges.push({ start, end, index: i / 2 });
  }

  return edges;
}

export function findClosestEdge(
  point: THREE.Vector3,
  edges: Array<{ start: THREE.Vector3; end: THREE.Vector3; index: number }>,
  threshold: number = 50
): number | null {
  let closestEdge: number | null = null;
  let minDistance = threshold;

  edges.forEach((edge) => {
    const line = new THREE.Line3(edge.start, edge.end);
    const closestPoint = new THREE.Vector3();
    line.closestPointToPoint(point, false, closestPoint);
    const distance = point.distanceTo(closestPoint);

    if (distance < minDistance) {
      minDistance = distance;
      closestEdge = edge.index;
    }
  });

  return closestEdge;
}

export async function applyFilletToShape(
  replicadShape: any,
  radius: number,
  edgeStart?: THREE.Vector3,
  edgeEnd?: THREE.Vector3
): Promise<any> {
  try {
    console.log(`🔨 Applying fillet with radius ${radius} to shape...`);

    if (edgeStart && edgeEnd) {
      const tolerance = 1;

      const filletedShape = replicadShape.fillet(radius, (edge: any) => {
        try {
          const edgeInfo = edge.info;
          if (!edgeInfo) return false;

          const start = new THREE.Vector3(
            edgeInfo.start[0],
            edgeInfo.start[1],
            edgeInfo.start[2]
          );
          const end = new THREE.Vector3(
            edgeInfo.end[0],
            edgeInfo.end[1],
            edgeInfo.end[2]
          );

          const startMatch = start.distanceTo(edgeStart) < tolerance;
          const endMatch = end.distanceTo(edgeEnd) < tolerance;
          const reverseMatch = start.distanceTo(edgeEnd) < tolerance && end.distanceTo(edgeStart) < tolerance;

          return startMatch && endMatch || reverseMatch;
        } catch (e) {
          return false;
        }
      });

      console.log('✅ Fillet applied to selected edge');
      return filletedShape;
    } else {
      const filletedShape = replicadShape.fillet(radius);
      console.log('✅ Fillet applied to all edges');
      return filletedShape;
    }
  } catch (error) {
    console.error('❌ Failed to apply fillet:', error);
    throw error;
  }
}

export function getEdgeMidpoint(
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Vector3 {
  return new THREE.Vector3(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2
  );
}
