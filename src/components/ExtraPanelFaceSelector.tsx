import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';
import { useAppStore } from '../store';

type Axis = 'x' | 'y' | 'z';

function getDominantAxis(v: THREE.Vector3): Axis {
  const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
  if (ax > ay && ax > az) return 'x';
  if (ay > az) return 'y';
  return 'z';
}

function gc(v: THREE.Vector3, a: Axis): number {
  return a === 'x' ? v.x : a === 'y' ? v.y : v.z;
}

function sc(v: THREE.Vector3, a: Axis, val: number): void {
  if (a === 'x') v.x = val;
  else if (a === 'y') v.y = val;
  else v.z = val;
}

function roleToNormalAxis(role: string | undefined | null): Axis | null {
  if (role === 'Left' || role === 'Right') return 'x';
  if (role === 'Top' || role === 'Bottom') return 'y';
  if (role === 'Back' || role === 'Door') return 'z';
  return null;
}

interface SubRegionInfo {
  faceGroupIndex: number;
  region: THREE.Box3;
  faceAxis: Axis;
  facePosition: number;
}

interface PanelDividerInfo {
  bbox: THREE.Box3;
  normalAxis: Axis;
}

interface ExtraPanelFaceSelectorProps {
  geometry: THREE.BufferGeometry;
  shapeId: string;
  onFaceSelect: (faceIndex: number) => void;
  onFaceConfirm: (faceIndex: number) => void;
  highlightedFace: number | null;
}

export function ExtraPanelFaceSelector({
  geometry,
  shapeId,
  onFaceSelect,
  onFaceConfirm,
  highlightedFace
}: ExtraPanelFaceSelectorProps) {
  const [hoveredInfo, setHoveredInfo] = useState<SubRegionInfo | null>(null);
  const [lockedInfo, setLockedInfo] = useState<SubRegionInfo | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const shapes = useAppStore(state => state.shapes);

  const { faces, faceGroups } = useMemo(() => {
    const extractedFaces = extractFacesFromGeometry(geometry);
    const groups = groupCoplanarFaces(extractedFaces);
    return { faces: extractedFaces, faceGroups: groups };
  }, [geometry]);

  const bodyBBox = useMemo(() => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return new THREE.Box3();
    return new THREE.Box3().setFromBufferAttribute(posAttr);
  }, [geometry]);

  const panelDividers = useMemo((): PanelDividerInfo[] => {
    return shapes
      .filter(s => s.type === 'panel' && s.parameters?.parentShapeId === shapeId && s.geometry)
      .map(panel => {
        const posAttr = panel.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (!posAttr) return null;
        const bbox = new THREE.Box3().setFromBufferAttribute(posAttr);

        let normalAxis = roleToNormalAxis(panel.parameters?.faceRole);

        if (!normalAxis) {
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const axes: { axis: Axis; value: number }[] = [
            { axis: 'x', value: size.x },
            { axis: 'y', value: size.y },
            { axis: 'z', value: size.z }
          ];
          axes.sort((a, b) => a.value - b.value);
          normalAxis = axes[0].axis;
        }

        return { bbox, normalAxis };
      })
      .filter(Boolean) as PanelDividerInfo[];
  }, [shapes, shapeId]);

  useEffect(() => {
    if (highlightedFace === null) {
      setLockedInfo(null);
    }
  }, [highlightedFace]);

  const computeSubRegion = useCallback((groupIndex: number, localPoint: THREE.Vector3): SubRegionInfo | null => {
    const group = faceGroups[groupIndex];
    if (!group) return null;

    const faceBBox = new THREE.Box3();
    group.faceIndices.forEach(idx => {
      faces[idx].vertices.forEach(v => faceBBox.expandByPoint(v));
    });

    const faceAxis = getDominantAxis(group.normal);
    const facePosition = gc(group.center, faceAxis);

    const spanAxes: Axis[] = (['x', 'y', 'z'] as const).filter(a => a !== faceAxis);

    const regionMin = faceBBox.min.clone();
    const regionMax = faceBBox.max.clone();

    for (const divider of panelDividers) {
      const divAxis = divider.normalAxis;
      if (divAxis === faceAxis) continue;
      if (!spanAxes.includes(divAxis)) continue;

      const otherAxis = spanAxes.find(a => a !== divAxis)!;

      const panelMinOnOther = gc(divider.bbox.min, otherAxis);
      const panelMaxOnOther = gc(divider.bbox.max, otherAxis);
      const faceMinOnOther = gc(faceBBox.min, otherAxis);
      const faceMaxOnOther = gc(faceBBox.max, otherAxis);
      if (panelMaxOnOther <= faceMinOnOther || panelMinOnOther >= faceMaxOnOther) continue;

      const panelMinOnFaceAxis = gc(divider.bbox.min, faceAxis);
      const panelMaxOnFaceAxis = gc(divider.bbox.max, faceAxis);
      const bodyMin = gc(bodyBBox.min, faceAxis);
      const bodyMax = gc(bodyBBox.max, faceAxis);
      const faceNormalSign = gc(group.normal, faceAxis);
      const faceIsAtMin = Math.abs(facePosition - bodyMin) < Math.abs(facePosition - bodyMax);

      if (faceIsAtMin) {
        if (panelMinOnFaceAxis > facePosition + (bodyMax - bodyMin) * 0.5) continue;
      } else {
        if (panelMaxOnFaceAxis < facePosition - (bodyMax - bodyMin) * 0.5) continue;
      }

      const divMin = gc(divider.bbox.min, divAxis);
      const divMax = gc(divider.bbox.max, divAxis);
      const faceSpanMin = gc(faceBBox.min, divAxis);
      const faceSpanMax = gc(faceBBox.max, divAxis);
      if (divMax <= faceSpanMin || divMin >= faceSpanMax) continue;

      const divCenter = (divMin + divMax) / 2;
      const mouseOnDivAxis = gc(localPoint, divAxis);

      if (mouseOnDivAxis < divCenter) {
        const curMax = gc(regionMax, divAxis);
        if (divMin < curMax) {
          sc(regionMax, divAxis, divMin);
        }
      } else {
        const curMin = gc(regionMin, divAxis);
        if (divMax > curMin) {
          sc(regionMin, divAxis, divMax);
        }
      }
    }

    return {
      faceGroupIndex: groupIndex,
      region: new THREE.Box3(regionMin, regionMax),
      faceAxis,
      facePosition
    };
  }, [faces, faceGroups, panelDividers, bodyBBox]);

  const displayInfo = lockedInfo || hoveredInfo;

  const highlightGeometry = useMemo(() => {
    if (!displayInfo) return null;

    const { region, faceAxis, facePosition } = displayInfo;
    const group = faceGroups[displayInfo.faceGroupIndex];
    if (!group) return null;

    const spanAxes: Axis[] = (['x', 'y', 'z'] as const).filter(a => a !== faceAxis);
    const a1 = spanAxes[0];
    const a2 = spanAxes[1];

    const normalDir = gc(group.normal, faceAxis) > 0 ? 1 : -1;
    const pos = facePosition + normalDir * 0.5;

    const min1 = gc(region.min, a1);
    const max1 = gc(region.max, a1);
    const min2 = gc(region.min, a2);
    const max2 = gc(region.max, a2);

    if (max1 - min1 < 0.1 || max2 - min2 < 0.1) return null;

    const mv = (c1: number, c2: number): [number, number, number] => {
      const v = new THREE.Vector3();
      sc(v, faceAxis, pos);
      sc(v, a1, c1);
      sc(v, a2, c2);
      return [v.x, v.y, v.z];
    };

    const v1 = mv(min1, min2);
    const v2 = mv(max1, min2);
    const v3 = mv(max1, max2);
    const v4 = mv(min1, max2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      ...v1, ...v2, ...v3,
      ...v1, ...v3, ...v4,
    ]), 3));
    geo.computeVertexNormals();

    return geo;
  }, [displayInfo, faceGroups]);

  const edgeGeometry = useMemo(() => {
    if (!highlightGeometry) return null;
    return new THREE.EdgesGeometry(highlightGeometry);
  }, [highlightGeometry]);

  const toLocal = useCallback((e: any): THREE.Vector3 => {
    const pt = e.point.clone();
    const obj = e.object as THREE.Object3D | undefined;
    if (obj) {
      obj.updateWorldMatrix(true, false);
      const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
      pt.applyMatrix4(inv);
    }
    return pt;
  }, []);

  const handlePointerMove = useCallback((e: any) => {
    e.stopPropagation();
    if (lockedInfo) return;

    const faceIndex = e.faceIndex;
    if (faceIndex === undefined) return;

    const groupIndex = faceGroups.findIndex(group =>
      group.faceIndices.includes(faceIndex)
    );

    if (groupIndex === -1) {
      setHoveredInfo(null);
      return;
    }

    const localPoint = toLocal(e);
    const sub = computeSubRegion(groupIndex, localPoint);
    setHoveredInfo(prev => {
      if (prev && sub &&
        prev.faceGroupIndex === sub.faceGroupIndex &&
        prev.region.min.distanceTo(sub.region.min) < 0.01 &&
        prev.region.max.distanceTo(sub.region.max) < 0.01) {
        return prev;
      }
      return sub;
    });
  }, [faceGroups, computeSubRegion, lockedInfo, toLocal]);

  const handlePointerOut = useCallback((e: any) => {
    e.stopPropagation();
    if (!lockedInfo) {
      setHoveredInfo(null);
    }
  }, [lockedInfo]);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (hoveredInfo) {
      setLockedInfo(hoveredInfo);
      onFaceSelect(hoveredInfo.faceGroupIndex);
    }
  }, [hoveredInfo, onFaceSelect]);

  const handleContextMenu = useCallback((e: any) => {
    e.stopPropagation();
    const info = lockedInfo || hoveredInfo;
    if (info) {
      onFaceConfirm(info.faceGroupIndex);
      setLockedInfo(null);
      setHoveredInfo(null);
    }
  }, [lockedInfo, hoveredInfo, onFaceConfirm]);

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <meshBasicMaterial
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {highlightGeometry && (
        <>
          <mesh geometry={highlightGeometry}>
            <meshBasicMaterial
              color="#ff0000"
              opacity={lockedInfo ? 0.45 : 0.25}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
          {edgeGeometry && (
            <lineSegments geometry={edgeGeometry}>
              <lineBasicMaterial color="#ff0000" linewidth={2} />
            </lineSegments>
          )}
        </>
      )}
    </>
  );
}
