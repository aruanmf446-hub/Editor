import { campaignLevels, EL_FUEGO_LEVEL_COUNT } from '../project/campaign';
import { useEditorStore } from '../state/editorStore';
import type { CampaignDefinition, CampaignLevel } from '../types/project';

export function CampaignPanel() {
  const project = useEditorStore((state) => state.project);
  const updateCampaign = useEditorStore((state) => state.updateCampaign);
  const configureTenLevelCampaign = useEditorStore((state) => state.configureTenLevelCampaign);
  const campaign = project.campaign;

  if (!campaign) {
    return <aside className="panel campaign-panel">
      <h2>Campanha</h2>
      <p className="panel-hint">As fases da história ficam separadas das cenas. Cada fase escolhe sua própria cena inicial.</p>
      <button type="button" onClick={configureTenLevelCampaign}>Preparar campanha de 10 fases</button>
    </aside>;
  }

  const levels = campaignLevels(campaign);
  const chapter = campaign.chapters[0];
  if (!chapter) return null;
  const saveChapter = (patch: Partial<typeof chapter>) => {
    const next: CampaignDefinition = {
      chapters: campaign.chapters.map((candidate, index) => index === 0 ? { ...candidate, ...patch } : candidate),
    };
    updateCampaign(next);
  };
  const updateLevel = (index: number, patch: Partial<CampaignLevel>) => {
    saveChapter({ levels: chapter.levels.map((level, current) => current === index ? { ...level, ...patch } : level) });
  };

  return <aside className="panel campaign-panel">
    <h2>Campanha</h2>
    <p className="panel-hint">{levels.length}/{EL_FUEGO_LEVEL_COUNT} fases configuradas. A primeira começa liberada; as demais podem depender da fase anterior.</p>
    <label>Capítulo<input value={chapter.name} onChange={(event) => saveChapter({ name: event.target.value })} /></label>
    {chapter.levels.map((level, index) => <fieldset key={level.id} className="compact-config-card">
      <legend>Fase {index + 1}</legend>
      <label>Nome<input value={level.name} onChange={(event) => updateLevel(index, { name: event.target.value })} /></label>
      <label>Cena inicial<select value={level.initialSceneId} onChange={(event) => updateLevel(index, { initialSceneId: event.target.value })}>{project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
      <label>Desbloquear depois de<select value={level.unlockAfterLevelId ?? ''} onChange={(event) => updateLevel(index, { unlockAfterLevelId: event.target.value || null })}><option value="">Disponível desde o início</option>{chapter.levels.filter((candidate) => candidate.id !== level.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
    </fieldset>)}
    {levels.length !== EL_FUEGO_LEVEL_COUNT && <button type="button" onClick={configureTenLevelCampaign}>Completar para 10 fases</button>}
    <button type="button" onClick={() => updateCampaign(undefined)}>Remover configuração da campanha</button>
  </aside>;
}
