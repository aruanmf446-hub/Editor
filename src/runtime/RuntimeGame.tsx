import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCampaignProgress, saveCampaignProgress } from '../persistence/campaignProgressRepository';
import { useAssetStore } from '../state/assetStore';
import { useEditorStore } from '../state/editorStore';
import type { CampaignProgress } from '../types/project';
import { isRuntimeObjectVisible } from './RuntimeAdvancedObjects';
import { RuntimeController, type RuntimeControllerSnapshot, type RuntimePauseReason } from './RuntimeController';
import { RuntimeDebugOverlay } from './RuntimeDebugOverlay';
import { createRuntimeEnemies } from './RuntimeEnemy';
import { createRuntimePickups, type RuntimePickupKind } from './RuntimePickup';
import { loadRuntimeProject } from './RuntimeProjectLoader';
import { createRuntimePlayer } from './RuntimePlayer';
import { createRuntimePlatforms, type RuntimeWorld } from './RuntimeWorld';
import { RuntimeEnemyModels } from './rendering/RuntimeEnemyModels';
import { RuntimeEnemiesLayer } from './rendering/RuntimeEnemiesLayer';
import { RuntimePlayerModel, type RuntimePlayerModelStatus } from './rendering/RuntimePlayerModel';

type Props = { onExit: () => void };
type RuntimeLoadResult = ReturnType<typeof loadRuntimeProject> | { error: string } | { loading: true };

const pickupIcon: Record<RuntimePickupKind, string> = { health: '♥', attack: '⚔', defense: '◆' };
const hiddenRuntimeTypes = new Set(['player-spawn', 'enemy-cactus', 'boss', 'drop-zone', 'no-collision-zone', 'trigger', 'dialogue-zone', 'collectible']);
const debugZoneTypes = new Set(['drop-zone', 'no-collision-zone', 'trigger', 'dialogue-zone']);

export function RuntimeGame({ onExit }: Props) {
  const sourceProject = useEditorStore((state) => state.project);
  const assets = useAssetStore((state) => state.assets);
  const viewportRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RuntimeController | null>(null);
  const [view, setView] = useState<RuntimeControllerSnapshot | null>(null);
  const [pauseReason, setPauseReason] = useState<RuntimePauseReason>(null);
  const [debug, setDebug] = useState(false);
  const [playerModelStatus, setPlayerModelStatus] = useState<RuntimePlayerModelStatus>('loading');
  const [enemyModelReadyIds, setEnemyModelReadyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadCampaignProgress(sourceProject)
      .then((progress) => { if (!cancelled) setCampaignProgress(progress); })
      .catch((error) => {
        console.error('[campaign-progress] falha ao carregar progresso', error);
        if (!cancelled) setCampaignProgress(null);
      });
    return () => { cancelled = true; };
  }, [sourceProject]);

  const persistProgress = useCallback((progress: CampaignProgress) => {
    void saveCampaignProgress(progress).catch((error) => console.error('[campaign-progress] falha ao salvar progresso', error));
  }, []);

  const loadResult = useMemo<RuntimeLoadResult>(() => {
    if (campaignProgress === undefined) return { loading: true };
    try { return loadRuntimeProject(sourceProject, campaignProgress?.lastLevelId); }
    catch (reason) { return { error: reason instanceof Error ? reason.message : 'Projeto inválido.' }; }
  }, [campaignProgress, sourceProject]);

  const urls = useMemo(() => {
    const map: Record<string, string> = {};
    if ('error' in loadResult || 'loading' in loadResult) return map;
    for (const asset of assets) if (asset.mimeType.startsWith('image/')) map[asset.id] = URL.createObjectURL(asset.blob);
    return map;
  }, [assets, loadResult]);

  useEffect(() => () => Object.values(urls).forEach(URL.revokeObjectURL), [urls]);

  useEffect(() => {
    if ('error' in loadResult || 'loading' in loadResult) return;
    let disposed = false;
    const controller = new RuntimeController({
      snapshot: loadResult,
      progress: campaignProgress,
      onProgressChange: persistProgress,
      onRender: (snapshot) => { if (!disposed) setView({ ...snapshot, world: snapshot.world }); },
    });
    controllerRef.current = controller;
    controller.start();
    const onBlur = () => {
      controller.pause('blur');
      setPauseReason(controller.getPauseReason());
    };
    window.addEventListener('blur', onBlur);
    return () => {
      disposed = true;
      window.removeEventListener('blur', onBlur);
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [campaignProgress, loadResult, persistProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const dialogue = controllerRef.current?.getWorld().activeDialogue;
      if (!dialogue || dialogue.contactOnly) return;
      event.preventDefault();
      controllerRef.current?.advanceDialogue();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || 'error' in loadResult || 'loading' in loadResult) return;
    const update = () => controllerRef.current?.resize(viewport.clientWidth, viewport.clientHeight);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [loadResult]);

  if ('loading' in loadResult) return <section className="runtime-error"><h2>Carregando campanha...</h2></section>;
  if ('error' in loadResult) return <section className="runtime-error"><h2>Não foi possível iniciar o teste</h2><pre>{loadResult.error}</pre><button onClick={onExit}>Voltar ao editor</button></section>;

  const fallbackPickupMemory = {};
  const fallbackWorld: RuntimeWorld = {
    project: loadResult.project,
    scene: loadResult.initialScene,
    sceneRevision: 0,
    currentLevelId: loadResult.levelId,
    campaignProgress,
    campaignProgressRevision: 0,
    campaignElapsed: 0,
    campaignDeaths: 0,
    player: createRuntimePlayer(loadResult.spawn),
    enemies: createRuntimeEnemies(loadResult.initialScene),
    pickups: createRuntimePickups(loadResult.initialScene, fallbackPickupMemory),
    pickupMemory: fallbackPickupMemory,
    platforms: createRuntimePlatforms(loadResult.initialScene),
    activeCheckpoint: null,
    collectedObjectIds: {},
    triggeredObjectIds: {},
    activeTriggerContacts: {},
    completedDialogueIds: {},
    objectVisibilityOverrides: {},
    collisionEnabledOverrides: {},
    variables: {},
    collectiblesRemaining: loadResult.initialScene.objects.filter((object) => object.type === 'collectible' && object.visible && !object.editorOnly).length,
    activeDialogue: null,
    dialogueAdvanceRequested: false,
    lastTriggerId: null,
    playerNoCollision: false,
    pendingSceneTransition: null,
    cameraOverride: null,
    camera: { x: 0, y: 0, viewportWidth: 960, viewportHeight: 540 },
    input: { left: false, right: false, jump: false, crouch: false, attack: false, defend: false, jumpPressed: false, jumpReleased: false, attackPressed: false },
    paused: false,
    completed: false,
    physicsSteps: 0,
    accumulator: 0,
    droppedPhysicsTime: 0,
    respawnFailure: false,
  };
  const world = view?.world ?? fallbackWorld;
  const { scene, player, camera } = world;
  const activeBoss = world.enemies.find((enemy) => enemy.kind === 'boss' && !enemy.removed);
  const activeDialogue = world.activeDialogue;
  const activeLine = activeDialogue?.lines[activeDialogue.lineIndex];
  const background = scene.background ?? { fit: 'cover', positionX: 50, positionY: 50, scale: 1, editorOpacity: 1 };
  const backgroundUrl = scene.backgroundAssetId ? urls[scene.backgroundAssetId] : undefined;
  const objectFit = background.fit === 'stretch' ? 'fill' : background.fit === 'original' ? 'none' : background.fit;
  const collected = world.collectedObjectIds ?? {};

  const togglePause = () => {
    const controller = controllerRef.current;
    if (!controller || world.completed) return;
    if (controller.getPauseReason()) controller.resume(); else controller.pause('manual');
    setPauseReason(controller.getPauseReason());
  };

  return <section className="runtime-game">
    <div className="runtime-hud"><span>Vida {player.health}</span><span>Ataque {player.attack}</span><span>Defesa {player.defense}</span><span>{scene.name}</span>{world.activeCheckpoint && <span>Checkpoint {world.activeCheckpoint.order}</span>}{(world.collectiblesRemaining ?? 0) > 0 && <span>Coletáveis {world.collectiblesRemaining}</span>}{world.playerNoCollision && <span>Sem colisão</span>}{world.lastTriggerId && <span>Gatilho {world.lastTriggerId}</span>}{activeBoss && <span>Boss {activeBoss.health}/{activeBoss.maxHealth} · Fase {activeBoss.phase}/{activeBoss.phaseCount}</span>}<button onClick={togglePause} disabled={world.completed}>{pauseReason ? 'Continuar' : 'Pausar'}</button><button onClick={() => setDebug((value) => !value)}>Debug</button><button onClick={onExit}>Sair</button></div>
    <div ref={viewportRef} className="runtime-viewport" style={{ position: 'relative' }}>
      <div className="runtime-world" style={{ width: scene.width, height: scene.height, transform: `translate(${-camera.x}px, ${-camera.y}px)` }}>
        {backgroundUrl && <img className="runtime-background" src={backgroundUrl} alt="" style={{ objectFit, objectPosition: `${background.positionX}% ${background.positionY}%`, transform: `scale(${background.scale})` }} />}
        {scene.objects.filter((object) => isRuntimeObjectVisible(world, object) && !hiddenRuntimeTypes.has(object.type) && !object.type.startsWith('pickup-')).map((object) => <div key={object.id} className={`runtime-entity runtime-${object.type}${world.activeCheckpoint?.objectId === object.id ? ' runtime-checkpoint-active' : ''}`} style={{ left: object.transform.x, top: object.transform.y, width: object.transform.width, height: object.transform.height }}><span>{object.name}</span></div>)}
        {scene.objects.filter((object) => object.type === 'collectible' && isRuntimeObjectVisible(world, object) && !collected[object.id]).map((object) => <div key={object.id} className="runtime-entity runtime-collectible-live" style={{ left: object.transform.x, top: object.transform.y, width: object.transform.width, height: object.transform.height }}><span aria-hidden="true">✦</span></div>)}
        {world.pickups.filter((pickup) => pickup.active).map((pickup) => <div key={pickup.id} className={`runtime-entity runtime-pickup-live runtime-pickup-${pickup.kind}`} style={{ left: pickup.x, top: pickup.y, width: pickup.width, height: pickup.height }}><span aria-hidden="true">{pickupIcon[pickup.kind]}</span>{debug && <small>+{pickup.amount}</small>}</div>)}
        <RuntimeEnemiesLayer world={world} modelReadyIds={enemyModelReadyIds} />
        {debug && world.platforms.map((platform) => <div key={`debug-${platform.id}`} className={`runtime-debug-collider ${platform.oneWay ? 'one-way' : 'solid'}`} style={{ left: platform.x, top: platform.y, width: platform.width, height: platform.height }} />)}
        {debug && scene.objects.filter((object) => debugZoneTypes.has(object.type) && isRuntimeObjectVisible(world, object)).map((object) => <div key={`zone-${object.id}`} className={`runtime-debug-zone runtime-debug-zone--${object.type}`} style={{ left: object.transform.x, top: object.transform.y, width: object.transform.width, height: object.transform.height }}><span>{object.name}</span></div>)}
        {debug && world.pickups.filter((pickup) => !pickup.active && pickup.respawnRemaining > 0).map((pickup) => <div key={`pickup-timer-${pickup.id}`} className="runtime-pickup-timer" style={{ left: pickup.x, top: pickup.y, width: pickup.width, height: pickup.height }}><span>{pickup.respawnRemaining.toFixed(1)}s</span></div>)}
        {debug && <div className="runtime-debug-previous" style={{ left: player.previousX, top: player.previousY, width: player.width, height: player.height }} />}
        {playerModelStatus !== 'ready' && <div className={`runtime-player runtime-player--${player.visualState}`} style={{ left: player.x, top: player.y, width: player.width, height: player.height }}><span>🔥</span></div>}
      </div>
      <RuntimeEnemyModels key={`enemy-models-${world.sceneRevision}`} world={world} onReadyIdsChange={setEnemyModelReadyIds} />
      <RuntimePlayerModel key={`${world.sceneRevision}-${player.assetId ?? 'sem-modelo'}`} assetId={player.assetId} animationAssignments={player.animationAssignments} world={world} onStatusChange={setPlayerModelStatus} />
      {activeDialogue && activeLine && <div className={`runtime-dialogue${activeDialogue.contactOnly ? ' runtime-dialogue--notice' : ''}`} role={activeDialogue.contactOnly ? 'status' : 'dialog'} aria-live="polite">
        {activeLine.portraitAssetId && urls[activeLine.portraitAssetId] && <img src={urls[activeLine.portraitAssetId]} alt="" />}
        <div>{activeLine.speaker && <strong>{activeLine.speaker}</strong>}<p>{activeLine.text}</p></div>
        {!activeDialogue.contactOnly && (activeDialogue.advanceMode === 'manual' || activeDialogue.advanceMode === 'both') && <button type="button" onClick={() => controllerRef.current?.advanceDialogue()}>{activeDialogue.lineIndex >= activeDialogue.lines.length - 1 ? 'Fechar' : 'Continuar'}</button>}
      </div>}
    </div>
    {world.completed && <div className="runtime-pause runtime-complete"><h2>Jogo concluído</h2><p>{scene.name} finalizada.</p><button onClick={onExit}>Voltar ao editor</button></div>}
    {!world.completed && pauseReason && <div className="runtime-pause"><h2>Teste pausado</h2><button onClick={togglePause}>Continuar</button><button onClick={onExit}>Sair do teste</button></div>}
    {debug && <RuntimeDebugOverlay fps={view?.fps ?? 0} world={world} />}
  </section>;
}
