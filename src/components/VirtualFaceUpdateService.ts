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

function collectBoundaryEdgesWorld(
  faces: FaceData[],
  faceIndices: number[],
  localToWorld: THREE.Matrix4
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const edgeMap = new Map<string, { v1: THREE.Vector3; v2: THREE.Vector3; count: number }>();

  faceIndices.forEach(fi => {
    const face = faces[fi];
    if (!face) return;
    const verts = face.vertices;
    for (let i = 0; i < 3; i++) {
      const va = verts[i].clone().applyMatrix4(localToWorld);
      const vb = verts[(i + 1) % 3].clone().applyMatrix4(localToWorld);
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

function collectVirtualFaceObstacleEdgesWorld(
  virtualFaces: VirtualFace[],
  excludeId: string | null,
  shapeLocalToWorld: THREE.Matrix4,
  facePlaneNormal: THREE.Vector3,
  facePlaneOrigin: THREE.Vector3,
  planeTolerance: number = 20
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const edges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];

  for (const vf of virtualFaces) {
    if (vf.id === excludeId) continue;
    if (vf.vertices.length < 3) continue;

    const worldVerts = vf.vertices.map(vtx =>
      new THREE.Vector3(vtx[0], vtx[1], vtx[2]).applyMatrix4(shapeLocalToWorld)
    );

    for (let i = 0; i < worldVerts.length; i++) {
      const va = worldVerts[i];
      const vb = worldVerts[(i + 1) % worldVerts.length];

      const distA = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(va, facePlaneOrigin)));
      const distB = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(vb, facePlaneOrigin)));

      if (distA < planeTolerance && distB < planeTolerance) {
        edges.push({ v1: va, v2: vb });
      }
    }
  }
  return edges;
}

function collectPanelObstacleEdgesWorld(
  childPanels: any[],
  facePlaneNormal: THREE.Vector3,
  facePlaneOriginWorld: THREE.Vector3,
  planeTolerance: number = 20
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];

  for (const panel of childPanels) {
    if (!panel.geometry) continue;

    const panelMatrix = getShapeMatrix(panel);
    const edgesGeo = new THREE.EdgesGeometry(panel.geometry);
    const edgePos = edgesGeo.getAttribute('position');
    const count = edgePos.count;

    for (let i = 0; i < count; i += 2) {
      const va = new THREE.Vector3(edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i)).applyMatrix4(panelMatrix);
      const vb = new THREE.Vector3(edgePos.getX(i + 1), edgePos.getY(i + 1), edgePos.getZ(i + 1)).applyMatrix4(panelMatrix);

      const distA = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(va, facePlaneOriginWorld)));
      const distB = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(vb, facePlaneOriginWorld)));

      if (distA < planeTolerance && distB < planeTolerance) {
        obstacleEdges.push({ v1: va, v2: vb });
      }
    }
    edgesGeo.dispose();
  }
  return obstacleEdges;
}

function collectSubtractionObstacleEdgesWorld(
  subtractions: any[],
  localToWorld: THREE.Matrix4,
  facePlaneNormal: THREE.Vector3,
  facePlaneOriginWorld: THREE.Vector3,
  planeTolerance: number = 20
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const edges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];

  for (const sub of subtractions) {
    if (!sub || !sub.geometry) continue;
    const subWorldMatrix = getSubtractionWorldMatrix(localToWorld, sub);

    const edgesGeo = new THREE.EdgesGeometry(sub.geometry);
    const edgePos = edgesGeo.getAttribute('position');
    const count = edgePos.count;

    for (let i = 0; i < count; i += 2) {
      const va = new THREE.Vector3(edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i)).applyMatrix4(subWorldMatrix);
      const vb = new THREE.Vector3(edgePos.getX(i + 1), edgePos.getY(i + 1), edgePos.getZ(i + 1)).applyMatrix4(subWorldMatrix);

      const distA = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(va, facePlaneOriginWorld)));
      const distB = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(vb, facePlaneOriginWorld)));

      if (distA < planeTolerance && distB < planeTolerance) {
        edges.push({ v1: va, v2: vb });
      }
    }
    edgesGeo.dispose();
  }
  return edges;
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

function castRayOnFaceWorld(
  originWorld: THREE.Vector3,
  dirWorld: THREE.Vector3,
  boundaryEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  u: THREE.Vector3,
  v: THREE.Vector3,
  planeOrigin: THREE.Vector3,
  maxDist: number
): THREE.Vector3 {
  const o2d = projectTo2D(originWorld, planeOrigin, u, v);
  const dir2d = { x: dirWorld.dot(u), y: dirWorld.dot(v) };
  let tMin = maxDist;

  for (const edge of [...boundaryEdges, ...obstacleEdges]) {
    const a2d = projectTo2D(edge.v1, planeOrigin, u, v);
    const b2d = projectTo2D(edge.v2, planeOrigin, u, v);
    const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a2d.x, a2d.y, b2d.x, b2d.y);
    if (t !== null && t < tMin) tMin = t;
  }

  return originWorld.clone().addScaledVector(dirWorld, tMin);
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

function computeEdgeAnchoredClickPoint(
  edgeAnchor: import('../store').EdgeAnchor,
  groupVerticesWorld: THREE.Vector3[],
  u: THREE.Vector3,
  v: THREE.Vector3,
  worldNormal: THREE.Vector3,
  faces: FaceData[],
  matchedGroup: CoplanarFaceGroup,
  localToWorld: THREE.Matrix4,
  subtractions: any[],
  childPanels: any[],
  shapeFaces: VirtualFace[],
  vfId: string
): THREE.Vector3 | null {
  const groupCenter = new THREE.Vector3();
  groupVerticesWorld.forEach(vw => groupCenter.add(vw));
  groupCenter.divideScalar(groupVerticesWorld.length);

  const probeStart = groupCenter.clone().addScaledVector(worldNormal, 0.5);
  const probePlaneOrigin = probeStart.clone();

  const boundaryEdges = collectBoundaryEdgesWorld(faces, matchedGroup.faceIndices, localToWorld);
  const panelsExcludingSelf = childPanels.filter(
    (p: any) => p.parameters?.virtualFaceId !== vfId
  );
  const panelObstacleEdges = collectPanelObstacleEdgesWorld(
    panelsExcludingSelf, worldNormal, probePlaneOrigin, 20
  );
  const subObstacleEdges = collectSubtractionObstacleEdgesWorld(
    subtractions, localToWorld, worldNormal, probePlaneOrigin, 20
  );
  const vfObstacleEdges = collectVirtualFaceObstacleEdgesWorld(
    shapeFaces, vfId, localToWorld, worldNormal, probePlaneOrigin, 20
  );
  const obstacleEdges = [...panelObstacleEdges, ...subObstacleEdges, ...vfObstacleEdges];

  const maxDist = 5000;
  const dirMap: Record<string, THREE.Vector3> = {
    uPos: u.clone(),
    uNeg: u.clone().negate(),
    vPos: v.clone(),
    vNeg: v.clone().negate(),
  };

  const edgeBoundaryDists: Record<string, number> = {};
  for (const key of ['uPos', 'uNeg', 'vPos', 'vNeg']) {
    const hit = castRayOnFaceWorld(probeStart, dirMap[key], boundaryEdges, obstacleEdges, u, v, probePlaneOrigin, maxDist);
    edgeBoundaryDists[key] = hit.distanceTo(probeStart);
  }

  const [edge1Dir, edge2Dir] = edgeAnchor.selectedEdges;
  const [dist1, dist2] = edgeAnchor.distances;

  const totalU1 = edgeBoundaryDists[edge1Dir] || 0;
  const totalU2 = edgeBoundaryDists[edge2Dir] || 0;

  let offsetU = 0;
  let offsetV = 0;

  const applyAnchor = (dir: string, anchorDist: number, totalFromCenter: number) => {
    if (dir === 'uPos') {
      offsetU = totalFromCenter - anchorDist;
    } else if (dir === 'uNeg') {
      offsetU = -(totalFromCenter - anchorDist);
    } else if (dir === 'vPos') {
      offsetV = totalFromCenter - anchorDist;
    } else if (dir === 'vNeg') {
      offsetV = -(totalFromCenter - anchorDist);
    }
  };

  applyAnchor(edge1Dir, dist1, totalU1);
  applyAnchor(edge2Dir, dist2, totalU2);

  return groupCenter.clone()
    .addScaledVector(u, offsetU)
    .addScaledVector(v, offsetV)
    .addScaledVector(worldNormal, 0);
}

function reraycastVirtualFace(
  vf: VirtualFace,
  shape: Shape,
  faces: FaceData[],
  faceGroups: CoplanarFaceGroup[],
  localToWorld: THREE.Matrix4,
  worldToLocal: THREE.Matrix4,
  childPanels: any[],
  shapeFaces: VirtualFace[]
): VirtualFace | null {
  if (!vf.raycastRecipe) return null;

  const matchedGroup = findMatchingFaceGroup(vf, faces, faceGroups, shape.geometry);
  if (!matchedGroup) return null;

  const localNormal = matchedGroup.normal.clone().normalize();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

  const { u, v } = getFacePlaneAxes(worldNormal);

  const groupVerticesWorld: THREE.Vector3[] = [];
  matchedGroup.faceIndices.forEach(fi => {
    const face = faces[fi];
    if (!face) return;
    face.vertices.forEach(vertex => groupVerticesWorld.push(vertex.clone().applyMatrix4(localToWorld)));
  });

  if (groupVerticesWorld.length === 0) return null;

  let clampedClickWorld: THREE.Vector3;

  const edgeAnchor = vf.raycastRecipe.edgeAnchor;
  const subtractions = shape.subtractionGeometries || [];

  if (edgeAnchor) {
    const anchored = computeEdgeAnchoredClickPoint(
      edgeAnchor,
      groupVerticesWorld,
      u, v,
      worldNormal,
      faces,
      matchedGroup,
      localToWorld,
      subtractions,
      childPanels,
      shapeFaces,
      vf.id
    );
    if (!anchored) return null;
    clampedClickWorld = anchored;
  } else {
    const normalizedUV = vf.raycastRecipe.normalizedClickUV;
    if (normalizedUV) {
      const faceVertsU = groupVerticesWorld.map(vw => vw.dot(u));
      const faceVertsV = groupVerticesWorld.map(vw => vw.dot(v));
      const uMin = Math.min(...faceVertsU);
      const uMax = Math.max(...faceVertsU);
      const vMin = Math.min(...faceVertsV);
      const vMax = Math.max(...faceVertsV);

      const worldU = uMin + normalizedUV[0] * (uMax - uMin);
      const worldV = vMin + normalizedUV[1] * (vMax - vMin);

      const groupCenter = new THREE.Vector3();
      groupVerticesWorld.forEach(vw => groupCenter.add(vw));
      groupCenter.divideScalar(groupVerticesWorld.length);

      clampedClickWorld = groupCenter.clone()
        .addScaledVector(u, worldU - groupCenter.dot(u))
        .addScaledVector(v, worldV - groupCenter.dot(v));
    } else {
      const clickLocal = new THREE.Vector3(
        vf.raycastRecipe.clickLocalPoint[0],
        vf.raycastRecipe.clickLocalPoint[1],
        vf.raycastRecipe.clickLocalPoint[2]
      );
      const clickWorld = clickLocal.clone().applyMatrix4(localToWorld);
      const groupBboxWorld = new THREE.Box3().setFromPoints(groupVerticesWorld);
      clampedClickWorld = clickWorld.clone().clamp(groupBboxWorld.min, groupBboxWorld.max);
    }
  }

  const startWorld = clampedClickWorld.clone().addScaledVector(worldNormal, 0.5);
  const planeOrigin = startWorld.clone();

  const boundaryEdges = collectBoundaryEdgesWorld(faces, matchedGroup.faceIndices, localToWorld);

  const panelsExcludingSelf = childPanels.filter(
    p => p.parameters?.virtualFaceId !== vf.id
  );
  const panelObstacleEdges = collectPanelObstacleEdgesWorld(
    panelsExcludingSelf, worldNormal, planeOrigin, 20
  );
  const subObstacleEdges = collectSubtractionObstacleEdgesWorld(
    subtractions, localToWorld, worldNormal, planeOrigin, 20
  );
  const vfObstacleEdges = collectVirtualFaceObstacleEdgesWorld(
    shapeFaces, vf.id, localToWorld, worldNormal, planeOrigin, 20
  );
  const obstacleEdges = [...panelObstacleEdges, ...subObstacleEdges, ...vfObstacleEdges];

  const maxDist = 5000;
  const directions = [u, u.clone().negate(), v, v.clone().negate()];

  const hitPointsWorld: THREE.Vector3[] = [];
  for (const dir of directions) {
    const hit = castRayOnFaceWorld(startWorld, dir, boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);
    hitPointsWorld.push(hit);
  }

  if (hitPointsWorld.length < 4) return null;

  const uPosT = hitPointsWorld[0].distanceTo(startWorld);
  const uNegT = hitPointsWorld[1].distanceTo(startWorld);
  const vPosT = hitPointsWorld[2].distanceTo(startWorld);
  const vNegT = hitPointsWorld[3].distanceTo(startWorld);

  let rect2D: Point2D[] = ensureCCW([
    { x: uPosT, y: vPosT },
    { x: -uNegT, y: vPosT },
    { x: -uNegT, y: -vNegT },
    { x: uPosT, y: -vNegT },
  ]);

  const footprints = getSubtractorFootprints2D(
    subtractions, localToWorld, worldNormal, planeOrigin, u, v, 50
  );

  let clippedPoly = rect2D;
  for (const footprint of footprints) {
    const ccwFootprint = ensureCCW(footprint);
    const hasOverlap =
      ccwFootprint.some(p => isPointInsidePolygon(p, clippedPoly)) ||
      clippedPoly.some(p => isPointInsidePolygon(p, ccwFootprint));
    if (hasOverlap) {
      clippedPoly = subtractPolygon(clippedPoly, ccwFootprint);
    }
  }

  if (clippedPoly.length < 3) return null;

  const cornersWorld = clippedPoly.map(p =>
    planeOrigin.clone().addScaledVector(u, p.x).addScaledVector(v, p.y)
  );
  const cornersLocal = cornersWorld.map(c => c.clone().applyMatrix4(worldToLocal));

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
  const worldToLocal = localToWorld.clone().invert();

  const childPanels = (allShapes || []).filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id
  );

  const updatedMap = new Map<string, VirtualFace>();

  for (const vf of shapeFaces) {
    if (vf.raycastRecipe) {
      const reraycast = reraycastVirtualFace(
        vf, shape, faces, faceGroups, localToWorld, worldToLocal, childPanels, shapeFaces
      );
      updatedMap.set(vf.id, reraycast || vf);
    } else {
      const subtractions = shape.subtractionGeometries || [];
      if (subtractions.length > 0) {
        const clipped = clipVirtualFaceAgainstSubtractions(vf, subtractions, localToWorld, worldToLocal);
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
  localToWorld: THREE.Matrix4,
  worldToLocal: THREE.Matrix4
): VirtualFace | null {
  if (vf.vertices.length < 3) return null;

  const localNormal = new THREE.Vector3(vf.normal[0], vf.normal[1], vf.normal[2]).normalize();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

  const { u, v } = getFacePlaneAxes(worldNormal);

  const cornersWorld = vf.vertices.map(vtx =>
    new THREE.Vector3(vtx[0], vtx[1], vtx[2]).applyMatrix4(localToWorld)
  );

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
    const hasOverlap =
      ccwFootprint.some(p => isPointInsidePolygon(p, clippedPoly)) ||
      clippedPoly.some(p => isPointInsidePolygon(p, ccwFootprint));
    if (hasOverlap) {
      clippedPoly = subtractPolygon(clippedPoly, ccwFootprint);
      changed = true;
    }
  }

  if (!changed) return null;
  if (clippedPoly.length < 3) return null;

  const newCornersLocal = clippedPoly.map(p =>
    planeOrigin.clone().addScaledVector(u, p.x).addScaledVector(v, p.y).applyMatrix4(worldToLocal)
  );

  const newCenter = new THREE.Vector3();
  newCornersLocal.forEach(c => newCenter.add(c));
  newCenter.divideScalar(newCornersLocal.length);

  return {
    ...vf,
    vertices: newCornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
    center: [newCenter.x, newCenter.y, newCenter.z],
  };
}
