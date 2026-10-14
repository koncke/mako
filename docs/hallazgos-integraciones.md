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
