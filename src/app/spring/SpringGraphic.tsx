import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SpringOutcome } from '../../equipment/spring/simulate.ts';
export function SpringGraphic({ instance, outcome }: { instance: EquipmentInstance; outcome?: SpringOutcome | null | undefined }) {
  const length = outcome?.ok ? outcome.value.lengthM : Number(instance.parameters.originalLengthM), valid = !outcome || outcome.ok;
  const coil = Array.from({ length: 25 }, (_, index) => `${index ? 'L' : 'M'}${index === 0 || index === 24 ? 0 : index % 2 ? -.015 : .015} ${.015 + index / 24 * Math.max(.002, length - .03)}`).join(' ');
  return <g className="real-apparatus" data-appearance="physical" data-spring-appearance="physical" data-spring-state={outcome?.ok ? 'valid' : outcome ? outcome.code : 'preview'} data-spring-length-m={outcome?.ok ? length : undefined} stroke="none">
    <path d="M-.08 0H0" stroke="#7e969b" strokeWidth="4" /><circle r=".005" fill="#b89348" />
    <path d={`M0 0V.015${coil.replace('M', 'L')}L0 ${length}`} fill="none" stroke={valid ? '#78979a' : '#b3896c'} strokeWidth="2.5" strokeDasharray={valid ? undefined : '4 3'} />
    <path d={coil} fill="none" stroke="#c3d1ce" strokeWidth="1" />
    <rect data-spring-grip="true" x="-.026" y=".015" width=".052" height={Math.max(.02, length - .03)} fill="transparent" pointerEvents="all" />
    <circle data-spring-bottom="true" cy={length} r=".005" fill="none" stroke="#637f82" strokeWidth="1.5" />
    {Number(instance.parameters.trayMassKg) > 0 && <path d={`M-.025 ${length + .018}h.05l-.008 .009h-.034Z`} fill="#a7b4b3" stroke="#637f82" strokeWidth="1" />}
    {!valid && <text x=".025" y={length / 2} fontSize=".018" fill="#ac5735">!</text>}
  </g>;
}
