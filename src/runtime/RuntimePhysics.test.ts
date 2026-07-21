import { describe, expect, it } from 'vitest';
import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { applyGravity } from './systems/GravitySystem';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';
import { createRuntimePlatforms, createRuntimePlayer, type RuntimeWorld } from './RuntimeWorld';

const object = (type: SceneObjectBase['type'], x: number, y: number, width: number, height: number, patch: Partial<SceneObjectBase> = {}): SceneObjectBase => ({
  id: crypto.randomUUID(), sceneId: 'scene', type, name: type, transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 }, visible: true, locked: false, editorOnly: false, gameOnly: false, ...patch,
});
const scene: ProjectScene = { id: 'scene', name: 'Cena', order: 0, width: 1000, height: 600, backgroundAssetId: null, background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 }, objects: [] };
const project = { project: { id: 'p', name: 'P', createdAt: '', updatedAt: '' }, version: 1, scenes: [scene], assets: [], settings: { gridSize: 16, snapEnabled: true } } as ElFuegoProject;

function world(objects: SceneObjectBase[] = []): RuntimeWorld {
  const spawn = object('player-spawn', 100, 100, 50, 100, { initialHealth: 3, initialAttack: 1, initialDefense: 1, direction: 'right' });
  const current = { ...scene, objects: [spawn, ...objects] };
  return { project: { ...project, scenes: [current] }, scene: current, player: createRuntimePlayer(spawn), platforms: createRuntimePlatforms(current), camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 }, input: { left: false, right: false, up: false, down: false, jump: false, attack: false, defend: false }, paused: false, completed: false };
}

describe('runtime phase 2', () => {
  it('acelera e desacelera horizontalmente', () => {
    const state = world(); state.input.right = true; updatePlayerMovement(state, .1); expect(state.player.velocityX).toBeGreaterThan(0);
    state.input.right = false; updatePlayerMovement(state, .1); expect(Math.abs(state.player.velocityX)).toBeLessThan(180);
  });
  it('aplica gravidade com limite', () => { const state = world(); applyGravity(state, 1); expect(state.player.velocityY).toBe(1100); });
  it('pula somente com chão ou coyote time', () => { const state = world(); state.player.grounded = true; state.input.jump = true; updatePlayerMovement(state, .016); expect(state.player.velocityY).toBeLessThan(0); });
  it('pousa em plataforma sólida', () => {
    const state = world([object('platform', 0, 300, 400, 40)]); state.player.y = 150; state.player.velocityY = 500; resolveWorldMovement(state, .2); expect(state.player.grounded).toBe(true); expect(state.player.y + state.player.height).toBe(300);
  });
  it('atravessa plataforma de mão única subindo e pousa caindo', () => {
    const state = world([object('platform', 0, 300, 400, 20, { passThrough: true })]); state.player.y = 320; state.player.velocityY = -300; resolveWorldMovement(state, .1); expect(state.player.y).toBeLessThan(320);
    state.player.y = 180; state.player.velocityY = 300; resolveWorldMovement(state, .1); expect(state.player.grounded).toBe(true);
  });
  it('agacha mantendo os pés', () => { const state = world(); const feet = state.player.y + state.player.height; state.input.down = true; updatePlayerMovement(state, .016); expect(state.player.crouching).toBe(true); expect(state.player.y + state.player.height).toBeCloseTo(feet); });
  it('limita a câmera ao cenário', () => { const state = world(); state.player.x = 950; state.player.y = 550; for (let i = 0; i < 60; i++) updateCamera(state); expect(state.camera.x).toBeLessThanOrEqual(600); expect(state.camera.y).toBeLessThanOrEqual(300); });
  it('reaparece no spawn ao cair', () => { const state = world(); state.player.y = 800; resolveWorldMovement(state, .016); expect(state.player.x).toBe(state.player.spawnX); expect(state.player.y).toBe(state.player.spawnY); });
});
