# Relevo — Admin es la copia del dashboard de Polar (nube, 6/11/2026)

> Lo escribe la sesión de la nube que hizo la copia (cuenta `nube`, sesión `cli_52beedef-99d8-5d17-8f21-3a599afd3cce`), rama
> `punta/admin-polar`. Reemplaza a [nube-admin-copia.md](nube-admin-copia.md) (Studio Admin, rechazada) y su pantalla. La fuente
> y por qué, en [docs/investigacion-admin.md](../investigacion-admin.md). El pedido de Martín, textual, en la bitácora del área
> (app/admin/dev/admin/bitacora.ts).

## El pedido

Martín rechazó dos versiones de Admin. La primera tomaba ideas de doce apps; la segunda portó un template de demos (Studio
Admin) sobre la navegación de antes y dejó adentro las pantallas viejas: «tres lugares para configurar mi perfil», «usuarios en
tres lugares» e «ingreso mensual en Customers». Textual, el 6/11/2026: «borres todo… copia por completo… no es solamente el
diseño, es también las funcionalidades… cómo distribuyen cada página… seas criterioso».

## La fuente, una sola

**polarsource/polar**, Apache-2.0, commit `72aa1109` (5/11/2026). Se portó SU código archivo por archivo
(`clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/`, `clients/apps/web/src/components/`, `clients/packages/ui`
y `clients/packages/orbit`) y sólo se reemplazaron sus llamadas a la API por las lecturas de MaKo. Cada archivo nombra su
original en la primera línea de comentario. Avisos: `lib/avisos/LICENSE-POLAR` y `lib/avisos/NOTICE-POLAR`; los íconos de
Material, `lib/avisos/LICENSE-MUI-ICONS` (MIT).

## Qué entró

La barra de Polar en el orden que pidió Martín: **Overview · Customers · Analytics · Sales · Products · Finance · Settings**
(Polar pone Products segundo). Sin barra superior, sin logo, sin selector de organización y sin cuenta en el pie: el perfil y el
modo oscuro son los de la barra de MaKo, que es UNA. Settings reemplaza la barra por la suya, con «← Settings», como Polar.

| Sección | Qué es en MaKo | De dónde sale |
|---|---|---|
| **Overview** (`/admin`) | Seis tarjetas como Polar: Ingresos (5 meses) · Actividad (hoy) · **Por cobrar** (el «Available balance» de Polar: los próximos cobros) / Top Customers · At Risk · Margen bruto (lo cobrado menos el gasto de IA que paga MaKo). Abajo, «Metrics» con sus rangos y «Customize». Arriba, los avisos de lo que espera a Martín: quieren entrar (con «Dar de alta»), agencias y bajas de cuenta | `vistaDeIngresos`, `vistaDeActividad`, `vistaDeClientes`, el gasto de IA por día (`gastoPorDia`), `pedidosPendientes`, `pendientesDeAprobar`, `bajasPendientes` |
| **Customers** | Un customer es un NEGOCIO. Maestro y detalle como Polar: la lista a la izquierda (buscar, filtrar, ordenar, exportar, «+» para dar de alta) y a la derecha Overview (crecimiento de negocios, no de ingresos), Top Customers, At Risk (atrasado, cobro fallido, pausado, dejó de pagar, sin uso) y Cost Drivers (gasto de IA por negocio). Los clientes de una agencia no van en la lista (viven en su agencia, regla del 28/09); la búsqueda los encuentra y su ficha abre por URL | `vistaDeClientes`, `vistaDeIngresos`, `resumenDelPeriodo` |
| **La ficha de un negocio** (`/admin/customers/<ws>`) | Overview: sus cifras (lo pagado, lo que paga por mes, los pagos), su línea de tiempo, sus datos, el alta y las conexiones (y sus computadoras, sólo con segundo factor: `puedeOperar`), y sus suscripciones y pedidos. Usage: las tabs que usa y las que no, y su consumo de IA. **Events: como en Polar, lleva a Analytics › Events filtrado por el negocio.** Members: el ÚNICO lugar de las personas (rol, alta, último ingreso, 2FA; editar, reenviar o mandar el acceso, suspender). «Editar» (nombre, plan, plan a mano, pausar, eliminar) y «Entrar a su cuenta» | `cliente-server.ts` sobre las mismas lecturas |
| **Analytics** | Metrics: MRR, ingresos, pedidos, suscripciones nuevas/activas/cortadas, ticket y promedio por cliente, mes a mes, en los grupos de Polar. Events: TODO lo que pasa (pagos, lo que hizo MaKo, errores y reportes, sesiones del agente de los clientes), con el histograma, los filtros por tipo y por negocio y el detalle. Costs: el gasto de IA (Overview, Breakdown por función, Changes, LLM por modelo y por proveedor) | `vistaDeIngresos`, `actividad_acciones`, `vistaDeErrores`, `leerSesionesAgente`, `resumenDelPeriodo` |
| **Sales** | Orders: cada pago con su recibo (bajar, reenviar, anular, devolver; «Cargar pago», con el aviso de diferencia). Subscriptions: las del CRM y las de la pasarela, con su historia mes a mes y «cortar». Checkouts: los cobros de pasarela sin pagar (no los de «Vender un plan», que viven en Checkout Links). Disputes: los contracargos | `vistaDeIngresos`, `recibosAction`, `suscripcionesDeLaPlataforma`, `cobrosDeMakoAction`, las acciones de `app/admin/cobros/` |
| **Products** | Catalogue: los planes (`planesMako()`), con su ficha. Checkout Links: los links de «Vender un plan», con su formulario y «Anular el link» | `planesMako`, `venderPlanAction`, `anularCobroMakoAction` |
| **Finance** | Income: lo que entró, con «Exportar» | `vistaDeIngresos().entradas` |
| **Settings** | General (los datos del emisor del recibo), Payments (los precios de cobro en la moneda de la pasarela y el del cliente de agencia), Customer Notifications (el correo y el WhatsApp del recibo) | `leerEmisor`, `cobros/actions.ts`, `leerWaSolo` |

**Búsqueda ⌘K** (`OmniSearch` de Polar): negocios y personas; una persona lleva al Members de su negocio.

**Los links viejos** (`/admin?tab=revenue|users|customers|accounts|billing|activity|agents|errors`, `/customers`,
`/admin/cobros`, `/admin/agente`) redirigen a su sección nueva (`destinoDeTabViejo`, `app/admin/_polar/datos/resumen.ts`).

**De paso:** `porCobrar` sale de `historiaDeSuscripcion` y no del último pago más un mes (el caso de Código: 5/12 por US$426;
`proximoDeHistoria`), y el próximo cobro y el atraso de cada cliente también (`proximoDelCliente`, `lib/admin-ingresos-reglas.ts`).

## Qué se borró

`app/admin/_studio`, las pantallas de Revenue, Users, Activity, Errors, Billing y Customers (también `app/admin/clientes`, la
tanda 3 de Studio que llegó a main), la barra de pestañas, `docs/admin/copia` y `lib/avisos/LICENSE-STUDIO-ADMIN`. Se quedan las
lecturas de servidor y sus tests, las operaciones de la API de MaKo (sus descripciones nombran las secciones nuevas), los
recibos, las acciones de `app/admin/cobros/`, `app/admin/ingresos/ingresos-vista.ts` (la usa el teléfono) y las otras rutas de
super admin. El teléfono (`/m/customers`) no se tocó.

## Lo que Polar tiene y se sacó (MaKo no lo puede llenar)

- **Barra y cuenta:** Payouts, Taxes, Benefits, Meters, Discounts y Account; el selector y el avatar de la organización; el
  aviso de sandbox, «Introducing Polar Plans», Support y Documentation.
- **Overview:** el saldo y los retiros (va «Por cobrar»); los rangos 30d y Today (MaKo mide por mes); los tableros propios de
  Polar (no hay dónde guardarlos); la acción rápida «Payouts» y «Create Product».
- **Customers y la ficha:** External ID, metadata, el email y el nombre de facturación de cada fila (las personas viven en
  Members), Billing (saldo, Tax ID, país), «Add Credits», los asientos, los beneficios y su tabla, el selector de medidores, la
  tabla «Recent Payments» (en MaKo un pago ES un pedido: serían dos tablas iguales) y **el gráfico de ingresos de la ficha**
  (regla de Martín: el gráfico de ingresos sólo en Overview y Metrics, nunca en Customers; la ficha muestra las cifras).
- **Analytics:** el intervalo (MaKo mide por mes) y el filtro por producto; las métricas sin dato (net revenue, checkouts y su
  conversión, MRR committed y de prueba, renovaciones, cancelaciones por motivo, churn rate, LTV); en Events los filtros de
  origen, costo, IA y metadatos, la columna Tokens, Parent/Children/LLM y abrir por UUID; en Costs Anomalies, clientes por
  modelo, costo por usuario, margen y cashflow, la página de un span, y «By Customer» (vive en Customers › Cost Drivers).
  «Share Chart» (una imagen pública del gráfico: Admin es privado).
- **Sales:** en Disputes la fecha de apertura, el plazo y responder; en el pedido el descuento, el neto y el saldo; en
  Subscriptions los cambios de plan, las pruebas, los asientos y los cupones.
- **Products:** crear, editar, duplicar, archivar y borrar planes (viven en el setting `planes.mako`, sin acción para eso), las
  versiones, «Integrate Checkout», los precios por uso o asiento, la pestaña Metrics y las listas de la ficha; en el formulario
  del link las URLs de éxito y vuelta, descuentos, dirección, asientos, prueba, metadata y Embed.
- **Finance:** Fees, Tax, Net y Status, las comisiones, el tipo de cambio, la hora y la zona del export.
- **Settings:** Identifiers, logo, país, web, redes, borrar la organización y las secciones que MaKo no llena.
- **Los toasts:** Admin no tiene Toaster; el resultado de cada acción se dice en la misma pantalla.

## «No está en la fuente» — lo que MaKo necesita y Polar no tiene (decide Martín)

No se inventó nada de esto. Lo que está entre paréntesis es lo que se hizo mientras tanto.

1. **La actividad de toda la plataforma** que mostraba la pantalla vieja de Activity: activos del día, la semana y el mes, quién
   entra cada semana, qué tabs nadie abrió. Polar no la tiene (está por negocio, en Usage y At Risk). La operación de la API
   `actividad` la sigue contestando por chat.
2. **Los errores agrupados** como Sentry (nuevos, sin resolver, los que volvieron): Polar no tiene una pantalla de errores; cada
   error es un evento de Analytics › Events, como pidió Martín. La operación de la API los sigue agrupando.
3. **El clic derecho en la lista de negocios** (Ver ficha, Entrar a su cuenta, Administrar): la lista de Polar no lo tiene
   (`tests/clic-derecho-listas.test.ts` lo deja como `todo`).
4. **Cómo llegó cada cliente** («Llegó por», «Quería resolver», «A corregir en su oferta») y **«Primer mes a US$ X»**: no están
   en Customers ni en su CSV (el teléfono sigue mostrando el primer mes).
5. **«Desconectar» una computadora** desde la ficha (`desconectarComputadoraAction` sigue existiendo).
6. **Un lugar para los clientes de agencia** fuera de la búsqueda (podrían vivir en la página de su agencia).
7. **Un selector de mes en Cost Drivers** (hoy, el mes en curso).
8. **«Para mirar»** de la pantalla vieja (pago pendiente, fin de los meses gratis, sin empezar, en prueba, nuevo): no entró en
   At Risk.
9. **El tipo de plan y el nombre del admin al crear un negocio desde la lista** (el alta lleva plan; el resto, el default).
10. **Los campos de «Vender un plan»** que la acción pide y Polar no tiene (email, cada cuánto, pasarela, moneda, monto, partner)
    y el estado del cobro en la barra del link (un link de MaKo sirve una vez). Se agregaron porque sin ellos no se vende.
11. **«Cargar pago», la historia mes a mes de una suscripción y «Darle el plan a su cuenta»**: Polar no los tiene; se hicieron
    con las acciones de MaKo que ya existían.
12. **Un recibo cargado a mano y el pago del CRM del mismo dinero** salen como dos pedidos: no hay columna que los una.
13. **La lista de lo que espera a Martín** (quieren entrar, agencias, bajas) va en los avisos de arriba del Overview, con el
    `Alert` de Polar: Polar no tiene esa lista.
14. **Lo elegido en «Customize» del Overview** se guarda en el navegador (Polar lo guarda en la organización).
15. **Ver ejemplo del PDF del recibo**, que tenía la pantalla vieja: no se puso.

## Diferencias con el panel real de Polar (docs/admin/referencia-polar)

- El orden de la barra es el de Martín, no el de Polar (Products va quinto).
- La ficha no tiene el gráfico de ingresos (ver arriba): sus cifras van sin gráfico.
- Los títulos de las tarjetas del Overview y los textos que no son nombres de sección están en español; los nombres de las
  secciones y subpáginas, en inglés como en Polar.

## Prueba

PENDIENTE: capturas en `docs/admin/polar/` y la revisión del revisor aparte.

## Lo que le toca al Cerebro

- Comparar las capturas con `docs/admin/referencia-polar/` antes de avisarle a Martín.
- Las decisiones de «no está en la fuente».
- No hay migración nueva.
