import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  createFaceHighlightGeometry,
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
    const planarCount = groups.filter(g => g.type === 'planar').length;
    const curvedCount = groups.filter(g => g.type === 'curved').length;
    const angulatedCount = groups.filter(g => g.type === 'angulated').length;

    console.log(`✅ Grouped into ${groups.length} face groups:`);
    console.log(`   - ${planarCount} düz yüzey grupları`);
    console.log(`   - ${curvedCount} kavisli yüzey grupları`);
    console.log(`   - ${angulatedCount} açılı yüzey grupları`);

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

          const typeNames = {
            planar: 'Düz',
            curved: 'Kavisli',
            angulated: 'Açılı'
          };

          console.log(`✅ Fillet yüzeyi ${selectedFilletFaces.length + 1} seçildi (${typeNames[group.type]}):`, hoveredGroupIndex);
          console.log(`   Tip: ${typeNames[group.type]}`);
          console.log('   Yüzey sayısı:', group.faceIndices.length);
          console.log('   Normal:', [group.normal.x.toFixed(2), group.normal.y.toFixed(2), group.normal.z.toFixed(2)]);
          console.log('   Center:', [group.center.x.toFixed(2), group.center.y.toFixed(2), group.center.z.toFixed(2)]);

          if (selectedFilletFaces.length === 1) {
            console.log('🎯 İki yüzey seçildi! Fillet işlemi hazır. Terminale yarıçap girin.');
          }
        }
      } else {
        const group = faceGroups[hoveredGroupIndex];
        if (group) {
          const typeNames = {
            planar: 'Düz',
            curved: 'Kavisli',
            angulated: 'Açılı'
          };
          setSelectedFaceIndex(hoveredGroupIndex);
          console.log(`✅ ${typeNames[group.type]} yüzey grubu seçildi:`, hoveredGroupIndex);
          console.log(`   Yüzey sayısı: ${group.faceIndices.length}`);
        }
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

  const highlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;

    const group = faceGroups[hoveredGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const getHighlightColor = (type: 'planar' | 'curved' | 'angulated') => {
    switch (type) {
      case 'planar':
        return 0x00ff00;
      case 'curved':
        return 0xffaa00;
      case 'angulated':
        return 0x00aaff;
      default:
        return 0xff0000;
    }
  };

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

      {highlightGeometry && !selectedFilletFaces.includes(hoveredGroupIndex!) && hoveredGroupIndex !== null && (
        <mesh
          geometry={highlightGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <meshBasicMaterial
            color={getHighlightColor(faceGroups[hoveredGroupIndex].type)}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
    </>
  );
};
