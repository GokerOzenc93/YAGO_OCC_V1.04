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
    } else {
      setWidth(0);
      setHeight(0);
      setDepth(0);
      setCustomParameters([]);
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

    try {
      const { createReplicadBox, createReplicadCylinder, convertReplicadToThreeGeometry } = await import('../services/replicad');

      let newGeometry: THREE.BufferGeometry | null = null;
      let newReplicadShape: any = null;

      if (selectedShape.type === 'box' && width > 0 && height > 0 && depth > 0) {
        console.log('🔄 Regenerating box geometry...');
        newReplicadShape = await createReplicadBox({ width, height, depth });
        newGeometry = convertReplicadToThreeGeometry(newReplicadShape);

        const vertexMods = selectedShape.parameters.vertexModifications || [];
        if (vertexMods.length > 0) {
          console.log(`🔧 Reapplying ${vertexMods.length} vertex modifications...`);

          const positionAttr = newGeometry.getAttribute('position');
          const positions = positionAttr.array as Float32Array;

          const w = width / 2;
          const h = height / 2;
          const d = depth / 2;

          const boxVertices = [
            [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d],
            [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d],
          ];

          vertexMods.forEach((mod: any) => {
            const baseVertex = boxVertices[mod.vertexIndex];
            if (!baseVertex) return;

            const targetVertex = [
              mod.x !== undefined ? mod.x : baseVertex[0],
              mod.y !== undefined ? mod.y : baseVertex[1],
              mod.z !== undefined ? mod.z : baseVertex[2],
            ];

            for (let i = 0; i < positions.length; i += 3) {
              const vx = positions[i];
              const vy = positions[i + 1];
              const vz = positions[i + 2];

              const matches =
                Math.abs(vx - baseVertex[0]) < 1 &&
                Math.abs(vy - baseVertex[1]) < 1 &&
                Math.abs(vz - baseVertex[2]) < 1;

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

          console.log('✅ Vertex modifications reapplied');
        }

        console.log('✅ Box geometry regenerated');
      } else if (selectedShape.type === 'cylinder' && selectedShape.parameters.radius && height > 0) {
        console.log('🔄 Regenerating cylinder geometry...');
        const radius = selectedShape.parameters.radius;
        newReplicadShape = await createReplicadCylinder({ radius, height });
        newGeometry = convertReplicadToThreeGeometry(newReplicadShape);
        console.log('✅ Cylinder geometry regenerated');
      }

      console.log('📝 Updating shape with new parameters');

      updateShape(selectedShape.id, {
        parameters: {
          ...selectedShape.parameters,
          width,
          height,
          depth,
          customParameters,
        },
        ...(newGeometry && { geometry: newGeometry }),
        ...(newReplicadShape && { replicadShape: newReplicadShape })
      });

      console.log('✅ Parameters applied successfully');
    } catch (error) {
      console.error('❌ Failed to regenerate geometry:', error);

      updateShape(selectedShape.id, {
        parameters: {
          ...selectedShape.parameters,
          width,
          height,
          depth,
          customParameters,
        }
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

            {selectedShape?.parameters?.vertexModifications && selectedShape.parameters.vertexModifications.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-200 mt-2">
                <div className="text-xs font-semibold text-stone-700 mb-1">Vertex Modifications</div>
                {selectedShape.parameters.vertexModifications.map((mod: any, idx: number) => (
                  <div key={idx} className="flex gap-1 items-center text-xs">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
                      V{mod.vertexIndex}
                    </span>
                    {mod.x !== undefined && (
                      <span className="px-2 py-1 bg-red-50 text-red-600 rounded">
                        X: {mod.x.toFixed(1)}
                      </span>
                    )}
                    {mod.y !== undefined && (
                      <span className="px-2 py-1 bg-green-50 text-green-600 rounded">
                        Y: {mod.y.toFixed(1)}
                      </span>
                    )}
                    {mod.z !== undefined && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">
                        Z: {mod.z.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
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
