-- =============================================================================
-- 0145 — La cola de Google Flow, y el emparejamiento del navegador del cliente
-- =============================================================================
-- Flow no tiene API pública: lo único que autoriza una llamada es el bearer que
-- la propia web manda desde una sesión iniciada. Así que el que genera no es
-- Vercel — es el NAVEGADOR DEL CLIENTE, con su cuenta de Google y sus créditos.
--
-- Eso cambia la economía del producto: los medios dejan de salir del presupuesto
-- de MaKo (el 90% del costo del plan Growth) y pasan a la suscripción que el
-- cliente ya paga. Y cambia el aislamiento: no hay una cuenta central que se
-- queme, porque cada workspace corre sobre la suya.
--
-- MaKo no puede empujarle trabajo a un navegador, así que el navegador VIENE A
-- BUSCARLO: la extensión hace polling de esta cola con un token de
-- emparejamiento, ejecuta contra Google y devuelve el resultado por acá.
--
-- ⚠️ El bearer de Google NO SE GUARDA en esta base, ni en ninguna. Vive en la
-- extensión, en la máquina del cliente, y muere ahí. Lo único que viaja es el
-- resultado. Guardar un token de sesión de Google de un tercero sería asumir una
-- custodia que no hace falta para nada.
begin;

-- ── El emparejamiento ────────────────────────────────────────────────────────
-- Una fila por workspace. El `token` es lo que el cliente copia UNA vez de la
-- pantalla de MaKo a la extensión, y es lo que autentica el polling.

create table if not exists flow_puentes (
  workspace_id  bigint not null primary key,

  -- Secreto de emparejamiento. Se guarda HASHEADO (sha256 en hex): si la base se
  -- filtra, no alcanza para hacerse pasar por el navegador de un cliente. Es el
  -- mismo criterio que cualquier api key propia.
  token_hash    text not null,

  -- Para que la pantalla pueda decir «el navegador de Martín, visto hace 3 min»
  -- sin exponer el token.
  etiqueta      text not null default '',
  ultimo_visto  timestamptz,

  -- El proyecto de Flow contra el que se generan los medios. Sale del navegador
  -- la primera vez que se empareja: es de la cuenta del cliente, no nuestro.
  project_id    text not null default '',

  -- Estado de la sesión tal como lo reporta el puente. `marcada` es el que
  -- importa: cuando Google devuelve PUBLIC_ERROR_UNUSUAL_ACTIVITY hay que PARAR,
  -- no reintentar, y la pantalla tiene que poder decirlo.
  estado        text not null default 'sin_conectar'
                check (estado in ('sin_conectar', 'listo', 'sin_sesion', 'marcada')),
  estado_detalle text not null default '',

  created_at    timestamptz not null default now()
);

-- ── La cola ──────────────────────────────────────────────────────────────────

create table if not exists flow_trabajos (
  id            bigserial primary key,
  workspace_id  bigint not null,

  -- Qué hay que hacer. Se mantiene chico a propósito: cada tipo nuevo es una
  -- rama nueva en la extensión, que es lo más caro de actualizar.
  tipo          text not null check (tipo in ('subir_imagen', 'generar_clip', 'estado_clips', 'creditos')),

  -- El cuerpo del pedido, ya armado por lib/flow.ts. La extensión NO decide
  -- nada del payload: solo le pega el bearer y el captcha y lo manda. Cuanto
  -- menos lógica viva en la extensión, menos veces hay que pedirle al cliente
  -- que la actualice.
  pedido        jsonb not null default '{}'::jsonb,

  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'tomado', 'listo', 'fallido')),

  -- El resultado tal como lo devolvió Google, ya saneado por el server.
  resultado     jsonb,

  -- Clasificado por `clasificarFalla` de lib/flow-protocolo.ts, no texto libre:
  -- es lo que decide si se reintenta.
  motivo        text not null default '',
  error         text not null default '',

  intentos      int not null default 0,

  -- ⚠️ Lo que Google genera VENCE en ~1 hora en su storage. Esta columna existe
  -- para que se vea de un vistazo lo que se perdió por no bajarlo a tiempo: una
  -- URL guardada como permanente es una URL que va a dar 404 sin avisar.
  medio_guardado boolean not null default false,

  -- Para el orden de la cola y para saber si un `tomado` quedó colgado (el
  -- navegador se cerró a mitad): sin esto, un trabajo tomado bloquea la cola
  -- para siempre.
  tomado_at     timestamptz,
  created_at    timestamptz not null default now(),
  listo_at      timestamptz
);

-- El polling de la extensión pregunta siempre lo mismo: dame los pendientes de
-- este workspace, más viejo primero.
create index if not exists flow_trabajos_cola on flow_trabajos (workspace_id, estado, created_at);
-- Para reencolar los que quedaron tomados y nadie devolvió.
create index if not exists flow_trabajos_colgados on flow_trabajos (estado, tomado_at) where estado = 'tomado';

-- RLS prendida y CERO policies, igual que plan_tareas (0093) y plan_reprios
-- (0144): nadie entra con la key anónima. Se lee y se escribe solo por
-- `getTenantDb`, que scopea por workspace. Una tabla nueva sin esto es
-- exactamente cómo este repo dejó 15 tablas abiertas a `anon` una vez.
alter table flow_puentes enable row level security;
alter table flow_trabajos enable row level security;

comment on table flow_puentes is 'El navegador de cada cliente que sostiene la sesión de Google Flow. El bearer NO se guarda acá: vive en la extensión, en su máquina (mig 0145).';
comment on column flow_puentes.token_hash is 'sha256 hex del token de emparejamiento. El token en claro se muestra UNA vez al crearlo y no se vuelve a poder leer.';
comment on column flow_puentes.estado is 'marcada = Google devolvió PUBLIC_ERROR_UNUSUAL_ACTIVITY. Hay que PARAR de generar, no reintentar.';
comment on table flow_trabajos is 'Cola de trabajo para el navegador del cliente: MaKo no puede empujarle nada, así que el puente viene a buscarlo (mig 0145).';
comment on column flow_trabajos.medio_guardado is 'Lo que genera Google vence en ~1 h. false con listo_at viejo = medio perdido.';

commit;

notify pgrst, 'reload schema';
