import { AnimationClip, LoopOnce, LoopRepeat, Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  PlayerAnimationController,
  mapPlayerAnimationClips,
  normalizeAnimationClipName,
} from './PlayerAnimationController';

const clip = (name: string, duration = 1) => new AnimationClip(name, duration, []);

describe('PlayerAnimationController', () => {
  it('normaliza e associa nomes reais dos clips', () => {
    const clips = [clip('Ataque Forte'), clip('Running_01'), clip('PÚLO'), clip('Death')];
    const mapped = mapPlayerAnimationClips(clips);

    expect(normalizeAnimationClipName('PÚLO-Rápido')).toBe('pulo rapido');
    expect(mapped.attack).toBe(clips[0]);
    expect(mapped.run).toBe(clips[1]);
    expect(mapped.jump).toBe(clips[2]);
    expect(mapped.fall).toBe(clips[2]);
    expect(mapped.dead).toBe(clips[3]);
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

  it('usa loop para corrida e LoopOnce para morte', () => {
    const root = new Object3D();
    const run = clip('run');
    const dead = clip('death');
    const controller = new PlayerAnimationController(root, [run, dead]);

    controller.transitionTo('run', { fade: 0 });
    expect(controller.mixer.clipAction(run).loop).toBe(LoopRepeat);

    controller.transitionTo('dead', { fade: 0 });
    const deathAction = controller.mixer.clipAction(dead);
    expect(deathAction.loop).toBe(LoopOnce);
    expect(deathAction.clampWhenFinished).toBe(true);
    controller.dispose();
  });

  it('informa fallback de fall e congela corrida reutilizada no idle', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root = new Object3D();
    const jump = clip('jump');
    const run = clip('run');
    const controller = new PlayerAnimationController(root, [jump, run]);

    controller.transitionTo('fall', { fade: 0 });
    expect(warning).toHaveBeenCalledWith('[player-animation] clip "fall" ausente; usando "jump"');

    controller.transitionTo('idle', { fade: 0 });
    expect(controller.mixer.clipAction(run).timeScale).toBe(0);
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
});
