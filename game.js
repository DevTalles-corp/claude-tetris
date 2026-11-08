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
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsBox = document.getElementById('records');
const recordsList = document.getElementById('records-list');
const recordsExtra = document.getElementById('records-extra');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const themeBtn = document.getElementById('theme-btn');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
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

let started = false, combo = 0, comboBest = 0, records, lastEntry = null;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// ---- Records ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  const rec = emptyRecords();
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && typeof data === 'object') {
      if (Array.isArray(data.top)) {
        rec.top = data.top
          .filter(e => e && Number.isFinite(e.score))
          .map(e => ({ name: String(e.name ?? '').slice(0, 12), score: e.score, lines: Number(e.lines) || 0, date: String(e.date ?? '') }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RECORDS);
      }
      rec.bestCombo = Number(data.bestCombo) || 0;
      rec.maxLines = Number(data.maxLines) || 0;
    }
  } catch (_) {}
  return rec;
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (_) {}
}

function qualifies(sc) {
  return sc > 0 && (records.top.length < MAX_RECORDS || sc > records.top[records.top.length - 1].score);
}

function renderRecords() {
  recordsList.textContent = '';
  if (!records.top.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records todavía';
    recordsList.appendChild(li);
  }
  records.top.forEach((e, i) => {
    const li = document.createElement('li');
    if (e === lastEntry) li.className = 'me';
    const left = document.createElement('span');
    left.textContent = `${i + 1}. ${e.name}`;
    const right = document.createElement('span');
    right.textContent = `${e.score.toLocaleString()} · ${e.lines}L`;
    li.append(left, right);
    recordsList.appendChild(li);
  });
  recordsExtra.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx.: ${records.maxLines}`;
}

function showRecords(show) {
  recordsBox.classList.toggle('hidden', !show);
  resetRecordsBtn.classList.toggle('hidden', !show);
  if (show) renderRecords();
}

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
  return cleared;
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
  if (clearLines() > 0) {
    combo++;
    comboBest = Math.max(comboBest, combo);
  } else {
    combo = 0;
  }
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
  overlayTitle.classList.remove('start');
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  records.bestCombo = Math.max(records.bestCombo, comboBest);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords();
  lastEntry = null;
  restartBtn.textContent = 'Reiniciar';
  showRecords(true);
  if (qualifies(score)) {
    nameInput.value = 'Jugador';
    nameForm.classList.remove('hidden');
  }
  overlay.classList.remove('hidden');
  if (!nameForm.classList.contains('hidden')) { nameInput.focus(); nameInput.select(); }
}

function togglePause() {
  if (!started || gameOver) return;
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
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  combo = 0;
  comboBest = 0;
  lastEntry = null;
  nameForm.classList.add('hidden');
  showRecords(false);
  overlayTitle.classList.remove('start');
  restartBtn.textContent = 'Reiniciar';
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
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre
  if (!started) return;
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

restartBtn.addEventListener('click', () => { restartBtn.blur(); init(); });

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!gameOver || nameForm.classList.contains('hidden')) return;
  const name = nameInput.value.trim().slice(0, 12) || 'Jugador';
  lastEntry = { name, score, lines, date: new Date().toISOString().slice(0, 10) };
  records.top.push(lastEntry);
  records.top.sort((a, b) => b.score - a.score);
  records.top = records.top.slice(0, MAX_RECORDS);
  saveRecords();
  nameForm.classList.add('hidden');
  nameInput.blur();
  renderRecords();
});

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records?')) return;
  records = emptyRecords();
  lastEntry = null;
  saveRecords();
  renderRecords();
});

themeBtn.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, nextTheme); } catch (_) {}
  applyTheme(nextTheme);
  themeBtn.blur(); // evita que Space/Enter reactiven el botón durante el juego
});

applyTheme(loadTheme());

// Pantalla de inicio: el juego arranca al pulsar Jugar
records = loadRecords();
overlayTitle.classList.add('start');
showRecords(true);
