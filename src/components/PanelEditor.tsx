import React, { useState, useEffect } from 'react';
import { X, GripVertical, Plus } from 'lucide-react';
import { useAppStore, FaceRole } from '../store';

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_COLORS: Record<FaceRole, string> = {
  'Sağ': '#ef4444',
  'Sol': '#3b82f6',
  'Üst': '#10b981',
  'Alt': '#f59e0b',
  'Door': '#8b5cf6',
  'Back': '#6b7280'
};

export function PanelEditor({ isOpen, onClose }: PanelEditorProps) {
  const {
    roleAssignmentMode,
    setRoleAssignmentMode,
    draggingRole,
    setDraggingRole,
    selectedShapeId
  } = useAppStore();

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  const handleRoleClick = (role: FaceRole) => {
    if (draggingRole === role) {
      setDraggingRole(null);
      console.log(`🎯 Deselected role: ${role}`);
    } else {
      setDraggingRole(role);
      console.log(`🎯 Selected role for assignment: ${role}`);
    }
  };

  if (!isOpen) return null;

  const roles: FaceRole[] = ['Sağ', 'Sol', 'Üst', 'Alt', 'Door', 'Back'];

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
          <span className="text-sm font-semibold text-slate-800">Panel Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const newMode = !roleAssignmentMode;
              setRoleAssignmentMode(newMode);
              if (!newMode) {
                setDraggingRole(null);
              }
            }}
            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              roleAssignmentMode
                ? 'bg-purple-600 text-white'
                : 'bg-stone-200 text-slate-700 hover:bg-stone-300'
            }`}
            title="Role Assignment Mode"
          >
            ROLE
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
        {roleAssignmentMode ? (
          <div className="space-y-2">
            {!selectedShapeId ? (
              <div className="text-center text-stone-500 text-xs py-4">
                No shape selected
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold text-stone-600 mb-2">
                  {draggingRole ? `Click on a face to assign "${draggingRole}"` : 'Select a role to assign'}
                </div>
                <div className="space-y-1">
                  {roles.map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleClick(role)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-all ${
                        draggingRole === role
                          ? 'ring-2 ring-white ring-offset-2 scale-105'
                          : 'hover:scale-[1.02]'
                      }`}
                      style={{ backgroundColor: ROLE_COLORS[role] }}
                    >
                      <div className="flex-1 text-sm font-medium text-white text-left">
                        {role}
                      </div>
                      {draggingRole === role && (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center text-stone-500 text-xs py-8">
            Click ROLE to start assigning roles to faces
          </div>
        )}
      </div>
    </div>
  );
}
