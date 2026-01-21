import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Arrow: React.FC<{
  position: [number, number, number];
  direction: 'left' | 'right';
  isReversed: boolean;
  onClick: () => void;
}> = ({ position, direction, isReversed, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  let rotation: [number, number, number];
  if (direction === 'left') {
    rotation = isReversed ? [0, 0, -Math.PI / 2] : [0, 0, Math.PI / 2];
  } else {
    rotation = isReversed ? [0, 0, Math.PI / 2] : [0, 0, -Math.PI / 2];
  }

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
      <coneGeometry args={[0.025, 0.05, 8]} />
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
  isLeftExpanded?: boolean;
  isRightExpanded?: boolean;
}> = ({ id, position, args, color, isSelected, onSelect, onShrinkLeft, onShrinkRight, showArrows, isLeftExpanded, isRightExpanded }) => {
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
          position={[-args[0] / 2 + 0.04, -args[1] / 2 + 0.08, 0]}
          direction="left"
          isReversed={isLeftExpanded || false}
          onClick={onShrinkLeft}
        />
      )}

      {isSelected && showArrows && onShrinkRight && (
        <Arrow
          position={[args[0] / 2 - 0.04, -args[1] / 2 + 0.08, 0]}
          direction="right"
          isReversed={isRightExpanded || false}
          onClick={onShrinkRight}
        />
      )}
    </group>
  );
};

const Cabinet3D: React.FC<{
  topPanelWidth: number;
  bottomPanelWidth: number;
  topPanelPositionX: number;
  bottomPanelPositionX: number;
  selectedPanel: string | null;
  onSelectPanel: (id: string) => void;
  onShrinkPanel: (id: string, direction: 'left' | 'right') => void;
  topLeftExpanded: boolean;
  topRightExpanded: boolean;
  bottomLeftExpanded: boolean;
  bottomRightExpanded: boolean;
  leftPanelHeight: number;
  leftPanelPositionY: number;
  rightPanelHeight: number;
  rightPanelPositionY: number;
  selectedBodyType: string | null;
}> = ({ topPanelWidth, bottomPanelWidth, topPanelPositionX, bottomPanelPositionX, selectedPanel, onSelectPanel, onShrinkPanel, topLeftExpanded, topRightExpanded, bottomLeftExpanded, bottomRightExpanded, leftPanelHeight, leftPanelPositionY, rightPanelHeight, rightPanelPositionY, selectedBodyType }) => {
  const cabinetWidth = 0.45;
  const cabinetHeight = 0.55;
  const cabinetDepth = 0.25;
  const panelThickness = 0.018;
  const baseHeight = 0.10;

  return (
    <group>
      <Panel
        id="left"
        position={[-cabinetWidth / 2 - panelThickness / 2, leftPanelPositionY, 0]}
        args={[panelThickness, leftPanelHeight, cabinetDepth]}
        color="#f5f5f4"
        isSelected={false}
        onSelect={() => {}}
        showArrows={false}
      />

      <Panel
        id="right"
        position={[cabinetWidth / 2 + panelThickness / 2, rightPanelPositionY, 0]}
        args={[panelThickness, rightPanelHeight, cabinetDepth]}
        color="#f5f5f4"
        isSelected={false}
        onSelect={() => {}}
        showArrows={false}
      />

      <Panel
        id="top"
        position={[topPanelPositionX, cabinetHeight + panelThickness / 2, 0]}
        args={[topPanelWidth, panelThickness, cabinetDepth]}
        color="#fed7aa"
        isSelected={selectedPanel === 'top'}
        onSelect={() => onSelectPanel('top')}
        onShrinkLeft={() => onShrinkPanel('top', 'left')}
        onShrinkRight={() => onShrinkPanel('top', 'right')}
        showArrows={true}
        isLeftExpanded={topLeftExpanded}
        isRightExpanded={topRightExpanded}
      />

      <Panel
        id="bottom"
        position={[bottomPanelPositionX, -panelThickness / 2, 0]}
        args={[bottomPanelWidth, panelThickness, cabinetDepth]}
        color="#fed7aa"
        isSelected={selectedPanel === 'bottom'}
        onSelect={() => onSelectPanel('bottom')}
        onShrinkLeft={() => onShrinkPanel('bottom', 'left')}
        onShrinkRight={() => onShrinkPanel('bottom', 'right')}
        showArrows={true}
        isLeftExpanded={bottomLeftExpanded}
        isRightExpanded={bottomRightExpanded}
      />

      {selectedBodyType === 'bazali' && (
        <Panel
          id="base"
          position={[0, -baseHeight / 2 - panelThickness, cabinetDepth / 2 - panelThickness / 2]}
          args={[cabinetWidth, baseHeight, panelThickness]}
          color="#78716c"
          isSelected={false}
          onSelect={() => {}}
          showArrows={false}
        />
      )}

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function PanelJointSettings() {
  const [selectedBodyType, setSelectedBodyType] = React.useState<string | null>('ayaksiz');
  const [selectedPanel, setSelectedPanel] = React.useState<string | null>(null);
  const [topPanelWidth, setTopPanelWidth] = React.useState(0.45);
  const [bottomPanelWidth, setBottomPanelWidth] = React.useState(0.45);
  const [topPanelPositionX, setTopPanelPositionX] = React.useState(0);
  const [bottomPanelPositionX, setBottomPanelPositionX] = React.useState(0);

  const cabinetHeight = 0.55;
  const panelThickness = 0.018;
  const baseHeight = 0.10;
  const initialSidePanelHeight = cabinetHeight + 2 * panelThickness;

  const [leftPanelHeight, setLeftPanelHeight] = React.useState(initialSidePanelHeight);
  const [leftPanelPositionY, setLeftPanelPositionY] = React.useState(cabinetHeight / 2);
  const [rightPanelHeight, setRightPanelHeight] = React.useState(initialSidePanelHeight);
  const [rightPanelPositionY, setRightPanelPositionY] = React.useState(cabinetHeight / 2);

  const [topLeftExpanded, setTopLeftExpanded] = React.useState(false);
  const [topRightExpanded, setTopRightExpanded] = React.useState(false);
  const [bottomLeftExpanded, setBottomLeftExpanded] = React.useState(false);
  const [bottomRightExpanded, setBottomRightExpanded] = React.useState(false);

  React.useEffect(() => {
    if (selectedBodyType === 'bazali') {
      const bazaliHeight = initialSidePanelHeight + baseHeight;
      setLeftPanelHeight(bazaliHeight);
      setLeftPanelPositionY(cabinetHeight / 2 - baseHeight / 2);
      setRightPanelHeight(bazaliHeight);
      setRightPanelPositionY(cabinetHeight / 2 - baseHeight / 2);
    } else {
      setLeftPanelHeight(initialSidePanelHeight);
      setLeftPanelPositionY(cabinetHeight / 2);
      setRightPanelHeight(initialSidePanelHeight);
      setRightPanelPositionY(cabinetHeight / 2);
    }
  }, [selectedBodyType]);

  const handleSelectPanel = (id: string) => {
    setSelectedPanel(selectedPanel === id ? null : id);
  };

  const handleShrinkPanel = (id: string, direction: 'left' | 'right') => {
    const changeAmount = 0.018;

    if (id === 'top') {
      if (direction === 'left') {
        if (topLeftExpanded) {
          setTopPanelWidth(prev => prev - changeAmount);
          setTopPanelPositionX(prev => prev + changeAmount / 2);
          setTopLeftExpanded(false);
          setLeftPanelHeight(prev => prev + changeAmount);
          setLeftPanelPositionY(prev => prev + changeAmount / 2);
        } else {
          setTopPanelWidth(prev => prev + changeAmount);
          setTopPanelPositionX(prev => prev - changeAmount / 2);
          setTopLeftExpanded(true);
          setLeftPanelHeight(prev => prev - changeAmount);
          setLeftPanelPositionY(prev => prev - changeAmount / 2);
        }
      } else {
        if (topRightExpanded) {
          setTopPanelWidth(prev => prev - changeAmount);
          setTopPanelPositionX(prev => prev - changeAmount / 2);
          setTopRightExpanded(false);
          setRightPanelHeight(prev => prev + changeAmount);
          setRightPanelPositionY(prev => prev + changeAmount / 2);
        } else {
          setTopPanelWidth(prev => prev + changeAmount);
          setTopPanelPositionX(prev => prev + changeAmount / 2);
          setTopRightExpanded(true);
          setRightPanelHeight(prev => prev - changeAmount);
          setRightPanelPositionY(prev => prev - changeAmount / 2);
        }
      }
    } else if (id === 'bottom') {
      if (direction === 'left') {
        if (bottomLeftExpanded) {
          setBottomPanelWidth(prev => prev - changeAmount);
          setBottomPanelPositionX(prev => prev + changeAmount / 2);
          setBottomLeftExpanded(false);
          setLeftPanelHeight(prev => prev + changeAmount);
          setLeftPanelPositionY(prev => prev - changeAmount / 2);
        } else {
          setBottomPanelWidth(prev => prev + changeAmount);
          setBottomPanelPositionX(prev => prev - changeAmount / 2);
          setBottomLeftExpanded(true);
          setLeftPanelHeight(prev => prev - changeAmount);
          setLeftPanelPositionY(prev => prev + changeAmount / 2);
        }
      } else {
        if (bottomRightExpanded) {
          setBottomPanelWidth(prev => prev - changeAmount);
          setBottomPanelPositionX(prev => prev - changeAmount / 2);
          setBottomRightExpanded(false);
          setRightPanelHeight(prev => prev + changeAmount);
          setRightPanelPositionY(prev => prev - changeAmount / 2);
        } else {
          setBottomPanelWidth(prev => prev + changeAmount);
          setBottomPanelPositionX(prev => prev + changeAmount / 2);
          setBottomRightExpanded(true);
          setRightPanelHeight(prev => prev - changeAmount);
          setRightPanelPositionY(prev => prev + changeAmount / 2);
        }
      }
    }
  };

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-white">
      <div className="h-56 border border-stone-200 rounded overflow-hidden mb-3">
        <Canvas>
          <color attach="background" args={['#ffffff']} />
          <PerspectiveCamera makeDefault position={[0.3, 0.4, 1]} fov={45} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={0.5}
            maxDistance={2}
            target={[0, 0.275, 0]}
          />
          <Cabinet3D
            topPanelWidth={topPanelWidth}
            bottomPanelWidth={bottomPanelWidth}
            topPanelPositionX={topPanelPositionX}
            bottomPanelPositionX={bottomPanelPositionX}
            selectedPanel={selectedPanel}
            onSelectPanel={handleSelectPanel}
            onShrinkPanel={handleShrinkPanel}
            topLeftExpanded={topLeftExpanded}
            topRightExpanded={topRightExpanded}
            bottomLeftExpanded={bottomLeftExpanded}
            bottomRightExpanded={bottomRightExpanded}
            leftPanelHeight={leftPanelHeight}
            leftPanelPositionY={leftPanelPositionY}
            rightPanelHeight={rightPanelHeight}
            rightPanelPositionY={rightPanelPositionY}
            selectedBodyType={selectedBodyType}
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
