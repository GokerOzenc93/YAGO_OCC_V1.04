import * as THREE from 'three';
import type { VirtualFace, Shape } from '../store';
import {
  getFacePlaneAxes,
  getShapeMatrix,
  getSubtractorFootprints2D,
  projectTo2D,
  subtractPolygon,
  ensureCCW,
  isPointInsidePolygon,
  type Point2D,
} from './FaceRaycastOverlay';

export function recalculateVirtualFacesForShape(
  shape: Shape,
  virtualFaces: VirtualFace[]
): VirtualFace[] {
  const shapeFaces = virtualFaces.filter(vf => vf.shapeId === shape.id);
  if (shapeFaces.length === 0) return virtualFaces;

  const subtractions = shape.subtractionGeometries || [];
  if (subtractions.length === 0) return virtualFaces;

  const localToWorld = getShapeMatrix(shape);

  const updatedMap = new Map<string, VirtualFace>();

  for (const vf of shapeFaces) {
    const updated = clipVirtualFaceAgainstSubtractions(vf, subtractions, localToWorld);
    if (updated) {
      updatedMap.set(vf.id, updated);
    } else {
      updatedMap.set(vf.id, vf);
    }
  }

  return virtualFaces.map(vf => updatedMap.get(vf.id) || vf);
}

function clipVirtualFaceAgainstSubtractions(
  vf: VirtualFace,
  subtractions: any[],
  localToWorld: THREE.Matrix4
): VirtualFace | null {
  if (vf.vertices.length < 3) return null;

  const localNormal = new THREE.Vector3(vf.normal[0], vf.normal[1], vf.normal[2]).normalize();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();

  const { u, v } = getFacePlaneAxes(worldNormal);

  const cornersLocal = vf.vertices.map(vtx => new THREE.Vector3(vtx[0], vtx[1], vtx[2]));
  const cornersWorld = cornersLocal.map(c => c.clone().applyMatrix4(localToWorld));

  const centerWorld = new THREE.Vector3();
  cornersWorld.forEach(c => centerWorld.add(c));
  centerWorld.divideScalar(cornersWorld.length);

  const planeOrigin = centerWorld.clone();

  const poly2D: Point2D[] = cornersWorld.map(c => projectTo2D(c, planeOrigin, u, v));
  let clippedPoly = ensureCCW(poly2D);

  const footprints = getSubtractorFootprints2D(
    subtractions, localToWorld, worldNormal, planeOrigin, u, v, 50
  );

  if (footprints.length === 0) return null;

  let changed = false;
  for (const footprint of footprints) {
    const ccwFootprint = ensureCCW(footprint);
    const hasOverlap = ccwFootprint.some(p => isPointInsidePolygon(p, clippedPoly)) ||
      clippedPoly.some(p => isPointInsidePolygon(p, ccwFootprint));
    if (hasOverlap) {
      clippedPoly = subtractPolygon(clippedPoly, ccwFootprint);
      changed = true;
    }
  }

  if (!changed) return null;
  if (clippedPoly.length < 3) return null;

  const worldToLocal = localToWorld.clone().invert();
  const newCornersWorld = clippedPoly.map(p =>
    planeOrigin.clone().addScaledVector(u, p.x).addScaledVector(v, p.y)
  );
  const newCornersLocal = newCornersWorld.map(c => c.clone().applyMatrix4(worldToLocal));

  const newCenter = new THREE.Vector3();
  newCornersLocal.forEach(c => newCenter.add(c));
  newCenter.divideScalar(newCornersLocal.length);

  return {
    ...vf,
    vertices: newCornersLocal.map(c => [c.x, c.y, c.z] as [number, number, number]),
    center: [newCenter.x, newCenter.y, newCenter.z],
  };
}
