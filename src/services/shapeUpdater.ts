import * as THREE from 'three';
import { evaluateExpression } from '../utils/expression';
import type { FilletInfo } from '../store';

export const getOriginalSize = (geometry: THREE.BufferGeometry) => {
  const box = new THREE.Box3().setFromBufferAttribute(
    geometry.attributes.position as THREE.BufferAttribute
  );
  const size = new THREE.Vector3();
  box.getSize(size);
  return size;
};

export async function applyFillets(replicadShape: any, fillets: FilletInfo[], shapeSize: { width: number; height: number; depth: number }) {
  if (!fillets || fillets.length === 0) return replicadShape;

  console.log(`🔵 Applying ${fillets.length} fillet(s) to shape...`);

  let currentShape = replicadShape;

  for (const fillet of fillets) {
    console.log(`🔵 Applying fillet with radius ${fillet.radius}...`);

    const face1Center = new THREE.Vector3(...fillet.face1Data.center);
    const face2Center = new THREE.Vector3(...fillet.face2Data.center);
    const face1Normal = new THREE.Vector3(...fillet.face1Data.normal);
    const face2Normal = new THREE.Vector3(...fillet.face2Data.normal);

    let edgeCount = 0;
    let foundEdgeCount = 0;

    currentShape = currentShape.fillet((edge: any) => {
      edgeCount++;
      try {
        const start = edge.startPoint;
        const end = edge.endPoint;

        if (!start || !end) return null;

        const centerVec = new THREE.Vector3(
          (start.x + end.x) / 2,
          (start.y + end.y) / 2,
          (start.z + end.z) / 2
        );

        const distToFace1 = Math.abs(centerVec.clone().sub(face1Center).dot(face1Normal));
        const distToFace2 = Math.abs(centerVec.clone().sub(face2Center).dot(face2Normal));

        const maxDimension = Math.max(shapeSize.width || 1, shapeSize.height || 1, shapeSize.depth || 1);
        const tolerance = maxDimension * 0.15;

        if (distToFace1 < tolerance && distToFace2 < tolerance) {
          foundEdgeCount++;
          console.log(`✅ Found shared edge #${foundEdgeCount} - applying fillet radius: ${fillet.radius}`);
          return fillet.radius;
        }

        return null;
      } catch (e) {
        console.error('❌ Error checking edge:', e);
        return null;
      }
    });

    console.log(`🔢 Total edges checked: ${edgeCount}, Edges filleted: ${foundEdgeCount}`);
  }

  console.log('✅ All fillets applied successfully!');
  return currentShape;
}

interface ApplyShapeChangesParams {
  selectedShape: any;
  width: number;
  height: number;
  depth: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  customParameters: any[];
  vertexModifications: any[];
  selectedSubtractionIndex: number | null;
  subWidth: number;
  subHeight: number;
  subDepth: number;
  subPosX: number;
  subPosY: number;
  subPosZ: number;
  subRotX: number;
  subRotY: number;
  subRotZ: number;
  subParams?: {
    width: { expression: string; result: number };
    height: { expression: string; result: number };
    depth: { expression: string; result: number };
    posX: { expression: string; result: number };
    posY: { expression: string; result: number };
    posZ: { expression: string; result: number };
    rotX: { expression: string; result: number };
    rotY: { expression: string; result: number };
    rotZ: { expression: string; result: number };
  };
  updateShape: (id: string, updates: any) => void;
}

export async function applyShapeChanges(params: ApplyShapeChangesParams) {
  const {
    selectedShape,
    width,
    height,
    depth,
    rotX,
    rotY,
    rotZ,
    customParameters,
    vertexModifications,
    selectedSubtractionIndex,
    subWidth,
    subHeight,
    subDepth,
    subPosX,
    subPosY,
    subPosZ,
    subRotX,
    subRotY,
    subRotZ,
    subParams,
    updateShape
  } = params;

  if (!selectedShape) return;

  console.log('📐 Applying parameter changes:', { width, height, depth });

  try {
    const { getBoxVertices, getReplicadVertices } = await import('./vertexEditor');
    const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('./replicad');

    let newBaseVertices: THREE.Vector3[] = [];
    let currentBaseVertices: THREE.Vector3[] = [];

    const currentWidth = selectedShape.parameters.width;
    const currentHeight = selectedShape.parameters.height;
    const currentDepth = selectedShape.parameters.depth;

    const scaleX = width / currentWidth;
    const scaleY = height / currentHeight;
    const scaleZ = depth / currentDepth;

    const dimensionsChanged = width !== currentWidth || height !== currentHeight || depth !== currentDepth;

    if (selectedShape.parameters.scaledBaseVertices?.length > 0) {
      currentBaseVertices = selectedShape.parameters.scaledBaseVertices.map((v: number[]) => new THREE.Vector3(v[0], v[1], v[2]));
      newBaseVertices = dimensionsChanged ? currentBaseVertices.map(v => new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)) : currentBaseVertices;
    } else if (selectedShape.replicadShape) {
      currentBaseVertices = await getReplicadVertices(selectedShape.replicadShape);
      newBaseVertices = dimensionsChanged ? currentBaseVertices.map(v => new THREE.Vector3(v.x * scaleX, v.y * scaleY, v.z * scaleZ)) : currentBaseVertices;
    } else if (selectedShape.type === 'box') {
      newBaseVertices = getBoxVertices(width, height, depth);
      currentBaseVertices = getBoxVertices(currentWidth, currentHeight, currentDepth);
    }

    const vertexFinalPositions = new Map<number, [number, number, number]>();

    const evalContext = {
      W: width,
      H: height,
      D: depth,
      ...customParameters.reduce((acc, param) => ({ ...acc, [param.name]: param.result }), {})
    };

    vertexModifications.forEach((mod: any) => {
      const newOriginalPos = newBaseVertices[mod.vertexIndex]
        ? [newBaseVertices[mod.vertexIndex].x, newBaseVertices[mod.vertexIndex].y, newBaseVertices[mod.vertexIndex].z] as [number, number, number]
        : mod.originalPosition;

      if (!vertexFinalPositions.has(mod.vertexIndex)) {
        vertexFinalPositions.set(mod.vertexIndex, [...newOriginalPos] as [number, number, number]);
      }

      const offsetValue = evaluateExpression(mod.expression, evalContext);
      const axisIndex = mod.direction.startsWith('x') ? 0 : mod.direction.startsWith('y') ? 1 : 2;
      vertexFinalPositions.get(mod.vertexIndex)![axisIndex] = offsetValue;
    });

    const updatedVertexMods = vertexModifications.map((mod: any) => {
      const newOriginalPos = newBaseVertices[mod.vertexIndex]
        ? [newBaseVertices[mod.vertexIndex].x, newBaseVertices[mod.vertexIndex].y, newBaseVertices[mod.vertexIndex].z] as [number, number, number]
        : mod.originalPosition;

      const axisIndex = mod.direction.startsWith('x') ? 0 : mod.direction.startsWith('y') ? 1 : 2;
      const finalPos = vertexFinalPositions.get(mod.vertexIndex)!;
      const newOffset = [0, 0, 0] as [number, number, number];
      newOffset[axisIndex] = finalPos[axisIndex] - newOriginalPos[axisIndex];

      return {
        ...mod,
        originalPosition: newOriginalPos,
        newPosition: finalPos,
        offset: newOffset,
        expression: mod.expression
      };
    });

    let scaledGeometry = selectedShape.geometry;

    if (dimensionsChanged && selectedShape.geometry) {
      console.log('📏 Scaling geometry by:', { scaleX, scaleY, scaleZ });
      scaledGeometry = selectedShape.geometry.clone();
      scaledGeometry.scale(scaleX, scaleY, scaleZ);
      scaledGeometry.computeVertexNormals();
      scaledGeometry.computeBoundingBox();
      scaledGeometry.computeBoundingSphere();

      const box = new THREE.Box3().setFromBufferAttribute(
        scaledGeometry.getAttribute('position')
      );
      const center = new THREE.Vector3();
      box.getCenter(center);
      console.log('✓ Scaled geometry center:', { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) });
    }

    const hasSubtractionChanges = selectedSubtractionIndex !== null && selectedShape.subtractionGeometries?.length > 0;

    const newRotation: [number, number, number] = [
      rotX * (Math.PI / 180),
      rotY * (Math.PI / 180),
      rotZ * (Math.PI / 180)
    ];

    const baseUpdate = {
      parameters: {
        ...selectedShape.parameters,
        width,
        height,
        depth,
        customParameters,
        scaledBaseVertices: newBaseVertices.length > 0 ? newBaseVertices.map(v => [v.x, v.y, v.z]) : selectedShape.parameters.scaledBaseVertices
      },
      vertexModifications: updatedVertexMods,
      position: selectedShape.position,
      rotation: newRotation,
      scale: selectedShape.scale
    };

    if (hasSubtractionChanges) {
      console.log('🔄 Recalculating subtraction with updated dimensions...');

      const updatedSubtraction = {
        ...selectedShape.subtractionGeometries![selectedSubtractionIndex],
        geometry: new THREE.BoxGeometry(subWidth, subHeight, subDepth),
        relativeOffset: [subPosX, subPosY, subPosZ] as [number, number, number],
        relativeRotation: [
          subRotX * (Math.PI / 180),
          subRotY * (Math.PI / 180),
          subRotZ * (Math.PI / 180)
        ] as [number, number, number],
        parameters: subParams ? {
          width: subParams.width.expression,
          height: subParams.height.expression,
          depth: subParams.depth.expression,
          posX: subParams.posX.expression,
          posY: subParams.posY.expression,
          posZ: subParams.posZ.expression,
          rotX: subParams.rotX.expression,
          rotY: subParams.rotY.expression,
          rotZ: subParams.rotZ.expression
        } : undefined
      };

      const allSubtractions = selectedShape.subtractionGeometries!.map((sub: any, idx: number) =>
        idx === selectedSubtractionIndex ? updatedSubtraction : sub
      );

      let baseShape = await createReplicadBox({
        width,
        height,
        depth
      });

      let resultShape = baseShape;

      for (let i = 0; i < allSubtractions.length; i++) {
        const subtraction = allSubtractions[i];
        if (!subtraction) continue;

        const subSize = getOriginalSize(subtraction.geometry);

        const subBox = await createReplicadBox({
          width: subSize.x,
          height: subSize.y,
          depth: subSize.z
        });

        resultShape = await performBooleanCut(
          resultShape,
          subBox,
          undefined,
          subtraction.relativeOffset,
          undefined,
          subtraction.relativeRotation || [0, 0, 0],
          undefined,
          subtraction.scale || [1, 1, 1] as [number, number, number]
        );
      }

      if (selectedShape.fillets && selectedShape.fillets.length > 0) {
        console.log('🔵 Reapplying fillets after subtraction...');
        resultShape = await applyFillets(resultShape, selectedShape.fillets, { width, height, depth });
      }

      const newGeometry = convertReplicadToThreeGeometry(resultShape);
      const newBaseVertices = await getReplicadVertices(resultShape);

      updateShape(selectedShape.id, {
        ...baseUpdate,
        geometry: newGeometry,
        replicadShape: resultShape,
        subtractionGeometries: allSubtractions,
        parameters: {
          ...baseUpdate.parameters,
          scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
        }
      });
    } else {
      if (dimensionsChanged && scaledGeometry) {
        console.log('🔄 Dimensions changed, recreating replicad shape with new dimensions...');

        let newReplicadShape = await createReplicadBox({
          width,
          height,
          depth
        });

        if (selectedShape.fillets && selectedShape.fillets.length > 0) {
          console.log('🔵 Reapplying fillets after dimension change...');
          newReplicadShape = await applyFillets(newReplicadShape, selectedShape.fillets, { width, height, depth });
        }

        const newGeometry = convertReplicadToThreeGeometry(newReplicadShape);
        const newBaseVertices = await getReplicadVertices(newReplicadShape);

        updateShape(selectedShape.id, {
          ...baseUpdate,
          geometry: newGeometry,
          replicadShape: newReplicadShape,
          parameters: {
            ...baseUpdate.parameters,
            scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
          }
        });

        console.log('✓ Replicad shape recreated with dimensions:', { width, height, depth });
      } else {
        updateShape(selectedShape.id, baseUpdate);
      }
    }

    console.log('✅ Parameters applied');
  } catch (error) {
    console.error('❌ Failed to update parameters:', error);
    updateShape(selectedShape.id, {
      parameters: { ...selectedShape.parameters, width, height, depth, customParameters },
      vertexModifications: []
    });
  }
}

interface ApplySubtractionChangesParams {
  selectedShapeId: string | null;
  selectedSubtractionIndex: number | null;
  shapes: any[];
  subWidth: number;
  subHeight: number;
  subDepth: number;
  subPosX: number;
  subPosY: number;
  subPosZ: number;
  subRotX: number;
  subRotY: number;
  subRotZ: number;
  updateShape: (id: string, updates: any) => void;
  shapeOverride?: any;
}

export async function applySubtractionChanges(params: ApplySubtractionChangesParams) {
  const {
    selectedShapeId,
    selectedSubtractionIndex,
    shapes,
    subWidth,
    subHeight,
    subDepth,
    subPosX,
    subPosY,
    subPosZ,
    subRotX,
    subRotY,
    subRotZ,
    updateShape,
    shapeOverride
  } = params;

  const currentShape = shapeOverride || shapes.find(s => s.id === selectedShapeId);
  if (!currentShape || selectedSubtractionIndex === null || !currentShape.subtractionGeometries) return;

  console.log('🔧 Applying subtraction changes:', {
    subIndex: selectedSubtractionIndex,
    newSize: { w: subWidth, h: subHeight, d: subDepth },
    newPos: { x: subPosX, y: subPosY, z: subPosZ }
  });

  const { getReplicadVertices } = await import('./vertexEditor');
  const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('./replicad');

  const newSubGeometry = new THREE.BoxGeometry(subWidth, subHeight, subDepth);
  const currentSubtraction = currentShape.subtractionGeometries[selectedSubtractionIndex];

  const updatedSubtraction = {
    ...currentSubtraction,
    geometry: newSubGeometry,
    relativeOffset: [subPosX, subPosY, subPosZ] as [number, number, number],
    relativeRotation: [
      subRotX * (Math.PI / 180),
      subRotY * (Math.PI / 180),
      subRotZ * (Math.PI / 180)
    ] as [number, number, number],
    scale: currentSubtraction.scale || [1, 1, 1] as [number, number, number],
    parameters: {
      width: String(subWidth),
      height: String(subHeight),
      depth: String(subDepth),
      posX: String(subPosX),
      posY: String(subPosY),
      posZ: String(subPosZ),
      rotX: String(subRotX),
      rotY: String(subRotY),
      rotZ: String(subRotZ)
    }
  };

  const allSubtractions = currentShape.subtractionGeometries.map((sub: any, idx: number) =>
    idx === selectedSubtractionIndex ? updatedSubtraction : sub
  );

  console.log(`🔄 Applying ${allSubtractions.length} subtraction(s)...`);

  const baseShape = await createReplicadBox({
    width: currentShape.parameters.width || 1,
    height: currentShape.parameters.height || 1,
    depth: currentShape.parameters.depth || 1
  });

  let resultShape = baseShape;

  for (let i = 0; i < allSubtractions.length; i++) {
    const subtraction = allSubtractions[i];
    const subSize = getOriginalSize(subtraction.geometry);

    const subBox = await createReplicadBox({
      width: subSize.x,
      height: subSize.y,
      depth: subSize.z
    });

    resultShape = await performBooleanCut(
      resultShape,
      subBox,
      undefined,
      subtraction.relativeOffset,
      undefined,
      subtraction.relativeRotation || [0, 0, 0],
      undefined,
      subtraction.scale || [1, 1, 1] as [number, number, number]
    );
  }

  if (currentShape.fillets && currentShape.fillets.length > 0) {
    console.log('🔵 Reapplying fillets after subtraction changes...');
    resultShape = await applyFillets(resultShape, currentShape.fillets, {
      width: currentShape.parameters.width || 1,
      height: currentShape.parameters.height || 1,
      depth: currentShape.parameters.depth || 1
    });
  }

  const newGeometry = convertReplicadToThreeGeometry(resultShape);
  const newBaseVertices = await getReplicadVertices(resultShape);

  console.log('✅ Subtraction complete');

  updateShape(currentShape.id, {
    geometry: newGeometry,
    replicadShape: resultShape,
    subtractionGeometries: allSubtractions,
    parameters: {
      ...currentShape.parameters,
      scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
    }
  });
}
