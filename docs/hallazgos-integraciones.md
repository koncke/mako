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
