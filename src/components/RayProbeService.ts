import * as THREE from 'three';
import { RayProbeHit, RayProbeResult, RayDirection } from '../store';

const RAY_DIRECTIONS: { key: RayDirection; vector: THREE.Vector3 }[] = [
  { key: 'x+', vector: new THREE.Vector3(1, 0, 0) },
  { key: 'x-', vector: new THREE.Vector3(-1, 0, 0) },
  { key: 'y+', vector: new THREE.Vector3(0, 1, 0) },
  { key: 'y-', vector: new THREE.Vector3(0, -1, 0) },
  { key: 'z+', vector: new THREE.Vector3(0, 0, 1) },
  { key: 'z-', vector: new THREE.Vector3(0, 0, -1) },
];

const MAX_RAY_DISTANCE = 50000;

export function performRayProbe(
  origin: THREE.Vector3,
  scene: THREE.Scene,
  excludeShapeId?: string,
  faceNormal?: THREE.Vector3
): RayProbeResult {
  const raycaster = new THREE.Raycaster();
  raycaster.far = MAX_RAY_DISTANCE;

  const meshes = collectSceneMeshes(scene, excludeShapeId);
  const hits: RayProbeHit[] = [];

  let directionsToTest = RAY_DIRECTIONS;

  if (faceNormal) {
    const absX = Math.abs(faceNormal.x);
    const absY = Math.abs(faceNormal.y);
    const absZ = Math.abs(faceNormal.z);

    if (absX > absY && absX > absZ) {
      directionsToTest = RAY_DIRECTIONS.filter(d => d.key[0] !== 'x');
    } else if (absY > absX && absY > absZ) {
      directionsToTest = RAY_DIRECTIONS.filter(d => d.key[0] !== 'y');
    } else {
      directionsToTest = RAY_DIRECTIONS.filter(d => d.key[0] !== 'z');
    }
  }

  for (const { key, vector } of directionsToTest) {
    raycaster.set(origin, vector);
    const intersections = raycaster.intersectObjects(meshes, false);

    if (intersections.length > 0) {
      const closest = intersections[0];
      const shapeId = findShapeIdFromObject(closest.object);

      if (shapeId && closest.face) {
        hits.push({
          direction: key,
          point: [closest.point.x, closest.point.y, closest.point.z],
          distance: closest.distance,
          shapeId,
          faceIndex: closest.faceIndex ?? -1,
          normal: [closest.face.normal.x, closest.face.normal.y, closest.face.normal.z],
        });
      }
    }
  }

  return {
    origin: [origin.x, origin.y, origin.z],
    hits,
  };
}

function collectSceneMeshes(scene: THREE.Scene, excludeShapeId?: string): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!object.visible) return;
    if (object.geometry && object.geometry.getAttribute('position')) {
      const shapeGroup = findShapeGroup(object);
      if (shapeGroup) {
        const groupName = shapeGroup.name;
        if (excludeShapeId && groupName === `shape-${excludeShapeId}`) return;
      }
      meshes.push(object);
    }
  });

  return meshes;
}

function findShapeGroup(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name && current.name.startsWith('shape-')) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function findShapeIdFromObject(object: THREE.Object3D): string | null {
  const group = findShapeGroup(object);
  if (group && group.name.startsWith('shape-')) {
    return group.name.replace('shape-', '');
  }
  return null;
}

export function getDirectionLabel(dir: RayDirection): string {
  switch (dir) {
    case 'x+': return 'Sag (+X)';
    case 'x-': return 'Sol (-X)';
    case 'y+': return 'Ust (+Y)';
    case 'y-': return 'Alt (-Y)';
    case 'z+': return 'On (+Z)';
    case 'z-': return 'Arka (-Z)';
  }
}

export function getDirectionColor(dir: RayDirection): string {
  switch (dir) {
    case 'x+': return '#ef4444';
    case 'x-': return '#f87171';
    case 'y+': return '#22c55e';
    case 'y-': return '#4ade80';
    case 'z+': return '#3b82f6';
    case 'z-': return '#60a5fa';
  }
}
