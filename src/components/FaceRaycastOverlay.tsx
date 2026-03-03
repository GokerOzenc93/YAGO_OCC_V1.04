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
): { lines: RayLine[]; hitPointsWorld: THREE.Vector3[] } {
  const normal = group.normal.clone().normalize();
  const { u, v } = getFacePlaneAxes(normal);

  const planeOrigin = clickWorldPoint.clone();
  const boundaryEdges = collectBoundaryEdges(faces, group.faceIndices);

  const directions = [u, u.clone().negate(), v, v.clone().negate()];

  const maxDist = 5000;
  const offset = normal.clone().multiplyScalar(0.5);
  const startWorld = clickWorldPoint.clone().add(offset);

  const lines: RayLine[] = [];
  const hitPointsWorld: THREE.Vector3[] = [];

  for (const dir of directions) {
    const hitWorld = castRayOnFace(startWorld, dir, boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);

    lines.push({
      start: startWorld.clone().sub(parentPosition),
      end: hitWorld.clone().sub(parentPosition),
    });
    hitPointsWorld.push(hitWorld);
  }

  return { lines, hitPointsWorld };
}

function buildVirtualSurfaceGeometry(
  hitPointsWorld: THREE.Vector3[],
  normal: THREE.Vector3,
  parentPosition: THREE.Vector3
): THREE.BufferGeometry | null {
  if (hitPointsWorld.length < 4) return null;

  const { u, v } = getFacePlaneAxes(normal);

  const uPos = hitPointsWorld[0];
  const uNeg = hitPointsWorld[1];
  const vPos = hitPointsWorld[2];
  const vNeg = hitPointsWorld[3];

  const center = uPos.clone().add(uNeg).add(vPos).add(vNeg).divideScalar(4);

  const uHalfLen = uPos.distanceTo(uNeg) / 2;
  const vHalfLen = vPos.distanceTo(vNeg) / 2;

  const corners = [
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, -vHalfLen),
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, -vHalfLen),
  ].map(c => c.sub(parentPosition));

  const positions = new Float32Array([
    corners[0].x, corners[0].y, corners[0].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[0].x, corners[0].y, corners[0].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[3].x, corners[3].y, corners[3].z,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildVirtualSurfaceEdgeGeometry(
  hitPointsWorld: THREE.Vector3[],
  normal: THREE.Vector3,
  parentPosition: THREE.Vector3
): THREE.BufferGeometry | null {
  if (hitPointsWorld.length < 4) return null;

  const { u, v } = getFacePlaneAxes(normal);

  const uPos = hitPointsWorld[0];
  const uNeg = hitPointsWorld[1];
  const vPos = hitPointsWorld[2];
  const vNeg = hitPointsWorld[3];

  const center = uPos.clone().add(uNeg).add(vPos).add(vNeg).divideScalar(4);

  const uHalfLen = uPos.distanceTo(uNeg) / 2;
  const vHalfLen = vPos.distanceTo(vNeg) / 2;

  const corners = [
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, -vHalfLen),
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, -vHalfLen),
  ].map(c => c.sub(parentPosition));

  const positions = new Float32Array([
    corners[0].x, corners[0].y, corners[0].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[3].x, corners[3].y, corners[3].z,
    corners[3].x, corners[3].y, corners[3].z,
    corners[0].x, corners[0].y, corners[0].z,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
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

interface VirtualSurfaceProps {
  geo: THREE.BufferGeometry;
  edgeGeo: THREE.BufferGeometry;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

const VirtualSurface: React.FC<VirtualSurfaceProps> = ({ geo, edgeGeo, isHovered, onClick, onPointerOver, onPointerOut }) => (
  <>
    <mesh
      geometry={geo}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
      onPointerOut={(e) => { e.stopPropagation(); onPointerOut(); }}
    >
      <meshBasicMaterial
        color={isHovered ? 0x00cc44 : 0x22c55e}
        transparent
        opacity={isHovered ? 0.6 : 0.4}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        depthTest={false}
      />
    </mesh>
    <lineSegments geometry={edgeGeo}>
      <lineBasicMaterial
        color={0x16a34a}
        linewidth={2}
        depthTest={false}
        transparent
        opacity={0.9}
      />
    </lineSegments>
  </>
);

interface StoredSurface {
  id: string;
  geo: THREE.BufferGeometry;
  edgeGeo: THREE.BufferGeometry;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  vertices: THREE.Vector3[];
}

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape, allShapes = [] }) => {
  const { raycastMode, addVirtualFace, virtualFaces, selectedShapeId } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [rayLines, setRayLines] = useState<RayLine[]>([]);
  const [originLocal, setOriginLocal] = useState<THREE.Vector3 | null>(null);
  const [storedSurfaces, setStoredSurfaces] = useState<StoredSurface[]>([]);
  const [hoveredSurfaceId, setHoveredSurfaceId] = useState<string | null>(null);

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

  useEffect(() => {
    const existing = virtualFaces.filter(f => f.shapeId === shape.id);
    const parentPosition = new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]);

    const rebuilt: StoredSurface[] = existing.map(vf => {
      const verts = vf.vertices.map(v => new THREE.Vector3(v[0], v[1], v[2]).add(parentPosition));
      const normal = new THREE.Vector3(...vf.normal);
      const { u, v: vAxis } = getFacePlaneAxes(normal);

      const center = new THREE.Vector3(...vf.center).add(parentPosition);
      const uHalfLen = verts[0].distanceTo(verts[1]) / 2;
      const vHalfLen = verts[0].distanceTo(verts[3]) / 2;

      const corners = [
        center.clone().addScaledVector(u, uHalfLen).addScaledVector(vAxis, vHalfLen),
        center.clone().addScaledVector(u, -uHalfLen).addScaledVector(vAxis, vHalfLen),
        center.clone().addScaledVector(u, -uHalfLen).addScaledVector(vAxis, -vHalfLen),
        center.clone().addScaledVector(u, uHalfLen).addScaledVector(vAxis, -vHalfLen),
      ].map(c => c.sub(parentPosition));

      const positions = new Float32Array([
        corners[0].x, corners[0].y, corners[0].z,
        corners[1].x, corners[1].y, corners[1].z,
        corners[2].x, corners[2].y, corners[2].z,
        corners[0].x, corners[0].y, corners[0].z,
        corners[2].x, corners[2].y, corners[2].z,
        corners[3].x, corners[3].y, corners[3].z,
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      const edgePositions = new Float32Array([
        corners[0].x, corners[0].y, corners[0].z,
        corners[1].x, corners[1].y, corners[1].z,
        corners[1].x, corners[1].y, corners[1].z,
        corners[2].x, corners[2].y, corners[2].z,
        corners[2].x, corners[2].y, corners[2].z,
        corners[3].x, corners[3].y, corners[3].z,
        corners[3].x, corners[3].y, corners[3].z,
        corners[0].x, corners[0].y, corners[0].z,
      ]);
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

      return {
        id: vf.id,
        geo,
        edgeGeo,
        normal,
        center: new THREE.Vector3(...vf.center),
        vertices: verts,
      };
    });
    setStoredSurfaces(rebuilt);
  }, [virtualFaces, shape.id, shape.position]);

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

    const { lines, hitPointsWorld } = generateAxisRaysFromPoint(clickWorld, group, faces, parentPosition, obstacleEdges);
    setRayLines(lines);
    setOriginLocal(clickWorld.clone().sub(parentPosition));

    if (hitPointsWorld.length === 4) {
      const surfaceGeo = buildVirtualSurfaceGeometry(hitPointsWorld, facePlaneNormal, parentPosition);
      const surfaceEdgeGeo = buildVirtualSurfaceEdgeGeometry(hitPointsWorld, facePlaneNormal, parentPosition);

      if (surfaceGeo && surfaceEdgeGeo) {
        const uVec = u;
        const vVec = v;
        const uPos = hitPointsWorld[0];
        const uNeg = hitPointsWorld[1];
        const vPos = hitPointsWorld[2];
        const vNeg = hitPointsWorld[3];
        const center = uPos.clone().add(uNeg).add(vPos).add(vNeg).divideScalar(4);
        const uHalfLen = uPos.distanceTo(uNeg) / 2;
        const vHalfLen = vPos.distanceTo(vNeg) / 2;

        const cornersWorld = [
          center.clone().addScaledVector(uVec, uHalfLen).addScaledVector(vVec, vHalfLen),
          center.clone().addScaledVector(uVec, -uHalfLen).addScaledVector(vVec, vHalfLen),
          center.clone().addScaledVector(uVec, -uHalfLen).addScaledVector(vVec, -vHalfLen),
          center.clone().addScaledVector(uVec, uHalfLen).addScaledVector(vVec, -vHalfLen),
        ];

        const centerLocal = center.clone().sub(parentPosition);

        const newId = `vf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        const newVirtualFace: VirtualFace = {
          id: newId,
          shapeId: shape.id,
          normal: [facePlaneNormal.x, facePlaneNormal.y, facePlaneNormal.z],
          center: [centerLocal.x, centerLocal.y, centerLocal.z],
          vertices: cornersWorld.map(c => {
            const local = c.clone().sub(parentPosition);
            return [local.x, local.y, local.z] as [number, number, number];
          }),
          role: null,
          description: '',
          hasPanel: false,
        };

        addVirtualFace(newVirtualFace);
      }
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

      {storedSurfaces.map(surface => (
        <VirtualSurface
          key={surface.id}
          geo={surface.geo}
          edgeGeo={surface.edgeGeo}
          isHovered={hoveredSurfaceId === surface.id}
          onClick={() => {}}
          onPointerOver={() => setHoveredSurfaceId(surface.id)}
          onPointerOut={() => setHoveredSurfaceId(null)}
        />
      ))}
    </>
  );
};
