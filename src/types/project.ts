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
export interface Transform2D { x: number; y: number; z: number; width: number; height: number; scaleX: number; scaleY: number; rotation: number; }
export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'original';
export interface SceneBackgroundSettings { fit: BackgroundFit; positionX: number; positionY: number; scale: number; editorOpacity: number; }
export type FinishEndingMode = 'next-scene' | 'target-scene' | 'complete-game';
export type PlayerAnimationRole = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'attack' | 'defend' | 'hurt' | 'dead' | 'crouch';
export type PlayerAnimationAssignments = Partial<Record<PlayerAnimationRole, string>>;
export type EnemyAnimationRole = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'dead' | 'intro' | 'phase-transition';
export type EnemyAnimationAssignments = Partial<Record<EnemyAnimationRole, string>>;
export type SceneObjectType = 'player-spawn' | 'finish' | 'checkpoint' | 'platform' | 'wall' | 'drop-zone' | 'no-collision-zone' | 'pickup-health' | 'pickup-attack' | 'pickup-defense' | 'enemy-cactus' | 'boss' | 'decoration' | 'obstacle' | 'trigger' | 'dialogue-zone' | 'collectible';

export interface SceneObjectBase<TType extends SceneObjectType = SceneObjectType> {
  id: ObjectId; sceneId: SceneId; type: TType; name: string; assetId?: AssetId; transform: Transform2D;
  visible: boolean; locked: boolean; editorOnly: boolean; gameOnly: boolean;
  direction?: 'left' | 'right';
  initialHealth?: number; initialAttack?: number; initialDefense?: number;
  animationAssignments?: PlayerAnimationAssignments;
  enemyAnimationAssignments?: EnemyAnimationAssignments;
  collisionType?: 'solid' | 'one-way' | 'none'; passThrough?: boolean; visibleInGame?: boolean;
  patrolLeft?: number; patrolRight?: number; visionDistance?: number; walkSpeed?: number; runSpeed?: number; attackDistance?: number; damage?: number; attackCooldownMs?: number; enemyHealth?: number;
  bossHealth?: number; bossPhaseCount?: number;
  checkpointOrder?: number; respawnHealth?: number;
  pickupAmount?: number; respawnable?: boolean; respawnDelayMs?: number;
  triggerOnce?: boolean; triggerId?: string;
  endingMode?: FinishEndingMode; targetSceneId?: string; requiresAllCollectibles?: boolean;
}
export interface PlayerSpawnObject extends SceneObjectBase<'player-spawn'> { direction: 'left' | 'right'; initialHealth: number; initialAttack: number; initialDefense: number; animationAssignments?: PlayerAnimationAssignments; }
export interface CactusObject extends SceneObjectBase<'enemy-cactus'> { direction: 'left' | 'right'; patrolLeft: number; patrolRight: number; visionDistance: number; walkSpeed: number; runSpeed: number; attackDistance: number; damage: number; attackCooldownMs: number; enemyHealth?: number; enemyAnimationAssignments?: EnemyAnimationAssignments; }
export interface PlatformObject extends SceneObjectBase<'platform'> { collisionType: 'solid' | 'one-way' | 'none'; passThrough: boolean; visibleInGame: boolean; }
export type KnownSceneObject = PlayerSpawnObject | CactusObject | PlatformObject | SceneObjectBase;
export interface ProjectScene { id: SceneId; name: string; order: number; width: number; height: number; backgroundAssetId: AssetId | null; background: SceneBackgroundSettings; objects: KnownSceneObject[]; }
export interface ElFuegoProject { format: typeof EL_FUEGO_PROJECT_FORMAT; version: typeof EL_FUEGO_PROJECT_VERSION; project: ProjectMetadata; settings: ProjectSettings; assets: ProjectAsset[]; scenes: ProjectScene[]; }
