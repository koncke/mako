-- =============================================================================
-- 0161 — la cola de avisos que esperan al resumen de la mañana
-- =============================================================================
-- El reporte del dueño (22/09/2026): «las notificaciones de WhatsApp son demasiadas».
-- La respuesta es que los avisos que NO son urgentes esperen y salgan juntos, una vez por
-- día. Esta tabla es donde esperan.
--
-- ⚠️ POR QUÉ UNA TABLA Y NO UN JSON EN `app_settings`. Dos razones, y las dos ya se
-- pagaron en este repo:
--
--  1. Un array en `app_settings` se guarda con read-modify-write, y los avisos los emiten
--     varios crons que corren a la vez: dos avisos del mismo minuto se pisan y uno
--     desaparece sin dejar rastro. Una fila por aviso no tiene esa carrera.
--  2. La salida barata («subo el `dedupTtlMin` a 1440 y listo») NO agrupa: el dedup de
--     `emitirAviso` retorna ANTES de escribir nada, así que los avisos 2..N se tiran sin
--     registro. Es «una política puede RECHAZAR; no puede no dejar rastro» (AGENTS.md):
--     posponer un aviso tiene que ESCRIBIRLO primero y decidir el canal después.
--
-- `enviado_at` es el estado entero: null = espera, con fecha = ya salió en un resumen. No
-- se borra nada, así que queda la bitácora de qué se pospuso y cuándo salió — que es
-- justamente lo que hoy no existe para ningún aviso (la tabla `notificaciones` de la mig
-- 0048 nunca se aplicó en producción).
-- =============================================================================

begin;

create table if not exists avisos_cola (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  tipo          text not null,
  titulo        text not null default '',
  texto         text not null default '',
  categoria     text not null default 'aviso',
  semaforo      text not null default 'na',
  link          text not null default '',
  -- al grupo del dueño (SuperAdmin) o al del cliente: el resumen sale por el MISMO canal
  -- que hubiera salido el aviso.
  al_dueno      boolean not null default false,
  created_at    timestamptz not null default now(),
  enviado_at    timestamptz
);

-- El cron pregunta siempre lo mismo: qué falta mandar, por workspace, en orden.
create index if not exists avisos_cola_pendientes on avisos_cola (workspace_id, enviado_at, created_at);

comment on table avisos_cola is 'Avisos NO urgentes esperando el resumen diario (mig 0161). enviado_at null = pendiente.';
comment on column avisos_cola.al_dueno is 'true = va al grupo del super-admin; false = al grupo del cliente. El resumen respeta el canal del aviso original.';

-- Igual que plan_tareas/plan_proyectos (mig 0093), plan_dependencias (0140) y plan_reprios
-- (0144): RLS prendida y CERO policies. Nadie entra con la key anónima; se lee y se escribe
-- sólo por `getTenantDb`, que scopea por workspace.
alter table avisos_cola enable row level security;

commit;

notify pgrst, 'reload schema';
