# Hallazgos — Agency Dashboard (/agency)

Lo que no se ve leyendo el código de Agency Dashboard: la agencia que abre las cuentas de MaKo de SUS clientes, las
administra y elige quién paga cada una. El pedido textual, en [feedback-25-10-tarde.md](feedback-25-10-tarde.md) punto 9.
La historia anterior de la cartera (de cuando vivía en /partners), en [hallazgos-partners.md](hallazgos-partners.md) y
[hallazgos-customer-success.md](hallazgos-customer-success.md); la seguridad del «Entrar como», en
[hallazgos-seguridad.md](hallazgos-seguridad.md) → «Vista de agencia».

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
