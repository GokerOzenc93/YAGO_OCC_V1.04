import * as THREE from 'three';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

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

  const optimized = optimizeCSGGeometry(resultGeometry);

  return optimized;
}

function optimizeCSGGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const positionAttribute = geometry.getAttribute('position');
  if (!positionAttribute) return geometry;

  const vertices: THREE.Vector3[] = [];
  const vertexMap = new Map<string, THREE.Vector3>();
  const tolerance = 0.001;

  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);

    const key = `${Math.round(x / tolerance)}_${Math.round(y / tolerance)}_${Math.round(z / tolerance)}`;

    if (!vertexMap.has(key)) {
      const vertex = new THREE.Vector3(x, y, z);
      vertexMap.set(key, vertex);
      vertices.push(vertex);
    }
  }

  console.log(`🔄 CSG optimization: ${positionAttribute.count} vertices → ${vertices.length} unique vertices`);

  if (vertices.length < 4) {
    console.warn('⚠️ Not enough vertices for convex hull, returning original geometry');
    return geometry;
  }

  try {
    const convexGeometry = new ConvexGeometry(vertices);
    convexGeometry.computeVertexNormals();

    console.log('✅ Created optimized convex hull geometry');
    return convexGeometry;
  } catch (error) {
    console.error('❌ Failed to create convex hull, returning original geometry:', error);
    return geometry;
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

  const result = evaluator.evaluate(brush1, brush2, SUBTRACTION);

  return result.geometry;
}

export function performCSGIntersection(
  geometry1: THREE.BufferGeometry,
  geometry2: THREE.BufferGeometry
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  const brush1 = new Brush(geometry1);
  const brush2 = new Brush(geometry2);

  const result = evaluator.evaluate(brush1, brush2, SUBTRACTION);

  return result.geometry;
}
