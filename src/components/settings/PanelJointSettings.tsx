import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

const Panel: React.FC<{
  position: [number, number, number];
  args: [number, number, number];
  color: string;
}> = ({ position, args, color }) => {
  const geometry = new THREE.BoxGeometry(...args);
  const edges = new THREE.EdgesGeometry(geometry);

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

const CornerPoint: React.FC<{
  position: [number, number, number];
  onClick: () => void;
}> = ({ position, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial color={hovered ? '#ff6b6b' : '#ff0000'} />
    </mesh>
  );
};

interface CornerStates {
  topLeft: boolean;
  topRight: boolean;
  bottomLeft: boolean;
  bottomRight: boolean;
}

const Cabinet3D: React.FC = () => {
  const cabinetWidth = 4.5;
  const cabinetHeight = 6;
  const cabinetDepth = 4;
  const panelThickness = 0.18;

  const [corners, setCorners] = useState<CornerStates>({
    topLeft: false,
    topRight: false,
    bottomLeft: false,
    bottomRight: false,
  });

  const toggleCorner = (corner: keyof CornerStates) => {
    setCorners(prev => ({
      ...prev,
      [corner]: !prev[corner]
    }));
  };

  const topPanelLeft = corners.topLeft ? -cabinetWidth / 2 - panelThickness : -cabinetWidth / 2;
  const topPanelRight = corners.topRight ? cabinetWidth / 2 + panelThickness : cabinetWidth / 2;
  const topPanelWidth = topPanelRight - topPanelLeft;
  const topPanelX = (topPanelLeft + topPanelRight) / 2;

  const bottomPanelLeft = corners.bottomLeft ? -cabinetWidth / 2 - panelThickness : -cabinetWidth / 2;
  const bottomPanelRight = corners.bottomRight ? cabinetWidth / 2 + panelThickness : cabinetWidth / 2;
  const bottomPanelWidth = bottomPanelRight - bottomPanelLeft;
  const bottomPanelX = (bottomPanelLeft + bottomPanelRight) / 2;

  const leftPanelBottom = corners.bottomLeft ? -panelThickness : 0;
  const leftPanelTop = corners.topLeft ? cabinetHeight + panelThickness : cabinetHeight;
  const leftPanelHeight = leftPanelTop - leftPanelBottom;
  const leftPanelY = (leftPanelBottom + leftPanelTop) / 2;

  const rightPanelBottom = corners.bottomRight ? -panelThickness : 0;
  const rightPanelTop = corners.topRight ? cabinetHeight + panelThickness : cabinetHeight;
  const rightPanelHeight = rightPanelTop - rightPanelBottom;
  const rightPanelY = (rightPanelBottom + rightPanelTop) / 2;

  return (
    <group>
      <Panel
        position={[-cabinetWidth / 2 - panelThickness / 2, leftPanelY, 0]}
        args={[panelThickness, leftPanelHeight, cabinetDepth]}
        color="#ffffff"
      />

      <Panel
        position={[cabinetWidth / 2 + panelThickness / 2, rightPanelY, 0]}
        args={[panelThickness, rightPanelHeight, cabinetDepth]}
        color="#ffffff"
      />

      <Panel
        position={[topPanelX, cabinetHeight + panelThickness / 2, 0]}
        args={[topPanelWidth, panelThickness, cabinetDepth]}
        color="#ffffff"
      />

      <Panel
        position={[bottomPanelX, -panelThickness / 2, 0]}
        args={[bottomPanelWidth, panelThickness, cabinetDepth]}
        color="#ffffff"
      />

      <CornerPoint
        position={[-cabinetWidth / 2 - panelThickness / 2, cabinetHeight + panelThickness / 2, cabinetDepth / 2 + 0.1]}
        onClick={() => toggleCorner('topLeft')}
      />
      <CornerPoint
        position={[cabinetWidth / 2 + panelThickness / 2, cabinetHeight + panelThickness / 2, cabinetDepth / 2 + 0.1]}
        onClick={() => toggleCorner('topRight')}
      />
      <CornerPoint
        position={[-cabinetWidth / 2 - panelThickness / 2, -panelThickness / 2, cabinetDepth / 2 + 0.1]}
        onClick={() => toggleCorner('bottomLeft')}
      />
      <CornerPoint
        position={[cabinetWidth / 2 + panelThickness / 2, -panelThickness / 2, cabinetDepth / 2 + 0.1]}
        onClick={() => toggleCorner('bottomRight')}
      />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function PanelJointSettings() {
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
          <Cabinet3D />
        </Canvas>
      </div>
    </div>
  );
}
