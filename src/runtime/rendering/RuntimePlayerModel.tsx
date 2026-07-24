import type { PlayerAnimationAssignments } from '../../types/project';
import type { RuntimeWorld } from '../RuntimeWorld';
import {
  RuntimeUniversalPlayerModel,
  type RuntimeUniversalPlayerModelStatus,
} from './RuntimeUniversalPlayerModel';

export type RuntimePlayerModelStatus = RuntimeUniversalPlayerModelStatus;

type Props = {
  assetId?: string;
  animationAssignments?: PlayerAnimationAssignments;
  world: RuntimeWorld;
  onStatusChange?: (status: RuntimePlayerModelStatus) => void;
};

export function RuntimePlayerModel({ assetId, animationAssignments, world, onStatusChange }: Props) {
  return (
    <RuntimeUniversalPlayerModel
      assetId={assetId}
      animationAssignments={animationAssignments}
      animationAssetAssignments={world.player.animationAssetAssignments}
      world={world}
      onStatusChange={onStatusChange}
    />
  );
}
