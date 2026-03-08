import { useAppStore, FaceRole } from '../store';

type JointRelation = 'dominant' | 'subordinate' | null;

function getFaceJointRelation(roleA: FaceRole, roleB: FaceRole): JointRelation {
  const dominanceOrder: FaceRole[] = ['Left', 'Right', 'Top', 'Bottom', 'Back', 'Door'];
  if (!roleA || !roleB) return null;
  const indexA = dominanceOrder.indexOf(roleA);
  const indexB = dominanceOrder.indexOf(roleB);
  if (indexA < 0 || indexB < 0) return null;
  if (indexA < indexB) return 'dominant';
  if (indexA > indexB) return 'subordinate';
  return null;
}

export async function rebuildAllPanels(parentShapeId: string): Promise<void> {
  const state = useAppStore.getState();
  const parentShape = state.shapes.find(s => s.id === parentShapeId);
  if (!parentShape || !parentShape.replicadShape) return;

  const panels = state.shapes.filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === parentShapeId
  );

  if (panels.length === 0) return;

  const { extractFacesFromGeometry, groupCoplanarFaces } = await import('./FaceEditor');
  const { createPanelFromFace, convertReplicadToThreeGeometry } = await import('./ReplicadService');

  const faces = extractFacesFromGeometry(parentShape.geometry);
  const faceGroups = groupCoplanarFaces(faces);

  for (const panel of panels) {
    const faceIndex = panel.parameters?.faceIndex;
    if (faceIndex === undefined || faceIndex >= faceGroups.length) continue;

    const faceGroup = faceGroups[faceIndex];

    try {
      const faceNormal: [number, number, number] = [faceGroup.normal.x, faceGroup.normal.y, faceGroup.normal.z];
      const faceCenter: [number, number, number] = [faceGroup.center.x, faceGroup.center.y, faceGroup.center.z];
      const thickness = panel.parameters?.thickness || 18;

      const replicadPanel = await createPanelFromFace(
        parentShape.replicadShape,
        faceNormal,
        faceCenter,
        thickness
      );

      if (!replicadPanel) continue;

      const geometry = convertReplicadToThreeGeometry(replicadPanel);

      useAppStore.getState().updateShape(panel.id, {
        geometry,
        replicadShape: replicadPanel,
        position: [...parentShape.position] as [number, number, number]
      });
    } catch (err) {
      console.error(`Failed to rebuild panel ${panel.id}:`, err);
    }
  }
}

export async function resolveAllPanelJoints(
  parentShapeId: string,
  profileId: string
): Promise<void> {
  const state = useAppStore.getState();
  const parentShape = state.shapes.find(s => s.id === parentShapeId);
  if (!parentShape) return;

  const panels = state.shapes.filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === parentShapeId && s.parameters?.faceRole
  );

  if (panels.length < 2) return;

  const originalShapes = new Map<string, any>();
  for (const panel of panels) {
    if (!panel.replicadShape) continue;
    originalShapes.set(panel.id, panel.replicadShape);
  }

  const cutsMap = new Map<string, string[]>();

  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const pA = panels[i];
      const pB = panels[j];
      const roleA = pA.parameters?.faceRole as FaceRole;
      const roleB = pB.parameters?.faceRole as FaceRole;

      const dominant = getFaceJointRelation(roleA, roleB);
      if (!dominant) continue;

      const isADominant = dominant === roleA;
      const subordinateId = isADominant ? pB.id : pA.id;
      const dominantId = isADominant ? pA.id : pB.id;

      const existing = cutsMap.get(subordinateId) || [];
      existing.push(dominantId);
      cutsMap.set(subordinateId, existing);
    }
  }

  const { convertReplicadToThreeGeometry } = await import('./ReplicadService');
  const updates = new Map<string, { geometry: any; replicadShape: any }>();

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
        const geometry = convertReplicadToThreeGeometry(currentShape);
        updates.set(panel.id, {
          geometry,
          replicadShape: currentShape
        });
      } catch (err) {
        console.error(`Failed to convert trimmed panel:`, err);
      }
    }
  }

  if (updates.size > 0) {
    useAppStore.setState((st) => ({
      shapes: st.shapes.map((s) => {
        const update = updates.get(s.id);
        if (update) {
          return {
            ...s,
            geometry: update.geometry,
            replicadShape: update.replicadShape
          };
        }
        return s;
      })
    }));
  }
}

export async function restoreAllPanels(parentShapeId: string): Promise<void> {
  const state = useAppStore.getState();
  const panels = state.shapes.filter(
    s => s.type === 'panel' && s.parameters?.parentShapeId === parentShapeId
  );

  if (panels.length === 0) return;

  const { convertReplicadToThreeGeometry } = await import('./ReplicadService');

  useAppStore.setState((st) => ({
    shapes: st.shapes.map((s) => {
      const panel = panels.find(p => p.id === s.id);
      if (!panel || !panel.replicadShape) return s;

      try {
        const geometry = convertReplicadToThreeGeometry(panel.replicadShape);
        return { ...s, geometry };
      } catch {
        return s;
      }
    })
  }));
}
