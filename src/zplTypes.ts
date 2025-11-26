export type ZplElementType = 'text' | 'barcode' | 'qrcode' | 'box' | 'line' | 'image';

export interface BaseElement {
  type: ZplElementType;
  x: number;
  y: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  fontName: string;
  fontSize: number;
  rotation: 'N' | 'R' | 'I' | 'B';
  content: string;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  height: number;
  moduleWidth: number;
  content: string;
}

export interface QrcodeElement extends BaseElement {
  type: 'qrcode';
  size: number;
  // 每个二维码模块（dot）的尺寸，对应 ^BQ 的 magnification 参数（单位：ZPL dots）
  dotSize?: number;
  content: string;
}

export interface BoxElement extends BaseElement {
  type: 'box';
  width: number;
  height: number;
  borderThickness: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  x2: number;
  y2: number;
  borderThickness: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA data
}

export type ZplElement =
  | TextElement
  | BarcodeElement
  | QrcodeElement
  | BoxElement
  | LineElement
  | ImageElement;


