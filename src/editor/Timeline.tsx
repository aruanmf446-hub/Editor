import { useEditorStore } from '../state/editorStore';

export function Timeline() {
  const { project, selectedSceneId, selectScene } = useEditorStore();
  return (
    <div className="timeline">
      <div className="timeline-track">
        {project.scenes.map((scene, index) => (
          <button key={scene.id} className={scene.id === selectedSceneId ? 'active' : ''} onClick={() => selectScene(scene.id)}>
            <span>{index + 1}</span>{scene.name}
          </button>
        ))}
      </div>
    </div>
  );
}
