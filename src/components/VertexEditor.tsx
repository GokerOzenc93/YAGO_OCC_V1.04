import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';

interface DirectionArrow {
  direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
  color: string;
  offset: [number, number, number];
}

const DIRECTIONS: DirectionArrow[] = [
  { direction: 'x+', color: '#ef4444', offset: [50, 0, 0] },
  { direction: 'x-', color: '#dc2626', offset: [-50, 0, 0] },
  { direction: 'y+', color: '#22c55e', offset: [0, 50, 0] },
  { direction: 'y-', color: '#16a34a', offset: [0, -50, 0] },
  { direction: 'z+', color: '#3b82f6', offset: [0, 0, 50] },
  { direction: 'z-', color: '#2563eb', offset: [0, 0, -50] },
];

function getBoxVertices(width: number, height: number, depth: number): THREE.Vector3[] {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;

  return [
    new THREE.Vector3(-w, -h, -d),
    new THREE.Vector3(w, -h, -d),
    new THREE.Vector3(w, h, -d),
    new THREE.Vector3(-w, h, -d),
    new THREE.Vector3(-w, -h, d),
    new THREE.Vector3(w, -h, d),
    new THREE.Vector3(w, h, d),
    new THREE.Vector3(-w, h, d),
  ];
}

interface VertexEditorProps {
  shape: any;
  isActive: boolean;
  onVertexSelect: (index: number) => void;
}

export const VertexEditor: React.FC<VertexEditorProps> = ({
  shape,
  isActive,
  onVertexSelect,
}) => {
  const [vertices, setVertices] = useState<THREE.Vector3[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null>(null);

  useEffect(() => {
    if (!isActive || !shape.parameters) return;

    if (shape.type === 'box' && shape.geometry) {
      const positionAttr = shape.geometry.getAttribute('position');
      if (!positionAttr) return;

      const positions = positionAttr.array;
      const uniqueVertices = new Map<string, THREE.Vector3>();

      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;

        if (!uniqueVertices.has(key)) {
          uniqueVertices.set(key, new THREE.Vector3(x, y, z));
        }
      }

      const vertArray = Array.from(uniqueVertices.values());
      vertArray.sort((a, b) => {
        if (Math.abs(a.z - b.z) > 0.1) return a.z - b.z;
        if (Math.abs(a.y - b.y) > 0.1) return a.y - b.y;
        return a.x - b.x;
      });

      setVertices(vertArray);
    }
  }, [isActive, shape, shape.geometry, shape.parameters?.vertexModifications, shape.position, shape.rotation, shape.scale]);

  if (!isActive || vertices.length === 0) return null;

  const handleVertexClick = (index: number) => {
    setSelectedIndex(index);
    setShowDirections(true);
    onVertexSelect(index);
  };

  const handleDirectionClick = (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => {
    setSelectedDirection(direction);

    (window as any).pendingVertexEdit = {
      vertexIndex: selectedIndex,
      direction: direction,
    };

    (window as any).vertexEditStatusMessage = `Vertex ${selectedIndex} - ${direction.toUpperCase()}: Enter coordinate value`;

    console.log(`✅ Vertex ${selectedIndex} - Direction ${direction} selected. Enter absolute coordinate value.`);
  };

  useEffect(() => {
    const handleVertexApplied = () => {
      setSelectedDirection(null);
      setShowDirections(false);
      setSelectedIndex(null);
    };

    window.addEventListener('vertexApplied', handleVertexApplied);
    return () => window.removeEventListener('vertexApplied', handleVertexApplied);
  }, []);

  return (
    <group
      position={[shape.position[0], shape.position[1], shape.position[2]]}
      rotation={[shape.rotation[0], shape.rotation[1], shape.rotation[2]]}
      scale={[shape.scale[0], shape.scale[1], shape.scale[2]]}
    >
      {vertices.map((vertex, index) => {
        return (
          <group key={index} position={vertex}>
            <mesh onClick={() => handleVertexClick(index)}>
              <sphereGeometry args={[8, 16, 16]} />
              <meshBasicMaterial
                color={selectedIndex === index ? '#fbbf24' : '#000000'}
                depthTest={false}
              />
            </mesh>

            {selectedIndex === index && (showDirections || selectedDirection) && (
              <>
                {DIRECTIONS.filter(dir => showDirections || dir.direction === selectedDirection).map((dir) => {
                  const arrowStart = new THREE.Vector3(0, 0, 0);
                  const arrowEnd = new THREE.Vector3(...dir.offset);
                  const direction = arrowEnd.clone().sub(arrowStart).normalize();
                  const length = arrowEnd.distanceTo(arrowStart);

                  return (
                    <group key={dir.direction}>
                      <arrowHelper
                        args={[
                          direction,
                          arrowStart,
                          length,
                          dir.color,
                          10,
                          8
                        ]}
                      />
                      <mesh
                        position={arrowEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectionClick(dir.direction);
                        }}
                      >
                        <sphereGeometry args={[12, 16, 16]} />
                        <meshBasicMaterial
                          color={dir.color}
                          transparent
                          opacity={0.8}
                          depthTest={false}
                        />
                      </mesh>
                    </group>
                  );
                })}
              </>
            )}
          </group>
        );
      })}
    </group>
  );
};
