import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface BackPanelSettingsProps {
  profileId: string;
}

const SidePanel: React.FC<{
  thickness: number;
  height: number;
  depth: number;
  color: string;
}> = ({ thickness, height, depth, color }) => {
  const geometry = new THREE.BoxGeometry(thickness, height, depth);

  return (
    <group>
      <mesh>
        <boxGeometry args={[thickness, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <lineSegments>
        <edgesGeometry attach="geometry" args={[geometry]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>
    </group>
  );
};

const Backrest: React.FC<{
  thickness: number;
  height: number;
  depth: number;
  positionX: number;
}> = ({ thickness, height, depth, positionX }) => {
  const geometry = new THREE.BoxGeometry(thickness, height, depth);

  return (
    <group position={[positionX, 0, 0]}>
      <mesh>
        <boxGeometry args={[thickness, height, depth]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <lineSegments>
        <edgesGeometry attach="geometry" args={[geometry]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>
    </group>
  );
};

const LeftView: React.FC = () => {
  const panelThickness = 0.018;
  const panelHeight = 0.55;
  const panelDepth = 0.25;
  const backrestThickness = 0.005;
  const backrestHeight = 0.45;
  const backrestDepth = 0.08;

  return (
    <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <SidePanel
        thickness={panelThickness}
        height={panelHeight}
        depth={panelDepth}
        color="#f5f5f4"
      />

      <Backrest
        thickness={backrestThickness}
        height={backrestHeight}
        depth={backrestDepth}
        positionX={panelThickness / 2 + backrestThickness / 2}
      />

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function BackPanelSettings({ profileId }: BackPanelSettingsProps) {
  const [activeView, setActiveView] = React.useState<'left' | 'right' | 'top' | 'bottom'>('left');

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-white flex flex-col h-full">
      <div className="flex-1">
        <div className="h-56 border border-stone-200 rounded overflow-hidden mb-3">
          <Canvas>
            <color attach="background" args={['#ffffff']} />
            <PerspectiveCamera makeDefault position={[0, 0.3, 0.6]} fov={45} />
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={0.5}
              maxDistance={2}
              target={[0, 0.1, 0]}
            />
            {activeView === 'left' && <LeftView />}
          </Canvas>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveView('left')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              activeView === 'left'
                ? 'bg-orange-500 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Left
          </button>
          <button
            onClick={() => setActiveView('right')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              activeView === 'right'
                ? 'bg-orange-500 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Right
          </button>
          <button
            onClick={() => setActiveView('top')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              activeView === 'top'
                ? 'bg-orange-500 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Top
          </button>
          <button
            onClick={() => setActiveView('bottom')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              activeView === 'bottom'
                ? 'bg-orange-500 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Bottom
          </button>
        </div>

        <div className="mt-3 flex gap-2 pt-3 border-t border-stone-200">
          <button className="flex-1 px-3 py-1 bg-white text-orange-600 border-2 border-orange-500 text-xs font-medium rounded hover:bg-orange-50 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
