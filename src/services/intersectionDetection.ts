import * as THREE from 'three';
import { initReplicad } from './replicad';

export interface IntersectionData {
  volume: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    width: number;
    height: number;
    depth: number;
  };
  centerOfMass: [number, number, number];
  surfaceArea: number;
}

export interface IntersectionParameters {
  id: string;
  name: string;
  shape1Id: string;
  shape2Id: string;
  intersectionData: IntersectionData;
  replicadShape: any;
  geometry: THREE.BufferGeometry;
  timestamp: number;
}

export const detectIntersection = async (
  shape1: any,
  shape2: any,
  shape1Position?: [number, number, number],
  shape2Position?: [number, number, number]
): Promise<{ hasIntersection: boolean; intersectionVolume?: number }> => {
  await initReplicad();

  try {
    console.log('🔍 Detecting intersection between shapes...');

    let transformedShape1 = shape1;
    let transformedShape2 = shape2;

    if (shape1Position && (shape1Position[0] !== 0 || shape1Position[1] !== 0 || shape1Position[2] !== 0)) {
      transformedShape1 = transformedShape1.translate(shape1Position[0], shape1Position[1], shape1Position[2]);
    }

    if (shape2Position && (shape2Position[0] !== 0 || shape2Position[1] !== 0 || shape2Position[2] !== 0)) {
      transformedShape2 = transformedShape2.translate(shape2Position[0], shape2Position[1], shape2Position[2]);
    }

    const intersectionShape = transformedShape1.intersect(transformedShape2);

    const mesh = intersectionShape.mesh({ tolerance: 0.1, angularTolerance: 30 });

    const hasIntersection = mesh.vertices && mesh.vertices.length > 0;

    let volume = 0;
    if (hasIntersection && intersectionShape.volume) {
      volume = intersectionShape.volume();
    }

    console.log('✅ Intersection detection complete:', { hasIntersection, volume });

    return {
      hasIntersection,
      intersectionVolume: hasIntersection ? volume : undefined
    };
  } catch (error) {
    console.error('❌ Intersection detection failed:', error);
    return { hasIntersection: false };
  }
};

export const computeIntersection = async (
  shape1: any,
  shape2: any,
  shape1Position?: [number, number, number],
  shape2Position?: [number, number, number],
  shape1Rotation?: [number, number, number],
  shape2Rotation?: [number, number, number]
): Promise<IntersectionParameters | null> => {
  await initReplicad();

  try {
    console.log('🔀 Computing intersection geometry...');

    let transformedShape1 = shape1;
    let transformedShape2 = shape2;

    if (shape1Rotation && (shape1Rotation[0] !== 0 || shape1Rotation[1] !== 0 || shape1Rotation[2] !== 0)) {
      if (shape1Rotation[0] !== 0) transformedShape1 = transformedShape1.rotate(shape1Rotation[0] * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (shape1Rotation[1] !== 0) transformedShape1 = transformedShape1.rotate(shape1Rotation[1] * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (shape1Rotation[2] !== 0) transformedShape1 = transformedShape1.rotate(shape1Rotation[2] * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    }

    if (shape1Position && (shape1Position[0] !== 0 || shape1Position[1] !== 0 || shape1Position[2] !== 0)) {
      transformedShape1 = transformedShape1.translate(shape1Position[0], shape1Position[1], shape1Position[2]);
    }

    if (shape2Rotation && (shape2Rotation[0] !== 0 || shape2Rotation[1] !== 0 || shape2Rotation[2] !== 0)) {
      if (shape2Rotation[0] !== 0) transformedShape2 = transformedShape2.rotate(shape2Rotation[0] * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (shape2Rotation[1] !== 0) transformedShape2 = transformedShape2.rotate(shape2Rotation[1] * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (shape2Rotation[2] !== 0) transformedShape2 = transformedShape2.rotate(shape2Rotation[2] * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    }

    if (shape2Position && (shape2Position[0] !== 0 || shape2Position[1] !== 0 || shape2Position[2] !== 0)) {
      transformedShape2 = transformedShape2.translate(shape2Position[0], shape2Position[1], shape2Position[2]);
    }

    const intersectionShape = transformedShape1.intersect(transformedShape2);

    const mesh = intersectionShape.mesh({ tolerance: 0.1, angularTolerance: 30 });

    if (!mesh.vertices || mesh.vertices.length === 0) {
      console.log('⚠️ No intersection found');
      return null;
    }

    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < mesh.vertices.length; i++) {
      vertices.push(mesh.vertices[i]);
    }

    for (let i = 0; i < mesh.triangles.length; i++) {
      indices.push(mesh.triangles[i]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const boundingBox = geometry.boundingBox!;
    const width = boundingBox.max.x - boundingBox.min.x;
    const height = boundingBox.max.y - boundingBox.min.y;
    const depth = boundingBox.max.z - boundingBox.min.z;

    const geometryCenter = new THREE.Vector3(
      (boundingBox.min.x + boundingBox.max.x) / 2,
      (boundingBox.min.y + boundingBox.max.y) / 2,
      (boundingBox.min.z + boundingBox.max.z) / 2
    );

    const positionAttribute = geometry.getAttribute('position');
    for (let i = 0; i < positionAttribute.count; i++) {
      positionAttribute.setXYZ(
        i,
        positionAttribute.getX(i) - geometryCenter.x,
        positionAttribute.getY(i) - geometryCenter.y,
        positionAttribute.getZ(i) - geometryCenter.z
      );
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    let volume = 0;
    let surfaceArea = 0;
    let centerOfMass: [number, number, number] = [0, 0, 0];

    try {
      if (intersectionShape.volume) volume = intersectionShape.volume();
      if (intersectionShape.area) surfaceArea = intersectionShape.area();
      if (intersectionShape.centerOfMass) {
        const com = intersectionShape.centerOfMass();
        centerOfMass = [com[0] || 0, com[1] || 0, com[2] || 0];
      } else {
        centerOfMass = [geometryCenter.x, geometryCenter.y, geometryCenter.z];
      }
    } catch (error) {
      console.warn('⚠️ Could not compute all properties:', error);
      centerOfMass = [geometryCenter.x, geometryCenter.y, geometryCenter.z];
    }

    const newBoundingBox = geometry.boundingBox!;

    const intersectionData: IntersectionData = {
      volume,
      boundingBox: {
        min: [newBoundingBox.min.x, newBoundingBox.min.y, newBoundingBox.min.z],
        max: [newBoundingBox.max.x, newBoundingBox.max.y, newBoundingBox.max.z],
        width,
        height,
        depth
      },
      centerOfMass,
      surfaceArea
    };

    console.log('✅ Intersection computed:', {
      volume,
      width,
      height,
      depth,
      vertexCount: vertices.length / 3
    });

    return {
      id: `intersection-${Date.now()}`,
      name: 'Intersection',
      shape1Id: 'shape1',
      shape2Id: 'shape2',
      intersectionData,
      replicadShape: intersectionShape,
      geometry,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('❌ Failed to compute intersection:', error);
    return null;
  }
};

export const createIntersectionShape = (intersectionParams: IntersectionParameters) => {
  return {
    id: intersectionParams.id,
    type: 'intersection',
    position: intersectionParams.intersectionData.centerOfMass,
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    geometry: intersectionParams.geometry,
    color: '#10b981',
    parameters: {
      width: intersectionParams.intersectionData.boundingBox.width,
      height: intersectionParams.intersectionData.boundingBox.height,
      depth: intersectionParams.intersectionData.boundingBox.depth,
      volume: intersectionParams.intersectionData.volume,
      surfaceArea: intersectionParams.intersectionData.surfaceArea,
      intersectionData: intersectionParams.intersectionData,
      customParameters: []
    },
    replicadShape: intersectionParams.replicadShape
  };
};
