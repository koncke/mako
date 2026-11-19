# Relevo — chat `galeria-series` (galería de animaciones + Series 1 y 4)

Cuenta: claude5. Worktree `C:/dev/wt-galeria-series` (rama `galeria-series` → push a `punta/galeria-series`).
La fuente de los reels NO está en el repo: `C:/dev/artefactos-animaciones/` (leer su `LEEME.md`, sección «19/11»).

## Qué está hecho
- **Galería en claude5:** https://claude.ai/artifact/Xn37U48gr5sKx4zyDsEzUm (la de claude2 no se abre desde otra cuenta).
  Este chat es el ÚNICO que la publica. Se arma con `python -I tools/armar_galeria.py <scratchpad>/pub` (sólo copia lo que
  cambió; `--todo` para un artefacto nuevo) y se publica con `files` + `root` = esa carpeta. Capacidades: `db` + `downloads`.
  Topes: 255 archivos/64 MB por publicación, 511/256 MB por versión, **15 MB por archivo binario**.
- **Serie 1 «Elige A o B»** — playbook `docs/series/serie-1-elige-a-o-b.md`. Piloto «El mastermind», parte 1: terminado,
  en la galería (#serie1-mastermind-1) con texto del post, MP4 para bajar y portada. **Partes 2A y 2B (una por cada
  opción) también terminadas** y en la galería (#serie1-mastermind-2a / -2b): se publica sólo la que gane.
- **Serie 4 «Responde comentarios»** — playbook `docs/series/serie-4-reacciona-comentarios.md`. Piloto parte 1:
  terminado y en la galería (#serie4-comentarios-1). Lo construyó un agente con `series/BRIEF-serie4.md` (sirve para la 2).
- Hallazgos: `docs/hallazgos-contenido.md` (índice: `docs/hallazgos.md`).

## Lo que sigue
1. Cuando Martín publique la parte 1 de cada serie: leer los comentarios.
   - Serie 1: la opción que gane decide si se publica la 2A o la 2B (las dos están listas); después, la parte 3 (el búnker
     con Hormozi, esquema en el playbook).
   - Serie 4: la parte 2 se arma SOLO con comentarios reales (plantilla en el playbook, §4).
2. Las Series 2 y 3 (otros chats) mandan sus formatos terminados (id + ficha + mp4): se suman a la galería en su sección
   (`familia: "Serie 2"` / `"Serie 3"`, agregar el id a `reels/fichas/aprobados.txt`, armar y publicar).
3. Esperan decisión de Martín: si Víctor dice «nicho» y Ramiro «viralidad» (al revés de como quedó); efectos de sonido en
   la Serie 4 (hoy no lleva ninguno).

## Cómo se trabaja (lo que ahorra tiempo)
- Navegador y Chromium SIEMPRE por `node tools/turno.mjs <cmd>`: la fila la comparten 6 chats; juntar 30-40 segundos
  por captura. Render de 60 s en 3D: `series/tools/render-gl.mjs` en dos tramos (`1/2`, `2/2`); retoques por rangos
  (`t:6.3-8.6`). Mirar el MP4 entero con `series/tools/mirar-mp4.sh`.
- Voz: `bash tools/voz_formato.sh <id>` con `voz/guion-<id>.json`.
- Medir encuadres SIN navegador antes de capturar: `series/tools/nodethree/` (ver docs/hallazgos-contenido.md).
- Personajes en cubos: `reels/serie/rig.js` (Martín, Víctor, Ramiro, Hormozi, guardia, encapuchado, fantasma).
  Lo común de la Serie 1: `reels/serie/s1-comun.js`.
