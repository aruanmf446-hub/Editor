import { useEffect, useMemo, useState } from 'react';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type {
  EnemyAnimationAssetAssignments,
  EnemyAnimationAssignments,
  EnemyAnimationRole,
  PlayerAnimationAssetAssignments,
  PlayerAnimationAssignments,
  PlayerAnimationRole,
  SceneObjectBase,
} from '../types/project';

const playerRoles: Array<{ role: PlayerAnimationRole; label: string; aliases: string[] }> = [
  { role: 'idle', label: 'Parado', aliases: ['idle', 'parado'] },
  { role: 'walk', label: 'Caminhar', aliases: ['walk', 'andar', 'caminhar'] },
  { role: 'run', label: 'Correr', aliases: ['run', 'correr'] },
  { role: 'jump', label: 'Pular', aliases: ['jump', 'pulo', 'pular'] },
  { role: 'fall', label: 'Cair', aliases: ['fall', 'cair', 'queda'] },
  { role: 'attack', label: 'Atacar', aliases: ['attack', 'ataque', 'atacar'] },
  { role: 'defend', label: 'Defender / Escudo', aliases: ['defend', 'defesa', 'escudo', 'block'] },
  { role: 'hurt', label: 'Receber dano', aliases: ['hurt', 'damage', 'dano'] },
  { role: 'dead', label: 'Morrer', aliases: ['dead', 'death', 'morte'] },
  { role: 'crouch', label: 'Agachar', aliases: ['crouch', 'agachado', 'agachar'] },
];

const enemyRoles: Array<{ role: EnemyAnimationRole; label: string; aliases: string[] }> = [
  { role: 'idle', label: 'Parado', aliases: ['idle', 'parado'] },
  { role: 'walk', label: 'Caminhar', aliases: ['walk', 'andar', 'caminhar'] },
  { role: 'run', label: 'Correr / perseguir', aliases: ['run', 'correr'] },
  { role: 'attack', label: 'Atacar', aliases: ['attack', 'ataque'] },
  { role: 'hurt', label: 'Receber dano', aliases: ['hurt', 'damage', 'dano'] },
  { role: 'dead', label: 'Morrer', aliases: ['dead', 'death', 'morte'] },
];

const bossExtraRoles: Array<{ role: EnemyAnimationRole; label: string; aliases: string[] }> = [
  { role: 'intro', label: 'Entrada do boss', aliases: ['intro', 'entrada'] },
  { role: 'phase-transition', label: 'Troca de fase', aliases: ['phase', 'fase', 'transition'] },
];

type LoadedClips = { assetId: string; clipNames: string[]; status: 'ready' | 'error' };

function supportsAnimationPanel(object?: SceneObjectBase): boolean {
  return object?.type === 'player-spawn' || object?.type === 'enemy-cactus' || object?.type === 'boss';
}

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const isAnimationFile = (name: string) => ['fbx', 'glb', 'gltf'].includes(extensionOf(name));

export function PlayerAnimationPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const assets = useAssetStore((state) => state.assets);
  const [loaded, setLoaded] = useState<LoadedClips | null>(null);

  const object = useMemo(() => {
    const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId);
    return scene?.objects.find((candidate) => candidate.id === selectedObjectId);
  }, [project, selectedObjectId, selectedSceneId]);

  const baseAsset = object?.assetId ? assets.find((candidate) => candidate.id === object.assetId) : undefined;
  const animationAssets = assets.filter((candidate) => candidate.category === 'model' && candidate.id !== object?.assetId && isAnimationFile(candidate.originalName));

  useEffect(() => {
    if (!supportsAnimationPanel(object) || !baseAsset) return;
    const extension = extensionOf(baseAsset.originalName);
    if (!['glb', 'gltf', 'fbx'].includes(extension)) {
      setLoaded({ assetId: baseAsset.id, clipNames: [], status: 'ready' });
      return;
    }
    let cancelled = false;
    void baseAsset.blob.arrayBuffer()
      .then(async (data) => {
        if (extension === 'fbx') {
          const group = new FBXLoader().parse(data, '');
          return group.animations.map((clip, index) => clip.name || `Animação ${index + 1}`);
        }
        const gltf = await new GLTFLoader().parseAsync(data, '');
        return gltf.animations.map((clip, index) => clip.name || `Animação ${index + 1}`);
      })
      .then((clipNames) => {
        if (!cancelled) setLoaded({ assetId: baseAsset.id, clipNames, status: 'ready' });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[animation-assignment] falha ao ler animações do modelo', error);
        setLoaded({ assetId: baseAsset.id, clipNames: [], status: 'error' });
      });
    return () => { cancelled = true; };
  }, [baseAsset, object]);

  if (!object || !supportsAnimationPanel(object) || !object.assetId) return null;

  const isPlayer = object.type === 'player-spawn';
  const roles = isPlayer ? playerRoles : object.type === 'boss' ? [...enemyRoles, ...bossExtraRoles] : enemyRoles;
  const embeddedAssignments = isPlayer ? object.animationAssignments ?? {} : object.enemyAnimationAssignments ?? {};
  const assetAssignments = isPlayer ? object.animationAssetAssignments ?? {} : object.enemyAnimationAssetAssignments ?? {};
  const currentLoad = loaded?.assetId === object.assetId ? loaded : null;
  const clipNames = currentLoad?.clipNames ?? [];

  const assignEmbedded = (role: PlayerAnimationRole | EnemyAnimationRole, clipName: string) => {
    if (isPlayer) {
      const next: PlayerAnimationAssignments = { ...(object.animationAssignments ?? {}) };
      const key = role as PlayerAnimationRole;
      if (clipName) next[key] = clipName; else delete next[key];
      updateObject(object.id, { animationAssignments: next });
    } else {
      const next: EnemyAnimationAssignments = { ...(object.enemyAnimationAssignments ?? {}) };
      const key = role as EnemyAnimationRole;
      if (clipName) next[key] = clipName; else delete next[key];
      updateObject(object.id, { enemyAnimationAssignments: next });
    }
  };

  const assignExternal = (role: PlayerAnimationRole | EnemyAnimationRole, assetId: string) => {
    if (isPlayer) {
      const next: PlayerAnimationAssetAssignments = { ...(object.animationAssetAssignments ?? {}) };
      const key = role as PlayerAnimationRole;
      if (assetId) next[key] = assetId; else delete next[key];
      updateObject(object.id, { animationAssetAssignments: next });
    } else {
      const next: EnemyAnimationAssetAssignments = { ...(object.enemyAnimationAssetAssignments ?? {}) };
      const key = role as EnemyAnimationRole;
      if (assetId) next[key] = assetId; else delete next[key];
      updateObject(object.id, { enemyAnimationAssetAssignments: next });
    }
  };

  const automaticAssign = () => {
    for (const { role, aliases } of roles) {
      const match = animationAssets.find((asset) => aliases.some((alias) => asset.name.toLowerCase().includes(alias)));
      if (match) assignExternal(role, match.id);
    }
  };

  return (
    <aside className="panel animation-assignment-panel">
      <div className="panel-title-row"><div><h2>{isPlayer ? 'Animações do player' : object.type === 'boss' ? 'Animações do boss' : 'Animações do vilão'}</h2><span>Use clips internos ou arquivos FBX separados.</span></div></div>
      <p className="panel-hint">OBJ pode ser usado como modelo base, mas não guarda esqueleto ou animação. Para animar um OBJ, os FBX anexados precisam usar o mesmo rig compatível do personagem.</p>
      {animationAssets.length > 0 && <button type="button" onClick={automaticAssign}>Associar automaticamente pelos nomes</button>}
      {roles.map(({ role, label }) => (
        <div className="animation-role-row" key={role}>
          <strong>{label}</strong>
          <label>
            Arquivo de animação
            <select value={assetAssignments[role as keyof typeof assetAssignments] ?? ''} onChange={(event) => assignExternal(role, event.target.value)}>
              <option value="">Usar clip do modelo</option>
              {animationAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({extensionOf(asset.originalName).toUpperCase()})</option>)}
            </select>
          </label>
          {clipNames.length > 0 && <label>
            Clip interno
            <select value={embeddedAssignments[role as keyof typeof embeddedAssignments] ?? ''} onChange={(event) => assignEmbedded(role, event.target.value)}>
              <option value="">Automático pelo nome</option>
              {clipNames.map((clipName, index) => <option key={`${clipName}-${index}`} value={clipName}>{index + 1}. {clipName}</option>)}
            </select>
          </label>}
        </div>
      ))}
      {animationAssets.length === 0 && <span>Importe arquivos FBX de animação para vinculá-los às ações.</span>}
    </aside>
  );
}
