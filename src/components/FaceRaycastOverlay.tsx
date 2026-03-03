import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import type { VirtualFace } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  FaceData,
  CoplanarFaceGroup,
} from './FaceEditor';

interface RayLine {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface FaceRaycastOverlayProps {
  shape: any;
  allShapes?: any[];
}

function getFacePlaneAxes(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const n = normal.clone().normalize();
  const absX = Math.abs(n.x);
  const absY = Math.abs(n.y);
  const absZ = Math.abs(n.z);

  let up: THREE.Vector3;
  if (absY > absX && absY > absZ) {
    up = new THREE.Vector3(1, 0, 0);
  } else {
    up = new THREE.Vector3(0, 1, 0);
  }

  const u = new THREE.Vector3().crossVectors(n, up).normalize();
  const v = new THREE.Vector3().crossVectors(u, n).normalize();
  return { u, v };
}

function getShapeMatrix(shape: any): THREE.Matrix4 {
  const pos = new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]);
  const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(shape.rotation[0], shape.rotation[1], shape.rotation[2], 'XYZ')
  );
  const scale = new THREE.Vector3(shape.scale[0], shape.scale[1], shape.scale[2]);
  return new THREE.Matrix4().compose(pos, quat, scale);
}

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

function projectTo2D(
  p: THREE.Vector3,
  origin: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3
): { x: number; y: number } {
  const d = new THREE.Vector3().subVectors(p, origin);
  return { x: d.dot(u), y: d.dot(v) };
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

function collectPanelObstacleEdgesWorld(
  panelShapes: any[],
  facePlaneNormal: THREE.Vector3,
  facePlaneOrigin: THREE.Vector3,
  planeTolerance: number = 15
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];

  for (const panel of panelShapes) {
    if (!panel.geometry) continue;

    const panelMatrix = getShapeMatrix(panel);
    const edgesGeo = new THREE.EdgesGeometry(panel.geometry);
    const edgePos = edgesGeo.getAttribute('position');
    const count = edgePos.count;

    for (let i = 0; i < count; i += 2) {
      const va = new THREE.Vector3(edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i)).applyMatrix4(panelMatrix);
      const vb = new THREE.Vector3(edgePos.getX(i + 1), edgePos.getY(i + 1), edgePos.getZ(i + 1)).applyMatrix4(panelMatrix);

      const distA = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(va, facePlaneOrigin)));
      const distB = Math.abs(facePlaneNormal.dot(new THREE.Vector3().subVectors(vb, facePlaneOrigin)));

      if (distA < planeTolerance && distB < planeTolerance) {
        obstacleEdges.push({ v1: va, v2: vb });
      }
    }
    edgesGeo.dispose();
  }
  return obstacleEdges;
}

type Point2D = { x: number; y: number };

function sutherlandHodgmanClip(subject: Point2D[], clip: Point2D[]): Point2D[] {
  let output = [...subject];

  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const input = [...output];
    output = [];
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const prev = input[(j + input.length - 1) % input.length];

      const currInside = isInsideEdge(current, edgeStart, edgeEnd);
      const prevInside = isInsideEdge(prev, edgeStart, edgeEnd);

      if (currInside) {
        if (!prevInside) {
          const inter = lineIntersect2D(prev, current, edgeStart, edgeEnd);
          if (inter) output.push(inter);
        }
        output.push(current);
      } else if (prevInside) {
        const inter = lineIntersect2D(prev, current, edgeStart, edgeEnd);
        if (inter) output.push(inter);
      }
    }
  }
  return output;
}

function isInsideEdge(p: Point2D, edgeStart: Point2D, edgeEnd: Point2D): boolean {
  return (edgeEnd.x - edgeStart.x) * (p.y - edgeStart.y) - (edgeEnd.y - edgeStart.y) * (p.x - edgeStart.x) >= 0;
}

function lineIntersect2D(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

function subtractPolygon(subject: Point2D[], hole: Point2D[]): Point2D[] {
  const invertedHole = [...hole].reverse();
  const clipped = sutherlandHodgmanClip(subject, invertedHole);
  if (clipped.length < 3) return subject;

  const subjectEdges: [Point2D, Point2D][] = [];
  for (let i = 0; i < subject.length; i++) {
    subjectEdges.push([subject[i], subject[(i + 1) % subject.length]]);
  }

  const holeEdges: [Point2D, Point2D][] = [];
  for (let i = 0; i < hole.length; i++) {
    holeEdges.push([hole[i], hole[(i + 1) % hole.length]]);
  }

  const result: Point2D[] = [];
  const EPS = 0.5;

  for (let i = 0; i < subject.length; i++) {
    const pt = subject[i];
    if (!isPointInsidePolygon(pt, hole)) {
      result.push(pt);
    }

    const nextIdx = (i + 1) % subject.length;
    const intersections = findEdgeIntersections(pt, subject[nextIdx], holeEdges);
    intersections.sort((a, b) => {
      const da = (a.x - pt.x) ** 2 + (a.y - pt.y) ** 2;
      const db = (b.x - pt.x) ** 2 + (b.y - pt.y) ** 2;
      return da - db;
    });

    for (const inter of intersections) {
      result.push(inter);

      const holeTraversal = traceHoleEdge(inter, hole, subject);
      for (const hp of holeTraversal) {
        result.push(hp);
      }
    }
  }

  if (result.length < 3) return subject;

  const deduplicated: Point2D[] = [result[0]];
  for (let i = 1; i < result.length; i++) {
    const prev = deduplicated[deduplicated.length - 1];
    if (Math.abs(result[i].x - prev.x) > EPS || Math.abs(result[i].y - prev.y) > EPS) {
      deduplicated.push(result[i]);
    }
  }

  if (deduplicated.length >= 2) {
    const first = deduplicated[0];
    const last = deduplicated[deduplicated.length - 1];
    if (Math.abs(first.x - last.x) < EPS && Math.abs(first.y - last.y) < EPS) {
      deduplicated.pop();
    }
  }

  return deduplicated.length >= 3 ? deduplicated : subject;
}

function isPointInsidePolygon(p: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function findEdgeIntersections(
  a: Point2D, b: Point2D,
  edges: [Point2D, Point2D][]
): Point2D[] {
  const results: Point2D[] = [];
  for (const [e1, e2] of edges) {
    const inter = segmentIntersect2D(a, b, e1, e2);
    if (inter) results.push(inter);
  }
  return results;
}

function segmentIntersect2D(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
  const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x, dy2 = p4.y - p3.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const s = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;
  if (t > 1e-6 && t < 1 - 1e-6 && s > 1e-6 && s < 1 - 1e-6) {
    return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
  }
  return null;
}

function traceHoleEdge(
  entryPoint: Point2D,
  hole: Point2D[],
  subject: Point2D[]
): Point2D[] {
  const subjectEdges: [Point2D, Point2D][] = [];
  for (let i = 0; i < subject.length; i++) {
    subjectEdges.push([subject[i], subject[(i + 1) % subject.length]]);
  }

  let closestEdgeIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < hole.length; i++) {
    const mid = {
      x: (hole[i].x + hole[(i + 1) % hole.length].x) / 2,
      y: (hole[i].y + hole[(i + 1) % hole.length].y) / 2,
    };
    const d = (mid.x - entryPoint.x) ** 2 + (mid.y - entryPoint.y) ** 2;
    if (d < minDist) {
      minDist = d;
      closestEdgeIdx = i;
    }
  }

  const trace: Point2D[] = [];
  let startIdx = (closestEdgeIdx + 1) % hole.length;

  for (let step = 0; step < hole.length; step++) {
    const idx = (startIdx + step) % hole.length;
    const pt = hole[idx];

    if (!isPointInsidePolygon(pt, subject)) continue;

    trace.push(pt);

    const nextIdx = (idx + 1) % hole.length;
    const intersections = findEdgeIntersections(pt, hole[nextIdx], subjectEdges);
    if (intersections.length > 0) {
      trace.push(intersections[0]);
      break;
    }
  }

  return trace;
}

function earClipTriangulate(vertices: Point2D[]): number[] {
  if (vertices.length < 3) return [];
  if (vertices.length === 3) return [0, 1, 2];

  const indices: number[] = [];
  const remaining = vertices.map((_, i) => i);

  let safety = remaining.length * remaining.length;
  while (remaining.length > 3 && safety > 0) {
    safety--;
    let earFound = false;

    for (let i = 0; i < remaining.length; i++) {
      const prevIdx = (i + remaining.length - 1) % remaining.length;
      const nextIdx = (i + 1) % remaining.length;

      const a = vertices[remaining[prevIdx]];
      const b = vertices[remaining[i]];
      const c = vertices[remaining[nextIdx]];

      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross < 1e-10) continue;

      let isEar = true;
      for (let j = 0; j < remaining.length; j++) {
        if (j === prevIdx || j === i || j === nextIdx) continue;
        if (pointInTriangle(vertices[remaining[j]], a, b, c)) {
          isEar = false;
          break;
        }
      }

      if (isEar) {
        indices.push(remaining[prevIdx], remaining[i], remaining[nextIdx]);
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      remaining.reverse();
    }
  }

  if (remaining.length === 3) {
    indices.push(remaining[0], remaining[1], remaining[2]);
  }

  return indices;
}

function pointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function sign(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function ensureCCW(poly: Point2D[]): Point2D[] {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].y;
    area -= poly[j].x * poly[i].y;
  }
  return area < 0 ? [...poly].reverse() : poly;
}

interface PendingPreview {
  rayLines: RayLine[];
  originLocal: THREE.Vector3;
  geo: THREE.BufferGeometry;
  edgeGeo: THREE.BufferGeometry;
  virtualFace: VirtualFace;
}

function chainBoundaryEdges(
  edges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>
): THREE.Vector3[][] {
  if (edges.length === 0) return [];

  const EPS = 0.5;
  const keyFn = (v: THREE.Vector3) => `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`;

  const adj = new Map<string, Array<{ to: THREE.Vector3; toKey: string; edgeIdx: number }>>();
  edges.forEach((e, idx) => {
    const k1 = keyFn(e.v1);
    const k2 = keyFn(e.v2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push({ to: e.v2, toKey: k2, edgeIdx: idx });
    adj.get(k2)!.push({ to: e.v1, toKey: k1, edgeIdx: idx });
  });

  const usedEdges = new Set<number>();
  const loops: THREE.Vector3[][] = [];

  for (const [startKey] of adj) {
    const startNeighbors = adj.get(startKey)!;
    const availableStart = startNeighbors.find(n => !usedEdges.has(n.edgeIdx));
    if (!availableStart) continue;

    const loop: THREE.Vector3[] = [];
    let currentKey = startKey;

    const firstEdge = availableStart;
    usedEdges.add(firstEdge.edgeIdx);

    const startEdge = edges[firstEdge.edgeIdx];
    const startVert = keyFn(startEdge.v1) === startKey ? startEdge.v1 : startEdge.v2;
    loop.push(startVert);

    currentKey = firstEdge.toKey;
    loop.push(firstEdge.to);

    let safety = edges.length + 2;
    while (currentKey !== startKey && safety > 0) {
      safety--;
      const neighbors = adj.get(currentKey);
      if (!neighbors) break;
      const next = neighbors.find(n => !usedEdges.has(n.edgeIdx));
      if (!next) break;
      usedEdges.add(next.edgeIdx);
      currentKey = next.toKey;
      if (currentKey !== startKey) {
        loop.push(next.to);
      }
    }

    if (loop.length >= 3) {
      loops.push(loop);
    }
  }

  return loops;
}

function selectContainingLoop(
  loops: THREE.Vector3[][],
  clickWorld: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
  planeOrigin: THREE.Vector3
): THREE.Vector3[] | null {
  const click2D = projectTo2D(clickWorld, planeOrigin, u, v);

  for (const loop of loops) {
    const poly2D = loop.map(p => projectTo2D(p, planeOrigin, u, v));
    if (isPointInsidePolygon(click2D, poly2D)) {
      return loop;
    }
  }

  if (loops.length > 0) {
    let bestLoop = loops[0];
    let bestArea = 0;
    for (const loop of loops) {
      const poly2D = loop.map(p => projectTo2D(p, planeOrigin, u, v));
      let area = 0;
      for (let i = 0; i < poly2D.length; i++) {
        const j = (i + 1) % poly2D.length;
        area += poly2D[i].x * poly2D[j].y - poly2D[j].x * poly2D[i].y;
      }
      const absArea = Math.abs(area);
      if (absArea > bestArea) {
        bestArea = absArea;
        bestLoop = loop;
      }
    }
    return bestLoop;
  }

  return null;
}

function simplifyPolygon(points: Point2D[], tolerance: number = 1.0): Point2D[] {
  if (points.length <= 3) return points;

  const result: Point2D[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i + points.length - 1) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 < 1e-6 || len2 < 1e-6) continue;

    const cross = Math.abs(dx1 * dy2 - dy1 * dx2) / (len1 * len2);
    if (cross > tolerance * 0.01) {
      result.push(curr);
    }
  }

  return result.length >= 3 ? result : points;
}

function buildPreview(
  clickWorld: THREE.Vector3,
  group: CoplanarFaceGroup,
  faces: FaceData[],
  localToWorld: THREE.Matrix4,
  worldToLocal: THREE.Matrix4,
  childPanels: any[],
  shapeId: string
): PendingPreview | null {
  const localNormal = group.normal.clone().normalize();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

  const { u, v } = getFacePlaneAxes(worldNormal);
  const planeOrigin = clickWorld.clone();

  const parentPos = new THREE.Vector3();
  localToWorld.decompose(parentPos, new THREE.Quaternion(), new THREE.Vector3());

  const boundaryEdges = collectBoundaryEdgesWorld(faces, group.faceIndices, localToWorld);
  const loops = chainBoundaryEdges(boundaryEdges);

  const selectedLoop = selectContainingLoop(loops, clickWorld, u, v, planeOrigin);
  if (!selectedLoop || selectedLoop.length < 3) return null;

  let poly2D = selectedLoop.map(p => projectTo2D(p, planeOrigin, u, v));
  poly2D = ensureCCW(poly2D);
  poly2D = simplifyPolygon(poly2D, 0.5);

  if (poly2D.length < 3) return null;

  const panelEdges = collectPanelObstacleEdgesWorld(childPanels, worldNormal, planeOrigin, 20);
  if (panelEdges.length > 0) {
    const panelLoops = chainBoundaryEdges(panelEdges);
    for (const pLoop of panelLoops) {
      if (pLoop.length < 3) continue;
      let panelPoly = pLoop.map(p => projectTo2D(p, planeOrigin, u, v));
      panelPoly = ensureCCW(panelPoly);
      const hasOverlap = panelPoly.some(p => isPointInsidePolygon(p, poly2D)) ||
        poly2D.some(p => isPointInsidePolygon(p, panelPoly));
      if (hasOverlap) {
        poly2D = subtractPolygon(poly2D, panelPoly);
      }
    }
  }

  if (poly2D.length < 3) return null;

  const finalCornersWorld = poly2D.map(p =>
    planeOrigin.clone().addScaledVector(u, p.x).addScaledVector(v, p.y)
  );

  const centerW = new THREE.Vector3();
  finalCornersWorld.forEach(c => centerW.add(c));
  centerW.divideScalar(finalCornersWorld.length);

  const cornersLocal = finalCornersWorld.map(c => c.clone().applyMatrix4(worldToLocal));
  const centerLocal = centerW.clone().applyMatrix4(worldToLocal);

  const ccwPoly = ensureCCW(poly2D);
  const triIndices = earClipTriangulate(ccwPoly);
  const localPositions = new Float32Array(triIndices.length * 3);
  for (let i = 0; i < triIndices.length; i++) {
    const cl = cornersLocal[triIndices[i]];
    localPositions[i * 3] = cl.x;
    localPositions[i * 3 + 1] = cl.y;
    localPositions[i * 3 + 2] = cl.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(localPositions, 3));
  geo.computeVertexNormals();

  const edgeVerts: number[] = [];
  for (let i = 0; i < cornersLocal.length; i++) {
    const a = cornersLocal[i];
    const b = cornersLocal[(i + 1) % cornersLocal.length];
    edgeVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeVerts), 3));

  const offset = worldNormal.clone().multiplyScalar(0.5);
  const startWorld = clickWorld.clone().add(offset);
  const directions = [u, u.clone().negate(), v, v.clone().negate()];
  const lines: RayLine[] = [];

  for (const dir of directions) {
    const o2d = projectTo2D(startWorld, planeOrigin, u, v);
    const dir2d = { x: dir.dot(u), y: dir.dot(v) };
    let tMin = 5000;

    for (let i = 0; i < poly2D.length; i++) {
      const a2d = poly2D[i];
      const b2d = poly2D[(i + 1) % poly2D.length];
      const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a2d.x, a2d.y, b2d.x, b2d.y);
      if (t !== null && t < tMin) tMin = t;
    }

    const hitWorld = startWorld.clone().addScaledVector(dir, tMin);
    lines.push({
      start: startWorld.clone().sub(parentPos),
      end: hitWorld.clone().sub(parentPos),
    });
  }

  const newId = `vf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const virtualFace: VirtualFace = {
    id: newId,
    shapeId,
    normal: [localNormal.x, localNormal.y, localNormal.z],
    center: [centerLocal.x, centerLocal.y, centerLocal.z],
    vertices: cornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
    role: null,
    description: '',
    hasPanel: false,
  };

  return {
    rayLines: lines,
    originLocal: clickWorld.clone().sub(parentPos),
    geo,
    edgeGeo,
    virtualFace,
  };
}

const RayLine3D: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = React.memo(
  ({ start, end }) => {
    const geometry = useMemo(() => {
      return new THREE.BufferGeometry().setFromPoints([start, end]);
    }, [start.x, start.y, start.z, end.x, end.y, end.z]);

    return (
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={0xf97316} linewidth={2} depthTest={false} transparent opacity={0.9} />
      </lineSegments>
    );
  }
);
RayLine3D.displayName = 'RayLine3D';

const HitDot: React.FC<{ position: THREE.Vector3 }> = React.memo(({ position }) => (
  <mesh position={[position.x, position.y, position.z]}>
    <sphereGeometry args={[2.5, 8, 8]} />
    <meshBasicMaterial color={0xef4444} depthTest={false} transparent opacity={0.9} />
  </mesh>
));
HitDot.displayName = 'HitDot';

const OriginDot: React.FC<{ position: THREE.Vector3 }> = React.memo(({ position }) => (
  <mesh position={[position.x, position.y, position.z]}>
    <sphereGeometry args={[3.5, 8, 8]} />
    <meshBasicMaterial color={0xfbbf24} depthTest={false} transparent opacity={0.95} />
  </mesh>
));
OriginDot.displayName = 'OriginDot';

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape, allShapes = [] }) => {
  const { raycastMode, addVirtualFace, virtualFaces } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingPreview | null>(null);

  const geometryUuid = shape.geometry?.uuid || '';

  const localToWorld = useMemo(() => getShapeMatrix(shape), [
    shape.position[0], shape.position[1], shape.position[2],
    shape.rotation[0], shape.rotation[1], shape.rotation[2],
    shape.scale[0], shape.scale[1], shape.scale[2],
  ]);

  const worldToLocal = useMemo(() => localToWorld.clone().invert(), [localToWorld]);

  useEffect(() => {
    if (!shape.geometry) return;
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    setFaces(extractedFaces);
    setFaceGroups(groupCoplanarFaces(extractedFaces));
    setPending(null);
  }, [shape.geometry, shape.id, geometryUuid]);

  useEffect(() => {
    if (!raycastMode) {
      setHoveredGroupIndex(null);
      setPending(null);
    }
  }, [raycastMode]);

  const childPanels = useMemo(() => {
    return allShapes.filter(s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id);
  }, [allShapes, shape.id]);

  const hoverHighlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;
    return createFaceHighlightGeometry(faces, faceGroups[hoveredGroupIndex].faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const handlePointerMove = (e: any) => {
    if (!raycastMode || faces.length === 0) return;
    e.stopPropagation();
    const fi = e.faceIndex;
    if (fi !== undefined) {
      const gi = faceGroups.findIndex(g => g.faceIndices.includes(fi));
      if (gi !== -1) setHoveredGroupIndex(gi);
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredGroupIndex(null);
  };

  const handlePointerDown = (e: any) => {
    if (!raycastMode) return;

    if (e.button === 2) {
      e.stopPropagation();
      e.nativeEvent?.preventDefault?.();
      if (pending) {
        addVirtualFace(pending.virtualFace);
        setPending(null);
      }
      return;
    }

    if (e.button !== 0) return;
    e.stopPropagation();

    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return;

    const clickWorld: THREE.Vector3 = e.point.clone();
    const group = faceGroups[hoveredGroupIndex];

    const preview = buildPreview(
      clickWorld,
      group,
      faces,
      localToWorld,
      worldToLocal,
      childPanels,
      shape.id
    );

    setPending(preview);
  };

  const handleContextMenu = (e: any) => {
    e.stopPropagation();
    e.nativeEvent?.preventDefault?.();
    if (pending) {
      addVirtualFace(pending.virtualFace);
      setPending(null);
    }
  };

  if (!raycastMode) return null;

  return (
    <>
      <mesh
        geometry={shape.geometry}
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
      />

      {hoverHighlightGeometry && !pending && (
        <mesh geometry={hoverHighlightGeometry}>
          <meshBasicMaterial
            color={0xfbbf24}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {pending && (
        <>
          <OriginDot position={pending.originLocal} />
          {pending.rayLines.map((line, i) => (
            <React.Fragment key={i}>
              <RayLine3D start={line.start} end={line.end} />
              <HitDot position={line.end} />
            </React.Fragment>
          ))}
          <mesh geometry={pending.geo}>
            <meshBasicMaterial
              color={0x22c55e}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
              depthTest={false}
            />
          </mesh>
          <lineSegments geometry={pending.edgeGeo}>
            <lineBasicMaterial color={0x16a34a} linewidth={2} depthTest={false} transparent opacity={0.9} />
          </lineSegments>
        </>
      )}
    </>
  );
};
