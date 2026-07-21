import { useEditorStore } from '../state/editorStore';

const symbols: Record<string, string> = { decoration: '◆', obstacle: '▰', checkpoint: '⚑', trigger: '◎', collectible: '✦' };

export function EditorCanvas() {
  const { project, selectedSceneId, selectedObjectId, selectObject, zoom, setZoom, gridEnabled } = useEditorStore();
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];

  return (
    <section className={`canvas-area ${gridEnabled ? 'grid-enabled' : ''}`} onClick={() => selectObject(null)}>
      <div className="canvas-scroll">
        <div className="scene-canvas" style={{ width: scene.width * zoom, height: scene.height * zoom }} aria-label={`Canvas da cena ${scene.name}`}>
          <div className="scene-canvas-label"><strong>{scene.name}</strong><span>{scene.width} × {scene.height}</span></div>
          {scene.objects.length === 0 && <div className="empty-scene"><span>Área vazia</span><small>Use as ferramentas para construir esta cena.</small></div>}
          {scene.objects.filter((object) => object.visible).map((object) => (
            <button
              key={object.id}
              className={`canvas-object ${selectedObjectId === object.id ? 'selected' : ''} ${object.locked ? 'locked' : ''}`}
              style={{ left: object.transform.x * zoom, top: object.transform.y * zoom, width: object.transform.width * zoom, height: object.transform.height * zoom, transform: `rotate(${object.transform.rotation}deg)` }}
              onClick={(event) => { event.stopPropagation(); selectObject(object.id); }}
              title={object.name}
            >
              <span>{symbols[object.type] ?? '■'}</span><small>{object.name}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="zoom-control"><button onClick={() => setZoom(zoom - 0.1)}>−</button><input aria-label="Zoom" type="range" min="0.2" max="1.2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><button onClick={() => setZoom(zoom + 0.1)}>＋</button></div>
    </section>
  );
}