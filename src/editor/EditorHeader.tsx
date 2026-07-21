import { useRef } from 'react';
import { exportProjectArchive, importProjectArchive } from '../persistence/projectArchive';
import { saveProject } from '../persistence/projectRepository';
import { useEditorStore } from '../state/editorStore';

export type StudioMode = 'edit' | 'test';

type EditorHeaderProps = {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
};

export function EditorHeader({ mode, onModeChange }: EditorHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { project, saveStatus, setProject, setSaveStatus, newProject, undo, redo, past, future } = useEditorStore();

  const save = async () => {
    setSaveStatus('Salvando...');
    try { await saveProject(project); setSaveStatus('Salvo'); } catch { setSaveStatus('Erro ao salvar'); }
  };

  const exportFile = async () => {
    const blob = await exportProjectArchive(project);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'projeto'}.elfuego`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openFile = async (file?: File) => {
    if (!file) return;
    try { setProject(await importProjectArchive(file), 'Alterações não salvas'); }
    catch { window.alert('Não foi possível abrir este projeto .elfuego.'); }
  };

  const createNew = () => {
    if (saveStatus === 'Alterações não salvas' && !window.confirm('Descartar as alterações não salvas e criar um projeto novo?')) return;
    newProject();
  };

  return (
    <header className="topbar">
      <div className="brand"><strong>El Fuego Studio</strong><span>{project.project.name}</span></div>
      <div className="header-center">
        <button disabled={!past.length || mode === 'test'} onClick={undo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button>
        <button disabled={!future.length || mode === 'test'} onClick={redo} title="Refazer (Ctrl+Y)" aria-label="Refazer">↷</button>
        <button className={`mode ${mode === 'edit' ? 'active' : ''}`} onClick={() => onModeChange('edit')}>Editar</button>
        <button className={`mode ${mode === 'test' ? 'active test-active' : ''}`} onClick={() => onModeChange('test')}>Testar</button>
      </div>
      <div className="actions">
        <input ref={inputRef} hidden type="file" accept=".elfuego" onChange={(event) => void openFile(event.target.files?.[0])} />
        <button type="button" className="header-action" onClick={createNew} disabled={mode === 'test'} title="Novo projeto" aria-label="Novo projeto"><span className="header-action-icon" aria-hidden="true">＋</span><span className="header-action-label">Novo</span></button>
        <button type="button" className="header-action" onClick={() => inputRef.current?.click()} disabled={mode === 'test'} title="Abrir projeto" aria-label="Abrir projeto"><span className="header-action-icon" aria-hidden="true">↥</span><span className="header-action-label">Abrir</span></button>
        <button type="button" className="header-action" onClick={() => void exportFile()} disabled={mode === 'test'} title="Exportar projeto" aria-label="Exportar projeto"><span className="header-action-icon" aria-hidden="true">↧</span><span className="header-action-label">Exportar</span></button>
        <button type="button" className="header-action primary" onClick={() => void save()} disabled={mode === 'test'} title="Salvar projeto" aria-label="Salvar projeto"><span className="header-action-icon" aria-hidden="true">✓</span><span className="header-action-label">Salvar</span></button>
      </div>
    </header>
  );
}
