/**
 * @file /src/domain/dovetailSolver.ts
 * @description 标准对称梯形车床端面燕尾槽纯数学解析几何引擎 (Pure Analytical Geometry Solver)
 *
 * 数控车床标准坐标系定义 (Lathe X-Z Coordinate System)：
 * - 水平轴为 Z 轴 (主轴轴向)：工件右端面位于 Z = 0，槽深向左切入工件内部 (Z = -H < 0)
 * - 垂直轴为 X 轴 (径向/直径方向)：主轴回转中心线在下方，向上为外径增大方向 (+X)
 * - 燕尾槽截面中心对称轴位于局部径向坐标 x = 0，对应车床基准中心直径 D_center (半径 R_c = D_center / 2)
 * - 下侧 (x < 0) 为靠近车床主轴回转中心的内径侧 (Inner Diameter Side)
 * - 上侧 (x > 0) 为靠近工件外圆的外径侧 (Outer Diameter Side)
 * - 燕尾槽端面开口宽度 W_open (沿径向 X 测量)，槽底宽度 W_bottom (W_bottom > W_open)，燕尾内倾锐角 α ∈ (0°, 90°)
 * - 三角耦合方程：W_bottom = W_open + 2 * H * cot(α)
 * - 槽口倒圆 R_top 与槽底倒圆 R_bottom 的半角切线偏移距：
 *   L_top = R_top / tan(α / 2),  L_bottom = R_bottom / tan(α / 2)
 */

import {
  ContourPrimitive,
  DovetailDriveMode,
  DovetailParameters,
  DovetailSolution,
  GrooveSide,
  KeyGeometricPoint,
  LatheCoordinate,
  Point2D,
  ValidationDiagnostic,
} from '../types/geometry';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-5;

/**
 * 格式化数值至指定小数位，消除浮点尾数噪声
 */
export function roundTo(value: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * 将局部截面坐标 (x, z) 转换为完整的车床工程坐标对象
 */
export function toLatheCoordinate(
  localX: number,
  z: number,
  centerDiameter: number
): LatheCoordinate {
  const radiusX = centerDiameter / 2 + localX;
  const diameterX = centerDiameter + 2 * localX;
  return {
    localX: roundTo(localX, 4),
    radiusX: roundTo(radiusX, 4),
    diameterX: roundTo(diameterX, 4),
    z: roundTo(z, 4),
  };
}

/**
 * 根据驱动模式耦合计算对称梯形端面燕尾槽的完整协调参数
 */
export function synchronizeCoupledParameters(
  rawParams: DovetailParameters,
  driveMode: DovetailDriveMode
): DovetailParameters {
  const safeDepth = Math.max(0.5, rawParams.depth);
  const safeOpenWidth = Math.max(1.0, rawParams.openingWidth);
  const safeCenterDiam = Math.max(20.0, rawParams.centerDiameter);
  const safeTopR = Math.max(0, rawParams.topFilletRadius);
  const safeBotR = Math.max(0, rawParams.bottomFilletRadius);

  if (driveMode === 'angle_driven') {
    const clampedAngle = Math.min(85.0, Math.max(25.0, rawParams.dovetailAngleDeg));
    const alphaRad = clampedAngle * DEG_TO_RAD;
    const cotAlpha = 1 / Math.tan(alphaRad);
    const derivedBottomWidth = safeOpenWidth + 2 * safeDepth * cotAlpha;

    return {
      centerDiameter: safeCenterDiam,
      openingWidth: safeOpenWidth,
      bottomWidth: roundTo(derivedBottomWidth, 3),
      depth: safeDepth,
      dovetailAngleDeg: roundTo(clampedAngle, 3),
      topFilletRadius: safeTopR,
      bottomFilletRadius: safeBotR,
    };
  } else {
    const minBottomWidth = safeOpenWidth + 0.2;
    const safeBottomWidth = Math.max(minBottomWidth, rawParams.bottomWidth);
    const overhangPerSide = (safeBottomWidth - safeOpenWidth) / 2;
    const alphaRad = Math.atan2(safeDepth, overhangPerSide);
    const derivedAngleDeg = alphaRad * RAD_TO_DEG;

    return {
      centerDiameter: safeCenterDiam,
      openingWidth: safeOpenWidth,
      bottomWidth: roundTo(safeBottomWidth, 3),
      depth: safeDepth,
      dovetailAngleDeg: roundTo(derivedAngleDeg, 3),
      topFilletRadius: safeTopR,
      bottomFilletRadius: safeBotR,
    };
  }
}

/**
 * 核心解析几何求解器：计算端面燕尾槽全部切点、理论顶点、圆心与 CAD 轮廓图元
 */
export function solveDovetailGeometry(
  inputParams: DovetailParameters,
  driveMode: DovetailDriveMode
): DovetailSolution {
  const params = synchronizeCoupledParameters(inputParams, driveMode);
  const {
    centerDiameter,
    openingWidth,
    bottomWidth,
    depth,
    dovetailAngleDeg,
    topFilletRadius,
    bottomFilletRadius,
  } = params;

  const diagnostics: ValidationDiagnostic[] = [];

  // 三角函数基础量
  const alphaRad = dovetailAngleDeg * DEG_TO_RAD;
  const sinAlpha = Math.sin(alphaRad);
  const cosAlpha = Math.cos(alphaRad);
  const tanHalfAlpha = Math.tan(alphaRad / 2);

  // 单侧径向悬伸量与斜壁理论长度
  const undercutOverhangPerSide = (bottomWidth - openingWidth) / 2;
  const inclinedWallTotalLength = depth / sinAlpha;

  // 槽口与槽底圆弧的切线偏移距 L = R / tan(α/2)
  const topTangentOffset = topFilletRadius > EPSILON ? topFilletRadius / tanHalfAlpha : 0;
  const bottomTangentOffset =
    bottomFilletRadius > EPSILON ? bottomFilletRadius / tanHalfAlpha : 0;

  const remainingStraightWallLength =
    inclinedWallTotalLength - (topTangentOffset + bottomTangentOffset);

  const halfBottomWidth = bottomWidth / 2;
  const remainingFlatBottomHalfWidth = halfBottomWidth - bottomTangentOffset;

  // 上下端面台肩余量 (外圆台阶与内孔台阶)
  const shoulderMargin = Math.max(openingWidth * 0.45, topTangentOffset + 3.5, 4.0);
  const minLocalX = -(bottomWidth / 2 + shoulderMargin);
  const minWorkpieceDiameter = centerDiameter + 2 * minLocalX;

  if (remainingStraightWallLength < -EPSILON) {
    diagnostics.push({
      level: 'error',
      code: 'WALL_OVERLAP',
      message: '槽口与槽底过渡圆弧在燕尾斜壁上发生过切重叠',
      detail: `当前斜壁理论总长 S = ${inclinedWallTotalLength.toFixed(3)} mm，但槽口与槽底圆角切线偏移之和 (L1 + L2 = ${(topTangentOffset + bottomTangentOffset).toFixed(3)} mm) 超出斜壁长度，请减小 R1/R2 或增大槽深 H。`,
    });
  } else if (remainingStraightWallLength < 0.5) {
    diagnostics.push({
      level: 'warning',
      code: 'SHORT_STRAIGHT_WALL',
      message: '燕尾斜壁有效直线段极短 (< 0.5 mm)',
      detail: `剩余斜壁直线段仅 ${Math.max(0, remainingStraightWallLength).toFixed(3)} mm，接近全圆弧相接状态。`,
    });
  }

  if (remainingFlatBottomHalfWidth < -EPSILON) {
    diagnostics.push({
      level: 'error',
      code: 'BOTTOM_OVERLAP',
      message: '上下两侧槽底圆弧在槽底中心发生干涉重叠',
      detail: `槽底圆角切线偏移 L_bottom (${bottomTangentOffset.toFixed(3)} mm) 超过槽底半宽 (${halfBottomWidth.toFixed(3)} mm)。`,
    });
  }

  if (minWorkpieceDiameter <= 2.0) {
    diagnostics.push({
      level: 'warning',
      code: 'CENTERLINE_INTERFERENCE',
      message: '内径侧槽壁接近或越过车床主轴回转中心线 (X ≤ 0)',
      detail: `请增大中心基准直径 D_center (当前 ${centerDiameter.toFixed(1)} mm) 以保证内侧端面壁厚。`,
    });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      level: 'valid',
      code: 'GEOMETRY_OK',
      message: '几何约束完备，端面与燕尾斜壁、槽底圆弧相切关系精确成立',
      detail: `斜壁直线余量 ${remainingStraightWallLength.toFixed(3)} mm · 槽底平直段余量 ${(remainingFlatBottomHalfWidth * 2).toFixed(3)} mm`,
    });
  }

  const isValidGeometry = !diagnostics.some((d) => d.level === 'error');

  // 安全钳制，防止极端过切参数导致 SVG 圆弧崩坏
  const maxTotalOffset = inclinedWallTotalLength * 0.999;
  const scaleFactor =
    topTangentOffset + bottomTangentOffset > maxTotalOffset &&
    topTangentOffset + bottomTangentOffset > EPSILON
      ? maxTotalOffset / (topTangentOffset + bottomTangentOffset)
      : 1.0;

  const effTopOffset = topTangentOffset * scaleFactor;
  const effTopR = topFilletRadius * scaleFactor;
  const effBotOffset = Math.min(bottomTangentOffset * scaleFactor, halfBottomWidth * 0.999);
  const effBotR = effBotOffset * tanHalfAlpha;

  // =========================================================================
  // 1. 求解理论尖角顶点 (Theoretical Vertices)
  // =========================================================================
  const halfOpen = openingWidth / 2;
  const halfBot = bottomWidth / 2;

  // 下壁(内径侧, x < 0) 与 上壁(外径侧, x > 0)
  const vLeftTop: Point2D = { x: -halfOpen, z: 0 };
  const vLeftBot: Point2D = { x: -halfBot, z: -depth };
  const vRightBot: Point2D = { x: halfBot, z: -depth };
  const vRightTop: Point2D = { x: halfOpen, z: 0 };

  // =========================================================================
  // 2. 求解内径侧(下壁, x < 0) 4个切点 T_L1..T_L4 与 2个圆心 O_L_TOP, O_L_BOT
  // =========================================================================
  const tL1: Point2D = {
    x: vLeftTop.x - effTopOffset,
    z: 0,
  };
  const oLeftTop: Point2D = {
    x: tL1.x,
    z: -effTopR,
  };
  const tL2: Point2D = {
    x: vLeftTop.x - effTopOffset * cosAlpha,
    z: -effTopOffset * sinAlpha,
  };

  const tL3: Point2D = {
    x: vLeftBot.x + effBotOffset * cosAlpha,
    z: -depth + effBotOffset * sinAlpha,
  };
  const tL4: Point2D = {
    x: vLeftBot.x + effBotOffset,
    z: -depth,
  };
  const oLeftBot: Point2D = {
    x: tL4.x,
    z: -depth + effBotR,
  };

  // =========================================================================
  // 3. 求解外径侧(上壁, x > 0) 对称的 4个切点 T_R1..T_R4 与 2个圆心 O_R_TOP, O_R_BOT
  // =========================================================================
  const tR1: Point2D = { x: -tL1.x, z: 0 };
  const oRightTop: Point2D = { x: -oLeftTop.x, z: -effTopR };
  const tR2: Point2D = { x: -tL2.x, z: tL2.z };
  const tR3: Point2D = { x: -tL3.x, z: tL3.z };
  const tR4: Point2D = { x: -tL4.x, z: -depth };
  const oRightBot: Point2D = { x: -oLeftBot.x, z: -depth + effBotR };

  // =========================================================================
  // 4. 封装全部关键特征点列表 (KeyGeometricPoint[])
  // =========================================================================
  const createNode = (
    id: string,
    shortLabel: string,
    name: string,
    role: KeyGeometricPoint['role'],
    side: GrooveSide,
    pt: Point2D,
    formulaDescription: string,
    extra?: Partial<
      Pick<KeyGeometricPoint, 'relatedCenterId' | 'relatedVertexId' | 'tangentOffsetLength'>
    >
  ): KeyGeometricPoint => ({
    id,
    shortLabel,
    name,
    role,
    side,
    coord: toLatheCoordinate(pt.x, pt.z, centerDiameter),
    formulaDescription,
    ...extra,
  });

  const points: KeyGeometricPoint[] = [
    // 外径侧 (上壁, x > 0) 切点 T_R1 .. T_R4
    createNode(
      'T_R1',
      'T_R1',
      '外径侧槽口端面切点',
      'tangent',
      'outer_right',
      tR1,
      'X = Dc + W1 + 2·R1/tan(α/2), Z = 0',
      {
        relatedCenterId: 'O_R_TOP',
        relatedVertexId: 'V_R_TOP',
        tangentOffsetLength: roundTo(topTangentOffset, 4),
      }
    ),
    createNode(
      'T_R2',
      'T_R2',
      '外径侧槽口斜壁切点',
      'tangent',
      'outer_right',
      tR2,
      'x = +W1/2 + L1·cos(α), Z = -L1·sin(α)',
      {
        relatedCenterId: 'O_R_TOP',
        relatedVertexId: 'V_R_TOP',
        tangentOffsetLength: roundTo(topTangentOffset, 4),
      }
    ),
    createNode(
      'T_R3',
      'T_R3',
      '外径侧槽底斜壁切点',
      'tangent',
      'outer_right',
      tR3,
      'x = +W2/2 - L2·cos(α), Z = -H + L2·sin(α)',
      {
        relatedCenterId: 'O_R_BOT',
        relatedVertexId: 'V_R_BOT',
        tangentOffsetLength: roundTo(bottomTangentOffset, 4),
      }
    ),
    createNode(
      'T_R4',
      'T_R4',
      '外径侧槽底平面切点',
      'tangent',
      'outer_right',
      tR4,
      'x = +W2/2 - R2/tan(α/2), Z = -H',
      {
        relatedCenterId: 'O_R_BOT',
        relatedVertexId: 'V_R_BOT',
        tangentOffsetLength: roundTo(bottomTangentOffset, 4),
      }
    ),

    // 内径侧 (下壁, x < 0) 切点 T_L4 .. T_L1
    createNode(
      'T_L4',
      'T_L4',
      '内径侧槽底平面切点',
      'tangent',
      'inner_left',
      tL4,
      'x = -W2/2 + R2/tan(α/2), Z = -H',
      {
        relatedCenterId: 'O_L_BOT',
        relatedVertexId: 'V_L_BOT',
        tangentOffsetLength: roundTo(bottomTangentOffset, 4),
      }
    ),
    createNode(
      'T_L3',
      'T_L3',
      '内径侧槽底斜壁切点',
      'tangent',
      'inner_left',
      tL3,
      'x = -W2/2 + L2·cos(α), Z = -H + L2·sin(α)',
      {
        relatedCenterId: 'O_L_BOT',
        relatedVertexId: 'V_L_BOT',
        tangentOffsetLength: roundTo(bottomTangentOffset, 4),
      }
    ),
    createNode(
      'T_L2',
      'T_L2',
      '内径侧槽口斜壁切点',
      'tangent',
      'inner_left',
      tL2,
      'x = -W1/2 - L1·cos(α), Z = -L1·sin(α)',
      {
        relatedCenterId: 'O_L_TOP',
        relatedVertexId: 'V_L_TOP',
        tangentOffsetLength: roundTo(topTangentOffset, 4),
      }
    ),
    createNode(
      'T_L1',
      'T_L1',
      '内径侧槽口端面切点',
      'tangent',
      'inner_left',
      tL1,
      'X = Dc - W1 - 2·R1/tan(α/2), Z = 0',
      {
        relatedCenterId: 'O_L_TOP',
        relatedVertexId: 'V_L_TOP',
        tangentOffsetLength: roundTo(topTangentOffset, 4),
      }
    ),

    // 理论尖角交点 V_n
    createNode(
      'V_R_TOP',
      'V_R1',
      '外径侧槽口理论尖角点',
      'vertex',
      'outer_right',
      vRightTop,
      'x = +W1/2, Z = 0'
    ),
    createNode(
      'V_R_BOT',
      'V_R2',
      '外径侧槽底理论尖角点',
      'vertex',
      'outer_right',
      vRightBot,
      'x = +W2/2 = +W1/2 + H·cot(α), Z = -H'
    ),
    createNode(
      'V_L_BOT',
      'V_L2',
      '内径侧槽底理论尖角点',
      'vertex',
      'inner_left',
      vLeftBot,
      'x = -W2/2 = -W1/2 - H·cot(α), Z = -H'
    ),
    createNode(
      'V_L_TOP',
      'V_L1',
      '内径侧槽口理论尖角点',
      'vertex',
      'inner_left',
      vLeftTop,
      'x = -W1/2, Z = 0'
    ),

    // 过渡圆弧圆心 O_n
    createNode(
      'O_R_TOP',
      'O_R1',
      '外径侧槽口圆弧圆心',
      'center',
      'outer_right',
      oRightTop,
      'x = x(T_R1), Z = -R1'
    ),
    createNode(
      'O_R_BOT',
      'O_R2',
      '外径侧槽底圆弧圆心',
      'center',
      'outer_right',
      oRightBot,
      'x = x(T_R4), Z = -H + R2'
    ),
    createNode(
      'O_L_BOT',
      'O_L2',
      '内径侧槽底圆弧圆心',
      'center',
      'inner_left',
      oLeftBot,
      'x = x(T_L4), Z = -H + R2'
    ),
    createNode(
      'O_L_TOP',
      'O_L1',
      '内径侧槽口圆弧圆心',
      'center',
      'inner_left',
      oLeftTop,
      'x = x(T_L1), Z = -R1'
    ),
  ];

  const pointMap: Record<string, KeyGeometricPoint> = {};
  for (const pt of points) {
    pointMap[pt.id] = pt;
  }

  // =========================================================================
  // 5. 构建连续 CAD 轮廓图元序列 (ContourPrimitive[])
  // 在标准车床视口中 (水平轴 screenX = z, 垂直轴 screenY = -x，即 +x 外径朝上)：
  // 从内径侧端面下沿 (leftFaceOuterEnd) 向上沿着右端面 Z=0 行走至外径侧端面上沿 (rightFaceOuterEnd)：
  // - ARC_TOP_LEFT (T_L1 -> T_L2): 逆时针 (sweepFlag = 0)
  // - ARC_BOT_LEFT (T_L3 -> T_L4): 顺时针 (sweepFlag = 1)
  // - ARC_BOT_RIGHT (T_R4 -> T_R3): 顺时针 (sweepFlag = 1)
  // - ARC_TOP_RIGHT (T_R2 -> T_R1): 逆时针 (sweepFlag = 0)
  // =========================================================================
  const innerFaceEnd: Point2D = { x: -(halfBot + shoulderMargin), z: 0 };
  const outerFaceEnd: Point2D = { x: halfBot + shoulderMargin, z: 0 };

  const contourPrimitives: ContourPrimitive[] = [];

  // 1) 内径侧右端面基准段 (Inner Datum End Face, Z=0)
  contourPrimitives.push({
    type: 'line',
    id: 'SEG_FACE_LEFT',
    label: '内径侧端面基准 (Z=0)',
    start: innerFaceEnd,
    end: tL1,
    isDatumShoulder: true,
  });

  // 2) 内径侧槽口倒圆弧 (T_L1 -> T_L2)
  if (effTopR > EPSILON) {
    contourPrimitives.push({
      type: 'arc',
      id: 'ARC_TOP_LEFT',
      label: `内径侧槽口圆弧 R${topFilletRadius}`,
      center: oLeftTop,
      radius: effTopR,
      startPoint: tL1,
      endPoint: tL2,
      sweepFlag: 0,
      largeArcFlag: 0,
    });
  }

  // 3) 内径侧燕尾斜壁直线段 (T_L2 -> T_L3)
  contourPrimitives.push({
    type: 'line',
    id: 'SEG_WALL_LEFT',
    label: `内径侧燕尾斜壁 (${dovetailAngleDeg.toFixed(1)}°)`,
    start: tL2,
    end: tL3,
  });

  // 4) 内径侧槽底过渡圆弧 (T_L3 -> T_L4)
  if (effBotR > EPSILON) {
    contourPrimitives.push({
      type: 'arc',
      id: 'ARC_BOT_LEFT',
      label: `内径侧槽底圆弧 R${bottomFilletRadius}`,
      center: oLeftBot,
      radius: effBotR,
      startPoint: tL3,
      endPoint: tL4,
      sweepFlag: 1,
      largeArcFlag: 0,
    });
  }

  // 5) 槽底垂直平面直线段 (T_L4 -> T_R4, 位于 Z = -H)
  contourPrimitives.push({
    type: 'line',
    id: 'SEG_BOTTOM_FLAT',
    label: `燕尾槽底垂直平面 (Z=-${depth})`,
    start: tL4,
    end: tR4,
  });

  // 6) 外径侧槽底过渡圆弧 (T_R4 -> T_R3)
  if (effBotR > EPSILON) {
    contourPrimitives.push({
      type: 'arc',
      id: 'ARC_BOT_RIGHT',
      label: `外径侧槽底圆弧 R${bottomFilletRadius}`,
      center: oRightBot,
      radius: effBotR,
      startPoint: tR4,
      endPoint: tR3,
      sweepFlag: 1,
      largeArcFlag: 0,
    });
  }

  // 7) 外径侧燕尾斜壁直线段 (T_R3 -> T_R2)
  contourPrimitives.push({
    type: 'line',
    id: 'SEG_WALL_RIGHT',
    label: `外径侧燕尾斜壁 (${dovetailAngleDeg.toFixed(1)}°)`,
    start: tR3,
    end: tR2,
  });

  // 8) 外径侧槽口倒圆弧 (T_R2 -> T_R1)
  if (effTopR > EPSILON) {
    contourPrimitives.push({
      type: 'arc',
      id: 'ARC_TOP_RIGHT',
      label: `外径侧槽口圆弧 R${topFilletRadius}`,
      center: oRightTop,
      radius: effTopR,
      startPoint: tR2,
      endPoint: tR1,
      sweepFlag: 0,
      largeArcFlag: 0,
    });
  }

  // 9) 外径侧右端面基准段 (Outer Datum End Face, Z=0)
  contourPrimitives.push({
    type: 'line',
    id: 'SEG_FACE_RIGHT',
    label: '外径侧端面基准 (Z=0)',
    start: tR1,
    end: outerFaceEnd,
    isDatumShoulder: true,
  });

  // =========================================================================
  // 6. 构建车床工件轴向剖面封闭路径 (Horizontal = Z, Vertical = -X)
  // =========================================================================
  const backZ = -(depth + Math.max(depth * 0.65, 4.5));
  const pathCommands: string[] = [
    `M ${innerFaceEnd.z.toFixed(4)} ${(-innerFaceEnd.x).toFixed(4)}`,
  ];

  for (const prim of contourPrimitives) {
    if (prim.type === 'line') {
      pathCommands.push(`L ${prim.end.z.toFixed(4)} ${(-prim.end.x).toFixed(4)}`);
    } else {
      pathCommands.push(
        `A ${prim.radius.toFixed(4)} ${prim.radius.toFixed(4)} 0 ${prim.largeArcFlag} ${prim.sweepFlag} ${prim.endPoint.z.toFixed(4)} ${(-prim.endPoint.x).toFixed(4)}`
      );
    }
  }

  // 沿着顶部外圆母线向左延伸至卡盘侧剖断线，再向下闭合至内径底界
  pathCommands.push(`L ${backZ.toFixed(4)} ${(-outerFaceEnd.x).toFixed(4)}`);
  pathCommands.push(`L ${backZ.toFixed(4)} ${(-innerFaceEnd.x).toFixed(4)}`);
  pathCommands.push('Z');

  return {
    effectiveParams: params,
    undercutOverhangPerSide: roundTo(undercutOverhangPerSide, 4),
    inclinedWallTotalLength: roundTo(inclinedWallTotalLength, 4),
    remainingStraightWallLength: roundTo(remainingStraightWallLength, 4),
    topTangentOffset: roundTo(topTangentOffset, 4),
    bottomTangentOffset: roundTo(bottomTangentOffset, 4),
    points,
    pointMap,
    contourPrimitives,
    workpieceSectionSvgPath: pathCommands.join(' '),
    diagnostics,
    isValidGeometry,
  };
}
