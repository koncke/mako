# Hallazgos de Ads

Lo que hay que saber antes de tocar `lib/ads-analyst.ts` y todo lo que lee
`marketing_metrics_daily`. **No es un changelog.**

Origen: corrida multi-agente de 08/2026 (unificación del paginado). Regla de la cosecha en
`AGENTS.md`.

---

## 1. En `marketing_metrics_daily` hay una fila por anuncio **y por día**

Es el dato que hay que tener en la cabeza antes de escribir cualquier lectura de esa tabla,
y explica dos cosas distintas.

### Un `ORDER BY ad_id` a secas no es un orden

**Síntoma:** el contador de cobertura decía que faltaban analizar anuncios que ya estaban
analizados (o al revés).

**Causa:** `getAllMetaAdIds` paginaba ordenando por `ad_id`, que en esta tabla se repite
tantas veces como días tenga el anuncio. Con empates masivos el reparto entre páginas no
está garantizado y se **salteaban ad_ids enteros**. Tenía `ORDER BY`, así que la revisión
rápida lo daba por bueno.

**Regla:** el orden de un bucle paginado tiene que ser **único**. Acá se desempata siempre
por `id`: `[{col:'ad_id'},{col:'id'}]`. La trampa completa, en
[hallazgos-infra.md](hallazgos-infra.md) §1. Aplica igual a las otras lecturas del módulo,
que ordenaban por `(fecha, ad_id)` o `(ad_id, fecha)` — tampoco son únicas por sí solas.

### Un año de 200 anuncios son ~73.000 filas para un `Map` de 200 claves

Por eso `getScriptMetrics`, `getAdNames`, `getCierresByAd` y `getAllMetaAdIds` usan
`leerPorPaginas` y no `leerTodo`: de cada fila sobrevive un contador, así que la página se
agrega al `Map` y se tira. `leerTodo` materializaría el año entero en memoria para
descartarlo.

**Regla:** la pregunta no es cuántas filas hay, es **cuánto sobrevive de cada fila**.

## 2. Los chunks de 200 `ad_id` no son un tope

`getCierresByAd` parte los ids en chunks de 200 para el `.in()`, y **dentro de cada chunk
igual pagina**: son leads `ganado`, que crecen con el tiempo. Un chunk de 200 no garantiza
menos de 1000 filas.
