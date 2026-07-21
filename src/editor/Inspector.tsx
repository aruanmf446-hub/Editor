import { useMemo } from 'react';
import { useEditorStore } from '../state/editorStore';
import type {
  BackgroundFit,
  FinishEndingMode,
  SceneBackgroundSettings,
  SceneObjectBase,
  Transform2D,
} from '../types/project';
import { validateProject } from '../validation/validateProject';

type NumericObjectKey =
  | 'initialHealth'
  | 'initialAttack'
  | 'initialDefense'
  | 'patrolLeft'
  | 'patrolRight'
  | 'visionDistance'
  | 'walkSpeed'
  | 'runSpeed'
  | 'attackDistance'
  | 'damage'
  | 'attackCooldownMs'
  | 'enemyHealth'
  | 'bossHealth'
  | 'bossPhaseCount'
  | 'checkpointOrder'
  | 'respawnHealth'
  | 'pickupAmount'
  | 'respawnDelayMs';

type TransformKey = 'x' | 'y' | 'width' | 'height' | 'rotation';
type BackgroundNumericKey = 'positionX' | 'positionY' | 'scale' | 'editorOpacity';

export function Inspector() {
  const {
    project,
    selectedSceneId,
    selectedObjectId,
    renameProject,
    updateScene,
    updateObject,
  } = useEditorStore();

  const scene = project.scenes.find((item) => item.id === selectedSceneId) ?? project.scenes[0];
  const object = scene.objects.find((item) => item.id === selectedObjectId);
  const validation = useMemo(() => validateProject(project), [project]);

  const updateNumericObjectField = (target: SceneObjectBase, key: NumericObjectKey, value: number) => {
    updateObject(target.id, { [key]: value } as Partial<SceneObjectBase>);
  };

  const numericField = (target: SceneObjectBase, label: string, key: NumericObjectKey, min?: number) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        value={target[key] ?? 0}
        onChange={(event) => updateNumericObjectField(target, key, Number(event.target.value))}
      />
    </label>
  );

  const directionField = (target: SceneObjectBase) => (
    <label>
      Direção
      <select
        value={target.direction ?? 'left'}
        onChange={(event) => updateObject(target.id, { direction: event.target.value as 'left' | 'right' })}
      >
        <option value="left">Esquerda</option>
        <option value="right">Direita</option>
      </select>
    </label>
  );

  const transformField = (target: SceneObjectBase, label: string, key: TransformKey) => (
    <label>
      {label}
      <input
        type="number"
        value={target.transform[key]}
        onChange={(event) => {
          const transform: Transform2D = {
            ...target.transform,
            [key]: Number(event.target.value),
          };
          updateObject(target.id, { transform });
        }}
      />
    </label>
  );

  const backgroundField = (label: string, key: BackgroundNumericKey, step = '1') => (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={scene.background[key]}
        onChange={(event) => {
          const background: Partial<SceneBackgroundSettings> = { [key]: Number(event.target.value) };
          updateScene(scene.id, { background });
        }}
      />
    </label>
  );

  const errors = validation.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning').length;
  const infos = validation.issues.filter((issue) => issue.severity === 'info').length;

  return (
    <aside className="panel inspector">
      <h2>Propriedades</h2>
      <label>
        Projeto
        <input value={project.project.name} onChange={(event) => renameProject(event.target.value)} />
      </label>

      {object ? (
        <div className="inspector-section">
          <h3>{object.name}</h3>
          <label>
            Nome
            <input value={object.name} onChange={(event) => updateObject(object.id, { name: event.target.value })} />
          </label>

          <div className="field-grid">
            {transformField(object, 'Posição X', 'x')}
            {transformField(object, 'Posição Y', 'y')}
            {transformField(object, 'Largura', 'width')}
            {transformField(object, 'Altura', 'height')}
            {transformField(object, 'Rotação', 'rotation')}
          </div>

          {object.type === 'player-spawn' && (
            <>
              <h3>Player</h3>
              <label>
                Direção
                <select
                  value={object.direction ?? 'right'}
                  onChange={(event) => updateObject(object.id, { direction: event.target.value as 'left' | 'right' })}
                >
                  <option value="left">Esquerda</option>
                  <option value="right">Direita</option>
                </select>
              </label>
              <div className="field-grid">
                {numericField(object, 'Vida inicial', 'initialHealth', 0)}
                {numericField(object, 'Ataque inicial', 'initialAttack', 0)}
                {numericField(object, 'Defesa inicial', 'initialDefense', 0)}
              </div>
            </>
          )}

          {(object.type === 'platform' || object.type === 'wall') && (
            <>
              <h3>Física</h3>
              <label>
                Colisão
                <select
                  value={object.collisionType ?? 'solid'}
                  onChange={(event) =>
                    updateObject(object.id, {
                      collisionType: event.target.value as 'solid' | 'one-way' | 'none',
                    })
                  }
                >
                  <option value="solid">Sólida</option>
                  <option value="one-way">Atravessável</option>
                  <option value="none">Sem colisão</option>
                </select>
              </label>
            </>
          )}

          {object.type === 'enemy-cactus' && (
            <>
              <h3>Cacto</h3>
              {directionField(object)}
              <div className="field-grid">
                {numericField(object, 'Vida', 'enemyHealth', 1)}
                {numericField(object, 'Limite esquerdo', 'patrolLeft')}
                {numericField(object, 'Limite direito', 'patrolRight')}
                {numericField(object, 'Área de visão', 'visionDistance', 0)}
                {numericField(object, 'Vel. andando', 'walkSpeed', 0)}
                {numericField(object, 'Vel. correndo', 'runSpeed', 0)}
                {numericField(object, 'Dist. ataque', 'attackDistance', 0)}
                {numericField(object, 'Dano', 'damage', 0)}
                {numericField(object, 'Intervalo ms', 'attackCooldownMs', 1)}
              </div>
            </>
          )}

          {object.type === 'boss' && (
            <>
              <h3>Boss</h3>
              {directionField(object)}
              <div className="field-grid">
                {numericField(object, 'Vida', 'bossHealth', 1)}
                {numericField(object, 'Fases', 'bossPhaseCount', 1)}
                {numericField(object, 'Área de visão', 'visionDistance', 0)}
                {numericField(object, 'Vel. perseguição', 'runSpeed', 0)}
                {numericField(object, 'Dist. ataque', 'attackDistance', 0)}
                {numericField(object, 'Dano base', 'damage', 0)}
                {numericField(object, 'Intervalo ms', 'attackCooldownMs', 1)}
              </div>
            </>
          )}

          {object.type === 'checkpoint' && (
            <>
              <h3>Checkpoint</h3>
              <div className="field-grid">
                {numericField(object, 'Ordem', 'checkpointOrder', 1)}
                {numericField(object, 'Vida ao retornar', 'respawnHealth', 0)}
              </div>
            </>
          )}

          {object.type.startsWith('pickup-') && (
            <>
              <h3>Recarga</h3>
              <div className="field-grid">
                {numericField(object, 'Quantidade', 'pickupAmount', 1)}
                {object.respawnable && numericField(object, 'Tempo para reaparecer (ms)', 'respawnDelayMs', 1)}
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(object.respawnable)}
                  onChange={(event) => updateObject(object.id, { respawnable: event.target.checked })}
                />
                Reaparecer depois da coleta
              </label>
            </>
          )}

          {object.type === 'trigger' && (
            <>
              <h3>Gatilho</h3>
              <label>
                ID
                <input
                  value={object.triggerId ?? ''}
                  onChange={(event) => updateObject(object.id, { triggerId: event.target.value })}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(object.triggerOnce)}
                  onChange={(event) => updateObject(object.id, { triggerOnce: event.target.checked })}
                />
                Disparar somente uma vez
              </label>
            </>
          )}

          {object.type === 'dialogue-zone' && (
            <p className="panel-hint">O nome do objeto será exibido como diálogo durante o contato.</p>
          )}

          {object.type === 'finish' && (
            <>
              <h3>Fim da fase</h3>
              <label>
                Comportamento
                <select
                  value={object.endingMode ?? 'next-scene'}
                  onChange={(event) => {
                    const endingMode = event.target.value as FinishEndingMode;
                    updateObject(object.id, {
                      endingMode,
                      targetSceneId: endingMode === 'target-scene' ? object.targetSceneId : undefined,
                    });
                  }}
                >
                  <option value="next-scene">Ir para a próxima cena</option>
                  <option value="target-scene">Ir para uma cena específica</option>
                  <option value="complete-game">Concluir o jogo</option>
                </select>
              </label>
              {(object.endingMode ?? 'next-scene') === 'target-scene' && (
                <label>
                  Cena de destino
                  <select
                    value={object.targetSceneId ?? ''}
                    onChange={(event) => updateObject(object.id, { targetSceneId: event.target.value || undefined })}
                  >
                    <option value="">Selecione...</option>
                    {project.scenes.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(object.requiresAllCollectibles)}
                  onChange={(event) => updateObject(object.id, { requiresAllCollectibles: event.target.checked })}
                />
                Exigir todos os colecionáveis da cena
              </label>
            </>
          )}

          <dl>
            <div><dt>Tipo</dt><dd>{object.type}</dd></div>
            <div><dt>Asset</dt><dd>{object.assetId ? project.assets.find((asset) => asset.id === object.assetId)?.name ?? 'Ausente' : 'Nenhum'}</dd></div>
            {object.assetId && project.assets.find((asset) => asset.id === object.assetId)?.category === 'model' && (
              <div><dt>Prévia 3D</dt><dd>Ainda não disponível</dd></div>
            )}
          </dl>
        </div>
      ) : (
        <div className="inspector-section">
          <h3>Cena selecionada</h3>
          <label>
            Nome
            <input value={scene.name} onChange={(event) => updateScene(scene.id, { name: event.target.value })} />
          </label>
          <div className="field-grid">
            <label>
              Largura
              <input type="number" min="320" value={scene.width} onChange={(event) => updateScene(scene.id, { width: Number(event.target.value) })} />
            </label>
            <label>
              Altura
              <input type="number" min="180" value={scene.height} onChange={(event) => updateScene(scene.id, { height: Number(event.target.value) })} />
            </label>
          </div>
          <h3>Cenário</h3>
          <label>
            Encaixe
            <select
              value={scene.background.fit}
              onChange={(event) => updateScene(scene.id, { background: { fit: event.target.value as BackgroundFit } })}
            >
              <option value="cover">Preencher</option>
              <option value="contain">Ajustar</option>
              <option value="stretch">Esticar</option>
              <option value="original">Tamanho original</option>
            </select>
          </label>
          <div className="field-grid">
            {backgroundField('Posição X %', 'positionX')}
            {backgroundField('Posição Y %', 'positionY')}
            {backgroundField('Escala', 'scale', '0.05')}
            {backgroundField('Opacidade editor', 'editorOpacity', '0.05')}
          </div>
          <button onClick={() => updateScene(scene.id, { backgroundAssetId: null })} disabled={!scene.backgroundAssetId}>
            Remover cenário
          </button>
        </div>
      )}

      <div className={`validation ${errors ? 'error' : warnings ? 'warning' : 'ok'}`}>
        <strong>{errors} erro(s) · {warnings} aviso(s) · {infos} info(s)</strong>
        {validation.issues.slice(0, 5).map((issue) => (
          <span key={`${issue.code}-${issue.objectId ?? issue.sceneId ?? issue.message}`}>
            {issue.severity === 'error' ? '⛔' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'} {issue.message}
          </span>
        ))}
      </div>
    </aside>
  );
}
