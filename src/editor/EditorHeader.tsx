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
        <button disabled={!past.length || mode === 'test'} onClick={undo} title="Desfazer (Ctrl+Z)">↶</button>
        <button disabled={!future.length || mode === 'test'} onClick={redo} title="Refazer (Ctrl+Y)">↷</button>
        <button className={`mode ${mode === 'edit' ? 'active' : ''}`} onClick={() => onModeChange('edit')}>Editar</button>
        <button className={`mode ${mode === 'test' ? 'active test-active' : ''}`} onClick={() => onModeChange('test')}>Testar</button>
      </div>
      <div className="actions">
        <input ref={inputRef} hidden type="file" accept=".elfuego" onChange={(event) => void openFile(event.target.files?.[0])} />
        <button type="button" onClick={createNew} disabled={mode === 'test'}>Novo</button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={mode === 'test'}>Abrir</button>
        <button type="button" onClick={() => void exportFile()} disabled={mode === 'test'}>Exportar</button>
        <button type="button" className="primary" onClick={() => void save()} disabled={mode === 'test'}>Salvar</button>
      </div>
    </header>
  );
}
