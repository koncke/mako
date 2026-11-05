# Creem: cómo sale la plata (leído el 5/11/2026)

Son condiciones de Creem, con su fuente: volver a mirarlas antes de confiar en un monto. Lo fiscal y cambiario es para el contador de Martín.

## El estado de la cuenta, medido el 5/11/2026

- Tabla cobros, 5/11/2026 18:59 UTC, toda la base: 2 filas. Las dos son del negocio 9, Mercado Pago, modo real, suscripción, estado pendiente, en ARS, de octubre de 2026; la última se creó el 31/10 a las 19:23 UTC. Ninguna tiene fecha de pago. Creem: 0 filas. Stripe: 0 filas.
- Tabla pasarela_eventos, misma fecha: Stripe 16 filas (13/10 a 5/11), Mercado Pago 0 y Creem 0.
- Credenciales de Creem en el negocio 9, 5/11: CREEM_API_KEY, CREEM_WEBHOOK_ID y CREEM_WEBHOOK_SECRET, guardadas el 31/10 a las 19:22 UTC. La clave es REAL por su prefijo, no de prueba.
- Credenciales de Mercado Pago en el negocio 9, 5/11: MERCADOPAGO_ACCESS_TOKEN (real), MERCADOPAGO_USER_ID y MERCADOPAGO_WEBHOOK_SECRET, guardadas el 31/10 entre las 04:37 y las 04:39 UTC.
- Lectura de claves: para las lecturas por API descifré en memoria la clave de Creem y el token de Mercado Pago del negocio 9. No se imprimieron ni se guardaron, y los usé solo en pedidos GET a api.creem.io y api.mercadopago.com. Eso no deja fila en credenciales_auditoria. La base se leyó en transacción de solo lectura.
- API de Creem en vivo, solo GET, 5/11 19:01 y 19:05 UTC: 0 productos, 0 transacciones, 0 clientes, 0 suscripciones. Las estadísticas en USD y EUR dan ingresos 0 y pagos 0. Creem no tiene ventas reales.
- Aviso de Creem, misma medición: 1 solo, a hola-mako.com/api/webhooks/creem, con ?w=, modo prod, habilitado, 17 eventos. El camino de los avisos está armado, pero nunca recibió una venta.
- Web pública, 5/11 18:58 UTC, sin sesión y desde Argentina: /planes/esencial ofrece Mercado Pago a $ 73.555 ARS por mes y no menciona Creem. Coincide con el código (lib/compra-plan-reglas.ts, pasarelasDelPais): Argentina va a Mercado Pago y el resto de LATAM a Creem.
- Código en origin/main f8412c6be, 5/11: 0 apariciones de moderation/prompt en lib/ y app/, así que el Moderation API de Creem no está integrado. Tampoco aparece «uso aceptable» ni «acceptable use», y /aup redirige a /login.
- Documento desactualizado para corregir en la cosecha: docs/pendientes.md:70 dice que falta el secreto del webhook de Creem, y existe desde el 31/10.
- Comentario desactualizado para corregir en la cosecha: lib/credenciales.ts:808 dice que CREEM_API_KEY está en el .env.local del clon, y en C:/dev/mako-api/.env.local no hay ninguna variable CREEM ni MERCADOPAGO (medido el 5/11).
- Panel de Creem, Saldo › Cuenta de Pago, tienda «hola-MaKo»: 0 de 3 pasos. Dice «Detalles comerciales requeridos». Faltan los detalles del negocio, el KYC o KYB, la revisión de Creem y la cuenta de retiro.

**Mercado Pago:** Medido el 5/11/2026 a las 19:03 UTC, solo con GET y solo agregados: la cuenta está lista para cobrar, pero nadie pagó todavía por MaKo. Lo que está bien: token real, cuenta de Argentina, el id coincide con el guardado, venta habilitada y checkout público en pesos. Lo que falta: las 2 suscripciones creadas en octubre desde los 2 cobros de MaKo siguen pending, es decir, nadie las autorizó. Hay 0 pagos con referencia a un cobro de MaKo y 0 avisos de Mercado Pago en la base. O sea que «ya recibo el dinero» es cierto para la cuenta, pero no está probado de punta a punta por MaKo. Lo que sí entra desde el 1/10 son 16 transferencias a su cuenta, que no pasan por MaKo. Trampa: parecían cobros 16 pagos regular_payment y 6 recurring_payment aprobados, pero en todos el cobrador es otra cuenta; deduzco que son pagos que hizo Martín. Un cobro bueno de MaKo se vería así: en Mercado Pago, un recurring_payment aprobado con external_reference igual al token del cobro; en la base, cobros en pagado con fecha de pago y una fila en pasarela_eventos. Para los recibos (deducción): Mercado Pago no es merchant of record, así que el vendedor es Martín y la factura fiscal no la resuelve la pasarela.

## Los pasos

- Abrí https://www.creem.io/dashboard/balances/accounts y mirá el cartel: Waiting for Creem review, Waiting for your input o Rejected. Si no arrancaste, tocá Set up Payout Account. Es lo primero porque, sin esa aprobación, Creem no deja cobrar en vivo ni retirar, y por API no se puede leer en qué estado estás.
- Antes de pedir la revisión, en Settings → Business Details poné como correo de contacto el mismo que muestra la web. En /terminos y /privacidad sale equipo@hola-mako.com (medido el 5/11). Que no coincidan es uno de los motivos de rechazo más comunes, según Creem.
- Hacé la verificación KYC con tu documento de identidad. Si te das de alta como empresa, además va la KYB con los papeles de la empresa. Pensá bien cómo te das de alta: como persona, la cuenta de retiro tiene que ser personal y a tu nombre; como empresa, de empresa y a nombre de esa entidad. Si no coincide, Creem no libera el retiro.
- Elegí adónde retirar: banco (US$7 o 1 %, lo que sea mayor) o USDC por la red Polygon (2 %). Es una decisión fiscal y cambiaria, y yo no asesoro en eso: llevásela al contador junto con la pregunta 1 de docs/estrategia-financiera-mako.md y con esto: Creem emite por vos la factura de cada retiro y te compromete a no emitirle otra (Merchant Terms §8.1).
- Pedile a soporte de Creem por escrito, con tu Store ID: a) a un banco argentino, en qué moneda llega, por qué socio y con qué tipo de cambio; b) si MaKo necesita la revisión reforzada o el Moderation API por generar imagen y video con IA; c) si AI Avatar entra en su prohibición de manipulación de rostros.
- Cuando haya al menos US$50 disponibles, andá a Balance y apretá Withdraw, cada vez que quieras retirar. No lo hagas a último momento: lo cobrado queda retenido 7 a 12 días. Si cancelás un retiro ya pedido, perdés ese ciclo aunque cambies de cuenta.

## Las condiciones

- Comisión por venta: 3,9 % + US$0,40, calculada sobre el total CON impuesto. Ejemplo oficial: US$20 + US$4 de IVA → US$1,33. Fuente: docs.creem.io/merchant-of-record/finance/payouts y creem.io/pricing.
- Comisión de retiro por banco: 7 USD/EUR o 1 % del retiro, lo que sea mayor. Fuente: payouts y payout-accounts. Cuenta mía: hasta US$700 pagás los US$7 fijos, o sea que retirar US$100 cuesta 7 %, no 1 %.
- Comisión de retiro en USDC por Polygon: 2 %. Fuente: payouts y payout-accounts. Cuenta mía: por debajo de US$350 sale menos que el banco.
- Conversión: el retiro se paga en la moneda de la cuenta registrada. Si difiere de la moneda de cobro, el socio bancario aplica una comisión aparte, sin monto publicado. Fuente: payouts y payout-accounts.
- Mínimo: 50 USD o 50 EUR de saldo para que se habilite Withdraw. Fuente: payouts y guides/faq.
- Frecuencia: el 1 y el 15 de cada mes; si cae feriado o fin de semana, el siguiente día hábil. Se pide a mano con Withdraw, que te pone en la cola de la próxima fecha; no hay retiro automático documentado. Fuente: payouts y guides/faq.
- Retención: 7 a 12 días por riesgo. Para el pago del 15 entra lo cobrado antes del 8; para el del 1, lo cobrado antes del 23. Fuente: payouts y guides/faq.
- Retención extra: Creem puede retener o congelar retiros, incluso como reserva para contracargos, e investigar hasta 90 días. También puede descontar reembolsos y contracargos. Fuente: creem.io/terms v2.0 §10.5, §10.6, §11.7.
- Medios: transferencia bancaria (SEPA/internacional), USDC por Polygon y Alipay solo en China. PayPal no. Fuente: guides/faq y payout-accounts.
- Argentina: figura entre los países admitidos para vendedores, con banco local. Fuente: docs.creem.io/merchant-of-record/supported-countries, leído el 5/11/2026.
- Verificación: Business Details → KYC/KYB → cuenta de retiro → revisión de Creem → pagos en vivo. La revisión tarda 1 a 2 días hábiles, hasta 3. Mientras no apruebe, se puede probar pero no cobrar en vivo. Un rechazo es definitivo para esa tienda. Fuente: payout-accounts, account-reviews, re-review-guide, rejected-accounts y creem.io/terms §5.7.
- Pantalla: Balance → Payout Account (creem.io/dashboard/balances/accounts). Ahí se hace la verificación, se carga la cuenta y se pide una nueva revisión. Cada tienda configura su propia cuenta. No podés borrar una cuenta vieja sin soporte. Fuente: payout-accounts y guides/faq.
- Requisitos de la revisión: dominio propio, producto en vivo, privacidad y términos visibles, precios visibles, correo de soporte visible y coincidente, sin datos falsos y sin productos prohibidos. Fuente: account-reviews.
- Riesgo para MaKo (deducción mía): la IA generativa de imagen o video, los servicios de cualquier tipo y la generación de leads B2B son rubros restringidos. Piden historial con la pasarela anterior, tasa de contracargos y motivo del cambio. Fuente: account-reviews.
- Riesgo para MaKo (deducción mía): generar imagen o video desde un prompt exige Moderation API en producción y política de uso aceptable visible. Los productos de manipulación de rostros están prohibidos, y existe app/ai-avatar. Fuente: account-reviews y ai-wrapper-compliance.
- Comprobante de cada retiro: Creem deja descargar una factura inversa en la pestaña de actividad de retiros. La factura se da por aceptada si no objetás en 3 días hábiles. Fuente: payouts y creem.io/terms §8.1–8.2.
- Contradicción sobre el socio bancario: supported-countries habla de Wise; la página de afiliados nombra Paysway para banco y Mural para USDC, aunque esa página trata de afiliados. Falta confirmarlo con Creem.
- Contradicción con nuestro documento: docs/estrategia-financiera-mako.md:1108 dice que gira a Argentina en dólares por SWIFT; Creem habla de banco local y de la moneda de tu cuenta. Además, el 5,75 % de ese documento supone el 1 % del banco y no vale para retiros menores a US$700.
- Dato de Wise, si Creem usara esa vía: Wise envía a Argentina en pesos, a un CBU con CUIT/CUIL, con tope equivalente a US$18.000 por mes calendario. Fuente: wise.com/help/articles/2962718/ars-transfers.
- Contradicciones menores de Creem: dice 87 países y un título dice 86 (la tabla tiene 87 filas); la revisión figura como 24–48 h en el FAQ y 1–2 días hábiles en otra página; los impuestos, como 50+ países en precios y 190+ en la documentación.

## Si Creem manda comprobante

Sí, según su documentación, aunque no está visto en la práctica porque hay 0 ventas. Creem es el vendedor legal (Buyer Terms v2.0 §3.3.1). El comprador recibe confirmación de pago y factura emitida por Creem, más un recibo por email con el contacto del comerciante al pie (§6.4 y §9.1). Se genera una factura por cada transacción, y el comprador la ve en el Customer Portal; el comerciante la baja desde el detalle de la transacción (guides/faq). Tras cada pago también llega un email con enlace al portal (features/customer-portal), y creem.io/pricing dice que las facturas se generan y se envían solas. Para el diseño de los recibos (deducción): en una venta de Creem, MaKo no debería emitir otra «factura». Corresponde una confirmación o recibo de pago, por email y WhatsApp, que aclare que la factura la emite Creem, más el registro en SuperAdmin. El PDF no se puede traer por API: la transacción no tiene campo de factura y el OpenAPI no menciona recibos. Lo que sí se puede es generar un enlace al portal con POST /v1/customers/billing. Pasa distinto con Mercado Pago y Binance, donde Creem no interviene.

## Sin verificar

- Estado de la tienda de Martín en Creem (revisión, KYC y cuenta de retiro cargada). La API no lo expone y no usé su Chrome. Tener clave real y aviso habilitado no prueba que esté aprobada.
- Si el primer cobro real de Creem funciona. Con 0 productos, nunca se creó nada en vivo. Tampoco medí que un visitante de otro país de LATAM vea Creem: sale del código y no pude simularlo desde Argentina.
- Si Creem aprueba a MaKo. Los rubros restringidos, el Moderation API y AI Avatar frente a la prohibición de manipular rostros son deducciones mías; solo Creem puede contestarlo.
- En qué moneda, por qué socio y a qué tipo de cambio llega el retiro a un banco argentino, si admite cuenta en dólares, y si el tope de Wise aplica a esta vía.
- Formato del comprobante de Creem: si la factura va adjunta o por enlace, en qué idioma, qué datos pide y si se puede personalizar. Se vería con una compra en modo de prueba, si el modo de prueba manda ese correo.
- Comisión por contracargo. docs/estrategia-financiera-mako.md dice US$25; los términos de Creem no fijan monto y hoy no lo confirmé en una fuente oficial.
- Si el aviso de Mercado Pago llega a producción. Hay 0 avisos, pero no sé si Mercado Pago avisa por una suscripción que queda pending. Se sabrá con el primer pago real.
- Que los pagos de Mercado Pago con otro cobrador sean gastos de Martín: el cobrador distinto está medido, pero el pagador viene oculto. Tampoco miré pagos anteriores al 1/10.
- Tratamiento fiscal y cambiario en Argentina (ARCA, BCRA, factura inversa frente a Factura E): es para el contador. No lo verifiqué y no doy asesoramiento financiero.

## Fuentes

- https://docs.creem.io/merchant-of-record/finance/payouts (leído 5/11/2026)
- https://docs.creem.io/merchant-of-record/finance/payout-accounts (5/11/2026)
- https://docs.creem.io/guides/faq (5/11/2026)
- https://docs.creem.io/merchant-of-record/supported-countries (5/11/2026)
- https://docs.creem.io/merchant-of-record/account-reviews/account-reviews (5/11/2026)
- https://docs.creem.io/merchant-of-record/account-reviews/re-review-guide (5/11/2026)
- https://docs.creem.io/merchant-of-record/account-reviews/rejected-accounts (5/11/2026)
- https://docs.creem.io/merchant-of-record/account-reviews/ai-wrapper-compliance (5/11/2026)
- https://docs.creem.io/merchant-of-record/what-is (5/11/2026)
- https://docs.creem.io/for-customers/why-creem-charged-me (5/11/2026)
- https://docs.creem.io/features/customer-portal (5/11/2026)
- https://docs.creem.io/features/affiliate-program (5/11/2026)
- https://docs.creem.io/getting-started/dashboard-overview (5/11/2026)
- https://docs.creem.io/api-reference/openapi.json (5/11/2026)
- https://www.creem.io/pricing (5/11/2026)
- https://www.creem.io/terms (versión 2.0, vigente desde 5/8/2026)
- https://www.creem.io/buyer-terms (versión 2.0, vigente desde 5/8/2026)
- https://wise.com/help/articles/2962718/ars-transfers (5/11/2026)
- https://wise.com/help/articles/2571942/what-countriesregions-can-i-send-to (5/11/2026)
- Repo origin/main f8412c6be: docs/hallazgos-planes-y-cobro.md, docs/estrategia-financiera-mako.md, docs/pendientes.md, app/api/webhooks/creem/route.ts, lib/compra-plan-reglas.ts, lib/compra-plan.ts, lib/mercadopago-api.ts
- Evidencia sin claves: C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/4d1a09d4-c870-4075-94b3-7d1450a71bcc/scratchpad/recibos/medicion-base.json
- Evidencia sin claves: C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/4d1a09d4-c870-4075-94b3-7d1450a71bcc/scratchpad/recibos/medicion-pasarelas.json
- Evidencia sin claves: C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/4d1a09d4-c870-4075-94b3-7d1450a71bcc/scratchpad/recibos/medicion-mp-direccion.json

## El alta, medida en el panel y en la documentación (5/11/2026, de noche)

**El borrador está a nombre de Leandro, como persona,** con los datos que Meta ya verificó. Los pasos 1 a 3 están guardados. El 4 son cuatro declaraciones y «Submit for review»: no se envió.

**La moderación anda con la tienda sin aprobar:** una llamada real con la clave de producción contestó 200, `allow`, 1 unidad. Era lo que la nube no pudo probar.

**Lo que puede frenar la revisión, leído en la documentación de Creem** (account-reviews y ai-wrapper-compliance):
- **Prohibido:** «Face-swap, deepfake, and face-manipulation tools of any kind». AI Avatar genera videos nuevos de una persona real hablando. Nadie de MaKo puede contestar si entra ahí: lo contesta Creem, y su documentación dice que, ante la duda, se le pregunte antes de vender.
- **Restringido:** servicios de cualquier tipo (el Acelerador), IA generativa y software B2B de generación de leads. Los tres piden datos de la pasarela anterior, tasa de contracargos y motivo del cambio, y «un historial probado». MaKo no tiene historial: 0 cobros por pasarela.
- **También en la lista de prohibidos:** herramientas que bajan contenido de terceros violando sus términos («Instagram downloaders») y de abuso de plataformas. Mirar Spy y la línea no oficial de WhatsApp con esa lupa si Creem pregunta.
- **Un rechazo es definitivo para esa tienda,** y la casilla del paso 4 dice que no se revisa otra vez por 3 meses. «Changes requested» es otra cosa y sí se puede volver a pedir.
- **La regla de «no fake reviews, testimonials or inflated counts»** es del checklist. El reloj del 50 % no se nombra, pero un reinicio en otro navegador se parece a eso.

**Antes de enviar, entonces:** preguntar a soporte por AI Avatar. El borrador está en `docs/relevo/nube-creem-revision.md`.
