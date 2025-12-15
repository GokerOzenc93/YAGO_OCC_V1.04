import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { extractEdgesFromGeometry } from '../services/edgeFilletEditor';

interface EdgeFilletEditorProps {
  shape: any;
  isActive: boolean;
  onEdgeSelect: (index: number) => void;
}

export const EdgeFilletEditor: React.FC<EdgeFilletEditorProps> = ({
  shape,
  isActive,
  onEdgeSelect
}) => {
  const { selectedEdgeIndex } = useAppStore();
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);

  const edges = useMemo(() => {
    if (!shape.geometry) return [];
    return extractEdgesFromGeometry(shape.geometry);
  }, [shape.geometry]);

  if (!isActive || edges.length === 0) return null;

  return (
    <group
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
    >
      {edges.map((edge, index) => {
        const isSelected = selectedEdgeIndex === index;
        const isHovered = hoveredEdgeIndex === index;
        const midpoint = new THREE.Vector3(
          (edge.start.x + edge.end.x) / 2,
          (edge.start.y + edge.end.y) / 2,
          (edge.start.z + edge.end.z) / 2
        );

        return (
          <group key={`edge-${index}`}>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    edge.start.x, edge.start.y, edge.start.z,
                    edge.end.x, edge.end.y, edge.end.z
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#ffffff'}
                linewidth={isSelected ? 4 : isHovered ? 3 : 2}
                transparent
                opacity={0.9}
              />
            </line>

            <mesh
              position={[midpoint.x, midpoint.y, midpoint.z]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredEdgeIndex(index);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredEdgeIndex(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeSelect(index);
              }}
            >
              <sphereGeometry args={[5, 8, 8]} />
              <meshBasicMaterial
                color={isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : '#ffffff'}
                transparent
                opacity={isSelected ? 1 : isHovered ? 0.8 : 0.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
