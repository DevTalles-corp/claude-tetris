# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin package.json, sin proceso de build, sin pruebas y sin linter. El README está en español; mantén la documentación coherente con ese idioma.

## Ejecución

Abre `index.html` directamente, o sirve la carpeta de forma estática (por ejemplo `python3 -m http.server 8000`) y visita `http://localhost:8000`.

## Arquitectura

Los scripts se cargan como scripts normales (sin módulos). `game.js` busca los elementos de `index.html` por id al cargar (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`), así que renombrar un id obliga a actualizar la `const` correspondiente al inicio de `game.js`.
