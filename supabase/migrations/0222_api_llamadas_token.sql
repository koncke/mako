-- =============================================================================
-- 0222_api_llamadas_token — qué token pidió cada llamada de /api/v1
-- =============================================================================
-- Desde el 08/10/2026 un token DETALLADO con «Lectura y escritura» ESCRIBE DIRECTO (como
-- en GitHub, decisión de Martín), y un workspace puede tener varios. La bitácora de la API
-- contestaba «qué se pidió, cuándo y desde dónde», pero no QUIÉN: con escrituras directas
-- esa es la pregunta. `token_id` es el id del token detallado (`t_…`) o 'principal' para el
-- de la skill de Claude. Nunca el valor del token ni su hash.
--
-- ORDEN DE DESPLIEGUE: indistinto. lib/api-mako/bitacora.ts escribe la columna y, si
-- todavía no existe, reintenta la fila sin ella: la bitácora no pierde filas por el orden.
-- Aplicarla ANTES del deploy igual es lo mejor, para no perder el dato de las primeras.
begin;

alter table api_llamadas add column if not exists token_id text;

create index if not exists ix_api_llamadas_token on api_llamadas (workspace_id, token_id, created_at desc);

comment on column api_llamadas.token_id is 'El token que pidió: id del token detallado (t_…) o principal. Nunca el valor ni el hash.';

commit;

notify pgrst, 'reload schema';
