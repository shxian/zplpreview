import { useEffect, useRef } from 'react';
import { parseZpl } from './zplParser';
import { renderZplToCanvas } from './canvasRenderer';

export interface ZplPreviewProps {
  zpl: string;
  width?: number;
  height?: number;
  scale?: number;
}

export function ZplPreview({ zpl, width = 596, height = 900, scale = 1 }: ZplPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * scale * dpr;
    canvas.height = height * scale * dpr;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const elements = parseZpl(zpl);
    renderZplToCanvas(ctx, elements, { scale: 1 });
  }, [zpl, width, height, scale]);

  return (
    <div style={{ border: '1px solid #ddd', background: '#f8f8f8', padding: 8 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}


