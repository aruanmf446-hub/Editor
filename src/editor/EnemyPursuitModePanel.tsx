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
        <span>O vilão caminha na faixa de visão e corre atrás do player ao detectá-lo.</span>
      </div>
    </div>
    <label className="checkbox-field pursuit-mode-toggle">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => {
          const pursuitMode = event.target.checked;
          const vision = Math.max(0, villain.visionDistance ?? 420);
          const centerX = villain.transform.x + villain.transform.width / 2;
          const maxX = Math.max(0, scene.width - villain.transform.width);
          const patrolLeft = Math.max(0, Math.min(maxX, centerX - vision));
          const patrolRight = Math.max(patrolLeft, Math.min(maxX, centerX + vision - villain.transform.width));
          updateObject(villain.id, {
            pursuitMode,
            walkSpeed: villain.walkSpeed || 70,
            ...(pursuitMode ? { patrolLeft, patrolRight } : {}),
          } as Partial<SceneObjectBase>);
        }}
      />
      Ativar modo perseguição
    </label>
    {enabled && <p className="panel-hint">A mesma faixa azul define onde o vilão anda e até onde ele enxerga. Ao detectar o player, ele passa a persegui-lo.</p>}
  </section>;
}
