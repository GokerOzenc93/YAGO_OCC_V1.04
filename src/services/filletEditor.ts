import * as THREE from 'three';

export async function applyFilletToEdge(
  replicadShape: any,
  edge: [THREE.Vector3, THREE.Vector3],
  radius: number
): Promise<any> {
  try {
    console.log('🔨 Applying fillet:', { radius, edge });

    const edgeMidpoint = new THREE.Vector3()
      .addVectors(edge[0], edge[1])
      .divideScalar(2);

    console.log('📍 Edge midpoint:', edgeMidpoint.toArray());

    if (typeof replicadShape.fillet === 'function') {
      const edges = replicadShape.edges();
      console.log(`🔍 Found ${edges.length} edges in shape`);

      let closestEdge = null;
      let minDistance = Infinity;

      for (const replicadEdge of edges) {
        const edgeStartPoint = replicadEdge.startPoint();
        const edgeEndPoint = replicadEdge.endPoint();

        const replicadMidpoint = [
          (edgeStartPoint[0] + edgeEndPoint[0]) / 2,
          (edgeStartPoint[1] + edgeEndPoint[1]) / 2,
          (edgeStartPoint[2] + edgeEndPoint[2]) / 2
        ];

        const distance = Math.sqrt(
          Math.pow(edgeMidpoint.x - replicadMidpoint[0], 2) +
          Math.pow(edgeMidpoint.y - replicadMidpoint[1], 2) +
          Math.pow(edgeMidpoint.z - replicadMidpoint[2], 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestEdge = replicadEdge;
        }
      }

      if (closestEdge && minDistance < 10) {
        console.log(`✅ Found closest edge at distance ${minDistance.toFixed(2)}`);
        const filletedShape = replicadShape.fillet(radius, (edge: any) => edge === closestEdge);
        console.log('✅ Fillet applied successfully');
        return filletedShape;
      } else {
        console.warn('⚠️ No close edge found for fillet');
        return replicadShape;
      }
    } else {
      console.warn('⚠️ Fillet method not available on replicadShape');
      return replicadShape;
    }
  } catch (error) {
    console.error('❌ Failed to apply fillet:', error);
    return replicadShape;
  }
}
