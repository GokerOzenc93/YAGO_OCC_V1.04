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
  const box1 = new THREE.Box3();
  const box2 = new THREE.Box3();

  const geo1 = shape1.geometry.clone();
  geo1.translate(shape1.position[0], shape1.position[1], shape1.position[2]);
  box1.setFromBufferAttribute(geo1.getAttribute('position') as THREE.BufferAttribute);

  const geo2 = shape2.geometry.clone();
  geo2.translate(shape2.position[0], shape2.position[1], shape2.position[2]);
  box2.setFromBufferAttribute(geo2.getAttribute('position') as THREE.BufferAttribute);

  const intersection = box1.clone().intersect(box2);

  if (intersection.isEmpty()) {
    return { x: 0, y: 0, z: 0 };
  }

  const size = new THREE.Vector3();
  intersection.getSize(size);

  return {
    x: Math.round(size.x * 100) / 100,
    y: Math.round(size.y * 100) / 100,
    z: Math.round(size.z * 100) / 100
  };
}
