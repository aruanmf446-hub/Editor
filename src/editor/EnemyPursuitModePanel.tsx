import { useEditorStore } from '../state/editorStore';
import type { SceneObjectBase } from '../types/project';

type PursuitVillain = SceneObjectBase<'enemy-cactus'> & { pursuitMode?: boolean };

export function EnemyPursuitModePanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];
  const selected = scene?.objects.find((item) => item.id === selectedObjectId);
  if (!selected || selected.type !== 'enemy-cactus') return null;

  const villain = selected as PursuitVillain;
  const enabled = Boolean(villain.pursuitMode);

  return <section className="panel pursuit-mode-panel">
    <div className="panel-title-row">
      <div>
        <h2>Modo perseguição</h2>
        <span>O vilão espera até enxergar o player e depois corre atrás dele.</span>
      </div>
    </div>
    <label className="checkbox-field pursuit-mode-toggle">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => {
          const pursuitMode = event.target.checked;
          updateObject(villain.id, {
            pursuitMode,
            walkSpeed: pursuitMode ? 0 : (villain.walkSpeed || 70),
          } as Partial<SceneObjectBase>);
        }}
      />
      Ativar modo perseguição
    </label>
    {enabled && <p className="panel-hint">No cenário será exibido somente o campo de visão. Ao entrar nessa área, o player passa a ser perseguido.</p>}
  </section>;
}
