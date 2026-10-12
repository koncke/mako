-- =============================================================================
-- 0249 — push_suscripciones: los teléfonos (y navegadores) a los que les llega un Web Push
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae lib/push.ts y app/api/push/*. Agrega
-- y no saca nada: la versión desplegada no la mira, así que aplicarla antes no le molesta a nadie. Sin
-- la tabla, el código nuevo contesta «sin_tabla» al suscribir y `enviarPush` no manda nada (lo loguea).
--
-- MaKo Mobile (docs/diseno-mako-mobile.md, «Push: a quién»): una fila por SUSCRIPCIÓN del navegador
-- (`PushSubscription.toJSON()`: endpoint + claves p256dh/auth), atada a la PERSONA que la activó.
--
-- ⚠️ SIN `workspace_id`, Y NO ES UN OLVIDO. La suscripción es del USUARIO, no de la pestaña: un super
-- admin que activa los avisos mientras mira a un cliente (`?ws=1`) NO tiene que recibir en su teléfono
-- los avisos de ese cliente. El workspace se resuelve al ENVIAR por `usuarios.workspace_id` (siempre el
-- vigente), así que esta tabla no va a TENANT_TABLES ni a TABLAS_DE_INQUILINO: se limpia en cascada con
-- la persona (el precedente es `usuarios`). Se escribe SIEMPRE con la fila propia (lib/perfil.ts,
-- `filaPropia`), nunca con `getTenantDb`.
--
-- `endpoint` es ÚNICO: el mismo teléfono que entra con otra cuenta MUEVE la fila (upsert por endpoint),
-- en vez de quedar suscripto a las dos personas.
--
-- `fallos` / `ultimo_error` / `last_ok_at` son el rastro del envío: un 404/410 del servicio de push
-- borra la fila (la suscripción murió), cualquier otro error suma un fallo y deja el motivo.
-- =============================================================================

begin;

create table if not exists push_suscripciones (
  id            bigserial primary key,
  usuario_id    bigint not null references usuarios(id) on delete cascade,
  endpoint      text not null check (char_length(endpoint) between 10 and 2000),
  p256dh        text not null check (char_length(p256dh) between 10 and 300),
  auth          text not null check (char_length(auth) between 8 and 200),
  plataforma    text check (plataforma is null or plataforma in ('ios', 'android', 'desktop')),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 400),
  created_at    timestamptz not null default now(),
  last_ok_at    timestamptz,
  fallos        integer not null default 0 check (fallos >= 0),
  ultimo_error  text check (ultimo_error is null or char_length(ultimo_error) <= 300)
);

create unique index if not exists push_suscripciones_endpoint_uk on push_suscripciones (endpoint);
create index if not exists idx_push_suscripciones_usuario on push_suscripciones (usuario_id);

comment on table push_suscripciones is 'Suscripciones Web Push (MaKo Mobile) atadas a la PERSONA (usuario_id), no al workspace. Endpoint único: otro login en el mismo teléfono mueve la fila.';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table push_suscripciones enable row level security;
revoke all on push_suscripciones from anon, authenticated;

commit;
