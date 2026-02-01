import * as THREE from 'three';
import { globalSettingsService } from './GlobalSettingsDatabase';
import { Shape, FaceRole, GeneratedPanel } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  FaceData,
  CoplanarFaceGroup,
  createPanelFromFaceGroup,
  createFaceHighlightGeometry
} from './FaceEditor';

export interface PanelJointConfig {
  selectedBodyType: 'ayakli' | 'ayaksiz' | 'bazali';
  bazaHeight: number;
  frontBaseDistance: number;
  backBaseDistance: number;
  legHeight: number;
  legDiameter: number;
  legFrontDistance: number;
  legBackDistance: number;
  legSideDistance: number;
  topPanelWidth: number;
  bottomPanelWidth: number;
  topPanelPositionX: number;
  bottomPanelPositionX: number;
  topLeftExpanded: boolean;
  topRightExpanded: boolean;
  bottomLeftExpanded: boolean;
  bottomRightExpanded: boolean;
  leftPanelHeight: number;
  leftPanelPositionY: number;
  rightPanelHeight: number;
  rightPanelPositionY: number;
}

interface PanelBounds {
  role: string;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  normal: THREE.Vector3;
  faceGroupIndices: number[];
}

export interface BackPanelConfig {
  looseWid: number;
  looseDep: number;
  backPanelThickness: number;
  grooveOffset: number;
  grooveDepth: number;
  leftExtend: number;
  rightExtend: number;
  topExtend: number;
  bottomExtend: number;
  leftPanelShorten: number;
  rightPanelShorten: number;
  topPanelShorten: number;
  bottomPanelShorten: number;
}

export interface PanelDefinition {
  id: string;
  role: 'left' | 'right' | 'top' | 'bottom' | 'back' | 'base-front' | 'base-back';
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation: [number, number, number];
  color: string;
}

export interface BodyBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  width: number;
  height: number;
  depth: number;
}

export interface GeneratedPanels {
  panels: PanelDefinition[];
  bodyBounds: BodyBounds;
  panelThickness: number;
}

const DEFAULT_PANEL_THICKNESS = 18;

const PANEL_COLORS: Record<string, string> = {
  left: '#e8d4b8',
  right: '#e8d4b8',
  top: '#d4c4a8',
  bottom: '#d4c4a8',
  back: '#c8b898',
  door: '#dcc8a8',
  'base-front': '#b8a888',
  'base-back': '#b8a888'
};

export class PanelManagerService {
  private panelJointConfig: PanelJointConfig | null = null;
  private backPanelConfig: BackPanelConfig | null = null;
  private profileId: string | null = null;

  async loadProfileSettings(profileId: string): Promise<boolean> {
    try {
      this.profileId = profileId;

      const panelJointSettings = await globalSettingsService.getProfileSettings(profileId, 'panel_joint');
      const backPanelSettings = await globalSettingsService.getProfileSettings(profileId, 'back_panel');

      if (panelJointSettings?.settings) {
        this.panelJointConfig = this.parsePanelJointSettings(panelJointSettings.settings as Record<string, unknown>);
      } else {
        this.panelJointConfig = this.getDefaultPanelJointConfig();
      }

      if (backPanelSettings?.settings) {
        this.backPanelConfig = this.parseBackPanelSettings(backPanelSettings.settings as Record<string, unknown>);
      } else {
        this.backPanelConfig = this.getDefaultBackPanelConfig();
      }

      console.log('PanelManager: Loaded profile settings', {
        profileId,
        panelJoint: this.panelJointConfig,
        backPanel: this.backPanelConfig
      });

      return true;
    } catch (error) {
      console.error('PanelManager: Failed to load profile settings', error);
      return false;
    }
  }

  private parsePanelJointSettings(settings: Record<string, unknown>): PanelJointConfig {
    return {
      selectedBodyType: (settings.selectedBodyType as 'ayakli' | 'ayaksiz' | 'bazali') || 'ayaksiz',
      bazaHeight: (settings.bazaHeight as number) || 100,
      frontBaseDistance: (settings.frontBaseDistance as number) || 10,
      backBaseDistance: (settings.backBaseDistance as number) || 30,
      legHeight: (settings.legHeight as number) || 100,
      legDiameter: (settings.legDiameter as number) || 25,
      legFrontDistance: (settings.legFrontDistance as number) || 30,
      legBackDistance: (settings.legBackDistance as number) || 30,
      legSideDistance: (settings.legSideDistance as number) || 30,
      topPanelWidth: (settings.topPanelWidth as number) || 0.45,
      bottomPanelWidth: (settings.bottomPanelWidth as number) || 0.45,
      topPanelPositionX: (settings.topPanelPositionX as number) || 0,
      bottomPanelPositionX: (settings.bottomPanelPositionX as number) || 0,
      topLeftExpanded: settings.topLeftExpanded !== undefined ? (settings.topLeftExpanded as boolean) : true,
      topRightExpanded: settings.topRightExpanded !== undefined ? (settings.topRightExpanded as boolean) : true,
      bottomLeftExpanded: settings.bottomLeftExpanded !== undefined ? (settings.bottomLeftExpanded as boolean) : true,
      bottomRightExpanded: settings.bottomRightExpanded !== undefined ? (settings.bottomRightExpanded as boolean) : true,
      leftPanelHeight: (settings.leftPanelHeight as number) || 0.586,
      leftPanelPositionY: (settings.leftPanelPositionY as number) || 0.275,
      rightPanelHeight: (settings.rightPanelHeight as number) || 0.586,
      rightPanelPositionY: (settings.rightPanelPositionY as number) || 0.275
    };
  }

  private parseBackPanelSettings(settings: Record<string, unknown>): BackPanelConfig {
    return {
      looseWid: (settings.looseWid as number) || 0.5,
      looseDep: (settings.looseDep as number) || 1,
      backPanelThickness: (settings.backPanelThickness as number) || 8,
      grooveOffset: (settings.grooveOffset as number) || 12,
      grooveDepth: (settings.grooveDepth as number) || 8,
      leftExtend: (settings.leftExtend as number) || 0,
      rightExtend: (settings.rightExtend as number) || 0,
      topExtend: (settings.topExtend as number) || 0,
      bottomExtend: (settings.bottomExtend as number) || 0,
      leftPanelShorten: (settings.leftPanelShorten as number) || 0,
      rightPanelShorten: (settings.rightPanelShorten as number) || 0,
      topPanelShorten: (settings.topPanelShorten as number) || 0,
      bottomPanelShorten: (settings.bottomPanelShorten as number) || 0
    };
  }

  private getDefaultPanelJointConfig(): PanelJointConfig {
    return {
      selectedBodyType: 'ayaksiz',
      bazaHeight: 100,
      frontBaseDistance: 10,
      backBaseDistance: 30,
      legHeight: 100,
      legDiameter: 25,
      legFrontDistance: 30,
      legBackDistance: 30,
      legSideDistance: 30,
      topPanelWidth: 0.45,
      bottomPanelWidth: 0.45,
      topPanelPositionX: 0,
      bottomPanelPositionX: 0,
      topLeftExpanded: true,
      topRightExpanded: true,
      bottomLeftExpanded: true,
      bottomRightExpanded: true,
      leftPanelHeight: 0.586,
      leftPanelPositionY: 0.275,
      rightPanelHeight: 0.586,
      rightPanelPositionY: 0.275
    };
  }

  private getDefaultBackPanelConfig(): BackPanelConfig {
    return {
      looseWid: 0.5,
      looseDep: 1,
      backPanelThickness: 8,
      grooveOffset: 12,
      grooveDepth: 8,
      leftExtend: 0,
      rightExtend: 0,
      topExtend: 0,
      bottomExtend: 0,
      leftPanelShorten: 0,
      rightPanelShorten: 0,
      topPanelShorten: 0,
      bottomPanelShorten: 0
    };
  }

  private extrudeFaceGeometry(
    faceGeometry: THREE.BufferGeometry,
    normal: THREE.Vector3,
    thickness: number,
    inward: boolean = true
  ): THREE.BufferGeometry {
    const positions = faceGeometry.getAttribute('position').array as Float32Array;
    const vertexCount = positions.length / 3;

    const extrudeDir = normal.clone().normalize();
    if (inward) {
      extrudeDir.negate();
    }

    const newPositions: number[] = [];
    const newIndices: number[] = [];

    for (let i = 0; i < vertexCount; i++) {
      newPositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    }

    for (let i = 0; i < vertexCount; i++) {
      newPositions.push(
        positions[i * 3] + extrudeDir.x * thickness,
        positions[i * 3 + 1] + extrudeDir.y * thickness,
        positions[i * 3 + 2] + extrudeDir.z * thickness
      );
    }

    const faceCount = vertexCount / 3;
    for (let i = 0; i < faceCount; i++) {
      const baseIdx = i * 3;
      newIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    }

    for (let i = 0; i < faceCount; i++) {
      const baseIdx = i * 3;
      const offsetIdx = vertexCount + baseIdx;
      newIndices.push(offsetIdx + 2, offsetIdx + 1, offsetIdx);
    }

    const extrudedGeometry = new THREE.BufferGeometry();
    extrudedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    extrudedGeometry.setIndex(newIndices);
    extrudedGeometry.computeVertexNormals();

    return extrudedGeometry;
  }

  private createPanelFromFaceGroup(
    faces: FaceData[],
    group: CoplanarFaceGroup,
    role: string,
    thickness: number,
    shapePosition: [number, number, number],
    offset: [number, number, number] = [0, 0, 0]
  ): GeneratedPanel | null {
    try {
      const faceGeometry = createFaceHighlightGeometry(faces, group.faceIndices);

      const extrudedGeometry = this.extrudeFaceGeometry(
        faceGeometry,
        group.normal,
        thickness,
        true
      );

      const box = new THREE.Box3().setFromBufferAttribute(
        extrudedGeometry.getAttribute('position')
      );
      const size = new THREE.Vector3();
      box.getSize(size);

      const position: [number, number, number] = [
        shapePosition[0] + offset[0],
        shapePosition[1] + offset[1],
        shapePosition[2] + offset[2]
      ];

      return {
        id: `panel-${role}-${Date.now()}`,
        role,
        geometry: extrudedGeometry,
        position,
        rotation: [0, 0, 0],
        color: PANEL_COLORS[role] || '#e8d4b8',
        dimensions: [size.x, size.y, size.z]
      };
    } catch (error) {
      console.error(`Failed to create panel for role ${role}:`, error);
      return null;
    }
  }

  private computePanelBounds(
    faces: FaceData[],
    faceGroups: CoplanarFaceGroup[],
    role: string,
    faceGroupIndices: number[],
    thickness: number = 18
  ): PanelBounds | null {
    if (faceGroupIndices.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let avgNormal = new THREE.Vector3();
    let normalCount = 0;

    for (const groupIndex of faceGroupIndices) {
      if (groupIndex >= faceGroups.length) continue;
      const group = faceGroups[groupIndex];

      avgNormal.add(group.normal);
      normalCount++;

      group.faceIndices.forEach(faceIdx => {
        const face = faces[faceIdx];
        if (!face) return;
        face.vertices.forEach(v => {
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
          minZ = Math.min(minZ, v.z);
          maxZ = Math.max(maxZ, v.z);
        });
      });
    }

    if (normalCount > 0) {
      avgNormal.divideScalar(normalCount).normalize();
    }

    if (minX === Infinity) return null;

    if (role === 'left') {
      const faceX = minX;
      maxX = faceX + thickness;
      minX = faceX;
    } else if (role === 'right') {
      const faceX = maxX;
      minX = faceX - thickness;
      maxX = faceX;
    }

    return {
      role,
      minX, maxX,
      minY, maxY,
      minZ, maxZ,
      normal: avgNormal,
      faceGroupIndices
    };
  }

  private getPanelOrientation(bounds: PanelBounds): 'vertical' | 'horizontal' {
    const absX = Math.abs(bounds.normal.x);
    const absY = Math.abs(bounds.normal.y);
    const absZ = Math.abs(bounds.normal.z);

    if (absX > absY && absX > absZ) {
      return 'vertical';
    }
    if (absY > absX && absY > absZ) {
      return 'horizontal';
    }
    return 'vertical';
  }

  private panelsOverlap(
    panel1: PanelBounds,
    panel2: PanelBounds
  ): boolean {
    const eps = 0.5;

    const xOverlap = Math.min(panel1.maxX, panel2.maxX) - Math.max(panel1.minX, panel2.minX);
    const yOverlap = Math.min(panel1.maxY, panel2.maxY) - Math.max(panel1.minY, panel2.minY);
    const zOverlap = Math.min(panel1.maxZ, panel2.maxZ) - Math.max(panel1.minZ, panel2.minZ);

    return xOverlap > eps && yOverlap > eps && zOverlap > eps;
  }

  private computeGeometricAdjustments(
    panelBoundsMap: Map<string, PanelBounds>,
    thickness: number
  ): Map<string, { widthShrink?: { left: number; right: number }; heightShrink?: { top: number; bottom: number }; depthShrink?: number }> {
    const adjustments = new Map<string, { widthShrink?: { left: number; right: number }; heightShrink?: { top: number; bottom: number }; depthShrink?: number }>();

    const allRoles = Array.from(panelBoundsMap.keys());
    allRoles.forEach(role => {
      adjustments.set(role, { widthShrink: { left: 0, right: 0 }, heightShrink: { top: 0, bottom: 0 }, depthShrink: 0 });
    });

    const leftBounds = panelBoundsMap.get('left');
    const rightBounds = panelBoundsMap.get('right');
    const topBounds = panelBoundsMap.get('top');
    const bottomBounds = panelBoundsMap.get('bottom');

    console.log('Panel joint detection (role-based):');

    if (topBounds) {
      const topAdj = adjustments.get('top')!;

      if (leftBounds && this.panelsOverlap(leftBounds, topBounds)) {
        topAdj.widthShrink!.left = thickness;
        console.log(`  top overlaps with left -> shrink top from LEFT by ${thickness}mm`);
      }

      if (rightBounds && this.panelsOverlap(rightBounds, topBounds)) {
        topAdj.widthShrink!.right = thickness;
        console.log(`  top overlaps with right -> shrink top from RIGHT by ${thickness}mm`);
      }
    }

    if (bottomBounds) {
      const bottomAdj = adjustments.get('bottom')!;

      if (leftBounds && this.panelsOverlap(leftBounds, bottomBounds)) {
        bottomAdj.widthShrink!.left = thickness;
        console.log(`  bottom overlaps with left -> shrink bottom from LEFT by ${thickness}mm`);
      }

      if (rightBounds && this.panelsOverlap(rightBounds, bottomBounds)) {
        bottomAdj.widthShrink!.right = thickness;
        console.log(`  bottom overlaps with right -> shrink bottom from RIGHT by ${thickness}mm`);
      }
    }

    return adjustments;
  }

  generatePanelsFromFaceRoles(shape: Shape, panelThickness: number = DEFAULT_PANEL_THICKNESS): GeneratedPanel[] {
    if (!shape.geometry || !shape.faceRoles) {
      console.warn('PanelManager: Shape has no geometry or face roles');
      return [];
    }

    const faces = extractFacesFromGeometry(shape.geometry);
    const faceGroups = groupCoplanarFaces(faces);

    const panels: GeneratedPanel[] = [];
    const pt = panelThickness;
    const config = this.panelJointConfig;
    const backConfig = this.backPanelConfig;

    const roleToFaceGroups: Record<string, number[]> = {};
    Object.entries(shape.faceRoles).forEach(([faceIndexStr, role]) => {
      if (!role) return;
      const faceIndex = parseInt(faceIndexStr);
      const roleLower = role.toLowerCase();
      if (!roleToFaceGroups[roleLower]) {
        roleToFaceGroups[roleLower] = [];
      }
      roleToFaceGroups[roleLower].push(faceIndex);
    });

    console.log('PanelManager: Role to face groups mapping:', roleToFaceGroups);

    const hasLeft = !!roleToFaceGroups['left'];
    const hasRight = !!roleToFaceGroups['right'];
    const hasTop = !!roleToFaceGroups['top'];
    const hasBottom = !!roleToFaceGroups['bottom'];

    const hasBaza = config && config.selectedBodyType === 'bazali' && hasBottom;
    const bazaHeight = hasBaza ? config.bazaHeight : 0;

    const panelBoundsMap = new Map<string, PanelBounds>();

    ['left', 'right', 'top', 'bottom'].forEach(role => {
      if (roleToFaceGroups[role]) {
        const bounds = this.computePanelBounds(faces, faceGroups, role, roleToFaceGroups[role], pt);
        if (bounds) {
          panelBoundsMap.set(role, bounds);
          console.log(`PanelManager: ${role} bounds:`, {
            x: [bounds.minX.toFixed(1), bounds.maxX.toFixed(1)],
            y: [bounds.minY.toFixed(1), bounds.maxY.toFixed(1)],
            z: [bounds.minZ.toFixed(1), bounds.maxZ.toFixed(1)]
          });
        }
      }
    });

    const geometricAdjustments = this.computeGeometricAdjustments(panelBoundsMap, pt);

    console.log('PanelManager: Geometric adjustments:', Object.fromEntries(geometricAdjustments));

    const createExtrudedPanel = (
      role: string,
      faceGroupIndices: number[],
      thickness: number,
      adjustments: {
        widthShrink?: { left: number; right: number };
        heightShrink?: { top: number; bottom: number };
        depthShrink?: number;
      }
    ): GeneratedPanel | null => {
      if (faceGroupIndices.length === 0) return null;

      for (const groupIndex of faceGroupIndices) {
        if (groupIndex >= faceGroups.length) continue;

        const panelInfo = createPanelFromFaceGroup(
          faces,
          faceGroups,
          groupIndex,
          thickness,
          adjustments
        );

        if (panelInfo) {
          return {
            id: `panel-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role,
            geometry: panelInfo.geometry,
            position: [panelInfo.position.x, panelInfo.position.y, panelInfo.position.z],
            rotation: [0, 0, 0],
            color: PANEL_COLORS[role] || '#e8d4b8',
            dimensions: [panelInfo.dimensions.width, panelInfo.dimensions.height, panelInfo.dimensions.depth]
          };
        }
      }
      return null;
    };

    if (roleToFaceGroups['left']) {
      const geoAdj = geometricAdjustments.get('left') || {};
      const depthAdj = backConfig?.leftPanelShorten || 0;

      const panel = createExtrudedPanel(
        'left',
        roleToFaceGroups['left'],
        pt,
        {
          widthShrink: geoAdj.widthShrink || { left: 0, right: 0 },
          heightShrink: geoAdj.heightShrink || { top: 0, bottom: 0 },
          depthShrink: depthAdj
        }
      );
      if (panel) panels.push(panel);
    }

    if (roleToFaceGroups['right']) {
      const geoAdj = geometricAdjustments.get('right') || {};
      const depthAdj = backConfig?.rightPanelShorten || 0;

      const panel = createExtrudedPanel(
        'right',
        roleToFaceGroups['right'],
        pt,
        {
          widthShrink: geoAdj.widthShrink || { left: 0, right: 0 },
          heightShrink: geoAdj.heightShrink || { top: 0, bottom: 0 },
          depthShrink: depthAdj
        }
      );
      if (panel) panels.push(panel);
    }

    if (roleToFaceGroups['top']) {
      const geoAdj = geometricAdjustments.get('top') || {};
      const depthAdj = backConfig?.topPanelShorten || 0;

      const panel = createExtrudedPanel(
        'top',
        roleToFaceGroups['top'],
        pt,
        {
          widthShrink: geoAdj.widthShrink || { left: 0, right: 0 },
          heightShrink: geoAdj.heightShrink || { top: 0, bottom: 0 },
          depthShrink: depthAdj
        }
      );
      if (panel) panels.push(panel);
    }

    if (roleToFaceGroups['bottom']) {
      const geoAdj = geometricAdjustments.get('bottom') || {};
      const depthAdj = backConfig?.bottomPanelShorten || 0;
      const yOffset = hasBaza ? bazaHeight : 0;

      const panel = createExtrudedPanel(
        'bottom',
        roleToFaceGroups['bottom'],
        pt,
        {
          widthShrink: geoAdj.widthShrink || { left: 0, right: 0 },
          heightShrink: geoAdj.heightShrink || { top: 0, bottom: 0 },
          depthShrink: depthAdj
        }
      );
      if (panel) {
        panel.position[1] += yOffset;
        panels.push(panel);
      }
    }

    if (roleToFaceGroups['back'] && backConfig) {
      const backThickness = backConfig.backPanelThickness || 8;

      for (const groupIndex of roleToFaceGroups['back']) {
        if (groupIndex >= faceGroups.length) continue;

        const group = faceGroups[groupIndex];
        const allVertices: THREE.Vector3[] = [];
        group.faceIndices.forEach(idx => {
          const face = faces[idx];
          if (face) {
            allVertices.push(...face.vertices.map(v => v.clone()));
          }
        });

        if (allVertices.length === 0) continue;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity;
        allVertices.forEach(v => {
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
          minZ = Math.min(minZ, v.z);
        });

        const looseWid = backConfig.looseWid || 0;
        const looseDep = backConfig.looseDep || 0;
        const grooveOffset = backConfig.grooveOffset || 12;

        let backWidth = (maxX - minX) - pt * 2 - looseWid * 2;
        let backHeight = (maxY - minY) - pt * 2 - looseDep * 2;

        backWidth += (backConfig.leftExtend || 0) + (backConfig.rightExtend || 0);
        backHeight += (backConfig.topExtend || 0) + (backConfig.bottomExtend || 0);

        if (hasBaza) {
          backHeight -= bazaHeight;
        }

        if (backWidth <= 0 || backHeight <= 0) continue;

        const backGeom = new THREE.BoxGeometry(backWidth, backHeight, backThickness);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2 + (hasBaza ? bazaHeight / 2 : 0);
        const posZ = minZ + grooveOffset + backThickness / 2;

        panels.push({
          id: `panel-back-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'back',
          geometry: backGeom,
          position: [centerX, centerY, posZ],
          rotation: [0, 0, 0],
          color: PANEL_COLORS['back'],
          dimensions: [backWidth, backHeight, backThickness]
        });
        break;
      }
    }

    if (hasBaza && config) {
      const bodyBounds = this.extractBodyBoundsFromShape(shape);
      if (bodyBounds) {
        const frontDist = config.frontBaseDistance;
        const backDist = config.backBaseDistance;
        const bazaWidth = bodyBounds.width - pt * 2;

        const baseFrontGeom = new THREE.BoxGeometry(bazaWidth, bazaHeight, pt);
        const baseBackGeom = new THREE.BoxGeometry(bazaWidth, bazaHeight, pt);

        const centerX = (bodyBounds.minX + bodyBounds.maxX) / 2;
        const bottomY = bodyBounds.minY + bazaHeight / 2;
        const frontZ = bodyBounds.maxZ - frontDist - pt / 2;
        const backZ = bodyBounds.minZ + backDist + pt / 2;

        panels.push({
          id: `panel-base-front-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'base-front',
          geometry: baseFrontGeom,
          position: [centerX, bottomY, frontZ],
          rotation: [0, 0, 0],
          color: PANEL_COLORS['base-front'],
          dimensions: [bazaWidth, bazaHeight, pt]
        });

        panels.push({
          id: `panel-base-back-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'base-back',
          geometry: baseBackGeom,
          position: [centerX, bottomY, backZ],
          rotation: [0, 0, 0],
          color: PANEL_COLORS['base-back'],
          dimensions: [bazaWidth, bazaHeight, pt]
        });
      }
    }

    console.log('PanelManager: Generated panels with geometric joint detection', {
      panelCount: panels.length,
      roles: panels.map(p => p.role),
      hasBaza
    });

    return panels;
  }

  extractBodyBoundsFromShape(shape: Shape): BodyBounds | null {
    if (!shape.geometry) {
      console.warn('PanelManager: Shape has no geometry');
      return null;
    }

    const box = new THREE.Box3().setFromBufferAttribute(
      shape.geometry.getAttribute('position')
    );

    const size = new THREE.Vector3();
    box.getSize(size);

    return {
      minX: box.min.x + shape.position[0],
      maxX: box.max.x + shape.position[0],
      minY: box.min.y + shape.position[1],
      maxY: box.max.y + shape.position[1],
      minZ: box.min.z + shape.position[2],
      maxZ: box.max.z + shape.position[2],
      width: size.x,
      height: size.y,
      depth: size.z
    };
  }

  getPanelJointConfig(): PanelJointConfig | null {
    return this.panelJointConfig;
  }

  getBackPanelConfig(): BackPanelConfig | null {
    return this.backPanelConfig;
  }

  getProfileId(): string | null {
    return this.profileId;
  }
}

export const panelManagerService = new PanelManagerService();
