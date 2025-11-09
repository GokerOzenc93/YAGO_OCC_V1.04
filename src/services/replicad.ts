import { setOC } from 'replicad';
import initOpenCascade from 'opencascade.js';
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
    console.log('🔄 Initializing OpenCascade...');
    const oc = await initOpenCascade();
    console.log('✅ OpenCascade loaded');

    console.log('🔄 Setting OpenCascade for Replicad...');
    setOC(oc);
    ocInstance = oc;
    console.log('✅ Replicad initialized with OpenCascade');
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

export const performBooleanCut = async (
  baseShape: any,
  cuttingShape: any,
  basePosition?: [number, number, number],
  cuttingPosition?: [number, number, number]
): Promise<any> => {
  await initReplicad();

  console.log('🔪 Performing boolean cut operation...');
  console.log('Base shape:', baseShape, 'Position:', basePosition);
  console.log('Cutting shape:', cuttingShape, 'Position:', cuttingPosition);

  try {
    let translatedBase = baseShape;
    let translatedCutting = cuttingShape;

    if (basePosition && (basePosition[0] !== 0 || basePosition[1] !== 0 || basePosition[2] !== 0)) {
      console.log('📍 Translating base shape by:', basePosition);
      translatedBase = baseShape.translate(basePosition[0], basePosition[1], basePosition[2]);
    }

    if (cuttingPosition && (cuttingPosition[0] !== 0 || cuttingPosition[1] !== 0 || cuttingPosition[2] !== 0)) {
      console.log('📍 Translating cutting shape by:', cuttingPosition);
      translatedCutting = cuttingShape.translate(cuttingPosition[0], cuttingPosition[1], cuttingPosition[2]);
    }

    const result = translatedBase.cut(translatedCutting);
    console.log('✅ Boolean cut completed:', result);

    if (basePosition && (basePosition[0] !== 0 || basePosition[1] !== 0 || basePosition[2] !== 0)) {
      console.log('📍 Translating result back by:', [-basePosition[0], -basePosition[1], -basePosition[2]]);
      return result.translate(-basePosition[0], -basePosition[1], -basePosition[2]);
    }

    return result;
  } catch (error) {
    console.error('❌ Boolean cut failed:', error);
    throw error;
  }
};

export const performBooleanUnion = async (
  shape1: any,
  shape2: any
): Promise<any> => {
  await initReplicad();

  console.log('🔗 Performing boolean union operation...');

  try {
    const result = shape1.fuse(shape2);
    console.log('✅ Boolean union completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Boolean union failed:', error);
    throw error;
  }
};

export const performBooleanIntersection = async (
  shape1: any,
  shape2: any
): Promise<any> => {
  await initReplicad();

  console.log('🔀 Performing boolean intersection operation...');

  try {
    const result = shape1.intersect(shape2);
    console.log('✅ Boolean intersection completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Boolean intersection failed:', error);
    throw error;
  }
};
