import { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Check } from 'lucide-react';
import { useAppStore } from '../store';
import * as THREE from 'three';

interface CustomParameter {
  id: string;
  name: string;
  expression: string;
  result: number;
  description: string;
}

interface ParametersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ParametersPanel({ isOpen, onClose }: ParametersPanelProps) {
  const {
    selectedShapeId,
    shapes,
    updateShape,
    vertexEditMode,
    setVertexEditMode,
    subtractionViewMode,
    setSubtractionViewMode,
    selectedSubtractionIndex,
    setSelectedSubtractionIndex
  } = useAppStore();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [depth, setDepth] = useState(0);
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [vertexModifications, setVertexModifications] = useState<any[]>([]);

  const [subWidth, setSubWidth] = useState(0);
  const [subHeight, setSubHeight] = useState(0);
  const [subDepth, setSubDepth] = useState(0);
  const [subPosX, setSubPosX] = useState(0);
  const [subPosY, setSubPosY] = useState(0);
  const [subPosZ, setSubPosZ] = useState(0);

  useEffect(() => {
    console.log('Parameters Panel - Selected Shape:', {
      selectedShapeId,
      shapesCount: shapes.length,
      selectedShape: selectedShape ? {
        id: selectedShape.id,
        type: selectedShape.type,
        parameters: selectedShape.parameters
      } : null
    });

    if (selectedShape && selectedShape.parameters) {
      setWidth(selectedShape.parameters.width || 0);
      setHeight(selectedShape.parameters.height || 0);
      setDepth(selectedShape.parameters.depth || 0);
      setCustomParameters(selectedShape.parameters.customParameters || []);
      setVertexModifications(selectedShape.vertexModifications || []);
    } else {
      setWidth(0);
      setHeight(0);
      setDepth(0);
      setCustomParameters([]);
      setVertexModifications([]);
    }
  }, [selectedShape, selectedShapeId, shapes]);

  useEffect(() => {
    if (selectedShape && selectedSubtractionIndex !== null && selectedShape.subtractionGeometries) {
      const subtraction = selectedShape.subtractionGeometries[selectedSubtractionIndex];
      if (subtraction) {
        const box = new THREE.Box3().setFromBufferAttribute(
          subtraction.geometry.attributes.position as THREE.BufferAttribute
        );
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const round = (n: number) => Math.round(n * 100) / 100;

        console.log('🔄 Updating subtraction UI from geometry:', {
          index: selectedSubtractionIndex,
          size: { x: size.x, y: size.y, z: size.z },
          center: { x: center.x, y: center.y, z: center.z },
          offset: subtraction.relativeOffset
        });

        setSubWidth(round(size.x));
        setSubHeight(round(size.y));
        setSubDepth(round(size.z));
        setSubPosX(round(subtraction.relativeOffset[0]));
        setSubPosY(round(subtraction.relativeOffset[1]));
        setSubPosZ(round(subtraction.relativeOffset[2]));
      }
    }
  }, [selectedShape?.id, selectedSubtractionIndex, selectedShape?.subtractionGeometries?.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);


  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', value: number) => {
    if (!selectedShape) return;

    const newWidth = dimension === 'width' ? value : width;
    const newHeight = dimension === 'height' ? value : height;
    const newDepth = dimension === 'depth' ? value : depth;

    setWidth(newWidth);
    setHeight(newHeight);
    setDepth(newDepth);

    const updatedCustomParams = customParameters.map((param) => ({
      ...param,
      result: evaluateExpression(param.expression.replace(/\bW\b/g, newWidth.toString()).replace(/\bH\b/g, newHeight.toString()).replace(/\bD\b/g, newDepth.toString()))
    }));
    setCustomParameters(updatedCustomParams);
  };

  const addCustomParameter = () => {
    const nextNumber = customParameters.length + 1;
    const newParam: CustomParameter = {
      id: `param-${Date.now()}`,
      name: `P${nextNumber}`,
      expression: '0',
      result: 0,
      description: '',
    };
    const updatedParams = [...customParameters, newParam];
    setCustomParameters(updatedParams);

    if (selectedShape) {
      updateShape(selectedShape.id, {
        parameters: {
          ...selectedShape.parameters,
          customParameters: updatedParams,
        },
      });
    }
  };

  const evaluateExpression = (expression: string, fallback: number = 0): number => {
    try {
      let expr = expression
        .replace(/\bW\b/g, width.toString())
        .replace(/\bH\b/g, height.toString())
        .replace(/\bD\b/g, depth.toString());

      customParameters.forEach((param) => {
        const regex = new RegExp(`\\b${param.name}\\b`, 'g');
        expr = expr.replace(regex, param.result.toString());
      });

      const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return typeof result === 'number' && !isNaN(result) ? result : fallback;
    } catch {
      return fallback;
    }
  };

  const updateCustomParameter = (id: string, field: keyof CustomParameter, value: string) => {
    const updatedParams = customParameters.map((param) => {
      if (param.id !== id) return param;
      const updated = { ...param, [field]: value };
      if (field === 'expression') updated.result = evaluateExpression(value);
      return updated;
    });
    setCustomParameters(updatedParams);

    if (selectedShape) {
      updateShape(selectedShape.id, {
        parameters: { ...selectedShape.parameters, customParameters: updatedParams }
      });
    }
  };

  const applySubtractionChanges = async (shapeOverride?: any) => {
    const currentShape = shapeOverride || shapes.find(s => s.id === selectedShapeId);
    if (!currentShape || selectedSubtractionIndex === null || !currentShape.subtractionGeometries) return;

    console.log('🔧 Applying subtraction changes:', {
      subIndex: selectedSubtractionIndex,
      newSize: { w: subWidth, h: subHeight, d: subDepth },
      newPos: { x: subPosX, y: subPosY, z: subPosZ }
    });

    const { getReplicadVertices } = await import('../services/vertexEditor');
    const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('../services/replicad');

    const newSubGeometry = new THREE.BoxGeometry(subWidth, subHeight, subDepth);
    const currentSubtraction = currentShape.subtractionGeometries[selectedSubtractionIndex];

    console.log('🔧 Updating subtraction (center-based geometry):', {
      size: { w: subWidth, h: subHeight, d: subDepth },
      relativeOffset: { x: subPosX, y: subPosY, z: subPosZ },
      note: 'THREE.BoxGeometry is created at center, offset is relative to parent shape center'
    });

    const updatedSubtraction = {
      ...currentSubtraction,
      geometry: newSubGeometry,
      relativeOffset: [subPosX, subPosY, subPosZ] as [number, number, number],
      relativeRotation: currentSubtraction.relativeRotation || [0, 0, 0] as [number, number, number],
      scale: currentSubtraction.scale || [1, 1, 1] as [number, number, number]
    };

    const allSubtractions = currentShape.subtractionGeometries.map((sub, idx) =>
      idx === selectedSubtractionIndex ? updatedSubtraction : sub
    );

    console.log(`🔄 Applying ${allSubtractions.length} subtraction(s)...`);

    const baseShape = await createReplicadBox({
      width: currentShape.parameters.width || 1,
      height: currentShape.parameters.height || 1,
      depth: currentShape.parameters.depth || 1
    });

    let resultShape = baseShape;

    for (let i = 0; i < allSubtractions.length; i++) {
      const subtraction = allSubtractions[i];
      const subSize = getOriginalSize(subtraction.geometry);

      const subBox = await createReplicadBox({
        width: subSize.x,
        height: subSize.y,
        depth: subSize.z
      });

      const absolutePos = [
        currentShape.position[0] + subtraction.relativeOffset[0],
        currentShape.position[1] + subtraction.relativeOffset[1],
        currentShape.position[2] + subtraction.relativeOffset[2]
      ] as [number, number, number];

      const absoluteRot = [
        currentShape.rotation[0] + subtraction.relativeRotation[0],
        currentShape.rotation[1] + subtraction.relativeRotation[1],
        currentShape.rotation[2] + subtraction.relativeRotation[2]
      ] as [number, number, number];

      resultShape = await performBooleanCut(
        resultShape,
        subBox,
        currentShape.position,
        absolutePos,
        currentShape.rotation,
        absoluteRot,
        currentShape.scale,
        subtraction.scale || [1, 1, 1] as [number, number, number]
      );
    }

    const newGeometry = convertReplicadToThreeGeometry(resultShape);
    const newBaseVertices = await getReplicadVertices(resultShape);

    console.log('✅ Subtraction complete');

    updateShape(currentShape.id, {
      geometry: newGeometry,
      replicadShape: resultShape,
      subtractionGeometries: allSubtractions,
      parameters: {
        ...currentShape.parameters,
        scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
      }
    });
  };

  const getOriginalSize = (geometry: THREE.BufferGeometry) => {
    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.attributes.position as THREE.BufferAttribute
    );
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  };

  const deleteCustomParameter = (id: string) => {
    const updatedParams = customParameters.filter((param) => param.id !== id);
    setCustomParameters(updatedParams);

    if (selectedShape) {
      updateShape(selectedShape.id, {
        parameters: { ...selectedShape.parameters, customParameters: updatedParams }
      });
    }
  };

  const applyChanges = async () => {
    if (!selectedShape) return;

    console.log('📐 Applying parameter changes:', { width, height, depth });

    try {
      const { getBoxVertices, getReplicadVertices } = await import('../services/vertexEditor');
      const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('../services/replicad');
      let newBaseVertices: THREE.Vector3[] = [];
      let currentBaseVertices: THREE.Vector3[] = [];

      const currentWidth = selectedShape.parameters.width;
      const currentHeight = selectedShape.parameters.height;
      const currentDepth = selectedShape.parameters.depth;

      const scaleX = width / currentWidth;
      const scaleY = height / currentHeight;
      const scaleZ = depth / currentDepth;

      const dimensionsChanged = width !== currentWidth || height !== currentHeight || depth !== currentDepth;

      if (selectedShape.parameters.scaledBaseVertices?.length > 0) {
        currentBaseVertices = selectedShape.parameters.scaledBaseVertices.map((v: number[]) => new THREE.Vector3(v[0], v[1], v[2]));
        newBaseVertices = dimensionsChanged ? currentBaseVertices.map(v => new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)) : currentBaseVertices;
      } else if (selectedShape.replicadShape) {
        currentBaseVertices = await getReplicadVertices(selectedShape.replicadShape);
        newBaseVertices = dimensionsChanged ? currentBaseVertices.map(v => new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)) : currentBaseVertices;
      } else if (selectedShape.type === 'box') {
        newBaseVertices = getBoxVertices(width, height, depth);
        currentBaseVertices = getBoxVertices(currentWidth, currentHeight, currentDepth);
      }

      const vertexFinalPositions = new Map<number, [number, number, number]>();

      vertexModifications.forEach((mod: any) => {
        const newOriginalPos = newBaseVertices[mod.vertexIndex]
          ? [newBaseVertices[mod.vertexIndex].x, newBaseVertices[mod.vertexIndex].y, newBaseVertices[mod.vertexIndex].z] as [number, number, number]
          : mod.originalPosition;

        if (!vertexFinalPositions.has(mod.vertexIndex)) {
          vertexFinalPositions.set(mod.vertexIndex, [...newOriginalPos] as [number, number, number]);
        }

        const offsetValue = evaluateExpression(mod.expression);
        const axisIndex = mod.direction.startsWith('x') ? 0 : mod.direction.startsWith('y') ? 1 : 2;
        vertexFinalPositions.get(mod.vertexIndex)![axisIndex] = offsetValue;
      });

      const updatedVertexMods = vertexModifications.map((mod: any) => {
        const newOriginalPos = newBaseVertices[mod.vertexIndex]
          ? [newBaseVertices[mod.vertexIndex].x, newBaseVertices[mod.vertexIndex].y, newBaseVertices[mod.vertexIndex].z] as [number, number, number]
          : mod.originalPosition;

        const axisIndex = mod.direction.startsWith('x') ? 0 : mod.direction.startsWith('y') ? 1 : 2;
        const finalPos = vertexFinalPositions.get(mod.vertexIndex)!;
        const newOffset = [0, 0, 0] as [number, number, number];
        newOffset[axisIndex] = finalPos[axisIndex] - newOriginalPos[axisIndex];

        return {
          ...mod,
          originalPosition: newOriginalPos,
          newPosition: finalPos,
          offset: newOffset,
          expression: mod.expression
        };
      });

      let scaledGeometry = selectedShape.geometry;

      if (dimensionsChanged && selectedShape.geometry) {
        console.log('📏 Scaling geometry by:', { scaleX, scaleY, scaleZ });
        scaledGeometry = selectedShape.geometry.clone();
        scaledGeometry.scale(scaleX, scaleY, scaleZ);
        scaledGeometry.computeVertexNormals();
        scaledGeometry.computeBoundingBox();
        scaledGeometry.computeBoundingSphere();
      }

      const hasSubtractionChanges = selectedSubtractionIndex !== null && selectedShape.subtractionGeometries?.length > 0;

      const baseUpdate = {
        parameters: {
          ...selectedShape.parameters,
          width,
          height,
          depth,
          customParameters,
          scaledBaseVertices: newBaseVertices.length > 0 ? newBaseVertices.map(v => [v.x, v.y, v.z]) : selectedShape.parameters.scaledBaseVertices
        },
        vertexModifications: updatedVertexMods,
        position: selectedShape.position,
        rotation: selectedShape.rotation,
        scale: selectedShape.scale
      };

      if (hasSubtractionChanges) {
        console.log('🔄 Recalculating subtraction with updated dimensions...');

        const updatedSubtraction = {
          ...selectedShape.subtractionGeometries![selectedSubtractionIndex],
          geometry: new THREE.BoxGeometry(subWidth, subHeight, subDepth),
          relativeOffset: [subPosX, subPosY, subPosZ] as [number, number, number]
        };

        const allSubtractions = selectedShape.subtractionGeometries!.map((sub, idx) =>
          idx === selectedSubtractionIndex ? updatedSubtraction : sub
        );

        let baseShape = await createReplicadBox({
          width,
          height,
          depth
        });

        let resultShape = baseShape;

        for (let i = 0; i < allSubtractions.length; i++) {
          const subtraction = allSubtractions[i];
          const subSize = getOriginalSize(subtraction.geometry);

          const subBox = await createReplicadBox({
            width: subSize.x,
            height: subSize.y,
            depth: subSize.z
          });

          const absolutePos = [
            selectedShape.position[0] + subtraction.relativeOffset[0],
            selectedShape.position[1] + subtraction.relativeOffset[1],
            selectedShape.position[2] + subtraction.relativeOffset[2]
          ] as [number, number, number];

          const absoluteRot = [
            selectedShape.rotation[0] + (subtraction.relativeRotation?.[0] || 0),
            selectedShape.rotation[1] + (subtraction.relativeRotation?.[1] || 0),
            selectedShape.rotation[2] + (subtraction.relativeRotation?.[2] || 0)
          ] as [number, number, number];

          resultShape = await performBooleanCut(
            resultShape,
            subBox,
            selectedShape.position,
            absolutePos,
            selectedShape.rotation,
            absoluteRot,
            selectedShape.scale,
            subtraction.scale || [1, 1, 1] as [number, number, number]
          );
        }

        const newGeometry = convertReplicadToThreeGeometry(resultShape);
        const newBaseVertices = await getReplicadVertices(resultShape);

        const newBox = new THREE.Box3().setFromBufferAttribute(
          newGeometry.attributes.position as THREE.BufferAttribute
        );
        const newCenter = new THREE.Vector3();
        newBox.getCenter(newCenter);

        const originalBox = new THREE.Box3().setFromObject(new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth)
        ));
        const originalCenter = new THREE.Vector3();
        originalBox.getCenter(originalCenter);

        const positionOffset = [
          originalCenter.x - newCenter.x,
          originalCenter.y - newCenter.y,
          originalCenter.z - newCenter.z
        ] as [number, number, number];

        console.log('📍 Position correction after cut:', {
          originalCenter: [originalCenter.x.toFixed(2), originalCenter.y.toFixed(2), originalCenter.z.toFixed(2)],
          newCenter: [newCenter.x.toFixed(2), newCenter.y.toFixed(2), newCenter.z.toFixed(2)],
          offset: [positionOffset[0].toFixed(2), positionOffset[1].toFixed(2), positionOffset[2].toFixed(2)],
          oldPosition: selectedShape.position
        });

        updateShape(selectedShape.id, {
          ...baseUpdate,
          geometry: newGeometry,
          replicadShape: resultShape,
          subtractionGeometries: allSubtractions,
          position: [
            selectedShape.position[0] + positionOffset[0],
            selectedShape.position[1] + positionOffset[1],
            selectedShape.position[2] + positionOffset[2]
          ] as [number, number, number],
          parameters: {
            ...baseUpdate.parameters,
            scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
          }
        });
      } else {
        updateShape(selectedShape.id, {
          ...baseUpdate,
          ...(dimensionsChanged && scaledGeometry && { geometry: scaledGeometry })
        });
      }

      console.log('✅ Parameters applied');
    } catch (error) {
      console.error('❌ Failed to update parameters:', error);
      updateShape(selectedShape.id, {
        parameters: { ...selectedShape.parameters, width, height, depth, customParameters },
        vertexModifications: []
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '410px',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Parameters</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setVertexEditMode(!vertexEditMode)}
            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              vertexEditMode
                ? 'bg-orange-600 text-white'
                : 'bg-stone-200 text-slate-700 hover:bg-stone-300'
            }`}
            title="Edit Vertices"
          >
            VERTEX
          </button>
          {selectedShape?.subtractionGeometries && selectedShape.subtractionGeometries.length > 0 && (
            <button
              onClick={() => {
                const newMode = !subtractionViewMode;
                console.log('🔘 SUB button clicked:', {
                  oldMode: subtractionViewMode,
                  newMode,
                  selectedShape: selectedShape?.id,
                  subtractionCount: selectedShape?.subtractionGeometries?.length || 0
                });
                setSubtractionViewMode(newMode);
              }}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                subtractionViewMode
                  ? 'bg-yellow-500 text-white'
                  : 'bg-stone-200 text-slate-700 hover:bg-stone-300'
              }`}
              title={`Show ${selectedShape.subtractionGeometries.length} Subtraction Geometr${selectedShape.subtractionGeometries.length > 1 ? 'ies' : 'y'}`}
            >
              SUB ({selectedShape.subtractionGeometries.length})
            </button>
          )}
          <button
            onClick={addCustomParameter}
            className="p-0.5 hover:bg-stone-200 rounded transition-colors"
            title="Add Parameter"
          >
            <Plus size={14} className="text-stone-600" />
          </button>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-stone-200 rounded transition-colors"
          >
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {selectedShape ? (
          <div className="space-y-2">
            <div className="space-y-2">
              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  value="W"
                  readOnly
                  className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                />
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <input
                  type="text"
                  value={width}
                  readOnly
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                />
                <input
                  type="text"
                  value="Width"
                  readOnly
                  className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                />
              </div>

              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  value="H"
                  readOnly
                  className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                />
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <input
                  type="text"
                  value={height}
                  readOnly
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                />
                <input
                  type="text"
                  value="Height"
                  readOnly
                  className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                />
              </div>

              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  value="D"
                  readOnly
                  className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                />
                <input
                  type="number"
                  value={depth}
                  onChange={(e) => handleDimensionChange('depth', Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <input
                  type="text"
                  value={depth}
                  readOnly
                  className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                />
                <input
                  type="text"
                  value="Depth"
                  readOnly
                  className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                />
              </div>
            </div>

            {selectedSubtractionIndex !== null && selectedShape.subtractionGeometries && (
              <div className="space-y-2 pt-2 border-t-2 border-yellow-400">
                <div className="text-xs font-semibold text-yellow-700 mb-2">
                  Subtraction #{selectedSubtractionIndex + 1} Parameters
                </div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="W"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={subWidth}
                    step="0.01"
                    onChange={(e) => setSubWidth(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={subWidth.toFixed(2)}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Width"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="H"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={subHeight}
                    step="0.01"
                    onChange={(e) => setSubHeight(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={subHeight.toFixed(2)}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Height"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="D"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={subDepth}
                    step="0.01"
                    onChange={(e) => setSubDepth(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={subDepth.toFixed(2)}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Depth"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="X"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={subPosX}
                    step="0.01"
                    onChange={(e) => setSubPosX(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={subPosX.toFixed(2)}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Position X"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="Y"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={subPosY}
                    step="0.01"
                    onChange={(e) => setSubPosY(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={subPosY.toFixed(2)}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Position Y"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="Z"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={subPosZ}
                    step="0.01"
                    onChange={(e) => setSubPosZ(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={subPosZ.toFixed(2)}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Position Z"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>
              </div>
            )}

            {customParameters.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                {customParameters.map((param) => (
                  <div key={param.id} className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => updateCustomParameter(param.id, 'name', e.target.value)}
                      className="w-10 px-2 py-1 text-xs font-medium text-center border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      placeholder="P"
                    />
                    <input
                      type="text"
                      value={param.expression}
                      onChange={(e) => updateCustomParameter(param.id, 'expression', e.target.value)}
                      className="w-16 px-2 py-1 text-xs text-center border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      placeholder="0"
                    />
                    <input
                      type="text"
                      value={param.result}
                      readOnly
                      className="w-16 px-2 py-1 text-xs text-center border border-stone-300 rounded bg-stone-50 text-stone-600"
                    />
                    <input
                      type="text"
                      value={param.description}
                      onChange={(e) => updateCustomParameter(param.id, 'description', e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      placeholder="Description"
                    />
                    <button
                      onClick={() => deleteCustomParameter(param.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                      title="Delete Parameter"
                    >
                      <X size={14} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {vertexModifications.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                {vertexModifications.map((mod: any, idx: number) => {
                  const currentValue = mod.direction.startsWith('x') ? mod.newPosition[0] :
                                       mod.direction.startsWith('y') ? mod.newPosition[1] :
                                       mod.newPosition[2];

                  const expression = mod.expression || String(currentValue);
                  const result = evaluateExpression(expression, currentValue);

                  return (
                    <div key={idx} className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={`V${mod.vertexIndex}`}
                        readOnly
                        className="w-10 px-2 py-1 text-xs font-medium text-center border border-stone-300 rounded bg-stone-50 text-stone-700"
                      />
                      <input
                        type="text"
                        value={expression}
                        onChange={(e) => {
                          const newExpr = e.target.value;
                          const updatedMods = [...vertexModifications];
                          updatedMods[idx] = { ...mod, expression: newExpr };
                          setVertexModifications(updatedMods);
                        }}
                        className="w-16 px-2 py-1 text-xs text-center border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                        placeholder="0"
                      />
                      <input
                        type="text"
                        value={result}
                        readOnly
                        className="w-16 px-2 py-1 text-xs text-center border border-stone-300 rounded bg-stone-50 text-stone-600"
                      />
                      <input
                        type="text"
                        value={mod.description || ''}
                        onChange={(e) => {
                          const updatedMods = [...vertexModifications];
                          updatedMods[idx] = { ...mod, description: e.target.value };
                          setVertexModifications(updatedMods);
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                        placeholder="Description"
                      />
                      <button
                        onClick={() => {
                          const updatedMods = vertexModifications.filter((_: any, i: number) => i !== idx);
                          setVertexModifications(updatedMods);
                        }}
                        className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                        title="Delete Vertex"
                      >
                        <X size={14} className="text-red-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-3 border-t border-stone-200 mt-3">
              <button
                onClick={applyChanges}
                className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                Apply Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-stone-500 text-center py-3">
            No object selected
          </div>
        )}
      </div>
    </div>
  );
}