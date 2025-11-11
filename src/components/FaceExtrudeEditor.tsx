import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { detectFaceFromRaycast, calculateFaceDimension, extrudeFaceToAbsoluteValue } from '../services/faceExtrude';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

interface FaceExtrudeEditorProps {
  shape: any;
  isActive: boolean;
}

export const FaceExtrudeEditor: React.FC<FaceExtrudeEditorProps> = ({ shape, isActive }) => {
  const { faceExtrudeState, setFaceExtrudeState, updateShape } = useAppStore();
  const { camera, scene, gl } = useThree();
  const [selectedFaceVertices, setSelectedFaceVertices] = useState<THREE.Vector3[]>([]);
  const [referenceFaceVertices, setReferenceFaceVertices] = useState<THREE.Vector3[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (!isActive) {
      setFaceExtrudeState(null);
      setSelectedFaceVertices([]);
      setReferenceFaceVertices([]);
      setStatusMessage('');
      return;
    }

    if (!faceExtrudeState) {
      setFaceExtrudeState({
        step: 'select-face',
        selectedFace: null,
        referenceFace: null
      });
      setStatusMessage('Select face to extrude (yellow)');
    }
  }, [isActive, faceExtrudeState, setFaceExtrudeState]);

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const meshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) {
          meshes.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(meshes, false);

      console.log('🎯 Face extrude click:', {
        meshesFound: meshes.length,
        intersects: intersects.length,
        step: faceExtrudeState?.step
      });

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const mesh = intersection.object as THREE.Mesh;
        const point = intersection.point;

        const worldToLocal = new THREE.Matrix4();
        worldToLocal.copy(mesh.matrixWorld).invert();
        const localPoint = point.clone().applyMatrix4(worldToLocal);

        const faceData = detectFaceFromRaycast(mesh.geometry as THREE.BufferGeometry, localPoint);

        if (faceData && faceExtrudeState) {
          if (faceExtrudeState.step === 'select-face') {
            const dimension = calculateFaceDimension(faceData.vertices);

            console.log('🟡 Selected face (to extrude):', {
              center: faceData.center,
              normal: faceData.normal,
              dimension: dimension.toFixed(2)
            });

            const worldVertices = faceData.vertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));
            setSelectedFaceVertices(worldVertices);

            setFaceExtrudeState({
              ...faceExtrudeState,
              step: 'select-reference',
              selectedFace: {
                face: null,
                normal: faceData.normal,
                center: faceData.center,
                vertices: faceData.vertices
              }
            });
            setStatusMessage('Select reference face (green) - Right click or press Enter to confirm');

          } else if (faceExtrudeState.step === 'select-reference') {
            const dimension = calculateFaceDimension(faceData.vertices);

            console.log('🟢 Selected reference face:', {
              center: faceData.center,
              dimension: dimension.toFixed(2)
            });

            const worldVertices = faceData.vertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));
            setReferenceFaceVertices(worldVertices);

            (window as any).tempFaceExtrudeData = {
              shapeId: shape.id,
              selectedFace: faceExtrudeState.selectedFace,
              referenceDimension: dimension,
              geometry: mesh.geometry,
              state: faceExtrudeState
            };

            setStatusMessage(`Reference dimension: ${dimension.toFixed(2)} - Right click or press Enter to confirm`);
          }
        }
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (faceExtrudeState?.step === 'select-reference' && (window as any).tempFaceExtrudeData) {
        event.preventDefault();
        event.stopPropagation();
        confirmReference();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && faceExtrudeState?.step === 'select-reference' && (window as any).tempFaceExtrudeData) {
        event.preventDefault();
        confirmReference();
      }
    };

    const confirmReference = () => {
      const data = (window as any).tempFaceExtrudeData;
      if (!data) return;

      setFaceExtrudeState({
        ...data.state,
        step: 'complete',
        referenceFace: {
          face: null,
          dimension: data.referenceDimension
        }
      });

      (window as any).pendingFaceExtrude = true;
      (window as any).faceExtrudeData = data;

      setStatusMessage(`Enter absolute value (reference: ${data.referenceDimension.toFixed(2)})`);
      console.log('✅ Face extrude ready. Waiting for absolute value input...');
    };

    const canvas = gl.domElement;
    canvas.addEventListener('click', handleClick, true);
    canvas.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('click', handleClick, true);
      canvas.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, faceExtrudeState, shape, camera, scene, gl, setFaceExtrudeState]);

  useEffect(() => {
    (window as any).handleFaceExtrudeValue = async (absoluteValue: number) => {
      const data = (window as any).faceExtrudeData;
      if (!data) return;

      const { shapeId, selectedFace, referenceDimension, geometry } = data;

      console.log('🎯 Applying face extrude:', {
        absoluteValue,
        referenceDimension: referenceDimension.toFixed(2),
        extrudeDistance: (absoluteValue - referenceDimension).toFixed(2)
      });

      const newGeometry = extrudeFaceToAbsoluteValue(
        geometry,
        selectedFace.center,
        selectedFace.normal,
        absoluteValue,
        referenceDimension
      );

      if (newGeometry) {
        updateShape(shapeId, {
          geometry: newGeometry
        });

        console.log('✅ Face extrude applied successfully');
      }

      delete (window as any).pendingFaceExtrude;
      delete (window as any).faceExtrudeData;
      delete (window as any).tempFaceExtrudeData;
      setFaceExtrudeState(null);
      setSelectedFaceVertices([]);
      setReferenceFaceVertices([]);
      setStatusMessage('');
    };

    return () => {
      delete (window as any).handleFaceExtrudeValue;
    };
  }, [shape, updateShape, setFaceExtrudeState]);

  if (!isActive) return null;

  const createFaceGeometry = (vertices: THREE.Vector3[]) => {
    if (vertices.length < 3) return null;

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    for (let i = 1; i < vertices.length - 1; i++) {
      positions.push(vertices[0].x, vertices[0].y, vertices[0].z);
      positions.push(vertices[i].x, vertices[i].y, vertices[i].z);
      positions.push(vertices[i + 1].x, vertices[i + 1].y, vertices[i + 1].z);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  };

  return (
    <>
      {selectedFaceVertices.length > 0 && (
        <>
          <mesh>
            <bufferGeometry attach="geometry" {...createFaceGeometry(selectedFaceVertices)} />
            <meshBasicMaterial color="#eab308" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <lineLoop>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={selectedFaceVertices.length}
                array={new Float32Array(selectedFaceVertices.flatMap(v => [v.x, v.y, v.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#eab308" linewidth={3} />
          </lineLoop>
        </>
      )}
      {referenceFaceVertices.length > 0 && (
        <>
          <mesh>
            <bufferGeometry attach="geometry" {...createFaceGeometry(referenceFaceVertices)} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <lineLoop>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={referenceFaceVertices.length}
                array={new Float32Array(referenceFaceVertices.flatMap(v => [v.x, v.y, v.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#22c55e" linewidth={3} />
          </lineLoop>
        </>
      )}
      {statusMessage && (
        <Html position={[0, 300, 0]} center>
          <div style={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            pointerEvents: 'none'
          }}>
            {statusMessage}
          </div>
        </Html>
      )}
    </>
  );
};
