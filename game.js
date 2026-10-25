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
  '#f06292', // H - pink (hollow square)
  '#b0bec5', // comodín (tinte)
];

const WILD = 9;

// Power-ups: pieza de 1 bloque; `color` indica la pieza cuyo color toman
const POWERS = {
  bomb:      { name: 'Bomba',    color: 2, glyph: '💣', desc: 'Elimina la fila de debajo.' },
  lightning: { name: 'Rayo',     color: 4, glyph: '⚡', desc: 'Borra toda su columna.' },
  tint:      { name: 'Tinte',    color: 4, glyph: '🎨', desc: 'Comodín abajo y rellena la fila.' },
  gravity:   { name: 'Gravedad', color: 1, glyph: '⬇', desc: 'Los bloques caen y tapan huecos.' },
  freeze:    { name: 'Congelar', color: 3, glyph: '❄', desc: 'Detiene la caída 5 s.' },
};
const POWER_KEYS = Object.keys(POWERS);
const FREEZE_MS = 5000;
const POWERUPS_KEY = 'tetris-powerups';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // H (hollow square)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Combos y multiplicadores (se aplican directamente a la puntuación)
const TSPIN_SCORES = [400, 800, 1200, 1600]; // 0-3 líneas
const TSPIN_MULT = 1;
const B2B_MULT = 1.5;
const PERFECT_MULT = 2;
const TSPIN_NAMES = ['T-SPIN', 'T-SPIN SIMPLE', 'T-SPIN DOBLE', 'T-SPIN TRIPLE'];
const FEATURES_KEY = 'tetris-features';
const MUTE_KEY = 'tetris-muted';
const SCORES_KEY = 'tetris-scores';
const NAME_KEY = 'tetris-name';
const MAX_HISTORY = 50;
const features = { combo: true, tspin: true, b2b: true, perfect: true };

const THEMES = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)', ghostAlpha: 0.2 },
  light: { grid: '#e1e3ec', highlight: 'rgba(255,255,255,0.35)', ghostAlpha: 0.3 },
};
const THEME_KEY = 'tetris-theme';
let currentTheme = 'dark';

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
const nextNameEl = document.getElementById('next-name');
const nextDescEl = document.getElementById('next-desc');
const freezeEl = document.getElementById('freeze');
const powerToggle = document.getElementById('powerup-toggle');
const comboEl = document.getElementById('combo');
const comboMsgEl = document.getElementById('combo-msg');
const muteBtn = document.getElementById('mute-btn');
const lastScoreEl = document.getElementById('last-score');
const lastNameEl = document.getElementById('last-name');
const bestScoreEl = document.getElementById('best-score');
const playerNameEl = document.getElementById('player-name');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerupsEnabled = true, powerPending, nextPowerAt, freezeLeft;
let comboCount, b2bActive, lastMoveWasRotation, muted = false, audioCtx, msgTimer;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// Líneas hasta el siguiente power-up: aumenta con el nivel (menos frecuente)
function powerInterval() {
  return Math.min(12, 3 + level);
}

function powerPiece() {
  const power = POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)];
  const color = POWERS[power].color;
  return { type: color, power, shape: [[color]], x: Math.floor(COLS / 2), y: 0 };
}

function glyphOf(piece) {
  return piece.power ? POWERS[piece.power].glyph : null;
}

function randomPiece() {
  if (powerupsEnabled && powerPending) {
    powerPending = false;
    return powerPiece();
  }
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
      lastMoveWasRotation = true;
      sfx('rotate');
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
  return cleared;
}

// T-spin (regla de 3 esquinas): T bloqueada tras rotar con 3 de las 4 esquinas ocupadas
function isTSpin() {
  if (current.power || current.type !== 3 || !lastMoveWasRotation) return false;
  let filled = 0;
  for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
    const nx = current.x + dx, ny = current.y + dy;
    if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) filled++;
  }
  return filled >= 3;
}

function isBoardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

// Puntúa un bloqueo de pieza: combo, T-spin, B2B y Perfect Clear
function scoreLock(cleared, tspin) {
  const notes = [];
  tspin = tspin && features.tspin;
  if (!cleared && !tspin) { comboCount = 0; updateHUD(); return; }
  let base;
  let mult = TSPIN_MULT;
  if (tspin) {
    base = TSPIN_SCORES[Math.min(cleared, 3)];
    notes.push(TSPIN_NAMES[Math.min(cleared, 3)]);
  } else {
    base = LINE_SCORES[Math.min(cleared, 4)];
    if (cleared === 4) notes.push('TETRIS');
  }
  if (!cleared) { // T-spin sin líneas: rompe el combo, no toca el B2B
    comboCount = 0;
    score += base * level * mult;
    announce(notes);
    updateHUD();
    return;
  }
  comboCount++;
  if (features.combo && comboCount > 1) {
    mult *= comboCount;
    notes.push(`COMBO x${comboCount}`);
  }
  const difficult = tspin || cleared === 4;
  if (features.b2b) {
    if (difficult && b2bActive) { mult *= B2B_MULT; notes.push(`BACK-TO-BACK x${B2B_MULT}`); }
    b2bActive = difficult;
  }
  if (features.perfect && isBoardEmpty()) { mult *= PERFECT_MULT; notes.push(`PERFECT CLEAR x${PERFECT_MULT}`); }
  score += Math.round(base * level * mult);
  addLines(cleared);
  announce(notes);
  sfx(notes.length > 1 || difficult ? 'big' : 'clear', comboCount);
}

function addLines(cleared) {
  if (!cleared) return;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  if (lines >= nextPowerAt) {
    powerPending = true;
    nextPowerAt = lines + powerInterval();
  }
  updateHUD();
}

function removeRow(r) {
  board.splice(r, 1);
  board.unshift(new Array(COLS).fill(0));
}

function compactBoard() {
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
    for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() || 0;
  }
}

function applyPower() {
  const { power, x, y } = current;
  const below = y + 1 < ROWS ? board[y + 1][x] : 0;
  switch (power) {
    case 'bomb': // al tocar otro bloque borra su fila
      if (below) { removeRow(y + 1); return 1; }
      break;
    case 'lightning': // limpia la columna de la posición
      if (board.some(row => row[x])) {
        for (let r = 0; r < ROWS; r++) board[r][x] = 0;
        return 1;
      }
      break;
    case 'tint': // el color del bloque más cercano pasa a comodín y completa la fila inferior
      if (below) {
        if (below !== WILD)
          for (const row of board)
            for (let c = 0; c < COLS; c++) if (row[c] === below) row[c] = WILD;
        for (let c = 0; c < COLS; c++) if (!board[y + 1][c]) board[y + 1][c] = WILD;
      }
      break;
    case 'gravity':
      compactBoard();
      break;
    case 'freeze':
      freezeLeft = FREEZE_MS;
      break;
  }
  return 0;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastMoveWasRotation = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveWasRotation = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin();
  let cleared = 0;
  if (current.power) cleared += applyPower();
  else merge();
  cleared += clearLines();
  scoreLock(cleared, tspin);
  lastMoveWasRotation = false;
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
  freezeEl.classList.toggle('hidden', freezeLeft <= 0);
  freezeEl.textContent = `❄ ${Math.ceil(freezeLeft / 1000)}s`;
  comboEl.textContent = features.combo && comboCount > 1 ? `COMBO x${comboCount}` : '';
}

// ---- Efectos visuales y sonoros ----
function announce(notes) {
  if (!notes.length) return;
  comboMsgEl.textContent = '';
  notes.forEach(n => {
    const line = document.createElement('div');
    line.textContent = n;
    comboMsgEl.appendChild(line);
  });
  comboMsgEl.classList.remove('show');
  void comboMsgEl.offsetWidth; // reinicia la animación
  comboMsgEl.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => comboMsgEl.classList.remove('show'), 1500);
}

function tone(freq, start, dur, type = 'square', vol = 0.06) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const t = audioCtx.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// Sonidos generados por código (Web Audio), sin archivos externos
function sfx(kind, n = 1) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (kind === 'rotate') tone(440, 0, 0.04, 'square', 0.03);
    else if (kind === 'clear') tone(440 * Math.pow(1.12, Math.min(n, 12)), 0, 0.15, 'triangle', 0.1);
    else if (kind === 'big') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, 'triangle', 0.1));
  } catch (e) { /* audio no disponible */ }
}

function drawBlock(context, x, y, colorIndex, size, alpha, glyph) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEMES[currentTheme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (glyph) {
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
    context.fillStyle = '#000';
    context.font = `${Math.floor(size * 0.55)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[currentTheme].grid;
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
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, THEMES[currentTheme].ghostAlpha, glyphOf(current));

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, glyphOf(current));
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, glyphOf(next));
  nextNameEl.textContent = next.power ? `Power-up: ${POWERS[next.power].name}` : '';
  nextDescEl.textContent = next.power ? POWERS[next.power].desc : '';
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  restartBtn.textContent = 'Reiniciar';
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  recordGame();
}

// ---- Historial de partidas ----
function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(SCORES_KEY));
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

function recordGame() {
  if (score <= 0) return;
  const name = playerNameEl.value.trim();
  const history = loadScores();
  history.push({ name, score });
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    localStorage.setItem(NAME_KEY, name);
  } catch (e) { /* ignorar */ }
  renderLastGame();
}

function renderLastGame() {
  const history = loadScores();
  if (!history.length) {
    lastScoreEl.textContent = '—';
    lastNameEl.textContent = '';
    bestScoreEl.textContent = '—';
    return;
  }
  const last = history[history.length - 1];
  const best = history.reduce((a, b) => (b.score > a.score ? b : a));
  lastScoreEl.textContent = last.score.toLocaleString();
  lastNameEl.textContent = last.name;
  bestScoreEl.textContent = best.name
    ? `${best.score.toLocaleString()} · ${best.name}`
    : best.score.toLocaleString();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    restartBtn.textContent = 'Continuar';
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    updateHUD();
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveWasRotation = false;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
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
  powerPending = false;
  nextPowerAt = powerInterval();
  freezeLeft = 0;
  comboCount = 0;
  b2bActive = false;
  lastMoveWasRotation = false;
  comboMsgEl.classList.remove('show');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === playerNameEl) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveWasRotation = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveWasRotation = false; }
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

restartBtn.addEventListener('click', () => {
  if (paused && !gameOver) togglePause(); // en pausa: reanudar sin reiniciar
  else init();
});

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  const isLight = theme === 'light';
  themeToggle.setAttribute('aria-checked', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // repintar aunque el juego esté en pausa o terminado
  if (current) draw();
  if (next) drawNext();
}

themeToggle.addEventListener('click', () => {
  const theme = currentTheme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignorar */ }
  applyTheme(theme);
  themeToggle.blur(); // evita que Space active el botón durante el juego
});

powerToggle.addEventListener('change', () => {
  powerupsEnabled = powerToggle.checked;
  if (!powerupsEnabled) powerPending = false;
  try { localStorage.setItem(POWERUPS_KEY, String(powerupsEnabled)); } catch (e) { /* ignorar */ }
  powerToggle.blur(); // evita que Space cambie la casilla durante el juego
});

try { Object.assign(features, JSON.parse(localStorage.getItem(FEATURES_KEY)) || {}); } catch (e) { /* ignorar */ }
try { powerupsEnabled = localStorage.getItem(POWERUPS_KEY) !== 'false'; } catch (e) { /* ignorar */ }
powerToggle.checked = powerupsEnabled;

document.querySelectorAll('[data-feature]').forEach(box => {
  box.checked = features[box.dataset.feature];
  box.addEventListener('change', () => {
    features[box.dataset.feature] = box.checked;
    try { localStorage.setItem(FEATURES_KEY, JSON.stringify(features)); } catch (e) { /* ignorar */ }
    updateHUD();
    box.blur(); // evita que Space cambie la casilla durante el juego
  });
});

function applyMute() {
  muteBtn.textContent = muted ? '🔇 Sonido' : '🔊 Sonido';
  muteBtn.setAttribute('aria-pressed', String(muted));
}

muteBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, String(muted)); } catch (e) { /* ignorar */ }
  applyMute();
  muteBtn.blur();
});

try { muted = localStorage.getItem(MUTE_KEY) === 'true'; } catch (e) { /* ignorar */ }
applyMute();

try { playerNameEl.value = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* ignorar */ }
renderLastGame();

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignorar */ }

init();
applyTheme(savedTheme === 'light' ? 'light' : 'dark');
