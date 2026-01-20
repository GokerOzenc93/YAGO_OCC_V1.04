import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store';

interface PanelConfig {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  back: boolean;
  door: boolean;
}

const Cabinet3D: React.FC<{
  jointType: 'ayakli' | 'ayaksiz' | 'bazali';
  panels: PanelConfig;
  selectedPanel: string | null;
  onPanelClick: (panel: string) => void;
}> = ({ jointType, panels, selectedPanel, onPanelClick }) => {
  const cabinetWidth = 3;
  const cabinetHeight = 4;
  const cabinetDepth = 2;
  const panelThickness = 0.1;
  const legHeight = 0.5;
  const baseHeight = 0.25;

  const cabinetY = jointType === 'ayakli' ? legHeight : jointType === 'bazali' ? baseHeight : 0;

  const handlePanelClick = (e: any, panelName: string) => {
    e.stopPropagation();
    onPanelClick(panelName);
  };

  const getPanelColor = (panelName: string, isEnabled: boolean) => {
    if (!isEnabled) return '#cccccc';
    if (selectedPanel === panelName) return '#f97316';
    return '#8b5a2b';
  };

  return (
    <group>
      {panels.left && (
        <mesh
          position={[-cabinetWidth / 2 - panelThickness / 2, cabinetY + cabinetHeight / 2, 0]}
          onClick={(e) => handlePanelClick(e, 'left')}
        >
          <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
          <meshStandardMaterial
            color={getPanelColor('left', panels.left)}
            emissive={selectedPanel === 'left' ? '#ff6600' : '#000000'}
            emissiveIntensity={selectedPanel === 'left' ? 0.3 : 0}
          />
        </mesh>
      )}

      {panels.right && (
        <mesh
          position={[cabinetWidth / 2 + panelThickness / 2, cabinetY + cabinetHeight / 2, 0]}
          onClick={(e) => handlePanelClick(e, 'right')}
        >
          <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
          <meshStandardMaterial
            color={getPanelColor('right', panels.right)}
            emissive={selectedPanel === 'right' ? '#ff6600' : '#000000'}
            emissiveIntensity={selectedPanel === 'right' ? 0.3 : 0}
          />
        </mesh>
      )}

      {panels.top && (
        <mesh
          position={[0, cabinetY + cabinetHeight + panelThickness / 2, 0]}
          onClick={(e) => handlePanelClick(e, 'top')}
        >
          <boxGeometry args={[cabinetWidth, panelThickness, cabinetDepth]} />
          <meshStandardMaterial
            color={getPanelColor('top', panels.top)}
            emissive={selectedPanel === 'top' ? '#ff6600' : '#000000'}
            emissiveIntensity={selectedPanel === 'top' ? 0.3 : 0}
          />
        </mesh>
      )}

      {panels.bottom && (
        <mesh
          position={[0, cabinetY - panelThickness / 2, 0]}
          onClick={(e) => handlePanelClick(e, 'bottom')}
        >
          <boxGeometry args={[cabinetWidth, panelThickness, cabinetDepth]} />
          <meshStandardMaterial
            color={getPanelColor('bottom', panels.bottom)}
            emissive={selectedPanel === 'bottom' ? '#ff6600' : '#000000'}
            emissiveIntensity={selectedPanel === 'bottom' ? 0.3 : 0}
          />
        </mesh>
      )}

      {panels.back && (
        <mesh
          position={[0, cabinetY + cabinetHeight / 2, -cabinetDepth / 2 - panelThickness / 2]}
          onClick={(e) => handlePanelClick(e, 'back')}
        >
          <boxGeometry args={[cabinetWidth, cabinetHeight, panelThickness]} />
          <meshStandardMaterial
            color={getPanelColor('back', panels.back)}
            emissive={selectedPanel === 'back' ? '#ff6600' : '#000000'}
            emissiveIntensity={selectedPanel === 'back' ? 0.3 : 0}
          />
        </mesh>
      )}

      {panels.door && (
        <mesh
          position={[0, cabinetY + cabinetHeight / 2, cabinetDepth / 2 + panelThickness / 2]}
          onClick={(e) => handlePanelClick(e, 'door')}
        >
          <boxGeometry args={[cabinetWidth - 0.2, cabinetHeight - 0.2, panelThickness]} />
          <meshStandardMaterial
            color={getPanelColor('door', panels.door)}
            emissive={selectedPanel === 'door' ? '#ff6600' : '#000000'}
            emissiveIntensity={selectedPanel === 'door' ? 0.3 : 0}
          />
        </mesh>
      )}

      {jointType === 'ayakli' && (
        <>
          <mesh position={[-cabinetWidth / 2 + 0.3, legHeight / 2, -cabinetDepth / 2 + 0.3]}>
            <cylinderGeometry args={[0.05, 0.07, legHeight, 8]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
          <mesh position={[cabinetWidth / 2 - 0.3, legHeight / 2, -cabinetDepth / 2 + 0.3]}>
            <cylinderGeometry args={[0.05, 0.07, legHeight, 8]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
          <mesh position={[-cabinetWidth / 2 + 0.3, legHeight / 2, cabinetDepth / 2 - 0.3]}>
            <cylinderGeometry args={[0.05, 0.07, legHeight, 8]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
          <mesh position={[cabinetWidth / 2 - 0.3, legHeight / 2, cabinetDepth / 2 - 0.3]}>
            <cylinderGeometry args={[0.05, 0.07, legHeight, 8]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
        </>
      )}

      {jointType === 'bazali' && (
        <mesh position={[0, baseHeight / 2, 0]}>
          <boxGeometry args={[cabinetWidth + 0.2, baseHeight, cabinetDepth + 0.2]} />
          <meshStandardMaterial color="#4a3319" />
        </mesh>
      )}

      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function PanelJointSettings() {
  const { panelJointType, setPanelJointType } = useAppStore();
  const [panels, setPanels] = useState<PanelConfig>({
    left: true,
    right: true,
    top: true,
    bottom: true,
    back: true,
    door: true
  });
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);

  const togglePanel = (panelName: keyof PanelConfig) => {
    setPanels(prev => ({
      ...prev,
      [panelName]: !prev[panelName]
    }));
  };

  const handlePanelClick = (panelName: string) => {
    setSelectedPanel(panelName === selectedPanel ? null : panelName);
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Panel Birleşim Tipi</h3>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setPanelJointType('ayakli')}
          className={`p-2 border-2 rounded transition-all text-xs ${
            panelJointType === 'ayakli'
              ? 'border-orange-500 bg-orange-50 font-semibold'
              : 'border-stone-200 hover:border-orange-300'
          }`}
        >
          Ayaklı
        </button>

        <button
          onClick={() => setPanelJointType('ayaksiz')}
          className={`p-2 border-2 rounded transition-all text-xs ${
            panelJointType === 'ayaksiz'
              ? 'border-orange-500 bg-orange-50 font-semibold'
              : 'border-stone-200 hover:border-orange-300'
          }`}
        >
          Ayaksız
        </button>

        <button
          onClick={() => setPanelJointType('bazali')}
          className={`p-2 border-2 rounded transition-all text-xs ${
            panelJointType === 'bazali'
              ? 'border-orange-500 bg-orange-50 font-semibold'
              : 'border-stone-200 hover:border-orange-300'
          }`}
        >
          Bazalı
        </button>
      </div>

      <div className="flex-1 border-2 border-stone-200 rounded-lg overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 mb-3">
        <Canvas shadows>
          <color attach="background" args={['#f8fafc']} />
          <PerspectiveCamera makeDefault position={[6, 4, 6]} fov={45} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={3}
            maxDistance={15}
          />
          <Cabinet3D
            jointType={panelJointType}
            panels={panels}
            selectedPanel={selectedPanel}
            onPanelClick={handlePanelClick}
          />
          <gridHelper args={[10, 10, '#cbd5e1', '#e2e8f0']} position={[0, 0, 0]} />
        </Canvas>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700 mb-1">Panel Seçimi</div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(panels).map(([key, value]) => (
            <button
              key={key}
              onClick={() => togglePanel(key as keyof PanelConfig)}
              className={`px-2 py-1 text-xs rounded border transition-all ${
                value
                  ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                  : 'bg-stone-50 border-stone-300 text-stone-500'
              } ${selectedPanel === key ? 'ring-2 ring-orange-400' : ''}`}
            >
              {key === 'left' ? 'Sol' :
               key === 'right' ? 'Sağ' :
               key === 'top' ? 'Üst' :
               key === 'bottom' ? 'Alt' :
               key === 'back' ? 'Arka' : 'Kapı'}
            </button>
          ))}
        </div>
      </div>

      {selectedPanel && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
          <span className="font-semibold text-orange-900">Seçili Panel: </span>
          <span className="text-orange-700">
            {selectedPanel === 'left' ? 'Sol' :
             selectedPanel === 'right' ? 'Sağ' :
             selectedPanel === 'top' ? 'Üst' :
             selectedPanel === 'bottom' ? 'Alt' :
             selectedPanel === 'back' ? 'Arka' : 'Kapı'}
          </span>
        </div>
      )}
    </div>
  );
}
