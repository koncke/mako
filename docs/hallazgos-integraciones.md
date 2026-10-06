# Hallazgos — integraciones y credenciales

Lo que se aprendió tocando el catálogo de integraciones, la resolución de
credenciales y el reparto entre lo que paga la casa y lo que paga el cliente.

---

## Pasar una integración de PLATAFORMA a BYOK son seis piezas, y cinco fallan calladas

**Vive en:** `lib/integraciones-catalogo.ts` · `lib/metodo-catalogo.ts` ·
`lib/credenciales.ts` · `lib/datos-mau.ts` · `lib/elevenlabs.ts`

El 02/09/2026 ElevenLabs pasó de correr con la cuenta de MaKo a correr con la de
cada cliente. La cifra que lo justificaba al revés es la que lo dio vuelta: la voz
es MEDIOS, **US$0,045/min contra US$0,00067 del texto — 67×**, y eso no se puede
costear para todos. Un mapeo de 76 agentes encontró 61 problemas confirmados, 28
de ellos bloqueantes. Estos son los que no se ven leyendo el código.

### Sacar una integración: los cuatro registros juntos, y sus credenciales quedan huérfanas

Medido el 06/10/2026 sacando Microsoft Clarity del producto. Una integración son tres
registros más el logo (AGENTS.md) y, al SACARLA, el orden importa en las dos direcciones que
los guards miran por separado: sin el ping primero, /metodo contesta «servicio inválido» sobre
un formulario que todavía existe; sin el logo primero, el guard de los tres registros falla
sobre una integración que sigue declarada. Por eso salen los cuatro en el mismo commit.

**Lo que no se ve:** `ENVS_METODO` (lib/metodo-catalogo.ts) es la lista blanca de lo que la
ruta de credenciales deja **borrar y revelar**. Sacando el servicio del catálogo, una fila ya
guardada en `credenciales` queda cifrada y **sin forma de borrarla desde la pantalla**. Con
Clarity son 10 filas en 5 workspaces, inertes —ningún código las lee—; si hace falta borrarlas,
es por SQL. Es lo mismo que lib/integraciones.ts ya advierte del WhatsApp oficial: esconder una
integración no la apaga, la vuelve inmanejable.

**Y un umbral que pasaba por uno:** `tests/tutoriales-legibles.test.ts` exigía más de 300
textos de tutorial y, sin los 15 de Clarity, quedaron 301. Se bajó a 250 con el porqué: es un
piso contra un extractor ROTO, y a uno del margen la próxima limpieza de copy lo habría tirado
con un mensaje que manda a arreglar el extractor.

**Vive en:** lib/integraciones-catalogo.ts · lib/metodo-catalogo.ts · lib/metodo-verificar.ts ·
app/_components/ServicioVisual.tsx · app/api/integraciones/credencial/route.ts ·
tests/tutoriales-legibles.test.ts · *2026-10-06*

### 1. `soloPlataforma` está DOS veces y hace dos cosas distintas

`lib/integraciones-catalogo.ts` decide si se **dibuja** la tarjeta.
`lib/metodo-catalogo.ts` lo lee `servicioDelContexto` en
`app/api/integraciones/credencial/route.ts`, que es el **choke point** de guardar,
verificar, revelar y borrar.

Sacar sólo el primero deja al cliente **peor que antes**: ve la tarjeta, abre el
modal, y el GET le contesta 400 «servicio inválido» — un mensaje que lo culpa a él
por haber elegido bien. Es la misma familia que «sin el PING el cliente no puede
guardar nada».

**La regla: antes de mover un flag de visibilidad, `grep` del flag entero.** Si
aparece en dos catálogos, son dos decisiones y hay que tomarlas juntas.

### 2. `credWs` cae a `process.env` para OWNER_WS, y OWNER_WS es un cliente

Ya está en AGENTS.md, y aun así es la trampa central de cualquier BYOK:

```ts
if (w === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]!;
```

Con `credWs` a secas, Mauricio —**y sólo él**— habría seguido usando la cuenta de
la casa, facturada a la casa. **Y no falla: funciona.** Por eso ahora existe
`credDelCliente`, que es `credWs` sin esa línea: la pregunta «¿de quién es esta
credencial?» se contesta **eligiendo función**, no acordándose de un argumento.

**Y la PANTALLA pregunta con `credWs`, así que en el ws1 miente para arriba**
(*2026-09-16 api-mako-areas*). El ws1 ve ElevenLabs, Zernio y OpenRouter «Conectada», y
«Probar conexión» da verde. Las tres piezas leen con la función equivocada: la tarjeta, con
`credWs` (`lib/integraciones.ts:175`); el campo, con `estadoCampo`, que sin fila y en
OWNER_WS cae al env con `origen: 'servidor'` (`lib/credenciales.ts:255-260`); y el ping
prueba lo que devuelve `credWs` (`lib/metodo-verificar.ts:599`) — o sea, la key de la casa.
La lib BYOK lee con `credDelCliente` (`lib/elevenlabs.ts:155`) y no la ve. `NO_MIGRAR_A_WS`
no ayuda: frena la copia del boot, no esta lectura.

**El diagnóstico obvio —«la key está cargada, lo roto es la feature»— es el equivocado:** la
key que se ve no es del cliente. Para decir «conectada» sobre una credencial BYOK, la
pregunta tiene que ser la misma que hace quien la consume. Sigue así en las tres libs.

### 3. Borrar la fila no dura: el boot la vuelve a sembrar

`migrarEnvACredenciales` **rellena huecos** desde el entorno, y `.env.local`
apunta a la base de **producción**. O sea que un `npm run dev` en la máquina de
cualquiera bastaba para que la cuenta de MaKo reapareciera dentro del ws1,
disfrazada de conexión propia de Mauricio. Se cierra con `NO_MIGRAR_A_WS`.

### 4. Y «Datos de Mau» la sembraba por el otro lado

`lib/datos-mau.ts` copia las credenciales del ws1 al workspace destino. Así se
había sembrado la del ws4. **El filtro obvio —`if (s.soloPlataforma) continue`—
nace muerto**: ese flag se apaga exactamente cuando una credencial pasa a BYOK,
que es el momento en que más se lo necesita. Va contra `esCredencialDeLaCasa`, que
es la misma lista que gobierna el boot.

⚠️ **Es el patrón general: una guarda colgada de un flag que el propio cambio
apaga no es una guarda.** Antes de escribir una, preguntá si sigue siendo cierta
después del commit que la motiva.

### 5. El texto de «falta la key» estaba escrito seis veces, y las seis mentían

Seis literales idénticos de «No hay API key de ElevenLabs cargada **en la
plataforma**». Bajo BYOK eso apunta al lugar equivocado: manda a esperar que MaKo
arregle algo que se arregla en la pantalla del propio cliente. Es «una cosa, un
lugar» sin cumplir, con el agravante de que el texto duplicado envejece de golpe
el día que cambia el modelo de negocio.

**Y el reparto de culpa es lo que decide si un mensaje lleva link:** `sin_key`,
`sin_permiso`, `impago` y `cuota` van a `/integraciones`; `voz_muerta` ofrece
reclonar; y `proveedor` y `nuestra` **no llevan link** y dicen con todas las letras
que no es nada del cliente.

### 6. La pantalla pedía 90 segundos para dar una noticia que ya sabía

El paso «Tu voz» pedía la grabación entera y recién al subirla contestaba que
falta la key. **Un chequeo que se puede hacer antes del trabajo y se hace después
convierte un dato en una pérdida.** Ahora el GET trae `hayKey` y sin ella se pide
la key, no la grabación — con `null` («todavía no contestó») no se pinta nada,
porque mostrar «conectá» por un parpadeo a quien sí la tiene es peor que esperar.

### Lo que se midió, y por qué no se puede confiar en el `.env.local`

| Workspace | Key | Qué era |
|---|---|---|
| ws9 (plataforma) | `…734a` | La que usa producción. 9 clones adentro |
| ws1 (Mauricio) | `…734a` | La de la casa, copiada. **Borrada** |
| ws4 | `…734a` | La de la casa, sembrada por «Datos de Mau». **Borrada** |
| ws11 (Leila) | `…de1d` | Propia, plan `starter` de pago. **Se conserva** |

⚠️ **La key del `.env.local` (`…d3c6`) NO es la que usa producción.** `credWs`
busca primero la fila de la base y sólo cae al entorno como último recurso; el ws9
tiene fila propia, así que la del entorno no se usa nunca. Medir la cuenta del
`.env.local` era medir **otra cuenta** — y así se reportó un «tier creator, 2/30
slots» que no era el de producción.

**Antes de medir una cuenta de un proveedor, comprobá qué credencial usa el código
de verdad.** No la que está a mano.

### El orden del deploy, que no es intercambiable

1. Los cambios de código juntos, y desplegar.
2. Verificar **contra la API**, no mirando la pantalla: un GET a
   `/api/integraciones/credencial?servicio=<x>` con sesión de cliente tiene que dar
   200. El flag de visibilidad y el guard de la ruta son cosas distintas.
3. **Recién ahí** borrar las filas viejas, en POSITIVO y enumerando
   (`workspace_id IN (1,4)`). La formulación tentadora —«borro las que tengan el
   valor de la plataforma»— se lleva puesta la del super admin.

Al revés, el cliente se queda sin la feature **y** sin forma de reactivarla,
porque la tarjeta todavía no le aparece.

### Lo que quedó SIN hacer

- Los **9 clones** que viven en la cuenta de MaKo (`MaKo ws11`, `MaKo ws14`, seis
  de Mauricio, Johana) quedaron huérfanos: sus workspaces ahora resuelven a otra
  cuenta, así que su `voiceId` guardado en `video.voz` apunta a una voz que su key
  no puede ver. `verificarVoz` lo detecta, pero el resultado se colapsa a un
  booleano que nadie lee, así que la pantalla puede pintar «Tu voz está clonada» en
  verde sobre un clon inalcanzable. Vive en `app/api/onboarding/voz/route.ts` y
  `app/video-generator/OnboardingVideoGen.tsx`.
- `textoEleven()` está escrito y **no lo llama nadie todavía**: la pantalla sigue
  mostrando el `error` plano. Falta cablear el `motivo` desde las respuestas de
  `app/api/onboarding/voz/route.ts` hasta el render.
- «Se acabaron los espacios de voz» no es un motivo del enum: cae en `cuota` («se
  repone el mes que viene»), que manda a esperar algo que no va a llegar. Vive en
  `lib/elevenlabs-fallo.ts`.

*Corrida del 02/09/2026 — 76 agentes, 61 hallazgos confirmados de 70.*

---

## Google Calendar era owner-only, y el 403 que veía el cliente NO era la parte cara

**Vive en:** `app/api/integraciones/google-calendar/route.ts` ·
`app/api/integraciones/google-calendar/callback/route.ts` · `lib/google-calendar.ts` ·
`lib/gcal-estado.ts` · `lib/workspace.ts` · `app/configuraciones/gcal-actions.ts` ·
`app/integraciones/IntegracionesBoard.tsx` · consola de Google Cloud (cliente `118392241323-j98eq…`)

El cliente del ws13 (Código Inmobiliario) apretó «Conectar Google Calendar» y recibió
`{"ok":false,"error":"Solo el workspace principal puede conectar Google Calendar."}`.

### El gate estaba puesto con la pregunta equivocada

Las dos patas del OAuth gateaban con `esDuenoAdmin()`, que pregunta **«¿sos la
agencia?»** y existe para mover PLATA en la cuenta de Meta de la agencia. Conectar
la agenda propia es otra pregunta: **«¿administrás ESTE workspace?»**. El resto de
la maquinaria ya era per-workspace desde siempre —`app_settings` tiene PK compuesta,
el token se cifra con el ws, y el callback del LOGIN ya guardaba con
`runWithWorkspace(ws, …)`—: la casa estaba entera y quedó una sola puerta cerrada.

El guard correcto ya estaba escrito y comentado en la ruta hermana
(`app/api/integraciones/credencial/route.ts`): super-admin de agencia **O** admin del
propio workspace, ws siempre del request, fail-closed. Ahora vive en
`adminDeWorkspaceActual()` (`lib/workspace.ts`) y lo usan los cuatro puntos.

### Abrir el gate ACTIVA tres fallas que dormían

Ninguna se veía mientras conectar era owner-only, porque el `?? OWNER_WS` era
justamente el mecanismo por el que la agenda del ws1 quedaba conectada:

1. **`wsDelSetting()` caía a `OWNER_WS`.** Un admin sin ws resuelto conectaba SU
   agenda y el token cifrado terminaba en `app_settings` del ws1 — el buscador de
   reuniones de Mauricio pasaba a leer la agenda de otro, sin error y sin síntoma.
2. **`desconectarGoogleCalendar()` era peor**: llamaba a `setSetting` directo, que
   tiene su PROPIO `?? OWNER_WS` (`lib/settings.ts`). Un «Desconectar» apretado sin
   ws resuelto le borraba el token a Mauricio.
3. **El `?ws=` se perdía en las TRES patas del round-trip.** El `redirect_uri` está
   registrado FIJO en Google Cloud, así que en la vuelta no hay `?ws=` ni pestaña que
   leer: el callback resolvía el workspace de **quien tuviera la sesión**. La agencia
   configurando parado adentro de un cliente le guardaba la agenda a su propio
   workspace. No falla: **funciona**, con el tile verde en el lugar equivocado.

El workspace destino ahora viaja en la cookie `gcal_state` (`nonce.ws`, httpOnly), que
escribe el paso 1 —el que ya autorizó— y el callback aplica con `runWithWorkspace`.
La regla vive en `lib/gcal-estado.ts`, **sin `server-only`**, con test: es la frontera
que decide en qué inquilino se escribe el token de agenda de alguien.

### ⚠️ El bloqueante real está FUERA del repo, y ningún cambio de código lo toca

**MEDIDO el 05/09/2026 en la consola** (proyecto `MaKo` / `mako-500317`, que es de
`martinkoncke@gmail.com` — con la cuenta de Leandro la consola contesta «Necesitas acceso
adicional» y eso se lee como un problema de permisos cuando es de cuenta):

| Qué | Estado |
|---|---|
| Publishing status | **Testing** (cap de 100 usuarios de por vida) |
| Test users | **3**: martinkoncke@, mbustos@elevate.com.mx, tejadomartin@ — **el cliente NO está** |
| Branding | **INCOMPLETO**: `App name` VACÍO, home page, privacy, terms y authorized domains vacíos |
| Data Access | **CERO scopes registrados** — ni `calendar.readonly` ni `calendar.events`, en ninguna de las tres tablas |
| Redirect URIs | **OK**: las dos de `hola-mako.com` (login y agenda) están, y también `localhost:3000` |

El rastro estaba escrito en `docs/hallazgos-infra.md` desde el 06/08/2026
(«**Pendiente del dueño:** sacar el aviso de Google "Esta app está en prueba"») y nadie lo
cruzó con «los clientes van a conectar su agenda». En Testing sólo consienten los emails
cargados a mano: el cliente pasa los gates nuevos **y lo frena Google**.

⚠️ **Y publicar NO es un botón:** la propia pantalla de Audience dice «Your app's OAuth
configuration is incomplete… visit the Branding page». Con el `App name` vacío el botón
«Publish app» no procede. O sea que el pendiente escrito en agosto era más grande de lo que
su redacción sugería — «sacar el aviso» suena a un toggle y son cuatro campos más una
política de privacidad publicada.

Dos correcciones a lo que decía la doc vieja, las dos medidas:
- **`localhost:3000` SÍ está registrada** para el callback de la agenda: `hallazgos-infra.md`
  afirma que conectar desde `npm run dev` falla con Error 400, y eso ya no es cierto.
- **`www.hola-mako.com` NO está** en ninguna de las 8 redirect URIs ni en los 3 JavaScript
  origins, y `proxy.ts` deja pasar `www` sin mandarlo al apex: quien entre por ahí come
  `redirect_uri_mismatch`. Sin reproducir todavía.

Y trae una cola que el código no puede distinguir: en Testing **los refresh_token
caducan a los 7 días**. `googleCalendarConectado()` mide «el token descifra», no «Google
lo acepta», así que el tile quedaba **VERDE diciendo «Cruzando las reuniones de …»**
sobre una agenda muerta, para siempre. Peor: `gcalIncompleta` daba `false` con
`conectado:false`, así que tampoco entraba en «Requiere tu atención». Ahora hay un
tercer estado (`gcalRechazada`) que degrada a ámbar y dice qué pasó.

**Y `conectado: false` todavía contesta varias preguntas a la vez** (*2026-09-16
api-mako-areas*). `googleCalendarConectado` (`lib/google-calendar.ts:170-182`) da `false` si
el token nunca existió, si se desconectó (setting vacío) y si no descifra — y a diferencia de
la tabla `credenciales`, no hay estado «ilegible» que avise. `tokenGoogle` (`:195-216`) le
suma dos causas a su `null`: faltan `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en el server, o
el refresh no devolvió token (Google lo rechazó, o no contestó en 8 s). Y
`permisoCalendarioGoogle` (`:388-395`) devuelve el mismo `conectado: false` desde su `catch`.
O sea: «Google no respondió» se lee igual que «nunca conectaste tu agenda».

**Regla para quien lo consuma:** si `googleCalendarConectado()` da `true` y
`permisoCalendarioGoogle()` da `conectado: false`, el token está y Google no lo aceptó o no
contestó — nunca «no se conectó». Así lo dice la API (`rechazada_o_sin_respuesta`,
`lib/api-mako/areas/integraciones.run.ts:137`); la lib sigue sin distinguirlo, y esa es la
deuda, en esas tres funciones.

**La regla que queda:** cuando una feature pasa de owner-only a per-cliente, el gate es
la parte barata. Lo caro son (a) los `?? OWNER_WS` que hasta ese día eran el mecanismo
correcto y pasan a ser una fuga, y (b) **lo que un tercero exige y nadie volvió a mirar
desde que la feature tenía un solo usuario**. Un consentimiento de OAuth se otorga por
CUENTA, no por workspace: la agenda del cliente sólo la puede conectar el cliente, y el
email de la agenda (`EMAIL_KEY`, ya visible en la tarjeta) es la única señal de que
quedó conectada la correcta.

### Lo que quedó SIN hacer

- **Completar Branding y publicar la app.** Falta el `App name` (obligatorio, hoy vacío),
  y para la verificación posterior hacen falta política de privacidad y términos **públicos
  en el dominio**, que no existen: `app/privacidad/extension/page.tsx` habla de la extensión
  de Chrome, no de MaKo ni del uso de datos de Google Calendar. No hay
  `app/privacidad/page.tsx` ni `/terminos`.
- **Declarar los scopes en Data Access.** Hoy la tabla está vacía: `calendar.readonly` y
  `calendar.events` nunca se cargaron. En Testing no molesta (Google los concede igual a un
  test user), pero es lo primero que mira la verificación.
- **`integracionConectada('google')` devuelve `false` para TODOS los workspaces**: el
  token vive en `app_settings` y no en `credenciales`, y `'google'` no está en
  `lib/metodo-catalogo.ts` (sale por el `if (!s) return false` de
  `lib/credenciales.ts`). Hoy no muerde porque ningún cron lo usa —
  `correrPorWorkspace('google', …)` iteraría CERO workspaces y devolvería `ok:true` en
  silencio. Hay que cerrarlo antes de escribir el primer cron de agenda.
- **`googleRedirectUri()` lee `NEXT_PUBLIC_APP_URL`, no `APP_BASE_URL`** (que es la que
  usa el resto vía `lib/app-url.ts`). Si en Vercel está la segunda y no la primera, la
  URI se deriva del origin — y `proxy.ts` deja pasar `www.hola-mako.com` sin mandarlo al
  apex, así que quien entre por `www` come `redirect_uri_mismatch`. Sin medir.
- **`/api/crm/horarios` documenta «SIN CHEQUEO DE ROL» a propósito.** Con los gates
  abiertos, cualquier closer/setter del workspace pasa a leer el freeBusy de la agenda
  conectada. Es una decisión que hay que tomar explícita, no heredar.

*Corrida del 05/09/2026 — 9 agentes (5 lentes + síntesis + 3 refutadores); los tres
refutaron el plan de síntesis y los tres tenían razón: el gate solo no alcanzaba.*

---

## ⚠️ `verificarServicio` se escribió para el tilde del formulario, y reusado para contestar «¿anda?» miente

**Vive en:** `lib/metodo-verificar.ts` (`PINGS`, `verificarServicio`) ·
`lib/api-mako/areas/integraciones.run.ts` (`probar_conexion_integracion`)

El ping corre ANTES de guardar cada campo (es el tercer registro de una integración, en
AGENTS.md), y varias decisiones correctas para ese momento son mentiras fuera de él. Salió
al exponerlo como «probar la conexión» en la API de MaKo. La auditoría vieja de los pings
—«key válida» no es «la integración sirve»— está en [hallazgos-infra.md](hallazgos-infra.md);
estas cuatro son otras.

### 1. Hay `ok: true` que no le pegaron a nadie

Para no trabar el guardado, varios caminos contestan `ok` sin llamar al proveedor:

| Servicio | Caso | Qué devuelve |
|---|---|---|
| Clarity | sin token (`:430`) | `ok: true`, «ID válido. Falta el token…» |
| Clarity | cuota diaria agotada, 402 (`:438`) | `ok: true`, «Guardado. Hoy ya se usaron las 10 consultas…» |
| Zernio | sin key propia (`:505-507`) | `ok: true`: el modo normal, con la cuenta de la agencia |
| Cal.com | sin API key y con secret (`:539-548`) | `ok: true`: el secret no se puede comprobar contra nadie |

Quien lo reuse para decir «anda» tiene que separar los `ok` que no probaron nada. Y el
«Guardado.» del 402 afirma una acción que, fuera del formulario, no pasó.

### 2. Probar Clarity le gasta al cliente la cuota del día

La Data Export API de Clarity permite 10 consultas por día, y el ping gasta una
(`project-live-insights`, `:432`). Un «probar» apretado unas cuantas veces deja ese día sin
resumen de sesiones — y el 402 que sigue sale como `ok`, por el punto 1.

### 3. Los `facts` traen datos personales y plata

Son para la tarjeta del admin, y traen: el número de WhatsApp de la bandeja de Chatwoot
(`:155`), el email de la cuenta de Calendly (`:491`) y de Cal.com (`:562`), el título de la
última llamada de Fathom —que suele llevar el nombre de un lead— (`:377-379`) y el uso en USD
de OpenRouter (`:249`). Nada de eso puede salir por otro canal. Por eso la API devuelve solo
`anda`, `detalle` y `motivo` (`integraciones.run.ts:118-125`), y así puede ir por HTTP.

### 4. El sondeo de ElevenLabs no tiene timeout

`fetchJson` lleva `AbortSignal.timeout(8000)` (`:22-24`), pero `sondear` (`:317-318`, el POST
sin cuerpo a `voices/add` y a speech-to-speech) llama a `fetch` directo, sin `signal`. Un
ElevenLabs lento cuelga la verificación hasta el techo de la función. Sin arreglar.

**La regla:** una función escrita para UN momento trae las decisiones de ese momento adentro
de sus `ok`. Antes de reusarla para otra pregunta, leé cada rama que devuelve `ok: true` y
preguntá qué probó.

*Corrida del 16/09/2026 — api-mako-areas.*

---

## Un link a /integraciones: el parámetro es `?abrir=`, y sin `?ws=` puede abrir otro workspace

**Vive en:** `app/integraciones/IntegracionesBoard.tsx:186-210` · `lib/ws-tab.ts:51-61`
(`conWs`) · `lib/api-mako/areas/integraciones.run.ts:50` (`linkIntegracion`)

### El modal se abre con `?abrir=<key>`, y un key que no está no abre nada

El inventario de la API decía `/integraciones?servicio=<key>`. Ese link abre la página y
ningún modal, sin error: `IntegracionesBoard` lee `searchParams.get('abrir')` (`:195`) y
además **ignora en silencio** todo key que no esté entre sus integraciones visibles ni en
`SYNTHETIC` (`:199`). Un link bien formado a un servicio que ese workspace no ve —por capa, o
por `soloPlataforma`— aterriza igual frente a la grilla.

**Regla:** el link es `/integraciones?abrir=<key>`, y el key se valida contra `defsVisibles`
con la capa de ese workspace ANTES de mandarlo; si no, el aviso promete un modal que no se abre.

### Un link absoluto sin `?ws=` abre el workspace de la cookie

Para quien administra varios (la agencia), un link a /integraciones sin `?ws=` abre el
workspace que tenga en la cookie. En esta pantalla eso no es mirar otra cuenta: es **pegar la
credencial de un cliente en la fila de otro**. Un link que sale por un chat no pasa por
ninguna de las cuatro formas de navegar de AGENTS.md, así que nadie le pega el `?ws=`.

⚠️ Y `conWs` no lo arregla tal cual: devuelve intacto todo href que no empiece con `/`
(`lib/ws-tab.ts:54`), así que sobre un link ya absoluto (`${APP_BASE_URL}/integraciones?…`) no
hace nada. Hoy ningún link de `lib/api-mako` lleva el `?ws=`. Lo que quedó SIN hacer: armar el
path relativo con `conWs` y recién después anteponerle la base.

*Corrida del 16/09/2026 — api-mako-areas.*

---

## La lógica de credenciales vive adentro de la ruta, así que un segundo consumidor la tiene que copiar

**Vive en:** `app/api/integraciones/credencial/route.ts` (`envDelContexto` `:155`,
`servicioDelContexto` `:161`, la rama `elegir` `:395-441`, `borrar` `:443-451`) ·
`lib/metodo-catalogo.ts:933` (`servicioMetodo`) · `lib/api-mako/areas/integraciones.helpers.ts`
(`servicioDelWs`)

El guard de plataforma es un choke point bien puesto (ver
[hallazgos-seguridad.md](hallazgos-seguridad.md) → «el guard cubría 4 de 6 caminos») — pero
es el choke point **de esa ruta**. `servicioDelContexto` y `envDelContexto` son funciones
privadas del `route.ts`; lo que está exportado es `servicioMetodo`, el accessor CRUDO, que le
devuelve la ficha de GitHub (`soloPlataforma`) a cualquiera.

El 16/09/2026 la API de MaKo necesitó la misma pregunta y no tuvo de dónde importarla:
quedó copiada en `integraciones.helpers.ts` (`servicioDelWs`: `soloPlataforma` y el ws no es
el de `wsSuperAdmin()` → no existe). Dos copias de un guard de seguridad es «una cosa, un
lugar» sin cumplir, y la segunda se queda vieja el día que la primera gane un caso.

Es también por qué la API **no** escribe credenciales:

- **Borrar:** el guard (`envDelContexto`) y la llamada a `auditarCredencial` están escritos
  adentro de la rama `borrar`.
- **Elegir cuenta, página o píxel de Meta:** la rama `elegir` son ~45 líneas inline que le
  vuelven a pedir el token de página a Meta (`descubrirMeta`, que además trae los page tokens
  y el titular) y escriben identificadores de ruteo que otro workspace puede tener reclamados
  (`IdentificadorOcupadoError`).
- **Desconectar Google Calendar** es borrar el refresh token, y volver atrás exige el OAuth
  del dueño de esa agenda: no se deshace desde un chat.

**Lo que quedó SIN hacer:** mudar `servicioDelContexto`, `envDelContexto` y las ramas
`guardar`, `elegir` y `borrar` a un `lib/integraciones-credencial.ts` que usen la ruta y la
API. El día que exista, `servicioDelWs` se borra.

*Corrida del 16/09/2026 — api-mako-areas.*

---

## «El cliente conecta Calendly, no entra nada y no hay ningún error» (01/10/2026, arreglado el 04/10)

Martín, en la llamada del 01/10 (00:50:03): *«Calendly: el cliente conecta, no entra nada y
no hay ningún error. No sé por qué, como no uso Calendly. Esto yo creo que lo que pasa es
que está configurado el Calendly de Mauricio y los clientes conectan el suyo y no pasa
nada»*.

**Su hipótesis era la equivocada, y la causa estaba escrita en el propio webhook.**

Un webhook entrante llega SIN sesión, así que lo único que dice de quién es el evento es la
tabla `webhook_routing` (mig 0090), y esa fila la escribe el guardado de **una credencial**:
las de `ROUTING_CREDS` (`lib/webhook-routing.ts`). Para Calendly son
`CALENDLY_EVENT_TYPE_J1` y `_J2`… y las dos estaban declaradas **`opcional: true`** en
`lib/metodo-catalogo.ts`. El único campo obligatorio era el token.

O sea: conectar Calendly «bien» —token y signing key— dejaba al cliente con **cero filas de
ruteo**, y el webhook es fail-CLOSED a propósito (sin mapeo no se toca un solo dato, para
que la reserva de un cliente no caiga en el CRM del dueño). Resultado: 200, un
`console.warn` que no lee nadie, y ninguna reserva en el CRM.

**Medido contra producción el 04/10/2026:** de los 2 workspaces con Calendly conectado,
**uno (el ws 4) tenía token y signing key y CERO filas de ruteo**. El script quedó en
`scripts/probe-calendly-sin-ruteo.ts`.

Y no hay red por otro lado: **no existe ningún cron que ingiera la agenda**. Con el token,
MaKo COMPLETA las fechas de un lead que ya existe (`lib/auto-reuniones.ts`, al mover una
tarjeta del CRM) y RESERVA (`lib/calendly-agenda.ts`). Lo que crea el contacto a partir de
una reserva es el webhook y nada más — así que la ayuda de la signing key, que decía «deja
el campo vacío, tus reuniones igual entran porque MaKo lee tu agenda con el Personal access
token», prometía algo que no pasa. Era el mismo malentendido por la otra puerta.

### Lo que quedó

- `CALENDLY_EVENT_TYPE_J1` y `CALCOM_EVENT_TYPE_J1` dejaron de ser opcionales, y su nota
  dice qué se pierde: *«sin esto, las reuniones que agende tu gente no entran a tu CRM y no
  vas a ver ningún error»*. El `_J2` sigue opcional, que es lo correcto: sólo hace falta si
  la segunda reunión va por otro link. Es el MISMO precedente que `FATHOM_HOST_EMAIL`, que
  dejó de ser opcional por esto mismo y lo dice en su comentario; estos dos se habían
  quedado atrás.
- **La regla, en positivo y con guard**: cada servicio de `ROUTING_CREDS` tiene al menos una
  clave que el cliente no puede dejar vacía — obligatoria, o `auto` (la completa MaKo, como
  `META_PAGE_ID` al pegar el token). `tests/webhook-ruteo-obligatorio.test.ts`.

⚠️ **Y esto no arregla al ws 4**, por la regla de siempre: una regla que se aplica AL
ESCRIBIR no toca una fila ya escrita. Lo que sí cambia es que su Calendly deja de contar
como «conectado» (`calcConectada` exige los no-opcionales), así que la pantalla pasa a
mostrar el campo en «pendiente» en vez de un verde que miente. El dato lo tiene que poner
ese cliente: es el nombre de SU event type.

⚠️ **Y la excepción de `auto` no es un detalle del guard: es la mitad que lo hace usable.**
`META_PAGE_ID` ES `opcional: true` y está bien así, porque lo completa MaKo al pegar el
token. Sin esa excepción el guard habría pedido hacer obligatorio un campo que el cliente no
tiene de dónde sacar — que es exactamente el candado sin llave que la casa prohíbe.

**Vive en:** `lib/metodo-catalogo.ts` (Calendly y Cal.com) · `lib/webhook-routing.ts` → `ROUTING_CREDS` · *2026-10-04*

## `opcional: true` no es un rótulo: lo cuentan tres lectores y mueve pantallas enteras (04/10/2026)

Sacarle `opcional: true` a un campo del catálogo de integraciones parece un cambio de validación
de un formulario. No lo es: la bandera la leen `integracionConectada`
(`lib/credenciales.ts:227-230`), `calcConectada` (`app/integraciones/ServicioConfigForm.tsx:96-98`)
y `app/api/metodo/route.ts:28`, **los tres exigiendo que estén TODOS los requeridos** para
contestar «conectado».

Medido: al volver obligatorio el tipo de evento de la R1, el ws 4 pasó de «Calendly conectado» a
**no conectado**, sin que nadie tocara una credencial y sin un solo error. Para esa persona la
integración se desconectó sola.

**Antes de sacarle `opcional: true` a un campo, grepeá quién cuenta los requeridos y corré la lista
de workspaces para ver quién cambia de lado.** Es la misma familia que «un campo nuevo son SEIS
lugares», del lado de la CONDICIÓN en vez del dato — y acá el cambio es correcto y hay que hacerlo
igual: lo que no puede pasar es que nadie sepa a quién le cambió la pantalla.

**Vive en:** `lib/metodo-catalogo.ts` · `lib/credenciales.ts:218-231` · `app/integraciones/ServicioConfigForm.tsx:96-98` · *2026-10-04 arreglar-crm*

## Un aviso de «esto está a medias» cuelga de la INTEGRACIÓN, no de la tab (04/10/2026)

El panel de activación del CRM se dibuja con un OR sobre tres fuentes
(`!calendly && !calcom && !meta`, `app/crm/page.tsx:51-59`), así que **una integración a medias
queda tapada por cualquier otra que esté entera**.

Medido: el ws 4 tiene Meta conectado y Calendly a medias —token sí, tipo de evento no, cero filas
de ruteo— o sea que es exactamente el workspace al que se le están tirando reservas, y el único al
que la pantalla no le puede avisar. El OR lo da por cubierto.

**Un gate que decide si se ve una pantalla de datos se pregunta por los DATOS además de por la
configuración**, y el aviso de una integración incompleta vive en esa integración: una tab con
otra fuente conectada no tiene cómo contarlo.

**Vive en:** `app/crm/page.tsx:51-59` · `lib/tab-activacion.ts` · *2026-10-04 arreglar-crm*

## Un encargo con archivo:línea es una FOTO FECHADA, no el estado del árbol (04/10/2026)

El encargo medía, con archivo y línea del 03/10, que los dos campos de tipo de evento de Calendly
seguían `opcional: true`. En HEAD, uno ya era obligatorio: el commit `1a0c13cf` entró el 04/10, un
día después de la medición.

**Se relee HEAD y se corre `git log --oneline -5 -- <archivo>` antes de escribir una línea.** Y
cuando el arreglo ya está, lo que suele quedar son los TEXTOS que ese arreglo dejó viejos —tres
tutoriales y una nota que seguían describiendo el campo como opcional—, que es trabajo real y que
ningún compilador reclama.

**Vive en:** `lib/metodo-catalogo.ts:828-861` · *2026-10-04 arreglar-crm*
