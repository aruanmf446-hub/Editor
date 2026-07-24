import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  AnimationClip,
  Bone,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SkinnedMesh,
  Vector3,
  WebGLRenderer,
  type KeyframeTrack,
  type Object3D,
} from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { getAsset } from '../../persistence/assetRepository';
import type { PlayerAnimationAssetAssignments, PlayerAnimationAssignments, PlayerAnimationRole } from '../../types/project';
import { PlayerAnimationController } from '../PlayerAnimationController';
import { RUNTIME_CONFIG } from '../RuntimeConfig';
import type { RuntimePlayerVisualState } from '../RuntimePlayer';
import type { RuntimeWorld } from '../RuntimeWorld';
import { disposeObject3DResources } from './disposeObject3D';
import { calculatePlayerRendererPixelRatio } from './PlayerRenderQuality';

export type RuntimeUniversalPlayerModelStatus = 'loading' | 'ready' | 'missing' | 'error';

type Props = {
  assetId?: string;
  animationAssignments?: PlayerAnimationAssignments;
  animationAssetAssignments?: PlayerAnimationAssetAssignments;
  world: RuntimeWorld;
  onStatusChange?: (status: RuntimeUniversalPlayerModelStatus) => void;
};

type LoadedModel = { model: Object3D; clips: AnimationClip[]; extension: string };
const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

async function loadModel(assetId: string): Promise<LoadedModel> {
  const asset = await getAsset(assetId);
  if (!asset || asset.category !== 'model') throw new Error('Modelo não encontrado.');
  const data = await asset.blob.arrayBuffer();
  const extension = extensionOf(asset.originalName);
  if (extension === 'fbx') {
    const model = new FBXLoader().parse(data, '');
    return { model, clips: model.animations, extension };
  }
  if (extension === 'obj') {
    const text = new TextDecoder().decode(data);
    return { model: new OBJLoader().parse(text), clips: [], extension };
  }
  const gltf = await new GLTFLoader().parseAsync(data, '');
  return { model: gltf.scene, clips: gltf.animations, extension };
}

async function loadAnimationClip(assetId: string, role: PlayerAnimationRole): Promise<AnimationClip | null> {
  const asset = await getAsset(assetId);
  if (!asset || asset.category !== 'model') return null;
  const data = await asset.blob.arrayBuffer();
  const extension = extensionOf(asset.originalName);
  let clips: AnimationClip[] = [];
  if (extension === 'fbx') clips = new FBXLoader().parse(data, '').animations;
  else if (extension === 'glb' || extension === 'gltf') clips = (await new GLTFLoader().parseAsync(data, '')).animations;
  const source = clips[0];
  if (!source) return null;
  const clip = source.clone();
  clip.name = `external-${role}`;
  return clip;
}

function canonicalNodeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^.*[:|]/, '')
    .replace(/[^a-z0-9]/g, '');
}

function buildNodeNameMap(model: Object3D): Map<string, string> {
  const result = new Map<string, string>();
  model.traverse((node) => {
    if (!node.name) return;
    const canonical = canonicalNodeName(node.name);
    if (canonical && !result.has(canonical)) result.set(canonical, node.name);
  });
  return result;
}

function retargetTrack(track: KeyframeTrack, nodeNames: Map<string, string>): KeyframeTrack | null {
  const dot = track.name.indexOf('.');
  if (dot <= 0) return track.clone();
  const sourceTarget = track.name.slice(0, dot);
  const property = track.name.slice(dot);
  const direct = nodeNames.get(canonicalNodeName(sourceTarget));
  if (!direct) return null;
  const copy = track.clone();
  copy.name = `${direct}${property}`;
  return copy;
}

function retargetClip(clip: AnimationClip, model: Object3D): AnimationClip {
  const nodeNames = buildNodeNameMap(model);
  const tracks = clip.tracks
    .map((track) => retargetTrack(track, nodeNames))
    .filter((track): track is KeyframeTrack => Boolean(track));
  return new AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

function hasRig(model: Object3D): boolean {
  let found = false;
  model.traverse((node) => {
    if (node instanceof Bone || node instanceof SkinnedMesh) found = true;
  });
  return found;
}

function normalizeModelToFeet(model: Object3D, playerHeight: number): void {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const baseScale = size.y > 0 ? playerHeight / size.y : 1;
  model.scale.setScalar(baseScale * RUNTIME_CONFIG.playerModelScale);
  const scaledBounds = new Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= center.z;
}

export function RuntimeUniversalPlayerModel({ assetId, animationAssignments, animationAssetAssignments, world, onStatusChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(world);
  const [status, setStatus] = useState<RuntimeUniversalPlayerModelStatus>('loading');

  useEffect(() => { worldRef.current = world; }, [world]);
  useEffect(() => { onStatusChange?.(status); }, [onStatusChange, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assetId) {
      queueMicrotask(() => setStatus('missing'));
      return;
    }
    let cancelled = false;
    let frameId = 0;
    let renderer: WebGLRenderer | null = null;
    let model: Object3D | null = null;
    let animation: PlayerAnimationController | null = null;
    queueMicrotask(() => { if (!cancelled) setStatus('loading'); });

    void (async () => {
      try {
        const loaded = await loadModel(assetId);
        if (cancelled) { disposeObject3DResources(loaded.model); return; }
        model = loaded.model;
        const externalEntries = Object.entries(animationAssetAssignments ?? {}) as Array<[PlayerAnimationRole, string]>;
        if (loaded.extension === 'obj' && externalEntries.length > 0) {
          throw new Error('OBJ não possui esqueleto. Use como modelo base o FBX rigado do personagem.');
        }
        if (externalEntries.length > 0 && !hasRig(model)) {
          throw new Error('O modelo base não possui rig compatível com as animações FBX.');
        }

        const clips = [...loaded.clips];
        const effectiveAssignments: PlayerAnimationAssignments = { ...animationAssignments };
        for (const [role, externalAssetId] of externalEntries) {
          const sourceClip = await loadAnimationClip(externalAssetId, role);
          if (!sourceClip) continue;
          const clip = retargetClip(sourceClip, model);
          if (!clip.tracks.length) {
            console.warn(`[player-animation] nenhum osso compatível encontrado para ${role}`);
            continue;
          }
          clips.push(clip);
          effectiveAssignments[role] = clip.name;
        }
        if (cancelled) { disposeObject3DResources(loaded.model); return; }

        renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setClearColor(new Color(0x000000), 0);
        const scene = new Scene();
        const camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 2000);
        camera.position.set(0, 0, 1000);
        const root = new Group();
        normalizeModelToFeet(model, worldRef.current.player.standingHeight);
        root.add(model); scene.add(root);
        scene.add(new AmbientLight(0xffffff, 1.6));
        const light = new DirectionalLight(0xffffff, 2.2); light.position.set(200, 300, 500); scene.add(light);
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { if (material instanceof MeshStandardMaterial) material.needsUpdate = true; });
        });
        animation = new PlayerAnimationController(model, clips, { assignments: effectiveAssignments, debug: true });
        let visualState: RuntimePlayerVisualState = worldRef.current.player.visualState;
        animation.transitionTo(visualState, { logicalAttackDuration: RUNTIME_CONFIG.attackDuration, logicalDeathDuration: RUNTIME_CONFIG.deathDuration });
        let lastTime = performance.now();

        const render = (now: number) => {
          if (cancelled || !renderer || !animation) return;
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, Math.round(rect.width));
          const height = Math.max(1, Math.round(rect.height));
          renderer.setPixelRatio(calculatePlayerRendererPixelRatio(width, height, window.devicePixelRatio || 1));
          renderer.setSize(width, height, false);
          const delta = Math.max(0, (now - lastTime) / 1000); lastTime = now;
          const current = worldRef.current;
          const player = current.player;
          if (player.visualState !== visualState) {
            if (animation.transitionTo(player.visualState, { logicalAttackDuration: RUNTIME_CONFIG.attackDuration, logicalDeathDuration: RUNTIME_CONFIG.deathDuration })) visualState = player.visualState;
          }
          animation.update(delta);
          const alpha = RUNTIME_CONFIG.fixedStep > 0 ? Math.min(1, Math.max(0, current.accumulator / RUNTIME_CONFIG.fixedStep)) : 1;
          const x = player.renderPreviousX + (player.x - player.renderPreviousX) * alpha;
          const y = player.renderPreviousY + (player.y - player.renderPreviousY) * alpha;
          root.position.set(x + player.width / 2 + RUNTIME_CONFIG.playerModelOffsetX, -(y + player.height) + RUNTIME_CONFIG.playerModelOffsetY, RUNTIME_CONFIG.playerModelOffsetZ);
          root.rotation.y = player.direction === 'right' ? RUNTIME_CONFIG.playerModelFacingRightRotation : RUNTIME_CONFIG.playerModelFacingLeftRotation;
          camera.left = current.camera.x; camera.right = current.camera.x + width; camera.top = -current.camera.y; camera.bottom = -(current.camera.y + height); camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(render);
        };
        setStatus('ready');
        frameId = requestAnimationFrame(render);
      } catch (error) {
        console.error('[universal-player-model] falha ao carregar modelo ou animações', error);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      animation?.dispose();
      if (model) disposeObject3DResources(model);
      renderer?.renderLists.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
    };
  }, [animationAssetAssignments, animationAssignments, assetId]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }} />;
}
