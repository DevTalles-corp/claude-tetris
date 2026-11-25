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
const themeBtn = document.getElementById('theme-btn');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseBackBtn = document.getElementById('pause-back');
const pauseLevelSel = document.getElementById('pause-level');
const skinSelect = document.getElementById('skin-select');

const CLEAR_DURATION = 400;
const BLINK_MS = 100;

const PAUSE_MAX_LEVEL = 15;
const PAUSE_RESUME_GUARD_MS = 150;
let startLevel = 1;
let startLines = 0; // líneas implícitas del nivel inicial (no cuentan para records)
let resumedAt = 0;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, clearing, combo;

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

function findFullRows() {
  const rows = [];
  for (let r = 0; r < ROWS; r++)
    if (board[r].every(v => v !== 0)) rows.push(r);
  return rows;
}

function finishClear() {
  const rows = clearing.rows;
  clearing = null;
  // eliminar de abajo hacia arriba para que los índices sigan siendo válidos
  for (let i = rows.length - 1; i >= 0; i--) {
    board.splice(rows[i], 1);
    board.unshift(new Array(COLS).fill(0));
  }
  const cleared = rows.length;
  combo++;
  Records.noteCombo(combo);
  lines += cleared;
  score += (LINE_SCORES[cleared] || 0) * level;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  updateHUD();
  spawn();
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
  const rows = findFullRows();
  if (rows.length) {
    clearing = { rows, elapsed: 0 };
  } else {
    combo = 0;
    spawn();
  }
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

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) { /* almacenamiento no disponible */ }
  themeBtn.textContent = theme === 'light' ? 'Tema: claro' : 'Tema: oscuro';
  // el canvas no hereda CSS: redibujar (también en pausa o game over)
  draw();
  drawNext();
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
}

let currentSkin = 'retro';

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  SKINS[currentSkin].drawBlock(context, x, y, colorIndex, size);
  context.globalAlpha = 1;
}

function setSkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  currentSkin = skin;
  document.documentElement.dataset.skin = skin;
  try { localStorage.setItem('skin', skin); } catch (e) { /* almacenamiento no disponible */ }
  skinSelect.value = skin;
  // redibujar también en pausa o game over
  draw();
  drawNext();
}

function cycleSkin() {
  setSkin(SKIN_ORDER[(SKIN_ORDER.indexOf(currentSkin) + 1) % SKIN_ORDER.length]);
}

function drawGrid() {
  ctx.strokeStyle = cssVar('--grid');
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
  const blinkOn = clearing && Math.floor(clearing.elapsed / BLINK_MS) % 2 === 0;
  for (let r = 0; r < ROWS; r++) {
    const flashing = clearing && clearing.rows.includes(r);
    for (let c = 0; c < COLS; c++) {
      if (flashing) {
        if (blinkOn && board[r][c]) {
          ctx.fillStyle = cssVar('--flash');
          ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        }
      } else {
        drawBlock(ctx, c, r, board[r][c], BLOCK);
      }
    }
  }

  // durante la animación la pieza ya está fusionada en el tablero
  if (clearing) return;

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
  if (gameOver) return;
  gameOver = true;
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  Records.onGameOver(score, lines - startLines);
  overlay.classList.remove('hidden');
}

function pauseShowView(view) {
  pauseMain.classList.toggle('hidden', view !== 'main');
  pauseControls.classList.toggle('hidden', view !== 'controls');
  (view === 'main' ? pauseResumeBtn : pauseBackBtn).focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    if (document.activeElement) document.activeElement.blur();
    resumedAt = performance.now();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseLevelSel.value = String(startLevel);
    pauseMenu.classList.remove('hidden');
    pauseShowView('main');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (clearing) {
    dropAccum = 0;
    clearing.elapsed += dt;
    if (clearing.elapsed >= CLEAR_DURATION) finishClear();
    if (gameOver) return;
  } else {
    dropAccum += dt;
  }
  if (!clearing && dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return; // lockPiece -> spawn pudo terminar la partida: no reprogramar el bucle
  animId = requestAnimationFrame(loop);
}

function init() {
  Records.startGame();
  combo = 0;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  startLines = (startLevel - 1) * 10;
  lines = startLines;
  paused = false;
  gameOver = false;
  clearing = null;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (Records.isEditing(e.target)) return; // escribiendo el nombre en la tabla de records
  if (e.target === pauseLevelSel) return; // el selector gestiona sus propias teclas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Escape') {
    if (paused && pauseMain.classList.contains('hidden')) pauseShowView('main');
    else togglePause();
    return;
  }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (e.target === skinSelect) { skinSelect.blur(); }
  if (e.code === 'KeyK' && !(e.ctrlKey || e.metaKey || e.altKey)) { cycleSkin(); return; }
  if (paused || gameOver || clearing) return;
  if (performance.now() - resumedAt < PAUSE_RESUME_GUARD_MS) return;
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
pauseResumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
pauseControlsBtn.addEventListener('click', () => pauseShowView('controls'));
pauseBackBtn.addEventListener('click', () => pauseShowView('main'));
pauseLevelSel.addEventListener('change', () => { startLevel = parseInt(pauseLevelSel.value, 10) || 1; pauseLevelSel.blur(); });
for (let i = 1; i <= PAUSE_MAX_LEVEL; i++) pauseLevelSel.add(new Option(String(i), String(i)));
themeBtn.addEventListener('click', () => { toggleTheme(); themeBtn.blur(); });
skinSelect.addEventListener('change', () => { setSkin(skinSelect.value); skinSelect.blur(); });

init();
setTheme(document.documentElement.dataset.theme);
try { setSkin(localStorage.getItem('skin') || 'retro'); } catch (e) { setSkin('retro'); }
