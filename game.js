'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');
const skinSelect = document.getElementById('skin-select');

// Canvas colors per theme (canvas does not inherit CSS variables)
const THEMES = {
  dark:  { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#e1e3ee', highlight: 'rgba(255,255,255,0.35)' },
};
let theme = 'dark';

// ---- Skins ----
// Each skin defines its piece palette (index 0 unused, 1-7 = I,O,T,S,Z,J,L),
// an optional canvas background and grid color (null = use THEMES[theme]),
// and its own block renderer. Renderers receive pixel coordinates and size.
const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#b71c1c', // J - blood red (darker than Z so they stay distinguishable)
      '#ffb74d', // L - orange
    ],
    bg: null,
    grid: null,
    drawBlock: drawBlockRetro,
  },
  neon: {
    colors: [null, '#00f0ff', '#fff200', '#ff00ff', '#39ff14', '#ff3131', '#b000ff', '#ff8c00'],
    bg: '#000000',
    grid: '#101024',
    drawBlock: drawBlockNeon,
  },
  pastel: {
    colors: [null, '#a0e7e5', '#fdf2a6', '#d7b9f5', '#b4f0c0', '#ffc4cc', '#c98a9a', '#ffd3a8'],
    bg: null,
    grid: null,
    drawBlock: drawBlockPastel,
  },
  pixel: {
    colors: [null, '#3cbcfc', '#f8d838', '#b853f8', '#58d854', '#f83800', '#880014', '#fc9838'],
    bg: null,
    grid: null,
    drawBlock: drawBlockPixel,
  },
};
const SKIN_STORAGE_KEY = 'tetris.skin';
let skin = 'retro';

function drawBlockRetro(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEMES[theme].highlight;
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawBlockNeon(context, px, py, size, color) {
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  // Dim inner fill keeps the glowing outline readable
  const a = context.globalAlpha;
  context.globalAlpha = a * 0.35;
  context.fillStyle = color;
  context.fillRect(px + 4, py + 4, size - 8, size - 8);
  context.globalAlpha = a;
  // Reset so the grid and other drawings are not blurred
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockPastel(context, px, py, size, color) {
  const r = size * 0.25;
  roundRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(0,0,0,0.12)';
  context.lineWidth = 1;
  context.stroke();
  // soft shine
  roundRectPath(context, px + 5, py + 5, size - 10, (size - 10) * 0.35, r * 0.5);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

function drawBlockPixel(context, px, py, size, color) {
  const p = Math.max(1, Math.floor(size / 10)); // one "pixel" of the texture
  const x = px + 1, y = py + 1, s = size - 2;
  context.fillStyle = color;
  context.fillRect(x, y, s, s);
  // light top/left bevel
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fillRect(x, y, s, p);
  context.fillRect(x, y, p, s);
  // dark bottom/right bevel
  context.fillStyle = 'rgba(0,0,0,0.4)';
  context.fillRect(x, y + s - p, s, p);
  context.fillRect(x + s - p, y, p, s);
  // shine pixels
  context.fillStyle = 'rgba(255,255,255,0.7)';
  context.fillRect(x + p, y + p, p, p);
  context.fillRect(x + 2 * p, y + p, p, p);
  context.fillRect(x + p, y + 2 * p, p, p);
  // inner dithered shading
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let r = 3; r < 9; r += 2)
    for (let c = 3 + (r % 4 === 1 ? 1 : 0); c < 9; c += 2)
      context.fillRect(x + c * p, y + r * p, p, p);
}

function fillSkinBackground(context, w, h) {
  const bg = SKINS[skin].bg;
  if (!bg) return;
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);
}

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_STORAGE_KEY);
    if (saved && Object.prototype.hasOwnProperty.call(SKINS, saved)) return saved;
  } catch (e) { /* storage unavailable */ }
  return 'retro';
}

function setSkin(name) {
  skin = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : 'retro';
  skinSelect.value = skin;
  try { localStorage.setItem(SKIN_STORAGE_KEY, skin); } catch (e) { /* storage unavailable */ }
  // Redraw immediately so paused / game-over states update too
  if (current && next) { draw(); drawNext(); }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
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
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
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
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const sk = SKINS[skin];
  context.globalAlpha = alpha ?? 1;
  sk.drawBlock(context, x * size, y * size, size, sk.colors[colorIndex]);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid || THEMES[theme].grid;
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
  fillSkinBackground(ctx, canvas.width, canvas.height);
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
  fillSkinBackground(nextCtx, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function setTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  themeText.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
  // Redraw immediately so paused / game-over states update too
  if (current && next) { draw(); drawNext(); }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() may have ended the game; endGame() cancelled the frame that is
  // already running, so stop here instead of scheduling another one.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Let the focused theme switch handle Space/Enter without dropping the piece
  if (e.target === themeToggle && (e.code === 'Space' || e.code === 'Enter')) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  // Let the focused skin selector handle the other keys (arrows change the option)
  if (e.target === skinSelect) return;
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
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
themeToggle.addEventListener('click', () => {
  setTheme(theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // return keyboard control to the game
});
skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // return keyboard control to the game
});

setSkin(loadSkin());
init();
