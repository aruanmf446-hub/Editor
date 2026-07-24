import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  AnimationClip,
  AnimationMixer,
  Bone,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
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
type SavedPose = { node: Object3D; position: Vector3; quaternion: Object3D['quaternion']; scale: Vector3 };

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

const MIXAMO_TO_ACCURIG: Record<string, string> = {
  hips: 'ccbasehip',
  spine: 'ccbasewaist',
  spine1: 'ccbasespine01',
  spine2: 'ccbasespine02',
  neck: 'ccbasenecktwist01',
  head: 'ccbasehead',
  leftshoulder: 'ccbaselclavicle',
  leftarm: 'ccbaselupperarm',
  leftforearm: 'ccbaselforearm',
  lefthand: 'ccbaselhand',
  rightshoulder: 'ccbaserclavicle',
  rightarm: 'ccbaserupperarm',
  rightforearm: 'ccbaserforearm',
  righthand: 'ccbaserhand',
  leftupleg: 'ccbaselthigh',
  leftleg: 'ccbaselcalf',
  leftfoot: 'ccbaselfoot',
  lefttoebase: 'ccbaseltoebase',
  rightupleg: 'ccbaserthigh',
  rightleg: 'ccbasercalf',
  rightfoot: 'ccbaserfoot',
  righttoebase: 'ccbasertoebase',
  lefthandthumb1: 'ccbaselthumb1',
  lefthandthumb2: 'ccbaselthumb2',
  lefthandthumb3: 'ccbaselthumb3',
  lefthandindex1: 'ccbaselindex1',
  lefthandindex2: 'ccbaselindex2',
  lefthandindex3: 'ccbaselindex3',
  lefthandmiddle1: 'ccbaselmid1',
  lefthandmiddle2: 'ccbaselmid2',
  lefthandmiddle3: 'ccbaselmid3',
  lefthandring1: 'ccbaselring1',
  lefthandring2: 'ccbaselring2',
  lefthandring3: 'ccbaselring3',
  lefthandpinky1: 'ccbaselpinky1',
  lefthandpinky2: 'ccbaselpinky2',
  lefthandpinky3: 'ccbaselpinky3',
  righthandthumb1: 'ccbaserthumb1',
  righthandthumb2: 'ccbaserthumb2',
  righthandthumb3: 'ccbaserthumb3',
  righthandindex1: 'ccbaserindex1',
  righthandindex2: 'ccbaserindex2',
  righthandindex3: 'ccbaserindex3',
  righthandmiddle1: 'ccbasermid1',
  righthandmiddle2: 'ccbasermid2',
  righthandmiddle3: 'ccbasermid3',
  righthandring1: 'ccbaserring1',
  righthandring2: 'ccbaserring2',
  righthandring3: 'ccbaserring3',
  righthandpinky1: 'ccbaserpinky1',
  righthandpinky2: 'ccbaserpinky2',
  righthandpinky3: 'ccbaserpinky3',
};

function canonicalNodeName(name: string): string {
  const canonical = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^.*[:|]/, '')
    .replace(/[^a-z0-9]/g, '');
  return MIXAMO_TO_ACCURIG[canonical] ?? canonical;
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
  const canonicalTarget = canonicalNodeName(sourceTarget);
  const direct = nodeNames.get(canonicalTarget);
  if (!direct) return null;

  const sourceCanonical = sourceTarget
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^.*[:|]/, '')
    .replace(/[^a-z0-9]/g, '');
  const isRootNode = sourceCanonical === 'hips' || sourceCanonical === 'root' || sourceCanonical === 'armature';
  if (property === '.scale' || (isRootNode && property === '.position')) return null;

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

function savePose(model: Object3D): SavedPose[] {
  const saved: SavedPose[] = [];
  model.traverse((node) => saved.push({
    node,
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  }));
  return saved;
}

function restorePose(saved: SavedPose[]): void {
  for (const item of saved) {
    item.node.position.copy(item.position);
    item.node.quaternion.copy(item.quaternion);
    item.node.scale.copy(item.scale);
    item.node.updateMatrix();
  }
}

function refreshSkinnedMeshes(model: Object3D): void {
  model.traverse((node) => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.update();
    node.computeBoundingBox();
    node.computeBoundingSphere();
  });
  model.updateMatrixWorld(true);
}

function measureModel(model: Object3D): Box3 {
  refreshSkinnedMeshes(model);
  return new Box3().setFromObject(model, true);
}

function calculateAnimatedFit(
  model: Object3D,
  clips: AnimationClip[],
  playerWidth: number,
  playerHeight: number,
): { scale: number; center: Vector3; bottom: number } {
  const saved = savePose(model);
  const baseBounds = measureModel(model);
  const baseCenter = baseBounds.getCenter(new Vector3());
  let maximumWidth = Math.max(0.0001, baseBounds.max.x - baseBounds.min.x);
  let maximumHeight = Math.max(0.0001, baseBounds.max.y - baseBounds.min.y);

  if (clips.length > 0 && hasRig(model)) {
    const sampler = new AnimationMixer(model);
    for (const clip of clips) {
      const action = sampler.clipAction(clip);
      action.reset().play();
      const samples = Math.max(4, Math.min(10, Math.ceil(clip.duration * 6)));
      for (let index = 0; index <= samples; index += 1) {
        sampler.setTime(clip.duration * (index / samples));
        const bounds = measureModel(model);
        maximumWidth = Math.max(maximumWidth, bounds.max.x - bounds.min.x);
        maximumHeight = Math.max(maximumHeight, bounds.max.y - bounds.min.y);
      }
      action.stop();
      sampler.stopAllAction();
      sampler.uncacheAction(clip, model);
      sampler.uncacheClip(clip);
      restorePose(saved);
      refreshSkinnedMeshes(model);
    }
    sampler.uncacheRoot(model);
  }

  restorePose(saved);
  refreshSkinnedMeshes(model);
  const widthScale = playerWidth / maximumWidth;
  const heightScale = playerHeight / maximumHeight;
  return {
    scale: Math.min(widthScale, heightScale) * RUNTIME_CONFIG.playerModelScale,
    center: baseCenter,
    bottom: baseBounds.min.y,
  };
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
        if (loaded.extension === 'obj' && externalEntries.length > 0) throw new Error('OBJ não possui esqueleto. Use como modelo base o FBX rigado do personagem.');
        if (externalEntries.length > 0 && !hasRig(model)) throw new Error('O modelo base não possui rig compatível com as animações FBX.');

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
          console.info(`[player-animation] ${role}: ${clip.tracks.length}/${sourceClip.tracks.length} trilhas compatíveis`);
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
        const fitRoot = new Group();
        const contentRoot = new Group();
        const currentPlayer = worldRef.current.player;
        const fit = calculateAnimatedFit(model, clips, currentPlayer.width, currentPlayer.standingHeight);
        contentRoot.position.set(-fit.center.x, -fit.bottom, -fit.center.z);
        contentRoot.add(model);
        fitRoot.scale.setScalar(fit.scale);
        fitRoot.add(contentRoot);
        root.add(fitRoot);
        scene.add(root);

        scene.add(new AmbientLight(0xffffff, 2.8));
        scene.add(new HemisphereLight(0xffffff, 0x334466, 2.2));
        const light = new DirectionalLight(0xffffff, 3.4);
        light.position.set(200, 300, 500);
        scene.add(light);

        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            material.transparent = false;
            material.opacity = 1;
            material.needsUpdate = true;
            if (material instanceof MeshStandardMaterial) material.roughness = Math.min(material.roughness, 0.85);
          });
        });

        animation = new PlayerAnimationController(model, clips, { assignments: effectiveAssignments, debug: true });
        let visualState: RuntimePlayerVisualState = worldRef.current.player.visualState;
        animation.transitionTo(visualState, { logicalAttackDuration: RUNTIME_CONFIG.attackDuration, logicalDeathDuration: RUNTIME_CONFIG.deathDuration });
        let lastTime = performance.now();
        let lastWidth = 0;
        let lastHeight = 0;
        let lastPixelRatio = 0;

        const render = (now: number) => {
          if (cancelled || !renderer || !animation) return;
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, Math.round(rect.width));
          const height = Math.max(1, Math.round(rect.height));
          const pixelRatio = calculatePlayerRendererPixelRatio(width, height, window.devicePixelRatio || 1);
          if (width !== lastWidth || height !== lastHeight || Math.abs(pixelRatio - lastPixelRatio) > 0.01) {
            lastWidth = width;
            lastHeight = height;
            lastPixelRatio = pixelRatio;
            renderer.setPixelRatio(pixelRatio);
            renderer.setSize(width, height, false);
          }

          const delta = Math.max(0, (now - lastTime) / 1000);
          lastTime = now;
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
          camera.left = current.camera.x;
          camera.right = current.camera.x + width;
          camera.top = -current.camera.y;
          camera.bottom = -(current.camera.y + height);
          camera.updateProjectionMatrix();
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
      renderer?.renderLists.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, [animationAssetAssignments, animationAssignments, assetId]);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }} />;
}
