import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { RayProbeResult, RayDirection } from '../store';
import { getDirectionColor, getDirectionLabel } from './RayProbeService';

interface RayProbeVisualizerProps {
  results: RayProbeResult;
}

const MISS_RAY_LENGTH = 2000;

const directionVectors: Record<RayDirection, THREE.Vector3> = {
  'x+': new THREE.Vector3(1, 0, 0),
  'x-': new THREE.Vector3(-1, 0, 0),
  'y+': new THREE.Vector3(0, 1, 0),
  'y-': new THREE.Vector3(0, -1, 0),
  'z+': new THREE.Vector3(0, 0, 1),
  'z-': new THREE.Vector3(0, 0, -1),
};

const ALL_DIRECTIONS: RayDirection[] = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];

const RayLine: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
}> = ({ start, end, color, opacity }) => {
  const ref = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
      start.x, start.y, start.z,
      end.x, end.y, end.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [start, end]);

  return (
    <line ref={ref as any} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthTest={true} />
    </line>
  );
};

const DashedRayLine: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
}> = ({ start, end, color }) => {
  const ref = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
      start.x, start.y, start.z,
      end.x, end.y, end.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [start, end]);

  useEffect(() => {
    if (ref.current) {
      ref.current.computeLineDistances();
    }
  }, [geometry]);

  return (
    <line ref={ref as any} geometry={geometry}>
      <lineDashedMaterial
        color={color}
        transparent
        opacity={0.25}
        dashSize={15}
        gapSize={10}
        depthTest={true}
      />
    </line>
  );
};

export const RayProbeVisualizer: React.FC<RayProbeVisualizerProps> = React.memo(({ results }) => {
  const origin = useMemo(() => new THREE.Vector3(...results.origin), [results.origin]);
  const hitMap = useMemo(() => {
    const map = new Map<RayDirection, typeof results.hits[0]>();
    results.hits.forEach(h => map.set(h.direction, h));
    return map;
  }, [results.hits]);

  const rayData = useMemo(() => {
    return ALL_DIRECTIONS.map(dir => {
      const hit = hitMap.get(dir);
      const dirVec = directionVectors[dir];

      if (hit) {
        return {
          direction: dir,
          start: origin.clone(),
          end: new THREE.Vector3(...hit.point),
          hit: true as const,
          distance: hit.distance,
        };
      }
      return {
        direction: dir,
        start: origin.clone(),
        end: origin.clone().add(dirVec.clone().multiplyScalar(MISS_RAY_LENGTH)),
        hit: false as const,
        distance: undefined,
      };
    });
  }, [origin, hitMap]);

  return (
    <group>
      <mesh position={origin}>
        <sphereGeometry args={[6, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={origin}>
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>

      {rayData.map(({ direction, start, end, hit, distance }) => {
        const color = getDirectionColor(direction);

        return (
          <group key={direction}>
            {hit ? (
              <RayLine start={start} end={end} color={color} opacity={1} />
            ) : (
              <DashedRayLine start={start} end={end} color={color} />
            )}

            {hit && (
              <>
                <mesh position={end}>
                  <sphereGeometry args={[5, 12, 12]} />
                  <meshBasicMaterial color={color} />
                </mesh>
                <mesh position={end}>
                  <sphereGeometry args={[8, 12, 12]} />
                  <meshBasicMaterial color={color} transparent opacity={0.3} />
                </mesh>

                <Html
                  position={[end.x, end.y, end.z]}
                  center
                  style={{ pointerEvents: 'none' }}
                  zIndexRange={[100, 0]}
                >
                  <div
                    className="px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap shadow-lg border"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      color: color,
                      borderColor: color,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    {getDirectionLabel(direction)}: {distance?.toFixed(1)}mm
                  </div>
                </Html>
              </>
            )}
          </group>
        );
      })}

      {results.hits.length > 0 && (
        <Html
          position={[origin.x, origin.y, origin.z]}
          center
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div
            className="px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap shadow-lg"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.95)',
              color: '#fff',
              transform: 'translateY(20px)',
            }}
          >
            {results.hits.length}/6 yuzey bulundu
          </div>
        </Html>
      )}
    </group>
  );
});

RayProbeVisualizer.displayName = 'RayProbeVisualizer';
