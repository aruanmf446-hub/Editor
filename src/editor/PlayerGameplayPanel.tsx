import { useEditorStore } from '../state/editorStore';

export function PlayerGameplayPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const scene = project.scenes.find((candidate) => candidate.id === selectedSceneId) ?? project.scenes[0];
  const object = scene?.objects.find((candidate) => candidate.id === selectedObjectId);

  if (!object || object.type !== 'player-spawn') return null;

  return <aside className="panel">
    <h2>Movimento do player</h2>
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={Boolean(object.doubleJumpEnabled)}
        onChange={(event) => updateObject(object.id, { doubleJumpEnabled: event.target.checked })}
      />
      Permitir pulo duplo
    </label>
    <p className="panel-hint">Quando ativo, o player pode saltar mais uma vez antes de tocar no chão.</p>
    <p className="panel-hint">Cair para fora do mapa ou perder toda a vida encerra o teste.</p>
  </aside>;
}
