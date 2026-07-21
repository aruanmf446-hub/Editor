export type RuntimeInputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  attack: boolean;
  defend: boolean;
};

export type RuntimeInputSnapshot = RuntimeInputState & {
  jumpPressed: boolean;
  jumpReleased: boolean;
  attackPressed?: boolean;
};

const emptyState = (): RuntimeInputState => ({ left: false, right: false, jump: false, crouch: false, attack: false, defend: false });

export class RuntimeInput {
  readonly state = emptyState();
  private pendingJumpPressed = false;
  private pendingJumpReleased = false;
  private pendingAttackPressed = false;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    Object.assign(this.state, emptyState());
    this.resetEdges();
  }

  snapshot(): RuntimeInputSnapshot {
    return { ...this.state, jumpPressed: this.pendingJumpPressed, jumpReleased: this.pendingJumpReleased, attackPressed: this.pendingAttackPressed };
  }

  consumeEdges(): void {
    this.pendingJumpPressed = false;
    this.pendingJumpReleased = false;
    this.pendingAttackPressed = false;
  }

  resetEdges(): void {
    this.pendingJumpPressed = false;
    this.pendingJumpReleased = false;
    this.pendingAttackPressed = false;
  }

  private setKey(code: string, value: boolean) {
    if (code === 'KeyA' || code === 'ArrowLeft') this.state.left = value;
    if (code === 'KeyD' || code === 'ArrowRight') this.state.right = value;
    if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') {
      if (value && !this.state.jump) this.pendingJumpPressed = true;
      if (!value && this.state.jump) this.pendingJumpReleased = true;
      this.state.jump = value;
    }
    if (code === 'KeyS' || code === 'ArrowDown') this.state.crouch = value;
    if (code === 'KeyJ') {
      if (value && !this.state.attack) this.pendingAttackPressed = true;
      this.state.attack = value;
    }
    if (code === 'KeyK') this.state.defend = value;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    this.setKey(event.code, true);
  };

  private onKeyUp = (event: KeyboardEvent) => this.setKey(event.code, false);
}
