import './style.css';
import { loadGameContent } from './content/load';
import { Input } from './engine/input';
import { applyScale, placeControls } from './engine/scale';
import { Game } from './game/Game';
import { drawText } from './ui/font';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing game canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable');
ctx.imageSmoothingEnabled = false;

const input = new Input();
input.attach(document.body);

function layout(): void {
  placeControls(input.showTouch);
  applyScale(canvas as HTMLCanvasElement);
}

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);
layout();
canvas.focus();

function paintMessage(text: string): void {
  ctx!.fillStyle = '#102038';
  ctx!.fillRect(0, 0, 240, 160);
  drawText(ctx!, text, 16, 76, '#f8f8f8');
}

paintMessage('Loading...');

async function boot(): Promise<void> {
  const content = await loadGameContent(import.meta.env.BASE_URL);
  document.title = content.config.title;
  const game = new Game(content, input, ctx!);
  let lastTouch = input.showTouch;
  let acc = 0;
  let last = performance.now();
  const step = 1000 / 60;
  const frame = (now: number) => {
    if (input.showTouch !== lastTouch) {
      lastTouch = input.showTouch;
      layout();
    }
    const dt = Math.min(100, now - last);
    last = now;
    acc += dt;
    while (acc >= step) {
      game.update();
      acc -= step;
    }
    game.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot().catch((error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : 'Failed to start';
  paintMessage(message.slice(0, 32));
});

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* dev server without the PWA plugin still runs */
    });
}
