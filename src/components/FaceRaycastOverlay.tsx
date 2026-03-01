import React, { useMemo, useState, useEffect, useCallback } from 'react';
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

interface RaycastPanelBounds {
  uPlus: number;
  uMinus: number;
  vPlus: number;
  vMinus: number;
  origin: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  normal: THREE.Vector3;
  groupIndex: number;
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
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
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

function computeRaycastBounds(
  clickWorldPoint: THREE.Vector3,
  group: CoplanarFaceGroup,
  faces: FaceData[],
  obstacleEdges: Array<{ v1: THREE.Vector3; v2: THREE.Vector3 }>
): { bounds: RaycastPanelBounds; lines: RayLine[]; startWorld: THREE.Vector3 } {
  const normal = group.normal.clone().normalize();
  const { u, v } = getFacePlaneAxes(normal);

  const planeOrigin = clickWorldPoint.clone();
  const boundaryEdges = collectBoundaryEdges(faces, group.faceIndices);
  const maxDist = 5000;
  const offset = normal.clone().multiplyScalar(0.5);
  const startWorld = clickWorldPoint.clone().add(offset);

  const tUPlus = castRayOnFace(startWorld, u, boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);
  const tUMinus = castRayOnFace(startWorld, u.clone().negate(), boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);
  const tVPlus = castRayOnFace(startWorld, v, boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);
  const tVMinus = castRayOnFace(startWorld, v.clone().negate(), boundaryEdges, obstacleEdges, u, v, planeOrigin, maxDist);

  const bounds: RaycastPanelBounds = {
    uPlus: tUPlus,
    uMinus: tUMinus,
    vPlus: tVPlus,
    vMinus: tVMinus,
    origin: clickWorldPoint.clone(),
    u,
    v,
    normal,
    groupIndex: group.faceIndices[0] ?? 0,
  };

  const hitUPlus = startWorld.clone().addScaledVector(u, tUPlus);
  const hitUMinus = startWorld.clone().addScaledVector(u.clone().negate(), tUMinus);
  const hitVPlus = startWorld.clone().addScaledVector(v, tVPlus);
  const hitVMinus = startWorld.clone().addScaledVector(v.clone().negate(), tVMinus);

  const lines: RayLine[] = [
    { start: startWorld.clone(), end: hitUPlus },
    { start: startWorld.clone(), end: hitUMinus },
    { start: startWorld.clone(), end: hitVPlus },
    { start: startWorld.clone(), end: hitVMinus },
  ];

  return { bounds, lines, startWorld };
}

const RayLine3D: React.FC<{ start: THREE.Vector3; end: THREE.Vector3; parentPos: THREE.Vector3 }> = React.memo(
  ({ start, end, parentPos }) => {
    const geometry = useMemo(() => {
      const s = start.clone().sub(parentPos);
      const e = end.clone().sub(parentPos);
      return new THREE.BufferGeometry().setFromPoints([s, e]);
    }, [start.x, start.y, start.z, end.x, end.y, end.z, parentPos.x, parentPos.y, parentPos.z]);

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

const HitDot: React.FC<{ position: THREE.Vector3; parentPos: THREE.Vector3 }> = React.memo(({ position, parentPos }) => {
  const local = position.clone().sub(parentPos);
  return (
    <mesh position={[local.x, local.y, local.z]}>
      <sphereGeometry args={[2.5, 8, 8]} />
      <meshBasicMaterial color={0xef4444} depthTest={false} transparent opacity={0.9} />
    </mesh>
  );
});
HitDot.displayName = 'HitDot';

const OriginDot: React.FC<{ position: THREE.Vector3; parentPos: THREE.Vector3 }> = React.memo(({ position, parentPos }) => {
  const local = position.clone().sub(parentPos);
  return (
    <mesh position={[local.x, local.y, local.z]}>
      <sphereGeometry args={[3.5, 8, 8]} />
      <meshBasicMaterial color={0xfbbf24} depthTest={false} transparent opacity={0.95} />
    </mesh>
  );
});
OriginDot.displayName = 'OriginDot';

const PanelPreview: React.FC<{
  bounds: RaycastPanelBounds;
  parentPos: THREE.Vector3;
}> = React.memo(({ bounds, parentPos }) => {
  const { uPlus, uMinus, vPlus, vMinus, origin, u, v } = bounds;
  const panelWidth = uPlus + uMinus;
  const panelHeight = vPlus + vMinus;

  const centerWorld = origin.clone()
    .addScaledVector(u, (uPlus - uMinus) / 2)
    .addScaledVector(v, (vPlus - vMinus) / 2);
  const centerLocal = centerWorld.clone().sub(parentPos);

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(panelWidth, panelHeight);
  }, [panelWidth, panelHeight]);

  const quaternion = useMemo(() => {
    const n = bounds.normal.clone().normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);

    const uAfterQ = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const angle = Math.atan2(
      u.clone().cross(uAfterQ).dot(n),
      u.dot(uAfterQ)
    );
    const qAlign = new THREE.Quaternion().setFromAxisAngle(n, -angle);
    return qAlign.multiply(q);
  }, [bounds.normal.x, bounds.normal.y, bounds.normal.z, u.x, u.y, u.z]);

  return (
    <mesh
      position={[centerLocal.x, centerLocal.y, centerLocal.z]}
      quaternion={quaternion}
      geometry={geometry}
    >
      <meshBasicMaterial
        color={0x22c55e}
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthTest={false}
      />
    </mesh>
  );
});
PanelPreview.displayName = 'PanelPreview';

export const FaceRaycastOverlay: React.FC<FaceRaycastOverlayProps> = ({ shape, allShapes = [] }) => {
  const { raycastMode, addShape, selectedShapeId } = useAppStore();
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const [rayLines, setRayLines] = useState<RayLine[]>([]);
  const [originWorld, setOriginWorld] = useState<THREE.Vector3 | null>(null);
  const [panelBounds, setPanelBounds] = useState<RaycastPanelBounds | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const geometryUuid = shape.geometry?.uuid || '';

  const parentPos = useMemo(() => new THREE.Vector3(
    shape.position[0], shape.position[1], shape.position[2]
  ), [shape.position[0], shape.position[1], shape.position[2]]);

  useEffect(() => {
    if (!shape.geometry) return;
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    setFaces(extractedFaces);
    setFaceGroups(groupCoplanarFaces(extractedFaces));
    setRayLines([]);
    setOriginWorld(null);
    setPanelBounds(null);
  }, [shape.geometry, shape.id, geometryUuid]);

  useEffect(() => {
    if (!raycastMode) {
      setHoveredGroupIndex(null);
      setRayLines([]);
      setOriginWorld(null);
      setPanelBounds(null);
    }
  }, [raycastMode]);

  const panelBoundsRef = React.useRef(panelBounds);
  const isCreatingRef = React.useRef(isCreating);
  const handleCreatePanelRef = React.useRef<() => void>(() => {});

  const childPanels = useMemo(() => {
    return allShapes.filter(
      s => s.type === 'panel' && s.parameters?.parentShapeId === shape.id
    );
  }, [allShapes, shape.id]);

  const hoverHighlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;
    return createFaceHighlightGeometry(faces, faceGroups[hoveredGroupIndex].faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const handlePointerMove = useCallback((e: any) => {
    if (!raycastMode || faces.length === 0) return;
    e.stopPropagation();
    const fi = e.faceIndex;
    if (fi !== undefined) {
      const gi = faceGroups.findIndex(g => g.faceIndices.includes(fi));
      if (gi !== -1) setHoveredGroupIndex(gi);
    }
  }, [raycastMode, faces, faceGroups]);

  const handlePointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHoveredGroupIndex(null);
  }, []);

  const handleCreatePanel = useCallback(async () => {
    if (!panelBounds || isCreating) return;

    const { uPlus, uMinus, vPlus, vMinus, origin, u, v, normal, groupIndex } = panelBounds;
    const panelThickness = 18;

    const dominantGroupIndex = faceGroups.findIndex(g => g.faceIndices.includes(groupIndex));
    if (dominantGroupIndex < 0) return;

    setIsCreating(true);
    try {
      const { convertReplicadToThreeGeometry, initReplicad, createReplicadBox, performBooleanCut } = await import('./ReplicadService');
      const { getOriginalSize } = await import('./ShapeUpdaterService');
      const { draw, Plane } = await import('replicad');

      const worldU = u.clone().normalize();
      const worldV = v.clone().normalize();
      const worldN = normal.clone().normalize();

      const panelW = uPlus + uMinus;
      const panelH = vPlus + vMinus;

      const worldCorner = origin.clone()
        .addScaledVector(worldU, -uMinus)
        .addScaledVector(worldV, -vMinus);

      await initReplicad();

      const xAxis: [number, number, number] = [worldU.x, worldU.y, worldU.z];
      const normalAxis: [number, number, number] = [worldN.x, worldN.y, worldN.z];
      const originPt: [number, number, number] = [worldCorner.x, worldCorner.y, worldCorner.z];

      const sketchPlane = new Plane(originPt, xAxis, normalAxis);

      let panelShape = draw()
        .movePointerTo([0, 0])
        .lineTo([panelW, 0])
        .lineTo([panelW, panelH])
        .lineTo([0, panelH])
        .close()
        .sketchOnPlane(sketchPlane)
        .extrude(-panelThickness);

      const hasFillets = shape.fillets && shape.fillets.length > 0;
      const parentSubtractions = shape.subtractionGeometries || [];
      if (parentSubtractions.length > 0) {
        const shapePos = new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]);
        const shapeRot = shape.rotation as [number, number, number];
        const rot = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(shapeRot[0], shapeRot[1], shapeRot[2], 'XYZ')
        );

        const parentBox = new THREE.Box3().setFromBufferAttribute(
          shape.geometry.attributes.position as THREE.BufferAttribute
        );
        const parentCenter = new THREE.Vector3();
        const parentSize = new THREE.Vector3();
        parentBox.getCenter(parentCenter);
        parentBox.getSize(parentSize);
        const isCentered = Math.abs(parentCenter.x) < 0.01 &&
                           Math.abs(parentCenter.y) < 0.01 &&
                           Math.abs(parentCenter.z) < 0.01;
        const parentCornerWorld = shapePos.clone();
        if (isCentered) {
          const halfLocal = new THREE.Vector3(parentSize.x / 2, parentSize.y / 2, parentSize.z / 2);
          halfLocal.applyQuaternion(rot);
          parentCornerWorld.sub(halfLocal);
        }

        for (const subtraction of parentSubtractions) {
          if (!subtraction) continue;
          try {
            const subSize = getOriginalSize(subtraction.geometry);
            const subBox = await createReplicadBox({
              width: subSize.x,
              height: subSize.y,
              depth: subSize.z,
            });

            const subLocalPos = new THREE.Vector3(
              subtraction.relativeOffset[0],
              subtraction.relativeOffset[1],
              subtraction.relativeOffset[2]
            );
            const subWorldPos = subLocalPos.clone().applyQuaternion(rot).add(parentCornerWorld);

            const subRelRot = subtraction.relativeRotation || [0, 0, 0];
            const subRotQ = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(subRelRot[0], subRelRot[1], subRelRot[2], 'XYZ')
            );
            const subWorldQ = rot.clone().multiply(subRotQ);
            const subWorldEuler = new THREE.Euler().setFromQuaternion(subWorldQ, 'XYZ');

            panelShape = await performBooleanCut(
              panelShape,
              subBox,
              undefined,
              [subWorldPos.x, subWorldPos.y, subWorldPos.z],
              undefined,
              [subWorldEuler.x, subWorldEuler.y, subWorldEuler.z],
              undefined,
              subtraction.scale || [1, 1, 1] as [number, number, number]
            );
          } catch (cutErr) {
            console.warn('Subtractor cut skipped:', cutErr);
          }
        }
      }

      if (hasFillets && shape.replicadShape) {
        try {
          const { performBooleanIntersection } = await import('./ReplicadService');
          const shapePos = new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]);
          const shapeRot = shape.rotation as [number, number, number];
          const rotDegX = shapeRot[0] * (180 / Math.PI);
          const rotDegY = shapeRot[1] * (180 / Math.PI);
          const rotDegZ = shapeRot[2] * (180 / Math.PI);

          let parentWorld = shape.replicadShape;
          if (Math.abs(rotDegX) > 0.01) parentWorld = parentWorld.rotate(rotDegX, [0, 0, 0], [1, 0, 0]);
          if (Math.abs(rotDegY) > 0.01) parentWorld = parentWorld.rotate(rotDegY, [0, 0, 0], [0, 1, 0]);
          if (Math.abs(rotDegZ) > 0.01) parentWorld = parentWorld.rotate(rotDegZ, [0, 0, 0], [0, 0, 1]);
          parentWorld = parentWorld.translate(shapePos.x, shapePos.y, shapePos.z);

          panelShape = await performBooleanIntersection(panelShape, parentWorld);
        } catch (filletErr) {
          console.warn('Fillet intersection skipped:', filletErr);
        }
      }

      const geometry = convertReplicadToThreeGeometry(panelShape);

      const extraRowId = `raycast-${Date.now()}`;

      const newPanel: any = {
        id: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: 'panel',
        geometry,
        replicadShape: panelShape,
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [...shape.scale] as [number, number, number],
        color: '#ffffff',
        parameters: {
          width: uPlus + uMinus,
          height: vPlus + vMinus,
          depth: panelThickness,
          parentShapeId: shape.id,
          faceIndex: dominantGroupIndex,
          faceRole: null,
          extraRowId,
          isRaycastPanel: true,
          raycastBounds: { uPlus, uMinus, vPlus, vMinus },
        }
      };

      addShape(newPanel);

      setRayLines([]);
      setOriginWorld(null);
      setPanelBounds(null);
    } catch (err) {
      console.error('Failed to create raycast panel:', err);
    } finally {
      setIsCreating(false);
    }
  }, [panelBounds, isCreating, shape, faceGroups, addShape]);

  panelBoundsRef.current = panelBounds;
  isCreatingRef.current = isCreating;
  handleCreatePanelRef.current = handleCreatePanel;

  useEffect(() => {
    if (!raycastMode) return;

    const onContextMenu = (e: MouseEvent) => {
      if (panelBoundsRef.current && !isCreatingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        handleCreatePanelRef.current();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && panelBoundsRef.current && !isCreatingRef.current) {
        e.preventDefault();
        handleCreatePanelRef.current();
      }
    };

    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [raycastMode]);

  const handlePointerDown = useCallback((e: any) => {
    if (!raycastMode) return;
    e.stopPropagation();

    if (e.button === 2) {
      if (panelBounds && rayLines.length > 0) {
        handleCreatePanel();
      }
      return;
    }

    if (e.button !== 0) return;
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return;

    const clickWorld: THREE.Vector3 = e.point.clone();
    const group = faceGroups[hoveredGroupIndex];

    const shapePos = new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]);
    const shapeRot = shape.rotation as [number, number, number];
    const invRot = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(shapeRot[0], shapeRot[1], shapeRot[2], 'XYZ'))
      .invert();
    const clickLocal = clickWorld.clone().sub(shapePos).applyQuaternion(invRot);

    const facePlaneNormal = group.normal.clone().normalize();
    const facePlaneOrigin = clickLocal.clone();

    const obstacleEdges = collectPanelObstacleEdges(
      childPanels,
      facePlaneNormal,
      facePlaneOrigin,
      20
    );

    const { bounds, lines } = computeRaycastBounds(clickLocal, group, faces, obstacleEdges);

    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(shapeRot[0], shapeRot[1], shapeRot[2], 'XYZ'));
    const worldLines = lines.map(l => ({
      start: l.start.clone().applyQuaternion(rot).add(shapePos),
      end: l.end.clone().applyQuaternion(rot).add(shapePos),
    }));
    const worldOrigin = bounds.origin.clone().applyQuaternion(rot).add(shapePos);

    const worldBounds: RaycastPanelBounds = {
      ...bounds,
      origin: worldOrigin,
      u: bounds.u.clone().applyQuaternion(rot),
      v: bounds.v.clone().applyQuaternion(rot),
      normal: bounds.normal.clone().applyQuaternion(rot),
    };

    setRayLines(worldLines);
    setOriginWorld(worldOrigin);
    setPanelBounds(worldBounds);
  }, [raycastMode, hoveredGroupIndex, faceGroups, panelBounds, rayLines, handleCreatePanel, childPanels, faces, shape.position, shape.rotation]);

  if (!raycastMode) return null;

  return (
    <>
      <mesh
        geometry={shape.geometry}
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent?.preventDefault?.();
          if (panelBounds && rayLines.length > 0) {
            handleCreatePanel();
          }
        }}
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

      {originWorld && <OriginDot position={originWorld} parentPos={parentPos} />}

      {rayLines.map((line, i) => (
        <React.Fragment key={i}>
          <RayLine3D start={line.start} end={line.end} parentPos={parentPos} />
          <HitDot position={line.end} parentPos={parentPos} />
        </React.Fragment>
      ))}

      {panelBounds && (
        <PanelPreview bounds={panelBounds} parentPos={parentPos} />
      )}
    </>
  );
};
