// Título pixel art: cada letra es una cuadrícula 5x5 con el color de una pieza.
(function () {
  const GLYPHS = {
    T: ['11111', '00100', '00100', '00100', '00100'],
    E: ['11111', '10000', '11110', '10000', '11111'],
    R: ['11110', '10001', '11110', '10100', '10010'],
    I: ['11111', '00100', '00100', '00100', '11111'],
    S: ['01111', '10000', '01110', '00001', '11110'],
  };
  const COLORS = ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#ffb74d'];
  const WORD = 'TETRIS';
  const NS = 'http://www.w3.org/2000/svg';
  const PX = 4;   // tamaño de cada "pixel"
  const GAP = 3;  // espacio entre letras (en pixeles)

  const width = (WORD.length * 5 + (WORD.length - 1) * GAP) * PX;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${5 * PX}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', 5 * PX);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Tetris');

  [...WORD].forEach((ch, i) => {
    const ox = i * (5 + GAP) * PX;
    GLYPHS[ch].forEach((row, y) => {
      [...row].forEach((bit, x) => {
        if (bit !== '1') return;
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', ox + x * PX);
        r.setAttribute('y', y * PX);
        r.setAttribute('width', PX);
        r.setAttribute('height', PX);
        r.setAttribute('fill', COLORS[i % COLORS.length]);
        svg.appendChild(r);
      });
    });
  });

  document.getElementById('title').appendChild(svg);
})();
