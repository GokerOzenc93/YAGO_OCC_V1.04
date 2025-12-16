import * as THREE from 'three';

export interface FaceInfo {
  faceIndex: number;
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  vertices: THREE.Vector3[];
  triangleIndices: number[];
}

export function getFacesFromGeometry(geometry: THREE.BufferGeometry): FaceInfo[] {
  const positionAttribute = geometry.getAttribute('position');
  const triangles: Array<{
    index: number;
    normal: THREE.Vector3;
    centroid: THREE.Vector3;
    vertices: THREE.Vector3[];
  }> = [];

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

    triangles.push({
      index: Math.floor(i / 3),
      normal,
      centroid,
      vertices: [v1, v2, v3]
    });
  }

  const faces: FaceInfo[] = [];
  const used = new Set<number>();
  const normalTolerance = 0.999;

  for (let i = 0; i < triangles.length; i++) {
    if (used.has(i)) continue;

    const triangle = triangles[i];
    const groupedTriangles = [i];
    const allVertices = [...triangle.vertices];
    used.add(i);

    for (let j = i + 1; j < triangles.length; j++) {
      if (used.has(j)) continue;

      const otherTriangle = triangles[j];
      const dotProduct = triangle.normal.dot(otherTriangle.normal);

      if (dotProduct > normalTolerance) {
        const d1 = triangle.normal.dot(triangle.centroid);
        const d2 = triangle.normal.dot(otherTriangle.centroid);

        if (Math.abs(d1 - d2) < 1) {
          groupedTriangles.push(j);
          allVertices.push(...otherTriangle.vertices);
          used.add(j);
        }
      }
    }

    const avgCentroid = new THREE.Vector3();
    groupedTriangles.forEach(idx => {
      avgCentroid.add(triangles[idx].centroid);
    });
    avgCentroid.divideScalar(groupedTriangles.length);

    faces.push({
      faceIndex: faces.length,
      normal: triangle.normal.clone(),
      centroid: avgCentroid,
      vertices: allVertices,
      triangleIndices: groupedTriangles
    });
  }

  console.log(`📐 Grouped ${triangles.length} triangles into ${faces.length} planar faces`);
  return faces;
}

export function findCommonEdge(face1: FaceInfo, face2: FaceInfo): { edge: [THREE.Vector3, THREE.Vector3] } | null {
  const tolerance = 0.1;
  const commonVertices: THREE.Vector3[] = [];

  for (const v1 of face1.vertices) {
    for (const v2 of face2.vertices) {
      if (v1.distanceTo(v2) < tolerance) {
        const isDuplicate = commonVertices.some(v => v.distanceTo(v1) < tolerance);
        if (!isDuplicate) {
          commonVertices.push(v1.clone());
        }
        break;
      }
    }
  }

  if (commonVertices.length >= 2) {
    console.log(`✅ Found common edge with ${commonVertices.length} common vertices`);
    return { edge: [commonVertices[0], commonVertices[1]] };
  }

  console.warn(`⚠️ No common edge found (only ${commonVertices.length} common vertices)`);
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
