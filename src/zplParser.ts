import type {
  ZplElement,
  TextElement,
  BoxElement,
  BarcodeElement,
  QrcodeElement,
  ImageElement,
} from './zplTypes';

interface ParserState {
  labelOriginX: number;
  labelOriginY: number;
  currentX: number;
  currentY: number;
  currentFontName: string;
  currentFontSize: number;
  currentRotation: 'N' | 'R' | 'I' | 'B';
  currentModuleWidth: number;
  currentBarcodeHeight: number;
  currentQrMagnification: number;
}

const DEFAULT_FONT = 'NotoSansSC, system-ui, sans-serif';

export function parseZpl(zpl: string): ZplElement[] {
  const elements: ZplElement[] = [];

  const state: ParserState = {
    labelOriginX: 0,
    labelOriginY: 0,
    currentX: 0,
    currentY: 0,
    currentFontName: DEFAULT_FONT,
    currentFontSize: 16,
    currentRotation: 'N',
    currentModuleWidth: 2,
    currentBarcodeHeight: 80,
    currentQrMagnification: 4,
  };

  if (!zpl) return elements;

  const xaIndex = zpl.indexOf('^XA');
  const xzIndex = zpl.lastIndexOf('^XZ');
  const content =
    xaIndex !== -1 && xzIndex !== -1 && xzIndex > xaIndex
      ? zpl.slice(xaIndex + 3, xzIndex)
      : zpl;

  const rawTokens = content.split('^').filter(Boolean);
  const tokens = rawTokens.map((t) => `^${t.trim()}`).filter((t) => t.length > 1);

  let pendingTextContent: string | null = null;
  let pendingBarcodeType: 'BC' | null = null;
  let pendingQrcode = false;
  let pendingImage: { header: string; data: string } | null = null;

  for (const token of tokens) {
    const cmd = token.slice(1, 3);
    const rest = token.slice(3);

    switch (cmd) {
      case 'LH': {
        const [x, y] = rest.split(',').map((v) => parseInt(v || '0', 10));
        if (!Number.isNaN(x)) state.labelOriginX = x;
        if (!Number.isNaN(y)) state.labelOriginY = y;
        break;
      }
      case 'PW': {
        const width = parseInt(rest || '0', 10);
        if (!Number.isNaN(width) && width > 0) {
          // Store in state for potential future use
        }
        break;
      }
      case 'FO': {
        const [x, y] = rest.split(',').map((v) => parseInt(v || '0', 10));
        state.currentX = (Number.isNaN(x) ? 0 : x) + state.labelOriginX;
        state.currentY = (Number.isNaN(y) ? 0 : y) + state.labelOriginY;
        break;
      }
      case 'A@': {
        // ^A@o,h,w,f
        const parts = rest.split(',');
        const rotation = (parts[0] || 'N')[0] as ParserState['currentRotation'];
        const height = parseInt(parts[1] || '0', 10);
        state.currentRotation = rotation || 'N';
        if (!Number.isNaN(height) && height > 0) {
          state.currentFontSize = height;
        }
        state.currentFontName = DEFAULT_FONT;
        break;
      }
      case 'CF': {
        // Default font; for now we just ensure we have some size
        if (rest) {
          const parts = rest.split(',');
          if (parts.length > 1) {
            const size = parseInt(parts[1] || '0', 10);
            if (!Number.isNaN(size) && size > 0) {
              state.currentFontSize = size;
            }
          }
        }
        break;
      }
      case 'CI': {
        // Character encoding, we assume UTF-8 in browser
        break;
      }
      case 'MM':
      case 'CW': {
        // Print mode, font alias - ignored for preview for now
        break;
      }
      case 'BY': {
        const parts = rest.split(',');
        const moduleWidth = parseInt(parts[0] || '2', 10);
        const height = parseInt(parts[2] || parts[1] || '80', 10);
        if (!Number.isNaN(moduleWidth) && moduleWidth > 0) {
          state.currentModuleWidth = moduleWidth;
        }
        if (!Number.isNaN(height) && height > 0) {
          state.currentBarcodeHeight = height;
        }
        break;
      }
      case 'BC': {
        // ^BCo,h,f,g,e,m
        // o=orientation, h=height, f=print interpretation line, etc.
        const parts = rest.split(',');
        const orientation = (parts[0] || 'N')[0] as ParserState['currentRotation'];
        const height = parseInt(parts[1] || '0', 10);
        
        if (orientation) {
          state.currentRotation = orientation;
        }
        if (!Number.isNaN(height) && height > 0) {
          state.currentBarcodeHeight = height;
        }
        
        pendingBarcodeType = 'BC';
        break;
      }
      case 'BQ': {
        // ^BQ,model,magnification 或 ^BQ,model,errorCorrection,magnification
        // 示例: ^BQ,2,5 表示 model=2, magnification=5
        const parts = rest.split(',');
        // 如果只有两个参数，第二个是 magnification；如果有三个参数，第三个是 magnification
        const magnification = parseInt(parts[2] || parts[1] || '4', 10);
        if (!Number.isNaN(magnification) && magnification > 0) {
          state.currentQrMagnification = magnification;
        } else {
          state.currentQrMagnification = 4;
        }
        pendingQrcode = true;
        break;
      }
      case 'GB': {
        const parts = rest.split(',');
        const width = parseInt(parts[0] || '0', 10);
        const height = parseInt(parts[1] || '0', 10);
        const thickness = parseInt(parts[2] || '1', 10);
        const box: BoxElement = {
          type: 'box',
          x: state.currentX,
          y: state.currentY,
          width: Number.isNaN(width) ? 0 : width,
          height: Number.isNaN(height) ? 0 : height,
          borderThickness: Number.isNaN(thickness) ? 1 : thickness,
        };
        elements.push(box);
        break;
      }
      case 'GF': {
        // ^GFA,totalBytes,bytesPerRow,bytesPerRow,data
        // For now we approximate the image size based on header, and don't fully decode bits.
        const [header, ...dataParts] = rest.split(',');
        const headerParts = [header, ...dataParts.slice(0, 3)];
        const data = dataParts.slice(3).join(',');
        const totalBytes = parseInt(headerParts[0] || '0', 10);
        const bytesPerRow = parseInt(headerParts[2] || headerParts[1] || '0', 10);
        const width = bytesPerRow > 0 ? bytesPerRow * 8 : 80;
        const height =
          bytesPerRow > 0 && totalBytes > 0 ? Math.max(1, Math.round(totalBytes / bytesPerRow)) : 80;
        const img: ImageElement = {
          type: 'image',
          x: state.currentX,
          y: state.currentY,
          width,
          height,
          data: new Uint8ClampedArray(),
        };
        elements.push(img);
        pendingImage = { header: headerParts.join(','), data };
        break;
      }
      case 'FD': {
        pendingTextContent = rest;
        break;
      }
      case 'FS': {
        if (pendingTextContent != null) {
          if (pendingBarcodeType === 'BC') {
            const barcode: BarcodeElement = {
              type: 'barcode',
              x: state.currentX,
              y: state.currentY,
              height: state.currentBarcodeHeight,
              moduleWidth: state.currentModuleWidth,
              content: pendingTextContent,
            };
            elements.push(barcode);
          } else if (pendingQrcode) {
            // 解析 QR Code 数据：去除模式指示符，提取实际数据
            // 格式可能是: D03040C,LA,<data> 或 A<data> 或 M<params><data>
            let qrContent = pendingTextContent;
            
            // 检查是否有常见的模式指示符格式
            // 格式1: D03040C,LA,... 或 D03040C,...
            const modeMatch = qrContent.match(/^[A-Z]\d+[A-Z]*,(?:[A-Z]+,)?(.+)$/);
            if (modeMatch) {
              qrContent = modeMatch[1];
            }
            // 格式2: 如果以 A 或 M 开头但后面直接是数据
            else if (qrContent.startsWith('A') || qrContent.startsWith('M')) {
              // 跳过第一个字符（mode indicator）
              const firstComma = qrContent.indexOf(',');
              if (firstComma > 0) {
                qrContent = qrContent.slice(firstComma + 1);
              }
            }
            
            const qr: QrcodeElement = {
              type: 'qrcode',
              x: state.currentX,
              y: state.currentY,
              size: 0,
              dotSize: state.currentQrMagnification,
              content: qrContent,
            };
            elements.push(qr);
          } else {
            const text: TextElement = {
              type: 'text',
              x: state.currentX,
              y: state.currentY,
              fontName: state.currentFontName,
              fontSize: state.currentFontSize,
              rotation: state.currentRotation,
              content: pendingTextContent,
            };
            elements.push(text);
          }
        }
        pendingTextContent = null;
        pendingBarcodeType = null;
        pendingQrcode = false;
        break;
      }
      default: {
        // Unsupported or unneeded commands for preview can be safely ignored.
        break;
      }
    }
  }

  return elements;
}

/**
 * 解析 ZPL 指令中的标签尺寸信息
 * @param zpl ZPL 指令字符串
 * @returns 标签的宽度和高度（单位：dots）
 */
export function parseZplDimensions(zpl: string): { width: number; height: number } {
  // 解析 ^PW 获取宽度
  const pwMatch = zpl.match(/\^PW(\d+)/);
  const width = pwMatch ? parseInt(pwMatch[1], 10) : 0;
  
  // 解析所有元素，找出最大坐标来确定高度
  const elements = parseZpl(zpl);
  let maxX = 0;
  let maxY = 0;
  
  for (const el of elements) {
    // 计算元素的最大 x 坐标
    const elementMaxX = el.x + ((el as any).width || 0);
    if (elementMaxX > maxX) {
      maxX = elementMaxX;
    }
    
    // 计算元素的最大 y 坐标
    const elementMaxY = el.y + ((el as any).height || 0);
    if (elementMaxY > maxY) {
      maxY = elementMaxY;
    }
  }
  
  // 如果从 ^PW 解析到了宽度，使用它；否则使用元素的最大 x 坐标
  const finalWidth = width > 0 ? width : maxX || 596;
  // 高度使用元素的最大 y 坐标，如果没有则使用默认值
  const finalHeight = maxY || 900;
  
  return { width: finalWidth, height: finalHeight };
}


