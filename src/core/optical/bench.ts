import { solveThinLens } from '../../physics/samples/optical.ts';

interface Positioned { id: string; xM: number; yM: number }
export interface OpticalSetup {
  bench: Positioned & { lengthM: number };
  candle: Positioned & { heightM: number };
  lens: Positioned & { focalLengthM: number; apertureRadiusM: number };
  screen: Positioned & { widthM: number; heightM: number };
}
export interface OpticalRay { objectYM: number; apertureYM: number; slope: number; screenYM: number; zM: number; visible: boolean }
export type OpticalOutcome = { ok: false; code: string } | {
  ok: true; setup: OpticalSetup; image: Extract<ReturnType<typeof solveThinLens>, { status: 'ok' }>['value'];
  objectDistanceM: number; screenDistanceM: number; aligned: boolean; spotRadiusM: number; sharpness: number;
  capturedFraction: number; rays: OpticalRay[]; imageInBench: boolean;
  screenStatus: 'wrong-side' | 'missed' | 'diffuse' | 'defocused' | 'sharp';
};

export function solveOpticalBench(setup: OpticalSetup): OpticalOutcome {
  const { bench, candle, lens, screen } = setup;
  if (![bench.xM, bench.yM, bench.lengthM, candle.xM, candle.yM, candle.heightM, lens.xM, lens.yM, lens.focalLengthM, lens.apertureRadiusM, screen.xM, screen.yM, screen.widthM, screen.heightM].every(Number.isFinite)) return { ok: false, code: 'OPTICAL_NON_FINITE' };
  if (bench.lengthM < .2 || bench.lengthM > 2 || candle.heightM < .002 || candle.heightM > .04 || lens.focalLengthM < .02 || lens.focalLengthM > .5
    || lens.apertureRadiusM < .002 || lens.apertureRadiusM > .04 || screen.widthM < .02 || screen.widthM > .2 || screen.heightM < .02 || screen.heightM > .2) return { ok: false, code: 'OPTICAL_PARAMETERS' };
  if (Math.abs(bench.xM) > 1000 || Math.abs(bench.yM) > 1000 || [candle, lens, screen].some(item => item.xM < bench.xM || item.xM > bench.xM + bench.lengthM || item.yM < bench.yM + .01 || item.yM > bench.yM + .3)) return { ok: false, code: 'OPTICAL_BENCH_RANGE' };
  const rawU = lens.xM - candle.xM;
  if (rawU <= 1e-12) return { ok: false, code: 'OPTICAL_OBJECT_SIDE' };
  const u = Math.abs(rawU - lens.focalLengthM) <= 8 * Number.EPSILON * Math.max(1, Math.abs(lens.xM), Math.abs(candle.xM)) ? lens.focalLengthM : rawU;
  const solved = solveThinLens(lens.focalLengthM, u);
  if (solved.status !== 'ok') return { ok: false, code: 'OPTICAL_NUMERIC_RANGE' };
  const s = screen.xM - lens.xM, radius = lens.apertureRadiusM, rays: OpticalRay[] = [];
  for (let row = 0; row < 9; row++) {
    const t = row / 8, yObject = candle.yM + (t - .5) * candle.heightM;
    const width = candle.heightM * .2 * Math.sin(Math.PI * t) * (.35 + .65 * (1 - t));
    for (const column of [-1, -.5, 0, .5, 1]) {
      const zObject = column * width;
      for (let pupil = 0; pupil < 9; pupil++) {
        const yHit = lens.yM + (pupil === 0 ? 0 : radius * Math.cos((pupil - 1) * Math.PI / 4));
        const zHit = pupil === 0 ? 0 : radius * Math.sin((pupil - 1) * Math.PI / 4);
        const incoming = (yHit - yObject) / u, slope = incoming - (yHit - lens.yM) / lens.focalLengthM;
        const incomingZ = (zHit - zObject) / u, slopeZ = incomingZ - zHit / lens.focalLengthM;
        if (Math.hypot(incoming, incomingZ) > .35 || Math.hypot(slope, slopeZ) > .35) return { ok: false, code: 'OPTICAL_NON_PARAXIAL' };
        const y = yHit + s * slope, z = zHit + s * slopeZ;
        rays.push({ objectYM: yObject, apertureYM: yHit, slope, screenYM: y, zM: z,
          visible: s > 0 && Math.abs(y - screen.yM) <= screen.heightM / 2 && Math.abs(z) <= screen.widthM / 2 });
      }
    }
  }
  const spotRadiusM = Math.abs(1 + s / u - s / lens.focalLengthM) * radius;
  const sharpness = 1 / (1 + (spotRadiusM / .0005) ** 2);
  const capturedFraction = rays.filter(ray => ray.visible).length / rays.length;
  const image = solved.value;
  const imageInBench = image.kind !== 'no-finite-image' && lens.xM + image.imageDistanceM >= bench.xM && lens.xM + image.imageDistanceM <= bench.xM + bench.lengthM;
  return { ok: true, setup, image, objectDistanceM: u, screenDistanceM: s,
    aligned: Math.max(Math.abs(candle.yM - lens.yM), Math.abs(screen.yM - lens.yM)) <= .002, spotRadiusM, sharpness, capturedFraction, rays, imageInBench,
    screenStatus: s <= 0 ? 'wrong-side' : capturedFraction === 0 ? 'missed' : image.kind !== 'real' ? 'diffuse' : sharpness >= .8 ? 'sharp' : 'defocused' };
}
