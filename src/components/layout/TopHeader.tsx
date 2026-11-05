/**
 * @file /src/components/layout/TopHeader.tsx
 * @description 顶部三区导航栏 (App Shell Header)
 * 架构规范：
 * - 核心类名：h-13 sm:h-14 shrink-0 flex items-center justify-between px-3 sm:px-6 border-b border-slate-800
 * - 左区（品牌标识）：应用主标题 + 桌面端副标题（hidden sm:inline）
 * - 中区（移动端专属视图切换器）：flex md:hidden，包含【图纸】/【参数】分段按钮（Segmented Control）
 * - 右区（全局低频动作）：“重置参数”，移动端仅保留图标或精简文字
 */

import React from 'react';
import { Compass, RotateCcw, Sliders } from 'lucide-react';
import { DovetailPreset, MobileViewMode } from '../../types/geometry';

interface TopHeaderProps {
  mobileView: MobileViewMode;
  presets: DovetailPreset[];
  activePresetId: string;
  onChangeMobileView: (view: MobileViewMode) => void;
  onSelectPreset: (preset: DovetailPreset) => void;
  onResetParameters: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  mobileView,
  presets,
  activePresetId,
  onChangeMobileView,
  onSelectPreset,
  onResetParameters,
}) => {
  return (
    <header className="h-13 sm:h-14 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-6 bg-slate-950 border-b border-slate-800 select-none z-20">
      {/* 左区（品牌标识）：应用主标题 + 桌面端副标题 */}
      <div className="flex items-baseline gap-2.5 min-w-0 shrink-0">
        <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-100 truncate">
          端面燕尾槽切点可视化
        </h1>
        <span className="hidden sm:inline text-xs font-mono text-slate-400 whitespace-nowrap">
          Z-X 车床截面几何解析工作台
        </span>
      </div>

      {/* 中区 1（移动端专属视图切换器）：flex md:hidden，【图纸】/【参数】分段按钮 */}
      <div
        role="group"
        aria-label="移动端主视图切换"
        className="flex md:hidden items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0"
      >
        <button
          type="button"
          onClick={() => onChangeMobileView('canvas')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            mobileView === 'canvas'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold shadow-2xs'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          图纸
        </button>
        <button
          type="button"
          onClick={() => onChangeMobileView('params')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            mobileView === 'params'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold shadow-2xs'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          参数
        </button>
      </div>

      {/* 中区 2（大屏桌面端工况预设快速导航）：hidden xl:flex */}
      <nav
        aria-label="典型端面燕尾槽工况预设"
        className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-400"
      >
        {presets.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                isActive
                  ? 'text-sky-400 border-sky-400 font-semibold'
                  : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-600'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </nav>

      {/* 右区（全局低频动作）：重置参数 */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onResetParameters}
          title="重置当前工况参数并居中视图"
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">重置参数</span>
        </button>
      </div>
    </header>
  );
};
