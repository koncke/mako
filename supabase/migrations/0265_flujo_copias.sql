-- =============================================================================
-- 0265 — Los flujos copiados con «Copiar flujo», guardados detrás de un TOKEN (Automations, decimoquinta tanda)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae las acciones `copiar_flujo` y `leer_copia` de
-- POST /api/chat-agent/secuencias (lib/flujo-copia-negocio.ts). Sin ella NADA SE ROMPE: el server contesta 503 con
-- «Falta la migración 0265 (flujo_copias).», «Copiar flujo» copia el flujo ENTERO como antes (el renglón y el JSON,
-- que se sigue pegando en cualquier negocio) y pegar un token dice que falta. Agrega y no saca nada: la versión
-- desplegada no la nombra, así que aplicarla antes no le molesta a nadie.
--
-- Pedido de Martín (12/10/2026), punto 8 de la decimoquinta tanda, textual: «Me gustaría que al momento de copiar un
-- flujo se cree como un ID o Token para que los usuarios se pasen ese token, y al momento de pegar eso por ejemplo en
-- el input de texto, en lugar de ver el token debería decir "Flujo copiado: NOMBRE DEL FLUJO"...».
--
-- Una fila por COPIA (cada «Copiar flujo» crea una nueva: es el flujo COMO ESTABA al copiarse, no un link vivo):
--   · `token`: 'MAKO-FLUJO-' + 10 letras de Crockford (sin I, L, O ni U): 50 bits al azar del servidor
--     (`tokenDeBytes`, lib/flujo-copia.ts). El check es el mismo formato que lee `tokenDeTexto`.
--   · `workspace_origen`: el negocio que copió. ⚠️ NO SE LLAMA `workspace_id` A PROPÓSITO: la fila se lee desde
--     CUALQUIER negocio que tenga el token (es para compartir), así que no pasa por `getTenantDb` ni va en
--     `TENANT_TABLES` (lib/workspace.ts) ni en `TABLAS_DE_INQUILINO`. Borrar el negocio borra sus copias (cascade).
--   · `secuencia_origen`: la automatización de donde salió. Sin FK: borrarla no invalida lo que ya se compartió.
--   · `nombre`: el de la automatización (lo que se ve al pegar: «Flujo copiado: <nombre>»).
--   · `copia`: la copia validada (`CopiaFlujo`: las tarjetas, dónde estaba cada una, sus CRON y el guion de cada
--     audio). Sin datos de leads: una automatización no los tiene. Al pegar, lo que no existe en el negocio que pega
--     queda vacío y en rojo (`limpiarReferencias`), igual que pegar el texto entero.
--
-- RLS prendida sin políticas y `revoke` explícito: el que mantiene afuera a la clave pública es el revoke. El servidor
-- lee y escribe con service_role (`getSupabaseServer`), y sólo para el admin del negocio que copia o que pega.

begin;

create table if not exists flujo_copias (
  token             text primary key check (token ~ '^MAKO-FLUJO-[0-9A-HJKMNP-TV-Z]{10}$'),
  workspace_origen  bigint not null references workspaces(id) on delete cascade,
  secuencia_origen  bigint,
  nombre            text not null default '' check (char_length(nombre) <= 120),
  copia             jsonb not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_flujo_copias_ws on flujo_copias (workspace_origen);

comment on table flujo_copias is 'Los flujos copiados con «Copiar flujo» (Automations): el token que se comparte, el negocio de origen y la copia como estaba al copiarse. Se lee desde cualquier negocio que tenga el token.';

alter table flujo_copias enable row level security;
revoke all on flujo_copias from anon, authenticated;

commit;
