import { checkWildEncounter } from './encounters';
import type { Content, NpcDef } from '../content/load';
import { Sfx } from '../engine/audio';
import type { Input } from '../engine/input';
import { createActor, movementPose, spriteOffset, tileInFront, type ActorState, type Pose } from '../sim/movement';
import { formatPlayTime, listSaves, writeSave, SAVE_VERSION, type InventoryEntry, type SaveGame } from '../sim/save';
import { opposite, type Dir, type RuntimeMap } from '../sim/types';
import { updatePlayer } from '../sim/world';
import {
  centeredX,
  drawContinueArrow,
  drawMenuPanel,
  drawRevealed,
  drawShadowText,
  drawTitleBackdrop,
  drawWindow,
  pageLength,
} from '../ui/draw';
import { drawOutlinedText, scriptToPages, textWidth } from '../ui/font';

type Scene = 'title' | 'saves' | 'world';

interface Fade {
  dir: 'out' | 'in';
  t: number;
  next: () => void;
}

interface TextBox {
  pages: string[][];
  index: number;
  shown: number;
  onClose?: () => void;
}

interface Choice {
  options: string[];
  index: number;
  onPick: (index: number) => void;
}

interface MenuState {
  index: number;
}

const POSE_COL: Record<Pose, number> = { stand: 0, walk1: 1, walk2: 2, run1: 3, run2: 4, run3: 5 };
const DIR_ROW: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 };

export class Game {
  private scene: Scene = 'title';
  private frame = 0;
  private fade: Fade | null = null;
  private box: TextBox | null = null;
  private choice: Choice | null = null;
  private menu: MenuState | null = null;
  private bag: MenuState | null = null;
  private debug = false;
  private debugIndex = 0;
  private saveCursor = 0;
  private slots: Array<SaveGame | null> = [null, null, null];
  private slot = 0;
  private actor: ActorState | null = null;
  private mapId = '';
  private npcs: NpcDef[] = [];
  private flags: Record<string, boolean> = {};
  private inventory: InventoryEntry[] = [];
  private playTimeMs = 0;
  private playerName: string;
  private banner: { text: string; t: number } | null = null;
  private readonly audio = new Sfx();

  constructor(
    private readonly content: Content,
    private readonly input: Input,
    private readonly ctx: CanvasRenderingContext2D,
  ) {
    this.playerName = content.config.playerName;
    this.slots = listSaves(safeStorage());
  }

  update(): void {
    this.frame += 1;
    this.input.beginFrame();
    if (this.scene === 'world') this.playTimeMs += 1000 / 60;
    if (this.fade) {
      this.tickFade();
      return;
    }
    if (this.choice) {
      this.tickChoice();
      return;
    }
    if (this.box) {
      this.tickBox();
      return;
    }
    if (this.bag) {
      this.tickBag();
      return;
    }
    if (this.debug) {
      this.tickDebug();
      return;
    }
    if (this.menu) {
      this.tickMenu();
      return;
    }
    if (this.scene === 'title') this.tickTitle();
    else if (this.scene === 'saves') this.tickSaves();
    else this.tickWorld();
  }

  render(): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 240, 160);
    if (this.scene === 'title') this.renderTitle();
    else if (this.scene === 'saves') this.renderSaves();
    else this.renderWorld();
    if (this.box) this.renderBox();
    if (this.choice) this.renderChoice();
    if (this.fade) {
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, this.fade.t / 10))})`;
      ctx.fillRect(0, 0, 240, 160);
    }
  }

  private tickFade(): void {
    if (!this.fade) return;
    if (this.fade.dir === 'out') {
      this.fade.t += 1;
      if (this.fade.t >= 10) {
        const next = this.fade.next;
        this.fade.dir = 'in';
        next();
      }
    } else {
      this.fade.t -= 1;
      if (this.fade.t <= 0) this.fade = null;
    }
  }

  private fadeTo(next: () => void): void {
    this.fade = { dir: 'out', t: 0, next };
  }

  private tickTitle(): void {
    if (this.input.edges.start || this.input.edges.confirm) {
      this.audio.confirm();
      this.slots = listSaves(safeStorage());
      this.fadeTo(() => {
        this.scene = 'saves';
        this.saveCursor = 0;
      });
    }
  }

  private tickSaves(): void {
    if (this.input.edges.cancel) {
      this.audio.cancel();
      this.fadeTo(() => {
        this.scene = 'title';
      });
      return;
    }
    this.saveCursor = this.moveIndex(this.saveCursor, 3);
    if (this.input.edges.confirm) {
      this.audio.confirm();
      const save = this.slots[this.saveCursor];
      const options = save ? ['CONTINUE', 'NEW GAME', 'CANCEL'] : ['NEW GAME', 'CANCEL'];
      this.choice = {
        options,
        index: 0,
        onPick: (index) => this.pickSlot(options[index] ?? 'CANCEL'),
      };
    }
  }

  private pickSlot(option: string): void {
    const save = this.slots[this.saveCursor];
    if (option === 'CANCEL') return;
    if (option === 'CONTINUE' && save) {
      this.fadeTo(() => this.continueGame(save));
      return;
    }
    if (option === 'NEW GAME') {
      if (save) {
        this.ask('Replace this save?', ['YES', 'NO'], (index) => {
          if (index === 0) this.fadeTo(() => this.newGame());
        });
      } else {
        this.fadeTo(() => this.newGame());
      }
    }
  }

  private newGame(): void {
    const { config } = this.content;
    this.slot = this.saveCursor;
    this.playerName = config.playerName;
    this.flags = { ...config.defaultFlags };
    this.inventory = [];
    this.playTimeMs = 0;
    this.scene = 'world';
    this.enter(config.start.map, config.start.x, config.start.y, config.start.facing);
    this.persist();
  }

  private continueGame(save: SaveGame): void {
    this.slot = this.saveCursor;
    this.playerName = save.playerName;
    this.flags = { ...save.flags };
    this.inventory = save.inventory.map((entry) => ({ ...entry }));
    this.playTimeMs = save.playTimeMs;
    this.scene = 'world';
    if (!this.content.maps[save.mapId]) {
      this.scene = 'saves';
      this.say(['That save refers to a missing map.']);
      return;
    }
    this.enter(save.mapId, save.x, save.y, save.facing);
  }

  private enter(mapId: string, x: number, y: number, facing: Dir): void {
    const map = this.content.maps[mapId];
    this.mapId = mapId;
    this.actor = createActor(x, y, facing);
    this.npcs = this.content.npcs.filter((npc) => npc.map === mapId).map((npc) => ({ ...npc }));
    this.banner = map?.showName ? { text: map.name, t: 0 } : null;
  }

  private tickWorld(): void {
    const map = this.currentMap();
    const actor = this.actor;
    if (!map || !actor) return;
    if (this.banner) this.banner.t += 1;
    if (this.input.edges.start) {
      this.audio.confirm();
      this.menu = { index: 0 };
      return;
    }
    if (this.input.edges.debug && this.content.config.showDebug) {
      this.debug = true;
      this.debugIndex = 0;
      return;
    }
    if (this.input.edges.confirm && !actor.moving && !actor.bumpTimer) {
      if (this.tryInteract(actor, map)) return;
    }
    const result = updatePlayer(
      actor,
      { dir: this.input.dir, run: this.input.cancel && this.flags.running_shoes === true },
      map,
      { flags: this.flags, occupants: this.npcs.map((npc) => ({ x: npc.x, y: npc.y })), maps: this.content.maps },
    );
    this.actor = result.actor;
    for (const event of result.events) {
      if (event.type === 'bump') this.audio.bump();
      if (event.type === 'encounter') checkWildEncounter(map, event.x, event.y);
      if (event.type === 'warp') {
        const warp = event.warp;
        this.fadeTo(() => this.enter(warp.map, warp.tx, warp.ty, warp.facing));
        return;
      }
      if (event.type === 'connection') {
        this.fadeTo(() => this.enter(event.mapId, event.x, event.y, event.facing));
        return;
      }
    }
  }

  private tryInteract(actor: ActorState, map: RuntimeMap): boolean {
    const front = tileInFront(actor);
    const npc = this.npcs.find((entry) => entry.x === front.x && entry.y === front.y);
    if (npc) {
      npc.facing = opposite(actor.facing);
      this.say(this.content.dialogue[npc.dialogue] ?? ['...']);
      this.audio.confirm();
      return true;
    }
    const sign = map.signs.find((entry) => entry.x === front.x && entry.y === front.y);
    if (sign) {
      this.say(this.content.dialogue[sign.dialogue] ?? ['...']);
      this.audio.confirm();
      return true;
    }
    const item = map.items.find((entry) => entry.x === front.x && entry.y === front.y && !this.flags[entry.flag]);
    if (item) {
      this.flags[item.flag] = true;
      const known = this.inventory.find((entry) => entry.id === item.itemId);
      if (known) known.qty += 1;
      else this.inventory.push({ id: item.itemId, qty: 1 });
      const name = this.content.items[item.itemId]?.name ?? item.itemId;
      this.say([`You found ${name}!`]);
      this.audio.confirm();
      return true;
    }
    return false;
  }

  private menuItems(): { id: string; label: string }[] {
    const items = [
      { id: 'pokedex', label: 'POKEDEX' },
      { id: 'pokemon', label: 'POKEMON' },
      { id: 'bag', label: 'BAG' },
      { id: 'card', label: this.playerName.toUpperCase().slice(0, 10) },
      { id: 'save', label: 'SAVE' },
      { id: 'option', label: 'OPTION' },
      { id: 'exit', label: 'EXIT' },
    ];
    if (this.content.config.showDebug) items.push({ id: 'debug', label: 'DEBUG' });
    return items;
  }

  private tickMenu(): void {
    if (!this.menu) return;
    const items = this.menuItems();
    if (this.input.edges.cancel || (this.input.edges.start && !this.input.edges.confirm)) {
      this.menu = null;
      this.audio.cancel();
      return;
    }
    this.menu.index = this.moveIndex(this.menu.index, items.length);
    if (!this.input.edges.confirm) return;
    const picked = items[this.menu.index];
    this.menu = null;
    this.audio.confirm();
    if (!picked || picked.id === 'exit') return;
    if (picked.id === 'save') {
      this.ask('Would you like to save the game?', ['YES', 'NO'], (index) => {
        if (index !== 0) return;
        this.persist();
        this.audio.save();
        this.say(['Game saved.']);
      });
      return;
    }
    if (picked.id === 'debug') {
      this.debug = true;
      this.debugIndex = 0;
      return;
    }
    if (picked.id === 'bag') {
      if (this.inventory.length === 0) this.say(['The BAG is empty.']);
      else this.bag = { index: 0 };
      return;
    }
    if (picked.id === 'card') {
      const map = this.currentMap();
      this.say([this.playerName, `Time: ${formatPlayTime(this.playTimeMs)}`, map?.name ?? '']);
      return;
    }
    this.say(['Not available yet.']);
  }

  private tickBag(): void {
    if (!this.bag) return;
    if (this.input.edges.cancel) {
      this.bag = null;
      this.audio.cancel();
      return;
    }
    this.bag.index = this.moveIndex(this.bag.index, this.inventory.length);
    if (!this.input.edges.confirm) return;
    const entry = this.inventory[this.bag.index];
    if (!entry) return;
    const def = this.content.items[entry.id];
    this.audio.confirm();
    this.say([def?.name ?? entry.id, def?.description ?? 'No description.']);
  }

  private tickDebug(): void {
    const names = this.content.flagNames;
    if (names.length === 0 || this.input.edges.cancel || this.input.edges.debug) {
      this.debug = false;
      this.audio.cancel();
      return;
    }
    this.debugIndex = this.moveIndex(this.debugIndex, names.length);
    if (this.input.edges.confirm) {
      const name = names[this.debugIndex];
      if (!name) return;
      this.flags[name] = !this.flags[name];
      this.audio.confirm();
    }
  }

  private tickChoice(): void {
    if (!this.choice) return;
    this.choice.index = this.moveIndex(this.choice.index, this.choice.options.length);
    if (this.input.edges.confirm) {
      const index = this.choice.index;
      const pick = this.choice.onPick;
      this.choice = null;
      this.box = null;
      this.audio.confirm();
      pick(index);
      return;
    }
    if (this.input.edges.cancel) {
      this.choice = null;
      this.box = null;
      this.audio.cancel();
    }
  }

  private tickBox(): void {
    if (!this.box) return;
    const lines = this.box.pages[this.box.index] ?? [''];
    const total = pageLength(lines);
    if (this.box.shown < total) {
      if (this.input.edges.confirm || this.input.edges.cancel) this.box.shown = total;
      else this.box.shown += this.content.config.textSpeed;
      return;
    }
    if (this.input.edges.confirm) {
      this.audio.confirm();
      if (this.box.index < this.box.pages.length - 1) {
        this.box.index += 1;
        this.box.shown = 0;
      } else this.closeBox();
      return;
    }
    if (this.input.edges.cancel) {
      this.audio.cancel();
      this.closeBox();
    }
  }

  private closeBox(): void {
    const done = this.box?.onClose;
    this.box = null;
    done?.();
  }

  private say(chunks: string[], onClose?: () => void): void {
    this.box = { pages: scriptToPages(chunks, this.playerName), index: 0, shown: 0, onClose };
  }

  private ask(question: string, options: string[], onPick: (index: number) => void): void {
    this.box = { pages: scriptToPages([question], this.playerName), index: 0, shown: 9999 };
    this.choice = { options, index: 0, onPick };
  }

  private moveIndex(index: number, length: number): number {
    if (length <= 0) return 0;
    if (this.input.edges.dir === 'up') {
      this.audio.move();
      return (index + length - 1) % length;
    }
    if (this.input.edges.dir === 'down') {
      this.audio.move();
      return (index + 1) % length;
    }
    return index;
  }

  private persist(): void {
    const actor = this.actor;
    const map = this.currentMap();
    if (!actor || !map) return;
    writeSave(safeStorage(), this.slot, {
      version: SAVE_VERSION,
      playerName: this.playerName,
      playTimeMs: Math.floor(this.playTimeMs),
      mapId: map.id,
      x: actor.x,
      y: actor.y,
      facing: actor.facing,
      flags: { ...this.flags },
      inventory: this.inventory.map((entry) => ({ ...entry })),
      locationName: map.name,
    });
    this.slots = listSaves(safeStorage());
  }

  private currentMap(): RuntimeMap | null {
    return this.content.maps[this.mapId] ?? null;
  }

  private renderTitle(): void {
    const ctx = this.ctx;
    drawTitleBackdrop(ctx, this.frame);
    const title = this.content.config.title.toUpperCase();
    const scale = textWidth(title, 3) > 220 ? 2 : 3;
    const x = centeredX(title, scale);
    drawOutlinedText(ctx, title, x, 44, '#ffe56a', '#5a3010', scale);
    const cycle: Pose[] = ['walk1', 'stand', 'walk2', 'stand'];
    const pose = cycle[Math.floor(this.frame / 10) % cycle.length] ?? 'stand';
    this.blitSprite(this.content.player, 'down', pose, 112, 96 + (pose === 'stand' ? 0 : -1));
    if (this.frame % 50 < 32) {
      const label = 'PRESS START';
      drawShadowText(ctx, label, centeredX(label), 146, '#fff8e0');
    }
  }

  private renderSaves(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#183868';
    ctx.fillRect(0, 0, 240, 160);
    ctx.fillStyle = '#204880';
    for (let y = 0; y < 160; y += 4) ctx.fillRect(0, y, 240, 1);
    const title = 'SAVE SELECT';
    drawShadowText(ctx, title, centeredX(title), 8, '#fff8e0');
    drawWindow(ctx, 16, 24, 208, 72);
    const blink = this.frame % 36 < 22;
    for (let i = 0; i < 3; i++) {
      const y = 34 + i * 18;
      if (i === this.saveCursor) this.drawSlotCursor(28, y, blink);
      const save = this.slots[i];
      drawShadowText(ctx, `SLOT ${i + 1}`, 42, y);
      drawShadowText(ctx, save ? save.playerName.toUpperCase() : 'EMPTY', 110, y, save ? '#f8f8f8' : '#d0d8e4');
    }
    drawWindow(ctx, 16, 104, 208, 48);
    const selected = this.slots[this.saveCursor];
    if (!selected) {
      drawShadowText(ctx, 'EMPTY', 28, 116);
      drawShadowText(ctx, 'A new adventure.', 28, 132);
    } else {
      drawShadowText(ctx, selected.playerName.toUpperCase(), 28, 112);
      drawShadowText(ctx, `TIME ${formatPlayTime(selected.playTimeMs)}`, 28, 126);
      drawShadowText(ctx, selected.locationName.toUpperCase(), 28, 140);
    }
  }

  private drawSlotCursor(x: number, y: number, on: boolean): void {
    if (!on) return;
    this.ctx.fillStyle = '#f8f8f8';
    this.ctx.fillRect(x, y + 2, 2, 5);
    this.ctx.fillRect(x + 2, y + 3, 2, 3);
    this.ctx.fillRect(x + 4, y + 4, 2, 1);
  }

  private renderWorld(): void {
    const map = this.currentMap();
    const actor = this.actor;
    if (!map || !actor) return;
    const off = spriteOffset(actor);
    const px = actor.x * 16 + off.x;
    const py = actor.y * 16 + off.y;
    const cam = this.camera(map, px, py);
    const time = this.frame * (1000 / 60);
    this.drawTileLayer(map.ground, map, cam, time);
    this.drawTileLayer(map.objects, map, cam, time);
    this.drawGates(map, cam, time);
    const pose = movementPose(actor);
    const sprites: { y: number; draw: () => void }[] = [
      {
        y: py,
        draw: () => {
          this.drawShadow(px - cam.x, py - cam.y);
          this.blitSprite(this.content.player, actor.facing, pose.pose, px - cam.x, py - cam.y - 16 + pose.bob);
        },
      },
    ];
    for (const npc of this.npcs) {
      const image = npc.sprite === 'player' ? this.content.player : this.content.npc;
      sprites.push({
        y: npc.y * 16,
        draw: () => {
          this.drawShadow(npc.x * 16 - cam.x, npc.y * 16 - cam.y);
          this.blitSprite(image, npc.facing, 'stand', npc.x * 16 - cam.x, npc.y * 16 - cam.y - 16);
        },
      });
    }
    for (const spot of map.items) {
      if (this.flags[spot.flag]) continue;
      const bob = Math.floor(this.frame / 16) % 2;
      sprites.push({
        y: spot.y * 16,
        draw: () => {
          this.ctx.drawImage(this.content.item, spot.x * 16 - cam.x, spot.y * 16 - cam.y - bob);
        },
      });
    }
    sprites.sort((a, b) => a.y - b.y);
    for (const sprite of sprites) sprite.draw();
    this.drawTileLayer(map.fringe, map, cam, time);
    this.drawTileLayer(map.overhead, map, cam, time);
    if (this.banner && this.banner.t < 130) this.renderBanner(this.banner.text, this.banner.t);
    if (this.menu) drawMenuPanel(this.ctx, this.menuItems().map((item) => item.label), this.menu.index, this.frame);
    if (this.bag) {
      const labels = this.inventory.map((entry) => {
        const name = this.content.items[entry.id]?.name ?? entry.id.toUpperCase();
        return entry.qty > 1 ? `${name} x${entry.qty}` : name;
      });
      drawMenuPanel(this.ctx, labels, this.bag.index, this.frame);
    }
    if (this.debug) this.renderDebug();
  }

  private renderBanner(text: string, t: number): void {
    const width = Math.min(200, textWidth(text.toUpperCase()) + 24);
    let x = 8;
    if (t < 12) x = Math.round(-width + ((width + 8) * t) / 12);
    else if (t > 110) x = Math.round(8 - ((width + 16) * (t - 110)) / 20);
    drawWindow(this.ctx, x, 6, width, 22);
    drawShadowText(this.ctx, text.toUpperCase(), x + 10, 12);
  }

  private renderDebug(): void {
    const names = this.content.flagNames;
    drawWindow(this.ctx, 8, 8, 224, 144);
    drawShadowText(this.ctx, 'FLAGS', 16, 14, '#ffe56a');
    const blink = this.frame % 36 < 22;
    names.forEach((name, i) => {
      if (i < this.debugIndex - 6) return;
      const row = i - Math.max(0, this.debugIndex - 6);
      if (row > 6) return;
      const y = 32 + row * 14;
      if (i === this.debugIndex) this.drawSlotCursor(16, y, blink);
      const on = this.flags[name] === true;
      drawShadowText(this.ctx, name.toUpperCase(), 30, y);
      drawShadowText(this.ctx, on ? 'ON' : 'OFF', 180, y, on ? '#b8ffb0' : '#ffd0d0');
    });
  }

  private renderBox(): void {
    if (!this.box) return;
    drawWindow(this.ctx, 4, 108, 232, 48);
    const lines = this.box.pages[this.box.index] ?? [''];
    drawRevealed(this.ctx, lines, this.box.shown, 14, 118);
    if (this.box.shown >= pageLength(lines) && !this.choice) drawContinueArrow(this.ctx, 214, 142, this.frame);
  }

  private renderChoice(): void {
    if (!this.choice) return;
    const width = Math.max(
      56,
      this.choice.options.reduce((max, option) => Math.max(max, textWidth(option)), 0) + 28,
    );
    const height = 10 + this.choice.options.length * 14;
    const x = 240 - width - 8;
    const y = 108 - height - 4;
    drawMenuPanel(this.ctx, this.choice.options, this.choice.index, this.frame, { x, y });
  }

  private camera(map: RuntimeMap, px: number, py: number): { x: number; y: number } {
    const maxX = Math.max(0, map.width * 16 - 240);
    const maxY = Math.max(0, map.height * 16 - 160);
    return {
      x: Math.round(Math.max(0, Math.min(maxX, px + 8 - 120))),
      y: Math.round(Math.max(0, Math.min(maxY, py + 8 - 80))),
    };
  }

  private drawTileLayer(layer: Uint16Array, map: RuntimeMap, cam: { x: number; y: number }, time: number): void {
    const x0 = Math.max(0, Math.floor(cam.x / 16) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / 16) - 1);
    const x1 = Math.min(map.width, Math.ceil((cam.x + 240) / 16) + 1);
    const y1 = Math.min(map.height, Math.ceil((cam.y + 160) / 16) + 1);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const gid = layer[y * map.width + x];
        if (!gid) continue;
        this.content.tiles.draw(this.ctx, gid, x * 16 - cam.x, y * 16 - cam.y, time);
      }
    }
  }

  private drawGates(map: RuntimeMap, cam: { x: number; y: number }, time: number): void {
    for (const gate of map.gates) {
      if (this.flags[gate.flag]) continue;
      gate.tiles.forEach((gid, index) => {
        const tx = gate.x + (index % gate.w);
        const ty = gate.y + Math.floor(index / gate.w);
        this.content.tiles.draw(this.ctx, gid, tx * 16 - cam.x, ty * 16 - cam.y, time);
      });
    }
  }

  private drawShadow(x: number, y: number): void {
    this.ctx.fillStyle = 'rgba(20, 30, 20, 0.35)';
    this.ctx.fillRect(x + 4, y + 13, 8, 2);
    this.ctx.fillRect(x + 3, y + 14, 10, 1);
  }

  private blitSprite(image: HTMLImageElement, dir: Dir, pose: Pose, x: number, y: number): void {
    this.ctx.drawImage(image, POSE_COL[pose] * 16, DIR_ROW[dir] * 32, 16, 32, Math.round(x), Math.round(y), 16, 32);
  }
}

function safeStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* private mode */
  }
  const memory = new Map<string, string>();
  return {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (key) => (memory.has(key) ? memory.get(key)! : null),
    key: (index) => [...memory.keys()][index] ?? null,
    removeItem: (key) => memory.delete(key),
    setItem: (key, value) => memory.set(key, value),
  };
}
