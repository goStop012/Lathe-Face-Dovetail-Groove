/**
 * @file /src/hooks/useCadViewportCamera.ts
 * @description 独立的 CAD 视口相机变换、自适应缩放与多端手势引擎 (Camera & Multi-Touch Gesture Hook)
 * 职责分层：
 * - 管理 ResizeObserver 容器尺寸测量 (带防抖阈值，杜绝高度自增死循环)
 * - 提供世界坐标 (x, z) 与屏幕像素坐标 (sx, sy) 的双向投影变换
 * - 支持 PC 鼠标拖拽平移、滚轮定点缩放
 * - 支持移动端单指触摸拖拽平移 (Touch Pan) 与双指捏合无级缩放 (Pinch-to-Zoom)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DovetailParameters, Point2D } from '../types/geometry';

export interface CameraState {
  zoom: number; // 像素/毫米 (px / mm)
  panX: number; // 屏幕水平平移像素 (Z轴方向)
  panY: number; // 屏幕垂直平移像素 (X轴方向)
}

interface UseCadViewportCameraOptions {
  effectiveParams: DovetailParameters;
  viewResetCounter: number;
}

export function useCadViewportCamera({
  effectiveParams,
  viewResetCounter,
}: UseCadViewportCameraOptions) {
  const svgStageRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 480,
  });

  const isCompactViewport = viewportSize.width < 520;
  // 移动端窄屏下将 Z=0 端面基准中心稍微居中，为两侧标注留出均衡余量
  const originRatioX = isCompactViewport ? 0.54 : 0.56;
  const originRatioY = 0.5;

  const [camera, setCamera] = useState<CameraState>({
    zoom: 24,
    panX: 0,
    panY: 0,
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number }>({
    clientX: 0,
    clientY: 0,
    panX: 0,
    panY: 0,
  });

  // 移动端触摸手势状态引用 (单指平移 + 双指捏合缩放)
  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startDist: number;
    startZoom: number;
    pinchCenterSx: number;
    pinchCenterSy: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startDist: 1,
    startZoom: 24,
    pinchCenterSx: 0,
    pinchCenterSy: 0,
  });

  const [mouseWorldPos, setMouseWorldPos] = useState<Point2D | null>(null);

  // 监听独立隔离的 SVG 容器尺寸
  useEffect(() => {
    const el = svgStageRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.round(rect.width);
      const nextH = Math.round(rect.height);
      if (nextW > 40 && nextH > 40) {
        setViewportSize((prev) => {
          if (Math.abs(prev.width - nextW) <= 1 && Math.abs(prev.height - nextH) <= 1) {
            return prev;
          }
          return { width: nextW, height: nextH };
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 根据视口宽高与燕尾槽尺寸计算自适应最佳相机参数
  const computeOptimalCamera = useCallback(
    (width: number, height: number): CameraState => {
      const { bottomWidth, openingWidth, depth } = effectiveParams;
      const isNarrow = width < 520;
      const radialSpanMm = Math.max(bottomWidth, openingWidth) * (isNarrow ? 1.95 : 2.15) + (isNarrow ? 8 : 10);
      const axialSpanMm = depth * (isNarrow ? 2.8 : 3.2) + (isNarrow ? 12 : 16);

      const fitZoomX = width / axialSpanMm;
      const fitZoomY = height / radialSpanMm;
      const optimalZoom = Math.min(Math.max(Math.min(fitZoomX, fitZoomY) * (isNarrow ? 0.8 : 0.85), 6), 110);

      return {
        zoom: optimalZoom,
        panX: 0,
        panY: 0,
      };
    },
    [effectiveParams]
  );

  useEffect(() => {
    setCamera(computeOptimalCamera(viewportSize.width, viewportSize.height));
  }, [viewResetCounter, viewportSize.width, viewportSize.height, computeOptimalCamera]);

  const originScreenX = viewportSize.width * originRatioX + camera.panX;
  const originScreenY = viewportSize.height * originRatioY + camera.panY;

  const worldToScreen = useCallback(
    (x: number, z: number): { sx: number; sy: number } => ({
      sx: originScreenX + z * camera.zoom,
      sy: originScreenY - x * camera.zoom,
    }),
    [originScreenX, originScreenY, camera.zoom]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number): Point2D => ({
      z: (sx - originScreenX) / camera.zoom,
      x: -(sy - originScreenY) / camera.zoom,
    }),
    [originScreenX, originScreenY, camera.zoom]
  );

  // PC 鼠标滚轮定点缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const cursorSx = e.clientX - rect.left;
      const cursorSy = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
      setCamera((prev) => {
        const nextZoom = Math.min(260, Math.max(5, prev.zoom * zoomFactor));
        const scaleRatio = nextZoom / prev.zoom;

        const currOriginX = viewportSize.width * originRatioX + prev.panX;
        const currOriginY = viewportSize.height * originRatioY + prev.panY;

        const nextOriginX = cursorSx - (cursorSx - currOriginX) * scaleRatio;
        const nextOriginY = cursorSy - (cursorSy - currOriginY) * scaleRatio;

        return {
          zoom: nextZoom,
          panX: nextOriginX - viewportSize.width * originRatioX,
          panY: nextOriginY - viewportSize.height * originRatioY,
        };
      });
    },
    [viewportSize.width, viewportSize.height, originRatioX, originRatioY]
  );

  // PC 鼠标拖拽平移
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: camera.panX,
        panY: camera.panY,
      };
    },
    [camera.panX, camera.panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setMouseWorldPos(screenToWorld(sx, sy));

      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      setCamera((prev) => ({
        ...prev,
        panX: dragStartRef.current.panX + dx,
        panY: dragStartRef.current.panY + dy,
      }));
    },
    [isDragging, screenToWorld]
  );

  const handleMouseUpOrLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 移动端触摸开始 (支持单指平移 + 双指捏合缩放)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStateRef.current = {
          ...touchStateRef.current,
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startPanX: camera.panX,
          startPanY: camera.panY,
        };
        setIsDragging(true);
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = e.currentTarget.getBoundingClientRect();
        const centerSx = (t1.clientX + t2.clientX) / 2 - rect.left;
        const centerSy = (t1.clientY + t2.clientY) / 2 - rect.top;

        touchStateRef.current = {
          mode: 'pinch',
          startX: centerSx,
          startY: centerSy,
          startPanX: camera.panX,
          startPanY: camera.panY,
          startDist: Math.max(10, dist),
          startZoom: camera.zoom,
          pinchCenterSx: centerSx,
          pinchCenterSy: centerSy,
        };
        setIsDragging(true);
      }
    },
    [camera.panX, camera.panY, camera.zoom]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      const state = touchStateRef.current;
      if (state.mode === 'pan' && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - state.startX;
        const dy = t.clientY - state.startY;
        setCamera((prev) => ({
          ...prev,
          panX: state.startPanX + dx,
          panY: state.startPanY + dy,
        }));
      } else if (state.mode === 'pinch' && e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const scaleFactor = dist / state.startDist;
        const nextZoom = Math.min(260, Math.max(5, state.startZoom * scaleFactor));
        const actualRatio = nextZoom / state.startZoom;

        const startOriginX = viewportSize.width * originRatioX + state.startPanX;
        const startOriginY = viewportSize.height * originRatioY + state.startPanY;

        const nextOriginX =
          state.pinchCenterSx - (state.pinchCenterSx - startOriginX) * actualRatio;
        const nextOriginY =
          state.pinchCenterSy - (state.pinchCenterSy - startOriginY) * actualRatio;

        setCamera({
          zoom: nextZoom,
          panX: nextOriginX - viewportSize.width * originRatioX,
          panY: nextOriginY - viewportSize.height * originRatioY,
        });
      }
    },
    [viewportSize.width, viewportSize.height, originRatioX, originRatioY]
  );

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current.mode = 'none';
    setIsDragging(false);
  }, []);

  const zoomIn = useCallback(() => {
    setCamera((prev) => ({ ...prev, zoom: Math.min(260, prev.zoom * 1.25) }));
  }, []);

  const zoomOut = useCallback(() => {
    setCamera((prev) => ({ ...prev, zoom: Math.max(5, prev.zoom / 1.25) }));
  }, []);

  return {
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
  };
}
