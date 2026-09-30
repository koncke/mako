-- =============================================================================
-- 0183 — el CRON de un mensaje: cuándo sale, por workspace
-- =============================================================================
-- El pedido, textual (30/09/2026): «El cron debería ser uno de dos... O el usuario lo
-- configura para que salga en TIEMPO... 1 vez a la semana, al mes, al año,
-- diariamente... Cada X horas... O lo configura que se dispare mediante una ACCIÓN».
--
-- La mitad ACCIÓN ya corría: son los cinco `EVENTOS` de lib/flujos-tipos.ts, cada uno
-- con su choke point. Esta mitad no existía para nadie: los tres crons de reporte
-- resuelven al workspace del DUEÑO (`getNotifPrefs()` sin `runWithWorkspace`, así que
-- `wsActual()` cae a OWNER_WS) y ninguna pantalla podía agendar nada. Medido el
-- 30/09/2026: hay `notification_prefs` en los workspaces 1, 9, 11 y 13, y ningún cron
-- las lee.
--
-- ORDEN DE DESPLIEGUE: **antes o junto** con el deploy. Es una tabla que el código
-- nuevo YA LEE (el drenador y el detalle del mensaje), así que entre un deploy sin
-- tabla y la migración, la sección CRON del editor no puede mostrar lo agendado —
-- se ve como si nadie hubiera programado nada.
--
-- ⚠️ POR QUÉ UNA TABLA Y NO `mako.plantillas.store`, que es donde vive el resto de la
-- configuración de un mensaje. Dos razones medidas:
--
--   1. ESE STORE SE HEREDA. Lo del dueño es el default de todos, fusionado campo por
--      campo (`leerStore` en lib/plantillas.ts), así que un «todos los lunes a las 9»
--      guardado ahí por Mauricio se le aplicaría a los otros nueve workspaces activos
--      por default. Un agendado no es un default: es de quien lo agendó.
--   2. READ-MODIFY-WRITE. El store lo escribe el navegador entero cada vez; acá el
--      drenador escribe `proxima_at` en cada tick. Es exactamente la carrera que la
--      mig 0161 ya documentó, y pisarse significa mandar de más o dejar de mandar.
--
-- ⚠️ Y EL AVANCE DE `proxima_at` VA CON COMPARE-AND-SET, ANTES de mandar. El reclamo
-- atómico que ya existe (`reclamarEspaciado`) se saltea entero cuando el número es 0, y
-- está medido que hoy es 0 en los 108 avisos activos de los 10 workspaces: o sea que
-- hoy nada impide que un reintento de Vercel mande dos veces. Acá la protección es el
-- `.eq('proxima_at', <lo que se acaba de leer>)` del update, que es el mismo
-- `.eq('enviadas', row.enviadas)` de lib/insistencias.ts.
-- =============================================================================

begin;

create table if not exists avisos_programados (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- El id de la plantilla del catálogo (o la custom). No hay FK: el catálogo vive en
  -- código, no en la base.
  aviso_id      text not null,
  -- El cron, ya saneado por `sanearCron` (lib/cron-aviso.ts): unidad, cada, hora,
  -- minuto y el día que corresponda. La base lo guarda como JSON y no lo valida: el
  -- techo vive en el saneo, que es la única puerta.
  cron          jsonb not null,
  -- ⚠️ LA ZONA CON LA QUE SE AGENDÓ, CONGELADA. «A las 9» es la hora de pared de
  -- alguien, y medido el 30/09 seis de los diez workspaces activos no tienen
  -- `mako.timezone` y caen a America/Tijuana. Guardarla acá hace que la pantalla pueda
  -- DECIR con qué zona va a salir en vez de prometer «a la mañana»; y que arreglar la
  -- zona del negocio no mueva sola todos los horarios ya agendados.
  tz            text not null,
  -- Cuándo toca. Es lo que el drenador consulta y lo único que avanza.
  proxima_at    timestamptz not null,
  -- La ocurrencia AGENDADA anterior, que es de donde se calcula la próxima. No es
  -- «cuándo salió»: anclar en el envío real es lo que produce la deriva de siete
  -- minutos por semana que las insistencias ya pagaron.
  anterior_at   timestamptz not null,
  -- Cuándo salió de verdad la última vez. Sólo para mirar, nunca para calcular.
  ultimo_envio_at timestamptz,
  envios        int not null default 0,
  created_at    timestamptz not null default now(),
  -- Un mensaje tiene UN horario. Reprogramarlo es un upsert, no una fila más.
  unique (workspace_id, aviso_id)
);

-- El drenador pregunta siempre lo mismo: qué venció, de quién.
create index if not exists avisos_programados_vencidos on avisos_programados (proxima_at);

comment on table avisos_programados is 'El cron por TIEMPO de un mensaje (mig 0183). Una fila por workspace+aviso; el drenador es /api/cron/avisos-programados.';
comment on column avisos_programados.tz is 'La zona con la que se agendó, CONGELADA: la pantalla la muestra y arreglar la del negocio no mueve los horarios ya puestos.';
comment on column avisos_programados.anterior_at is 'La ocurrencia AGENDADA anterior (no el envío real): es el ancla que evita la deriva.';

-- Igual que insistencias (0180), avisos_cola (0161) y plan_tareas (0093): RLS prendida
-- y CERO policies. Nadie entra con la key anónima; se lee y escribe sólo por
-- getTenantDb, que scopea por workspace.
alter table avisos_programados enable row level security;

commit;
