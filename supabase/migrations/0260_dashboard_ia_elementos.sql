-- =============================================================================
-- 0260 — dashboard_ia_elementos: las cajas «Conclusiones de MaKo» del Dashboard (estado, candado y horario)
-- =============================================================================
-- Pedido de Martín (tanda v5, 12/10/2026, puntos 2 y 8): una caja de texto que MaKo escribe y se actualiza,
-- configurable, como un elemento más del editor. La IA es GRATIS (la cascada del negocio y la red de
-- plataforma); corre al configurarla, a mano (↻) y con un horario opcional, NUNCA al abrir la hoja.
-- El código: lib/graficos-ia-elemento.ts (puro) y lib/graficos-ia-elemento-server.ts; la ruta,
-- app/api/graficos/ia-elemento; el cron que la drena, app/api/cron/dashboard-analisis (el mismo del AI Analyst).
--
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy del Dashboard v5. Es una tabla que el código nuevo YA
-- LEE (la caja pregunta su último texto al dibujarse): sin ella, cada caja dice «No pude leer las conclusiones»
-- y el cron del AI Analyst anota un error por tick. Agrega y no saca nada: la versión desplegada no la mira, así
-- que aplicarla antes no le molesta a nadie.
--
-- ⚠️ EL NÚMERO: 0260 lo reservó el contrato de la tanda para esta tabla (0261 y 0262 son de la misma tanda).
-- Si al integrar alguien ya usó 0260, se RENUMERA antes de pushear y se borra el archivo viejo.
--
-- ⚠️ POR QUÉ UNA TABLA APARTE (y no el texto adentro del informe, ni una columna en dashboard_analisis):
--   1. El navegador reescribe el informe (`graficos.tablero.<sub>`) ENTERO a los 700 ms de cada cambio, y el
--      cron escribiría el texto al mismo tiempo: «dos escritores, dos claves» (AGENTS.md).
--   2. `dashboard_analisis` tiene `unique (workspace_id, usuario, hoja_id)`: no entra una fila por caja, y
--      cambiar ese unique rompe el `upsert … onConflict: 'workspace_id,usuario,hoja_id'` de la versión
--      desplegada (lib/graficos-analisis-server.ts).
--
-- UNA FILA POR (negocio, persona, hoja, pop-up, caja, lo abierto). Es un ESTADO, no un log (el molde es la
-- 0247): la misma fila es el texto que se pinta, el CANDADO contra la corrida doble (`corrida_id`,
-- compare-and-set) y el horario. El último texto BUENO sobrevive a un intento que falla.
--   · `popup_de`: '' = la caja está suelta en la hoja; si no, el id del gráfico en cuyo pop-up vive.
--   · `ref`: '' = la caja lee gráficos; adentro de un pop-up que lee LO QUE SE ABRIÓ, el id de esa cosa (el
--     recording_id de una llamada, el ad_id de un anuncio). Una llamada distinta es otra fila: si no, el pop-up
--     de la llamada B mostraría las conclusiones de la llamada A.
--   (El contrato decía `unique (workspace_id, usuario, hoja_id, elemento_id)`: sin `ref` la frase de arriba
--   pasaba, y sin `popup_de` dos pop-ups con una caja del mismo id —un gráfico duplicado— se pisaban.)
--
-- ⚠️ `entrada` DE UNA CAJA DE LLAMADA GUARDA LO QUE SE DIJO (el transcript de Fathom: decisión 3 de Martín,
-- 12/10/2026, «la IA del pop-up de una llamada PUEDE leer el transcript»). Se guarda para saber qué leyó la IA
-- y NO SALE de esta tabla: la pantalla recibe sólo el texto y las huellas (`vistaDeFilaCaja`), y ninguna ruta
-- con bearer (/api/v1, /api/agente) ni el link compartido leen esta tabla.
--
-- Y VA A `TENANT_TABLES` (lib/workspace.ts) y a `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts): sin lo
-- primero `getTenantDb()` es PASSTHROUGH; sin lo segundo, el reset y el borrado de un negocio la dejan atrás.
-- ⚠️ Verificar en local con dev-login deja filas con usuario='dev': la limpieza se acota a ESE usuario.
-- =============================================================================

begin;

create table if not exists dashboard_ia_elementos (
  id             bigserial primary key,
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  usuario        text not null check (char_length(usuario) between 1 and 80),
  hoja_id        text not null check (char_length(hoja_id) between 1 and 40),
  popup_de       text not null default '' check (char_length(popup_de) <= 40),
  elemento_id    text not null check (char_length(elemento_id) between 1 and 40),
  ref            text not null default '' check (char_length(ref) <= 40),

  -- ── El horario (null = sólo al configurarla y a mano). Sólo las cajas de la hoja: las de un pop-up leen lo
  --    que alguien abrió, y un horario no sabe qué abrir. Ya saneado (`sanearCronAnalisis`): día, semana o mes.
  cron           jsonb,
  -- La zona con la que se programó, CONGELADA (como 0183 y 0247).
  tz             text,
  proxima_at     timestamptz,
  -- La ocurrencia AGENDADA anterior: el ancla de la próxima (anclar en `now()` es la deriva).
  anterior_at    timestamptz,
  -- Qué tablero era el de esa persona, CONGELADO al programar: en un cron no hay sesión para preguntarlo.
  que_tablero    text check (que_tablero in ('dueno', 'cliente')),

  -- ── El último INTENTO (y el candado) ──
  estado         text check (estado in ('corriendo', 'listo', 'error', 'cancelado')),
  fase           text check (fase in ('leyendo', 'escribiendo')),
  corrida_id     text,
  origen         text check (origen in ('manual', 'cron')),
  started_at     timestamptz,
  finished_at    timestamptz,
  error          text check (error is null or char_length(error) <= 600),

  -- ── El último texto que salió BIEN ──
  analizado_at   timestamptz,
  -- La salida YA SANEADA y cortada al largo (`sanearSalidaCaja` / `sanearSalidaEntidad`).
  resultado      jsonb,
  -- Lo que vio el modelo. De gráficos: sin nombres de personas, con las huellas y los nombres reales detrás de
  -- «Closer 1». De una llamada: su análisis y su transcript (ver la cabecera: no sale de acá).
  entrada        jsonb,
  -- El modelo que CONTESTÓ, si la cascada lo informa. null = no medido (nunca el configurado).
  modelo         text,
  corridas       integer not null default 0 check (corridas >= 0),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, usuario, hoja_id, popup_de, elemento_id, ref)
);

-- El cron pregunta siempre lo mismo: qué venció, de quién. Sólo las filas programadas.
create index if not exists dashboard_ia_elementos_vencidos on dashboard_ia_elementos (proxima_at) where cron is not null;
-- El closer lee la caja de la CUENTA (la última que escribió cualquiera): por caja, lo más nuevo primero.
create index if not exists dashboard_ia_elementos_caja on dashboard_ia_elementos (workspace_id, hoja_id, elemento_id, ref, analizado_at desc);

comment on table dashboard_ia_elementos is 'Las cajas «Conclusiones de MaKo» del Dashboard (mig 0260): una fila por negocio+persona+hoja+pop-up+caja+lo abierto. Estado, candado (corrida_id) y horario; el cron es /api/cron/dashboard-analisis.';
comment on column dashboard_ia_elementos.ref is '<vacío> = la caja lee gráficos; si no, el id de lo que se abrió en el pop-up (una fila por llamada o anuncio).';
comment on column dashboard_ia_elementos.entrada is 'Lo que leyó la IA. En una caja de llamada trae el transcript: NO sale de esta tabla (ni a la pantalla, ni por HTTP, ni al link).';

-- Como el resto: RLS prendida y CERO policies, y sin grants para la key pública. Se lee y escribe sólo desde el
-- server (getTenantDb, que scopea por negocio).
alter table dashboard_ia_elementos enable row level security;
revoke all on dashboard_ia_elementos from anon, authenticated;

commit;
