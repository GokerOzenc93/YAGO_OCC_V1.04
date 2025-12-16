import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { getFacesFromGeometry, FaceInfo } from '../services/filletEditor';

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
  face: FaceInfo;
  color: string;
  opacity: number;
  onClick: (e: any) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}> = ({ face, color, opacity, onClick, onPointerOver, onPointerOut }) => {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(9);

    positions[0] = face.vertices[0].x;
    positions[1] = face.vertices[0].y;
    positions[2] = face.vertices[0].z;
    positions[3] = face.vertices[1].x;
    positions[4] = face.vertices[1].y;
    positions[5] = face.vertices[1].z;
    positions[6] = face.vertices[2].x;
    positions[7] = face.vertices[2].y;
    positions[8] = face.vertices[2].z;

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [face]);

  return (
    <mesh
      geometry={geometry}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut();
      }}
    >
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
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
    const faceList = getFacesFromGeometry(shape.geometry);
    console.log(`✅ Loaded ${faceList.length} faces`);
    setFaces(faceList);
  }, [isActive, shape.geometry]);

  if (!isActive || faces.length === 0) {
    return null;
  }

  const handleFaceClick = (index: number, e: any) => {
    e.stopPropagation();
    onFaceSelect(index);
    console.log(`✓ Face ${index} selected`);
  };

  return (
    <group
      position={[shape.position[0], shape.position[1], shape.position[2]]}
      rotation={[shape.rotation[0], shape.rotation[1], shape.rotation[2]]}
      scale={[shape.scale[0], shape.scale[1], shape.scale[2]]}
    >
      {faces.map((face) => {
        const isSelected = face.faceIndex === selectedFace1Index || face.faceIndex === selectedFace2Index;
        const isHovered = face.faceIndex === hoveredFaceIndex;

        return (
          <React.Fragment key={face.faceIndex}>
            {(isSelected || isHovered) && (
              <FaceHighlight
                face={face}
                color="#ef4444"
                opacity={isSelected ? 0.6 : 0.4}
                onClick={(e) => handleFaceClick(face.faceIndex, e)}
                onPointerOver={() => onFaceHover(face.faceIndex)}
                onPointerOut={() => onFaceHover(null)}
              />
            )}
            {!isSelected && !isHovered && (
              <mesh
                geometry={(() => {
                  const geometry = new THREE.BufferGeometry();
                  const positions = new Float32Array(9);
                  positions[0] = face.vertices[0].x;
                  positions[1] = face.vertices[0].y;
                  positions[2] = face.vertices[0].z;
                  positions[3] = face.vertices[1].x;
                  positions[4] = face.vertices[1].y;
                  positions[5] = face.vertices[1].z;
                  positions[6] = face.vertices[2].x;
                  positions[7] = face.vertices[2].y;
                  positions[8] = face.vertices[2].z;
                  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                  geometry.computeVertexNormals();
                  return geometry;
                })()}
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
              >
                <meshBasicMaterial
                  transparent
                  opacity={0}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            )}
          </React.Fragment>
        );
      })}
    </group>
  );
};
