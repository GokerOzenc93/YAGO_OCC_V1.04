import * as THREE from 'three';
import { Shape } from '../store';
import { performBooleanCut, convertReplicadToThreeGeometry } from './replicad';
import { getReplicadVertices } from './vertexEditor';

export const recalculateParametricCut = async (
  targetShape: Shape,
  cuttingShape: Shape,
  shapes: Shape[]
): Promise<{ geometry: THREE.BufferGeometry; replicadShape: any; scaledBaseVertices: number[][] }> => {
  console.log('🔄 Recalculating parametric cut...');
  console.log('Target shape:', targetShape.id);
  console.log('Cutting shape:', cuttingShape.id);
  console.log('Cutting shape parameters:', cuttingShape.parameters);

  const parametricCut = targetShape.parameters.parametricCut;
  if (!parametricCut) {
    throw new Error('No parametric cut data found');
  }

  console.log('📦 Recreating cutting shape with new dimensions...');
  const { createReplicadBox, createReplicadCylinder } = await import('./replicad');

  let newCuttingReplicadShape: any;

  if (cuttingShape.type === 'box') {
    newCuttingReplicadShape = await createReplicadBox({
      width: cuttingShape.parameters.width,
      height: cuttingShape.parameters.height,
      depth: cuttingShape.parameters.depth
    });
  } else if (cuttingShape.type === 'cylinder') {
    newCuttingReplicadShape = await createReplicadCylinder({
      radius: cuttingShape.parameters.radius,
      height: cuttingShape.parameters.height
    });
  } else {
    throw new Error(`Unsupported cutting shape type: ${cuttingShape.type}`);
  }

  console.log('✅ New cutting shape created');

  const originalTargetShape = shapes.find(s => s.id === targetShape.id);
  if (!originalTargetShape || !originalTargetShape.replicadShape) {
    throw new Error('Original target shape or replicadShape not found');
  }

  let baseReplicadShape = originalTargetShape.replicadShape;

  if (originalTargetShape.type === 'box') {
    const { createReplicadBox } = await import('./replicad');
    baseReplicadShape = await createReplicadBox({
      width: originalTargetShape.parameters.width,
      height: originalTargetShape.parameters.height,
      depth: originalTargetShape.parameters.depth
    });
  } else if (originalTargetShape.type === 'cylinder') {
    const { createReplicadCylinder } = await import('./replicad');
    baseReplicadShape = await createReplicadCylinder({
      radius: originalTargetShape.parameters.radius,
      height: originalTargetShape.parameters.height
    });
  }

  console.log('🔪 Performing boolean cut with new dimensions...');
  const resultShape = await performBooleanCut(
    baseReplicadShape,
    newCuttingReplicadShape,
    parametricCut.cuttingPosition || targetShape.position,
    parametricCut.cuttingPosition,
    parametricCut.cuttingRotation || targetShape.rotation,
    parametricCut.cuttingRotation,
    parametricCut.cuttingScale || targetShape.scale,
    parametricCut.cuttingScale
  );

  const newGeometry = convertReplicadToThreeGeometry(resultShape);
  const newBaseVertices = await getReplicadVertices(resultShape);

  console.log('✅ Parametric cut recalculated successfully');

  return {
    geometry: newGeometry,
    replicadShape: resultShape,
    scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
  };
};
