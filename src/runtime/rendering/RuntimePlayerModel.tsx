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
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getAsset } from '../../persistence/assetRepository';
import { PlayerAnimationController } from '../PlayerAnimationController';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimePlayerState } from '../RuntimePlayer';

export type RuntimePlayerModelStatus = 'loading' | 'ready' | 'missing' | 'error';

type Props = {
  assetId?: string;
  player: RuntimePlayerState;
  cameraX: number;
  cameraY: number;
  interpolationAlpha: number;
  onStatusChange?: (status: RuntimePlayerModelStatus) => void;
};

type VisualRuntime = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  root: Group;
  model: Object3D;
  animation: PlayerAnimationController;
  objectUrl: string;
  frameId: number;
  lastTime: number;
};

function disposeTexture(value: unknown): void {
  if (value instanceof Texture) value.dispose();
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) disposeTexture(value);
  material.dispose();
}

function disposeModel(model: Object3D): void {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) disposeMaterial(material);
  });
}

function normalizeModelToFeet(model: Object3D, playerHeight: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = size.y > 0 ? playerHeight / size.y : 1;
  model.scale.setScalar(scale);

  const scaledBounds = new Box3().setFromObject(model);
  const scaledCenter = scaledBounds.getCenter(new Vector3());
  model.position.x -= scaledCenter.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= center.z * scale;
}

export function RuntimePlayerModel({ assetId, player, cameraX, cameraY, interpolationAlpha, onStatusChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<VisualRuntime | null>(null);
  const playerRef = useRef(player);
  const cameraRef = useRef({ x: cameraX, y: cameraY });
  const interpolationRef = useRef(interpolationAlpha);
  const [status, setStatus] = useState<RuntimePlayerModelStatus>('loading');

  playerRef.current = player;
  cameraRef.current = { x: cameraX, y: cameraY };
  interpolationRef.current = interpolationAlpha;

  useEffect(() => onStatusChange?.(status), [onStatusChange, status]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.animation.transitionTo(player.visualState, {
      logicalAttackDuration: RUNTIME_CONFIG.attackDuration,
    });
  }, [player.visualState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assetId) {
      setStatus('missing');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    const load = async () => {
      const asset = await getAsset(assetId);
      if (cancelled) return;
      if (!asset || asset.category !== 'model') {
        setStatus('missing');
        return;
      }

      const objectUrl = URL.createObjectURL(asset.blob);
      const loader = new GLTFLoader();

      loader.load(objectUrl, (gltf) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setClearColor(new Color(0x000000), 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const scene = new Scene();
        const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 2000);
        camera.position.set(0, 0, 1000);
        camera.lookAt(0, 0, 0);

        const root = new Group();
        const model = gltf.scene;
        normalizeModelToFeet(model, playerRef.current.standingHeight);
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
          if (object.material instanceof MeshStandardMaterial) object.material.needsUpdate = true;
        });

        const animation = new PlayerAnimationController(model, gltf.animations);
        animation.transitionTo(playerRef.current.visualState, {
          logicalAttackDuration: RUNTIME_CONFIG.attackDuration,
        });

        const runtime: VisualRuntime = {
          renderer,
          scene,
          camera,
          root,
          model,
          animation,
          objectUrl,
          frameId: 0,
          lastTime: performance.now(),
        };
        runtimeRef.current = runtime;

        const render = (now: number) => {
          if (cancelled || runtimeRef.current !== runtime) return;
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, Math.round(rect.width));
          const height = Math.max(1, Math.round(rect.height));
          const expectedWidth = Math.round(width * renderer.getPixelRatio());
          const expectedHeight = Math.round(height * renderer.getPixelRatio());
          if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) renderer.setSize(width, height, false);

          const visualDelta = Math.min(Math.max(0, (now - runtime.lastTime) / 1000), 0.1);
          runtime.lastTime = now;
          animation.update(visualDelta);

          const currentPlayer = playerRef.current;
          const alpha = Math.min(1, Math.max(0, interpolationRef.current));
          const x = currentPlayer.previousX + (currentPlayer.x - currentPlayer.previousX) * alpha;
          const y = currentPlayer.previousY + (currentPlayer.y - currentPlayer.previousY) * alpha;
          runtime.root.position.set(
            x + currentPlayer.width / 2,
            -(y + currentPlayer.height),
            0,
          );
          runtime.root.rotation.y = currentPlayer.direction === 'right'
            ? RUNTIME_CONFIG.playerModelFacingRightRotation
            : RUNTIME_CONFIG.playerModelFacingLeftRotation;

          const viewport = cameraRef.current;
          camera.left = viewport.x;
          camera.right = viewport.x + width;
          camera.top = -viewport.y;
          camera.bottom = -(viewport.y + height);
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          runtime.frameId = requestAnimationFrame(render);
        };

        setStatus('ready');
        runtime.frameId = requestAnimationFrame(render);
      }, undefined, (error) => {
        URL.revokeObjectURL(objectUrl);
        if (!cancelled) {
          console.error('[player-model] falha ao carregar GLB', error);
          setStatus('error');
        }
      });
    };

    void load().catch((error) => {
      if (!cancelled) {
        console.error('[player-model] falha ao recuperar ativo', error);
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (!runtime) return;
      cancelAnimationFrame(runtime.frameId);
      runtime.animation.dispose();
      runtime.scene.remove(runtime.root);
      disposeModel(runtime.model);
      runtime.renderer.dispose();
      runtime.renderer.forceContextLoss();
      URL.revokeObjectURL(runtime.objectUrl);
    };
  }, [assetId]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }} />;
}
