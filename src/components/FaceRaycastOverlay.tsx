import React, { useMemo, useState, useEffect, useRef } from 'react';
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

  return originWorld.clone().addScaledVector(dirWorld, tMin);
}

interface PendingPreview {
  rayLines: RayLine[];
  originLocal: THREE.Vector3;
  geo: THREE.BufferGeometry;
  edgeGeo: THREE.BufferGeometry;
  virtualFace: VirtualFace;
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

  const boundaryEdges = collectBoundaryEdgesWorld(faces, group.faceIndices, localToWorld);
  const obstacleEdges = collectPanelObstacleEdgesWorld(childPanels, worldNormal, planeOrigin, 20);

  const maxDist = 5000;
  const offset = worldNormal.clone().multiplyScalar(0.5);
  const startWorld = clickWorld.clone().add(offset);
  const directions = [u, u.clone().negate(), v, v.clone().negate()];

  const lines: RayLine[] = [];
  const hitPointsWorld: THREE.Vector3[] = [];

  const parentPos = new THREE.Vector3();
  localToWorld.decompose(parentPos, new THREE.Quaternion(), new THREE.Vector3());

  for (const dir of directions) {
    const hitWorld = castRayOnFaceWorld(startWorld, dir, boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);
    lines.push({
      start: startWorld.clone().sub(parentPos),
      end: hitWorld.clone().sub(parentPos),
    });
    hitPointsWorld.push(hitWorld);
  }

  if (hitPointsWorld.length < 4) return null;

  const uPos = hitPointsWorld[0];
  const uNeg = hitPointsWorld[1];
  const vPos = hitPointsWorld[2];
  const vNeg = hitPointsWorld[3];
  const center = uPos.clone().add(uNeg).add(vPos).add(vNeg).divideScalar(4);
  const uHalfLen = uPos.distanceTo(uNeg) / 2;
  const vHalfLen = vPos.distanceTo(vNeg) / 2;

  const cornersWorld = [
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, -vHalfLen),
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, -vHalfLen),
  ];

  const cornersLocal = cornersWorld.map(c => c.clone().applyMatrix4(worldToLocal));
  const centerLocal = center.clone().applyMatrix4(worldToLocal);

  const localPositions = new Float32Array([
    cornersLocal[0].x, cornersLocal[0].y, cornersLocal[0].z,
    cornersLocal[1].x, cornersLocal[1].y, cornersLocal[1].z,
    cornersLocal[2].x, cornersLocal[2].y, cornersLocal[2].z,
    cornersLocal[0].x, cornersLocal[0].y, cornersLocal[0].z,
    cornersLocal[2].x, cornersLocal[2].y, cornersLocal[2].z,
    cornersLocal[3].x, cornersLocal[3].y, cornersLocal[3].z,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(localPositions, 3));
  geo.computeVertexNormals();

  const edgePositions = new Float32Array([
    cornersLocal[0].x, cornersLocal[0].y, cornersLocal[0].z,
    cornersLocal[1].x, cornersLocal[1].y, cornersLocal[1].z,
    cornersLocal[1].x, cornersLocal[1].y, cornersLocal[1].z,
    cornersLocal[2].x, cornersLocal[2].y, cornersLocal[2].z,
    cornersLocal[2].x, cornersLocal[2].y, cornersLocal[2].z,
    cornersLocal[3].x, cornersLocal[3].y, cornersLocal[3].z,
    cornersLocal[3].x, cornersLocal[3].y, cornersLocal[3].z,
    cornersLocal[0].x, cornersLocal[0].y, cornersLocal[0].z,
  ]);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

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
