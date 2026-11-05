# Hallazgos — Admin (/admin, el super admin; era Customers, /customers)

Lo que no se ve leyendo el código de Customers: la vista de los clientes de MaKo para el super admin, con Accounts (la
grilla de administración), Billing (era /admin/cobros) y Agents (era /admin/agente) adentro. Los pedidos textuales, en
[feedback-25-10-tarde.md](feedback-25-10-tarde.md) puntos 10 y 12, y el rediseño del 26/10 abajo. Las 16 referencias de
diseño, con qué se copia de cada una, en [customers/referencias/otras-apps/LEEME.md](customers/referencias/otras-apps/LEEME.md).


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
