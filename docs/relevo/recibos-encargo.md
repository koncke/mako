# Encargo: recibos de pago por correo y WhatsApp, con registro en SuperAdmin (5/11/2026)

Lo escribió el Cerebro con tres revisores, leyendo el código y la base de producción el 5/11. Es para la sesión que lo construya, que no vio esa conversación.

## El pedido, textual

Martín: «es súper importante que hagas un template que eso se envíe siempre por email de los recibos de compra. En este caso también por WhatsApp, que se envíe básicamente los recibos de las compras que van haciendo. Ya tenemos con Mercado Pago o con la otra que tenemos Creem. Entonces es súper importante que los usuarios puedan comenzar a recibir sus facturas. [...] me gustaría que todo esto lo vayamos evidentemente guardando dentro de la aplicación, dentro de SuperAdmin tal vez, para que tengamos un registro.»

## Cómo leer esto

- **Donde un agujero contradice al diseño, gana el arreglo del agujero.** El diseño se escribió primero y otro revisor lo rompió después, contra el código real.
- Entrega por `punta/recibos` y deja lo que le toca al Cerebro en `docs/relevo/nube-recibos.md`. Sin base ni producción desde la nube: nada de POST a `/api/planes/comprar`.
- Cosecha en `docs/hallazgos-planes-y-cobro.md` y su índice, en el mismo commit.

## Lo que cambió después del diseño (gana sobre lo de abajo)

- **La 0358 ya está aplicada** (5/11, medido antes y después). Ignorá el paso 0 del diseño y lo de pedirle el sí a Martín: una migración que sólo agrega se aplica sin preguntar.
- **El número de la migración:** elegilo al subir, barriendo main y las ramas. `0394` está dos veces y hay una `0396` en camino. Avisá en el relevo que se confirma al aplicar.
- **Los recibos 0001 y 0002 ya salieron a mano** por WhatsApp y correo, y se entregaron. El próximo es el 0003. Sus datos están en `C:/dev/cerebro-herramientas/cobros/codigo-inmobiliario/registro.json`, en la PC, con los PDF y los comprobantes: el script de carga lo corre el Cerebro desde ahí.
- **Los 2 USDT de más de octubre no se toman en cuenta** (Martín). No son saldo a favor ni aparecen en ningún PDF; quedan sólo como `nota_interna`.
- **`workspaces.nombre` tiene errores: el nombre del recibo no puede salir de ahí sin que alguien lo mire.** El negocio 20 dice «Sergio Arriata» y es Arratia; el 19 dice «Natalia» y es Natalia Krywyj; el 17 dice «Giselle Belanti» y sus correos dicen Bellanti. `usuarios.nombre` acertó en los dos primeros.
- **`punta/agencia-cobro` tiene instrucciones nuevas del 5/11:** `COBRA_LOS_DIAS_DEL_PRIMER_MES = false`, noviembre US$238, diciembre US$426, y un diferencial aparte hasta el próximo 5 (`docs/hallazgos-agencias.md`). Puede no haberlas tomado todavía: medí su punta, no asumas.
- **La tienda de Creem no está aprobada** (panel, 5/11: 0 de 3 pasos). No hay cómo ver una venta real de Creem: lo que dependa de eso queda sin verificar, y se dice.
- **Lo que hay que decirle a Martín con estas palabras:** el recibo por WhatsApp sólo llega a un negocio que ya tiene grupo. A un comprador nuevo le llega por correo y por la app.

## Qué pasa hoy cuando entra un pago

- MEDIDO, 5/11/2026 18:58-19:07 UTC, base de producción, sólo lectura (árbol leído: origin/main f8412c6be): `cobros` tiene 2 filas en TODA la base, las dos de Mercado Pago, `pendiente`, en el ws 9 (ARS 73.555 y 151.805, del 31/10). 0 pagadas, 0 reembolsadas. `pagos` con proveedor: 0. `pasarela_eventos`: 16 de Stripe `ignorado`, 0 de Mercado Pago, 0 de Creem. Conclusión: el camino de abajo nunca corrió con plata de verdad en la plataforma. Lo que sigue es lectura de código salvo lo marcado MEDIDO.
- ⚠️ BLOQUEO, MEDIDO tres veces hasta las 19:07 UTC: los CHECK `cobros_proveedor_check`, `pagos_proveedor_check` y `pasarela_eventos_proveedor_check` sólo aceptan stripe y mercadopago: la migración `0358_cobros_pasarela_creem.sql` NO está aplicada en producción. Las claves y el ruteo de Creem en el ws 9 sí están (31/10 19:22 UTC). El diagnóstico obvio era «Creem está conectado»; docs/hallazgos-infra.md:47 explica por qué pasó de largo: hubo dos 0358. DEDUCIDO leyendo (sin POST, prohibido): a un comprador de LatAm fuera de Argentina `pasarelasDelPais` (lib/compra-plan-reglas.ts:262) le toca Creem, `crearCobro` inserta antes de ir a la pasarela (lib/cobros.ts:503), el INSERT da 23514, contesta «No pude guardar el cobro» (lib/cobros.ts:532) y la persona ve «No pudimos abrir el pago» (lib/compra-plan.ts:408). Y un aviso de Creem chocaría en `reclamarEvento` (app/api/webhooks/creem/route.ts:137 → :144), que contesta 200 porque 23514 no es transitorio: se pierde.
- ALTA por Mercado Pago: app/api/webhooks/mercadopago/route.ts:130 relee, :140 reclama por `<tipo>:<id>:<estado>`, :149 aplica → lib/cobros-webhook.ts:447 → `aplicarPagoAprobado` lib/cobros.ts:770. Adentro: :788 pasa a pagado con compare-and-set; :885 la cuota; :906 gana el lead; :934 `altaSiCorresponde` → :1209 `darDeAltaCliente`, que manda el correo de ACCESO; :959 `avisarPagoRecibido` → :992 `emitirDelCatalogo('pago-recibido')` con ws = el del cobro (9), o sea al equipo de MaKo (MEDIDO: fila #714 «Entró un Pago» prendida en el ws 9); :960 `alCron` → lib/pago-entrante.ts (MEDIDO: el ws 9 no tiene otra automatización con disparador de pago). A QUIEN PAGÓ le llega: el correo de acceso si la cuenta es nueva, la página /pagar/<token>/listo, y lo que mande la pasarela. Ningún recibo.
- ALTA por Creem (cuando la 0358 esté aplicada): app/api/webhooks/creem/route.ts:92 cuerpo crudo, :102 ruteo por `?w=`, :110 firma fail-closed, :137 reclamo por `evt_…`, :148 → `procesarEventoCreem` lib/cobros-webhook.ts:490. Suscripción: :521 relee, :526 busca transacciones, :537 `aplicarPagoAprobado` con el id de la TRANSACCIÓN y `ultima.monto`, que es SIN impuesto. Único: :547-552 por el checkout. Mismo destino que Mercado Pago. Ningún recibo.
- RENOVACIÓN: Mercado Pago lib/cobros-webhook.ts:447 con `pago.id`, `pago.monto`, `pago.moneda`; Creem :537; Stripe :249. `esRenovacion` lib/cobros.ts:804. No crea fila nueva en `cobros`: una suscripción es UNA fila, y cada mes es una cuota en `pagos` (:885, sólo si hay lead y valor en dólares). Sale el aviso al equipo (:959). A quien pagó, nada. La red no la cubre: `reconciliarCobros` lib/cobros.ts:2063 mira pendientes (:2089) y pagados sin cuota o sin alta (:2140-2147); una renovación cuyo aviso se perdió no la recupera nadie (ya anotado en docs/hallazgos-planes-y-cobro.md:1652).
- RECONCILIACIÓN: app/api/cron/cobros-reconciliar/route.ts:79, `17,47 * * * *` → `pagoDelLinkEnLaPasarela` lib/cobros.ts:2213 → :2169 `aplicarPagoAprobado`; repara pagados con :2149. Cae en la MISMA función que el aviso: por eso el recibo se engancha ahí y una sola vez.
- REEMBOLSO: Mercado Pago total lib/cobros-webhook.ts:457-458, parcial :448; Creem :581-594 (lee `refunded` o `partialRefund` de la transacción); Stripe :319; a mano `reembolsarCobro` lib/cobros.ts:1665 (Creem contesta «desde el panel de Creem»). `aplicarReembolso` :1353: parcial, sólo historial (:1356-1358); total del primer pago, `estado='reembolsado'` (:1362) y desmarca la cuota (:1369). A quien pagó, nada desde MaKo.
- CONTRACARGO: Mercado Pago lib/cobros-webhook.ts:462-468 y Creem :596-605 con `plataAfuera: null`; Stripe :286. `aplicarContracargo` lib/cobros.ts:1465 escribe `motivo` y el historial. Nadie recibe nada.
- CLIENTE DE AGENCIA por pasarela: `linkPrimerMes` lib/agencia-cobro.ts:89 crea el cobro en la plataforma, atado a la ficha de la AGENCIA (:94) con `agencia_ws` y `cliente_ws`, y `email` es el de quien paga. Al pagar: `habilitarClienteDeAgencia` lib/agencia-habilitar.ts:72 aprueba la cartera y `avisarClienteAprobado` manda el correo de acceso AL CLIENTE. A la agencia, del pago, nada. El único correo de cobros a la agencia es el del rechazo: `avisarRechazoALaAgencia` lib/plan-deuda.ts:291.
- BINANCE (Código, ws 13): en main no hay código. MEDIDO: 0 cobros de la agencia 13, 0 settings `agencia.mensualidad.*`, `agencia_clientes.cobra_desde` no existe (la rama no está mezclada). MEDIDO: los recibos N.º 0001 y N.º 0002 ya salieron A MANO hoy a las 16:07 ART, por WhatsApp al grupo (`grupo_mensajes` 66 y 67, 19:07 UTC, «(archivo en WhatsApp)») y por correo (ids de Resend en C:/dev/cerebro-herramientas/cobros/codigo-inmobiliario/registro.json). El registro no existe todavía: ese JSON dice «El próximo recibo es el 0003».

## Lo que ya existe

- Tabla `cobros` (migs 0255, 0308, 0326, 0328, 0330, 0334), 48 columnas MEDIDAS: id, workspace_id, token, lead_id, pago_id, producto_id, proveedor, modo, tipo, concepto, monto, moneda, monto_usd, email, nombre, estado, suscripcion_estado, proveedor_ref, proveedor_pago_id, proveedor_suscripcion_id, url_proveedor, url_vence_at, alta_capa, alta_ws, alta_estado, alta_motivo, alta_email_cambios, motivo, creado_por, created_at, updated_at, pagado_at, reembolsado_at, agencia_ws, cliente_ws, inicio_at, plan_producto, trato_estado, trato_at, trato, cuenta, cuenta_ref, plan_mako, origen, ref_codigo, meses, prueba_huella, prueba_aviso_at. NO SIRVE como registro de recibos, por cuatro motivos medidos: `proveedor` sólo admite pasarelas; `moneda ~ '^[A-Z]{3}$'` rechaza USDT; una suscripción es una sola fila aunque cobre 12 veces; y las lecturas de vigencia y MRR la consideran plata cobrada por pasarela. `agencia_ws` y `cliente_ws` no están en `COLS_COBRO` (lib/cobros-tipos.ts:208): se leen aparte.
- Tabla `pagos`: las cuotas del CRM, con `pagos_proveedor_uk (workspace_id, proveedor, proveedor_pago_id)`. Es el molde de la idempotencia. Exige lead y `monto_usd`: no cubre un cobro sin ficha ni Binance.
- `pasarela_eventos` deduplica AVISOS, no pagos. No alcanza: un reenvío a mano desde el panel de Creem llega con `id` nuevo (app/api/webhooks/creem/route.ts:34-37), y la reconciliación no pasa por ahí.
- Pantalla: /admin/cobros sólo redirige (app/admin/cobros/page.tsx) a /customers?tab=billing, que monta `ContenidoCobros` (app/customers/page.tsx:61, app/admin/cobros/Contenido.tsx). `ListaCobrosMako.tsx` da el molde de fila (Celda, Status, useConfirm, Toast). `actions.ts` pone `getSesionAdmin()` en la primera línea de cada acción y resuelve el ws con `wsSuperAdmin()`; lo fija tests/admin-cobros.test.ts. Teléfono: app/m/cobros (CobrosM.tsx), que deja en la computadora lo que mueve plata.
- PDF: lib/pdf-escritor.ts (`PdfDoc`, :164) no hace imágenes a propósito (:16-18: «si hace falta, ahí sí conviene la librería»). Sirve de él `textoParaPdf` (:68), el saneador WinAnsi. `jspdf` ^4.2.1 ya está en package.json:54, y hoy en main sólo se usa en el navegador (app/partners/RecursosPartner.tsx:50). MEDIDO: en Node, con el PNG real de 158 KB, 253 ms y un PDF de 140.798 bytes, legible con `unpdf` (package.json:82). Los recibos 0001 y 0002 los hizo jsPDF 4.2.1 (metadato /Producer) y son la plantilla a copiar: «Recibimos de», «Total recibido», «Qué se pagó» (Concepto, Mes, Importe), «Cómo se pagó» (Fecha y hora, Medio, Order ID, Monto), nota, pie «Este recibo acredita el pago. No es una factura fiscal. Es sólo para X.», y la página 2 con los comprobantes.
- Correo: `sendEmail` lib/resend.ts:220 SÍ admite `attachments` (:215, :257). No manda `Idempotency-Key`. `enviarDePlataforma` lib/invitaciones.ts:88 (privada; remitente de MaKo, sin baja, corre en el ws de la plataforma) y `avisarDePlataforma` :356 NO pasan adjuntos y aceptan un solo `to`. `renderEmailHtml` maqueta el texto.
- WhatsApp: `enviarPartesAlGrupoMaKo` lib/mako-grupo.ts:1129 manda PDF con pie (`PartePreparada` tipo media, lib/mako-tarjeta.ts:257); `grupoJidEstricto` :205 distingue «sin grupo» de «no pude leer»; `anotarLoDelEquipo` :1100 deja el mensaje en lo que ve el turno (corta a 300 caracteres: lo importante en el primer renglón). `copiarAlGrupo` lib/grupo-app.ts:143 copia al hilo de la app y acepta PDF; `atarIdDeWhatsApp` :219. El molde exacto es lib/probar-grupo-envio.ts:52-55. La guarda tests/grupos-ops-guarda.test.ts:64 (`LLAMADORES.enviarPartesAlGrupoMaKo`) da rojo con un llamador nuevo: hay que sumarlo con su porqué. Lo aprendido: docs/hallazgos-comunicacion.md, «Mandar un archivo al grupo de un negocio desde un script».
- `aLaAgencia` (lib/avisos-catalogo.ts:69, :488, :510; lib/aviso-evento.ts:554) reparte por CLASE de aviso, y un evento de plataforma sin fila prendida no sale. No sirve para un recibo, cuyo destino depende de quién paga ESE cobro y que tiene que salir siempre. Lo que sí queda: la fila #714 sigue avisándole al equipo de MaKo.
- Quién paga: `KEY_QUIEN_PAGA` y `quienPagaDe` lib/agency-reglas.ts:50,56 (en `app_settings` DEL CLIENTE; sin clave, paga la agencia. MEDIDO: 0 filas con esa clave hoy). ⚠️ Dos piezas que NO se reusan tal cual: `agenciaDelCobro` lib/plan-deuda.ts:251 devuelve null si la cartera no está `aprobado`, y ese null mandaría el recibo como «cobro propio» a `cobro.email`; `adminsDeCuenta` lib/agencia-baja.ts:75 se traga el error de lectura y lo convierte en «sin admins».
- Comprobantes: bucket privado `contratos` (el de las cuotas, app/api/extract-receipt/route.ts:63); `sniffImagen` lib/editor-landing/server-reglas.ts:529 para validar por bytes. Los tres PNG de Binance y los dos PDF ya mandados están en C:/dev/cerebro-herramientas/cobros/codigo-inmobiliario/, con registro.json.
- `CAPACIDADES_PASARELA[p].merchantOfRecord` (lib/cobros-tipos.ts:89, :95, :114) ya distingue a Creem sin ternarios. `TransaccionCreem.montoPagado` e `.impuesto` ya se leen (lib/creem-api.ts:443-456) y nadie los usa. `formatoMonto` lib/pasarela-moneda.ts:83 ya escribe `146 USDT`.

## El diseño

- 0. ANTES DE TODO: aplicar la 0358 (Creem). Es otra migración, ya escrita, que sólo ensancha tres CHECK, y necesita el sí de Martín en el chat. Sin ella no existe ningún pago de Creem del cual emitir un recibo.
- 1. DÓNDE VIVE. Tres tablas nuevas y ningún cambio en `cobros`: `recibos` (el documento), `recibo_pagos` (cada entrada de plata, una o varias por recibo) y `recibos_numeracion` (una fila con `ultimo`). SIN `workspace_id`: es el libro de la plataforma, y el recibo sobrevive al borrado de un cliente (las FK a `workspaces` van `on delete set null`, con el nombre guardado como foto). Por eso no entran en TENANT_TABLES ni en TABLAS_DE_INQUILINO. Sólo se emite si `c.workspace_id === await wsSuperAdmin()`, en positivo, como `altaSiCorresponde`: un cliente que vende con su pasarela no genera recibos de MaKo. Binance NO entra a `cobros` ni a `pagos`.
- 2. NUMERACIÓN E IDEMPOTENCIA. El número lo da sólo la función SQL `emitir_recibo(p jsonb)` (texto en el campo migración): toma el candado de la fila de numeración, mira si ya existe, y recién ahí suma uno e inserta, todo en una transacción: correlativo, sin huecos y sin carreras. Formato `0003`, cuatro dígitos, sin reinicio anual. Hay dos llaves únicas: `recibo_pagos (medio, referencia)`, que es la del PAGO y nunca la del evento (sirve igual para aviso repetido, reenvío a mano, reconciliación y orden de Binance), y `recibos.clave` (`pago:<medio>:<id>`, `mensualidad:<agencia>:<AAAA-MM>`, `form:<uuid>`). Si alguna ya existe, devuelve ese recibo con `ya_estaba = true` y no gasta número. `ultimo` nace en 2 porque 0001 y 0002 ya salieron. Un `numero` explícito sólo se acepta si es ≤ `ultimo` y está libre (es para cargar esos dos). Un recibo no se borra nunca.
- 3. PLANTILLA PDF: `lib/recibo-pdf.ts`, puro y sin `server-only`: recibe la foto del recibo y los bytes de los comprobantes y devuelve `Uint8Array`, siempre el mismo layout para todas las pasarelas, copiado del 0002. Motor: jsPDF, con `await import('jspdf')` y `serverExternalPackages: ['jspdf']` en next.config.ts. Todo texto pasa por `textoParaPdf`; toda línea larga, por `splitTextToSize`, midiendo el alto (hallazgos-agencias: `maxWidth` parte la línea y la altura no se ajusta). ⚠️ DETERMINISTA: `setCreationDate(emitido_at)` y `setFileId(hash del número)`, porque si no cada render cambia bytes y Resend contesta 409 `invalid_idempotent_request` al reintentar con la misma clave. Lo fija un test: dos renders dan los mismos bytes. Comprobantes: página 2, «Comprobante(s) de <medio>», imágenes con su fecha, sólo JPEG o PNG. Una etiqueta `Medio` y `Referencia` por pago; en Binance el rótulo sigue siendo la orden. Pie fijo, no editable: «Este recibo acredita el pago. No es una factura fiscal. Es sólo para <a_nombre>.» No se guarda el PDF: se rearma de la foto. Excepción: `pdf_path` en 0001 y 0002, que sirven los bytes que de verdad se mandaron.
- 4. REGLAS PURAS: `lib/recibos-reglas.ts`, con test: `claveDeRecibo`, `destinoDelRecibo` (ver 8), `lineaDelCobro`, `numeroEnTexto`, `textoCorreo`, `pieWhatsApp`, `leyendaDelMedio`, `diferencia`. Los campos que el PDF imprime y los que no son distintos: `nota_pdf` se imprime, `nota_interna` sólo se ve en SuperAdmin (el 0001 trae «Los 2 USDT de más no se toman en cuenta» sólo como nota interna, y el PDF ya enviado no lo dice). Toda diferencia entre pasarelas va en `Record<Pasarela, …>` o se lee de `CAPACIDADES_PASARELA`: ningún ternario de dos ramas (AGENTS.md y hallazgos-planes-y-cobro).
- 5. MONEDA: lo que cobró de verdad, sin convertir nunca. Mercado Pago: `pago.monto` y `pago.moneda` (pesos). Creem: `montoPagado` (`amount_paid`, CON impuesto), y aparte una línea «Impuesto incluido: X, lo cobra y remite Creem» si `impuesto` viene; si `montoPagado` no viene, `monto`, y si no, el del cobro. Binance: USDT. Para eso `aplicarPagoAprobado` suma a sus parámetros `montoCobrado?` e `impuesto?`, que SÓLO usa el recibo: el cash sigue asentando lo mismo. Los pasan lib/cobros-webhook.ts:537 y :552 y lib/cobros.ts:2213 (rama Creem); `leerCheckoutCreem` lib/creem-api.ts:309 suma `montoPagado`. El detalle puede estar en otra moneda que lo recibido (US$ contra USDT): el recibo muestra los dos totales y no calcula tasa. `recibo_pagos.monto_usd` es un valor DECLARADO (el del cobro; en el formulario se completa igual al monto si la moneda es USDT o USDC, y se puede editar), como pide la regla de «nunca una tasa inventada». El registro suma por moneda, nunca entre monedas.
- 6. EL GANCHO: dos líneas en `aplicarPagoAprobado`, lib/cobros.ts, y es el único punto, porque aviso, cron y repetidos pasan por ahí. (a) Después de la línea 818, ANTES del CRM (que puede tirar en :856 y :896): `const recibo = await reciboDelPago(actual, { proveedorPagoId, monto, moneda, montoUsd, impuesto, pagadoAt, renovacion }).catch(log)`. Sólo si `actual.modo === 'real'`, la plataforma, y no `enCero`. El retorno temprano de :798 (reentrega de un pago devuelto) ya queda antes y no emite. (b) Después de la línea 949, antes del paso 6: `await despacharRecibo(recibo?.id)`, sin tirar nunca: la plata ya entró. NO depende de `actual.lead_id`, a diferencia de `avisarPagoRecibido`. Un link anulado que igual se pagó tiene recibo: es plata que entró.
- 7. SALIDA: `despacharRecibo(id)` en `lib/recibos.ts` hace correo y WhatsApp, por separado, cada uno en su try. Primero el correo. Correo: compare-and-set `correo_estado` de pendiente (o `enviando` de hace más de 10 min, o `fallo` con menos de 5 intentos y 30 min quieto) a `enviando`, ANTES del POST; se manda con cabecera HTTP `Idempotency-Key: recibo-<id>-<lote>` (dura 24 h, medido en la doc de Resend), para lo cual `sendEmail` suma `idempotencyKey?`; al volver, `enviado` con `correo_id`, o `fallo` con el error. Al quinto fallo, un correo a `EMAIL_MAKO` y queda rojo en el registro. WhatsApp: compare-and-set de pendiente a `enviando`, UNA vez y SIN reintento automático, porque un error de Evolution no prueba que no haya salido (hallazgos-comunicacion). Un `enviando` de más de 10 min pasa a `fallo`, «no sé si salió». Lo vuelve a mandar una persona con «Reenviar».
- 8. A QUIÉN (`destinoDelRecibo`, puro; el detalle está en el campo a_quien_le_llega). Se lee `agencia_ws` y `cliente_ws` del cobro aparte de `COLS_COBRO`. Con los dos y `agency.quien_paga` leído ESTRICTO: si la lectura falla, tira y el recibo queda sin salir hasta que el cron lo reintente, nunca cae a «no es de agencia». No se usa `agenciaDelCobro` (su null por cartera no aprobada mandaría el PDF al correo equivocado) ni `adminsDeCuenta` (se traga el error): `adminsEstricto(ws)` en lib/recibos.ts. Sin nadie a quien mandarle: `correo_estado='sin_destino'`, y un correo a `EMAIL_MAKO`. Los destinatarios y el `destino_ws` se resuelven al despachar y no al emitir, porque `alta_ws` recién existe después del alta (:934).
- 9. CORREO: `lib/invitaciones.ts`: `MailDePlataforma` y `enviarDePlataforma` suman `adjuntos?` e `idempotencyKey?`, y `to` admite lista; nueva `mandarReciboPorEmail({ to: string[], asunto, preheader, cuerpo, pdf, nombrePdf, idempotencyKey })`. Un solo POST y un solo id para todos. Tag `recibo`. Remitente MaKo (`REMITENTE_MAKO`). Asunto: `Tu recibo de MaKo N.º 0003`. Preheader: `Recibimos tu pago.`. Cuerpo, español neutro: «Hola,» / «Recibimos tu pago de {monto} por {concepto}, el {fecha}, por {medio}.» / «Te adjunto el recibo N.º {numero} en PDF.» / «Es un recibo de pago, no una factura fiscal.» + la leyenda del medio / «Si algo no coincide, escríbenos a {EMAIL_MAKO}.» Adjunto: `MaKo - Recibo 0003 - noviembre - <nombre>.pdf`.
- 10. WHATSAPP: en `lib/recibos.ts`, con el molde de lib/probar-grupo-envio.ts:52-55: `grupoJidEstricto(ws)`; null → `wa_estado='sin_grupo'` y no se copia a nada. Con grupo: `copiarAlGrupo(ws, { texto: pie, de: 'equipo', avisoTipo: 'recibo', partes })`, después `enviarPartesAlGrupoMaKo(ws, partes)`, después `atarIdDeWhatsApp` y `anotarLoDelEquipo(ws, pie, id)`. Parte: `{ tipo:'media', base64, media:{ tipo:'document', mimetype:'application/pdf', fileName }, caption }`. Pie, con lo importante en el primer renglón: «Recibo de pago N.º 0003: US$ 47 por Creem, recibido el 5/11. El detalle está en el PDF.\n\n— Equipo de MaKo». Resultado: `enviado`; `en_app` si falló y quedó en el hilo; `fallo` si tampoco. Sumar `lib/recibos.ts` a `LLAMADORES.enviarPartesAlGrupoMaKo` en tests/grupos-ops-guarda.test.ts, con «copia antes». Nada le escribe a una persona: sólo grupos, así que no toca lib/mako-salida.ts.
- 11. LA RED: `recibosQueFaltan()` y `despacharPendientes()` en lib/recibos.ts, llamados desde app/api/cron/cobros-reconciliar/route.ts después de `renovacionesDeAgencia` (:99), con la misma reserva de tiempo, sin cortar la respuesta y sin cron nuevo. Emite los que faltan, tope 50 por vuelta, para `modo='real'` en la plataforma: `cobros` pagados o reembolsados con `proveedor_pago_id` sin recibo, y `pagos` con `cobro_id` y `proveedor_pago_id` sin recibo (cubre una renovación con la cuota asentada y el recibo cortado). Despacha, tope 20, los pendientes de más de 5 min y los `fallo` de correo reintentables. Emite con el monto de lo asentado. Si no se puede leer, no inventa: lo deja para la próxima.
- 12. REEMBOLSO. El recibo emitido no se borra ni se renumera. `marcarDevolucionDeRecibo(medio, referencia, { total, monto? })`, llamado en `aplicarReembolso` ANTES del `return` del parcial (lib/cobros.ts:1356), con `pagoId = p.proveedorPagoId ?? c.proveedor_pago_id`. Compare-and-set: total → `estado='devuelto'`; parcial → `devuelto_parcial`, con el monto si se conoce (nunca se compara `refunded_amount` de Creem contra `amount`). Se manda UNA vez un correo a los mismos destinatarios, sin WhatsApp: «Tu recibo N.º 0003 quedó devuelto», con el mismo PDF y un sello arriba «DEVUELTO el dd/mm/aaaa» o «DEVOLUCIÓN PARCIAL». Mismo número, sin nota de crédito, porque no es un documento fiscal. Devolución fallida (`aplicarReembolsoFallido`, :1414): vuelve a `emitido` sólo si `!sigueDevuelto`, sin correo, anotado en `historial`. Si la devolución es de un pago sin recibo: nada.
- 13. CONTRACARGO. Nunca sale un correo ni un WhatsApp. `marcarDisputaDeRecibo` en `aplicarContracargo` (lib/cobros.ts:1465): siempre escribe `disputa_texto`; `plataAfuera === true` pasa a `estado='contracargo'`; `false`, vuelve a `emitido`; `null` (Mercado Pago y Creem hoy) no cambia el estado. Lo ve sólo SuperAdmin.
- 14. RECIBO PARA PLATA FUERA DE LA PASARELA: `emitirReciboManual` en lib/recibos.ts, llamado por la pantalla y, cuando llegue, por la rama de agencia. Recibe: `destino_ws`, `a_nombre`, `lineas[]` ({concepto, mes, monto, moneda}), `pagos[]` ({medio, referencia, fecha, monto, moneda, monto_usd, de, comprobante_path}), `nota_pdf`, `nota_interna`, `clave`, `enviar`. Admite varios pagos en un recibo y recibido distinto del detalle (`diferencia` se muestra en la pantalla, sin saldo a favor automático). Una orden ya usada contesta «Esa orden ya está en el recibo N.º 0002». «Emitir sin enviar» deja `correo_estado` y `wa_estado` en `no_va`. No marca meses pagados ni escribe cuotas. Fecha sin hora de zona: se interpreta en `zonaDelNegocioEstricta(plataforma)`.
- 15. SUPERADMIN, en Customers › Billing: nuevo `app/admin/cobros/RecibosMako.tsx`, debajo de `ListaCobrosMako` en Contenido.tsx y sin depender de `conPasarela`; las acciones van en `app/admin/cobros/recibos-actions.ts` con `getSesionAdmin()` en la primera línea (extender tests/admin-cobros.test.ts). Título «Recibos», botón «Cargar pago». Filtros: mes, cuenta, medio, estado, envío (todos o falló). Fila: N.º, a nombre de, total recibido, medio, fecha, estado, Correo y WhatsApp con su estado; acciones «Bajar», «Comprobantes», «Reenviar» (con confirmación que muestra a quién; permite otro correo; suma 1 al lote), y sólo en manuales «Marcar devuelto» y «Anular». «Anular» deja el número gastado y libera las llaves; se corrige emitiendo otro. Arriba: el total del filtro por moneda. Tope 200 y se dice si se llegó, como la lista de cobros. Tarjeta chica «Datos del recibo» (emisor): nombre, documento, dirección, correo, en `app_settings` de la plataforma, clave `recibos.emisor`, leída con `getSettingEstricto`; sin datos sale «MaKo · hola-mako.com»; nunca se inventa un dato fiscal; se copia como foto a cada recibo. Botón «Ver ejemplo» con datos de muestra, sin número. Interruptor «WhatsApp a quien paga solo», prendido, para no romper la regla de que lo no configurable es un bug. Rutas: `GET /api/admin/recibos/[id]/pdf`, `GET /api/admin/recibos/[id]/comprobante/[pagoId]` (URL firmada de 5 min), `POST /api/admin/recibos/comprobante` (multipart, 10 MB, `sniffImagen`, sólo JPEG o PNG, path `plataforma/recibos/<uuid>.<ext>` en `contratos`: sin ws numérico al frente, para que ningún reset por prefijo lo alcance). Teléfono: /m/cobros suma la lista con «Bajar»; cargar queda en la computadora, dicho en la fila.
- 16. EL FORMULARIO «Cargar pago», un paso por pantalla: ¿De quién? (buscador de cuentas; `a_nombre` editable, porque la base dice «Codigo Inmobiliario» sin tilde) → Qué se pagó (renglones, con atajos desde `planesMako()` para Pro y Esencial, y «Mes» opcional: si es una agencia y hay mes, `clave = mensualidad:<ws>:<AAAA-MM>`) → Cómo se pagó (renglones con foto, medio por defecto Binance, referencia obligatoria; si no hay, se genera) → Revisar (texto con totales, diferencia y a quién le llega) → «Emitir y enviar» o «Emitir sin enviar». El `formId` se genera al abrir y se manda en cada intento (`clave = form:<uuid>` si no hay mes): doble clic no da dos recibos. Se revisa a 390 px.
- 17. CARGAR A CÓDIGO: `scripts/recibos-cargar-codigo.mts`, `--aplicar`, lee registro.json. Sube los 3 PNG y los 2 PDF a `contratos`, y llama a `emitir_recibo` con número forzado: 0001 (`clave=mensualidad:13:2026-10`; líneas Pro 97 y Brigitte 47; un pago 146 USDT, orden 461213098188603392, 21/10 15:04:45, de JZ_; `nota_interna` «Los 2 USDT de más no se toman en cuenta (Martín, 5/11).») y 0002 (`clave=mensualidad:13:2026-11`; Pro 97, Brigitte, Natalia y Sergio 47; dos pagos 94 USDT orden 463869660353134592 del 4/11 22:42:23 y 144 USDT orden 463975050149208064 del 5/11 12:20:19; `nota_pdf` «Cubre hasta el 4/12/2026. Desde el 5/12 entra en el pago de diciembre.»). `destino_ws=13`, `emitido_at=2026-11-05`, `pdf_path` con el archivo enviado, `correo_estado='enviado'` y `wa_estado='enviado'` con los ids de registro.json. NO MANDA NADA: ya se mandaron. Sin `--aplicar`, sólo lee y lista. Idempotente por clave.
- 18. CON LA RAMA `punta/agencia-cobro`, sin chocar. Lo que ella hace no cambia: `marcarMesPagado` y `agencia.mensualidad.*` siguen siendo el estado del mes, y el aviso de cobro y el PDF del diferencial son documentos de lo que HAY QUE pagar, sin número. Un recibo no marca nada como pagado. El acuerdo: (a) sólo `emitir_recibo` da números: la rama no numera; (b) al llegar a main, después de marcar el mes, la rama llama a `emitirReciboManual({ clave:`mensualidad:${ag}:${mes}`, lineas desde cuentaDelMes y conceptoDeLinea, pagos con sus órdenes })`, y con 2026-11 contesta `ya_estaba` con el 0002; (c) `quitarMesPagado` llama a `anularRecibo(clave)`; (d) para saber si un comprobante del grupo ya se usó: `reciboDePago('binance', orden)`; (e) los archivos que tocan los dos son cuatro y se resuelven al mezclar, sumando: lib/api-mako/areas/cobros.def.ts y .run.ts, tests/grupos-ops-guarda.test.ts, app/admin/dev/payment-gateway/bitacora.ts. Esta punta no agrega cron. El diferencial cobrado usa `clave=diferencial:<ag>:<cliente>:<AAAA-MM>`. Hay que avisarle a esa rama que su 0402 choca en número con la de main.
- 19. CREEM COMO MERCHANT OF RECORD: conviven dos documentos y el nuestro lo dice. Creem es el vendedor legal: su doc dice que da «compliant invoices» y que el comprador recibe una confirmación o recibo suyo, y el cargo aparece como «CREEM.IO* STORE». MaKo manda IGUAL su recibo, porque Martín lo pidió siempre, y `leyendaDelMedio` (leyendo `merchantOfRecord`) suma en el PDF y el correo: «Pago procesado por Creem. En tu tarjeta aparece como CREEM.IO* STORE. La factura, si corresponde, la emite Creem.» Con Mercado Pago, Stripe y Binance, sólo el pie general.
- 20. API DE MAKO Y ÁREAS: `ver_recibos`, `cargar_pago_a_mano`, `reenviar_recibo` en lib/api-mako/areas/cobros.def.ts y .run.ts, sólo super admin y sólo plataforma; las dos que escriben, en `NO_EN_FLUJOS` (lib/api-mako/flujo.ts). Sumar los archivos al área `payment-gateway` (app/admin/dev/areas.ts:951) y a su bitácora. Cosechar en docs/hallazgos-planes-y-cobro.md, con el índice en el mismo commit.
- 21. TESTS, cada uno probado rompiéndolo: `destinoDelRecibo` con un caso por renglón, incluido el de paga la agencia con `cobro.email` del cliente y la lectura que falla; `emitir_recibo` contra una base real de pruebas o un doble que respete el candado: dos llamadas a la vez dan un número; el mismo pago repetido, reenvío con evento nuevo y reconciliación dan UN recibo y UN correo; el PDF se lee con unpdf y trae número, totales y «No es una factura fiscal»; dos renders dan los mismos bytes; un 500 de WhatsApp no toca el estado del correo; `modo='prueba'` y monto cero no gastan número; reembolso parcial y total; contracargo sin correo; la guarda de grupos sigue en verde; y que `emitir_recibo` no se llame desde otro archivo. Prueba real sólo con el sí de Martín: nunca contra /api/planes/comprar sin él.

## A quién le llega

- Quien paga solo (compra de /planes, sin `agencia_ws`): correo a `cobro.email` más los admins de `alta_ws` si ya tiene cuenta, sin repetir. WhatsApp e hilo: al grupo de `alta_ws` sólo si tiene grupo; sin grupo, nada y queda `sin_grupo`; línea caída, queda en el hilo o en `fallo`, sin tocar el correo. Con `ya_tenia_cuenta` y sin cuenta atada: sólo correo.
- Cliente de agencia que paga él (`agencia_ws` + `cliente_ws` y `agency.quien_paga = 'cliente'` en SU cuenta): correo a `cobro.email` más los admins de `cliente_ws`; WhatsApp a SU grupo, con la misma regla. El recibo sale a su nombre. A la agencia no se le manda el PDF. Si la agencia lo soltó y la suscripción pasó a ser suya, el cobro ya no trae `agencia_ws`: cae en el caso anterior.
- Cliente de agencia que paga la agencia (sin clave, o `agencia`): correo SÓLO a los admins de `agencia_ws`; WhatsApp SÓLO al grupo de `agencia_ws`; a nombre de la agencia. NUNCA a `cliente_ws`, ni a su grupo, ni a `cobro.email`, que puede traer otro correo. El nombre del cliente va en el renglón, porque el recibo sólo lo ve la agencia. Vale aunque su cartera esté pendiente o revocada: pagó la agencia. Si no se pudo leer quién paga, no sale nada hasta poder leerlo.
- La agencia misma, por su plan o por Binance a mano: correo a sus admins, WhatsApp a su grupo. Código hoy (MEDIDO): un admin activo, usuario 10, con correo de gmail; `mako.grupo_jid` presente; grupo «MaKo <> Codigo Inmobiliario», con mensajes de hoy.
- Devolución: mismos correos que el recibo, una vez, sin WhatsApp. Contracargo: a nadie de afuera, sólo queda en el registro.
- Equipo de MaKo: sigue enterándose por #714 («Entró un Pago») y ve todo en Billing. Un correo a `EMAIL_MAKO` sólo si un recibo no tiene destino o el correo falló cinco veces, y si reboteó.

## Riesgos

- Creem sin la 0358: nada de lo diseñado puede correr para Creem, y hoy (deducido) cualquier comprador al que le toque Creem ve «No pudimos abrir el pago». Es lo primero, y va antes que los recibos.
- Fiscal: este recibo no reemplaza una factura. Si Martín tiene obligación de facturar en Argentina por lo que cobra por Mercado Pago o Binance, eso sigue siendo aparte, en ARCA. Lo tiene que confirmar su contador. Hoy no hay datos fiscales del emisor; el diseño no los inventa.
- Un 200 de Resend no es una entrega. `correo_estado='enviado'` quiere decir que Resend lo aceptó. Por eso la rama de rebote y queja en app/api/webhooks/resend/route.ts busca `recibos.correo_id` y pasa a `reboto`, con aviso a `EMAIL_MAKO`. Hay que leer esa ruta antes: las columnas de rebote de la 0380 son de otras tablas.
- Si el PDF no es determinista, el reintento recibe 409 de Resend y parece un fallo. Por eso el test de bytes iguales. Y la clave dura 24 h: los 5 reintentos tienen que entrar en ese plazo, y un reenvío manual cambia el lote.
- La renovación cuyo aviso se perdió sigue sin entrar y, por lo tanto, sin recibo (lib/cobros.ts:2063). Es un hueco anterior y sigue abierto. El recibo no lo tapa: no se emite por plata que MaKo no sabe que entró.
- WhatsApp: esto suma envíos automáticos con adjunto por una línea que WhatsApp baneó el 3/11. Va sólo a grupos existentes, uno por pago, con texto distinto, y sin altas, que fue lo más cercano al ban. El día que se prenda el corte de grupos, el envío falla y queda en el hilo de la app sin tocar el correo.
- Un mensaje de MaKo con adjunto mal anotado puede disparar un turno. Por eso `enviarPartesAJid` anota al anillo y se llama `anotarLoDelEquipo`. No correr el envío en un script con `process.exit`: `anotarEnviadosConTope` deja de esperar a los 3 s.
- Al mezclar: `esRenovacion`, `montoDelPrimerPago` y la moneda del primer pago hoy ignoran `p.monto`; si se reusa ese valor para el recibo, un primer pago de Creem o de Mercado Pago imprime el precio de lista y no lo cobrado. Por eso va `montoCobrado` aparte.
- Binance no entra al cash ni al MRR del CRM de la plataforma: el registro de recibos y los reportes de plata van a discrepar en Código. Es a propósito, para no contar dos veces con `agencia-mes`, y queda dicho en el registro.
- Bundling de jsPDF en Vercel: anda en Node, pero el servidor de Next todavía no lo cargó. Si el build falla, todo el correo depende de esto. Se prueba con `GET /api/admin/recibos/ejemplo.pdf` en un preview antes de enganchar `aplicarPagoAprobado`.
- `0394` repetida entre main y `punta/agencia-cobro`; si se aplica «la 0394» sin mirar el nombre se repite el olvido que dejó a Creem afuera.

## Archivos a tocar

- supabase/migrations/0397_recibos.sql (número a confirmar con el Cerebro)
- lib/recibos-reglas.ts (nuevo, puro)
- lib/recibo-pdf.ts (nuevo, puro)
- lib/recibos.ts (nuevo, server-only)
- lib/cobros.ts (los dos ganchos en aplicarPagoAprobado, los parámetros montoCobrado e impuesto, aplicarReembolso, aplicarReembolsoFallido, aplicarContracargo, pagoDelLinkEnLaPasarela)
- lib/cobros-webhook.ts (:537 y :552, pasar montoCobrado e impuesto)
- lib/creem-api.ts (:309, montoPagado e impuesto del checkout)
- lib/resend.ts (idempotencyKey en sendEmail)
- lib/invitaciones.ts (adjuntos, idempotencyKey, lista en to, mandarReciboPorEmail)
- app/api/cron/cobros-reconciliar/route.ts
- app/api/webhooks/resend/route.ts (rebote y queja de un recibo)
- app/admin/cobros/Contenido.tsx
- app/admin/cobros/RecibosMako.tsx (nuevo)
- app/admin/cobros/CargarPago.tsx (nuevo)
- app/admin/cobros/recibos-actions.ts (nuevo)
- app/api/admin/recibos/[id]/pdf/route.ts (nuevo)
- app/api/admin/recibos/[id]/comprobante/[pagoId]/route.ts (nuevo)
- app/api/admin/recibos/comprobante/route.ts (nuevo)
- app/api/admin/recibos/ejemplo.pdf/route.ts (nuevo)
- app/m/cobros/CobrosM.tsx
- next.config.ts (serverExternalPackages: jspdf)
- lib/api-mako/areas/cobros.def.ts, lib/api-mako/areas/cobros.run.ts, lib/api-mako/flujo.ts
- app/admin/dev/areas.ts, app/admin/dev/payment-gateway/bitacora.ts
- scripts/recibos-cargar-codigo.mts (nuevo)
- tests/grupos-ops-guarda.test.ts, tests/admin-cobros.test.ts, tests/recibos.test.ts (nuevo), tests/_recibos-hijo.ts (nuevo)
- docs/hallazgos-planes-y-cobro.md y docs/hallazgos.md (cosecha, en el mismo commit)

## La migración

EN PALABRAS: agrega el libro de recibos (dos tablas y un contador) y una función que da el número. No toca ninguna tabla que exista. Número: 0397 propuesto (MEDIDO con barrido de las 80 referencias más nuevas y los worktrees: main llega a 0394_decisiones_ignoradas, punta/agencia-cobro trae otra 0394, hay una 0396_wa_mensajes_automatico). AGENTS.md obliga a pedirle el número al Cerebro y a aplicar después de su revisión, con el sí de Martín en el chat.

ORDEN: 1) 0358_cobros_pasarela_creem.sql, ya escrita, sólo ensancha tres CHECK. 2) 0397_recibos.sql. 3) `node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/recibos-cargar-codigo.mts`, mirar la lista, y con `--aplicar` carga 0001 y 0002 sin mandar nada. 4) Deploy del código. El código tolera que falte la tabla: ante 42P01, PGRST205 o 42883 lo dice en el log y el pago sigue; un recibo nunca frena un pago. 5) `recibosQueFaltan` no hace backfill: filtra con `RECIBOS_DESDE` = el día del deploy (hoy no hay ningún pago para rellenar, MEDIDO).

SQL:
begin;
create table if not exists recibos_numeracion (unica boolean primary key default true check (unica), ultimo integer not null check (ultimo >= 0));
insert into recibos_numeracion (unica, ultimo) values (true, 2) on conflict do nothing; -- 0001 y 0002 ya salieron a mano el 5/11/2026
create table if not exists recibos (
  id bigint generated by default as identity primary key,
  numero integer not null unique check (numero > 0),
  clave text not null check (char_length(clave) between 3 and 200),
  origen text not null check (origen in ('pasarela','manual')),
  estado text not null default 'emitido' check (estado in ('emitido','devuelto','devuelto_parcial','contracargo','anulado')),
  cobro_id bigint references cobros(id) on delete set null,
  destino_ws bigint references workspaces(id) on delete set null,
  agencia_ws bigint references workspaces(id) on delete set null,
  cliente_ws bigint references workspaces(id) on delete set null,
  a_nombre text not null check (char_length(a_nombre) between 1 and 200),
  email_cobro text check (email_cobro is null or char_length(email_cobro) <= 320),
  lineas jsonb not null check (jsonb_typeof(lineas) = 'array'),
  total_detalle numeric(14,2) not null,
  moneda_detalle text not null check (moneda_detalle ~ '^[A-Z0-9]{3,5}$'),
  total_recibido numeric(14,2) not null,
  moneda_recibido text not null check (moneda_recibido ~ '^[A-Z0-9]{3,5}$'),
  impuesto numeric(14,2),
  emisor jsonb not null,
  zona text not null,
  nota_pdf text check (nota_pdf is null or char_length(nota_pdf) <= 500),
  nota_interna text check (nota_interna is null or char_length(nota_interna) <= 500),
  pdf_path text,
  fecha_pago timestamptz not null,
  emitido_por text not null,
  emitido_at timestamptz not null default now(),
  correo_estado text not null default 'pendiente' check (correo_estado in ('pendiente','enviando','enviado','fallo','reboto','sin_destino','no_va')),
  correo_intentos smallint not null default 0,
  correo_lote smallint not null default 1,
  correo_tomado_at timestamptz,
  correo_a text[],
  correo_id text,
  correo_at timestamptz,
  correo_error text check (correo_error is null or char_length(correo_error) <= 300),
  wa_estado text not null default 'pendiente' check (wa_estado in ('pendiente','enviando','enviado','en_app','sin_grupo','fallo','no_va')),
  wa_tomado_at timestamptz,
  wa_ws bigint references workspaces(id) on delete set null,
  wa_id text,
  wa_at timestamptz,
  wa_error text check (wa_error is null or char_length(wa_error) <= 300),
  devuelto_at timestamptz,
  devuelto_monto numeric(14,2),
  devolucion_correo_at timestamptz,
  disputa_texto text check (disputa_texto is null or char_length(disputa_texto) <= 300),
  anulado_at timestamptz,
  anulado_por text,
  historial jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create unique index if not exists recibos_clave_uk on recibos (clave) where estado <> 'anulado';
create index if not exists recibos_lista_idx on recibos (emitido_at desc);
create index if not exists recibos_destino_idx on recibos (destino_ws, emitido_at desc);
create index if not exists recibos_salida_idx on recibos (updated_at) where correo_estado in ('pendiente','enviando','fallo') or wa_estado in ('pendiente','enviando');
create table if not exists recibo_pagos (
  id bigint generated by default as identity primary key,
  recibo_id bigint not null references recibos(id) on delete restrict,
  medio text not null check (medio ~ '^[a-z0-9_-]{2,30}$'),
  referencia text not null check (char_length(referencia) between 1 and 200),
  fecha timestamptz not null,
  monto numeric(14,2) not null check (monto > 0),
  moneda text not null check (moneda ~ '^[A-Z0-9]{3,5}$'),
  monto_usd numeric(14,2) check (monto_usd is null or monto_usd > 0),
  impuesto numeric(14,2),
  de text check (de is null or char_length(de) <= 120),
  comprobante_path text,
  comprobante_nombre text,
  anulado boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists recibo_pagos_uk on recibo_pagos (medio, referencia) where not anulado;
create index if not exists recibo_pagos_recibo_idx on recibo_pagos (recibo_id);
alter table recibos enable row level security;
alter table recibo_pagos enable row level security;
alter table recibos_numeracion enable row level security;
revoke all on recibos, recibo_pagos, recibos_numeracion from anon, authenticated;
grant select, insert, update on recibos, recibo_pagos to service_role;
grant select, update on recibos_numeracion to service_role;
grant usage, select on sequence recibos_id_seq, recibo_pagos_id_seq to service_role;
create or replace function public.emitir_recibo(p jsonb)
returns table (recibo_id bigint, numero integer, ya_estaba boolean)
language plpgsql security invoker set search_path = public as $f$
declare v_ultimo integer; v_num integer; v_id bigint;
begin
  select n.ultimo into v_ultimo from recibos_numeracion n where n.unica for update;
  select r.id, r.numero into v_id, v_num from recibos r where r.clave = p->>'clave' and r.estado <> 'anulado';
  if found then return query select v_id, v_num, true; return; end if;
  select r.id, r.numero into v_id, v_num
    from recibo_pagos rp join recibos r on r.id = rp.recibo_id
    join jsonb_to_recordset(p->'pagos') x(medio text, referencia text) on x.medio = rp.medio and x.referencia = rp.referencia
    where not rp.anulado limit 1;
  if found then return query select v_id, v_num, true; return; end if;
  if p ? 'numero' then
    v_num := (p->>'numero')::integer;
    if v_num > v_ultimo or exists (select 1 from recibos r where r.numero = v_num) then raise exception 'número de recibo no disponible: %', v_num; end if;
  else
    v_num := v_ultimo + 1;
    update recibos_numeracion set ultimo = v_num where unica;
  end if;
  insert into recibos (numero, clave, origen, cobro_id, destino_ws, agencia_ws, cliente_ws, a_nombre, email_cobro, lineas, total_detalle, moneda_detalle, total_recibido, moneda_recibido, impuesto, emisor, zona, nota_pdf, nota_interna, pdf_path, fecha_pago, emitido_por, emitido_at, correo_estado, correo_a, correo_id, correo_at, wa_estado, wa_ws, wa_id, wa_at)
  values (v_num, p->>'clave', p->>'origen', (p->>'cobro_id')::bigint, (p->>'destino_ws')::bigint, (p->>'agencia_ws')::bigint, (p->>'cliente_ws')::bigint, p->>'a_nombre', p->>'email_cobro', p->'lineas', (p->>'total_detalle')::numeric, p->>'moneda_detalle', (p->>'total_recibido')::numeric, p->>'moneda_recibido', (p->>'impuesto')::numeric, p->'emisor', p->>'zona', p->>'nota_pdf', p->>'nota_interna', p->>'pdf_path', (p->>'fecha_pago')::timestamptz, p->>'emitido_por', coalesce((p->>'emitido_at')::timestamptz, now()), coalesce(p->>'correo_estado','pendiente'), case when p ? 'correo_a' then array(select jsonb_array_elements_text(p->'correo_a')) end, p->>'correo_id', (p->>'correo_at')::timestamptz, coalesce(p->>'wa_estado','pendiente'), (p->>'wa_ws')::bigint, p->>'wa_id', (p->>'wa_at')::timestamptz)
  returning id into v_id;
  insert into recibo_pagos (recibo_id, medio, referencia, fecha, monto, moneda, monto_usd, impuesto, de, comprobante_path, comprobante_nombre)
  select v_id, x.medio, x.referencia, x.fecha, x.monto, x.moneda, x.monto_usd, x.impuesto, x.de, x.comprobante_path, x.comprobante_nombre
  from jsonb_to_recordset(p->'pagos') x(medio text, referencia text, fecha timestamptz, monto numeric, moneda text, monto_usd numeric, impuesto numeric, de text, comprobante_path text, comprobante_nombre text);
  return query select v_id, v_num, false;
end $f$;
revoke execute on function public.emitir_recibo(jsonb) from public, anon, authenticated;
grant execute on function public.emitir_recibo(jsonb) to service_role;
commit;
notify pgrst, 'reload schema';

Lo que no se puede hacer con esto y hay que cuidar: la columna `recibos.numero` en un `returning` de la función choca de nombre con la salida de la tabla si no se califica con alias, como está arriba.

## Los agujeros que encontró el revisor

### [grave] El grupo y el hilo no son privados. La agencia ve el recibo de su cliente, y un invitado ve el de la agencia, con el renglón de cada cliente y el comprobante de Binance. Es falso lo que promete a_quien_le_llega («A la agencia no se le manda el PDF») y choca con «nunca a los clientes de ellos».

**Evidencia:** LEÍDO: `miembrosDelGrupo` lib/grupo-puerta.ts:109-113 mete a los admins de las agencias aprobadas en el grupo del cliente; en WhatsApp también entran (memoria del ticket #49). `laVeUnInvitado` lib/grupo-reglas.ts:127 sólo esconde las clases `aLaAgencia`, y 'recibo' no es una. `avisarMiembros` lib/grupo-app.ts:429-435 les manda el push con el pie (el monto) y `filaParaPersona` :266 les deja bajar el adjunto. Si el eco no encuentra la copia, crea una fila sin tipo. MEDIDO 19:26 UTC: filas 66 y 67, autor_tipo persona, aviso_tipo null. Hoy está latente. MEDIDO: 0 invitados vigentes y 0 `agency.quien_paga`, pero los 7 clientes aprobados de Código tienen `mako.grupo_jid`, e invitar es la prioridad de Martín del 4/11. lib/grupo-reglas.ts y lib/grupo-app.ts no están en archivos_a_tocar.

**Arreglo:** Esconder `aviso_tipo='recibo'` a los invitados en `laVeUnInvitado`, en el conteo de lib/grupo-app.ts:370 y en el push, con un set propio y test. Pie sin monto («Recibo de pago N.º 0003. El detalle está en el PDF.»), así la fila del eco tampoco lo dice. Si paga el cliente y tiene agencia aprobada: sólo correo, ni grupo ni hilo.

### [grave] La clave mensual se traga un pago nuevo. Un segundo pago del mismo mes contesta `ya_estaba` con el recibo viejo y esa orden no queda en ningún libro. Con dos pagos y uno ya usado, pasa lo mismo con el otro.

**Evidencia:** LEÍDO en la función del diseño: el primer select (`r.clave = p->>'clave'`) devuelve `ya_estaba` antes de mirar `p->'pagos'`, y el segundo select devuelve con que coincida un solo pago. Caso real: noviembre de Código fueron dos órdenes en dos días (registro.json), y la memoria del 5/11 dice «el pago parcial no frena nada». Si se emite con el primer pago, el segundo se pierde, y `reciboDePago('binance', orden)` lo da por no usado.

**Arreglo:** Con la clave encontrada, comparar referencias: si todos los pagos pedidos ya están, `ya_estaba`; si no, `raise` nombrando el número y la orden. Igual en la segunda búsqueda. En el formulario, clave siempre `form:<uuid>` y `mes` como columna, con un aviso blando («ya hay recibo de noviembre: N.º 0002»). `mensualidad:` queda sólo para la rama.

### [grave] Cargar un pago no marca el mes. Al mezclar `punta/agencia-cobro` hay dos libros: el recibo sale, pero la mensualidad sigue impaga, avisa «paga» y, cuando exista el corte, suspende a la agencia y a sus clientes.

**Evidencia:** LEÍDO: §14 «No marca meses pagados», y §18(b) sólo va de marcar a recibo. En la rama, `avisarMensualidades` (lib/agencia-mes.ts:373) y el cron avisan del 1 al 5 «no si está pagado», mirando `agencia.mensualidad.<ag>.pago.<mes>`. DEDUCIDO: la suspensión del día 6 está en la memoria del 5/11, pero no en 84b249104 (grep 0). Los totales no coinciden: el relevo de la rama da noviembre US$285 y diciembre US$527,83; el 0002 dice 238 y la memoria 426 con el diferencial aparte. Con `COBRA_LOS_DIAS_DEL_PRIMER_MES = true`, `lineas desde cuentaDelMes` más `clave=diferencial:` cobra dos veces los mismos días.

**Arreglo:** Una sola puerta: con mensualidad prendida, «Cargar pago» con agencia y mes llama a `marcarMesPagado` en la misma acción, y si falla lo dice. Antes de mezclar, decidir qué número manda y apagar `COBRA_LOS_DIAS` si el diferencial va aparte. Agregar un test del camino de vuelta.

### [media] Cargar un pago a una cuenta que paga su agencia le manda el PDF al cliente final, con el precio y el comprobante de quien pagó.

**Evidencia:** LEÍDO: §16 usa un buscador de todas las cuentas y §14 toma `destino_ws` directo; `destinoDelRecibo` sólo razona sobre un cobro. MEDIDO: 15, 17, 18, 19, 20, 22 y 23 están aprobadas en la cartera del 13, todas con grupo. Basta elegir «Natalia» para asentar lo que pagó Código. El paso «Revisar» lo muestra, pero no lo frena, y «Anular» no lo recupera. `cargar_pago_a_mano` por chat tiene el mismo problema.

**Arreglo:** En `emitirReciboManual`, si `destino_ws` está aprobado en una cartera y no tiene `quien_paga='cliente'`, rechazar con «Esta cuenta la paga <agencia>» y ofrecer cambiar el destino. Lectura estricta. Por API, propone y se confirma en pantalla, como `vender_plan_mako`.

### [media] La red manda «Recibimos tu pago» por plata ya devuelta.

**Evidencia:** LEÍDO: §11 incluye «pagados o reembolsados» y `pagos` sin filtrar `pagado`; §12 dice «de un pago sin recibo: nada»; `emitir_recibo` no recibe estado, así que nace `emitido` y con el correo `pendiente`. `desmarcarCobroDeProveedor` (lib/cobros.ts:1369) deja la cuota impaga y la red igual la toma. DEDUCIDO: pasa si el hook falló y la devolución entra antes de la vuelta del cron.

**Arreglo:** `emitir_recibo` acepta `estado`. La red pasa `devuelto` con `correo_estado` y `wa_estado` en `no_va` para un cobro reembolsado o una cuota con `pagado=false`.

### [media] La red y los caminos de reparación imprimen un monto adivinado. Un primer pago con cupón del 100% termina en un recibo por el precio de lista, de plata que no entró.

**Evidencia:** LEÍDO: `cobros` no guarda lo cobrado y §11 emite «con el monto de lo asentado». Hay 13 llamadas a `aplicarPagoAprobado` y §5 cubre tres. lib/cobros.ts:2149 y :2306 van sin monto; lib/plan-deuda.ts:106 (Creem) va sin impuesto; lib/cobros-webhook.ts:552 y lib/cobros.ts:2270 van sin `pagadoAt`, así que la fecha es la del proceso. Doc de Creem, code_webhooks.md:372: `order.amount` es el precio ANTES del descuento. DEDUCIDO: el hook rechaza el cero (check `monto > 0`), y la red ve «pagado sin recibo» y emite por `cobros.monto`. Una cuota en cero (:875-877) se reintenta para siempre.

**Arreglo:** Antes de emitir sin monto, releer con GET (`leerPagoMp`, `leerTransaccionCreem`); si no contesta, dejarlo para la próxima vuelta. Con 0 cobrado, no hay recibo. Sumar `montoCobrado`, `impuesto` y `pagadoAt` a todas las llamadas que tengan el dato.

### [media] Un recibo anulado o devuelto sale igual por la red. Y anular uno ya enviado no le avisa a nadie.

**Evidencia:** LEÍDO: §11 y `recibos_salida_idx` eligen por `correo_estado`, y §15 Anular no lo toca, así que un `fallo` anulado se manda. Un devuelto pendiente sale con el sello y la misma clave: 409 hasta el quinto intento. El PDF sigue en WhatsApp y en el hilo.

**Arreglo:** Filtrar por `estado='emitido'`. Anular y devolver pasan pendiente, enviando y fallo a `no_va` en el mismo update. «Reenviar» bloqueado en un anulado. Anular pregunta si avisa a los destinatarios.

### [media] El despacho va antes del paso 6 y `sendEmail` no tiene timeout. Si Resend se cuelga, se pierden el aviso «Entró un pago» y el CRON del lead, justo lo que evita escribirle «no agendaste» a quien pagó. Contradice «un recibo nunca frena un pago».

**Evidencia:** LEÍDO: §6(b) «antes del paso 6»; lib/resend.ts:261 hace `fetch` sin `signal`; maxDuration es 60 en los dos webhooks, con presupuesto de 15 s y 12 s, y después sigue en `after`, que muere con la función. DEDUCIDO: nadie repite :959-960, porque el aviso ya contestó 200 y la red sólo mira cuota y alta. Los pasos 5 y 6 no tiran, así que no hay motivo para ese orden. El correo de §12 dentro de `aplicarReembolso` tiene el mismo riesgo y hace esperar a la pantalla de `reembolsarCobro`.

**Arreglo:** Mover (b) justo antes del `return` de :963. Usar `AbortSignal.timeout(15_000)` cuando viene `idempotencyKey`. El correo de devolución sale por la red o por `after`.

### [media] La clave de idempotencia choca con los destinatarios recalculados: el reintento da 409 y queda rojo sin que el correo haya fallado. El test de bytes iguales no lo ve.

**Evidencia:** §8 resuelve destinatarios al despachar y §7 reintenta con la misma clave. MEDIDO en la doc de Resend, 5/11: otro cuerpo da 409 `invalid_idempotent_request`; en curso da 409 `concurrent_idempotent_requests`, que se puede reintentar. lib/resend.ts:274-279 devuelve sólo texto, así que no se distinguen. Un admin nuevo o un `alta_ws` que aparece cambian el `to`. La clave dura 24 h: un `enviando` retomado después puede duplicar.

**Arreglo:** Congelar `correo_a` en el primer compare-and-set del lote. `sendEmail` devuelve `status` y `name`; el 409 concurrente no gasta intento. Pasadas 23 h desde que se tomó, no reintentar solo: `fallo`, «no sé si salió».

### [media] El nombre se fija al emitir y el destino al despachar, y `cobro.nombre` no es de quien paga. El recibo del cliente puede decir «Es sólo para <agencia>», y uno a nombre de la agencia puede llegarle al cliente.

**Evidencia:** LEÍDO: `crearCobro` lib/cobros.ts:462 usa `p.nombre ?? lead.nombre`; `linkPrimerMes` (lib/agencia-cobro.ts:94-101) y la renovación (:230-234) no pasan nombre, y el lead es la ficha de la AGENCIA. El traspaso lib/agencia-baja.ts:116 pone `agencia_ws` y `cliente_ws` en null entre emitir y despachar o «Reenviar». La 0308 tiene `on delete set null` en las dos: con una sola, «con los dos» es falso y cae a `cobro.email`. MEDIDO: `cobros.nombre` es nullable, y el check 1..200 deja a ese pago sin recibo para siempre.

**Arreglo:** Correr `destinoDelRecibo` al emitir y guardar `paga` y `a_nombre`: nombre del workspace si es de agencia, y si no `c.nombre` o la parte local del correo. Al despachar sólo se suma `alta_ws` si paga solo. Con uno solo de los dos campos, `sin_destino`, nunca `cobro.email`. «Reenviar» usa lo congelado.

### [media] `cobro.email` queda viejo después de corregir el correo. Quien escribió mal el correo de otra persona sigue mandándole cada renovación a esa persona, en el mismo `to` que el admin, y se ven las direcciones entre ellos.

**Evidencia:** LEÍDO: app/api/pagar/email/route.ts cambia `usuarios.email` y en `cobros` sólo toca `alta_email_cambios` y `alta_motivo` (:19, :93). §8 suma siempre `cobro.email`, y §9 hace un solo POST. Un rebote de uno marcaría `reboto` a todos. El molde existente manda de a uno (lib/plan-deuda.ts:280).

**Arreglo:** Con la cuenta hecha, sólo sus admins; `cobro.email` sólo si no hay cuenta. Un POST por destinatario, con id por correo y clave `recibo-<id>-<lote>-<hash>`. Normalizar a minúsculas para no repetir.

### [media] Los settings leídos sin contexto caen en el ws1 (Mauricio, un cliente). El recibo saldría sin el emisor configurado, y esa foto queda para siempre. `quien_paga` leído así da «agencia».

**Evidencia:** LEÍDO: lib/workspace.ts:328 `tieneCookieSesion ? null : OWNER_WS`; lib/settings.ts:19 y :46 leen por contexto; app/api/cron/cobros-reconciliar/route.ts:99, donde §11 se engancha, corre fuera de `runWithWorkspace`. En una acción con `?ws=13` manda la cookie.

**Arreglo:** Todo bajo `runWithWorkspace(await wsSuperAdmin(), …)`, con el molde `enLaPlataforma` de la rama. `quien_paga` con el select directo de lib/plan-deuda.ts:261, mirando `error`. Test con el ws1 sembrado con otro emisor.

### [media] Sin grupo de WhatsApp «no se copia a nada». Todo comprador nuevo queda sin el recibo en la app.

**Evidencia:** §10 contra lib/avisos.ts:290-295 («SIN MIRAR WHATSAPP… o el negocio no tenga grupo»), el requisito 3 de Martín (tests/grupos-ops-guarda.test.ts:4) y lib/grupo-app.ts:65 (`claveDeLaApp`: el hilo existe sin grupo). MEDIDO: 13 negocios con grupo, de 17 activos; memoria: altas automáticas apagadas.

**Arreglo:** Copiar siempre al hilo, salvo el caso de agencia del primer hueco. Estado `en_app` en vez de `sin_grupo`.

### [media] En Creem, «Recibimos de» y «Total recibido» dicen algo que no pasó: el vendedor legal es Creem. Y el total de SuperAdmin suma un impuesto que MaKo nunca recibe.

**Evidencia:** PDF 0002 leído con unpdf: «Recibimos de», «Total recibido», «Este recibo acredita el pago». §5 pone `total_recibido = montoPagado` con impuesto, y §15 suma por moneda sin decir qué hace con anulados y devueltos. §19 sólo agrega una leyenda. DEDUCIDO: con `tax_amount` en 0, imprime «Impuesto incluido: US$ 0».

**Arreglo:** `Record<Pasarela, …>` o `merchantOfRecord`: «Confirmación de pago», «Pagaste», «Total pagado», con el mismo número. El total excluye anulados, muestra los devueltos aparte y resta el impuesto si es merchant of record. Línea de impuesto sólo si es mayor que 0.

### [media] El PDF no se guarda: «Bajar» puede no ser lo que recibió el cliente.

**Evidencia:** §3 rearma de la foto, y la foto son los datos, no el layout ni el pie. Un deploy cambia el documento y, dentro de las 24 h, también los bytes: otro 409. Un comprobante borrado deja sin PDF. MEDIDO 5/11: con el PNG real, 141 KB con una imagen y 417 KB con tres: casi no pesa.

**Arreglo:** Guardar los bytes en `contratos`, `plataforma/recibos/pdf/<id>.pdf`, en el primer despacho, con su sha256 en la fila. 0001 y 0002 dejan de ser excepción. El sello de devuelto es un render aparte.

### [menor] El gancho (a) usa variables que todavía no existen, y `enCero` no cubre un primer pago en cero.

**Evidencia:** lib/cobros.ts:872 `montoUsd` y :877 `enCero` son `const` posteriores a :818. `enCero` exige `renovacion`.

**Arreglo:** Calcular antes, en variables propias, sin mover las de abajo, y mirar el cero también en el primer pago.

### [menor] `recibosQueFaltan` no se puede escribir como dice el diseño, y las filas malas se comen el tope.

**Evidencia:** `recibo_pagos` no tiene FK a `cobros` ni a `pagos` por (medio, referencia), y PostgREST no hace ese anti-join. Leer 50 y filtrar repite el corte de lib/cobros.ts:2069-2071. Una fila que siempre falla ocupa lugar en cada vuelta.

**Arreglo:** Función SQL `recibos_que_faltan(desde, tope)` en la 0397, que devuelva también `pagado` y el modo. Cuando se llega al tope, se dice en el log.

### [menor] La carga manual no valida lo que importa.

**Evidencia:** `total_recibido` viene de afuera, sin check contra `recibo_pagos`. Una sola `moneda_recibido`: 100 USDT más 50 USD no se puede escribir. `referencia` y `medio` son libres: un espacio o «binance-pay» hacen pasar la misma orden por nueva. `comprobante_path` sin validar prefijo. `sniffImagen` también acepta gif y webp. registro.json no trae `correo_a`. El script sube antes de mirar la clave y deja huérfanos si se repite. `destino_ws` queda null si el alta llegó después.

**Arreglo:** Calcular totales por moneda en la función. Normalizar la referencia (`^\d{18}$` en Binance) y usar `medio` de una lista. Exigir el prefijo `plataforma/recibos/`. Sólo JPEG o PNG. El script mira la clave primero. La red completa `destino_ws`.

### [menor] El reembolso no tiene una máquina de estados.

**Evidencia:** Con `devolucion_correo_at` único, un parcial y después un total no avisan el total. `plataAfuera=false` «vuelve a emitido» pisa un devuelto. Se avisa aunque el original fuera `no_va`. `aplicarReembolso` (:1353) no trae monto y corre en todos los negocios: `marcarDevolucionDeRecibo` sin barrera ni try puede romper la devolución de un cliente.

**Arreglo:** Tabla de transiciones pura, con test. Barrera `c.workspace_id === wsSuperAdmin()`, y que nunca tire. Correo una vez por estado y sólo si el original salió. El monto, como parámetro nuevo.

### [menor] El rebote queda corto.

**Evidencia:** app/api/webhooks/resend/route.ts:110-128 sólo mira bounce permanente y queja; lo demás se ignora. MEDIDO en la doc de Resend, 5/11: existen `email.failed` y `email.suppressed`. No dice qué contesta el envío a una dirección suprimida.

**Arreglo:** `failed` y `suppressed` también pasan a `reboto`; buscar `recibos.correo_id` sólo en eventos de la cuenta de MaKo (sin `?cuenta=`).

### [menor] El tope de 10 MB no llega a la ruta: Vercel corta antes.

**Evidencia:** app/api/graficos/imagen/route.ts:12: la función corta en 4,5 MB con un 413 en texto. MEDIDO: las capturas de Binance pesan 158 KB y andan; una foto de teléfono puede no entrar.

**Arreglo:** Tope de 4 MB, o `createSignedUploadUrl` (app/api/chat/leer-archivo/route.ts:47) y `sniffImagen` después.

### [menor] Falta un código en «la tabla falta», y el test del candado no probaría el SQL.

**Evidencia:** Una función ausente da PGRST202 (lib/editor-landing/pago-landing-server.ts:359-361) y el diseño no lo nombra; el pago sigue por el catch, pero el log engaña. No encontré psql, Docker ni PGlite en esta PC; un doble no prueba el candado.

**Arreglo:** Reusar ese predicado. Probar con dos conexiones reales en producción, en dos transacciones con rollback, justo después de aplicar. No toca `ultimo`.

## Correcciones al diseño

- §0 y migración: 0358 y 0397 NO necesitan el sí de Martín. Memoria del 30/10: lo que sólo agrega (un valor de un check, una tabla nueva) se aplica sin preguntar, midiendo antes y después y contándolo en una línea. Sigue la revisión del Cerebro (AGENTS.md:910). MEDIDO 5/11 19:26 UTC: la 0358 sigue sin aplicar.
- camino_de_hoy y riesgos: «una renovación cuyo aviso se perdió no la recupera nadie» es falso a medias. lib/plan-acceso.ts:184 llama a `confirmarImpago` con `reparar`, y lib/plan-deuda.ts:81-124 la asienta antes de cortar. El recibo sale ahí, tarde y con `x.monto`.
- §6: el «único punto» es cierto, pero tiene 13 llamadas: lib/cobros-webhook.ts:217, 249, 447, 537, 552; lib/cobros.ts:2149, 2169, 2306, 2325, 2426; lib/plan-deuda.ts:83, 106, 123. §5 las tiene que recorrer todas. La venta externa de :2426 no aplica a la plataforma (lib/cobros-externos-reglas.ts:126).
- §18(e): no son cuatro archivos. `git diff --name-only` da seis comunes: app/admin/dev/areas.ts, app/admin/dev/payment-gateway/bitacora.ts, docs/hallazgos.md, lib/api-mako/areas/cobros.def.ts, lib/api-mako/areas/cobros.run.ts y lib/api-mako/flujo.ts. tests/grupos-ops-guarda.test.ts no está. Además la rama agrega el cron `agencia-mensualidad`.
- archivos_a_tocar: sumar lib/grupo-reglas.ts y lib/grupo-app.ts (invitados), y la función `recibos_que_faltan` en la 0397.
- Hay que decirle a Martín con estas palabras: el recibo por WhatsApp sólo llega a un negocio que ya tiene grupo. A un comprador nuevo le llega por correo y por la app: las altas en grupos están apagadas y nada le escribe primero a una persona (`puedeEscribirleAPersona`, lib/mako-grupo.ts:1148). Lo que él pidió no se cumple entero sin una decisión suya.
- §9: el texto fijo en `textoCorreo` choca con la regla de que lo interno de MaKo se configura en SuperAdmin. Mínimo: asunto y cuerpo editables en «Datos del recibo», con el pie «No es una factura fiscal» fijo.
- §20: usar `gating: { rolMinimo: 'admin', soloPlataforma: true }`, como las demás operaciones de cobros. `cargar_pago_a_mano` y `reenviar_recibo` proponen y se confirman.
- §15: `getSesionAdmin()` en la primera línea de cada ruta `/api/admin/recibos/*`, además del proxy, porque esas rutas sirven PDF de todos los clientes.
- VERIFICADO, SE QUEDA: (1) Numeración: el candado más una transacción no dejan huecos ni repetidos; el DDL de tablas e índices pasa el analizador del repo (`sinEntender: []`) y el cuerpo compila en un DO de sólo lectura. (2) PDF determinista: MEDIDO, dos renders a 1,5 s con `setCreationDate` y `setFileId` dan el mismo sha256; sin ellos, distintos. `renderEmailHtml` no usa fecha ni azar en lo leído. (3) Webhook repetido y reconciliación a la vez: misma llave y un solo compare-and-set. (4) Pendiente que se rechaza: `planDePagoMp` ignora pending, in_process, authorized e in_mediation (lib/cobros-eventos.ts:439-443). (5) Quién baja: MEDIDO, una sola persona con rol admin, en el ws 9; `/api/admin` y `/customers` en SOLO_ADMIN; el matcher no saca `.pdf` del proxy. (6) La barrera en positivo por plataforma. (7) `agenciaDelCobro` y `adminsDeCuenta` son como dice el diseño. (8) `plataforma/` queda fuera del borrado por prefijo. (9) El descriptor CREEM.IO* STORE está en la doc de Creem.

## Sin verificar

- Ningún pago real pasó por el camino: 0 pagados en la base. Todo lo que dice «sale» es lectura de código.
- «Con Mercado Pago ya recibo el dinero»: NO se pudo confirmar. MEDIDO: 0 pagos aprobados y 0 avisos de Mercado Pago en `pasarela_eventos` desde que se conectó el 31/10, con 2 cobros pendientes. No prueba que esté roto: esos dos pudieron no pagarse nunca, y no consulté la cuenta de Mercado Pago. Tampoco medí si la URL del aviso está cargada en su panel, que es la única vía de los avisos de suscripción (docs/hallazgos-planes-y-cobro.md:1625).
- Qué manda Creem al comprador: la doc (leída el 5/11, /merchant-of-record/what-is y /for-customers/why-creem-charged-me) habla de «compliant invoices» y de una «purchase confirmation or receipt». Sobre `llms-full` sólo leí los primeros 100.000 de 948.284 caracteres, sin un endpoint de factura. No hay ninguna venta real para mirarlo.
- Los montos reales de una transacción de Creem con `tax_mode: 'inclusive'`: si `amount_paid` es lo que dice su doc, y si `tax_amount` viene. Y si la transacción del webhook coincide siempre con la de `pedido.transaction` del checkout: por eso la llave es la del pago y el primer caso real hay que mirarlo a mano.
- Que Mercado Pago le mande su propio comprobante a quien paga: lo doy por sabido, no lo medí, y el diseño no depende de eso.
- Que la línea de WhatsApp ande hoy en general. Sólo se ve, indirectamente, que el grupo de Código recibió dos PDF a las 19:07 UTC (filas 66 y 67, por el eco). Nada para otros grupos, y nada de quién está en ese grupo.
- Que los correos de 0001 y 0002 se hayan entregado: sólo están los ids de Resend en registro.json, sin consultar a Resend.
- La zona horaria de las capturas de Binance. Se toma ART, por el reloj del teléfono en la misma captura: en un caso se ve 23:26 con el pago a las 22:42. Lo deduzco.
- Si Sergio es «Arriata», como dice la base (ws 20), o «Arratia», como salió en el PDF 0002 ya mandado, y lo mismo con «Natalia Krywyj» contra «Natalia» en la base. Hay que preguntarlo o mirarlo antes de cargar el registro; el PDF ya salió.
- El aspecto visual de 0001 y 0002: extraje el texto con unpdf; no pude dibujarlos (no hay pdftoppm en esta PC).
- jsPDF dentro del bundle de Next en Vercel: medido sólo en Node pelado.
- Que el webhook de Resend de la cuenta de la plataforma avise los rebotes de correos transaccionales. No leí app/api/webhooks/resend/route.ts.
- El tope de adjuntos de Resend: sólo el comentario de lib/resend.ts:214 («hasta 40 MB»), no su doc. Lo de la idempotencia sí lo leí en su doc (24 h, 409 con otro cuerpo).
- Que el número 0397 esté libre: barrí las 80 referencias más nuevas y los worktrees, no las 377 ramas, las etiquetas viejas ni lo reservado por el Cerebro.
- Si el único correo de `notif_emails` del ws 13 (MEDIDO: uno) es el mismo del admin: no lo comparé, a propósito no lo imprimí. Si fuera otro, Joan o Juanfran, hoy el recibo le llega sólo a quien sea admin; en ese caso, se agrega a mano en «Reenviar».
- `emitir_recibo` nunca se ejecutó. Sólo está medida la sintaxis (DO en sólo lectura, con el cuerpo bajo `if false`; no resuelve tablas ni columnas). La carrera real y el `ya_estaba` del segundo hueco son lectura del SQL, no una corrida. No encontré PGlite ni Postgres local; la búsqueda en el caché de npm no terminó, y no bajé nada.
- El analizador corrió sobre una versión recortada de las tablas, no sobre el SQL entero del diseño. `tests/migraciones-funciones-cerradas.test.ts` no se corrió: sólo leí su regla, y el revoke del diseño la cumple a la vista.
- Quién está físicamente en cada grupo de WhatsApp, y si los números de Código ya entraron en los grupos de sus clientes: la memoria dice que el alta automática está apagada y que los grupos viejos se tocan con un comando. Lo de la app (`miembrosDelGrupo`) sí está leído.
- Qué contesta Resend si una dirección del `to` es inválida o está suprimida (la doc no lo dice), y si el webhook de la cuenta de MaKo está suscripto a bounced, failed y suppressed. No lo consulté: según lib/resend.ts:292, la clave de la plataforma sería de sólo envío.
- La entrega real de los correos 0001 y 0002: sólo están los ids de registro.json.
- Creem: `OrderEntity` trae `fx_amount`, `fx_currency` y `fx_rate`, y `TransactionEntity` no. No sé si a un comprador de LatAm se le cobra en moneda local: el recibo podría decir US$ y su tarjeta otra cosa. Tampoco sé si `dispute.created` trae siempre la transacción; si no, la disputa cae en el recibo del primer pago.
- El corte de la clave de 24 h y los 409 de Resend están en su doc, no probados: mandar un correo estaba prohibido.
- La suspensión del día 6 no existe todavía en `punta/agencia-cobro` a 84b249104: el riesgo grave está deducido de lo pedido en la memoria del 5/11. Lo que sí se lee hoy es el aviso del mes.
- jsPDF dentro del bundle de Next 16.2.11: el determinismo está medido en Node pelado, y next.config.ts todavía no tiene `serverExternalPackages`.
- La zona del negocio de la plataforma: las claves que probé en `app_settings` del ws 9 no devolvieron nada. No leí la clave que usa `zonaDelNegocioEstricta`, así que no sé qué zona saldría en las fechas.
- Que un mensaje real de MaKo con PDF llegue hoy a un grupo que no sea el de Código, y que el eco lo ate a su copia en vez de crear una fila nueva: las filas 66 y 67 se escribieron sin copia previa, a mano.
