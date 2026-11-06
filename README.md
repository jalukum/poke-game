# Jakamon

A small original monster-catching game in a handheld 16-bit style. The screen is a fixed 240×160 frame, scaled with nearest-neighbor filtering and letterboxed to the window. It is not affiliated with Nintendo or Game Freak. Tiles, the trainer, names, and moves are original. The Jakamon sprites in `public/sprites/jakamon/` are the owner's art.

Professor Maple Hollis of Willow Town studies Jakamon. Sol, Eater of Food, once kept the sun bright. Team Eclipse hid five Sun Shards. You clear the forest (open first), then the beach, the mountain, the mire, and the snow. Each dungeon boss opens the next gate. After the fifth shard, the sun shrine opens. Beat Umbra, then you may meet Sol.

## Play

```bash
npm install
npm run dev
```

Open the printed URL (`http://localhost:5173/poke-game/` by default).

| Input | Action |
| --- | --- |
| Arrow keys | Walk and move cursors |
| Z | Confirm (A) |
| X | Cancel (B). Hold to run |
| Enter | Start menu |
| `` ` `` | Debug flag list |

A tap on a new direction turns in place. Hold it to walk. On a phone, a D-pad plus A, B, and Start appears. Touch shows the controls; a keyboard hides them.

New Game is an introduction, a look (style, 8 hair colours, skin, clothes), a letter-grid name, and a choice of Milo, Lukas, or Stinky Mango. Saves are version 2. A version 1 shell save migrates to an empty version 2 team.

`npm test` covers movement, collision, saves, maps, battle math, catching, and evolution. `npm run build` writes `dist/`. Pushing `main` deploys to https://jalukum.github.io/poke-game/.

## Data you can rewrite

Everything named in the story lives in JSON:

| File | Contents |
| --- | --- |
| `public/data/config.json` | Title, start tile, default flags |
| `public/data/creatures.json` | Names, types, stats, learnsets, evolution |
| `public/data/moves.json` | Moves |
| `public/data/types.json` | Eight-type chart |
| `public/data/items.json` | Bag items and the mart list (`mart: true`) |
| `public/data/encounters.json` | Tall-grass tables and level ranges |
| `public/data/trainers.json` | Rival, route trainers, Eclipse bosses, Umbra |
| `public/data/dialogue/` | Professor, townsfolk, signs, credits |
| `public/data/npcs.json` | Where people stand, and who battles on sight |

Types are Sun, Leaf, Tide, Stone, Gust, Spark, Shade, and Bloom. A move of the user's own type is stronger. Gates use `dungeon_forest`, `dungeon_beach`, `dungeon_mountain`, `dungeon_swamp`, and `dungeon_snow`. The forest road is open. Each flag is set by winning that dungeon's boss and opens the next area. `beat_umbra` lets you speak to Sol. `sol_done` is the ending.

Kai's first partner is whichever starter you did not take (Milo, Lukas, or Stinky Mango, in that cycle).

`npm run generate` rebuilds the tileset, trainer sheets, world map picture, and Tiled maps. It overwrites `public/data/maps` and `config.json`. Edit maps in Tiled after generating, or edit the generator in `scripts/lib/world.mjs`.

## Decisions

- One overworld engine, separate maps connected at the edges, plus a MAP screen drawn from `public/sprites/worldmap.png`.
- Healing is Willow Hearth. The shop is Maple Market. The sun mark on the Hearth door is original.
- Hair and clothes are palette keys (`#ff00ff` and `#00e0e0`) swapped at runtime. Styles are fluff, cap, and ribbon.
- Experience is `(level - 1)² × 10`. Izzy and Eden evolve at 16 and 32.
- Catching is four shakes. Odds rise when HP is low and when the ball's `power` is higher.
- Wild Jakamon are base forms only. Sol is only in the shrine after Umbra.

The world is an empty shell: a town, four building interiors, and five biome routes with tall grass and small caves. There are no wild encounters, no parties, and no NPCs placed yet. Those systems read data files, so they show up when you add entries.

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints. With the default base path that is `http://localhost:5173/poke-game/`.

| Input | Action |
| --- | --- |
| Arrow keys | Walk, and move cursors |
| Z | Confirm (A) |
| X | Cancel (B). Hold to run |
| Enter | Start. Opens and closes the menu |
| `` ` `` | Debug flag list (also the DEBUG row in the menu) |

A tap on a new direction turns in place. Hold it to walk. Walking takes 16 frames per tile and running takes 8. On a phone, a D-pad plus A, B, and Start appears under the screen in portrait and on the sides in landscape. Touch shows the controls; a keyboard hides them. Desktop browsers do not show them.

`npm test` checks movement, collision, saves, and the shipped maps. `npm run build` typechecks and writes `dist/`.

## Change the title

`public/data/config.json` is the one file for the name on the title screen, the default player name, the starting tile, text speed, and the flags a new game begins with.

```json
{
  "title": "POKE GAME",
  "playerName": "HERO",
  "textSpeed": 2,
  "showDebug": true,
  "start": { "map": "town", "x": 8, "y": 9, "facing": "down" }
}
```

The web app manifest name in `vite.config.ts` is separate. Change it too if the installed PWA should use a new name.

## Layout

```
public/data/config.json          title, start, flags, map list
public/data/maps/*.json          Tiled maps (what the game loads)
public/data/dialogue/world.json  sign and dialogue pages
public/data/npcs.json            NPC spawns (empty)
public/data/items.json           item catalog
public/tilesets/overworld.png    tileset image
public/tilesets/overworld.tsj    tileset, collision, animation
public/sprites/player.png        6 poses × 4 directions
src/sim                         movement, collision, saves (no rendering)
scripts/generate-all.mjs        rebuilds art and the starter maps
```

`npm run generate` rewrites the PNG tileset, sprites, icons, and every map JSON from `scripts/lib`. Edit the JSON in Tiled after that. Running the generator again overwrites those files.

## Maps

Maps are uncompressed [Tiled](https://www.mapeditor.org/) JSON, 16×16 orthogonal tiles. Open `public/data/maps/town.json`. The tileset link is `public/tilesets/overworld.tsj`.

Layers, drawn in this order:

| Layer | What belongs there |
| --- | --- |
| `ground` | Terrain, floors, paths |
| `objects` | Walls, trunks, doors, furniture, signs. Drawn under the player |
| `fringe` | Tall grass. Drawn over the player's legs |
| `overhead` | Roofs and tree canopy. Drawn over the player |
| `events` | Object layer for warps, connections, gates, signs, items |

Tile properties live on the tileset:

- `solid` — the player cannot enter any cell where this tile is used
- `encounter` — tall grass. Stepping on it calls `checkWildEncounter` in `src/game/encounters.ts`, which returns nothing until you add battles

Animated tiles (water, flowers, tall grass) use a Tiled animation on the tile id you paint. The engine plays it.

Add the new file name to `config.json` → `maps` or it will not load.

### Warps

On the `events` layer, a tile object of type `warp`:

| Property | Meaning |
| --- | --- |
| `map` | Destination map id |
| `x`, `y` | Destination tile |
| `facing` | `up`, `down`, `left`, or `right` |

The player lands on that tile. It must be walkable, and it must not itself be a warp or the two maps will loop. Doors in this project put the warp on the door and land you one tile inside.

### Map edges

A point object of type `connection`:

| Property | Meaning |
| --- | --- |
| `side` | The edge you walk off: `up`, `down`, `left`, `right` |
| `map` | The map on the other side |
| `offset` | Added to the crossing coordinate. `0` when the roads line up |

Leaving north arrives on the south edge of the destination at `x + offset`. East arrives on the west edge at `y + offset`. Pair them: if town's east side is the beach, the beach's west side should be town.

The routes are a 40×30 ring around Willow Town:

- West, open: Verdant Path (forest), then south into Dune Walk
- North, flag `dungeon1_cleared`: Frost Lane
- East, flag `dungeon2_cleared`: Tidal Reach
- South, flag `dungeon3_cleared`: Ridge Trail
- Dune Walk sits between the forest and the ridge and opens with `dungeon4_cleared`

An odd ring of five maps cannot close with only opposite edges, so the desert completes the southwest loop (forest → desert → mountain → town) while snow and the beach are the other two sides of town.

### Gates

A rectangle object of type `gate`. While its flag is false the rect is solid and the engine draws the barrier tiles. When the flag is true the path underneath is open.

| Property | Meaning |
| --- | --- |
| `flag` | Save flag, for example `dungeon1_cleared` |
| `tiles` | Comma-separated GIDs, row by row, one per tile of the rect |

Toggle flags from the menu's DEBUG row or with the backtick key. A new game starts with running shoes on and every dungeon flag off. Edit `defaultFlags` in the config to open a route from the start.

### Signs

Type `sign`, property `dialogue` = an id from a dialogue file. The sign tile blocks movement. Face it and press Z.

## Dialogue

`public/data/dialogue/world.json` is a map of id → pages:

```json
{
  "villager_hello": ["Hi, {player}!", "The lab is up the road."]
}
```

`{player}` becomes the save's name. Each string is one page. Lines wrap to two rows in the text box; anything longer spills onto the next page. List new files in `config.json` → `dialogue`.

Z advances or finishes the current line. X closes the box.

## NPCs

`public/data/npcs.json` is an array. It ships empty. `public/data/examples/npc.example.json` is a template the game does not load.

```json
{
  "id": "villager",
  "map": "town",
  "x": 12,
  "y": 14,
  "sprite": "npc",
  "facing": "down",
  "dialogue": "villager_hello"
}
```

`sprite` is `npc` (the villager sheet) or `player`. They stand still, block their tile, and turn to face you when spoken to. Sheets are 16×32, rows down/up/left/right, columns stand, walk1, walk2, run1, run2, run3.

## Items

`public/data/items.json` is the catalog (`name`, `description`). Nothing is placed in the world. To place one, add an `item` object on `events` (see `public/data/examples/item-object.example.json`):

| Property | Meaning |
| --- | --- |
| `item` | Catalog id |
| `flag` | Set when picked up, so it does not return |

Face the tile and press Z. The item is stored in the save. BAG lists whatever you are carrying; until then it says the bag is empty. POKEDEX, POKEMON, and OPTION are placeholders. SAVE writes the current slot. The name row shows a small trainer card (name, time, place).

## Saves

Three slots in `localStorage`, keys `pokegame.save.slot.0` through `.2`. The payload is versioned:

```json
{
  "version": 1,
  "playerName": "HERO",
  "playTimeMs": 0,
  "mapId": "town",
  "x": 8,
  "y": 9,
  "facing": "down",
  "flags": { "running_shoes": true },
  "inventory": [],
  "locationName": "WILLOW TOWN"
}
```

`version` lives in `src/sim/save.ts` (`SAVE_VERSION`). A newer or broken file is refused instead of loaded. New Game writes a save immediately so the slot appears. Moving does not autosave; use the menu.

## Deploy

GitHub Pages for this repo is `https://jalukum.github.io/poke-game/`. Vite's `base` is `/poke-game/`. `.github/workflows/pages.yml` tests, builds, and deploys `dist/` on every push to `main` with the Pages workflow. The app is an installable PWA (manifest plus service worker).
