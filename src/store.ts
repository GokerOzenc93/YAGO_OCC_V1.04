import { create } from 'zustand';
import * as THREE from 'three';
import type { OpenCascadeInstance } from './vite-env';
import { VertexModification } from './services/vertexEditor';

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
 * FilletInfo:
 * Fillet (köşe yuvarlama) işleminin parametrik bilgileri.
 * Geometri büyüyüp küçüldükçe fillet yarıçapı sabit kalır.
 */
export interface FilletInfo {
  face1Data: { normal: [number, number, number]; center: [number, number, number] };
  face2Data: { normal: [number, number, number]; center: [number, number, number] };
  radius: number; // Mutlak yarıçap değeri (scale'den bağımsız)
  originalSize: { width: number; height: number; depth: number }; // Filletin uygulandığı zamanki boyutlar
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
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      // Eğer silinen şekil seçiliyse, seçimi kaldır
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId
    })),

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
            const { performBooleanCut, convertReplicadToThreeGeometry, createReplicadBox } = await import('./services/replicad');
            const { getReplicadVertices } = await import('./services/vertexEditor');

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

            // DÜZELTME: Merkez hesaplamasına Scale ve Rotation eklendi
            // Eğer objeler döndürülmüşse veya köşeden scale edilmişse,
            // sadece yerel merkezi pozisyona eklemek yanlış olur.
            // Yerel merkezi de döndürüp scale etmemiz gerekir.

            // Shape 1 için Merkez Hesabı
            const center1Vec = center1Local.clone();
            center1Vec.multiply(new THREE.Vector3(...shape1.scale)); // Scale uygula
            center1Vec.applyEuler(new THREE.Euler(...shape1.rotation)); // Rotasyon uygula
            const shape1Center = [
              shape1.position[0] + center1Vec.x,
              shape1.position[1] + center1Vec.y,
              shape1.position[2] + center1Vec.z
            ] as [number, number, number];

            // Shape 2 için Merkez Hesabı
            const center2Vec = center2Local.clone();
            center2Vec.multiply(new THREE.Vector3(...shape2.scale)); // Scale uygula
            center2Vec.applyEuler(new THREE.Euler(...shape2.rotation)); // Rotasyon uygula
            const shape2Center = [
              shape2.position[0] + center2Vec.x,
              shape2.position[1] + center2Vec.y,
              shape2.position[2] + center2Vec.z
            ] as [number, number, number];

            // Debug log
            console.log('📏 Using actual geometry data (Corrected Center):', {
               shape1: { id: shape1.id, center: shape1Center },
               shape2: { id: shape2.id, center: shape2Center }
            });

            // --- 2. CAD Şekillerini Oluştur ---
            const shape1Replicad = await createReplicadBox({
              width: shape1Size[0], height: shape1Size[1], depth: shape1Size[2]
            });

            const shape2Replicad = await createReplicadBox({
              width: shape2Size[0], height: shape2Size[1], depth: shape2Size[2]
            });

            // --- 3. Boolean Cut İşlemi ---
            // Shape1'den Shape2'yi çıkar
            let resultShape = await performBooleanCut(
              shape1Replicad,
              shape2Replicad,
              shape1Center as [number, number, number],
              shape2Center as [number, number, number],
              shape1.rotation,
              shape2.rotation,
              shape1.scale,
              shape2.scale,
              shape1Size,
              shape2Size
            );

            // Shape1'de fillet varsa, yeniden uygula
            if (shape1.fillets && shape1.fillets.length > 0) {
              console.log('🔵 Reapplying fillets after boolean cut...');
              const { applyFillets } = await import('./services/shapeUpdater');
              resultShape = await applyFillets(resultShape, shape1.fillets, {
                width: shape1Size[0],
                height: shape1Size[1],
                depth: shape1Size[2]
              });
            }

            // Sonucu Three.js geometrisine çevir
            const newGeometry = convertReplicadToThreeGeometry(resultShape);
            const newBaseVertices = await getReplicadVertices(resultShape);

            // --- 4. Kesilen Parçayı Hafızaya Al (History) ---
            // Shape2'nin geometrisini kopyala
            const subtractedGeometry = shape2.geometry.clone();

            // Shape2'nin geometrisi merkezde mi kontrol et (Three.js boxlar genelde merkezdedir)
            const isShape2Centered = Math.abs(center2Local.x) < 0.01 &&
                                     Math.abs(center2Local.y) < 0.01 &&
                                     Math.abs(center2Local.z) < 0.01;

            // Eğer merkezdeyse, pozisyonu (Center) temsil eder. Bizim (Corner) offsete ihtiyacımız var.
            // O yüzden yarım boy (size2 / 2) ÇIKARIYORUZ.
            const offsetAdjustmentX = isShape2Centered ? size2.x / 2 : 0;
            const offsetAdjustmentY = isShape2Centered ? size2.y / 2 : 0;
            const offsetAdjustmentZ = isShape2Centered ? size2.z / 2 : 0;

            // Shape2'nin Shape1'e göre bağıl konumunu hesapla (Sol-alt-arka köşe bazlı)
            const relativeOffset = [
              (shape2.position[0] - offsetAdjustmentX) - shape1.position[0],
              (shape2.position[1] - offsetAdjustmentY) - shape1.position[1],
              (shape2.position[2] - offsetAdjustmentZ) - shape1.position[2]
            ] as [number, number, number];

            const relativeRotation = [
              shape2.rotation[0] - shape1.rotation[0],
              shape2.rotation[1] - shape1.rotation[1],
              shape2.rotation[2] - shape1.rotation[2]
            ] as [number, number, number];

            console.log('🔍 Capturing subtracted geometry with corrected offset:', {
              shape2Id: shape2.id,
              isShape2Centered,
              shape2Size,
              offsetAdjustment: [offsetAdjustmentX, offsetAdjustmentY, offsetAdjustmentZ],
              shape2Position: shape2.position,
              shape1Position: shape1.position,
              relativeOffset,
              note: 'relativeOffset is now corner-based (bottom-left-back), Scene.tsx will handle centering'
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
                    replicadShape: resultShape, // Yeni CAD verisi
                    fillets: s.fillets,         // Fillet bilgilerini koru
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
            return; // İlk başarılı işlemde çık (Tek seferde tek işlem)

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
      const { performBooleanCut, convertReplicadToThreeGeometry, createReplicadBox } = await import('./services/replicad');
      const { getReplicadVertices } = await import('./services/vertexEditor');
      const { applyFillets } = await import('./services/shapeUpdater');

      const box = new THREE.Box3().setFromBufferAttribute(
        shape.geometry.getAttribute('position')
      );
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      let baseShape = await createReplicadBox({
        width: size.x,
        height: size.y,
        depth: size.z
      });

      for (let i = 0; i < newSubtractionGeometries.length; i++) {
        const subtraction = newSubtractionGeometries[i];
        if (!subtraction) continue;

        const subBox = new THREE.Box3().setFromBufferAttribute(
          subtraction.geometry.getAttribute('position')
        );
        const subSize = new THREE.Vector3();
        subBox.getSize(subSize);

        const subShape = await createReplicadBox({
          width: subSize.x,
          height: subSize.y,
          depth: subSize.z
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

      if (shape.fillets && shape.fillets.length > 0) {
        console.log('🔵 Reapplying fillets after subtraction deletion...');
        baseShape = await applyFillets(baseShape, shape.fillets, {
          width: size.x,
          height: size.y,
          depth: size.z
        });
      }

      const newGeometry = convertReplicadToThreeGeometry(baseShape);
      const newBaseVertices = await getReplicadVertices(baseShape);

      set((state) => ({
        shapes: state.shapes.map((s) => {
          if (s.id === shapeId) {
            return {
              ...s,
              geometry: newGeometry,
              replicadShape: baseShape,
              subtractionGeometries: newSubtractionGeometries,
              parameters: {
                ...s.parameters,
                scaledBaseVertices: newBaseVertices.map(v => [v.x, v.y, v.z])
              }
            };
          }
          return s;
        }),
        selectedSubtractionIndex: null
      }));

      console.log('✅ Subtraction deleted and shape updated');
    } catch (error) {
      console.error('❌ Failed to delete subtraction:', error);
    }
  }
}));