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

type ResolvedAnimationMap = {
  clips: PlayerAnimationMap;
  sourceStates: Partial<Record<PlayerAnimationState, PlayerAnimationState>>;
};

const aliases: Record<PlayerAnimationState, string[]> = {
  attack: ['attack', 'atack', 'ataque', 'punch', 'strike', 'hit'],
  run: ['run', 'running', 'corrida', 'correr'],
  jump: ['jump', 'jumping', 'pulo', 'saltar'],
  fall: ['fall', 'falling', 'queda'],
  dead: ['dead', 'death', 'dying', 'morte', 'die'],
  idle: ['idle', 'stand', 'standing', 'parado'],
  walk: ['walk', 'walking', 'caminhar', 'andar'],
  crouch: ['crouch', 'duck', 'agachar'],
  defend: ['defend', 'block', 'guard', 'defesa'],
  hurt: ['hurt', 'damage', 'hitreact', 'hit react', 'dano'],
};

export function normalizeAnimationClipName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolvePlayerAnimationClips(clips: readonly AnimationClip[]): ResolvedAnimationMap {
  const normalized = clips.map((clip) => ({ clip, name: normalizeAnimationClipName(clip.name) }));
  const result: PlayerAnimationMap = {};
  const sourceStates: Partial<Record<PlayerAnimationState, PlayerAnimationState>> = {};

  for (const state of Object.keys(aliases) as PlayerAnimationState[]) {
    const match = normalized.find(({ name }) => aliases[state].some((alias) => name === alias || name.includes(alias)));
    if (match) {
      result[state] = match.clip;
      sourceStates[state] = state;
    }
  }

  const reuse = (target: PlayerAnimationState, source: PlayerAnimationState) => {
    if (!result[target] && result[source]) {
      result[target] = result[source];
      sourceStates[target] = sourceStates[source] ?? source;
    }
  };

  reuse('fall', 'jump');
  reuse('walk', 'run');
  reuse('idle', 'walk');
  reuse('idle', 'run');

  return { clips: result, sourceStates };
}

export function mapPlayerAnimationClips(clips: readonly AnimationClip[]): PlayerAnimationMap {
  return resolvePlayerAnimationClips(clips).clips;
}

export class PlayerAnimationController {
  readonly mixer: AnimationMixer;
  readonly clips: PlayerAnimationMap;
  readonly availableClipNames: string[];
  private readonly actions = new Map<AnimationClip, AnimationAction>();
  private readonly sourceStates: Partial<Record<PlayerAnimationState, PlayerAnimationState>>;
  private readonly warnedFallbacks = new Set<PlayerAnimationState>();
  private readonly warnedMissing = new Set<PlayerAnimationState>();
  private currentState: PlayerAnimationState | null = null;
  private currentAction: AnimationAction | null = null;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    const resolved = resolvePlayerAnimationClips(clips);
    this.clips = resolved.clips;
    this.sourceStates = resolved.sourceStates;
    this.availableClipNames = clips.map((clip) => clip.name);
    for (const clip of clips) this.actions.set(clip, this.mixer.clipAction(clip));
    console.info('[player-animation] clips disponíveis', clips.map((clip) => ({ original: clip.name, normalized: normalizeAnimationClipName(clip.name) })));
  }

  transitionTo(state: PlayerAnimationState, options: { fade?: number; logicalAttackDuration?: number } = {}): void {
    if (state === this.currentState) return;
    const clip = this.clips[state];
    if (!clip) {
      if (!this.warnedMissing.has(state)) {
        console.warn(`[player-animation] clip "${state}" ausente; mantendo pose atual`);
        this.warnedMissing.add(state);
      }
      this.currentState = state;
      return;
    }

    const sourceState = this.sourceStates[state];
    if (sourceState && sourceState !== state && !this.warnedFallbacks.has(state)) {
      console.warn(`[player-animation] clip "${state}" ausente; usando "${sourceState}"`);
      this.warnedFallbacks.add(state);
    }

    const fade = options.fade ?? 0.12;
    const next = this.actions.get(clip);
    if (!next) return;

    if (this.currentAction !== next) this.currentAction?.fadeOut(fade);
    next.enabled = true;
    next.reset();
    next.setEffectiveWeight(1);

    const attackScale = state === 'attack' && options.logicalAttackDuration && options.logicalAttackDuration > 0
      ? clip.duration / options.logicalAttackDuration
      : 1;
    const idleFallbackScale = state === 'idle' && sourceState !== 'idle' ? 0 : 1;
    next.setEffectiveTimeScale(attackScale * idleFallbackScale);

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
    if (Number.isFinite(delta) && delta > 0) this.mixer.update(Math.min(delta, 0.1));
  }

  getDeathClipDuration(): number | null {
    return this.clips.dead?.duration ?? null;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.actions.clear();
    this.warnedFallbacks.clear();
    this.warnedMissing.clear();
    this.currentAction = null;
    this.currentState = null;
  }
}