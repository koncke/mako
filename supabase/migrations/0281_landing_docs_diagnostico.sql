-- =============================================================================
-- 0281 — El puntaje del Diagnóstico de una landing NUESTRA (Landing Generator, tanda 6)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: da igual. El código nuevo TOLERA que la columna falte (42703 al leerla,
-- PGRST204 al escribirla): sin ella el Diagnóstico de una landing nuestra funciona como hasta hoy
-- (los comentarios se guardan y el puntaje se ve sólo en el momento del análisis) y lo dice en el log.
-- Agrega y no saca nada: la versión desplegada no la nombra (`COLS_RESUMEN` y `COLS_DOC` piden
-- columnas explícitas), así que aplicarla antes no le molesta a nadie.
--
-- (Se escribió como 0281 el 14/10/2026: origin/main llegaba a la 0278 —la 0277 y la 0278 del Image
-- Editor—, la 0279 la tenía el worktree de la undécima y la 0280 otra rama. Si al integrar alguien ya la
-- tomó, se renumera ANTES de aplicarla.)
--
-- Pendiente de la tanda 2 del editor de landings (docs/hallazgos-editor-landing.md, «Lo que quedó sin
-- hacer»): «el puntaje de una landing nuestra no se guarda». Una landing de AFUERA guarda su veredicto en
-- `landing_analyses` (una fila por URL); una NUESTRA no puede ir ahí —esa tabla es de páginas por URL y el
-- Panel la listaría «de afuera»—, así que su último veredicto vive en la propia fila de la landing:
--
--   diagnostico = { "score": 0-10 con una décima | null, "veredicto": text | null,
--                   "resumen": text | null, "analyzed_at": timestamptz en ISO }
--
-- La escribe y la lee SÓLO lib/editor-landing/diagnostico-server.ts (con los helpers puros de
-- lib/editor-landing/diagnostico-guardado.ts: `aColumna` / `deColumna`). Se lee en un select APARTE,
-- nunca en el del Panel: una columna que falta tumba la consulta ENTERA y con ella el Panel.
-- Sin CHECK sobre el jsonb a propósito: la forma la sanea el código al leer (`deColumna` → la misma
-- `resumenDeAnalisis` que el veredicto de una de afuera), y un CHECK que no la entienda frenaría el
-- análisis entero por un dato accesorio.
--
-- Sin cambios en TENANT_TABLES ni en TABLAS_DE_INQUILINO: la tabla ya está en los dos (0246).

alter table landing_docs add column if not exists diagnostico jsonb;

comment on column landing_docs.diagnostico is 'El último veredicto del Diagnóstico de esta landing (tanda 6): { score 0-10 con una décima, veredicto, resumen, analyzed_at }. Lo escribe y lo lee lib/editor-landing/diagnostico-server.ts; los comentarios van en landing_sugerencias. null = nunca se diagnosticó.';
