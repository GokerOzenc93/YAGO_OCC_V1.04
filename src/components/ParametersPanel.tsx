import { useState, useEffect } from 'react';
import { X, GripVertical, Plus, Check } from 'lucide-react';
import { useAppStore } from '../store';
import * as THREE from 'three';
import { ParameterRow } from './ParameterRow';
import { SubtractionParametersPanel } from './SubtractionParametersPanel';
import { evaluateExpression } from '../utils/expression';
import { applyShapeChanges, applySubtractionChanges } from '../services/shapeUpdater';

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
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotZ, setRotZ] = useState(0);
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [vertexModifications, setVertexModifications] = useState<any[]>([]);

  const [subWidth, setSubWidth] = useState(0);
  const [subHeight, setSubHeight] = useState(0);
  const [subDepth, setSubDepth] = useState(0);
  const [subPosX, setSubPosX] = useState(0);
  const [subPosY, setSubPosY] = useState(0);
  const [subPosZ, setSubPosZ] = useState(0);
  const [subRotX, setSubRotX] = useState(0);
  const [subRotY, setSubRotY] = useState(0);
  const [subRotZ, setSubRotZ] = useState(0);

  useEffect(() => {
    if (!selectedShape || selectedSubtractionIndex === null || !selectedShape.subtractionGeometries) return;
    if (subWidth === 0 && subHeight === 0 && subDepth === 0) return;

    const newSubGeometry = new THREE.BoxGeometry(subWidth, subHeight, subDepth);
    const currentSubtraction = selectedShape.subtractionGeometries[selectedSubtractionIndex];

    const updatedSubtraction = {
      ...currentSubtraction,
      geometry: newSubGeometry,
      relativeOffset: [subPosX, subPosY, subPosZ] as [number, number, number],
      relativeRotation: [
        subRotX * (Math.PI / 180),
        subRotY * (Math.PI / 180),
        subRotZ * (Math.PI / 180)
      ] as [number, number, number]
    };

    const updatedSubtractions = selectedShape.subtractionGeometries.map((sub, idx) =>
      idx === selectedSubtractionIndex ? updatedSubtraction : sub
    );

    updateShape(selectedShape.id, {
      subtractionGeometries: updatedSubtractions
    });
  }, [subWidth, subHeight, subDepth, subPosX, subPosY, subPosZ, subRotX, subRotY, subRotZ, selectedShape?.id, selectedSubtractionIndex]);

  useEffect(() => {
    if (selectedShape && selectedShape.parameters) {
      setWidth(selectedShape.parameters.width || 0);
      setHeight(selectedShape.parameters.height || 0);
      setDepth(selectedShape.parameters.depth || 0);
      setRotX((selectedShape.rotation?.[0] || 0) * (180 / Math.PI));
      setRotY((selectedShape.rotation?.[1] || 0) * (180 / Math.PI));
      setRotZ((selectedShape.rotation?.[2] || 0) * (180 / Math.PI));
      setCustomParameters(selectedShape.parameters.customParameters || []);
      setVertexModifications(selectedShape.vertexModifications || []);
    } else {
      setWidth(0);
      setHeight(0);
      setDepth(0);
      setRotX(0);
      setRotY(0);
      setRotZ(0);
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
        box.getSize(size);

        const round = (n: number) => Math.round(n * 100) / 100;

        setSubWidth(round(size.x));
        setSubHeight(round(size.y));
        setSubDepth(round(size.z));
        setSubPosX(round(subtraction.relativeOffset[0]));
        setSubPosY(round(subtraction.relativeOffset[1]));
        setSubPosZ(round(subtraction.relativeOffset[2]));
        setSubRotX(round((subtraction.relativeRotation?.[0] || 0) * (180 / Math.PI)));
        setSubRotY(round((subtraction.relativeRotation?.[1] || 0) * (180 / Math.PI)));
        setSubRotZ(round((subtraction.relativeRotation?.[2] || 0) * (180 / Math.PI)));
      }
    }
  }, [selectedShape?.id, selectedSubtractionIndex, selectedShape?.subtractionGeometries?.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', value: number) => {
    if (dimension === 'width') setWidth(value);
    if (dimension === 'height') setHeight(value);
    if (dimension === 'depth') setDepth(value);
  };

  const addCustomParameter = () => {
    const newParam: CustomParameter = {
      id: `param-${Date.now()}`,
      name: `P${customParameters.length + 1}`,
      expression: '0',
      result: 0,
      description: 'Custom Parameter'
    };
    const updatedParams = [...customParameters, newParam];
    setCustomParameters(updatedParams);

    if (selectedShape) {
      updateShape(selectedShape.id, {
        parameters: { ...selectedShape.parameters, customParameters: updatedParams }
      });
    }
  };

  const updateCustomParameter = (id: string, field: keyof CustomParameter, value: string) => {
    const evalContext = {
      W: width,
      H: height,
      D: depth,
      ...customParameters.reduce((acc, param) => ({ ...acc, [param.name]: param.result }), {})
    };

    const updatedParams = customParameters.map((param) => {
      if (param.id !== id) return param;
      const updated = { ...param, [field]: value };
      if (field === 'expression') {
        updated.result = evaluateExpression(value, evalContext);
      }
      return updated;
    });
    setCustomParameters(updatedParams);

    if (selectedShape) {
      updateShape(selectedShape.id, {
        parameters: { ...selectedShape.parameters, customParameters: updatedParams }
      });
    }
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

  const updateVertexModification = (index: number, field: string, value: any) => {
    const evalContext = {
      W: width,
      H: height,
      D: depth,
      ...customParameters.reduce((acc, param) => {
        acc[param.name] = param.result;
        return acc;
      }, {} as Record<string, number>)
    };

    const updatedMods = vertexModifications.map((mod, idx) => {
      if (idx !== index) return mod;

      const updated = { ...mod, [field]: value };

      if (field === 'expression') {
        const result = evaluateExpression(value, evalContext);

        const directionMultiplier = mod.direction.includes('-') ? -1 : 1;
        const axis = mod.direction[0];

        let newOffset: [number, number, number] = [0, 0, 0];
        if (axis === 'x') {
          newOffset = [result * directionMultiplier, 0, 0];
        } else if (axis === 'y') {
          newOffset = [0, result * directionMultiplier, 0];
        } else if (axis === 'z') {
          newOffset = [0, 0, result * directionMultiplier];
        }

        updated.offset = newOffset;
        updated.newPosition = [
          mod.originalPosition[0] + newOffset[0],
          mod.originalPosition[1] + newOffset[1],
          mod.originalPosition[2] + newOffset[2]
        ];
      }

      return updated;
    });

    setVertexModifications(updatedMods);

    if (selectedShape) {
      updateShape(selectedShape.id, {
        vertexModifications: updatedMods
      });
    }
  };

  const handleApplyChanges = async () => {
    await applyShapeChanges({
      selectedShape,
      width,
      height,
      depth,
      rotX,
      rotY,
      rotZ,
      customParameters,
      vertexModifications,
      selectedSubtractionIndex,
      subWidth,
      subHeight,
      subDepth,
      subPosX,
      subPosY,
      subPosZ,
      subRotX,
      subRotY,
      subRotZ,
      updateShape
    });
  };

  const handleApplySubtractionChanges = async (shapeOverride?: any) => {
    await applySubtractionChanges({
      selectedShapeId,
      selectedSubtractionIndex,
      shapes,
      subWidth,
      subHeight,
      subDepth,
      subPosX,
      subPosY,
      subPosZ,
      subRotX,
      subRotY,
      subRotZ,
      updateShape,
      shapeOverride
    });
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
              onClick={() => setSubtractionViewMode(!subtractionViewMode)}
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

      <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {selectedShape ? (
          <div className="space-y-2">
            <div className="space-y-2">
              <ParameterRow
                label="W"
                value={width}
                onChange={(v) => handleDimensionChange('width', v)}
                description="Width"
              />
              <ParameterRow
                label="H"
                value={height}
                onChange={(v) => handleDimensionChange('height', v)}
                description="Height"
              />
              <ParameterRow
                label="D"
                value={depth}
                onChange={(v) => handleDimensionChange('depth', v)}
                description="Depth"
              />
              <ParameterRow
                label="RX"
                value={rotX}
                onChange={setRotX}
                display={rotX.toFixed(1) + '°'}
                description="Rotation X"
                step={1}
              />
              <ParameterRow
                label="RY"
                value={rotY}
                onChange={setRotY}
                display={rotY.toFixed(1) + '°'}
                description="Rotation Y"
                step={1}
              />
              <ParameterRow
                label="RZ"
                value={rotZ}
                onChange={setRotZ}
                display={rotZ.toFixed(1) + '°'}
                description="Rotation Z"
                step={1}
              />
            </div>

            {customParameters.length > 0 && (
              <div className="space-y-1">
                {customParameters.map((param) => (
                  <div key={param.id} className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => updateCustomParameter(param.id, 'name', e.target.value)}
                      className="w-10 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded text-center"
                    />
                    <input
                      type="text"
                      value={param.expression}
                      onChange={(e) => updateCustomParameter(param.id, 'expression', e.target.value)}
                      className="w-16 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded"
                      placeholder="expr"
                    />
                    <input
                      type="text"
                      value={param.result.toFixed(2)}
                      readOnly
                      className="w-16 px-1 py-0.5 text-xs font-mono bg-white text-gray-400 border border-gray-300 rounded text-left"
                    />
                    <input
                      type="text"
                      value={param.description}
                      onChange={(e) => updateCustomParameter(param.id, 'description', e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded"
                      placeholder="Description"
                    />
                    <button
                      onClick={() => deleteCustomParameter(param.id)}
                      className="p-0.5 hover:bg-red-100 rounded transition-colors"
                      title="Delete"
                    >
                      <X size={12} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedSubtractionIndex !== null && selectedShape.subtractionGeometries && (
              <div className="space-y-2 pt-2 border-t-2 border-yellow-400">
                <div className="text-xs font-semibold text-yellow-700">
                  Subtraction #{selectedSubtractionIndex + 1}
                </div>
                <SubtractionParametersPanel
                  subWidth={subWidth}
                  subHeight={subHeight}
                  subDepth={subDepth}
                  subPosX={subPosX}
                  subPosY={subPosY}
                  subPosZ={subPosZ}
                  subRotX={subRotX}
                  subRotY={subRotY}
                  subRotZ={subRotZ}
                  onSubWidthChange={setSubWidth}
                  onSubHeightChange={setSubHeight}
                  onSubDepthChange={setSubDepth}
                  onSubPosXChange={setSubPosX}
                  onSubPosYChange={setSubPosY}
                  onSubPosZChange={setSubPosZ}
                  onSubRotXChange={setSubRotX}
                  onSubRotYChange={setSubRotY}
                  onSubRotZChange={setSubRotZ}
                />
              </div>
            )}

            {vertexEditMode && vertexModifications.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-stone-300">
                <div className="text-xs font-semibold text-stone-600 mb-1">Vertex Modifications</div>
                {vertexModifications.map((mod, idx) => {
                  const context = {
                    W: width,
                    H: height,
                    D: depth,
                    ...customParameters.reduce((acc, param) => {
                      acc[param.name] = param.result;
                      return acc;
                    }, {} as Record<string, number>)
                  };
                  const result = evaluateExpression(mod.expression, context);

                  return (
                    <div key={idx} className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={`V${mod.vertexIndex}`}
                        readOnly
                        className="w-10 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded text-center"
                      />
                      <input
                        type="text"
                        value={mod.expression}
                        onChange={(e) => updateVertexModification(idx, 'expression', e.target.value)}
                        className="w-16 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded"
                        placeholder="expr"
                      />
                      <input
                        type="text"
                        value={result.toFixed(2)}
                        readOnly
                        className="w-16 px-1 py-0.5 text-xs font-mono bg-white text-gray-400 border border-gray-300 rounded text-left"
                      />
                      <input
                        type="text"
                        value={mod.description || ''}
                        onChange={(e) => updateVertexModification(idx, 'description', e.target.value)}
                        className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-800 border border-gray-300 rounded"
                        placeholder="Description"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleApplyChanges}
              className="w-full mt-2 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
            >
              <Check size={12} />
              Apply Changes
            </button>
          </div>
        ) : (
          <div className="text-center text-stone-500 text-xs py-4">
            No shape selected
          </div>
        )}
      </div>
    </div>
  );
}
