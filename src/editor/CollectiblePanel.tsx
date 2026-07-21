import { useMemo } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { CollectibleKind } from '../types/project';

const kindLabels: Record<CollectibleKind, string> = {
  coin: 'Moeda ou pontuação',
  key: 'Chave',
  'story-item': 'Item da história',
  custom: 'Personalizado',
};

export function CollectiblePanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const assets = useAssetStore((state) => state.assets);
  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  const object = useMemo(() => scene.objects.find((candidate) => candidate.id === selectedObjectId), [scene, selectedObjectId]);

  if (!object || (object.type !== 'collectible' && object.type !== 'finish')) return null;

  const objectiveIds = [...new Set(project.scenes.flatMap((candidate) => candidate.objects)
    .filter((candidate) => candidate.type === 'collectible')
    .map((candidate) => candidate.collectibleObjectiveId?.trim())
    .filter((value): value is string => Boolean(value)))];

  if (object.type === 'finish') {
    const required = object.requiredCollectibleObjectiveIds ?? [];
    return <aside className="panel collectible-panel">
      <h2>Objetivos exigidos</h2>
      <p className="panel-hint">A saída só será liberada depois dos objetivos selecionados, mesmo que os itens estejam em cenas anteriores.</p>
      {objectiveIds.length === 0 && <p className="panel-hint">Nenhum colecionável possui ID de objetivo.</p>}
      <div className="checkbox-list">
        {objectiveIds.map((objectiveId) => <label key={objectiveId} className="checkbox-field">
          <input
            type="checkbox"
            checked={required.includes(objectiveId)}
            onChange={(event) => updateObject(object.id, {
              requiredCollectibleObjectiveIds: event.target.checked
                ? [...new Set([...required, objectiveId])]
                : required.filter((id) => id !== objectiveId),
            })}
          />
          {objectiveId}
        </label>)}
      </div>
    </aside>;
  }

  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith('image/'));
  return <aside className="panel collectible-panel">
    <h2>Colecionável</h2>
    <label>Tipo
      <select value={object.collectibleKind ?? 'coin'} onChange={(event) => updateObject(object.id, { collectibleKind: event.target.value as CollectibleKind })}>
        {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label>Nome exibido
      <input value={object.collectibleDisplayName ?? object.name} onChange={(event) => updateObject(object.id, { collectibleDisplayName: event.target.value })} />
    </label>
    <div className="field-grid">
      <label>Valor
        <input type="number" min="0" value={object.collectibleValue ?? 1} onChange={(event) => updateObject(object.id, { collectibleValue: Math.max(0, Number(event.target.value) || 0) })} />
      </label>
      <label>ID do objetivo
        <input value={object.collectibleObjectiveId ?? ''} placeholder="ex.: chave-prisao" onChange={(event) => updateObject(object.id, { collectibleObjectiveId: event.target.value || undefined })} />
      </label>
    </div>
    <label>Ícone
      <select value={object.collectibleIconAssetId ?? ''} onChange={(event) => updateObject(object.id, { collectibleIconAssetId: event.target.value || undefined })}>
        <option value="">Ícone padrão do tipo</option>
        {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
      </select>
    </label>
    <label className="checkbox-field">
      <input type="checkbox" checked={Boolean(object.collectibleRequired)} onChange={(event) => updateObject(object.id, { collectibleRequired: event.target.checked })} />
      Item obrigatório da cena
    </label>
  </aside>;
}
