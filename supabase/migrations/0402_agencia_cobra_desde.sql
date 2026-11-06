-- =============================================================================
-- 0402 — agencia_clientes.cobra_desde: corregir desde qué día corren los 14 días sin costo de un cliente de agencia
-- =============================================================================
-- El acuerdo con Código Inmobiliario (30/10/2026, la mensualidad de lib/agencia-mes-reglas.ts): desde que la agencia
-- INVITA a un cliente (`created_at`) corren 14 días sin costo; después cuenta. Hay filas cuya invitación no es la fecha
-- que vale: Giselle (negocio 17) nació el 28/09 como prueba de Joan y su reloj tiene que correr desde el 28/10.
--
-- ⚠️ QUÉ DICE LA COLUMNA, PORQUE EL NOMBRE ENGAÑA: `cobra_desde` es el día desde el que CORREN LOS 14 DÍAS (reemplaza a
--    `created_at` para el reloj), NO el primer día que se cobra. Con cobra_desde = 2026-10-28, empieza a contar el
--    2026-11-11. Null = el reloj corre desde la invitación, como siempre. Es lo que escribe «Corregir la fecha» del
--    super admin en Agency Dashboard (lib/agencia-mes.ts, `corregirRelojDeCliente`).
--
-- ORDEN DE DESPLIEGUE: ANTES O DESPUÉS, da igual. Sólo AGREGA una columna nullable, y el código la lee tolerando que falte
--    (`leerCartera` en lib/agencia-mes.ts: sin la columna, la corrección no existe y vale la invitación). Lo que NO anda
--    sin ella es corregir una fecha: la pantalla y la API contestan «falta aplicar la migración 0402».
--
-- Sin funciones: no hace falta revoke de EXECUTE. La tabla ya tiene RLS y su revoke (mig 0175).
-- =============================================================================

alter table agencia_clientes add column if not exists cobra_desde date;

comment on column agencia_clientes.cobra_desde is
  'Corrección del super admin: el día desde el que corren los 14 días sin costo de la mensualidad de agencia (reemplaza a created_at para el reloj; no es el primer día que se cobra). Null = desde la invitación. lib/agencia-mes-reglas.ts.';
