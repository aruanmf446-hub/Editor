import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getAsset } from '../../persistence/assetRepository';
import { EnemyAnimationController } from '../EnemyAnimationController';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimeEnemyVisualState } from '../RuntimeEnemy';
import type { RuntimeWorld } from '../RuntimeWorld';
import { calculatePlayerRendererPixelRatio } from './PlayerRenderQuality';
import { disposeObject3DResources } from './disposeObject3D';

type Props = { world: RuntimeWorld; onReadyIdsChange?: (ids: ReadonlySet<string>) => void };

type EnemyVisual = {
  enemyId: string;
  root: Group;
  model: Object3D;
  animation: EnemyAnimationController;
  visualState: RuntimeEnemyVisualState;
  animationClip?: string;
};

function normalizeModelToFeet(model: Object3D, height: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  model.scale.setScalar(size.y > 0 ? height / size.y : 1);
  const scaled = new Box3().setFromObject(model);
  const center = scaled.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= scaled.min.y;
  model.position.z -= center.z;
}

function disposeRenderer(renderer: WebGLRenderer): void {
  renderer.setAnimationLoop(null);
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.width = 1;
  renderer.domElement.height = 1;
}

export function RuntimeEnemyModels({ world, onReadyIdsChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(world);
  const generationRef = useRef(0);
  useEffect(() => { worldRef.current = world; }, [world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const generation = ++generationRef.current;
    let cancelled = false;
    let frameId = 0;
    let resizeFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    const visuals = new Map<string, EnemyVisual>();
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(new Color(0x000000), 0);
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 2000);
    camera.position.set(0, 0, 1000);
    camera.lookAt(0, 0, 0);
    scene.add(new AmbientLight(0xffffff, 1.55));
    const key = new DirectionalLight(0xffffff, 2.1);
    key.position.set(200, 300, 500);
    scene.add(key);
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let lastTime = performance.now();

    const resizeNow = () => {
      resizeFrameId = 0;
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const nextRatio = calculatePlayerRendererPixelRatio(width, height, window.devicePixelRatio || 1);
      if (Math.abs(nextRatio - pixelRatio) > 0.01) {
        pixelRatio = nextRatio;
        renderer.setPixelRatio(nextRatio);
      }
      renderer.setSize(width, height, false);
    };
    const scheduleResize = () => { if (!resizeFrameId) resizeFrameId = requestAnimationFrame(resizeNow); };
    const resetClock = () => { lastTime = performance.now(); };

    const load = async () => {
      const candidates = worldRef.current.enemies.filter((enemy) => enemy.assetId && !enemy.removed);
      await Promise.all(candidates.map(async (enemy) => {
        let parsed: Object3D | null = null;
        try {
          const asset = await getAsset(enemy.assetId!);
          if (cancelled || generation !== generationRef.current || !asset || asset.category !== 'model') return;
          const gltf = await new GLTFLoader().parseAsync(await asset.blob.arrayBuffer(), '');
          parsed = gltf.scene;
          if (cancelled || generation !== generationRef.current) {
            disposeObject3DResources(parsed);
            parsed = null;
            return;
          }
          const root = new Group();
          normalizeModelToFeet(parsed, enemy.height);
          parsed.traverse((object) => {
            if (!(object instanceof Mesh)) return;
            object.castShadow = false;
            object.receiveShadow = false;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) if (material instanceof MeshStandardMaterial) material.needsUpdate = true;
          });
          root.add(parsed);
          scene.add(root);
          const animation = new EnemyAnimationController(parsed, gltf.animations, enemy.animationAssignments);
          if (enemy.activeAnimationClip) animation.transitionToNamedClip(enemy.visualState, enemy.activeAnimationClip, 0);
          else animation.transitionTo(enemy.visualState, 0);
          visuals.set(enemy.id, {
            enemyId: enemy.id,
            root,
            model: parsed,
            animation,
            visualState: enemy.visualState,
            animationClip: enemy.activeAnimationClip,
          });
          parsed = null;
        } catch (error) {
          if (parsed) disposeObject3DResources(parsed);
          if (!cancelled) console.error(`[enemy-model] falha ao carregar GLB de ${enemy.id}`, error);
        }
      }));
      if (!cancelled) onReadyIdsChange?.(new Set(visuals.keys()));
    };

    const render = (now: number) => {
      if (cancelled || generation !== generationRef.current) return;
      const delta = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      const currentWorld = worldRef.current;
      const alpha = RUNTIME_CONFIG.fixedStep > 0 ? Math.min(1, Math.max(0, currentWorld.accumulator / RUNTIME_CONFIG.fixedStep)) : 1;

      for (const visual of visuals.values()) {
        const enemy = currentWorld.enemies.find((candidate) => candidate.id === visual.enemyId);
        if (!enemy || enemy.removed) {
          visual.root.visible = false;
          continue;
        }
        visual.root.visible = true;
        if (enemy.visualState !== visual.visualState || enemy.activeAnimationClip !== visual.animationClip) {
          const accepted = enemy.activeAnimationClip
            ? visual.animation.transitionToNamedClip(enemy.visualState, enemy.activeAnimationClip)
            : visual.animation.transitionTo(enemy.visualState);
          if (accepted) {
            visual.visualState = enemy.visualState;
            visual.animationClip = enemy.activeAnimationClip;
          }
        }
        visual.animation.update(delta);
        const x = enemy.renderPreviousX + (enemy.x - enemy.renderPreviousX) * alpha;
        const y = enemy.renderPreviousY + (enemy.y - enemy.renderPreviousY) * alpha;
        visual.root.position.set(x + enemy.width / 2, -(y + enemy.height), 0);
        visual.root.rotation.y = enemy.direction === 'right' ? RUNTIME_CONFIG.playerModelFacingRightRotation : RUNTIME_CONFIG.playerModelFacingLeftRotation;
      }

      camera.left = currentWorld.camera.x;
      camera.right = currentWorld.camera.x + width;
      camera.top = -currentWorld.camera.y;
      camera.bottom = -(currentWorld.camera.y + height);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };

    resizeNow();
    resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleResize);
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', scheduleResize, { passive: true });
    document.addEventListener('fullscreenchange', scheduleResize);
    document.addEventListener('visibilitychange', resetClock);
    window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
    void load();
    frameId = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      generationRef.current += 1;
      cancelAnimationFrame(frameId);
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('fullscreenchange', scheduleResize);
      document.removeEventListener('visibilitychange', resetClock);
      window.visualViewport?.removeEventListener('resize', scheduleResize);
      for (const visual of visuals.values()) {
        visual.animation.dispose();
        scene.remove(visual.root);
        disposeObject3DResources(visual.model);
      }
      visuals.clear();
      onReadyIdsChange?.(new Set());
      disposeRenderer(renderer);
    };
  }, [onReadyIdsChange, world.sceneRevision]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} />;
}
