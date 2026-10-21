# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No build, no deps, no package.json, no tests, no linter. README is in Spanish; UI strings are Spanish too.

Run: open `index.html` directly, or serve statically (`python -m http.server 8000`).

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, `game.js` (all logic, single global script, `'use strict'`).

- Board = `ROWS×COLS` matrix; cell is `0` or piece type 1–7. The same index keys `COLORS` and `PIECES` (index 0 is `null`), and piece shape matrices hold their own type number as cell value.
- Game state lives in module-level `let` globals (`board, current, next, score, ...`), reset by `init()`. Restart button calls `init()`.
- Flow: `loop` (rAF) drops piece on `dropInterval` → `lockPiece` = `merge` → `clearLines` → `spawn`. `spawn` calls `endGame` if new piece collides. Soft/hard drop and lock also route through `lockPiece`.
- Pause cancels rAF and restarts `loop` manually on resume; `endGame` cancels rAF.

## Non-standard pieces

- `PIECES`/`COLORS` indices 10–14: `+`, `U`, `Y`, single (`SINGLE`=13), hollow 3×3. Indices 8–9 are reserved (power-up cell, `WILD`) and `null` in `PIECES`.
- `randomPiece` priority: `pendingPower` > `pendingSingle` (set by a 4-line clear in `clearLines`) > `RARE_CHANCE` roll (`randomRareType`, `RARE_WEIGHTS`) > standard 1–7. `makePiece(type)` builds any piece.

## Power-ups

- Every `POWER_EVERY` lines (`clearLines` sets `pendingPower`) `randomPiece` returns a 1×1 piece (`type`/cell `POWER_CELL`=8, `power` key into `POWERUPS`). `lockPiece` calls `applyPower` instead of `merge`.
- Cell `WILD`=9 (from tint) lives in the board; `isRowComplete` lets wilds cover up to `MAX_WILD_FILL` holes. `COLORS` has entries 8–9 with no `PIECES` counterpart.
- Freeze: `freezeLeft` ms stops `dropAccum` in `loop`; status shown in `#power-status`.

## Combo / scoring

- `clearLines(tspin)` computes score: base (`LINE_SCORES` or `TSPIN_SCORES`) × `B2B_FACTOR` (if `b2b` and difficult clear) × level × combo mult (`combo` capped `MAX_COMBO_MULT`), plus `PERFECT_BONUS`. No clear → `combo = 0`; `b2b` only resets on a non-difficult clear.
- T-spin: `isTSpin()` (3-corner rule) is called in `lockPiece` before `merge`; `lastMoveRotate` is set by `tryRotate` and cleared by any move/drop.
- Effects (`popups`, `particles`, `flashRows`, shake) are drawn in `drawEffects` inside `draw(dt)`; audio is WebAudio (`tone`, `playClearSound`), unlocked on first keydown; `M` mutes.

## Challenges

- `CHALLENGES` entries trigger when `level` first reaches `c.level` (`queueChallenges` in `clearLines` → `challengeQueue`; `spawn` calls `startChallenge` when none active, since no piece is in play at lock time). Config flags: `goalLines`, `surviveMs`, `timeLimit`, `garbageEvery`, `prefill`, `hideLocked`, `reverseRot`. `challenge` global = active one, `null` otherwise; reset by `init()`.
- `loop` advances `elapsed`/`garbageAccum`; lines goal checked in `lockPiece` (relative to `challengeStartLines`). `endChallenge(success)`: bonus `CHALLENGE_BONUS`×level on success; failure only a popup, game continues. Only `endGame` ends the run.
- Cell `GARBAGE`=15 via `pushRow` (garbage rows, obstacle rows). Objective panel `#goal-section` shown only while a challenge is active.

## Abilities

- `energy` (0–`ENERGY_MAX`) grows `ENERGY_PER_LINE` per cleared line (`gainEnergy` in `clearLines`). `E` → `openMenu` (needs full bar) cancels rAF; `closeMenu` restarts it. `ABILITIES` list; `menuMode` `'main'|'swap'`; keys 1–4 / 1–7, `Esc`.
- `next` is `queue[0]`; `spawn` shifts `queue`, `refillQueue` tops it up (pending power/single inserted at front; `peekLeft` > 0 keeps `PEEK_COUNT` queued).
- `saveUndo()` runs at start of `lockPiece` (board, score, queue, combo, challenge state; not challenge clock). `undoPlacement` restores it. `held` = hold slot, free mechanic (`C`/`Shift` → `holdPiece`, not an ability); `holdUsed` limits it to once per piece (reset in `spawn`, saved in undo snapshot, dims `#hold-canvas` via `.locked`). `slowLeft` multiplies drop interval by `SLOW_FACTOR` in `loop`.

## Gotchas

- Layout: `[.panel-left][#board][.panel-right]`; board is CSS-scaled (`height: min(600px, 100vh - 110px)`), internal canvas stays `300×600`. `keydown` `preventDefault`s `GAME_KEYS` (arrows/Space) so page never scrolls.
- `index.html` loads `style.css?v=N` and `game.js?v=N` (GitHub Pages caches 10 min). Bump `N` in both when changing either file.
- Canvas size is hardcoded in `index.html` (`300×600` board, `120×120` next). Changing `COLS/ROWS/BLOCK` in `game.js` requires updating those attributes. `drawNext` uses its own `NB = 30` and centers the piece's bounding box in the canvas.
- Level/speed formula lives in `updateSpeed()` (called by `init` and `clearLines`).
- `README.md` says "~300 lines" and documents controls/scoring; keep in sync if mechanics change.

## Records

- `localStorage` key `tetris-records`: `{ top: [{name, score}] (max `TOP_SIZE`=5), bestCombo, maxLines }`. `loadRecords`/`saveRecords`/`recordRank`/`renderRecords`.
- `endGame` updates `bestCombo` (`maxComboRun`, set in `clearLines`) and `maxLines`, shows `#name-form` if `recordRank` ≥ 0 (`pendingRecord`); `commitRecord` (form submit or Restart) inserts the entry. `keydown` ignores events from `#name-input`.
- Start screen: `showStart()` after first `init()` (`atStart` blocks pause/keys until `startGame`). "Borrar records" → `resetRecords`.
