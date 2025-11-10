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
    showCuttingBoxes,
    setShowCuttingBoxes
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
  const [netDimensions, setNetDimensions] = useState<{[key: string]: string}>({});
  const [pendingCutChanges, setPendingCutChanges] = useState<{[key: string]: any}>({});
  const [intersectionVolumes, setIntersectionVolumes] = useState<{[key: string]: number}>({});

  const calculateIntersectionVolume = (cut: any): number => {
    if (!cut.width || !cut.height || !cut.depth) return 0;
    return cut.width * cut.height * cut.depth;
  };

  const handleIntersectionChange = (shapeIdx: number, field: string, value: number) => {
    if (!selectedShape || !selectedShape.parameters.subtractedShapes) {
      return;
    }

    const updatedSubtractedShapes = [...selectedShape.parameters.subtractedShapes];
    const currentCut = updatedSubtractedShapes[shapeIdx];

    const currentIntersectionW = currentCut.intersectionWidth || 0;
    const currentIntersectionH = currentCut.intersectionHeight || 0;
    const currentIntersectionD = currentCut.intersectionDepth || 0;

    let newWidth = currentCut.width || 0;
    let newHeight = currentCut.height || 0;
    let newDepth = currentCut.depth || 0;
    let newPosition = [...(currentCut.position || [0, 0, 0])];

    if (field === 'intersectionWidth') {
      const delta = value - currentIntersectionW;
      newWidth += delta;
      newPosition[0] -= delta / 2;
    } else if (field === 'intersectionHeight') {
      const delta = value - currentIntersectionH;
      newHeight += delta;
      newPosition[1] -= delta / 2;
    } else if (field === 'intersectionDepth') {
      const delta = value - currentIntersectionD;
      newDepth += delta;
      newPosition[2] -= delta / 2;
    }

    updatedSubtractedShapes[shapeIdx] = {
      ...currentCut,
      [field]: value,
      width: newWidth,
      height: newHeight,
      depth: newDepth,
      position: newPosition
    };

    const volume = calculateIntersectionVolume(updatedSubtractedShapes[shapeIdx]);
    setIntersectionVolumes(prev => ({
      ...prev,
      [shapeIdx]: volume
    }));

    setPendingCutChanges(prev => ({
      ...prev,
      [shapeIdx]: updatedSubtractedShapes[shapeIdx]
    }));

    updateShape(selectedShape.id, {
      parameters: {
        ...selectedShape.parameters,
        subtractedShapes: updatedSubtractedShapes
      }
    });
  };

  const applyPendingChanges = async () => {
    if (!selectedShape || Object.keys(pendingCutChanges).length === 0) return;

    console.log('🔄 Applying pending cut changes...');

    try {
      const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('../services/replicad');
      const { getReplicadVertices } = await import('../services/vertexEditor');

      let resultShape;
      if (selectedShape.type === 'box') {
        resultShape = await createReplicadBox({
          width: selectedShape.parameters.width || 100,
          height: selectedShape.parameters.height || 100,
          depth: selectedShape.parameters.depth || 100
        });
      } else {
        console.warn('⚠️ Only box type is currently supported');
        return;
      }

      const subtractedShapes = selectedShape.parameters.subtractedShapes || [];

      for (let i = 0; i < subtractedShapes.length; i++) {
        const cut = subtractedShapes[i];

        const cuttingShape = await createReplicadBox({
          width: Math.max(cut.width || 0, 0.1),
          height: Math.max(cut.height || 0, 0.1),
          depth: Math.max(cut.depth || 0, 0.1)
        });

        resultShape = await performBooleanCut(
          resultShape,
          cuttingShape,
          [0, 0, 0],
          cut.position || [0, 0, 0],
          [0, 0, 0],
          cut.rotation || [0, 0, 0],
          [1, 1, 1],
          [1, 1, 1]
        );
      }

      const newGeometry = convertReplicadToThreeGeometry(resultShape);
      newGeometry.computeVertexNormals();
      newGeometry.computeBoundingBox();
      newGeometry.computeBoundingSphere();

      const newBaseVertices = await getReplicadVertices(resultShape);

      updateShape(selectedShape.id, {
        geometry: newGeometry,
        replicadShape: resultShape,
        parameters: {
          ...selectedShape.parameters,
          scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z]),
          modified: Date.now()
        }
      });

      setPendingCutChanges({});
      console.log('✅ Changes applied successfully');
    } catch (error) {
      console.error('❌ Failed to apply changes:', error);
    }
  };

  useEffect(() => {
    console.log('Parameters Panel - Selected Shape:', {
      selectedShapeId,
      shapesCount: shapes.length,
      selectedShape: selectedShape ? {
        id: selectedShape.id,
        type: selectedShape.type,
        parameters: selectedShape.parameters,
        subtractedShapes: selectedShape.parameters?.subtractedShapes
      } : null
    });

    if (selectedShape && selectedShape.parameters) {
      console.log('📦 Subtracted Shapes in Parameters Panel:', selectedShape.parameters.subtractedShapes);
      setWidth(selectedShape.parameters.width || 0);
      setHeight(selectedShape.parameters.height || 0);
      setDepth(selectedShape.parameters.depth || 0);
      setCustomParameters(selectedShape.parameters.customParameters || []);
      setVertexModifications(selectedShape.vertexModifications || []);

      if (selectedShape.parameters.subtractedShapes) {
        const volumes: {[key: string]: number} = {};
        selectedShape.parameters.subtractedShapes.forEach((cut: any, idx: number) => {
          volumes[idx] = calculateIntersectionVolume(cut);
        });
        setIntersectionVolumes(volumes);
      }
    } else {
      setWidth(0);
      setHeight(0);
      setDepth(0);
      setCustomParameters([]);
      setVertexModifications([]);
      setIntersectionVolumes({});
    }
  }, [selectedShape, selectedShapeId, shapes]);


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

    if (Object.keys(pendingCutChanges).length > 0) {
      console.log('✂️ Applying pending cut changes...');
      for (const [cutKey, changes] of Object.entries(pendingCutChanges)) {
        const shapeIdx = parseInt(cutKey);
        if (changes.intersectionWidth !== undefined) {
          await handleIntersectionChange(shapeIdx, 'intersectionWidth', parseFloat(changes.intersectionWidth as string) || 0);
        }
        if (changes.intersectionHeight !== undefined) {
          await handleIntersectionChange(shapeIdx, 'intersectionHeight', parseFloat(changes.intersectionHeight as string) || 0);
        }
        if (changes.intersectionDepth !== undefined) {
          await handleIntersectionChange(shapeIdx, 'intersectionDepth', parseFloat(changes.intersectionDepth as string) || 0);
        }
      }
      setPendingCutChanges({});
      console.log('✅ Cut changes applied');
      return;
    }

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
      const { getBoxVertices } = await import('../services/vertexEditor');

      let newBaseVertices: THREE.Vector3[] = [];

      const currentWidth = selectedShape.parameters.width;
      const currentHeight = selectedShape.parameters.height;
      const currentDepth = selectedShape.parameters.depth;

      const dimensionsChanged = width !== currentWidth || height !== currentHeight || depth !== currentDepth;

      console.log('📐 Dimension changes:', {
        current: { w: currentWidth, h: currentHeight, d: currentDepth },
        new: { w: width, h: height, d: depth },
        changed: dimensionsChanged
      });

      if (selectedShape.baseVerticesSnapshot && selectedShape.baseDimensions) {
        console.log('📸 Using baseVerticesSnapshot for stable scaling');

        const baseWidth = selectedShape.baseDimensions.width;
        const baseHeight = selectedShape.baseDimensions.height;
        const baseDepth = selectedShape.baseDimensions.depth;

        const scaleX = width / baseWidth;
        const scaleY = height / baseHeight;
        const scaleZ = depth / baseDepth;

        console.log('📏 Scaling from snapshot:', {
          base: selectedShape.baseDimensions,
          scale: { x: scaleX, y: scaleY, z: scaleZ }
        });

        newBaseVertices = selectedShape.baseVerticesSnapshot.map(v =>
          new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)
        );
      } else if (selectedShape.type === 'box') {
        console.log('📦 Using box geometry');
        newBaseVertices = getBoxVertices(width, height, depth);
      } else {
        console.warn('⚠️ No baseVerticesSnapshot available, extracting from geometry');
        if (selectedShape.geometry) {
          const positionAttr = selectedShape.geometry.getAttribute('position');
          if (positionAttr) {
            const uniqueVerts = new Map<string, THREE.Vector3>();
            for (let i = 0; i < positionAttr.count; i++) {
              const x = Math.round(positionAttr.getX(i) * 100) / 100;
              const y = Math.round(positionAttr.getY(i) * 100) / 100;
              const z = Math.round(positionAttr.getZ(i) * 100) / 100;
              const key = `${x},${y},${z}`;
              if (!uniqueVerts.has(key)) {
                uniqueVerts.set(key, new THREE.Vector3(x, y, z));
              }
            }
            newBaseVertices = Array.from(uniqueVerts.values()).sort((a, b) => {
              if (Math.abs(a.z - b.z) > 0.01) return a.z - b.z;
              if (Math.abs(a.y - b.y) > 0.01) return a.y - b.y;
              return a.x - b.x;
            });
          }
        }
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

      if (dimensionsChanged) {
        if (selectedShape.baseGeometrySnapshot && selectedShape.baseDimensions) {
          const scaleX = width / selectedShape.baseDimensions.width;
          const scaleY = height / selectedShape.baseDimensions.height;
          const scaleZ = depth / selectedShape.baseDimensions.depth;

          console.log('📏 Scaling from baseGeometrySnapshot by:', { scaleX, scaleY, scaleZ });
          scaledGeometry = selectedShape.baseGeometrySnapshot.clone();
          scaledGeometry.scale(scaleX, scaleY, scaleZ);
          scaledGeometry.computeVertexNormals();
          scaledGeometry.computeBoundingBox();
          scaledGeometry.computeBoundingSphere();
        } else if (selectedShape.geometry) {
          const scaleX = width / currentWidth;
          const scaleY = height / currentHeight;
          const scaleZ = depth / currentDepth;

          console.log('📏 Scaling current geometry by:', { scaleX, scaleY, scaleZ });
          scaledGeometry = selectedShape.geometry.clone();
          scaledGeometry.scale(scaleX, scaleY, scaleZ);
          scaledGeometry.computeVertexNormals();
          scaledGeometry.computeBoundingBox();
          scaledGeometry.computeBoundingSphere();
        }
      }

      console.log('📝 Updating shape parameters and vertex modifications:', {
        vertexModsCount: updatedVertexMods.length,
        preservingGeometry: !!selectedShape.geometry,
        preservingReplicadShape: !!selectedShape.replicadShape,
        dimensionsChanged,
        geometryScaled: dimensionsChanged
      });

      updateShape(selectedShape.id, {
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
        vertexModifications: updatedVertexMods,
        ...(dimensionsChanged && scaledGeometry && { geometry: scaledGeometry })
      });

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
            className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded transition-colors ${
              vertexEditMode
                ? 'bg-orange-600 text-white'
                : 'bg-stone-200 text-slate-700 hover:bg-stone-300'
            }`}
            title="Edit Vertices"
          >
            V
          </button>
          <button
            onClick={() => setShowCuttingBoxes(!showCuttingBoxes)}
            className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded transition-colors ${
              showCuttingBoxes
                ? 'bg-red-600 text-white'
                : 'bg-stone-200 text-slate-700 hover:bg-stone-300'
            }`}
            title="Show Cutting Boxes"
          >
            B
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

      <div className="p-3 overflow-y-auto max-h-[150mm] scrollbar-thin">
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

            {(() => {
              const hasSubtractedShapes = selectedShape.parameters.subtractedShapes && selectedShape.parameters.subtractedShapes.length > 0;
              console.log('🔍 Rendering subtracted shapes section:', {
                hasSubtractedShapes,
                subtractedShapes: selectedShape.parameters.subtractedShapes,
                parameters: selectedShape.parameters
              });
              return hasSubtractedShapes;
            })() && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Subtracted Shapes ({selectedShape.parameters.subtractedShapes.length})
                  </div>
                  {Object.keys(pendingCutChanges).length > 0 && (
                    <button
                      onClick={applyPendingChanges}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Check size={12} />
                      Apply Changes
                    </button>
                  )}
                </div>
                {selectedShape.parameters.subtractedShapes.map((subtractedShape: any, shapeIdx: number) => {
                  const cutKey = `${shapeIdx}`;
                  const pendingCut = pendingCutChanges[cutKey] || {};
                  const hasPendingChanges = !!pendingCutChanges[cutKey];

                  return (
                  <div key={subtractedShape.id || shapeIdx} className={`space-y-1 p-2 rounded ${hasPendingChanges ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
                    <div className="text-xs font-medium text-stone-600 mb-1">
                      Cut {shapeIdx + 1} {hasPendingChanges && <span className="text-yellow-600">(modified)</span>}
                    </div>

                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={`C${shapeIdx + 1}W`}
                        readOnly
                        className="w-12 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-white text-stone-700 text-center"
                      />
                      <input
                        type="number"
                        value={pendingCut.intersectionWidth ?? (subtractedShape.intersectionWidth || 0)}
                        onChange={(e) => {
                          const inputValue = parseFloat(e.target.value) || 0;
                          handleIntersectionChange(shapeIdx, 'intersectionWidth', inputValue);
                        }}
                        className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <input
                        type="text"
                        value={`Intersection: ${(intersectionVolumes[shapeIdx] || 0).toFixed(0)} mm³`}
                        readOnly
                        className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-red-50 text-red-700 font-medium"
                      />
                    </div>

                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={`C${shapeIdx + 1}H`}
                        readOnly
                        className="w-12 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-white text-stone-700 text-center"
                      />
                      <input
                        type="number"
                        value={pendingCut.intersectionHeight ?? (subtractedShape.intersectionHeight || 0)}
                        onChange={(e) => {
                          const inputValue = parseFloat(e.target.value) || 0;
                          handleIntersectionChange(shapeIdx, 'intersectionHeight', inputValue);
                        }}
                        className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-600"
                      />
                    </div>

                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={`C${shapeIdx + 1}D`}
                        readOnly
                        className="w-12 px-2 py-1 text-xs font-medium border border-stone-300 rounded bg-white text-stone-700 text-center"
                      />
                      <input
                        type="number"
                        value={pendingCut.intersectionDepth ?? (subtractedShape.intersectionDepth || 0)}
                        onChange={(e) => {
                          const inputValue = parseFloat(e.target.value) || 0;
                          handleIntersectionChange(shapeIdx, 'intersectionDepth', inputValue);
                        }}
                        className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-600"
                      />
                    </div>
                  </div>
                )})}
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
