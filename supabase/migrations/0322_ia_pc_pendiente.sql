-- =============================================================================
-- 0322 · La PC del cliente nace PENDIENTE y pasa a activa sola (docs/ia-del-cliente.md §3, 21/10/2026)
-- ⚠️ SIN APLICAR: la aplica la Ticketera recién después de la revisión del Cerebro. Idempotente.
-- =============================================================================
-- La segunda revisión del Cerebro (21/10/2026): emparejar dejaba la PC ACTIVA en la base antes de «¿Es tu negocio?». Si
-- la persona cerraba la ventana ahí (o se perdía una respuesta), quedaba una PC fantasma que prendía D6b para TODO el
-- negocio: el equipo se quedaba sin la IA que usaba y el chat mentía. Ahora:
--   · emparejar inserta la PC sin `confirmado_at` (pendiente): no recibe turnos ni se lista;
--   · `confirmado_at`: la marca el programa con su token (/api/ia-pc/confirmar) cuando la persona dijo que sí;
--   · `activa_at`: la marca el primer latido de una PC confirmada que trae una cuenta de Claude con sesión. Sólo las
--     activas cuentan para D6b (lib/ia-del-negocio.ts → negocioConPc);
--   · `claude_falta`: el último latido dijo que en esa PC no hay Claude Code (la tarjeta, el tutorial y el chat lo dicen);
--   · ia_pc_codigos.dispositivo_id: qué PC salió de cada código, para que el tutorial sepa si se gastó sin conectar;
--   · ia_pc_llamadas 'corriendo': la herramienta que el turno está corriendo ya no se saca de la fila «sin correr».
-- Las pendientes que nunca latieron se revocan solas (/api/cron/ia-pc-purga). Aditiva: columnas nuevas, un estado más.
-- =============================================================================

begin;

alter table ia_pc_dispositivos add column if not exists confirmado_at timestamptz;
alter table ia_pc_dispositivos add column if not exists activa_at timestamptz;
alter table ia_pc_dispositivos add column if not exists claude_falta boolean not null default false;

-- Las que ya existían (de la prueba del ws3, todas desconectadas): confirmadas desde que se conectaron, y activas si
-- alguna vez latieron con una cuenta.
update ia_pc_dispositivos set confirmado_at = coalesce(consentimiento_at, creado_at) where confirmado_at is null;
update ia_pc_dispositivos set activa_at = ultimo_latido
  where activa_at is null and ultimo_latido is not null and jsonb_array_length(cuentas) > 0;

create index if not exists ia_pc_dispositivos_activas_idx on ia_pc_dispositivos (workspace_id)
  where revocado_at is null and activa_at is not null;

alter table ia_pc_codigos add column if not exists dispositivo_id bigint references ia_pc_dispositivos(id) on delete set null;

alter table ia_pc_llamadas drop constraint if exists ia_pc_llamadas_estado_check;
alter table ia_pc_llamadas add constraint ia_pc_llamadas_estado_check check (estado in ('esperando', 'corriendo', 'lista'));

comment on column ia_pc_dispositivos.confirmado_at is 'La persona dijo que sí a «¿Es tu negocio?» (el programa, con su token). Sin esto la PC no recibe turnos ni se lista (mig 0322).';
comment on column ia_pc_dispositivos.activa_at is 'El primer latido de la PC confirmada con una cuenta de Claude con sesión. Sólo las activas prenden D6b (mig 0322).';

commit;
