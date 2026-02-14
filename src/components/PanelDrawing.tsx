import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { PanelDirectionArrow } from './PanelDirectionArrow';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';
import { useThree } from '@react-three/fiber';

interface PanelDrawingProps {
  shape: any;
  isSelected: boolean;
}

export const PanelDrawing: React.FC<PanelDrawingProps> = React.memo(({
  shape,
  isSelected
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  const {
    selectShape,
    selectSecondaryShape,
    selectedShapeId,
    selectedPanelRow,
    selectedPanelRowExtraId,
    setSelectedPanelRow,
    panelSelectMode,
    panelSurfaceSelectMode,
    waitingForSurfaceSelection,
    triggerPanelCreationForFace
  } = useAppStore(useShallow(state => ({
    selectShape: state.selectShape,
    selectSecondaryShape: state.selectSecondaryShape,
    selectedShapeId: state.selectedShapeId,
    selectedPanelRow: state.selectedPanelRow,
    selectedPanelRowExtraId: state.selectedPanelRowExtraId,
    setSelectedPanelRow: state.setSelectedPanelRow,
    panelSelectMode: state.panelSelectMode,
    panelSurfaceSelectMode: state.panelSurfaceSelectMode,
    waitingForSurfaceSelection: state.waitingForSurfaceSelection,
    triggerPanelCreationForFace: state.triggerPanelCreationForFace
  })));

  const [faceGroups, setFaceGroups] = useState<any[]>([]);

  useEffect(() => {
    if (!shape.geometry) return;
    const faces = extractFacesFromGeometry(shape.geometry);
    const groups = groupCoplanarFaces(faces);
    setFaceGroups(groups);
  }, [shape.geometry]);

  const parentShapeId = shape.parameters?.parentShapeId;
  const faceIndex = shape.parameters?.faceIndex;
  const extraRowId = shape.parameters?.extraRowId;
  const isParentSelected = parentShapeId === selectedShapeId;
  const isPanelRowSelected = isParentSelected &&
    faceIndex !== undefined &&
    faceIndex === selectedPanelRow &&
    ((extraRowId && extraRowId === selectedPanelRowExtraId) ||
     (!extraRowId && !selectedPanelRowExtraId));

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

          if (panelSurfaceSelectMode && waitingForSurfaceSelection && e.faceIndex !== undefined) {
            const clickedFaceIndex = e.faceIndex;
            const groupIndex = faceGroups.findIndex(group =>
              group.faceIndices.includes(clickedFaceIndex)
            );

            if (groupIndex !== -1) {
              const faceGroup = faceGroups[groupIndex];
              const surfaceConstraint = {
                center: [faceGroup.center.x, faceGroup.center.y, faceGroup.center.z] as [number, number, number],
                normal: [faceGroup.normal.x, faceGroup.normal.y, faceGroup.normal.z] as [number, number, number],
                constraintPanelId: shape.id
              };

              console.log('🎯 Panel surface clicked for new panel creation:', {
                panelId: shape.id,
                clickedFaceIndex,
                groupIndex,
                parentShapeId,
                surfaceConstraint
              });

              if (selectedShapeId !== parentShapeId) {
                selectShape(parentShapeId);
              }

              triggerPanelCreationForFace(groupIndex, shape.id, surfaceConstraint);
              return;
            }
          }

          if (panelSurfaceSelectMode && parentShapeId) {
            if (selectedShapeId !== parentShapeId) {
              selectShape(parentShapeId);
            }
            setSelectedPanelRow(faceIndex ?? null, extraRowId || null);
            selectSecondaryShape(null);
            console.log('Panel surface selected:', {
              parentShapeId,
              faceIndex,
              extraRowId: extraRowId || 'none',
              panelId: shape.id
            });
          } else if (panelSelectMode && parentShapeId) {
            if (selectedShapeId !== parentShapeId) {
              selectShape(parentShapeId);
            }
            setSelectedPanelRow(faceIndex ?? null, extraRowId || null);
            selectSecondaryShape(null);
          } else {
            selectShape(shape.id);
            selectSecondaryShape(null);
          }
        }}
      >
        <meshStandardMaterial
          color={materialColor}
          emissive={isPanelRowSelected ? '#ef4444' : isRayProbeHighlighted ? '#ef4444' : baseColor}
          emissiveIntensity={isPanelRowSelected ? 0.35 : isRayProbeHighlighted ? 0.4 : 0.1}
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
      {isPanelRowSelected && (
        <PanelDirectionArrow
          geometry={shape.geometry}
          faceRole={faceRole}
          arrowRotated={shape.parameters?.arrowRotated || false}
        />
      )}
    </group>
  );
});

PanelDrawing.displayName = 'PanelDrawing';
