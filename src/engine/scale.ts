/** Largest scale that fills `avail` while keeping 240×160. Integer when the bars stay small. */
export function fitScale(availW: number, availH: number): number {
  if (availW <= 0 || availH <= 0) return 1;
  const fit = Math.min(availW / 240, availH / 160);
  const integer = Math.floor(fit);
  if (integer >= 1 && (fit - integer) / fit <= 0.12) return integer;
  return fit;
}

export function applyScale(canvas: HTMLCanvasElement): void {
  const stage = canvas.parentElement;
  if (!stage) return;
  const scale = fitScale(stage.clientWidth, stage.clientHeight);
  canvas.style.width = `${240 * scale}px`;
  canvas.style.height = `${160 * scale}px`;
}

export function placeControls(showTouch: boolean): void {
  const body = document.body;
  const portrait = window.innerHeight >= window.innerWidth;
  body.classList.toggle('touch-mode', showTouch);
  body.classList.toggle('portrait', portrait);
  body.classList.toggle('landscape', !portrait);
  const dpad = document.getElementById('dpad');
  const actions = document.getElementById('actions');
  const left = document.getElementById('slot-left');
  const right = document.getElementById('slot-right');
  const bottom = document.getElementById('slot-bottom');
  if (!dpad || !actions || !left || !right || !bottom) return;
  if (portrait) bottom.append(dpad, actions);
  else {
    left.append(dpad);
    right.append(actions);
  }
}
