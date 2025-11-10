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

  useEffect(() => {
    if (!isActive || !shape.parameters) return;

    if (shape.type === 'box') {
      const { width, height, depth } = shape.parameters;
      const vertexMods = shape.parameters.vertexModifications || [];

      const baseVerts = getBoxVertices(width, height, depth);

      const modifiedVerts = baseVerts.map((v, idx) => {
        const mod = vertexMods.find((m: any) => m.vertexIndex === idx);
        if (mod) {
          return new THREE.Vector3(
            mod.x !== undefined ? mod.x : v.x,
            mod.y !== undefined ? mod.y : v.y,
            mod.z !== undefined ? mod.z : v.z
          );
        }
        return v;
      });

      setVertices(modifiedVerts);
    }
  }, [isActive, shape, shape.parameters, shape.parameters?.vertexModifications]);

  if (!isActive || vertices.length === 0) return null;

  const handleVertexClick = (index: number) => {
    setSelectedIndex(index);
    setShowDirections(true);
    onVertexSelect(index);
  };

  const handleDirectionClick = (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => {
    setShowDirections(false);

    (window as any).pendingVertexEdit = {
      vertexIndex: selectedIndex,
      direction: direction,
    };

    (window as any).vertexEditStatusMessage = `Vertex ${selectedIndex} - ${direction.toUpperCase()}: Enter value in terminal`;

    console.log(`✅ Vertex ${selectedIndex} - Direction ${direction} selected. Enter value in terminal.`);
  };

  return (
    <group>
      {vertices.map((vertex, index) => {
        const worldPos = new THREE.Vector3(
          vertex.x + shape.position[0],
          vertex.y + shape.position[1],
          vertex.z + shape.position[2]
        );

        return (
          <group key={index} position={worldPos}>
            <mesh onClick={() => handleVertexClick(index)}>
              <sphereGeometry args={[8, 16, 16]} />
              <meshBasicMaterial
                color={selectedIndex === index ? '#fbbf24' : '#000000'}
                depthTest={false}
              />
            </mesh>

            {selectedIndex === index && showDirections && (
              <>
                {DIRECTIONS.map((dir) => {
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
