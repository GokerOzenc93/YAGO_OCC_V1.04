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
    const vertexCount = face.vertices.length;
    const positions = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      positions[i * 3] = face.vertices[i].x;
      positions[i * 3 + 1] = face.vertices[i].y;
      positions[i * 3 + 2] = face.vertices[i].z;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [face]);

  const offsetPosition = useMemo(() => {
    return face.normal.clone().multiplyScalar(0.5);
  }, [face.normal]);

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
        depthTest={true}
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

  const invisibleGeometries = useMemo(() => {
    return faces.map(face => {
      const geometry = new THREE.BufferGeometry();
      const vertexCount = face.vertices.length;
      const positions = new Float32Array(vertexCount * 3);

      for (let i = 0; i < vertexCount; i++) {
        positions[i * 3] = face.vertices[i].x;
        positions[i * 3 + 1] = face.vertices[i].y;
        positions[i * 3 + 2] = face.vertices[i].z;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      return geometry;
    });
  }, [faces]);

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
                face={face}
                color="#ef4444"
                opacity={isSelected ? 0.5 : 0.3}
                onClick={(e) => handleFaceClick(face.faceIndex, e)}
                onPointerOver={() => onFaceHover(face.faceIndex)}
                onPointerOut={() => onFaceHover(null)}
              />
            )}
            <mesh
              geometry={invisibleGeometries[idx]}
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
          </React.Fragment>
        );
      })}
    </group>
  );
};
