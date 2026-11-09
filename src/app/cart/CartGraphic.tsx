import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import { worldToScreen } from '../../core/workbench/geometry.ts';
import type { SurfaceSize, Viewport } from '../../core/workbench/geometry.ts';
import { CART, GATE, TICKER, TRACK } from '../../equipment/cart/definitions.ts';
import { cartDisplacement } from '../../equipment/cart/simulate.ts';
import type { CartRig, CartRun } from '../../equipment/cart/simulate.ts';

export function cartBounds(item: EquipmentInstance) {
  if (item.type === TRACK) {
    const half = Number(item.parameters.lengthM) / 2;
    return { x: -half, y: -.08, width: 2 * half + .045, height: .14 };
  }
  if (item.type === CART) return { x: -.115, y: -.17, width: .23, height: .17 };
  if (item.type === GATE) return { x: -.042, y: -.15, width: .084, height: .18 };
  return { x: -.085, y: -.047, width: .17, height: .1 };
}

export function CartGraphic({ instance, run }: { instance: EquipmentInstance; run?: CartRun | null | undefined }) {
  const { type, parameters } = instance;
  const half = Number(parameters.lengthM) / 2;
  const reading = run?.rig.gateEvents.find(event => event.gate.id === instance.id)?.reading;
  const blocked = !!(run && reading && run.timeS >= reading.entryS && run.timeS < reading.exitS);
  const flag = Number(parameters.flagWidthM);
  return <g className="real-apparatus" data-appearance="physical" data-cart-type={type} stroke="none">
    {type === TRACK && <>
      <rect x={-half} y="0" width={2 * half} height=".025" rx=".004" fill="#879c9e" stroke="#45646a" strokeWidth="1" />
      <path d={`M${-half} .005H${half}`} stroke="#d7e0dd" strokeWidth="2" />
      {[-half + .08, half - .08].map(x => <rect key={x} x={x - .029} y=".025" width=".058" height=".035" rx=".004" fill="#37545b" />)}
      {Array.from({ length: Math.floor(half * 20) + 1 }, (_, i) => <path key={i} d={`M${-half + i / 10} .008v.012`} stroke="#476164" strokeWidth=".8" />)}
      <rect x={half - .015} y="-.052" width=".03" height=".078" fill="#617e81" />
      <circle cx={half} cy="-.026" r=".026" fill="#d7dfd5" stroke="#536f72" strokeWidth="1.5" />
      <circle cx={half} cy="-.026" r=".007" fill="#6e8686" />
    </>}
    {type === CART && <>
      <rect x="-.11" y="-.069" width=".22" height=".045" rx=".011" fill="#245e66" />
      {[-.075, .075].map(x => <g key={x}><circle cx={x} cy="-.021" r=".021" fill="#35464b" /><circle cx={x} cy="-.021" r=".01" fill="#bcc4b6" /></g>)}
      <rect x="-.01" y="-.126" width=".02" height=".057" fill="#71898a" />
      <rect x={-flag / 2} y="-.158" width={flag} height=".04" rx=".003" fill="#39484d" />
      {Number(parameters.loadMassKg) > 0 && <rect x="-.069" y="-.096" width=".046" height=".026" rx=".004" fill="#bb8c48" />}
      <circle cx=".108" cy="-.052" r=".009" fill="#d7ae71" />
    </>}
    {type === GATE && <>
      <rect x="-.04" y=".006" width=".08" height=".019" rx=".005" fill="#405b62" />
      <rect x="-.013" y="-.13" width=".021" height=".136" fill="#718f91" />
      <path d="M-.025-.118v-.031h.067v.031h-.014v-.017h-.038v.017Z" fill="#416f79" />
      <path d="M-.014-.123h.046" stroke={blocked ? '#f1ad48' : '#bb6251'} strokeWidth="1.1" strokeDasharray="2 2" />
      <circle cx=".024" cy="-.142" r=".006" fill={blocked ? '#ffc155' : '#b1d3b5'} data-cart-gate-blocked={blocked} />
    </>}
    {type === TICKER && <>
      <rect x="-.083" y="-.043" width=".166" height=".085" rx=".012" fill="#415c64" />
      <rect x="-.06" y="-.009" width=".12" height=".023" rx=".004" fill="#d9c5a0" />
      <path d="M-.042 .003h.084" stroke="#8e795e" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx=".058" cy="-.026" r=".009" fill="#dca654" />
      <text x="0" y=".031" textAnchor="middle" fontSize=".013" fill="#eef2e6">{String(parameters.frequencyHz)} Hz</text>
    </>}
  </g>;
}

export function CartTether({ rig, run, view, size }: { rig: CartRig; run: CartRun | null; view: Viewport; size: SurfaceSize }) {
  const yM = rig.track.pose.yM, displacement = run ? cartDisplacement(rig, run.timeS) : 0;
  const hasHanger = Number(rig.cart.parameters.hangerMassKg) > 0;
  const ticker = rig.ticker && worldToScreen({ xM: rig.ticker.pose.xM + .06, yM: rig.ticker.pose.yM }, view, size);
  const rear = worldToScreen({ xM: rig.startXM + displacement - .11, yM: yM + .052 }, view, size);
  const from = worldToScreen({ xM: rig.startXM + displacement + .11, yM: yM + .052 }, view, size);
  const pulley = worldToScreen({ xM: rig.rightXM + .026, yM: yM + .052 }, view, size);
  const hanger = worldToScreen({ xM: rig.rightXM + .024, yM: yM - .09 - displacement }, view, size);
  const width = .073 * view.pixelsPerM, height = .05 * view.pixelsPerM;
  return <g pointerEvents="none" aria-hidden="true">
    {ticker && <path d={`M${ticker.x} ${ticker.y}L${rear.x} ${rear.y}`} stroke="#d2b481" strokeWidth="3" />}
    {hasHanger && <g data-cart-hanger="true">
      <path d={`M${from.x} ${from.y}H${pulley.x - .026 * view.pixelsPerM}Q${pulley.x} ${pulley.y} ${pulley.x} ${pulley.y + .026 * view.pixelsPerM}V${hanger.y}`} fill="none" stroke="#8d734a" strokeWidth="1.5" />
      <rect x={hanger.x - width / 2} y={hanger.y} width={width} height={height} rx="3" fill="#b09162" stroke="#78633e" />
    </g>}
  </g>;
}
