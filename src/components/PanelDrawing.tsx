import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

interface PanelDrawingProps {
  shape: any;
  isSelected: boolean;
}

export const PanelDrawing: React.FC<PanelDrawingProps> = React.memo(({
  shape,
  isSelected
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const {
    selectShape,
    selectSecondaryShape,
    selectedShapeId,
    selectedPanelRow,
    setSelectedPanelRow,
    panelSelectMode
  } = useAppStore(useShallow(state => ({
    selectShape: state.selectShape,
    selectSecondaryShape: state.selectSecondaryShape,
    selectedShapeId: state.selectedShapeId,
    selectedPanelRow: state.selectedPanelRow,
    setSelectedPanelRow: state.setSelectedPanelRow,
    panelSelectMode: state.panelSelectMode
  })));

  const parentShapeId = shape.parameters?.parentShapeId;
  const faceIndex = shape.parameters?.faceIndex;
  const isParentSelected = parentShapeId === selectedShapeId;
  const isPanelRowSelected = isParentSelected &&
    faceIndex !== undefined &&
    faceIndex === selectedPanelRow;

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

  const arrowData = useMemo(() => {
    if (!shape.geometry || !isPanelRowSelected) return null;

    try {
      const boundingBox = new THREE.Box3().setFromBufferAttribute(
        shape.geometry.getAttribute('position')
      );
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);

      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      const normalAttr = shape.geometry.getAttribute('normal');
      if (normalAttr) {
        const normal = new THREE.Vector3(
          normalAttr.getX(0),
          normalAttr.getY(0),
          normalAttr.getZ(0)
        ).normalize();

        const arrowLength = Math.max(size.x, size.y, size.z) * 0.8;
        const shaftRadius = 2;
        const shaftLength = arrowLength * 0.75;
        const headRadius = 6;
        const headLength = arrowLength * 0.25;

        return {
          center,
          normal,
          shaftLength,
          shaftRadius,
          headRadius,
          headLength
        };
      }
    } catch (error) {
      console.error('Error calculating arrow data:', error);
    }
    return null;
  }, [shape.geometry, isPanelRowSelected]);

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

  const baseColor = getRoleColor(faceRole);
  const materialColor = isPanelRowSelected ? '#ef4444' : baseColor;
  const edgeColor = isPanelRowSelected ? '#b91c1c' : isSelected ? '#1e40af' : '#000000';

  return (
    <group
      name={`shape-${shape.id}`}
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
    >
      <mesh
        ref={meshRef}
        geometry={shape.geometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (panelSelectMode && parentShapeId) {
            if (selectedShapeId !== parentShapeId) {
              selectShape(parentShapeId);
            }
            setSelectedPanelRow(faceIndex ?? null);
            selectSecondaryShape(null);
          } else {
            selectShape(shape.id);
            selectSecondaryShape(null);
          }
        }}
      >
        <meshStandardMaterial
          color={materialColor}
          emissive={isPanelRowSelected ? '#ef4444' : baseColor}
          emissiveIntensity={isPanelRowSelected ? 0.35 : 0.1}
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
            color={edgeColor}
            linewidth={isPanelRowSelected ? 3 : isSelected ? 2.5 : 2}
            opacity={1}
            transparent={false}
            depthTest={true}
          />
        </lineSegments>
      )}
      {arrowData && (
        <group>
          <mesh
            position={[
              arrowData.center.x + arrowData.normal.x * (arrowData.shaftLength / 2),
              arrowData.center.y + arrowData.normal.y * (arrowData.shaftLength / 2),
              arrowData.center.z + arrowData.normal.z * (arrowData.shaftLength / 2)
            ]}
            quaternion={new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              arrowData.normal
            )}
          >
            <cylinderGeometry args={[arrowData.shaftRadius, arrowData.shaftRadius, arrowData.shaftLength, 16]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#f97316"
              emissiveIntensity={0.4}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
          <mesh
            position={[
              arrowData.center.x + arrowData.normal.x * (arrowData.shaftLength + arrowData.headLength / 2),
              arrowData.center.y + arrowData.normal.y * (arrowData.shaftLength + arrowData.headLength / 2),
              arrowData.center.z + arrowData.normal.z * (arrowData.shaftLength + arrowData.headLength / 2)
            ]}
            quaternion={new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              arrowData.normal
            )}
          >
            <coneGeometry args={[arrowData.headRadius, arrowData.headLength, 16]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#f97316"
              emissiveIntensity={0.4}
              metalness={0.6}
              roughness={0.2}
            />
          </mesh>
        </group>
      )}
    </group>
  );
});

PanelDrawing.displayName = 'PanelDrawing';
