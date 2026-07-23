import { useEffect, useState } from 'react';
import { saveProject } from '../persistence/projectRepository';
import { RuntimeGame } from '../runtime/RuntimeGame';
import { useEditorStore } from '../state/editorStore';
import { AssetLibrary } from './AssetLibrary';
import { BossCombatPanel } from './BossCombatPanel';
import { CampaignPanel } from './CampaignPanel';
import { CollectibleObjectivesPanel } from './CollectibleObjectivesPanel';
import { DialogueEditorPanel } from './DialogueEditorPanel';
import { EditorCanvas } from './EditorCanvas';
import { EditorHeader, type StudioMode } from './EditorHeader';
import { EditorToolbar } from './EditorToolbar';
import { EnemyActivationPanel } from './EnemyActivationPanel';
import { EntryPointsPanel } from './EntryPointsPanel';
import { Inspector } from './Inspector';
import { ModelAssetPanel } from './ModelAssetPanel';
import { ObjectTree } from './ObjectTree';
import { PlayerAnimationPanel } from './PlayerAnimationPanel';
import { PlayerGameplayPanel } from './PlayerGameplayPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { ScenePanel } from './ScenePanel';
import { StatusBar } from './StatusBar';
import { TriggerActionsPanel } from './TriggerActionsPanel';

const isTyping = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
type ResponsivePanel = 'canvas' | 'objects' | 'assets' | 'properties' | 'problems';
const responsivePanels: Array<{ id: ResponsivePanel; icon: string; label: string }> = [
  { id: 'canvas', icon: '▣', label: 'Canvas' },
  { id: 'objects', icon: '☷', label: 'Objetos' },
  { id: 'assets', icon: '◇', label: 'Assets' },
  { id: 'properties', icon: '⚙', label: 'Propriedades' },
  { id: 'problems', icon: '!', label: 'Problemas' },
];

export function EditorShell() {
  const [mode, setMode] = useState<StudioMode>('edit');
  const [responsivePanel, setResponsivePanel] = useState<ResponsivePanel>('canvas');
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useEditorStore.getState();
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (event.key === 'Escape' && mode === 'test') { event.preventDefault(); setMode('edit'); return; }
      if (mode === 'test') return;
      if (command && key === 's') {
        event.preventDefault(); state.setSaveStatus('Salvando...');
        void saveProject(state.project).then(() => state.setSaveStatus('Salvo')).catch(() => state.setSaveStatus('Erro ao salvar'));
      } else if (command && key === 'z') {
        event.preventDefault(); if (event.shiftKey) state.redo(); else state.undo();
      } else if (command && key === 'y') {
        event.preventDefault(); state.redo();
      } else if (!isTyping(event.target) && command && key === 'a') {
        event.preventDefault(); state.selectAllObjects();
      } else if (!isTyping(event.target) && command && key === 'c') {
        event.preventDefault(); state.copySelected();
      } else if (!isTyping(event.target) && command && key === 'v') {
        event.preventDefault(); state.pasteClipboard();
      } else if (!isTyping(event.target) && command && key === 'd') {
        event.preventDefault(); state.duplicateSelected();
      } else if (!isTyping(event.target) && (event.key === 'Delete' || event.key === 'Backspace') && state.selectedObjectIds.length) {
        event.preventDefault(); state.deleteSelected();
      } else if (!isTyping(event.target) && state.selectedObjectIds.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        state.moveSelected(dx, dy);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  if (mode === 'test') return <main className="app-shell mode-test"><EditorHeader mode={mode} onModeChange={setMode} /><RuntimeGame onExit={() => setMode('edit')} /></main>;
  return <main className="app-shell mode-edit">
    <EditorHeader mode={mode} onModeChange={setMode} />
    <EditorToolbar />
    <section className="workspace">
      <ScenePanel />
      <nav className="responsive-panel-tabs" aria-label="Painéis do editor">
        {responsivePanels.map((panel) => <button type="button" key={panel.id} className={responsivePanel === panel.id ? 'active' : ''} aria-label={`Abrir ${panel.label}`} aria-pressed={responsivePanel === panel.id} onClick={() => setResponsivePanel(panel.id)}><span aria-hidden="true">{panel.icon}</span><strong>{panel.label}</strong></button>)}
      </nav>
      <div className="editor-columns" data-responsive-panel={responsivePanel}>
        <div className="left-editor-stack"><ObjectTree /><AssetLibrary /></div>
        <EditorCanvas />
        <div className="right-editor-stack"><Inspector /><ModelAssetPanel /><PlayerGameplayPanel /><CollectibleObjectivesPanel /><CampaignPanel /><EntryPointsPanel /><EnemyActivationPanel /><PlayerAnimationPanel /><BossCombatPanel /><DialogueEditorPanel /><TriggerActionsPanel /><ProblemsPanel /></div>
      </div>
    </section>
    <StatusBar />
  </main>;
}
