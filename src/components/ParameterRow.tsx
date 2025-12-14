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
        className="w-10 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded text-center"
      />
      <input
        type="number"
        value={value}
        step={step}
        onChange={onChange && !readOnly ? (e) => onChange(parseFloat(e.target.value) || 0) : undefined}
        readOnly={readOnly}
        className={`w-16 px-1 py-0.5 text-xs font-mono border rounded text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          readOnly ? 'bg-white text-gray-400' : 'bg-white text-gray-800'
        } border-gray-300`}
      />
      <input
        type="text"
        value={display ?? value.toFixed(2)}
        readOnly
        className="w-16 px-1 py-0.5 text-xs font-mono bg-white text-gray-400 border border-gray-300 rounded text-left"
      />
      <input
        type="text"
        value={description}
        readOnly
        className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-600 border border-gray-300 rounded"
      />
    </div>
  );
};
