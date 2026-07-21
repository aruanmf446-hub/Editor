import { useMemo } from 'react';
import { createDefaultBossAttacks, createDefaultBossPhases } from '../runtime/RuntimeEnemy';
import { useEditorStore } from '../state/editorStore';
import type { BossAttackDefinition, BossPhaseDefinition } from '../types/project';

const number = (value: string, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function BossCombatPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const updateObject = useEditorStore((state) => state.updateObject);

  const boss = useMemo(() => project.scenes
    .find((scene) => scene.id === selectedSceneId)?.objects
    .find((object) => object.id === selectedObjectId && object.type === 'boss'),
  [project, selectedObjectId, selectedSceneId]);

  if (!boss) return null;

  const attacks = boss.bossAttacks ?? [];
  const phases = boss.bossPhases ?? [];
  const saveAttacks = (next: BossAttackDefinition[]) => updateObject(boss.id, { bossAttacks: next });
  const savePhases = (next: BossPhaseDefinition[]) => updateObject(boss.id, { bossPhases: next, bossPhaseCount: next.length });
  const initialize = () => {
    const defaults = createDefaultBossAttacks(boss.damage ?? 2, boss.attackDistance ?? 110, boss.attackCooldownMs ?? 1500, boss.runSpeed ?? 95);
    updateObject(boss.id, { bossAttacks: defaults, bossPhases: createDefaultBossPhases(boss.bossPhaseCount ?? 2) });
  };
  const updateAttack = (index: number, patch: Partial<BossAttackDefinition>) => saveAttacks(attacks.map((attack, current) => current === index ? { ...attack, ...patch } : attack));
  const updatePhase = (index: number, patch: Partial<BossPhaseDefinition>) => savePhases(phases.map((phase, current) => current === index ? { ...phase, ...patch } : phase));

  return <aside className="panel boss-combat-panel">
    <h2>Combate do boss</h2>
    <p className="panel-hint">Configure golpes, janelas de dano e mudanças de comportamento por fase.</p>
    {(!attacks.length || !phases.length) && <button type="button" onClick={initialize}>Criar configuração padrão</button>}

    {attacks.length > 0 && <>
      <h3>Ataques</h3>
      {attacks.map((attack, index) => <fieldset key={`${attack.id}-${index}`} className="compact-config-card">
        <legend>{attack.name || `Ataque ${index + 1}`}</legend>
        <div className="field-grid">
          <label>Nome<input value={attack.name} onChange={(event) => updateAttack(index, { name: event.target.value })} /></label>
          <label>ID<input value={attack.id} onChange={(event) => updateAttack(index, { id: event.target.value })} /></label>
          <label>Clip exato<input value={attack.animationClip ?? ''} placeholder="Opcional" onChange={(event) => updateAttack(index, { animationClip: event.target.value || undefined })} /></label>
          <label>Dano<input type="number" min="0" value={attack.damage} onChange={(event) => updateAttack(index, { damage: number(event.target.value) })} /></label>
          <label>Alcance<input type="number" min="0" value={attack.reach} onChange={(event) => updateAttack(index, { reach: number(event.target.value) })} /></label>
          <label>Duração ms<input type="number" min="80" value={attack.durationMs} onChange={(event) => updateAttack(index, { durationMs: number(event.target.value, 80) })} /></label>
          <label>Início do dano ms<input type="number" min="0" value={attack.activeStartMs} onChange={(event) => updateAttack(index, { activeStartMs: number(event.target.value) })} /></label>
          <label>Fim do dano ms<input type="number" min="0" value={attack.activeEndMs} onChange={(event) => updateAttack(index, { activeEndMs: number(event.target.value) })} /></label>
          <label>Cooldown ms<input type="number" min="0" value={attack.cooldownMs} onChange={(event) => updateAttack(index, { cooldownMs: number(event.target.value) })} /></label>
          <label>Fase mínima<input type="number" min="1" value={attack.minimumPhase ?? 1} onChange={(event) => updateAttack(index, { minimumPhase: Math.max(1, number(event.target.value, 1)) })} /></label>
          <label>Vel. investida<input type="number" min="0" value={attack.dashSpeed ?? 0} onChange={(event) => updateAttack(index, { dashSpeed: number(event.target.value) || undefined })} /></label>
        </div>
        <button type="button" onClick={() => saveAttacks(attacks.filter((_, current) => current !== index))}>Remover ataque</button>
      </fieldset>)}
      <button type="button" onClick={() => saveAttacks([...attacks, {
        id: `ataque-${attacks.length + 1}`,
        name: `Ataque ${attacks.length + 1}`,
        damage: boss.damage ?? 2,
        reach: boss.attackDistance ?? 110,
        durationMs: 600,
        activeStartMs: 200,
        activeEndMs: 400,
        cooldownMs: boss.attackCooldownMs ?? 1500,
        minimumPhase: 1,
      }])}>Adicionar ataque</button>
    </>}

    {phases.length > 0 && <>
      <h3>Fases</h3>
      {phases.map((phase, index) => <fieldset key={`${phase.id}-${index}`} className="compact-config-card">
        <legend>{phase.name || `Fase ${index + 1}`}</legend>
        <div className="field-grid">
          <label>Nome<input value={phase.name} onChange={(event) => updatePhase(index, { name: event.target.value })} /></label>
          <label>Vida para iniciar %<input type="number" min="0" max="100" value={Math.round(phase.healthThreshold * 100)} onChange={(event) => updatePhase(index, { healthThreshold: Math.max(0, Math.min(1, number(event.target.value) / 100)) })} /></label>
          <label>Multip. velocidade<input type="number" min="0" step="0.05" value={phase.speedMultiplier} onChange={(event) => updatePhase(index, { speedMultiplier: number(event.target.value, 1) })} /></label>
          <label>Multip. dano<input type="number" min="0" step="0.05" value={phase.damageMultiplier} onChange={(event) => updatePhase(index, { damageMultiplier: number(event.target.value, 1) })} /></label>
          <label>Multip. cooldown<input type="number" min="0.05" step="0.05" value={phase.cooldownMultiplier} onChange={(event) => updatePhase(index, { cooldownMultiplier: number(event.target.value, 1) })} /></label>
          <label>Transição ms<input type="number" min="0" value={phase.transitionDurationMs} onChange={(event) => updatePhase(index, { transitionDurationMs: number(event.target.value) })} /></label>
        </div>
        <div className="checkbox-list">
          {attacks.map((attack) => <label key={attack.id} className="checkbox-field">
            <input type="checkbox" checked={phase.enabledAttackIds.includes(attack.id)} onChange={(event) => updatePhase(index, {
              enabledAttackIds: event.target.checked
                ? [...new Set([...phase.enabledAttackIds, attack.id])]
                : phase.enabledAttackIds.filter((id) => id !== attack.id),
            })} />
            {attack.name}
          </label>)}
        </div>
        {phases.length > 1 && <button type="button" onClick={() => savePhases(phases.filter((_, current) => current !== index))}>Remover fase</button>}
      </fieldset>)}
      <button type="button" onClick={() => savePhases([...phases, {
        id: `fase-${phases.length + 1}`,
        name: `Fase ${phases.length + 1}`,
        healthThreshold: Math.max(0.05, 1 / (phases.length + 1)),
        speedMultiplier: 1 + phases.length * 0.25,
        damageMultiplier: 1 + phases.length * 0.2,
        cooldownMultiplier: Math.max(0.45, 1 - phases.length * 0.18),
        enabledAttackIds: attacks.map((attack) => attack.id),
        transitionDurationMs: 500,
      }])}>Adicionar fase</button>
    </>}
  </aside>;
}
