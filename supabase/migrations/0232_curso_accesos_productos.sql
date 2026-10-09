-- =============================================================================
-- 0232 — A qué cursos abre el acceso de un alumno: los productos a los que lo INVITARON
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. Agrega una columna que el código nuevo LEE en el camino
-- del PORTAL: `accesoDe` la trae con el resto del acceso (`COLS_ACCESO`, lib/curso-datos.ts) y
-- `productosConCasaDelAlumno` la pregunta en cada pedido del portal, de la comunidad del alumno y de
-- los mensajes del curso. Sin la columna, PostgREST rechaza la consulta ENTERA («column … does not
-- exist») y se caen el portal, /mi-curso, la ficha y el cron de recordatorios. Agrega y no saca nada:
-- la versión desplegada no la mira.
--
-- El feedback del audio del 08/10/2026 a la noche (docs/feedback-curso-08oct-noche.md, punto 7, min 21):
-- «tengo acceso a los dos cursos, cuando sólo le había invitado al curso de Fiesta Music». El acceso
-- se resolvía por CLIENTE: el portal le abría todo producto del que el lead es cliente (su casa en el
-- CRM más sus filas de `cliente_entrega`), y el mail de invitación nombraba a todos (punto 6).
--
-- `productos` — los productos cuyo curso abre ESTE acceso. Sólo significa algo en la fila del CLIENTE
-- (`area is null`): la de un líder de área se rige por la del cliente, como `alcance` (mig 0219).
--   · NULL = TODOS sus productos, que es lo de siempre. Es el valor de las filas que ya existen (al
--     09/10/2026 hay UNA en toda la base: un alumno de prueba del ws10) y el de las que nacen por un
--     camino que no es de un producto (copiar el link o mandarlo por WhatsApp desde la ficha, la
--     invitación automática del CRM mientras no pase su producto). Nadie pierde nada al aplicar esto.
--   · Un array = sólo esos productos, y sólo mientras siga siendo cliente de cada uno (se cruza con
--     la regla del kanban; sacarlo de un producto le saca ese curso).
-- La regla (cuándo una invitación pasa NULL a una lista, y cuándo suma) vive en el código, con test:
-- lib/curso-invitar-reglas.ts (`productosTrasInvitar`). La base sólo corta lo que no puede ser nunca.
--
-- RLS: `curso_accesos` ya lo tiene prendido y sin políticas (0202): sólo el server (service_role).
-- Se re-afirma igual, como en la 0219.

begin;

alter table curso_accesos add column if not exists productos bigint[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'curso_accesos_productos_forma') then
    alter table curso_accesos add constraint curso_accesos_productos_forma
      check (productos is null or (array_position(productos, null) is null and cardinality(productos) <= 200));
  end if;
end $$;

comment on column curso_accesos.productos is
  'Los productos cuyo curso abre el acceso del cliente. NULL = todos sus productos (lo de antes). Array = sólo ésos, cruzados con los productos de los que sigue siendo cliente. La regla, en lib/curso-invitar-reglas.ts.';

alter table curso_accesos enable row level security;
revoke all on curso_accesos from anon, authenticated;

commit;
