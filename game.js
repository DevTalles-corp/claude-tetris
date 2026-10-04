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
  '#f06292', // R - pink (ring)
  '#616161', // bomb - gray
  '#e0e0e0', // tint - light gray
  '#ffd700', // wild - gold
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // R (ring)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SPECIAL_EVERY_LINES = 8;
const BOMB = 9, TINT = 10, WILD = 11; // indices into COLORS
const SPECIAL_TYPES = [BOMB, TINT];
const BOMB_RADIUS = 1; // 1 => 3x3 blast area
const BLOCK_GLYPHS = { [BOMB]: '✹', [TINT]: '◐', [WILD]: '★' };

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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let specialsAwarded, specialPending;
let combo, maxComboThisGame;

const RECORDS_KEY = 'tetris.records';
const NAME_KEY = 'tetris.lastName';
const MAX_TOP = 5;
const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetBtn = document.getElementById('reset-records-btn');
const gameoverRecords = document.getElementById('gameover-records');
const newRecordEl = document.getElementById('new-record');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const saveBtn = document.getElementById('save-btn');
const gameoverList = document.getElementById('gameover-list');
let savedIndex = -1;

function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const r = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!r || !Array.isArray(r.top)) return empty;
    return { top: r.top.slice(0, MAX_TOP), bestCombo: r.bestCombo || 0, maxLines: r.maxLines || 0 };
  } catch (e) {
    return empty;
  }
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) { /* sin almacenamiento */ }
}

function getLastName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
}

function qualifiesForTop(rec, s) {
  if (s <= 0) return false;
  return rec.top.length < MAX_TOP || s > rec.top[rec.top.length - 1].score;
}

// Fills an <ol> with the top list; highlightIdx marks the row to highlight.
function renderTop(listEl, rec, highlightIdx) {
  listEl.textContent = '';
  if (!rec.top.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin récords aún';
    listEl.appendChild(li);
    return;
  }
  rec.top.forEach((t, i) => {
    const li = document.createElement('li');
    if (i === highlightIdx) li.className = 'highlight';
    li.textContent = `${t.name} — ${t.score.toLocaleString()} (${t.lines} líneas, nivel ${t.level})`;
    listEl.appendChild(li);
  });
}

function renderStats(el, rec) {
  el.textContent = `Mejor combo: ${rec.bestCombo} · Máx. líneas: ${rec.maxLines}`;
}

function renderStartScreen() {
  const rec = loadRecords();
  renderTop(document.getElementById('start-list'), rec, -1);
  renderStats(document.getElementById('start-stats'), rec);
}

// Updates bestCombo/maxLines, and shows the name form if the score enters the top.
function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxComboThisGame);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  savedIndex = -1;
  const qualifies = qualifiesForTop(rec, score);
  newRecordEl.classList.toggle('hidden', !qualifies);
  nameForm.classList.toggle('hidden', !qualifies);
  if (qualifies) {
    nameInput.value = getLastName();
    saveBtn.disabled = false;
    setTimeout(() => nameInput.focus(), 0);
  }
  renderTop(gameoverList, rec, -1);
  renderStats(document.getElementById('gameover-stats'), rec);
  gameoverRecords.classList.remove('hidden');
}

function saveScore() {
  if (!gameOver || savedIndex >= 0) return;
  const name = nameInput.value.trim().slice(0, 12) || 'Anónimo';
  try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* sin almacenamiento */ }
  const rec = loadRecords();
  const entry = { name, score, lines, level, date: new Date().toISOString() };
  let idx = rec.top.findIndex(t => score > t.score);
  if (idx < 0) idx = rec.top.length;
  rec.top.splice(idx, 0, entry);
  rec.top = rec.top.slice(0, MAX_TOP);
  saveRecords(rec);
  savedIndex = idx;
  saveBtn.disabled = true;
  nameForm.classList.add('hidden');
  newRecordEl.classList.add('hidden');
  renderTop(gameoverList, rec, idx < MAX_TOP ? idx : -1);
}

const pauseMenu = document.getElementById('pause-menu');
const pmResume = document.getElementById('pm-resume');
const pmRestart = document.getElementById('pm-restart');
const pmControlsBtn = document.getElementById('pm-controls-btn');
const pmControls = document.getElementById('pm-controls');
const pmStartLevel = document.getElementById('pm-start-level');
let startLevel = loadStartLevel();

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createPiece(type, baseShape) {
  const shape = baseShape.map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  return createPiece(type, PIECES[type]);
}

function randomSpecialPiece() {
  const type = SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
  return createPiece(type, [[type]]);
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

// BOMB: clears the (2*BOMB_RADIUS+1)² area centered on the piece.
function detonate(cx, cy) {
  for (let r = cy - BOMB_RADIUS; r <= cy + BOMB_RADIUS; r++)
    for (let c = cx - BOMB_RADIUS; c <= cx + BOMB_RADIUS; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
}

// TINT: turns every block of the color found right below the piece into WILD. No-op on empty/floor/WILD.
function applyTint(x, y) {
  const target = board[y + 1]?.[x];
  if (!target || target === WILD) return;
  for (const row of board)
    for (let c = 0; c < COLS; c++)
      if (row[c] === target) row[c] = WILD;
}

// A row is complete when every gap can be covered by a WILD block in that row.
function isRowComplete(row) {
  const gaps = row.filter(v => v === 0).length;
  const wilds = row.filter(v => v === WILD).length;
  return gaps <= wilds;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (isRowComplete(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    maxComboThisGame = Math.max(maxComboThisGame, combo);
  } else {
    combo = 0;
  }
  if (cleared) {
    lines += cleared;
    if (Math.floor(lines / SPECIAL_EVERY_LINES) > specialsAwarded) {
      specialsAwarded++;
      specialPending = true;
    }
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
  if (current.type === BOMB) detonate(current.x, current.y);
  else if (current.type === TINT) applyTint(current.x, current.y);
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = specialPending ? randomSpecialPiece() : randomPiece();
  specialPending = false;
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

function fillRounded(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) context.roundRect(x, y, w, h, r);
  else context.rect(x, y, w, h);
  context.fill();
}

const SKINS = {
  retro: {
    colors: COLORS,
    grid: '#22222e',
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [
      null, '#00f0ff', '#fff200', '#d500f9', '#39ff14', '#ff1744', '#2979ff',
      '#ff9100', '#ff2d95', '#9e9e9e', '#ffffff', '#ffe600',
    ],
    grid: '#12122a',
    drawBlock(context, x, y, color, size) {
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(x * size + 5, y * size + 5, size - 10, 3);
    },
  },
  pastel: {
    colors: [
      null, '#a8e6ef', '#fff1b8', '#d9b8ec', '#b8e6c1', '#f5b8b8', '#b8d4f5',
      '#fcd9b0', '#f7b8d2', '#b0b0b8', '#f4f4f4', '#ffe28a',
    ],
    grid: '#e6dff0',
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      fillRounded(context, x * size + 1.5, y * size + 1.5, size - 3, size - 3, size * 0.28);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      fillRounded(context, x * size + size * 0.2, y * size + size * 0.16, size * 0.5, size * 0.12, 2);
    },
  },
  pixel: {
    colors: [
      null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0',
      '#ffa726', '#ec407a', '#757575', '#cfd8dc', '#ffc107',
    ],
    grid: '#1c1c28',
    drawBlock(context, x, y, color, size) {
      const px = x * size + 1, py = y * size + 1, s = size - 2, q = s / 4;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // textura: sub-cuadros claros/oscuros en patron de tablero
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          if ((i + j) % 2) continue;
          context.fillStyle = (i + j) % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)';
          context.fillRect(px + i * q, py + j * q, q, q);
        }
      context.strokeStyle = 'rgba(0,0,0,0.55)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    },
  },
};

const SKIN_KEY = 'tetris.skin';
let skin = SKINS.retro;

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    if (saved && SKINS[saved]) return saved;
  } catch (e) { /* sin storage */ }
  return 'retro';
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  skin = SKINS[name];
  document.body.dataset.skin = name;
  try { localStorage.setItem(SKIN_KEY, name); } catch (e) { /* sin storage */ }
  if (board && current && next) { draw(); drawNext(); }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x, y, skin.colors[colorIndex], size);
  const glyph = BLOCK_GLYPHS[colorIndex];
  if (glyph) {
    context.fillStyle = '#1a1a24';
    context.font = `${size * 0.6}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skin.grid;
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
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    pmControls.classList.add('hidden');
    dropAccum = 0;
    lastTime = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    pmStartLevel.value = String(startLevel);
    pauseMenu.classList.remove('hidden');
  }
}

function loadStartLevel() {
  try {
    const v = parseInt(localStorage.getItem('tetris.startLevel'), 10);
    if (v >= 1 && v <= 10) return v;
  } catch (e) {}
  return 1;
}

pmStartLevel.addEventListener('change', () => {
  startLevel = parseInt(pmStartLevel.value, 10);
  try { localStorage.setItem('tetris.startLevel', String(startLevel)); } catch (e) {}
});
pmResume.addEventListener('click', togglePause);
pmRestart.addEventListener('click', () => init());
pmControlsBtn.addEventListener('click', () => pmControls.classList.toggle('hidden'));
for (let i = 1; i <= 10; i++) pmStartLevel.add(new Option(i, i));

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
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  pauseMenu.classList.add('hidden');
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  specialsAwarded = 0;
  specialPending = false;
  combo = 0;
  maxComboThisGame = 0;
  gameoverRecords.classList.add('hidden');
  startScreen.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused) {
    // evita que Space active el botón enfocado del menú
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  if (gameOver) return;
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

// Firefox dispara el click del botón en keyup de Space
document.addEventListener('keyup', e => {
  if (paused && e.code === 'Space') e.preventDefault();
});

const skinSelect = document.getElementById('skin-select');
skinSelect.value = loadSkin();
applySkin(skinSelect.value);
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur();
});

restartBtn.addEventListener('click', init);
playBtn.addEventListener('click', init);
saveBtn.addEventListener('click', saveScore);
nameInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.code === 'Enter') saveScore();
});
resetBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* sin almacenamiento */ }
  renderStartScreen();
});

// The game starts from the start screen, not on load.
gameOver = true;
renderStartScreen();
startScreen.classList.remove('hidden');
