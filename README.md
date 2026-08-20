# 🦫 DAM IT

A cosy 2D building-management game. You are the valley's beaver contractor: hire a
crew, fell (and replant) the forest, dam the river until a pond rises behind it,
grow the right berries and flowers, and build every wild animal the home it asks for.

No build step, no dependencies — it is plain HTML, CSS and ES modules, and every
sprite is drawn with the Canvas 2D API.

## Play it

Because the game uses ES modules, it needs to be served over HTTP (opening
`index.html` straight off disk will be blocked by the browser).

```bash
python3 serve.py          # then open http://localhost:8000
# or
npx serve .
```

Progress is saved to `localStorage` automatically every 30 seconds, on exit, and
whenever you press 💾.

## The loop

1. **Hire a crew.** Five jobs, each fast at one thing:

   | Job | Good at |
   | --- | --- |
   | 🪓 Logger | Felling trees at double speed |
   | 🎒 Hauler | Carries twice the load, walks 35% faster |
   | 📐 Engineer | Dams and habitats at double speed |
   | 🌱 Gardener | Planting — and plants nearby grow faster |
   | 🧺 Forager | Stripping berry bushes, and finding stray seeds |

   Every beaver earns XP, levels up, and banks **skill points** you spend on Swift
   Paws, Big Pockets, Craft and Endurance. They are all paid in **berries at dawn** —
   miss payday and morale drops until they walk off the job.

2. **Gather wood.** Click a grown tree to mark it for felling, or drag across a
   stand to mark several. Beavers chop, carry a load back to the lodge, and return
   for the rest. **The forest is finite** — every tree you fell is gone unless you
   plant saplings, so replant as you go. Felling a tree yields a seed. Beavers
   swim, so open water slows a crossing down but never blocks it — only bare rock does.

3. **Dam the river.** Drop dam segments on the channel; drag along a row to lay
   several. The HUD tells you whether the river is `flowing` or `sealed` — the
   water only rises when *every* channel tile across the river is blocked. Then
   the level climbs one step at a time and floods the low ground behind it.
   Land that the next rise would swallow is tinted blue, so you can see the future
   shoreline before you plant an orchard in it.

4. **Plant what they ask for.** Sunberries, dewberries and goldberries feed the
   crew and the animals; clover, bluebells and sunflowers are what the pickier
   neighbours want. Reed beds only take in still pond water, so dam first.

5. **Build the habitat.** Each animal picks a spot and shows a dashed circle.
   Everything on its wish-list has to sit inside that circle. Tick every box and
   your new neighbour moves in, bringing hearts, berries and seeds. House all
   eight and the valley is complete.

**🪵 Log Slam** is the mini-game: land three tail-slaps in the middle of the log
for spare timber and a burst of progress on every building site.

## Controls

| Input | Does |
| --- | --- |
| Left-click | Mark a tree · place a blueprint · select a beaver |
| Drag | Mark a whole stand of trees, or lay a row of dam |
| Right-click | Cancel placing · demolish a building · pull out a dam segment |
| `Space` | Pause / resume (and SLAM in the mini-game) |
| `1` `2` `3` | Game speed |
| `Esc` | Cancel placing, close a dialog |

## Source layout

```
index.html        page shell: HUD, canvas, sidebar, modals
css/style.css     the whole interface
js/config.js      balance tables — jobs, skills, blueprints, animals, tips
js/state.js       the single mutable game state, resources, save/load
js/util.js        RNG, value noise, A* pathfinding, canvas shape helpers
js/world.js       map generation, the valley's elevation, water-level simulation
js/jobs.js        the job board beavers pull work from
js/beavers.js     hiring, skills, wages, and each beaver's state machine
js/plants.js      growth and ripening
js/build.js       placement rules, build sites, demolition
js/animals.js     animal requests, need checking, residents
js/minigame.js    Log Slam
js/render.js      all canvas drawing
js/ui.js          sidebar, HUD, panels, toasts
js/main.js        bootstrap, game loop, pointer input
```

Tuning the game means editing `js/config.js` — costs, work times, animal wish-lists
and rewards all live there.

For poking around, the browser console has a `DAMIT` hook: `DAMIT.G` is the live
game state and `DAMIT.simulate(0.1)` steps the simulation by hand.
