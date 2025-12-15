import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera, TransformControls } from '@react-three/drei';
import { useAppStore, CameraType, Tool, ViewMode } from '../store';
import ContextMenu from './ContextMenu';
import SaveDialog from './SaveDialog';
import { catalogService } from '../services/supabase';
import { VertexEditor } from './VertexEditor';
import { EdgeEditor } from './EdgeEditor';
import * as THREE from 'three';

const SubtractionMesh: React.FC<{
  subtraction: any;
  index: number;
  isHovered: boolean;
  isSubtractionSelected: boolean;
  isSelected: boolean;
  setHoveredSubtractionIndex: (index: number | null) => void;
  setSelectedSubtractionIndex: (index: number | null) => void;
}> = React.memo(({
  subtraction,
  index,
  isHovered,
  isSubtractionSelected,
  isSelected,
  setHoveredSubtractionIndex,
  setSelectedSubtractionIndex
}) => {
  const geometryInfo = useMemo(() => {
    const box = new THREE.Box3().setFromBufferAttribute(
      subtraction.geometry.attributes.position as THREE.BufferAttribute
    );
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const isCentered = Math.abs(center.x) < 0.01 && Math.abs(center.y) < 0.01 && Math.abs(center.z) < 0.01;
    const meshOffset: [number, number, number] = isCentered
      ? [size.x / 2, size.y / 2, size.z / 2]
      : [0, 0, 0];

    return { meshOffset };
  }, [subtraction.geometry]);

  return (
    <group
      position={subtraction.relativeOffset}
      rotation={subtraction.relativeRotation}
    >
      <mesh
        geometry={subtraction.geometry}
        position={geometryInfo.meshOffset}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (isSelected) {
            setHoveredSubtractionIndex(index);
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredSubtractionIndex(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isSelected) {
            setSelectedSubtractionIndex(isSubtractionSelected ? null : index);
          }
        }}
      >
        <meshStandardMaterial
          color={(isHovered || isSubtractionSelected) ? 0xff0000 : 0xffff00}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

SubtractionMesh.displayName = 'SubtractionMesh';

const ShapeWithTransform: React.FC<{
  shape: any;
  isSelected: boolean;
  orbitControlsRef: any;
  onContextMenu: (e: any, shapeId: string) => void;
}> = React.memo(({
  shape,
  isSelected,
  orbitControlsRef,
  onContextMenu
}) => {
  const {
    selectShape,
    selectSecondaryShape,
    secondarySelectedShapeId,
    updateShape,
    activeTool,
    viewMode,
    createGroup,
    subtractionViewMode,
    hoveredSubtractionIndex,
    setHoveredSubtractionIndex,
    selectedSubtractionIndex,
    setSelectedSubtractionIndex
  } = useAppStore();
  const transformRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const isUpdatingRef = useRef(false);
  const [localGeometry, setLocalGeometry] = useState(shape.geometry);
  const [edgeGeometry, setEdgeGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [geometryKey, setGeometryKey] = useState(0);
  const vertexModsString = JSON.stringify(shape.vertexModifications || []);

  useEffect(() => {
    const loadEdges = async () => {
      const hasVertexMods = shape.vertexModifications && shape.vertexModifications.length > 0;
      const shouldUpdate = (shape.geometry && shape.geometry !== localGeometry) || hasVertexMods;

      if (shouldUpdate && shape.geometry) {
        console.log(`🔄 Geometry update for shape ${shape.id}`, { hasVertexMods, vertexModCount: shape.vertexModifications?.length || 0 });

        let geom = shape.geometry.clone();

        if (hasVertexMods) {
          console.log(`🔧 Applying ${shape.vertexModifications.length} vertex modifications to geometry`);

          const positionAttribute = geom.getAttribute('position');
          const positions = positionAttribute.array as Float32Array;

          const vertexMap = new Map<string, number[]>();
          for (let i = 0; i < positions.length; i += 3) {
            const x = Math.round(positions[i] * 100) / 100;
            const y = Math.round(positions[i + 1] * 100) / 100;
            const z = Math.round(positions[i + 2] * 100) / 100;
            const key = `${x},${y},${z}`;

            if (!vertexMap.has(key)) {
              vertexMap.set(key, []);
            }
            vertexMap.get(key)!.push(i);
          }

          const { getBoxVertices, getReplicadVertices } = await import('../services/vertexEditor');
          let baseVertices: THREE.Vector3[] = [];

          if (shape.parameters?.scaledBaseVertices && shape.parameters.scaledBaseVertices.length > 0) {
            console.log('📍 Using pre-computed scaled base vertices for vertex modifications...');
            baseVertices = shape.parameters.scaledBaseVertices.map((v: number[]) =>
              new THREE.Vector3(v[0], v[1], v[2])
            );
            console.log(`✅ Loaded ${baseVertices.length} scaled base vertices for modifications`);
          } else if (shape.replicadShape) {
            console.log('📍 Loading base vertices from replicadShape...');
            baseVertices = await getReplicadVertices(shape.replicadShape);
          } else if (shape.type === 'box' && shape.parameters) {
            console.log('📦 Loading base vertices from box parameters...');
            baseVertices = getBoxVertices(
              shape.parameters.width,
              shape.parameters.height,
              shape.parameters.depth
            );
          }

          shape.vertexModifications.forEach((mod: any) => {
            const baseVertex = baseVertices[mod.vertexIndex];
            if (!baseVertex) {
              console.warn(`⚠️ Base vertex ${mod.vertexIndex} not found`);
              return;
            }

            const key = `${Math.round(baseVertex.x * 100) / 100},${Math.round(baseVertex.y * 100) / 100},${Math.round(baseVertex.z * 100) / 100}`;
            const indices = vertexMap.get(key);

            if (indices) {
              console.log(`✅ Applying modification to vertex ${mod.vertexIndex}:`, {
                baseVertexPos: [baseVertex.x.toFixed(1), baseVertex.y.toFixed(1), baseVertex.z.toFixed(1)],
                targetPos: [mod.newPosition[0].toFixed(1), mod.newPosition[1].toFixed(1), mod.newPosition[2].toFixed(1)],
                affectedMeshVertices: indices.length
              });

              indices.forEach(idx => {
                positions[idx] = mod.newPosition[0];
                positions[idx + 1] = mod.newPosition[1];
                positions[idx + 2] = mod.newPosition[2];
              });
            } else {
              console.warn(`⚠️ No mesh vertices found for base vertex ${mod.vertexIndex} at position [${baseVertex.x.toFixed(1)}, ${baseVertex.y.toFixed(1)}, ${baseVertex.z.toFixed(1)}] (key: ${key})`);
              console.log('Available vertex keys:', Array.from(vertexMap.keys()).slice(0, 10));
            }
          });

          positionAttribute.needsUpdate = true;
          geom.computeVertexNormals();
          geom.computeBoundingBox();
          geom.computeBoundingSphere();
        }

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
  }, [shape.parameters?.width, shape.parameters?.height, shape.parameters?.depth, vertexModsString, shape.parameters?.modified, shape.geometry, shape.id]);

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
        onDoubleClick={(e) => {
          e.stopPropagation();
          selectShape(shape.id);
          const { setShowParametersPanel } = useAppStore.getState();
          setShowParametersPanel(true);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu(e, shape.id);
        }}
      >
        {shape.subtractionGeometries && subtractionViewMode && shape.subtractionGeometries.map((subtraction, index) => {
          if (!subtraction) return null;

          const isHovered = hoveredSubtractionIndex === index && isSelected;
          const isSubtractionSelected = selectedSubtractionIndex === index && isSelected;

          return (
            <SubtractionMesh
              key={`${shape.id}-subtraction-${index}`}
              subtraction={subtraction}
              index={index}
              isHovered={isHovered}
              isSubtractionSelected={isSubtractionSelected}
              isSelected={isSelected}
              setHoveredSubtractionIndex={setHoveredSubtractionIndex}
              setSelectedSubtractionIndex={setSelectedSubtractionIndex}
            />
          );
        })}
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
});

ShapeWithTransform.displayName = 'ShapeWithTransform';

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
    chamferEditMode,
    setChamferEditMode,
    selectedEdgeIndex,
    selectedEdgeMidpoint,
    setSelectedEdgeIndex,
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
        setChamferEditMode(false);
        setSelectedEdgeIndex(null);
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
  }, [selectedShapeId, secondarySelectedShapeId, shapes, deleteShape, selectShape, exitIsolation, setVertexEditMode]);

  useEffect(() => {
    (window as any).handleVertexOffset = async (newValue: number) => {
      if (selectedShapeId && selectedVertexIndex !== null && vertexDirection) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape && shape.parameters) {
          console.log('📝 Processing vertex offset:', { newValue, vertexIndex: selectedVertexIndex, direction: vertexDirection });

          let baseVertices: number[][] = [];

          if (shape.parameters.scaledBaseVertices && shape.parameters.scaledBaseVertices.length > 0) {
            console.log('📍 Using pre-computed scaled base vertices for offset calculation...');
            baseVertices = shape.parameters.scaledBaseVertices;
            console.log(`✅ Using ${baseVertices.length} scaled base vertices`);
          } else if (shape.replicadShape) {
            console.log('🔍 Getting vertices from Replicad shape for offset calculation...');
            const { getReplicadVertices } = await import('../services/vertexEditor');
            const verts = await getReplicadVertices(shape.replicadShape);
            baseVertices = verts.map(v => [v.x, v.y, v.z]);
            console.log(`✅ Got ${baseVertices.length} vertices from Replicad`);
          } else if (shape.type === 'box') {
            const { getBoxVertices } = await import('../services/vertexEditor');
            const verts = getBoxVertices(
              shape.parameters.width,
              shape.parameters.height,
              shape.parameters.depth
            );
            baseVertices = verts.map(v => [v.x, v.y, v.z]);
            console.log(`✅ Got ${baseVertices.length} vertices from box parameters`);
          }

          if (selectedVertexIndex >= baseVertices.length) {
            console.error('❌ Invalid vertex index:', selectedVertexIndex);
            return;
          }

          const originalPos = baseVertices[selectedVertexIndex];

          const axisIndex = vertexDirection.startsWith('x') ? 0 : vertexDirection.startsWith('y') ? 1 : 2;

          const newPosition: [number, number, number] = [...originalPos];
          newPosition[axisIndex] = newValue;

          const offsetAmount = newValue - originalPos[axisIndex];
          const offset: [number, number, number] = [0, 0, 0];
          offset[axisIndex] = offsetAmount;

          const axisName = vertexDirection[0].toUpperCase();
          const directionSymbol = vertexDirection[1] === '+' ? '+' : '-';

          console.log(`🎯 Absolute position applied:`, {
            direction: vertexDirection,
            userInput: newValue,
            originalPosAxis: originalPos[axisIndex].toFixed(1),
            newPosAxis: newPosition[axisIndex].toFixed(1),
            offsetAmount: offsetAmount.toFixed(1),
            explanation: `${axisName}${directionSymbol} → move to ${newValue} (offset: ${offsetAmount.toFixed(1)})`
          });

          addVertexModification(selectedShapeId, {
            vertexIndex: selectedVertexIndex,
            originalPosition: originalPos as [number, number, number],
            newPosition,
            direction: vertexDirection,
            expression: String(newValue),
            description: `Vertex ${selectedVertexIndex} ${axisName}${directionSymbol}`,
            offset
          });

          console.log(`✅ Vertex ${selectedVertexIndex}:`, {
            base: `[${originalPos[0].toFixed(1)}, ${originalPos[1].toFixed(1)}, ${originalPos[2].toFixed(1)}]`,
            userValue: newValue,
            axis: axisName,
            offset: `[${offset[0].toFixed(1)}, ${offset[1].toFixed(1)}, ${offset[2].toFixed(1)}]`,
            final: `[${newPosition[0].toFixed(1)}, ${newPosition[1].toFixed(1)}, ${newPosition[2].toFixed(1)}]`
          });
        }

        (window as any).pendingVertexEdit = false;
        setSelectedVertexIndex(null);
      }
    };

    (window as any).pendingVertexEdit = selectedVertexIndex !== null && vertexDirection !== null;

    return () => {
      delete (window as any).handleVertexOffset;
      delete (window as any).pendingVertexEdit;
    };
  }, [selectedShapeId, selectedVertexIndex, vertexDirection, shapes, addVertexModification, setSelectedVertexIndex]);

  useEffect(() => {
    (window as any).handleChamferValue = async (chamferRadius: number) => {
      if (selectedShapeId && selectedEdgeIndex !== null) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape && shape.replicadShape) {
          console.log('🔨 Applying chamfer:', {
            edgeIndex: selectedEdgeIndex,
            radius: chamferRadius
          });

          try {
            const { applyChamferToShape, convertReplicadToThreeGeometry } = await import('../services/replicad');
            const { getReplicadVertices } = await import('../services/vertexEditor');

            const chamferedShape = await applyChamferToShape(
              shape.replicadShape,
              selectedEdgeIndex,
              chamferRadius
            );

            const newGeometry = convertReplicadToThreeGeometry(chamferedShape);
            const newBaseVertices = await getReplicadVertices(chamferedShape);

            updateShape(selectedShapeId, {
              geometry: newGeometry,
              replicadShape: chamferedShape,
              parameters: {
                ...shape.parameters,
                scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
              }
            });

            console.log('✅ Chamfer applied successfully');
            setSelectedEdgeIndex(null);
          } catch (error) {
            console.error('❌ Failed to apply chamfer:', error);
            alert('Failed to apply chamfer. Please try again.');
          }
        }

        (window as any).pendingChamferEdit = false;
      }
    };

    (window as any).pendingChamferEdit = selectedEdgeIndex !== null;

    return () => {
      delete (window as any).handleChamferValue;
      delete (window as any).pendingChamferEdit;
    };
  }, [selectedShapeId, selectedEdgeIndex, shapes, updateShape, setSelectedEdgeIndex]);

  const handleContextMenu = (e: any, shapeId: string) => {
    if (vertexEditMode) {
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
                onDirectionChange={(dir) => setVertexDirection(dir)}
                onOffsetConfirm={(vertexIndex, direction, offset) => {
                  console.log('Offset confirmed:', { vertexIndex, direction, offset });
                }}
              />
            )}
            {isSelected && chamferEditMode && (
              <EdgeEditor
                shape={shape}
                isActive={true}
                onEdgeSelect={(index, midpoint) => setSelectedEdgeIndex(index, midpoint)}
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
