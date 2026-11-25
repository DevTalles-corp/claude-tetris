'use strict';

// Tabla de records local (localStorage). API global: Records.
// game.js solo llama a Records.noteCombo, Records.onGameOver, Records.startGame e Records.isEditing.
const Records = (() => {
  const KEY = 'tetris-records';
  const MAX = 5;
  const NAME_MAX = 12;
  const DEFAULT_NAME = 'Jugador';

  const listEl = document.getElementById('records-list');
  const overlayListEl = document.getElementById('records-overlay-list');
  const statsEl = document.getElementById('records-stats');
  const entryEl = document.getElementById('records-entry');
  const inputEl = document.getElementById('records-name');
  const saveBtn = document.getElementById('records-save');
  const resetBtn = document.getElementById('records-reset');

  let data = load();
  let pending = null;     // { score, lines } esperando nombre
  let highlight = -1;     // posición resaltada en la tabla

  function empty() { return { top: [], bestCombo: 0, maxLines: 0 }; }

  function load() {
    const d = empty();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.top)) {
        d.top = raw.top
          .filter(e => e && Number.isFinite(e.score))
          .map(e => ({ name: String(e.name || DEFAULT_NAME).slice(0, NAME_MAX), score: e.score, lines: Number(e.lines) || 0 }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX);
        d.bestCombo = Number(raw.bestCombo) || 0;
        d.maxLines = Number(raw.maxLines) || 0;
      }
    } catch (e) { /* almacenamiento no disponible o JSON corrupto */ }
    return d;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* almacenamiento no disponible */ }
  }

  function qualifies(score) {
    return score > 0 && (data.top.length < MAX || score > data.top[data.top.length - 1].score);
  }

  // posición donde se insertaría (los empates van detrás)
  function position(score) {
    let i = 0;
    while (i < data.top.length && data.top[i].score >= score) i++;
    return i;
  }

  function renderList(ol, previewScore, hl) {
    ol.textContent = '';
    const rows = data.top.map(e => ({ ...e, preview: false }));
    if (previewScore !== null) rows.splice(position(previewScore), 0, { name: '(tú)', score: previewScore, preview: true });
    const shown = rows.slice(0, MAX);
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'records-empty';
      li.textContent = 'Sin records todavía';
      ol.appendChild(li);
      return;
    }
    shown.forEach((e, i) => {
      const li = document.createElement('li');
      if (e.preview || i === hl) li.className = 'records-new';
      const rank = document.createElement('span');
      rank.className = 'records-rank';
      rank.textContent = `${i + 1}.`;
      const name = document.createElement('span');
      name.className = 'records-name';
      name.textContent = e.name;
      const sc = document.createElement('span');
      sc.className = 'records-score';
      sc.textContent = e.score.toLocaleString();
      li.append(rank, name, sc);
      ol.appendChild(li);
    });
  }

  function render() {
    renderList(listEl, null, highlight);
    renderList(overlayListEl, pending ? pending.score : null, highlight);
    statsEl.textContent = `Mejor combo: ${data.bestCombo} · Máx. líneas: ${data.maxLines}`;
  }

  function sanitize(name) {
    return String(name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  }

  function commitPending() {
    if (!pending) return;
    const { score, lines } = pending;
    pending = null;
    const pos = position(score);
    data.top.splice(pos, 0, { name: sanitize(inputEl.value), score, lines });
    data.top = data.top.slice(0, MAX);
    highlight = pos;
    save();
    entryEl.classList.add('hidden');
    render();
  }

  function noteCombo(combo) {
    if (combo > data.bestCombo) { data.bestCombo = combo; save(); render(); }
  }

  // Llamar al terminar la partida. Devuelve true si la puntuación entra en el top.
  function onGameOver(score, lines) {
    if (lines > data.maxLines) { data.maxLines = lines; save(); }
    pending = qualifies(score) ? { score, lines } : null;
    highlight = -1;
    entryEl.classList.toggle('hidden', !pending);
    if (pending) inputEl.value = '';
    render();
    if (pending) setTimeout(() => { if (pending) inputEl.focus(); }, 600); // evita capturar teclas del juego aún pulsadas
    return !!pending;
  }

  // Nueva partida: guarda con nombre por defecto si quedó pendiente y limpia estado
  function startGame() {
    if (pending) commitPending();
    entryEl.classList.add('hidden');
    highlight = -1;
    render();
  }

  function isEditing(target) {
    return !!target && target.id === 'records-name';
  }

  saveBtn.addEventListener('click', () => { commitPending(); saveBtn.blur(); });
  inputEl.maxLength = NAME_MAX;
  inputEl.addEventListener('keydown', e => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); commitPending(); inputEl.blur(); }
  });
  resetBtn.addEventListener('click', () => {
    resetBtn.blur();
    if (!window.confirm('¿Borrar todos los records?')) return;
    data = empty();
    pending = null;
    highlight = -1;
    entryEl.classList.add('hidden');
    save();
    render();
  });

  render();
  return { noteCombo, onGameOver, startGame, isEditing };
})();
