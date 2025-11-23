import { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Check, ArrowUp, ArrowDown } from 'lucide-react';
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
    setVertexEditMode
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

  const [subtractionX, setSubtractionX] = useState(0);
  const [subtractionY, setSubtractionY] = useState(0);
  const [subtractionZ, setSubtractionZ] = useState(0);
  const [subtractionSizeX, setSubtractionSizeX] = useState(0);
  const [subtractionSizeY, setSubtractionSizeY] = useState(0);
  const [subtractionSizeZ, setSubtractionSizeZ] = useState(0);
  const [subtractionDirX, setSubtractionDirX] = useState<'+' | '-'>('+');
  const [subtractionDirY, setSubtractionDirY] = useState<'+' | '-'>('+');
  const [subtractionDirZ, setSubtractionDirZ] = useState<'+' | '-'>('+');

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

      if (selectedShape.subtractionRegion) {
        setSubtractionX(selectedShape.subtractionRegion.position[0]);
        setSubtractionY(selectedShape.subtractionRegion.position[1]);
        setSubtractionZ(selectedShape.subtractionRegion.position[2]);
        setSubtractionSizeX(selectedShape.subtractionRegion.size[0]);
        setSubtractionSizeY(selectedShape.subtractionRegion.size[1]);
        setSubtractionSizeZ(selectedShape.subtractionRegion.size[2]);
        setSubtractionDirX(selectedShape.subtractionRegion.growthDirection.x);
        setSubtractionDirY(selectedShape.subtractionRegion.growthDirection.y);
        setSubtractionDirZ(selectedShape.subtractionRegion.growthDirection.z);
      }
    } else {
      setWidth(0);
      setHeight(0);
      setDepth(0);
      setCustomParameters([]);
      setVertexModifications([]);
      setSubtractionX(0);
      setSubtractionY(0);
      setSubtractionZ(0);
      setSubtractionSizeX(0);
      setSubtractionSizeY(0);
      setSubtractionSizeZ(0);
      setSubtractionDirX('+');
      setSubtractionDirY('+');
      setSubtractionDirZ('+');
    }
  }, [selectedShapeId]);


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

  const recalculateCustomParameters = (newWidth: number, newHeight: number, newDepth: number) => {
    return customParameters.map((param) => {
      let expr = param.expression
        .replace(/\bW\b/g, newWidth.toString())
        .replace(/\bH\b/g, newHeight.toString())
        .replace(/\bD\b/g, newDepth.toString());

      customParameters.forEach((p) => {
        const regex = new RegExp(`\\b${p.name}\\b`, 'g');
        expr = expr.replace(regex, p.result.toString());
      });

      try {
        const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
        const result = Function(`"use strict"; return (${sanitized})`)();
        return {
          ...param,
          result: typeof result === 'number' && !isNaN(result) ? result : 0,
        };
      } catch {
        return { ...param, result: 0 };
      }
    });
  };

  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', value: number) => {
    if (!selectedShape) return;

    const newWidth = dimension === 'width' ? value : width;
    const newHeight = dimension === 'height' ? value : height;
    const newDepth = dimension === 'depth' ? value : depth;

    setWidth(newWidth);
    setHeight(newHeight);
    setDepth(newDepth);

    const updatedCustomParams = recalculateCustomParameters(newWidth, newHeight, newDepth);
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

  const evaluateExpression = (expression: string): number => {
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
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch {
      return 0;
    }
  };

  const updateCustomParameter = (id: string, field: keyof CustomParameter, value: string) => {
    const updatedParams = customParameters.map((param) => {
      if (param.id === id) {
        const updated = { ...param, [field]: value };
        if (field === 'expression') {
          updated.result = evaluateExpression(value);
        }
        return updated;
      }
      return param;
    });
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

  const deleteCustomParameter = (id: string) => {
    const updatedParams = customParameters.filter((param) => param.id !== id);
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

  const applyChanges = async () => {
    if (!selectedShape) return;

    console.log('📐 Applying parameter changes...');
    console.log('Shape type:', selectedShape.type);
    console.log('New dimensions:', { width, height, depth });

    const evaluateVertexExpression = (expr: string): number => {
      try {
        let evalExpr = expr
          .replace(/\bW\b/g, width.toString())
          .replace(/\bH\b/g, height.toString())
          .replace(/\bD\b/g, depth.toString());

        customParameters.forEach((p) => {
          const regex = new RegExp(`\\b${p.name}\\b`, 'g');
          evalExpr = evalExpr.replace(regex, p.result.toString());
        });

        const sanitized = evalExpr.replace(/[^0-9+\-*/().\s]/g, '');
        const result = Function(`"use strict"; return (${sanitized})`)();
        return typeof result === 'number' && !isNaN(result) ? result : 0;
      } catch {
        return 0;
      }
    };

    try {
      const { getBoxVertices, getReplicadVertices } = await import('../services/vertexEditor');
      let newBaseVertices: THREE.Vector3[] = [];
      let currentBaseVertices: THREE.Vector3[] = [];

      const currentWidth = selectedShape.parameters.width;
      const currentHeight = selectedShape.parameters.height;
      const currentDepth = selectedShape.parameters.depth;

      const scaleX = width / currentWidth;
      const scaleY = height / currentHeight;
      const scaleZ = depth / currentDepth;

      const dimensionsChanged = width !== currentWidth || height !== currentHeight || depth !== currentDepth;

      console.log('📐 Dimension changes:', {
        current: { w: currentWidth, h: currentHeight, d: currentDepth },
        new: { w: width, h: height, d: depth },
        scale: { x: scaleX, y: scaleY, z: scaleZ },
        changed: dimensionsChanged
      });

      if (selectedShape.parameters.scaledBaseVertices && selectedShape.parameters.scaledBaseVertices.length > 0) {
        console.log('🔍 Using existing scaled base vertices');
        currentBaseVertices = selectedShape.parameters.scaledBaseVertices.map((v: number[]) =>
          new THREE.Vector3(v[0], v[1], v[2])
        );

        if (dimensionsChanged) {
          console.log('📏 Scaling base vertices from current by:', { scaleX, scaleY, scaleZ });
          newBaseVertices = currentBaseVertices.map(v =>
            new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)
          );
        } else {
          newBaseVertices = currentBaseVertices;
        }
      } else if (selectedShape.replicadShape) {
        console.log('🔍 Using replicadShape for initial base vertices');
        currentBaseVertices = await getReplicadVertices(selectedShape.replicadShape);

        if (dimensionsChanged) {
          console.log('📏 Scaling base vertices from replicad by:', { scaleX, scaleY, scaleZ });
          newBaseVertices = currentBaseVertices.map(v =>
            new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)
          );
        } else {
          newBaseVertices = currentBaseVertices;
        }
      } else if (selectedShape.type === 'box') {
        console.log('📦 Calculating base vertices from box parameters');
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

        const expression = mod.expression;
        const offsetValue = evaluateVertexExpression(expression);
        const axisIndex = mod.direction.startsWith('x') ? 0 : mod.direction.startsWith('y') ? 1 : 2;

        const finalPos = vertexFinalPositions.get(mod.vertexIndex)!;
        finalPos[axisIndex] = offsetValue;
      });

      const updatedVertexMods = vertexModifications.map((mod: any) => {
        const newOriginalPos = newBaseVertices[mod.vertexIndex]
          ? [newBaseVertices[mod.vertexIndex].x, newBaseVertices[mod.vertexIndex].y, newBaseVertices[mod.vertexIndex].z] as [number, number, number]
          : mod.originalPosition;

        const expression = mod.expression;
        const offsetValue = evaluateVertexExpression(expression);
        const axisIndex = mod.direction.startsWith('x') ? 0 : mod.direction.startsWith('y') ? 1 : 2;

        const finalPos = vertexFinalPositions.get(mod.vertexIndex)!;
        const offsetAmount = finalPos[axisIndex] - newOriginalPos[axisIndex];
        const newOffset = [0, 0, 0] as [number, number, number];
        newOffset[axisIndex] = offsetAmount;

        const axisName = mod.direction.startsWith('x') ? 'X' : mod.direction.startsWith('y') ? 'Y' : 'Z';
        const directionSymbol = mod.direction[1] === '+' ? '+' : '-';

        console.log(`📍 Vertex ${mod.vertexIndex} dimension update:`, {
          vertexIndex: mod.vertexIndex,
          direction: mod.direction,
          axis: axisName,
          newBaseVertex: `[${newOriginalPos[0].toFixed(1)}, ${newOriginalPos[1].toFixed(1)}, ${newOriginalPos[2].toFixed(1)}]`,
          expression,
          offsetValue: offsetValue.toFixed(1),
          offsetAmount: offsetAmount.toFixed(1),
          finalPosition: `[${finalPos[0].toFixed(1)}, ${finalPos[1].toFixed(1)}, ${finalPos[2].toFixed(1)}]`,
          explanation: `${axisName}${directionSymbol} → move to ${offsetValue} (offset: ${offsetAmount.toFixed(1)})`
        });

        return {
          ...mod,
          originalPosition: newOriginalPos,
          newPosition: finalPos,
          offset: newOffset,
          expression
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

      console.log('📝 Updating shape parameters and vertex modifications:', {
        vertexModsCount: updatedVertexMods.length,
        preservingGeometry: !!selectedShape.geometry,
        preservingReplicadShape: !!selectedShape.replicadShape,
        dimensionsChanged,
        geometryScaled: dimensionsChanged
      });

      let updateData: any = {
        parameters: {
          ...selectedShape.parameters,
          width,
          height,
          depth,
          customParameters,
          scaledBaseVertices: newBaseVertices.length > 0 ?
            newBaseVertices.map(v => [v.x, v.y, v.z]) :
            (selectedShape.parameters.scaledBaseVertices || undefined)
        },
        vertexModifications: updatedVertexMods
      };

      if (dimensionsChanged && scaledGeometry) {
        updateData.geometry = scaledGeometry;
      }

      if (selectedShape.subtractionRegion) {
        console.log('📐 Shape has subtraction region, checking for updates...');

        const subtractionPosChanged =
          subtractionX !== selectedShape.subtractionRegion.position[0] ||
          subtractionY !== selectedShape.subtractionRegion.position[1] ||
          subtractionZ !== selectedShape.subtractionRegion.position[2];

        const subtractionSizeChanged =
          subtractionSizeX !== selectedShape.subtractionRegion.size[0] ||
          subtractionSizeY !== selectedShape.subtractionRegion.size[1] ||
          subtractionSizeZ !== selectedShape.subtractionRegion.size[2];

        const subtractionDirChanged =
          subtractionDirX !== selectedShape.subtractionRegion.growthDirection.x ||
          subtractionDirY !== selectedShape.subtractionRegion.growthDirection.y ||
          subtractionDirZ !== selectedShape.subtractionRegion.growthDirection.z;

        const subtractionChanged = subtractionPosChanged || subtractionSizeChanged || subtractionDirChanged || dimensionsChanged;

        updateData.subtractionRegion = {
          ...selectedShape.subtractionRegion,
          position: [subtractionX, subtractionY, subtractionZ],
          size: [subtractionSizeX, subtractionSizeY, subtractionSizeZ],
          growthDirection: {
            x: subtractionDirX,
            y: subtractionDirY,
            z: subtractionDirZ
          }
        };

        if (subtractionChanged) {
          console.log('🔄 Subtraction region or base dimensions changed, reapplying cut...');
          console.log('Current subtraction state:', {
            position: [subtractionX, subtractionY, subtractionZ],
            size: [subtractionSizeX, subtractionSizeY, subtractionSizeZ],
            growthDirection: { x: subtractionDirX, y: subtractionDirY, z: subtractionDirZ }
          });

          try {
            const { performBooleanCut, convertReplicadToThreeGeometry } = await import('../services/replicad');
            const { getReplicadVertices } = await import('../services/vertexEditor');

            const cuttingShapeId = selectedShape.subtractionRegion.cuttingShapeId;
            const cuttingShape = cuttingShapeId ? shapes.find(s => s.id === cuttingShapeId) : null;

            if (cuttingShape?.replicadShape && selectedShape.originalReplicadShape) {
              console.log('🎯 Found hidden cutting shape, using it for boolean operation');
              const originalCuttingSize = cuttingShape.parameters?.width && cuttingShape.parameters?.height && cuttingShape.parameters?.depth
                ? [cuttingShape.parameters.width, cuttingShape.parameters.height, cuttingShape.parameters.depth]
                : [1, 1, 1];

              const adjustedScale: [number, number, number] = [
                subtractionSizeX / originalCuttingSize[0],
                subtractionSizeY / originalCuttingSize[1],
                subtractionSizeZ / originalCuttingSize[2]
              ];

              console.log('📐 Scale calculation:', {
                originalCuttingSize,
                newSize: [subtractionSizeX, subtractionSizeY, subtractionSizeZ],
                adjustedScale
              });

              const adjustedPosition: [number, number, number] = [
                selectedShape.position[0] + (subtractionDirX === '+' ? subtractionX : -subtractionX),
                selectedShape.position[1] + (subtractionDirY === '+' ? subtractionY : -subtractionY),
                selectedShape.position[2] + (subtractionDirZ === '+' ? subtractionZ : -subtractionZ)
              ];

              console.log('📍 Position calculation:', {
                basePosition: selectedShape.position,
                offset: [subtractionX, subtractionY, subtractionZ],
                direction: [subtractionDirX, subtractionDirY, subtractionDirZ],
                adjustedPosition
              });

              const resultShape = await performBooleanCut(
                selectedShape.originalReplicadShape,
                cuttingShape.replicadShape,
                selectedShape.position,
                adjustedPosition,
                selectedShape.rotation,
                cuttingShape.rotation,
                dimensionsChanged ? [scaleX, scaleY, scaleZ] : selectedShape.scale,
                adjustedScale
              );

              const newGeometry = convertReplicadToThreeGeometry(resultShape);
              const newBaseVertices = await getReplicadVertices(resultShape);

              updateData.geometry = newGeometry;
              updateData.replicadShape = resultShape;
              updateData.parameters.scaledBaseVertices = newBaseVertices.map(v => [v.x, v.y, v.z]);

              console.log('✅ Reapplied cut with updated parameters using hidden cutting shape');
            } else {
              console.log('⚠️ Cutting shape not found, keeping current geometry');
            }
          } catch (error) {
            console.error('⚠️ Failed to reapply cut:', error);
          }
        } else {
          console.log('📦 Subtraction region parameters updated, no geometry recalculation needed');
        }
      }

      updateShape(selectedShape.id, updateData);

      console.log('✅ Parameters applied successfully - geometry' + (dimensionsChanged ? ' scaled' : ' preserved'));
    } catch (error) {
      console.error('❌ Failed to update parameters:', error);

      updateShape(selectedShape.id, {
        parameters: {
          ...selectedShape.parameters,
          width,
          height,
          depth,
          customParameters,
        },
        vertexModifications: updatedVertexMods
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

            {selectedShape.subtractionRegion && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <div className="text-xs font-semibold text-stone-700 mb-2">Kesim Bölgesi - Pozisyon</div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="X"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={parseFloat(subtractionX.toFixed(2))}
                    onChange={(e) => setSubtractionX(Number(e.target.value))}
                    step="0.1"
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={parseFloat(subtractionX.toFixed(2))}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <button
                    onClick={() => setSubtractionDirX(subtractionDirX === '+' ? '-' : '+')}
                    className={`w-10 px-2 py-1 text-xs font-semibold rounded transition-colors ${
                      subtractionDirX === '+'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                    title="Büyüme yönü"
                  >
                    {subtractionDirX}
                  </button>
                  <input
                    type="text"
                    value="X Position"
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
                    value={parseFloat(subtractionY.toFixed(2))}
                    onChange={(e) => setSubtractionY(Number(e.target.value))}
                    step="0.1"
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={parseFloat(subtractionY.toFixed(2))}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <button
                    onClick={() => setSubtractionDirY(subtractionDirY === '+' ? '-' : '+')}
                    className={`w-10 px-2 py-1 text-xs font-semibold rounded transition-colors ${
                      subtractionDirY === '+'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                    title="Büyüme yönü"
                  >
                    {subtractionDirY}
                  </button>
                  <input
                    type="text"
                    value="Y Position"
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
                    value={parseFloat(subtractionZ.toFixed(2))}
                    onChange={(e) => setSubtractionZ(Number(e.target.value))}
                    step="0.1"
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={parseFloat(subtractionZ.toFixed(2))}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <button
                    onClick={() => setSubtractionDirZ(subtractionDirZ === '+' ? '-' : '+')}
                    className={`w-10 px-2 py-1 text-xs font-semibold rounded transition-colors ${
                      subtractionDirZ === '+'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                    title="Büyüme yönü"
                  >
                    {subtractionDirZ}
                  </button>
                  <input
                    type="text"
                    value="Z Position"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>

                <div className="text-xs font-semibold text-stone-700 mt-3 mb-2">Kesim Bölgesi - Boyut</div>

                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value="X"
                    readOnly
                    className="w-10 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-stone-50 text-stone-700 text-center"
                  />
                  <input
                    type="number"
                    value={parseFloat(subtractionSizeX.toFixed(2))}
                    onChange={(e) => setSubtractionSizeX(Number(e.target.value))}
                    step="0.1"
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={parseFloat(subtractionSizeX.toFixed(2))}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="X Size"
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
                    value={parseFloat(subtractionSizeY.toFixed(2))}
                    onChange={(e) => setSubtractionSizeY(Number(e.target.value))}
                    step="0.1"
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={parseFloat(subtractionSizeY.toFixed(2))}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Y Size"
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
                    value={parseFloat(subtractionSizeZ.toFixed(2))}
                    onChange={(e) => setSubtractionSizeZ(Number(e.target.value))}
                    step="0.1"
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <input
                    type="text"
                    value={parseFloat(subtractionSizeZ.toFixed(2))}
                    readOnly
                    className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                  <input
                    type="text"
                    value="Z Size"
                    readOnly
                    className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
                  />
                </div>
              </div>
            )}

            {vertexModifications.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                {vertexModifications.map((mod: any, idx: number) => {
                  const currentValue = mod.direction.startsWith('x') ? mod.newPosition[0] :
                                       mod.direction.startsWith('y') ? mod.newPosition[1] :
                                       mod.newPosition[2];

                  const evaluateVertexExpression = (expr: string): number => {
                    try {
                      let evalExpr = expr
                        .replace(/\bW\b/g, width.toString())
                        .replace(/\bH\b/g, height.toString())
                        .replace(/\bD\b/g, depth.toString());

                      customParameters.forEach((p) => {
                        const regex = new RegExp(`\\b${p.name}\\b`, 'g');
                        evalExpr = evalExpr.replace(regex, p.result.toString());
                      });

                      const sanitized = evalExpr.replace(/[^0-9+\-*/().\s]/g, '');
                      const result = Function(`"use strict"; return (${sanitized})`)();
                      return typeof result === 'number' && !isNaN(result) ? result : currentValue;
                    } catch {
                      return currentValue;
                    }
                  };

                  const expression = mod.expression || String(currentValue);
                  const result = evaluateVertexExpression(expression);

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
