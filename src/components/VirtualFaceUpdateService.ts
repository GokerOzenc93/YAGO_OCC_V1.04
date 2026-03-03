import * as THREE from 'three';
import type { VirtualFace, Shape } from '../store';
import {
  getFacePlaneAxes,
  getShapeMatrix,
  getSubtractorFootprints2D,
  getSubtractionWorldMatrix,
  projectTo2D,
  subtractPolygon,
  ensureCCW,
  isPointInsidePolygon,
  type Point2D,
} from './FaceRaycastOverlay';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  findFaceByDescriptor,
  type FaceData,
  type CoplanarFaceGroup,
} from './FaceEditor';

function collectBoundaryEdgesLocal(
  faces: FaceData[],
  faceIndices: number[]
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const edgeMap = new Map<string, { v1: THREE.Vector3; v2: THREE.Vector3; count: number }>();

  faceIndices.forEach(fi => {
    const face = faces[fi];
    if (!face) return;
    const verts = face.vertices;
    for (let i = 0; i < 3; i++) {
      const va = verts[i].clone();
      const vb = verts[(i + 1) % 3].clone();
      const ka = `${va.x.toFixed(2)},${va.y.toFixed(2)},${va.z.toFixed(2)}`;
      const kb = `${vb.x.toFixed(2)},${vb.y.toFixed(2)},${vb.z.toFixed(2)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { v1: va, v2: vb, count: 0 });
      }
      edgeMap.get(key)!.count++;
    }
  });

  const boundary: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];
  edgeMap.forEach(e => {
    if (e.count === 1) boundary.push({ v1: e.v1, v2: e.v2 });
  });
  return boundary;
}

function raySegmentIntersect2D(
  ox: number, oy: number,
  dx: number, dy: number,
  ax: number, ay: number,
  bx: number, by: number
): number | null {
  const ex = bx - ax;
  const ey = by - ay;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((ax - ox) * ey - (ay - oy) * ex) / denom;
  const s = ((ax - ox) * dy - (ay - oy) * dx) / denom;
  if (t > 1e-4 && s >= -1e-4 && s <= 1.0 + 1e-4) return t;
  return null;
}

function castRayOnFaceLocal(
  originLocal: THREE.Vector3,
  dirLocal: THREE.Vector3,
  boundaryEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  u: THREE.Vector3,
  v: THREE.Vector3,
  planeOrigin: THREE.Vector3,
  maxDist: number
): THREE.Vector3 {
  const o2d = projectTo2D(originLocal, planeOrigin, u, v);
  const dir2d = { x: dirLocal.dot(u), y: dirLocal.dot(v) };
  let tMin = maxDist;

  for (const edge of boundaryEdges) {
    const a2d = projectTo2D(edge.v1, planeOrigin, u, v);
    const b2d = projectTo2D(edge.v2, planeOrigin, u, v);
    const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a2d.x, a2d.y, b2d.x, b2d.y);
    if (t !== null && t < tMin) tMin = t;
  }

  for (const edge of obstacleEdges) {
    const a2d = projectTo2D(edge.v1, planeOrigin, u, v);
    const b2d = projectTo2D(edge.v2, planeOrigin, u, v);
    const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a2d.x, a2d.y, b2d.x, b2d.y);
    if (t !== null && t < tMin) tMin = t;
  }

  return originLocal.clone().addScaledVector(dirLocal, tMin);
}

function findMatchingFaceGroup(
  vf: VirtualFace,
  faces: FaceData[],
  faceGroups: CoplanarFaceGroup[],
  geometry: THREE.BufferGeometry
): CoplanarFaceGroup | null {
  if (vf.raycastRecipe) {
    const matchedFace = findFaceByDescriptor(
      vf.raycastRecipe.faceGroupDescriptor,
      faces,
      geometry
    );
    if (matchedFace) {
      const matchedGroup = faceGroups.find(g =>
        g.faceIndices.includes(matchedFace.faceIndex)
      );
      if (matchedGroup) return matchedGroup;
    }
  }

  const vfNormal = new THREE.Vector3(vf.normal[0], vf.normal[1], vf.normal[2]).normalize();
  let bestGroup: CoplanarFaceGroup | null = null;
  let bestDot = -Infinity;

  for (const group of faceGroups) {
    const groupNormal = group.normal.clone().normalize();
    const dot = vfNormal.dot(groupNormal);
    if (dot > 0.95 && dot > bestDot) {
      bestDot = dot;
      bestGroup = group;
    }
  }

  return bestGroup;
}

function reraycastVirtualFace(
  vf: VirtualFace,
  shape: Shape,
  faces: FaceData[],
  faceGroups: CoplanarFaceGroup[],
  localToWorld: THREE.Matrix4,
  childPanels: any[]
): VirtualFace | null {
  if (!vf.raycastRecipe) return null;

  const matchedGroup = findMatchingFaceGroup(vf, faces, faceGroups, shape.geometry);
  if (!matchedGroup) return null;

  const localNormal = matchedGroup.normal.clone().normalize();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

  const { u: worldU, v: worldV } = getFacePlaneAxes(worldNormal);

  const localU = worldU.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(localToWorld.clone().invert())).normalize();
  const localV = worldV.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(localToWorld.clone().invert())).normalize();

  const clickLocal = new THREE.Vector3(
    vf.raycastRecipe.clickLocalPoint[0],
    vf.raycastRecipe.clickLocalPoint[1],
    vf.raycastRecipe.clickLocalPoint[2]
  );

  const groupVertices: THREE.Vector3[] = [];
  matchedGroup.faceIndices.forEach(fi => {
    const face = faces[fi];
    if (!face) return;
    face.vertices.forEach(v => groupVertices.push(v.clone()));
  });
  const groupBbox = new THREE.Box3().setFromPoints(groupVertices);
  const clampedClick = clickLocal.clone().clamp(groupBbox.min, groupBbox.max);

  const offset = localNormal.clone().multiplyScalar(0.5);
  const startLocal = clampedClick.clone().add(offset);

  const boundaryEdges = collectBoundaryEdgesLocal(faces, matchedGroup.faceIndices);
  const subtractions = shape.subtractionGeometries || [];

  const subEdgesWorld = subtractions.length > 0 ? (() => {
    const worldToLocal = localToWorld.clone().invert();
    const edges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];

    for (const sub of subtractions) {
      if (!sub || !sub.geometry) continue;
      const subWorldMatrix = getSubtractionWorldMatrix(localToWorld, sub);
      const subToLocal = worldToLocal.clone().multiply(subWorldMatrix);

      const edgesGeo = new THREE.EdgesGeometry(sub.geometry);
      const edgePos = edgesGeo.getAttribute('position');
      const count = edgePos.count;

      for (let i = 0; i < count; i += 2) {
        const va = new THREE.Vector3(edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i)).applyMatrix4(subToLocal);
        const vb = new THREE.Vector3(edgePos.getX(i + 1), edgePos.getY(i + 1), edgePos.getZ(i + 1)).applyMatrix4(subToLocal);

        const distA = Math.abs(localNormal.dot(new THREE.Vector3().subVectors(va, startLocal)));
        const distB = Math.abs(localNormal.dot(new THREE.Vector3().subVectors(vb, startLocal)));

        if (distA < 20 && distB < 20) {
          edges.push({ v1: va, v2: vb });
        }
      }
      edgesGeo.dispose();
    }
    return edges;
  })() : [];

  const obstacleEdges = [...subEdgesWorld];

  const maxDist = 5000;
  const directions = [localU, localU.clone().negate(), localV, localV.clone().negate()];

  const hitPointsLocal: THREE.Vector3[] = [];
  for (const dir of directions) {
    const hitLocal = castRayOnFaceLocal(startLocal, dir, boundaryEdges, obstacleEdges, localU, localV, startLocal, maxDist);
    hitPointsLocal.push(hitLocal);
  }

  if (hitPointsLocal.length < 4) return null;

  const uPosT = hitPointsLocal[0].distanceTo(startLocal);
  const uNegT = hitPointsLocal[1].distanceTo(startLocal);
  const vPosT = hitPointsLocal[2].distanceTo(startLocal);
  const vNegT = hitPointsLocal[3].distanceTo(startLocal);

  let rect2D: Point2D[] = ensureCCW([
    { x: uPosT, y: vPosT },
    { x: -uNegT, y: vPosT },
    { x: -uNegT, y: -vNegT },
    { x: uPosT, y: -vNegT },
  ]);

  const footprints = getSubtractorFootprints2D(
    subtractions, localToWorld, worldNormal,
    startLocal.clone().applyMatrix4(localToWorld),
    worldU, worldV, 50
  );

  let clippedPoly = rect2D;
  for (const footprint of footprints) {
    const ccwFootprint = ensureCCW(footprint);
    const hasOverlap = ccwFootprint.some(p => isPointInsidePolygon(p, clippedPoly)) ||
      clippedPoly.some(p => isPointInsidePolygon(p, ccwFootprint));
    if (hasOverlap) {
      clippedPoly = subtractPolygon(clippedPoly, ccwFootprint);
    }
  }

  if (clippedPoly.length < 3) return null;

  const cornersLocal = clippedPoly.map(p =>
    startLocal.clone().addScaledVector(localU, p.x).addScaledVector(localV, p.y)
  );

  const centerLocal = new THREE.Vector3();
  cornersLocal.forEach(c => centerLocal.add(c));
  centerLocal.divideScalar(cornersLocal.length);

  return {
    ...vf,
    normal: [localNormal.x, localNormal.y, localNormal.z],
    center: [centerLocal.x, centerLocal.y, centerLocal.z],
    vertices: cornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
  };
}

export function recalculateVirtualFacesForShape(
  shape: Shape,
  virtualFaces: VirtualFace[],
  allShapes?: any[]
): VirtualFace[] {
  const shapeFaces = virtualFaces.filter(vf => vf.shapeId === shape.id);
  if (shapeFaces.length === 0) return virtualFaces;

  if (!shape.geometry) return virtualFaces;

  const faces = extractFacesFromGeometry(shape.geometry);
  const faceGroups = groupCoplanarFaces(faces);
  const localToWorld = getShapeMatrix(shape);

  const childPanels = (allShapes || []).filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id
  );

  const updatedMap = new Map<string, VirtualFace>();

  for (const vf of shapeFaces) {
    if (vf.raycastRecipe) {
      const reraycast = reraycastVirtualFace(
        vf, shape, faces, faceGroups, localToWorld, childPanels
      );
      updatedMap.set(vf.id, reraycast || vf);
    } else {
      const subtractions = shape.subtractionGeometries || [];
      if (subtractions.length > 0) {
        const clipped = clipVirtualFaceAgainstSubtractions(vf, subtractions, localToWorld);
        updatedMap.set(vf.id, clipped || vf);
      } else {
        updatedMap.set(vf.id, vf);
      }
    }
  }

  return virtualFaces.map(vf => updatedMap.get(vf.id) || vf);
}

function clipVirtualFaceAgainstSubtractions(
  vf: VirtualFace,
  subtractions: any[],
  localToWorld: THREE.Matrix4
): VirtualFace | null {
  if (vf.vertices.length < 3) return null;

  const localNormal = new THREE.Vector3(vf.normal[0], vf.normal[1], vf.normal[2]).normalize();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

  const { u, v } = getFacePlaneAxes(worldNormal);

  const cornersLocal = vf.vertices.map(vtx => new THREE.Vector3(vtx[0], vtx[1], vtx[2]));
  const cornersWorld = cornersLocal.map(c => c.clone().applyMatrix4(localToWorld));

  const centerWorld = new THREE.Vector3();
  cornersWorld.forEach(c => centerWorld.add(c));
  centerWorld.divideScalar(cornersWorld.length);

  const planeOrigin = centerWorld.clone();

  const poly2D: Point2D[] = cornersWorld.map(c => projectTo2D(c, planeOrigin, u, v));
  let clippedPoly = ensureCCW(poly2D);

  const footprints = getSubtractorFootprints2D(
    subtractions, localToWorld, worldNormal, planeOrigin, u, v, 50
  );

  if (footprints.length === 0) return null;

  let changed = false;
  for (const footprint of footprints) {
    const ccwFootprint = ensureCCW(footprint);
    const hasOverlap = ccwFootprint.some(p => isPointInsidePolygon(p, clippedPoly)) ||
      clippedPoly.some(p => isPointInsidePolygon(p, ccwFootprint));
    if (hasOverlap) {
      clippedPoly = subtractPolygon(clippedPoly, ccwFootprint);
      changed = true;
    }
  }

  if (!changed) return null;
  if (clippedPoly.length < 3) return null;

  const worldToLocal = localToWorld.clone().invert();
  const newCornersWorld = clippedPoly.map(p =>
    planeOrigin.clone().addScaledVector(u, p.x).addScaledVector(v, p.y)
  );
  const newCornersLocal = newCornersWorld.map(c => c.clone().applyMatrix4(worldToLocal));

  const newCenter = new THREE.Vector3();
  newCornersLocal.forEach(c => newCenter.add(c));
  newCenter.divideScalar(newCornersLocal.length);

  return {
    ...vf,
    vertices: newCornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
    center: [newCenter.x, newCenter.y, newCenter.z],
  };
}
