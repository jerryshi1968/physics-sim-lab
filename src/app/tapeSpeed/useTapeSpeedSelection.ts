import { useState } from 'react';
import type { TickerSimulation } from '../ticker/useTicker.ts';
import type { TapeSpeedMode } from '../../equipment/tapeSpeed/model.ts';

export function useTapeSpeedSelection(ticker: TickerSimulation) {
  const key = `${ticker.signature}:${ticker.run?.id ?? ''}`;
  const [stored, setStored] = useState({ key, mode: 'average' as TapeSpeedMode, zero: 0, stride: 5, at: -1 });
  const state = stored.key === key ? stored : { key, mode: 'average' as TapeSpeedMode, zero: 0, stride: 5, at: -1 };
  if (state !== stored) setStored(state);
  const a = ticker.origin, b = ticker.target;
  const at = state.at > a && state.at < b ? state.at : Math.floor((a + b) / 2);
  const pointCount = ticker.run?.dots.length ?? 0;
  function group(mode: TapeSpeedMode, zero: number, stride: number, segment = 0) {
    const start = zero + segment * stride, end = start + stride;
    setStored({ key, mode, zero, stride, at: Math.floor((start + end) / 2) });
    if (start >= 0 && end < pointCount) { ticker.setPoint('origin', start); ticker.setPoint('target', end); }
  }
  function window(half: number) {
    if (half < 1 || at - half < state.zero || at + half >= pointCount) return;
    setStored({ ...state, at }); ticker.setPoint('origin', at - half); ticker.setPoint('target', at + half);
  }
  return { ...state, at, a, b, pointCount,
    setMode: (mode: TapeSpeedMode) => group(mode, state.zero, mode === 'average' ? 5 : 3),
    setZero: (zero: number) => group(state.mode, zero, state.stride),
    setStride: (stride: number) => group(state.mode, state.zero, stride),
    setSegment: (segment: number) => group(state.mode, state.zero, state.stride, segment),
    setAt: (target: number) => setStored({ ...state, at: target }),
    shrink: () => window(Math.max(1, Math.floor((b - a) / 2) - 1)),
    expand: () => window(Math.floor((b - a) / 2) + 1),
  };
}
export type TapeSpeedSelection = ReturnType<typeof useTapeSpeedSelection>;
