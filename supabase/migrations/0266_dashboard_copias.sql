-- =============================================================================
-- 0266 — Los dashboards copiados con «Copiar dashboard», guardados detrás de un TOKEN (Dashboard, 13/10/2026)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae POST /api/graficos/copia (lib/graficos-copia-server.ts).
-- Sin ella NADA SE ROMPE: la ruta contesta 503 con «Falta la migración 0266 (dashboard_copias).», «Copiar dashboard»
-- dice que no se pudo y pegar un token dice que no lo encontró. Agrega y no saca nada: la versión desplegada no la
-- nombra, así que aplicarla antes no le molesta a nadie.
--
-- Pedido de Martín (12/10/2026, por el chat Chatbot), textual: «...que los dashboards también deberían poder copiarse y
-- enviarse con ese token». Es la MISMA forma que `flujo_copias` (mig 0265, «Copiar flujo» de Automations), con su
-- propio prefijo y su propia tabla: lo que se guarda es otra cosa (una hoja del informe, no un flujo).
--
-- Una fila por COPIA (cada «Copiar dashboard» crea una nueva: es la hoja COMO ESTABA al copiarse, no un link vivo):
--   · `token`: 'MAKO-DASH-' + 10 letras de Crockford (sin I, L, O ni U): 50 bits al azar del servidor
--     (`tokenDashDeBytes`, lib/graficos-copia.ts). El check es el mismo formato que lee `tokenDashDeTexto`.
--   · `workspace_origen`: el negocio que copió. ⚠️ NO SE LLAMA `workspace_id` A PROPÓSITO: la fila se lee desde
--     CUALQUIER negocio que tenga el token (es para compartir), así que no pasa por `getTenantDb` ni va en
--     `TENANT_TABLES` (lib/workspace.ts) ni en `TABLAS_DE_INQUILINO`. Al pegar, el server compara este negocio con el
--     que pega: en otro, los filtros sobre cosas del negocio de origen se vacían (`hojaParaOtroNegocio`).
--     Borrar el negocio borra sus copias (cascade).
--   · `hoja`: la hoja saneada (`sanearHoja`), SIN los valores de los filtros sobre personas (`hojaParaCopiar`). Una
--     hoja no tiene datos: tiene la definición (gráficos, filtros, textos, estilo). Los números los lee quien la abre.
--   · `nombre`: el de la hoja (lo que se ve al pegar: «Dashboard copiado: <nombre>»).
--   · `vaciados`: cuántos filtros sobre personas se vaciaron al copiar (se le avisa a quien pega).
--
-- RLS prendida sin políticas y `revoke` explícito: el que mantiene afuera a la clave pública es el revoke. El servidor
-- lee y escribe con service_role (`getSupabaseServer`), y sólo para el admin del negocio que copia o que pega.

begin;

create table if not exists dashboard_copias (
  token             text primary key check (token ~ '^MAKO-DASH-[0-9A-HJKMNP-TV-Z]{10}$'),
  workspace_origen  bigint not null references workspaces(id) on delete cascade,
  nombre            text not null default '' check (char_length(nombre) <= 60),
  hoja              jsonb not null,
  vaciados          integer not null default 0 check (vaciados >= 0),
  created_at        timestamptz not null default now()
);

create index if not exists idx_dashboard_copias_ws on dashboard_copias (workspace_origen);

comment on table dashboard_copias is 'Los dashboards (hojas del informe) copiados con «Copiar dashboard»: el token que se comparte, el negocio de origen y la hoja como estaba al copiarse, sin los filtros sobre personas. Se lee desde cualquier negocio que tenga el token.';

alter table dashboard_copias enable row level security;
revoke all on dashboard_copias from anon, authenticated;

commit;
