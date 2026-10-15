-- =============================================================================
-- 0286 — la contraseña de MaKo (15/10/2026)
-- =============================================================================
-- Decisión de Martín: tener contraseña es OBLIGATORIO para todos, desde la misma fecha que el
-- 2FA (21/10), como camino de entrada ALTERNATIVO a Google, nunca un paso más. Diseño:
-- docs/diseno-login-contrasena.md. El hash es scrypt de node:crypto con sus parámetros al lado
-- (lib/contrasena-reglas.ts).
--
-- APARTE DE `usuarios` a propósito: `usuarios` se lee en CADA pedido y su fila viaja a la sesión;
-- el hash no viaja a ningún lado. Sin `workspace_id`: una persona no es de un negocio (la agencia
-- cruza varios), igual que `usuario_mfa`. Toda lectura filtra por el usuario de la sesión o el del
-- correo que se está comprobando, nunca por un id del pedido.
--
-- ORDEN DE DESPLIEGUE: ANTES de prender la fecha del 21/10. El código tolera que falte (no exige
-- crearla si no puede leer, y el login con correo contesta lo mismo que un correo sin contraseña),
-- así que desplegar antes no deja afuera a nadie.
-- =============================================================================

create table if not exists usuario_contrasena (
  usuario_id   bigint primary key references usuarios(id) on delete cascade,
  hash         text not null,
  creada_at    timestamptz not null default now(),
  cambiada_at  timestamptz not null default now()
);

alter table usuario_contrasena enable row level security;
revoke all on usuario_contrasena from anon, authenticated;

comment on table usuario_contrasena is
  'La contraseña de cada usuario (scrypt$N$r$p$sal$hash). Se lee sólo desde el server con service_role.';
