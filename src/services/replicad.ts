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
    const oc = await initOpenCascade();
    setOC(oc);
    ocInstance = oc;
    return ocInstance;
  } catch (error) {
    console.error('Failed to initialize Replicad:', error);
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
  const { draw } = await import('replicad');

  return draw()
    .movePointerTo([0, 0])
    .lineTo([width, 0])
    .lineTo([width, height])
    .lineTo([0, height])
    .close()
    .sketchOnPlane()
    .extrude(depth);
};

export const createReplicadCylinder = async (params: ReplicadCylinderParams): Promise<any> => {
  await initReplicad();
  const { radius, height } = params;
  const { drawCircle } = await import('replicad');

  return drawCircle(radius)
    .sketchOnPlane()
    .extrude(height)
    .translate(radius, radius, 0);
};

export const createReplicadSphere = async (params: ReplicadSphereParams): Promise<any> => {
  await initReplicad();
  const { radius } = params;
  const { drawCircle } = await import('replicad');

  return drawCircle(radius)
    .sketchOnPlane()
    .revolve()
    .translate(radius, radius, radius);
};

export const convertReplicadToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  try {
    const mesh = shape.mesh({ tolerance: 0.1, angularTolerance: 30 });

    const vertices: number[] = [];
    const indices: number[] = [];

    if (mesh.vertices && mesh.triangles) {
      for (let i = 0; i < mesh.vertices.length; i++) {
        vertices.push(mesh.vertices[i]);
      }

      for (let i = 0; i < mesh.triangles.length; i++) {
        indices.push(mesh.triangles[i]);
      }
    } else {
      throw new Error('Invalid mesh data');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } catch (error) {
    console.error('Failed to convert Replicad shape:', error);
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

const applyTransform = (shape: any, position?: [number, number, number], rotation?: [number, number, number], scale?: [number, number, number], reverse = false): any => {
  let transformed = shape;
  const [sx, sy, sz] = scale || [1, 1, 1];
  const [rx, ry, rz] = rotation || [0, 0, 0];
  const [px, py, pz] = position || [0, 0, 0];

  if (!reverse) {
    if (sx !== 1 || sy !== 1 || sz !== 1) transformed = transformed.scale(sx, sy, sz);
    if (rx !== 0) transformed = transformed.rotate(rx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
    if (ry !== 0) transformed = transformed.rotate(ry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
    if (rz !== 0) transformed = transformed.rotate(rz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    if (px !== 0 || py !== 0 || pz !== 0) transformed = transformed.translate(px, py, pz);
  } else {
    if (px !== 0 || py !== 0 || pz !== 0) transformed = transformed.translate(-px, -py, -pz);
    if (rz !== 0) transformed = transformed.rotate(-rz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    if (ry !== 0) transformed = transformed.rotate(-ry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
    if (rx !== 0) transformed = transformed.rotate(-rx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
    if (sx !== 1 || sy !== 1 || sz !== 1) transformed = transformed.scale(1/sx, 1/sy, 1/sz);
  }

  return transformed;
};

export const performBooleanCut = async (
  baseShape: any,
  cuttingShape: any,
  basePosition?: [number, number, number],
  cuttingPosition?: [number, number, number],
  baseRotation?: [number, number, number],
  cuttingRotation?: [number, number, number],
  baseScale?: [number, number, number],
  cuttingScale?: [number, number, number]
): Promise<any> => {
  await initReplicad();

  try {
    const transformedBase = applyTransform(baseShape, basePosition, baseRotation, baseScale);
    const transformedCutting = applyTransform(cuttingShape, cuttingPosition, cuttingRotation, cuttingScale);
    const result = transformedBase.cut(transformedCutting);
    return applyTransform(result, basePosition, baseRotation, baseScale, true);
  } catch (error) {
    console.error('Boolean cut failed:', error);
    throw error;
  }
};

export const performBooleanUnion = async (
  shape1: any,
  shape2: any
): Promise<any> => {
  await initReplicad();
  try {
    return shape1.fuse(shape2);
  } catch (error) {
    console.error('Boolean union failed:', error);
    throw error;
  }
};

export const performBooleanIntersection = async (
  shape1: any,
  shape2: any
): Promise<any> => {
  await initReplicad();
  try {
    return shape1.intersect(shape2);
  } catch (error) {
    console.error('Boolean intersection failed:', error);
    throw error;
  }
};
