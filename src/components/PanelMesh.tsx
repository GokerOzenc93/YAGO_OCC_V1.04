import React from 'react';
import * as THREE from 'three';
import { useAppStore, GeneratedPanel } from '../store';

interface PanelMeshProps {
  panel: GeneratedPanel;
}

const PanelMesh: React.FC<PanelMeshProps> = ({ panel }) => {
  const {
    selectedPanelId,
    setSelectedPanelId,
    hoveredPanelId,
    setHoveredPanelId,
    panelMode
  } = useAppStore();

  const isSelected = panelMode && selectedPanelId === panel.id;
  const isHovered = panelMode && hoveredPanelId === panel.id;

  const handleClick = (e: THREE.Event) => {
    if (!panelMode) return;
    e.stopPropagation();
    setSelectedPanelId(isSelected ? null : panel.id);
  };

  const handlePointerOver = (e: THREE.Event) => {
    if (!panelMode) return;
    e.stopPropagation();
    setHoveredPanelId(panel.id);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    if (!panelMode) return;
    setHoveredPanelId(null);
    document.body.style.cursor = 'auto';
  };

  const color = isSelected ? '#ef4444' : (isHovered ? '#f97316' : panel.color);

  return (
    <group position={panel.position} rotation={panel.rotation}>
      <mesh
        geometry={panel.geometry}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.1}
          side={THREE.FrontSide}
          flatShading={false}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry attach="geometry" args={[panel.geometry, 15]} />
        <lineBasicMaterial
          attach="material"
          color={isSelected ? '#dc2626' : '#333333'}
        />
      </lineSegments>
    </group>
  );
};

export const GeneratedPanelsMesh: React.FC = () => {
  const { generatedPanels } = useAppStore();

  if (generatedPanels.length === 0) {
    return null;
  }

  return (
    <>
      {generatedPanels.map((panel) => (
        <PanelMesh key={panel.id} panel={panel} />
      ))}
    </>
  );
};

export default PanelMesh;
