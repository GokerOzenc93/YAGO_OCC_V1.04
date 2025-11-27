import { create } from 'zustand';
import * as THREE from 'three';

export enum Tool {
  SELECT = 'Select',
  MOVE = 'Move',
  ROTATE = 'Rotate',
  SCALE = 'Scale',
  POINT_TO_POINT_MOVE = 'PointToPointMove',
  POLYLINE = 'Polyline',
  POLYLINE_EDIT = 'PolylineEdit',
  DIMENSION = 'Dimension',
}

export enum CameraType {
  PERSPECTIVE = 'perspective',
  ORTHOGRAPHIC = 'orthographic',
}

export enum ModificationType {
  MIRROR = 'mirror',
  ARRAY = 'array',
  FILLET = 'fillet',
  CHAMFER = 'chamfer',
}

export enum ViewMode {
  SOLID = 'solid',
  WIREFRAME = 'wireframe',
  XRAY = 'xray',
}

export enum OrthoMode {
  ON = 'on',
  OFF = 'off',
}

export enum SnapType {
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  PERPENDICULAR = 'perpendicular',
  INTERSECTION = 'intersection',
  NEAREST = 'nearest',
}

interface PointToPointMoveState {
  isActive: boolean;
  selectedShapeId: string | null;
  sourcePoint: [number, number, number] | null;
  targetPoint: [number, number, number] | null;
}

interface VertexModification {
  vertexIndex: number;
  originalPosition: [number, number, number];
  newPosition: [number, number, number];
  direction: string;
  expression: string;
  description: string;
  offset: [number, number, number];
}

interface SubtractionGeometry {
  geometry: THREE.BufferGeometry;
  relativeOffset: [number, number, number];
  relativeRotation: [number, number, number];
  scale: [number, number, number];
}

export interface Shape {
  id: string;
  type: string;
  geometry: THREE.BufferGeometry;
  replicadShape?: any;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  parameters?: any;
  vertexModifications?: VertexModification[];
  groupId?: string;
  isReferenceBox?: boolean;
  isolated?: boolean;
  subtractionGeometries?: SubtractionGeometry[];
}

interface AppState {
  shapes: Shape[];
  selectedShapeId: string | null;
  secondarySelectedShapeId: string | null;
  activeTool: Tool;
  lastTransformTool: Tool;
  cameraType: CameraType;
  viewMode: ViewMode;
  orthoMode: OrthoMode;
  snapSettings: Record<SnapType, boolean>;
  opencascadeLoading: boolean;
  opencascadeInstance: any;
  pointToPointMoveState: PointToPointMoveState;
  vertexEditMode: boolean;
  selectedVertexIndex: number | null;
  vertexDirection: string | null;
  subtractionViewMode: boolean;
  hoveredSubtractionIndex: number | null;
  selectedSubtractionIndex: number | null;

  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  selectShape: (id: string | null) => void;
  selectSecondaryShape: (id: string | null) => void;
  setActiveTool: (tool: Tool) => void;
  setLastTransformTool: (tool: Tool) => void;
  setCameraType: (type: CameraType) => void;
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;
  toggleOrthoMode: () => void;
  toggleSnapSetting: (type: SnapType) => void;
  modifyShape: (id: string, modification: any) => void;
  extrudeShape: (id: string, height: number) => void;
  setOpencascadeLoading: (loading: boolean) => void;
  setOpencascadeInstance: (instance: any) => void;
  copyShape: (id: string) => void;
  setPointToPointMoveState: (state: Partial<PointToPointMoveState>) => void;
  enableAutoSnap: (tool: Tool) => void;
  createGroup: (shapeId1: string, shapeId2: string) => void;
  ungroupShapes: (groupId: string) => void;
  isolateShape: (id: string) => void;
  exitIsolation: () => void;
  setVertexEditMode: (mode: boolean) => void;
  setSelectedVertexIndex: (index: number | null) => void;
  setVertexDirection: (direction: string | null) => void;
  addVertexModification: (shapeId: string, modification: VertexModification) => void;
  setSubtractionViewMode: (mode: boolean) => void;
  setHoveredSubtractionIndex: (index: number | null) => void;
  setSelectedSubtractionIndex: (index: number | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  shapes: [],
  selectedShapeId: null,
  secondarySelectedShapeId: null,
  activeTool: Tool.SELECT,
  lastTransformTool: Tool.MOVE,
  cameraType: CameraType.PERSPECTIVE,
  viewMode: ViewMode.SOLID,
  orthoMode: OrthoMode.OFF,
  snapSettings: {
    [SnapType.ENDPOINT]: false,
    [SnapType.MIDPOINT]: false,
    [SnapType.CENTER]: false,
    [SnapType.PERPENDICULAR]: false,
    [SnapType.INTERSECTION]: false,
    [SnapType.NEAREST]: false,
  },
  opencascadeLoading: false,
  opencascadeInstance: null,
  pointToPointMoveState: {
    isActive: false,
    selectedShapeId: null,
    sourcePoint: null,
    targetPoint: null,
  },
  vertexEditMode: false,
  selectedVertexIndex: null,
  vertexDirection: null,
  subtractionViewMode: false,
  hoveredSubtractionIndex: null,
  selectedSubtractionIndex: null,

  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),

  updateShape: (id, updates) =>
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        shape.id === id ? { ...shape, ...updates } : shape
      ),
    })),

  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((shape) => shape.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
    })),

  selectShape: (id) => set({ selectedShapeId: id }),

  selectSecondaryShape: (id) => set({ secondarySelectedShapeId: id }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setLastTransformTool: (tool) => set({ lastTransformTool: tool }),

  setCameraType: (type) => set({ cameraType: type }),

  setViewMode: (mode) => set({ viewMode: mode }),

  cycleViewMode: () =>
    set((state) => {
      const modes = [ViewMode.SOLID, ViewMode.WIREFRAME, ViewMode.XRAY];
      const currentIndex = modes.indexOf(state.viewMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { viewMode: modes[nextIndex] };
    }),

  toggleOrthoMode: () =>
    set((state) => ({
      orthoMode: state.orthoMode === OrthoMode.ON ? OrthoMode.OFF : OrthoMode.ON,
    })),

  toggleSnapSetting: (type) =>
    set((state) => ({
      snapSettings: {
        ...state.snapSettings,
        [type]: !state.snapSettings[type],
      },
    })),

  modifyShape: (id, modification) => {
    console.log('modifyShape called:', { id, modification });
  },

  extrudeShape: (id, height) => {
    console.log('extrudeShape called:', { id, height });
  },

  setOpencascadeLoading: (loading) => set({ opencascadeLoading: loading }),

  setOpencascadeInstance: (instance) => set({ opencascadeInstance: instance }),

  copyShape: (id) => {
    const state = get();
    const shape = state.shapes.find((s) => s.id === id);
    if (shape) {
      const newShape = {
        ...shape,
        id: `${shape.type}-${Date.now()}`,
        position: [
          shape.position[0] + 100,
          shape.position[1],
          shape.position[2] + 100,
        ] as [number, number, number],
      };
      set((state) => ({ shapes: [...state.shapes, newShape] }));
    }
  },

  setPointToPointMoveState: (state) =>
    set((prevState) => ({
      pointToPointMoveState: { ...prevState.pointToPointMoveState, ...state },
    })),

  enableAutoSnap: (tool) => {
    if (tool === Tool.POINT_TO_POINT_MOVE) {
      set({
        snapSettings: {
          [SnapType.ENDPOINT]: true,
          [SnapType.MIDPOINT]: true,
          [SnapType.CENTER]: true,
          [SnapType.PERPENDICULAR]: false,
          [SnapType.INTERSECTION]: true,
          [SnapType.NEAREST]: false,
        },
      });
    }
  },

  createGroup: (shapeId1, shapeId2) => {
    const groupId = `group-${Date.now()}`;
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        shape.id === shapeId1 || shape.id === shapeId2
          ? { ...shape, groupId }
          : shape
      ),
      secondarySelectedShapeId: null,
    }));
  },

  ungroupShapes: (groupId) => {
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        shape.groupId === groupId ? { ...shape, groupId: undefined } : shape
      ),
    }));
  },

  isolateShape: (id) => {
    set((state) => ({
      shapes: state.shapes.map((shape) => ({
        ...shape,
        isolated: shape.id === id ? undefined : false,
      })),
    }));
  },

  exitIsolation: () => {
    set((state) => ({
      shapes: state.shapes.map((shape) => ({
        ...shape,
        isolated: undefined,
      })),
    }));
  },

  setVertexEditMode: (mode) => set({ vertexEditMode: mode }),

  setSelectedVertexIndex: (index) => set({ selectedVertexIndex: index }),

  setVertexDirection: (direction) => set({ vertexDirection: direction }),

  addVertexModification: (shapeId, modification) => {
    set((state) => ({
      shapes: state.shapes.map((shape) => {
        if (shape.id === shapeId) {
          const existingMods = shape.vertexModifications || [];
          const filteredMods = existingMods.filter(
            (mod) => mod.vertexIndex !== modification.vertexIndex
          );
          return {
            ...shape,
            vertexModifications: [...filteredMods, modification],
          };
        }
        return shape;
      }),
    }));
  },

  setSubtractionViewMode: (mode) => set({ subtractionViewMode: mode }),

  setHoveredSubtractionIndex: (index) => set({ hoveredSubtractionIndex: index }),

  setSelectedSubtractionIndex: (index) => set({ selectedSubtractionIndex: index }),
}));
