-- =============================================================================
-- 0331 — curso_accesos.productos_a_mano: el curso que una PERSONA abrió desde el buscador
-- =============================================================================
-- ORDEN DE DESPLIEGUE: ANTES del deploy.
--
-- El buscador de Customer Success → Curso («Invitar en cualquier etapa», 13/10/2026) invita a un lead que no está en
-- Ganado, o que es cliente de otro producto. La invitación levantaba las guardas AL ESCRIBIR (creaba el acceso y
-- mandaba el mail), pero no dejaba nada que la puerta de LECTURA reconociera: `resolverAcceso` (lib/curso-datos.ts)
-- exige que el lead esté en Ganado, así que el link del mail no abría. Medido el 23/10/2026.
--
-- Esta columna es esa marca: los productos cuyo curso le abrió una persona a mano. La escribe SÓLO
-- `marcarInvitacion({ aMano: true })`, y abre sólo lo que `productos` también abre (la regla, pura y con test, en
-- lib/curso-invitar-reglas.ts).
--
-- ⚠️ AL REVÉS QUE `productos`: vacío = NINGUNO (en `productos`, NULL = todos). Por eso `not null default '{}'`.
-- ⚠️ Sólo la fila del CLIENTE (`area` null): un líder entra por su área, no por un permiso a mano (check).
--
-- Si llega DESPUÉS del deploy: el código lee «sin permiso» (lo de hoy: el link de un no ganado no abre) y el buscador
-- falla ANTES de mandar el mail, diciendo que falta esta migración. No se pierde nada.
--
-- Sin backfill, a propósito: los invitados del 13 al 23/10 se mezclan con ganados que después perdieron, y el
-- arreglo de cada uno es volver a apretar «Invitar» en el buscador (decidido el 23/10/2026).
-- =============================================================================

begin;

alter table curso_accesos add column if not exists productos_a_mano bigint[] not null default '{}'::bigint[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'curso_accesos_productos_a_mano_forma') then
    alter table curso_accesos add constraint curso_accesos_productos_a_mano_forma
      check (array_position(productos_a_mano, null) is null
             and cardinality(productos_a_mano) <= 200
             and (area is null or cardinality(productos_a_mano) = 0));
  end if;
end $$;

comment on column curso_accesos.productos_a_mano is
  'Productos cuyo curso le abrió una PERSONA desde el buscador (invitar en cualquier etapa), sin que esté en Ganado o sin ser cliente de ese producto. Vacío = ninguno (AL REVÉS que productos). Sólo la fila del cliente. Abre sólo lo que productos también abre. La regla, en lib/curso-invitar-reglas.ts.';

alter table curso_accesos enable row level security;
revoke all on curso_accesos from anon, authenticated;

commit;
