import { useEffect, useRef, useState } from 'react';

const rulerStepsMm = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const maxTapeZoom = 16;
const cm = (millimetres: number) => Number((millimetres / 10).toFixed(3));

export function CartPaperTape({ dots, stride, selectedM }: {
  dots: readonly { displacementM: number }[]; stride: number; selectedM: number | undefined;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [zoom, setZoom] = useState(1);
  const [storedFocus, setFocus] = useState<{ centerMm: number; selectedMm: number | undefined }>({ centerMm: 0, selectedMm: undefined });
  const selectedMm = selectedM === undefined ? undefined : Math.round(selectedM * 1000);
  const totalMm = Math.max(100, Math.ceil(Math.round((dots.at(-1)?.displacementM ?? 0) * 1000) / 100) * 100);
  const spanMm = totalMm / zoom;
  const focus = storedFocus.selectedMm === selectedMm ? storedFocus : { centerMm: selectedMm ?? storedFocus.centerMm, selectedMm };
  if (focus !== storedFocus) setFocus(focus);
  const maxStartMm = totalMm - spanMm;
  const startMm = Math.max(0, Math.min(maxStartMm, Math.round(focus.centerMm - spanMm / 2)));
  const endMm = startMm + spanMm;
  const plotWidth = width - 48;
  const xAt = (distanceMm: number) => 24 + plotWidth * (distanceMm - startMm) / spanMm;
  const minorMm = rulerStepsMm.find(step => step * plotWidth / spanMm >= 2.5) ?? 2000;
  const majorMm = rulerStepsMm.find(step => step % minorMm === 0 && step * plotWidth / spanMm >= 45) ?? 2000;
  const firstTickMm = Math.ceil(startMm / minorMm) * minorMm;
  const tickCount = Math.max(0, Math.floor((endMm - firstTickMm) / minorMm) + 1);
  const selectedVisible = selectedMm !== undefined && selectedMm >= startMm && selectedMm <= endMm;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = entry?.contentRect.width ?? 0;
      if (measured > 0) setWidth(Math.max(120, Math.round(measured)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function changeZoom(factor: number) {
    setFocus({ centerMm: selectedVisible ? selectedMm : startMm + spanMm / 2, selectedMm });
    setZoom(Math.min(maxTapeZoom, zoom * factor));
  }

  return <div className="cart-paper-view" ref={container}>
    <div className="cart-tape-actions">
      <button aria-label="缩小纸带" disabled={zoom === 1} onClick={() => changeZoom(.5)}>−</button>
      <span aria-label="纸带放大倍数">{zoom}×</span>
      <button aria-label="放大纸带" disabled={zoom === maxTapeZoom} onClick={() => changeZoom(2)}>＋</button>
      <button disabled={zoom === 1} onClick={() => setZoom(1)}>查看全带</button>
      {selectedMm !== undefined && maxStartMm > 0 && !selectedVisible && <button onClick={() => setFocus({ centerMm: selectedMm, selectedMm })}>定位所选点</button>}
    </div>
    <svg className="cart-paper-tape" viewBox={`0 0 ${width} 60`} role="img" aria-label="打点纸带">
      <rect x="4" y="4" width={width - 8} height="27" rx="4" fill="#f3dfb7" stroke="#bba374" />
      {dots.map((sample, index) => {
        const distanceMm = Math.round(sample.displacementM * 1000);
        if (distanceMm < startMm || distanceMm > endMm) return null;
        return <circle key={index} cx={xAt(distanceMm)} cy="17" r={index % stride === 0 ? 2.3 : 1.3} fill={index % stride === 0 ? '#17635f' : '#776850'} />;
      })}
      {selectedVisible && <circle data-cart-tape-selected="true" cx={xAt(selectedMm)} cy="17" r="6" fill="none" stroke="#a64b2c" strokeWidth="1.6" />}
      <path d={`M24 32H${width - 24}`} stroke="#6a6958" />
      {Array.from({ length: tickCount }, (_, index) => {
        const distanceMm = firstTickMm + index * minorMm, x = xAt(distanceMm);
        const major = distanceMm % majorMm === 0;
        const length = major ? 11 : distanceMm % (majorMm / 2) === 0 ? 8 : 5;
        return <g key={distanceMm}>
          <path data-cart-tape-tick-mm={distanceMm} d={`M${x} 32v${length}`} stroke="#6a6958" />
          {major && <text x={x} y="56" textAnchor="middle" fontSize="12" fill="#495650">{cm(distanceMm)}</text>}
        </g>;
      })}
      <text x={width - 4} y="11" textAnchor="end" fontSize="10" fill="#495650">cm</text>
    </svg>
    <div className="cart-tape-scale">{cm(startMm)}–{cm(endMm)} cm · 每小格 {minorMm} mm</div>
    {maxStartMm > 0 && <label>沿纸带移动<input type="range" aria-label="沿纸带移动" aria-valuetext={`从 ${cm(startMm)} 厘米到 ${cm(endMm)} 厘米`} min={0} max={Math.ceil(maxStartMm)} step={1} value={Math.ceil(startMm)}
      onChange={event => setFocus({ centerMm: Number(event.target.value) + spanMm / 2, selectedMm })} /></label>}
  </div>;
}
