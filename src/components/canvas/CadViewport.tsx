/**
 * @file /src/components/canvas/CadViewport.tsx
 * @description 100% 全屏纯净视野矢量 SVG 工程制图画布 (Full-Bleed CAD Viewport with Floating HUD)
 *
 * 架构规范：
 * - 画布采用 relative w-full h-full touch-none bg-[#0B1120] overflow-hidden
 * - 底层：<svg className="w-full h-full"> 承接单指拖拽、双指捏合缩放与滚轮事件
 * - 悬浮层：由 CanvasOverlayHud 统一通过 absolute 贴边悬浮管理，互不干扰，不挤压画布高度
 */

import React, { useMemo } from 'react';
import { useCadViewportCamera } from '../../hooks/useCadViewportCamera';
import {
  DovetailSolution,
  KeyGeometricPoint,
  LatheCoordDisplayMode,
  ViewportLayerVisibility,
} from '../../types/geometry';
import { CanvasOverlayHud } from './CanvasOverlayHud';

interface CadViewportProps {
  solution: DovetailSolution;
  layers: ViewportLayerVisibility;
  coordDisplayMode: LatheCoordDisplayMode;
  selectedPointId: string;
  hoveredPointId: string | null;
  activePoint: KeyGeometricPoint;
  viewResetCounter: number;
  onToggleLayer: (key: keyof ViewportLayerVisibility) => void;
  onChangeCoordDisplayMode: (mode: LatheCoordDisplayMode) => void;
  onSelectPoint: (id: string) => void;
  onHoverPoint: (id: string | null) => void;
  onResetView: () => void;
}

export const CadViewport: React.FC<CadViewportProps> = ({
  solution,
  layers,
  coordDisplayMode,
  selectedPointId,
  hoveredPointId,
  activePoint,
  viewResetCounter,
  onToggleLayer,
  onChangeCoordDisplayMode,
  onSelectPoint,
  onHoverPoint,
  onResetView,
}) => {
  const { pointMap, effectiveParams } = solution;

  const {
    svgStageRef,
    viewportSize,
    isCompactViewport,
    camera,
    originScreenX,
    originScreenY,
    isDragging,
    mouseWorldPos,
    worldToScreen,
    screenToWorld,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    zoomIn,
    zoomOut,
  } = useCadViewportCamera({
    effectiveParams,
    viewResetCounter,
  });

  // 构建缩放后的车床工件端面剖面 SVG Path 及外圆/内孔边界坐标
  const workpieceGeometry = useMemo(() => {
    const { contourPrimitives } = solution;
    if (contourPrimitives.length === 0) return null;

    const firstSeg = contourPrimitives[0];
    const innerStartPt = firstSeg.type === 'line' ? firstSeg.start : firstSeg.startPoint;
    const lastSeg = contourPrimitives[contourPrimitives.length - 1];
    const outerEndPt = lastSeg.type === 'line' ? lastSeg.end : lastSeg.endPoint;

    const p0 = worldToScreen(innerStartPt.x, innerStartPt.z);
    const cmds: string[] = [`M ${p0.sx.toFixed(2)} ${p0.sy.toFixed(2)}`];

    for (const prim of contourPrimitives) {
      if (prim.type === 'line') {
        const pEnd = worldToScreen(prim.end.x, prim.end.z);
        cmds.push(`L ${pEnd.sx.toFixed(2)} ${pEnd.sy.toFixed(2)}`);
      } else {
        const pEnd = worldToScreen(prim.endPoint.x, prim.endPoint.z);
        const rPx = prim.radius * camera.zoom;
        cmds.push(
          `A ${rPx.toFixed(2)} ${rPx.toFixed(2)} 0 ${prim.largeArcFlag} ${prim.sweepFlag} ${pEnd.sx.toFixed(2)} ${pEnd.sy.toFixed(2)}`
        );
      }
    }

    const backZ = -(effectiveParams.depth + Math.max(effectiveParams.depth * 0.65, 4.5));
    const pBackOuter = worldToScreen(outerEndPt.x, backZ);
    const pBackInner = worldToScreen(innerStartPt.x, backZ);
    const pFrontOuter = worldToScreen(outerEndPt.x, outerEndPt.z);
    const pFrontInner = worldToScreen(innerStartPt.x, innerStartPt.z);

    cmds.push(`L ${pBackOuter.sx.toFixed(2)} ${pBackOuter.sy.toFixed(2)}`);
    cmds.push(`L ${pBackInner.sx.toFixed(2)} ${pBackInner.sy.toFixed(2)}`);
    cmds.push('Z');

    const odDiameter = effectiveParams.centerDiameter + 2 * outerEndPt.x;
    const idDiameter = Math.max(0, effectiveParams.centerDiameter + 2 * innerStartPt.x);

    return {
      svgPath: cmds.join(' '),
      pBackOuter,
      pBackInner,
      pFrontOuter,
      pFrontInner,
      odDiameter,
      idDiameter,
      backZ,
    };
  }, [solution, effectiveParams, worldToScreen, camera.zoom]);

  // 自适应背景网格线计算 (水平为 Z 轴，垂直为 X 轴)
  const gridLines = useMemo(() => {
    if (!layers.showGrid) return { verticalsZ: [], horizontalsX: [], stepMm: 1 };

    let stepMm = 1;
    if (camera.zoom > 75) stepMm = 0.5;
    else if (camera.zoom < 18) stepMm = 5;
    else if (camera.zoom < 32) stepMm = 2;

    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(viewportSize.width, viewportSize.height);

    const startZ = Math.floor(topLeft.z / stepMm) * stepMm;
    const endZ = Math.ceil(bottomRight.z / stepMm) * stepMm;

    const startX = Math.floor(bottomRight.x / stepMm) * stepMm;
    const endX = Math.ceil(topLeft.x / stepMm) * stepMm;

    const verticalsZ: Array<{ sx: number; zVal: number; isMajor: boolean }> = [];
    for (let z = startZ; z <= endZ; z += stepMm) {
      const { sx } = worldToScreen(0, z);
      const isMajor = Math.abs(Math.round(z / stepMm) % 5) === 0;
      verticalsZ.push({ sx, zVal: z, isMajor });
    }

    const horizontalsX: Array<{ sy: number; xVal: number; isMajor: boolean }> = [];
    for (let x = startX; x <= endX; x += stepMm) {
      const { sy } = worldToScreen(x, 0);
      const isMajor = Math.abs(Math.round(x / stepMm) % 5) === 0;
      horizontalsX.push({ sy, xVal: x, isMajor });
    }

    return { verticalsZ, horizontalsX, stepMm };
  }, [layers.showGrid, camera.zoom, screenToWorld, viewportSize, worldToScreen]);

  // 格式化点的径向 X 坐标文本
  const formatRadialCoord = (pt: KeyGeometricPoint): string => {
    const decimals = isCompactViewport ? 2 : 3;
    if (coordDisplayMode === 'diameter') {
      return `X${pt.coord.diameterX.toFixed(decimals)}`;
    }
    if (coordDisplayMode === 'radius') {
      return `R${pt.coord.radiusX.toFixed(decimals)}`;
    }
    const sign = pt.coord.localX >= 0 ? '+' : '';
    return `x${sign}${pt.coord.localX.toFixed(decimals)}`;
  };

  // 获取关键几何点引用
  const vLTop = pointMap['V_L_TOP'];
  const vLBot = pointMap['V_L_BOT'];
  const vRBot = pointMap['V_R_BOT'];
  const vRTop = pointMap['V_R_TOP'];

  const tL1 = pointMap['T_L1'];
  const tL2 = pointMap['T_L2'];
  const tL3 = pointMap['T_L3'];
  const tL4 = pointMap['T_L4'];
  const tR4 = pointMap['T_R4'];
  const tR3 = pointMap['T_R3'];
  const tR2 = pointMap['T_R2'];
  const tR1 = pointMap['T_R1'];

  // 端面视图下的切点标签防遮挡偏移方向配置
  const getLabelPlacement = (
    pt: KeyGeometricPoint
  ): { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' } => {
    switch (pt.id) {
      case 'T_R1':
        return { dx: 10, dy: -8, anchor: 'start' };
      case 'T_R2':
        return { dx: 10, dy: 14, anchor: 'start' };
      case 'T_R3':
        return { dx: -10, dy: -12, anchor: 'end' };
      case 'T_R4':
        return { dx: -10, dy: 14, anchor: 'end' };
      case 'T_L4':
        return { dx: -10, dy: -10, anchor: 'end' };
      case 'T_L3':
        return { dx: -10, dy: 16, anchor: 'end' };
      case 'T_L2':
        return { dx: 10, dy: -10, anchor: 'start' };
      case 'T_L1':
        return { dx: 10, dy: 14, anchor: 'start' };
      default:
        return { dx: 8, dy: -6, anchor: 'start' };
    }
  };

  return (
    <div
      ref={svgStageRef}
      className="relative w-full h-full touch-none bg-[#0B1120] select-none overflow-hidden"
    >
      {/* 悬浮 HUD 层：右上角工具条+齿轮弹窗、左下角实时坐标遥测、右下角大屏图例 */}
      <CanvasOverlayHud
        zoom={camera.zoom}
        layers={layers}
        coordDisplayMode={coordDisplayMode}
        activePoint={activePoint}
        mouseWorldPos={mouseWorldPos}
        effectiveParams={effectiveParams}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetView={onResetView}
        onToggleLayer={onToggleLayer}
        onChangeCoordDisplayMode={onChangeCoordDisplayMode}
      />

      {/* 底层 100% 满屏 SVG 矢量画布 */}
      <svg
        width={viewportSize.width}
        height={viewportSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`w-full h-full block touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <defs>
          <pattern
            id="cad-metal-hatch"
            width="12"
            height="12"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="12"
              stroke="#1E293B"
              strokeWidth="1.5"
            />
          </pattern>

          <marker
            id="dim-arrow-end"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#94A3B8" />
          </marker>
        </defs>

        {/* =================================================================
            Layer 1: 自适应毫米工程坐标网格 (Millimeter Grid)
           ================================================================= */}
        {layers.showGrid && (
          <g className="pointer-events-none">
            {gridLines.verticalsZ.map((v, idx) => (
              <line
                key={`vz-${idx}`}
                x1={v.sx}
                y1={0}
                x2={v.sx}
                y2={viewportSize.height}
                stroke={v.isMajor ? '#1E293B' : '#0F172A'}
                strokeWidth={v.isMajor ? 1 : 0.75}
              />
            ))}
            {gridLines.horizontalsX.map((h, idx) => (
              <line
                key={`hx-${idx}`}
                x1={0}
                y1={h.sy}
                x2={viewportSize.width}
                y2={h.sy}
                stroke={h.isMajor ? '#1E293B' : '#0F172A'}
                strokeWidth={h.isMajor ? 1 : 0.75}
              />
            ))}
          </g>
        )}

        {/* =================================================================
            Layer 2: 车床端面基准线 (垂直线 Z = 0) 与燕尾槽中心直径轴线 (水平线 Φ D_center)
           ================================================================= */}
        <g className="pointer-events-none">
          <line
            x1={originScreenX}
            y1={0}
            x2={originScreenX}
            y2={viewportSize.height}
            stroke="#334155"
            strokeWidth={1.1}
            strokeDasharray="6 4"
          />
          <text
            x={originScreenX + 6}
            y={20}
            fill="#7DD3FC"
            fontSize={isCompactViewport ? '10' : '11'}
            className="font-mono"
          >
            {isCompactViewport ? 'Z=0 (右端面)' : 'Z = 0.000 (工件右端面基准)'}
          </text>

          {/* 燕尾槽截面中心对称水平点划线 (x = 0, Φ D_center) */}
          <line
            x1={12}
            y1={originScreenY}
            x2={viewportSize.width - 12}
            y2={originScreenY}
            stroke="#475569"
            strokeWidth={1.2}
            strokeDasharray="12 4 2 4"
          />
          <text
            x={12}
            y={originScreenY - 7}
            fill="#94A3B8"
            fontSize={isCompactViewport ? '10' : '11'}
            className="font-mono"
          >
            {isCompactViewport
              ? `对称轴 Φ${effectiveParams.centerDiameter.toFixed(1)}`
              : `燕尾槽对称中心基准 Φ${effectiveParams.centerDiameter.toFixed(2)} mm (x = 0)`}
          </text>

          {/* 底部车床主轴回转中心轴线示意 */}
          <line
            x1={12}
            y1={viewportSize.height - 46}
            x2={viewportSize.width - 12}
            y2={viewportSize.height - 46}
            stroke="#334155"
            strokeWidth={1.2}
            strokeDasharray="16 5 3 5"
          />
          <text
            x={12}
            y={viewportSize.height - 52}
            fill="#64748B"
            fontSize={isCompactViewport ? '9.5' : '10.5'}
            className="font-mono"
          >
            {isCompactViewport
              ? '── 车床主轴中心线 (Z轴, Φ0)'
              : 'centerline ── 车床主轴回转中心线 (Spindle Z-Axis, Φ0)'}
          </text>
        </g>

        {/* =================================================================
            Layer 3: 工件金属基体剖面填充、45° 剖面线及外圆/卡盘侧说明
           ================================================================= */}
        {workpieceGeometry && (
          <g className="pointer-events-none font-mono">
            <path
              d={workpieceGeometry.svgPath}
              fill="#0F172A"
              fillOpacity={0.8}
            />
            {layers.showSectionHatch && (
              <path
                d={workpieceGeometry.svgPath}
                fill="url(#cad-metal-hatch)"
                stroke="#334155"
                strokeWidth={1.2}
              />
            )}

            {/* 工件顶部外圆母线高亮与标注 */}
            <line
              x1={workpieceGeometry.pBackOuter.sx}
              y1={workpieceGeometry.pBackOuter.sy}
              x2={workpieceGeometry.pFrontOuter.sx}
              y2={workpieceGeometry.pFrontOuter.sy}
              stroke="#475569"
              strokeWidth={2}
            />
            <text
              x={(workpieceGeometry.pBackOuter.sx + workpieceGeometry.pFrontOuter.sx) / 2}
              y={workpieceGeometry.pBackOuter.sy - 7}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize={isCompactViewport ? '10' : '11'}
            >
              {isCompactViewport
                ? `外圆 OD Φ${workpieceGeometry.odDiameter.toFixed(1)}`
                : `工件外圆母线 (OD ≈ Φ${workpieceGeometry.odDiameter.toFixed(1)})`}
            </text>

            {/* 工件底部内孔/基体边界标注 */}
            <line
              x1={workpieceGeometry.pBackInner.sx}
              y1={workpieceGeometry.pBackInner.sy}
              x2={workpieceGeometry.pFrontInner.sx}
              y2={workpieceGeometry.pFrontInner.sy}
              stroke="#475569"
              strokeWidth={2}
            />
            <text
              x={(workpieceGeometry.pBackInner.sx + workpieceGeometry.pFrontInner.sx) / 2}
              y={workpieceGeometry.pBackInner.sy + 14}
              textAnchor="middle"
              fill="#64748B"
              fontSize={isCompactViewport ? '9.5' : '10.5'}
            >
              {isCompactViewport
                ? `内侧 ID Φ${workpieceGeometry.idDiameter.toFixed(1)}`
                : `工件内侧基体边界 (ID ≈ Φ${workpieceGeometry.idDiameter.toFixed(1)})`}
            </text>

            {!isCompactViewport && (
              <text
                x={workpieceGeometry.pBackOuter.sx - 10}
                y={(workpieceGeometry.pBackOuter.sy + workpieceGeometry.pBackInner.sy) / 2}
                textAnchor="end"
                fill="#64748B"
                fontSize="11"
              >
                ◀ 卡盘侧 (-Z)
              </text>
            )}
          </g>
        )}

        {/* =================================================================
            Layer 4: 未倒圆理论尖角交点与斜壁延长虚线 (Theoretical Sharp Vertices Vn)
           ================================================================= */}
        {layers.showTheoreticalVertices && vLTop && vLBot && vRBot && vRTop && (
          <g className="pointer-events-none">
            {(() => {
              const pVLTop = worldToScreen(vLTop.coord.localX, vLTop.coord.z);
              const pVLBot = worldToScreen(vLBot.coord.localX, vLBot.coord.z);
              const pTL1 = worldToScreen(tL1.coord.localX, tL1.coord.z);
              const pTL2 = worldToScreen(tL2.coord.localX, tL2.coord.z);
              const pTL3 = worldToScreen(tL3.coord.localX, tL3.coord.z);
              const pTL4 = worldToScreen(tL4.coord.localX, tL4.coord.z);

              const pVRTop = worldToScreen(vRTop.coord.localX, vRTop.coord.z);
              const pVRBot = worldToScreen(vRBot.coord.localX, vRBot.coord.z);
              const pTR1 = worldToScreen(tR1.coord.localX, tR1.coord.z);
              const pTR2 = worldToScreen(tR2.coord.localX, tR2.coord.z);
              const pTR3 = worldToScreen(tR3.coord.localX, tR3.coord.z);
              const pTR4 = worldToScreen(tR4.coord.localX, tR4.coord.z);

              return (
                <>
                  <line
                    x1={pTL1.sx}
                    y1={pTL1.sy}
                    x2={pVLTop.sx}
                    y2={pVLTop.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pVLTop.sx}
                    y1={pVLTop.sy}
                    x2={pTL2.sx}
                    y2={pTL2.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pTL3.sx}
                    y1={pTL3.sy}
                    x2={pVLBot.sx}
                    y2={pVLBot.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pVLBot.sx}
                    y1={pVLBot.sy}
                    x2={pTL4.sx}
                    y2={pTL4.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pTR4.sx}
                    y1={pTR4.sy}
                    x2={pVRBot.sx}
                    y2={pVRBot.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pVRBot.sx}
                    y1={pVRBot.sy}
                    x2={pTR3.sx}
                    y2={pTR3.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pTR2.sx}
                    y1={pTR2.sy}
                    x2={pVRTop.sx}
                    y2={pVRTop.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={pVRTop.sx}
                    y1={pVRTop.sy}
                    x2={pTR1.sx}
                    y2={pTR1.sy}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                </>
              );
            })()}

            {[vLTop, vLBot, vRBot, vRTop].map((vPt) => {
              const { sx, sy } = worldToScreen(vPt.coord.localX, vPt.coord.z);
              const isSelected = selectedPointId === vPt.id || hoveredPointId === vPt.id;
              const isTopLip = vPt.id.includes('TOP');
              return (
                <g
                  key={vPt.id}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPoint(vPt.id);
                  }}
                  onMouseEnter={() => onHoverPoint(vPt.id)}
                  onMouseLeave={() => onHoverPoint(null)}
                >
                  <circle cx={sx} cy={sy} r={14} fill="transparent" />
                  <polygon
                    points={`${sx},${sy - 5} ${sx + 5},${sy} ${sx},${sy + 5} ${sx - 5},${sy}`}
                    fill={isSelected ? '#E2E8F0' : '#0B1120'}
                    stroke="#94A3B8"
                    strokeWidth={1.5}
                  />
                  <text
                    x={isTopLip ? sx + 8 : sx - 8}
                    y={vPt.side === 'outer_right' ? sy - 8 : sy + 14}
                    textAnchor={isTopLip ? 'start' : 'end'}
                    fill="#94A3B8"
                    fontSize="10"
                    className="font-mono"
                  >
                    {vPt.shortLabel}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* =================================================================
            Layer 5: 过渡圆弧圆心 (On) 与法向半径虚线 (Normal Radius Vectors)
           ================================================================= */}
        {layers.showArcCenters && (
          <g>
            {solution.points
              .filter((p) => p.role === 'center')
              .map((centerPt) => {
                const isTop = centerPt.id.includes('TOP');
                const radiusVal = isTop
                  ? effectiveParams.topFilletRadius
                  : effectiveParams.bottomFilletRadius;
                if (radiusVal <= 1e-4) return null;

                const cScreen = worldToScreen(centerPt.coord.localX, centerPt.coord.z);
                const relatedTangents = solution.points.filter(
                  (tp) => tp.role === 'tangent' && tp.relatedCenterId === centerPt.id
                );
                const isHighlighted =
                  selectedPointId === centerPt.id ||
                  hoveredPointId === centerPt.id ||
                  relatedTangents.some(
                    (tp) => tp.id === selectedPointId || tp.id === hoveredPointId
                  );

                return (
                  <g
                    key={centerPt.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPoint(centerPt.id);
                    }}
                    onMouseEnter={() => onHoverPoint(centerPt.id)}
                    onMouseLeave={() => onHoverPoint(null)}
                  >
                    {relatedTangents.map((tp) => {
                      const tScreen = worldToScreen(tp.coord.localX, tp.coord.z);
                      return (
                        <line
                          key={`${centerPt.id}->${tp.id}`}
                          x1={cScreen.sx}
                          y1={cScreen.sy}
                          x2={tScreen.sx}
                          y2={tScreen.sy}
                          stroke={isHighlighted ? '#34D399' : '#10B981'}
                          strokeOpacity={isHighlighted ? 0.95 : 0.6}
                          strokeWidth={isHighlighted ? 1.5 : 1.1}
                          strokeDasharray="4 3"
                        />
                      );
                    })}

                    <circle
                      cx={cScreen.sx}
                      cy={cScreen.sy}
                      r={radiusVal * camera.zoom}
                      fill="none"
                      stroke="#10B981"
                      strokeOpacity={isHighlighted ? 0.35 : 0.14}
                      strokeWidth={1}
                      strokeDasharray="2 3"
                    />

                    <line
                      x1={cScreen.sx - 5}
                      y1={cScreen.sy}
                      x2={cScreen.sx + 5}
                      y2={cScreen.sy}
                      stroke="#10B981"
                      strokeWidth={1.5}
                    />
                    <line
                      x1={cScreen.sx}
                      y1={cScreen.sy - 5}
                      x2={cScreen.sx}
                      y2={cScreen.sy + 5}
                      stroke="#10B981"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={cScreen.sx}
                      cy={cScreen.sy}
                      r={2.5}
                      fill="#0B1120"
                      stroke="#10B981"
                      strokeWidth={1.5}
                    />
                    <text
                      x={isTop ? cScreen.sx - 8 : cScreen.sx + 8}
                      y={centerPt.side === 'outer_right' ? cScreen.sy - 7 : cScreen.sy + 14}
                      textAnchor={isTop ? 'end' : 'start'}
                      fill="#34D399"
                      fontSize="10"
                      className="font-mono"
                    >
                      {centerPt.shortLabel}(R{radiusVal})
                    </text>
                  </g>
                );
              })}
          </g>
        )}

        {/* =================================================================
            Layer 6: 端面燕尾槽高对比度 CAD 实线轮廓 (Lines & Transition Arcs)
           ================================================================= */}
        <g className="pointer-events-none">
          {solution.contourPrimitives.map((prim) => {
            if (prim.type === 'line') {
              const p1 = worldToScreen(prim.start.x, prim.start.z);
              const p2 = worldToScreen(prim.end.x, prim.end.z);
              return (
                <line
                  key={prim.id}
                  x1={p1.sx}
                  y1={p1.sy}
                  x2={p2.sx}
                  y2={p2.sy}
                  stroke={prim.isDatumShoulder ? '#7DD3FC' : '#38BDF8'}
                  strokeWidth={prim.isDatumShoulder ? 2.4 : 2.8}
                  strokeLinecap="round"
                />
              );
            } else {
              const p1 = worldToScreen(prim.startPoint.x, prim.startPoint.z);
              const p2 = worldToScreen(prim.endPoint.x, prim.endPoint.z);
              const rPx = prim.radius * camera.zoom;
              const d = `M ${p1.sx.toFixed(2)} ${p1.sy.toFixed(2)} A ${rPx.toFixed(2)} ${rPx.toFixed(2)} 0 ${prim.largeArcFlag} ${prim.sweepFlag} ${p2.sx.toFixed(2)} ${p2.sy.toFixed(2)}`;
              return (
                <path
                  key={prim.id}
                  d={d}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={3.0}
                  strokeLinecap="round"
                />
              );
            }
          })}
        </g>

        {/* =================================================================
            Layer 7: 标准车床端面燕尾槽机械尺寸与角度标注图层 (响应式防裁切)
           ================================================================= */}
        {layers.showDimensions && vLTop && vRTop && vLBot && vRBot && (
          <g className="pointer-events-none font-mono">
            {(() => {
              const pVRTop = worldToScreen(vRTop.coord.localX, vRTop.coord.z);
              const pVLTop = worldToScreen(vLTop.coord.localX, vLTop.coord.z);
              const pVRBot = worldToScreen(vRBot.coord.localX, vRBot.coord.z);
              const pVLBot = worldToScreen(vLBot.coord.localX, vLBot.coord.z);

              const rightOffset = isCompactViewport ? 36 : 72;
              const leftOffset = isCompactViewport ? 32 : 60;
              const openDimX = pVRTop.sx + rightOffset;
              const botDimX = pVRBot.sx - leftOffset;
              const topOuterY = workpieceGeometry
                ? workpieceGeometry.pBackOuter.sy
                : pVRBot.sy - 26;
              const depthDimY = Math.min(pVRBot.sy, topOuterY) - (isCompactViewport ? 24 : 34);

              const alphaRad = (effectiveParams.dovetailAngleDeg * Math.PI) / 180;
              const arcRadiusPx = Math.min(
                42,
                Math.max(20, effectiveParams.depth * camera.zoom * 0.35)
              );
              const arcStartX = pVRBot.sx;
              const arcStartY = pVRBot.sy + arcRadiusPx;
              const arcEndX = pVRBot.sx + arcRadiusPx * Math.sin(alphaRad);
              const arcEndY = pVRBot.sy + arcRadiusPx * Math.cos(alphaRad);
              const midAngle = alphaRad / 2;
              const labelAngleX = pVRBot.sx + (arcRadiusPx + 10) * Math.sin(midAngle);
              const labelAngleY = pVRBot.sy + (arcRadiusPx + 14) * Math.cos(midAngle);

              return (
                <>
                  {/* --- W1: 右侧垂直标注 - 端面槽口宽度 --- */}
                  <line
                    x1={pVRTop.sx + 4}
                    y1={pVRTop.sy}
                    x2={openDimX + 5}
                    y2={pVRTop.sy}
                    stroke="#64748B"
                    strokeWidth={1}
                  />
                  <line
                    x1={pVLTop.sx + 4}
                    y1={pVLTop.sy}
                    x2={openDimX + 5}
                    y2={pVLTop.sy}
                    stroke="#64748B"
                    strokeWidth={1}
                  />
                  <line
                    x1={openDimX}
                    y1={pVRTop.sy + 2}
                    x2={openDimX}
                    y2={pVLTop.sy - 2}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    markerStart="url(#dim-arrow-end)"
                    markerEnd="url(#dim-arrow-end)"
                  />
                  <rect
                    x={openDimX + 6}
                    y={(pVRTop.sy + pVLTop.sy) / 2 - 10}
                    width={isCompactViewport ? 94 : 132}
                    height={19}
                    rx={3}
                    fill="#0B1120"
                    fillOpacity={0.92}
                  />
                  <text
                    x={openDimX + 10}
                    y={(pVRTop.sy + pVLTop.sy) / 2 + 3.5}
                    textAnchor="start"
                    fill="#E2E8F0"
                    fontSize={isCompactViewport ? '10.5' : '11.5'}
                    fontWeight="600"
                  >
                    {isCompactViewport
                      ? `W1=${effectiveParams.openingWidth.toFixed(1)}`
                      : `开口 W1=${effectiveParams.openingWidth.toFixed(2)}`}
                  </text>

                  {/* --- W2: 左侧垂直标注 - 槽底最大宽度 --- */}
                  <line
                    x1={pVRBot.sx - 4}
                    y1={pVRBot.sy}
                    x2={botDimX - 5}
                    y2={pVRBot.sy}
                    stroke="#64748B"
                    strokeWidth={1}
                  />
                  <line
                    x1={pVLBot.sx - 4}
                    y1={pVLBot.sy}
                    x2={botDimX - 5}
                    y2={pVLBot.sy}
                    stroke="#64748B"
                    strokeWidth={1}
                  />
                  <line
                    x1={botDimX}
                    y1={pVRBot.sy + 2}
                    x2={botDimX}
                    y2={pVLBot.sy - 2}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    markerStart="url(#dim-arrow-end)"
                    markerEnd="url(#dim-arrow-end)"
                  />
                  <rect
                    x={botDimX - (isCompactViewport ? 98 : 138)}
                    y={(pVRBot.sy + pVLBot.sy) / 2 - 10}
                    width={isCompactViewport ? 92 : 132}
                    height={19}
                    rx={3}
                    fill="#0B1120"
                    fillOpacity={0.92}
                  />
                  <text
                    x={botDimX - 10}
                    y={(pVRBot.sy + pVLBot.sy) / 2 + 3.5}
                    textAnchor="end"
                    fill="#E2E8F0"
                    fontSize={isCompactViewport ? '10.5' : '11.5'}
                    fontWeight="600"
                  >
                    {isCompactViewport
                      ? `W2=${effectiveParams.bottomWidth.toFixed(1)}`
                      : `底宽 W2=${effectiveParams.bottomWidth.toFixed(2)}`}
                  </text>

                  {/* --- H: 顶部水平标注 - 轴向槽深 (Z = -H 至 Z = 0) --- */}
                  <line
                    x1={pVRBot.sx}
                    y1={pVRBot.sy - 4}
                    x2={pVRBot.sx}
                    y2={depthDimY - 5}
                    stroke="#64748B"
                    strokeWidth={1}
                  />
                  <line
                    x1={pVRTop.sx}
                    y1={pVRTop.sy - 4}
                    x2={pVRTop.sx}
                    y2={depthDimY - 5}
                    stroke="#64748B"
                    strokeWidth={1}
                  />
                  <line
                    x1={pVRBot.sx + 2}
                    y1={depthDimY}
                    x2={pVRTop.sx - 2}
                    y2={depthDimY}
                    stroke="#94A3B8"
                    strokeWidth={1.2}
                    markerStart="url(#dim-arrow-end)"
                    markerEnd="url(#dim-arrow-end)"
                  />
                  <rect
                    x={(pVRBot.sx + pVRTop.sx) / 2 - 64}
                    y={depthDimY - 19}
                    width={128}
                    height={16}
                    rx={3}
                    fill="#0B1120"
                    fillOpacity={0.92}
                  />
                  <text
                    x={(pVRBot.sx + pVRTop.sx) / 2}
                    y={depthDimY - 7}
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize={isCompactViewport ? '10.5' : '11.5'}
                    fontWeight="600"
                  >
                    槽深 H={effectiveParams.depth.toFixed(2)} mm
                  </text>

                  {/* --- α: 燕尾斜面倾角圆弧标注 --- */}
                  <path
                    d={`M ${arcStartX.toFixed(2)} ${arcStartY.toFixed(2)} A ${arcRadiusPx.toFixed(2)} ${arcRadiusPx.toFixed(2)} 0 0 0 ${arcEndX.toFixed(2)} ${arcEndY.toFixed(2)}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                  />
                  <text
                    x={labelAngleX}
                    y={labelAngleY}
                    textAnchor="start"
                    fill="#FBBF24"
                    fontSize={isCompactViewport ? '10.5' : '11.5'}
                    fontWeight="600"
                  >
                    α={effectiveParams.dovetailAngleDeg.toFixed(1)}°
                  </text>
                </>
              );
            })()}
          </g>
        )}

        {/* =================================================================
            Layer 8: 当前激活切点的正交坐标投影十字线 (Active Point Crosshair)
           ================================================================= */}
        {activePoint && (
          <g className="pointer-events-none">
            {(() => {
              const { sx, sy } = worldToScreen(
                activePoint.coord.localX,
                activePoint.coord.z
              );
              return (
                <>
                  <line
                    x1={originScreenX}
                    y1={sy}
                    x2={sx}
                    y2={sy}
                    stroke="#F59E0B"
                    strokeOpacity={0.45}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={sx}
                    y1={originScreenY}
                    x2={sx}
                    y2={sy}
                    stroke="#F59E0B"
                    strokeOpacity={0.45}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </>
              );
            })()}
          </g>
        )}

        {/* =================================================================
            Layer 9: 相切节点靶标与交互坐标标签 (Tangent Points Tn)
           ================================================================= */}
        {layers.showTangentPoints && (
          <g>
            {solution.points
              .filter((p) => p.role === 'tangent')
              .map((pt) => {
                const { sx, sy } = worldToScreen(pt.coord.localX, pt.coord.z);
                const isSelected = selectedPointId === pt.id;
                const isHovered = hoveredPointId === pt.id;
                const isActive = isSelected || isHovered;
                const labelPos = getLabelPlacement(pt);
                const showFullCoordText = !isCompactViewport || isActive;

                return (
                  <g
                    key={pt.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPoint(pt.id);
                    }}
                    onMouseEnter={() => onHoverPoint(pt.id)}
                    onMouseLeave={() => onHoverPoint(null)}
                  >
                    <circle cx={sx} cy={sy} r={18} fill="transparent" />

                    {isActive && (
                      <circle
                        cx={sx}
                        cy={sy}
                        r={10.5}
                        fill="#F59E0B"
                        fillOpacity={0.22}
                        stroke="#F59E0B"
                        strokeWidth={1.3}
                      />
                    )}

                    <circle
                      cx={sx}
                      cy={sy}
                      r={isActive ? 5.5 : 4.2}
                      fill={isActive ? '#F59E0B' : '#0B1120'}
                      stroke="#F59E0B"
                      strokeWidth={2.2}
                    />

                    <g transform={`translate(${sx + labelPos.dx}, ${sy + labelPos.dy})`}>
                      <text
                        x={0}
                        y={0}
                        textAnchor={labelPos.anchor}
                        fill={isActive ? '#FDE68A' : '#FBBF24'}
                        fontSize={isActive ? '12' : '11'}
                        fontWeight={isActive ? '700' : '600'}
                        className="font-mono"
                      >
                        {pt.shortLabel}
                      </text>
                      {showFullCoordText && (
                        <text
                          x={0}
                          y={13}
                          textAnchor={labelPos.anchor}
                          fill={isActive ? '#F8FAFC' : '#94A3B8'}
                          fontSize="10"
                          className="font-mono"
                        >
                          ({formatRadialCoord(pt)}, Z
                          {pt.coord.z.toFixed(isCompactViewport ? 2 : 3)})
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
          </g>
        )}
      </svg>
    </div>
  );
};
