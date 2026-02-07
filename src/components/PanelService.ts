import * as THREE from 'three';
import {
  FaceData,
  CoplanarFaceGroup,
  extractFacesFromGeometry,
  groupCoplanarFaces
} from './FaceEditor';
import type { FaceRole } from '../store';

export interface PanelData {
  geometry: THREE.BufferGeometry;
  edgeGeometry: THREE.BufferGeometry;
  role: FaceRole;
  groupIndex: number;
}

export interface JointSettings {
  topLeftExpanded: boolean;
  topRightExpanded: boolean;
  bottomLeftExpanded: boolean;
  bottomRightExpanded: boolean;
}

const DEFAULT_THICKNESS = 18;
const PRECISION = 3;

function vKey(v: THREE.Vector3): string {
  return `${v.x.toFixed(PRECISION)},${v.y.toFixed(PRECISION)},${v.z.toFixed(PRECISION)}`;
}

function findBoundaryEdges(
  triangles: THREE.Vector3[][]
): Array<[THREE.Vector3, THREE.Vector3]> {
  const counts = new Map<string, { v1: THREE.Vector3; v2: THREE.Vector3; count: number }>();

  triangles.forEach(tri => {
    for (let i = 0; i < 3; i++) {
      const v1 = tri[i];
      const v2 = tri[(i + 1) % 3];
      const k1 = vKey(v1);
      const k2 = vKey(v2);
      const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;

      if (counts.has(ek)) {
        counts.get(ek)!.count++;
      } else {
        counts.set(ek, { v1: v1.clone(), v2: v2.clone(), count: 1 });
      }
    }
  });

  const edges: Array<[THREE.Vector3, THREE.Vector3]> = [];
  counts.forEach(e => {
    if (e.count === 1) edges.push([e.v1, e.v2]);
  });
  return edges;
}

function adjustBoundaryForJoints(
  triangles: THREE.Vector3[][],
  normal: THREE.Vector3,
  thickness: number,
  role: FaceRole,
  settings: JointSettings
) {
  const allVerts = triangles.flat();
  if (allVerts.length === 0) return;

  const bbox = new THREE.Box3();
  allVerts.forEach(v => bbox.expandByPoint(v));

  const tol = Math.max(0.5, thickness * 0.05);

  if (role === 'Top') {
    if (settings.topLeftExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.x - bbox.min.x) < tol) v.x -= thickness;
      });
    }
    if (settings.topRightExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.x - bbox.max.x) < tol) v.x += thickness;
      });
    }
  } else if (role === 'Bottom') {
    if (settings.bottomLeftExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.x - bbox.min.x) < tol) v.x -= thickness;
      });
    }
    if (settings.bottomRightExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.x - bbox.max.x) < tol) v.x += thickness;
      });
    }
  } else if (role === 'Left') {
    if (settings.topLeftExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.y - bbox.max.y) < tol) v.y -= thickness;
      });
    }
    if (settings.bottomLeftExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.y - bbox.min.y) < tol) v.y += thickness;
      });
    }
  } else if (role === 'Right') {
    if (settings.topRightExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.y - bbox.max.y) < tol) v.y -= thickness;
      });
    }
    if (settings.bottomRightExpanded) {
      allVerts.forEach(v => {
        if (Math.abs(v.y - bbox.min.y) < tol) v.y += thickness;
      });
    }
  }
}

export function generatePanelGeometry(
  faces: FaceData[],
  group: CoplanarFaceGroup,
  thickness: number,
  role: FaceRole,
  jointSettings?: JointSettings
): PanelData {
  const inward = group.normal.clone().normalize().negate();

  const triangles: THREE.Vector3[][] = [];
  group.faceIndices.forEach(idx => {
    const face = faces[idx];
    if (face && face.area > 0.001) {
      triangles.push(face.vertices.map(v => v.clone()));
    }
  });

  if (jointSettings && role) {
    adjustBoundaryForJoints(triangles, group.normal, thickness, role, jointSettings);
  }

  const positions: number[] = [];

  triangles.forEach(tri => {
    tri.forEach(v => positions.push(v.x, v.y, v.z));
  });

  triangles.forEach(tri => {
    const [a, b, c] = tri;
    [a, c, b].forEach(v => {
      positions.push(
        v.x + inward.x * thickness,
        v.y + inward.y * thickness,
        v.z + inward.z * thickness
      );
    });
  });

  const boundary = findBoundaryEdges(triangles);
  boundary.forEach(([v1, v2]) => {
    const v1i = v1.clone().addScaledVector(inward, thickness);
    const v2i = v2.clone().addScaledVector(inward, thickness);

    positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v2i.x, v2i.y, v2i.z);
    positions.push(v1.x, v1.y, v1.z, v2i.x, v2i.y, v2i.z, v1i.x, v1i.y, v1i.z);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const edgeGeometry = new THREE.EdgesGeometry(geometry, 15);

  return { geometry, edgeGeometry, role, groupIndex: -1 };
}

export function generatePanelsForShape(
  geometry: THREE.BufferGeometry,
  faceRoles: Record<number, FaceRole>,
  thickness: number = DEFAULT_THICKNESS,
  jointSettings?: JointSettings
): PanelData[] {
  const faces = extractFacesFromGeometry(geometry);
  const groups = groupCoplanarFaces(faces);
  const panels: PanelData[] = [];

  Object.entries(faceRoles).forEach(([idxStr, role]) => {
    if (!role) return;
    const gi = parseInt(idxStr);
    const group = groups[gi];
    if (!group) return;

    const panel = generatePanelGeometry(faces, group, thickness, role, jointSettings);
    panel.groupIndex = gi;
    panels.push(panel);
  });

  return panels;
}
