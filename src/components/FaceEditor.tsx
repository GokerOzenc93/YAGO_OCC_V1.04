 tolerance) return 'x+';
  if (normal.x < -tolerance) return 'x-';
  if (normal.y > tolerance) return 'y+';
  if (normal.y < -tolerance) return 'y-';
  if (normal.z > tolerance) return 'z+';
  if (normal.z < -tolerance) return 'z-';
  return null;
}

export function createFaceDescriptor(
  face: FaceData,
  geometry: THREE.BufferGeometry
): { normal: [number, number, number]; normalizedCenter: [number, number, number]; area: number; isCurved?: boolean; axisDirection?: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null } {
  const boundingBox = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute('position')
  );
  const size = new THREE.Vector3();
  const min = new THREE.Vector3();
  boundingBox.getSize(size);
  boundingBox.min.clone().toArray();
  min.copy(boundingBox.min);

  const normalizedCenter: [number, number, number] = [
    size.x > 0 ? (face.center.x - min.x) / size.x : 0.5,
    size.y > 0 ? (face.center.y - min.y) / size.y : 0.5,
    size.z > 0 ? (face.center.z - min.z) / size.z : 0.5
  ];

  const axisDirection = getAxisDirection(face.normal);
  const isCurved = face.isCurved || axisDirection === null;

  return {
    normal: [face.normal.x, face.normal.y, face.normal.z],
    normalizedCenter,
    area: face.area,
    isCurved,
    axisDirection
  };
}

export function findFaceByDescriptor(
  descriptor: { normal: [number, number, number]; normalizedCenter: [number, number, number]; area: number; isCurved?: boolean; axisDirection?: string | null },
  faces: FaceData[],
  geometry: THREE.BufferGeometry
): FaceData | null {
  let bestMatch: FaceData | null = null;
  let bestScore = Infinity;

  const targetNormal = new THREE.Vector3(...descriptor.normal);
  const targetAxisDir = descriptor.axisDirection || getAxisDirection(targetNormal);
  const isFlatSurface = targetAxisDir !== null && !descriptor.isCurved;

  for (const face of faces) {
    const faceDescriptor = createFaceDescriptor(face, geometry);
    const faceAxisDir = faceDescriptor.axisDirection;

    if (isFlatSurface) {
      if (faceAxisDir !== targetAxisDir) {
        continue;
      }

      let relevantCenterDiff = 0;
      if (targetAxisDir === 'x+' || targetAxisDir === 'x-') {
        relevantCenterDiff = Math.sqrt(
          Math.pow(faceDescriptor.normalizedCenter[1] - descriptor.normalizedCenter[1], 2) +
          Math.pow(faceDescriptor.normalizedCenter[2] - descriptor.normalizedCenter[2], 2)
        );
      } else if (targetAxisDir === 'y+' || targetAxisDir === 'y-') {
        relevantCenterDiff = Math.sqrt(
          Math.pow(faceDescriptor.normalizedCenter[0] - descriptor.normalizedCenter[0], 2) +
          Math.pow(faceDescriptor.normalizedCenter[2] - descriptor.normalizedCenter[2], 2)
        );
      } else if (targetAxisDir === 'z+' || targetAxisDir === 'z-') {
        relevantCenterDiff = Math.sqrt(
          Math.pow(faceDescriptor.normalizedCenter[0] - descriptor.normalizedCenter[0], 2) +
          Math.pow(faceDescriptor.normalizedCenter[1] - descriptor.normalizedCenter[1], 2)
        );
      }

      const score = relevantCenterDiff * 10;

      if (score < bestScore) {
        bestScore = score;
        bestMatch = face;
      }
    } else {
      const dotProduct = targetNormal.dot(face.normal);
      const normalAngle = Math.acos(Math.min(1, Math.max(-1, dotProduct))) * (180 / Math.PI);

      if (normalAngle > 15) {
        continue;
      }

      const centerDiff = Math.sqrt(
        Math.pow(faceDescriptor.normalizedCenter[0] - descriptor.normalizedCenter[0], 2) +
        Math.pow(faceDescriptor.normalizedCenter[1] - descriptor.normalizedCenter[1], 2) +
        Math.pow(faceDescriptor.normalizedCenter[2] - descriptor.normalizedCenter[2], 2)
      );

      const score = normalAngle * 2 + centerDiff * 10;

      if (score < bestScore) {
        bestScore = score;
        bestMatch = face;
      }
    }
  }

  if (bestMatch) {
    console.log(`Face match - Score: ${bestScore.toFixed(4)}, AxisDir: ${targetAxisDir}, Normal: [${descriptor.normal.map(n => n.toFixed(2)).join(', ')}]`);
  } else {
    console.warn(`No face match found for normal: [${descriptor.normal.map(n => n.toFixed(2)).join(', ')}], AxisDir: ${targetAxisDir}`);
  }

  return bestMatch;
}

interface FaceEditorProps {
  shape: any;
  isActive: boolean;
}

export const FaceEditor: React.FC<FaceEditorProps> = ({ shape, isActive }) => {
  const {
    hoveredFaceIndex,
    setHoveredFaceIndex,
    selectedFaceIndex,
    setSelectedFaceIndex,
    filletMode,
    selectedFilletFaces,
    addFilletFace,
    addFilletFaceData
  } = useAppStore();

  const [faces, setFaces] = useState<FaceData[]>([]);
  const [faceGroups, setFaceGroups] = useState<CoplanarFaceGroup[]>([]);
  const [hoveredGroupIndex, setHoveredGroupIndex] = useState<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;

  useFrame(() => {
    if (groupRef.current) {
      const currentShape = shapeRef.current;
      if (currentShape) {
        groupRef.current.position.set(currentShape.position[0], currentShape.position[1], currentShape.position[2]);
        groupRef.current.rotation.set(currentShape.rotation[0], currentShape.rotation[1], currentShape.rotation[2]);
        groupRef.current.scale.set(currentShape.scale[0], currentShape.scale[1], currentShape.scale[2]);
      }
    }
  });

  const geometryUuid = shape.geometry?.uuid || '';

  useEffect(() => {
    if (!shape.geometry) return;

    console.log('🔍 Extracting faces from geometry...', geometryUuid);
    const extractedFaces = extractFacesFromGeometry(shape.geometry);
    console.log(`✅ Extracted ${extractedFaces.length} faces`);

    setFaces(extractedFaces);

    const groups = groupCoplanarFaces(extractedFaces);
    console.log(`✅ Grouped into ${groups.length} coplanar face groups`);

    setFaceGroups(groups);
  }, [shape.geometry, shape.id, geometryUuid]);

  const handleFaceSelection = (groupIndex: number) => {
    if (filletMode && selectedFilletFaces.length < 2) {
      const group = faceGroups[groupIndex];
      if (group) {
        addFilletFace(groupIndex);
        addFilletFaceData({
          normal: [group.normal.x, group.normal.y, group.normal.z],
          center: [group.center.x, group.center.y, group.center.z]
        });
        console.log(`✅ Fillet face ${selectedFilletFaces.length + 1} selected:`, groupIndex);
        console.log('   Normal:', [group.normal.x.toFixed(2), group.normal.y.toFixed(2), group.normal.z.toFixed(2)]);
        console.log('   Center:', [group.center.x.toFixed(2), group.center.y.toFixed(2), group.center.z.toFixed(2)]);

        if (selectedFilletFaces.length === 1) {
          console.log('🎯 Two faces selected! Ready for fillet operation. Enter radius in terminal.');
        }
      }
    } else {
      setSelectedFaceIndex(groupIndex);
      console.log('✅ Face group selected:', groupIndex);
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isActive || faces.length === 0) return;

    e.stopPropagation();
    const faceIndex = e.faceIndex;

    if (faceIndex !== undefined) {
      const groupIndex = faceGroups.findIndex(group =>
        group.faceIndices.includes(faceIndex)
      );

      if (groupIndex !== -1) {
        setHoveredGroupIndex(groupIndex);
        setHoveredFaceIndex(faceIndex);
      }
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredGroupIndex(null);
    setHoveredFaceIndex(null);
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();

    if (e.button === 2 && hoveredGroupIndex !== null) {
      handleFaceSelection(hoveredGroupIndex);
    }
  };

  const selectedFilletGeometries = useMemo(() => {
    if (!filletMode || selectedFilletFaces.length === 0) return [];

    return selectedFilletFaces.map(faceGroupIndex => {
      const group = faceGroups[faceGroupIndex];
      if (!group) return null;
      return createFaceHighlightGeometry(faces, group.faceIndices);
    }).filter(g => g !== null);
  }, [filletMode, selectedFilletFaces, faceGroups, faces]);

  const highlightGeometry = useMemo(() => {
    if (hoveredGroupIndex === null || !faceGroups[hoveredGroupIndex]) return null;

    const group = faceGroups[hoveredGroupIndex];
    return createFaceHighlightGeometry(faces, group.faceIndices);
  }, [hoveredGroupIndex, faceGroups, faces]);

  const boundaryEdgesGeometry = useMemo(() => {
    if (faces.length === 0 || faceGroups.length === 0) return null;
    return createGroupBoundaryEdges(faces, faceGroups);
  }, [faces, faceGroups]);

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      <mesh
        geometry={shape.geometry}
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.stopPropagation()}
      />

      {selectedFilletGeometries.map((geom, idx) => (
        <mesh
          key={`selected-${idx}`}
          geometry={geom}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}

      {highlightGeometry && !selectedFilletFaces.includes(hoveredGroupIndex!) && (
        <mesh
          geometry={highlightGeometry}
        >
          <meshBasicMaterial
            color={0xff0000}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {boundaryEdgesGeometry && (
        <lineSegments
          geometry={boundaryEdgesGeometry}
        >
          <lineBasicMaterial color={0x00ffff} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
};
