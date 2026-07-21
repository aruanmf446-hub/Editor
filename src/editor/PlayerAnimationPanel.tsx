import { useEffect, useMemo, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type {
  EnemyAnimationAssignments,
  EnemyAnimationRole,
  PlayerAnimationAssignments,
  PlayerAnimationRole,
  SceneObjectBase,
} from '../types/project';

const playerRoles: Array<{ role: PlayerAnimationRole; label: string }> = [
  { role: 'idle', label: 'Parado' },
  { role: 'walk', label: 'Caminhar' },
  { role: 'run', label: 'Correr' },
  { role: 'jump', label: 'Pular' },
  { role: 'fall', label: 'Cair' },
  { role: 'attack', label: 'Atacar' },
  { role: 'defend', label: 'Defender' },
  { role: 'hurt', label: 'Receber dano' },
  { role: 'dead', label: 'Morrer' },
  { role: 'crouch', label: 'Agachar' },
];

const enemyRoles: Array<{ role: EnemyAnimationRole; label: string }> = [
  { role: 'idle', label: 'Parado' },
  { role: 'walk', label: 'Caminhar' },
  { role: 'run', label: 'Correr / perseguir' },
  { role: 'attack', label: 'Atacar' },
  { role: 'hurt', label: 'Receber dano' },
  { role: 'dead', label: 'Morrer' },
];

const bossExtraRoles: Array<{ role: EnemyAnimationRole; label: string }> = [
  { role: 'intro', label: 'Entrada do boss' },
  { role: 'phase-transition', label: 'Troca de fase' },
];

type LoadedClips = { assetId: string; clipNames: string[]; status: 'ready' | 'error' };

function supportsAnimationPanel(object?: SceneObjectBase): boolean {
  return object?.type === 'player-spawn' || object?.type === 'enemy-cactus' || object?.type === 'boss';
}

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

  const asset = object?.assetId ? assets.find((candidate) => candidate.id === object.assetId) : undefined;
  const isSupportedModel = supportsAnimationPanel(object) && asset?.category === 'model';

  useEffect(() => {
    if (!isSupportedModel || !asset) return;
    let cancelled = false;
    void asset.blob.arrayBuffer()
      .then((data) => new GLTFLoader().parseAsync(data, ''))
      .then((gltf) => {
        if (cancelled) return;
        setLoaded({ assetId: asset.id, clipNames: gltf.animations.map((clip, index) => clip.name || `Animação ${index + 1}`), status: 'ready' });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[animation-assignment] falha ao ler animações do GLB', error);
        setLoaded({ assetId: asset.id, clipNames: [], status: 'error' });
      });
    return () => { cancelled = true; };
  }, [asset, isSupportedModel]);

  if (!object || !supportsAnimationPanel(object) || !object.assetId) return null;

  const currentLoad = loaded?.assetId === object.assetId ? loaded : null;
  const status: 'loading' | 'ready' | 'error' = currentLoad?.status ?? 'loading';
  const clipNames = currentLoad?.clipNames ?? [];
  const isPlayer = object.type === 'player-spawn';
  const roles = isPlayer
    ? playerRoles
    : object.type === 'boss'
      ? [...enemyRoles, ...bossExtraRoles]
      : enemyRoles;

  const assignments = isPlayer ? object.animationAssignments ?? {} : object.enemyAnimationAssignments ?? {};
  const assign = (role: PlayerAnimationRole | EnemyAnimationRole, clipName: string) => {
    if (isPlayer) {
      const next: PlayerAnimationAssignments = { ...(object.animationAssignments ?? {}) };
      const playerRole = role as PlayerAnimationRole;
      if (clipName) next[playerRole] = clipName; else delete next[playerRole];
      updateObject(object.id, { animationAssignments: next });
      return;
    }
    const next: EnemyAnimationAssignments = { ...(object.enemyAnimationAssignments ?? {}) };
    const enemyRole = role as EnemyAnimationRole;
    if (clipName) next[enemyRole] = clipName; else delete next[enemyRole];
    updateObject(object.id, { enemyAnimationAssignments: next });
  };

  return (
    <aside className="panel animation-assignment-panel">
      <h2>{isPlayer ? 'Animações do player' : object.type === 'boss' ? 'Animações do boss' : 'Animações do cacto'}</h2>
      <p className="panel-hint">Associe cada ação ao clip correto do GLB. A posição do clip no arquivo não é usada como regra.</p>
      {status === 'loading' && <span>Lendo animações do GLB...</span>}
      {status === 'error' && <span>Não foi possível ler as animações deste GLB.</span>}
      {status === 'ready' && clipNames.length === 0 && <span>Este GLB não possui animações.</span>}
      {clipNames.length > 0 && roles.map(({ role, label }) => (
        <label key={role}>
          {label}
          <select value={assignments[role as keyof typeof assignments] ?? ''} onChange={(event) => assign(role, event.target.value)}>
            <option value="">Automático pelo nome</option>
            {clipNames.map((clipName, index) => <option key={`${clipName}-${index}`} value={clipName}>{index + 1}. {clipName}</option>)}
          </select>
        </label>
      ))}
    </aside>
  );
}
