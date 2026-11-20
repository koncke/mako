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
0. **AL REABRIR (el Cerebro archivó este chat el 19/11 por la tarde: Martín necesitaba la RAM, con 1 GB libre):**
   - **No hay nada renderizado.** Ni «El avión» ni la Serie 4 llegaron a empezar: los dos scripts esperaban 3 GB libres.
     Se cortaron por PID, la fila de `turno.mjs` quedó vacía y no quedan carpetas `mp4/_cuadros_*` mías.
   - **El servidor 8765 quedó APAGADO** (lo había levantado este chat). Antes de capturar o renderizar:
     `cd C:/dev/artefactos-animaciones && python -I -m http.server 8765` en segundo plano, y `curl` a `reels/kit/kit.js` → 200.
   - **Regla del Cerebro, sigue vigente:** un render por vez, siempre por `turno.mjs`, con 3 GB libres o más antes de
     cada tramo; al terminar, cerrar el navegador y los ffmpeg propios, por PID. Nada de agentes en paralelo.
   - **4 tramos por video, no 2:** con Martín usando la PC fue a ~5 s por cuadro, y `turno.mjs` le saca el lock a quien
     pasa de 40 min (con 2 tramos, cada uno dura ~60 min). Orden:
     1. «El avión» (las 6 correcciones ya están en la página; ver docs/series/serie-1-elige-a-o-b.md §5):
        `node tools/turno.mjs node series/tools/render-gl.mjs reels/serie1-avion-1.html mp4/serie1-avion-1.mp4 48.32
        reels/voz-serie1-avion-1.mp3 30 1/4` y lo mismo con `2/4`, `3/4`, `4/4` (el último arma el MP4).
     2. La Serie 4, igual: `reels/serie4-comentarios-1.html mp4/serie4-comentarios-1.mp4 43.62
        reels/voz-serie4-comentarios-1.mp3 30 1/4` … `4/4` (su hoja `cap/s4v2-hoja.jpg` ya se revisó).
   - Con cada MP4: mirarlo entero con `bash series/tools/mirar-mp4.sh mp4/<id>.mp4 cap/<id>-mp4`, rehacer
     `mp4/para-ig/<id>.mp4` (crf 27), `python -I tools/armar_galeria.py <scratchpad>/pub` y publicar sólo los archivos de
     esos dos (los del avión y la Serie 4 están fuera del manifiesto a propósito: el armado los vuelve a listar). Después,
     mandarle el link al Cerebro: él los revisa antes de pasárselos a Martín.
   - La Serie 2 está al día en la galería (versión 12: edu-mismo-video, edu-cinco-frases, edu-lo-pienso).
0. **Pendientes concretos (19/11 ~10:00 UTC, el chat llegó al tope de contexto):**
   - Serie 1 «El avión»: ver el punto de arriba (render entero; el retoque por rango de la mañana quedó superado).
   - Serie 4: voz nueva (43,62 s) y tarjetas grandes hechas en la página; `cap/s4v2-hoja.jpg` revisada (ninguna tarjeta tapa
     la cara); falta renderizar: `node tools/turno.mjs node series/tools/render-gl.mjs
     reels/serie4-comentarios-1.html mp4/serie4-comentarios-1.mp4 43.62 reels/voz-serie4-comentarios-1.mp3 30 1/2` (y 2/2).
     Sus archivos nuevos NO están publicados (se sacaron del manifiesto de pub a propósito).
   - Serie 2: `edu-mismo-video` está completo (19/11: la página publicada es la misma con la que se renderizó el MP4
     nuevo). `edu-cinco-frases` (video 2, con los dos retoques) publicado en la versión
     12. Los tres videos de la Serie 2 están al día.
   - Serie 3 manda 5 formatos más (usan imágenes `reels/app/s3-*.png`). La versión va por ~465
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
