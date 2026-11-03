# Relevo — tickets #46, #47 y #48 de Leila (claude2, 3/11/2026, corte al 99 %)

**Rama:** `tickets-leila-0311` · **worktree:** `C:/dev/wt-tickets-leila` · **sin pushear** (el sha va al Cerebro).

## Hecho
- `d6501deac`: el arreglo de los tres tickets (familias `precio-oferta`, `crear-secuencia` y `donde-se-edita` en
  lib/mako-intencion-app.ts; `DATOS_DEL_NEGOCIO` en lib/secciones-negocio.ts; capacidad `datos-negocio`; las lecturas dicen
  dónde se edita cada dato). Tests 14-17 de tests/mako-no-puedo-falsos.test.ts, probados rompiéndolos (8 roturas, cada
  una roja). Hitos con `tickets: [46]`, `[47]` y `[48]` en app/admin/dev/second-brain/bitacora.ts; cosecha en
  docs/hallazgos-ia.md.
- `71bbc41e0`: la regla en AGENTS.md.
- Tests de lo tocado: 307 pasan, más los 3 de la ticketera. Leila ya tiene la respuesta en los tres tickets (`arreglado`).

## FALTA (lo único): el tsc acotado
`node scripts/tsc-acotado.mjs --rama` sale con **código 134 aun con 4,5 GB libres**: es el heap de 2,5 GB que queda
corto, no la RAM de la PC. Correr `node scripts/tsc-acotado.mjs --rama --heap=4096` cuando la guardia lo deje (pide 3 GB
libres). En verde, el tren lleva `71bbc41e0` (o este commit).

## Sin hacer, a propósito
- `guardar_campo_perfil` sólo completa huecos: MaKo no corrige un precio ya cargado en «El brief» (decisión de producto).
- «pásalo a dólares» sin la palabra «precio» no trae `guardar_oferta`.
- Ticket #43 (ws 13, «cargar un archivo al Second Brain de mi cliente»): mismo tipo, no tocado.
