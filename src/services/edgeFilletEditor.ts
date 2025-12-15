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
      const tolerance = 5;

      const edgeFilter = (edge: any) => {
        try {
          const start = edge.startPoint;
          const end = edge.endPoint;

          if (!start || !end) return false;

          const edgeStartVec = new THREE.Vector3(start[0], start[1], start[2]);
          const edgeEndVec = new THREE.Vector3(end[0], end[1], end[2]);

          const startMatch = edgeStartVec.distanceTo(edgeStart) < tolerance && edgeEndVec.distanceTo(edgeEnd) < tolerance;
          const reverseMatch = edgeStartVec.distanceTo(edgeEnd) < tolerance && edgeEndVec.distanceTo(edgeStart) < tolerance;

          const match = startMatch || reverseMatch;

          if (match) {
            console.log('✅ Edge matched!', {
              edgeStart: [start[0].toFixed(1), start[1].toFixed(1), start[2].toFixed(1)],
              edgeEnd: [end[0].toFixed(1), end[1].toFixed(1), end[2].toFixed(1)],
              targetStart: [edgeStart.x.toFixed(1), edgeStart.y.toFixed(1), edgeStart.z.toFixed(1)],
              targetEnd: [edgeEnd.x.toFixed(1), edgeEnd.y.toFixed(1), edgeEnd.z.toFixed(1)]
            });
          }

          return match;
        } catch (e) {
          return false;
        }
      };

      const filletedShape = replicadShape.fillet(radius, edgeFilter);

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
