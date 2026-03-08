import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore, Tool, ViewMode } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { SubtractionMesh } from './SubtractionMesh';
import { FilletEdgeLines } from './Fillet';
import { FaceEditor } from './FaceEditor';

interface ShapeWithTransformProps {
  shape: any;
  isSelected: boolean;
  orbitControlsRef: any;
  onContextMenu: (e: any, shapeId: string) => void;
}

export const ShapeWithTransform: React.FC<ShapeWithTransformProps> = React.memo(({
  shape,
  isSelected,
  orbitControlsRef,
  onContextMenu
}) => {
  const {
    selectShape,
    selectSecondaryShape,
    secondarySelectedShapeId,
    selectedShapeId,
    updateShape,
    activeTool,
    viewMode,
    subtractionViewMode,
    hoveredSubtractionIndex,
    setHoveredSubtractionIndex,
    selectedSubtractionIndex,
    setSelectedSubtractionIndex,
    setShowParametersPanel,
    showOutlines,
    faceEditMode,
    filletMode,
    roleEditMode,
    setSelectedVertexIndex,
    setVertexDirection,
    shapes
  } = useAppStore(useShallow(state => ({
    selectShape: state.selectShape,
    selectSecondaryShape: state.selectSecondaryShape,
    secondarySelectedShapeId: state.secondarySelectedShapeId,
    selectedShapeId: state.selectedShapeId,
    updateShape: state.updateShape,
    activeTool: state.activeTool,
    viewMode: state.viewMode,
    subtractionViewMode: state.subtractionViewMode,
    hoveredSubtractionIndex: state.hoveredSubtractionIndex,
    setHoveredSubtractionIndex: state.setHoveredSubtractionIndex,
    selectedSubtractionIndex: state.selectedSubtractionIndex,
    setSelectedSubtractionIndex: state.setSelectedSubtractionIndex,
    setShowParametersPanel: state.setShowParametersPanel,
    showOutlines: state.showOutlines,
    faceEditMode: state.faceEditMode,
    filletMode: state.filletMode,
    roleEditMode: state.roleEditMode,
    setSelectedVertexIndex: state.setSelectedVertexIndex,
    setVertexDirection: state.setVertexDirection,
    shapes: state.shapes
  })));

  const transformRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const isUpdatingRef = useRef(false);
  const initialTransformRef = useRef<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  } | null>(null);
  const [localGeometry, setLocalGeometry] = useState(shape.geometry);
  const [edgeGeometry, setEdgeGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [geometryKey, setGeometryKey] = useState(0);
  const vertexModsString = useMemo(() => JSON.stringify(shape.vertexModifications || []), [shape.vertexModifications]);

  useEffect(() => {
    const loadEdges = async () => {
      const hasVertexMods = shape.vertexModifications && shape.vertexModifications.length > 0;
      const shouldUpdate = (shape.geometry && shape.geometry !== localGeometry) || hasVertexMods;

      if (shouldUpdate && shape.geometry) {

        let geom = shape.geometry.clone();

        if (hasVertexMods) {
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

          const { getBoxVertices, getReplicadVertices } = await import('./VertexEditorService');
          let baseVertices: THREE.Vector3[] = [];

          if (shape.parameters?.scaledBaseVertices && shape.parameters.scaledBaseVertices.length > 0) {
            baseVertices = shape.parameters.scaledBaseVertices.map((v: number[]) =>
              new THREE.Vector3(v[0], v[1], v[2])
            );
          } else if (shape.replicadShape) {
            baseVertices = await getReplicadVertices(shape.replicadShape);
          } else if (shape.type === 'box' && shape.parameters) {
            baseVertices = getBoxVertices(
              shape.parameters.width,
              shape.parameters.height,
              shape.parameters.depth
            );
          }

          shape.vertexModifications.forEach((mod: any) => {
            const baseVertex = baseVertices[mod.vertexIndex];
            if (!baseVertex) return;

            const key = `${Math.round(baseVertex.x * 100) / 100},${Math.round(baseVertex.y * 100) / 100},${Math.round(baseVertex.z * 100) / 100}`;
            const indices = vertexMap.get(key);

            if (indices) {
              indices.forEach(idx => {
                positions[idx] = mod.newPosition[0];
                positions[idx + 1] = mod.newPosition[1];
                positions[idx + 2] = mod.newPosition[2];
              });
            }
          });

          positionAttribute.needsUpdate = true;
          geom.computeVertexNormals();
          geom.computeBoundingBox();
          geom.computeBoundingSphere();
        }

        setLocalGeometry(geom);
        const edges = new THREE.EdgesGeometry(geom, 5);
        setEdgeGeometry(edges);
        setGeometryKey(prev => prev + 1);
        return;
      }

      if (shape.parameters?.modified && shape.geometry) {
        let geom = shape.geometry.clone();

        geom.computeVertexNormals();
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        setLocalGeometry(geom);
        const edges = new THREE.EdgesGeometry(geom, 5);
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

    groupRef.current.position.set(shape.position[0], shape.position[1], shape.position[2]);
    groupRef.current.rotation.set(shape.rotation[0], shape.rotation[1], shape.rotation[2]);
    groupRef.current.scale.set(shape.scale[0], shape.scale[1], shape.scale[2]);
  }, [shape.position, shape.rotation, shape.scale]);

  useEffect(() => {
    if (transformRef.current && isSelected && groupRef.current) {
      const controls = transformRef.current;
      let isDragging = false;

      const onDraggingChanged = (event: any) => {
        isDragging = event.value;
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = !event.value;
        }

        if (event.value && groupRef.current) {
          initialTransformRef.current = {
            position: groupRef.current.position.toArray() as [number, number, number],
            rotation: groupRef.current.rotation.toArray().slice(0, 3) as [number, number, number],
            scale: groupRef.current.scale.toArray() as [number, number, number]
          };
        }

        if (!event.value && groupRef.current && initialTransformRef.current) {
          const finalPosition = groupRef.current.position.toArray() as [number, number, number];
          const finalRotation = groupRef.current.rotation.toArray().slice(0, 3) as [number, number, number];
          const finalScale = groupRef.current.scale.toArray() as [number, number, number];

          isUpdatingRef.current = true;

          updateShape(shape.id, {
            position: finalPosition,
            rotation: finalRotation,
            scale: finalScale
          });

          initialTransformRef.current = null;

          requestAnimationFrame(() => {
            isUpdatingRef.current = false;
          });
        }
      };

      controls.addEventListener('dragging-changed', onDraggingChanged);

      return () => {
        controls.removeEventListener('dragging-changed', onDraggingChanged);
      };
    }
  }, [isSelected, shape.id, updateShape, orbitControlsRef, geometryKey]);

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
  const hasFillets = shape.fillets && shape.fillets.length > 0;
  if (shape.isolated === false) {
    return null;
  }

  return (
    <>
      <group
        ref={groupRef}
        name={`shape-${shape.id}`}
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
          <>
            <mesh
              ref={meshRef}
              geometry={localGeometry}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#94b8d9"
                metalness={0.1}
                roughness={0.6}
                transparent
                opacity={0.12}
                side={THREE.DoubleSide}
                flatShading={false}
              />
            </mesh>
            {showOutlines && (
              <lineSegments>
                {edgeGeometry ? (
                  <bufferGeometry {...edgeGeometry} />
                ) : (
                  <edgesGeometry args={[localGeometry, 5]} />
                )}
                <lineBasicMaterial
                  color="#000000"
                  linewidth={2}
                  opacity={1}
                  transparent={false}
                  depthTest={true}
                />
              </lineSegments>
            )}
          </>
        )}
        {isWireframe && (
          <>
            <mesh
              ref={meshRef}
              geometry={localGeometry}
              visible={false}
            />
            {showOutlines && (
              <>
                <lineSegments>
                  {edgeGeometry ? (
                    <bufferGeometry {...edgeGeometry} />
                  ) : (
                    <edgesGeometry args={[localGeometry, 5]} />
                  )}
                  <lineBasicMaterial
                    color={isSelected ? '#60a5fa' : shouldShowAsReference ? '#ef4444' : '#1a1a1a'}
                    linewidth={isSelected || shouldShowAsReference ? 3.5 : 2.5}
                    depthTest={true}
                    depthWrite={true}
                  />
                </lineSegments>
                <lineSegments>
                  {edgeGeometry ? (
                    <bufferGeometry {...edgeGeometry} />
                  ) : (
                    <edgesGeometry args={[localGeometry, 5]} />
                  )}
                  <lineBasicMaterial
                    color={isSelected ? '#1e40af' : shouldShowAsReference ? '#991b1b' : '#000000'}
                    linewidth={isSelected || shouldShowAsReference ? 2 : 1.5}
                    transparent
                    opacity={0.4}
                    depthTest={true}
                  />
                </lineSegments>
              </>
            )}
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
                metalness={0.2}
                roughness={0.5}
                transparent
                opacity={0.25}
                side={THREE.DoubleSide}
                flatShading={false}
              />
            </mesh>
            {showOutlines && (
              <lineSegments>
                {edgeGeometry ? (
                  <bufferGeometry {...edgeGeometry} />
                ) : (
                  <edgesGeometry args={[localGeometry, 5]} />
                )}
                <lineBasicMaterial
                  color={isSelected ? '#1e40af' : shouldShowAsReference ? '#991b1b' : '#0a0a0a'}
                  linewidth={isSelected || shouldShowAsReference ? 3 : 2.5}
                  depthTest={true}
                  transparent={false}
                  opacity={1}
                />
              </lineSegments>
            )}
          </>
        )}
        {hasFillets && filletMode && (
          <FilletEdgeLines shape={shape} isSelected={isSelected} />
        )}
        {isSelected && faceEditMode && (
          <FaceEditor
            key={`face-editor-${shape.id}-${shape.geometry?.uuid || ''}-${(shape.fillets || []).length}`}
            shape={shape}
            isActive={true}
          />
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
