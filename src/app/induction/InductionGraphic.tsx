import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { MeterReading } from '../../core/electrical/instruments.ts';
import { GALVANOMETER, MAGNET } from '../../equipment/induction/definitions.ts';

export function inductionBounds(instance: EquipmentInstance) {
  return instance.type === MAGNET ? { x: -.64, y: -.34, width: 1.3, height: .64 } : instance.type === GALVANOMETER ? { x: -.125, y: -.105, width: .275, height: .22 }
    : { x: -.115, y: -.23, width: .23, height: .46 };
}
export function InductionGraphic({ instance, reading }: { instance: EquipmentInstance; reading?: MeterReading | undefined }) {
  const p = instance.parameters;
  if (instance.type === MAGNET) {
    const top = p.reversed ? '#507e9d' : '#bf6159', lower = p.reversed ? '#bf6159' : '#507e9d';
    const profile = 'M.43-.24H-.37C-.52-.24-.59-.14-.59 0S-.52.24-.37.24H.43V.16H-.37C-.46.16-.50.09-.50 0S-.46-.16-.37-.16H.43Z';
    return <g className="real-apparatus" stroke="none" data-induction-perspective="horseshoe" data-induction-field={p.reversed ? 'upward' : 'downward'}>
      <path d={profile} transform="translate(.12 -.07)" fill="#7b8c93" stroke="#52666d" strokeWidth="1" />
      <path d="M-.37-.24H.43L.55-.31H-.25Z" fill={top} stroke="#854e49" strokeWidth=".7" />
      <path d="M-.37 .16H.43L.55 .09H-.25Z" fill={lower} opacity=".8" stroke="#486579" strokeWidth=".7" />
      <path d="M.43-.24L.55-.31V-.23L.43-.16Z" fill={top} stroke="#5b5352" strokeWidth="1" />
      <path d="M.43 .16L.55 .09V.17L.43 .24Z" fill={lower} stroke="#455d6b" strokeWidth="1" />
      <path d={profile} fill="#a9b6bb" stroke="#647b81" strokeWidth="1.2" />
      <path d="M-.37-.24H.43V-.16H-.37Z" fill={top} /><path d="M-.37 .16H.43V.24H-.37Z" fill={lower} />
      <path d="M-.37-.23H.42M-.37 .17H.42" stroke="#e4e9e6" strokeWidth="1" opacity=".7" />
      <text x=".29" y="-.183" fill="white" fontSize=".045" textAnchor="middle" fontWeight="700">{p.reversed ? 'S' : 'N'}</text>
      <text x=".29" y=".217" fill="white" fontSize=".045" textAnchor="middle" fontWeight="700">{p.reversed ? 'N' : 'S'}</text>
      <g data-magnetic-field-arrows="true" pointerEvents="none" stroke="#75a696" strokeWidth="1.1" opacity=".65">
        {[-.19, -.06, .07, .20].map(x => <g key={x}><path d={p.reversed ? `M${x} .11V-.105m-.009 .017l.009-.017 .009 .017` : `M${x}-.11V.105m-.009-.017l.009 .017 .009-.017`} fill="none" strokeDasharray="3 3" /></g>)}
      </g>
    </g>;
  }
  if (instance.type === GALVANOMETER) {
    const fraction = reading?.needleFraction ?? .5, angle = Math.PI + fraction * Math.PI, maximum = Number(p.maximumA) * 1000;
    const divisions = Math.max(1, Math.min(50, Math.round(Number(p.maximumA) / Number(p.resolutionA))));
    return <g className="real-apparatus" stroke="none" data-galvanometer={instance.id} data-meter-status={reading?.status ?? 'unavailable'} data-needle-fraction={fraction}>
      <path d="M-.115-.078L-.09-.1H.14V.08L.115 .102Z" fill="#9a8051" stroke="#665332" strokeWidth="1" />
      <path d="M.115-.078L.14-.1V.08L.115 .102Z" fill="#806a45" />
      <rect x="-.115" y="-.078" width=".23" height=".18" rx=".01" fill="#6b5b40" /><rect x="-.105" y="-.067" width=".21" height=".155" rx=".006" fill="#eee9d6" />
      <path d="M-.085 .035A.085 .085 0 0 1 .085 .035" fill="none" stroke="#627064" strokeWidth="1.3" />
      {Array.from({ length: 2 * divisions + 1 }, (_, i) => { const theta = Math.PI + i / (2 * divisions) * Math.PI, radius = .085, major = i === divisions || i % Math.max(1, Math.ceil(divisions / 2)) === 0 || i === 2 * divisions; return <g key={i}><path data-galvanometer-tick={i} d={`M${radius * Math.cos(theta)} ${.035 + radius * Math.sin(theta)}L${(radius - (major ? .011 : .006)) * Math.cos(theta)} ${.035 + (radius - (major ? .011 : .006)) * Math.sin(theta)}`} stroke="#566357" strokeWidth={major ? 1.3 : .8} />{major && <text x={.061 * Math.cos(theta)} y={.035 + .061 * Math.sin(theta)} fontSize=".014" textAnchor="middle" dominantBaseline="middle" fill="#30493f">{Number(((i / divisions - 1) * maximum).toPrecision(3))}</text>}</g>; })}
      <text x="0" y=".017" fontSize=".018" textAnchor="middle" fill="#344b41">G · mA</text>
      <path data-galvanometer-needle="true" d={`M0 .035L${.076 * Math.cos(angle)} ${.035 + .076 * Math.sin(angle)}`} stroke="#bd493a" strokeWidth="2" /><circle cy=".035" r=".004" fill="#677367" />
  
    </g>;
  }
  const coil = p.inductionShape === 'coil', half = Number(p.lengthM) / 2;
  const dx = 1.3 * half, dy = .75 * half;
  return <g className="real-apparatus" stroke="none" transform="rotate(90)" data-induction-conductor={coil ? 'coil' : 'rod'} data-induction-perspective="conductor">
    {coil ? <g fill="none" stroke="#b58542">
      <path d={`M${-dx - .06} ${dy}L${dx - .06} ${-dy}H${dx + .06}L${-dx + .06} ${dy}Z`} fill="#e1ad5a" fillOpacity=".12" strokeWidth="3" />
      <path d={`M${-dx - .05} ${dy - .007}L${dx - .05} ${-dy + .007}H${dx + .05}L${-dx + .05} ${dy - .007}Z`} strokeWidth="1" />
      <text x="0" y={-dy - .035} textAnchor="middle" stroke="none" fill="#735a32" fontSize=".024">{p.turns} 匝线圈</text>
    </g> : <g><path d={`M${-dx} ${dy}L${dx} ${-dy}`} stroke="#687f85" strokeWidth="8" strokeLinecap="round" /><path d={`M${-dx} ${dy - .003}L${dx} ${-dy - .003}`} stroke="#c2cdd0" strokeWidth="3" strokeLinecap="round" /></g>}
    <text x={-dx - .024} y={dy + .035} fill="#4e666e" fontSize=".030">A</text><text x={dx + .018} y={-dy - .015} fill="#4e666e" fontSize=".030">B</text>
  </g>;
}
