export const CYLINDER_HEIGHT_M = .2;
export const SPECIMEN_AREA_M2 = .0002;
export function displacedLiquid(waterM3: number, specimenM3: number, bottomM: number, capacityM3: number) {
  const area = capacityM3 / CYLINDER_HEIGHT_M, height = specimenM3 / SPECIMEN_AREA_M2;
  if (![waterM3, specimenM3, bottomM, capacityM3].every(Number.isFinite) || waterM3 < 0 || specimenM3 < 0 || bottomM < 0 || area <= SPECIMEN_AREA_M2) throw new RangeError('DENSITY_GEOMETRY');
  let lo = 0, hi = (waterM3 + specimenM3) / area + height + bottomM;
  for (let i = 0; i < 80; i++) {
    const h = (lo + hi) / 2, submerged = Math.max(0, Math.min(height, h - bottomM)) * SPECIMEN_AREA_M2;
    if (area * h - submerged < waterM3) lo = h; else hi = h;
  }
  const liquidHeightM = (lo + hi) / 2, submergedM3 = Math.max(0, Math.min(height, liquidHeightM - bottomM)) * SPECIMEN_AREA_M2;
  return { liquidHeightM, submergedM3, readingM3: waterM3 + submergedM3, fullyImmersed: specimenM3 > 0 && submergedM3 >= specimenM3 - 1e-12, overflow: waterM3 + submergedM3 > capacityM3 + 1e-12 };
}
