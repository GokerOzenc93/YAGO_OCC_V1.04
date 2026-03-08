import { create } from 'zustand';
import * as THREE from 'three';
import type { OpenCascadeInstance } from './vite-env';
import { VertexModification } from './components/VertexEditorService';

export interface SubtractionParameters {
  width: string;
  height: string;
  depth: string;
  posX: string;
  posY: string;
  posZ: string;
  rotX: string;
  rotY: string;
  rotZ: string;
}

export interface FaceDescriptor {
  normal: [number, number, number];
  normalizedCenter: [number, number, number];
  area: number;
  isCurved?: boolean;
  axisDirection?: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null;
}

export interface FilletInfo {
  face1Descriptor: FaceDescriptor;
  face2Descriptor: FaceDescriptor;
  face1Data: { normal: [number, number, number]; center: [number, number, number] };
  face2Data: { normal: [number, number, number]; center: [number, number, number] };
  radius: number;
  originalSize: { width: number; height: number; depth: number };
}

export interface SubtractedGeometry {
  geometry: THREE.BufferGeometry;
  relativeOffset: [number, number, number];
  relativeRotation: [number, number, number];
  scale: [number, number, number];
  parameters?: SubtractionParameters;
}

export type FaceRole = 'Left' | 'Right' | 'Top' | 'Bottom' | 'Back' | 'Door' | null;

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
  subtractionGeometries?: SubtractedGeometry[];
  fillets?: FilletInfo[];
  faceRoles?: Record<number, FaceRole>;
  faceDescriptions?: Record<number, string>;
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

  subtractionViewMode: boolean;
  setSubtractionViewMode: (enabled: boolean) => void;
  selectedSubtractionIndex: number | null;
  setSelectedSubtractionIndex: (index: number | null) => void;
  hoveredSubtractionIndex: number | null;
  setHoveredSubtractionIndex: (index: number | null) => void;
  deleteSubtraction: (shapeId: string, subtractionIndex: number) => Promise<void>;

  showParametersPanel: boolean;
  setShowParametersPanel: (show: boolean) => void;

  showOutlines: boolean;
  setShowOutlines: (show: boolean) => void;

  showGlobalSettingsPanel: boolean;
  setShowGlobalSettingsPanel: (show: boolean) => void;

  faceEditMode: boolean;
  setFaceEditMode: (enabled: boolean) => void;
  selectedFaceIndex: number | null;
  setSelectedFaceIndex: (index: number | null) => void;
  hoveredFaceIndex: number | null;
  setHoveredFaceIndex: (index: number | null) => void;

  filletMode: boolean;
  setFilletMode: (enabled: boolean) => void;
  selectedFilletFaces: number[];
  setSelectedFilletFaces: (faces: number[]) => void;
  addFilletFace: (faceIndex: number) => void;
  clearFilletFaces: () => void;
  selectedFilletFaceData: Array<{ normal: [number, number, number]; center: [number, number, number] }>;
  addFilletFaceData: (data: { normal: [number, number, number]; center: [number, number, number] }) => void;
  clearFilletFaceData: () => void;

  roleEditMode: boolean;
  setRoleEditMode: (enabled: boolean) => void;
  updateFaceRole: (shapeId: string, faceIndex: number, role: FaceRole) => void;

  bazaHeight: number;
  setBazaHeight: (height: number) => void;
  frontBaseDistance: number;
  setFrontBaseDistance: (distance: number) => void;
  backBaseDistance: number;
  setBackBaseDistance: (distance: number) => void;

  legHeight: number;
  setLegHeight: (height: number) => void;
  legDiameter: number;
  setLegDiameter: (diameter: number) => void;
  legFrontDistance: number;
  setLegFrontDistance: (distance: number) => void;
  legBackDistance: number;
  setLegBackDistance: (distance: number) => void;
  legSideDistance: number;
  setLegSideDistance: (distance: number) => void;

  backPanelLeftExtend: number;
  setBackPanelLeftExtend: (value: number) => void;
  showBackPanelLeftExtend: boolean;
  setShowBackPanelLeftExtend: (show: boolean) => void;
  backPanelRightExtend: number;
  setBackPanelRightExtend: (value: number) => void;
  showBackPanelRightExtend: boolean;
  setShowBackPanelRightExtend: (show: boolean) => void;

  backPanelTopExtend: number;
  setBackPanelTopExtend: (value: number) => void;
  showBackPanelTopExtend: boolean;
  setShowBackPanelTopExtend: (show: boolean) => void;
  backPanelBottomExtend: number;
  setBackPanelBottomExtend: (value: number) => void;
  showBackPanelBottomExtend: boolean;
  setShowBackPanelBottomExtend: (show: boolean) => void;

  leftPanelBackShorten: number;
  setLeftPanelBackShorten: (value: number) => void;
  showLeftPanelBackShorten: boolean;
  setShowLeftPanelBackShorten: (show: boolean) => void;
  rightPanelBackShorten: number;
  setRightPanelBackShorten: (value: number) => void;
  showRightPanelBackShorten: boolean;
  setShowRightPanelBackShorten: (show: boolean) => void;

  isLeftPanelSelected: boolean;
  setIsLeftPanelSelected: (selected: boolean) => void;
  isRightPanelSelected: boolean;
  setIsRightPanelSelected: (selected: boolean) => void;

  isTopPanelSelected: boolean;
  setIsTopPanelSelected: (selected: boolean) => void;
  isBottomPanelSelected: boolean;
  setIsBottomPanelSelected: (selected: boolean) => void;

  topPanelBackShorten: number;
  setTopPanelBackShorten: (value: number) => void;
  showTopPanelBackShorten: boolean;
  setShowTopPanelBackShorten: (show: boolean) => void;
  bottomPanelBackShorten: number;
  setBottomPanelBackShorten: (value: number) => void;
  showBottomPanelBackShorten: boolean;
  setShowBottomPanelBackShorten: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  shapes: [],

  showParametersPanel: false,
  setShowParametersPanel: (show) => set({ showParametersPanel: show }),

  showOutlines: true,
  setShowOutlines: (show) => set({ showOutlines: show }),

  showGlobalSettingsPanel: false,
  setShowGlobalSettingsPanel: (show) => set({ showGlobalSettingsPanel: show }),

  faceEditMode: false,
  setFaceEditMode: (enabled) => set({ faceEditMode: enabled }),
  selectedFaceIndex: null,
  setSelectedFaceIndex: (index) => set({ selectedFaceIndex: index }),
  hoveredFaceIndex: null,
  setHoveredFaceIndex: (index) => set({ hoveredFaceIndex: index }),

  filletMode: false,
  setFilletMode: (enabled) => set({
    filletMode: enabled,
    selectedFilletFaces: enabled ? [] : [],
    selectedFilletFaceData: enabled ? [] : []
  }),
  selectedFilletFaces: [],
  setSelectedFilletFaces: (faces) => set({ selectedFilletFaces: faces }),
  addFilletFace: (faceIndex) => set((state) => {
    if (state.selectedFilletFaces.includes(faceIndex)) return state;
    const newFaces = [...state.selectedFilletFaces, faceIndex];
    return { selectedFilletFaces: newFaces };
  }),
  clearFilletFaces: () => set({ selectedFilletFaces: [], selectedFilletFaceData: [] }),
  selectedFilletFaceData: [],
  addFilletFaceData: (data) => set((state) => ({
    selectedFilletFaceData: [...state.selectedFilletFaceData, data]
  })),
  clearFilletFaceData: () => set({ selectedFilletFaceData: [] }),

  roleEditMode: false,
  setRoleEditMode: (enabled) => set({ roleEditMode: enabled }),

  updateFaceRole: (shapeId, faceIndex, role) => set((state) => ({
    shapes: state.shapes.map((shape) => {
      if (shape.id !== shapeId) return shape;
      const existingRoles = shape.faceRoles || {};
      return {
        ...shape,
        faceRoles: {
          ...existingRoles,
          [faceIndex]: role
        }
      };
    })
  })),

  bazaHeight: 100,
  setBazaHeight: (height) => set({ bazaHeight: height }),
  frontBaseDistance: 10,
  setFrontBaseDistance: (distance) => set({ frontBaseDistance: distance }),
  backBaseDistance: 30,
  setBackBaseDistance: (distance) => set({ backBaseDistance: distance }),

  legHeight: 100,
  setLegHeight: (height) => set({ legHeight: height }),
  legDiameter: 25,
  setLegDiameter: (diameter) => set({ legDiameter: diameter }),
  legFrontDistance: 30,
  setLegFrontDistance: (distance) => set({ legFrontDistance: distance }),
  legBackDistance: 30,
  setLegBackDistance: (distance) => set({ legBackDistance: distance }),
  legSideDistance: 30,
  setLegSideDistance: (distance) => set({ legSideDistance: distance }),

  backPanelLeftExtend: 0,
  setBackPanelLeftExtend: (value) => set({ backPanelLeftExtend: value }),
  showBackPanelLeftExtend: false,
  setShowBackPanelLeftExtend: (show) => set({ showBackPanelLeftExtend: show }),
  backPanelRightExtend: 0,
  setBackPanelRightExtend: (value) => set({ backPanelRightExtend: value }),
  showBackPanelRightExtend: false,
  setShowBackPanelRightExtend: (show) => set({ showBackPanelRightExtend: show }),

  backPanelTopExtend: 0,
  setBackPanelTopExtend: (value) => set({ backPanelTopExtend: value }),
  showBackPanelTopExtend: false,
  setShowBackPanelTopExtend: (show) => set({ showBackPanelTopExtend: show }),
  backPanelBottomExtend: 0,
  setBackPanelBottomExtend: (value) => set({ backPanelBottomExtend: value }),
  showBackPanelBottomExtend: false,
  setShowBackPanelBottomExtend: (show) => set({ showBackPanelBottomExtend: show }),

  leftPanelBackShorten: 0,
  setLeftPanelBackShorten: (value) => set({ leftPanelBackShorten: value }),
  showLeftPanelBackShorten: false,
  setShowLeftPanelBackShorten: (show) => set({ showLeftPanelBackShorten: show }),
  rightPanelBackShorten: 0,
  setRightPanelBackShorten: (value) => set({ rightPanelBackShorten: value }),
  showRightPanelBackShorten: false,
  setShowRightPanelBackShorten: (show) => set({ showRightPanelBackShorten: show }),

  isLeftPanelSelected: false,
  setIsLeftPanelSelected: (selected) => set({ isLeftPanelSelected: selected }),
  isRightPanelSelected: false,
  setIsRightPanelSelected: (selected) => set({ isRightPanelSelected: selected }),

  isTopPanelSelected: false,
  setIsTopPanelSelected: (selected) => set({ isTopPanelSelected: selected }),
  isBottomPanelSelected: false,
  setIsBottomPanelSelected: (selected) => set({ isBottomPanelSelected: selected }),

  topPanelBackShorten: 0,
  setTopPanelBackShorten: (value) => set({ topPanelBackShorten: value }),
  showTopPanelBackShorten: false,
  setShowTopPanelBackShorten: (show) => set({ showTopPanelBackShorten: show }),
  bottomPanelBackShorten: 0,
  setBottomPanelBackShorten: (value) => set({ bottomPanelBackShorten: value }),
  showBottomPanelBackShorten: false,
  setShowBottomPanelBackShorten: (show) => set({ showBottomPanelBackShorten: show }),

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
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
      secondarySelectedShapeId: state.secondarySelectedShapeId === id ? null : state.secondarySelectedShapeId
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

        return {
          ...shape,
          vertexModifications: newMods,
          geometry: shape.geometry
        };
      })
    })),

  subtractionViewMode: false,
  setSubtractionViewMode: (enabled) => set({ subtractionViewMode: enabled }),
  selectedSubtractionIndex: null,
  setSelectedSubtractionIndex: (index) => set({ selectedSubtractionIndex: index }),
  hoveredSubtractionIndex: null,
  setHoveredSubtractionIndex: (index) => set({ hoveredSubtractionIndex: index }),

  checkAndPerformBooleanOperations: async () => {
    const state = get();
    const shapes = state.shapes;

    if (shapes.length < 2) return;

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
          try {
            const { performBooleanCut, convertReplicadToThreeGeometry, createReplicadBox } = await import('./components/ReplicadService');
            const { getReplicadVertices } = await import('./components/VertexEditorService');

            const box1Local = new THREE.Box3().setFromBufferAttribute(
              shape1.geometry.getAttribute('position')
            );
            const size1 = new THREE.Vector3();
            const center1Local = new THREE.Vector3();
            box1Local.getSize(size1);
            box1Local.getCenter(center1Local);

            const box2Local = new THREE.Box3().setFromBufferAttribute(
              shape2.geometry.getAttribute('position')
            );
            const size2 = new THREE.Vector3();
            const center2Local = new THREE.Vector3();
            box2Local.getSize(size2);
            box2Local.getCenter(center2Local);

            const shape1Size = [size1.x, size1.y, size1.z] as [number, number, number];
            const shape2Size = [size2.x, size2.y, size2.z] as [number, number, number];

            const isShape1Centered = Math.abs(center1Local.x) < 0.01 &&
                                     Math.abs(center1Local.y) < 0.01 &&
                                     Math.abs(center1Local.z) < 0.01;

            const isShape2Centered = Math.abs(center2Local.x) < 0.01 &&
                                     Math.abs(center2Local.y) < 0.01 &&
                                     Math.abs(center2Local.z) < 0.01;

            const shape1Corner = [
              shape1.position[0] - (isShape1Centered ? size1.x / 2 : 0),
              shape1.position[1] - (isShape1Centered ? size1.y / 2 : 0),
              shape1.position[2] - (isShape1Centered ? size1.z / 2 : 0)
            ] as [number, number, number];

            const shape2Corner = [
              shape2.position[0] - (isShape2Centered ? size2.x / 2 : 0),
              shape2.position[1] - (isShape2Centered ? size2.y / 2 : 0),
              shape2.position[2] - (isShape2Centered ? size2.z / 2 : 0)
            ] as [number, number, number];

            const relativeOffset = [
              shape2Corner[0] - shape1Corner[0],
              shape2Corner[1] - shape1Corner[1],
              shape2Corner[2] - shape1Corner[2]
            ] as [number, number, number];

            const relativeRotation = [
              shape2.rotation[0] - shape1.rotation[0],
              shape2.rotation[1] - shape1.rotation[1],
              shape2.rotation[2] - shape1.rotation[2]
            ] as [number, number, number];

            const shape1Replicad = await createReplicadBox({
              width: shape1Size[0], height: shape1Size[1], depth: shape1Size[2]
            });

            const shape2Replicad = await createReplicadBox({
              width: shape2Size[0], height: shape2Size[1], depth: shape2Size[2]
            });

            let resultShape = await performBooleanCut(
              shape1Replicad, shape2Replicad,
              undefined, relativeOffset,
              undefined, relativeRotation,
              undefined, shape2.scale
            );

            let newGeometry = convertReplicadToThreeGeometry(resultShape);
            let newBaseVertices = await getReplicadVertices(resultShape);

            let updatedFillets = shape1.fillets || [];
            let finalResultShape = resultShape;

            if (updatedFillets.length > 0) {
              const { updateFilletCentersForNewGeometry, applyFillets } = await import('./components/ShapeUpdaterService');

              updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, newGeometry, {
                width: shape1Size[0], height: shape1Size[1], depth: shape1Size[2]
              });

              finalResultShape = await applyFillets(finalResultShape, updatedFillets, {
                width: shape1Size[0], height: shape1Size[1], depth: shape1Size[2]
              });
              newGeometry = convertReplicadToThreeGeometry(finalResultShape);
              newBaseVertices = await getReplicadVertices(finalResultShape);
            }

            const subtractedGeometry = shape2.geometry.clone();

            set((state) => ({
              shapes: state.shapes.map((s) => {
                if (s.id === shape1.id) {
                  const existingSubtractions = s.subtractionGeometries || [];
                  return {
                    ...s,
                    geometry: newGeometry,
                    replicadShape: finalResultShape,
                    fillets: updatedFillets,
                    subtractionGeometries: [
                      ...existingSubtractions,
                      {
                        geometry: subtractedGeometry,
                        relativeOffset,
                        relativeRotation,
                        scale: [1, 1, 1] as [number, number, number],
                        parameters: {
                          width: String(shape2Size[0]),
                          height: String(shape2Size[1]),
                          depth: String(shape2Size[2]),
                          posX: String(relativeOffset[0]),
                          posY: String(relativeOffset[1]),
                          posZ: String(relativeOffset[2]),
                          rotX: String(relativeRotation[0] * (180 / Math.PI)),
                          rotY: String(relativeRotation[1] * (180 / Math.PI)),
                          rotZ: String(relativeRotation[2] * (180 / Math.PI))
                        }
                      }
                    ],
                    parameters: {
                      ...s.parameters,
                      scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
                    }
                  };
                }
                return s;
              }).filter(s => s.id !== shape2.id)
            }));

            return;
          } catch (error) {
            console.error('Failed to perform boolean operation:', error);
          }
        }
      }
    }
  },

  deleteSubtraction: async (shapeId: string, subtractionIndex: number) => {
    const state = get();
    const shape = state.shapes.find(s => s.id === shapeId);

    if (!shape || !shape.subtractionGeometries) return;

    const newSubtractionGeometries = [...shape.subtractionGeometries];
    newSubtractionGeometries[subtractionIndex] = null as any;

    try {
      const { performBooleanCut, convertReplicadToThreeGeometry, createReplicadBox } = await import('./components/ReplicadService');
      const { getReplicadVertices } = await import('./components/VertexEditorService');

      const baseWidth = shape.parameters?.width || 1;
      const baseHeight = shape.parameters?.height || 1;
      const baseDepth = shape.parameters?.depth || 1;

      const preservedPosition: [number, number, number] = [shape.position[0], shape.position[1], shape.position[2]];

      let baseShape = await createReplicadBox({
        width: baseWidth, height: baseHeight, depth: baseDepth
      });

      for (let i = 0; i < newSubtractionGeometries.length; i++) {
        const subtraction = newSubtractionGeometries[i];
        if (!subtraction) continue;

        let subWidth, subHeight, subDepth;
        if (subtraction.parameters) {
          subWidth = parseFloat(subtraction.parameters.width) || 1;
          subHeight = parseFloat(subtraction.parameters.height) || 1;
          subDepth = parseFloat(subtraction.parameters.depth) || 1;
        } else {
          const subBox = new THREE.Box3().setFromBufferAttribute(
            subtraction.geometry.getAttribute('position')
          );
          const subSize = new THREE.Vector3();
          subBox.getSize(subSize);
          subWidth = subSize.x;
          subHeight = subSize.y;
          subDepth = subSize.z;
        }

        const subShape = await createReplicadBox({
          width: subWidth, height: subHeight, depth: subDepth
        });

        baseShape = await performBooleanCut(
          baseShape, subShape,
          undefined, subtraction.relativeOffset,
          undefined, subtraction.relativeRotation || [0, 0, 0],
          undefined, subtraction.scale || [1, 1, 1]
        );
      }

      const newGeometry = convertReplicadToThreeGeometry(baseShape);
      const newBaseVertices = await getReplicadVertices(baseShape);

      let updatedFillets = shape.fillets || [];
      let finalShape = baseShape;
      let finalGeometry = newGeometry;
      let finalBaseVertices = newBaseVertices;

      if (updatedFillets.length > 0) {
        const { updateFilletCentersForNewGeometry, applyFillets } = await import('./components/ShapeUpdaterService');

        updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, newGeometry, {
          width: baseWidth, height: baseHeight, depth: baseDepth
        });

        finalShape = await applyFillets(finalShape, updatedFillets, {
          width: baseWidth, height: baseHeight, depth: baseDepth
        });
        finalGeometry = convertReplicadToThreeGeometry(finalShape);
        finalBaseVertices = await getReplicadVertices(finalShape);
      }

      set((state) => ({
        shapes: state.shapes.map((s) => {
          if (s.id === shapeId) {
            return {
              ...s,
              geometry: finalGeometry,
              replicadShape: finalShape,
              subtractionGeometries: newSubtractionGeometries,
              fillets: updatedFillets,
              position: preservedPosition,
              parameters: {
                ...s.parameters,
                scaledBaseVertices: finalBaseVertices.map(v => [v.x, v.y, v.z])
              }
            };
          }
          return s;
        }),
        selectedSubtractionIndex: null
      }));
    } catch (error) {
      console.error('Failed to delete subtraction:', error);
    }
  }
}));
