# Relevo — chat `galeria-series` (galería de animaciones + Series 1 y 4)

Cuenta: claude5. Worktree `C:/dev/wt-galeria-series` (rama `galeria-series` → push a `punta/galeria-series`).
La fuente de los reels NO está en el repo: `C:/dev/artefactos-animaciones/` (leer su `LEEME.md`, sección «19/11»).

## Qué está hecho
- **Galería en claude5:** https://claude.ai/artifact/Xn37U48gr5sKx4zyDsEzUm (la de claude2 no se abre desde otra cuenta).
  Este chat es el ÚNICO que la publica. Se arma con `python -I tools/armar_galeria.py <scratchpad>/pub` (sólo copia lo que
  cambió; `--todo` para un artefacto nuevo) y se publica con `files` + `root` = esa carpeta. Capacidades: `db` + `downloads`.
  Topes: 255 archivos/64 MB por publicación, 511/256 MB por versión, **15 MB por archivo binario**.
- **Serie 1 «Elige A o B»** — playbook `docs/series/serie-1-elige-a-o-b.md` (leer su §0). **Martín rechazó «El
  mastermind»** (gancho que no se entiende, jerga, nombres completos): quedó fuera de la galería, con su parte 2 congelada.
  La parte 1 nueva es **«El avión»** (`reels/serie1-avion-1.html`, 49 s), con el gancho calcado de la referencia, «Víctor» y
  «Rama», y subtítulos de 92 px. Las partes 2 se hacen sobre ésta cuando Martín la apruebe.
- **Serie 4 «Responde comentarios»** — playbook `docs/series/serie-4-reacciona-comentarios.md`. Piloto parte 1 en la
  galería (#serie4-comentarios-1); 19/11: tarjetas más grandes y sin jerga («high ticket», «renderizaron»), voz nueva
  (43,6 s) — re-render pendiente si no figura hecho en el playbook §6b. Lo construyó un agente con `series/BRIEF-serie4.md`.
- **Series 2 y 3 (otros chats):** en la galería, en su sección; los MP4 livianos en `mp4/para-ig/`.
- Hallazgos: `docs/hallazgos-contenido.md` (índice: `docs/hallazgos.md`).

## Lo que sigue
0. **19/11 ~10:15 UTC — EN CURSO:** un agente rehace 5 tomas de «El avión» + cambia s11 a «Atrás, todos sacan el celular…»
   y renderiza la Serie 4, con el brief `C:/dev/artefactos-animaciones/series/BRIEF-avion-retoques.md`. Al volver: revisar
   los MP4, rehacer los `mp4/para-ig/` (crf 27), armar y publicar la galería, y mandarle el link al Cerebro (él revisa
   antes de pasárselo a Martín). Lo de «retoque por rango en la fila» de abajo ya está hecho.
0. **Pendientes concretos (19/11 ~10:00 UTC, el chat llegó al tope de contexto):**
   - Serie 1 «El avión»: un retoque por rango quedó en la fila (`render-gl … t:8.3-11.0`: los pasajeros que se asoman
     al darse vuelta). Cuando esté, rehacer `mp4/para-ig/serie1-avion-1.mp4` (crf 27) y republicar. A mejorar: el plano
     de los celulares (34-38 s) se ve de costado.
   - Serie 4: voz nueva (43,62 s) y tarjetas grandes hechas en la página; mirar `cap/s4v2-hoja.jpg` (sin revisar), corregir
     si una tarjeta tapa la cara, y renderizar: `node tools/turno.mjs node series/tools/render-gl.mjs
     reels/serie4-comentarios-1.html mp4/serie4-comentarios-1.mp4 43.62 reels/voz-serie4-comentarios-1.mp3 30 1/2` (y 2/2).
     Sus archivos nuevos NO están publicados (se sacaron del manifiesto de pub a propósito).
   - Serie 2: `edu-mismo-video` se va a reemplazar (mismo id y ruta; el publicado tiene rayitas y letra chica). Cuando
     avise: rehacer `mp4/para-ig/edu-mismo-video.mp4`, `python -I tools/armar_galeria.py <pub>` y republicar.
   - Serie 3 manda 5 formatos más (usan imágenes `reels/app/s3-*.png`); Serie 2, el video 2. La versión va por ~460
     archivos de 511: para no pasarse, mover los MP4 y portadas a `assets` (capacidad del artefacto).
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
