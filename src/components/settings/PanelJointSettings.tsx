import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';

type JointType = 'horizontal-over' | 'vertical-over';

interface CornerJoints {
  topLeft: JointType;
  topRight: JointType;
  bottomLeft: JointType;
  bottomRight: JointType;
}

const Panel: React.FC<{
  position: [number, number, number];
  args: [number, number, number];
  color: string;
}> = ({ position, args, color }) => {
  const geometry = new THREE.BoxGeometry(...args);

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} />
      </mesh>
      <lineSegments>
        <edgesGeometry attach="geometry" args={[geometry]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={3} />
      </lineSegments>
    </group>
  );
};

const CornerMarker: React.FC<{
  position: [number, number, number];
  jointType: JointType;
  onClick: () => void;
}> = ({ position, jointType, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
      >
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? '#3b82f6' : '#ef4444'}
          emissive={hovered ? '#3b82f6' : '#ef4444'}
          emissiveIntensity={0.5}
        />
      </mesh>
      <Html
        position={[0, 0.5, 0]}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          fontSize: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          display: hovered ? 'block' : 'none',
        }}
      >
        {jointType === 'horizontal-over' ? 'Yatay Üstte' : 'Dikey Üstte'}
      </Html>
    </group>
  );
};

const Cabinet3D: React.FC<{
  cornerJoints: CornerJoints;
  onCornerClick: (corner: keyof CornerJoints) => void;
}> = ({ cornerJoints, onCornerClick }) => {
  const cabinetWidth = 4.5;
  const cabinetHeight = 6;
  const cabinetDepth = 4;
  const panelThickness = 0.18;

  const getLeftPanelDimensions = () => {
    const topLeft = cornerJoints.topLeft === 'horizontal-over';
    const bottomLeft = cornerJoints.bottomLeft === 'horizontal-over';

    let height = cabinetHeight;
    let yOffset = cabinetHeight / 2;

    if (topLeft && bottomLeft) {
      height = cabinetHeight - 2 * panelThickness;
      yOffset = cabinetHeight / 2;
    } else if (topLeft) {
      height = cabinetHeight - panelThickness;
      yOffset = (cabinetHeight - panelThickness) / 2;
    } else if (bottomLeft) {
      height = cabinetHeight - panelThickness;
      yOffset = (cabinetHeight + panelThickness) / 2;
    }

    return { height, yOffset };
  };

  const getRightPanelDimensions = () => {
    const topRight = cornerJoints.topRight === 'horizontal-over';
    const bottomRight = cornerJoints.bottomRight === 'horizontal-over';

    let height = cabinetHeight;
    let yOffset = cabinetHeight / 2;

    if (topRight && bottomRight) {
      height = cabinetHeight - 2 * panelThickness;
      yOffset = cabinetHeight / 2;
    } else if (topRight) {
      height = cabinetHeight - panelThickness;
      yOffset = (cabinetHeight - panelThickness) / 2;
    } else if (bottomRight) {
      height = cabinetHeight - panelThickness;
      yOffset = (cabinetHeight + panelThickness) / 2;
    }

    return { height, yOffset };
  };

  const getTopPanelDimensions = () => {
    const topLeft = cornerJoints.topLeft === 'horizontal-over';
    const topRight = cornerJoints.topRight === 'horizontal-over';

    let width = cabinetWidth;
    let leftExtension = panelThickness;
    let rightExtension = panelThickness;

    if (!topLeft) {
      leftExtension = 0;
    }
    if (!topRight) {
      rightExtension = 0;
    }

    return { width: width + leftExtension + rightExtension };
  };

  const getBottomPanelDimensions = () => {
    const bottomLeft = cornerJoints.bottomLeft === 'horizontal-over';
    const bottomRight = cornerJoints.bottomRight === 'horizontal-over';

    let leftExtension = panelThickness;
    let rightExtension = panelThickness;

    if (!bottomLeft) {
      leftExtension = 0;
    }
    if (!bottomRight) {
      rightExtension = 0;
    }

    return { width: cabinetWidth + leftExtension + rightExtension };
  };

  const leftPanel = getLeftPanelDimensions();
  const rightPanel = getRightPanelDimensions();
  const topPanel = getTopPanelDimensions();
  const bottomPanel = getBottomPanelDimensions();

  return (
    <group>
      <Panel
        position={[-cabinetWidth / 2 - panelThickness / 2, leftPanel.yOffset, 0]}
        args={[panelThickness, leftPanel.height, cabinetDepth]}
        color="#d9a574"
      />

      <Panel
        position={[cabinetWidth / 2 + panelThickness / 2, rightPanel.yOffset, 0]}
        args={[panelThickness, rightPanel.height, cabinetDepth]}
        color="#d9a574"
      />

      <Panel
        position={[0, cabinetHeight + panelThickness / 2, 0]}
        args={[topPanel.width, panelThickness, cabinetDepth]}
        color="#c08a5a"
      />

      <Panel
        position={[0, -panelThickness / 2, 0]}
        args={[bottomPanel.width, panelThickness, cabinetDepth]}
        color="#c08a5a"
      />

      <CornerMarker
        position={[-cabinetWidth / 2 - panelThickness, cabinetHeight + panelThickness, cabinetDepth / 2]}
        jointType={cornerJoints.topLeft}
        onClick={() => onCornerClick('topLeft')}
      />
      <CornerMarker
        position={[cabinetWidth / 2 + panelThickness, cabinetHeight + panelThickness, cabinetDepth / 2]}
        jointType={cornerJoints.topRight}
        onClick={() => onCornerClick('topRight')}
      />
      <CornerMarker
        position={[-cabinetWidth / 2 - panelThickness, -panelThickness, cabinetDepth / 2]}
        jointType={cornerJoints.bottomLeft}
        onClick={() => onCornerClick('bottomLeft')}
      />
      <CornerMarker
        position={[cabinetWidth / 2 + panelThickness, -panelThickness, cabinetDepth / 2]}
        jointType={cornerJoints.bottomRight}
        onClick={() => onCornerClick('bottomRight')}
      />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function PanelJointSettings() {
  const [cornerJoints, setCornerJoints] = useState<CornerJoints>({
    topLeft: 'horizontal-over',
    topRight: 'horizontal-over',
    bottomLeft: 'horizontal-over',
    bottomRight: 'horizontal-over',
  });

  const handleCornerClick = (corner: keyof CornerJoints) => {
    setCornerJoints((prev) => ({
      ...prev,
      [corner]: prev[corner] === 'horizontal-over' ? 'vertical-over' : 'horizontal-over',
    }));
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Panel Birleşim Tipi</h3>

      <div className="flex-1 border-2 border-stone-200 rounded-lg overflow-hidden">
        <Canvas>
          <color attach="background" args={['#ffffff']} />
          <PerspectiveCamera makeDefault position={[2.5, 4, 10]} fov={50} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={20}
            target={[0, 3, 0]}
          />
          <Cabinet3D cornerJoints={cornerJoints} onCornerClick={handleCornerClick} />
        </Canvas>
      </div>
    </div>
  );
}
