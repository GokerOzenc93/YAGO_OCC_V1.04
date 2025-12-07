import { create } from 'zustand';
import * as THREE from 'three';
import type { OpenCascadeInstance } from './vite-env';
import { VertexModification } from './services/vertexEditor';

export interface BooleanOperation {
  type: 'cut' | 'union' | 'intersect';
  primaryId: string;
  secondaryId: string;
  timestamp: number;
}

export interface Shape {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  geometry: THREE.BufferGeometry;
  color?: string;
  parameters: Record<string, any>;
  ocShape?: any;
  replicadShape?: any;
  isolated?: boolean;
  vertexModifications?: VertexModification[];
  groupId?: string;
  isReferenceBox?: boolean;
  booleanHistory?: BooleanOperation[];
}

export enum CameraType {
  PERSPECTIVE = 'perspective',
  ORTHOGRAPHIC = 'orthographic'
}

export enum Tool {
  SELECT = 'Select',
  MOVE = 'Move',
  ROTATE = 'Rotate',
  SCALE = 'Scale',
  POINT_TO_POINT_MOVE = 'Point to Point Move',
  POLYLINE = 'Polyline',
  POLYLINE_EDIT = 'Polyline Edit',
  RECTANGLE = 'Rectangle',
  CIRCLE = 'Circle',
  DIMENSION = 'Dimension'
}

export enum ViewMode {
  WIREFRAME = 'wireframe',
  SOLID = 'solid',
  XRAY = 'xray'
}

export enum ModificationType {
  MIRROR = 'mirror',
  ARRAY = 'array',
  FILLET = 'fillet',
  CHAMFER = 'chamfer'
}

export enum SnapType {
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  PERPENDICULAR = 'perpendicular',
  INTERSECTION = 'intersection',
  NEAREST = 'nearest'
}

export enum OrthoMode {
  ON = 'on',
  OFF = 'off'
}

interface AppState {
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  copyShape: (id: string) => void;
  isolateShape: (id: string) => void;
  exitIsolation: () => void;
  extrudeShape: (id: string, distance: number) => void;

  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
  secondarySelectedShapeId: string | null;
  selectSecondaryShape: (id: string | null) => void;
  createGroup: (primaryId: string, secondaryId: string) => Promise<void>;
  ungroupShapes: (groupId: string) => void;
  applyBooleanOperation: (primary: Shape, secondary: Shape, operation: 'cut' | 'union' | 'intersect') => Promise<any>;
  recomputeBooleanOperations: (shapeId: string) => Promise<void>;

  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  lastTransformTool: Tool;
  setLastTransformTool: (tool: Tool) => void;

  cameraType: CameraType;
  setCameraType: (type: CameraType) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;

  orthoMode: OrthoMode;
  toggleOrthoMode: () => void;

  snapSettings: Record<SnapType, boolean>;
  toggleSnapSetting: (snapType: SnapType) => void;

  modifyShape: (shapeId: string, modification: any) => void;

  pointToPointMoveState: any;
  setPointToPointMoveState: (state: any) => void;
  enableAutoSnap: (tool: Tool) => void;

  opencascadeInstance: OpenCascadeInstance | null;
  opencascadeLoading: boolean;
  setOpenCascadeInstance: (instance: OpenCascadeInstance | null) => void;
  setOpenCascadeLoading: (loading: boolean) => void;

  vertexEditMode: boolean;
  setVertexEditMode: (enabled: boolean) => void;
  selectedVertexIndex: number | null;
  setSelectedVertexIndex: (index: number | null) => void;
  vertexDirection: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null;
  setVertexDirection: (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => void;
  addVertexModification: (shapeId: string, modification: VertexModification) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  shapes: [],
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
  updateShape: (id, updates) => {
    const shape = get().shapes.find(s => s.id === id);
    if (!shape) return;

    const hasParameterChanges = 'parameters' in updates || 'scale' in updates;
    const hasTransformChanges = 'position' in updates || 'rotation' in updates || 'scale' in updates;

    set((state) => {
      const updatedShapes = state.shapes.map((s) => {
        if (s.id === id) {
          return { ...s, ...updates };
        }
        if (shape.groupId && s.groupId === shape.groupId && s.id !== id) {
          if (hasTransformChanges) {
            const positionDelta = updates.position ? [
              updates.position[0] - shape.position[0],
              updates.position[1] - shape.position[1],
              updates.position[2] - shape.position[2]
            ] : [0, 0, 0];
            const rotationDelta = updates.rotation ? [
              updates.rotation[0] - shape.rotation[0],
              updates.rotation[1] - shape.rotation[1],
              updates.rotation[2] - shape.rotation[2]
            ] : [0, 0, 0];
            const scaleDelta = updates.scale ? [
              updates.scale[0] / shape.scale[0],
              updates.scale[1] / shape.scale[1],
              updates.scale[2] / shape.scale[2]
            ] : [1, 1, 1];

            return {
              ...s,
              position: [
                s.position[0] + positionDelta[0],
                s.position[1] + positionDelta[1],
                s.position[2] + positionDelta[2]
              ] as [number, number, number],
              rotation: [
                s.rotation[0] + rotationDelta[0],
                s.rotation[1] + rotationDelta[1],
                s.rotation[2] + rotationDelta[2]
              ] as [number, number, number],
              scale: [
                s.scale[0] * scaleDelta[0],
                s.scale[1] * scaleDelta[1],
                s.scale[2] * scaleDelta[2]
              ] as [number, number, number]
            };
          }
        }
        return s;
      });

      return { shapes: updatedShapes };
    });

    if (hasParameterChanges && shape.booleanHistory && shape.booleanHistory.length > 0) {
      console.log(`🔄 Parameters changed, recomputing boolean operations for shape ${id}`);
      get().recomputeBooleanOperations(id);
    }

    if (hasParameterChanges && shape.isReferenceBox && shape.groupId) {
      const primaryShape = get().shapes.find(s => s.groupId === shape.groupId && !s.isReferenceBox);
      if (primaryShape && primaryShape.booleanHistory && primaryShape.booleanHistory.length > 0) {
        console.log(`🔄 Reference shape changed, recomputing boolean operations for primary shape ${primaryShape.id}`);
        get().recomputeBooleanOperations(primaryShape.id);
      }
    }
  },
  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId
    })),

  copyShape: (id) => {
    const state = get();
    const shapeToCopy = state.shapes.find((s) => s.id === id);
    if (shapeToCopy) {
      const newShape = {
        ...shapeToCopy,
        id: `${shapeToCopy.type}-${Date.now()}`,
        position: [
          shapeToCopy.position[0] + 100,
          shapeToCopy.position[1],
          shapeToCopy.position[2] + 100
        ] as [number, number, number]
      };
      set((state) => ({ shapes: [...state.shapes, newShape] }));
    }
  },

  isolateShape: (id) =>
    set((state) => ({
      shapes: state.shapes.map((s) => ({
        ...s,
        isolated: s.id !== id ? false : undefined
      }))
    })),

  exitIsolation: () =>
    set((state) => ({
      shapes: state.shapes.map((s) => ({ ...s, isolated: undefined }))
    })),

  extrudeShape: (id, distance) =>
    set((state) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) return state;

      const { extrudeGeometry } = require('./services/csg');
      const extrudedGeometry = extrudeGeometry(shape.geometry, distance);

      return {
        shapes: state.shapes.map((s) =>
          s.id === id
            ? { ...s, geometry: extrudedGeometry }
            : s
        )
      };
    }),

  selectedShapeId: null,
  selectShape: (id) => {
    const currentMode = get().activeTool;
    if (id && currentMode === Tool.SELECT) {
      set({ selectedShapeId: id, activeTool: Tool.MOVE });
    } else {
      set({ selectedShapeId: id });
    }
  },
  secondarySelectedShapeId: null,
  selectSecondaryShape: (id) => set({ secondarySelectedShapeId: id }),

  createGroup: async (primaryId, secondaryId) => {
    const state = get();
    const primaryShape = state.shapes.find(s => s.id === primaryId);
    const secondaryShape = state.shapes.find(s => s.id === secondaryId);

    if (!primaryShape || !secondaryShape) {
      console.error('Cannot create group: shapes not found');
      return;
    }

    if (!primaryShape.replicadShape || !secondaryShape.replicadShape) {
      console.error('Cannot create group: shapes missing replicadShape');
      return;
    }

    const groupId = `group-${Date.now()}`;

    try {
      const resultShape = await get().applyBooleanOperation(primaryShape, secondaryShape, 'cut');

      if (!resultShape) {
        throw new Error('Boolean operation failed');
      }

      const { convertReplicadToThreeGeometry } = await import('./services/replicad');
      const { getReplicadVertices } = await import('./services/vertexEditor');

      const newGeometry = convertReplicadToThreeGeometry(resultShape);
      const newBaseVertices = await getReplicadVertices(resultShape);

      const booleanOp: BooleanOperation = {
        type: 'cut',
        primaryId,
        secondaryId,
        timestamp: Date.now()
      };

      set((state) => ({
        shapes: state.shapes.map((s) => {
          if (s.id === primaryId) {
            return {
              ...s,
              groupId,
              geometry: newGeometry,
              replicadShape: resultShape,
              booleanHistory: [booleanOp],
              parameters: {
                ...s.parameters,
                scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
              }
            };
          }
          if (s.id === secondaryId) {
            return { ...s, groupId, isReferenceBox: true };
          }
          return s;
        })
      }));

      console.log('✅ Group created with boolean cut applied');
    } catch (error) {
      console.error('Failed to create group with cut:', error);
      const groupId = `group-${Date.now()}`;
      set((state) => ({
        shapes: state.shapes.map((s) => {
          if (s.id === primaryId) {
            return { ...s, groupId };
          }
          if (s.id === secondaryId) {
            return { ...s, groupId, isReferenceBox: true };
          }
          return s;
        })
      }));
    }
  },

  ungroupShapes: (groupId) => {
    set((state) => ({
      shapes: state.shapes.map((s) => {
        if (s.groupId === groupId) {
          const { groupId: _, isReferenceBox: __, booleanHistory: ___, ...rest } = s;
          return rest as Shape;
        }
        return s;
      }),
      selectedShapeId: null,
      secondarySelectedShapeId: null
    }));
  },

  activeTool: Tool.SELECT,
  setActiveTool: (tool) => set({ activeTool: tool }),

  lastTransformTool: Tool.SELECT,
  setLastTransformTool: (tool) => set({ lastTransformTool: tool }),

  cameraType: CameraType.PERSPECTIVE,
  setCameraType: (type) => set({ cameraType: type }),

  viewMode: ViewMode.SOLID,
  setViewMode: (mode) => set({ viewMode: mode }),
  cycleViewMode: () => {
    const state = get();
    const modes = [ViewMode.SOLID, ViewMode.WIREFRAME, ViewMode.XRAY];
    const currentIndex = modes.indexOf(state.viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    set({ viewMode: modes[nextIndex] });
  },

  orthoMode: OrthoMode.OFF,
  toggleOrthoMode: () =>
    set((state) => ({
      orthoMode: state.orthoMode === OrthoMode.ON ? OrthoMode.OFF : OrthoMode.ON
    })),

  snapSettings: {
    [SnapType.ENDPOINT]: false,
    [SnapType.MIDPOINT]: false,
    [SnapType.CENTER]: false,
    [SnapType.PERPENDICULAR]: false,
    [SnapType.INTERSECTION]: false,
    [SnapType.NEAREST]: false
  },
  toggleSnapSetting: (snapType) =>
    set((state) => ({
      snapSettings: {
        ...state.snapSettings,
        [snapType]: !state.snapSettings[snapType]
      }
    })),

  modifyShape: (shapeId, modification) => {
    console.log('Modify shape:', shapeId, modification);
  },

  pointToPointMoveState: null,
  setPointToPointMoveState: (state) => set({ pointToPointMoveState: state }),

  enableAutoSnap: (tool) => {
    console.log('Enable auto snap for tool:', tool);
  },

  opencascadeInstance: null,
  opencascadeLoading: false,
  setOpenCascadeInstance: (instance) => set({ opencascadeInstance: instance }),
  setOpenCascadeLoading: (loading) => set({ opencascadeLoading: loading }),

  vertexEditMode: false,
  setVertexEditMode: (enabled) => set({ vertexEditMode: enabled }),
  selectedVertexIndex: null,
  setSelectedVertexIndex: (index) => set({ selectedVertexIndex: index }),
  vertexDirection: null,
  setVertexDirection: (direction) => set({ vertexDirection: direction }),
  addVertexModification: (shapeId, modification) =>
    set((state) => ({
      shapes: state.shapes.map((shape) => {
        if (shape.id !== shapeId) return shape;

        const existingMods = shape.vertexModifications || [];
        const existingIndex = existingMods.findIndex(
          m => m.vertexIndex === modification.vertexIndex && m.direction === modification.direction
        );

        let newMods;
        if (existingIndex >= 0) {
          newMods = [...existingMods];
          newMods[existingIndex] = modification;
        } else {
          newMods = [...existingMods, modification];
        }

        console.log(`🔧 Vertex modification added for shape ${shapeId}, triggering geometry update`);

        return {
          ...shape,
          vertexModifications: newMods,
          geometry: shape.geometry
        };
      })
    })),

  applyBooleanOperation: async (primary: Shape, secondary: Shape, operation: 'cut' | 'union' | 'intersect') => {
    if (!primary.replicadShape || !secondary.replicadShape) {
      throw new Error('Shapes missing replicadShape');
    }

    const getBoundingBoxCenter = (shape: any, shapeParams: any) => {
      try {
        const bbox = shape.boundingBox();
        return [
          (bbox.max.x + bbox.min.x) / 2,
          (bbox.max.y + bbox.min.y) / 2,
          (bbox.max.z + bbox.min.z) / 2
        ];
      } catch {
        const size = [
          shapeParams?.width || 0,
          shapeParams?.height || 0,
          shapeParams?.depth || 0
        ];
        return [size[0] / 2, size[1] / 2, size[2] / 2];
      }
    };

    const transformToWorld = (shape: any, center: number[], position: number[], rotation: number[], scale: number[]) => {
      let transformed = shape;

      transformed = transformed.translate(center[0], center[1], center[2]);

      if (scale[0] !== 1 || scale[1] !== 1 || scale[2] !== 1) {
        transformed = transformed.scale(scale[0], scale[1], scale[2]);
      }

      if (rotation[0] !== 0) transformed = transformed.rotate(rotation[0] * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (rotation[1] !== 0) transformed = transformed.rotate(rotation[1] * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (rotation[2] !== 0) transformed = transformed.rotate(rotation[2] * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);

      transformed = transformed.translate(
        position[0] - center[0] * scale[0],
        position[1] - center[1] * scale[1],
        position[2] - center[2] * scale[2]
      );

      return transformed;
    };

    const primaryCenter = getBoundingBoxCenter(primary.replicadShape, primary.parameters);
    const secondaryCenter = getBoundingBoxCenter(secondary.replicadShape, secondary.parameters);

    let primaryInWorld = transformToWorld(
      primary.replicadShape,
      primaryCenter,
      primary.position,
      primary.rotation,
      primary.scale
    );

    let secondaryInWorld = transformToWorld(
      secondary.replicadShape,
      secondaryCenter,
      secondary.position,
      secondary.rotation,
      secondary.scale
    );

    let result;
    switch (operation) {
      case 'cut':
        result = primaryInWorld.cut(secondaryInWorld);
        break;
      case 'union':
        result = primaryInWorld.fuse(secondaryInWorld);
        break;
      case 'intersect':
        result = primaryInWorld.intersect(secondaryInWorld);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const transformBackToLocal = (shape: any, center: number[], position: number[], rotation: number[], scale: number[]) => {
      let transformed = shape;

      transformed = transformed.translate(
        -(position[0] - center[0] * scale[0]),
        -(position[1] - center[1] * scale[1]),
        -(position[2] - center[2] * scale[2])
      );

      if (rotation[2] !== 0) transformed = transformed.rotate(-rotation[2] * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
      if (rotation[1] !== 0) transformed = transformed.rotate(-rotation[1] * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (rotation[0] !== 0) transformed = transformed.rotate(-rotation[0] * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);

      if (scale[0] !== 1 || scale[1] !== 1 || scale[2] !== 1) {
        transformed = transformed.scale(1 / scale[0], 1 / scale[1], 1 / scale[2]);
      }

      transformed = transformed.translate(-center[0], -center[1], -center[2]);

      return transformed;
    };

    result = transformBackToLocal(result, primaryCenter, primary.position, primary.rotation, primary.scale);

    return result;
  },

  recomputeBooleanOperations: async (shapeId: string) => {
    const shape = get().shapes.find(s => s.id === shapeId);

    if (!shape || !shape.booleanHistory || shape.booleanHistory.length === 0) {
      return;
    }

    console.log(`🔄 Recomputing boolean operations for ${shapeId}`);
    console.log(`📐 Current parameters:`, shape.parameters);

    try {
      const { convertReplicadToThreeGeometry } = await import('./services/replicad');
      const { getReplicadVertices } = await import('./services/vertexEditor');
      const { createReplicadShape } = await import('./services/replicad');

      let resultShape = await createReplicadShape(shape.type, shape.parameters);
      console.log(`✅ Created fresh base shape with parameters`);

      for (const operation of shape.booleanHistory) {
        const secondaryShape = get().shapes.find(s => s.id === operation.secondaryId);
        if (!secondaryShape || !secondaryShape.replicadShape) {
          console.warn(`❌ Cannot find secondary shape ${operation.secondaryId} for boolean operation`);
          continue;
        }

        console.log(`🔨 Applying ${operation.type} with secondary:`, secondaryShape.parameters);

        const currentPrimary = get().shapes.find(s => s.id === shapeId);
        if (!currentPrimary) continue;

        const tempPrimary = { ...currentPrimary, replicadShape: resultShape };
        resultShape = await get().applyBooleanOperation(tempPrimary, secondaryShape, operation.type);
        console.log(`✅ Boolean ${operation.type} completed`);
      }

      const newGeometry = convertReplicadToThreeGeometry(resultShape);
      const newBaseVertices = await getReplicadVertices(resultShape);

      set((state) => ({
        shapes: state.shapes.map((s) => {
          if (s.id === shapeId) {
            return {
              ...s,
              geometry: newGeometry,
              replicadShape: resultShape,
              parameters: {
                ...s.parameters,
                scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
              }
            };
          }
          return s;
        })
      }));

      console.log(`✅ Boolean operations recomputed for shape ${shapeId}`);
    } catch (error) {
      console.error('Failed to recompute boolean operations:', error);
    }
  }
}));
