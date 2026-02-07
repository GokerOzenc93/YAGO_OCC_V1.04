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
  const { showPanelOutlines } = useAppStore();
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

  const panelColor = shape.color || '#8b5cf6';
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
        <meshStandardMaterial
          color={materialColor}
          metalness={0.3}
          roughness={0.4}
          transparent={false}
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={true}
          flatShading={false}
        />
      </mesh>
      {showPanelOutlines && edgeGeometry && (
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
