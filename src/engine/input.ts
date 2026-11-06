import type { Dir } from '../sim/types';

const DIR_BY_CODE: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export class Input {
  private dirs: Dir[] = [];
  confirm = false;
  cancel = false;
  start = false;
  /** Presses are latched so a tap shorter than one frame still counts. */
  private pending = { confirm: false, cancel: false, start: false, debug: false, dir: null as Dir | null };
  showTouch: boolean;
  readonly edges = { confirm: false, cancel: false, start: false, debug: false, dir: null as Dir | null };
  private prevDir: Dir | null = null;

  constructor() {
    this.showTouch = window.matchMedia('(pointer: coarse)').matches;
  }

  get dir(): Dir | null {
    return this.dirs.length ? this.dirs[this.dirs.length - 1] : null;
  }

  setDir(dir: Dir, down: boolean): void {
    this.dirs = this.dirs.filter((held) => held !== dir);
    if (down) {
      this.dirs.push(dir);
      this.pending.dir = dir;
    }
  }

  setConfirm(down: boolean): void {
    if (down && !this.confirm) this.pending.confirm = true;
    this.confirm = down;
  }

  setCancel(down: boolean): void {
    if (down && !this.cancel) this.pending.cancel = true;
    this.cancel = down;
  }

  setStart(down: boolean): void {
    if (down && !this.start) this.pending.start = true;
    this.start = down;
  }

  beginFrame(): void {
    const dir = this.dir;
    this.edges.confirm = this.pending.confirm;
    this.edges.cancel = this.pending.cancel;
    this.edges.start = this.pending.start;
    this.edges.debug = this.pending.debug;
    this.edges.dir = this.pending.dir ?? (dir && dir !== this.prevDir ? dir : null);
    this.pending = { confirm: false, cancel: false, start: false, debug: false, dir: null };
    this.prevDir = dir;
  }

  noteKeyboard(): void {
    this.showTouch = false;
  }

  noteTouch(): void {
    this.showTouch = true;
  }

  attach(root: HTMLElement): void {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      const dir = DIR_BY_CODE[event.code];
      const gameKey = Boolean(dir) || event.code === 'KeyZ' || event.code === 'KeyX' || event.code === 'Enter' || event.code === 'Backquote';
      if (!gameKey) return;
      event.preventDefault();
      this.noteKeyboard();
      if (dir) this.setDir(dir, true);
      if (event.code === 'KeyZ') this.setConfirm(true);
      if (event.code === 'KeyX') this.setCancel(true);
      if (event.code === 'Enter') this.setStart(true);
      if (event.code === 'Backquote') this.pending.debug = true;
    });
    window.addEventListener('keyup', (event) => {
      const dir = DIR_BY_CODE[event.code];
      if (dir) this.setDir(dir, false);
      if (event.code === 'KeyZ') this.setConfirm(false);
      if (event.code === 'KeyX') this.setCancel(false);
      if (event.code === 'Enter') this.setStart(false);
    });
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener(
      'touchstart',
      () => {
        this.noteTouch();
      },
      { passive: true },
    );

    root.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => {
      const dir = button.dataset.dir as Dir;
      this.hold(button, (down) => this.setDir(dir, down));
    });
    const confirm = root.querySelector<HTMLButtonElement>('#btn-a');
    const cancel = root.querySelector<HTMLButtonElement>('#btn-b');
    const start = root.querySelector<HTMLButtonElement>('#btn-start');
    if (confirm) this.hold(confirm, (down) => this.setConfirm(down));
    if (cancel) this.hold(cancel, (down) => this.setCancel(down));
    if (start) this.hold(start, (down) => this.setStart(down));
  }

  private hold(el: HTMLElement, set: (down: boolean) => void): void {
    const press = (event: PointerEvent) => {
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      el.classList.add('is-down');
      this.noteTouch();
      set(true);
    };
    const release = () => {
      el.classList.remove('is-down');
      set(false);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private releaseAll(): void {
    this.dirs = [];
    this.setConfirm(false);
    this.setCancel(false);
    this.setStart(false);
  }
}
