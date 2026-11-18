# Relevo — chat «Cobros» (cuenta claude2), 18/11/2026

Último despliegue con lo mío: **`b7939d2be`** (merge de `punta/partners-30-1811`). Lo detallado de cada tema está en `docs/hallazgos-partners.md`,
`docs/hallazgos-pagos.md`, `docs/hallazgos-agencias.md` y, lo que falta, en **`docs/pendientes-partners-pagos-1811.md`** (el brief completo de cada punto).

## Hecho y desplegado
- **Leila (ws 11, Pro US$ 97): cobro mensual propio por Binance** (17/11). Su ciclo es el día que pagó (26 de cada mes), sin días de gracia: aviso con PDF a su grupo el 26/11; sin pago, el 27/11
  se pausa su cuenta y se avisa a su grupo y a Martín. Prendido en producción con `scripts/mensualidad-ciclo-propio.mts` (config `agencia.mensualidad.11.config`). Ver `docs/hallazgos-agencias.md`.
- **Partners: un crédito por CADA pago, SIEMPRE el 30 % del precio de lista** (`lib/partners-reglas.ts`: `comisionDelPago`, `canalDelPago`, `creditosDeUnReferido`; `lib/partners-programa.ts`:
  `acreditarReferidos`, `pagosDeLosReferidos`, `tableroDe`). Tope por pago = lista × meses (un cobro de US$ 1.500 no deja el 30 % de 1.500). Panel web y teléfono dicen «lo que te deja cada mes» y el
  acumulado. Quien ya ganó con la regla vieja (100 % del primer mes) no cobra por sus 2 primeros pagos. Alias `@deprecated` (`porGanarUsd`, `gananciaUsd`, `PAGOS_PARA_ACREDITAR`,
  `gananciaDelReferido`) siguen exportados para la API/landing vieja: borrarlos cuando nadie los importe.
- **Checkout: «Transferencia o Binance»** (`lib/pago-directo-reglas.ts`, `lib/pago-directo.ts`, `app/planes/[plan]/CompraPlan.tsx`): al precio de lista; datos de MaKo (alias, CVU, link «Transferime con
  Mercado Pago», QR de Binance, Pay ID, titular, WhatsApp, email) en el setting; botones de comprobante por WhatsApp y email; «Confirmar mi pedido» entra por `pedirPlanSinPasarela` (lead + «Quieren entrar» +
  aviso al equipo). Binance: QR personal de «Recibir» (permanente), monto en USDT grande, QR en la PC y botón en el teléfono, Pay ID siempre con «Copiar».
- **Recargo de pasarela APAGADO:** `RECARGO_PASARELA = 0` (Martín: «volvamos al sistema simple… 47 y 97»). El mecanismo queda (`conRecargoDePasarela`, un solo punto en `ofertaDelPlan`); las pasarelas
  cobran 97 / 47. Si se prende, ver la sección «El modelo se dio vuelta» de `docs/hallazgos-pagos.md` (flujos de reactivar/retención/subir de plan no llevan el recargo).

## A medias / sin hacer (todo en `docs/pendientes-partners-pagos-1811.md`)
1. **Migración `supabase/migrations/0421_partners_credito_por_pago.sql`: PREPARADA, NO APLICADA en producción.** Agrega `pago_id` y `canal` a `partner_creditos` y cambia el índice único (uno por pago).
   Sin ella, `acreditarReferidos` **no acredita nada** (lo avisa en el log: «¿Falta la migración 0421?»). Hoy no hay ningún referido real (medido 18/11: 2 códigos, 0 compras con código, 0 renglones), así que no se pierde
   nada todavía, pero hay que aplicarla ANTES del primer referido que pague. Pide el **sí de Martín escrito en el chat**.
2. **Setting `planes.pago_directo`: VACÍO, y por eso «Transferencia o Binance» NO se ve en el checkout.** Martín decidió no cargarlo (dudas sobre el checkout inicial sin tarjeta: el Sitio dibuja un artefacto con
   la propuesta). Forma: `{ binancePayId, linkBinance, linkTransferencia, alias, cvu, titular, whatsapp, email }` (todo texto o null; links sólo https). Se edita en Settings › Payments. Datos que Martín ya pasó al
   Cerebro: alias `holamako`, CVU `0000003100062063077421`, titular Martin Carballo Koncke, link `https://mpago.la/1bfQ8i6`, QR Binance `https://app.binance.com/uni-qr/68G3kuwL`, Binance Pay ID `68725667`. **NO se cargaron.**
3. **Cotización de Mercado Pago al momento** (dólar cripto de Binance leído al comprar, loader, caché 60 s): sin hacer (sección 1 del pendiente). Hoy el precio en pesos sigue saliendo del cron del blue.
4. **Verificar que la plata entró (Mercado Pago y Binance) y activar sola**, con el comprobante obligatorio y el calce por número de orden (`transactionId` de Binance Pay): sin hacer (sección 2). La clave de Binance
   (`BINANCE_API_KEY` / `BINANCE_API_SECRET`, sólo lectura) está en `C:/dev/mako-api/.env.local`; en Vercel la carga Martín. Usar SÓLO endpoints de lectura.
5. **Panel del partner que suma solo y pago del 1 al 5, el partner elige por dónde cobra** (secciones 3): sin hacer. El pago a partners hoy es manual (`registrarPagoAPartner`, «Marcar pagado»).
6. **«Ser partner exige MaKo Pro activo»** (sección 4): `hacermePartner` hoy NO lo exige. Definir «Pro activo» con cuidado (planes cobrados a mano, agencias, Leila).
7. **Abiertos de antes** (sólo si el Cerebro los pide): P7, P26, P1, P24, P29 de los pendientes verificados; 79 filas viejas de `pagos` sin moneda.
8. **Sin ver en navegador:** ni el checkout ni Settings › Payments se miraron con capturas a 1440 y 375 (sólo HTML dibujado y tests de las fuentes).

## Qué espera de Martín
- **El sí escrito para aplicar la migración 0421** (explicación en una línea: «agrega dos columnas a la tabla de lo que ganan los partners y permite una fila por pago en vez de una por negocio; no toca filas;
  sin ella el programa no acredita nada»).
- **Decidir lo del checkout inicial** (la propuesta del Sitio: prueba con tarjeta como principal, «¿No tienes tarjeta?» como secundario sin prueba, y pasarse a transferencia/Binance desde el segundo mes) y, con eso,
  si se carga `planes.pago_directo`.
- **Cargar `BINANCE_API_KEY` y `BINANCE_API_SECRET` en Vercel** cuando se haga la verificación automática de pagos.
- **Si «pagos de antes del 18/11» de un referido sin crédito viejo cuentan** (hoy sí, todos; sin referidos reales no mueve plata todavía).
- **Qué hacer con los flujos que no llevan recargo** (reactivar, retención, subir de plan) si algún día se prende `RECARGO_PASARELA`.

## Trampas que se llevaron tiempo (ya cosechadas en los hallazgos)
- El índice único `(referidor, referido)` de `partner_creditos` estaba en la BASE, no en el código: sin la 0421 el cron trataba el 23505 como «ya estaba» y callaba.
- `GET /v1/payments/search` de Mercado Pago trae también lo que MaKo PAGA: filtrar por `collector.id` propio.
- Los «payment request» de Binance Pay vencen a los 30 días; sirve el QR personal de «Recibir».
- Editar archivos CRLF con scripts: usar un editor que respete el salto de línea; un `s.index()` que toma una coincidencia anterior duplica bloques (pasó con Settings: se restauró desde HEAD).
- Rebasar la punta cuando el Sitio tocó `docs/api-mako.md` y `tests/mako-partners-landing.test.ts`: quedarse con su versión y regenerar el doc con `node --import tsx scripts/generar-api-doc.mjs`.
