import { useMemo, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { validateProject, type ValidationIssue } from '../validation/validateProject';

type SeverityFilter = 'all' | ValidationIssue['severity'];

const labels: Record<ValidationIssue['severity'], string> = { error: 'Erros', warning: 'Avisos', info: 'Informações' };
const icons: Record<ValidationIssue['severity'], string> = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

export function ProblemsPanel() {
  const state = useEditorStore();
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const validation = useMemo(() => validateProject(state.project), [state.project]);
  const counts = useMemo(() => ({
    error: validation.issues.filter(issue => issue.severity === 'error').length,
    warning: validation.issues.filter(issue => issue.severity === 'warning').length,
    info: validation.issues.filter(issue => issue.severity === 'info').length,
  }), [validation.issues]);
  const issues = filter === 'all' ? validation.issues : validation.issues.filter(issue => issue.severity === filter);

  const navigate = (issue: ValidationIssue) => {
    if (issue.sceneId) state.selectScene(issue.sceneId);
    if (issue.objectId) state.selectObject(issue.objectId);
  };

  const canFix = (issue: ValidationIssue) => ['MISSING_BACKGROUND_ASSET', 'MISSING_ASSET', 'OBJECT_OUTSIDE_SCENE', 'MISSING_GLOBAL_SPAWN'].includes(issue.code);
  const fix = (issue: ValidationIssue) => {
    if (issue.code === 'MISSING_GLOBAL_SPAWN') {
      const target = issue.sceneId ?? state.selectedSceneId ?? state.project.scenes[0]?.id;
      if (target) state.selectScene(target);
      state.addObject('player-spawn');
      return;
    }
    if (!issue.sceneId) return;
    const scene = state.project.scenes.find(item => item.id === issue.sceneId);
    if (!scene) return;
    if (issue.code === 'MISSING_BACKGROUND_ASSET') {
      state.updateScene(scene.id, { backgroundAssetId: null });
      return;
    }
    if (!issue.objectId) return;
    const object = scene.objects.find(item => item.id === issue.objectId);
    if (!object) return;
    if (issue.code === 'MISSING_ASSET') state.updateObject(object.id, { assetId: undefined });
    if (issue.code === 'OBJECT_OUTSIDE_SCENE') state.updateObject(object.id, { transform: { ...object.transform } });
  };

  return <aside className="panel problems-panel">
    <header><div><h2>Problemas</h2><span>{validation.issues.length} ocorrência(s)</span></div><strong className={counts.error ? 'has-errors' : ''}>{counts.error} erro(s)</strong></header>
    <div className="problem-filters">
      <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos {validation.issues.length}</button>
      <button className={filter === 'error' ? 'active error' : ''} onClick={() => setFilter('error')}>Erros {counts.error}</button>
      <button className={filter === 'warning' ? 'active warning' : ''} onClick={() => setFilter('warning')}>Avisos {counts.warning}</button>
      <button className={filter === 'info' ? 'active info' : ''} onClick={() => setFilter('info')}>Info {counts.info}</button>
    </div>
    <div className="problem-list">
      {issues.map((issue, index) => {
        const scene = issue.sceneId ? state.project.scenes.find(item => item.id === issue.sceneId) : undefined;
        const object = issue.objectId ? scene?.objects.find(item => item.id === issue.objectId) : undefined;
        return <article className={`problem-item ${issue.severity}`} key={`${issue.code}-${issue.sceneId ?? 'project'}-${issue.objectId ?? index}`}>
          <button className="problem-main" onClick={() => navigate(issue)}>
            <span className="problem-icon">{icons[issue.severity]}</span>
            <span><strong>{issue.code}</strong><em>{issue.message}</em><small>{object?.name ?? scene?.name ?? 'Projeto'}</small></span>
          </button>
          <div className="problem-actions"><button onClick={() => navigate(issue)}>Localizar</button>{canFix(issue) && <button onClick={() => fix(issue)}>Corrigir</button>}</div>
        </article>;
      })}
      {!issues.length && <div className="problem-empty">Nenhum item em {filter === 'all' ? 'problemas' : labels[filter].toLowerCase()}.</div>}
    </div>
  </aside>;
}
