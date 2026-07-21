import { useMemo } from 'react';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { DialogueAdvanceMode, DialogueLine } from '../types/project';

export function DialogueEditorPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const assets = useAssetStore((state) => state.assets);

  const object = useMemo(() => project.scenes
    .find((scene) => scene.id === selectedSceneId)?.objects
    .find((candidate) => candidate.id === selectedObjectId && candidate.type === 'dialogue-zone'),
  [project, selectedObjectId, selectedSceneId]);

  if (!object) return null;
  const lines = object.dialogueLines ?? [];
  const portraits = assets.filter((asset) => asset.mimeType.startsWith('image/'));
  const save = (next: DialogueLine[]) => updateObject(object.id, { dialogueLines: next });
  const updateLine = (index: number, patch: Partial<DialogueLine>) => save(lines.map((line, current) => current === index ? { ...line, ...patch } : line));
  const moveLine = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };

  return <aside className="panel dialogue-editor-panel">
    <h2>Diálogo</h2>
    <p className="panel-hint">Crie a fala inicial da história ou conversas completas entre personagens.</p>
    <label>Avanço
      <select value={object.dialogueAdvanceMode ?? 'manual'} onChange={(event) => updateObject(object.id, { dialogueAdvanceMode: event.target.value as DialogueAdvanceMode })}>
        <option value="manual">Botão, Enter ou Espaço</option>
        <option value="auto">Automático pela duração</option>
        <option value="both">Manual ou automático</option>
      </select>
    </label>
    <label className="checkbox-field"><input type="checkbox" checked={object.dialogueBlockPlayer ?? true} onChange={(event) => updateObject(object.id, { dialogueBlockPlayer: event.target.checked })} />Bloquear o player durante a conversa</label>
    <label className="checkbox-field"><input type="checkbox" checked={Boolean(object.dialogueOnce)} onChange={(event) => updateObject(object.id, { dialogueOnce: event.target.checked })} />Executar somente uma vez</label>

    {lines.length === 0 && <p className="panel-hint">Sem falas próprias, esta área continua funcionando como aviso simples usando o nome do objeto.</p>}
    {lines.map((line, index) => <fieldset key={line.id} className="compact-config-card">
      <legend>Fala {index + 1}</legend>
      <label>Personagem<input value={line.speaker} onChange={(event) => updateLine(index, { speaker: event.target.value })} /></label>
      <label>Texto<textarea rows={3} value={line.text} onChange={(event) => updateLine(index, { text: event.target.value })} /></label>
      <div className="field-grid">
        <label>Duração ms<input type="number" min="250" value={line.durationMs ?? 2500} onChange={(event) => updateLine(index, { durationMs: Math.max(250, Number(event.target.value) || 2500) })} /></label>
        <label>Retrato
          <select value={line.portraitAssetId ?? ''} onChange={(event) => updateLine(index, { portraitAssetId: event.target.value || undefined })}>
            <option value="">Sem retrato</option>
            {portraits.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>
      </div>
      <div className="inline-actions">
        <button type="button" disabled={index === 0} onClick={() => moveLine(index, -1)}>Subir</button>
        <button type="button" disabled={index === lines.length - 1} onClick={() => moveLine(index, 1)}>Descer</button>
        <button type="button" onClick={() => save(lines.filter((_, current) => current !== index))}>Remover</button>
      </div>
    </fieldset>)}
    <button type="button" onClick={() => save([...lines, { id: crypto.randomUUID(), speaker: '', text: '', durationMs: 2500 }])}>Adicionar fala</button>
  </aside>;
}
