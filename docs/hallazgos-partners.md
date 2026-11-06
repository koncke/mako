# Hallazgos — MaKo Partners (/partners)

Lo que no se ve leyendo el código de la tab MaKo Partners: las cuentas de MaKo de los clientes de una agencia. El diseño
y su porqué, en [diseno-clients.md](diseno-clients.md) (D7-D10); la historia de la cuenta de agencia (la cartera, las
altas, el cobro), en [hallazgos-customer-success.md](hallazgos-customer-success.md) y
[hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md).

## Nace la tab, y abrir una cuenta deja de exigir un cliente ganado (17/10/2026)

Pedido de Martín: «diseña la tab de "MaKo Partners" con todo lo que habíamos dicho y planeado... Y ahí deberían vivir
los clientes de agencia, que no son los mismos que "client": podrían serlo como no... Eso se debe poder configurar en el
CRM». Chat «Clients», cuenta 4.

- **«Unirse al programa» ES ser agencia** (`esAgencia`: la capa del workspace, que pone el super admin). No hay un flag
  aparte: sería la segunda respuesta a la misma pregunta (lib/agencia.ts ya cuenta por qué se volvió a la capa).
  Quien no es agencia y abre /partners va a /clients; el super admin sin cliente ve la lista de agencias del programa.
  **Vive en:** `app/partners/page.tsx`.
- **Abrir una cuenta es UNA implementación** (`abrirCuentaDePartner`, lib/partners.ts) para las tres puertas: la tab
  («+ Nuevo cliente», sin lead), el CRM («Llevar a MaKo Partners», con un lead de CUALQUIER etapa) y la API de MaKo
  (`llevar_a_partners`). Era `crearCuentaMakoAction`, que exigía un lead GANADO; ahora la envuelve. Las reglas que
  traía siguen: email obligatorio, nace 'pendiente', el email ya usado se mira ANTES de crear el workspace, sin
  rollback (el error nombra el workspace que quedó suelto), y el link del primer mes al final (#866).
- **El plan y el equipo, sólo de las cuentas aprobadas** (`clientesAprobados`): son lecturas que cruzan de inquilino.
  Una cuenta pendiente se ve por su nombre y su estado. `equipo: null` es «no pude leer», nunca «nadie».
- **El link de pago lo escribe el código, nunca el modelo**: la API lo manda a la persona por `ctx.aPersona` y el
  resumen que lee el modelo no lo lleva (`tests/partners.test.ts`, desde el 25/10 `tests/agency.test.ts`). Un link de Mercado Pago retipeado por un modelo es
  un pago a otro lado. **Vive en:** `lib/api-mako/areas/cs.run.ts` (`llevar_a_partners`).
- **Program dice sólo lo que existe**: el precio sale de la plataforma (`precioClienteDeAgencia`, lo carga el super
  admin en /admin/cobros), el primer mes habilita la cuenta y el mes corre desde el onboarding. **Los premios por
  referir NO se dibujan** (docs/referidos.md: decididos el 10/10, sin construir): ponerlos sería prometer algo que el
  sistema no paga. El test frena «gratis», «saldo», «comisión», «premio», «descuento».
- **Sólo el ADMIN de la agencia** (o el super admin): son los links de pago y la puerta a las cuentas de sus clientes.
  Antes vivían en Clients, que la barra muestra sólo al admin pero cuya página no pregunta el rol; acá la página lo
  pregunta, en la computadora y en el teléfono, antes de leer la cartera. **Vive en:** `app/partners/page.tsx`,
  `app/m/partners/page.tsx`.
- **⚠️ Sin link de pago la cuenta YA se abrió** (`sinLink`, lib/partners.ts: el cobro falló después de crearla). Una
  pantalla que decide «¿ya terminó el alta?» por `link !== null` vuelve al formulario, y el segundo envío choca con el
  email ya usado. El alta guarda su propio «hecho». Pasó en el teléfono y se arregló antes de salir.
- **«Reenviar el acceso» y «Nadie puede entrar»** vinieron de la tarjeta de Clients (el caso del ws15 del 28/09: una
  cuenta aprobada con cero usuarios). `equipo: []` es «leí y no hay nadie»; `null`, «no pude leer», y ahí no se
  afirma nada. El permiso lo pregunta `/api/agencia/reinvitar` contra la cartera en el momento.
- **La estructura es la de las sub-cuentas de una agencia en HighLevel** (Agency View › Sub-Accounts), copiada de su
  documentación: el Chrome no estaba conectado para abrirla. Si Martín la rechaza, la referencia a abrir es ésa.

**Lo que quedó SIN hacer:**
- **La opción del CRM** la pone el chat CRM (sus archivos: el menú del tablero, `app/crm/menu-contextual-crm.ts`, y el
  «⋯» de la ficha), montando `ModalLlevarAPartners` (app/partners/LlevarAPartners.tsx) sólo si el workspace es agencia.
- **La entrada en la barra** la pone el chat Sidebar (key `partners`, sólo agencia). En el teléfono, /partners ya tiene
  pantalla (`app/m/partners/`) pero NO fila en More (`SECCIONES_MAS`, lib/movil-rutas.ts, que gatea por key de la
  barra): hasta entonces, en el teléfono sólo se llega por un link a /partners. ⚠️ Una ruta de /m sin fila en
  More sale sin título y con «volver» a la home (`cabeceraPorRuta`): la pantalla pone el suyo con `<CabeceraM>`.
- **La salida de la vista de agencia** («Salir» cuando una agencia mira una cuenta) sigue yendo a /customer-success →
  /clients (`rutaDeSalida` en lib/agencia-cartera.ts y sus tres lectores): debería volver a /partners.
- **Nada se miró en el navegador** (sin extensión de Chrome, sin RAM). En el ws3 no hay agencia: para verla hace falta
  el ws13 (Código Inmobiliario, una agencia real: SÓLO mirar) o ponerle el plan Agencia a un workspace de prueba.

## El programa de referidos se automatiza (23/10/2026)

Martín (22/10) pidió el sistema de referidos con «la página de MaKo Partners», automático, con el dashboard de lo acumulado y los
meses gratis. Eso **reemplaza** la regla de docs/referidos.md §6 («nunca antes de 20 referidos pagando: no panel, no pestaña, no
página pública»), que era una recomendación de la corrida del 10/10 y no una decisión de Martín.

- **Un referido es una compra que CREÓ la cuenta con el código** (`cobros.ref_codigo` + `alta_estado = hecha`; desde el 25/10
  también el cobro de «Empezar mi plan ya» que reemplaza a esa prueba, `COMPRA_QUE_TRAJO`): quien ya tenía MaKo nunca
  cuenta, y el primer código que lo trajo vale (`/r/<código>` no pisa la cookie; el cron toma la compra más vieja).
- **El crédito es un renglón del libro** (`partner_creditos`), con índice único por (referidor, referido): dos corridas del
  cron no acreditan dos veces. Las bienvenidas salen una vez: su marca es haber escrito `workspaces.referido_por_ws` con
  compare-and-set sobre null.
- **Cualquier admin con plan es partner**: el tablero es /partners/referidos (la agencia lo ve como tercera pestaña). El test
  de D7 (tests/partners.test.ts, hoy tests/agency.test.ts) sigue valiendo para la pestaña «Program» de la agencia, que no habla de premios.

**Sin hacer:** APLICAR el crédito en la suscripción del partner (Stripe: saldo del cliente; Mercado Pago: el monto de la cuota)
y el beneficio del que llega (el 1er mes gratis en el de 47, 50% en el de 97: en Stripe es una prueba o un cupón y una factura
de $0; Mercado Pago no tiene prueba gratis en una suscripción sin plan). El primer crédito madura con el 2º pago del primer
referido. Y la entrada «MaKo Partners» de la barra sigue `soloCapas: ['agencia']` (app/_components/nav.ts, del chat Sidebar):
un cliente común llega por «Tu plan» › «Recomienda MaKo» y por los mails. **Vive en:** `lib/partners-reglas.ts` ·
`lib/partners-programa.ts` · `app/partners/referidos/` · `app/mako-partners/` · `tests/partners-referidos.test.ts`.

## Una venta POR LLAMADA perdía al partner del todo (medido el 23/10/2026)

**El síntoma que se temía:** sin pasarela, quien llega con /r/<código> termina en la agenda, compra por teléfono, y el partner
reclama una comisión que el sistema no sabe que es suya. **Medido (8 agentes, cada uno con un refutador, y la base en solo
lectura):** hasta el commit que sigue a bf60e15ef, el código NO quedaba en ninguna tabla. Sólo vive:
- en la cookie httpOnly `mako_ref` del navegador del comprador (60 días desde el primer clic, por host: `www` y el dominio sin
  `www` no la comparten). Nadie de MaKo la puede leer; se ve en las herramientas del navegador del comprador;
- en los logs de requests de Vercel (GET /r/<código>, /planes?ref=) y en los de PostgREST de Supabase (el SELECT de /r lleva
  el código en la query): hora y código, SIN persona. Cruzarlo con una reserva por horario es una atribución débil.

**Se pierde en:** el link a Calendly (llevaba sólo 4 UTM; la Referrer-Policy `strict-origin-when-cross-origin` no deja ver la
query); /r arma /planes de cero y descarta las UTM del link del partner; el webhook de Calendly no guarda el payload crudo
ni tiene columna de partner; el alta a mano («Nuevo cliente» en /admin) no tiene campo de partner ni crea un cobro; «Vender
un plan» (/admin/cobros, sólo con pasarela) no lleva `ref_codigo`, y /pagar/<token> no lee la cookie aunque sea el mismo
navegador. **`cobros.ref_codigo` lo escribe el checkout** (lib/compra-plan.ts), y sin pasarela devuelve 503 antes de escribir
nada; desde el 25/10 también «Empezar mi plan ya» (lib/empezar-plan.ts), que COPIA el de la prueba (no trae uno nuevo).

**Lo que se arregló:** sin campaña (por /r siempre es así), el código viaja a la agenda como `utm_source=mako-partners`,
`utm_medium=referido`, `utm_campaign=<código>` (`agendaConOrigen`, lib/compra-plan-reglas.ts). Queda en la reserva de
Calendly y, cuando la agenda de MaKo entre al CRM del ws 9 (hoy NO entra: docs/hallazgos-integraciones.md), en el lead.
Con campaña gana la campaña. Un comprador que no pasó por /r (lo recomendaron de palabra) sigue sin código: la única huella
es lo que escriba en «¿Cómo llegaste a MaKo?» del onboarding (`onboarding.encuesta` del negocio; no pregunta QUIÉN).

**Reconstruir a mano una comisión (no hay pantalla: es SQL):** `acreditarReferidos` lee SÓLO cobros de la plataforma con
`ref_codigo`, `alta_ws`, `alta_estado = 'hecha'` (o, desde el 25/10, `creado_por` `empezar-ya:<prueba>`: `COMPRA_QUE_TRAJO`)
y estado pagado; acredita con 2 filas de `pagos` pagado=true cuyo
`cobro_id` sea un cobro de la plataforma con ese `alta_ws`. No mira la pasarela.
- **A (el sistema lo reconoce solo):** un cobro en el ws 9 con `tipo = 'unico'` (con `'suscripcion'` el negocio pasa a «MaKo
  le cobra por la pasarela»: topes, «Tu plan», «Darme de baja» contra una pasarela que no intervino, y mora si se prende el
  corte), `proveedor` cualquiera de los dos (lo exige el CHECK aunque no intervino), `monto_usd` = precio de lista (ESO es el
  crédito), `alta_ws = N`, `alta_estado = 'hecha'`, `alta_capa = NULL` (con capa puesta, la reconciliación intentaría otra
  alta), `ref_codigo` y `created_at` de la compra (el primero vale). Las dos cuotas, con «Registrar pago suelto» en la ficha
  del lead del ws 9 y después `cobro_id`. El cron ata, manda las dos bienvenidas y acredita.
- **B (sólo la plata):** un renglón en `partner_creditos` (`tipo 'ajuste'` lo admite el CHECK; nadie lo escribe en código).
  El saldo se ve, pero el referido NO aparece en la lista del tablero (sale de cobros con `ref_codigo`).

**Trampas:** `workspaces.referido_por_ws` no tiene NINGÚN lector: cargarlo a mano no da crédito ni se ve. `existe()` de /r
trata un error de Supabase como «código inexistente» (sin cookie ni ?ref, sin log). `comprasConCodigo` corta en 500 y
`acreditarReferidos` en 1000, en silencio. **Medido en la base el 23/10:** `partner_codigos` = 0 (el código nace al abrir
/partners/referidos), y 0 cobros con `ref_codigo`: hoy no hay ningún link de partner en la calle.

**Sin hacer:** un campo de partner en el alta a mano («Nuevo cliente» y «Vender un plan») que escriba el cobro de la opción A;
leer la cookie en /pagar/<token>. **Vive en:** app/r/[codigo]/route.ts · lib/compra-plan-reglas.ts (`agendaConOrigen`) ·
lib/partners-programa.ts · app/admin/cobros/actions.ts · lib/alta-cliente.ts · tests/planes-sin-pasarela.test.ts.

## MaKo Partners estaba construido y ningún cliente podía llegar (24/10/2026)

**Síntoma:** Martín pidió «la tab de MaKo Partners para clientes» como si no existiera. Existían la página pública
(/mako-partners), el tablero (/partners/referidos), el panel del super admin y la versión de teléfono. **Causa:** el ítem del
menú de la foto (app/_components/nav.ts, `USER_NAV`) tenía `soloCapas: ['agencia']` desde el 17/10, de cuando Partners era
sólo la cartera de las agencias; el 23/10 el programa de referidos se abrió a todo negocio y nadie cambió la puerta. Un
cliente común llegaba sólo tipeando la URL. **El diagnóstico obvio era el equivocado:** «no está en la barra» (se buscó en
lib/navegador.ts, que no es la barra): estaba, con una visibilidad vieja. Antes de construir una tab «que falta», buscar su
key en nav.ts y mirar su `soloCapas`/`rolesWs`.

**Lo que quedó:** la ve el ADMIN de cualquier negocio (sin `rolesWs`: el closer y el setter no). Arriba del tablero del
cliente y del panel del super admin, primero lo que vende la idea (app/partners/PresentacionPartners.tsx) y después el panel;
el super admin ve el programa entero (`resumenDelPrograma`) y las agencias. En el teléfono, quien no es agencia ve sus
referidos (app/m/partners/ReferidosM.tsx) en vez de rebotar a Clients. /planes lleva a /mako-partners.
- **La cuenta del super admin es la de `acreditarReferidos`** (`contarPrograma`, lib/partners-reglas.ts): la compra MÁS VIEJA de
  cada negocio decide aunque su código no cuente (sin dueño, el propio, el de la plataforma); el mismo filtro de estado
  (pagado o reembolsado). Con otra cuenta, el panel y los créditos dirían números distintos del mismo programa.
- **La presentación dice SÓLO lo que existe:** el crédito por referido. No «se descuenta» ni la comisión del grupal.

**Resuelto el 24/10:** «Cómo funciona» del tablero prometía que el crédito «se descuenta de tus próximos meses» y el 20% del
grupal; ya no (ver «La página de partners, como una landing»). **Vive en:** app/_components/nav.ts ·
app/partners/ · app/m/partners/ · lib/partners-programa.ts (`resumenDelPrograma`) · lib/partners-reglas.ts (`contarPrograma`) ·
tests/partners-para-clientes.test.ts · tests/sidebar-nueva.test.ts.

## La página de partners, como una landing de ventas, y el panel de la misma familia (24/10/2026)

**Síntoma (Martín):** «mejora completamente el diseño de "Partners", eso debe verse de ventas, como una landing, está horrible
hoy». /mako-partners era dos tarjetas con viñetas sobre el estilo de /planes, y el panel de adentro, otra app.
**Lo que se tomó de los programas que venden** (Notion, Framer, Webflow, ConvertKit, Beehiiv): el NÚMERO GRANDE arriba (lo que
suma un referido de Pro), tres pasos, la CUENTA HECHA para el que mira (1, 5 y 10 negocios), las reglas sin letra chica y UNA
acción («Quiero mi link» → /partners/referidos). **Lo que NO:** la prueba social con casos de otros partners — hoy no hay
ninguno, y un testimonio inventado no se publica. Cuando haya partners con créditos de verdad, esa sección es la que falta.
- **La trampa del color: en esta app `--accent` NO es el azul, es el DORADO** (`--accent: var(--mako-ink)`, app/globals.css).
  El panel usaba `var(--accent)` y por eso se veía «de otra app» al lado de la landing azul. El azul de MaKo es `--primary`
  (#2F6FED en claro; cambia solo en oscuro y en Nord). Un panel de adentro que tiene que parecerse a una página pública: con
  `--primary`/`--primary-bg`/`--on-primary`, nunca con el hex fijo de la landing (en oscuro queda un bloque blanco).
- **Los números salen de los planes y las reglas** (`PLANES_MAKO_DEFAULT`, `PROGRAMA_ACELERADOR`, `COMISION_GRUPAL`,
  `DIAS_COOKIE_REF`, `PAGOS_PARA_ACREDITAR`): la página tenía «60 días» a mano. Si cambia el precio de Pro, cambia la página.
- **Un guard de texto sobre la FUENTE también lee el CSS:** el «sin 20%» de la presentación saltó por un `-20%` de un degradado.
  No es un falso positivo que haya que aflojar: se mueve el CSS.

- **Una promesa escrita que el código no cumple no es «un pendiente de producto»: es la app contando algo que no hace**
  (el Cerebro, 24/10, al ver la primera versión: «se cobra con el primer partner que la reclame»). La primera versión
  mantuvo «un referido de Pro vale un mes de Pro» y «US$ 300 en plata» por cada Acelerador, porque «ya estaban» y la decisión
  era de Martín. **Medido:** el crédito es un renglón de `partner_creditos` y NADA lo consume (no hay renglones de «uso»), y la
  comisión del Acelerador no se registra en ningún lado (sólo existe la constante `COMISION_GRUPAL`). Elegir entre
  implementar la regla o cambiar el texto: aplicar el crédito pide la pasarela (no la hay), así que se cambió el texto.
- **Lo que dice ahora, en TODAS las pantallas** (landing, panel, teléfono, «Tu plan», el pie de /planes y el mail del
  crédito): cada referido suma su primer mes como crédito, y una sola frase dice lo que pasa hoy (`CREDITO_HOY`,
  lib/partners-reglas.ts: «queda registrado en tu panel. Todavía no se descuenta solo de tu plan»), también en las reglas de
  la landing. El panel ya no muestra «Disponible», «Meses gratis» ni «A cobrar en plata» (`resumenDelLibro` los sigue
  contando, para el día que se apliquen). Sin cobro en línea, la landing avisa como el panel que un referido no aparece solo.
  El test (tests/mako-partners-landing.test.ts) frena «meses gratis», «se descuenta» (salvo «no se descuenta»), «en plata»,
  «a cobrar», «comisión» y «20%» en cada una de esas pantallas y en los mails.
- **Dónde se escondía la promesa:** no sólo en la página. «Cada referido te suma un mes» en «Tu plan»
  (app/configuraciones/plan/PlanPanel.tsx), «gana meses gratis» en el pie de /planes (app/planes/Vitrina.tsx) y «tus meses
  gratis» en el mail del crédito (lib/partners-programa.ts, `avisarCredito`). Las páginas internas del super admin
  (app/admin/estrategia, app/admin/dev) describen el programa decidido el 10/10 con descuento y pago en plata: son planes,
  no promesas al cliente, y no se tocaron.

**Sin hacer:** aplicar el crédito (descontarlo de la cuota del partner) y registrar la comisión del Acelerador; el día que
se haga, cambia `CREDITO_HOY` junto con la regla y el test lo pide (docs/relevo/suscripcion.md, punto 5). **Vive en:**
app/mako-partners/LandingPartners.tsx · app/partners/PresentacionPartners.tsx · app/partners/referidos/Referidos.tsx ·
app/m/partners/ReferidosM.tsx · lib/partners-reglas.ts (`CREDITO_HOY`) · tests/mako-partners-landing.test.ts.

## Sin pasarela, el programa no puede registrar a nadie, y el panel lo dice (24/10/2026)

**Medido por el Cerebro contra producción:** la bienvenida al referido, el atado y el crédito salen SÓLO de un cobro de la
plataforma con `ref_codigo` y el alta hecha, o sea, de una compra pasada por el checkout. El negocio de MaKo no tiene ninguna
pasarela conectada: el checkout corta antes de crear el cobro, y ningún referido se registra nunca. El panel quedaba en cero
sin decir por qué, que se lee como «nadie usó tu link». **Ahora lo dice** (`textoSinReferidos` y
`textoProgramaSinReferidos`, lib/partners-reglas.ts), con la MISMA cuenta que /planes (`ofertasDeLosPlanes`): al cliente,
que hoy se da de alta por llamada y que avise si alguien entró con su link; al super admin, que sin pasarela no entra ninguno
solo. «No pude leer si cobra» no afirma nada: queda el texto de siempre.

**El camino del crédito, ejercitado sin cobro real** (tests/partners-credito-simulado.test.ts): `acreditarReferidos` corre de
verdad contra una base en memoria y con los mails anotados. Primer mes, se atan y salen las dos bienvenidas (a los admins, no
al closer). Segundo mes, el crédito a precio de lista y el aviso. Otra corrida, nada se repite. El código de la plataforma,
nunca. Y el tablero y el panel del super admin cuentan lo mismo. Así, cuando Martín conecte la pasarela, no se descubre ahí que
no acredita. **Lo que NO prueba:** la pasarela misma (que el webhook deje `alta_estado = 'hecha'` y las cuotas en `pagos`), que
se prueba con la compra de humo.

## La landing hasta que el negocio se une, y «¿meses o dinero?» contestado en una mirada (24/10/2026, noche)

Martín: «La pagina de MaKo Partners DEBE ser siempre la landing al menos que el usuario ya se haya registrado como partner,
solo cuando se registre ahi aparece el dashboard... No me da claridad en lo que ganan, esta todo muy amontonado, no se sabe si
se ganan meses o dinero... Falta algo como "Calculadora"». Chat «Planes», cuenta 5.

- **«Registrado como partner» ES tener código** (`partner_codigos`): no hay otra marca, y una segunda sería otra respuesta a la
  misma pregunta. **La trampa:** `tableroDe` llama a `codigoDe`, que CREA el código si no hay. Hasta hoy el código nacía con
  sólo abrir el tablero, así que todo admin que abrió la tab el 23-24/10 ya figura unido sin haber tocado nada (ve el panel, no
  la landing). Para preguntar si se unió está `codigoSiExiste` (sólo lee); nunca `tableroDe` ni `codigoDe`. «Unirme» es
  `unirmeAPartnersAction` (app/partners/actions.ts): admin del negocio, nunca la plataforma, vuelta de una lista blanca.
- **(REEMPLAZADO el 25/10: ver la entrada que sigue.)** La respuesta honesta a «¿meses o dinero?» era «crédito para tu plan,
  no dinero en efectivo», dicha en la ficha del hero y primera en las preguntas. Lo decidido el 10/10 (docs/referidos.md) es descuento para el usuario común y plata del sobrante
  para la agencia, pero NADA consume el crédito todavía: «no es dinero» es verdad hoy para todos. El día que se le pague a una
  agencia, la ficha cambia junto con la regla. La calculadora suma en dólares y NO dice a cuántos meses equivale: el Cerebro ya
  había frenado «= 5 meses de MaKo Pro» como promesa (el test lo sigue frenando).
- **La landing pública escondía la barra de la app** (`body:has(.mp-root) aside { display: none }`): montarla adentro de la tab
  dejaba la app sin su barra. Ahora sólo con `.mp-publica`, y el modo `app` toma los tokens de la app (`--primary`, nunca
  `--accent`, que es el dorado). Una pieza pública que se reusa adentro: buscar primero qué le hace al `body`.
- **Copiada de:** LLM Pulse (llmpulse.ai/affiliate: la calculadora con la barra y el plan a la izquierda y el resultado en el
  bloque azul), systeme.io (la ficha «qué, cuánto, cuándo»), DigitalOcean («earn free credits»: crédito, sin vueltas) y Kit (la
  cuenta con un ejemplo). GoHighLevel, Hostinger y Beehiiv no tienen calculadora: buscarla en programas chicos de SaaS.
- **Mirar un componente de cliente sin levantar la app:** el render estático no hidrata, así que la calculadora se probó
  empaquetando SÓLO ella con el esbuild del clon (`node node_modules/esbuild/bin/esbuild entrada.tsx --bundle --jsx=automatic
  --tsconfig=../tsconfig.json`, que resuelve el `@/`) y montándola con `createRoot` en lugar de la estática, sobre el HTML de
  `renderToStaticMarkup`; Playwright de Python con `channel='chrome'` movió la barra y leyó «US$ 564» (12 × 47).

**Sin hacer:** el super admin ve la landing entera arriba del programa (lo pidió así el 24/10 a la tarde; si molesta, va
plegada). Aplicar el crédito sigue pendiente (docs/relevo/suscripcion.md, punto 5). **Vive en:** app/mako-partners/LandingPartners.tsx ·
app/mako-partners/Calculadora.tsx · app/partners/referidos/page.tsx · app/m/partners/page.tsx · app/partners/actions.ts ·
lib/partners-programa.ts (`codigoSiExiste`) · tests/mako-partners-landing.test.ts · tests/partners-para-clientes.test.ts.

## «Meses Y dinero, según qué se refiere»: la comisión del Acelerador vuelve a la landing (25/10/2026)

Decidido por el Cerebro (memoria `decisiones-venta-25-10`), con lo que Martín ya había decidido el 10/10 en
docs/referidos.md: el negocio que se suscribe deja su primer mes como crédito; el que entra al Acelerador, US$300 en efectivo
(el 20% de cada cuota). La landing no puede decir «no es dinero» a secas. Chat «Planes», cuenta 5.

- **El diagnóstico obvio era el equivocado: «no es dinero» no era la frase honesta, era la mitad.** Era verdad para el crédito
  y callaba la comisión del Acelerador, que estaba decidida desde el 10/10 y la paga el equipo a mano. Una pantalla honesta
  dice las dos, una línea cada una, y cada una con lo que pasa hoy: `CREDITO_HOY` (nada lo descuenta solo) y `COMISION_HOY`
  (el libro no la registra: la anota y la transfiere el equipo). La guarda lo exige así: toda pantalla que nombra el efectivo
  tiene `COMISION_HOY` (tests/mako-partners-landing.test.ts, `EFECTIVO`).
- **La comisión tiene UNA fuente:** `comisionDelAcelerador(PROGRAMA_ACELERADOR.precioUsd)` con `COMISION_GRUPAL` (0,2), que
  existía en lib/partners-reglas.ts sin que nadie la usara; /admin/estrategia tiene su propio `COMISION_GRUPAL = 300` en
  dólares (app/admin/estrategia/datos.ts). Si cambia el precio del Acelerador o el porcentaje, cambian la landing, el panel y
  el teléfono; la estrategia, no.
- **Trampa de una guarda de palabras: «¿Gano dinero o meses?» contiene «no dinero»** (Ga-NO DINERO). La regla para frenar «no
  es dinero» va con `\b`.
- **Sin comisión si el negocio usa la garantía del Acelerador** (docs/referidos.md): ahora que hay garantía de entrega (la
  cuota se devuelve si en la semana 1 el embudo no está armado), la landing lo dice en las preguntas.
- **La calculadora suma el Acelerador aparte:** se elige como un plan más, a todo el ancho, y el resultado dice «En efectivo»
  con la letra de la comisión, no la del crédito.

**Sin hacer:** el libro no registra la comisión (el Acelerador se cobra fuera de la pasarela): el pedido llega con el código
del partner (`pedirPlanSinPasarela`) y el equipo la anota a mano. El día que se registre, cambian `COMISION_HOY` y el panel
juntos. Los mails del crédito no la nombran (a propósito: el test lo frena). **Vive en:** lib/partners-reglas.ts
(`comisionDelAcelerador`, `COMISION_HOY`) · app/mako-partners/LandingPartners.tsx · app/mako-partners/Calculadora.tsx ·
app/partners/referidos/Referidos.tsx · app/m/partners/ReferidosM.tsx · tests/mako-partners-landing.test.ts.

## Sólo plata, partner = terminó el alta, todo en /partners, y la agencia afuera (25/10/2026)

Martín, 25/10 ~15:40 (docs/feedback-25-10-tarde.md, puntos 1 a 8): «solo ganen direro... se llevan el 100% de lo que
venden... si alguien no se hizo "Partner", no le debe saltar abajo nada de "Todavía no tienes referidos" o del
dashboard... un pequeño onboarding... en la compra, en el carrito, esté la opción de poner código de referido... en
SuperAdmin, directo ver el dashboard». Las reglas nuevas, en docs/referidos.md (el bloque del 25/10, arriba de todo).

- **El diagnóstico obvio era el equivocado.** «Los clientes no ven la landing» parecía un problema de la landing. La
  causa: «ser partner» era TENER CÓDIGO, y hasta el 24/10 el código nacía con sólo abrir el tablero. Todo negocio que lo
  abrió antes ya «era partner» y veía el tablero vacío («Todavía no tienes referidos»). Ahora partner = **terminó el alta**
  (el setting `partners.alta` del negocio, con lo que contestó); el código no alcanza. Nada nuevo en la base: el alta es un
  setting y los pagos son renglones `uso` del libro que ya existía (`partner_creditos`, mig 0330). **Vive en:**
  `altaDePartner`, `hacermePartner` (lib/partners-programa.ts) · app/partners/page.tsx · app/m/partners/page.tsx.
- **Trampa: el anual cobra el año, y lo que se gana es el primer MES.** El cron acreditaba lo cobrado (`monto_usd`): un anual
  de Pro le habría dejado US$ 970 al partner. Ahora sale del precio de lista por mes del plan (`precioDeListaPorMes`: el
  plan del catálogo; si no se conoce, lo cobrado dividido por sus `meses`). **Vive en:** lib/partners-reglas.ts.
- **`uso` cambió de significado sin migración:** era «crédito usado en tu plan» (nunca se escribió uno: `CREDITO_HOY` decía
  que nada lo consumía) y ahora es «lo que MaKo te transfirió». El super admin lo anota con «Marcar pagado»; no mueve plata.
- **Las visitas al link no tienen tabla:** las suma /r/<código> en el setting `partners.visitas` del partner, sólo la primera
  vez de cada navegador (sin cookie previa) y nunca un robot de vista previa (WhatsApp, Facebook, Telegram abren el link cada
  vez que alguien lo pega). La suma no es atómica: es un número del panel, no plata.
- **El código del carrito:** escrito a mano gana sobre la cookie (es quien paga diciendo quién lo trajo); si no, el primer
  link. Uno que no es de ningún partner se rechaza con un texto claro (antes se guardaba y nunca contaba). Si no se puede
  leer la base, la compra sigue. **Vive en:** `codigoDeLaCompra` (lib/compra-plan-reglas.ts) · app/api/planes/comprar ·
  app/planes/[plan]/CodigoReferido.tsx. El Acelerador no lo lleva (no entra en Partners).
- **Trampa del login:** el `?next` de proxy.ts guarda sólo la RUTA, no la query. Desde /mako-partners sin sesión, «Hacerme
  partner» (`/partners?alta=1`) vuelve a /partners sin el `?alta=1`: la landing con el mismo botón, un clic más.
- **La agencia salió a /agency** (y /m/agency). En la rama de Planes, un /agency provisorio con el panel de antes; el chat
  «Agencias y clientes» lo reemplaza entero con su Agency Dashboard (app/agency/AgencyApp.tsx, app/m/agency/AgencyM.tsx) y se
  llevó los tests de la cartera a tests/agency.test.ts. Los links viejos `/partners?cuenta=|nuevo=|tab=` redirigen. **Cuando
  entren las dos ramas quedan muertos** app/partners/PartnersApp.tsx, LlevarAPartners.tsx y app/m/partners/PartnersM.tsx (no
  app/partners/EquipoDeCuenta.tsx: lo usa AgencyApp).
- **Copiado de:** el portal de Tolt para el panel del partner (saludo, cuatro números, «Earnings» al lado de «Share», la
  tabla) y el admin de FirstPromoter para el del super admin (to be paid · unpaid · paid). Capturas en
  docs/partners/referencias/. Rewardful y Dub no mostraron su panel sin cuenta (sólo videos de marketing).

**Sin hacer:** la tab «Agency Dashboard» en la barra (es de nav.ts, del chat Sidebar; mientras tanto el panel del partner
de una agencia y el del super admin llevan un botón a /agency). Pagar a los partners sigue siendo a mano (no hay payouts
automáticos). La landing pública y los mails nuevos no se probaron contra producción. **Vive en:** app/partners/ ·
app/agency/ · lib/partners-*.ts · lib/api-mako/areas/negocio.* (`ver_mi_programa_partners`, `hacerme_partner`,
`cambiar_cobro_partners`, `ver_programa_partners`, `registrar_pago_partner`).

## «En camino» contaba para siempre al que se fue, y «Empezar mi plan ya» dejaba al partner sin cobrar (25/10/2026, revisión del tren)

- **«Empezar mi plan ya» perdía el código.** Abre un cobro NUEVO y, al cobrarse, la prueba queda 'anulado'; el cobro nuevo no
  llevaba `ref_codigo` y el programa sólo aceptaba alta 'hecha': el partner no cobraba nunca. Ahora el cobro nuevo copia el
  código de la prueba (sólo si la prueba CREÓ la cuenta) sin marcarse 'hecha' (le abriría el cambio de email del acceso), y
  `acreditarReferidos` y `resumenDelPrograma` aceptan `COMPRA_QUE_TRAJO` (alta 'hecha' o `creado_por` `empezar-ya:*`), con el
  MISMO filtro. Un link abierto antes del arreglo y todavía sin pagar se reusa y recibe el código ahí. **Vive en:**
  lib/empezar-plan.ts · lib/partners-programa.ts.
- **El diagnóstico obvio era el equivocado: «`estadoDelReferido` no da 'se-fue' con 0 meses».** Se arregló eso y el panel
  seguía igual, porque `vigente` salía de `workspaces.estado` y **con el corte de acceso APAGADO**
  (`CORTE_DE_ACCESO_PRENDIDO = false`, lib/plan-acceso-reglas.ts) `revisarAccesosPorPago` sale en la primera línea: nadie
  pausa a nadie, y el que canceló la prueba sin pagar queda 'activo' para siempre. El test pasaba porque su fixture ponía el
  negocio 'pausado' a mano, algo que producción no produce. **La regla:** que un cliente se fue lo dicen SUS COBROS, no el
  estado del negocio (`seFueSegunSusCobros`, lib/partners-reglas.ts: la prueba caída, dada de baja o anulada, y ningún otro
  cobro vivo). Un fixture que pone a mano un estado que sólo escribe un cron apagado prueba un mundo que no existe.

**Sin hacer:** un referido SIN prueba (compra directa, p. ej. Stripe) que paga un mes y cancela sigue «en camino» mientras su
negocio no se pause: `seFueSegunSusCobros` sólo decide cuando hay una prueba caída (un plan anual dado de alta a mano puede
no tener suscripción, y no se quiso dar por ido a quien paga). **Vive en:** lib/partners-reglas.ts (`seFueSegunSusCobros`) ·
lib/partners-programa.ts (`mesesPagadosDe`, `tableroDe`) · tests/partners-empezar-ya.test.ts · tests/partners-referidos.test.ts.

## Recursos para revender y el código que se puede cambiar (27/10/2026)

La llamada con Leila (Fathom 876470842-25 y -06). Chat «Planes, pagos y Partners», cuenta 5. Desde el mismo día, hacerse
partner es de MaKo Pro (docs/hallazgos-planes-y-cobro.md, «La tabla de /planes para quien no sabe nada…»).

- **«Para recomendar MaKo» en el panel:** el PDF de venta y cinco mensajes para copiar, todos con SU link (y el del precio,
  con SU código). El PDF se arma EN EL NAVEGADOR con jsPDF (ya estaba, lo usa el Image Editor): un archivo fijo se
  desactualiza con el primer cambio de precio. Los planes y lo que trae cada uno salen de lib/planes-mako.ts y de la tabla de
  /planes, sin jerga. No promete descuento a quien llega con el código: no está decidido. La API los devuelve en
  `ver_mi_programa_partners`.
- **Lo que falta de material (lo graba Martín), y NO se muestra hasta que exista:** audios de WhatsApp (presentación de 1
  minuto, respuesta a «¿cuánto cuesta?», respuesta a «no tengo tiempo»), videos (demo de 3 minutos de MaKo por dentro, un caso
  real con números) y capturas para estados e historias. Se suman en lib/partners-recursos.ts.
- **El código editable (mig 0341), y el diagnóstico obvio era el equivocado: «es un update de `partner_codigos`».** Un update
  suelto dejaba sin dueño todo lo que el partner ya había mandado: los links /r/<viejo> por WhatsApp, la cookie de 60 días y
  los cobros con `ref_codigo = <viejo>`, que `acreditarReferidos` resuelve por código. El viejo pasa a
  `partner_codigos_anteriores` y CADA lectura que va de un código a un negocio mira también ahí: `wsDelCodigo` (acreditar y
  visitas), `esCodigoDePartner` (el código escrito al pagar), `codigoVigente` (/r/<viejo> deja la cookie con el código nuevo),
  `tableroDe` y `resumenDelPrograma`.
- **Único entre los actuales Y los anteriores de otros,** atómico en la base (`cambiar_codigo_partner`, con candado de la
  transacción). Un trigger impide que el código que nace del nombre (`codigoDe`) sea el viejo de otro: choca con 23505 y
  prueba con sufijo, como siempre. Sin la migración, «Cambiar» contesta «todavía no se puede» y no toca nada.

- **Un `?ref=` que no era de nadie quedaba en el cobro, y el partner que después ELEGÍA ese texto se llevaba el crédito (la
  verificación de 3ca2d8328, 28/10).** Sólo se validaba el código ESCRITO; el que trae un link (la cookie de /r/<código> o el
  `?ref=` de /planes/<plan>) entraba sin mirar. Con el código editable, Beto eligió `promo-octubre` y cobró US$97 de una compra
  que no trajo (r4-partners.ts, por la ruta real). Ahora se guarda sólo si es de un partner (`codigoQueCuenta`,
  lib/compra-plan-reglas.ts), y una cookie de nadie no tapa el `?ref=` de uno. Si no se puede leer, la compra sigue con él.

La mig 0341 quedó APLICADA en producción el 28/10 (el Cerebro, con el sí de Martín: era 0340 y chocó con la del editor de
imágenes, de otra rama). **Sin hacer:** el teléfono muestra el código sin «Cambiar» (como dónde cobra: se cambia en la
computadora). Un ref que ya quedó guardado de antes no se limpia (cuando se midió, más arriba, había 0 cobros con `ref_codigo`).

- **Un código que quedó LIBRE lo tomaba otro partner y heredaba al referido (la verificación de a196d5a93, p-partners.ts H2).**
  `acreditarReferidos` resuelve el código en CADA vuelta, no usa el referidor que ya ató. Al borrar el negocio de Ana se van sus
  códigos (cascade) y `referido_por_ws` vuelve a null; Beto elegía `ana-partner`, la vuelta siguiente le ataba el cliente (las
  dos bienvenidas a nombre de Beto) y el 2º mes le pagaba los US$97. **El diagnóstico obvio era el equivocado («si ya está
  atado, acreditar a ése»): la FK lo deja en null al borrar.** Ahora no se puede ELEGIR un código que ya trajo compras
  (`cobros.ref_codigo`) y no es tuyo, ni heredarlo por el nombre (`codigoDe` prueba con sufijo); volver a uno tuyo siempre se
  puede (`esCodigoPropio`). En TS, sin migración: la 0341 ya está aplicada.
- **Con la base caída, el `?ref=` crudo se guardaba «por las dudas» (H3).** `codigoQueCuenta` daba por bueno lo que no podía
  leer. Ahora, sin poder leer, vale la cookie (la dejó /r/<código>, que ya la validó) y el `?ref=` de la URL se descarta.

**Sin hacer:** `cambiar_codigo_partner` (la RPC de la 0341) no mira `cobros.ref_codigo`: el chequeo vive en TS, antes de
llamarla, así que una carrera exacta entre las dos lecturas podría pasar (hace falta un partner borrado en ese segundo). Una
cookie de un código muerto en /r todavía tapa el link del partner vigente (preexistente, CAE en la verificación).
**Vive en:** lib/partners-recursos.ts · app/partners/RecursosPartner.tsx · app/partners/PanelPartner.tsx ·
app/m/partners/ReferidosM.tsx · lib/partners-reglas.ts (`codigoNuevoValido`) · lib/partners-programa.ts
(`cambiarCodigoPartner`, `codigoVigente`) · app/r/[codigo]/route.ts · supabase/migrations/0341_partner_codigo_editable.sql ·
lib/api-mako/areas/negocio.* · tests/partners-recursos.test.ts · tests/partners-codigo-editable.test.ts.

## Cualquier plan es partner, el cliente de una agencia no lo ve, y el código en la venta a mano (29/10/2026)

La llamada con Thiago (docs/promesas/2910-llamada-thiago.md, *(Planes y Partners)*). Chat «Suscripción y Partners», cuenta 3.

- **Lo publicado y el código decían cosas distintas.** Desde el 27/10 hacerse partner era sólo de MaKo Pro, pero las
  landings dicen «gratis» y «cualquier plan». Gana lo publicado: `FUNCIONES_SOLO_PRO` queda en `['scraper-whatsapp']`, sin
  candado en `hacermePartner`, `hacerme_partner` (API) ni /partners, y /planes lo muestra en las dos columnas. Quien ya era
  partner no cambia.
- **El cliente de una agencia no ve el programa** (Thiago: «yo no me meto con ese cliente»). No aparece en la barra (la marca
  `noParaClienteDeAgencia`; el dato lo da /api/auth/me desde `agenciaDeCliente`, nunca la URL). /partners y /m/partners
  vuelven al inicio, y «Tu plan» no muestra «Recomienda MaKo». Tampoco se hace partner por la API: `hacermePartner` lo
  rechaza (revisión de plata, hallazgo 13: sólo estaba escondido en pantalla). En el teléfono la entrada ya estaba `oculta`.
- **El código en la venta a mano** (/admin/cobros «Vender un plan» y `vender_plan_mako`, el parámetro `codigoPartner`): se
  limpia como el de /r/<código> (`codigoRefLimpio`) y tiene que ser de un partner (`esCodigoDePartner`, el mismo que el
  carrito: vale un código que el partner dejó y no vale la plataforma). Se pregunta ANTES de devolver un link que ya existía,
  y ese link lo recibe si no tenía uno; sin poder guardarlo, el link nuevo se anula y se dice.
- **Trampa: el partner ganaba lo COBRADO, no el precio de lista** (revisión de plata, hallazgo 6). `precioDeListaPorMes`
  usa `plan_mako`, y la venta a mano nunca lo escribía: caía a `monto_usd / meses`, así que un pago único de US$1.500 o un
  precio especial se acreditaba entero. **El primer arreglo era el equivocado: escribir `plan_mako` en la venta.** Con un
  plan anotado, esa venta entraba a las ofertas de retención y `reactivarPlan` la reactivaba a precio de lista en vez del
  pactado. El arreglo vive en la acreditación (`conPlanDeLista`): sin plan anotado, la lista del plan más barato de la capa
  vendida (`alta_capa`); una capa sin plan en el catálogo (p. ej. `pm`), el más barato de todos. Un partner nunca gana más
  que la lista. Si el link que ya existía tiene el código de otro partner, se dice en vez de contestar «ok».

## Una cookie de un código muerto tapaba el link vigente, y la compra quedaba sin partner (6/11/2026, nube, barrido)

«El primero vale» (docs/referidos.md): `/r/<código>` no pisaba la cookie `mako_ref` si ya había una. Pero también ponía ESE código en
el `?ref=` de /planes, así que con una cookie de un código que ya no es de nadie, al comprar `codigoQueCuenta` descartaba los dos
(la cookie y la URL) y la venta salía sin el partner que la acababa de traer. Ahora la cookie de antes vale sólo si sigue siendo de
un partner (`refQueVale`, lib/partners-reglas.ts, con `esCodigoDePartner`); si no, el link de hoy la reemplaza y cuenta la visita.
- ⚠️ **«No pude leer» vale como el primero, y eso exigía arreglar una lectura más abajo** (la revisión adversarial): la de los
  códigos ANTERIORES (`wsDeCodigoAnterior`, lib/partners-programa.ts) se tragaba el error y daba null, así que con la base caída un
  código viejo de un partner que cambió el suyo contaba como muerto, y el link de otro le pisaba la cookie por 60 días. Ahora sólo
  la tabla que falta es «ninguno»; otro error tira. Ejecutado con una base de mentira en tests/partners-referidos.test.ts.
**Sin hacer:** una cookie de alguien que nunca terminó el alta de partner sigue tapando el link de uno real (`esCodigoDePartner`
no mira el alta): no le quita a nadie, sólo deja sin arreglar ese caso. **Vive en:** app/r/[codigo]/route.ts ·
lib/partners-reglas.ts · lib/partners-programa.ts
