import { useId, useState } from 'react';
import { mirrorImageMessage } from '../../equipment/mirrorImage/simulate.ts';
import type { MirrorImageOutcome } from '../../equipment/mirrorImage/simulate.ts';
import { MarkerShape } from './MirrorImageGraphic.tsx';

const sightWindow = { x: 14, y: 8, width: 152, height: 130 };
const sightFocalLength = 360;

function MirrorSight({ outcome }: { outcome: Extract<MirrorImageOutcome, { ok: true }> }) {
  const apertureId = useId();
  const { mirror, eye, mirrorBottom, mirrorTop, imageProjection, matchProjection } = outcome;
  const focus = imageProjection.visible ? imageProjection : matchProjection;
  const viewBottom = focus?.visible ? Math.max(mirrorBottom, focus.bottom.yM) : mirrorBottom;
  const viewTop = focus?.visible ? Math.min(mirrorTop, focus.top.yM) : mirrorTop;
  const center = (viewBottom + viewTop) / 2;
  const scale = sightFocalLength / (mirror.pose.xM - eye.pose.xM);
  const yAt = (mirrorYM: number) => sightWindow.y + sightWindow.height / 2 - (mirrorYM - center) * scale;
  const apertureTop = Math.max(sightWindow.y, yAt(mirrorTop));
  const apertureBottom = Math.min(sightWindow.y + sightWindow.height, yAt(mirrorBottom));
  const aperture = { ...sightWindow, y: apertureTop, height: apertureBottom - apertureTop };
  return <svg className="mirror-sight" viewBox="0 0 180 146" role="img" aria-label="从观察眼透过玻璃板所见">
    <defs><clipPath id={apertureId}><rect {...aperture} rx="5" /></clipPath></defs>
    <rect {...sightWindow} rx="5" fill="#f7f9f8" stroke="#6b939a" strokeWidth="2" />
    <g clipPath={`url(#${apertureId})`}>
      <rect {...aperture} fill="#edf5f5" />
      {[imageProjection, matchProjection].map((projection, index) => {
        if (!projection?.visible) return null;
        const height = (projection.top.yM - projection.bottom.yM) * scale;
        const y = yAt((projection.top.yM + projection.bottom.yM) / 2);
        return <g key={index} transform={`translate(90 ${y})`} data-testid={index ? 'mirror-match-view' : 'mirror-virtual-view'}>
          <MarkerShape height={height} color={index ? '#16766e' : '#ba6551'} outline={index === 1} />
        </g>;
      })}
    </g>
  </svg>;
}

export function MirrorImagePanel({ outcome, guides, rays, onGuides, onRays, onEyeStep }: {
  outcome: MirrorImageOutcome; guides: boolean; rays: boolean; onGuides: (value: boolean) => void; onRays: (value: boolean) => void; onEyeStep: (deltaM: number) => void;
}) {
  const [mode, setMode] = useState<'eye' | 'screen'>('eye');
  return <section className="mirror-image-panel config-section" aria-label="平面镜观察">
    <h3>平面镜观察</h3>
    {!outcome.ok ? <p data-testid="mirror-image-status">{mirrorImageMessage(outcome.code)}</p> : <>
      <div className="mirror-image-actions"><button aria-pressed={mode === 'eye'} onClick={() => setMode('eye')}>用眼观察</button><button aria-pressed={mode === 'screen'} onClick={() => setMode('screen')}>用光屏验证</button></div>
      {mode === 'eye' ? <>
        <MirrorSight outcome={outcome} />
        <p data-testid="mirror-image-status">{!outcome.imageProjection.visible ? '这条视线在玻璃板内看不到像。请把观察眼移向镜面中央。' : !outcome.imageProjection.complete ? '只看到部分像，请调整观察眼使完整像进入镜面。' : !outcome.matchProjection?.complete ? '红色为镜中所见。请把对照物移到镜后，并调整到能完整看见的位置。' : '红色是镜中的像，青色轮廓是镜后对照物。上下移动观察眼，检查两者是否始终重合。'}</p>
        <div className="mirror-image-actions"><button onClick={() => onEyeStep(.05)}>抬高观察眼</button><button onClick={() => onEyeStep(-.05)}>降低观察眼</button></div>
      </> : <>
        {outcome.screen && <svg className="mirror-sight" viewBox="0 0 180 146" role="img" aria-label="光屏正面，无清晰成像"><rect data-testid="mirror-screen-face" x="27" y="9" width="126" height="128" rx="4" fill="#fcf8e8" stroke="#5c6f70" strokeWidth="4" /></svg>}
        <p data-testid="mirror-image-status">{outcome.screen ? '请把光屏移到刚用对照物确定的位置，使光屏盖住对照物的上下两端，再观察屏面。' : '请从器材库添加光屏，移到镜后估计的像位。'}</p>
      </>}
    </>}
    <label><input type="checkbox" checked={guides} onChange={event => onGuides(event.target.checked)} /> 显示读尺辅助线</label>
    <label><input type="checkbox" checked={rays} onChange={event => onRays(event.target.checked)} /> 显示反射光路与虚像</label>
    <details><summary>实验步骤</summary><ol>
      <li>从薄玻璃板左侧看像，移动镜后的对照物。抬高、降低观察眼，两者都重合时，用对照物的位置确定像位。</li>
      <li>水平尺上分别读物、玻璃板、对照物的位置，用刻度之差得到物距和像距。用竖直尺分别量物高和对照物的高度。移动物体再测一组。</li>
      <li>把光屏放到已找出的像位，在「用光屏验证」中观察。对照两种观察方法，将现象写入记录表。</li>
    </ol></details>
  </section>;
}
