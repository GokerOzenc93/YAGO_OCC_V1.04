import { setOC } from 'replicad';
import initOpenCascade from 'opencascade.js';
import * as THREE from 'three';

let ocInstance: any = null;
let isInitializing = false;

export const initReplicad = async () => {
  if (ocInstance) return ocInstance;
  if (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return initReplicad();
  }

  isInitializing = true;
  try {
    console.log('🔄 Initializing OpenCascade...');
    const oc = await initOpenCascade();
    console.log('✅ OpenCascade loaded');

    console.log('🔄 Setting OpenCascade for Replicad...');
    setOC(oc);
    ocInstance = oc;
    console.log('✅ Replicad initialized with OpenCascade');
    return ocInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Replicad:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

export interface ReplicadBoxParams {
  width: number;
  height: number;
  depth: number;
}

export interface ReplicadCylinderParams {
  radius: number;
  height: number;
}

export interface ReplicadSphereParams {
  radius: number;
}

export const createReplicadBox = async (params: ReplicadBoxParams): Promise<any> => {
  const oc = await initReplicad();
  const { width, height, depth } = params;

  console.log('🔨 Creating box with replicad API...', {
    width: `${width} (X axis)`,
    height: `${height} (Y axis)`,
    depth: `${depth} (Z axis)`
  });

  const { draw } = await import('replicad');

  const boxSketch = draw()
    .movePointerTo([0, 0])
    .lineTo([width, 0])
    .lineTo([width, height])
    .lineTo([0, height])
    .close()
    .sketchOnPlane()
    .extrude(depth);

  console.log('✅ Replicad box created with origin at bottom-left-back corner');
  return boxSketch;
};

export const createReplicadCylinder = async (params: ReplicadCylinderParams): Promise<any> => {
  const oc = await initReplicad();
  const { radius, height } = params;

  console.log('🔨 Creating cylinder with replicad API...');

  const { drawCircle } = await import('replicad');
  const cylinder = drawCircle(radius)
    .sketchOnPlane()
    .extrude(height)
    .translate(radius, radius, 0);

  console.log('✅ Replicad cylinder created with origin at bottom-left-back corner:', { radius, height });
  return cylinder;
};

export const createReplicadSphere = async (params: ReplicadSphereParams): Promise<any> => {
  const oc = await initReplicad();
  const { radius } = params;

  console.log('🔨 Creating sphere with replicad API...');

  const { drawCircle } = await import('replicad');
  const sphere = drawCircle(radius)
    .sketchOnPlane()
    .revolve()
    .translate(radius, radius, radius);

  console.log('✅ Replicad sphere created with origin at bottom-left-back corner:', { radius });
  return sphere;
};

export const convertReplicadToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  try {
    console.log('🔄 Converting Replicad shape to Three.js geometry...');
    console.log('Shape object:', shape);

    const mesh = shape.mesh({ tolerance: 0.1, angularTolerance: 30 });
    console.log('Mesh data:', mesh);

    const vertices: number[] = [];
    const indices: number[] = [];

    if (mesh.vertices && mesh.triangles) {
      console.log('Raw mesh data:', {
        verticesLength: mesh.vertices.length,
        trianglesLength: mesh.triangles.length
      });

      for (let i = 0; i < mesh.vertices.length; i++) {
        vertices.push(mesh.vertices[i]);
      }

      for (let i = 0; i < mesh.triangles.length; i++) {
        indices.push(mesh.triangles[i]);
      }
    } else {
      console.error('❌ Mesh vertices or triangles missing');
      throw new Error('Invalid mesh data');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    console.log('✅ Converted Replicad shape to Three.js geometry:', {
      vertices: vertices.length / 3,
      triangles: indices.length / 3,
      boundingBox: geometry.boundingBox
    });

    return geometry;
  } catch (error) {
    console.error('❌ Failed to convert Replicad shape to Three.js geometry:', error);
    console.error('Error details:', error);
    throw error;
  }
};

export const createBoxGeometry = async (
  width: number,
  height: number,
  depth: number
): Promise<THREE.BufferGeometry> => {
  const shape = await createReplicadBox({ width, height, depth });
  return convertReplicadToThreeGeometry(shape);
};

export const createCylinderGeometry = async (
  radius: number,
  height: number
): Promise<THREE.BufferGeometry> => {
  const shape = await createReplicadCylinder({ radius, height });
  return convertReplicadToThreeGeometry(shape);
};

export const createSphereGeometry = async (
  radius: number
): Promise<THREE.BufferGeometry> => {
  const shape = await createReplicadSphere({ radius });
  return convertReplicadToThreeGeometry(shape);
};

export const performBooleanCut = async (
  baseShape: any,
  cuttingShape: any,
  basePosition?: [number, number, number],
  cuttingPosition?: [number, number, number],
  baseRotation?: [number, number, number],
  cuttingRotation?: [number, number, number],
  baseScale?: [number, number, number],
  cuttingScale?: [number, number, number],
  baseSize?: [number, number, number],
  cuttingSize?: [number, number, number]
): Promise<any> => {
  await initReplicad();

  console.log('🔪 Performing boolean cut operation...');
  console.log('Base shape (stays in local space):', baseShape);
  console.log('Cutting shape transforms:', { position: cuttingPosition, rotation: cuttingRotation, scale: cuttingScale });

  try {
    let transformedCutting = cuttingShape;

    if (cuttingScale && (cuttingScale[0] !== 1 || cuttingScale[1] !== 1 || cuttingScale[2] !== 1)) {
      console.log('📏 Scaling cutting shape by:', cuttingScale);
      transformedCutting = transformedCutting.scale(cuttingScale[0], cuttingScale[1], cuttingScale[2]);
    }

    if (cuttingRotation && (cuttingRotation[0] !== 0 || cuttingRotation[1] !== 0 || cuttingRotation[2] !== 0)) {
      console.log('🔄 Rotating cutting shape by:', cuttingRotation);
      if (cuttingRotation[0] !== 0) transformedCutting = transformedCutting.rotate(cuttingRotation[0] * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (cuttingRotation[1] !== 0) transformedCutting = transformedCutting.rotate(cuttingRotation[1] * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (cuttingRotation[2] !== 0) transformedCutting = transformedCutting.rotate(cuttingRotation[2] * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
    }

    if (cuttingPosition && (cuttingPosition[0] !== 0 || cuttingPosition[1] !== 0 || cuttingPosition[2] !== 0)) {
      console.log('📍 Translating cutting shape by relative offset:', cuttingPosition);
      transformedCutting = transformedCutting.translate(cuttingPosition[0], cuttingPosition[1], cuttingPosition[2]);
    }

    const result = baseShape.cut(transformedCutting);
    console.log('✅ Boolean cut completed:', result);

    return result;
  } catch (error) {
    console.error('❌ Boolean cut failed:', error);
    throw error;
  }
};

export const performBooleanUnion = async (
  shape1: any,
  shape2: any
): Promise<any> => {
  await initReplicad();

  console.log('🔗 Performing boolean union operation...');

  try {
    const result = shape1.fuse(shape2);
    console.log('✅ Boolean union completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Boolean union failed:', error);
    throw error;
  }
};

export const performBooleanIntersection = async (
  shape1: any,
  shape2: any
): Promise<any> => {
  await initReplicad();

  console.log('🔀 Performing boolean intersection operation...');

  try {
    const result = shape1.intersect(shape2);
    console.log('✅ Boolean intersection completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Boolean intersection failed:', error);
    throw error;
  }
};

export const createPanelFromRayProbe = async (
  replicadShape: any,
  rayProbeOrigin: [number, number, number],
  rayProbeHits: Array<{
    direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
    point: [number, number, number];
    distance: number;
  }>,
  panelThickness: number,
  shapePosition: [number, number, number],
  faceNormal: [number, number, number],
  faceCenter: [number, number, number]
): Promise<any> => {
  const oc = await initReplicad();

  const toLocal = (worldPt: [number, number, number]): [number, number, number] => [
    worldPt[0] - shapePosition[0],
    worldPt[1] - shapePosition[1],
    worldPt[2] - shapePosition[2]
  ];

  const localOrigin = toLocal(rayProbeOrigin);

  const hitsByAxis: Record<string, Array<{ dir: string; point: [number, number, number] }>> = {
    x: [], y: [], z: []
  };

  rayProbeHits.forEach(hit => {
    const axis = hit.direction[0];
    hitsByAxis[axis].push({ dir: hit.direction, point: toLocal(hit.point) });
  });

  const axisKeys = ['x', 'y', 'z'] as const;
  const hitCounts = axisKeys.map(a => hitsByAxis[a].length);
  const noHitAxes = axisKeys.filter((_, i) => hitCounts[i] === 0);

  let thicknessAxisIndex: number;

  if (noHitAxes.length === 1) {
    thicknessAxisIndex = axisKeys.indexOf(noHitAxes[0]);
  } else if (noHitAxes.length === 0) {
    const absN = faceNormal.map(Math.abs);
    thicknessAxisIndex = absN[0] > absN[1]
      ? (absN[0] > absN[2] ? 0 : 2)
      : (absN[1] > absN[2] ? 1 : 2);
  } else {
    const absN = faceNormal.map(Math.abs);
    const candidates = noHitAxes.map(a => axisKeys.indexOf(a));
    thicknessAxisIndex = candidates.reduce((best, cur) =>
      absN[cur] > absN[best] ? cur : best
    );
  }

  const boundsMin: [number, number, number] = [0, 0, 0];
  const boundsMax: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    const axis = axisKeys[i];
    const hits = hitsByAxis[axis];

    if (i === thicknessAxisIndex) {
      boundsMin[i] = localOrigin[i] - panelThickness / 2;
      boundsMax[i] = localOrigin[i] + panelThickness / 2;
    } else if (hits.length > 0) {
      const coords = hits.map(h => h.point[i]);
      boundsMin[i] = Math.min(...coords);
      boundsMax[i] = Math.max(...coords);
    } else {
      boundsMin[i] = localOrigin[i] - 5000;
      boundsMax[i] = localOrigin[i] + 5000;
    }
  }

  const faces = replicadShape.faces;

  interface FaceCandidate {
    face: any;
    dot: number;
    center: [number, number, number] | null;
    index: number;
  }

  const candidates: FaceCandidate[] = [];

  console.log(`🔍 Ray Probe Panel: Searching for matching face among ${faces.length} faces`);
  console.log(`   Target normal: [${faceNormal[0].toFixed(3)}, ${faceNormal[1].toFixed(3)}, ${faceNormal[2].toFixed(3)}]`);
  console.log(`   Target center: [${faceCenter[0].toFixed(2)}, ${faceCenter[1].toFixed(2)}, ${faceCenter[2].toFixed(2)}]`);

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    try {
      const normalVec = face.normalAt(0.5, 0.5);
      const normal = [normalVec.x, normalVec.y, normalVec.z];
      const dot =
        normal[0] * faceNormal[0] +
        normal[1] * faceNormal[1] +
        normal[2] * faceNormal[2];

      if (dot > 0.7) {
        let center: [number, number, number] | null = null;
        try {
          const faceMesh = face.mesh({ tolerance: 0.5, angularTolerance: 30 });
          if (faceMesh.vertices && faceMesh.vertices.length >= 3) {
            let sx = 0, sy = 0, sz = 0;
            const nv = faceMesh.vertices.length / 3;
            for (let j = 0; j < faceMesh.vertices.length; j += 3) {
              sx += faceMesh.vertices[j];
              sy += faceMesh.vertices[j + 1];
              sz += faceMesh.vertices[j + 2];
            }
            center = [sx / nv, sy / nv, sz / nv];
          }
        } catch (meshErr) {
          console.warn(`Could not mesh face ${i} for center:`, meshErr);
        }
        candidates.push({ face, dot, center, index: i });
        console.log(`   ✓ Face ${i}: dot=${dot.toFixed(3)}, center=${center ? `[${center[0].toFixed(2)}, ${center[1].toFixed(2)}, ${center[2].toFixed(2)}]` : 'null'}`);
      }
    } catch (err) {
      console.warn(`Could not get normal for face ${i}:`, err);
    }
  }

  let matchingFace = null;
  let matchingFaceIndex = -1;

  if (candidates.length === 0) {
    console.warn('❌ No matching face found, falling back to box');
    const { makeBaseBox } = await import('replicad');
    const sizeX = Math.max(boundsMax[0] - boundsMin[0], 0.01);
    const sizeY = Math.max(boundsMax[1] - boundsMin[1], 0.01);
    const sizeZ = Math.max(boundsMax[2] - boundsMin[2], 0.01);
    let panel = makeBaseBox(sizeX, sizeY, sizeZ);
    panel = panel.translate(
      (boundsMin[0] + boundsMax[0]) / 2,
      (boundsMin[1] + boundsMax[1]) / 2,
      (boundsMin[2] + boundsMax[2]) / 2
    );
    return panel;
  } else if (candidates.length === 1) {
    matchingFace = candidates[0].face;
    matchingFaceIndex = candidates[0].index;
    console.log(`✅ Single candidate face ${matchingFaceIndex} selected`);
  } else {
    let bestDist = Infinity;
    for (const candidate of candidates) {
      if (candidate.center) {
        const dist = Math.sqrt(
          (candidate.center[0] - faceCenter[0]) ** 2 +
          (candidate.center[1] - faceCenter[1]) ** 2 +
          (candidate.center[2] - faceCenter[2]) ** 2
        );
        if (dist < bestDist) {
          bestDist = dist;
          matchingFace = candidate.face;
          matchingFaceIndex = candidate.index;
        }
      }
    }
    if (!matchingFace) {
      matchingFace = candidates[0].face;
      matchingFaceIndex = candidates[0].index;
    }
    console.log(`✅ Best matching face ${matchingFaceIndex} selected (distance: ${bestDist.toFixed(2)})`);
  }

  try {
    const normalVec = matchingFace.normalAt(0.5, 0.5);
    console.log(`📐 Face normal: [${normalVec.x.toFixed(3)}, ${normalVec.y.toFixed(3)}, ${normalVec.z.toFixed(3)}]`);

    const extrusionDirection = [
      -normalVec.x,
      -normalVec.y,
      -normalVec.z
    ];

    const vec = new oc.gp_Vec_4(
      extrusionDirection[0] * panelThickness,
      extrusionDirection[1] * panelThickness,
      extrusionDirection[2] * panelThickness
    );

    console.log(`🔨 Extruding face by ${panelThickness}mm in direction [${extrusionDirection[0].toFixed(3)}, ${extrusionDirection[1].toFixed(3)}, ${extrusionDirection[2].toFixed(3)}]`);

    const prismBuilder = new oc.BRepPrimAPI_MakePrism_1(matchingFace.wrapped, vec, false, true);
    prismBuilder.Build(new oc.Message_ProgressRange_1());
    const solid = prismBuilder.Shape();

    const { cast, makeBaseBox } = await import('replicad');
    let panel = cast(solid);

    panel = panel.translate(
      normalVec.x * panelThickness / 2,
      normalVec.y * panelThickness / 2,
      normalVec.z * panelThickness / 2
    );
    console.log(`📍 Centered panel on face by translating ${(panelThickness / 2).toFixed(2)}mm in normal direction`);

    console.log(`📦 Ray bounds: X[${boundsMin[0].toFixed(2)}, ${boundsMax[0].toFixed(2)}], Y[${boundsMin[1].toFixed(2)}, ${boundsMax[1].toFixed(2)}], Z[${boundsMin[2].toFixed(2)}, ${boundsMax[2].toFixed(2)}]`);

    const INTERSECTION_PAD = 2.0;
    const padX = thicknessAxisIndex !== 0 ? INTERSECTION_PAD : 0;
    const padY = thicknessAxisIndex !== 1 ? INTERSECTION_PAD : 0;
    const padZ = thicknessAxisIndex !== 2 ? INTERSECTION_PAD : 0;

    const sizeX = Math.max(boundsMax[0] - boundsMin[0], 0.01) + padX * 2;
    const sizeY = Math.max(boundsMax[1] - boundsMin[1], 0.01) + padY * 2;
    const sizeZ = Math.max(boundsMax[2] - boundsMin[2], 0.01) + padZ * 2;
    const centerX = (boundsMin[0] + boundsMax[0]) / 2;
    const centerY = (boundsMin[1] + boundsMax[1]) / 2;
    const centerZ = (boundsMin[2] + boundsMax[2]) / 2;

    let boundingBox = makeBaseBox(sizeX, sizeY, sizeZ);
    boundingBox = boundingBox.translate(centerX, centerY, centerZ);

    console.log(`✂️  Performing boolean intersection (pad=${INTERSECTION_PAD}mm on planar axes)...`);
    try {
      let result = await performBooleanIntersection(panel, boundingBox);

      if (result && result.solids && result.solids.length > 1) {
        console.log(`📦 Intersection returned ${result.solids.length} solids, selecting largest...`);
        let largestSolid = result.solids[0];
        let largestVolume = 0;
        for (const solid of result.solids) {
          try {
            const bbox = solid.boundingBox;
            const vol = (bbox.max[0] - bbox.min[0]) * (bbox.max[1] - bbox.min[1]) * (bbox.max[2] - bbox.min[2]);
            if (vol > largestVolume) {
              largestVolume = vol;
              largestSolid = solid;
            }
          } catch (_) {
            // skip
          }
        }
        panel = largestSolid;
      } else {
        panel = result;
      }
      console.log(`✅ Intersection successful`);
    } catch (intersectError) {
      console.warn('⚠️  Boolean intersection with ray bounds failed, using full face panel:', intersectError);
    }

    return panel;
  } catch (error) {
    console.error('❌ Failed to create ray probe panel:', error);
    throw error;
  }
};

export const createPanelFromFace = async (
  replicadShape: any,
  faceNormal: [number, number, number],
  faceCenter: [number, number, number],
  panelThickness: number,
  constraintGeometry?: any
): Promise<any> => {
  await initReplicad();

  console.log('Creating panel from face...', {
    faceNormal,
    faceCenter,
    panelThickness,
    hasConstraint: !!constraintGeometry
  });

  try {
    const faces = replicadShape.faces;

    interface FaceCandidate {
      face: any;
      dot: number;
      center: [number, number, number] | null;
    }

    const candidates: FaceCandidate[] = [];

    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];

      try {
        const normalVec = face.normalAt(0.5, 0.5);
        const normal = [normalVec.x, normalVec.y, normalVec.z];
        const dot =
          normal[0] * faceNormal[0] +
          normal[1] * faceNormal[1] +
          normal[2] * faceNormal[2];

        if (dot > 0.7) {
          let center: [number, number, number] | null = null;
          try {
            const faceMesh = face.mesh({ tolerance: 0.5, angularTolerance: 30 });
            if (faceMesh.vertices && faceMesh.vertices.length >= 3) {
              let sx = 0, sy = 0, sz = 0;
              const nv = faceMesh.vertices.length / 3;
              for (let j = 0; j < faceMesh.vertices.length; j += 3) {
                sx += faceMesh.vertices[j];
                sy += faceMesh.vertices[j + 1];
                sz += faceMesh.vertices[j + 2];
              }
              center = [sx / nv, sy / nv, sz / nv];
            }
          } catch (meshErr) {
            console.warn(`Could not mesh face ${i} for center:`, meshErr);
          }
          candidates.push({ face, dot, center });
        }
      } catch (err) {
        console.warn(`Could not get normal for face ${i}:`, err);
      }
    }

    let matchingFace = null;

    if (candidates.length === 0) {
      console.warn('No matching face found');
      return null;
    } else if (candidates.length === 1) {
      matchingFace = candidates[0].face;
    } else {
      let bestDist = Infinity;
      for (const candidate of candidates) {
        if (candidate.center) {
          const dist = Math.sqrt(
            (candidate.center[0] - faceCenter[0]) ** 2 +
            (candidate.center[1] - faceCenter[1]) ** 2 +
            (candidate.center[2] - faceCenter[2]) ** 2
          );
          if (dist < bestDist) {
            bestDist = dist;
            matchingFace = candidate.face;
          }
        }
      }
      if (!matchingFace) {
        matchingFace = candidates[0].face;
      }
    }

    const normalVec = matchingFace.normalAt(0.5, 0.5);
    const extrusionDirection = [
      -normalVec.x,
      -normalVec.y,
      -normalVec.z
    ];

    const oc = await initReplicad();
    const vec = new oc.gp_Vec_4(
      extrusionDirection[0] * panelThickness,
      extrusionDirection[1] * panelThickness,
      extrusionDirection[2] * panelThickness
    );

    const prismBuilder = new oc.BRepPrimAPI_MakePrism_1(matchingFace.wrapped, vec, false, true);
    prismBuilder.Build(new oc.Message_ProgressRange_1());
    const solid = prismBuilder.Shape();

    const { cast } = await import('replicad');
    let panel = cast(solid);

    if (constraintGeometry) {
      try {
        panel = await performBooleanIntersection(panel, constraintGeometry);
      } catch (error) {
        console.error('Failed to apply constraint intersection:', error);
      }
    }

    return panel;
  } catch (error) {
    console.error('Failed to create panel from face:', error);
    throw error;
  }
};
