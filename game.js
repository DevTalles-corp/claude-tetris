'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Paleta retro (por defecto). Los índices 1–7 coinciden con PIECES; cada skin define su propio colors[] con el mismo orden.
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
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

// ---- Skins ----
function skinRect(context, x, y, w, h, radius) {
  context.beginPath();
  if (radius && context.roundRect) context.roundRect(x, y, w, h, radius);
  else context.rect(x, y, w, h);
}

const SKINS = {
  retro: {
    colors: COLORS,
    boardBg: null, // usa el fondo del tema (CSS)
    grid: null,    // usa --grid del tema
    drawBlock(context, x, y, colorIndex, size) {
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#fff700', '#d400ff', '#39ff14', '#ff1744', '#4d6bff', '#ff9100'],
    boardBg: '#000000',
    grid: '#1a1a2a',
    drawBlock(context, x, y, colorIndex, size) {
      const color = this.colors[colorIndex];
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(x * size + 3, y * size + 3, size - 6, 3);
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff1b0', '#d9b8f0', '#b8e6c1', '#f5b5b5', '#b5bdf0', '#ffd5a8'],
    boardBg: null,
    grid: null,
    drawBlock(context, x, y, colorIndex, size) {
      context.fillStyle = this.colors[colorIndex];
      skinRect(context, x * size + 1.5, y * size + 1.5, size - 3, size - 3, size * 0.28);
      context.fill();
      context.strokeStyle = 'rgba(90,70,110,0.45)';
      context.lineWidth = 1.5;
      skinRect(context, x * size + 1.5, y * size + 1.5, size - 3, size - 3, size * 0.28);
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      skinRect(context, x * size + 5, y * size + 4, size - 10, 4, 2);
      context.fill();
    },
  },
  pixel: {
    colors: [null, '#29c5d6', '#f2c02e', '#9b4fc9', '#4caf50', '#d84a4a', '#4a5fc9', '#f08a24'],
    boardBg: null,
    grid: null,
    drawBlock(context, x, y, colorIndex, size) {
      const px = x * size, py = y * size;
      const u = (size - 2) / 6; // celda de textura 6x6
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          if ((i + j) % 2 === 0) continue; // ajedrezado
          context.fillStyle = (i < 3 && j < 3) ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)';
          context.fillRect(px + 1 + i * u, py + 1 + j * u, u, u);
        }
      }
      context.strokeStyle = 'rgba(0,0,0,0.55)';
      context.lineWidth = 1;
      context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    },
  },
};

const SKIN_KEY = 'tetris-skin';
let skinName = 'retro';

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
const themeBtn = document.getElementById('theme-btn');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';

function updateGridColor() {
  gridColor = SKINS[skinName].grid
    || getComputedStyle(document.documentElement).getPropertyValue('--grid').trim()
    || gridColor;
}

function applySkin(name) {
  if (!Object.hasOwn(SKINS, name)) name = 'retro';
  skinName = name;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  updateGridColor();
  if (board && current) { draw(); drawNext(); } // redibuja también en pausa
}

function loadSkin() {
  let saved = null;
  try { saved = localStorage.getItem(SKIN_KEY); } catch (_) {}
  return Object.hasOwn(SKINS, saved) ? saved : 'retro';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  updateGridColor();
  const isDark = theme === 'dark';
  themeIcon.textContent = isDark ? '☀️' : '🌙';
  themeText.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
  if (board && current) draw(); // redibuja también en pausa
}

function loadTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (_) {}
  return saved === 'light' ? 'light' : 'dark'; // oscuro por defecto
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
  context.globalAlpha = alpha ?? 1;
  SKINS[skinName].drawBlock(context, x, y, colorIndex, size);
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
  draw();
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
  if (e.target === skinSelect) return; // select enfocado: no mover piezas
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

skinSelect.addEventListener('change', () => {
  try { localStorage.setItem(SKIN_KEY, skinSelect.value); } catch (_) {}
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que Space/flechas cambien el select durante el juego
});

restartBtn.addEventListener('click', init);

themeBtn.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, nextTheme); } catch (_) {}
  applyTheme(nextTheme);
  themeBtn.blur(); // evita que Space/Enter reactiven el botón durante el juego
});

applySkin(loadSkin());
applyTheme(loadTheme());

init();
