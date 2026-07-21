import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';

export function EnemyActivationPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const enemy = useMemo(() => project.scenes
    .find((scene) => scene.id === selectedSceneId)?.objects
    .find((object) => object.id === selectedObjectId && (object.type === 'enemy-cactus' || object.type === 'boss')),
  [project, selectedObjectId, selectedSceneId]);

  if (!enemy) return null;
  return <aside className="panel enemy-activation-panel">
    <h2>Ativação</h2>
    <label className="checkbox-field">
      <input type="checkbox" checked={enemy.enemyActiveAtStart ?? true} onChange={(event) => updateObject(enemy.id, { enemyActiveAtStart: event.target.checked })} />
      Ativo quando a cena começa
    </label>
    <p className="panel-hint">Desative para fazer um gatilho iniciar este inimigo ou boss depois.</p>
  </aside>;
}
