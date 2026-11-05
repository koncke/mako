# Relevo: los recibos de MaKo — lo que le toca al Cerebro (5/11/2026)

> Lo escribió la sesión de la nube que lo construyó (cuenta `nube`, sesión `cli_c5ed70d4-0cef-5e9e-8637-8606741b3ad5`), a partir de
> [recibos-encargo.md](recibos-encargo.md). La tarjeta Pagos de Automations ([pagos-automations-encargo.md](pagos-automations-encargo.md))
> la hace la misma sesión después, en `punta/automations-pagos`, y suma su parte acá. **Esta sesión no vio la
> base ni producción**: lo que dice «medido» acá es en la nube (tests, PGlite, Node); lo de producción, lo mide el Cerebro.

## Para decirle a Martín, con estas palabras

- **Cada pago que entra a MaKo tiene su recibo**, con número (el próximo es el 0003), en PDF, por correo y al grupo de WhatsApp del
  negocio. Queda todo en **Admin › Billing › Recibos**, con «Bajar», «Reenviar» y «Cargar pago» (para lo que entra por Binance).
- **El recibo por WhatsApp sólo llega a un negocio que ya tiene grupo.** A un comprador nuevo le llega por correo y por la app.
- **Es un recibo de pago, no una factura fiscal**, y lo dice. Si hay que facturar en ARCA (Mercado Pago, Binance), eso sigue aparte:
  lo confirma su contador. Con Creem, el documento se llama «Confirmación de pago»: el vendedor legal es Creem y la factura la da Creem.
- **Lo que sí tiene que hacer él**: nada para que funcione. Si quiere, cargar sus datos en «Datos del recibo» (nombre, documento,
  dirección): mientras no los cargue, sale «MaKo · hola-mako.com», y nunca se inventa un dato fiscal.

## Lo que hay que hacer, en este orden

1. **Aplicar la 0358** (Creem), si sigue sin aplicar. Sin ella no hay ningún pago de Creem del cual emitir un recibo.
2. **Aplicar la 0397** (`supabase/migrations/0397_recibos.sql`). Sólo agrega (dos tablas, un contador y dos funciones): no toca nada
   que exista. ⚠️ **El número se confirma al aplicar**: se eligió el 5/11 barriendo main (llega a 0394), las 189 puntas, `ci-rojo/*`,
   `espera-main/*` y las etiquetas; `punta/agencia-cobro` trae OTRA 0394 y `punta/codigo-primer-contacto` una 0396. Si otro número
   ganó la 0397 antes, renombrar el archivo (el código no la nombra por número).
   - **Probar la carrera justo después de aplicar** (PGlite es una sola conexión y no la pudo probar): dos conexiones, cada una en
     `begin; select * from emitir_recibo('{…mismo pago…}'::jsonb); rollback;` a la vez. La segunda tiene que esperar a la primera.
     No toca `ultimo` porque las dos hacen rollback.
   - Con `has_function_privilege('anon', 'public.emitir_recibo(jsonb)', 'execute')` → false (scripts/medir-funciones-publicas.mjs).
3. **Cargar 0001 y 0002** (los que salieron a mano). NO MANDA NADA. Desde la PC:
   ```bash
   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/recibos-cargar-codigo.mts --dir C:/dev/cerebro-herramientas/cobros/codigo-inmobiliario
   ```
   Mirar lo que lista (el texto de los PDF mandados contra los renglones y el nombre; los comprobantes por orden; el id de Resend de
   cada uno). Si algo no lo encuentra solo, se pasa con flags (`--pdf 1=…`, `--comprobante <orden>=…`, `--correo-id 1=…`,
   `--a-nombre "…"`, `--correo <email>`). Recién ahí, lo mismo con `--aplicar`. Es idempotente por clave.
   ⚠️ **registro.json no lo vio esta sesión**: el script lo recorre entero buscando los ids de Resend al lado del número del recibo.
   ⚠️ Los renglones del 0002 van como «Natalia Krywyj» y «Sergio Arratia» (como salió el PDF); la base dice «Natalia» y «Arriata», y
   está mal. El script avisa si un concepto no aparece igual en el PDF.
4. **El deploy**, con la punta `punta/recibos`. El código tolera que falte la 0397 (lo dice en el log y el pago sigue).
5. **Mirar en un preview, ANTES de confiar en el correo**: `GET /api/admin/recibos/ejemplo` (y `?medio=creem`) con la sesión del
   super admin. Prueba que jsPDF carga dentro del bundle de Next (`serverExternalPackages: ['jspdf']` en next.config.ts); en la nube
   sólo se midió en Node pelado (un PDF de 41 KB con la imagen, en ~0,3 s, mismos bytes en dos renders).
6. **El primer pago real**: mirarlo a mano en Billing › Recibos (el monto contra el de la pasarela, el correo, el grupo). Con Creem, que
   `amount_paid` sea lo que pagó la persona y que el impuesto venga en `tax_amount` (no hay ninguna venta de Creem para mirarlo).

## Qué se construyó (punta/recibos)

| Pieza | Dónde | Qué hace |
|---|---|---|
| El libro | `supabase/migrations/0397_recibos.sql` | `recibos`, `recibo_pagos`, `recibos_numeracion` (nace en 2), `emitir_recibo(p jsonb)` y `recibos_que_faltan(ws, desde, tope)`. Sin `workspace_id`: es de la plataforma |
| Las reglas | `lib/recibos-reglas.ts` | a quién le llega (`destinoDelRecibo`), los textos, la referencia normalizada (Binance: 18 dígitos), la máquina de estados de la devolución, los totales del registro |
| El PDF | `lib/recibo-pdf.ts` | la plantilla del 0001/0002, determinista; con Creem, «Confirmación de pago»; página 2 con los comprobantes |
| El envío | `lib/recibos.ts` | `reciboDelPago`, `despacharRecibo` (correo y WhatsApp por separado), la red, devolución/disputa/anulación, «Cargar pago», «Reenviar» |
| El gancho | `lib/cobros.ts` | se emite ANTES del CRM y sale al FINAL de `aplicarPagoAprobado`; `cobradoEnLaPasarela` relee lo cobrado; `aplicarReembolso`/`ReembolsoFallido`/`Contracargo` tocan el recibo y nunca tiran |
| La red | `app/api/cron/cobros-reconciliar/route.ts` | emite lo que falta (tope 50) y despacha lo pendiente (tope 20), sin cron nuevo |
| El rebote | `app/api/webhooks/resend/route.ts` | rebote, queja, `email.failed` y `email.suppressed` de un recibo → `reboto` y aviso a `EMAIL_MAKO` (sólo eventos de la cuenta de MaKo) |
| SuperAdmin | `app/admin/cobros/RecibosMako.tsx`, `CargarPago.tsx`, `recibos-actions.ts` | el registro (montado en `Contenido.tsx`, una línea: el chat «Admin» lo puede mover), «Cargar pago», «Datos del recibo», el interruptor «WhatsApp a quien paga solo» |
| Rutas | `app/api/admin/recibos/…` | `[id]/pdf`, `[id]/comprobante/[pagoId]`, `comprobante` (subida, JPEG/PNG, 4 MB), `ejemplo` |
| Teléfono | `app/m/cobros` | la lista con «Bajar»; cargar queda en la computadora |
| API de MaKo | `lib/api-mako/areas/cobros.*` | `ver_recibos`, `cargar_pago_a_mano`, `reenviar_recibo` (sólo plataforma y super admin; las dos que escriben, en pantalla y fuera de los flujos) |

## Decisiones que tomé (con su porqué)

- **Donde un agujero contradecía al diseño, ganó el arreglo**: pie de WhatsApp sin monto, `aviso_tipo='recibo'` escondido a los
  invitados, cliente de agencia que paga él → sólo correo, un POST por destinatario, destino congelado al emitir, la clave del mes
  sólo para la rama de agencias, `emitir_recibo` que compara los pagos, `estado` de nacimiento `devuelto` para la red, el PDF guardado
  con su sha256, el recibo al final del pago y `sendEmail` con 15 s de tope.
- **El monto siempre se relee a la pasarela** si quien llama no lo trae (`cobradoEnLaPasarela`), en vez de sumar `montoCobrado` en
  las 13 llamadas a `aplicarPagoAprobado`: el webhook de Mercado Pago y el de Creem lo pasan; las demás (reparaciones del cron,
  `plan-deuda`) lo releen. Si la pasarela no contesta, no se emite y lo hace la red.
- **El asunto y la primera frase del correo se editan** en «Datos del recibo» (con `{{numero}}`, `{{monto}}`…); el «no es una factura
  fiscal» no.
- **La ruta del ejemplo es `/api/admin/recibos/ejemplo`** (no `ejemplo.pdf`: un punto en un segmento de ruta confunde al matcher del proxy).
- **«Cargar pago» no marca meses pagados.** Eso es de la rama de agencias (abajo).

## Con `punta/agencia-cobro` (medida el 5/11 en 84b249104)

- La rama NO numera: al llegar a main, después de `marcarMesPagado`, llama a `emitirReciboManual({ clave: 'mensualidad:<ag>:<mes>',
  destinoWs: <ag>, lineas, pagos })` (lib/recibos.ts). Con 2026-11 contesta «ya estaba» con el 0002 si las órdenes coinciden.
- `quitarMesPagado` llama a `anularRecibo({ clave })`. Para saber si un comprobante del grupo ya se usó: `reciboDePago('binance', orden)`.
- El diferencial cobrado usa `clave: 'diferencial:<ag>:<cliente>:<mes>'`.
- Al mezclar, se suman los dos lados en: `app/admin/dev/areas.ts`, `app/admin/dev/payment-gateway/bitacora.ts`, `docs/hallazgos.md`,
  `lib/api-mako/areas/cobros.def.ts`, `lib/api-mako/areas/cobros.run.ts` y `lib/api-mako/flujo.ts` (`NO_EN_FLUJOS` es una denylist: se UNE).
- ⚠️ Su `0402_agencia_cobra_desde.sql` choca en número con la de main: hay que renumerarla al subirla.
- ⚠️ El revisor marcó que «Cargar pago» con agencia y mes debería marcar el mes pagado en la misma acción, para que no queden dos
  libros. No lo hice: esa función vive en la rama, que no está en main. Cuando la rama llegue, se suma la llamada en
  `emitirReciboManual` (o al revés: que la rama sea la única puerta y llame a los recibos).

## Lo que NO está verificado

- Ningún pago real pasó por el camino (0 pagados en la plataforma al 5/11). Todo lo que dice «sale» es código y tests.
- jsPDF dentro del bundle de Next (paso 5). El correo con adjunto contra Resend (la `Idempotency-Key` y los 409 son de su doc).
- La carrera de `emitir_recibo` (paso 2). Que el webhook de Resend de la cuenta de MaKo esté suscripto a `email.failed` y `email.suppressed`.
- Que un PDF mandado por la línea de MaKo llegue a un grupo que no sea el de Código, y que el eco lo ate a su copia.
- La zona de la plataforma: las fechas del PDF salen de `zonaDelNegocioEstricta(plataforma)`; si no tiene, la de por defecto (Tijuana).
  Las de 0001 y 0002 se cargan en ART.
