---
name: Requerimiento
about: Nuevo requerimiento o corrección. Claude lo diagnostica y etiqueta al crearlo; la implementación se pide después.
title: ''
labels: ''
---

## Qué se necesita
<!-- Describe el cambio en una o dos frases. -->

## Criterios de aceptación
<!-- Un criterio por línea. Claude verifica cada uno. -->
- [ ] 
- [ ] 

## Qué pasa después
- **Al crear el issue**, Claude lo analiza solo: asigna etiquetas (tipo, área y prioridad) y publica un diagnóstico con cinco secciones: Diagnóstico, Área afectada, Causa raíz, Propuesta de solución y Riesgos. Si editas el título o la descripción, el diagnóstico se actualiza.
- **Para implementar**, revisa el diagnóstico y comenta en el issue mencionando a Claude (arroba seguida de claude, todo junto), por ejemplo: "… implementa este issue con la skill `qa-tests`". Claude decidirá si requiere pruebas automatizadas o una verificación LLM, y trabajará en su propia rama.
