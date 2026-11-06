Revisión de Admin antes de que la vea Martín: 43 arreglos para hacer directamente, sin preguntar.

Se revisó la foto 34c42de996916f4af5682482e4af749e59c95727. Lo que ya haya cambiado después de esa foto se ignora. Todo sale de leer el código: no se corrió la app y no hay capturas de la entrega. Lo que ya se pidió aparte (clic derecho, cómo llegó cada cliente, Desconectar computadora, filtro de agencia, selector de mes en Cost Drivers, «Para mirar», «Ver ejemplo») no está acá y sigue pendiente. Donde las revisiones proponían arreglos distintos, acá ya está elegido uno.

Rutas cortas: `datos/` es `app/admin/_polar/datos/`, `web/` es `app/admin/_polar/web/`, `(polar)/` es `app/admin/(polar)/`.

## Lo que rompe o da un dato falso

**1. «Devolver el pago» en una renovación devuelve otro pago: el primero.**
- Qué pasa: Cada renovación de la pasarela es un pedido con el mismo `cobroId` y todos ofrecen el botón. La acción usa el `proveedor_pago_id` del cobro, que es el del primer pago. Se abre noviembre, se confirma, y la pasarela devuelve septiembre. Noviembre sigue «Pagado» y el botón desaparece de todos los meses. El modal además dice el monto del cobro, no el del pedido.
- Dónde: `web/Orders/OrderRefundsSection.tsx:43-54,118`; `lib/cobros.ts:795,897,1797,1800`; `datos/ventas.ts:273`; `lib/admin-ingresos.ts:117`.
- Qué hacer: Sumar `proveedorPagoId` a `PagoIngreso`, `Entrada` y `Pedido` (de `pagos.proveedor_pago_id`) y `proveedor_pago_id` a `CobroMako`. `porLaPasarela` es true sólo si coinciden. En una renovación, sin botón y con este texto: «Una renovación se devuelve desde el panel de la pasarela; MaKo la registra sola con el aviso». El modal usa el monto del pedido. Test con un cobro y dos pagos.

**2. Cada renovación lleva el recibo de otro mes y Orders suma casi el doble.**
- Qué pasa: `pedidosDe` ata recibo y pago por `cobro_id`, pero hay un recibo por cada pago. Con 3 meses de US$ 297, la caja dice US$ 1.485 en vez de 891, «Bajar el recibo» baja el de otro mes y, si se devuelve el último mes, los otros dos figuran devueltos. El error sube a la ficha y a Events.
- Dónde: `datos/ventas.ts:236-243,260-276,298-308`; `lib/recibos.ts:250-252,772`; `tests/admin-polar-ventas.test.ts:72-76`.
- Qué hacer: Atar por pago, con la clave de `reciboDePago`: `medio + referencia` de `recibo_pagos` contra `proveedor + proveedor_pago_id`. Un pago viejo sin `proveedor_pago_id` se ata por cobro sólo si ese cobro tiene un único recibo. Test con tres pagos y tres recibos: tres pedidos, cada uno con su recibo, y 891.

**3. Después de devolver un pago, la pantalla cae en 404.**
- Qué pasa: El reembolso sale bien, pero el cobro pasa a `reembolsado` y el pago a `pagado:false`. La lista ya no tiene ese id y corre `notFound()`. Se pierde el mensaje con el resultado, en una acción que mueve plata y no se reintenta. No hay `not-found.tsx` bajo `app/`, así que cae al 404 raíz sin el layout de Admin. Con recibo, el pedido reaparece como `r-`, rotulado «Cargado a mano» aunque fue de la pasarela. Sin recibo, no queda en Orders, Events ni Checkouts.
- Dónde: `web/Orders/OrderRefundsSection.tsx:54-63`; `(polar)/sales/[id]/page.tsx:25-26`; `lib/pagos.ts:1546`; `lib/admin-ingresos.ts:83,118`; `datos/ventas.ts:260-264,316-317,669`; `datos/eventos.ts:219`; `tests/admin-polar-ventas.test.ts:68-80,116`.
- Qué hacer: `pedidosDe` arma un pedido `c-<id>` en estado refunded por cada cobro `reembolsado`, con su recibo si lo tiene y sin pasarlo a `r-`. Esos cobros se leen aparte, porque `vistaDeIngresos` no los trae. Al salir bien, `router.replace('/admin/sales/c-<id>?hecho=…')` en vez de `router.refresh()`, y el resumen se lee de ahí. En `sales/[id]/page.tsx`, un `p-<id>` cuyo cobro fue devuelto redirige a ese `c-<id>`. `motivoDePedido` mira `recibo.origen === 'manual'`. Los tests pasan a la entrada ausente, que es lo que produce el flujo real.

**4. «Cargar pago» no registra el pago: Orders suma lo que Overview no ve, y puede contar doble.**
- Qué pasa: Sólo emite un recibo. Orders, la ficha y Events suben. Ingresos, Metrics, Margen, Top Customers y Finance no se mueven. Por cobrar, At Risk y Subscriptions siguen diciendo atrasado. Si ese pago también está en el CRM, donde se registró todo lo cobrado hasta hoy, Orders, «Lo que pagó» y «Pago recibido» de Events lo cuentan dos veces. Con los recibos 0001 y 0002 cargados, Código queda doblado. El formulario no avisa nada.
- Dónde: `lib/recibos.ts:677-681`; `web/Orders/CargarPagoModal.tsx:7,93`; `datos/ventas.ts:227-229,260-276,298-308`; `datos/cliente.ts:109-112`; `datos/eventos.ts:237-242`; `lib/admin-ingresos.ts:115-118`; `scripts/recibos-cargar-codigo.mts:57,68`.
- Qué hacer:
  - `cargarPagoAction` registra cada pago en `pagos` del lead de esa cuenta (`leads.cliente_ws`), como mensualidad si tiene suscripción. Nunca en `emitirReciboManual`, que también la llama el flujo de agencias después de marcar el mes.
  - Migración nueva: `recibo_pagos.pago_id`, no `recibos.pago_id`, porque un recibo puede juntar varios pagos (noviembre de Código: 94 + 144). `pedidosDe` ata por ahí.
  - Si el negocio tiene un pago del CRM sin recibo, el formulario lo ofrece primero para atarlo en vez de crear otro.
  - `totalesDePedidos` y `eventosDePedidos` no suman ningún `r-` manual sin atar. La fila sigue como «Recibo cargado a mano» y debajo de las cajas va «N recibos cargados a mano no suman en Ingresos: US$ X». No decir «vive en el CRM»: las mensualidades de agencia viven en su registro (`lib/agencia-mes.ts:383-425`), y la clave `mensualidad:` no distingue, porque Código la usa y está en `pagos`. Sin lead en esa cuenta, el recibo sale igual y queda en esa nota.
  - Se corrigen el comentario de `ventas.ts:227` y el punto 12 del relevo. `docs/relevo/recibos-encargo.md:69,73,97` aceptó esta diferencia antes de que Orders sumara las dos fuentes y no es decisión de Martín.

**5. En producción, Metrics, Costs y Usage quedan corridos: noviembre sale como «oct».**
- Qué pasa: Las fechas se arman en el server (UTC) y se recortan y dibujan en el navegador (Argentina). 1/11 00:00 UTC es el 31/10 a las 21:00. El último mes dice «oct 2026», desaparece el primero de los 12, «Este mes» queda vacío, «El mes pasado» muestra la plata de noviembre, el CSV sale con 2026-10-31 y el clic en la barra de octubre del Overview lleva a noviembre. En Costs y Usage cada día sale con la fecha anterior. Metrics y Costs no fallan en local, porque server y navegador comparten zona; Usage falla también ahí.
- Dónde: `datos/metricas.ts:81-84,193-200`; `(polar)/analytics/metrics/page.tsx:53`; `MetricsPage.tsx:38-41`; `datos/costos.ts:147,173`; `CostsPage.tsx:131-132`; `datos/cliente.ts:204-210`; `StackedMeterChart.tsx:50-53`; `web/Metrics/MetricChart.tsx:52,87-91`; `web/utils/metrics.ts:70-75,202`; `tests/admin-polar-analytics.test.ts:131`.
- Qué hacer: `propsDeMetricas` y `metricasDeCostos` se calculan en el navegador con `useMemo`, como `OverviewSection.tsx:49`. Del server sólo viajan meses y días como texto. En Usage, `cubetaDe` devuelve YYYY-MM-DD y el gráfico lo lee como fecha local. Test con `TZ=America/Argentina/Buenos_Aires` que reciba timestamps armados en UTC.

**6. Un pago de la noche cae en el día siguiente, y a fin de mes en el mes siguiente.**
- Qué pasa: Un recibo del 31/10 a las 22:00 de Argentina figura en Orders el 1/11, entra en el filtro de noviembre y no coincide con su PDF. Lo mismo pasa con un cobro de la pasarela sin pago en el CRM, que además suma en el mes siguiente en Metrics.
- Dónde: `datos/ventas.ts:265`; `datos/ventas-server.ts:36-39`; `lib/admin-ingresos.ts:173`.
- Qué hacer: `reciboDeListado` agrega el día con `hoyEnTz(r.zona, new Date(r.fecha_pago))` y `ventas.ts:265` usa ese día. `lib/admin-ingresos.ts:173` hace lo mismo con la `tz` que ya lee.

**7. At Risk da dos números: el de Overview esconde a los atrasados.**
- Qué pasa: La tarjeta sólo cuenta pausados, cobro fallido y sin uso. Customers › At Risk, adonde lleva «Ver todo», suma atrasados y los que dejaron de pagar. Un cliente que debe sale en rojo en Por cobrar y al lado At Risk dice «Nada en riesgo». Las dos listas incluyen además clientes de agencia pausados o con cobro fallido, que no están en la lista de Customers.
- Dónde: `datos/resumen-server.ts:84-86`; `datos/resumen.ts:208-219`; `datos/clientes.ts:298-328,447-452`; `lib/clientes-plataforma.ts:32,212-214`; `web/Widgets/CustomerRiskWidget.tsx:39,52-54,62`; `web/Widgets/AccountWidget.tsx:63-64`.
- Qué hacer: Una sola cuenta: `leerResumenDeAdmin` usa `vistaDeAtRisk` y la tarjeta dibuja `ClienteEnRiesgo` con su `texto` y su color. Se borran `filasDeRiesgo` y `motivoDeRiesgoTxt`. El titular es el largo de esa lista y el vacío dice lo mismo que la página. Si falta una de las dos lecturas, «No pude leer», como `vistaDeAtRisk`. `clientesEnRiesgo` saca a los de agencia adentro de sus dos bucles: filtrar `filas` antes de llamarla no alcanza, porque un atrasado entra por `ingresos`. La tarjeta usa `clave` como key, porque `ws` y `montoCentavos` pueden ser null.

**8. «Por cobrar › Ver todo» abre una lista que esconde a los que deben, y sin montos.**
- Qué pasa: Subscriptions abre filtrada en «Activa» y compara exacto, así que las `past_due` quedan afuera. Quien pagó una parte sigue en «Activa» y no se distingue. La tabla no dice cuánto paga ni cuánto debe cada uno, aunque el CSV sí lo trae.
- Dónde: `web/Widgets/AccountWidget.tsx:52`; `(polar)/sales/subscriptions/SubscriptionsPage.tsx:45-46,66-109`; `datos/ventas.ts:437,581,642,655-656`; `tests/admin-polar-ventas.test.ts:157-158`.
- Qué hacer: En `filtrarSuscripciones`, «Activa» también muestra `past_due`, con las atrasadas primero, como `suscripcionesDelNegocio` (`datos/cliente.ts:93`). La opción «Atrasada» sigue aparte. Polar no las incluye en Active; acá sí, porque esta pantalla tiene que contestar quién debe: se anota en «Diferencias con Polar» del relevo. Una suscripción es «Atrasada» también con `deudaUsd > 0`. Columnas nuevas «Por mes» y «Debe» (en rojo), con los valores del CSV. «Ver todo» de Por cobrar va a `?status=past_due` cuando hay atrasos.

**9. «Por cobrar» pierde al moroso a los 15 días.**
- Qué pasa: Pasada la gracia, la suscripción manual se da por cortada en los tramos y sale de Por cobrar, aunque su historia sigue diciendo que debe. El total baja sin que nadie haya cobrado. El mismo cliente es «Atrasada» en Subscriptions, «Dejó de pagar» sin monto en At Risk y no está en Por cobrar.
- Dónde: `lib/admin-ingresos-reglas.ts:169,406-410,431-433`; `datos/ventas.ts:581`; `datos/clientes.ts:295,311`; `lib/suscripcion-meses.ts:443`; `tests/admin-ingresos.test.ts:102`.
- Qué hacer: `porCobrarDe` mira primero la historia: si `proximos` trae esa suscripción y no es `sinCobro`, entra aunque el tramo esté cortado. `t.fin != null` descarta sólo a las que no tienen historia. Tope de 60 días de atraso, en una constante junto a `GRACIA_DIAS`, porque `deudaUsd` crece sin fin para quien se fue sin corte guardado: pasado eso sale de Por cobrar. El MRR sigue con la gracia. Casos de test con 20 y con 70 días de atraso.

**10. «Lo que paga por mes» tiene dos cuentas: MRR y suscripciones no cierran entre pantallas.**
- Qué pasa: En la ficha, la caja sale del último pago y «Monto / mes» de la tabla sale de la mensualidad: quien paga 100 de 238 ve 100 y 238. MRR y «Suscripciones activas» cuentan a quien pagó una mensualidad aunque su lead no sea de suscripción, y Subscriptions no lo lista. También siguen contando una suscripción cortada en el CRM hasta que pasa la gracia, mientras Subscriptions ya dice «Cortada».
- Dónde: `datos/cliente-server.ts:163`; `lib/admin-ingresos-reglas.ts:9-17,119-123,168-181,423-424`; `CustomerSubscriptionsTable.tsx:67-76`; `lib/cobrado-lead.ts:356-358`; `CustomerMetricsOverview.tsx:61-65`; `lib/admin-ingresos.ts:57-60,229-231`; `datos/ventas-server.ts:124-130`; `tests/admin-ingresos.test.ts:201-231`.
- Qué hacer: Para una suscripción con historia, el MRR de hoy y el de cada mes salen de su mensualidad (`montoDelMes` y `mrrDeSuscripcion`, `lib/suscripcion-meses.ts`) y su corte guardado la saca el día del corte. Un lead con `es_mensualidad` sin `venta_tipo` de suscripción entra también en `suscripcionesDeLaPlataforma`. La caja de la ficha lee esa misma mensualidad. El MRR por pagos del 5/11 se eligió porque el monto del lead estaba vacío, y eso ya lo cubre la inferencia de `montoHoyUsd`: se actualizan ese comentario y el test.

**11. Cost Drivers queda vacío en cuanto hay una sola llamada de Claude con la clave de MaKo.**
- Qué pasa: Una fila alcanza para que la pestaña y su columna en Customers › Overview digan «No se puede repartir por negocio». Esa fila existe en la práctica todos los meses: closing usa esa clave y cada veto escribe otra. El selector de mes ya pedido sólo elegiría entre carteles. El motivo del cartel ya no es cierto: desde el 17/10 esas filas se anotan en la plataforma, no en un negocio.
- Dónde: `datos/clientes.ts:366-367`; `lib/costos-ia.ts:19-25,146-147,166`; `lib/anthropic-usage.ts:53-65`; `lib/veto-claude.ts:107`; `lib/anthropic.ts:63`; `web/Customer/TopCostCustomersList.tsx:43-45,85-86`; `(polar)/customers/cost-drivers/CostDriversPage.tsx:69`; `tests/admin-polar-clientes.test.ts:172-180`.
- Qué hacer: Sin columna nueva ni migración. Desde 2026-11, `costosPorCliente` lista los negocios con lo anotado en cada uno y agrega la línea «Claude con la clave de MaKo: US$ X, no se reparte» (el corte de la plataforma). `SinReparto` queda sólo para los meses anteriores, con título «No se puede repartir este mes» y frase «Ese mes el gasto de Claude quedó anotado en un solo negocio.». Se corrigen la cabecera de `costos-ia.ts` y el test.

**12. «Margen bruto» va a decir casi 100% aunque MaKo no gane eso.**
- Qué pasa: El costo es sólo la IA pagada por API con claves de MaKo. No resta los dos planes Max (US$ 200 por mes cada uno, con su uso anotado en 0) ni la infraestructura. Un mes con todo gratis da 100%. Nada lo aclara y «Ver todo» lleva a Costs, donde el margen no aparece.
- Dónde: `datos/resumen.ts:14-15,283-293`; `lib/costos-ia.ts:81-89`; `lib/veto-claude.ts:47-49`; `web/Widgets/GrossMarginWidget.tsx:24,44,47`; `datos/costos.ts:23`.
- Qué hacer: Título «AI margin» y leyenda «Últimos 30 días · sólo resta la IA por API». En Costs, arriba del gráfico, lo cobrado del mes y ese margen, en el lugar de la tarjeta de `analytics-costs.png`. «Gross margin» no se usa hasta que se puedan cargar los costos fijos; eso no se hace ahora.

**13. «N eventos hoy» no se puede comprobar en ninguna pantalla.**
- Qué pasa: El número suma pagos y todo lo que corrió MaKo, lecturas incluidas, pero las filas muestran sólo acciones. «Ver todo» abre Events en los últimos 3 meses, con errores, reportes, altas y sesiones del agente. Polar enlaza con `range=today`; acá se perdió.
- Dónde: `datos/resumen.ts:419,433,437`; `web/Widgets/ActivityWidget.tsx:41`; `(polar)/analytics/events/rangePresets.ts:10`; `datos/eventos.ts:43,61,318`.
- Qué hacer: `deHoy` cuenta sólo `tipo === 'accion'`. «Ver todo» va a `/admin/analytics/events?range=today&eventTypes=pago,mako`. En Events, las lecturas de MaKo salen de «Acciones de MaKo» y pasan a un tipo aparte, para que ese filtro dé el mismo número que la tarjeta.

**14. Una regla de CSS sin capa pisa todos los colores de borde de Admin.**
- Qué pasa: Todo borde adentro de Admin sale del mismo gris. Cada ítem de la barra se ve recuadrado, el puntito de estado de Subscriptions es igual para Activa, Atrasada y Cortada, las tarjetas de Orders y de la ficha llevan contorno, el interruptor de Settings lleva un anillo gris, los campos pierden el borde azul de foco y los avisos de color pierden su borde. Una regla sin capa le gana siempre a `@layer utilities` de Tailwind 4; Polar la tiene adentro de `@layer base`.
- Dónde: `app/admin/_polar/polar.css:150`, importado sin capa en `app/globals.css:23`.
- Qué hacer: `@layer base { .pl *, .pl ::after, .pl ::before, .pl ::backdrop { border-color: var(--border); } }`. No tocar los componentes. Confirmar con una captura de la barra y de Sales › Subscriptions.

**15. Editar General puede borrar el asunto y la frase del correo del recibo.**
- Qué pasa: Se escribe el asunto en Customer Notifications, se pasa a General y se cambia la dirección: se graba el emisor entero con el asunto viejo y lo escrito se pierde sin aviso. Notifications guarda sin revalidar ni refrescar, y General puede abrirse con el emisor precargado por `prefetch={true}` o con el botón atrás.
- Dónde: `app/admin/cobros/recibos-actions.ts:127-135`; `web/Settings/OrganizationProfileSettings.tsx:119,125,134`; `web/Settings/OrganizationCustomerEmailSettings.tsx:39-58`; `lib/recibos.ts:803-806`; `datos/ajustes.ts` (`emisorConCambios`).
- Qué hacer: `guardarEmisorAction` recibe sólo los campos cambiados, los mezcla en el server sobre `leerEmisor()` y llama `revalidatePath('/admin/settings', 'layout')`. Las dos pantallas mandan sólo lo que tocaron.

**16. Settings pierde lo escrito si se sale antes de un segundo, y los precios no confirman nada.**
- Qué pasa: En General y en Customer Notifications, el cleanup hace `clearTimeout` sin guardar: lo escrito se descarta sin aviso, y son datos que salen en cada recibo. En los precios de Payments, que salen en /planes, la pantalla no cambia al guardar y no hay botón, así que no se distingue «se guardó» de «no pasó nada».
- Dónde: `web/Settings/OrganizationProfileSettings.tsx:127,139-144`; `web/Settings/OrganizationCustomerEmailSettings.tsx:48,54-57`; `web/Settings/OrganizationPaymentSettings.tsx:44-61,115-117`.
- Qué hacer: Al desmontar con cambios pendientes se guarda en vez de cancelar: lo pendiente va en un ref y `guardarEmisorAction` se llama desde un cleanup aparte, con dependencias vacías. En los campos de precio y en Cliente de agencia, «Guardado» en gris por 2 segundos en la misma fila. General y Notifications no llevan indicador, porque Polar guarda en silencio ahí y se copia.

**17. «Usar el precio de un plan» carga dólares en la moneda que esté elegida.**
- Qué pasa: Con el recibo en ARS, elegir «MaKo Pro · US$ 97» deja ARS 97. El aviso de diferencia sólo compara si se pagó en esa moneda, así que puede salir el recibo equivocado y su número queda gastado.
- Dónde: `web/Orders/CargarPagoModal.tsx:128,133`; `lib/recibos-reglas.ts:274`; `datos/ventas.ts:398-403`.
- Qué hacer: Al elegir el plan, poner también `moneda: 'USD'` en el formulario.

**18. «Editar negocio» promete un mail y no avisa si no salió.**
- Qué pasa: El formulario dice «se le avisa por mail». Si el correo falla, el modal se cierra como si todo hubiera salido bien, y `enOrden` se queda con la última respuesta, así que un `plan_a_mano` posterior tapa el aviso.
- Dónde: `web/Customer/EditCustomerModal.tsx:72-80,120`; `web/Customer/CustomerPage/acciones.ts` (`enOrden`); `app/api/admin/workspaces/route.ts:159-170`; `lib/plan-aviso.ts:31-37`; `lib/aviso-plan.ts:49-51`.
- Qué hacer: Guardar el `aviso` de la acción `capa` y pasarlo por `avisoCambioPlan` (`lib/plan-aviso.ts:31`), que ya existe y nadie llama. Con `tono === 'warn'`, el modal queda abierto con un Alert warning: «El plan cambió, pero el mail no salió: <error>» y un botón «Cerrar». No mirar `enviado === false` directo: también significa «no hay nadie adentro», y eso no es una falla.

**19. El enlace «Suscripción» de un pedido puede dar 404 o abrir la de otro.**
- Qué pasa: Arma `l-<lead>` sin comprobar que exista. Si el lead no es de tipo suscripción lleva a 404. Si el negocio tiene varios leads, `leadId` es el del primero y puede abrir otra suscripción.
- Dónde: `web/Orders/OrderDetails.tsx:20-23`; `(polar)/sales/subscriptions/[id]/page.tsx`; `(polar)/sales/[id]/page.tsx`; `lib/admin-ingresos.ts:57-61,134,231`; `lib/cobros.ts:1234`; `datos/ventas.ts:600,612-614`.
- Qué hacer: `sales/[id]/page.tsx` lee `vistaSuscripciones()` y busca primero `c-<cobroId>`; para los manuales, la suscripción cuya `historia[].pedidos` incluye `order.id`. Pasa esa ruta a `OrderDetails` como prop. Si no aparece, «Suscripción» sin enlace.

**20. Después de eliminar un negocio, sigue en la lista y en la búsqueda.**
- Qué pasa: La ficha borrada sigue a la vista con su menú activo. «Ir a Customers» vuelve a una lista que todavía lo muestra; al tocarlo da 404, y sigue en ⌘K hasta recargar. Los layouts compartidos no se vuelven a dibujar con `router.push`.
- Dónde: `web/Customer/CustomerPage/CustomerHeader.tsx:74-77,82-108,159`; `(polar)/customers/layout.tsx:17-26`; `(polar)/layout.tsx:27`; `web/CheckoutLinks/CheckoutLinkListSidebar.tsx:88-90` (molde).
- Qué hacer: «Ir a Customers» llama `router.push('/admin/customers')` y después `router.refresh()`. Con `eliminado` puesto, no se dibuja el menú de acciones.

**21. «Compartir» en un plan abre el link de otra persona en vez de armar uno.**
- Qué pasa: En MaKo cada link es de una persona y sirve una vez. Si el plan ya tiene links, «Compartir» salta al primero por orden alfabético, que puede estar pagado o ser de otro comprador, y el formulario no se abre. La ficha del plan no tiene esa acción y el botón de la lista está oculto en pantallas chicas.
- Dónde: `web/Products/ProductListItem.tsx:62,65`; `(polar)/products/checkout-links/page.tsx:32-41,53`; `web/CheckoutLinks/CheckoutLinkListSidebar.tsx:62-66`; `web/Products/ProductPage/ProductPage.tsx:10,51-59`.
- Qué hacer: El botón pasa a «Vender» y va a `/admin/products/checkout-links?productId=${product.id}&create_checkout_link=true`. La misma acción entra en el menú de la ficha, junto a «Copiar el ID». Se corrige el comentario de `ProductPage.tsx:10`. Debajo del precio, sólo un enlace a Settings › Payments. Buscador, filtro, orden y «Copiar el ID» quedan: son de Polar.

**22. «Suspender» a una persona no pide confirmación y le borra sus tokens para siempre.**
- Qué pasa: Un clic deja afuera a la persona y borra los tokens de API que creó. «Reactivar» le devuelve la entrada, no los tokens, y sus integraciones quedan rotas sin aviso. «Pausar cuenta» sí pide confirmación.
- Dónde: `web/Customer/CustomerPage/MembersSection.tsx:73-77,200`; `app/api/admin/usuarios/route.ts:247`; `lib/agente-token-nucleo.ts:246-256`.
- Qué hacer: «Suspender» pasa por `ConfirmModal` con este texto: «Deja de entrar y se apagan los tokens de API que creó. Reactivarla no los devuelve.». «Reactivar» sigue directo.

**23. Dos lecturas fallidas se ven como un vacío: «sin resultados» y 404.**
- Qué pasa: Si no se puede leer el índice, ⌘K dice «No hay resultados» y parece que el negocio no existe. Si falla la lectura de los links, la página de un link da un 404 pelado.
- Dónde: `(polar)/layout.tsx:27`; `(polar)/page.tsx:31`; `(polar)/products/checkout-links/[checkoutLinkId]/page.tsx:19,37`; `OmniSearch.tsx:205`; `datos/productos-server.ts:42`.
- Qué hacer: El índice viaja con `error: string | null` y OmniSearch muestra «No pude leer los negocios». La página del link dibuja el mismo Alert de la barra («No pude leer los links») en vez de `notFound()`.

**24. Filas y botones de copiar que parecen funcionar y no hacen nada.**
- Qué pasa: Un lead sin cuenta en Top Customers, At Risk, Por cobrar o los pagos de Actividad, o una disputa sin pedido, parece clicable y no abre nada. «Copiar el ID del plan» no da señal. El campo del link de pago muestra el tilde aunque el portapapeles haya fallado, así que se le puede pegar otra cosa a un cliente. El «copiar» de la lista de links se calla el error.
- Dónde: `app/admin/_polar/orbit/components/datatable/DataTable.tsx:193`; `(polar)/customers/top/TopCustomersPage.tsx:120-124`; `(polar)/customers/at-risk/AtRiskPage.tsx:90-94`; `(polar)/sales/disputes/DisputesPage.tsx:102-104`; `web/Widgets/TopCustomersWidget.tsx:63`; `web/Widgets/AccountWidget.tsx:60`; `datos/resumen.ts:251,378,414`; `web/Products/ProductListItem.tsx:86`; `web/Products/ProductPage/ProductPage.tsx:54`; `app/admin/_polar/atoms/CopyToClipboardInput.tsx:29,35`; `web/CheckoutLinks/CheckoutLinkListSidebar.tsx:166`.
- Qué hacer: `isRowClickable` en DataTable. Las filas sin cuenta abren `/crm/<lead>?ws=<plataforma>`, como `rutaDelCliente` (`OrderCustomerContext.tsx:38-39`). `leadId` ya viene en `ClienteResumen` y se agrega a `ClienteTop`, `FilaPorCobrar` y `ClienteEnRiesgo`. Una disputa sin pedido no es clicable. `CopyToClipboardInput` marca «Copiado» sólo en el `.then` y en el `.catch` dice «No pude copiar». La misma señal en los dos menús del plan y en la lista de links.

## Lo que no tiene sentido

**25. Las personas de MaKo se quedaron sin lugar: falta Settings › Members.**
- Qué pasa: La pantalla vieja de Users tenía Plataforma, Agencia y Cliente. La nueva sólo muestra a las personas de un negocio, en su ficha. Las de rol admin de MaKo y las cuentas sin negocio no aparecen en Admin ni en ⌘K: no se las ve, no se les reenvía el acceso y no se las suspende. El código dice que viven en Settings › Members, que no existe. Polar lo tiene segundo en Settings.
- Dónde: `web/Customer/CustomerPage/MembersSection.tsx:5-7`; `datos/cliente-server.ts:11`; `datos/cliente.ts:304-307`; `web/Dashboard/navigationSettings.tsx:5-9,28-40`; `web/Settings/settingsSections.ts:12-15`; `datos/busqueda-tipos.ts:9-10`; `datos/resumen.ts:57-58`. Lo de antes: `git show dd2756a4a^:app/admin/usuarios/data.ts`.
- Qué hacer: Settings › Members, segundo como en Polar, con `MembersSection` y `EditMemberModal`: el equipo de la plataforma, los de rol admin y los sin negocio, por /api/admin/usuarios. Las personas de un negocio siguen sólo en su ficha y las de MaKo sólo acá. ⌘K las encuentra y lleva ahí, y los links viejos `?tab=users` también.

**26. Finance › Income es Orders otra vez, y con otros números.**
- Qué pasa: Queda la misma lista de pagos de Orders, pero peor: no abre el pago, no dice si se devolvió o se anuló y no trae los cargados a mano. Son dos listas de pagos que no dan lo mismo. Donde Orders dice «Pago único», acá dice «Compra». La barra despliega Finance para mostrar un solo subítem.
- Dónde: `datos/finanzas-server.ts:16-17`; `datos/ventas-server.ts:105`; `web/Transactions/TransactionsList.tsx:6-8,31-91`; `datos/finanzas.ts:46`; `TransactionMeta.tsx:19`; `datos/ventas.ts:317`; `web/Dashboard/navigation.tsx:184`; `DashboardNavigation.tsx:123-125`.
- Qué hacer: Income pasa a ser el libro de plata. Sale de los mismos pedidos y totales de Orders (`vistaOrders`), con Fecha, Descripción, Medio, Bruto, Devuelto y Neto (`devueltoMonto` ya existe), arriba lo que entró este mes, y cada fila abre su pedido. «Compra» pasa a «Pago único». Finance abre Income directo, sin subítem. No se le agrega filtro: Polar no lo tiene.

**27. La ficha no dice cómo está el negocio.**
- Qué pasa: Se entra desde At Risk y la ficha no dice por qué estaba ahí. Debajo del nombre va «Negocio #12» en letra de título, el mismo dato de la fila ID, y Martín pidió nombres y no códigos. No dice cuándo entraron por última vez, cuántos leads tiene ni cuándo le toca pagar. Esos datos ya se calculan y la ficha anterior los mostraba. En Usage, «Medidor» y «Consumido» no significan nada en MaKo.
- Dónde: `web/Customer/CustomerPage/CustomerPageShell.tsx:36-38`; `CustomerDetailsSection.tsx:125-153`; `lib/clientes-plataforma.ts:50-59` (`FilaCliente`); `datos/cliente-server.ts:93-100`; `CustomerSubscriptionsTable.tsx:36-75`; `datos/ventas.ts:589,597`; `web/Customer/CustomerPage/CustomerUsageView.tsx:124,145`.
- Qué hacer: Se borra «Negocio #n»; el número queda sólo en la fila ID. En su lugar, plan y estado en palabras: «MaKo Pro · Atrasado 4 días», con el `texto` de `clientesEnRiesgo` si está en riesgo, y «MaKo Pro · Activo» si no. En Details, una sección «Activity»: última vez que entró, leads (cuántos y el último) y sesiones del agente en 30 días. Es un resumen, no la pantalla de actividad descartada. En su tabla de Subscriptions, «Próxima» y «Debe». En Usage, encabezados «Dónde» y «Uso», porque la tabla mezcla tabs con la fila de IA y «Tab» no serviría. El «primer mes» no va acá: va con cómo llegó cada cliente, ya pedido.

**28. Un contracargo no avisa en ningún lado.**
- Qué pasa: Polar pone un aviso arriba de Overview con una disputa por responder. Acá ese aviso se usó de molde para otras cosas y el original se perdió. MaKo no manda correo ni WhatsApp por un contracargo y Disputes no tiene contador: si no se entra a esa pantalla, no se sabe. En Stripe, además, Ingresos baja sin explicación.
- Dónde: `web/DashboardOverview/DashboardPage.tsx:10-12`; `web/DashboardOverview/EsperaBanners.tsx:3-7,400-402`; `lib/cobros.ts:1562-1577`; `lib/cobros-webhook.ts:464-466,601-603`; `datos/ventas-server.ts:186-190`; `datos/ventas.ts:741`.
- Qué hacer: Una fila nueva, la primera, en la lista de esperas de Overview (punto 38): «Un cliente disputó un cargo», con los estados abierta, plata descontada y en revisión de `disputasDe`, y su botón lleva a Sales › Disputes. Sin ninguno, no se dibuja. En Mercado Pago cuenta sólo el texto de `in_process` («está en revisión»): todo texto de Mercado Pago da `en_revision`, incluso ya resuelto, y el aviso no se iría nunca.

**29. Top Customers cambia al tocar «Ver todo».**
- Qué pasa: La tarjeta cuenta desde siempre («del total cobrado») y «Ver todo» abre 30 días: otros montos, otro orden, y puede decir «Sin pagos todavía» debajo de una tarjeta con pagos.
- Dónde: `web/Widgets/TopCustomersWidget.tsx:41-45`; `datos/resumen.ts:172-190`; `(polar)/customers/top/TopCustomersPage.tsx:60,103`.
- Qué hacer: `TopCustomersPage` arranca en `all_time`.

**30. Usage afirma qué no se usó «en el rango» sin mostrar ningún rango.**
- Qué pasa: «Sin uso» dice «Las tabs que nadie del negocio abrió en el rango», pero no hay selector ni fecha. Desde la ficha con 30d es de 30 días; entrando directo es de toda la vida del negocio.
- Dónde: `web/Customer/CustomerPage/CustomerUsageView.tsx:59,98,214,217`; `CustomerMetricsOverview.tsx:44-54`; `CustomerSubnav.tsx:34-47`.
- Qué hacer: `<CustomerMetricsRangeControl inicio={inicio} />` arriba a la derecha de Usage, igual que en la fila Metrics de la ficha, y también en el vacío «Sin uso en estos días».

**31. Admin no tiene pantalla de carga: se hace clic y no pasa nada.**
- Qué pasa: Cada página lee en el server los datos de todos los negocios y queda la pantalla anterior hasta que termina. Al tocar un negocio en la lista no cambia ni el resaltado. Además, la barra precarga todas las secciones al abrir cualquier página, y puede mostrar datos precargados de hasta 5 minutos. `prefetch={true}` viene de Polar, donde las páginas piden sus datos desde el navegador.
- Dónde: `(polar)/` sin ningún `loading.tsx`; `web/Layout/Dashboard/NavList.tsx:77,129`; `web/Customer/CustomerListSidebar.tsx:64,119-126,284`; `datos/cliente-server.ts:167-192`; `app/crm/loading.tsx` (molde).
- Qué hacer: Agregar `(polar)/loading.tsx` y `(polar)/customers/[id]/loading.tsx` con `CargandoMako` y un esqueleto, y sacar `prefetch={true}` de las dos líneas de NavList. Van juntos: sin precarga y sin loading, la barra también quedaría sin respuesta.

**32. Cada filtro, orden y página de Sales relee todo del server sin avisar.**
- Qué pasa: Todas las filas ya están en el navegador, pero tocar «página siguiente» o un estado parece no hacer nada hasta que vuelve el server. Lo mismo con el rango de la ficha, que relee la ficha entera por cada clic.
- Dónde: `web/Orders/useDataTableQueryState.ts:29`; `web/Customer/CustomerPage/useCustomerMetricsParams.ts:61`; `web/CheckoutLinks/CheckoutLinkListSidebar.tsx` (`setSorting`); `useClientSidePagination.ts:14-25` (ya lo resolvió Customers).
- Qué hacer: En `useQueryParams.set` y en `escribir` de `useCustomerMetricsParams`, cambiar `router.replace` por `cambiarQuery` (`history.replaceState`). Lo mismo con el orden de Checkout Links.

**33. Cada entrada a Customers y a Costs recorre toda la tabla de uso de IA.**
- Qué pasa: `resumenDelPeriodo` siempre llama a `mesesConDatos`, que pagina `anthropic_usage` entera de a 1000 filas y en serie, sólo para saber qué meses hay. Customers no usa ese dato. Costs lo paga dos veces. Crece con cada llamada a la IA.
- Dónde: `lib/costos-ia.ts:168,178,195-199`; `datos/clientes-server.ts:40-46`; `datos/clientes.ts:390`; `datos/costos-server.ts:17-20`; `(polar)/customers/page.tsx:48`; `(polar)/customers/cost-drivers/page.tsx:22`.
- Qué hacer: `resumenDelPeriodo(periodo, { conMeses: false })` por defecto, y los meses se piden una sola vez en `leerCostos`. Integraciones no se rompe: los pide aparte. `mesesConDatos` pasa a una función SQL con `date_trunc` y `distinct`.

**34. Los mails viejos de «Quieren entrar» llevan a Customers, donde esos pedidos no están.**
- Qué pasa: Los avisos ya enviados apuntan a `/admin?tab=accounts` y `/customers?tab=accounts`, que terminan en `/admin/customers`. El aviso ahora vive en Overview, así que no se encuentra el pedido.
- Dónde: `datos/resumen.ts:63-66`; `app/customers/destino.ts:14`; `lib/pedidos-ingreso-reglas.ts:72-73`; `tests/admin-polar-resumen.test.ts:64`.
- Qué hacer: En `destinoDeTabViejo`, `accounts` sin `cuenta` devuelve `/admin`; con `cuenta` sigue a la ficha. Se actualiza ese test.

## Diseño

**35. La lista de negocios sólo dice el nombre.**
- Qué pasa: Cada renglón es avatar y nombre: un negocio pausado se ve igual a uno activo y para saber el plan hay que abrirlo. Polar usa una segunda línea, que quedó vacía al sacar el email. El filtro dice «Inactivos» y significa pausados, y se confunde con «Sin uso» de At Risk.
- Dónde: `web/Customer/CustomerListSidebar.tsx:190,294-298`; `datos/clientes.ts:59-69,92-99`; `datos/busqueda-tipos.ts:39-46`; captura `customers-overview.jpg`.
- Qué hacer: Segunda línea `text-xs` en gris: `{customer.plan}{!customer.activo && ' · Pausado'}`, la misma frase de ⌘K. El filtro queda Todos, Activos, Pausados.

**36. Las tres columnas de Customers › Overview dependen de la ventana, no del lugar que queda.**
- Qué pasa: Cada columna mide unos 248 px a 1536 con la barra plegada, 192 con la barra fija y 107 a 1280 con la barra fija. A 192 quedan unos 64 px para el nombre. Los subtítulos de largos distintos hacen que las listas no arranquen a la misma altura.
- Dónde: `web/Customer/CustomersOverview.tsx:52-79`; `Toplist.tsx:17-24`; `Shared/EmptyState.tsx:34`.
- Qué hacer: `templateColumns="repeat(auto-fit, minmax(210px, 1fr))"`. Con 240 se rompen las tres columnas a 1440 con el rail. En `ToplistHeader`, el subtítulo va debajo del título (`flexDirection="column"`). En EmptyState con `fill`, el relleno baja a `xl`.

**37. Admin no pliega la barra de MaKo aunque trae su propia barra.**
- Qué pasa: Con la barra de MaKo fija, las dos juntas se comen 468 px. A 1440, Events con el detalle abierto deja unos 299 px para una fila que pide 416 y se corta Monto. La ficha queda con 570 px contra unos 814 de la referencia. Pasa sólo con la barra fijada, y fijarla se recuerda en todas las tabs.
- Dónde: `app/_components/Sidebar.tsx:125`; `app/_components/nav.ts:222`; `tests/sidebar-nueva.test.ts:185-189`.
- Qué hacer: `pliegaLaBarra` da verdadero también en `/admin` exacto y en las rutas de `SECCIONES_ADMIN`, que se exporta de `nav.ts`, sin atrapar /admin/dev ni el resto. La flecha sigue abriéndola, como en el Ops Center. Se suma el caso al test.

**38. Los avisos de arriba empujan los widgets fuera de la primera pantalla.**
- Qué pasa: Cada aviso mide unos 130 px. Con los tres prendidos, los widgets arrancan cerca de 580 px más abajo. A 864 px de alto, la primera fila queda cortada y la segunda no se ve.
- Dónde: `web/DashboardOverview/EsperaBanners.tsx:98-103,200-204,307-318,390-403`; `app/admin/_polar/orbit/components/Alert.tsx:181-185`; `datos/resumen.ts:527`.
- Qué hacer: Una sola `List size="small"`, una fila por espera: título a la izquierda, botón a la derecha, sin frase. En Bajas, el dato de la frase pasa al título («2 personas pidieron eliminar su cuenta · 1 vencida») y, con una vencida, va en `color="danger"`. El aviso de lectura incompleta sigue siendo un `Alert` aparte.

**39. Hay nombres de sección en español al lado de otros en inglés.**
- Qué pasa: La ficha se lee «Metrics, Línea de tiempo, Datos, Alta, Conexiones, Subscriptions, Orders». En Costs conviven Overview y LLM con «Desglose» y «Cambios». En Overview, «Ingresos» y «Actividad» están al lado de «Top Customers» y «At Risk». `CostsPage.tsx:12` dice lo contrario de la decisión de Martín.
- Dónde: `CustomerDetailsSection.tsx:125,144,146,154`; `CustomerTimeline.tsx:303`; `(polar)/analytics/costs/CostsPage.tsx:12,138,190,258,274`; `web/utils/metrics.ts:177-188`; `OrganizationProfileSettings.tsx:155`; `OrganizationCustomerEmailSettings.tsx:75`; `RevenueWidget.tsx:24`; `ActivityWidget.tsx:18`; `GrossMarginWidget.tsx:24`.
- Qué hacer: Datos→Details, Alta→Onboarding (la fila `label="Onboarding"` pasa a «Estado del alta»), Conexiones→Integrations, Línea de tiempo→Timeline, Desglose→Breakdown, Cambios→Changes, Por modelo→By Model, Por proveedor→By Vendor. Grupos de Metrics: Revenue, Orders, Subscriptions, Cancellations, Unit Economics. Settings: Perfil→Profile, Compras→Purchases. Tarjetas: Ingresos→Revenue, Actividad→Activity, Margen bruto→AI margin (punto 12). «Por cobrar» queda. Las frases y los rótulos de lo que mide cada gráfico siguen en español. Se corrige el comentario de `CostsPage.tsx:12`.

**40. Quedan celdas vacías en los gráficos de Metrics, justo al ancho de Martín.**
- Qué pasa: Desde 1536 px la grilla pasa a tres columnas. Con tres métricas, Ingresos ocupa dos, MRR una y la tercera queda con dos celdas vacías. También pasa en los grupos de una y de tres métricas. Las métricas por defecto no son las de Polar, aunque MaKo mide `active_subscriptions` y `orders`.
- Dónde: `web/Metrics/dashboards/MetricGroup.tsx:34,57`; `web/utils/metrics.ts:159,177-178,187-188`; `app/_components/Sidebar.tsx:131`; `docs/admin/referencia-polar/LEEME.md:8`.
- Qué hacer: Sacar `2xl:grid-cols-3` y agregar `index === metricKeys.length - 1 && metricKeys.length % 2 === 0 && 'lg:col-span-2'`. Default: `['revenue','monthly_recurring_revenue','active_subscriptions','orders']`. Quien ya guardó su elección la conserva.

**41. Textos con explicaciones internas y un número de migración en pantalla.**
- Qué pasa: La pantalla explica criterios internos en vez de decir qué pasó, contra `AGENTS.md:2864`.
- Dónde y qué hacer:
  - `(polar)/sales/SalesFilters.tsx:62` → «Los recibos todavía no están listos.»
  - `(polar)/sales/[id]/SalesPage.tsx:132` → «Este pago no tiene recibo.»
  - `CustomerUsageView.tsx:85` → «Sin esa medición no se sabe qué tabs abre.»
  - `CustomerUsageView.tsx:230` → «No incluye Claude con la clave de MaKo.»
  - `(polar)/sales/subscriptions/SubscriptionsPage.tsx:126` → «Aparecen aquí cuando un cliente se suscribe.»
  - `(polar)/sales/checkouts/CheckoutsPage.tsx:130` → «Un link sin pagar aparece aquí.»
  - `(polar)/sales/disputes/DisputesPage.tsx:84` → «Un contracargo del banco aparece aquí.»
  - `web/Settings/OrganizationPaymentSettings.tsx:133` → «Sin este monto no sale el link del primer mes.»
  - `web/DashboardOverview/EsperaBanners.tsx:112`: se borra la frase, repite el aviso.
  - Se quedan como están `OrganizationPaymentSettings.tsx:169` y `EsperaBanners.tsx:216,330`: dicen una consecuencia o dónde se resuelve.

**42. «No pude leer» se ve de tres maneras.**
- Qué pasa: En Sales es una caja amarilla o verde con colores propios. En Overview, Customers, Analytics y Finance es el `Alert` de Polar. En Settings, un error es texto rojo suelto. El mismo aviso tiene al menos seis títulos distintos.
- Dónde: `web/Orders/Aviso.tsx:12-46`, que importan 11 archivos (7 en `(polar)/sales`, 4 en `web/Orders` y `web/Subscriptions`); `web/Customer/AvisosDeLectura.tsx:11-16`; `CostsPage.tsx:115-118`; `OrganizationPaymentSettings.tsx:28-34`; `OrganizationCustomerEmailSettings.tsx:25-31`; `OrganizationProfileSettings.tsx:160-165`; `IncomePage.tsx:43`; `EventsPage.tsx:381`; `MetricsPage.tsx:77`; `EsperaBanners.tsx:396`.
- Qué hacer: Se borran `Aviso.tsx` y `Fallo`. `Alert` con `warning` y `soporte` para lectura, `danger` para error y `success` para lo hecho, también en Settings. Un solo título para lectura incompleta: «Puede faltar algo».

**43. El mismo control cambia de nombre, y la cabecera de Customers se rompe a 390 px.**
- Qué pasa: El rango completo es «Todo» en Overview y «Desde siempre» en Customers y en la ficha. Exportar dice «Exportar» en Sales y «Bajar» en Finance. El modal de exportar cierra con «No cambiar nada», sin nada que cambiar. A 390 px, título y selector suman unos 400 px en una fila de alto fijo, contra 358 disponibles.
- Dónde: `web/utils/metrics.ts:113`; `datos/resumen.ts:103`; `web/Customer/CustomersPageShell.tsx:25-33`; `(polar)/finance/income/IncomePageHeader.tsx:27`; `web/Transactions/ExportTransactionsModal.tsx:32`; `web/Transactions/ExportModal.tsx:143`; `web/Orders/ExportCsvModal.tsx:46`; `tests/admin-polar-arreglos.test.ts:179`.
- Qué hacer: `all_time: 'Todo'` y se cambia ese test. «Exportar» en Finance y en su modal. «Cerrar» en `ExportCsvModal`. En `CustomersPageShell`, sin `height="2rem"` y con `flexWrap="wrap"` y `rowGap`.

## Lo que no se pudo ver: mirarlo con las capturas de la entrega

- Nada visual está comprobado y los anchos en px son cuentas sobre el código. Capturar a 1280, 1440 y 1536, con la barra de MaKo plegada y fija, en claro y en oscuro: barra, Sales › Subscriptions, Customers › Overview, Events con el detalle abierto, ficha y Overview con los avisos.
- La regla de bordes se dedujo de la cascada: confirmar el color de borde calculado de un ítem de la barra y del puntito de estado.
- Sin captura de referencia: Disputes, Checkouts, Checkout Links, detalle de pedido y de suscripción, Members, formularios de alta y edición, detalle de un evento y modales. La referencia es toda oscura y sin datos, así que tampoco se comparó el modo claro.
- La estrella de MaKo al costado de la barra de Polar (`data-barra-de-la-tab`) y los avisos de la esquina inferior derecha: ver si pisan algo.
- Teléfono y 390 px: en un teléfono real /admin va a /m/customers. Falta ver `MobileNav`, el Sheet del Sidebar y el fondo en oscuro al hacer scroll.
- Sin correr la app: el 404 tras devolver, la lista vieja tras eliminar, el emisor precargado y el corrimiento de fechas salen de seguir el código. Tampoco se probó el arrastre de «Personalizar», ni se midió cuánto tardan las páginas o cuántas lecturas dispara `prefetch={true}`.
- No se abrió ningún CSV ni el PDF del recibo.
- Producción no se leyó: si 0001 y 0002 ya están cargados, cuántos pagos hay duplicados, el `venta_tipo` de los que pagan, las filas de Claude con la clave de MaKo en noviembre, el tamaño de `anthropic_usage` y las renovaciones con recibo. El libro de recibos es del 5/11, así que el cruce de recibos puede aparecer recién con la primera renovación.
- Polar: `gh` no está en esta máquina y `72aa1109` no resolvió en la API, así que lo comparado se leyó de `main` o de las capturas. Comparar contra Polar si su Members deja sumar y eliminar personas: `/api/admin/usuarios` tiene `crear` y `eliminar`, y la pantalla no. También si Disputes está en su barra: en la captura de Sales de la cuenta de prueba no aparece.
- Permisos: no se encontraron fallas (`exigirSuperAdmin`, `getSesionAdmin`, `SOLO_ADMIN`), pero no se probó con una sesión real que no sea super admin.

Con todo esto hecho, repasar cada pantalla con dos preguntas: ¿esto tiene sentido para quien la usa?, ¿este número coincide con el de la pantalla a la que lleva? Lo que no cierre se cambia directamente, sin preguntarle a Martín.
