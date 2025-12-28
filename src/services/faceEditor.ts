import * as THREE from 'three';

export interface FaceData {
  faceIndex: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  vertices: THREE.Vector3[];
  area: number;
  isCurved?: boolean;
  nativeFaceType?: string;
  nativeFaceIndex?: number;
}

export interface CoplanarFaceGroup {
  normal: THREE.Vector3;
  faceIndices: number[];
  center: THREE.Vector3;
  totalArea: number;
}

function isNativeCurved(nativeType: string | undefined): boolean {
  if (!nativeType) return false;

  const t = nativeType.toUpperCase();
  return (
    t.includes('CYLINDER') ||
    t.includes('SPHERE') ||
    t.includes('TORUS') ||
    t.includes('BSPLINE') ||
    t.includes('BEZIER')
  );
}

function getNativeFaceTypes(replicadShape: any): Map<number, string> {
  const faceTypeMap = new Map<number, string>();

  try {
    const nativeFaces = replicadShape.faces();
    console.log(`🔍 Analyzing ${nativeFaces.length} native CAD faces...`);

    nativeFaces.forEach((face: any, index: number) => {
      try {
        const surfaceType = face.geomType;
        faceTypeMap.set(index, surfaceType);
        console.log(`  Face ${index}: ${surfaceType}`);
      } catch (e) {
        faceTypeMap.set(index, 'UNKNOWN');
      }
    });
  } catch (error) {
    console.warn('⚠️ Could not extract native face types:', error);
  }

  return faceTypeMap;
}

interface NativeFaceVertexCache {
  faceIndex: number;
  faceType: string;
  vertexSet: Set<string>;
  boundingBox: THREE.Box3;
  isCurved: boolean;
}

let nativeFaceCache: NativeFaceVertexCache[] = [];
let cacheGeometryId: string | null = null;

export function clearNativeFaceCache() {
  nativeFaceCache = [];
  cacheGeometryId = null;
}

const MESH_TOLERANCE = 0.05;
const MESH_ANGULAR_TOLERANCE = 15;

function buildNativeFaceVertexCache(
  nativeFaces: any[],
  faceTypeMap: Map<number, string>,
  geometry: THREE.BufferGeometry
): NativeFaceVertexCache[] {
  const cache: NativeFaceVertexCache[] = [];

  const bbox = geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const vertexTolerance = Math.max(maxDim * 0.005, 0.5);

  for (let i = 0; i < nativeFaces.length; i++) {
    try {
      const nativeFace = nativeFaces[i];
      const faceType = faceTypeMap.get(i) || 'UNKNOWN';
      const isCurved = isNativeCurved(faceType);

      const mesh = nativeFace.mesh({ tolerance: MESH_TOLERANCE, angularTolerance: MESH_ANGULAR_TOLERANCE });
      if (!mesh.vertices || mesh.vertices.length === 0) continue;

      const vertexSet = new Set<string>();
      const faceBbox = new THREE.Box3();

      for (let j = 0; j < mesh.vertices.length; j += 3) {
        const x = mesh.vertices[j];
        const y = mesh.vertices[j + 1];
        const z = mesh.vertices[j + 2];

        const key = `${Math.round(x / vertexTolerance) * vertexTolerance}:${Math.round(y / vertexTolerance) * vertexTolerance}:${Math.round(z / vertexTolerance) * vertexTolerance}`;
        vertexSet.add(key);

        faceBbox.expandByPoint(new THREE.Vector3(x, y, z));
      }

      faceBbox.expandByScalar(vertexTolerance * 3);

      cache.push({
        faceIndex: i,
        faceType,
        vertexSet,
        boundingBox: faceBbox,
        isCurved
      });
    } catch (e) {
      continue;
    }
  }

  return cache;
}

function matchTriangleToNativeFace(
  triangleCenter: THREE.Vector3,
  triangleNormal: THREE.Vector3,
  nativeFaces: any[],
  faceTypeMap: Map<number, string>,
  geometry: THREE.BufferGeometry,
  triangleVertices?: THREE.Vector3[]
): { faceIndex: number; faceType: string } | null {
  const geomId = geometry.uuid;
  if (cacheGeometryId !== geomId || nativeFaceCache.length === 0) {
    nativeFaceCache = buildNativeFaceVertexCache(nativeFaces, faceTypeMap, geometry);
    cacheGeometryId = geomId;
  }

  const bbox = geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const vertexTolerance = Math.max(maxDim * 0.005, 0.5);

  let bestMatch = null;
  let bestScore = -1;

  for (const cached of nativeFaceCache) {
    if (!cached.boundingBox.containsPoint(triangleCenter)) {
      continue;
    }

    if (triangleVertices && triangleVertices.length === 3) {
      let matchCount = 0;

      for (const vertex of triangleVertices) {
        const key = `${Math.round(vertex.x / vertexTolerance) * vertexTolerance}:${Math.round(vertex.y / vertexTolerance) * vertexTolerance}:${Math.round(vertex.z / vertexTolerance) * vertexTolerance}`;
        if (cached.vertexSet.has(key)) {
          matchCount++;
        }
      }

      if (matchCount >= 2) {
        const score = matchCount * 10 + (cached.isCurved ? 5 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { faceIndex: cached.faceIndex, faceType: cached.faceType };
        }
      }
    } else {
      if (bestMatch === null) {
        bestMatch = { faceIndex: cached.faceIndex, faceType: cached.faceType };
      }
    }
  }

  if (!bestMatch) {
    let closestDist = Infinity;
    for (const cached of nativeFaceCache) {
      const dist = cached.boundingBox.distanceToPoint(triangleCenter);
      if (dist < closestDist) {
        closestDist = dist;
        bestMatch = { faceIndex: cached.faceIndex, faceType: cached.faceType };
      }
    }
  }

  return bestMatch;
}

export function extractFacesFromGeometry(geometry: THREE.BufferGeometry, replicadShape?: any): FaceData[] {
  clearNativeFaceCache();

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

  let nativeFaces: any[] = [];
  let faceTypeMap = new Map<number, string>();

  if (replicadShape) {
    try {
      nativeFaces = replicadShape.faces();
      faceTypeMap = getNativeFaceTypes(replicadShape);
    } catch (e) {
      console.warn('⚠️ Could not extract native faces from replicad shape');
    }
  }

  const faceGroups = new Map<string, number[]>();

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

    let nativeFaceType = 'UNKNOWN';
    let nativeFaceIndex = -1;
    if (nativeFaces.length > 0) {
      const match = matchTriangleToNativeFace(center, normal, nativeFaces, faceTypeMap, geometry, [v0, v1, v2]);
      if (match) {
        nativeFaceType = match.faceType;
        nativeFaceIndex = match.faceIndex;
        const key = `${match.faceIndex}-${nativeFaceType}`;
        if (!faceGroups.has(key)) {
          faceGroups.set(key, []);
        }
        faceGroups.get(key)!.push(i);
      }
    }

    const isCurved = isNativeCurved(nativeFaceType);

    faces.push({
      faceIndex: i,
      normal,
      center,
      vertices: [v0, v1, v2],
      area,
      nativeFaceType,
      nativeFaceIndex,
      isCurved
    });
  }

  if (faceGroups.size > 0) {
    console.log(`📊 Native face mapping: ${faceGroups.size} distinct CAD faces`);
    faceGroups.forEach((triangles, key) => {
      console.log(`  ${key}: ${triangles.length} triangles`);
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

  let totalAngleDiff = 0;
  let count = 0;
  let hasSignificantCurvature = false;

  for (const neighborIdx of neighbors) {
    const neighbor = faces[neighborIdx];
    const dot = face.normal.dot(neighbor.normal);
    const angleDiff = Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI);
    totalAngleDiff += angleDiff;
    count++;

    if (angleDiff > 2 && angleDiff < 50) {
      hasSignificantCurvature = true;
    }
  }

  const avgAngleDiff = count > 0 ? totalAngleDiff / count : 0;

  return hasSignificantCurvature && avgAngleDiff > 1;
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

  const hasNativeTypes = faces.some(f => f.nativeFaceType && f.nativeFaceType !== 'UNKNOWN');

  if (hasNativeTypes) {
    console.log('✅ Using native CAD face types for grouping');

    const nativeFaceGroups = new Map<number, number[]>();

    faces.forEach((face, idx) => {
      const nativeFaceIdx = face.nativeFaceIndex ?? -1;

      if (nativeFaceIdx >= 0) {
        if (!nativeFaceGroups.has(nativeFaceIdx)) {
          nativeFaceGroups.set(nativeFaceIdx, []);
        }
        nativeFaceGroups.get(nativeFaceIdx)!.push(idx);
      }
    });

    nativeFaceGroups.forEach((faceIndices, nativeFaceIdx) => {
      const facesInGroup = faceIndices.map(idx => faces[idx]);
      const faceType = facesInGroup[0]?.nativeFaceType || 'UNKNOWN';
      const isCurvedType = isNativeCurved(faceType);

      if (!isCurvedType && !faceType.includes('PLANE')) {
        return;
      }

      const avgCenter = new THREE.Vector3();
      const avgNormal = new THREE.Vector3();
      let totalArea = 0;

      facesInGroup.forEach(face => {
        avgCenter.add(face.center);
        avgNormal.add(face.normal);
        totalArea += face.area;
        face.isCurved = isCurvedType;
      });

      avgCenter.divideScalar(facesInGroup.length);
      avgNormal.divideScalar(facesInGroup.length).normalize();

      groups.push({
        normal: avgNormal,
        faceIndices,
        center: avgCenter,
        totalArea
      });
    });

    console.log(`📊 Native face grouping: ${groups.length} groups from ${faces.length} triangles`);
    groups.forEach((group, idx) => {
      const faceType = faces[group.faceIndices[0]]?.nativeFaceType || 'UNKNOWN';
      const isCurved = faces[group.faceIndices[0]]?.isCurved || false;
      console.log(`  Group ${idx}: ${group.faceIndices.length} faces, Type: ${faceType}, ${isCurved ? 'CURVED' : 'PLANAR'}`);
    });

    return groups;
  }

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

        const effectiveThreshold = isCurvedGroup ? 20 : thresholdAngleDegrees;

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

  console.log(`📊 Face grouping complete: ${groups.length} groups from ${faces.length} triangles`);
  groups.forEach((group, idx) => {
    const isCurved = faces[group.faceIndices[0]]?.isCurved || false;
    console.log(`  Group ${idx}: ${group.faceIndices.length} faces, ${isCurved ? 'CURVED' : 'PLANAR'}`);
  });

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

export function createFaceDescriptor(
  face: FaceData,
  geometry: THREE.BufferGeometry
): { normal: [number, number, number]; normalizedCenter: [number, number, number]; area: number } {
  const boundingBox = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute('position')
  );
  const size = new THREE.Vector3();
  const min = new THREE.Vector3();
  boundingBox.getSize(size);
  boundingBox.min.clone().toArray();
  min.copy(boundingBox.min);

  const normalizedCenter: [number, number, number] = [
    size.x > 0 ? (face.center.x - min.x) / size.x : 0.5,
    size.y > 0 ? (face.center.y - min.y) / size.y : 0.5,
    size.z > 0 ? (face.center.z - min.z) / size.z : 0.5
  ];

  return {
    normal: [face.normal.x, face.normal.y, face.normal.z],
    normalizedCenter,
    area: face.area
  };
}

export function findFaceByDescriptor(
  descriptor: { normal: [number, number, number]; normalizedCenter: [number, number, number]; area: number },
  faces: FaceData[],
  geometry: THREE.BufferGeometry
): FaceData | null {
  let bestMatch: FaceData | null = null;
  let bestScore = Infinity;

  const targetNormal = new THREE.Vector3(...descriptor.normal);

  for (const face of faces) {
    const faceDescriptor = createFaceDescriptor(face, geometry);

    const dotProduct = targetNormal.dot(face.normal);
    const normalAngle = Math.acos(Math.min(1, Math.max(-1, dotProduct))) * (180 / Math.PI);

    if (normalAngle > 5) {
      continue;
    }

    const centerDiff = Math.sqrt(
      Math.pow(faceDescriptor.normalizedCenter[0] - descriptor.normalizedCenter[0], 2) +
      Math.pow(faceDescriptor.normalizedCenter[1] - descriptor.normalizedCenter[1], 2) +
      Math.pow(faceDescriptor.normalizedCenter[2] - descriptor.normalizedCenter[2], 2)
    );

    const areaDiff = Math.abs(face.area - descriptor.area) / Math.max(face.area, descriptor.area);

    const score = normalAngle * 2 + centerDiff * 10 + areaDiff * 5;

    if (score < bestScore) {
      bestScore = score;
      bestMatch = face;
    }
  }

  if (bestMatch) {
    console.log(`🔍 Face match - Score: ${bestScore.toFixed(4)}, Normal: [${descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);
  } else {
    console.warn(`⚠️ No face match found for normal: [${descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);
  }

  return bestMatch;
}
