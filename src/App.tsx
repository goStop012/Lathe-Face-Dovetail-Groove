/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 整体布局架构：全屏无页面滚动工作台 (App Shell + Asymmetric Split Console)
 * 1. 外层容器 (App Shell): flex flex-col w-screen h-screen bg-slate-950 overflow-hidden
 * 2. 顶部三区导航栏 (Header): h-13 sm:h-14 shrink-0 flex items-center justify-between px-3 sm:px-6 border-b border-slate-800
 * 3. 主工作区 (自适应双栏 / 单页切换): flex flex-1 overflow-hidden relative
 *    - 桌面端 (>= 768px, md: 断点): 左定宽 (w-80 md:w-96 shrink-0 h-full) + 右自适应分栏 (flex-1 h-full relative overflow-hidden)
 *    - 移动端 (< 768px): 基于 mobileView 状态 ('canvas' | 'params') 的 100% 全屏单视图切换
 */

import { useState } from 'react';
import { CadViewport } from './components/canvas/CadViewport';
import { ParameterDeck } from './components/controls/ParameterDeck';
import { TangentPointInspector } from './components/inspector/TangentPointInspector';
import { TopHeader } from './components/layout/TopHeader';
import { useDovetailWorkspace } from './hooks/useDovetailWorkspace';
import { MobileViewMode } from './types/geometry';

export default function App() {
  const {
    presets,
    activePresetId,
    driveMode,
    params,
    coordDisplayMode,
    selectedPointId,
    hoveredPointId,
    activePoint,
    layers,
    solution,
    viewResetCounter,
    updateParameter,
    changeDriveMode,
    applyPreset,
    resetParameters,
    setCoordDisplayMode,
    setSelectedPointId,
    setHoveredPointId,
    toggleLayer,
    resetViewportCamera,
  } = useDovetailWorkspace();

  // 移动端 (< 768px) 全屏单视图切换状态：默认展示 100% 视野的 'canvas' 图纸视图
  const [mobileView, setMobileView] = useState<MobileViewMode>('canvas');

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* 2. 顶部三区导航栏 (Header) */}
      <TopHeader
        mobileView={mobileView}
        presets={presets}
        activePresetId={activePresetId}
        onChangeMobileView={setMobileView}
        onSelectPreset={applyPreset}
        onResetParameters={resetParameters}
      />

      {/* 3. 主工作区 (自适应双栏 / 移动端全屏单页切换) */}
      <main className="flex flex-1 overflow-hidden relative">
        {/* 左侧控制栏：桌面端固定宽度 w-80 lg:w-96 独立纵向滚动；移动端当 mobileView === 'params' 时全屏显示 */}
        <aside
          aria-label="参数设置与切点坐标面板"
          className={`${
            mobileView === 'params' ? 'w-full block z-10' : 'hidden'
          } md:block md:w-80 lg:w-96 shrink-0 h-full bg-slate-900 border-r border-slate-800`}
        >
          <div className="w-full h-full flex flex-col overflow-y-auto p-3.5 space-y-4">
            <ParameterDeck
              presets={presets}
              activePresetId={activePresetId}
              params={params}
              driveMode={driveMode}
              solution={solution}
              onSelectPreset={applyPreset}
              onUpdateParam={updateParameter}
              onChangeDriveMode={changeDriveMode}
            />

            <TangentPointInspector
              solution={solution}
              selectedPointId={selectedPointId}
              hoveredPointId={hoveredPointId}
              activePoint={activePoint}
              onSelectPoint={setSelectedPointId}
              onHoverPoint={setHoveredPointId}
            />
          </div>
        </aside>

        {/* 右侧画布区：桌面端占满剩余空间 flex-1；移动端当 mobileView === 'canvas' 时获得 100% 屏幕纯净视野 */}
        <section
          aria-label="CAD 端面燕尾槽轮廓切点可视化画布"
          className={`${
            mobileView === 'canvas' ? 'block flex-1' : 'hidden'
          } md:block md:flex-1 h-full relative overflow-hidden`}
        >
          <CadViewport
            solution={solution}
            layers={layers}
            coordDisplayMode={coordDisplayMode}
            selectedPointId={selectedPointId}
            hoveredPointId={hoveredPointId}
            activePoint={activePoint}
            viewResetCounter={viewResetCounter}
            onToggleLayer={toggleLayer}
            onChangeCoordDisplayMode={setCoordDisplayMode}
            onSelectPoint={setSelectedPointId}
            onHoverPoint={setHoveredPointId}
            onResetView={resetViewportCamera}
          />
        </section>
      </main>
    </div>
  );
}
