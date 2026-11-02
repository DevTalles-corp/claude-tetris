// Fija Math.random con una semilla antes de que cargue el juego (algoritmo mulberry32).
// El juego solo usa el azar para elegir la pieza, así que con la misma semilla
// las piezas salen siempre en el mismo orden, sin modificar game.js.
async function fijarSemilla(page, semilla) {
  await page.addInitScript((s) => {
    let a = s >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, semilla);
}

module.exports = { fijarSemilla };
