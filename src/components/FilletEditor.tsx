import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { getEdgesFromReplicadShape, findClosestEdge, EdgeInfo } from '../services/fillet';
import { Shape } from '../store';

interface FilletEditorProps {
  shape: Shape;
  isActive: boolean;
  selectedEdgeIndex: number | null;
  onEdgeSelect: (index: number) => void;
}

export const FilletEditor: React.FC<FilletEditorProps> = ({
  shape,
  isActive,
  selectedEdgeIndex,
  onEdgeSelect
}) => {
  const { raycaster, camera, gl } = useThree();
  const [edges, setEdges] = useState<EdgeInfo[]>([]);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive || !shape.replicadShape) return;

    const loadEdges = async () => {
      console.log('🔍 Loading edges for fillet editor...');
      const edgeInfos = await getEdgesFromReplicadShape(shape.replicadShape);
      setEdges(edgeInfos);
      console.log(`✅ Loaded ${edgeInfos.length} edges`);
    };

    loadEdges();
  }, [isActive, shape.id, shape.replicadShape]);

  const handleSphereClick = (edgeIndex: number) => (event: any) => {
    event.stopPropagation();
    console.log('✅ Edge sphere clicked:', edgeIndex);
    onEdgeSelect(edgeIndex);
  };

  const edgeLines = useMemo(() => {
    if (!isActive || edges.length === 0) return null;

    return edges.map((edge, index) => {
      const isSelected = selectedEdgeIndex === index;
      const isHovered = hoveredEdgeIndex === index;

      const points = [edge.start, edge.end];

      const color = isSelected ? '#00ff00' : isHovered ? '#ffff00' : '#ff0000';
      const sphereSize = isSelected ? 8 : isHovered ? 6 : 4;

      return (
        <group key={`edge-${index}`} position={shape.position}>
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
            <lineBasicMaterial color={color} linewidth={3} />
          </line>
          <mesh
            position={[edge.midpoint.x, edge.midpoint.y, edge.midpoint.z]}
            onClick={handleSphereClick(index)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredEdgeIndex(index);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoveredEdgeIndex(null);
            }}
          >
            <sphereGeometry args={[sphereSize, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        </group>
      );
    });
  }, [edges, selectedEdgeIndex, hoveredEdgeIndex, isActive, shape.position]);

  if (!isActive || edges.length === 0) return null;

  return <>{edgeLines}</>;
};
