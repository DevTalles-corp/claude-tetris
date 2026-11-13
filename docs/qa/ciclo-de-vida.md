# Ciclo de vida de un requerimiento

Hay tres ciclos. Todos pasan por `qa` antes de llegar a `main`.

## 1. Requerimiento nuevo
Un issue pide algo nuevo, por ejemplo el modo claro.

## 2. Solicitud
Una persona pide un cambio de documentación o de configuración. Se hace con una PR directa, sin issue.

## 3. Corrección de error
Algo falla en `qa`. El issue sigue abierto hasta que las pruebas pasan.

```mermaid
flowchart LR
  A[Issue nuevo] --> T["Claude diagnostica y etiqueta"]
  T --> R["Revisión humana del diagnóstico"]
  R --> B[Claude implementa en su rama]
  B --> C[PR a qa]
  C --> D[Workflow QA]
  D -->|Pasan| E[Aprobación manual]
  E --> F[PR qa a main]
  F --> G[Issue cerrado]
  D -->|Fallan| H[Revisión manual]
  H --> B
```

Consulta cada paso en [las fases de QA](index.md).
