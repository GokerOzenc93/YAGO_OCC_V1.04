import * as THREE from 'three';

export const getGeometrySize = (geometry: THREE.BufferGeometry): THREE.Vector3 => {
  const box = new THREE.Box3().setFromBufferAttribute(
    geometry.attributes.position as THREE.BufferAttribute
  );
  const size = new THREE.Vector3();
  box.getSize(size);
  return size;
};

export const performSubtractionOperations = async (
  baseWidth: number,
  baseHeight: number,
  baseDepth: number,
  subtractions: any[],
  basePosition: [number, number, number],
  baseRotation: [number, number, number],
  baseScale: [number, number, number]
) => {
  const { getReplicadVertices } = await import('./vertexEditor');
  const { createReplicadBox, performBooleanCut, convertReplicadToThreeGeometry } = await import('./replicad');

  let resultShape = await createReplicadBox({ width: baseWidth, height: baseHeight, depth: baseDepth });

  for (const subtraction of subtractions) {
    const subSize = getGeometrySize(subtraction.geometry);
    const subBox = await createReplicadBox({ width: subSize.x, height: subSize.y, depth: subSize.z });

    const baseCenterOffset: [number, number, number] = [
      basePosition[0] + baseWidth / 2,
      basePosition[1] + baseHeight / 2,
      basePosition[2] + baseDepth / 2
    ];

    const subCenterOffset: [number, number, number] = [
      basePosition[0] + subtraction.relativeOffset[0] + subSize.x / 2,
      basePosition[1] + subtraction.relativeOffset[1] + subSize.y / 2,
      basePosition[2] + subtraction.relativeOffset[2] + subSize.z / 2
    ];

    const absoluteRot: [number, number, number] = [
      baseRotation[0] + (subtraction.relativeRotation?.[0] || 0),
      baseRotation[1] + (subtraction.relativeRotation?.[1] || 0),
      baseRotation[2] + (subtraction.relativeRotation?.[2] || 0)
    ];

    resultShape = await performBooleanCut(
      resultShape,
      subBox,
      baseCenterOffset,
      subCenterOffset,
      baseRotation,
      absoluteRot,
      baseScale,
      subtraction.scale || [1, 1, 1]
    );
  }

  const newGeometry = convertReplicadToThreeGeometry(resultShape);
  const newBaseVertices = await getReplicadVertices(resultShape);

  return {
    geometry: newGeometry,
    replicadShape: resultShape,
    baseVertices: newBaseVertices
  };
};
