import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { METAL_WIRE, MetalWireSchema, metalMaterials, metalSampleId } from '../../equipment/electrical/conductor.ts';
import { conductorSample } from '../../equipment/conductor/experiment.ts';
import { HEATER } from '../../equipment/thermal/definitions.ts';

export function conductorBounds(type: string) {
  return type === METAL_WIRE ? { x: -.22, y: -.065, width: .44, height: .13 } : type === HEATER ? { x: -.17, y: -.02, width: .34, height: .08 } : { x: -.018, y: -.18, width: .07, height: .21 };
}
export function MetalWireGraphic({ instance }: { instance: EquipmentInstance }) {
  const p = MetalWireSchema.parse(instance.parameters), material = metalMaterials[p.material];
  const segments = Math.round(p.lengthM / .1), width = .30 / segments;
  const points = Array.from({ length: segments + 1 }, (_, i) => `${-.15 + width * i},${i === 0 || i === segments ? 0 : i % 2 ? -.014 : .014}`).join(' ');
  return <g data-metal-wire={instance.id}>
    <rect x="-.208" y="-.052" width=".416" height=".104" rx=".009" fill="#eee7d5" stroke="#a99e81" strokeWidth="1.2" />
    <path d="M-.2 0H-.15M.15 0H.2" stroke="#9b9e91" strokeWidth="3" />
    <polyline points={points} fill="none" stroke={material.color} strokeWidth={Math.sqrt(p.areaM2 / 1e-7) * .004} strokeLinecap="round" strokeLinejoin="round" />
    <text x="0" y="-.027" textAnchor="middle" fontSize=".014" fill="#385965">{metalSampleId(instance)} · {material.label}丝</text>
    <text x="0" y=".039" textAnchor="middle" fontSize=".013" fill="#385965">{Number((p.lengthM * 100).toFixed(2))} cm · {Number((p.areaM2 * 1e6).toFixed(3))} mm²</text>
  </g>;
}
export function ConductorAuxGraphic({ instance, scene }: { instance: EquipmentInstance; scene: Pick<SceneDocument, 'equipment'> }) {
  const wire = conductorSample(scene), p = MetalWireSchema.safeParse(wire?.parameters);
  const dx = wire ? instance.pose.xM - wire.pose.xM : Infinity, dy = wire ? instance.pose.yM - wire.pose.yM : Infinity;
  const angle = wire?.pose.rotationRad ?? 0;
  const near = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) <= .205 && Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= .025;
  if (instance.type === HEATER) return <g className="real-apparatus" stroke="none" data-appearance="physical" data-conductor-heater={instance.id}>
    <rect x="-.16" y="-.015" width=".32" height=".04" rx=".008" fill="#586c72" />
    <path d="M-.13 0H.13" stroke={p.success && p.data.temperatureK > 300 ? '#d88046' : '#b7b3a1'} strokeWidth="5" />
    <rect x="-.12" y=".025" width=".025" height=".025" fill="#374c55" /><rect x=".095" y=".025" width=".025" height=".025" fill="#374c55" />
    <text x="0" y=".055" fontSize=".012" textAnchor="middle" fill="#385965">{String(instance.parameters.powerW)} W</text>
  </g>;
  const celsius = p.success && near ? p.data.temperatureK - 273.15 : null, fraction = celsius === null ? 0 : Math.max(0, Math.min(1, (celsius - 20) / 60));
  return <g className="real-apparatus" stroke="none" data-appearance="physical" data-conductor-thermometer={instance.id}>
    <rect x="-.014" y="-.17" width=".028" height=".18" rx=".009" fill="#edf5f3" stroke="#8fa9ad" strokeWidth="1" />
    <rect x="-.004" y={-.01 - fraction * .14} width=".008" height={.014 + fraction * .14} fill="#bd5544" />
    <circle cy=".005" r=".009" fill="#bd5544" />
    {[20, 40, 60, 80].map(t => <g key={t}><path d={`M.005 ${-.01 - (t - 20) / 60 * .14}h.012`} stroke="#8b9b95" strokeWidth=".8" /><text x=".019" y={-.006 - (t - 20) / 60 * .14} fontSize=".012" fill="#385965">{t}</text></g>)}
    <text data-conductor-temperature="true" x="0" y=".033" fontSize=".014" fill="#385965" textAnchor="middle">{celsius === null ? '未接触' : `${Number((Math.round(celsius / Number(instance.parameters.resolutionK)) * Number(instance.parameters.resolutionK)).toFixed(1))} ℃`}</text>
  </g>;
}
