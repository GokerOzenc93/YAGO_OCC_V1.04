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

export function getIntersectionCenter(
  geometry1: THREE.BufferGeometry,
  geometry2: THREE.BufferGeometry
): THREE.Vector3 | null {
  try {
    const evaluator = new Evaluator();
    const brush1 = new Brush(geometry1);
    const brush2 = new Brush(geometry2);

    const intersection = evaluator.evaluate(brush1, brush2, INTERSECTION);
    const intersectionGeometry = intersection.geometry;

    if (!intersectionGeometry || intersectionGeometry.getAttribute('position').count === 0) {
      return null;
    }

    const bbox = new THREE.Box3().setFromBufferAttribute(
      intersectionGeometry.getAttribute('position')
    );

    const center = new THREE.Vector3();
    bbox.getCenter(center);

    return center;
  } catch (error) {
    console.error('Failed to calculate intersection center:', error);
    return null;
  }
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
