import type { EquipmentInstance } from '../../core/equipment/schema.ts';
import type { SceneDocument } from '../../core/scene/schema.ts';
import { METAL_WIRE, metalResistance, MetalWireSchema } from '../electrical/conductor.ts';
import { MAGNET, MagnetSchema } from './definitions.ts';

export const FIELD_WIDTH_M = .5, FIELD_HEIGHT_M = .32;
export function inductionParts(scene: Pick<SceneDocument, 'equipment'>) {
  const magnets = scene.equipment.filter(i => i.type === MAGNET), wires = scene.equipment.filter(i => i.type === METAL_WIRE);
  return { magnet: magnets.length === 1 ? magnets[0] : undefined, wire: wires.length === 1 ? wires[0] : undefined };
}
function overlap(a: number, aw: number, b: number, bw: number) { return Math.max(0, Math.min(a + aw / 2, b + bw / 2) - Math.max(a - aw / 2, b - bw / 2)); }
function slope(a: number, aw: number, b: number, bw: number, velocity: number) {
  const left = Math.max(a - aw / 2, b - bw / 2), right = Math.min(a + aw / 2, b + bw / 2);
  if (right <= left + 1e-12) return 0;
  return velocity * ((a + aw / 2 < b + bw / 2 - 1e-12 ? 1 : 0) - (a - aw / 2 > b - bw / 2 + 1e-12 ? 1 : 0));
}
export function inductionSource(scene: Pick<SceneDocument, 'equipment'>, wire: EquipmentInstance) {
  if (scene.equipment.filter(i => i.type === MAGNET).length > 1) throw new RangeError('INDUCTION_MULTIPLE_FIELDS');
  const p = MetalWireSchema.parse(wire.parameters), { magnet } = inductionParts(scene);
  const resistanceOhm = metalResistance(p) * (p.inductionShape === 'coil' ? 2 * Number(p.turns ?? 1) * (p.lengthM + .12) / p.lengthM : 1);
  if (!magnet) return { voltageV: 0, resistanceOhm };
  const m = MagnetSchema.parse(magnet.parameters);
  if (Math.abs(Math.cos(wire.pose.rotationRad)) > 1e-8 || Math.abs(Math.sin(magnet.pose.rotationRad)) > 1e-8 || wire.pose.flippedX || magnet.pose.flippedX) throw new RangeError('INDUCTION_ORIENTATION');
  const vx = Number(p.velocityXMPerS ?? 0) - Number(m.velocityXMPerS ?? 0), vy = Number(p.velocityYMPerS ?? 0) - Number(m.velocityYMPerS ?? 0);
  const x = wire.pose.xM, y = wire.pose.yM, mx = magnet.pose.xM, my = magnet.pose.yM;
  const field = m.fieldT * (m.reversed ? -1 : 1), orientation = Math.sign(Math.sin(wire.pose.rotationRad));
  if (p.inductionPerspective) {
    const depth = Math.min(p.lengthM, FIELD_HEIGHT_M), inGap = Math.abs(y - my) <= .16;
    const voltageV = !inGap ? 0 : p.inductionShape === 'coil'
      ? orientation * field * Number(p.turns ?? 1) * depth * slope(x, .12, mx, FIELD_WIDTH_M, vx)
      : Math.abs(x - mx) < FIELD_WIDTH_M / 2 ? orientation * field * depth * vx : 0;
    return { voltageV, resistanceOhm };
  }
  // Legacy planar snapshots retain their original coordinate interpretation.
  // Positive source voltage is Va − Vb. With a→b upward and B out of the page, rightward motion makes a positive.
  if (p.inductionShape !== 'coil') return { voltageV: Math.abs(x - mx) < FIELD_WIDTH_M / 2 ? orientation * field * vx * overlap(y, p.lengthM, my, FIELD_HEIGHT_M) : 0, resistanceOhm };
  // The two sides of a complete coil cancel while it translates wholly inside a uniform field.
  const width = .12, height = p.lengthM;
  const dArea = slope(x, width, mx, FIELD_WIDTH_M, vx) * overlap(y, height, my, FIELD_HEIGHT_M)
    + overlap(x, width, mx, FIELD_WIDTH_M) * slope(y, height, my, FIELD_HEIGHT_M, vy);
  return { voltageV: orientation * field * Number(p.turns ?? 1) * dArea, resistanceOhm };
}
