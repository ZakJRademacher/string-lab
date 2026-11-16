# String Lab: a beginner's walkthrough

This guide explains **how this app was built, step by step**, in the order a real engineer works.
You don't need to understand every line of code. Aim to understand **what each part is for**
and **why it's built that way**. That's the skill that transfers to any project.

**Live site:** <https://string-lab.zakjrademacher.workers.dev>

> **Note:** String Lab is now a static site with no accounts and no server (step 15). Steps 5–7 and 11 describe the server and database it used to have; they are kept because the ideas apply to any app that needs accounts.

---

## Step 0: Run it on your computer

You need [Node.js](https://nodejs.org) 22.18 or newer (this was built with 26).
Open a terminal in the `string-lab` folder and run:

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints (usually <http://localhost:5173>). This runs the app on a
local copy of Cloudflare's runtime, including a local copy of the database.

To run the automatic tests (no internet or Cloudflare account needed):

```bash
npm test
```

---

## Step 1: The big picture (the restaurant)

| Restaurant | In this app | Where |
|---|---|---|
| Dining room (what you see) | The web page: tabs, sliders, 3D view | `public/` |
| Kitchen (hidden work) | A Cloudflare Worker | `worker/` |
| Waiter (carries orders) | The API: URLs starting `/api/...` | `worker/*.js` routes |
| Pantry and order book | Cloudflare D1 (a SQLite database) | `worker/db.js` |
| Host checking reservations | Login (auth) | `worker/auth.js` |
| The recipes | The physics math | `public/physics/` |
| The building's address | Cloudflare's settings | `cloudflare.config.ts` |

---

## Step 2: Plan before coding

Before writing anything, we listed what a user should be able to do:

1. Explore four modules without signing up.
2. Create an account and log in.
3. Save a setup and load it later.

Every file below exists because of one of those stories.

**The scope grew twice**, which is normal: first three extra modules, then "put it on the web".
Each time, the earlier structure made the change smaller:
- The physics was one-file-per-module, so new modules were new files.
- The physics and the web page were separate from the server, so moving the server to
  Cloudflare didn't touch a single physics or page file.

**Good structure makes change cheap.**

---

## Step 3: The "engine" first: `public/physics/`

| File | What it computes |
|---|---|
| `string.js` | A relativistic string loop, its speed (cusps), a physics check, quantum levels |
| `dimensions.js` | Hypercubes in 3–6D, rotating them, flattening them into 3D |
| `calabiYau.js` | A 2D slice of the surface z₁ⁿ + z₂ⁿ = 1, plus a check that every point solves it |
| `compactification.js` | Masses of a string on a circle, and T-duality |
| `validate.js` | The rules for what values are allowed |
| `index.js` | Puts the four together into one "lab state" |

**Key idea: pure functions.** These files know nothing about web pages, databases or AI.
Numbers go in, numbers come out. So:

- The **browser** uses them to draw.
- The **Worker** uses them to check saved data.
- The **tests** can check them in milliseconds.

One copy of the logic, used everywhere: no chance of two versions disagreeing.

---

## Step 4: Tests: `test/`

A test is a tiny program that checks your real program. Examples from this project:

- "Every point on the Calabi–Yau surface really solves the equation."
- "Swapping n ↔ w and R ↔ 1/R never changes the mass" (T-duality).
- "User B cannot read, change or delete user A's save."
- "Passwords are stored hashed, never as plain text."
- "After 20 wrong logins from one address, that address is blocked for a while."

**Testing cloud code offline:** D1 is SQLite, so `test/fakeD1.js` imitates the bit of D1 we
use on top of Node's built-in SQLite. The tests run the *real* Worker code against it.

**A real moment from the build:** the first run had 13 passing and 1 failing. The bug was in
the *test*, not the physics: it expected a number "greater than 0.1" when the right answer was
exactly 0.1. Tests can be wrong too. Read the failure, think, fix the right thing.

---

## Step 5: The database: `worker/db.js` (Cloudflare D1)

D1 is SQLite running on Cloudflare's network. Five tables:

| Table | Holds |
|---|---|
| `users` | Username + a **hash** of the password (never the password itself) |
| `sessions` | Who is logged in (a hash of each login token) |
| `saves` | Saved lab setups, as JSON text, with an `owner_id` |
| `rate_hits` | Recent sign-up and login attempts, for rate limits |

The Worker reaches it as `env.DB`, a **binding** declared in `cloudflare.config.ts`. Every call
is `await`ed because it travels over the network. Tables are created on first use.

---

## Step 6: Login: `worker/auth.js`

1. **Sign up:** the password is scrambled with **PBKDF2** (100,000 rounds), a deliberately slow,
   standard hash built into browsers and Workers. If the database leaked, attackers would
   still not have anyone's password.
2. **Log in:** scramble what was typed, compare to the stored scramble.
3. **Session:** the server gives the browser a long random token in an **httpOnly, Secure
   cookie**. The browser sends it back automatically, but page JavaScript can't read it.
4. **Rate limits** (`worker/rateLimit.js`) slow down anyone guessing passwords.

Two words people mix up:
- **Authentication** = *who are you?* (this file)
- **Authorization** = *are you allowed to touch this?* (next step)

---

## Step 7: The API: `worker/saves.js`

Every route follows the same four steps. Learn this pattern, because it's in every backend you'll ever see:

1. **Authenticate:** is someone logged in? (`requireUser`)
2. **Validate:** is the input sensible? (`validateLabState`)
3. **Authorize:** is it *their* row? (`WHERE id = ? AND owner_id = ?`)
4. **Act:** read or write the database.

Step 3 is the one beginners forget, and it's how real data leaks happen.

The routes use **Hono**, a small framework that looks like Express but runs on Workers.

---

## Step 8: Removing a feature (the AI tutor)

Earlier versions had an AI tutor: a chat box backed by a hosted AI model that could also change
the lab to show you things. It was **removed on request**. Removing something well is a skill
of its own:

1. **Find every reference first.** A search for `tutor` and the AI provider's name found 95 mentions in
   20 files: server code, a dependency, a database table, a dock tab, styles, tests and docs.
2. **Check live data before deleting it.** The live database had a `tutor_messages` table.
   A read-only query confirmed it held 0 rows (the tutor was never switched on), so dropping it
   lost nothing. Never drop a table with real data in it without a backup and a yes.
3. **Leave no dead ends.** Browsers that remembered the tutor tab as "last open" now fall back
   to the maths tab instead of showing an empty panel.
4. **Test that it's gone.** `test/api.test.js` checks that `/api/tutor` now returns 404 and the
   table no longer exists.

The lessons from building it still apply to any AI feature: keep API keys on the server only,
validate everything a model asks to do exactly like user input, save all-or-nothing, and
rate-limit anything that costs money per request.

---

## Step 9: The interface: `public/`

| File | Job |
|---|---|
| `index.html` | Page skeleton; loads Three.js (3D library) via an *import map* |
| `style.css` | Look and layout; colours are variables at the top |
| `app.js` | Wires everything: tabs, sliders, tour, lab panels, maths, login, saves |
| `scene.js` | The shared 3D stage: camera, lights, glow, starfield, drag-to-rotate |
| `views/*.js` | One file per tab: what to draw and what to show in the readout |
| `tour.js` | The guided tour's words and the settings each step shows (step 12) |
| `formulas.js` | "The math behind it": every formula, with your live numbers plugged in |

**Key idea: one source of truth.** `app.js` holds one object, `lab`, with every tab's settings.
Sliders, presets, loaded saves and the tour all change the app the same way: build a new `lab`,
validate it, redraw. One path is much easier to debug than three.

---

## Step 10: Check it like a user would

After the tests passed, the app was opened in a real browser and checked by hand. That caught
problems no test would:

- The tesseract and Calabi–Yau were **too zoomed in** (fixed by scaling).
- The compactification default (n = w = 1) is **its own T-dual twin**, so the chart's two curves
  overlapped and hid the lesson (fixed by changing the default to n = 1, w = 0).
- Sliders had no names for **screen readers** (fixed with `aria-label`).
- The layout was checked at **phone width**.

---

## Step 11: Put it on the internet (Cloudflare)

### What moved where
| Before (your computer) | After (Cloudflare) |
|---|---|
| Express server (`server/`) | A **Worker** (`worker/`), using Hono |
| SQLite file (`data/app.db`) | **D1** database, created automatically on first deploy |
| scrypt password hashing | **PBKDF2** (built into Workers) |
| Rate limits in memory | Rate limits in D1 (a Worker has no lasting memory) |

The `public/` files didn't change at all. Cloudflare serves them directly as static files.

### Deploy a new version
After you change something and `npm test` passes:

```bash
npm run deploy
```

That builds, uploads, and switches the live site to the new version in a few seconds.
Run `cf deploy --dry-run` first if you want to see what would happen without publishing.

### Gotchas met along the way (real ones)
- **"Missing required secrets":** a secret *declared* in `cloudflare.config.ts` must exist before
  deploying. (This came up with the AI tutor's key, before the tutor was removed.)
- **"SQLITE_CANTOPEN" in local dev:** Windows can't open files with paths over 260 characters,
  and this project was in a very deep folder. `vite.config.ts` puts the local database in the
  temp folder in that case.
- **A one-character bug reached the live site.** A message containing an apostrophe (`isn't`)
  was put inside a single-quoted JavaScript string, which broke the whole page. The tests passed
  because none of them loaded the browser files. A check of the live site caught it within a
  minute; the fix was redeployed, and `test/syntax.test.js` now checks every file so it can't
  happen silently again. Lesson: **after every deploy, look at the live site**, and when a bug
  slips through, add a test that would have caught it.

---

## Step 12: Make it explain itself (the explorer)

A simulation nobody understands is just a screensaver. The explorer adds three layers on top of
the same physics code, each aimed at a different reader:

| Layer | For whom | Where |
|---|---|---|
| **Guided tour**: 5 chapters, each ending in a takeaway | Anyone, no maths needed | `public/tour.js` |
| **The math behind it**: real formulas with *your* numbers in them | The curious | `public/formulas.js` |
| **Readout and controls** | People who want to experiment | `views/*.js` |

**The tour is just data.** Each step is an object: a title, a few paragraphs, an optional
formula, a "Try this" suggestion, and the settings to show. Writing a new chapter means writing
words, not code. Because it's data, a test can walk through every step and check that each one
leads to a valid lab and shows the right tab.

**Formulas are written in LaTeX**, the standard language mathematicians use, and drawn with
KaTeX. A test typesets every formula for every tab under more than a hundred different settings.
On its first run it caught a real mistake: `\vec a\,'` puts the prime on a *space* rather than
on the letter. Without that test, it would have shown up as a red error on the live site.

**Graphics pipeline** (`scene.js`), in plain words:
1. Draw the scene.
2. **Bloom:** anything bright gets a soft glow. Only "unlit" materials (the string, edges) are
   bright enough, so the shiny surfaces stay crisp.
3. **Tone mapping:** squeeze the brightness range the way film cameras do, so highlights
   don't clip to flat white.
4. A virtual photo studio (an *environment map*) gives glossy surfaces believable reflections.

**Tuning visuals is done by looking, not by guessing.** Four things were wrong on the first
look and fixed: the cusp glow was a blown-out blob, the worldsheet was first invisible and
then too strong, the Calabi–Yau was washed out by too much reflection, and the compactification
camera was too close to see the twin ring.

**Old saves keep working.** The new "Worldsheet: show/hide" setting didn't exist when earlier
saves were made. Rules in `validate.js` can now carry a *fallback* value that fills in a missing
setting, while a setting that's present but wrong is still rejected. Data lives longer than code;
plan for that.

---

## Step 13: Make it simple enough for anyone

User feedback after step 12: *"It's still very complex."* That's the most valuable kind of
feedback, because the builder is the worst judge of their own app's difficulty. You know what
every symbol means; a visitor doesn't.

**The fix: two modes.**

| Simple (the default) | Advanced (switch at the top) |
|---|---|
| The picture, a short story, 2–3 plain controls | Every setting, the numbers, the formulas |
| Buttons with words ("Breathing circle", "4D", "6 holes") | Sliders with symbols (m, n, ψ, α, N, Ñ) |
| One plain sentence on the picture | A table of readouts and live formulas |
| No account needed | Accounts and saved setups |

Nothing was deleted. The advanced layer is still there for people who want it; it just isn't
in a beginner's way. This pattern, **progressive disclosure**, is used by almost every good app.

**How it's built:**
- Each view file has a `simple` section: a few `choices` (big buttons that set several settings
  at once), friendly sliders with words at each end, an on/off switch, and a `fact()` that
  writes the sentence shown on the picture.
- Each tour step has `body` (what everyone reads), plus `more` and `tex` (Advanced only).
- The page remembers your choice of mode, and sets it *before* drawing, so it never flashes.

**Simplicity is tested like any other feature** (`test/simple.test.js`):
- every tour step is at most 60 words
- beginner text contains no Greek letters or maths symbols
- every big button produces valid settings
- the sentence on the picture always reads as a proper sentence, for every button and slider end

**Found while checking by hand:** the sentence first said the string moved at "0% of the speed
of light", because it was written before the first frame was drawn. And clicking a topic showed
a 4D shape while the story talked about 3D, so in Simple mode clicking a topic now sets the
picture up to match its story.

---

## Step 14: Build from a reference (the laboratory)

The request: *"something very similar to this Instagram post"*, a 14-second video of another
creator's String Theory Explorer. How a reference becomes a feature list:

1. **Gather it properly.** The post's text described the idea; the video showed the design.
   It was too small to read, so each frame was enlarged and read: the layout, the controls,
   the labels.
2. **Write down what you saw, in your own words**: a module sidebar with presets; an info card
   with a "what is displayed" note; an inspector panel; a play bar; a dock with maths, graphs
   and diagnostics; 0D–9D shapes with a rotation-plane picker; a harmonics mixer.
3. **Notice the conflict, then ask.** The reference is dense; the previous request was "make it
   simple". Rather than guess, the choice went to the owner: the lab look became **Advanced**
   mode, and Simple mode stayed the front door.
4. **Take the ideas, not the pixels.** Everything was rebuilt from our own code and words.

**The best idea borrowed: honesty labels.** Every view now says what kind of picture it is:

| Label | Meaning | Example |
|---|---|---|
| Mathematical result | Computed exactly from the equations | the 9-cube's shadow, the string masses |
| Educational analogy | A simpler stand-in that teaches the idea | the guitar-like string, the degree-4 curve |
| Visual metaphor | A drawing for intuition, not to scale | the hose in Rolled-up space |

**A real bug found by measuring first.** Projecting a 9-cube to 3D one hidden axis at a time
multiplies six "depth factors" together, and some vertices flew off to sizes like 10¹⁶. A
quick script measured the size of every shape from 0D to 9D *before* building the view, so the
problem was found in seconds, not in the browser. The fix (one combined depth factor) is
explained in the maths panel, and a test now spins every shape and checks nothing explodes.

**New files:** `public/lab.css` (the lab layout), `public/charts.js` (small charts for the
Graphs tab), `test/lab.test.js` (14 tests: 0D–9D counts, rotation planes, the spectrum
recovering the mixed-in harmonics, presets, badges, inspector panels).

**Viewer settings vs physics.** Grid on/off, hologram look or mesh resolution are *viewer
preferences*: they live in the browser (`ui`), not in saved setups or the database. Physics
settings (dimension, harmonics, radius) live in `lab`, are validated, and can be saved. Keeping
the two apart keeps the saved data small and meaningful.

---

## Step 15: Going static (removing accounts)

The request: remove sign-in. Saved setups depended on accounts, so the choice was between
dropping saves or keeping them another way. They now live in the visitor's own browser
(`public/saves.js`, using `localStorage`): no account, nothing sent anywhere.

With no accounts and no server-side saves, the server had no job left. So it was removed
completely, and String Lab became a **static site**: just files, served by Cloudflare.

| Before | After |
|---|---|
| Worker code (`worker/`) with Hono, sign-up, login, sessions | none |
| D1 database (users, sessions, saves, rate limits) | not used |
| Saves on the server, per account | saves in the browser (`public/saves.js`) |
| ~70 tests incl. API tests against a fake database | 62 tests; saves tested with a pretend storage |

**Steps 5–7 and 11 describe that server** as history: the ideas (validate, authorize every row,
hash passwords, rate-limit) are still what you'd use the next time an app needs accounts.

Done carefully, as in step 8: the live database was checked first (0 users, 0 saves, 0
sessions), so nobody lost anything. The D1 database itself was **not deleted**, because deleting a
cloud resource is the owner's decision; it simply isn't connected to the site any more.

**Saved data can be damaged or tampered with**, even in your own browser. `saves.js` re-validates
every save when it is read, and the tests feed it broken JSON, impossible settings, and a
browser that blocks storage, to make sure none of those crash the app.

## Step 16: A colour palette ("design tokens")

The look was restyled to match the reference video: a dark scientific-instrument style. Every
colour is a variable at the top of `public/style.css`, so the whole app (including the charts,
which read the same variables) changes in one place:

| Token | Colour | Used for |
|---|---|---|
| `--bg` | `#04070d` | page and 3D space |
| `--panel` / `--line` | `#0a111e` / `#182338` | panels and hairline borders |
| `--accent` | `#38d6ff` cyan | anything active or interactive: buttons, sliders, badges, icons |
| `--accent-2` / `--accent-3` | `#4b8dff` blue / `#9a7bff` violet | gradients, graphs, the T-dual twin |
| `--text` / `--muted` | `#e6edf7` / `#7f8ba3` | text |
| `--ok` / `--warn` / `--bad` | green / amber / red | checks and warnings |

Rules that make a palette feel designed rather than random: **one** bright accent for
"interactive / active"; everything else is quiet. Numbers in a monospace font so digits line
up. Labels small, uppercase and spaced out. The one exception to the cyan rule is the string's
speed colours (blue → orange → white), because there the colour *means* something: how close
to light speed.

---

## Step 17: Smoother animations (measure first)

"Can it run smoother?" is answered with a measurement, not a guess. A small benchmark ran
each animation 120 times and recorded two numbers: time per frame, and how much new memory
("garbage") each frame created.

The maths was never the problem: every frame took under 2 ms of a 16 ms budget. The problem was
**garbage**: some animations built brand-new 3D objects every frame and threw the old ones
away (up to ~7 MB per 2 seconds). The browser has to pause to clean that up, and those pauses
are the stutter you feel.

| Animation | Time per frame, before → after | Garbage per 120 frames, before → after |
|---|---|---|
| Guitar string | 1.55 → 0.12 ms | 7.0 MB → 0 |
| Compactification | 1.59 → 0.10 ms | ~7 MB → 0 |
| 9D cube | 1.14 → 0.18 ms | 3.3 MB → 0 |
| 4D tesseract | 0.12 → 0.02 ms | 2.6 MB → 0 |
| Relativistic loop | 0.32 → 0.14 ms | 1.2 MB → 0 |

**The fixes, in plain words:**
1. **Build once, update forever.** `dynamicTube()` in `scene.js` makes a tube once and then
   only moves its points. The same idea for the fat lines, the worldsheet and the ghost trails.
2. **Write into reusable arrays.** `stringState()` and `frame()` accept last frame's arrays
   and fill them in, instead of creating new ones.
3. **Only redraw what changed.** The readout updates individual numbers; formulas are
   re-typeset only if their text changed, during idle time between frames.
4. **Adaptive quality.** If the frame rate drops below ~45 fps, the 3D view renders at a slightly
   lower resolution; with headroom again, it goes back up. See Diagnostics → "Render scale".
5. **Pause when off-screen.** Nothing is drawn while the 3D view is scrolled away.

**Speed must never change the answers.** `test/performance.test.js` checks that the fast
versions give exactly the same numbers as the simple originals, for every shape from 0D to 9D.

---

## Exercises (in rough order of difficulty)

1. **Change a colour.** Edit `--accent` at the top of `public/style.css` (try `#ff8a3d`, orange). Reload: buttons, sliders, badges and charts all follow.
2. **Change a default.** Make the Calabi–Yau start at n = 3 (`public/physics/calabiYau.js`).
   Run `npm test`: does anything break?
3. **Add a tour step.** In `public/tour.js`, add a step to the Dimensions chapter that shows a
   6-dimensional cross-polytope. Run `npm test`: the tests check your step for you.
4. **Add a test** that a 5-dimensional hypercube has 80 edges (`test/physics.test.js`).
5. **Ship it:** do exercise 1, run `npm test`, then `npm run deploy`, and see your colour live.
6. **Add a slider:** let the user pick the Calabi–Yau's `yRange`. You'll touch the spec
   (`calabiYau.js`), and the inspector section (`calabiYauView.js`).
   This is what a real feature looks like: several small changes across the layers.
7. **Put it in git:** `git init`, then commit. Commit after each exercise from now on.

---

## Honest notes on the physics

- The string animation is a **classical** relativistic string, an exact solution, not a sketch.
- The quantum panel and compactification use the **bosonic** string (26 dimensions) because its
  formulas are simplest; real proposals use superstrings (10 dimensions).
- The Calabi–Yau picture is a **2D slice** of a 6D space, projected to 3D: the standard way it's
  visualized, but only a slice.
- The compactification 3D drawing is an **illustration**; the numbers and chart are exact.
- String theory is a serious, mathematically rich framework, but **not experimentally confirmed**.
