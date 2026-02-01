import * as THREE from 'three';
import { globalSettingsService } from './GlobalSettingsDatabase';
import { Shape, FaceRole, GeneratedPanel } from '../store';
import {
  extractFacesFromGeometry,
  groupCoplanarFaces,
  CoplanarFaceGroup,
  FaceData,
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
      topLeftExpanded: (settings.topLeftExpanded as boolean) || false,
      topRightExpanded: (settings.topRightExpanded as boolean) || false,
      bottomLeftExpanded: (settings.bottomLeftExpanded as boolean) || false,
      bottomRightExpanded: (settings.bottomRightExpanded as boolean) || false,
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
      topLeftExpanded: false,
      topRightExpanded: false,
      bottomLeftExpanded: false,
      bottomRightExpanded: false,
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

  generatePanelsFromFaceRoles(shape: Shape, panelThickness: number = DEFAULT_PANEL_THICKNESS): GeneratedPanel[] {
    if (!shape.geometry || !shape.faceRoles) {
      console.warn('PanelManager: Shape has no geometry or face roles');
      return [];
    }

    const faces = extractFacesFromGeometry(shape.geometry);
    const groups = groupCoplanarFaces(faces);

    const panels: GeneratedPanel[] = [];
    const pt = panelThickness;
    const config = this.panelJointConfig;
    const backConfig = this.backPanelConfig;

    const roleToGroupMap = new Map<FaceRole, { group: CoplanarFaceGroup; index: number }>();
    Object.entries(shape.faceRoles).forEach(([indexStr, role]) => {
      if (!role) return;
      const groupIndex = parseInt(indexStr);
      if (groupIndex >= 0 && groupIndex < groups.length) {
        roleToGroupMap.set(role, { group: groups[groupIndex], index: groupIndex });
      }
    });

    const leftData = roleToGroupMap.get('Left');
    const rightData = roleToGroupMap.get('Right');
    const topData = roleToGroupMap.get('Top');
    const bottomData = roleToGroupMap.get('Bottom');
    const backData = roleToGroupMap.get('Back');

    if (leftData) {
      let offset: [number, number, number] = [pt / 2, 0, 0];
      if (backConfig && backConfig.leftPanelShorten > 0) {
        offset[2] = backConfig.leftPanelShorten / 2;
      }
      const panel = this.createPanelFromFaceGroup(
        faces,
        leftData.group,
        'left',
        pt,
        shape.position,
        offset
      );
      if (panel) panels.push(panel);
    }

    if (rightData) {
      let offset: [number, number, number] = [-pt / 2, 0, 0];
      if (backConfig && backConfig.rightPanelShorten > 0) {
        offset[2] = backConfig.rightPanelShorten / 2;
      }
      const panel = this.createPanelFromFaceGroup(
        faces,
        rightData.group,
        'right',
        pt,
        shape.position,
        offset
      );
      if (panel) panels.push(panel);
    }

    if (topData) {
      let offset: [number, number, number] = [0, -pt / 2, 0];
      if (config) {
        if (config.topLeftExpanded) offset[0] -= pt / 2;
        if (config.topRightExpanded) offset[0] += pt / 2;
      }
      if (backConfig && backConfig.topPanelShorten > 0) {
        offset[2] = backConfig.topPanelShorten / 2;
      }
      const panel = this.createPanelFromFaceGroup(
        faces,
        topData.group,
        'top',
        pt,
        shape.position,
        offset
      );
      if (panel) panels.push(panel);
    }

    if (bottomData) {
      let offset: [number, number, number] = [0, pt / 2, 0];
      if (config) {
        if (config.bottomLeftExpanded) offset[0] -= pt / 2;
        if (config.bottomRightExpanded) offset[0] += pt / 2;
      }
      if (backConfig && backConfig.bottomPanelShorten > 0) {
        offset[2] = backConfig.bottomPanelShorten / 2;
      }
      const panel = this.createPanelFromFaceGroup(
        faces,
        bottomData.group,
        'bottom',
        pt,
        shape.position,
        offset
      );
      if (panel) panels.push(panel);
    }

    if (backData && backConfig) {
      const backThickness = backConfig.backPanelThickness;
      const grooveOffset = backConfig.grooveOffset;
      const offset: [number, number, number] = [0, 0, grooveOffset + backThickness / 2];

      const panel = this.createPanelFromFaceGroup(
        faces,
        backData.group,
        'back',
        backThickness,
        shape.position,
        offset
      );
      if (panel) panels.push(panel);
    }

    if (config && config.selectedBodyType === 'bazali' && bottomData) {
      const bazaHeight = config.bazaHeight;
      const frontDist = config.frontBaseDistance;
      const backDist = config.backBaseDistance;

      const box = new THREE.Box3().setFromBufferAttribute(
        shape.geometry.getAttribute('position')
      );
      const size = new THREE.Vector3();
      box.getSize(size);

      const baseFrontGeom = new THREE.BoxGeometry(size.x - pt * 2, bazaHeight, pt);
      const baseBackGeom = new THREE.BoxGeometry(size.x - pt * 2, bazaHeight, pt);

      panels.push({
        id: `panel-base-front-${Date.now()}`,
        role: 'base-front',
        geometry: baseFrontGeom,
        position: [
          shape.position[0],
          shape.position[1] + box.min.y - bazaHeight / 2,
          shape.position[2] + box.max.z - frontDist - pt / 2
        ],
        rotation: [0, 0, 0],
        color: PANEL_COLORS['base-front'],
        dimensions: [size.x - pt * 2, bazaHeight, pt]
      });

      panels.push({
        id: `panel-base-back-${Date.now() + 1}`,
        role: 'base-back',
        geometry: baseBackGeom,
        position: [
          shape.position[0],
          shape.position[1] + box.min.y - bazaHeight / 2,
          shape.position[2] + box.min.z + backDist + pt / 2
        ],
        rotation: [0, 0, 0],
        color: PANEL_COLORS['base-back'],
        dimensions: [size.x - pt * 2, bazaHeight, pt]
      });
    }

    console.log('PanelManager: Generated panels from face roles', {
      panelCount: panels.length,
      roles: panels.map(p => p.role)
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
