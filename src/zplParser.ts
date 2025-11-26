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
        // Label width, can be used by layout if needed
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
        pendingBarcodeType = 'BC';
        break;
      }
      case 'BQ': {
        // ^BQ,o,m,s  -> o: model, m: magnification (dot size), s: error correction
        const parts = rest.split(',');
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
            const qr: QrcodeElement = {
              type: 'qrcode',
              x: state.currentX,
              y: state.currentY,
              size: 0,
              dotSize: state.currentQrMagnification,
              content: pendingTextContent,
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


