import * as THREE from 'three';
import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

export function performCSGSubtraction(
  targetGeometry: THREE.BufferGeometry,
  subtractGeometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  const targetBrush = new Brush(targetGeometry);
  const subtractBrush = new Brush(subtractGeometry);

  const result = evaluator.evaluate(targetBrush, subtractBrush, SUBTRACTION);

  const resultGeometry = result.geometry;
  resultGeometry.computeVertexNormals();

  return resultGeometry;
}

export function extractSharpEdges(
  geometry: THREE.BufferGeometry,
  thresholdAngle: number = 30
): THREE.BufferGeometry {
  const edgeGeometry = new THREE.EdgesGeometry(geometry, thresholdAngle);
  return edgeGeometry;
}

export function performCSGUnion(
  geometry1: THREE.BufferGeometry,
  geometry2: THREE.BufferGeometry
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  const brush1 = new Brush(geometry1);
  const brush2 = new Brush(geometry2);

  const result = evaluator.evaluate(brush1, brush2, ADDITION);

  const resultGeometry = result.geometry;
  resultGeometry.computeVertexNormals();

  return resultGeometry;
}

export function performCSGIntersection(
  geometry1: THREE.BufferGeometry,
  geometry2: THREE.BufferGeometry
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  const brush1 = new Brush(geometry1);
  const brush2 = new Brush(geometry2);

  const result = evaluator.evaluate(brush1, brush2, INTERSECTION);

  const resultGeometry = result.geometry;
  resultGeometry.computeVertexNormals();

  return resultGeometry;
}

export function extrudeGeometry(
  geometry: THREE.BufferGeometry,
  extrudeDistance: number = 100
): THREE.BufferGeometry {
  const clonedGeometry = geometry.clone();
  clonedGeometry.translate(0, 0, extrudeDistance);

  const evaluator = new Evaluator();
  const originalBrush = new Brush(geometry);
  const extrudedBrush = new Brush(clonedGeometry);

  const result = evaluator.evaluate(originalBrush, extrudedBrush, ADDITION);

  const resultGeometry = result.geometry;
  resultGeometry.computeVertexNormals();

  return resultGeometry;
}

export function calculatePenetrationDepths(
  shape1: { geometry: THREE.BufferGeometry; position: [number, number, number] },
  shape2: { geometry: THREE.BufferGeometry; position: [number, number, number] }
): { x: number; y: number; z: number } {
  return { x: 0, y: 0, z: 0 };
}

export function calculateIntersectionVolume(
  geometry1: THREE.BufferGeometry,
  geometry2: THREE.BufferGeometry
): number {
  try {
    const evaluator = new Evaluator();
    const brush1 = new Brush(geometry1);
    const brush2 = new Brush(geometry2);

    const intersection = evaluator.evaluate(brush1, brush2, INTERSECTION);

    if (!intersection || !intersection.geometry) {
      return 0;
    }

    const intersectionGeometry = intersection.geometry;

    intersectionGeometry.computeBoundingBox();
    const box = intersectionGeometry.boundingBox;

    if (!box) return 0;

    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    const depth = box.max.z - box.min.z;

    return width * height * depth;
  } catch (error) {
    console.error('Failed to calculate intersection volume:', error);
    return 0;
  }
}
