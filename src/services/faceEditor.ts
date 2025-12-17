import * as THREE from 'three';

export interface FaceData {
  faceIndex: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  vertices: THREE.Vector3[];
  area: number;
}

export interface CoplanarFaceGroup {
  normal: THREE.Vector3;
  faceIndices: number[];
  center: THREE.Vector3;
  totalArea: number;
}

export function extractFacesFromGeometry(geometry: THREE.BufferGeometry): FaceData[] {
  const faces: FaceData[] = [];
  const positionAttribute = geometry.getAttribute('position');
  const indexAttribute = geometry.getIndex();

  if (!positionAttribute) {
    console.warn('No position attribute found in geometry');
    return faces;
  }

  const positions = positionAttribute.array as Float32Array;
  const indices = indexAttribute ? (indexAttribute.array as Uint16Array | Uint32Array) : null;

  const vertexCount = indices ? indices.length : positions.length / 3;
  const faceCount = Math.floor(vertexCount / 3);

  for (let i = 0; i < faceCount; i++) {
    const i0 = indices ? indices[i * 3] : i * 3;
    const i1 = indices ? indices[i * 3 + 1] : i * 3 + 1;
    const i2 = indices ? indices[i * 3 + 2] : i * 3 + 2;

    const v0 = new THREE.Vector3(
      positions[i0 * 3],
      positions[i0 * 3 + 1],
      positions[i0 * 3 + 2]
    );
    const v1 = new THREE.Vector3(
      positions[i1 * 3],
      positions[i1 * 3 + 1],
      positions[i1 * 3 + 2]
    );
    const v2 = new THREE.Vector3(
      positions[i2 * 3],
      positions[i2 * 3 + 1],
      positions[i2 * 3 + 2]
    );

    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    const center = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(v2)
      .divideScalar(3);

    const area = edge1.cross(edge2).length() / 2;

    faces.push({
      faceIndex: i,
      normal,
      center,
      vertices: [v0, v1, v2],
      area
    });
  }

  return faces;
}

function areVerticesShared(face1: FaceData, face2: FaceData, tolerance: number = 0.001): boolean {
  for (const v1 of face1.vertices) {
    for (const v2 of face2.vertices) {
      if (v1.distanceTo(v2) < tolerance) {
        return true;
      }
    }
  }
  return false;
}

function buildAdjacencyMap(faces: FaceData[]): Map<number, Set<number>> {
  const adjacencyMap = new Map<number, Set<number>>();

  for (let i = 0; i < faces.length; i++) {
    adjacencyMap.set(i, new Set<number>());
  }

  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      if (areVerticesShared(faces[i], faces[j])) {
        adjacencyMap.get(i)!.add(j);
        adjacencyMap.get(j)!.add(i);
      }
    }
  }

  return adjacencyMap;
}

export function groupCoplanarFaces(
  faces: FaceData[],
  thresholdAngleDegrees: number = 10
): CoplanarFaceGroup[] {
  const groups: CoplanarFaceGroup[] = [];
  const visited = new Set<number>();
  const adjacencyMap = buildAdjacencyMap(faces);

  const thresholdDot = Math.cos((thresholdAngleDegrees * Math.PI) / 180);

  for (let startIdx = 0; startIdx < faces.length; startIdx++) {
    if (visited.has(startIdx)) continue;

    const currentGroup: number[] = [startIdx];
    visited.add(startIdx);

    const stack: number[] = [startIdx];

    while (stack.length > 0) {
      const currIdx = stack.pop()!;
      const currFace = faces[currIdx];

      const neighbors = adjacencyMap.get(currIdx);
      if (!neighbors) continue;

      for (const neighborIdx of neighbors) {
        if (visited.has(neighborIdx)) continue;

        const neighborFace = faces[neighborIdx];

        const dot = currFace.normal.dot(neighborFace.normal);
        const angle = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;

        if (angle < thresholdAngleDegrees) {
          visited.add(neighborIdx);
          currentGroup.push(neighborIdx);
          stack.push(neighborIdx);
        }
      }
    }

    const avgCenter = new THREE.Vector3();
    const avgNormal = new THREE.Vector3();
    let totalArea = 0;

    currentGroup.forEach(idx => {
      const face = faces[idx];
      avgCenter.add(face.center);
      avgNormal.add(face.normal);
      totalArea += face.area;
    });

    avgCenter.divideScalar(currentGroup.length);
    avgNormal.divideScalar(currentGroup.length).normalize();

    groups.push({
      normal: avgNormal,
      faceIndices: currentGroup,
      center: avgCenter,
      totalArea
    });
  }

  return groups;
}

export function findClosestFaceToRay(
  raycaster: THREE.Raycaster,
  mesh: THREE.Mesh,
  worldMatrix: THREE.Matrix4
): number | null {
  const intersects = raycaster.intersectObject(mesh, false);

  if (intersects.length === 0) {
    return null;
  }

  const closest = intersects[0];
  return closest.faceIndex !== undefined ? closest.faceIndex : null;
}

export function createFaceHighlightGeometry(
  faces: FaceData[],
  faceIndices: number[]
): THREE.BufferGeometry {
  const positions: number[] = [];

  faceIndices.forEach(faceIndex => {
    const face = faces[faceIndex];
    if (face) {
      face.vertices.forEach(vertex => {
        positions.push(vertex.x, vertex.y, vertex.z);
      });
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}

export function getFaceWorldPosition(
  face: FaceData,
  worldMatrix: THREE.Matrix4
): THREE.Vector3 {
  return face.center.clone().applyMatrix4(worldMatrix);
}

export function getFaceWorldNormal(
  face: FaceData,
  worldMatrix: THREE.Matrix4
): THREE.Vector3 {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
  return face.normal.clone().applyMatrix3(normalMatrix).normalize();
}

interface Edge {
  v1: THREE.Vector3;
  v2: THREE.Vector3;
}

function edgeKey(v1: THREE.Vector3, v2: THREE.Vector3): string {
  const sorted = [v1, v2].sort((a, b) => {
    if (Math.abs(a.x - b.x) > 0.001) return a.x - b.x;
    if (Math.abs(a.y - b.y) > 0.001) return a.y - b.y;
    return a.z - b.z;
  });
  return `${sorted[0].x.toFixed(3)},${sorted[0].y.toFixed(3)},${sorted[0].z.toFixed(3)}-${sorted[1].x.toFixed(3)},${sorted[1].y.toFixed(3)},${sorted[1].z.toFixed(3)}`;
}

export function extractGroupBoundaryEdges(
  faces: FaceData[],
  group: CoplanarFaceGroup,
  allGroups: CoplanarFaceGroup[]
): Edge[] {
  const edges: Edge[] = [];
  const edgeCount = new Map<string, number>();
  const groupFaceSet = new Set(group.faceIndices);

  group.faceIndices.forEach(faceIdx => {
    const face = faces[faceIdx];
    const faceEdges = [
      [face.vertices[0], face.vertices[1]],
      [face.vertices[1], face.vertices[2]],
      [face.vertices[2], face.vertices[0]]
    ];

    faceEdges.forEach(([v1, v2]) => {
      const key = edgeKey(v1, v2);
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    });
  });

  const adjacencyMap = new Map<number, Set<number>>();
  faces.forEach((face, i) => {
    adjacencyMap.set(i, new Set());
    faces.forEach((otherFace, j) => {
      if (i !== j && areVerticesShared(face, otherFace)) {
        adjacencyMap.get(i)!.add(j);
      }
    });
  });

  group.faceIndices.forEach(faceIdx => {
    const face = faces[faceIdx];
    const neighbors = adjacencyMap.get(faceIdx);

    if (neighbors) {
      for (const neighborIdx of neighbors) {
        if (!groupFaceSet.has(neighborIdx)) {
          const neighborGroupIdx = allGroups.findIndex(g => g.faceIndices.includes(neighborIdx));
          if (neighborGroupIdx !== -1 && neighborGroupIdx !== allGroups.indexOf(group)) {
            const neighborFace = faces[neighborIdx];

            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                const v1 = face.vertices[i];
                const v2 = face.vertices[(i + 1) % 3];
                const nv1 = neighborFace.vertices[j];
                const nv2 = neighborFace.vertices[(j + 1) % 3];

                if ((v1.distanceTo(nv1) < 0.001 && v2.distanceTo(nv2) < 0.001) ||
                    (v1.distanceTo(nv2) < 0.001 && v2.distanceTo(nv1) < 0.001)) {
                  const key = edgeKey(v1, v2);
                  if (!edges.some(e => edgeKey(e.v1, e.v2) === key)) {
                    edges.push({ v1: v1.clone(), v2: v2.clone() });
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return edges;
}

export function createEdgeGeometry(edges: Edge[]): THREE.BufferGeometry {
  const positions: number[] = [];

  edges.forEach(edge => {
    positions.push(edge.v1.x, edge.v1.y, edge.v1.z);
    positions.push(edge.v2.x, edge.v2.y, edge.v2.z);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  return geometry;
}
