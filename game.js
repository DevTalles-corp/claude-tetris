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
  '#a1887f', // N - tuerca (nut)
  '#ff5252', // B - bomba (nunca se guarda en el tablero)
  '#ffeb3b', // R - rayo (nunca se guarda en el tablero)
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
  [[9]],                                       // B (bomba)
  [[10]],                                      // R (rayo)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const BOMB = 9;              // tipo de la pieza bomba; randomPiece() nunca la genera
const BOMB_EVERY = 5;        // cada cuántas líneas se gana una bomba
const BOMB_RADIUS = 1;       // 1 => área de 3x3 centrada donde cae la bomba
const BOMB_BLOCK_SCORE = 10; // puntos por bloque destruido (× nivel)

const LIGHTNING = 10;             // tipo de la pieza rayo; randomPiece() nunca la genera
const LIGHTNING_EVERY = 4;        // cada cuántas líneas se gana un rayo
const LIGHTNING_BLOCK_SCORE = 10; // puntos por bloque destruido (× nivel)

const canvas =document.getElementById('board');
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

const THEME_KEY = 'tetris-theme';
let theme = { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)', edge: 'transparent', ghostAlpha: 0.2 };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextBombAt, pendingBombs;
let nextLightningAt, pendingLightnings;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function bombPiece() {
  const shape = PIECES[BOMB].map(row => [...row]);
  return { type: BOMB, shape, x: Math.floor(COLS / 2), y: 0 };
}

function lightningPiece() {
  const shape = PIECES[LIGHTNING].map(row => [...row]);
  return { type: LIGHTNING, shape, x: Math.floor(COLS / 2), y: 0 };
}

// Vacía la columna y elimina la fila donde cae el rayo (con gravedad: lo de arriba baja).
// No cuenta en LINES ni en el nivel, así que no encadena más bombas ni rayos.
function strike() {
  let destroyed = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r][current.x]) { board[r][current.x] = 0; destroyed++; }
  }
  if (current.y >= 0 && current.y < ROWS) {
    destroyed += board[current.y].filter(v => v !== 0).length;
    board.splice(current.y, 1);
    board.unshift(new Array(COLS).fill(0));
  }
  score += destroyed * LIGHTNING_BLOCK_SCORE * level;
  updateHUD();
}

// Destruye los bloques fijados en el área (2·BOMB_RADIUS+1)² centrada en la bomba.
// No aplica gravedad: los bloques de arriba quedan flotando.
function explode() {
  let destroyed = 0;
  for (let r = current.y - BOMB_RADIUS; r <= current.y + BOMB_RADIUS; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = current.x - BOMB_RADIUS; c <= current.x + BOMB_RADIUS; c++) {
      if (c < 0 || c >= COLS || !board[r][c]) continue;
      board[r][c] = 0;
      destroyed++;
    }
  }
  score += destroyed * BOMB_BLOCK_SCORE * level;
  updateHUD();
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
    dropInterval = speedForLevel(level);
    while (lines >= nextBombAt) {
      pendingBombs++;
      nextBombAt += BOMB_EVERY;
    }
    while (lines >= nextLightningAt) {
      pendingLightnings++;
      nextLightningAt += LIGHTNING_EVERY;
    }
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
  if (current.type === BOMB) {
    explode();
  } else if (current.type === LIGHTNING) {
    strike();
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  if (pendingLightnings > 0) {
    pendingLightnings--;
    next = lightningPiece();
  } else if (pendingBombs > 0) {
    pendingBombs--;
    next = bombPiece();
  } else {
    next = randomPiece();
  }
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

function drawBomb(context, x, y, size, alpha) {
  const cx = (x + 0.5) * size;
  const cy = (y + 0.56) * size;
  const rad = size * 0.34;
  context.globalAlpha = alpha ?? 1;
  // mecha
  context.strokeStyle = '#8d6e63';
  context.lineWidth = Math.max(1.5, size * 0.07);
  context.beginPath();
  context.moveTo(cx + rad * 0.5, cy - rad * 0.8);
  context.quadraticCurveTo(cx + rad * 0.9, cy - rad * 1.4, cx + rad * 1.2, cy - rad * 1.25);
  context.stroke();
  // chispa
  context.fillStyle = '#ffd54f';
  context.beginPath();
  context.arc(cx + rad * 1.2, cy - rad * 1.25, size * 0.08, 0, Math.PI * 2);
  context.fill();
  // cuerpo
  context.fillStyle = COLORS[BOMB];
  context.beginPath();
  context.arc(cx, cy, rad, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = theme.edge;
  context.lineWidth = 1;
  context.stroke();
  // brillo
  context.fillStyle = theme.highlight;
  context.beginPath();
  context.arc(cx - rad * 0.35, cy - rad * 0.35, rad * 0.3, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawLightning(context, x, y, size, alpha) {
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = COLORS[LIGHTNING];
  context.beginPath();
  context.moveTo(px + size * 0.6, py + size * 0.06);
  context.lineTo(px + size * 0.22, py + size * 0.56);
  context.lineTo(px + size * 0.46, py + size * 0.56);
  context.lineTo(px + size * 0.36, py + size * 0.94);
  context.lineTo(px + size * 0.78, py + size * 0.4);
  context.lineTo(px + size * 0.54, py + size * 0.4);
  context.closePath();
  context.fill();
  context.strokeStyle = '#f57f17';
  context.lineWidth = 1.5;
  context.stroke();
  context.globalAlpha = 1;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  if (colorIndex === BOMB) return drawBomb(context, x, y, size, alpha);
  if (colorIndex === LIGHTNING) return drawLightning(context, x, y, size, alpha);
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = theme.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.strokeStyle = theme.edge;
  context.lineWidth = 1;
  context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = theme.grid;
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

  // ghost
  const gy = ghostY();
  if (current.type === BOMB) {
    // área de explosión donde caerá la bomba
    const x0 = Math.max(0, current.x - BOMB_RADIUS);
    const y0 = Math.max(0, gy - BOMB_RADIUS);
    const x1 = Math.min(COLS - 1, current.x + BOMB_RADIUS);
    const y1 = Math.min(ROWS - 1, gy + BOMB_RADIUS);
    ctx.globalAlpha = theme.ghostAlpha;
    ctx.fillStyle = COLORS[BOMB];
    ctx.fillRect(x0 * BLOCK, y0 * BLOCK, (x1 - x0 + 1) * BLOCK, (y1 - y0 + 1) * BLOCK);
    ctx.globalAlpha = 1;
  }
  if (current.type === LIGHTNING) {
    // fila y columna que se limpiarán
    ctx.globalAlpha = theme.ghostAlpha;
    ctx.fillStyle = COLORS[LIGHTNING];
    ctx.fillRect(0, gy * BLOCK, COLS * BLOCK, BLOCK);
    ctx.fillRect(current.x * BLOCK, 0, BLOCK, ROWS * BLOCK);
    ctx.globalAlpha = 1;
  }
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, theme.ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  // la bomba (1x1) se centra exacto; el resto conserva su alineación
  const center = (next.type === BOMB || next.type === LIGHTNING) ? n => (4 - n) / 2 : n => Math.floor((4 - n) / 2);
  const offX = center(shape[0].length);
  const offY = center(shape.length);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function applyTheme(name) {
  const light = name === 'light';
  if (light) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  themeToggle.setAttribute('aria-checked', String(light));
  themeToggle.textContent = light ? 'Tema oscuro' : 'Tema claro';
  const css = getComputedStyle(document.documentElement);
  theme = {
    grid: css.getPropertyValue('--grid').trim(),
    highlight: css.getPropertyValue('--block-highlight').trim(),
    edge: css.getPropertyValue('--block-edge').trim(),
    ghostAlpha: parseFloat(css.getPropertyValue('--ghost-alpha')),
  };
  // el loop no corre en pausa ni en game over: repintar a mano
  if (current && next) {
    draw();
    drawNext();
  }
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
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
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
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

// ---- Menú de pausa ----
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const controlsToggle = document.getElementById('pause-controls-toggle');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

let startLevel = 1;     // preferencia del selector: aplica a la próxima partida
let gameStartLevel = 1; // nivel inicial de la partida en curso
const heldKeys = new Set();    // teclas pulsadas ahora mismo
const blockedKeys = new Set(); // ignoradas por el juego hasta su keyup

function openPauseMenu() {
  pauseControls.hidden = true;
  controlsToggle.setAttribute('aria-expanded', 'false');
  pauseMenu.classList.remove('hidden');
  resumeBtn.focus();
}

function closePauseMenu() {
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
  pauseMenu.classList.add('hidden');
  // lo que siga pulsado al volver no debe mover la pieza
  heldKeys.forEach(code => blockedKeys.add(code));
}

function speedForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyX', 'Space'];

window.addEventListener('keydown', e => {
  heldKeys.add(e.code);
  // una pulsación nueva (no autorrepetición) nunca está bloqueada; cubre keyups perdidos
  if (!e.repeat) blockedKeys.delete(e.code);
  if (!paused) return;
  if (e.code === 'Tab') trapFocus(e);
  // con el menú abierto, las teclas de juego no deben desplazar la página
  else if (GAME_KEYS.includes(e.code) && !pauseMenu.contains(e.target)) e.preventDefault();
}, true);
window.addEventListener('keyup', e => {
  heldKeys.delete(e.code);
  blockedKeys.delete(e.code);
}, true);
window.addEventListener('blur', () => {
  heldKeys.clear();
  blockedKeys.clear();
});

// mantiene el foco de Tab dentro del menú de pausa
function trapFocus(e) {
  const items = [...pauseMenu.querySelectorAll('button, select')];
  const first = items[0], last = items[items.length - 1];
  const inside = pauseMenu.contains(document.activeElement);
  if (e.shiftKey && (!inside || document.activeElement === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault();
    first.focus();
  }
}

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', init);

controlsToggle.addEventListener('click', () => {
  const open = pauseControls.hidden;
  pauseControls.hidden = !open;
  controlsToggle.setAttribute('aria-expanded', String(open));
});

for (let n = 1; n <= MAX_START_LEVEL; n++) startLevelSelect.add(new Option(String(n), String(n)));

startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch (e) {}
});

try {
  const saved = Number(localStorage.getItem(START_LEVEL_KEY));
  if (Number.isInteger(saved) && saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) {}
startLevelSelect.value = String(startLevel);

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = gameStartLevel;
  paused = false;
  gameOver = false;
  closePauseMenu();
  dropInterval = speedForLevel(level);
  dropAccum = 0;
  nextBombAt = BOMB_EVERY;
  pendingBombs = 0;
  nextLightningAt = LIGHTNING_EVERY;
  pendingLightnings = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  if (paused || gameOver || blockedKeys.has(e.code)) return;
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
  const name = document.documentElement.hasAttribute('data-theme') ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
  applyTheme(name);
  themeToggle.blur(); // que Space/Enter no vuelvan a activar el botón
});

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
applyTheme(savedTheme);

init();
