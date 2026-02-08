import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';

interface PanelDrawingProps {
  shape: any;
  isSelected: boolean;
}

export const PanelDrawing: React.FC<PanelDrawingProps> = React.memo(({
  shape,
  isSelected
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const edgeGeometry = useMemo(() => {
    if (!shape.geometry) return null;
    try {
      const edges = new THREE.EdgesGeometry(shape.geometry, 5);
      return edges;
    } catch (error) {
      console.error('Error creating edge geometry:', error);
      return null;
    }
  }, [shape.geometry]);

  if (!shape.geometry) return null;

  const panelColor = shape.color || '#ffffff';
  const faceRole = shape.parameters?.faceRole;

  const getRoleColor = (role: string | undefined): string => {
    if (!role) return panelColor;

    switch (role) {
      case 'left':
      case 'right':
        return '#ef4444';
      case 'top':
      case 'bottom':
        return '#3b82f6';
      case 'back':
        return '#22c55e';
      case 'front':
        return '#f59e0b';
      case 'shelf':
        return '#a855f7';
      case 'divider':
        return '#14b8a6';
      default:
        return panelColor;
    }
  };

  const materialColor = getRoleColor(faceRole);

  return (
    <group
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
    >
      <mesh
        ref={meshRef}
        geometry={shape.geometry}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color={materialColor}
          emissive={materialColor}
          emissiveIntensity={0.06}
          metalness={0}
          roughness={0.35}
          clearcoat={0.12}
          clearcoatRoughness={0.25}
          envMapIntensity={0.5}
          transparent={false}
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={true}
          flatShading={false}
        />
      </mesh>
      {edgeGeometry && (
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial
            color={isSelected ? '#1e40af' : '#000000'}
            linewidth={isSelected ? 2.5 : 2}
            opacity={1}
            transparent={false}
            depthTest={true}
          />
        </lineSegments>
      )}
    </group>
  );
});

PanelDrawing.displayName = 'PanelDrawing';
