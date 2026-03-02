import * as THREE from 'three';
import type { FaceData } from './FaceEditor';

export function getFacePlaneAxes(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
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
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { u, v };
}

export function collectBoundaryEdges(
  faces: FaceData[],
  faceIndices: number[]
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const edgeMap = new Map<string, { v1: THREE.Vector3; v2: THREE.Vector3; count: number }>();

  faceIndices.forEach(fi => {
    const face = faces[fi];
    if (!face) return;
    const verts = face.vertices;
    for (let i = 0; i < 3; i++) {
      const va = verts[i];
      const vb = verts[(i + 1) % 3];
      const ka = `${va.x.toFixed(3)},${va.y.toFixed(3)},${va.z.toFixed(3)}`;
      const kb = `${vb.x.toFixed(3)},${vb.y.toFixed(3)},${vb.z.toFixed(3)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { v1: va.clone(), v2: vb.clone(), count: 0 });
      }
      edgeMap.get(key)!.count++;
    }
  });

  const boundary: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];
  edgeMap.forEach(e => {
    if (e.count === 1) {
      boundary.push({ v1: e.v1, v2: e.v2 });
    }
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

export function collectPanelObstacleEdges(
  panelShapes: any[],
  facePlaneNormal: THREE.Vector3,
  facePlaneOrigin: THREE.Vector3,
  planeTolerance: number = 15
): Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> {
  const obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }> = [];

  for (const panel of panelShapes) {
    if (!panel.geometry) continue;

    const panelPos = new THREE.Vector3(...(panel.position as [number, number, number]));
    const panelRot = panel.rotation as [number, number, number];
    const panelScale = panel.scale as [number, number, number];

    const panelMatrix = new THREE.Matrix4().compose(
      panelPos,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(panelRot[0], panelRot[1], panelRot[2], 'XYZ')),
      new THREE.Vector3(panelScale[0], panelScale[1], panelScale[2])
    );

    const edgesGeo = new THREE.EdgesGeometry(panel.geometry);
    const edgePos = edgesGeo.getAttribute('position');
    const count = edgePos.count;

    for (let i = 0; i < count; i += 2) {
      const va = new THREE.Vector3(
        edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i)
      ).applyMatrix4(panelMatrix);
      const vb = new THREE.Vector3(
        edgePos.getX(i + 1), edgePos.getY(i + 1), edgePos.getZ(i + 1)
      ).applyMatrix4(panelMatrix);

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

export function castRayOnFace(
  originWorld: THREE.Vector3,
  dirWorld: THREE.Vector3,
  boundaryEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>,
  u: THREE.Vector3,
  v: THREE.Vector3,
  planeOrigin: THREE.Vector3,
  maxDist: number
): number {
  const o2d = projectTo2D(originWorld, planeOrigin, u, v);
  const dir2d = { x: dirWorld.dot(u), y: dirWorld.dot(v) };

  let tMin = maxDist;

  for (const edge of boundaryEdges) {
    const a2d = projectTo2D(edge.v1, planeOrigin, u, v);
    const b2d = projectTo2D(edge.v2, planeOrigin, u, v);
    const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a2d.x, a2d.y, b2d.x, b2d.y);
    if (t !== null && t < tMin) {
      tMin = t;
    }
  }

  for (const edge of obstacleEdges) {
    const a2d = projectTo2D(edge.v1, planeOrigin, u, v);
    const b2d = projectTo2D(edge.v2, planeOrigin, u, v);
    const t = raySegmentIntersect2D(o2d.x, o2d.y, dir2d.x, dir2d.y, a2d.x, a2d.y, b2d.x, b2d.y);
    if (t !== null && t < tMin) {
      tMin = t;
    }
  }

  return tMin;
}
