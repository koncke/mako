-- =============================================================================
-- 0330_suscripcion_mako — la suscripción de MaKo de punta a punta y MaKo Partners (23/10/2026)
-- =============================================================================
-- Pedido de Martín (audios del 22/10/2026, para el domingo 25/10): «la pasarela de pagos con todas las
-- automatizaciones tanto de ingreso como de egreso... si alguien paga se ingresa automáticamente a la app con el
-- email de bienvenida y si alguien no paga que se le expulse de la app... le tiene que quedar una deuda pendiente...
-- y si te querés dar de baja en la suscripción debería habilitarte un descuento». Y: «el sistema de referidos con la
-- página de MaKo Partners... que se gestione de manera automática».
--
--   · `cobros.plan_mako`: el plan de MaKo que compra este cobro (lib/planes-mako.ts). Sólo en cobros de la plataforma.
--   · `cobros.origen`: de dónde vino quien compró ({ landing, avatar, funcionalidad, utm_* }), para que el onboarding
--     vaya directo a lo que buscaba. El origen de la CUENTA vive en `cuenta.origen` (app_settings, contrato con el chat de
--     Landings del 23/10): éste es el dato explícito del checkout, que ese alta prefiere.
--   · `cobros.ref_codigo`: el código de MaKo Partners con el que llegó (el link /r/<código>). El PRIMERO vale.
--   · `cobros.meses`: cuántos meses del lugar paga un cobro ÚNICO (la deuda de varios meses). null = 1.
--   · `workspaces.referido_por_ws`: el negocio de MaKo Partners que lo refirió (el primero vale).
--   · `partner_codigos`: el código de cada negocio que refiere (uno por negocio, único, en minúscula).
--   · `partner_creditos`: el libro de lo que gana un partner (un renglón por referido que llegó a su 2º pago, y uno por
--     cada uso). Único por (referidor, referido, tipo): acreditar dos veces el mismo referido choca y no suma.
--
-- TODO ADITIVO: columnas nuevas nullables y tablas nuevas. Ninguna lectura vieja las mira. Seguro de re-ejecutar.
-- ORDEN: ANTES del deploy que las lee (el checkout de /planes escribe `plan_mako`, `origen` y `ref_codigo`; sin ellas el
-- cobro se crea igual y lo que no se pudo anotar queda en el log).
-- =============================================================================

alter table cobros add column if not exists plan_mako text check (plan_mako is null or plan_mako ~ '^[a-z0-9-]{1,32}$');
alter table cobros add column if not exists origen jsonb check (origen is null or (jsonb_typeof(origen) = 'object' and pg_column_size(origen) <= 2048));
alter table cobros add column if not exists ref_codigo text check (ref_codigo is null or ref_codigo ~ '^[a-z0-9-]{3,32}$');
alter table cobros add column if not exists meses smallint check (meses is null or meses between 1 and 24);

comment on column cobros.plan_mako is 'El plan de MaKo que compra este cobro (lib/planes-mako.ts). Sólo en la plataforma. Mig 0330.';
comment on column cobros.origen is 'De qué landing vino quien compró ({landing, avatar, funcionalidad, utm_*}). Mig 0330.';
comment on column cobros.ref_codigo is 'El código de MaKo Partners con el que llegó quien compró. Mig 0330.';
comment on column cobros.meses is 'Cuántos meses del lugar paga un cobro único (la deuda). null = 1. Mig 0330.';

alter table workspaces add column if not exists referido_por_ws bigint references workspaces(id) on delete set null;

comment on column workspaces.referido_por_ws is 'El negocio de MaKo Partners que lo refirió (el primero vale). Mig 0330.';

create table if not exists partner_codigos (
  workspace_id bigint primary key references workspaces(id) on delete cascade,
  codigo       text not null unique check (codigo ~ '^[a-z0-9-]{3,32}$'),
  created_at   timestamptz not null default now()
);

comment on table partner_codigos is 'El código de MaKo Partners de cada negocio (hola-mako.com/r/<codigo>). Mig 0330.';

create table if not exists partner_creditos (
  id            bigserial primary key,
  referidor_ws  bigint not null references workspaces(id) on delete cascade,
  referido_ws   bigint references workspaces(id) on delete set null,
  tipo          text not null check (tipo in ('referido', 'uso', 'ajuste')),
  monto_usd     numeric(12, 2) not null check (monto_usd <> 0),
  nota          text check (nota is null or char_length(nota) <= 300),
  cobro_id      bigint references cobros(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table partner_creditos is 'El libro de MaKo Partners: + un referido que llegó a su 2º pago, − lo que se usó. Mig 0330.';

-- Un referido acredita UNA vez a su referidor (dos corridas del cron, o dos avisos, chocan acá y no suman).
create unique index if not exists partner_creditos_un_referido
  on partner_creditos (referidor_ws, referido_ws) where tipo = 'referido';
-- Un uso del crédito por cobro (la misma renovación no descuenta dos veces).
create unique index if not exists partner_creditos_un_uso_por_cobro
  on partner_creditos (referidor_ws, cobro_id) where tipo = 'uso' and cobro_id is not null;
create index if not exists partner_creditos_referidor on partner_creditos (referidor_ws, created_at desc);

-- Lo leen y escriben SÓLO las rutas del servidor (cliente de servicio): nada para anon ni authenticated.
alter table partner_codigos enable row level security;
alter table partner_creditos enable row level security;
revoke all on partner_codigos from anon, authenticated;
revoke all on partner_creditos from anon, authenticated;
