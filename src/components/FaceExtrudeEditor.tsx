import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { detectFaceFromRaycast, calculateFaceDimension, extrudeFaceToAbsoluteValue } from '../services/faceExtrude';
import { useThree } from '@react-three/fiber';

interface FaceExtrudeEditorProps {
  shape: any;
  isActive: boolean;
}

export const FaceExtrudeEditor: React.FC<FaceExtrudeEditorProps> = ({ shape, isActive }) => {
  const { faceExtrudeState, setFaceExtrudeState, updateShape } = useAppStore();
  const { camera, scene, gl } = useThree();
  const [selectedFaceMarker, setSelectedFaceMarker] = useState<THREE.Vector3 | null>(null);
  const [referenceFaceMarker, setReferenceFaceMarker] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!isActive) {
      setFaceExtrudeState(null);
      setSelectedFaceMarker(null);
      setReferenceFaceMarker(null);
      return;
    }

    if (!faceExtrudeState) {
      setFaceExtrudeState({
        step: 'select-face',
        selectedFace: null,
        referenceFace: null
      });
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

            setSelectedFaceMarker(faceData.center.clone().applyMatrix4(mesh.matrixWorld));

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

          } else if (faceExtrudeState.step === 'select-reference') {
            const dimension = calculateFaceDimension(faceData.vertices);

            console.log('🟢 Selected reference face:', {
              center: faceData.center,
              dimension: dimension.toFixed(2)
            });

            setReferenceFaceMarker(faceData.center.clone().applyMatrix4(mesh.matrixWorld));

            setFaceExtrudeState({
              ...faceExtrudeState,
              step: 'complete',
              referenceFace: {
                face: null,
                dimension: dimension
              }
            });

            (window as any).pendingFaceExtrude = true;
            (window as any).faceExtrudeData = {
              shapeId: shape.id,
              selectedFace: faceExtrudeState.selectedFace,
              referenceDimension: dimension,
              geometry: mesh.geometry
            };

            console.log('✅ Face extrude ready. Waiting for absolute value input...');
          }
        }
      }
    };

    const canvas = gl.domElement;
    canvas.addEventListener('click', handleClick, true);

    return () => {
      canvas.removeEventListener('click', handleClick, true);
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
      setFaceExtrudeState(null);
      setSelectedFaceMarker(null);
      setReferenceFaceMarker(null);
    };

    return () => {
      delete (window as any).handleFaceExtrudeValue;
    };
  }, [shape, updateShape, setFaceExtrudeState]);

  if (!isActive) return null;

  return (
    <>
      {selectedFaceMarker && (
        <mesh position={selectedFaceMarker}>
          <sphereGeometry args={[15, 16, 16]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.8} />
        </mesh>
      )}
      {referenceFaceMarker && (
        <mesh position={referenceFaceMarker}>
          <sphereGeometry args={[15, 16, 16]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
        </mesh>
      )}
    </>
  );
};
