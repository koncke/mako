# Encargo: Cobros y planes — 17 pendientes (7/11/2026)

**Qué es esto.** La lista depurada de pendientes de MaKo: de 634 anotadas el 6/11 quedaron 232 de
trabajo real (`docs/pendientes-depurados-7-11.md`). Éstos son los de tu área, ordenados por el
criterio de Martín: **cliente roto > plata > traba > features**.

## ⚠️ LEÉ ESTO ANTES DE TOCAR CÓDIGO, porque es lo que más tiempo ahorra

El 7/11 se verificaron los cuatro primeros de la lista **y tres estaban ya resueltos**. El
inventario es una foto del 6/11 y entre el 6 y el 7 entraron 601 commits a main.

**Entonces: por cada ítem, PRIMERO verificá contra el código que el síntoma siga existiendo.** Si ya
no existe, escribilo y pasá al siguiente — eso vale tanto como arreglarlo.

Tres trampas medidas ese día, las tres reales:

1. **Un pendiente que enumera «N puntas atadas» envejece punta por punta, no entero.** En «la cadena
   de pago sale del dominio del cliente», tres de cuatro puntas ya estaban hechas y el título seguía
   igual que el primer día.
2. **Un pendiente anotado muchas veces NO es más urgente: es uno que se contó muchas veces.** El más
   repetido del inventario (4 entradas) describía un recuadro gris que se había sacado el día anterior.
3. **Si dice «el número X está mal, debería ser Y», fijate si X e Y son del mismo período.** Uno decía
   «US$238 está mal, es US$426»: eran noviembre y diciembre, los dos correctos. «Arreglarlo» rompía
   noviembre.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde
(`.github/workflows/punta.yml`). **`integracion` se retiró el 4/11: un push ahí da rojo a propósito.**
No hace falta esperar a que termine la anterior.

⚠️ **«En main» no es «en producción»:** el deploy lo hace un cron a las 11:05 UTC.

Lo que aprendas va a `docs/hallazgos-<área>.md` **en el mismo commit**, y el índice
`docs/hallazgos.md` se actualiza ahí mismo. Sobre todo **cuando el diagnóstico obvio era el
equivocado**: eso es lo que más tiempo ahorra después.

---

### 1. El primer envío real del cobro a Código Inmobiliario: Pablo vence el 9/11 14:07 UTC

_cliente roto · chico · ⟳ estaba anotado 3 veces_

Mirar que el cron salga de verdad (nunca se envió): Giselle US$37,60 el 9/11 14:07 UTC, Pablo máximo el 9/11, Marcela el 13/11. Al llegar el comprobante, devolver el acceso a los usuarios 15 y 19; sin pago el 11/11 suspender a Giselle (13, 25, 26) y el 13/11 a Marcela (27, 28). Hecho = el envío salió y el acceso quedó como corresponde.

**Dónde:** `docs/relevo/nube-agencia-cobro.md · docs/relevo/cerebro.md:57,115-120 · tareas programadas codigo-diferencial-pablo-9-11, -giselle-12-11, -marcela-14-11`

<details><summary>Las otras formas en que estaba escrito</summary>

- Mirar que el primer envio real del cobro de Codigo salga el lunes 9/11 a las 14:07 UTC
- El lunes 9/11 a las 14:07 UTC sale el primer cobro real de una agencia y nunca se envió nada de verdad
</details>

### 2. La ficha cuenta «hoy» en UTC: de 18 a 24 h de México una cuota que vence hoy sale vencida

_plata · chico_

Sumar la zona del negocio a LeadFullData en getLeadFullAction y usar hoyEnTz en las dos pantallas. Hecho = la ficha, General y lo que dice MaKo coinciden sobre qué cuota está vencida.

**Dónde:** `C:/dev/wt-puntas/app/crm/lead-view/ficha/FichaPorBloques.tsx:135 · app/customer-success/PagosCliente.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-pagos.md:379`

### 3. Mirar /agency?ws=13 y decidir las tres tareas programadas `codigo-diferencial-*`

_plata · chico_

Comprobar la tarjeta de diciembre en US$332 proyectado, «Entradas por pagar» con Pablo y Patricia, y «En pausa: Pablo · Patricia». Y decidir si las tres tareas programadas (9/11, 12/11 y 14/11, que avisan y no escriben) quedan o se apagan.

**Dónde:** `C:/dev/wt-puntas/app/agency/Mensualidad.tsx ; pasos 7 y 8 de docs/relevo/nube-agencia-cobro.md:67-70`

### 4. `porCobrar` le pone a Codigo 4/12 por US$238 y lo real es 5/12 por US$426

_plata · chico_

Arreglo chico en la vista de ingresos. Se le paso al chat de la copia de Admin, sin confirmar. Ojo: NO registrar de nuevo los pagos ya cargados.

**Dónde:** `docs/relevo/cerebro.md:85 (vistaDeIngresos)`

### 5. Nada del cobro de agencias está verificado contra la base ni producción

_plata · mediano_

Seis cosas sin medir: un comprobante real de Binance leído; la lectura de un PDF de comprobante (WhatsApp lo guarda como documento, sólo se probó foto); jsPDF dentro del bundle de Next con este PDF; que el grupo de MaKo de Código exista (`mako.grupo_jid` del 13); un comprobante que llega por el grupo de la APP no se lee (sólo el de WhatsApp); el recibo cuando una sola orden completa entrada y mensualidad a la vez.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-agencia-cobro.md:100-108 ; lib/agencia-mes-comprobante.ts ; lib/agencia-mes-pdf.ts`

### 6. La suscripción mes a mes no existe en el teléfono

_plata · mediano_

En /m la ficha dibuja el estado de cuenta viejo, no el bloque «Mes a mes». Además quedaron sin hacer: el prorrateo del diferencial (hoy lo calcula Martín y se registra como ajuste), una suscripción cobrada por la pasarela (su monto sale del lead, no del cobro) y cambiar el medio de un pago cobrado (sin botón ni operación).

**Dónde:** `C:/dev/wt-puntas/app/m/ (ficha del lead) ; lib/cobros.ts ; docs/relevo/nube-suscripciones.md:98-104`

### 7. Terminar el cobro de agencias: 0402/0403, fecha de Giselle, mensualidad del 13 y tres «Paga para entrar»

_plata · mediano_

Seguir el orden de docs/relevo/nube-agencia-cobro.md: aplicar la 0402 (si falta) y la 0403, corregir la fecha de Giselle (17) al 2026-10-28, prender la mensualidad del 13 desde 2026-12 y pasar a 19, 22 y 15 a «Paga para entrar». Hecho = la pantalla de cartera muestra las mensualidades correctas con la cartera real.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-agencia-cobro.md · supabase/migrations/ (0402, 0403) · lib/agencia-cobro.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-agencias.md:74`

### 8. anularCobro cierra el link viejo con mejor esfuerzo: un link anulado puede seguir cobrable

_plata · mediano_

Que anularCobro devuelva si la pasarela cerró el link, y que quien lo rehace no deje dos links vivos (hoy la plata puede entrar y el pago no quedar anotado por el índice). Hecho = anular un link falla ruidosamente si la pasarela no lo cerró.

**Dónde:** `C:/dev/wt-puntas/lib/cobros.ts:1318 (anularCobro → cerrarLinkEnLaPasarela) · pendiente en C:/dev/wt-puntas/docs/hallazgos-agencias.md:299 y :487`

### 9. Cuatro bloques del catálogo de Pagos no tienen componente y se saltean

_plata · grande_

Escribir confirmacion-de-pago, recordatorios-de-cobro, excepciones y cliente-en-cs. Para los recordatorios hace falta primero la columna lead_id (mig 0186). Hecho = los cuatro se dibujan cuando la plantilla los pide.

**Dónde:** `C:/dev/wt-puntas/app/crm/lead-view/ficha/reglas-pagos.ts · app/crm/lead-view/ficha/pagos/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-pagos.md:379`

### 10. Medir con claves de PRUEBA lo que nunca se probó de Stripe y Mercado Pago

_plata · mediano_

Probar: si una rk_ restringida lee GET /v1/account; si la notification_url de MP llega firmada; si MP respeta el vencimiento de una preferencia anulada con el checkout abierto; en qué estado queda una suscripción de MP al llegar su end_date; el PUT del monto de un preapproval; hosted_invoice_url con la suscripción past_due; y la factura de $0. Hecho = cada punto con su medición escrita.

**Dónde:** `C:/dev/wt-puntas/lib/cobros-conexion.ts · lib/pasarela-plan-api.ts · lib/mercadopago-api.ts · app/api/webhooks/mercadopago/route.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-planes-y-cobro.md:1367 y :1567`

### 11. Los 66 pagos de la base tienen `moneda` en null: los USDT de Codigo se cuentan como dolares sin rastro

_plata · mediano_

Medido el 5/11: la tabla `pagos` entera son 66 filas (49 pagadas) y las 66 tienen `moneda` y `monto_original` en null. Los pagos manuales de Codigo entraron por Binance en USDT y quedan tratados como dolares sin que nada lo diga. Ademas `metodo` esta en null en 57 de 66, y el pago de Juanfran figura `transferencia` cuando fue Binance. Cualquier total que se muestre arriba de eso (MRR, Revenue, el runway) hereda el error. Hecho = los pagos nuevos guardan moneda y monto original, y las filas viejas quedan con su moneda real o marcadas como «sin dato».

**Dónde:** `C:/dev/wt-puntas/docs/relevo/suscripciones-medicion.md §1 · C:/dev/wt-puntas/docs/relevo/admin-medicion.md §1 · C:/dev/wt-puntas/lib/pagos.ts · C:/dev/wt-puntas/app/crm/lead-view/ficha/pagos/`

### 12. Nada avisa al super admin cuando pasa el día 5 sin el «Pagado» de una agencia

_feature · chico · ⟳ estaba anotado 2 veces_

Un aviso (push o grupo) al super admin pasado el día 5; hoy sólo se ve entrando a la pantalla o con ver_mensualidades_agencias. Hecho = el 6 llega el aviso con las agencias que no pagaron.

**Dónde:** `C:/dev/wt-puntas/lib/agencia-cobro.ts · lib/api-mako/areas/ (ver_mensualidades_agencias) · pendiente en C:/dev/wt-puntas/docs/hallazgos-agencias.md:74`

<details><summary>Las otras formas en que estaba escrito</summary>

- Un comprobante que llega por el grupo de la APP no se lee (sólo el de WhatsApp)
</details>

### 13. A5: el aviso con el total de la agencia del 1 al 5 no existe

_feature · mediano · ⟳ estaba anotado 2 veces_

No hay consolidacion mensual de agencia. Hace falta un cron del dia 1 que sume los clientes de la agencia y avise. Prometido a Juanfran y Joan.

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:84 · lib/agencia-cobro.ts · app/api/cron/`

<details><summary>Las otras formas en que estaba escrito</summary>

- A8: no hay prioridad por agencia para los tickets de Joan y Juanfran
</details>

### 14. La carrera de `emitir_recibo` nunca se probo

_feature · chico_

Probarla con dos conexiones (`begin; select emitir_recibo(...); rollback;`). No se corrio porque escribe aunque se deshaga y el encargo era solo lectura.

**Dónde:** `docs/relevo/pendientes-pc/pasos-cerebro-6-11.md:87`

### 15. A6: no hay reloj fijo de 14 dias por cliente de agencia

_feature · mediano_

Hoy el mes corre desde que el cliente termina el onboarding. Hace falta `inicio_at = alta + 14 dias` y que el cron de renovaciones lo respete.

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:85 · lib/agencia-cobro-reglas.ts:10 · lib/agencia-cobro.ts`

### 16. Los carteles de tope le dicen «Pasa a MaKo Pro» al cliente de una agencia

_feature · mediano_

Usar `clienteDeAgencia` de /api/auth/me para esconder el link y cambiar el texto a «pídele a tu agencia que te pase a Pro», en las siete pantallas que lo dibujan. Hecho = un cliente de agencia no ve ningún «Pasar a Pro».

**Dónde:** `C:/dev/wt-puntas/app/crm/PasarAPro.tsx · app/crm/TraerDeGrupoWA.tsx · app/whatsapp/EvolutionConnect.tsx · app/equipo/EquipoView.tsx · app/m/configuraciones/equipo/EquipoM.tsx · app/web-generator/editor/dialogos/DialogoPublicar.tsx · app/integraciones/CuentasDePago.tsx · pendiente en C:/dev/wt-puntas`

### 17. El prorrateo del diferencial de agencias lo calcula Martín a mano

_feature · mediano_

Automatizar el prorrateo de los días hasta el próximo 5 por cada cliente nuevo (hoy se registra como ajuste). Hecho = el diferencial sale calculado sin que nadie lo cargue.

**Dónde:** `C:/dev/wt-puntas/lib/agencia-cobro.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-pagos.md:1799 y C:/dev/wt-puntas/docs/hallazgos-agencias.md:517`
