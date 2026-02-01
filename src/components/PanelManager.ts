import * as THREE from 'three';
import { globalSettingsService } from './GlobalSettingsDatabase';
import { Shape, FaceRole } from '../store';
import { extractFacesFromGeometry, groupCoplanarFaces, CoplanarFaceGroup } from './FaceEditor';

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

  extractBodyBoundsFromFaceRoles(shape: Shape): BodyBounds | null {
    if (!shape.geometry || !shape.faceRoles) {
      return this.extractBodyBoundsFromShape(shape);
    }

    const faces = extractFacesFromGeometry(shape.geometry);
    const groups = groupCoplanarFaces(faces);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const roleToGroupMap = new Map<FaceRole, CoplanarFaceGroup>();

    Object.entries(shape.faceRoles).forEach(([indexStr, role]) => {
      if (!role) return;
      const groupIndex = parseInt(indexStr);
      if (groupIndex >= 0 && groupIndex < groups.length) {
        roleToGroupMap.set(role, groups[groupIndex]);
      }
    });

    const leftGroup = roleToGroupMap.get('Left');
    const rightGroup = roleToGroupMap.get('Right');
    const topGroup = roleToGroupMap.get('Top');
    const bottomGroup = roleToGroupMap.get('Bottom');
    const backGroup = roleToGroupMap.get('Back');

    if (leftGroup) {
      minX = Math.min(minX, leftGroup.center.x + shape.position[0]);
    }
    if (rightGroup) {
      maxX = Math.max(maxX, rightGroup.center.x + shape.position[0]);
    }
    if (bottomGroup) {
      minY = Math.min(minY, bottomGroup.center.y + shape.position[1]);
    }
    if (topGroup) {
      maxY = Math.max(maxY, topGroup.center.y + shape.position[1]);
    }
    if (backGroup) {
      minZ = Math.min(minZ, backGroup.center.z + shape.position[2]);
    }

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) ||
        !isFinite(maxY) || !isFinite(minZ) || !isFinite(maxZ)) {
      return this.extractBodyBoundsFromShape(shape);
    }

    const box = new THREE.Box3().setFromBufferAttribute(
      shape.geometry.getAttribute('position')
    );
    const size = new THREE.Vector3();
    box.getSize(size);

    if (!isFinite(maxZ - minZ) || maxZ === minZ) {
      maxZ = box.max.z + shape.position[2];
    }

    return {
      minX, maxX, minY, maxY, minZ, maxZ,
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ
    };
  }

  generatePanels(shape: Shape, panelThickness: number = DEFAULT_PANEL_THICKNESS): GeneratedPanels | null {
    if (!this.panelJointConfig || !this.backPanelConfig) {
      console.warn('PanelManager: Profile settings not loaded');
      return null;
    }

    const bodyBounds = this.extractBodyBoundsFromFaceRoles(shape);
    if (!bodyBounds) {
      console.warn('PanelManager: Could not extract body bounds');
      return null;
    }

    const panels: PanelDefinition[] = [];
    const pt = panelThickness / 1000;
    const config = this.panelJointConfig;
    const backConfig = this.backPanelConfig;

    const innerWidth = bodyBounds.width;
    const innerHeight = bodyBounds.height;
    const innerDepth = bodyBounds.depth - (backConfig.grooveOffset / 1000) - (backConfig.backPanelThickness / 1000);

    const centerX = (bodyBounds.minX + bodyBounds.maxX) / 2;
    const centerY = (bodyBounds.minY + bodyBounds.maxY) / 2;
    const centerZ = (bodyBounds.minZ + bodyBounds.maxZ) / 2;

    const leftPanelDepth = innerDepth - (backConfig.leftPanelShorten / 1000);
    const rightPanelDepth = innerDepth - (backConfig.rightPanelShorten / 1000);
    const topPanelDepth = innerDepth - (backConfig.topPanelShorten / 1000);
    const bottomPanelDepth = innerDepth - (backConfig.bottomPanelShorten / 1000);

    const topInBetweenLeft = config.topLeftExpanded;
    const topInBetweenRight = config.topRightExpanded;
    const bottomInBetweenLeft = config.bottomLeftExpanded;
    const bottomInBetweenRight = config.bottomRightExpanded;

    let leftHeight = innerHeight;
    let rightHeight = innerHeight;
    let topWidth = innerWidth - pt * 2;
    let bottomWidth = innerWidth - pt * 2;

    if (topInBetweenLeft) {
      topWidth += pt;
      leftHeight -= pt;
    }
    if (topInBetweenRight) {
      topWidth += pt;
      rightHeight -= pt;
    }
    if (bottomInBetweenLeft) {
      bottomWidth += pt;
      leftHeight -= pt;
    }
    if (bottomInBetweenRight) {
      bottomWidth += pt;
      rightHeight -= pt;
    }

    if (config.selectedBodyType === 'bazali') {
      const bazaHeightM = config.bazaHeight / 1000;
      leftHeight += bazaHeightM;
      rightHeight += bazaHeightM;
    }

    let leftPanelY = centerY;
    let rightPanelY = centerY;
    if (topInBetweenLeft && !bottomInBetweenLeft) {
      leftPanelY -= pt / 2;
    } else if (!topInBetweenLeft && bottomInBetweenLeft) {
      leftPanelY += pt / 2;
    }
    if (topInBetweenRight && !bottomInBetweenRight) {
      rightPanelY -= pt / 2;
    } else if (!topInBetweenRight && bottomInBetweenRight) {
      rightPanelY += pt / 2;
    }

    if (config.selectedBodyType === 'bazali') {
      const bazaHeightM = config.bazaHeight / 1000;
      leftPanelY -= bazaHeightM / 2;
      rightPanelY -= bazaHeightM / 2;
    }

    panels.push({
      id: 'panel-left',
      role: 'left',
      position: [
        bodyBounds.minX + pt / 2,
        leftPanelY,
        centerZ + (backConfig.leftPanelShorten / 1000) / 2
      ],
      dimensions: [pt, leftHeight, leftPanelDepth],
      rotation: [0, 0, 0],
      color: '#f5f5f4'
    });

    panels.push({
      id: 'panel-right',
      role: 'right',
      position: [
        bodyBounds.maxX - pt / 2,
        rightPanelY,
        centerZ + (backConfig.rightPanelShorten / 1000) / 2
      ],
      dimensions: [pt, rightHeight, rightPanelDepth],
      rotation: [0, 0, 0],
      color: '#f5f5f4'
    });

    let topPanelX = centerX;
    if (topInBetweenLeft && !topInBetweenRight) {
      topPanelX -= pt / 2;
    } else if (!topInBetweenLeft && topInBetweenRight) {
      topPanelX += pt / 2;
    }

    panels.push({
      id: 'panel-top',
      role: 'top',
      position: [
        topPanelX,
        bodyBounds.maxY - pt / 2,
        centerZ + (backConfig.topPanelShorten / 1000) / 2
      ],
      dimensions: [topWidth, pt, topPanelDepth],
      rotation: [0, 0, 0],
      color: '#fed7aa'
    });

    let bottomPanelX = centerX;
    if (bottomInBetweenLeft && !bottomInBetweenRight) {
      bottomPanelX -= pt / 2;
    } else if (!bottomInBetweenLeft && bottomInBetweenRight) {
      bottomPanelX += pt / 2;
    }

    panels.push({
      id: 'panel-bottom',
      role: 'bottom',
      position: [
        bottomPanelX,
        bodyBounds.minY + pt / 2,
        centerZ + (backConfig.bottomPanelShorten / 1000) / 2
      ],
      dimensions: [bottomWidth, pt, bottomPanelDepth],
      rotation: [0, 0, 0],
      color: '#fed7aa'
    });

    const backPanelThicknessM = backConfig.backPanelThickness / 1000;
    const grooveOffsetM = backConfig.grooveOffset / 1000;
    const grooveDepthM = backConfig.grooveDepth / 1000;

    const backPanelWidth = innerWidth - pt * 2 +
      grooveDepthM * 2 +
      (backConfig.leftExtend / 1000) +
      (backConfig.rightExtend / 1000) -
      (backConfig.looseWid / 1000) * 2;

    const backPanelHeight = innerHeight - pt * 2 +
      grooveDepthM * 2 +
      (backConfig.topExtend / 1000) +
      (backConfig.bottomExtend / 1000) -
      (backConfig.looseDep / 1000) * 2;

    const backPanelZ = bodyBounds.minZ + grooveOffsetM + backPanelThicknessM / 2;

    let backPanelCenterX = centerX;
    const leftExtendM = backConfig.leftExtend / 1000;
    const rightExtendM = backConfig.rightExtend / 1000;
    if (leftExtendM !== rightExtendM) {
      backPanelCenterX += (rightExtendM - leftExtendM) / 2;
    }

    let backPanelCenterY = centerY;
    const topExtendM = backConfig.topExtend / 1000;
    const bottomExtendM = backConfig.bottomExtend / 1000;
    if (topExtendM !== bottomExtendM) {
      backPanelCenterY += (topExtendM - bottomExtendM) / 2;
    }

    panels.push({
      id: 'panel-back',
      role: 'back',
      position: [backPanelCenterX, backPanelCenterY, backPanelZ],
      dimensions: [backPanelWidth, backPanelHeight, backPanelThicknessM],
      rotation: [0, 0, 0],
      color: '#d4d4d4'
    });

    if (config.selectedBodyType === 'bazali') {
      const bazaHeightM = config.bazaHeight / 1000;
      const frontDistM = config.frontBaseDistance / 1000;
      const backDistM = config.backBaseDistance / 1000;

      panels.push({
        id: 'panel-base-front',
        role: 'base-front',
        position: [
          centerX,
          bodyBounds.minY - bazaHeightM / 2,
          bodyBounds.maxZ - frontDistM - pt / 2
        ],
        dimensions: [innerWidth - pt * 2, bazaHeightM, pt],
        rotation: [0, 0, 0],
        color: '#f5f5f4'
      });

      panels.push({
        id: 'panel-base-back',
        role: 'base-back',
        position: [
          centerX,
          bodyBounds.minY - bazaHeightM / 2,
          bodyBounds.minZ + backDistM + pt / 2
        ],
        dimensions: [innerWidth - pt * 2, bazaHeightM, pt],
        rotation: [0, 0, 0],
        color: '#f5f5f4'
      });
    }

    console.log('PanelManager: Generated panels', {
      panelCount: panels.length,
      bodyType: config.selectedBodyType,
      bodyBounds
    });

    return {
      panels,
      bodyBounds,
      panelThickness: pt
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
