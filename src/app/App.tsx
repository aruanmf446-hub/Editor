import { useMemo, useState } from 'react';
import { createEmptyProject } from '../project/projectFactory';
import { exportProjectArchive } from '../persistence/projectArchive';
import { saveProject } from '../persistence/projectRepository';
import { validateProject } from '../validation/validateProject';

export function App() {
  const [project, setProject] = useState(() => createEmptyProject('Minha primeira fase'));
  const [status, setStatus] = useState('Alterações não salvas');
  const validation = useMemo(() => validateProject(project), [project]);

  const renameProject = (name: string) => {
    setProject((current) => ({ ...current, project: { ...current.project, name } }));
    setStatus('Alterações não salvas');
  };

  const handleSave = async () => {
    setStatus('Salvando...');
    try { await saveProject(project); setStatus('Salvo'); }
    catch { setStatus('Erro ao salvar'); }
  };

  const handleExport = async () => {
    const blob = await exportProjectArchive(project);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.elfuego`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><strong>El Fuego Studio</strong><span>Fundação técnica</span></div>
        <div className="actions"><button type="button" onClick={handleExport}>Exportar</button><button type="button" className="primary" onClick={handleSave}>Salvar</button></div>
      </header>
      <section className="workspace">
        <aside className="panel scenes-panel"><h2>Cenas</h2>{project.scenes.map((scene) => <button className="scene active" key={scene.id}>{scene.name}</button>)}</aside>
        <section className="canvas-area"><div className="canvas-placeholder"><div className="flame">🔥</div><h1>Fundação pronta</h1><p>O canvas visual e o runtime serão conectados após a recuperação e análise do código original.</p></div></section>
        <aside className="panel inspector"><h2>Projeto</h2><label>Nome<input value={project.project.name} onChange={(event) => renameProject(event.target.value)} /></label><dl><div><dt>Formato</dt><dd>{project.format}</dd></div><div><dt>Versão</dt><dd>{project.version}</dd></div><div><dt>Cenas</dt><dd>{project.scenes.length}</dd></div><div><dt>Objetos</dt><dd>{project.scenes.reduce((total, scene) => total + scene.objects.length, 0)}</dd></div></dl><div className={validation.valid ? 'validation ok' : 'validation error'}>{validation.valid ? 'Projeto estruturalmente válido' : 'Projeto inválido'}</div></aside>
      </section>
      <footer className="statusbar"><span>{status}</span><span>IndexedDB · .elfuego · validação Zod</span></footer>
    </main>
  );
}