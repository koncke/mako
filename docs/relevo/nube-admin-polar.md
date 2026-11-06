# Relevo — Admin es la copia del dashboard de Polar (nube, 6/11/2026)

> Lo empezó la sesión de la nube `cli_52beedef-99d8-5d17-8f21-3a599afd3cce` y lo terminó la `cli_a2afc90c-6245-54ef-9c4f-239cdad34edb`
> (cuenta `nube`), en la punta `punta/admin-polar`. Reemplaza a [nube-admin-copia.md](nube-admin-copia.md) (Studio Admin,
> rechazada). La fuente y por qué, en [docs/investigacion-admin.md](../investigacion-admin.md). El pedido de Martín, textual, en
> la bitácora del área (app/admin/dev/admin/bitacora.ts). La revisión del Cerebro, con sus 43 arreglos, en
> [docs/admin/revision-cerebro-6-11.md](../admin/revision-cerebro-6-11.md): están todos hechos (abajo, qué cambió de cada uno).

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
modo oscuro son los de la barra de MaKo, que es UNA y en /admin se pliega sola, como en el Ops Center. Settings reemplaza la
barra por la suya, con «← Settings», como Polar. Cada página tiene su pantalla de carga (`loading.tsx` con `CargandoMako`).

| Sección | Qué es en MaKo | De dónde sale |
|---|---|---|
| **Overview** (`/admin`) | Seis tarjetas como Polar: Revenue (5 meses) · Activity (las acciones de hoy; «Ver todo» abre Events en hoy) · **Por cobrar** (los próximos cobros; con atrasos, «Ver todo» abre Subscriptions en atrasadas) / Top Customers (desde siempre, como su página) · At Risk (la MISMA cuenta que Customers › At Risk) · **AI margin** (lo cobrado menos la IA por API; no es el margen bruto). Abajo, «Metrics» con sus rangos y «Customize». Arriba, lo que espera a Martín en una lista de una fila por cosa: un contracargo primero, quieren entrar (con «Dar de alta»), agencias y bajas de cuenta | `vistaDeIngresos`, `vistaDeActividad`, `vistaDeAtRisk`, `gastoPorDia`, `disputasDe`, `pedidosPendientes`, `pendientesDeAprobar`, `bajasPendientes` |
| **Customers** | Un customer es un NEGOCIO. Maestro y detalle como Polar: la lista a la izquierda (buscar, filtrar —Todos, Activos, Pausados y **De agencias**—, ordenar, exportar, «+» para dar de alta; cada renglón dice su plan y si está pausado, y **clic derecho**: Ver ficha, Entrar a su cuenta, Administrar) y a la derecha Overview (crecimiento de negocios, no de ingresos), Top Customers, At Risk (con **«Para mirar»** abajo: pago pendiente, fin de los meses gratis, sin empezar, en prueba, nuevo) y Cost Drivers (el gasto de IA por negocio, con el **rango de Polar**; desde el 1/11/2026 se reparte, y Claude con la clave de MaKo va en una línea aparte) | `vistaDeClientes`, `vistaDeIngresos`, `resumenEntre` |
| **La ficha de un negocio** (`/admin/customers/<ws>`) | Debajo del nombre, el plan y cómo está en palabras («MaKo Pro · Atrasado 4 días»). Overview: sus cifras (lo pagado, lo que paga por mes —su mensualidad—, los pagos), su Timeline, Details (con Activity: último ingreso, leads, sesiones del agente), Onboarding (con **cómo llegó**: Llegó por, Quería resolver, A corregir en su oferta, Primer mes), Integrations (y sus computadoras, sólo con segundo factor, con **«Desconectar»**), y sus suscripciones (con Próxima y Debe) y pedidos. Usage: dónde y cuánto lo usa, con su rango a la vista. **Events: como en Polar, lleva a Analytics › Events filtrado por el negocio.** Members: las personas del negocio (agregar, editar, mudar de negocio, reenviar el acceso, suspender y eliminar, con confirmación). «Editar» avisa si el mail del cambio de plan no salió | `cliente-server.ts` sobre las mismas lecturas |
| **Analytics** | Metrics: MRR, ingresos, pedidos, suscripciones nuevas/activas/cortadas, ticket y promedio por cliente, mes a mes, en los grupos de Polar (Revenue, Orders, Subscriptions, Cancellations, Unit Economics); los meses viajan como texto y la fecha se arma en el navegador (en producción noviembre salía como «oct»). Events: TODO lo que pasa (el alta de cada negocio, sus pagos y devoluciones, lo que paga por mes, lo que hizo MaKo, lo que leyó MaKo aparte, los errores y reportes, las sesiones del agente), con el histograma, los filtros y el detalle. Costs: lo cobrado del mes y el AI margin arriba, y el gasto de IA (Overview, Breakdown, Changes, LLM By Model y By Vendor) | `vistaDeIngresos`, `actividad_acciones`, `vistaDeErrores`, `leerSesionesAgente`, `resumenDelPeriodo` |
| **Sales** | Orders: cada pago con SU recibo (atado por pago, no por cobro), bajar, reenviar, anular y devolver (sólo el primer pago de un cobro; una renovación se devuelve desde la pasarela); un pago devuelto queda como pedido devuelto. «Cargar pago» registra el pago en el CRM del cliente o lo ata a uno sin recibo (mig 0408). Subscriptions: las del CRM y las de la pasarela, con Por mes y Debe; «Activa» incluye las atrasadas, primero. Checkouts: los cobros de pasarela sin pagar (no los de «Vender un plan»). Disputes: los contracargos | `vistaDeIngresos`, `recibosAction`, `suscripcionesDeLaPlataforma`, `cobrosDeMakoAction`, las acciones de `app/admin/cobros/` |
| **Products** | Catalogue: los planes (`planesMako()`), con su ficha; «Vender» abre el formulario de un link nuevo con el plan. Checkout Links: los links de «Vender un plan», con su formulario y «Anular el link» | `planesMako`, `venderPlanAction`, `anularCobroMakoAction` |
| **Finance** | Income (se abre directo): el libro de lo que entró, de los mismos pedidos que Orders, con Bruto, Devuelto y Neto, lo de este mes y «Exportar»; cada fila abre su pedido | `vistaOrders` |
| **Settings** | General (los datos del emisor del recibo y «Ver ejemplo» del PDF), **Members** (el equipo de MaKo, los admins y las personas sin negocio: lo que antes era Users), Payments (los precios de cobro en la moneda de la pasarela y el del cliente de agencia, con «Guardado») y Customer Notifications (el correo y el WhatsApp del recibo). Lo que se escribe se guarda aunque se salga antes de un segundo, y cada pantalla manda sólo lo que cambió | `leerEmisor`, `leerMiembrosDePlataforma`, `cobros/actions.ts`, `leerWaSolo` |

**Búsqueda ⌘K** (`OmniSearch` de Polar): negocios y personas; una persona de un negocio lleva a su Members, una de MaKo a
Settings › Members. Si no se pudo leer, dice «No pude leer los negocios», nunca «sin resultados».

**Los links viejos** (`/admin?tab=revenue|users|customers|accounts|billing|activity|agents|errors`, `/customers`,
`/admin/cobros`, `/admin/agente`) redirigen a su sección nueva (`destinoDeTabViejo`, `app/admin/_polar/datos/resumen.ts`).
`?tab=accounts` (los mails de «Quieren entrar») va a Overview; con un negocio (`cuenta` o `ws`), a su ficha. `?tab=users`, a
Settings › Members. Las páginas que redirigen lo repiten en el layout, antes del loader (`app/admin/(polar)/layout-reglas.ts`).

## Qué se borró

`app/admin/_studio`, las pantallas de Revenue, Users, Activity, Errors, Billing y Customers (también `app/admin/clientes`), la
barra de pestañas, `docs/admin/copia`, `lib/avisos/LICENSE-STUDIO-ADMIN` y `web/Orders/Aviso.tsx` (todos los avisos son el
`Alert` de Orbit). Se quedan las lecturas de servidor y sus tests, las operaciones de la API de MaKo, los recibos, las acciones de
`app/admin/cobros/`, `app/admin/ingresos/ingresos-vista.ts` (la usa el teléfono) y las otras rutas de super admin. El teléfono
(`/m/customers`) no se tocó, salvo su texto «Se aceptan en la computadora: Admin › Overview».

## Lo que Polar tiene y se sacó (MaKo no lo puede llenar)

- **Barra y cuenta:** Payouts, Taxes, Benefits, Meters, Discounts y Account; el selector y el avatar de la organización; el
  aviso de sandbox, «Introducing Polar Plans», Support y Documentation.
- **Overview:** el saldo y los retiros (va «Por cobrar»); los rangos 30d y Today (MaKo mide por mes); los tableros propios de
  Polar (no hay dónde guardarlos); la acción rápida «Payouts» y «Create Product».
- **Customers y la ficha:** External ID, metadata, el email y el nombre de facturación de cada fila (las personas viven en
  Members), Billing (saldo, Tax ID, país), «Add Credits», los asientos, los beneficios y su tabla, el selector de medidores, la
  tabla «Recent Payments» (en MaKo un pago ES un pedido) y **el gráfico de ingresos de la ficha** (regla de Martín: el gráfico de
  ingresos sólo en Overview y Metrics, nunca en Customers).
- **Analytics:** el intervalo (MaKo mide por mes) y el filtro por producto; las métricas sin dato (net revenue, checkouts y su
  conversión, MRR committed y de prueba, renovaciones, cancelaciones por motivo, churn rate, LTV); en Events los filtros de
  origen, costo, IA y metadatos, la columna Tokens, Parent/Children/LLM y abrir por UUID; en Costs Anomalies, clientes por
  modelo, costo por usuario y cashflow, la página de un span, y «By Customer» (vive en Customers › Cost Drivers). «Share Chart».
- **Sales:** en Disputes la fecha de apertura, el plazo y responder; en el pedido el descuento, el neto y el saldo; en
  Subscriptions los cambios de plan, las pruebas, los asientos y los cupones.
- **Products:** crear, editar, duplicar, archivar y borrar planes (viven en el setting `planes.mako`), las versiones, «Integrate
  Checkout», los precios por uso o asiento, la pestaña Metrics; en el formulario del link las URLs de éxito y vuelta, descuentos,
  dirección, asientos, prueba, metadata y Embed.
- **Finance:** Fees, Tax y Status (Income dice Bruto, Devuelto y Neto), las comisiones, el tipo de cambio, la hora y la zona del
  export.
- **Settings:** Identifiers, logo, país, web, redes, borrar la organización y las secciones que MaKo no llena.
- **Los toasts:** Admin no tiene Toaster; el resultado de cada acción se dice en la misma pantalla.

## Lo que MaKo necesita y Polar no tiene: cómo quedó

Lo decidió el Cerebro el 6/11/2026:

- **Hecho:** el clic derecho en la lista; cómo llegó cada cliente y su primer mes en la ficha; «Desconectar» una computadora; los
  clientes de agencia como filtro de la lista («De agencias»); el rango de Polar en Cost Drivers; «Para mirar» en At Risk; «Ver
  ejemplo» del PDF del recibo en Settings › General.
- **Quedan como están:** la actividad de toda la plataforma y los errores agrupados viven en Analytics › Events y en la API de
  MaKo (no hay pantalla aparte); el alta desde la lista lleva el plan y el resto por defecto; los campos de «Vender un plan» que
  Polar no tiene; «Cargar pago», la historia mes a mes de una suscripción y «Darle el plan a su cuenta»; la lista de lo que espera
  a Martín en Overview; lo elegido en «Customize» se guarda en el navegador.
- **Un recibo cargado a mano y el pago del CRM ya no son dos pedidos:** se atan por `recibo_pagos.pago_id` (mig 0408): «Cargar
  pago» registra el pago en el CRM del cliente o lo ata a uno sin recibo; un recibo a mano sin atar no suma en Ingresos ni en
  Events, y Orders lo dice debajo de las cajas.
- **Sin decidir (encontrado por el revisor aparte):** la pestaña «Tablero» de la ficha vieja (las tareas y proyectos del super
  admin de ese cliente, pedido de Martín del 28/09) no volvió: Polar no la tiene y no estaba en la lista. Decide Martín.

## Diferencias con el panel real de Polar (docs/admin/referencia-polar)

- El orden de la barra es el de Martín, no el de Polar (Products va quinto), y Settings suma Members con las personas de MaKo.
- La ficha no tiene el gráfico de ingresos: sus cifras van sin gráfico.
- Sales › Subscriptions: el filtro «Activa» incluye las atrasadas (past_due), primero; en Polar, Active no las incluye. Esta
  pantalla tiene que contestar quién debe.
- La tarjeta de margen se llama «AI margin»: resta sólo la IA por API (no los planes Max ni la infraestructura).
- Los nombres de sección y subpágina están en inglés como en Polar; las frases y los rótulos de lo que mide cada gráfico, en
  español. Las tarjetas resumen de Overview y de Customers › Overview llevan a su página completa, como en Polar (Top Customers,
  At Risk y Cost Drivers se ven en la tarjeta y en su página).

## Prueba

- **Capturas** de las 22 pantallas a 1440 y 390 px, en oscuro y en claro, en [docs/admin/polar/](../admin/polar/LEEME.md), con
  datos ficticios y un banco de prueba (cómo y por qué, en su LEEME). Lo que se corrigió comparando, ahí y en
  docs/hallazgos-customers.md («La copia de Polar: lo que sólo se vio en las capturas»).
- **Tests** que ejecutan el código de cada arreglo, probados rompiéndolos: `tests/admin-polar-*.test.ts` (analytics, armazón,
  ajustes, cliente, clientes, costos-meses, overview-customers, pantalla, productos, resumen, ventas, zona),
  `tests/admin-ingresos.test.ts`, `tests/clic-derecho-listas.test.ts`, `tests/redirige-antes-del-loader.test.ts`,
  `tests/sidebar-nueva.test.ts`, `tests/ia-pc-varias.test.ts`.
- **Un revisor que no escribió el código** confirmó: un solo perfil y un solo modo oscuro; cada acción sensible sigue pidiendo
  el segundo factor (`getSesionAdmin`, `puedeOperar`); todo /admin es sólo del super admin (`exigirSuperAdmin()` antes de leer en
  cada página y layout); no queda ninguna pantalla vieja importada. Lo que encontró se arregló (los links viejos de «Quieren
  entrar», Members sin agregar ni eliminar, textos que nombraban Billing y Accounts, ⌘K mudo) o queda arriba para decidir.
- **Sin comprobar:** la escritura en la base de «Cargar pago» (necesita la 0408 aplicada); la navegación real después de
  devolver un pago y de eliminar un negocio; la barra de MaKo fija a 1280 y 1536 (el banco no la dibuja); una sesión real que no
  sea super admin.

## Lo que le toca al Cerebro

- **La migración 0408** (`supabase/migrations/0408_recibo_pagos_pago.sql`, una columna y un índice): aplicarla después de
  revisarla. El código la tolera ausente, pero hasta entonces «Cargar pago» emite el recibo sin registrar el pago en el CRM.
- **Avisarle al jefe Sidebar:** /admin pliega la barra de MaKo como el Ops Center (`pliegaLaBarra` con `SECCIONES_ADMIN`,
  exportada de `app/_components/nav.ts`; punto 37 de la revisión). No cambia las familias ni el menú.
- **Decidir con Martín** la pestaña «Tablero» de la ficha (arriba).
- Avisarle a Martín cuando Admin llegue a producción.
