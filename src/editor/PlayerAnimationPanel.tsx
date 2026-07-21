import { useEffect, useMemo, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { PlayerAnimationAssignments, PlayerAnimationRole } from '../types/project';

const roles: Array<{ role: PlayerAnimationRole; label: string }> = [
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

export function PlayerAnimationPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const assets = useAssetStore((state) => state.assets);
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const object = useMemo(() => {
    const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId);
    return scene?.objects.find((candidate) => candidate.id === selectedObjectId);
  }, [project, selectedObjectId, selectedSceneId]);

  const asset = object?.assetId ? assets.find((candidate) => candidate.id === object.assetId) : undefined;

  useEffect(() => {
    let cancelled = false;
    if (object?.type !== 'player-spawn' || !asset || asset.category !== 'model') {
      setClipNames([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    void asset.blob.arrayBuffer()
      .then((data) => new GLTFLoader().parseAsync(data, ''))
      .then((gltf) => {
        if (cancelled) return;
        setClipNames(gltf.animations.map((clip, index) => clip.name || `Animação ${index + 1}`));
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[animation-assignment] falha ao ler animações do GLB', error);
        setClipNames([]);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [asset, object?.type]);

  if (object?.type !== 'player-spawn' || !object.assetId) return null;

  const assignments = object.animationAssignments ?? {};
  const assign = (role: PlayerAnimationRole, clipName: string) => {
    const next: PlayerAnimationAssignments = { ...assignments };
    if (clipName) next[role] = clipName;
    else delete next[role];
    updateObject(object.id, { animationAssignments: next });
  };

  return (
    <aside className="panel animation-assignment-panel">
      <h2>Animações do player</h2>
      <p className="panel-hint">Escolha manualmente qual animação do GLB executa cada ação. A ordem dos clips não é usada.</p>
      {status === 'loading' && <span>Lendo animações do GLB...</span>}
      {status === 'error' && <span>Não foi possível ler as animações deste GLB.</span>}
      {status === 'ready' && clipNames.length === 0 && <span>Este GLB não possui animações.</span>}
      {clipNames.length > 0 && roles.map(({ role, label }) => (
        <label key={role}>
          {label}
          <select value={assignments[role] ?? ''} onChange={(event) => assign(role, event.target.value)}>
            <option value="">Automático pelo nome</option>
            {clipNames.map((clipName, index) => (
              <option key={`${clipName}-${index}`} value={clipName}>{index + 1}. {clipName}</option>
            ))}
          </select>
        </label>
      ))}
    </aside>
  );
}
