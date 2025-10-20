import React, { useEffect, useState, useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { findSnapPoints, findNearestSnap, getSnapIcon, getSnapColor, SnapPoint } from '../utils/snapSystem';

interface SnapIndicatorProps {
  shapes: any[];
}

export const SnapIndicator: React.FC<SnapIndicatorProps> = ({ shapes }) => {
  const { snapSettings } = useAppStore();
  const [activeSnap, setActiveSnap] = useState<SnapPoint | null>(null);
  const [mousePosition, setMousePosition] = useState<THREE.Vector2>(new THREE.Vector2());
  const cameraRef = useRef<THREE.Camera | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      setMousePosition(new THREE.Vector2(x, y));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (!cameraRef.current) return;

    const allSnapPoints: SnapPoint[] = [];

    shapes.forEach(shape => {
      if (shape.geometry) {
        const worldMatrix = new THREE.Matrix4().compose(
          new THREE.Vector3(...shape.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation)),
          new THREE.Vector3(...shape.scale)
        );

        const snapPoints = findSnapPoints(shape.geometry, worldMatrix, snapSettings);
        allSnapPoints.push(...snapPoints);
      }
    });

    const nearestSnap = findNearestSnap(mousePosition, cameraRef.current, allSnapPoints);
    setActiveSnap(nearestSnap?.point || null);
  }, [mousePosition, shapes, snapSettings]);

  return (
    <>
      {activeSnap && (
        <group position={activeSnap.position.toArray()}>
          <Html center>
            <div
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: getSnapColor(activeSnap.type),
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                fontSize: '14px',
                color: 'white',
                fontWeight: 'bold',
                pointerEvents: 'none',
                animation: 'snapPulse 0.6s ease-in-out infinite'
              }}
            >
              {getSnapIcon(activeSnap.type)}
            </div>
          </Html>
          <mesh>
            <sphereGeometry args={[5, 16, 16]} />
            <meshBasicMaterial
              color={getSnapColor(activeSnap.type)}
              transparent
              opacity={0.3}
            />
          </mesh>
        </group>
      )}
    </>
  );
};