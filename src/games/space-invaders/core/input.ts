const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export interface InputHandlers {
  /** Fires once per physical key press (not on auto-repeat). */
  onPress?(code: string): void;
  onBlur?(): void;
}

export class Input {
  private readonly down = new Set<string>();

  constructor(handlers: InputHandlers = {}) {
    addEventListener('keydown', e => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      this.down.add(e.code);
      if (!e.repeat) handlers.onPress?.(e.code);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => {
      this.down.clear();
      handlers.onBlur?.();
    });
  }

  isDown(codes: readonly string[]): boolean {
    return codes.some(c => this.down.has(c));
  }
}
