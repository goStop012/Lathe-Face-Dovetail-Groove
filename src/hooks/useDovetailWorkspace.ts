/**
 * @file /src/hooks/useDovetailWorkspace.ts
 * @description 应用状态与约束协调层 (Application State & Hook Layer)
 * 负责管理端面燕尾槽的参数状态、过约束耦合切换、预设加载、参数重置、节点拾取高亮及 CAD 视口图层开关。
 */

import { useCallback, useMemo, useState } from 'react';
import { DOVETAIL_PRESETS } from '../domain/dovetailPresets';
import { solveDovetailGeometry, synchronizeCoupledParameters } from '../domain/dovetailSolver';
import {
  DovetailDriveMode,
  DovetailParameters,
  DovetailPreset,
  LatheCoordDisplayMode,
  ViewportLayerVisibility,
} from '../types/geometry';

export function useDovetailWorkspace() {
  const defaultPreset = DOVETAIL_PRESETS[0];

  const [activePresetId, setActivePresetId] = useState<string>(defaultPreset.id);
  const [driveMode, setDriveMode] = useState<DovetailDriveMode>(defaultPreset.driveMode);
  const [params, setParams] = useState<DovetailParameters>(defaultPreset.params);
  const [coordDisplayMode, setCoordDisplayMode] = useState<LatheCoordDisplayMode>('diameter');

  // 拾取与悬停的特征点 ID (默认选中外径侧槽口斜壁切点 T_R2)
  const [selectedPointId, setSelectedPointId] = useState<string>('T_R2');
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  // CAD 画布图层可见性控制
  const [layers, setLayers] = useState<ViewportLayerVisibility>({
    showTangentPoints: true,
    showArcCenters: true,
    showTheoreticalVertices: true,
    showDimensions: true,
    showSectionHatch: true,
    showGrid: true,
  });

  // 视口复位信号计数器
  const [viewResetCounter, setViewResetCounter] = useState<number>(0);

  // 实时解算当前燕尾槽几何与切点
  const solution = useMemo(
    () => solveDovetailGeometry(params, driveMode),
    [params, driveMode]
  );

  // 更新单个参数并保持梯形几何方程同步
  const updateParameter = useCallback(
    (key: keyof DovetailParameters, value: number) => {
      if (Number.isNaN(value)) return;
      setActivePresetId('custom');
      setParams((prev) => {
        const nextRaw = { ...prev, [key]: value };
        return synchronizeCoupledParameters(nextRaw, driveMode);
      });
    },
    [driveMode]
  );

  // 切换驱动模式 ('angle_driven' <-> 'width_driven')
  const changeDriveMode = useCallback((nextMode: DovetailDriveMode) => {
    setDriveMode(nextMode);
    setParams((prev) => synchronizeCoupledParameters(prev, nextMode));
  }, []);

  // 应用预设规格
  const applyPreset = useCallback((preset: DovetailPreset) => {
    setActivePresetId(preset.id);
    setDriveMode(preset.driveMode);
    setParams(synchronizeCoupledParameters(preset.params, preset.driveMode));
    setViewResetCounter((c) => c + 1);
  }, []);

  // 重置为默认标准工况参数并居中视图
  const resetParameters = useCallback(() => {
    const targetPreset =
      DOVETAIL_PRESETS.find((p) => p.id === activePresetId) ?? defaultPreset;
    setActivePresetId(targetPreset.id);
    setDriveMode(targetPreset.driveMode);
    setParams(synchronizeCoupledParameters(targetPreset.params, targetPreset.driveMode));
    setViewResetCounter((c) => c + 1);
  }, [activePresetId, defaultPreset]);

  // 切换图层开关
  const toggleLayer = useCallback((key: keyof ViewportLayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // 触发画布自适应居中复位
  const resetViewportCamera = useCallback(() => {
    setViewResetCounter((c) => c + 1);
  }, []);

  // 当前在检视器中聚焦展示的特征点 (悬停优先，其次为点击选中)
  const activePoint = useMemo(() => {
    const targetId = hoveredPointId ?? selectedPointId;
    return solution.pointMap[targetId] ?? solution.points[0];
  }, [hoveredPointId, selectedPointId, solution]);

  return {
    presets: DOVETAIL_PRESETS,
    activePresetId,
    driveMode,
    params: solution.effectiveParams,
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
  };
}
