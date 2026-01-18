import React, { useEffect, useState } from 'react';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import Terminal from './components/Terminal';
import StatusBar from './components/StatusBar';
import CatalogPanel from './components/CatalogPanel';
import CabinetDesigner from './components/CabinetDesigner';
import { useAppStore } from './store';
import { catalogService, CatalogItem } from './components/Database';
import { Box, Boxes } from 'lucide-react';

type ViewMode = '3d' | 'cabinet';

function App() {
  const { opencascadeLoading } = useAppStore();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('cabinet');

  return (
    <div className="flex flex-col h-screen bg-stone-100">
      {opencascadeLoading && (
        <div className="fixed inset-0 bg-stone-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-slate-700">Loading OpenCascade...</div>
            <div className="text-xs text-slate-500">Please wait a moment</div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('cabinet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'cabinet'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Box className="w-4 h-4" />
            Dolap Tasarımı
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === '3d'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            3D Görünüm
          </button>
        </div>
      </div>

      {viewMode === 'cabinet' ? (
        <div className="flex-1 overflow-hidden">
          <CabinetDesigner />
        </div>
      ) : (
        <>
          <Toolbar onOpenCatalog={() => {}} />
          <div className="flex-1 overflow-hidden relative">
            <Scene />
          </div>
          <div className="relative">
            <Terminal />
            <StatusBar />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
