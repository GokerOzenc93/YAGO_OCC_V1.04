import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useAppStore } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
  extractGroupBoundaryEdges,
  createEdgeGeometry,
  type FaceData,
  type CoplanarFaceGroup
} from '../services/faceEditor';

interface FaceEditorProps {
  shape: any;
  isActive: boolean;
}

export const FaceEditor: React.FC<FaceEditorProps> = ({ shape, isActive }) => {
  const {
    hoveredFaceIndex,
    setHoveredFaceIndex,
    selectedFaceIndex,
    setSelectedFaceIndex,
    filletMode,
    selectedFilletFaces,
    addFilletFace,
    addFilletFaceData
  } = useAppStore();

  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!shape.geometry) return;

    console.log('🔍 Extracting faces from geometry...');
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    console.log(`✅ Extracted ${extractedFaces.length} faces`);

    setFaces(extractedFaces);

    const groups = groupCoplanarFaces(extractedFaces);
    console.log(`✅ Grouped into ${groups.length} coplanar face groups`);

    setFaceGroups(groups);
  }, [shape.geometry, shape.id]);

  const handlePointerMove = (e: any) => {
    if (!isActive || faces.length === 0) return;

    e.stopPropagation();
    const faceIndex = e.faceIndex;

    if (faceIndex !== undefined) {
      const groupIndex = faceGroups.findIndex(group =>
        group.faceIndices.includes(faceIndex)
      );

      if (groupIndex !== -1) {
        setHoveredGroupIndex(groupIndex);
        setHoveredFaceIndex(faceIndex);
      }
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredGroupIndex(null);
    setHoveredFaceIndex(null);
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();

    if (e.button === 2 && hoveredGroupIndex !== null) {
      if (filletMode && selectedFilletFaces.length < 2) {
        const group = faceGroups[hoveredGroupIndex];
        if (group) {
          addFilletFace(hoveredGroupIndex);
          addFilletFaceData({
            normal: [group.normal.x, group.normal.y, group.normal.z],
            center: [group.center.x, group.center.y, group.center.z]
          });
          console.log(`✅ Fillet face ${selectedFilletFaces.length + 1} selected:`, hoveredGroupIndex);
          console.log('   Normal:', [group.normal.x.toFixed(2), group.normal.y.toFixed(2), group.normal.z.toFixed(2)]);
          console.log('   Center:', [group.center.x.toFixed(2), group.center.y.toFixed(2), group.center.z.toFixed(2)]);

          if (selectedFilletFaces.length === 1) {
            console.log('🎯 Two faces selected! Ready for fillet operation. Enter radius in terminal.');
          }
        }
      } else {
        setSelectedFaceIndex(hoveredGroupIndex);
        console.log('✅ Face group selected:', hoveredGroupIndex);
      }
    }
  };

  const selectedFilletGeometries = useMemo(() => {
    if (!filletMode || selectedFilletFaces.length === 0) return [];

    return selectedFilletFaces.map(faceGroupIndex => {
      const group = faceGroups[faceGroupIndex];
      if (!group) return null;
      return createFaceHighlightGeometry(faces, group.faceIndices);
    }).filter(g => g !== null);
  }, [filletMode, selectedFilletFaces, faceGroups, faces]);

  const selectedFilletEdges = useMemo(() => {
    if (!filletMode || selectedFilletFaces.length === 0) return [];

    return selectedFilletFaces.map(faceGroupIndex => {
      const group = faceGroups[faceGroupIndex];
      if (!group) return null;
      const edges = extractGroupBoundaryEdges(faces, group, faceGroups);
      console.log(`🔍 Group ${faceGroupIndex} boundary edges:`, edges.length);
      return edges.length > 0 ? edges : null;
    }).filter(e => e !== null);
  }, [filletMode, selectedFilletFaces, faceGroups, faces]);

  const highlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;

    const group = faceGroups[hoveredGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const hoveredGroupEdges = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex] || selectedFilletFaces.includes(hoveredGroupIndex)) return null;

    const group = faceGroups[hoveredGroupIndex];
    const edges = extractGroupBoundaryEdges(faces, group, faceGroups);
    return edges.length > 0 ? edges : null;
  }, [hoveredGroupIndex, faceGroups, faces, selectedFilletFaces]);

  const isFilletGroup = (group: CoplanarFaceGroup): boolean => {
    if (group.faceIndices.length < 3) return false;

    let hasVariation = false;
    const firstNormal = faces[group.faceIndices[0]].normal;

    for (let i = 1; i < group.faceIndices.length; i++) {
      const currentNormal = faces[group.faceIndices[i]].normal;
      const dot = firstNormal.dot(currentNormal);
      const angle = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;

      if (angle > 1) {
        hasVariation = true;
        break;
      }
    }

    return hasVariation;
  };

  const filletGroupGeometries = useMemo(() => {
    return faceGroups
      .map((group, idx) => {
        if (!isFilletGroup(group)) return null;

        const geometry = createFaceHighlightGeometry(faces, group.faceIndices);
        const edges = extractGroupBoundaryEdges(faces, group, faceGroups);

        return {
          groupIndex: idx,
          geometry,
          edges,
          center: group.center
        };
      })
      .filter(g => g !== null);
  }, [faceGroups, faces]);

  const flatGroupGeometries = useMemo(() => {
    return faceGroups
      .map((group, idx) => {
        if (isFilletGroup(group)) return null;

        const geometry = createFaceHighlightGeometry(faces, group.faceIndices);

        return {
          groupIndex: idx,
          geometry
        };
      })
      .filter(g => g !== null);
  }, [faceGroups, faces]);

  if (!isActive) return null;

  return (
    <>
      <mesh
        geometry={shape.geometry}
        visible={false}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.stopPropagation()}
      />

      {flatGroupGeometries.map((item) => (
        <mesh
          key={`flat-${item.groupIndex}`}
          geometry={item.geometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <meshStandardMaterial
            color={0x94a3b8}
            metalness={0.3}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {filletGroupGeometries.map((item) => (
        <React.Fragment key={`fillet-${item.groupIndex}`}>
          <mesh
            geometry={item.geometry}
            position={shape.position}
            rotation={shape.rotation}
            scale={shape.scale}
          >
            <meshStandardMaterial
              color={0x3b82f6}
              metalness={0.4}
              roughness={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>

          {item.edges.map((edge, edgeIdx) => {
            const points = [
              edge.v1.clone().applyMatrix4(
                new THREE.Matrix4().compose(
                  new THREE.Vector3(...shape.position),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
                  new THREE.Vector3(...shape.scale)
                )
              ),
              edge.v2.clone().applyMatrix4(
                new THREE.Matrix4().compose(
                  new THREE.Vector3(...shape.position),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
                  new THREE.Vector3(...shape.scale)
                )
              )
            ];

            return (
              <Line
                key={`fillet-edge-${item.groupIndex}-${edgeIdx}`}
                points={points}
                color={0xfbbf24}
                lineWidth={3}
                dashed={false}
              />
            );
          })}
        </React.Fragment>
      ))}

      {selectedFilletGeometries.map((geom, idx) => (
        <mesh
          key={`selected-${idx}`}
          geometry={geom}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}

      {selectedFilletEdges.map((edges, groupIdx) =>
        edges && edges.map((edge, edgeIdx) => {
          const points = [
            edge.v1.clone().applyMatrix4(
              new THREE.Matrix4().compose(
                new THREE.Vector3(...shape.position),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
                new THREE.Vector3(...shape.scale)
              )
            ),
            edge.v2.clone().applyMatrix4(
              new THREE.Matrix4().compose(
                new THREE.Vector3(...shape.position),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
                new THREE.Vector3(...shape.scale)
              )
            )
          ];

          return (
            <Line
              key={`edge-${groupIdx}-${edgeIdx}`}
              points={points}
              color={0x00ff00}
              lineWidth={5}
              dashed={false}
            />
          );
        })
      )}

      {highlightGeometry && !selectedFilletFaces.includes(hoveredGroupIndex!) && (
        <>
          <mesh
            geometry={highlightGeometry}
            position={shape.position}
            rotation={shape.rotation}
            scale={shape.scale}
          >
            <meshBasicMaterial
              color={hoveredGroupIndex !== null && isFilletGroup(faceGroups[hoveredGroupIndex]) ? 0x3b82f6 : 0xff0000}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>

          {hoveredGroupEdges && hoveredGroupEdges.map((edge, edgeIdx) => {
            const points = [
              edge.v1.clone().applyMatrix4(
                new THREE.Matrix4().compose(
                  new THREE.Vector3(...shape.position),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
                  new THREE.Vector3(...shape.scale)
                )
              ),
              edge.v2.clone().applyMatrix4(
                new THREE.Matrix4().compose(
                  new THREE.Vector3(...shape.position),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
                  new THREE.Vector3(...shape.scale)
                )
              )
            ];

            return (
              <Line
                key={`hover-edge-${edgeIdx}`}
                points={points}
                color={hoveredGroupIndex !== null && isFilletGroup(faceGroups[hoveredGroupIndex]) ? 0xfbbf24 : 0x22c55e}
                lineWidth={4}
                dashed={false}
              />
            );
          })}
        </>
      )}
    </>
  );
};
