# Retomar: Pixel, Clarity y Landing Analyst

**Ventana:** del commit `6785dc16` (05/10/2026 12:33) a `de64b5b7` (06/10/2026 15:58), cuenta
`claude1`. De los 97 commits de la ventana, los de esta área son nueve.
**Todo pusheado** (`git log origin/main..HEAD` vacío, medido el 06/10) **y desplegado**: la
prueba no es `vercel ls`, es que el setting `landing.snippet_versiones` —que escribe sólo el
código de `f229d313` (06/10 16:33 UTC)— tiene entradas puestas a las **17:31 UTC** (ws1) y
**16:58 UTC** (ws13). O sea que en producción corre el último commit del área.

**Lo de esta ventana en una frase:** Clarity salió del producto, la grabación de visitas pasó a
ser nuestra y está siempre prendida, el Pixel subió a la **v22**, y se armaron los dos avisos
para que los clientes repeguen el código. Lo que falta no es código: **falta que repeguen.**

---

## 1. En qué quedó (hecho, commiteado y en producción)

| Qué | Commit | Dónde vive |
|---|---|---|
| Clarity sale del flujo del Pixel; la prueba mide su PROPIA grabación | `18d56329` (00:52) | `app/integraciones/ProbarTracking.tsx`, `app/api/integraciones/landing/estado/route.ts` |
| El PRODUCTO es el paso 2 del Pixel, y se puede elegir más de uno | `b42c5194` (01:59) | `lib/landing-config.ts` (`funnelIds`), `lib/landing-funnel.ts`, `app/api/track/optin/route.ts` |
| Lead PRUEBA en el CRM para VER la grabación de la prueba | `29d64bea` (01:39) | `app/integraciones/prueba-lead-actions.ts`, `lib/replay-leer.ts` (`replayDePrueba`) |
| El paso 2 sin esperas y en un desplegable · Clarity fuera del producto | `cecf78c9` (04:23) | `app/integraciones/page.tsx`, `lib/landing-config-leer.ts`, `lib/lead-de-prueba.ts` (se borró `lib/clarity.ts`) |
| Clarity: lo que quedaba, fuera — datos, variable y textos que lee MaKo | `6cdb2501` (10:54) | `lib/api-mako/areas/landing.def.ts`, `tests/sin-clarity.test.ts` |
| **Pixel v22**, el WhatsApp de «quedó viejo» prendido y el aviso fijo | `7a261399` (11:09) | `lib/landing-token.ts`, `lib/pixel-aviso.ts`, `app/_components/AvisoPixelViejo.tsx`, `app/_components/EsquinaAvisos.tsx`, mig `0201_clic_anclado.sql` |
| Landing Analyst: el mapa de calor, y cada página del Pixel se analiza sola | `7e80682c` (11:53) | `app/landing-analyst/MapaDeCalor.tsx`, `lib/landing-mapa*.ts`, `lib/landing-analyst-auto.ts`, `lib/landing-url.ts` |
| Revisión adversarial de la tanda: la esquina no tapa «Publicar», y 6 arreglos | `1120ba01` (12:39) | `app/_components/EsquinaAvisos.tsx`, `app/globals.css`, `lib/landing-mapa*.ts` |
| El aviso mira lo que SIRVE la página y decide por página; la grabación ya no se apaga | `f229d313` (13:33) | `lib/pixel-aviso.ts`, `lib/pixel-estado.ts`, `lib/pixel-servido.ts`, `lib/replay-contrato.ts` |

Los dos de cosecha (`2a1eff0b`, `d44a4c47`) escribieron `docs/hallazgos-landing.md` (hoy 3.736
líneas; lo de esta ventana está de la línea ~3.190 al final) y `AGENTS.md`.

**Los números que hay que saber de memoria:**

- `SNIPPET_VERSION = 22` — `lib/landing-token.ts:136`. La v22 saca el tag de Clarity y **ancla
  cada clic a su elemento** (`sel`, `rel_x`, `rel_y`), que es lo que el mapa de calor necesita.
- `PIXEL_MINIMO_AVISO = 22` — `lib/pixel-aviso.ts`. **Es una constante aparte y se sube A MANO.**
  No deriva de `SNIPPET_VERSION`: un aviso que no se puede cerrar y que se prende con cada subida
  es como se enseña a no leerlo. Tiene test (`tests/pixel-aviso.test.ts`).
- Mig **`0201_clic_anclado.sql` APLICADA** — verificado leyendo `information_schema`: `vsl_events`
  tiene `sel, rel_x, rel_y, alto_ventana, fijo`.
- **66/66 tests en verde** del área (`pixel-aviso`, `landing-mapa`, `landing-analyst-auto`,
  `landing-clic-anclado`, `sin-clarity`, `landing-config`), corridos el 06/10 en este clon.
- Cron nuevo en `vercel.json`: `/api/cron/landing-analyst-auto` a `20 * * * *`.

### El estado VIVO, medido contra producción el 06/10 (sólo lectura: `app_settings`, `landing_visits`, `replay_sesiones`, `landing_analyses`, más un `curl` al HTML de cada landing)

| ws | versión guardada | páginas declaradas | lo que SIRVE hoy | veredicto |
|---|---|---|---|---|
| **1** (Mauricio) | 22 | `multiplicatusresultados.com` | `var SV = 22` (leído con curl) | **al día** |
| **4** | 21 | ninguna | — | viejo (decide la del negocio) |
| **11** (Leila) | 18 | 3 | `leilafittipaldi.com/lidermente` sirve `var SV = 18` | **viejo** |
| **13** (Código Inmob.) | 18 | 2 | `v0-joandowd.vercel.app` **no trae nuestro endpoint en el HTML** → manda la visita (18) | **viejo** |
| **14** (P2P) | 15 | 1 | última visita 01/10 22:57 → sin tracking hace días | **viejo** |
| **9, 10, 15, 17** | — | — | — | **nunca pegaron el Pixel** (token acuñado, cero filas de versión): no les sale ningún aviso, a propósito |

Visitas del ws1 en 30 días, por versión: **v14 → 7.714** (última 06/10 03:29), v21 → 71 (última
15:46), v22 → 9 (última 19:09). Es decir: hasta la madrugada del 06/10 casi todo el tráfico del
producto se medía con un código de hace meses. El ws1 repegó; **los tres clientes no.**

---

## 2. Lo que quedó a medio hacer o sin verificar

**Lo primero, porque invalida la mitad de lo construido:**

- ⚠️ **NINGÚN cliente tiene una sola grabación.** `replay_sesiones` tiene 18 filas y **todas son
  del ws1** (14 selladas con cuerpo, última 06/10 19:11 UTC). El grabador existe desde la v21 y
  los clientes corren v15–v18. *Consecuencia*: el **mapa de calor se dibuja sobre la FOTO de una
  grabación**, así que **para las páginas de los clientes no hay fondo**: la pantalla cae a «Lo
  más tocado». Vive en `lib/landing-mapa-server.ts` (`fondoDelMapa`).
- ⚠️ **El mapa de calor está construido y casi vacío.** Clics de los últimos 45 días: ws1 **421
  clics, 1 con ancla** y 7 con punto; ws4 4/0/4; ws11 128/0/0; ws13 433/0/0; ws14 42/0/0. El
  ancla llegó con la v22 (hoy) y el punto con la v20. Hasta que repeguen, no hay qué pintar.
- ⚠️ **La landing principal del ws1 está en `error` en Landing Analyst desde el 20/09 y el
  análisis automático NUNCA la va a reintentar.** `faltanAnalizar` (`lib/landing-url.ts:57`) toma
  las declaradas **sin fila**, y una fila en error es una fila. Lo mismo le pasó a
  `http://leilafittipaldi.com` del ws11, que pasó a `error` el 06/10 a las 16:20 UTC en la
  primera corrida automática. Las otras cinco declaradas sí quedaron analizadas.

**Lo demás, con su archivo:**

| Qué | Dónde vive | Estado |
|---|---|---|
| El aviso fijo **no mira si el Pixel sigue vivo**: una landing dada de baja con una v18 deja la pastilla para siempre. El WhatsApp sí exige tracking de menos de 48 h | `lib/pixel-estado.ts` · `app/api/integraciones/landing/version/route.ts` | sin hacer, medido |
| **Quitar el diagnóstico de una página declarada no dura**: el cron horario lo rehace y gasta otro análisis de IA | `lib/landing-analyst-auto.ts` | sin hacer: falta decidir qué significa «quitar» |
| `snippetDesactualizado()` —la versión del WORKSPACE, donde gana el último evento— **sigue vivo en tres lectores**: el pulso «Lo que mide tu Pixel», lo que contesta MaKo, y la puerta del cron | `lib/landing-pulso-server.ts:179` · `lib/api-mako/areas/landing.run.ts:122` · `app/api/cron/tracking-vigilante/route.ts:223` | sin unificar. ⚠️ El **chip del modal YA se unificó** (`app/integraciones/page.tsx:73` llama `estadoPixel`), contra lo que dice una entrada vieja de `hallazgos-landing.md` |
| **Dos normalizaciones de URL que no dan lo mismo.** La del Pixel conserva el query que no reconoce, y `ai=`, `ct=` (anuncios de Meta) y `sfnsn=wa` (WhatsApp) **no están** en `PARAMS_DE_MEDICION` → la misma portada sale como tres páginas | `lib/landing-paginas.ts:61` (la del Pixel) vs `lib/landing-url.ts:32` (la de Landing Analyst, tira el query entero) | sin hacer |
| **El opt-in que choca con un duplicado PIERDE el `visitor_id`** (va a la propuesta y nadie lo copia al confirmar) → sin eso, un lead que vino de la landing no muestra su grabación | `app/crm/leads-importar.ts` (`FilaImport`) · `app/crm/revisar/[id]/RevisarLead.tsx` (`aFilas`) · `app/crm/actions.ts` · `lib/leads-duplicados.ts` | sin hacer. ⚠️ **otra sesión tiene esos archivos modificados sin commitear**: medir antes de tocar |
| **La cookie del visitante no lleva `domain=`** (`lib/landing-token.ts:1278`): `www` y el dominio sin `www` son dos visitantes distintos para la misma persona | `lib/landing-token.ts` | sin hacer |
| `guardar_landing` de la API de MaKo **no expone los productos** (`funnelIds`): la pantalla los asigna y MaKo no puede | `lib/api-mako/areas/landing.def.ts` | hueco del registro |
| **Muestreo y retención del replay son perillas sin pantalla**; `landing.replay` sigue guardado con `{"activo":true,…}` en ws 1, 11, 13 y 14 y **ese campo ya no existe en el contrato: se ignora** | `lib/replay-contrato.ts` (`REPLAY_CONFIG_KEY`) | a propósito |
| Desde la prueba del Pixel **no avisa nada cuando la grabación terminó de guardarse** (hasta 10 minutos): hay que volver a la prueba | `app/integraciones/ProbarTracking.tsx` | sin hacer |
| **3 de 13 grabaciones selladas no tienen foto** (medido el 06/10; causa no medida). El lector prueba hasta 12 y, sin foto, muestra «Lo más tocado» | `lib/landing-mapa-server.ts` | sin verificar |
| La ventana del pulso (`PULSO_DIAS = 90`) **no es configurable desde la pantalla**; el endpoint ya acepta `?dias=` | `app/landing-analyst/PulsoPaginas.tsx` | sin hacer (viene del 05/10) |
| La pantalla del pulso **nunca se verificó en el navegador** (sólo typecheck y tests) | `app/landing-analyst/PulsoPaginas.tsx` | sin verificar (viene del 05/10) |
| Una sesión **huérfana** (navegador cerrado de golpe) espera la ventana del barrido, y **ninguna pantalla distingue «esperando» de «se perdió»** | `lib/replay-ingesta.ts` | sin hacer |

---

## 3. Las trampas del área (lo que parecía una cosa y era otra)

1. **«Clarity está muerto en datos» era FALSO, y sobre eso se decidió sacarlo.** Se había medido
   `landing.config[].clarityProjectId` —el proyecto por página, cero filas— y el código que corría
   leía otra cosa: `credWs('CLARITY_PROJECT_ID')`, la credencial del **workspace**. Medido después:
   **5 workspaces con credencial viva, 3 de ellos clientes**, uno con 116 sesiones de ayer. La
   regla quedó en `AGENTS.md`: para afirmar que un cambio no afecta a nadie, se mide **lo que LEE
   el código que corre**, no un campo con el mismo nombre en otro lado.
2. **Sacar algo del snippet TAMBIÉN es una versión nueva.** Se decidió no subir `SNIPPET_VERSION`
   al retirar Clarity («los clientes ya están por debajo de la v21») y estuvo mal: la portada del
   ws1 se había repegado con la v21 **cuatro horas antes** del retiro y seguía sirviendo el tag de
   Microsoft; con la versión en 21 contaba como al día **para siempre**. Corregido el mismo día con
   la v22. El snippet vive **congelado** en el HTML del cliente: lo que se saca tampoco le llega.
3. **«Ya publiqué y sigue apareciendo que falta publicar el pixel».** La versión sólo se enteraba
   por las **VISITAS**: hasta que no entra alguien con el código nuevo, el número no cambia. El
   diagnóstico obvio («falta que pase un rato») era cierto y era justo lo que el aviso no puede
   decir. La regla: **si el hecho se puede leer en la fuente, se lee** (`lib/pixel-servido.ts`,
   con caché asimétrico: «al día» 10 min, «viejo» o «no pude leer» 30 s).
4. **Token acuñado NO es Pixel pegado.** El token se acuña con sólo abrir Integraciones, y
   `snippetDesactualizado()` cuenta como **v1** a quien no tiene versión anotada: les diría
   «actualizá» sobre algo que nunca instalaron. El aviso fijo pregunta por la **FILA** de versión.
5. **Si el HTML no trae nuestro endpoint, no se concluye NADA.** Medido hoy: el HTML de
   `v0-joandowd.vercel.app` (ws13) no lo trae —puede ser render en el cliente, o un administrador
   de etiquetas— así que `versionEnHtml` devuelve `null` y manda la visita. Y **si hay dos copias
   del código pegadas, gana la MÁS VIEJA**: pegar el nuevo sin sacar el viejo no es «al día».
6. **Una grabación sin sellar NO es un sellado roto.** Casi se reporta la cadena cortada mirando
   dos sesiones con `eventos: 0`, sin cuerpo y cero objetos en el bucket. Tenían 4 y 7 minutos y
   `/api/cron/replay-purga` corre cada 10. **`eventos: 0` no es «no grabó»: es «todavía no se
   contó»** — el índice se escribe en la ingesta y se completa en el sellado. Antes de llamar rota
   a una etapa que dispara un cron, **restá la hora**, y traé el reloj al lado del dato.
7. **El cuerpo sellado guarda UN LOTE POR RENGLÓN, no un evento.** La primera versión del mapa
   leía cada renglón como un evento, no encontraba nunca el tamaño de ventana y decía «no hay
   grabación de esta página» sobre diez que tenían foto. **Lo encontró el navegador, no el test**:
   el test se había escrito con la forma que uno se imaginaba.
8. **En un iframe tan alto como la página, `100vh` vale la página entera** (una portada con
   `min-height:100vh` se estira sola). Las unidades de ventana se congelan a píxeles — y
   congelarlas sobre la hoja cruda **reescribe los selectores** (`.h-\[50vh\]` → `.h-\[400px\]`).
9. **El alto del documento varía hasta un 32%** en la misma página al mismo ancho (3.518 a 4.650
   px). Por eso la v22 ancla el clic **al elemento** y el punto queda de respaldo.
10. **`Object.entries` recorre las claves numéricas de MENOR a mayor** aunque el literal esté
    escrito al revés: la novedad que justificaba el WhatsApp salía última, al 84% de un mensaje de
    2.240 caracteres. Y **un dedup de 72 h exactas sobre un cron diario sale cada CUATRO días**.
11. **`.eq('funnel_id', null)` en Postgres no matchea nada** (`= NULL` es NULL, no true): la
    búsqueda de «¿ya existe el lead PRUEBA?» daría vacío **siempre** y crearía una fila por click,
    sin un solo error. Va `.is('funnel_id', null)`.
12. **Un alta que se REPARTE a N filas choca con su propio chequeo de duplicados.** Con varios
    productos, la segunda ficha encuentra a la primera y tira `LeadDuplicadoError`, y en el opt-in
    un alta que falla cae a propuesta: el lead quedaría esperando un click que nadie sabe que hay
    que dar. Se chequea **una vez afuera** del bucle y adentro va `permitirDuplicado: true`.
13. **El `after()` de una server action vive dentro del `maxDuration` de la PÁGINA** que la llama,
    y `/integraciones` no declaraba ninguno: el análisis automático moría a mitad de camino.
14. **La página la dice la GRABACIÓN, no la pantalla.** El lead PRUEBA sale de `replay_sesiones`
    (`visitor_id` + `landing_url`): leyendo la landing elegida, cambiar de página entre hacer la
    prueba y apretar el botón mandaría el lead al producto equivocado **con el visitante correcto**
    — se vería igual, en el tablero de otro producto, sin un solo error.
15. **La esquina de abajo a la derecha es de toda la app.** El aviso que no se puede cerrar le
    caía encima al «Publicar» de `/chatbot` y al «Enviar» de los chats, **y eso ya estaba en
    producción**. Una pantalla que apoya algo ahí declara `data-esquina-ocupada` (`AGENTS.md`).

---

## 4. Qué espera una decisión de Martín

1. **Que los clientes repeguen el código.** Es lo único que separa todo lo construido de servir
   para algo. Hoy les llega: el WhatsApp semanal de «quedó viejo» (`tracking-vigilante`, prendido,
   `dedupKey = v22`) y el aviso fijo adentro de MaKo. **A P2P (ws14) no le llega el WhatsApp**: no
   tiene ningún canal —ni grupo, ni mail, ni destinatarios— y además lleva días sin visitas.
   *Opciones:* esperar al ciclo semanal · escribirles a mano a Leila, Código Inmobiliario y P2P ·
   o pedirles el acceso y repegarlo nosotros.
2. **¿Qué significa «quitar» una página de Landing Analyst si sigue declarada en el Pixel?** Hoy
   el cron horario la vuelve a analizar y gasta otro análisis de IA. *Opciones:* quitarla del Pixel
   también · una marca «no analizar» en la fila · o que «quitar» sólo borre el diagnóstico y se
   acepte que vuelve.
3. **¿El aviso fijo se tiene que apagar en una landing dada de baja?** Hoy una página muerta con
   una v18 deja la pastilla para siempre. *Opciones:* exigir tracking de menos de 48 h, como ya
   hace el WhatsApp · un botón de «esta página ya no es mía» · o dejarlo (el aviso es correcto:
   esa página efectivamente tiene un código viejo).
4. **Las páginas en `error` de Landing Analyst no las reintenta nadie** — entre ellas la portada
   del ws1, en error desde el 20/09. *Opciones:* reintento automático con tope (cuesta IA) · un
   botón de reintentar en la lista (ya existe para los cortados) · o nada, y se reintenta a mano.
5. **El mapa de calor para un cliente no va a tener fondo hasta que repegue** (hace falta una
   grabación para sacarle la foto, y la grabación hace falta la v21+). *Opciones:* dejarlo así y
   que se llene solo cuando repeguen · o aceptar una versión del mapa sin foto («Lo más tocado»,
   que es lo que hoy muestra) como la vista de default mientras tanto.
6. **El `visitor_id` que se pierde en el camino del duplicado.** Es lo que hace que un lead que
   vino de la landing no muestre su grabación en la ficha. *Opciones:* copiarlo al confirmar la
   propuesta (toca cuatro archivos del CRM, hoy en manos de otra sesión) · o dejarlo, aceptando que
   el duplicado lo resuelve una persona mirando el CRM.

---

## Cómo medir el estado vivo antes de escribir una línea

Lo de arriba es de hoy y **se vence**. Dos lecturas, las dos sin escribir nada:

- **Qué versión tiene cada negocio:** `app_settings` con `key in ('landing_token',
  'landing.snippet_version', 'landing.snippet_versiones', 'landing.config', 'landing.replay')`,
  agrupado por `workspace_id`. Sin fila de `landing.snippet_version` = nunca pegó el Pixel.
- **Qué versión SIRVE cada página, que es la que vale:** `curl -s -L <url> | grep -o "var SV = [0-9]*"`.
  Sin `api/track/vsl` en la salida, el HTML no trae el código y no se concluye nada.

Un probe de la base se arma con `postgres` + `DATABASE_URL` de `.env.local` (molde:
`scripts/probe-chatbot-estado.ts`). ⚠️ Correrlo **desde el directorio del repo**, con
`NODE_PATH` apuntando a su `node_modules` si el archivo vive fuera.

**Y antes de tocar código:** leer el final de `docs/hallazgos-landing.md` (de la línea ~3.190 en
adelante, todo del 06/10) y el apartado del Pixel en `app/admin/dev/integraciones/bitacora.ts`,
que tiene los pedidos de Martín **textuales**, sin resumir.
