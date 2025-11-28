import { useEffect, useRef } from 'react';
import { parseZpl, parseZplDimensions } from './zplParser';
import { renderZplToCanvas } from './canvasRenderer';

export type DimensionUnit = 'mm' | 'cm' | 'inches' | 'dots';

// ZPL 默认分辨率：203 DPI = 8 dots/mm = 80 dots/cm = 203 dots/inch
const DOTS_PER_MM = 8;
const DOTS_PER_CM = 80;
const DOTS_PER_INCH = 203;

export interface ZplPreviewProps {
  zpl: string;
  width?: number;
  height?: number;
  unit?: DimensionUnit;
  scale?: number;
}

export function ZplPreview({ 
  zpl, 
  width, 
  height, 
  unit = 'mm',
  scale = 1 
}: ZplPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 将物理尺寸转换为 dots（ZPL 的单位）
    let widthInDots: number;
    let heightInDots: number;

    if (width === undefined || height === undefined) {
      // 如果没有提供尺寸，尝试从 ZPL 中提取，否则使用默认值 76mm x 130mm
      try {
        const dims = parseZplDimensions(zpl);
        widthInDots = dims.width > 0 ? dims.width : 76 * DOTS_PER_MM;
        heightInDots = dims.height > 0 ? dims.height : 130 * DOTS_PER_MM;
      } catch {
        widthInDots = 76 * DOTS_PER_MM;
        heightInDots = 130 * DOTS_PER_MM;
      }
    } else {
      // 根据单位转换
      switch (unit) {
        case 'mm':
          widthInDots = width * DOTS_PER_MM;
          heightInDots = height * DOTS_PER_MM;
          break;
        case 'cm':
          widthInDots = width * DOTS_PER_CM;
          heightInDots = height * DOTS_PER_CM;
          break;
        case 'inches':
          widthInDots = width * DOTS_PER_INCH;
          heightInDots = height * DOTS_PER_INCH;
          break;
        case 'dots':
          widthInDots = width;
          heightInDots = height;
          break;
      }
    }

    const dpr = window.devicePixelRatio || 1;
    // Canvas 的逻辑坐标系统以 dots 为单位（1 dot = 1 逻辑单位）
    // Canvas 的物理像素尺寸 = 逻辑尺寸 * dpr（用于高分辨率显示）
    canvas.width = widthInDots * dpr;
    canvas.height = heightInDots * dpr;
    // CSS 尺寸用于显示缩放（不改变逻辑坐标系统）
    canvas.style.width = `${widthInDots * scale}px`;
    canvas.style.height = `${heightInDots * scale}px`;
    // 设置 transform：将逻辑坐标（dots）映射到物理像素
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const elements = parseZpl(zpl);
    // 渲染时不需要额外的 scale，因为缩放已通过 CSS 处理
    renderZplToCanvas(ctx, elements, { scale: 1 });
  }, [zpl, width, height, unit, scale]);

  return (
    <div style={{ border: '1px solid #ddd', background: '#f8f8f8', padding: 8 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}


