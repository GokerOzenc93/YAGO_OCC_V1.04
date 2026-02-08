import * as THREE from 'three';
import { globalSettingsService } from './GlobalSettingsDatabase';
import { useAppStore, FaceRole } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';

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

interface DirectionalFaceInfo {
  depthPosition: number;
  widthMin: number;
  widthMax: number;
  heightMin: number;
  heightMax: number;
  width: number;
  direction: THREE.Vector3;
}

function getDoorFrontDirections(parentShapeId: string): THREE.Vector3[] {
  const state = useAppStore.getState();
  const parentShape = state.shapes.find(s => s.id === parentShapeId);
  if (!parentShape?.geometry) return [];

  const faceRoles = parentShape.faceRoles;
  if (!faceRoles) return [];

  const doorGroupIndices = Object.entries(faceRoles)
    .filter(([_, role]) => role === 'Door')
    .map(([idx]) => parseInt(idx));

  if (doorGroupIndices.length === 0) return [];

  const faces = extractFacesFromGeometry(parentShape.geometry);
  const groups = groupCoplanarFaces(faces);

  const directions: THREE.Vector3[] = [];

  for (const groupIdx of doorGroupIndices) {
    if (groupIdx >= groups.length) continue;
    const group = groups[groupIdx];
    const normal = group.normal.clone().normalize();

    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    let dir: THREE.Vector3;
    if (absX > absY && absX > absZ) {
      dir = new THREE.Vector3(Math.sign(normal.x), 0, 0);
    } else if (absZ > absY) {
      dir = new THREE.Vector3(0, 0, Math.sign(normal.z));
    } else {
      continue;
    }

    const isDuplicate = directions.some(d => d.dot(dir) > 0.9);
    if (!isDuplicate) {
      directions.push(dir);
    }
  }

  return directions;
}

function analyzeFacesInDirection(
  geometry: THREE.BufferGeometry,
  direction: THREE.Vector3,
  panelThickness: number = 18
): DirectionalFaceInfo[] {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const dir = direction.clone().normalize();
  const isXDir = Math.abs(dir.x) > 0.5;

  const triangles: Array<{
    depth: number; wMin: number; wMax: number; hMin: number; hMax: number;
  }> = [];

  for (let i = 0; i < triangleCount; i++) {
    let i0: number, i1: number, i2: number;
    if (index) {
      i0 = index.getX(i * 3);
      i1 = index.getX(i * 3 + 1);
      i2 = index.getX(i * 3 + 2);
    } else {
      i0 = i * 3;
      i1 = i * 3 + 1;
      i2 = i * 3 + 2;
    }

    const v0x = position.getX(i0), v0y = position.getY(i0), v0z = position.getZ(i0);
    const v1x = position.getX(i1), v1y = position.getY(i1), v1z = position.getZ(i1);
    const v2x = position.getX(i2), v2y = position.getY(i2), v2z = position.getZ(i2);

    const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
    const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 0.001) continue;

    const dot = (nx * dir.x + ny * dir.y + nz * dir.z) / len;
    if (dot > 0.9) {
      if (isXDir) {
        triangles.push({
          depth: (v0x + v1x + v2x) / 3,
          wMin: Math.min(v0z, v1z, v2z),
          wMax: Math.max(v0z, v1z, v2z),
          hMin: Math.min(v0y, v1y, v2y),
          hMax: Math.max(v0y, v1y, v2y),
        });
      } else {
        triangles.push({
          depth: (v0z + v1z + v2z) / 3,
          wMin: Math.min(v0x, v1x, v2x),
          wMax: Math.max(v0x, v1x, v2x),
          hMin: Math.min(v0y, v1y, v2y),
          hMax: Math.max(v0y, v1y, v2y),
        });
      }
    }
  }

  if (triangles.length === 0) return [];

  const tolerance = 1;
  const groups = new Map<number, typeof triangles>();

  for (const tri of triangles) {
    let assigned = false;
    for (const [groupDepth, group] of groups.entries()) {
      if (Math.abs(tri.depth - groupDepth) < tolerance) {
        group.push(tri);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      groups.set(tri.depth, [tri]);
    }
  }

  const result: DirectionalFaceInfo[] = [];

  for (const [depth, group] of groups.entries()) {
    const wMin = Math.min(...group.map(t => t.wMin));
    const wMax = Math.max(...group.map(t => t.wMax));
    const hMin = Math.min(...group.map(t => t.hMin));
    const hMax = Math.max(...group.map(t => t.hMax));
    const hExtent = hMax - hMin;

    if (Math.abs(hExtent - panelThickness) < 3) {
      result.push({
        depthPosition: depth,
        widthMin: wMin,
        widthMax: wMax,
        heightMin: hMin,
        heightMax: hMax,
        width: wMax - wMin,
        direction: dir.clone(),
      });
    }
  }

  return result;
}

function removeBazaShapes(parentShapeId: string) {
  useAppStore.setState((st) => ({
    shapes: st.shapes.filter(s =>
      !(s.type === 'baza' && s.parameters?.parentShapeId === parentShapeId)
    )
  }));
}

function createFrontBazaPanels(
  parentShapeId: string,
  bazaHeight: number,
  frontBaseDistance: number
) {
  const state = useAppStore.getState();
  const bottomPanel = state.shapes.find(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    s.parameters?.faceRole === 'Bottom'
  );
  if (!bottomPanel?.geometry) return;

  const frontDirections = getDoorFrontDirections(parentShapeId);
  const panelThickness = 18;
  const newShapes: any[] = [];
  const timestamp = Date.now();
  let counter = 0;

  for (const dir of frontDirections) {
    const faces = analyzeFacesInDirection(bottomPanel.geometry, dir, panelThickness);
    const isXDir = Math.abs(dir.x) > 0.5;

    for (const face of faces) {
      const bazaWidth = face.width;
      const widthCenter = (face.widthMin + face.widthMax) / 2;

      let geometry: THREE.BoxGeometry;
      let bazaPosition: [number, number, number];

      if (isXDir) {
        geometry = new THREE.BoxGeometry(panelThickness, bazaHeight, bazaWidth);
        bazaPosition = [
          bottomPanel.position[0] + face.depthPosition + dir.x * (-frontBaseDistance - panelThickness / 2),
          bottomPanel.position[1] + face.heightMin - bazaHeight / 2,
          bottomPanel.position[2] + widthCenter,
        ];
      } else {
        geometry = new THREE.BoxGeometry(bazaWidth, bazaHeight, panelThickness);
        bazaPosition = [
          bottomPanel.position[0] + widthCenter,
          bottomPanel.position[1] + face.heightMin - bazaHeight / 2,
          bottomPanel.position[2] + face.depthPosition + dir.z * (-frontBaseDistance - panelThickness / 2),
        ];
      }

      newShapes.push({
        id: `baza-front-${timestamp}-${counter++}`,
        type: 'baza',
        geometry,
        position: bazaPosition,
        rotation: [...bottomPanel.rotation] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        color: '#f5f5f4',
        parameters: {
          width: bazaWidth,
          height: bazaHeight,
          depth: panelThickness,
          parentShapeId,
          bazaType: 'front',
        }
      });
    }
  }

  if (newShapes.length > 0) {
    useAppStore.setState((st) => ({
      shapes: [...st.shapes, ...newShapes]
    }));
  }
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
    removeBazaShapes(parentShapeId);
    if (fullSettings.selectedBodyType === 'bazali' && fullSettings.bazaHeight > 0) {
      createFrontBazaPanels(parentShapeId, fullSettings.bazaHeight, fullSettings.frontBaseDistance);
    }
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

  removeBazaShapes(parentShapeId);
  if (fullSettings.selectedBodyType === 'bazali' && fullSettings.bazaHeight > 0) {
    createFrontBazaPanels(parentShapeId, fullSettings.bazaHeight, fullSettings.frontBaseDistance);
  }
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
  removeBazaShapes(parentShapeId);
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
