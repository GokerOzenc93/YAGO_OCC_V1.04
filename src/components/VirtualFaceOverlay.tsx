import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import type { VirtualFace } from '../store';

interface VirtualFaceOverlayProps {
  shape: any;
}

function getFacePlaneAxes(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const n = normal.clone().normalize();
  const absX = Math.abs(n.x);
  const absY = Math.abs(n.y);
  const absZ = Math.abs(n.z);

  let up: THREE.Vector3;
  if (absY > absX && absY > absZ) {
    up = new THREE.Vector3(1, 0, 0);
  } else {
    up = new THREE.Vector3(0, 1, 0);
  }

  const u = new THREE.Vector3().crossVectors(n, up).normalize();
  const v = new THREE.Vector3().crossVectors(u, n).normalize();
  return { u, v };
}

interface SurfaceMeshData {
  id: string;
  geo: THREE.BufferGeometry;
  edgeGeo: THREE.BufferGeometry;
}

function buildSurfaceMeshes(vf: VirtualFace, parentPosition: THREE.Vector3): SurfaceMeshData | null {
  if (vf.vertices.length < 4) return null;

  const normal = new THREE.Vector3(...vf.normal);
  const { u, v } = getFacePlaneAxes(normal);
  const center = new THREE.Vector3(...vf.center);
  const uHalfLen = new THREE.Vector3(...vf.vertices[0]).distanceTo(new THREE.Vector3(...vf.vertices[1])) / 2;
  const vHalfLen = new THREE.Vector3(...vf.vertices[0]).distanceTo(new THREE.Vector3(...vf.vertices[3])) / 2;

  const corners = [
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, vHalfLen),
    center.clone().addScaledVector(u, -uHalfLen).addScaledVector(v, -vHalfLen),
    center.clone().addScaledVector(u, uHalfLen).addScaledVector(v, -vHalfLen),
  ];

  const positions = new Float32Array([
    corners[0].x, corners[0].y, corners[0].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[0].x, corners[0].y, corners[0].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[3].x, corners[3].y, corners[3].z,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const edgePositions = new Float32Array([
    corners[0].x, corners[0].y, corners[0].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[3].x, corners[3].y, corners[3].z,
    corners[3].x, corners[3].y, corners[3].z,
    corners[0].x, corners[0].y, corners[0].z,
  ]);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

  return { id: vf.id, geo, edgeGeo };
}

export const VirtualFaceOverlay: React.FC<VirtualFaceOverlayProps> = ({ shape }) => {
  const {
    virtualFaces,
    panelSurfaceSelectMode,
    waitingForSurfaceSelection,
    triggerPanelCreationForFace,
    updateVirtualFace,
  } = useAppStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const shapeFaces = useMemo(
    () => virtualFaces.filter(f => f.shapeId === shape.id),
    [virtualFaces, shape.id]
  );

  const parentPosition = useMemo(
    () => new THREE.Vector3(shape.position[0], shape.position[1], shape.position[2]),
    [shape.position[0], shape.position[1], shape.position[2]]
  );

  const surfaceMeshes = useMemo(() => {
    return shapeFaces.map(vf => buildSurfaceMeshes(vf, parentPosition)).filter(Boolean) as SurfaceMeshData[];
  }, [shapeFaces, parentPosition]);

  if (surfaceMeshes.length === 0) return null;

  return (
    <>
      {surfaceMeshes.map((surface, idx) => {
        const vf = shapeFaces[idx];
        if (!vf) return null;
        const isHovered = hoveredId === surface.id;
        const isWaitingForSelection = panelSurfaceSelectMode && !!waitingForSurfaceSelection;

        return (
          <React.Fragment key={surface.id}>
            <mesh
              geometry={surface.geo}
              onClick={(e) => {
                e.stopPropagation();
                if (isWaitingForSelection) {
                  triggerPanelCreationForFace(
                    -(idx + 1),
                    shape.id,
                    {
                      center: vf.center,
                      normal: vf.normal,
                      constraintPanelId: vf.id,
                    }
                  );
                }
              }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId(surface.id); }}
              onPointerOut={(e) => { e.stopPropagation(); setHoveredId(null); }}
            >
              <meshBasicMaterial
                color={isHovered && isWaitingForSelection ? 0x00cc44 : 0x22c55e}
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
              <lineBasicMaterial
                color={0x16a34a}
                linewidth={2}
                depthTest={false}
                transparent
                opacity={0.9}
              />
            </lineSegments>
          </React.Fragment>
        );
      })}
    </>
  );
};
