-- =============================================================================
-- 0228_hilos_paralelos — varias flechas desde una tarjeta (y desde el CRON) que corren A LA VEZ
-- =============================================================================
-- Pedido de Martín (08/10/2026, noche, punto 2): «Del CRON inicial debería poder sacar varias
-- flechas... En realidad de varias tarjetas debería poder sacar varias flechas... Por ejemplo,
-- de un mismo cron puedo sacar todo una secuencia para WhatsApp y toda otra secuencia de
-- email». El modelo (el campo `paralelos` de un paso y el nodo `inicio`) vive en
-- lib/flujo-grafo.ts; el contrato, en docs/chatbot-flujo-ramas-diseno.md → «SEGUNDA TANDA».
--
-- El motor lleva los HILOS de un lead en UNA inscripción (decisión 3 del diseño):
--
--  · `nutricion_inscripciones.hilos` — NULL = un solo cursor, como siempre
--    (`paso_actual`/`nodo_actual`/`proximo_envio_at`): los 6 flujos vigentes nunca entran al modo
--    hilos. Con flechas en paralelo: `[{ h, nodo, proximo }]`, los hilos VIVOS (`h` = 'p' para
--    el principal, o el id de la primera tarjeta del hilo). Las columnas de siempre RESUMEN el
--    hilo que vence primero, así la cola de `procesarEnvios` y su índice no cambian.
--  · `nutricion_inscripciones.hilos_rev` — el compare-and-set de `hilos`: cada escritura lo sube
--    en 1 y exige el que leyó. Sin esto, dos vueltas sobre la misma inscripción pisaban el array
--    entero y un hilo se perdía (o se duplicaba) sin error.
--
-- Se descartó una fila por hilo: rompe 12 lectores que cuentan «una fila = un lead en una
-- secuencia» (las métricas, el UNIQUE (lead_id, secuencia_id) de la 0034, los `.maybeSingle()`
-- de la respuesta y de `encadenar`). Y una tabla hija: dos tablas que tienen que quedar
-- coherentes sin transacciones.
--
-- SIN BACKFILL: medido el 08/10/2026, 0 inscripciones activas en toda la base. NULL ES el modo
-- de siempre, así que las filas que ya están no necesitan nada.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY. La cola de `procesarEnvios` pasa a LEER `hilos,
-- hilos_rev`, y PostgREST rechaza la consulta ENTERA si falta una columna: con el deploy
-- adelantado, el cron de nutrición falla en cada corrida antes de mandar nada (falla cerrado: no
-- se duplica ningún mensaje, pero no sale ninguno).
-- =============================================================================

begin;

alter table nutricion_inscripciones
  add column if not exists hilos jsonb,
  add column if not exists hilos_rev integer not null default 0;

-- El CHECK va aparte y con nombre: `add column if not exists … check` no lo agrega si la
-- columna ya existía (un no-op silencioso que deja creyendo que la restricción está; la 0203).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nutricion_inscripciones_hilos_chk') then
    alter table nutricion_inscripciones add constraint nutricion_inscripciones_hilos_chk
      check (hilos is null or jsonb_typeof(hilos) = 'array');
  end if;
end $$;

comment on column nutricion_inscripciones.hilos is
  'NULL = un solo cursor (paso_actual/nodo_actual/proximo_envio_at), como siempre. Con flechas en paralelo: [{h, nodo, proximo}], los hilos vivos (h = ''p'' o el id de la primera tarjeta del hilo); las columnas de siempre resumen el hilo que vence primero.';
comment on column nutricion_inscripciones.hilos_rev is
  'Compare-and-set de hilos: cada escritura lo sube en 1 y exige el valor que leyó.';

commit;
