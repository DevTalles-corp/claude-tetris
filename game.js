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
  '#424242', // 9  power-up Bomba
  '#fff176', // 10 power-up Rayo
  '#f48fb1', // 11 power-up Tinte
  '#7e57c2', // 12 power-up Gravedad
  '#b3e5fc', // 13 power-up Congelar
  '#ffffff', // 14 comodín (se dibuja con degradado arcoíris)
];

const NUT = 8;

// Power-ups: piezas especiales de 1×1 que no se fijan al tablero, sino que
// activan su efecto en la celda donde caen. Aparecen cada POWERUP_EVERY líneas.
const BOMB = 9, RAY = 10, TINT = 11, GRAVITY = 12, FREEZE = 13;
const WILD = 14; // valor de celda de un bloque comodín (creado por Tinte)
const POWERUPS = [BOMB, RAY, TINT, GRAVITY, FREEZE];
const POWERUP_INFO = {
  [BOMB]:    { icon: '💣', name: 'BOMBA' },
  [RAY]:     { icon: '⚡', name: 'RAYO' },
  [TINT]:    { icon: '🎨', name: 'TINTE' },
  [GRAVITY]: { icon: '🌀', name: 'GRAVEDAD' },
  [FREEZE]:  { icon: '❄', name: 'CONGELAR' },
};
const POWERUP_EVERY = 5;      // líneas necesarias para ganar un power-up
const FREEZE_MS = 5000;       // duración de Congelar
const DESTROY_SCORE = 10;     // puntos por bloque destruido (× nivel)

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (reto: hueco central)
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
const THEME_KEY = 'theme';
let gridColor = '#22222e';
let highlightColor = 'rgba(255,255,255,0.12)';

let board, parts, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerAt, pendingPower, freezeLeft, flash;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPowerUp() {
  const type = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
  return { type, shape: [[type]], x: Math.floor(COLS / 2), y: 0 };
}

function isPowerUp(type) {
  return type >= BOMB && type <= FREEZE;
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
      if (current.shape[r][c]) {
        board[current.y + r][current.x + c] = current.shape[r][c];
        // trozo de la tuerca (0–8) que ocupa esta celda, para dibujarla por partes
        parts[current.y + r][current.x + c] = r * 3 + c;
      }
}

// Una fila está completa si no tiene huecos, o si sus comodines bastan para
// cubrirlos (cada comodín rellena un hueco de su propia fila).
function rowComplete(row) {
  let empty = 0, wild = 0;
  for (const v of row) {
    if (v === 0) empty++;
    else if (v === WILD) wild++;
  }
  return empty <= wild;
}

function removeRow(r) {
  board.splice(r, 1);
  board.unshift(new Array(COLS).fill(0));
  parts.splice(r, 1);
  parts.unshift(new Array(COLS).fill(0));
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (rowComplete(board[r])) {
      removeRow(r);
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[Math.min(cleared, 4)] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (lines >= nextPowerAt) {
      pendingPower = true;
      nextPowerAt += POWERUP_EVERY;
    }
    updateHUD();
  }
}

// --- Power-ups -------------------------------------------------------------

function clearCell(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return 0;
  board[r][c] = 0;
  parts[r][c] = 0;
  return 1;
}

function activatePowerUp(type, px, py) {
  let destroyed = 0;
  switch (type) {
    case BOMB: // destruye el área 3×3 centrada donde cae
      for (let r = py - 1; r <= py + 1; r++)
        for (let c = px - 1; c <= px + 1; c++)
          destroyed += clearCell(r, c);
      break;
    case RAY: // vacía la columna y elimina la fila (las de arriba bajan)
      for (let r = 0; r < ROWS; r++) destroyed += clearCell(r, px);
      if (py >= 0) {
        destroyed += board[py].filter(v => v).length;
        removeRow(py);
      }
      break;
    case TINT: { // el color más abundante del tablero se vuelve comodín
      const counts = new Array(COLORS.length).fill(0);
      for (const row of board) for (const v of row) if (v && v !== WILD) counts[v]++;
      let best = 0;
      for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
      if (best) {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === best) { board[r][c] = WILD; parts[r][c] = 0; }
      }
      break;
    }
    case GRAVITY: // cada columna cae hasta compactarse, sin huecos
      for (let c = 0; c < COLS; c++) {
        let write = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (!board[r][c]) continue;
          if (write !== r) {
            board[write][c] = board[r][c];
            parts[write][c] = parts[r][c];
            board[r][c] = 0;
            parts[r][c] = 0;
          }
          write--;
        }
      }
      break;
    case FREEZE: // la caída automática se detiene durante FREEZE_MS
      freezeLeft = FREEZE_MS;
      break;
  }
  if (destroyed) score += destroyed * DESTROY_SCORE * level;
  flash = { text: `${POWERUP_INFO[type].icon} ${POWERUP_INFO[type].name}`, until: performance.now() + 1200 };
  updateHUD();
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
  if (isPowerUp(current.type)) {
    activatePowerUp(current.type, current.x, current.y);
  } else {
    merge();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  if (pendingPower) {
    pendingPower = false;
    next = randomPowerUp();
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

// Dibuja solo la porción de una tuerca hexagonal (3×3 celdas) que cae en la celda (x, y).
// `part` (0–8) indica qué celda del 3×3 es, para situar la tuerca completa.
function drawNutSlice(context, x, y, part, size, alpha) {
  const cx = (x - (part % 3)) * size + 1.5 * size;
  const cy = (y - Math.floor(part / 3)) * size + 1.5 * size;
  const R = 1.45 * size;
  const hole = 0.72 * size;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.beginPath();
  context.rect(x * size, y * size, size, size);
  context.clip();

  context.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i;
    const px = cx + R * Math.cos(a);
    const py = cy + R * Math.sin(a);
    if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
  context.moveTo(cx + hole, cy);
  context.arc(cx, cy, hole, 0, Math.PI * 2);

  const grad = context.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  grad.addColorStop(0, '#eceff1');
  grad.addColorStop(0.45, COLORS[NUT]);
  grad.addColorStop(1, '#607d8b');
  context.fillStyle = grad;
  context.fill('evenodd');
  context.strokeStyle = '#37474f';
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function drawWild(context, x, y, size, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  const grad = context.createLinearGradient(px, py, px + s, py + s);
  ['#e57373', '#ffb74d', '#fff176', '#81c784', '#4dd0e1', '#ba68c8'].forEach((col, i, arr) =>
    grad.addColorStop(i / (arr.length - 1), col));
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = grad;
  context.fillRect(px, py, s, s);
  context.fillStyle = '#ffffff';
  context.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('★', px + s / 2, py + s / 2 + 1);
  context.globalAlpha = 1;
}

function drawPowerUp(context, x, y, type, size, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = COLORS[type];
  context.fillRect(px, py, s, s);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, s - 2, s - 2);
  context.font = `${Math.round(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  context.fillText(POWERUP_INFO[type].icon, px + s / 2, py + s / 2 + 1);
  context.globalAlpha = 1;
}

// Texto centrado con sombra, legible en los dos temas.
function drawBanner(text, y) {
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, canvas.width / 2, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, canvas.width / 2, y);
}

function drawBlock(context, x, y, colorIndex, size, alpha, part) {
  if (!colorIndex) return;
  if (colorIndex === NUT) { drawNutSlice(context, x, y, part ?? 0, size, alpha); return; }
  if (colorIndex === WILD) { drawWild(context, x, y, size, alpha); return; }
  if (isPowerUp(colorIndex)) { drawPowerUp(context, x, y, colorIndex, size, alpha); return; }
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = highlightColor;
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
      drawBlock(ctx, c, r, board[r][c], BLOCK, 1, parts[r][c]);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2, r * 3 + c);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, r * 3 + c);

  // indicadores de power-ups
  if (freezeLeft > 0) drawBanner(`❄ ${(freezeLeft / 1000).toFixed(1)} s`, 24);
  if (flash && performance.now() < flash.until) drawBanner(flash.text, canvas.height / 2);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, r * 3 + c);
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
  if (freezeLeft > 0) {
    // Congelar: no hay caída automática; el jugador aún puede mover y soltar.
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
  } else {
    dropAccum += dt;
  }
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

function init() {
  board = createBoard();
  parts = createBoard();
  nextPowerAt = POWERUP_EVERY;
  pendingPower = false;
  freezeLeft = 0;
  flash = null;
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
  if (e.code === 'KeyP') { togglePause(); return; }
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

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignorar */ }
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim();
  highlightColor = styles.getPropertyValue('--block-highlight').trim();
  if (board && current && next) {
    draw();
    drawNext();
  }
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space/Enter vuelva a activar el botón
});

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignorar */ }
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
