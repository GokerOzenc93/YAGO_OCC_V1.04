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
  thresholdAngle: number = 30
): THREE.BufferGeometry {
  const thresholdDot = Math.cos(THREE.MathUtils.degToRad(thresholdAngle));

  const edges = new Map<string, { normal1: THREE.Vector3 | null; normal2: THREE.Vector3 | null }>();

  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const index = geometry.index;

  if (!index || !normal) {
    return new THREE.BufferGeometry();
  }

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    v0.fromBufferAttribute(position, a);
    v1.fromBufferAttribute(position, b);
    v2.fromBufferAttribute(position, c);

    n.fromBufferAttribute(normal, a)
      .add(new THREE.Vector3().fromBufferAttribute(normal, b))
      .add(new THREE.Vector3().fromBufferAttribute(normal, c))
      .normalize();

    const edgeKeys = [
      [a, b].sort((x, y) => x - y).join('_'),
      [b, c].sort((x, y) => x - y).join('_'),
      [c, a].sort((x, y) => x - y).join('_')
    ];

    edgeKeys.forEach(key => {
      if (!edges.has(key)) {
        edges.set(key, { normal1: null, normal2: null });
      }
      const edge = edges.get(key)!;
      if (edge.normal1 === null) {
        edge.normal1 = n.clone();
      } else if (edge.normal2 === null) {
        edge.normal2 = n.clone();
      }
    });
  }

  const sharpEdgeVertices: number[] = [];

  edges.forEach((edge, key) => {
    const [i1, i2] = key.split('_').map(Number);

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
      v0.fromBufferAttribute(position, i1);
      v1.fromBufferAttribute(position, i2);

      sharpEdgeVertices.push(v0.x, v0.y, v0.z);
      sharpEdgeVertices.push(v1.x, v1.y, v1.z);
    }
  });

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
