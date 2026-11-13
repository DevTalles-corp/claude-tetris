const { test, expect } = require('@playwright/test');
const { capturar } = require('./helpers/evidencia');

// La evidencia se guarda con capturar(), en tests/evidencia/issue-N/AAAA-MM-DD_HH-MM-SS/
// Uso: ISSUE=3 npm test

test('carga el tablero y el botón de tema', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#theme-toggle')).toBeVisible();
  await capturar(page, 'carga-tablero');
});

test('el modo claro cambia el tema y se captura', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await capturar(page, 'modo-claro');
});

test('el modo oscuro vuelve al tema original', async ({ page }) => {
  await page.goto('/');
  await page.locator('#theme-toggle').click();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await capturar(page, 'modo-oscuro');
});
