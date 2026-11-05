import type { OpticalOutcome } from '../../core/optical/bench.ts';
import { opticalMessage } from '../../equipment/optical/simulate.ts';
import { OpticalProjection } from './OpticalProjection.tsx';

export function OpticalPanel({ outcome, auxiliary, onAuxiliary, preview }: { outcome: OpticalOutcome; auxiliary: boolean; onAuxiliary: (value: boolean) => void; preview: boolean }) {
  const status = outcome.ok ? ({ 'wrong-side': '光屏在透镜左侧，不能承接右侧实像', missed: '光线未落入光屏，请调整位置或高度', diffuse: '发散光斑，光屏不能承接虚像或无有限像', defocused: '光屏离焦，请自行移动找像', sharp: '光屏上形成清晰实像' }[outcome.screenStatus]) : opticalMessage(outcome.code);
  return <section className="optical-panel" aria-label="光学观察与诊断">
    <h3>{preview ? '移动预览' : '光屏观察'}</h3><p role={outcome.ok ? undefined : 'status'} data-testid="optical-status">{status}</p>
    {outcome.ok && <>
      <svg className="optical-screen-view" viewBox={`${-outcome.setup.screen.widthM / 2} ${-outcome.setup.screen.heightM / 2} ${outcome.setup.screen.widthM} ${outcome.setup.screen.heightM}`} role="img" aria-label="光屏正视图" data-sharpness={outcome.sharpness} data-spot-radius-m={outcome.spotRadiusM} data-captured-fraction={outcome.capturedFraction}>
        <OpticalProjection outcome={outcome} />
      </svg>
      <p>{outcome.aligned ? '三心已基本同高' : '三心未同高：偏心可能使像移位或离开光屏'}。正视图为放大观察，不改变实际光屏尺寸。</p>
      {!outcome.imageInBench && outcome.image.kind !== 'no-finite-image' && <p>当前光具座范围内可能找不到清晰像，允许保留这一观察。</p>}
    </>}
    <label><input type="checkbox" checked={auxiliary} onChange={event => onAuxiliary(event.target.checked)} />显示辅助光线与理论（可关闭）</label>
    {auxiliary && outcome.ok && <div className="optical-theory" data-testid="optical-theory">
      <p>近轴模型：1/f=1/u+1/v，m=−v/u。蓝/金线是实际传播辅助线，紫色虚线为反向延长线。</p>
      <p>物距 u={Number(outcome.objectDistanceM.toPrecision(6))} m；{outcome.image.kind === 'no-finite-image' ? 'u=f：出射光平行，无有限像；v、m 不适用。' : `v=${Number(outcome.image.imageDistanceM.toPrecision(6))} m，m=${Number(outcome.image.magnification.toPrecision(6))}；${outcome.image.kind === 'real' ? '倒立实像' : '正立放大虚像'}。`}</p>
      {outcome.image.kind === 'virtual' && <><h3>虚像观察辅助示意（非光屏）</h3><svg viewBox="-.05 -.06 .1 .12" role="img" aria-label="正立放大虚像观察辅助" data-virtual-observer="true"><rect x="-.05" y="-.06" width=".1" height=".12" fill="#edf3f7" /><g transform={`scale(${Math.min(4, outcome.image.magnification)})`}><path d="M0-.01C-.009.005-.001.018.004.008C.007.002.001-.004 0-.01" fill="#f4b63c" /></g></svg><p>示意按放大率显示（超过 4 倍裁限示意大小），虚像不是光屏上的像。</p></>}
    </div>}
    <details><summary>实验步骤与模型范围</summary><ol><li>取光具座、蜡烛、透镜、光屏和独立尺。分别移动，先将火焰中心、透镜中心、光屏中心调到同高。</li><li>f=0.10 m，分别探索 u=0.30、0.20、0.15、0.10、0.05 m。实像区自行移动光屏找像，不自动对焦。</li><li>用座上刻度或独立尺读位置（cm 除以 100 转 m），填写记录和自己的像的特点；开启辅助仅用于核对。</li></ol><p>水平光轴、左向右、单薄凸透镜近轴教学模型；不模拟衍射、像差、真实火焰照明或烧毁。教材具体章节待教师核验。</p></details>
  </section>;
}
