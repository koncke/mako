-- =============================================================================
-- 0099 — Compartir estilo Google Drive: "cualquiera con el enlace" o invitados
-- =============================================================================
-- La 0098 dejó `shares` con un solo modo (un token y quien lo tenga entra).
-- Martín lo quiere como Drive: o link abierto, o SOLO las personas invitadas
-- por email, cada una con su acceso propio (revocable y auditable de a una).
--
-- Decisión: cada invitado recibe SU PROPIO token en el mail. Poseer ese link
-- personal es la prueba de identidad — igual que Drive con "cualquiera con el
-- enlace", pero por persona: se revoca de a uno y se ve quién entró y cuándo.
-- No se emite cookie ni sesión: un share NO es una identidad.

begin;

-- 'link'      = cualquiera con el enlace (el token del share sirve solo)
-- 'invitados' = el token del share NO alcanza: solo sirven los tokens personales
alter table shares add column if not exists modo text not null default 'link'
  check (modo in ('link', 'invitados'));

create table if not exists share_invitados (
  id            bigint generated always as identity primary key,
  share_id      bigint      not null references shares(id) on delete cascade,
  email         text        not null,
  -- Igual que en shares: del token solo se guarda el sha256.
  token_hash    text        not null,
  token_prefijo text        not null,
  enviado_at    timestamptz,
  visitas       int         not null default 0,
  ultima_visita timestamptz,
  revocado_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- ÚNICO y GLOBAL: el token personal se resuelve sin saber de qué share es.
create unique index if not exists share_invitados_token_idx on share_invitados (token_hash);
create index if not exists share_invitados_share_idx on share_invitados (share_id, created_at desc);
-- Un mismo mail no se invita dos veces al mismo link.
create unique index if not exists share_invitados_unico_idx on share_invitados (share_id, lower(email));
alter table share_invitados enable row level security;   -- sin políticas: solo service_role

commit;

notify pgrst, 'reload schema';
