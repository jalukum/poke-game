import type { Content } from '../content/load';
import type { Input } from '../engine/input';
import {
  applyStages,
  catchOdds,
  catchShakes,
  computeDamage,
  emptyStages,
  runChance,
  type BattleMon,
  type MoveDef,
  type StatusName,
} from '../sim/battle';
import { expYield, learnableNow, levelFromExp, makeMon, statsFor, type MonInst, type SpeciesDef } from '../sim/growth';
import { drawMenuPanel, drawRevealed, drawShadowText, drawWindow, pageLength } from '../ui/draw';
import { scriptToPages } from '../ui/font';

export interface BattleEnd {
  outcome: 'win' | 'lose' | 'run' | 'catch';
  party: MonInst[];
  caught: MonInst | null;
  seen: string[];
  flag?: string;
  prize: number;
  evolve: { index: number; from: string; to: string } | null;
}

type Mode = 'intro' | 'command' | 'fight' | 'bag' | 'party' | 'replace' | 'text' | 'anim' | 'done';

interface Anim {
  actor: 'player' | 'foe';
  pose: 'attack' | 'hurt' | 'idle';
  t: number;
}

export class BattleScene {
  mode: Mode = 'intro';
  command = 0;
  moveIndex = 0;
  bagIndex = 0;
  partyIndex = 0;
  replaceIndex = 0;
  pendingMove = '';
  textLines: string[][] = [];
  textIndex = 0;
  shown = 0;
  anim: Anim | null = null;
  end: BattleEnd | null = null;
  player: BattleMon;
  foe: BattleMon;
  foeQueue: { species: string; level: number }[];
  party: MonInst[];
  active = 0;
  caught: MonInst | null = null;
  seen = new Set<string>();
  evolve: BattleEnd['evolve'] = null;
  private queue: Array<() => void> = [];

  constructor(
    private readonly content: Content,
    party: MonInst[],
    foeTeam: { species: string; level: number }[],
    private readonly trainer: { name: string; intro: string[]; lose: string[]; prize: number; flag?: string } | null,
    private readonly inventory: { id: string; qty: number }[],
    private readonly onWinText: string[],
  ) {
    this.party = party.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) }));
    this.active = Math.max(0, this.party.findIndex((mon) => mon.hp > 0));
    this.foeQueue = foeTeam.slice(1);
    const lead = foeTeam[0];
    if (!lead) throw new Error('Battle needs a foe');
    this.player = this.toBattle(this.party[this.active]!, 'player');
    this.foe = this.toBattle(makeMon(lead.species, this.species(lead.species), lead.level, 0, (id) => this.pp(id)), 'foe');
    this.seen.add(lead.species);
    const intro = trainer ? [`${trainer.name} wants to battle!`, ...trainer.intro] : [`Wild ${this.foe.name} appeared!`];
    this.say(intro, () => {
      this.mode = 'command';
    });
  }

  update(input: Input): void {
    if (this.anim) {
      this.anim.t -= 1;
      if (this.anim.t <= 0) this.anim = null;
      return;
    }
    if (this.mode === 'text') {
      this.tickText(input);
      return;
    }
    if (this.mode === 'command') this.pick(input, ['FIGHT', 'BAG', 'PARTY', 'RUN'], this.command, (i) => (this.command = i), (i) => this.chooseCommand(i));
    else if (this.mode === 'fight') this.pick(input, this.player.moves.map((move) => this.moveName(move.id)), this.moveIndex, (i) => (this.moveIndex = i), (i) => this.chooseMove(i), () => (this.mode = 'command'));
    else if (this.mode === 'bag') this.pick(input, this.bagLabels(), this.bagIndex, (i) => (this.bagIndex = i), (i) => this.chooseBag(i), () => (this.mode = 'command'));
    else if (this.mode === 'party') this.pick(input, this.partyLabels(), this.partyIndex, (i) => (this.partyIndex = i), (i) => this.chooseParty(i), () => (this.mode = 'command'));
    else if (this.mode === 'replace') this.pick(input, [...this.player.moves.map((move) => this.moveName(move.id)), 'CANCEL'], this.replaceIndex, (i) => (this.replaceIndex = i), (i) => this.chooseReplace(i));
  }

  render(ctx: CanvasRenderingContext2D, frame: number): void {
    ctx.fillStyle = '#d7efe4';
    ctx.fillRect(0, 0, 240, 112);
    ctx.fillStyle = '#b7e0c0';
    for (let y = 0; y < 112; y += 4) ctx.fillRect(0, y, 240, 1);
    this.drawPlatform(ctx, 150, 58);
    this.drawPlatform(ctx, 28, 100);
    const foePose = this.anim?.actor === 'foe' ? this.anim.pose : 'idle';
    const playerPose = this.anim?.actor === 'player' ? this.anim.pose : 'idle';
    this.drawMon(ctx, this.foe.species, foePose, false, 156, 8, frame);
    this.drawMon(ctx, this.player.species, playerPose, true, 12, 48, frame);
    this.drawPlate(ctx, 6, 6, this.foe.name, this.foe.level, this.foe.hp, this.foe.maxHp, false);
    this.drawPlate(ctx, 112, 64, this.player.name, this.player.level, this.player.hp, this.player.maxHp, true);
    if (this.mode === 'text' || this.mode === 'intro') {
      drawWindow(ctx, 4, 112, 232, 44);
      const lines = this.textLines[this.textIndex] ?? [''];
      drawRevealed(ctx, lines, this.shown, 12, 122);
    } else if (this.mode === 'command') {
      drawWindow(ctx, 4, 112, 140, 44);
      drawShadowText(ctx, 'What will', 12, 122);
      drawShadowText(ctx, `${this.player.name.toUpperCase()} do?`, 12, 136);
      drawMenuPanel(ctx, ['FIGHT', 'BAG', 'PARTY', 'RUN'], this.command, frame, { x: 146, y: 96 });
    } else if (this.mode === 'fight') {
      drawMenuPanel(ctx, this.player.moves.map((move) => `${this.moveName(move.id)} ${move.pp}`), this.moveIndex, frame, { x: 8, y: 78 });
    } else if (this.mode === 'bag') {
      drawMenuPanel(ctx, this.bagLabels(), this.bagIndex, frame, { x: 8, y: 70 });
    } else if (this.mode === 'party' || this.mode === 'replace') {
      const labels = this.mode === 'party' ? this.partyLabels() : [...this.player.moves.map((move) => this.moveName(move.id)), 'CANCEL'];
      drawMenuPanel(ctx, labels, this.mode === 'party' ? this.partyIndex : this.replaceIndex, frame, { x: 8, y: 64 });
    }
  }

  private pick(input: Input, labels: string[], index: number, set: (n: number) => void, go: (n: number) => void, back?: () => void): void {
    if (input.edges.cancel && back) {
      back();
      return;
    }
    if (input.edges.dir === 'up') set((index + labels.length - 1) % labels.length);
    if (input.edges.dir === 'down') set((index + 1) % labels.length);
    if (input.edges.confirm) go(index);
  }

  private chooseCommand(index: number): void {
    if (index === 0) this.mode = 'fight';
    else if (index === 1) this.mode = 'bag';
    else if (index === 2) this.mode = 'party';
    else this.tryRun();
  }

  private chooseMove(index: number): void {
    const move = this.player.moves[index];
    if (!move || move.pp <= 0) {
      this.say(['No PP left!'], () => (this.mode = 'fight'));
      return;
    }
    this.playerTurn(move.id);
  }

  private chooseBag(index: number): void {
    const stacks = this.battleItems();
    const stack = stacks[index];
    if (!stack) return;
    const def = this.content.items[stack.id];
    if (!def) return;
    if (def.kind === 'ball') {
      if (this.trainer) {
        this.say(['You cannot catch a trainer Jakamon.'], () => (this.mode = 'command'));
        return;
      }
      stack.qty -= 1;
      this.throwBall(def.power ?? 1);
      return;
    }
    if (def.kind === 'heal' || def.kind === 'status' || def.kind === 'revive') {
      const target = this.party[this.active];
      if (!target) return;
      if (def.kind === 'revive') {
        const fainted = this.party.find((mon) => mon.hp <= 0);
        if (!fainted) {
          this.say(['Nobody has fainted.'], () => (this.mode = 'bag'));
          return;
        }
        const max = statsFor(this.species(fainted.species), fainted.level).hp;
        fainted.hp = Math.max(1, Math.floor(max / 2));
        fainted.status = '';
        stack.qty -= 1;
        this.say([`${this.species(fainted.species).name} is back!`], () => this.foeTurn());
        return;
      }
      if (target.hp <= 0) {
        this.say(['Pick a Jakamon that can fight.'], () => (this.mode = 'bag'));
        return;
      }
      if (def.kind === 'status') target.status = '';
      if (def.kind === 'heal') target.hp = Math.min(this.player.maxHp, target.hp + (def.power ?? 20));
      this.player.hp = target.hp;
      this.player.status = target.status;
      stack.qty -= 1;
      this.say([`Used ${def.name}.`], () => this.foeTurn());
    }
  }

  private chooseParty(index: number): void {
    const mon = this.party[index];
    if (!mon || mon.hp <= 0) {
      this.say(['That Jakamon cannot fight.'], () => (this.mode = 'party'));
      return;
    }
    if (index === this.active) {
      this.mode = 'command';
      return;
    }
    this.switchTo(index, true);
  }

  private chooseReplace(index: number): void {
    if (index >= this.player.moves.length) {
      this.afterPlayerAction();
      return;
    }
    const pp = this.pp(this.pendingMove);
    this.player.moves[index] = { id: this.pendingMove, pp };
    const mon = this.party[this.active];
    if (mon) mon.moves = this.player.moves.map((move) => ({ ...move }));
    this.say([`${this.player.name} learned ${this.moveName(this.pendingMove)}!`], () => this.afterPlayerAction());
  }

  private tryRun(): void {
    if (this.trainer) {
      this.say(["You can't run from a trainer battle!"], () => (this.mode = 'command'));
      return;
    }
    if (runChance(this.player.stats.spe, this.foe.stats.spe, Math.random)) {
      this.finish({ outcome: 'run', party: this.syncParty(), caught: null, seen: [...this.seen], prize: 0, evolve: null });
      return;
    }
    this.say(['Could not get away!'], () => this.foeTurn());
  }

  private throwBall(power: number): void {
    const species = this.species(this.foe.species);
      const odds = catchOdds(this.foe.maxHp, this.foe.hp, species.catchRate, power);
    const shakes = catchShakes(odds, Math.random);
    const lines = [`Threw a ball!`, shakes === 0 ? 'It broke free!' : `It shook ${shakes} time${shakes === 1 ? '' : 's'}!`];
    if (shakes >= 4) {
      const caught = makeMon(this.foe.species, species, this.foe.level, 0, (id) => this.pp(id));
      caught.hp = Math.max(1, this.foe.hp);
      this.caught = caught;
      this.seen.add(this.foe.species);
      lines.push(`${this.foe.name} was caught!`);
      this.say(lines, () => this.finish({ outcome: 'catch', party: this.syncParty(), caught, seen: [...this.seen], prize: 0, evolve: null }));
      return;
    }
    this.say(lines, () => this.foeTurn());
  }

  private playerTurn(moveId: string): void {
    const slot = this.player.moves.find((move) => move.id === moveId);
    if (slot) slot.pp = Math.max(0, slot.pp - 1);
    this.playMove(this.player, this.foe, moveId, 'player', () => {
      if (this.foe.hp <= 0) this.foeFainted();
      else this.foeTurn();
    });
  }

  private foeTurn(): void {
    if (this.foe.status === 'daze' && Math.random() < 0.5) {
      this.foe.status = '';
      this.say([`${this.foe.name} is dazed!`], () => (this.mode = 'command'));
      return;
    }
    const usable = this.foe.moves.filter((move) => move.pp > 0 && (this.content.moves[move.id]?.power ?? 0) > 0);
    const pool = usable.length ? usable : this.foe.moves.filter((move) => move.pp > 0);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? this.foe.moves[0];
    if (!pick) {
      this.mode = 'command';
      return;
    }
    pick.pp = Math.max(0, pick.pp - 1);
    this.playMove(this.foe, this.player, pick.id, 'foe', () => {
      if (this.player.hp <= 0) this.playerFainted();
      else this.mode = 'command';
    });
  }

  private playMove(attacker: BattleMon, defender: BattleMon, moveId: string, _side: 'player' | 'foe', done: () => void): void {
    const move = this.content.moves[moveId];
    if (!move) {
      done();
      return;
    }
    this.anim = { actor: _side, pose: 'attack', t: 12 };
    const result = computeDamage({
      attacker,
      defender,
      move: move as MoveDef,
      chart: this.content.chart,
      rng: Math.random,
    });
    if (!result.miss && result.damage > 0) {
      defender.hp = Math.max(0, defender.hp - result.damage);
      this.anim = { actor: _side === 'player' ? 'foe' : 'player', pose: 'hurt', t: 10 };
    }
    if (move.effect === 'heal') attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.floor(attacker.maxHp / 3));
    if (move.effect === 'atk+' || move.effect === 'def+' || move.effect === 'spe+') attacker.stages = applyStages(attacker.stages, move.effect);
    if (move.effect === 'sap') defender.status = 'sap';
    if (move.effect === 'daze') defender.status = 'daze';
    if (defender.status === 'sap' && defender.hp > 0 && move.effect !== 'sap') defender.hp = Math.max(1, defender.hp - Math.max(1, Math.floor(defender.maxHp / 16)));
    if (_side === 'player') {
      const mon = this.party[this.active];
      if (mon) {
        mon.hp = this.player.hp;
        mon.status = this.player.status;
        mon.moves = this.player.moves.map((entry) => ({ ...entry }));
      }
    }
    const extra: string[] = [];
    if (move.effect === 'heal') extra.push(`${attacker.name} recovered.`);
    if (move.effect === 'atk+' || move.effect === 'def+' || move.effect === 'spe+') extra.push(`${attacker.name} is sharper.`);
    if (move.effect === 'sap') extra.push(`${defender.name} is sapped.`);
    if (move.effect === 'daze') extra.push(`${defender.name} is dazed.`);
    this.say([...result.text, ...extra], () => {
      this.anim = null;
      done();
    });
  }

  private foeFainted(): void {
    const species = this.species(this.foe.species);
    const amount = expYield(species, this.foe.level);
    const mon = this.party[this.active];
    const lines = [`${this.foe.name} fainted!`, `${this.player.name} gained ${amount} EXP.`];
    let needsReplace = false;
    if (mon && mon.hp > 0) {
      const before = mon.level;
      mon.exp += amount;
      const level = levelFromExp(mon.exp);
      if (level > before) {
        const oldMax = this.player.maxHp;
        mon.level = level;
        const stats = statsFor(this.species(mon.species), level);
        mon.hp = Math.min(stats.hp, mon.hp + Math.max(0, stats.hp - oldMax));
        this.player = this.toBattle(mon, 'player');
        lines.push(`${this.player.name} grew to level ${level}!`);
        const learned = learnableNow(this.species(mon.species), before, level);
        const evo = this.species(mon.species).evolvesTo;
        const evoLevel = this.species(mon.species).evolveLevel ?? 999;
        if (evo && level >= evoLevel) this.evolve = { index: this.active, from: mon.species, to: evo };
        const extra = learned.find((id) => !this.player.moves.some((move) => move.id === id));
        if (extra && this.player.moves.length >= 4) {
          this.pendingMove = extra;
          needsReplace = true;
        } else if (extra) {
          this.player.moves.push({ id: extra, pp: this.pp(extra) });
          mon.moves = this.player.moves.map((move) => ({ ...move }));
          lines.push(`${this.player.name} learned ${this.moveName(extra)}!`);
        }
      }
    }
    const sendNext = () => {
      const next = this.foeQueue.shift();
      if (next) {
        this.foe = this.toBattle(makeMon(next.species, this.species(next.species), next.level, 0, (id) => this.pp(id)), 'foe');
        this.seen.add(next.species);
        this.say([`${this.trainer?.name ?? 'The foe'} sent out ${this.foe.name}!`], () => {
          this.mode = 'command';
        });
        return;
      }
      const closing = this.trainer ? this.trainer.lose : this.onWinText;
      this.say(closing, () => {
        this.finish({
          outcome: 'win',
          party: this.syncParty(),
          caught: null,
          seen: [...this.seen],
          flag: this.trainer?.flag,
          prize: this.trainer?.prize ?? 0,
          evolve: this.evolve,
        });
      });
    };
    if (needsReplace) {
      this.say(lines, () => {
        this.mode = 'replace';
        this.resume = sendNext;
      });
      return;
    }
    this.say(lines, sendNext);
  }

  private playerFainted(): void {
    const mon = this.party[this.active];
    if (mon) mon.hp = 0;
    const next = this.party.findIndex((entry, index) => index !== this.active && entry.hp > 0);
    if (next < 0) {
      this.say([`${this.player.name} fainted!`, `${this.content.config.playerName} is out of Jakamon!`], () => {
        this.finish({ outcome: 'lose', party: this.syncParty(), caught: null, seen: [...this.seen], prize: 0, evolve: null });
      });
      return;
    }
    this.say([`${this.player.name} fainted!`], () => this.switchTo(next, false));
  }

  private switchTo(index: number, foeAnswers: boolean): void {
    this.active = index;
    const mon = this.party[index];
    if (!mon) return;
    this.player = this.toBattle(mon, 'player');
    this.say([`Go, ${this.player.name}!`], () => {
      if (foeAnswers && this.foe.hp > 0) this.foeTurn();
      else this.mode = 'command';
    });
  }

  private resume: () => void = () => this.mode = 'command';

  private afterPlayerAction(): void {
    const next = this.resume;
    this.resume = () => {
      this.mode = 'command';
    };
    next();
  }

  private say(chunks: string[], then: () => void): void {
    this.textLines = scriptToPages(chunks, this.content.config.playerName);
    this.textIndex = 0;
    this.shown = 0;
    this.mode = 'text';
    this.queue.push(then);
  }

  private tickText(input: Input): void {
    const lines = this.textLines[this.textIndex] ?? [''];
    const total = pageLength(lines);
    if (this.shown < total) {
      if (input.edges.confirm || input.edges.cancel) this.shown = total;
      else this.shown += this.content.config.textSpeed;
      return;
    }
    if (!input.edges.confirm && !input.edges.cancel) return;
    if (this.textIndex < this.textLines.length - 1) {
      this.textIndex += 1;
      this.shown = 0;
      return;
    }
    const next = this.queue.shift();
    next?.();
  }

  private finish(end: BattleEnd): void {
    this.end = end;
    this.mode = 'done';
  }

  private syncParty(): MonInst[] {
    const copy = this.party.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) }));
    const active = copy[this.active];
    if (active && active.hp > 0) {
      active.hp = this.player.hp;
      active.status = this.player.status as StatusName;
      active.moves = this.player.moves.map((move) => ({ ...move }));
    }
    return copy;
  }

  private toBattle(mon: MonInst, _side: 'player' | 'foe'): BattleMon {
    const species = this.species(mon.species);
    const stats = statsFor(species, mon.level);
    return {
      species: mon.species,
      name: species.name,
      type: species.type as BattleMon['type'],
      level: mon.level,
      hp: Math.min(mon.hp, stats.hp),
      maxHp: stats.hp,
      stats,
      stages: emptyStages(),
      moves: mon.moves.map((move) => ({ ...move })),
      status: mon.status,
    };
  }

  private species(id: string): SpeciesDef {
    const found = this.content.creatures[id];
    if (!found) throw new Error(`Missing species ${id}`);
    return found;
  }

  private pp(id: string): number {
    return this.content.moves[id]?.pp ?? 10;
  }

  private moveName(id: string): string {
    return this.content.moves[id]?.name ?? id;
  }

  private battleItems(): { id: string; qty: number }[] {
    return this.inventory.filter((stack) => stack.qty > 0).filter((stack) => {
      const kind = this.content.items[stack.id]?.kind;
      return kind === 'ball' || kind === 'heal' || kind === 'status' || kind === 'revive';
    });
  }

  private bagLabels(): string[] {
    const stacks = this.battleItems();
    if (!stacks.length) return ['EMPTY'];
    return stacks.map((stack) => `${this.content.items[stack.id]?.name ?? stack.id} x${stack.qty}`);
  }

  private partyLabels(): string[] {
    return this.party.map((mon) => `${this.species(mon.species).name} ${mon.hp}`);
  }

  private drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, level: number, hp: number, max: number, exp: boolean): void {
    drawWindow(ctx, x, y, 112, exp ? 34 : 28);
    drawShadowText(ctx, name.toUpperCase().slice(0, 12), x + 6, y + 4);
    drawShadowText(ctx, `L${level}`, x + 78, y + 4);
    ctx.fillStyle = '#203040';
    ctx.fillRect(x + 8, y + 16, 96, 4);
    ctx.fillStyle = hp * 2 < max ? '#e05040' : '#48c060';
    ctx.fillRect(x + 8, y + 16, Math.round(96 * Math.max(0, hp) / Math.max(1, max)), 4);
    if (exp) {
      ctx.fillStyle = '#3060c0';
      ctx.fillRect(x + 8, y + 24, 60, 3);
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#6aaa55';
    ctx.beginPath();
    ctx.ellipse(x, y, 36, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMon(ctx: CanvasRenderingContext2D, species: string, pose: 'attack' | 'hurt' | 'idle', back: boolean, x: number, y: number, frame: number): void {
    const art = this.content.monArt[species];
    if (!art) return;
    const idle = Math.floor(frame / 24) % 2 === 0 ? art.idle1 : art.idle2;
    const image = pose === 'attack' ? art.attack : pose === 'hurt' ? art.hurt : back ? art.back : idle;
    const used = back && pose === 'idle' ? art.back : image;
    ctx.drawImage(used, x, y, 56, 56);
  }
}

