export const EL_FUEGO_PROJECT_FORMAT = 'el-fuego-studio-project' as const;
export const EL_FUEGO_PROJECT_VERSION = 1 as const;

export type ProjectId = string;
export type SceneId = string;
export type ObjectId = string;
export type AssetId = string;

export interface ProjectMetadata { id: ProjectId; name: string; createdAt: string; updatedAt: string; }
export interface ProjectSettings { gravity: number; gridSize: number; snapEnabled: boolean; defaultSceneWidth: number; defaultSceneHeight: number; }
export type AssetCategory = 'background' | 'model' | 'texture' | 'audio' | 'thumbnail' | 'other';
export interface ProjectAsset { id: AssetId; name: string; originalName: string; mimeType: string; size: number; checksum?: string; category: AssetCategory; }
export interface CampaignLevel { id: string; name: string; initialSceneId: SceneId; unlockAfterLevelId: string | null; }
export interface CampaignChapter { id: string; name: string; levels: CampaignLevel[]; }
export interface CampaignDefinition { chapters: CampaignChapter[]; }
export interface CampaignCheckpointProgress { sceneId: SceneId; objectId: ObjectId; x: number; y: number; respawnHealth: number; }
export interface CampaignBestResult { completedAt: string; deaths: number; elapsedMs: number; }
export interface CampaignProgress {
  projectId: ProjectId;
  unlockedLevelIds: string[];
  completedLevelIds: string[];
  checkpoints: Record<string, CampaignCheckpointProgress>;
  lives: number;
  attack: number;
  defense: number;
  collectedObjectIds: string[];
  collectibleTotals?: Record<string, number>;
  bestResults: Record<string, CampaignBestResult>;
  lastLevelId: string | null;
  storyVariables: Record<string, string | number | boolean>;
  updatedAt: string;
}
export interface Transform2D { x: number; y: number; z: number; width: number; height: number; scaleX: number; scaleY: number; rotation: number; }
export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'original';
export interface SceneBackgroundSettings { fit: BackgroundFit; positionX: number; positionY: number; scale: number; editorOpacity: number; }
export type FinishEndingMode = 'next-scene' | 'target-scene' | 'complete-game';
export type PlayerAnimationRole = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'attack' | 'defend' | 'hurt' | 'dead' | 'crouch';
export type PlayerAnimationAssignments = Partial<Record<PlayerAnimationRole, string>>;
export type PlayerAnimationAssetAssignments = Partial<Record<PlayerAnimationRole, AssetId>>;
export type EnemyAnimationRole = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'dead' | 'intro' | 'phase-transition';
export type EnemyAnimationAssignments = Partial<Record<EnemyAnimationRole, string>>;
export type EnemyAnimationAssetAssignments = Partial<Record<EnemyAnimationRole, AssetId>>;

export interface BossAttackDefinition { id: string; name: string; animationClip?: string; damage: number; reach: number; durationMs: number; activeStartMs: number; activeEndMs: number; cooldownMs: number; minimumPhase?: number; dashSpeed?: number; }
export interface BossPhaseDefinition { id: string; name: string; healthThreshold: number; speedMultiplier: number; damageMultiplier: number; cooldownMultiplier: number; enabledAttackIds: string[]; transitionDurationMs: number; }

export type DialogueAdvanceMode = 'manual' | 'auto' | 'both';
export interface DialogueLine { id: string; speaker: string; text: string; portraitAssetId?: AssetId; durationMs?: number; }

export type TriggerAction =
  | { id: string; type: 'set-object-visible'; targetObjectId: ObjectId; visible: boolean }
  | { id: string; type: 'set-collision-enabled'; targetObjectId: ObjectId; enabled: boolean }
  | { id: string; type: 'activate-enemy'; targetObjectId: ObjectId; active: boolean }
  | { id: string; type: 'start-dialogue'; targetObjectId: ObjectId }
  | { id: string; type: 'set-camera'; x: number; y: number; durationMs: number }
  | { id: string; type: 'transition-scene'; targetSceneId: SceneId; targetEntryId?: string }
  | { id: string; type: 'set-variable'; key: string; value: string | number | boolean };

export type CollectibleKind = 'coin' | 'key' | 'story' | 'resource' | 'quest';
export interface CollectibleDefinition {
  id: string;
  kind: CollectibleKind;
  displayName: string;
  description?: string;
  value: number;
  iconAssetId?: AssetId;
  objectiveId?: string;
  required?: boolean;
  collectOnce?: boolean;
  respawnable?: boolean;
  respawnDelayMs?: number;
  actions?: TriggerAction[];
}

export type CompletionCondition =
  | { id: string; type: 'boss-defeated'; targetObjectId?: ObjectId }
  | { id: string; type: 'collectible-count'; collectibleId: string; minimum: number }
  | { id: string; type: 'variable'; key: string; value: string | number | boolean }
  | { id: string; type: 'dialogue-completed'; targetObjectId: ObjectId }
  | { id: string; type: 'required-enemies-defeated' };

export type SceneObjectType = 'player-spawn' | 'finish' | 'checkpoint' | 'platform' | 'wall' | 'drop-zone' | 'no-collision-zone' | 'pickup-health' | 'pickup-attack' | 'pickup-defense' | 'enemy-cactus' | 'boss' | 'decoration' | 'obstacle' | 'trigger' | 'dialogue-zone' | 'collectible';

export interface SceneObjectBase<TType extends SceneObjectType = SceneObjectType> {
  id: ObjectId; sceneId: SceneId; type: TType; name: string; assetId?: AssetId; transform: Transform2D;
  visible: boolean; locked: boolean; editorOnly: boolean; gameOnly: boolean;
  direction?: 'left' | 'right'; entryId?: string; defaultEntry?: boolean;
  initialHealth?: number; initialLives?: number; initialAttack?: number; initialDefense?: number; doubleJumpEnabled?: boolean;
  animationAssignments?: PlayerAnimationAssignments;
  animationAssetAssignments?: PlayerAnimationAssetAssignments;
  enemyAnimationAssignments?: EnemyAnimationAssignments;
  enemyAnimationAssetAssignments?: EnemyAnimationAssetAssignments;
  collisionType?: 'solid' | 'one-way' | 'none'; passThrough?: boolean; visibleInGame?: boolean;
  patrolLeft?: number; patrolRight?: number; visionDistance?: number; walkSpeed?: number; runSpeed?: number; attackDistance?: number; damage?: number; attackCooldownMs?: number; enemyHealth?: number; enemyActiveAtStart?: boolean; requiredForCompletion?: boolean; pursuitMode?: boolean;
  bossHealth?: number; bossPhaseCount?: number; bossAttacks?: BossAttackDefinition[]; bossPhases?: BossPhaseDefinition[];
  checkpointOrder?: number; respawnHealth?: number;
  pickupAmount?: number; respawnable?: boolean; respawnDelayMs?: number;
  triggerOnce?: boolean; triggerId?: string; triggerActions?: TriggerAction[];
  dialogueLines?: DialogueLine[]; dialogueBlockPlayer?: boolean; dialogueAdvanceMode?: DialogueAdvanceMode; dialogueOnce?: boolean;
  collectible?: CollectibleDefinition;
  endingMode?: FinishEndingMode; targetSceneId?: string; targetEntryId?: string; requiresAllCollectibles?: boolean;
  completionLogic?: 'all' | 'any'; completionConditions?: CompletionCondition[];
}
export interface PlayerSpawnObject extends SceneObjectBase<'player-spawn'> { direction: 'left' | 'right'; entryId?: string; defaultEntry?: boolean; initialHealth: number; initialLives?: number; initialAttack: number; initialDefense: number; doubleJumpEnabled?: boolean; animationAssignments?: PlayerAnimationAssignments; animationAssetAssignments?: PlayerAnimationAssetAssignments; }
export interface CactusObject extends SceneObjectBase<'enemy-cactus'> { direction: 'left' | 'right'; patrolLeft: number; patrolRight: number; visionDistance: number; walkSpeed: number; runSpeed: number; attackDistance: number; damage: number; attackCooldownMs: number; enemyHealth?: number; enemyAnimationAssignments?: EnemyAnimationAssignments; enemyAnimationAssetAssignments?: EnemyAnimationAssetAssignments; pursuitMode?: boolean; }
export interface BossObject extends SceneObjectBase<'boss'> { direction: 'left' | 'right'; bossHealth: number; bossPhaseCount: number; bossAttacks?: BossAttackDefinition[]; bossPhases?: BossPhaseDefinition[]; enemyAnimationAssignments?: EnemyAnimationAssignments; enemyAnimationAssetAssignments?: EnemyAnimationAssetAssignments; }
export interface PlatformObject extends SceneObjectBase<'platform'> { collisionType: 'solid' | 'one-way' | 'none'; passThrough: boolean; visibleInGame: boolean; }
export type KnownSceneObject = PlayerSpawnObject | CactusObject | BossObject | PlatformObject | SceneObjectBase;
export interface ProjectScene { id: SceneId; name: string; order: number; width: number; height: number; backgroundAssetId: AssetId | null; background: SceneBackgroundSettings; objects: KnownSceneObject[]; }
export interface ElFuegoProject { format: typeof EL_FUEGO_PROJECT_FORMAT; version: typeof EL_FUEGO_PROJECT_VERSION; project: ProjectMetadata; settings: ProjectSettings; assets: ProjectAsset[]; scenes: ProjectScene[]; campaign?: CampaignDefinition; }
