/**
 * @file /src/domain/dovetailPresets.ts
 * @description 标准工业车床端面燕尾槽典型工况预设库
 */

import { DovetailPreset } from '../types/geometry';

export const DOVETAIL_PRESETS: DovetailPreset[] = [
  {
    id: 'standard-seal-60',
    name: '标准 60° 端面密封燕尾槽',
    category: '法兰密封',
    description: '高真空法兰端面 O 型圈防脱燕尾槽，60° 标准倾角配 R0.8/R1.0 圆弧平滑过渡。',
    driveMode: 'angle_driven',
    params: {
      centerDiameter: 120.0,
      openingWidth: 10.0,
      bottomWidth: 16.928,
      depth: 6.0,
      dovetailAngleDeg: 60.0,
      topFilletRadius: 0.8,
      bottomFilletRadius: 1.0,
    },
  },
  {
    id: 'heavy-chuck-55',
    name: '重型卡盘 55° 端面T/燕尾复合定位槽',
    category: '工装夹具',
    description: '车床花盘及回转工作台端面精密锁紧槽，55° 燕尾角，具备较大槽深与槽底清根圆弧。',
    driveMode: 'angle_driven',
    params: {
      centerDiameter: 180.0,
      openingWidth: 16.0,
      bottomWidth: 27.203,
      depth: 8.0,
      dovetailAngleDeg: 55.0,
      topFilletRadius: 1.2,
      bottomFilletRadius: 1.5,
    },
  },
  {
    id: 'micro-instrument-65',
    name: '精密光学端面微细燕尾槽',
    category: '精密仪器',
    description: '小开口浅槽深 65° 端面燕尾槽，展示小圆角 R0.4/R0.5 在紧凑斜壁上的切点分布。',
    driveMode: 'angle_driven',
    params: {
      centerDiameter: 68.0,
      openingWidth: 5.0,
      bottomWidth: 7.798,
      depth: 3.0,
      dovetailAngleDeg: 65.0,
      topFilletRadius: 0.4,
      bottomFilletRadius: 0.5,
    },
  },
  {
    id: 'sharp-theoretical-60',
    name: '纯尖角理论梯形燕尾槽 (R=0)',
    category: '理论基准',
    description: '槽口与槽底过渡圆角均为 0，切点与理论交点完全重合，用于核对基础三角函数底宽。',
    driveMode: 'width_driven',
    params: {
      centerDiameter: 100.0,
      openingWidth: 12.0,
      bottomWidth: 20.0,
      depth: 6.928,
      dovetailAngleDeg: 60.0,
      topFilletRadius: 0.0,
      bottomFilletRadius: 0.0,
    },
  },
];
