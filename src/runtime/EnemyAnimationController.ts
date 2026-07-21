import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type Object3D,
} from 'three';
import type { EnemyAnimationAssignments, EnemyAnimationRole } from '../types/project';
import type { RuntimeEnemyVisualState } from './RuntimeEnemy';
import { normalizeAnimationClipName } from './PlayerAnimationController';

export type EnemyAnimationState = RuntimeEnemyVisualState | 'intro' | 'phase-transition';
export type EnemyAnimationMap = Partial<Record<EnemyAnimationState, AnimationClip>>;

const aliases: Record<EnemyAnimationState, string[]> = {
  idle: ['idle', 'stand', 'standing', 'parado'],
  walk: ['walk', 'walking', 'andar', 'caminhar'],
  run: ['run', 'running', 'correr', 'corrida', 'chase'],
  attack: ['attack', 'ataque', 'strike', 'punch', 'bite'],
  hurt: ['hurt', 'damage', 'hitreact', 'hit react', 'dano'],
  dead: ['dead', 'death', 'die', 'dying', 'morte'],
  intro: ['intro', 'entrance', 'spawn', 'entrada'],
  'phase-transition': ['phase transition', 'phase', 'transform', 'rage', 'transicao'],
};

const exactOnlyAliases = new Set(['hit']);
const looping = new Set<EnemyAnimationState>(['idle', 'walk', 'run']);
const locomotion = new Set<EnemyAnimationState>(['walk', 'run']);
const MAX_ANIMATION_DELTA = 0.25;

function aliasMatches(normalizedName: string, alias: string): boolean {
  if (normalizedName === alias) return true;
  if (exactOnlyAliases.has(alias)) return false;
  const words = normalizedName.split(' ');
  if (!alias.includes(' ')) return words.includes(alias);
  return ` ${normalizedName} `.includes(` ${alias} `);
}

export function mapEnemyAnimationClips(
  clips: readonly AnimationClip[],
  assignments: EnemyAnimationAssignments = {},
): EnemyAnimationMap {
  const byName = new Map(clips.map((clip) => [clip.name, clip]));
  const normalized = clips.map((clip) => ({ clip, name: normalizeAnimationClipName(clip.name) }));
  const result: EnemyAnimationMap = {};

  for (const state of Object.keys(aliases) as EnemyAnimationState[]) {
    const assigned = assignments[state as EnemyAnimationRole];
    const assignedClip = assigned ? byName.get(assigned) : undefined;
    if (assignedClip) {
      result[state] = assignedClip;
      continue;
    }
    const stateAliases = aliases[state];
    result[state] = normalized.find(({ name }) => stateAliases.includes(name))?.clip
      ?? normalized.find(({ name }) => [...stateAliases]
        .sort((a, b) => b.length - a.length)
        .some((alias) => aliasMatches(name, alias)))?.clip;
  }

  if (!result.walk) result.walk = result.run;
  if (!result.run) result.run = result.walk;
  if (!result.idle) result.idle = result.walk ?? result.run;
  return result;
}

function defaultFade(state: EnemyAnimationState): number {
  if (state === 'attack' || state === 'hurt' || state === 'dead') return 0.07;
  if (state === 'phase-transition' || state === 'intro') return 0.1;
  return 0.14;
}

export class EnemyAnimationController {
  readonly mixer: AnimationMixer;
  readonly clips: EnemyAnimationMap;
  readonly availableClipNames: string[];
  private readonly root: Object3D;
  private readonly actions = new Map<AnimationClip, AnimationAction>();
  private currentState: EnemyAnimationState | null = null;
  private currentAction: AnimationAction | null = null;

  constructor(root: Object3D, clips: readonly AnimationClip[], assignments: EnemyAnimationAssignments = {}) {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    this.clips = mapEnemyAnimationClips(clips, assignments);
    this.availableClipNames = clips.map((clip) => clip.name);
    for (const clip of clips) this.actions.set(clip, this.mixer.clipAction(clip));
  }

  transitionTo(state: EnemyAnimationState, fade = defaultFade(state)): boolean {
    if (state === this.currentState) return true;
    if (this.currentState === 'dead') return false;
    const clip = this.clips[state];
    if (!clip) {
      this.currentState = state;
      return true;
    }
    const next = this.actions.get(clip);
    if (!next) return false;
    const previous = this.currentAction;
    const previousState = this.currentState;
    const sameAction = previous === next;

    next.enabled = true;
    next.paused = false;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(state === 'idle' && this.clips.idle !== clip ? 0 : 1);
    next.setLoop(looping.has(state) ? LoopRepeat : LoopOnce, looping.has(state) ? Infinity : 1);
    next.clampWhenFinished = !looping.has(state);

    if (sameAction) {
      if (!next.isRunning()) next.play();
      this.currentState = state;
      return true;
    }

    let phase: number | null = null;
    if (previous && previousState && locomotion.has(previousState) && locomotion.has(state)) {
      const duration = previous.getClip().duration;
      if (duration > 0) phase = (previous.time % duration) / duration;
    }

    next.reset();
    if (phase != null && clip.duration > 0) next.time = phase * clip.duration;
    next.play();
    if (previous) {
      if (fade > 0) previous.crossFadeTo(next, fade, false);
      else previous.stop();
    } else if (fade > 0) next.fadeIn(fade);
    this.currentState = state;
    this.currentAction = next;
    return true;
  }

  update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.mixer.update(Math.min(delta, MAX_ANIMATION_DELTA));
  }

  getCurrentState(): EnemyAnimationState | null { return this.currentState; }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const [clip, action] of this.actions) {
      action.stop();
      this.mixer.uncacheAction(clip, this.root);
      this.mixer.uncacheClip(clip);
    }
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.currentAction = null;
    this.currentState = null;
  }
}
