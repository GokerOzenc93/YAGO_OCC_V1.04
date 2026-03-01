import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces, createFaceHighlightGeometry, FaceData, CoplanarFaceGroup } from './FaceEditor';

interface RayLine {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface FaceRaycastOverlayProps {
  shape: any;
}

function projectToFacePlane(
  normal: THREE.Vector3
): { u: THREE.Vector3; v: THREE.Vector3 } {
  let up: THREE.Vector3;
  if (Math.abs(normal.y) < 0.9) {
    up = new THREE.Vector3(0, 1, 0);
  } else {
    up = new THREE.Vector3(1, 0, 0);
  }
  const u = new THREE.Vector3().crossVectors(up, normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  return { u, v };
}

function buildObstacleMeshes(
  parentShape: any,
  allShapes: any[],
  parentPosition: THREE.Vector3
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  if (parentShape.geometry) {
    const m = new THREE.Mesh(parentShape.geometry.clone());
    m.position.copy(parentPosition);
    m.updateMatrixWorld(true);
    meshes.push(m);
  }

  const childPanels = allShapes.filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === parentShape.id && s.geometry
  );
  childPanels.forEach(panel => {
    const m = new THREE.Mesh(panel.geometry.clone());
    m.position.set(panel.position[0], panel.position[1], panel.position[2]);
    m.rotation.set(panel.rotation[0], panel.rotation[1], panel.rotation[2]);
    m.scale.set(panel.scale[0], panel.scale[1], panel.scale[2]);
    m.updateMatrixWorld(true);
    meshes.push(m);
  });

  return meshes;
}

function castRayToObstacle(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  meshes: THREE.Mesh[],
  maxDist: number
): THREE.Vector3 | null {
  const raycaster = new THREE.Raycaster(
    rayOrigin,
    rayDir.clone().normalize(),
    0.5,
    maxDist
  );
  let closest: THREE.Vector3 | null = null;
  let closestDist = Infinity;
  meshes.forEach(mesh => {
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length > 0 && hits[0].distance < closestDist) {
      closestDist = hits[0].distance;
      closest = hits[0].point.clone();
    }
  });
  return closest;
}

function generateRaysFromPoint(
  clickWorldPoint: THREE.Vector3,
  faceNormal: THREE.Vector3,
  parentShape: any,
  allShapes: any[],
  rayCount: number = 16
): RayLine[] {
  const parentPosition = new THREE.Vector3(
    parentShape.position[0],
    parentShape.position[1],
    parentShape.position[2]
  );

  const obstacleMeshes = buildObstacleMeshes(parentShape, allShapes, parentPosition);

  const normal = faceNormal.clone().normalize();
  const { u, v } = projectToFacePlane(normal);

  const maxDist = 3000;
  const lines: RayLine[] = [];

  const startWorld = clickWorldPoint.clone().add(normal.clone().multiplyScalar(0.5));

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const dirOnPlane = u.clone().multiplyScalar(Math.cos(angle))
      .add(v.clone().multiplyScalar(Math.sin(angle)));

    const hitWorld = castRayToObstacle(startWorld, dirOnPlane, obstacleMeshes, maxDist);
    const endWorld = hitWorld ?? startWorld.clone().add(dirOnPlane.multiplyScalar(maxDist));

    lines.push({
      start: startWorld.clone().sub(parentPosition),
      end: endWorld.clone().sub(parentPosition),
    });
  }

  return lines;
}

const RayLine3D: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = React.memo(({ start, end }) => {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    return geo;
  }, [start.x, start.y, start.z, end.x, end.y, end.z]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={0xf97316} linewidth={2} depthTest={false} transparent opacity={0.85} />
    </lineSegments>
  );
});
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

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape }) => {
  const { raycastMode, shapes } = useAppStore();
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
    const groups = groupCoplanarFaces(extractedFaces);
    setFaceGroups(groups);
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

    const clickWorldPoint: THREE.Vector3 = e.point.clone();
    const group = faceGroups[hoveredGroupIndex];
    const faceNormal = group.normal.clone().normalize();

    const parentPosition = new THREE.Vector3(
      shape.position[0],
      shape.position[1],
      shape.position[2]
    );

    const lines = generateRaysFromPoint(clickWorldPoint, faceNormal, shape, shapes, 24);
    setRayLines(lines);

    const localClick = clickWorldPoint.clone().sub(parentPosition);
    setOriginLocal(localClick);
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
