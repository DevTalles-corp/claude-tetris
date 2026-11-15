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

const BOMB_CHANCE = 0.12;   // probabilidad por pieza de ser bomba
const BOMB_MIN_GAP = 5;     // mínimo de piezas entre bombas
const EXPLOSION_MS = 450;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let piecesSinceBomb = 0;
let explosion = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  piecesSinceBomb++;
  let bomb = false;
  if (piecesSinceBomb >= BOMB_MIN_GAP && Math.random() < BOMB_CHANCE) {
    bomb = true;
    piecesSinceBomb = 0;
  }
  return { type, shape, bomb, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

// Destruye el área 3x3 alrededor de cada bloque de la pieza (pieza + 1 celda de margen)
function explode(piece) {
  const cells = [];
  let destroyed = 0;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = piece.y + r + dy;
          const nx = piece.x + c + dx;
          if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue;
          if (cells.some(p => p[0] === nx && p[1] === ny)) continue;
          cells.push([nx, ny]);
          if (board[ny][nx]) destroyed++;
          board[ny][nx] = 0;
        }
      }
    }
  }
  score += destroyed * 10 * level;
  explosion = { cells, start: performance.now() };
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
  if (current.bomb) explode(current);
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

  if (current.bomb) drawBombEffect();
  drawExplosion();
}

// Efecto bomba: pulso focus in/out + destello con degradado de color rotativo
function drawBombEffect() {
  const t = performance.now();
  const p = (Math.sin(t / 180) + 1) / 2;            // 0..1 (focus in/out)
  const hue = (t / 6) % 360;
  const inset = 1 + (1 - p) * 4;                    // el bloque "respira"
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const px = (current.x + c) * BLOCK;
      const py = (current.y + r) * BLOCK;
      const cx = px + BLOCK / 2, cy = py + BLOCK / 2;
      // halo 3x3 (zona de explosión), desenfocado → enfocado
      const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, BLOCK * (1.6 - 0.5 * p));
      halo.addColorStop(0, `hsla(${hue}, 100%, 65%, ${0.55 * p + 0.15})`);
      halo.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 100%, 60%, ${0.3 * p + 0.05})`);
      halo.addColorStop(1, `hsla(${(hue + 120) % 360}, 100%, 55%, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(px - BLOCK, py - BLOCK, BLOCK * 3, BLOCK * 3);
      // destello degradado sobre el bloque
      const g = ctx.createLinearGradient(px, py, px + BLOCK, py + BLOCK);
      g.addColorStop(0, `hsla(${hue}, 100%, 70%, ${0.35 + 0.5 * p})`);
      g.addColorStop(1, `hsla(${(hue + 90) % 360}, 100%, 60%, ${0.15 + 0.4 * p})`);
      ctx.fillStyle = g;
      ctx.fillRect(px + inset, py + inset, BLOCK - 2 * inset, BLOCK - 2 * inset);
    }
  }
}

function drawExplosion() {
  if (!explosion) return;
  const k = (performance.now() - explosion.start) / EXPLOSION_MS;
  if (k >= 1) { explosion = null; return; }
  const a = 1 - k;
  for (const [x, y] of explosion.cells) {
    const cx = x * BLOCK + BLOCK / 2, cy = y * BLOCK + BLOCK / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, BLOCK * (0.6 + k));
    g.addColorStop(0, `hsla(50, 100%, 85%, ${a})`);
    g.addColorStop(0.5, `hsla(25, 100%, 55%, ${a * 0.7})`);
    g.addColorStop(1, 'hsla(0, 100%, 50%, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x * BLOCK - 6, y * BLOCK - 6, BLOCK + 12, BLOCK + 12);
  }
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
  if (next.bomb) {
    const g = nextCtx.createRadialGradient(60, 60, 5, 60, 60, 60);
    g.addColorStop(0, 'hsla(50, 100%, 70%, 0.5)');
    g.addColorStop(1, 'hsla(0, 100%, 55%, 0)');
    nextCtx.fillStyle = g;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
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
  if (gameOver) return;
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
  piecesSinceBomb = 0;
  explosion = null;
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

// ---- Tema Light / Dark (por defecto Dark) ----
const themeToggle = document.getElementById('theme-toggle');
let gridColor = '#22222e';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isLight = theme === 'light';
  themeToggle.textContent = isLight ? '☾ Dark' : '☀ Light';
  themeToggle.setAttribute('aria-label', isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  themeToggle.setAttribute('aria-pressed', String(isLight));
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  if (current) draw(); // refresca el canvas aunque el juego esté en pausa
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space active el botón
});

applyTheme('dark');

init();
