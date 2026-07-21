import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';
import type { TriggerAction } from '../types/project';

const actionLabels: Record<TriggerAction['type'], string> = {
  'set-object-visible': 'Mostrar ou esconder objeto',
  'set-collision-enabled': 'Ativar ou desativar colisão',
  'activate-enemy': 'Ativar ou desativar inimigo',
  'start-dialogue': 'Iniciar diálogo',
  'set-camera': 'Alterar câmera temporariamente',
  'transition-scene': 'Mudar de cena',
  'set-variable': 'Definir variável',
};

function defaultAction(type: TriggerAction['type'], targetObjectId = '', targetSceneId = ''): TriggerAction {
  const id = crypto.randomUUID();
  if (type === 'set-object-visible') return { id, type, targetObjectId, visible: true };
  if (type === 'set-collision-enabled') return { id, type, targetObjectId, enabled: true };
  if (type === 'activate-enemy') return { id, type, targetObjectId, active: true };
  if (type === 'start-dialogue') return { id, type, targetObjectId };
  if (type === 'set-camera') return { id, type, x: 0, y: 0, durationMs: 1500 };
  if (type === 'transition-scene') return { id, type, targetSceneId };
  return { id, type: 'set-variable', key: 'evento', value: 'ativo' };
}

export function TriggerActionsPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);

  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  const trigger = useMemo(() => scene.objects.find((object) => object.id === selectedObjectId && object.type === 'trigger'), [scene, selectedObjectId]);
  if (!trigger) return null;

  const actions = trigger.triggerActions ?? [];
  const genericTargets = scene.objects.filter((object) => object.id !== trigger.id);
  const collisionTargets = genericTargets.filter((object) => object.type === 'platform' || object.type === 'wall' || object.type === 'obstacle');
  const enemyTargets = genericTargets.filter((object) => object.type === 'enemy-cactus' || object.type === 'boss');
  const dialogueTargets = genericTargets.filter((object) => object.type === 'dialogue-zone');
  const save = (next: TriggerAction[]) => updateObject(trigger.id, { triggerActions: next });
  const replace = (index: number, nextAction: TriggerAction) => save(actions.map((action, current) => current === index ? nextAction : action));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };
  const objectOptions = (targets: typeof genericTargets) => <>{targets.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</>;

  return <aside className="panel trigger-actions-panel">
    <h2>Ações do gatilho</h2>
    <p className="panel-hint">As ações são executadas na ordem quando o player entra na área.</p>
    {actions.map((action, index) => <fieldset key={action.id} className="compact-config-card">
      <legend>Ação {index + 1}</legend>
      <label>Tipo
        <select value={action.type} onChange={(event) => replace(index, defaultAction(event.target.value as TriggerAction['type'], genericTargets[0]?.id, project.scenes[0]?.id))}>
          {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      {action.type === 'set-object-visible' && <>
        <label>Objeto<select value={action.targetObjectId} onChange={(event) => replace(index, { ...action, targetObjectId: event.target.value })}><option value="">Selecione...</option>{objectOptions(genericTargets)}</select></label>
        <label className="checkbox-field"><input type="checkbox" checked={action.visible} onChange={(event) => replace(index, { ...action, visible: event.target.checked })} />Deixar visível</label>
      </>}
      {action.type === 'set-collision-enabled' && <>
        <label>Colisor<select value={action.targetObjectId} onChange={(event) => replace(index, { ...action, targetObjectId: event.target.value })}><option value="">Selecione...</option>{objectOptions(collisionTargets)}</select></label>
        <label className="checkbox-field"><input type="checkbox" checked={action.enabled} onChange={(event) => replace(index, { ...action, enabled: event.target.checked })} />Colisão ativa</label>
      </>}
      {action.type === 'activate-enemy' && <>
        <label>Inimigo<select value={action.targetObjectId} onChange={(event) => replace(index, { ...action, targetObjectId: event.target.value })}><option value="">Selecione...</option>{objectOptions(enemyTargets)}</select></label>
        <label className="checkbox-field"><input type="checkbox" checked={action.active} onChange={(event) => replace(index, { ...action, active: event.target.checked })} />Inimigo ativo</label>
      </>}
      {action.type === 'start-dialogue' && <label>Diálogo<select value={action.targetObjectId} onChange={(event) => replace(index, { ...action, targetObjectId: event.target.value })}><option value="">Selecione...</option>{objectOptions(dialogueTargets)}</select></label>}
      {action.type === 'set-camera' && <div className="field-grid">
        <label>Câmera X<input type="number" value={action.x} onChange={(event) => replace(index, { ...action, x: Number(event.target.value) || 0 })} /></label>
        <label>Câmera Y<input type="number" value={action.y} onChange={(event) => replace(index, { ...action, y: Number(event.target.value) || 0 })} /></label>
        <label>Duração ms<input type="number" min="0" value={action.durationMs} onChange={(event) => replace(index, { ...action, durationMs: Math.max(0, Number(event.target.value) || 0) })} /></label>
      </div>}
      {action.type === 'transition-scene' && <label>Cena<select value={action.targetSceneId} onChange={(event) => replace(index, { ...action, targetSceneId: event.target.value })}><option value="">Selecione...</option>{project.scenes.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>}
      {action.type === 'set-variable' && <div className="field-grid">
        <label>Variável<input value={action.key} onChange={(event) => replace(index, { ...action, key: event.target.value })} /></label>
        <label>Valor<input value={String(action.value)} onChange={(event) => replace(index, { ...action, value: event.target.value })} /></label>
      </div>}

      <div className="inline-actions">
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Subir</button>
        <button type="button" disabled={index === actions.length - 1} onClick={() => move(index, 1)}>Descer</button>
        <button type="button" onClick={() => save(actions.filter((_, current) => current !== index))}>Remover</button>
      </div>
    </fieldset>)}
    <button type="button" onClick={() => save([...actions, defaultAction('set-variable')])}>Adicionar ação</button>
  </aside>;
}
