-- =============================================================================
-- 0180 — la insistencia: avisos que vuelven hasta que alguien diga «lo vi»
-- =============================================================================
-- El pedido, textual (tarea #823, 27/09/2026): «ellos quieren que cuando un lead de sus
-- clientes entre al CRM, MaKo en WhatsApp le reviente a mensajes insistiendo que le
-- LLAME». Y el caso que lo probó del otro lado (tarea #724): Mauricio se enteró de una
-- reunión una hora antes porque el aviso quedó sepultado entre otros mensajes, y la
-- sesión con el prospecto se cortó a la mitad.
--
-- Cada fila es UNA insistencia viva: el aviso ya salió y está esperando el acuse. El cron
-- la vuelve a mandar cada `cada_min` hasta `veces`, o hasta que alguien escriba «ok» en
-- el grupo — lo que pase primero.
--
-- ⚠️ POR QUÉ UNA TABLA Y NO `app_settings`, igual que la mig 0161: el estado lo tocan a
-- la vez el webhook que recibe el acuse y el cron que reintenta. Un JSON con
-- read-modify-write se pisa, y acá pisarse significa o mandar de más (la línea del
-- cliente) o dejar de mandar sin que nadie se entere.
--
-- ⚠️ Y EL TECHO NO VIVE ACÁ. `cada_min` y `veces` se guardan ya recortados por
-- `sanearInsistir` (lib/flujos-tipos.ts: 5 veces, 30 min). La base los acepta como
-- números, pero el CHECK está igual: una fila escrita a mano desde el SQL editor no
-- puede convertirse en un bucle que queme un WhatsApp.
-- =============================================================================

begin;

create table if not exists insistencias (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- De qué flujo salió (id de plantilla) y sobre qué lead, para poder cortar por caso.
  flujo_id      text not null,
  lead_id       bigint references leads(id) on delete cascade,
  texto         text not null default '',
  cada_min      int  not null default 30 check (cada_min >= 30),
  veces         int  not null default 1  check (veces >= 1 and veces <= 5),
  enviadas      int  not null default 0,
  proxima_at    timestamptz not null,
  -- El estado entero, sin borrar nada: queda la bitácora de si lo vieron o se agotó.
  --   null = viva · 'acuse' = alguien confirmó · 'agotada' = se acabaron las veces
  cerrada_por   text,
  cerrada_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- El cron pregunta siempre lo mismo: qué toca mandar ahora, por workspace.
create index if not exists insistencias_pendientes on insistencias (workspace_id, cerrada_at, proxima_at);
-- El webhook del acuse cierra TODAS las vivas de un workspace de un saque.
create index if not exists insistencias_vivas_ws on insistencias (workspace_id) where cerrada_at is null;

comment on table insistencias is 'Avisos que vuelven a mandarse hasta el acuse de recibo (mig 0180). cerrada_at null = viva.';
comment on column insistencias.cerrada_por is 'acuse = alguien escribió «ok» en el grupo · agotada = se usaron las `veces`.';
comment on column insistencias.veces is 'Techo del producto: máximo 5 (lib/flujos-tipos.ts INSISTIR_MAX_VECES). No es configurable por el cliente.';

-- Igual que avisos_cola (0161) y plan_tareas (0093): RLS prendida y CERO policies.
-- Nadie entra con la key anónima; se lee y escribe sólo por getTenantDb, que scopea.
alter table insistencias enable row level security;

commit;
