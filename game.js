'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ids de celda: 1-7 piezas clásicas, 8-12 piezas especiales, 13 basura, 14 comodín, 15 power-up
const GARBAGE = 13;
const WILD = 14;
const POWER = 15;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#42a5f5', // J - azul claro
  '#ffb74d', // L - orange
  '#f06292', // + - rosa
  '#a1887f', // U - marrón
  '#aed581', // Y - lima
  '#fff176', // 1x1 - amarillo claro
  '#90a4ae', // 3x3 hueca - gris azulado
  '#6d6d7a', // basura
  '#ffffff', // comodín (se dibuja con gradiente)
  '#ffffff', // power-up (se dibuja aparte)
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
  [[0,8,0],[8,8,8],[0,8,0]],                  // + (pentominó)
  [[9,0,9],[9,9,9]],                          // U (pentominó)
  [[0,10],[10,10],[0,10],[0,10]],             // Y (pentominó)
  [[11]],                                      // 1x1 (recompensa tras Tetris)
  [[12,12,12],[12,0,12],[12,12,12]],          // 3x3 hueca (reto)
];

const PENTOMINOS = [8, 9, 10];
const RING = 12;
const SINGLE = 11;

const POWERS = {
  bomb:      { icon: '💣', color: '#ef5350', label: 'BOMBA' },
  lightning: { icon: '⚡', color: '#fdd835', label: 'RAYO' },
  tint:      { icon: '🎨', color: '#ab47bc', label: 'TINTE' },
  gravity:   { icon: '🌀', color: '#26a69a', label: 'GRAVEDAD' },
  freeze:    { icon: '❄️', color: '#4fc3f7', label: 'CONGELAR' },
};
const POWER_KINDS = Object.keys(POWERS);
const POWER_EVERY_LINES = 5;
const FREEZE_MS = 5000;

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PERFECT_CLEAR_BONUS = 3000;
const WILD_BONUS = 50;

const ENERGY_PER_LINE = 15;
const ENERGY_MAX = 100;
const ABILITY_ORDER = ['lookahead', 'swap', 'slow', 'undo', 'hold'];
const LOOKAHEAD_MS = 10000;
const SLOW_MS = 10000;
const SLOW_FACTOR = 3;

const CHALLENGES = {
  sprint:    { desc: 'Limpia 40 líneas en 2:00', goalLines: 40, timeLimit: 120000 },
  garbage:   { desc: 'Sobrevive 90 s: sube basura cada 10 s', surviveTime: 90000, garbageEvery: 10000 },
  fixed:     { desc: 'Limpia 15 líneas con bloques pre-colocados', goalLines: 15, prefill: 7 },
  invisible: { desc: 'Limpia 10 líneas: las piezas se ocultan', goalLines: 10, invisible: true },
  reverse:   { desc: 'Limpia 15 líneas con rotación inversa (nivel 6)', goalLines: 15, startLevel: 6, reverseRot: true },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const lookCanvas = document.getElementById('look-canvas');
const lookCtx = lookCanvas.getContext('2d');
const lookSection = document.getElementById('look-section');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');
const energyEl = document.getElementById('energy');
const energyFill = document.getElementById('energy-fill');
const energyHint = document.getElementById('energy-hint');
const modeSelect = document.getElementById('mode-select');
const objectiveEl = document.getElementById('objective');
const progressEl = document.getElementById('progress');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const abilityOverlay = document.getElementById('ability-overlay');
const themeBtn = document.getElementById('theme-toggle');

const THEME_KEY = 'tetris-theme';
let theme = 'dark';
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let upcoming, hold, holdUsed, lastRotate, combo, b2b, energy, nextPowerAt, undoState;
let challenge, baseLevel, elapsed, garbageTimer, revealUntil;
let freezeLeft, slowLeft, lookLeft, abilityMenu, popups, flash;
let audioCtx = null, muted = false;

// ---------- Piezas ----------

function makePiece(type, power) {
  const shape = power ? [[POWER]] : PIECES[type].map(row => [...row]);
  return { type, power: power || null, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function makePowerPiece() {
  return makePiece(POWER, POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)]);
}

function randomPiece() {
  const roll = Math.random();
  let type;
  if (roll < 0.07) type = PENTOMINOS[Math.floor(Math.random() * PENTOMINOS.length)];
  else if (roll < 0.10) type = RING;
  else type = Math.floor(Math.random() * 7) + 1;
  return makePiece(type);
}

function clonePiece(p) {
  return { type: p.type, power: p.power, shape: p.shape.map(r => [...r]), x: p.x, y: p.y };
}

function fillUpcoming() {
  while (upcoming.length < 6) upcoming.push(randomPiece());
}

function nextFromQueue() {
  fillUpcoming();
  const p = upcoming.shift();
  fillUpcoming();
  next = upcoming[0];
  return p;
}

// inserta una pieza justo después de la que se muestra como NEXT
function insertAfterNext(piece) {
  upcoming.splice(1, 0, piece);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
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

function rotate(shape, dir) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (dir > 0) result[c][rows - 1 - r] = shape[r][c];
      else result[cols - 1 - c][r] = shape[r][c];
    }
  return result;
}

function tryRotate() {
  const rotated = rotate(current.shape, challenge && challenge.reverseRot ? -1 : 1);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastRotate = true;
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

// ---------- Líneas, combos y puntuación ----------

function clearRows() {
  let cleared = 0, wilds = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      wilds += board[r].filter(v => v === WILD).length;
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return { cleared, wilds };
}

function isBoardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

// T-spin: pieza T, último movimiento fue una rotación y >= 3 esquinas ocupadas
function detectTSpin() {
  if (current.type !== 3 || !lastRotate) return false;
  const occupied = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0);
  const corners = [
    occupied(current.x, current.y), occupied(current.x + 2, current.y),
    occupied(current.x, current.y + 2), occupied(current.x + 2, current.y + 2),
  ];
  return corners.filter(Boolean).length >= 3;
}

function lockPiece() {
  saveUndo();
  let tspin = false;
  if (current.power) {
    applyPower(current.power, current.x, current.y);
  } else {
    tspin = detectTSpin();
    merge();
  }
  revealUntil = performance.now() + 1200;

  const { cleared, wilds } = clearRows();
  let pts = 0;

  if (cleared) {
    lines += cleared;
    combo++;
    const special = cleared === 4 || tspin;
    let mult = 1;
    if (special) {
      if (b2b) { mult = 1.5; announce('BACK-TO-BACK', '#ffb74d'); }
      b2b = true;
    } else {
      b2b = false;
    }
    const base = tspin ? TSPIN_SCORES[Math.min(cleared, 3)] : LINE_SCORES[cleared];
    pts += Math.floor(base * level * mult * combo);
    if (tspin) announce(`T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][Math.min(cleared, 3)]}`, '#ba68c8');
    else if (cleared === 4) announce('TETRIS!', '#4dd0e1');
    if (combo > 1) announce(`COMBO x${combo}`, '#ffd54f');
    if (wilds) { pts += wilds * WILD_BONUS; announce(`COMODÍN +${wilds * WILD_BONUS}`, '#f48fb1'); }
    energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
    sfxClear(cleared, combo, tspin);
    flashScreen(cleared === 4 || tspin ? '#ffffff' : '#7aa2f7');

    level = baseLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);

    if (cleared === 4) {
      insertAfterNext(makePiece(SINGLE));
      announce('+ PIEZA 1x1', '#fff176');
    }
    if (lines >= nextPowerAt) {
      nextPowerAt = (Math.floor(lines / POWER_EVERY_LINES) + 1) * POWER_EVERY_LINES;
      insertAfterNext(makePowerPiece());
      announce('¡POWER-UP EN CAMINO!', '#80deea');
    }
  } else {
    combo = 0;
    if (tspin) {
      pts += 400 * level;
      announce('T-SPIN', '#ba68c8');
      sfxClear(0, 0, true);
    }
  }

  if (isBoardEmpty() && (cleared || current.power)) {
    pts += PERFECT_CLEAR_BONUS * level;
    announce('PERFECT CLEAR!', '#ffffff');
    flashScreen('#ffd54f');
    sfxPerfect();
  }

  score += pts;
  updateHUD();
  spawn();
  checkChallengeGoal();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy !== current.y) lastRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function moveHorizontal(dx) {
  if (!collide(current.shape, current.x + dx, current.y)) {
    current.x += dx;
    lastRotate = false;
  }
}

// ---------- Spawn y Hold ----------

function putCurrent(piece) {
  current = piece;
  lastRotate = false;
  if (collide(current.shape, current.x, current.y)) endGame();
  drawNext();
  drawHold();
}

function spawn() {
  holdUsed = false;
  putCurrent(nextFromQueue());
}

function doHold(force) {
  if (!force && holdUsed) return;
  const stored = makePiece(current.type, current.power);
  if (!hold) {
    hold = stored;
    putCurrent(nextFromQueue());
  } else {
    const swapped = hold;
    hold = stored;
    putCurrent(makePiece(swapped.type, swapped.power));
  }
  if (!force) holdUsed = true;
  drawHold();
}

// ---------- Power-ups ----------

function applyPower(kind, x, y) {
  announce(POWERS[kind].label, POWERS[kind].color);
  sfxPower();
  switch (kind) {
    case 'bomb': {
      let destroyed = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue;
          if (board[ny][nx]) { board[ny][nx] = 0; destroyed++; }
        }
      score += destroyed * 10;
      flashScreen('#ff7043');
      break;
    }
    case 'lightning': {
      for (let r = 0; r < ROWS; r++) board[r][x] = 0;
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(0));
      score += COLS * 10;
      flashScreen('#fdd835');
      break;
    }
    case 'tint': {
      let target = 0;
      if (y + 1 < ROWS && board[y + 1][x] && board[y + 1][x] < GARBAGE) target = board[y + 1][x];
      if (!target) {
        const counts = {};
        for (const row of board) for (const v of row) if (v && v < GARBAGE) counts[v] = (counts[v] || 0) + 1;
        let best = 0;
        for (const k in counts) if (counts[k] > best) { best = counts[k]; target = Number(k); }
      }
      if (target) {
        for (const row of board) for (let c = 0; c < COLS; c++) if (row[c] === target) row[c] = WILD;
      }
      flashScreen('#ab47bc');
      break;
    }
    case 'gravity': {
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = ROWS - 1; r >= 0; r--) if (board[r][c]) col.push(board[r][c]);
        for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) board[r][c] = col[i] || 0;
      }
      flashScreen('#26a69a');
      break;
    }
    case 'freeze':
      freezeLeft = FREEZE_MS;
      flashScreen('#4fc3f7');
      break;
  }
}

// ---------- Habilidades ----------

function saveUndo() {
  undoState = {
    board: board.map(r => r.slice()),
    piece: clonePiece(current),
    upcoming: upcoming.map(clonePiece),
    score, lines, level, dropInterval, combo, b2b, nextPowerAt,
    hold: hold ? clonePiece(hold) : null,
    holdUsed,
  };
}

function restoreUndo() {
  const s = undoState;
  board = s.board;
  upcoming = s.upcoming;
  next = upcoming[0];
  ({ score, lines, level, dropInterval, combo, b2b, nextPowerAt, holdUsed } = s);
  hold = s.hold;
  const piece = clonePiece(s.piece);
  const top = clonePiece(piece);
  top.y = 0;
  current = collide(top.shape, top.x, top.y) ? piece : top;
  lastRotate = false;
  undoState = null;
  drawNext();
  drawHold();
}

function useAbility(id) {
  switch (id) {
    case 'lookahead':
      lookLeft = LOOKAHEAD_MS;
      drawNext();
      return true;
    case 'swap': {
      const pool = [1, 2, 3, 4, 5, 6, 7, ...PENTOMINOS, RING].filter(t => t !== current.type);
      const replacement = makePiece(pool[Math.floor(Math.random() * pool.length)]);
      if (collide(replacement.shape, replacement.x, replacement.y)) return false;
      current = replacement;
      lastRotate = false;
      return true;
    }
    case 'slow':
      slowLeft = SLOW_MS;
      return true;
    case 'undo':
      if (!undoState) return false;
      restoreUndo();
      return true;
    case 'hold':
      doHold(true);
      return true;
  }
  return false;
}

function openAbilityMenu() {
  if (energy < ENERGY_MAX || abilityMenu || paused || gameOver) return;
  abilityMenu = true;
  cancelAnimationFrame(animId);
  abilityOverlay.classList.remove('hidden');
}

function closeAbilityMenu() {
  if (!abilityMenu) return;
  abilityMenu = false;
  abilityOverlay.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
  if (!gameOver) {
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
  draw();
}

function chooseAbility(id) {
  if (!useAbility(id)) {
    announce('NO DISPONIBLE', '#e57373');
    draw();
    return;
  }
  energy = 0;
  announce('HABILIDAD ACTIVADA', '#80deea');
  sfxPower();
  updateHUD();
  closeAbilityMenu();
}

// ---------- Desafíos ----------

function prefillBoard(rowsCount) {
  for (let r = ROWS - rowsCount; r < ROWS; r++) {
    let filled = 0;
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < 0.7) { board[r][c] = Math.floor(Math.random() * 7) + 1; filled++; }
    }
    if (filled === COLS) board[r][Math.floor(Math.random() * COLS)] = 0;
  }
}

function addGarbageRow() {
  if (board[0].some(v => v !== 0)) { endGame(); return; }
  board.shift();
  const row = new Array(COLS).fill(GARBAGE);
  row[Math.floor(Math.random() * COLS)] = 0;
  board.push(row);
  while (collide(current.shape, current.x, current.y) && current.y > -2) current.y--;
  if (collide(current.shape, current.x, current.y)) endGame();
  announce('¡BASURA!', '#9e9e9e');
}

function checkChallengeGoal() {
  if (!challenge || gameOver) return;
  if (challenge.goalLines && lines >= challenge.goalLines) winGame();
}

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateProgress() {
  if (!challenge) { progressEl.textContent = ''; return; }
  const parts = [];
  if (challenge.goalLines) parts.push(`Líneas ${Math.min(lines, challenge.goalLines)}/${challenge.goalLines}`);
  if (challenge.timeLimit) parts.push(`Tiempo ${formatTime(challenge.timeLimit - elapsed)}`);
  if (challenge.surviveTime) parts.push(`Sobrevive ${formatTime(challenge.surviveTime - elapsed)}`);
  if (challenge.garbageEvery) parts.push(`Basura en ${formatTime(challenge.garbageEvery - garbageTimer)}`);
  progressEl.textContent = parts.join(' · ');
}

// ---------- HUD y dibujo ----------

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo > 1 ? `x${combo}` : '—';
  b2bEl.classList.toggle('on', !!b2b);
  energyFill.style.width = `${energy}%`;
  const full = energy >= ENERGY_MAX;
  energyEl.classList.toggle('full', full);
  energyHint.textContent = full ? 'Pulsa E' : `${energy}%`;
}

function announce(text, color) {
  popups.push({ text, color, t0: performance.now() });
  if (popups.length > 5) popups.shift();
}

function flashScreen(color) {
  flash = { color, t0: performance.now() };
}

function drawCell(context, x, y, v, size, alpha, power) {
  if (!v) return;
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;
  if (v === POWER) {
    const p = POWERS[power];
    context.fillStyle = p.color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.strokeRect(px + 2, py + 2, size - 4, size - 4);
    context.font = `${Math.floor(size * 0.6)}px serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#000';
    context.fillText(p.icon, px + size / 2, py + size / 2 + 1);
    context.textAlign = 'start';
    context.textBaseline = 'alphabetic';
  } else {
    if (v === WILD) {
      const g = context.createLinearGradient(px, py, px + size, py + size);
      ['#ef5350', '#ffd54f', '#81c784', '#42a5f5', '#ba68c8'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      context.fillStyle = g;
    } else {
      context.fillStyle = COLORS[v];
    }
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = theme === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
  }
  context.globalAlpha = 1;
}

function drawPieceAt(context, piece, ox, oy, size, alpha) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      drawCell(context, ox + c, oy + r, piece.shape[r][c], size, alpha, piece.power);
}

// dibuja una pieza centrada en una caja de w x h
function drawMini(context, piece, x0, y0, w, h, size) {
  const s = piece.shape;
  let minR = 99, maxR = -1, minC = 99, maxC = -1;
  for (let r = 0; r < s.length; r++)
    for (let c = 0; c < s[r].length; c++)
      if (s[r][c]) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
  const offX = x0 + (w - (maxC - minC + 1) * size) / 2 - minC * size;
  const offY = y0 + (h - (maxR - minR + 1) * size) / 2 - minR * size;
  context.save();
  context.translate(offX, offY);
  drawPieceAt(context, piece, 0, 0, size, 1);
  context.restore();
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
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board (en el desafío "invisible" se oculta tras un instante)
  const hidden = challenge && challenge.invisible && !gameOver && now > revealUntil;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawCell(ctx, c, r, board[r][c], BLOCK, hidden ? 0.07 : 1);

  // ghost
  const gy = ghostY();
  drawPieceAt(ctx, { ...current, y: gy }, current.x, gy, BLOCK, 0.2);

  // current piece
  drawPieceAt(ctx, current, current.x, current.y, BLOCK, 1);

  // estados
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(120, 200, 255, 0.14)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(`❄ ${(freezeLeft / 1000).toFixed(1)}s`, 8, 20);
  }
  if (slowLeft > 0) {
    ctx.fillStyle = '#ffb74d';
    ctx.fillText(`⏳ ${(slowLeft / 1000).toFixed(1)}s`, 8, freezeLeft > 0 ? 38 : 20);
  }

  // flash
  if (flash) {
    const a = 1 - (now - flash.t0) / 350;
    if (a > 0) {
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    } else {
      flash = null;
    }
  }

  // mensajes flotantes
  popups = popups.filter(p => now - p.t0 < 1600);
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.lineWidth = 4;
  popups.forEach((p, i) => {
    const age = now - p.t0;
    ctx.globalAlpha = Math.max(0, 1 - age / 1600);
    const y = 200 + i * 30 - age * 0.03;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(p.text, canvas.width / 2, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, canvas.width / 2, y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (next) drawMini(nextCtx, next, 0, 0, nextCanvas.width, nextCanvas.height, 24);
  drawLookahead();
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (hold) drawMini(holdCtx, hold, 0, 0, holdCanvas.width, holdCanvas.height, 24);
  holdCanvas.classList.toggle('locked', !!holdUsed);
}

function drawLookahead() {
  const active = lookLeft > 0;
  lookSection.classList.toggle('hidden', !active);
  if (!active) return;
  lookCtx.clearRect(0, 0, lookCanvas.width, lookCanvas.height);
  const slot = lookCanvas.height / 5;
  for (let i = 0; i < 5 && i < upcoming.length; i++)
    drawMini(lookCtx, upcoming[i], 0, i * slot, lookCanvas.width, slot, 12);
}

// ---------- Sonido ----------

function ensureAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
}

function tone(freq, dur, delay = 0, type = 'square', vol = 0.05) {
  if (muted || !audioCtx) return;
  try {
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* audio no disponible */ }
}

function sfxClear(count, comboLevel, tspin) {
  const base = 330 * Math.pow(1.0595, Math.min(comboLevel, 12) * 2);
  const n = Math.max(count, tspin ? 2 : 1);
  for (let i = 0; i < n; i++) tone(base * Math.pow(1.25, i), 0.12, i * 0.07);
}

function sfxPerfect() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, i * 0.08, 'triangle', 0.07));
}

function sfxPower() {
  tone(220, 0.1, 0, 'sawtooth');
  tone(440, 0.15, 0.08, 'sawtooth');
}

// ---------- Estado del juego ----------

function endGame(title = 'GAME OVER') {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = title;
  overlayTitle.classList.remove('win');
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  tone(180, 0.4, 0, 'sawtooth');
}

function winGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = '¡DESAFÍO SUPERADO!';
  overlayTitle.classList.add('win');
  overlayScore.textContent = `Tiempo ${formatTime(elapsed)} · Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  sfxPerfect();
  draw();
}

function togglePause() {
  if (gameOver || abilityMenu) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayTitle.classList.remove('win');
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = Math.min(ts - lastTime, 250);
  lastTime = ts;
  elapsed += dt;

  if (slowLeft > 0) slowLeft -= dt;
  if (lookLeft > 0) { lookLeft -= dt; if (lookLeft <= 0) drawLookahead(); }

  if (freezeLeft > 0) {
    freezeLeft -= dt;
    dropAccum = 0;
  } else {
    dropAccum += dt;
  }
  const interval = dropInterval * (slowLeft > 0 ? SLOW_FACTOR : 1);
  if (dropAccum >= interval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastRotate = false;
    } else {
      lockPiece();
    }
  }

  if (challenge && !gameOver) {
    if (challenge.garbageEvery) {
      garbageTimer += dt;
      if (garbageTimer >= challenge.garbageEvery) {
        garbageTimer = 0;
        addGarbageRow();
      }
    }
    if (!gameOver && challenge.surviveTime && elapsed >= challenge.surviveTime) winGame();
    else if (!gameOver && challenge.timeLimit && elapsed >= challenge.timeLimit) endGame('TIEMPO AGOTADO');
  }

  updateProgress();
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  challenge = CHALLENGES[modeSelect.value] || null;
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = challenge && challenge.startLevel ? challenge.startLevel : 1;
  level = baseLevel;
  paused = false;
  gameOver = false;
  abilityMenu = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  elapsed = 0;
  garbageTimer = 0;
  freezeLeft = slowLeft = lookLeft = 0;
  combo = 0;
  b2b = false;
  energy = 0;
  nextPowerAt = POWER_EVERY_LINES;
  undoState = null;
  popups = [];
  flash = null;
  hold = null;
  holdUsed = false;
  upcoming = [];
  revealUntil = performance.now() + 1200;
  if (challenge && challenge.prefill) prefillBoard(challenge.prefill);
  objectiveEl.textContent = challenge ? challenge.desc : 'Modo libre';
  lastTime = performance.now();
  spawn();
  updateHUD();
  updateProgress();
  drawHold();
  overlay.classList.add('hidden');
  abilityOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---------- Entrada ----------

document.addEventListener('keydown', e => {
  ensureAudio();

  if (abilityMenu) {
    if (e.code === 'Escape' || e.code === 'KeyE') { closeAbilityMenu(); return; }
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
    if (m) chooseAbility(ABILITY_ORDER[Number(m[1]) - 1]);
    return;
  }

  if (e.code === 'KeyM') {
    muted = !muted;
    if (current) { announce(muted ? 'SONIDO OFF' : 'SONIDO ON', '#b0bec5'); if (paused || gameOver) draw(); }
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      moveHorizontal(-1);
      break;
    case 'ArrowRight':
      moveHorizontal(1);
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
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      if (!e.repeat) doHold(false);
      break;
    case 'KeyE':
      if (!e.repeat) openAbilityMenu();
      break;
  }
  if (!gameOver) updateHUD();
});

restartBtn.addEventListener('click', init);

modeSelect.addEventListener('change', () => {
  modeSelect.blur();
  init();
});

abilityOverlay.querySelectorAll('[data-ability]').forEach(btn => {
  btn.addEventListener('click', () => chooseAbility(btn.dataset.ability));
});
document.getElementById('ability-cancel').addEventListener('click', closeAbilityMenu);

function applyTheme(t) {
  theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const isLight = theme === 'light';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.textContent = isLight ? '🌙 Modo oscuro' : '☀️ Modo claro';
  gridColor = isLight ? '#e3e6ee' : '#22222e';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* almacenamiento no disponible */ }
  // refrescar canvas aunque el juego esté en pausa o terminado
  if (current && board) draw();
  if (next) drawNext();
  if (current) drawHold();
}

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
  themeBtn.blur();
});

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignorar */ }
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
