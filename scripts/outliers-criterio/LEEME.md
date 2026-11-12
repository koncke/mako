# Clasificar los reels de Spy por su EDICIÓN (11/11/2026)

Lo que produjo `lib/video-outliers-criterio.json`. El porqué y lo que salió: `docs/hallazgos-video-outliers.md`.

1. Exportar los reels distintos (`spy_piezas`, canal instagram, tipo reel o medio video) a `reels.json` en una carpeta de trabajo
   (fuera del repo), con `ref, url, miniatura, texto, cuenta, vistas, megusta, comentarios, fecha`. Sólo LECTURA de la base.
   ⚠️ El driver `postgres` devuelve los `bigint` como texto: convertirlos con `Number()` si se calculan múltiplos.
2. `node hojas.mjs` en esa carpeta: baja las portadas de NUESTRO bucket y arma hojas numeradas de 24 con su `.txt`.
3. Clasificadores (uno cada 6 hojas) con `CRITERIO.md`; después jueces independientes con `JUEZ.md` (más estricto, con las 16
   familias de `FAMILIAS_EDICION`). El juez decide el veredicto final.
4. El JSON: por código de Instagram `{ v, fa, p, m, fo, s }` (y `b: "video"` si se miró el video, `r` si tiene receta propia).
   `tests/video-outliers-criterio.test.ts` valida cada fila.
5. Una receta nueva: bajar SU referencia (sólo esa, como la de los pistachos) y `node medir-referencia.mjs <código>`: duración,
   tomas y un cuadro por segundo para leer el texto en pantalla.
