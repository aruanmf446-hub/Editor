export type RuntimeInputState = {
  left: boolean; right: boolean; up: boolean; down: boolean;
  jump: boolean; attack: boolean; defend: boolean;
};

const initialState = (): RuntimeInputState => ({ left: false, right: false, up: false, down: false, jump: false, attack: false, defend: false });

export class RuntimeInput {
  readonly state = initialState();

  start() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    Object.assign(this.state, initialState());
  }

  private setKey(code: string, value: boolean) {
    if (code === 'KeyA' || code === 'ArrowLeft') this.state.left = value;
    if (code === 'KeyD' || code === 'ArrowRight') this.state.right = value;
    if (code === 'KeyW' || code === 'ArrowUp') { this.state.up = value; this.state.jump = value; }
    if (code === 'Space') this.state.jump = value;
    if (code === 'KeyS' || code === 'ArrowDown') this.state.down = value;
    if (code === 'KeyJ') this.state.attack = value;
    if (code === 'KeyK') this.state.defend = value;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    this.setKey(event.code, true);
  };

  private onKeyUp = (event: KeyboardEvent) => this.setKey(event.code, false);
}
