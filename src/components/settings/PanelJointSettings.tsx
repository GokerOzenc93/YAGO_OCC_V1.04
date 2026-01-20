import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Arrow: React.FC<{
  position: [number, number, number];
  direction: 'left' | 'right';
  onClick: () => void;
}> = ({ position, direction, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  const rotation: [number, number, number] = direction === 'left'
    ? [0, 0, Math.PI / 2]
    : [0, 0, -Math.PI / 2];

  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <coneGeometry args={[0.15, 0.3, 8]} />
      <meshStandardMaterial color={hovered ? "#f97316" : "#3b82f6"} />
    </mesh>
  );
};

const Panel: React.FC<{
  id: string;
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  isSelected: boolean;
  onSelect: () => void;
  onShrinkLeft?: () => void;
  onShrinkRight?: () => void;
  showArrows: boolean;
}> = ({ id, position, args, color, isSelected, onSelect, onShrinkLeft, onShrinkRight, showArrows }) => {
  const geometry = new THREE.BoxGeometry(...args);
  const edges = new THREE.EdgesGeometry(geometry);

  const displayColor = isSelected ? "#ef4444" : color;

  return (
    <group position={position}>
      <mesh onClick={onSelect}>
        <boxGeometry args={args} />
        <meshStandardMaterial color={displayColor} />
      </mesh>
      <lineSegments>
        <edgesGeometry attach="geometry" args={[geometry]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={3} />
      </lineSegments>

      {isSelected && showArrows && onShrinkLeft && (
        <Arrow
          position={[-args[0] / 2 - 0.3, args[1] / 2 + 0.4, 0]}
          direction="left"
          onClick={onShrinkLeft}
        />
      )}

      {isSelected && showArrows && onShrinkRight && (
        <Arrow
          position={[args[0] / 2 + 0.3, args[1] / 2 + 0.4, 0]}
          direction="right"
          onClick={onShrinkRight}
        />
      )}
    </group>
  );
};

const Cabinet3D: React.FC<{
  topPanelWidth: number;
  bottomPanelWidth: number;
  topPanelOffset: number;
  bottomPanelOffset: number;
  leftPanelPosition: number;
  rightPanelPosition: number;
  selectedPanel: string | null;
  onSelectPanel: (id: string) => void;
  onShrinkPanel: (id: string, direction: 'left' | 'right') => void;
}> = ({ topPanelWidth, bottomPanelWidth, topPanelOffset, bottomPanelOffset, leftPanelPosition, rightPanelPosition, selectedPanel, onSelectPanel, onShrinkPanel }) => {
  const cabinetWidth = 2.5;
  const cabinetHeight = 3.5;
  const cabinetDepth = 2;
  const panelThickness = 0.15;

  return (
    <group>
      <Panel
        id="left"
        position={[leftPanelPosition, cabinetHeight / 2, 0]}
        args={[panelThickness, cabinetHeight + 2 * panelThickness, cabinetDepth]}
        color="#ffffff"
        isSelected={false}
        onSelect={() => {}}
        showArrows={false}
      />

      <Panel
        id="right"
        position={[rightPanelPosition, cabinetHeight / 2, 0]}
        args={[panelThickness, cabinetHeight + 2 * panelThickness, cabinetDepth]}
        color="#ffffff"
        isSelected={false}
        onSelect={() => {}}
        showArrows={false}
      />

      <Panel
        id="top"
        position={[topPanelOffset, cabinetHeight + panelThickness / 2, 0]}
        args={[topPanelWidth, panelThickness, cabinetDepth]}
        color="#ffffff"
        isSelected={selectedPanel === 'top'}
        onSelect={() => onSelectPanel('top')}
        onShrinkLeft={() => onShrinkPanel('top', 'left')}
        onShrinkRight={() => onShrinkPanel('top', 'right')}
        showArrows={true}
      />

      <Panel
        id="bottom"
        position={[bottomPanelOffset, -panelThickness / 2, 0]}
        args={[bottomPanelWidth, panelThickness, cabinetDepth]}
        color="#ffffff"
        isSelected={selectedPanel === 'bottom'}
        onSelect={() => onSelectPanel('bottom')}
        onShrinkLeft={() => onShrinkPanel('bottom', 'left')}
        onShrinkRight={() => onShrinkPanel('bottom', 'right')}
        showArrows={true}
      />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function PanelJointSettings() {
  const cabinetWidth = 2.5;
  const panelThickness = 0.15;

  const [selectedBodyType, setSelectedBodyType] = React.useState<string | null>('ayaksiz');
  const [selectedPanel, setSelectedPanel] = React.useState<string | null>(null);
  const [topPanelWidth, setTopPanelWidth] = React.useState(2.5);
  const [bottomPanelWidth, setBottomPanelWidth] = React.useState(2.5);
  const [topPanelOffset, setTopPanelOffset] = React.useState(0);
  const [bottomPanelOffset, setBottomPanelOffset] = React.useState(0);
  const [leftPanelPosition, setLeftPanelPosition] = React.useState(-cabinetWidth / 2 - panelThickness / 2);
  const [rightPanelPosition, setRightPanelPosition] = React.useState(cabinetWidth / 2 + panelThickness / 2);

  const handleSelectPanel = (id: string) => {
    setSelectedPanel(selectedPanel === id ? null : id);
  };

  const handleShrinkPanel = (id: string, direction: 'left' | 'right') => {
    const growAmount = 0.18;

    if (id === 'top') {
      setTopPanelWidth(prev => prev + growAmount);
      if (direction === 'left') {
        setTopPanelOffset(prev => prev - growAmount / 2);
        setLeftPanelPosition(prev => prev + growAmount);
      } else {
        setTopPanelOffset(prev => prev + growAmount / 2);
        setRightPanelPosition(prev => prev - growAmount);
      }
    } else if (id === 'bottom') {
      setBottomPanelWidth(prev => prev + growAmount);
      if (direction === 'left') {
        setBottomPanelOffset(prev => prev - growAmount / 2);
        setLeftPanelPosition(prev => prev + growAmount);
      } else {
        setBottomPanelOffset(prev => prev + growAmount / 2);
        setRightPanelPosition(prev => prev - growAmount);
      }
    }
  };

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-white">
      <div className="h-56 border border-stone-200 rounded overflow-hidden mb-3">
        <Canvas>
          <color attach="background" args={['#ffffff']} />
          <PerspectiveCamera makeDefault position={[1.5, 2.5, 6]} fov={45} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={3}
            maxDistance={12}
            target={[0, 1.75, 0]}
          />
          <Cabinet3D
            topPanelWidth={topPanelWidth}
            bottomPanelWidth={bottomPanelWidth}
            topPanelOffset={topPanelOffset}
            bottomPanelOffset={bottomPanelOffset}
            leftPanelPosition={leftPanelPosition}
            rightPanelPosition={rightPanelPosition}
            selectedPanel={selectedPanel}
            onSelectPanel={handleSelectPanel}
            onShrinkPanel={handleShrinkPanel}
          />
        </Canvas>
      </div>

      <div className="mt-3">
        <p className="text-xs text-slate-600 mb-2">Ana Gövde Tipi</p>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedBodyType('ayakli')}
            className={`w-full text-xs text-left px-2 py-0.5 bg-white border border-stone-200 rounded transition-all ${
              selectedBodyType === 'ayakli'
                ? 'text-slate-700 border-l-4 border-l-orange-500'
                : 'text-slate-700 hover:border-l-4 hover:border-l-orange-300'
            }`}
          >
            Ayaklı
          </button>
          <button
            onClick={() => setSelectedBodyType('ayaksiz')}
            className={`w-full text-xs text-left px-2 py-0.5 bg-white border border-stone-200 rounded transition-all ${
              selectedBodyType === 'ayaksiz'
                ? 'text-slate-700 border-l-4 border-l-orange-500'
                : 'text-slate-700 hover:border-l-4 hover:border-l-orange-300'
            }`}
          >
            Ayaksız
          </button>
          <button
            onClick={() => setSelectedBodyType('bazali')}
            className={`w-full text-xs text-left px-2 py-0.5 bg-white border border-stone-200 rounded transition-all ${
              selectedBodyType === 'bazali'
                ? 'text-slate-700 border-l-4 border-l-orange-500'
                : 'text-slate-700 hover:border-l-4 hover:border-l-orange-300'
            }`}
          >
            Bazalı
          </button>
        </div>
      </div>
    </div>
  );
}
