/**
 * @file /src/types/geometry.ts
 * @description 车床端面燕尾槽 CAD 轮廓与切点计算的领域类型与契约层 (Domain Types & Contracts Layer)
 * 负责定义纯粹的几何图元、车床坐标系统、参数耦合驱动模式及解算输出结构，与 UI 渲染层完全解耦。
 */

/**
 * 梯形过约束几何参数的驱动解算模式
 * - 'angle_driven': 以 [开口宽度 W_open + 槽深 H + 燕尾角 α] 为主动输入，自动推导底宽 W_bottom
 * - 'width_driven': 以 [开口宽度 W_open + 底宽 W_bottom + 槽深 H] 为主动输入，自动反算燕尾角 α
 */
export type DovetailDriveMode = 'angle_driven' | 'width_driven';

/**
 * 车床径向坐标显示模式
 * - 'diameter': 数控车床标准直径编程值 (X = D_center + 2 * x)
 * - 'radius': 车床半径制编程值 (R = D_center / 2 + x)
 * - 'local': 相对于燕尾槽截面中心轴 (x = 0) 的局部对称偏置坐标
 */
export type LatheCoordDisplayMode = 'diameter' | 'radius' | 'local';

/**
 * 局部二维截面平面坐标 (单位: mm)
 * - x: 径向局部坐标，以燕尾槽截面对称中心为 0，向右(外径方向)为正，向左(内径方向)为负
 * - z: 车床轴向坐标，以工件端面为 Z = 0，向槽深方向(工件内部)为负 (-Z)
 */
export interface Point2D {
  x: number;
  z: number;
}

/**
 * 车床工程编程坐标封装 (单位: mm)
 */
export interface LatheCoordinate {
  /** 局部截面对称坐标 x (mm) */
  localX: number;
  /** 车床半径值 X_rad (mm) */
  radiusX: number;
  /** 车床直径编程值 X_diam (mm) */
  diameterX: number;
  /** 车床轴向坐标 Z (mm, 端面为 0, 槽内为负) */
  z: number;
}

/**
 * 端面燕尾槽参数化输入规格
 */
export interface DovetailParameters {
  /** 燕尾槽截面中心基准直径 D_center (mm) */
  centerDiameter: number;
  /** 槽口开口宽度 W_open (mm) */
  openingWidth: number;
  /** 槽底最大宽度 W_bottom (mm) */
  bottomWidth: number;
  /** 轴向槽深 H (mm) */
  depth: number;
  /** 两侧对称内倾燕尾角 α (度, 与端面夹角, 0° < α < 90°) */
  dovetailAngleDeg: number;
  /** 槽口过渡倒圆角半径 R_top (mm) */
  topFilletRadius: number;
  /** 槽底过渡清根圆角半径 R_bottom (mm) */
  bottomFilletRadius: number;
}

/**
 * 关键几何特征点角色分类
 * - 'tangent': 圆弧与直线段的精确切点 (T_L1..T_L4, T_R1..T_R4)
 * - 'vertex': 未倒圆前的理论尖角交点 (V_L_TOP, V_L_BOT, V_R_BOT, V_R_TOP)
 * - 'center': 槽口或槽底过渡圆弧的几何圆心 (O_L_TOP, O_L_BOT, O_R_BOT, O_R_TOP)
 * - 'datum': 端面中心基准点与槽底中心基准点
 */
export type GeometricPointRole = 'tangent' | 'vertex' | 'center' | 'datum';

/**
 * 燕尾槽对称侧别标识
 */
export type GrooveSide = 'inner_left' | 'outer_right' | 'center';

/**
 * 关键几何节点实体 (用于画布拾取、高亮与坐标表检视)
 */
export interface KeyGeometricPoint {
  /** 唯一节点代号 (如 'T_L1', 'T_L2', 'V_L_TOP', 'O_L_TOP') */
  id: string;
  /** 工程图短标签 (如 'T1', 'T2', 'V1', 'O1') */
  shortLabel: string;
  /** 中文工程名称 (如 '内侧槽口端面切点') */
  name: string;
  /** 节点几何角色 */
  role: GeometricPointRole;
  /** 所属侧别 (内径左侧 / 外径右侧 / 中心轴) */
  side: GrooveSide;
  /** 局部截面坐标与车床坐标 */
  coord: LatheCoordinate;
  /** 关联圆弧圆心 ID (仅当 role === 'tangent' 时存在，用于绘制法向半径虚线) */
  relatedCenterId?: string;
  /** 关联理论尖角交点 ID (用于绘制切线偏移距引线) */
  relatedVertexId?: string;
  /** 该点处的切线偏移距 L = R / tan(α/2) (mm) */
  tangentOffsetLength?: number;
  /** 解析几何数学公式推导说明 */
  formulaDescription: string;
}

/**
 * CAD 轮廓直线图元
 */
export interface ContourLineSegment {
  type: 'line';
  id: string;
  label: string;
  start: Point2D;
  end: Point2D;
  /** 是否属于端面基准延展段 */
  isDatumShoulder?: boolean;
}

/**
 * CAD 轮廓圆弧图元
 */
export interface ContourArcSegment {
  type: 'arc';
  id: string;
  label: string;
  center: Point2D;
  radius: number;
  startPoint: Point2D;
  endPoint: Point2D;
  /** SVG 路径顺逆时针标志 (0 或 1) */
  sweepFlag: 0 | 1;
  /** 大弧标志 (0 或 1) */
  largeArcFlag: 0 | 1;
}

export type ContourPrimitive = ContourLineSegment | ContourArcSegment;

/**
 * 几何合法性诊断消息
 */
export interface ValidationDiagnostic {
  level: 'valid' | 'warning' | 'error';
  code: string;
  message: string;
  detail?: string;
}

/**
 * 燕尾槽几何解算引擎完整输出数据包
 */
export interface DovetailSolution {
  /** 经过几何耦合同步后的有效参数 */
  effectiveParams: DovetailParameters;
  /** 单侧燕尾斜壁水平悬伸量 ΔW_side = H * cot(α) (mm) */
  undercutOverhangPerSide: number;
  /** 单侧理论斜壁总长 S_wall = H / sin(α) (mm) */
  inclinedWallTotalLength: number;
  /** 扣除上下圆角切线偏移后的剩余斜壁直线段长度 S_straight (mm) */
  remainingStraightWallLength: number;
  /** 槽口圆弧切线偏移量 L_top = R_top / tan(α/2) (mm) */
  topTangentOffset: number;
  /** 槽底圆弧切线偏移量 L_bottom = R_bottom / tan(α/2) (mm) */
  bottomTangentOffset: number;
  /** 全部关键几何特征点列表 */
  points: KeyGeometricPoint[];
  /** 按键值索引的节点字典，便于 O(1) 检索 */
  pointMap: Record<string, KeyGeometricPoint>;
  /** 构成端面燕尾槽实体表面的连续 CAD 轮廓图元序列 */
  contourPrimitives: ContourPrimitive[];
  /** 工件剖面封闭多边形 SVG Path 字符串 (用于绘制金属剖面线填充区域) */
  workpieceSectionSvgPath: string;
  /** 几何约束与过切诊断结果 */
  diagnostics: ValidationDiagnostic[];
  /** 几何是否完全有效且无过切 */
  isValidGeometry: boolean;
}

/**
 * CAD 画布图层可见性控制配置
 */
export interface ViewportLayerVisibility {
  /** 显示相切点靶标与标签 (Tn) */
  showTangentPoints: boolean;
  /** 显示过渡圆弧圆心与法线半径线 (On) */
  showArcCenters: boolean;
  /** 显示未倒圆理论尖角交点与延长虚线 (Vn) */
  showTheoreticalVertices: boolean;
  /** 显示 CAD 工程尺寸与角度引线标注 */
  showDimensions: boolean;
  /** 显示金属剖面线阴影 (ISO 45° Hatch) */
  showSectionHatch: boolean;
  /** 显示背景毫米级自适应坐标网格 */
  showGrid: boolean;
}

/**
 * 预设工程规格配置项
 */
export interface DovetailPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  driveMode: DovetailDriveMode;
  params: DovetailParameters;
}

/**
 * 移动端 (< 768px) 全屏单视图切换模式
 * - 'canvas': 100% 屏幕视野展示交互式 CAD 工程图与悬浮 HUD
 * - 'params': 全屏展示参数卡片流与切点坐标表
 */
export type MobileViewMode = 'canvas' | 'params';


