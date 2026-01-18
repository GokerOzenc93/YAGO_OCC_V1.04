import React, { useState } from 'react';
import { Layers, Move, Box, Grid3x3, Info } from 'lucide-react';

type JointType = 'butt' | 'dowel' | 'dado' | 'miter';
type BaseType = 'legs' | 'base';

interface PanelJoint {
  id: string;
  name: string;
  type: JointType;
  description: string;
}

const jointTypes: PanelJoint[] = [
  { id: '1', name: 'Alın Birleşim', type: 'butt', description: 'Basit ve hızlı montaj' },
  { id: '2', name: 'Dübel Birleşim', type: 'dowel', description: 'Sağlam ve görünmez' },
  { id: '3', name: 'Yuvarlı Birleşim', type: 'dado', description: 'Raf desteği için ideal' },
  { id: '4', name: 'Gönye Birleşim', type: 'miter', description: 'Estetik köşe birleşimi' }
];

export default function CabinetDesigner() {
  const [selectedJoint, setSelectedJoint] = useState<JointType>('dowel');
  const [baseType, setBaseType] = useState<BaseType>('legs');
  const [cabinetWidth, setCabinetWidth] = useState(800);
  const [cabinetHeight, setCabinetHeight] = useState(1200);
  const [shelfCount, setShelfCount] = useState(3);

  const renderJointDetail = (joint: JointType, x: number, y: number) => {
    switch (joint) {
      case 'butt':
        return (
          <g>
            <line x1={x} y1={y} x2={x + 20} y2={y} stroke="#64748b" strokeWidth="3" />
            <line x1={x + 20} y1={y} x2={x + 20} y2={y + 30} stroke="#64748b" strokeWidth="3" />
          </g>
        );
      case 'dowel':
        return (
          <g>
            <line x1={x} y1={y} x2={x + 20} y2={y} stroke="#64748b" strokeWidth="3" />
            <circle cx={x + 20} cy={y + 10} r="3" fill="#f97316" />
            <circle cx={x + 20} cy={y + 20} r="3" fill="#f97316" />
            <line x1={x + 20} y1={y} x2={x + 20} y2={y + 30} stroke="#64748b" strokeWidth="3" />
          </g>
        );
      case 'dado':
        return (
          <g>
            <rect x={x + 15} y={y - 2} width="10" height="4" fill="#64748b" />
            <line x1={x} y1={y} x2={x + 25} y2={y} stroke="#64748b" strokeWidth="3" />
            <line x1={x + 20} y1={y} x2={x + 20} y2={y + 30} stroke="#64748b" strokeWidth="3" />
          </g>
        );
      case 'miter':
        return (
          <g>
            <line x1={x} y1={y} x2={x + 20} y2={y + 20} stroke="#64748b" strokeWidth="3" />
            <line x1={x + 20} y1={y + 20} x2={x + 20} y2={y + 30} stroke="#64748b" strokeWidth="3" />
          </g>
        );
    }
  };

  const renderCabinet = () => {
    const scale = 0.25;
    const width = cabinetWidth * scale;
    const height = cabinetHeight * scale;
    const panelThickness = 18 * scale;
    const legHeight = 100 * scale;
    const baseHeight = 50 * scale;

    return (
      <svg width="100%" height="100%" viewBox="0 0 300 450" className="mx-auto">
        <defs>
          <pattern id="wood" patternUnits="userSpaceOnUse" width="40" height="40">
            <rect width="40" height="40" fill="#d4a574" />
            <path d="M0 0 L40 40 M40 0 L0 40" stroke="#c69963" strokeWidth="0.5" opacity="0.3" />
          </pattern>
          <linearGradient id="panel-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b7355" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#8b7355" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        <g transform="translate(50, 30)">
          <rect x={-5} y={-5} width={width + 10} height={height + (baseType === 'legs' ? legHeight : baseHeight) + 10}
                fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="4" />

          <rect x="0" y="0" width={width} height={height}
                fill="url(#panel-gradient)" stroke="#6b5847" strokeWidth="2" filter="url(#shadow)" />

          <rect x="0" y="0" width={panelThickness} height={height}
                fill="url(#wood)" stroke="#6b5847" strokeWidth="1.5" />
          <rect x={width - panelThickness} y="0" width={panelThickness} height={height}
                fill="url(#wood)" stroke="#6b5847" strokeWidth="1.5" />

          <rect x="0" y="0" width={width} height={panelThickness}
                fill="url(#wood)" stroke="#6b5847" strokeWidth="1.5" />
          <rect x="0" y={height - panelThickness} width={width} height={panelThickness}
                fill="url(#wood)" stroke="#6b5847" strokeWidth="1.5" />

          {Array.from({ length: shelfCount }).map((_, i) => {
            const shelfY = ((height - panelThickness * 2) / (shelfCount + 1)) * (i + 1) + panelThickness;
            return (
              <g key={i}>
                <rect x={panelThickness} y={shelfY - panelThickness / 2}
                      width={width - panelThickness * 2} height={panelThickness}
                      fill="url(#wood)" stroke="#6b5847" strokeWidth="1.5" />
                {renderJointDetail(selectedJoint, panelThickness - 5, shelfY)}
                {renderJointDetail(selectedJoint, width - panelThickness - 15, shelfY)}
              </g>
            );
          })}

          {baseType === 'legs' ? (
            <>
              <rect x={panelThickness} y={height} width={panelThickness * 1.2} height={legHeight}
                    fill="#4a4a4a" stroke="#2d2d2d" strokeWidth="1" rx="2" filter="url(#shadow)" />
              <rect x={width - panelThickness * 2.2} y={height} width={panelThickness * 1.2} height={legHeight}
                    fill="#4a4a4a" stroke="#2d2d2d" strokeWidth="1" rx="2" filter="url(#shadow)" />

              <circle cx={panelThickness + panelThickness * 0.6} cy={height + legHeight - 5} r="3" fill="#6b7280" />
              <circle cx={width - panelThickness * 2.2 + panelThickness * 0.6} cy={height + legHeight - 5} r="3" fill="#6b7280" />
            </>
          ) : (
            <>
              <rect x="0" y={height} width={width} height={baseHeight}
                    fill="url(#wood)" stroke="#6b5847" strokeWidth="2" filter="url(#shadow)" />
              <rect x="0" y={height} width={width} height={panelThickness}
                    fill="#8b7355" stroke="#6b5847" strokeWidth="1" />
              <rect x={panelThickness * 2} y={height + baseHeight - 8}
                    width={width - panelThickness * 4} height="8"
                    fill="#2d2d2d" stroke="#1a1a1a" strokeWidth="1" rx="2" />
            </>
          )}

          <g opacity="0.3">
            <line x1={panelThickness} y1="0" x2={panelThickness} y2={height}
                  stroke="#f97316" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={width - panelThickness} y1="0" x2={width - panelThickness} y2={height}
                  stroke="#f97316" strokeWidth="1" strokeDasharray="4 4" />
          </g>
        </g>

        <text x="150" y="420" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="600">
          {cabinetWidth}mm × {cabinetHeight}mm
        </text>
      </svg>
    );
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                <Box className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Dolap Tasarım Arayüzü</h1>
                <p className="text-sm text-slate-500">Panel birleşim tipleri ve tasarım seçenekleri</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Profesyonel Tasarım Modu</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          <div className="flex-1 bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
              <Grid3x3 className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-800">Ön Görünüş</h2>
            </div>
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-white rounded-lg border-2 border-dashed border-slate-200">
              {renderCabinet()}
            </div>
          </div>

          <div className="w-80 flex flex-col gap-6">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                <Layers className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-slate-800">Birleşim Tipi</h2>
              </div>
              <div className="space-y-2">
                {jointTypes.map((joint) => (
                  <button
                    key={joint.id}
                    onClick={() => setSelectedJoint(joint.type)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedJoint === joint.type
                        ? 'border-orange-500 bg-orange-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{joint.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{joint.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                <Move className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-800">Kaide Tipi</h2>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setBaseType('legs')}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    baseType === 'legs'
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="font-semibold text-slate-800">Ayaklı Dolap</div>
                  <div className="text-xs text-slate-500 mt-1">Metal ayaklarla yükseltilmiş</div>
                </button>
                <button
                  onClick={() => setBaseType('base')}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    baseType === 'base'
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="font-semibold text-slate-800">Bazalı Dolap</div>
                  <div className="text-xs text-slate-500 mt-1">Ahşap kaide ile zemin</div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-200">Ölçüler</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Genişlik: {cabinetWidth}mm
                  </label>
                  <input
                    type="range"
                    min="600"
                    max="1200"
                    step="50"
                    value={cabinetWidth}
                    onChange={(e) => setCabinetWidth(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yükseklik: {cabinetHeight}mm
                  </label>
                  <input
                    type="range"
                    min="800"
                    max="2000"
                    step="100"
                    value={cabinetHeight}
                    onChange={(e) => setCabinetHeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Raf Sayısı: {shelfCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={shelfCount}
                    onChange={(e) => setShelfCount(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
