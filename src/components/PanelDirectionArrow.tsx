import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PanelDirectionArrowProps {
  geometry: THREE.BufferGeometry;
  faceRole?: string;
}

export const PanelDirectionArrow: React.FC<PanelDirectionArrowProps> = React.memo(({
  geometry,
  faceRole
}) => {
  const arrowConfig = useMemo(() => {
    if (!geometry) return null;

    const posAttr = geometry.getAttribute('position');
    if (!posAttr) return null;

    const bbox = new THREE.Box3().setFromBufferAttribute(posAttr as THREE.BufferAttribute);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bbox.getCenter(center);
    bbox.getSize(size);

    const axes = [
      { index: 0, value: size.x },
      { index: 1, value: size.y },
      { index: 2, value: size.z }
    ];
    axes.sort((a, b) => a.value - b.value);
    const thinAxisIndex = axes[0].index;
    const thinAxisValue = axes[0].value;

    const maxDim = Math.max(size.x, size.y, size.z);

    const shaftLength = Math.max(maxDim * 0.18, 20);
    const shaftRadius = Math.max(maxDim * 0.01, 1.5);
    const headLength = Math.max(maxDim * 0.1, 12);
    const headRadius = Math.max(maxDim * 0.03, 4);

    const offsetDir = new THREE.Vector3();
    offsetDir.setComponent(thinAxisIndex, 1);

    const gap = Math.max(thinAxisValue * 0.5, 5);

    const arrowPosition = center.clone().add(
      offsetDir.clone().multiplyScalar(thinAxisValue / 2 + gap)
    );

    const role = faceRole?.toLowerCase();
    let rotation: [number, number, number] = [0, 0, 0];
    if (role === 'top' || role === 'bottom') {
      rotation = [0, 0, -Math.PI / 2];
    }

    return {
      position: [arrowPosition.x, arrowPosition.y, arrowPosition.z] as [number, number, number],
      rotation,
      shaftLength,
      shaftRadius,
      headLength,
      headRadius
    };
  }, [geometry, faceRole]);

  if (!arrowConfig) return null;

  const { position, rotation, shaftLength, shaftRadius, headLength, headRadius } = arrowConfig;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 16]} />
        <meshStandardMaterial
          color="#1565C0"
          emissive="#1E88E5"
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, shaftLength + headLength / 2, 0]}>
        <coneGeometry args={[headRadius, headLength, 16]} />
        <meshStandardMaterial
          color="#1565C0"
          emissive="#1E88E5"
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
});

PanelDirectionArrow.displayName = 'PanelDirectionArrow';
