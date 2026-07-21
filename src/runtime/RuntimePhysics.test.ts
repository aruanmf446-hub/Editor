import { describe, expect, it } from 'vitest';
import type { ElFuegoProject, ProjectScene, SceneObjectBase } from '../types/project';
import { RUNTIME_CONFIG } from './RuntimeConfig';
import { getMovementSteps, probeGround } from './RuntimeCollision';
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
  return { project: { ...project, scenes: [current] }, scene: current, player: createRuntimePlayer(spawn), platforms: createRuntimePlatforms(current), camera: { x: 0, y: 0, viewportWidth: 400, viewportHeight: 300 }, input: input(), paused: false, completed: false, physicsSteps: 0, accumulator: 0, droppedPhysicsTime: 0 };
}

function simulate(state: RuntimeWorld, frames: number, delta: number) {
  let accumulator = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    accumulator += delta;
    while (accumulator >= RUNTIME_CONFIG.fixedStep) {
      updateRuntimeWorld(state, RUNTIME_CONFIG.fixedStep);
      accumulator -= RUNTIME_CONFIG.fixedStep;
    }
  }
}

describe('runtime phase 2', () => {
  it('acelera, desacelera e respeita a velocidade máxima', () => {
    const state = world(); state.input.right = true;
    for (let i = 0; i < 120; i += 1) updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep);
    expect(state.player.velocityX).toBe(RUNTIME_CONFIG.playerMaxSpeed);
    state.input.right = false;
    for (let i = 0; i < 120; i += 1) updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep);
    expect(state.player.velocityX).toBe(0);
  });
  it('usa borda de pulo e não renova o buffer ao segurar', () => {
    const state = world(); state.player.grounded = true; state.input.jump = true; state.input.jumpPressed = true;
    updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep); expect(state.player.velocityY).toBe(-RUNTIME_CONFIG.playerJumpSpeed);
    state.input.jumpPressed = false; state.player.grounded = true; state.player.velocityY = 0; state.player.jumpBufferRemaining = 0;
    updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep); expect(state.player.velocityY).toBe(0);
  });
  it('reduz a subida ao soltar o pulo', () => {
    const state = world(); state.player.velocityY = -600; state.input.jumpReleased = true;
    updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep); expect(state.player.velocityY).toBe(-600 * RUNTIME_CONFIG.jumpReleaseMultiplier);
  });
  it('executa pulo com coyote time', () => {
    const state = world(); state.player.grounded = false; state.player.coyoteRemaining = .05; state.input.jumpPressed = true;
    updatePlayerMovement(state, RUNTIME_CONFIG.fixedStep); expect(state.player.velocityY).toBe(-RUNTIME_CONFIG.playerJumpSpeed);
  });
  it('subdivide deslocamentos grandes conforme a hitbox', () => {
    const state = world(); expect(getMovementSteps(100, state.player)).toBeGreaterThan(1);
  });
  it('colide pela direita e pela esquerda', () => {
    const right = world([object('wall', 170, 0, 20, 600)]); right.player.velocityX = 1000; resolveWorldMovement(right, .1);
    expect(right.player.x + right.player.width).toBeLessThanOrEqual(170);
    const left = world([object('wall', 50, 0, 20, 600)]); left.player.velocityX = -1000; resolveWorldMovement(left, .1);
    expect(left.player.x).toBeGreaterThanOrEqual(70);
  });
  it('pousa em plataforma fina sem atravessar', () => {
    const state = world([object('platform', 0, 250, 300, 4)]); state.player.y = 0; state.player.velocityY = 3000;
    resolveWorldMovement(state, .1); expect(state.player.y + state.player.height).toBeCloseTo(250); expect(state.player.grounded).toBe(true);
  });
  it('ground probe não prende o player em one-way por baixo', () => {
    const state = world([object('platform', 0, 100, 300, 10, { collisionType: 'one-way' })]); state.player.y = 105;
    expect(probeGround(state.player, state.platforms)).toBe(false);
  });
  it('agacha preservando os pés e reseta corretamente', () => {
    const state = world(); const feet = state.player.y + state.player.height;
    setPlayerCrouching(state.player, true); expect(state.player.y + state.player.height).toBe(feet);
    state.player.velocityX = 10; state.player.velocityY = 10; resetPlayerAtSpawn(state.player);
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
  it('reaparece fora de colisor quando o spawn foi coberto', () => {
    // The collider overlaps the spawn (player occupies y=100..200) while
    // leaving a valid same-X position above it (player can fit at y<=90).
    const state = world([object('platform', 90, 190, 100, 120)]); state.player.y = 800;
    resolveWorldMovement(state, .016); expect(state.player.y).toBeLessThan(state.player.spawnY); expect(state.player.velocityX).toBe(0); expect(state.player.velocityY).toBe(0);
  });
  it('pausa com motivo explícito quando não existe respawn válido', () => {
    const state = world([object('wall', 90, 0, 100, 600)]); state.player.y = 800;
    resolveWorldMovement(state, .016);
    expect(state.paused).toBe(true);
    expect(state.respawnFailure).toBe(true);
    expect(state.pauseReason).toBe('invalid-respawn');
  });
  it('produz resultado equivalente em 60 e 30 frames por segundo', () => {
    const sixty = world(); const thirty = world(); sixty.input.right = true; thirty.input.right = true;
    simulate(sixty, 60, 1 / 60); simulate(thirty, 30, 1 / 30);
    expect(thirty.player.x).toBeCloseTo(sixty.player.x, 5); expect(thirty.player.velocityX).toBeCloseTo(sixty.player.velocityX, 5);
  });
});