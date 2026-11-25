'use strict';

// Skins visuales: cada una define su paleta (derivada de COLORS) y su función de dibujo de bloque.
// Se cargan antes de game.js; COLORS se resuelve en tiempo de llamada.

function skinRoundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

const SKIN_NEON = [null, '#00e5ff', '#ffee00', '#d500f9', '#00ff6a', '#ff1744', '#448aff', '#ff9100'];
const SKIN_PASTEL = [null, '#b5ead7', '#fff1b8', '#d9c2f0', '#c7f0c2', '#ffc8c8', '#bcd8f7', '#ffd9b3'];

const SKINS = {
  retro: {
    label: 'Retro',
    drawBlock(context, x, y, idx, size) {
      context.fillStyle = COLORS[idx];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neón',
    drawBlock(context, x, y, idx, size) {
      const color = SKIN_NEON[idx];
      const px = x * size + 3, py = y * size + 3, s = size - 6;
      try {
        context.shadowColor = color;
        context.shadowBlur = 12;
        context.fillStyle = color + '55';
        context.fillRect(px, py, s, s);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(px, py, s, s);
      } finally {
        context.shadowBlur = 0;
        context.shadowColor = 'transparent';
      }
    },
  },
  pastel: {
    label: 'Pastel',
    drawBlock(context, x, y, idx, size) {
      skinRoundRect(context, x * size + 2, y * size + 2, size - 4, size - 4, 7);
      context.fillStyle = SKIN_PASTEL[idx];
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      skinRoundRect(context, x * size + 6, y * size + 5, size - 12, 4, 2);
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    drawBlock(context, x, y, idx, size) {
      const px = x * size, py = y * size, u = Math.max(2, Math.floor(size / 6));
      context.fillStyle = COLORS[idx];
      context.fillRect(px, py, size, size);
      // textura: sombra abajo/derecha, luz arriba/izquierda y puntos en damero
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let j = 1; j < 4; j++)
        for (let i = 1; i < 4; i++)
          if ((i + j) % 2 === 0) context.fillRect(px + i * u + u / 2, py + j * u + u / 2, u, u);
      context.strokeStyle = 'rgba(0,0,0,0.6)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    },
  },
};

const SKIN_ORDER = ['retro', 'neon', 'pastel', 'pixel'];
