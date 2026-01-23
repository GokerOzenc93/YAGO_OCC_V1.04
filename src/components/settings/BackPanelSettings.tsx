import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { SaveButtons } from './SaveButtons';
import { globalSettingsService, GlobalSettingsProfile } from '../GlobalSettingsDatabase';

interface BackPanelSettingsProps {
  profileId: string;
  isDefaultProfile?: boolean;
  onSettingsSaved?: () => void;
}

const CabinetTopView: React.FC<{
  backrestThickness: number;
  viewMode: 'plan' | 'side';
}> = ({ backrestThickness, viewMode }) => {
  const cabinetWidth = 0.14;
  const cabinetDepth = 0.1;
  const panelThickness = 0.018;

  if (viewMode === 'side') {
    const sideHeight = 0.1;
    const topPanelY = sideHeight / 2 - panelThickness / 2;
    const bottomPanelY = -sideHeight / 2 + panelThickness / 2;
    const backPanelZ = -cabinetDepth / 2 + backrestThickness / 2;
    const innerWidth = cabinetWidth - panelThickness * 2;

    return (
      <group>
        <mesh position={[0, topPanelY, 0]}>
          <boxGeometry args={[innerWidth, panelThickness, cabinetDepth]} />
          <meshStandardMaterial color="#d4d4d4" />
        </mesh>
        <lineSegments position={[0, topPanelY, 0]}>
          <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(innerWidth, panelThickness, cabinetDepth)]} />
          <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
        </lineSegments>

        <mesh position={[0, bottomPanelY, 0]}>
          <boxGeometry args={[innerWidth, panelThickness, cabinetDepth]} />
          <meshStandardMaterial color="#d4d4d4" />
        </mesh>
        <lineSegments position={[0, bottomPanelY, 0]}>
          <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(innerWidth, panelThickness, cabinetDepth)]} />
          <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
        </lineSegments>

        <mesh position={[0, 0, backPanelZ]}>
          <boxGeometry args={[innerWidth, sideHeight - panelThickness * 2, backrestThickness]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <lineSegments position={[0, 0, backPanelZ]}>
          <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(innerWidth, sideHeight - panelThickness * 2, backrestThickness)]} />
          <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
        </lineSegments>

        <ambientLight intensity={0.7} />
        <directionalLight position={[-5, 5, 5]} intensity={0.6} />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />
      </group>
    );
  }

  const cabinetHeight = 0.25;
  const leftPanelX = -cabinetWidth / 2 + panelThickness / 2;
  const rightPanelX = cabinetWidth / 2 - panelThickness / 2;
  const backPanelZ = -cabinetDepth / 2 + backrestThickness / 2;

  return (
    <group>
      <mesh position={[leftPanelX, 0, 0]}>
        <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
        <meshStandardMaterial color="#d4d4d4" />
      </mesh>
      <lineSegments position={[leftPanelX, 0, 0]}>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(panelThickness, cabinetHeight, cabinetDepth)]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>

      <mesh position={[rightPanelX, 0, 0]}>
        <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
        <meshStandardMaterial color="#d4d4d4" />
      </mesh>
      <lineSegments position={[rightPanelX, 0, 0]}>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(panelThickness, cabinetHeight, cabinetDepth)]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>

      <mesh position={[0, 0, backPanelZ]}>
        <boxGeometry args={[cabinetWidth - panelThickness * 2, cabinetHeight, backrestThickness]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <lineSegments position={[0, 0, backPanelZ]}>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(cabinetWidth - panelThickness * 2, cabinetHeight, backrestThickness)]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>

      <ambientLight intensity={0.7} />
      <directionalLight position={[0, 5, 5]} intensity={0.6} />
      <directionalLight position={[0, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function BackPanelSettings({
  profileId,
  isDefaultProfile = false,
  onSettingsSaved
}: BackPanelSettingsProps) {
  const [hasSettings, setHasSettings] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [backrestThickness, setBackrestThickness] = React.useState(0.005);
  const [backrestHeight, setBackrestHeight] = React.useState(0.45);
  const [backrestDepth, setBackrestDepth] = React.useState(0.08);
  const [backrestOffsetX, setBackrestOffsetX] = React.useState(0.018);
  const [profiles, setProfiles] = React.useState<GlobalSettingsProfile[]>([]);
  const [viewMode, setViewMode] = React.useState<'plan' | 'side'>('plan');

  React.useEffect(() => {
    loadProfiles();
  }, []);

  React.useEffect(() => {
    if (profiles.length > 0) {
      loadProfileSettings();
    }
  }, [profileId, profiles]);

  const loadProfiles = async () => {
    try {
      const data = await globalSettingsService.listProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      setProfiles([]);
    }
  };

  const loadProfileSettings = async () => {
    try {
      setLoading(true);
      const settings = await globalSettingsService.getProfileSettings(profileId, 'back_panel');

      if (settings && settings.settings) {
        setHasSettings(true);
        loadSettings(settings.settings as Record<string, unknown>);
      } else if (isDefaultProfile) {
        setHasSettings(true);
        resetToDefaults();
      } else {
        setHasSettings(false);
        resetToDefaults();
      }
    } catch (error) {
      console.error('Failed to load profile settings:', error);
      if (isDefaultProfile) {
        setHasSettings(true);
        resetToDefaults();
      } else {
        setHasSettings(false);
        resetToDefaults();
      }
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setBackrestThickness(0.005);
    setBackrestHeight(0.45);
    setBackrestDepth(0.08);
    setBackrestOffsetX(0.018);
  };

  const loadSettings = (settings: Record<string, unknown>) => {
    if (settings.backrestThickness !== undefined)
      setBackrestThickness(settings.backrestThickness as number);
    if (settings.backrestHeight !== undefined)
      setBackrestHeight(settings.backrestHeight as number);
    if (settings.backrestDepth !== undefined)
      setBackrestDepth(settings.backrestDepth as number);
    if (settings.backrestOffsetX !== undefined)
      setBackrestOffsetX(settings.backrestOffsetX as number);
  };

  const getCurrentSettings = () => ({
    backrestThickness,
    backrestHeight,
    backrestDepth,
    backrestOffsetX
  });

  const handleSave = async () => {
    try {
      await globalSettingsService.saveProfileSettings(profileId, 'back_panel', getCurrentSettings());
      setHasSettings(true);
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleSaveAs = async (targetProfileId: string, _profileName: string) => {
    try {
      await globalSettingsService.saveProfileSettings(targetProfileId, 'back_panel', getCurrentSettings());
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!hasSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-stone-400">
        <p className="text-sm mb-4">No back panel settings saved for this profile.</p>
        <button
          onClick={() => {
            setHasSettings(true);
            resetToDefaults();
          }}
          className="px-4 py-2 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors"
        >
          Create Settings
        </button>
      </div>
    );
  }

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-white flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="h-76 border border-stone-200 rounded overflow-hidden mb-3">
          <Canvas>
            <color attach="background" args={['#ffffff']} />
            {viewMode === 'plan' ? (
              <OrthographicCamera makeDefault position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} zoom={1400} />
            ) : (
              <OrthographicCamera makeDefault position={[-1, 0, 0]} rotation={[0, -Math.PI / 2, 0]} zoom={1400} />
            )}
            <CabinetTopView backrestThickness={backrestThickness} viewMode={viewMode} />
          </Canvas>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs text-slate-600">View:</p>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'plan' | 'side')}
            className="text-xs px-2 py-1 bg-transparent border-none focus:outline-none cursor-pointer text-slate-700"
          >
            <option value="plan">Plan</option>
            <option value="side">Side</option>
          </select>
        </div>

        <div className="space-y-1 pt-2 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Backrest Thickness</label>
            <input
              type="number"
              value={backrestThickness}
              onChange={(e) => setBackrestThickness(Number(e.target.value))}
              step="0.001"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Backrest Height</label>
            <input
              type="number"
              value={backrestHeight}
              onChange={(e) => setBackrestHeight(Number(e.target.value))}
              step="0.01"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Backrest Depth</label>
            <input
              type="number"
              value={backrestDepth}
              onChange={(e) => setBackrestDepth(Number(e.target.value))}
              step="0.01"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Backrest Offset</label>
            <input
              type="number"
              value={backrestOffsetX}
              onChange={(e) => setBackrestOffsetX(Number(e.target.value))}
              step="0.001"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      <SaveButtons
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        profiles={profiles}
        currentProfileId={profileId}
      />
    </div>
  );
}
