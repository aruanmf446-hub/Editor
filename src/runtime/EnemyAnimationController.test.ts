import { AnimationClip, LoopOnce, LoopRepeat, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { EnemyAnimationController, mapEnemyAnimationClips } from './EnemyAnimationController';

const clip = (name: string, duration = 1) => new AnimationClip(name, duration, []);

describe('EnemyAnimationController', () => {
  it('associa clips automáticos de cacto e boss', () => {
    const clips = [clip('Walking'), clip('Running'), clip('Attack'), clip('Hit React'), clip('Death'), clip('Rage Transform')];
    const mapped = mapEnemyAnimationClips(clips);
    expect(mapped.walk).toBe(clips[0]);
    expect(mapped.run).toBe(clips[1]);
    expect(mapped.attack).toBe(clips[2]);
    expect(mapped.hurt).toBe(clips[3]);
    expect(mapped.dead).toBe(clips[4]);
    expect(mapped['phase-transition']).toBe(clips[5]);
  });

  it('prioriza a associação manual independentemente da ordem', () => {
    const clips = [clip('Take 001'), clip('Action 02'), clip('Animation 7')];
    const mapped = mapEnemyAnimationClips(clips, { walk: 'Animation 7', attack: 'Take 001', dead: 'Action 02' });
    expect(mapped.walk).toBe(clips[2]);
    expect(mapped.attack).toBe(clips[0]);
    expect(mapped.dead).toBe(clips[1]);
  });

  it('usa loop em locomoção e uma execução em ataque e morte', () => {
    const walk = clip('walk');
    const attack = clip('attack');
    const dead = clip('dead');
    const controller = new EnemyAnimationController(new Object3D(), [walk, attack, dead]);
    controller.transitionTo('walk', 0);
    expect(controller.mixer.clipAction(walk).loop).toBe(LoopRepeat);
    controller.transitionTo('attack', 0);
    expect(controller.mixer.clipAction(attack).loop).toBe(LoopOnce);
    controller.transitionTo('dead', 0);
    expect(controller.mixer.clipAction(dead).loop).toBe(LoopOnce);
    expect(controller.transitionTo('walk', 0)).toBe(false);
    controller.dispose();
  });

  it('preserva a fase ao trocar caminhada por corrida', () => {
    const walk = clip('walk', 2);
    const run = clip('run', 1);
    const controller = new EnemyAnimationController(new Object3D(), [walk, run]);
    controller.transitionTo('walk', 0);
    controller.update(0.5);
    controller.transitionTo('run', 0);
    expect(controller.mixer.clipAction(run).time).toBeCloseTo(0.25);
    controller.dispose();
  });
});
