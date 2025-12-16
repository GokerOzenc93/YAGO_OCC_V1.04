import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';

interface EdgeSelectorProps {
  shape: any;
  isActive: boolean;
}

interface EdgeData {
  points: THREE.Vector3[];
  index: number;
}

export const EdgeSelector: React.FC<EdgeSelectorProps> = ({ shape, isActive }) => {
  const {
    hoveredEdgeIndex,
    setHoveredEdgeIndex,
    selectedEdgeIndex,
    setSelectedEdgeIndex
  } = useAppStore();

  const [edges, setEdges] = useState<EdgeData[]>([]);

  useEffect(() => {
    if (!isActive || !shape.replicadShape) {
      setEdges([]);
      return;
    }

    const loadEdges = async () => {
      try {
        const replicadEdges = shape.replicadShape.edges;
        if (!replicadEdges || replicadEdges.length === 0) {
          console.warn('Shape has no edges');
          return;
        }

        const edgeData: EdgeData[] = [];

        for (let i = 0; i < replicadEdges.length; i++) {
          const edge = replicadEdges[i];

          const points: THREE.Vector3[] = [];
          const numSamples = 30;

          for (let t = 0; t <= 1; t += 1 / numSamples) {
            try {
              const point = edge.pointAt(t);
              if (point && point.x !== undefined && point.y !== undefined && point.z !== undefined) {
                points.push(new THREE.Vector3(point.x, point.y, point.z));
              }
            } catch (err) {
              console.warn(`Failed to sample edge ${i} at t=${t}`, err);
            }
          }

          if (points.length > 1) {
            edgeData.push({ points, index: i });
          }
        }

        setEdges(edgeData);
        console.log(`✅ Loaded ${edgeData.length} edges for shape ${shape.id}`);
      } catch (error) {
        console.error('Failed to load edges:', error);
      }
    };

    loadEdges();
  }, [isActive, shape.replicadShape, shape.id]);

  if (!isActive || edges.length === 0) {
    return null;
  }

  return (
    <group>
      {edges.map((edgeData) => {
        const isHovered = hoveredEdgeIndex === edgeData.index;
        const isSelected = selectedEdgeIndex === edgeData.index;
        const color = isHovered || isSelected ? 0x8B0000 : 0x555555;
        const tubeRadius = isHovered || isSelected ? 3 : 2;

        const curve = new THREE.CatmullRomCurve3(edgeData.points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, tubeRadius, 8, false);

        return (
          <mesh
            key={`edge-${edgeData.index}`}
            geometry={tubeGeometry}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredEdgeIndex(edgeData.index);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              if (hoveredEdgeIndex === edgeData.index) {
                setHoveredEdgeIndex(null);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedEdgeIndex(isSelected ? null : edgeData.index);
              console.log(`Edge ${edgeData.index} ${isSelected ? 'deselected' : 'selected'}`);
            }}
          >
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
};
