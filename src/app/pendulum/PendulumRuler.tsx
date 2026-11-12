import type { SceneDocument } from '../../core/scene/schema.ts';
import { pendulumRig } from '../../equipment/pendulum/simulate.ts';
import { MECHANICAL_RULER } from '../../equipment/mechanical/definitions.ts';

export function PendulumRuler({ scene, rulerId }: { scene: SceneDocument; rulerId: string }) {
  const rig = pendulumRig(scene), ruler = scene.equipment.find(item => item.id === rulerId && item.type === MECHANICAL_RULER);
  if (!rig.ok || !ruler || Math.abs(Math.sin(ruler.pose.rotationRad) + 1) > 1e-8 || ruler.pose.flippedX) return <p>请选择竖直向下的刻度尺后读尺。</p>;
  const length = Number(ruler.parameters.lengthM), top = ruler.pose.yM - rig.pivot.yM, center = top + rig.lengthM;
  return <details><summary>放大读尺（静止最低位置）</summary><p>摆球静止于最低位置时，量悬点到球心；标数为 cm，细格 1 mm。此窗随尺的位置变化，不代填读数。</p>
    <div className="pendulum-ruler-scroll" tabIndex={0} role="region" aria-label="单摆放大刻度尺，可纵向滚动"><svg width="260" height={length * 3000 + 40} role="img" aria-label="悬点与静止球心对应的实际尺标">
      <rect x="100" width="90" height={length * 3000 + 40} fill="#eee1b8" />
      {Array.from({ length: Math.floor(length * 1000) + 1 }, (_, n) => <g key={n}><path d={`M100 ${20 + n * 3}h${n % 10 ? 10 : 22}`} stroke="#51635f" strokeWidth=".7" />{n % 10 === 0 && <text x="144" y={24 + n * 3} fontSize="12">{n / 10}</text>}</g>)}
      {[top, center].map((position, n) => position >= 0 && position <= length ? <g key={n} data-pendulum-ruler-mark={n ? 'center' : 'pivot'}><path d={`M24 ${20 + position * 3000}H124`} stroke={n ? '#ba8035' : '#16786f'} strokeWidth="1.5" /><text x="24" y={15 + position * 3000} fontSize="12">{n ? '最低位置球心' : '悬点'}</text></g> : null)}
    </svg></div>
    {(top < 0 || center > length) && <p>刻度尺尚未覆盖两端，请移动或加长刻度尺。</p>}
  </details>;
}
