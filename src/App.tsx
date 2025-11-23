import React, { useEffect, useState } from 'react';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import Terminal from './components/Terminal';
import StatusBar from './components/StatusBar';
import CatalogPanel from './components/CatalogPanel';
import { useAppStore } from './store';
import { catalogService, CatalogItem } from './services/supabase';
import { initReplicad } from './services/replicad';

function App() {
  const { opencascadeLoading, setOpenCascadeLoading } = useAppStore();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const preloadReplicad = async () => {
      try {
        console.log('🚀 Preloading Replicad on app start...');
        setOpenCascadeLoading(true);
        await initReplicad();
        console.log('✅ Replicad preloaded successfully');
      } catch (error) {
        console.error('❌ Failed to preload Replicad:', error);
      } finally {
        setOpenCascadeLoading(false);
        setIsInitializing(false);
      }
    };

    preloadReplicad();
  }, [setOpenCascadeLoading]);

  return (
    <div className="flex flex-col h-screen bg-stone-100">
      {(opencascadeLoading || isInitializing) && (
        <div className="fixed inset-0 bg-stone-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-slate-700">Loading 3D Engine...</div>
            <div className="text-xs text-slate-500">This may take a moment on mobile devices</div>
          </div>
        </div>
      )}
      <Toolbar onOpenCatalog={() => {}} />
      <div className="flex-1 overflow-hidden relative">
        <Scene />
      </div>
      <div className="relative">
        <Terminal />
        <StatusBar />
      </div>
    </div>
  );
}

export default App;
