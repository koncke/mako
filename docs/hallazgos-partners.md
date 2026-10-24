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
  resumen que lee el modelo no lo lleva (`tests/partners.test.ts`). Un link de Mercado Pago retipeado por un modelo es
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

- **Un referido es una compra que CREÓ la cuenta con el código** (`cobros.ref_codigo` + `alta_estado = hecha`): quien ya tenía
  MaKo nunca cuenta, y el primer código que lo trajo vale (`/r/<código>` no pisa la cookie; el cron toma la compra más vieja).
- **El crédito es un renglón del libro** (`partner_creditos`), con índice único por (referidor, referido): dos corridas del
  cron no acreditan dos veces. Las bienvenidas salen una vez: su marca es haber escrito `workspaces.referido_por_ws` con
  compare-and-set sobre null.
- **Cualquier admin con plan es partner**: el tablero es /partners/referidos (la agencia lo ve como tercera pestaña). El test
  de D7 (tests/partners.test.ts) sigue valiendo para la pestaña «Program» de la agencia, que no habla de premios.

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
navegador. **El único que escribe `cobros.ref_codigo` es el checkout** (lib/compra-plan.ts), y sin pasarela devuelve 503
antes de escribir nada.

**Lo que se arregló:** sin campaña (por /r siempre es así), el código viaja a la agenda como `utm_source=mako-partners`,
`utm_medium=referido`, `utm_campaign=<código>` (`agendaConOrigen`, lib/compra-plan-reglas.ts). Queda en la reserva de
Calendly y, cuando la agenda de MaKo entre al CRM del ws 9 (hoy NO entra: docs/hallazgos-integraciones.md), en el lead.
Con campaña gana la campaña. Un comprador que no pasó por /r (lo recomendaron de palabra) sigue sin código: la única huella
es lo que escriba en «¿Cómo llegaste a MaKo?» del onboarding (`onboarding.encuesta` del negocio; no pregunta QUIÉN).

**Reconstruir a mano una comisión (no hay pantalla: es SQL):** `acreditarReferidos` lee SÓLO cobros de la plataforma con
`ref_codigo`, `alta_ws`, `alta_estado = 'hecha'` y estado pagado; acredita con 2 filas de `pagos` pagado=true cuyo
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

**Sin hacer:** «Cómo funciona» del tablero y /mako-partners siguen prometiendo que el crédito «se descuenta de tus próximos
meses» y el 20% del grupal, que no se aplican (decisión de Martín, pendiente). **Vive en:** app/_components/nav.ts ·
app/partners/ · app/m/partners/ · lib/partners-programa.ts (`resumenDelPrograma`) · lib/partners-reglas.ts (`contarPrograma`) ·
tests/partners-para-clientes.test.ts · tests/sidebar-nueva.test.ts.

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
