/**
 * @file /src/components/inspector/TangentPointInspector.tsx
 * @description 轮廓切点坐标检视卡片与全节点编程坐标对照表 (Tangent Point Inspector Card)
 * 架构规范：
 * - 统一采用 bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-3 卡片容器
 */

import React, { useState } from 'react';
import { Compass, Target } from 'lucide-react';
import {
  DovetailSolution,
  GeometricPointRole,
  KeyGeometricPoint,
} from '../../types/geometry';

interface TangentPointInspectorProps {
  solution: DovetailSolution;
  selectedPointId: string;
  hoveredPointId: string | null;
  activePoint: KeyGeometricPoint;
  onSelectPoint: (id: string) => void;
  onHoverPoint: (id: string | null) => void;
}

export const TangentPointInspector: React.FC<TangentPointInspectorProps> = ({
  solution,
  selectedPointId,
  hoveredPointId,
  activePoint,
  onSelectPoint,
  onHoverPoint,
}) => {
  const [roleFilter, setRoleFilter] = useState<GeometricPointRole | 'all'>('tangent');

  const filteredPoints = solution.points.filter((pt) =>
    roleFilter === 'all' ? true : pt.role === roleFilter
  );

  const roleTextLabel = (role: GeometricPointRole): string => {
    switch (role) {
      case 'tangent':
        return '圆弧切点';
      case 'center':
        return '圆弧圆心';
      case 'vertex':
        return '理论尖角';
      default:
        return '基准点';
    }
  };

  return (
    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-3">
      {/* 顶部标题 */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-xs font-semibold text-slate-100">
            02. 轮廓切点与几何节点精确坐标
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          点击联动高亮
        </span>
      </div>

      {/* 当前聚焦节点的数学解析子卡片 */}
      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/90 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 text-xs">
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono font-bold text-amber-300">
              {activePoint.shortLabel}
            </span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="font-semibold text-slate-100">
              {activePoint.name}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {activePoint.side === 'outer_right' ? '外径侧 (上壁)' : '内径侧 (下壁)'} ·{' '}
            {roleTextLabel(activePoint.role)}
          </span>
        </div>

        {/* 核心车床坐标读数 (tabular-nums) */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col p-2 rounded bg-slate-900/90 border border-slate-800/80">
            <span className="text-[10px] text-slate-400">直径编程 X</span>
            <span className="text-xs font-mono font-semibold text-sky-300 tabular-nums">
              Φ{activePoint.coord.diameterX.toFixed(3)}
            </span>
          </div>
          <div className="flex flex-col p-2 rounded bg-slate-900/90 border border-slate-800/80">
            <span className="text-[10px] text-slate-400">半径 R / Δx</span>
            <span className="text-xs font-mono font-semibold text-slate-200 tabular-nums">
              {activePoint.coord.radiusX.toFixed(3)}
            </span>
          </div>
          <div className="flex flex-col p-2 rounded bg-slate-900/90 border border-slate-800/80">
            <span className="text-[10px] text-slate-400">轴向坐标 Z</span>
            <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
              {activePoint.coord.z.toFixed(3)}
            </span>
          </div>
        </div>

        {/* 三角函数解析公式说明 */}
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-slate-400">
          <span>解析式: {activePoint.formulaDescription}</span>
          {activePoint.tangentOffsetLength !== undefined && (
            <span className="text-emerald-400">
              偏移 L = {activePoint.tangentOffsetLength.toFixed(3)} mm
            </span>
          )}
        </div>
      </div>

      {/* 节点分类过滤分段按钮 */}
      <div
        role="group"
        aria-label="几何节点类型过滤"
        className="grid grid-cols-4 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
      >
        <button
          type="button"
          onClick={() => setRoleFilter('tangent')}
          className={`py-1.5 px-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            roleFilter === 'tangent'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          切点 (8)
        </button>
        <button
          type="button"
          onClick={() => setRoleFilter('center')}
          className={`py-1.5 px-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            roleFilter === 'center'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          圆心 (4)
        </button>
        <button
          type="button"
          onClick={() => setRoleFilter('vertex')}
          className={`py-1.5 px-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            roleFilter === 'vertex'
              ? 'bg-slate-700/80 text-slate-200 border border-slate-600 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          角点 (4)
        </button>
        <button
          type="button"
          onClick={() => setRoleFilter('all')}
          className={`py-1.5 px-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            roleFilter === 'all'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          全部 (16)
        </button>
      </div>

      {/* 节点精确坐标表格 */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-950">
        <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
              <th className="py-2 px-2 font-medium">代号</th>
              <th className="py-2 px-2 font-medium font-sans">几何特征部位</th>
              <th className="py-2 px-2 font-medium text-right">直径 ΦX</th>
              <th className="py-2 px-2 font-medium text-right">轴向 Z</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredPoints.map((pt) => {
              const isSelected = selectedPointId === pt.id;
              const isHovered = hoveredPointId === pt.id;
              return (
                <tr
                  key={pt.id}
                  onClick={() => onSelectPoint(pt.id)}
                  onMouseEnter={() => onHoverPoint(pt.id)}
                  onMouseLeave={() => onHoverPoint(null)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-200'
                      : isHovered
                      ? 'bg-slate-800/70 text-slate-100'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <td className="py-2 px-2 font-semibold text-amber-300 whitespace-nowrap">
                    {pt.shortLabel}
                  </td>
                  <td className="py-2 px-2 font-sans text-slate-200 whitespace-nowrap">
                    {pt.name}
                  </td>
                  <td className="py-2 px-2 text-right text-sky-300 font-medium whitespace-nowrap">
                    {pt.coord.diameterX.toFixed(3)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-100 whitespace-nowrap">
                    {pt.coord.z.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
