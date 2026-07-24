import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type Object3D,
} from 'three';
import type { PlayerAnimationAssignments } from '../types/project';
import type { RuntimePlayerVisualState } from './RuntimePlayer';

export type PlayerAnimationState = RuntimePlayerVisualState;
export type PlayerAnimationMap = Partial<Record<PlayerAnimationState, AnimationClip>>;
export type PlayerAnimationTransitionOptions = {
  fade?: number;
  logicalAttackDuration?: number;
  logicalDeathDuration?: number;
};

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
  defend: ['defend', 'block', 'guard', 'defesa', 'escudo'],
  hurt: ['hurt', 'damage', 'hitreact', 'hit react', 'dano'],
};

const exactOnlyAliases = new Set(['hit']);
const locomotionStates = new Set<PlayerAnimationState>(['walk', 'run']);
const MAX_ANIMATION_DELTA = 0.25;

export function normalizeAnimationClipName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function aliasMatches(normalizedName: string, alias: string): boolean {
  if (normalizedName === alias) return true;
  if (exactOnlyAliases.has(alias)) return false;
  const words = normalizedName.split(' ');
  if (!alias.includes(' ')) return words.includes(alias);
  return ` ${normalizedName} `.includes(` ${alias} `);
}

function findClipForState(
  normalized: Array<{ clip: AnimationClip; name: string }>,
  state: PlayerAnimationState,
): AnimationClip | undefined {
  const stateAliases = aliases[state];
  const exact = normalized.find(({ name }) => stateAliases.includes(name));
  if (exact) return exact.clip;

  const orderedAliases = [...stateAliases].sort((a, b) => b.length - a.length);
  return normalized.find(({ name }) => orderedAliases.some((alias) => aliasMatches(name, alias)))?.clip;
}

function resolvePlayerAnimationClips(
  clips: readonly AnimationClip[],
  assignments: PlayerAnimationAssignments = {},
): ResolvedAnimationMap {
  const normalized = clips.map((clip) => ({ clip, name: normalizeAnimationClipName(clip.name) }));
  const clipsByExactName = new Map(clips.map((clip) => [clip.name, clip]));
  const result: PlayerAnimationMap = {};
  const sourceStates: Partial<Record<PlayerAnimationState, PlayerAnimationState>> = {};

  for (const state of Object.keys(aliases) as PlayerAnimationState[]) {
    const assignedName = assignments[state];
    const assignedClip = assignedName ? clipsByExactName.get(assignedName) : undefined;
    const match = assignedClip ?? findClipForState(normalized, state);
    if (match) {
      result[state] = match;
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
  reuse('run', 'walk');
  reuse('idle', 'walk');
  reuse('idle', 'run');

  return { clips: result, sourceStates };
}

export function mapPlayerAnimationClips(
  clips: readonly AnimationClip[],
  assignments: PlayerAnimationAssignments = {},
): PlayerAnimationMap {
  return resolvePlayerAnimationClips(clips, assignments).clips;
}

function defaultFadeFor(state: PlayerAnimationState): number {
  if (state === 'dead') return 0.06;
  if (state === 'attack' || state === 'hurt') return 0.08;
  if (state === 'jump' || state === 'fall') return 0.1;
  if (state === 'idle' || state === 'walk' || state === 'run') return 0.16;
  return 0.12;
}

export class PlayerAnimationController {
  readonly mixer: AnimationMixer;
  readonly clips: PlayerAnimationMap;
  readonly availableClipNames: string[];
  private readonly root: Object3D;
  private readonly actions = new Map<AnimationClip, AnimationAction>();
  private readonly sourceStates: Partial<Record<PlayerAnimationState, PlayerAnimationState>>;
  private readonly warnedFallbacks = new Set<PlayerAnimationState>();
  private readonly warnedMissing = new Set<PlayerAnimationState>();
  private currentState: PlayerAnimationState | null = null;
  private currentAction: AnimationAction | null = null;

  constructor(
    root: Object3D,
    clips: readonly AnimationClip[],
    options: { debug?: boolean; assignments?: PlayerAnimationAssignments } = {},
  ) {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    const resolved = resolvePlayerAnimationClips(clips, options.assignments);
    this.clips = resolved.clips;
    this.sourceStates = resolved.sourceStates;
    this.availableClipNames = clips.map((clip) => clip.name);
    for (const clip of clips) this.actions.set(clip, this.mixer.clipAction(clip));
    if (options.debug) {
      console.info('[player-animation] clips disponíveis', clips.map((clip) => ({
        original: clip.name,
        normalized: normalizeAnimationClipName(clip.name),
      })));
    }
  }

  transitionTo(state: PlayerAnimationState, options: PlayerAnimationTransitionOptions = {}): boolean {
    if (state === this.currentState) return true;
    if (this.currentState === 'dead') return false;

    const clip = this.clips[state];
    if (!clip) {
      if (!this.warnedMissing.has(state)) {
        console.warn(`[player-animation] clip "${state}" ausente; mantendo pose atual`);
        this.warnedMissing.add(state);
      }
      this.currentState = state;
      return true;
    }

    const sourceState = this.sourceStates[state];
    if (sourceState && sourceState !== state && !this.warnedFallbacks.has(state)) {
      console.warn(`[player-animation] clip "${state}" ausente; usando "${sourceState}"`);
      this.warnedFallbacks.add(state);
    }

    const next = this.actions.get(clip);
    if (!next) return false;

    const previousState = this.currentState;
    const previous = this.currentAction;
    const fade = Math.max(0, options.fade ?? defaultFadeFor(state));
    const sameAction = previous === next;

    this.configureAction(next, clip, state, sourceState, options);

    if (sameAction) {
      next.enabled = true;
      next.paused = false;
      next.setEffectiveWeight(1);
      if (!next.isRunning()) next.play();
      this.currentState = state;
      this.currentAction = next;
      return true;
    }

    let locomotionPhase: number | null = null;
    if (previous && previousState && locomotionStates.has(previousState) && locomotionStates.has(state)) {
      const previousDuration = previous.getClip().duration;
      if (previousDuration > 0) locomotionPhase = (previous.time % previousDuration) / previousDuration;
    }

    next.reset();
    this.configureAction(next, clip, state, sourceState, options);
    if (locomotionPhase != null && clip.duration > 0) next.time = locomotionPhase * clip.duration;
    next.enabled = true;
    next.paused = false;
    next.setEffectiveWeight(1);
    next.play();

    if (previous) {
      if (fade > 0) previous.crossFadeTo(next, fade, false);
      else previous.stop();
    } else if (fade > 0) {
      next.fadeIn(fade);
    }

    this.currentState = state;
    this.currentAction = next;
    return true;
  }

  resetAfterRespawn(
    state: PlayerAnimationState,
    options: PlayerAnimationTransitionOptions = {},
  ): boolean {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction.reset();
    }
    this.currentState = null;
    this.currentAction = null;
    return this.transitionTo(state, { ...options, fade: options.fade ?? 0.08 });
  }

  update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.mixer.update(Math.min(delta, MAX_ANIMATION_DELTA));
  }

  getCurrentState(): PlayerAnimationState | null {
    return this.currentState;
  }

  getDeathClipDuration(): number | null {
    return this.clips.dead?.duration ?? null;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const [clip, action] of this.actions) {
      action.stop();
      this.mixer.uncacheAction(clip, this.root);
      this.mixer.uncacheClip(clip);
    }
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.warnedFallbacks.clear();
    this.warnedMissing.clear();
    this.currentAction = null;
    this.currentState = null;
  }

  private configureAction(
    action: AnimationAction,
    clip: AnimationClip,
    state: PlayerAnimationState,
    sourceState: PlayerAnimationState | undefined,
    options: PlayerAnimationTransitionOptions,
  ): void {
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);

    const logicalDuration = state === 'attack'
      ? options.logicalAttackDuration
      : state === 'dead'
        ? options.logicalDeathDuration
        : undefined;
    const durationScale = logicalDuration && logicalDuration > 0 ? clip.duration / logicalDuration : 1;
    const idleFallbackScale = state === 'idle' && sourceState !== 'idle' ? 0 : 1;
    action.setEffectiveTimeScale(durationScale * idleFallbackScale);

    if (state === 'dead' || state === 'attack') {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
  }
}
