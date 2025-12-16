import * as THREE from 'three';

export interface FaceInfo {
  faceIndex: number;
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  vertices: THREE.Vector3[];
  triangleIndices: number[];
}

export class FaceSelectionManager {
  private faces: FaceInfo[] = [];
  private geometry: THREE.BufferGeometry | null = null;

  loadFromGeometry(geometry: THREE.BufferGeometry): void {
    this.geometry = geometry;
    this.faces = this.extractPlanarFaces(geometry);
    console.log(`📐 Loaded ${this.faces.length} planar faces from geometry`);
  }

  getFaces(): FaceInfo[] {
    return this.faces;
  }

  getFace(index: number): FaceInfo | null {
    return this.faces[index] || null;
  }

  findCommonEdge(face1Index: number, face2Index: number): [THREE.Vector3, THREE.Vector3] | null {
    const face1 = this.faces[face1Index];
    const face2 = this.faces[face2Index];

    if (!face1 || !face2) return null;

    const tolerance = 0.1;
    const commonVertices: THREE.Vector3[] = [];

    for (const v1 of face1.vertices) {
      for (const v2 of face2.vertices) {
        if (v1.distanceTo(v2) < tolerance) {
          const isDuplicate = commonVertices.some(v => v.distanceTo(v1) < tolerance);
          if (!isDuplicate) {
            commonVertices.push(v1.clone());
          }
          break;
        }
      }
    }

    if (commonVertices.length >= 2) {
      console.log(`✅ Found common edge with ${commonVertices.length} common vertices`);
      return [commonVertices[0], commonVertices[1]];
    }

    console.warn(`⚠️ No common edge found (only ${commonVertices.length} common vertices)`);
    return null;
  }

  private extractPlanarFaces(geometry: THREE.BufferGeometry): FaceInfo[] {
    const positionAttribute = geometry.getAttribute('position');
    const triangles: Array<{
      index: number;
      normal: THREE.Vector3;
      centroid: THREE.Vector3;
      vertices: THREE.Vector3[];
    }> = [];

    for (let i = 0; i < positionAttribute.count; i += 3) {
      const v1 = new THREE.Vector3(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      );
      const v2 = new THREE.Vector3(
        positionAttribute.getX(i + 1),
        positionAttribute.getY(i + 1),
        positionAttribute.getZ(i + 1)
      );
      const v3 = new THREE.Vector3(
        positionAttribute.getX(i + 2),
        positionAttribute.getY(i + 2),
        positionAttribute.getZ(i + 2)
      );

      const edge1 = new THREE.Vector3().subVectors(v2, v1);
      const edge2 = new THREE.Vector3().subVectors(v3, v1);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

      const centroid = new THREE.Vector3()
        .addVectors(v1, v2)
        .add(v3)
        .divideScalar(3);

      triangles.push({
        index: Math.floor(i / 3),
        normal,
        centroid,
        vertices: [v1, v2, v3]
      });
    }

    const faces: FaceInfo[] = [];
    const used = new Set<number>();
    const normalTolerance = 0.999;

    for (let i = 0; i < triangles.length; i++) {
      if (used.has(i)) continue;

      const triangle = triangles[i];
      const groupedTriangles = [i];
      used.add(i);

      for (let j = i + 1; j < triangles.length; j++) {
        if (used.has(j)) continue;

        const otherTriangle = triangles[j];
        const dotProduct = triangle.normal.dot(otherTriangle.normal);

        if (dotProduct > normalTolerance) {
          const d1 = triangle.normal.dot(triangle.centroid);
          const d2 = triangle.normal.dot(otherTriangle.centroid);

          if (Math.abs(d1 - d2) < 1) {
            groupedTriangles.push(j);
            used.add(j);
          }
        }
      }

      const allVertices: THREE.Vector3[] = [];
      groupedTriangles.forEach(idx => {
        allVertices.push(...triangles[idx].vertices);
      });

      const avgCentroid = new THREE.Vector3();
      groupedTriangles.forEach(idx => {
        avgCentroid.add(triangles[idx].centroid);
      });
      avgCentroid.divideScalar(groupedTriangles.length);

      faces.push({
        faceIndex: faces.length,
        normal: triangle.normal.clone(),
        centroid: avgCentroid,
        vertices: allVertices,
        triangleIndices: groupedTriangles
      });
    }

    console.log(`📐 Grouped ${triangles.length} triangles into ${faces.length} planar faces`);
    return faces;
  }

  createFaceGeometry(faceIndex: number): THREE.BufferGeometry | null {
    const face = this.faces[faceIndex];
    if (!face || !this.geometry) return null;

    const positionAttribute = this.geometry.getAttribute('position');
    const normalAttribute = this.geometry.getAttribute('normal');

    const vertexCount = face.triangleIndices.length * 3;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);

    let writeIndex = 0;
    for (const triangleIndex of face.triangleIndices) {
      const baseIndex = triangleIndex * 3;

      for (let i = 0; i < 3; i++) {
        const vertexIndex = baseIndex + i;

        positions[writeIndex * 3] = positionAttribute.getX(vertexIndex);
        positions[writeIndex * 3 + 1] = positionAttribute.getY(vertexIndex);
        positions[writeIndex * 3 + 2] = positionAttribute.getZ(vertexIndex);

        if (normalAttribute) {
          normals[writeIndex * 3] = normalAttribute.getX(vertexIndex);
          normals[writeIndex * 3 + 1] = normalAttribute.getY(vertexIndex);
          normals[writeIndex * 3 + 2] = normalAttribute.getZ(vertexIndex);
        }

        writeIndex++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    if (normalAttribute) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }

    return geometry;
  }
}

export const globalFaceSelectionManager = new FaceSelectionManager();
