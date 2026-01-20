import React from 'react';
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

const Cabinet3D: React.FC = () => {
  const cabinetWidth = 4.5;
  const cabinetHeight = 6;
  const cabinetDepth = 4;
  const panelThickness = 0.18;

  return (
    <group>
      <Panel
        position={[-cabinetWidth / 2 - panelThickness / 2, cabinetHeight / 2, 0]}
        args={[panelThickness, cabinetHeight + 2 * panelThickness, cabinetDepth]}
        color="#ffffff"
      />

      <Panel
        position={[cabinetWidth / 2 + panelThickness / 2, cabinetHeight / 2, 0]}
        args={[panelThickness, cabinetHeight + 2 * panelThickness, cabinetDepth]}
        color="#ffffff"
      />

      <Panel
        position={[0, cabinetHeight + panelThickness / 2, 0]}
        args={[cabinetWidth, panelThickness, cabinetDepth]}
        color="#ffffff"
      />

      <Panel
        position={[0, -panelThickness / 2, 0]}
        args={[cabinetWidth, panelThickness, cabinetDepth]}
        color="#ffffff"
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
