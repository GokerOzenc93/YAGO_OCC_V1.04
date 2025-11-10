import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';

const StatusBar: React.FC = () => {
  const { shapes, selectedShapeId, vertexEditMode, selectedVertexIndex } = useAppStore();
  const [vertexMessage, setVertexMessage] = useState<string>('');

  const selectedShape = shapes.find(s => s.id === selectedShapeId);
  const vertexModCount = selectedShape?.parameters?.vertexModifications?.length || 0;

  useEffect(() => {
    const checkMessage = () => {
      const msg = (window as any).vertexEditStatusMessage;
      if (msg) {
        setVertexMessage(msg);
      } else {
        setVertexMessage('');
      }
    };

    const interval = setInterval(checkMessage, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!(window as any).pendingVertexEdit) {
      setVertexMessage('');
      delete (window as any).vertexEditStatusMessage;
    }
  }, [(window as any).pendingVertexEdit]);

  return (
    <div className="absolute bottom-6 left-0 right-0 flex items-center h-5 px-4 bg-stone-800 text-stone-300 text-xs border-t border-stone-700 z-20">
      <div className="flex items-center gap-4 flex-1">
        <span className="text-stone-400">Objects: {shapes.length}</span>
        <span className="text-stone-400">
          Selected: {selectedShape ? `${selectedShape.type} (${selectedShape.id.slice(0, 8)})` : 'None'}
        </span>
        {selectedShape && (
          <span className="text-stone-400">
            Pos: [{selectedShape.position.map(v => v.toFixed(0)).join(', ')}]
          </span>
        )}
        {vertexEditMode && (
          <span className="text-blue-400">
            Vertex Edit {selectedVertexIndex !== null ? `(V${selectedVertexIndex})` : ''}
          </span>
        )}
        {vertexModCount > 0 && (
          <span className="text-purple-400">
            Vertex Mods: {vertexModCount}
          </span>
        )}
        {vertexMessage && (
          <span className="text-orange-400 font-semibold animate-pulse">
            {vertexMessage}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
