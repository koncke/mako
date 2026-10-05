# Grabación de sesión: el contrato

**Fecha:** 5 de octubre de 2026 · **Pedido:** «Si arranca con todo lo de grabar la sesión.
Fijate de cómo solucionar el tema del almacenamiento.»

Esto es el contrato que siguen los tres paquetes que construyen el replay. El código vive
en **`lib/replay-contrato.ts`** (tipos, constantes y decisiones puras, sin `server-only`) y
la migración es **`supabase/migrations/0191_replay_de_sesion.sql`** — **sin aplicar**.

Los tres paquetes son: el **grabador** (pegado en la página de un tercero, no se puede
tocar después), el **receptor** (`/api/track/replay`) y el **reproductor** (dentro de MaKo).
No se ven entre sí, y un número distinto en cualquiera de los tres rompe al otro en
silencio. Por eso los números viven una vez.

---

## 1. El almacenamiento, que es lo que había que resolver

### La cuenta, con los datos de la base

Septiembre de 2026, el mes pico, los cuatro workspaces que miden (`landing_visits` y
`vsl_events`):

| ws | visitas | cierres | minutos sin tope | con tope de 10 min | sesiones de +10 min | sesiones de −10 s |
|---|---|---|---|---|---|---|
| 1 | 7.052 | 3.385 | 15.669 | 3.474 | 4,8 % | 32,4 % |
| 13 | 1.454 | 1.059 | 2.342 | 1.355 | 3,7 % | 28,5 % |
| 11 | 301 | 189 | 6.498 | 415 | 14,3 % | 46,6 % |
| 14 | 86 | 50 | 1.859 | 131 | 12,0 % | 10,0 % |
| **total** | **8.893** | **4.683** | **26.368** | **5.375** | | |

A los ~100 kB por minuto sin comprimir que genera rrweb:

- **5.375 min × 100 kB = 537 MB por mes en crudo**, todos los clientes de hoy juntos.
- Comprimido: entre 54 MB (10×) y **134 MB (4×)**. Se decide con el 4×, que es el que no
  puede fallar para el lado peligroso.
- Con 30 días de retención el régimen es un mes: **134 MB en total**. Los 100 GB de Storage
  que ya trae el plan Pro son **760 veces** eso.
- A 100 clientes (25× el tráfico de hoy): **3,4 GB** en régimen. Sigue adentro.

**La respuesta: el almacenamiento no es el problema.** Con 30 días de retención, 100
clientes entran en lo que ya está pagado. Lo que no tiene techo es dejarlo *sin* retención:
100 clientes × 12 meses son ~40 GB comprimidos y creciendo, y en el tercer año eso cruza
los 100 GB y empieza a facturar.

⚠️ **El ratio de compresión no está medido.** El 4×–10× es una estimación. Lo medido es el
crudo (dato de rrweb) y los minutos (de nuestra base). Se cierra midiendo el ratio una vez
en producción.

### Storage, no una tabla

El plan Pro trae **8 GB de base** y **100 GB de Storage**: doce veces más lugar, y el GB de
base es el caro de los dos. 537 MB por mes de cuerpos en una tabla se comerían el **7 % de
los 8 GB cada mes**, en la misma base donde viven los leads. Y rrweb recomienda comprimir
la sesión **entera** del lado del servidor: una sesión entera es un blob que se escribe una
vez y se lee de punta a punta, o sea un archivo.

Dos tablas y un bucket:

| | qué | cuánto vive |
|---|---|---|
| `replay_lotes` | el buffer caliente: una fila por lote mientras la persona está en la página | minutos; se **borra** al sellar |
| `replay_sesiones` | el índice: una fila de ~200 bytes por sesión | hasta que la purga la borre |
| bucket `replays` | el cuerpo: un objeto gzip por sesión | igual |

El bucket es **privado** y con `file_size_limit` explícito en 2 MiB, alineado con
`REPLAY_TOPE_BYTES`. La ruta es `<ws>/<YYYY-MM-DD>/<sesion>.jsonl.gz`: el workspace primero
(y el id validado antes de armarla, porque ahí escribe el service role y no hay RLS que
ataje un `../`), y el día adentro para que la purga pueda borrar por prefijo sin leer el
índice — un objeto cuya fila se perdió no aparece en ninguna consulta y queda pagándose
para siempre.

### Qué se guarda: antes de guardar, se decide

**No se graba todo.** Tres cortes, con sus números:

1. **El piso: nada por debajo de 10 segundos o 20 eventos.** El 32,4 % de las sesiones del
   ws 1 duran menos de 10 s (46,6 % en el ws 11). Son rebotes: una grabación de dos
   segundos no se puede mirar y ocupa una fila, un objeto y una llamada igual que una de
   diez minutos. El piso se aplica en **las dos puntas**: en el navegador para no gastar el
   request —lo único que de verdad se ahorra— y en el servidor al sellar, porque el reloj
   del navegador no es confiable.
2. **El tope: 10 minutos de grabación por sesión.** Corta el 4,8 % de las sesiones del
   workspace grande y ahorra el **80 % de los minutos** (26.368 → 5.375). Esas colas no son
   gente mirando: son pestañas olvidadas — el cierre más largo medido es de **124.055
   segundos, 34 horas**.
3. **El tope de bytes: 2 MiB comprimidos.** El tope de tiempo no acota los bytes: una
   página con un carrusel que se mueve solo tira megas por minuto y los 10 minutos la dejan
   pasar entera. Gana el que llegue primero, y el reproductor **tiene** que poder decir que
   la cortamos nosotros (`corte`), o afirma un abandono que no pasó.

⚠️ **El tope se mide en tiempo GRABADO, no en reloj de pared.** Es la trampa de estos
números: el promedio de `cierre.segundos` del ws 1 es 262 s y la mediana es **19 s**.
Dimensionar con el promedio da 14 veces de más, porque el promedio *es* la pestaña de 34
horas. Una pestaña escondida no genera eventos de rrweb, así que `Date.now() - inicio` le
comería el tope entero sin haber grabado nada.

**Muestrear: no, todavía.** Con 8.893 visitas en el mes pico el costo son centavos, y
muestrear regala justo las sesiones que alguien iba a mirar. La perilla existe
(`muestreo`, 0-100, default 100) para poder bajarla sin desplegar el día que un cliente
reciba una avalancha.

⚠️ **Y es determinista sobre el `visitor_id`, nunca `Math.random()`.** Con azar por página,
la misma persona entra al 30 % en la landing y queda afuera en la página de gracias: se
guarda media sesión, que muestra a alguien que se va y esconde que volvió.

**Guardar sólo las que convierten: no.** Se evaluó y se descarta con los números: en
septiembre, **45 de 5.919** visitantes agendaron y **41 de 155** leads del mes llevan
`visitor_id` — o sea que guardar sólo las que convierten dejaría 45 grabaciones de 8.893.
El problema no es el volumen: es que la razón para mirar un replay es ver por qué alguien
**no** convirtió. Quedarse con los que sí invierte el valor de la feature.

### La retención es parte del almacenamiento

- **30 días**, los mismos que Clarity, para que nada quede peor que hoy.
- **180 días si ese visitante se volvió un lead.** Es el agujero de Clarity que ya nos
  mordió: sus 30 días son los que hicieron falta para que existan el aviso
  `clarity-grabacion-por-vencer` y su cron, y el lead que entró hace tres semanas y recién
  ahora se está por cerrar es justo el que uno quiere mirar. Y es barato: **41 de 5.919**
  visitantes (0,7 %) terminaron con un lead, así que seis veces la retención sobre el 0,7 %
  del volumen es ~4 % más de disco.
- **No se decide al grabar: se decide al borrar.** Cuando la sesión se graba todavía no se
  sabe si esa persona va a dejar sus datos —el `visitor_id` se cose al lead después, por
  Calendly o por el Camino 1 del beacon—, así que guardar un vencimiento en la fila sería
  congelar una respuesta que todavía no existe.
- **La retención del workspace no puede acortar la del lead.** Alguien que se pone 7 días
  está bajando el ruido, no diciendo «tirá la grabación del lead que estoy por cerrar».
- **Una fecha ilegible NO se borra.** Borrar es irreversible: ante un dato que no se
  entiende, la respuesta segura es no tocar nada.

**Cómo se borra:** un cron diario, `/api/cron/replay-purga`, con el molde de
`app/api/cron/tracking-vigilante/route.ts` (`checkCronAuth` + `listarWorkspaces` +
`runWithWorkspace`) y su entrada en `vercel.json`. ⚠️ **Primero el objeto, después la
fila**: al revés queda un blob huérfano que nada nombra, y un bucket que no se puede
enumerar contra su índice es una factura sin nombre. El cron barre además
`replay_lotes` viejos: una sesión que nunca mandó su último lote (la persona cerró el
navegador de golpe) deja filas ahí para siempre si nadie las busca por fecha.

---

## 2. El formato y el protocolo

Un **POST por lote** a `/api/track/replay`, nunca un evento solo.

- **Cada 10 segundos o cada 100 eventos, el primero que llegue.** A ~100 kB/min un lote es
  ~17 kB. Con 5 s se duplican los requests para no ganar nada; con 30 s se pierden hasta
  30 s si el navegador se cierra de golpe. Los dos cortes juntos porque solo por tiempo una
  página con una animación manda un lote gigante, y solo por cantidad una página quieta no
  manda nada durante minutos.
- **Al salir, `sendBeacon`.** ⚠️ `navigator.sendBeacon` devuelve **`false`** cuando el
  cuerpo no entra en la cuota del documento (64 KiB), y ése es el único camino que sirve al
  irse de la página. `fetch(keepalive)` tiene la misma cuota de 64 KiB para todo el
  documento y **no avisa**: la promesa resuelve igual. El grabador tiene que mirar el
  `false` y tirar la cola, no fingir que salió. (El snippet actual usa
  `fetch(..., keepalive: true)` para el `cierre`; un lote de replay es cien veces más
  grande y no puede ir por ahí.)
- **La sesión es `rs_` + 16-32 de alfabeto de URL, en `sessionStorage`.** No en una cookie:
  una cookie haría que «la sesión» durase un año, y una sesión es una visita.
  `sessionStorage` sobrevive a navegar dentro de la pestaña —que es lo que hace un botón que
  lleva a otra página, y entonces la grabación sigue siendo la misma— y muere al cerrarla.
  Es la misma decisión que `mko_test` ya toma en el snippet.
- **La identidad no se inventa.** El lote viaja con `t` (el token público de landing) y
  `visitor_id` (la cookie `nqe_visitor_id`), exactamente como los manda `enviar()` en
  `lib/landing-token.ts`. Ese es el enganche que hace que la grabación aparezca en la ficha
  del lead: `leads.visitor_id` ya lo cose `stampVisitorOnLead` en
  `app/api/track/vsl/route.ts`.
- ⚠️ **El orden no se deduce de la llegada.** Cada lote lleva su `n` (0, 1, 2…) y es parte
  de la clave primaria. Un POST con `keepalive` y un `sendBeacon` salen sin esperar
  respuesta y el navegador los entrega cuando puede: el último lote puede llegar antes que
  el anterior, el reproductor necesita el flujo en orden, y la hora del servidor no lo dice.
  La clave `(ws, sesión, n)` da además idempotencia: el reintento de un lote no duplica.
- **Comprimir en el navegador: sí donde se pueda.** `CompressionStream('gzip')` ahorra la
  **subida del visitante**, que es el único tráfico que se siente (un celular con datos). El
  campo `z` dice si viene comprimido, así que el servidor nunca adivina; donde no exista, va
  crudo y el servidor comprime al sellar.
- **El interruptor viaja en la respuesta del `pageview` que el snippet ya manda**, no en un
  request nuevo. Cero llamadas extra, y el server es el único que decide: el código pegado
  en la página no decide nada, la misma regla que ya cumple el bloque de opt-in del snippet.

---

## 3. La privacidad, que es innegociable

Esto corre sobre los visitantes de los clientes **de nuestros clientes**, que nunca
aceptaron nada con nosotros. No hay un segundo intento: lo que se grabe mal ya está
grabado, y borrarlo después no deshace haberlo recibido.

⚠️ **`maskAllInputs` de rrweb viene en `false`.** De fábrica tapa el campo de contraseña y
nada más, o sea que manda el teléfono, el mail y el nombre que la persona está tecleando,
carácter por carácter, antes de que apriete enviar. Clarity los tapa en sus tres modos:
**el default de rrweb es peor que la herramienta que esto viene a reemplazar.**

`REPLAY_OPCIONES_RRWEB` arranca con `maskAllInputs: true` y no se negocia. Y tapar los
campos **no alcanza**: una pantalla de gracias que dice «te escribimos al 55…» no es un
input, así que va también `maskTextSelector`, para el texto ya dibujado.

La lista legible, en el código como `REPLAY_QUE_SE_GRABA`, para que alguien que no sabe qué
es rrweb pueda leer la decisión y discutirla:

**Sí se graba**

- La forma de la página: el texto, las imágenes y cómo se acomoda.
- El movimiento del mouse, el scroll y los toques en pantalla.
- Los clics, con el elemento que recibió cada uno.
- El tamaño de la ventana y los cambios de tamaño.
- La dirección de la página y el momento de cada cosa.

**No se graba**

- Lo que la persona escribe en cualquier campo: todo llega tapado.
- Los textos ya dibujados que son datos de una persona: teléfonos y correos.
- Lo que pasa adentro de un reproductor de video de otro dominio.
- Las cookies, el almacenamiento del sitio y las cabeceras de red.
- Cualquier elemento marcado con la clase de bloqueo (`mko-no-grabar`).

**Los precios sí se graban.** No son datos de una persona: están publicados. Y tapar un
precio deja la grabación sin la única cosa que explica por qué la persona se fue.

Las tres clases (`mko-tapar`, `mko-no-grabar`, `mko-sin-texto`) son constantes del contrato,
así que el grabador y este documento no pueden decir cosas distintas.

El VSL no se pierde: Clarity tampoco graba iframes de terceros, así que el video se ve como
un recuadro vacío **allá también**. Replicar no resigna nada de lo que hoy se tenga.

---

## 4. El tamaño del snippet

rrweb **no se inlinea** en los 96.880 bytes del snippet, que además se sirve sin minificar.
No es por el peso: es porque el snippet va pegado en la página del cliente y **nadie lo
vuelve a pegar**.

Medido el 05/10/2026: el workspace con 7.052 visitas en septiembre corre la versión **14**
del snippet y la actual es la **20**. La columna `clic_vacio`, que estrenó la v20, tiene
**cero filas en tres meses** en los cuatro workspaces que miden.

**Decisión: lo servimos nosotros, en una ruta versionada e inmutable:
`/replay/<REPLAY_LIB_VERSION>/r.js`.**

- **Por qué no un CDN público.** Un `<script>` de un tercero en la página de un cliente de
  nuestro cliente es un tercero que no controlamos leyendo su DOM — exactamente lo que la
  decisión de heatmaps rechazó de Clarity. Y el único argumento a favor, que se cachea entre
  sitios, **ya no existe**: los navegadores particionan la caché HTTP por sitio de primer
  nivel desde 2020.
- **Por qué versionada en la ruta.** Se puede cachear un año, y un arreglo es una ruta
  *nueva*: cambiar el contenido de una ruta ya cacheada en el navegador de un visitante es
  un cambio que llega cuando quiere, y encima pisa la versión que se probó.
- **Y es el arreglo del problema de arriba:** el loader vive en *nuestro* archivo, así que
  subir el grabador es subir un número — sin que nadie repegue nada.

---

## 5. El apagador

Vive en `app_settings`, con la clave **`landing.replay`**, igual que `landing.config` y
`landing_token`. Se lee con `parsearReplay()`, con el mismo molde tolerante que
`parsearConfig`: lo que no se entiende cae al default y nadie pierde su configuración.

```json
{ "activo": false, "muestreo": 100, "retencionDias": 30 }
```

⚠️ **Apagado por defecto, y esto no es prudencia: es la única postura defendible.** Un
sistema que graba personas no puede quedar encendido porque hubo un deploy — nadie en el
camino apretó un botón que diga «grabá». Y un parseo que falla hacia «grabá» es la peor
forma posible de fallar, así que sólo un `true` literal prende: ningún truthy alcanza.

⚠️ **Es por workspace, no por página**, y acá se separa de `landing.config` a propósito. El
id de proyecto de Clarity cuelga de la página porque un proyecto de Clarity es de un sitio.
«¿Grabamos a las personas?» no es una pregunta de una página: es del negocio. Un interruptor
por página es un interruptor con agujero — alguien agrega una landing el mes que viene y
queda grabando sin que nadie lo haya decidido.

---

## 6. Orden de despliegue

1. **La migración 0191** (agrega tablas y el bucket; va antes o junto con el deploy, o el
   receptor escribe en tablas que no existen y PostgREST rechaza la fila entera).
2. **El deploy**, apagado en todos los workspaces. La migración no escribe ni una fila de
   settings a propósito.
3. **Prender UN workspace a mano**:
   `setSetting('landing.replay', '{"activo":true}')`.
4. ~~Recién entonces, el cron de purga en `vercel.json`.~~ **El cron viaja CON el código**,
   no después: con el apagador apagado en todos no hay una sola fila, así que no hace nada.
   Dejarlo para un paso posterior era el error — es el que SELLA, y una grabación sin sellar
   no se puede mirar y sus lotes no se borran nunca.

`replay_sesiones` y `replay_lotes` ya están en `TENANT_TABLES` (`lib/workspace.ts`): sin esa
línea `getTenantDb()` es **passthrough**, y la ficha de un lead listaría las grabaciones de
cualquier cliente.

---

## 7. Lo que queda sin hacer

- **El ratio de compresión de los eventos de rrweb no está medido.** Todas las cuentas de
  arriba usan 4× como piso conservador. Se cierra con una sesión real en producción.
- **`replay_sesiones` y `replay_lotes` NO están en `TABLAS_DE_INQUILINO`**
  (`lib/tablas-de-inquilino.ts`), que es lo que vacía el reset del cliente de prueba y el
  borrado de un cliente. Se agregan **después** de aplicar la migración: esa lista se midió
  contra el esquema real a propósito, y una tabla que todavía no existe ahí es exactamente
  el bug que su propia cabecera documenta. Mientras no estén, un reset deja grabaciones de
  visitantes atrás.
- **El bucket `replays` tampoco está en `BUCKETS`** de `lib/reset-workspace.ts`, por lo
  mismo y en el mismo paso.
- ~~**La purga no existe todavía**~~ — HECHA el 05/10/2026, y hace DOS trabajos: sella y
  purga (`/api/cron/replay-purga`, cada 10 minutos en `vercel.json`). El sellado está ahí y
  no en el receptor porque el orden de llegada no está garantizado: sellar en el request que
  trae el `fin` tira el lote anterior que todavía venía en camino. Cuenta todo lo que hace,
  incluidas las que CONSERVA por ser de un lead — sin ese número, los 180 días son una
  promesa sin evidencia.
- **El derecho al olvido por lead** no está diseñado. Borrar las grabaciones de una persona
  es un `delete` por `visitor_id` más los objetos, y a diferencia de Clarity —donde «hay que
  borrar el proyecto entero»— acá se puede hacer fino. Falta la pantalla.
- **Nada decide todavía qué ve el reproductor cuando la sesión está cortada.** El campo
  `corte` existe y el contrato lo exige; el copy de ese cartel no está escrito.

Y lo que la INGESTA dejó abierto (paquete del 05/10/2026):

- **El ratio de compresión sigue sin medir, y ahora se puede.** El sellador escribe
  `replay_sesiones.bytes` con el peso REAL del objeto y la suma de los lotes crudos es
  reconstruible: una consulta sobre la primera semana en producción cierra el 4×–10× que
  hoy es una estimación.
- **Nadie mira `descartados` todavía.** La columna cuenta los lotes que llegaron después de
  cortar una sesión, que es lo único que dice si el tope de 10 minutos quedó corto. No hay
  pantalla ni aviso: hoy se contesta con una consulta.
- **El grabador tiene que PARAR cuando el receptor contesta `ignorado`.** La ruta devuelve
  200 con el motivo (`apagado`, `sesion ya cerrada`, `tope: tiempo`, …) justamente para
  eso. Si el grabador no lo lee, sigue mandando lotes que se descartan de a uno — se
  cuentan, pero es tráfico del visitante gastado al vacío.
- ⚠️ **El reproductor todavía no LEE el objeto con el lector del formato.**
  `lib/replay-leer.ts` baja el objeto y lo descomprime por su cuenta, y devuelve el texto
  entero; nadie parte las líneas todavía. En el momento en que alguien escriba ese
  `split('
')` + `JSON.parse`, hay DOS implementaciones del formato del `.jsonl.gz` y la
  segunda se queda vieja — es «una cosa, un lugar» con el reloj corriendo. Ya están escritas
  y con test: `leerSellado` y `eventosDeSellado` en `lib/replay-sellado.ts`.
- **El `corte` por bytes se decide DOS veces y la segunda es la que manda.** El receptor lo
  marca cuando la suma de los lotes pasa el tope (aproximada: dos lotes en vuelo pueden
  perderse un `update`), y el sellador lo vuelve a decidir con el peso exacto del objeto
  comprimido, que casi siempre es MENOR que la suma de los lotes. No es un bug —el tope
  duro lo pone el bucket con su `file_size_limit`— pero el número de la fila lo escribe el
  sellador, no el receptor.

**Vive en:** `lib/replay-contrato.ts` · `lib/replay-sellado.ts` · `lib/replay-ingesta.ts` ·
`app/api/track/replay/route.ts` · `app/api/cron/replay-purga/route.ts` ·
`tests/replay-contrato.test.ts` · `tests/replay-sellado.test.ts` ·
`supabase/migrations/0191_replay_de_sesion.sql` · `lib/workspace.ts` (TENANT_TABLES) ·
`vercel.json`
