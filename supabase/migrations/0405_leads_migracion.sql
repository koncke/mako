-- =============================================================================
-- 0405 — Un lead MIGRADO de otro CRM recuerda de dónde vino (la llamada con Thiago, 29/10/2026)
-- =============================================================================
-- Thiago (una agencia con 27 clientes en España) quiere pasar a MaKo los contactos de su CRM anterior por la API, con
-- su Claude. Martín le prometió que se guardan el id del CRM viejo, la fecha original y las UTM, y que migrar dos veces
-- no repite a nadie (docs/promesas/2910-llamada-thiago.md). Las UTM ya tenían columna; faltaban las tres de abajo.
--
-- EN PALABRAS:
--   · `id_externo`: el id que el contacto tenía en el CRM anterior. Es lo que hace que volver a mandar el mismo lote
--     (o un lote que se cortó a la mitad) no cree a nadie dos veces.
--   · `migrado_de`: el nombre del CRM anterior («GoHighLevel», «HubSpot»). Con dos CRM viejos, el mismo id puede ser de
--     dos personas distintas: el id se compara DENTRO de su CRM.
--   · `fecha_original`: cuándo se creó el contacto allá. `created_at` sigue siendo cuándo entró a MaKo (lo comparan
--     varias reglas contra otras filas que nacen en el acto, como la de un lead agregado a un segundo CRM).
--
-- El índice único es la red de dos altas a la vez con el mismo id (el chequeo de `createLead` lee y después inserta).
--
-- ORDEN DE DESPLIEGUE: ANTES del código, o junto. La única que escribe estas columnas es la operación nueva
-- `migrar_contactos` (lib/api-mako/areas/crm.run.ts): sin la migración contesta «falta la migración 0405» y no crea nada.
-- Ningún alta de antes las nombra, así que nada más se rompe.
--
-- Número: se escribió como 0404 y main tomó la 0404 ese mismo día (los carruseles); renumerada a 0405 el 6/11/2026
-- después de barrer main, las ramas y las etiquetas de origin (libre en todas).
-- Sin funciones: no hace falta revoke de EXECUTE. `leads` ya tiene RLS.
-- =============================================================================

begin;

alter table leads add column if not exists id_externo text check (id_externo is null or char_length(id_externo) between 1 and 200);
alter table leads add column if not exists migrado_de text check (migrado_de is null or char_length(migrado_de) between 1 and 80);
alter table leads add column if not exists fecha_original timestamptz;

create unique index if not exists leads_ws_id_externo_uq
  on leads (workspace_id, coalesce(migrado_de, ''), id_externo)
  where id_externo is not null;

commit;
