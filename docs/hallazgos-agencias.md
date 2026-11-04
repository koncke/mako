# Hallazgos — Agency Dashboard (/agency)

Lo que no se ve leyendo el código de Agency Dashboard: la agencia que abre las cuentas de MaKo de SUS clientes, las
administra y elige quién paga cada una. El pedido textual, en [feedback-25-10-tarde.md](feedback-25-10-tarde.md) punto 9.
La historia anterior de la cartera (de cuando vivía en /partners), en [hallazgos-partners.md](hallazgos-partners.md) y
[hallazgos-customer-success.md](hallazgos-customer-success.md); la seguridad del «Entrar como», en
[hallazgos-seguridad.md](hallazgos-seguridad.md) → «Vista de agencia».

## Joan no podía agregarse al grupo de un cliente: la puerta estaba abierta, faltaba el renglón (ticket #49, 3/11/2026)

- **Síntoma:** «no puedo ver las notificaciones dentro de la cuenta de un cliente para agregar un número de WhatsApp al
  grupo de MaKo».
- ⚠️ **El diagnóstico obvio era el equivocado:** todo apuntaba a un permiso (la tab solo-superadmin, la puerta del
  servidor, `agregarParticipanteGrupo`). Medido con la sesión de una agencia sobre el código real
  (`tests/_agencia-grupos-hijo.ts`): `getRolWsEfectivo` da `admin`, `getWorkspaceActual` da el cliente, el GET y el POST
  de `/api/perfil/destinatarios` andan, la cartera aísla y la invitación sale. **Por URL directa funcionaba.**
- **Causa real:** `seccionesCuenta` (`lib/ajustes-secciones.ts`) esconde «Notificaciones» mirando a otro, porque «los
  avisos son de quien mira». Era cierto hasta el 25/10, cuando «Notificaciones» del negocio salió del índice por estar
  dos veces y se mudó adentro de la de «Tu cuenta». El filtro siguió con su regla y dejó sin entrada a la agencia y al
  super admin. **Mudar una sección de grupo cambia para quién vale el filtro del grupo de destino.**
- **En el teléfono no hay entrada para NADIE** a `/m/configuraciones/notificaciones`: el índice sale de
  `seccionesNegocio`, que ya no la tiene. Se abrió mirando a un cliente; el resto, abajo en «sin hacer».
- **Trampa: la cookie de la agencia dura 8 horas (`AGENCIA_HORAS`) y al vencer el pedido cae, sin error, en la cuenta
  PROPIA de la agencia.** La pantalla seguía mostrando al cliente, y guardar pisaba `notif_telefonos` de la agencia y
  sumaba al cliente al grupo de la agencia. Ahora la pantalla manda de qué `ws` leyó y el server contesta 409. **Vale para
  todo guardado de agencia con la pestaña vieja:** esta ruta es la única cerrada (abajo).
- **Lo que hay que saber antes de agregarse:** el renglón agrega a `notif_telefonos`, no sólo al grupo, así que ese número
  también recibe lo que se reparte por esa lista. Y en un cliente **con la lista vacía**, el número pasa a ser el
  principal: `mako.numero_dueno`, `user_telefono` y el teléfono del comprador en el CRM de la plataforma.
- **Medido el 3/11 en producción (sólo lectura):** Joan ya está en la lista de 5 de sus 7 clientes (15, 18, 19, 20, 22). Le
  faltan Marcela (23, con grupo) y Giselle (17, sin grupo ni número). ⚠️ Florencia (21) aparece como cliente suyo en notas
  viejas y **no está en `agencia_clientes`**.

### El equipo de la agencia entra solo al grupo que nace

- ⚠️ **«Las personas del equipo que tengan teléfono» daba NADIE en producción.** El único usuario de la única agencia tiene
  `perfil.telefono` vacío; su número vive en `mako.numero_dueno` de la agencia. Con la lectura literal, el automático no
  invitaba a nadie, sin error. Por eso entran los dos: el número principal de la agencia y el perfil de cada admin. Es el
  caso de `telefonosDelEquipo` (`lib/agencia-equipo-grupo.ts`).
- **Closer y setter de la agencia NO entran, y es a propósito:** a ese grupo llegan los reportes de ventas, gasto y montos del
  cliente, y la auditoría del 14/10 cerró que un closer se sumara a él. Tampoco `notif_telefonos` de la agencia, que puede
  traer a un contador: sumarlo lo metería en todos los clientes.
- **El equipo no entra a `notif_telefonos` del cliente.** Va sólo al grupo: no le aparece en Notificaciones ni recibe sus
  reportes por DM. **Quien se agrega a mano desde la pantalla sí queda en esa lista**: son dos caminos con efectos distintos.
- **`lineaDeLaAgencia` dice lo que pasó:** «Sumé» si alguien entró, «Invité» si WhatsApp no dejó, nada si no hubo nadie. Va
  adentro de la bienvenida, un solo mensaje. Sin nombre de agencia no se afirma nada.
- **El `id` de un participante es un `@lid` que parece un teléfono:** leerlo como número daba a alguien como ausente y
  se lo volvía a agregar. El número sale de `phoneNumber`; quien no lo trae contesta 409 al agregarlo y no se anuncia.
- **El tope de la línea (5 contactos nuevos por cliente y por hora) lo comparte con el dueño.** Una agencia con 7 admins
  deja 2 afuera; el resto toma el comando, que sólo mira a quienes faltan.
- **Medido el 3/11 con el comando, sólo lectura, contra los grupos reales:** Joan ya está en 15, 18, 19, 20 y 22. Falta entrar a
  uno, **Marcela (23)**; Giselle (17) no tiene grupo y entra sola cuando nazca. Para la agencia 13:
  `node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/agencia-equipo-a-grupos.mts --agencia=13 --aplicar`.
  ⚠️ Escribe en un grupo de un cliente: necesita el sí de Martín, y correrlo con el código ya desplegado.

### Sin hacer

- **Un cliente que paga él mismo puede tener el grupo antes de la aprobación:** la cartera queda `pendiente` hasta el pago
  y `agenciasAprobadasDe` no la cuenta, así que el equipo no entra y nada lo vuelve a intentar al aprobarse. La salida hoy es
  el comando; lo definitivo es llamar a `aplicarEquipoDeAgencia` desde `lib/agencia-habilitar.ts`. No medí cuántos caen ahí.
- **El admin de un negocio, en su propia cuenta y por teléfono, sigue sin entrada** a a quién le avisa MaKo:
  `app/m/cuenta/page.tsx` sólo la agrega mirando a otro, porque «Tu cuenta» ya tiene una fila «Notificaciones» y Martín ya
  marcó el duplicado una vez. Hay que elegirle un nombre.
- **La pestaña vieja en el resto de los guardados de agencia:** el corte es general (`resolverDesdeCookies`). Sólo
  `/api/perfil/destinatarios` compara el `ws`. Lo general sería renovar la cookie o avisar al vencer.

## Una función contestaba DOS preguntas, y su `null` abría la puerta (P15, 30/10/2026)

- **Síntoma:** las dos pantallas de Agency preguntaban `if (!esSuper && (await agenciaDeCliente(ws))) redirect(...)`
  (`app/agency/page.tsx:58`, `app/m/agency/page.tsx:50`). El cliente de DOS agencias entraba al Agency Dashboard.
- **Causa real, y no es «falta una guarda»:** la guarda estaba. Lo que estaba mal es **con qué preguntaba**.
  `agenciaDeCliente` contesta **QUIÉN** es el dueño, así que necesita que haya exactamente uno: con dos dueños devuelve
  `null` a propósito y bien («elegir el primero sería inventar un padre»). Arriba, ese `null` se leía como «no es
  cliente de ninguna agencia». Una función que contesta «quién» usada para preguntar «si» convierte toda ambigüedad en
  un permiso.
- **El `null` significaba TRES cosas y las tres se leían como «no»** — medido, no supuesto
  (`tests/_agency-dos-duenos-hijo.ts`, las funciones reales contra un PostgREST de mentira):

  | lo que pasaba | `agenciaDeCliente` | entraba |
  |---|---|---|
  | no tiene ningún dueño | `null` | sí (el único caso que se quería dejar pasar) |
  | tiene DOS dueños aprobados | `null` | **sí** |
  | tiene DOS dueños PENDIENTES | `null` | **sí** (`esCarteraVigente` cuenta pendiente como dueña) |
  | **no se pudo leer la cartera** | `null` | **sí** |

- ⚠️ **Y acá el diagnóstico obvio era el equivocado.** P15 estaba anotado como riesgo **latente** («hoy ningún cliente
  tiene dos agencias»), y por eso nadie lo agarró. Pero la rama que se abre con la base caída **no espera a nada**:
  `agenciasDeCliente` atrapa el error y devuelve `[]`, así que una lectura fallida ya daba `null` hoy, sin ningún
  cliente de dos agencias. Lo latente era un cuarto del hallazgo; el resto estaba vivo.
- ⚠️ **Lo que se abría NO era una fuga de datos entre clientes**, y conviene decirlo porque el 30/10 ya se dijo mal una
  vez (se infló «una guarda que falta» a «fuga») y después hubo que desdecirlo. La pantalla dibuja la cartera **del que
  mira**, que para un cliente está vacía: no hay datos de otro inquilino en juego. Lo que se rompía es la regla de
  producto («MaKo no les va a enviar promociones»): el cliente de una agencia veía el programa y podía sumarse como
  Agency. Es grave por lo que habilita, no por lo que muestra.
- **La regla que queda:** `agenciaDeCliente` **DICE**, `esClienteDeAgencia` **DECIDE**.
  - Para decidir una pantalla, un permiso o un candado se pregunta `esClienteDeAgencia` (`lib/agencia.ts`), que contesta
    sí/no/**no sé** (`boolean | null`) y no depende de que el dueño sea uno.
  - **El «no sé» no es «no»**, y por eso se compara contra `false` (`if (deAgencia !== false) redirect(...)`) y nunca por
    verdad. Un `if (deAgencia)` vuelve a leer el «no sé» como «no»: es el molde exacto del bug.
  - Un `[]` o un `null` que significan a la vez «no hay» y «no pude leer» obligan a quien decide a elegir uno, y siempre
    se elige el cómodo. Si de una lectura cuelga un permiso, el error se propaga (`leerCarteraDeCliente` devuelve `null`
    al fallar); el `[]` se queda para lo que sólo **dibuja**.
  - La lista de quién llama a `agenciaDeCliente` está **cerrada en un test** (`tests/agency-dos-duenos.test.ts`): hoy son
    tres y las tres arman un texto o una URL de salida (`lib/vista-de-otro.ts`, `lib/movil-guard.ts`, `lib/agency.ts`).
    Un llamador nuevo rompe el test, y ahí se elige si DICE o DECIDE.
- **El caso no existe en los datos, así que se arma en el test.** Esperar a que un cliente real tenga dos dueños es
  esperar a que el bug cobre. Con DOS agencias (la real, ws 13, y una de mentira): con una sola, un guard que ignore
  `agencia_ws` pasa todas las pruebas que se le hagan.
- **Trampa del entorno, nueva:** `git checkout -- <archivo>` para deshacer una rotura **borra el arreglo** mientras
  todavía no está commiteado — HEAD es la versión con el bug. En un «probá rompiéndolo» sobre trabajo sin commitear hay
  que restaurar desde una copia (o commitear primero). Perdí los dos arreglos de las pantallas así, en silencio: los
  tests volvieron a pasar porque también se había revertido lo que los hacía fallar.
- **Trampa del entorno:** un worktree nuevo no tiene `node_modules` y `ln -s` **copia** en Git Bash (con el disco al
  95% no es una opción). Va una junction de Windows: `cmd /c mklink /J <worktree>/node_modules <otro>/node_modules`,
  después de comprobar que los dos `package.json` son idénticos.

## La misma función nació DOS veces el mismo día, y el merge se vio limpio sin compilar (30/10/2026)

- **Síntoma:** mergear `nube/agency-dos-duenos` sobre el tren salió **sin un solo conflicto en el código** y el árbol no
  compilaba: `lib/agencia.ts:304 — Multiple exports with the same name "esClienteDeAgencia"`.
- **Causa real:** `esClienteDeAgencia` se escribió dos veces el 30/10, por dos chats que no se veían — acá para la
  puerta de /agency (saliendo de `origin/main`) y el 29/10 en `agency-thiago-2910` para lo que MaKo le deja de ofrecer
  al cliente de una agencia (Thiago: «yo no me meto con ese cliente»). **Los dos bloques caen en lugares distintos del
  archivo, así que git los une sin conflicto**: no hay nada que resolver y el resultado no compila.
- ⚠️ **Y el choque no era de nombre, era de CRITERIO**, que es lo que importa: la del tren devolvía `boolean` y resolvía
  «no se pudo leer» como **`false`** (su propio comentario lo decía: «No se pudo leer = no»). Para un upsell eso
  esconde de menos; **para una puerta, `false` DEJA ENTRAR**. O sea que tenía el mismo bug que este trabajo vino a
  cerrar, en la otra forma. Lo que sí tenía bien, y conviene decirlo: su `.some(esCarteraVigente)` ya contestaba bien
  con DOS dueños — lo único que colapsaba era la lectura fallida.
- **La regla que queda, y es la que decidió el Cerebro:** **UNA sola función con el tri-estado**, y **cada uso resuelve
  el `null` por el lado seguro de SU pregunta**. Medido al unificar: hay **NUEVE** usos (no cuatro) y **los nueve lo
  resuelven igual, como «sí, puede ser de una agencia»** — lo que cambia es la CONSECUENCIA, no la lectura:
  - cinco son PUERTAS y con `null` **no entra** (`app/agency/page.tsx`, `app/m/agency/page.tsx`,
    `app/partners/page.tsx`, `app/m/partners/page.tsx`, y hacerse partner por la API en `lib/partners-programa.ts`);
  - tres son UPSELLS y con `null` **no se ofrece** (`app/configuraciones/plan/page.tsx`, `app/m/mas/page.tsx`,
    `app/no-esta-en-tu-plan/page.tsx`);
  - una es la FRONTERA que alimenta a la barra (`cuentaActualEsDeAgencia`, `lib/vista-de-otro.ts`): resuelve el `null`
    ahí y sigue devolviendo `boolean`, porque lo que sale va como JSON al navegador y no puede tener tres estados.
- ⚠️ **Yo había escrito lo contrario y estaba mal.** La versión anterior de esta sección decía que para un upsell el
  `null` «no debe apagarlo», razonando que esconder una oferta también cuesta. El criterio es el opuesto: **ofrecer de
  menos por una falla de la base cuesta una venta; ofrecer de más le rompe el trato a la agencia, y eso no se
  deshace.** Queda anotado porque es la clase de cosa que se «simplifica» de vuelta.
- **Lo que lo habría cazado, y ahora existe** (`tests/agency-dos-duenos.test.ts`): que `esClienteDeAgencia` se declare
  **UNA** vez, que su tipo sea `Promise<boolean | null>`, y que los nueve usos resuelvan el `null` —con un escáner de
  paréntesis balanceados, probado contra las cuatro formas del bug, porque una regex `[^)]*` no puede leer
  `esClienteDeAgencia(await getWorkspaceActual())` y daba un falso rojo.
- ⚠️ **Trampa: el segundo rompimiento estaba tapado por el primero.** `cuentaActualEsDeAgencia` declara
  `Promise<boolean>` y devolvía la función directo: con el tri-estado eso también es un error de tipos, y **no se veía**
  porque el doble export aborta antes. Al resolver un choque así hay que buscar los consumidores que DECLARAN el tipo
  viejo, no sólo el que grita.
- **La regla general:** dos ramas pueden agregar **el mismo export** en lugares distintos de un archivo y git no lo
  llama conflicto. Si dos chats pueden estar escribiendo la misma pregunta, el guard no es el merge: es un test que
  cuente las declaraciones.

## ⚠️ P14 no vive en `main`: los archivos de plata de Agency están en otra rama (30/10/2026)

- **El síntoma:** `docs/pendientes.md` manda P14 a `lib/agencia-plan.ts`, `lib/agencia-baja.ts` y
  `lib/plan-acceso-reglas.ts`. En `origin/main` los **dos primeros no existen**, y quien los busque desde main no
  encuentra nada y puede concluir que ya se arregló.
- **Dónde está de verdad:** la rama **`agency-thiago-2910`** (punta `fb72e2e18`, worktree `C:/dev/wt-agency`). Medido:
  `git merge-base --is-ancestor 28cc3e2cb origin/main` → **NO**; el merge-base es `4b8f8145d`. El informe de plata
  (`C:/dev/revisiones/2910-reverificacion-plata-agency-28cc3e2cb.md`) y sus números de línea son de esa rama.
- **Qué hay y qué no hay en main**, para no volver a medirlo:
  - `lib/agencia-plan.ts`, `lib/agencia-baja.ts` → **no están** (ni en `origin/integracion`). La MEDIA de P14 (pausar o
    rebajar el negocio de Mauricio o un Pro directo cargado a mano en una cartera) **sólo se puede arreglar ahí**.
  - `lib/plan-acceso.ts` y `lib/plan-acceso-reglas.ts` **están, pero sin H5**: en main no hay `al-dia` ni `soltar`, así
    que las dos BAJAS de H5 (levanta el corte de más; la pausa programada no se enteró) **no existen en main**.
  - `app/agency/AgencyApp.tsx` está, con **cero** menciones de «Esencial», «Elegir Pro» y «Pasar a Pro»: la BAJA del
    diálogo de ida tampoco existe en main.
  - `lib/cobros.ts` **es el mismo**: `anularCobro` en `:1318` y `cancelarSuscripcionCobro` en `:1603`, los dos números
    exactos del informe. Lo de ahí sí se arregla desde main (abajo).
- **La regla que queda:** un pendiente que nombra archivos tiene que nombrar **en qué rama** viven si no están en main.
  Un `docs/pendientes.md` que viaja en una rama de feature describe el árbol de ESA rama, no el de quien lo lee.

## Ser agencia ERA tener el plan Pro, y nadie lo había pedido (25/10/2026)

- **Síntoma que no se veía:** `esAgencia` miraba sólo la capa `agencia`, y esa capa es la del plan **MaKo Pro de US$97**
  (`lib/planes-mako.ts`: `id: 'pro', capa: 'agencia'`). O sea que todo el que comprara Pro quedaba agencia, con su
  cartera y su botón de abrir cuentas, sin pedirlo. No había pasado porque el único con Pro es Código Inmobiliario (ws 13).
- **Lo obvio era una migración con una columna o un flag nuevo. No hacía falta:** la tabla `agencias` (mig 0176) seguía
  viva en producción con la fila del ws 13. El 27/09 se había dejado de leer porque Martín dijo que la agencia «es el
  plan». El 25/10 pidió lo contrario: «que te puedas sumar como "Agency", solo para los que tengan su plan de 97
  activo». Ahora **ser Agency es el plan Y la fila**. Sumarse escribe la fila; bajar de plan apaga la Agency sin borrarla.
- **Medido en producción antes de cambiarlo (lectura):** la única con la capa es el ws 13, y tiene su fila. Nadie perdió nada.
- **Vive en:** `lib/agencia.ts` (`esAgencia`, `agenciasHabilitadas`, `anotarAgency`), `lib/agency-reglas.ts`
  (`puedeSumarseComoAgency`), `lib/agency.ts`.

## Quién paga cada cliente vive en la cuenta DEL CLIENTE, sin migración (25/10/2026)

- La opción «la paga mi cliente» se guarda en `app_settings` del **workspace del cliente** (`agency.quien_paga`). Sin la
  clave, paga la agencia: es lo que pasaba con todas las cuentas abiertas antes.
- **Por qué ahí y no en `agencia_clientes`:** el cartel de pago lo lee el propio cliente con SU sesión, sin cruzar de
  inquilino. Y no existe una ruta genérica para escribir `app_settings`: cada clave la escribe su código. Por eso el
  cliente no puede pasarse a «paga la agencia» para saltear el cartel.
- **La agencia lo lee de todas sus cuentas en una sola consulta** (`quienPagaDeClientes`, service role, sólo esa clave).

## «Paga el cliente» invierte cuándo sale el acceso, y eso abría una cuenta gratis (25/10/2026)

- Antes el admin del cliente se creaba **sin avisarle**, y el acceso salía al habilitarse la cuenta: con el pago de la
  agencia o con la firma de Martín (`lib/agencia-habilitar.ts`). Si paga el cliente, eso no sirve: el cliente tiene que
  entrar para hacer su onboarding, que es cuando le aparece el pago. Ahora el acceso sale **al crear la cuenta**.
  `invitarPorEmail` marca `invitacion_enviada_at`, así que la habilitación no se lo vuelve a mandar.
- **La trampa:** si la agencia también pudiera entrar antes del pago, una agencia podría abrir cuentas sin pagar y
  usarlas desde su lado. Por eso la cartera queda `pendiente` hasta que el cliente paga, y el «Inspeccionar» no aparece.
- **El cartel del primer mes no se cierra** (lo único que ofrece es cerrar sesión). El de la renovación sí se cierra,
  porque su mes ya está pago. Reglas: `cartelDePago` (lib/agency-reglas.ts). Ruta: `/api/agencia/mi-pago`, que nunca
  contesta al super admin ni a una agencia mirando. Pantalla: `app/_components/CartelPagoCliente.tsx`, en el layout.
- **El link de un primer mes que paga el cliente va a SU email** (`linkPrimerMes` con `email: correo`). El cron de las
  renovaciones le pide la suscripción a ese mismo email, así que la renovación también la autoriza él.

## Los tests de «Partners» eran de la cartera de agencia (25/10/2026)

- `tests/partners.test.ts` cubría la cartera de la agencia (de cuando MaKo Partners ERA eso). Al mudarse la cartera, el
  archivo se mudó entero: ahora es `tests/agency.test.ts`. Los tests del programa de referidos están en
  `tests/partners-para-clientes.test.ts` y vecinos.

## Trampas del entorno (25/10/2026)

- **Los archivos del worktree son CRLF** (core.autocrlf). Un script que reemplaza un texto de VARIAS líneas escrito con
  `\n` no lo encuentra, y el «rompe y cuenta» decía «aparece 0 veces» en vez de romper. Primero hay que normalizar el fin
  de línea y después restaurarlo. Además, un heredoc de Bash se come las barras de `'\r\n'`.
- **Playwright:** `ms-playwright/chromium-1243/chrome.exe` no está firmado y Windows lo bloquea («spawn UNKNOWN»). Anda
  `chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe` como `executablePath`, con Bash
  sin sandbox. Para referencias de un SaaS de suscripciones, `demo.baremetrics.com` es la app real, pública y sin login.

## Lo que quedó SIN hacer

- **«MaKo no les intentará hacer upsells» a los clientes de una agencia:** /agency ya no se les muestra, pero siguen
  viendo los avisos de tope con «Pasar a Pro» (`lib/topes-plan.ts`, `app/crm/PasarAPro.tsx` y los demás que usan
  `textoTope`), la fila de MaKo Partners y el cartel de la prueba. Falta un `esClienteDeAgencia` que los apague.
  → 29/10: MaKo Partners, «Recomienda MaKo», «Tu plan» y los candados de la barra ya no; los carteles de tope siguen (abajo).
  → 30/10: `esClienteDeAgencia` quedó UNA, con el tri-estado, y **los nueve usos resuelven el «no sé» como SÍ**
  (`!== false`). Un cartel de tope nuevo que la use copia ese idioma; lo fija `tests/agency-dos-duenos.test.ts`.
- **P14, la MEDIA y las BAJAS de H5: no se pueden tocar desde `main`** (ver la sección de arriba). Viven en
  `agency-thiago-2910`:
  - MEDIA — `darDeBajaClienteDeAgencia` (`lib/agencia-baja.ts:81`) y `cambiarPlanDeCliente` (`lib/agencia-plan.ts:70`)
    no miran **qué** negocio es: una fila de cartera cargada a mano sobre el ws1 o sobre un Pro directo deja que la
    agencia lo pause o lo rebaje. Falta la guarda de «es la plataforma» y de «tiene plan propio» en esas dos, y
    `negocioPausado` (`lib/workspace.ts:340`) sin guarda del ws1.
  - BAJA — H5 levanta el corte con cualquier tramo `cubierto` (`lib/plan-acceso-reglas.ts:353`): lo justo es aceptar
    «pagado + `suscripcion_estado` null» y no un plan cancelado o devuelto que todavía cubre días.
  - BAJA — la pausa programada sigue pidiendo `al-dia` (`lib/plan-acceso.ts:166`), así que no se enteró de H5.
  - BAJA — «Elegir Esencial» sin cobros es de ida y el diálogo no lo avisa (`app/agency/AgencyApp.tsx`).
  - BAJA — `aplicarSubidasPendientes` lee la marca con `.limit(2000)` (`lib/agencia-plan.ts:197`) y ahora toda cuenta
    nueva tiene marca: pasadas las 2.000, una subida pendiente se queda afuera sin decirlo.
- **`anularCobro` todavía cierra el link viejo con mejor esfuerzo** (`lib/cobros.ts:1318` → `cerrarLinkEnLaPasarela`,
  que nunca tira): un link anulado que la pasarela no cerró puede seguir cobrable. Está en `main` y quedó sin tocar.
- **El TERCER lugar que decide con el `null` de `agenciaDeCliente`: el cartel de pago del cliente**
  (`cartelDelCliente`, `lib/agency.ts:128`). Anotado y sin arreglar, a propósito. Con dos dueños devuelve `null` y el
  cliente que paga él mismo **no ve su cartel de pago** — acá el `null` esconde en vez de abrir, así que es el daño
  opuesto al de las pantallas y es acotado (la agencia sí ve en su dashboard que falta el pago).
  ⚠️ **No se arregla cambiando a `esClienteDeAgencia`**: lo que sigue necesita UN dueño de verdad, el nombre para el
  texto y `cobrosDeClientesDeAgencia(agencia.ws)` para saber si ya pagó. Con dos hay que DECIDIR de cuál se leen los
  cobros (o de las dos) y cómo nombrarlo sin inventar un padre («tu agencia»). Es producto, no un cambio mecánico.
- **Cambiar quién paga una cuenta ya abierta:** hoy se elige sólo al abrirla.
- **Código muerto de Partners** (lo limpia Planes, que reescribió /partners y /m/partners): `PartnersApp` (la parte de
  la agencia), `LlevarAPartners.tsx` y `app/m/partners/PartnersM.tsx`. Ojo: `app/partners/EquipoDeCuenta.tsx` NO está
  muerto, porque lo usa `app/agency/AgencyApp.tsx`.

## La plantilla del modelo de negocio: la base de una cuenta en un clic (MAU-01, 27/10/2026)

- **El pedido:** Mauricio (14/10): «una base tipo copy paste que disminuya mi intervención de iniciar de cero», para sus
  tres modelos de cliente: tienda B2C (Texx, Baja Teriyaki), B2B con CRM (HMO) y manufactura (Aspro, Sibelco). Martín
  propuso hacerlo con plantillas DENTRO de MaKo y una guía para cargar los datos. Eso cambió el roadmap de CS, que
  decía que el tablero vive afuera (app/admin/dev/customer-success/roadmap-cs.ts, con la fecha).
- **Qué arma** (lib/plantillas-modelo-reglas.ts): el funnel con las etapas de ese modelo, el tablero (el objetivo del
  trimestre y 4 KPIs semanales en Objectives) y un proyecto «Arranque · <modelo>» en su Plan, con la guía como tareas.
  Se aplica desde la ficha de cada cuenta del Agency Dashboard (la computadora y el teléfono) o por la API
  (`aplicar_plantilla_de_modelo`, con `clienteWs` para una agencia).
- **Lo que no se ve y hay que respetar:**
  - **Sin IA, un proyecto que no existe manda la tarea a «Sin proyecto».** `agregarTareasPlanOwner` con `sinIA` resuelve
    el destino con `destinoSinIA` (lib/plan-bandeja.ts): sólo sirve un proyecto que ya existe, uno del catálogo o el del
    cliente de la reunión. Por eso la plantilla crea el proyecto ANTES que sus tareas.
  - **Las etapas usan las claves canónicas** (`lead`, `conversando`, `agenda`, `agendaj2`, `facturando`, `ganado`) con su
    rótulo. Con una clave inventada, el CRM dibuja al lead en la primera columna (el molde es `FUNNEL_TEMPLATES`).
  - **Se lee todo antes de escribir, y «no pude leer» no escribe nada.** Con una lista vacía por error, aplicarla
    duplicaría el funnel, el objetivo y la guía. Aplicarla dos veces no duplica: se compara por nombre, sin tildes ni
    mayúsculas.
  - **Sin números:** la meta y el compromiso quedan en 0, que el tablero dibuja «sin datos», hasta que el cliente pone
    los suyos (el primer paso de la guía). El funnel nace principal sólo si la cuenta no tiene uno.
- **Lo que quedó SIN hacer:**
  - **La prueba en el ws3:** es escritura en producción, y el permiso de este chat no la dejó correr. El script es
    `scripts/tmp-captura-customers/probar-plantilla-ws3.mts`, en el worktree de Agencias, sin commitear: aplica la de B2B
    dos veces y muestra lo que quedó. La segunda vez tiene que decir «ya estaba aplicada».
  - **Para que Mauricio la use**, ws1 tiene que ser Agency y cada cliente tener su cuenta de MaKo: la plantilla se le
    aplica a una cuenta, no a un cliente del CRM.

## La plantilla Inmobiliaria: sin reuniones, y su hoja del Dashboard (MK-15, 27/10/2026)

- **El pedido:** Joan (Código Inmobiliario, documento «DeadlinesMakoxJJ», 25/09 y 05/10). Sus clientes captan
  propiedades con campañas a formulario y cierran en persona: «me pone lo de R1 Y R2. En el caso de los inmobiliarios
  esa lógica no se utiliza». El Dashboard estaba pensado para un VSL (Impresión → Click → Landing → VSL) y no les sirve.
- **El funnel:** Formulario → Calificado → Tasación / pre listing → Captación, sin ninguna etapa de reunión. La
  tasación es una etapa propia (la clave `st0`, como las que acuña el editor del CRM) con `kind: 'paso'` y
  `marcadaComo: 'etapa'`. Se llega a ella moviendo el lead a mano, como a `conversando`: `pipeline_stage` manda sobre lo
  derivado cuando la etapa está en el funnel (`etapaVigenteDe`), y `kind: 'paso'` no pide requisitos.
  ⚠️ `agenda` con `kind: 'reunion'` (lo que hace la plantilla `presencial`) traía justo las R1 que Joan no quiere.
- **La hoja del Dashboard (`HOJA_INMOBILIARIA`):** Inversión, Impresiones, Clics y Formularios arriba; el embudo de
  marketing y el comercial (Leads → Calificados → Captaciones) al lado; y los leads por etapa, que es donde se ven las
  tasaciones.
- ⚠️ **Joan pidió Alcance, Visualizaciones y Clics salientes, y MaKo no los guarda.** El alcance existe sólo en vivo y
  sin total (la fuente `audiencia`), y las visualizaciones de video y los clics salientes no se sincronizan de Meta. La
  hoja trae Impresiones y Clics, con esos nombres: rotular «Alcance» a las impresiones sería un número falso con el
  nombre correcto. **Sin hacer:** sumar esas tres métricas a la sincronización de Meta; es del área de Ads.
- **El Dashboard es por persona** (lib/graficos-tablero.ts). La hoja va primera en el informe de cada persona del equipo
  de la cuenta, con el compare-and-set de la API, así que a quien está editando su informe no se le pisa. A quien la
  archivó no se le revive (`conHojaDeModelo`).
- **Lo que pidió Joan y queda afuera de la plantilla:** el WhatsApp único al inmobiliario cuando entra un formulario (es
  una automatización) y el filtro por creativo.

## «Puede mostrar datos de otro cliente» no era una fuga, y atrás había dos defectos de verdad (30/10/2026)

- **Síntoma:** Agency salió del tren con un rojo en `tests/inspeccionar-primer-cuadro.test.ts`: `/api/auth/me` sumaba `agenciaDeCliente(ws)`, «una segunda cuenta de "a quién se mira" puede nombrar a otro cliente». En el pase de manos se volvió «puede mostrar datos de otro cliente».
- **El diagnóstico obvio era el equivocado.** Medido con dos agencias, sus clientes y cuarenta pedidos intercalados sobre el código real, y en producción con los negocios de Código Inmobiliario: esa línea era un sí o un no sobre el MISMO negocio, y no nombraba a nadie. No hubo fuga. **Una guarda en rojo dice qué regla se rompió, no qué daño hizo: medir antes de llamarlo fuga.** Igual se sacó, porque la regla es buena.
- **Lo que sí estaba mal:**
  - **El cliente de DOS agencias seguía viendo MaKo Partners y «Pasar a Pro».** `agenciaDeCliente` contesta null con dos dueños: es lo correcto para la cadena (no inventar un padre), no para «¿la maneja una agencia?». Son dos preguntas: nació `esClienteDeAgencia`.
  - **La agencia veía el plan de las cuentas no aprobadas, también de las que dio de baja.** Ya no son suyas, y el cliente puede haber elegido su plan. La regla, en `planQueVeLaAgencia`: la capa sólo de las aprobadas; de una pendiente, lo que eligió la propia agencia (sin eso no puede corregirlo antes de pagar); de una dada de baja, nada.
- **«Faltan las zonas de México» tampoco era eso:** las zonas estaban. El barrido de `tests/zona-negocio.test.ts` no conocía esa lista como un dato.
- **Trampa del arnés:** `mock.module` con `namedExports` tiene que declarar TODO lo que importan los demás, o el módulo no carga. `tests/_agencia-dos-negocios-hijo.ts` lee los nombres de la fuente y deja de mentira los que no usa.

**Sin hacer:**
- `app/agency/page.tsx` y `app/m/agency/page.tsx` siguen preguntando con `agenciaDeCliente`: con dos dueños, ese cliente entra al Agency Dashboard. Hoy ningún cliente tiene dos (docs/pendientes.md, P15). `cartelDelCliente` (`lib/agency.ts`) la usa bien: necesita UNA agencia para leer sus cobros.
- De la re-verificación de plata de 28cc3e2cb (`C:/dev/revisiones/2910-reverificacion-plata-agency-28cc3e2cb.md`), sin tocar: la MEDIA de una fila de cartera cargada a mano sobre un Pro directo, las tres BAJAS y lo abierto desde antes (docs/pendientes.md, P14).

**Vive en:** `lib/agencia.ts` · `lib/vista-de-otro.ts` · `lib/agencia-cobro-reglas.ts` · `tests/agencia-dos-negocios.test.ts`.

## Lo prometido a Thiago: dar de baja, el plan de cada cuenta y el cobro por país (29/10/2026)

La llamada con Thiago (agencia de España, 27 clientes; reunión del 5/11): docs/promesas/2910-llamada-thiago.md, lo marcado
*(Agency)* y *(Planes y Partners)*. Chat «Suscripción y Partners», cuenta 3. Pasó una revisión adversarial de plata en tres
pasadas (un revisor sobre 33c131f6b, 13 hallazgos; el mismo sobre los arreglos, 5 nuevos; y una corta, 3 más). Lo
arreglado lo fija tests/revision-plata-agency-2910.test.ts. Después, una **verificación independiente** de otro chat sobre
4b42b6a7f (C:/dev/revisiones/2910-verificacion-plata-agency-4b42b6a7f.md): H1, H2 y H3, en
tests/verificacion-plata-agency-2910.test.ts.

- **«Dar de baja» no borra nada ni deja la cuenta gratis** (`darDeBajaClienteDeAgencia`, lib/agencia-baja.ts). Primero la
  plata: se cancela en la pasarela TODA suscripción viva de esa cuenta (`esSuscripcionViva`: la marcada `activa`, que es la
  pagada, la autorizada sin cobrar, la fallida y la del primer pago devuelto, y TAMBIÉN la pagada sin `suscripcion_estado`,
  porque ese estado lo marca sólo un aviso que trae el id de la suscripción). Se anula lo que todavía se podía pagar. Si algo
  falla, se frena ahí. Después la pausa y su corte, y recién al final se revoca la cartera (eso corta «Inspeccionar»:
  `puedeEntrar` sólo mira `aprobado`). Revocada primero, una falla al guardar el corte no se podía reintentar: la segunda
  vez contestaba «ya estaba». La regla, pura: `queHacerEnLaBaja` (lib/agencia-cobro-reglas.ts).
- **El diagnóstico obvio era el equivocado: «la baja pausa la cuenta».** La baja escribía `workspaces.estado = 'pausado'`,
  pero con el corte por pago APAGADO (`CORTE_DE_ACCESO_PRENDIDO = false`) `negocioPausado` no mira ese estado: toda cuenta
  dada de baja seguía usando MaKo gratis, completa y ahora sin topes. El corte `sin-agencia` vale aunque el general esté
  apagado (lib/workspace.ts), y con el general apagado el cron sólo mira esas cuentas, para reabrirlas (lib/plan-acceso.ts).
- **Trampa: la cuenta soltada se reabría con el mes que había pagado la agencia.** La vigencia se mide con TODOS los cobros
  del lugar, y los de la agencia (`cliente_ws`) la daban al día hasta fin de mes. El primer arreglo («`sin-agencia` sólo se
  levanta con la vigencia al día») no alcanzaba: estaba al día por la agencia. Ahora la vigencia de esa cuenta (y la de un ex
  cliente que ya paga su plan) sale sólo de SUS cobros (`alta_ws` y sin `cliente_ws`).
- **Si la cuenta la pagaba el CLIENTE, la baja no le corta su plan.** Su suscripción viva pasa a ser suya (`alta_ws`, sin
  `agencia_ws` ni `cliente_ws`) y la cuenta sigue abierta. Si sólo había pagado el primer mes, la pausa queda PROGRAMADA
  para el fin de ese mes (`finDeLoQuePago`, el corte con `cobroId: -1`) y la pone el cron ese día. Marcarla pausada en el
  acto apagaba los crons de la cuenta (sincronizaciones, grabadores) los días que ya había pagado. Antes se le cancelaba lo
  que había pagado y se le cobraba otro mes entero desde ese día.
- **Reactivar no tenía de dónde partir:** `reactivarPlan` arma el cobro sobre el último plan del negocio, y el cliente de
  una agencia nunca tuvo uno. `primerPlanPropio` (lib/compra-plan.ts) le arma la suscripción con el plan de su capa, con la
  pasarela de SU país (`pasarelasDelPais`), y SÓLO si ya no tiene agencia: con la agencia pagando, MaKo cobraba dos veces.
- **El plan de cada cuenta ES su capa** (`CAPA_DE_PLAN`: Esencial → `completo`, Pro → `agencia`). Cambiarlo
  (`cambiarPlanDeCliente`, lib/agencia-plan.ts) toca la pasarela primero y la capa al final.
- **Trampa: «se puede tener Pro pagando Esencial».** Con el precio nuevo desde el próximo cobro, pasar a Pro después de cada
  cobro y volver antes del siguiente pagaba siempre 47. **El primer arreglo era el equivocado: «un cambio cada 30 días»**;
  con Mercado Pago alcanzaba igual para Pro la mitad de los meses, y en el primer mes regalaba uno. La regla que quedó: Pro
  se tiene cuando se PAGA a precio de Pro. Subir con Stripe cobra la diferencia en el acto (`subirPlanStripe`,
  `error_if_incomplete`) y sube la capa. Sin nada pagado todavía, también sube en el acto: el link del primer mes se rehace
  a precio de Pro. Si no (Mercado Pago, que no prorratea, o un primer mes pagado sin renovación cobrada), queda PENDIENTE:
  lo que se cobra pasa a Pro, y la capa sube con el primer pago de AL MENOS ese precio en su moneda
  (`aplicarSubidasPendientes`, el cron; un pago de 47 no la sube aunque la suscripción diga Pro). Bajar es en el acto. Y el plan tiene que tener precio en la moneda de la cuenta ANTES de tocar nada (`precioDelPlanEn`): la
  renovación caía al monto del primer mes, que era el del plan viejo.
- **Trampa: un índice único hace que crear devuelva lo que ya existe.** `cobros_un_vivo_por_cliente_de_agencia` (mig 0308)
  deja UN cobro único vivo por cliente. Rehacer el link del primer mes creando el nuevo antes de anular el viejo recibía el
  VIEJO (`yaEstaba`), lo anulaba y la cuenta quedaba sin ningún link (o usando MaKo gratis, si la pagaba el cliente). Ahora
  se anula primero, y si el nuevo no sale se rehace el de antes (`rehacerPrimerMes`).
- **Trampa de la pasarela: la misma clave de idempotencia devuelve la respuesta GUARDADA.** `mako-plan-agencia-<cobro>-<plan>`
  se repetía al ir y volver en 24 h, y Stripe contestaba el «→Pro» anterior sin aplicarlo, con la base diciendo 97. **Ponerle
  el día era el arreglo equivocado:** ir y volver dos veces el MISMO día repetía la clave igual. Va una por pedido; reintentar
  no cobra dos veces porque `subirPlanStripe` lee la suscripción antes y contesta `yaEstaba`. Y si Mercado Pago no devuelve
  el monto pedido, no se sigue.
- **El diagnóstico obvio era el equivocado: «los topes ya corren, son los del plan».** Todos los topes, y los candados de
  Pro (`esEsencialDe`: las tabs de Pro, las automatizaciones, el piloto automático, el scraper), preguntaban por la suscripción
  PROPIA, y la cuenta de una agencia no tiene. El Esencial de US$47 tenía todo Pro. Ahora `aplicanTopes`
  (lib/topes-plan-server.ts) y `esEsencialDe` (lib/plan-esencial.ts) miran también la cartera no revocada. El candado del
  cliente de una agencia dice «De MaKo Pro», sin «Pasar a Pro».
- **Trampa: ese arreglo alcanzaba DE MÁS** (la verificación independiente, H1). Las cuentas de agencia que ya existían se
  abrieron con la capa por defecto, `completo`, que ahora es Esencial: al desplegar habrían perdido de golpe todo lo de Pro
  (en producción, 6 de la agencia ws13), sin aviso. Las tres pasadas del mismo revisor no lo vieron: miraban la plata de
  las cuentas NUEVAS. Ahora rige el plan sólo de la cuenta con el plan ELEGIDO (la marca `agency.plan_cambiado`, que
  escriben abrir la cuenta y cambiar el plan); las de antes siguen como Pro hasta que su agencia elija («Elegir Esencial» /
  «Elegir Pro» en su ficha). Lo decide Martín: si dice que pasen a Esencial, es una línea
  (`CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO`, lib/plan-esencial-reglas.ts), sin migración.
- **Sin ningún cobro no se pasa a Pro** (H2): una cuenta que MaKo aprobó a mano no tiene qué cobrar, y «sin nada pagado»
  la subía en el acto, gratis. Se pide por MaKo.
- **La subida pendiente sigue a la suscripción** (H3): si la agencia soltaba la cuenta, la suscripción pasaba al cliente
  con el monto de Pro y el cron ya no la miraba: pagaba Pro y quedaba en Esencial. Ahora busca por `cliente_ws` o `alta_ws`,
  y compara el pago con el monto que se le puso a ESA suscripción, no con el precio de Pro del día (H4: si el precio subía
  antes del cobro, Pro no llegaba nunca).
- **La cuenta soltada que pagó su plan se reabre aunque su suscripción no quede `activa`** (H5): el aviso de Mercado Pago
  sin el id del preapproval la deja `cubierto` y no `al-dia`, y quedaba pausada con «Reactivar» contestando 409.
- **El ws1 nunca tiene topes** (H6): los del CRM y del equipo no tenían guarda propia y alcanzaba una fila suya en una
  cartera (medido el 29/10: no tiene ninguna). Y una suscripción propia SIN `alta_capa` (la que se le pasa
  al cliente al soltarlo, o su primer plan propio) cuenta con su capa: si no, el ex cliente con Esencial volvía a tener Pro.
  Lo mismo la cuenta en pausa programada (`soltadaPorSuAgencia`): sin cartera ni plan propio, quedaba con Pro y sin topes.
- **Cobro por país** (`cobroDeLaCuenta`, lib/agencia-cobro-reglas.ts): para España no salía ningún link (sólo cobraba Mercado
  Pago en pesos). Mercado Pago, sólo en el país de su cuenta; afuera, Stripe, en EUR en la zona euro si el plan tiene precio en
  EUR y si no en USD; sin país, Stripe primero.
- **Trampa: la zona por defecto inventa el país.** Sin encabezado (la API), el país salía de la zona del negocio, y
  `zonaDelNegocio` nunca falla: sin zona guardada devuelve America/Tijuana, que es México. Sólo cuenta la zona GUARDADA
  (`zonaDelNegocioDetalle().guardada`).
- **Trampa de Stripe: no deja diferir el primer cobro sin un trial**, y el trial da una factura de US$ 0 que se asentaría como
  un cobro. Mercado Pago sí difiere (`start_date`). La renovación de Stripe se ABRE 5 días antes del vencimiento
  (`DIAS_ANTES_RENOVACION_STRIPE`) con su `inicio_at`; si no se puede anotar, se anula (sin él nunca cortaba). El cron relee
  la cartera antes de crear cada renovación, y sin poder leer las dadas de baja no renueva a nadie.

### Lo que quedó SIN hacer (29/10)

- **Los carteles de tope dicen «Pasa a MaKo Pro» y llevan un link «Pasar a Pro» también al cliente de una agencia**, que
  ahora tiene topes. Viven en pantallas de otras áreas: app/crm/PasarAPro.tsx (CRM: tablero, barra y alta a mano),
  app/crm/TraerDeGrupoWA.tsx (el candado del scraper), app/whatsapp/EvolutionConnect.tsx, app/equipo/EquipoView.tsx,
  app/m/configuraciones/equipo/EquipoM.tsx, app/web-generator/editor/dialogos/DialogoPublicar.tsx y
  app/integraciones/CuentasDePago.tsx. Adonde llevan («Tu plan») ya dice «Lo maneja tu agencia». Propuesta: el dato ya está
  en /api/auth/me (`clienteDeAgencia`). Con él se esconde el link y el texto pasa a «pídele a tu agencia que te pase a Pro».
- **La renovación de Stripe abierta 5 días antes** (revisión, hallazgo 10): si la agencia la paga apenas se abre, paga esos
  5 días dos veces; si la paga tarde, el ancla de Stripe se corre y esos días quedan regalados. Es el costo del diseño sin trial.
- **La subida pendiente llega un mes tarde si la renovación cae el MISMO día en que se pidió:** el pago se compara por día
  (`fecha_pago` puede venir sin hora) y uno de ese día pudo ser el de antes, a precio de Esencial.
- **`finDeLoQuePago`, sin onboarding terminado,** cuenta el primer mes desde el pago. (Desde el último pago de la suscripción
  ya cuenta: H8 de la verificación independiente, las renovaciones no mueven `pagado_at`.)
- **De la verificación independiente, para después** (cada uno con su archivo, en el informe): el país que decide la
  pasarela es el de la agencia, no el del cliente que paga (H7: con «paga mi cliente», a un cliente de otro país le llega
  una pasarela que no puede pagar); un negocio que ya existía y alguien cargó a mano en una cartera lo puede pausar su
  agencia con «Dar de baja» (H6; sus topes no, por H1); `primerPlanPropio` abierto a cualquier negocio sin plan propio; el cliente de agencia con
  Pro se puede «Sumar como Agency»; la baja se traba si la pasarela ya canceló la suscripción; «Nuevo cliente» dice US$ aunque
  cobre en EUR o ARS.
- **PLAUSIBLE, vive en lib/cobros.ts (Cobros):** al rehacer el link del primer mes, el viejo se anula y su cierre en la
  pasarela es de mejor esfuerzo. Si no se cerró y alguien lo paga, pasarlo a `pagado` choca con el índice contra el link
  nuevo: la plata entra y el pago no queda anotado. Haría falta que `anularCobro` diga si la pasarela cerró el link.
- **La suscripción que se le pasa al cliente sigue colgada de la ficha de la agencia en el CRM de MaKo** (su lead): su
  baja y sus reactivaciones escriben ahí y mueven el MRR de la agencia. Afecta reportes, no plata.
- **PLAUSIBLE, no seguido:** si la agencia tiene gente suya dada de alta en el equipo de la cuenta del cliente, esa gente
  sigue entrando cuando la cuenta queda abierta (la que pagaba el cliente).
- El teléfono abre la cuenta sin elegir plan (queda en Esencial) y no lo cambia. La API tampoco tiene «cambiar el plan».
- El precio en EUR no tiene pantalla: /admin/cobros edita sólo la moneda de Mercado Pago, y sin él España paga en USD.
