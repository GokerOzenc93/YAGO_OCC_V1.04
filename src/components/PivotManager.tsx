import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import * as THREE from 'three';

interface PivotManagerProps {
  shape: any;
}

export function PivotManager({ shape }: PivotManagerProps) {
  const { updateShapePivot, pivotEditMode } = useAppStore();
  const [pivotX, setPivotX] = useState(0);
  const [pivotY, setPivotY] = useState(0);
  const [pivotZ, setPivotZ] = useState(0);

  useEffect(() => {
    if (shape) {
      const currentPivot = shape.pivot || [0, 0, 0];
      setPivotX(currentPivot[0]);
      setPivotY(currentPivot[1]);
      setPivotZ(currentPivot[2]);
    }
  }, [shape?.id, shape?.pivot]);

  const handlePivotChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!shape) return;

    const newPivot: [number, number, number] = [
      axis === 'x' ? value : pivotX,
      axis === 'y' ? value : pivotY,
      axis === 'z' ? value : pivotZ
    ];

    if (axis === 'x') setPivotX(value);
    if (axis === 'y') setPivotY(value);
    if (axis === 'z') setPivotZ(value);

    updateShapePivot(shape.id, newPivot);
  };

  const resetPivot = () => {
    if (!shape) return;
    setPivotX(0);
    setPivotY(0);
    setPivotZ(0);
    updateShapePivot(shape.id, [0, 0, 0]);
  };

  const centerPivot = () => {
    if (!shape || !shape.geometry) return;

    const geometry = shape.geometry;
    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute('position')
    );
    const center = new THREE.Vector3();
    box.getCenter(center);

    setPivotX(center.x);
    setPivotY(center.y);
    setPivotZ(center.z);
    updateShapePivot(shape.id, [center.x, center.y, center.z]);
  };

  if (!pivotEditMode) return null;

  return (
    <div className="space-y-2 pt-2 border-t-2 border-green-400">
      <div className="text-xs font-semibold text-green-700 mb-2 flex items-center justify-between">
        <span>Pivot Point</span>
        <div className="flex gap-1">
          <button
            onClick={centerPivot}
            className="px-2 py-0.5 text-[10px] font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            title="Center Pivot"
          >
            CENTER
          </button>
          <button
            onClick={resetPivot}
            className="px-2 py-0.5 text-[10px] font-medium bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
            title="Reset Pivot to Origin"
          >
            RESET
          </button>
        </div>
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
          value={pivotX}
          step="0.1"
          onChange={(e) => handlePivotChange('x', Number(e.target.value))}
          className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <input
          type="text"
          value={pivotX.toFixed(2)}
          readOnly
          className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
        />
        <input
          type="text"
          value="Pivot X"
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
          value={pivotY}
          step="0.1"
          onChange={(e) => handlePivotChange('y', Number(e.target.value))}
          className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <input
          type="text"
          value={pivotY.toFixed(2)}
          readOnly
          className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
        />
        <input
          type="text"
          value="Pivot Y"
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
          value={pivotZ}
          step="0.1"
          onChange={(e) => handlePivotChange('z', Number(e.target.value))}
          className="w-16 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <input
          type="text"
          value={pivotZ.toFixed(2)}
          readOnly
          className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
        />
        <input
          type="text"
          value="Pivot Z"
          readOnly
          className="flex-1 px-2 py-1 text-xs border border-stone-300 rounded bg-stone-50 text-stone-600"
        />
      </div>
    </div>
  );
}
