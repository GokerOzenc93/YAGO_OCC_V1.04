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
      const label = `${index + 1}`;

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
              background: item.hasRole ? 'rgba(5, 150, 105, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              color: item.hasRole ? 'white' : '#000',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              fontSize: '9px',
              fontWeight: '700',
              fontFamily: 'system-ui, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: item.hasRole ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(0,0,0,0.3)'
            }}
          >
            {item.label}
          </div>
        </Html>
      ))}
    </>
  );
};
