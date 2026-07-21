import { useEffect, useRef, useState } from 'react';
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
import { PlayerAnimationController } from '../PlayerAnimationController';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimePlayerVisualState } from '../RuntimePlayer';
import type { RuntimeWorld } from '../RuntimeWorld';
import { disposeObject3DResources } from './disposeObject3D';
import { calculatePlayerRendererPixelRatio } from './PlayerRenderQuality';

export type RuntimePlayerModelStatus = 'loading' | 'ready' | 'missing' | 'error';

type Props = {
  assetId?: string;
  world: RuntimeWorld;
  onStatusChange?: (status: RuntimePlayerModelStatus) => void;
};

type VisualRuntime = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  root: Group;
  model: Object3D;
  animation: PlayerAnimationController;
  visualState: RuntimePlayerVisualState;
  frameId: number;
  lastTime: number;
  width: number;
  height: number;
  pixelRatio: number;
  resizeObserver: ResizeObserver | null;
  removeResizeListeners: () => void;
};

function normalizeModelToFeet(model: Object3D, playerHeight: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const baseScale = size.y > 0 ? playerHeight / size.y : 1;
  model.scale.setScalar(baseScale * RUNTIME_CONFIG.playerModelScale);

  const scaledBounds = new Box3().setFromObject(model);
  const scaledCenter = scaledBounds.getCenter(new Vector3());
  model.position.x -= scaledCenter.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= scaledCenter.z;
}

function disposeRenderer(renderer: WebGLRenderer): void {
  renderer.setAnimationLoop(null);
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.width = 1;
  renderer.domElement.height = 1;
}

function disposeRuntime(runtime: VisualRuntime): void {
  cancelAnimationFrame(runtime.frameId);
  runtime.resizeObserver?.disconnect();
  runtime.removeResizeListeners();
  runtime.animation.dispose();
  runtime.scene.remove(runtime.root);
  disposeObject3DResources(runtime.model);
  disposeRenderer(runtime.renderer);
}

function animationOptions() {
  return {
    logicalAttackDuration: RUNTIME_CONFIG.attackDuration,
    logicalDeathDuration: RUNTIME_CONFIG.deathDuration,
  };
}

export function RuntimePlayerModel({ assetId, world, onStatusChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<VisualRuntime | null>(null);
  const worldRef = useRef(world);
  const loadGenerationRef = useRef(0);
  const [status, setStatus] = useState<RuntimePlayerModelStatus>('loading');

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => onStatusChange?.(status), [onStatusChange, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const generation = ++loadGenerationRef.current;
    if (!canvas || !assetId) {
      setStatus('missing');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    const load = async () => {
      let parsedModel: Object3D | null = null;
      let provisionalRenderer: WebGLRenderer | null = null;

      try {
        const asset = await getAsset(assetId);
        if (cancelled || generation !== loadGenerationRef.current) return;
        if (!asset || asset.category !== 'model') {
          setStatus('missing');
          return;
        }

        const data = await asset.blob.arrayBuffer();
        if (cancelled || generation !== loadGenerationRef.current) return;

        const loader = new GLTFLoader();
        const gltf = await loader.parseAsync(data, '');
        parsedModel = gltf.scene;
        if (cancelled || generation !== loadGenerationRef.current) {
          disposeObject3DResources(parsedModel);
          parsedModel = null;
          return;
        }

        const renderer = new WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        provisionalRenderer = renderer;
        renderer.setClearColor(new Color(0x000000), 0);

        const scene = new Scene();
        const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 2000);
        camera.position.set(0, 0, 1000);
        camera.lookAt(0, 0, 0);

        const root = new Group();
        const model = parsedModel;
        normalizeModelToFeet(model, worldRef.current.player.standingHeight);
        root.add(model);
        scene.add(root);
        scene.add(new AmbientLight(0xffffff, 1.6));
        const key = new DirectionalLight(0xffffff, 2.2);
        key.position.set(200, 300, 500);
        scene.add(key);

        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          object.castShadow = false;
          object.receiveShadow = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof MeshStandardMaterial) material.needsUpdate = true;
          }
        });

        const initialState = worldRef.current.player.visualState;
        const animation = new PlayerAnimationController(model, gltf.animations);
        animation.transitionTo(initialState, animationOptions());

        const runtime: VisualRuntime = {
          renderer,
          scene,
          camera,
          root,
          model,
          animation,
          visualState: initialState,
          frameId: 0,
          lastTime: performance.now(),
          width: 1,
          height: 1,
          pixelRatio: 1,
          resizeObserver: null,
          removeResizeListeners: () => undefined,
        };
        parsedModel = null;
        provisionalRenderer = null;
        runtimeRef.current = runtime;

        let resizeFrameId = 0;
        const resizeNow = () => {
          resizeFrameId = 0;
          if (cancelled || runtimeRef.current !== runtime) return;
          const rect = canvas.getBoundingClientRect();
          runtime.width = Math.max(1, Math.round(rect.width));
          runtime.height = Math.max(1, Math.round(rect.height));
          const nextPixelRatio = calculatePlayerRendererPixelRatio(
            runtime.width,
            runtime.height,
            window.devicePixelRatio || 1,
          );
          if (Math.abs(nextPixelRatio - runtime.pixelRatio) > 0.01) {
            runtime.pixelRatio = nextPixelRatio;
            renderer.setPixelRatio(nextPixelRatio);
          }
          renderer.setSize(runtime.width, runtime.height, false);
        };
        const scheduleResize = () => {
          if (resizeFrameId) return;
          resizeFrameId = requestAnimationFrame(resizeNow);
        };
        const resetAnimationClock = () => {
          runtime.lastTime = performance.now();
        };

        resizeNow();
        runtime.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleResize);
        runtime.resizeObserver?.observe(canvas);
        window.addEventListener('resize', scheduleResize, { passive: true });
        document.addEventListener('fullscreenchange', scheduleResize);
        document.addEventListener('visibilitychange', resetAnimationClock);
        window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
        runtime.removeResizeListeners = () => {
          if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
          window.removeEventListener('resize', scheduleResize);
          document.removeEventListener('fullscreenchange', scheduleResize);
          document.removeEventListener('visibilitychange', resetAnimationClock);
          window.visualViewport?.removeEventListener('resize', scheduleResize);
        };

        const render = (now: number) => {
          if (cancelled || generation !== loadGenerationRef.current || runtimeRef.current !== runtime) return;
          const visualDelta = Math.max(0, (now - runtime.lastTime) / 1000);
          runtime.lastTime = now;

          const currentWorld = worldRef.current;
          const currentPlayer = currentWorld.player;
          const nextState = currentPlayer.visualState;
          if (nextState !== runtime.visualState) {
            const respawned = runtime.visualState === 'dead'
              && currentPlayer.health > 0
              && currentPlayer.deathRemaining <= 0;
            const accepted = respawned
              ? animation.resetAfterRespawn(nextState, animationOptions())
              : animation.transitionTo(nextState, animationOptions());
            if (accepted) runtime.visualState = nextState;
          }

          animation.update(visualDelta);

          const alpha = RUNTIME_CONFIG.fixedStep > 0
            ? Math.min(1, Math.max(0, currentWorld.accumulator / RUNTIME_CONFIG.fixedStep))
            : 1;
          const x = currentPlayer.renderPreviousX + (currentPlayer.x - currentPlayer.renderPreviousX) * alpha;
          const y = currentPlayer.renderPreviousY + (currentPlayer.y - currentPlayer.renderPreviousY) * alpha;
          runtime.root.position.set(
            x + currentPlayer.width / 2 + RUNTIME_CONFIG.playerModelOffsetX,
            -(y + currentPlayer.height) + RUNTIME_CONFIG.playerModelOffsetY,
            RUNTIME_CONFIG.playerModelOffsetZ,
          );
          runtime.root.rotation.y = currentPlayer.direction === 'right'
            ? RUNTIME_CONFIG.playerModelFacingRightRotation
            : RUNTIME_CONFIG.playerModelFacingLeftRotation;

          const viewport = currentWorld.camera;
          camera.left = viewport.x;
          camera.right = viewport.x + runtime.width;
          camera.top = -viewport.y;
          camera.bottom = -(viewport.y + runtime.height);
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          runtime.frameId = requestAnimationFrame(render);
        };

        setStatus('ready');
        runtime.frameId = requestAnimationFrame(render);
      } catch (error) {
        if (parsedModel) disposeObject3DResources(parsedModel);
        if (provisionalRenderer) disposeRenderer(provisionalRenderer);
        if (!cancelled && generation === loadGenerationRef.current) {
          console.error('[player-model] falha ao carregar GLB', error);
          setStatus('error');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      loadGenerationRef.current += 1;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (runtime) disposeRuntime(runtime);
    };
  }, [assetId]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }} />;
}
