import React, { useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore, CameraType } from '../store';
import ContextMenu from './ContextMenu';
import SaveDialog from './SaveDialog';
import { catalogService } from './Database';
import { VertexEditor } from './VertexEditor';
import { applyFilletToShape } from './Fillet';
import { ShapeWithTransform } from './ShapeWithTransform';
import { getReplicadVertices } from './VertexEditorService';

const Scene: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    shapes,
    cameraType,
    selectedShapeId,
    secondarySelectedShapeId,
    selectShape,
    deleteShape,
    copyShape,
    isolateShape,
    exitIsolation,
    vertexEditMode,
    setVertexEditMode,
    selectedVertexIndex,
    setSelectedVertexIndex,
    vertexDirection,
    setVertexDirection,
    addVertexModification,
    subtractionViewMode,
    faceEditMode,
    setFaceEditMode,
    filletMode,
    selectedFilletFaces,
    clearFilletFaces,
    selectedFilletFaceData,
    updateShape
  } = useAppStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shapeId: string; shapeType: string } | null>(null);
  const [saveDialog, setSaveDialog] = useState<{ isOpen: boolean; shapeId: string | null }>({ isOpen: false, shapeId: null });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedShapeId) {
        deleteShape(selectedShapeId);
      } else if (e.key === 'Escape') {
        selectShape(null);
        exitIsolation();
        setVertexEditMode(false);
        setFaceEditMode(false);
        clearFilletFaces();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (selectedShapeId && secondarySelectedShapeId) {
          const { createGroup } = useAppStore.getState();
          createGroup(selectedShapeId, secondarySelectedShapeId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        if (selectedShapeId) {
          const shape = shapes.find(s => s.id === selectedShapeId);
          if (shape?.groupId) {
            const { ungroupShapes } = useAppStore.getState();
            ungroupShapes(shape.groupId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, secondarySelectedShapeId, shapes, deleteShape, selectShape, exitIsolation, setVertexEditMode, setFaceEditMode, clearFilletFaces]);

  useEffect(() => {
    (window as any).handleVertexOffset = async (newValue: number) => {
      const currentState = useAppStore.getState();
      const currentSelectedShapeId = currentState.selectedShapeId;
      const currentSelectedVertexIndex = currentState.selectedVertexIndex;
      const currentVertexDirection = currentState.vertexDirection;

      if (currentSelectedShapeId && currentSelectedVertexIndex !== null && currentVertexDirection) {
        const shape = currentState.shapes.find(s => s.id === currentSelectedShapeId);
        if (shape && shape.parameters) {
          console.log('📝 Processing vertex offset:', { newValue, vertexIndex: currentSelectedVertexIndex, direction: currentVertexDirection });

          let baseVertices: number[][] = [];

          if (shape.parameters.scaledBaseVertices && shape.parameters.scaledBaseVertices.length > 0) {
            console.log('📍 Using pre-computed scaled base vertices for offset calculation...');
            baseVertices = shape.parameters.scaledBaseVertices;
            console.log(`✅ Using ${baseVertices.length} scaled base vertices`);
          } else if (shape.replicadShape) {
            console.log('🔍 Getting vertices from Replicad shape for offset calculation...');
            const { getReplicadVertices } = await import('./VertexEditorService');
            const verts = await getReplicadVertices(shape.replicadShape);
            baseVertices = verts.map(v => [v.x, v.y, v.z]);
            console.log(`✅ Got ${baseVertices.length} vertices from Replicad`);
          } else if (shape.type === 'box') {
            const { getBoxVertices } = await import('./VertexEditorService');
            const verts = getBoxVertices(
              shape.parameters.width,
              shape.parameters.height,
              shape.parameters.depth
            );
            baseVertices = verts.map(v => [v.x, v.y, v.z]);
            console.log(`✅ Got ${baseVertices.length} vertices from box parameters`);
          }

          if (currentSelectedVertexIndex >= baseVertices.length) {
            console.error('❌ Invalid vertex index:', currentSelectedVertexIndex);
            return;
          }

          const originalPos = baseVertices[currentSelectedVertexIndex];

          const axisIndex = currentVertexDirection.startsWith('x') ? 0 : currentVertexDirection.startsWith('y') ? 1 : 2;

          const newPosition: [number, number, number] = [...originalPos];
          newPosition[axisIndex] = newValue;

          const offsetAmount = newValue - originalPos[axisIndex];
          const offset: [number, number, number] = [0, 0, 0];
          offset[axisIndex] = offsetAmount;

          const axisName = currentVertexDirection[0].toUpperCase();
          const directionSymbol = currentVertexDirection[1] === '+' ? '+' : '-';

          console.log(`🎯 Absolute position applied:`, {
            direction: currentVertexDirection,
            userInput: newValue,
            originalPosAxis: originalPos[axisIndex].toFixed(1),
            newPosAxis: newPosition[axisIndex].toFixed(1),
            offsetAmount: offsetAmount.toFixed(1),
            explanation: `${axisName}${directionSymbol} → move to ${newValue} (offset: ${offsetAmount.toFixed(1)})`
          });

          currentState.addVertexModification(currentSelectedShapeId, {
            vertexIndex: currentSelectedVertexIndex,
            originalPosition: originalPos as [number, number, number],
            newPosition,
            direction: currentVertexDirection,
            expression: String(newValue),
            description: `Vertex ${currentSelectedVertexIndex} ${axisName}${directionSymbol}`,
            offset
          });

          console.log(`✅ Vertex ${currentSelectedVertexIndex}:`, {
            base: `[${originalPos[0].toFixed(1)}, ${originalPos[1].toFixed(1)}, ${originalPos[2].toFixed(1)}]`,
            userValue: newValue,
            axis: axisName,
            offset: `[${offset[0].toFixed(1)}, ${offset[1].toFixed(1)}, ${offset[2].toFixed(1)}]`,
            final: `[${newPosition[0].toFixed(1)}, ${newPosition[1].toFixed(1)}, ${newPosition[2].toFixed(1)}]`
          });
        }

        (window as any).pendingVertexEdit = false;
        currentState.setSelectedVertexIndex(null);
      }
    };

    (window as any).pendingVertexEdit = selectedVertexIndex !== null && vertexDirection !== null;

    return () => {
      delete (window as any).handleVertexOffset;
      delete (window as any).pendingVertexEdit;
    };
  }, [selectedVertexIndex, vertexDirection]);

  useEffect(() => {
    (window as any).handleFilletRadius = async (radius: number) => {
      const currentState = useAppStore.getState();
      const currentSelectedShapeId = currentState.selectedShapeId;
      const currentFilletMode = currentState.filletMode;
      const currentSelectedFilletFaces = currentState.selectedFilletFaces;
      const currentSelectedFilletFaceData = currentState.selectedFilletFaceData;

      if (currentSelectedShapeId && currentFilletMode && currentSelectedFilletFaces.length === 2 && currentSelectedFilletFaceData.length === 2) {
        const shape = currentState.shapes.find(s => s.id === currentSelectedShapeId);
        if (!shape || !shape.replicadShape) {
          console.error('❌ Shape or replicadShape not found');
          return;
        }

        try {
          console.log('🎯 BEFORE FILLET - Shape position:', shape.position);

          const oldCenter = new THREE.Vector3();
          if (shape.geometry) {
            const oldBox = new THREE.Box3().setFromBufferAttribute(shape.geometry.getAttribute('position'));
            oldBox.getCenter(oldCenter);
            console.log('📍 Center BEFORE adding fillet:', oldCenter);
          }

          const result = await applyFilletToShape(
            shape,
            currentSelectedFilletFaces,
            currentSelectedFilletFaceData,
            radius
          );

          const newBaseVertices = await getReplicadVertices(result.replicadShape);

          const newCenter = new THREE.Vector3();
          const newBox = new THREE.Box3().setFromBufferAttribute(result.geometry.getAttribute('position'));
          newBox.getCenter(newCenter);
          console.log('📍 Center AFTER adding fillet:', newCenter);

          const centerOffset = new THREE.Vector3().subVectors(newCenter, oldCenter);
          console.log('📍 Center offset:', centerOffset);

          const finalPosition: [number, number, number] = [
            shape.position[0] - centerOffset.x,
            shape.position[1] - centerOffset.y,
            shape.position[2] - centerOffset.z
          ];

          console.log('🎯 AFTER FILLET - Adjusted position from', shape.position, 'to', finalPosition);

          currentState.updateShape(currentSelectedShapeId, {
            geometry: result.geometry,
            replicadShape: result.replicadShape,
            position: finalPosition,
            rotation: shape.rotation,
            scale: shape.scale,
            parameters: {
              ...shape.parameters,
              scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z]),
              width: shape.parameters.width || 1,
              height: shape.parameters.height || 1,
              depth: shape.parameters.depth || 1
            },
            fillets: [
              ...(shape.fillets || []),
              result.filletData
            ]
          });

          console.log(`✅ Fillet with radius ${radius} applied successfully and saved to shape.fillets!`);
          const newState = useAppStore.getState();
          const updatedShape = newState.shapes.find(s => s.id === selectedShapeId);
          console.log(`📍 After update, shape.fillets.length: ${updatedShape?.fillets?.length || 0}`);
          newState.clearFilletFaces();
          console.log('✅ Fillet faces cleared. Select 2 new faces for another fillet operation.');
        } catch (error) {
          console.error('❌ Failed to apply fillet:', error);
          alert(`Failed to apply fillet: ${(error as Error).message}`);
        }
      }

      (window as any).pendingFilletOperation = false;
    };

    (window as any).pendingFilletOperation = filletMode && selectedFilletFaces.length === 2;

    return () => {
      delete (window as any).handleFilletRadius;
      delete (window as any).pendingFilletOperation;
    };
  }, [filletMode, selectedFilletFaces.length]);

  const handleContextMenu = (e: any, shapeId: string) => {
    if (vertexEditMode || faceEditMode) {
      return;
    }
    e.nativeEvent.preventDefault();
    selectShape(shapeId);
    const shape = shapes.find(s => s.id === shapeId);
    setContextMenu({
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      shapeId,
      shapeType: shape?.type || 'unknown'
    });
  };

  const captureSnapshot = (): string => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const handleSave = async (data: { code: string; description: string; tags: string[]; previewImage?: string }) => {
    if (!saveDialog.shapeId) return;

    const shape = shapes.find(s => s.id === saveDialog.shapeId);
    if (!shape) return;

    try {
      let geometryData: any;

      if (shape.groupId) {
        const groupShapes = shapes.filter(s => s.groupId === shape.groupId);
        geometryData = {
          type: 'group',
          shapes: groupShapes.map(s => ({
            type: s.type,
            position: s.position,
            rotation: s.rotation,
            scale: s.scale,
            color: s.color,
            parameters: s.parameters,
            vertexModifications: s.vertexModifications || [],
            isReferenceBox: s.isReferenceBox
          }))
        };

        console.log('💾 Saving group:', {
          code: data.code,
          shapeCount: groupShapes.length,
          groupId: shape.groupId
        });
      } else {
        geometryData = {
          type: shape.type,
          position: shape.position,
          rotation: shape.rotation,
          scale: shape.scale,
          color: shape.color,
          parameters: shape.parameters,
          vertexModifications: shape.vertexModifications || []
        };

        console.log('💾 Saving geometry:', {
          code: data.code,
          type: shape.type,
          parameters: shape.parameters,
          position: shape.position,
          scale: shape.scale,
          vertexModifications: shape.vertexModifications?.length || 0
        });
      }

      await catalogService.save({
        code: data.code,
        description: data.description,
        tags: data.tags,
        geometry_data: geometryData,
        preview_image: data.previewImage
      });

      console.log('✅ Geometry saved to catalog:', data.code);
      alert('Geometry saved successfully!');
      setSaveDialog({ isOpen: false, shapeId: null });
    } catch (error) {
      console.error('Failed to save geometry:', error);
      alert('Failed to save geometry. Please try again.');
    }
  };

  return (
    <>
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
        onContextMenu={(e) => e.preventDefault()}
      >
        <color attach="background" args={['#f5f5f4']} />

      {cameraType === CameraType.PERSPECTIVE ? (
        <PerspectiveCamera
          makeDefault
          position={[2000, 2000, 2000]}
          fov={45}
          near={1}
          far={50000}
        />
      ) : (
        <OrthographicCamera
          makeDefault
          position={[2000, 2000, 2000]}
          zoom={0.25}
          near={-50000}
          far={50000}
        />
      )}

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[2000, 3000, 2000]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-1000, 1500, -1000]}
        intensity={0.4}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.1}
        maxDistance={25000}
        minDistance={50}
      />

      <group position={[-2500, -1, -2500]}>
        <Grid
          args={[50000, 50000]}
          cellSize={50}
          cellThickness={2}
          cellColor="#d4d4d8"
          sectionSize={250}
          sectionThickness={3}
          sectionColor="#a1a1aa"
          fadeDistance={Infinity}
          fadeStrength={0}
          followCamera={false}
          infiniteGrid
        />
      </group>

      {shapes.map((shape) => {
        const isSelected = selectedShapeId === shape.id;
        return (
          <React.Fragment key={shape.id}>
            <ShapeWithTransform
              shape={shape}
              isSelected={isSelected}
              orbitControlsRef={controlsRef}
              onContextMenu={handleContextMenu}
            />
            {isSelected && vertexEditMode && (
              <VertexEditor
                shape={shape}
                isActive={true}
                onVertexSelect={(index) => setSelectedVertexIndex(index)}
                onDirectionChange={(dir) => setVertexDirection(dir)}
                onOffsetConfirm={(vertexIndex, direction, offset) => {
                  console.log('Offset confirmed:', { vertexIndex, direction, offset });
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      <mesh
        position={[0, -1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100000, 100000]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>

      <GizmoHelper alignment="bottom-right" margin={[80, 100]}>
        <GizmoViewport
          axisColors={['#f87171', '#4ade80', '#60a5fa']}
          labelColor="white"
        />
      </GizmoHelper>
    </Canvas>

    {contextMenu && (
      <ContextMenu
        position={{ x: contextMenu.x, y: contextMenu.y }}
        shapeId={contextMenu.shapeId}
        shapeType={contextMenu.shapeType}
        onClose={() => setContextMenu(null)}
        onEdit={() => {
          isolateShape(contextMenu.shapeId);
          setContextMenu(null);
        }}
        onCopy={() => {
          copyShape(contextMenu.shapeId);
          setContextMenu(null);
        }}
        onMove={() => {
          console.log('Move:', contextMenu.shapeId);
          setContextMenu(null);
        }}
        onRotate={() => {
          console.log('Rotate:', contextMenu.shapeId);
          setContextMenu(null);
        }}
        onDelete={() => {
          deleteShape(contextMenu.shapeId);
          setContextMenu(null);
        }}
        onToggleVisibility={() => {
          console.log('Toggle visibility:', contextMenu.shapeId);
          setContextMenu(null);
        }}
        onSave={() => {
          setSaveDialog({ isOpen: true, shapeId: contextMenu.shapeId });
          setContextMenu(null);
        }}
      />
    )}

    <SaveDialog
      isOpen={saveDialog.isOpen}
      onClose={() => setSaveDialog({ isOpen: false, shapeId: null })}
      onSave={handleSave}
      shapeId={saveDialog.shapeId || ''}
      captureSnapshot={captureSnapshot}
    />
    </>
  );
};

export default Scene;
