import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store';

interface Edge {
  start: THREE.Vector3;
  end: THREE.Vector3;
  midpoint: THREE.Vector3;
  index: number;
}

interface EdgeEditorProps {
  shape: any;
  isActive: boolean;
  onEdgeSelect: (index: number) => void;
}

function getEdgesFromGeometry(geometry: THREE.BufferGeometry): Edge[] {
  const edges: Edge[] = [];
  const edgesGeometry = new THREE.EdgesGeometry(geometry, 1);
  const positions = edgesGeometry.attributes.position.array;

  for (let i = 0; i < positions.length; i += 6) {
    const start = new THREE.Vector3(
      positions[i],
      positions[i + 1],
      positions[i + 2]
    );
    const end = new THREE.Vector3(
      positions[i + 3],
      positions[i + 4],
      positions[i + 5]
    );
    const midpoint = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5);

    edges.push({
      start,
      end,
      midpoint,
      index: i / 6
    });
  }

  return edges;
}

export function EdgeEditor({ shape, isActive, onEdgeSelect }: EdgeEditorProps) {
  const { hoveredEdgeIndex, setHoveredEdgeIndex, selectedEdgeIndex } = useAppStore();

  const edges = useMemo(() => {
    if (!shape.geometry) return [];
    return getEdgesFromGeometry(shape.geometry);
  }, [shape.geometry]);

  if (!isActive || !shape.geometry) return null;

  return (
    <group
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
    >
      {edges.map((edge) => {
        const isHovered = hoveredEdgeIndex === edge.index;
        const isSelected = selectedEdgeIndex === edge.index;
        const isHighlighted = isHovered || isSelected;

        return (
          <group key={edge.index}>
            <Line
              points={[edge.start, edge.end]}
              color={isSelected ? '#ff0000' : isHovered ? '#ff6666' : '#00ff00'}
              lineWidth={isHighlighted ? 4 : 2}
              transparent
              opacity={isHighlighted ? 1.0 : 0.6}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!isSelected) {
                  setHoveredEdgeIndex(edge.index);
                }
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredEdgeIndex(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeSelect(edge.index);
              }}
            />
            {isHighlighted && (
              <mesh position={edge.midpoint}>
                <sphereGeometry args={[3, 16, 16]} />
                <meshBasicMaterial
                  color={isSelected ? '#ff0000' : '#ff6666'}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
