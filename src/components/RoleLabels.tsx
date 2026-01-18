import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { extractFacesFromGeometry, groupCoplanarFaces } from './FaceEditor';
import { useAppStore } from '../store';

interface RoleLabelsProps {
  shape: any;
  isActive: boolean;
}

export const RoleLabels: React.FC<RoleLabelsProps> = ({ shape, isActive }) => {
  const { roleEditMode } = useAppStore();

  const faceLabels = useMemo(() => {
    if (!isActive || !shape.geometry) return [];

    const faces = extractFacesFromGeometry(shape.geometry);
    const faceGroups = groupCoplanarFaces(faces);
    const faceRoles = shape.faceRoles || {};

    return faceGroups.map((group, index) => {
      const role = faceRoles[index];
      const label = role ? `${index + 1} (${role})` : `${index + 1}`;

      return {
        position: group.center,
        label,
        index,
        hasRole: !!role
      };
    });
  }, [shape.geometry, shape.faceRoles, isActive, shape.id]);

  if (!isActive || !roleEditMode) return null;

  return (
    <>
      {faceLabels.map((item) => (
        <Html
          key={`label-${item.index}`}
          position={[item.position.x, item.position.y, item.position.z]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div
            style={{
              background: item.hasRole ? '#9333ea' : '#6b7280',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
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
