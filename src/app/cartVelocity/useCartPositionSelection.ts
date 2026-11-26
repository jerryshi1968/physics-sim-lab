import { useState } from 'react';
import type { TapeRun } from '../../equipment/ticker/simulate.ts';
import { clearTapePoint, defaultCartPositionZero, positionPointNumbers } from '../../equipment/cartVelocity/positions.ts';

export function useCartPositionSelection(run: TapeRun | null, taken: boolean, signature: string) {
  const key = `${signature}:${run?.id}:${taken}`;
  const defaultZero = defaultCartPositionZero(run);
  const [stored, setStored] = useState({ key: '', zero: 0, stride: 5, last: 6, selected: 0, picking: false, speed: false });
  const q = stored.key === key ? stored : { ...stored, key, zero: defaultZero, last: Math.min(6, Math.max(2, Math.floor(((run?.dots.length ?? 1) - 2 - defaultZero) / 5))), selected: 0, picking: false, speed: false };
  if (q !== stored) setStored(q);
  const set = (v: Partial<typeof q>) => setStored({ ...q, ...v });
  const maxLast = run ? Math.max(0, Math.floor((run.dots.findLastIndex((_, i) => clearTapePoint(run, i)) - q.zero) / q.stride)) : 0;
  return { ...q, maxLast, numbers: positionPointNumbers(run, q.zero, q.stride, q.last),
    choose: (index: number) => { if (!taken || !run || !clearTapePoint(run, index)) return; if (q.picking) set({ zero: index, selected: 0, speed: false, picking: false, last: Math.min(q.last, Math.max(2, Math.floor((run.dots.length - 2 - index) / q.stride))) }); else if ((index - q.zero) % q.stride === 0) set({ selected: (index - q.zero) / q.stride, speed: false }); },
    setZero: (zero: number) => set({ zero, selected: 0, speed: false, last: Math.min(q.last, Math.max(2, Math.floor(((run?.dots.length ?? 1) - 2 - zero) / q.stride))) }),
    setStride: (stride: number) => set({ stride, selected: 0, speed: false, last: Math.min(q.last, Math.max(2, Math.floor(((run?.dots.length ?? 1) - 2 - q.zero) / stride))) }),
    setLast: (last: number) => set({ last, selected: Math.min(q.selected, last), speed: false }),
    select: (selected: number, speed = false) => set({ selected, speed, picking: false }),
    pickZero: () => set({ picking: !q.picking, speed: false }),
  };
}
export type CartPositionSelection = ReturnType<typeof useCartPositionSelection>;
