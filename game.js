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
  '#b0bec5', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
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

let gridColor = '#22222e';
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  // refresca el canvas si el loop está detenido (pausa / game over)
  if (current && (paused || gameOver)) { draw(); drawNext(); }
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) {}
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
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
    level = gameStartLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // en game over la pieza nueva no cabe: no dibujarla encima del tablero
  if (gameOver) return;

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
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function loop(ts) {
  if (gameOver || paused) return;
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
  if (gameOver) return; // endGame ocurrió dentro de este frame: no re-programar
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = gameStartLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Menú de pausa ----
const START_LEVEL_MIN = 1;
const START_LEVEL_MAX = 10;
const RESUME_BLOCK_MS = 150;

const pauseMenu = document.getElementById('pause-menu');
const pauseControls = document.getElementById('pause-controls');
const pauseLevelValue = document.getElementById('pause-level-value');
const pauseItems = Array.from(pauseMenu.querySelectorAll('[data-menu-item]'));

let startLevel = 1;          // nivel elegido para la próxima partida
let gameStartLevel = 1;      // nivel inicial de la partida en curso
try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= START_LEVEL_MIN && saved <= START_LEVEL_MAX) startLevel = saved;
} catch (e) {}

let pauseMenuOpen = false;
let pauseIndex = 0;
let inputBlockUntil = 0;          // ignora teclas de juego hasta este instante
const heldKeys = new Set();       // teclas físicamente pulsadas ahora
const staleKeys = new Set();      // pulsadas al reanudar: ignorar hasta soltarlas

function intervalForLevel(l) {
  return Math.max(100, 1000 - (l - 1) * 90);
}

function setStartLevel(n) {
  startLevel = Math.min(START_LEVEL_MAX, Math.max(START_LEVEL_MIN, n));
  pauseLevelValue.textContent = startLevel;
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
}

function focusPauseItem(i) {
  pauseIndex = (i + pauseItems.length) % pauseItems.length;
  pauseItems[pauseIndex].focus();
}

function openPauseMenu() {
  pauseMenuOpen = true;
  pauseLevelValue.textContent = startLevel;
  pauseControls.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  focusPauseItem(0);
}

function closePauseMenu() {
  if (!pauseMenuOpen) return;
  pauseMenuOpen = false;
  pauseMenu.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
  // evita que una tecla mantenida mueva la pieza al volver
  inputBlockUntil = performance.now() + RESUME_BLOCK_MS;
  staleKeys.clear();
  heldKeys.forEach(k => staleKeys.add(k));
}

function pauseMenuKey(e) {
  switch (e.code) {
    case 'ArrowUp':   e.preventDefault(); focusPauseItem(pauseIndex - 1); break;
    case 'ArrowDown': e.preventDefault(); focusPauseItem(pauseIndex + 1); break;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (pauseItems[pauseIndex].dataset.menuItem === 'level') {
        e.preventDefault();
        setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      }
      break;
    case 'Enter':
    case 'NumpadEnter':
      e.preventDefault();
      pauseItems[pauseIndex].click();
      break;
  }
}

document.getElementById('pause-resume').addEventListener('click', togglePause);
document.getElementById('pause-restart').addEventListener('click', init);
document.getElementById('pause-controls-btn').addEventListener('click', () => {
  pauseControls.classList.toggle('hidden');
});
document.getElementById('pause-level-down').addEventListener('click', () => setStartLevel(startLevel - 1));
document.getElementById('pause-level-up').addEventListener('click', () => setStartLevel(startLevel + 1));

pauseMenu.addEventListener('focusin', e => {
  const i = pauseItems.findIndex(it => it === e.target || it.contains(e.target));
  if (i >= 0) pauseIndex = i;
});

window.addEventListener('blur', () => { heldKeys.clear(); staleKeys.clear(); });

document.addEventListener('keyup', e => {
  heldKeys.delete(e.code);
  staleKeys.delete(e.code);
});

document.addEventListener('keydown', e => {
  heldKeys.add(e.code);
  // menú abierto: solo teclas de menú; los inputs de juego quedan bloqueados
  if (pauseMenuOpen) {
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (e.code === 'KeyT') { toggleTheme(); return; }
    pauseMenuKey(e);
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (paused || gameOver) return;
  if (performance.now() < inputBlockUntil || staleKeys.has(e.code)) return;
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
  toggleTheme();
  themeToggle.blur(); // evita que Space alterne el tema durante la partida
});

let savedTheme = 'dark';
try { if (localStorage.getItem('theme') === 'light') savedTheme = 'light'; } catch (e) {}
applyTheme(savedTheme);

init();
