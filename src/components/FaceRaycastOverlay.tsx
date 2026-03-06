import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import type { VirtualFace } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  createFaceDescriptor,
  FaceData,
  CoplanarFaceGroup,
} from './FaceEditor';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RayLine { start: THREE.Vector3; end: THREE.Vector3 }
interface FaceRaycastOverlayProps { shape: any; allShapes?: any[] }
export type Point2D = { x: number; y: number };

interface PendingPreview {
  rayLines: RayLine[];
  originLocal: THREE.Vector3;
  geo: THREE.BufferGeometry;
  edgeGeo: THREE.BufferGeometry;
  virtualFace: VirtualFace;
}

// ─── Matrix / Projection Helpers ─────────────────────────────────────────────

export function getShapeMatrix(shape: any): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...shape.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation, 'XYZ')),
    new THREE.Vector3(...shape.scale)
  );
}

export function getFacePlaneAxes(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const n = normal.clone().normalize();
  const up = Math.abs(n.y) > Math.abs(n.x) && Math.abs(n.y) > Math.abs(n.z)
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(n, up).normalize();
  const v = new THREE.Vector3().crossVectors(u, n).normalize();
  return { u, v };
}

export function projectTo2D(p: THREE.Vector3, origin: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3): Point2D {
  const d = new THREE.Vector3().subVectors(p, origin);
  return { x: d.dot(u), y: d.dot(v) };
}

export function getSubtractionWorldMatrix(parentLocalToWorld: THREE.Matrix4, sub: any): THREE.Matrix4 {
  const box = new THREE.Box3().setFromBufferAttribute(sub.geometry.attributes.position as THREE.BufferAttribute);
  const size = new THREE.Vector3(); const center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const isCentered = Math.abs(center.x) < 0.01 && Math.abs(center.y) < 0.01 && Math.abs(center.z) < 0.01;
  const offset = isCentered ? new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2) : new THREE.Vector3();
  const groupMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...sub.relativeOffset),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(sub.relativeRotation || [0,0,0]), 'XYZ')),
    new THREE.Vector3(...(sub.scale || [1,1,1]))
  );
  return new THREE.Matrix4()
    .multiplyMatrices(parentLocalToWorld, groupMatrix)
    .multiply(new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z));
}

// ─── Edge Collection ──────────────────────────────────────────────────────────

function collectBoundaryEdgesWorld(faces: FaceData[], faceIndices: number[], localToWorld: THREE.Matrix4) {
  const edgeMap = new Map<string, { v1: THREE.Vector3; v2: THREE.Vector3; count: number }>();
  faceIndices.forEach(fi => {
    faces[fi]?.vertices.forEach((_, i, verts) => {
      const va = verts[i].clone().applyMatrix4(localToWorld);
      const vb = verts[(i + 1) % 3].clone().applyMatrix4(localToWorld);
      const ka = `${va.x.toFixed(2)},${va.y.toFixed(2)},${va.z.toFixed(2)}`;
      const kb = `${vb.x.toFixed(2)},${vb.y.toFixed(2)},${vb.z.toFixed(2)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { v1: va, v2: vb, count: 0 });
      edgeMap.get(key)!.count++;
    });
  });
  return Array.from(edgeMap.values()).filter(e => e.count === 1).map(({ v1, v2 }) => ({ v1, v2 }));
}

function collectEdgesOnPlane(
  matrix: THREE.Matrix4,
  geometry: THREE.BufferGeometry,
  normal: THREE.Vector3,
  origin: THREE.Vector3,
  tolerance: number
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const edges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];
  const edgesGeo = new THREE.EdgesGeometry(geometry);
  const pos = edgesGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 2) {
    const va = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix);
    const vb = new THREE.Vector3(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1)).applyMatrix4(matrix);
    const dA = Math.abs(normal.dot(new THREE.Vector3().subVectors(va, origin)));
    const dB = Math.abs(normal.dot(new THREE.Vector3().subVectors(vb, origin)));
    if (dA < tolerance && dB < tolerance) edges.push({ v1: va, v2: vb });
  }
  edgesGeo.dispose();
  return edges;
}

function collectPanelObstacleEdgesWorld(panels: any[], normal: THREE.Vector3, origin: THREE.Vector3, tol = 15) {
  return panels.flatMap(p => p.geometry ? collectEdgesOnPlane(getShapeMatrix(p), p.geometry, normal, origin, tol) : []);
}

function collectSubtractionObstacleEdgesWorld(subs: any[], parentLTW: THREE.Matrix4, normal: THREE.Vector3, origin: THREE.Vector3, tol = 20) {
  return subs.filter(s => s?.geometry).flatMap(s => collectEdgesOnPlane(getSubtractionWorldMatrix(parentLTW, s), s.geometry, normal, origin, tol));
}

function collectVirtualFaceObstacleEdgesWorld(
  vfs: VirtualFace[], excludeId: string | null,
  ltw: THREE.Matrix4, normal: THREE.Vector3, origin: THREE.Vector3, tol = 20
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  return vfs.filter(vf => vf.id !== excludeId && vf.vertices.length >= 3).flatMap(vf => {
    const wv = vf.vertices.map(v => new THREE.Vector3(...v).applyMatrix4(ltw));
    return wv.map((va, i) => {
      const vb = wv[(i + 1) % wv.length];
      const dA = Math.abs(normal.dot(new THREE.Vector3().subVectors(va, origin)));
      const dB = Math.abs(normal.dot(new THREE.Vector3().subVectors(vb, origin)));
      return dA < tol && dB < tol ? { v1: va, v2: vb } : null;
    }).filter(Boolean) as Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>;
  });
}

// ─── 2D Geometry ─────────────────────────────────────────────────────────────

function raySegmentIntersect2D(ox: number, oy: number, dx: number, dy: number, ax: number, ay: number, bx: number, by: number): number | null {
  const ex = bx - ax, ey = by - ay;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((ax - ox) * ey - (ay - oy) * ex) / denom;
  const s = ((ax - ox) * dy - (ay - oy) * dx) / denom;
  return t > 1e-4 && s >= -1e-4 && s <= 1 + 1e-4 ? t : null;
}

export function convexHull2D(points: Point2D[]): Point2D[] {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point2D, a: Point2D, b: Point2D) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (pts: Point2D[]) => pts.reduce<Point2D[]>((h, p) => {
    while (h.length >= 2 && cross(h[h.length-2], h[h.length-1], p) <= 0) h.pop();
    h.push(p); return h;
  }, []);
  const lower = build(sorted);
  const upper = build([...sorted].reverse());
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

export function ensureCCW(poly: Point2D[]): Point2D[] {
  let area = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; area += p.x * q.y - q.x * p.y; });
  return area < 0 ? [...poly].reverse() : poly;
}

export function isPointInsidePolygon(p: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const { x: xi, y: yi } = poly[i], { x: xj, y: yj } = poly[j];
    if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function lineIntersect2D(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
  const dx1 = p2.x-p1.x, dy1 = p2.y-p1.y, dx2 = p4.x-p3.x, dy2 = p4.y-p3.y;
  const denom = dx1*dy2 - dy1*dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x-p1.x)*dy2 - (p3.y-p1.y)*dx2) / denom;
  return { x: p1.x + t*dx1, y: p1.y + t*dy1 };
}

function segmentIntersect2D(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
  const dx1=p2.x-p1.x, dy1=p2.y-p1.y, dx2=p4.x-p3.x, dy2=p4.y-p3.y;
  const denom = dx1*dy2 - dy1*dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x-p1.x)*dy2 - (p3.y-p1.y)*dx2) / denom;
  const s = ((p3.x-p1.x)*dy1 - (p3.y-p1.y)*dx1) / denom;
  return t > 1e-6 && t < 1-1e-6 && s > 1e-6 && s < 1-1e-6
    ? { x: p1.x + t*dx1, y: p1.y + t*dy1 } : null;
}

function isInsideEdge(p: Point2D, a: Point2D, b: Point2D) {
  return (b.x-a.x)*(p.y-a.y) - (b.y-a.y)*(p.x-a.x) >= 0;
}

function sutherlandHodgmanClip(subject: Point2D[], clip: Point2D[]): Point2D[] {
  return clip.reduce<Point2D[]>((output, _, i) => {
    if (!output.length) return output;
    const input = [...output]; const result: Point2D[] = [];
    const eS = clip[i], eE = clip[(i+1) % clip.length];
    input.forEach((curr, j) => {
      const prev = input[(j + input.length - 1) % input.length];
      const cIn = isInsideEdge(curr, eS, eE), pIn = isInsideEdge(prev, eS, eE);
      if (cIn) { if (!pIn) { const x = lineIntersect2D(prev, curr, eS, eE); if (x) result.push(x); } result.push(curr); }
      else if (pIn) { const x = lineIntersect2D(prev, curr, eS, eE); if (x) result.push(x); }
    });
    return result;
  }, subject);
}

function findEdgeIntersections(a: Point2D, b: Point2D, edges: [Point2D, Point2D][]): Point2D[] {
  return edges.map(([e1, e2]) => segmentIntersect2D(a, b, e1, e2)).filter(Boolean) as Point2D[];
}

function traceHoleEdge(entryPoint: Point2D, hole: Point2D[], subject: Point2D[]): Point2D[] {
  const subEdges: [Point2D, Point2D][] = subject.map((p, i) => [p, subject[(i+1) % subject.length]]);
  let closestIdx = 0, minDist = Infinity;
  hole.forEach((p, i) => {
    const mid = { x: (p.x + hole[(i+1)%hole.length].x)/2, y: (p.y + hole[(i+1)%hole.length].y)/2 };
    const d = (mid.x-entryPoint.x)**2 + (mid.y-entryPoint.y)**2;
    if (d < minDist) { minDist = d; closestIdx = i; }
  });
  const trace: Point2D[] = [];
  for (let step = 0; step < hole.length; step++) {
    const idx = (closestIdx + 1 + step) % hole.length;
    const pt = hole[idx];
    if (!isPointInsidePolygon(pt, subject)) continue;
    trace.push(pt);
    const ints = findEdgeIntersections(pt, hole[(idx+1) % hole.length], subEdges);
    if (ints.length > 0) { trace.push(ints[0]); break; }
  }
  return trace;
}

export function subtractPolygon(subject: Point2D[], hole: Point2D[]): Point2D[] {
  const holeEdges: [Point2D, Point2D][] = hole.map((p, i) => [p, hole[(i+1) % hole.length]]);
  const EPS = 0.5;
  const result: Point2D[] = [];

  subject.forEach((pt, i) => {
    if (!isPointInsidePolygon(pt, hole)) result.push(pt);
    const ints = findEdgeIntersections(pt, subject[(i+1)%subject.length], holeEdges);
    ints.sort((a, b) => (a.x-pt.x)**2+(a.y-pt.y)**2 - ((b.x-pt.x)**2+(b.y-pt.y)**2));
    ints.forEach(inter => { result.push(inter); traceHoleEdge(inter, hole, subject).forEach(p => result.push(p)); });
  });

  if (result.length < 3) return subject;
  const dedup: Point2D[] = [result[0]];
  result.slice(1).forEach(p => {
    const prev = dedup[dedup.length-1];
    if (Math.abs(p.x-prev.x) > EPS || Math.abs(p.y-prev.y) > EPS) dedup.push(p);
  });
  const first = dedup[0], last = dedup[dedup.length-1];
  if (Math.abs(first.x-last.x) < EPS && Math.abs(first.y-last.y) < EPS) dedup.pop();
  return dedup.length >= 3 ? dedup : subject;
}

export function getSubtractorFootprints2D(
  subs: any[], parentLTW: THREE.Matrix4,
  normal: THREE.Vector3, origin: THREE.Vector3,
  u: THREE.Vector3, v: THREE.Vector3, tol = 50
): Point2D[][] {
  return subs.filter(s => s?.geometry).flatMap(sub => {
    const matrix = getSubtractionWorldMatrix(parentLTW, sub);
    const pos = sub.geometry.getAttribute('position');
    const onPlane = Array.from({ length: pos.count }, (_, i) =>
      new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix)
    ).filter(wp => Math.abs(normal.dot(new THREE.Vector3().subVectors(wp, origin))) < tol);
    if (onPlane.length < 3) return [];
    const hull = convexHull2D(onPlane.map(wp => projectTo2D(wp, origin, u, v)));
    return hull.length >= 3 ? [hull] : [];
  });
}

export function earClipTriangulate(verts: Point2D[]): number[] {
  if (verts.length < 3) return [];
  if (verts.length === 3) return [0, 1, 2];

  const sign = (p1: Point2D, p2: Point2D, p3: Point2D) =>
    (p1.x-p3.x)*(p2.y-p3.y) - (p2.x-p3.x)*(p1.y-p3.y);
  const inTri = (p: Point2D, a: Point2D, b: Point2D, c: Point2D) => {
    const d = [sign(p,a,b), sign(p,b,c), sign(p,c,a)];
    return !(d.some(x=>x<0) && d.some(x=>x>0));
  };

  const indices: number[] = [];
  const rem = verts.map((_, i) => i);
  let safety = rem.length * rem.length;

  while (rem.length > 3 && safety-- > 0) {
    let found = false;
    for (let i = 0; i < rem.length; i++) {
      const pi = (i+rem.length-1)%rem.length, ni = (i+1)%rem.length;
      const [a, b, c] = [verts[rem[pi]], verts[rem[i]], verts[rem[ni]]];
      const cross = (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
      if (cross < 1e-10) continue;
      if (rem.every((r, j) => j===pi||j===i||j===ni || !inTri(verts[r], a, b, c))) {
        indices.push(rem[pi], rem[i], rem[ni]);
        rem.splice(i, 1); found = true; break;
      }
    }
    if (!found) rem.reverse();
  }
  if (rem.length === 3) indices.push(...rem);
  return indices;
}

// ─── Raycasting ───────────────────────────────────────────────────────────────

function castRayOnFaceWorld(
  originW: THREE.Vector3, dirW: THREE.Vector3,
  boundaryEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  u: THREE.Vector3, v: THREE.Vector3, planeOrigin: THREE.Vector3, maxDist: number
): THREE.Vector3 {
  const o2d = projectTo2D(originW, planeOrigin, u, v);
  const dir2d = { x: dirW.dot(u), y: dirW.dot(v) };
  let tMin = maxDist;
  const checkEdges = (edges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>) => {
    edges.forEach(({ v1, v2 }) => {
      const a = projectTo2D(v1, planeOrigin, u, v);
      const b = projectTo2D(v2, planeOrigin, u, v);
      const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a.x, a.y, b.x, b.y);
      if (t !== null && t < tMin) tMin = t;
    });
  };
  checkEdges(boundaryEdges);
  checkEdges(obstacleEdges);
  return originW.clone().addScaledVector(dirW, tMin);
}

// ─── Preview Builder ──────────────────────────────────────────────────────────

function buildPreview(
  clickWorld: THREE.Vector3, group: CoplanarFaceGroup, faces: FaceData[],
  localToWorld: THREE.Matrix4, worldToLocal: THREE.Matrix4,
  childPanels: any[], shapeId: string, subtractions: any[] = [],
  geometry?: THREE.BufferGeometry, shapeVFs: VirtualFace[] = []
): PendingPreview | null {
  const localNormal = group.normal.clone().normalize();
  const worldNormal = localNormal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(localToWorld)).normalize();
  const { u, v } = getFacePlaneAxes(worldNormal);
  const planeOrigin = clickWorld.clone();

  const boundaryEdges = collectBoundaryEdgesWorld(faces, group.faceIndices, localToWorld);
  const obstacleEdges = [
    ...collectPanelObstacleEdgesWorld(childPanels, worldNormal, planeOrigin, 20),
    ...collectSubtractionObstacleEdgesWorld(subtractions, localToWorld, worldNormal, planeOrigin, 20),
    ...collectVirtualFaceObstacleEdgesWorld(shapeVFs, null, localToWorld, worldNormal, planeOrigin, 20),
  ];

  const parentPos = new THREE.Vector3();
  localToWorld.decompose(parentPos, new THREE.Quaternion(), new THREE.Vector3());
  const startWorld = clickWorld.clone().add(worldNormal.clone().multiplyScalar(0.5));

  const [uPosHit, uNegHit, vPosHit, vNegHit] = [u, u.clone().negate(), v, v.clone().negate()]
    .map(dir => castRayOnFaceWorld(startWorld, dir, boundaryEdges, obstacleEdges, u, v, planeOrigin, 5000));

  const lines: RayLine[] = [uPosHit, uNegHit, vPosHit, vNegHit].map(hit => ({
    start: startWorld.clone().sub(parentPos),
    end: hit.clone().sub(parentPos),
  }));

  let rect2D = ensureCCW([
    { x:  uPosHit.distanceTo(startWorld), y:  vPosHit.distanceTo(startWorld) },
    { x: -uNegHit.distanceTo(startWorld), y:  vPosHit.distanceTo(startWorld) },
    { x: -uNegHit.distanceTo(startWorld), y: -vNegHit.distanceTo(startWorld) },
    { x:  uPosHit.distanceTo(startWorld), y: -vNegHit.distanceTo(startWorld) },
  ]);

  let clippedPoly = rect2D;
  for (const fp of getSubtractorFootprints2D(subtractions, localToWorld, worldNormal, planeOrigin, u, v, 50)) {
    const ccwFP = ensureCCW(fp);
    const hasOverlap = ccwFP.some(p => isPointInsidePolygon(p, clippedPoly)) ||
      clippedPoly.some(p => isPointInsidePolygon(p, ccwFP));
    if (hasOverlap) clippedPoly = subtractPolygon(clippedPoly, ccwFP);
  }
  if (clippedPoly.length < 3) return null;

  const finalCornersWorld = clippedPoly.map(p =>
    startWorld.clone().addScaledVector(u, p.x).addScaledVector(v, p.y)
  );
  const centerW = finalCornersWorld.reduce((acc, c) => acc.add(c), new THREE.Vector3()).divideScalar(finalCornersWorld.length);
  const cornersLocal = finalCornersWorld.map(c => c.clone().applyMatrix4(worldToLocal));
  const centerLocal = centerW.clone().applyMatrix4(worldToLocal);

  const triIndices = earClipTriangulate(clippedPoly);
  const positions = new Float32Array(triIndices.length * 3);
  triIndices.forEach((ti, i) => { const c = cornersLocal[ti]; positions.set([c.x, c.y, c.z], i*3); });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const edgeVerts: number[] = [];
  cornersLocal.forEach((a, i) => {
    const b = cornersLocal[(i+1) % cornersLocal.length];
    edgeVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeVerts), 3));

  const clickLocal = clickWorld.clone().applyMatrix4(worldToLocal);
  const repFace = faces[group.faceIndices[0]];
  const faceGroupDescriptor = geometry && repFace ? createFaceDescriptor(repFace, geometry) : undefined;

  const virtualFace: VirtualFace = {
    id: `vf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    shapeId,
    normal: [localNormal.x, localNormal.y, localNormal.z],
    center: [centerLocal.x, centerLocal.y, centerLocal.z],
    vertices: cornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
    role: null, description: '', hasPanel: false,
    raycastRecipe: faceGroupDescriptor ? {
      clickLocalPoint: [clickLocal.x, clickLocal.y, clickLocal.z],
      faceGroupNormal: [localNormal.x, localNormal.y, localNormal.z],
      faceGroupDescriptor,
    } : undefined,
  };

  return { rayLines: lines, originLocal: startWorld.clone().sub(parentPos), geo, edgeGeo, virtualFace };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const RayLine3D = React.memo(({ start, end }: RayLine) => {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([start, end]),
    [start.x, start.y, start.z, end.x, end.y, end.z]);
  return <lineSegments geometry={geometry}><lineBasicMaterial color={0xf97316} linewidth={2} depthTest={false} transparent opacity={0.9} /></lineSegments>;
});
RayLine3D.displayName = 'RayLine3D';

const HitDot = React.memo(({ position }: { position: THREE.Vector3 }) => (
  <mesh position={[position.x, position.y, position.z]}>
    <sphereGeometry args={[2.5, 8, 8]} />
    <meshBasicMaterial color={0xef4444} depthTest={false} transparent opacity={0.9} />
  </mesh>
));
HitDot.displayName = 'HitDot';

const OriginDot = React.memo(({ position }: { position: THREE.Vector3 }) => (
  <mesh position={[position.x, position.y, position.z]}>
    <sphereGeometry args={[3.5, 8, 8]} />
    <meshBasicMaterial color={0xfbbf24} depthTest={false} transparent opacity={0.95} />
  </mesh>
));
OriginDot.displayName = 'OriginDot';

// ─── Main Component ───────────────────────────────────────────────────────────

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape, allShapes = [] }) => {
  const { raycastMode, addVirtualFace, virtualFaces } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingPreview | null>(null);

  const shapeVFs = useMemo(() => virtualFaces.filter(vf => vf.shapeId === shape.id), [virtualFaces, shape.id]);
  const localToWorld = useMemo(() => getShapeMatrix(shape), [shape.position, shape.rotation, shape.scale]);
  const worldToLocal = useMemo(() => localToWorld.clone().invert(), [localToWorld]);
  const childPanels = useMemo(() => allShapes.filter(s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id), [allShapes, shape.id]);

  useEffect(() => {
    if (!shape.geometry) return;
    const f = extractFacesFromGeometry(shape.geometry);
    setFaces(f);
    setFaceGroups(groupCoplanarFaces(f));
    setPending(null);
  }, [shape.geometry, shape.id, shape.geometry?.uuid]);

  useEffect(() => { if (!raycastMode) { setHoveredGroupIndex(null); setPending(null); } }, [raycastMode]);

  const hoverHighlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;
    return createFaceHighlightGeometry(faces, faceGroups[hoveredGroupIndex].faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const confirmPending = () => {
    if (pending) { addVirtualFace(pending.virtualFace); setPending(null); }
  };

  const handlePointerMove = (e: any) => {
    if (!raycastMode || !faces.length) return;
    e.stopPropagation();
    if (e.faceIndex !== undefined) {
      const gi = faceGroups.findIndex(g => g.faceIndices.includes(e.faceIndex));
      if (gi !== -1) setHoveredGroupIndex(gi);
    }
  };

  const handlePointerDown = (e: any) => {
    if (!raycastMode) return;
    e.stopPropagation();
    if (e.button === 2) { e.nativeEvent?.preventDefault?.(); confirmPending(); return; }
    if (e.button !== 0 || hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return;
    setPending(buildPreview(
      e.point.clone(), faceGroups[hoveredGroupIndex], faces,
      localToWorld, worldToLocal, childPanels, shape.id,
      shape.subtractionGeometries || [], shape.geometry, shapeVFs
    ));
  };

  if (!raycastMode) return null;

  return (
    <>
      <mesh
        geometry={shape.geometry} visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={(e: any) => { e.stopPropagation(); setHoveredGroupIndex(null); }}
        onPointerDown={handlePointerDown}
        onContextMenu={(e: any) => { e.stopPropagation(); e.nativeEvent?.preventDefault?.(); confirmPending(); }}
      />

      {hoverHighlightGeometry && !pending && (
        <mesh geometry={hoverHighlightGeometry}>
          <meshBasicMaterial color={0xfbbf24} transparent opacity={0.35} side={THREE.DoubleSide}
            polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
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
            <meshBasicMaterial color={0x22c55e} transparent opacity={0.5} side={THREE.DoubleSide}
              polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} depthTest={false} />
          </mesh>
          <lineSegments geometry={pending.edgeGeo}>
            <lineBasicMaterial color={0x16a34a} linewidth={2} depthTest={false} transparent opacity={0.9} />
          </lineSegments>
        </>
      )}
    </>
  );
};
