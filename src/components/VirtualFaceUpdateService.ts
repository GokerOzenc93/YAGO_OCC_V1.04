import * as THREE from 'three';
import type { VirtualFace, Shape, EdgeAnchor } from '../store';
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

function findMatchingBoundaryEdge(
  anchor: EdgeAnchor,
  boundaryEdgesLocal: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  tolerance: number = 5.0
): { edge: { v1: THREE.Vector3; v2: THREE.Vector3 }; t: number } | null {
  const aV1 = new THREE.Vector3(...anchor.edgeV1Local);
  const aV2 = new THREE.Vector3(...anchor.edgeV2Local);
  const aMid = aV1.clone().add(aV2).multiplyScalar(0.5);
  const aDir = aV2.clone().sub(aV1).normalize();

  let bestEdge: { v1: THREE.Vector3; v2: THREE.Vector3 } | null = null;
  let bestScore = Infinity;
  let bestFlipped = false;

  for (const edge of boundaryEdgesLocal) {
    const eDir = edge.v2.clone().sub(edge.v1).normalize();
    const eMid = edge.v1.clone().add(edge.v2).multiplyScalar(0.5);

    const dirDot = Math.abs(aDir.dot(eDir));
    if (dirDot < 0.8) continue;

    const midDist = aMid.distanceTo(eMid);
    const score = midDist + (1 - dirDot) * 100;

    if (score < bestScore && score < tolerance * 10) {
      bestScore = score;
      bestEdge = edge;
      bestFlipped = aDir.dot(eDir) < 0;
    }
  }

  if (!bestEdge) return null;

  const t = bestFlipped ? (1 - anchor.t) : anchor.t;
  return { edge: bestEdge, t };
}

function reconstructHitPointsFromAnchors(
  anchors: EdgeAnchor[],
  boundaryEdgesWorld: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  boundaryEdgesLocal: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  localToWorld: THREE.Matrix4,
): Map<string, THREE.Vector3> {
  const result = new Map<string, THREE.Vector3>();

  for (const anchor of anchors) {
    const matched = findMatchingBoundaryEdge(anchor, boundaryEdgesLocal);
    if (!matched) continue;

    const hitLocal = matched.edge.v1.clone().lerp(matched.edge.v2, matched.t);
    const hitWorld = hitLocal.clone().applyMatrix4(localToWorld);
    result.set(anchor.direction, hitWorld);
  }

  return result;
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

  const boundaryEdgesWorld = collectBoundaryEdgesWorld(faces, matchedGroup.faceIndices, localToWorld);

  const boundaryEdgesLocal: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];
  matchedGroup.faceIndices.forEach(fi => {
    const face = faces[fi];
    if (!face) return;
    const verts = face.vertices;
    for (let i = 0; i < 3; i++) {
      const va = verts[i];
      const vb = verts[(i + 1) % 3];
      boundaryEdgesLocal.push({ v1: va.clone(), v2: vb.clone() });
    }
  });
  const edgeMapLocal = new Map<string, { v1: THREE.Vector3; v2: THREE.Vector3; count: number }>();
  for (const e of boundaryEdgesLocal) {
    const ka = `${e.v1.x.toFixed(2)},${e.v1.y.toFixed(2)},${e.v1.z.toFixed(2)}`;
    const kb = `${e.v2.x.toFixed(2)},${e.v2.y.toFixed(2)},${e.v2.z.toFixed(2)}`;
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!edgeMapLocal.has(key)) {
      edgeMapLocal.set(key, { v1: e.v1, v2: e.v2, count: 0 });
    }
    edgeMapLocal.get(key)!.count++;
  }
  const uniqueBoundaryEdgesLocal: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];
  edgeMapLocal.forEach(e => {
    if (e.count === 1) uniqueBoundaryEdgesLocal.push({ v1: e.v1, v2: e.v2 });
  });

  const edgeAnchors = vf.raycastRecipe.edgeAnchors;
  let anchorHitPoints: Map<string, THREE.Vector3> | null = null;

  if (edgeAnchors && edgeAnchors.length === 4) {
    anchorHitPoints = reconstructHitPointsFromAnchors(
      edgeAnchors, boundaryEdgesWorld, uniqueBoundaryEdgesLocal, localToWorld
    );
  }

  let clampedClickWorld: THREE.Vector3;

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

  const startWorld = clampedClickWorld.clone().addScaledVector(worldNormal, 0.5);
  const planeOrigin = startWorld.clone();

  const subtractions = shape.subtractionGeometries || [];

  let uPosT: number, uNegT: number, vPosT: number, vNegT: number;
  let useAnchors = false;

  if (anchorHitPoints && anchorHitPoints.size === 4) {
    const uPosHit = anchorHitPoints.get('u+')!;
    const uNegHit = anchorHitPoints.get('u-')!;
    const vPosHit = anchorHitPoints.get('v+')!;
    const vNegHit = anchorHitPoints.get('v-')!;

    uPosT = projectTo2D(uPosHit, planeOrigin, u, v).x;
    uNegT = -projectTo2D(uNegHit, planeOrigin, u, v).x;
    vPosT = projectTo2D(vPosHit, planeOrigin, u, v).y;
    vNegT = -projectTo2D(vNegHit, planeOrigin, u, v).y;

    if (uPosT > 0 && uNegT > 0 && vPosT > 0 && vNegT > 0) {
      useAnchors = true;
    }
  }

  if (!useAnchors) {
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
      const hit = castRayOnFaceWorld(startWorld, dir, boundaryEdgesWorld, obstacleEdges, u, v, planeOrigin, maxDist);
      hitPointsWorld.push(hit);
    }

    if (hitPointsWorld.length < 4) return null;

    uPosT = hitPointsWorld[0].distanceTo(startWorld);
    uNegT = hitPointsWorld[1].distanceTo(startWorld);
    vPosT = hitPointsWorld[2].distanceTo(startWorld);
    vNegT = hitPointsWorld[3].distanceTo(startWorld);
  }

  let rect2D: Point2D[] = ensureCCW([
    { x: uPosT!, y: vPosT! },
    { x: -uNegT!, y: vPosT! },
    { x: -uNegT!, y: -vNegT! },
    { x: uPosT!, y: -vNegT! },
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

  const newEdgeAnchors: EdgeAnchor[] = [];
  if (useAnchors && anchorHitPoints) {
    const dirLabels: Array<'u+' | 'u-' | 'v+' | 'v-'> = ['u+', 'u-', 'v+', 'v-'];
    for (const dirLabel of dirLabels) {
      const hitW = anchorHitPoints.get(dirLabel);
      if (!hitW) continue;
      const hitL = hitW.clone().applyMatrix4(worldToLocal);

      let bestEdge: { v1: THREE.Vector3; v2: THREE.Vector3 } | null = null;
      let bestDist = Infinity;
      let bestEdgeT = 0;
      for (const edge of uniqueBoundaryEdgesLocal) {
        const closest = new THREE.Vector3();
        const line = new THREE.Line3(edge.v1, edge.v2);
        line.closestPointToPoint(hitL, true, closest);
        const dist = closest.distanceTo(hitL);
        if (dist < bestDist) {
          bestDist = dist;
          bestEdge = edge;
          const eLen = edge.v1.distanceTo(edge.v2);
          bestEdgeT = eLen > 1e-8 ? edge.v1.distanceTo(closest) / eLen : 0;
        }
      }
      if (bestEdge) {
        newEdgeAnchors.push({
          edgeV1Local: [bestEdge.v1.x, bestEdge.v1.y, bestEdge.v1.z],
          edgeV2Local: [bestEdge.v2.x, bestEdge.v2.y, bestEdge.v2.z],
          t: Math.max(0, Math.min(1, bestEdgeT)),
          direction: dirLabel,
        });
      }
    }
  }

  return {
    ...vf,
    normal: [localNormal.x, localNormal.y, localNormal.z],
    center: [centerLocal.x, centerLocal.y, centerLocal.z],
    vertices: cornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
    raycastRecipe: {
      ...vf.raycastRecipe,
      edgeAnchors: newEdgeAnchors.length === 4 ? newEdgeAnchors : vf.raycastRecipe.edgeAnchors,
    },
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
