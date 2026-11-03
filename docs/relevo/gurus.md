# Relevo — Gurús (#16, #17, #18) · 3/11/2026 ~02:00 ART, claude2 al 97 %

Rama `gurus-0311` en `C:/dev/wt-gurus`, **sin pushear**. Mergeada con origin/main (conflicto en
`lib/cerebro-referente-server.ts` resuelto: los dos lados leían del CDN; quedó el comentario de main y el
`fetch` con tiempo máximo de la rama).

## Hecho
- **#17**: el turno de un chat con gurú trae los TRAMOS de su curso que hablan de la pregunta
  (`cursoParaElTurno`, `lib/cerebro-referente.ts`), en un bloque aparte de `paqueteParaElTurno`.
  `recuperar_del_segundo_cerebro` cuelga el curso cuando le piden un id `ref:`. Probado con el curso
  real de Alborna leído del CDN: 41/41 clases en 578 ms; «¿cómo hago un gancho… primeros segundos?»
  trae la clase 13, «Los primeros segundos de tu video».
- **#16**: «Hablar con un gurú» en la cabecera de Nuevo chat (cliente y super admin) →
  `app/second-brain/ChatDelReferente.tsx`. El servidor saca al gurú de la CLAVE de la conversación
  (`…:referente-<id>`).
- **#18**: «Su Second Brain» en el chat del gurú → `GET /api/mako/chat?cerebroDe=<id>` + `Grafo`.

## Verificado / NO verificado
- Tests de todo lo tocado: 30/0 en los cuatro archivos de cambio, 220/2 → 0 en la tanda ancha; los
  nuevos, probados rompiéndolos.
- ⚠️ **`node scripts/tsc-acotado.mjs --rama` NO corrió**: la guardia de RAM lo bloqueó y el único
  intento murió por memoria (134). Es lo PRIMERO antes de pasar el sha a Integración.
- ⚠️ No se miró en la app (sin RAM para el dev server).

## Falta
- El teléfono (`app/m/operaciones/ChatsMovil.tsx` → `HojaChatNuevo`) no ofrece el gurú.
- Las filas de la lista con la cara del gurú (hoy dicen su nombre como origen).
- **#15** sin tocar: confirmar `f378981ea` en producción antes de nada.
