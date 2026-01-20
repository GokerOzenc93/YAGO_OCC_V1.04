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
  const cabinetWidth = 2.5;
  const cabinetHeight = 3.5;
  const cabinetDepth = 2;
  const panelThickness = 0.15;

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
  const [selectedBodyType, setSelectedBodyType] = React.useState<string | null>('ayaksiz');

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
          <Cabinet3D />
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
