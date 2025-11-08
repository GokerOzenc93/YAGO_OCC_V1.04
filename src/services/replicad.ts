import { getOC, makeCylinder, makeBox, makeSphere } from 'replicad';
import * as THREE from 'three';

let ocInstance: any = null;
let isInitializing = false;

export const initReplicad = async () => {
  if (ocInstance) return ocInstance;
  if (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return initReplicad();
  }

  isInitializing = true;
  try {
    ocInstance = await getOC();
    console.log('✅ Replicad (OpenCascade) initialized');
    return ocInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Replicad:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

export interface ReplicadBoxParams {
  width: number;
  height: number;
  depth: number;
}

export interface ReplicadCylinderParams {
  radius: number;
  height: number;
}

export interface ReplicadSphereParams {
  radius: number;
}

export const createReplicadBox = async (params: ReplicadBoxParams): Promise<any> => {
  await initReplicad();
  const { width, height, depth } = params;

  const box = makeBox(width, depth, height);
  console.log('✅ Replicad box created:', { width, height, depth });
  return box;
};

export const createReplicadCylinder = async (params: ReplicadCylinderParams): Promise<any> => {
  await initReplicad();
  const { radius, height } = params;

  const cylinder = makeCylinder(radius, height);
  console.log('✅ Replicad cylinder created:', { radius, height });
  return cylinder;
};

export const createReplicadSphere = async (params: ReplicadSphereParams): Promise<any> => {
  await initReplicad();
  const { radius } = params;

  const sphere = makeSphere(radius);
  console.log('✅ Replicad sphere created:', { radius });
  return sphere;
};

export const convertReplicadToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  try {
    const mesh = shape.mesh({ tolerance: 0.1, angularTolerance: 30 });

    const vertices: number[] = [];
    const indices: number[] = [];

    if (mesh.vertices && mesh.triangles) {
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        vertices.push(mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]);
      }

      for (let i = 0; i < mesh.triangles.length; i++) {
        indices.push(mesh.triangles[i]);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    console.log('✅ Converted Replicad shape to Three.js geometry:', {
      vertices: vertices.length / 3,
      triangles: indices.length / 3
    });

    return geometry;
  } catch (error) {
    console.error('❌ Failed to convert Replicad shape to Three.js geometry:', error);
    throw error;
  }
};

export const createBoxGeometry = async (
  width: number,
  height: number,
  depth: number
): Promise<THREE.BufferGeometry> => {
  const shape = await createReplicadBox({ width, height, depth });
  return convertReplicadToThreeGeometry(shape);
};

export const createCylinderGeometry = async (
  radius: number,
  height: number
): Promise<THREE.BufferGeometry> => {
  const shape = await createReplicadCylinder({ radius, height });
  return convertReplicadToThreeGeometry(shape);
};

export const createSphereGeometry = async (
  radius: number
): Promise<THREE.BufferGeometry> => {
  const shape = await createReplicadSphere({ radius });
  return convertReplicadToThreeGeometry(shape);
};
