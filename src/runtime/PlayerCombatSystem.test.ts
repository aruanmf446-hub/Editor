import { describe, expect, it } from 'vitest';
import {
  EL_FUEGO_PROJECT_FORMAT,
  EL_FUEGO_PROJECT_VERSION,
  type ElFuegoProject,
  type ProjectScene,
  type SceneObjectBase,
} from '../types/project';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { receivePlayerDamage, updatePlayerCombat } from './systems/PlayerCombatSystem';

const spawn = (): SceneObjectBase => ({
  id: 'spawn', sceneId: 'scene', type: 'player-spawn', name: 'Player',
  transform: { x: 100, y: 100, z: 0, width: 50, height: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true, locked: false, editorOnly: false, gameOnly: false,
  initialHealth: 3, initialAttack: 2, initialDefense: 1, direction: 'right',
});

function world(objects: SceneObjectBase[] = []): RuntimeWorld {
  const playerSpawn = spawn();
  const scene: ProjectScene = { id: 'scene', name: 'Cena', order: 0, width: 1000, height: 600, backgroundAssetId: null, background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 }, objects: [playerSpawn, ...objects] };
  const project: ElFuegoProject = {
    format: EL_FUEGO_PROJECT_FORMAT,
    version: EL_FUEGO_PROJECT_VERSION,
    project: { id: 'p', name: 'P', createdAt: '', updatedAt: '' },
    scenes: [scene],
    assets: [],
    settings: {
      gravity: RUNTIME_CONFIG.gravity,
      gridSize: 16,
      snapEnabled: true,
      defaultSceneWidth: 1000,
      defaultSceneHeight: 600,
    },
  };
  return { project, scene, player: createRuntimePlayer(playerSpawn), platforms: createRuntimePlatforms(scene), camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 }, input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false, attackPressed: false }, paused: false, completed: false, physicsSteps: 0, accumulator: 0, droppedPhysicsTime: 0, respawnFailure: false };
}

describe('player combat phase 3', () => {
  it('abre e fecha a hitbox somente na janela ativa do ataque', () => {
    const state = world(); state.player.grounded = true; state.input.attackPressed = true;
    updatePlayerCombat(state, .01); expect(state.player.mode).toBe('attack'); expect(state.player.attackHitbox).toBeNull();
    state.input.attackPressed = false; updatePlayerCombat(state, RUNTIME_CONFIG.attackActiveStart);
    expect(state.player.attackHitbox).not.toBeNull();
    updatePlayerCombat(state, RUNTIME_CONFIG.attackDuration); expect(state.player.attackHitbox).toBeNull();
  });

  it('defesa bloqueia dano sem reduzir vida', () => {
    const state = world(); state.player.grounded = true; state.input.defend = true; updatePlayerCombat(state, .01);
    expect(receivePlayerDamage(state, 3, 200)).toBe('blocked'); expect(state.player.health).toBe(3);
  });

  it('dano aplica invulnerabilidade e knockback', () => {
    const state = world();
    expect(receivePlayerDamage(state, 2, 200)).toBe('damaged');
    expect(state.player.health).toBe(2); expect(state.player.mode).toBe('hurt');
    expect(state.player.invulnerabilityRemaining).toBeGreaterThan(0); expect(state.player.velocityX).toBeLessThan(0);
    expect(receivePlayerDamage(state, 2, 200)).toBe('ignored');
  });

  it('morte espera, respawna com vida cheia e invulnerabilidade', () => {
    const state = world(); state.player.health = 1;
    expect(receivePlayerDamage(state, 5, 200)).toBe('killed'); expect(state.player.mode).toBe('dead');
    updatePlayerCombat(state, RUNTIME_CONFIG.deathDuration);
    expect(state.player.health).toBe(state.player.maxHealth); expect(state.player.mode).toBe('fall');
    expect(state.player.invulnerabilityRemaining).toBe(RUNTIME_CONFIG.respawnInvulnerability);
  });
});