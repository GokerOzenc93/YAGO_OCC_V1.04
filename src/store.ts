import { create } from 'zustand';
import * as THREE from 'three';
import type { OpenCascadeInstance } from './vite-env';
import { VertexModification } from './services/vertexEditor';

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
  isCuttingReferenceBox?: boolean;
  originalGeometry?: THREE.BufferGeometry;
  originalBounds?: { width: number; height: number; depth: number };
  baseReplicadShape?: any;
  baseShapePosition?: [number, number, number];
  baseShapeRotation?: [number, number, number];
  baseShapeScale?: [number, number, number];
  cuttingShapePosition?: [number, number, number];
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
  checkAndPerformBooleanOperations: () => Promise<void>;

  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
  secondarySelectedShapeId: string | null;
  selectSecondaryShape: (id: string | null) => void;
  createGroup: (primaryId: string, secondaryId: string) => void;
  ungroupShapes: (groupId: string) => void;

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
  updateShape: (id, updates) =>
    set((state) => {
      const shape = state.shapes.find(s => s.id === id);
      if (!shape) return state;

      const updatedShapes = state.shapes.map((s) => {
        if (s.id === id) {
          return { ...s, ...updates };
        }
        if (shape.groupId && s.groupId === shape.groupId && s.id !== id) {
          if ('position' in updates || 'rotation' in updates || 'scale' in updates) {
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
    }),
  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id && s.groupId !== id),
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
      console.log('🔄 Auto-switching to move mode on selection');
      set({ selectedShapeId: id, activeTool: Tool.MOVE });
    } else {
      set({ selectedShapeId: id });
    }
  },
  secondarySelectedShapeId: null,
  selectSecondaryShape: (id) => set({ secondarySelectedShapeId: id }),

  createGroup: (primaryId, secondaryId) => {
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
    console.log('✅ Created group:', groupId, { primaryId, secondaryId });
  },

  ungroupShapes: (groupId) => {
    set((state) => ({
      shapes: state.shapes.map((s) => {
        if (s.groupId === groupId) {
          const { groupId: _, isReferenceBox: __, ...rest } = s;
          return rest as Shape;
        }
        return s;
      }),
      selectedShapeId: null,
      secondarySelectedShapeId: null
    }));
    console.log('✅ Ungrouped:', groupId);
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

  checkAndPerformBooleanOperations: async () => {
    const state = get();
    const shapes = state.shapes;

    if (shapes.length < 2) return;

    console.log('🔍 Checking for intersecting shapes...');

    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const shape1 = shapes[i];
        const shape2 = shapes[j];

        if (!shape1.geometry || !shape2.geometry) continue;
        if (!shape1.replicadShape || !shape2.replicadShape) continue;

        const box1 = new THREE.Box3().setFromBufferAttribute(
          shape1.geometry.getAttribute('position')
        );
        const box2 = new THREE.Box3().setFromBufferAttribute(
          shape2.geometry.getAttribute('position')
        );

        box1.translate(new THREE.Vector3(...shape1.position));
        box2.translate(new THREE.Vector3(...shape2.position));

        if (box1.intersectsBox(box2)) {
          console.log('💥 Collision detected between:', shape1.id, 'and', shape2.id);

          try {
            const { performBooleanCut, convertReplicadToThreeGeometry } = await import('./services/replicad');
            const { getReplicadVertices } = await import('./services/vertexEditor');

            const resultShape = await performBooleanCut(
              shape1.replicadShape,
              shape2.replicadShape
            );

            const newGeometry = convertReplicadToThreeGeometry(resultShape);
            const newBaseVertices = await getReplicadVertices(resultShape);

            const bbox = new THREE.Box3().setFromBufferAttribute(
              newGeometry.getAttribute('position')
            );
            const size = new THREE.Vector3();
            bbox.getSize(size);

            console.log('📦 Result geometry bounding box:', {
              width: size.x,
              height: size.y,
              depth: size.z
            });

            set((state) => ({
              shapes: state.shapes.map((s) => {
                if (s.id === shape1.id) {
                  return {
                    ...s,
                    geometry: newGeometry,
                    replicadShape: resultShape,
                    originalGeometry: newGeometry.clone(),
                    originalBounds: {
                      width: Math.abs(size.x),
                      height: Math.abs(size.y),
                      depth: Math.abs(size.z)
                    },
                    parameters: {
                      ...s.parameters,
                      width: Math.abs(size.x),
                      height: Math.abs(size.y),
                      depth: Math.abs(size.z),
                      scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z]),
                      isCSGResult: true
                    }
                  };
                }
                return s;
              }).filter(s => s.id !== shape2.id)
            }));

            console.log('✅ Boolean cut applied, shape2 removed');
            return;
          } catch (error) {
            console.error('❌ Failed to perform boolean operation:', error);
          }
        }
      }
    }
  }
}));
