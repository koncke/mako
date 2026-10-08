-- =============================================================================
-- 0223 — La PAPELERA del curso: clases y módulos que se borran «en suave»
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El código nuevo FILTRA por estas columnas en TODAS las
-- lecturas de clases (`.is('borrada_at', null)`: el portal del alumno, /mi-curso, la ficha, la tab
-- Curso, el cron de los mensajes, la comunidad) y de módulos sueltos (`.is('borrado_at', null)`,
-- lib/curso-modulos-datos.ts). Sin las columnas, PostgREST rechaza la consulta ENTERA («column …
-- does not exist») y se caen el portal de cada cliente y la tab — el precedente es la 0212. Agrega
-- y no saca nada: la versión desplegada no las mira, así que aplicarla antes no le cambia nada.
--
-- Pedido de Martín (08/10/2026, items 15 y 18): «en módulo falta la opción de eliminar módulo, si se
-- elimina, se elimina también la etapa» y «te falta el botón de arrepentimiento para muchas acciones,
-- el de 5 segundos de "Deshacer"».
--
-- ── Por qué un borrado SUAVE y no el `delete` de siempre ─────────────────────
-- Borrar una clase era un `delete`, y el avance de cada alumno (`curso_progreso`) se iba con ella por
-- la FK `on delete cascade` de la 0202. Un «Deshacer» que vuelve a CREAR la clase devuelve una IGUAL
-- con otro id: el avance, las entregas, las notas, lo abierto a mano y su portada siguen apuntando
-- al id viejo (AGENTS.md, «Deshacer una acción destructiva devuelve la MISMA identidad, no una
-- igual»). Con la marca, deshacer es volver a poner la marca en NULL: la misma fila, con todo lo que
-- la nombra.
--
-- ⚠️ EL BORRADO SUAVE TIENE QUE SER INVISIBLE PARA TODO LO DEMÁS: cada lectura de clases filtra
-- `borrada_at is null`, y lo fija tests/curso-papelera.test.ts barriendo `app/` y `lib/` (una
-- lectura nueva sin el filtro le muestra al alumno una clase que el equipo borró). Las excepciones son
-- a propósito y están nombradas en ese test: las que tienen que ver TAMBIÉN lo borrado (qué claves no
-- se reusan, quién usa todavía un video, la purga).
--
-- ── La purga ─────────────────────────────────────────────────────────────────
-- Lo que lleva más de `DIAS_PAPELERA` días borrado se borra de verdad (lib/curso-papelera.ts, desde el
-- cron diario /api/cron/curso-purga): ahí sí se va el avance por la cascada, y los archivos que
-- quedan sin fila los barre la purga de los buckets. El índice parcial es el de esa consulta.
--
-- RLS on sin políticas = sólo server-side (service_role), igual que el resto del curso: las dos
-- tablas ya lo tienen (0202 y 0220), y esto sólo agrega columnas.

begin;

alter table curso_clases add column if not exists borrada_at timestamptz;
comment on column curso_clases.borrada_at is
  'Borrada desde el editor (papelera). NULL = viva. Toda lectura filtra `borrada_at is null`; deshacer la vuelve a NULL y la purga la borra de verdad después de unos días (lib/curso-papelera.ts).';

alter table curso_modulos add column if not exists borrado_at timestamptz;
comment on column curso_modulos.borrado_at is
  'Módulo borrado desde el editor (papelera). NULL = vivo. La fila queda para que su CLAVE no se reuse mientras sus clases sigan en la papelera, y para que deshacer devuelva el mismo módulo.';

create index if not exists curso_clases_papelera on curso_clases (borrada_at) where borrada_at is not null;
create index if not exists curso_modulos_papelera on curso_modulos (borrado_at) where borrado_at is not null;

-- Las tablas ya tienen RLS prendido y el revoke (0202 y 0220); se repite por si una base se armó a
-- mano sin ellos: es idempotente y no cambia nada donde ya está.
alter table curso_clases enable row level security;
alter table curso_modulos enable row level security;
revoke all on curso_clases from anon, authenticated;
revoke all on curso_modulos from anon, authenticated;

commit;
