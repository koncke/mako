# Hallazgos de Landing / VSL

Lo que hay que saber antes de tocar `/api/track/vsl`, `lib/landing-analyst.ts`, las lecturas
de `landing_visits` / `vsl_events`, y todo lo que vive bajo `app/vsl`. **No es un changelog.**

Lo que más muerde acá:

- El beacon es público y acepta cualquier `landing_url`: un desconocido elige qué páginas
  baja y analiza el server, y quién paga la llamada a Opus → [Landing Analyst](#landing-analyst).
- El semáforo pregunta «¿hubo eventos alguna vez?», así que el tracking estuvo **18 días
  muerto en verde** y nadie se enteró → [Tracking y beacon](#tracking-y-beacon).
- El botón «Probar» del Pixel nacía **deshabilitado para todo cliente nuevo** —y sin salida en
  pantalla— porque un `localStorage` vacío de ese navegador pisaba la landing ya elegida
  → [«Probar» nacía deshabilitado](#-probar-nacía-deshabilitado-para-todo-cliente-nuevo-un-localstorage-de-este-navegador-pisaba-la-landing-elegida).
- Un cliente **se agendó en vivo y el lead se descartó en silencio**: 200 OK, cero filas, cero
  logs, y la pantalla le dijo «no aplica»
  → [El opt-in se descartaba en silencio](#-el-opt-in-se-descartaba-en-silencio-200-ok-cero-filas-cero-logs).
- Un contador llamado `soloVsl` que en realidad contaba **«todo lo que no es pageview»** hacía
  que un clic pasara por un video: chequeo de retención en ámbar sobre una página sin video
  → [El chequeo de retención acusaba a una landing SIN video](#-el-chequeo-de-retención-acusaba-a-una-landing-sin-video-porque-solovsl-contaba-clics).
- El snippet **le borraba todas las «s»** al texto de los botones desde la v6, y se leía como
  un texto cortado del cliente
  → [El snippet le borraba todas las «s»](#-el-snippet-le-borraba-todas-las-s-al-texto-de-los-botones-y-se-veía-como-un-texto-cortado).
- La retención del VSL por lead sigue sin funcionar después de meses, y es un pedido
  explícito y repetido del dueño → [Retención del VSL](#retención-del-vsl).
- Un `throw` nuevo tres niveles abajo se convirtió en un «sin datos de comportamiento»
  perfectamente creíble → [Landing Analyst](#landing-analyst).
- El matiz honesto de cada feature («en construcción») vive en un campo que ningún
  componente pinta → [El catálogo de features y sus landings](#el-catálogo-de-features-y-sus-landings).
- Un cambio en la landing principal que no se replicó en las de feature: el dueño lo tuvo
  que pedir dos veces → [El copy: cómo se escribe](#el-copy-cómo-se-escribe).
- El VSL **no se ve en ningún replay de sesión, tampoco en Clarity** (lo dicen sus docs), y
  Clarity además **pierde el clic sobre el play**; el default de privacidad de rrweb NO tapa
  los formularios → [Replay de sesión y mapas de calor](#replay-de-sesión-y-mapas-de-calor-clarity-vs-uno-propio).

⚠️ **Parte de este documento es material de segunda mano.** Las entradas fechadas entre
junio y agosto de 2026 salen de los journals de las corridas multi-agente (261 corridas;
**134 de 260 nunca habían escrito nada en el repo**), no de una relectura del código de hoy.
Antes de actuar sobre una, verificá contra el código: varias pueden estar arregladas. El
registro completo de las corridas está en [corridas-multiagente.md](corridas-multiagente.md).
Cada entrada dice de qué corrida y de qué fecha viene.

---

## La landing y el sistema de diseño

### ⚠️ La landing no comparte NI UN token con la app: un rebrand no la toca

**Síntoma:** se aplicó un tema candidato del rebrand a toda la app y `/vsl` quedó
prácticamente igual. Medido con un diff de píxeles contra la misma página sin tema: las
pantallas internas cambian entre **92,0% y 99,8%**; `/vsl` cambia el **7,7%**, y eso es
casi todo el botón «Agenda tu llamada».

**Causa, contada:**

| Archivo | `var(--` | hexes a mano | `data-tema` |
|---|---|---|---|
| `app/vsl/landing-html.ts` | **0** | **617** | 0 |
| `app/vsl/Landing.tsx` | **0** | 29 | 0 |
| `app/page.tsx` | 0 | 0 | 0 |

**646 hexes escritos a mano y cero tokens.** No es que la landing tenga su propia paleta
scopeada —eso sería una decisión—: es que nunca leyó la de la app. Y cero `data-tema`
significa que **no tiene modo oscuro ni puede tenerlo** sin tokenizarla primero.

**Por qué se llegó acá y no es descuido:** la landing se sirve como un string de HTML
(`landing-html.ts`) para que sea autocontenida y no dependa del chrome de la app —
`HideOnPublicLanding` justamente le apaga el sidebar. Un string no puede usar `var()` de
una hoja que no controla, así que cada color se escribió a mano. La decisión de
aislamiento era correcta; lo que no se previó es que dejaba a la landing afuera de
cualquier cambio de sistema.

**Regla:** un rebrand tiene **dos** presupuestos, no uno. Cambiar la app es cambiar
tokens; cambiar la landing es reescribir 646 valores a mano, uno por uno, sin red — no
hay ningún test ni guarda que avise si uno queda con el color viejo. Antes de prometer
«la marca nueva», decir explícitamente si la landing entra o no.

**Lo que quedaría por hacer si entra:** tokenizar `landing-html.ts` contra los tokens de
`app/globals.css` es el paso 1 y el más caro; recién después el tema la alcanza sola y el
modo oscuro se vuelve posible.

**Vive en:** app/vsl/landing-html.ts · app/vsl/Landing.tsx · app/_components/PublicRouteGate.tsx ·
app/globals.css · *2026-08-16 ~tab-temas (medido con Playwright sobre el build de producción)*

---

## Tracking y beacon

### ⚠️ «De qué anuncio vino este lead»: el dato llegaba, se guardaba, y la pantalla decía que no

**Reportado el 22/09/2026 en dos audios del grupo.** Joan: *«en el CRM de MaKo, ¿dónde puedo
ver la trazabilidad inversa para saber de qué anuncio, de qué creativo llegó la agenda?»* y
después *«me aparece orgánico manual, TODOS me aparecen como orgánico manual, y todos estos
vinieron del VSL funnel»*.

Suena a un solo problema y eran **cuatro, en cuatro capas distintas**. Y el más visible —el
que él nombró— era el más chico.

**1. «Orgánico manual» era un `case` que faltaba en un `switch`.** El opt-in escribe
`origen_lead: 'landing'` desde que existe, así que el dato SIEMPRE estuvo bien guardado.
`labelOrigen` (`app/crm/lead-view/OrigenCard.tsx`) tenía case para `instant_form`, `calendly` y
`calcom`, y ninguno para `landing`: todo lo demás caía al `default: 'Orgánico / manual'`. Medido:
**27 leads en todo el producto**, 19 de ellos de un solo cliente (19 de sus 21).

⚠️ **Y ya había pasado con Cal.com**, con el comentario puesto justo al lado explicándolo. Una
lista de `case` que crece cada vez que alguien se queja va a volver a fallar: lo que la cierra
es un test que lee qué valores ESCRIBE el opt-in y exige que cada uno tenga el suyo.

**La regla: un `default` que AFIRMA algo del negocio no es un fallback, es una afirmación.**
«Llegó solo» sobre un lead que llegó por una campaña paga es un dato falso, no un dato ausente —
y encima manda a buscar el problema donde no está.

**2. El tope de 300 se comía la mitad de los anuncios.** El arreglo del camino de escritura
pasaba la URL de aterrizaje por `txt()`, el saneador de campos de formulario (300 caracteres,
que para un nombre está bien). Meta arma la URL con el **`fbclid` PRIMERO** (150-250 caracteres)
y los `utm_*` DESPUÉS, así que `utm_content=` —donde viaja el id del anuncio— arranca alrededor
del carácter 298 y su valor de 18 dígitos queda entero afuera.

Medido sobre las 822 visitas de ese cliente que traen `utm_content`: **427 lo perdían completo
(52%)**, y a nivel lead 8 de 18. Lo delataba que el MISMO dato estuviera entero en
`landing_visits`, que guarda la URL con tope 500: **una URL mutilada por una ruta y completa por
la otra.**

**La regla: una URL no es un campo de texto.** Un tope elegido para un nombre aplicado a una URL
no la acorta: le corta la parte que más informa, que en una URL de tracking está al final.

**3. Y cuando el corte caía ADENTRO del número, el link mandaba al anuncio equivocado.** El
ad_id truncado (`1202516105` en vez de `120251610513950661`) se guardaba, y `adIdDeLead` lo
aceptaba porque preguntaba `/^\d{6,}$/`. Con eso el deep-link llevaba a un anuncio que existe y
no es el de ese lead. **Un null dice «no sé»; esto afirma con confianza.** Los ad_id de Meta
tienen 15-18 dígitos, y ese largo es parte de la validación: un número de 10 no es «un id
corto», es un id roto.

⚠️ **Y la función que decidía eso vivía detrás de `server-only`**, así que ningún test la podía
importar — era lo único sin red justo donde se decide a qué anuncio apunta la ficha de un lead.
Se mudó a `lib/atribucion-url.ts`, que no lo tiene, y `queries.ts` la re-exporta para no tocar
los cuatro llamadores. Es la misma regla que `exigirClienteDePrueba`.

**4. No había backfill, y sin backfill el arreglo es invisible.** El camino de escritura sólo
alcanza a los leads NUEVOS, y en un CRM la mayoría de las filas no se vuelve a tocar nunca. El
dato estaba: la URL completa vive en `landing_visits.landing_url` y se cruza por `visitor_id`.
El script parsea con la MISMA función que usa la ruta (no con un regex nuevo) y escribe sólo
columnas que están en null, con `coalesce` del lado del server. **Resultado: el ws13 pasó de 0 a
18 de 21 leads con su anuncio y su campaña**, los 18 con un ad_id válido.

Los 3 que no se recuperan, y por qué —que es la mitad honesta del número—: 2 son de Cal.com y no
tienen `visitor_id` (sin eso no hay con qué cruzar), y 1 tiene **sólo `fbclid`**.

⚠️ **Y el `fbclid` es cableado muerto: se captura, se parsea, se transporta y no hay dónde caiga.**
El snippet lo manda, el tipo lo declara, `conAtribucion` lo devuelve y `hayAtribucion` lo cuenta
— y la tabla `leads` **no tiene columna `fbclid`**: `grep` sobre `lib/leads.ts` no lo encuentra
ni una vez. Pesa: 857 de las 1.284 visitas de ese cliente lo traen. Es «escribir la salida no es
ofrecerla» en su forma más cara —cinco lugares que lo pasean, cero que lo guardan— y queda
ABIERTO: o se le agrega la columna y se persiste (sirve para la API de conversiones de Meta), o
se saca de los cinco lugares que hacen creer que el dato se guarda.

**La pantalla NO era el problema, y conviene decirlo:** dibuja Campaña › Conjunto › Anuncio con
deep-link y resuelve los nombres. Probado: el id `120251610513950661` resuelve a «Agentes 2 |
15/09» de la campaña «VSL FUNNEL inmobiliarios CI» — justo el VSL funnel que Joan nombró. Tres
rondas de este bug estuvieron en el camino de datos y ninguna en el render.

**Vive en:** `app/api/track/optin/route.ts` · `lib/atribucion-url.ts` ·
`app/crm/lead-view/OrigenCard.tsx` · `lib/queries.ts` · `tests/atribucion-landing.test.ts`

### ⚠️ El semáforo pregunta «¿hubo alguna vez?», así que nunca se pone en rojo

**Síntoma:** el tracking estuvo muerto 18 días y el ws1 siguió en VERDE. Nadie se enteró.

**Causa:** `landingRecibioEventos` es un `select id … limit 1` **sin ventana de tiempo**: con
1955 filas históricas, la respuesta es «sí» para siempre. Y el otro extremo tampoco avisa:
`/api/track/vsl` con `ws == null` hace `console.warn` y devuelve **200 `{ok:true,
ignored:'sin workspace'}`** — el beacon del cliente ve un 200 y sigue feliz mandando al
vacío. Encima no hay ningún cron vigilante (grep de `landing_visits` / `vsl_events` sobre
`app/api/cron`: cero) y los dos avisos del catálogo que uno esperaría, `leads-caida` y
`cron-ingesta-fallo`, no tienen **un solo call-site** en el repo.

**Regla:** un chequeo de salud sin ventana temporal no es un chequeo de salud. Y un endpoint
que descarta el evento devuelve algo que el emisor pueda distinguir de un éxito.

**Vive en:** `lib/integraciones.ts:77` (`landingRecibioEventos`) · `app/api/track/vsl/route.ts:150-159`
· `lib/avisos-catalogo.ts` (`leads-caida`, `cron-ingesta-fallo`, sin cablear) · *2026-08-05 ~auditoria-mudanza-dominio*

### Las cuatro tablas de tracking ordenan bien por `id`, y no es casualidad

`landing_visits`, `vsl_events` y `landing_analyses` tienen `id` como PK, que es el orden por
defecto del helper de paginado y el único que garantiza páginas coherentes. Fueron las únicas
del barrido que **no** tenían el bug de `ORDER BY`.

**Regla:** si agregás una tabla de tracking sin `id` autoincremental, hay que elegirle un
orden único explícito. Ver [hallazgos-infra.md](hallazgos-infra.md) §1.

**Vive en:** `lib/supabase-paginado.ts` · las lecturas de `lib/landing-analyst.ts` y `lib/leads.ts`

### Un `play` no es una intención cuando el player arranca solo

Síntoma: el chequeo «2. Reproduce tu video» del probador daba **verde con solo abrir la
página**, sin que nadie tocara nada. Reportado el 15/08/2026: *«no tiene mucho sentido como se
está midiendo la reproducción del VSL, porque Panda tiene reproducción automática»*.

Causa: el evento `play` se emitía igual lo hubiera pedido alguien o no. El chequeo lo leía como
«el visitante quiso ver el video» cuando lo único que decía era «la página cargó». Y el mismo
dato alimenta la retención, así que **cada visita entraba al embudo como un espectador**.

El diagnóstico obvio —«hay que leer el atributo `autoplay` del player»— no sirve: con Panda el
reproductor vive en un iframe de otro dominio que no se puede inspeccionar, y `autoplay` en el
HTML tampoco dice si ESTA reproducción la pidió alguien. Lo que sí se puede saber es si hubo
**una interacción cualquiera antes** (`pointerdown`, `keydown`, `touchstart`, `wheel`, con
`{once, capture, passive}`). El snippet v11 manda `auto: !huboInteraccion` desde los dos
players, y el chequeo se parte en dos preguntas que antes eran una: «¿se detectó el player?»
(mitad técnica, la contesta cualquier play) y «¿alguien quiso verlo?» (solo la contesta el
manual). Solo la segunda pinta verde.

**La regla, que vale para cualquier métrica de intención:** antes de contar un evento como una
decisión del usuario, preguntá si el sistema lo puede emitir solo. Si puede, el evento necesita
un campo que diga cuál de las dos cosas fue — y la métrica se queda con la mitad cara.

**Vive en:** `lib/landing-token.ts` (`huboInteraccion`, `hayPlayManual`) · mig `0136`

### El video que sigue al video: una fuga de embudo que no se ve desde ningún lado

Síntoma, reportado por el dueño: *«ese es mi propio VSL, uno viejo que NO debería estar
allí… por más que ya eliminé la playlist ese video se sigue reproduciendo al final del VSL
de Mauricio. Los clientes de Mauricio terminan confundidos»*.

No era una playlist. Es un campo del propio video en Panda:

```
GET /videos/{id_interno} → config: {
  "profile": "289794c4-…",
  "videoRedirect": { "externalId": "d0b3e8db-…", "title": "Mentoría 1a1 con Martín Koncke" }
}
```

Al terminar el VSL, Panda lleva **solo** al espectador a otro video. La playlist se borró
meses antes; el `videoRedirect` quedó. Y es invisible por todos lados a la vez: no está en
el HTML de la página, no produce ningún evento nuestro, no aparece en ninguna pantalla del
cliente. La única forma de enterarse era que alguien mirara el video entero — sobre tráfico
pago, en la landing con la campaña corriendo.

**La API pública de Panda NO lo puede borrar, y está probado:**

| Intento | Respuesta |
|---|---|
| `PUT /videos/{id}` con `{config:{profile}}` | `400 must NOT have additional properties: config` |
| `GET /videos/{id}/config` · `/redirect` · `/settings` | `400` — la ruta no acepta sub-path |
| `/video-redirect` · `/redirects` · `/videoRedirect/{id}` | `403` de API Gateway — no existen |
| `GET /profile/{id}` (el player) | 200, y **no** menciona `redirect`: no vive ahí |

El `PUT` documentado acepta cuatro campos y ninguno es `config`.

⚠️ **Y tampoco se quita desde el panel, porque el redirect quedó HUÉRFANO.** Medido el
2026-08-16: las secciones **Playlists** y **Funnel** del panel están las dos **vacías** —la
playlist y el funnel que crearon la regla se borraron hace meses— pero el campo siguió
pegado al video. No hay UI que lo muestre porque la pieza que lo creó ya no existe.

Se intentó por el único endpoint que dice tocar el config del video, y **fusiona en vez de
reemplazar**:

```
POST /profile?type=set-videos  {videos:[id], profile: <el mismo que ya tenía>}
  → 200 {"message":"Video config updated"}   ... y el videoRedirect sigue
POST … + videoRedirect: null | {} | false    → 200, y sigue
POST … + config anidado | sin profile        → 400 «profile is a required field»
```

O sea: el endpoint ignora todo lo que no sea `profile`. **No lo repitas.** El estado del
video queda idéntico (el profile intacto), así que probarlo no cuesta nada más que el
tiempo.

**RESUELTO el 2026-08-16, y la técnica vale para cualquier proveedor.** Recrear el funnel
no sirvió (el panel no adopta el valor huérfano: sus dos secciones seguían vacías). Lo que
funcionó fue preguntarle al panel mismo.

**Si su API pública se niega pero su panel SÍ puede, el bundle del panel dice con qué
endpoint lo hace.** Es JavaScript público: se baja, se busca el nombre del campo, y ahí
está la llamada. En este caso, entre los 361 chunks de `dashboard.pandavideo.com`:

```js
await $fetch(`${base}/player/?type=video`, {
  method: 'POST', body: { video_id: n, videoRedirect: e }, headers: u
})
```

Un endpoint que no está en su documentación. Con la misma API key de siempre:

```
POST https://api-v2.pandavideo.com/player/?type=video
     { "video_id": "<ID INTERNO>", "videoRedirect": null }
  → 200 {"profile":"289794c4-…","videoRedirect":null}
```

⚠️ **Con el id EXTERNO devuelve `400 video not found`.** Es el detalle que decide si
funciona: casi todo lo demás de esa API usa el `video_external_id`, y este endpoint no.

El `profile` quedó intacto, o sea que el player no cambió de aspecto. Verificado después:
`videoRedirect: null`, `playable: true`, `status: CONVERTED`.

Lo que NO hay que repetir, porque ya se probó y falla: `PUT /videos/{id}` con `config`,
con `videoRedirect` o con `video_redirect` al tope (`must NOT have additional properties`);
`POST /profile?type=set-videos` con el campo en `null`, `{}` o `false` (contesta 200 y lo
ignora); y las rutas `/videos/{id}/config`, `/redirect`, `/settings`, `/video-redirect`,
`/redirects`, `/funnels`.

**La regla que queda:** cuando una plataforma tiene una configuración que cambia lo que ve
el visitante y **no** deja rastro en la página ni en los eventos, lo único que el sistema
puede hacer es **leerla y decirla**. Está como chequeo del probador (ámbar, no rojo: no
está roto, está mal configurado) con el nombre de los dos videos y dónde se toca.

⚠️ **Y el chequeo NO se cuelga de `videosDetectados()`** aunque tenga el dato masticado: esa
función hace una consulta de conteo **por video** y el chequeo corre dentro del poll del
probador, que consulta **cada 3 segundos**. Serían N consultas extra cada 3 s por cada
persona con el panel abierto para contestar algo que ya está en memoria. Cruza el catálogo
de Panda (cacheado 5 min) con los `video_id` que ya vienen en la consulta de eventos.

**Vive en:** `lib/panda.ts` → `catalogoPanda()` · `lib/landing-token.ts` → chequeo `redirect`

### Para poder NOMBRAR un video había que conseguir que alguien lo mirara

La pantalla que pide identificar los videos ofrecía un botón «Ver este video», y la URL del
video viajaba **solo** en el evento `play`. O sea: la pregunta estaba al revés. Para poder
contestar «¿cuál de estos dos es el VSL?» había que primero lograr que un visitante
reprodujera uno. El dueño lo dijo así: *«¿por qué es necesario que alguien lo reproduzca
para poder verlo? Es contraintuitivo»*.

El dato existía desde antes de la primera visita, en dos lugares distintos:

- **Panda** lo tiene por API desde que el video se subió: `video_player` (el embed exacto,
  que no hay que armar a mano) y `title` — el título de verdad.
- **El HTML de la página** lo tiene para todo lo demás: `<video src>`, `<source>`, los
  iframes de YouTube y de Vimeo. No hace falta ninguna API para eso.

⚠️ **La trampa del título:** el que se mostraba salía del atributo `title` del **iframe**,
que es de la PÁGINA y no del video. En esta landing los dos videos se llamaban igual —«VSL
Principal - Negocio que Escala»— así que el rótulo existía y no distinguía nada. Un dato
que está pero no discrimina se ve idéntico a uno correcto.

⚠️ **Y la regla del id de un `<video>` nativo vive DOS veces**, en `lib/landing-analisis.ts`
(TypeScript) y adentro del snippet (un string de JS que corre en la página del cliente y
por lo tanto no puede importar nada). Si se separan, los videos de la página dejan de casar
con los eventos **en silencio**: la lista queda con dos filas para el mismo video y ninguna
con URL. Lo único que lo impide es el test que corre las dos derivaciones sobre los mismos
casos.

**Límite honesto que queda:** una página que monta el video por JavaScript no lo trae en el
HTML inicial. Es el caso de la landing de Mauricio (React), y ahí lo cubre Panda. Un
YouTube montado por JS en una SPA no lo cubre nadie — y el botón, correctamente, no
aparece.

**Vive en:** `lib/landing-analisis.ts` → `videosDeHtml()` / `idNativo()` · `lib/panda.ts`

### Un `.limit(2000)` que devuelve 1000 filas, y las 1000 equivocadas

Síntoma, reportado dos veces: *«aún no me muestra el video»*. El botón «Ver este video» de
la pantalla que te pide nombrarlos no aparecía nunca, y al lado decía «la dirección del
video llega con la versión nueva del Pixel» sobre una página que **ya tenía** la versión
nueva — o sea que además mandaba a arreglar algo que estaba bien.

El diagnóstico obvio —el botón, el texto, la condición `d.url ? …`— era el equivocado. Las
tres piezas estaban bien. Lo roto era la consulta que llena `videosDetectados()`:

```ts
.select('video_id, vsl_titulo, detalle').not('video_id','is',null).limit(2000)   // sin order
```

**Dos trampas encadenadas, y ninguna avisa:**

1. **Sin `ORDER BY`, PostgREST devuelve las filas en el orden que le da Postgres** — el
   físico, o sea las más viejas primero. No es aleatorio, es peor: es determinísticamente
   lo contrario de lo que servía.
2. **El servidor corta en 1000 filas aunque se pidan 2000** (`db-max-rows` de PostgREST).
   La respuesta es un **200 con menos filas**: no hay error, no hay flag, no hay nada que
   distinga «esto es todo» de «esto es lo que te dejo ver».

La URL del video viaja en `detalle` solo desde la v8. Con 6489 eventos en 90 días, las
1000 filas más viejas son todas anteriores a esa versión, así que **ninguna** traía la
URL. Y el mismo tope mentía en la pantalla por otro lado: el conteo se calculaba sobre las
filas recibidas, así que decía «1000 eventos» —un número redondo, que se lee como un dato
real— al lado de un video con 6489.

**Las dos reglas:**

- **Toda consulta con `.limit()` necesita `.order()`.** Un límite sin orden no es «los
  primeros N»: es «N cualesquiera», y el día que la tabla crece pasa a ser «los N más
  viejos» para siempre. Vale aunque parezca que el orden da igual — acá daba igual para el
  conteo y era todo para la URL.
- **Un conteo se PREGUNTA (`count: 'exact', head: true`), nunca se deriva de las filas que
  vinieron.** Contar lo recibido reporta el tope del transporte disfrazado de dato del
  negocio.

**Vive en:** `lib/landing-token.ts` → `videosDetectados()`

**17/09/2026: el `.order()` no alcanzaba.** El arreglo de arriba sumó el orden y dejó el
`.limit(1000)` sobre 90 días. En ws1, **las 1000 filas más nuevas de `vsl_events` son 25
horas** (908 eventos por día): un catálogo que decía cubrir 90 días cubría uno, y un video que
dejó de reproducirse anteayer desaparecía de «videos detectados». Medido con la base: 1 video
con el código viejo, 2 con el nuevo. Paginar tampoco servía (~80.000 filas en 90 días). Lo que
se pregunta es «¿qué `video_id` distintos hay?», y eso va **por exclusión**
(`distintosPorExclusion`, `lib/ids-con-filas.ts`): cada vuelta pide una fila que no sea de los
ya vistos. La url, la página y el título de cada video salen después, con un `limit(1)` por
video.

⚠️ **Lo que quedó:** `distintosPorExclusion` tira pasadas las 100 vueltas (100 videos
distintos), y el `catch` de `videosDetectados` lo convierte en `[]`: la pantalla diría «no se
detectaron videos» en vez de «falló». Hoy hay como mucho 2 por workspace; el `catch` tendría
que mostrar el error.

### «El Pixel no está instalado ahí» sobre una página que manda eventos

**Síntoma:** el veredicto de `verificarPagina` decía «No llega ninguna visita de esta página
desde hace 30 días. El Pixel no está instalado ahí» sobre páginas que sí mandaban.

**Causa:** leía `landing_visits` con `.limit(400)` sobre 30 días y **después** filtraba por URL
en memoria. En ws1 las 400 visitas más nuevas son 3 días, y en 30 días hay 2.552 URLs distintas:
para toda página que no fuera la de más tráfico, el filtro recibía cero filas. Un tope chico
seguido de un filtro en memoria no da un resultado parcial: da un **falso negativo con cara de
veredicto**, y le manda al cliente a reinstalar algo que funciona.

**Arreglo (17/09/2026):** el servidor filtra por host (`ilike %host%`, un superconjunto seguro)
y eso se pagina; la coincidencia exacta sigue siendo `normalizarUrl`, y el orden por fecha se
hace en memoria. El conteo de visitas pasó a ser real y no «400».

**Regla:** si el resultado va a filtrarse, el filtro va en la consulta. Y el superconjunto tiene
que discriminar de verdad: uno que deja pasar casi todo vuelve a ser el corte mudo (le pasó a
`duplicadosDeLead`, ver [hallazgos-crm.md](hallazgos-crm.md)).

**Vive en:** `lib/landing-token.ts` → `verificarPagina()` · *2026-09-17 caza de paginado*

### Un `useEffect` que escribe una dependencia de su propia dependencia no termina nunca

El análisis de la landing se colgó del efecto que ya existía. `piezas` es dependencia de
`traer`, `traer` es dependencia del efecto, y el efecto escribía `piezas`: array nuevo cada
vuelta, comparación por referencia que nunca corta. El síntoma habría sido **la página del
cliente pidiéndose sola varias veces por segundo** — desde el navegador de quien configura, así
que ni siquiera aparece en nuestros logs.

**La regla:** un efecto que ESCRIBE un estado no puede depender —ni transitivamente, vía un
`useCallback`— de ese estado. Si el trabajo depende de una sola cosa (acá, la landing elegida),
va en su propio efecto con esa sola dependencia. El `let vivo = true` del cleanup es aparte: es
contra la respuesta que llega después de cambiar de landing.

**Vive en:** `app/integraciones/ProbarTracking.tsx`

### Dos ramas que producen el mismo `id` son un chequeo para quien lo corre y dos para quien lo lee

El paso 5 del probador cambia de identidad según cómo venda el negocio: «Deja sus datos» si
tiene formulario, «Agenda una llamada» si su CTA es un Calendly embebido. Se escribió como dos
spreads condicionales dentro del array (`...(cond ? [A] : [])`, `...(cond ? [] : [B])`), que en
ejecución da exactamente un elemento — y en la FUENTE deja dos `id: 'optin'`.

El test que cuenta los ids leyendo el archivo contó siete pasos donde hay seis, y falló sobre
código correcto. No es culpa del test: la fuente decía otra cosa que el runtime.

**La regla:** cuando una entrada de una lista tiene dos variantes, la variante se arma **arriba**
(un `const` con las dos formas) y en la lista va **una sola** entrada que la spreadea. Vale
igual sin tests de por medio: dos ramas gemelas divergen, y el día que una gane un campo la otra
no lo tiene.

**Vive en:** `lib/landing-token.ts` (`paso5`)

### El link a la grabación de una prueba está bien y no sirve durante 45 minutos

Clarity procesa las sesiones en lote —entre 30 minutos y 2 horas— y **no tiene webhook**. La
pantalla ofrecía el link apenas terminaba la prueba: quien lo abre no encuentra nada y concluye
lo razonable, que esto no funciona. Volver más tarde tampoco es realista, porque el marcador de
la prueba es una cadena al azar que nadie se aprende y su sesión queda mezclada con el tráfico
real del día.

Por eso el aviso por WhatsApp (`prueba-grabada`), que es el único canal que llega con la
pantalla cerrada, y por eso el cron corre **cada 15 minutos**: los otros vigilantes de landing
contestan preguntas de días, este una de minutos.

Dos decisiones que se pagan si se copian mal:

- **`PROCESADO_MIN = 45`, el piso alto.** El costo de los dos errores no es simétrico: avisar
  tarde cuesta media hora de espera, avisar temprano manda a alguien a una lista vacía — que es
  justo el problema que el aviso viene a resolver, y esa persona no vuelve a intentar.
- **Se marca «avisada» pase lo que pase con el envío.** Reintentar cada 15 minutos durante 12
  horas son 48 intentos por la misma prueba: cuando el canal vuelva, llega una ráfaga sobre algo
  que ya no le importa a nadie. Es correcto para un aviso de conveniencia y sería incorrecto
  para uno que no se puede perder.

**Vive en:** `app/api/cron/prueba-grabacion/route.ts` · `lib/clarity.ts` (`urlSesionesDePrueba`)

### Un proyecto de Clarity es por SITIO, así que el código que se copia es de la PÁGINA

El snippet se generaba una vez por workspace, en el server. Con dos landings del mismo cliente,
las dos emiten el mismo id de Clarity y sus grabaciones caen en una sola lista donde ya no se
distingue cuál es cuál — el mismo problema que el paso 1 (elegir la landing) vino a cerrar, por
otra puerta.

El id propio de la landing gana sobre el del workspace y, sin id propio, **hereda**: el caso
normal es una sola página, y ahí pedir que se configure dos veces lo mismo es pedir el error.

⚠️ El detalle que casi entra: **lo que se copia tiene que ser lo mismo que se muestra**. El
botón de copiar seguía leyendo la prop del server mientras la pantalla ya pintaba el de la
landing. Se ve bien y se pega lo que no es, que es la peor variante posible de este bug.

**Vive en:** `app/integraciones/landing-config-actions.ts` (`snippetDeLandingAction`) ·
`app/integraciones/IntegracionesBoard.tsx`

### El SCROLL (snippet v19): tres whitelists para un evento, y un candado con la llave vieja

**Hecho el 04/10/2026.** Decisión de Martín, textual: *«Si, debería aparecer en tracking los
clicks que hizo, junto a la grabación del scroll... Hazlo. Y si no tiene el Pixel de MaKo
conectado, allí mismo un botón para conectarlo.»*

**⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: no alcanza con medir y subir la versión.** Un
evento nuevo del snippet tiene que pasar **tres listas blancas** escritas en tres archivos
distintos, y las tres fallan en silencio:

1. `CONOCIDOS` en `app/api/track/vsl/route.ts`. Un tipo que no está ahí **se guarda como
   `'desconocido'`**. No se pierde la fila: se pierde el nombre, y ninguna pantalla lo busca.
2. `ES_EVENTO_DE_VIDEO` en `lib/vsl-retencion.ts`. Esta hay que dejarla **quieta**: si el scroll
   entrara, su `porcentaje` —que es de la PÁGINA— saldría convertido en retención de video por
   `avanceDe`. Es la misma mezcla de unidades que ya costó 3.416 filas de avance inventado.
3. El filtro de `getTrackingEvents` en `lib/leads.ts`. Es el que decide qué llega a la ficha, y
   el que ya había disfrazado a `salio`/`volvio`/`cierre` de «Siguió mirando el VSL».

**La regla: medir un evento nuevo es un cuarto del trabajo.** El resto es que sobreviva a las
tres listas — y la prueba de que está enchufado es contar los call sites, no que compile.

**⚠️ Y UN CANDADO CON LA LLAVE DE LA VERSIÓN ANTERIOR.** `landingDiagnostico` decide si te pide
repegar el código con `ganaConLaNueva`, que preguntaba por una lista de **hosts de video de la
v16** (`HOSTS_DE_LA_V16`). Eso era correcto para ese salto —la v16 solo le cambiaba algo a quien
aloja el video afuera— y con la v19 puesta mentía al revés: el scroll le sirve a **cualquier**
página, y a una landing de Panda le habría dicho *«para esta página miden igual, no hay apuro»*
sobre la única versión que le agrega algo. Ahora se pregunta por la versión
(`instalada < VERSION_DEL_SCROLL`), no por las piezas. **Un gate por catálogo caduca con el
catálogo; un gate por versión no.**

**El freno, que no es prolijidad.** El evento `scroll` del navegador se dispara **por cada pixel**
que se mueve la página: un `enviar()` adentro del handler son cientos de requests por visita, y
el que los recibe es **nuestro** beacon, no la página del cliente. No se ve probando a mano —una
landing corta manda cuatro y parece sano— y se ve en la factura. Van dos frenos encimados: el
handler agenda una mirada cada 400 ms y sale sin calcular nada, y sólo se manda **al cruzar** un
hito (25/50/75/100), una vez cada uno. Techo: 4 eventos por visita más el del cierre, el mismo
orden de magnitud que los clics (topeados en 40).

**Dos trampas de la medición misma:**

- **Una página que entra entera en la pantalla no se scrollea**, y ahí reportar 0% es mentir: la
  persona la vio completa sin mover un dedo. Se reporta 100.
- **Por eso la primera medida espera al `load`.** Mientras la página carga, el alto del documento
  todavía no cuenta las imágenes: se mide una página corta que no lo es, y la regla de arriba
  mandaría un **100 falso en la primera línea de cada visita**.
- El hito no sabe dar el punto exacto: quien llegó al 68% quedaría registrado como 50. Va un
  evento más al irse (`pagehide` + `visibilitychange`), topeado en 3 y sólo si supera el hito ya
  mandado.

**El vacío de la ficha no era del lead, era del negocio.** La tarjeta de tracking decía *«entró
antes del tracking, o llegó por instant form»* **también cuando el Pixel no está puesto** — o
sea que mandaba a buscar una causa inexistente, y el control vive tres pantallas más allá. Ahora,
sin Pixel, dice que falta y lleva a `/integraciones?servicio=landing`, que **abre el modal que
entrega el código**, no la grilla de veintipico de tarjetas. La señal es
`landingRecibioEventos()`, la MISMA que el semáforo de /integraciones, para que las dos pantallas
no puedan contradecirse.

**Lo que quedó SIN hacer:**

- `docs/lovable-tracking.md` (tabla de payloads, ~línea 51) está vieja de varias versiones: lista
  pageview/play/pNN/sNN/exit y **le faltan** `click`, `salio`, `volvio`, `cierre`, `agendo` y
  ahora `scroll`. Es el documento que el propio snippet cita como contrato.
- No hay chequeo de scroll en `landingDiagnostico` (`lib/landing-token.ts`, la union de
  `chequeos`): el probador de /integraciones no puede decir «se está midiendo hasta dónde bajan».

**Vive en:** `lib/landing-token.ts` (bloque SCROLL del snippet, `SNIPPET_VERSION`, `NOVEDADES`,
`ganaConLaNueva`) · `app/api/track/vsl/route.ts` (`CONOCIDOS`) · `lib/leads.ts`
(`getTrackingEvents`) · `app/crm/lead-view/TrackingTimelineCard.tsx` ·
`tests/landing-snippet-emitido.test.ts`

## Retención del VSL

### ⚠️ Un video puede tener TRES identidades, y ninguna pantalla lo dice

**Síntoma reportado (22/09/2026, audio del grupo):** *«no está trackeando bien el tema de
la retención del VSL, porque ustedes no lo tienen en Panda Video o YouTube, lo tienen en
otro»*. El diagnóstico obvio —falta soporte para ese reproductor— **era el equivocado**: el
soporte de Wistia entró en la v16 el 15/09 y ese cliente ya la tenía puesta. Sus eventos
estaban llegando desde hacía una semana.

**Causa real: el mismo video estaba viviendo bajo tres ids distintos.**

| id | de dónde sale | qué tenía |
|---|---|---|
| `w:y4reukhgq8` | la rama propia del snippet (reconoce al player por su FORMA) | 2.624 eventos, con escalera de segundos |
| `wistia-player:y4reukhgq8` | el enganche GENÉRICO (`hostDeMedia`, id = etiqueta + `media-id`) | 1.303 eventos, duplicados, **sin** escalera |
| `wistia:y4reukhgq8` | lo que estaba guardado en `landing.videos` como EL VSL | **cero eventos, nunca existió** |

Dos defectos distintos con un solo síntoma:

**1. Doble medición.** Las dos ramas escuchan `play`/`pause`/`time-update` en CAPTURA sobre
`document`, así que las dos medían el mismo elemento. Medido: **348 plays con un id y 348
con el otro, los 348 pares dentro de 2 segundos**; lo mismo con pausa (286/286), exit
(288/286) y todos los `pNN`. O sea reproducciones al doble y la curva partida al medio. La
rama propia mide MÁS (la escalera `sNN`: 270 eventos contra 0), así que gana ella, y el
genérico se abstiene con `if (ok && wisHost(t)) ok = false;` **antes** de registrar.

⚠️ El comentario del código ya advertía del doble conteo… contra el `<video>` NATIVO. La
colisión que faltaba era con el enganche genérico, escrito después y para la misma clase de
elemento. **Un guard contra UNA fuente de duplicados no protege de la siguiente.**

**2. El puntero del VSL apuntaba a la nada.** `landing.videos` decía `wistia:<id>` y ningún
evento trajo nunca ese prefijo. El id de un video es una CLAVE: cruza exacto o no cruza. Con
el VSL marcado en un id inexistente, toda pantalla que habla de «el VSL» mostraba la curva
vacía. Y encima el id BUENO estaba en `landing.videos_ocultos` — alguien escondió el
verdadero creyendo que era el repetido.

⚠️ **Y la pantalla decía «sin actividad reciente»**, que afirma de más: suena a que el video
está tranquilo cuando lo que pasa es que ese id no es de ningún video. Son dos estados y
necesitan dos frases — ahora el huérfano dice «ningún evento con ese id».

**Cómo se encuentra en cualquier workspace** (una consulta, no una intuición): agrupar
`vsl_events` por el SUFIJO del `video_id` y quedarse con los sufijos que tengan más de un
prefijo. Al 27/09/2026 daba exactamente un caso en todo el producto.

**Lo que quedó SIN hacer:** las 1.303 filas de `wistia-player:` siguen en `vsl_events` del
ws13 inflando el conteo histórico de reproducciones. Son un duplicado estricto (todo tipo de
evento que tienen, el id bueno lo tiene igual o más, y les falta la escalera entera), así que
borrarlas no pierde nada — pero es un DELETE en producción y lo decide Martín.

### ⚠️ Y arreglar el SNIPPET no arregla a nadie: el snippet va pegado en la página del cliente

Es la parte que costó el segundo round. Con la v18 commiteada, desplegada y el histórico
borrado, **el id duplicado volvió a nacer esa misma noche**: 5 filas nuevas de
`wistia-player:` a las 23:51, dos visitantes distintos, tráfico pago real de Instagram
(`utm_source=ig` con `fbclid`), con 6 ms entre el `play` de un id y el del otro.

El porqué se mide en una consulta, y es la regla que queda: **`landing_visits.sv` dice qué
versión corre cada cliente, y al 27/09/2026 ninguno corría la v17 ni la v18.**

| workspace | versión instalada | visitas en 7 días |
|---|---|---|
| ws1 (Mauricio) | **v14** | 3.304 |
| ws11 | v15 y v16 | 73 |
| ws13 (Código Inmobiliario) | **v16** | 607 |
| ws14 | v15 | 38 |

Y la v16 es exactamente el commit (`3319ab20`) que introdujo las dos ramas que chocan. O
sea que el arreglo del snippet es correcto y **su alcance es cero hasta que cada cliente
repegue el código**, uno por uno, sin fecha.

**La regla: si el arreglo tiene que llegarle a alguien que ya instaló una copia de nuestro
código, va en el SERVIDOR.** El snippet se arregla igual —defensa en profundidad— pero el
que manda es el que recibe, porque es el único que alcanza a quien no actualizó.

El choke point existía y es uno: `app/api/track/vsl/route.ts` es la ÚNICA línea del repo
que escribe `vsl_events.video_id`, y tenía un `trim()` + `slice(120)` y nada más. Ahí entra
`canonizarVideoId` (`lib/video-id.ts`, sin `server-only` para que se pueda testear).

⚠️ **Pero el catálogo NO pasa por el beacon**, y son tres nacederos, no uno:

1. **El beacon** — todo evento de un navegador.
2. **`lib/landing-videos.ts`** — por ahí pasan las dos pantallas que escriben el catálogo y
   las tres operaciones de la API de MaKo. La canonicalización va adentro del saneo del id
   (`idVideo`), no en los llamadores: puesta en el call-site, la próxima pantalla nace sin ella.
3. **`videosDeHtml`** (`lib/landing-analisis.ts`) — pare ids leyendo el HTML, sin ejecutar
   nada, y **nunca toca el beacon**. De ahí salió el tercer id: emitía `wistia:` para el
   embed clásico. Medido: el ws13 tiene tres ids `drive:` en `landing.videos` y cero filas
   `drive:` en `vsl_events` — entraron por este camino.

⚠️ **Y el lector de prefijos estaba roto en los dos lugares que lo hacían.** `hostDeVideoId`
devolvía `null` para `wistia:` —un prefijo que su propio archivo emitía doce líneas más
abajo— y para toda la familia por nombre de etiqueta. Y `lib/leads.ts` preguntaba con
`/^[a-z]{1,6}:/i`, que contesta **false** para `wistia-player:`, `mux-player:` y
`lite-youtube:` (el guion no es `[a-z]` y el prefijo pasa de 6). Con `false`, esos ids caían
al respaldo «la única duración conocida» —que es la de Panda— y **se les calculaba el avance
con la duración de otro video**. El comentario de esa misma función explica por qué eso no
puede pasar.

⚠️ **Y canonizar al LEER puede romper lo que estaba escrito.** El ws13 tenía
`wistia-player:<id>` en `landing.videos_ocultos`; canonizado, eso resuelve a `w:<id>`, que es
**el VSL**. O sea que el propio arreglo le escondía el VSL al cliente. El backfill va en el
mismo commit, y no renombra a ciegas: fila por fila pregunta si existe la gemela canónica
(mismo visitante, mismo tipo, < 2 s) — si existe se borra (renombrar daría dos filas para un
hecho), si no existe se renombra. Las 5 tenían gemela.

**El control contra la recurrencia** (`tests/video-id.test.ts`) no comprueba el caso: comprueba
que no se pueda repetir. Escanea `lib/landing-token.ts` y falla si aparece un prefijo literal
que `video-id.ts` no declare, **y** si aparece una forma NUEVA de armar un id sin prefijo
literal (hoy hay exactamente dos: `tag + ':'`, la familia por etiqueta de donde salió
`wistia-player:`, y `WN + ':'`, el `wistia:` escrito partido para que el analizador de piezas
no lo lea como una marca de la página). Una rama nueva que mida un elemento que otra rama ya
mide rompe el test hasta que alguien declare el alias.

Probado rompiéndolo, cinco veces: el beacon vuelve al saneo viejo → 6 pasan / 1 falla · el
catálogo → 6/1 · el analizador vuelve a emitir `wistia:` → 6/1 · se saca un alias → 5/2 ·
`idDeclaraHost` vuelve al regex → 6/1.

**Vive en:** `lib/video-id.ts` · `app/api/track/vsl/route.ts` · `lib/landing-videos.ts` ·
`lib/landing-analisis.ts` · `lib/leads.ts` · `tests/video-id.test.ts`

**Vive en:** `lib/landing-token.ts` (`hostDeMedia`, `wisHost`) · `lib/landing-videos.ts` ·
`app/integraciones/NombrarVideos.tsx` · `tests/landing-snippet-emitido.test.ts`

### ⚠️ Capturar el % de retención por lead sigue sin funcionar, y es el pedido más repetido

**Síntoma:** después de meses, el dato no está. Palabras del dueño: *«dimos muchas vueltas
con esto, quiero que funcione»* (2026-08-06). No es una mejora: es un pendiente vivo con
historia.

**Pista registrada:** el índice de memoria del proyecto atribuye la muerte de la curva del VSL
a que **`panda_timeupdate` no trae `duration`**, así que el porcentaje no se puede calcular en
el cliente. Verificá eso primero antes de rediseñar nada.

**Regla:** esto no se declara hecho hasta verlo en la app con datos reales. *«no veo que se
haya marcado el progreso en la app. Eso no lo hiciste… revisa porque el fallo está de tu
lado»* — si el dueño dice que falla, el fallo es nuestro hasta que se pruebe lo contrario.

**Vive en:** `app/api/track/vsl/route.ts` · `lib/leads.ts` (`getVslEngagement`, `getVslEngagementMap`)

### ⚠️ `video_id` se guarda desde la mig 0061 y no lo lee nadie: el segundo VSL va a contaminar todo

**Síntoma:** hoy no se nota porque en producción hay un solo VSL. El día que se suba el
segundo, plays, `max_pct` y los cortes de retención pasan a mezclar dos videos sin que nada
avise.

**Causa:** la mig 0061 agregó `video_id` y `vsl_titulo` a `vsl_events` justamente para poder
comparar VSLs, y el beacon los recibe. Pero los tres consumidores —`getVslEngagement`,
`getVslEngagementMap` y `getComportamiento` del Landing Analyst— **no filtran ni agrupan por
video**: mezclan todo en un solo número. Ojo: en el camino del insert también se reportó lo
inverso —`video_id` llegando en el payload y quedando fuera del insert— así que verificá los
dos extremos antes de dar por sentado que el dato está completo. Como `PANDA_VSL_VIDEO_IDS`
es una lista (multi-VSL / A-B de VSL), sin esto no hay forma de atribuir la retención por
persona a una versión del video. Es una migración de una columna y una línea en el insert,
más el `group by` en los consumidores.

**Falta además el índice:** `vsl_events` solo tiene índices por `visitor_id` (duplicado) y
`workspace_id`, así que toda consulta por ventana temporal o por video es un seq scan.

**Vive en:** `supabase/migrations/0061_tracking_granular.sql:12-13` · `app/api/track/vsl/route.ts:105`
(payload), `:152-186` (insert) · `lib/leads.ts:1143-1146,1178-1181` · `lib/landing-analyst.ts:156`
· *2026-07-02 audit-automatizaciones-lead · 2026-08-05 ~alta-tab-vsl-analyst*

### ⚠️ El evento de abandono se guarda con el porcentaje exacto y ningún query lo consume

El evento `tipo_evento='exit'` **sí** se persiste con el porcentaje exacto de abandono. El
dato que le diría al closer «abandonó al 62%, antes de la oferta» está en la base **desde el
día uno** y no lo lee nadie.

**Regla:** antes de agregar tracking nuevo, grepeá si el que ya existe tiene consumidor. Acá
había dos columnas y un tipo de evento guardándose para nadie.

**Vive en:** `app/api/track/vsl/route.ts:152-186`

### ⚠️ El snippet medía UN video por página, y el segundo salía mal — no «mezclado»

*2026-08-14*

La pregunta que abrió esto era de producto: «una landing puede tener muchos videos, ¿cómo
sabemos cuál es el VSL?». **El diagnóstico obvio era el equivocado**: no era un problema de
etiquetado sobre datos correctos. Todo el estado del player vivía en variables de la PÁGINA,
no del video:

```js
var yaPlay = false, hitos = {}, seg = {}, pct = 0, dur = 0, segs = 0, vid = null, tit = null;
```

Con dos videos, eso no promedia dos mediciones. Rompe la segunda, de cuatro formas que se
tapan entre sí:

| Variable | Qué pasa con dos videos |
|---|---|
| `yaPlay` | Solo el **primer** video manda un `play`. El segundo no existe para el sistema aunque lo miren entero. |
| `hitos` | El `p25` del segundo se suprime porque el primero ya lo mandó. |
| `dur` | La pisa el último que reporte duración → el % de un video se calcula con la duración de **otro**. |
| `exit` | Uno solo: de dos videos mirados queda el punto de abandono del último que habló. |

Un VSL de 20 min conviviendo con un testimonio de 40 s medía el testimonio como si durara
veinte minutos. Y como `vid` viajaba en cada evento, la base guardaba un `video_id` que hacía
ver el dato como atribuido: **la columna correcta al lado del número equivocado.**

**Por qué sobrevivió tanto:** el síntoma es «la retención da raro», que no apunta a ningún
archivo. Nada falla, nada queda vacío, ningún chequeo se pone en rojo. Y el caso solo aparece
en landings con más de un video, que no es lo que uno prueba.

**Regla:** cuando un script de terceros emite eventos de varias instancias al mismo listener,
el estado va **indexado por emisor** desde el primer día, aunque hoy haya una sola instancia.
Un estado global es correcto exactamente mientras N=1, y el día que pasa a 2 no falla: miente.
El emisor se resuelve por el id que manda el propio evento, con respaldo en el iframe que
originó el `postMessage` (`ev.source`) — sin ese respaldo, dos players que no se identifiquen
vuelven a compartir un estado.

**Y el corolario del test:** afirmá la ESTRUCTURA, no un caso. `tests/landing-optin.test.ts`
verifica que nada mutable del player viva fuera del estado por video. Un contraejemplo pedía
una landing real con dos players, y para cuando se arma, el dato ya salió mal.

**Vive en:** `lib/landing-token.ts` (`est()`, `quien()`, `alSalir()`, `SNIPPET_VERSION = 5`)

### El código pegado en la landing del cliente no se actualiza solo — ni el aviso alcanza

Corolario operativo del anterior: arreglar el snippet **no arregla a nadie**. El código queda
congelado en el HTML del cliente y los eventos del código viejo siguen llegando, así que la
integración se ve en verde. Por eso existe `SNIPPET_VERSION`, que viaja como `sv` en cada
evento, lo persiste el beacon en `landing.snippet_version` y lo compara el cron
`tracking-vigilante`.

**Lo que faltaba, y el test ahora lo exige:** cada versión nueva tiene que traer su renglón en
`NOVEDADES`. Sin eso, el aviso de WhatsApp sale con el fallback «mejoras de medición» — y el
mecanismo entero existe para que el cliente sepa **qué gana** al volver a pegar el código. Un
«actualizá» a secas es una tarea sin motivo, y menos todavía cuando lo que tiene puesto parece
andar.

**Vive en:** `lib/landing-token.ts` (`NOVEDADES`, `novedadesDesde`) ·
`app/api/cron/tracking-vigilante/route.ts`

### El «código que se pega» son 86 mil caracteres: no puede salir por un canal que lee un modelo

*2026-09-16 api-mako-areas*

**Síntoma:** una lectura que devuelve el snippet revienta el turno del doer.

**Causa:** suena a unas líneas y son **86.387 caracteres** (medido). `landingSnippet`
(`lib/landing-token.ts:1093`) embebe el runtime entero del Pixel —Panda, `<video>`, Wistia,
YouTube, Vimeo, clics, formularios, agendas— y crece con cada host que se aprende a medir. Nada
en el camino lo corta: el bucle de tools de `lib/anthropic.ts` mete la salida entera en el
`tool_result` (`:377-389`) y el runner del registro la devuelve tal cual
(`lib/api-mako/ejecutar.ts:173`). En el doer de WhatsApp eso se come el techo de tokens del
turno siguiente, y un modelo tampoco lo puede copiar a un mensaje.

**Regla:** nada que devuelva el snippet sale por un canal donde lo lee un modelo. Por chat va lo
que la persona necesita para actuar —el link a la pantalla donde se copia con un botón, la
versión y el largo—; el script entero, solo por HTTP (`ver_codigo_pixel`,
`lib/api-mako/areas/landing.run.ts:184-192`).

**Vive en:** `lib/landing-token.ts` (`landingSnippet`) · `lib/api-mako/areas/landing.run.ts`
(`ver_codigo_pixel`) · *2026-09-16 api-mako-areas*

### ⚠️ Los botones de editar y borrar se gateaban en «está guardada», y nadie tenía guardadas

*2026-08-14*

El desplegable de páginas ofrece dos clases: las **guardadas** (las escribió la persona) y las
**detectadas** (salieron de los eventos). El lápiz y la basura se mostraban solo sobre una
guardada, con un argumento correcto — ofrecer «borrar» sobre una detectada es prometer algo
que no se cumple, porque la próxima visita la vuelve a traer.

El argumento era correcto y la conclusión no. Quien nunca guardó una a mano ve **todas** sus
páginas como detectadas, así que no veía un solo botón y la función entera era invisible. Que
es el caso normal, no el raro.

**Regla:** cuando una condición esconde una acción, contá cuántos usuarios reales caen del lado
que la esconde. Si la mayoría cae ahí, la condición no está protegiendo un caso raro: está
apagando la función. La salida no es sacar el guard sino **pagar lo que el guard estaba
señalando** — acá, una lista de escondidas (`landing.paginas_ocultas`) para que borrar cumpla
también sobre una detectada.

**Y el bug de comparación que lo habría roto igual:** el gate era `paginas.includes(url)`,
string crudo contra lista **normalizada**. Al guardar `tu-pagina.com` la lista pasa a tener
`https://tu-pagina.com`, el `includes` da false y los botones desaparecían justo después de
guardar. Toda comparación de URLs pasa por `mismaPagina()`. En el mismo archivo había un
`includes` de **substring** buscando la recién guardada: daba por iguales una página y otra que
la contiene como prefijo, que es exactamente la forma de los previews de Netlify
(`6a7f2b--que-es-lidermente.netlify.app` contiene a `que-es-lidermente.netlify.app`).

**Vive en:** `lib/landing-paginas.ts` (`mismaPagina`, `conOculta`) ·
`app/integraciones/ProbarTracking.tsx` (`hayElegida`) · `app/integraciones/landing-actions.ts`

### ⚠️ «La única duración conocida» se le aplicaba a CUALQUIER video

*2026-08-14*

Encontrado mapeando el CRM para otra cosa. `durDe` en `lib/leads.ts` resolvía la duración de
un video así:

```ts
if (v && durs.has(v)) return durs.get(v)!;
return durs.size === 1 ? [...durs.values()][0] : null;   // ⛔
```

El respaldo existe por una razón real: el `video_id` de `vsl_events` no siempre coincide con
el que reporta el cron de Panda, y sin él la ficha mostraba «—» para todos. Con **un** video
es correcto. Con dos es un porcentaje **inventado**: al testimonio de 40 s se le aplica la
duración del VSL de 20 minutos y su avance da ~0% para siempre.

Y no falla — contesta mal, que es el modo caro: se ve exactamente igual que un porcentaje
correcto, nadie lo revisa y ninguna pantalla lo dice.

**Regla:** un respaldo que asume «hay uno solo» tiene que **chequear** que haya uno solo. Si
no se sabe de qué video es la duración, va `null` y la pantalla muestra «—», que es la verdad.
`resolverDuracion(videosEnJuego, durs)` cuenta los `video_id` distintos antes de asumir nada.
En el camino del lote (`getVslEngagementMap`) se cuentan sobre el **lote entero**, no sobre las
filas de cada visitor: si un visitor miró uno solo pero el negocio tiene dos, el respaldo
sigue siendo una invención.

**Y el corolario de los eventos huérfanos:** los que no se pueden atribuir a ningún video
(datos anteriores a la v5, o el `exit` de un player anónimo) no se tiran **ni** se le suman a
un video concreto. Van a su propio balde, «Video sin identificar». Descartarlos perdería
mediciones reales; fundirlos contamina una curva sin que se note.

**Vive en:** `lib/leads.ts` (`resolverDuracion`, `videosDe`, `getVslEngagement`,
`getVslEngagementMap`) · `app/crm/lead-view/ComportamientoCard.tsx`

### El número correcto mal ATRIBUIDO es peor que ningún número

La ficha del lead pintaba «Retención del VSL: 80%», y ese 80 era el máximo sobre **todos** los
videos de la página. Con un testimonio de 40 s al lado del VSL, el 80% del testimonio se leía
como que la persona casi terminó la oferta — y es la lectura sobre la que un closer decide
cómo encarar la llamada.

El cálculo nunca estuvo mal. Lo que estaba mal era el **rótulo**, y por eso no había forma de
detectarlo mirando el número.

**Regla de pantalla:** un rótulo en singular («el VSL», «la campaña», «el pago») es una
afirmación de que hay uno solo. Si el modelo de datos permite varios, o el rótulo se hace
plural o la pantalla desglosa — pero el número agregado bajo el nombre de uno de los
componentes es siempre una mentira que se ve creíble.

Cómo quedó, siguiendo las reglas de la casa: con **varios** videos el minicard único no se
pinta y abajo va una lista con filete, un renglón por video, con la barra de avance como
**borde** de la fila (2 px, ancho completo) y el número al lado del color. Con **uno solo** la
pantalla es exactamente la de antes — partir en una lista de un renglón le agrega ruido al 95%
de los casos para resolver el 5%.

**Vive en:** `app/crm/lead-view/ComportamientoCard.tsx` (`FilaVideo`, `varios`)

### Una pregunta, no dos: el nombre del video ES la respuesta a «cuál es el VSL»

El primer diseño tenía un desplegable para el nombre y aparte un control «marcar como VSL».
Dos controles para una decisión, y el segundo se queda sin contestar porque no se entiende qué
agrega — con lo cual `esVsl` queda vacío y todo lo que depende de él no funciona.

Quedó uno solo: los tipos de fábrica (`TIPOS_VIDEO`), los nombres que ya usó ese negocio, y
«Otro tipo de video…» de última opción. Elegir «VSL» marca. Es una heurística sobre texto que
escribe una persona (`esTipoVsl`, palabra suelta), y por eso la fila muestra el distintivo
**VSL al instante**: la consecuencia se ve antes de guardar, que es lo único que vuelve
corregible una heurística.

**Y el bug que encontró el test, no la pantalla:** `conVideo` reconstruía el objeto con solo
`{id, nombre}`, así que **renombrar el VSL lo degradaba en silencio** — la pantalla de
renombrar no manda ese flag porque no está preguntando eso. Ahora `esVsl` tiene **tres**
valores: `true` marca, `false` desmarca y **`undefined` significa «no lo toques»**. Es «cada
pregunta, su campo»: contestar «cómo se llama» no puede contestar «cuál es el VSL» por
omisión.

**Vive en:** `lib/landing-videos.ts` (`conVideo`, `esTipoVsl`, `TIPOS_VIDEO`, `rotuloDe`) ·
`app/integraciones/NombrarVideos.tsx`

### Un test que lee el fuente hace match con el comentario que explica la regla

Cuarta vez en este repo, y esta vez con un agravante nuevo. La aserción era
`!/<select/i.test(fuente)` y falló sobre código que cumple la regla, por dos motivos a la vez:

1. El comentario de al lado dice, textual, «el `<select>` nativo está prohibido».
2. **El flag `/i` prohibía el `<Select>` de la casa que la aserción venía a exigir.** En JSX la
   mayúscula ES la diferencia entre el elemento del DOM y el componente de React.

**Regla:** un test que lee fuente saca los comentarios primero, y **nunca** usa `/i` para
buscar JSX. Lo que se busca es lo que se ejecuta, no lo que está escrito al lado.

**Vive en:** `tests/landing-videos.test.ts` (`sinComentarios`)

### ⚠️ Siete renglones de la misma landing: los previews de deploy de Netlify

*2026-08-14*

Reportado como **«pareciera que se están auto-guardando un montón de URLs iguales con números
enfrente, no entiendo eso»** — y el diagnóstico obvio (el guardado) era el equivocado dos veces:
no se estaba guardando ninguna (todas decían «detectada») y las URLs no eran iguales.

Netlify le da a **cada deploy** una URL inmutable con el id del deploy adelante:

```
6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app
6a7f2bbe8653f3b1e806517f--que-es-lidermente.netlify.app
6a7e28766cf06853a0246d16--que-es-lidermente.netlify.app
```

El snippet mide en todas. Publicando varias veces por día eso llena el desplegable con la misma
página — y, mucho peor que el ruido visual, **reparte la medición entre todas**: la retención de
esa landing quedaba dividida en siete pedazos sin que nada lo dijera.

La causa estaba en `landingDiagnostico`, que deduplicaba sobre el texto **crudo** de
`landing_url`. Ahora normaliza antes, y `normalizarUrl` colapsa esos hosts.

**El colapso es deliberadamente angosto:** solo cuando el prefijo es inconfundiblemente un id de
deploy — 20+ caracteres hexadecimales (los de Netlify tienen 24). Los deploys **por rama**
(`staging--sitio`, `preview--sitio`) quedan intactos: son entornos distintos y fundirlos
mezclaría producción con pruebas. Vercel arma sus previews con guiones simples y sin separador
propio, así que ahí un preview no se distingue de un proyecto que se llama así — y adivinar
sería peor que dejarlos separados.

**Regla:** una lista de «lo que observamos» se deduplica por la **identidad canónica**, nunca
por el string. Cualquier hosting moderno emite una URL por deploy, así que un `new Set` sobre
texto crudo va a mostrar N copias de todo lo que se publique seguido.

**Vive en:** `lib/landing-token.ts` (`landingDiagnostico`, el `urls`) · `lib/landing-paginas.ts`
(`hostCanonico`)

#### Y el preview del EDITOR se EXCLUYE, no se colapsa (2026-08-15)

El mismo síntoma volvió con Lovable, y **la respuesta correcta es la contraria**. Medido en
`landing_visits` del ws 1 (la landing de Mauricio, `multiplicatusresultados.com`), en **un solo
día** y para una sola página:

```
id-preview--cad30c6f-….lovable.app/?__lovable_sha=…
id-preview-734641ee--cad30c6f-….lovable.app/?forceHideBadge=true
cad30c6f-….lovableproject.com/?__lovable_load_id=…
```

Ninguno matchea `^[0-9a-f]{20,}--`: el primero tiene un prefijo con letras, el segundo tampoco es
hexadecimal puro y el tercero **ni siquiera lleva `--`** — es otro dominio entero. Así que los
tres entraban al desplegable como landings distintas.

**La distinción que importa, y que no es obvia:** un preview de deploy de Netlify **es el sitio
real** congelado en una versión — quien entra ahí es un visitante, y por eso colapsarlo suma
tráfico de verdad. El preview del EDITOR de Lovable no es eso: es el iframe donde el dueño está
construyendo la página, recargando decenas de veces por tarde. **Colapsarlo habría metido esas
sesiones de desarrollo adentro del denominador de su tasa de conversión**, y la tasa se habría
hundido sin que nada lo dijera — cambiando un problema visible (renglones de más) por uno
invisible (un número de negocio mal). Se excluye, como una página escondida, y sus visitas quedan
bajo su propio host.

**La exclusión es angosta a propósito:** `lovableproject.com` entero (el sandbox del proyecto,
nunca una dirección que se publique) y el prefijo `id-preview` dentro de `lovable.app`. Un cliente
sin dominio propio **publica de verdad** en `<proyecto>.lovable.app`: excluir «todo Lovable» lo
dejaría sin una sola página que elegir en el paso 1.

Aparte, `__lovable_sha`, `__lovable_load_id` y `forceHideBadge` fueron a `PARAMS_DE_MEDICION`:
son de la VISITA y cambian en cada recarga del editor.

**Regla:** antes de fundir dos URLs, preguntá **de quién es el tráfico de cada una**, no si son la
misma página. Dedupear es una decisión sobre los DATOS, no sobre el desplegable: el mismo colapso
que limpia una lista contamina la métrica que la lista alimenta. Es el caso de
[AGENTS.md](../AGENTS.md) → «Un total solo se puede sumar si el recurso se puede MOVER DE LUGAR»,
aplicado a visitas en vez de a cuota.

**Vive en:** `lib/landing-paginas.ts` (`esPreviewDeEditor`, `PARAMS_DE_MEDICION`) ·
`lib/landing-token.ts` (`landingDiagnostico`, el filtro del `urls`) · `lib/landing-analyst.ts`
(`urlsDescubiertas`, para no gastar un análisis pago sobre el editor)

**Lo que quedó SIN hacer:** los chequeos de `landingDiagnostico` (¿llega algún evento? ¿el snippet
está al día?) siguen contando las visitas del preview. Es deliberado —una visita del editor SÍ
prueba que el código está puesto— pero significa que el panel puede decir «está midiendo» sobre
una página que todavía no se publicó. Vive en `lib/landing-token.ts` (`landingDiagnostico`).

### ⚠️ Hay dos `normalizarUrl` con contratos opuestos, y la del panel conserva el nombre y el email del lead

*2026-09-16 api-mako-areas*

**Síntoma:** la lista de páginas del probador puede ofrecer
`…/gracias?name=Codigo+Inmobiliario&email=…`. No es hipotético: esa URL la dejó un agendado
real del ws13 el 24/08 (lo cuenta el comentario de `lib/landing-token.ts:619-623`) y está en
`landing_visits.landing_url`.

**Causa:** dos funciones con el mismo nombre, que se importan una por otra sin que nada avise.

| | `lib/landing-paginas.ts:118` | `lib/landing-fetch.ts:69` |
|---|---|---|
| El query | lo **conserva**, salvo `PARAMS_DE_MEDICION` (`:134`) | lo **tira** entero |
| El host | solo exige un punto (`:126`): pasa `169.254.169.254` y cualquier puerto | tampoco lo valida: eso es `validarDestino` |
| Si no puede | devuelve `null` | tira |
| La usan | `landing-config`, `landing-snapshot`, `landing-token` (el `urls` de `landingDiagnostico`, `:1062-1066`) | `landing-analyst`, `landing-writer` |

Una redirección de agenda escribe los datos del lead en el query, y el normalizador de
`landing-paginas` los deja pasar a toda lista que se arme con él. El runner de la API tuvo que
importar las dos con alias (`normalizarPagina` / `normalizarAnalisis`,
`lib/api-mako/areas/landing.run.ts:23-25`) para no confundirlas.

**Regla:** antes de mostrar o devolver una URL que escribió el beacon, mirá por qué
normalizador pasó. Con el de `landing-paginas`, el query del visitante viaja entero.

**Lo que quedó SIN hacer:** sacar del query lo que no identifica la página en
`lib/landing-paginas.ts:134`, y validar el host en `:126`. No se tocó por ser una lib
compartida — y ojo: cambiar el query cambia la clave con la que se guardan `landing.config` y
`landing.snapshot` (las dos derivan con esta función), así que no es un cambio de una línea.

**Vive en:** `lib/landing-paginas.ts` y `lib/landing-fetch.ts` (`normalizarUrl`) ·
`lib/landing-token.ts` (`landingDiagnostico`) · *2026-09-16 api-mako-areas*

### Una colección que se ELIGE también hay que MANTENERLA

Los botones de corregir y quitar vivían afuera del desplegable y actuaban sobre la página
seleccionada. Con siete renglones de la misma landing, sacar el que sobra obligaba a
**seleccionarlo primero** — o sea, a elegir justo lo que se quiere que desaparezca.

Ahora cada renglón trae los suyos (`DropdownAccion` en `app/components/Dropdown.tsx`), y los de
afuera se quedan porque sirven sin abrir el menú. Dos cosas que no son opcionales al hacerlo:

- **Con acciones, el renglón deja de ser un `<button>`.** Un `<button>` adentro de otro es
  marcado inválido *y* el click del de afuera se dispara igual: «borrar» además seleccionaría
  lo que se acaba de borrar. Van como hermanos en una fila.
- **`stopPropagation` + `preventDefault`.** El menú se cierra por un listener de click en el
  documento; sin frenarlo, la acción corre, el panel desaparece y se lee como que no pasó nada.
- Y sin acciones el renglón sigue siendo **exactamente** el de antes: lo usan decenas de
  pantallas y no tienen por qué cambiar de marcado por una variante nueva.

**Vive en:** `app/components/Dropdown.tsx` (`renderOption`, `DropdownAccion`) ·
`app/integraciones/ProbarTracking.tsx` (`accionesDe`)

### ⚠️⚠️ Ocho leads reales entraron bien y nadie los vio nunca

*2026-08-14 · forense de 8 agentes + consulta a producción*

**El diagnóstico obvio era el equivocado, y por partida doble.** Reportado como «envié el
formulario y no se registró, eso es gravísimo» y «me marca con un check que todo está bien,
eso está muy mal». Consultada la base de producción **antes** de tocar nada:

```
propkektebfllgc2 | landing:3764673479 | «Prueba MaKo»    | 17:16:32 | pendiente
propx8gq58em17vu | landing:9984920076 | «Magdiel Cortes» | 15:36:50 | pendiente
propxnjgz6dj5mhk | landing:998136...  | «Marina Olvera»  | 15:12:15 | pendiente
… OCHO propuestas de lead en `pendiente` en el ws11, cuatro de gente REAL.
```

El opt-in funcionaba. La captura funcionaba. **El check verde decía la verdad.** Lo que no
existía era ningún camino desde un opt-in hasta un humano, y eran **tres huecos encadenados**:

1. **`propuestasPendientes()` tenía CERO call-sites.** Vivía en `lib/propuestas.ts` desde el
   día uno. No había bandeja: la única pantalla era `/crm/revisar/<id>`, que exige el id.
2. **Ese id solo se devolvía en la respuesta HTTP al navegador del visitante anónimo**, y el
   snippet la tira (`.catch(function(){})`, sin `.then`). Los otros canales que escriben en la
   misma tabla **sí** devuelven el link para pasárselo a la persona; la landing es el único que
   no puede — quien completa el formulario ve la página de gracias del cliente.
3. **El feed de eventos del panel se arma solo con `vsl_events` y `landing_visits`**, así que un
   opt-in perfecto no produce ni un renglón ahí. «No se registró nada» estaba garantizado.

**La regla, y es general:** si un canal deja algo para revisar y **no puede devolver el link
por donde entró**, el link sale por un aviso — y además tiene que existir una **lista**. Un
aviso es un EVENTO; una bandeja es un ESTADO. Lo que se pierde siempre es lo que solo era un
evento: un aviso que no se manda, no llega, o se lee y se olvida no deja nada atrás.

**El corolario del chequeo verde, que es lo más sutil de todo esto:** el check decía «llegó al
menos un formulario ✓» y era **cierto**. Mentía por **omisión** — le faltaba el segundo verbo.
Llegó ¿y **entró**? Una propuesta sin confirmar no es un lead: es una persona que dejó su
teléfono y a la que nadie escribió. Un indicador que afirma la mitad verdadera de un proceso
de dos pasos es más peligroso que uno roto, porque nadie lo va a auditar.

**Y el error que casi repito arreglándolo:** la primera versión del fix hacía que el chequeo
linkeara a la propuesta **más reciente**. A las otras siete no se llegaba por ningún lado — o
sea, el arreglo reproducía el problema que venía a cerrar, en chiquito.

**Vive en:** `app/crm/revisar/page.tsx` (la bandeja, nueva) · `app/api/track/optin/route.ts`
(el aviso) · `lib/avisos-catalogo.ts` (`lead-de-landing`) · `lib/landing-token.ts` (el chequeo)

### La llave de idempotencia era el teléfono tal como se tipeó

`ref = landing:${telefono}` usaba el valor **crudo** del input. «998 136 1529» y «9981361529»
son dos llaves distintas, así que la misma persona creaba dos propuestas — justo lo que la
idempotencia venía a evitar. Ahora la llave son los dígitos, últimos 10: el mismo número con y
sin código de país es el mismo número.

**Pendiente, del mismo forense:** `crearPropuesta` matchea la `ref` **sin mirar el estado**, así
que una propuesta ya **descartada** bloquea a esa persona para siempre. Si alguien descarta por
error, ese contacto no puede volver a entrar nunca por la landing.

**Vive en:** `app/api/track/optin/route.ts` (`clave`) · el pendiente en `lib/propuestas.ts`
(`crearPropuesta`)

### Los clicks no se medían, y para esta landing el click ES el embudo

El snippet emitía `pageview`, `play`, `pNN`, `sNN` y `exit`. Nunca un click. En una landing
cuyo CTA es un ancla (`#registro`) y cuyo cierre es un link de WhatsApp, eso deja **cero puntos
intermedios** entre «visitó» y «dejó sus datos»: una página que convierte mal no se distingue
de una que nadie mira.

Resuelto en la v6 del snippet (mig 0133, columna `detalle`). Decisiones que conviene no
revertir:

- **Columna propia, no reusar `vsl_titulo`.** «Cómo se llama el video» y «qué se clickeó» son
  dos preguntas; meterlas en un campo pierde una de las dos.
- **Sin `default` en la columna.** Un evento que no es click no tiene detalle, y NULL dice eso.
  Un default inventaría un dato — el mismo error que dejó las filas `tipo_evento = 'desconocido'`.
- **Nunca `preventDefault`.** Lo que la persona quería hacer tiene que pasar igual aunque el
  envío falle.
- **Tope de 40 por carga**, o un carrusel manda cientos y el ruido tapa lo que importa.
- **El destino manda sobre el texto**: dos botones distintos pueden ir al mismo lado, y lo que
  se cuenta es adónde va la gente.
- Y hubo que **sumar `'click'` a la lista blanca del beacon**: sin eso cada click habría entrado
  como `'desconocido'`.

**Vive en:** `lib/landing-token.ts` (el listener) · `app/api/track/vsl/route.ts` ·
`supabase/migrations/0133_vsl_events_detalle.sql`

### El probador mostraba las últimas 24 h, no tu prueba

*2026-08-14*

Reportado como **«al darle probar te trae TODOS los eventos pasados… lo supe porque vi
diferentes horarios»**. La ventana era de 24 h, así que aparecían visitas de la mañana entre
las de recién y no había forma de saber cuáles eran propias.

Resuelto con el mismo mecanismo que el `test_event_code` de Meta: «Probar» genera un id, abre
la landing con `?mko_test=<id>`, el snippet lo guarda en `sessionStorage` de esa pestaña y lo
devuelve en cada evento; el panel filtra por ese id.

**⚠️ Filtrar por HORA no alcanzaba, y es la parte que importa.** Arrancar la ventana cuando
empieza la prueba deja afuera los eventos viejos pero **no** los de otra gente visitando la
página en ese momento — y esta landing tiene tráfico real, entran leads cada pocos minutos. Un
probador que te muestra la visita de un desconocido como si fuera tuya es **peor** que uno que
muestra de más: te hace creer que tu código anda cuando lo que anda es el de la visita ajena.

Tres decisiones que conviene no revertir:

- **`sessionStorage`, no cookie.** El marcador tiene que sobrevivir a navegar dentro de la
  pestaña (un CTA que va a otra página) y morir al cerrarla. En una cookie contaminaría el
  tráfico real durante un año, marcando como «prueba» visitas que no lo son.
- **El hash va SIEMPRE al final al armar la URL.** `pagina.com/#registro?mko_test=x` deja el
  parámetro **adentro del hash** y `location.search` no lo ve nunca — y esa landing se prueba
  justamente con `#registro`.
- **El marcador viaja en cada consulta, incluida la del intervalo.** Pasar `traer` directo a
  `setInterval` le entrega el contador del timer como primer argumento: la lista arrancaba
  limpia y a los 3 segundos volvían las 24 h.

**Vive en:** `app/integraciones/ProbarTracking.tsx` · `lib/landing-token.ts`
(`landingDiagnostico(prueba?)`, el bloque `mko_test` del snippet) ·
`supabase/migrations/0134_marcador_de_prueba.sql`

### Un opt-in no podía aparecer en el feed del probador, nunca

El feed se armaba con `vsl_events` y `landing_visits` y nada más. Un opt-in vive en
`propuestas` —porque no es un evento: es algo para revisar— así que un formulario que entraba
**perfecto** no producía un solo renglón. Y la instrucción de la pantalla decía, textual,
«completá tu propio formulario, los eventos aparecen acá».

**Regla:** cuando una pantalla instruye «hacé X y vas a ver Y», hay que verificar que el
camino de datos de Y **exista**. Una promesa que la pantalla no puede cumplir no se lee como
un bug de la pantalla: se lee como que lo que hiciste falló.

**Vive en:** `lib/landing-token.ts` (la tercera query de `landingDiagnostico`)

### El probador se contradecía solo: «no llega la visita» y «ya se puede calcular la retención»

*2026-08-16*

Visto en una prueba real: el panel decía **«aún no llega la visita»** y dos renglones más
abajo **«llegan los avances: ya se puede calcular la retención»**. El `pageview` estaba
guardado en la base, con su marcador de prueba y su versión del snippet. Las dos frases eran
lo que el código calculaba; la que mentía era la primera.

**La causa es de ORDEN, no de datos.** Los chequeos (`hayPageview`, `hayPlayManual`, `hayClick`…)
se calculaban sobre la MISMA lista que se dibuja en pantalla, que se ordena de más nueva a más
vieja y **se corta en 25** para que el feed sea legible. El `pageview` y el `play` son los
PRIMEROS eventos de cualquier prueba: son los primeros en caerse del corte. El bug nació el día
que el snippet empezó a mandar más eventos por visita —clics, salió, volvió—; antes de eso 25
alcanzaba y por eso nadie lo vio.

**Regla: «que no entre en la ventana» no es «que no haya pasado».** Un chequeo que depende de
cuántos eventos entran en una lista de pantalla mide la lista, no el negocio. Lo que viaja a la
pantalla es la ventana corta (`eventosVisibles`); los chequeos y el `ultima` —«cuándo fue lo
último que llegó»— salen de la lista completa.

⚠️ **Lo que queda sin cerrar, y es la misma trampa un escalón más arriba:** las tres queries
traen `limit(40)` / `limit(20)` / `limit(10)`. Con marcador de prueba sobra, porque filtra a
esa prueba; **sin marcador** (el camino de 24 h) una landing con tráfico real puede empujar el
`play` fuera de los 40 y el chequeo vuelve a medir el límite. El `pageview` no corre ese riesgo
—sale de `landing_visits`, que es una query aparte—. Si se toca, el límite de `vsl_events` es
el que importa.

**Vive en:** `lib/landing-token.ts` (`landingDiagnostico`, el bloque `eventosVisibles`)

### Descartar una propuesta encadenaba a esa persona para siempre

`crearPropuesta` hacía `select('id, estado')` y **no miraba el estado**: cualquier fila con esa
`ref` bloqueaba, incluida una `descartada`. Descartar no significa «esta persona no existe»:
significa «esto no era un lead» o «me equivoqué». Si mañana vuelve a completar el formulario,
eso es intención nueva y tiene que poder revisarse — con el código viejo no volvía a entrar
nunca más, en silencio.

Las otras dos **sí** bloquean, y por razones distintas: `pendiente` ya está esperando (volver a
proponerla duplica la fila) y `aplicada` significa que el lead **ya** está en el CRM
(re-proponerlo lo duplicaría). La `ref` de la que vuelve a entrar lleva el día, para no chocar
con la vieja sin perder la idempotencia del doble submit.

**Regla general:** un `select` que trae un campo y no lo usa es una decisión que alguien pensó
y no terminó de escribir. Cuando veas uno, la pregunta no es «sobra este campo» sino «qué
tendría que estar decidiendo con él».

**Vive en:** `lib/propuestas.ts` (`crearPropuesta`)

### ⚠️⚠️ El video de la clienta NUNCA se pudo medir: es un `<video>`, no un Panda

*2026-08-14 · verificado bajando el HTML de la landing, no deducido*

El único `pandavideo` de `que-es-lidermente.netlify.app` es **nuestro propio snippet**. Su
video es un `<video controls>` común, y el snippet escuchaba **solo** mensajes `panda_*` de un
iframe. No era un bug intermitente: era **imposible** que registrara algo.

Un solo hueco, **tres síntomas que no se parecen entre sí** y que se reportaron por separado:

1. «le di PLAY y no me apareció en la prueba».
2. «Nadie reprodujo el video en 24 h» — una afirmación que iba a ser cierta **para siempre**.
3. «nunca me dejó configurar si ese video es un VSL o un testimonio» — la pantalla para
   nombrarlos solo aparece si hay videos **detectados**, y se detectan por sus eventos.

**Regla:** antes de dar por bueno «el player está enganchado», verificá **qué player usa el
cliente**. Un integrador que soporta una sola tecnología y no lo dice se ve idéntico a uno roto
— y peor, el mensaje de error («nadie reprodujo») culpa al usuario de algo que el código no
podía hacer.

Ahora el `<video>` nativo se mide igual que Panda, reusando el **mismo** estado por video: dos
clases de player alimentando dos modelos distintos es cómo se llega a dos curvas que no se
pueden comparar. Con un `<video>` además se conoce la duración desde el DOM, así que se miden
hitos de 5% de verdad y no solo la escalera de segundos.

Tres decisiones que conviene no revertir: el id sale del `id` o del `src` del elemento y la
**posición es el último recurso** (reordenar la página cambiaría de qué video habla cada
curva); un `MutationObserver` engancha los que aparecen después (un builder monta el player al
hacer scroll, y enganchar solo al cargar deja sin medir justo al de más abajo); y la marca
`__mko` lo hace idempotente.

**Vive en:** `lib/landing-token.ts` (`engancharNativos`, `idDeVideo`, `SNIPPET_VERSION = 7`)

### El propio probador generaba los duplicados de landing

Cada corrida abre `?mko_test=<id>` distinto, y eso entraba en la lista de páginas como una
página nueva. Los UTM y los click-ids son el mismo caso.

**Regla:** un parámetro que habla de la **visita** (de dónde vino, quién la trajo, si es una
prueba) no identifica una **página**, y se saca antes de comparar. Lo que NO va en esa lista es
un parámetro que cambia el CONTENIDO (`?plan=pro`, `?v=2`): ese sí hace que sean dos páginas
distintas, y borrarlo las fundiría.

**Vive en:** `lib/landing-paginas.ts` (`PARAMS_DE_MEDICION`)

### Los chequeos iban en el orden en que se escribieron, no en el del embudo

Empezaba por «llegan las visitas» y metía el formulario **antes** del video. La persona lee de
arriba a abajo esperando el recorrido de su visitante: llegar → ver → clickear → dejar datos.

Y la **versión va primera de todo**, aunque no sea un paso del embudo: si el código está viejo,
todos los demás chequeos miden otra cosa y sus resultados no significan nada. Un diagnóstico
que no empieza por «¿estás mirando el código correcto?» manda a investigar síntomas de una
versión que ya no existe.

**Y en una PRUEBA los textos hablan de la prueba, no de las últimas 24 h.** Quien acaba de
apretar play no quiere que le contesten con una estadística del día — eso se lee como una
negación de lo que acaba de hacer.

**Vive en:** `lib/landing-token.ts` (el array `chequeos`, `enPrueba`)

### ⚠️⚠️ El opt-in se descartaba en SILENCIO: 200 OK, cero filas, cero logs

*2026-08-24*

**Síntoma:** un cliente (ws13, Código Inmobiliario) se agendó en su propia landing
**durante una prueba en vivo**, y el probador le contestó *«5. Deja sus datos — No aplica:
este negocio no recibe leads por un formulario en la página»*. Ni evento, ni lead, ni
propuesta, ni rastro.

**Causa raíz, verificada en producción:** `app/api/track/optin/route.ts` tenía la puerta del
funnel — si el workspace no declaró `landing` en `funnel_config.data.entradas`, el opt-in
**se acepta y se tira**. La política es correcta y no cambió. Lo que estaba mal es que esa
rama devolvía `ok({ ignorado })` y se iba: **sin insert, sin `console.warn`, sin contador**.
Verificado: el `funnel_config` del ws13 tiene solo `pipeline` y `suppressed` — la clave
`entradas` no existe, y `leads` y `propuestas` de ese workspace están vacías desde siempre.

**Y el «No aplica» afirmaba un hecho que no sabemos.** `declarado` dice *«nadie marcó la
casilla»*, no *«este negocio no capta por la página»*. Son dos cosas distintas y el texto
elegía la que no era. Sobre el evento más importante del embudo de ese cliente.

**Regla 1 — descartar en silencio es perder sin que nadie se entere.** Una política de
ingesta puede rechazar; lo que no puede es no dejar huella. «No llegó» y «lo tiramos
nosotros» son diagnósticos opuestos y se veían idénticos: desde la base, desde los logs y
repitiendo la prueba. Ahora el bloqueo escribe un `optin_bloqueado` en `vsl_events` (sin
nombre, mail ni teléfono: lo que se guarda es que PASÓ, no quién) y un `console.warn`.

**Regla 2 — un `na` no puede afirmar un hecho del negocio si solo conoce su config.** El
estado ahora se parte: si el analizador ve formulario o agenda —o si YA bloqueamos un
opt-in, que es la señal más fuerte porque es un hecho medido— no es «no aplica», es una
**puerta abierta sin conectar**, va en ámbar y lleva a `/funnel` con un link.

**Regla 3 — medir la venta no es quedarse con la persona.** Desde la v15 una reserva manda
dos cosas: el evento (que llega siempre) y el opt-in con quién reservó (que la puerta puede
tirar). Con `hayAgendo ? 'ok'` el renglón daba verde mientras cada persona que agendaba se
perdía. Un verde que cierra la pregunta sobre algo que se está perdiendo es peor que un rojo.

**Vive en:** `app/api/track/optin/route.ts` (la puerta y el rastro) ·
`lib/landing-token.ts` (`hayOptinBloqueado`, `puedeCaptar`, `paso5`) ·
`app/integraciones/ProbarTracking.tsx` (`legible`, el renglón rojo del feed)

### ⚠️ El chequeo de retención acusaba a una landing SIN video, porque `soloVsl` contaba clics

*2026-08-24*

**Síntoma:** en la misma prueba, el punto **3. Se mide el tiempo de retención** salió en
**ámbar** diciendo *«Solo llega el inicio, no el avance»* — sobre una página que no tiene un
solo video. Y el punto 2 le pedía reproducirlo.

**Causa raíz:** `const soloVsl = eventos.filter((e) => e.tipo !== 'pageview').length`. El
nombre decía la verdad el día que se escribió: entonces lo único que no era `pageview` era
un evento del VSL. Desde la **v6** el snippet manda clics, y desde la **v14** también
«se fue», «volvió» y «cerró». Con eso, **cualquiera que abra la página y haga un clic queda
contado como si hubiera reproducido un video** — `tuvoVideoAlgunaVez` se vuelve `true` y el
ternario cae directo a `'viejo'`.

Medido: los 28 eventos de esa prueba fueron 3 pageviews + 9 clics + 8 «se fue» + 5 «volvió»
+ 3 «cerró». **Cero de video, en toda la historia del workspace.** El contador daba 25.

**Regla — un contador que se llama «eventos de X» se filtra por los tipos de X, nunca por
«todo menos Y».** La lista de lo que no es Y crece sola con cada evento nuevo, y crece en
silencio: el que agrega el evento no tiene por qué saber que hay un contador definido por
descarte a tres archivos de distancia.

**Y los chequeos 2 y 3 no miraban las piezas EN ABSOLUTO.** `tieneBotones`,
`tieneFormPropio` y `tieneAgenda` se leían del analizador; el video era el único que no. Y
el helper para contestarlo —`tieneVideoMedible()` en `lib/landing-analisis.ts`— **existía
desde hacía semanas sin un solo consumidor**. Ahora hay `tieneVideo`, con tres fuentes y en
este orden: sin análisis → *no sé*, y no saber nunca apaga un chequeo · el analizador vio
una pieza de video → sí · **llegó un evento de video de verdad → sí, y esto manda sobre lo
anterior**. Lo último no es redundante: el analizador lee el HTML servido, que puede venir
del cache del CDN (medido en esa landing: `X-Vercel-Cache: HIT` con `Age` de casi 4 h). Con
esa tercera fuente, el día que el cliente suba su video los chequeos vuelven solos con el
primer play, sin que nadie reanalice nada.

**Vive en:** `lib/landing-token.ts` (`eventosDeVideo`, `tieneVideo`, chequeos `play` y
`profundidad`)

### ⚠️ La ventana de la prueba es la que el cliente MIRA, y era la que menos sabía

*2026-08-24*

`app/integraciones/escuchando/page.tsx` montaba `<ProbarTracking pruebaInicial={p} />` **sin
`landingFija`**. Consecuencia en cadena: el efecto de análisis corta en
`if (!landingFija) { setPiezas([]); return; }`, `traer()` arma la URL sin `&landing=` ni
`&piezas=`, y el server responde con `piezas = null` → *«no sé nada de esta página,
ofrecele todos los pasos»*.

Y esa ventana **es la pantalla que la persona mira durante la prueba**: la tab queda atrás.
O sea que la copia con MENOS contexto era la que hablaba. La tab de atrás, con todo el
contexto, mostraba lo correcto y nadie la estaba viendo.

**Regla — cuando una pantalla se reabre en otro lado, viaja el CONTEXTO, no solo el
identificador.** Es la misma familia que
[al ruteador no le llegaba el detalle](#un-botón-junto-al-código-pregunta-por-el-código-no-por-la-página):
reusar el componente es correcto, pero reusarlo con la mitad de las props es una segunda
pantalla que dice otra cosa. La landing ahora viaja en la URL (`?p=…&l=…`).

**⚠️ Y AL PASARLA, CASI SE BORRA LA ÚNICA EVIDENCIA DEL AGENDADO.** `deEstaLanding` filtra
los eventos por la landing elegida, y el recorrido de esa persona terminó en
`/gracias?name=Codigo+Inmobiliario&email=…` — otra ruta. Activar el filtro lo habría sacado
del feed, y esa fila de `landing_visits` era **lo único en toda la base** que probaba que
llegó hasta el final. Con marcador de prueba el filtro por landing ahora no se aplica: el
marcador ya aísla la prueba y es MÁS preciso (distingue tu visita de la de un desconocido
que esté en la misma página), mientras que **una prueba recorre el SITIO, no una URL**.

**Corolario del mismo día:** la instrucción de arriba del panel también era una lista fija
—«reproduce el video, haz clic en tus botones y completa tu formulario»— y le pedía a ese
cliente dos cosas que su página no tiene. No alcanza con apagar los pasos si el texto sigue
mandando a hacer lo imposible. Ahora sale de los mismos chequeos, así que no hay una segunda
lista que se quede vieja.

**⚠️⚠️ Y LO MISMO CON EL `?ws=`, que es de AISLAMIENTO y no de comodidad.** La ventana se
abría con `window.open('/integraciones/escuchando?p=…')` sin él, y el workspace de una
pestaña viaja **únicamente por la URL** — no hay cookie que lo cubra, a propósito: una cookie
es del navegador y le cambiaría el contexto a todas las pestañas abiertas (el porqué está en
`lib/ws-tab.ts`). O sea que el super admin mirando a un cliente con `?ws=13` abría una
ventana resuelta a SU propio workspace: **la prueba de un cliente mostrando los datos de
otro**, y sin nada en pantalla que lo dijera. Es exactamente el flujo con el que se miran las
pruebas de los clientes. Ahora se propaga con `conWs(..., wsDeBusqueda(location.search))`.

**Vive en:** `app/integraciones/escuchando/page.tsx` · `app/integraciones/ProbarTracking.tsx`
(`arrancar`, `QUE_HACER`) · `lib/landing-token.ts` (`deEstaLanding`) · `lib/ws-tab.ts`

### ⚠️ El snippet le borraba todas las «s» al texto de los botones, y se veía como un texto cortado

*2026-08-24*

**Síntoma:** en el feed del probador, *«Hizo clic en: boton: ¿Qué pa a de pué de agendar
una»*. Se lee como un texto truncado o mal tipeado por el cliente. No lo es.

**Causa:** el snippet vive dentro de un **template literal**, y ahí `\s` **no es la clase
«espacio»: es la letra `s`**. El fuente decía `.replace(/\s+/g, ' ')` y lo que se pegaba en
la página del cliente era `.replace(/s+/g, ' ')`. Comprobado carácter por carácter:
*«¿Qué pasa después de agendar una llamada?»* → *«¿Qué pa a de pué de agendar una llamada?»*,
que es exactamente lo que se veía en pantalla. Vivo desde la **v6**.

**Regla — dentro del template del snippet, toda clase de regex va con DOS barras.** Y el
corolario que cuesta más: **el fuente y lo que se sirve no son el mismo texto**, así que
leer el código no alcanza para revisar el snippet. Hay que **renderizarlo**.

Eso ahora lo cuida `tests/landing-snippet-emitido.test.ts`, que reconstruye el snippet
aplicando las reglas de escape del template y lo audita. Cubre tres cosas:
1. ningún regex perdió su barra (`\s`, `\d`, `\w`…);
2. **el snippet no se delata a sí mismo** — ver abajo;
3. la agenda embebida sigue teniendo camino propio, y la versión sube con su renglón de
   novedades.

**⚠️ El snippet se delata a sí mismo, y lo volví a introducir mientras arreglaba esto.** Va
pegado en la página del cliente, y el analizador busca marcas (`cal.com`, `pandavideo`,
`<video`) para decidir qué chequeos pedirle a esa landing. Al documentar el soporte de
agendas escribí el dominio en un comentario **del snippet**: con eso, toda landing con el
Pixel puesto habría pasado a «tener» una agenda. Es el mismo bug por el que existe
`sinRuido()`, repetido a los dos años. `sinRuido` cubre el HTML (borra los `<script>`) pero
**no cubre el bundle**: `DEL_BUNDLE` corre sobre el JavaScript propio de la página sin
filtrar nada. El test lo detecta ahora; el `pandavideo` del detector de Panda
(`lib/landing-token.ts`, la línea de `/pandavideo/i.test(...)`) sigue siendo un falso
positivo posible si un cliente copia el snippet dentro de su bundle — **queda pendiente**.

### ⚠️ El analizador se comía la pieza que importaba por un tope de 3 scripts

*2026-08-24*

`bundlesDe()` bajaba como máximo **3** scripts propios. La landing del ws13 sirve **ocho**
chunks, y el que monta su agenda es el **quinto**: con el corte en 3 no se bajaba nunca, así
que el analizador informaba «no tiene agenda» sobre la página cuyo único CTA es agendar —
y por eso el paso 5 caía en la rama «Deja sus datos» en vez de «Agenda una llamada».

Medido A/B contra la landing real:

| tope | piezas detectadas | paso 5 |
|---|---|---|
| 3 (antes) | `botones` | «Deja sus datos» → *No aplica* |
| 8 (ahora) | `botones, embed-agenda` | **«Agenda una llamada»** |

El costo que el tope creía cuidar no existe: los 8 chunks suman **621 KB**. Lo que de verdad
acota esto es el corte de 3 MB por archivo y los 8 s de timeout, que ya estaban.

**Regla — un tope que corta una lista ordenada por aparición decide por posición, no por
relevancia.** Y cuando lo que se busca puede estar en cualquiera de los elementos, cortar
por posición es tirar una moneda. Si hay que topear, hay que decir qué quedó afuera.

### Un botón junto al código pregunta por el código, no por la página

*2026-08-14*

«Verificar que esté funcionando» vivía en la barra del snippet y contestaba por el **workspace
entero**: ¿llegó algún evento alguna vez? Movido al lado del desplegable de páginas, la
pregunta cambia sola y se vuelve la útil: **¿la página que estoy por probar está midiendo, y
con qué versión?**

No es solo mudar un botón. Para poder contestarlo hizo falta un dato que no existía:
`landing_visits.sv` (mig 0135). El setting `landing.snippet_version` guarda **una sola versión
por workspace** —la del último evento, venga de donde venga— así que un cliente con dos
landings publicadas tenía una única respuesta para las dos, y era la del que hubiera mandado el
último pageview. El `sv` ya viajaba en cada evento; solo faltaba guardarlo por fila.

**Regla:** cuando muevas un control, preguntá qué contesta **desde su lugar nuevo**. Si la
respuesta correcta necesita un dato que no tenés, moverlo sin más deja un botón que responde la
pregunta vieja en el lugar de la nueva — que es peor que dejarlo donde estaba.

**⚠️ Y la comparación va normalizada en las dos puntas.** En la base conviven la URL con barra
final, con hash y con los parámetros de cada campaña. Un `eq` sobre el texto crudo diría «no
está instalada» sobre una página que mide hace meses.

La respuesta distingue **cuatro** casos, no dos: no llega nada · llegan visitas pero ninguna
dice su versión (código anterior al versionado) · llega con versión vieja, diciendo cuál y qué
se pierde · todo bien.

**Vive en:** `lib/landing-token.ts` (`verificarPagina`) ·
`supabase/migrations/0135_landing_visits_sv.sql` · `app/integraciones/ProbarTracking.tsx`

### ⚠️ Tres lecturas contestan «no pude leer» con la forma de un «no»

*2026-09-16 api-mako-areas*

**Síntoma, latente:** cualquier consumidor que lea los CAMPOS y no la frase le pide al cliente
que repegue el Pixel por un 5xx de la base. El probador se salva porque pinta el `texto`; un
modelo que lee `instalada: false` no.

**Causa:** en el camino de error, las tres devuelven exactamente la forma del caso real.

| Función | Si la lectura falla devuelve | Que se lee igual que |
|---|---|---|
| `verificarPagina` (`lib/landing-token.ts:460-463`) | `instalada: false`, `visitas: 0` | «el Pixel no está en esa página». Lo único distinto es la frase «No se pudo consultar…» |
| `landingUltimoEvento` (`:474-477` y `:485-488`) | `recibio: false`, `ultima: null` | «nunca llegó nada». Sin ninguna marca |
| `catalogoPanda` (`lib/panda.ts:273-328`) | lo leído hasta la página del listado que falló, sin cachear | el catálogo completo |

Y adentro de `catalogoPanda`, `redirigeA: null` quiere decir dos cosas: «no redirige» y «no
pude leer el detalle». El comentario de la función lo sabe —«deja el redirect en null, que es
"no sé" y no "no tiene"»— y el tipo que devuelve no tiene dónde decirlo. Encima, un detalle que
falló **sí** queda cacheado 5 minutos con el resto. **La distinción vivía en la cabeza de quien
la escribió, no en la salida.**

Y un costo más del mismo archivo: el detalle se pide de a un video y EN SERIE (a propósito,
contra el 429). Con el caché frío y cientos de videos, pasa de los 60 s de una función.

**Regla:** «no pude leer» es un CAMPO, no una frase — la de AGENTS.md («"No pude leer" es un
tercer estado») aplicada a tres lecturas que la precedían. Detectar el error por el prefijo del
texto, que es lo que tuvo que hacer el runner de la API (`lib/api-mako/areas/landing.run.ts:135`),
se rompe el día que alguien mejore la redacción.

**Lo que quedó SIN hacer:** que las tres expongan `leida: false` (y `catalogoPanda`, además,
si el mapa está completo), y recién ahí sacar del runner la detección por prefijo. No se hizo
porque son libs compartidas, fuera de los archivos que la corrida podía tocar.

**Vive en:** `lib/landing-token.ts` (`verificarPagina`, `landingUltimoEvento`) · `lib/panda.ts`
(`catalogoPanda`) · `lib/api-mako/areas/landing.run.ts` · *2026-09-16 api-mako-areas*

### Probar algo en otra pestaña es alternar a ciegas

Para verificar que un click se registra hay que hacerlo **en** la landing y mirar el resultado
**en** MaKo. Con dos pestañas eso es: apretás, cambiás de pestaña, y para cuando mirás ya no
sabés si lo que ves es de ese click o del anterior. El probador era correcto y **no se podía
usar**.

«Probar» ahora abre la landing **y** una ventana de MaKo de 440 px apoyada encima. Cuatro
decisiones que conviene no revertir:

- **Se abre DESPUÉS de la landing.** La última ventana que se abre queda arriba, y la que tiene
  que quedar arriba es esta.
- **Con nombre de ventana** (`mako_prueba`): dos pruebas seguidas reusan la misma en vez de
  sembrar la pantalla de ventanitas huérfanas. Es también lo que hace que «Traerla al frente»
  funcione con un `window.open` del mismo nombre.
- **Si el navegador la bloquea, el panel de la pestaña sigue funcionando.** Una prueba no puede
  depender de un permiso que no controlamos.
- **Reusa el MISMO componente** (`ProbarTracking` con `pruebaInicial`). Una segunda copia del
  panel es una copia que se queda vieja. Y la pestaña **deja de consultar** mientras la
  ventanita vive: dos paneles pidiendo lo mismo cada 3 s es el doble de requests para pintar la
  misma lista dos veces.

**Vive en:** `app/integraciones/escuchando/page.tsx` · `app/integraciones/ProbarTracking.tsx`
(`arrancar`, `enVentana`)

### ⚠️ «Probar» nacía deshabilitado para todo cliente nuevo: un `localStorage` de ESTE navegador pisaba la landing elegida

*2026-08-24*

**Síntoma:** los clientes (inmobiliaria) abrían el paso 4 del Pixel, veían *«Probamos
https://…»* con la landing correcta arriba, y el botón **Probar** apagado. Sin error, sin
aviso, sin nada que tocar para revivirlo. Del lado de acá andaba siempre.

**El diagnóstico obvio era el equivocado.** No era permiso, ni credencial, ni que el Pixel no
estuviera conectado, ni el gate del código viejo — el aviso de código viejo se pinta, y no se
pintaba nada. Era el `disabled={!urlValida}` del botón sobre un estado `url` que llegaba vacío.

**Causa real:** con `landingFija` la página ya está decidida en el paso 1, así que `url`
arranca en `landingFija` y el desplegable **ni se renderiza**. Pero el efecto de carga hacía,
incondicionalmente, `setUrl(localStorage.getItem(URL_KEY) ?? '')`. En una cuenta que nunca usó
el panel suelto —o sea, **todo cliente nuevo**— esa clave no existe: `url` volvía a `''`,
`urlValida` daba `false` y el botón quedaba muerto. Y muerto sin salida, porque lo único que
escribe `url` en este modo es el selector escondido.

**Por qué no se veía desde acá:** quien ya probó alguna vez tiene la clave puesta, y el botón
le anda siempre. La diferencia entre «mi navegador» y «un navegador nuevo» era todo el bug.

**Y el caso peor era el que NO deshabilita nada:** con una clave vieja de otra landing, el
botón anda y prueba **otra página**, en silencio, mientras el panel de arriba nombra la
correcta.

**Regla 1 — un botón deshabilitado necesita una salida en la misma pantalla.** Si la condición
que lo apaga se alimenta de un control que está escondido en ese modo, no es un botón
deshabilitado: es una pantalla sin salida. Es la misma familia que [los botones de editar y
borrar gateados en «está guardada»](#-los-botones-de-editar-y-borrar-se-gateaban-en-está-guardada-y-nadie-tenía-guardadas):
un gate que solo pasaba el que ya había hecho el camino largo.

**Regla 2 — `localStorage` restaura una PREFERENCIA, nunca pisa una DECISIÓN.** Cuando la
pantalla ya recibió el dato por props (acá `landingFija`, elegido en el paso 1), lo del
navegador no compite: no se lee. Restaurar «lo último que usaste» sobre algo que la persona
acaba de elegir arriba es, en el mejor caso, un botón muerto; en el peor, medir otra cosa.

**Regla 3 — la restauración va en su propio efecto y corre una vez.** Colgada del efecto de
carga (deps `[activo, traer]`) se relanzaba con cada identidad nueva de `traer` y le pisaba la
elección a quien acababa de elegir en el desplegable. Es el primo del
[`useEffect` que escribe una dependencia de su propia dependencia](#un-useeffect-que-escribe-una-dependencia-de-su-propia-dependencia-no-termina-nunca).

**Vive en:** `app/integraciones/ProbarTracking.tsx` (el efecto de restauración y el
`disabled={!urlValida}` del botón Probar) · `app/integraciones/IntegracionesBoard.tsx:1393`
(quien pasa `landingFija`)

### Heatmaps: por qué NO integramos ninguno (y qué sí)

*2026-08-15 · investigación de 26 agentes, precios verificados uno por uno contra el fabricante*

La decisión completa, con la tabla de precios y el plan, en
[heatmaps-decision.md](heatmaps-decision.md). Lo que hay que saber antes de volver a abrir el tema:

- **Microsoft Clarity es gratis de verdad** —sitios y proyectos ilimitados, sin tope de tráfico,
  confirmado dos veces en la documentación de Microsoft— y aun así **no sirve dentro del
  producto**, por cuatro límites que ninguna cantidad de plata arregla:
  su API permite **10 requests por proyecto por día**, devuelve solo promedios de los últimos
  1-3 días y **no puede bajar un heatmap ni una grabación**; **no captura nada dentro de un
  iframe de terceros**, o sea que el reproductor de Panda —el corazón de estas landings— es un
  agujero negro; las grabaciones **duran 30 días**; y el enganche con el lead existe
  (`clarity("identify", …)`) pero el filtro vive **solo en la interfaz de Microsoft**.
- **El precio que se paga no es plata: es el dato.** El texto de privacidad que Microsoft manda
  pegar en la landing del cliente dice que los datos se usan **para publicidad**, y Clarity es
  GDPR-compliant **como controlador**, no como procesador. No es nuestro proveedor bajo nuestras
  reglas: es un tercero que recibe los datos de los visitantes de nuestros clientes bajo las suyas.
- **Cualquier herramienta que cobre POR SITIO está muerta antes de empezar.** Plerdy («one
  package equates to one site») se come el 45% de un plan de US$47. Heatmap.com arranca en
  US$199 por sitio: cuatro planes enteros.
- **Dos competidores murieron durante la investigación**: Smartlook cerró ventas el 31/05/2026 y
  Howuku directamente ya no opera. Un comparador de blog los seguiría listando.
- **Lo que el Pixel ya mide se solapa más de lo que parece.** El «click map» es el dato que ya
  tenemos con la posición encima; el «conversion map» lo hacemos **mejor**, porque decimos
  *quién*. Lo realmente nuevo son tres cosas: profundidad de scroll, rage/dead clicks y grabación
  de sesión. Las dos primeras son 4-6 días dentro del Pixel; la tercera no la podemos hacer barato.

**⚠️ Y la trampa que decide el alcance:** el mapa de calor *bonito* —la mancha roja sobre la
página— necesita una **captura de la landing** para pintar encima, y los hosts tipo Framer,
Webflow y WordPress bloquean que se la meta en un marco. Ese es el cuello de botella real, no la
medición. Por eso lo que se entrega es **ranking por elemento + curva de scroll**: contesta la
misma pregunta de negocio, no necesita la foto, y se puede **filtrar por lead** — que es
exactamente lo que ninguna herramienta de la tabla puede hacer.

**Vive en:** [heatmaps-decision.md](heatmaps-decision.md) · lo que falta construir, en
`lib/landing-token.ts` (los 4 campos del evento de clic y los 2 detectores)

### ⚠️ Todo el estado de la landing vivía a nivel WORKSPACE, y con dos páginas eso miente

*2026-08-15*

Un cliente con dos landings publicadas —la de ventas y la de webinar— tenía **una sola**
versión del Pixel guardada (`landing.snippet_version`, la del último evento venga de donde
venga), **un solo** `CLARITY_PROJECT_ID` y **un** semáforo. Todo lo que la pantalla afirmaba
sobre «tu página» era verdad para una y falso para la otra, sin nada que lo dijera.

El caso que lo destapó: el aviso «tu Pixel está desactualizado» podía mandar a repegar el
código **en la página que ya estaba al día**.

**Regla:** cuando una entidad puede existir más de una vez por cliente, su estado va **en
ella**, no en el workspace. El costo de asumir «hay una sola» no es un bug: es un conjunto de
afirmaciones que son verdad la mitad de las veces, que es mucho más caro de detectar.

Lo que quedó:

- `lib/landing-config.ts` — la landing es la entidad y lleva su `clarityProjectId`. Un proyecto
  de Clarity es de **un** sitio: guardarlo por workspace hacía que la segunda landing escribiera
  en el proyecto de la primera, mezclando grabaciones de dos negocios en un panel.
- **Migración perezosa**, en dos lugares: el lector acepta la lista de strings vieja y la de
  objetos. Una migración que exija convertir la base primero deja a alguien sin sus páginas el
  día del despliegue.
- `lib/landing-analisis.ts` — lee el HTML **antes** de probar para saber qué piezas tiene esa
  página. Antes se adivinaba por los eventos que habían llegado, o sea *después* de la prueba.
- La pantalla pasa a cuatro pasos, con elegir la landing como el primero, y los demás no se
  dibujan hasta que hay una elegida.
- El aviso nombra la página, o las lista.

**Dos trampas que costaron una vuelta cada una:**

- **Un `Set` no sobrevive a un server action** — se serializa como `{}`. En desarrollo no se ve;
  en producción la lista de piezas llega vacía sin ningún error.
- **El cron no puede usar las server actions**: corren detrás del permiso de la tab, que solo
  existe dentro de una request de usuario. Necesita su propio lector del setting.

**PENDIENTE:** el paso 1 hoy gobierna la navegación, pero el **código** que se copia y los
**chequeos** siguen saliendo del workspace. Falta que el snippet lleve el `clarityProjectId` de
la landing elegida y que `landingDiagnostico` filtre por su URL.

*2026-09-16 api-mako-areas:* el snippet ya lleva el id de la landing (`snippetDeLandingAction`)
y `landingDiagnostico` ya filtra por su URL. **Queda un chequeo del lado del workspace: el de
Clarity.** `landingDiagnostico` llama a `clarityProjectId()` sin mirar el `clarityProjectId` de
la landing elegida (`lib/landing-token.ts:696`) y pinta el renglón con eso (`:1028-1032`): una
landing con Clarity propio en un workspace sin Clarity sale «No lo activaste», al lado de un
código que sí lo trae.

*2026-10-06:* resuelto por desaparición — Clarity salió del producto, y con él el chequeo y el
proyecto por página. El código es ahora uno solo para todas las páginas del negocio.

**Vive en:** `lib/landing-config.ts` · `lib/landing-analisis.ts` ·
`app/integraciones/SelectorLanding.tsx` · `app/api/cron/tracking-vigilante/route.ts`

### Lo que NO era un bug (verificado en la base, no deducido)

- **Los «Visitó la landing» repetidos son visitas reales.** `landing_visits` no tiene columna de
  tipo: cada fila **es** una visita. Los `visitor_id` son distintos salvo `6d860227`, que
  recargó cinco veces. Ojo con dos filas cuyo `landing_url` es
  `file:///C:/Users/leilu/…`: la clienta abre el HTML local y eso también mide.
- **Los timestamps no están corridos.** El panel pinta con la zona del navegador (UTC-3) y la
  clienta está en UTC-5, así que los cinco pageviews que se ven a las 12:19–12:29 son las filas
  de las 15:19–15:29 UTC. La lista está bien ordenada; lo que falta es que la hora use la zona
  del workspace, como el resto de la app (`useTzWorkspace`).

### Lo que sigue pendiente sobre videos

- **`curvaRetencion`, `avancePorPersona` e `histogramaAbandono` aceptan un `videoId` desde hace
  meses y nadie se lo pasa.** La capacidad de filtrar por video está implementada y sin usar; lo
  que hoy se muestra en la ficha es el máximo por video, no la curva. Y ojo con la condición de
  `lib/vsl-retencion.ts:115` y `:212`: `if (videoId && ev.video_id && ev.video_id !== videoId)`
  exige que `ev.video_id` sea truthy, así que **un evento sin `video_id` no se descarta nunca y
  entra en la curva de CUALQUIER video**. Es el mismo error que `durDe`, en otro archivo.
- **`TrackingTimelineCard` deduplica rachas de retención sin mirar `video_id`**
  (`app/crm/lead-view/TrackingTimelineCard.tsx:46-52`), así que mezcla rachas de videos
  distintos en una sola.
- El `video_id` no siempre es un id de Panda: cuando el player no se identifica, el snippet cae
  a `iframe0`/`iframe1` **por posición** — que cambia si se reordena la página.

**Vive en:** `lib/vsl-retencion.ts` · `app/crm/lead-view/TrackingTimelineCard.tsx` ·
`lib/landing-token.ts` (`quien`)

## Landing Analyst

### ⚠️ Un tercero elige qué páginas baja y analiza el Analyst, con solo mirar el HTML de la landing

**Síntoma:** ninguno visible. Eso es lo peor.

**Causa:** `landing_visits.landing_url` se escribe desde `/api/track/vsl`, que es **público**
(CORS `*`, sin sesión) y se autentica con el token `mko_…` que viaja a la vista en el snippet
de la landing del cliente. El único saneo es `texto(payload.landing_url, 500)`: texto
arbitrario, sin parsear como URL ni comparar contra ningún dominio del workspace.
`urlsDescubiertas()` lo lee crudo, lo ordena por cantidad de visitas y lo convierte en (a) la
cola del botón «Buscar mis páginas» y (b) los chips «sin analizar» que se ofrecen a un clic en
cada render de la tab. Resultado: alguien **sin credenciales** controla el destino de un fetch
server-side con la IP de egreso de la app, quema una llamada Opus con thinking por URL, y deja
el resultado persistido en el workspace ajeno. La baranda SSRF de `landing-fetch.ts` solo
bloquea IPs privadas: un host público del atacante pasa entero.

**Regla:** que el token sea público por diseño (`docs/lovable-tracking.md`) no significa que lo
que escribe sea confiable. Todo lo que entra por el beacon es entrada de un desconocido, y no
puede decidir sola qué baja el server ni qué se paga en IA.

**Fix natural:** parsear `landing_url` en el beacon y exigir que el host coincida con un
dominio ya declarado del workspace.

**Y su docstring promete un filtro que no hace** (*2026-09-16 api-mako-areas*). Dice «las URLs
que el beacon vio y que todavía nadie analizó», y devuelve todas: solo descarta los previews del
editor (`lib/landing-analyst.ts:227-244`). Los dos llamadores de adentro filtran por su cuenta
contra `yaEstan` (`:750` y `:795`), así que hoy no se nota; el inventario de la API le creyó al
comentario, y un llamador nuevo que haga lo mismo le ofrece a la persona volver a analizar —y
pagar— páginas ya analizadas. Un comentario que describe un filtro que vive en los llamadores es
un contrato que el próximo no va a cumplir.

**Vive en:** `app/api/track/vsl/route.ts:203` · `lib/landing-analyst.ts:227-238` (`urlsDescubiertas`),
`:745` y `:790` · `lib/landing-token.ts` (`landingSnippet`) · *2026-08-05 review-landing-tabs*

### El módulo tolera la falta de datos, así que traga cualquier error nuevo

**Síntoma:** el análisis de una landing **con tráfico real** decía «sin datos de
comportamiento». No hay error en el log: es una respuesta válida del producto.

**Causa:** `getComportamiento` hace `catch { return vacio; }` **a propósito** —una landing
recién publicada no tiene historial y igual se puede analizar el copy—. Cuando el bucle
paginado privado de este módulo (que no tenía techo) se unificó en `lib/supabase-paginado.ts`,
heredó un tope que **sí** lanza. `landing_visits` es una fila por visita: 100.000 es alcanzable
en una landing viva. El `throw` cayó en ese `catch` y el truncado silencioso que el paginado
existe para matar reapareció **una capa más arriba**.

**El diagnóstico obvio era el equivocado:** no había nada roto en el analista ni en el
tracking. Lo que cambió fue el contrato de errores de una función tres niveles abajo.

**Regla:** antes de meter un `throw` nuevo en una lectura, mirá **qué `catch` lo está
esperando**. En un módulo que degrada por diseño, cada excepción nueva se convierte en un «no
hay nada» que nadie va a poder distinguir de la verdad.

**Descartado a propósito — no volver a «arreglarlo»:** cambiar ese `catch` por propagar el
error. La tolerancia es intencional y está escrita en el JSDoc: el analista tiene que poder
correr sobre una landing sin historial. Con el tope del helper ya corregido, el falso vacío
deja de ser alcanzable en la práctica. Cambiar la semántica de error de este módulo es otra
pasada, con una decisión de producto de por medio: **¿qué ve el usuario si el tracking falla y
el copy sí se puede analizar?**

**Vive en:** `lib/landing-analyst.ts:128` (`leerTabla`) y el `catch` de `getComportamiento` ·
el tope vive en `lib/supabase-paginado.ts`, ver [hallazgos-infra.md](hallazgos-infra.md) §1
(«Un tope nuevo es un truncado nuevo»)

### ⚠️ Los dos números de conversión que lee el Analyst miden de más

*2026-09-16 api-mako-areas*

**Síntoma:** ninguno visible, y por eso importa. `plays` y `agendas` entran al prompt del
Landing Analyst como conversión medida, y la IA razona sobre ellos.

**Causa, en `getComportamiento`:**

- **`plays` cuenta autoplays.** Es `avancePorPersona(...).size`
  (`lib/landing-analyst.ts:187-188`): toda persona con al menos un evento de video. La consulta
  (`:181`) ni siquiera trae la columna `auto`, así que un player que arrancó solo pesa lo mismo
  que alguien que apretó play. Es exactamente la distinción que el snippet manda desde la v11 y
  que el probador ya respeta
  ([Un `play` no es una intención…](#un-play-no-es-una-intención-cuando-el-player-arranca-solo)):
  se aplicó en la pantalla y no en el número que lee la IA.
- **`agendas` no mira el orden.** Cuenta los leads de esos visitantes con `fecha_junta_1` no
  nula (`:197-212`), sin compararla con la visita: quien agendó por otro lado y DESPUÉS pasó por
  la página cuenta como conversión de la página.

**Regla:** un contador que se llama «reprodujo» o «agendó» afirma una intención y un orden. Si
la consulta no trae el campo que prueba cada una, el nombre miente — y un nombre que miente
adentro de un prompt sale convertido en conclusión. La API los expone como
`con_eventos_de_video` y `agendaron`, con la salvedad escrita en la nota
(`lib/api-mako/areas/landing.run.ts:437-446`); el Analyst los sigue recibiendo tal cual.

**Lo que quedó SIN hacer:** traer `auto` y no contar como play lo que arrancó solo, y comparar
fechas en `agendas`. Vive en `lib/landing-analyst.ts:178-213`; no se tocó porque es una lib
compartida, fuera de los archivos de la corrida.

**Vive en:** `lib/landing-analyst.ts` (`getComportamiento`) · `lib/vsl-retencion.ts`
(`avancePorPersona`) · *2026-09-16 api-mako-areas*

## El catálogo de features y sus landings

### ⚠️ El matiz honesto de cada feature vive en un campo que nadie renderiza

**Síntoma:** la página del CRM se lee como automatización 100% autónoma y desatendida.

**Causa:** las páginas de detalle de `/vsl` declaran los campos `nota` (estado honesto: «en
activación / en construcción») y `quote` por feature, pero **ningún componente los pinta**.
Verificado el 2026-08-07: 19 features llevan `nota` y el grep de `.nota` / `.quote` sobre los
`.tsx` de `/vsl` no devuelve un solo render. Caso concreto: los bullets visibles del CRM
prometen automatización total, y la única aclaración —«la automatización 100% desatendida se
enciende por cuenta, con vos mirando el primer tramo»— está en `nota`, o sea, invisible.

**Regla:** si una salvedad es parte de la promesa, va en un campo que la página renderice. Un
campo del tipo que no se pinta es una salvedad que no existe.

**Vive en:** `app/vsl/_detalle/features.ts` (campos `nota` y `quote`) · los `.tsx` de
`app/vsl/_detalle` · *2026-07-24 auditar-copy-crm*

### ⚠️ Un video publicado congela el nombre de la feature y el destino de su «ver más»

**Síntoma:** dos `verMas` mandan material ya publicado a la ruta equivocada.

**Causa:** al consolidar el catálogo salió una restricción que no es de código pero gobierna el
código: **lo que ya se dijo en voz alta en un video producido no se puede renombrar** (por eso
«Closing Analyst» queda fijo: los videos de crm y semáforo la nombran así), y los `verMas` de
esos videos apuntan a rutas cuyo significado va a cambiar. Concreto y sin hacer:
`features.ts:981` (semáforo, «MaKo por WhatsApp») y `features.ts:462` (crm, «Descubrí cómo MaKo
trabaja tu WhatsApp») caen hoy en `/vsl/whatsapp`, que pasa a ser la bandeja de ventas —
deberían ir a `/vsl/asistente`. Se arregla sin retocar un solo video.

**Vive en:** `app/vsl/features.ts` (líneas 462 y 981) + `app/vsl/content.ts` ·
*2026-07-26 ~consolidar-catalogo-features-landing*

### Card o bloque: si cambia la PROMESA es card; si solo la hace creíble, es bloque

El dilema «recortamos las features de `/vsl` o las mantenemos» es falso: catálogo, landing y
video están pegados 1:1:1 sin motivo. Una landing nueva cuesta **1-2 horas** porque la
infraestructura ya existe (`features.ts` + `feature-visuals.ts` + `Visual.tsx`), un mini-VSL
cuesta **6-10** — recortar el catálogo para ahorrar video es cortar habitaciones de la casa
porque el trailer sale caro.

**Regla permanente, para que la discusión no vuelva cada mes:** una capacidad merece card solo
si pasa los tres filtros (el dueño pagaría por eso solo · alguien lo googlearía sin conocer la
app · se cuenta con UN concepto en 90 segundos). Lo que responde una **objeción** va como
bloque dentro de otra landing. Lo que responde un **miedo** o un **requisito** (BYOK, roles de
equipo) sale de la grilla: eso se compra después, no antes. Se funde lo que es el mismo momento
de compra contado dos veces. Y la sensación de «disperso» se cura con jerarquía (secciones con
encabezado de resultado), **no amputando features que la app sí tiene**.

**Vive en:** `app/vsl/_detalle/features.ts` + `showcase.ts` + `Landing.tsx` ·
*2026-07-26 ~catalogo-de-features-de-la-landing*

### Decisiones de arquitectura de la landing (ya tomadas)

- **La landing de venta vive en una ruta propia, sin botón en ningún lado de la app:** VSL
  arriba, funcionalidades abajo, y después una ruta de detalle por cada funcionalidad.
  Referencia `vturb.com` —diseño y estilo de copy— pero sin copiarla: *«confia en tus
  instintos y en como ya esta el diseño de la app»* (2026-06-24 / 2026-06-29). Donde falte
  funcionalidad van placeholders.
- **Cada feature tiene su propia landing con contenido específico**, no un pop-up ni una
  plantilla repetida; el «ver detalles» lleva directo ahí. El porqué: *«cada pop-up se queda
  corto»* y las landings *«parecen una plantilla, todos tienen las mismas secciones, el mismo
  texto»* (2026-07-19).
- **La landing lista también lo que MaKo TODAVÍA no hace**, y eso se implementa antes de que
  salga. No se recorta el copy por prudencia: *«No pongas el filtro de no Humo, estamos
  haciendo MKT. Luego lo llevamos a la app si no está aún… Solo quiero tener el norte claro»*
  (2026-06-25).
- **Customer Success se saca** de la landing principal y de las landings de feature. Es una
  feature a futuro, y sacándola las cards quedan perfectas en la grilla, sin una suelta abajo
  (2026-07-23).
- **La oferta se vende por capas («oferta cebolla»):** MaKo Project Management, MaKo sin
  atarse al VSL Funnel, MaKo analizador de anuncios, MaKo analizador de llamadas. El catálogo
  de la landing tiene que poder recortarse por capa (2026-07-16).
- **El lead magnet es un «Diagnóstico de anuncios»** (solo el creativo), no del funnel entero:
  *«Eso es fácil de vender en las campañas… y es fácil luego llevarlos a la llamada para ahora
  si diagnosticar todo el funnel»* (2026-07-28).

## El copy: cómo se escribe

Estas son reglas del dueño, no sugerencias. Casi todas se escribieron porque hubo que
corregirlas más de una vez.

### ⚠️ Un cambio en la landing principal se aplica a TODAS las landings de feature, en el mismo commit

Lo tuvo que repetir: *«Estos cambios en la landing principal y en todas… Ya no te debería
repetir esto, siempre los cambios se aplican a ambos»* (2026-07-24). No hay que pedirlo dos
veces. Corolario: **si una sección ya existe en otra pantalla, se copia tal cual, no se rehace
«parecida»** — *«La sección de "Explorá el resto de MaKo" tiene que ser exactamente igual a la
landing principal» / «Que sea IGUAL, ¿no puedes simplemente calcar esa sección? copiarla»*
(2026-07-23).

**Vive en:** `app/vsl/Landing.tsx` · `app/vsl/_detalle/*`

### Cada sección responde ¿PARA QUÉ le sirve al cliente?, no describe la feature

*«No solamente explicar lo obvio y lo técnico… Siempre en cada sección debemos preguntarnos
¿PARA QUÉ le sirve esto al cliente?… y hazlo como regla hacernos esa pregunta»* (2026-07-23).
Y siempre cerrar con **«Descubrí cómo…»** (*«como regla, siempre empezar con "Descubrí
como…"»*). En la venta se dice **el QUÉ se entrega, nunca el CÓMO** (2026-07-28).

### Cada título tiene que entenderse solo, porque el lead desliza

*«los leads muchas veces deslizan… Que sea una regla, esto es storytelling»* (2026-07-23). De
ahí salen cuatro reglas concretas:

- Se le habla **de tú**, personal.
- El **subtítulo no resume: golpea**. *«El subtitulo tiene que ser IMPACTANTE, no debe abarcar
  TODO, solo debe dejar el efecto WOW… Estamos haciendo marketing, muchas veces menos es más»*.
- **Máximo 2 saltos de línea por título** (regla textual).
- Siempre enganchado al **mismo dolor/gatillo** del storytelling de la pieza.

### Un concepto por pieza: si aparece otra feature, se la linkea, no se la explica

*«No mezclemos, esa era una de nuestras reglas»* (2026-07-23). Pero no se la ignora: cuando una
pieza menciona otra feature se deja un **texto corto que redirige** a esa feature, porque todo
está conectado y el usuario suele entrar a **una sola landing** — por limitarse a no mezclar se
pierde la percepción del valor total de MaKo (2026-07-23).

### Cero jerga, cero argentinismos, cero primera persona

- **Nada personal ni en primera persona:** la voz es de IA, no aparece ninguna persona.
  *«No utilices cosas personales como "Para eso construí MaKo" o "Agendá una llamada conmigo"»*
  (2026-07-22).
- **Cero argentinismos en el copy** aunque MaKo hable con acento argentino cuando **asesora**:
  todo lo que se produce **para** el cliente (guiones, copy de anuncios, textos de la app) va en
  español plano. *«Elimina de todos esos diagnosticos el argentino, no digas "Plata"»* ·
  *«A que te referís con que los tableros "banquen"»*.
- **Cero jerga interna y cero tecnicismos:** si el nombre no se entiende solo, se cambia.
  *«Que no ponga "La fabrica de creativos"»* · *«"Vieron tus videos", nuevamente no se entiende.
  ¿Qué videos? ¿mis reels? ¿mis ads? Sería, vieron tus anuncios»* · *«no quiero tecnicismos como
  la matriz 3x3»* (2026-06-30).
- **Los números se escriben como números**, no como palabras (2026-07-24).
- **Nada de clichés apilados ni secciones «por las dudas»:** *«pusiste como 5 frases cliché
  juntas… No pongas cosas de más»* (2026-07-22). Si falta contexto (el dolor del avatar, la
  prioridad), **se pregunta** en vez de rellenar.
- **Cuando se diga que MaKo hace algo «solo», tiene que ser concreto y puntual**, nunca «hace
  TODO solo»: el impacto simple se entiende, *«lo de que MaKo hace todo solo es algo más
  complejo de explicar»* (2026-07-22).

### Los CTA van siempre al ancho de la sección

*«Los botones de CTA te había mencionado que siempre tienen que ser del ancho de la sección»*
(2026-07-23). Es una regla de layout, no una preferencia por pieza.

### No asumas que la estructura actual está bien: auditá y proponé antes de ejecutar

*«Creo que en lugar de asumir las secciones que están ahí, deberíamos hacer una auditoría
primero»* (2026-07-23). Y **el feedback se guarda para reusarlo** en las próximas piezas y en
todos los orígenes, no se pierde en el chat: *«Tienes que ir guardando todos estos feedback
para que nos sea más fácil crear los próximos»* (2026-07-22). Este documento es ese lugar.

## Video, gráficos y capturas

### ⚠️ Nunca uses capturas viejas de la app en material de marketing

*«las capturas que estabas poniendo son de una versión VIEJÍSIMA de la app, nada que ver a lo
que está ahora»* (2026-07-23). Antes de meter una captura o un video de la app, verificá contra
la versión actual **en el navegador** (Preview / Claude in Chrome — hay permiso permanente).

### ⚠️ Nunca crear un gráfico o una animación sin validarlo antes con preguntas

*«siempre que querramos meter un gráfico tu tienes que hacerme preguntas y hasta saber
exactamente lo que quiero ahí lo creas»* (2026-07-23). Los gráficos que salieron mal, salieron
mal por saltarse ese paso: *«Hay muchos gráficos que están mal, te invito a que hagas Claude in
Chrome para verificarlo»* (2026-07-19).

**Y el gráfico explica gráficamente:** *«Muchos gráficos tienen mucho texto, es justamente lo
que queremos evitar, que se explique GRÁFICAMENTE»* (2026-07-19). Si tiene mucho texto, no es un
gráfico.

### El logo de MaKo nunca al ras del borde inferior del video

Siempre un poco más arriba, para que la barra de progreso del player no lo tape. *«Pon el logo
de MaKo de abajo del todo, siempre un poco más arriba… Esto como regla»* (2026-07-24).

### El mini-VSL por funcionalidad se produce en este orden, y no en otro

1. Pulir el **copy de la landing**.
2. Bajarlo a **estructura de VSL corta**.
3. **Voz de ElevenLabs**.
4. Recién ahí el **video**: textos gigantes + capturas y videos reales de la app.

El porqué: *«no queremos un VSL eterno de cada funcionalidad, todo lo contrario, queremos algo
dinámico, algo rápido que presente el dolor y la solución»* (2026-07-22). Y el costo manda:
una landing sale en 1-2 horas, un mini-VSL en 6-10.

### Pendiente: bajar las animaciones del branding «crudas» y por separado

Hoy solo se puede descargar el video entero. Pedido del dueño el 2026-07-27, sin hacer.

### ⚠️⚠️ El tiempo en la PÁGINA se estaba convirtiendo en retención del VIDEO

*2026-08-25 — el mismo linaje que el hallazgo de arriba, un año-luz más caro.*

**Síntoma:** el ws13 —landing **sin video**, con el hueco y el cartel «Video próximamente»—
reportaba **30 personas que reprodujeron el video**. Y un lead de ws1 sin un solo `play`
mostraba **11,698379140239605 %** de retención del VSL en su ficha.

**Causa raíz:** desde la v14 el snippet manda por el mismo canal, y **a la misma columna
`segundos`**, dos cosas que no se parecen en nada: los hitos del video (`p5`…`p100`,
`s3`…`s1200`, play, pausa, retoma, fin, exit) y el tiempo en la **página** (`salio`,
`volvio`, `cierre`). `avanceDe()` divide `segundos` por la duración del video. Los dos
consumidores filtraban **`!== 'play'`** y nada más, así que un `salio` con 166 s entraba y
salía convertido en 11,7 % de un video de 1419 s. Con la pestaña abierta más de 23,6 min,
clampaba en **100 %**.

**Medido antes del arreglo, en producción (19.641 filas):** 3.707 filas se colaban y
**3.416 producían un porcentaje**. Personas contadas como espectadores: ws13 **30 → 0**,
ws11 16 → 2, ws1 3122 → 2823.

**Lo que lo hace peor que un número feo en una pantalla:** ese conteo alimenta el prompt del
Landing Analyst (`lib/landing-analyst.ts:187`, `plays = porPersona.size`), o sea que **la IA
venía razonando sobre reproducciones fantasma**; y `max_pct` rutea cohortes de nutrición
(`lib/nutricion.ts:340/358`, umbral 50) y decide `vsl_estado='vio'`. Hoy ningún lead cruza
el umbral por esta vía, pero el mecanismo estaba armado.

**El diagnóstico obvio era el equivocado.** Este bug ya se había «arreglado» el 24/08 en
`landing-token.ts` con la lista blanca `ES_EVENTO_DE_VIDEO`, y **la regla quedó escrita en un
comentario de 12 líneas** que decía exactamente qué hacer. Pero se aplicó en el contador de
los chequeos y **no en el que produce el número**, tres archivos más allá. Escribir la regla
no la aplica.

**Regla — el filtro va en el CHOKE POINT, no en cada consumidor.** Ahora
`ES_EVENTO_DE_VIDEO` se exporta desde `lib/vsl-retencion.ts` y el corte está adentro de
`avanceDe()`: cubre `getVslEngagement`, `getVslEngagementMap`, `curvaRetencion`,
`histogramaAbandono` **y al próximo llamador que alguien escriba**. Filtrar en los tres
consumidores deja la regla escrita tres veces y rompible la cuarta — que es literalmente
cómo se rompió.

**Y el segundo corte, en `avancePorPersona`, es por otra razón.** No alcanza con que el
avance dé `null`: la persona entra al mapa **igual**, con valor null, y `porPersona.size` es
lo que se cuenta como «espectadores». Sin ese `continue` aparte, una landing sin video sigue
reportando gente que vio un video que no existe.

**Trampa de medición, aparte:** `.limit(60000)` sobre `vsl_events` devolvió **1000 filas sin
un solo error**. PostgREST corta en su `max-rows` y no avisa. Cualquier conteo sobre esta
tabla se pagina con `.range()` o miente por defecto — y miente *hacia abajo*, que es la
dirección en la que nadie sospecha.

**Vive en:** `lib/vsl-retencion.ts` (`ES_EVENTO_DE_VIDEO`, `esEventoDeVideo`, los dos cortes)
· `lib/leads.ts:1483` y `:1537` · `lib/landing-analyst.ts:187` · `tests/vsl-retencion.test.ts`

**Ojo al desplegar:** el `!== 'play'` de `leads.ts` **no** queda redundante — `play` está
dentro de la lista blanca, y su porcentaje 0 es el centinela de «arrancó», no una medición.

### ⚠️ MaKo no tenía un «antes» de la landing, así que no podía saber que cambió

*2026-08-25 — pedido del dueño: «es MUY importante que el Pixel escuche SIEMPRE los cambios
en la landing… una landing puede NO tener VSL en un principio y luego que los dueños le
agreguen un VSL, MaKo debería en todo momento saber eso».*

**Lo que ya funcionaba, y era la mitad riesgosa del pedido.** El snippet **ya engancha un
`<video>` que se monta después de cargar**: hay un `MutationObserver`
(`lib/landing-token.ts:1240`) con guarda de idempotencia por expando (`if (el.__mko)
continue`). Verificado empíricamente con la página real servida en local y el snippet
emitido: sin video al cargar → `["pageview"]`; se inyecta un `<video>` → queda enganchado;
play → llega; y tras 5 mutaciones más del DOM y otro play, **plays contados = 1** (el
segundo es `retoma`, correcto). Panda ni siquiera depende del DOM: su listener de `message`
es global. Clics, formularios y agendas van **delegados en captura** sobre `document`.

Eso importa porque **el snippet queda congelado en la página del cliente el día que lo
pegó**: tocarlo obliga a repegarlo. No hizo falta.

**Lo que faltaba era la memoria.** `analizarLandingAction` tenía **un solo llamador** (un
efecto de React) y **el resultado no se guardaba en ningún lado**. Sin un «antes», la frase
«desde tu última prueba agregaste un video» era literalmente incalculable, y nadie se
enteraba de nada salvo que abriera la pantalla de la prueba.

**LA REGLA QUE GOBIERNA TODO ESTO — una lectura fallida es «no sé», jamás «lo sacaron».** El
analizador se queda mudo por media docena de motivos ajenos al cliente: el CDN sirve
cacheado (medido en esa landing: `X-Vercel-Cache: HIT` con `Age` de casi 4 h), un chunk del
bundle pasa el timeout de 8 s, el host contesta 403 a un user-agent que no conoce. De ahí la
**asimetría**, que es el corazón del módulo:

| | qué hace falta | por qué |
|---|---|---|
| **aparece** una pieza | **una** lectura buena | un `<video>` no se alucina; si se equivocara, se corrige solo |
| **desaparece** una pieza | **dos** lecturas buenas seguidas | «te sacaron el video» por un chunk lento es el aviso que enseña a ignorar todos los demás |
| la lectura **falla** | no se escribe **nada** | el snapshot anterior queda intacto y no se anuncia nada |

Mientras una pieza está en el purgatorio (`dudosas`) **sigue contando como presente**, así
que los chequeos no se apagan por un parpadeo.

**Verificado contra la página real y la base real** (los cuatro casos): aparece → anunciado
en una lectura · desaparece 1.ª → no se anuncia y va a `dudosas` · desaparece 2.ª → anunciado
y sale de `piezas` · falla → `cambios` vacío y el snapshot **byte a byte idéntico**.

**Por qué NO va adentro de `landing.config`,** que era el lugar obvio: esa clave la escribe
la persona desde el modal con read-modify-write del JSON **entero**. El cron escribe sin
sesión y en otro momento. Compartiendo clave, un cron que corre mientras alguien borra una
landing **le devuelve la landing borrada** o le pisa el `clarityProjectId` recién cargado.
Dos escritores con dos ritmos son dos claves. Va en `landing.snapshot`, keyeada por la URL
normalizada **con la misma `normalizarUrl` que `landing.config`** — un mapa keyeado por un
dato derivado solo sirve si las dos puntas derivan igual, o el snapshot queda huérfano y se
ve como «esta landing nunca se analizó» sobre una que se analiza a diario.

**Qué se avisa y qué no.** El aviso `landing-cambio` habla **solo de video, formulario y
agenda**. `botones` y `link-whatsapp` se prenden con cualquier `wa.me` en un pie de página y
no cambian nada de lo que se mide. `pixel` tampoco: el detector lo busca **solo en el HTML
crudo**, así que una landing que lo inyecta desde un bundle «pierde el pixel» en cada
lectura — y la pregunta de verdad, *¿siguen llegando mis datos?*, ya la contesta
`tracking-apagado`, que la **mide** en vez de inferirla. **El panel sí los muestra:** el
panel es *pull* (la persona vino a mirar), el aviso es *push* (MaKo interrumpe).

**El chequeo de cambios corre ANTES de las ramas del cron, y a propósito.** «¿Cambió la
página?» es independiente de si el tracking está vivo, viejo o apagado. Metido dentro del
`if (horas < HORAS_APAGADO)` —que es donde entraba más cómodo— justo los workspaces con algo
roto se quedaban sin enterarse.

**Vive en:** `lib/landing-snapshot.ts` (puro, testeado: la asimetría y el saneo) ·
`lib/landing-vigilancia.ts` (`mirarLanding`, el único punto de entrada, con la puerta del
`!ok`) · `app/integraciones/landing-config-actions.ts` · `app/api/cron/tracking-vigilante/route.ts`
· `app/integraciones/ProbarTracking.tsx` (el renglón) · `tests/landing-snapshot.test.ts`

**Lo que quedó SIN hacer, con el archivo donde vive:**

- **SSRF en `analizarLanding`.** `lib/landing-analisis.ts:303` usa `fetch` pelado con
  `redirect: 'follow'`, sin pasar por `validarDestino()` (`lib/landing-fetch.ts:133`), que ya
  existe y ya clava el DNS contra rebinding. **No se arregló acá a propósito:** el camino ya
  probado (`bajarHtml`) filtra por content-type HTML, y los chunks del bundle son
  `application/javascript` — enchufarlo tal cual **apaga el análisis de SPAs**, que es
  justamente lo que hace analizable la landing del ws13. Hace falta un `fetchSeguro` que
  acepte los dos content-types y pase a `redirect: 'manual'`. Severidad real acotada: lo
  dispara un usuario autenticado con rol de `integraciones` y lo que devuelve es una lista de
  nombres de piezas.
- **El id posicional de video (`'v:pos' + i`, `lib/landing-token.ts:1172`).** Un agente lo
  reportó como colisión segura; **no lo es**: `idDeVideo` prefiere `el.id` y después el `src`,
  así que la posición es el último recurso y hace falta que **dos** videos no tengan ninguno
  de los dos. Angosto, pero si pasa el síntoma es que el VSL nuevo hereda el `play:true` del
  viejo y su primera reproducción sale como `retoma`. Sin verificar.
- **El conteo por lead sigue en 5,6 %** (76 de 1358 con `visitor_id`). El cuello está en la
  **identificación**, no en el análisis. `scripts/diag-tracking.mjs` ya existe.
- **`app/api/track/optin/route.ts:124` inserta `visitor_id: 'desconocido'`** como string
  literal, así que todos los opt-ins bloqueados de un workspace colapsan en **una** persona en
  cualquier conteo por visitante.
- **Un video embebido de Google Drive es inmedible**, con observer o sin él: Drive no publica
  ningún postMessage al padre. Los tres testimonios de esa landing son iframes de Drive. Si el
  VSL se publica así, MaKo va a decir «no llega ningún play» sobre un video que la gente está
  mirando. `lib/landing-analisis.ts:158-165` **no tiene marca para `drive.google.com`**, así
  que hoy ni siquiera puede decir «tiene un video que no puedo medir».

### ⚠️⚠️ El video alojado AFUERA era invisible, y el panel le decía al cliente que no tenía video

*2026-09-11 — dos reportes del dueño el mismo día: «no funciona la medición de reproducción
a esta landing que tiene su video alojado en otro lugar» y, sobre otro cliente, «tiene
muchos vídeos de YT y no está midiendo la RETENCIÓN de cada video».*

**Síntoma 1 (ws13).** Su landing tiene el VSL en **Wistia** y el panel de la prueba decía
«Tu página no tiene video, así que este paso no aplica», con el video a la vista. No llegaba
un solo play: 37 eventos en la historia de esa página y **ningún `video_id`**.

**Síntoma 2 (ws14).** 16 testimonios en **YouTube**; 163 eventos en su historia y **ningún
`video_id`**. Y la pantalla para decir de qué es cada video «no apareció en ningún momento».

**Las dos son la misma causa, en dos capas:** el snippet solo sabía medir Panda y `<video>`
propio, y el analizador solo sabía RECONOCER esos dos más YouTube y Vimeo — a los que
además declaraba no medibles. Todo lo que no estuviera en esa lista se traducía en pantalla
como «no tiene video», que es la confusión «no sé» / «no tiene» otra vez.

#### Qué se midió, host por host, en un navegador de verdad

No está leído en documentación: cada frente se midió con CDP sobre páginas reales y locales,
y **cada medición la refutó otro agente con medición propia** (4 de 6 volvieron con
correcciones, todas aplicadas).

| Host | ¿Medible? | Cómo, exactamente |
|---|---|---|
| **Wistia Aurora** (`<wistia-player>`) | sí | Es un custom element con su `<video>` en un shadow root **abierto**: `document.querySelectorAll('video')` dio **0 en todo el ciclo** (sonda cada 50 ms + MutationObserver) y no manda postMessage, así que el enganche nativo y el de Panda son ciegos. Despacha `play`/`pause`/`time-update`/`end`/`ended` **sobre el host**, con `bubbles:false` y `composed:false` — y un listener en **fase de captura** en `document` los recibe igual. Cero recorridos de DOM. |
| **Wistia clásico** (iframe y embed inline) | sí | El iframe de `fast.wistia.net` manda strings JSON `{"method":"_trigger","args":[…]}` **sin que nadie se lo pida y sin cargar su script**: play (con `source`), pause, end, timechange y `transmit-stats` (trae `media_duration`). El embed inline se toma por su cola pública `_wq`. |
| **YouTube** | sí, con un parámetro | Sin `enablejsapi=1` no le dice **nada** a la página: 0 mensajes en la carga, en 12 pedidos de escucha, en un clic real que sí reprodujo, en la pausa y en la retoma. Con el parámetro contesta estado, segundos, duración y título cada ~266 ms. El snippet se lo agrega solo a los iframes que no lo traían, y apenas aparecen. |
| **Vimeo** | sí | Contesta el protocolo de su librería oficial **sin parámetros en el src y sin cargar la librería**: `ready` llega como TEXTO JSON, y desde ahí `addEventListener` para play/pause/ended/timeupdate, con la duración en cada evento. |
| **Google Drive** | **no**, y ahora probado | Con un video **reproduciendo**, la página recibe **cero** mensajes. Su reproductor real es un iframe **anidado** (`youtube.googleapis.com/embed` con `post_message_origin` de Drive): recibió 4 mensajes nuestros y contestó 0, mientras le mandaba 110 a Drive. Con **control positivo** en la misma página: un YouTube con la API prendida contestó 31 y obedeció un `pauseVideo`. |
| **Players en web component** | parcial | Los eventos nativos de media son `composed:false`: un `<video>` dentro de un shadow root no avisa nada a `document`, y el MutationObserver del documento no ve nodos agregados adentro de un shadow. Lo que SÍ sale es lo que el player **re-despacha sobre su host**. |

**El media del cliente tiene `endVideoBehavior: 'loop'`, así que de ese VSL NUNCA va a llegar
un `fin`**: al llegar al final hace `seeking` a 0 y sigue en `playing`, sin `end`, sin `ended`
y sin `pause`. El `p100` sí llega. Prometer el fin de ese video sería prometer algo imposible.

#### El cliente ya lo había intentado, y su intento era código muerto

Su `/mako-tracking.js` no es el snippet puro: trae un bloque agregado a mano —«Conecta el VSL
alojado en Wistia con el mismo embudo de retención de MaKo»— que se cuelga de `window._wq`.
Con Aurora eso **nunca dispara**: `player.js` vacía la cola y no llama al `onReady`. Medido
en su página con un espía y en una página local limpia. **Cuando reemplace el archivo hay que
sacarle ese bloque.**

#### La lista cerrada estaba copiada en OCHO lugares

«¿Esta página tiene video?» se contestaba en ocho: el union de `PiezaLanding`, los detectores
de `analizarHtml`, `DEL_BUNDLE`, `videosDeHtml`, `tieneVideoMedible` + `videosNoMedibles` (que
**no tenían un solo llamador** — su firma pedía un `AnalisisLanding` con un `Set` y río abajo
las piezas viajan como `string[]`, así que en vez de usarlos se copió la lógica a mano),
`PIEZAS_DE_VIDEO` en `landingDiagnostico`, `NOMBRES` en el snapshot, `PIEZAS_QUE_IMPORTAN` en
el cron, y el texto «súbelo a Panda». **Olvidarse de uno falla en silencio y distinto cada
vez**, y la peor es la del snapshot: `nombresDe` descarta sin decir nada la pieza sin nombre,
así que una pieza registrada en el filtro del cron y no ahí no produce aviso — **ni el falso
ni el verdadero**. Ahora todo deriva de `HOSTS_VIDEO`, con un test que recorre el catálogo y
falla si a una pieza le falta su registro.

#### Cinco trampas que el arreglo tuvo que esquivar, las cinco medidas

1. **Enseñarle a MaKo a ver un host nuevo le MIENTE al cliente.** El snapshot del ws13 decía
   `["botones","embed-agenda"]`; el día que el analizador aprendiera Wistia, su VSL —que
   estaba desde el principio— aparecía como pieza NUEVA y el cron mandaba «Le agregaste un
   video a tu página. Ya lo estoy midiendo»: falso dos veces, porque además no se mide hasta
   que reemplace su copia del código. Y con dos URLs declaradas para la misma página, **dos
   WhatsApps**. Lo cierra `SnapshotLanding.det`: la foto guarda con qué versión de detectores
   se tomó, y lo que un detector nuevo trae se absorbe **en silencio**. Verificado sobre
   producción: los dos clientes dan `nuevas: (ninguna)` y el `det` pasa de 1 a 2.
2. **El bloqueo «Primero actualiza el Pixel» era de WORKSPACE.** Subir a v16 dejaba a ws1,
   ws11, ws13 y ws14 sin poder probar **ninguna** página — incluida una de Panda, a la que la
   v16 no le cambia nada. Ahora la versión se resuelve **por página** (`verificarPagina`, que
   lee el `sv` de las visitas de esa URL, y el cron ya la usaba desde el 25/08) tomando el
   **máximo** con el setting del workspace, y solo frena si esa página tiene un host que la
   v16 mide. Verificado: ws1 y ws11 dan `codigoViejo: false`, con el renglón «para esta página
   miden igual, así que no hay apuro».
3. **El snippet se delataba a sí mismo como «video de Panda».** `tituloVsl` tenía
   `/pandavideo/i`, así que todo cliente que copie el código a un archivo propio —como este—
   aparecía con un video de Panda que no tiene. Medido con el analizador real: el snippet
   servido como archivo daba esa pieza sobre un HTML vacío. **Y el test que existía para
   cazarlo copiaba `DEL_BUNDLE` a mano y omitía justo `video-panda`**: era estructuralmente
   incapaz. Ahora importa la lista real, así que un detector nuevo entra solo.
4. **Los ids del analizador iban pelados** (`S7oZ1L_612c`) y el snippet v16 emite con prefijo
   (`yt:S7oZ1L_612c`). Si los dos lados no derivan igual, el mismo video sale **dos veces** en
   la pantalla que los nombra —una con eventos y sin URL, otra con URL y sin actividad— y
   nombrar una no nombra la otra. Van en el mismo deploy, con test de paridad.
5. **La duración única de Panda se le prestaba a cualquier host.** Un `<video>` de 11 segundos
   medido contra los 1.419 de un VSL de Panda da cualquier cosa. `resolverDuracion` ya no se
   la presta a un id con prefijo de host — y el respaldo no se puede borrar: los 8.071 hitos
   `sNN` de Panda llegan sin porcentaje.

#### Y dos cosas que cambiaron premisas que veníamos usando

- **`landingvsl.vercel.app` y `v0-joandowd.vercel.app` son la MISMA página**, byte a byte
  (mismo sha, mismos 8 chunks, mismo `/mako-tracking.js`). No hay que diseñar como si el ws13
  tuviera «una landing de Drive y otra de Wistia», y todo aviso por página le sale duplicado.
- **En la ficha de cada lead, los eventos de PÁGINA se mostraban como «Siguió mirando el
  VSL».** `getTrackingEvents` mandaba a `retencion` todo lo que no era play ni exit, así que
  `salio`, `volvio`, `cierre`, `click` y `agendo` se disfrazaban de retención. Medido en 7
  días: ws13 tiene 115 salio, 68 volvio, 50 cierre, 20 click y 6 agendo, y **cero de video**.
  Es el mismo choke point de `avanceDe`: la regla se aplicó allá y quedó sin aplicar acá.

#### La puerta de «¿qué es cada video?» miraba la fuente equivocada

`NombrarVideos` **ya sabía** mostrar los videos que el analizador ve en la página, sin esperar
a que nadie los reproduzca (desde el 25/08). Lo que no: las dos puertas para llegar a ella
—la que se abre sola al apretar «Probar» y el lápiz para corregir— contaban solo
`videosDetectados`, que sale de los **eventos**. Sin plays, la lista quedaba vacía y la
pantalla no se abría nunca, aunque el analizador viera 16 videos. Ahora las dos miran las dos
fuentes.

**Vive en:** `lib/landing-analisis.ts` (`HOSTS_VIDEO`, `DETECTORES_VERSION`, `estadoVideo`,
`hostDeVideoId`, ids con prefijo) · `lib/landing-token.ts` (el snippet v16: los bloques de
Wistia, YouTube, Vimeo, los iframes no medibles y los web components; los tres estados de los
chequeos; la versión por página) · `lib/landing-snapshot.ts` (`det` y el re-baseline
silencioso) · `app/api/cron/tracking-vigilante/route.ts` · `app/integraciones/ProbarTracking.tsx`
(la puerta) · `lib/leads.ts` (`resolverDuracion`, `getTrackingEvents`) ·
`tests/landing-analisis.test.ts`, `tests/landing-snapshot.test.ts`,
`tests/landing-snippet-emitido.test.ts`, `tests/landing-optin.test.ts`

#### Lo que quedó SIN hacer, con el archivo donde vive

- ⚠️ **El cliente del ws13 tiene el código en un archivo propio (`/mako-tracking.js`), y el
  tutorial no contempla ese caso.** Lo que se copia empieza con `<script>` y termina con
  `</script>`; pegarlo tal cual adentro del `.js` lo rompe. `DONDE_PEGAR`
  (`app/integraciones/IntegracionesBoard.tsx`) nombra Lovable, Framer, Webflow, WordPress y
  HTML plano: falta el caso «tu código vive en un archivo» con un botón de copiar **sin** las
  etiquetas. Hasta que exista, a este cliente hay que decírselo a mano.
- **SSRF en `analizarLanding`** (`lib/landing-analisis.ts:303`): usa `fetch` pelado con
  `redirect: 'follow'`, sin pasar por `validarDestino()` de `lib/landing-fetch.ts`. No se
  arregló acá **a propósito**: el camino probado (`bajarHtml`) filtra por content-type HTML y
  los chunks son `application/javascript`, así que enchufarlo tal cual **apaga el análisis de
  SPAs** — que es justo lo que hace analizable esta landing. Hace falta un `fetchSeguro` que
  acepte los dos tipos y pase a `redirect: 'manual'`.
  - *2026-09-16 api-mako-areas:* **la «severidad acotada» del 25/08 ya no vale.** Descansaba
    en que lo dispara un usuario con la tab de integraciones, y ahora la API de MaKo declara
    landings (`guardar_landing`) y pide el análisis (`detectar_piezas_landing`). El runner
    valida el primer destino con `validarDestino` (DNS incluido) y al guardar rechaza IPs
    literales y hosts internos, pero `fetch` sigue cada redirect sin mirarlo
    (`lib/landing-analisis.ts:452-470`; el `redirect: 'follow'` hoy está en `:459`): una
    landing pública declarada que redirige a `169.254.169.254` pasa entera. **«Solo lo
    declarado» no es una baranda: corre la puerta**, porque la declaración también entra por
    la API. Y el normalizador con el que se guarda una landing
    (`lib/landing-paginas.ts:118-140`) solo exige un punto en el host: acepta IPs literales y
    cualquier puerto. El arreglo sigue siendo el `fetchSeguro` de arriba, con `validarDestino`
    en **cada** salto; es de la lib, y por eso la corrida de la API no lo tocó.
- **El analizador ahora viaja al navegador.** `lib/landing-snapshot.ts` importa el catálogo, y
  `ProbarTracking.tsx` es `'use client'`: con eso los 29 KB de `landing-analisis.ts` quedan
  alcanzables desde el bundle. No hay secretos ahí (no importa nada, no lee env) y los
  comentarios se van en la minificación, pero **no está medido sobre el bundle**. Si pesa, la
  salida es que el server mande los NOMBRES ya resueltos en `cambios` y el cliente solo pinte.
- **La lista positiva de iframes no medibles tiene falsos positivos medidos**: un ZIP salió
  como `toque_video` y un PDF entró en la lista de videos ajenos. Un `/preview` de Drive no
  dice si es un video.
- **`app/api/track/optin/route.ts:124` inserta `visitor_id: 'desconocido'`** como string
  literal: todos los opt-ins bloqueados de un workspace colapsan en UNA persona.
- **18 filas falsas en `vsl_events` de producción** (ws1, ws11, ws13 y ws14), de las sondas de
  la primera corrida: al cerrar una pestaña por CDP se suelta la intercepción y los beacons
  `keepalive` del `pagehide` salen directo. Backup en el scratchpad; **el borrado espera el OK
  del dueño**. Lo que lo cierra para el futuro está en la memoria `verificar-en-navegador`.

---

## Reglas de la casa que también gobiernan esta área

No son de la landing, pero se rompieron acá:

- **Nada es solo para el dueño.** Todo lo que se construye en super admin se construye en la
  misma pasada para los clientes: *«todo esto tiene que modificarse también para los clientes,
  que les aparezca lo mismo, hoy en los clientes, sigue igual que antes»* (2026-07-12). La
  vista de super admin y la del cliente son **la misma pantalla**.
- **Probá vos, no le devuelvas la prueba al usuario.** *«No funciona… Por favor, prueba tú»*
  (2026-07-20). Nada se declara hecho sin verlo en la app: *«Nada funciona… Tienes que realmente
  validar y hacerlo bien»* (2026-08-02).
- **Resolver en una pasada.** Es la queja que más se repite: *«Realmente no entiendo en que te
  estas gastando tantos tokens y aún no solucionas las cosas que te pedí»* (2026-08-07). Si algo
  ya se corrigió dos veces y sigue mal, se lanza multiagente y se cierra de una, con verificación
  en vivo en la preview de Chrome — el dueño prefiere que gastes recursos antes que entregar algo
  a medias: *«si tienes que correr 10000mil multi agentes para hacer esto bien… pero hazlo bien»*.
- **Sin límites arbitrarios.** Ni horas, ni ventanas de días, ni cantidad de resultados: el tope
  lo pone la API, no nosotros (2026-08-07).
- **La documentación se escribe para que la lea ÉL**, no solo otro agente: depurada, con
  títulos, ordenada y visible en super admin. *«si yo lo puedo entender fácil eso me habilita a
  darle mejores prompts al otro claude»* (2026-08-07). Por eso este documento está ordenado por
  subsistema y no por tipo de hallazgo.

---

## El Pixel pegado YA declara la entrada, y se ASIGNA a un producto (2026-10-04)

Dos decisiones de Martín el mismo día, y la segunda es la que faltaba de verdad.

**Vive en:** `app/api/track/optin/route.ts`, `lib/landing-funnel.ts`,
`lib/landing-config.ts`, `app/integraciones/SelectorLanding.tsx`,
`app/integraciones/landing-config-actions.ts`

### 1. La casilla del funnel dejó de ser un peaje

*«cargar el pixel en una landing ya debería contar».* La puerta de `/api/track/optin`
exigía que el workspace hubiera marcado «landing» en `funnels.data.entradas` y, si no,
descartaba el opt-in. El razonamiento que la sostenía —el Pixel se le entrega a todos por
defecto, así que cualquiera que lo pegue podría llenar un CRM que nadie pidió— **ya se
había caído el 24/08/2026 para Cal.com/Calendly**, con la frase que ahora vale también
para el Pixel: *conectarla ES el acto de declararla*. Era la tercera excepción de la misma
condición y nadie la había escrito.

**De qué da fe el Pixel:** de la PÁGINA. El snippet manda `pagina: location.href` en cada
opt-in desde la v2, así que una URL válida (`normalizarUrl`) prueba que esto salió de una
página real con el código adentro. Lo que **no** la trae es un POST pelado con el token
copiado del HTML —un bot, un `curl`, un formulario escrito a mano— y de eso no se puede
afirmar que el negocio pegó nada: sigue cayendo a la rama que descarta, **con su rastro**
(`vsl_events` con `tipo_evento: 'optin_bloqueado'` y `detalle: 'sin_pagina'`, más el
`console.warn`). O sea que la rama no quedó muerta: cambió de caso, y encima el caso nuevo
es el único que el token nunca autorizó.

⚠️ **El test que la congelaba se cambió CON la decisión, no contra ella.**
`tests/landing-optin.test.ts` exigía la casilla a propósito. Quedó escrito en su comentario
quién la cambió y cuándo (**Martín, 04/10/2026**), porque si no, el próximo que lo lea va a
creer que se rompió un guard. El rastro del descarte sigue con sus assertions intactas.

### 2. El agujero real: todo lead de landing nacía en el embudo del negocio

**MEDIDO antes de escribir una línea:** `app/api/track/optin/route.ts` no pasaba `funnel_id`
en ningún lado — cero coincidencias en el archivo. Con dos productos (mig 0170/0171, que ya
modelan `funnels`, `funnel_ofertas` y `v_funnel_productos`), los leads de la landing del
segundo aparecían en el tablero del primero. Nada fallaba: el lead entraba, con su nombre y
su teléfono, en el CRM equivocado.

**Cuelga de la PÁGINA, no del token — y esto no fue una preferencia.** El token es UNO por
workspace y determinista: `tokenDeterminista(ws)` es un HMAC de `landing:<ws>` guardado en
el único setting `landing_token` (`lib/landing-token.ts`). **No hay un segundo token que
asignar**, así que colgar el producto de ahí sería afirmar que todas las landings del
cliente venden lo mismo. La página sí distingue, y `landing.config` ya es una tabla POR
PÁGINA desde que `clarityProjectId` necesitó exactamente lo mismo (un proyecto de Clarity
es de un sitio; un producto es de una landing). **Cero migraciones**: `createLead` ya acepta
`funnel_id` y el campo nuevo entra en un `app_settings` que ya existe.

### La trampa que más cerca estuvo de salir: el default NO se escribe con su id

`listLeadsDeFunnel(null)` pide los leads del tablero por defecto con
`.is('funnel_id', null)` (`lib/leads.ts`), y `app/crm/page.tsx` sin `?funnel=` llama con
`null`. O sea que un lead nacido con **el id del embudo por defecto** desaparece de la única
pantalla que el cliente mira — con el producto correcto escrito en la fila, sin un 4xx y sin
un log. Son dos formas de decir lo mismo y sólo una la encuentra el CRM.

Por eso el embudo por defecto **no se ofrece como opción propia**: en la pantalla es el
valor VACÍO, rotulado con su nombre de producto para que se sepa dónde caen los no
asignados, y `funnelDeLanding` mapea su id a `null` explícitamente
(`elegido.esDefault ? null : id`).

### Lo demás que costó una vuelta cada uno

- **La resolución es TOLERANTE, y no por prolijidad.** `leads.funnel_id` referencia
  `funnels(id)`: un id de un embudo borrado haría **fallar el insert**, y en esta ruta un
  alta que falla cae a propuesta — el lead que entraba solo pasaría a esperar un click que
  nadie sabe que hay que dar. Se valida contra `listarFunnels()` (sólo activos), que es la
  MISMA lista que ofrece la pantalla: con dos lectores, la pantalla podría ofrecer un
  producto al que el lead nunca llega.
- **El `ws` se pinnea en la PRIMERA línea del cuerpo.** `getSetting` resuelve el workspace
  del request por cookies y esta ruta no tiene sesión. Sin `runWithWorkspace(ws, …)` leería
  la configuración del inquilino del contexto.
- **`funnels.id` es `bigint` y puede llegar como STRING.** Un `funnelId: "7"` guardado tal
  cual haría que el `===` del validador diera false SIEMPRE: nadie entraría nunca a su
  producto, con el dato bien escrito en el setting. Se sanea al parsear (`idFila`).
- **Corregir la URL de una landing no puede desasignarle el producto.** `conLanding`
  reconstruye la fila campo por campo, que es la trampa que ya mordió con `clarityProjectId`
  y con `esVsl`: `undefined` es «no lo toques» y lo que desasigna es un `0` explícito.
- **El `<select>` lleva el valor guardado aunque ya no se pueda elegir.** Un embudo
  archivado dejaría el control mostrando la primera opción, y el primer click **borraría la
  asignación** sin que nadie la toque.
- **Con UN solo producto el desplegable no se dibuja.** Un desplegable de un elemento no
  ofrece una decisión: ofrece confirmar la única que hay.

### Y la otra mitad: ¿QUIÉN MIRABA el campo que decidía?

Cambiar quién decide no termina en la ruta. `declarado` —`funnels.data.entradas` con
«landing»— lo consumía el **probador del Pixel** (`landingDiagnostico`, `lib/landing-token.ts`):
el paso 5 («Deja sus datos») sacaba su estado de ahí, y con la ruta ya aceptando el opt-in
eso le pintaba **en rojo «falta marcar la landing como entrada»** a un cliente cuyo
formulario SÍ está entrando — y lo mandaba a un trámite que no cambia nada.

Lo que decide ahora es `entraAlCrm = declarado || hayPageview`: un pageview de ESA página es
la prueba de que el Pixel está ahí, que es exactamente de lo que la ruta da fe.

Tres consecuencias que no se ven en el diff del gate:

- **La consulta de opt-ins colgaba de `declarado`** (`declarado ? await db.from('propuestas')…
  : { data: null }`), así que sin la casilla el chequeo no podía ponerse verde ni con leads
  entrando.
- **Un `optin_bloqueado` viejo no es un problema vivo.** Las filas anteriores al 04/10/2026
  son de la política anterior; tratarlas como actuales vuelve a mandar a la casilla. Va
  `hayOptinBloqueado = !entraAlCrm && …`.
- **El botón «Activar la landing como entrada de leads» se fue**, con todo su camino cableado
  (el deep-link del 28/09 que abría el pop-up en la subtab de entradas). No estaba mal hecho:
  se quedó sin trabajo. Un botón que manda a hacer un trámite que no arregla nada se lee como
  que ahí está la respuesta. Lo que arregla el «falta» de hoy es pegar el código, y eso es el
  paso 3 de la misma pantalla. El pop-up sigue existiendo y se sigue llegando por el
  deep-link desde el onboarding del Chat Agent — lo que se retiró es el botón, no la pantalla.
- **Y el paso 4 de «dónde pegar» decía textualmente «marca "Llenan un formulario en tu
  página" en Funnel → De dónde entran tus leads»** — una instrucción obsoleta que además
  nombraba una ruta retirada.

⚠️ **Y el guard que escribí para fijar esto falló contra MI PROPIO COMENTARIO.** El
`assert.ok(!/Activar la landing como entrada de leads/.test(lib))` dio rojo porque el
comentario que explica que el botón se retiró contiene la frase. Es la regla de la casa otra
vez: *un guard que lee el archivo entero encuentra lo que el archivo dice de sí mismo*. Se
filtran las líneas de comentario antes de preguntar.

### Lo que quedó SIN hacer

**El camino del DUPLICADO no lleva el producto.** Cuando el contacto choca con uno que ya
existe, la ruta deja una propuesta y `confirmarLeadsAction` la aplica con
`importarLeadsRevisadosAction`, cuyo `FilaImport` **no declara `funnel_id`** (grep: cero
«funnel» en `app/crm/leads-importar.ts`). El campo NO se escribió en `datos.leads[]` a
propósito: un dato que sólo existe en su declaración se lee como que ya funciona. Mientras
tanto el duplicado cae en el embudo del negocio —donde cae hoy— y lo decide una persona que
está mirando el CRM, con `moverLeadDeFunnel` a un click. Lo que lo cierra son dos líneas:
un `funnelId` en `FilaImport` (`app/crm/leads-importar.ts`) y pasarlo al `createLead` del
importador (`app/crm/actions.ts`).

---

## Replay de sesión y mapas de calor (Clarity vs. uno propio)

### El VSL no se ve en NINGÚN replay de DOM — tampoco en Clarity, que es lo que vuelve discutible la objeción

**Síntoma / la discusión:** al evaluar "replicar Clarity adentro de MaKo" (grabación de
sesión propia con rrweb en Landing Analyst), el argumento para NO hacerlo fue que el replay
no puede grabar adentro del iframe del VSL y se vería un recuadro vacío. Eso es cierto,
pero **es exactamente igual de cierto en Clarity**, así que no es una diferencia entre las
dos opciones: es una limitación de la técnica.

**Lo medido (docs oficiales de Microsoft, octubre 2026):**

- `learn.microsoft.com/clarity/session-recordings/inline-player`, sección *Inline player
  limitations*: «Clarity can't capture third-party iFrames and HTML Canvas elements. They
  appear in your recording as shown» (con captura del recuadro vacío). Y más arriba: «While
  the masked content is shielded, third-party iFrame content is blocked on the playback
  viewer».
- `learn.microsoft.com/clarity/faq`: «Though any site architecture is supported, Clarity
  can't render inside third-party 'iFrame' or 'canvas' elements». Y en heatmaps: «Clarity
  captures clicks on first-party iFrames (that is, iFrames source is the same domain as
  original page source) but not on third-party iFrames» — o sea que en Clarity **el clic
  sobre el play del VSL ni siquiera entra al mapa de calor**.
- Lado nuestro: `app/vsl/_detalle/PandaPlayer.tsx` monta un `<iframe src>` a
  `player-vz-*.tv.pandavideo.com.br`. Es third-party por definición de dominio.
- rrweb: `recordCrossOriginIframes` existe pero su default es `false` y su propia doc dice
  «rrweb has to be injected in each child iframe for this to work». No podemos inyectar nada
  dentro del player de un proveedor, así que la opción no nos sirve ni prendiéndola.

**La causa real:** un replay de sesión no es un video de la pantalla, es una reconstrucción
del DOM. El navegador no deja leer el DOM de un documento de otro origen (same-origin
policy), y ningún proveedor esquiva eso: lo esquivarían sólo grabando píxeles, que es lo que
ninguno hace. Clarity lo dice con todas las letras.

**La regla que queda:**

1. La profundidad de visualización del VSL **no sale de ningún replay, ni propio ni
   comprado**. Sale de los eventos del player (`panda_timeupdate` → `app/api/track/vsl`) o de
   la API de Panda. Ese beacon no es redundante con Clarity: mide lo único que Clarity no
   puede ver.
2. Lo que sí compra un replay de DOM: scroll y hasta dónde llegó, clics (con rage/dead
   click), movimiento del mouse, foco y tipeo en formularios, selección de texto, resize y
   cambios de orientación, pestaña visible/oculta, errores de JS, y el texto exacto que leyó
   esa persona. En rrweb eso son los `IncrementalSource`: `Mutation`, `MouseMove`,
   `MouseInteraction`, `Scroll`, `ViewportResize`, `Input`, `TouchMove`, `MediaInteraction`,
   `Selection`.
3. Matiz que conviene no perder: un `<video>` NATIVO servido desde nuestro dominio **sí** se
   graba — rrweb tiene `MediaInteraction` con `Play / Pause / Seeked / VolumeChange /
   RateChange`. El problema es el iframe, no el video.

### Privacidad: el default de rrweb NO es el default de Clarity

**La trampa:** se suele asumir que "rrweb y Clarity enmascaran los formularios por defecto".
Clarity sí; rrweb **no**.

- Clarity: «Clarity masks sensitive content on your website by default and never captures
  anything that is masked or sent over the wire». El modo por defecto es **Balanced** (sólo
  números y emails), y aparte: «Content in the input boxes is masked in all modes and can't
  be customized» — los inputs y los dropdowns van enmascarados en los tres modos, incluido
  Relaxed. Lo que NO enmascara: «Clarity doesn't mask content within style sheets or style
  tags».
- rrweb: `maskAllInputs` tiene default **`false`**, y `maskInputOptions` default
  **`{ password: true }`**. Es decir: de fábrica rrweb graba el contenido de los inputs tal
  cual, y lo único tapado es el campo de contraseña.

**La regla:** si alguna vez se graba sesión sobre landings de clientes reales y sus
visitantes, `maskAllInputs: true` no es una opción de configuración, es el piso. Y los
números y emails no están tapados por default ni siquiera así si viven como texto fuera de un
input (precios, teléfonos ya renderizados, datos del lead en una gracias/thank-you): eso pide
`maskTextClass` / `blockClass` explícitos. Esto es dato personal de terceros que no aceptaron
nada con nosotros, y tiene consecuencia legal, no sólo técnica.

---

### El PROMEDIO de `cierre.segundos` miente por 14x: lo que se dimensiona sale de la MEDIANA (2026-10-05)

**Síntoma / la trampa:** al dimensionar cuánto pesaría guardar las grabaciones, el insumo
obvio es `vsl_events` con `tipo_evento = 'cierre'`, que trae los segundos que duró la visita.
Promediado, el ws 1 da **262 segundos por sesión**. Con eso, 8.893 visitas al mes son ~38.800
minutos de grabación y el cálculo entero sale 14 veces más caro de lo que es.

**La causa:** esa columna es **reloj de pared**, no tiempo de uso. La mediana del mismo
workspace es **19 segundos** y el máximo medido es **124.055 — 34 horas**: pestañas olvidadas
abiertas de un día para el otro. El promedio *es* la pestaña de 34 horas.

**Medido el 05/10/2026** sobre septiembre (el mes pico), los cuatro workspaces que miden:

| ws | cierres | p50 | p90 | p99 | máx | minutos sin tope | con tope de 10 min |
|---|---|---|---|---|---|---|---|
| 1 | 3.385 | 19 s | 141 s | 5.129 s | 124.055 s | 15.669 | 3.474 |
| 13 | 1.059 | 27 s | 335 s | 1.824 s | 17.149 s | 2.342 | 1.355 |
| 11 | 189 | 12 s | 3.248 s | 76.951 s | 100.167 s | 6.498 | 415 |
| 14 | 50 | 28 s | 717 s | 52.049 s | 52.049 s | 1.859 | 131 |

O sea: **un tope de 10 minutos por sesión corta el 4,8 % de las sesiones del workspace
grande y ahorra el 80 % de los minutos** (26.368 → 5.375). Y el **32,4 %** de las sesiones
del ws 1 duran menos de 10 segundos (46,6 % en el ws 11): son rebotes sin nada que mirar.

**La regla, y vale para cualquier cosa que se cobre por tiempo de sesión** (una grabación, un
heatmap de atención, una métrica de engagement): el número que dimensiona es la **mediana con
un tope por sesión**, nunca el promedio. Y si lo que se mide es trabajo del navegador, el tope
se cuenta en **tiempo con eventos**, no en `Date.now() - inicio`: una pestaña escondida no
genera nada y se comería el tope entera sin haber grabado un píxel.

**Vive en:** `lib/replay-contrato.ts` (`REPLAY_TOPE_SEGUNDOS`, `REPLAY_PISO_SEGUNDOS`) ·
`docs/replay-diseno.md`

---

### Nadie repega el Pixel: medido, el workspace con 7.052 visitas corre la v14 de 20 (2026-10-05)

**Síntoma:** cada mejora del snippet trae su renglón en `novedadesDesde()` y su aviso de
«copia el código y reemplázalo», y el semáforo de `/integraciones` se queda en verde igual
porque los eventos siguen llegando. Así que la pregunta «¿le llegó la mejora a alguien?» no
la contesta ninguna pantalla.

**Lo medido el 05/10/2026 contra producción:**

- `SNIPPET_VERSION` es **20**. El setting `landing.snippet_version` del **ws 1** —el
  workspace con **7.052 visitas en septiembre**— dice **14**.
- La columna `vsl_events.clic_vacio`, que estrenó la v20 (un toque en algo que no es botón ni
  enlace, el dato más útil que hay para un mapa de calor), tiene **CERO filas en tres meses**
  en los cuatro workspaces que miden. No es que se use poco: no está desplegada en ninguno.

**La consecuencia de diseño, y es la razón por la que el grabador NO se inlinea:** rrweb son
23.697 B gzip encima de un snippet que ya son 96.880 bytes de fuente servidos sin minificar,
y el problema no es el peso — es que **pegarlo una vez más es pedir algo que la evidencia
dice que no pasa**. Va como script externo desde una ruta nuestra y **versionada**
(`/replay/<n>/r.js`, inmutable, cacheable un año): el loader vive en nuestro archivo, así que
arreglar el grabador es subir un número y no hay nada que repegar.

⚠️ **Y la ruta versionada no es un detalle de caché:** cambiar el contenido de una ruta ya
cacheada en el navegador de un visitante es un cambio que llega cuando quiere y que además
pisa la versión que se probó. Un arreglo es una ruta nueva.

⚠️ **Y NO va por un CDN público** (cdnjs, unpkg). El único argumento a favor —que se cachea
entre sitios— **ya no existe**: los navegadores particionan la caché HTTP por sitio de primer
nivel desde 2020. Lo que sí queda es un `<script>` de un tercero en la página de un cliente
de nuestro cliente, leyendo su DOM, que es exactamente lo que la decisión de
`docs/heatmaps-decision.md` rechazó de Clarity.

**Vive en:** `lib/landing-token.ts` (`SNIPPET_VERSION`, `novedadesDesde`) ·
`lib/replay-contrato.ts` (`REPLAY_LIB_VERSION`, `rutaDeLibreria`) · `docs/replay-diseno.md`

---

### Guardar sólo las sesiones que convierten invierte el valor de la feature (2026-10-05)

**El razonamiento que suena bien:** si una grabación pesa, se guardan sólo las que importan —
las que dejaron el lead. Con los números parece obvio: en septiembre, **45 de 5.919**
visitantes agendaron y **41 de 155** leads del mes llevan `visitor_id`, así que se pasaría de
8.893 sesiones a 45.

**Por qué está mal, y no por el volumen:** la razón para mirar un replay es ver por qué
alguien **no** convirtió. Quedarse con los que sí deja la grabación de la gente que ya
compró y tira la de todos los que se fueron, que es la pregunta. Y encima no se puede
decidir al grabar: el `visitor_id` se cose al lead **después** (por Calendly o por el Camino
1 del beacon), así que al momento de grabar la respuesta todavía no existe.

**Lo que sí se corta, con sus números:** el piso (menos de 10 s o 20 eventos se tiran, y eso
es el 32 % de las sesiones medidas) y el tope por sesión. Eso baja el costo sin tocar qué
preguntas se pueden contestar.

**Y la retención es donde el lead sí cambia algo:** 30 días para todas (lo mismo que Clarity,
para que nada quede peor que hoy) y **180 si ese visitante terminó en un lead** — que es el
agujero de Clarity que ya nos mordió, el que hizo falta para que existan el aviso
`clarity-grabacion-por-vencer` y su cron. Cuesta ~4 % más de disco: seis veces la retención
sobre el 0,7 % del volumen. **Se decide al borrar, no al grabar.**

**Vive en:** `lib/replay-contrato.ts` (`motivoDeDescarte`, `grabacionVencio`) ·
`docs/replay-diseno.md`

---

### `sendBeacon` avisa cuando no entra; `fetch(keepalive)` no (2026-10-05)

Los dos tienen la misma cuota de **64 KiB por documento** para lo que sale mientras la página
se está yendo. La diferencia está en qué contestan cuando se pasa: `navigator.sendBeacon`
devuelve **`false`**, y `fetch(..., { keepalive: true })` **resuelve la promesa igual** y
pierde el cuerpo sin decirlo.

El snippet hoy manda el `cierre` por `fetch(keepalive)` y está bien: es un JSON de 200 bytes.
Un lote de grabación es ~17 kB y la cola al salir puede ser más, así que ese camino no sirve —
y el que parece más moderno es el que pierde datos en silencio. El grabador tiene que **mirar
el `false` y tirar la cola**, no fingir que salió.

**Vive en:** `lib/replay-contrato.ts` (`REPLAY_BEACON_MAX_BYTES`, `puedeIrPorBeacon`) ·
`lib/landing-token.ts` (`enviar()`)

### El receptor NO sella, y la razón es la misma por la que `n` existe (2026-10-05)

**Vive en:** `app/api/track/replay/route.ts` · `lib/replay-ingesta.ts` ·
`supabase/migrations/0191_replay_de_sesion.sql` (`fin_at`)

**El diseño obvio era el equivocado.** El lote trae `fin: 1` cuando la persona se va, así
que lo natural es sellar ahí mismo: leer los lotes, comprimirlos, subir el objeto y
contestar. Y eso **tira el último pedazo de la grabación**, que es justo el momento que
alguien iba a mirar.

La razón ya estaba escrita dos secciones arriba y en la columna `n` de la migración: *el
orden no se deduce de la llegada*. Un `sendBeacon` y un `fetch(keepalive)` salen sin
esperar respuesta y el navegador los entrega cuando puede, así que **el lote con `fin`
puede llegar antes que el anterior**. Sellar en ese request deja al que venía en camino
sin dónde entrar — y lo pierde del final, no del principio.

La cura son dos columnas que parecen la misma y no lo son: `fin_at` (el grabador dijo
«terminé») y `sellada_at` (nosotros escribimos el objeto). El `fin` sólo anota, y el cron
sella dos minutos después. Gratis vinieron otras dos cosas:

- **El beacon deja de ser caro.** Sellar es leer hasta 2 MiB de la base, descomprimir N
  lotes, parsearlos, re-comprimir con gzip 9 y subir un objeto. Adentro del `pagehide` de
  la página de un tercero, eso es latencia que paga el visitante de nuestro cliente.
- **Un solo camino de sellado**, el mismo para la sesión que avisó y para la HUÉRFANA —la
  que cerró el navegador de golpe y nunca mandó el `fin`—. Sin eso, las huérfanas dejan
  sus filas en el buffer caliente para siempre y nadie las busca.

⚠️ **Y el contador de la sesión es idempotente porque `ms` viaja ACUMULADO.** El contrato
define `ms` como «milisegundos de grabación acumulados al cerrar este lote», no el largo
del lote, y eso vuelve el `update` un `max(…)` en vez de una suma: dos lotes en vuelo a la
vez no se pisan el contador, que es con el que se decide el tope de 10 minutos. Si `ms`
fuera el delta, una carrera entre dos POST dejaría la sesión midiendo de menos y el tope no
cortaría nunca.

### ⚠️ EL ÍNDICE PARCIAL DE LA PURGA NO VEÍA JUSTO LO QUE CRECE SIN TECHO (2026-10-05)

**Vive en:** `supabase/migrations/0191_replay_de_sesion.sql`
(`replay_sesiones_purga_idx`, `replay_sesiones_sellar_idx`)

El índice de la purga nació como `on replay_sesiones (workspace_id, inicio) where
storage_path is not null`, con un argumento que se lee impecable: lo sellado es lo único
que tiene un objeto que borrar, y así el índice no se paga por cada sesión a medio grabar.

Las dos mitades de la frase son ciertas y la conclusión es falsa, porque **la purga no sólo
borra lo sellado**. Lo que no tiene techo son las otras dos poblaciones, y las dos tienen
`storage_path` en NULL:

| | `storage_path` | qué deja atrás |
|---|---|---|
| sellada | la ruta | el objeto, que vence a los 30 días |
| **huérfana** (el `fin` no llegó nunca) | NULL | sus filas de `replay_lotes`, **para siempre** |
| **descartada por el piso** | NULL | su fila índice |

O sea que el índice escrito para «borrar lo viejo» era ciego a lo único que crece solo. El
modo de falla no es un error: es una consulta que corre sin índice y devuelve cero filas, o
sea indistinguible de «no había nada que purgar».

Quedó sin la condición, más uno nuevo y parcial para el SELLADOR (`where sellada_at is null
and descarte is null`), que en régimen son un puñado de filas. **La regla: antes de hacer
parcial un índice, enumerá las poblaciones que la consulta tiene que ver — no las que la
consulta veía el día que se escribió.**

### El piso borraba la fila, y con ella el único rastro de que lo tiramos nosotros (2026-10-05)

**Vive en:** `lib/replay-ingesta.ts` (`sellarSesion`) ·
`supabase/migrations/0191_replay_de_sesion.sql` (`descarte`, `descartados`)

El piso tira todo lo que no llegue a 10 s / 20 eventos, y está bien: el **32,4 %** de las
sesiones del ws1 son rebotes. Lo que estaba mal era borrar la fila junto con los lotes,
porque con eso no queda nada y «no llegó ninguna grabación» y «las tiramos nosotras» se ven
exactamente igual. Nadie puede contestar cuántas descarta el piso ni si está demasiado alto.

El argumento original —«un rebote ocupa una fila, un objeto y una llamada igual que una
sesión de diez minutos»— mezcla tres costos de órdenes distintos. Lo caro es el **objeto**
(cientos de kB) y los **lotes** (el buffer caliente); la fila índice son ~200 B, así que
2.900 rebotes al mes son **580 kB**. La fila sobrevive al descarte con `descarte` puesto
(`'corta'` / `'vacia'`), `storage_path` en NULL y sus lotes borrados.

Y el otro descarte, el del tope, tiene su propio contador: `descartados` cuenta los lotes
que llegaron DESPUÉS de cortar la sesión. Es lo único que contesta si el tope de 10 minutos
quedó corto — una sesión con `corte='tiempo'` y 200 descartados es alguien que siguió usando
la página media hora. Sin el contador, el exceso se descarta en silencio y el tope no se
puede auditar.

### La rotura que NO falló: un guard de COSTO no tiene red, y hay que decirlo (2026-10-05)

**Vive en:** `lib/replay-sellado.ts` (`cuerpoDeLote`) · `tests/replay-sellado.test.ts`

Probando el test rompiéndolo (base **16 pases, 0 fallos**; diez roturas, nueve con su
fallo), una quedó en **16 pases y 0 fallos**: sacar el chequeo de tamaño que corre ANTES de
decodificar el lote. Y no era un test flojo — ningún test puede verlo, y la cuenta dice por
qué:

| | dispara el chequeo PREVIO | dispara el de DESPUÉS |
|---|---|---|
| `z: 0` (texto crudo) | 524.288 bytes | **262.144** |
| `z: 1` (base64 de un gzip) | 393.216 bytes | **262.144** |

El segundo es **siempre** más estricto, así que el primero no puede cambiar un solo
veredicto. Ese `if` no decide qué lote entra: decide si se asigna medio mega de Buffer
antes de tirarlo. Queda, y queda escrito en el módulo y en el test que es un guard de costo
— el día que alguien lo borre «porque está duplicado», lo que se pierde no es una
validación sino no parsear basura.

Es la contracara de «un test verde sobre la propiedad equivocada»: acá el verde es correcto
y lo que falta es **declarar que esa línea no tiene red**, que es lo que AGENTS.md pide
cuando una regla no se puede validar de forma determinista.

⚠️ **Y una trampa del entorno medida en la misma pasada: `bytea` sobre PostgREST viaja en
HEXADECIMAL, o sea al doble.** La migración elige `bytea` en vez de `text` con un argumento
correcto —«guardar un binario como texto lo infla un 33 % en base64»— y el precio que no se
ve es que el único formato que PostgREST acepta y devuelve para esa columna es el texto
hexadecimal de Postgres (`\x1f8b…`): **dos caracteres por byte, peor que el base64 que el
argumento descartaba**. Sigue siendo la decisión correcta (lo que se infla es el tránsito
entre nuestro server y la base, en la misma región, no lo que queda guardado durante
minutos ni lo que se vuelve a codificar al sellar), pero el que lo lea tiene que saber que
el ahorro del 33 % no existe. Y de paso: `Buffer.from(x, 'base64')` **no se queja de nada**
ante un texto que no es base64, y `deBytea` sin mirar el prefijo acepta cualquier cadena —
las dos cosas meten bytes inventados adentro de una grabación.

---

### Un lead sin grabación son SEIS cosas distintas, y se leen igual (2026-10-05)

**Síntoma:** el estado NORMAL de la tarjeta de grabación en la ficha de un lead, durante
semanas, va a ser el vacío. Escrito como «sin grabación» se lee como que el producto no
mide — el mismo reporte que ya costó el botón de Clarity sobre leads de hace tres meses
(«aún no se está mostrando la grabación»).

**Las seis causas, y lo que las separa es DÓNDE se arreglan:**

| causa | ¿se arregla? | dónde |
|---|---|---|
| el lead no trae `visitor_id` | no, nunca | — |
| no se pudo LEER el índice | sí, reintentando | — |
| el workspace lo tiene APAGADO | sí | `landing.replay` (**sin pantalla todavía**) |
| el código de la página es anterior al grabador | sí | /integraciones?abrir=landing |
| la purga ya la borró | no | — |
| de verdad no hay | no | — |

**El orden en que se preguntan NO es estético: es el orden en que se tapan entre sí.**

- Una grabación que EXISTE gana sobre todo, incluido el apagador: apagarlo hoy no borra lo
  de ayer, y esconderlo sería tirar un dato por una configuración de ahora.
- «No trae identificador» va antes que «no pude leer»: es un hecho que no depende de
  ninguna consulta, y decir «no pude leer» ahí manda a reintentar algo que va a contestar
  lo mismo siempre.
- El **apagador va antes que el pixel**: con el interruptor en false, repegar el código no
  cambia NADA. Es el candado sin llave de AGENTS.md aplicado a un estado vacío.
- El **pixel va antes que el vencimiento**: si esa página nunca tuvo el grabador, no hubo
  nada que vencer — decir «ya la borramos» inventaría una grabación que no existió.

Y dos frases que la pantalla NO puede escribir: `apagado` **no lleva link** (el interruptor
se prende con `setSetting` y no hay pantalla; un botón que lleva a donde la respuesta no
está es peor que ninguno) y `vencida` **no afirma que hubo una** — la purga borra también la
fila del índice, así que desde la ficha no hay forma de distinguir «existió y venció» de
«nunca hubo». Dice la condición, no el hecho.

⚠️ Y `no_se_pudo_leer` **no es prudencia**: `replay_sesiones` no existe hasta que se aplique
la 0191, y un `select` de PostgREST contra una tabla que no existe devuelve `data:
undefined` **sin tirar**. Sin leer el `error`, «no hay grabación» y «la migración no está
aplicada» son la misma pantalla.

**Vive en:** `lib/replay-ficha.ts` (`motivoDelVacio`, `textoDelVacio`) ·
`tests/replay-ficha.test.ts` · `app/crm/lead-view/GrabacionCard.tsx`

---

### El reproductor de rrweb no se instala: se SIRVE (2026-10-05)

**El diagnóstico obvio era el equivocado.** El pedido decía «cargalo con import dinámico»,
y `import('@rrweb/replay')` no compila: la dependencia **no está** (`npm ls rrweb` no
devuelve nada) y un import literal de un paquete que no existe **tira el build entero**, no
esa pantalla. La salida que aparece primero es `npm install`, y es la que no se puede tomar
acá: hay **tres sesiones sobre este clon** y un install reescribe `package-lock.json` y
`node_modules`, que son de todos — el candado del `tmp-` sin commitear, pero de minutos y
para los tres.

**Lo que queda:** el reproductor se baja a pedido desde una ruta NUESTRA y versionada,
`/replay/<v>/player.js`, con un `<script>` inyectado la primera vez que alguien abre una
grabación. Nada de rrweb viaja en el bundle de la app, que es lo que el pedido quería, y
cambiar a una dependencia instalada es cambiar UNA función (`cargar()`).

Y no es sólo conveniencia: la pantalla que monta el reproductor es la ficha de un lead, con
la cookie de sesión del equipo y los datos de los clientes a la vista. Un `<script>` de un
CDN de un tercero ahí es la misma decisión que la de heatmaps rechazó de Clarity, del lado
de adentro — y el único argumento a favor de un CDN (la caché compartida entre sitios) **no
existe desde 2020**.

⚠️ **Que un `<script>` cargue no es que el reproductor esté.** Un 404 que el router sirve
como HTML dispara `onload` perfectamente y no define nada. Se pregunta por el GLOBAL
(`window.rrwebPlayer`), nunca por el `onload`. Y un fallo **no se memoiza**: la causa más
probable es la red de quien está mirando.

**Falta el archivo** (`public/replay/1/player.js`, el bundle UMD de `rrweb-player`), igual
que falta `/replay/<v>/r.js` del lado del grabador. Mientras no esté, el pop-up **lo dice y
ofrece bajarse la grabación**: el reproductor no puede ser la única puerta a un dato que ya
está en la pestaña.

**Vive en:** `lib/replay-reproductor.ts` · `app/crm/lead-view/GrabacionModal.tsx`

---

### El FORMATO del objeto en Storage es parte del contrato, y no estaba (2026-10-05)

El contrato dice `<ws>/<YYYY-MM-DD>/<sesion>.jsonl.gz` y nada más. `.jsonl` admite dos
cosas igual de válidas —**un evento por línea** o **un lote (un array) por línea**— y el
sellador y el reproductor los escribió gente que no se ve: elegir la que no es deja un
reproductor que no dibuja nada sobre un objeto que está perfecto, sin un solo error.

Medido sobre el árbol a las **09:31 del 05/10/2026** (sin commitear): `lineaDeLote`
(`lib/replay-sellado.ts`) escribe **un lote por línea** —`JSON.stringify` de un array, y
`'[]'` cuando el lote vino vacío—. El lector acepta las DOS formas y cuenta las líneas que
no entendió; las `[]` no son un error (no aportan eventos y no son ilegibles).

**La regla:** cuando dos paquetes se hablan por un ARCHIVO, el formato del archivo es parte
del contrato — igual que los topes y la ruta. Y mientras no lo sea, el que lee se hace
tolerante y **cuenta lo que descarta**: una grabación a la que le faltan pedazos no se
puede mostrar como completa.

⚠️ Y con menos de **dos** eventos no se reproduce: rrweb dibuja un cuadro negro con un play
que no avanza, que se lee como un reproductor roto. Es mejor decir que llegó cortada.

**Vive en:** `lib/replay-ficha.ts` (`parsearCuerpo`, `REPLAY_MINIMO_EVENTOS`) ·
`lib/replay-sellado.ts` (`lineaDeLote`)

---

### La versión del Pixel se pregunta por LEAD, no por workspace (2026-10-05)

Para decir «esa visita no se grabó porque tu código es viejo» hace falta una versión, y hay
tres candidatas: el setting `landing.snippet_version` (que escribe el **último** evento que
llega, venga de la página que venga), el `sv` de las visitas de ESA página, y el `sv` de las
visitas de ESTE lead. La unidad que gana algo acá es el lead.

- Se toma el **máximo** entre el `sv` del lead y el setting del workspace: el setting puede
  estar más adelantado si acaban de repegar el código y la visita nueva todavía no llegó, y
  un «tenés el código viejo» sobre una página recién actualizada es el mismo falso positivo
  al revés.
- **`null` es «no se sabe» y NO acusa.** Un lead que entró por un formulario de Meta no
  tiene ni una visita con `sv`: ahí el código de la página no es el problema, y la frase que
  sale es «no hay grabación suya», no «actualizá el código».
- `0` tampoco es una versión: nadie midió nunca con la 0. Vuelve a ser «no se sabe».

Es la misma trampa que ya costó el botón «Probar» bloqueado para los cuatro clientes
(AGENTS.md: «un bloqueo derivado de una versión GLOBAL bloquea a todos»), con la unidad una
vuelta más abajo.

**Vive en:** `lib/replay-ficha.ts` (`REPLAY_DESDE_SNIPPET`) · `lib/replay-leer.ts`

---

### El PRIMER lote de toda sesión no entra en el tope del receptor, y el grabador lo tiraba (2026-10-05)

**El caso cruzado entre dos paquetes, que ninguno de los dos podía ver solo.** El receptor
rechaza un lote de más de **256 KiB** ya decodificado (`REPLAY_LOTE_MAX_BYTES = 4 ×` la
cuota de `sendBeacon`, en `lib/replay-sellado.ts`) y lo contesta como `pesado`. El grabador
cortaba **sólo por cantidad** —100 eventos o 10 segundos— y al mandar ya había vaciado la
cola y consumido su número de lote.

Y el lote que se pasa no es el raro: es el **primero de cualquier sesión**. El primer evento
de rrweb es la foto entera de la página, y con `inlineStylesheet: true` —que está prendido a
propósito, para que el reproductor no dibuje una página sin estilo el día que el cliente la
rediseñe— la hoja de estilos viaja adentro de ese evento. Una landing armada con un builder
pasa los 256 KiB en la foto sola.

Lo que se pierde con eso no es «un pedazo»: es **la foto**, o sea lo único que el
reproductor necesita para dibujar algo. La sesión queda guardada, con sus eventos
incrementales, y no se puede reproducir — sin un error, y con la fila de índice diciendo que
está todo bien.

**La cura, y por qué va del lado del que MANDA:** el grabador parte por TAMAÑO con el mismo
número que mira el que recibe (`replayPartir`), y cada tanda se lleva su propio `n`.

- **Un evento solo que no entra NO se parte y va igual.** Comprimido casi siempre entra —el
  tope se aplica a los bytes del gzip, no al base64— y si no entra lo tira quien tiene el
  número de verdad. Lo que no se puede hacer es tirarlo en el navegador: una sesión sin su
  foto no se puede mirar, y el descarte del receptor por lo menos queda contado en
  `replay_sesiones.descartados`.
- **El corte se evalúa ANTES de pasarse, no después**: `if (actual.length && …)`. Con la
  condición sin el `actual.length`, el evento grande arrastra a los que vienen detrás y la
  tanda entera se pasa — que es el bug servido de nuevo.
- **El peso de un cuerpo comprimido se mide sobre los bytes del gzip** (`× 3/4` del base64),
  que es lo que el receptor mide después de decodificar. Medirlo sobre el base64 rechazaría
  un tercio de los lotes perfectamente buenos.

⚠️ **Y `z: 1` es base64 DEL gzip, no el gzip pelado.** `e` es un campo de un JSON y los
bytes de un gzip no son texto válido, así que el base64 lo fuerza el formato del lote. Las
dos puntas ya coinciden —`cuerpoDeLote` hace `Buffer.from(e, 'base64')` y mira la firma
`0x1f 0x8b`— y eso fue suerte, no contrato: el tipo `ReplayLote` dice «Gzip si z es 1» y no
dice nada del base64. Queda dicho acá y en el snippet.

**Vive en:** `lib/landing-token.ts` (`replayPartir`, `replayPost`) · `lib/replay-sellado.ts`
(`REPLAY_LOTE_MAX_BYTES`, `cuerpoDeLote`) · `tests/landing-snippet-emitido.test.ts` («el
lote se parte con el tope del RECEPTOR»), que lee los DOS archivos y además EJECUTA
`replayPartir` sacándola del texto emitido

---

### La cuota de `keepalive` es del DOCUMENTO, y los dos caminos la comparten (2026-10-05)

Complemento de «`sendBeacon` avisa cuando no entra; `fetch(keepalive)` no»: ahí lo que se
mide es **quién avisa**. Esto es lo otro, y muerde en el camino que parece inofensivo.

Los 64 KiB no son un tope por request: son la cuota de **todo el documento**, y la comparten
`fetch(keepalive)` y `sendBeacon`. El snippet manda sus eventos con `keepalive: true` desde
la v1 —correcto, son 200 bytes y tienen que sobrevivir a la navegación— y copiar ese molde
para el lote del replay es lo que aparece primero. Un lote son ~17 kB: **uno solo se come un
cuarto de la cuota que el beacon del final necesita**, y ese beacon es el único camino que
queda al irse de la página.

Así que el lote de todos los días va con un `fetch` **normal**. Mientras la pestaña está
abierta no hace falta nada más, y lo que se compra es que el último lote —el que lleva el
`fin: 1` y cierra la sesión— tenga la cuota entera.

⚠️ **Y el cuerpo viaja etiquetado `text/plain`, en los dos caminos.** Con
`application/json` el navegador tiene que pedir permiso primero (preflight), y un preflight
disparado mientras la página se cierra es un lote que no sale. `text/plain` es un valor
seguro de CORS, así que no hay preflight — y funciona porque `request.json()` **parsea el
cuerpo y no mira la etiqueta**. Es un contrato real entre el snippet y el receptor, y no se
ve en ninguno de los dos archivos: si alguien le pusiera a la ruta un guard por
Content-Type, el replay se apagaría al cerrar la pestaña y en ningún otro momento.

**Vive en:** `lib/landing-token.ts` (`replayPost`, `replayBeacon`) ·
`app/api/track/replay/route.ts` (`request.json()`)

---

### Un interruptor interpolado en el snippet queda congelado para siempre (2026-10-05)

El snippet se arma en el server, así que la salida barata para el apagador es interpolar el
estado: `var GRABA = true`. No se puede, y por la misma razón por la que existe la ruta
versionada de la librería — **el snippet queda congelado en el HTML de un tercero**. Un
`true` pegado hoy no se apaga nunca, y un cliente que deja de querer que grabemos tendría
que volver a pegar el código para que lo dejemos de hacer.

Lo mismo vale para el **número de versión de la librería**: si saliera interpolado, «arreglar
el grabador es subir un número» sería falso para todo el que no repegue — o sea para el
workspace con 7.052 visitas, que corre la v14.

Las dos cosas viajan en la **respuesta del `pageview`** que el snippet ya manda: cero
requests extra, y el server es el único que decide. Lo que eso costó del lado del snippet es
que `enviar()` aprendiera a leer una respuesta (un segundo parámetro opcional, que sólo el
pageview pasa); el resto de los eventos siguen sin mirarla.

- **Lo único que viaja es la versión.** Las opciones de privacidad NO se piden ni se
  reciben: viven interpoladas del contrato y el snippet no las lee de ningún lado. Si el
  permiso para tapar los campos viniera por la red, algún día va a venir mal.
- **Y se sanea antes de armar la URL** (`v >= 1 && v <= 9999`): ese número termina adentro
  del `src` de un `<script>` en la página de un cliente.
- **Mientras el server no conteste `rec`, la librería ni se baja.** Lo que se ahorra no es
  el tiempo de grabar: es la descarga.
- ⚠️ **Y que el `<script>` cargue no es que la librería esté** — un 404 servido como HTML
  dispara `onload` perfectamente. Se pregunta por el global (`window.rrweb.record`), igual
  que el reproductor del otro lado. Sin eso se acuña el id de sesión y se cuelgan los
  listeners de una grabación que no existe.

**Vive en:** `lib/landing-token.ts` (`enviar`, `replayArrancar`, `replayGrabar`) ·
`app/api/track/vsl/route.ts` (la rama `pageview`, que contesta `rec` con `grabaA`)

---

### Un ancla de test con la FIRMA de la función se rompe por un renombre (2026-10-05)

`tests/landing-optin.test.ts` anclaba en `'function enviar(data) {'` para comprobar que la
página se pega **adentro** de `enviar()` y no en cada llamada. Al darle a `enviar` un
segundo parámetro, el `indexOf` dio **-1**, el test falló, y lo que persigue seguía intacto:
un rojo que no es un bug.

Es el espejo de los guards que dan verde de más (AGENTS.md: «un guard que lee el archivo
entero encuentra lo que el archivo dice de sí»). Acá el universo era demasiado CHICO: la
lista de parámetros no es parte de lo que el test cuida. El ancla quedó en
`'function enviar(data'`, y se comprobó rompiéndolo —sacando la línea de `enviar()` y
dejándola suelta— que sigue cazando el bug: **65 pasan / 1 falla**.

**La regla:** un ancla incluye lo que el test cuida y nada más. Si incluye la firma, el test
falla el día que alguien agrega un parámetro — y lo que se aprende de un test que falla por
un renombre es a cambiar el test sin leerlo.

**Lo que queda SIN hacer, y es lo único que separa esto de grabar de verdad:**
`public/replay/1/r.js` **no existe** (el bundle UMD de `rrweb-record`), igual que falta
`public/replay/1/player.js` del lado del reproductor. rrweb no es una dependencia del repo y
no se puede instalar con tres sesiones sobre el mismo clon. Mientras no esté, el apagador
prendido baja un 404, `onload` dispara, el global no está y el grabador se apaga solo — que
es el comportamiento correcto y es, exactamente, no grabar nada.

**Vive en:** `tests/landing-optin.test.ts` · `lib/landing-token.ts` (`enviar`)

---

### ⚠️ «Clarity está muerto en datos» era falso: se midió el campo que el código NO leía

**Síntoma / el diagnóstico equivocado.** El 06/10/2026, revisando si el reemplazo de Clarity
estaba al 100%, se le dijo a Martín que sus restos eran «código vivo, datos muertos: ningún
workspace tiene un `clarityProjectId` activo». Con eso él pidió sacarlo entero.

**Y era falso.** Se había medido `landing.config[].clarityProjectId` —el proyecto POR PÁGINA,
que sí tenía cero filas— y no lo que leía el código que corría: `credWs('CLARITY_PROJECT_ID')`,
la credencial del WORKSPACE (`lib/clarity.ts`). Medido después contra producción: **5
workspaces con credencial viva y 3 de ellos clientes** (Leila, Código Inmobiliario, P2P
Consulting), con el resumen de ayer escrito por el cron (116 sesiones en uno). Y un cliente
lo estaba pidiendo por WhatsApp: «Avisame cuando el mapa de calor y grabación de clarity estén
listos».

**La regla, que quedó en AGENTS.md:** para afirmar que un cambio no afecta a nadie, se mide lo
que LEE el código que corre — no un campo con el mismo nombre en otro lado. Es la familia de
«un grep sobre un archivo contesta "ese archivo no lo hace", nunca "nadie lo hace"».

**Y el reemplazo no estaba encendido para los clientes**, que es lo que de verdad decidía el
orden. La grabación propia sólo estaba prendida en el ws1 (a mano, en la base: no había
pantalla). Y los tres clientes corrían el Pixel **v15 a v18**, cuando el grabador existe recién
desde la **v21**: aunque se prendiera, no grababa nada hasta que repegaran el código. Sacar
Clarity sin eso era dejarlos sin grabaciones, no reemplazarlas.

**Lo que se hizo, en orden:** (1) el interruptor «Grabar las visitas» en el Pixel, que la v21
ya le había PROMETIDO a cada cliente por WhatsApp («se prende una vez desde la app») y no
existía; (2) la grabación prendida en los tres negocios que tenían Clarity (es la misma
decisión que tomaron al conectarlo, y se revierte con el interruptor); (3) recién ahí, Clarity
fuera: los cuatro registros, el snippet, la ficha, los dos crons, el aviso, la API de MaKo.

**Y la versión del Pixel NO se subió** — ⚠️ y eso estuvo MAL, corregido el mismo día con la
v22. El razonamiento («los tres clientes ya están por debajo de la v21») cubría a los
clientes y no a una página ya repegada con la v21 ANTES del retiro: la portada del ws1 se
repegó el 06/10 a las 03:48 UTC, el commit que sacó Clarity es de las 07:23, y esa página
servía `SV = 21` con el tag de Microsoft adentro. Con la versión en 21 contaba como al día
para siempre. Ver «Sacar algo del código pegado también es una versión nueva», abajo.

**Lo que quedó SIN hacer:**
- **Los clientes tienen que REPEGAR el código.** Hasta que lo hagan, su página sigue cargando
  el tag de Microsoft (el id viaja horneado en su HTML) y MaKo no los graba. El ws1 también:
  su landing principal corre la **v14** (7.793 visitas en 30 días contra 32 de la v21).
- **El MAPA DE CALOR es lo único de Clarity sin reemplazo.** *Hecho el mismo día*: Martín lo
  pidió en Landing Analyst (ver «El mapa de calor se dibuja sobre la FOTO de una grabación»).
  Y «los datos ya se capturan desde la v20» era cierto en el código y falso en la práctica:
  16 toques con punto en toda la historia, ninguno de un cliente.
- **Restos en datos** — *borrados el mismo día*, a pedido de Martín («borra todo lo de
  clarity»): 10 credenciales (con su fila de auditoría), 9 settings y la propuesta del ws13
  con el porqué falso. Dos correcciones a lo que decía este punto: en **Vercel no había**
  ninguna `CLARITY_*` (0 de 34), y «ningún código los lee» era falso para el ws1:
  `hidratarCredenciales` descifra todas sus credenciales a `process.env` en cada arranque.
- **`guardar_landing` de la API de MaKo no expone los productos** (`funnelIds`): la pantalla
  los asigna y MaKo no puede. Es un hueco del registro, no de Clarity.

**Vive en:** app/integraciones/IntegracionesBoard.tsx (`cambiarGrabacion`) ·
app/integraciones/landing-config-actions.ts (`guardarGrabacionAction`) · lib/replay-ficha.ts ·
app/api/cron/prueba-grabacion/route.ts · lib/lead-de-prueba.ts · tests/sin-clarity.test.ts ·
*2026-10-06*

### El paso 2 tardaba por TRES server actions en serie, no por los datos

Martín: «tardó mucho en encontrar mis productos… si son 2 literalmente». Medido: al abrir el
Pixel salían `getLandingsAction` (paso 1) y `getProductosAction` + `getLandingsAction` otra vez
(paso 2, en un `Promise.all`) — y el `Promise.all` no paraleliza nada, porque Next despacha las
server actions DE A UNA (regla ya escrita en AGENTS.md). Tres viajes en serie, 11 a 13 idas y
vueltas a la base para traer dos filas, mientras la pantalla mostraba un «Buscando tus
productos…» escrito.

La cura no fue acelerar nada: fue no preguntar. Las páginas y los productos los resuelve el
server en `page.tsx`, en paralelo con lo que ya resolvía, y bajan por props. Medido en el
navegador: el paso 2 aparece en el primer frame (1,2 s desde el click, con el modal incluido).

- **Una lista vacía de productos es una lectura que falló**, no «no tenés productos»: todo
  workspace tiene su embudo del negocio. El server baja `null` y el paso lo dice.
- **Las páginas viven en el padre de los pasos 1 y 2.** Eran dos copias del mismo estado, y
  guardar en uno dejaba al otro con la vieja.
- **Con una sola página el modal arranca con ella elegida**: elegirla en un efecto la elegía
  después del primer pintado, y los pasos 2 a 4 aparecían tarde.

**Vive en:** app/integraciones/page.tsx · lib/landing-config-leer.ts ·
app/integraciones/AsignarProducto.tsx · app/components/Dropdown.tsx (`varios`) · *2026-10-06*

### Sacar algo del código pegado también es una versión nueva

**Síntoma.** Al retirar Clarity se decidió no subir `SNIPPET_VERSION` porque «los clientes
ya están por debajo de la v21». La portada del ws1 —la de más tráfico del producto— se
había repegado con la v21 cuatro horas antes del retiro y seguía sirviendo el tag de
Microsoft. Con la versión en 21, el aviso de repegar no le iba a llegar nunca.

**La regla, que quedó en AGENTS.md:** el código vive congelado en la página del cliente, así
que lo que se SACA del snippet (un tercero, un comportamiento) sólo le llega a quien repega,
igual que lo que se agrega. Se sube la versión, aunque no traiga nada «nuevo».

La v22 sumó además el ancla del clic para el mapa de calor (el elemento tocado, sin texto,
y dónde dentro de su caja), así que repegar una vez da las dos cosas.

**Vive en:** lib/landing-token.ts (`SNIPPET_VERSION`, `NOVEDADES`) · *2026-10-06*

### El WhatsApp de «tu Pixel quedó viejo» no le llegaba a nadie desde el 28/09

**Síntoma:** Martín pidió usar ese aviso para que los clientes repeguen. Medido: la última vez
que salió fue el 28/09, y ese día Leila y Código Inmobiliario estaban en la v18 y P2P en la 15.

**Causas, cuatro:**
- El 28/09 todo aviso sin `porDefecto` pasó a nacer apagado y éste no se rescató (ver
  `hallazgos-comunicacion.md` → «Cambiar un default apaga cosas que nadie pidió apagar»).
- El texto mentía: el renglón de la v21 decía «llega APAGADA» —falso en los cuatro negocios
  con la grabación prendida— y hablaba de «otra herramienta» que ya no existía.
- **`Object.entries` recorre las claves numéricas de MENOR a mayor** aunque el literal esté
  escrito de la más nueva a la más vieja: la novedad que justificaba el aviso salía ÚLTIMA,
  entre el 66% y el 84% de un WhatsApp de 1.042 a 2.240 caracteres.
- Un dedup de 72 h exactas sobre un cron diario a la misma hora sale cada CUATRO días: el
  tercero cae segundos antes del corte (ws1: 13, 17, 21 y 25/09).

**Lo que quedó:** prendido (`'on'`, se puede apagar); la razón va primero y sólo si es verdad
para ese negocio («no graba las visitas» con la grabación prendida y un código anterior al
grabador); las novedades de la más nueva a la más vieja, tres y «y N más», contadas desde la
página MÁS atrasada (en el ws11 el setting decía 18 y una página seguía en la 15); una vez
por semana con 7 días menos una hora, y con la versión como `dedupKey`.

**SIN HACER:** P2P (ws14) no tiene ningún canal —ni grupo, ni mail, ni destinatarios— y
además lleva días sin visitas (cae en la rama de «tracking apagado»): este aviso no le llega.
Lo único que le llega hoy es el aviso fijo dentro de MaKo.

**Vive en:** app/api/cron/tracking-vigilante/route.ts · lib/landing-token.ts (`novedadesDesde`)
· lib/avisos-catalogo.ts · *2026-10-06*

### Token acuñado no es Pixel pegado, y la versión del workspace la bajaba el editor

Dos trampas que encontró el aviso fijo «Actualiza el Pixel» (lib/pixel-aviso.ts):

- **`snippetDesactualizado()` cuenta como v1 a quien no tiene versión anotada**, y el token se
  acuña con sólo ABRIR Integraciones: los ws 9, 10, 15 y 17 tienen token, ninguna versión y cero
  visitas en toda su historia. El aviso fijo pregunta por la FILA de versión (sin fila no hay
  Pixel pegado). ⚠️ **SIN HACER:** el chip «Actualiza el Pixel» del modal (`landingVieja` en
  app/integraciones/page.tsx) sigue usando `snippetDesactualizado()` y se lo muestra a esos
  cuatro negocios. Unificar con `pixelParaActualizar` es una línea, pero la función la usan el
  cron, landing.run y el pulso.
- **La versión es del workspace y gana el último evento**, y la vista previa del constructor
  corre el código viejo un rato más: en el ws1, v14 desde el preview a las 03:28 y v21 desde la
  página a las 03:30. El beacon ya no deja que el editor ni localhost la anoten.

**Vive en:** app/api/track/vsl/route.ts (`anotarVersionSnippet`) · lib/pixel-aviso.ts ·
*2026-10-06*

### El mapa de calor se dibuja sobre la FOTO de una grabación, no sobre la página en vivo

Pedido de Martín (06/10/2026): el mapa de calor en Landing Analyst. Lo que costó:

- **Un iframe con la página real corre el Pixel adentro**: cada vez que alguien abre el mapa se
  registra una visita y —con la grabación prendida— se graba al que mira. Y de otro origen no se
  puede leer ni su alto ni dónde está cada elemento. El fondo es la FOTO COMPLETA que guarda
  cada grabación (rrweb, evento de tipo 2), reconstruida como HTML sin scripts en un iframe
  propio (`lib/landing-mapa-foto.ts`).
- ⚠️ **El cuerpo sellado guarda UN LOTE POR RENGLÓN, no un evento.** La primera versión leía
  cada renglón como un evento suelto, no encontraba nunca el tamaño de la ventana y decía «no
  hay una grabación de esta página» sobre diez que tenían foto. Lo encontró el navegador, no el
  test — el test se había escrito con la forma que uno se imaginaba.
- ⚠️ **En un iframe tan alto como la página, `100vh` vale la página entera**: una portada con
  `min-height: 100vh` se estira y el documento crece solo. Las unidades de ventana se congelan a
  píxeles con el alto de quien grabó.
- **El alto del documento varía hasta un 32%** en la misma página al mismo ancho (3.518 a 4.650
  px): un punto de página escalado cae cientos de píxeles corrido. Por eso la v22 ancla el clic
  al ELEMENTO, y el punto queda de respaldo.
- **La página del mapa es host + ruta sin query.** `normalizarUrl` de lib/landing-paginas.ts
  conserva el query que no reconoce, y los anuncios de Meta suman `ai=…&ct=…` y WhatsApp
  `sfnsn=wa`: la misma portada salía como tres páginas. ⚠️ **SIN HACER:** el pulso de Landing
  Analyst y el resto de los lectores que usan esa normalización tienen el mismo problema;
  sumar esos parámetros a los de medición es la cura, en otro cambio.
- Medido el 06/10: 3 de 13 grabaciones selladas no tienen foto (se perdió el primer lote; la
  causa no se midió). El lector prueba hasta 12 (también las de prueba: la única de computadora del ws1 era una) y, sin foto, la pantalla muestra «Lo más tocado».

**Vive en:** app/landing-analyst/MapaDeCalor.tsx · lib/landing-mapa.ts ·
lib/landing-mapa-foto.ts · lib/landing-mapa-server.ts · app/api/landing-analyst/mapa/ ·
*2026-10-06*

### Landing Analyst no se enteraba de las páginas del Pixel

Medido el 06/10/2026: de 7 páginas declaradas en 4 negocios, 4 nunca se habían analizado.
Nada conectaba los dos: una página entraba a Landing Analyst sólo si alguien la pegaba a mano.

- **La decisión es un CÁLCULO** (las declaradas sin fila), no un disparo «cuando cambia algo»:
  cubre la pantalla del Pixel, el formato viejo y la API de MaKo sin que ninguno avise. Corre
  con `after()` al guardar y un cron cada hora hace de red y de backfill.
- ⚠️ **Hay DOS normalizaciones de URL** y no dan lo mismo: la del Pixel conserva www y query, la
  de Landing Analyst no. Cruzarlas sin pasar las dos por la de Landing Analyst muestra como
  «nunca analizada» una página que se analiza todos los días. Esa normalización se mudó a
  lib/landing-url.ts (sin `server-only`) para poder testearla.
- ⚠️ **El `after()` de una server action vive dentro del `maxDuration` de la PÁGINA** que la
  llama, y /integraciones no declaraba ninguno: el análisis habría muerto a mitad de camino.
- **Reclamo atómico** contra el índice único: sólo quien inserta la fila `pendiente` analiza.
- **Sólo las declaradas:** las URLs que vio el Pixel las escribe un endpoint público.

**Vive en:** lib/landing-analyst-auto.ts · lib/landing-url.ts ·
app/api/cron/landing-analyst-auto/route.ts · *2026-10-06*

### «Leads entrantes» ya muestra la grabación: lo que falta es captura e identidad

Pregunta de Martín (06/10/2026): «si ya tenemos el ID del usuario, y están cayendo al CRM, en
la etapa de Leads entrantes podríamos ya visualizar la grabación con todo lo demás del
tracking?». La pantalla ya existe: la pestaña Tracking de la ficha muestra la grabación de
cualquier lead con `visitor_id`, en cualquier etapa, y una grabación anterior al opt-in se ata
sola (el grabador usa la misma cookie que el Pixel). Hoy no se ve nada por otras razones:

- **Captura:** los clientes no graban (Pixel v15-v18). El ws1 graba desde las 03:30 del 06/10.
- **Identidad:** los 4 leads en la primera etapa de los cuatro negocios son de formularios de
  Meta o sin origen: ninguno tiene `visitor_id`. Meta no da ninguna llave compartida con la
  landing, y atar por cercanía de tiempo mostraría la grabación de otra persona.
- ⚠️ **SIN HACER — el opt-in que choca con un duplicado PIERDE el `visitor_id`.** Va a una
  propuesta con el dato adentro, y al confirmarla no lo copia nadie: `aFilas`
  (app/crm/revisar/[id]/RevisarLead.tsx), `FilaImport` (app/crm/leads-importar.ts),
  `importarLeadsRevisadosAction` (app/crm/actions.ts) ni `camposParaCompletar`
  (lib/leads-duplicados.ts). Medido: el único lead del ws13 en la primera etapa tiene dos
  propuestas con `visitor_id` que nunca llegaron a su ficha.
- ⚠️ **SIN HACER — la cookie del visitante no lleva `domain=`** (lib/landing-token.ts), así que
  `www` y el dominio sin `www` son dos visitantes distintos para la misma persona.
- Arreglado de paso: las sesiones descartadas (`corta`/`vacia`) salían en la ficha como «Se
  está guardando» para siempre (lib/replay-leer.ts).

*2026-10-06*

### La revisión adversarial de la tanda del 06/10: lo que el mapa y el aviso decían de más

**Vive en:** `lib/replay-ficha.ts` (`noGrabanTodas`) · `app/api/cron/tracking-vigilante/route.ts` ·
`app/landing-analyst/MapaDeCalor.tsx` · `lib/landing-mapa.ts` (`selAnclado`) ·
`lib/landing-mapa-foto.ts` (`congelarVhEnHoja`) · `lib/landing-mapa-server.ts` (`fondoDelMapa`) ·
`lib/landing-analyst.ts` (`syncLandings`) · `lib/landing-token.ts` (`selDe`)

Tres revisores sobre los cuatro commits del día. Dieron 16 hallazgos: 1 alto (la pastilla tapaba
«Publicar», ver hallazgos-ui.md), 8 medios y 7 bajos. Lo arreglado tiene su test y cada test se
probó rompiéndolo (commit `1120ba01`):

- **«Atrasada» y «no graba» son dos umbrales.** El WhatsApp de «quedó viejo» calculaba «por eso
  no graban las visitas» con la versión MÁS BAJA de la lista y lo aplicaba a toda la lista: lo
  decía de una página en la v21, que graba. Va a pasar en cada subida de versión. Se dice sólo si
  es verdad para CADA página nombrada, y una versión desconocida no autoriza nada.
- **Un efecto que mide un nodo depende de TODO lo que lo monta.** El marco del mapa espera a los
  toques y la foto llega por otro pedido. Con el efecto colgado de `[fondo]`, si la foto llegaba
  primero nadie medía el panel, y la computadora se dibujaba a tamaño real, cortada. Ahora se
  mide con una ref de función. Es la regla del popover de AGENTS.md, en otra pantalla.
- **Congelar `vh` sobre la hoja cruda reescribe los SELECTORES.** `.h-\[50vh\]` pasaba a
  `.h-\[400px\]` y su regla desaparecía de la foto. Se tocan sólo los bloques de declaraciones.
- **Filtrar después del tope es filtrar otra cosa.** El fondo traía las 200 sesiones más nuevas de
  TODO el negocio y recién ahí buscaba la página, así que a una página con poco tráfico le decía
  «no hay grabación». Ahora el `ilike` trae candidatos y `norm` decide.
- **Un selector que no llega a un ancla no identifica nada.** A más de 8 niveles sin un id, el
  Pixel mandaba el sufijo, y con el botón repetido de Elementor `querySelector` daba el primero:
  todos los toques del segundo se dibujaban sobre el primero y el ranking los fundía. El snippet
  dejó de mandarlo **sin subir la versión** (no cambia lo que mide) y `selAnclado` lo corta en el
  server para las páginas que ya tienen pegada la v22.
- **Una fila 'pendiente' reciente es un análisis EN CURSO.** «Buscar mis páginas» la tomaba como
  un fallo y la misma página se analizaba dos veces, pagando dos veces la IA.

⚠️ **SIN HACER (medidos por la revisión, no arreglados):**
- ~~**El aviso fijo decide con el setting donde gana el último evento**~~ — **resuelto el mismo
  día** (`f229d313`): ver «El aviso del Pixel esperaba una VISITA…», abajo.
- **El aviso fijo no mira si el Pixel sigue vivo.** Una landing dada de baja con una v18 deja la
  pastilla para siempre. El WhatsApp sí exige tracking de menos de 48 h.
- **Quitar el diagnóstico de una página declarada no dura:** el cron horario lo rehace y gasta
  otro análisis. Hace falta decidir qué significa «quitar» para una página que sigue en el Pixel.
- Un clic sintético o de teclado con la página scrolleada SÍ manda ancla (en la esquina del
  botón). Lo distinguen `ev.isTrusted` y `ev.detail === 0`.
- El fondo prueba 12 grabaciones sin mirar el dispositivo, y en una página casi toda de celular
  la computadora dice «no hay grabación». La versión del Pixel de la página sale de
  `verificarPagina`, que compara CON el query. Un fallo de `/mapa/fondo` se muestra como «no hay
  grabación».
- `htmlDeFoto` se puede saltear con una grabación armada a mano. Lo frena sólo el `sandbox` del
  iframe, que es el candado que importa.
- La lista dice «REVISANDO» en un análisis cortado, y en un negocio pausado o sin token nada
  barre la fila 'pendiente'.

*2026-10-06*

### El aviso del Pixel esperaba una VISITA para enterarse de algo que se podía LEER

**Vive en:** `lib/pixel-aviso.ts` (`versionEnHtml`, `veredictoPixel`, el mapa por página) ·
`lib/pixel-servido.ts` · `lib/pixel-estado.ts` · `app/api/track/vsl/route.ts` (el mapa) ·
`app/api/integraciones/landing/version/route.ts` · `app/integraciones/page.tsx` ·
`app/api/cron/tracking-vigilante/route.ts` · `lib/landing-token.ts` (el diagnóstico)

**Síntoma (06/10/2026, Martín, con la captura de Lovable):** «Ya publiqué y sigue apareciendo que
falta publicar el pixel». La página servía `var SV = 22;` —medido con un `fetch` del HTML, con y
sin `www`— y el aviso fijo y el chip del modal seguían diciendo «Actualiza el Pixel».

**Causa:** la versión del Pixel sólo se enteraba por las VISITAS. El beacon anota la versión que
trae cada evento, y la última visita (15:46 UTC) era anterior a la publicación: hasta que entra
alguien con el código nuevo, el número no cambia. Y era UNA versión para todo el workspace,
escrita por el último evento, así que con dos páginas en versiones distintas el aviso se
prendía y se apagaba solo (la revisión de la mañana lo había dejado como pendiente).

⚠️ **El diagnóstico obvio era «falta que pase un rato»** — y es cierto que se arreglaba solo con
la próxima visita. Pero eso es exactamente lo que el aviso NO puede decir: la persona acaba de
hacer lo que se le pidió y la pantalla le contesta que no. **Si el hecho se puede leer en la
fuente, se lee; no se espera al próximo evento para enterarse.** Es la regla de AGENTS.md («el
razonamiento "ya les llega el aviso" se mide contra lo que SIRVEN las páginas») aplicada al
propio aviso.

**Lo hecho:**
- **La versión se lleva por PÁGINA**: el beacon anota cada pageview en un mapa aparte
  (`landing.snippet_versiones`, con techo de 30 porque lo escribe un endpoint público). El
  setting viejo se queda: lo leen el pulso, la API y el diagnóstico.
- **Cuando las visitas dicen «viejo», se mira lo que la página SIRVE** (`versionServida`), con
  las barandas del análisis de landings y un plazo propio de 5 s. Si hay dos copias del código
  pegadas, gana la vieja. Sin nuestro endpoint en el HTML, no se concluye nada (puede entrar por
  un administrador de etiquetas) y manda la visita.
- **Caché asimétrico**: «al día» 10 minutos, «viejo» o «no pude leer» 30 segundos. Con 10
  minutos para todo, quien vuelve a MaKo justo después de republicar seguiría viendo el aviso —
  que es el reporte.
- **El aviso, el chip del modal, el WhatsApp de «quedó viejo» y «Comprobar»** miran lo mismo.
  El WhatsApp no nombra una página que ya sirve el código actual, y si todas ya lo sirven no
  manda nada.

Medido contra producción (sólo lectura): el ws1 pasa a «al día, v22, fuente: página». Los ws 4
(sin páginas declaradas), 11, 13 y 14 siguen viejos, que es verdad. Las dos páginas del ws13 y
una del ws11 dan «fuente: negocio»: su HTML no trae el código (o no se pudo leer en 5 s), así que
deciden sus visitas, y el mapa por página se va a llenar con los próximos pageviews.

⚠️ **SIN HACER:** el aviso todavía no mira si el Pixel sigue VIVO — una landing dada de baja con
una v18 deja la pastilla para siempre (ver la entrada de la revisión, arriba).

*2026-10-06*

### La grabación de las visitas ya no se apaga

**Vive en:** `lib/replay-contrato.ts` (`ReplayConfig`, `grabaA`) · `lib/replay-ficha.ts` ·
`app/integraciones/IntegracionesBoard.tsx`

Decisión de Martín (06/10/2026), textual: **«elimina lo de "Grabar las visitas" eso por default debe
estar siempre activado»**. El interruptor había nacido esa misma mañana, apagado por default.

- **Se sacó el CAMPO, no sólo la pantalla.** Dejar `activo` en true para siempre era un
  interruptor que miente; sacándolo del tipo, el compilador listó los siete lugares que lo
  miraban, y todos eran casos que ya no pueden pasar: el motivo «apagado» de la ficha (con su
  link), el descarte «apagado» de la ingesta, el renglón de apagada del chequeo de la prueba, el
  aviso de la prueba que sólo prometía la grabación si estaba prendida, el cron que avisa de la
  grabación lista y el «no graban» del WhatsApp.
- **Lo guardado se ignora**: los ws 1, 11, 13 y 14 tenían `activo: true` y siguen igual; los cinco
  con token y sin fila (4, 9, 10, 15 y 17) pasan a grabar en cuanto su página tenga un Pixel v21+
  — hoy el único en esa condición es el ws4.
- **El muestreo y la retención siguen siendo perillas**, sin pantalla: el muestreo es la salida
  para un cliente con una avalancha de tráfico, sin desplegar.

*2026-10-06*

### La grabación de una prueba se MIRA con un lead PRUEBA, no sacando el reproductor del CRM

El commit anterior dejó esto escrito como lo que NO quedaba: la prueba del Pixel podía
AFIRMAR que grabó y no llevaba a ningún lado, porque el reproductor de rrweb vive en la
ficha del lead (`app/crm/lead-view/GrabacionModal.tsx`, 180 líneas con su modal, su huso
horario y su server action) y una prueba no tiene lead. La salida obvia —extraer el modal
del CRM— es la que NO se tomó: Martín pidió la otra, «que simplemente se cree un lead de
PRUEBA en el CRM en ese producto», y es mejor, porque reusa el reproductor que ya existe en
vez de montar un segundo lugar donde el mismo cuerpo se dibuja.

**Lo que hace que funcione, y las cuatro cosas que no se ven:**

- **La PÁGINA la dice la GRABACIÓN, no la pantalla.** `replay_sesiones` guarda `visitor_id`
  y `landing_url`, así que el lead sale de la sesión y no del selector. Leyendo la landing
  elegida, cambiar de página entre hacer la prueba y apretar el botón mandaría el lead al
  producto equivocado **con el visitante correcto**: la grabación se vería igual, en el
  tablero de otro producto, sin un solo error.
- **UN lead por producto y se REUSA:** al PRUEBA que ya existe se le repunta el
  `visitor_id` a la grabación nueva. Es la diferencia entre una fila que se borra cuando
  moleste y un tablero que se llena de PRUEBAS, una por click. Y se busca por nombre **Y**
  producto: el PRUEBA de A tiene que seguir en el tablero de A.
- **El embudo del negocio se pregunta con `.is('funnel_id', null)`.** `.eq('funnel_id',
  null)` en Postgres no matchea nada (`= NULL` es NULL, no true), así que la búsqueda de
  «¿ya existe?» daría vacío **siempre** y crearía una fila por click, sin error.
- **Y nace con su propio `origen_lead: 'prueba'`.** `landing` sería mentir —nadie llenó un
  formulario— y NULL es el tacho que `app/crm/origen-lead.ts` vino a cerrar. Es la QUINTA
  alta del repo y el guard de ese catálogo subió de 4 a 5 con el motivo escrito, que es la
  decisión que su propio comentario pedía.

**Lo que quedó SIN hacer:** el botón aparece sólo con la grabación LISTA. Con el cuerpo sin
sellar (hasta 10 minutos) la ficha se abriría con la sesión en la lista y sin nada que
reproducir — se dice cuánto falta y el botón aparece solo, pero no hay nada que avise
cuando llegó: hay que volver a la prueba.

**Vive en:** app/integraciones/prueba-lead-actions.ts · app/integraciones/ProbarTracking.tsx
(`verLaGrabacion`) · lib/replay-leer.ts (`replayDePrueba`) · app/crm/origen-lead.ts ·
*2026-10-06*

### ⚠️ Un alta que se REPARTE a N filas choca con su propio chequeo de duplicados

> ⚠️ **Reemplazado el 06/10/2026 (mig 0207).** El opt-in ya no crea N fichas: crea UN lead
> (su casa es el primer producto) y agrega los otros como filas de `lead_funnel`
> (`agregarAProducto`), así que en su código ya no queda ningún `permitirDuplicado`. Lo de abajo
> describe el código anterior; la regla general sigue valiendo para un alta que de verdad
> necesite N filas. Ver `docs/hallazgos-crm.md` → «Un lead en VARIOS productos».

Decisión de Martín el 06/10/2026 sobre el Pixel: una landing puede vender VARIOS productos
y **«el lead entra a TODOS»**. Un lead vive en UN embudo —`leads.funnel_id` es una columna—
así que «entra a los tres» no puede ser una fila: son TRES fichas de la misma persona, una
por tablero, cada una moviéndose por sus etapas.

**La trampa, y es la que no se ve leyendo el fan-out:** `createLead` corre
`duplicadosDeLead` por nombre, email y teléfono. La PRIMERA ficha entra; la SEGUNDA
**encuentra a la primera** y tira `LeadDuplicadoError`. Y en el opt-in un alta que falla cae
a propuesta, así que el reparto dejaría a la persona esperando un click que nadie sabe que
hay que dar — justo el agujero que la bandeja `/crm/revisar` vino a cerrar. Las extras van
con `permitirDuplicado: true`, y se puede porque el duplicado **ya se chequeó arriba**,
contra el CRM entero.

La regla general: **cuando una función empieza a crear N filas de la misma entidad, su
propio chequeo de duplicados pasa a ser el obstáculo.** Se chequea UNA vez afuera del bucle
y adentro se declara que ya está chequeado.

**Y las otras tres decisiones del reparto:**

- **Cada extra es best-effort, con su propio `try`.** Si falla una, la persona YA está en el
  CRM: caer a propuesta ahí crearía un borrador de alguien que ya entró. Se registra con el
  producto que falló y se sigue — lo que se pierde es una ficha secundaria, no el lead.
- **La lista de embudos NUNCA vuelve vacía** (`funnelsDeLanding` → `[null]` en sus cuatro
  caminos). Es la mitad del contrato que no se ve en el tipo: quien llama crea una ficha por
  elemento, así que una lista vacía haría que el opt-in **no cree ningún lead**. Perder a la
  persona es infinitamente peor que ponerla en el embudo equivocado.
- **La campaña asignada sigue mandando, y manda a UNO.** Asignar una campaña a un producto
  es decir a qué producto van sus leads, no a cuáles: una landing con tres productos no
  amplía eso.

**Y el campo pasó de `funnelId` a `funnelIds`, con lo que eso arregla de paso:** con un solo
producto, lo que DESASIGNABA era un `0` centinela (porque `undefined` es «no lo toques»).
Una lista vacía dice lo mismo sin inventar un valor que significa otra cosa. `parsearConfig`
sigue leyendo el formato de uno solo — medido el 06/10/2026, ninguna de las seis páginas
declaradas en los cuatro workspaces con `landing.config` tiene producto asignado, así que
hoy no arregla ninguna fila; entre medir y desplegar hay un rato y lo que se perdería es a
qué CRM entran los leads de esa página, en silencio.

**Lo que quedó SIN hacer:** el camino del DUPLICADO sigue sin llevar el producto (ninguno),
que ya estaba anotado — `FilaImport` no declara `funnel_id`. Con varios productos eso es lo
mismo de antes, no algo nuevo: el duplicado lo decide una persona mirando el CRM.

**Verificado en un navegador** a las 05:16:43Z del 06/10/2026, y costó dar vueltas: el dev
server de este directorio lo tenía una sesión vecina y el guard de Next es por DIRECTORIO,
así que se verificó contra el worktree de OTRA sesión (`C:\Users\marti\wtf`, puerto 3122),
que ya tenía el commit adentro. Los cuatro pasos salen en orden —página · **producto** ·
código · prueba—, el paso 2 dibuja sus casillas con «El CRM de tu negocio» en el embudo por
defecto y el renglón de «sin marcar ninguno», y cero errores de consola. **No se clickeó
ninguna casilla a propósito:** guardar escribe `landing.config` del ws1, que es un cliente
real. Las vueltas quedaron escritas en `hallazgos-infra.md` → «el worktree para tener dev
server propio».

⚠️ Y la primera corrida mintió por una razón que vale para cualquier pantalla con server
actions: la captura salió con **«Buscando tus productos…»**, que es un estado legítimo, y el
guard lo habría leído como «el paso no dibuja nada». Se espera a que el cargando DESAPAREZCA,
no un `waitForTimeout`.

**Vive en:** lib/landing-config.ts (`funnelIds`, `idsDeFila`) · lib/landing-funnel.ts
(`funnelsDeLanding`, `funnelPrincipalDeLanding`) · app/api/track/optin/route.ts ·
app/integraciones/AsignarProducto.tsx · *2026-10-06*

### ⚠️ Una grabación sin sellar NO es un sellado roto: el cron corre cada 10 minutos

**Síntoma / el casi-reporte.** Al revisar si el replay propio estaba al 100%, la foto de
producción daba esto: dos sesiones en `replay_sesiones`, las dos con `sellada_at` en null,
`storage_path` en null, **`eventos: 0`**, ocho filas vivas en `replay_lotes` —el buffer que
se borra al sellar— y **cero objetos en el bucket `replays`**. Leído de una, eso es
exactamente la forma de «el grabador anda, el receptor anda, y el sellado no existe»: la
cadena cortada en el único paso que convierte una grabación en algo que se puede mirar.

**Y era falso.** Las sesiones tenían **4 y 7 minutos de vida**, y `/api/cron/replay-purga`
—que es quien sella— corre `*/10 * * * *`. Medido doce minutos después, sin tocar una línea:
`sellada_at` puesto a las 03:40:06, `storage_path` sí, **82 eventos**, 1 objeto en el bucket
y los lotes de esa sesión borrados. El pipeline estaba entero.

**Por qué engaña tanto, y es lo que hay que recordar:** el índice se escribe en la INGESTA
(cuando llega el primer lote) y se COMPLETA en el sellado. O sea que una sesión recién
grabada tiene fila con `eventos: 0` y sin cuerpo —un estado legítimo que dura hasta 10
minutos— y se ve idéntica a una que nunca se va a sellar. `eventos: 0` no es «no grabó
nada»: es «todavía no se contó».

**La regla: antes de llamar rota a una etapa que dispara un cron, restá la hora.** Si lo
medido es más nuevo que el período del cron, la única lectura honesta es «pendiente», y la
medición se repite pasado un tick. Es la misma familia que «un reporte sobre el árbol se
FECHA o no se entiende», aplicada a un pipeline asincrónico.

**Y el corolario del que verifica:** la segunda medición tiene que traer el RELOJ al lado
del dato. La primera relectura de este caso se corrió a los 40 segundos de la primera y dio
igual —obvio—, y eso casi se lee como confirmación. Lo que la cerró fue imprimir
`new Date().toISOString()` junto a cada `fin_at`.

**Lo que quedó SIN hacer:** una sesión HUÉRFANA —la que cerró el navegador de golpe y nunca
mandó `fin_at`— sigue con sus lotes esperando la ventana del barrido; medida acá, la segunda
sesión quedó así. No es un bug (el cron lo contempla), pero no hay ninguna pantalla que
distinga «esperando su ventana» de «se perdió», y la única forma de saberlo hoy es consultar
la base.

**Vive en:** app/api/cron/replay-purga/route.ts · lib/replay-ingesta.ts (`sellarPendientes`,
`barrerLotesHuerfanos`) · lib/replay-leer.ts · supabase/migrations/0191_replay_de_sesion.sql ·
*2026-10-06, revisión del reemplazo de Clarity*

### La prueba del Pixel mide su PROPIA grabación, y ya no nombra a Clarity

El probador tenía un link «Ver la grabación de esta prueba en Clarity →» y una advertencia
de que tardaba entre 30 minutos y 2 horas. Con el replay propio eso sobra: el marcador
`?mko_test=…` ya viaja en la URL y el grabador lo guarda en `replay_sesiones.prueba`, así
que la prueba puede CONTESTAR si se grabó en vez de mandar a buscarla afuera.

Queda como un chequeo más de la misma lista —no como un bloque aparte— porque la pantalla ya
sabe contar cuántos aplican, y un panel propio sería un segundo lugar donde el mismo
diagnóstico puede decir otra cosa. Y tiene **tres** respuestas, no dos: con la grabación
apagada en ese espacio `na` («no se grabó porque nadie lo pidió», y marcarlo en rojo mandaría
a repegar un código perfecto), `falta` si no llegó, y `ok` si llegó — diciendo en el detalle
si ya se puede ver o si todavía se está guardando, que es un estado normal de hasta 10
minutos y no un error.

**Lo que quedó SIN hacer:** desde la prueba no se puede VER la grabación. El reproductor vive
en la ficha del lead (`app/crm/lead-view/GrabacionModal.tsx`, 180 líneas) y una prueba no
tiene lead; ofrecer un botón que no lleva a ningún lado es peor que no ofrecerlo. Para que
exista ahí hay que sacar ese modal del CRM, y arrastra `useTzWorkspace` y su server action.

**Vive en:** app/integraciones/ProbarTracking.tsx · app/api/integraciones/landing/estado/route.ts
(`chequeoGrabacion`) · lib/replay-leer.ts (`replayDePrueba`) · *2026-10-06*

## La analítica POR PÁGINA del Pixel: lo que ya estaba medido y no miraba nadie

**Vive en:** `lib/landing-pulso.ts` (puro, con test) · `lib/landing-pulso-server.ts` (la
lectura) · `app/api/landing-analyst/pulso/route.ts` · `app/landing-analyst/PulsoPaginas.tsx`
(la vista «Lo que mide tu Pixel» de Landing Analyst) · `tests/landing-pulso.test.ts`

Corrida del 05/10/2026. El pedido fue «una pantalla con el mapa de calor y los gráficos que
mide el Pixel, dentro de Landing Analyst». Se construyó la mitad que NO necesita tocar el
Pixel: profundidad de scroll y clics por destino, por página. El mapa de calor de PUNTOS
sigue sin poderse hacer — ver «Lo que quedó sin hacer», abajo.

### ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: `vsl_events` SÍ dice de qué página vino cada evento

El relevo de entrada decía que `vsl_events` tiene `(visitor_id, tipo_evento, porcentaje,
segundos, video_id, detalle)`, y de ahí sale una conclusión razonable y falsa: que los clics
y el scroll hay que atribuirlos **por visitante** (como hace `getComportamiento` con la
retención del VSL, que lo documenta: «`vsl_events` no guarda a qué página pertenece el
evento»). Ese comentario quedó viejo: la **mig 0137** le agregó `landing_url`, y el snippet
la manda en CADA evento desde la v12 (`enviar()` en `lib/landing-token.ts`: «LA PÁGINA VIAJA
EN CADA EVENTO, no solo en la visita»).

O sea que la atribución por página es DIRECTA y no hay ambigüedad que avisar. Lo que sí hay
es el caso de los eventos viejos:

- **Un evento con `landing_url` NULL no se reparte entre las páginas.** Son los de un Pixel
  anterior a la v12 y nunca van a traer otra cosa. `landingDiagnostico` los DEJA PASAR a
  propósito —allá la pregunta es «¿anda mi Pixel?» y descartarlos pintaría en rojo a quien
  sólo lo tiene viejo— y acá la pregunta es «¿en CUÁL de mis páginas?», donde repartirlos
  sería inventar. Se cuentan aparte (`eventosSinPagina`) y la pantalla ofrece repegarlo.
- **La regla que generaliza:** antes de escribir que una tabla «no tiene» una columna,
  mirá las migraciones POSTERIORES al comentario que lo afirma. Un comentario describe el
  mundo del día en que se escribió, y acá el que mentía tenía tres meses.

### El denominador de la profundidad NO son los visitantes

El scroll llegó en el **snippet v19** (`NOVEDADES[19]` en `lib/landing-token.ts`), y el
snippet va PEGADO en la página del cliente: quien no lo repegó no manda un solo evento de
scroll. Dividir los hitos por `visitantes` daría «el 0,2% llega a tu oferta» sobre una
página que nadie está midiendo — una conclusión sobre un agujero de instrumentación, que es
la falla que `lib/vsl-retencion.ts` trata como innegociable.

`profundidadDe()` devuelve **null con cero personas medidas** (nunca una barra en 0%) y
`base` viaja al lado de `visitantes` para que la pantalla muestre el hueco: «Medido en 7 de
las 1.204 personas que entraron». Y el vacío tiene TRES textos distintos, porque son tres
problemas con tres arreglos: no hay Pixel (`instalada === 0`), el Pixel es anterior a la
v19, o está al día y todavía no llegó nada.

### El sello del constructor no era sólo un problema de la ficha de un lead

`esClicDelConstructor` (`lib/clic-ruido.ts`) existía con **un solo call site** (el lector de
eventos de `lib/leads.ts`), y su propia medición dice que en el ws de prueba eran **208 de
441 clics**. Sin llamarlo desde la vista agregada, el botón más tocado de cualquier landing
hecha con un constructor es «Edit with Lovable». Se filtra al LEER —el evento queda en la
base— y la pantalla DICE cuántos descartó, para que la lista no parezca incompleta por
magia.

### Dos consultas y no un `.in()`: el índice de los clics es PARCIAL

`idx_vsl_events_click` (mig 0133) es `on vsl_events (workspace_id, created_at desc) where
tipo_evento = 'click'`. Un `.in('tipo_evento', ['click','scroll'])` **no lo usa**: son dos
lecturas separadas (`eq`), la del scroll apoyada en `idx_vsl_events_ws_created` (mig 0121).

Y las dos van por `leerPorPaginas` (`lib/supabase-paginado.ts`), barriendo por `id`:
`vsl_events` pasa las 75.000 filas en un workspace y un `.select()` suelto topea en 1000 sin
avisar.

⚠️ **`landing_visits` no se puede filtrar por página en la base.** El beacon guarda
`location.href` con sus utm, así que la comparación es NORMALIZADA y en memoria
(`normalizarUrl`). De ahí dos cosas: la ventana (`PULSO_DIAS = 90`) es lo único que acota
esa lectura, y es **una pasada por tabla para TODAS las páginas** — leerla una vez por
página multiplicaría el barrido por el selector.

### El `server-only` partió el módulo en dos, y la pantalla lo obligaba igual

Se escribió todo en un `lib/landing-pulso.ts` con `server-only`, y falló por los DOS lados a
la vez:

1. El test no puede importar nada de un módulo con `server-only` (`Error: This module cannot
   be imported from a Client Component module`), así que la parte que se puede equivocar
   —partir el `detalle` de un clic, agrupar por destino, leer la profundidad— quedaba sin red.
2. Y la PANTALLA (`'use client'`) necesita las constantes de versión del Pixel para explicar
   un bloque vacío. Importar un VALOR de un módulo `server-only` desde un cliente rompe el
   build, y lo caza `tests/frontera-use-client.test.ts`.

Quedó el reparto de la casa: el contrato y lo puro en `lib/landing-pulso.ts` **sin**
`server-only`, la lectura en `lib/landing-pulso-server.ts` **con**. Un guard del test fija
las dos mitades en las dos direcciones.

### GOTCHA del guard: `indexOf('\n}')` cierra el TIPO de las props, no el componente

Un guard que recortaba el bloque de un componente con `UI.slice(i, UI.indexOf('\n}', i))`
daba «`Profundidad` dejó de mirar si su lectura falló» sobre código que SÍ miraba: en

```tsx
function Profundidad({ pag, pixel, falla }: {
  …
}) {
  if (falla) return <NoSePudo … />;
```

el primer `\n}` es el que cierra el **tipo de las props** (`}) {`), así que el recorte
terminaba antes de la primera línea del cuerpo. Es la misma familia que «el bloque es su
cierre real, nunca un número de caracteres»: ahora se corta en la declaración siguiente
(`/\n(?:export )?function /`) y se **afirma el largo** del recorte.

### Lo que quedó SIN hacer

- **El mapa de calor de PUNTOS no se puede hacer todavía.** El snippet manda
  `{ tipo_evento: 'click', detalle }` y `detalle` es el destino o el texto del botón
  (mig 0133): **no hay coordenadas**. Para pintar dónde se hace clic hacen falta el `x`/`y`
  y el tamaño del viewport, y eso es tocar el snippet (`lib/landing-token.ts` ~2377) + una
  columna, o sea que **el cliente tiene que repegar el Pixel** para que empiece a medir.
- **La pantalla no se verificó en el navegador** (sólo typecheck + 19 tests + los guards del
  repo). El riesgo vivo es visual: la vista nueva monta `Barras`/`Cifra` de
  `app/admin/dev/pricing/Piezas.tsx` y el `Select` de `app/_ui`.
- **`npm run build` no se corrió**, y hay una ruta nueva (`/api/landing-analyst/pulso`): el
  typecheck sólo valida los tipos generados de rutas si `.next/types` está fresco.
- **La ventana de 90 días no es configurable desde la pantalla.** El endpoint ya acepta
  `?dias=` (1 a 365); falta el control.

## La página de GRACIAS pasa a Ganado — y la visita no prueba la compra (07/10/2026)

**Vive en:** `lib/landing-gracias.ts` (`alVisitarPagina`, `ganarPorGracias`) ·
`lib/landing-gracias-reglas.ts` (con test) · `lib/landing-config.ts` (`gracias`) ·
`app/api/track/vsl/route.ts` (el pageview) · `app/integraciones/AsignarProducto.tsx` (el
interruptor, en el paso 2 del Pixel)

Pedido de Martín, por el chat de Customer Success: «automatice mediante el pixel de MaKo que si
alguien cae en una TKY Page, se pueda automatizar pasar al lead a Ganado directamente, así por
ejemplo, si alguien tiene compra carrito o lo que sea... y a su vez si se tiene activado la
invitación del curso automático, que sea todo automático».

⚠️ **LA VISITA NO PRUEBA LA COMPRA.** Quien tenga la URL de la página de gracias la abre sin pagar
—y el beacon es público: cualquiera con el token puede mandar un pageview con esa URL—, y con la
invitación al curso prendida eso le da el curso. Es la regla que se pidió y nace APAGADA; lo que la
hace segura es que la URL no se publique (la plataforma de pago redirige ahí después de cobrar). La
salida robusta es el webhook de la plataforma de pago (Hotmart, Stripe), que dice quién pagó: no
existe todavía.

- **A quién es la visita lo dice el `visitor_id`, que es la cookie del NAVEGADOR, no de la persona.**
  Sin lead no se crea uno (sería una venta sin nadie a quien atribuirla); con DOS no se elige (dos
  opt-ins desde la misma computadora). Las dos visitas quedan escritas sin datos de la persona
  (`landing.gracias_rechazos`, con tope y sin contar las recargas) y la pantalla dice «N visitas sin
  ficha»: sin eso, «no hace nada» y «llegó gente que nunca dejó sus datos» se ven igual.
- **Gana por los MISMOS caminos que el tablero**: `setPipelineStage` en la casa (con los requisitos
  salteados DICIÉNDOLO: la decisión del 17/09 es que mover no se bloquea, y el monto queda pendiente)
  y `moverEtapaEnProducto` en un agregado. Como los dos llaman al enganche «al ganar», la invitación
  al curso encadena sola (cuando el enganche esté desplegado: ver «La invitación al curso AL GANAR» en hallazgos-crm.md). No hay un segundo camino a Ganado.
- **Lo ya ganado no se mueve** (la casa se mira por `estado_lead`, no por la columna), así que
  recargar la página no re-dispara nada.
- ⚠️ **LA PÁGINA DE GRACIAS SE RECONOCE POR SU RUTA, NO POR LA URL ENTERA** (`paginaDeGracias`).
  `normalizarUrl` saca los parámetros de MEDICIÓN y deja el resto, y la plataforma de pago redirige
  con SU orden (`?transaction=…`), distinta en cada compra: la primera versión, desplegada con
  `landingDe`, no habría coincidido NUNCA. Lo encontró el relevo de Customer Success leyendo el
  código, un rato después del deploy (apagado para todos, así que no le pegó a nadie).
- ⚠️ **Y EL `visitor_id` ES DEL DOMINIO.** Es una cookie host-only: si el checkout devuelve a una
  página de gracias en OTRO dominio que la landing donde la persona dejó sus datos, la visita llega
  con otro `visitor_id` y queda como «sin ficha». La página de gracias tiene que vivir en el mismo
  dominio que la landing. Y un email que venga en la URL de gracias NO identifica: el beacon es
  público y cualquiera manda ese POST.
- **La vista previa del constructor y localhost no ganan a nadie**: es la misma regla que ya tenía la
  versión del snippet, ahora en una función (`esVistaDePrueba`) que usan los dos.
- **La marca se guarda sólo como `true` literal** y `conLanding` la trata como los productos
  (`undefined` = no la toques): guardar los productos de la página de gracias no la deja de ser.

Verificado en el ws4 de punta a punta (`alVisitarPagina` con un lead de prueba): una página común no
mueve, la de gracias lo deja ganado con su historial, la recarga no vuelve a moverlo y una visita sin
ficha queda anotada. Todo limpio después.

### Lo que quedó SIN hacer

- **Verificar la compra** (el webhook de la plataforma de pago), ver arriba.
- **La pantalla no se miró en el navegador**: el interruptor del paso 2 se verificó por typecheck y
  tests, no dibujado. Se intentó con un servidor local y no contestó (la máquina al 96% de CPU con
  varias sesiones; el CRM del ws1 tardó 7 minutos contra la base de producción).

_Hecho directo por la sesión de claude2 (`tests/landing-gracias.test.ts`, probado rompiéndolo: siete
roturas, las siete caen)._

---

## El píxel de Meta de MaKo en su propia landing (08/10/2026)

Para empezar a pautar MaKo hacía falta que la landing de venta (la raíz de hola-mako.com,
`app/vsl/Landing.tsx`) midiera: no tenía ningún píxel de Meta, así que un anuncio no podía
optimizar hacia la reunión agendada ni armar audiencias de quien visitó. Se creó el conjunto de
datos **«MaKo» (1869323014511830)** en el portafolio de Meta de MaKo y se instaló en la landing:
`PageView` al cargar y **`Schedule`** cuando Calendly avisa que se agendó (es la conversión de esa
página).

**No confundir con el Pixel de MaKo que se le da a los clientes** (`lib/landing-token.ts`): éste
es el de Meta, para los anuncios de MaKo mismo, y vive en `lib/meta-pixel-mako.ts`.

Tres decisiones que no se ven leyendo el componente:

- **Sólo mide en hola-mako.com** (`debeMedir`). En localhost y en los previews de Vercel cada
  visita de prueba entraría a las audiencias y a la optimización como un visitante real, y no hay
  forma de sacarla después.
- **La agenda se cree sólo si el `message` viene de `https://calendly.com`, comparado exacto.** Un
  `postMessage` lo puede mandar cualquier iframe; un `Schedule` falso le enseña a Meta a buscar a
  quien no agendó. Y uno solo por carga: Calendly puede repetir el mensaje.
- **El código base del píxel está escrito en TS**, no pegado como string: un snippet en un template
  literal es la familia de bugs de «el fuente y lo que se sirve no son el mismo texto».

La política de privacidad decía «no usamos Meta Pixel» y «MaKo no usa cookies de publicidad»: las
dos eran sobre la app y seguían siéndolo, pero leídas sueltas pasaban a ser falsas para la página
pública. Se corrigieron en el mismo commit.

**Verificado en producción el 08/10, y tres trampas de la verificación.** Las tres dicen «el
píxel no dispara» sobre un píxel que anda:

- **Meta no manda nada desde un Chrome headless.** Con el user agent `HeadlessChrome`, fbevents.js
  carga, baja la configuración del conjunto (`/signals/config/1869323014511830`) y registra el
  píxel (`fbq.getState().pixels` lo trae), y **no sale ningún `/tr`**: ni error ni aviso. El mismo
  navegador con un user agent normal manda `GET /tr/?id=1869323014511830&ev=PageView`. Sacar
  `navigator.webdriver` no cambia nada: decide el user agent. Para medir sin ensuciar las
  audiencias, una ruta de Playwright que ABORTA todo lo que va a `www.facebook.com` y anota la URL.
- **Una extensión del navegador puede definir `window.fbq` antes que nosotros**: medido un stub con
  `__phpro_patched`, `loaded: true` y la cola vacía. `cargarPixelMeta` hace lo mismo que el snippet
  oficial (si `fbq` ya existe, no carga nada), así que en ese navegador no sale nada y no hay
  error. A un visitante sin esa extensión no le pasa; a quien verifica desde su Chrome de todos los
  días, sí.
- **Una pestaña en segundo plano no corrió el efecto de la landing hasta que se pintó**:
  `document.hidden: true`, el HTML del server completo y `.vsl-root` sin fiber de React. Al sacar una
  captura (la pestaña se pinta) hidrató sola y el píxel se inicializó. Se reconoce porque el resto
  del MISMO efecto tampoco está: el título de «Cómo funciona» sigue siendo el del HTML y
  `#cal-embed` no tiene `data-cal-init`. Si eso falta, no es el píxel. Es la familia de «una
  pestaña CDP puede no hidratar».

**Lo que quedó sin hacer:** la API de Conversiones (eventos desde el servidor) para la propia
landing; las páginas de cada función (`/vsl/<slug>`) no cargan el píxel; y la opción de Meta
«conectar a la API de conversiones con Meta» se dejó apagada al crear el conjunto de datos (comparte
más datos y suma condiciones: se prende cuando haga falta).

**Vive en:** lib/meta-pixel-mako.ts · app/vsl/Landing.tsx · app/privacidad/page.tsx ·
tests/meta-pixel-mako.test.ts · *2026-10-08 publicitar-mako*

---

## La portada viajaba VACÍA para quien no ejecuta JavaScript (08/10/2026)

**Síntoma.** Meta rechazó la verificación del negocio por segunda vez con «la razón social debe
aparecer en el sitio web», con el nombre YA publicado en el pie de hola-mako.com. `curl` lo
encontraba en el HTML (byte ~180.000), el user agent de Meta recibía 200, y los logs de Vercel
mostraban que Meta había leído justo esa versión. Todo decía «está».

**Causa.** Estaba, pero OCULTO. El layout raíz envuelve toda la app en un
`<Suspense fallback={null}>` (app/layout.tsx, por el `useSearchParams` del `WsProvider`), y
React **escribe aparte, dentro de un `<div hidden id="S:0">`, todo bloque de Suspense que pase
los 12.800 bytes, aunque ya esté listo**; un script lo inserta cuando corre JavaScript. La
landing pesa ~190 KB, así que el HTML de `/` traía un `<template id="B:0">` vacío y todo el
contenido escondido. Medido: con Chromium y JavaScript apagado, `body.innerText` de `/` = **0
caracteres**; con JavaScript, el nombre aparece a 10.155 px. `/privacidad` (93 KB) igual;
`/terminos` (62 KB) entra justo debajo del umbral y se ve.

**El diagnóstico obvio era el equivocado, dos veces.** Primero «la copia de Meta está vieja»
(el Depurador de contenido compartido decía «hace 3 horas»): era cierto y no era la causa,
porque el log muestra a Meta leyendo la versión nueva. Después «el nombre está en el HTML, así
que lo ve»: un `grep` encuentra texto oculto igual que el visible. **Lo que contesta es leer la
página como la lee alguien sin JavaScript**: sacar los `<div hidden id="S:…">` (cerrando por
profundidad, no con una regex) o abrirla en Chromium con `javaScriptEnabled: false`.

**El arreglo (portada).** La landing va en su PROPIO `<Suspense>` con un fallback que se ve
(`app/vsl/PortadaSinJs.tsx`): marca, título, la razón social y los enlaces legales. El bloque del
layout queda chico y sale visible; sin JavaScript se lee el fallback, y con JavaScript React lo
reemplaza por la landing (que trae la razón social en su pie). El fallback tiene que seguir
CHICO: si engorda hasta pasar el umbral, el bloque del layout lo pasa de nuevo y todo vuelve a
quedar oculto.

**Dos trampas para probarlo, medidas.** `renderToStaticMarkup` no reproduce nada (no hace
streaming). Y en streaming, React sólo saca bloques aparte cuando renderiza un DOCUMENTO: un
fragmento de 175 KB sale entero y visible; envuelto en `<html><body>`, sale oculto como en
producción. `tests/razon-social-sitio.test.ts` renderiza así y además exige que haya un segmento
oculto, para no dar verde el día que deje de reproducir la condición.

**Lo que quedó sin hacer.** `/privacidad` sigue llegando vacía sin JavaScript, y es la URL de
política que revisan Meta y Google. Partirla en bloques chicos NO sirve (medido: de 30 bloques
de 3 KB, 26 salen ocultos igual, porque el umbral se mide sobre lo ya escrito). El arreglo de
fondo es que `{children}` no viva adentro del Suspense del layout, y eso toca toda la app: hay
que probarlo con un `npm run build` en el clon (el `useSearchParams` sin Suspense rompe el build
en cualquier ruta estática).

**De paso, en la misma tanda:** `/robots.txt` no existía (el gate lo mandaba a `/login`): ahora
es `app/robots.ts`, público y sin `disallow`. Y la portada tiene su propia vista previa
(`/og-landing.jpg`): caía en la del layout, `/og-mako.jpg`, que es la de material compartido y
lo dice escrito en la imagen. El `openGraph` de una página REEMPLAZA al del layout, así que va
completo (`tests/portada-vista-previa.test.ts`).

**Vive en:** app/page.tsx · app/vsl/PortadaSinJs.tsx · app/vsl/Landing.tsx (`PieLegal`) ·
app/layout.tsx (el Suspense) · app/robots.ts · public/og-landing.jpg ·
tests/razon-social-sitio.test.ts · tests/portada-vista-previa.test.ts · *2026-10-08 publicitar-mako*

## La grabación de sesiones no grababa casi nada, ninguna se podía mirar, y la ficha inventaba el porqué (08/10/2026)

**Vive en:** `lib/replay-leer.ts` (`replayDeLead`) · `lib/replay-ficha.ts` (`motivoDelVacio`,
`textoDelVacio`, `tieneFoto`) · `app/crm/lead-view/GrabacionModal.tsx` + `GrabacionCard.tsx` ·
`public/replay/2/r.js` + `scripts/replay-envoltorio.js` + `scripts/replay-libs.mjs` ·
`lib/replay-contrato.ts` (`REPLAY_LIB_VERSION`) · `lib/replay-reproductor.ts`

Pedido de Martín, sobre la ficha del lead #2593 (ws1): «Porque esto aún no funciona... Si
literalmente dice en el historial que estuvo más de 10 segundos... Revisalo bien y hazlo funcionar.»
La ficha decía «No hay grabación suya: no volvió a entrar, o su visita duró menos de 10 segundos» sobre
una visita de 4 minutos.

⚠️ **ERAN TRES FALLAS CON EL MISMO SÍNTOMA, y la del caso que se veía no era el grabador.**

1. **La ficha mentía sobre ESE lead.** Su única visita (30/09) traía el Pixel v14, cinco días antes de
   que la página grabara. `replayDeLead` comparaba con `Math.max(versión de la visita, versión del
   negocio)` = 22, así que caía en «duró menos de 10 s». Regla: la versión del negocio (el último
   evento, de cualquier página) nunca entra en el veredicto de UNA visita: «¿qué trajo esa visita?» y
   «¿qué tiene hoy su página?» se contestan por separado, la segunda con `landing.snippet_versiones` y
   `clavePagina`. Ahora dice «Su visita es del 30/09, antes de que MaKo grabara tu página.», y ninguna
   frase afirma una duración que no se midió. Un `sv` null no es una versión, pero la FECHA contesta:
   nada antes del commit del grabador (05/10) pudo grabarse.
2. **El grabador perdía la foto.** Medido en ws1: de 150 visitantes con un Pixel que graba, 32 tenían
   sesión, y 0 de 35 que estuvieron 10-30 s. La foto inicial de la página (FullSnapshot) pesaba
   ~115 KB crudos —70 KB eran CSS inlineado—; si la persona se iba antes del primer lote periódico, el
   beacon la mandaba SIN comprimir, superaba los 64 KiB de `RBEACON_MAX` y se tiraba en silencio. Y
   quien mira el VSL (un iframe que no genera eventos) no llegaba a los 20 eventos del piso. La v2 del
   r.js envuelve `window.rrwebRecord`: hojas como link (`inlineStylesheet:false`, la foto baja a ~45 KB y
   entra en el beacon), un latido mientras la pestaña está visible, y una foto nueva al volver. Medido
   con el snippet v22 real en un navegador: con v1 ningún escenario dejaba fila; con v2, todos los de 10
   s o más. Y con la página real de ws1, la foto bajó de 116.400 B a 45.117 B.
3. **Ninguna grabación se pudo mirar nunca.** El UMD de rrweb-player 2.1.7 deja
   `window.rrwebPlayer = {Player, default}` (un objeto) y el cargador pedía una función: el pop-up decía
   «sin reproductor» siempre. Regla: un global de un UMD se verifica CARGANDO el bundle, no por el
   nombre. Y con la hoja como link, el reproductor tiene que sacar `crossorigin`/`integrity` de los
   `<link>` de Vite, o el CSS de los clientes de Lovable se bloquea por CORS.

⚠️ **«ARREGLAR EL GRABADOR ES SUBIR UN NÚMERO, SIN REPEGAR» ERA FALSO.** El lote, el piso, el beacon y
la cola viven en el snippet pegado en la página (`lib/landing-token.ts`); r.js sólo traía rrweb. Sin
repegar, sólo se puede tocar lo que el snippet llama: `rrwebRecord(opciones)` y el stop que devuelve.
Corregido en `lib/replay-contrato.ts`. Y una versión publicada del r.js es inmutable sólo si algo lo
hace cumplir: ahora cada una lleva su huella y el generador se niega a reescribirla.

- Una sesión sin foto (sin evento type 2) ya no abre un reproductor negro: dice que llegó sin la página.
- rrweb-player dibuja cada evento Custom como una marca en la barra: el latido va transparente.
- ⚠️ `addCustomEvent` TIRA después del stop: el envoltorio envuelve el stop y corta el latido.

### Lo que quedó SIN hacer

- **/lidermente (ws11) sigue sin foto**: pesa 630 KB crudos y 420 KB comprimida (418 KB son imágenes
  base64 en el HTML), más que los 256 KiB por lote. O la clienta sube las imágenes como archivos, o una
  v3 del envoltorio cambia los `data:` grandes por un hueco.
- **Las grabaciones v2 dependen del CSS vivo del cliente**: si redespliega en Lovable y desaparece el
  `/assets/index-*.css` viejo, la grabación vieja se ve sin estilo. Lo robusto es que el sellado
  (`lib/replay-ingesta.ts`) baje e incruste la hoja.
- **Sin verificar**: Safari de iOS y el navegador interno de Facebook/Instagram; la medición de
  regresión en producción (el tramo de 10-30 s tiene que salir del 0/35).
- **El snippet v23** (hay que repegar): el piso en tiempo visible, que esconder la pestaña no vacíe la
  cola, y la lógica del grabador adentro de r.js.
- ws13 (v18) y ws14 (v15) no graban hasta repegar; la ficha ahora lo dice con el link.

_Hecho por dos agentes en worktrees propios sobre un diagnóstico y una refutación medidos
(`tests/replay-ficha.test.ts`, diecisiete roturas; `tests/replay-envoltorio.test.ts`, trece; todas
caen)._
