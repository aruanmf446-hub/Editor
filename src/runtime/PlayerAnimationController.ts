import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type Object3D,
} from 'three';
import type { RuntimePlayerVisualState } from './RuntimePlayer';

export type PlayerAnimationState = RuntimePlayerVisualState;
export type PlayerAnimationMap = Partial<Record<PlayerAnimationState, AnimationClip>>;

const aliases: Record<PlayerAnimationState, string[]> = {
  attack: ['attack', 'atack', 'ataque', 'punch', 'strike', 'hit'],
  run: ['run', 'running', 'corrida', 'correr'],
  jump: ['jump', 'jumping', 'pulo', 'saltar'],
  fall: ['fall', 'falling', 'queda'],
  dead: ['dead', 'death', 'dying', 'morte', 'die'],
  idle: ['idle', 'stand', 'parado'],
  walk: ['walk', 'walking', 'caminhar', 'andar'],
  crouch: ['crouch', 'duck', 'agachar'],
  defend: ['defend', 'block', 'guard', 'defesa'],
  hurt: ['hurt', 'damage', 'hitreact', 'dano'],
};

export function normalizeAnimationClipName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mapPlayerAnimationClips(clips: readonly AnimationClip[]): PlayerAnimationMap {
  const normalized = clips.map((clip) => ({ clip, name: normalizeAnimationClipName(clip.name) }));
  const result: PlayerAnimationMap = {};
  for (const state of Object.keys(aliases) as PlayerAnimationState[]) {
    const match = normalized.find(({ name }) => aliases[state].some((alias) => name === alias || name.includes(alias)));
    if (match) result[state] = match.clip;
  }

  // Controlled temporary reuse only where the GLB lacks a dedicated clip.
  result.fall ??= result.jump;
  result.walk ??= result.run;
  result.idle ??= result.walk ?? result.run;
  return result;
}

export class PlayerAnimationController {
  readonly mixer: AnimationMixer;
  readonly clips: PlayerAnimationMap;
  readonly availableClipNames: string[];
  private readonly actions = new Map<AnimationClip, AnimationAction>();
  private currentState: PlayerAnimationState | null = null;
  private currentAction: AnimationAction | null = null;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    this.clips = mapPlayerAnimationClips(clips);
    this.availableClipNames = clips.map((clip) => clip.name);
    for (const clip of clips) this.actions.set(clip, this.mixer.clipAction(clip));
    console.info('[player-animation] clips disponíveis', this.availableClipNames.map(normalizeAnimationClipName));
  }

  transitionTo(state: PlayerAnimationState, options: { fade?: number; logicalAttackDuration?: number } = {}): void {
    if (state === this.currentState) return;
    const clip = this.clips[state];
    if (!clip) {
      this.currentState = state;
      return;
    }

    const fade = options.fade ?? 0.12;
    const next = this.actions.get(clip);
    if (!next) return;

    this.currentAction?.fadeOut(fade);
    next.enabled = true;
    next.reset();
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(
      state === 'attack' && options.logicalAttackDuration && options.logicalAttackDuration > 0
        ? clip.duration / options.logicalAttackDuration
        : 1,
    );
    if (state === 'dead' || state === 'attack') {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.fadeIn(fade).play();
    this.currentState = state;
    this.currentAction = next;
  }

  update(delta: number): void {
    if (Number.isFinite(delta) && delta > 0) this.mixer.update(delta);
  }

  getDeathClipDuration(): number | null {
    return this.clips.dead?.duration ?? null;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.actions.clear();
    this.currentAction = null;
    this.currentState = null;
  }
}
