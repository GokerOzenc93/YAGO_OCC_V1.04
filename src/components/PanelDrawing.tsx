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
  const { bazaHeight, frontBaseDistance, backBaseDistance, addShape } = useAppStore();

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

  const handleBottomPanelClick = async () => {
    const faceRole = shape.parameters?.faceRole;
    if (faceRole !== 'Bottom') return;

    console.log('Bottom panel clicked, creating baza panels...');

    try {
      const bbox = new THREE.Box3().setFromBufferAttribute(
        shape.geometry.getAttribute('position')
      );
      const size = new THREE.Vector3();
      bbox.getSize(size);

      const panelWidth = size.x;
      const panelDepth = size.z;
      const panelThickness = 18;

      const { createReplicadBox, convertReplicadToThreeGeometry } = await import('./ReplicadService');

      const bazaThickness = 100;
      const bazaDepth = frontBaseDistance + backBaseDistance;

      const leftBazaShape = await createReplicadBox({
        width: bazaThickness,
        height: bazaHeight,
        depth: bazaDepth
      });
      const leftBazaGeometry = convertReplicadToThreeGeometry(leftBazaShape);

      const rightBazaShape = await createReplicadBox({
        width: bazaThickness,
        height: bazaHeight,
        depth: bazaDepth
      });
      const rightBazaGeometry = convertReplicadToThreeGeometry(rightBazaShape);

      const leftBazaPanel = {
        id: `baza-left-${Date.now()}`,
        type: 'panel',
        geometry: leftBazaGeometry,
        replicadShape: leftBazaShape,
        position: [
          shape.position[0] - panelWidth / 2 + bazaThickness / 2,
          shape.position[1] - panelThickness / 2 - bazaHeight / 2,
          shape.position[2] - panelDepth / 2 + bazaDepth / 2 + frontBaseDistance
        ] as [number, number, number],
        rotation: shape.rotation,
        scale: shape.scale,
        color: '#8B4513',
        parameters: {
          width: bazaThickness,
          height: bazaHeight,
          depth: bazaDepth,
          parentShapeId: shape.parameters?.parentShapeId,
          faceRole: 'baza'
        }
      };

      const rightBazaPanel = {
        id: `baza-right-${Date.now() + 1}`,
        type: 'panel',
        geometry: rightBazaGeometry,
        replicadShape: rightBazaShape,
        position: [
          shape.position[0] + panelWidth / 2 - bazaThickness / 2,
          shape.position[1] - panelThickness / 2 - bazaHeight / 2,
          shape.position[2] - panelDepth / 2 + bazaDepth / 2 + frontBaseDistance
        ] as [number, number, number],
        rotation: shape.rotation,
        scale: shape.scale,
        color: '#8B4513',
        parameters: {
          width: bazaThickness,
          height: bazaHeight,
          depth: bazaDepth,
          parentShapeId: shape.parameters?.parentShapeId,
          faceRole: 'baza'
        }
      };

      addShape(leftBazaPanel);
      addShape(rightBazaPanel);
      console.log('Baza panels (left and right) created successfully');
    } catch (error) {
      console.error('Failed to create baza panels:', error);
    }
  };

  if (!shape.geometry) return null;

  const panelColor = shape.color || '#ffffff';
  const faceRole = shape.parameters?.faceRole;

  const getRoleColor = (role: string | undefined): string => {
    if (!role) return panelColor;

    switch (role.toLowerCase()) {
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
      case 'baza':
        return '#8B4513';
      default:
        return panelColor;
    }
  };

  const materialColor = getRoleColor(faceRole);

  return (
    <group
      name={`shape-${shape.id}`}
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
      onClick={handleBottomPanelClick}
    >
      <mesh
        ref={meshRef}
        geometry={shape.geometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={materialColor}
          emissive={materialColor}
          emissiveIntensity={0.1}
          metalness={0}
          roughness={0.4}
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
