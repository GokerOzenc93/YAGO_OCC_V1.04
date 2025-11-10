import * as THREE from 'three';

export interface VertexModification {
  vertexIndex: number;
  originalPosition: [number, number, number];
  newPosition: [number, number, number];
  direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
  expression?: string;
  description?: string;
  offset: [number, number, number];
}

export interface ShapeVertexData {
  shapeId: string;
  modifications: VertexModification[];
}

export type VertexEditMode = 'select' | 'direction' | 'input';

export interface VertexState {
  selectedVertexIndex: number | null;
  hoveredVertexIndex: number | null;
  currentDirection: 'x' | 'y' | 'z';
  editMode: VertexEditMode;
  pendingOffset: number;
}

export function getBoxVertices(width: number, height: number, depth: number): THREE.Vector3[] {
  const w2 = width / 2;
  const h2 = height / 2;
  const d2 = depth / 2;

  return [
    new THREE.Vector3(-w2, -h2, -d2),
    new THREE.Vector3(w2, -h2, -d2),
    new THREE.Vector3(w2, h2, -d2),
    new THREE.Vector3(-w2, h2, -d2),
    new THREE.Vector3(-w2, -h2, d2),
    new THREE.Vector3(w2, -h2, d2),
    new THREE.Vector3(w2, h2, d2),
    new THREE.Vector3(-w2, h2, d2),
  ];
}

export async function getReplicadVertices(replicadShape: any): Promise<THREE.Vector3[]> {
  try {
    const vertices = replicadShape.vertices;
    console.log('📍 Getting vertices from Replicad shape:', vertices);

    if (!vertices || !Array.isArray(vertices)) {
      console.warn('⚠️ No vertices array found in Replicad shape');
      return [];
    }

    const vertexPositions = vertices.map((v: any) => {
      if (v && typeof v.point === 'function') {
        const point = v.point();
        return new THREE.Vector3(point[0], point[1], point[2]);
      } else if (Array.isArray(v)) {
        return new THREE.Vector3(v[0], v[1], v[2]);
      }
      return null;
    }).filter((v: THREE.Vector3 | null): v is THREE.Vector3 => v !== null);

    console.log(`✅ Extracted ${vertexPositions.length} vertices from Replicad shape`);
    return vertexPositions;
  } catch (error) {
    console.error('❌ Failed to get Replicad vertices:', error);
    return [];
  }
}

export function applyVertexModifications(
  geometry: THREE.BufferGeometry,
  modifications: VertexModification[]
): THREE.BufferGeometry {
  const positionAttribute = geometry.getAttribute('position');
  const positions = positionAttribute.array as Float32Array;

  modifications.forEach(mod => {
    const idx = mod.vertexIndex * 3;
    positions[idx] += mod.offset[0];
    positions[idx + 1] += mod.offset[1];
    positions[idx + 2] += mod.offset[2];
  });

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

export function getVertexWorldPosition(
  vertex: THREE.Vector3,
  objectMatrix: THREE.Matrix4
): THREE.Vector3 {
  return vertex.clone().applyMatrix4(objectMatrix);
}

export function getDirectionVector(direction: 'x' | 'y' | 'z'): THREE.Vector3 {
  switch (direction) {
    case 'x':
      return new THREE.Vector3(1, 0, 0);
    case 'y':
      return new THREE.Vector3(0, 1, 0);
    case 'z':
      return new THREE.Vector3(0, 0, 1);
  }
}

export function cycleDirection(current: 'x' | 'y' | 'z'): 'x' | 'y' | 'z' {
  switch (current) {
    case 'x':
      return 'y';
    case 'y':
      return 'z';
    case 'z':
      return 'x';
  }
}
