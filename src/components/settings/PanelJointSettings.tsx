import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

const Cabinet3D: React.FC = () => {
  const cabinetWidth = 3;
  const cabinetHeight = 4;
  const cabinetDepth = 2;
  const panelThickness = 0.1;

  return (
    <group>
      <mesh position={[-cabinetWidth / 2 - panelThickness / 2, cabinetHeight / 2, 0]}>
        <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      <mesh position={[cabinetWidth / 2 + panelThickness / 2, cabinetHeight / 2, 0]}>
        <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      <mesh position={[0, cabinetHeight + panelThickness / 2, 0]}>
        <boxGeometry args={[cabinetWidth, panelThickness, cabinetDepth]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      <mesh position={[0, -panelThickness / 2, 0]}>
        <boxGeometry args={[cabinetWidth, panelThickness, cabinetDepth]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      <mesh position={[0, cabinetHeight / 2, -cabinetDepth / 2 - panelThickness / 2]}>
        <boxGeometry args={[cabinetWidth, cabinetHeight, panelThickness]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

      <mesh position={[0, cabinetHeight / 2, cabinetDepth / 2 + panelThickness / 2]}>
        <boxGeometry args={[cabinetWidth - 0.2, cabinetHeight - 0.2, panelThickness]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>

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
          <PerspectiveCamera makeDefault position={[6, 4, 6]} fov={45} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={3}
            maxDistance={15}
          />
          <Cabinet3D />
        </Canvas>
      </div>
    </div>
  );
}
