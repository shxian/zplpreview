import { useState } from 'react';
import './App.css';
import { ZplPreview, type DimensionUnit } from './ZplPreview';
import { parseZplDimensions } from './zplParser';

const SAMPLE_ZPL = `^XA
^MMT
^CW0,E:MHEIGB18.TTF
^CI26
^CF0^FS
^LH0,0
^PW596
^FO159,16^A@N,15,15^FD网络已实名,谣言必^FS
^FO159,31^A@N,15,15^FD追究–安徽省网安总^FS
^FO159,46^A@N,15,15^FD队^FS
^FO431,16^A@N,69,69^FD标快^FS
^FO15,72^A@N,18,18^FD客服热线 95338^FS
^FO15,96^A@N,18,18^FD 已验视^FS
^FO156,96^A@N,18,18^FDSCP-CMD 1 2025-11-26 15:40:21^FS
^FO20,120^BY5^BCN,101,N,N,N,A^FDSF3293304552812^FS
^FO23,240^A@N,33,33^FD运单号 SF 329 330 455 2812^FS
^FO15,296^GB553,0,1,B^FS
^FO15,369^GB553,0,1,B^FS
^FO15,448^GB553,0,1,B^FS
^FO15,668^GB553,0,1,B^FS
^FO15,296^GB0,548,1,B^FS
^FO569,296^GB0,548,1,B^FS
^FO335,448^GB0,220,1,B^FS
^FO15,840^GB553,0,1,B^FS
^FO19,297^A@N,60,60^FD551EQ-A1-013^FS
^FO23,376^A@N,54,54^FD 013^FS
^FO483,380^A@N,69,69^FDAA^FS
^FO23,464^A@N,54,54^FD收^FS
^FO78,460^A@N,42,42^FD李* ^FS
^FO85,500^A@N,36,36^FD10002^FS
^FO23,536^A@N,24,24^FD李氏集团^FS
^FO23,576^A@N,24,24^FD安徽省合肥市蜀山区振兴路2号^FS
^FO195,648^A@N,24,24^FD寄付现结^FS
^FO354,456^BQ,2,5^FDD03040C,LA,MMM={'k1':'551','k2':'551EQ','k3':'013','k4':'T801','k5':'SF3293304552812','k6':'','k7':'6f121f7a'}^FS
^FO23,680^A@N,21,21^FD寄 张 1*0001 张氏集团 安徽省合肥市蜀山区振兴路1^FS
^FO23,701^A@N,21,21^FD号^FS
^FO19,736^A@N,72,72^FDK20606^FS
^FO452,728^GFA,1352,1352,13,00000000000FFFF000000000000000000001FFFFFF8000000000000000000FFFFFFFF000000000000000007FFFFFFFFE0000000000000001FFF0000FFF8000000000000007FF000000FFE00000000000001FF00000000FF80000000000007FC000000003FE000000000001FE00000000007F800000000003F800000000001FC00000000007F000000000000FE0000000001FC0000000000003F8000000003F00000000000001FC000000007E000000000000007E00000000FC000000000000003F00000001F8000000000000001F80000003E00000000000000007C0000007C00000000000000003E000000F800000000000000001F000001F000000000000000000F800001F000000000000000000F800003E0000080000000000007C00007C00000F8000000000003E0000F800001FE000000000001F0000F800001FE000000000000F0001F000003FE000000000000F8001E000003FC00000000000078003E000007FFFFFFFFFC00007C003C000007FFFFFFFFFE00003C007800000FFFFFFFFFFE00001E007800000FFFFFFFFFFE00001E00F000001FFFFFFFFFFE00000F00F000003FFFFFFFFFFC00000F01F000003FFFFFFFFFFC00000F81E000007FC0000001FC00000781E00000FFC0000001FC00000783C00001FF80000001FC000003C3C00001FF00000001FC000003C3C00003FF00000001FC000003C7C00007FE00000001FC000003E780000FFFFFFFFE01FC000001E780001FFFFFFFFE01FC000001E780001FFFFFFFFE01FC000001E780003FFFFFFFFE01FC000001EF00003FFFFFFFFE01FC000000FF00001FFFFFFFFE01FC000000FF00000FFFFFFFFE01FC000000FF000007FF0000FE01FC000000FF0000037F0000FE01FC000000FF0000007F0000FE01FC000000FF0000007F0000FE01FC000000FF0000007F0000FE01FC000000FF0000007FFFFFFE01FC000000FF0000007FFFFFFE01FC000000FF0000007FFFFFFE01FC000000FF0000007FFFFFFE03FC000000F78000007FFFFFFE03FC000001E78000007FFFFFFE3FFC000001E78000007F000003FFFC000001E78000007F000003FFFC000001E7C000007F000003FFF8000003E3C000007F000001FFF8000003C3C000007F000001FFF7000003C3C000007F000001FFC7E00003C1E000007F000000FC07F0000781E000007F0000000007F0000781F000007F0000000007F0000F80F000007F000000000FF0000F00F000007F800000000FF0000F007800007FF8000000FFF0001E007800003FFFFFFFFFFFF0001E003C00003FFFFFFFFFFFE0003C003E00003FFFFFFFFFFFE0007C001E00001FFFFFFFFFFFC00078001F00000FFFFFFFFFFF8000F8000F000003FFFFFFFFFE0001F0000F800000001FFFC0000001F00007C0000000000000000003E00003E0000000000000000007C00001F000000000000000000F800001F000000000000000000F800000F800000000000000001F0000007C00000000000000003E0000003E00000000000000007C0000001F8000000000000001F80000000FC000000000000003F000000007E000000000000007E000000003F80000000000000FC000000001FC0000000000003F80000000007F000000000000FE00000000003F800000000001FC00000000001FE00000000007F8000000000007FC000000003FE0000000000001FF00000000FF800000000000007FF000000FFE000000000000001FFF0000FFF80000000000000007FFFFFFFFE00000000000000000FFFFFFFF0000000000000000001FFFFFF800000000000000000000FFFF00000000000^FS
^FO0,112^A@R,18,18^FDSF3293304552812^FS
^FO0,392^A@R,18,18^FDSF3293304552812^FS
^FO0,680^A@R,18,18^FDSF3293304552812^FS
^FO584,104^A@B,18,18^FDSF3293304552812^FS
^FO584,384^A@B,18,18^FDSF3293304552812^FS
^FO584,672^A@B,18,18^FDSF3293304552812^FS
^FO23,856^A@N,27,27^FD托寄物：文件^FS
^FO23,883^A@N,27,27^FD订单号：202509010000121^FS
^XZ`;

type DensityDpi = 203 | 300;

function dotsToUnit(dots: number, unit: DimensionUnit, dpi: DensityDpi): number {
  const dotsPerMm = dpi / 25.4;
  const dotsPerCm = dpi / 2.54;
  const dotsPerInch = dpi;

  switch (unit) {
    case 'mm':
      return dots / dotsPerMm;
    case 'cm':
      return dots / dotsPerCm;
    case 'inches':
      return dots / dotsPerInch;
    case 'dots':
      return dots;
  }
}

function unitToDots(value: number, unit: DimensionUnit, dpi: DensityDpi): number {
  const dotsPerMm = dpi / 25.4;
  const dotsPerCm = dpi / 2.54;
  const dotsPerInch = dpi;

  switch (unit) {
    case 'mm':
      return value * dotsPerMm;
    case 'cm':
      return value * dotsPerCm;
    case 'inches':
      return value * dotsPerInch;
    case 'dots':
      return value;
  }
}

function App() {
  const [zpl, setZpl] = useState(SAMPLE_ZPL);
  const [density, setDensity] = useState<DensityDpi>(203);
  const [unit, setUnit] = useState<DimensionUnit>('mm');
  const [width, setWidth] = useState<number | undefined>(76);
  const [height, setHeight] = useState<number | undefined>(130);

  // 当 ZPL 改变时，尝试从 ZPL 中提取尺寸，并转换为当前单位
  const handleZplChange = (newZpl: string) => {
    setZpl(newZpl);
    try {
      const dims = parseZplDimensions(newZpl);
      if (dims.width > 0 && dims.height > 0) {
        setWidth(dotsToUnit(dims.width, unit, density));
        setHeight(dotsToUnit(dims.height, unit, density));
      }
    } catch {
      // 如果解析失败，保持当前值
    }
  };

  // 当单位改变时，转换当前尺寸值
  const handleUnitChange = (newUnit: DimensionUnit) => {
    if (width === undefined || height === undefined) {
      setUnit(newUnit);
      return;
    }

    const widthDots = unitToDots(width, unit, density);
    const heightDots = unitToDots(height, unit, density);

    setWidth(dotsToUnit(widthDots, newUnit, density));
    setHeight(dotsToUnit(heightDots, newUnit, density));
    setUnit(newUnit);
  };

  // 把原来的 handleDensityChange 整段替换为下面这个版本
  const handleDensityChange = (nextDensity: DensityDpi) => {
    // 只更新打印密度，让 Label Size 始终表示物理尺寸（mm/cm/in）
    // 这样在 ZplPreview 里 widthInDots 会随 dpi 变化，
    // 再结合固定的 MAX_PREVIEW_WIDTH/HEIGHT，就会出现：
    // dpi 越高，预览画面越小的效果（与 Labelary 一致）。
    setDensity(nextDensity);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>ZPL 中文标签预览</h1>
      </header>
      <main className="app-main">
        <section className="editor-section">
          <h2>ZPL 指令</h2>
          <textarea
            value={zpl}
            onChange={(e) => handleZplChange(e.target.value)}
            spellCheck={false}
          />

          <div className="paper-config">
            <div className="paper-config-row">
              <label className="paper-config-label">
                <span className="paper-config-title">Print Density</span>
                <select
                  className="input-select"
                  value={density}
                  onChange={(e) => handleDensityChange(Number(e.target.value) as DensityDpi)}
                >
                  <option value={203}>203 dpi (8 dpmm)</option>
                  <option value={300}>300 dpi (12 dpmm)</option>
                </select>
              </label>
            </div>

            <div className="paper-config-row">
              <div className="paper-config-label">
                <span className="paper-config-title">Label Size</span>
                <div className="paper-config-size">
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    step={unit === 'dots' ? 1 : 0.1}
                    value={width ?? ''}
                    onChange={(e) =>
                      setWidth(e.target.value ? Number.parseFloat(e.target.value) : undefined)
                    }
                  />
                  <span className="paper-config-multiply">×</span>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    step={unit === 'dots' ? 1 : 0.1}
                    value={height ?? ''}
                    onChange={(e) =>
                      setHeight(e.target.value ? Number.parseFloat(e.target.value) : undefined)
                    }
                  />
                  <select
                    className="input-select"
                    value={unit}
                    onChange={(e) => handleUnitChange(e.target.value as DimensionUnit)}
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="inches">inches</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="preview-section">
          <h2>预览</h2>
          <ZplPreview
            zpl={zpl}
            width={width}
            height={height}
            unit={unit}
            dpi={density}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
