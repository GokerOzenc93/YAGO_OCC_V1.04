import React, { useMemo, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { extractFacesFromGeometry, groupCoplanarFaces, FaceData, CoplanarFaceGroup } from './FaceEditor';

interface FaceSelectOverlayProps {
  shape: any;
}

interface Region2D {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

interface FaceCoordSystem {
  origin: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  normal: THREE.Vector3;
}

function buildFaceCoordSystem(normal: THREE.Vector3, center: THREE.Vector3): FaceCoordSystem {
  const n = normal.clone().normalize();
  const absN = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
  let ref: THREE.Vector3;
  if (absN[1] >= absN[0] && absN[1] >= absN[2]) {
    ref = new THREE.Vector3(1, 0, 0);
  } else {
    ref = new THREE.Vector3(0, 1, 0);
  }
  const v = new THREE.Vector3().crossVectors(n, ref).normalize();
  const u = new THREE.Vector3().crossVectors(v, n).normalize();
  return { origin: center.clone(), u, v, normal: n };
}

function to2D(point: THREE.Vector3, cs: FaceCoordSystem): [number, number] {
  const d = point.clone().sub(cs.origin);
  return [d.dot(cs.u), d.dot(cs.v)];
}

function to3D(uv: [number, number], cs: FaceCoordSystem, normalOffset: number = 0): THREE.Vector3 {
  return cs.origin.clone()
    .add(cs.u.clone().multiplyScalar(uv[0]))
    .add(cs.v.clone().multiplyScalar(uv[1]))
    .add(cs.normal.clone().multiplyScalar(normalOffset));
}

function computeRegions(faceBounds: Region2D, panelFootprints: Region2D[]): Region2D[] {
  const tol = 0.5;
  const uLines = new Set<number>([faceBounds.uMin, faceBounds.uMax]);
  const vLines = new Set<number>([faceBounds.vMin, faceBounds.vMax]);

  for (const fp of panelFootprints) {
    if (fp.uMin > faceBounds.uMin + tol && fp.uMin < faceBounds.uMax - tol) uLines.add(fp.uMin);
    if (fp.uMax > faceBounds.uMin + tol && fp.uMax < faceBounds.uMax - tol) uLines.add(fp.uMax);
    if (fp.vMin > faceBounds.vMin + tol && fp.vMin < faceBounds.vMax - tol) vLines.add(fp.vMin);
    if (fp.vMax > faceBounds.vMin + tol && fp.vMax < faceBounds.vMax - tol) vLines.add(fp.vMax);
  }

  const uArr = [...uLines].sort((a, b) => a - b);
  const vArr = [...vLines].sort((a, b) => a - b);

  const regions: Region2D[] = [];
  for (let i = 0; i < uArr.length - 1; i++) {
    for (let j = 0; j < vArr.length - 1; j++) {
      const cell: Region2D = {
        uMin: uArr[i], uMax: uArr[i + 1],
        vMin: vArr[j], vMax: vArr[j + 1]
      };
      if (cell.uMax - cell.uMin < 1 || cell.vMax - cell.vMin < 1) continue;

      const cu = (cell.uMin + cell.uMax) / 2;
      const cv = (cell.vMin + cell.vMax) / 2;
      const covered = panelFootprints.some(fp =>
        cu >= fp.uMin - tol && cu <= fp.uMax + tol &&
        cv >= fp.vMin - tol && cv <= fp.vMax + tol
      );
      if (!covered) {
        regions.push(cell);
      }
    }
  }
  return regions;
}

function createQuadGeometry(region: Region2D, cs: FaceCoordSystem): THREE.BufferGeometry {
  const off = 0.2;
  const p1 = to3D([region.uMin, region.vMin], cs, off);
  const p2 = to3D([region.uMax, region.vMin], cs, off);
  const p3 = to3D([region.uMax, region.vMax], cs, off);
  const p4 = to3D([region.uMin, region.vMax], cs, off);

  const positions = new Float32Array([
    p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
    p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z
  ]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

function createRegionEdgesGeometry(regions: Region2D[], cs: FaceCoordSystem): THREE.BufferGeometry {
  const off = 0.25;
  const edgePositions: number[] = [];

  regions.forEach(region => {
    const p1 = to3D([region.uMin, region.vMin], cs, off);
    const p2 = to3D([region.uMax, region.vMin], cs, off);
    const p3 = to3D([region.uMax, region.vMax], cs, off);
    const p4 = to3D([region.uMin, region.vMax], cs, off);

    edgePositions.push(
      p1.x, p1.y, p1.z, p2.x, p2.y, p2.z,
      p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
      p3.x, p3.y, p3.z, p4.x, p4.y, p4.z,
      p4.x, p4.y, p4.z, p1.x, p1.y, p1.z
    );
  });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  return geom;
}

export const FaceSelectOverlay: React.FC<FaceSelectOverlayProps> = React.memo(({ shape }) => {
  const {
    extraRowFaceSelectMode,
    extraRowHoveredFaceGroup,
    setExtraRowHoveredFaceGroup,
    confirmExtraRowFace,
    shapes
  } = useAppStore(useShallow(state => ({
    extraRowFaceSelectMode: state.extraRowFaceSelectMode,
    extraRowHoveredFaceGroup: state.extraRowHoveredFaceGroup,
    setExtraRowHoveredFaceGroup: state.setExtraRowHoveredFaceGroup,
    confirmExtraRowFace: state.confirmExtraRowFace,
    shapes: state.shapes
  })));

  const [hoveredRegion, setHoveredRegion] = useState<Region2D | null>(null);

  const geometry = shape.geometry;

  const { faces, faceGroups } = useMemo(() => {
    if (!geometry) return { faces: [] as FaceData[], faceGroups: [] as CoplanarFaceGroup[] };
    const f = extractFacesFromGeometry(geometry);
    const g = groupCoplanarFaces(f);
    return { faces: f, faceGroups: g };
  }, [geometry]);

  const groupMap = useMemo(() => {
    const map: number[] = new Array(faces.length).fill(-1);
    faceGroups.forEach((group, gi) => {
      group.faceIndices.forEach(fi => { map[fi] = gi; });
    });
    return map;
  }, [faces, faceGroups]);

  const childPanels = useMemo(() => {
    return shapes.filter(s =>
      s.type === 'panel' &&
      s.parameters?.parentShapeId === shape.id
    );
  }, [shapes, shape.id]);

  const faceRegionData = useMemo(() => {
    const result = new Map<number, { cs: FaceCoordSystem; faceBounds: Region2D; regions: Region2D[] }>();

    if (childPanels.length === 0) return result;

    faceGroups.forEach((group, gi) => {
      const cs = buildFaceCoordSystem(group.normal, group.center);

      let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      group.faceIndices.forEach(fi => {
        faces[fi].vertices.forEach(vert => {
          const [uc, vc] = to2D(vert, cs);
          uMin = Math.min(uMin, uc);
          uMax = Math.max(uMax, uc);
          vMin = Math.min(vMin, vc);
          vMax = Math.max(vMax, vc);
        });
      });

      const faceBounds: Region2D = { uMin, uMax, vMin, vMax };

      const panelFootprints: Region2D[] = [];
      childPanels.forEach(panel => {
        if (!panel.geometry) return;

        const panelFaceIndex = panel.parameters?.faceIndex;
        if (panelFaceIndex === undefined) return;

        const panelFaceGroup = faceGroups[panelFaceIndex];
        if (!panelFaceGroup) return;

        const dotProduct = Math.abs(panelFaceGroup.normal.dot(group.normal));
        if (dotProduct > 0.9) return;

        const panelBBox = new THREE.Box3().setFromBufferAttribute(
          panel.geometry.getAttribute('position')
        );

        const corners = [
          new THREE.Vector3(panelBBox.min.x, panelBBox.min.y, panelBBox.min.z),
          new THREE.Vector3(panelBBox.max.x, panelBBox.min.y, panelBBox.min.z),
          new THREE.Vector3(panelBBox.min.x, panelBBox.max.y, panelBBox.min.z),
          new THREE.Vector3(panelBBox.max.x, panelBBox.max.y, panelBBox.min.z),
          new THREE.Vector3(panelBBox.min.x, panelBBox.min.y, panelBBox.max.z),
          new THREE.Vector3(panelBBox.max.x, panelBBox.min.y, panelBBox.max.z),
          new THREE.Vector3(panelBBox.min.x, panelBBox.max.y, panelBBox.max.z),
          new THREE.Vector3(panelBBox.max.x, panelBBox.max.y, panelBBox.max.z),
        ];

        let puMin = Infinity, puMax = -Infinity, pvMin = Infinity, pvMax = -Infinity;
        corners.forEach(c => {
          const [uc, vc] = to2D(c, cs);
          puMin = Math.min(puMin, uc);
          puMax = Math.max(puMax, uc);
          pvMin = Math.min(pvMin, vc);
          pvMax = Math.max(pvMax, vc);
        });

        const overlapU = Math.min(puMax, faceBounds.uMax) - Math.max(puMin, faceBounds.uMin);
        const overlapV = Math.min(pvMax, faceBounds.vMax) - Math.max(pvMin, faceBounds.vMin);

        if (overlapU > 1 && overlapV > 1) {
          panelFootprints.push({
            uMin: Math.max(puMin, faceBounds.uMin),
            uMax: Math.min(puMax, faceBounds.uMax),
            vMin: Math.max(pvMin, faceBounds.vMin),
            vMax: Math.min(pvMax, faceBounds.vMax)
          });
        }
      });

      const regions = panelFootprints.length > 0
        ? computeRegions(faceBounds, panelFootprints)
        : [];

      result.set(gi, { cs, faceBounds, regions });
    });

    return result;
  }, [faceGroups, faces, childPanels]);

  const highlightGeometry = useMemo(() => {
    const gi = extraRowHoveredFaceGroup;
    if (gi === null || gi >= faceGroups.length) return null;

    const fd = faceRegionData.get(gi);

    if (fd && fd.regions.length > 0 && hoveredRegion) {
      return createQuadGeometry(hoveredRegion, fd.cs);
    }

    const group = faceGroups[gi];
    const vertices: number[] = [];
    group.faceIndices.forEach(fi => {
      const face = faces[fi];
      face.vertices.forEach(v => {
        vertices.push(v.x, v.y, v.z);
      });
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }, [extraRowHoveredFaceGroup, faceGroups, faces, hoveredRegion, faceRegionData]);

  const regionOutlinesGeometry = useMemo(() => {
    const gi = extraRowHoveredFaceGroup;
    if (gi === null) return null;
    const fd = faceRegionData.get(gi);
    if (!fd || fd.regions.length === 0) return null;
    return createRegionEdgesGeometry(fd.regions, fd.cs);
  }, [extraRowHoveredFaceGroup, faceRegionData]);

  const handlePointerMove = useCallback((e: any) => {
    if (!extraRowFaceSelectMode) return;
    e.stopPropagation();
    if (e.faceIndex !== undefined) {
      const gi = groupMap[e.faceIndex];
      if (gi >= 0) {
        if (gi !== extraRowHoveredFaceGroup) {
          setExtraRowHoveredFaceGroup(gi);
        }

        const fd = faceRegionData.get(gi);
        if (fd && fd.regions.length > 0 && e.point) {
          const localPoint = e.object.worldToLocal(e.point.clone());
          const [uc, vc] = to2D(localPoint, fd.cs);

          const region = fd.regions.find(r =>
            uc >= r.uMin && uc <= r.uMax &&
            vc >= r.vMin && vc <= r.vMax
          );
          setHoveredRegion(region || null);
        } else {
          setHoveredRegion(null);
        }
      }
    }
  }, [extraRowFaceSelectMode, groupMap, extraRowHoveredFaceGroup, setExtraRowHoveredFaceGroup, faceRegionData]);

  const handlePointerOut = useCallback(() => {
    if (!extraRowFaceSelectMode) return;
    setExtraRowHoveredFaceGroup(null);
    setHoveredRegion(null);
  }, [extraRowFaceSelectMode, setExtraRowHoveredFaceGroup]);

  const handleClick = useCallback((e: any) => {
    if (!extraRowFaceSelectMode) return;
    e.stopPropagation();
    if (e.faceIndex !== undefined) {
      const gi = groupMap[e.faceIndex];
      if (gi >= 0) {
        setExtraRowHoveredFaceGroup(gi);

        const fd = faceRegionData.get(gi);
        if (fd && fd.regions.length > 0 && e.point) {
          const localPoint = e.object.worldToLocal(e.point.clone());
          const [uc, vc] = to2D(localPoint, fd.cs);
          const region = fd.regions.find(r =>
            uc >= r.uMin && uc <= r.uMax &&
            vc >= r.vMin && vc <= r.vMax
          );
          setHoveredRegion(region || null);
        }
      }
    }
  }, [extraRowFaceSelectMode, groupMap, setExtraRowHoveredFaceGroup, faceRegionData]);

  const handleContextMenu = useCallback((e: any) => {
    if (!extraRowFaceSelectMode) return;
    e.stopPropagation();
    e.nativeEvent?.preventDefault?.();
    if (extraRowHoveredFaceGroup !== null) {
      confirmExtraRowFace(extraRowHoveredFaceGroup);
    }
  }, [extraRowFaceSelectMode, extraRowHoveredFaceGroup, confirmExtraRowFace]);

  if (!extraRowFaceSelectMode || !geometry) return null;

  return (
    <>
      <mesh
        geometry={geometry}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        raycast={THREE.Mesh.prototype.raycast}
      >
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {highlightGeometry && (
        <mesh geometry={highlightGeometry} renderOrder={999}>
          <meshBasicMaterial
            color="#eab308"
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      )}
      {regionOutlinesGeometry && (
        <lineSegments geometry={regionOutlinesGeometry} renderOrder={1000}>
          <lineBasicMaterial color="#ca8a04" linewidth={2} />
        </lineSegments>
      )}
    </>
  );
});
