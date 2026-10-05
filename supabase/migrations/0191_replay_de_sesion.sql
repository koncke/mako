-- =============================================================================
-- 0191 — grabación de sesión: el índice en la base, el cuerpo en Storage
-- =============================================================================
-- ORDEN DE DESPLIEGUE: esta migración AGREGA, así que va ANTES o JUNTO con el
-- deploy. Al revés, el receptor escribe en tablas que no existen y PostgREST
-- rechaza la fila entera — el mismo caso de `auto` en `landing_visits` y de
-- `clic_x` en la mig 0190.
--
-- ⚠️ PERO NADA DE ESTO SE PRENDE AL DESPLEGAR. El interruptor vive en
-- `app_settings` con la clave `landing.replay` y su default es APAGADO
-- (`REPLAY_CONFIG_DEFAULT` en lib/replay-contrato.ts). Esta migración no escribe
-- ni una fila de settings a propósito: un sistema que graba a personas no puede
-- quedar encendido porque hubo un deploy. El orden completo es
--   1) esta migración  ·  2) el deploy (apagado en todos)  ·  3) prender UN
--   workspace a mano, con `setSetting('landing.replay', '{"activo":true}')`.
--
-- ⚠️ Y HAY UN CUARTO PASO QUE NO ES OPCIONAL: `replay_sesiones` y `replay_lotes`
-- van a `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts) y el bucket a `BUCKETS`
-- (lib/reset-workspace.ts), DESPUÉS de aplicar esto. No están todavía porque esa
-- lista se midió contra el esquema REAL —nombrar una tabla que no existe es el bug
-- que su propia cabecera documenta— y mientras no estén, un reset del cliente de
-- prueba deja grabaciones de visitantes atrás.
--
-- ⚠️ Y EL CRON ES PARTE DE LA MIGRACIÓN, no un extra. `/api/cron/replay-purga`
-- hace DOS trabajos y sin él las dos cosas crecen para siempre: SELLA (los lotes
-- del buffer caliente nunca se borran solos) y PURGA (la retención de 30 días es
-- una constante que si nadie la aplica no existe). Va en `vercel.json` cada 10
-- minutos. Lo normal es que no haga nada: con el apagador en false no hay filas.
--
-- POR QUÉ DOS TABLAS Y UN BUCKET, con los números medidos el 05/10/2026 sobre
-- septiembre (el mes pico, los cuatro workspaces que miden):
--
--   8.893 visitas · 5.375 minutos grabables con el tope de 10 min por sesión
--   · a ~100 kB/min sin comprimir son 537 MB/mes en crudo, todos los clientes
--   · el plan Pro trae 8 GB de BASE y 100 GB de STORAGE
--
-- O sea que los cuerpos en una tabla se comerían el 7 % de la base ENTERA cada
-- mes, en la misma base donde viven los leads, mientras que en Storage hay doce
-- veces más lugar y el GB sale mucho más barato. Y una sesión sellada es un blob
-- que se escribe una vez y se lee de punta a punta: eso es un archivo.
--
-- Así que:
--   · `replay_lotes`    el buffer CALIENTE. Una fila por lote mientras la
--                       persona está en la página. Se BORRA al sellar.
--   · `replay_sesiones` el ÍNDICE. Una fila por sesión, ~200 bytes, para siempre
--                       (hasta que la purga la borre). Es lo único que se
--                       consulta desde la ficha del lead.
--   · bucket `replays`  el cuerpo: un objeto gzip por sesión.
-- =============================================================================

begin;

-- ── El bucket ───────────────────────────────────────────────────────────────
-- PRIVADO. Una grabación de sesión es lo más sensible que guarda este producto:
-- un objeto público sería la pantalla de un visitante en una URL adivinable.
--
-- `file_size_limit` EXPLÍCITO y alineado con `REPLAY_TOPE_BYTES` (2 MiB): el tope
-- vive en el contrato porque el grabador y el receptor tienen que mirarlo antes
-- de subir, y acá además porque el bucket es la última puerta. Dos números que
-- tienen que decir lo mismo, y el de acá es el que no se puede saltear.
insert into storage.buckets (id, name, public, file_size_limit)
values ('replays', 'replays', false, 2097152)
on conflict (id) do nothing;

-- ⚠️ LA POLICY DE ESTE BUCKET ES NO TENER NINGUNA, y está escrito porque un bucket
-- sin políticas se lee como un bucket al que nadie le puso las reglas. `storage.objects`
-- tiene RLS prendida de fábrica en Supabase: sin una sola política, `anon` y
-- `authenticated` no ven ni listan nada, y el único que entra es el `service_role`
-- —que tiene BYPASSRLS— o sea nuestro server. Agregar una política «para que el
-- cliente vea las suyas» sería abrirle el bucket al navegador: el único camino de
-- lectura es una URL FIRMADA que emite el server después de preguntar de quién es
-- la sesión. Es el mismo criterio de `archivero`, `contratos` y `branding`.
--
-- Y el aislamiento por inquilino lo da el PREFIJO (`<ws>/…`), no una política:
-- el scoping de `getTenantDb()` intercepta `.from()` y NO `.storage`, así que todo
-- lo que borre o firme un objeto tiene que comprobar que la ruta arranque con el
-- workspace en curso. Es el gotcha que ya costó borrar el audio real del dueño
-- desde el cliente de prueba (ver `borrarAudio` en lib/setting-audios.ts).

-- ── 1. El índice de sesiones ────────────────────────────────────────────────
create table if not exists replay_sesiones (
  -- El id lo acuña el navegador (`rs_` + 16-32 de alfabeto de URL). Se valida con
  -- `sesionIdValido` ANTES de armar la ruta de Storage: es lo único que impide
  -- que un id con `../` adentro escriba en la carpeta de otro cliente, porque el
  -- que escribe es el service role y ahí no hay RLS que ataje.
  id            text        not null,
  workspace_id  bigint      not null default 1 references workspaces(id) on delete cascade,

  -- EL ENGANCHE, y es el que hace que la grabación aparezca en la ficha del lead.
  -- Es el MISMO UUID de la cookie `nqe_visitor_id` que ya usan `landing_visits` y
  -- `vsl_events`, sin inventar una identidad nueva: `leads.visitor_id` ya se cose
  -- por Calendly y por el Camino 1 del beacon (app/api/track/vsl/route.ts), así
  -- que el replay se ata al lead sin un solo campo más.
  visitor_id    text        not null,

  -- De qué página. Un negocio puede tener varias (ver landing-config.ts).
  landing_url   text,

  inicio        timestamptz not null default now(),
  -- Segundos GRABADOS, no de reloj de pared. La diferencia no es un detalle: el
  -- promedio de `vsl_events.cierre.segundos` del ws1 es 262 s y la mediana 19, y
  -- el máximo medido es 124.055 s — 34 horas de una pestaña olvidada. Una pestaña
  -- escondida no genera eventos de rrweb, así que lo que se cuenta es lo que el
  -- grabador acumuló mientras había algo que grabar.
  segundos      integer     not null default 0,
  eventos       integer     not null default 0,
  bytes         bigint      not null default 0,

  -- Ruta dentro del bucket: `<ws>/<YYYY-MM-DD>/<sesion>.jsonl.gz` (`rutaDeSesion`).
  -- NULL mientras la sesión no está sellada. El día va en la ruta para que la
  -- purga pueda enumerar por prefijo sin el índice: un objeto cuya fila se perdió
  -- no aparece en ninguna consulta y queda pagándose para siempre.
  storage_path  text,
  sellada_at    timestamptz,

  -- El grabador dijo «terminé» (el lote con `fin: 1`). NO es lo mismo que
  -- `sellada_at`, que es cuando NOSOTROS escribimos el objeto, y la distancia
  -- entre las dos es a propósito: el orden de llegada no está garantizado, así
  -- que sellar en el mismo request que trae el `fin` tira el lote anterior que
  -- todavía venía en camino. El sellado lo hace el cron un par de minutos
  -- después (`/api/cron/replay-purga`), que además es lo que saca el gzip de
  -- 2 MiB del camino caliente de un beacon.
  --
  -- NULL con `sellada_at` también NULL = la persona cerró el navegador de golpe
  -- y el `fin` no salió nunca. Esas son las HUÉRFANAS, y las sella el mismo cron
  -- cuando pasa un rato sin lotes nuevos: sin eso, sus filas de `replay_lotes`
  -- se quedan en el buffer caliente para siempre.
  fin_at        timestamptz,
  -- Por qué dejó de grabar. NULL = la persona se fue, que es lo normal.
  -- 'tiempo'/'bytes' = la cortamos nosotros, y el reproductor TIENE que poder
  -- decirlo: una grabación que termina sin avisar que la cortamos es una
  -- conclusión equivocada servida como dato.
  corte         text        check (corte in ('tiempo', 'bytes')),

  -- ⚠️ POR QUÉ LA TIRAMOS ENTERA, y por qué la fila SOBREVIVE al descarte.
  -- `motivoDeDescarte` tira todo lo que no llega al piso (10 s / 20 eventos): el
  -- 32,4 % de las sesiones del ws1 son rebotes. Lo que NO se puede hacer es
  -- tirarlas sin rastro — «una política puede rechazar, no puede no dejar
  -- rastro»— porque entonces «no llegó nada» y «lo tiramos nosotros» se ven
  -- igual, y nadie puede contestar cuántas grabaciones descarta el piso ni si
  -- está demasiado alto. Lo caro de una sesión es el OBJETO y sus lotes, no esta
  -- fila de ~200 B: la fila queda con `descarte` puesto, `storage_path` en NULL
  -- y sus lotes borrados. A 2.900 rebotes por mes son ~580 kB.
  --   'corta' = no llegó a REPLAY_PISO_SEGUNDOS · 'vacia' = ni a los eventos.
  descarte      text        check (descarte in ('corta', 'vacia')),
  -- Cuántos lotes se rechazaron DESPUÉS de cortarla (por el tope, o por llegar
  -- tarde a una sesión ya sellada). Es el contador que dice si el tope de 10 min
  -- quedó corto: una sesión con `corte='tiempo'` y 200 descartados es alguien que
  -- siguió usando la página media hora. Sin esto, el exceso se descarta en
  -- silencio y el tope no se puede auditar.
  descartados   integer     not null default 0,

  -- Versión del protocolo del lote y marcador de prueba (`?mko_test=`), igual que
  -- en el resto del tracking. NULL en el tráfico real.
  v             integer,
  prueba        text,

  primary key (workspace_id, id)
);

alter table replay_sesiones enable row level security;   -- sin políticas: sólo service_role
revoke all on replay_sesiones from anon, authenticated;

-- La lectura es «las sesiones de ESTE visitante», que es la de la ficha del lead.
create index if not exists replay_sesiones_visitor_idx
  on replay_sesiones (workspace_id, visitor_id, inicio desc);

-- La de la purga: «lo más viejo que X, de este workspace».
--
-- ⚠️ NO ES PARCIAL, y la versión parcial (`where storage_path is not null`) era
-- un agujero: la purga no sólo borra lo sellado. Tiene que encontrar también las
-- sesiones HUÉRFANAS —`storage_path` NULL porque el `fin` nunca llegó— que son
-- justo las que dejan filas en el buffer caliente para siempre, y las
-- descartadas por el piso, que tampoco tienen objeto. Un índice que sólo ve lo
-- sellado deja afuera las dos cosas que de verdad crecen sin techo.
create index if not exists replay_sesiones_purga_idx
  on replay_sesiones (workspace_id, inicio);

-- La del SELLADOR: «¿qué sesión de este workspace hay que cerrar?». Parcial sobre
-- lo que todavía no se cerró de ninguna de las dos formas, que en régimen son un
-- puñado de filas — el índice cuesta nada y la consulta corre cada 10 minutos.
create index if not exists replay_sesiones_sellar_idx
  on replay_sesiones (workspace_id, inicio)
  where sellada_at is null and descarte is null;

comment on table replay_sesiones is
  'Índice de grabaciones de sesión (rrweb). El CUERPO vive en el bucket privado `replays`, no acá: 537 MB/mes de blobs se comerían el 7% de los 8 GB de base del plan Pro cada mes, y Storage trae 100 GB. Se ata al lead por visitor_id, el mismo UUID de la cookie nqe_visitor_id que ya usan landing_visits y vsl_events.';
comment on column replay_sesiones.segundos is
  'Segundos GRABADOS, no de reloj de pared. Una pestaña escondida no genera eventos: el máximo de reloj medido en vsl_events es de 34 horas y no tiene nada para mirar.';
comment on column replay_sesiones.corte is
  'tiempo/bytes = la grabación la cortamos NOSOTROS al llegar al tope. NULL = la persona se fue. El reproductor tiene que distinguirlos, o afirma un abandono que no pasó.';
comment on column replay_sesiones.storage_path is
  'Ruta en el bucket `replays`: <ws>/<YYYY-MM-DD>/<sesion>.jsonl.gz. NULL = todavía no sellada. El día va adentro para poder purgar por prefijo sin leer esta tabla.';
comment on column replay_sesiones.fin_at is
  'El grabador avisó que terminó. Distinto de sellada_at: el orden de llegada no está garantizado, así que sellar en el request del `fin` tira el lote anterior que venía en camino. El cron sella un par de minutos después. Las dos en NULL = huérfana (el navegador se cerró de golpe) y la sella el mismo cron por inactividad.';
comment on column replay_sesiones.descarte is
  'La tiramos por el piso (10 s / 20 eventos): corta o vacía. La FILA sobrevive al descarte a propósito — sin ella, «no llegó nada» y «lo tiramos nosotros» se ven igual y nadie puede auditar el piso. Lo caro es el objeto y los lotes, no estos 200 B.';
comment on column replay_sesiones.descartados is
  'Lotes rechazados DESPUÉS de cortar la sesión (por el tope, o por llegar tarde a una ya sellada). Es lo que dice si el tope de 10 min quedó corto; sin el contador, el exceso se descarta en silencio.';

-- ── 2. El buffer caliente ───────────────────────────────────────────────────
-- Vive minutos. Al sellar, estas filas se BORRAN y queda el objeto en Storage.
create table if not exists replay_lotes (
  workspace_id  bigint      not null default 1 references workspaces(id) on delete cascade,
  sesion_id     text        not null,

  -- ⚠️ EL ORDEN NO SE DEDUCE DE LA LLEGADA, y por eso `n` es parte de la clave.
  -- Un POST con `keepalive` y un `sendBeacon` salen sin esperar respuesta y el
  -- navegador los entrega cuando puede: el último lote puede llegar antes que el
  -- anterior. El reproductor necesita el flujo EN ORDEN y `created_at` no lo dice.
  n             integer     not null,

  -- Los eventos de rrweb. `bytea` y no `text`: el grabador puede comprimirlos con
  -- `CompressionStream('gzip')` en el navegador —lo que ahorra el subida del
  -- visitante, que es el único tráfico que se siente en un celular— y guardar un
  -- binario como texto lo infla un 33 % en base64.
  cuerpo        bytea       not null,
  -- 1 = `cuerpo` viene gzip. Se guarda lo que llegó: el servidor NUNCA adivina.
  z             smallint    not null default 0 check (z in (0, 1)),

  ms            integer     not null default 0,
  created_at    timestamptz not null default now(),

  -- La clave es (ws, sesión, n): el reintento de un mismo lote no duplica, y dos
  -- lotes distintos de la misma sesión no se pisan. Idempotencia en la punta que
  -- recibe, que es la única que puede garantizarla.
  primary key (workspace_id, sesion_id, n)
);

alter table replay_lotes enable row level security;   -- sin políticas: sólo service_role
revoke all on replay_lotes from anon, authenticated;

-- La del sellador: «los lotes de esta sesión, en orden» la da la primary key.
-- Esta otra es la del barrido de huérfanos: una sesión que nunca mandó su último
-- lote (la persona cerró el navegador de golpe) deja filas acá para siempre si
-- nadie las busca por fecha.
create index if not exists replay_lotes_viejos_idx
  on replay_lotes (created_at);

comment on table replay_lotes is
  'Buffer CALIENTE de la grabación: una fila por lote mientras la persona está en la página. Al sellar la sesión se comprime todo junto a un objeto del bucket `replays` y estas filas se BORRAN. Vive minutos, no días.';
comment on column replay_lotes.n is
  'Número de lote dentro de la sesión, desde 0. Es parte de la clave porque el orden NO se deduce de la llegada: sendBeacon y fetch(keepalive) salen sin esperar respuesta y el navegador los entrega cuando puede.';
comment on column replay_lotes.z is
  '1 = cuerpo gzip desde el navegador (CompressionStream). Se guarda lo que llegó; el servidor no adivina la codificación.';

commit;

notify pgrst, 'reload schema';
