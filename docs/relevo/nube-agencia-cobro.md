# Relevo — la mensualidad de una agencia (nube, 5/11/2026)

> Lo escribió la sesión de la nube que lo construyó (cuenta `nube`, sesión `cli_6296ebf3-1e24-5957-8413-d80fe6d457fb`). Esta
> sesión no le puede escribir al Cerebro: todo lo que hace falta está acá. Lo que no se ve en el código, en
> [docs/hallazgos-agencias.md](../hallazgos-agencias.md) → «La mensualidad de una agencia».

## Lo pedido

El cobro de una agencia según lo acordado con Código Inmobiliario (Juanfran y Joan, negocio 13) el 30/10/2026: la agencia paga su
plan (Pro, US$97) y cada cliente el suyo (Esencial, US$47, del catálogo de planes); desde que la agencia invita a un cliente corren
14 días sin costo y después cuenta; si lo dan de baja antes, no se cobra; se paga una vez por mes, del 1 al 5, por Binance. El día 1,
aviso a los admins de la agencia con el total y el detalle, por la app y por correo (WhatsApp no: grupos apagados desde el ban del
3/11); y un aviso 2 días antes de que venza el plazo de un cliente. MaKo no cobra nada: calcula y avisa.

## Lo hecho (punta `punta/agencia-cobro`)

- **Reglas puras** — `lib/agencia-mes-reglas.ts`, con `tests/agencia-mes.test.ts` (16 casos, probado rompiéndolo: cada rotura cae,
  renombrar una variable no). El caso real al 5/11: Brigitte, Natalia, Sergio, Pablo y Patricia cuentan; Giselle (con la fecha
  corregida al 28/10) sin costo hasta el 11/11 y Marcela hasta el 13/11. **Noviembre = US$ 285** (Pro + Brigitte, Natalia, Pablo y
  Sergio, que cuentan el 1/11).
- **Servidor** — `lib/agencia-mes.ts`: leer la mensualidad, marcar «Pagado» (y quitarlo), corregir la fecha de un cliente, prender o
  apagar, y los avisos.
- **Pantalla** — en `/agency` (el Agency Dashboard; el pedido decía «/agencia», que es el panel del canal de MaKo del super admin):
  la tarjeta del mes (total, renglones, hasta cuándo se paga, «Pagado»), la columna «Mensualidad» de la lista (desde cuándo cuenta
  cada uno, o hasta cuándo está sin costo) y, para el super admin, «Marcar pagado», «Corregir fecha» (en la ficha de la cuenta) y
  prender o apagar. Se miró con datos de ejemplo a 1440 y 1024 (sin base en la nube): sin desbordes.
- **Cron** — `app/api/cron/agencia-mensualidad` (`7 14 * * *`): del 1 al 5 el aviso del mes, una vez y no si está pagado; y el de los
  clientes a los que les quedan 1 o 2 días. Por las notificaciones de la app y por correo a los admins. `?dry=1` dice qué saldría.
- **API de MaKo** — `ver_mensualidad_agencia` (área cs, la agencia) y, para el super admin (área cobros, sólo la plataforma, sin HTTP):
  `ver_mensualidades_agencias`, `marcar_mensualidad_pagada`, `corregir_reloj_mensualidad`, `prender_mensualidad_agencia`. Las tres que
  escriben están en `NO_EN_FLUJOS`.
- **Bitácora** — `app/admin/dev/payment-gateway/bitacora.ts` (el pedido y lo hecho).

## La decisión que tomé (el acuerdo no la decía)

Lo que se paga del 1 al 5 es ESE mes, por adelantado, por los que cuentan el día 1. Un cliente que empieza a contar a mitad de mes
suma sus días de ese mes a la mensualidad siguiente, por día. Con la cartera de hoy y sin bajas, **diciembre = US$ 527,83** (Pro, los
siete, y los días de noviembre de Patricia, Giselle y Marcela). Si Martín prefiere no cobrar esos días: `COBRA_LOS_DIAS_DEL_PRIMER_MES
= false` en `lib/agencia-mes-reglas.ts` (diciembre quedaría en US$ 426).

## Lo que falta, en orden (es del Cerebro, desde la PC)

1. **Aplicar la migración** `supabase/migrations/0394_agencia_cobra_desde.sql` (sólo agrega `agencia_clientes.cobra_desde date`, sin
   aplicar). Número elegido barriendo main, las 377 ramas y etiquetas de origin: el más alto era 0393. Orden: da igual, el código
   tolera que falte (sin ella, «Corregir fecha» dice que falta).

   ```bash
   node scripts/apply-migration.mjs supabase/migrations/0394_agencia_cobra_desde.sql
   ```

2. **Corregir la fecha de Giselle (negocio 17) al 2026-10-28**: en `/agency?ws=13` (super admin) → su cuenta → «Corregir fecha», o
   por MaKo con `corregir_reloj_mensualidad` (agenciaWs 13, clienteWs 17, dia 2026-10-28). Sin esto cuenta desde el 12/10.
3. **Mirar la cartera real antes de prender**: `ver_mensualidades_agencias` con agenciaWs 13, o `/agency?ws=13`. El pedido separaba
   «Pablo y Patricia ya vencieron» de «Natalia cuenta» con Natalia y Pablo invitados el mismo día (14/10): por las reglas los dos
   cuentan desde el 28/10. Si la base dice otra cosa (otra fecha, una baja), vale la base.
4. **Prender la mensualidad del 13 desde 2026-11**: botón «Prender desde noviembre» en `/agency?ws=13`, o `prender_mensualidad_agencia`
   (agenciaWs 13, desde 2026-11). Está apagada para todas las agencias: así no le llega «paga por Binance» a quien paga por pasarela.
   ⚠️ Prenderla hoy (5/11) hace que el cron de hoy mande el aviso de noviembre si todavía no está marcado pagado (el aviso del mes
   prueba del 1 al 5). Si noviembre ya está pagado, marcarlo «Pagado» antes de prenderla, o prenderla desde 2026-12.
5. Correr el cron en seco y mirar qué saldría:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://hola-mako.com/api/cron/agencia-mensualidad?dry=1"
   ```

## Cómo probarlo en el negocio de prueba (nunca en el ws1)

No hay una agencia de prueba: el Cliente de Prueba (ws 3) no es agencia. Lo que se puede probar sin tocar a Código:

- Las reglas: `node --import tsx --test tests/agencia-mes.test.ts`.
- La pantalla con la mensualidad APAGADA: el super admin en `/agency?ws=13` ve la tarjeta «Mensualidad · apagada» con cómo quedaría el
  mes, y la columna «Mensualidad»; eso no escribe nada ni le avisa a nadie.
- ⚠️ Prender la mensualidad del 13 o marcar un mes le llega a la agencia real (el aviso del día 1, el de los plazos). Para probar el
  aviso sin ellos: una agencia de prueba haría falta (un negocio con capa `agencia`, fila en `agencias` y un cliente en
  `agencia_clientes` cuyo admin sea un correo de MaKo). No la creé: escribir en producción es del Cerebro.

## Sin verificar

- La pantalla con la cartera real (sólo con datos de ejemplo).
- El correo real del aviso (el texto está en el test; el envío es `avisarDePlataforma`, el mismo de la baja de un cliente).
