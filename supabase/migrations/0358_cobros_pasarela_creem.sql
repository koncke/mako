-- =============================================================================
-- 0358 — la tercera pasarela: dejar entrar 'creem' en los CHECK de proveedor
-- =============================================================================
-- ORDEN DE DESPLIEGUE: va ANTES del deploy. Sólo ENSANCHA tres CHECK (ninguna fila existente puede violar un
-- check más permisivo) y no agrega, saca ni renombra columnas, así que la versión desplegada hoy sigue
-- funcionando igual: para ella 'creem' simplemente no existe todavía.
--
-- EL SÍNTOMA que esto evita. `lib/cobros-tipos.ts` pasa a tener tres pasarelas ('stripe' | 'mercadopago' |
-- 'creem'), pero el proveedor de un cobro está limitado por SQL a los dos viejos. Sin esta migración, todo el
-- camino de Creem compila, pasa los tests y se cae recién contra la base, con un 23514 (violación de check) en
-- el INSERT — o sea en el momento en que una persona ya está mirando el checkout.
--
-- Y EL PEOR DE LOS TRES es el que no parece importante: `pasarela_eventos` es la DEDUPLICACIÓN de los avisos
-- (único por `(proveedor, evento_id)`). Si ese check no deja entrar 'creem', el webhook no puede ni dejar su
-- rastro: `reclamarEvento` tira antes de aplicar nada, el webhook contesta error, Creem reintenta (5 intentos:
-- 30 s, 5 min, 30 min, 6 h) y después abandona. El pago quedó cobrado en Creem y nunca entró a MaKo.
--
-- LOS NOMBRES DE LOS CONSTRAINTS. En 0255 los tres están escritos INLINE en la columna, así que no los nombró
-- nadie: los nombró Postgres con su convención `<tabla>_<columna>_check`. Por eso el `drop constraint` va con
-- `if exists` y el nombre derivado — si una base vieja los tuviera con otro nombre, el drop no encuentra nada,
-- el add falla por duplicado y la migración se detiene en vez de dejar el check viejo puesto en silencio.
--
-- Fuente de los tres: supabase/migrations/0255_cobros_pasarela.sql líneas 49, 95 y 115.

-- 1. cobros.proveedor — con qué pasarela se pidió este cobro.
alter table cobros drop constraint if exists cobros_proveedor_check;
alter table cobros add constraint cobros_proveedor_check
  check (proveedor in ('stripe', 'mercadopago', 'creem'));

-- 2. pasarela_eventos.proveedor — el rastro y la deduplicación de los avisos. Ver arriba por qué es el crítico.
alter table pasarela_eventos drop constraint if exists pasarela_eventos_proveedor_check;
alter table pasarela_eventos add constraint pasarela_eventos_proveedor_check
  check (proveedor in ('stripe', 'mercadopago', 'creem'));

-- 3. pagos.proveedor — la cuota del CRM que saldó un cobro de la pasarela. Sigue aceptando null (una cuota
--    cargada a mano no tiene proveedor), como en 0255.
alter table pagos drop constraint if exists pagos_proveedor_check;
alter table pagos add constraint pagos_proveedor_check
  check (proveedor is null or proveedor in ('stripe', 'mercadopago', 'creem'));
