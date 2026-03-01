import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useAppStore } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces, createFaceHighlightGeometry, FaceData, CoplanarFaceGroup } from './FaceEditor';

interface RayArrow {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  hitPoint: THREE.Vector3;
  length: number;
}

interface FaceRaycastOverlayProps {
  shape: any;
}

function buildFacePolygon(faces: FaceData[], faceIndices: number[]): THREE.Vector2[] {
  const allVerts: THREE.Vector3[] = [];
  faceIndices.forEach(idx => {
    const face = faces[idx];
    if (face) face.vertices.forEach(v => allVerts.push(v.clone()));
  });
  return allVerts.map(v => new THREE.Vector2(v.x, v.z));
}

function projectToFacePlane(
  vertices: THREE.Vector3[],
  normal: THREE.Vector3
): { u: THREE.Vector3; v: THREE.Vector3; origin: THREE.Vector3 } {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);

  let up: THREE.Vector3;
  if (absY < 0.9) {
    up = new THREE.Vector3(0, 1, 0);
  } else {
    up = new THREE.Vector3(1, 0, 0);
  }

  const u = new THREE.Vector3().crossVectors(up, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  const center = new THREE.Vector3();
  vertices.forEach(vert => center.add(vert));
  center.divideScalar(vertices.length);

  return { u, v, origin: center };
}

function computeFaceBounds(
  vertices: THREE.Vector3[],
  u: THREE.Vector3,
  v: THREE.Vector3,
  origin: THREE.Vector3
): { minU: number; maxU: number; minV: number; maxV: number } {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  vertices.forEach(vert => {
    const delta = vert.clone().sub(origin);
    const pu = delta.dot(u);
    const pv = delta.dot(v);
    if (pu < minU) minU = pu;
    if (pu > maxU) maxU = pu;
    if (pv < minV) minV = pv;
    if (pv > maxV) maxV = pv;
  });
  return { minU, maxU, minV, maxV };
}

function isPointInFaceGroup(
  point3d: THREE.Vector3,
  faces: FaceData[],
  faceIndices: number[],
  normal: THREE.Vector3,
  tolerance: number = 2.0
): boolean {
  for (const idx of faceIndices) {
    const face = faces[idx];
    if (!face) continue;
    const [a, b, c] = face.vertices;

    const baryResult = new THREE.Vector3();
    const triangle = new THREE.Triangle(a, b, c);

    const closestPoint = new THREE.Vector3();
    triangle.closestPointToPoint(point3d, closestPoint);

    if (closestPoint.distanceTo(point3d) < tolerance) {
      return true;
    }
  }
  return false;
}

function generateRaysForFace(
  faces: FaceData[],
  group: CoplanarFaceGroup,
  gridCount: number = 5
): RayArrow[] {
  const faceVertices: THREE.Vector3[] = [];
  group.faceIndices.forEach(idx => {
    const face = faces[idx];
    if (face) face.vertices.forEach(v => faceVertices.push(v.clone()));
  });

  if (faceVertices.length === 0) return [];

  const normal = group.normal.clone().normalize();
  const { u, v, origin } = projectToFacePlane(faceVertices, normal);
  const { minU, maxU, minV, maxV } = computeFaceBounds(faceVertices, u, v, origin);

  const stepU = (maxU - minU) / (gridCount + 1);
  const stepV = (maxV - minV) / (gridCount + 1);

  const inwardDir = normal.clone().negate();

  const rays: RayArrow[] = [];

  for (let i = 1; i <= gridCount; i++) {
    for (let j = 1; j <= gridCount; j++) {
      const pu = minU + stepU * i;
      const pv = minV + stepV * j;

      const candidatePoint = origin.clone()
        .add(u.clone().multiplyScalar(pu))
        .add(v.clone().multiplyScalar(pv));

      if (!isPointInFaceGroup(candidatePoint, faces, group.faceIndices, normal, Math.max(stepU, stepV) * 0.8)) {
        continue;
      }

      const rayOrigin = candidatePoint.clone().add(normal.clone().multiplyScalar(5));
      const rayLength = 80;
      const hitPoint = rayOrigin.clone().add(inwardDir.clone().multiplyScalar(rayLength));

      rays.push({
        origin: rayOrigin,
        direction: inwardDir.clone(),
        hitPoint,
        length: rayLength,
      });
    }
  }

  return rays;
}

const ArrowMesh: React.FC<{ origin: THREE.Vector3; direction: THREE.Vector3; length: number }> = ({ origin, direction, length }) => {
  const shaftLength = length * 0.75;
  const headLength = length * 0.25;
  const shaftRadius = 1.2;
  const headRadius = 3.0;

  const shaftEnd = origin.clone().add(direction.clone().multiplyScalar(shaftLength));
  const shaftMid = origin.clone().add(direction.clone().multiplyScalar(shaftLength / 2));

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    return q;
  }, [direction]);

  const euler = useMemo(() => {
    const e = new THREE.Euler();
    e.setFromQuaternion(quaternion);
    return e;
  }, [quaternion]);

  return (
    <>
      <mesh
        position={[shaftMid.x, shaftMid.y, shaftMid.z]}
        rotation={[euler.x, euler.y, euler.z]}
      >
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 8]} />
        <meshBasicMaterial color={0xd97706} transparent opacity={0.9} />
      </mesh>
      <mesh
        position={[shaftEnd.x + direction.x * headLength / 2, shaftEnd.y + direction.y * headLength / 2, shaftEnd.z + direction.z * headLength / 2]}
        rotation={[euler.x, euler.y, euler.z]}
      >
        <coneGeometry args={[headRadius, headLength, 8]} />
        <meshBasicMaterial color={0xb45309} transparent opacity={0.95} />
      </mesh>
    </>
  );
};

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape }) => {
  const { raycastMode } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [clickedGroupIndex, setClickedGroupIndex] = useState<number | null>(null);
  const [rays, setRays] = useState<RayArrow[]>([]);

  const geometryUuid = shape.geometry?.uuid || '';

  useEffect(() => {
    if (!shape.geometry) return;
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    setFaces(extractedFaces);
    const groups = groupCoplanarFaces(extractedFaces);
    setFaceGroups(groups);
    setClickedGroupIndex(null);
    setRays([]);
  }, [shape.geometry, shape.id, geometryUuid]);

  useEffect(() => {
    if (!raycastMode) {
      setHoveredGroupIndex(null);
      setClickedGroupIndex(null);
      setRays([]);
    }
  }, [raycastMode]);

  const hoverHighlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;
    const group = faceGroups[hoveredGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const clickedHighlightGeometry = useMemo(() => {
    if (clickedGroupIndex === null || !faceGroups[clickedGroupIndex]) return null;
    const group = faceGroups[clickedGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [clickedGroupIndex, faceGroups, faces]);

  const handlePointerMove = (e: any) => {
    if (!raycastMode || faces.length === 0) return;
    e.stopPropagation();
    const faceIndex = e.faceIndex;
    if (faceIndex !== undefined) {
      const groupIndex = faceGroups.findIndex(group => group.faceIndices.includes(faceIndex));
      if (groupIndex !== -1) {
        setHoveredGroupIndex(groupIndex);
      }
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

    const group = faceGroups[hoveredGroupIndex];
    setClickedGroupIndex(hoveredGroupIndex);

    const generatedRays = generateRaysForFace(faces, group, 4);
    setRays(generatedRays);
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

      {hoverHighlightGeometry && hoveredGroupIndex !== clickedGroupIndex && (
        <mesh geometry={hoverHighlightGeometry}>
          <meshBasicMaterial
            color={0xfbbf24}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {clickedHighlightGeometry && (
        <mesh geometry={clickedHighlightGeometry}>
          <meshBasicMaterial
            color={0xf59e0b}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {rays.map((ray, i) => (
        <ArrowMesh
          key={i}
          origin={ray.origin}
          direction={ray.direction}
          length={ray.length}
        />
      ))}
    </>
  );
};
