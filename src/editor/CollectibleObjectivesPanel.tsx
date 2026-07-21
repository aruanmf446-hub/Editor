import { useEditorStore } from '../state/editorStore';
import type { CollectibleDefinition, CompletionCondition, SceneObjectBase } from '../types/project';

const id = () => crypto.randomUUID();

function defaultCollectible(object: SceneObjectBase): CollectibleDefinition {
  return {
    id: object.id,
    kind: 'coin',
    displayName: object.name || 'Colecionável',
    value: 1,
    collectOnce: true,
    required: false,
    respawnable: false,
    actions: [],
  };
}

function defaultCondition(type: CompletionCondition['type']): CompletionCondition {
  if (type === 'boss-defeated') return { id: id(), type };
  if (type === 'collectible-count') return { id: id(), type, collectibleId: '', minimum: 1 };
  if (type === 'variable') return { id: id(), type, key: '', value: true };
  if (type === 'dialogue-completed') return { id: id(), type, targetObjectId: '' };
  return { id: id(), type: 'required-enemies-defeated' };
}

export function CollectibleObjectivesPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  const object = scene?.objects.find((candidate) => candidate.id === selectedObjectId);

  if (!object || (object.type !== 'collectible' && object.type !== 'finish')) return null;

  if (object.type === 'collectible') {
    const collectible = object.collectible ?? defaultCollectible(object);
    const save = (patch: Partial<CollectibleDefinition>) => updateObject(object.id, { collectible: { ...collectible, ...patch } });
    return <aside className="panel">
      <h2>Colecionável</h2>
      <label>ID<input value={collectible.id} onChange={(event) => save({ id: event.target.value })} /></label>
      <label>Nome<input value={collectible.displayName} onChange={(event) => save({ displayName: event.target.value })} /></label>
      <label>Tipo<select value={collectible.kind} onChange={(event) => save({ kind: event.target.value as CollectibleDefinition['kind'] })}>
        <option value="coin">Moeda</option><option value="key">Chave</option><option value="story">Item de história</option><option value="resource">Recurso</option><option value="quest">Item de missão</option>
      </select></label>
      <label>Descrição<textarea value={collectible.description ?? ''} onChange={(event) => save({ description: event.target.value })} /></label>
      <label>Valor<input type="number" min="1" value={collectible.value} onChange={(event) => save({ value: Math.max(1, Number(event.target.value)) })} /></label>
      <label>Objetivo relacionado<input value={collectible.objectiveId ?? ''} onChange={(event) => save({ objectiveId: event.target.value || undefined })} /></label>
      <label>Asset do ícone<select value={collectible.iconAssetId ?? ''} onChange={(event) => save({ iconAssetId: event.target.value || undefined })}><option value="">Ícone padrão</option>{project.assets.filter((asset) => asset.category === 'texture' || asset.category === 'thumbnail' || asset.category === 'background').map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      <label className="checkbox-field"><input type="checkbox" checked={Boolean(collectible.required)} onChange={(event) => save({ required: event.target.checked })} />Obrigatório</label>
      <label className="checkbox-field"><input type="checkbox" checked={collectible.collectOnce !== false} onChange={(event) => save({ collectOnce: event.target.checked })} />Registrar apenas uma vez</label>
      <label className="checkbox-field"><input type="checkbox" checked={Boolean(collectible.respawnable)} onChange={(event) => save({ respawnable: event.target.checked })} />Permitir reaparecimento</label>
      {collectible.respawnable && <label>Tempo para reaparecer (ms)<input type="number" min="250" value={collectible.respawnDelayMs ?? 3000} onChange={(event) => save({ respawnDelayMs: Math.max(250, Number(event.target.value)) })} /></label>}
      <p className="panel-hint">As ações executadas ao coletar usam a mesma estrutura tipada dos gatilhos e são preservadas na importação/exportação.</p>
    </aside>;
  }

  const conditions = object.completionConditions ?? [];
  const saveConditions = (next: CompletionCondition[]) => updateObject(object.id, { completionConditions: next });
  const addCondition = (type: CompletionCondition['type']) => saveConditions([...conditions, defaultCondition(type)]);
  const patchCondition = (conditionId: string, patch: Partial<CompletionCondition>) => saveConditions(conditions.map((condition) => condition.id === conditionId ? { ...condition, ...patch } as CompletionCondition : condition));

  return <aside className="panel">
    <h2>Objetivos da fase</h2>
    <label>Lógica<select value={object.completionLogic ?? 'all'} onChange={(event) => updateObject(object.id, { completionLogic: event.target.value as 'all' | 'any' })}><option value="all">Cumprir todos</option><option value="any">Cumprir qualquer um</option></select></label>
    {conditions.map((condition, index) => <fieldset className="compact-config-card" key={condition.id}>
      <legend>Condição {index + 1}</legend>
      <label>Tipo<select value={condition.type} onChange={(event) => saveConditions(conditions.map((candidate) => candidate.id === condition.id ? defaultCondition(event.target.value as CompletionCondition['type']) : candidate))}>
        <option value="boss-defeated">Boss derrotado</option><option value="collectible-count">Quantidade coletada</option><option value="variable">Variável da história</option><option value="dialogue-completed">Diálogo concluído</option><option value="required-enemies-defeated">Inimigos obrigatórios derrotados</option>
      </select></label>
      {condition.type === 'boss-defeated' && <label>Boss<select value={condition.targetObjectId ?? ''} onChange={(event) => patchCondition(condition.id, { targetObjectId: event.target.value || undefined })}><option value="">Qualquer boss</option>{scene.objects.filter((candidate) => candidate.type === 'boss').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>}
      {condition.type === 'collectible-count' && <><label>ID do colecionável<input value={condition.collectibleId} onChange={(event) => patchCondition(condition.id, { collectibleId: event.target.value })} /></label><label>Quantidade mínima<input type="number" min="1" value={condition.minimum} onChange={(event) => patchCondition(condition.id, { minimum: Math.max(1, Number(event.target.value)) })} /></label></>}
      {condition.type === 'variable' && <><label>Variável<input value={condition.key} onChange={(event) => patchCondition(condition.id, { key: event.target.value })} /></label><label>Valor<input value={String(condition.value)} onChange={(event) => patchCondition(condition.id, { value: event.target.value })} /></label></>}
      {condition.type === 'dialogue-completed' && <label>Diálogo<select value={condition.targetObjectId} onChange={(event) => patchCondition(condition.id, { targetObjectId: event.target.value })}><option value="">Selecione...</option>{scene.objects.filter((candidate) => candidate.type === 'dialogue-zone').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>}
      <button type="button" onClick={() => saveConditions(conditions.filter((candidate) => candidate.id !== condition.id))}>Remover condição</button>
    </fieldset>)}
    <div className="button-grid">
      <button type="button" onClick={() => addCondition('boss-defeated')}>+ Boss</button>
      <button type="button" onClick={() => addCondition('collectible-count')}>+ Colecionável</button>
      <button type="button" onClick={() => addCondition('variable')}>+ Variável</button>
      <button type="button" onClick={() => addCondition('dialogue-completed')}>+ Diálogo</button>
      <button type="button" onClick={() => addCondition('required-enemies-defeated')}>+ Inimigos</button>
    </div>
  </aside>;
}