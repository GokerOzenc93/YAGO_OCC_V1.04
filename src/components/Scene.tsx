import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera, TransformControls } from '@react-three/drei';
import { useAppStore, CameraType, Tool, ViewMode } from '../store';
import ContextMenu from './ContextMenu';
import SaveDialog from './SaveDialog';
import { catalogService } from '../services/supabase';
import { VertexEditor } from './VertexEditor';
import * as THREE from 'three';

const ShapeWithTransform: React.FC<{
  shape: any;
  isSelected: boolean;
  orbitControlsRef: any;
  onContextMenu: (e: any, shapeId: string) => void;
}> = ({
  shape,
  isSelected,
  orbitControlsRef,
  onContextMenu
}) => {
  const { selectShape, selectSecondaryShape, secondarySelectedShapeId, updateShape, activeTool, viewMode, createGroup } = useAppStore();
  const transformRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const isUpdatingRef = useRef(false);
  const [localGeometry, setLocalGeometry] = useState(shape.geometry);
  const [edgeGeometry, setEdgeGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [geometryKey, setGeometryKey] = useState(0);

  useEffect(() => {
    const loadEdges = async () => {
      if (shape.geometry && shape.geometry !== localGeometry) {
        console.log(`🔄 Geometry update for shape ${shape.id}`);

        let geom = shape.geometry.clone();

        setLocalGeometry(geom);

        const edges = new THREE.EdgesGeometry(geom, 1);
        setEdgeGeometry(edges);
        setGeometryKey(prev => prev + 1);
        return;
      }

      if (shape.parameters?.modified && shape.geometry) {
        console.log(`🔄 Using CSG-modified geometry for shape ${shape.id}`);
        let geom = shape.geometry.clone();

        geom.computeVertexNormals();
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        setLocalGeometry(geom);

        const edges = new THREE.EdgesGeometry(geom, 1);
        setEdgeGeometry(edges);
        setGeometryKey(prev => prev + 1);
        return;
      }

      setEdgeGeometry(null);
    };

    loadEdges();
  }, [shape.parameters?.width, shape.parameters?.height, shape.parameters?.depth, shape.parameters?.modified, shape.geometry, shape.id]);

  useEffect(() => {
    if (!groupRef.current || isUpdatingRef.current) return;

    groupRef.current.position.set(
      shape.position[0],
      shape.position[1],
      shape.position[2]
    );
    groupRef.current.rotation.set(
      shape.rotation[0],
      shape.rotation[1],
      shape.rotation[2]
    );
    groupRef.current.scale.set(
      shape.scale[0],
      shape.scale[1],
      shape.scale[2]
    );
  }, [shape.position, shape.rotation, shape.scale]);

  useEffect(() => {
    if (transformRef.current && isSelected && groupRef.current) {
      const controls = transformRef.current;

      const onDraggingChanged = (event: any) => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = !event.value;
        }
      };

      const onChange = () => {
        if (groupRef.current) {
          isUpdatingRef.current = true;
          updateShape(shape.id, {
            position: groupRef.current.position.toArray() as [number, number, number],
            rotation: groupRef.current.rotation.toArray().slice(0, 3) as [number, number, number],
            scale: groupRef.current.scale.toArray() as [number, number, number]
          });
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 0);
        }
      };

      controls.addEventListener('dragging-changed', onDraggingChanged);
      controls.addEventListener('change', onChange);

      return () => {
        controls.removeEventListener('dragging-changed', onDraggingChanged);
        controls.removeEventListener('change', onChange);
      };
    }
  }, [isSelected, shape.id, updateShape, orbitControlsRef]);

  const getTransformMode = () => {
    switch (activeTool) {
      case Tool.MOVE:
        return 'translate';
      case Tool.ROTATE:
        return 'rotate';
      case Tool.SCALE:
        return 'scale';
      default:
        return 'translate';
    }
  };

  const isWireframe = viewMode === ViewMode.WIREFRAME;
  const isXray = viewMode === ViewMode.XRAY;
  const isSecondarySelected = shape.id === secondarySelectedShapeId;
  const isReferenceBox = shape.isReferenceBox;
  const shouldShowAsReference = isReferenceBox || isSecondarySelected;

  if (shape.isolated === false) {
    return null;
  }

  return (
    <>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) {
            if (shape.id === secondarySelectedShapeId) {
              selectSecondaryShape(null);
            } else {
              selectSecondaryShape(shape.id);
            }
          } else {
            selectShape(shape.id);
            selectSecondaryShape(null);
          }
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu(e, shape.id);
        }}
      >
        {!isWireframe && !isXray && !shouldShowAsReference && (
          <mesh
            ref={meshRef}
            geometry={localGeometry}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={isSelected ? '#60a5fa' : shape.color || '#2563eb'}
              metalness={0.3}
              roughness={0.4}
            />
            <lineSegments>
              {edgeGeometry ? (
                <bufferGeometry {...edgeGeometry} />
              ) : (
                <edgesGeometry args={[localGeometry, 1]} />
              )}
              <lineBasicMaterial
                color={isSelected ? '#1e3a8a' : '#0a0a0a'}
                linewidth={1.5}
                opacity={0.8}
                transparent
                depthTest={true}
              />
            </lineSegments>
          </mesh>
        )}
        {isWireframe && (
          <>
            <mesh
              ref={meshRef}
              geometry={localGeometry}
              visible={false}
            />
            <lineSegments>
              {edgeGeometry ? (
                <bufferGeometry {...edgeGeometry} />
              ) : (
                <edgesGeometry args={[localGeometry, 1]} />
              )}
              <lineBasicMaterial
                color={isSelected ? '#60a5fa' : shouldShowAsReference ? '#ef4444' : '#1a1a1a'}
                linewidth={isSelected || shouldShowAsReference ? 3 : 2}
                depthTest={true}
                depthWrite={true}
              />
            </lineSegments>
            <lineSegments>
              {edgeGeometry ? (
                <bufferGeometry {...edgeGeometry} />
              ) : (
                <edgesGeometry args={[localGeometry, 1]} />
              )}
              <lineBasicMaterial
                color={isSelected ? '#1e40af' : shouldShowAsReference ? '#991b1b' : '#000000'}
                linewidth={isSelected || shouldShowAsReference ? 1.5 : 1}
                transparent
                opacity={0.3}
                depthTest={true}
              />
            </lineSegments>
          </>
        )}
        {(isXray || shouldShowAsReference) && (
          <>
            <mesh
              ref={meshRef}
              geometry={localGeometry}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={isSelected ? '#60a5fa' : shouldShowAsReference ? '#ef4444' : shape.color || '#2563eb'}
                metalness={0.3}
                roughness={0.4}
                transparent
                opacity={0.15}
              />
            </mesh>
            <lineSegments>
              {edgeGeometry ? (
                <bufferGeometry {...edgeGeometry} />
              ) : (
                <edgesGeometry args={[localGeometry, 1]} />
              )}
              <lineBasicMaterial
                color={isSelected ? '#1e40af' : shouldShowAsReference ? '#991b1b' : '#0a0a0a'}
                linewidth={isSelected || shouldShowAsReference ? 2.5 : 2}
                depthTest={true}
                transparent
                opacity={0.9}
              />
            </lineSegments>
          </>
        )}
      </group>

      {isSelected && activeTool !== Tool.SELECT && groupRef.current && !shape.isReferenceBox && (
        <TransformControls
          key={geometryKey}
          ref={transformRef}
          object={groupRef.current}
          mode={getTransformMode()}
          size={0.8}
        />
      )}
    </>
  );
};

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
  }, [selectedShapeId, secondarySelectedShapeId, shapes, deleteShape, selectShape, exitIsolation]);

  useEffect(() => {
    (window as any).handleVertexOffset = async (newValue: number) => {
      const pendingEdit = (window as any).pendingVertexEdit;
      if (!pendingEdit || !selectedShapeId) return;

      const { vertexIndex, direction } = pendingEdit;
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (!shape || !shape.parameters) return;

      const currentParams = shape.parameters;
      const w = currentParams.width / 2;
      const h = currentParams.height / 2;
      const d = currentParams.depth / 2;

      const boxVertices = [
        [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d],
        [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d],
      ];

      const baseVertex = boxVertices[vertexIndex];
      if (!baseVertex) return;

      const axis = direction.startsWith('x') ? 0 : direction.startsWith('y') ? 1 : 2;
      const baseValue = baseVertex[axis];
      const delta = newValue - baseValue;

      console.log(`📝 Vertex ${vertexIndex} ${direction.toUpperCase()}: base=${baseValue}, new=${newValue}, delta=${delta}`);

      const vertexMods = currentParams.vertexModifications || [];
      const existingModIndex = vertexMods.findIndex((m: any) => m.vertexIndex === vertexIndex);
      let updatedMods;

      if (existingModIndex >= 0) {
        updatedMods = [...vertexMods];
        updatedMods[existingModIndex] = {
          ...updatedMods[existingModIndex],
          [direction.startsWith('x') ? 'deltaX' : direction.startsWith('y') ? 'deltaY' : 'deltaZ']: delta,
        };
      } else {
        updatedMods = [
          ...vertexMods,
          {
            vertexIndex,
            deltaX: direction.startsWith('x') ? delta : 0,
            deltaY: direction.startsWith('y') ? delta : 0,
            deltaZ: direction.startsWith('z') ? delta : 0,
          },
        ];
      }

      const newGeometry = shape.geometry.clone();
      const positionAttr = newGeometry.getAttribute('position');
      const positions = positionAttr.array as Float32Array;

      updatedMods.forEach((mod: any) => {
        const baseVert = boxVertices[mod.vertexIndex];
        if (!baseVert) return;

        const targetVertex = [
          baseVert[0] + (mod.deltaX || 0),
          baseVert[1] + (mod.deltaY || 0),
          baseVert[2] + (mod.deltaZ || 0),
        ];

        for (let i = 0; i < positions.length; i += 3) {
          const vx = positions[i];
          const vy = positions[i + 1];
          const vz = positions[i + 2];

          const matches =
            Math.abs(vx - baseVert[0]) < 1 &&
            Math.abs(vy - baseVert[1]) < 1 &&
            Math.abs(vz - baseVert[2]) < 1;

          if (matches) {
            positions[i] = targetVertex[0];
            positions[i + 1] = targetVertex[1];
            positions[i + 2] = targetVertex[2];
          }
        }
      });

      positionAttr.needsUpdate = true;
      newGeometry.computeVertexNormals();
      newGeometry.computeBoundingBox();
      newGeometry.computeBoundingSphere();

      updateShape(selectedShapeId, {
        parameters: {
          ...currentParams,
          vertexModifications: updatedMods,
        },
        geometry: newGeometry,
      });

      console.log(`✅ Vertex ${vertexIndex} moved: ${direction.toUpperCase()} = ${newValue} (delta: ${delta > 0 ? '+' : ''}${delta})`);
      delete (window as any).pendingVertexEdit;
      delete (window as any).vertexEditStatusMessage;
    };

    return () => {
      delete (window as any).handleVertexOffset;
      delete (window as any).pendingVertexEdit;
      delete (window as any).vertexEditStatusMessage;
    };
  }, [selectedShapeId, shapes, updateShape]);

  const handleContextMenu = (e: any, shapeId: string) => {
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
          parameters: shape.parameters
        };

        console.log('💾 Saving geometry:', {
          code: data.code,
          type: shape.type,
          parameters: shape.parameters,
          position: shape.position,
          scale: shape.scale
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
          preserveDrawingBuffer: true
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
        dampingFactor={0.05}
      />

      <group position={[-2500, -0.001, -2500]}>
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
