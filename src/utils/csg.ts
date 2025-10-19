import * as THREE from 'three';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';

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
  thresholdAngle: number = 10
): THREE.BufferGeometry {
  console.log('🔍 Extracting sharp edges from geometry:', {
    vertices: geometry.attributes.position?.count,
    hasIndex: !!geometry.index,
    hasNormals: !!geometry.attributes.normal
  });

  const position = geometry.attributes.position;
  const index = geometry.index;

  if (!index) {
    console.warn('⚠️ No index found, creating EdgesGeometry fallback');
    const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
    return edges;
  }

  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }

  const thresholdDot = Math.cos(THREE.MathUtils.degToRad(thresholdAngle));
  const edges = new Map<string, {
    normal1: THREE.Vector3 | null;
    normal2: THREE.Vector3 | null;
    v1: THREE.Vector3;
    v2: THREE.Vector3;
  }>();

  const normal = geometry.attributes.normal;
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    v0.fromBufferAttribute(position, a);
    v1.fromBufferAttribute(position, b);
    v2.fromBufferAttribute(position, c);

    edge1.subVectors(v1, v0);
    edge2.subVectors(v2, v0);
    faceNormal.crossVectors(edge1, edge2).normalize();

    const processEdge = (i1: number, i2: number, vA: THREE.Vector3, vB: THREE.Vector3) => {
      const key = [i1, i2].sort((x, y) => x - y).join('_');

      if (!edges.has(key)) {
        edges.set(key, {
          normal1: null,
          normal2: null,
          v1: vA.clone(),
          v2: vB.clone()
        });
      }

      const edge = edges.get(key)!;
      if (edge.normal1 === null) {
        edge.normal1 = faceNormal.clone();
      } else if (edge.normal2 === null) {
        edge.normal2 = faceNormal.clone();
      }
    };

    processEdge(a, b, v0, v1);
    processEdge(b, c, v1, v2);
    processEdge(c, a, v2, v0);
  }

  const sharpEdgeVertices: number[] = [];

  edges.forEach((edge) => {
    let isSharp = false;

    if (edge.normal1 && edge.normal2) {
      const dot = edge.normal1.dot(edge.normal2);
      if (dot < thresholdDot) {
        isSharp = true;
      }
    } else {
      isSharp = true;
    }

    if (isSharp) {
      sharpEdgeVertices.push(edge.v1.x, edge.v1.y, edge.v1.z);
      sharpEdgeVertices.push(edge.v2.x, edge.v2.y, edge.v2.z);
    }
  });

  console.log(`✅ Found ${sharpEdgeVertices.length / 6} sharp edges`);

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(sharpEdgeVertices, 3)
  );

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
