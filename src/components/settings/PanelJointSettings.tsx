import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight, Save, Plus, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { supabase } from '../Database';

interface PanelJointPreset {
  id: string;
  name: string;
  settings: any;
  is_default: boolean;
}

const SaveAsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = React.useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-900">Save Preset As</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Enter preset name"
          className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-orange-500"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const Arrow: React.FC<{
  position: [number, number, number];
  direction: 'left' | 'right';
  isReversed: boolean;
  onClick: () => void;
}> = ({ position, direction, isReversed, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  let rotation: [number, number, number];
  if (direction === 'left') {
    rotation = isReversed ? [0, 0, -Math.PI / 2] : [0, 0, Math.PI / 2];
  } else {
    rotation = isReversed ? [0, 0, Math.PI / 2] : [0, 0, -Math.PI / 2];
  }

  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <coneGeometry args={[0.025, 0.05, 8]} />
      <meshStandardMaterial color={hovered ? "#f97316" : "#3b82f6"} />
    </mesh>
  );
};

const Panel: React.FC<{
  id: string;
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  isSelected: boolean;
  onSelect: () => void;
  onShrinkLeft?: () => void;
  onShrinkRight?: () => void;
  showArrows: boolean;
  isLeftExpanded?: boolean;
  isRightExpanded?: boolean;
}> = ({ id, position, args, color, isSelected, onSelect, onShrinkLeft, onShrinkRight, showArrows, isLeftExpanded, isRightExpanded }) => {
  const geometry = new THREE.BoxGeometry(...args);
  const edges = new THREE.EdgesGeometry(geometry);

  const displayColor = isSelected ? "#ef4444" : color;

  return (
    <group position={position}>
      <mesh onClick={onSelect}>
        <boxGeometry args={args} />
        <meshStandardMaterial color={displayColor} />
      </mesh>
      <lineSegments>
        <edgesGeometry attach="geometry" args={[geometry]} />
        <lineBasicMaterial attach="material" color="#000000" linewidth={3} />
      </lineSegments>

      {isSelected && showArrows && onShrinkLeft && (
        <Arrow
          position={[-args[0] / 2 + 0.055, -args[1] / 2 + 0.08, 0]}
          direction="left"
          isReversed={isLeftExpanded || false}
          onClick={onShrinkLeft}
        />
      )}

      {isSelected && showArrows && onShrinkRight && (
        <Arrow
          position={[args[0] / 2 - 0.055, -args[1] / 2 + 0.08, 0]}
          direction="right"
          isReversed={isRightExpanded || false}
          onClick={onShrinkRight}
        />
      )}
    </group>
  );
};

const Cabinet3D: React.FC<{
  topPanelWidth: number;
  bottomPanelWidth: number;
  topPanelPositionX: number;
  bottomPanelPositionX: number;
  selectedPanel: string | null;
  onSelectPanel: (id: string) => void;
  onShrinkPanel: (id: string, direction: 'left' | 'right') => void;
  topLeftExpanded: boolean;
  topRightExpanded: boolean;
  bottomLeftExpanded: boolean;
  bottomRightExpanded: boolean;
  leftPanelHeight: number;
  leftPanelPositionY: number;
  rightPanelHeight: number;
  rightPanelPositionY: number;
  selectedBodyType: string | null;
  bazaHeight: number;
  frontBaseDistance: number;
  backBaseDistance: number;
  legHeight: number;
  legDiameter: number;
  legFrontDistance: number;
  legBackDistance: number;
  legSideDistance: number;
}> = ({ topPanelWidth, bottomPanelWidth, topPanelPositionX, bottomPanelPositionX, selectedPanel, onSelectPanel, onShrinkPanel, topLeftExpanded, topRightExpanded, bottomLeftExpanded, bottomRightExpanded, leftPanelHeight, leftPanelPositionY, rightPanelHeight, rightPanelPositionY, selectedBodyType, bazaHeight, frontBaseDistance, backBaseDistance, legHeight, legDiameter, legFrontDistance, legBackDistance, legSideDistance }) => {
  const cabinetWidth = 0.45;
  const cabinetHeight = 0.55;
  const cabinetDepth = 0.25;
  const panelThickness = 0.018;
  const baseHeightInMeters = bazaHeight / 1000;
  const legHeightInMeters = legHeight / 1000;
  const legDiameterInMeters = legDiameter / 1000;
  const legFrontDistanceInMeters = legFrontDistance / 1000;
  const legBackDistanceInMeters = legBackDistance / 1000;
  const legSideDistanceInMeters = legSideDistance / 1000;

  return (
    <group>
      <Panel
        id="left"
        position={[-cabinetWidth / 2 - panelThickness / 2, leftPanelPositionY, 0]}
        args={[panelThickness, leftPanelHeight, cabinetDepth]}
        color="#f5f5f4"
        isSelected={false}
        onSelect={() => {}}
        showArrows={false}
      />

      <Panel
        id="right"
        position={[cabinetWidth / 2 + panelThickness / 2, rightPanelPositionY, 0]}
        args={[panelThickness, rightPanelHeight, cabinetDepth]}
        color="#f5f5f4"
        isSelected={false}
        onSelect={() => {}}
        showArrows={false}
      />

      <Panel
        id="top"
        position={[topPanelPositionX, cabinetHeight + panelThickness / 2, 0]}
        args={[topPanelWidth, panelThickness, cabinetDepth]}
        color="#fed7aa"
        isSelected={selectedPanel === 'top'}
        onSelect={() => onSelectPanel('top')}
        onShrinkLeft={() => onShrinkPanel('top', 'left')}
        onShrinkRight={() => onShrinkPanel('top', 'right')}
        showArrows={true}
        isLeftExpanded={topLeftExpanded}
        isRightExpanded={topRightExpanded}
      />

      <Panel
        id="bottom"
        position={[bottomPanelPositionX, -panelThickness / 2, 0]}
        args={[bottomPanelWidth, panelThickness, cabinetDepth]}
        color="#fed7aa"
        isSelected={selectedPanel === 'bottom'}
        onSelect={() => selectedBodyType !== 'bazali' && onSelectPanel('bottom')}
        onShrinkLeft={() => onShrinkPanel('bottom', 'left')}
        onShrinkRight={() => onShrinkPanel('bottom', 'right')}
        showArrows={selectedBodyType !== 'bazali'}
        isLeftExpanded={bottomLeftExpanded}
        isRightExpanded={bottomRightExpanded}
      />

      {selectedBodyType === 'bazali' && (
        <>
          <Panel
            id="base-front"
            position={[0, -baseHeightInMeters / 2 - panelThickness, cabinetDepth / 2 - (frontBaseDistance / 1000) - panelThickness / 2]}
            args={[cabinetWidth, baseHeightInMeters, panelThickness]}
            color="#f5f5f4"
            isSelected={false}
            onSelect={() => {}}
            showArrows={false}
          />
          <Panel
            id="base-back"
            position={[0, -baseHeightInMeters / 2 - panelThickness, -cabinetDepth / 2 + (backBaseDistance / 1000) + panelThickness / 2]}
            args={[cabinetWidth, baseHeightInMeters, panelThickness]}
            color="#f5f5f4"
            isSelected={false}
            onSelect={() => {}}
            showArrows={false}
          />
        </>
      )}

      {selectedBodyType === 'ayakli' && (
        <>
          <mesh position={[-cabinetWidth / 2 + legSideDistanceInMeters, -legHeightInMeters / 2 - panelThickness, cabinetDepth / 2 - legFrontDistanceInMeters]}>
            <cylinderGeometry args={[legDiameterInMeters / 2, legDiameterInMeters / 2, legHeightInMeters, 16]} />
            <meshStandardMaterial color="#71717a" />
          </mesh>
          <mesh position={[cabinetWidth / 2 - legSideDistanceInMeters, -legHeightInMeters / 2 - panelThickness, cabinetDepth / 2 - legFrontDistanceInMeters]}>
            <cylinderGeometry args={[legDiameterInMeters / 2, legDiameterInMeters / 2, legHeightInMeters, 16]} />
            <meshStandardMaterial color="#71717a" />
          </mesh>
          <mesh position={[-cabinetWidth / 2 + legSideDistanceInMeters, -legHeightInMeters / 2 - panelThickness, -cabinetDepth / 2 + legBackDistanceInMeters]}>
            <cylinderGeometry args={[legDiameterInMeters / 2, legDiameterInMeters / 2, legHeightInMeters, 16]} />
            <meshStandardMaterial color="#71717a" />
          </mesh>
          <mesh position={[cabinetWidth / 2 - legSideDistanceInMeters, -legHeightInMeters / 2 - panelThickness, -cabinetDepth / 2 + legBackDistanceInMeters]}>
            <cylinderGeometry args={[legDiameterInMeters / 2, legDiameterInMeters / 2, legHeightInMeters, 16]} />
            <meshStandardMaterial color="#71717a" />
          </mesh>
        </>
      )}

      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    </group>
  );
};

export function PanelJointSettings() {
  const {
    bazaHeight, setBazaHeight, frontBaseDistance, setFrontBaseDistance, backBaseDistance, setBackBaseDistance,
    legHeight, setLegHeight, legDiameter, setLegDiameter, legFrontDistance, setLegFrontDistance,
    legBackDistance, setLegBackDistance, legSideDistance, setLegSideDistance
  } = useAppStore();

  const [selectedBodyType, setSelectedBodyType] = React.useState<string | null>('ayaksiz');
  const [selectedPanel, setSelectedPanel] = React.useState<string | null>(null);
  const [topPanelWidth, setTopPanelWidth] = React.useState(0.45);
  const [bottomPanelWidth, setBottomPanelWidth] = React.useState(0.45);
  const [topPanelPositionX, setTopPanelPositionX] = React.useState(0);
  const [bottomPanelPositionX, setBottomPanelPositionX] = React.useState(0);

  const [presets, setPresets] = React.useState<PanelJointPreset[]>([]);
  const [currentPresetId, setCurrentPresetId] = React.useState<string | null>(null);
  const [showSaveAsDialog, setShowSaveAsDialog] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<string>('default');

  const cabinetHeight = 0.55;
  const panelThickness = 0.018;
  const baseHeightInMeters = bazaHeight / 1000;
  const initialSidePanelHeight = cabinetHeight + 2 * panelThickness;

  const [leftPanelHeight, setLeftPanelHeight] = React.useState(initialSidePanelHeight);
  const [leftPanelPositionY, setLeftPanelPositionY] = React.useState(cabinetHeight / 2);
  const [rightPanelHeight, setRightPanelHeight] = React.useState(initialSidePanelHeight);
  const [rightPanelPositionY, setRightPanelPositionY] = React.useState(cabinetHeight / 2);

  const [topLeftExpanded, setTopLeftExpanded] = React.useState(false);
  const [topRightExpanded, setTopRightExpanded] = React.useState(false);
  const [bottomLeftExpanded, setBottomLeftExpanded] = React.useState(false);
  const [bottomRightExpanded, setBottomRightExpanded] = React.useState(false);

  React.useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const { data, error } = await supabase
      .from('panel_joint_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (data && !error) {
      setPresets(data);
    }
  };

  const getCurrentSettings = () => ({
    selectedBodyType,
    topPanelWidth,
    bottomPanelWidth,
    topPanelPositionX,
    bottomPanelPositionX,
    topLeftExpanded,
    topRightExpanded,
    bottomLeftExpanded,
    bottomRightExpanded,
    leftPanelHeight,
    leftPanelPositionY,
    rightPanelHeight,
    rightPanelPositionY,
    bazaHeight,
    frontBaseDistance,
    backBaseDistance,
    legHeight,
    legDiameter,
    legFrontDistance,
    legBackDistance,
    legSideDistance,
  });

  const applySettings = (settings: any) => {
    setSelectedBodyType(settings.selectedBodyType);
    setTopPanelWidth(settings.topPanelWidth);
    setBottomPanelWidth(settings.bottomPanelWidth);
    setTopPanelPositionX(settings.topPanelPositionX);
    setBottomPanelPositionX(settings.bottomPanelPositionX);
    setTopLeftExpanded(settings.topLeftExpanded);
    setTopRightExpanded(settings.topRightExpanded);
    setBottomLeftExpanded(settings.bottomLeftExpanded);
    setBottomRightExpanded(settings.bottomRightExpanded);
    setLeftPanelHeight(settings.leftPanelHeight);
    setLeftPanelPositionY(settings.leftPanelPositionY);
    setRightPanelHeight(settings.rightPanelHeight);
    setRightPanelPositionY(settings.rightPanelPositionY);
    setBazaHeight(settings.bazaHeight);
    setFrontBaseDistance(settings.frontBaseDistance);
    setBackBaseDistance(settings.backBaseDistance);
    setLegHeight(settings.legHeight);
    setLegDiameter(settings.legDiameter);
    setLegFrontDistance(settings.legFrontDistance);
    setLegBackDistance(settings.legBackDistance);
    setLegSideDistance(settings.legSideDistance);
  };

  const handleSave = async () => {
    if (!currentPresetId) return;

    const settings = getCurrentSettings();
    const { error } = await supabase
      .from('panel_joint_types')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', currentPresetId);

    if (!error) {
      await loadPresets();
    }
  };

  const handleSaveAs = async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const settings = getCurrentSettings();
    const { data, error } = await supabase
      .from('panel_joint_types')
      .insert({
        name,
        settings,
        is_default: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (data && !error) {
      await loadPresets();
      setCurrentPresetId(data.id);
      setSelectedPreset(data.id);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId === 'default') {
      setCurrentPresetId(null);
      return;
    }

    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setCurrentPresetId(preset.id);
      applySettings(preset.settings);
    }
  };

  React.useEffect(() => {
    setTopPanelWidth(0.45);
    setBottomPanelWidth(0.45);
    setTopPanelPositionX(0);
    setBottomPanelPositionX(0);
    setTopLeftExpanded(false);
    setTopRightExpanded(false);
    setBottomLeftExpanded(false);
    setBottomRightExpanded(false);
    setSelectedPanel(null);

    if (selectedBodyType === 'bazali') {
      const bazaliHeight = initialSidePanelHeight + baseHeightInMeters;
      setLeftPanelHeight(bazaliHeight);
      setLeftPanelPositionY(cabinetHeight / 2 - baseHeightInMeters / 2);
      setRightPanelHeight(bazaliHeight);
      setRightPanelPositionY(cabinetHeight / 2 - baseHeightInMeters / 2);
    } else {
      setLeftPanelHeight(initialSidePanelHeight);
      setLeftPanelPositionY(cabinetHeight / 2);
      setRightPanelHeight(initialSidePanelHeight);
      setRightPanelPositionY(cabinetHeight / 2);
    }
  }, [selectedBodyType, bazaHeight]);

  const handleSelectPanel = (id: string) => {
    setSelectedPanel(selectedPanel === id ? null : id);
  };

  const handleShrinkPanel = (id: string, direction: 'left' | 'right') => {
    const changeAmount = 0.018;

    if (id === 'top') {
      if (direction === 'left') {
        if (topLeftExpanded) {
          setTopPanelWidth(prev => prev - changeAmount);
          setTopPanelPositionX(prev => prev + changeAmount / 2);
          setTopLeftExpanded(false);
          setLeftPanelHeight(prev => prev + changeAmount);
          setLeftPanelPositionY(prev => prev + changeAmount / 2);
        } else {
          setTopPanelWidth(prev => prev + changeAmount);
          setTopPanelPositionX(prev => prev - changeAmount / 2);
          setTopLeftExpanded(true);
          setLeftPanelHeight(prev => prev - changeAmount);
          setLeftPanelPositionY(prev => prev - changeAmount / 2);
        }
      } else {
        if (topRightExpanded) {
          setTopPanelWidth(prev => prev - changeAmount);
          setTopPanelPositionX(prev => prev - changeAmount / 2);
          setTopRightExpanded(false);
          setRightPanelHeight(prev => prev + changeAmount);
          setRightPanelPositionY(prev => prev + changeAmount / 2);
        } else {
          setTopPanelWidth(prev => prev + changeAmount);
          setTopPanelPositionX(prev => prev + changeAmount / 2);
          setTopRightExpanded(true);
          setRightPanelHeight(prev => prev - changeAmount);
          setRightPanelPositionY(prev => prev - changeAmount / 2);
        }
      }
    } else if (id === 'bottom') {
      if (direction === 'left') {
        if (bottomLeftExpanded) {
          setBottomPanelWidth(prev => prev - changeAmount);
          setBottomPanelPositionX(prev => prev + changeAmount / 2);
          setBottomLeftExpanded(false);
          setLeftPanelHeight(prev => prev + changeAmount);
          setLeftPanelPositionY(prev => prev - changeAmount / 2);
        } else {
          setBottomPanelWidth(prev => prev + changeAmount);
          setBottomPanelPositionX(prev => prev - changeAmount / 2);
          setBottomLeftExpanded(true);
          setLeftPanelHeight(prev => prev - changeAmount);
          setLeftPanelPositionY(prev => prev + changeAmount / 2);
        }
      } else {
        if (bottomRightExpanded) {
          setBottomPanelWidth(prev => prev - changeAmount);
          setBottomPanelPositionX(prev => prev - changeAmount / 2);
          setBottomRightExpanded(false);
          setRightPanelHeight(prev => prev + changeAmount);
          setRightPanelPositionY(prev => prev - changeAmount / 2);
        } else {
          setBottomPanelWidth(prev => prev + changeAmount);
          setBottomPanelPositionX(prev => prev + changeAmount / 2);
          setBottomRightExpanded(true);
          setRightPanelHeight(prev => prev - changeAmount);
          setRightPanelPositionY(prev => prev + changeAmount / 2);
        }
      }
    }
  };

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-white">
      <SaveAsDialog
        isOpen={showSaveAsDialog}
        onClose={() => setShowSaveAsDialog(false)}
        onSave={handleSaveAs}
      />

      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetSelect(e.target.value)}
            className="text-sm px-2 py-1 border border-stone-300 rounded focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="default">Default</option>
            {presets.map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={!currentPresetId}
            className="p-1.5 text-slate-600 hover:text-orange-500 hover:bg-orange-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Save"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSaveAsDialog(true)}
            className="p-1.5 text-slate-600 hover:text-orange-500 hover:bg-orange-50 rounded"
            title="Save As"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-56 border border-stone-200 rounded overflow-hidden mb-3">
        <Canvas>
          <color attach="background" args={['#ffffff']} />
          <PerspectiveCamera makeDefault position={[0.3, 0.4, 1]} fov={45} />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={0.5}
            maxDistance={2}
            target={[0, 0.275, 0]}
          />
          <Cabinet3D
            topPanelWidth={topPanelWidth}
            bottomPanelWidth={bottomPanelWidth}
            topPanelPositionX={topPanelPositionX}
            bottomPanelPositionX={bottomPanelPositionX}
            selectedPanel={selectedPanel}
            onSelectPanel={handleSelectPanel}
            onShrinkPanel={handleShrinkPanel}
            topLeftExpanded={topLeftExpanded}
            topRightExpanded={topRightExpanded}
            bottomLeftExpanded={bottomLeftExpanded}
            bottomRightExpanded={bottomRightExpanded}
            leftPanelHeight={leftPanelHeight}
            leftPanelPositionY={leftPanelPositionY}
            rightPanelHeight={rightPanelHeight}
            rightPanelPositionY={rightPanelPositionY}
            selectedBodyType={selectedBodyType}
            bazaHeight={bazaHeight}
            frontBaseDistance={frontBaseDistance}
            backBaseDistance={backBaseDistance}
            legHeight={legHeight}
            legDiameter={legDiameter}
            legFrontDistance={legFrontDistance}
            legBackDistance={legBackDistance}
            legSideDistance={legSideDistance}
          />
        </Canvas>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <p className="text-xs text-slate-600">Cabinet Body Type:</p>
        <select
          value={selectedBodyType || 'ayaksiz'}
          onChange={(e) => setSelectedBodyType(e.target.value)}
          className="text-xs px-2 py-1 bg-transparent border-none focus:outline-none cursor-pointer text-slate-700"
        >
          <option value="ayakli">With Legs</option>
          <option value="ayaksiz">Without Legs</option>
          <option value="bazali">With Base</option>
        </select>
      </div>

      {selectedBodyType === 'bazali' && (
        <div className="mt-3 space-y-1 pt-2 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Base Height</label>
            <input
              type="number"
              value={bazaHeight}
              onChange={(e) => setBazaHeight(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Front Base Offset</label>
            <input
              type="number"
              value={frontBaseDistance}
              onChange={(e) => setFrontBaseDistance(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Rear Base Offset</label>
            <input
              type="number"
              value={backBaseDistance}
              onChange={(e) => setBackBaseDistance(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      )}

      {selectedBodyType === 'ayakli' && (
        <div className="mt-3 space-y-1 pt-2 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Leg Height</label>
            <input
              type="number"
              value={legHeight}
              onChange={(e) => setLegHeight(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Front Offset</label>
            <input
              type="number"
              value={legFrontDistance}
              onChange={(e) => setLegFrontDistance(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Rear Offset</label>
            <input
              type="number"
              value={legBackDistance}
              onChange={(e) => setLegBackDistance(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">Side Offset</label>
            <input
              type="number"
              value={legSideDistance}
              onChange={(e) => setLegSideDistance(Number(e.target.value))}
              className="text-xs px-2 py-0.5 w-16 border border-stone-300 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
