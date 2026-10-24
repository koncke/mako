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
| Publishing status | **Testing** (cap de 100 usuarios de por vida) — **PUBLICADA el 07/10**, ver abajo |
| Test users | **3**: martinkoncke@, dueno@negocio-uno.com, tejadomartin@ — **el cliente NO está** |
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

### 07/10/2026: publicada, sin verificar

El cliente del ws13 chocó, un mes después, con exactamente lo que esta sección predecía:
«Acceso bloqueado: hola-mako.com no ha completado el proceso de verificación de Google…
Error 403: access_denied». **Que el error fuera de Google y no nuestro probó que el arreglo
de código funcionaba**: el cliente pasó `adminDeWorkspaceActual()` y llegó al
consentimiento. Seguía en Testing con los mismos 3 test users.

Se completó Branding y se publicó («In production»). Tres cosas que no se ven desde afuera:

- **«Publish app» no da error: está GRIS.** Con Branding incompleto el botón queda
  deshabilitado con una línea chica que manda a Branding. Se lee como «no tengo permiso»
  cuando es «falta un campo».
- **El email de soporte había quedado VACÍO** (el 05/09 figuraba cargado). Es obligatorio
  y es lo que destrabó el botón, junto con los tres enlaces a `/privacidad`, `/terminos`
  y la home. Los dominios autorizados no hubo que tocarlos: se cargan solos desde las
  redirect URIs del cliente OAuth.
- **Sin logo, a propósito**: subir uno obliga a verificar aunque nada más cambie.

Lo que ve un cliente ahora: «Google no verificó esta app» → *Avanzado → Ir a
hola-mako.com*. Tope de **100 usuarios en toda la vida del proyecto**, que no se
reinicia. Los refresh_token ya no caducan a los 7 días. **Verificar sigue bloqueado** por
el Uso Limitado (`docs/hallazgos-ia.md`) y porque Data Access no declara ningún scope.

Dos correcciones a lo que decía la doc vieja, las dos medidas:
- **`localhost:3000` SÍ está registrada** para el callback de la agenda: `hallazgos-infra.md`
  afirma que conectar desde `npm run dev` falla con Error 400, y eso ya no es cierto.
- **`www.hola-mako.com` NO está** en ninguna de las 8 redirect URIs ni en los 3 JavaScript
  origins, y `proxy.ts` deja pasar `www` sin mandarlo al apex: quien entre por ahí come
  `redirect_uri_mismatch`. Sin reproducir todavía.

### 07/10/2026: el Verification Center dice «no hace falta verificar», y es falso

Al arrancar la verificación, el Verification Center contestó *«Verification is not required
since your app is not requesting any sensitive or restricted scopes»*. Mide lo DECLARADO en
Data Access, que tiene cero scopes, no lo que la app pide: `GCAL_SCOPE` lleva
`calendar.readonly` + `calendar.events` en cada conexión de agenda, y por eso el cliente ve
«Google no verificó esta app». **Un verde que contradice la pantalla que ve el cliente es un
dato sobre la consola, no sobre la app.**

Y dos cosas más que piden el trabajo antes de enviar (el paso a paso, con los textos para
pegar y el guion del video, está en `docs/verificacion-google.md`):

- **Google exige verificar en Search Console CADA dominio autorizado.** Hay tres:
  `hola-mako.com` (no verificado en martinkoncke@) y dos muertos, `makodigital.app` y
  `dashboard-marketing-six.vercel.app`, que entraron solos con sus redirect URIs. Los dos
  muertos contestan 410 en `/api/auth/...` (`EXENTAS_DE_HOST` no lo incluye), así que se
  sacan en vez de verificarlos.
- **`calendar.readonly` no sobra**: `calendar.events` no alcanza para `calendars.get` (el
  correo y la zona de la agenda) ni para `freeBusy` (la grilla de horarios). La
  justificación tiene que decirlo, porque Google pregunta por qué no alcanza un scope más
  angosto.

⚠️ **Con la ventana de Chrome oculta, Search Console no abre sus diálogos.** La pestaña que
maneja la extensión mide 0×0 (`visibilityState: hidden`): la consola de Cloud se lee bien
con `get_page_text`, pero las capturas vencen a los 30 s y el diálogo de «Verificar
propiedad», que es donde Google da el TXT, no llega a armarse. No es un permiso: es que
nadie lo dibuja.

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

## Retirar el CONSUMIDOR de una integración no es retirar la integración: Whop (06/10/2026)

**Vive en:** `lib/integraciones-catalogo.ts`, `lib/metodo-catalogo.ts`, `lib/metodo-verificar.ts`,
`app/_components/ServicioVisual.tsx`, `tests/sin-whop.test.ts`.

Diez días después de que el 26/09 (`07d07139`) saliera el programa de Mauricio con su webhook, su
sync y su mapa de lecciones, la tarjeta de Whop seguía en `/integraciones` para TODOS los
clientes: se podía conectar, el tilde se ponía verde con el nombre del negocio, y el tutorial
mandaba pegar `{{APP_URL}}/api/webhooks/whop`, que daba 404. Se había ido lo que la USABA y había
quedado la integración: los tres registros, el logo, sus `AYUDA_CAMPO` y una lib sin call sites.

- **Retirar una integración son siete cosas**: la tarjeta, los campos, el ping, el logo, sus
  `AYUDA_CAMPO`, su lib, y un guard `tests/sin-<x>.test.ts` que falle si vuelve.
- **Lo que dejó escrito en la base no lo limpia ningún camino del producto**: `webhook_routing` se
  borra sólo al borrar una credencial de `ROUTING_CREDS`, y Whop nunca estuvo ahí (el ruteo lo
  escribía su lib al derivar el company id). Su fila del ws1 queda, inerte, hasta que alguien la
  borre a mano. Las 4 credenciales (ws1 y ws4) también: son dato del cliente.
- La categoría «Contenido» quedó sin tarjetas; se sigue nombrando en `CAT_ORDER` y en
  `lib/capas.ts`, y es inofensivo porque el tablero filtra las categorías vacías.

## El remitente de Resend: «opcional» para abrir la tab, obligatorio para que salga algo (09/10/2026)

**Vive en:** `lib/metodo-catalogo.ts` (`CampoCredencial.sinEsto`, el `RESEND_FROM`) ·
`app/integraciones/ServicioConfigForm.tsx` (`semaforo`, `PasosAyuda`) · `lib/integraciones.ts` (la rama de
email) · `lib/resend-remitente.ts` (`problemaDelRemitente`) · `lib/metodo-verificar.ts` (el ping `email`) ·
`app/api/integraciones/credencial/route.ts` · `tests/resend-remitente.test.ts`

Punto 15 del audio de Customer Success (08/10, Leandro probando el curso): con su key de Resend puesta los
correos no salían. «Resend en teoría está conectado… el problema es que me faltaba un campo… falta
remitente, y lo raro es que dice que es opcional». El formulario lo marcaba «opcional», la tarjeta decía
«Conectada», y el tutorial afirmaba que «si lo dejas vacío MaKo usa uno por defecto». Ese default es
`onboarding@resend.dev`, que con una key PROPIA sólo le entrega al dueño de la cuenta de Resend: nadie
más recibe nada. Medido el 09/10: el ws4 tiene su key y ningún remitente.

⚠️ **El arreglo obvio —marcarlo obligatorio— rompía otra cosa.** `opcional` es la entrada que ya tiene
escrita «no es un rótulo» (04/10, arriba): lo leen los tres lectores de «conectado», y uno de ellos es la
puerta de `/email` (`integracionConectada('email')` → `PanelActivacion`). La tab se abre con la key sola
porque ES donde se verifica el dominio desde MaKo. Obligatorio, el remitente dejaba esa tab detrás de la
activación justo a quien tiene que entrar a verificar para poder escribir el remitente: un huevo y una
gallina. **Son dos preguntas —«¿se puede abrir?» y «¿sale algo?»— y cada una va en su campo**: `opcional`
sigue contestando la primera y `sinEsto` (una frase: qué no anda sin él) la segunda. El campo se pinta
«falta» en ámbar, la tarjeta de Email pasa a «Por configurar» con el motivo (sólo si el remitente que se
va a usar es el sandbox, leído con `remitenteEsSandbox`, que mira también el setting de `/email`), y el
paso del tutorial que mentía dice lo que pasa.

Y el remitente que se escribe tiene que servir: el ping de Email ya traía los dominios de la cuenta para
el detalle, así que juzga ahí el remitente antes de guardar (correo inválido, el sandbox, un dominio que
no está en ESA cuenta o que Resend declara sin verificar). **Generoso a propósito**: frenar uno que anda
es peor que dejar pasar uno que no (el segundo es lo de antes); por eso acepta un subdominio del
verificado y los estados que Resend no declara rotos.

## La ayuda de un campo: el link arriba, «Cómo configurarlo» con rótulo, la nota adentro (09/10/2026)

**Vive en:** `app/integraciones/ServicioConfigForm.tsx` (`PasosAyuda`, el bloque de cada campo) ·
`tests/resend-remitente.test.ts` (los dos tests del punto 13)

Punto 13 del mismo audio: «el link para sacar la key, ARRIBA del todo»; el «?» dentro del campo «pasa
desapercibido»; el texto gris de debajo del campo «no lo va a leer nadie»; y un «Cómo configurarlo»
visible debajo del campo que al abrirse dé el link directo a la página de keys.

- El link del proveedor va primero, como botón, y después los pasos.
- El «?» de la barra se fue: la ayuda es un «Cómo configurarlo ⌄» con rótulo, debajo del campo, sólo
  mientras la credencial no está guardada. Es la misma lección que el «Guardar» con rótulo que ya está en
  ese archivo: un ícono hay que ir a buscarlo, y sólo lo busca quien ya sabe que ahí hay algo.
- ⚠️ **La nota no se borró: se mudó adentro de la ayuda.** Algunas dicen algo que los pasos no dicen («Lo
  completa MaKo», «con el prefijo act_»); borrarla por «no la lee nadie» habría perdido esas.

**Vale para TODAS las integraciones**, no sólo Resend: es el formulario común. Y Customer Success monta
este mismo formulario adentro del aviso del invitar del curso, así que allá cambia igual.

**Lo que quedó sin hacer:**
- **Verlo con clics en producción** (ws3) después del deploy: los tests fijan la forma del código, no cómo
  se ve.
- **El punto 14 (conectar el correo con Google/Gmail, como el QR del WhatsApp)**: espera la verificación
  de la app OAuth de Google, que sigue trabada (falta que Martín entre con martinkoncke@gmail.com en el
  Chrome conectado).

_09/10/2026 — sin subagentes; `tests/resend-remitente.test.ts` probado con 7 roturas (1 fallo cada una,
2 la del juez). Typecheck 0; npm test 6339/0._

## Stripe y Mercado Pago como integraciones (11/10/2026, la pasarela de pagos)

El modelo entero de la pasarela vive en [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md) →
«La pasarela». Acá, lo que es de la tab y de las credenciales.

### El molde de Meta era el diagnóstico equivocado: guarda la clave SIN probarla

**Síntoma (evitado):** una clave de Stripe rota quedaba guardada con un mensaje que decía «Guardada».
**Causa:** `guardarCampo` (`ServicioConfigForm.tsx`) cuenta los campos `auto` obligatorios como
faltantes y, si falta alguno, guarda sin probar. Meta lo tapa porque su descubrimiento corre al toque y
pisa el mensaje, pero su token también queda guardado sin probar. **Regla:** si los obligatorios de una
integración se DERIVAN de una clave, la clave va directo al descubrimiento (`descubrir-pago`), que le
pregunta al proveedor primero y guarda TODO junto sólo si la acepta. Meta tiene el mismo agujero y no se
tocó. **Vive en:** `app/integraciones/ServicioConfigForm.tsx` · `lib/cobros-conexion.ts`.

### El ruteo de un webhook sólo se AGREGA: cambiar de cuenta deja la vieja reclamada

**Causa:** `guardarCredencial` sólo agrega filas a `webhook_routing`, y `borrarRoutingDeWs` se lleva
TODAS las del servicio. **Regla:** quien reemplaza un identificador de ruteo suelta el anterior con
`soltarIdentificador(servicio, id, ws)`. Afecta también a `META_PAGE_ID` (no se tocó).
**Vive en:** `lib/webhook-routing.ts` · `lib/cobros-conexion.ts`.

### Quitar la R2 de Calendly se llevaba el ruteo de la R1 (16/10/2026)

**Síntoma (latente, encontrado leyendo, no reportado):** un negocio borra en Integraciones el «Tipo de
evento de R2» y desde ese momento sus reservas de la R1 contestan 200 «sin_ruteo» y no entran al CRM.
El diagnóstico obvio —«la R1 está mal cargada» o «Calendly no manda»— es el equivocado: la R1 está bien.
**Causa:** `eliminarCredencial` llama a `borrarRoutingDeWs(servicio, ws)`, que borra TODAS las filas de
`calendly` (o `calcom`) de ese workspace, y la agenda tiene DOS credenciales en el mismo servicio (y
desde la mig 0293, los eventos vinculados a una etapa). La de la R1 se iba con la de la R2.
**Arreglo:** después de borrar, `reclamarRuteoDeAgenda` (lib/agenda-evento-etapa-server.ts) vuelve a
reclamar lo que se sigue usando (la otra credencial y los vinculados); si no puede leer qué se usa, no
reclama nada y lo dice en el log. **Regla:** un servicio de `ROUTING_CREDS` con más de una fuente de
identificadores no puede usar el borrado por servicio sin volver a reclamar; y para soltar UNO se usa
`soltarIdentificador` después de preguntar si alguien más lo usa.
**Y el ruteo compara EXACTO** (sólo los emails bajan a minúsculas), mientras `clasificarJunta` es
tolerante: la R1 cargada con otra mayúscula clasifica y no rutea. Medido en producción el 16/10/2026:
las únicas filas de agenda son las 2 de Calendly del ws1 (nombres con mayúscula, como en Calendly) y las
2 de Cal.com del ws13 (slugs): hoy no muerde a nadie.
**Vive en:** `lib/credenciales.ts` (`eliminarCredencial`) · `lib/webhook-routing.ts` ·
`lib/agenda-evento-etapa-server.ts` · `tests/agenda-evento-etapa.test.ts`.

### Reclamar el id de la cuenta ANTES de guardar la clave

Así, si la cuenta ya es de otro workspace, contesta 409 y no guarda nada — y de paso impide que un
cliente pegue como suya la clave de cobro de MaKo, sin una lista aparte (siempre que la plataforma la haya
conectado primero). Los tres ids derivados (`STRIPE_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`,
`MERCADOPAGO_USER_ID`) llevan `derivado: true` en el catálogo y las dos rutas de guardar los descartan: un
`acct_` tipeado a mano secuestraría los avisos de otro negocio.
**Vive en:** `lib/cobros-conexion.ts` · `lib/metodo-catalogo.ts` · `app/api/integraciones/credencial/route.ts` · `app/api/metodo/route.ts`.

### La clave del aviso de Mercado Pago sólo existe en su panel

No hay API para leerla, las suscripciones sólo avisan por la URL del panel (crear una suscripción no
acepta URL de aviso) y los pagos de prueba también. Por eso es opcional con un `sinEsto` que dice qué se
pierde: si no está, casi seguro el paso del panel no se hizo. El aviso de Stripe, en cambio, lo registra
MaKo solo (y su `whsec_` vuelve SÓLO al crearlo: si ya hay uno nuestro, se borra y se crea otro).
**Vive en:** `lib/metodo-catalogo.ts` · `lib/stripe-api.ts` (`asegurarWebhookStripe`).

_11/10/2026 — pasarela de pagos; `tests/cobros-conexion.test.ts` (7, probado con 5 roturas) y
`tests/pasarela-sin-env.test.ts`._

### Quitar la clave de una pasarela no la desconectaba (15/10/2026)

**Síntoma (revisión del 11/10):** el negocio quita su clave de Stripe en /integraciones y la tarjeta se
apaga, pero la cuenta sigue reclamada: al conectarla en otro workspace sale «quítala de ahí primero», y
desde la pantalla no hay cómo (los derivados no se ven). En su cuenta de Stripe queda el aviso de MaKo
apuntando a un MaKo que ya no lo acepta: Stripe reintenta tres días y le manda mails de fallo.
**Causa:** la acción `borrar` borra UN campo. Los derivados (`STRIPE_ACCOUNT_ID`, la firma, el
`MERCADOPAGO_USER_ID`) se escriben solos al conectar y nadie los borraba; y el ruteo se va sólo cuando se
borra el campo que está en `ROUTING_CREDS` (el id de la cuenta), no la clave.
**Regla:** una credencial con derivados se desconecta ENTERA (`desconectarPasarela`): lo que MaKo registró
AFUERA (el aviso en Stripe) se saca primero, con la clave todavía guardada —después no hay con qué—; si
eso falla, se desconecta igual y se le dice dónde borrarlo. Cada campo se borra aunque no se pueda leer: una
fila que no descifra o un ruteo sin su fila también atan la cuenta. En Mercado Pago el aviso vive en SU
panel y sólo se le puede decir.
**La trampa del aviso:** buscar el nuestro por la URL EXACTA deja vivos los de un dominio viejo (cada mudanza
de dominio suma uno muerto en la cuenta de cada negocio). Se reconoce por el camino y la cuenta
(`/api/webhooks/stripe?acct=…`) más `metadata.mako = '1'`; sin la metadata se llevaría el de otro sistema
que use el mismo camino.
**Vive en:** `lib/cobros-conexion.ts` (`desconectarPasarela`, `CAMPOS_PASARELA`) · `lib/stripe-api.ts`
(`avisosNuestros`, `borrarWebhooksStripe`) · acción `borrar` de `app/api/integraciones/credencial/route.ts` ·
`tests/cobros-conexion.test.ts` · `tests/stripe-api.test.ts`.

### Prohibir el lector no alcanza: la hidratación ESCRIBÍA las claves de cobro en process.env (15/10/2026)

**Síntoma (revisión del 11/10):** había un barrido que prohíbe leer `STRIPE_*`/`MERCADOPAGO_*` de
`process.env`, `envCred` o `credWs`, y aun así las claves de cobro del ws1 (Mauricio, un CLIENTE)
quedaban en el entorno de cada proceso.
**Causa:** `aplicarAEnv` (el boot y cada `guardarCredencial` del ws1) refleja al entorno TODO lo del ws1. El
barrido miraba a quien lee, no a quien escribe: cualquier `credWs`/`credWsEstricta` de otro camino, o el
«ojito» de `revelar` (que leía con `credWs`), caía en ellas.
**Regla:** una clave que es sólo por workspace se corta en la ESCRITURA al entorno (`CLAVES_DE_PASARELA` en
`aplicarAEnv`), además de en los lectores. Y lo que se revela de una pasarela se lee con `credDelCliente`.
**Vive en:** `lib/credenciales.ts` (`CLAVES_DE_PASARELA`, `esClaveDePasarela`) · `tests/cobros-conexion.test.ts`
(caso 12 del hijo: conecta y bootea el ws1 y mira `process.env`).

## Los tutoriales de conexión: el guard estaba ciego, y un tutorial son 3 a 5 pasos (12/10/2026)

**Síntoma** (Martín, la prueba con Fiesta Music): «los tutoriales para conectar APIs están muy largos». Medido: 55
tutoriales con 648 pasos. El de Meta tenía 29 pasos, y 41 de sus 46 notas pasaban de 120 caracteres (la más larga, 393).

### El guard que debía frenarlo leía cero líneas

`tests/tutoriales-legibles.test.ts` («cada paso hace UNA cosa») buscaba los pasos con `^ {6}'`, y los pasos están a 8
espacios. Además miraba sólo los servicios, nunca `AYUDA_CAMPO`. Leía 0 líneas y pasaba en verde. Con el extractor
corregido, sobre el catálogo viejo marcaba 6 pasos de Meta con 3 o 4 verbos (el relevo había medido 2: miraba sólo los
servicios).

**La regla:** todo extractor de un guard lleva un PISO (`assert.ok(leidos.length > N)`), así falla si lee cero. Y un
guard nuevo se prueba también sobre el texto VIEJO: si lo deja pasar, no mide nada.

### El formato

La regla vive en [AGENTS.md](../AGENTS.md), junto a «La regla del tutorial de un campo». Lo que no dice ahí:
- Las explicaciones se fueron a propósito: qué es una API key o un webhook, los planes gratis de Resend y OpenRouter, el
  portugués de Panda y los menús en inglés de Google.
- Las trampas quedaron DENTRO del paso: «se ve UNA vez», «Nunca», «Full access», `rk_live_`, `APP_USR-`, «Public Key no
  sirve», «NO COMERCIAL» y «Never expires».
- Se borró `AYUDA_CAMPO.META_ACCESS_TOKEN`, que repetía el tutorial del servicio paso por paso: su «?» cae al tutorial.
- Quedaron 54 tutoriales con 250 pasos.

### Una mentira que el acortado destapó

El tutorial de Cal.com decía «Opcional — "Tipo de evento de R1"», y el campo es OBLIGATORIO: rutea el webhook. Es el
mismo error que tuvo Calendly el 04/10, y su guard (`tests/calendly-sin-tipos.test.ts`) mira sólo Calendly. Quedó
corregido en el texto, sin guard.

**Lo que quedó SIN hacer:**
- Martín mira Meta, Resend, Cal.com y Fathom antes del push. Lo que se cayó al acortar: en Meta, «tienes que ser
  administrador del portafolio comercial»; en Stripe, «la verificación que te pide» y `rk_test_`; en Fathom, «External
  Recordings»; en Calendly, los planes pagos.
- ~~El guard de «opcional» para `calcom`~~ y ~~lo sin medir~~: cerrados el 13/10, abajo.

### 13/10/2026: el guard de «opcional», para TODOS los servicios, y lo que nadie medía

**El guard de Calendly no se copió a Cal.com: se generalizó.** `tests/tutorial-opcional.test.ts` recorre los 19
servicios y exige que todo paso que diga «opcional» NOMBRE su campo entre comillas, y que ese campo tenga
`opcional: true`. Una regla aplicada en un servicio de dos estaba documentada, no implementada: copiarla a un tercero
dejaba el cuarto igual. Tres falsos positivos que hubo que separar antes de que diera verde sobre el catálogo sano:

- **El último servicio se comía `AYUDA_CAMPO`**: sin el tope en `\n];`, el bloque de Mercado Pago seguía hasta el final
  del archivo y le atribuía las ayudas de todos los campos.
- **«"API key 2"» no es un campo del catálogo**: la casilla de una cuenta extra la agrega el código (`cuentasExtra`).
  Un nombre que termina en número se da por nombrado.
- **«"OAuth"» nombra los TRES campos OAuth de YouTube**: se cuenta por prefijo (`OAuth Client ID`, `… secret`, `…
  Refresh token`), y los tres son opcionales.

Lo que el guard NO ve: un «opcional» escrito como «no hace falta» o «puedes dejarlo vacío». Mira la palabra.

**Lo que nadie medía.** El recuadro amarillo del paso externo y las slides del panel negro se dibujan igual que los
pasos, y el 12/10 sólo se midieron los pasos. Medido el 13/10, con el mismo tope de 120:

| Texto | Leídos | De más de 120 |
|---|---|---|
| `pasoExterno.porque` | 3 | 2 (Fathom 154, Cal.com 126) |
| `pasoExterno.donde` | 3 | 2 (Fathom 123, Mercado Pago 145) |
| `sinEsto` | 3 | 0 |
| `SLIDES` (`lib/servicio-slides.ts`, no `IntegracionesBoard.tsx`) | 45 | 9 (la más larga, 179) |

Se condensaron sin sumar nada, y quedaron fijados en `tests/tutoriales-legibles.test.ts` (dos tests nuevos, 7 en total).
Al condensar «Te propone, no decide» se fue también **«deja un borrador con preguntas»**, que era falso: desde el
05/10/2026 el alta no pregunta (`tests/alta-sin-preguntas.test.ts`).

**Lo que quedó SIN hacer:** las slides de `anthropic` (la tarjeta «MaKo IA (Anthropic)») afirman lo contrario del veto
de Claude: «Sin esta llave, MaKo no piensa» y «Tú eliges el modelo: Opus para el análisis pesado, Sonnet para lo
conversacional». Hoy Claude está vetado salvo excepción escrita (`lib/veto-claude.ts`) y MaKo corre en la cascada
gratis. No es un problema de largo —miden menos de 120— sino de lo que afirman, y reescribirlas es decidir qué se le
promete al cliente. Lo mismo, más chico, en la de `openai` («en vez de gastar Claude»).

**Vive en:** `lib/metodo-catalogo.ts` · `lib/servicio-slides.ts` · `tests/tutorial-opcional.test.ts` ·
`tests/tutoriales-legibles.test.ts` · `tests/calendly-sin-tipos.test.ts`.

_13/10/2026 — cierre de lo planificado (cuenta 3 → claude2). `tests/tutorial-opcional.test.ts` probado rompiéndolo con
la base en 0: el «Opcional: en "Tipo de evento de R1"» de vuelta en Cal.com y un «opcional» sin nombrar campo dan 1
fallo cada uno. Los dos tests nuevos de `tutoriales-legibles`: el `donde` de Mercado Pago a 145, el `porque` de Fathom
a 154 y la slide de 179 de vuelta dan 1 fallo cada uno (base 7/0)._

_12/10/2026 — duodécima tanda, paquete «fuera»: `tests/tutoriales-legibles.test.ts`, 6 tests. Con el catálogo viejo, 4
fallos; un paso con 4 verbos, un sexto paso, un paso partido con `+`, una nota de 121, el «Para qué sirve» de vuelta y el
extractor a 6 espacios dan 1 fallo cada uno._

## Conectar sin salir de la tab: la pieza ya existía, y lo que le faltaba no se veía (14/10/2026)

**El pedido** (Martín, textual): «si una persona entra allí y no tiene el google calendar conectado, que salte el modal
que tenemos en integraciones allí mismo... Esto como regla siempre, en todas las tabs, para una integración jamás se
debe salir de la tab». La regla está en AGENTS.md («Para conectar una integración JAMÁS se sale de la tab»).

**El diagnóstico obvio era el equivocado: no hacía falta un modal nuevo.** `ServicioSuelto` (el `ServicioModal` de la
grilla abierto en otra pestaña) existía desde el 12/10 para Zernio en Automations. Lo que faltaba para usarlo en
cualquier tab eran cuatro cosas que no se ven hasta que se monta en otro lado:

1. **El OAuth de Google volvía SIEMPRE a /integraciones.** El callback armaba el destino a mano. Ahora el botón manda
   `?volver=` (la tab, sin el `?ws=`: `volverDeLaPestana`, lib/integracion-en-tab.ts), el paso 1 lo guarda saneado en la
   cookie `gcal_volver` con la MISMA defensa de host que Meta (`volverSeguro`) y el callback vuelve ahí con
   `?gcal=<resultado>` (`destinoGcal`, lib/gcal-estado.ts). La tab que ofrece Google lee esa vuelta (`useVueltaDeGoogle`
   / `VueltaDeGoogle`): con un fallo, reabre el modal con el mensaje de `GCAL_MSG`. Meta ya volvía a la tab (su
   `meta_volver`, desde el 07/10).
2. **`ServicioSuelto` pasaba `gcal={null}`**: abierto suelto, Google decía «Conectar» aunque la agenda estuviera
   conectada a medias, y el chip no podía decir «Falta permiso». Ahora pide el permiso real
   (`getGoogleCalendarStatusAction`) como la grilla.
3. **Montado adentro de otra cosa, un modal sin portal se rompe de tres formas**, y ninguna da error: un
   `position: fixed` bajo un ancestro con `transform` (la animación de un `<Modal>`) se ubica contra ese ancestro; el
   Escape lo contestaba el `<Modal>` de abajo, que no sabía que había otro encima (`ModalShell` no está en la pila); y un
   clic adentro burbujea por el árbol de React hasta el `onClick` de quien lo montó (en la Calificación del CRM, la
   tarjeta abría su sí/no). La capa (`CapaIntegracion`, app/_components/ConectarIntegracion.tsx) va por portal al
   `body`, se anota en la pila como `anidada` y frena la propagación; el botón también.
4. **«No cabe en un modal» no era cierto para Stripe y Mercado Pago.** El CRON de Automations abría /integraciones en una
   ventana emergente con ese porqué; son servicios de `ServicioConfigForm` como cualquier otro y se abren sueltos.

**Lo que NO se abre suelto, y por qué sigue siendo un link:** la landing (el código del Pixel, sus páginas y la prueba)
y el agente de Claude (el token y la skill) necesitan datos que arma el `page.tsx` de /integraciones (`SIN_MODAL_SUELTO`).
Tampoco lo que viaja afuera (un aviso de WhatsApp, un mail: no hay tab) ni «ir a mirar» (el saldo de la IA). La lista
completa, con el porqué de cada archivo, está en `tests/integracion-sin-salir.test.ts` (`QUEDAN`), que barre `app/`.

**Lo que quedó SIN hacer:**

- **General y el Dashboard** los pasó su propia sesión (`abd91fdb`: la acción del día, las alertas del semáforo y
  «Conectar una IA» del AI Analyst). Quedan yendo a la grilla, a propósito, los que no nombran una integración (el
  «Conectar» del semáforo sin fuentes, lo que arman `lib/focus.ts` y `lib/vista-general-modelo.ts`).
  `app/dashboard/NuevaHoja.tsx` (el `TextoConLink` del fallo de la IA) ya abre el modal: `cd88308bb`, medido el 14/10.
  El barrido no lo habría visto, porque el link llega en una variable.
- **Abrir suelta la landing y el agente** pediría mudar su armado del `page.tsx` a una server action como
  `integracionAction`.
- **Las tabs que ofrecen Google y no montan la vuelta** pierden el mensaje si el OAuth falla (el parámetro queda en la
  URL sin leer). Hoy la montan el Calendario y el CRM.

**Vive en:** `app/_components/ConectarIntegracion.tsx` · `app/integraciones/ServicioSuelto.tsx` ·
`app/integraciones/IntegracionesBoard.tsx` (`ServicioModal`, la acción de Google) · `lib/integracion-en-tab.ts` ·
`lib/gcal-estado.ts` · `app/api/integraciones/google-calendar/route.ts` · `app/api/integraciones/google-calendar/callback/route.ts` ·
`tests/integracion-sin-salir.test.ts` · `tests/gcal-estado.test.ts`. *14/10/2026, claude2.*

## Hotmart y Skool: un webhook que sólo trae un SECRETO se rutea por su hash (14/10/2026)

**Vive en:** `lib/ruteo-hash.ts` · `lib/webhook-routing.ts` (`ROUTING_CREDS`) · `lib/credenciales.ts` ·
`app/api/webhooks/hotmart/route.ts` · `app/api/webhooks/skool/route.ts` · `lib/fuentes-leads.ts`

Las primeras fuentes del Leads Scraper (`docs/diseno-leads-scraper.md`). Lo que no se ve leyendo el código:

- **Ni Hotmart ni Skool traen un identificador público de la cuenta.** Stripe trae `?acct=` y Mercado
  Pago un `user_id`; acá lo único que llega es un SECRETO (el `hottok` en `X-HOTMART-HOTTOK`, y la clave
  que el negocio inventa para el Zap de Skool en `X-MaKo-Clave`). La regla de la casa es que un secreto
  no va en claro a `webhook_routing`. La salida fue la de los tokens de la API de MaKo: la fila guarda el
  **sha256** (`identificadorDeRuteo`, aplicado en el guardado de la credencial) y el webhook compara el
  header contra la credencial del workspace en tiempo constante (`igualesSeguro`). Un secreto nuevo que
  rutee va a `RUTEO_POR_HASH`; `tests/fuentes-leads-webhooks.test.ts` falla si el guardado deja de
  hashearlo.
- **El hottok no se puede verificar contra nada** (no abre ninguna API) y la clave de Skool la inventa el
  negocio: el ping dice que está guardado, como el «Secret» de Cal.com. La primera prueba real es el
  primer aviso.
- **La forma del cuerpo de Hotmart salió de un repo público** (`trichains/hotmart-webhooks`, MIT, que
  modela los ejemplos oficiales v2.0.0) y no de un aviso real: el teléfono de una compra viene PARTIDO
  (`checkout_phone` + `checkout_phone_code`, el DDD de Brasil) y el del carrito abandonado ENTERO y con
  el país. Con un comprador de México o Argentina no se sabe si `checkout_phone` trae el código de país:
  **no medido**. Se mira en el «Histórico» del webhook de Hotmart con la primera cuenta que se conecte.
- **Los nombres de las pantallas de Hotmart del tutorial salen de guías en inglés y portugués**, no de la
  pantalla en español. **No medido.**
- **El cuerpo de Skool lo decide el Zap, no Skool**, y los nombres crudos del trigger de Zapier tampoco
  están medidos. El lector busca por el SIGNIFICADO de la clave (email, nombre, «answer»/«respuesta»), y
  una clave que no dice nada (un id, un link, una fecha) no entra como respuesta: llenaría la ficha de
  ruido. Ojo con `email_verified: true`: sin validar el VALOR, tapaba al email de verdad.

### Lo que quedó SIN hacer, con su archivo

- **Una compra de Hotmart no dispara el CRON «Pagos» de Automations.** Se decidió NO llamar a
  `enrolarPorPago` desde `lib/fuentes-leads.ts`: el CRON «Pagos» se apaga si no hay Stripe o Mercado Pago
  conectados (`estadoMedios`, `lib/disparadores-canales.ts`), así que a un negocio que sólo vende por
  Hotmart no le serviría, y a uno que tiene las dos le dispararía automatizaciones pensadas para un cobro
  de MaKo (con la condición «Pagó» en falso: Hotmart no escribe `fecha_primer_pago`). Es trabajo con el
  chat de Automations y el de Pagos.
- ~~Cada fuente entra al funnel DEL NEGOCIO~~ **Hecho el 15/10** (decisión 9, `docs/diseno-leads-scraper.md`
  §7): una compra, un pago pendiente o un carrito de Hotmart entran al funnel que declara la entrada
  «carrito» (`lib/funnel-de-entrada.ts`); con ninguno o varios, al del negocio. Un lead que ya estaba se
  AGREGA a ese funnel. Skool, sin entrada que le corresponda, sigue yendo al del negocio.
- **No hay aviso al equipo** cuando entra un lead por Hotmart o Skool (Meta tiene `lead-formulario-meta`).
  Va como un Evento de MaKo en Automations, no escondido en el webhook.

## Una pestaña que MaKo abre vacía (`about:blank`) es del MISMO ORIGEN que hola-mako.com (14/10/2026)

«Probar» del Pixel (`app/integraciones/ProbarTracking.tsx`) abre la pestaña de la landing en el clic, vacía, para no
perder el gesto (Chrome deja abrir UNA ventana por clic sin permiso de emergentes; docs/hallazgos-editor-landing.md →
«Tanda 6»). **El diagnóstico obvio («es un link a una página de afuera, no pasa nada») era el equivocado:** esa pestaña
hereda el origen de MaKo hasta que navega, así que navegarla con lo que escribió la persona corre un `javascript:…`
como si fuera MaKo (self-XSS). Y era peor: la ventana de la prueba recibe la landing por `?l=`, así que un link armado
podía dejar un `javascript:` a un clic de «Probar». Además «tu-pagina.com» sin esquema se abría RELATIVA a MaKo (un
404 nuestro).

**Regla:** una pestaña que MaKo abre vacía se navega sólo con http(s) validado con `new URL` (sin esquema se asume
https), y se valida ANTES de abrir nada. Vive en `lib/landing-paginas.ts` (`urlParaAbrir`) y `ProbarTracking.tsx`
(`af8a5aca7`).

*15/10/2026, chat «Landing Generator» (`claude1`).*

---

## «Se borra cuando entre la rama X» venció sin que nadie lo viera: el cascarón de Chatwoot (17/10/2026)

**El síntoma**: `lib/chatwoot.ts` seguía en el repo ocho días después de «borrar Chatwoot» (09/10). Su comentario, el test
`tests/sin-chatwoot.test.ts` y dos relevos decían lo mismo: no se borra porque lo importan archivos que la rama `wip/api-acciones-0910` tiene
a medio cambiar.

**El motivo estaba vencido, y nadie lo midió**: esa rama son 2 commits «WIP (sin terminar, NO pushear)» del 09/10 (222 archivos tocados) y la API de
MaKo que sirve está en `main` desde hace días. De los 5 importadores, **3 se quitaron sin conflicto posible** porque eran código muerto:
`app/crm/actions.ts` llamaba a `ensureContactoWhatsapp`, que contestaba `null` siempre (dos llamadas); el paso por el WhatsApp oficial de
`lib/nutricion.ts` ya devolvía el fallo del cascarón; y `lib/meta-templates.ts` sólo usaba `getWabaConfig`, que tiraba. Quedan dos:
`lib/api-mako/areas/whatsapp.helpers.ts` y `whatsapp.run.ts`, que registran **8 operaciones** del WhatsApp oficial (que contestan «no hay canal
oficial» desde el 09/10). Retirarlas cambia el CONTRATO de la API de MaKo (def, rest, docs, snapshot HTTP, tests del editor), y eso es del
chat de la API, no de un pendiente de limpieza.

**La regla**: un «se borra cuando entre la rama X» se vuelve a medir cada vez que alguien lo lee (`git log origin/main..X`, `git diff --stat
origin/main...X`), y la lista de importadores del test se achica por partes: `IMPORTADORES` está hecha para eso.

**Y la columna `crm_etiquetas.chatwoot_label`** (mig 0224): sin lector ni escritor — se midió por grep en app/, lib/, scripts/ y tests/ —, y
`lib/datos-mau.ts` ya la omite al copiar. La migración que la quita (`0314_quitar_crm_etiquetas_chatwoot_label.sql`) está escrita y **sin
aplicar**; el procedimiento está en `docs/relevo/integraciones.md`.

**Vive en:** lib/chatwoot.ts · lib/api-mako/areas/whatsapp.{helpers,run}.ts · tests/sin-chatwoot.test.ts · supabase/migrations/0314_quitar_crm_etiquetas_chatwoot_label.sql

---

## El ws1 no puede tener una IA propia: su fila ES el entorno de la plataforma, y la grilla decía «Conectada» (18/10/2026)

**El síntoma** (tickets #5 y #6): MaKo no le contesta a Mauricio en el chat de la app —«falló la IA (sin proveedor gratis
disponible)»— y su /integraciones dice «Conectada y operativa» en las siete IA.

**Lo medido** (sólo lectura, por huellas, con el `.env.local`): en la fila del ws1, Gemini, OpenAI y Claude son copias de
la plataforma; Groq, Mistral, OpenRouter y Cerebras salen «propias». Pero en producción la cascada no encontró **ninguna**,
y el porqué está en el código: `hidratarCredenciales` copia la fila del ws1 (`OWNER_WS`) a `process.env` en cada arranque
(`aplicarAEnv` pisa lo que hubiera), y `soloLasPropias` (lib/ai-cheap.ts) descarta toda key igual a una del entorno. En
producción, entonces, TODAS las del ws1 son «de la plataforma». La medición local no lo ve: la key del `.env.local` no es
la que usa producción (la trampa de arriba, otra vez).

**El diagnóstico obvio era el equivocado.** «Que Mauricio conecte su IA» NO lo arregla en el ws1: lo que pegue en su fila,
`guardarCredencial` lo pone en `process.env` en el acto, y cada arranque también. Su key pasa a ser LA key de la
plataforma —la red gratis de todos los negocios gastaría su cuenta, o pisaría la nuestra— y su workspace sigue sin una IA
propia. Por eso, en ESE workspace, ni el chat le ofrece «Conectar tu IA» («Ya lo está resolviendo el equipo de MaKo») ni
sus IA en /integraciones tienen formulario (dicen «La configura el equipo de MaKo», fuera de «Requiere tu atención»).

**La guarda no compara con un 1:** `WS_DEL_ENTORNO` / `esElWsDelEntorno` (lib/credenciales.ts) es la MISMA constante con la
que leen `hidratarCredenciales` y `guardarCredencial`. Si la hidratación cambia de fuente, la guarda la sigue sola; un
`ws === OWNER_WS` escrito aparte se habría quedado apuntando al ws1 (lo frena tests/mako-sin-ia.test.ts).

**La grilla** miraba `credWs` («hay algo en la fila, o el entorno si es el ws1»); la cascada pregunta «¿es SUYA?». Ahora
la tarjeta hace la pregunta de la cascada (`iaDelNegocio`: `provsDe` para las baratas, la frontera de `conClaveDelNegocio`
para Claude), y una copia dice «Esa key es la de MaKo, no la tuya», también adentro del modal.

**La regla:** una tarjeta que dice «Conectada» se calcula con la MISMA lectura que usa quien la consume. Dos lecturas de
«¿tiene X?» divergen en silencio, y la que miente es la que mira la persona.

**Y una que no se ve:** el barrido de tests/integracion-sin-salir.test.ts busca el link a /integraciones ESCRITO; un
`<Link href={`/integraciones?abrir=${servicio}`}>` armado con template literal le pasa por al lado (medido rompiéndolo: 5 / 0).

**La separación (18/10/2026, Martín: «Sí: separá el ws1 de las claves de la plataforma (que salgan del ws9 o del entorno)
para que Mauricio pueda conectar su propia IA»).** `wsDelEntorno(clave)` (lib/credenciales.ts) dice de qué workspace sale el
entorno: las de IA (`esClaveDeIA`) de la PLATAFORMA (`wsSuperAdmin()`), el resto todavía del ws1. Lo preguntan la
hidratación (dos fuentes, cada clave sólo de la suya; sin IA legible en la plataforma, un `console.error` fuerte),
`guardarCredencial`/`eliminarCredencial`, el respaldo del entorno de `credWs`/`credWsEstricta`/`estadoCampo`, `envCred`,
`esDeLaPlataforma`, la migración del arranque (que ya no copia IA del entorno a la fila de un negocio: así se sembraron las
copias) y las dos fronteras de Claude (`conClaveDelNegocio`, la tarjeta). La guarda del ws1 queda de baranda
(`esNegocioDelEntorno`) y no se dispara con nadie.

**El orden importa, y por eso la migración corre ANTES del deploy** (scripts/ia-del-ws1-a-la-plataforma.mts, aditiva e
idempotente): en producción las keys de IA del ws1 ERAN las de la plataforma (la hidratación las ponía en el entorno). Si el
código nuevo arrancara sin ellas en la plataforma, las que no coinciden con ninguna del ws9 pasarían a contar como DEL ws1
—datos de sus clientes en cuentas de la agencia—. Copiadas a casilleros libres del ws9, siguen siendo «la de MaKo» en la
fila del ws1 (`soloLasPropias` compara contra las filas de la plataforma) y la plataforma conserva su capacidad.

**Lo que quedó SIN hacer:**
- **La Cerebras del ws1** no coincide con ninguna de la plataforma ni con el `.env.local`, y Cerebras admite una sola cuenta
  (la del ws9 es otra): no se copió. Con el código nuevo cuenta como DEL ws1. Si es de MaKo, hay que sacarla de esa fila
  (decisión; nunca se escribe en el ws1 para probar).
- **Lo que no es IA sigue saliendo del ws1** (Meta, Calendly, Fathom, Resend, Panda, YouTube…): el mismo problema, para otra
  decisión. Y las settings de plataforma que viven en el ws1 (`runWithWorkspace(OWNER_WS, …)`): `mako.modelos`
  (lib/model-registry.ts), `mako.claude.pausa` (lib/anthropic.ts), el canal de MaKo (lib/mako-canal.ts, lib/linea-plataforma.ts),
  los guiones (lib/guion-*-store.ts), lib/copywriting-metodo.ts, lib/mako-grupo.ts y el Plan (lib/plan-*.ts).
- **El gasto de Claude con la key de la plataforma se anota al ws1** (lib/anthropic-usage.ts: `ws === OWNER_WS`), y
  `claudePropio` de la API de MaKo da sí al ws1 por ser el dueño (lib/api-mako/areas/integraciones.run.ts). Contabilidad y
  la vista del modelo: no se tocaron.
- «Datos de Mau» (lib/datos-mau.ts) copia las credenciales del ws1 a un workspace de prueba, IA incluida (copias: siguen
  marcadas). Y otros lugares que le piden una key de IA a un negocio (el onboarding, /metodo) no se revisaron.

**Vive en:** lib/integraciones.ts (`iaDelNegocio`) · lib/ia-keys.ts (`veredictoDeIA`) · lib/credenciales.ts · lib/ai-cheap.ts (`soloLasPropias`) · app/integraciones/IntegracionesBoard.tsx · tests/mako-sin-ia.test.ts

## El número de la URL de Fathom no es el `recording_id` (18/10/2026)

- **Síntoma:** Martín pasó «683162143 y 738834138» para analizar dos llamadas, y `scripts/fathom-a-claude.ts` daba 404 con esos números.
- **Causa:** son el id de la URL de la grabación en Fathom (`fathom.video/calls/<id>`), no el `recording_id` de la API. El chat Debate los resolvió buscando la llamada por esa URL.
- **Regla:** cuando Martín pasa un número de Fathom, primero hay que ver si es de la URL. 683162143 es la del 21/5 y 738834138 la del 8/7, las dos con Mauricio.

## «Under review» no quiere decir que Google esté revisando: la verificación esperaba un mail nuestro (21/10/2026)

- **Síntoma:** la verificación de la app de Google (proyecto `mako-500317`) se envió el 10/10 y a los 11 días seguía
  diciendo «Your app's data access is under review». Parecía que Google tardaba.
- **Causa real:** el 11/10 Google marcó un problema («App functionality: your demo video does not show the OAuth consent
  flow») y mandó un mail a martinkoncke@ pidiendo un video nuevo. Nadie lo contestó. El cartel general no cambia: el
  problema se ve sólo entrando a «View verification progress», ítem por ítem.
- **Por qué el diagnóstico obvio era el equivocado:** «Google está lento» llevaba a esperar o a escribirle a soporte. Lo
  que destraba es contestar ese hilo.
- **La regla:** después de enviar una verificación a Google (o una revisión a Meta), alguien revisa cada dos días el
  progreso ítem por ítem y el correo donde llegan los avisos. Google contesta en un hilo de
  `api-oauth-dev-verification-reply`, y la revisión sigue recién cuando se responde ahí.
- **El video que pide Google** se graba con una cuenta a la que se le borró el acceso a MaKo antes de grabar. Si no,
  Google esconde los permisos detrás de «already has some access». El cómo, y los clics que el clasificador de Claude no
  deja hacer, están en [verificacion-google.md](verificacion-google.md).
- **Lo que quedó SIN hacer (21/10):** subir el video nuevo, crear la cuenta del revisor y contestar el hilo. Le toca a
  Martín.

**Vive en:** docs/verificacion-google.md · lib/google-calendar.ts (`GCAL_SCOPE`) · app/api/integraciones/google-calendar/route.ts

## La vuelta de un OAuth pegaba `?ws=` siempre, y al super admin lo ponía en «vista de cliente» de sí mismo (21/10/2026)

- **Síntoma:** Martín volvió de «Reconectar con Meta» en su propio negocio (ws9) con el cartel «Estás viendo el
  dashboard de Martin Koncke como administrador / SALIR DE LA VISTA», y la barra decía «CLIENTE».
- **Causa:** los callbacks de Meta y de Google Calendar vuelven con `conWs(destino, ws)`, o sea con el negocio destino
  en `?ws=`, SIEMPRE. Para el proxy, cualquier `?ws=` de un admin de plataforma es una pestaña de cliente, aunque sea
  la suya (`estaImpersonando` → `wsDePestana`).
- **Lo que NO es (la sospecha era grave y no se confirma):** a un admin común no le puede pasar. `headersSeguros`
  (proxy.ts) sólo convierte el `?ws=` en pestaña si la sesión firmada es `rol === 'admin'`; para cualquier otro usuario
  es texto decorativo. Ningún cliente se ve «como administrador» de otro por este camino.
- **La regla:** la vuelta lleva `?ws=` sólo si hace falta para caer en ese negocio, o sea cuando el destino NO es al
  que cae la sesión sin pestaña (`wsDeVuelta`, lib/ws-tab.ts). Ese negocio sale de `adminDeWorkspaceActual()`, y NO de
  `getWorkspaceActual()`: el callback no puede leer el negocio de la sesión, porque el negocio donde se ESCRIBE sale de la
  cookie (lo fija tests/meta-login.test.ts, y el primer intento de este arreglo lo rompió). El super admin que conecta
  parado adentro de un cliente sigue volviendo a la pestaña del cliente.
- **Lo que quedó SIN hacer:** los pasos 1 (`app/api/integraciones/meta/route.ts` y `google-calendar/route.ts`) todavía
  pegan el ws en sus salidas de error. Sólo pasa si falla antes de ir a Meta o Google, y en ese caso el pedido casi
  siempre ya venía con la pestaña.

**Vive en:** lib/ws-tab.ts (`wsDeVuelta`) · app/api/integraciones/meta/callback/ · app/api/integraciones/google-calendar/callback/ · tests/ws-vuelta-oauth.test.ts

## La agenda del CRM era lenta: tres APIs en fila, y el usuario de Calendly antes de cada lista (23/10/2026)

- **Síntoma** (Martín, 22/10, en el ws1): «Vincular evento» tarda al abrir, al vincular y al «Conectar Cal».
- **Causa, leída en el código:** `listarEventosDeAgenda` (lib/agenda-evento-etapa-server.ts) esperaba a Calendly, después
  a Cal.com y después a Google: la suma de los tres. `prepararVinculo` vuelve a listar la cuenta para validar. Y
  `listarEventTypes` de Calendly pedía `GET /users/me` antes de cada lista y de cada evento creado: dos viajes en fila.
- **Lo que quedó:** todo a la vez (la base, cada agenda y Google). La lista de cada cuenta se guarda un minuto
  (lib/agenda-cache.ts), y el usuario de cada token, para siempre (no cambia). Crear o editar un evento olvida la lista de
  esa cuenta.
- **La trampa de la llave:** esa lista decide QUÉ se puede vincular (`prepararVinculo`: sólo eventos de SU cuenta, porque
  los identificadores no son secretos). Por eso la llave lleva el negocio y la huella del secreto (nunca el secreto). Con
  la huella, conectar otra cuenta cambia la llave y nunca se ve la lista de la anterior: «Conectar Cal» no borra nada.
- **Lo guardado se copia:** `eventosDelProveedor` le suma a la lista las R1/R2 que la cuenta no devolvió. Sin la copia,
  eso ensuciaba lo guardado y cada lectura sumaba otra vez.
- **El contrato con Cobros** (su fase B, varias cuentas por proveedor, va encima): `eventosDelProveedor(proveedor)` es LA
  unidad de lectura de una cuenta, la llave le suma la cuenta, y Calendly recibe el token por parámetro.

«Volver a leer» del pop-up pide `fresco` (`leer(true)` en app/crm/EventosDeEtapaModal.tsx); abrirlo y «Conectar» no.

**Sin hacer:** sin medir en producción. La caché vive en la memoria de cada instancia.

**Vive en:** lib/agenda-cache.ts · lib/agenda-evento-etapa-server.ts (`eventosDelProveedor`, `listarEventosDeAgenda`,
`olvidarCuentas`) · lib/calendly-agenda.ts (`usuarioUri`) · tests/agenda-velocidad-23-10.test.ts
*23/10/2026, chat «CRM» (claude3).*

## Varias cuentas por pasarela: una cuenta es un SUFIJO, y todo lo que miraba el nombre exacto la dejaba afuera (22/10/2026)

Martín pidió dos cuentas de Stripe, dos de Mercado Pago (y dos de Calendly o Cal). Medido en el ws3: no se podía; hoy
Stripe y MP sí (la agenda es la fase B, con el CRM). El modelo (lib/cuentas-integracion.ts): las claves de una cuenta
llevan un sufijo (`STRIPE_SECRET_KEY__C2`; la principal, sin sufijo, como siempre), su nombre es otra clave
(`STRIPE_ALIAS__C2`) y su id es `stripe:c2`. Lo que mordía, todo callado:

- **Las protecciones por nombre EXACTO dejaban afuera a la segunda cuenta.** `NO_MIGRAR_A_WS`, `CLAVES_DE_PASARELA`
  (`aplicarAEnv`: la clave del ws1 iba a `process.env`) y `ROUTING_CREDS`: `guardarCredencial` guardaba
  `STRIPE_ACCOUNT_ID__C2` SIN reclamar su `acct`, y los avisos de esa cuenta no llegaban a ningún negocio. Ahora todas
  preguntan por `baseDeClave(clave)`.
- **Borrar el id de UNA cuenta cortaba los avisos de TODAS.** `eliminarCredencial` llamaba `borrarRoutingDeWs(servicio,
  ws)`: todas las filas del servicio del negocio. Para Stripe y MP lee el valor antes de borrar y suelta sólo ESE
  (`soltarIdentificador`). Calendly y Cal siguen con el viejo (su R1 y R2 se vuelven a reclamar después).
- **Borrar el id de una cuenta que no descifra la dejaba reclamada para siempre:** el valor se lee antes de borrar para
  soltar SU fila, y una fila ilegible daba null. Ahora se sueltan las filas del servicio que no son de otra cuenta del
  negocio (`soltarRuteoSinCuenta`) — y si el id de alguna otra no se puede leer (estricta: la base caída tira), NO se
  suelta nada: soltar de más corta los avisos de una cuenta que cobra, y a un cliente nadie le re-siembra el ruteo.
- **La tarjeta decía «no conectada» con sólo una cuenta de más** (`integracionConectada` miraba los nombres exactos).
- **El aviso de MP de una cuenta de más no tenía dónde pegarse** (el recuadro amarillo es de la tarjeta de la principal): va
  en su fila, con la acción `aviso` de /api/integraciones/cuentas.
- **La cuenta de un aviso se busca ESTRICTA** (`cuentaDeIdentificador`): con `credDelCliente` sola, la base caída daba
  «de ninguna cuenta», MP releía con la principal, ignoraba el pago con un 200 y no volvía (MP no reintenta un 200).
- **`like` en PostgREST: `*` es el `%`, y `_` también es comodín.** `clavesGuardadasConBase` trae `clave.like.STRIPE_SECRET_KEY*`
  y filtra después por la base exacta: el `like` solo trae de más. tests/_postgrest-de-mentira.ts entiende `or=(…like…)`.
- **Los barridos fijaban la lectura de la principal letra por letra** (`credDelCliente('STRIPE_SECRET_KEY', ws)`): con la
  clave armada por `claveDeCuenta(`, un `credWs(claveDeCuenta('STRIPE_…'))` pasaba tests/pasarela-sin-env.test.ts. Su
  prefijo ahora incluye `claveDeCuenta(`.

**Vive en:** lib/cuentas-integracion.ts (puro) · lib/cuentas-pago-server.ts (`cuentasDePago`, `credStripeDe`, `credMpDe`,
`cuentaDeIdentificador`, `proximaCuentaDe`) · lib/credenciales.ts · lib/cobros-conexion.ts · app/api/integraciones/cuentas ·
app/integraciones/CuentasDePago.tsx · tests/cuentas-pago.test.ts. Lo de la plata, en docs/hallazgos-pagos.md.
**La fase B (Calendly y Cal.com, 23/10/2026)** usa el mismo sufijo (`CALENDLY_API_TOKEN__C2`, `CALCOM_WEBHOOK_SECRET__C2`;
`CLAVES_AGENDA`, lib/cuentas-agenda-server.ts). Lo que mordía:
- **El aviso de la segunda cuenta no verificaba**: los webhooks leían UN secreto por negocio, y la reserva de la otra
  cuenta daba 401 «firma rechazada» (Calendly deshabilita la suscripción después de varios no-2xx). Ahora prueban el
  secreto de cada cuenta (`cuentaQueFirmo`, puro), leídos estrictos (`firmasDeAgenda`).
- **Buscar o cancelar la reunión de un lead con UN token no ve la otra cuenta**, y cancelar con el token equivocado da
  404. `proximaReunionCalendly` busca en todas (`tokensDeAgenda`) y devuelve de cuál es; cancelar usa ese token. Una
  cuenta que no se puede leer TIRA con su nombre.
- Lo que rutea una reserva sigue siendo el TIPO DE EVENTO (R1/R2 o un vínculo de «Asignar evento»), no la cuenta.
- **«Asignar evento» por cuenta** (sobre la agenda rápida del CRM, `eventosDelProveedor` sigue siendo LA unidad de lectura):
  lee cada cuenta en paralelo con su token y su caché (la llave lleva la huella del token, así dos cuentas no comparten
  lista), y cada evento sale con su `cuenta` y `cuentaNombre`; `proveedores` pasa a ser una fila por CUENTA. Crear va a
  la cuenta elegida; EDITAR sin cuenta busca la que TIENE el evento (con el token de otra, Calendly contesta 404).
- **Un test que mockea `credWs` esconde de qué negocio se lee.** tests/calendly-cancelar.test.ts corría
  `proximaReunionCalendly` fuera de todo negocio y pasaba porque `credWs` era de mentira; buscar las cuentas de más
  necesita el negocio (`getWorkspaceActual`), y fuera de un request eso tira «cookies outside a request scope». En
  producción corre siempre dentro de uno (request o flujo con `runWithWorkspace`), así que el test pasó a correr ahí:
  ese error en un hijo es el test sin negocio, no la librería rota.
- **Tres barredoras de todo el repo frenaron la fase A en el tren 18** y no estaban entre mis tests:
  - tests/puente-panel-copy, la guarda de voseo, por un «acá».
  - tests/fuentes-leads-webhooks, que fija la línea del ruteo de lib/credenciales.ts.
  - tests/historico-al-conectar, porque toda puerta nueva que llama a `guardarCredencial` decide si arranca el histórico.
  Las de las cuentas no lo arrancan (ninguno de los cuatro proveedores tiene), y el test ahora tira si uno llega a tenerlo.
  Antes de pasar una punta que toca credenciales o copy, se corren las tres.
**Sin hacer:** la pantalla y la API de «Asignar evento» agrupadas por cuenta y el `cuenta` en crear/editar de la API de
MaKo son del CRM (las firmas ya están); el link de la R1/R2, la anticipación y las herramientas de agenda del doer siguen
con la principal (la R1/R2 es de la principal); no se detecta la misma cuenta de Calendly conectada dos veces (haría falta
guardar su `/users/me`).

## Editar un evento de Calendly o Cal.com por API: lo que se puede y lo que no (22-23/10/2026)

Martín pidió «edición COMPLETA del evento» desde el CRM. Leído en la documentación de cada una el 22 y el 23/10/2026 (sin
probar contra una cuenta real: no hay una de prueba). Desde el 23/10 el pop-up y MaKo editan nombre, duración, descripción,
dónde es la reunión y, en Cal.com, las preguntas que ya existen:

| | Calendly (API v2) | Cal.com (API v2) |
|---|---|---|
| Nombre, duración, descripción, dónde | `PATCH /event_types/{uuid}`: `name`, `duration`, **`description`** (`description_plain` es sólo de la respuesta), `locations` (`kind` + `location`). Sólo eventos uno a uno | `PATCH /event-types/{id}`: `title`, `lengthInMinutes`, `description`, `locations` (`type`: integration, address, link, phone, attendeePhone…) |
| Preguntas | **No se editan** (`custom_questions` es de lectura) | `PATCH /event-types/{id}/booking-fields`, por `slug`: texto, obligatoria, oculta. **Sólo las que existen**: agregar una pide reemplazar la lista entera, que repone las de sistema |
| Disponibilidad | Dos rutas distintas según la fuente (`/event_type_availability_schedules` y `/event_types/{uuid}/availability_schedules/{id}`), sin la forma de una regla | `scheduleId` + `PATCH /schedules/{id}` |
| Límite | 500 por minuto (pago), 50 (gratis) | 120 por minuto |

- **La disponibilidad no se edita desde MaKo:** en las dos, un PATCH reemplaza TODAS las reglas, y en Calendly ni la ruta
  está clara. El pop-up la manda a la cuenta con un link (`editarAllaDe`), en otra pestaña.
- **`locations` reemplaza la lista entera.** Con más de una ubicación (o una que no es de las comunes: Meet, Zoom, llamada,
  en persona, link), el pop-up no deja cambiarla: pisaría las otras (`ubicacionAlla`). MaKo sí, y el «sí» dice que reemplaza.
- **Cal.com versiona cada endpoint aparte con `cal-api-version`, y CAMBIA:** las preguntas piden `2026-06-12`
  (`VERSION_BOOKING_FIELDS_CALCOM`); los tipos de evento se leen y escriben con `2024-06-14` (`VERSION_EVENT_TYPES_CALCOM`;
  su documentación de hoy ya pide `2026-06-12` también para el PATCH), los horarios con `2024-06-11` y las reservas con
  `2024-08-13`. Con la versión equivocada contesta igual, con la forma vieja y sin error.
- **Una falla a medias se dice:** en Cal.com el evento y las preguntas son dos pedidos; si el segundo falla, el error dice
  «Cal.com guardó lo demás, pero no las preguntas».

**Sin hacer:** agregar o borrar preguntas en Cal.com; la disponibilidad desde MaKo; pasar los tipos de evento de Cal.com a
`2026-06-12` (probarlo con una cuenta real antes).

**Vive en:** lib/agenda-evento-detalle.ts (puro: ubicaciones, preguntas, `datosDeDetalle`) · lib/calendly-agenda.ts
(`editarEventTypeCalendly`, `detalleEventTypeCalendly`) · lib/calcom.ts (`editarEventTypeCalcom`, `detalleEventTypeCalcom`,
`editarPreguntasCalcom`) · lib/agenda-evento-etapa-server.ts (`detalleDeEventoDeAgenda`, `editarEventoDeAgenda`) ·
tests/agenda-edicion-completa-23-10.test.ts
*22-23/10/2026, chat «CRM» (claude3).*

## El tope de cuentas del plan: sólo a quien MaKo le cobra el plan, y sólo lo que SUMA una cuenta (23/10/2026)

MaKo Esencial trae «1 cuenta de Stripe o Mercado Pago» y Pro varias (docs/ofertas-mako.md; el número está en
lib/topes-plan.ts, `cobros.cuentas`). Se hace cumplir en lib/tope-cuentas.ts, y la regla pura vive en
lib/tope-cuentas-reglas.ts. Lo que no se ve:
- **La capa no alcanza para saber si hay tope.** El ws1 y los acuerdos a mano también tienen capa `completo`. Primero
  se pregunta si MaKo le cobra el plan por la pasarela (`suscripcionDeMakoDe`). Si no puede leerlo, no frena: el tope
  vende, no protege nada.
- **Hay DOS puertas que suman una cuenta, no una.** «Conectar otra» (/api/integraciones/cuentas) y la tarjeta de la
  pasarela que todavía no estaba (`descubrir-pago` en /api/integraciones/credencial). Si sólo se cierra la primera,
  Esencial conecta Stripe y Mercado Pago por las tarjetas.
- **Cambiarle la clave a la misma cuenta o volver a conectarla no suma.** El tope se mira sólo si `cuentaParaConectar`
  devuelve una cuenta que no estaba. Nunca desconecta nada ni llega a un cobro: un test exige que `topeDeCuentas`
  viva sólo en esas dos puertas.
- Se cuenta por grupo: las de cobro (Stripe y Mercado Pago juntas) y las de agenda (Calendly y Cal juntas).

**Sin hacer:** la principal de Calendly o Cal por la tarjeta genérica (`guardar` de /api/integraciones/credencial) no
mira el tope. Las ofertas sólo hablan de las de cobro. «Pasar a Pro» lleva a `RUTA_CAMBIAR_PLAN` (lib/topes-plan.ts,
/configuraciones/plan), que llega con la rama de la suscripción (`suscripcion-mako-2310`); hasta entonces ningún negocio tiene `suscripcionDeMakoDe`, así que el tope
no se aplica a nadie.

**Vive en:** lib/tope-cuentas.ts · lib/tope-cuentas-reglas.ts · app/api/integraciones/cuentas/route.ts ·
app/api/integraciones/credencial/route.ts (`descubrir-pago`) · app/integraciones/CuentasDePago.tsx ·
tests/tope-cuentas.test.ts.

## «Conectar con Facebook, Instagram o anuncios»: UNA pieza vía Zernio, con la key del negocio y sin respaldo de la plataforma (23/10/2026)

**El pedido** (Martín, vía el Cerebro, 23/10/2026): «Esta bueno que todo eso salga directo en la app... Que ellos conecten su API de Zernio y
luego cuando quieran hacer X cosa que requiera un login, que en MaKo esté el botón de logearse con Facebook, Instagram o lo que haga falta».
Hasta ese día se pegaba la key de Zernio pero **el login de cada red se hacía afuera**: con el ws1 la key se pegó a las 22:43 y la conexión
de anuncios nunca se creó (Ads Manager sacó el link a mano con `GET /v1/connect/facebook/ads`).

**Cómo quedó.** Una pieza para todas las pantallas que necesitan una red: `<ConectarViaZernio red volver onConectado>` / `useConectarViaZernio`
(`app/_components/ConectarViaZernio.tsx`), con lo del servidor en `lib/zernio-conectar.ts` y lo puro en `lib/zernio-redes.ts`. La usan el bloque
«Redes» del modal de Zernio de /integraciones (`ConectarRedes`, una fila por Facebook / Instagram / Anuncios de Meta), Instagram y Messenger
de Automations (`ConectarSocial`) y **Chats** (que antes mandaba la pestaña entera a Zernio y volvía a /automations). **Ads Manager la consumirá**
(`red="metaads"` y `conexionesViaZernio`, con el `accountId` de cada conexión: lo que pide la API de anuncios de Zernio para publicar), pero lo cablea
SU chat: al 23/10 no hay ningún llamador suyo en el repo, y la firma quedó acordada con él. **Copiada de Nango**
(Connect UI + SDK frontend: el modal es de la app y no navega, la ventana del login se abre en el MISMO clic con `window.open('')` y la URL se
asigna después, y la verdad la dice el servidor) y de las trampas de Ayrshare (origen y fuente de cada mensaje, gracia antes de dar un popup por
cancelado, nunca un WebView).

**Y sin respaldo de la plataforma** (Martín: «que cada usuario traiga su API de Zernio»; el Cerebro lo extendió a Automations): la key es SIEMPRE
la del negocio (`credDelClienteEstricta`: su fila, nunca `process.env`, y «no pude leer» tira). **Medido en producción antes (sólo lectura):** el
único workspace que dependía del respaldo era el ws3 (Cliente de Prueba) y no hay ni una conversación ni un envío de Instagram o Messenger en toda
la historia. El ws1 (Mauricio, un cliente) tiene pegada la key de la PLATAFORMA desde las 22:43, para la prueba de anuncios: el Cerebro se la saca
cuando Ads Manager termine; hasta entonces `cfg` lo deja en su modo de siempre (`byok: ws !== OWNER_WS`).

### Lo que se leyó de la API de Zernio (docs.zernio.com, 23/10/2026, por un LECTOR que resume cada página: los nombres de campos pueden venir parafraseados)

- `GET /v1/connect/{plataforma}?profileId&redirect_url` → `{ authUrl, state }`. Al volver agrega `connected=<plataforma>&profileId&accountId&username`, o
  `error=<código>&platform&request_id&stage` (`oauth_denied`, `no_facebook_pages`, `no_pages_granted`, `payment_required`, `meta_ads_authorization_denied`).
  Los parámetros propios se conservan. `redirect_url` tiene que ser absoluta (relativa: 400).
- **Anuncios:** `GET /v1/connect/facebook/ads`. Modo `classic` reutiliza el token de la cuenta de Facebook (`alreadyConnected: true` si ya tiene
  `ads_management`); `loginMode=business` crea una conexión `metaads` independiente (token de un usuario del sistema), pide una página y que quien entre
  sea admin del Business. Ads Manager mide que `business` sirve para publicar.
- **Página, Instagram y cuenta publicitaria se conectan POR SEPARADO** (2 o 3 conexiones) y **cada una cuenta aparte para el cobro**: un login de Facebook NO es una
  cuenta. Precio (leído el 23/10): 1-2 gratis (un crédito de US$12 al mes), 3.ª a 10.ª US$6, 11.ª a 100.ª US$3, desde la 101.ª US$1; desconectar deja de cobrar. La
  tarjeta de Zernio avisa en UNA línea («Zernio te cobra a ti. Cada red cuenta aparte (página, Instagram, anuncios): 2 gratis, desde la 3.ª se paga.»), y el bloque
  «Redes» dice cuántas hay conectadas.
- `GET /v1/accounts?profileId&platform&excludeHidden=true` → cuentas con `_id`, `platform`, `profileId`, `isActive`, `enabled`, `username`, `displayName`,
  `needsReconnection` (en `/accounts/health` se llama `needsReconnect`). Zernio sólo se entera de que un token venció cuando una operación real falla.
- El **402** de conectar por pasarse de 2 cuentas trae `reason: free_tier_exceeded` y el link en `dashboard_url`. Un plan legacy da `403 platform_account_limit`.
- **Lo que Ads Manager SÍ vio de verdad (23/10, con las claves que tienen; el resto del body no se imprimió):** `GET /v1/connect/facebook/ads?profileId&loginMode=business&redirect_url`
  → 200 con `authUrl` (`https://www.facebook.com/v24.0/dialog/oauth?client_id=712341431446535&config_id=1788931715593499&redirect_uri=https://zernio.com/api/v1/connect/meta-ads/callback&response_type=code&…&state=<JWE>`;
  el `state` vence a los 30 min); `GET /v1/accounts` → `{ accounts: [...] }` con `_id`, `platform` y `username`; `GET /v1/profiles` → `{ profiles: [{ _id, name, isDefault }] }`. Con eso el
  envoltorio de `/accounts` y el nombre `authUrl` dejan de ser deducciones. **Los dos links de anuncios que Martín aceptó a mano (el segundo, generado 23:19 UTC y aceptado antes de las 23:49) NO dejaron
  ninguna conexión `metaads` en las 4 claves (medido 23:29):** la causa no se sabe (¿el link vencido?, ¿falta una página?, ¿el callback de Zernio?) y es lo primero que mira la primera conexión real:
  a qué dirección terminó el navegador (`error=…`) lo dice la landing de la ventana.
- La ventana de Meta nombra a Zernio («co-branded, not white-label»): la app de Meta de Zernio es «Social Media Connector» (712341431446535, dato de Ads Manager;
  no figura en su doc).

### El diagnóstico obvio era el equivocado, y las trampas

- **«El link de pago del 402 ya se muestra»: nunca se mostró.** `app/api/zernio/route.ts` leía `billingUrl`, que NO existe en la doc de Zernio (es `dashboard_url`): el
  negocio de la cuenta pausada (ws11, 10/10) veía «pausada» sin su link. `urlDePagoDeZernio` acepta los dos y sólo https (va a un `href`).
- **`credWs` y `credWsEstricta` caen al entorno para el ws1**, que es Mauricio, un cliente, y además «la plataforma» para las claves de entorno (`wsDelEntorno`). «Leer la key
  propia» con cualquiera de las dos le da la cuenta de la casa. La lectura propia es `credDelClienteEstricta`; `credDelCliente` no sirve porque no mira el error de la base
  («no pude leer» se lee «no tiene» y el negocio ve «falta» con la base caída).
- **«Sin claves de la plataforma» no puede ser literal:** `ZERNIO_WEBHOOK_SECRET` (el secreto maestro del que se derivan los de cada negocio) sigue siendo de la casa, y no es una
  cuenta de Zernio.
- **Un popup que se ve «cerrado» NO es «canceló».** Si la red pone `Cross-Origin-Opener-Policy`, el navegador corta el vínculo con la ventana: desde la pantalla se ve cerrada
  (y `window.opener` queda en null en la landing) aunque la persona siga adentro. Dar por cancelada la conexión al ver `closed` la cortaba en el segundo en que se abría el login de Meta.
  Hoy `closed` sólo adelanta una medición y avisa; el aviso de la landing va por `window.opener.postMessage` **y** por un `BroadcastChannel` del mismo origen; y se corta a los ~4 min.
  **Es una deducción de la lectura, no se midió con un login real.**
- **`window.open` en el clic y antes de cualquier `await`, y sin `noopener`** (con él devuelve null y no se puede asignar la URL): lo fija el test con el orden de las líneas.
- **En un teléfono y en el navegador interno de Instagram/Facebook/TikTok no hay popup confiable** (Meta lo dice en su doc): la pestaña navega y VUELVE a la misma pantalla con `?zernio=<red>`;
  el hook lo lee al montar, mide con `/accounts`, y saca esos parámetros de la barra (se procesa una vez aunque haya varios botones). La lista de agentes es una deducción: se mide en un teléfono.
- **«Conectada» sale de lo que lista Zernio AHORA y no estaba ANTES** (`medirConexion`). Tres casos que rompen una versión ingenua: una cuenta ya conectada (con «hay alguna» daba conectado
  en el primer sondeo), volver a entrar con una cuenta que YA estaba (el id no cambia: sólo el `accountId` de la vuelta lo confirma, y siempre contra la lista de ahora) y no poder leer la lista
  de antes (ANTES valía «cualquiera»; ahora NADA de lo que ya estaba cuenta como nuevo: falla cerrado).
- **`volver` es del navegador y termina como `redirect_url` de un tercero:** sólo una RUTA de la app (`validarVolver`: `//evil.com`, `/\evil.com`, `https://…`, `javascript:` y `/api/…` no pasan).
- **El `?ws=` de la vuelta, sólo si hace falta** (`wsDeVuelta`): pegarlo siempre pone a un admin de plataforma en «vista de cliente» de sí mismo (21/10).
- **El sondeo cuenta contra los 60 pedidos por minuto** de un equipo con 0 a 2 cuentas: cada medición es un `GET /accounts` (a 4 s, 15 por minuto); el profile se cachea 2 minutos por negocio y por
  huella de la key (sin eso cada medición hacía un `GET /profiles` y una escritura de ruteo).
- **`conexionesViaZernio` es SOLO LECTURA** y `recibirConexion` (reclamar el ruteo de las cuentas y asegurar el webhook) se llama UNA vez, al quedar conectada una cuenta de Facebook o Instagram: sin eso
  conectar «anda» y no llega ningún mensaje, y no da error. Antes lo hacía el «estado» de la tarjeta, que ahora sigue haciéndolo para la cabecera de Automations.
- **La MISMA key en DOS negocios comparte el profile Default de esa cuenta de Zernio** (con key propia no hay un profile por negocio): el segundo vería las cuentas del primero como suyas, y el
  ruteo de sus mensajes sigue siendo del primero («el primero que reclama gana»; `profileIdEfectivo` descarta el resultado de `upsertRouting`). Lo encontró la revisión adversarial: **el
  filtro por profile de `leerCuentasDeZernio` sólo protege cuando UNA key tiene VARIOS perfiles**, no con una key repetida. Hoy la pieza se NIEGA (`clave-en-uso`) si el profile ya es de otro negocio,
  y `recibirConexion` dice `ocupado` si una cuenta quedó con otro. **SIN HACER:** que `guardarCredencial` rechace una key de Zernio ya guardada por otro negocio, y lo mismo en
  `cuentasConectadas`/«estado» de Automations (el camino viejo sigue sin mirarlo).
- **Un «Volver a conectar» de los anuncios (`force` sobre una conexión que ya anda) no tiene cambio visible:** la cuenta ya estaba sana, así que «una que antes no estaba» no existe, y darla por hecha
  con `reconectarId` cerraba la ventana a los 0,5 s, recién abierta, con «conectado ✓». `reconectarId` sólo confirma una cuenta que ANTES no estaba sana; la sana la confirma la pista (el `accountId` con que vuelve la ventana).
- **La vuelta de página entera sólo vale si ESTA pestaña la inició** (`guardarVuelta` en `sessionStorage`: red, cuentas de antes y hora; 30 minutos): un link armado a mano con `?zernio=…&connected=…` hacía que la pantalla dijera
  «conectado», armara la recepción y le entregara a quien llama (Ads Manager publica con `nueva.accountId`) una cuenta equivocada. Y `connected` de la URL ya no decide: se mide como en la ventana.
- **Un segundo clic NO cierra la ventana del primero:** las corridas comparten la ventana por su nombre y la vieja, al despertar, la cerraba con la nueva ya adentro de Meta. `cerrar()` sólo cierra al desmontar o si la corrida
  sigue siendo la vigente. El aviso de la ventana lleva el id de SU flujo: el canal es del origen entero y un error de una pestaña cortaba el login de otra.
- **`replaceState(null, …)`, no con el `state` de la página** (me equivoqué la primera vez): el parche de Next (`app-router.js`) deja pasar sin sincronizar la URL un `replaceState` cuyo state trae `__NA`; con `null` copia su estado interno y
  sincroniza `usePathname` y `useSearchParams`. Lo cazó un revisor leyendo `node_modules`, no un test.
- **«No pude leer tus credenciales» ya no es «no tienes Zernio»** (`zernioConfigurado` tragaba todo): con la base caída `estadoMedios` frenaba Publicar con «Conecta Instagram» y el modal abría «pega tu key» a un negocio que sí la tiene.

### Lo que NO se midió (se mide con la primera conexión REAL, que hace una persona: los clics de Facebook son suyos)

1. Los nombres de `alreadyConnected`, `isActive`, `enabled`, `needsReconnection` y el `profileId` de una cuenta (¿texto u objeto?): el lector es tolerante y falla cerrado (`respuesta`). `authUrl` y el envoltorio `{ accounts }` SÍ se vieron.
   **Y por qué los links a mano de anuncios no dejaron conexión** (ver arriba): si la causa es de Zernio o de la cuenta de Meta, esta pieza no la arregla, sólo la dice (`error=` en la vuelta).
2. Si el vínculo con la ventana sobrevive a la cadena Zernio → Meta → `redirect_url` (si no, el `BroadcastChannel` y el sondeo lo cubren), y cómo se ven la ventana y el login dentro del navegador de Instagram.
3. Que Zernio conserve el `?red=` de la landing de la ventana junto a sus parámetros (la doc dice que conserva los propios).
4. Si `GET /accounts` lista las conexiones `metaads` sin `platform` (Ads Manager midió que hoy no hay ninguna, así que no se sabe) y si una cuenta `metaads` con el token vencido sale con `needsReconnection`.
5. El cuerpo del 402 al conectar ANUNCIOS (¿trae `dashboard_url`?), y qué pasa al intentar una segunda conexión de anuncios por profile («una por profile»).
6. Si el modo `classic` de anuncios crea una cuenta de Facebook oculta (`enabled: false`) además de la `metaads`: la lista pide `excludeHidden=true`.

### Lo que quedó SIN hacer

- **El estado de la tarjeta de Zernio en la grilla sigue siendo «hay key».** Un «falta conectar Facebook» es un estado nuevo y toca cuatro lugares que dibujan el estado (`sevOf`, el chip de `ServicioSuelto`, «Requiere tu atención» y el teléfono); el bloque «Redes» dice el estado de cada red al abrir la tarjeta.
- ~~Traer los formularios de Meta con `lead.received`~~ **HECHO el 23/10/2026** (el reemplazo del puente de Make): ver «Los leads de los formularios de Meta por Zernio», más abajo.
- Sacar la key de la plataforma del ws1 (la coordina el Cerebro con Ads Manager) y, después, la rama `byok: false` de `ensureProfile` (queda sólo para el ws1).
- Una operación en la API de MaKo para conectar una red (`conectar_redes`: el id no puede llevar «zernio» ni «instagram», `tests/sin-instagram.test.ts`).
- El teléfono (MaKo Mobile) no tiene el bloque «Redes»: abre la computadora con `?abrir=zernio`.
- Tipos: salió «sin tipos» (política del tren): los chequea el `tsc` acotado de Integración.

**Vive en:** `lib/zernio-redes.ts` · `lib/zernio-conectar.ts` · `lib/zernio.ts` (`cfg`, `zFetch` y `profileIdEfectivo` exportados) · `lib/credenciales.ts` (`credDelClienteEstricta`) · `app/api/zernio/route.ts` ·
`app/_components/ConectarViaZernio.tsx` · `app/integraciones/ConectarRedes.tsx` · `app/integraciones/zernio-vuelta/` · `app/automations/ConectarMedio.tsx` · `app/chats/ChatsApp.tsx` ·
`tests/zernio-conectar-redes.test.ts` · `tests/zernio-sin-respaldo.test.ts`.

_23/10/2026 — pedido del Cerebro a Integraciones (cuenta 2), con el contrato cerrado con Ads Manager. Investigación: cuatro lectores en paralelo (API de conexión, cuentas y cobro, apps de referencia, mapa del código)._

## Los leads de los formularios de Meta por Zernio (`lead.received`): la misma puerta que Meta, y lo que la doc NO dice (23/10/2026)

**El pedido** (Martín, vía el Cerebro, 23/10/2026): el puente de Make o Zapier se retiró («ya resolvimos todo con Zernio») y los leads de los formularios
instantáneos de un negocio sin app propia de Meta tienen que entrar por el webhook de SU cuenta de Zernio: «Va por `upsertLeadFromMeta`, igual que el
webhook de Meta: mismo origen, sin duplicar si el lead también entra por la app propia del negocio (dedup por el leadgen_id), y con la conversión, el aviso
y las automatizaciones que dispara un lead de Meta. Ruteo estricto por la cuenta de Zernio del negocio y la deduplicación de reentregas».

**Cómo quedó.** El webhook de Zernio (`app/api/webhooks/zernio/route.ts`) tiene una rama para `lead.received`, DESPUÉS de lo que ya tenía (firma sobre el
cuerpo crudo → ruteo estricto por profile o por cuenta → la firma tiene que ser de ESE negocio → el evento se reclama una sola vez en `zernio_eventos`).
`lib/zernio-lead.ts` (puro) lee el cuerpo; `lib/zernio-leads.ts` lo entrega a `upsertLeadFromMeta` con el `leadgenId` como `meta_lead_id`, y manda la
conversión `Lead` (CAPI, con el MISMO `event_id` que el webhook de Meta: si el lead entra por los dos caminos, Meta junta los eventos) y lo inmediato
(`alNacerLeadDeMeta`: el aviso, los flujos, las automatizaciones). **El alta va adentro del pedido y lo demás en `after`**, porque Zernio corta a los 5 s;
si el alta falla se suelta el reclamo del evento y Zernio reintenta.

### Lo que se leyó de la doc del webhook (docs.zernio.com/webhooks/ads, 23/10/2026, por un lector que resume: los nombres pueden venir parafraseados)

**La doc NO trae un JSON de ejemplo: sólo la tabla de campos.** `id` (estable, igual en cada reintento y en `X-Zernio-Event-Id`), `event`, `timestamp`, `test`
(sólo en las muestras de `POST /v1/webhooks/test`), `lead` { `id`, `leadgenId`, `formId`, `formName`, `adId`, `adsetId`, `campaignId`, `fields`, `isOrganic`,
`createdAt` } y `account` { `id`, `accountId`, `platform: "facebook"`, `profileId` (nulo si no hay profile) }. `fields` es «pregunta → respuesta»
y **las opciones de una pregunta de selección vienen como CLAVE** (`k1`), no como rótulo. Los eventos de anuncios exigen el complemento de anuncios (Ads
add-on) de Zernio, y la página tiene que estar conectada con el permiso `leads_retrieval`: una cuenta conectada antes de tener anuncios se tiene que
reconectar.

### El diagnóstico obvio era el equivocado, y las trampas

1. **«Armar el parser con la API REST que ya se lee» NO sirve.** `GET /v1/ads/leads` devuelve el lead con `fieldData` crudo (la forma de Meta) y otros
   nombres; **la tabla del webhook no lista `fieldData`**. Es la misma trampa de Cal.com (06/10/2026, AGENTS.md): el lector toma `fields` y NO lee `fieldData`
   (un test lo fija con un cuerpo que sólo trae `fieldData`).
2. **Una muestra de prueba NO es un lead.** `POST /v1/webhooks/test` manda un cuerpo con `test: true`; sin mirarlo, apretar «probar» en el panel de Zernio
   creaba un lead falso, con el aviso y las automatizaciones que dispara uno real. Se ignora con su motivo (`ignored: "prueba"`).
3. **El `leadgenId` decide la identidad y no se inventa ni se rellena.** Sólo dígitos (8 a 32), como string o como número seguro (un id de 17 dígitos que
   viaja como número JSON ya se redondeó al parsear). Sin eso el evento NO se carga —un lead que se carga dos veces avisa dos veces— y se registra con las
   CLAVES que sí vinieron (nunca los valores: es un dato personal). **El `id` de Zernio (`lead.id`) no es el leadgenId**: usarlo duplicaba el lead que ya
   entró por Meta.
4. **Los NOMBRES de anuncio, conjunto y campaña no viajan en este evento, sólo los ids.** Quedan vacíos (no se rellenan con el id): los ids son los que
   deciden el producto (`lib/campana-funnel.ts`) y la atribución (`lib/campana-atribucion.ts`: «los nombres sólo para MOSTRAR»), así que lo único que se
   pierde es el renglón con el nombre en la ficha. ⚠️ `upsertLeadFromMeta` escribe esas columnas con `?? null` también en el UPDATE de un lead que ya
   existía (la persona que vuelve a anotarse, unida por teléfono o email): ese lead pierde el nombre de la campaña anterior y queda con los ids nuevos.
5. **Hay UN solo índice único de `meta_lead_id` y es GLOBAL** (mig 0007). Si el webhook de Meta y el de Zernio traen el MISMO lead a la vez, el segundo insert
   falla por clave duplicada; el webhook de Zernio contesta 500, suelta el reclamo, Zernio reintenta y el reintento lo encuentra (`created: false`) sin
   avisar de nuevo. No se necesita código de carrera: se necesita NO tragar ese error.
6. **Lo inmediato y la conversión, sólo con un lead creado por ESTA entrega y de menos de 24 h** (`esNuevoParaElNegocio`, la regla del poll). Zernio
   reintenta hasta 7 veces y se puede reentregar a mano desde su panel: un evento de hace días no es «un lead nuevo» y no puede mandar un primer
   mensaje. Sin fecha legible se trata como recién llegado (callarlo dejaría a un lead real sin que nadie le escriba).
7. **Los leads se suscriben APARTE de los otros eventos.** `lead.received` es del complemento de anuncios y la doc dice que sin él los eventos de anuncios
   dan 403 `ads_addon_required` al registrar el webhook; **no dice si `lead.received` está entre ellos**. Si fuera una sola lista y Zernio la rechazara,
   el negocio perdería sus mensajes y comentarios de Instagram y Messenger, que hoy andan. `asegurarWebhook` pide todo junto y, si Zernio contesta 400,
   403 o 422, registra los de siempre solos (y lo deja en el log); una key mala (401), un pago (402) o una caída suben tal cual.
8. **`asegurarWebhook` no corre solo.** Corre al conectar una red, al ver el estado de Instagram o Messenger y al publicar una automatización con esos
   medios: un negocio que ya tenía su webhook registrado NO escucha `lead.received` hasta que pase una de esas tres.

### Lo que NO se midió (se mide con un `lead.received` REAL)

1. El cuerpo: **ningún negocio recibió todavía un `lead.received`**; todo lo de arriba sale de la tabla. Falta ver `fields` con un formulario real (¿las claves
   son las de Meta —`full_name`, `phone_number`— o los rótulos?) y si un campo de varias opciones llega como lista.
2. Que `lead.leadgenId` sea EXACTAMENTE el id que Graph devuelve para ese lead (si no, la deduplicación con Meta no funciona y el lead entra dos veces).
3. Si Zernio rechaza suscribir `lead.received` sin el complemento de anuncios (y con qué código), y si `account.accountId` de este evento es el `_id` que lista
   `GET /v1/accounts` (de ahí depende el ruteo cuando `profileId` viene nulo).

### Lo que quedó SIN hacer

- **Nadie le dice al negocio que sus leads no llegan por falta del complemento de anuncios o del permiso.** `leadsEnElWebhook(ws)` (lib/zernio.ts) mide si el
  webhook registrado escucha el evento; falta que alguna pantalla lo use (Ads Manager o el modal de Zernio). Mide lo REGISTRADO, no que llegue alguno.
- **Sin red de seguridad si un evento se pierde.** Zernio reintenta 7 veces y lo descarta; el poll de Meta (`/api/cron/meta-leads-poll`) usa el token de página
  propio del negocio y un negocio que sólo conectó por Zernio no lo tiene. Existe `GET /v1/ads/leads?accountId&since=<segundos>` (más nuevo primero, cursor por
  `pagination.cursor`) para un barrido, que además traería `fieldData`, y la regla de lo inmediato (24 h) ya está en `cargarLeadDeZernio`.
- **Los nombres de campaña, conjunto y anuncio** (punto 4): se pueden resolver por id contra `marketing_metrics_daily`, o desde la API de anuncios de Zernio.
- **Un fallo DESPUÉS del insert deja el lead sin anunciar:** si `upsertLeadFromMeta` tira al dejar el rastro o al sumarlo a otro funnel, el reintento de Zernio
  encuentra el lead (`created: false`) y nadie dispara el aviso ni las automatizaciones. Es de la puerta compartida (el webhook de Meta tiene el mismo hueco).
- **Sin prueba de punta a punta** (un evento firmado contra un negocio de prueba): ws3 no tiene key de Zernio y no se la pone con código.
- Tipos: salió «sin tipos» (política del tren): los chequea el `tsc` acotado de Integración.

**Vive en:** `lib/zernio-lead.ts` · `lib/zernio-leads.ts` · `app/api/webhooks/zernio/route.ts` · `lib/zernio.ts` (`EVENTO_LEADS`, `EVENTOS_ESCUCHADOS`, `asegurarWebhook`,
`leadsEnElWebhook`) · `tests/zernio-leads.test.ts`.

_23/10/2026 — pedido del Cerebro a Integraciones (cuenta 2), después de «Conectar con Facebook, Instagram o anuncios»._

## La agenda de MaKo NO entra al CRM de MaKo (medido en la base el 23/10/2026)

**Síntoma:** a dos días del lanzamiento, toda venta de MaKo pasa por la agenda `calendly.com/koncke/asesoria` (/planes sin
pasarela, la VSL, las landings), y ninguna reserva llega al CRM del ws 9. **Medido:** `webhook_routing` de Calendly tiene
filas sólo del ws 1 (los eventos de Mauricio); `credenciales` de Calendly sólo en el ws 1 y el ws 4; el ws 9 no tiene token,
ni signing key, ni tipo de evento de R1. Leads del ws 9 con `origen_lead = 'calendly'`: 0.

**El diagnóstico obvio era el equivocado:** «la huella `calendly.reservas_sin_ruteo` está vacía, así que no hubo reservas».
No prueba eso. La huella se escribe recién DESPUÉS de verificar la firma con la key de plataforma
(app/api/webhooks/calendly/route.ts:343-398): si la cuenta koncke no tiene una suscripción apuntada a MaKo, no llega nada; si
la tiene y firma con otra key, es un 401 sin rastro en la base (y Calendly la cuenta para deshabilitar la suscripción). Lo
que se ve es idéntico: nada. La prueba está en Calendly (el registro de entregas de las suscripciones de webhook de koncke).

**Mientras tanto:** la reserva existe en Calendly (mail y calendario de Martín) con las UTM del link; lo que falta es el
lead, el seguimiento y el origen en el CRM. **Arreglo (de Martín, en /integraciones?ws=9, donde va la pasarela):** conectar
la cuenta de Calendly de koncke y cargar el tipo de evento de R1.

**Conectar no es todo, y lo que trampea es creer que sí:**
- Guardar el token y el R1 escribe el RUTEO (`ROUTING_CREDS`), no el AVISO. La suscripción de webhook no tiene pantalla en
  Calendly ni en MaKo («los webhooks se configuran aparte», lib/metodo-catalogo.ts): se crea por API con el token
  (scripts/arreglar-webhook-calendly.ts, fijo al ws 1) y requiere un plan pago de Calendly.
- Lo agendado ANTES no entra solo: Calendly no reenvía avisos viejos, ningún cron lee la agenda y el «histórico al
  conectar» (lib/onboarding-contrato.ts) no incluye Calendly. No se pierde: la API lista las reservas pasadas con sus UTM y
  scripts/backfill-calendly.ts las importa (idempotente, sólo completa vacíos), pero está fijo al ws del dueño y al token de
  `.env.local`.
- **MaKo no tiene ningún token de la cuenta koncke** (medido el 23/10): el de `.env.local` es de otra cuenta (por
  `/users/me`, sin imprimirlo), y los únicos otros están en el ws 1 y el ws 4, que son clientes y no se usan para esto. Hasta
  que Martín pegue el suyo, no se puede ver si koncke tiene una suscripción apuntada a MaKo ni cuántas reservas quedaron
  afuera. Con el token, la API dice qué suscripciones hay y si están `active` o `disabled`; los intentos de entrega uno por
  uno no los da.

**La pantalla ya no miente (23/10):** /integraciones pregunta a Calendly, con el token del negocio, si hay un aviso a MaKo
(lib/calendly-aviso.ts) y, si no anda, baja Calendly a ámbar con su motivo: «Falta el aviso», «Aviso apagado», «Aviso con
fallas» (reintentando) o «Aviso incompleto» (sin invitee.created). Reglas aprendidas con la revisión adversarial, todas en
lib/calendly-aviso-reglas.ts con test:
- **«Es de MaKo» pide camino Y dominio.** Con el camino solo, el webhook de otro CRM, de un túnel o de localhost
  (`/api/webhooks/calendly` es el camino de cualquier app Next) daba «activo» y la pantalla pintaba verde sin que entrara una
  reserva. El dominio es cualquiera de `DOMINIOS_DE_MAKO` (el de antes también: el proxy exime a /api/webhooks del 410 y
  puede seguir entregando), https y sin puerto.
- **«Activo» no es `state: active`.** Pide además sin `retry_started_at` (Calendly reintenta una entrega que falla antes de
  apagarla) y con `invitee.created` en sus eventos (sin él entrega cancelaciones y ninguna reserva nueva).
- **Un 403 de la organización no es «sin aviso».** Un usuario que no administra su organización no ve las suscripciones de
  alcance organización, y esas son justo las que crea el script. Con 403 sólo un aviso visto y sano (`activo`) es veredicto;
  lo demás se calla (`estadoDeLasLecturas`). Falló antes: pintaba de ámbar a quien sí tenía el aviso.
- **No puede colgar la página.** Eran dos viajes en serie a una API ajena con tope por llamada (hasta 8 s de render). Ahora UN
  tope de 3 s para toda la cadena, el veredicto claro se recuerda 60 s por negocio, y la página lo lanza al principio y lo espera
  al final. «No pude leer» (null) no se recuerda y no pinta a nadie.
- **Verde NO prueba que las reservas lleguen.** Dice: token vigente, alguna fila de ruteo y aviso sano. No dice que el ruteo
  resuelva el tipo de evento de la ASESORÍA (puede ser otro), ni que la firma valide, ni que la entrega funcione. La prueba de
  punta a punta es UNA reserva de prueba que aparezca como lead en el ws 9 (y se cancela). El relevo lo pide así.
- **«Conectada» es SÓLO el token, no token + R1 (24/10).** La grilla mira `envs: ['CALENDLY_API_TOKEN']`
  (lib/integraciones-catalogo.ts). Un negocio con el token y sin el R1 no tiene ruteo, y con un aviso sano la pantalla quedaba
  verde mientras el webhook descartaba cada reserva con un 200 (el 04/10 se midió 1 de 2 así). Ahora lee `webhook_routing`
  del negocio y dice «Falta el R1»; y un 401 de /users/me dice «Token vencido» (`estadoAntesDelAviso`: los dos ganan sobre el
  aviso). El ruteo se lee SIEMPRE, fuera del recuerdo de 60 s: recién guardado el R1 no puede seguir diciendo que falta. Y el
  recuerdo es por negocio Y por token: pegar uno nuevo no hereda «Token vencido».

**Los scripts, por negocio:** `--ws=N` en scripts/backfill-calendly.ts y scripts/arreglar-webhook-calendly.ts toma el token
de las credenciales de N y NUNCA el de `.env.local` (con el de otra cuenta, el backfill metería una agenda ajena en el CRM
de N); `--simulacro` mide sin escribir. Lo que NO era obvio y la revisión adversarial encontró:
- **Un flag mal escrito caía en silencio al ws 1.** `--ws 9` (con espacio), `--WS=9`, `--dry-run` o `--simulacro=1` se
  ignoraban: el script corría sobre Mauricio con el token de `.env.local` y ESCRIBÍA (borraba su aviso, rotaba su clave).
  Los argumentos son estrictos (lib/calendly-scripts-reglas.ts): lo que no se reconoce, o se repite, se rechaza.
- **«El negocio tiene clave guardada» no prueba que el aviso sea suyo.** Calendly no devuelve la signing key, y una
  organización puede tener tipos de evento de dos negocios; borrar su único aviso (la dirección es la misma: 409) y guardar la
  clave nueva sólo en N deja a los otros con 401 y se pierden las reservas de los dos. El freno de `--reemplazar` ahora se
  decide con datos de Calendly: que el aviso lo haya creado el dueño del token y que ningún tipo de evento de la organización
  rutee a OTRO negocio (`puedeBorrarAvisos`); si no se pudo leer algo, frena.
- **El backfill con `--ws` no importa lo vinculado a una etapa de un embudo.** El webhook decide ESAS reservas por la etapa
  (`rutaDeReserva` + `decidirReserva`: una R2 vinculada no crea nada); el backfill las pasaba por la rama R1 y creaba una R1
  fantasma por cada una, con el No Show corriendo desde esa fecha. Hoy las salta y las cuenta, para cargarlas a mano.
- **La R1/R2 se leen con `credWsEstricta`**, como el webhook: con la no estricta una base que tose daba null y una R2 entraba
  como R1. Y la medición del arreglo ya no lee «0 avisos» cuando la lista falla (403): corta, y mira también los de alcance usuario.
- **`--ws=1` se rechaza (24/10).** El ws del entorno lee `.env.local` de respaldo cuando su fila falta o no se descifra
  (`credWs`/`credWsEstricta`, `wsDelEntorno`), así que `--ws=1` era «lo de siempre» con la promesa de «sólo la base de N».
  Para el ws 1, sin `--ws`.
Los pasos exactos, en docs/relevo/suscripcion.md (punto 3). **Quedó SIN hacer:** el backfill no ubica las reservas de eventos
vinculados a una etapa (scripts/backfill-calendly.ts, el salto con `rutaDeReserva`); si hace falta, se arma con
`ubicarReservaVinculada` de lib/agenda-evento-etapa-server.ts, como el webhook. **Vive en:** app/api/webhooks/calendly/route.ts ·
lib/webhook-routing.ts · lib/compra-plan-reglas.ts (`AGENDA_MAKO`) · app/vsl/Landing.tsx (`CALENDLY_URL`).

## El puente de leads de Meta por Zapier o Make (23/10/2026)

**El pedido** (Martín, desde el Ops Center, vía el Cerebro): «armame el puente de leads por Zapier». La app de MaKo todavía no
tiene `leads_retrieval` aprobado (en revisión, estimado ~10/11), así que un negocio que no conectó Meta con una app propia no
recibe los leads de sus formularios instantáneos. La investigación del Cerebro (`C:/dev/cerebro-herramientas/meta-mientras-tanto-23-10.md`,
opción A) concluyó que el puente que anda en días es un Zap que le manda cada lead a MaKo. Lo paga el negocio. La guía para
el negocio: [guia-leads-por-zapier.md](guia-leads-por-zapier.md).

**Lo que ya existía, y por eso el trabajo fue unir y no construir:** el patrón de «fuente que avisa» (Hotmart y Skool-por-Zapier:
un secreto en un header, ruteo por su hash, lectura estricta) y la puerta de los leads de formulario de Meta
(`upsertLeadFromMeta` + `alNacerLeadDeMeta`). El receptor nuevo es el de Skool con la puerta de Meta detrás.

### Las decisiones, y la que casi sale mal

- **⚠️ La puerta equivocada era la que estaba a mano.** El molde (Skool) entra por `ingresarDeFuente`, que a propósito NO decide
  nada por detrás: ni etapa, ni automatizaciones, ni mensajes (`tests/fuentes-leads-webhooks.test.ts`). Un lead de formulario de
  Meta SÍ dispara el aviso, los flujos y las automatizaciones, y el negocio lo espera igual venga por donde venga: por esa puerta
  el lead entraba al CRM como una fila muda y nadie le escribía. Entra por **`upsertLeadFromMeta`** (origen `instant_form`,
  dedup, producto según la campaña, respuestas crudas) y, si es nuevo y reciente, por la conversión `Lead` de CAPI y
  `alNacerLeadDeMeta`: lo mismo que hace el webhook de Meta. `ingresarLeadDeZapier` (lib/zapier-leads.ts).
- **El id.** `upsertLeadFromMeta` es idempotente por `meta_lead_id`. Con el `leadgen_id` real (15 a 17 dígitos) un lead que
  entra después por Meta NO se duplica, y el `event_id` de CAPI es el mismo que usaría el webhook. Sin él, el id propio es
  `zap:<ws>:<huella>`: determinista (un reintento de Zapier cae en la misma fila) y con el workspace adentro, porque
  `idx_leads_meta_lead_id` es único GLOBAL, sin `workspace_id`. Ese id NO viaja a Meta como `lead_id` (Meta rechaza el evento
  entero ante uno inválido).
- **La clave va en un header, no en la URL** (la regla de Skool: una URL con la clave queda en los logs de cada salto).
  Servicio de ruteo PROPIO (`zapier`): con el de `skool`, la misma clave entraría a los dos.
- **Un aviso sin email ni teléfono contesta 422, no 200** (a diferencia de Skool). Un Zap mal mapeado que manda leads sin
  contacto tiene que verse en el historial de tareas de Zapier, que es lo que le llega por mail a quien lo armó. Con 200 el puente
  «andaría» y no entraría nadie.
- **Un lead VIEJO se carga callado** (`esNuevoParaElNegocio`, 24 h): el «Probar» de Zapier manda leads ya existentes, y anunciar
  uno de hace una semana como nuevo es mentir. **Sin fecha del formulario se trata como recién llegado**: un Zap vivo dispara
  en segundos, y callarlo dejaría a un lead real sin que nadie le escriba (la falla más cara de las dos).
- **El estado de la tarjeta sale de lo que LLEGÓ, no de la clave** (como el Pixel): `zapier.estado` en `app_settings`, una fila por
  negocio. Ámbar a las 72 h sin un lead — pero sólo si ya entró alguno: un puente que nunca recibió nada «espera», no «cayó».
  La grilla no lo esconde de «Requiere tu atención» (`callada`), a diferencia de Hotmart/Skool/Apify sin configurar.
  ⚠️ **72 h es un proxy**: Meta no dice cuántos leads se generaron (para eso hace falta el permiso que este puente reemplaza),
  así que un negocio con tres leads por semana lo cruza sin que pase nada.

### Trampas, todas medidas

- **`ad_name`, `campaign_name` y `adset_name` contienen «name»**: pasados al parser de Meta (`extractField` busca por palabra
  clave dentro del nombre), el primero ganaba como el NOMBRE DE LA PERSONA. Las claves técnicas se sacan antes del parser.
- **`first_name` suele venir antes que `full_name`** y el parser se queda con el primer campo que diga «name»: salía «Ana» en
  vez de «Ana Pérez». Lo cazó el test, no la lectura. El nombre completo va adelante; sin él, nombre y apellido se juntan.
- **Un id de 17 dígitos que viaja como NÚMERO JSON ya se redondeó al parsear** (más de 2^53): no es el id, y se descarta.
- **`upsertLeadFromMeta` escribe `meta_lead_id` también en el UPDATE** de un lead que ya existía. Una persona que vuelve a llenar
  el formulario con otro leadgen_id le reemplaza el id al lead (igual que por Meta, medido). El caso malo es el id propio sobre
  un id real, que sólo pasa si el Zap deja de mandar el id y la persona ya había entrado por Meta de frente.
- **Borrar un lead no borra su `lead_audit` ni sus `notificaciones`**: quedaron 2 y 3 filas colgando del ws3 tras la prueba y se
  limpiaron a mano. Un lead de prueba se limpia con las tres.
- **Los nombres de los campos del trigger de Zapier NO están medidos** (ni la salida de Make): el lector es tolerante y devuelve
  `sin_usar`. Lo que Zapier dice en su ayuda (23/10/2026) y NO se probó con un Zap real: con «Data» vacío manda todos los campos
  del paso anterior; el CRM se asigna en `business.facebook.com/settings/leads-accesses` (la app «Zapier», no «Zapier Inc.»); si
  se edita el formulario, Facebook crea uno nuevo con otro id; un Zap por formulario.

### Cuánto cuesta para el negocio (leído en las páginas oficiales el 23/10/2026)

El Cerebro pidió medirlo antes del domingo: decide si se puede PROMETER el puente. **Zapier: el plan gratis no alcanza.**
La ayuda oficial de Facebook Lead Ads (actualizada el 01/10/2026, `help.zapier.com/hc/en-us/articles/8496061306253`) dice «Facebook
Lead Ads is a premium app on Zapier»: está en Professional, Team y Enterprise, y pide «A paid Zapier account». Y «Webhooks by
Zapier» (el POST a MaKo) tampoco está en Free (`zapier.com/pricing`, actualizada el 23/10/2026). **El mínimo es Professional:
US$19,99 al mes con facturación anual, US$29,99 mes a mes, 750 tareas.** **Make: el mínimo que se ofrece es Core** (corregido el mismo día: ver abajo).
Mi lectura de su página de precios no sirvió (la dibuja JavaScript), pero el Cerebro la leyó con un navegador
(`make.com/pricing`): Core US$9 al mes (con el descuento anual) con escenarios ilimitados y programación al minuto; Pro US$16;
Teams US$29; Free US$0, con 1.000 créditos y 15 minutos de intervalo mínimo. Facebook Lead Ads no es una de las «Enterprise apps».
En Leads Access se asigna la app «Make» (no «Zapier») y hace falta una cuenta de Facebook Business Manager. **Lo oficial sobre
el plan Free:** Make dice que «most Make API endpoints are reserved for our paid subscription plans» (`developers.make.com`; es su
API de gestión, no el módulo HTTP) y la página del módulo HTTP (`apps.make.com/http`) no nombra ningún plan: si «Make a request»
manda el POST en Free no se confirmó ni a favor ni en contra, y no se ofrece. **Confirmado después (ayuda oficial de Make, `help.make.com/how-features-use-credits`):** «Trigger modules use 1 credit per run,
regardless of whether they return data» —un chequeo vacío cobra—, así que un disparador por intervalo son ~2.900 créditos al mes
por escenario a 15 minutos y ~43.000 al minuto. **Sin medir (1):** cuál de los dos módulos de Lead Ads conviene: «New Lead»
(`NewLeadMultiple`, por webhook, con «Get Lead Details»: ~3 créditos por lead, según el workflow) o «Watch Leads» (de intervalo,
según la comunidad de Make); la página oficial los lista sin etiquetar. **Sin medir (2):** si un disparador por webhook gasta algo
sin leads (la ayuda no menciona los webhooks). La tarjeta dice «Watch Leads»; si se usa, no programarlo cada menos de 15 minutos.

⚠️ **Lo que se había escrito antes era una suposición.** El relevo del Cerebro decía «Zapier Professional ronda US$20–30, pero ese
precio sale de un blog»; ahora es la página oficial. Y OJO con cómo se lee: una búsqueda resumió esa misma ayuda como si Free
estuviera incluido, y la lectura directa de la página dice lo contrario (Free «no incluido» y «A paid Zapier account» como
requisito). Se anotó la directa; si Zapier lo cambia, la guía lleva la fecha. La tarjeta lo dice en su primer paso y la guía lo anota con la fecha y los links (`tests/zapier-leads.test.ts`).

### Probado de punta a punta (ws3, Cliente de Prueba, 23/10/2026)

La credencial por el camino del producto (`guardarCredencial`), un POST por la ruta con `NextRequest`, y limpieza completa. La
fila de ruteo guarda 64 caracteres (el sha256, no la clave). Sin header 401 · clave equivocada 401 · lead de hace 3 días
`creado`, `anunciado: false`, origen `instant_form`, campaña y anuncio, respuestas en `meta_field_data` · el mismo POST de nuevo
`actualizado`, 1 lead · la misma persona con otro leadgen_id `actualizado`, 1 lead, campaña nueva · sin id: `zap:3:…`, reintento
`actualizado` · formulario en vez de JSON `creado` · sin contacto 422 · no es JSON 400 · tarjeta «Último lead hace menos de 1 h» y,
con el estado a 80 h, «Sin leads hace 3 días. Revisa tu Zap.» con `callada` · lead reciente `creado`, `anunciado: true` y la
notificación «Lead entrante por formulario de Meta» en el feed (`canal_wa: no`: el ws3 no tiene WhatsApp conectado ni
automatizaciones activas). Al terminar: 0 leads, 0 filas de ruteo, 0 credenciales, 0 estados, 0 filas colgando.

**Probado rompiéndolo** (`tests/zapier-leads.test.ts`, 21 tests; roturas restauradas de memoria): las 28 cazadas, cada una por
el test que corresponde (los números, al pie del archivo del test). Y las de los precios y las promesas: 13 contra la versión «Make principal» y 10 contra la final («de pago, sin gratis»), todas cazadas
(los números, al pie del archivo del test).

### Make pasa a ser el camino PRINCIPAL, y los dos son de pago (decisión y corrección de Martín, 23/10/2026, más tarde ese día)

Textual: «Con respecto a Zapier… Obvio que es mejor Make si tiene plan gratis… Y que los usuarios traigan su propia API como
siempre…». Qué cambió, con el porqué:

- **La tarjeta se llama «Leads de Meta por Make o Zapier»** y sus pasos son los de Make: «Facebook Lead Ads → Watch Leads» y
  «HTTP → Make a request» (POST, JSON) con el header `X-MaKo-Clave`; en Leads Access se asigna la app «Make». Zapier queda como
  el último paso, de pago, en una línea. **La key del servicio sigue siendo `zapier`** (credencial `ZAPIER_LEADS_CLAVE`, servicio de
  ruteo `zapier`, ruta `/api/webhooks/zapier`): está escrita en la base y en las filas de ruteo, y cambiarla por el nombre de una
  tarjeta rompería a quien ya conectó (la regla de «las claves no se renombran con la ruta»). Lo que cambia es lo que se lee.
- **Cada negocio usa SU PROPIA cuenta** de Make o de Zapier, como con sus claves de IA: la tarjeta y la guía lo dicen en una frase.
  MaKo no paga ni comparte ninguna.
- **La pantalla no promete «al instante», ni cuántos leads aguanta un plan, ni dice «gratis»**, y un test lo fija leyendo la tarjeta, las
  slides, el estado y el aviso de la API (los textos que lee el negocio) y la guía. Los dos «Sin medir» siguen escritos en la guía.
- ⚠️ **CORRECCIÓN, minutos después, también de Martín:** «El plan gratis de Make NO trae la integración API… No nos sirve en ese
  caso». Entonces **los DOS caminos son de pago**: Make desde Core (US$9 al mes, anual) y Zapier desde Professional (US$19,99 anual,
  US$29,99 mensual), cada uno con su plan y su precio en el paso de la tarjeta y en la guía con la fecha. Lo que el Cerebro había
  leído («Make tiene plan Free, así que se puede arrancar sin pagar») era cierto de la página de precios; Martín dice que el Free
  no trae lo que el puente necesita. La lección es que **un plan «gratis» se mide contra la función que se va a usar** (acá, el
  POST desde un módulo HTTP), no contra el nombre del plan. Lo oficial no lo confirma ni lo descarta (ver «Cuánto cuesta»), así
  que no se ofrece.
- ⚠️ **Make no manda «todos los campos» por defecto, Zapier sí** (con «Data» vacío). En el módulo HTTP de Make hay que armar el
  JSON a mano con lo que se mapea, así que la guía trae la lista de lo que MaKo entiende (`email`, `phone_number`, `full_name`,
  `lead_id`, `created_time`, campaña, anuncio y conjunto; cualquier otra clave es una pregunta del formulario). Lo único obligatorio
  es un email o un teléfono válido. También acepta `field_data` tal cual lo entrega Meta. NO medido con una cuenta de Make.

### ¿Una sola cuenta de Make Core de MaKo para todos los clientes? (pregunta de Martín, 23/10/2026; sin decidir)

Un workflow de 4 investigadores, con un refutador cada uno, leyó las fuentes oficiales. Yo verifiqué tres cosas en la fuente: los
créditos de un disparador, Make Managed Services y la lista de módulos de Lead Ads; el resto es del workflow (marcado). **No cambia
la tarjeta:** aunque MaKo lo cubriera, se sigue mostrando como de pago y de cada negocio.

- **Precios (workflow, `make.com/en/pricing`):** Core US$9 al mes pagando el año (~US$108 por adelantado), US$10,59 mes a mes, con
  10.000 créditos; son los precios para Argentina y México (en EE. UU., US$12 y US$16). ⚠️ **El precio depende del país** de quien
  mire la página: lo que se anota sin decir el país es una cifra de una región.
- **Lo que el Free NO trae es «Access to the Make API»** (workflow): la API para administrar Make. No es el módulo HTTP, y
  `apps.make.com/http` no nombra ningún plan (verificado). El límite real del Free son 2 escenarios activos, 1.000 créditos y
  15 minutos de intervalo. O sea que «el Free no trae la API» (Martín) y «el Free sirve para el POST» pueden ser las dos ciertas:
  no se ofrece por esos límites, no por el módulo.
- **Cada chequeo vacío de un disparador cobra 1 crédito** (verificado, cita arriba). **El módulo por webhook** es «New Lead»
  (`NewLeadMultiple`) seguido de «Get Lead Details»: ~3 créditos por lead (workflow). Que sin leads gaste 0 no figura textual.
- **Volumen medido (workflow):** ~120-133 leads de formularios de Meta por mes (ws19 ~60-73, ws15 ~28-45, ws1 ~13-32). ⚠️ El ws1
  cayó de 361 en julio a 16 en octubre, y eso puede ser la CONEXIÓN y no la demanda real. **Los créditos alcanzan con webhook**
  (~400 al mes de 10.000) **y no con intervalo** (cuatro escenarios a 15 minutos son 11.520).
- **El contrato no lo permite.** MSA de Make (marzo 2026), cláusula 4.1: «solely for Your internal purposes… not for the benefit
  of any third parties» (workflow y una búsqueda sobre el PDF; el PDF no se abrió para citar literal). El camino oficial para operar
  por clientes es Make Managed Services: organizaciones hijas con los beneficios Enterprise (`help.make.com/make-managed-services-mms`,
  verificado); la página no nombra el plan del distribuidor.
- **Core no trae equipos ni roles** (workflow): un cliente invitado a la organización vería las conexiones de los demás.
- **La conexión de Lead Ads admite las credenciales de una app de Meta propia** («Show advanced settings» → client credentials;
  verificado en `apps.make.com/facebook-lead-ads`, que no usa la frase «app de Meta»).

### La API de MaKo

Se declara sola: `ver_integraciones`, `ver_integracion('zapier')` (con el recuadro amarillo y la URL) y
`link_configurar_integracion('zapier')` salen del catálogo, y `ver_integraciones` devuelve el `detalle` de la tarjeta («Último
lead hace 5 h»). Se sumó un renglón a sus `avisos` en tiempo de ejecución (no toca ninguna def, así que `docs/api-mako.md`, el
snapshot y `plugin/` no cambian).

### Lo que quedó SIN hacer

- **El aviso por WhatsApp de «hace X horas que no entra un lead».** Hoy la señal es la tarjeta (ámbar) y el «Requiere tu
  atención» de /integraciones. El push es un aviso del catálogo con su evento de MaKo, su CONDITION y su plantilla de SuperAdmin
  (el molde es `tracking-apagado`: `lib/avisos-catalogo.ts`, `lib/disparadores.ts`, `lib/notif-catalogo.ts`,
  `lib/plantillas-automatizaciones.ts`, `lib/variables-aviso.ts` y su función de datos como `lib/tracking-aviso.ts`) y un
  cron que lo emita (`tracking-vigilante` ya itera los workspaces). Son ~6 archivos y sus guardas; no entró en esta tanda.
- **Un escenario real de Make (y un Zap).** Nada de acá se probó contra «Watch Leads» de Make ni contra el trigger de Zapier. El
  primer negocio que lo arme confirma (o corrige) los nombres de los campos y las opciones del módulo HTTP (la guía las nombra de
  memoria): lo que MaKo no use vuelve en `sin_usar`.
- **El umbral de 72 h contra el ritmo propio de cada negocio.**
- **Medir Make con una cuenta de Core**: cuál módulo conviene («New Lead» por webhook o «Watch Leads» por intervalo; la tarjeta dice
  el segundo), si el de webhook llega al instante y si gasta sin leads, y —aunque no se ofrezca— si «Make a request» manda el POST
  en Free. Si conviene «New Lead», cambiar el paso 3 de la tarjeta (`lib/metodo-catalogo.ts`) y su guarda en el test.
- **Tipos:** este trabajo salió «sin tipos» (política del tren): los chequea el `tsc` acotado de Integración.

**Vive en:** `lib/zapier-lead.ts` (el lector) · `lib/zapier-leads.ts` (la puerta) · `lib/zapier-estado.ts` (la tarjeta) ·
`app/api/webhooks/zapier/route.ts` · `lib/integraciones.ts` (`estadoPuenteZapier`) · `lib/metodo-catalogo.ts` ·
`lib/ruteo-hash.ts` · `lib/webhook-routing.ts` · `tests/zapier-leads.test.ts` · `docs/guia-leads-por-zapier.md`.

_23/10/2026 — pedido del Cerebro a Integraciones (cuenta 2). Probado de punta a punta contra el ws3 y rompiendo cada guarda. Make como camino principal y de pago: 13 + 10 roturas, todas cazadas._
