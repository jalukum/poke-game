import { BattleScene } from './battleScene';
import type { Content, NpcDef } from '../content/load';
import { Sfx } from '../engine/audio';
import type { Input } from '../engine/input';
import { HAIR, OUTFIT, SKIN, STYLES, recolorSheet } from './recolor';
import { createActor, movementPose, spriteOffset, tileInFront, type ActorState, type Pose } from '../sim/movement';
import { makeMon, statsFor, type MonInst } from '../sim/growth';
import { defaultAppearance, formatPlayTime, listSaves, writeSave, SAVE_VERSION, type Appearance, type InventoryEntry, type SaveGame, type SavedMon } from '../sim/save';
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
import { drawOutlinedText, scriptToPages, textWidth, wrapText } from '../ui/font';

type Scene = 'title' | 'saves' | 'world' | 'create';
type Overlay = 'dex' | 'party' | 'map' | null;

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
  private money = 300;
  private appearance: Appearance = defaultAppearance();
  private party: SavedMon[] = [];
  private pcBox: SavedMon[] = [];
  private seen: string[] = [];
  private caught: string[] = [];
  private repel = 0;
  private nextUid = 1;
  private starter = '';
  private hero: HTMLCanvasElement | null = null;
  private battle: BattleScene | null = null;
  private solFight = false;
  private phase: 'intro' | 'look' | 'name' | 'starter' = 'intro';
  private lookRow = 0;
  private nameIndex = 0;
  private overlay: Overlay = null;
  private overlayIndex = 0;
  private summary = false;
  private mart = false;
  private storage = false;
  private credits = false;
  private readonly audio = new Sfx();

  constructor(
    private readonly content: Content,
    private readonly input: Input,
    private readonly ctx: CanvasRenderingContext2D,
  ) {
    this.playerName = content.config.playerName;
    this.slots = listSaves(safeStorage());
    this.refreshHero();
  }

  update(): void {
    this.frame += 1;
    this.input.beginFrame();
    if (this.scene === 'world') this.playTimeMs += 1000 / 60;
    if (this.fade) {
      this.tickFade();
      return;
    }
    if (this.battle) {
      if (this.battle.end) this.finishBattle();
      else this.battle.update(this.input);
      return;
    }
    if (this.credits) {
      if (this.input.edges.confirm) this.credits = false;
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
    if (this.summary) {
      if (this.input.edges.cancel || this.input.edges.confirm) this.summary = false;
      return;
    }
    if (this.mart) {
      this.tickMart();
      return;
    }
    if (this.storage) {
      this.tickStorage();
      return;
    }
    if (this.overlay) {
      this.tickOverlay();
      return;
    }
    if (this.menu) {
      this.tickMenu();
      return;
    }
    if (this.scene === 'create') {
      this.tickCreate();
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
    if (this.battle) {
      this.battle.render(ctx, this.frame);
      return;
    }
    if (this.credits) {
      this.renderCredits();
      return;
    }
    if (this.scene === 'title') this.renderTitle();
    else if (this.scene === 'saves') this.renderSaves();
    else if (this.scene === 'create') this.renderCreate();
    else this.renderWorld();
    if (this.overlay === 'dex') this.renderDex();
    if (this.overlay === 'party') this.renderParty();
    if (this.overlay === 'map') this.renderRegionMap();
    if (this.summary) this.renderSummary();
    if (this.mart) drawMenuPanel(ctx, this.martLabels(), this.overlayIndex, this.frame, { x: 16, y: 16 });
    if (this.storage) drawMenuPanel(ctx, this.storageLabels(), this.overlayIndex, this.frame, { x: 16, y: 16 });
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
    this.playerName = '';
    this.flags = { ...config.defaultFlags };
    this.inventory = [];
    this.playTimeMs = 0;
    this.money = 300;
    this.party = [];
    this.pcBox = [];
    this.seen = [];
    this.caught = [];
    this.repel = 0;
    this.starter = '';
    this.appearance = defaultAppearance();
    this.refreshHero();
    this.phase = 'intro';
    this.lookRow = 0;
    this.nameIndex = 0;
    this.scene = 'create';
    this.say(this.content.dialogue.prof_intro ?? ['Welcome.'], () => {
      this.phase = 'look';
    });
  }

  private continueGame(save: SaveGame): void {
    this.slot = this.saveCursor;
    this.playerName = save.playerName;
    this.flags = { ...save.flags };
    this.inventory = save.inventory.map((entry) => ({ ...entry }));
    this.playTimeMs = save.playTimeMs;
    this.money = save.money;
    this.appearance = { ...save.appearance };
    this.party = save.party.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) }));
    this.pcBox = save.box.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) }));
    this.seen = [...save.seen];
    this.caught = [...save.caught];
    this.repel = save.repel;
    this.nextUid = save.nextUid;
    this.starter = save.starter;
    this.refreshHero();
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
    if (result.events.some((event) => event.type === 'encounter')) this.tryEncounter(map.id);
    else if (result.events.some((event) => event.type === 'step')) this.checkSight();
    for (const event of result.events) {
      if (event.type === 'bump') this.audio.bump();
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
      if (npc.role === 'nurse') {
        this.healParty();
        this.say(this.content.dialogue.nurse_done ?? ['All rested.']);
        return true;
      }
      if (npc.role === 'clerk') {
        this.mart = true;
        this.overlayIndex = 0;
        return true;
      }
      if (npc.role === 'pc') {
        this.storage = true;
        this.overlayIndex = 0;
        return true;
      }
      if (npc.role === 'sol') {
        this.offerSol();
        return true;
      }
      if (npc.trainer) {
        const trainer = this.content.trainers[npc.trainer];
        const flag = trainer?.flag ?? `beat_${npc.trainer}`;
        if (trainer && !this.flags[flag]) {
          this.say(trainer.intro, () => this.startTrainer(npc.trainer!));
          return true;
        }
        this.say(trainer?.lose ?? ['That was a good battle.']);
        return true;
      }
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
      { id: 'dex', label: 'JAKDEX' },
      { id: 'party', label: 'JAKAMON' },
      { id: 'bag', label: 'BAG' },
      { id: 'card', label: this.playerName.toUpperCase().slice(0, 10) || 'NAME' },
      { id: 'map', label: 'MAP' },
      { id: 'save', label: 'SAVE' },
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
      if (this.inventory.filter((entry) => entry.qty > 0).length === 0) this.say(['The BAG is empty.']);
      else this.bag = { index: 0 };
      return;
    }
    if (picked.id === 'dex') {
      this.overlay = 'dex';
      this.overlayIndex = 0;
      return;
    }
    if (picked.id === 'party') {
      this.overlay = 'party';
      this.overlayIndex = 0;
      return;
    }
    if (picked.id === 'map') {
      this.overlay = 'map';
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
    if (!def) return;
    if (def.kind === 'heal' || def.kind === 'status' || def.kind === 'revive' || def.kind === 'repel' || def.kind === 'rope') {
      this.useItem(entry.id);
      return;
    }
    this.say([def.name, def.description]);
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

  private refreshHero(): void {
    const base = this.content.playerSheets[this.appearance.style] ?? this.content.player;
    this.hero = recolorSheet(base, this.appearance);
  }

  private tickCreate(): void {
    if (this.phase === 'look') {
      if (this.input.edges.dir === 'up') this.lookRow = (this.lookRow + 3) % 4;
      if (this.input.edges.dir === 'down') this.lookRow = (this.lookRow + 1) % 4;
      if (this.input.edges.dir === 'left' || this.input.edges.dir === 'right') {
        const delta = this.input.edges.dir === 'right' ? 1 : -1;
        if (this.lookRow === 0) {
          const index = STYLES.indexOf(this.appearance.style);
          this.appearance.style = STYLES[(index + delta + STYLES.length) % STYLES.length] ?? 'fluff';
        } else if (this.lookRow === 1) this.appearance.hair = (this.appearance.hair + delta + HAIR.length) % HAIR.length;
        else if (this.lookRow === 2) this.appearance.skin = (this.appearance.skin + delta + SKIN.length) % SKIN.length;
        else this.appearance.outfit = (this.appearance.outfit + delta + OUTFIT.length) % OUTFIT.length;
        this.refreshHero();
      }
      if (this.input.edges.confirm) {
        this.phase = 'name';
        this.playerName = '';
        this.nameIndex = 0;
      }
      return;
    }
    if (this.phase === 'name') this.tickName();
    if (this.phase === 'starter') this.tickStarter();
  }

  private tickName(): void {
    const cols = 9;
    const count = 29;
    if (this.input.edges.dir === 'left') this.nameIndex = (this.nameIndex + count - 1) % count;
    if (this.input.edges.dir === 'right') this.nameIndex = (this.nameIndex + 1) % count;
    if (this.input.edges.dir === 'up') this.nameIndex = (this.nameIndex + count - cols) % count;
    if (this.input.edges.dir === 'down') this.nameIndex = (this.nameIndex + cols) % count;
    if (!this.input.edges.confirm) return;
    if (this.nameIndex < 26) {
      if (this.playerName.length < 8) this.playerName += String.fromCharCode(65 + this.nameIndex);
      return;
    }
    if (this.nameIndex === 26) {
      if (this.playerName.length < 8) this.playerName += ' ';
      return;
    }
    if (this.nameIndex === 27) {
      this.playerName = this.playerName.slice(0, -1);
      return;
    }
    const name = this.playerName.trim();
    if (!name) return;
    this.playerName = name;
    this.ask(`So your name is ${name}?`, ['YES', 'NO'], (index) => {
      if (index === 0) this.phase = 'starter';
      else this.phase = 'name';
    });
  }

  private tickStarter(): void {
    const options = ['MILO', 'LUKAS', 'MANGO'];
    if (this.input.edges.dir === 'left') this.overlayIndex = (this.overlayIndex + 2) % 3;
    if (this.input.edges.dir === 'right') this.overlayIndex = (this.overlayIndex + 1) % 3;
    if (!this.input.edges.confirm) return;
    const ids = ['milo', 'lukas', 'stinky_mango'];
    const species = ids[this.overlayIndex] ?? 'milo';
    this.ask(`Choose ${options[this.overlayIndex]}?`, ['YES', 'NO'], (index) => {
      if (index !== 0) return;
      this.starter = species;
      this.addMon(species, 5, true);
      this.give('twine_ball', 5);
      this.give('sun_balm', 3);
      this.give('dawn_seal', 1);
      const start = this.content.config.start;
      this.scene = 'world';
      this.enter(start.map, start.x, start.y, start.facing);
      this.persist();
      this.say(['Maple smiles.', 'Five Twine Balls and some Sun Balm. The forest road is open.', 'Bring the shards home, and the sun will stay for supper.']);
    });
  }

  private addMon(species: string, level: number, lead: boolean): void {
    const def = this.content.creatures[species];
    if (!def) return;
    const mon = makeMon(species, def, level, this.nextUid, (id) => this.content.moves[id]?.pp ?? 10);
    this.nextUid += 1;
    if (!this.seen.includes(species)) this.seen.push(species);
    if (!this.caught.includes(species)) this.caught.push(species);
    if (lead || this.party.length < 6) this.party.push(mon);
    else this.pcBox.push(mon);
  }

  private give(id: string, qty: number): void {
    const stack = this.inventory.find((entry) => entry.id === id);
    if (stack) stack.qty += qty;
    else this.inventory.push({ id, qty });
  }

  private tryEncounter(mapId: string): void {
    if (this.repel > 0) {
      this.repel -= 1;
      return;
    }
    const table = this.content.encounters[mapId];
    if (!table || this.party.every((mon) => mon.hp <= 0)) return;
    if (Math.random() * 100 > table.rate) return;
    const total = table.table.reduce((sum, row) => sum + row.weight, 0);
    let roll = Math.random() * total;
    let species = table.table[0]?.species ?? 'milo';
    for (const row of table.table) {
      roll -= row.weight;
      if (roll <= 0) {
        species = row.species;
        break;
      }
    }
    const level = table.min + Math.floor(Math.random() * (table.max - table.min + 1));
    this.solFight = false;
    this.battle = new BattleScene(this.content, this.asInst(this.party), [{ species, level }], null, this.inventory, ['The grass goes quiet.']);
  }

  private checkSight(): void {
    const actor = this.actor;
    if (!actor) return;
    for (const npc of this.npcs) {
      if (!npc.trainer || !npc.sight) continue;
      const trainer = this.content.trainers[npc.trainer];
      const flag = trainer?.flag ?? `beat_${npc.trainer}`;
      if (!trainer || this.flags[flag]) continue;
      if (!this.inSight(actor, npc)) continue;
      npc.facing = opposite(actor.facing);
      this.say(trainer.intro, () => this.startTrainer(npc.trainer!));
      return;
    }
  }

  private inSight(actor: ActorState, npc: NpcDef): boolean {
    const range = npc.sight ?? 0;
    const dx = actor.x - npc.x;
    const dy = actor.y - npc.y;
    let tiles = 0;
    if (npc.facing === 'down' && dx === 0 && dy > 0 && dy <= range) tiles = dy;
    else if (npc.facing === 'up' && dx === 0 && dy < 0 && -dy <= range) tiles = -dy;
    else if (npc.facing === 'right' && dy === 0 && dx > 0 && dx <= range) tiles = dx;
    else if (npc.facing === 'left' && dy === 0 && dx < 0 && -dx <= range) tiles = -dx;
    else return false;
    const map = this.currentMap();
    if (!map) return false;
    for (let step = 1; step < tiles; step++) {
      const x = npc.x + Math.sign(dx) * step;
      const y = npc.y + Math.sign(dy) * step;
      if (map.solid[y * map.width + x]) return false;
    }
    return true;
  }

  private startTrainer(id: string): void {
    const trainer = this.content.trainers[id];
    if (!trainer) return;
    const party = trainer.party.map((mon) => ({ ...mon }));
    if (trainer.rival && party[0]) party[0].species = rivalSpecies(this.starter);
    this.solFight = false;
    this.battle = new BattleScene(this.content, this.asInst(this.party), party, trainer, this.inventory, []);
  }

  private offerSol(): void {
    if (!this.flags.beat_umbra) {
      this.say(['The circle of shards is dark.']);
      return;
    }
    if (this.flags.sol_done) {
      this.say(this.content.dialogue.sol_after ?? ['The sun is warm.']);
      return;
    }
    this.say(['Sol, Eater of Food, pads into the light.', 'The sun creature waits, hungry and gentle.'], () => {
      this.solFight = true;
      this.battle = new BattleScene(this.content, this.asInst(this.party), [{ species: 'sol', level: 40 }], null, this.inventory, ['Sol blinks, full of daylight.']);
    });
  }

  private finishBattle(): void {
    const end = this.battle?.end;
    this.battle = null;
    if (!end) return;
    this.party = end.party;
    if (end.caught) {
      end.caught.uid = this.nextUid;
      this.nextUid += 1;
      if (this.party.length < 6) this.party.push(end.caught);
      else this.pcBox.push(end.caught);
      if (!this.caught.includes(end.caught.species)) this.caught.push(end.caught.species);
    }
    for (const id of end.seen) if (!this.seen.includes(id)) this.seen.push(id);
    if (end.flag) this.flags[end.flag] = true;
    this.money += end.prize;
    if (this.solFight && end.outcome !== 'run') {
      this.flags.sol_done = true;
      this.solFight = false;
      this.credits = true;
    }
    if (end.outcome === 'lose') {
      this.blackout();
      return;
    }
    if (end.evolve) {
      this.evolveNow(end.evolve);
      return;
    }
    this.persist();
  }

  private evolveNow(evo: { index: number; from: string; to: string }): void {
    const mon = this.party[evo.index];
    const next = this.content.creatures[evo.to];
    const prev = this.content.creatures[evo.from];
    if (!mon || !next || !prev) return;
    const oldMax = statsFor(prev, mon.level).hp;
    mon.species = evo.to;
    const stats = statsFor(next, mon.level);
    mon.hp = Math.min(stats.hp, mon.hp + Math.max(0, stats.hp - oldMax));
    if (!this.seen.includes(evo.to)) this.seen.push(evo.to);
    if (!this.caught.includes(evo.to)) this.caught.push(evo.to);
    this.say([`${prev.name} is becoming ${next.name}!`, `${next.name} is here.`]);
    this.persist();
  }

  private blackout(): void {
    this.money = Math.floor(this.money / 2);
    this.healParty();
    this.fadeTo(() => {
      this.enter('hearth', 7, 7, 'up');
      this.say(['You woke at Willow Hearth.', 'Your Jakamon are rested.']);
    });
  }

  private healParty(): void {
    for (const mon of this.party) {
      const species = this.content.creatures[mon.species];
      if (!species) continue;
      mon.hp = statsFor(species, mon.level).hp;
      mon.status = '';
      mon.moves = mon.moves.map((move) => ({ ...move, pp: this.content.moves[move.id]?.pp ?? move.pp }));
    }
  }

  private useItem(id: string): void {
    const def = this.content.items[id];
    const stack = this.inventory.find((entry) => entry.id === id);
    if (!def || !stack || stack.qty <= 0) return;
    if (def.kind === 'repel') {
      this.repel = def.power ?? 80;
      stack.qty -= 1;
      this.say(['Wild Jakamon will keep their distance.']);
      return;
    }
    if (def.kind === 'rope') {
      const escape = ESCAPES[this.mapId];
      if (!escape) {
        this.say(['The rope has nothing to catch out here.']);
        return;
      }
      stack.qty -= 1;
      this.fadeTo(() => this.enter(escape.map, escape.x, escape.y, escape.facing));
      return;
    }
    const mon = this.party[this.overlayIndex] ?? this.party.find((entry) => entry.hp > 0);
    if (!mon) return;
    const species = this.content.creatures[mon.species];
    if (!species) return;
    const max = statsFor(species, mon.level).hp;
    if (def.kind === 'revive') {
      if (mon.hp > 0) {
        this.say(['That Jakamon is already up.']);
        return;
      }
      mon.hp = Math.max(1, Math.floor(max / 2));
    } else if (def.kind === 'heal') mon.hp = Math.min(max, mon.hp + (def.power ?? 20));
    else if (def.kind === 'status') mon.status = '';
    stack.qty -= 1;
    this.say([`Used ${def.name}.`]);
  }

  private tickOverlay(): void {
    if (this.input.edges.cancel) {
      this.overlay = null;
      this.summary = false;
      return;
    }
    if (this.overlay === 'map') return;
    const length = this.overlay === 'dex' ? Object.keys(this.content.creatures).length : Math.max(1, this.party.length);
    if (this.input.edges.dir === 'up') this.overlayIndex = (this.overlayIndex + length - 1) % length;
    if (this.input.edges.dir === 'down') this.overlayIndex = (this.overlayIndex + 1) % length;
    if (this.input.edges.confirm && this.overlay === 'party') this.summary = true;
  }

  private tickMart(): void {
    const goods = Object.entries(this.content.items).filter(([, item]) => item.mart);
    if (this.input.edges.cancel) {
      this.mart = false;
      return;
    }
    if (this.input.edges.dir === 'up') this.overlayIndex = (this.overlayIndex + goods.length - 1) % goods.length;
    if (this.input.edges.dir === 'down') this.overlayIndex = (this.overlayIndex + 1) % goods.length;
    if (!this.input.edges.confirm) return;
    const [id, item] = goods[this.overlayIndex] ?? [];
    if (!id || !item || this.money < (item.price ?? 0)) {
      this.say(['Not enough coins.']);
      this.mart = false;
      return;
    }
    this.money -= item.price ?? 0;
    this.give(id, 1);
    this.say([`Bought ${item.name}.`]);
    this.mart = false;
  }

  private tickStorage(): void {
    const labels = this.storageLabels();
    if (this.input.edges.cancel) {
      this.storage = false;
      return;
    }
    if (this.input.edges.dir === 'up') this.overlayIndex = (this.overlayIndex + labels.length - 1) % labels.length;
    if (this.input.edges.dir === 'down') this.overlayIndex = (this.overlayIndex + 1) % labels.length;
    if (!this.input.edges.confirm) return;
    if (this.overlayIndex < this.party.length) {
      if (this.party.length <= 1) return;
      const [mon] = this.party.splice(this.overlayIndex, 1);
      if (mon) this.pcBox.push(mon);
    } else if (this.overlayIndex > this.party.length) {
      const boxIndex = this.overlayIndex - this.party.length - 1;
      if (this.party.length >= 6) return;
      const [mon] = this.pcBox.splice(boxIndex, 1);
      if (mon) this.party.push(mon);
    }
  }

  private asInst(party: SavedMon[]): MonInst[] {
    return party.map((mon) => ({ ...mon, status: mon.status, moves: mon.moves.map((move) => ({ ...move })) }));
  }

  private martLabels(): string[] {
    return Object.entries(this.content.items)
      .filter(([, item]) => item.mart)
      .map(([, item]) => `${item.name} $${item.price}`);
  }

  private storageLabels(): string[] {
    const party = this.party.map((mon) => `OUT ${this.content.creatures[mon.species]?.name ?? mon.species}`);
    const box = this.pcBox.map((mon) => `IN ${this.content.creatures[mon.species]?.name ?? mon.species}`);
    return [...party, '---', ...box];
  }

  private renderCreate(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#183868';
    ctx.fillRect(0, 0, 240, 160);
    if (this.phase === 'look') {
      drawShadowText(ctx, 'HOW DO YOU LOOK?', 48, 8, '#fff8e0');
      const rows = [
        `STYLE ${this.appearance.style.toUpperCase()}`,
        `HAIR ${this.lookRow === 1 ? '<' : ''}${this.appearance.hair + 1}`,
        `SKIN ${this.appearance.skin + 1}`,
        `CLOTHES ${this.appearance.outfit + 1}`,
      ];
      rows.forEach((row, i) => drawShadowText(ctx, `${i === this.lookRow ? '>' : ' '} ${row}`, 16, 96 + i * 12));
      if (this.hero) ctx.drawImage(this.hero, 0, 0, 16, 32, 104, 36, 32, 64);
    } else if (this.phase === 'name') {
      drawShadowText(ctx, this.playerName.padEnd(8, '_'), 80, 8, '#fff8e0');
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ DEL OK';
      for (let i = 0; i < 26; i++) {
        const col = i % 9;
        const row = Math.floor(i / 9);
        drawShadowText(ctx, letters[i] ?? '', 24 + col * 22, 32 + row * 16, i === this.nameIndex ? '#ffe56a' : '#f8f8f8');
      }
      drawShadowText(ctx, 'SPACE', 24, 96, this.nameIndex === 26 ? '#ffe56a' : '#f8f8f8');
      drawShadowText(ctx, 'DEL', 90, 96, this.nameIndex === 27 ? '#ffe56a' : '#f8f8f8');
      drawShadowText(ctx, 'OK', 140, 96, this.nameIndex === 28 ? '#ffe56a' : '#f8f8f8');
    } else if (this.phase === 'starter') {
      drawShadowText(ctx, 'CHOOSE A PARTNER', 48, 8, '#fff8e0');
      const ids = ['milo', 'lukas', 'stinky_mango'];
      ids.forEach((id, i) => {
        const art = this.content.monArt[id];
        const x = 16 + i * 76;
        if (art) ctx.drawImage(this.overlayIndex === i ? art.idle2 : art.idle1, x, 28, 48, 48);
        drawShadowText(ctx, this.content.creatures[id]?.name.toUpperCase().slice(0, 8) ?? '', x, 82, i === this.overlayIndex ? '#ffe56a' : '#f8f8f8');
      });
    }
  }

  private renderDex(): void {
    const ids = Object.keys(this.content.creatures);
    const id = ids[this.overlayIndex] ?? ids[0];
    const species = id ? this.content.creatures[id] : undefined;
    drawWindow(this.ctx, 8, 8, 224, 144);
    drawShadowText(this.ctx, 'JAKDEX', 16, 14, '#ffe56a');
    if (!id || !species) return;
    const known = this.caught.includes(id);
    const met = known || this.seen.includes(id);
    drawShadowText(this.ctx, met ? species.name.toUpperCase() : '-----', 16, 32);
    drawShadowText(this.ctx, met ? species.type.toUpperCase() : '', 16, 48);
    if (known && this.content.monArt[id]) this.ctx.drawImage(this.content.monArt[id].idle1, 150, 28, 48, 48);
    const blurb = known ? species.dex : met ? 'Seen, not caught.' : 'Not met yet.';
    wrapText(blurb, 26).slice(0, 3).forEach((line, i) => drawShadowText(this.ctx, line, 16, 78 + i * 14));
    drawShadowText(this.ctx, `${this.overlayIndex + 1}/${ids.length}`, 16, 130);
  }

  private renderParty(): void {
    const labels = this.party.map((mon) => {
      const name = this.content.creatures[mon.species]?.name ?? mon.species;
      return `${name} L${mon.level} ${mon.hp}`;
    });
    drawMenuPanel(this.ctx, labels.length ? labels : ['NO JAKAMON'], this.overlayIndex, this.frame, { x: 16, y: 16 });
  }

  private renderSummary(): void {
    const mon = this.party[this.overlayIndex];
    if (!mon) return;
    const species = this.content.creatures[mon.species];
    drawWindow(this.ctx, 8, 8, 224, 144);
    drawShadowText(this.ctx, `${species?.name ?? ''} L${mon.level}`, 16, 16);
    drawShadowText(this.ctx, `HP ${mon.hp}`, 16, 32);
    drawShadowText(this.ctx, species?.type.toUpperCase() ?? '', 16, 48);
    mon.moves.forEach((move, i) => {
      drawShadowText(this.ctx, `${this.content.moves[move.id]?.name ?? move.id} ${move.pp}`, 16, 68 + i * 14);
    });
  }

  private renderRegionMap(): void {
    this.ctx.drawImage(this.content.worldMap, 0, 0);
    const labels: [string, number, number][] = [
      ['SNOW', 96, 10],
      ['MIRE', 168, 22],
      ['FOREST', 8, 64],
      ['WILLOW', 104, 64],
      ['RIDGE', 176, 64],
      ['BEACH', 96, 124],
    ];
    for (const [text, x, y] of labels) drawShadowText(this.ctx, text, x, y, '#1a1408');
    const marker = MAP_MARKS[this.mapId] ?? { x: 112, y: 78 };
    this.ctx.fillStyle = '#ffe56a';
    this.ctx.fillRect(marker.x, marker.y, 5, 5);
    this.ctx.fillStyle = '#c03020';
    this.ctx.fillRect(marker.x + 1, marker.y + 1, 3, 3);
  }

  private renderCredits(): void {
    this.ctx.fillStyle = '#071018';
    this.ctx.fillRect(0, 0, 240, 160);
    const lines = this.content.dialogue.credits ?? ['JAKAMON'];
    lines.forEach((line, i) => drawShadowText(this.ctx, line, 16, 16 + i * 14, '#fff8e0'));
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
      money: this.money,
      appearance: { ...this.appearance },
      party: this.party.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) })),
      box: this.pcBox.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) })),
      seen: [...this.seen],
      caught: [...this.caught],
      repel: this.repel,
      nextUid: this.nextUid,
      starter: this.starter,
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
    this.blitSprite(this.hero ?? this.content.player, 'down', pose, 112, 96 + (pose === 'stand' ? 0 : -1));
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
          this.blitSprite(this.hero ?? this.content.player, actor.facing, pose.pose, px - cam.x, py - cam.y - 16 + pose.bob);
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

  private blitSprite(image: CanvasImageSource, dir: Dir, pose: Pose, x: number, y: number): void {
    this.ctx.drawImage(image, POSE_COL[pose] * 16, DIR_ROW[dir] * 32, 16, 32, Math.round(x), Math.round(y), 16, 32);
  }
}

function rivalSpecies(starter: string): string {
  if (starter === 'milo') return 'lukas';
  if (starter === 'lukas') return 'stinky_mango';
  return 'milo';
}

const ESCAPES: Record<string, { map: string; x: number; y: number; facing: Dir }> = {
  dungeon_forest: { map: 'route_forest', x: 8, y: 21, facing: 'down' },
  dungeon_beach: { map: 'route_beach', x: 22, y: 21, facing: 'down' },
  dungeon_mountain: { map: 'route_mountain', x: 30, y: 19, facing: 'down' },
  dungeon_swamp: { map: 'route_swamp', x: 10, y: 17, facing: 'down' },
  dungeon_snow: { map: 'route_snow', x: 26, y: 9, facing: 'down' },
};

const MAP_MARKS: Record<string, { x: number; y: number }> = {
  town: { x: 112, y: 78 },
  route_forest: { x: 36, y: 78 },
  route_beach: { x: 112, y: 130 },
  route_mountain: { x: 190, y: 78 },
  route_swamp: { x: 176, y: 36 },
  route_snow: { x: 112, y: 18 },
  sun_shrine: { x: 128, y: 70 },
};

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
