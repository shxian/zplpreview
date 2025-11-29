import { useEffect, useRef } from 'react';
import { parseZpl, parseZplDimensions } from './zplParser';
import { renderZplToCanvas } from './canvasRenderer';

export type DimensionUnit = 'mm' | 'cm' | 'inches' | 'dots';

export interface ZplPreviewProps {
  zpl: string;
  width?: number;
  height?: number;
  unit?: DimensionUnit;
  dpi: number;
}

// 参考 Labelary，大致控制在 350×600 左右的预览尺寸
const MAX_PREVIEW_WIDTH = 350;
const MAX_PREVIEW_HEIGHT = 600;

export function ZplPreview({
  zpl,
  width,
  height,
  unit = 'mm',
  dpi,
}: ZplPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 将物理尺寸转换为 dots（ZPL 的单位）
    const dotsPerMm = dpi / 25.4;
    const dotsPerCm = dpi / 2.54;
    const dotsPerInch = dpi;

    let widthInDots: number;
    let heightInDots: number;

    if (width === undefined || height === undefined) {
      // 如果没有提供尺寸，尝试从 ZPL 中提取，否则使用默认值 76mm x 130mm
      try {
        const dims = parseZplDimensions(zpl);
        widthInDots = dims.width > 0 ? dims.width : 76 * dotsPerMm;
        heightInDots = dims.height > 0 ? dims.height : 130 * dotsPerMm;
      } catch {
        widthInDots = 76 * dotsPerMm;
        heightInDots = 130 * dotsPerMm;
      }
    } else {
      // 根据单位转换
      switch (unit) {
        case 'mm':
          widthInDots = width * dotsPerMm;
          heightInDots = height * dotsPerMm;
          break;
        case 'cm':
          widthInDots = width * dotsPerCm;
          heightInDots = height * dotsPerCm;
          break;
        case 'inches':
          widthInDots = width * dotsPerInch;
          heightInDots = height * dotsPerInch;
          break;
        case 'dots':
          widthInDots = width;
          heightInDots = height;
          break;
      }
    }

    // 如果尺寸异常，直接跳过渲染，避免计算出 NaN/Infinity
    if (!Number.isFinite(widthInDots) || !Number.isFinite(heightInDots) || widthInDots <= 0 || heightInDots <= 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    // 画布的逻辑坐标使用 dots
    canvas.width = widthInDots * dpr;
    canvas.height = heightInDots * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 等比例缩放预览尺寸，避免过大
    const scaleX = MAX_PREVIEW_WIDTH / widthInDots;
    const scaleY = MAX_PREVIEW_HEIGHT / heightInDots;
    const displayScale = Math.min(scaleX, scaleY, 1);

    canvas.style.width = `${widthInDots * displayScale}px`;
    canvas.style.height = `${heightInDots * displayScale}px`;

    const elements = parseZpl(zpl);

    // 从 ZPL 中获取打印宽度（^PW 指定的内容宽度）
    const zplDims = parseZplDimensions(zpl);
    const pwWidth = zplDims.width;

    // 计算内容的实际边界（主要关注边框线 ^GB 元素来确定可视区域）
    let minX = Number.POSITIVE_INFINITY;
    let maxX = 0;

    for (const el of elements) {
      // 边框线是最可靠的边界指示器
      if (el.type === 'box') {
        const box = el as { x: number; width: number; height: number };
        // 竖线（width=0）用于确定左右边界
        if (box.width === 0 && box.height > 0) {
          if (el.x < minX) minX = el.x;
          if (el.x > maxX) maxX = el.x + 1; // 线宽至少 1
        }
        // 横线或矩形也考虑
        if (box.width > 0) {
          if (el.x < minX) minX = el.x;
          if (el.x + box.width > maxX) maxX = el.x + box.width;
        }
      }
    }

    // 如果没找到边框线，使用 ^PW 宽度；否则使用实际边界
    const hasValidBounds = Number.isFinite(minX) && maxX > 0;
    
    // 计算水平居中偏移量
    let offsetX = 0;
    const offsetY = 0;
    
    if (hasValidBounds) {
      // 使用实际边界计算：内容区域从 minX 到 maxX
      const actualContentWidth = maxX - minX;
      if (actualContentWidth > 0 && widthInDots > actualContentWidth) {
        // 将内容区域居中：新的 minX 应该是 (widthInDots - actualContentWidth) / 2
        // offsetX = 新minX - 原minX
        offsetX = (widthInDots - actualContentWidth) / 2 - minX;
      }
    } else if (pwWidth > 0 && widthInDots > pwWidth) {
      // 回退到使用 ^PW 宽度
      offsetX = (widthInDots - pwWidth) / 2;
    }

    renderZplToCanvas(ctx, elements, {
      scale: 1,
      offsetX,
      offsetY,
      logicalWidth: widthInDots,
      logicalHeight: heightInDots,
    });
  }, [zpl, width, height, unit, dpi]);

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        padding: 8,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

