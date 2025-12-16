import * as THREE from 'three';

export interface FaceInfo {
  faceIndex: number;
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  vertices: THREE.Vector3[];
}

export function getFacesFromGeometry(geometry: THREE.BufferGeometry): FaceInfo[] {
  const positionAttribute = geometry.getAttribute('position');
  const faces: FaceInfo[] = [];

  for (let i = 0; i < positionAttribute.count; i += 3) {
    const v1 = new THREE.Vector3(
      positionAttribute.getX(i),
      positionAttribute.getY(i),
      positionAttribute.getZ(i)
    );
    const v2 = new THREE.Vector3(
      positionAttribute.getX(i + 1),
      positionAttribute.getY(i + 1),
      positionAttribute.getZ(i + 1)
    );
    const v3 = new THREE.Vector3(
      positionAttribute.getX(i + 2),
      positionAttribute.getY(i + 2),
      positionAttribute.getZ(i + 2)
    );

    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    const centroid = new THREE.Vector3()
      .addVectors(v1, v2)
      .add(v3)
      .divideScalar(3);

    faces.push({
      faceIndex: Math.floor(i / 3),
      normal,
      centroid,
      vertices: [v1, v2, v3]
    });
  }

  return faces;
}

export function findCommonEdge(face1: FaceInfo, face2: FaceInfo): { edge: [THREE.Vector3, THREE.Vector3] } | null {
  const tolerance = 0.01;

  for (let i = 0; i < face1.vertices.length; i++) {
    const v1a = face1.vertices[i];
    const v1b = face1.vertices[(i + 1) % face1.vertices.length];

    for (let j = 0; j < face2.vertices.length; j++) {
      const v2a = face2.vertices[j];
      const v2b = face2.vertices[(j + 1) % face2.vertices.length];

      if (
        (v1a.distanceTo(v2a) < tolerance && v1b.distanceTo(v2b) < tolerance) ||
        (v1a.distanceTo(v2b) < tolerance && v1b.distanceTo(v2a) < tolerance)
      ) {
        return { edge: [v1a.clone(), v1b.clone()] };
      }
    }
  }

  return null;
}

export async function applyFilletToEdge(
  replicadShape: any,
  edge: [THREE.Vector3, THREE.Vector3],
  radius: number
): Promise<any> {
  try {
    console.log('🔨 Applying fillet:', { radius, edge });

    const edgeMidpoint = new THREE.Vector3()
      .addVectors(edge[0], edge[1])
      .divideScalar(2);

    console.log('📍 Edge midpoint:', edgeMidpoint.toArray());

    if (typeof replicadShape.fillet === 'function') {
      const edges = replicadShape.edges();
      console.log(`🔍 Found ${edges.length} edges in shape`);

      let closestEdge = null;
      let minDistance = Infinity;

      for (const replicadEdge of edges) {
        const edgeStartPoint = replicadEdge.startPoint();
        const edgeEndPoint = replicadEdge.endPoint();

        const replicadMidpoint = [
          (edgeStartPoint[0] + edgeEndPoint[0]) / 2,
          (edgeStartPoint[1] + edgeEndPoint[1]) / 2,
          (edgeStartPoint[2] + edgeEndPoint[2]) / 2
        ];

        const distance = Math.sqrt(
          Math.pow(edgeMidpoint.x - replicadMidpoint[0], 2) +
          Math.pow(edgeMidpoint.y - replicadMidpoint[1], 2) +
          Math.pow(edgeMidpoint.z - replicadMidpoint[2], 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestEdge = replicadEdge;
        }
      }

      if (closestEdge && minDistance < 10) {
        console.log(`✅ Found closest edge at distance ${minDistance.toFixed(2)}`);
        const filletedShape = replicadShape.fillet(radius, (edge: any) => edge === closestEdge);
        console.log('✅ Fillet applied successfully');
        return filletedShape;
      } else {
        console.warn('⚠️ No close edge found for fillet');
        return replicadShape;
      }
    } else {
      console.warn('⚠️ Fillet method not available on replicadShape');
      return replicadShape;
    }
  } catch (error) {
    console.error('❌ Failed to apply fillet:', error);
    return replicadShape;
  }
}
