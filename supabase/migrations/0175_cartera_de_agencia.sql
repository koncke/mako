-- =============================================================================
-- 0175 — La cartera de una agencia: qué clientes puede mirar, y quién lo aprobó
-- =============================================================================
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. Es una tabla que el
-- código nuevo YA LEE en cada request de una sesión de agencia: sin ella,
-- `carteraAprobada()` recibe un error de PostgREST y la agencia queda afuera de
-- todo. Eso es fail-closed y por lo tanto no es grave — pero deja a Juanfran
-- mirando su propia cuenta con cara de la del cliente, que es el modo de falla
-- que esta feature entera existe para evitar. Se aplica primero.
--
-- ⚠️ POR QUÉ UNA TABLA Y NO UNA COLUMNA EN `workspaces`.
--
-- La forma barata era `workspaces.agencia_ws`. No sirve, y no por purismo:
--
--   1. La aprobación del super-admin NO es un atributo del cliente, es un ACTO
--      con autor y fecha. En una columna no entra quién aprobó ni cuándo, y eso
--      es justo lo único que después contesta «¿por qué esta agencia ve esto?».
--   2. `workspaces` está FUERA de TENANT_TABLES a propósito (lib/workspace.ts),
--      así que no la scopea `getTenantDb`. Una columna ahí nace sin red igual,
--      pero además queda mezclada con la fila que TODA la app lee — y cualquier
--      `select *` sobre workspaces empezaría a repartir el mapa de quién mira a
--      quién.
--   3. Una relación N:N es lo que el negocio ya es: un cliente puede haber sido
--      traído por una agencia y seguir siendo cliente directo de MaKo. Con una
--      columna, eso se modela pisando el valor.
--
-- ⚠️ Y `estado: 'pausado'` DE WORKSPACES NO SIRVE COMO «PENDIENTE», que era la
-- otra tentación barata. Medido el 27/09/2026: `workspaces.estado` no bloquea el
-- acceso a NADA — sus únicos lectores son cuatro crons (cron-workspaces.ts:91,
-- crm-auto.ts:94 y :464, avisos-cola.ts:70) y la UI de /admin —, y la columna ni
-- siquiera tiene CHECK. Un workspace «pausado» entra y opera normalmente. El
-- estado de la APROBACIÓN vive acá, donde el guard lo lee.

create table if not exists agencia_clientes (
  -- El workspace de la AGENCIA (quien mira). Hoy: Código Inmobiliario, ws 13.
  agencia_ws   bigint      not null references workspaces(id) on delete cascade,
  -- El workspace del CLIENTE de esa agencia (a quién mira).
  cliente_ws   bigint      not null references workspaces(id) on delete cascade,

  -- ⚠️ EL GUARD SE ESCRIBE EN POSITIVO (AGENTS.md). Lo que habilita es que HAYA
  -- una fila en 'aprobado', nunca «cualquiera menos el 1 y el 9». Un cliente
  -- nuevo que cree el super-admin no entra solo en ninguna cartera: entra en
  -- ninguna, que es el default correcto. El precedente que lo paga es el Reset,
  -- que decía `ws !== OWNER_WS` en tres capas y se ofrecía adentro de TODOS los
  -- clientes reales.
  --
  -- 'revocado' existe y no se borra la fila: sacar el acceso es un hecho que
  -- alguien va a querer auditar, y una fila borrada no cuenta nada.
  estado       text        not null default 'pendiente'
                 check (estado in ('pendiente', 'aprobado', 'revocado')),

  -- Quién lo decidió. Es el email del super-admin, no un id: los usuarios se dan
  -- de baja y la decisión queda igual.
  decidido_por text,
  decidido_at  timestamptz,
  -- Por qué. Opcional, y sirve sobre todo para el 'revocado'.
  motivo       text,

  created_at   timestamptz not null default now(),

  primary key (agencia_ws, cliente_ws),

  -- Una agencia no se mira a sí misma por este camino: su propio workspace ya lo
  -- resuelve `sesion.ws`. Sin esto, una fila (13, 13) aprobada haría que el
  -- «Entrar como» compitiera con la resolución normal y que el cartel de «estás
  -- viendo a otro» se dibujara sobre la cuenta propia.
  constraint agencia_no_es_su_propio_cliente check (agencia_ws <> cliente_ws)
);

comment on table agencia_clientes is
  'Qué clientes puede mirar una agencia, y quién lo aprobó. Es la lista blanca en POSITIVO que lee el guard: sin fila en estado=aprobado, la agencia no entra. Ver docs/hallazgos-seguridad.md → «Vista de agencia».';

-- El índice que usa el guard: «de esta agencia, ¿cuáles tengo aprobados?». La PK
-- ya cubre (agencia_ws, cliente_ws), así que el lookup puntual sale por ahí; éste
-- es para la LISTA, que es lo que dibuja la pantalla.
create index if not exists agencia_clientes_agencia_estado
  on agencia_clientes (agencia_ws, estado);

-- Y el inverso: «¿de quién es este cliente?», que es lo que pregunta /admin al
-- mostrar una aprobación pendiente sobre la fila de un workspace.
create index if not exists agencia_clientes_cliente
  on agencia_clientes (cliente_ws);

-- ⚠️ RLS + REVOKE, como toda tabla nueva. El server lee con `service_role`, que
-- tiene BYPASSRLS, así que esto no le cambia nada; lo que cierra es que `anon`
-- pueda leer el mapa de quién mira a quién. Y el revoke va explícito porque el
-- grant que llega depende de QUIÉN aplique el DDL (medido el 26/09: las vistas
-- viejas quedaron con anon=arwdDxtm).
alter table agencia_clientes enable row level security;
revoke all on agencia_clientes from anon, authenticated;

-- ── El puente del CRM al producto ───────────────────────────────────────────
-- Un lead ganado NO tiene workspace, y ésa es la razón por la que «Entrar como»
-- no se podía poner en la ficha de /customer-success: esa pantalla lista LEADS
-- (estado_lead='ganado', lib/clientes-ganados.ts) y /admin lista WORKSPACES, que
-- son dos universos que no se cruzaban por ningún lado.
--
-- ⚠️ ES UN PUNTERO CROSS-TENANT, y por eso no alcanza con que exista: la fila del
-- lead vive en el workspace de la agencia y apunta a OTRO workspace. Quien lo lea
-- para decidir un acceso tiene que volver a preguntarle a `agencia_clientes` —
-- esta columna dice «a qué cuenta corresponde este cliente», NUNCA «esta agencia
-- puede entrar ahí». Son dos preguntas, y meterlas en un campo es cómo la más
-- débil se lleva puesta a la otra.
alter table leads add column if not exists cliente_ws bigint references workspaces(id);

comment on column leads.cliente_ws is
  'El workspace de MaKo de este cliente ganado, si tiene cuenta. Es un puntero para la pantalla, NO un permiso: el permiso lo contesta agencia_clientes.';

create index if not exists leads_cliente_ws on leads (cliente_ws) where cliente_ws is not null;
