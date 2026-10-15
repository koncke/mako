-- =============================================================================
-- 0288_decisiones_aviso — que la respuesta de una tarjeta le llegue sola al chat que preguntó
-- =============================================================================
-- Pedido (15/10/2026, vía «Estrategia 3 cuentas»). Martín, textual: «Y ya respondí todas esas
-- tarjetas y al parecer no te llegó... No sirve de nada la ticketera si no te llega». Había 29
-- respuestas en la base y nadie las empujaba. Ahora las avisa el cartero del Centro de Operaciones
-- en su vuelta (lib/decisiones-aviso.ts, lib/operaciones.ts → cicloCartero).
--
-- ⚠️ `chat` ES UN NOMBRE, NO UNA SESIÓN: «2FA» o «Plan» no son el título de ningún chat. `destino`
-- guarda la sesión que preguntó (`local_…` / `cli_…`), y la pone quien publica.
-- ⚠️ El aviso se marca por RESPUESTA: `aviso_de` es el `respondida_at` que se avisó. Si Martín
-- cambia la respuesta, la nueva se avisa de nuevo; `aviso_id` es el intento (va en el acuse del
-- cartero, con el mismo formato que el id de un pedido).
-- ⚠️ ORDEN DE DESPLIEGUE: AGREGA columnas que el código nuevo YA LEE → se aplica ANTES del deploy.
-- Sin ellas no se cae nada: el ciclo del cartero calcula los avisos aparte y, si fallan, los
-- pedidos firmados salen igual (`avisosError`).
-- ⚠️ La tabla ya tiene RLS sin políticas y el revoke a anon/authenticated (0277): sumar columnas no
-- cambia eso.

begin;

alter table admin_decisiones
  add column if not exists destino text
    check (destino is null or destino ~ '^(local|cli)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  add column if not exists aviso_id uuid,
  add column if not exists aviso_de timestamptz,
  add column if not exists aviso_destino text,
  add column if not exists aviso_estado text
    check (aviso_estado is null or aviso_estado in ('tomado', 'entregado', 'no_entregado', 'incierto')),
  add column if not exists aviso_at timestamptz,
  add column if not exists aviso_intentos integer not null default 0,
  add column if not exists aviso_motivo text;

create unique index if not exists idx_admin_decisiones_aviso_id on admin_decisiones (aviso_id) where aviso_id is not null;

comment on column admin_decisiones.destino is 'La sesión que preguntó (local_… / cli_…). Con ella el cartero avisa la respuesta.';
comment on column admin_decisiones.aviso_de is 'El respondida_at que se avisó: si la respuesta cambia, se avisa de nuevo.';
comment on column admin_decisiones.aviso_id is 'El intento de aviso en curso; es el id del acuse del cartero.';

commit;
