/**
 * @file /src/components/controls/ParameterDeck.tsx
 * @description 参数面板卡片流组件 (Parameter Card Flow Deck)
 * 架构规范：
 * - 统一卡片样式：bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-3
 * - 防放大数字输入组件：输入框移动端使用 text-base sm:text-sm (16px 防止 iOS Safari 点击自动放大页面)，
 *   两侧配 w-8 h-8 的加减微调按钮与快捷增量按钮
 */

import React from 'react';
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  Sliders,
  XCircle,
} from 'lucide-react';
import {
  DovetailDriveMode,
  DovetailParameters,
  DovetailPreset,
  DovetailSolution,
} from '../../types/geometry';

interface ParameterDeckProps {
  presets: DovetailPreset[];
  activePresetId: string;
  params: DovetailParameters;
  driveMode: DovetailDriveMode;
  solution: DovetailSolution;
  onSelectPreset: (preset: DovetailPreset) => void;
  onUpdateParam: (key: keyof DovetailParameters, value: number) => void;
  onChangeDriveMode: (mode: DovetailDriveMode) => void;
}

interface ParameterCardFieldConfig {
  key: keyof DovetailParameters;
  label: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  quickSteps: number[];
  isDerived?: boolean;
  helperText: string;
}

export const ParameterDeck: React.FC<ParameterDeckProps> = ({
  presets,
  activePresetId,
  params,
  driveMode,
  solution,
  onSelectPreset,
  onUpdateParam,
  onChangeDriveMode,
}) => {
  const fields: ParameterCardFieldConfig[] = [
    {
      key: 'centerDiameter',
      label: '燕尾槽截面中心直径',
      symbol: 'Dc',
      unit: 'mm',
      min: 30.0,
      max: 320.0,
      step: 1.0,
      quickSteps: [-10, -2, 2, 10],
      helperText: '决定内外侧切点在车床 X 轴上的绝对编程直径基准',
    },
    {
      key: 'openingWidth',
      label: '端面槽口开口宽度',
      symbol: 'W1',
      unit: 'mm',
      min: 2.0,
      max: 40.0,
      step: 0.1,
      quickSteps: [-1, -0.5, 0.5, 1],
      helperText: 'Z = 0 端面处的理论尖角开口宽度',
    },
    {
      key: 'depth',
      label: '轴向燕尾槽深',
      symbol: 'H',
      unit: 'mm',
      min: 1.0,
      max: 25.0,
      step: 0.1,
      quickSteps: [-1, -0.5, 0.5, 1],
      helperText: '从右端面 Z = 0 向左切入槽底平面的轴向深度',
    },
    {
      key: 'dovetailAngleDeg',
      label: '两侧对称燕尾倾角',
      symbol: 'α',
      unit: '°',
      min: 35.0,
      max: 80.0,
      step: 0.5,
      quickSteps: [-5, -1, 1, 5],
      isDerived: driveMode === 'width_driven',
      helperText:
        driveMode === 'width_driven'
          ? '由 α = arctan(2H / (W2 - W1)) 自动反算'
          : '燕尾斜壁与右端面的内倾锐角 (常用 45° / 55° / 60°)',
    },
    {
      key: 'bottomWidth',
      label: '槽底理论最大宽度',
      symbol: 'W2',
      unit: 'mm',
      min: Number((params.openingWidth + 0.5).toFixed(1)),
      max: 65.0,
      step: 0.1,
      quickSteps: [-1, -0.5, 0.5, 1],
      isDerived: driveMode === 'angle_driven',
      helperText:
        driveMode === 'angle_driven'
          ? '由 W2 = W1 + 2·H·cot(α) 自动解算'
          : 'Z = -H 槽底处的理论尖角总宽',
    },
    {
      key: 'topFilletRadius',
      label: '槽口倒圆角半径',
      symbol: 'R1',
      unit: 'mm',
      min: 0.0,
      max: 5.0,
      step: 0.05,
      quickSteps: [-0.2, -0.1, 0.1, 0.2],
      helperText: `端面与斜壁过渡圆弧 · 切线偏移 L1 = ${solution.topTangentOffset.toFixed(3)} mm`,
    },
    {
      key: 'bottomFilletRadius',
      label: '槽底清根圆角半径',
      symbol: 'R2',
      unit: 'mm',
      min: 0.0,
      max: 5.0,
      step: 0.05,
      quickSteps: [-0.2, -0.1, 0.1, 0.2],
      helperText: `斜壁与槽底过渡圆弧 · 切线偏移 L2 = ${solution.bottomTangentOffset.toFixed(3)} mm`,
    },
  ];

  const primaryDiagnostic = solution.diagnostics[0];

  const handleDeltaStep = (field: ParameterCardFieldConfig, delta: number) => {
    if (field.isDerived) return;
    const current = params[field.key];
    const next = Math.min(
      field.max,
      Math.max(field.min, Number((current + delta).toFixed(4)))
    );
    onUpdateParam(field.key, next);
  };

  return (
    <div className="space-y-4">
      {/* 卡片 1：典型工况预设与梯形耦合驱动模式 */}
      <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-sky-400 shrink-0" />
            <h2 className="text-xs font-semibold text-slate-100">
              典型工况预设与几何驱动模式
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">mm / deg</span>
        </div>

        {/* 工况预设双列按钮网 (在移动端与非超大屏下便捷切换) */}
        <div className="grid grid-cols-2 gap-1.5 xl:hidden">
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`px-2.5 py-1.5 text-left text-xs rounded-md border transition-colors truncate cursor-pointer ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        {/* 梯形过约束耦合驱动模式切换 */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-slate-400 block">
            梯形几何约束耦合模式 (消除 W1 / W2 / H / α 过约束):
          </span>
          <div
            role="group"
            aria-label="梯形几何耦合驱动模式"
            className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => onChangeDriveMode('angle_driven')}
              className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                driveMode === 'angle_driven'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              燕尾角驱动 (求底宽 W2)
            </button>
            <button
              type="button"
              onClick={() => onChangeDriveMode('width_driven')}
              className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                driveMode === 'width_driven'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              底宽驱动 (反算角度 α)
            </button>
          </div>
        </div>
      </div>

      {/* 卡片 2：核心尺寸参数卡片流 (含防 iOS 放大输入框 + w-8 h-8 加减按钮 + 快捷增量) */}
      <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
            <h2 className="text-xs font-semibold text-slate-100">
              01. 对称梯形燕尾槽尺寸参数
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            实时解析切点
          </span>
        </div>

        <div className="space-y-3.5">
          {fields.map((field) => {
            const val = params[field.key];
            return (
              <div
                key={field.key}
                className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/90 space-y-2"
              >
                {/* 第一行：参数名称与符号标识 */}
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`param-${field.key}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-200"
                  >
                    <span>{field.label}</span>
                    <span className="text-sky-400 font-mono font-semibold">
                      [{field.symbol}]
                    </span>
                  </label>

                  {field.isDerived && (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                      <Lock className="w-3 h-3 inline" /> 自动解算
                    </span>
                  )}
                </div>

                {/* 第二行：w-8 h-8 减号按钮 + 防放大输入框 (text-base sm:text-sm) + w-8 h-8 加号按钮 */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={field.isDerived}
                    aria-label={`减小${field.label}`}
                    onClick={() => handleDeltaStep(field, -field.step)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      field.isDerived
                        ? 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 cursor-pointer'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="relative flex-1 flex items-center">
                    <input
                      id={`param-${field.key}`}
                      type="number"
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      disabled={field.isDerived}
                      value={val}
                      onChange={(e) =>
                        onUpdateParam(field.key, parseFloat(e.target.value))
                      }
                      className={`w-full h-8 pl-2.5 pr-8 text-right text-base sm:text-sm font-mono tabular-nums rounded-lg border transition-colors ${
                        field.isDerived
                          ? 'bg-slate-950/60 border-slate-800 text-amber-300 cursor-not-allowed'
                          : 'bg-slate-900 border-slate-700 text-slate-100 focus:border-sky-400 focus:outline-none'
                      }`}
                    />
                    <span className="absolute right-2.5 text-xs font-mono text-slate-400 pointer-events-none">
                      {field.unit}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={field.isDerived}
                    aria-label={`增大${field.label}`}
                    onClick={() => handleDeltaStep(field, field.step)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      field.isDerived
                        ? 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 cursor-pointer'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 第三行：位于输入框下方的快捷增量按钮组 */}
                {!field.isDerived && (
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {field.quickSteps.map((qStep) => (
                      <button
                        key={qStep}
                        type="button"
                        onClick={() => handleDeltaStep(field, qStep)}
                        className="py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-sky-300 bg-slate-900/90 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 rounded-md transition-colors cursor-pointer"
                      >
                        {qStep > 0 ? `+${qStep}` : qStep}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                  {field.helperText}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 卡片 3：衍生几何特征量与合法性诊断卡片 */}
      <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300 tabular-nums">
          <span>单侧悬伸 ΔW: {solution.undercutOverhangPerSide.toFixed(3)} mm</span>
          <span aria-hidden="true">·</span>
          <span>斜壁总长 S: {solution.inclinedWallTotalLength.toFixed(3)} mm</span>
        </div>

        <div className="h-px bg-slate-800/80" />

        {primaryDiagnostic && (
          <div className="flex items-start gap-2 text-xs">
            {primaryDiagnostic.level === 'valid' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {primaryDiagnostic.level === 'warning' && (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            {primaryDiagnostic.level === 'error' && (
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col gap-0.5">
              <span
                className={`font-semibold ${
                  primaryDiagnostic.level === 'valid'
                    ? 'text-emerald-300'
                    : primaryDiagnostic.level === 'warning'
                    ? 'text-amber-300'
                    : 'text-red-300'
                }`}
              >
                {primaryDiagnostic.level === 'valid'
                  ? '● 几何正常: '
                  : primaryDiagnostic.level === 'warning'
                  ? '▲ 几何临界: '
                  : '✕ 过切告警: '}
                {primaryDiagnostic.message}
              </span>
              {primaryDiagnostic.detail && (
                <span className="text-[11px] text-slate-400 font-mono leading-relaxed">
                  {primaryDiagnostic.detail}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
