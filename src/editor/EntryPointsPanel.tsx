import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';

export function EntryPointsPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  const object = useMemo(() => scene.objects.find((candidate) => candidate.id === selectedObjectId), [scene, selectedObjectId]);
  if (!object || (object.type !== 'player-spawn' && object.type !== 'finish')) return null;

  if (object.type === 'player-spawn') return <aside className="panel entry-points-panel">
    <h2>Entrada da cena</h2>
    <label>Identificador
      <input value={object.entryId ?? ''} placeholder="ex.: entrada-esquerda" onChange={(event) => updateObject(object.id, { entryId: event.target.value || undefined })} />
    </label>
    <label className="checkbox-field"><input type="checkbox" checked={Boolean(object.defaultEntry)} onChange={(event) => updateObject(object.id, { defaultEntry: event.target.checked })} />Entrada padrão desta cena</label>
    <p className="panel-hint">Portas, gatilhos e fins de fase podem enviar o player diretamente para este ponto.</p>
  </aside>;

  const ordered = [...project.scenes].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((candidate) => candidate.id === scene.id);
  const targetScene = (object.endingMode ?? 'next-scene') === 'target-scene'
    ? project.scenes.find((candidate) => candidate.id === object.targetSceneId)
    : ordered[currentIndex + 1];
  const entries = targetScene?.objects.filter((candidate) => candidate.type === 'player-spawn') ?? [];

  return <aside className="panel entry-points-panel">
    <h2>Entrada de destino</h2>
    {!targetScene && <p className="panel-hint">Esta saída conclui o jogo ou ainda não possui uma cena de destino.</p>}
    {targetScene && <label>Ponto de entrada
      <select value={object.targetEntryId ?? ''} onChange={(event) => updateObject(object.id, { targetEntryId: event.target.value || undefined })}>
        <option value="">Entrada padrão de {targetScene.name}</option>
        {entries.map((entry) => <option key={entry.id} value={entry.entryId ?? ''}>{entry.entryId || entry.name}</option>)}
      </select>
    </label>}
  </aside>;
}
