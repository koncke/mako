-- =============================================================================
-- 0128_cs_valores — la respuesta deja de ser un texto y pasa a ser 118 campos
-- =============================================================================
-- Hasta ahora un bloque se contestaba con UN textarea. Las preguntas de verdad
-- —las de los dos Cuestionarios Maestros— son 118, y muchas son TABLAS con
-- columnas: «las decisiones que te suben» son cinco columnas por ocho renglones,
-- la ficha de palanca son nueve campos con nombre. Aplanar eso a un párrafo
-- pierde justo la estructura que hace que la respuesta sirva para armar la
-- matriz.
--
-- `valores` guarda lo estructurado: { campoId: valor }, donde valor es string,
-- string[] (checks) o string[][] (tabla).
--
-- ⚠️ `respuesta` NO SE VA, y no es deuda: es la versión LEGIBLE de lo mismo, y
-- es sobre la que trabaja el resto del bucle. La IA reescribe prosa y el cliente
-- aprueba prosa —nadie aprueba un JSON—, así que el texto se deriva de `valores`
-- al guardar y queda ahí para la reescritura, la aprobación y el histórico.
-- Dos columnas, una sola fuente de verdad: `valores` manda, `respuesta` se
-- calcula.
-- =============================================================================
begin;

alter table cs_respuestas add column if not exists valores jsonb not null default '{}'::jsonb;

comment on column cs_respuestas.valores is
  'Lo que el cliente contestó, campo por campo: { campoId: string | string[] | string[][] }. Los campos salen de lib/programa-campos.ts. `respuesta` es su versión legible, derivada de acá.';

commit;
