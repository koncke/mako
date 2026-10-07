-- =============================================================================
-- 0212 — El curso POR ÁREA: una tarea que se contesta una vez por área, y el link del líder
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy, y JUSTO antes (minutos, no horas).
--
--   · El código nuevo LEE `curso_clases.por_area` en `COLUMNAS_CLASE` (lib/curso-datos.ts): el
--     portal del alumno, la ficha, la tab Curso y el cron. Sin la columna, PostgREST rechaza la
--     consulta ENTERA y todo eso se cae. Por eso va antes.
--   · ⚠️ Y CAMBIA DOS TARGETS DE `ON CONFLICT`, así que la versión YA DESPLEGADA deja de poder
--     escribir en esas dos tablas mientras el deploy nuevo no termina: su upsert de
--     `curso_progreso` pide `(workspace_id, lead_id, clase_id)` y el de `curso_accesos`
--     `(workspace_id, lead_id)`, y ninguno de los dos índices existe después de esto. En esa
--     ventana el portal contesta «No se guardó» al progreso y a las tareas (500, con su log, y
--     nada guardado se pierde) y crear un link del curso falla con error. No hay forma de que las
--     dos versiones convivan: el índice viejo prohíbe justo las filas nuevas (una por área). Por
--     eso se aplica pegada al push. Medido por el relevo del 06/10: 0 filas en curso_progreso y
--     curso_accesos del ws1, o sea que hoy la ventana no la sufre nadie.
--
-- Pedido (#665, decidido por Martín el 06/10/2026, memoria cs-decisiones-cierre-0610): los
-- formularios de palancas, evidencia, umbrales y carta (m6-m9 del programa de Mauricio) eran
-- «UNO POR ÁREA» y el de umbrales lo contestaba el LÍDER de cada área. Desde la carga del 06/10
-- eran uno por cliente: un cliente con tres áreas sólo podía contestar una.
--
-- ── Lo que agrega ────────────────────────────────────────────────────────────
-- 1. `curso_clases.por_area`: esta clase se contesta UNA VEZ POR ÁREA del cliente. Default
--    false: las 107 clases cargadas siguen como estaban hasta que
--    scripts/curso-marcar-por-area.mjs marque las de m6-m9 (por `origen`, nunca por id).
-- 2. `curso_progreso.area`: de qué área es la respuesta. '' = la del cliente (todas las filas
--    que ya existen, y toda clase que no es por área). NOT NULL con '' y no NULL a propósito: el
--    unique nuevo tiene que poder ser target de un upsert, y con NULL cada respuesta del dueño
--    insertaría una fila nueva en vez de pisar la suya.
-- 3. `curso_accesos.area`: el acceso de un LÍDER de área (su link propio, prefijo `c2.`). NULL =
--    el acceso del dueño, que es lo que ya existía. El unique pasa a (ws, lead, área) con NULLS
--    NOT DISTINCT (Postgres 15+; prod corre 17.6, mig 0200 es el precedente): sin eso el upsert
--    del dueño no chocaría contra nada y cada «Copiar link» crearía otra fila.
--
-- ⚠️ LOS DOS UNIQUE NUEVOS SON ÍNDICES COMPLETOS, NO PARCIALES: un índice parcial no sirve de
-- target de ON CONFLICT desde PostgREST (docs/hallazgos-customer-success.md, «Trampas del
-- entorno»). El código usa EXACTAMENTE estos targets:
--   curso_progreso → onConflict 'workspace_id,lead_id,clase_id,area'
--   curso_accesos  → onConflict 'workspace_id,lead_id,area'
-- y tests/curso-por-area.test.ts fija que los dos lados digan lo mismo.
--
-- ⚠️ EL LÍDER NUNCA RECIBE `mako_session` NI FILA EN `usuarios` (lib/alumno-sesion.ts explica por
-- qué una fila en `usuarios` le abría el CRM). Su acceso es una fila de ESTA tabla y un link
-- firmado; ni siquiera recibe la cookie del alumno: entra sólo con su link.
--
-- No hay tabla nueva: las tres ya están en TENANT_TABLES y tienen RLS + revoke (mig 0202).

begin;

-- ── 1. Una clase POR ÁREA ────────────────────────────────────────────────────
alter table curso_clases add column if not exists por_area boolean not null default false;

comment on column curso_clases.por_area is
  'true = la tarea se contesta una vez por cada área que el cliente declaró en la tabla de áreas y responsables (m1c2), y el líder de esa área la ve con su propio link. La etapa se completa con TODAS las áreas (lib/curso.ts, progresoEfectivo).';

-- ── 2. La respuesta de UN área ───────────────────────────────────────────────
alter table curso_progreso add column if not exists area text not null default '';

alter table curso_progreso drop constraint if exists curso_progreso_area_largo;
alter table curso_progreso add constraint curso_progreso_area_largo check (length(area) <= 80);

create unique index if not exists curso_progreso_area_uk on curso_progreso (workspace_id, lead_id, clase_id, area);
drop index if exists curso_progreso_uk;

comment on column curso_progreso.area is
  'De qué área del cliente es esta respuesta. '''' = la del cliente (la única fila de una clase que no es por área). El nombre es el que el cliente escribió en su tabla de áreas.';

-- ── 3. El acceso de un LÍDER de área ─────────────────────────────────────────
alter table curso_accesos add column if not exists area text;

alter table curso_accesos drop constraint if exists curso_accesos_area_valida;
alter table curso_accesos add constraint curso_accesos_area_valida
  check (area is null or (area = btrim(area) and length(area) between 1 and 80));

create unique index if not exists curso_accesos_area_uk on curso_accesos (workspace_id, lead_id, area) nulls not distinct;
drop index if exists curso_accesos_uk;

comment on column curso_accesos.area is
  'NULL = el acceso del cliente (su link c1. y su cookie de alumno). Un nombre = el link propio (c2.) del LÍDER de esa área, que abre SÓLO las clases por área de esa área. Nunca una cuenta de MaKo.';

commit;
