import { useEditorStore } from '../state/editorStore';

export function EditorCanvas() {
  const { project, selectedSceneId, zoom, setZoom, gridEnabled } = useEditorStore();
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];

  return (
    <section className={`canvas-area ${gridEnabled ? 'grid-enabled' : ''}`}>
      <div className="canvas-scroll">
        <div
          className="scene-canvas"
          style={{ width: scene.width * zoom, height: scene.height * zoom }}
          aria-label={`Canvas da cena ${scene.name}`}
        >
          <div className="scene-canvas-label"><strong>{scene.name}</strong><span>{scene.width} × {scene.height}</span></div>
          <div className="empty-scene"><span>Área vazia</span><small>Use as ferramentas para construir esta cena.</small></div>
        </div>
      </div>
      <div className="zoom-control">
        <button onClick={() => setZoom(zoom - 0.1)}>−</button>
        <input aria-label="Zoom" type="range" min="0.2" max="1.2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        <button onClick={() => setZoom(zoom + 0.1)}>＋</button>
      </div>
    </section>
  );
}
