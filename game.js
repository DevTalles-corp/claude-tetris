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
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut - metallic silver
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [100, 400, 800, 1200, 1600];
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const COMBO_BASE = 50;
const B2B_MULTIPLIER = 1.5;
const EFFECT_DURATION = 1200;

const POWERUP_KINDS = ['bomb', 'lightning', 'dye', 'gravity', 'freeze'];
const POWERUP_COLORS = { bomb: '#ff5252', lightning: '#fff176', dye: '#f06292', gravity: '#9575cd', freeze: '#4fc3f7' };
const POWERUP_ICONS = { bomb: '\u{1F4A3}', lightning: '⚡', dye: '\u{1F3A8}', gravity: '⬇', freeze: '❄' };
const LINES_PER_POWERUP = 3;
const FREEZE_DURATION = 5000;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboSection = document.getElementById('combo-section');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const startLevelSelect = document.getElementById('start-level');

const START_LEVEL_KEY = 'tetris-start-level';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let powerUpCounter, pendingPowerUp, frozen, frozenUntil;
let comboCount, backToBack, lastAction, effects;
let audioCtx;

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggleBtn.textContent = theme === 'light' ? 'MODO OSCURO' : 'MODO CLARO';
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light');
  const theme = isLight ? 'dark' : 'light';
  applyTheme(theme);
  localStorage.setItem('theme', theme);
}

function gridColor() {
  return getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPowerUpPiece() {
  const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
  return { isPowerUp: true, kind, shape: [[1]], x: Math.floor(COLS / 2), y: 0 };
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
      lastAction = 'rotate';
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

function isTSpinCorner() {
  if (current.type !== 3 || lastAction !== 'rotate') return false;
  const cx = current.x + 1, cy = current.y + 1;
  const corners = [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]];
  let filled = 0;
  for (const [x, y] of corners) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x]) filled++;
  }
  return filled >= 3;
}

function pushEffect(text, color) {
  effects.push({ text, ttl: EFFECT_DURATION, color });
}

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, dur = 0.15, type = 'square', gain = 0.05, delay = 0) {
  ensureAudio();
  const startAt = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(audioCtx.destination);
  osc.start(startAt);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.stop(startAt + dur);
}

function playComboSound(count) {
  playTone(440 + count * 40, 0.15, 'square', 0.05);
}

function playTSpinSound() {
  playTone(300, 0.12, 'sawtooth', 0.06);
  playTone(500, 0.15, 'sawtooth', 0.06, 0.08);
}

function playB2BSound() {
  playTone(523.25, 0.2, 'triangle', 0.06);
  playTone(659.25, 0.2, 'triangle', 0.06);
  playTone(783.99, 0.2, 'triangle', 0.06);
}

function playPerfectClearSound() {
  playTone(523.25, 0.15, 'sine', 0.07, 0);
  playTone(659.25, 0.15, 'sine', 0.07, 0.12);
  playTone(783.99, 0.15, 'sine', 0.07, 0.24);
  playTone(1046.5, 0.25, 'sine', 0.07, 0.36);
}

function clearLines(tSpin) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared) {
    comboCount = -1;
    if (tSpin) {
      score += TSPIN_SCORES[0] * level;
      pushEffect('T-SPIN', '#ba68c8');
      playTSpinSound();
      updateHUD();
    }
    return;
  }

  lines += cleared;

  comboCount++;
  let base = (tSpin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared]) || 0;

  if (tSpin) {
    pushEffect('T-SPIN', '#ba68c8');
    playTSpinSound();
  }

  const difficult = tSpin || cleared === 4;
  if (difficult && backToBack) {
    base *= B2B_MULTIPLIER;
    pushEffect('B2B!', '#ffd54f');
    playB2BSound();
  }
  backToBack = difficult;

  score += base * level;

  if (comboCount > 0) {
    score += COMBO_BASE * comboCount * level;
    pushEffect(`COMBO x${comboCount + 1}`, '#4dd0e1');
    playComboSound(comboCount);
  }

  level = Math.floor(lines / 10) + 1;
  dropInterval = dropIntervalForLevel(level);
  powerUpCounter += cleared;
  if (powerUpCounter >= LINES_PER_POWERUP) {
    powerUpCounter -= LINES_PER_POWERUP;
    pendingPowerUp = true;
  }

  if (board.every(row => row.every(v => v === 0))) {
    score += PERFECT_CLEAR_SCORES[cleared] * level;
    pushEffect('PERFECT CLEAR', '#fff176');
    playPerfectClearSound();
  }

  updateHUD();
}

function bombArea(cx, cy) {
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = cy + dr, c = cx + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
    }
}

function clearRowAndColumn(cx, cy) {
  if (cy >= 0 && cy < ROWS) board[cy].fill(0);
  if (cx >= 0 && cx < COLS)
    for (let r = 0; r < ROWS; r++) board[r][cx] = 0;
}

function dyeWildcard() {
  const present = new Set();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) present.add(board[r][c]);
  if (!present.size) return;
  const colors = [...present];
  const target = colors[Math.floor(Math.random() * colors.length)];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === target) board[r][c] = 0;
}

function compactGravity() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++)
      if (board[r][c]) values.push(board[r][c]);
    for (let r = ROWS - 1; r >= 0; r--)
      board[r][c] = values.length ? values.pop() : 0;
  }
}

function freezeDrop() {
  frozen = true;
  frozenUntil = performance.now() + FREEZE_DURATION;
}

function applyPowerUp(kind, cx, cy) {
  switch (kind) {
    case 'bomb':
      bombArea(cx, cy);
      compactGravity();
      break;
    case 'lightning':
      clearRowAndColumn(cx, cy);
      compactGravity();
      break;
    case 'dye':
      dyeWildcard();
      compactGravity();
      break;
    case 'gravity':
      compactGravity();
      break;
    case 'freeze':
      freezeDrop();
      break;
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
  let tSpin = false;
  if (current.isPowerUp) {
    applyPowerUp(current.kind, current.x, current.y);
  } else {
    merge();
    tSpin = isTSpinCorner();
  }
  clearLines(tSpin);
  spawn();
}

function spawn() {
  lastAction = null;
  current = next;
  if (pendingPowerUp) {
    next = randomPowerUpPiece();
    pendingPowerUp = false;
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
  if (comboCount > 0) {
    comboEl.textContent = `x${comboCount + 1}`;
    comboSection.classList.remove('hidden');
  } else {
    comboSection.classList.add('hidden');
  }
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

function drawPowerUpBlock(context, x, y, kind, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = POWERUP_COLORS[kind];
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = alpha ?? 1;
  context.font = `${Math.floor(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#000';
  context.fillText(POWERUP_ICONS[kind], x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor();
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

  drawEffects();

  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        if (current.isPowerUp) drawPowerUpBlock(ctx, current.x + c, gy + r, current.kind, BLOCK, 0.2);
        else drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
      }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        if (current.isPowerUp) drawPowerUpBlock(ctx, current.x + c, current.y + r, current.kind, BLOCK);
        else drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
      }

  if (frozen) {
    ctx.fillStyle = 'rgba(79,195,247,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4fc3f7';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CONGELADO', canvas.width / 2, 24);
  }
}

function drawEffects() {
  if (!effects.length) return;
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px sans-serif';
  effects.forEach((effect, i) => {
    const alpha = Math.max(0, effect.ttl / EFFECT_DURATION);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = effect.color;
    ctx.fillText(effect.text, canvas.width / 2, 28 + i * 24);
  });
  ctx.globalAlpha = 1;
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        if (next.isPowerUp) drawPowerUpBlock(nextCtx, offX + c, offY + r, next.kind, NB);
        else drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
      }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  showGameOverBlock();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function getStartLevel() {
  const stored = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  if (Number.isInteger(stored) && stored >= 1 && stored <= 10) return stored;
  return 1;
}

function dropIntervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function closePauseMenu() {
  pauseControlsList.classList.add('hidden');
  pauseMenu.classList.add('hidden');
}

function showGameOverBlock() {
  closePauseMenu();
  overlayTitle.classList.remove('hidden');
  overlayScore.classList.remove('hidden');
  restartBtn.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.classList.add('hidden');
    overlayScore.classList.add('hidden');
    restartBtn.classList.add('hidden');
    startLevelSelect.value = String(getStartLevel());
    pauseMenu.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (effects.length) {
    for (const effect of effects) effect.ttl -= dt;
    effects = effects.filter(e => e.ttl > 0);
  }
  if (frozen) {
    if (ts >= frozenUntil) frozen = false;
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = getStartLevel();
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalForLevel(level);
  dropAccum = 0;
  powerUpCounter = 0;
  pendingPowerUp = false;
  frozen = false;
  frozenUntil = 0;
  comboCount = -1;
  backToBack = false;
  lastAction = null;
  effects = [];
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  showGameOverBlock();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastAction = 'move'; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastAction = 'move'; }
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
themeToggleBtn.addEventListener('click', toggleTheme);
resumeBtn.addEventListener('click', () => { if (paused) togglePause(); });
pauseRestartBtn.addEventListener('click', init);
toggleControlsBtn.addEventListener('click', () => {
  pauseControlsList.classList.toggle('hidden');
});
startLevelSelect.addEventListener('change', () => {
  localStorage.setItem(START_LEVEL_KEY, startLevelSelect.value);
});

initTheme();
startLevelSelect.value = String(getStartLevel());
init();
