import React from 'react';

interface ParameterRowProps {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  display?: string;
  description: string;
  step?: number;
  readOnly?: boolean;
}

export const ParameterRow: React.FC<ParameterRowProps> = ({
  label,
  value,
  onChange,
  display,
  description,
  step = 1,
  readOnly = false
}) => {
  return (
    <div className="flex gap-1 items-center">
      <input
        type="text"
        value={label}
        readOnly
        className="w-10 px-1 py-[1px] text-xs font-mono bg-gray-700 text-white border border-gray-600 rounded text-center"
      />
      <input
        type="number"
        value={value}
        step={step}
        onChange={onChange && !readOnly ? (e) => onChange(parseFloat(e.target.value) || 0) : undefined}
        readOnly={readOnly}
        className={`w-16 px-1 py-[1px] text-xs font-mono border rounded text-right ${
          readOnly ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-white'
        } border-gray-600`}
      />
      <input
        type="text"
        value={display ?? value.toFixed(2)}
        readOnly
        className="w-16 px-1 py-[1px] text-xs font-mono bg-gray-700 text-gray-400 border border-gray-600 rounded text-right"
      />
      <input
        type="text"
        value={description}
        readOnly
        className="flex-1 px-2 py-[1px] text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded"
      />
    </div>
  );
};
