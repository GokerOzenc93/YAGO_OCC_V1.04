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
  type: 'planar' | 'curved' | 'angulated';
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

function isCurvedSurface(
  faces: FaceData[],
  faceIndex: number,
  processed: Set<number>
): boolean {
  const face = faces[faceIndex];

  for (let i = 0; i < faces.length; i++) {
    if (i === faceIndex || processed.has(i)) continue;

    const candidate = faces[i];
    if (areVerticesShared(face, candidate)) {
      const normalDot = face.normal.dot(candidate.normal);
      if (normalDot < 0.999) {
        return true;
      }
    }
  }

  return false;
}

function expandGroupWithNeighbors(
  faces: FaceData[],
  group: CoplanarFaceGroup,
  processed: Set<number>,
  normalDotThreshold: number = 0.2
): void {
  let addedNew = true;
  let iterations = 0;
  const maxIterations = 100;

  while (addedNew && iterations < maxIterations) {
    addedNew = false;
    iterations++;

    for (let i = 0; i < faces.length; i++) {
      if (processed.has(i)) continue;

      const candidate = faces[i];
      let isNeighbor = false;

      for (const groupFaceIdx of group.faceIndices) {
        const groupFace = faces[groupFaceIdx];
        if (areVerticesShared(groupFace, candidate)) {
          isNeighbor = true;
          break;
        }
      }

      if (isNeighbor) {
        let maxDot = -1;
        for (const groupFaceIdx of group.faceIndices) {
          const dot = faces[groupFaceIdx].normal.dot(candidate.normal);
          maxDot = Math.max(maxDot, dot);
        }

        if (maxDot > normalDotThreshold && maxDot < 0.999) {
          group.faceIndices.push(i);
          group.totalArea += candidate.area;
          processed.add(i);
          addedNew = true;
        }
      }
    }
  }
}

function groupPlanarFaces(
  faces: FaceData[],
  processed: Set<number>,
  normalThreshold: number = 0.98,
  distanceThreshold: number = 0.5
): CoplanarFaceGroup[] {
  const groups: CoplanarFaceGroup[] = [];

  for (let i = 0; i < faces.length; i++) {
    if (processed.has(i)) continue;

    const face = faces[i];
    const group: CoplanarFaceGroup = {
      normal: face.normal.clone(),
      faceIndices: [i],
      center: face.center.clone(),
      totalArea: face.area,
      type: 'planar'
    };

    processed.add(i);

    let addedNew = true;
    while (addedNew) {
      addedNew = false;

      for (let j = 0; j < faces.length; j++) {
        if (processed.has(j)) continue;

        const otherFace = faces[j];
        let isConnected = false;

        for (const groupIdx of group.faceIndices) {
          const groupFace = faces[groupIdx];
          const normalDot = groupFace.normal.dot(otherFace.normal);

          if (normalDot > normalThreshold) {
            const distance = Math.abs(
              otherFace.center.clone().sub(groupFace.center).dot(groupFace.normal)
            );

            if (distance < distanceThreshold || areVerticesShared(groupFace, otherFace, 0.01)) {
              isConnected = true;
              break;
            }
          }
        }

        if (isConnected) {
          group.faceIndices.push(j);
          group.totalArea += otherFace.area;
          processed.add(j);
          addedNew = true;
        }
      }
    }

    const avgCenter = new THREE.Vector3();
    const avgNormal = new THREE.Vector3();
    group.faceIndices.forEach(idx => {
      avgCenter.add(faces[idx].center);
      avgNormal.add(faces[idx].normal);
    });
    avgCenter.divideScalar(group.faceIndices.length);
    avgNormal.divideScalar(group.faceIndices.length).normalize();
    group.center = avgCenter;
    group.normal = avgNormal;

    groups.push(group);
  }

  return groups;
}

function groupCurvedFaces(
  faces: FaceData[],
  processed: Set<number>,
  normalDotRange: [number, number] = [0.7, 0.98]
): CoplanarFaceGroup[] {
  const groups: CoplanarFaceGroup[] = [];

  for (let i = 0; i < faces.length; i++) {
    if (processed.has(i)) continue;

    const face = faces[i];
    const group: CoplanarFaceGroup = {
      normal: face.normal.clone(),
      faceIndices: [i],
      center: face.center.clone(),
      totalArea: face.area,
      type: 'curved'
    };

    processed.add(i);

    let addedNew = true;
    while (addedNew) {
      addedNew = false;

      for (let j = 0; j < faces.length; j++) {
        if (processed.has(j)) continue;

        const otherFace = faces[j];
        let isConnected = false;

        for (const groupIdx of group.faceIndices) {
          const groupFace = faces[groupIdx];

          if (areVerticesShared(groupFace, otherFace, 0.01)) {
            const normalDot = Math.abs(groupFace.normal.dot(otherFace.normal));

            if (normalDot >= normalDotRange[0] && normalDot < normalDotRange[1]) {
              isConnected = true;
              break;
            }
          }
        }

        if (isConnected) {
          group.faceIndices.push(j);
          group.totalArea += otherFace.area;
          processed.add(j);
          addedNew = true;
        }
      }
    }

    if (group.faceIndices.length > 1) {
      const avgCenter = new THREE.Vector3();
      const avgNormal = new THREE.Vector3();
      group.faceIndices.forEach(idx => {
        avgCenter.add(faces[idx].center);
        avgNormal.add(faces[idx].normal);
      });
      avgCenter.divideScalar(group.faceIndices.length);
      avgNormal.divideScalar(group.faceIndices.length).normalize();
      group.center = avgCenter;
      group.normal = avgNormal;

      groups.push(group);
    } else {
      processed.delete(i);
    }
  }

  return groups;
}

function groupAngulatedFaces(
  faces: FaceData[],
  processed: Set<number>,
  normalDotThreshold: number = 0.3
): CoplanarFaceGroup[] {
  const groups: CoplanarFaceGroup[] = [];

  for (let i = 0; i < faces.length; i++) {
    if (processed.has(i)) continue;

    const face = faces[i];
    const group: CoplanarFaceGroup = {
      normal: face.normal.clone(),
      faceIndices: [i],
      center: face.center.clone(),
      totalArea: face.area,
      type: 'angulated'
    };

    processed.add(i);

    let addedNew = true;
    while (addedNew) {
      addedNew = false;

      for (let j = 0; j < faces.length; j++) {
        if (processed.has(j)) continue;

        const otherFace = faces[j];
        let isConnected = false;

        for (const groupIdx of group.faceIndices) {
          const groupFace = faces[groupIdx];

          if (areVerticesShared(groupFace, otherFace, 0.01)) {
            const normalDot = Math.abs(groupFace.normal.dot(otherFace.normal));

            if (normalDot >= normalDotThreshold) {
              isConnected = true;
              break;
            }
          }
        }

        if (isConnected) {
          group.faceIndices.push(j);
          group.totalArea += otherFace.area;
          processed.add(j);
          addedNew = true;
        }
      }
    }

    if (group.faceIndices.length > 1) {
      const avgCenter = new THREE.Vector3();
      const avgNormal = new THREE.Vector3();
      group.faceIndices.forEach(idx => {
        avgCenter.add(faces[idx].center);
        avgNormal.add(faces[idx].normal);
      });
      avgCenter.divideScalar(group.faceIndices.length);
      avgNormal.divideScalar(group.faceIndices.length).normalize();
      group.center = avgCenter;
      group.normal = avgNormal;

      groups.push(group);
    } else {
      processed.delete(i);
    }
  }

  return groups;
}

export function groupCoplanarFaces(
  faces: FaceData[],
  normalThreshold: number = 0.98,
  distanceThreshold: number = 0.5
): CoplanarFaceGroup[] {
  const allGroups: CoplanarFaceGroup[] = [];
  const processed = new Set<number>();

  const planarGroups = groupPlanarFaces(faces, processed, normalThreshold, distanceThreshold);
  allGroups.push(...planarGroups);

  const curvedGroups = groupCurvedFaces(faces, processed, [0.7, 0.98]);
  allGroups.push(...curvedGroups);

  const angulatedGroups = groupAngulatedFaces(faces, processed, 0.3);
  allGroups.push(...angulatedGroups);

  return allGroups;
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
