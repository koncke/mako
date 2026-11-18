# Pendientes de Partners y de cobros — pedidos de Martín del 18/11/2026 (NO hechos)

Lo que está hecho: la regla 30 % directo / 25 % pasarela y un crédito por cada pago (docs/hallazgos-partners.md, «Un crédito por CADA pago»).
Lo de acá abajo lo pidió Martín el mismo día (relayado por el Cerebro) y **no está hecho**. Cada punto es un trabajo propio. Reglas de siempre:
escribir en producción (migraciones) pide el sí de Martín escrito EN EL CHAT; lo que se ve se mira con capturas a 1440 y a 375; lo aprendido va a
docs/hallazgos-pagos.md y docs/hallazgos-partners.md.

## 1. La cotización de Mercado Pago, AL MOMENTO (reemplaza al cron del blue)
Martín: «incluso no del día, sino del momento. Cuando alguien da clic en comprar… un pequeño loader… para que consulte por API… cuánto está la cotización».
- Fuente: el **dólar cripto (Binance)**, no el blue: `https://dolarapi.com/v1/dolares/cripto` (venta) y `https://criptoya.com/api/usdt/ars/1` (`binancep2p.totalAsk`).
  Motivo: Martín pasa los pesos a USDT en Binance; al 18/11 el blue estaba a 1.615 y el USDT P2P a 1.704 (pierde 5,2 % en cada cambio).
- Al elegir Mercado Pago en el checkout: loader corto «Consultando el dólar de hoy…», el servidor lee en ese momento, muestra dólares del plan × cotización,
  redondeado al millar hacia arriba. **Lo que se muestra es lo que se cobra:** la preferencia/link se crea con ESE monto (`precioVisto` ya existe en
  `iniciarCompraDePlan`, lib/compra-plan.ts, y `precioVistoDelPedido` en lib/compra-plan-reglas.ts; el cliente es app/planes/[plan]/CompraPlan.tsx).
- Los frenos de lib/dolar-blue-reglas.ts aplicados a la lectura en vivo: las dos fuentes dentro de un 3 %, la banda contra la última buena.
- Caché de ~60 s. Si las dos fallan o no coinciden: la última buena si tiene menos de unas horas (con su hora en el log); si no hay, NO se ofrece Mercado Pago
  y se ofrece pagar en dólares. Nunca se inventa un número.
- Las renovaciones de una suscripción ya armada siguen con el cron diario (app/api/cron/dolar-blue, lib/dolar-blue-corrida.ts), pero con la fuente cripto.
  Textos para Martín (Settings › Payments, avisos): «blue» pasa a «dólar cripto (Binance)». El primer día salta ~+5,6 % y dispara el aviso de más de 5 %: está bien.
- Precios de hoy a 1.706, al millar hacia arriba: Pro $ 166.000, Essential $ 81.000. No toca los links ya emitidos.

## 2. Verificar que la plata ENTRÓ (B) y activar sola; pagar por Binance/transferencia con datos y comprobante (C)
Martín: «para evitar fraude… te fijas… si realmente impactó y listo… automatiza ese proceso, no me tienes que estar preguntando todo el tiempo a mí… y lo mismo por Binance».
- Regla nueva: **un comprobante solo NUNCA activa nada.** Hoy lib/agencia-mes-comprobante.ts lo lee con IA y lo propone; ahora tiene que calzar con un movimiento REAL.
- **Mercado Pago (ws 9):** transferencias entrantes al CVU (`account_fund`, `bank_transfer`, `money_transfer`) con `collector_id` igual al propio usuario.
  ⚠️ `GET /v1/payments/search` con el token de ws 9 trae TAMBIÉN lo que MaKo PAGA (Uber, PedidosYa, Mercado Libre, HBO) con sus `fee_details`: filtrar por
  `collector.id` propio u `operation_type` `regular_payment`/`recurring_payment`; sin filtrar dan «costos» de 1 % a 49 % que no son de MaKo. Quién pagó: monto, fecha y
  lo que traiga MP (`point_of_interaction.transaction_data.bank_info`, `payer.identification`).
- **Binance**, con clave de SÓLO LECTURA que crea MARTÍN (API Management › «Enable Reading», nada más) y carga en Vercel: preparar el nombre de la variable, el paso
  a paso para él y el código que la lee. Endpoints a CONFIRMAR en la documentación oficial antes de usarlos: Binance Pay `GET /sapi/v1/pay/transactions`,
  depósitos `GET /sapi/v1/capital/deposit/hisrec`, P2P `GET /sapi/v1/c2c/orderMatch/listUserOrderHistory`. Hasta que cargue la clave, Binance sigue con comprobante + revisión de Martín.
- **El calce:** monto exacto, ventana de fecha y dato de quien paga. Cada movimiento se usa UNA vez (índice único por id del movimiento: un depósito no activa dos cuentas).
  Calza → se activa sola, con recibo y aviso. No calza → no se activa; al cliente «todavía no vemos la transferencia; la revisamos sola y te avisamos»; se vuelve a mirar
  cada ~10 min durante 48 h; sólo si pasan las 48 h, o si dos movimientos calzan igual, le llega a Martín.
- **C (checkout):** al elegir «Binance» o «Transferencia» se ven los datos de MaKo, cada uno con botón de copiar (Binance Pay ID; alias y CVU de la MP de MaKo) y el monto
  exacto (USDT por Binance; pesos al dólar cripto del momento por transferencia). Debajo, «Enviar comprobante por WhatsApp» (`wa.me` con nombre, plan, monto y código de
  compra) y «Enviar comprobante por email»; lo que llegue entra al mismo lector y pasa por el calce. **Aunque no manden nada**, si la plata entra y calza con monto y
  código, se activa. **Los datos de Martín NO se inventan:** buscarlos en la configuración / en lo que ya usa el cobro de agencia (el PDF de Código dice dónde pagar); alias y
  CVU se pueden leer de la cuenta de MP; si falta uno, pedírselo a Martín en el chat.

## 3. El panel del partner suma solo y se le paga del 1 al 5 (A), y elige por dónde cobra (D)
Martín: «que ahí vaya sumándose todo lo que va a ganar y que el proceso de pago sea exactamente el mismo que… código inmobiliario de agencia, que me pagan del 1 al 5».
- Cada pago confirmado de un negocio referido suma su comisión **en dólares** (30 % directo / 25 % pasarela). Si pagó en pesos, se convierte con la MISMA cotización con
  la que se le cobró (la del momento), no la de hoy. Un pago devuelto antes de pagarle al partner se descuenta (hoy NO hay contra-asiento: ver hallazgos-partners).
- El panel muestra: lo de este mes (sube solo), el detalle por negocio y por pago con canal y %, «Se te paga entre el 1 y el 5 de <mes>» y el historial de lo pagado.
- Ciclo = el del cobro de agencia (lib/agencia-mes-reglas.ts, lib/agencia-mes.ts): el día 1 MaKo cierra el mes anterior de cada partner, le avisa cuánto le toca y a Martín
  le manda la lista para pagar (monto y Binance Pay ID o CBU de cada uno, tabla o PDF, como lo de Código).
- **D:** en el panel, «¿Cómo quieres cobrar?»: **Dólares por Binance** (pide su Binance Pay ID) o **Pesos por Mercado Pago o transferencia** (alias o CVU/CBU y titular; se paga al
  dólar cripto del día del pago). La lista de Martín muestra por partner el total en dólares, el medio y su dato con botón de copiar y, si cobra en pesos, el monto en pesos al
  dólar cripto EN VIVO al abrir la lista. Martín paga y lo marca: se guarda la cotización usada y sale el recibo. Sin datos: «esperando tus datos» (no se pierde) y se le recuerda.
- Si el partner cobra él y manda el 70 %: su 30 % ya lo tiene; se registra igual en el panel pero no se le paga nada.
- Hoy `app/partners/PanelPartner.tsx` sólo tiene el campo `cobro` de texto libre (`cambiarCobroPartner`, lib/partners-programa.ts) y «Marcar pagado» manual del super admin
  (`registrarPagoAPartner`). El pago es una transferencia que hace MaKo; falta el cierre mensual, la lista y el aviso.

## 4. «Ser partner NO es gratis» (Martín, 18/11)
«no es gratis, deben estar pagando su suscripción». El alta (`hacermePartner`, `hacerme_partner` de la API) debe exigir plan de MaKo PAGO y ACTIVO; si no, no corre y dice que
primero active su plan, con el link. **Hoy no lo exige** (desde el 29/10 «cualquier plan es partner», docs/hallazgos-partners.md; sólo rechaza al cliente de una agencia).
Si al partner se le corta el plan, lo ganado NO se pierde: su pago del 1 al 5 queda «en pausa hasta que reactives tu plan» y se libera al reactivar (decisión por defecto del
Cerebro). Sacar todo «gratis» sobre ser partner de app/partners/* y de los avisos. ⚠️ Definir «plan pago y activo» con cuidado antes de codearlo: `vigenciaDe(ws)`
(lib/plan-acceso.ts) da null para una cuenta sin cobros por pasarela (planes cobrados a mano, agencias, Leila con su mensualidad propia): un criterio mal puesto deja afuera a
partners que sí pagan.

## Dependencias entre estos puntos
1 → C (los pesos del checkout usan la misma lectura en vivo) y D (el monto en pesos de la lista). B y C van juntos. A y D van juntos y usan la migración 0421 (ya preparada).
La API `ver_mi_programa_partners` la rehace el chat del Sitio (punta/sitio-1611): no tocar negocio.def.ts / negocio.run.ts sin coordinar.
