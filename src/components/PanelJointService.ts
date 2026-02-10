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

  const hasBottomPanels = state.shapes.some(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    s.parameters?.faceRole === 'Bottom'
  );
  if (!hasBottomPanels) {
    console.log('BAZA: no Bottom panels found, skipping base panel generation');
    return;
  }

  const { extractFacesFromGeometry, groupCoplanarFaces } = await import('./FaceEditor');
  const { createReplicadBox, convertReplicadToThreeGeometry } = await import('./ReplicadService');

  const parentFaces = extractFacesFromGeometry(parentShape.geometry);
  const parentGroups = groupCoplanarFaces(parentFaces);

  console.log('BAZA: parentGroups:', parentGroups.length, 'faceRoles:', JSON.stringify(parentShape.faceRoles));

  const hasDoorRole = Object.values(parentShape.faceRoles).some(r => r === 'Door');
  if (!hasDoorRole) {
    console.log('BAZA: no Door faceRoles found');
    return;
  }

  const panelThickness = 18;
  const newShapes: any[] = [];
  const processedDirs: string[] = [];

  interface BazaInfo {
    translateX: number;
    translateY: number;
    translateZ: number;
    width: number;
    height: number;
    depth: number;
    direction: 'x' | 'z';
  }
  const bazaInfos: BazaInfo[] = [];

  for (const [indexStr, role] of Object.entries(parentShape.faceRoles)) {
    if (role !== 'Door') continue;
    const idx = parseInt(indexStr);
    if (idx >= parentGroups.length) continue;

    const doorGroup = parentGroups[idx];
    const doorNormal = doorGroup.normal.clone().normalize();

    const dirKey = `${Math.round(doorNormal.x)}_${Math.round(doorNormal.y)}_${Math.round(doorNormal.z)}`;
    if (processedDirs.includes(dirKey)) continue;
    processedDirs.push(dirKey);

    const doorVertices: THREE.Vector3[] = [];
    doorGroup.faceIndices.forEach(fi => {
      parentFaces[fi].vertices.forEach(v => doorVertices.push(v.clone()));
    });
    const doorBbox = new THREE.Box3().setFromPoints(doorVertices);
    const doorSize = new THREE.Vector3();
    doorBbox.getSize(doorSize);

    console.log('BAZA: Door face bbox min:', doorBbox.min.x.toFixed(1), doorBbox.min.y.toFixed(1), doorBbox.min.z.toFixed(1),
      'max:', doorBbox.max.x.toFixed(1), doorBbox.max.y.toFixed(1), doorBbox.max.z.toFixed(1),
      'size:', doorSize.x.toFixed(1), doorSize.y.toFixed(1), doorSize.z.toFixed(1));

    const absNx = Math.abs(doorNormal.x);
    const absNz = Math.abs(doorNormal.z);

    let bazaWidth: number;
    let bazaDepth: number;
    let translateX: number;
    let translateY: number;
    let translateZ: number;

    if (absNz >= absNx && absNz > 0.5) {
      bazaWidth = doorSize.x;
      bazaDepth = panelThickness;
      translateX = doorBbox.min.x;
      if (doorNormal.z > 0) {
        translateZ = doorBbox.min.z - frontBaseDistance - panelThickness;
      } else {
        translateZ = doorBbox.max.z + frontBaseDistance;
      }
    } else if (absNx > 0.5) {
      bazaWidth = panelThickness;
      bazaDepth = doorSize.z;
      translateZ = doorBbox.min.z;
      if (doorNormal.x > 0) {
        translateX = doorBbox.min.x - frontBaseDistance - panelThickness;
      } else {
        translateX = doorBbox.max.x + frontBaseDistance;
      }
    } else {
      console.log('BAZA: door normal not axis-aligned, skipping');
      continue;
    }

    if (bazaWidth < 1 || bazaDepth < 1) continue;

    const bottomPanel = state.shapes.find(
      s => s.type === 'panel' &&
      s.parameters?.parentShapeId === parentShapeId &&
      s.parameters?.faceRole === 'Bottom'
    );

    if (!bottomPanel?.geometry) {
      console.log('BAZA: Bottom panel geometry not found, skipping');
      continue;
    }

    const bottomBox = new THREE.Box3().setFromBufferAttribute(
      bottomPanel.geometry.getAttribute('position')
    );
    bottomBox.translate(new THREE.Vector3(...bottomPanel.position));

    translateY = bottomBox.min.y - bazaHeight;

    console.log('BAZA: Bottom panel bounds Y:[', bottomBox.min.y.toFixed(1), bottomBox.max.y.toFixed(1),
      '] bazaHeight:', bazaHeight.toFixed(1), 'placing at Y:', translateY.toFixed(1));

    let adjustedTranslateX = translateX;
    let adjustedTranslateZ = translateZ;
    let adjustedWidth = bazaWidth;
    let adjustedDepth = bazaDepth;

    console.log(`BAZA: Initial pos:[${translateX.toFixed(1)}, ${translateY.toFixed(1)}, ${translateZ.toFixed(1)}] ` +
      `size:[${bazaWidth.toFixed(1)}, ${bazaHeight.toFixed(1)}, ${bazaDepth.toFixed(1)}]`);
    console.log(`BAZA: Door bounds X:[${doorBbox.min.x.toFixed(1)}, ${doorBbox.max.x.toFixed(1)}] Z:[${doorBbox.min.z.toFixed(1)}, ${doorBbox.max.z.toFixed(1)}]`);
    console.log(`BAZA: Bottom panel bounds X:[${bottomBox.min.x.toFixed(1)}, ${bottomBox.max.x.toFixed(1)}] Z:[${bottomBox.min.z.toFixed(1)}, ${bottomBox.max.z.toFixed(1)}]`);

    if (absNz >= absNx && absNz > 0.5) {
      const leftTrim = bottomBox.min.x - doorBbox.min.x;
      if (leftTrim > 0.1) {
        console.log(`BAZA: Bottom panel trimmed ${leftTrim.toFixed(1)}mm from left, applying same to baza`);
        adjustedTranslateX += leftTrim;
        adjustedWidth -= leftTrim;
      }

      const rightTrim = doorBbox.max.x - bottomBox.max.x;
      if (rightTrim > 0.1) {
        console.log(`BAZA: Bottom panel trimmed ${rightTrim.toFixed(1)}mm from right, applying same to baza`);
        adjustedWidth -= rightTrim;
      }
    } else if (absNx > 0.5) {
      const frontTrim = bottomBox.min.z - doorBbox.min.z;
      if (frontTrim > 0.1) {
        console.log(`BAZA: Bottom panel trimmed ${frontTrim.toFixed(1)}mm from front, applying same to baza`);
        adjustedTranslateZ += frontTrim;
        adjustedDepth -= frontTrim;
      }

      const backTrim = doorBbox.max.z - bottomBox.max.z;
      if (backTrim > 0.1) {
        console.log(`BAZA: Bottom panel trimmed ${backTrim.toFixed(1)}mm from back, applying same to baza`);
        adjustedDepth -= backTrim;
      }
    }

    if (adjustedWidth < 1 || adjustedDepth < 1) {
      console.log('BAZA: adjusted dimensions too small, skipping');
      continue;
    }

    const direction: 'x' | 'z' = (absNz >= absNx && absNz > 0.5) ? 'x' : 'z';
    bazaInfos.push({
      translateX: adjustedTranslateX,
      translateY,
      translateZ: adjustedTranslateZ,
      width: adjustedWidth,
      height: bazaHeight,
      depth: adjustedDepth,
      direction
    });

    console.log(`BAZA: collected info - dir:${direction} pos:[${adjustedTranslateX.toFixed(1)}, ${translateY.toFixed(1)}, ${adjustedTranslateZ.toFixed(1)}] ` +
      `size:[${adjustedWidth.toFixed(1)}, ${bazaHeight.toFixed(1)}, ${adjustedDepth.toFixed(1)}]`);
  }

  console.log(`BAZA: collected ${bazaInfos.length} baza infos, checking for adjacent pairs...`);

  for (let i = 0; i < bazaInfos.length; i++) {
    for (let j = i + 1; j < bazaInfos.length; j++) {
      const a = bazaInfos[i];
      const b = bazaInfos[j];

      if (a.direction === b.direction) continue;

      const aMinX = a.translateX;
      const aMaxX = a.translateX + a.width;
      const aMinZ = a.translateZ;
      const aMaxZ = a.translateZ + a.depth;

      const bMinX = b.translateX;
      const bMaxX = b.translateX + b.width;
      const bMinZ = b.translateZ;
      const bMaxZ = b.translateZ + b.depth;

      const overlapZ = !(aMaxZ < bMinZ || bMaxZ < aMinZ);
      const overlapX = !(aMaxX < bMinX || bMaxX < aMinX);

      const gapXRight = bMinX - aMaxX;
      const gapXLeft = aMinX - bMaxX;
      const gapZBack = bMinZ - aMaxZ;
      const gapZFront = aMinZ - bMaxZ;

      if (Math.abs(gapXRight - frontBaseDistance) < 1 && overlapZ) {
        console.log(`BAZA: Adjacent pair found (X gap: a-right to b-left), extending inner corners by ${frontBaseDistance}mm`);
        a.width += frontBaseDistance;
        a.depth += frontBaseDistance;
        b.translateX -= frontBaseDistance;
        b.width += frontBaseDistance;
        b.depth += frontBaseDistance;
      }

      if (Math.abs(gapXLeft - frontBaseDistance) < 1 && overlapZ) {
        console.log(`BAZA: Adjacent pair found (X gap: b-right to a-left), extending inner corners by ${frontBaseDistance}mm`);
        a.translateX -= frontBaseDistance;
        a.width += frontBaseDistance;
        a.depth += frontBaseDistance;
        b.width += frontBaseDistance;
        b.depth += frontBaseDistance;
      }

      if (Math.abs(gapZBack - frontBaseDistance) < 1 && overlapX) {
        console.log(`BAZA: Adjacent pair found (Z gap: a-back to b-front), extending inner corners by ${frontBaseDistance}mm`);
        a.depth += frontBaseDistance;
        a.width += frontBaseDistance;
        b.translateZ -= frontBaseDistance;
        b.depth += frontBaseDistance;
        b.width += frontBaseDistance;
      }

      if (Math.abs(gapZFront - frontBaseDistance) < 1 && overlapX) {
        console.log(`BAZA: Adjacent pair found (Z gap: b-back to a-front), extending inner corners by ${frontBaseDistance}mm`);
        a.translateZ -= frontBaseDistance;
        a.depth += frontBaseDistance;
        a.width += frontBaseDistance;
        b.depth += frontBaseDistance;
        b.width += frontBaseDistance;
      }
    }
  }

  for (const info of bazaInfos) {
    console.log('BAZA: creating w:', info.width.toFixed(1), 'h:', info.height.toFixed(1), 'd:', info.depth.toFixed(1),
      'pos: [', info.translateX.toFixed(1), info.translateY.toFixed(1), info.translateZ.toFixed(1), ']');

    try {
      const bazaBox = await createReplicadBox({
        width: info.width,
        height: info.height,
        depth: info.depth
      });

      const positioned = bazaBox.translate(info.translateX, info.translateY, info.translateZ);
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
          width: info.width,
          height: info.height,
          depth: info.depth
        }
      });
    } catch (err) {
      console.error('BAZA: failed to create:', err);
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
