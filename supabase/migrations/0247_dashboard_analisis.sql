-- =============================================================================
-- 0247 — dashboard_analisis: el «AI Analyst» del Dashboard (estado, candado y horario)
-- =============================================================================
-- Pedido de Martín (11/10/2026), punto 23: «agrega un botón en la topbar del editable que sea "AI
-- Analyst", que justamente sea MaKo analizando ese o esos gráficos... Y que se pueda configurar CRON
-- para que lo analice cada X tiempo, o cuando se le da a actualizar análisis».
--
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy que trae app/api/graficos/analisis y
-- app/api/cron/dashboard-analisis. Es una tabla que el código nuevo YA LEE: sin ella, el panel dice
-- que no pudo leer el análisis y el botón «Actualizar análisis» contesta un 500. Agrega y no saca
-- nada: la versión desplegada no la mira, así que aplicarla antes no le molesta a nadie.
--
-- ⚠️ El número: 0246 lo tiene tomado `0246_editor_landing.sql` en el worktree del editor de landing
-- (wt-gamma, sin commitear el 11/10/2026). Si al integrar alguien ya usó 0247, se RENUMERA antes de
-- pushear y se borra el archivo viejo.
--
-- ⚠️ POR QUÉ UNA TABLA Y NO `app_settings` (donde vive el informe, `graficos.tablero.<sub>`):
--   1. El navegador reescribe ese informe ENTERO a los 700 ms de cada cambio, y el cron escribiría el
--      análisis al mismo tiempo: «dos escritores, dos claves» (AGENTS.md). Pisarse es perder el
--      análisis o, peor, el informe.
--   2. El cron tiene que preguntar QUÉ VENCIÓ entre todos los negocios en UNA consulta (por
--      `proxima_at`), y eso sólo se puede con una columna indexada.
--
-- UNA FILA POR (negocio, persona, hoja): es un ESTADO, no un log —como closing_jobs—. La misma fila es
-- el estado que se pinta, el CANDADO contra la corrida doble (`corrida_id`, compare-and-set) y el
-- horario. El último análisis BUENO (`resultado`, `entrada`, `analizado_at`) sobrevive a un intento que
-- falla: `estado` y `error` hablan del último INTENTO.
--
-- `usuario` es el `sub` de la sesión, el mismo que la clave del informe (`graficos.tablero.<sub>`):
-- el análisis programado corre con el informe GUARDADO de esa persona. ⚠️ Verificar en local con
-- dev-login deja filas con usuario='dev': la limpieza se acota a ESE usuario, nunca a un prefijo.
--
-- ⚠️ Y VA A `TENANT_TABLES` (lib/workspace.ts) y a `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts):
-- sin lo primero `getTenantDb()` es PASSTHROUGH (leería el análisis de cualquier negocio); sin lo
-- segundo, el reset y el borrado de un negocio la dejan atrás.
-- =============================================================================

begin;

create table if not exists dashboard_analisis (
  id             bigserial primary key,
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  usuario        text not null check (char_length(usuario) between 1 and 80),
  hoja_id        text not null check (char_length(hoja_id) between 1 and 40),
  -- Qué gráficos se analizan: null = toda la hoja (los que tenga en el momento de correr).
  componentes    text[],

  -- ── El horario (null = sólo a mano) ──
  -- Ya saneado por `sanearCronAnalisis` (lib/graficos-analisis.ts): día, semana o mes. «Cada hora» no
  -- se acepta: la cuota gratis de Gemini son 250 pedidos por día y por key, compartidos con todo MaKo.
  cron           jsonb,
  -- ⚠️ LA ZONA CON LA QUE SE PROGRAMÓ, CONGELADA (`tzDeWorkspace` al guardar, como 0183): la pantalla
  -- la DICE, y arreglar la zona del negocio no mueve sola los horarios ya puestos.
  tz             text,
  -- Cuándo toca. Lo único que el cron consulta, y lo que avanza con compare-and-set ANTES del trabajo.
  proxima_at     timestamptz,
  -- La ocurrencia AGENDADA anterior: el ancla de la próxima (anclar en `now()` es la deriva).
  anterior_at    timestamptz,
  -- ⚠️ Qué tablero era el de esa persona, CONGELADO al programar. En un cron no hay sesión, y
  -- `tableroActual()` contesta 'cliente' para todos: el conjunto «Tareas del Plan» del super admin
  -- leería experimento_tareas (cero filas, sin un error) en vez de plan_tareas.
  que_tablero    text check (que_tablero in ('dueno', 'cliente')),

  -- ── El último INTENTO (y el candado) ──
  estado         text check (estado in ('corriendo', 'listo', 'error', 'cancelado')),
  -- Lo que está haciendo mientras corre: el «progreso real» que exige el estado «Revisando».
  fase           text check (fase in ('leyendo', 'escribiendo')),
  -- El token de la corrida viva. Tomar la corrida es un update `.eq('corrida_id', <el que se leyó>)`;
  -- cerrarla, un update `.eq('corrida_id', <el propio>)`. Cancelar lo borra, y con eso la corrida que
  -- sigue por detrás ya no puede escribir su resultado.
  corrida_id     text,
  origen         text check (origen in ('manual', 'cron')),
  started_at     timestamptz,
  finished_at    timestamptz,
  error          text check (error is null or char_length(error) <= 600),

  -- ── El último análisis que salió BIEN ──
  analizado_at   timestamptz,
  -- La salida YA SANEADA (`sanearSalida`): resumen, hallazgos anclados, recomendaciones y descartes.
  resultado      jsonb,
  -- Lo que vio el modelo (sin nombres de personas), y lo que NO viaja: la firma de cada gráfico, su
  -- período, los formatos y los nombres reales detrás de «Closer 1» (para la pantalla).
  entrada        jsonb,
  -- El modelo que CONTESTÓ, si la cascada lo informa. null = no medido (nunca el configurado).
  modelo         text,
  -- Cuándo vio la persona el último análisis: el punto «nuevo» del botón es analizado_at > visto_at.
  visto_at       timestamptz,
  corridas       integer not null default 0 check (corridas >= 0),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, usuario, hoja_id)
);

-- El cron pregunta siempre lo mismo: qué venció, de quién. Sólo las filas programadas.
create index if not exists dashboard_analisis_vencidos on dashboard_analisis (proxima_at) where cron is not null;

comment on table dashboard_analisis is 'AI Analyst del Dashboard (mig 0247): una fila por negocio+persona+hoja. Estado, candado (corrida_id) y horario; el cron es /api/cron/dashboard-analisis.';
comment on column dashboard_analisis.tz is 'La zona con la que se programó, CONGELADA: la pantalla la muestra.';
comment on column dashboard_analisis.anterior_at is 'La ocurrencia AGENDADA anterior (no el momento en que corrió): el ancla que evita la deriva.';
comment on column dashboard_analisis.que_tablero is 'El tablero de esa persona al programar (dueno|cliente): en el cron no hay sesión para preguntarlo.';

-- Como el resto: RLS prendida y CERO policies, y sin grants para la key pública. Se lee y escribe sólo
-- desde el server (getTenantDb, que scopea por negocio).
alter table dashboard_analisis enable row level security;
revoke all on dashboard_analisis from anon, authenticated;

commit;
