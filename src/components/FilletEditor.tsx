import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
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
  const meshRef = useRef<THREE.Mesh>(null);
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

  const handleMeshClick = (event: any) => {
    event.stopPropagation();

    if (edges.length === 0) return;

    const intersectPoint = event.point.clone();

    const localPoint = intersectPoint.clone();
    localPoint.sub(new THREE.Vector3(...shape.position));

    const inverseRotation = new THREE.Euler(-shape.rotation[0], -shape.rotation[1], -shape.rotation[2]);
    localPoint.applyEuler(inverseRotation);

    localPoint.x /= shape.scale[0];
    localPoint.y /= shape.scale[1];
    localPoint.z /= shape.scale[2];

    const closestEdge = findClosestEdge(localPoint, edges, 80);

    if (closestEdge) {
      console.log('✅ Edge selected from geometry click:', closestEdge.index);
      onEdgeSelect(closestEdge.index);
    }
  };

  const handleMeshMove = (event: any) => {
    event.stopPropagation();

    if (edges.length === 0) return;

    const intersectPoint = event.point.clone();

    const localPoint = intersectPoint.clone();
    localPoint.sub(new THREE.Vector3(...shape.position));

    const inverseRotation = new THREE.Euler(-shape.rotation[0], -shape.rotation[1], -shape.rotation[2]);
    localPoint.applyEuler(inverseRotation);

    localPoint.x /= shape.scale[0];
    localPoint.y /= shape.scale[1];
    localPoint.z /= shape.scale[2];

    const closestEdge = findClosestEdge(localPoint, edges, 80);

    if (closestEdge) {
      setHoveredEdgeIndex(closestEdge.index);
    } else {
      setHoveredEdgeIndex(null);
    }
  };

  if (!isActive || edges.length === 0) return null;

  return (
    <>
      <group
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
      >
        <mesh
          ref={meshRef}
          geometry={shape.geometry}
          onClick={handleMeshClick}
          onPointerMove={handleMeshMove}
          onPointerOut={() => setHoveredEdgeIndex(null)}
        >
          <meshBasicMaterial
            color="#2563eb"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>

        {edges.map((edge, index) => {
          const isSelected = selectedEdgeIndex === index;
          const isHovered = hoveredEdgeIndex === index;
          const shouldHighlight = isSelected || isHovered;

          return (
            <line key={`edge-${index}`}>
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
                color={shouldHighlight ? '#ff0000' : '#888888'}
                linewidth={shouldHighlight ? 4 : 1}
                transparent
                opacity={shouldHighlight ? 1.0 : 0.5}
                depthTest={false}
              />
            </line>
          );
        })}
      </group>
    </>
  );
};
