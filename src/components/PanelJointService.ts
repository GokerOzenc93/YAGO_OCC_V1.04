import { globalSettingsService } from './GlobalSettingsDatabase';
import { useAppStore, FaceRole } from '../store';
import * as THREE from 'three';

export interface PanelJointConfig {
  topLeftExpanded: boolean;
  topRightExpanded: boolean;
  bottomLeftExpanded: boolean;
  bottomRightExpanded: boolean;
}

const DEFAULT_CONFIG: PanelJointConfig = {
  topLeftExpanded: false,
  topRightExpanded: false,
  bottomLeftExpanded: false,
  bottomRightExpanded: false,
};

function getDominantRole(
  roleA: FaceRole,
  roleB: FaceRole,
  config: PanelJointConfig
): FaceRole | null {
  if (!roleA || !roleB) return null;
  if (roleA === 'Door' || roleB === 'Door') return null;
  if (roleA === roleB) return null;

  const pair = [roleA, roleB].sort().join('-');

  switch (pair) {
    case 'Left-Top':
      return config.topLeftExpanded ? 'Top' : 'Left';
    case 'Right-Top':
      return config.topRightExpanded ? 'Top' : 'Right';
    case 'Bottom-Left':
      return config.bottomLeftExpanded ? 'Bottom' : 'Left';
    case 'Bottom-Right':
      return config.bottomRightExpanded ? 'Bottom' : 'Right';
    case 'Back-Left':
      return 'Left';
    case 'Back-Right':
      return 'Right';
    case 'Back-Top':
      return 'Top';
    case 'Back-Bottom':
      return 'Bottom';
    default:
      return null;
  }
}

async function toGeometry(replicadShape: any) {
  const { convertReplicadToThreeGeometry } = await import('./ReplicadService');
  return convertReplicadToThreeGeometry(replicadShape);
}

export async function loadJointConfig(profileId: string): Promise<PanelJointConfig> {
  try {
    const settings = await globalSettingsService.getProfileSettings(profileId, 'panel_joint');
    if (settings?.settings) {
      const s = settings.settings as Record<string, unknown>;
      return {
        topLeftExpanded: Boolean(s.topLeftExpanded),
        topRightExpanded: Boolean(s.topRightExpanded),
        bottomLeftExpanded: Boolean(s.bottomLeftExpanded),
        bottomRightExpanded: Boolean(s.bottomRightExpanded),
      };
    }
  } catch (err) {
    console.error('Failed to load joint config:', err);
  }
  return DEFAULT_CONFIG;
}

interface FullProfileSettings {
  jointConfig: PanelJointConfig;
  selectedBodyType: string | null;
  bazaHeight: number;
  frontBaseDistance: number;
}

async function loadFullProfileSettings(profileId: string): Promise<FullProfileSettings> {
  try {
    const settings = await globalSettingsService.getProfileSettings(profileId, 'panel_joint');
    if (settings?.settings) {
      const s = settings.settings as Record<string, unknown>;
      return {
        jointConfig: {
          topLeftExpanded: Boolean(s.topLeftExpanded),
          topRightExpanded: Boolean(s.topRightExpanded),
          bottomLeftExpanded: Boolean(s.bottomLeftExpanded),
          bottomRightExpanded: Boolean(s.bottomRightExpanded),
        },
        selectedBodyType: (s.selectedBodyType as string) || null,
        bazaHeight: typeof s.bazaHeight === 'number' ? s.bazaHeight : 100,
        frontBaseDistance: typeof s.frontBaseDistance === 'number' ? s.frontBaseDistance : 10,
      };
    }
  } catch (err) {
    console.error('Failed to load full profile settings:', err);
  }
  return {
    jointConfig: DEFAULT_CONFIG,
    selectedBodyType: null,
    bazaHeight: 100,
    frontBaseDistance: 10,
  };
}

function applyBazaOffset(parentShapeId: string, selectedBodyType: string | null, bazaHeight: number) {
  const state = useAppStore.getState();
  const parentShape = state.shapes.find(s => s.id === parentShapeId);
  if (!parentShape) return;

  const hasBottomPanels = state.shapes.some(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    s.parameters?.faceRole === 'Bottom'
  );
  if (!hasBottomPanels) return;

  const yOffset = selectedBodyType === 'bazali' ? bazaHeight : 0;

  useAppStore.setState((st) => ({
    shapes: st.shapes.map(s => {
      if (s.type === 'panel' &&
          s.parameters?.parentShapeId === parentShapeId &&
          s.parameters?.faceRole === 'Bottom') {
        const parent = st.shapes.find(p => p.id === parentShapeId);
        if (!parent) return s;
        return {
          ...s,
          position: [
            parent.position[0],
            parent.position[1] + yOffset,
            parent.position[2]
          ] as [number, number, number],
          parameters: {
            ...s.parameters,
            bazaOffset: yOffset
          }
        };
      }
      return s;
    })
  }));
}

function removeExistingBazaPanels(parentShapeId: string) {
  const state = useAppStore.getState();
  const bazaIds = state.shapes
    .filter(s => s.type === 'panel' && s.parameters?.parentShapeId === parentShapeId && s.parameters?.isBaza)
    .map(s => s.id);

  if (bazaIds.length > 0) {
    useAppStore.setState(st => ({
      shapes: st.shapes.filter(s => !bazaIds.includes(s.id))
    }));
  }
}

async function generateFrontBazaPanels(
  parentShapeId: string,
  selectedBodyType: string | null,
  bazaHeight: number,
  frontBaseDistance: number
) {
  removeExistingBazaPanels(parentShapeId);

  if (selectedBodyType !== 'bazali') return;

  const state = useAppStore.getState();
  const parentShape = state.shapes.find(s => s.id === parentShapeId);
  if (!parentShape || !parentShape.geometry || !parentShape.faceRoles) {
    console.log('BAZA: no parent, geometry or faceRoles');
    return;
  }

  const { extractFacesFromGeometry, groupCoplanarFaces } = await import('./FaceEditor');
  const { createReplicadBox, convertReplicadToThreeGeometry } = await import('./ReplicadService');

  const parentFaces = extractFacesFromGeometry(parentShape.geometry);
  const parentGroups = groupCoplanarFaces(parentFaces);

  console.log('BAZA: parentGroups:', parentGroups.length, 'faceRoles:', JSON.stringify(parentShape.faceRoles));

  const doorNormals: THREE.Vector3[] = [];
  for (const [indexStr, role] of Object.entries(parentShape.faceRoles)) {
    if (role !== 'Door') continue;
    const idx = parseInt(indexStr);
    if (idx >= parentGroups.length) {
      console.log('BAZA: Door faceRole index', idx, 'out of range (groups:', parentGroups.length, ')');
      continue;
    }
    const n = parentGroups[idx].normal.clone().normalize();
    console.log('BAZA: Door normal at group', idx, ':', n.x.toFixed(3), n.y.toFixed(3), n.z.toFixed(3));
    doorNormals.push(n);
  }

  if (doorNormals.length === 0) {
    console.log('BAZA: no Door normals found');
    return;
  }

  const bottomPanels = state.shapes.filter(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    s.parameters?.faceRole === 'Bottom' &&
    !s.parameters?.isBaza
  );

  console.log('BAZA: bottomPanels:', bottomPanels.length);
  if (bottomPanels.length === 0) return;

  const panelThickness = 18;
  const newShapes: any[] = [];

  for (const bottomPanel of bottomPanels) {
    if (!bottomPanel.geometry) continue;

    const posAttr = bottomPanel.geometry.getAttribute('position');
    if (!posAttr) continue;

    const bbox = new THREE.Box3();
    for (let i = 0; i < posAttr.count; i++) {
      bbox.expandByPoint(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
    }
    const bpSize = new THREE.Vector3();
    bbox.getSize(bpSize);

    console.log('BAZA: bottom panel bbox min:', bbox.min.x.toFixed(1), bbox.min.y.toFixed(1), bbox.min.z.toFixed(1),
      'max:', bbox.max.x.toFixed(1), bbox.max.y.toFixed(1), bbox.max.z.toFixed(1),
      'size:', bpSize.x.toFixed(1), bpSize.y.toFixed(1), bpSize.z.toFixed(1));

    const processedDirs = new Set<string>();

    for (const doorNormal of doorNormals) {
      const absNx = Math.abs(doorNormal.x);
      const absNy = Math.abs(doorNormal.y);
      const absNz = Math.abs(doorNormal.z);

      let bazaWidth: number;
      let bazaDepth: number;
      let translateX: number;
      let translateZ: number;
      let dirKey: string;

      if (absNz >= absNx && absNz >= absNy && absNz > 0.5) {
        if (doorNormal.z <= 0) continue;
        dirKey = '+z';
        if (processedDirs.has(dirKey)) continue;
        processedDirs.add(dirKey);

        bazaWidth = bpSize.x;
        bazaDepth = panelThickness;
        translateX = bbox.min.x;
        translateZ = bbox.max.z - frontBaseDistance - panelThickness;
      } else {
        continue;
      }

      if (bazaWidth < 1) continue;

      console.log('BAZA: creating baza dir:', dirKey, 'w:', bazaWidth, 'h:', bazaHeight, 'd:', bazaDepth, 'tx:', translateX, 'tz:', translateZ);

      try {
        const bazaBox = await createReplicadBox({
          width: bazaWidth,
          height: bazaHeight,
          depth: bazaDepth
        });

        const positioned = bazaBox.translate(translateX, 0, translateZ);
        const geometry = convertReplicadToThreeGeometry(positioned);

        newShapes.push({
          id: `baza-front-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'panel',
          geometry,
          replicadShape: positioned,
          position: [parentShape.position[0], parentShape.position[1], parentShape.position[2]] as [number, number, number],
          rotation: parentShape.rotation,
          scale: [...parentShape.scale] as [number, number, number],
          color: '#ffffff',
          parameters: {
            parentShapeId,
            isBaza: true,
            bazaType: 'front',
            width: bazaWidth,
            height: bazaHeight,
            depth: bazaDepth
          }
        });
      } catch (err) {
        console.error('BAZA: failed to create:', err);
      }
    }
  }

  console.log('BAZA: total new shapes:', newShapes.length);
  if (newShapes.length > 0) {
    useAppStore.setState(st => ({
      shapes: [...st.shapes, ...newShapes]
    }));
  }
}

export async function resolveAllPanelJoints(
  parentShapeId: string,
  profileId: string,
  config?: PanelJointConfig
): Promise<void> {
  const state = useAppStore.getState();
  const fullSettings = await loadFullProfileSettings(profileId);
  const jointConfig = config || fullSettings.jointConfig;

  const panels = state.shapes.filter(
    (s) =>
      s.type === 'panel' &&
      s.parameters?.parentShapeId === parentShapeId &&
      s.parameters?.faceRole &&
      s.parameters.faceRole !== 'Door' &&
      (s.parameters?.originalReplicadShape || s.replicadShape)
  );

  if (panels.length < 2) {
    await restoreSinglePanels(panels);
    applyBazaOffset(parentShapeId, fullSettings.selectedBodyType, fullSettings.bazaHeight);
    await generateFrontBazaPanels(parentShapeId, fullSettings.selectedBodyType, fullSettings.bazaHeight, fullSettings.frontBaseDistance);
    return;
  }

  console.log(`🔗 Resolving panel joints for ${panels.length} panels...`);

  const originalShapes = new Map<string, any>();
  for (const panel of panels) {
    originalShapes.set(
      panel.id,
      panel.parameters?.originalReplicadShape || panel.replicadShape
    );
  }

  const cutsMap = new Map<string, string[]>();

  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const pA = panels[i];
      const pB = panels[j];
      const roleA = pA.parameters?.faceRole as FaceRole;
      const roleB = pB.parameters?.faceRole as FaceRole;

      const dominant = getDominantRole(roleA, roleB, jointConfig);
      if (!dominant) continue;

      const isADominant = dominant === roleA;
      const subordinateId = isADominant ? pB.id : pA.id;
      const dominantId = isADominant ? pA.id : pB.id;

      const existing = cutsMap.get(subordinateId) || [];
      existing.push(dominantId);
      cutsMap.set(subordinateId, existing);

      console.log(
        `  Joint: ${roleA}-${roleB} → ${dominant} dominant, ${isADominant ? roleB : roleA} trimmed`
      );
    }
  }

  const shapeUpdates = new Map<
    string,
    { geometry: any; replicadShape: any; jointTrimmed: boolean }
  >();

  for (const panel of panels) {
    const original = originalShapes.get(panel.id);
    if (!original) continue;

    if (cutsMap.has(panel.id)) {
      let currentShape = original;
      const dominantIds = cutsMap.get(panel.id)!;

      for (const dominantId of dominantIds) {
        const cuttingShape = originalShapes.get(dominantId);
        if (!cuttingShape) continue;
        try {
          currentShape = currentShape.cut(cuttingShape);
        } catch (err) {
          console.error(`Joint cut failed for panel ${panel.id}:`, err);
        }
      }

      try {
        const geo = await toGeometry(currentShape);
        shapeUpdates.set(panel.id, {
          geometry: geo,
          replicadShape: currentShape,
          jointTrimmed: true,
        });
      } catch (err) {
        console.error(`Failed to convert trimmed panel:`, err);
      }
    } else if (panel.parameters?.jointTrimmed) {
      try {
        const geo = await toGeometry(original);
        shapeUpdates.set(panel.id, {
          geometry: geo,
          replicadShape: original,
          jointTrimmed: false,
        });
      } catch (err) {
        console.error(`Failed to restore panel:`, err);
      }
    }
  }

  if (shapeUpdates.size > 0) {
    batchApplyUpdates(shapeUpdates, originalShapes, parentShapeId);
    console.log(`✅ Panel joints resolved: ${shapeUpdates.size} panels updated`);
  } else {
    saveOriginalShapes(panels, parentShapeId);
  }

  applyBazaOffset(parentShapeId, fullSettings.selectedBodyType, fullSettings.bazaHeight);
  await generateFrontBazaPanels(parentShapeId, fullSettings.selectedBodyType, fullSettings.bazaHeight, fullSettings.frontBaseDistance);
}

export async function restoreAllPanels(parentShapeId: string): Promise<void> {
  const state = useAppStore.getState();
  const panels = state.shapes.filter(
    (s) =>
      s.type === 'panel' &&
      s.parameters?.parentShapeId === parentShapeId &&
      s.parameters?.jointTrimmed &&
      s.parameters?.originalReplicadShape
  );
  await restoreSinglePanels(panels);
  applyBazaOffset(parentShapeId, null, 0);
  removeExistingBazaPanels(parentShapeId);
}

async function restoreSinglePanels(panels: any[]) {
  for (const panel of panels) {
    if (panel.parameters?.jointTrimmed && panel.parameters?.originalReplicadShape) {
      try {
        const geo = await toGeometry(panel.parameters.originalReplicadShape);
        useAppStore.getState().updateShape(panel.id, {
          geometry: geo,
          replicadShape: panel.parameters.originalReplicadShape,
          parameters: {
            ...panel.parameters,
            jointTrimmed: false,
          },
        });
      } catch {}
    }
  }
}

function batchApplyUpdates(
  updates: Map<string, { geometry: any; replicadShape: any; jointTrimmed: boolean }>,
  originalShapes: Map<string, any>,
  parentShapeId: string
) {
  useAppStore.setState((state) => ({
    shapes: state.shapes.map((s) => {
      const update = updates.get(s.id);
      if (update) {
        return {
          ...s,
          geometry: update.geometry,
          replicadShape: update.replicadShape,
          parameters: {
            ...s.parameters,
            originalReplicadShape:
              originalShapes.get(s.id) ||
              s.parameters?.originalReplicadShape ||
              s.replicadShape,
            jointTrimmed: update.jointTrimmed,
          },
        };
      }
      if (
        s.type === 'panel' &&
        s.parameters?.parentShapeId === parentShapeId &&
        !s.parameters?.originalReplicadShape &&
        s.replicadShape
      ) {
        return {
          ...s,
          parameters: {
            ...s.parameters,
            originalReplicadShape: s.replicadShape,
          },
        };
      }
      return s;
    }),
  }));
}

function saveOriginalShapes(panels: any[], parentShapeId: string) {
  const needsSave = panels.some((p) => !p.parameters?.originalReplicadShape);
  if (!needsSave) return;

  useAppStore.setState((state) => ({
    shapes: state.shapes.map((s) => {
      if (
        s.type === 'panel' &&
        s.parameters?.parentShapeId === parentShapeId &&
        !s.parameters?.originalReplicadShape &&
        s.replicadShape
      ) {
        return {
          ...s,
          parameters: {
            ...s.parameters,
            originalReplicadShape: s.replicadShape,
          },
        };
      }
      return s;
    }),
  }));
}
