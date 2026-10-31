# Hallazgos — Agency Dashboard (/agency)

Lo que no se ve leyendo el código de Agency Dashboard: la agencia que abre las cuentas de MaKo de SUS clientes, las
administra y elige quién paga cada una. El pedido textual, en [feedback-25-10-tarde.md](feedback-25-10-tarde.md) punto 9.
La historia anterior de la cartera (de cuando vivía en /partners), en [hallazgos-partners.md](hallazgos-partners.md) y
[hallazgos-customer-success.md](hallazgos-customer-success.md); la seguridad del «Entrar como», en
[hallazgos-seguridad.md](hallazgos-seguridad.md) → «Vista de agencia».

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
  `textoTope`), la fila de MaKo Partners y el cartel de la prueba.
  ⚠️ **`esClienteDeAgencia` ya existe** (`lib/agencia.ts`, 30/10/2026): lo que falta es **usarla en esos lugares**, y
  cada uno tiene que decidir qué hace con el «no sé» (`null`). Para apagar un upsell, el `null` **no** debe apagarlo
  —no mostrar una oferta por una falla de la base es un daño chico, pero esconderla a quien sí la puede comprar también
  cuesta—: ahí el criterio es el contrario al de una puerta, y por eso no se puede copiar el `!== false` sin pensarlo.
  La misma función está esperando en la rama `agency-thiago-2910`, que ya la usa en `app/configuraciones/plan/page.tsx`,
  `app/m/mas/page.tsx`, `app/m/partners/page.tsx` y `app/no-esta-en-tu-plan/page.tsx`: **al mergear hay que unificar una
  sola implementación** (la de acá tiene el tri-estado; la de allá, sin medir en este chat).
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
