import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';
import { useAppStore } from '../store';

function getDominantAxis(v: THREE.Vector3): 'x' | 'y' | 'z' {
  const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
  if (ax > ay && ax > az) return 'x';
  if (ay > az) return 'y';
  return 'z';
}

function getComp(v: THREE.Vector3, axis: 'x' | 'y' | 'z'): number {
  return axis === 'x' ? v.x : axis === 'y' ? v.y : v.z;
}

function setComp(v: THREE.Vector3, axis: 'x' | 'y' | 'z', val: number): void {
  if (axis === 'x') v.x = val;
  else if (axis === 'y') v.y = val;
  else v.z = val;
}

interface SubRegionInfo {
  faceGroupIndex: number;
  region: THREE.Box3;
  faceAxis: 'x' | 'y' | 'z';
  facePosition: number;
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

  const panelInfos = useMemo(() => {
    return shapes
      .filter(s => s.type === 'panel' && s.parameters?.parentShapeId === shapeId && s.geometry)
      .map(panel => {
        const posAttr = panel.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (!posAttr) return null;
        const bbox = new THREE.Box3().setFromBufferAttribute(posAttr);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const axes = [
          { axis: 'x' as const, value: size.x },
          { axis: 'y' as const, value: size.y },
          { axis: 'z' as const, value: size.z }
        ];
        axes.sort((a, b) => a.value - b.value);

        return { bbox, normalAxis: axes[0].axis };
      })
      .filter(Boolean) as { bbox: THREE.Box3; normalAxis: 'x' | 'y' | 'z' }[];
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
    const facePosition = getComp(group.center, faceAxis);

    const spanAxes = (['x', 'y', 'z'] as const).filter(a => a !== faceAxis);

    const regionMin = faceBBox.min.clone();
    const regionMax = faceBBox.max.clone();

    for (const info of panelInfos) {
      if (!spanAxes.includes(info.normalAxis)) continue;

      const otherAxis = spanAxes.find(a => a !== info.normalAxis)!;
      const panelMinOther = getComp(info.bbox.min, otherAxis);
      const panelMaxOther = getComp(info.bbox.max, otherAxis);
      const faceMinOther = getComp(faceBBox.min, otherAxis);
      const faceMaxOther = getComp(faceBBox.max, otherAxis);

      if (panelMaxOther <= faceMinOther || panelMinOther >= faceMaxOther) continue;

      const dividerMin = getComp(info.bbox.min, info.normalAxis);
      const dividerMax = getComp(info.bbox.max, info.normalAxis);
      const dividerCenter = (dividerMin + dividerMax) / 2;
      const mousePos = getComp(localPoint, info.normalAxis);

      if (mousePos < dividerCenter) {
        const currentMax = getComp(regionMax, info.normalAxis);
        if (dividerMin < currentMax) {
          setComp(regionMax, info.normalAxis, dividerMin);
        }
      } else {
        const currentMin = getComp(regionMin, info.normalAxis);
        if (dividerMax > currentMin) {
          setComp(regionMin, info.normalAxis, dividerMax);
        }
      }
    }

    return {
      faceGroupIndex: groupIndex,
      region: new THREE.Box3(regionMin, regionMax),
      faceAxis,
      facePosition
    };
  }, [faces, faceGroups, panelInfos]);

  const displayInfo = lockedInfo || hoveredInfo;

  const highlightGeometry = useMemo(() => {
    if (!displayInfo) return null;

    const { region, faceAxis, facePosition } = displayInfo;
    const group = faceGroups[displayInfo.faceGroupIndex];
    if (!group) return null;

    const spanAxes = (['x', 'y', 'z'] as const).filter(a => a !== faceAxis);
    const a1 = spanAxes[0];
    const a2 = spanAxes[1];

    const normalDir = getComp(group.normal, faceAxis) > 0 ? 1 : -1;
    const pos = facePosition + normalDir * 0.5;

    const min1 = getComp(region.min, a1);
    const max1 = getComp(region.max, a1);
    const min2 = getComp(region.min, a2);
    const max2 = getComp(region.max, a2);

    if (max1 - min1 < 0.1 || max2 - min2 < 0.1) return null;

    const makeVert = (c1: number, c2: number): [number, number, number] => {
      const v = new THREE.Vector3();
      setComp(v, faceAxis, pos);
      setComp(v, a1, c1);
      setComp(v, a2, c2);
      return [v.x, v.y, v.z];
    };

    const v1 = makeVert(min1, min2);
    const v2 = makeVert(max1, min2);
    const v3 = makeVert(max1, max2);
    const v4 = makeVert(min1, max2);

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

    const localPoint = meshRef.current
      ? meshRef.current.worldToLocal(e.point.clone())
      : e.point.clone();

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
  }, [faceGroups, computeSubRegion, lockedInfo]);

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
