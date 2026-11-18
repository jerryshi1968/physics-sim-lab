export interface Ray2 { x: number; y: number }
export function refractInterface(direction: Ray2, n1: number, n2: number) {
  const norm = Math.hypot(direction.x, direction.y);
  if (![direction.x, direction.y, n1, n2].every(Number.isFinite) || Math.abs(norm - 1) > 1e-8 || n1 < 1 || n1 > 2 || n2 < 1 || n2 > 2 || Math.abs(direction.y) < 1e-10) throw new RangeError('INVALID_REFRACTION');
  const incidenceRad = Math.atan2(Math.abs(direction.x), Math.abs(direction.y)), tangent = n1 / n2 * direction.x, reflected = { x: direction.x, y: -direction.y };
  if (Math.abs(tangent) > 1 + 1e-12) return { kind: 'total-reflection' as const, incidenceRad, refractionRad: null, transmitted: null, reflected };
  const x = Math.max(-1, Math.min(1, tangent)), y = Math.sign(direction.y) * Math.sqrt(Math.max(0, 1 - x * x));
  return { kind: Math.abs(y) < 1e-10 ? 'critical' as const : 'transmitted' as const, incidenceRad, refractionRad: Math.atan2(Math.abs(x), Math.abs(y)), transmitted: { x, y }, reflected };
}
