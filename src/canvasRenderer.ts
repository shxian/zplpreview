import type {
  ZplElement,
  TextElement,
  BoxElement,
  BarcodeElement,
  QrcodeElement,
  ImageElement,
} from './zplTypes';
import QRCodeGenerator from 'qrcode-generator';

export interface RenderOptions {
  scale?: number;
  backgroundColor?: string;
  offsetX?: number;
  offsetY?: number;
  logicalWidth?: number;
  logicalHeight?: number;
}

export function renderZplToCanvas(
  ctx: CanvasRenderingContext2D,
  elements: ZplElement[],
  options: RenderOptions = {},
) {
  const {
    scale = 1,
    backgroundColor = '#ffffff',
    offsetX = 0,
    offsetY = 0,
    logicalWidth,
    logicalHeight,
  } = options;
  const canvas = ctx.canvas;

  ctx.save();

  // 获取逻辑尺寸（以 dots 为单位）
  const dpr = window.devicePixelRatio || 1;
  const lw = logicalWidth ?? canvas.width / dpr;
  const lh = logicalHeight ?? canvas.height / dpr;

  // 先填充整个标签背景，再做平移，避免背景也被偏移
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, lw, lh);

  // 如果提供了 scale，应用它（但通常 scale 应该通过 CSS 处理，这里保留兼容性）
  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  if (offsetX !== 0 || offsetY !== 0) {
    ctx.translate(offsetX, offsetY);
  }

  for (const el of elements) {
    switch (el.type) {
      case 'text': {
        const t = el as TextElement;
        ctx.save();
        ctx.font = `${t.fontSize}px ${t.fontName}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        if (t.rotation === 'R') {
          // 左边竖排：逆时针 90°
          ctx.translate(t.x, t.y);
          ctx.rotate((-90 * Math.PI) / 180);
          ctx.fillText(t.content, 0, 0);
        } else if (t.rotation === 'B') {
          // 右边竖排：顺时针 90°
          ctx.translate(t.x, t.y);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.fillText(t.content, 0, 0);
        } else if (t.rotation === 'I') {
          // 180° 倒置
          ctx.translate(t.x, t.y);
          ctx.rotate((180 * Math.PI) / 180);
          ctx.fillText(t.content, 0, 0);
        } else {
          ctx.fillText(t.content, t.x, t.y);
        }
        ctx.restore();
        break;
      }
      case 'box': {
        const b = el as BoxElement;
        ctx.save();
        ctx.lineWidth = b.borderThickness;
        ctx.strokeStyle = '#000000';
        if (b.height === 0 || b.width === 0) {
          ctx.beginPath();
          if (b.height === 0) {
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x + b.width, b.y);
          } else {
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x, b.y + b.height);
          }
          ctx.stroke();
        } else {
          ctx.strokeRect(b.x, b.y, b.width, b.height);
        }
        ctx.restore();
        break;
      }
      case 'line': {
        // Reserved for future; not used in current sample
        break;
      }
      case 'barcode': {
        const b = el as BarcodeElement;
        ctx.save();
        ctx.fillStyle = '#000000';
        const barHeight = b.height || 80;
        const baseModule = b.moduleWidth || 2;
        // 估算总位数，控制条码不超过预览区域宽度
        const estimatedBitsPerChar = 8; // 粗略估计
        const estimatedTotalBits = estimatedBitsPerChar * b.content.length;
        const maxWidth = 560; // 给左右留一点边距，略小于 ^PW596
        let module = baseModule;
        if (estimatedTotalBits * module > maxWidth) {
          module = Math.max(1, Math.floor(maxWidth / estimatedTotalBits));
        }
        let x = b.x;
        for (let i = 0; i < b.content.length; i++) {
          const code = b.content.charCodeAt(i);
          const pattern = code.toString(2);
          for (let j = 0; j < pattern.length; j++) {
            if (pattern[j] === '1') {
              ctx.fillRect(x, b.y, module, barHeight);
            }
            x += module;
          }
          x += module;
        }
        ctx.restore();
        break;
      }
      case 'qrcode': {
        const q = el as QrcodeElement;
        ctx.save();
        const qr = QRCodeGenerator(0, 'L');
        qr.addData(q.content);
        qr.make();
        const moduleCount = qr.getModuleCount();
        const dotSize = q.dotSize && q.dotSize > 0 ? q.dotSize : 4;
        const previewScale = 0.85; // 适当缩小二维码，留出间距
        const baseSize = moduleCount * dotSize;
        const size = (q.size && q.size > 0 ? q.size : baseSize) * previewScale;
        const cellSize = size / moduleCount;
        ctx.fillStyle = '#000000';
        ctx.fillRect(q.x, q.y, size, size);
        ctx.fillStyle = '#ffffff';
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!qr.isDark(row, col)) {
              const x = q.x + col * cellSize;
              const y = q.y + row * cellSize;
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          }
        }
        ctx.restore();
        break;
      }
      case 'image': {
        const img = el as ImageElement;
        ctx.save();
        // 仅在存在真实像素数据时绘制图像；否则不渲染任何占位
        if (img.data && img.data.length > 0 && img.width > 0 && img.height > 0) {
          const data = new Uint8ClampedArray(img.data);
          try {
            const imageData = new ImageData(data, img.width, img.height);
            ctx.putImageData(imageData, img.x, img.y);
          } catch {
            // 如果构造 ImageData 失败，则静默跳过，不画占位框
          }
        }
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }

  ctx.restore();
}


