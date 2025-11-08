import { getOC } from 'replicad';
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
    console.log('🔄 Initializing Replicad...');
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
  const oc = await initReplicad();
  const { width, height, depth } = params;

  console.log('🔨 Creating box with replicad API...');

  const { draw } = await import('replicad');
  const boxSketch = draw()
    .movePointerTo([0, 0])
    .lineTo([width, 0])
    .lineTo([width, depth])
    .lineTo([0, depth])
    .close()
    .sketchOnPlane()
    .extrude(height);

  console.log('✅ Replicad box created:', { width, height, depth });
  return boxSketch;
};

export const createReplicadCylinder = async (params: ReplicadCylinderParams): Promise<any> => {
  const oc = await initReplicad();
  const { radius, height } = params;

  console.log('🔨 Creating cylinder with replicad API...');

  const { drawCircle } = await import('replicad');
  const cylinder = drawCircle(radius)
    .sketchOnPlane()
    .extrude(height);

  console.log('✅ Replicad cylinder created:', { radius, height });
  return cylinder;
};

export const createReplicadSphere = async (params: ReplicadSphereParams): Promise<any> => {
  const oc = await initReplicad();
  const { radius } = params;

  console.log('🔨 Creating sphere with replicad API...');

  const { drawCircle } = await import('replicad');
  const sphere = drawCircle(radius)
    .sketchOnPlane()
    .revolve();

  console.log('✅ Replicad sphere created:', { radius });
  return sphere;
};

export const convertReplicadToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  try {
    console.log('🔄 Converting Replicad shape to Three.js geometry...');
    console.log('Shape object:', shape);

    const mesh = shape.mesh({ tolerance: 0.1, angularTolerance: 30 });
    console.log('Mesh data:', mesh);

    const vertices: number[] = [];
    const indices: number[] = [];

    if (mesh.vertices && mesh.triangles) {
      console.log('Raw mesh data:', {
        verticesLength: mesh.vertices.length,
        trianglesLength: mesh.triangles.length
      });

      for (let i = 0; i < mesh.vertices.length; i++) {
        vertices.push(mesh.vertices[i]);
      }

      for (let i = 0; i < mesh.triangles.length; i++) {
        indices.push(mesh.triangles[i]);
      }
    } else {
      console.error('❌ Mesh vertices or triangles missing');
      throw new Error('Invalid mesh data');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    console.log('✅ Converted Replicad shape to Three.js geometry:', {
      vertices: vertices.length / 3,
      triangles: indices.length / 3,
      boundingBox: geometry.boundingBox
    });

    return geometry;
  } catch (error) {
    console.error('❌ Failed to convert Replicad shape to Three.js geometry:', error);
    console.error('Error details:', error);
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
