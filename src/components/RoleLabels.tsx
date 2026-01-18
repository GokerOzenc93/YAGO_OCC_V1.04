import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';

interface RoleLabelsProps {
  shape: any;
  isActive: boolean;
}

export const RoleLabels: React.FC<RoleLabelsProps> = ({ shape, isActive }) => {
  const faceLabels = useMemo(() => {
    if (!isActive || !shape.geometry) return [];

    const faces = extractFacesFromGeometry(shape.geometry);
    const faceGroups = groupCoplanarFaces(faces);
    const faceRoles = shape.faceRoles || {};

    return faceGroups.map((group, index) => {
      const role = faceRoles[index];
      const label = role ? `${index + 1} (${role})` : `${index + 1}`;

      const offsetPosition = new THREE.Vector3()
        .copy(group.center)
        .add(group.normal.clone().multiplyScalar(0.01));

      return {
        position: offsetPosition,
        label,
        index,
        hasRole: !!role
      };
    });
  }, [shape.geometry, shape.faceRoles, isActive, shape.id]);

  if (!isActive || faceLabels.length === 0) return null;

  return (
    <>
      {faceLabels.map((item) => (
        <Html
          key={`label-${item.index}`}
          position={[item.position.x, item.position.y, item.position.z]}
          center
          occlude={false}
          zIndexRange={[0, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div
            style={{
              background: item.hasRole ? 'rgba(5, 150, 105, 0.85)' : 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.3)'
            }}
          >
            {item.label}
          </div>
        </Html>
      ))}
    </>
  );
};
