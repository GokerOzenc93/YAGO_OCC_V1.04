import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import type { VirtualFace } from '../store';

interface VirtualFaceOverlayProps {
  shape: any;
}

function earClipTriangulateVF(vertices: { x: number; y: number }[]): number[] {
  if (vertices.length < 3) return [];
  if (vertices.length === 3) return [0, 1, 2];

  const indices: number[] = [];
  const remaining = vertices.map((_, i) => i);

  const signFn = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

  const ptInTri = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    const d1 = signFn(p, a, b), d2 = signFn(p, b, c), d3 = signFn(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };

  let safety = remaining.length * remaining.length;
  while (remaining.length > 3 && safety > 0) {
    safety--;
    let earFound = false;
    for (let i = 0; i < remaining.length; i++) {
      const pi = (i + remaining.length - 1) % remaining.length;
      const ni = (i + 1) % remaining.length;
      const a = vertices[remaining[pi]], b = vertices[remaining[i]], c = vertices[remaining[ni]];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross < 1e-10) continue;
      let isEar = true;
      for (let j = 0; j < remaining.length; j++) {
        if (j === pi || j === i || j === ni) continue;
        if (ptInTri(vertices[remaining[j]], a, b, c)) { isEar = false; break; }
      }
      if (isEar) {
        indices.push(remaining[pi], remaining[i], remaining[ni]);
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }
    if (!earFound) remaining.reverse();
  }
  if (remaining.length === 3) indices.push(remaining[0], remaining[1], remaining[2]);
  return indices;
}

function buildSurfaceMeshes(vf: VirtualFace): { geo: THREE.BufferGeometry; edgeGeo: THREE.BufferGeometry } | null {
  if (vf.vertices.length < 3) return null;

  const corners = vf.vertices.map(v => new THREE.Vector3(v[0], v[1], v[2]));

  const normal = new THREE.Vector3(vf.normal[0], vf.normal[1], vf.normal[2]).normalize();
  let up: THREE.Vector3;
  if (Math.abs(normal.y) > Math.abs(normal.x) && Math.abs(normal.y) > Math.abs(normal.z)) {
    up = new THREE.Vector3(1, 0, 0);
  } else {
    up = new THREE.Vector3(0, 1, 0);
  }
  const uAxis = new THREE.Vector3().crossVectors(normal, up).normalize();
  const vAxis = new THREE.Vector3().crossVectors(uAxis, normal).normalize();
  const origin = corners[0];

  const projected2D = corners.map(c => {
    const d = new THREE.Vector3().subVectors(c, origin);
    return { x: d.dot(uAxis), y: d.dot(vAxis) };
  });

  let area = 0;
  for (let i = 0; i < projected2D.length; i++) {
    const j = (i + 1) % projected2D.length;
    area += projected2D[i].x * projected2D[j].y - projected2D[j].x * projected2D[i].y;
  }
  if (area < 0) projected2D.reverse(), corners.reverse();

  const triIndices = earClipTriangulateVF(projected2D);

  const positions = new Float32Array(triIndices.length * 3);
  for (let i = 0; i < triIndices.length; i++) {
    const c = corners[triIndices[i]];
    positions[i * 3] = c.x;
    positions[i * 3 + 1] = c.y;
    positions[i * 3 + 2] = c.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const edgeVerts: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    edgeVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeVerts), 3));

  return { geo, edgeGeo };
}

export const VirtualFaceOverlay: React.FC<VirtualFaceOverlayProps> = ({ shape }) => {
  const { virtualFaces, showVirtualFaces, panelSurfaceSelectMode, waitingForSurfaceSelection, triggerPanelCreationForFace, setSelectedPanelRow, panelSelectMode } = useAppStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const shapeFaces = useMemo(
    () => virtualFaces.filter(f => f.shapeId === shape.id),
    [virtualFaces, shape.id]
  );

  const meshes = useMemo(() => {
    return shapeFaces.map(vf => {
      const result = buildSurfaceMeshes(vf);
      return result ? { id: vf.id, vf, ...result } : null;
    }).filter(Boolean) as Array<{ id: string; vf: VirtualFace; geo: THREE.BufferGeometry; edgeGeo: THREE.BufferGeometry }>;
  }, [shapeFaces]);

  if (!showVirtualFaces || meshes.length === 0) return null;

  return (
    <>
      {meshes.map((surface, idx) => {
        const isHovered = hoveredId === surface.id;
        const isWaitingForSelection = panelSurfaceSelectMode && !!waitingForSurfaceSelection;

        return (
          <React.Fragment key={surface.id}>
            <mesh
              geometry={surface.geo}
              onClick={(e) => {
                e.stopPropagation();
                if (panelSurfaceSelectMode) {
                  triggerPanelCreationForFace(
                    -(idx + 1),
                    shape.id,
                    {
                      center: surface.vf.center,
                      normal: surface.vf.normal,
                      constraintPanelId: surface.vf.id,
                    }
                  );
                  setSelectedPanelRow(surface.vf.id);
                } else if (panelSelectMode) {
                  setSelectedPanelRow(surface.vf.id);
                }
              }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId(surface.id); }}
              onPointerOut={(e) => { e.stopPropagation(); setHoveredId(null); }}
            >
              <meshBasicMaterial
                color={isHovered && panelSurfaceSelectMode ? 0x00cc44 : 0x22c55e}
                transparent
                opacity={isHovered ? 0.65 : 0.38}
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                depthTest={false}
              />
            </mesh>
            <lineSegments geometry={surface.edgeGeo}>
              <lineBasicMaterial color={0x16a34a} linewidth={2} depthTest={false} transparent opacity={0.9} />
            </lineSegments>
          </React.Fragment>
        );
      })}
    </>
  );
};
