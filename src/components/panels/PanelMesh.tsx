import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { PanelInstance } from '../../types/Panel';
import { PanelFactory } from './PanelFactory';
import { PanelMeshData } from './BasePanelGeometry';

interface PanelMeshProps {
  panel: PanelInstance;
  color?: string;
  opacity?: number;
}

export function PanelMesh({ panel, color = '#d4a574', opacity = 1 }: PanelMeshProps) {
  const [meshData, setMeshData] = useState<PanelMeshData | null>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    generatePanelMesh();
  }, [panel]);

  useEffect(() => {
    if (meshData) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
      geo.setIndex(new THREE.BufferAttribute(meshData.faces, 1));
      geo.computeVertexNormals();
      setGeometry(geo);

      return () => {
        geo.dispose();
      };
    }
  }, [meshData]);

  const generatePanelMesh = async () => {
    try {
      const panelGeometry = PanelFactory.createPanel(panel.panelGeometry);
      const data = await panelGeometry.generateMesh();
      setMeshData(data);
    } catch (error) {
      console.error('Error generating panel mesh:', error);
    }
  };

  if (!geometry || !panel.visible) return null;

  const position: [number, number, number] = [
    panel.position.x,
    panel.position.y,
    panel.position.z,
  ];

  const rotation: [number, number, number] = [
    panel.rotation.x,
    panel.rotation.y,
    panel.rotation.z,
  ];

  return (
    <mesh geometry={geometry} position={position} rotation={rotation}>
      <meshStandardMaterial
        color={color}
        opacity={opacity}
        transparent={opacity < 1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
