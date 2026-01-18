import React, { useState, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';

interface GlobalSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingOption {
  id: string;
  label: string;
}

const settingOptions: SettingOption[] = [
  { id: 'panel_joint', label: 'Panel Birleşim Tipleri' },
  { id: 'backrest', label: 'Arkalık Ayarları' }
];

export function GlobalSettingsPanel({ isOpen, onClose }: GlobalSettingsPanelProps) {
  const [position, setPosition] = useState({ x: 500, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '700px',
        height: '500px'
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Global Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-stone-200 rounded transition-colors"
        >
          <X size={14} className="text-stone-600" />
        </button>
      </div>

      <div className="flex h-[calc(100%-44px)]">
        <div className="w-32 border-r border-stone-200 bg-white p-2">
          <div className="text-xs font-medium text-slate-800 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded">
            Default
          </div>
        </div>

        <div className="w-48 border-r border-stone-200 bg-white p-2 space-y-1">
          {settingOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={`w-full text-xs font-medium text-left px-2 py-1.5 rounded transition-colors ${
                selectedOption === option.id
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-white text-slate-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-4">
          {selectedOption ? (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              {selectedOption === 'panel_joint' && 'Panel Birleşim Tipleri İçeriği'}
              {selectedOption === 'backrest' && 'Arkalık Ayarları İçeriği'}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              Bir ayar seçin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
