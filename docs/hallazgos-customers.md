# Hallazgos — Admin (/admin, el super admin; era Customers, /customers)

Lo que no se ve leyendo el código de Customers: la vista de los clientes de MaKo para el super admin, con Accounts (la
grilla de administración), Billing (era /admin/cobros) y Agents (era /admin/agente) adentro. Los pedidos textuales, en
[feedback-25-10-tarde.md](feedback-25-10-tarde.md) puntos 10 y 12, y el rediseño del 26/10 abajo. Las 16 referencias de
diseño, con qué se copia de cada una, en [customers/referencias/otras-apps/LEEME.md](customers/referencias/otras-apps/LEEME.md).


## Costs: a dónde va una suscripción, y los dólares que salían divididos por 100 (10/11/2026)

Martín, 10/11: «Si todavía no está dentro de SuperAdmin toda la parte de costos con gráficos bien diseñada, eso debería
estar», con la torta de un cliente de 97 y el CAC de US$97. Entró en Admin › Analytics › Costs, después de «What you keep».

- **Lo vivía en dos lugares que se copiaban.** La torta de /admin/estrategia armaba sus porciones con su propia cuenta y el
  tablero local (`docs/tableros/numeros-mako.html`) con otra, escrita a mano. Ahora las arma UNA función,
  `loQueSeVaDeUnaSuscripcion` (`lib/economia-unitaria.ts`), que usan Costs y la torta; `TORTAS` sólo les pone nombre y cuenta.
- **El ciclo que había que esquivar:** `lib/uso-del-cupo.ts` importa de `lib/economia-unitaria.ts`, y la función nueva necesita
  `techoDeIa` y `USO_SUPUESTO`, que vivían allá. Importarlos de vuelta era un ciclo (en los tests de tsx deja exports a medio
  cargar). Se mudaron a economia-unitaria y uso-del-cupo los re-exporta: nadie cambió de dónde los lee.
- ⚠️ **El diagnóstico obvio era el equivocado: Costs YA mostraba mal la plata.** `formatCurrency` de Polar recibe CENTAVOS
  (divide por 100), y «Fixed costs», «Unit economics» y «What you keep» le pasaban DÓLARES: la página decía «US$ 4,38 al mes
  sale de tu bolsillo» con un fijo de US$438,25. El gasto de IA (`vista`) sí viene en centavos, así que la mitad de la página
  estaba bien y la otra no, y nada lo marcaba. Ahora la plata en dólares va por `fmtUsd`
  (`app/admin/(polar)/analytics/costs/utils.ts`) y un test dibuja la página y busca «US$ 438,25». **Antes de pasar un número a
  un formateador copiado, mirá en qué unidad lo espera.**
- **Un negativo se partía:** «-US$ 24,37» cortaba la línea después del guion y dejaba el «-» solo arriba en una tarjeta
  angosta. `fmtUsd` usa el menos tipográfico (U+2212), que no se separa.
- **Polar no tiene un gráfico de anillo.** Su gráfico de reparto es el «Breakdown» de las cancelaciones
  (`CancellationsDistributionChart.tsx`): una barra con una franja por parte y la leyenda con el total. Se copió a
  `app/admin/_polar/web/Metrics/DistributionChart.tsx` con sus colores; una parte negativa no se dibuja en la barra (Polar
  tampoco dibuja las que dan cero) y la leyenda la muestra con su signo.
- **El `SelectValue` de Radix no pinta el texto hasta hidratar:** en el HTML del server, y en cualquier captura de la vista
  estática, el selector sale vacío. Con el texto elegido como hijo se ve siempre.
- **La animación de entrada de Polar deja la página en blanco sin JavaScript:** `DashboardBody` arranca en `opacity: 0`
  (`motion`) y recién hidratado sube a 1. Para una captura estática hay que forzar el estado final.
- **El techo del CAC se calcula con el fijo adentro** (72,31 en el 97, lo que deja desde el segundo mes), no como en el tablero
  (precio − cobrar − IA, 81,08 contando el impuesto): así el primer mes (−24,69) es exactamente el techo menos el CAC y la
  página no dice dos cosas que no cierran. Lo decide Martín (docs/relevo/nube-costs-suscripcion.md).

**Vive en:** `lib/economia-unitaria.ts`, `app/admin/(polar)/analytics/costs/Suscripcion.tsx`,
`app/admin/_polar/web/Metrics/DistributionChart.tsx`, `app/admin/(polar)/analytics/costs/utils.ts`,
`app/admin/estrategia/datos.ts`. **Lo fija:** `tests/costs-suscripcion.test.ts`. Capturas en
`docs/admin/polar/analytics-costs-suscripcion-*.jpg`.

## La copia de Polar: lo que sólo se vio en las capturas (6/11/2026)

Admin es la copia del dashboard de Polar (docs/investigacion-admin.md). Todo compilaba, los tests pasaban y cada dato estaba
bien; lo que sigue se vio recién al poner cada pantalla al lado de su captura de Polar (docs/admin/referencia-polar/), a 1440 y
a 390, en oscuro y en claro. Las capturas de cómo quedó, en docs/admin/polar/. Lo fija tests/admin-polar-pantalla.test.ts.

- **El documento entero scrolleaba.** Síntoma: la lista de negocios y la ficha se iban juntas con la rueda, y la barra de Polar
  se perdía arriba. Causa: el contenedor de Admin (`DashboardLayout`) tenía `flex-1` y un `height: 100dvh`; en una columna
  flex, `flex: 1 1 0%` decide el alto y el `height` no cuenta, así que medía lo que su contenido. Es la misma trampa que
  `Pagina` (AGENTS.md: su `flex: 1` anula el `height` de una pantalla de alto completo). Va `md:flex-none` con el alto de la
  ventana menos la barra de inspección, y `overflow-hidden`: adentro scrollea cada panel.
  **Vive en:** app/admin/_polar/web/Layout/DashboardLayout.tsx
- **Una regla de CSS sin capa le gana a todas las clases de Tailwind.** Síntoma: cada renglón de la barra de Admin tenía un
  filete gris que Polar no tiene. Causa: `.pl * { border-color: … }` estaba fuera de una capa; las utilidades de Tailwind viven
  en `@layer utilities`, y lo que no tiene capa gana siempre, así que `border-transparent` no se aplicaba. Polar la tiene en
  `@layer base`. ⚠️ Una capa con OTRO nombre tampoco sirve: la que no está en el `@layer theme, base, components, utilities`
  de Tailwind va después de `utilities` y también le gana (el test lo cubre: la primera versión sólo pedía «alguna capa» y daba
  verde con el nombre cambiado).
  **Vive en:** app/admin/_polar/polar.css
- **El `SelectTrigger` de Orbit recorta a un renglón todo `<span>` hijo directo** (`[&>span]:line-clamp-1`). Síntoma: el
  selector de fechas de Orders y Subscriptions salía vacío, con el ícono solo. Causa: ícono y rótulo iban juntos en un
  `<span className="flex">`; el `line-clamp` (más específico) le ganaba al `flex`, el ícono quedaba en el primer renglón y el
  rótulo en el segundo, recortado. Ícono y rótulo van sueltos en el botón. No da error y en el código se lee bien.
  **Vive en:** app/admin/_polar/web/Orders/DateRangeSelect.tsx
- **TanStack le da 150 px a cada columna sin `size`, y la tabla de Orbit es `table-fixed`.** Members medía 1.000 px en una
  columna de 744 y el «⋯» de cada persona quedaba del otro lado de un scroll de costado. Los anchos van en `ANCHOS_MIEMBROS`,
  que el test suma.
  **Vive en:** app/admin/_polar/web/Customer/CustomerPage/MembersSection.tsx
- **Una grilla de `1fr` no deja achicar lo que tiene un mínimo.** Customers › Overview cortaba Cost Drivers a la derecha: un
  `1fr` es `minmax(auto, 1fr)` y el ancho mínimo de una tabla empuja. Va `minmax(0, 1fr)`.
  **Vive en:** app/admin/_polar/web/Customer/CustomersOverview.tsx
- **Un formato de fecha distinto para un caso es otro ancho de celda.** El día de un pago (que no tiene hora) iba con el año
  («04 de nov de 2026») al lado de «06-nov, 14:20:00», y la celda lo cortaba. Va «04-nov», y el año está en el detalle.
  **Vive en:** app/admin/_polar/web/Events/EventLogRow.tsx
- **Sacar un filtro de un renglón de Polar deja al otro en media columna.** En Checkouts, Polar comparte el renglón del
  teléfono entre el estado y el producto; sin el producto, el estado se leía «Cualquier e:». Y en Customers los cinco rangos
  al lado del título se salían a 390: van debajo en el teléfono.
  **Vive en:** app/admin/(polar)/sales/checkouts/CheckoutsPage.tsx, app/admin/_polar/web/Customer/CustomersPageShell.tsx

**Cómo se probó, y lo que el banco no es.** La nube no ve la base de producción y el dev de Next con el layout raíz completo
pasa los 12 GB (Turbopack y webpack: los dos murieron sin memoria, y `next build` también). Las capturas salen de un banco: un
layout raíz mínimo y las lecturas de Admin cambiadas por los ejemplos de `app/admin/_polar/datos/ejemplo/`, que se pone y se
saca con un script y se verifica con `git diff --quiet` antes de commitear. ⚠️ El banco no tiene `ModoDelUsuario`, que en la app
vuelve a poner el oscuro después de un redirect: Checkout Links (que redirige a su primer link) salía en claro y NO era un bug.
Antes de arreglar lo que sólo se ve en un banco, se mira qué del layout real falta en el banco. Y en la nube `tsc-acotado`
necesita `--heap=7000`: con el tope por defecto sale sin código de salida ni errores.

**El diagnóstico obvio que era el equivocado:** el filete de la barra parecía un color mal portado, y se buscó en las clases de
los ítems; las clases estaban bien, las tapaba una regla de otro archivo. Antes de tocar las clases de un elemento que «no
toma» su estilo, se mira qué regla gana con `getComputedStyle` y la hoja de donde sale.


## Activity: MaKo no sabía qué se usaba, sólo el último ingreso (5/11/2026)

**Síntoma:** Martín pidió ver «qué acciones hacen los usuarios dentro de MaKo, cuándo se conectan, qué no están utilizando», y lo
único que había era `usuarios.ultimo_login`. Con eso se contesta «quién dejó de venir» y nada más.

**Lo que se hizo:** contadores por persona, tab y día (`actividad_uso`, mig 0398) que suma el navegador una vez por minuto
(app/_components/MedidorDeUso.tsx), y un renglón por cada operación de la API de MaKo (`actividad_acciones`, desde
`ejecutarOperacion`). Sin contenido: la ruta se vuelve tab en el server y se tira; de MaKo, el id, el canal y si salió.

**Vive en:** lib/actividad-reglas.ts (las cuentas, con test), lib/actividad-registro.ts (los escritores), lib/actividad.ts (el
lector), app/admin/actividad/ActividadAdmin.tsx, app/api/actividad/route.ts, app/api/cron/actividad-purga/route.ts.

**Lo que no se ve en el código:**
- **Una server action también pasa por el parche de `fetch`** (app/_components/WsFetch.tsx), con la URL vacía y `POST`: por
  eso el contador de acciones vive ahí y cuenta las dos cosas sin tocar ningún botón. Y cuenta ANTES del `if (!ws)`, o una
  persona sin `?ws=` en la pestaña (casi todas) no sumaría nada.
- **Dos keys del nav se dibujan con el mismo nombre** («Ops Center» es `mako` para el super admin y `second-brain` para un
  negocio). «Nadie la abrió» por key la mostraba dos veces, y como «sin uso» aunque se usara por la otra. Va junta por nombre
  (`tabsDeNegocios`).
- **«Nuevo» es por el alta de la persona**, como PostHog con su `created_at`: con el primer día medido, la semana en que se
  aplique la migración mostraría a todos como nuevos.
- **«En 30 días» sobre una medición de 3 miente**: la pantalla mira `ventanaDeUso` (30, o los días que lleva).
- **`ejecutarOperacion` se envolvió sin cambiarle la forma**: la mitad de los tests de la API leen su fuente
  (`return await runWithWorkspace(ctx.ws,`, los recortes hasta `runnerDelRegistro`). El cuerpo pasó a `correrOperacion` y el
  envoltorio sólo anota y devuelve lo mismo.
- **Un test que recorta un runner hasta el cierre del objeto crece con cada runner que se declara después**:
  tests/api-mako-vender-plan.test.ts se cayó al cargar (el recorte medía 9.503) cuando se sumaron los de Users y Errors. Ahora
  corta en el runner que sigue.

**La regla que queda:** lo que se mide de una persona se guarda como número, nunca como lo que hizo o vio, y con su retención en
un cron que cuenta lo que borra.

## Revenue: los ingresos no se veían porque todo lo cobrado entró a mano (5/11/2026)

- **Síntoma (Martín):** «en SuperAdmin… no se me refleja la cantidad de ingresos para suscripciones. ¿Cuánto es lo que me
  pagaron totalmente? ¿Cuánto me van pagando mes a mes?».
- **Lo medido en producción (por el Cerebro, docs/relevo/admin-encargo.md):**
  - el MRR de Customers salía de `cobros` (la pasarela), con 2 filas pendientes en toda la base;
  - lo que Martín cobró entró A MANO, en `pagos` del CRM de la plataforma: Leila 97, Código 146 y Florencia 97 en octubre;
  - `suscripcion_monto_usd` de esos tres leads está vacío, así que `getMrrActivo` tampoco sumaba.
- **El diagnóstico obvio era el equivocado:** «falta cargar el monto mensual en el lead». Eso deja el número dependiendo de un
  campo que nadie llena. Las apps de referencia (ChartMogul, Baremetrics, Lago) sacan el MRR de lo FACTURADO; acá lo facturado
  es lo cobrado a mano. Con los pagos alcanza, y el lead puede seguir vacío.
- **Las reglas que quedan** (lib/admin-ingresos-reglas.ts, con test):
  - es recurrente un pago registrado como la mensualidad (`es_mensualidad`), la cuota del plan de una venta de suscripción, o
    la suscripción de la pasarela. El resto (suelto, diferencial, pago único) es cash y nunca MRR;
  - dos pagos de la misma suscripción a menos de 7 días son UN cobro;
  - cada cobro cubre un mes y el siguiente lo REEMPLAZA desde su fecha (sube o baja), nunca se suman;
  - 15 días de gracia (como el `past_due` de Stripe): renovar adentro de la gracia no es cortar y volver. Pasada la gracia, el
    corte se anota el día que venció. ⚠️ Por eso el MRR de un mes ya cerrado puede cambiar cuando se confirma un corte (igual
    que ChartMogul, que recalcula desde las facturas);
  - los movimientos son por CLIENTE, no por suscripción: un segundo lugar de una agencia es «subió», no «nuevo»;
  - un pago sin `monto_usd` no se convierte: no suma y se cuenta aparte.
- **No se cuenta dos veces lo de la pasarela:** el cobro de un lead lo asienta `registrarCobroDeProveedor` como un pago con su
  `cobro_id`. El lector suma los `cobros` pagados SÓLO si ningún pago los nombra (un lugar de agencia, un alta sin lead).
- **Customers, el teléfono y la API usan el MISMO MRR** (`vistaDeClientes` lo toma de Revenue). Con dos fuentes, una pestaña
  decía US$432 y la otra «todavía no entró plata».
- **Lo de noviembre de Código (US$238, 94 el 4/11 y 144 el 5/11) no está cargado** en el CRM: la pantalla lo va a mostrar cuando
  se carguen como dos pagos «Mensualidad». Lo dice docs/relevo/nube-admin.md.

**Vive en:** `lib/admin-ingresos-reglas.ts` · `lib/admin-ingresos.ts` · `app/admin/ingresos/IngresosAdmin.tsx` ·
`app/admin/ingresos/ingresos-vista.ts` · `app/admin/page.tsx` · `tests/admin-ingresos.test.ts`.

## Users y Errors: lo que ya estaba en la base, a la vista (5/11/2026)

- **Users** son las filas de `usuarios` de todos los negocios. El estado de alta se DERIVA (`estadoDeAlta`), no es la columna:
  `estado` sólo distingue suspendido; «invitado» y «activo» salen de `ultimo_login`, que marca cada pantalla
  (lib/ultimo-uso.ts). Reactivar a quien nunca entró lo devuelve a `invitado`, no a `activo`.
- **El perfil de la persona no viaja al navegador:** la página arma una fila con lo que la tabla dibuja. `listarUsuarios` trae
  `perfil` (teléfono, bio, preferencias) y con un spread se iba entero.
- **Errors no inventa una tendencia:** `errores_app` guarda el total, la primera y la última vez. La mini-curva de Sentry y
  GlitchTip necesita las veces por día, y no están.
- **«Volvió» tiene que ser la regla del registrador**, o la pantalla diría «resuelto» de algo que ya tiene un ticket nuevo.
- **Seis pestañas como tope:** con Users y Errors eran siete. Customers y Accounts son dos vistas de los negocios: el selector
  de vista, y `?tab=accounts` se queda (lo nombran los mails de «Quieren entrar»).
- **Suspender no va por la API**, a propósito: apaga los tokens de la persona, y un token filtrado no puede dejar sin acceso a
  nadie. Se lee por chat; se suspende en la pantalla.

**Vive en:** `lib/admin-usuarios-reglas.ts` · `app/admin/usuarios/UsuariosAdmin.tsx` · `lib/admin-errores-reglas.ts` ·
`lib/admin-errores.ts` · `app/admin/errores/ErroresAdmin.tsx` · `tests/admin-usuarios-errores.test.ts`.

## La tab se llama Admin y vive en /admin (5/11/2026)

- `/admin` era un redirect a `/customers` desde el 25/10. Desde hoy ES la tab. Sus subrutas (`/admin/dev`, `/admin/ui`,
  `/admin/docs`, `/admin/operaciones`…) siguen siendo otras tabs, así que el `match` de la barra es `/admin` EXACTO.
- `/customers?tab=…` redirige con su `?tab=`, `?cuenta=` y `?cliente=` (`destinoDeCustomers`). Sin `?tab=` va a Customers (lo
  que abría antes) y no a Revenue: un marcador viejo tiene que abrir lo mismo.
- **La key `admin-customers` no cambió:** la nombran las capas, el teléfono y la API.
- Un test que fijaba «la salida nunca es /admin» (tests/agencia-cartera.test.ts) cuidaba otra cosa: que una AGENCIA no caiga en
  una ruta que el gate le niega. Se reescribió para que lea `SOLO_ADMIN` del proxy y lo pregunte por la agencia. El super admin
  sí puede caer en /admin.
- `scripts/tsc-acotado.mjs` sale «código undefined» en la nube con varios archivos (lo mismo que dice
  docs/relevo/nube-metodologia.md con Node 22, pero acá con Node 24). Corriendo `tsc -p` con su mismo tsconfig da el resultado
  real: así se encontró un `ingresos` declarado dos veces en `vistaDeClientes`.


## «Quieren entrar»: quien pedía entrar desaparecía en silencio (30/10/2026)

- **Síntoma (Martín):** «Me llegó una solicitud de ingreso de Gabriela González por la landing, eso como en agencia debería aparecerme en super admin para aceptarla».
- **Lo medido:** no había ninguna solicitud en la base ni en los mails de Resend. Su ficha del CRM era del 13/10 y lo único de ese día era su WhatsApp («Avísame cuando autorices el correo para entrar»). Lo más probable, sin confirmar: intentó entrar, vio «no autorizada» y le escribió a Martín, porque lo tenía a mano.
- **La causa:** `app/api/auth/callback/google/route.ts` contestaba `no-autorizado` y no dejaba registro ni aviso. **El diagnóstico obvio («es como lo de agencia») era el equivocado:** `AprobacionesDeAgencia` sólo lista lo que pide una agencia; una persona directa no tenía ningún camino. Y aprobar una cuenta de agencia SÍ tiene pantalla.
- **La regla que queda:**
  - La bandeja se llena con el correo que Google CONFIRMÓ (`email_verified === true`, no «distinto de false»). La contraseña y el link por correo no entran: cualquiera llenaría la bandeja con correos ajenos.
  - Los pedidos de /planes entran con el rótulo «Correo sin verificar»: los escribió la persona.
  - No hay estado «aceptado»: la bandeja no muestra a quien ya tiene usuario, así que darle de alta por cualquier camino la saca sola. Un suspendido tampoco es un pedido: cae en el mismo «no autorizado» y no tiene que pedir entrar.
  - La pantalla promete sólo si quedó registrado (`pedido-registrado`); si no, dice lo de siempre.
- **«0 pedidos» no se prueba con un pedido en el negocio de prueba:** `/api/planes/comprar` escribe SIEMPRE en el negocio de la plataforma, aunque se esté mirando otro. Probarlo en producción deja un lead y un mail reales. El pedido entero corre con el código real sobre una base de mentira en `tests/_pedidos-ingreso-hijo.ts`.

- **`/admin` no es donde están las cosas.** Redirige a `/customers`, que abre en la pestaña Customers; «Nuevo cliente» y `AprobacionesDeAgencia` están en Accounts. Los pedidos de las agencias quedaban a una pestaña de distancia y sin nada que avisara. Por eso el cartel arriba de las pestañas, con los dos conteos.
- **Lo que confirmó Martín el 30/10:** Gabriela le escribió directo por WhatsApp, no hubo ningún aviso perdido. Pero antes de la bandeja, «nadie se anotó» no se podía distinguir de «intentaron y rebotaron».

**Sin hacer:**
- En el teléfono se ve y no se decide: no hay alta ni «Descartar» en `/m/customers`. Vive en `app/m/customers/page.tsx`.
- Quien intenta con contraseña sin tener cuenta sigue sin dejar rastro, a propósito (el correo no está confirmado).

**Vive en:** `lib/pedidos-ingreso.ts` · `lib/pedidos-ingreso-reglas.ts` · `app/admin/PedidosDeIngreso.tsx` · `app/api/admin/pedidos-ingreso/route.ts` · `tests/pedidos-ingreso.test.ts`.

## El MRR NO es el precio del plan (25/10/2026)

- Lo obvio era sumar el precio de cada plan (Esencial 47, Pro 97) y daba un número inflado. Mauricio (ws 1), Leila y
  otros tienen el plan **dado a mano**: no hay cobro, MaKo no les factura nada. El MRR que se ve sale de los **cobros
  reales de la plataforma**: suscripciones con `suscripcion_estado = 'activa'`, en dólares (`monto_usd`), sin las pruebas
  gratis (Stripe no cuenta un trial) y sin lo anulado o devuelto. Una en mora sigue contando, porque la pasarela reintenta.
- **Un cobro sin `monto_usd` no se convierte con una tasa inventada:** cuenta como «sin dólares» y la pantalla lo dice.
  Es la misma regla que en lo demás de cobros (docs/hallazgos-planes-y-cobro.md, «La moneda depende de la PASARELA»).
- **El lugar de un cliente de agencia SÍ es MRR**: lo paga su agencia (o él) a MaKo. Por eso suma en el MRR aunque no
  cuente en «Clientes activos».
- **Vive en:** `lib/clientes-plataforma-reglas.ts` (puro, testeado) y `lib/clientes-plataforma.ts`.

## El rediseño: sin plata, el dato que manda es la actividad (26/10/2026)

- **Síntoma:** Martín, al ver la primera versión: «no me gusta para nada como esta ahora». Arriba había cuatro tarjetas
  iguales, una en «US$ 0», los grupos repetidos dos veces y, abajo, la grilla vieja con su barra de filtros.
- **Lo que se midió antes de diseñar (producción, lectura):** la plataforma no tiene ni un cobro ni una cuota en `pagos`, y
  `agente_sesiones` está vacía. Todo lo de plata daba cero y lo iba a seguir dando. Lo que SÍ hay y dice quién se está
  yendo: `usuarios.ultimo_login`, la fecha del onboarding terminado y los leads de cada negocio con el último.
- **Lo que quedó (copiado de cuatro capturas, no de cuatro apps):**
  - arriba a la izquierda, lo que entra por mes (la 02 de ProfitWell). Sin plata, una línea que lo dice y «Vender un plan →»;
  - arriba a la derecha, «Para mirar»: un renglón por cliente con una etiqueta de color, el más grave primero (`paraMirar`);
  - los grupos en chips con el número adentro y la tabla con el estado en una palabra (la 04 de Baremetrics);
  - la ficha en un panel lateral, con tres datos en fila y una sola acción, «Entrar a su cuenta» (la 14 de Polar).
- **«Sin uso» exige el onboarding hecho:** uno recién dado de alta que todavía no entró está empezando, no yéndose. Eso lo
  dice «Sin empezar», y sólo después de `DIAS_SIN_EMPEZAR` días.
- **Un dato que no se pudo leer no se dibuja en cero:** cada lectura falla sola (`conAviso`). Sin la actividad, «sin uso» no
  se afirma de nadie (`actividadLeida`), y arriba se dice qué faltó.
- **La grilla de administración (AdminView) pasó a la pestaña Accounts,** sin filtros nuevos. «Administrar» en la ficha
  lleva a `?tab=accounts&cuenta=<ws>`, que abre su ficha (`abrirInicial`). ⚠️ Es `?cuenta=` y no `?ws=`, porque `?ws=` hace
  mirar a ese cliente.

## La barra del super admin (26/10/2026)

- `noEnPlataforma` (nav.ts, lib/nav-visibilidad.ts) saca «MaKo Partners» y «Agency Dashboard» de SU barra y de su More, y
  los negocios los siguen viendo. Lo de esos programas que él mira está en Customers (los chips Partners y Agencies).
- **La trampa del teléfono:** una fila de More `superAdmin` va siempre oculta, y `masCompleto` se salteaba toda tab que
  tuviera fila en `SECCIONES_MAS`. Customers, que es una tab de la familia Sales, desaparecía del More del super admin.
  Ahora esas filas no la frenan, y la tab se dibuja con `filaDeItem`, que la lleva a /m/customers por `rutaMovil`.

## Billing y Agents: las rutas viejas quedan como redirect, con su guard (25/10/2026)

- `/admin/cobros` y `/admin/agente` redirigen a `/customers?tab=billing` y `?tab=agents`. Antes del redirect preguntan
  `getSesionAdmin`: un redirect no se le ofrece a cualquiera. El contenido vive en `Contenido.tsx` de cada carpeta.
- **Sus entradas de `HERRAMIENTAS` (nav.ts) quedan**, aunque salieron del menú de la foto: el teléfono abre `/m/cobros` y
  `/m/agente` por su key (`lib/movil-rutas.ts`). Si se borran, el teléfono las pierde sin dar error.
- `/customers` está también en `SOLO_ADMIN` del proxy: dos cerrojos, y además el de cada action.

## La revisión adversarial del tren: siete fallas en b26a8ac40 (26/10/2026)

Todas venían de lo mismo: **el rediseño pasó a depender de la actividad, y la actividad tenía huecos que la plata no
tenía.** Lo que queda para código nuevo:

- **«Sin uso» mentía con equipos que trabajan todos los días.** `ultimo_login` sólo lo escribía el login y la sesión dura
  30 días: entre el día 14 y el 30, un equipo activo salía «En riesgo». Ahora lo marca cada pantalla (lib/ultimo-uso.ts;
  el detalle, en [hallazgos-seguridad.md](hallazgos-seguridad.md)).
- **Un «no pude leer» no es «no lo terminó».** `hechos?.has(w.id) ?? false` convertía una lectura fallida en «Sin
  empezar» para todos y llenaba «Para mirar». Ahora `onboardingHecho` es `boolean | null`, y `null` no dispara «Sin
  empezar», ni «Sin uso», ni «Para mirar». La ficha dice «—» y la nota de la API lo explica. **Regla:** en las reglas de
  Customers un dato leído se compara con `=== true` o `=== false`, nunca con `!`: el `!` le da a `null` un valor.
- **Los clientes de una agencia salían «Sin uso: nadie entró nunca».** El diagnóstico obvio era que nadie los usaba. Lo
  que pasa es que la agencia entra con SU sesión (/api/agencia/entrar) y esa entrada no queda en ninguna fila del
  cliente. Nunca están en riesgo por falta de uso (`!deAgencia.has(w.id)`), y si su equipo no entró nunca, su «Última
  vez» dice «Lo opera su agencia» (`ultimaVezTxt`, la misma en la tabla, la ficha y el teléfono).
- **La flecha del MRR comparaba el mes en curso con el anterior completo**, y quedaba pegada al MRR: todos los principios
  de mes marcaba «↓ 80%». Ahora compara sólo los dos últimos meses CERRADOS (`comparacionCerrada`) y va en su propia
  línea, con los dos meses nombrados: «Cobrado en sep: ↑ 20% contra ago».
- **Cuatro lecturas con `.limit(5000)` cortaban en 1000** sin avisar y sin orden: usuarios, agente_sesiones, pagos y
  partner_codigos. Ahora van por `leerPorPaginas` o `leerTodo` (lib/supabase-paginado.ts), ordenadas por una columna única.
- **Entrar a la cuenta de un cliente desde el teléfono** va con recarga entera, no con un Link
  ([hallazgos-mobile.md](hallazgos-mobile.md)). **La API** pide el super admin global en la app, no el admin del
  workspace de la plataforma ([hallazgos-api-mako.md](hallazgos-api-mako.md)).

**Vive en:** lib/clientes-plataforma-reglas.ts (`ultimaVezTxt`, `comparacionCerrada`) · lib/clientes-plataforma.ts ·
lib/ultimo-uso.ts · app/customers/CustomersApp.tsx · app/m/customers/CustomersM.tsx · lib/api-mako/areas/cobros.run.ts ·
tests/customers.test.ts (el último test: 11 roturas, cada una da 1 fallo).

## Lo que quedó SIN hacer

- **El MRR mes a mes de verdad:** lo que se dibuja es lo COBRADO por mes (las cuotas pagadas de la plataforma). El MRR
  histórico necesita una foto por día que nadie guarda todavía.
- **Las fichas de agencia con sus clientes adentro** (la 11 de HighLevel): hoy la agencia y sus clientes son filas sueltas
  en sus chips.
- **Administrar desde el teléfono** (cambiar el plan, el equipo): queda en la computadora.
- **Sin paginar, porque crecen con los negocios y no con el uso:** `onboardingsHechos` (un `.in(ids)` de app_settings) y
  `leadsDe` (una consulta por negocio). Con más de 1000 negocios, la primera corta en silencio: ahí van por
  `leerPorPaginas` (lib/clientes-plataforma.ts).
- **Activity no dibuja todavía el uso de cada negocio en su ficha de Customers**: `vistaDeActividad` ya lo tiene por negocio.
- **Lo que hace una agencia dentro de su cliente no se anota en ningún lado.** Por eso un cliente de agencia nunca entra en
  «Sin uso»: para saber si la agencia lo dejó, hay que marcar su entrada (/api/agencia/entrar) en la fila del cliente.

## Revisión de la copia de Polar antes de que la viera Martín (6/11/2026)

La revisó el Cerebro sobre el commit 34c42de99: 55 hallazgos en pie después de refutarlos, 43 arreglos en `docs/admin/revision-cerebro-6-11.md`. Lo que no era obvio:

- Bordes de Admin todos grises, puntito de estado igual para Activa, Atrasada y Cortada. Parece un error de cada componente y no lo es: `.pl * { border-color }` en app/admin/_polar/polar.css:150 está sin capa, y en Tailwind 4 una regla sin capa le gana siempre a `@layer utilities`. Polar la tiene en `@layer base`. Regla: al portar CSS, un selector universal va adentro de `@layer base`. app/video-editor/capcut-theme.css:185 tiene el mismo patrón.
- Metrics dice «oct» en noviembre y «El mes pasado» muestra este mes. Parece un dato mal cargado, pero la causa es la zona: el server (Vercel en UTC, vercel.json no fija TZ) arma `new Date(y, m-1, 1)` en app/admin/_polar/datos/metricas.ts:83 y el navegador lo recorta en hora de Argentina. En local no se ve. Regla: entre server y navegador, mes y día viajan como texto. Un test que crea y recorta en la misma zona no puede fallar (tests/admin-polar-analytics.test.ts:131): hay que correrlo con TZ distinta y timestamps UTC.
- `cobro_id` no identifica un pago. Las renovaciones comparten cobro, hay un recibo por pago (clave `pago:<medio>:<id>`) y `proveedor_pago_id` del cobro es sólo el primer pago (lib/cobros.ts:795). Síntomas: Orders suma 1.485 en vez de 891 (app/admin/_polar/datos/ventas.ts:236-243) y «Devolver» en noviembre devuelve septiembre (lib/cobros.ts:1800). Regla: pago y recibo se atan por medio y referencia, y una acción de plata se valida contra el pago. Un fixture con un recibo por cobro no lo puede ver.
- El 404 después de devolver no es una falla de la devolución: sale bien, pero `vistaDeIngresos` sólo lee `pagado:true` y `estado:'pagado'` (lib/admin-ingresos.ts:83,118), el id desaparece y `notFound()` corre en el refresh. Bajo app/ no hay ningún not-found.tsx, así que cae al 404 raíz sin el layout de Admin. Regla: el detalle por id no puede depender de una lista de lo vivo si una acción de esa misma pantalla saca la fila.
- Recibos a mano y `pagos`: la clave `mensualidad:` no dice dónde vive la plata. Código la usa (scripts/recibos-cargar-codigo.mts:57,68) y sus pagos están en `pagos`; el flujo de agencias (`aplicarPagoDeAgencia`, lib/agencia-mes.ts:383) sólo escribe en settings. Un recibo puede juntar varios pagos (noviembre de Código: 94 + 144), así que la unión va en `recibo_pagos.pago_id`, no en `recibos`. Regla: no clasificar un recibo por el prefijo de su clave para decidir si suma.
- Cost Drivers vacío: el diagnóstico obvio, una columna nueva `ws_origen`, es el equivocado. Desde el 17/10 `wsDeLaFila` (lib/anthropic-usage.ts:53-65) manda a la plataforma el Claude con la clave de MaKo, así que lo anotado en cada negocio ya es medido. Lo que apaga todo es `atribuible` (lib/costos-ia.ts:146-147,166), que vale para el mes entero con una sola fila, y cada veto escribe una con proveedor 'anthropic' por defecto (lib/anthropic.ts:63). La cabecera de lib/costos-ia.ts:19-25 («~99%») es vieja: no fiarse de ella.
- Regla para tarjetas con «Ver todo»: la tarjeta y su página salen de la misma función y del mismo rango. Se rompió tres veces en Overview: `filasDeRiesgo` frente a `clientesEnRiesgo` (app/admin/_polar/datos/resumen.ts:208, clientes.ts:298), `useState('30d')` en Top Customers frente a «del total cobrado», y el filtro `active` copiado de Polar frente a Por cobrar. Copiar un default sin mirar quién enlaza a esa página crea el salto. Polar enlaza su tarjeta a otra página.
- `clientesEnRiesgo` (app/admin/_polar/datos/clientes.ts:298) tiene dos entradas: filtrar `filas` con `esClienteDeMaKo` antes de llamarla no saca a un cliente de agencia atrasado, porque ese entra por `ingresos`. El filtro va adentro de los dos bucles.
- Un moroso sale de Por cobrar a los 15 días sin haber pagado. No es un pago perdido: `tramosDe` pone `t.fin` por la gracia (lib/admin-ingresos-reglas.ts:169) y `porCobrarDe` descarta antes de mirar la historia (:432). La gracia contesta si cuenta en el MRR, no si debe plata: son dos preguntas. Sin tope, quien se fue sin corte guardado queda para siempre, porque `deudaUsd` suma todos los meses (lib/suscripcion-meses.ts:443).
- Un costo 0 no significa que no costó: `costoDe` (lib/costos-ia.ts:81-89) da 0 a lo gratis, a la clave del negocio y al crédito de los planes Max, que cuestan US$ 200 por mes cada uno (lib/veto-claude.ts:47-49). Regla: un margen armado con esa cuenta se rotula como margen sobre IA, no como margen bruto.
- `guardarEmisor` pisa el emisor entero (lib/recibos.ts:803-806). Con una acción sin `revalidatePath` y `prefetch={true}` en la barra, una pantalla abierta con una copia vieja borra lo escrito en otra, sin error. Regla: los formularios que comparten un mismo JSON mandan sólo lo que tocaron y el server mezcla. Deducido del código, no comprobado corriendo la app.
- `prefetch={true}` copiado de Polar cuesta distinto en MaKo: allá las páginas piden sus datos desde el navegador; acá cada precarga es un server component que lee todos los negocios (app/admin/_polar/web/Layout/Dashboard/NavList.tsx:77,129). Sacarlo solo empeora la navegación: va junto con los loading.tsx. Regla: al portar un atributo de Next, mirar primero de dónde salen los datos.
- Disputas de Mercado Pago: todo texto da `en_revision`, incluso ya resuelto (app/admin/_polar/datos/ventas.ts:741; lib/cobros-reglas.ts, caso 'mp'). Un aviso basado en ese estado nunca se apaga: contar sólo el texto de `in_process`. Mercado Pago y Creem además pasan `plataAfuera: null` (lib/cobros-webhook.ts:464-466,601-603), así que Ingresos sólo baja con un contracargo de Stripe.
- `aviso.enviado === false` no es siempre una falla: también significa «no hay nadie adentro» (lib/aviso-plan.ts:49-51). El helper correcto ya existe y nadie lo llama: `avisoCambioPlan` (lib/plan-aviso.ts:31). Buscarlo antes de escribir otra condición.
- Suspender a una persona no es reversible del todo: revocar escribe '' en el token (lib/agente-token-nucleo.ts:246-256) y la rama `activo` de app/api/admin/usuarios/route.ts no lo devuelve. Cualquier pantalla que suspenda necesita confirmación con esa consecuencia.
- Después de `router.push`, un layout compartido con la página de destino no se vuelve a leer. Por eso la lista de negocios (leída en app/admin/(polar)/customers/layout.tsx) sigue mostrando un negocio borrado. Regla: tras borrar algo que lee un layout, push y después refresh. No es una falla del borrado (lib/eliminar-workspace.ts:116 borra de verdad). Deducido del código.
- Entorno: `gh` no está instalado en esta máquina y el commit de Polar `72aa1109` no resuelve en la API de GitHub, así que el código original sólo se pudo leer de `main`. Al comparar con Polar, anotar de qué rama salió.

