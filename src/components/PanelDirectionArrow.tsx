import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PanelDirectionArrowProps {
  geometry: THREE.BufferGeometry;
  faceRole?: string;
  arrowRotated?: boolean;
}

export const PanelDirectionArrow: React.FC<PanelDirectionArrowProps> = React.memo(({
  geometry,
  faceRole,
  arrowRotated = false
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

    const offsetDir = new THREE.Vector3();
    offsetDir.setComponent(thinAxisIndex, 1);

    const gap = thinAxisValue / 2 + 40;

    const arrowPosition = center.clone().add(
      offsetDir.clone().multiplyScalar(gap)
    );

    const planeAxes = axes.slice(1).map(a => a.index).sort((a, b) => a - b);

    const axisToRotation = (axis: number): [number, number, number] => {
      if (axis === 0) return [0, 0, -Math.PI / 2];
      if (axis === 2) return [Math.PI / 2, 0, 0];
      return [0, 0, 0];
    };

    const role = faceRole?.toLowerCase();
    let defaultAxis = planeAxes[0];
    let altAxis = planeAxes[1];

    if (role === 'left' || role === 'right') {
      if (planeAxes.includes(1)) {
        defaultAxis = 1;
        altAxis = planeAxes.find(a => a !== 1) ?? planeAxes[1];
      }
    } else if (role === 'top' || role === 'bottom') {
      if (planeAxes.includes(0)) {
        defaultAxis = 0;
        altAxis = planeAxes.find(a => a !== 0) ?? planeAxes[1];
      }
    }

    const targetAxis = arrowRotated ? altAxis : defaultAxis;
    const rotation = axisToRotation(targetAxis);

    return {
      position: [arrowPosition.x, arrowPosition.y, arrowPosition.z] as [number, number, number],
      rotation
    };
  }, [geometry, faceRole, arrowRotated]);

  if (!arrowConfig) return null;

  const { position, rotation } = arrowConfig;

  const shaftLength = 50;
  const shaftWidth = 4;
  const shaftDepth = 1;
  const headLength = 15;
  const headWidth = 12;
  const headDepth = 1;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <boxGeometry args={[shaftWidth, shaftLength, shaftDepth]} />
        <meshStandardMaterial
          color="#2196F3"
          emissive="#2196F3"
          emissiveIntensity={0.5}
          metalness={0.2}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, shaftLength + headLength / 2, 0]}>
        <coneGeometry args={[headWidth, headLength, 3]} />
        <meshStandardMaterial
          color="#2196F3"
          emissive="#2196F3"
          emissiveIntensity={0.5}
          metalness={0.2}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});

PanelDirectionArrow.displayName = 'PanelDirectionArrow';
