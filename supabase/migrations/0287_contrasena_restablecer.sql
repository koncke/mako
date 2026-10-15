-- =============================================================================
-- 0287 — los links de «Olvidé mi contraseña» (15/10/2026)
-- =============================================================================
-- El circuito 3 de docs/diseno-login-contrasena.md. El link es de UN solo uso y vence a los 30
-- minutos; en la base vive sólo su HMAC (como los códigos del 2FA), así que leer esta tabla no da
-- ningún link que sirva. Un pedido nuevo cierra el anterior. El mail sale por la automatización de
-- SuperAdmin «Restablecer contraseña» (lib/restablecer-aviso.ts, del chat de Automations).
--
-- Sin `workspace_id`, como `usuario_contrasena`: una persona no es de un negocio. Toda lectura va por
-- el HMAC del token que trae el pedido, nunca por un id.
--
-- ORDEN DE DESPLIEGUE: antes o junto con el código. Sin la tabla, pedir el link contesta lo mismo de
-- siempre («si es tu cuenta, te llega un mail») y no sale nada; abrirlo dice que venció.
-- =============================================================================

create table if not exists contrasena_restablecer (
  id          bigserial primary key,
  usuario_id  bigint not null references usuarios(id) on delete cascade,
  token_hash  text not null unique,
  intentos    int not null default 0,
  expira_at   timestamptz not null,
  usado_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_contrasena_restablecer_usuario on contrasena_restablecer (usuario_id, created_at desc);

alter table contrasena_restablecer enable row level security;
revoke all on contrasena_restablecer from anon, authenticated;
revoke all on sequence contrasena_restablecer_id_seq from anon, authenticated;
