/**
 * @file /src/components/canvas/CanvasOverlayHud.tsx
 * @description 画布层悬浮 HUD 架构模块 (Canvas Overlay HUD & Settings Popover)
 * 架构规范：
 * - 右上角（高频工具条 + 齿轮弹窗）：absolute top-2.5 right-2.5 z-30，集中放置 [放大] [缩小] [居中] | [⚙️设置]；
 *   点击齿轮在下方 top-12 right-2.5 z-40 弹出半透明毛玻璃设置卡片（Popover）
 * - 左下角（状态遥测 HUD）：absolute bottom-2.5 left-2.5 z-10，显示实时坐标 X / Z 与缩放倍率 tabular-nums
 * - 右下角（图例）：hidden lg:flex absolute bottom-3 right-3 z-10，仅在大屏显示，小屏自动隐藏以防遮挡图形
 */

import React, { useState } from 'react';
import {
  Crosshair,
  Eye,
  Grid,
  Layers,
  Maximize2,
  Ruler,
  Settings,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DovetailParameters,
  KeyGeometricPoint,
  LatheCoordDisplayMode,
  Point2D,
  ViewportLayerVisibility,
} from '../../types/geometry';

interface CanvasOverlayHudProps {
  zoom: number;
  layers: ViewportLayerVisibility;
  coordDisplayMode: LatheCoordDisplayMode;
  activePoint: KeyGeometricPoint;
  mouseWorldPos: Point2D | null;
  effectiveParams: DovetailParameters;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleLayer: (key: keyof ViewportLayerVisibility) => void;
  onChangeCoordDisplayMode: (mode: LatheCoordDisplayMode) => void;
}

export const CanvasOverlayHud: React.FC<CanvasOverlayHudProps> = ({
  zoom,
  layers,
  coordDisplayMode,
  activePoint,
  mouseWorldPos,
  effectiveParams,
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleLayer,
  onChangeCoordDisplayMode,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const layerOptions: Array<{
    key: keyof ViewportLayerVisibility;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
  }> = [
    {
      key: 'showTangentPoints',
      label: '轮廓切点靶标 (Tn)',
      icon: Crosshair,
      activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      key: 'showArcCenters',
      label: '圆弧圆心与法线 (On)',
      icon: Eye,
      activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      key: 'showTheoreticalVertices',
      label: '未倒圆理论交点 (Vn)',
      icon: Layers,
      activeClass: 'bg-slate-700/80 text-slate-200 border-slate-600',
    },
    {
      key: 'showDimensions',
      label: 'CAD 尺寸与角度标注',
      icon: Ruler,
      activeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    },
    {
      key: 'showSectionHatch',
      label: '45° 金属机械剖面线',
      icon: Layers,
      activeClass: 'bg-slate-700/80 text-slate-200 border-slate-600',
    },
    {
      key: 'showGrid',
      label: '自适应毫米坐标网格',
      icon: Grid,
      activeClass: 'bg-slate-700/80 text-slate-200 border-slate-600',
    },
  ];

  return (
    <>
      {/* =====================================================================
          1. 右上角（高频工具条）：absolute top-2.5 right-2.5 z-30
             集中放置 [放大] [缩小] [居中] | [⚙️设置]
         ===================================================================== */}
      <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-lg">
        <button
          type="button"
          onClick={onZoomIn}
          title="放大视图"
          aria-label="放大视图"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          title="缩小视图"
          aria-label="缩小视图"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onResetView}
          title="自适应居中视图"
          aria-label="自适应居中视图"
          className="px-2 h-8 flex items-center justify-center gap-1 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          <span>居中</span>
        </button>

        <div className="w-px h-4 bg-slate-700/80 mx-0.5" />

        <button
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          title="图层与坐标制式设置"
          aria-label="图层与坐标制式设置"
          aria-expanded={isSettingsOpen}
          className={`px-2.5 h-8 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            isSettingsOpen
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-200 hover:text-white hover:bg-slate-800 border border-transparent'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>设置</span>
        </button>
      </div>

      {/* =====================================================================
          2. 齿轮设置弹窗（Popover）：top-12 right-2.5 z-40 半透明毛玻璃卡片
         ===================================================================== */}
      {isSettingsOpen && (
        <div
          role="dialog"
          aria-label="CAD 视口图层与坐标制式设置"
          className="absolute top-12 right-2.5 z-40 w-72 p-3.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/90 shadow-2xl space-y-3.5 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-slate-100">
              视口图层与坐标设置
            </span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              aria-label="关闭设置弹窗"
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 车床径向坐标制式 */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 block">
              车床径向 X 坐标显示制式
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeCoordDisplayMode('diameter')}
                className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  coordDisplayMode === 'diameter'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                直径 ΦX
              </button>
              <button
                type="button"
                onClick={() => onChangeCoordDisplayMode('radius')}
                className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  coordDisplayMode === 'radius'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                半径 R
              </button>
              <button
                type="button"
                onClick={() => onChangeCoordDisplayMode('local')}
                className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  coordDisplayMode === 'local'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                对称 Δx
              </button>
            </div>
          </div>

          {/* 图层可见性开关列表 */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 block">
              CAD 工程图层显隐控制
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {layerOptions.map((opt) => {
                const Icon = opt.icon;
                const isOn = layers[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onToggleLayer(opt.key)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                      isOn
                        ? opt.activeClass
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{opt.label}</span>
                    </span>
                    <span className="font-mono text-[11px]">
                      {isOn ? '显示' : '隐藏'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. 左下角（状态遥测 HUD）：absolute bottom-2.5 left-2.5 z-10
             显示实时切点/光标坐标 ΦX / Z 与缩放倍率 tabular-nums
         ===================================================================== */}
      <div className="absolute bottom-2.5 left-2.5 z-10 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] sm:text-xs font-mono tabular-nums pointer-events-none shadow-md max-w-[calc(100%-20px)]">
        <span className="text-amber-300 font-semibold truncate">
          [{activePoint.shortLabel} {activePoint.name}] Φ
          {activePoint.coord.diameterX.toFixed(3)} · Z
          {activePoint.coord.z.toFixed(3)} mm
        </span>
        {mouseWorldPos && (
          <>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline text-slate-300">
              光标 Φ{(effectiveParams.centerDiameter + 2 * mouseWorldPos.x).toFixed(2)}{' '}
              Z{mouseWorldPos.z.toFixed(2)}
            </span>
          </>
        )}
        <span className="text-slate-600">|</span>
        <span className="text-sky-400">{zoom.toFixed(0)} px/mm</span>
      </div>

      {/* =====================================================================
          4. 右下角（图例）：hidden lg:flex absolute bottom-3 right-3 z-10
             仅在大屏显示，小屏自动隐藏以防遮挡图形
         ===================================================================== */}
      <div className="hidden lg:flex absolute bottom-3 right-3 z-10 items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs font-mono text-slate-400 pointer-events-none shadow-md">
        <span className="text-sky-400 font-medium">━ 端面与燕尾斜壁</span>
        <span aria-hidden="true">·</span>
        <span className="text-emerald-400 font-medium">╭ 过渡圆弧 (R1/R2)</span>
        <span aria-hidden="true">·</span>
        <span className="text-amber-400 font-medium">◎ 切点 (Tn)</span>
        <span aria-hidden="true">·</span>
        <span className="text-slate-400">◇ 理论交点 (Vn)</span>
      </div>
    </>
  );
};
