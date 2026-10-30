-- =============================================================================
-- 0355_operaciones_runner_visto — «hay noticias de la PC» no es «hay un Runner que entrega» (30/10/2026)
-- =============================================================================
-- El servicio de la PC (cartero 1.25.0) sube cada 2 minutos sin ningún chat abierto. Hasta acá, `visto_at` lo escribía sólo un Runner, y
-- todo el Ops Center lo lee como «hay Runner». Con el servicio diría «Activo» justo cuando no hay nadie que entregue
-- (docs/diseno-cartero-servicio.md §2.6).
--
--   · `visto_at` sigue diciendo que llegó algo, de quien sea.
--   · `runner_visto_at`: la última vuelta de un Runner. Sólo la escribe una vuelta sin `servicio`.
--   · `servicio`: lo que dijo de sí mismo el servicio en su última vuelta ({ version, desde, visto_at }).
--
-- Lo que ya existe arranca con `runner_visto_at = visto_at`: hasta hoy, todo lo que escribió `visto_at` fue un Runner. Sólo agrega.
--
-- ⚠️ ORDEN: el código nuevo anda sin esta migración, leyendo `visto_at` para las dos preguntas (lib/operaciones.ts). Pero
-- `cartero.mjs instalar-servicio` va DESPUÉS de esta migración y de su deploy: sin ellas, el Ops Center diría «Activo» sin ningún Runner.
-- Idempotente.

begin;

alter table operaciones_carteros
  add column if not exists runner_visto_at timestamptz,
  add column if not exists servicio        jsonb;

update operaciones_carteros set runner_visto_at = visto_at where runner_visto_at is null and visto_at is not null;

comment on column operaciones_carteros.visto_at is 'La última vuelta de la PC, de un Runner o del servicio (mig 0355): «¿hay noticias de la PC?».';
comment on column operaciones_carteros.runner_visto_at is 'La última vuelta de un Runner (mig 0355): «¿hay quien entregue?». Una vuelta del servicio no la toca.';
comment on column operaciones_carteros.servicio is 'Lo que dijo de sí mismo el servicio de la PC en su última vuelta: { version, desde, visto_at } (mig 0355). No es la versión del Runner.';

commit;
