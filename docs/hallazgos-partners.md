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
