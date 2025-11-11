import * as THREE from 'three';

export interface FaceExtrudeState {
  step: 'select-face' | 'select-reference' | 'complete';
  selectedFace: {
    face: THREE.Face3 | null;
    normal: THREE.Vector3 | null;
    center: THREE.Vector3 | null;
  } | null;
  referenceFace: {
    face: THREE.Face3 | null;
    dimension: number;
  } | null;
}

export const detectFaceFromRaycast = (
  geometry: THREE.BufferGeometry,
  intersectionPoint: THREE.Vector3,
  tolerance: number = 0.1
): { normal: THREE.Vector3; center: THREE.Vector3; vertices: THREE.Vector3[] } | null => {
  const positionAttribute = geometry.getAttribute('position');
  const indexAttribute = geometry.getIndex();

  if (!positionAttribute || !indexAttribute) return null;

  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < positionAttribute.count; i++) {
    vertices.push(
      new THREE.Vector3(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      )
    );
  }

  for (let i = 0; i < indexAttribute.count; i += 3) {
    const a = indexAttribute.getX(i);
    const b = indexAttribute.getX(i + 1);
    const c = indexAttribute.getX(i + 2);

    const v1 = vertices[a];
    const v2 = vertices[b];
    const v3 = vertices[c];

    const triangle = new THREE.Triangle(v1, v2, v3);
    const closestPoint = new THREE.Vector3();
    triangle.closestPointToPoint(intersectionPoint, closestPoint);

    if (closestPoint.distanceTo(intersectionPoint) < tolerance) {
      const normal = new THREE.Vector3();
      triangle.getNormal(normal);

      const center = new THREE.Vector3()
        .add(v1)
        .add(v2)
        .add(v3)
        .divideScalar(3);

      return {
        normal,
        center,
        vertices: [v1.clone(), v2.clone(), v3.clone()]
      };
    }
  }

  return null;
};

export const calculateFaceDimension = (vertices: THREE.Vector3[]): number => {
  if (vertices.length < 2) return 0;

  let maxDistance = 0;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const distance = vertices[i].distanceTo(vertices[j]);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    }
  }

  return maxDistance;
};

export const extrudeFaceToAbsoluteValue = (
  geometry: THREE.BufferGeometry,
  faceCenter: THREE.Vector3,
  faceNormal: THREE.Vector3,
  targetValue: number,
  referenceDimension: number
): THREE.BufferGeometry | null => {
  const extrudeDistance = targetValue - referenceDimension;

  console.log('🎯 Face Extrude:', {
    referenceDimension: referenceDimension.toFixed(2),
    targetValue: targetValue.toFixed(2),
    extrudeDistance: extrudeDistance.toFixed(2)
  });

  const newGeometry = geometry.clone();
  const positionAttribute = newGeometry.getAttribute('position');
  const positions = positionAttribute.array as Float32Array;

  const normalizedNormal = faceNormal.clone().normalize();

  for (let i = 0; i < positions.length; i += 3) {
    const vertex = new THREE.Vector3(
      positions[i],
      positions[i + 1],
      positions[i + 2]
    );

    const directionToFace = vertex.clone().sub(faceCenter).normalize();
    const dotProduct = directionToFace.dot(normalizedNormal);

    if (dotProduct > 0.9) {
      vertex.add(normalizedNormal.clone().multiplyScalar(extrudeDistance));
      positions[i] = vertex.x;
      positions[i + 1] = vertex.y;
      positions[i + 2] = vertex.z;
    }
  }

  positionAttribute.needsUpdate = true;
  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  return newGeometry;
};
