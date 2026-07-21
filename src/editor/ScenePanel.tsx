import { useEditorStore } from '../state/editorStore';

export function ScenePanel() {
  const { project, selectedSceneId, selectScene, addScene, duplicateScene, deleteScene, moveScene } = useEditorStore();

  return (
    <aside className="panel scenes-panel">
      <div className="panel-title-row"><h2>Cenas · plano sequência</h2><button className="icon-button" onClick={addScene} title="Nova cena">＋</button></div>
      <div className="scene-list scene-sequence-strip">
        {project.scenes.map((scene, index) => (
          <div className={`scene-row ${scene.id === selectedSceneId ? 'active' : ''}`} key={scene.id}>
            <button className="scene-select" onClick={() => selectScene(scene.id)}><span>{index + 1}</span><strong>{scene.name}</strong></button>
            <div className="scene-actions">
              <button onClick={() => moveScene(scene.id, -1)} disabled={index === 0} title="Mover para esquerda">←</button>
              <button onClick={() => moveScene(scene.id, 1)} disabled={index === project.scenes.length - 1} title="Mover para direita">→</button>
              <button onClick={() => duplicateScene(scene.id)} title="Duplicar">⧉</button>
              <button onClick={() => deleteScene(scene.id)} disabled={project.scenes.length === 1} title="Excluir">×</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
