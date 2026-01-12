import * as THREE from 'three';
import { evaluateExpression } from './Expression';
import type { FilletInfo } from '../store';

export const getOriginalSize = (geometry: THREE.BufferGeometry) => {
  const box = new THREE.Box3().setFromBufferAttribute(
    geometry.attributes.position as THREE.BufferAttribute
  );
  const size = new THREE.Vector3();
  box.getSize(size);
  return size;
};

export async function updateFilletCentersForNewGeometry(
  fillets: FilletInfo[],
  newGeometry: THREE.BufferGeometry,
  newSize: { width: number; height: number; depth: number }
): Promise<FilletInfo[]> {
  if (!fillets || fillets.length === 0) return fillets;

  console.log('🔄 Updating fillet centers for new geometry using descriptors...');

  const { extractFacesFromGeometry, findFaceByDescriptor } = await import('./FaceEditor');

  const faces = extractFacesFromGeometry(newGeometry);

  const updatedFillets = fillets.map((fillet, idx) => {
    console.log(`🔄 Updating fillet #${idx + 1} using descriptors...`);
    console.log(`   Current radius: ${fillet.radius}`);

    if (!fillet.face1Descriptor || !fillet.face2Descriptor) {
      console.warn(`⚠️ Fillet #${idx + 1} missing descriptors, skipping update`);
      return fillet;
    }

    console.log(`   Face1 descriptor - Normal: [${fillet.face1Descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);
    console.log(`   Face2 descriptor - Normal: [${fillet.face2Descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);

    const newFace1 = findFaceByDescriptor(fillet.face1Descriptor, faces, newGeometry);
    const newFace2 = findFaceByDescriptor(fillet.face2Descriptor, faces, newGeometry);

    if (!newFace1) {
      console.error(`❌ Could not find matching face1 for fillet #${idx + 1}`);
      console.error(`   Target normal: [${fillet.face1Descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);
      return fillet;
    }

    if (!newFace2) {
      console.error(`❌ Could not find matching face2 for fillet #${idx + 1}`);
      console.error(`   Target normal: [${fillet.face2Descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);
      return fillet;
    }

    console.log(`✅ Fillet #${idx + 1} updated - Found matching faces by descriptor`);

    return {
      ...fillet,
      face1Data: {
        normal: [newFace1.normal.x, newFace1.normal.y, newFace1.normal.z] as [number, number, number],
        center: [newFace1.center.x, newFace1.center.y, newFace1.center.z] as [number, number, number]
      },
      face2Data: {
        normal: [newFace2.normal.x, newFace2.normal.y, newFace2.normal.z] as [number, number, number],
        center: [newFace2.center.x, newFace2.center.y, newFace2.center.z] as [number, number, number]
      },
      originalSize: newSize
    };
  });

  console.log(`✅ Updated ${updatedFillets.length} fillet center(s) using descriptors`);
  return updatedFillets;
}

export async function applyFillets(replicadShape: any, fillets: FilletInfo[], shapeSize: { width: number; height: number; depth: number }) {
  if (!fillets || fillets.length === 0) return replicadShape;

  console.log(`🔵 Applying ${fillets.length} fillet(s) to shape...`);

  let currentShape = replicadShape;

  for (const fillet of fillets) {
    console.log(`🔵 Applying fillet with radius ${fillet.radius}...`);

    const scaleX = shapeSize.width / fillet.originalSize.width;
    const scaleY = shapeSize.height / fillet.originalSize.height;
    const scaleZ = shapeSize.depth / fillet.originalSize.depth;

    const face1Center = new THREE.Vector3(...fillet.face1Data.center);
    face1Center.multiply(new THREE.Vector3(scaleX, scaleY, scaleZ));

    const face2Center = new THREE.Vector3(...fillet.face2Data.center);
    face2Center.multiply(new THREE.Vector3(scaleX, scaleY, scaleZ));

    const face1Normal = new THREE.Vector3(...fillet.face1Data.normal);
    const face2Normal = new THREE.Vector3(...fillet.face2Data.normal);

    console.log(`📐 Scaled face centers for new dimensions (${shapeSize.width}x${shapeSize.height}x${shapeSize.depth})`);
    console.log(`   Face1 center: (${face1Center.x.toFixed(2)}, ${face1Center.y.toFixed(2)}, ${face1Center.z.toFixed(2)})`);
    console.log(`   Face2 center: (${face2Center.x.toFixed(2)}, ${face2Center.y.toFixed(2)}, ${face2Center.z.toFixed(2)})`);

    let edgeCount = 0;
    let foundEdgeCount = 0;

    currentShape = currentShape.fillet((edge: any) => {
      edgeCount++;
      try {
        const start = edge.startPoint;
        const end = edge.endPoint;

        if (!start || !end) return null;

        const startVec = new THREE.Vector3(start.x, start.y, start.z);
        const endVec = new THREE.Vector3(end.x, end.y, end.z);
        const centerVec = new THREE.Vector3(
          (start.x + end.x) / 2,
          (start.y + end.y) / 2,
          (start.z + end.z) / 2
        );

        const maxDimension = Math.max(shapeSize.width || 1, shapeSize.height || 1, shapeSize.depth || 1);
        const tolerance = maxDimension * 0.05;

        const startDistFace1 = Math.abs(startVec.clone().sub(face1Center).dot(face1Normal));
        const startDistFace2 = Math.abs(startVec.clone().sub(face2Center).dot(face2Normal));
        const endDistFace1 = Math.abs(endVec.clone().sub(face1Center).dot(face1Normal));
        const endDistFace2 = Math.abs(endVec.clone().sub(face2Center).dot(face2Normal));
        const centerDistFace1 = Math.abs(centerVec.clone().sub(face1Center).dot(face1Normal));
        const centerDistFace2 = Math.abs(centerVec.clone().sub(face2Center).dot(face2Normal));

        const allPointsOnFace1 = startDistFace1 < tolerance && endDistFace1 < tolerance && centerDistFace1 < tolerance;
        const allPointsOnFace2 = startDistFace2 < tolerance && endDistFace2 < tolerance && centerDistFace2 < tolerance;

        if (allPointsOnFace1 && allPointsOnFace2) {
          foundEdgeCount++;
          console.log(`Found shared edge #${foundEdgeCount} - applying fillet radius: ${fillet.radius}`);
          return fillet.radius;
        }

        return null;
      } catch (e) {
        console.error('Error checking edge:', e);
        return null;
      }
    });

    console.log(`Total edges checked: ${edgeCount}, Edges filleted: ${foundEdgeCount}`);
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
  filletRadii?: number[];
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
    filletRadii,
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
    const { getBoxVertices, getReplicadVertices } = await import('./VertexEditorService');
    const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('./ReplicadService');

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
    const hasFillets = selectedShape.fillets && selectedShape.fillets.length > 0;

    if (dimensionsChanged && selectedShape.geometry) {
      if (hasFillets) {
        console.log('🔵 Dimensions changed with fillets - will recreate shape with fillets (not scale)');
      } else {
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
      rotation: newRotation,
      scale: selectedShape.scale
    };

    if (hasSubtractionChanges) {
      console.log('🔄 Recalculating subtraction with updated dimensions...');
      console.log('📍 Current shape position (will be preserved):', selectedShape.position);

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

      const newGeometry = convertReplicadToThreeGeometry(resultShape);
      const newBaseVertices = await getReplicadVertices(resultShape);

      console.log('📍 Subtraction change - preserving current shape position (not modifying position)');
      console.log('📍 Current shape position will be kept:', selectedShape.position);

      let updatedFillets = selectedShape.fillets || [];

      const preservedPosition = selectedShape.position as [number, number, number];
      console.log('📍 Preserving position:', preservedPosition);

      if (updatedFillets.length > 0) {
        console.log('🔄 Updating fillet centers after subtraction change...');

        updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, newGeometry, { width, height, depth });

        console.log('🔵 Reapplying fillets with updated centers...');
        resultShape = await applyFillets(resultShape, updatedFillets, { width, height, depth });
        const finalGeometry = convertReplicadToThreeGeometry(resultShape);
        const finalBaseVertices = await getReplicadVertices(resultShape);

        console.log('🎯 SUBTRACTION CHANGE + FILLET - Explicitly preserving position:', preservedPosition);

        updateShape(selectedShape.id, {
          geometry: finalGeometry,
          replicadShape: resultShape,
          subtractionGeometries: allSubtractions,
          fillets: updatedFillets,
          position: preservedPosition,
          rotation: baseUpdate.rotation,
          scale: baseUpdate.scale,
          vertexModifications: baseUpdate.vertexModifications,
          parameters: {
            ...baseUpdate.parameters,
            scaledBaseVertices: finalBaseVertices.map(v => [v.x, v.y, v.z])
          }
        });
      } else {
        console.log('🎯 SUBTRACTION CHANGE - Explicitly preserving position:', preservedPosition);

        updateShape(selectedShape.id, {
          geometry: newGeometry,
          replicadShape: resultShape,
          subtractionGeometries: allSubtractions,
          fillets: [],
          position: preservedPosition,
          rotation: baseUpdate.rotation,
          scale: baseUpdate.scale,
          vertexModifications: baseUpdate.vertexModifications,
          parameters: {
            ...baseUpdate.parameters,
            scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
          }
        });

        console.log('✅ Shape geometry updated, position explicitly preserved');
      }
    } else {
      if (dimensionsChanged) {
        console.log('🔄 Dimensions changed, recreating replicad shape with new dimensions...');

        let newReplicadShape = await createReplicadBox({
          width,
          height,
          depth
        });

        if (selectedShape.subtractionGeometries && selectedShape.subtractionGeometries.length > 0) {
          console.log('🔄 Reapplying all subtractions after dimension change...');

          for (let i = 0; i < selectedShape.subtractionGeometries.length; i++) {
            const subtraction = selectedShape.subtractionGeometries[i];
            if (!subtraction) continue;

            const subSize = getOriginalSize(subtraction.geometry);

            const subBox = await createReplicadBox({
              width: subSize.x,
              height: subSize.y,
              depth: subSize.z
            });

            newReplicadShape = await performBooleanCut(
              newReplicadShape,
              subBox,
              undefined,
              subtraction.relativeOffset,
              undefined,
              subtraction.relativeRotation || [0, 0, 0],
              undefined,
              subtraction.scale || [1, 1, 1] as [number, number, number]
            );
          }
        }

        let finalGeometry = convertReplicadToThreeGeometry(newReplicadShape);
        let finalBaseVertices = await getReplicadVertices(newReplicadShape);
        let updatedFillets = selectedShape.fillets || [];

        if (filletRadii && filletRadii.length > 0) {
          console.log('🔄 Updating fillet radii from parameters...');
          updatedFillets = updatedFillets.map((fillet: FilletInfo, idx: number) => ({
            ...fillet,
            radius: filletRadii[idx] !== undefined ? filletRadii[idx] : fillet.radius
          }));
        }

        const preservedPositionForDimChange = selectedShape.position as [number, number, number];

        if (updatedFillets.length > 0) {
          console.log('🔄 Updating fillet centers after dimension change...');

          updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, finalGeometry, { width, height, depth });

          console.log('🔵 Reapplying fillets with updated centers and radii...');
          newReplicadShape = await applyFillets(newReplicadShape, updatedFillets, { width, height, depth });
          finalGeometry = convertReplicadToThreeGeometry(newReplicadShape);
          finalBaseVertices = await getReplicadVertices(newReplicadShape);

          console.log('🎯 DIMENSION CHANGE + FILLET - Explicitly preserving position:', preservedPositionForDimChange);
        }

        updateShape(selectedShape.id, {
          geometry: finalGeometry,
          replicadShape: newReplicadShape,
          fillets: updatedFillets,
          position: preservedPositionForDimChange,
          rotation: baseUpdate.rotation,
          scale: baseUpdate.scale,
          vertexModifications: baseUpdate.vertexModifications,
          parameters: {
            ...baseUpdate.parameters,
            scaledBaseVertices: finalBaseVertices.map(v => [v.x, v.y, v.z])
          }
        });

        console.log('✓ Replicad shape recreated with dimensions, position preserved:', { width, height, depth, position: preservedPositionForDimChange });
      } else {
        const filletsChanged = filletRadii && filletRadii.length > 0 &&
          filletRadii.some((r, idx) => (selectedShape.fillets?.[idx]?.radius || 0) !== r);

        if (filletsChanged && selectedShape.replicadShape) {
          console.log('🔄 Fillet radii changed without dimension change, reapplying fillets...');

          let updatedFillets = selectedShape.fillets || [];
          updatedFillets = updatedFillets.map((fillet: FilletInfo, idx: number) => ({
            ...fillet,
            radius: filletRadii[idx] !== undefined ? filletRadii[idx] : fillet.radius
          }));

          let newReplicadShape = selectedShape.replicadShape;

          if (selectedShape.subtractionGeometries && selectedShape.subtractionGeometries.length > 0) {
            newReplicadShape = await createReplicadBox({ width, height, depth });

            for (let i = 0; i < selectedShape.subtractionGeometries.length; i++) {
              const subtraction = selectedShape.subtractionGeometries[i];
              if (!subtraction) continue;

              const subSize = getOriginalSize(subtraction.geometry);
              const subBox = await createReplicadBox({
                width: subSize.x,
                height: subSize.y,
                depth: subSize.z
              });

              newReplicadShape = await performBooleanCut(
                newReplicadShape,
                subBox,
                undefined,
                subtraction.relativeOffset,
                undefined,
                subtraction.relativeRotation || [0, 0, 0],
                undefined,
                subtraction.scale || [1, 1, 1] as [number, number, number]
              );
            }
          } else {
            newReplicadShape = await createReplicadBox({ width, height, depth });
          }

          let finalGeometry = convertReplicadToThreeGeometry(newReplicadShape);
          let finalBaseVertices = await getReplicadVertices(newReplicadShape);

          updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, finalGeometry, { width, height, depth });

          console.log('🔵 Reapplying fillets with new radii...');
          newReplicadShape = await applyFillets(newReplicadShape, updatedFillets, { width, height, depth });
          finalGeometry = convertReplicadToThreeGeometry(newReplicadShape);
          finalBaseVertices = await getReplicadVertices(newReplicadShape);

          const preservedPositionForFillet = selectedShape.position as [number, number, number];
          console.log('🎯 FILLET RADIUS CHANGE - Explicitly preserving position:', preservedPositionForFillet);

          updateShape(selectedShape.id, {
            geometry: finalGeometry,
            replicadShape: newReplicadShape,
            fillets: updatedFillets,
            position: preservedPositionForFillet,
            rotation: baseUpdate.rotation,
            scale: baseUpdate.scale,
            vertexModifications: baseUpdate.vertexModifications,
            parameters: {
              ...baseUpdate.parameters,
              scaledBaseVertices: finalBaseVertices.map(v => [v.x, v.y, v.z])
            }
          });

          console.log('✅ Fillets reapplied with new radii, position preserved');
        } else {
          updateShape(selectedShape.id, {
            rotation: baseUpdate.rotation,
            scale: baseUpdate.scale,
            vertexModifications: baseUpdate.vertexModifications,
            parameters: baseUpdate.parameters
          });
        }
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

  const { getReplicadVertices } = await import('./VertexEditorService');
  const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('./ReplicadService');

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

  const newGeometry = convertReplicadToThreeGeometry(resultShape);
  const newBaseVertices = await getReplicadVertices(resultShape);

  const preservedPosition = currentShape.position as [number, number, number];
  console.log('📍 Preserving position in applySubtractionChanges:', preservedPosition);

  let updatedFillets = currentShape.fillets || [];
  if (updatedFillets.length > 0) {
    console.log('🔄 Updating fillet centers after subtraction change...');

    const shapeSize = {
      width: currentShape.parameters.width || 1,
      height: currentShape.parameters.height || 1,
      depth: currentShape.parameters.depth || 1
    };
    updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, newGeometry, shapeSize);

    console.log('🔵 Reapplying fillets with updated centers...');
    resultShape = await applyFillets(resultShape, updatedFillets, shapeSize);
    const finalGeometry = convertReplicadToThreeGeometry(resultShape);
    const finalBaseVertices = await getReplicadVertices(resultShape);

    console.log('🎯 SUBTRACTION CHANGE - Explicitly preserving position:', preservedPosition+100);
    console.log('✅ Subtraction complete with fillets');

    updateShape(currentShape.id, {
      geometry: finalGeometry,
      replicadShape: resultShape,
      subtractionGeometries: allSubtractions,
      fillets: updatedFillets,
      position: preservedPosition+100,
      parameters: {
        ...currentShape.parameters,
        scaledBaseVertices: finalBaseVertices.map(v => [v.x, v.y, v.z])
      }
    });
  } else {
    console.log('🎯 SUBTRACTION CHANGE - Explicitly preserving position:', preservedPosition);
    console.log('✅ Subtraction complete');

    updateShape(currentShape.id, {
      geometry: newGeometry,
      replicadShape: resultShape,
      subtractionGeometries: allSubtractions,
      fillets: [],
      position: preservedPosition,
      parameters: {
        ...currentShape.parameters,
        scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
      }
    });
  }
}
