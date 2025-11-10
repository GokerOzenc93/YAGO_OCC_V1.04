import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface VertexPoint {
  position: THREE.Vector3;
  index: number;
}

interface DirectionArrow {
  direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
  color: string;
  label: string;
}

const DIRECTIONS: DirectionArrow[] = [
  { direction: 'x+', color: '#ef4444', label: 'X+' },
  { direction: 'x-', color: '#dc2626', label: 'X-' },
  { direction: 'y+', color: '#22c55e', label: 'Y+' },
  { direction: 'y-', color: '#16a34a', label: 'Y-' },
  { direction: 'z+', color: '#3b82f6', label: 'Z+' },
  { direction: 'z-', color: '#2563eb', label: 'Z-' },
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

    if (shape.type === 'box') {
      const { width, height, depth } = shape.parameters;
      const verts = getBoxVertices(width, height, depth);
      setVertices(verts);
    }
  }, [isActive, shape, shape.parameters]);

  if (!isActive || vertices.length === 0) return null;

  const handleVertexClick = (index: number) => {
    setSelectedIndex(index);
    setShowDirections(true);
    setSelectedDirection(null);
    onVertexSelect(index);
  };

  const handleDirectionClick = (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => {
    setSelectedDirection(direction);
    setShowDirections(false);

    (window as any).pendingVertexEdit = {
      vertexIndex: selectedIndex,
      direction: direction,
    };

    console.log(`✅ Vertex ${selectedIndex} - Direction ${direction} selected. Enter value in terminal.`);
  };

  return (
    <group
      position={[shape.position[0], shape.position[1], shape.position[2]]}
      rotation={[shape.rotation[0], shape.rotation[1], shape.rotation[2]]}
      scale={[shape.scale[0], shape.scale[1], shape.scale[2]]}
    >
      {vertices.map((vertex, index) => (
        <group key={index} position={vertex}>
          <mesh onClick={() => handleVertexClick(index)}>
            <sphereGeometry args={[15, 16, 16]} />
            <meshBasicMaterial
              color={selectedIndex === index ? '#fbbf24' : '#000000'}
            />
          </mesh>

          {selectedIndex === index && showDirections && (
            <Html center>
              <div className="flex gap-1 bg-white rounded-lg shadow-lg p-2 border border-stone-300">
                {DIRECTIONS.map((dir) => (
                  <button
                    key={dir.direction}
                    onClick={() => handleDirectionClick(dir.direction)}
                    className="px-3 py-2 text-xs font-bold rounded transition-all hover:scale-110"
                    style={{
                      backgroundColor: dir.color,
                      color: 'white',
                    }}
                    title={`Move in ${dir.label} direction`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            </Html>
          )}

          {selectedIndex === index && selectedDirection && (
            <Html center>
              <div className="bg-amber-500 text-white px-3 py-1 rounded text-xs font-bold">
                {selectedDirection.toUpperCase()} - Enter value in terminal
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
};
