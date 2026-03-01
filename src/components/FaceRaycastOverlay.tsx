import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
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

function projectToFacePlane(
  vertices: THREE.Vector3[],
  normal: THREE.Vector3
): { u: THREE.Vector3; v: THREE.Vector3; origin: THREE.Vector3 } {
  let up: THREE.Vector3;
  if (Math.abs(normal.y) < 0.9) {
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
  tolerance: number
): boolean {
  for (const idx of faceIndices) {
    const face = faces[idx];
    if (!face) continue;
    const triangle = new THREE.Triangle(...face.vertices as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
    const closest = new THREE.Vector3();
    triangle.closestPointToPoint(point3d, closest);
    if (closest.distanceTo(point3d) < tolerance) return true;
  }
  return false;
}

function buildTargetMeshes(
  parentShape: any,
  allShapes: any[],
  parentPosition: THREE.Vector3
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  if (parentShape.geometry) {
    const parentMesh = new THREE.Mesh(parentShape.geometry.clone());
    parentMesh.position.copy(parentPosition);
    parentMesh.updateMatrixWorld(true);
    meshes.push(parentMesh);
  }

  const childPanels = allShapes.filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === parentShape.id && s.geometry
  );

  childPanels.forEach(panel => {
    const panelMesh = new THREE.Mesh(panel.geometry.clone());
    panelMesh.position.set(panel.position[0], panel.position[1], panel.position[2]);
    panelMesh.rotation.set(panel.rotation[0], panel.rotation[1], panel.rotation[2]);
    panelMesh.scale.set(panel.scale[0], panel.scale[1], panel.scale[2]);
    panelMesh.updateMatrixWorld(true);
    meshes.push(panelMesh);
  });

  return meshes;
}

function castRayAgainstMeshes(
  rayOrigin: THREE.Vector3,
  rayDirection: THREE.Vector3,
  meshes: THREE.Mesh[],
  maxDistance: number
): THREE.Vector3 | null {
  const raycaster = new THREE.Raycaster(rayOrigin, rayDirection.clone().normalize(), 0.1, maxDistance);

  let closestHit: THREE.Vector3 | null = null;
  let closestDist = Infinity;

  meshes.forEach(mesh => {
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit.distance < closestDist) {
        closestDist = hit.distance;
        closestHit = hit.point.clone();
      }
    }
  });

  return closestHit;
}

function generateRaysForFace(
  faces: FaceData[],
  group: CoplanarFaceGroup,
  parentShape: any,
  allShapes: any[],
  gridCount: number = 4
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
  const tolerance = Math.max(stepU, stepV) * 0.8;

  const inwardDir = normal.clone().negate();

  const parentPosition = new THREE.Vector3(
    parentShape.position[0],
    parentShape.position[1],
    parentShape.position[2]
  );

  const targetMeshes = buildTargetMeshes(parentShape, allShapes, parentPosition);
  const maxRayLength = 2000;

  const rays: RayArrow[] = [];

  for (let i = 1; i <= gridCount; i++) {
    for (let j = 1; j <= gridCount; j++) {
      const pu = minU + stepU * i;
      const pv = minV + stepV * j;

      const candidatePoint = origin.clone()
        .add(u.clone().multiplyScalar(pu))
        .add(v.clone().multiplyScalar(pv));

      if (!isPointInFaceGroup(candidatePoint, faces, group.faceIndices, tolerance)) {
        continue;
      }

      const rayOriginLocal = candidatePoint.clone().add(normal.clone().multiplyScalar(1));
      const rayOriginWorld = rayOriginLocal.clone().add(parentPosition);

      const hitPointWorld = castRayAgainstMeshes(rayOriginWorld, inwardDir, targetMeshes, maxRayLength);

      if (!hitPointWorld) continue;

      const hitPointLocal = hitPointWorld.clone().sub(parentPosition);
      const actualLength = rayOriginLocal.distanceTo(hitPointLocal);

      rays.push({
        origin: rayOriginLocal,
        direction: inwardDir.clone(),
        hitPoint: hitPointLocal,
        length: actualLength,
      });
    }
  }

  return rays;
}

const ArrowMesh: React.FC<{ origin: THREE.Vector3; direction: THREE.Vector3; length: number }> = React.memo(({ origin, direction, length }) => {
  const shaftLength = Math.max(length * 0.8, 1);
  const headLength = Math.max(length * 0.2, 1);
  const shaftRadius = 1.2;
  const headRadius = 3.0;

  const normDir = direction.clone().normalize();
  const shaftMid = origin.clone().add(normDir.clone().multiplyScalar(shaftLength / 2));
  const headCenter = origin.clone().add(normDir.clone().multiplyScalar(shaftLength + headLength / 2));

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normDir);
    return q;
  }, [normDir.x, normDir.y, normDir.z]);

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
        <meshBasicMaterial color={0xd97706} transparent opacity={0.9} depthTest={false} />
      </mesh>
      <mesh
        position={[headCenter.x, headCenter.y, headCenter.z]}
        rotation={[euler.x, euler.y, euler.z]}
      >
        <coneGeometry args={[headRadius, headLength, 8]} />
        <meshBasicMaterial color={0xb45309} transparent opacity={0.95} depthTest={false} />
      </mesh>
    </>
  );
});

ArrowMesh.displayName = 'ArrowMesh';

const HitPointMarker: React.FC<{ position: THREE.Vector3 }> = React.memo(({ position }) => {
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <sphereGeometry args={[3.5, 10, 10]} />
      <meshBasicMaterial color={0xef4444} transparent opacity={0.9} depthTest={false} />
    </mesh>
  );
});

HitPointMarker.displayName = 'HitPointMarker';

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape }) => {
  const { raycastMode, shapes } = useAppStore();
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
    return createFaceHighlightGeometry(faces, faceGroups[hoveredGroupIndex].faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const clickedHighlightGeometry = useMemo(() => {
    if (clickedGroupIndex === null || !faceGroups[clickedGroupIndex]) return null;
    return createFaceHighlightGeometry(faces, faceGroups[clickedGroupIndex].faceIndices);
  }, [clickedGroupIndex, faceGroups, faces]);

  const handlePointerMove = (e: any) => {
    if (!raycastMode || faces.length === 0) return;
    e.stopPropagation();
    const faceIndex = e.faceIndex;
    if (faceIndex !== undefined) {
      const groupIndex = faceGroups.findIndex(group => group.faceIndices.includes(faceIndex));
      if (groupIndex !== -1) setHoveredGroupIndex(groupIndex);
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

    const generatedRays = generateRaysForFace(faces, group, shape, shapes, 4);
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
        <React.Fragment key={i}>
          <ArrowMesh
            origin={ray.origin}
            direction={ray.direction}
            length={ray.length}
          />
          <HitPointMarker position={ray.hitPoint} />
        </React.Fragment>
      ))}
    </>
  );
};
