# Intersection Detection ve Parametric Update Sistemi

Bu sistem, Replicad ile oluşturulan 3D geometrilerin kesişim tespiti, parametrik state yönetimi ve otomatik model güncellemesi için geliştirilmiştir.

## Özellikler

### 1. Kesişim Tespiti (Intersection Detection)
- İki geometri arasındaki kesişim alanını hesaplar
- Kesişim hacmini (volume) tespit eder
- Kesişim geometrisini 3D olarak görselleştirir

### 2. Parametrik State Yönetimi
- Kesişim sonuçları parametrik objeler olarak saklanır
- Volume, surface area, bounding box, center of mass gibi özellikler
- Zustand store ile global state yönetimi

### 3. UI Entegrasyonu
- ParametersPanel üzerinden kesişim parametreleri görüntülenir
- Toolbar'da intersection compute butonu
- Otomatik model güncelleme

## Kullanım

### Adım 1: İki Geometri Seçme

```typescript
// İlk geometriyi seç (normal tıklama)
// İkinci geometriyi Ctrl+Tıklama ile seç

// Scene.tsx içinde:
onClick={(e) => {
  e.stopPropagation();
  if (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) {
    selectSecondaryShape(shape.id);
  } else {
    selectShape(shape.id);
  }
}}
```

### Adım 2: Kesişim Hesaplama

```typescript
// Toolbar'daki Intersection butonuna tıklayın
// Veya programatik olarak:

const { computeIntersectionForShapes } = useAppStore();
await computeIntersectionForShapes(shape1Id, shape2Id);
```

### Adım 3: Kesişim Geometrisini Görüntüleme

Sistem otomatik olarak:
1. Kesişim geometrisini hesaplar (Replicad `intersect()`)
2. Three.js geometrisine dönüştürür
3. Sahneye yeşil renkli bir shape olarak ekler
4. Parametreleri store'da saklar

### Adım 4: Parametreleri İnceleme

```typescript
// ParametersPanel'de görüntülenen parametreler:
- Volume: Kesişim hacmi
- Surface Area: Yüzey alanı
- Center of Mass: Kütle merkezi
- Bounding Box: Width, Height, Depth
```

## Örnek Kod

### Kesişim Hesaplama

```typescript
import { computeIntersection } from './services/intersectionDetection';

const intersectionParams = await computeIntersection(
  shape1.replicadShape,
  shape2.replicadShape,
  shape1.position,
  shape2.position,
  shape1.rotation,
  shape2.rotation
);

if (intersectionParams) {
  console.log('Volume:', intersectionParams.intersectionData.volume);
  console.log('Surface Area:', intersectionParams.intersectionData.surfaceArea);
  console.log('Dimensions:', intersectionParams.intersectionData.boundingBox);
}
```

### Kesişim Parametrelerini Kaydetme

```typescript
const { setIntersectionParameters } = useAppStore();
const intersectionKey = `${shape1Id}-${shape2Id}`;
setIntersectionParameters(intersectionKey, intersectionParams);
```

### Kesişim Geometrisini Sahneye Ekleme

```typescript
import { createIntersectionShape } from './services/intersectionDetection';

const newShape = createIntersectionShape(intersectionParams);
addShape(newShape);
```

## State Yapısı

```typescript
interface IntersectionData {
  volume: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    width: number;
    height: number;
    depth: number;
  };
  centerOfMass: [number, number, number];
  surfaceArea: number;
}

interface IntersectionParameters {
  id: string;
  name: string;
  shape1Id: string;
  shape2Id: string;
  intersectionData: IntersectionData;
  replicadShape: any;
  geometry: THREE.BufferGeometry;
  timestamp: number;
}
```

## Otomatik Model Güncelleme

Parametreler değiştiğinde model otomatik olarak güncellenir:

```typescript
// ParametersPanel.tsx içinde applyChanges():
const applyChanges = async () => {
  if (!selectedShape) return;

  // Parametreleri güncelle
  updateShape(selectedShape.id, {
    parameters: {
      width,
      height,
      depth,
      customParameters
    }
  });

  // Geometri otomatik yeniden hesaplanır
};
```

## API Referansı

### detectIntersection()
İki shape arasında kesişim olup olmadığını kontrol eder.

```typescript
const result = await detectIntersection(
  shape1.replicadShape,
  shape2.replicadShape,
  shape1Position,
  shape2Position
);
// Returns: { hasIntersection: boolean, intersectionVolume?: number }
```

### computeIntersection()
Kesişim geometrisini hesaplar ve tüm parametreleri döndürür.

```typescript
const params = await computeIntersection(
  shape1.replicadShape,
  shape2.replicadShape,
  shape1Position,
  shape2Position,
  shape1Rotation,
  shape2Rotation
);
// Returns: IntersectionParameters | null
```

### createIntersectionShape()
IntersectionParameters'dan bir Shape objesi oluşturur.

```typescript
const shape = createIntersectionShape(intersectionParams);
addShape(shape);
```

## Store Actions

```typescript
// Kesişim parametrelerini kaydet
setIntersectionParameters(key: string, params: any)

// Kesişim parametrelerini sil
removeIntersectionParameters(key: string)

// İki shape için kesişim hesapla
computeIntersectionForShapes(shape1Id: string, shape2Id: string)
```

## UI Özellikleri

### Toolbar
- Intersection butonu (yeşil renkli)
- İki shape seçili olduğunda aktif olur
- Tıklandığında kesişim hesaplanır

### ParametersPanel
- Intersection Properties bölümü
- Volume, Area, Center of Mass görüntülenir
- Read-only parametreler (hesaplanan değerler)

## Notlar

- Kesişim hesaplaması transform'ları (position, rotation) dikkate alır
- Kesişim geometrisi yeşil renkte görüntülenir
- Her kesişim `intersection-${timestamp}` ID'si ile saklanır
- Kesişim bulunamazsa `null` döner ve kullanıcı uyarılır

## Gelecek Geliştirmeler

- [ ] Kesişim parametrelerini düzenlenebilir hale getirme
- [ ] Kesişim geometrisini başka shape'lerle boolean işlemlere sokma
- [ ] Kesişim sonuçlarını dışa aktarma (JSON, STEP)
- [ ] Kesişim animasyonları
- [ ] Çoklu kesişim hesaplama (3+ shape)
