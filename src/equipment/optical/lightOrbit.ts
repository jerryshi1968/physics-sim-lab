import type { SceneDocument } from '../../core/scene/schema.ts';
import { createLightOrbit } from '../../core/workbench/lightOrbit.ts';
import { EMITTER, MIRROR } from '../reflection/definitions.ts';
import { TANK } from '../refraction/definitions.ts';
export function lightOrbitForScene(scene: SceneDocument, kind: 'reflection' | 'refraction') {
  const sources = scene.equipment.filter(i => i.type === EMITTER), surfaces = scene.equipment.filter(i => i.type === (kind === 'reflection' ? MIRROR : TANK));
  if (sources.length !== 1 || surfaces.length !== 1 || scene.connections.length) return null;
  const emitter = sources[0]!, surface = surfaces[0]!, s = emitter.pose, p = surface.pose, dx = Math.cos(s.rotationRad), dy = Math.sin(s.rotationRad), maximum = Number(emitter.parameters.rangeM);
  if (s.flippedX || p.flippedX || ![s.xM, s.yM, s.rotationRad, p.xM, p.yM, p.rotationRad, maximum].every(Number.isFinite) || maximum <= 0) return null;
  if (kind === 'reflection') {
    const a = p.rotationRad, front = -(s.xM - p.xM) * Math.sin(a) + (s.yM - p.yM) * Math.cos(a), denominator = -dx * Math.sin(a) + dy * Math.cos(a), length = Number(surface.parameters.lengthM);
    if (front <= 1e-8 || denominator >= -1e-10 || !Number.isFinite(length) || length <= 0) return null;
    const distance = -front / denominator, center = { xM: s.xM + distance * dx, yM: s.yM + distance * dy };
    if (distance <= 1e-8 || distance >= maximum || Math.abs((center.xM - p.xM) * Math.cos(a) + (center.yM - p.yM) * Math.sin(a)) > length / 2 + 1e-10) return null;
    return createLightOrbit(emitter.id, s, center, a, true);
  }
  const water = s.yM < p.yM, width = Number(surface.parameters.widthM), depth = Number(surface.parameters.depthM);
  if (Math.abs(p.rotationRad) > 1e-8 || Math.abs(s.yM - p.yM) <= 1e-7 || Math.abs(dy) <= 1e-10 || (water ? dy <= 0 : dy >= 0) || ![width, depth].every(Number.isFinite) || width <= 0 || depth <= 0) return null;
  const distance = (p.yM - s.yM) / dy, center = { xM: s.xM + distance * dx, yM: p.yM }, bounds = { left: p.xM - width / 2 + 1e-6, right: p.xM + width / 2 - 1e-6, bottom: p.yM - depth + 1e-6, top: p.yM - 1e-6 };
  if (distance <= 1e-7 || distance >= maximum || Math.abs(center.xM - p.xM) >= width / 2 - 1e-7 || water && (s.xM < bounds.left || s.xM > bounds.right || s.yM < bounds.bottom)) return null;
  return createLightOrbit(emitter.id, s, center, 0, !water, water ? bounds : undefined);
}
