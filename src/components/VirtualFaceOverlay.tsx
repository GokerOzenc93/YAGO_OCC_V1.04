import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import type { VirtualFace } from '../store';

interface VirtualFaceOverlayProps {
  shape: any;
}

function buildSurfaceMeshes(vf: VirtualFace): { geo: THREE.BufferGeometry; edgeGeo: THREE.BufferGeometry } | null {
  if (vf.vertices.length < 4) return null;

  const corners = vf.vertices.map(v => new THREE.Vector3(v[0], v[1], v[2]));

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

  return { geo, edgeGeo };
}

export const VirtualFaceOverlay: React.FC<VirtualFaceOverlayProps> = ({ shape }) => {
  const { virtualFaces, panelSurfaceSelectMode, waitingForSurfaceSelection, triggerPanelCreationForFace } = useAppStore();
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

  if (meshes.length === 0) return null;

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
