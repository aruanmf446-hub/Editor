import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';
import { validateProject } from '../validation/validateProject';

export function Inspector() {
  const { project, selectedSceneId, selectedObjectId, renameProject, updateScene, updateObject } = useEditorStore();
  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];
  const object = scene.objects.find((item) => item.id === selectedObjectId);
  const validation = useMemo(() => validateProject(project), [project]);

  return (
    <aside className="panel inspector">
      <h2>Propriedades</h2>
      <label>Projeto<input value={project.project.name} onChange={(event) => renameProject(event.target.value)} /></label>
      {object ? (
        <div className="inspector-section">
          <h3>Objeto selecionado</h3>
          <label>Nome<input value={object.name} onChange={(event) => updateObject(object.id, { name: event.target.value })} /></label>
          <div className="field-grid">
            {(['x','y','width','height','rotation'] as const).map((field) => <label key={field}>{field.toUpperCase()}<input type="number" value={object.transform[field]} onChange={(event) => updateObject(object.id, { transform: { ...object.transform, [field]: Number(event.target.value) } })} /></label>)}
          </div>
          <dl><div><dt>Tipo</dt><dd>{object.type}</dd></div><div><dt>Visível</dt><dd>{object.visible ? 'Sim' : 'Não'}</dd></div><div><dt>Bloqueado</dt><dd>{object.locked ? 'Sim' : 'Não'}</dd></div></dl>
        </div>
      ) : (
        <div className="inspector-section">
          <h3>Cena selecionada</h3>
          <label>Nome<input value={scene.name} onChange={(event) => updateScene(scene.id, { name: event.target.value })} /></label>
          <div className="field-grid"><label>Largura<input type="number" min="320" max="20000" value={scene.width} onChange={(event) => updateScene(scene.id, { width: Number(event.target.value) })} /></label><label>Altura<input type="number" min="180" max="12000" value={scene.height} onChange={(event) => updateScene(scene.id, { height: Number(event.target.value) })} /></label></div>
          <dl><div><dt>Ordem</dt><dd>{scene.order + 1}</dd></div><div><dt>Objetos</dt><dd>{scene.objects.length}</dd></div><div><dt>Cenário</dt><dd>{scene.backgroundAssetId ? 'Importado' : 'Nenhum'}</dd></div></dl>
        </div>
      )}
      <div className={validation.valid ? 'validation ok' : 'validation error'}>{validation.valid ? 'Projeto estruturalmente válido' : `${validation.issues.length} erro(s) no projeto`}</div>
    </aside>
  );
}
