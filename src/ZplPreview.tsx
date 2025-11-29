import { useEffect, useRef } from 'react';
import { parseZpl, parseZplDimensions } from './zplParser';
import { renderZplToCanvas } from './canvasRenderer';
import type { ZplElement } from './zplTypes';
import QRCodeGenerator from 'qrcode-generator';

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

    // 计算内容包围盒，让内容在标签区域内居中
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = 0;
    let maxY = 0;

    const updateBounds = (el: ZplElement, w: number, h: number) => {
      const ex1 = el.x;
      const ey1 = el.y;
      const ex2 = el.x + w;
      const ey2 = el.y + h;
      if (ex1 < minX) minX = ex1;
      if (ey1 < minY) minY = ey1;
      if (ex2 > maxX) maxX = ex2;
      if (ey2 > maxY) maxY = ey2;
    };

    for (const el of elements) {
      switch (el.type) {
        case 'box': {
          const w = (el as any).width || 0;
          const h = (el as any).height || 0;
          updateBounds(el, w, h);
          break;
        }
        case 'image': {
          const w = (el as any).width || 0;
          const h = (el as any).height || 0;
          updateBounds(el, w, h);
          break;
        }
        case 'barcode': {
          const b = el as any;
          const w = (b.moduleWidth || 2) * 16 + (b.content?.length || 0) * (b.moduleWidth || 2) * 8;
          const h = b.height || 80;
          updateBounds(el, w, h);
          break;
        }
        case 'qrcode': {
          const q = el as any;
          const dotSize = q.dotSize && q.dotSize > 0 ? q.dotSize : 4;
          // 严格按照 ZPL 指令计算二维码大小，使用真实的模块数
          // 二维码大小 = 模块数 × magnification (dotSize)
          // 生成二维码对象以获取真实的模块数，确保边界计算准确
          const qr = QRCodeGenerator(0, 'L');
          qr.addData(q.content);
          qr.make();
          const moduleCount = qr.getModuleCount();
          const size = q.size && q.size > 0 ? q.size : moduleCount * dotSize;
          updateBounds(el, size, size);
          break;
        }
        case 'text': {
          const t = el as any;
          const approxWidth = t.content ? t.content.length * (t.fontSize || 16) * 0.6 : 0;
          const approxHeight = t.fontSize || 16;
          updateBounds(el, approxWidth, approxHeight);
          break;
        }
        default:
          break;
      }
    }

    // 禁用全局居中逻辑，严格按照 ZPL 指令的位置渲染
    // ZPL 指令中已经明确指定了每个元素的位置（^FO），不应该进行额外的居中调整
    // 如果需要预览时居中显示，可以通过 CSS 或其他方式处理，而不是修改元素的实际位置
    let offsetX = 0;
    let offsetY = 0;
    // 注释掉全局居中逻辑，确保所有元素严格按照 ZPL 指令中的位置渲染
    // if (minX !== Number.POSITIVE_INFINITY && minY !== Number.POSITIVE_INFINITY) {
    //   const contentWidth = Math.max(maxX - minX, 0);
    //   const contentHeight = Math.max(maxY - minY, 0);
    //   // 只有当内容尺寸没有超过标签尺寸太多时才做居中，避免估算过大把内容整体移出画布
    //   if (contentWidth > 0 && contentHeight > 0 && contentWidth <= widthInDots * 1.2 && contentHeight <= heightInDots * 1.2) {
    //     offsetX = (widthInDots - contentWidth) / 2 - minX;
    //     offsetY = (heightInDots - contentHeight) / 2 - minY;
    //   }
    // }

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

