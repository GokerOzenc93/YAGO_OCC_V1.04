import * as THREE from 'three';
import { SnapType } from '../store';

export interface SnapPoint {
  position: THREE.Vector3;
  type: SnapType;
  normal?: THREE.Vector3;
}

export interface SnapResult {
  point: SnapPoint;
  distance: number;
}

const SNAP_THRESHOLD = 50;

export function findSnapPoints(
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  enabledSnaps: Record<SnapType, boolean>
): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];
  const positions = geometry.attributes.position;

  if (!positions) return snapPoints;

  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
    vertex.applyMatrix4(worldMatrix);
    vertices.push(vertex);
  }

  const uniqueVertices = removeDuplicateVertices(vertices);

  if (enabledSnaps[SnapType.ENDPOINT]) {
    uniqueVertices.forEach(vertex => {
      snapPoints.push({
        position: vertex,
        type: SnapType.ENDPOINT
      });
    });
  }

  if (enabledSnaps[SnapType.MIDPOINT]) {
    const edges = getEdges(geometry);
    edges.forEach(edge => {
      const v1 = new THREE.Vector3(
        positions.getX(edge[0]),
        positions.getY(edge[0]),
        positions.getZ(edge[0])
      ).applyMatrix4(worldMatrix);

      const v2 = new THREE.Vector3(
        positions.getX(edge[1]),
        positions.getY(edge[1]),
        positions.getZ(edge[1])
      ).applyMatrix4(worldMatrix);

      const midpoint = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);

      snapPoints.push({
        position: midpoint,
        type: SnapType.MIDPOINT
      });
    });
  }

  if (enabledSnaps[SnapType.CENTER]) {
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      center.applyMatrix4(worldMatrix);

      snapPoints.push({
        position: center,
        type: SnapType.CENTER
      });
    }
  }

  return snapPoints;
}

export function findNearestSnap(
  mousePosition: THREE.Vector2,
  camera: THREE.Camera,
  snapPoints: SnapPoint[]
): SnapResult | null {
  let nearestSnap: SnapResult | null = null;
  let minDistance = SNAP_THRESHOLD;

  snapPoints.forEach(snapPoint => {
    const screenPos = snapPoint.position.clone().project(camera);

    const distance = Math.sqrt(
      Math.pow((screenPos.x - mousePosition.x) * window.innerWidth / 2, 2) +
      Math.pow((screenPos.y - mousePosition.y) * window.innerHeight / 2, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestSnap = {
        point: snapPoint,
        distance
      };
    }
  });

  return nearestSnap;
}

function removeDuplicateVertices(vertices: THREE.Vector3[]): THREE.Vector3[] {
  const unique: THREE.Vector3[] = [];
  const epsilon = 0.001;

  vertices.forEach(v => {
    const exists = unique.some(u =>
      Math.abs(u.x - v.x) < epsilon &&
      Math.abs(u.y - v.y) < epsilon &&
      Math.abs(u.z - v.z) < epsilon
    );

    if (!exists) {
      unique.push(v);
    }
  });

  return unique;
}

function getEdges(geometry: THREE.BufferGeometry): [number, number][] {
  const edges: [number, number][] = [];
  const index = geometry.index;

  if (!index) return edges;

  const edgeSet = new Set<string>();

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    addEdge(edgeSet, edges, a, b);
    addEdge(edgeSet, edges, b, c);
    addEdge(edgeSet, edges, c, a);
  }

  return edges;
}

function addEdge(
  edgeSet: Set<string>,
  edges: [number, number][],
  a: number,
  b: number
): void {
  const key1 = `${Math.min(a, b)}-${Math.max(a, b)}`;

  if (!edgeSet.has(key1)) {
    edgeSet.add(key1);
    edges.push([a, b]);
  }
}

export function getSnapIcon(snapType: SnapType): string {
  switch (snapType) {
    case SnapType.ENDPOINT:
      return '⬤';
    case SnapType.MIDPOINT:
      return '△';
    case SnapType.CENTER:
      return '○';
    case SnapType.PERPENDICULAR:
      return '⊥';
    case SnapType.INTERSECTION:
      return '✕';
    case SnapType.NEAREST:
      return '◆';
    default:
      return '●';
  }
}

export function getSnapColor(snapType: SnapType): string {
  switch (snapType) {
    case SnapType.ENDPOINT:
      return '#22c55e';
    case SnapType.MIDPOINT:
      return '#3b82f6';
    case SnapType.CENTER:
      return '#f59e0b';
    case SnapType.PERPENDICULAR:
      return '#a855f7';
    case SnapType.INTERSECTION:
      return '#ef4444';
    case SnapType.NEAREST:
      return '#06b6d4';
    default:
      return '#64748b';
  }
}
