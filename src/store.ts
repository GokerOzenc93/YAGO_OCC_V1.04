import { create } from 'zustand';
import * as THREE from 'three';
import type { OpenCascadeInstance } from './vite-env';
import { VertexModification } from './components/VertexEditorService';

/**
 * ------------------------------------------------------------------
 * VERİ YAPILARI (INTERFACES)
 * ------------------------------------------------------------------
 */

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

/**
 * FaceDescriptor:
 * Geometri değişse bile face'i tanımlayabilen benzersiz imza.
 */
export interface FaceDescriptor {
  normal: [number, number, number];           // Yüzey normal vektörü
  normalizedCenter: [number, number, number]; // Merkez pozisyonu (0-1 arası, geometriye göre normalize)
  area: number;                               // Yüzey alanı
  isCurved?: boolean;                         // Fillet/curved surface mi?
  axisDirection?: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null; // Düz yüzey yönü
}

/**
 * FilletInfo:
 * Fillet (köşe yuvarlama) işleminin parametrik bilgileri.
 * Geometri büyüyüp küçüldükçe fillet yarıçapı sabit kalır.
 */
export interface FilletInfo {
  face1Descriptor: FaceDescriptor;            // Face 1'in benzersiz tanımlayıcısı
  face2Descriptor: FaceDescriptor;            // Face 2'nin benzersiz tanımlayıcısı
  face1Data: { normal: [number, number, number]; center: [number, number, number] }; // Güncel data
  face2Data: { normal: [number, number, number]; center: [number, number, number] }; // Güncel data
  radius: number;                              // Fillet yarıçapı
  originalSize: { width: number; height: number; depth: number }; // İlk uygulama zamanı boyutlar
}

/**
 * SubtractedGeometry:
 * Bir şekil başka bir şekli kestiğinde (Boolean Cut), kesen parçanın
 * bilgileri burada saklanır. Bu, işlemin geri alınabilmesi veya
 * parametrik olarak tekrar hesaplanabilmesi için kritiktir.
 */
export interface SubtractedGeometry {
  geometry: THREE.BufferGeometry;        // Kesip atan parçanın geometrisi
  relativeOffset: [number, number, number]; // Ana parçaya göre konumu (Delta)
  relativeRotation: [number, number, number]; // Ana parçaya göre dönüşü
  scale: [number, number, number];       // Ölçeği
  parameters?: SubtractionParameters;    // Parametrik ifadeler
}

export type FaceRole = 'Left' | 'Right' | 'Top' | 'Bottom' | 'Back' | 'Door' | null;

export interface VirtualFaceRaycastRecipe {
  clickLocalPoint: [number, number, number];
  faceGroupNormal: [number, number, number];
  faceGroupDescriptor: FaceDescriptor;
}

export interface VirtualFace {
  id: string;
  shapeId: string;
  normal: [number, number, number];
  center: [number, number, number];
  vertices: [number, number, number][];
  role: FaceRole;
  description: string;
  hasPanel: boolean;
  raycastRecipe?: VirtualFaceRaycastRecipe;
}

/**
 * Shape:
 * Sahnedeki her bir 3D nesnenin ana veri yapısı.
 */
export interface Shape {
  id: string;                            // Benzersiz kimlik
  type: string;                          // 'cube', 'cylinder' vb.
  position: [number, number, number];    // Dünya koordinatlarındaki konumu [x, y, z]
  rotation: [number, number, number];    // Euler açıları cinsinden dönüş [x, y, z]
  scale: [number, number, number];       // Ölçek faktörleri [x, y, z]
  geometry: THREE.BufferGeometry;        // Three.js'in görselleştirdiği mesh geometrisi
  color?: string;                        // Materyal rengi
  parameters: Record<string, any>;       // Parametrik veriler (width, height, radius vb.)
  ocShape?: any;                         // OpenCascade (CAD Kernel) ham verisi
  replicadShape?: any;                   // Replicad kütüphanesi sarmalayıcısı (Boolean işlemleri için)
  isolated?: boolean;                    // İzolasyon modu (sadece bu parça mı görünsün?)
  vertexModifications?: VertexModification[]; // Köşe noktası çekiştirmeleri
  groupId?: string;                      // Eğer bir grubun parçasıysa grup ID'si
  isReferenceBox?: boolean;              // Boolean işleminde referans kutusu mu?
  subtractionGeometries?: SubtractedGeometry[]; // Bu şekilden çıkarılmış parçaların listesi
  fillets?: FilletInfo[];                // Parametrik fillet bilgileri
  faceRoles?: Record<number, FaceRole>;  // Yüzey rolleri (indeks -> rol)
  faceDescriptions?: Record<number, string>; // Yüzey açıklamaları (indeks -> açıklama)
  facePanels?: Record<number, boolean>;  // Yüzeye panel eklenmiş mi? (indeks -> boolean)
}

/**
 * ------------------------------------------------------------------
 * ENUMS (Sabit Seçenekler)
 * Kod içinde "string" hatalarını önlemek için kullanılır.
 * ------------------------------------------------------------------
 */
export enum CameraType {
  PERSPECTIVE = 'perspective',
  ORTHOGRAPHIC = 'orthographic' // Teknik çizim görünümü
}

export enum Tool {
  SELECT = 'Select',
  MOVE = 'Move',
  ROTATE = 'Rotate',
  SCALE = 'Scale',
  POINT_TO_POINT_MOVE = 'Point to Point Move', // Noktadan noktaya hassas taşıma
  POLYLINE = 'Polyline',
  POLYLINE_EDIT = 'Polyline Edit',
  RECTANGLE = 'Rectangle',
  CIRCLE = 'Circle',
  DIMENSION = 'Dimension' // Ölçülendirme aracı
}

export enum ViewMode {
  WIREFRAME = 'wireframe', // Tel kafes
  SOLID = 'solid',         // Katı model
  XRAY = 'xray'            // Yarı saydam
}

export enum ModificationType {
  MIRROR = 'mirror',
  ARRAY = 'array',         // Çoğaltma
  FILLET = 'fillet',       // Köşe yuvarlama
  CHAMFER = 'chamfer'      // Pah kırma
}

export enum SnapType {
  ENDPOINT = 'endpoint',      // Uç nokta yakalama
  MIDPOINT = 'midpoint',      // Orta nokta yakalama
  CENTER = 'center',          // Merkez yakalama
  PERPENDICULAR = 'perpendicular', // Diklik
  INTERSECTION = 'intersection',   // Kesişim
  NEAREST = 'nearest'         // En yakın nokta
}

export enum OrthoMode {
  ON = 'on',
  OFF = 'off'
}

/**
 * ------------------------------------------------------------------
 * APP STATE (Uygulama Durumu)
 * Store'da hangi verilerin ve fonksiyonların olacağını tanımlar.
 * ------------------------------------------------------------------
 */
interface AppState {
  // Şekil Yönetimi
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  copyShape: (id: string) => void;
  
  // Gelişmiş Şekil İşlemleri
  isolateShape: (id: string) => void;
  exitIsolation: () => void;
  extrudeShape: (id: string, distance: number) => void;
  
  // *** KRİTİK: Boolean Operasyon Tetikleyicisi ***
  checkAndPerformBooleanOperations: () => Promise<void>;

  // Seçim ve Gruplama
  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
  secondarySelectedShapeId: string | null;
  selectSecondaryShape: (id: string | null) => void;
  createGroup: (primaryId: string, secondaryId: string) => void;
  ungroupShapes: (groupId: string) => void;

  // Araç ve UI Durumları
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  lastTransformTool: Tool;
  setLastTransformTool: (tool: Tool) => void;

  // Kamera ve Görünüm
  cameraType: CameraType;
  setCameraType: (type: CameraType) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;
  orthoMode: OrthoMode;
  toggleOrthoMode: () => void;

  // Yakalama (Snap) Ayarları
  snapSettings: Record<SnapType, boolean>;
  toggleSnapSetting: (snapType: SnapType) => void;

  // Diğer Yardımcılar
  modifyShape: (shapeId: string, modification: any) => void;
  pointToPointMoveState: any;
  setPointToPointMoveState: (state: any) => void;
  enableAutoSnap: (tool: Tool) => void;

  // OpenCascade (CAD Kernel) Durumu
  opencascadeInstance: OpenCascadeInstance | null;
  opencascadeLoading: boolean;
  setOpenCascadeInstance: (instance: OpenCascadeInstance | null) => void;
  setOpenCascadeLoading: (loading: boolean) => void;

  // Vertex (Nokta) Düzenleme Modu
  vertexEditMode: boolean;
  setVertexEditMode: (enabled: boolean) => void;
  selectedVertexIndex: number | null;
  setSelectedVertexIndex: (index: number | null) => void;
  vertexDirection: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null;
  setVertexDirection: (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => void;
  addVertexModification: (shapeId: string, modification: VertexModification) => void;

  // Boolean Görselleştirme (Subtraction)
  subtractionViewMode: boolean;
  setSubtractionViewMode: (enabled: boolean) => void;
  selectedSubtractionIndex: number | null;
  setSelectedSubtractionIndex: (index: number | null) => void;
  hoveredSubtractionIndex: number | null;
  setHoveredSubtractionIndex: (index: number | null) => void;
  deleteSubtraction: (shapeId: string, subtractionIndex: number) => Promise<void>;

  // Parametre Paneli
  showParametersPanel: boolean;
  setShowParametersPanel: (show: boolean) => void;

  // Outline Çizgileri
  showOutlines: boolean;
  setShowOutlines: (show: boolean) => void;

  // Role Numbers Görünümü
  showRoleNumbers: boolean;
  setShowRoleNumbers: (show: boolean) => void;

  // Selected Panel Row (Panel Editor)
  selectedPanelRow: number | null;
  selectedPanelRowExtraId: string | null;
  setSelectedPanelRow: (index: number | null, extraId?: string | null) => void;
  panelSelectMode: boolean;
  setPanelSelectMode: (enabled: boolean) => void;
  panelSurfaceSelectMode: boolean;
  setPanelSurfaceSelectMode: (enabled: boolean) => void;
  waitingForSurfaceSelection: { extraRowId: string; sourceFaceIndex: number } | null;
  setWaitingForSurfaceSelection: (waiting: { extraRowId: string; sourceFaceIndex: number } | null) => void;
  pendingPanelCreation: {
    faceIndex: number;
    timestamp: number;
    sourceGeometryShapeId?: string;
    surfaceConstraint?: {
      center: [number, number, number];
      normal: [number, number, number];
      constraintPanelId: string;
    };
  } | null;
  triggerPanelCreationForFace: (
    faceIndex: number,
    sourceGeometryShapeId?: string,
    surfaceConstraint?: {
      center: [number, number, number];
      normal: [number, number, number];
      constraintPanelId: string;
    }
  ) => void;

  // Global Settings Paneli
  showGlobalSettingsPanel: boolean;
  setShowGlobalSettingsPanel: (show: boolean) => void;

  // Face (Yüzey) Düzenleme Modu
  faceEditMode: boolean;
  setFaceEditMode: (enabled: boolean) => void;
  selectedFaceIndex: number | null;
  setSelectedFaceIndex: (index: number | null) => void;
  hoveredFaceIndex: number | null;
  setHoveredFaceIndex: (index: number | null) => void;

  // Fillet Modu
  filletMode: boolean;
  setFilletMode: (enabled: boolean) => void;
  selectedFilletFaces: number[];
  setSelectedFilletFaces: (faces: number[]) => void;
  addFilletFace: (faceIndex: number) => void;
  clearFilletFaces: () => void;
  selectedFilletFaceData: Array<{ normal: [number, number, number]; center: [number, number, number] }>;
  addFilletFaceData: (data: { normal: [number, number, number]; center: [number, number, number] }) => void;
  clearFilletFaceData: () => void;

  // Role Edit Modu
  roleEditMode: boolean;
  setRoleEditMode: (enabled: boolean) => void;
  updateFaceRole: (shapeId: string, faceIndex: number, role: FaceRole) => void;

  // Raycast Modu (Panel Editor + düğmesi)
  raycastMode: boolean;
  setRaycastMode: (enabled: boolean) => void;
  raycastResults: Array<{ origin: [number, number, number]; direction: [number, number, number]; hitPoint: [number, number, number] }>;
  setRaycastResults: (results: Array<{ origin: [number, number, number]; direction: [number, number, number]; hitPoint: [number, number, number] }>) => void;

  // Virtual Faces görünürlüğü
  showVirtualFaces: boolean;
  setShowVirtualFaces: (show: boolean) => void;

  // Virtual Faces (Raycast ile oluşturulan sanal yüzeyler)
  virtualFaces: VirtualFace[];
  addVirtualFace: (face: VirtualFace) => void;
  updateVirtualFace: (id: string, updates: Partial<VirtualFace>) => void;
  deleteVirtualFace: (id: string) => void;
  getVirtualFacesForShape: (shapeId: string) => VirtualFace[];
  recalculateVirtualFacesForShape: (shapeId: string) => void;

  // Baza Ayarları
  bazaHeight: number;
  setBazaHeight: (height: number) => void;
  frontBaseDistance: number;
  setFrontBaseDistance: (distance: number) => void;
  backBaseDistance: number;
  setBackBaseDistance: (distance: number) => void;

  // Ayak Ayarları
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

  // Back Panel Extend Ayarları
  backPanelLeftExtend: number;
  setBackPanelLeftExtend: (value: number) => void;
  showBackPanelLeftExtend: boolean;
  setShowBackPanelLeftExtend: (show: boolean) => void;
  backPanelRightExtend: number;
  setBackPanelRightExtend: (value: number) => void;
  showBackPanelRightExtend: boolean;
  setShowBackPanelRightExtend: (show: boolean) => void;

  // Back Panel Top/Bottom Extend Ayarları (Side View)
  backPanelTopExtend: number;
  setBackPanelTopExtend: (value: number) => void;
  showBackPanelTopExtend: boolean;
  setShowBackPanelTopExtend: (show: boolean) => void;
  backPanelBottomExtend: number;
  setBackPanelBottomExtend: (value: number) => void;
  showBackPanelBottomExtend: boolean;
  setShowBackPanelBottomExtend: (show: boolean) => void;

  // Side Panel Back Shorten Ayarları
  leftPanelBackShorten: number;
  setLeftPanelBackShorten: (value: number) => void;
  showLeftPanelBackShorten: boolean;
  setShowLeftPanelBackShorten: (show: boolean) => void;
  rightPanelBackShorten: number;
  setRightPanelBackShorten: (value: number) => void;
  showRightPanelBackShorten: boolean;
  setShowRightPanelBackShorten: (show: boolean) => void;

  // Side Panel Selection
  isLeftPanelSelected: boolean;
  setIsLeftPanelSelected: (selected: boolean) => void;
  isRightPanelSelected: boolean;
  setIsRightPanelSelected: (selected: boolean) => void;

  // Top/Bottom Panel Selection (Side View)
  isTopPanelSelected: boolean;
  setIsTopPanelSelected: (selected: boolean) => void;
  isBottomPanelSelected: boolean;
  setIsBottomPanelSelected: (selected: boolean) => void;

  // Top/Bottom Panel Back Shorten (Side View)
  topPanelBackShorten: number;
  setTopPanelBackShorten: (value: number) => void;
  showTopPanelBackShorten: boolean;
  setShowTopPanelBackShorten: (show: boolean) => void;
  bottomPanelBackShorten: number;
  setBottomPanelBackShorten: (value: number) => void;
  showBottomPanelBackShorten: boolean;
  setShowBottomPanelBackShorten: (show: boolean) => void;
}

/**
 * ------------------------------------------------------------------
 * STORE IMPLEMENTATION (Mantık Kodları)
 * ------------------------------------------------------------------
 */
export const useAppStore = create<AppState>((set, get) => ({
  shapes: [],

  showParametersPanel: false,
  setShowParametersPanel: (show) => set({ showParametersPanel: show }),

  showOutlines: true,
  setShowOutlines: (show) => set({ showOutlines: show }),

  showRoleNumbers: false,
  setShowRoleNumbers: (show) => set({ showRoleNumbers: show }),

  selectedPanelRow: null,
  selectedPanelRowExtraId: null,
  setSelectedPanelRow: (index, extraId) => set({ selectedPanelRow: index, selectedPanelRowExtraId: extraId || null }),
  panelSelectMode: false,
  setPanelSelectMode: (enabled) => set({ panelSelectMode: enabled, selectedPanelRow: enabled ? null : null, selectedPanelRowExtraId: null }),
  panelSurfaceSelectMode: false,
  setPanelSurfaceSelectMode: (enabled) => set({ panelSurfaceSelectMode: enabled }),
  waitingForSurfaceSelection: null,
  setWaitingForSurfaceSelection: (waiting) => set({ waitingForSurfaceSelection: waiting }),
  pendingPanelCreation: null,
  triggerPanelCreationForFace: (faceIndex, sourceGeometryShapeId, surfaceConstraint) => set({
    pendingPanelCreation: {
      faceIndex,
      timestamp: Date.now(),
      sourceGeometryShapeId,
      surfaceConstraint
    }
  }),

  showGlobalSettingsPanel: false,
  setShowGlobalSettingsPanel: (show) => set({ showGlobalSettingsPanel: show }),

  // Face (Yüzey) Düzenleme
  faceEditMode: false,
  setFaceEditMode: (enabled) => set({ faceEditMode: enabled }),
  selectedFaceIndex: null,
  setSelectedFaceIndex: (index) => set({ selectedFaceIndex: index }),
  hoveredFaceIndex: null,
  setHoveredFaceIndex: (index) => set({ hoveredFaceIndex: index }),

  // Fillet Modu
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
    console.log(`✅ Added face ${faceIndex} to fillet selection. Total: ${newFaces.length}/2`);
    return { selectedFilletFaces: newFaces };
  }),
  clearFilletFaces: () => set({ selectedFilletFaces: [], selectedFilletFaceData: [] }),
  selectedFilletFaceData: [],
  addFilletFaceData: (data) => set((state) => ({
    selectedFilletFaceData: [...state.selectedFilletFaceData, data]
  })),
  clearFilletFaceData: () => set({ selectedFilletFaceData: [] }),

  // Role Edit Modu
  roleEditMode: false,
  setRoleEditMode: (enabled) => set({ roleEditMode: enabled }),

  // Raycast Modu
  raycastMode: false,
  setRaycastMode: (enabled) => set({ raycastMode: enabled, raycastResults: enabled ? get().raycastResults : [] }),
  raycastResults: [],
  setRaycastResults: (results) => set({ raycastResults: results }),

  // Virtual Faces görünürlüğü
  showVirtualFaces: true,
  setShowVirtualFaces: (show) => set({ showVirtualFaces: show }),

  // Virtual Faces
  virtualFaces: [],
  addVirtualFace: (face) => set((state) => ({ virtualFaces: [...state.virtualFaces, face] })),
  updateVirtualFace: (id, updates) => set((state) => ({
    virtualFaces: state.virtualFaces.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  deleteVirtualFace: (id) => set((state) => ({ virtualFaces: state.virtualFaces.filter(f => f.id !== id) })),
  getVirtualFacesForShape: (shapeId) => get().virtualFaces.filter(f => f.shapeId === shapeId),
  recalculateVirtualFacesForShape: (shapeId) => {
    const state = get();
    const shape = state.shapes.find(s => s.id === shapeId);
    if (!shape) return;

    const shapeFaces = state.virtualFaces.filter(vf => vf.shapeId === shapeId);
    if (shapeFaces.length === 0) return;

    import('./components/VirtualFaceUpdateService').then(({ recalculateVirtualFacesForShape }) => {
      const currentState = get();
      const currentShape = currentState.shapes.find(s => s.id === shapeId);
      if (!currentShape) return;

      const updatedFaces = recalculateVirtualFacesForShape(currentShape, currentState.virtualFaces, currentState.shapes);
      set({ virtualFaces: updatedFaces });
    });
  },

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

  // Baza Ayarları
  bazaHeight: 100,
  setBazaHeight: (height) => set({ bazaHeight: height }),
  frontBaseDistance: 10,
  setFrontBaseDistance: (distance) => set({ frontBaseDistance: distance }),
  backBaseDistance: 30,
  setBackBaseDistance: (distance) => set({ backBaseDistance: distance }),

  // Ayak Ayarları
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

  // Back Panel Extend Ayarları
  backPanelLeftExtend: 0,
  setBackPanelLeftExtend: (value) => set({ backPanelLeftExtend: value }),
  showBackPanelLeftExtend: false,
  setShowBackPanelLeftExtend: (show) => set({ showBackPanelLeftExtend: show }),
  backPanelRightExtend: 0,
  setBackPanelRightExtend: (value) => set({ backPanelRightExtend: value }),
  showBackPanelRightExtend: false,
  setShowBackPanelRightExtend: (show) => set({ showBackPanelRightExtend: show }),

  // Back Panel Top/Bottom Extend Ayarları (Side View)
  backPanelTopExtend: 0,
  setBackPanelTopExtend: (value) => set({ backPanelTopExtend: value }),
  showBackPanelTopExtend: false,
  setShowBackPanelTopExtend: (show) => set({ showBackPanelTopExtend: show }),
  backPanelBottomExtend: 0,
  setBackPanelBottomExtend: (value) => set({ backPanelBottomExtend: value }),
  showBackPanelBottomExtend: false,
  setShowBackPanelBottomExtend: (show) => set({ showBackPanelBottomExtend: show }),

  // Side Panel Back Shorten Ayarları
  leftPanelBackShorten: 0,
  setLeftPanelBackShorten: (value) => set({ leftPanelBackShorten: value }),
  showLeftPanelBackShorten: false,
  setShowLeftPanelBackShorten: (show) => set({ showLeftPanelBackShorten: show }),
  rightPanelBackShorten: 0,
  setRightPanelBackShorten: (value) => set({ rightPanelBackShorten: value }),
  showRightPanelBackShorten: false,
  setShowRightPanelBackShorten: (show) => set({ showRightPanelBackShorten: show }),

  // Side Panel Selection
  isLeftPanelSelected: false,
  setIsLeftPanelSelected: (selected) => set({ isLeftPanelSelected: selected }),
  isRightPanelSelected: false,
  setIsRightPanelSelected: (selected) => set({ isRightPanelSelected: selected }),

  // Top/Bottom Panel Selection (Side View)
  isTopPanelSelected: false,
  setIsTopPanelSelected: (selected) => set({ isTopPanelSelected: selected }),
  isBottomPanelSelected: false,
  setIsBottomPanelSelected: (selected) => set({ isBottomPanelSelected: selected }),

  // Top/Bottom Panel Back Shorten (Side View)
  topPanelBackShorten: 0,
  setTopPanelBackShorten: (value) => set({ topPanelBackShorten: value }),
  showTopPanelBackShorten: false,
  setShowTopPanelBackShorten: (show) => set({ showTopPanelBackShorten: show }),
  bottomPanelBackShorten: 0,
  setBottomPanelBackShorten: (value) => set({ bottomPanelBackShorten: value }),
  showBottomPanelBackShorten: false,
  setShowBottomPanelBackShorten: (show) => set({ showBottomPanelBackShorten: show }),

  // Yeni şekil ekleme
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),

  // Şekil güncelleme (Pozisyon, Boyut, Rotasyon vb.)
  // BURASI ÖNEMLİ: Eğer güncellenen şekil bir grubun parçasıysa,
  // gruptaki diğer şekilleri de aynı oranda (delta) günceller.
  updateShape: (id, updates) =>
    set((state) => {
      const shape = state.shapes.find(s => s.id === id);
      if (!shape) return state;

      const updatedShapes = state.shapes.map((s) => {
        // 1. Hedef şekli güncelle
        if (s.id === id) {
          return { ...s, ...updates };
        }
        
        // 2. Grup mantığı: Eğer şekil bir gruptaysa ve hedef şekil de aynı gruptaysa
        if (shape.groupId && s.groupId === shape.groupId && s.id !== id) {
          // Sadece transformasyon güncellemelerini takip et
          if ('position' in updates || 'rotation' in updates || 'scale' in updates) {
            
            // Pozisyon Farkı (Delta)
            const positionDelta = updates.position ? [
              updates.position[0] - shape.position[0],
              updates.position[1] - shape.position[1],
              updates.position[2] - shape.position[2]
            ] : [0, 0, 0];

            // Rotasyon Farkı
            const rotationDelta = updates.rotation ? [
              updates.rotation[0] - shape.rotation[0],
              updates.rotation[1] - shape.rotation[1],
              updates.rotation[2] - shape.rotation[2]
            ] : [0, 0, 0];

            // Scale (Ölçek) Farkı - Çarpımsal hesaplanır
            const scaleDelta = updates.scale ? [
              updates.scale[0] / shape.scale[0],
              updates.scale[1] / shape.scale[1],
              updates.scale[2] / shape.scale[2]
            ] : [1, 1, 1];

            // Gruptaki diğer parçaya da bu farkları uygula
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

  // Şekil silme
  deleteShape: (id) =>
    set((state) => {
      const childPanelIds = state.shapes
        .filter(s => s.type === 'panel' && s.parameters?.parentShapeId === id)
        .map(s => s.id);

      const allIdsToDelete = new Set([id, ...childPanelIds]);

      console.log(`🗑️ Deleting shape ${id} and ${childPanelIds.length} child panels`);

      return {
        shapes: state.shapes.filter((s) => !allIdsToDelete.has(s.id)),
        selectedShapeId: allIdsToDelete.has(state.selectedShapeId || '') ? null : state.selectedShapeId,
        secondarySelectedShapeId: allIdsToDelete.has(state.secondarySelectedShapeId || '') ? null : state.secondarySelectedShapeId
      };
    }),

  // Kopyalama: Orijinal şeklin 100 birim ötesinde bir klon oluşturur
  copyShape: (id) => {
    const state = get();
    const shapeToCopy = state.shapes.find((s) => s.id === id);
    if (shapeToCopy) {
      const newShape = {
        ...shapeToCopy,
        id: `${shapeToCopy.type}-${Date.now()}`, // Benzersiz ID üret
        position: [
          shapeToCopy.position[0] + 100,
          shapeToCopy.position[1],
          shapeToCopy.position[2] + 100
        ] as [number, number, number]
      };
      set((state) => ({ shapes: [...state.shapes, newShape] }));
    }
  },

  // İzolasyon: Sadece seçili şekli göster, diğerlerini gizle
  isolateShape: (id) =>
    set((state) => ({
      shapes: state.shapes.map((s) => ({
        ...s,
        isolated: s.id !== id ? false : undefined // false = gizli, undefined = normal
      }))
    })),

  // İzolasyondan çık: Herkesi göster
  exitIsolation: () =>
    set((state) => ({
      shapes: state.shapes.map((s) => ({ ...s, isolated: undefined }))
    })),

  // 2D -> 3D Yükseltme (Extrude)
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

  // Şekil Seçimi
  selectedShapeId: null,
  selectShape: (id) => {
    const currentMode = get().activeTool;
    // Kullanıcı deneyimi: Select modundayken bir şeye tıklanırsa,
    // otomatik olarak Move moduna geç ki kullanıcı hemen taşıyabilsin.
    if (id && currentMode === Tool.SELECT) {
      console.log('🔄 Auto-switching to move mode on selection');
      set({ selectedShapeId: id, activeTool: Tool.MOVE });
    } else {
      set({ selectedShapeId: id });
    }
  },
  secondarySelectedShapeId: null,
  selectSecondaryShape: (id) => set({ secondarySelectedShapeId: id }),

  // Grup Oluşturma (Basit Etiketleme)
  // Not: Boolean işlemi artık burada yapılmıyor, aşağıda checkAndPerformBooleanOperations'da yapılıyor.
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

  // Grubu Bozma (Ungroup)
  ungroupShapes: (groupId) => {
    set((state) => ({
      shapes: state.shapes.map((s) => {
        if (s.groupId === groupId) {
          // groupId ve isReferenceBox özelliklerini temizle
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

  // --- UI ve Araç State'leri ---
  activeTool: Tool.SELECT,
  setActiveTool: (tool) => set({ activeTool: tool }),

  lastTransformTool: Tool.SELECT,
  setLastTransformTool: (tool) => set({ lastTransformTool: tool }),

  cameraType: CameraType.PERSPECTIVE,
  setCameraType: (type) => set({ cameraType: type }),

  viewMode: ViewMode.SOLID,
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Görünüm modları arasında döngü (Solid -> Wireframe -> Xray)
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

  // Snap (Yakalama) Ayarları
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

  // Placeholder fonksiyonlar
  modifyShape: (shapeId, modification) => {
    console.log('Modify shape:', shapeId, modification);
  },

  pointToPointMoveState: null,
  setPointToPointMoveState: (state) => set({ pointToPointMoveState: state }),

  enableAutoSnap: (tool) => {
    console.log('Enable auto snap for tool:', tool);
  },

  // OpenCascade (CAD Motoru) Yükleme Durumu
  opencascadeInstance: null,
  opencascadeLoading: false,
  setOpenCascadeInstance: (instance) => set({ opencascadeInstance: instance }),
  setOpenCascadeLoading: (loading) => set({ opencascadeLoading: loading }),

  // Vertex (Nokta) Düzenleme
  vertexEditMode: false,
  setVertexEditMode: (enabled) => set({ vertexEditMode: enabled }),
  selectedVertexIndex: null,
  setSelectedVertexIndex: (index) => set({ selectedVertexIndex: index }),
  vertexDirection: null,
  setVertexDirection: (direction) => set({ vertexDirection: direction }),
  
  // Vertex değişikliğini kaydetme (Geometriyi güncellemek için tetikleyici olur)
  addVertexModification: (shapeId, modification) =>
    set((state) => ({
      shapes: state.shapes.map((shape) => {
        if (shape.id !== shapeId) return shape;

        const existingMods = shape.vertexModifications || [];
        // Aynı vertex ve yön için daha önce modification varsa güncelle
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
          geometry: shape.geometry // Geometri referansını koru, renderer güncellesin
        };
      })
    })),

  subtractionViewMode: false,
  setSubtractionViewMode: (enabled) => set({ subtractionViewMode: enabled }),
  selectedSubtractionIndex: null,
  setSelectedSubtractionIndex: (index) => set({ selectedSubtractionIndex: index }),
  hoveredSubtractionIndex: null,
  setHoveredSubtractionIndex: (index) => set({ hoveredSubtractionIndex: index }),

  /**
   * ------------------------------------------------------------------
   * BOOLEAN OPERASYONLARI (OTOMATİK KESME)
   * Bu fonksiyon:
   * 1. Tüm şekilleri tarar.
   * 2. Birbiriyle çarpışan (iç içe geçen) kutuları bulur.
   * 3. Eğer çarpışma varsa Replicad/OpenCascade kullanarak boolean cut yapar.
   * 4. Sonucu günceller ve kesilen parçayı "hafızaya" (subtractionGeometries) atar.
   * ------------------------------------------------------------------
   */
  checkAndPerformBooleanOperations: async () => {
    const state = get();
    const shapes = state.shapes;

    if (shapes.length < 2) return; // En az 2 şekil lazım

    console.log('🔍 Checking for intersecting shapes...');

    // Çift döngü ile her şekli diğerleriyle karşılaştır
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const shape1 = shapes[i];
        const shape2 = shapes[j];

        // Geometri ve CAD verisi olmayanları atla
        if (!shape1.geometry || !shape2.geometry) continue;
        if (!shape1.replicadShape || !shape2.replicadShape) continue;

        // Bounding Box (Sınırlayıcı Kutu) oluştur
        const box1 = new THREE.Box3().setFromBufferAttribute(
          shape1.geometry.getAttribute('position')
        );
        const box2 = new THREE.Box3().setFromBufferAttribute(
          shape2.geometry.getAttribute('position')
        );

        // Kutuları dünya koordinatlarına taşı
        box1.translate(new THREE.Vector3(...shape1.position));
        box2.translate(new THREE.Vector3(...shape2.position));

        // Kesişim (Collision) Kontrolü
        if (box1.intersectsBox(box2)) {
          console.log('💥 Collision detected between:', shape1.id, 'and', shape2.id);

          try {
            // Replicad fonksiyonlarını dinamik import et (Performans için)
            const { performBooleanCut, convertReplicadToThreeGeometry, createReplicadBox } = await import('./components/ReplicadService');
            const { getReplicadVertices } = await import('./components/VertexEditorService');

            // --- 1. Geometrik Verileri Hazırla ---
            
            // Yerel boyutları ve merkezleri hesapla
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

            // Verileri dizi formatına çevir
            const shape1Size = [size1.x, size1.y, size1.z] as [number, number, number];
            const shape2Size = [size2.x, size2.y, size2.z] as [number, number, number];

            // Geometrilerin merkezde mi yoksa köşede mi olduğunu belirle
            const isShape1Centered = Math.abs(center1Local.x) < 0.01 &&
                                     Math.abs(center1Local.y) < 0.01 &&
                                     Math.abs(center1Local.z) < 0.01;

            const isShape2Centered = Math.abs(center2Local.x) < 0.01 &&
                                     Math.abs(center2Local.y) < 0.01 &&
                                     Math.abs(center2Local.z) < 0.01;

            const shape1OffsetX = isShape1Centered ? size1.x / 2 : 0;
            const shape1OffsetY = isShape1Centered ? size1.y / 2 : 0;
            const shape1OffsetZ = isShape1Centered ? size1.z / 2 : 0;

            const shape2OffsetX = isShape2Centered ? size2.x / 2 : 0;
            const shape2OffsetY = isShape2Centered ? size2.y / 2 : 0;
            const shape2OffsetZ = isShape2Centered ? size2.z / 2 : 0;

            const shape1Corner = [
              shape1.position[0] - shape1OffsetX,
              shape1.position[1] - shape1OffsetY,
              shape1.position[2] - shape1OffsetZ
            ] as [number, number, number];

            const shape2Corner = [
              shape2.position[0] - shape2OffsetX,
              shape2.position[1] - shape2OffsetY,
              shape2.position[2] - shape2OffsetZ
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

            console.log('📍 CRITICAL: Using RELATIVE offset for boolean cut (same as stored):', {
              shape1Corner,
              shape2Corner,
              relativeOffset,
              relativeRotation,
              note: 'This ensures consistency between initial cut and subsequent updates'
            });

            // --- 2. CAD Şekillerini Oluştur ---
            const shape1Replicad = await createReplicadBox({
              width: shape1Size[0], height: shape1Size[1], depth: shape1Size[2]
            });

            const shape2Replicad = await createReplicadBox({
              width: shape2Size[0], height: shape2Size[1], depth: shape2Size[2]
            });

            // --- 3. Boolean Cut İşlemi ---
            // Shape1'den Shape2'yi çıkar - RELATIVE offset kullan (world koordinatları DEĞİL!)
            let resultShape = await performBooleanCut(
              shape1Replicad,
              shape2Replicad,
              undefined,
              relativeOffset,
              undefined,
              relativeRotation,
              undefined,
              shape2.scale
            );

            // Sonucu Three.js geometrisine çevir
            let newGeometry = convertReplicadToThreeGeometry(resultShape);
            let newBaseVertices = await getReplicadVertices(resultShape);

            let updatedFillets = shape1.fillets || [];
            let finalResultShape = resultShape;

            if (updatedFillets.length > 0) {
              console.log('🔄 Updating fillet centers after boolean cut...');
              const { updateFilletCentersForNewGeometry, applyFillets } = await import('./components/ShapeUpdaterService');

              updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, newGeometry, {
                width: shape1Size[0],
                height: shape1Size[1],
                depth: shape1Size[2]
              });

              console.log('🔵 Reapplying fillets with updated centers...');
              finalResultShape = await applyFillets(finalResultShape, updatedFillets, {
                width: shape1Size[0],
                height: shape1Size[1],
                depth: shape1Size[2]
              });
              newGeometry = convertReplicadToThreeGeometry(finalResultShape);
              newBaseVertices = await getReplicadVertices(finalResultShape);
            }

            // --- 4. Kesilen Parçayı Hafızaya Al (History) ---
            // Shape2'nin geometrisini kopyala
            const subtractedGeometry = shape2.geometry.clone();

            console.log('🔍 Capturing subtracted geometry with local offset:', {
              shape2Id: shape2.id,
              isShape1Centered,
              isShape2Centered,
              shape1Corner,
              shape2Corner,
              relativeOffset,
              note: 'relativeOffset is LOCAL space (relative to shape1 corner)'
            });

            // --- 5. State'i Güncelle ---
            set((state) => ({
              shapes: state.shapes.map((s) => {
                // Ana şekli (Shape1) güncelle
                if (s.id === shape1.id) {
                  const existingSubtractions = s.subtractionGeometries || [];
                  return {
                    ...s,
                    geometry: newGeometry,      // Yeni kesilmiş geometri
                    replicadShape: finalResultShape, // Yeni CAD verisi
                    fillets: updatedFillets,    // Güncelleme: Yeni geometride doğru kenarlara uygulanan filletler
                    // Kesilen parçayı listeye ekle
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
              }).filter(s => s.id !== shape2.id) // Shape2'yi sahneden SİL (Çünkü artık bir boşluk oldu)
            }));

            console.log('✅ Boolean cut applied, subtracted geometry captured, shape2 removed');
            import('./components/PanelJointService').then(({ rebuildAndRecalculatePipeline }) => {
              rebuildAndRecalculatePipeline(shape1.id, null);
            });
            return;

          } catch (error) {
            console.error('❌ Failed to perform boolean operation:', error);
          }
        }
      }
    }
  },

  deleteSubtraction: async (shapeId: string, subtractionIndex: number) => {
    const state = get();
    const shape = state.shapes.find(s => s.id === shapeId);

    if (!shape || !shape.subtractionGeometries) {
      console.warn('Shape or subtractionGeometries not found');
      return;
    }

    console.log(`🗑️ Deleting subtraction #${subtractionIndex} from shape ${shapeId}`);

    const newSubtractionGeometries = [...shape.subtractionGeometries];
    newSubtractionGeometries[subtractionIndex] = null as any;

    try {
      const { performBooleanCut, convertReplicadToThreeGeometry, createReplicadBox } = await import('./components/ReplicadService');
      const { getReplicadVertices } = await import('./components/VertexEditorService');

      const baseWidth = shape.parameters?.width || 1;
      const baseHeight = shape.parameters?.height || 1;
      const baseDepth = shape.parameters?.depth || 1;

      const preservedPosition: [number, number, number] = [shape.position[0], shape.position[1], shape.position[2]];
      console.log('📍 deleteSubtraction - Using stored parameters:', { baseWidth, baseHeight, baseDepth });
      console.log('📍 deleteSubtraction - Preserving position:', preservedPosition);

      let baseShape = await createReplicadBox({
        width: baseWidth,
        height: baseHeight,
        depth: baseDepth
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
          width: subWidth,
          height: subHeight,
          depth: subDepth
        });

        baseShape = await performBooleanCut(
          baseShape,
          subShape,
          undefined,
          subtraction.relativeOffset,
          undefined,
          subtraction.relativeRotation || [0, 0, 0],
          undefined,
          subtraction.scale || [1, 1, 1]
        );
      }

      const newGeometry = convertReplicadToThreeGeometry(baseShape);
      const newBaseVertices = await getReplicadVertices(baseShape);

      let updatedFillets = shape.fillets || [];
      let finalShape = baseShape;
      let finalGeometry = newGeometry;
      let finalBaseVertices = newBaseVertices;

      if (updatedFillets.length > 0) {
        console.log('🔄 Updating fillet centers after subtraction deletion...');
        const { updateFilletCentersForNewGeometry, applyFillets } = await import('./components/ShapeUpdaterService');

        updatedFillets = await updateFilletCentersForNewGeometry(updatedFillets, newGeometry, {
          width: baseWidth,
          height: baseHeight,
          depth: baseDepth
        });

        console.log('🔵 Reapplying fillets with updated centers...');
        finalShape = await applyFillets(finalShape, updatedFillets, {
          width: baseWidth,
          height: baseHeight,
          depth: baseDepth
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

      console.log('✅ Subtraction deleted, shape updated, position preserved:', preservedPosition);
      import('./components/PanelJointService').then(({ rebuildAndRecalculatePipeline }) => {
        rebuildAndRecalculatePipeline(shapeId, null);
      });
    } catch (error) {
      console.error('❌ Failed to delete subtraction:', error);
    }
  }
}));