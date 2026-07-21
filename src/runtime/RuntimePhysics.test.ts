import { describe, expect, it } from 'vitest';
import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { getMovementSteps } from './RuntimeCollision';
import { updateRuntimeWorld } from './RuntimePhysics';
import { createRuntimePlayer, resetPlayerAtSpawn, setPlayerCrouching } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { updatePlayerMovement } from './systems/PlayerMovementSystem';
import { resolveWorldMovement } from './systems/CollisionSystem';
import { updateCamera } from './systems/CameraSystem';

const object = (type: SceneObjectBase['type'], x: number, y: number, width: number, height: number, patch: Partial<SceneObjectBase> = {}): SceneObjectBase => ({
  id: crypto.randomUUID(), sceneId: 'scene', type, name: type, transform: { x, y, z: 0, width, height, scaleX: 1, scaleY: 1, rotation: 0 }, visible: true, locked: false, editorOnly: false, gameOnly: false, ...patch,
});
const scene: ProjectScene = { id: 'scene', name: 'Cena', order: 0, width: 1000, height: 600, backgroundAssetId: null, background: { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 }, objects: [] };
const project = { project: { id: 'p', name: 'P', createdAt: '', updatedAt: '' }, version: 1, scenes: [scene], assets: [], settings: { gridSize: 16, snapEnabled: true } } as ElFuegoProject;
const input = () => ({ left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false });

function world(objects: SceneObjectBase[] = []): RuntimeWorld {
  const spawn = object('player-spawn', 100, 100, 50, 100, { initialHealth: 3, initialAttack: 1, initialDefense: 1, direction: 'right' });
  const current = { ...scene, objects: [spawn, ...objects] };
  return { project: { ...project, scenes: [current] }, scene: current, player: createRuntimePlayer(spawn), platforms: createRuntimePlatforms(current), camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 }, input: input(), paused: false, completed: false, physicsSteps: 0, accumulator: 0 };
}

describe('runtime phase 2', () => {
  it('acelera, desacelera e respeita a velocidade máxima', () => {
    const state = world(); state.input.right = true;
    for (let i = 0; i < 120; i += 1) updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep);
    expect(state.player.velocityX).toBe(RUNTIME_CONFIG.playerMaxSpeed);
    state.input.right = false; updatePlayerMovement(state, .1); expect(state.player.velocityX).toBeLessThan(RUNTIME_CONFIG.playerMaxSpeed);
  });
  it('usa borda de pulo e não renova o buffer ao segurar', () => {
    const state = world(); state.input.jump = true; state.input.jumpPressed = true; updatePlayerMovement(state, .01);
    const buffered = state.player.jumpBufferRemaining; state.input.jumpPressed = false; updatePlayerMovement(state, .01);
    expect(state.player.jumpBufferRemaining).toBeLessThan(buffered);
  });
  it('reduz a subida ao soltar o pulo', () => {
    const state = world(); state.player.velocityY = -600; state.input.jumpReleased = true; updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep);
    expect(state.player.velocityY).toBeCloseTo(-270);
  });
  it('executa pulo com coyote time', () => {
    const state = world(); state.player.grounded = false; state.player.coyoteRemaining = .05; state.input.jumpPressed = true;
    updatePlayerMovement(state, .01); expect(state.player.velocityY).toBe(-RUNTIME_CONFIG.playerJumpSpeed);
  });
  it('subdivide deslocamentos grandes', () => expect(getMovementSteps(40, 8)).toBe(5));
  it('colide pela direita e pela esquerda', () => {
    const wall = object('wall', 300, 0, 20, 600); const state = world([wall]);
    state.player.x = 200; state.player.velocityX = 800; resolveWorldMovement(state, .2); expect(state.player.x + state.player.width).toBe(300); expect(state.player.lastCollisionSide).toBe('right');
    state.player.x = 350; state.player.velocityX = -800; resolveWorldMovement(state, .2); expect(state.player.x).toBe(320); expect(state.player.lastCollisionSide).toBe('left');
  });
  it('pousa em plataforma fina sem atravessar', () => {
    const state = world([object('platform', 0, 300, 400, 4)]); state.player.y = 100; state.player.velocityY = 1100;
    resolveWorldMovement(state, .2); expect(state.player.grounded).toBe(true); expect(state.player.y + state.player.height).toBe(300);
  });
  it('não colide por baixo ou pela lateral em one-way', () => {
    const state = world([object('platform', 200, 300, 200, 10, { passThrough: true })]);
    state.player.x = 250; state.player.y = 330; state.player.velocityY = -500; resolveWorldMovement(state, .1); expect(state.player.y).toBeLessThan(330);
    state.player.x = 100; state.player.y = 220; state.player.velocityX = 800; state.player.velocityY = 0; resolveWorldMovement(state, .1); expect(state.player.x).toBeGreaterThan(100);
  });
  it('agacha preservando os pés e reseta corretamente', () => {
    const state = world(); const feet = state.player.y + state.player.height; setPlayerCrouching(state.player, true);
    expect(state.player.y + state.player.height).toBeCloseTo(feet); resetPlayerAtSpawn(state.player);
    expect(state.player.crouching).toBe(false); expect(state.player.velocityX).toBe(0); expect(state.player.velocityY).toBe(0);
  });
  it('mantém câmera em zero em cena menor que viewport', () => {
    const state = world(); state.scene.width = 300; state.scene.height = 200; state.camera.viewportWidth = 500; state.camera.viewportHeight = 400;
    updateCamera(state); expect(state.camera.x).toBe(0); expect(state.camera.y).toBe(0);
  });
  it('pausa congela física e temporizadores', () => {
    const state = world(); state.paused = true; state.player.velocityX = 100; state.player.coyoteRemaining = .05;
    updateRuntimeWorld(state, RUNTIME_CONFIG.fixedStep); expect(state.player.x).toBe(100); expect(state.player.coyoteRemaining).toBe(.05);
  });
  it('reaparece no spawn ao cair', () => {
    const state = world(); state.player.y = 800; state.player.crouching = true; state.player.velocityX = 100;
    resolveWorldMovement(state, .016); expect(state.player.x).toBe(state.player.spawnX); expect(state.player.y).toBe(state.player.spawnY); expect(state.player.crouching).toBe(false);
  });
});
