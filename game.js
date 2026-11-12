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
  '#b71c1c', // J - blood red (darker than Z so they stay distinguishable)
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
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');

// Pause menu elements
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

// Canvas colors per theme (canvas does not inherit CSS variables)
const THEMES = {
  dark:  { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#e1e3ee', highlight: 'rgba(255,255,255,0.35)' },
};
let theme = 'dark';

const MAX_START_LEVEL = 10;

// Level the next game starts at (chosen in the pause menu)
let startLevel = 1;
// Start level of the game in progress (startLevel captured by init())
let baseLevel = 1;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// started stays false while the start screen is shown; combo counts consecutive
// locked pieces that cleared at least one line, maxCombo is the best of this game.
let started = false, combo = 0, maxCombo = 0;

// ---- High scores (localStorage) ----
const RECORDS_KEY = 'tetris.records';
const STATS_KEY = 'tetris.stats';
const TOP_SIZE = 5;
const NAME_MAX = 12;

const startOverlay = document.getElementById('start-overlay');
const playBtn = document.getElementById('play-btn');
const startRecordsEl = document.getElementById('start-records');
const overRecordsEl = document.getElementById('over-records');
const newRecordEl = document.getElementById('new-record');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');

// Index the current game's score would occupy in the table, or -1 if it
// does not qualify. Set at game over and cleared once the name is saved.
let pendingRank = -1;
let highlightRank = -1;

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota, file:// restrictions): ignore
  }
}

function loadRecords() {
  const data = readStorage(RECORDS_KEY, []);
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && typeof r.score === 'number')
    .map(r => ({
      name: String(r.name ?? '').slice(0, NAME_MAX) || 'Jugador',
      score: r.score,
      lines: Number(r.lines) || 0,
      level: Number(r.level) || 1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_SIZE);
}

function loadStats() {
  const data = readStorage(STATS_KEY, {});
  return {
    bestCombo: Number(data && data.bestCombo) || 0,
    maxLines: Number(data && data.maxLines) || 0,
  };
}

// Position the score would take in the table, or -1 if it doesn't make the top
function recordRank(value) {
  if (value <= 0) return -1;
  const records = loadRecords();
  const idx = records.findIndex(r => value > r.score);
  if (idx !== -1) return idx;
  return records.length < TOP_SIZE ? records.length : -1;
}

function saveRecord(name) {
  const records = loadRecords();
  const entry = { name: name.trim().slice(0, NAME_MAX) || 'Jugador', score, lines, level };
  records.splice(pendingRank, 0, entry);
  writeStorage(RECORDS_KEY, records.slice(0, TOP_SIZE));
  highlightRank = pendingRank;
  pendingRank = -1;
}

function updateStats() {
  const stats = loadStats();
  writeStorage(STATS_KEY, {
    bestCombo: Math.max(stats.bestCombo, maxCombo),
    maxLines: Math.max(stats.maxLines, lines),
  });
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  writeStorage(RECORDS_KEY, null);
  writeStorage(STATS_KEY, null);
  highlightRank = -1;
  // An unsaved score from the game just finished now goes first in the empty table
  if (pendingRank !== -1) pendingRank = 0;
  renderAllRecords();
}

// Builds the records table + stats into container using DOM APIs only
// (player names are user input, so never go through innerHTML).
function renderRecords(container, highlight) {
  const records = loadRecords();
  const stats = loadStats();
  container.replaceChildren();

  const heading = document.createElement('p');
  heading.className = 'records-title';
  heading.textContent = 'MEJORES PUNTUACIONES';
  container.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'records-table';
  const head = table.createTHead().insertRow();
  for (const label of ['#', 'Nombre', 'Puntos', 'Líneas', 'Nivel']) {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  }
  const body = table.createTBody();
  if (!records.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = 5;
    cell.className = 'records-empty';
    cell.textContent = 'Sin records todavía';
  }
  records.forEach((r, i) => {
    const row = body.insertRow();
    if (i === highlight) row.className = 'highlight';
    for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.level]) {
      row.insertCell().textContent = v;
    }
  });
  container.appendChild(table);

  const statsEl = document.createElement('p');
  statsEl.className = 'records-stats';
  statsEl.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máximas: ${stats.maxLines}`;
  container.appendChild(statsEl);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'reset-records-btn';
  resetBtn.textContent = 'Borrar records';
  resetBtn.addEventListener('click', () => { resetRecords(); resetBtn.blur(); });
  container.appendChild(resetBtn);
}

function renderAllRecords() {
  renderRecords(startRecordsEl, -1);
  renderRecords(overRecordsEl, highlightRank);
}

// Called from endGame(): persists stats and offers the name form if the score qualifies
function showGameOverRecords() {
  updateStats();
  pendingRank = recordRank(score);
  highlightRank = -1;
  const qualifies = pendingRank !== -1;
  newRecordEl.classList.toggle('hidden', !qualifies);
  newRecordEl.textContent = pendingRank === 0 ? '¡Nuevo récord!' : '¡Entras en el top 5!';
  nameForm.classList.toggle('hidden', !qualifies);
  overRecordsEl.classList.remove('hidden');
  renderAllRecords();
  if (qualifies) {
    nameInput.value = '';
    nameInput.focus();
  }
}

// If the player restarts without saving, keep the record under a default name
function commitPendingRecord() {
  if (pendingRank !== -1) saveRecord(nameInput.value);
}

function hideGameOverRecords() {
  newRecordEl.classList.add('hidden');
  nameForm.classList.add('hidden');
  overRecordsEl.classList.add('hidden');
}

function showStartScreen() {
  board = createBoard();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  renderAllRecords();
  startOverlay.classList.remove('hidden');
  playBtn.focus();
}

// Drop interval in ms for a given level
function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
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
    level = Math.floor(lines / 10) + baseLevel;
    dropInterval = dropIntervalFor(level);
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
  combo = clearLines() ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
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
  context.fillStyle = THEMES[theme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[theme].grid;
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

function setTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  themeText.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
  // Redraw immediately so paused / game-over states update too
  if (current && next) { draw(); drawNext(); }
  else if (board) { ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid(); }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

// ---- Pause menu ----

function togglePause() {
  if (gameOver) return;
  if (paused) closePauseMenu();
  else openPauseMenu();
}

function openPauseMenu() {
  if (paused || gameOver) return;
  paused = true;
  cancelAnimationFrame(animId);
  startLevelSelect.value = String(startLevel);
  setPauseControlsVisible(false);
  pauseMenu.classList.remove('hidden');
  resumeBtn.focus();
}

function closePauseMenu() {
  if (!paused) return;
  paused = false;
  pauseMenu.classList.add('hidden');
  releaseMenuFocus();
  lastTime = performance.now(); // avoid a huge dt after the pause
  loop(lastTime);
}

// Drop focus from menu controls so the next key goes to the game
function releaseMenuFocus() {
  const el = document.activeElement;
  if (el && el !== document.body && pauseMenu.contains(el)) el.blur();
}

// Keep Tab focus inside the open pause menu
function trapMenuFocus(e) {
  const items = [resumeBtn, pauseRestartBtn, pauseControlsBtn, startLevelSelect];
  const i = items.indexOf(document.activeElement);
  const step = e.shiftKey ? -1 : 1;
  const nextIndex = i === -1 ? 0 : (i + step + items.length) % items.length;
  e.preventDefault();
  items[nextIndex].focus();
}

// Build the in-menu key list and level options from single sources of truth
function setupPauseMenu() {
  pauseControls.innerHTML = document.querySelector('.controls ul').innerHTML;
  for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
    const opt = document.createElement('option');
    opt.value = String(lvl);
    opt.textContent = String(lvl);
    startLevelSelect.appendChild(opt);
  }
}

function setPauseControlsVisible(visible) {
  pauseControls.classList.toggle('hidden', !visible);
  pauseControlsBtn.setAttribute('aria-expanded', String(visible));
  pauseControlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
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
  commitPendingRecord();
  hideGameOverRecords();
  startOverlay.classList.add('hidden');
  started = true;
  combo = 0;
  maxCombo = 0;
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  // Drop focus from any button (menu or game-over) so Enter/Space reach the game
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Let the focused theme switch handle Space/Enter without dropping the piece
  if (e.target === themeToggle && (e.code === 'Space' || e.code === 'Enter')) return;
  // Typing a name must not move pieces or toggle pause; nothing to control before Jugar
  if (e.target instanceof HTMLInputElement || !started) return;
  if (paused) {
    // Menu open: block all game input. Only P / Escape close it; other keys
    // keep their native behavior on the focused menu control.
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) togglePause(); // holding the key must not flicker the menu
    } else if (e.code === 'Tab') {
      trapMenuFocus(e);
    } else if (!pauseMenu.contains(e.target) && (e.code === 'Space' || e.code.startsWith('Arrow'))) {
      e.preventDefault(); // nothing focused in the menu: don't scroll the page
    }
    return;
  }
  // Let a focused overlay button (Reiniciar, Borrar records…) handle Space/Enter
  if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); return; }
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

restartBtn.addEventListener('click', () => { init(); restartBtn.blur(); });
playBtn.addEventListener('click', () => { init(); playBtn.blur(); });
nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (pendingRank === -1) return;
  saveRecord(nameInput.value);
  nameForm.classList.add('hidden');
  nameInput.blur();
  renderAllRecords();
});
resumeBtn.addEventListener('click', closePauseMenu);
pauseRestartBtn.addEventListener('click', init);
pauseControlsBtn.addEventListener('click', () => {
  setPauseControlsVisible(pauseControls.classList.contains('hidden'));
});
startLevelSelect.addEventListener('change', () => {
  const lvl = parseInt(startLevelSelect.value, 10);
  startLevel = lvl >= 1 && lvl <= MAX_START_LEVEL ? lvl : 1;
});

setupPauseMenu();
themeToggle.addEventListener('click', () => {
  setTheme(theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // return keyboard control to the game
});

showStartScreen();
