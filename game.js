'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const RETRO_COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#cfd8dc', // 8 - power-up (pieza especial)
  '#f48fb1', // 9 - comodín (WILD)
  '#4db6ac', // 10 - + (pentomino)
  '#a1887f', // 11 - U (pentomino)
  '#7986cb', // 12 - Y (pentomino)
  '#fff176', // 13 - single 1x1
  '#ff8a65', // 14 - cuadro 3x3 hueco
  '#78909c', // 15 - basura / obstáculo (modo desafío)
];

const NEON_COLORS = [
  null,
  '#00f0ff', '#fff200', '#d500ff', '#39ff14', '#ff1744', '#2979ff', '#ff9100',
  '#e0f7fa', '#ff4fd8', '#1de9b6', '#c6a15b', '#7c4dff', '#ffff66', '#ff6e40', '#90a4ae',
];
const PASTEL_COLORS = [
  null,
  '#b5ead7', '#fff1b8', '#d9c2f0', '#c7f0bd', '#ffc8c8', '#bcd8f7', '#ffd8b1',
  '#e8eef2', '#ffd1e3', '#a8e0d8', '#e3cfc4', '#c5cbf2', '#fff7c2', '#ffcfbf', '#c9d3d9',
];
const PIXEL_COLORS = [
  null,
  '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ffa726',
  '#b0bec5', '#ec407a', '#26a69a', '#8d6e63', '#7e57c2', '#ffee58', '#ff7043', '#607d8b',
];

let COLORS = RETRO_COLORS;

const POWER_CELL = 8;
const WILD = 9;
const GARBAGE = 15;

// Desafíos: se activan al alcanzar `level` por primera vez (si hay otro activo, quedan en cola).
// goalLines = líneas a limpiar durante el desafío; surviveMs = tiempo a aguantar; timeLimit = tiempo máximo para goalLines;
// garbageEvery = sube una fila de basura cada N ms; prefill = filas de obstáculos al empezar;
// hideLocked = bloques fijados se ocultan; reverseRot = rotar al revés.
// Éxito: bono CHALLENGE_BONUS × nivel. Fallo: sin bono y el juego sigue.
const CHALLENGES = [
  { level: 2, name: 'Obstáculos', desc: 'Limpia 15 líneas con bloques precolocados', goalLines: 15, prefill: 6 },
  { level: 3, name: 'Basura',     desc: 'Sobrevive 90 s: sube basura cada 10 s',     surviveMs: 90000, garbageEvery: 10000 },
  { level: 5, name: 'Sprint',     desc: 'Limpia 40 líneas en 2:00',                  goalLines: 40, timeLimit: 120000 },
  { level: 6, name: 'Fantasma',   desc: 'Limpia 15 líneas: las piezas se ocultan',   goalLines: 15, hideLocked: true },
  { level: 8, name: 'Inversa',    desc: 'Limpia 20 líneas: rotación inversa',        goalLines: 20, reverseRot: true },
];
const CHALLENGE_BONUS = 1000;
const REVEAL_MS = 600; // tiempo que se ve el tablero tras fijar una pieza (desafío Fantasma)

// Power-ups: una pieza especial de 1 bloque cada POWER_EVERY líneas.
// ~0.4 líneas por pieza => una especial cada ~12 piezas (~8% de las piezas).
const POWER_EVERY = 5;
const FREEZE_MS = 5000;
const MAX_WILD_FILL = 2; // huecos que tolera una fila por comodines (máx.)
const POWERUPS = {
  bomb:      { icon: '💣', label: 'Bomba',    weight: 25 },
  lightning: { icon: '⚡', label: 'Rayo',     weight: 25 },
  tint:      { icon: '🎨', label: 'Tinte',    weight: 20 },
  gravity:   { icon: '🧲', label: 'Gravedad', weight: 15 },
  freeze:    { icon: '❄️', label: 'Congelar', weight: 15 },
};

// Habilidades cargables: la barra se llena al limpiar líneas; con la barra llena (tecla E) se elige una habilidad y la barra se vacía.
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 12;
const PEEK_COUNT = 5;      // piezas visibles con Visión (dura PEEK_COUNT piezas)
const SLOW_MS = 10000;
const SLOW_FACTOR = 3;     // la caída tarda ×3 durante Lentitud
const ABILITIES = [
  { id: 'peek', icon: '🔮', label: 'Visión',      desc: 'Ver las siguientes 5 piezas' },
  { id: 'swap', icon: '🔄', label: 'Intercambio', desc: 'Cambiar la pieza actual por otra' },
  { id: 'slow', icon: '⏳', label: 'Lentitud',    desc: 'Ralentizar la caída 10 s' },
  { id: 'undo', icon: '↩️', label: 'Deshacer',    desc: 'Deshacer la última colocación' },
];
const SWAP_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']; // tipo = índice + 1

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  null, null,                                  // 8-9 reservados (power-up, comodín)
  [[0,10,0],[10,10,10],[0,10,0]],             // + (pentomino)
  [[11,0,11],[11,11,11],[0,0,0]],             // U (pentomino)
  [[0,12,0,0],[12,12,12,12],[0,0,0,0],[0,0,0,0]], // Y (pentomino)
  [[13]],                                      // single 1x1
  [[14,14,14],[14,0,14],[14,14,14]],          // 3x3 hueco
];

// Piezas no estándar: ~12% de las piezas son pentomino/hueca (peso relativo abajo).
// El single 1x1 no es aleatorio: es la recompensa tras un Tetris (4 líneas a la vez).
const RARE_CHANCE = 0.12;
const RARE_WEIGHTS = { 10: 3, 11: 3, 12: 3, 14: 2 }; // +, U, Y, hueca (más difícil, menos frecuente)
const SINGLE = 13;

const LINE_SCORES = [0, 100, 300, 500, 800];

// Combo y multiplicadores
const TSPIN_SCORES = [400, 800, 1200, 1600]; // T-spin con 0..3 líneas
const LINE_NAMES = ['', 'SENCILLO', 'DOBLE', 'TRIPLE', 'TETRIS'];
const MAX_COMBO_MULT = 10;   // tope del multiplicador (x2, x3, ... x10)
const B2B_FACTOR = 1.5;      // Tetris/T-spin seguidos (sin clears "fáciles" entre medio)
const PERFECT_BONUS = 2000;  // × nivel
const SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // escala pentatónica por combo

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
const recordsBox = document.getElementById('records-box');
const startOverlay = document.getElementById('start-overlay');
const startRecords = document.getElementById('start-records');
const startBtn = document.getElementById('start-btn');
const resetRecordsBtns = [document.getElementById('reset-records-btn'), document.getElementById('start-reset-btn')];
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const powerEl = document.getElementById('power-status');
const comboEl = document.getElementById('combo-status');
const goalSection = document.getElementById('goal-section');
const goalDescEl = document.getElementById('goal-desc');
const goalEl = document.getElementById('goal-status');
const timerEl = document.getElementById('timer-status');
const energyBar = document.getElementById('energy-bar');
const energyFill = document.getElementById('energy-fill');
const energyHint = document.getElementById('energy-hint');
const abilityEl = document.getElementById('ability-status');
const peekSection = document.getElementById('peek-section');
const peekCanvas = document.getElementById('peek-canvas');
const peekCtx = peekCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const pauseMenu = document.getElementById('pause-menu');
const pauseItems = [...pauseMenu.querySelectorAll('.pause-item')];
const pauseControls = document.getElementById('pause-controls');
const startLevelEl = document.getElementById('start-level');
const abilityMenu = document.getElementById('ability-menu');
const abilityTitle = document.getElementById('ability-title');
const abilityList = document.getElementById('ability-list');
const abilityHint = document.getElementById('ability-hint');

let gridColor = '#22222e';
const MAX_START_LEVEL = 10;
let startLevel = 1;    // nivel con el que empieza la próxima partida (se elige en el menú de pausa)
let pauseSel = 0;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let pendingPower, pendingSingle, lastPowerLines, freezeLeft, powerMsgTimer;
let maxComboRun, pendingRecord, atStart; // maxComboRun = mejor combo de la partida; pendingRecord = puesto por nombrar; atStart = pantalla de inicio
let combo, b2b, lastMoveRotate; // combo = clears consecutivos; b2b = último clear fue difícil
let popups, particles, flashRows, shakeLeft, shakePower, perfectFlash;
let challengeIdx = null, challenge = null; // desafío activo (null = juego normal)
let elapsed, garbageAccum, revealLeft, challengeStartLines, startedChallenges, challengeQueue;
let queue, held, holdUsed, energy, peekLeft, slowLeft, undoSnap, menuOpen, menuMode; // next === queue[0]

// ---- Audio (WebAudio, sin archivos) ----
let audioCtx = null;
let muted = false;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, delay, dur, type = 'square', vol = 0.06, slideTo) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const noteFreq = i => 523.25 * Math.pow(2, SEMITONES[Math.min(i, SEMITONES.length - 1)] / 12);

function playClearSound(cleared, mult, tspin, b2bHit, perfect) {
  const f = noteFreq(mult - 1);
  tone(f, 0, 0.14);
  tone(f * 1.5, 0.07, 0.18);
  if (cleared >= 4) tone(f * 2, 0.14, 0.25, 'triangle', 0.08);
  if (tspin) tone(300, 0, 0.3, 'sawtooth', 0.05, 1200);
  if (b2bHit) tone(f * 2, 0.2, 0.2, 'sine', 0.08);
  if (perfect) [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
    tone(523.25 * Math.pow(2, s / 12), 0.25 + i * 0.07, 0.25, 'triangle', 0.08));
}

// ---- Efectos visuales ----
function addPopup(text, color, size = 18) {
  popups.push({ text, color, size, age: 0, life: 1400, y: 190 + popups.length * 30 });
}

function burst(row, count, mult) {
  const hues = ['#ffd54f', '#ff8a65', '#f48fb1', '#4dd0e1', '#81c784'];
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 160 + mult * 12;
    particles.push({
      x: Math.random() * COLS * BLOCK, y: row * BLOCK + BLOCK / 2,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60,
      age: 0, life: 500 + Math.random() * 400,
      color: hues[Math.floor(Math.random() * hues.length)],
    });
  }
}

function updateComboHUD() {
  const mult = Math.min(combo, MAX_COMBO_MULT);
  const parts = [];
  if (combo >= 2) parts.push(`x${mult}`);
  if (b2b) parts.push('B2B');
  comboEl.textContent = parts.join(' ') || '—';
  comboEl.classList.toggle('hot', combo >= 2);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPowerType() {
  const names = Object.keys(POWERUPS);
  let roll = Math.random() * names.reduce((sum, n) => sum + POWERUPS[n].weight, 0);
  for (const n of names) {
    roll -= POWERUPS[n].weight;
    if (roll < 0) return n;
  }
  return names[0];
}

function powerPiece() {
  return { type: POWER_CELL, power: randomPowerType(), shape: [[POWER_CELL]], x: Math.floor(COLS / 2), y: 0 };
}

function iconOf(piece) {
  return piece.power ? POWERUPS[piece.power].icon : null;
}

function randomPiece() {
  if (pendingPower) {
    pendingPower = false;
    return powerPiece();
  }
  if (pendingSingle) {
    pendingSingle = false;
    return makePiece(SINGLE);
  }
  if (Math.random() < RARE_CHANCE) return makePiece(randomRareType());
  return makePiece(Math.floor(Math.random() * 7) + 1);
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

// Copia limpia de una pieza (sin rotación ni posición), power-ups incluidos.
function resetPiece(p) {
  return p.power ? { type: p.type, power: p.power, shape: [[POWER_CELL]], x: Math.floor(COLS / 2), y: 0 } : makePiece(p.type);
}

// Cola de piezas: queue[0] es NEXT. Una pieza pendiente (power-up / single) entra al frente.
function refillQueue() {
  if (pendingPower || pendingSingle) queue.unshift(randomPiece());
  const want = peekLeft > 0 ? PEEK_COUNT : 1;
  while (queue.length < want) queue.push(randomPiece());
  next = queue[0];
}

function randomRareType() {
  const types = Object.keys(RARE_WEIGHTS);
  let roll = Math.random() * types.reduce((sum, t) => sum + RARE_WEIGHTS[t], 0);
  for (const t of types) {
    roll -= RARE_WEIGHTS[t];
    if (roll < 0) return Number(t);
  }
  return Number(types[0]);
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

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function tryRotate() {
  const rotated = (challenge?.reverseRot ? rotateCCW : rotateCW)(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
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

// Fila completa: sin huecos, o con huecos cubiertos por comodines (máx. MAX_WILD_FILL).
function isRowComplete(row) {
  let empty = 0, wild = 0;
  for (const v of row) {
    if (!v) empty++;
    else if (v === WILD) wild++;
  }
  return empty <= Math.min(wild, MAX_WILD_FILL);
}

// T-spin (regla de 3 esquinas): la última acción fue rotar una T y ≥3 esquinas del centro están ocupadas.
function isTSpin() {
  if (current.type !== 3 || !lastMoveRotate) return false;
  const cx = current.x + 1, cy = current.y + 1;
  let filled = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function clearLines(tspin) {
  let cleared = 0;
  const clearedRows = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (isRowComplete(board[r])) {
      clearedRows.push(r - cleared); // fila original
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (!cleared) {
    combo = 0; // se rompe la cadena
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      addPopup('T-SPIN', '#ba68c8', 22);
      addPopup(`+${TSPIN_SCORES[0] * level}`, '#ffd54f');
      playClearSound(0, 1, true, false, false);
      updateHUD();
    }
    updateComboHUD();
    return;
  }
  if (cleared) {
    lines += cleared;

    // Puntuación: base (líneas o T-spin) × B2B × combo, + perfect clear
    const difficult = cleared === 4 || tspin;
    const b2bHit = difficult && b2b;
    b2b = difficult ? true : false;
    combo++;
    if (combo > maxComboRun) maxComboRun = combo;
    const mult = Math.min(combo, MAX_COMBO_MULT);
    let base = tspin ? TSPIN_SCORES[Math.min(cleared, 3)] : (LINE_SCORES[cleared] || 0);
    if (b2bHit) base *= B2B_FACTOR;
    let gained = Math.round(base * level * mult);
    const perfect = board.every(row => row.every(v => !v));
    if (perfect) gained += PERFECT_BONUS * level;
    score += gained;

    // Feedback
    addPopup((tspin ? 'T-SPIN ' : '') + LINE_NAMES[cleared], tspin ? '#ba68c8' : '#4dd0e1', 22);
    if (combo >= 2) addPopup(`COMBO x${mult}`, '#ff8a65', 20);
    if (b2bHit) addPopup(`B2B x${B2B_FACTOR}`, '#f48fb1');
    if (perfect) addPopup('PERFECT CLEAR!', '#ffd54f', 24);
    addPopup(`+${gained.toLocaleString()}`, '#ffd54f');
    clearedRows.forEach(r => burst(r, 14 + mult * 3, mult));
    flashRows = clearedRows.map(r => ({ r, age: 0 }));
    shakeLeft = 150 + (cleared >= 4 || tspin ? 150 : 0) + (perfect ? 200 : 0);
    shakePower = 2 + Math.min(combo, 6) + (cleared >= 4 ? 2 : 0);
    if (perfect) perfectFlash = 600;
    playClearSound(cleared, mult, tspin, b2bHit, perfect);
    updateComboHUD();

    updateSpeed();
    gainEnergy(cleared);
    queueChallenges();
    if (cleared === 4) pendingSingle = true;
    if (lines - lastPowerLines >= POWER_EVERY) {
      pendingPower = true;
      lastPowerLines = lines;
    }
    updateHUD();
  }
}

function updateSpeed() {
  level = Math.floor(lines / 10) + startLevel;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Sube una fila por abajo. Si empuja bloques fuera del tablero: derrota.
function pushRow(row) {
  if (board[0].some(v => v)) { endGame(); return; }
  board.shift();
  board.push(row);
  while (collide(current.shape, current.x, current.y) && current.y > -4) current.y--;
  if (collide(current.shape, current.x, current.y)) endGame();
}

function addGarbage() {
  const hole = Math.floor(Math.random() * COLS);
  pushRow(Array.from({ length: COLS }, (_, c) => c === hole ? 0 : GARBAGE));
}

function addObstacleRow() {
  const row = Array.from({ length: COLS }, () => Math.random() < 0.45 ? GARBAGE : 0);
  row[Math.floor(Math.random() * COLS)] = 0; // nunca una fila ya completa
  pushRow(row);
}

// Encola los desafíos cuyo nivel ya se alcanzó. Se inician en spawn() (no hay pieza en juego al fijar).
function queueChallenges() {
  CHALLENGES.forEach((c, i) => {
    if (level >= c.level && !startedChallenges.has(i)) {
      startedChallenges.add(i);
      challengeQueue.push(i);
    }
  });
}

function startChallenge(idx) {
  challengeIdx = idx;
  challenge = CHALLENGES[idx];
  elapsed = 0;
  garbageAccum = 0;
  revealLeft = 0;
  challengeStartLines = lines;
  addPopup(`DESAFÍO: ${challenge.name.toUpperCase()}`, '#ff8a65', 22);
  addPopup(challenge.desc, '#e0e0e0', 13);
  for (let i = 0; i < (challenge.prefill || 0); i++) addObstacleRow();
  updateGoalHUD();
}

function endChallenge(success) {
  if (success) {
    const bonus = CHALLENGE_BONUS * level;
    score += bonus;
    addPopup('¡DESAFÍO SUPERADO!', '#81c784', 22);
    addPopup(`+${bonus.toLocaleString()}`, '#ffd54f');
    [0, 4, 7, 12].forEach((s, i) => tone(523.25 * Math.pow(2, s / 12), i * 0.08, 0.2, 'triangle', 0.08));
  } else {
    addPopup('DESAFÍO FALLIDO', '#e57373', 22);
    tone(220, 0, 0.4, 'sawtooth', 0.05, 110);
  }
  challenge = null;
  updateHUD();
  updateGoalHUD();
}

function updateGoalHUD() {
  goalSection.classList.toggle('hidden', !challenge);
  if (!challenge) return;
  const tags = [];
  if (challenge.reverseRot) tags.push('rotación inversa');
  if (challenge.hideLocked) tags.push('piezas ocultas');
  goalDescEl.textContent = `${challengeIdx + 1} · ${challenge.name}${tags.length ? ' (' + tags.join(', ') + ')' : ''}`;
  const parts = [];
  if (challenge.goalLines) parts.push(`${Math.min(lines - challengeStartLines, challenge.goalLines)}/${challenge.goalLines} líneas`);
  const total = challenge.timeLimit || challenge.surviveMs;
  if (total) parts.push(`⏱ ${fmtTime(total - elapsed)}`);
  if (challenge.garbageEvery) parts.push(`🗑 ${Math.ceil((challenge.garbageEvery - garbageAccum) / 1000)}s`);
  goalEl.textContent = parts.shift() || '—';
  timerEl.textContent = parts.join('  ');
}

function setPowerMsg(text, ms) {
  clearTimeout(powerMsgTimer);
  powerEl.textContent = text || '—';
  if (text && ms) powerMsgTimer = setTimeout(() => { if (freezeLeft <= 0) powerEl.textContent = '—'; }, ms);
}

function applyPower(piece) {
  const { x, y, power } = piece;
  const cy = Math.min(y + 1, ROWS - 1); // fila del bloque sobre el que aterrizó
  let destroyed = 0;
  const clearCell = (r, c) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return;
    board[r][c] = 0;
    destroyed++;
  };

  switch (power) {
    case 'bomb':
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          clearCell(cy + dr, x + dc);
      break;
    case 'lightning':
      if (Math.random() < 0.5) for (let c = 0; c < COLS; c++) clearCell(cy, c);
      else for (let r = 0; r < ROWS; r++) clearCell(r, x);
      break;
    case 'tint': {
      const counts = new Array(8).fill(0);
      for (const row of board) for (const v of row) if (v >= 1 && v <= 7) counts[v]++;
      const top = counts.indexOf(Math.max(...counts));
      if (counts[top] > 0)
        for (const row of board)
          for (let c = 0; c < COLS; c++) if (row[c] === top) row[c] = WILD;
      break;
    }
    case 'gravity':
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = ROWS - 1; r >= 0; r--) if (board[r][c]) col.push(board[r][c]);
        for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) board[r][c] = col[i] || 0;
      }
      break;
    case 'freeze':
      freezeLeft = FREEZE_MS;
      break;
  }

  score += destroyed * 10;
  setPowerMsg(`${POWERUPS[power].icon} ${POWERUPS[power].label}`, 2500);
  updateHUD();
}

// ---- Habilidades ----
function updateEnergyHUD() {
  const ready = energy >= ENERGY_MAX;
  energyFill.style.width = `${energy}%`;
  energyBar.classList.toggle('ready', ready);
  energyHint.textContent = ready ? '¡LISTA! pulsa E' : `${Math.floor(energy)}%`;
}

function updateAbilityHUD() {
  abilityEl.textContent = slowLeft > 0 ? `⏳ ${(slowLeft / 1000).toFixed(1)}s` : '—';
}

function gainEnergy(cleared) {
  const wasReady = energy >= ENERGY_MAX;
  energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
  if (!wasReady && energy >= ENERGY_MAX) {
    addPopup('ENERGÍA LISTA [E]', '#ffd54f', 18);
    [0, 7].forEach((s, i) => tone(523.25 * Math.pow(2, s / 12), i * 0.08, 0.15, 'sine', 0.07));
  }
  updateEnergyHUD();
}

// Estado previo al fijar una pieza, para Deshacer. No se restaura el reloj del desafío (elapsed/garbageAccum).
function saveUndo() {
  undoSnap = {
    board: board.map(r => [...r]), piece: resetPiece(current), queue: queue.map(resetPiece),
    holdUsed, score, lines, combo, b2b, pendingPower, pendingSingle, lastPowerLines, freezeLeft, peekLeft,
    challenge, challengeIdx, challengeStartLines,
    started: new Set(startedChallenges), cq: [...challengeQueue],
  };
}

function undoPlacement() {
  if (!undoSnap) return false;
  const s = undoSnap;
  undoSnap = null;
  board = s.board;
  current = s.piece;
  queue = s.queue;
  next = queue[0];
  ({ holdUsed, score, lines, combo, b2b, pendingPower, pendingSingle, lastPowerLines, freezeLeft, peekLeft } = s);
  ({ challenge, challengeIdx, challengeStartLines } = s);
  startedChallenges = s.started;
  challengeQueue = s.cq;
  updateSpeed();
  lastMoveRotate = false;
  dropAccum = 0;
  revealLeft = 0;
  flashRows = [];
  updateHUD();
  updateComboHUD();
  updateGoalHUD();
  drawNext();
  drawPeek();
  drawHold();
  return true;
}

// Reserva (C / Shift): una vez por pieza; se desbloquea en spawn() al fijarse la pieza.
function holdPiece() {
  if (holdUsed) return false;
  if (!held) {
    held = resetPiece(current);
    spawn();
  } else {
    const swapped = resetPiece(held);
    if (collide(swapped.shape, swapped.x, swapped.y)) return false;
    held = resetPiece(current);
    current = swapped;
  }
  holdUsed = true;
  lastMoveRotate = false;
  dropAccum = 0;
  drawHold();
  return true;
}

function swapPiece(type) {
  const piece = makePiece(type);
  const x = Math.min(current.x, COLS - piece.shape[0].length);
  for (const [px, py] of [[x, current.y], [piece.x, 0]]) {
    if (collide(piece.shape, px, py)) continue;
    piece.x = px;
    piece.y = py;
    current = piece;
    lastMoveRotate = false;
    return true;
  }
  return false;
}

function runAbility(id) {
  switch (id) {
    case 'peek':
      peekLeft = PEEK_COUNT;
      refillQueue();
      drawPeek();
      return true;
    case 'slow':
      slowLeft = SLOW_MS;
      updateAbilityHUD();
      return true;
    case 'undo': return undoPlacement();
  }
  return false;
}

function openMenu() {
  if (menuOpen || paused || gameOver || energy < ENERGY_MAX) return;
  menuOpen = true;
  menuMode = 'main';
  cancelAnimationFrame(animId);
  renderMenu();
  abilityMenu.classList.remove('hidden');
}

function closeMenu() {
  menuOpen = false;
  abilityMenu.classList.add('hidden');
  if (gameOver) return;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function menuButton(key, icon, label, desc, onPick, disabled) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ability-btn';
  btn.disabled = !!disabled;
  const kbd = document.createElement('kbd');
  kbd.textContent = key;
  const text = document.createElement('span');
  text.textContent = `${icon} ${label}`;
  if (desc) {
    const small = document.createElement('small');
    small.textContent = desc;
    text.appendChild(small);
  }
  btn.append(kbd, text);
  btn.addEventListener('click', () => { btn.blur(); onPick(); });
  li.appendChild(btn);
  return li;
}

function renderMenu(msg = '') {
  abilityList.replaceChildren();
  if (menuMode === 'swap') {
    abilityTitle.textContent = 'ELIGE PIEZA';
    SWAP_NAMES.forEach((name, i) => {
      const li = menuButton(i + 1, '■', name, '', () => pickMenu(i));
      li.querySelector('span').style.color = COLORS[i + 1];
      abilityList.appendChild(li);
    });
    abilityHint.textContent = msg || '1–7 elegir · Esc volver';
  } else {
    abilityTitle.textContent = 'HABILIDAD';
    ABILITIES.forEach((a, i) =>
      abilityList.appendChild(menuButton(i + 1, a.icon, a.label, a.desc, () => pickMenu(i), a.id === 'undo' && !undoSnap)));
    abilityHint.textContent = msg || `1–${ABILITIES.length} elegir · Esc cancelar`;
  }
}

function pickMenu(i) {
  if (menuMode === 'swap') {
    if (!swapPiece(i + 1)) { renderMenu('No cabe esa pieza aquí'); return; }
    finishAbility({ icon: '🔄', label: 'Intercambio' });
    return;
  }
  const a = ABILITIES[i];
  if (!a) return;
  if (a.id === 'swap') { menuMode = 'swap'; renderMenu(); return; }
  if (!runAbility(a.id)) { renderMenu('No disponible'); return; }
  finishAbility(a);
}

function finishAbility(a) {
  energy = 0;
  updateEnergyHUD();
  addPopup(`${a.icon} ${a.label.toUpperCase()}`, '#7aa2f7', 20);
  tone(392, 0, 0.12, 'triangle', 0.07);
  tone(784, 0.08, 0.2, 'triangle', 0.07);
  closeMenu();
  drawNext();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastMoveRotate = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  let tspin = false;
  saveUndo();
  if (current.power) applyPower(current);
  else {
    tspin = isTSpin(); // antes de fusionar con el tablero
    merge();
    if (challenge?.hideLocked) revealLeft = REVEAL_MS;
  }
  clearLines(tspin);
  lastMoveRotate = false;
  updateGoalHUD();
  if (challenge?.goalLines && lines - challengeStartLines >= challenge.goalLines) endChallenge(true);
  spawn();
}

function spawn() {
  holdUsed = false;
  current = queue.shift();
  if (peekLeft > 0) peekLeft--;
  refillQueue();
  if (!challenge && challengeQueue.length) startChallenge(challengeQueue.shift());
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawPeek();
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// Skins: cada una define paleta y cómo se pinta un bloque (x,y en px, tamaño s, color c).
const SKINS = {
  retro: {
    colors: RETRO_COLORS,
    draw(ctx, x, y, s, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 1, y + 1, s - 2, 4);
    },
  },
  neon: {
    colors: NEON_COLORS,
    draw(ctx, x, y, s, c) {
      ctx.save();
      ctx.shadowColor = c;
      ctx.shadowBlur = s * 0.45;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = c;
      ctx.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4);
      ctx.restore();
    },
  },
  pastel: {
    colors: PASTEL_COLORS,
    draw(ctx, x, y, s, c) {
      const r = s * 0.28;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 1.5, s - 3, s - 3, r);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, s - 8, (s - 8) * 0.35, r * 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
    },
  },
  pixel: {
    colors: PIXEL_COLORS,
    draw(ctx, x, y, s, c) {
      const p = Math.max(2, Math.round(s / 6)); // "píxel" del sprite
      ctx.fillStyle = c;
      ctx.fillRect(x, y, s, s);
      // luz arriba/izquierda, sombra abajo/derecha
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y + s - p, s, p);
      ctx.fillRect(x + s - p, y, p, s);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x, y, s - p, p);
      ctx.fillRect(x, y, p, s - p);
      // textura de damero interior
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let i = 1; i < 5; i++)
        for (let j = 1; j < 5; j++)
          if ((i + j) % 2 === 0) ctx.fillRect(x + i * p, y + j * p, p, p);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + p * 2, y + p * 2, p, p);
    },
  },
};
const SKIN_KEY = 'tetris-skin';
let skin = SKINS.retro;

function drawBlock(context, x, y, colorIndex, size, alpha, icon) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, color);
  const glyph = icon || (colorIndex === WILD ? '★' : null);
  if (glyph) {
    context.font = `${Math.round(size * 0.6)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = skin === SKINS.neon ? '#fff' : '#222';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
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

function drawEffects(dt) {
  // flash de filas limpiadas
  flashRows = flashRows.filter(f => (f.age += dt) < 200);
  for (const f of flashRows) {
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - f.age / 200)})`;
    ctx.fillRect(0, f.r * BLOCK, COLS * BLOCK, BLOCK);
  }

  // partículas
  particles = particles.filter(p => (p.age += dt) < p.life);
  for (const p of particles) {
    const s = dt / 1000;
    p.vy += 500 * s;
    p.x += p.vx * s;
    p.y += p.vy * s;
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // flash de perfect clear
  if (perfectFlash > 0) {
    perfectFlash -= dt;
    ctx.fillStyle = `rgba(255,213,79,${0.5 * Math.max(0, perfectFlash) / 600})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // textos flotantes
  popups = popups.filter(p => (p.age += dt) < p.life);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of popups) {
    const t = p.age / p.life;
    const pop = t < 0.1 ? 0.6 + 4 * t : 1; // pequeño "rebote" al aparecer
    ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    ctx.font = `800 ${Math.round(p.size * pop)}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(p.text, canvas.width / 2, p.y - t * 30);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, canvas.width / 2, p.y - t * 30);
  }
  ctx.globalAlpha = 1;
}

function draw(dt = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shakeLeft > 0) {
    shakeLeft -= dt;
    const k = Math.max(0, shakeLeft) / 300;
    ctx.translate((Math.random() - 0.5) * shakePower * 2 * Math.min(1, k + 0.3),
                  (Math.random() - 0.5) * shakePower * 2 * Math.min(1, k + 0.3));
  }
  drawGrid();

  // board
  const hideBoard = challenge?.hideLocked && revealLeft <= 0;
  revealLeft -= dt;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK, hideBoard ? 0.05 : 1);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2, iconOf(current));

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, iconOf(current));

  drawEffects(dt);
  ctx.restore();
}

// Dibuja la pieza centrada (por la caja que ocupan los bloques) en la región x0,y0,w,h de un canvas.
function drawPieceCentered(context, piece, x0, y0, w, h, size) {
  const shape = piece.shape;
  let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
  context.save();
  context.translate(
    x0 + (w - (maxC - minC + 1) * size) / 2,
    y0 + (h - (maxR - minR + 1) * size) / 2
  );
  for (let r = minR; r <= maxR; r++)
    for (let c = minC; c <= maxC; c++)
      drawBlock(context, c - minC, r - minR, shape[r][c], size, 1, iconOf(piece));
  context.restore();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawPieceCentered(nextCtx, next, 0, 0, nextCanvas.width, nextCanvas.height, 30);
}

function drawPeek() {
  peekSection.classList.toggle('hidden', peekLeft <= 0);
  if (peekLeft <= 0) return;
  peekCtx.clearRect(0, 0, peekCanvas.width, peekCanvas.height);
  const slot = peekCanvas.width / PEEK_COUNT;
  queue.slice(0, PEEK_COUNT).forEach((p, i) =>
    drawPieceCentered(peekCtx, p, i * slot, 0, slot, peekCanvas.height, 7));
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (held) drawPieceCentered(holdCtx, held, 0, 0, holdCanvas.width, holdCanvas.height, 20);
  holdCanvas.classList.toggle('locked', !!holdUsed);
}

// ---- Records (localStorage) ----
const RECORDS_KEY = 'tetris-records';
const TOP_SIZE = 5;
const NAME_MAX = 12;

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const r = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (r && Array.isArray(r.top)) return { ...emptyRecords(), ...r, top: r.top.slice(0, TOP_SIZE) };
  } catch (e) { /* storage no disponible o dato corrupto */ }
  return emptyRecords();
}

function saveRecords(r) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch (e) { /* ignorar */ }
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra.
function recordRank(records, s) {
  if (s <= 0) return -1;
  const i = records.top.findIndex(e => s > e.score);
  if (i >= 0) return i;
  return records.top.length < TOP_SIZE ? records.top.length : -1;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderRecords(el, records, highlight = -1) {
  const rows = records.top.map((e, i) =>
    `<li class="${i === highlight ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(e.name)}</span><span>${Number(e.score).toLocaleString()}</span></li>`).join('');
  el.innerHTML = `<h3>TOP ${TOP_SIZE}</h3><ol>${rows || '<li><span>Sin records aún</span></li>'}</ol>` +
    `<div class="stats">Mejor combo: x${records.bestCombo} · Máx. líneas: ${records.maxLines}</div>`;
}

// Guarda el puesto pendiente con el nombre del input y refresca la tabla.
function commitRecord() {
  if (!pendingRecord) return;
  const { score: s } = pendingRecord;
  pendingRecord = null;
  nameForm.classList.add('hidden');
  const records = loadRecords();
  const rank = recordRank(records, s);
  if (rank < 0) return;
  const name = nameInput.value.trim().slice(0, NAME_MAX) || 'Jugador';
  records.top.splice(rank, 0, { name, score: s });
  records.top.length = Math.min(records.top.length, TOP_SIZE);
  saveRecords(records);
  renderRecords(recordsBox, records, rank);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  pendingRecord = null;
  nameForm.classList.add('hidden');
  const empty = emptyRecords();
  saveRecords(empty);
  renderRecords(recordsBox, empty);
  renderRecords(startRecords, empty);
}

function showStart() {
  atStart = true;
  cancelAnimationFrame(animId);
  renderRecords(startRecords, loadRecords());
  startOverlay.classList.remove('hidden');
}

function startGame() {
  atStart = false;
  startOverlay.classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  const records = loadRecords();
  records.bestCombo = Math.max(records.bestCombo, maxComboRun);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords(records);
  const rank = recordRank(records, score);
  pendingRecord = rank >= 0 ? { score } : null;
  nameForm.classList.toggle('hidden', rank < 0);
  renderRecords(recordsBox, records);
  overlay.classList.remove('hidden');
  if (rank >= 0) { nameInput.value = ''; nameInput.focus(); }
  draw(0);
}

function togglePause() {
  if (gameOver || atStart) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseControls.classList.add('hidden');
    setPauseSel(0);
    renderStartLevel();
    pauseMenu.classList.remove('hidden');
  }
}

function setPauseSel(i) {
  pauseSel = (i + pauseItems.length) % pauseItems.length;
  pauseItems.forEach((b, j) => b.classList.toggle('selected', j === pauseSel));
}

function renderStartLevel() {
  startLevelEl.textContent = startLevel;
}

function changeStartLevel(d) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, startLevel + d));
  renderStartLevel();
}

function pauseAction(action) {
  if (action === 'resume') togglePause();
  else if (action === 'restart') init();
  else if (action === 'controls') pauseControls.classList.toggle('hidden');
  else if (action === 'level') changeStartLevel(1);
}

pauseItems.forEach((btn, i) => {
  btn.addEventListener('click', e => {
    const d = e.target.dataset.level;
    setPauseSel(i);
    if (d) changeStartLevel(+d);
    else pauseAction(btn.dataset.action);
    btn.blur();
  });
});

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
    setPowerMsg(freezeLeft > 0 ? `❄️ ${(freezeLeft / 1000).toFixed(1)}s` : '');
  } else {
    dropAccum += dt;
  }
  if (slowLeft > 0) {
    slowLeft = Math.max(0, slowLeft - dt);
    updateAbilityHUD();
  }
  if (challenge) {
    const cdt = Math.min(dt, 100); // pestaña en segundo plano no gasta el reloj del desafío
    elapsed += cdt;
    if (challenge.garbageEvery) {
      garbageAccum += cdt;
      if (garbageAccum >= challenge.garbageEvery) {
        garbageAccum -= challenge.garbageEvery;
        addGarbage();
      }
    }
    if (!gameOver) {
      if (challenge.surviveMs && elapsed >= challenge.surviveMs) endChallenge(true);
      else if (challenge.timeLimit && elapsed >= challenge.timeLimit) endChallenge(false);
    }
    if (challenge) updateGoalHUD();
  }
  if (gameOver) return; // endGame ya dibujó el estado final
  if (dropAccum >= dropInterval * (slowLeft > 0 ? SLOW_FACTOR : 1)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  draw(Math.min(dt, 50));
  if (gameOver) return; // endGame ocurrió dentro de este frame: no re-agendar el loop
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  paused = false;
  gameOver = false;
  updateSpeed();
  dropAccum = 0;
  elapsed = 0;
  garbageAccum = 0;
  revealLeft = 0;
  challenge = null;
  challengeIdx = null;
  challengeStartLines = 0;
  startedChallenges = new Set(CHALLENGES.flatMap((c, i) => c.level < startLevel ? [i] : [])); // los previos al nivel inicial no se juegan
  challengeQueue = [];
  pendingPower = false;
  pendingSingle = false;
  lastPowerLines = 0;
  freezeLeft = 0;
  combo = 0;
  maxComboRun = 0;
  pendingRecord = null;
  b2b = false;
  lastMoveRotate = false;
  popups = [];
  particles = [];
  flashRows = [];
  shakeLeft = 0;
  shakePower = 0;
  perfectFlash = 0;
  held = null;
  holdUsed = false;
  energy = 0;
  peekLeft = 0;
  slowLeft = 0;
  undoSnap = null;
  menuOpen = false;
  menuMode = 'main';
  queue = [];
  updateComboHUD();
  updateEnergyHUD();
  updateAbilityHUD();
  drawHold();
  setPowerMsg('');
  lastTime = performance.now();
  refillQueue();
  spawn();
  updateHUD();
  updateGoalHUD();
  overlay.classList.add('hidden');
  nameForm.classList.add('hidden');
  abilityMenu.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

document.addEventListener('keydown', e => {
  if (e.target === nameInput) return; // escribir el nombre no dispara controles
  if (atStart) { if (e.code === 'Enter') startGame(); return; }
  ensureAudio(); // el navegador exige un gesto del usuario
  if (GAME_KEYS.has(e.code)) e.preventDefault(); // evita el scroll de la página
  if (e.code === 'KeyM') { muted = !muted; return; }
  if (menuOpen) {
    const n = parseInt(e.key, 10);
    if (e.code === 'Escape' || e.code === 'KeyE') {
      if (menuMode === 'swap') { menuMode = 'main'; renderMenu(); } else closeMenu();
    } else if (n >= 1 && n <= (menuMode === 'swap' ? SWAP_NAMES.length : ABILITIES.length)) {
      const btn = abilityList.children[n - 1].firstChild;
      if (!btn.disabled) pickMenu(n - 1);
    }
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused) { // menú de pausa: ninguna tecla llega al juego
    e.preventDefault();
    if (e.code === 'Escape') togglePause();
    else if (e.code === 'ArrowUp') setPauseSel(pauseSel - 1);
    else if (e.code === 'ArrowDown') setPauseSel(pauseSel + 1);
    else if (e.code === 'ArrowLeft') changeStartLevel(-1);
    else if (e.code === 'ArrowRight') changeStartLevel(1);
    else if (e.code === 'Enter' || e.code === 'Space') pauseAction(pauseItems[pauseSel].dataset.action);
    return;
  }
  if (e.code === 'Escape' && !gameOver) { togglePause(); return; }
  if (gameOver) return;
  switch (e.code) {
    case 'KeyE':
      openMenu();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { commitRecord(); init(); });
nameForm.addEventListener('submit', e => { e.preventDefault(); commitRecord(); restartBtn.focus(); });
startBtn.addEventListener('click', () => { startBtn.blur(); startGame(); });
resetRecordsBtns.forEach(b => b.addEventListener('click', () => { resetRecords(); b.blur(); }));

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space (caída) vuelva a activar el botón
});

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  skin = SKINS[name];
  COLORS = skin.colors;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  try { localStorage.setItem(SKIN_KEY, name); } catch (e) { /* sin almacenamiento */ }
  applyTheme(document.documentElement.dataset.theme || 'dark'); // relee --grid del skin
  if (queue) { drawNext(); drawPeek(); drawHold(); } // el tablero se redibuja en el siguiente frame
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que flechas/Space cambien el select mientras se juega
});

applyTheme('dark');
let savedSkin = 'retro';
try { savedSkin = localStorage.getItem(SKIN_KEY) || 'retro'; } catch (e) { /* ignorar */ }
applySkin(savedSkin);

init();
showStart();
