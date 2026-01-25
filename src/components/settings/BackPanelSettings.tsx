import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Text } from '@react-three/drei';
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
  grooveOffset: number;
  grooveDepth: number;
  looseWid: number;
  viewMode: 'plan' | 'side';
}> = ({ backrestThickness, grooveOffset, grooveDepth, looseWid, viewMode }) => {
  const cabinetWidth = 0.14;
  const cabinetDepth = 0.1;
  const panelThickness = 0.018;

  if (viewMode === 'side') {
    const sideHeight = 0.1;
    const topPanelY = sideHeight / 2 - panelThickness / 2;
    const bottomPanelY = -sideHeight / 2 + panelThickness / 2;
    const backPanelZ = -cabinetDepth / 2 + grooveOffset + backrestThickness / 2;
    const innerWidth = cabinetWidth - panelThickness * 2;
    const backPanelHeight = sideHeight - panelThickness * 2 + grooveDepth * 2;

    const dimStartZ = -cabinetDepth / 2;
    const dimEndZ = -cabinetDepth / 2 + grooveOffset + backrestThickness;
    const dimX = 0;
    const dimY = -sideHeight / 2 - 0.012;
    const dimensionValue = (grooveOffset + backrestThickness) * 1000;
    const tickLength = 0.006;
    const textOffset = 0.01;

    return (
      <group>
        <mesh position={[0, topPanelY, 0]}>
          <boxGeometry args={[innerWidth, panelThickness, cabinetDepth]} />
          <meshStandardMaterial color="#d4d4d4" transparent opacity={0.4} />
        </mesh>
        <lineSegments position={[0, topPanelY, 0]}>
          <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(innerWidth, panelThickness, cabinetDepth)]} />
          <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
        </lineSegments>

        <mesh position={[0, bottomPanelY, 0]}>
          <boxGeometry args={[innerWidth, panelThickness, cabinetDepth]} />
          <meshStandardMaterial color="#d4d4d4" transparent opacity={0.4} />
        </mesh>
        <lineSegments position={[0, bottomPanelY, 0]}>
          <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(innerWidth, panelThickness, cabinetDepth)]} />
          <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
        </lineSegments>

        <mesh position={[0, 0, backPanelZ]}>
          <boxGeometry args={[innerWidth + grooveDepth * 2, backPanelHeight, backrestThickness]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <lineSegments position={[0, 0, backPanelZ]}>
          <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(innerWidth + grooveDepth * 2, backPanelHeight, backrestThickness)]} />
          <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
        </lineSegments>

        <line key={`tick-start-side-depth-${dimStartZ}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([dimX, dimY - tickLength, dimStartZ, dimX, dimY + tickLength, dimStartZ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#666666" linewidth={1} />
        </line>

        <line key={`tick-end-side-depth-${dimEndZ}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([dimX, dimY - tickLength, dimEndZ, dimX, dimY + tickLength, dimEndZ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#666666" linewidth={1} />
        </line>

        <Text
          position={[0, dimY - textOffset, (dimStartZ + dimEndZ) / 2]}
          rotation={[0, -Math.PI / 2, 0]}
          fontSize={0.008}
          color="#666666"
          anchorX="center"
          anchorY="middle"
        >
          {dimensionValue.toFixed(1)}
        </Text>

        {(() => {
          const bottomPanelTopEdge = bottomPanelY + panelThickness / 2;
          const grooveBottomEdge = bottomPanelTopEdge - grooveDepth;
          const grooveDepthValue = grooveDepth * 1000;
          const grooveDimZ = -cabinetDepth / 2 - 0.012;
          const grooveTickLength = 0.006;
          const grooveTextOffset = 0.01;
          const thicknessValue = backrestThickness * 1000;

          return (
            <>
              <line key={`tick-groove-top-${grooveDepth}`}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={new Float32Array([0, bottomPanelTopEdge, grooveDimZ - grooveTickLength, 0, bottomPanelTopEdge, grooveDimZ + grooveTickLength])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#666666" linewidth={1} />
              </line>

              <line key={`tick-groove-bottom-${grooveDepth}`}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={new Float32Array([0, grooveBottomEdge, grooveDimZ - grooveTickLength, 0, grooveBottomEdge, grooveDimZ + grooveTickLength])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#666666" linewidth={1} />
              </line>

              <Text
                key={`groove-depth-text-${grooveDepth}`}
                position={[0, (bottomPanelTopEdge + grooveBottomEdge) / 2, grooveDimZ - grooveTextOffset]}
                rotation={[0, -Math.PI / 2, 0]}
                fontSize={0.008}
                color="#666666"
                anchorX="center"
                anchorY="middle"
              >
                {grooveDepthValue.toFixed(1)}
              </Text>

              <mesh position={[0, 0, backPanelZ]} rotation={[0, Math.PI / 2, 0]} renderOrder={999}>
                <planeGeometry args={[0.022, 0.01]} />
                <meshBasicMaterial color="#ffffff" depthTest={false} />
              </mesh>
              <Text
                key={`thickness-text-${backrestThickness}`}
                position={[0, 0, backPanelZ]}
                rotation={[0, -Math.PI / 2, 0]}
                fontSize={0.008}
                color="#666666"
                anchorX="center"
                anchorY="middle"
                renderOrder={1000}
                depthOffset={-1}
              >
                {thicknessValue.toFixed(1)}
              </Text>
            </>
          );
        })()}

        <ambientLight intensity={0.7} />
        <directionalLight position={[-5, 5, 5]} intensity={0.6} />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />
      </group>
    );
  }

  const cabinetHeight = 0.25;
  const leftPanelX = -cabinetWidth / 2 + panelThickness / 2;
  const rightPanelX = cabinetWidth / 2 - panelThickness / 2;
  const backPanelZ = -cabinetDepth / 2 + grooveOffset + backrestThickness / 2;

  const dimStartZ = -cabinetDepth / 2;
  const dimEndZ = -cabinetDepth / 2 + grooveOffset + backrestThickness;
  const dimX = leftPanelX - panelThickness / 2 - 0.008;
  const dimY = 0;
  const dimensionValue = (grooveOffset + backrestThickness) * 1000;
  const tickLength = 0.006;
  const textOffset = 0.012;

  return (
    <group>
      <mesh position={[leftPanelX, 0, 0]}>
        <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
        <meshStandardMaterial color="#d4d4d4" transparent opacity={0.4} />
      </mesh>
      <lineSegments position={[leftPanelX, 0, 0]}>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(panelThickness, cabinetHeight, cabinetDepth)]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>

      <mesh position={[rightPanelX, 0, 0]}>
        <boxGeometry args={[panelThickness, cabinetHeight, cabinetDepth]} />
        <meshStandardMaterial color="#d4d4d4" transparent opacity={0.4} />
      </mesh>
      <lineSegments position={[rightPanelX, 0, 0]}>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(panelThickness, cabinetHeight, cabinetDepth)]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>

      <mesh position={[0, 0, backPanelZ]}>
        <boxGeometry args={[cabinetWidth - panelThickness * 2 + grooveDepth * 2, cabinetHeight, backrestThickness]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <lineSegments position={[0, 0, backPanelZ]}>
        <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(cabinetWidth - panelThickness * 2 + grooveDepth * 2, cabinetHeight, backrestThickness)]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={2} />
      </lineSegments>

      <line key={`tick-start-plan-${dimStartZ}`}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([dimX, dimY, dimStartZ, dimX - tickLength, dimY, dimStartZ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666666" linewidth={1} />
      </line>

      <line key={`tick-end-plan-${dimEndZ}`}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([dimX, dimY, dimEndZ, dimX - tickLength, dimY, dimEndZ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666666" linewidth={1} />
      </line>

      <Text
        position={[dimX - textOffset, dimY, (dimStartZ + dimEndZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.008}
        color="#666666"
        anchorX="right"
        anchorY="middle"
      >
        {dimensionValue.toFixed(1)}
      </Text>

      {(() => {
        const backPanelLeftEdge = -((cabinetWidth - panelThickness * 2) / 2 + grooveDepth);
        const sidePanelInnerEdge = leftPanelX + panelThickness / 2;
        const widthDimValue = (looseWid + grooveDepth) * 1000;
        const widthDimStartX = backPanelLeftEdge;
        const widthDimEndX = sidePanelInnerEdge;
        const widthDimZ = -cabinetDepth / 2 - 0.008;
        const widthTickLength = 0.006;
        const widthTextOffset = 0.012;

        return (
          <>
            <line key={`tick-start-width-${widthDimStartX}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([widthDimStartX, dimY, widthDimZ, widthDimStartX, dimY, widthDimZ - widthTickLength])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#666666" linewidth={1} />
            </line>

            <line key={`tick-end-width-${widthDimEndX}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([widthDimEndX, dimY, widthDimZ, widthDimEndX, dimY, widthDimZ - widthTickLength])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#666666" linewidth={1} />
            </line>

            <Text
              position={[(widthDimStartX + widthDimEndX) / 2, dimY, widthDimZ - widthTextOffset]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.008}
              color="#666666"
              anchorX="center"
              anchorY="middle"
            >
              {widthDimValue.toFixed(1)}
            </Text>
          </>
        );
      })()}

      {(() => {
        const thicknessDimValue = backrestThickness * 1000;
        const thicknessDimStartZ = backPanelZ - backrestThickness / 2;
        const thicknessDimEndZ = backPanelZ + backrestThickness / 2;
        const thicknessDimX = 0;
        const thicknessTickLength = 0.006;

        return (
          <>
            <line key={`tick-start-thickness-${thicknessDimStartZ}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([thicknessDimX - thicknessTickLength, dimY, thicknessDimStartZ, thicknessDimX + thicknessTickLength, dimY, thicknessDimStartZ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#666666" linewidth={1} />
            </line>

            <line key={`tick-end-thickness-${thicknessDimEndZ}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([thicknessDimX - thicknessTickLength, dimY, thicknessDimEndZ, thicknessDimX + thicknessTickLength, dimY, thicknessDimEndZ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#666666" linewidth={1} />
            </line>

            <mesh position={[thicknessDimX, dimY, (thicknessDimStartZ + thicknessDimEndZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
              <planeGeometry args={[0.022, 0.01]} />
              <meshBasicMaterial color="#ffffff" depthTest={false} />
            </mesh>
            <Text
              position={[thicknessDimX, dimY, (thicknessDimStartZ + thicknessDimEndZ) / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.008}
              color="#666666"
              anchorX="center"
              anchorY="middle"
              renderOrder={1000}
              depthOffset={-1}
            >
              {thicknessDimValue.toFixed(1)}
            </Text>
          </>
        );
      })()}

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
  const [looseWid, setLooseWid] = React.useState(0.5);
  const [looseDep, setLooseDep] = React.useState(1);
  const [backPanelThickness, setBackPanelThickness] = React.useState(8);
  const [grooveOffset, setGrooveOffset] = React.useState(12);
  const [grooveDepth, setGrooveDepth] = React.useState(8);
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
    setLooseWid(0.5);
    setLooseDep(1);
    setBackPanelThickness(8);
    setGrooveOffset(12);
    setGrooveDepth(8);
  };

  const loadSettings = (settings: Record<string, unknown>) => {
    if (settings.looseWid !== undefined)
      setLooseWid(settings.looseWid as number);
    if (settings.looseDep !== undefined)
      setLooseDep(settings.looseDep as number);
    if (settings.backPanelThickness !== undefined)
      setBackPanelThickness(settings.backPanelThickness as number);
    if (settings.grooveOffset !== undefined)
      setGrooveOffset(settings.grooveOffset as number);
    if (settings.grooveDepth !== undefined)
      setGrooveDepth(settings.grooveDepth as number);
  };

  const getCurrentSettings = () => ({
    looseWid,
    looseDep,
    backPanelThickness,
    grooveOffset,
    grooveDepth
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
        <div className="h-80 border border-stone-200 rounded overflow-hidden mb-3">
          <Canvas>
            <color attach="background" args={['#ffffff']} />
            {viewMode === 'plan' ? (
              <OrthographicCamera makeDefault position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]} zoom={1400} />
            ) : (
              <OrthographicCamera makeDefault position={[-1, 0, 0]} rotation={[0, -Math.PI / 2, 0]} zoom={1400} />
            )}
            <CabinetTopView backrestThickness={backPanelThickness / 1000} grooveOffset={grooveOffset / 1000} grooveDepth={grooveDepth / 1000} looseWid={looseWid / 1000} viewMode={viewMode} />
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
            <label className="text-xs text-slate-600">Loosewid</label>
            <input
              type="number"
              value={looseWid}
              onChange={(e) => setLooseWid(Number(e.target.value))}
              step="0.1"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Loosedep</label>
            <input
              type="number"
              value={looseDep}
              onChange={(e) => setLooseDep(Number(e.target.value))}
              step="0.1"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Back panel thickness</label>
            <input
              type="number"
              value={backPanelThickness}
              onChange={(e) => setBackPanelThickness(Number(e.target.value))}
              step="0.1"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Groove offset</label>
            <input
              type="number"
              value={grooveOffset}
              onChange={(e) => setGrooveOffset(Number(e.target.value))}
              step="0.1"
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Groove depth</label>
            <input
              type="number"
              value={grooveDepth}
              onChange={(e) => setGrooveDepth(Number(e.target.value))}
              step="0.1"
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
