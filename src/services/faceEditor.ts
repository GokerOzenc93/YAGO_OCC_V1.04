import * as THREE from 'three';

export interface FaceData {
  faceIndex: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  vertices: THREE.Vector3[];
  area: number;
  isCurved?: boolean;
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

function checkIfCurved(face: FaceData, faces: FaceData[], adjacencyMap: Map<number, Set<number>>): boolean {
  const neighbors = adjacencyMap.get(face.faceIndex);
  if (!neighbors || neighbors.size === 0) return false;

  let maxAngleDiff = 0;
  for (const neighborIdx of neighbors) {
    const neighbor = faces[neighborIdx];
    const dot = face.normal.dot(neighbor.normal);
    const angleDiff = Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI);
    maxAngleDiff = Math.max(maxAngleDiff, angleDiff);
  }

  return maxAngleDiff > 0.5 && maxAngleDiff < 45;
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

  faces.forEach((face, idx) => {
    face.isCurved = checkIfCurved(face, faces, adjacencyMap);
  });

  const thresholdDot = Math.cos((thresholdAngleDegrees * Math.PI) / 180);

  for (let startIdx = 0; startIdx < faces.length; startIdx++) {
    if (visited.has(startIdx)) continue;

    const currentGroup: number[] = [startIdx];
    visited.add(startIdx);

    const stack: number[] = [startIdx];
    const startFace = faces[startIdx];
    const isCurvedGroup = startFace.isCurved || false;

    while (stack.length > 0) {
      const currIdx = stack.pop()!;
      const currFace = faces[currIdx];

      const neighbors = adjacencyMap.get(currIdx);
      if (!neighbors) continue;

      for (const neighborIdx of neighbors) {
        if (visited.has(neighborIdx)) continue;

        const neighborFace = faces[neighborIdx];

        if ((neighborFace.isCurved || false) !== isCurvedGroup) {
          continue;
        }

        const dot = currFace.normal.dot(neighborFace.normal);
        const angle = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;

        const effectiveThreshold = isCurvedGroup ? 25 : thresholdAngleDegrees;

        if (angle < effectiveThreshold) {
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
