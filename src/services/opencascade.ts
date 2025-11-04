import type { OpenCascadeInstance, TopoDS_Shape } from './vite-env';
import * as THREE from 'three';

export const convertThreeGeometryToOCShape = (
  oc: OpenCascadeInstance,
  geometry: THREE.BufferGeometry,
  position: THREE.Vector3 = new THREE.Vector3()
): TopoDS_Shape | null => {
  try {
    const bbox = geometry.boundingBox;
    if (!bbox) {
      geometry.computeBoundingBox();
    }

    const size = new THREE.Vector3();
    geometry.boundingBox!.getSize(size);

    const center = new THREE.Vector3();
    geometry.boundingBox!.getCenter(center);

    const box = new oc.BRepPrimAPI_MakeBox_1(size.x, size.y, size.z);
    const shape = box.Shape();

    const gp_Vec = new oc.gp_Vec_4(
      position.x + center.x - size.x / 2,
      position.y + center.y - size.y / 2,
      position.z + center.z - size.z / 2
    );
    const translation = new oc.gp_Trsf_1();
    translation.SetTranslation_1(gp_Vec);

    const transform = new oc.BRepBuilderAPI_Transform_2(shape, translation, true);
    return transform.Shape();
  } catch (error) {
    console.error('Failed to convert Three.js geometry to OpenCascade shape:', error);
    return null;
  }
};

export interface OCGeometryParams {
  type: 'box' | 'sphere' | 'cylinder' | 'cone';
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  radius2?: number;
}

export const createOCGeometry = (
  oc: OpenCascadeInstance,
  params: OCGeometryParams
): TopoDS_Shape => {
  switch (params.type) {
    case 'box': {
      const w = params.width || 600;
      const h = params.height || 600;
      const d = params.depth || 600;

      const corner = new oc.gp_Pnt_3(-w/2, -d/2, -h/2);
      const box = new oc.BRepPrimAPI_MakeBox_2(corner, w, d, h);
      const shape = box.Shape();
      console.log('✅ Box shape created successfully', { w, h, d });
      return shape;
    }

    case 'sphere': {
      const r = params.radius || 300;
      const sphere = new oc.BRepPrimAPI_MakeSphere_1(r);
      return sphere.Shape();
    }

    case 'cylinder': {
      const r = params.radius || 200;
      const h = params.height || 800;
      const cylinder = new oc.BRepPrimAPI_MakeCylinder_1(r, h);
      return cylinder.Shape();
    }

    case 'cone': {
      const r1 = params.radius || 300;
      const r2 = params.radius2 || 100;
      const h = params.height || 800;
      const cone = new oc.BRepPrimAPI_MakeCone_1(r1, r2, h);
      return cone.Shape();
    }

    default:
      throw new Error(`Unknown geometry type: ${params.type}`);
  }
};

export const convertOCShapeToThreeGeometry = (
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): THREE.BufferGeometry => {
  const mesher = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
  mesher.Perform();

  if (!mesher.IsDone()) {
    throw new Error('Failed to mesh OpenCascade shape');
  }

  const vertices: number[] = [];
  const indices: number[] = [];

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE as any,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE as any
  );

  let vertexOffset = 0;

  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triangulation = oc.BRep_Tool.Triangulation(face, location);

    if (triangulation.IsNull()) {
      explorer.Next();
      continue;
    }

    const transformation = location.Transformation();
    const numNodes = triangulation.get().NbNodes();
    const numTriangles = triangulation.get().NbTriangles();

    for (let i = 1; i <= numNodes; i++) {
      const node = triangulation.get().Node(i);
      const transformed = node.Transformed(transformation);
      vertices.push(transformed.X(), transformed.Y(), transformed.Z());
    }

    for (let i = 1; i <= numTriangles; i++) {
      const triangle = triangulation.get().Triangle(i);
      const idx1 = triangle.Value(1) - 1 + vertexOffset;
      const idx2 = triangle.Value(2) - 1 + vertexOffset;
      const idx3 = triangle.Value(3) - 1 + vertexOffset;

      if (face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED) {
        indices.push(idx1, idx3, idx2);
      } else {
        indices.push(idx1, idx2, idx3);
      }
    }

    vertexOffset += numNodes;
    explorer.Next();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
};

export const performOCBoolean = (
  oc: OpenCascadeInstance,
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape,
  operation: 'union' | 'subtract' | 'intersect'
): TopoDS_Shape => {
  if (!shape1 || !shape2) {
    throw new Error('Invalid shapes: one or both shapes are null or undefined');
  }

  if (shape1.IsNull && shape1.IsNull()) {
    throw new Error('Shape1 is null');
  }

  if (shape2.IsNull && shape2.IsNull()) {
    throw new Error('Shape2 is null');
  }

  console.log('🔧 performOCBoolean called:', {
    operation,
    shape1Type: shape1?.ShapeType?.(),
    shape2Type: shape2?.ShapeType?.(),
    shape1Valid: !shape1.IsNull(),
    shape2Valid: !shape2.IsNull()
  });

  const booleanClasses = Object.keys(oc).filter(k =>
    k.includes('BRepAlgoAPI') && (k.includes('Cut') || k.includes('Fuse') || k.includes('Common'))
  );
  console.log('📋 Available boolean classes:', booleanClasses);

  const createBooleanOp = (baseClass: string, fallbackMethod?: () => any) => {
    const variants = [
      baseClass,
      `${baseClass}_1`,
      `${baseClass}_2`,
      `${baseClass}_3`,
      `${baseClass}_4`
    ];

    for (const className of variants) {
      if (!(oc as any)[className]) continue;

      const attempts = [
        () => new (oc as any)[className](shape1, shape2),
        () => {
          const op = new (oc as any)[className]();
          op.SetArguments([shape1]);
          op.SetTools([shape2]);
          op.Build();
          return op;
        },
        () => {
          const op = new (oc as any)[className]();
          op.SetArgument(shape1);
          op.SetTool(shape2);
          op.Build();
          return op;
        }
      ];

      for (const attempt of attempts) {
        try {
          const op = attempt();
          console.log(`✅ Created ${className} successfully`);
          return op;
        } catch (err) {
          console.log(`❌ ${className} attempt failed:`, (err as Error).message);
        }
      }
    }

    if (fallbackMethod) {
      try {
        return fallbackMethod();
      } catch (err) {
        console.error('Fallback failed:', err);
      }
    }

    throw new Error(`Could not create ${baseClass} with any variant`);
  };

  switch (operation) {
    case 'union': {
      const fuse = createBooleanOp('BRepAlgoAPI_Fuse');
      if (fuse.Build && typeof fuse.Build === 'function') {
        try {
          fuse.Build();
        } catch (e) {
          console.log('Build() already called or not needed');
        }
      }
      console.log('🔧 Union IsDone:', fuse.IsDone());
      if (!fuse.IsDone()) {
        throw new Error('Boolean union failed');
      }
      return fuse.Shape();
    }

    case 'subtract': {
      console.log('🔪 Attempting to create BRepAlgoAPI_Cut...');

      try {
        const cut = new (oc as any).BRepAlgoAPI_Cut_1(shape1, shape2);
        console.log('✅ BRepAlgoAPI_Cut_1 created');

        if (cut.IsDone && typeof cut.IsDone === 'function') {
          const isDone = cut.IsDone();
          console.log('🔧 Subtract IsDone:', isDone);

          if (!isDone) {
            console.error('❌ Cut operation failed - IsDone returned false');
            throw new Error('Boolean subtract failed');
          }
        }

        const result = cut.Shape();

        if (!result || (result.IsNull && result.IsNull())) {
          throw new Error('Result shape is null');
        }

        console.log('✅ Subtract succeeded, result type:', result?.ShapeType?.());
        return result;
      } catch (error) {
        console.error('❌ BRepAlgoAPI_Cut_1 failed, trying fallback...', error);

        const cut = createBooleanOp('BRepAlgoAPI_Cut');
        if (cut.Build && typeof cut.Build === 'function') {
          try {
            cut.Build();
          } catch (e) {
            console.log('Build() already called or not needed');
          }
        }
        console.log('🔧 Subtract IsDone:', cut.IsDone());
        if (!cut.IsDone()) {
          console.error('❌ Cut operation failed');
          throw new Error('Boolean subtract failed');
        }
        const result = cut.Shape();
        console.log('✅ Subtract succeeded, result type:', result?.ShapeType?.());
        return result;
      }
    }

    case 'intersect': {
      const common = createBooleanOp('BRepAlgoAPI_Common');
      if (common.Build && typeof common.Build === 'function') {
        try {
          common.Build();
        } catch (e) {
          console.log('Build() already called or not needed');
        }
      }
      console.log('🔧 Intersect IsDone:', common.IsDone());
      if (!common.IsDone()) {
        throw new Error('Boolean intersect failed');
      }
      return common.Shape();
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
};
