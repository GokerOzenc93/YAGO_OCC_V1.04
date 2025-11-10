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
  const box1 = new THREE.Box3().setFromBufferAttribute(
    shape1.geometry.getAttribute('position')
  );
  const box2 = new THREE.Box3().setFromBufferAttribute(
    shape2.geometry.getAttribute('position')
  );

  box1.translate(new THREE.Vector3(...shape1.position));
  box2.translate(new THREE.Vector3(...shape2.position));

  const intersection = box1.clone().intersect(box2);

  if (intersection.isEmpty()) {
    return { x: 0, y: 0, z: 0 };
  }

  const size = new THREE.Vector3();
  intersection.getSize(size);

  console.log('📏 Calculated intersection size:', {
    x: size.x,
    y: size.y,
    z: size.z,
    box1Min: box1.min,
    box1Max: box1.max,
    box2Min: box2.min,
    box2Max: box2.max,
    intersectionMin: intersection.min,
    intersectionMax: intersection.max
  });

  return {
    x: Math.abs(size.x),
    y: Math.abs(size.y),
    z: Math.abs(size.z)
  };
}
