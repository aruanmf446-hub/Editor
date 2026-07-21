import { AnimationClip, LoopOnce, LoopRepeat, Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  PlayerAnimationController,
  mapPlayerAnimationClips,
  normalizeAnimationClipName,
} from './PlayerAnimationController';

const clip = (name: string, duration = 1) => new AnimationClip(name, duration, []);

describe('PlayerAnimationController', () => {
  it('normaliza e associa nomes reais dos clips sem confundir hit react com ataque', () => {
    const clips = [clip('Ataque Forte'), clip('Running_01'), clip('PÚLO'), clip('Death'), clip('Hit React')];
    const mapped = mapPlayerAnimationClips(clips);

    expect(normalizeAnimationClipName('PÚLO-Rápido')).toBe('pulo rapido');
    expect(mapped.attack).toBe(clips[0]);
    expect(mapped.run).toBe(clips[1]);
    expect(mapped.jump).toBe(clips[2]);
    expect(mapped.fall).toBe(clips[2]);
    expect(mapped.dead).toBe(clips[3]);
    expect(mapped.hurt).toBe(clips[4]);
  });

  it('aceita hit exato como alias de ataque', () => {
    const hit = clip('hit');
    expect(mapPlayerAnimationClips([hit]).attack).toBe(hit);
  });

  it('mantém o mesmo mixer e não reinicia ataque no mesmo estado', () => {
    const root = new Object3D();
    const attack = clip('attack', 0.8);
    const controller = new PlayerAnimationController(root, [attack]);
    const mixer = controller.mixer;

    controller.transitionTo('attack', { logicalAttackDuration: 0.4, fade: 0 });
    const action = mixer.clipAction(attack);
    expect(action.loop).toBe(LoopOnce);
    expect(action.timeScale).toBeCloseTo(2);

    controller.update(0.1);
    const timeAfterUpdate = action.time;
    controller.transitionTo('attack', { logicalAttackDuration: 0.4, fade: 0 });

    expect(controller.mixer).toBe(mixer);
    expect(action.time).toBe(timeAfterUpdate);
    controller.dispose();
  });

  it('usa loop para corrida e LoopOnce sincronizado para morte', () => {
    const root = new Object3D();
    const run = clip('run');
    const dead = clip('death', 1.6);
    const controller = new PlayerAnimationController(root, [run, dead]);

    controller.transitionTo('run', { fade: 0 });
    expect(controller.mixer.clipAction(run).loop).toBe(LoopRepeat);

    controller.transitionTo('dead', { fade: 0, logicalDeathDuration: 0.8 });
    const deathAction = controller.mixer.clipAction(dead);
    expect(deathAction.loop).toBe(LoopOnce);
    expect(deathAction.clampWhenFinished).toBe(true);
    expect(deathAction.timeScale).toBeCloseTo(2);
    controller.dispose();
  });

  it('não permite que morte seja interrompida por estados comuns', () => {
    const root = new Object3D();
    const run = clip('run');
    const jump = clip('jump');
    const dead = clip('death');
    const controller = new PlayerAnimationController(root, [run, jump, dead]);

    controller.transitionTo('dead', { fade: 0 });
    controller.update(0.2);
    const deathAction = controller.mixer.clipAction(dead);
    const deathTime = deathAction.time;

    expect(controller.transitionTo('run', { fade: 0 })).toBe(false);
    expect(controller.transitionTo('jump', { fade: 0 })).toBe(false);
    expect(controller.getCurrentState()).toBe('dead');
    expect(deathAction.time).toBe(deathTime);

    expect(controller.resetAfterRespawn('run', { fade: 0 })).toBe(true);
    expect(controller.getCurrentState()).toBe('run');
    expect(controller.mixer.clipAction(run).loop).toBe(LoopRepeat);
    controller.dispose();
  });

  it('congela a pose atual no fallback de idle sem reiniciar a passada', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root = new Object3D();
    const run = clip('run');
    const controller = new PlayerAnimationController(root, [run]);

    controller.transitionTo('run', { fade: 0 });
    controller.update(0.25);
    const action = controller.mixer.clipAction(run);
    const gaitTime = action.time;

    controller.transitionTo('idle', { fade: 0 });
    expect(action.time).toBe(gaitTime);
    expect(action.timeScale).toBe(0);

    controller.transitionTo('run', { fade: 0 });
    expect(action.time).toBe(gaitTime);
    expect(action.timeScale).toBe(1);
    controller.dispose();
    warning.mockRestore();
  });

  it('preserva a fase do passo ao alternar entre caminhada e corrida', () => {
    const root = new Object3D();
    const walk = clip('walk', 2);
    const run = clip('run', 1);
    const controller = new PlayerAnimationController(root, [walk, run]);

    controller.transitionTo('walk', { fade: 0 });
    controller.update(0.5);
    const walkAction = controller.mixer.clipAction(walk);
    const gaitPhase = walkAction.time / walk.duration;
    controller.transitionTo('run', { fade: 0 });

    expect(controller.mixer.clipAction(run).time).toBeCloseTo(gaitPhase * run.duration);
    controller.dispose();
  });

  it('informa fallback de fall', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root = new Object3D();
    const jump = clip('jump');
    const controller = new PlayerAnimationController(root, [jump]);

    controller.transitionTo('fall', { fade: 0 });
    expect(warning).toHaveBeenCalledWith('[player-animation] clip "fall" ausente; usando "jump"');
    controller.dispose();
    warning.mockRestore();
  });

  it('não trava quando o GLB não contém clips', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const controller = new PlayerAnimationController(new Object3D(), []);

    expect(() => controller.transitionTo('idle')).not.toThrow();
    expect(() => controller.update(0.016)).not.toThrow();
    controller.dispose();
    warning.mockRestore();
  });

  it('suporta dezenas de ciclos de morte e respawn sem recriar o mixer', () => {
    const root = new Object3D();
    const idle = clip('idle');
    const dead = clip('death');
    const controller = new PlayerAnimationController(root, [idle, dead]);
    const mixer = controller.mixer;

    for (let index = 0; index < 50; index += 1) {
      controller.transitionTo('dead', { fade: 0, logicalDeathDuration: 0.8 });
      controller.update(0.8);
      controller.resetAfterRespawn('idle', { fade: 0 });
      controller.update(0.016);
    }

    expect(controller.mixer).toBe(mixer);
    expect(controller.getCurrentState()).toBe('idle');
    controller.dispose();
  });
});
