import React from 'react';
import { ParameterRow } from './ParameterRow';

interface SubtractionParametersPanelProps {
  subWidth: number;
  subHeight: number;
  subDepth: number;
  subPosX: number;
  subPosY: number;
  subPosZ: number;
  subRotX: number;
  subRotY: number;
  subRotZ: number;
  onSubWidthChange: (value: number) => void;
  onSubHeightChange: (value: number) => void;
  onSubDepthChange: (value: number) => void;
  onSubPosXChange: (value: number) => void;
  onSubPosYChange: (value: number) => void;
  onSubPosZChange: (value: number) => void;
  onSubRotXChange: (value: number) => void;
  onSubRotYChange: (value: number) => void;
  onSubRotZChange: (value: number) => void;
}

export const SubtractionParametersPanel: React.FC<SubtractionParametersPanelProps> = ({
  subWidth,
  subHeight,
  subDepth,
  subPosX,
  subPosY,
  subPosZ,
  subRotX,
  subRotY,
  subRotZ,
  onSubWidthChange,
  onSubHeightChange,
  onSubDepthChange,
  onSubPosXChange,
  onSubPosYChange,
  onSubPosZChange,
  onSubRotXChange,
  onSubRotYChange,
  onSubRotZChange
}) => {
  return (
    <div className="space-y-2">
      <ParameterRow
        label="W"
        value={subWidth}
        onChange={onSubWidthChange}
        description="Subtraction Width"
        step={0.1}
      />
      <ParameterRow
        label="H"
        value={subHeight}
        onChange={onSubHeightChange}
        description="Subtraction Height"
        step={0.1}
      />
      <ParameterRow
        label="D"
        value={subDepth}
        onChange={onSubDepthChange}
        description="Subtraction Depth"
        step={0.1}
      />
      <ParameterRow
        label="X"
        value={subPosX}
        onChange={onSubPosXChange}
        description="Subtraction Position X"
        step={0.1}
      />
      <ParameterRow
        label="Y"
        value={subPosY}
        onChange={onSubPosYChange}
        description="Subtraction Position Y"
        step={0.1}
      />
      <ParameterRow
        label="Z"
        value={subPosZ}
        onChange={onSubPosZChange}
        description="Subtraction Position Z"
        step={0.1}
      />
      <ParameterRow
        label="RX"
        value={subRotX}
        onChange={onSubRotXChange}
        description="Subtraction Rotation X"
        step={1}
      />
      <ParameterRow
        label="RY"
        value={subRotY}
        onChange={onSubRotYChange}
        description="Subtraction Rotation Y"
        step={1}
      />
      <ParameterRow
        label="RZ"
        value={subRotZ}
        onChange={onSubRotZChange}
        description="Subtraction Rotation Z"
        step={1}
      />
    </div>
  );
};
