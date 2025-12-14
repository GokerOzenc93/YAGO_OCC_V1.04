import React from 'react';

interface SubtractionParam {
  expression: string;
  result: number;
}

interface SubtractionParametersPanelProps {
  subParams: {
    width: SubtractionParam;
    height: SubtractionParam;
    depth: SubtractionParam;
    posX: SubtractionParam;
    posY: SubtractionParam;
    posZ: SubtractionParam;
    rotX: SubtractionParam;
    rotY: SubtractionParam;
    rotZ: SubtractionParam;
  };
  onSubParamChange: (param: string, expression: string) => void;
}

export const SubtractionParametersPanel: React.FC<SubtractionParametersPanelProps> = ({
  subParams,
  onSubParamChange
}) => {
  const renderParamRow = (label: string, param: SubtractionParam, paramKey: string, description: string) => {
    return (
      <div key={paramKey} className="flex gap-1 items-center">
        <input
          type="text"
          value={label}
          readOnly
          className="w-10 px-1 py-0.5 text-xs font-mono bg-white text-gray-800 border border-gray-300 rounded text-center"
        />
        <input
          type="text"
          value={param.expression}
          onChange={(e) => onSubParamChange(paramKey, e.target.value)}
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
          value={description}
          readOnly
          className="flex-1 px-2 py-0.5 text-xs bg-white text-gray-600 border border-gray-300 rounded"
        />
      </div>
    );
  };
  return (
    <div className="space-y-2">
      {renderParamRow('W', subParams.width, 'width', 'Subtraction Width')}
      {renderParamRow('H', subParams.height, 'height', 'Subtraction Height')}
      {renderParamRow('D', subParams.depth, 'depth', 'Subtraction Depth')}
      {renderParamRow('X', subParams.posX, 'posX', 'Subtraction Position X')}
      {renderParamRow('Y', subParams.posY, 'posY', 'Subtraction Position Y')}
      {renderParamRow('Z', subParams.posZ, 'posZ', 'Subtraction Position Z')}
      {renderParamRow('RX', subParams.rotX, 'rotX', 'Subtraction Rotation X')}
      {renderParamRow('RY', subParams.rotY, 'rotY', 'Subtraction Rotation Y')}
      {renderParamRow('RZ', subParams.rotZ, 'rotZ', 'Subtraction Rotation Z')}
    </div>
  );
};
