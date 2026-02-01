import { PanelGeometry } from '../../types/Panel';
import { BasePanelGeometry } from './BasePanelGeometry';
import { LeftPanelGeometry } from './LeftPanel';
import { RightPanelGeometry } from './RightPanel';
import { TopPanelGeometry } from './TopPanel';
import { BottomPanelGeometry } from './BottomPanel';
import { BackPanelGeometry } from './BackPanel';
import { FrontPanelGeometry } from './FrontPanel';
import { ShelfPanelGeometry } from './ShelfPanel';

export class PanelFactory {
  static createPanel(geometry: PanelGeometry): BasePanelGeometry {
    const role = geometry.role.toLowerCase();

    switch (role) {
      case 'left':
        return new LeftPanelGeometry(geometry);
      case 'right':
        return new RightPanelGeometry(geometry);
      case 'top':
        return new TopPanelGeometry(geometry);
      case 'bottom':
        return new BottomPanelGeometry(geometry);
      case 'back':
        return new BackPanelGeometry(geometry);
      case 'front':
        return new FrontPanelGeometry(geometry);
      case 'shelf':
        return new ShelfPanelGeometry(geometry);
      default:
        return new LeftPanelGeometry(geometry);
    }
  }
}
