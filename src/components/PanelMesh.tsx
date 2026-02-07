import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { generatePanelsForShape, PanelData, JointSettings } from './PanelService';
import { globalSettingsService } from './GlobalSettingsDatabase';
import { useAppStore } from '../store';
import type { FaceRole } from '../store';

interface PanelMeshProps {
  geometry: THREE.BufferGeometry;
  faceRoles: Record<number, FaceRole>;
  panelThickness?: number;
}

export const PanelMesh: React.FC<PanelMeshProps> = ({
  geometry,
  faceRoles,
  panelThickness = 18
}) => {
  const [jointSettings, setJointSettings] = useState<JointSettings | undefined>();
  const [loaded, setLoaded] = useState(false);
  const { selectedPanelProfileId } = useAppStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!selectedPanelProfileId) {
          if (!cancelled) setLoaded(true);
          return;
        }

        const settings = await globalSettingsService.getProfileSettings(
          selectedPanelProfileId,
          'panel_joint'
        );
        if (cancelled) return;
        if (settings?.settings) {
          const s = settings.settings as Record<string, unknown>;
          setJointSettings({
            topLeftExpanded: (s.topLeftExpanded as boolean) || false,
            topRightExpanded: (s.topRightExpanded as boolean) || false,
            bottomLeftExpanded: (s.bottomLeftExpanded as boolean) || false,
            bottomRightExpanded: (s.bottomRightExpanded as boolean) || false
          });
        }
      } catch {
        // defaults
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [selectedPanelProfileId]);

  const rolesKey = useMemo(() => JSON.stringify(faceRoles), [faceRoles]);

  const panels: PanelData[] = useMemo(() => {
    if (!loaded || !geometry || !faceRoles) return [];
    const hasRoles = Object.values(faceRoles).some(r => r !== null);
    if (!hasRoles) return [];
    return generatePanelsForShape(geometry, faceRoles, panelThickness, jointSettings);
  }, [geometry, rolesKey, panelThickness, jointSettings, loaded]);

  if (panels.length === 0) return null;

  return (
    <>
      {panels.map((panel, i) => (
        <group key={`panel-${panel.groupIndex}-${i}`}>
          <mesh geometry={panel.geometry} castShadow receiveShadow>
            <meshStandardMaterial
              color="#a0a0a0"
              roughness={0.8}
              metalness={0.0}
              side={THREE.DoubleSide}
            />
          </mesh>
          <lineSegments geometry={panel.edgeGeometry}>
            <lineBasicMaterial color="#555555" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </>
  );
};
