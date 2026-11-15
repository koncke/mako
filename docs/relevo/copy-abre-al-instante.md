# Relevo — Copywriting abre al instante (14/11/2026, claude5 al 100 %)

**Rama:** `punta/copy-abre-al-instante` · **worktree:** `C:/dev/wt-copy-abre` (node_modules enlazado a wt-push-q).
**Pedido (Martín, 14/11):** «no que yo le clique y que no haga nada»: al tocar una pieza, «Replicar», una plantilla o un
documento, la pantalla cambia en el acto con el loader de MaKo.

## Hecho y subido

- `app/copywriter/AlInstante.tsx` (`useAlInstante` + `CapaAbriendo`) y `app/copywriter/al-instante.ts` (`abreOtraPantallaDeCopy`):
  la capa con CargandoMako va en el MISMO clic, antes del primer `await`; se va sola al cambiar la ruta o la query; si falla, se
  suelta y queda el aviso con «Reportar a Soporte».
- Conectada en Copywriter (escritorio), OutliersCopy (Replicar, plantillas, pegar), ListaGuionesM y GuionM (teléfono).
- Test: `tests/copywriter-abre-al-instante.test.ts` (5/5; roto a propósito caen 3). Actualizados `copywriter-outliers` y
  `copywriter-pegado` (30/30).
- Mediciones del ANTES y lo aprendido: `docs/hallazgos-copywriter.md`, «"Le clico y no hace nada"». Regla en AGENTS.md.
- Capturas del loader (1440 y 375) y notas: side-session-notes/local_3f1a66d3…/copy-abre-1411/.

## Lo que falta (en orden)

1. **Tipos sin chequear:** `tsc-acotado` dio 99 (sin RAM) dos veces; que lo vea la punta en GitHub. Si da rojo, mirar primero
   `app/copywriter/AlInstante.tsx` y el test (jsdom + `AppRouterContext`).
2. **Integrar y desplegar** (el Cerebro): `punta/**` no despliega sola.
3. **Medir el DESPUÉS en producción** y mandarlo al Cerebro: desde el clic hasta la capa (se espera ~0 s; la criatura a los
   150 ms) y hasta ver el texto de la página, en los 4 caminos. Cómo se midió el antes: hallazgos, «Cómo se midió sin escribir».
   Captura real del clic desplegado a 1440 y 375 (las de ahora son la capa montada a mano sobre producción).
4. Opcional, lo que sigue esperando detrás de la capa: Replicar ~1,2 s y abrir 0,5–1 s; la página nueva se pide otra vez al
   server aunque `crear` ya la devuelve (app/copywriter/Copywriter.tsx). Atrás y Adelante del navegador siguen sin capa.
