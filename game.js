'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // + - pink (special)
  '#4db6ac', // U - teal (special)
  '#d4e157', // Y - lime (special)
  '#90a4ae', // single - blue grey (Tetris reward)
  '#a1887f', // hollow square - brown (special)
];

// Visual skins (see the "Skins" section). COLORS always holds the active skin's palette:
// applySkin() copies it into the same array, so every drawing function keeps reading COLORS.
// background/grid null = take them from CSS (--board-bg behind the canvas, --grid).
const SKINS = {
  retro: {
    palette: COLORS.slice(), // the original colors, unchanged
    background: null,
    grid: null,
    block: drawRetroBlock,
  },
  neon: {
    palette: [null, '#00f0ff', '#fff200', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100',
      '#ff00aa', '#00ffc8', '#c6ff00', '#e0e0ff', '#ff6e40'],
    background: '#000000',
    grid: '#0b1d29',
    block: drawNeonBlock,
  },
  pastel: {
    palette: [null, '#a8e6ef', '#fff1a8', '#d7b8f3', '#b9f2c3', '#ffb3ba', '#bcd4ff', '#ffd6a5',
      '#ffc4dd', '#a8e0d8', '#e6f5a8', '#cfd8dc', '#d7c4b7'],
    background: '#2d2a3e',
    grid: '#3a364e',
    block: drawPastelBlock,
  },
  pixel: {
    palette: [null, '#3cbcfc', '#fcd848', '#a44cf0', '#58d854', '#e83c3c', '#4878f8', '#fc9838',
      '#f878f8', '#00b8a8', '#b8f818', '#bcbcbc', '#ac7c00'],
    background: '#101020',
    grid: '#1e1e36',
    block: drawPixelBlock,
  },
};
let activeSkin = SKINS.retro;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // + pentomino
  [[9,0,9],[9,9,9],[0,0,0]],                  // U pentomino
  [[0,10,0,0],[0,10,10,0],[0,10,0,0],[0,10,0,0]], // Y pentomino
  [[11]],                                      // single (1x1)
  [[12,12,12],[12,0,12],[12,12,12]],           // hollow square (center stays empty)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Scoring system (see scoreMove). All values are multiplied by the level, except the combo.
const TSPIN_SCORES = [400, 800, 1200, 1600];  // T-spin with 0, 1, 2, 3 lines
const TSPIN_MINI_SCORES = [100, 200, 400];    // T-spin Mini with 0, 1, 2 lines
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // empty board after clearing 1-4 lines
const B2B_MULTIPLIER = 1.5;                   // applies to the base points of an eligible clear
const MAX_COMBO_MULTIPLIER = 8;               // cap for the combo multiplier

// Special pieces (indices into PIECES). The 7 classic pieces stay the main set.
const PENTOMINOES = [8, 9, 10];  // +, U, Y
const SINGLE = 11;               // always the next piece after a Tetris
const HOLLOW = 12;               // hollow 3x3 square
const PENTOMINO_CHANCE = 0.08;   // chance that a generated piece is a pentomino
const HOLLOW_CHANCE = 0.01;      // chance that a generated piece is the hollow square

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const piecesEl = document.getElementById('pieces');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, pieces, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bonusSingle, lastSpecial, combo, b2b, lastRotated, startLevel, freshKeys, maxCombo;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// Picks the next piece type: the Tetris reward first, then an occasional special piece,
// otherwise a classic one. Two special pieces never come in a row (except the reward).
function randomType() {
  if (bonusSingle) {
    bonusSingle = false;
    return SINGLE;
  }
  if (!lastSpecial) {
    const r = Math.random();
    if (r < HOLLOW_CHANCE) return HOLLOW;
    if (r < HOLLOW_CHANCE + PENTOMINO_CHANCE)
      return PENTOMINOES[Math.floor(Math.random() * PENTOMINOES.length)];
  }
  return Math.floor(Math.random() * 7) + 1;
}

function randomPiece() {
  const type = randomType();
  lastSpecial = type > 7;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      current.rot = ((current.rot || 0) + 1) % 4; // 0 = spawn orientation (a T points up)
      lastRotated = true;                         // a T-spin needs a rotation as the last move
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// ---- Game events ----
// The rules emit events; visuals and sound subscribe (see "Feedback" below), so the rules
// can change without rewriting the animations.
const gameListeners = [];
function onGameEvent(fn) { gameListeners.push(fn); }
function emit(event) { for (const fn of gameListeners) fn(event); }

// ---- Scoring (single place where every bonus is combined) ----
// points = round((base x B2B + perfect clear) x combo)
//  - base: LINE_SCORES, or the T-spin table, times the level
//  - B2B only multiplies the base; perfect clear is added without B2B
//  - the combo multiplier (capped) multiplies the total
// A T-spin with no lines scores its base points, breaks the combo and leaves B2B untouched.
// Pure function: it reads nothing from the game state, so it can be tested on its own.
function scoreMove({ cleared, tspin, perfect, combo: comboIn, b2b: b2bIn, level: lvl }) {
  const events = [];
  const table = tspin === 'mini' ? TSPIN_MINI_SCORES : tspin ? TSPIN_SCORES : LINE_SCORES;
  let base = (table[cleared] || 0) * lvl;

  const eligible = cleared > 0 && (cleared === 4 || Boolean(tspin));
  let b2bOut = b2bIn;
  let b2bApplied = false;
  if (cleared > 0) {
    if (eligible) {
      b2bApplied = b2bIn >= 1;
      b2bOut = b2bIn + 1;
    } else {
      b2bOut = 0;
    }
  }
  if (b2bApplied) base = Math.round(base * B2B_MULTIPLIER);

  const perfectBonus = perfect ? (PERFECT_CLEAR_SCORES[cleared] || 0) * lvl : 0;
  const comboOut = cleared > 0 ? comboIn + 1 : 0;
  const multiplier = cleared > 0 ? Math.min(comboOut, MAX_COMBO_MULTIPLIER) : 1;
  const points = Math.round((base + perfectBonus) * multiplier);

  if (tspin) events.push({ type: 'tspin', variant: tspin, cleared, label: tspinLabel(tspin, cleared) });
  if (cleared > 0) events.push({ type: 'combo', combo: comboOut, multiplier });
  else if (comboIn > 0) events.push({ type: 'combo-break', previous: comboIn });
  if (cleared > 0 && eligible) events.push({ type: b2bApplied ? 'b2b' : 'b2b-start', chain: b2bOut });
  else if (cleared > 0 && b2bIn > 0) events.push({ type: 'b2b-break', previous: b2bIn });
  if (perfect) events.push({ type: 'perfect-clear', cleared, bonus: perfectBonus });
  events.push({ type: 'score', points, cleared });

  return { points, combo: comboOut, multiplier, b2b: b2bOut, b2bApplied, perfectBonus, events };
}

function tspinLabel(variant, cleared) {
  const names = ['', ' SINGLE', ' DOUBLE', ' TRIPLE'];
  return variant === 'mini' ? 'T-SPIN MINI' + (cleared > 1 ? names[cleared] : '') : 'T-SPIN' + names[cleared];
}

// T-spin: the last move was a rotation of a T piece and at least 3 of the 4 corners of its
// 3x3 box are occupied (wall, floor or block). Normal if both corners on the side the T
// points to are occupied; otherwise Mini. (The wall-kick exception of the guideline is not applied.)
function detectTSpin() {
  if (current.type !== 3 || !lastRotated) return null;
  const occupied = (dx, dy) => {
    const x = current.x + dx, y = current.y + dy;
    return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0);
  };
  const corners = [occupied(0, 0), occupied(2, 0), occupied(0, 2), occupied(2, 2)]; // TL, TR, BL, BR
  if (corners.filter(Boolean).length < 3) return null;
  const front = [[0, 1], [1, 3], [2, 3], [0, 2]][current.rot || 0]; // up, right, down, left
  return corners[front[0]] && corners[front[1]] ? 'normal' : 'mini';
}

function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

// Applies the result of a lock: score, combo, B2B, lines, level and the events.
function settleMove(cleared, tspin) {
  const perfect = cleared > 0 && board.every(row => row.every(v => v === 0));
  const result = scoreMove({ cleared, tspin, perfect, combo, b2b, level });
  score += result.points;
  combo = result.combo;
  maxCombo = Math.max(maxCombo, combo); // best combo of this game, for the records
  b2b = result.b2b;
  if (cleared) {
    lines += cleared;
    if (cleared === 4) bonusSingle = true; // reward: the next generated piece is the 1x1 block
    level = Math.max(startLevel, Math.floor(lines / 10) + 1); // never below the chosen start level
    dropInterval = dropIntervalFor(level);
  }
  result.events.forEach(emit);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastRotated = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastRotated = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = detectTSpin(); // needs the board before the piece is merged
  merge();
  pieces++;
  settleMove(clearLines(), tspin);
  updateHUD();
  spawn();
}

function spawn() {
  lastRotated = false;
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  piecesEl.textContent = pieces;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  activeSkin.block(context, x * size, y * size, size, COLORS[colorIndex]); // see "Skins"
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.grid || getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fillSkinBackground(ctx, canvas);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  fillSkinBackground(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  closePauseMenu(); // the GAME OVER overlay keeps only its title, score and Reiniciar
  recordGameOver(); // stores the game and shows the records table (see Records)
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    closePauseMenu();
    freshKeys = new Set(); // keys held through the pause must be pressed again
    lastTime = performance.now();
    animId = requestAnimationFrame(loop); // draw() runs in the loop, not in this input handler
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastRotated = false;
    } else {
      lockPiece();
    }
  }
  draw();
  // Si la gravedad terminó la partida, no programar otro frame: el bucle se detiene aquí.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  startLevel = Number(startLevelSelect.value); // chosen in the pause menu, applies from this game on
  level = startLevel;
  pieces = 0;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  bonusSingle = false;
  lastSpecial = false;
  combo = 0;
  b2b = 0;
  lastRotated = false;
  freshKeys = new Set();
  maxCombo = 0;
  resetRecordsView(); // a new game hides the GAME OVER records form and highlight
  emit({ type: 'reset' });
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target.id === 'volume' && e.code.startsWith('Arrow')) return; // the slider uses the arrows
  // the skin list uses the arrows too, and Space opens it, so it can be used from the keyboard
  if (e.target.id === 'skin-select' && (e.code.startsWith('Arrow') || e.code === 'Space')) return;
  const pauseKey = (e.code === 'KeyP' || e.code === 'Escape') && !e.ctrlKey && !e.metaKey && !e.altKey;
  // Typing a name must not move, drop or pause. A focused select (skin, start level) still
  // lets P/Escape toggle the pause, so the pause menu can be closed from its own selector.
  if (isTextEntry(e.target) && !(pauseKey && e.target.matches('select'))) return;
  if (pauseKey) {
    if (!e.repeat) togglePause();
    return;
  }
  if (paused || gameOver || isStaleRepeat(e)) return; // the pause menu blocks game keys
  if (e.code.startsWith('Arrow')) e.preventDefault(); // the page may scroll at small sizes
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastRotated = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastRotated = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

const themeBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro';
  try { localStorage.setItem('theme', theme); } catch (e) { /* almacenamiento no disponible */ }
  if (current) draw();
}

themeBtn.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  applyTheme(isLight ? 'dark' : 'light');
  themeBtn.blur(); // evita que Espacio/Enter reactive el botón durante el juego
});

applyTheme(document.documentElement.getAttribute('data-theme'));

// ---- Skins ----
// Purely visual: a skin only changes COLORS, the board background, the grid and how drawBlock
// paints a cell. It never touches the game state. The light/dark theme keeps styling the page.
const skinSelect = document.getElementById('skin-select');

// Each block function paints one cell whose top-left pixel is (px, py). drawBlock has already
// set globalAlpha (0.2 for the ghost) and resets it afterwards.
function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

// Dim core and a bright outline with a glow (shadowBlur). The glow is costly, so each
// (color, size) is drawn once into a cached sprite with room around it for the glow; the
// sprite's shadowBlur is reset so it never leaks into other drawing.
const neonSprites = {};
function neonSprite(color, size) {
  const key = color + '/' + size;
  if (neonSprites[key]) return neonSprites[key];
  const pad = size; // the glow spreads into the neighboring cells
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size + 2 * pad;
  const g = sprite.getContext('2d');
  g.globalAlpha = 0.35;
  g.fillStyle = color;
  g.fillRect(pad + 3, pad + 3, size - 6, size - 6);
  g.globalAlpha = 1;
  g.shadowColor = color;
  g.shadowBlur = size / 2;
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.strokeRect(pad + 4, pad + 4, size - 8, size - 8);
  g.shadowBlur = 0;
  return (neonSprites[key] = sprite);
}

function drawNeonBlock(context, px, py, size, color) {
  context.drawImage(neonSprite(color, size), px - size, py - size);
}

// Soft colors with rounded corners, plus a soft shine on top.
function drawPastelBlock(context, px, py, size, color) {
  context.beginPath();
  context.roundRect(px + 1, py + 1, size - 2, size - 2, size / 4);
  context.fillStyle = color;
  context.fill();
  context.beginPath();
  context.roundRect(px + size * 0.2, py + size * 0.15, size * 0.6, size * 0.2, size * 0.1);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fill();
}

// 8-bit look: flat color plus a cached overlay with a bevel and a checkered dither.
const pixelTextures = {};
function pixelTexture(s) {
  if (pixelTextures[s]) return pixelTextures[s];
  const tex = document.createElement('canvas');
  tex.width = tex.height = s;
  const g = tex.getContext('2d');
  const p = Math.max(1, Math.floor(s / 7)); // size of one "pixel" of the texture
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let i = 1; i * p < s - p; i++)
    for (let j = 1; j * p < s - p; j++)
      if ((i + j) % 2 === 0) g.fillRect(i * p, j * p, p, p);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(0, 0, s, p);
  g.fillRect(0, 0, p, s);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, s - p, s, p);
  g.fillRect(s - p, 0, p, s);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillRect(p, p, p, p);
  return (pixelTextures[s] = tex);
}

function drawPixelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.drawImage(pixelTexture(size - 2), px + 1, py + 1);
}

// Called by draw() and drawNext() right after clearing. Retro leaves the canvas transparent
// so the CSS background (--board-bg) shows through, as before.
function fillSkinBackground(context, cnv) {
  if (!activeSkin.background) return;
  context.fillStyle = activeSkin.background;
  context.fillRect(0, 0, cnv.width, cnv.height);
}

function applySkin(name) {
  if (!Object.hasOwn(SKINS, name)) name = 'retro';
  activeSkin = SKINS[name];
  activeSkin.palette.forEach((color, i) => { COLORS[i] = color; }); // same array, new colors
  document.documentElement.setAttribute('data-skin', name);
  skinSelect.value = name;
  try { localStorage.setItem('skin', name); } catch (e) { /* almacenamiento no disponible */ }
  if (current) draw();
  if (next) drawNext();
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // so the arrow keys move the piece again instead of changing the skin
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) { /* almacenamiento no disponible */ }
applySkin(savedSkin);

// ---- Feedback: visuals and sound ----
// Only subscribes to game events (onGameEvent) and never changes the game state, so the
// scoring rules can change without rewriting the animations.
const comboHud = document.getElementById('combo-hud');
const comboValue = document.getElementById('combo-value');
const b2bHud = document.getElementById('b2b-hud');
const b2bBadge = document.getElementById('b2b-badge');
const toastsEl = document.getElementById('toasts');
const flashEl = document.getElementById('flash');
const soundBtn = document.getElementById('sound-toggle');
const volumeInput = document.getElementById('volume');

const MAX_TOASTS = 3;          // avoids flooding the screen in fast games
const TOAST_MS = 1300;         // keep in sync with the toast-life animation
const COMBO_FEEDBACK_MIN = 2;  // combo x1 is a normal clear: no toast or sound

// ---- Visuals ----
function showToast(text, kind) {
  while (toastsEl.children.length >= MAX_TOASTS) toastsEl.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = text;
  toastsEl.appendChild(el);
  setTimeout(() => el.remove(), TOAST_MS);
}

function intensityLevel(multiplier) {
  return multiplier >= MAX_COMBO_MULTIPLIER ? 3 : multiplier >= 5 ? 2 : multiplier >= 3 ? 1 : 0;
}

function renderEvent(e) {
  switch (e.type) {
    case 'reset':
      comboHud.hidden = true;
      b2bHud.hidden = true;
      toastsEl.replaceChildren();
      break;
    case 'combo':
      comboHud.hidden = false;
      comboHud.dataset.nivel = intensityLevel(e.multiplier);
      comboValue.textContent = `×${e.multiplier}`;
      comboValue.classList.remove('pulse');
      void comboValue.offsetWidth; // restarts the animation
      comboValue.classList.add('pulse');
      if (e.combo >= COMBO_FEEDBACK_MIN) showToast(`COMBO ×${e.multiplier}`, 'combo');
      break;
    case 'combo-break':
      comboHud.hidden = true;
      comboHud.dataset.nivel = 0;
      break;
    case 'tspin':
      showToast(e.label, 'tspin');
      break;
    case 'b2b-start':
      b2bHud.hidden = false;
      b2bBadge.textContent = 'B2B ACTIVADO';
      showToast('B2B ACTIVADO', 'b2b');
      break;
    case 'b2b':
      b2bHud.hidden = false;
      b2bBadge.textContent = `B2B x${e.chain}`;
      showToast('BACK-TO-BACK', 'b2b');
      break;
    case 'b2b-break':
      b2bHud.hidden = true;
      break;
    case 'perfect-clear':
      showToast('PERFECT CLEAR', 'perfect');
      flashEl.classList.remove('on');
      void flashEl.offsetWidth;
      flashEl.classList.add('on');
      break;
  }
}

// ---- Sound (Web Audio, no files). soundLog keeps the last sounds, for the tests. ----
const sound = { enabled: true, volume: 0.4 };
const soundLog = [];
let audioCtx = null;

try {
  if (localStorage.getItem('sound') === 'off') sound.enabled = false;
  const v = parseFloat(localStorage.getItem('volume'));
  if (v >= 0 && v <= 1) sound.volume = v;
} catch (e) { /* almacenamiento no disponible */ }

function beep(freq, start, duration, type, gain) {
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = audioCtx.currentTime + start;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playSound(name, intensity = 0) {
  if (!sound.enabled || sound.volume <= 0) return;
  soundLog.push({ name, intensity, volume: sound.volume });
  if (soundLog.length > 20) soundLog.shift();
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const g = sound.volume * (0.2 + 0.04 * Math.min(intensity, MAX_COMBO_MULTIPLIER)); // louder with the combo
    if (name === 'combo') beep(440 * 2 ** (Math.min(intensity, 12) / 12), 0, 0.1, 'triangle', g);
    if (name === 'tspin') { beep(660, 0, 0.09, 'square', g * 0.6); beep(990, 0.09, 0.14, 'square', g * 0.6); }
    if (name === 'b2b') { beep(523, 0, 0.1, 'sine', g); beep(784, 0.1, 0.18, 'sine', g); }
    if (name === 'perfect') [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.1, 0.22, 'sine', g));
  } catch (err) { /* sin audio disponible */ }
}

function soundEvent(e) {
  if (e.type === 'combo' && e.combo >= COMBO_FEEDBACK_MIN) playSound('combo', e.multiplier);
  else if (e.type === 'tspin') playSound('tspin', e.cleared);
  else if (e.type === 'b2b' || e.type === 'b2b-start') playSound('b2b', e.chain);
  else if (e.type === 'perfect-clear') playSound('perfect', e.cleared);
}

function refreshSoundControls() {
  soundBtn.textContent = sound.enabled && sound.volume > 0 ? '🔊' : '🔇';
  volumeInput.value = Math.round(sound.volume * 100);
}

soundBtn.addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  try { localStorage.setItem('sound', sound.enabled ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ }
  refreshSoundControls();
  soundBtn.blur(); // so Space/Enter does not toggle it during the game
});

volumeInput.addEventListener('input', () => {
  sound.volume = volumeInput.value / 100;
  try { localStorage.setItem('volume', String(sound.volume)); } catch (e) { /* sin almacenamiento */ }
  refreshSoundControls();
});
volumeInput.addEventListener('change', () => volumeInput.blur());

refreshSoundControls();
onGameEvent(renderEvent);
onGameEvent(soundEvent);

// ---- Pause menu ----
// Shown only while paused (P or Escape): Reanudar, Reiniciar (#restart-btn), Ver controles
// and Nivel inicial. The keydown handler ignores game keys while paused; after resuming,
// auto-repeats of keys held through the pause are ignored until they are pressed again.
const MAX_START_LEVEL = 10;
const resumeBtn = document.getElementById('resume-btn');
const pauseMenu = document.getElementById('pause-menu');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

// Saved start level (localStorage 'startLevel'), 1 when missing or invalid. It is read
// once into the selector; init() reads the selector, so a choice still applies to the
// next game when storage is not available.
function readStartLevel() {
  let n = 1;
  try { n = parseInt(localStorage.getItem('startLevel'), 10); } catch (e) { /* almacenamiento no disponible */ }
  return n >= 1 && n <= MAX_START_LEVEL ? n : 1;
}

function setControlsOpen(open) {
  pauseControls.hidden = !open;
  controlsBtn.setAttribute('aria-expanded', String(open));
  controlsBtn.textContent = open ? 'Ocultar controles' : 'Ver controles';
}

function openPauseMenu() {
  resumeBtn.hidden = false;
  pauseMenu.hidden = false;
  resumeBtn.focus({ preventScroll: true }); // keyboard navigation starts on Reanudar
}

// Also called by init() and endGame(): the menu never stays open outside the pause.
function closePauseMenu() {
  // Blur whatever got focus during the pause (menu or panel buttons reached with Tab),
  // so Space/Enter cannot press it again during the game.
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  resumeBtn.hidden = true;
  pauseMenu.hidden = true;
  setControlsOpen(false);
}

// An auto-repeat keydown is only accepted for a key pressed again after the last
// resume/restart; this drops the repeats of a key held during the pause.
function isStaleRepeat(e) {
  if (!e.repeat) { freshKeys.add(e.code); return false; }
  return !freshKeys.has(e.code);
}

for (let n = 1; n <= MAX_START_LEVEL; n++) startLevelSelect.add(new Option(String(n), String(n)));
startLevelSelect.value = String(readStartLevel());

resumeBtn.addEventListener('click', () => { if (paused) togglePause(); });
controlsBtn.addEventListener('click', () => setControlsOpen(pauseControls.hidden));
startLevelSelect.addEventListener('change', () => {
  try { localStorage.setItem('startLevel', startLevelSelect.value); } catch (e) { /* sin almacenamiento */ }
});

// ---- Records ----
// Local top MAX_RECORDS scores in localStorage ('records'), plus the best combo and the most
// lines of any finished game. A game is stored once, at GAME OVER, with DEFAULT_PLAYER_NAME;
// the name field only renames that row, so restarting (or closing the page) without typing a
// name keeps the score. Only reads the game state: it never changes score, combo or lines.
const MAX_RECORDS = 5;
const RECORDS_KEY = 'records';
const MAX_NAME_LENGTH = 12;
const DEFAULT_PLAYER_NAME = 'Jugador';

const recordsTable = document.getElementById('records-table');
const recordsStats = document.getElementById('records-stats');
const recordsResetBtn = document.getElementById('records-reset');
const recordsConfirm = document.getElementById('records-confirm');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverMessage = document.getElementById('gameover-message');
const gameoverTable = document.getElementById('gameover-table');
const gameoverStats = document.getElementById('gameover-stats');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');

recordName.maxLength = MAX_NAME_LENGTH;

let records = loadRecords();
let recordIndex = -1;     // row of the current game in records.top, -1 if it did not qualify
let recordedGame = false; // the current game is already stored (endGame runs it only once)

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function toCount(v) {
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

// Reads and validates the stored records; corrupt or missing data gives an empty table.
// Without storage it returns `fallback`, so the records of this session are kept in memory.
function loadRecords(fallback = emptyRecords()) {
  let raw;
  try { raw = localStorage.getItem(RECORDS_KEY); } catch (e) { return fallback; }
  let data = null;
  try { data = JSON.parse(raw); } catch (e) { /* datos dañados */ }
  if (!data || typeof data !== 'object') return emptyRecords();
  const top = (Array.isArray(data.top) ? data.top : [])
    .filter(r => r && typeof r === 'object' && Number.isFinite(r.score) && Math.floor(r.score) > 0)
    .map(r => ({
      name: (typeof r.name === 'string' && r.name.trim().slice(0, MAX_NAME_LENGTH)) || DEFAULT_PLAYER_NAME,
      score: Math.floor(r.score),
      lines: toCount(r.lines),
      level: Math.max(1, toCount(r.level)),
      maxCombo: toCount(r.maxCombo),
      date: typeof r.date === 'string' ? r.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
  return {
    top,
    bestCombo: Math.max(toCount(data.bestCombo), ...top.map(r => r.maxCombo)),
    maxLines: Math.max(toCount(data.maxLines), ...top.map(r => r.lines)),
  };
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) { /* sin almacenamiento: solo en memoria */ }
}

// 0-based row the score would take, or -1 if it does not enter the table.
// A tie goes below the older score, so it needs to beat the last row of a full table.
function recordRank(points) {
  if (points <= 0) return -1;
  const rank = records.top.filter(r => r.score >= points).length;
  return rank < MAX_RECORDS ? rank : -1;
}

function renderRecordTable(tbody) {
  tbody.replaceChildren();
  if (!records.top.length) {
    const tr = tbody.insertRow();
    tr.className = 'records-empty';
    const td = tr.insertCell();
    td.colSpan = 6;
    td.textContent = 'Sin récords todavía';
    return;
  }
  records.top.forEach((r, i) => {
    const tr = tbody.insertRow();
    if (i === recordIndex) tr.className = 'record-current';
    const when = r.date ? new Date(r.date) : null;
    if (when && !isNaN(when)) tr.title = when.toLocaleString();
    for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.level, r.maxCombo])
      tr.insertCell().textContent = v;
  });
}

function renderRecordStats(el) {
  const comboEl = document.createElement('strong');
  comboEl.className = 'best-combo';
  comboEl.textContent = records.bestCombo;
  const maxLinesEl = document.createElement('strong');
  maxLinesEl.className = 'max-lines';
  maxLinesEl.textContent = records.maxLines;
  el.replaceChildren('Mejor combo: ', comboEl, ' · Líneas máximas: ', maxLinesEl);
}

function renderRecords() {
  renderRecordTable(recordsTable);
  renderRecordTable(gameoverTable);
  renderRecordStats(recordsStats);
  renderRecordStats(gameoverStats);
}

// Called from endGame(): stores the game and shows the table in the GAME OVER overlay.
function recordGameOver() {
  if (recordedGame) return;
  recordedGame = true;
  records = loadRecords(records); // another tab may have saved since this page loaded
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  recordIndex = recordRank(score);
  if (recordIndex >= 0) {
    records.top.splice(recordIndex, 0,
      { name: DEFAULT_PLAYER_NAME, score, lines, level, maxCombo, date: new Date().toISOString() });
    records.top.length = Math.min(records.top.length, MAX_RECORDS);
  }
  saveRecords();
  renderRecords();
  const isRecord = recordIndex >= 0;
  gameoverMessage.textContent = isRecord ? `¡Nuevo récord! Puesto #${recordIndex + 1}` : 'Sin récord esta vez';
  gameoverMessage.classList.toggle('is-record', isRecord);
  recordName.value = '';
  recordForm.hidden = !isRecord;
  gameoverRecords.hidden = false;
  if (isRecord) recordName.focus({ preventScroll: true });
}

// Names the row of this game. The form hides afterwards, so a game is named only once.
function saveRecordName() {
  if (recordIndex < 0 || recordForm.hidden) return;
  const name = recordName.value.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_PLAYER_NAME;
  records.top[recordIndex].name = name;
  saveRecords();
  renderRecords();
  recordForm.hidden = true;
  recordName.blur();
  gameoverMessage.textContent = `¡Nuevo récord! Puesto #${recordIndex + 1} · Guardado`;
}

// Called from init(): a new game hides the GAME OVER part and the highlighted row.
function resetRecordsView() {
  recordedGame = false;
  recordIndex = -1;
  if (overlay.contains(document.activeElement)) document.activeElement.blur(); // name field or Reiniciar: keys go back to the game
  gameoverRecords.hidden = true;
  renderRecords();
}

function clearRecords() {
  records = emptyRecords();
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* sin almacenamiento */ }
  recordIndex = -1;
  recordForm.hidden = true; // the row to name is gone
  gameoverMessage.textContent = 'Récords borrados';
  gameoverMessage.classList.remove('is-record');
  renderRecords();
}

// Text fields and selects get the keys; the game ignores them (the volume slider is handled apart).
function isTextEntry(el) {
  return el instanceof HTMLElement && (el.isContentEditable || el.matches('textarea, select') ||
    (el.matches('input') && el.type !== 'range'));
}

function showResetConfirm(show) {
  recordsResetBtn.hidden = show;
  recordsConfirm.hidden = !show;
}

// The key that ended the game may still be held: its auto-repeat must not fill the name.
recordName.addEventListener('keydown', e => { if (e.repeat) e.preventDefault(); });
recordName.addEventListener('input', () => { recordName.value = recordName.value.trimStart(); });
recordForm.addEventListener('submit', e => {
  e.preventDefault(); // Enter or Guardar: stay on the page
  saveRecordName();
});
recordsResetBtn.addEventListener('click', () => { showResetConfirm(true); recordsResetBtn.blur(); });
document.getElementById('records-confirm-yes').addEventListener('click', e => {
  clearRecords();
  showResetConfirm(false);
  e.currentTarget.blur();
});
document.getElementById('records-confirm-no').addEventListener('click', e => {
  showResetConfirm(false);
  e.currentTarget.blur();
});

init();
