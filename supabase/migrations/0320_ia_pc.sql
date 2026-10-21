-- =============================================================================
-- 0320 · La IA del cliente en SU computadora (docs/ia-del-cliente.md, ola 1, 21/10/2026)
-- Aplicada a mano en producción el 21/10/2026 (Ticketera); idempotente.
-- (Se escribió como 0318, que era de Pagos: renumerada el 21/10. Todo es `if not exists`, y RLS y revoke se repiten.)
-- =============================================================================
-- Martín (D6a, 21/10): el Claude o el GPT del cliente corre en su computadora, con el programa oficial y sus cuentas, y
-- MaKo le manda los pedidos sin tomar nunca el token. Estas tablas son la PUERTA del servidor a la PC de cada cliente:
--   · ia_pc_codigos: el código de 6 letras para emparejar una PC (10 minutos, un uso, sólo su hash);
--   · ia_pc_dispositivos: cada PC emparejada, de un negocio Y de una persona, con el hash de su token `mkopc_`;
--   · ia_pc_turnos: un turno del chat que piensa la PC, con el hash del token POR TURNO de sus herramientas;
--   · ia_pc_llamadas: cada herramienta que pide la PC, que corre en el servidor con las reglas del chat.
-- Ningún secreto en claro: los tokens y los códigos, sólo su sha256. RLS sin políticas y el revoke, como 0311 y 0313:
-- sólo el servidor (service role) las lee.
-- =============================================================================

begin;

create table if not exists ia_pc_codigos (
  codigo_hash  text primary key check (codigo_hash ~ '^[0-9a-f]{64}$'),
  workspace_id bigint not null references workspaces(id) on delete cascade,
  persona      text not null check (char_length(persona) between 3 and 200),
  vence_at     timestamptz not null,
  usado_at     timestamptz,
  creado_at    timestamptz not null default now()
);

create table if not exists ia_pc_dispositivos (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  persona       text not null check (char_length(persona) between 3 and 200),
  nombre        text not null check (char_length(nombre) between 1 and 80),
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  version       text,
  ultimo_latido timestamptz,
  -- Lo que cuenta la PC de sus cuentas (Claude o ChatGPT, el email, el plan, el % usado). Nunca un secreto.
  cuentas       jsonb not null default '[]'::jsonb,
  creado_at     timestamptz not null default now(),
  revocado_at   timestamptz
);
create index if not exists ia_pc_dispositivos_persona_idx on ia_pc_dispositivos (workspace_id, persona) where revocado_at is null;

create table if not exists ia_pc_turnos (
  id             bigserial primary key,
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  dispositivo_id bigint not null references ia_pc_dispositivos(id) on delete cascade,
  sesion_id      bigint not null,
  estado         text not null default 'esperando' check (estado in ('esperando', 'tomado', 'listo', 'error', 'vencido')),
  -- Lo que piensa la PC: el system, la conversación y las herramientas que viajan en ESTE turno.
  pedido         jsonb not null,
  -- El token de las herramientas de ESTE turno: se acuña cuando la PC lo toma, así sólo ella lo recibe.
  token_hash     text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  vence_at       timestamptz not null,
  tomado_at      timestamptz,
  respuesta      text check (respuesta is null or char_length(respuesta) <= 20000),
  cuenta         text,
  uso            jsonb,
  error          text,
  creado_at      timestamptz not null default now(),
  listo_at       timestamptz
);
create index if not exists ia_pc_turnos_cola_idx on ia_pc_turnos (dispositivo_id, creado_at) where estado = 'esperando';

create table if not exists ia_pc_llamadas (
  id         bigserial primary key,
  turno_id   bigint not null references ia_pc_turnos(id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 120),
  entrada    jsonb not null default '{}'::jsonb,
  estado     text not null default 'esperando' check (estado in ('esperando', 'lista')),
  salida     text,
  es_error   boolean not null default false,
  creado_at  timestamptz not null default now(),
  lista_at   timestamptz
);
create index if not exists ia_pc_llamadas_turno_idx on ia_pc_llamadas (turno_id, id) where estado = 'esperando';

comment on table ia_pc_dispositivos is 'Las PC de los clientes que piensan su Ops Center con SU Claude o GPT (mig 0320, docs/ia-del-cliente.md). lib/ia-pc.ts.';
comment on table ia_pc_turnos is 'Un turno del chat que piensa la PC del cliente (mig 0320). Lo toma una vez y vence a los 5 minutos. lib/ia-pc.ts.';
comment on table ia_pc_llamadas is 'Una herramienta que pide la PC; la corre el turno que espera, con las reglas del chat (mig 0320). lib/ia-pc.ts.';

alter table ia_pc_codigos enable row level security;
alter table ia_pc_dispositivos enable row level security;
alter table ia_pc_turnos enable row level security;
alter table ia_pc_llamadas enable row level security;
revoke all on ia_pc_codigos from anon, authenticated;
revoke all on ia_pc_dispositivos from anon, authenticated;
revoke all on ia_pc_turnos from anon, authenticated;
revoke all on ia_pc_llamadas from anon, authenticated;

commit;
