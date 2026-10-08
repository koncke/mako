-- =============================================================================
-- 0218 — Las ENTREGAS del alumno: el bucket privado `curso-entregas` y la nota de sus quizzes
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: se aplica ANTES del deploy. El código nuevo la LEE y la ESCRIBE:
--   · la ruta /api/compartido/curso/entrega firma subidas a `curso-entregas` (sin el bucket, la
--     firma falla y el alumno no puede subir ni grabar nada);
--   · la ruta /api/compartido/curso/tarea lee y escribe `curso_progreso.calificacion` cuando la
--     tarea tiene un quiz (lib/curso-entregas.ts). Sin la columna, PostgREST rechaza la consulta
--     entera y la tarea con quiz no se puede enviar.
-- Agrega y no saca nada: la versión desplegada no mira ninguna de las dos cosas, así que aplicarla
-- antes no le molesta. Es idempotente (`if not exists`, `on conflict`): se puede correr dos veces.
--
-- Pedido de Martín (07/10/2026, item 18 del curso tipo Skool): «Piensa en qué otras tareas se
-- podría pedir aparte de formularios e impleméntalas». Los tipos nuevos de campo (lib/curso.ts,
-- `CampoTipo`) son nueve; dos necesitan algo de la base:
--
--   · ARCHIVO / AUDIO / VIDEO: el alumno sube un entregable, o graba su pitch en el navegador, y el
--     archivo va DIRECTO de su navegador al bucket con una URL firmada (una ruta que reciba el
--     archivo topa en 1 MB: AGENTS.md, «tres topes del entorno»). En `curso_progreso.valores` queda
--     sólo la REFERENCIA ({path, nombre, mime, bytes}); el path es
--     `<ws>/<producto>/<lead>/<clase>/<uuid>.<ext>` y lo arma el server (`pathDeEntrega`), así que
--     «¿este archivo es de este alumno y de esta clase?» se contesta con un prefijo, sin tabla.
--   · QUIZ: la NOTA va en una columna propia y no en `valores`. `valores` lo escribe el navegador y
--     lo pisa cada autoguardado: una nota guardada ahí se podría inventar desde un pedido armado a
--     mano, o se borraría sola con el siguiente borrador (y con ella los intentos usados).
--
-- ⚠️ NO HAY TABLA NUEVA, a propósito: la entrega es un VALOR de una respuesta que ya existe
-- (`curso_progreso`, con su workspace y su RLS). Nada que sumar a TENANT_TABLES.

begin;

-- ── 1. La nota de los quizzes de una respuesta ──────────────────────────────
-- `{ "<campoId>": { "nota": 0-100, "aprobado": bool, "intentos": n, "malas": [i…], "at": iso } }`.
-- ⚠️ LA ESCRIBE SÓLO EL SERVER al corregir (lib/curso-entregas.ts, `registrarCalificacion`) y al
-- dar otro intento (`darOtroIntento`). Ningún camino del navegador llega a esta columna.
-- SIN DEFAULT: NULL = no tiene quiz, o nunca lo envió.
alter table curso_progreso add column if not exists calificacion jsonb;

comment on column curso_progreso.calificacion is 'Notas de los quizzes de esta respuesta (campoId → {nota, aprobado, intentos, malas, at}). La escribe sólo el server al corregir (lib/curso-entregas.ts); nunca viene del navegador.';

-- La tabla ya tenía RLS y el revoke (mig 0202). Se reafirma: idempotente, y una columna nueva no
-- abre nada, pero quien lea sólo esta migración tiene que poder ver que sigue cerrada.
alter table curso_progreso enable row level security;
revoke all on curso_progreso from anon, authenticated;

-- ── 2. El bucket de las entregas ─────────────────────────────────────────────
-- PRIVADO: se lee con una URL firmada de vida corta que se pide al hacer clic (el alumno por
-- /api/compartido/curso/entrega con su token y el candado de la clase; el equipo con su sesión).
-- 100 MiB por archivo: documentos, imágenes, audio y video corto. Un pitch grabado en el navegador
-- (720p a 1 Mbps) son ~8 MB por minuto; lo que sea más largo va por un campo `link` (Loom, Drive).
-- ⚠️ LA LISTA DE TIPOS ES LA MISMA QUE `MIME_ENTREGA` (lib/curso.ts) y el tope es
-- `TOPE_ENTREGA_BYTES`: un test compara las dos (tests/curso-tareas-tipos.test.ts). Si se cambia
-- una, se cambia la otra: el bucket rechaza recién al terminar de subir.
-- ⚠️ Sin políticas sobre storage.objects para este bucket, a propósito: sólo el cliente de servicio
-- (las rutas) firma y lee. anon y authenticated no tienen nada que hacer acá.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curso-entregas', 'curso-entregas', false, 104857600, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/x-m4a',
  'audio/wav',
  'audio/aac',
  'video/webm',
  'video/mp4',
  'video/quicktime'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
