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
  '#ff5252', // BOMB - bomba roja
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
  [[9]],                                       // BOMB - power-up 1x1
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const BOMB = 9;
const BOMB_CHANCE = 0.1;
const BOMB_CELL_SCORE = 10;

// Fallback para navegadores sin context.roundRect
function roundedRectPath(context, x, y, w, h, r) {
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    colors: COLORS,
    boardBg: null,
    grid: null,
    drawCell(context, x, y, size, color) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [
      null,
      '#00f7ff', // I
      '#faff00', // O
      '#e000ff', // T
      '#00ff6a', // S
      '#ff1744', // Z
      '#2979ff', // J
      '#ff9100', // L
      '#e8e8ff', // N - tuerca
      '#ff1744', // BOMB
    ],
    boardBg: '#000000',
    grid: 'rgba(0, 255, 255, 0.12)',
    drawCell(context, x, y, size, color) {
      const px = x * size;
      const py = y * size;
      context.save();
      context.shadowBlur = 14;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.restore();
      context.shadowBlur = 0; // evita que el glow se filtre al grid u otros elementos
    },
  },
  pastel: {
    colors: [
      null,
      '#a8e6e6', // I
      '#fff2b2', // O
      '#d9b3e6', // T
      '#b8e0b8', // S
      '#f2b8b8', // Z
      '#b8d4f2', // J
      '#f2d1a8', // L
      '#d8dbe0', // N - tuerca
      '#f2a8a8', // BOMB
    ],
    boardBg: null,
    grid: null,
    drawCell(context, x, y, size, color) {
      const px = x * size + 1;
      const py = y * size + 1;
      const w = size - 2;
      const h = size - 2;
      const r = Math.min(6, w / 2, h / 2);
      context.fillStyle = color;
      context.beginPath();
      if (typeof context.roundRect === 'function') {
        context.roundRect(px, py, w, h, r);
      } else {
        roundedRectPath(context, px, py, w, h, r);
      }
      context.fill();
    },
  },
  pixel: {
    colors: COLORS,
    boardBg: null,
    grid: null,
    drawCell(context, x, y, size, color) {
      const px = x * size + 1;
      const py = y * size + 1;
      const w = size - 2;
      const h = size - 2;
      context.fillStyle = color;
      context.fillRect(px, py, w, h);
      // textura de dither/pixel en patrón de damero fijo
      const step = Math.max(2, Math.floor(size / 6));
      context.fillStyle = 'rgba(255,255,255,0.18)';
      for (let yy = 0; yy < h; yy += step * 2)
        for (let xx = 0; xx < w; xx += step * 2)
          context.fillRect(px + xx, py + yy, step, step);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let yy = step; yy < h; yy += step * 2)
        for (let xx = step; xx < w; xx += step * 2)
          context.fillRect(px + xx, py + yy, step, step);
      // bisel/borde chunky
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      context.strokeRect(px + 1, py + 1, w - 2, h - 2);
    },
  },
};

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
const skinSelect = document.getElementById('skin-select');

let gridColor;
let currentSkin = SKINS.retro;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < BOMB_CHANCE
    ? BOMB
    : Math.floor(Math.random() * (BOMB - 1)) + 1;
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

function explode(cx, cy) {
  let destroyed = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      if (board[r][c]) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }
  if (destroyed) {
    score += destroyed * BOMB_CELL_SCORE * level;
    updateHUD();
  }
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
  if (current.type === BOMB) {
    explode(current.x, current.y);
  } else {
    merge();
  }
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

  if (colorIndex === BOMB) {
    const cx = x * size + size / 2;
    const cy = y * size + size / 2;
    const radius = size / 2 - 3;
    context.fillStyle = color;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    // mecha
    context.strokeStyle = '#ffe082';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, cy - radius);
    context.lineTo(cx + 3, y * size + 2);
    context.stroke();
    // brillo
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.beginPath();
    context.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    return;
  }

  const skinColor = (currentSkin && currentSkin.colors[colorIndex]) || color;
  currentSkin.drawCell(context, x, y, size, skinColor, colorIndex);
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
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function updateGridColor() {
  gridColor = (currentSkin && currentSkin.grid)
    || getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
}

function applySkinBackground() {
  const bg = (currentSkin && currentSkin.boardBg) || '';
  canvas.style.background = bg;
  nextCanvas.style.background = bg;
}

function setTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  updateGridColor();
  themeToggle.textContent = isLight ? '☾ Oscuro' : '☀ Claro';
  themeToggle.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeToggle.setAttribute('aria-pressed', String(isLight));
  if (current) {
    draw();
    drawNext();
  }
}

function setSkin(skin) {
  currentSkin = SKINS[skin] || SKINS.retro;
  try {
    localStorage.setItem('tetris.skin', skin);
  } catch (e) {
    // localStorage no disponible: se ignora, el tema no persistirá
  }
  applySkinBackground();
  updateGridColor();
  if (current) {
    draw();
    drawNext();
  }
}

function loadSkinPreference() {
  let saved = 'retro';
  try {
    const stored = localStorage.getItem('tetris.skin');
    if (stored && SKINS[stored]) saved = stored;
  } catch (e) {
    // localStorage no disponible: se usa 'retro' por defecto
  }
  return saved;
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

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space reactive el botón
});

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    setSkin(skinSelect.value);
    skinSelect.blur(); // evita que flechas/Space alteren el select durante la partida
  });
}

const initialSkin = loadSkinPreference();
if (skinSelect) skinSelect.value = initialSkin;
setSkin(initialSkin);

setTheme('dark');

init();
