import { describe, expect, it } from 'vitest';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import { calculatePlayerRendererPixelRatio } from './PlayerRenderQuality';

describe('calculatePlayerRendererPixelRatio', () => {
  it('respeita o devicePixelRatio em telas pequenas', () => {
    expect(calculatePlayerRendererPixelRatio(800, 600, 1.25)).toBeCloseTo(1.25);
  });

  it('limita o custo do canvas WebGL em telas grandes', () => {
    const ratio = calculatePlayerRendererPixelRatio(3840, 2160, 2);
    expect(ratio).toBeGreaterThanOrEqual(RUNTIME_CONFIG.playerRendererMinPixelRatio);
    expect(ratio).toBeLessThan(1);
  });

  it('nunca ultrapassa o limite máximo configurado', () => {
    expect(calculatePlayerRendererPixelRatio(320, 240, 4)).toBe(RUNTIME_CONFIG.playerRendererMaxPixelRatio);
  });

  it('tolera dimensões e DPR inválidos', () => {
    expect(Number.isFinite(calculatePlayerRendererPixelRatio(Number.NaN, 0, Number.NaN))).toBe(true);
  });
});
