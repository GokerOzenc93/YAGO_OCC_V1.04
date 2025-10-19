import * as THREE from 'three';
import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function cleanGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const merged = BufferGeometryUtils.mergeVertices(geometry, 1e-6);
  merged.computeVertexNormals();
  merged.deleteAttribute('uv');

  const final = merged.clone();
  final.computeVertexNormals();

  return final;
}

export function performCSGSubtraction(
  targetGeometry: THREE.BufferGeometry,
  subtractGeometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  const targetBrush = new Brush(targetGeometry);
  const subtractBrush = new Brush(subtractGeometry);

  const result = evaluator.evaluate(targetBrush, subtractBrush, SUBTRACTION);

  const resultGeometry = result.geometry;
  const cleaned = cleanGeometry(resultGeometry);

  return cleaned;
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
  const cleaned = cleanGeometry(result.geometry);

  return cleaned;
}

export function performCSGIntersection(
  geometry1: THREE.BufferGeometry,
  geometry2: THREE.BufferGeometry
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  const brush1 = new Brush(geometry1);
  const brush2 = new Brush(geometry2);

  const result = evaluator.evaluate(brush1, brush2, INTERSECTION);
  const cleaned = cleanGeometry(result.geometry);

  return cleaned;
}
