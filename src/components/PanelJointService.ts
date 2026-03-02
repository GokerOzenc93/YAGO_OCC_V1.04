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

  return;

  const { extractFacesFromGeometry, groupCoplanarFaces } = await import('./FaceEditor');
  const { createReplicadBox, convertReplicadToThreeGeometry } = await import('./ReplicadService');

  const parentFaces = extractFacesFromGeometry(parentShape.geometry);
  const parentGroups = groupCoplanarFaces(parentFaces);

  const panelThickness = 18;

  const hasLeftPanel = state.shapes.some(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    s.parameters?.faceRole === 'Left'
  );
  const hasRightPanel = state.shapes.some(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    s.parameters?.faceRole === 'Right'
  );

  const bottomBox = new THREE.Box3().setFromBufferAttribute(
    bottomPanel.geometry.getAttribute('position')
  );
  bottomBox.translate(new THREE.Vector3(...bottomPanel.position));
  const bazaY = bottomBox.min.y - bazaHeight;

  const newShapes: any[] = [];
  const processedDirs: string[] = [];

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

    const absNx = Math.abs(doorNormal.x);
    const absNz = Math.abs(doorNormal.z);

    let bazaWidth: number;
    let bazaDepth: number;
    let translateX: number;
    let translateZ: number;

    if (absNz >= absNx && absNz > 0.5) {
      let startX = doorBbox.min.x;
      let endX = doorBbox.max.x;

      if (hasLeftPanel) {
        startX += panelThickness;
      } else {
        startX -= frontBaseDistance;
      }

      if (hasRightPanel) {
        endX -= panelThickness;
      } else {
        endX += frontBaseDistance;
      }

      translateX = startX;
      bazaWidth = endX - startX;
      bazaDepth = panelThickness;

      if (doorNormal.z > 0) {
        translateZ = doorBbox.min.z - frontBaseDistance - panelThickness;
      } else {
        translateZ = doorBbox.max.z + frontBaseDistance;
      }
    } else if (absNx > 0.5) {
      let startZ = doorBbox.min.z;
      let endZ = doorBbox.max.z;

      if (hasLeftPanel) {
        startZ += panelThickness;
      } else {
        startZ -= frontBaseDistance;
      }

      if (hasRightPanel) {
        endZ -= panelThickness;
      } else {
        endZ += frontBaseDistance;
      }

      translateZ = startZ;
      bazaDepth = endZ - startZ;
      bazaWidth = panelThickness;

      if (doorNormal.x > 0) {
        translateX = doorBbox.min.x - frontBaseDistance - panelThickness;
      } else {
        translateX = doorBbox.max.x + frontBaseDistance;
      }
    } else {
      continue;
    }

    if (bazaWidth < 1 || bazaDepth < 1) continue;

    try {
      const bazaBox = await createReplicadBox({
        width: bazaWidth,
        height: bazaHeight,
        depth: bazaDepth
      });

      const positioned = bazaBox.translate(translateX, bazaY, translateZ);
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

  if (newShapes.length > 0) {
    useAppStore.setState(st => ({
      shapes: [...st.shapes, ...newShapes]
    }));
  }
}

async function rebuildRaycastPanel(
  panel: any,
  parentShape: any,
  faces: any[],
  faceGroups: any[],
  allPanels: any[]
): Promise<{ id: string; geometry: any; replicadShape: any; parameters: any } | null> {
  const {
    raycastLocalOrigin,
    raycastFaceNormal,
    raycastParentDimensions,
  } = panel.parameters || {};

  const { convertReplicadToThreeGeometry, initReplicad, createReplicadBox, performBooleanCut } = await import('./ReplicadService');
  const { draw, Plane } = await import('replicad');

  const newWidth = parentShape.parameters?.width || 1;
  const newHeight = parentShape.parameters?.height || 1;
  const newDepth = parentShape.parameters?.depth || 1;

  let matchedGroup: any = null;
  let scaledOrigin: THREE.Vector3;

  if (raycastFaceNormal) {
    const targetNormal = new THREE.Vector3(...(raycastFaceNormal as [number,number,number])).normalize();
    matchedGroup = faceGroups.find((g: any) => {
      const gn = g.normal.clone().normalize();
      return gn.dot(targetNormal) > 0.95;
    });
  } else if (panel.parameters?.faceIndex !== undefined) {
    const fi = panel.parameters.faceIndex;
    matchedGroup = fi < faceGroups.length ? faceGroups[fi] : null;
  }

  if (!matchedGroup) return null;

  if (raycastLocalOrigin && raycastParentDimensions) {
    const scaleX = newWidth / (raycastParentDimensions.width || 1);
    const scaleY = newHeight / (raycastParentDimensions.height || 1);
    const scaleZ = newDepth / (raycastParentDimensions.depth || 1);
    scaledOrigin = new THREE.Vector3(
      (raycastLocalOrigin as [number,number,number])[0] * scaleX,
      (raycastLocalOrigin as [number,number,number])[1] * scaleY,
      (raycastLocalOrigin as [number,number,number])[2] * scaleZ
    );
  } else {
    const localVertices: THREE.Vector3[] = [];
    matchedGroup.faceIndices.forEach((idx: number) => {
      const face = faces[idx];
      if (face) face.vertices.forEach((v: THREE.Vector3) => localVertices.push(v.clone()));
    });
    const localBox = new THREE.Box3().setFromPoints(localVertices);
    scaledOrigin = new THREE.Vector3();
    localBox.getCenter(scaledOrigin);
    const faceN = matchedGroup.normal.clone().normalize();
    const inset = Math.min(newWidth, newHeight, newDepth) * 0.1;
    scaledOrigin.addScaledVector(faceN.negate(), inset);
  }

  const { collectBoundaryEdges, getFacePlaneAxes, castRayOnFace, collectPanelObstacleEdges } = await import('./RaycastUtils');

  const facePlaneNormal = matchedGroup.normal.clone().normalize();
  const obstacleEdges = collectPanelObstacleEdges(
    allPanels.filter(p => p.id !== panel.id),
    facePlaneNormal,
    scaledOrigin,
    20
  );

  const { u, v } = getFacePlaneAxes(facePlaneNormal);
  const boundaryEdges = collectBoundaryEdges(faces, matchedGroup.faceIndices);
  const offset = facePlaneNormal.clone().multiplyScalar(0.5);
  const startWorld = scaledOrigin.clone().add(offset);
  const maxDist = 5000;

  const tUPlus = castRayOnFace(startWorld, u, boundaryEdges, obstacleEdges, u, v, scaledOrigin, maxDist);
  const tUMinus = castRayOnFace(startWorld, u.clone().negate(), boundaryEdges, obstacleEdges, u, v, scaledOrigin, maxDist);
  const tVPlus = castRayOnFace(startWorld, v, boundaryEdges, obstacleEdges, u, v, scaledOrigin, maxDist);
  const tVMinus = castRayOnFace(startWorld, v.clone().negate(), boundaryEdges, obstacleEdges, u, v, scaledOrigin, maxDist);

  const panelW = tUPlus + tUMinus;
  const panelH = tVPlus + tVMinus;
  const panelThickness = panel.parameters?.depth || 18;

  const shapePos = new THREE.Vector3(parentShape.position[0], parentShape.position[1], parentShape.position[2]);
  const shapeRot = parentShape.rotation as [number, number, number];
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(shapeRot[0], shapeRot[1], shapeRot[2], 'XYZ'));

  const worldOrigin = scaledOrigin.clone().applyQuaternion(rot).add(shapePos);
  const worldU = u.clone().applyQuaternion(rot).normalize();
  const worldV = v.clone().applyQuaternion(rot).normalize();
  const worldN = facePlaneNormal.clone().applyQuaternion(rot).normalize();

  const worldCorner = worldOrigin.clone()
    .addScaledVector(worldU, -tUMinus)
    .addScaledVector(worldV, -tVMinus);

  await initReplicad();

  const xAxis: [number, number, number] = [worldU.x, worldU.y, worldU.z];
  const normalAxis: [number, number, number] = [worldN.x, worldN.y, worldN.z];
  const originPt: [number, number, number] = [worldCorner.x, worldCorner.y, worldCorner.z];

  const sketchPlane = new Plane(originPt, xAxis, normalAxis);

  let panelShape = draw()
    .movePointerTo([0, 0])
    .lineTo([panelW, 0])
    .lineTo([panelW, panelH])
    .lineTo([0, panelH])
    .close()
    .sketchOnPlane(sketchPlane)
    .extrude(-panelThickness);

  const parentSubtractions = (parentShape.subtractionGeometries || []).filter(Boolean);
  const hasSubtractions = parentSubtractions.length > 0;
  const hasFillets = (parentShape.fillets || []).length > 0;

  const buildParentWorld = async (parentReplicad: any) => {
    const rotDegX = shapeRot[0] * (180 / Math.PI);
    const rotDegY = shapeRot[1] * (180 / Math.PI);
    const rotDegZ = shapeRot[2] * (180 / Math.PI);
    let pw = parentReplicad;
    if (Math.abs(rotDegX) > 0.01) pw = pw.rotate(rotDegX, [0, 0, 0], [1, 0, 0]);
    if (Math.abs(rotDegY) > 0.01) pw = pw.rotate(rotDegY, [0, 0, 0], [0, 1, 0]);
    if (Math.abs(rotDegZ) > 0.01) pw = pw.rotate(rotDegZ, [0, 0, 0], [0, 0, 1]);
    return pw.translate(shapePos.x, shapePos.y, shapePos.z);
  };

  const applySubtractionCuts = async (panel: any) => {
    const { createReplicadBox, performBooleanCut } = await import('./ReplicadService');
    const { getOriginalSize } = await import('./ShapeUpdaterService');

    const parentBox = new THREE.Box3().setFromBufferAttribute(
      parentShape.geometry.attributes.position as THREE.BufferAttribute
    );
    const parentCenter = new THREE.Vector3();
    const parentSize = new THREE.Vector3();
    parentBox.getCenter(parentCenter);
    parentBox.getSize(parentSize);
    const isCentered = Math.abs(parentCenter.x) < 0.01 &&
                       Math.abs(parentCenter.y) < 0.01 &&
                       Math.abs(parentCenter.z) < 0.01;
    const rot2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(shapeRot[0], shapeRot[1], shapeRot[2], 'XYZ'));
    const parentCornerWorld = shapePos.clone();
    if (isCentered) {
      const halfLocal = new THREE.Vector3(parentSize.x / 2, parentSize.y / 2, parentSize.z / 2);
      halfLocal.applyQuaternion(rot2);
      parentCornerWorld.sub(halfLocal);
    }

    let result = panel;
    for (const subtraction of parentSubtractions) {
      try {
        const subSize = getOriginalSize(subtraction.geometry);
        const subBox = await createReplicadBox({ width: subSize.x, height: subSize.y, depth: subSize.z });
        const subLocalPos = new THREE.Vector3(...subtraction.relativeOffset as [number, number, number]);
        const subWorldPos = subLocalPos.clone().applyQuaternion(rot2).add(parentCornerWorld);
        const subRelRot = subtraction.relativeRotation || [0, 0, 0];
        const subRotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(subRelRot[0], subRelRot[1], subRelRot[2], 'XYZ'));
        const subWorldQ = rot2.clone().multiply(subRotQ);
        const subWorldEuler = new THREE.Euler().setFromQuaternion(subWorldQ, 'XYZ');
        result = await performBooleanCut(
          result, subBox, undefined,
          [subWorldPos.x, subWorldPos.y, subWorldPos.z],
          undefined,
          [subWorldEuler.x, subWorldEuler.y, subWorldEuler.z],
          undefined,
          subtraction.scale || [1, 1, 1] as [number, number, number]
        );
      } catch (cutErr) {
        console.warn('Subtractor cut skipped:', cutErr);
      }
    }
    return result;
  };

  const rebuildParentWithFillets = async () => {
    const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry: cvt } = await import('./ReplicadService');
    const { getOriginalSize, applyFillets, updateFilletCentersForNewGeometry } = await import('./ShapeUpdaterService');
    const baseWidth = parentShape.parameters?.width || 1;
    const baseHeight = parentShape.parameters?.height || 1;
    const baseDepth = parentShape.parameters?.depth || 1;

    let rebuilt = await createReplicadBox({ width: baseWidth, height: baseHeight, depth: baseDepth });

    for (const sub of parentSubtractions) {
      try {
        const subSize = getOriginalSize(sub.geometry);
        const subBox = await createReplicadBox({ width: subSize.x, height: subSize.y, depth: subSize.z });
        rebuilt = await performBooleanCut(
          rebuilt, subBox, undefined, sub.relativeOffset,
          undefined, sub.relativeRotation || [0, 0, 0],
          undefined, sub.scale || [1, 1, 1] as [number, number, number]
        );
      } catch (e) { /* skip */ }
    }

    if (hasFillets) {
      const geom = cvt(rebuilt);
      const updatedFillets = await updateFilletCentersForNewGeometry(parentShape.fillets, geom, {
        width: baseWidth, height: baseHeight, depth: baseDepth
      });
      rebuilt = await applyFillets(rebuilt, updatedFillets, { width: baseWidth, height: baseHeight, depth: baseDepth });
    }

    return rebuilt;
  };

  if (hasSubtractions || hasFillets) {
    const { performBooleanIntersection } = await import('./ReplicadService');
    let intersected = false;
    try {
      const freshParent = await rebuildParentWithFillets();
      const parentWorld = await buildParentWorld(freshParent);
      panelShape = await performBooleanIntersection(panelShape, parentWorld);
      intersected = true;
    } catch (rebuildErr) {
      console.warn('Raycast panel rebuild: fresh parent intersection failed, trying stored shape:', rebuildErr);
    }

    if (!intersected && parentShape.replicadShape) {
      try {
        const parentWorld = await buildParentWorld(parentShape.replicadShape);
        panelShape = await performBooleanIntersection(panelShape, parentWorld);
        intersected = true;
      } catch (storedErr) {
        console.warn('Raycast panel rebuild: stored shape intersection failed, falling back to cuts:', storedErr);
      }
    }

    if (!intersected && hasSubtractions) {
      panelShape = await applySubtractionCuts(panelShape);
    }
  } else if (hasSubtractions) {
    panelShape = await applySubtractionCuts(panelShape);
  }

  const geometry = convertReplicadToThreeGeometry(panelShape);

  return {
    id: panel.id,
    geometry,
    replicadShape: panelShape,
    parameters: {
      ...panel.parameters,
      width: panelW,
      height: panelH,
      originalReplicadShape: null,
      jointTrimmed: false,
      raycastBounds: { uPlus: tUPlus, uMinus: tUMinus, vPlus: tVPlus, vMinus: tVMinus },
      raycastParentDimensions: {
        width: newWidth,
        height: newHeight,
        depth: newDepth,
      },
      raycastLocalOrigin: [scaledOrigin.x, scaledOrigin.y, scaledOrigin.z] as [number, number, number],
    }
  };
}

export async function rebuildAllPanels(parentShapeId: string): Promise<void> {
  const state = useAppStore.getState();
  const parentShape = state.shapes.find(s => s.id === parentShapeId);
  if (!parentShape || !parentShape.replicadShape || !parentShape.geometry) return;

  const childPanels = state.shapes.filter(
    s => s.type === 'panel' &&
    s.parameters?.parentShapeId === parentShapeId &&
    !s.parameters?.isBaza
  );
  if (childPanels.length === 0) return;

  console.log(`Rebuilding ${childPanels.length} panels for parent ${parentShapeId}...`);

  const { extractFacesFromGeometry, groupCoplanarFaces } = await import('./FaceEditor');
  const { createPanelFromFace, convertReplicadToThreeGeometry } = await import('./ReplicadService');

  const faces = extractFacesFromGeometry(parentShape.geometry);
  const faceGroups = groupCoplanarFaces(faces);

  const updates: Array<{ id: string; geometry: any; replicadShape: any; parameters: any }> = [];

  const faceRolePanels = childPanels.filter(p => !p.parameters?.isRaycastPanel);
  const raycastPanels = childPanels.filter(p => p.parameters?.isRaycastPanel);

  for (const panel of faceRolePanels) {
    const faceIndex = panel.parameters?.faceIndex;
    if (faceIndex === undefined || faceIndex >= faceGroups.length) continue;

    const faceGroup = faceGroups[faceIndex];

    const localVertices: THREE.Vector3[] = [];
    faceGroup.faceIndices.forEach((idx: number) => {
      const face = faces[idx];
      face.vertices.forEach((v: THREE.Vector3) => localVertices.push(v.clone()));
    });

    const localNormal = faceGroup.normal.clone().normalize();
    const localBox = new THREE.Box3().setFromPoints(localVertices);
    const localCenter = new THREE.Vector3();
    localBox.getCenter(localCenter);

    const panelThickness = panel.parameters?.depth || 18;

    try {
      const hasFillets = parentShape.fillets && parentShape.fillets.length > 0;
      const replicadPanel = await createPanelFromFace(
        parentShape.replicadShape,
        [localNormal.x, localNormal.y, localNormal.z],
        [localCenter.x, localCenter.y, localCenter.z],
        panelThickness,
        hasFillets ? parentShape.replicadShape : undefined
      );

      if (!replicadPanel) continue;

      const geometry = convertReplicadToThreeGeometry(replicadPanel);

      updates.push({
        id: panel.id,
        geometry,
        replicadShape: replicadPanel,
        parameters: {
          ...panel.parameters,
          originalReplicadShape: null,
          jointTrimmed: false,
        }
      });
    } catch (error) {
      console.error(`Failed to rebuild face-role panel ${panel.id}:`, error);
    }
  }

  for (const panel of raycastPanels) {
    try {
      const result = await rebuildRaycastPanel(panel, parentShape, faces, faceGroups, childPanels);
      if (result) {
        updates.push(result);
      }
    } catch (error) {
      console.error(`Failed to rebuild raycast panel ${panel.id}:`, error);
    }
  }

  if (updates.length > 0) {
    useAppStore.setState((st) => ({
      shapes: st.shapes.map(s => {
        const update = updates.find(u => u.id === s.id);
        if (update) {
          const parent = st.shapes.find(p => p.id === parentShapeId);
          const isRaycast = s.parameters?.isRaycastPanel;
          return {
            ...s,
            geometry: update.geometry,
            replicadShape: update.replicadShape,
            position: isRaycast ? ([0, 0, 0] as [number, number, number]) : (parent ? [...parent.position] as [number, number, number] : s.position),
            rotation: isRaycast ? ([0, 0, 0] as [number, number, number]) : (parent ? parent.rotation : s.rotation),
            scale: parent ? [...parent.scale] as [number, number, number] : s.scale,
            parameters: update.parameters,
          };
        }
        return s;
      })
    }));
    console.log(`Rebuilt ${updates.length} panels successfully`);
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
