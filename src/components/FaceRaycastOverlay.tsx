import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
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

function collectBoundaryEdges(
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

function collectPanelObstacleEdges(
  panelShapes: any[],
  facePlaneNormal: THREE.Vector3,
  facePlaneOrigin: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
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

    const posAttr = panel.geometry.getAttribute('position');
    if (!posAttr) continue;

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

function castRayOnFace(
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

  return originWorld.clone().addScaledVector(dirWorld, tMin);
}

function generateAxisRaysFromPoint(
  clickWorldPoint: THREE.Vector3,
  group: CoplanarFaceGroup,
  faces: FaceData[],
  parentPosition: THREE.Vector3,
  obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>
): RayLine[] {
  const normal = group.normal.clone().normalize();
  const { u, v } = getFacePlaneAxes(normal);

  const planeOrigin = clickWorldPoint.clone();
  const boundaryEdges = collectBoundaryEdges(faces, group.faceIndices);

  const directions = [u, u.clone().negate(), v, v.clone().negate()];

  const maxDist = 5000;
  const offset = normal.clone().multiplyScalar(0.5);
  const startWorld = clickWorldPoint.clone().add(offset);

  const lines: RayLine[] = [];

  for (const dir of directions) {
    const hitWorld = castRayOnFace(startWorld, dir, boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);

    lines.push({
      start: startWorld.clone().sub(parentPosition),
      end: hitWorld.clone().sub(parentPosition),
    });
  }

  return lines;
}

const RayLine3D: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = React.memo(
  ({ start, end }) => {
    const geometry = useMemo(() => {
      return new THREE.BufferGeometry().setFromPoints([start, end]);
    }, [start.x, start.y, start.z, end.x, end.y, end.z]);

    return (
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={0xf97316}
          linewidth={2}
          depthTest={false}
          transparent
          opacity={0.9}
        />
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
  const { raycastMode } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [rayLines, setRayLines] = useState<RayLine[]>([]);
  const [originLocal, setOriginLocal] = useState<THREE.Vector3 | null>(null);

  const geometryUuid = shape.geometry?.uuid || '';

  useEffect(() => {
    if (!shape.geometry) return;
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    setFaces(extractedFaces);
    setFaceGroups(groupCoplanarFaces(extractedFaces));
    setRayLines([]);
    setOriginLocal(null);
  }, [shape.geometry, shape.id, geometryUuid]);

  useEffect(() => {
    if (!raycastMode) {
      setHoveredGroupIndex(null);
      setRayLines([]);
      setOriginLocal(null);
    }
  }, [raycastMode]);

  const childPanels = useMemo(() => {
    return allShapes.filter(
      s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id
    );
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
    if (!raycastMode || e.button !== 0) return;
    e.stopPropagation();
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return;

    const clickWorld: THREE.Vector3 = e.point.clone();
    const group = faceGroups[hoveredGroupIndex];

    const parentPosition = new THREE.Vector3(
      shape.position[0],
      shape.position[1],
      shape.position[2]
    );

    const facePlaneNormal = group.normal.clone().normalize();
    const facePlaneOrigin = clickWorld.clone();
    const { u, v } = getFacePlaneAxes(facePlaneNormal);

    const obstacleEdges = collectPanelObstacleEdges(
      childPanels,
      facePlaneNormal,
      facePlaneOrigin,
      u,
      v,
      20
    );

    const lines = generateAxisRaysFromPoint(clickWorld, group, faces, parentPosition, obstacleEdges);
    setRayLines(lines);
    setOriginLocal(clickWorld.clone().sub(parentPosition));
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
        onContextMenu={(e) => e.stopPropagation()}
      />

      {hoverHighlightGeometry && (
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

      {originLocal && <OriginDot position={originLocal} />}

      {rayLines.map((line, i) => (
        <React.Fragment key={i}>
          <RayLine3D start={line.start} end={line.end} />
          <HitDot position={line.end} />
        </React.Fragment>
      ))}
    </>
  );
};
