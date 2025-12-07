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
    let baseInWorld = baseShape;
    let cuttingInWorld = cuttingShape;

    const [bsx, bsy, bsz] = baseScale || [1, 1, 1];
    const [brx, bry, brz] = baseRotation || [0, 0, 0];
    const [bpx, bpy, bpz] = basePosition || [0, 0, 0];

    const [csx, csy, csz] = cuttingScale || [1, 1, 1];
    const [crx, cry, crz] = cuttingRotation || [0, 0, 0];
    const [cpx, cpy, cpz] = cuttingPosition || [0, 0, 0];

    if (bsx !== 1 || bsy !== 1 || bsz !== 1) baseInWorld = baseInWorld.scale(bsx, bsy, bsz);
    if (brx !== 0) baseInWorld = baseInWorld.rotate(brx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
    if (bry !== 0) baseInWorld = baseInWorld.rotate(bry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
    if (brz !== 0) baseInWorld = baseInWorld.rotate(brz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    if (bpx !== 0 || bpy !== 0 || bpz !== 0) baseInWorld = baseInWorld.translate(bpx, bpy, bpz);

    if (csx !== 1 || csy !== 1 || csz !== 1) cuttingInWorld = cuttingInWorld.scale(csx, csy, csz);
    if (crx !== 0) cuttingInWorld = cuttingInWorld.rotate(crx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
    if (cry !== 0) cuttingInWorld = cuttingInWorld.rotate(cry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
    if (crz !== 0) cuttingInWorld = cuttingInWorld.rotate(crz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    if (cpx !== 0 || cpy !== 0 || cpz !== 0) cuttingInWorld = cuttingInWorld.translate(cpx, cpy, cpz);

    let result = baseInWorld.cut(cuttingInWorld);

    if (bpx !== 0 || bpy !== 0 || bpz !== 0) result = result.translate(-bpx, -bpy, -bpz);
    if (brz !== 0) result = result.rotate(-brz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    if (bry !== 0) result = result.rotate(-bry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
    if (brx !== 0) result = result.rotate(-brx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
    if (bsx !== 1 || bsy !== 1 || bsz !== 1) result = result.scale(1/bsx, 1/bsy, 1/bsz);

    return result;
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
