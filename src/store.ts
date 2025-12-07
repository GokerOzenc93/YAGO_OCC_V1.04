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
      const { convertReplicadToThreeGeometry } = await import('./services/replicad');
      const { getReplicadVertices } = await import('./services/vertexEditor');

      const primarySize = [
        primaryShape.parameters?.width || 0,
        primaryShape.parameters?.height || 0,
        primaryShape.parameters?.depth || 0
      ] as [number, number, number];

      const secondarySize = [
        secondaryShape.parameters?.width || 0,
        secondaryShape.parameters?.height || 0,
        secondaryShape.parameters?.depth || 0
      ] as [number, number, number];

      const primaryLocalCenter = [
        primarySize[0] / 2,
        primarySize[1] / 2,
        primarySize[2] / 2
      ];

      const secondaryLocalCenter = [
        secondarySize[0] / 2,
        secondarySize[1] / 2,
        secondarySize[2] / 2
      ];

      const primaryCenter = [
        primaryShape.position[0] + primaryLocalCenter[0],
        primaryShape.position[1] + primaryLocalCenter[1],
        primaryShape.position[2] + primaryLocalCenter[2]
      ];

      const secondaryCenter = [
        secondaryShape.position[0] + secondaryLocalCenter[0],
        secondaryShape.position[1] + secondaryLocalCenter[1],
        secondaryShape.position[2] + secondaryLocalCenter[2]
      ];

      let primaryInWorld = primaryShape.replicadShape;
      let secondaryInWorld = secondaryShape.replicadShape;

      const [psx, psy, psz] = primaryShape.scale;
      const [prx, pry, prz] = primaryShape.rotation;
      const [pcx, pcy, pcz] = primaryCenter;

      const [ssx, ssy, ssz] = secondaryShape.scale;
      const [srx, sry, srz] = secondaryShape.rotation;
      const [scx, scy, scz] = secondaryCenter;

      if (psx !== 1 || psy !== 1 || psz !== 1) primaryInWorld = primaryInWorld.scale(psx, psy, psz);
      if (prx !== 0) primaryInWorld = primaryInWorld.rotate(prx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (pry !== 0) primaryInWorld = primaryInWorld.rotate(pry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (prz !== 0) primaryInWorld = primaryInWorld.rotate(prz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
      if (pcx !== 0 || pcy !== 0 || pcz !== 0) primaryInWorld = primaryInWorld.translate(pcx, pcy, pcz);

      if (ssx !== 1 || ssy !== 1 || ssz !== 1) secondaryInWorld = secondaryInWorld.scale(ssx, ssy, ssz);
      if (srx !== 0) secondaryInWorld = secondaryInWorld.rotate(srx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (sry !== 0) secondaryInWorld = secondaryInWorld.rotate(sry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (srz !== 0) secondaryInWorld = secondaryInWorld.rotate(srz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
      if (scx !== 0 || scy !== 0 || scz !== 0) secondaryInWorld = secondaryInWorld.translate(scx, scy, scz);

      let resultShape = primaryInWorld.cut(secondaryInWorld);

      if (pcx !== 0 || pcy !== 0 || pcz !== 0) resultShape = resultShape.translate(-pcx, -pcy, -pcz);
      if (prz !== 0) resultShape = resultShape.rotate(-prz * (180 / Math.PI), [0, 0, 0], [0, 0, 1]);
      if (pry !== 0) resultShape = resultShape.rotate(-pry * (180 / Math.PI), [0, 0, 0], [0, 1, 0]);
      if (prx !== 0) resultShape = resultShape.rotate(-prx * (180 / Math.PI), [0, 0, 0], [1, 0, 0]);
      if (psx !== 1 || psy !== 1 || psz !== 1) resultShape = resultShape.scale(1/psx, 1/psy, 1/psz);

      const newGeometry = convertReplicadToThreeGeometry(resultShape);
      const newBaseVertices = await getReplicadVertices(resultShape);

      set((state) => ({
        shapes: state.shapes.map((s) => {
          if (s.id === primaryId) {
            return {
              ...s,
              groupId,
              geometry: newGeometry,
              replicadShape: resultShape,
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
          const { groupId: _, isReferenceBox: __, ...rest } = s;
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
    }))
}));
