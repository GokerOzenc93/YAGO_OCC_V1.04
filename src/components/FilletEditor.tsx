import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { globalFaceSelectionManager, FaceInfo } from '../services/faceSelection';

interface FilletEditorProps {
  shape: any;
  isActive: boolean;
  selectedFace1Index: number | null;
  selectedFace2Index: number | null;
  hoveredFaceIndex: number | null;
  onFaceSelect: (index: number) => void;
  onFaceHover: (index: number | null) => void;
}

const FaceHighlight: React.FC<{
  faceIndex: number;
  color: string;
  opacity: number;
  onClick: (e: any) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}> = ({ faceIndex, color, opacity, onClick, onPointerOver, onPointerOut }) => {
  const geometry = useMemo(() => {
    return globalFaceSelectionManager.createFaceGeometry(faceIndex);
  }, [faceIndex]);

  const face = globalFaceSelectionManager.getFace(faceIndex);

  const offsetPosition = useMemo(() => {
    if (!face) return [0, 0, 0] as [number, number, number];
    return face.normal.clone().multiplyScalar(0.05).toArray() as [number, number, number];
  }, [face]);

  if (!geometry || !face) return null;

  return (
    <mesh
      geometry={geometry}
      position={offsetPosition}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut();
      }}
      renderOrder={999}
    >
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
        polygonOffset={true}
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
};

export const FilletEditor: React.FC<FilletEditorProps> = ({
  shape,
  isActive,
  selectedFace1Index,
  selectedFace2Index,
  hoveredFaceIndex,
  onFaceSelect,
  onFaceHover
}) => {
  const [faces, setFaces] = useState<FaceInfo[]>([]);

  useEffect(() => {
    if (!isActive || !shape.geometry) {
      setFaces([]);
      return;
    }

    console.log('🔍 Loading faces for fillet editor...');
    globalFaceSelectionManager.loadFromGeometry(shape.geometry);
    const faceList = globalFaceSelectionManager.getFaces();
    console.log(`✅ Loaded ${faceList.length} faces`);
    setFaces(faceList);
  }, [isActive, shape.geometry]);

  const handleFaceClick = (index: number, e: any) => {
    e.stopPropagation();
    onFaceSelect(index);
    console.log(`✓ Face ${index} selected`);
  };

  const invisibleGeometries = useMemo(() => {
    return faces.map((face, idx) => {
      return globalFaceSelectionManager.createFaceGeometry(face.faceIndex);
    });
  }, [faces]);

  if (!isActive || faces.length === 0) {
    return null;
  }

  return (
    <group
      position={[shape.position[0], shape.position[1], shape.position[2]]}
      rotation={[shape.rotation[0], shape.rotation[1], shape.rotation[2]]}
      scale={[shape.scale[0], shape.scale[1], shape.scale[2]]}
    >
      {faces.map((face, idx) => {
        const isSelected = face.faceIndex === selectedFace1Index || face.faceIndex === selectedFace2Index;
        const isHovered = face.faceIndex === hoveredFaceIndex;

        return (
          <React.Fragment key={face.faceIndex}>
            {(isSelected || isHovered) && (
              <FaceHighlight
                faceIndex={face.faceIndex}
                color="#ef4444"
                opacity={isSelected ? 0.5 : 0.3}
                onClick={(e) => handleFaceClick(face.faceIndex, e)}
                onPointerOver={() => onFaceHover(face.faceIndex)}
                onPointerOut={() => onFaceHover(null)}
              />
            )}
            {invisibleGeometries[idx] && (
              <mesh
                geometry={invisibleGeometries[idx]!}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFaceClick(face.faceIndex, e);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  onFaceHover(face.faceIndex);
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  onFaceHover(null);
                }}
                visible={false}
              >
                <meshBasicMaterial
                  transparent
                  opacity={0}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </React.Fragment>
        );
      })}
    </group>
  );
};
