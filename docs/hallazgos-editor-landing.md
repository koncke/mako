# Hallazgos · Editor de landings (Web Generator, ex Landing Generator, copiado de Gamma)

El editor de landings copiado de Gamma 5 (`app/web-generator` —hasta el 15/10/2026 `app/landing-generator`, que hoy sólo
redirige—, `lib/editor-landing`, `app/l`);
el diseño y los contratos, en [diseno-editor-landing.md](diseno-editor-landing.md). Lo que hay que
saber ANTES de tocarlo. Lo que se hizo está en el commit. Corrida del 11/10/2026 (relevo de 6
agentes, construcción de 12 paquetes en paralelo, integración).

## MaKo toma la iniciativa en el Web Generator: «¿Ya está lista para que la vean?» (5/11/2026, nube)

- **Qué hace:** con la página abierta sin publicar y la charla vacía, el chat del editor pregunta un hecho; «Sí, ya está» abre el
  diálogo de «Publicar» con la dirección que MaKo ya propone. Lo contestado vale para ESA página (alcance `entidad`). Mientras
  habla, el saludo y las sugerencias se esconden.
- **Lo obvio que no va:** el plan dice «publicar con la dirección de MaKo» como un `hacer`. Publicar desde el chat se saltea lo que
  el diálogo mira antes (que la dirección esté libre, el tope del plan con «Pasar a Pro» y el aviso de cobro): la respuesta abre
  el diálogo, que queda a un clic.
- **La trampa del montaje:** `AperturaMako` trae el hilo, y el hilo trae `app/_chat/chat.css`. Importada directo en
  `PanelAgente.tsx` tumbaba `tests/editor-landing-agente.test.ts` («SyntaxError: Unexpected token '.'» sobre el CSS), que carga el
  panel en node. Va como `AperturaAgente` en ./ChatAgente.tsx (el módulo que ya entra con `next/dynamic`), y el panel sólo se
  entera por `onHabla` de si está hablando. Y `docId` es un número: la entidad va como texto.
- **Vive en:** lib/aperturas/web.ts, app/web-generator/editor/paneles/{PanelAgente,ChatAgente}.tsx. **Lo fija:**
  tests/iniciativa-web.test.ts (2 roturas).
- **Falta:** la segunda («¿Vas a pautar esta página en Meta?», el Pixel con un funnel de anuncios) y la guía de la pestaña.

## Lo leído para replicar se perdía al volver: ahora queda como borrador (ticket #54, 4/11/2026, nube)

**Síntoma:** Leandro (ws 10), por el chat de soporte: «quise volver para atrás […] se me borró completamente la página analizada
[…] no me quedó ni siquiera en formato borrador. […] lo que haría no sería que se borre, sino de que quede en estado borrador».

**Causa:** la lectura de «Replicar» (estructura, ángulos y diseño de la página de afuera, que paga IA) vivía SÓLO en la pantalla
(`useLeerParaReplicar`), y la ruta de lectura lo decía: «No escribe nada». Cualquier cosa que desmontara la vista se la llevaba.
En el editor la más probable es el botón de MaKo de la lista de landings: vuelve al chat con `setPanelIzq('agente')`, eso
cierra «Nueva landing» (`creando = nueva && panelIzq === 'landings'`) y desmonta el Panel embebido. Lo mismo ir a otra landing,
el «atrás» del navegador o recargar. Y la copia todavía no existía, así que no quedaba nada.

**El diagnóstico obvio era el equivocado:** «mantener la vista montada» arreglaba el chat de ida y vuelta y nada más (ni el
«atrás» ni recargar). Además dejaba a «Nueva landing» trabada en la réplica vieja, sin camino de vuelta al cuadro.

**Lo que se hizo:**
- **La ruta de lectura guarda lo leído como borrador del negocio**, por la dirección PEDIDA (no la de la lectura: puede redirigir),
  en `app_settings` (sin migración), con lo elegido y lo leído en el navegador o pegado (la réplica no tiene que volver a abrir
  la ventana).
- **La pantalla retoma en vez de leer** si esa dirección tiene borrador: no paga IA otra vez y cierra la ventana del clic. «Leer
  de nuevo» sobre lo que está a la vista lee de verdad (`esRelectura`).
- **Lo elegido se guarda con un respiro**, y lo último sale con `keepalive` al cerrar.
- **«Sin terminar» en la lista de landings del editor** retoma en «Nueva landing» (`retomarReplica` → `derechaPedida`, sin
  remontar el Panel: hay un test que lo prohíbe porque tira lo escrito en el cuadro).
- **La copia creada borra su borrador**, en las dos ramas de la ruta de replicar.
- **Tope de 8 por negocio, y 30 días.**

**Trampas:** `_` es comodín de LIKE (el prefijo `landing.replica_borrador:` se vuelve a mirar con `startsWith`); el `target` es
ES2017, sin literales BigInt (la huella son dos FNV de 32 bits); un color guardado se pinta con `style.background`, así que
sólo pasa hex, rgb o hsl, nunca `url(...)`. Dos guardas fijaban la LÍNEA de la llamada a `leer` y se pusieron rojas al sumar
`eleccion`: se reescribieron para afirmar lo que cuidan (la lectura vuelve a leer, sin ángulos con la copia idéntica).
La primera subida dio rojo en `tests/cuenta-revision-escrituras.test.ts`: la ruta nueva escribe (POST y DELETE) y no estaba en
su lista. Quedó **cortada** para la cuenta de revisión, igual que `leer` y `replicar`. El filtro del pre-push no corre esa
guarda, así que una ruta nueva que escribe se clasifica a mano antes de subir (`MAKO_REGENERAR_SNAPSHOT=1`).

**Sin hacer:** el defecto visual «de cómo se interactúa con el chat» del mismo ticket no se pudo ver sin la captura
(docs/relevo/nube-tickets.md dice qué mirar). Tampoco se miró en pantalla: la nube no levanta la app.

**Vive en:** lib/editor-landing/replica-borrador.ts · lib/editor-landing/replica-borrador-server.ts ·
app/api/landing-generator/replicar/borrador/route.ts · app/web-generator/crear/Replicar.tsx ·
app/web-generator/editor/paneles/PanelLandings.tsx · tests/replica-borrador.test.ts.

## La réplica editable: lo que se mide, lo que se arregló sin la copia y lo que no se pudo ver (29/10 y 4/11/2026)

**Vive en:** `lib/editor-landing/diseno-elemento-acciones.ts` (`ponerColor`, `ponerImagenDeFondo`, `capaEncima`) ·
`lib/editor-landing/diseno-contenido.ts` (la lista de «Contenido») · `app/web-generator/editor/nodos/PanelContenidoDiseno.tsx` ·
`app/web-generator/editor/nodos/HtmlEditableVista.tsx` · `tests/replica-editable.test.ts`.

Martín: «Es super importante que la replica de las landing, no solo replique, sino que luego sea editable absolutamente
todo... Sino, no tendrá sentido replicarla, seria como hacer una captura... Debe ser todo editable».

**La matriz del 29/10 (claude4, sobre las 5 copias del ws9: #68 respond, #69 reportei, #70 holo, #71 masterads, #72
closermood).** Por «Contenido» se llegaba a TODO texto, imagen y botón del censo de las 5 (#68 247/128/178 · #69 218/93/245 ·
#70 504/169/55 · #71 99/57/13 · #72 145/0/15); con el clic, bastante menos (lo oculto sólo está en la lista). Duplicar, mover,
quitar, fuente, destino de un botón e imagen andaban en todas las secciones y sobrevivían al saneo. Quedaron dos ❌ y dos huecos.

**Lo que se arregló el 4/11, en la nube y sin la base de producción (las copias viven ahí):**
- **«Contenido» no listaba íconos ni videos**, y la matriz no lo había medido: `contenidoDeDiseno` salteaba el `<svg>` y no
  miraba `<video>`, `<iframe>` ni `[data-calendly]`. Un ícono o un video OCULTO (el de una pestaña que no se ve) no se podía
  cambiar ni quitar. Ahora hay pestañas «Íconos» y «Videos», con «Cambiar» (el mismo selector que al elegirlos con un clic) y
  «Quitar». Lo de adentro de un reproductor es suyo y no se lista aparte. Los FONDOS ya estaban.
- **El color del texto va también a `-webkit-text-fill-color`.** Un título con degradado (`background-clip: text` con el
  relleno transparente, el truco de casi toda landing de SaaS) se pinta con el relleno: cambiar sólo `color` movía el valor
  calculado y en pantalla no pasaba nada. Es la causa PROBABLE del ❌ de la sección 10 de la #68 («ni el texto ni el fondo
  cambian»), no la comprobada. Sólo en «Elemento» del editor: el camino del chat y de la API para un botón
  (`conEnlaceDeDiseno`) sigue con `color` solo, porque un botón con degradado es raro y su test fija el estilo exacto.
- **Una imagen de fondo tapada por una capa de la página ya no queda muda.** El ❌ de la sección 13 de la #69 («la imagen de
  fondo no se ve») huele a un `::before`/`::after` con fondo encima: un estilo en línea no llega a un seudo-elemento, así que lo
  que se puede hacer es AVISAR. `capaEncima` lo detecta con el `getComputedStyle` de los dos seudo-elementos y el editor dice
  «Una capa de la página la tapa». Una caja HIJA que tapa no se detecta.

**Y la rama traía 8 rojos que nadie había visto** (sus tests afectados nunca corrieron: el relevo lo decía «FALTA»). Seis
salían de UNA frase: la réplica sumó a la descripción de `editar_landing_con_ia` tres ejemplos («quita la sección de precios»,
«pon los testimonios arriba de todo», «duplica la del hero»), y esas palabras le subieron el puntaje contra los pedidos de
quitar un botón y de animar, que dejaron de traer `acomodar_bloque_landing` y la lista de secciones (ops-center-bateria,
ops-center-clasificador-app, mako-intencion-landing, api-mako-landing-animacion). Se volvió a la descripción de main: la
IA igual saca, reordena y duplica, porque eso lo dice la gramática, no la descripción. Es la regla de AGENTS.md («las
descripciones no repiten las raíces de OTRAS operaciones») cumplida tarde. Los otros dos fijaban líneas que la réplica
reescribió (el clic que elige y la frase de la gramática): se reescribieron para afirmar lo que cuidan.

**Probado rompiéndolo (4/11):** 16 roturas, 16 rojas (las 3 de las aserciones reescritas, y sacar el ícono de la lista, el corte del reproductor, la agenda, el
relleno al poner y al sacar, el relleno puesto en el fondo, el cableado de `onIcono`, las pestañas, y las cuatro condiciones
de `capaEncima` más el aviso). `tsc-acotado` sin errores en los 5 archivos.

**Lo que NO se pudo ver, y queda para una sesión con la base:**
- Si los dos ❌ se van de verdad en la #68 y la #69: hace falta abrirlas en el editor real.
- Una sospecha más para el ❌ de la #68: la matriz leía el color calculado APENAS después de ponerlo. Con un
  `transition: color …` en la hoja de la página, ese valor es todavía el de antes. Si ése era el caso, el ❌ era de la medición.
- Las capturas 1440/390 de las 5 copias (`C:/dev/revisiones/replica-editable/capturas/`, en la PC) no se miraron.
- El chat de punta a punta en #70–#72 (`chat-e2e-2`) no corrió. Por el chat, la imagen depende de Openverse, que tarda 11–20 s
  contra un corte de 12 s (`lib/imagenes-stock.ts`): decidir si se suma otro proveedor de fotos.
- El chat ve sólo 60 botones por sección (`TOPE_ELEMENTOS_DISENO`, ia-bloques.ts): #68 secc 0 tiene 91 y #69 secc 1 tiene 71.
  Por «Contenido» sí se llega.
- Las copias #68–#72 siguen en el ws9 como material de prueba: van a la papelera cuando esto se dé por cerrado.

*29/10/2026 (claude4, la matriz) y 4/11/2026 (nube, al rearmar la etiqueta `rescate/replica-editable-2810` sobre main).*

## Los valores de Tilvo en el chrome: la estructura sigue de Gamma (31/10/2026)

**Vive en:** `app/web-generator/gamma.css` (y los bloques propios: `.gmx` de `BarraFormato.tsx`, `.gmp` de `dialogos/piezas-gma.tsx`,
`.gma-pb` de `paneles/PanelAgente.tsx`, `.gp` de `MiniaturaLanding.tsx`). Los números: `docs/diseno/`.

- **La regla:** Gamma es un competidor, se le copia la estructura; Code and Chill es una referencia de estilo, se le copian los números
  (AGENTS.md, «NINGUNA pantalla se diseña de cero», punto 3). Elegí Tilvo porque es la azul de las doce. Los nombres de la escala
  (`--gma-t500`, `--gma-b600`) quedaron: adentro ya no hay un gris de Gamma.
- **No tocar `lib/editor-landing/temas.ts` en esta pasada:** los temas son el CONTENIDO de cada cliente. El lienzo sigue claro con el
  editor en oscuro, y está bien: es su página.
- **Hay cinco juegos de colores, no uno.** Cambiar `gamma.css` no alcanza: `.gmx`, `.gmp` y `.gma-pb` escriben sus hex a mano y `.gmx` no lee
  ningún `--gma-*`. Quien cambie la paleta otra vez tiene que pasar por los cinco.
- **El teléfono no existía:** ni una regla para el editor. A 390 el panel de 340 tapaba todo y el lienzo quedaba en una tira de 40 px. Ahora
  va apilado (lienzo arriba, chat abajo). Es decisión nuestra, no copia: Tilvo a 390 usa una barra fija abajo, y esto no tiene navegación
  que poner ahí. La regla va al FINAL de la hoja o el margen del lienzo le gana (`tests/web-generator-valores.test.ts`).
- **El banco mentía por no cargar `globals.css`.** Sin `--fs-md`, el campo del chat quedaba sin relleno y la caja se veía desalineada; sin el
  preflight de Tailwind, «Discutir | Editar» salía en Arial. Parecían dos bugs de la app y eran del banco: ahora `server.cjs` los define.
- **Sin hacer:** el círculo del cambio de tema (450 ms, `docs/diseno/movimiento-codeandchill.md`) vive en el interruptor de la app, no acá.
  La barra lateral y el resto de la app siguen en Geist: entrar a la tab cambia de letra hasta que el rediseño llegue a todo.

## Servir otra versión de una página publicada: lo que lee la foto de A y lo que publica el borrador (25/10/2026)

**Vive en:** `lib/editor-landing/pagina-publica.ts`, `lib/editor-landing/publicar.ts`, `lib/editor-landing/pago-landing.ts`,
`app/l/html/[docId]/[bloque]/route.ts`.

- **Las rutas laterales leen la foto PUBLICADA, no la que se sirvió.** `/l/html/[docId]/[bloque]` lee `publicado.htmlLibre` y el
  pago valida contra `publicado.pagos`. Una versión B con otros pagos, formularios o `htmlLibre` rompe en esas rutas: B tiene que
  tener los mismos, o se rechaza.
- **`publicar` publica el contenido ACTUAL de la fila.** Si el dueño tiene cambios sin publicar, salen junto con lo que se quiso
  publicar. Algo que publica solo (un agente) sólo puede hacerlo si `version == publicado_version`.
- **`lib/texto-critico.ts` no está conectado ni al editor ni al Media Buyer**, y sólo cuida placeholders, links y números (no
  oferta, garantía, formularios ni Pixel).
- **Una versión distinta por User-Agent para bots es cloaking** (Google) y con Meta el anuncio se aprueba mirando otra página.
  Sólo el lector de MaKo, la vigilancia y la vista previa van fijos a la versión de siempre.
- **Una variante como otro `landing_doc` cuenta para el tope del plan** (`frenoDeTope`) y respondería 402: va como foto aparte.
- **hola-mako.com (la raíz y `/vsl/<slug>`) es ISR de 5 minutos más `unstable_cache`**: ahí no se puede servir una versión por
  persona sin volverla dinámica.

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| La forma del documento | `lib/editor-landing/doc.ts` | nodos, listas cerradas, topes, slug |
| La forma HTML de cada nodo | `lib/editor-landing/especificacion.ts` | la usan los `renderHTML` de TipTap Y `render.ts`: un solo lugar |
| HTML público | `lib/editor-landing/render.ts` | única fábrica de HTML (publicar, vista previa, exportar, miniaturas, presentar) |
| Saneo | `lib/editor-landing/validar.ts` | `sanearContenido` / `sanearConfig`, descartes con motivo, idempotente |
| Temas y hoja | `temas.ts` (34 temas: 18 medidos de Gamma + 16 aproximados), `css.ts` (`CSS_CONTENIDO`, ~94 KB) | |
| IA | `ia.ts` + `ia-bloques.ts` (la gramática que escribe el modelo) | features `landing-editor` y `landing-editor-ia`, gratis (Gemini) |
| Datos | `server.ts`, `publicar.ts`, mig 0246 | `landing_docs` (+ versiones, comentarios), bucket `landing-imagenes` |
| Página pública | `app/l/[slug]`, `app/l/vista/[token]`, `pagina-publica.ts` | route handlers con HTML completo, sin el layout raíz |
| Editor | `app/web-generator/editor/*` | armazón dueño del documento (`EditorLanding.tsx`) + contexto |

## TipTap: el JSON que no cumple el esquema se pisa con un documento VACÍO

**Vive en:** `editor/EditorLanding.tsx`, `lib/editor-landing/validar.ts` (`CONTENIDO_TIPTAP`).

Si el JSON guardado no cumple el esquema del editor, TipTap abre un documento vacío **sin error**, y el
autoguardado lo guardaría encima: se pierde la landing entera. Dos reglas:
- El esquema de las extensiones usa EXACTAMENTE el modelo de contenido que exporta el saneo
  (`CONTENIDO_TIPTAP[nombre]`); un test arma un esquema de ProseMirror con él. Si el editor es más
  estricto que el saneo, lo saneado no abre.
- Antes de dar una página por abierta: `schema.nodeFromJSON(doc).check()`. Si falla, la página queda de
  sólo lectura y se guarda como estaba.
- `nodeFromJSON` tira en silencio los atributos que no declara, pero un nodo de texto vacío rompe la carga.

## NodeViews de React: lo que no está en la doc de TipTap 3

**Vive en:** `editor/nodos/*`.
- `NodeViewContent` mete un `div` de más (`.gm-tarjeta-cuerpo > div > bloques`) y la hoja, que usa
  selectores de hijo directo (`> * + *`, `.gm-optimizado > .gm-item`, `:nth-child`), deja todo pegado.
  El contentDOM es el elemento que lleva la clase; no se usa `NodeViewContent`. Los ítems de un diseño
  optimizado son NodeViews de DOM cuyo `dom` es directamente el `.gm-item`.
- El contentDOM se crea DESPUÉS del primer `mount()` (React dibuja con `flushSync` y corren los
  efectos antes): un efecto que lo busca al montar no lo encuentra. Se espera con un MutationObserver.
- El primer hijo del NodeView tiene que ser el `NodeViewWrapper` (si no, tira «Please use the
  NodeViewWrapper»). Un `<style href precedence>` se iza al `<head>` y no cuenta.
- El `attrs` de `ReactNodeViewRenderer` sólo PONE atributos, nunca los saca: un `data-oculta` que deja de
  valer queda escrito «undefined». Va un `aplicarAttrs` propio.
- Un atributo de TipTap sin `parseHTML` lee `getAttribute(nombre)`: el id de una sección se leía
  «t-abc». `parseHTML: () => null` en cada atributo y un `getAttrs` que normaliza.
- Con `immediatelyRender: false`, `editor.view.dom` antes de montar es un proxy que tira con cualquier
  campo salvo `state`: se lee con acceso seguro y se espera el evento `mount`.
- Cambiar de página con `setContent` CONSERVA el historial: Ctrl+Z deshacía hacia la página anterior.
  Va `EditorState.create({ doc, plugins })` + `view.updateState`, y como eso no emite `update`, lo que
  escucha (la tira) lleva un contador de revisión.
- `prosemirror-history` junta sólo cambios contiguos: «reemplazar» e «insertar» seguidas son DOS pasos
  de deshacer. «Aceptar» un cambio de la IA va en una sola transacción.
- Las miniaturas repetían el `id="t-<id>"` de la sección: `getElementById` encontraba la miniatura.
  Las miniaturas se dibujan sin ids.

## El formulario entra al CRM por el Pixel, y el Pixel mira NOMBRES

**Vive en:** `especificacion.ts` (formulario), `lib/landing-token.ts` (el snippet, sin tocar).
- El opt-in lo manda el Pixel de MaKo, que escucha el `submit` en captura; el script propio de la
  página sólo hace `preventDefault` y muestra el éxito. Nunca un GET con datos en la URL.
- El Pixel busca subcadenas («tel», «mail», «name») en `id` y `name`: un id al azar puede contener «tel»
  y leerse como teléfono. Los ids de DOM de los campos llevan sólo dígitos.
- El Pixel arma cada respuesta con `labels[0].textContent`: con el radio adentro de la etiqueta de su
  opción, la clave quedaba «Compra: Compra». Va un `<label hidden for>` con la pregunta, antes.

## Página pública: el header de la ruta se pierde si next.config ya puso uno

**Vive en:** `lib/editor-landing/pagina-publica.ts`, `next.config.ts`.
- Next 16 sólo agrega un header de la ruta «si no estaba» (`send-response.js`), y `next.config.ts`
  pone `Content-Security-Policy` a toda la app: la CSP propia de `/l` no llegaba. La política de una
  ruta pública se arma donde gane.
- **Nada de JavaScript de terceros en hola-mako.com** (la sesión es una cookie del mismo origen): no
  se copiaron «código personalizado» ni Google Tag Manager de Gamma; sí el Píxel de Meta, armado por
  el server con un id de dígitos.
- Un `<iframe srcdoc sandbox>` aísla el ORIGEN, no la política: bajo la CSP estricta de la página, el
  bloque «HTML personalizado» **no ejecuta scripts en la publicada** aunque en el editor sí. Resuelto en
  la tanda 2 (abajo): el bloque se sirve desde su propia URL.
- Un slug igual a una carpeta fija de `app/l` tapa las páginas de esa landing (`/l/vista/gracias` se
  lee como token): toda carpeta fija va a `SLUGS_RESERVADOS`.
- `getOrCreateLandingToken` lee con `getSetting`, que ante un error devuelve null y entonces CREA un
  token nuevo encima del bueno: en una ruta pública que corre en cada visita, eso es destructivo. La
  página lee primero con `getSettingEstricto`; el riesgo sigue para otros llamadores (`lib/landing-token.ts`).
- `allowed_mime_types` del bucket mira el tipo que DECLARA la subida, no los bytes: por eso el
  registro verifica los magic bytes y borra lo que no es lo que dice.

## IA

**Vive en:** `lib/editor-landing/ia.ts`.
- Con una feature en Gemini y sin `fallback: []`, cuando falla todo lo gratis `chatClaude` prueba
  Sonnet al final, el veto lo corta, y los errores de los proveedores gratis se pierden: la persona
  veía un genérico. `ia.ts` arma el mensaje con los errores de la cascada.
- El formato de cada pedido EXTIENDE el JSON que declara `GRAMATICA_IA` (`{"tarjetas":[...]}`); uno
  que declare otro envoltorio contradice al system en el mismo prompt.
- Las anclas a otra sección (`#t-formulario`) no se resuelven tanda por tanda: `resolverAnclas` corre
  después de la última.

## Exportar: pptxgenjs engaña con el tamaño de la imagen

**Vive en:** `lib/editor-landing/exportar-pptx.ts`. Con `sizing`, los `w/h` del `addImage` son el
tamaño de la IMAGEN y `sizing.w/h` la caja: se calcula el tamaño natural y se recorta con
`sizing: 'crop'`. Y `fit: 'shrink'` recién se aplica cuando alguien edita el texto en PowerPoint.

## Tests que dieron verde sobre el bug (y cómo se cerraron)

- Un guard de variables CSS daba verde con una variable borrada del tema porque la hoja la
  redeclara adentro de `[data-fondo="acento"]`: las variables internas de la hoja se listan aparte.
- Un test de escapado del `*` daba verde sin el escape porque su asterisco estaba rodeado de espacios:
  el caso tiene que romperse sin el escape («2*3*4»).
- Un assert de «publica la versión guardada» aceptaba cualquier `version…`: con `version: 0` dio verde.
  El assert fija la forma exacta.
- **Los guards que barren con `git ls-files` (voseo, rutas, áreas) no ven archivos nuevos hasta el
  `git add`** — y al revés: un archivo borrado del disco pero no del índice hace fallar a todo barrido
  que lo lee (16 rojos en 12 archivos el 11/10, todos por `app/api/landing-writer/route.ts`). `git add -N`
  de lo nuevo y `git rm --cached` de lo borrado antes de la suite.

## El entorno de la corrida (para la próxima corrida grande)

- **El límite de 5 horas de la cuenta corta a los agentes a mitad de camino sin informe**: el
  integrador se cortó dos veces y el verificador una. Lo hecho queda en el disco; se retoma midiendo
  el árbol (typecheck, greps de cada pedido), no releyendo el transcript.
- **Guardia de RAM**: con 4-5 sesiones abiertas quedan < 3 GB y el hook frena los workflows. El build
  y la suite se corrieron sueltos, esperando ≥ 4,5 GB libres con un loop.
- El primer `next build` del worktree salió con código 1 y SIN mensaje tras «Creating an optimized
  production build»; el segundo (`--debug`), verde. Los `next-panic-*.log` de `%TEMP%` eran de otros
  días: antes de diagnosticar uno, mirá su fecha.

## Tanda 2 (12/10/2026)

Pedido de Martín (11/10, diez puntos, textual en [diseno-editor-landing.md](diseno-editor-landing.md) →
«Tanda 2») más el feedback de una prueba con Fiesta Music (12/10): «Te paso feedback, implementalo» —
«pidieron una landing page… y te lo creó tipo presentación diapositiva, no te lo creó como si fuera una
landing» y «se buguea cuando estoy en la vista de editar… en el sidebar de secciones, principalmente en la
vista que dice tira de imágenes... en la vista de lista no». Seis paquetes, una integración, un verificador
en el navegador y un revisor adversarial; acá va lo que costó.

### Lo de Fiesta Music: el diagnóstico obvio era el equivocado las dos veces

- **La landing «tipo diapositivas» no era la IA: era la HOJA.** `css.ts` dibujaba el modo DOCUMENTO de Gamma
  (tarjetas flotantes, con aire y sombra) para todo. Una landing (`formato: 'pagina'`) es ahora una página
  continua como un sitio publicado de Gamma (secciones a sangre, sin radio ni sombra; «Ancho» elige el ancho
  del contenido) y las tarjetas con aire son sólo de una presentación. **Regla: el aspecto página/presentación
  lo decide `config.formato` en el CSS; el prompt sólo cubre las palabras** (`REGLAS_PAGINA`). Lo publicado
  antes guarda su propia hoja en la foto: se ve como antes hasta republicar.
  **Vive en:** `lib/editor-landing/css.ts` (15b, 15c), `editor/extensiones/estilos-nodos.ts`, `ia.ts`.
- **La tira de miniaturas en bucle, y la lista no.** El alto de cada miniatura sale de su ANCHO, y en Windows
  la barra de scroll (~15 px) aparecía y desaparecía con el alto total: un ResizeObserver realimentado. Encima,
  cada pausa al tipear reemplazaba el HTML y un `<img>` nuevo mide 0 hasta decodificarse. La lista anda porque
  sus filas miden 30 px fijos. **Regla: todo layout cuyo alto depende del ancho lleva `scrollbar-gutter:
  stable`**, y una miniatura conserva su alto mientras una imagen carga (re-mide en `load`/`error`).
  **Vive en:** `editor/TiraSecciones.tsx` (`altoDeMiniatura`, `hayImagenSinCargar`), `gamma.css`. Sin verlo
  todavía en Chrome de Windows (abajo).

### HTML personalizado y «Replicar»

- **Abrir `/l/html/...` como pestaña correría el HTML del cliente con el origen y la sesión de MaKo**: Next
  descarta la CSP `sandbox` de la ruta si next.config ya puso una. Regla: la ruta sólo contesta a
  `Sec-Fetch-Dest: iframe`, con `Vary` y caché `private`, y sus cabeceras van en next.config DESPUÉS del bloque
  global (gana el último). **Vive en:** `lib/editor-landing/html-libre.ts`, `app/l/html/[docId]/[bloque]`.
- **La copia fiel salía en blanco en el editor**: un `<iframe srcdoc>` hereda `base-uri 'self'` de la app y
  el `<base>` de la copia se ignora. Una copia no puede depender de `<base>`: las direcciones se escriben
  absolutas al copiar. **Vive en:** `replicar-reglas.ts` (`absolutizarUrls`, `cssAbsoluto`).
- **Un id de bloque al azar daba 404 en el borrador**: la vista previa sanea en cada pedido y la ruta vuelve a
  sanear para encontrar el bloque. Un id que dos lecturas separadas tienen que reencontrar se DERIVA del
  contenido (hash de la sección y su orden). **Vive en:** `validar.ts`.
- **Phishing con nuestra barra de direcciones** (revisión, MEDIA): HTML libre con `allow-forms allow-popups`
  + «Copia fiel» = cualquier login copiado publicado en `hola-mako.com/l/<slug>`. El origen opaco protege la
  sesión, no el dominio: si Safe Browsing marca la página, puede marcar la app entera. Quedó un FRENO
  (`pideContrasena`: no se copia, no se publica, la ruta contesta 451); un script puede armar la palabra por
  partes, así que lo de fondo sigue pendiente (abajo).

### Dominio propio

- **«Verificado» en Vercel no prueba quién es el dueño**: Vercel sólo mira que el DNS apunte a Vercel, y hay
  UN proyecto para todas las cuentas. El dominio de un cliente exige un TXT `_mako` con un HMAC por landing, y
  una vez verificado no vuelve atrás por una lectura (un DNS que parpadea apagaría un sitio que anda).
- **La API de Vercel no da errores donde uno esperaría**: el CNAME recomendado viene con punto final y es
  propio del proyecto; `recommendedIPv4[].value` es una lista; un dominio que no está en el proyecto contesta
  404; sin `?slug=<equipo>` busca en la cuenta personal; el nombre `mako` sirve como id del proyecto.
- **Un 409 idempotente convirtió un guard en NEGATIVO en una puerta para el DELETE** (revisión, MEDIA).
  «Soltable» era «válido y fuera de `DOMINIOS_DE_MAKO`», y `agregarAVercel` daba por bueno un dominio que ya
  estaba en el proyecto: el día que se sume uno de MaKo que no esté en la lista, cualquier admin lo
  «conectaba» y al «quitarlo» lo sacaba de producción. **Regla: soltar sólo lo que NOSOTROS agregamos** —
  marca `dominio_agregado_por_mako` (mig 0263), puesta sólo con un 2xx a nuestro POST y después de LEER que no
  estaba (si Vercel contestara 200 a uno existente, la marca caería sobre algo ajeno).
- **Cualquier admin podía reservar el dominio de otro para siempre** (revisión, MEDIA): el índice único vale
  también para los pendientes. Ahora un pendiente vence a las 72 h, quien carga SU TXT se lo quita antes, y un
  negocio no tiene más de 5 sin verificar; la quita es un compare-and-set sobre ESE reclamo.
  **Vive en:** `dominios-reglas.ts` (`motivoParaQuitarReclamo`, `pendientesVigentes`), `dominios.ts` (`reclamar`).
- **Las cabeceras globales de next.config y su matcher no miran el host: un dominio propio hereda lo de MaKo**
  (revisión, MEDIA). El HSTS con `includeSubDomains` y dos años le forzaba HTTPS a todos los subdominios del
  cliente: ahora va sólo con `has: [{ type: 'host', value: PATRON_HOSTS_DE_MAKO }]`. **Regla: lo que es de MaKo
  se condiciona con `has: host`, en positivo.** Quedan las redirecciones y los archivos de `public/` (abajo).
- **Un proxy async «por un solo caso» rompía un test ajeno**: `tests/alumno-sesion.test.ts` llama a `proxy()`
  y lee `.status` sin `await`. Lo que necesita la base se resuelve en una RUTA, con una reescritura y una
  cabecera que `seguir` borra. **Vive en:** `proxy.ts`, `app/api/landing-generator/dominio`.
- **Toda ruta que pasa en un host propio verifica que lo pedido sea de ESE dominio**: `/l/html` servía bloques
  de cualquier landing, y la caché host → slug (60 s por instancia) podía servir la landing de otro si el slug
  se liberaba y lo tomaba otra. Las dos comparan el `docId`.
- **Borrar soltaba el dominio DESPUÉS de borrar la fila y leía sin mirar el error** (revisión, BAJA): en el
  hueco otra cuenta lo reclama, y con la base caída se leía «no tiene dominio». Ahora suelta ANTES (si Vercel
  falla, no borra) y sólo tolera la columna que falta (42703). **Vive en:** `server.ts` (`borrar`),
  `reset-workspace.ts` (`vaciarTablas`).

### Diagnóstico

- **«7/100»**: el saneo nuevo asumió 0-100 sin leer el contrato del Landing Analyst (puntúa 0-10). Al consumir
  un dato de otro módulo, se lee su prompt y se miden filas reales.
- **El recorrido señalaba la vista entera**: `dangerouslySetInnerHTML={{…}}` con un objeto nuevo por render
  reescribe el HTML y deja desconectados los nodos guardados. Se memoiza si se guardan referencias de adentro.
- **El `<Recorrido>` de la casa no sirve para un iframe** (decide el scroll mirando la ventana): el recorrido
  le pide a la vista que traiga el bloque (`ir`) y le pregunta dónde quedó (`caja`).
- **Error interno en pantalla («Claude vetado — lib/veto-claude.ts»)**: era la segunda copia del mensaje de
  fallo de IA; todo error de IA hacia la persona va por `errorDeCascada`.
- **Hueco de 300 px**: en modo exportar el bloque HTML va sin el script que mide su alto. Toda vista nueva que
  pinte la landing necesita el script y quien escuche el alto (hoy: editor, publicada y diagnóstico).
- **Abrir el diagnóstico de afuera sumaba una visita** (el Pixel de MaKo y el de Meta iban en el HTML servido):
  `sinPixelDeMako` y `sinRastreadores`. **«Sin ubicar» antes de que cargara el iframe**: «no sé todavía» y «no
  está» eran el mismo `null`; `ubicacion` devuelve `undefined` para lo primero.
- **Una landing nuestra se analiza por `analizarCopy`, nunca por `analizarLanding`**: `landing_analyses` tiene
  una fila por URL y el Panel la listaría «de afuera» (hay un test que lo fija).
  **Vive en:** `lib/editor-landing/diagnostico*.ts`, `app/web-generator/diagnostico/*`, mig 0264.

### Presentaciones, crear y el Panel

- **La diapositiva no crecía**: con `aspect-ratio`, los `min-height` explícitos de la hoja anulan el
  crecimiento automático → en una diapositiva va `min-height: auto`. Y la guía de desbordamiento sale sin
  JavaScript (dos pseudo-elementos con el mismo `aspect-ratio`), apagada en el celular, donde mentía.
- **`formato` se perdía dos veces**: `normalizarParams` y `sanearConfig` reconstruyen campo por campo. Todo
  campo nuevo de `ParamsGeneracion` o `ConfigLanding` pasa por ahí (o se lee crudo).
- **En el PPTX, el texto que no entraba se cortaba arriba** (centrado, PowerPoint desborda para los dos lados):
  si no entra ni achicado, la caja va arriba.
- **El ejemplo que se escribe solo quedaba trabado al cambiar de tipo**: el hook supone una lista fija; si
  cambia, se remonta con `key`. **Y la caja vieja perdía el tipo** (`PedidoCaja` no lo llevaba): toda
  dimensión nueva de un traspaso viaja en la URL.
- **Un guard daba verde con «Nueva landing» repetido** (`indexOf` de la primera): lo que es único se CUENTA.
  **Escribir la vista en la URL con `router.replace` relee la página del server**: va `history.replaceState`.

### Entorno de la corrida

- **tsc no reporta errores de TIPOS si hay uno de SINTAXIS en cualquier archivo**: un verde con un archivo
  ajeno a medias no dice nada.
- **Write/Edit decodificaron ``` en un `String.raw`** (no siempre): después de escribir un escape, buscar
  caracteres crudos con node. **Backticks en `node -e "…"` los ejecuta bash**: los scripts van a un archivo.
- **Dos arneses de roturas solapados se restauran uno al otro**: antes de relanzar, confirmar que el anterior
  terminó (y restaurar reemplazando sólo lo roto, con las anclas en el fin de línea de cada archivo).
- **El número de migración se mira también en los worktrees vivos, no sólo en `origin/main`**: el 12/10 la
  0258 estaba libre en main y la tenía `git add -N` la sesión del CRM en su worktree; la de Graphics, de la
  0260 a la 0262. Estas dos se renumeraron a 0263/0264 antes de aplicarse.

### Lo que quedó sin hacer (tanda 2)

- **`VERCEL_API_TOKEN` y `VERCEL_TEAM_SLUG` en producción**: sin ellas la pestaña dice «no está activado en
  MaKo». El token de `.env.local` es de mbustos (un cliente): decide Martín cuál va. `lib/editor-landing/dominios.ts`
  (`configVercel`).
- ~~**Las redirecciones de `next.config.ts` corren antes del proxy en un dominio de cliente**~~: hecho en la
  tanda 4 (`has: host` de la app con `.map(enLaApp)`, abajo).
- **El matcher de `proxy.ts` no corre en rutas con sufijo de archivo**: en el dominio del cliente se sirven
  `/_next/*`, el `favicon.ico` de MaKo, `/m.js`, `/sw.js`. Un rewrite `beforeFiles` con `missing` host de MaKo
  hacia un 404. `proxy.ts` (matcher), `next.config.ts`. Medido en la tanda 4 y sigue pendiente (por qué, abajo).
- ~~**Servir `/l/html` desde un dominio aparte, sólo para contenido de usuarios**~~: hecho en la tanda 4 (las
  landings y su `/l/html` viven en hola-mako.site; en producción hola-mako.com ya no lo sirve).
- ~~**Los popups del bloque heredan el sandbox** (un checkout ajeno puede fallar): decidir con Martín
  `allow-popups-to-escape-sandbox`~~: hecho en la tanda 7 (`e80b9f1ae`, `SANDBOX_PUBLICO`). ⚠️ Esa constante
  también era la política de la página de AFUERA del Diagnóstico, en el origen de la app: ver «Tanda 7» → «La
  seguridad de la página de afuera».
- ~~**La pestaña «Dominios» no avisa que una reserva venció**~~ (hecho en la tanda 6); ~~el `www.` no se agrega
  solo~~ (tanda 7: se suma redirigiendo, con sus trampas en «Tanda 7»); los subdominios `<slug>.hola-mako.com`
  quedan para Martín. `dominios-reglas.ts`.
- **«Probar nuevo diseño» no recibe el formato** (el server `disenos` no toma params) y **el PDF de una
  presentación sale vertical**. `lib/editor-landing/ia.ts`, `exportar-pdf.ts`.
- **Las rutas `analyze`, `sync` y `pulso` del Landing Analyst no miran el rol** (quedó como tarea aparte).
  `app/api/landing-analyst/*`.
- **Una página armada como app** (`html/body` al 100% con scroll interno) queda en 400 px por sección en la
  copia fiel. **Sólo se analiza la página de inicio** y el puntaje de una landing nuestra no se guarda.
  `replicar-reglas.ts`, `diagnostico.ts`. ~~Una landing con dominio propio analizada en `https://<dominio>`
  aparece «de afuera»~~: hecho en la tanda 4 (`LandingResumen.dominio`, sólo el verificado; `docDeUrl`).
- **Verlo con clics**: la tira en Chrome de Windows (6-9 secciones con imágenes, al borde de scrollear, sin
  «ResizeObserver loop» en la consola), Presentar, guardar sugerencias reales (con la 0264 ya aplicada) y la
  conexión real a Vercel. Y la cascada de IA del ws1: el Landing Analyst no tiene un proveedor gratis que
  conteste (decide Martín).

## Tanda 3 (12/10/2026): diseño contra copy, herramientas de MaKo y la barra entre secciones

Pedido de Martín, con una captura del editor: «Revisa que entre las secciones, donde dice "agregar
sección", está mal... Se oculta y no se ven los botones», «aproveches las herramientas que tenemos dentro
de MaKo, como por ejemplo, embed de calendly, de cal, de stripe, de mercado pago, del VSL ya sea en
YouTube, Panda, Vimeo» y «en las plantillas confundiste la plantilla de DISEÑO, con el COPY... al darle a
una, puede salir un pop-up... que te pregunte de que quieres crearla». Hecho sin agentes.

- **La barra «＋ | ✨ | ▾» de la sección activa quedaba tapada por la sección de ABAJO.** En página
  continua las secciones van pegadas y la barra se centraba sobre el borde (`translate(-50%, -50%)`): su
  mitad de abajo caía sobre la sección siguiente, que se pinta después. Su `z-index: 6` no servía: cada
  `.gm-tarjeta` lleva `isolation: isolate` (css.ts), así que ese 6 se resuelve ADENTRO de la sección y no
  contra la vecina. **Regla: algo que cuelga del borde de una caja con `isolation` (o cualquier contexto de
  apilamiento) no le gana a la hermana de abajo por su z-index propio; o va adentro, o la caja entera sube
  de capa.** Va las dos cosas: la barra adentro, pegada abajo, y la sección activa con `z-index: 3`.
  **Vive en:** `app/web-generator/editor/extensiones/estilos-nodos.ts`.
- **Las «plantillas» eran COPY con un tema pegado**: diez objetivos (agendar, webinar, lead magnet…), cada
  uno con su tema fijo, así que elegir cómo se VE era elegir qué DICE. Ahora son dos ejes que se cruzan al
  crear: `DISENOS_LANDING` (tema + hero + zigzag de las imágenes) y el objetivo (el copy de
  `PLANTILLAS`, por id). `landingDesde(diseño, objetivo)` arma el contenido; la caja de crear y la galería
  del Panel muestran los diseños y preguntan el objetivo en un pop-up (`DialogoObjetivo`). Las
  presentaciones no cambian (ahí la plantilla sí es una pieza entera). El `origen.plantilla` guarda
  `<diseño>:<objetivo>`. **Vive en:** `lib/editor-landing/disenos-landing.ts`, `app/web-generator/crear/`.
- **Las herramientas de MaKo entran VACÍAS y sin un bloque nuevo**: la agenda (Calendly o Cal.com) y el VSL
  (YouTube, Panda, Vimeo, Wistia) son el `insertado` de siempre con su proveedor de entrada (lo decide
  después el enlace que se pegue, `lib/embeds.ts`); el pago es un botón «Pagar ahora» al que se le pega el
  link de Stripe o Mercado Pago. Un `insertado` con `src` vacío pasa el saneo del server sin descartes:
  medido sobre los 80 cruces diseño × objetivo (`tests/editor-landing-disenos.test.ts`). En el menú de
  bloques son la categoría «Herramientas de MaKo» (Agenda, VSL, Botón de pago). **Vive en:**
  `lib/editor-landing/catalogo-bloques.ts`, `app/web-generator/editor/insertar.ts`.
- ~~**Sin hacer**: el botón de pago no arma el link desde la pasarela de MaKo (`lib/cobros.ts`, `crearCobro`):
  la persona pega el suyo.~~ Hecho en la tanda 4 (abajo). Sigue faltando mirarlo con clics (la barra en una
  sección del medio y en la última, y el pop-up desde el Panel y desde la caja).

## Tanda 4 (14/10/2026): el botón de pago por la pasarela de MaKo

Pedido: que el «Botón de pago» cobre por la pasarela del negocio (Stripe / Mercado Pago, `lib/cobros.ts`) en
vez de llevar a un link pegado. Decisión de Martín (14/10): antes del checkout se le piden NOMBRE y EMAIL a
quien paga. Y lo que pidió respetar «Integraciones», dueño de `lib/cobros.ts` (que no se tocó): monto, moneda,
montoUsd y altaCapa nunca salen del pedido; un lead por email exacto; el pendiente se compara antes de
reusarse; los errores de `crearCobro` son para el dueño; topes. El recorrido: el botón guarda
`pago:<productoId>` → la foto publicada congela qué productos ofrece → el render lo escribe
`<base>/pagar/<id>` → el paso (`app/l/[slug]/pagar/[bloque]`, HTML sin JavaScript) → el POST
(`app/api/landing-generator/pagar`, exacta en PUBLICOS) → 303 al link `/pagar/<token>`.

- **«Cobrado por MaKo» va en el `href` del botón, no en un atributo nuevo.** Lo obvio era `productoId` en
  `AttrsBoton`, y eran cuatro puertas: el tipo, el normalizador, la extensión de TipTap (con
  `parseHTML: () => null`) y lo que lee el NodeView; la que se olvide hace que `nodeFromJSON` tire el
  atributo en silencio y el autoguardado lo pise. `pago:<productoId>` viaja por el `href`, que ya pasa por las
  cuatro y por el saneo, igual que `pagina:<id>`. SÓLO el botón lo conoce (`attrsBoton` → `hrefPagoValido`):
  `hrefPermitido` no, así que un enlace de texto, una imagen o la barra del sitio no pueden apuntar a un
  pago que nadie resolvería. **Regla: antes de sumarle un atributo a un nodo, mirar si el dato cabe en uno que
  ya cruza el esquema y el saneo.** **Vive en:** `lib/editor-landing/especificacion.ts` (`attrsBoton`,
  `specBoton`), `lib/editor-landing/pago-landing.ts`.
- **«Editar con IA» se comía el botón de pago, sin error.** La gramática (`destinoBoton`) valida el destino con
  `hrefPermitido`, y lo que no conoce lo manda al formulario: la vuelta de la IA dejaba el botón apuntando a
  `#t-<formulario>`. Toda forma nueva de destino de un botón entra también ahí (tiene test). **Vive en:**
  `lib/editor-landing/ia-bloques.ts`.
- **La URL del paso sale de la base del render, no se arma a mano**: `resolverHref` escribe
  `<urlBase>/pagar/<id>` (`urlPasoPago`), la MISMA base de los `pagina:` (hoy `https://hola-mako.com/l/<slug>`;
  la mudanza a hola-mako.site cambia esa base en `publicar.ts` y el botón la sigue). Sólo con `pagos: true`
  (lo pide `armarFoto` al publicar): en la vista previa y al exportar el botón queda en `#`, porque
  `/l/vista/<tok>/pagar/…` no existe y un `pago:` crudo en un `<a>` haría que el navegador busque una app.
  ⚠️ **En un dominio propio el botón de pago NO se reescribe al dominio** (revisión, ALTA; abajo, «El botón
  de pago en un dominio propio»): queda en la base de MaKo. Si algún día el proxy sirve el paso en el
  dominio, ojo: `https://cliente.com/pagar/<id>` choca con `app/pagar/[token]` (el link de un cobro); se
  reescribe al paso y nunca a `app/pagar` (un id de producto son dígitos; un token, 32 base64url).
  **Vive en:** `lib/editor-landing/render.ts`, `dominios-reglas.ts` (`conEnlacesDelDominio`).
- **La foto congela qué se ofrece (`publicado.pagos`), y `leerFoto` no lo copia.** El POST sólo cobra un
  producto que la landing PUBLICADA ofrece (un visitante no elige qué producto del catálogo se le cobra).
  `leerFoto` reconstruye la foto campo por campo y deja afuera lo que no conoce (`pagos`, igual que
  `htmlLibre`): se lee de la fila CRUDA (`productosDeFoto`). Una foto publicada antes de la tanda 4 no cobra
  nada hasta que se republique. **Vive en:** `lib/editor-landing/publicar.ts`, `server-reglas.ts`,
  `pago-landing-server.ts`.
- **Mercado Pago NO cobra desde una landing, y no es un olvido.** Cobra en la moneda del sitio de su cuenta
  (ARS, MXN…) y `productos` sólo tiene `monto_usd`: `decidirCobro` exige el monto explícito en esa moneda, y
  acá el monto no sale del pedido (nunca una tasa inventada). Es la misma decisión que la API de MaKo para
  `crear_link_pago`. Con sólo Mercado Pago, el control del botón y Publicar lo dicen y mandan a conectar
  Stripe. **Vive en:** `lib/editor-landing/pago-landing.ts` (`pasarelaDeLanding`, `motivoNoCobra`).
- **Cuando SÍ se cobra, el lead NO cae a propuesta (a diferencia del opt-in)** — cuando no se puede cobrar, sí
  (revisión, abajo). El opt-in, ante un duplicado, deja una propuesta y no hay `leadId`; un cobro EXIGE uno. Se busca ANTES por email EXACTO (`ilike` con `%`, `_` y la barra
  invertida escapados trae candidatos; decide `emailComparable`, y con dos fichas gana la más vieja) y en
  lectura ESTRICTA: `duplicadosDeLead` traga el error y devuelve `[]`, que acá crearía una segunda ficha de la
  misma persona. Si `createLead` choca igual (otro pedido en el medio), se vuelve a buscar. Se crea por el
  camino del opt-in (`createLead` con `origen_lead: 'landing'` y la casa del producto principal de la página)
  aunque el negocio no haya declarado la landing como entrada de leads: alguien escribió su email para PAGAR.
  ⚠️ Trampa menor: `esLeadDuplicado` vive en `lib/leads-duplicados.ts`; `lib/leads.ts` no lo re-exporta.
  **Vive en:** `lib/editor-landing/pago-landing-server.ts` (`leadDeQuienPaga`), `pago-pedido.ts` (`leadPorEmail`).
- **`cobroPendienteDelLead` no sirve para decidir si se reusa**: devuelve el pendiente más nuevo de CUALQUIER
  producto, y además un pendiente viejo puede tener el precio de antes. Se listan los `pendiente` del lead y se
  reusa sólo el del MISMO producto, pasarela, monto, moneda y tipo (`cobroReusable`). **Vive en:**
  `lib/editor-landing/pago-pedido.ts`, `pago-landing-server.ts` (`pagarDesdeLanding`).
- **`form-action` se aplica a las REDIRECCIONES del envío (Chrome).** El POST rebota dos veces (303 →
  `/pagar/<token>` de la app → el checkout de Stripe): la política del paso nombra `'self'`, el origen de la
  app y los checkouts, o el navegador corta el último salto y queda una página en blanco con el pago a medio
  camino. ⚠️ NO MEDIDO en un navegador (en este worktree no se levantó `next dev`): es lo primero a mirar con
  clics. **Vive en:** `lib/editor-landing/pago-pagina.ts` (`politicaPasoPago`, `ORIGENES_CHECKOUT`).
- **El Origin, en positivo, y `*.vercel.app` no es MaKo.** `esHostDeMako` incluye `*.vercel.app` (para el
  proxy está bien: son los deploys), pero ese sufijo es de CUALQUIER cliente de Vercel: para el POST sólo vale
  el deploy que contesta. Un dominio propio vuelve como `dominio` y se confirma contra `landingDeDominio` de
  ESA landing. No es una barrera contra un script (el Origin se falsifica con curl): lo que frena el abuso son
  los topes (por IP 10 cada 10 min, por email 5 por hora; en memoria por instancia) y el campo trampa — cada
  pedido crea un checkout en el Stripe del cliente. **Vive en:** `lib/editor-landing/pago-pedido.ts`
  (`origenDelPago`), `pago-pagina.ts` (`responderPagoPost`).
- **Al visitante, una frase; el motivo real, al dueño.** Los errores de `crearCobro` están escritos para el
  dueño («Stripe: …») y van al historial del lead. El paso muestra el formulario aunque hoy no se pueda cobrar
  (sin Stripe, sin precio): el POST deja una PROPUESTA de contacto con «quiso pagar X y no se pudo: <motivo>»
  en el resumen (desde la revisión: antes era una ficha directa), y el visitante lee «Este pago no está
  disponible en este momento. Ya tenemos tus datos.» Un producto que ya no está activo, en cambio, no se
  ofrece (no hay qué mostrar). **Vive en:** `lib/editor-landing/pago-pagina.ts`, `pago-pedido.ts`
  (`ejecutarPago`), `pago-landing-server.ts`.
- **Un módulo que importa el editor no puede importar del CRM**: `emailComparable` (`leads-duplicados`) arrastra
  `lead-funnel-reglas` → `funnel-fila` → `pipeline` (mil líneas) al bundle del editor, porque
  `especificacion.ts` y `render.ts` viajan al navegador. Lo del botón vive en `pago-landing.ts` (liviano) y lo
  del pedido en `pago-pedido.ts` (sólo server y tests).

### Lo que quedó sin hacer (tanda 4)

- **El paso de pago no se sirve EN el dominio propio**: desde la revisión, el botón de una landing con dominio
  lleva al paso en la base de MaKo (antes llevaba a un 404). Servirlo en el dominio es reescribir el GET
  `/pagar/<id>` a `app/l/[slug]/pagar/[bloque]` con el slug de ese dominio (la ruta ya se niega a servir una
  landing de otro dominio), dejar pasar el POST, y recién ahí sacar el `(?!/pagar/)` de `conEnlacesDelDominio`.
  `lib/editor-landing/dominios-reglas.ts` (`decidirHost`, `conEnlacesDelDominio`), `proxy.ts`.
- **hola-mako.site**: `HOST_SITIOS` (`lib/editor-landing/pago-pedido.ts`) repite el host. La mudanza (rama
  `landing-dom`, sin integrar el 14/10) ya lo declara: `HOST_LANDINGS` / `esHostDeLandings` en
  `lib/editor-landing/origen-landings.ts`, y `esHostDeMako` lo incluye (con eso nadie puede reclamar
  hola-mako.site en «Dominios»). Al integrarla: en `origenDelPago`, `esDe(host, HOST_SITIOS)` pasa a ser
  `esHostDeLandings(host)` y `HOST_SITIOS` se borra. No se hizo acá para no dejar dos declaraciones.
- **API de MaKo**: «configurar el botón de pago de un bloque» no está en el registro
  (`lib/api-mako/areas/landing.*`, en construcción en otro worktree). Es poner `href: hrefDePago(id)` en un
  `boton` (helpers puros de `pago-landing.ts`).
- **La vista previa no cobra** (el botón queda en `#`). Cuando alguien quiso pagar y no se pudo, desde la
  revisión queda una propuesta y le llega el aviso de las propuestas; cuando falla la PASARELA (Stripe rechaza),
  sigue quedando sólo en el historial del lead, sin aviso en el momento.
- **Verlo con clics**: elegir el producto en el panel «Destino», el rótulo y la advertencia, Publicar con y sin
  Stripe, el paso en un celular (tema, teclado), y el POST hasta el checkout de Stripe en modo prueba
  (incluido el `form-action` en Chrome).

### Revisión adversarial de la tanda 4 (14/10/2026)

Un revisor leyó el diff entero y ejecutó lo que se podía ejecutar; se aplicó lo confirmado de severidad alta y
media, y lo bajo de una línea. Lo que costó entender, por tema:

- **El botón de pago en un dominio propio llevaba a un 404, y el hallazgo de arriba lo daba por «pendiente».**
  El diagnóstico escrito el mismo día decía «el dominio propio no cobra todavía: `decidirHost` contesta 404»,
  como si fuera una feature que faltaba. Era una ROTURA activa: al servir en el dominio, `conEnlacesDelDominio`
  reescribía TODO lo que colgaba de la base de MaKo, el botón incluido, a `https://<dominio>/pagar/<id>`, y ahí
  el proxy contesta «Parece que esta página no existe (404)». En hola-mako.com/l/<slug> el mismo botón andaba,
  así que el dueño, probándolo, lo veía funcionar. **Regla: una reescritura al servir se prueba contra lo que
  el proxy contesta a CADA enlace reescrito**, no contra el texto. El test recorre publicar → servir en el
  dominio → `decidirHost` por enlace. **Vive en:** `lib/editor-landing/dominios-reglas.ts`
  (`conEnlacesDelDominio`, con `(?!/pagar/)`), `tests/editor-landing-pago.test.ts`.
- **Un formulario sin JavaScript tiene doble clic, y «buscar y si no está, crear» sin candado lo duplica.** El
  comentario decía «un doble clic sigue en el mismo checkout», cierto sólo si los dos POST llegan uno después
  del otro. Ni `leads` tiene un único por email ni `cobros` uno por (lead, producto, pendiente), así que dos a
  la vez dejaban dos fichas y dos Checkout Sessions. El arreglo es un CANDADO por (negocio, email) en la base:
  una fila `en_curso` con un índice único PARCIAL (`landing_pago_pedidos`, mig 0276); el segundo choca (23505),
  espera y encuentra lo que dejó el primero. Por NEGOCIO y no por landing: la ficha es del negocio. Trampas:
  - **Un índice único parcial no sirve de blanco de un `ON CONFLICT`**: el candado es un INSERT que se deja
    chocar y se lee el 23505, no un upsert.
  - **`select(..., { head: true })` que falla vuelve sin cuerpo**: sin el código no se distingue «la tabla no
    está» (PGRST205/42P01, se tolera: corre como antes y lo dice en el log) de «la base se cayó» (tira). El
    conteo va sin `head`.
  - **Un candado colgado (la función murió) se suelta a los 90 s**, más que el `maxDuration` de la ruta; uno
    vivo hace esperar hasta 20 s y rendirse con un fallo, sin tocar el CRM. La espera tiene plazo SIEMPRE: un
    bucle que sólo sale por «se soltó» cuelga la función.
  - **El orden se testea con un CRM de mentira cuya lectura y alta NO son atómicas** (dos vueltas del bucle en
    el medio): con uno síncrono la carrera no existe y el test da verde sin candado.
  **Vive en:** `lib/editor-landing/pago-pedido.ts` (`ejecutarPago`, `conCandado`), `pago-landing-server.ts`
  (`candadoDePago`), `supabase/migrations/0276_landing_pago_pedidos.sql`, `tests/editor-landing-pago-candado.test.ts`.
- **Un POST público creaba fichas en el CRM del cliente aunque no se pudiera cobrar.** Sin `entradas`, sin
  propuesta, ANTES de mirar si el producto cobraba, y con topes que viven en la memoria de cada instancia
  (lib/rate-limit.ts los declara «best-effort»; el Origin se falsifica con curl). Sin cobro no hace falta una
  ficha: queda una PROPUESTA (`ref` = landing + producto + email, no se duplica; el dueño recibe el aviso de
  siempre y la confirma en /crm/revisar) y el visitante lee lo mismo. Y un techo por landing y hora contado en
  la BASE (`TECHO_PAGOS_HORA`, 120). **Vive en:** `pago-pedido.ts` (`ejecutarPago`), `pago-landing-server.ts`
  (`proponerQuienQuisoPagar`, `usosDeLaHora`).
- **Reusar un pendiente por un email que nadie verifica entregaba cobros del DUEÑO.** `cobroReusable` no miraba
  de quién era el cobro: quien tipeaba el email de un lead recibía el token de un pendiente armado desde la
  ficha o la API, y uno con alta de MaKo habilita el cambio de email de la cuenta (app/pagar/cambio-email.ts).
  Ahora sólo se reusa lo que creó ESTA landing (`esDeLaLanding`, por el slug: cambiarle el título no huerfana
  el pendiente) para ESTE email, sin `alta_capa`. **Vive en:** `pago-pedido.ts` (`cobroReusable`).
- **«Editar con IA» podía cambiar QUÉ producto cobra un botón.** `destinoBoton` aceptaba cualquier `pago:<id>`
  del modelo: un dígito cambiado cobraba otro producto, sin descarte. Ahora vuelve sólo un producto que ya
  cobraban los botones de las secciones ORIGINALES (todas, sobre la landing entera: moverlo de sección no es un
  producto nuevo); al generar, ninguno. **Vive en:** `lib/editor-landing/ia-bloques.ts` (`pagosDe`).
- **El campo trampa se llamaba `sitio_web`**, que es lo que un autocompletado llena solo: un comprador real
  perdía el pago sin rastro. Ahora `mk_q7`, y el test lo fija contra palabras de autocompletado.

### Lo que quedó sin hacer (revisión de la tanda 4)

- **Aplicar la mig 0276 ANTES o JUNTO con el deploy** (sin ella corre sin candado ni techo, como antes). Y
  revisar el número al integrar: el 14/10 la 0275 la tenía el worktree de chats.
- **Nadie poda `landing_pago_pedidos`** (con el techo, como mucho 120 filas por landing y hora). Un cron que
  borre lo terminado de más de unos días. `supabase/migrations/0276_landing_pago_pedidos.sql`.
- **Los rechazos del POST no dejan rastro consultable** (trampa, Origin, topes, tamaño: a lo sumo un
  `console.warn`). AGENTS.md: «una política puede RECHAZAR; no puede no dejar rastro». Va un contador por
  landing y día con el motivo, sin datos personales, y mostrarlo donde el dueño ve la landing. Cuidado: los
  rechazos de antes de leer la landing (Origin, trampa) no saben de qué negocio son, y escribir una fila por
  cada uno le abre a un bot una escritura por pedido. `lib/editor-landing/pago-pagina.ts` (`responderPagoPost`).
- **La atribución del anuncio se pierde en la conversión más cara**: el lead que nace por el botón de pago no
  lleva `utm_*`, `fbclid` ni `visitor_id` (el href del paso es fijo y el paso no tiene el Pixel). Que el Pixel
  decore los enlaces `/pagar/` con lo que ya guarda y el paso los pase, saneados, a `createLead`. Es del Pixel
  (versión nueva del snippet): `lib/landing-token.ts`, `render.ts`, `pago-pagina.ts`.
- **La cadena de pago termina en hola-mako.com** (el 303 a `/pagar/<token>` y el regreso de Stripe salen de
  `APP_BASE_URL`, lib/cobros.ts:62-64): desde un dominio propio o hola-mako.site, el comprador sale del dominio
  del cliente y al terminar no vuelve a la landing; el «Volver» del paso apunta a hola-mako.com/l/<slug>. Hay
  que darle a `crearCobro` una base de retorno del host que sirvió la landing: es de «Integraciones», dueño de
  lib/cobros.ts.
- **`form-action` y un checkout de Stripe con dominio propio** (NO medido): la política nombra sólo
  `checkout.stripe.com` como destino final; si Chrome corta un 302 a `pay.sunegocio.com`, queda una página en
  blanco con el cobro creado. Medir en Chrome y Safari antes de tocar. `pago-pagina.ts` (`ORIGENES_CHECKOUT`).
- **`cobroReusable` no compara el `modo`** (prueba/real): un pendiente de prueba reusado después de pasar a
  claves reales manda a un checkout de prueba. Hace falta el modo de la clave actual, que sólo lee lib/cobros.ts.
- **API de MaKo**: «el botón cobra el producto X» sigue sin declararse (lo construye el worktree de
  `landing-api`, `lib/api-mako/areas/landing-editor.helpers.ts`), con `confirmacion: 'pantalla'`,
  `rolMinimo: 'admin'` y el producto validado contra `listProductos(true)` del workspace.

## Tanda 4 (14/10/2026): el área landing de la API de MaKo

Regla de Martín (13/10): «toda feature nueva va a la API de MaKo». Listar, ver y publicar landings del
editor existían para la pantalla y no para ningún agente. Ahora hay seis operaciones en el área `landing`
del registro (`lib/api-mako/areas/landing.def.ts` / `.run.ts`, lo puro en `landing-editor.helpers.ts`):
`listar_landings_creadas`, `ver_landing_creada`, `listar_disenos_landing`, `crear_landing_desde_diseno`
(chat), `despublicar_landing` (chat) y `publicar_landing` (pantalla). Test:
`tests/api-mako-landing-editor.test.ts` (14 + 1 todo, 17 roturas; siete de la revisión adversarial del 14/10).

- **«Declarar el área landing» no era crear un área: ya existía, y con la MISMA palabra para otra cosa.**
  El área tenía 33 operaciones sobre las landings DECLARADAS en Integraciones (el Pixel, el diagnóstico de
  afuera) y las versiones del generador anterior (`landing_drafts`). Las del editor (`landing_docs`) son
  una tercera lista. `registro.ts` no cambió. **Regla: cada descripción nombra las otras dos listas**
  («no son las declaradas, eso es listar_landings…») y el recurso REST es `documentos`, porque `landings`
  ya es el de las declaradas. **Vive en:** `landing.def.ts`, `lib/api-mako/rest.ts`.
- **⚠️ Por WhatsApp, la frase natural NO llega (bloqueante, otra área).** Medido con el turno que corre:
  «publicá la landing del webinar», «despublicá…», «sacá de internet…» y «creame una landing de webinar»
  salen `capturar` dudosa, con 2 herramientas y ninguna de landing. Sí llegan «qué landings tengo
  creadas?» (lecturas), «subí los cambios de mi landing» (`subí` está en `ACCION_CUENTA_RE`) y «armame una
  landing para…» (`armame` es imperativo). Causa: el clasificador no conoce `publicá`/`creá` ni el objeto
  «landing». Arreglo medido sobre una COPIA (sin tocar el archivo): `esPedidoDeLanding` en
  `lib/mako-intencion.ts`, como `esPedidoAutomatizacion` (objeto a ≤3 palabras de un verbo, sin otro objeto
  en el medio: «armame un anuncio para la landing» sigue siendo de Ads). El test lo espera como `todo`.
  Costo conocido, el mismo que acepta `esPedidoAutomatizacion` con «crea»: la tercera persona sin tilde
  («mi socio publica la landing el lunes») también se lee como pedido. No ejecuta nada (publicar va en
  pantalla); si molesta, se exige tilde o pronombre y se pierde el tuteo («publica mi landing»).
- **Publicar va en pantalla: la DIRECCIÓN viaja en el input, la versión se lee al confirmar.** La genérica
  `/mako/revisar` guarda el INPUT de la propuesta (no el payload) y vuelve a correr `preparar()` al
  confirmar: todo lo que `preparar()` CALCULA se calcula otra vez. Con la versión es a propósito (se
  publica lo guardado al confirmar, como el botón del editor; no hay parámetro `version`). Con la dirección
  sugerida era el bug (revisión del 14/10, MEDIA): una landing que nunca se publicó, pedida sin `slug`,
  mostraba en el resumen `/l/webinar-marzo` y se publicaba en `/l/webinar-abril` si la renombraban, o en
  `/l/webinar-marzo-2` si otro negocio la tomaba en el medio; el campo «Dirección» del formulario estaba
  vacío. El autor lo había dejado escrito como ⚠️ y lo leyó como una molestia del título: era publicar en
  una URL que nadie revisó. Ahora sale de la pedida o de la que ya tenía (`direccionParaPublicar`); sin
  ninguna, `preparar()` contesta la sugerida con `faltan: ['slug']` (y en el texto, porque por HTTP directo
  sólo viaja el texto) y el modelo la pasa: queda fija, a la vista y editable.
  **Regla: en una acción de pantalla genérica, lo que la persona tiene que VER antes de confirmar va en el
  input; nunca se deriva en `preparar()`.** Con un token detallado de escritura o en un flujo no hay
  revisión: se publica en el acto (decisión del 08/10; la descripción lo dice).
  **Vive en:** `landing-editor.helpers.ts` (`direccionParaPublicar`), `landing.run.ts`, `lib/api-mako/acciones.ts`
  (`proponerPantallaGenerica` guarda el input).
- **«Ya está publicada así» es `yaEstaba` SÓLO sin una persona** (un flujo o un token por HTTP). Cada
  publicar deja una versión «Publicada» de hasta 1,5 MB que `podarVersionesAuto` NO poda: lo que corre solo
  y en bucle la llenaría. Pero la foto también hornea lo que cambia SIN subir la versión (un TEMA PROPIO,
  `app_settings landing.temas`), y la pantalla deja republicar igual: rechazárselo a una persona era una
  regla que la pantalla no tiene (revisión del 14/10). A una persona se le deja, y el resumen dice «sin
  cambios guardados nuevos: se vuelve a armar y toma los temas propios de hoy». ⚠️ Un flujo o un token
  siguen recibiendo «ya está así» después de cambiar un tema: se republica desde el editor o desde el chat.
- **Un error de la base salía como 400 crudo a un tercero** (revisión del 14/10). `esNuestro`
  (`lib/api-mako/ejecutar.ts`) sólo clasifica lo que se TIRA: un runner que devuelve el error de la lib como
  texto (`errorLectura(...)`, el `{ error }` de `preparar()`) lo saltea, y `GET /landing/documentos` con la
  base cortada contestaba 400 «Error leyendo landing_docs… statement timeout», que el integrador lee como
  suyo. **Regla: un status ≥ 500 del server de la pantalla se tira con el prefijo `api-mako:`**
  (`siFallaNuestra`): sale 500 genérico y el detalle va a la consola. Los resúmenes de `ejecutar()`
  siguen con el texto (el patrón de todo `landing.run.ts`); por HTTP directo `rutas-http.ts` sí los pasa por
  `esNuestro`.
- **Lo que la revisión del 14/10 marcó y NO se aplicó, y por qué** (para no volver a abrirlo):
  - «`crear_landing_desde_diseno` se ofrece como ⚡ Acción en los lienzos y siempre falla: sumarla a
    `NO_EN_FLUJOS`». El diagnóstico obvio era el equivocado: el selector del lienzo sólo ofrece la lista
    corta `ACCIONES_DEL_FLUJO` (`lib/editor-acciones.ts`) y «Crear con IA» su `LISTA_BLANCA_IA`
    (`lib/flujo-ia-crear.ts`); ninguna trae landings. Las demás vienen en el catálogo con `curada: false`
    sólo para dibujar un paso ya guardado. Un paso así (armado por la API) lo frena `preparar()`, como el
    precedente del Dashboard (`noEnFlujo`, docs/hallazgos-api-mako.md). Y `flujo.ts` es de otra área.
  - «Usar `d.urlPublica` y `r.url` del server en vez de `urlDeLanding`». Cambiar dos lugares dejaría, al
    integrar `landing-dom`, la lista con una dirección y la lectura con otra para la misma landing. La guarda
    de la integración ya existe (el test de `landing-dom` que frena a quien importe `urlPublica`); queda el
    pendiente de abajo.
  - «Despublicar calla el dominio propio y que deshacer sube el borrador»: cierto, pero no es una línea
    (abajo, en lo que quedó sin hacer).
- **Lo que `publicar()` rechaza por el contenido se dice en `preparar()`** (sin páginas, HTML que pide
  contraseña), con las MISMAS funciones puras que usa él (`paginasParaPublicar`, `fuentesHtmlLibre`,
  `pideContrasena`): en `ejecutar()` consume la propuesta. El tope de 10 MB recién se sabe renderizando.
- **El autor de lo creado por la API sale de la COOKIE.** `crearEn` usa `getUsuarioActual()`: por
  WhatsApp o HTTP `creado_por` queda null; desde la bandeja, quien confirmó. En un flujo (sin request)
  `cookies()` tira: crear ya se frena antes (`enFlujo`, un flujo corre una vez por lead).
- **El diagnóstico de una landing propia son sus comentarios, sin puntaje.** `ver_landing_creada` los
  trae por `diagnostico-server.listar` (pendientes primero, por severidad). `ultimo_comentario_el` es la
  fecha del comentario más nuevo, NO del último análisis: uno que no deja nada nuevo no deja rastro. Y si
  la lectura falla sale `leido: false`, que no es «nunca se diagnosticó».
- **`abrir()` no dice si está en la papelera** (la pantalla no abre desde ahí): se lee aparte.
- **Topes de lo que ve el modelo**: 1.500 caracteres por sección, 20.000 en total, 12 comentarios. Ni el
  doer ni el runner recortan un tool_result.
- **Por HTTP sale todo** (decidido): es contenido del propio negocio; el nombre de quien creó cada landing
  (dato del equipo) no viaja en ninguna salida.
- **Entorno: el working copy es CRLF y la consola de Bash no lo muestra.** `grep -c $'\r'` y `od -c`
  daban 0, y node leía `\r\n` (`core.autocrlf=true`). Un script con anclas `\n` no encontraba nada y el
  diagnóstico obvio fue «Bash se comió las barras» — que TAMBIÉN pasa (en un heredoc, `\\s` llega `\s`).
  **Regla: un script que parchea normaliza `\r\n` antes de buscar, y se escribe con Write, no con heredoc.**

### Lo que quedó sin hacer (tanda 4)

- ~~**BLOQUEANTE: `esPedidoDeLanding` en `lib/mako-intencion.ts`**~~: hecho en la tanda 7 (`8e053b359`; los
  pedidos de EDITAR, en `1412d13ee`). Va como regla 5-bis, ANTES de la 6: la 6 («links sin instrucción») guardaba
  «replicá esta página https://…» como material. El `todo` ya corre.
- **⚠️ pasar a urlPublicaLanding al integrar** (las publicadas se mudan a https://hola-mako.site/<slug>):
  `urlDeLanding` en `lib/api-mako/areas/landing-editor.helpers.ts`. Y `aCompleta` (server.ts) y
  `publicar()` (publicar.ts) arman la suya con `urlPublica(APP_BASE_URL, …)`. Al cambiarla, la aserción
  `urlDeLanding('mi-oferta') === urlPublica(APP_BASE_URL, …)` de `tests/api-mako-landing-editor.test.ts`
  pasa a compararla con `urlPublicaLanding`. Si nadie lo hace, la API le da al dueño `hola-mako.com/l/<slug>`,
  que en producción hace un 308 a `hola-mako.site`: la URL que pega en los anuncios redirige.
- **El resumen de `despublicar_landing` calla dos cosas** (`landing.run.ts`, su `preparar()`): que el
  dominio propio verificado también deja de mostrarla (`app/api/landing-generator/dominio` sirve
  `leerPublicado(slug)`, que da null sin foto), y que «volver a publicar» sube el BORRADOR guardado, no lo
  que estaba en internet (lo de antes vuelve restaurando la versión «Publicada» desde la pantalla). Para
  decirlo, leer `version, publicado_version` (fácil) y `dominio, dominio_estado` con la trampa de `borrar`
  en `server.ts`: sin la migración 0263 la columna no existe y un select que la nombra tira 42703, así que
  va en una lectura aparte que tolera ese código (y en el server de la pantalla, no en el runner: el test
  frena un `.from(` ahí). `estadoDominio` (`dominios.ts`) NO sirve para un resumen: sale a Vercel y al DNS
  y puede escribir el estado. Y decidir si sigue `reversible: true` (el test lo fija hoy).
- **El dominio propio no está en `url_publica`**: una landing con dominio verificado sale con la de MaKo.
- ~~**Fuera de la API, a propósito**: generar con IA, editar o guardar el contenido~~: Martín lo reabrió el 15/10
  («Todas las funciones a la API de MaKo») y entró en la tanda 7 (`514f84468`, 40 operaciones); lo que sigue afuera,
  con su motivo, en docs/hallazgos-api-mako.md → «El editor entero del Web Generator». **Fuera por ahora** (14/10):
  pausar el sitio, renombrar, duplicar, papelera, la analítica de 30 días y crear una presentación desde
  una plantilla (las seis cosas existen en `server.ts`; cada una es una def y un runner).
- **Verlo con clics**: proponer `publicar_landing` desde el chat de la app y confirmarlo en
  `/mako/revisar` (el formulario muestra Landing y Dirección). Con una landing que NUNCA se publicó: MaKo
  tiene que volver con la dirección sugerida en la propuesta y el campo «Dirección» tiene que verse lleno.

## Tanda 4 (14/10/2026): las landings en hola-mako.site y el dominio del cliente

Decisión de Martín: «Las landings enteras, como gamma.site». Compró hola-mako.site; una landing publicada vive
en `https://hola-mako.site/<slug>` y la app sigue en hola-mako.com. El porqué: lo que publica un cliente (HTML
personalizado con JavaScript, «Replicar» que copia páginas ajenas) no puede vivir bajo el dominio de la app ni
el del mail; si Safe Browsing marca una página, que marque hola-mako.site. Diseño:
[diseno-editor-landing.md](diseno-editor-landing.md) → «Tanda 4». Medido en producción el 14/10, antes del
cambio, con `curl` (0 landings publicadas ese día: no hubo nada que migrar).

- **hola-mako.site ya respondía, y el proxy lo trataba como el dominio de un CLIENTE.** `hola-mako.site/`
  daba 404 con `X-Matched-Path: /api/landing-generator/dominio`: `esHostDeMako` sólo conocía la app, y todo
  host que no es de MaKo es un dominio propio. Peor: `motivoDominioInvalido('hola-mako.site')` daba null.
  **El diagnóstico obvio («cualquier admin se lo quedaba») era el equivocado**: sin el TXT `_mako` con el HMAC
  de SU landing (el DNS lo carga sólo Martín, en Porkbun) nunca se verifica ni se sirve, y sin la marca no se
  suelta de Vercel. Lo que sí podía es RESERVARLO 72 h como pendiente. **Regla: un dominio que MaKo suma al
  proyecto de Vercel entra a `esHostDeMako` el mismo día** (la app en `DOMINIOS_DE_MAKO`; el de las landings
  por `esHostDeLandings`, que NO entra al patrón del HSTS ni al de las redirecciones).
  **Vive en:** `lib/editor-landing/dominios-reglas.ts` (`esHostDeMako`, `tipoDeHost`), `origen-landings.ts`.
- **Las redirecciones de next.config.ts corren antes del proxy y TAPABAN slugs.** Medido: `hola-mako.site/leads`
  → 307 a `/crm` y `/extension` → 307 al zip de la extensión. En hola-mako.site el primer segmento ES el slug, y
  `todo`, `leads`, `graphics`, `extension` o `script-analyst` son slugs válidos: esa landing nunca llegaba al
  proxy. **Regla: lo de la app en next.config va con `has: host` de la app, puesto por `.map(enLaApp)` a la
  lista ENTERA** (una redirección nueva lo hereda). El patrón de la app (`PATRON_HOSTS_DE_LA_APP`) acepta
  `*.vercel.app`, `localhost` y una IPv4 (el dev desde el teléfono); el del HSTS (`PATRON_HOSTS_DE_MAKO`) NO:
  HSTS de dos años en `localhost` le fuerza HTTPS a todo puerto de localhost del que desarrolla. Un túnel
  (ngrok) queda sin las redirecciones: un 404 en /leads, no una pantalla de MaKo en el dominio de otro.
  **Vive en:** `next.config.ts`, `dominios-reglas.ts`.
- **El navegador no sabe en qué entorno corre.** La base de las landings depende de `VERCEL_ENV`, que no es
  `NEXT_PUBLIC_*`: en un componente cliente es `undefined` y daría la base de LOCAL en producción, en silencio
  (el diálogo Publicar mostraba `hola-mako.com/l/` armándolo con `APP_BASE_URL`). **Regla: la base la calcula
  el server** (`baseLandings`, `basesLandings`, `urlPublicaLanding` en `lib/app-url.ts`, que TIRAN en el
  navegador) **y baja por props** (`LandingCompleta.baseLandings`, la prop `bases` del Panel). Lo puro (cómo se
  arma una URL con una base) está en `origen-landings.ts` y sí se usa en el navegador.
- **El Pixel mide la URL que ve el visitante, no la ruta interna.** `landing_visits.landing_url` es
  `location.href` = `hola-mako.site/<slug>`, aunque el proxy reescriba a `/l/<slug>`. El prefiltro de la
  analítica (`%/l/<slug>%`) dejaba afuera todo lo nuevo sin un error. **Regla: mudar la URL pública toca
  `urlsAMedir` (una URL por página Y por base: lo medido antes sigue siendo de la landing) y `prefiltroVisitas`
  (`%/<slug>%`).** **Vive en:** `server-reglas.ts`, `server.ts` (`analitica`).
- **La foto guarda los enlaces entre páginas ABSOLUTOS, con la base del día en que se publicó.** Lo publicado
  antes trae `hola-mako.com/l/<slug>/…`: en la app redirige (308, con la query); en el dominio propio la ruta
  reescribe las DOS bases (`basesLandings` + `conEnlacesDelDominio`). Nunca se asume que la foto tiene la base
  vigente. **Vive en:** `publicar.ts`, `app/api/landing-generator/dominio`.
- **`/l/html` bajo hola-mako.com: nadie de la app lo usa** (el editor y el Diagnóstico dibujan el bloque con
  `srcdoc`: el render sin `htmlLibre`). En producción, en la app, 404; la página y su iframe viven juntos en
  hola-mako.site (o en el dominio del cliente), y `frame-ancestors 'self'` exige justo eso. Cierra «servir
  /l/html desde un dominio aparte». El freno `pideContrasena` se queda: ahora una página de phishing haría marcar
  hola-mako.site ENTERO, que es donde viven todas las landings. **Vive en:** `proxy.ts` (`respuestaLEnApp`),
  `origen-landings.ts` (`decidirLEnApp`).
- **En hola-mako.site sólo se reescribe lo que tiene una forma conocida**: `/<slug>`, `/<slug>/<ruta>`,
  `/vista/<token>[/<ruta>]` y las sub-rutas de `SUBRUTAS_FIJAS` (hoy ninguna: ver la revisión, abajo); `/l/html`
  pasa. Lo demás reescrito a `/l/…` caería en el not-found de la APP, con su
  layout y sus `/_next`, en el dominio de los clientes. **Regla: una carpeta fija nueva bajo `app/l/[slug]/` se
  suma a `SUBRUTAS_FIJAS` el día que existe.** Las mayúsculas se corrigen en el proxy ANTES de reescribir (el 308 de
  `responderPublico` arma la `Location` con `req.url`, que después de una reescritura es la ruta interna).
  Y ahí no corre nada de la app: ni el gate, ni la cookie (la de MaKo es de hola-mako.com), ni el `?ws=` (el
  test lo prueba con una sesión de admin válida), ni el cartel de mudanza, ni MaKo Mobile.
- **En hola-mako.site el slug es el primer segmento, y el matcher del proxy saltea `cono-tx/` y `cono-doc/`**
  (los assets públicos de /conocimientos): `/cono-tx/gracias` de una landing con ese slug no pasaba por el
  proxy y caía en el not-found de la app. Se reservaron los dos (`SLUGS_RESERVADOS`) y un test cruza cada
  prefijo del matcher con la lista. **Regla: un prefijo nuevo en el matcher de `proxy.ts` con forma de slug
  va a `SLUGS_RESERVADOS`.**
- **El Panel reconoce también el dominio propio** (`LandingResumen.dominio`, sólo el VERIFICADO: uno pendiente
  no sirve nada y otra cuenta se lo puede quitar). Antes de sumar `dominio, dominio_estado` a la lista del
  Panel (un `select` con una columna que falta tumba el Panel entero) se midió que la 0263 está en
  producción SIN tocar la base: `hola-mako.site/` contestaba 404 desde la ruta del dominio, que filtra por esas
  dos columnas y contesta 503 si la consulta falla. **Vive en:** `server.ts` (`COLS_RESUMEN`, `aResumen`),
  `panel-reglas.ts` (`docDeUrl`).
- **La raíz de hola-mako.site va a hola-mako.com con 307** (decidido): no es de nadie, y un 308 quedaría
  cacheado el día que tenga portada propia. `/l/<…>` en hola-mako.site es un 308 a `/<…>` en el mismo host.
- **Lo que una landing le pide a SU host (medido con el documento armado y en producción):** sólo el iframe de
  `/l/html` (relativo a propósito) y lo que el navegador pide solo (`/favicon.ico` si el sitio no tiene
  favicon). El cargador del Pixel, `/api/track/*` y el grabador van ABSOLUTOS a hola-mako.com
  (`lineaCargador(token, appBaseUrl)`); fuentes de Google; imágenes del bucket. Un test lo fija.
- **Trampas de Vercel medidas**: el `has: host` de next.config SÍ se aplica en producción (hola-mako.com trae el
  HSTS con `includeSubDomains`); y Vercel pone su PROPIO `Strict-Transport-Security: max-age=63072000` (sin
  `includeSubDomains`) en cualquier dominio, también en hola-mako.site y en el de un cliente: lo que la tanda 2
  sacó fue el `includeSubDomains`, no el HSTS.
- **Entorno de la corrida: en un worktree, lo que sacó git está en CRLF y lo que crea Write en LF, y el
  `grep` de Git Bash no ve los `\r`** (`grep -c $'\r'` dio 0 sobre archivos CRLF; `node` con
  `readFileSync(...).includes('\r\n')` dijo la verdad). Un arnés de roturas con anclas `\n` encontró las del
  archivo nuevo y no las de `proxy.ts` ni `next.config.ts` («el ancla aparece 0 veces»): el ancla tiene que
  seguir el fin de línea de CADA archivo. Edit conserva el CRLF del archivo que toca.
- **El build de un worktree en `C:/dev` NO corre con la receta de AGENTS.md** (la raíz de Turbopack en una
  carpeta que contenga al worktree y al clon): con el clon en `C:/Users/…/OneDrive/…` la única carpeta común
  es la unidad, y con `root: 'C:/'` (y `'C:\\'`) Turbopack aborta con «Symlink [project]/node_modules is in a
  symlink loop: ["node_modules"]». `next build --webpack` tampoco: el repo no compila con webpack
  (`node:crypto` en `lib/cripto-credenciales.ts` ← `lib/credenciales.ts`, ajeno a este cambio). Lo único que
  ese intento sí probó es que next.config.ts CARGA y valida sus redirecciones con `has` (el build llegó a
  compilar). El build va en el clon, al integrar. No quedaron enlaces en `.next` (medido con
  `Get-ChildItem -Attributes ReparsePoint`).

### La revisión adversarial de la tanda 4 (14/10/2026)

- **Una redirección que arma su destino con la ruta del pedido es una redirección abierta si no se valida lo
  que queda.** Síntoma: `hola-mako.site/l//evil.com` → 308 a `https://evil.com/`, y desde la app
  `hola-mako.com/l/l//evil.com` llegaba en dos saltos (un link con la marca de MaKo, bueno para phishing).
  Causa: la rama `/l/<…>` de `decidirLandings` devolvía lo que quedaba sin mirarlo, ANTES del corte de
  segmentos vacíos, y el proxy armaba la Location con `new URL(destino, 'https://<host>')`: `//evil.com` es
  una URL relativa al protocolo. `/l/\evil.com` llega igual (el parser lo lee como `/l//evil.com`). **El
  diagnóstico tranquilizador («Next normaliza el `//`») no alcanza**: `next start` sí lo manda con un 308
  antes del proxy (`resolve-routes`), pero nadie midió Vercel, y `new NextRequest(…).nextUrl.pathname` de
  `https://hola-mako.site/l//evil.com` es `/l//evil.com` (medido). **Regla: lo que queda después de un
  prefijo se decide con las mismas reglas que una dirección directa, y todo 308 que el proxy arma con la
  ruta del pedido pasa por `redireccionEnElHost`** (null si la Location cambia de host → 404). Son dos capas
  a propósito, cada una con su test. **Vive en:** `origen-landings.ts` (`decidirLandings`,
  `redireccionEnElHost`), `proxy.ts` (`redirigirEnElHost`, también el 308 a minúsculas del dominio propio).
- **Un test que compara el TEXTO de un patrón no ve sus comodines.** `favicon.ico` iba sin escapar en el
  matcher del proxy: el `.` dejaba afuera `favicon-ico-promo` (un slug válido, que caía en el 404 de la app),
  y el test que cruzaba cada alternativa con `SLUG_RE` como texto daba verde. Ahora el test COMPILA el
  matcher y lo prueba con slugs parecidos a cada alternativa. Trampas medidas: `getMiddlewareMatchers` no
  se puede importar en un test («Invariant: AsyncLocalStorage accessed in runtime where it is not
  available»); `tryToParsePath` (`next/dist/lib/try-to-parse-path`, lo que usa por dentro) sí. Y
  path-to-regexp conserva el `\.` dentro del grupo (el `.*\.(?:png|…)` ya dependía de eso). Otra: el Bash
  del entorno se come las barras de un heredoc (un `'favicon\\.ico'` llegó como `'favicon\.ico'`): un
  script con barras se escribe con Write. **Regla: un prefijo nuevo en el matcher va con los puntos
  escapados; el test lo cruza solo.** **Vive en:** `proxy.ts` (`config.matcher`).
- **No se declara en el proxy una ruta que todavía no existe.** `pagar` en `SUBRUTAS_FIJAS` y el POST de
  `/api/landing-generator/pagar` estaban declarados para un paquete que no existe en ninguna rama:
  `/<slug>/pagar/<id>` se reescribía a una ruta inexistente (el not-found de la app, con su layout, en el
  dominio de los clientes) y el POST pasaba sin que nadie mirara el `Origin`. Se sacaron; el test exige que
  cada clave de `SUBRUTAS_FIJAS` tenga su carpeta en `app/l/[slug]/`. **El contrato para cuando llegue el
  pago:** `Origin` ausente o igual a `https://<host del pedido>` (403 si no), tope por IP, idempotencia por
  bloque y visitante, y el monto, la moneda y el workspace nunca del pedido (por `lib/cobros.ts`).
  **Vive en:** `origen-landings.ts` (`SUBRUTAS_FIJAS`).
- **Para que una rama paralela no compile con la semántica vieja, se renombra.** `urlPublica(base, slug,
  ruta)` siguió exportada con la misma firma después de la mudanza, y la rama de la API de MaKo
  (`lib/api-mako/areas/landing-editor.helpers.ts:31` en `landing-api`) arma con ella `url_publica` y lo que
  devuelve `publicar_landing`: al integrar compilaba y la API contestaba `hola-mako.com/l/<slug>`. **El
  diagnóstico del revisor («nada lo hace cumplir, es un comentario») era a medias**: el guard del test sí
  veía un `import { urlPublica } from '@/lib/editor-landing/doc'` de afuera, pero NO uno de adentro de
  `lib/editor-landing` (`from './doc'`): roto a propósito dio 17 / 0. Ahora es `rutaInternaL(slug, ruta)` y
  el guard mira las dos formas. **Regla: cuando cambia lo que DEVUELVE una función compartida y hay ramas
  en paralelo, se le cambia el nombre (o la firma), no sólo el comentario.** **Vive en:** `doc.ts`,
  `pagina-publica.ts`.
- **Mudar la URL pública tiene más consumidores que la analítica.** Lo que manda el Pixel (`location.href`,
  hoy `hola-mako.site/<slug>`) se compara por IGUALDAD con: (a) las páginas que el negocio declaró
  (`landing.config`): el producto de una landing (`landingDe` → `funnelsDeLanding`, el alta por opt-in) y la
  página de gracias (`paginaDeGracias`, que pasa a Ganado); (b) el comportamiento del Diagnóstico
  (`getComportamiento`, igualdad exacta sobre `landing_visits`). Algo declarado o medido como
  `hola-mako.com/l/<slug>` deja de coincidir: el lead cae en el embudo del negocio, la de gracias no lo pasa
  a Ganado y el Diagnóstico dice «sin datos» (y la IA analiza creyendo que nadie la vio), todo sin un error.
  Hoy el impacto es chico (0 landings publicadas el 14/10, medido antes del cambio), pero cualquier landing
  publicada antes del deploy queda así. La pieza es `urlLandingVigente` (`dominios-reglas.ts`, con test): la
  dirección de hoy de una escrita con la de antes; se aplica a LAS DOS PUNTAS de la comparación. El
  cableado vive en archivos de otras áreas (Pixel/Integraciones y Landing Analyst) y quedó para la sesión
  principal (abajo). **Regla: mudar la URL pública es buscar todo lo que compara una URL de landing por
  igualdad (`normalizarUrl(…) ===`), no sólo lo que la muestra o la mide.**

### Lo que quedó sin hacer (tanda 4)

- **Cablear `urlLandingVigente` en las comparaciones de otras áreas** (la revisión, arriba). Dos cambios:
  `lib/landing-config.ts` (`landingDe`): `const k = urlLandingVigente(u); return configs.find((c) => c.url
  === u || urlLandingVigente(c.url) === k) ?? null;` y `lib/landing-gracias-reglas.ts` (`paginaDeGracias`):
  comparar `sinParametros(urlLandingVigente(c.url)) === sinParametros(urlLandingVigente(u))`; y
  `lib/landing-analyst.ts` (`getComportamiento`): `const clave = urlLandingVigente(url)` y comparar
  `urlLandingVigente(norm(v.landing_url))` contra `clave` en `mias` y en `compartidos` (así las dos bases son
  la MISMA página y no «otra landing»). Con eso el Diagnóstico (`diagnostico-server.ts`) no cambia. Cada uno
  con su test en su área.
- **Al integrar la rama `landing-api`**: `lib/api-mako/areas/landing-editor.helpers.ts:31` deja de compilar
  (a propósito); va `urlPublicaLanding(slug, ruta)` de `lib/app-url.ts`.

- **Los estáticos de MaKo se sirven en hola-mako.site y en el dominio de un cliente** (el matcher de `proxy.ts`
  no corre en rutas con sufijo). Medido el 14/10 en hola-mako.site: `/_next/static/chunks/…js` 200,
  `/favicon.ico` 200 (el de MaKo), `/sw.js` 200; `/m.js` 404 y `/robots.txt` 404. Una landing no necesita
  ninguno (arriba), así que bloquearlos no rompe una landing; lo que NO se hizo es el bloqueo: un rewrite
  `beforeFiles` con `missing` host de la app, si el patrón no matchea en Vercel como en Next local, deja a la
  APP sin su JavaScript. No exponen datos (son archivos públicos). Si se hace: medir antes con un preview y
  `curl` en los dos hosts. `next.config.ts`, `proxy.ts` (matcher).
- **El pago de un bloque** (`/<slug>/pagar/<bloque>` y el POST de `/api/landing-generator/pagar`) no existe en
  ninguna rama (medido el 14/10 en los worktrees), así que hoy es 404 en hola-mako.site y en el dominio propio.
  Lo suma su paquete en los DOS hosts (`SUBRUTAS_FIJAS` en origen-landings.ts y `decidirHost` en
  dominios-reglas.ts), con el contrato de la revisión (abajo): `Origin` exigido, tope por IP, idempotencia.
- **Textos que todavía dicen `hola-mako.com/l/<…>`** en archivos de otras áreas: `lib/mako-capacidades.ts:73`
  (lo que MaKo cuenta de la tab) y `app/admin/dev/areas.ts:598` (el alcance del área). Los cambia la sesión
  principal. El comentario de `/l` en `lib/rutas-publicas.ts` también (en producción el proxy la muda antes).
- **HSTS propio para hola-mako.site** (con o sin `includeSubDomains`): hoy sólo el de Vercel. Decide Martín.
- **Verlo en producción después del deploy**: `curl -sI https://hola-mako.site/` (307 a hola-mako.com),
  `https://hola-mako.site/leads` (404 de landing, no 307), `https://hola-mako.com/leads` (307 a /crm: las
  redirecciones con `has` siguen andando en la app), `https://hola-mako.com/l/x` (308 a hola-mako.site/x) y
  una landing publicada de prueba en el ws3 (abrirla, el formulario, el HTML libre, la vista previa privada).

## Diseños con video: la grilla tipo VSL Funnel (14/10/2026)

Pedido literal de Martín: «Por favor, que la mayoría de las plantillas sean con un VIDEO, porque deberían ser tipo
VSL Funnel... Puedes inspirarte en otras plantillas de VSL Funnel e incluso en la misma plantilla de MaKo.»

### El diagnóstico obvio era el equivocado: los 8 diseños ya eran casi el mismo

- **Síntoma:** la grilla «Diseños» mostraba ocho miniaturas que sólo cambiaban de color.
- **Causa:** los `hero: 'derecha' | 'fondo' | …` de `DISENOS_LANDING` describen dónde va la IMAGEN de acento, y
  ninguna plantilla de copy trae `imagenSrc`: sin imagen, `specTarjeta` dibuja `'sin'`
  (`lib/editor-landing/especificacion.ts` ~558). O sea que el «diseño» era el tema y nada más.
- **Regla:** un eje de diseño que depende de un dato que las plantillas no traen no es un eje. Antes de sumar una
  variante de layout, comprobá en la MINIATURA que se distinga.

### El insertado vacío perdía de qué era

- `attrsInsertado` y el saneo devolvían `proveedor: ''` con `src` vacío, así que un VSL sin pegar y una agenda sin
  pegar eran el mismo nodo: el render no podía dibujar un ▶ para uno y no para el otro, y el editor decía lo mismo
  en los dos («Pega el enlace de un video o de tu agenda»).
- **Vive en:** lib/editor-landing/especificacion.ts (attrsInsertado), lib/editor-landing/validar.ts.

### La miniatura es un cuadro 16/10 con overflow hidden

- Un hero alto (Título display de 5em + 2.75em de padding) deja el video FUERA del cuadro sin un error: la miniatura
  muestra el titular y nada más. Lo que se ve en la grilla se mide en el cuadro, no en la página.
- **Vive en:** app/web-generator/MiniaturaLanding.tsx (.gp-mini).

### El test de insertar no cargaba los diseños en TipTap

- `tests/editor-landing-insertar.test.ts` cargaba en el esquema de TipTap `PLANTILLAS` y `DISENOS_SECCION`, no los
  cruces diseño × objetivo: un nodo que el saneo acepta y TipTap tira (se abre VACÍO y el autoguardado lo pisa)
  pasaba en verde.

### Un átomo vacío que no se dibuja deja vacía la COLUMNA que lo contiene

- **Síntoma (verificación del 14/10):** en los diseños con el video al costado, publicar sin pegar el video sacaba
  `<div class="gm-columna"></div>`: el texto apretado en 5/12 y 7/12 en blanco, en la publicada y en las
  exportaciones. Borrar el video tampoco lo arreglaba (la columna exige un bloque y deja un párrafo vacío).
- **Causa:** el render omite el insertado vacío (correcto: no hay hueco sin explicación), pero la columna que lo
  envolvía no se enteraba. La regla «lo vacío no se dibuja» vale para el CONTENEDOR también.
- **Vive en:** lib/editor-landing/render.ts (columnas), lib/editor-landing/disenos-landing.ts (rama 'costado').

### El modo 'miniatura' no es sólo la grilla

- `app/m/landing/[id]/page.tsx` usa el modo 'miniatura' como «lo que vería un visitante en su teléfono». Un
  marcador que sólo tenía sentido en la grilla de Diseños (el ▶ del video sin pegar, el video al 52 %) aparecía ahí
  como si la publicada lo tuviera. Antes de cambiar lo que dibuja un modo, grep de quién lo pide.

### Probar un merge sin tocar el árbol

- `git merge-tree --write-tree <a> <b>` dice si dos ramas chocan y en qué hunks, sin checkout ni índice: sirve con
  varias sesiones en el clon. El merge de prueba de los diseños con video contra el botón de pago dio un solo
  conflicto, en un comentario de cabecera.

### Lo que dicen las referencias de VSL (para no volver a buscarlo)

- **«VSL funnel» en ClickFunnels es un funnel de VENTA** (pedido, upsell, downsell); el de agendar es su
  «Application Funnel». Un VSL para agendar llamada es el arquetipo high-ticket: titular → video → «Aplicar/Agendar»
  → prueba → para quién es → FAQ → agenda.
- **El titular va arriba del video y el botón justo debajo**; el video es el protagonista (60-70 % del ancho).
- **Las páginas de webinar casi nunca llevan VSL en el hero**: llevan foto o un tráiler del host.
- **Calendly no deja poner un video en su página de agenda**: el video tiene que ir en nuestra página.
- **La landing de MaKo (app/vsl) es split**: texto a la izquierda, video a la derecha; el tema más parecido era
  Commons, y un tema «MaKo» exigía sumar Geist a `FUENTES` y otra categoría en el test de temas (el cupo de
  «aproximados» estaba lleno en 16).
- **`app/vsl/landing-html.ts` no es lo que se ve**: `Landing.tsx` le cambia cosas al cargar (el fondo de los cupos,
  títulos, secciones que saca). Para describir la landing de MaKo se lee lo que queda DESPUÉS de Landing.tsx.

### Medir una miniatura sin `--window-size` mide otro layout

- Chrome sin cabeza abre a 800 px de ancho: las columnas del hero salían APILADAS y el video al 96 %, que no es
  lo que ve nadie en la grilla de escritorio. Con `--window-size=1780,1500`, dos columnas y el video al 50 %. El
  layout de la miniatura depende de la ventana, no del cuadro: se mide con ventana de escritorio.

### Trampas chicas que costaron una vuelta cada una

- **Un atributo en el `saltear` de `attrsConMotivo` se descarta SIN motivo.** La pista de proveedor de los bloques
  «Agenda» y «VSL» del menú desaparecía en el saneo sin que nada lo dijera. Cuando un atributo salteado empieza a
  significar algo, se le suma su motivo (lib/editor-landing/validar.ts).
- **Una lista cerrada no se chequea con `in`**: «toString» pasa como proveedor válido. Va `hasOwnProperty`
  (`esProveedorEmbed`, lib/embeds.ts).
- **Un tema que no es «medido» ni «aproximado» rompe el catálogo**: el test fija la lista exacta de los medidos y
  un tope de aproximados. El tema `mako` lleva su flag `deMako` (lib/editor-landing/temas.ts).
- **Un test que toma `DISENOS_LANDING[0]` como «el diseño neutro» cambia de sentido cuando cambia el orden del
  catálogo**: se elige por propiedad (`video === null`).
- **Un string compuesto que arma el cliente tiene que pasar la regex del server**: `pedidoDeDiseno` arma
  `diseño:objetivo` desde el 12/10 y `sanearConfig` lo tiraba sin motivo (no aceptaba los dos puntos). La regex y
  el armado van en el mismo test.
- **La barra de la agencia («Estás viendo el dashboard de…», 50 px) le reserva su alto al body**: toda pantalla de
  alto completo descuenta `var(--barra-agencia, 0px)` o el documento scrollea esos 50 px y la barra tapa la de
  arriba (en el editor tapaba Publicar). Medido por la verificación con clics en el Chrome de Martín.

### Lo que quedó sin hacer (diseños con video)

- La SEGUNDA página de gracias del webinar y del lead magnet no lleva el video de «qué sigue».
- En el teléfono, con el video al costado, el video queda debajo del texto y el botón (el orden de las columnas).
- Al pegar HTML sin el JSON del editor, la pista del proveedor se pierde (`parseHTML` de nodos.ts cae a
  `attrsInsertado({})`).
- El ícono `play` del catálogo es de contorno; no hay uno relleno.
- `app/admin/dev/landing-generator/bitacora.ts` sigue diciendo «34 temas» (ahora son 35).

## Lo que quedó sin hacer

- **«Generar imagen con IA» por Google Flow** (decisión de Martín, 11/10). Bloqueo medido: el Flow nuevo
  sólo deja cambiar el TEXTO del pedido; la proporción, el modelo y la foto de referencia salen de la
  imagen que el cliente le enseñó a la extensión (con SU cara, `extension/background.js:450-532`), y la
  extensión sólo queda lista si aprendió el video Y la imagen (`background.js:1316`). Martín eligió
  **parchear la extensión** (sacar la referencia para imágenes de landing y no exigir el video), midiendo
  antes en el Cliente de Prueba proporción, costo, semilla y refresco de una URL vencida. Riesgos ya
  vistos: dos caminos de la cola compartida pueden reencolar algo que ya salió (`background.js:1834` y
  el rescate de la mig 0154); el cron `flow-abandono` le mandaría «Tus videos no se están generando» a un
  cliente por una imagen de landing; `tests/cola-prompt-al-tope.test.ts` sólo lee `video-action.ts`.
  Plan completo: lo escribió el relevo y se resume en el diseño (D5).
- **Verificación en navegador incompleta**: el verificador recorrió el editor y se cortó por el límite
  de la cuenta al final; no dejó datos de prueba (medido: 0 landings, 0 archivos en el bucket). Falta
  mirarlo con clics.
- ~~HTML personalizado en la publicada~~: hecho en la tanda 2 (`app/l/html/[docId]/[bloque]`, arriba).
- **No copiado de Gamma, a propósito**: Formato libre (posicionamiento absoluto por bloque), edición en
  tiempo real, insertar la landing en otra web
  (`X-Frame-Options: DENY`), Google Tag Manager y código personalizado, Imagine, la caja de agente de
  Gamma 5 con preguntas (se usa el generador clásico con modo Plan/Express).
- ~~**API de MaKo**: listar/ver/publicar landings no están en el registro~~: hecho en la tanda 4 (arriba),
  salvo que por WhatsApp «publicá la landing…» todavía no llega (bloqueante de `lib/mako-intencion.ts`).
- Se borró `app/api/landing-writer/route.ts` (no la llamaba nadie): al integrar en el clon hay que correr
  `npx next typegen` para que `.next/types/validator.ts` deje de nombrarla.

## La caja de pedir, compartida con /automations (12/10/2026, decimocuarta tanda de Automations)

- La caja de «¿Qué vas a crear hoy?» (el campo con el ejemplo que se escribe solo, el micrófono y el ↑) vive en
  `app/web-generator/CajaPedido.tsx`. La monta también el modal «Nueva automatización». El «+» y «Plan | Express»
  siguen en `CajaCrear.tsx` (`antes`). **Regla:** un cambio de la caja es para las dos puertas. Lo de una sola va en
  `antes`.
- `Ico` salió a `app/web-generator/Ico.tsx` (MiniaturaLanding lo re-exporta). Quien no es el editor importa de
  ahí: MiniaturaLanding trae el render de la landing.
- ⚠️ Los tokens `--gp-*` de CSS_GP leen `--gma-*` con respaldo CLARO. Fuera de `.gma` (sin gamma.css) el oscuro no
  los da vuelta. Afuera, `.gp.cp-casa` + `CSS_TOKENS_CASA`.
- Con `scrollHeight` 0 (escondida en un modal que todavía no entró en la pila) la caja no fija el alto. Cierra el «sin
  hacer» de la decimotercera de Automations sobre CajaCrear.

## Tanda 6 (14-15/10/2026): leer una landing armada en el navegador, Crear con IA en la tab, «Aplicar» y el backlog

Pedido de Martín (14/10) mirando «No pude leer el texto de esa página.» sobre la landing SPA de un cliente: que se
lea, que todo viva en /landing-generator, Analizar y Replicar en «Crear con IA», el «+» sólo para adjuntar, el link
pegado en azul («Analiza / Replica esta landing»), las plantillas en tarjetas con sombra y los [ ] resaltados. Más
sus decisiones (b) leer en el navegador con el Pixel o una ventana, (c) «Aplicar» de un clic con Deshacer y (d)
Replicar en 3 formatos copiando el estilo. Workflows `wf_8f7c15cf-56d` (piezas) y `wf_2247d576-3c7` (pantalla,
triage del backlog, paquetes, verificación y corrección). Lo construido está en los commits; acá, lo aprendido.

### Leer una página de afuera
- **El diagnóstico obvio era el equivocado:** «No pude leer el texto» sonaba a «no se pudo bajar», y la página bajaba
  bien (200, 137 KB). Eran dos causas: el extractor sólo leía h1-h3/p/li/button/a (el texto en div/span de todo
  constructor moderno no contaba) y la landing del caso es una app de Vite (`<div id="root">` + scripts): 0 palabras
  en el HTML. Eso sólo se lee en el navegador. **Regla:** si la página llega sin texto, el server contesta
  `enNavegador` y no un callejón (`lib/landing-extraer.ts`, `lib/editor-landing/lectura-reglas.ts`).
- Node corta las cabeceras en 16 KB y lo reporta como «No se pudo conectar» (HPE_HEADER_OVERFLOW): webflow.com/pricing
  manda ~17,5 KB. `maxHeaderSize` 64 KB (`lib/landing-fetch.ts`, MAX_CABECERAS).
- Un acordeón de Radix sirve la pregunta en `<h3><button aria-expanded>` (el extractor viejo la leía como TÍTULO y
  «Conservar» cortaba una sección por pregunta) y la respuesta cerrada NO está en el HTML. Emparejar pregunta y
  respuesta por CONTENCIÓN en el DOM, no por orden: con el orden, «¿Tienes otra duda? Escríbenos» se pegaba como
  respuesta de la última pregunta. Lo de adentro de un `<nav>` no es copy (el megamenú metía ~1.800 palabras).
- `normalizarUrl` (desde el 15/10/2026, `claveDeLanding`) le saca el www y el query: es la LLAVE de `landing_analyses`, no una dirección para bajar. Los hosts
  que sólo existen con www fallaban. **Regla:** se baja con la URL tal cual; la normalizada sólo como clave.
- 401/403/406/429 se leen en el navegador de la persona; 404 y 5xx no (`ErrorDeLectura`, `bloqueaLaLectura`).
- La ventana aislada (origen opaco): un `<script type="module" crossorigin>` sin CORS no carga (se mete en línea como
  blob si es UN módulo sin imports; una app partida en módulos no corre); localStorage/cookie tiran SecurityError
  (se reemplazan con `defineProperty`); el router de la SPA dibuja su 404 si no se le cambia el camino con
  `history.replaceState` ANTES del `<base>`; la Navigation API no avisa nada en un origen opaco (no se puede atajar
  `location.href`; con el Pixel sí); el mensaje de `pagehide` llega con `ev.source === null`.
- El player de Panda baja el Pixel de Meta por su cuenta: leer la página (o abrir el Diagnóstico) lo carga y desde la
  página no se apaga. `sinRastreadores` saca un `<script>` ENTERO si nombra `fbq(`: si la lógica vive en el mismo
  script que el rastreador, la vista aislada la pierde.
- **SEGURIDAD (lo encontró la verificación y se cerró):** `Sec-Fetch-Site: same-origin` NO prueba que la navegación la
  inició el código de MaKo (cualquier link adentro de MaKo cuyo href controle otro la cumple), y un id que acuña el
  navegador no autentica nada: la ruta de la ventana servía el HTML de cualquier URL bajo hola-mako.com (phishing con
  nuestra barra de direcciones). Y «la página tiene el Pixel» se decidía por el TEXTO del HTML, que cualquiera
  escribe, para abrir la página real CON `opener` (reverse tabnabbing). **Regla:** lo que sirve contenido de afuera
  bajo nuestro dominio exige una firma del server (HMAC atada a id, URL, usuario y negocio, que vence:
  `lib/editor-landing/lector-firma.ts`), y abrir una página de afuera sin sandbox exige que el host esté entre las
  landings DECLARADAS del negocio y traiga su token (`vaALaPaginaReal`).
- **Chrome deja abrir UNA ventana por clic** sin permiso de emergentes: la segunda `window.open(…, 'noopener')` queda
  bloqueada callada (con noopener siempre da null). Todas las ventanas de un clic se abren `about:blank` EN el clic y
  se navegan al final con `w.opener = null` (`ProbarTracking.tsx`, `arrancar`). Y una ventana `about:blank` del
  mismo origen navegada con lo que tipeó la persona tiene que validar http/https (un `javascript:` correría con el
  origen de MaKo).

### Copiar el estilo al replicar
- **El obvio era el equivocado:** con Tailwind 4 o shadcn nuevo, `getComputedStyle` devuelve `oklch(…)`, no `rgb()`.
  Un parser de rgb/hex pierde todos los colores sin error. **Regla:** todo color computado pasa por un parser que
  entienda oklch y oklab (`estilo-original.ts`, `colorCss`).
- En shadcn, `--accent` es un gris de fondo; la marca es `--primary` (se reconoce por `--primary-foreground`).
- El tema de la réplica vive en el negocio (`app_settings` `landing.temas`, tope 30) con id = hash de su contenido:
  replicar dos veces no lo duplica, y si existe se reusa sin pisarlo. Una imagen se asigna por la parte donde está
  (el primer título del contenedor más chico con títulos), no por el orden del documento.
- La API css2 de Google Fonts no siempre da 400 a un peso que no existe (PT Sans 300 dio 200): se validan los
  `font-weight` que devuelve la hoja.

### La pantalla y el Diagnóstico
- **Una derecha que es `useState` no se mueve con un `<Link>` a la misma ruta:** dentro del Panel, un link a
  /landing-generator?otra-query es navegación suave al MISMO componente, que no se remonta: la URL cambia y la
  pantalla no. Lo que cambia la derecha desde adentro es una función del Panel (`onAccion`, `onSalir`), nunca un link.
- **Lo que se paga se usa una vez y no vive en la URL:** si el pedido de la caja o el link de Replicar quedaran en la
  query, un F5 volvería a generar (IA paga). `queryDeDerecha` borra todas las claves que lee.
- Lo que se usa una vez desde `sessionStorage` se consume en un efecto con un ref, nunca en el inicializador de
  `useState`/`useRef` (corre dos veces en el modo estricto y la segunda lo encuentra vacío).
- El Diagnóstico de una landing con varias páginas las dibuja en UN lienzo; el rótulo de cada página va con
  `::before { content: attr(...) }` para que nunca sea un nodo de texto donde se ubique una cita.
- Un backtick en un comentario CSS adentro de un template literal da un error de tipos que no apunta al CSS
  («Property 'gp' does not exist…»), y los tests no lo ven (esbuild compila distinto): en comentarios de CSS, «».
- `'error' in x` no estrecha una unión inferida de objetos literales (TS le agrega `error?: undefined` a la rama de
  éxito): una función que devuelve error o resultado declara un discriminante (`listo: true | false`).
- Las columnas nuevas (`landing_docs.diagnostico`, mig 0281): al ESCRIBIR una columna que no existe PostgREST contesta
  `PGRST204`, no `42703` (regla ya escrita en AGENTS.md y en docs/hallazgos-infra.md): la primera rotura «sin
  PGRST204» dio verde porque el respaldo por mensaje la atajaba; se probó el código aparte del mensaje.

### Dominio propio y pago
- El plan de la tanda 4 para servir el paso de pago en el dominio era imposible tal cual: el proxy es síncrono y no
  sabe el slug (pasar del host al slug necesita la base). Va a la ruta del dominio con una query que arma SÓLO el
  proxy (pisa `u.search`: la del visitante no viaja). Y un POST en un host que no es la app se decide en el proxy Y en
  la ruta (`origenDelPago` daba «mako» a un Origin de hola-mako.com).
- Una reserva vencida no deja de verificarse; sólo se pierde la exclusividad. Lo que se dice antes de confirmar se
  arma con lecturas de la fila, nunca con `estadoDominio` (sale a Vercel y puede ESCRIBIR).
- **La poda con `en_curso = false` dejaba basura para siempre** (una fila en curso de una función muerta sólo la suelta
  el mismo email): el candado vence a los 90 s, así que se borra todo lo de más de 7 días.
- Los rechazos del POST se cuentan DESPUÉS de leer la landing y en un contador (upsert que suma, mig 0282): antes no
  se sabe de qué negocio es, y una fila por evento le regala a un bot una escritura por pedido.
- Un formulario con tope de bytes se mide con `URLSearchParams` (el peor caso: 3.484 de 4.000), no con
  `encodeURIComponent`, que no codifica `!'()~`.
- El Referer, detrás del proxy, se compara con el host de la URL Y con la cabecera Host (el paso nunca se sirve en la
  ruta que pidió el navegador).

### Hoja, exportar y miniaturas
- El bloque de la copia de una app crece con lo que su contenedor ESCONDE (`scrollHeight − clientHeight`), no con
  dónde termina; y con un hero de 100vh lo escondido crece con la vista y no hay punto fijo (20.000 px): se deja de
  medir la caja si no baja la mitad de lo que creció la vista (`html-libre.ts`, SCRIPT_ALTO). Un test de alto prueba
  contenido que depende de la vista.
- En `@page` gana la ÚLTIMA regla: la hoja de la diapositiva va después de CSS_CONTENIDO o vuelve el margen. 13,333 in
  son los 1280 px del iframe que imprime. Playwright: reusar una página después de `emulateMedia('print')` ignora el
  `@page`; una página nueva por PDF.
- Reordenar columnas apiladas en el teléfono: `display: contents` + `order`, con `gap: 0` (en flex los márgenes no
  colapsan) y el `::before` de los divisores apagado.
- Los [ ] resaltados: el tope de 120 caracteres sale de medir los 526 corchetes de los catálogos (el más largo, 88);
  `Plantilla.contenido` y `DisenoSeccion.crear` son FUNCIONES y un recorrido que sólo baja por objetos mide la mitad.
  El tinte sale de `--gm-acento-texto` como franja del 80 % del alto (un fondo entero se pisaba entre renglones). La
  marca cuelga de `marcadores`, no del modo 'miniatura', porque `app/m/landing` usa ese modo como la vista del visitante.

### Trampas de los tests y del entorno (para la próxima corrida)
- El `sinComentarios` de los tests corta `/*…*/`: un `*/*` adentro de un string (`'text/css,*/*;q=0.1'`) se come el
  resto del archivo; y su `.replace(/\{\s*\}/g, '')` borra los `: {}` del código. Un regex que busca una condición
  puede encontrar la MISMA repetida más abajo: cuando el orden importa, se ancla la posición.
- Un tipo fijado con `deepEqual` en un test compartido no se toca: el dato nuevo va por otro canal.
- **El typecheck acotado (`C:/dev/tsc-landing.mjs`) sólo ve los archivos cambiados y lo que ELLOS importan**, no a
  quien los importa: un export quitado lo caza el completo del pre-push. Y un «no pude chequear» (99) queda pendiente
  hasta que se corra: los 3 errores de `lector-navegador.ts` viajaron así por cuatro agentes (una `function` izada no
  hereda el estrechamiento de los `const` de afuera; una flecha sí).
- Un commit que importa un módulo de otro agente espera a que ese módulo esté en git.
- Las herramientas Write/Edit decodifican `\uXXXX` a caracteres crudos e invisibles (un U+2028 adentro de un regex da
  «Unterminated regular expression»); en Python sin raw, `\\b` termina como BACKSPACE (0x08) adentro de un regex de
  TS. Después de escribir escapes, barrer con node los code points 0x08, 0x300-0x36f, 0x2028 y 0x2029.
- Con `core.autocrlf=true`, varios archivos están en CRLF en el disco y uno reescrito con Python o `sed -i` queda en
  LF (git normaliza); un arnés de roturas con anclas en `\n` contesta «0 veces» en un archivo CRLF y no rompe NADA, en
  silencio. Los fines de línea se cuentan con node: el grep de Git Bash informa mal los CR.
- El Panel REAL se puede ver sin next dev: esbuild del repo + stubs de next/navigation, next/link y server-only, y
  Playwright con `page.route` (o fingiendo `window.fetch` dentro del bundle). Desde el Bash, el `chrome.exe` de
  ms-playwright da «Permission denied»; el `chrome-headless-shell.exe` sí corre.
- El scratchpad de la sesión es COMPARTIDO por los subagentes de un workflow: los archivos de commit y de medición
  llevan un nombre propio de la tarea.

### El cierre de los hallazgos bajos (15/10)
- **Un texto que le pide algo a la persona nombra algo que la pantalla ofrece.** Pasó dos veces: «Reserva vencida:
  conéctalo de nuevo» mandaba a un botón que no existe (y reconectar no renovaba la reserva; lo que sirve es
  «elimínalo y añádelo de nuevo», que pone fecha nueva y el TXT sigue valiendo), y «Prueba el formato «Landing»» salía
  sin botón. **Regla:** si un error propone otra acción, lleva un campo (`probar: 'landing'`) y un botón, y el test
  verifica que la pantalla tenga ese botón (`dominios-reglas.ts`, `replicar-reglas.ts`, `crear/Replicar.tsx`).
- Replicar como «Página web» una app de Vite o Lovable (un `#root`/`#app` vacío o un `<script type="module">`)
  contesta 422 con «Prueba el formato «Landing»» y el botón; una página vacía de verdad sigue diciendo «no trae nada».
- **«Que el texto viaje como instrucciones» era el arreglo obvio y es falso:** Analizar y Replicar no aceptan
  instrucciones, así que el texto pegado junto a un link se mostraría y nadie lo usaría. El chip del link sale sólo si
  el link es TODO lo escrito; lo escrito nunca se esconde. El «)» final se conserva si abrió dentro del link, y un
  link tipeado y mandado con Enter también va a Analizar/Replicar (`panel-reglas.ts`, `sacarLink`, `linkEscrito`).
- Después de un guardado con control de versión, releer y devolver lo releído mete en la cadena del cliente la versión
  de OTRO: se devuelve la versión que escribió tu guardado (`docAplicado`). La otra mitad de la carrera sigue en
  `restaurarVersion` (`server.ts`): compara contra la versión que lee él, no contra la que comparó la pantalla (lo
  pisado no se pierde: queda en «Antes de restaurar»).

### Lo que quedó sin hacer (tanda 6)
- ~~Migraciones 0281 y 0282~~: **aplicadas en producción el 15/10/2026 antes del deploy**, y verificadas después
  (la columna es jsonb; la función de la 0282 sólo la ejecuta service_role). En esta casa las aplica quien las
  escribió, con `scripts/apply-migration.mjs`, ANTES o junto con el deploy cuando el código nuevo lee lo que agregan.
- **Decide Martín** (el triage, en la Ticketera): ~~`allow-popups-to-escape-sandbox` en el HTML personalizado~~ (sí,
  tanda 7); bloquear o no los estáticos de MaKo en hola-mako.site; HSTS propio; subdominios por landing; ~~el www
  automático al conectar un dominio raíz~~ (sí, tanda 7); el proveedor de IA del Diagnóstico en el ws1; si despublicar
  sigue reversible; el `form-action` con un checkout de Stripe en dominio propio; avisar al dueño cuando falla la
  pasarela en un pago de landing. Y de esta tanda: «Preguntar a MaKo» usa el chat de la casa (`/api/chart-insights`,
  Claude PAGO); ~~y si los comentarios de una página de afuera se marcan resueltos al pasar a la copia~~ (sí, tanda 7).
  Las tres tachadas las decidió el orquestador con criterio, por Martín, el 15/10 (docs/relevo/landing-generator.md).
- **De otra área:** ~~`esPedidoDeLanding` en `lib/mako-intencion.ts`~~ (tanda 7); la cadena de pago que termina en
  hola-mako.com y `cobroReusable` sin el modo (Integraciones, `lib/cobros.ts`); la atribución del Pixel en los enlaces
  `/pagar/` y `pixel-servido.ts` sin la URL tal cual (VSL Tracking); ~~`/api/mako-doer` sin `maxDuration` para los
  240 s de replicar por chat~~ (era la ruta equivocada: tanda 7, docs/hallazgos-infra.md); ~~lo que cuenta
  `lib/mako-capacidades.ts` de la tab~~ (tanda 7, `ed807c5d8`, con un guard).
- **MaKo Mobile**: con el teléfono, /landing-generator se reescribe a /m/landing, que no tiene Crear con IA, Analizar,
  Replicar ni el «+» (`lib/movil-rutas.ts`).
- El detector de voseo (`VOSEO`, `lib/puestas-data.ts:490`) no conoce pegá, elegí, subí, probá ni escribí: un guard
  de todo el repo, fuera de esta área.
- `copiaParaAplicar` reconoce la «Página web» idéntica por su primera sección (heurística; exacto si Replicar guardara
  el formato en `config.origen`); `restaurar_version_landing` no frena si la landing cambió después; los rechazos sólo
  se leen en la rama publicada de `analitica`; `paginaDeSeccion` quedó sin llamador; una app de Vite en varios
  módulos sólo se lee con el Pixel o pegando el texto; los videos no se anotan como [VIDEO] en el lector; las imágenes
  por Flow siguen afuera por Martín.
- **Verlo con clics** (lo hace Martín): la tab con Crear con IA, el «+», el link pegado, Replicar con sus 3 formatos,
  el Diagnóstico de varias páginas con «Aplicar» y Deshacer, la línea ámbar de pagos rechazados en «Análisis», y todo
  a 390 px. Las capturas del arnés quedaron en el scratchpad de la sesión 4eb065fe (`t6p-vista/capturas`).

## Tanda 7 (15/10/2026): Web Generator, UN cuadro con modos, el ▶, el www y la API entera

Dos pedidos de Martín (literales en `app/admin/dev/landing-generator/bitacora.ts`): el feedback de la tanda 6 en ocho
puntos (01:02: «Quiero que todo se llame ahora "Web Generator"…», el cuadro que se TRANSFORMA en vez de navegar, el ▶
descentrado) y «Ambos, tienen que pasarle absolutamente todos los botones. Todas las funciones a la API de MaKo» (00:10).
Siete agentes en `C:/dev/wt-web-t7` (rama `web-t7`): renombre, cuadro, motor, API, dos verificadores y la corrección.

### El renombre
- **Una ruta con SUBRUTAS se redirige con UNA página catch-all opcional** en la carpeta vieja:
  `app/landing-generator/[[...resto]]/page.tsx` → `redirect(await rutaConWs(destinoWebGenerator(resto, await
  searchParams)))`. Cubre `/<id>`, `/crear`, `/analizar` y cualquier subruta que aparezca después; el destino codifica
  cada tramo y descarta `.`, `..` y los vacíos, así que nunca sale de `/web-generator`. **Vive en:**
  `lib/ruta-web-generator.ts` (`destinoWebGenerator`, `RUTAS_VIEJAS_WEB_GENERATOR`), la página de arriba.
- **El guard de /chatbot copiado tal cual dejaba pasar justo los links que más viajan**: `` ['"`]/chatbot(['"`?#]|$) ``
  no caza `/landing-generator/${id}` ni `'/landing-generator/crear'`, los links del editor que MaKo manda por chat.
  /chatbot no tenía subrutas. El patrón es `` ['"`]/<ruta>(['"`?#/]|$) `` (la rotura «irDuro viejo en Replicar» da 5/2
  sólo con el `/`). ⚠️ Sigue sin ver un link absoluto o armado con una base (`https://hola-mako.com/landing-generator/12`,
  `${base}/landing-generator/${id}`): hoy no hay ninguno (grep del repo entero), pero el guard no lo frenaría.
  **Vive en:** `tests/web-generator-renombre.test.ts` (`LINK_VIEJO`).
- **Lo que NO se renombró, a propósito** (claves escritas en la base u otros contratos): la key `landing-writer` del
  nav, de `requireRolWs`/`tabEnCapa` y del onboarding con sus pasos (`generar`, `guardar`, `lg_publicar`); el área
  `landing` de la API y sus operaciones; `/api/landing-generator/*` y `/api/v1/landing/*`; tablas y buckets; los
  proyectos del tablero («Landing Generator», «Feature: Landing Generator»); la carpeta, el slug y la key de
  `/admin/dev/landing-generator`; el feature `landing-writer` de model-catalogo. Qué nombra todavía la ruta vieja fuera
  de `app/web-generator`, y por qué, está en el commit `ebc9057cc`.
- **El reemplazo masivo «Landing Generator» → «Web Generator» rompe citas de Martín y referencias históricas**: cambió
  una cita textual en `app/landing-analyst/LandingAnalystApp.tsx` («Lo de Landing Analyst se muda a Landing Generator y
  Landing Analyst se ELIMINA») y `lib/landing-writer.ts:19` pasó a nombrar un `app/web-generator/LandingWriterApp.tsx`
  que nunca existió. **Regla:** después de un reemplazo de nombre se barre el diff buscando «…» y «Martín» y se revierten
  las citas; una ruta de archivo se cambia sólo si el archivo se movió (así se actualizaron los «Vive en» de este
  documento: cada ruta, verificada en el disco).

### El cuadro con modos (puntos 2-7)
- **Cuatro pantallas eran cuatro componentes, y cambiar de opción perdía lo tipeado.** Cada modo es una derecha con su
  lugar de siempre en la URL (`?paso=importar`, `?analizar=`, `?vista=replicar`) y todas montan el MISMO componente en
  el mismo lugar del árbol: React conserva el estado. El cuadro avisa su modo para arriba (`onModo`), el Panel se lo
  devuelve como prop y el cuadro lo toma DURANTE EL RENDER (`if (modo !== modoVisto) { … setEstado(elegirModo(…)) }`),
  no en un efecto, así nunca dibuja el modo viejo. **Vive en:** `app/web-generator/Inicio.tsx` (`modoCaja`),
  `panel-reglas.ts` (`modoCajaDe`, `derechaDeCaja`, `derechaDeVuelta`).
- **Un popover con desplegables adentro no puede ser `MenuFlotante`**: el desplegable de adentro abre en OTRO portal y
  MenuFlotante cierra con cualquier mousedown fuera de su ref, así que elegir una opción cerraba la capa entera. Va una
  capa propia (`role=dialog`) que ignora `t.closest('[role="menu"]')`, registrada con `useCapaModal(true, { anidada:
  true })`: Escape cierra sólo lo de arriba. **Vive en:** `app/web-generator/crear/AjustesCaja.tsx` (`CapaComo`).
- **Un campo de texto en un panel pegado a un `<form>` manda el pedido con Enter** (envío implícito, en «Tono» o «Escribe
  para»). El panel se dibuja FUERA del form, después de `CajaPedido`, y un test fija ese orden. **Vive en:**
  `app/web-generator/CajaCrear.tsx` (`PanelMasAjustes`).
- **En un renglón con `flex-wrap`, el corte lo decide la base, no el `min-width`**: con `flex: 1 1 200px; min-width:
  140px` el campo bajaba de renglón a 390 px con lugar de sobra al lado de los chips. Base = min-width (120px). **Vive
  en:** `app/web-generator/CajaPedido.tsx` (`.gp-cc-linea > .gp-cc-entrada`).
- Contar `aria-pressed="true"` en el HTML de un componente que mete su CSS con `<style>` cuenta también los selectores
  (dio 4, no 1): se recorta el bloque del grupo antes de contar (`tests/web-generator-cuadro.test.ts`).
- «Pegar texto» y «Generar» eran la misma puerta (punto 4): un texto largo (500 caracteres o 5 renglones,
  `TEXTO_LARGO_*`) pegado en el cuadro ofrece solo «Tu texto» (de guía / resumir / tal cual). Analizar y Replicar
  siguen sin aceptar instrucciones (sus rutas no tienen el campo): lo escrito junto a un link con su pastilla queda a la
  vista y una línea avisa antes de mandar (`avisoDeTexto`); sin la pastilla, el link pasa a ser una REFERENCIA dentro
  del pedido. **Vive en:** `app/web-generator/crear/caja-modos.ts`.
- `CajaPedido`, compartida con /automations y el Dashboard, sólo sumó props OPCIONALES; ChatMako y NuevaHoja no pasan
  ninguna (lo fija un test). El contrato de cada prop está en el commit `3602f3f79`.

### El ▶ del video (punto 8)
- **El diagnóstico obvio era el equivocado**: «al triángulo le falta su corrimiento óptico a la derecha», y era al
  revés. El `play-relleno` de Phosphor ya trae el centroide en el centro del viewBox (x≈127 de 256; su caja va de 64 a
  240) y el `margin-left: 9%` lo corría otra vez: centroide +4,35 % del diámetro en los 8 diseños con video por igual
  (se nota más en el gris claro de «Clásico claro», el segundo). **Regla:** antes de compensar un ícono se mide su
  centroide (`getScreenCTM` + `getPointAtLength` sobre el path); un ícono «fill» de Phosphor ya viene compensado.
- **Y DOS hojas dibujan el mismo ▶.** La galería sale de `css.ts`; el video vacío del EDITOR, lo primero que ve Martín
  al crear desde un diseño, sale de `CSS_G2` en `BarraFormato.tsx`, con el ícono de CONTORNO y `margin-left: 3px`
  (+2,54 %). Arreglar `css.ts` no lo tocaba, y la verificación lo encontró. **Regla:** un arreglo visual se busca en
  todas las hojas que dibujan el elemento, y el test mide las dos. El primer test, además, daba verde con lo que no
  encontraba (juntaba sólo el selector EXACTO: `.gm-marcador-play>svg` o un `padding` en el círculo pasaban): ahora
  barre toda regla que nombre al marcador y exige que exista la del tamaño. **Vive en:** `lib/editor-landing/css.ts`,
  `app/web-generator/editor/BarraFormato.tsx` (`CSS_G2`), `editor/nodos/InsertadoVista.tsx`,
  `tests/editor-landing-play-centrado.test.ts`. (La tarea hablaba de «9 diseños con video»: son 8, Minimal no lleva.)

### Dominio propio: el www automático
- La forma, medida contra el proyecto: `POST /v10/projects/{p}/domains` con `{ name, redirect, redirectStatusCode:
  308 }` (así ya estaban www.hola-mako.site, www.hola-mako.com y www.makodigital.app).
- ⚠️ **`DELETE /v9/…/domains/{d}` acepta `removeRedirects`, que borra TODO lo que redirige a ese dominio**, también lo
  que MaKo no puso. No se usa: el www se suelta solo, ANTES que la raíz, por el DELETE con guard (`soltarWww`).
- **La referencia de Vercel dice que un dominio que ya está en el proyecto contesta 400, no 409.** `agregarWwwAVercel`
  mira los dos; `agregarAVercel` (la raíz) sigue mirando sólo el 409 (sin hacer).
- **Un dominio que en el proyecto REDIRIGE nunca llega al proxy** (Vercel redirige en el borde): conectarlo como
  landing la dejaba «verificada» sin verse nunca. `agregarAVercel` lo rechaza diciendo qué hacer.
- ⚠️ **Sin hacer: reclamar una raíz AJENA bloquea su www para cualquier otro negocio, y ese bloqueo no vence.** El
  reclamo de siempre (pendiente, sin verificar) suma el www apenas se conecta, y el www no es una fila con reserva de
  72 h: el dueño real que quiere su landing en www.sudominio.com recibe «Ese dominio ya lleva a sudominio.com…», de una
  landing que no es suya. Antes de la tanda 7, reclamar la raíz no tocaba el www. Arreglo propuesto: sumar el www recién
  cuando la raíz pasa a VERIFICADA (en `estadoDominio` con verificar), que además cubre las raíces conectadas antes de
  la tanda 7, que hoy no lo reciben (sólo se suma al conectar). `dominios.ts` (`sumarWww` desde `conectarDominio`,
  `agregarAVercel`), `dominios-reglas.ts` (`sumarWww` no mira si la raíz está verificada).
- ⚠️ **Decide Martín:** si el www de la raíz sirve OTRA cosa a propósito (su sitio en otro host), MaKo lo suma igual y
  la pestaña dice «Falta el registro de www» para siempre, sin forma de descartarlo (`queFalta` con `wwwApunta`). ¿El
  aviso pasa a informativo, o un «No uso www» suelta el www?
- Sin hacer: la pestaña no dice que MaKo suma el www, y la fila del CNAME www lleva el title genérico (sumar `'www'` a
  `RegistroDns['para']` y su texto a `PARA_REGISTRO` en `app/web-generator/editor/dialogos/DialogoPublicar.tsx`).
- **Vive en:** `lib/editor-landing/dominios.ts`, `dominios-reglas.ts` (`wwwDeRaiz`, `sumarWww`, `soltarWww`),
  `tests/editor-landing-dominios.test.ts`.

### Los comentarios de una landing de afuera, al pasar a la copia
- «Aplicar» un comentario de una landing de afuera deja el original RESUELTO. **La referencia del original a su copia
  no se puede guardar sin migración**: `landing_sugerencias` no tiene la columna, y meterla en el jsonb `hallazgo` no
  sirve porque `normalizarHallazgos` (`diagnostico.ts`) reconstruye el objeto con una lista blanca y se la come al leer.
  **Regla:** lo que haya que leer de vuelta va en una columna (con su migración y la tolerancia PGRST204) o se DERIVA.
  Acá se deriva de `mapa` + `docId` y de `copiaParaAplicar`: si la copia se borra, «Ver en tu copia» desaparece y el
  comentario sigue resuelto («Reabrir» lo vuelve a pendiente). **Vive en:** `lib/editor-landing/diagnostico-aplicar.ts`,
  `diagnostico-server.ts` (`aSugerencia`), `diagnostico.ts` (`originalesAResolver`).

### La seguridad de la página de afuera
- **Una política aflojada para una ruta le llegó a otra.** `allow-popups-to-escape-sandbox` se decidió para el bloque
  «HTML personalizado», que vive en hola-mako.site. Pero `CSP_HTML_LIBRE` era también la política de
  `/api/landing-generator/diagnostico/pagina`, que sirve HTML de TERCEROS en el ORIGEN DE LA APP (el iframe del
  Diagnóstico y la ventana del lector): en la ventana, la página de afuera pasó a abrir ventanas sin sandbox. El
  comentario («las landings viven en hola-mako.site») no valía para esa ruta. **Regla:** cada ruta que sirve contenido
  ajeno tiene su PROPIA constante de política (acá `CSP_PAGINA_AFUERA`: `sandbox allow-scripts`, sin ventanas ni
  formularios; el lector ya ataja `window.open` y los submit), y los tests fijan QUÉ constante usa cada bloque de
  `next.config.ts` (en el fuente y en `tests/editor-landing-origen.test.ts`, que evalúa `nextConfig.headers()`), no
  sólo que la política exista.
- **El sandbox por CSP no sobrevive a que la página se navegue sola (reverse tabnabbing; venía de la tanda 6).** La
  página aislada puede hacer `location = 'https://otro'`; el documento nuevo ya no trae la cabecera sandbox y conservaba
  `window.opener`, así que hacía `opener.location = <phishing>` sobre la pestaña de MaKo. La protección de la tanda 6
  («no puede navegar a su opener») no lo cubría. Medido en Chromium headless con el `JS_LECTOR` real: sin soltar el
  opener, la pestaña de MaKo terminó en la de phishing. Ahora el lector, en la ventana, guarda el opener (`abre`) y hace
  `window.opener = null` antes que corran los scripts de la página; la referencia guardada sigue sirviendo para
  `postMessage`. **Regla:** una ventana que sirve contenido de un tercero y necesita contestarle a su opener lo guarda en
  una variable y suelta `window.opener` apenas carga (AGENTS.md, «Servir contenido de AFUERA…»; docs/hallazgos-seguridad.md).
- ⚠️ **Decide Martín: el camino del Pixel conserva `window.opener` a propósito**: es una landing DECLARADA del negocio
  y su redirect vuelve a cargar el lector, que necesita el opener para contestar. Si esa página se navega a un tercero,
  el tabnabbing sigue siendo posible. `lector-script.ts`, `lector-pagina.ts` (`vaALaPaginaReal`).
- **Vive en:** `lib/editor-landing/html-libre.ts` (`SANDBOX_PAGINA_AFUERA`, `CSP_PAGINA_AFUERA`,
  `CABECERAS_PAGINA_AFUERA`), `diagnostico.ts` (`CABECERAS_PAGINA_DIAGNOSTICO`), `next.config.ts`,
  `lib/editor-landing/lector-script.ts`.

### Lo que MaKo cuenta de la pantalla
- La pantalla cambió y MaKo siguió dictando «abre Diagnóstico», «toca "Crear nuevo"» y «toca "Generar esquema"»: la
  cabecera del bloque prometía «los pasos nombran SÓLO botones que existen» y nada lo miraba. Ahora lo mira
  `tests/mako-capacidades-botones.test.ts`, que busca cada rótulo entre comillas de los pasos en `app/web-generator` SIN
  comentarios: `Inicio.tsx` todavía nombra «Crear nuevo» en un comentario, y un guard que lee el fuente crudo se engaña
  con eso. **Vive en:** `lib/mako-capacidades.ts` (`landing-diagnosticar`, `landing-escribir`).
- El Diagnóstico de una landing que en el ws1 decía «no pude» sin causa no era el tamaño ni un timeout: `chatClaude` no
  le pasaba la red de plataforma a la cascada. Está en docs/hallazgos-ia.md (vive en `lib/anthropic.ts`). Las trampas
  del entorno de esta tanda (el typecheck acotado sin memoria, el diff de dos puntos, el merge que rompe un test que no
  choca, `maxDuration`) están en docs/hallazgos-infra.md; las de la API, en docs/hallazgos-api-mako.md.

### Lo que quedó sin hacer (tanda 7)
- **La rama `web-t7` está SIN PUSHEAR** (15/10, 05:16). origin/main avanzó 4 commits más durante la corrección (hasta
  `b8b298600`): antes del push, otro merge (`git merge-tree` da limpio; de lo nuestro toca sólo
  `lib/api-mako/areas/chatbot.run.ts`), `node --import tsx scripts/generar-api-doc.mjs --check` y los lotes de tests.
  El typecheck completo lo corre el pre-push.
- **Decidido con la vara de AGENTS.md (`9f4585931`, 15/10/2026), sin hacer todavía:** el proyecto del Plan
  «Landing Generator» y «Feature: Landing Generator» SE RENOMBRAN (Martín pidió «todo»), migrando sus tareas por id y
  mirando antes lo que él tocó ese día (`lib/plan-proyectos-catalogo.ts:144`, `app/admin/dev/areas.ts`); la URL
  `/admin/dev/landing-generator` queda (es la clave del registro). El aviso del www que sirve otra cosa pasa a
  INFORMATIVO (no va en `falta`). Comentar como MaKo, sí: un autor «MaKo» que un admin puede borrar
  (docs/hallazgos-api-mako.md). **Sigue siendo de Martín** el opener del camino del Pixel: es aceptar un riesgo de
  seguridad, y eso va a la Ticketera.
- **Los diseños con animaciones** (segunda mitad del punto 8) quedan para la próxima tanda, con las decisiones ya
  tomadas (ver «Etapas propuestas… y lo que falta decidir», más abajo).
- El reclamo de una raíz ajena que bloquea el www sin vencer, las raíces de antes sin www, el 400 de `agregarAVercel` y
  la pestaña que no explica el www (arriba, en «Dominio propio»).
- El contenedor de Importar y el «+» dicen «PowerPoint, Word o PDF», y el cuadro lee también Excel, OpenDocument,
  texto, audio y video (`app/web-generator/CajaCrear.tsx:353` y `:509`, `ACCEPT_ARCHIVO`).
- MaKo Mobile (`/m/landing`) no tiene nada del cuadro (`lib/movil-rutas.ts`).
- Comentarios que siguen con el sandbox viejo escrito: `app/l/html/[docId]/[bloque]/route.ts:6`,
  `app/web-generator/editor/nodos/HtmlLibreVista.tsx:23` y `docs/diseno-editor-landing.md` (T6).
- Otros documentos siguen nombrando `app/landing-generator/` (esta cosecha actualizó sólo este y
  diseno-editor-landing.md): `docs/relevo/dashboard-v4.md`, `docs/dev-tabs-mapa.md`,
  `docs/hallazgos-chatbot.md`, `docs/hallazgos-landing.md`, `docs/hallazgos-mobile.md`, `docs/hallazgos-video-editor.md`,
  `docs/editor-imagen/relevamiento-integracion-mako.md`, `docs/diseno-mako-mobile-v2.md` y algunos relevos.
- **Verlo con clics** (Martín, en `/web-generator?ws=3`): la sidebar y el More del teléfono dicen «Web Generator»; un
  `/landing-generator/<id>?ws=3` viejo cae en su editor; los cuatro modos, pegar un link y seguir escribiendo, Backspace
  sobre los chips, arrastrar un PDF y una imagen reales del escritorio (el arnés simuló el drop) y un link desde una
  pestaña, «Plan» → «Más ajustes», mandar cada modo con un esquema real, «Volver» desde Crear; el ▶ de la galería y del
  editor; «Dominios» con una raíz real (el www en Vercel con 308 y la fila CNAME www); un Diagnóstico de afuera con
  «Aplicar» y «Ver en tu copia»; y por WhatsApp «publicá la landing del webinar», «replicá esta página https://…»,
  «cambia el titular de mi landing…». Todo a 390 px.

### La ventana del lector se abre en el MISMO clic: por qué existía el segundo botón (15/10/2026)

Pedido de Martín, con la captura del Diagnóstico de una landing de afuera: «Si no pudo leer la landing, no me debe
saltar el botón de "MaKo no pudo leerla sola" y las opciones de leer en tu navegador... Por defecto si no pudo de una
manera que vaya directo a abrir la ventana emergente y a analizar la landing...».

- ⚠️ **El segundo botón NO fue un descuido, y no se «arregla» sacándolo: era la consecuencia de una restricción de
  Chrome con el orden equivocado.** El navegador sólo deja abrir una ventana mientras dura la «activación transitoria»
  del clic (`navigator.userActivation`): el primer `window.open` la GASTA (medido: activa antes, inactiva justo después)
  y además vence con el tiempo (la documentación dice ~5 s; en headless siguió activa a los 6 s, sin confirmar). El orden
  era server → ventana: el clic mandaba el pedido, y el server contestaba `enNavegador` recién después de bajar la página
  (o de 1-3 minutos de IA cuando sí podía leer). En ese momento ya no se podía garantizar que el clic siguiera vigente,
  así que la ventana necesitaba OTRO clic: «Leer en tu navegador».
- **Ahora el orden es ventana → server.** El clic abre la ventana («Leyendo la página…», con el giro) y en paralelo salen
  el pedido de siempre y una PRUEBA rápida de lectura del server (`probarLectura`: `extraerLanding` + `motivoDePagina`,
  sin IA ni base). Si el server puede leer, la prueba cierra la ventana (medido en un banco con el módulo real: a los
  302 ms del clic). Si el pedido contesta `enNavegador`, esa MISMA ventana lee la página y el pedido se repite con la
  `lectura`, sin ningún clic. El parpadeo de una ventana que se cierra sola es el costo aceptado.
- **Lo que arranca solo usa la ventana del clic que lo disparó.** El Diagnóstico y Replicar arrancan desde un efecto al
  montarse: el clic real fue el ↑ del cuadro. Ese clic RESERVA la ventana (`reservarVentanaLectura`: misma URL, una vez,
  vence a los 15 s cerrándola) y el efecto la toma (`tomarVentanaReservada`). Sin clic (un deep link, `?analizar=`) no
  hay ventana posible: queda el camino de antes, con el botón.
- La corrección del comentario de la tanda 6: «un `await` antes la bloquea» no es exacto. Un `await` corto no la bloquea;
  la bloquea que pase demasiado tiempo o que la activación ya se haya gastado. La regla práctica sigue siendo la misma:
  el `window.open` va ANTES de cualquier espera.
- **Costos que quedan, a propósito:** la página de afuera se baja dos veces (la prueba y el pedido); si la prueba falla
  por un error pasajero y el server sí lee, la ventana queda en «Leyendo la página…» mientras la IA piensa.
- **Sin verificar:** el bloqueador de ventanas de verdad (Chrome headless abre ventanas sin ningún gesto, así que el
  camino «bloqueadas» y el vencimiento de la activación no se pueden medir ahí) y las pantallas reales renderizadas (las
  cubren los guards sobre el fuente). Que Martín lo vea con un clic en `/web-generator?ws=3` con una landing de Vite.
**Vive en:** lib/editor-landing/lector-navegador.ts (`abrirEnElClic`, la reserva, `pedirConVentana`, `leerEnNavegador`
con `opciones.ventana`) · lib/editor-landing/diagnostico-server.ts (`probarLectura`) ·
app/api/landing-generator/diagnostico/route.ts · app/web-generator/panel-reglas.ts (`urlConVentanaAlAbrir`) ·
app/web-generator/Inicio.tsx · app/web-generator/diagnostico/PanelDiagnostico.tsx · app/web-generator/crear/Replicar.tsx ·
tests/web-generator-ventana-en-el-clic.test.ts · *2026-10-15*

## Animaciones: el video de fondo del hero (relevamiento del 14/10/2026, sin código)

Pedido de Martín: animaciones de punta a punta, partiendo del video «Páginas Web ANIMADAS de $10,000 con Claude Design»
(técnica «Motion Sites»: imagen IA → video IA con el MISMO cuadro inicial y final, de fondo del hero). A «¿cuál de los
dos frentes?» contestó **«las dos cosas»**: el video IA de fondo Y las animaciones de la página. Esto es lo medido del
video; las animaciones de página y qué se puede replicar de una web ajena van aparte.

### El puente a Flow HOY no puede hacer un hero
- Genera clips (el 07/09 salieron dos `generar_clip`, texto-a-video `abra_t2v_4s_360p`), pero **MaKo no los muestra**:
  falta leer la respuesta POSICIONAL (operationId en `[2][0][0]`, mediaId en `[2][0][3][4]`; `nombreDeOperacion` de
  `video-action.ts:330` y `mediaDeFlow` de `lib/flow-media.ts:139` buscan campos por nombre, del REST muerto), el
  sondeo `estado_clips` (no tiene frase, así que cae al camino REST, que ya no existe) y la URL final.
- **El replay de BOQ sólo cambia el TEXTO** (`repetirEnBoq`, `extension/background.js:450-471`): modelo, duración,
  proporción e imágenes salen de lo que se enseñó. Un hero con cuadro inicial y final es una OPERACIÓN NUEVA enseñada
  con «Frames to Video», con dos imágenes distintas para ver dónde viaja cada mediaId.
- Flow SÍ tiene el modo (Video → Frames, «Add start frame / end frame»): Veo 3.1 Lite/Fast/Quality (4/6/8 s) y Omni
  Flash (4-10 s), según support.google.com/flow/answer/16352836, leída el 14/10. No está dicho si la MISMA imagen de
  inicio y fin da movimiento o un plano quieto: se mide.
- ⚠️ La operación nueva NO puede entrar en `A_PEDIR`: `puedeFilmar` (`background.js:1316`) deja el puente en
  `sin_sesion` si falta una, y el server deja de repartir: todos los clientes del Video Generator dejarían de filmar
  hasta pagar créditos por enseñarla. Hace falta un «listo» por operación (el mismo bloqueo de las imágenes, arriba en
  «Lo que quedó sin hacer»).
- Créditos de Flow por clip (support.google.com/flow/answer/16526234, sin fecha, leída el 14/10): Lite 10 (Ultra 5),
  Fast 20 (Ultra 10), Quality 100; Omni Flash 720p 12-15. El 1080p es un reescalado, gratis con Plus/Pro/Ultra; sin
  suscripción no hay. La nativa es 720p, H.264 24 fps. Veo trae audio (se descarta; ojo `BLOCK_SILENCED_VIDEOS` de
  `lib/flow-clip-referencias.ts:52-56`, sin medir).

### El peso, medido (ffmpeg; 4 fuentes de 8 s: IA limpia, IA con grano, material real, mucho movimiento)

| 8 s, H.264 CRF 26, sin audio | 1080p | 720p | 480×854 vertical |
|---|---|---|---|
| IA limpia / con grano | 1,3-2,2 MB | 0,7-0,9 MB | 0,3-0,4 MB |
| Material real / mucho movimiento | 3,4-3,6 MB | 1,7-1,9 MB | 0,8-1,0 MB |

- AV1 pesa 26-69 % menos que H.264 con igual o mejor VMAF (en Safari depende del hardware: H.264 de respaldo).
- **El ping-pong duplica el peso** (×2,00-2,07 en las 12 parejas). El **bucle por fundido** (el último segundo
  fundido sobre el primero) cierra la costura sin sumar (−10 % a +8 %): SSIM en la costura 0,92-0,93, igual que dos
  cuadros seguidos; repetir el clip tal cual da 0,41-0,69 (el salto se ve).
- **4G** (Lighthouse «Slow 4G» 1,6 Mbps / DevTools «Fast 4G» 9 Mbps, +0,6 s por el origen nuevo del bucket): 480
  vertical 2,2-5,8 s / 0,9-1,6 s; 720p 4,3-10,2 s / 1,3-2,4 s; 1080p 7,3-18,7 s / 1,9-3,9 s.
- **Por eso el póster es el LCP**: la imagen IA en WebP pesa 37-42 KB a 480 vertical y 143-167 KB a 1080p.

### El diagnóstico obvio era el equivocado
- **«VP9 da VMAF 68-70» no era el códec: era la medición.** El WebM guarda los tiempos en milisegundos y a 24 fps los
  cuadros no caen justos, así que se comparaban cuadros desfasados. Alineando por número de cuadro, VP9 da 93-96.
- **`autoplay` le gana a `preload`**: el nodo `video` de hoy lleva `autoplay` (`especificacion.ts:839-848`), así que se
  baja apenas se lee el HTML y le roba ancho de banda al póster (en Slow 4G, el LCP sube ~0,7-0,8 s).

### Lo que la plataforma ya deja y lo que no
- Bucket `landing-imagenes`: público, 100 MiB, png/jpeg/webp/gif/mp4/webm (`0246_editor_landing.sql:154-163`): **no
  acepta AVIF** (el póster AVIF pesaría 40-60 % menos). Las subidas no pasan `cacheControl` (queda 3600 s).
- La publicada: `media-src 'self' <bucket>` (`pagina-publica.ts:458`) deja el `<video>`; los scripts entran sólo por
  HASH, así que la lógica del video va en `SCRIPT_PAGINA` (`:299-410`, que ya usa IntersectionObserver y reduced-motion).
- El hero «fondo» sólo admite imagen (`.gm-acento` con `background-image`, `especificacion.ts:681-693`; `AttrsTarjeta`
  no tiene campo de video, `doc.ts:247-264`).
- Buenas prácticas, con fuente en el relevamiento: el póster como `<img>` con srcset y `fetchpriority` debajo de un
  `<video muted playsinline loop preload="none">` SIN `autoplay` en el HTML (el script le pone `src` y `play()` después
  del load); la variante por ancho la elige el script; reduced-motion o Save-Data → sólo el póster; pausar fuera de
  pantalla y con la pestaña oculta; un botón de pausa (WCAG 2.2.2, nivel A, para lo que se mueve solo más de 5 s); iOS
  en ahorro de energía no reproduce solo (WebKit WONTFIX 219889): mostrar el video recién con el evento `playing`.
  Framer recomienda bucles de menos de 5 MB.

### Lo que se recomienda y lo que decide Martín
- **Etapa 1, sin Flow:** «Fondo animado» en el hero `fondo` con un video SUBIDO o de una galería; MaKo lo comprime en el
  navegador de quien sube con mediabunny (ya está en el repo,
  `app/video-editor/_opencut/sounds/components/extraer-audio.ts:93`): ≤8 s, sin audio, 480×854 + 1280×720 + póster
  WebP, y el bucle por fundido. Nada de ping-pong.
- **Etapa 2, con Flow:** los pasos del puente de arriba + la operación de Frames + el «listo» por operación.
- No va por defecto en los diseños con VSL (8 de 9: el VSL es el protagonista); sí como opción en «Oscuro moderno» y
  «Editorial».
- ~~Decide Martín~~ **DECIDIDO el 15/10/2026.** Martín: «B · Sólo generado por MaKo, cuando el puente pueda» (la
  etapa 1 de arriba, con video SUBIDO, NO se hace, y la función no se ofrece hasta que el puente la cumpla) y «Eso lo
  elige el usuario» (el modelo de Flow es un control de la pantalla, no un default nuestro). Lo demás lo decidí yo con
  lo medido (la vara de AGENTS.md `9f4585931`: si se contesta con lo escrito o el código, no va a la Ticketera):
  - **Tope de calidad: 720p (1280×720) en escritorio y 480×854 vertical en el teléfono**, H.264, ≤8 s, sin audio,
    menos de 5 MB, con póster WebP. No 1080p: el nativo de Flow es 720p (su 1080p es un reescalado) y en 4G el 1080p
    tarda 1,9-3,9 s contra 1,3-2,4 s el 720p (tabla de arriba), con el póster de LCP en los dos.
  - **Por defecto, en ningún diseño con VSL** (8 de 9: el VSL es el protagonista); como opción en «Oscuro moderno» y
    «Editorial», como estaba recomendado.
  - Cuándo se mide Flow en ws3 sigue siendo de Martín (es su Chrome).
- **Sin medir:** ninguna generación real de Flow (ni el cuerpo BOQ de Frames, ni el peso de un clip de Veo, ni si un
  fallo cobra); si las URL del bucket contestan 206 a un pedido por rango (Safari lo exige:
  `curl -sI -H "Range: bytes=0-1" <url.mp4>`); WebCodecs en un teléfono; un LCP en una traza real.

## Animaciones: Lottie y «Text-to-Lottie» (relevamiento del 15/10/2026, sin código)

Pedido de Martín (15/10 00:10, por «Estrategia 3 cuentas»), con un post de Instagram: «Es para crear animaciones... Y en ese
caso son tipo Lottie, muy utilizado en landing. Pero puede investigar otras skills o investigar otras animaciones».
Workflow `wf_b629deb0-0b1`; las mediciones y los scripts quedaron en el scratchpad de la sesión 4eb065fe (`lottie/`).

- **«Text-to-Lottie» es `github.com/diffusionstudio/lottie`, MIT estándar** (LICENSE leído completo, 5.580 estrellas):
  ninguna cláusula como la que dejó fuera a GSAP. **No es un modelo ni una API paga**: es un SKILL.md con recetas que le
  enseñan al agente (Claude Code) a escribir el JSON de Lottie a mano, más un reproductor local con Skottie. Corrió en
  esta máquina (npm 406 s, Vite de ~680 MB de RAM): va en una carpeta FUERA del repo y nunca a la vez que el dev server.
  Verifica sólo en Skottie («Do not verify through lottie-web»), que no es el reproductor de la web, y no menciona
  reduced-motion.
- **Los Lottie gratis de LottieFiles** (Lottie Simple License): uso comercial sí, pero «does not include the right to
  collect or compile Files… to replicate or develop a similar or competing service». Unas pocas piezas dentro de una
  plantilla, sí; una galería de animaciones de MaKo armada con archivos de LottieFiles, NO. Lo confirmó por su cuenta
  el chat de Video Editor leyendo la licencia (15/10/2026, docs/editor-video/relevamiento-plantillas.md): el FORMATO se
  copia; el CONTENIDO tiene que ser propio o de una fuente cuya licencia lo permita por escrito; y que el cliente
  IMPORTE una animación suya es otra feature, que sí se puede. ⚠️ Y «el README dice MIT» no alcanza: ese relevamiento
  encontró un repo con MIT en el README y SIN archivo LICENSE (404). Antes de cualquier biblioteca, la licencia se lee
  en el archivo y queda escrita acá; si ninguna fuente sirve, se avisa (AGENTS.md, `272b7e038`).
- **El reproductor, medido** (gzip): lottie-web 5.13.0 light SVG **46 KB** y anda con la CSP de la publicada SIN tocarla,
  si el JSON va embebido o sale de `'self'`; **desde el bucket lo bloquea `connect-src`**. dotlottie-web (~529 KB con su
  wasm), ThorVG (~130 KB), Rive (~424 KB) y Skottie (8 MB) **no arrancan sin `'wasm-unsafe-eval'`**. lottie-web no se
  actualiza desde mayo de 2025.
- **CSS le gana en lo chico**: 0,35-0,44 KB contra 46 KB + el JSON, y en bucle con CPU ×4, **0,3-0,5 % de CPU con
  transform/opacity contra 18-26 % de un Lottie**. Trampa: un trazo con `stroke-dashoffset` cuesta en CSS lo mismo que en
  Lottie (~16 %).
- **Ningún reproductor respeta solo `prefers-reduced-motion`**, y lottie-web no se pausa fuera de pantalla. Apagar sólo
  el autoplay deja el primer cuadro, y en un check ese cuadro está VACÍO: con reduce va `goToAndStop` a un marcador
  «poster» que muestra el estado final.
- **Recomendación** (no cambia ninguna de las 7 decisiones de la Ticketera): la etapa 4 (cinta, pasos, carrusel, máquina
  de escribir, contador) va TODA en CSS + nuestro script. Lottie entra sólo como un recurso acotado, la «Ilustración
  animada» propia de las plantillas de la etapa 6: lottie-web light SVG desde `'self'`, cargado por `SCRIPT_PAGINA` sólo
  si la página tiene una y la sección se acerca; JSON propio (generado con la skill o a mano) sin expresiones ni imágenes,
  el color del acento en slots, ~1-5 KB gzip, con su marcador «poster», pausa fuera de pantalla, bucle finito de hasta 5 s
  o botón de pausa (WCAG 2.2.2), y nunca en el primer pantallazo.
- **Sin medir:** hardware real (iPhone iOS 18/26, Android de gama baja, los navegadores de Instagram y Facebook), el peso
  en 4G real, el LCP con un Lottie en el hero, y la skill instalada con `npx skills add` en una sesión de verdad.

## Animaciones: las de la página y replicarlas de una web ajena (relevamiento del 14/10/2026, sin código)

Workflow `wf_930dd090-77a` (el video y Motion Sites, otras fuentes, medir qué se replica en webs reales, el mapa del
editor, y un crítico que midió lo que faltaba). Las salidas y los scripts quedaron en el scratchpad de la sesión
4eb065fe (`relevamiento-anim.json`, `critico/`, `anim/salidas/tabla-comparada.tsv`).

### ⚠️ Lo que YA anda mal hoy: el interruptor «Animaciones» hace parpadear el hero y suma ~1,2 s de LCP
- Medido sobre la publicada REAL (render.ts + armarDocumento; 3 plantillas, 390×844, CPU ×4, 3 corridas): sin
  «Animaciones» el LCP del H1 da 236-404 ms; con el interruptor (prendido por defecto) da 1.428-3.004 ms en 6 de 9.
- **Parpadeo** en 5 de 6 corridas: el H1 se pinta VISIBLE (FCP 404-1.048 ms), el script lo pasa a opacidad 0 entre
  25 y 456 ms después, queda invisible 269-380 ms y recién ahí entra con el fade. Causa: `SCRIPT_PAGINA` va al final
  del `<body>` (`pagina-publica.ts:533-544`) y pone `html.gm-anim` cuando la página ya se pintó.
- **Arreglado con la opción A** (rama `landing-parpadeo`, en main desde el merge `f9039872`, 15/10/2026): antes de
  poner `gm-anim`, el script deja `gm-visto` con `animation: none` en línea la primera sección y todo lo que corta la
  pantalla (ellos, sus bloques y lo marcado con `data-animar` adentro). Va en el SCRIPT, que no queda congelado: llega
  a todas las publicadas sin republicar. Medido con el mismo arnés (publicada real armada con render.ts +
  armarDocumento, 390×844, CPU ×4): **el H1 queda en opacidad 1 desde el primer cuadro en 6 de 6 corridas** (antes:
  1 → 0 → fade, visible recién a los 1,3-2,7 s). Lo de más abajo sigue animando al entrar.
- ⚠️ **Salió SIN la respuesta de Martín al A/B** (A: el hero quieto; B: el hero con un fade que no parpadea), y fue a
  propósito: el parpadeo era un bug del código que iba a recibir la PRIMERA landing que publicara alguien (0
  publicadas el 15/10), y una decisión estética pendiente no lo justifica. El camino a B sale de A igual que de cero
  (es otro arreglo del mismo script, que tampoco queda congelado). Si contesta B, se cambia; no hay nada que deshacer.
- **El número que vale: con el arreglo, «Animaciones» prendido CUESTA LO MISMO QUE APAGARLO.** LCP del H1, 3 corridas
  por plantilla, mismas condiciones (ms):

  | Plantilla | Antes, con «Animaciones» | Con el arreglo, con «Animaciones» | Sin «Animaciones» |
  |---|---|---|---|
  | agenda-llamada | 1.428-3.004 en 6 de 9 corridas de las tres; 352-636 en las otras 3 | 588 / 344 / 348 | 352 / 272 / 264 |
  | lead-magnet | (idem) | 312 / 248 / 280 | 292 / 256 / 280 |
  | webinar | (idem) | 400 / 452 / 368 | 424 / 332 / 352 |

  **Regla:** el LCP de una landing NO se arregla apagando la feature: el costo era el parpadeo, no la animación.
- **En PRODUCCIÓN (15/10/2026, deploy `mako-hvho33ln9`)**: una landing de prueba en el ws3 («Clásico claro» + «Agenda
  una llamada», publicada en hola-mako.site, que servía el script nuevo), medida con el mismo teléfono emulado contra la
  red real. LCP del H1 en ms, y el parpadeo en **0 de 9** corridas:

  | Corrida | Con «Animaciones» | Sin «Animaciones» |
  |---|---|---|
  | 1ª tanda | 2.556 / 1.644 / 1.200 | 1.236 / 1.244 / 1.124 |
  | 2ª tanda (con una visita antes) | 1.256 / 1.124 / 1.156 | — |

  - **Con y sin cuestan lo mismo** (≈1,1-1,3 s). El 2.556 es la PRIMERA visita a la página recién publicada (en frío):
    repetida con una visita antes, desaparece. No es la animación.
  - **Es más que en la rama (250-590 ms) por la RED, no por la página**: en las 9 corridas el FCP es igual al LCP, o
    sea que el H1 es lo primero que se pinta y lo que se espera es el HTML (128 KB) desde Vercel. En la rama la página
    se servía local, sin red.
  - Lo que dejó la prueba, y se borró después (con el OK de Estrategia): la landing #21 del ws3, que despublicada
    quedó en la Papelera con el slug `prueba-anim-mv92gcgj` reservado, y **9 visitas en `landing_visits` del ws3**
    (el Pixel de la página contó las mediciones). Quien repita la prueba, que las borre igual: son datos falsos en
    las analíticas del Cliente de Prueba.

### ⚠️ La Papelera de landings no se vacía sola, y una landing ahí sigue ocupando su dirección (15/10/2026)
- Una landing en la Papelera queda para siempre: sale sólo con «Borrar para siempre», a mano (`borrar` en
  lib/editor-landing/server.ts). La Papelera del curso sí se purga sola a la semana (`purgarPapeleraDelCurso`,
  app/api/cron/curso-purga). Mientras la fila exista, su `slug` sigue tomado: nadie del negocio puede publicar otra
  en esa dirección, y la pantalla no dice que está ocupada por algo de la Papelera.
- Despublicar deja `sitio_activo` en true; no sirve nada porque `publicado` queda null y lo que se sirve exige los
  dos (`leerPublicado`, publicar.ts:258). Es inofensivo, pero se lee como «el sitio sigue activo».
- **Propuesta, para decidir (no se hizo):** purga automática a los 30 días, como la del curso. Sólo filas con
  `papelera_at` y sin `publicado`, por el mismo `borrar` (que se lleva versiones y comentarios), y la dirección se
  libera sola. No es urgente: el 15/10 hay 0 landings publicadas y nadie chocó con una dirección tomada.
  **Vive en:** lib/editor-landing/server.ts (`mandarAPapelera`, `borrar`) · lib/editor-landing/publicar.ts (`despublicar`).
- Para volver a medirlo: armar la publicada real con `htmlDePagina(pagina, config, tema, { modo: 'publico' })` +
  `armarDocumento(...)` de las primeras plantillas, servirla con Playwright (`ctx.route`, red externa cortada), CPU ×4
  por CDP, y anotar por `requestAnimationFrame` la opacidad de `h1.gm-titulo` × su `.gm-tarjeta` (el parpadeo) y la
  última entrada `largest-contentful-paint` (el LCP).
  En producción, la landing se crea y se publica desde un script con las MISMAS funciones del server
  (`crear` de lib/editor-landing/server.ts, `publicar`/`despublicar` de publicar.ts) adentro de
  `runWithWorkspace(3, …)`: hay que resolver `server-only` a un módulo vacío **y `next/headers` a uno sin cookies**
  (`crear` lee el autor con `getUsuarioActual`, y fuera de un request `cookies()` tira «called outside a request
  scope»). El import dinámico de un `.ts` del repo va con `pathToFileURL(...).href`: una ruta `C:\…` pelada da
  `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Nunca en el ws1 ni en otro negocio de un cliente.
  ⚠️ **Con las cookies vacías, todo lo que corra FUERA de `runWithWorkspace` resuelve el workspace al ws1**
  (`resolverDesdeCookies`, lib/workspace.ts: «no hay cookie de sesión» = cron/webhook = dueño): un `await` que se
  escapa del callback escribe en el negocio de Mauricio sin un error. Después de correr, se relee la fila filtrando
  por el ws de la prueba.

### El video: lo que es y lo que NO conviene copiar
- La única página del video publicada es Scarlett (`scarlett-recepcionista.vercel.app`, leída en pantalla 29:47-30:30):
  7 JSX que el navegador traduce con Babel, sin GSAP ni Framer Motion. Cuatro técnicas: video IA de fondo con cuadro
  inicial = final; efectos atados al scroll (hero que se desvanece: opacidad 1 − 2,5p y −60p px; fondo con escala
  1 + 0,3p; sección que crece de 0,88 a 1 entre p 0,35 y 0,75); entradas por IntersectionObserver (20 px, 900 ms,
  cubic-bezier(0.22,0.8,0.3,1), 120 ms entre hermanos); loops en CSS (cinta de reseñas en dos filas de 55 y 65 s con
  pausa en hover, pasos que avanzan cada 2,2 s).
- **Su ping-pong se CONGELA en la mitad hacia atrás**: retrocede con `currentTime −= dt` por cuadro sobre un MP4 con UN
  solo cuadro clave, y el video está «seeking» el 99,6 % de los cuadros (1-2 fps). Y no hacía falta: su clip ya cerraba
  solo (SSIM 0,985 entre el primer y el último cuadro). **Regla:** loop nativo; si no cierra, fundido en el corte.
- motionsites.ai: 582 «plantillas» (195 gratis), cada una un PROMPT con CSS, parámetros y la URL de un video en el CDN
  de Higgsfield; los videos pesan 5-46 MB con un solo cuadro clave y 11 de 13 no cierran el loop (recodificados: 46,1 →
  1,96 MB, SSIM 0,964). **Sus términos (30/09/2026) prohíben redistribuir el prompt y los videos son de ellos**: las
  plantillas de MaKo tienen que ser propias, con la técnica y sin su contenido. Ninguna página del autor respeta
  prefers-reduced-motion.

### Las decisiones técnicas que salieron medidas
- **GSAP queda fuera POR LICENCIA** (no por gusto): la «Standard License» de GSAP (gsap.com/community/standard-license,
  vigente desde el 30/04/2025, modificada el 30/05/2025, leída el 14/10/2026) dice «Prohibited Uses… tools that allow
  users to build visual animations without code… that competes with Webflow's visual animation building capabilities»
  y «Competitive Products… enables users to create, edit, or manage animations through a visual interface or builder
  similar to Webflow». Un panel de animaciones en el Landing Generator cae de lleno, en el editor y en lo publicado.
  Antes de sumar cualquier librería de animación, leer su licencia con esta pregunta. (El GSAP propio de una web ajena
  que corre dentro de la copia fiel no está alcanzado: no lo distribuimos nosotros.)
- **CSS nativo + el script propio con hash**: `animation-timeline` / `view()` / `scroll()` están en Chrome 115 y en
  Safari/iOS 26; Firefox estable (158) no. Sin polyfill: donde no hay soporte, la página queda completa y quieta. La
  publicada sólo corre `'self'` + el hash de `SCRIPT_PAGINA` (`pagina-publica.ts:446-453`): una librería de un CDN
  ajeno no corre, y un video del CDN de otro tampoco carga (`media-src` = self + el bucket).
- El modelo: **preset + parámetros** (duración, demora, distancia, curva, disparo) con los nombres del Image Editor
  (`app/image-editor/_doory/editor/animation/strings.ts`: Desvanecer, Subir, Crecer, Deslizar, Barrido, Máquina de
  escribir…), a nivel landing y sección, nunca por bloque: «Editar con IA» rehace los bloques y perdería el attr.
- **Gamma (la fuente) no tiene panel de animaciones**: sólo el interruptor y Spotlight en Presentar. **Decidido
  (15/10/2026): el panel se COPIA del de Canva** (la fuente del Image Editor): una lista donde cada efecto se reproduce
  solo. Era la regla de copiar tal cual, no una opción: se abre el panel de Canva de verdad y se nombra en el commit.

### Qué se puede replicar de una web ajena (medido en la ventana aislada, que es lo que corre sin Pixel)
- **Fiel** (cae exacto en un preset): animaciones y transiciones CSS — `document.getAnimations()` da keyframes, duración,
  curva y demora aunque la hoja sea de OTRO origen (AOS: 63 transiciones con 0 de 2 hojas legibles); lo atado al
  scroll en CSS; AOS (`data-aos*`, se lee del HTML sin correr nada); animate.css (la clase, no la hoja); Framer appear
  (el JSON `<script type=framer/appear>` del HTML); Webflow IX2 (93 eventos en vivo, o el literal del chunk leído con
  un parser, nunca `eval`); GSAP clásico simple (webflow.com: 79 tweens, 12 triggers).
- **Aproximado**: lo que se escribe cuadro a cuadro en `style` (scroll transforms de Framer, Motion, callbacks de GSAP);
  GSAP con pin o timelines encadenadas; texto por palabra/letra; hover hecho en JS (un script no puede provocar
  `:hover`); las variantes de celular (la ventana lee en ancho de escritorio).
- **No**: canvas/WebGL/three.js/Spline/Unicorn Studio (no queda en el DOM); el archivo de video, Lottie, Rive o imágenes
  ajenas (derechos; se copia la técnica y se regenera); apps de Vite en varios módulos (gsap.com: 0 animaciones) y
  sitios detrás de Cloudflare (lovable.dev: 403 al fetch del server); lo atado al scroll DENTRO de la copia fiel
  «Página web» (medido: `view()` congelada en 0,444 y 0 eventos de scroll en el iframe de alto ajustado).
- Trampas: `getKeyframes()` no devuelve custom properties (se leen del CSS que baja el server); si la PC de quien
  replica tiene «reducir movimiento», la web ajena muestra menos (webflow.com baja de 12 a 1 triggers);
  `estilo-original.ts:779` saltea `animate(.min).css` y `aos(.min).css`; el tope total del lector es 17 s
  (`lector-script.ts:117`).

### Reglas para cuando se construya
- **Todo CSS de animación va colgado de una condición** (`html.gm-anim` en la publicada, `[data-movimiento="vivo"]` en
  el editor) y **nunca `html.gm-anim` en la app**: escondería las miniaturas, que viven en el mismo documento.
- La hoja de cada publicada queda congelada y `SCRIPT_PAGINA` no: un cambio del script mantiene el sentido de
  `gm-anim` y `gm-visto`, o rompe las hojas viejas.
- Un attr nuevo sale en un deploy ANTES que su UI: TipTap tira el attr que no conoce y el autoguardado de una pestaña
  vieja lo borra.
- Un transform, filter o will-change en una sección se vuelve el contenedor de lo `position:fixed` que tenga adentro
  (barra de CTA, WhatsApp), como ya pasó en /m (`docs/hallazgos-mobile.md:202`).
- WCAG 2.2.2: lo que se mueve solo más de 5 s lleva pausa; 2.3.3: el parallax se apaga con reduce. Sólo transform,
  opacity y clip-path en el teléfono; nada de scroll-jacking (Lenis no).
- No hay A/B que pruebe que las animaciones venden; lo medido es que la velocidad sí: defaults conservadores y medir
  con Experimentos antes de prender efectos en todas.

### Etapas propuestas (cada una se entrega sola) y lo que falta decidir
**Estado al 15/10/2026 (tanda 8):** hechas la 0, la 1, la 2, la 3 y la 7; la 5 NO se hace (decisión de Martín: el video sólo lo genera MaKo); la 8 espera al puente a Flow (el lugar del video ya está: `VIDEO_FONDO`); la 4, la 6 y la 9, sin empezar.
0. El parpadeo y el LCP de hoy. 1. Modelo y render sin UI. 2. El editor la MUESTRA (al elegir el efecto y con un ▶
Reproducir dentro del lienzo). 3. API de MaKo (`cambiar_animacion_landing`). 4. Efectos de scroll y componentes con
movimiento (cinta, pasos, carrusel con snap, máquina de escribir, contador). 5. Video de fondo subido (arriba).
6. Plantillas con movimiento (perfil para los 9 diseños + 2-3 propias). 7. Replicar las animaciones. 8. Video IA por
Flow. 9. Presentar: View Transitions y bloque a bloque.
Sin probar en hardware real: un iPhone con iOS 18 y 26, un Android de gama baja y los navegadores de Instagram y
Facebook, antes de prender un efecto por defecto.
~~Las decisiones de Martín están en la Ticketera~~ **Todas resueltas el 15/10/2026.** Martín contestó
`landing-video-fondo` (sólo generado por MaKo cuando el puente pueda: la etapa 5, el video SUBIDO, no se hace) y
`landing-video-modelo` (lo elige el usuario). Las demás las retiró Estrategia de la Ticketera por la vara de AGENTS.md
(`9f4585931`: lo que se contesta con lo escrito o el código se decide acá) y quedaron así:
- `landing-anim-panel`: se copia el panel de Canva (arriba).
- `landing-anim-default`: el interruptor «Animaciones» sigue PRENDIDO por defecto, porque con el arreglo del parpadeo
  cuesta lo mismo que apagado (0 parpadeos en 9 corridas en producción, LCP igual). Los efectos de las etapas 4 y 6 se
  definen por diseño al construirlos, mirando la plantilla equivalente de Canva y escribiendo la fuente.
- `landing-video-calidad`: 720p en escritorio y 480×854 en el teléfono (arriba, en «Lo que se recomienda»).
- `landing-replicar-scroll`: sí se avisa, donde se lee la consecuencia: al replicar una web con efectos atados al
  scroll que la copia no trae, una línea corta en el resultado.
- `landing-anim-parpadeo`: salió con la A (el hero quieto); ver la sección de abajo.
Y la decisión del aviso de un pago rechazado (`landing-aviso-rechazo`): al NEGOCIO, por los canales que ya existen,
como plantilla del catálogo de avisos (lib/avisos-catalogo.ts), no un envío escrito en el código.
Dos chicas las resolvió el orquestador con criterio (14/10, no van al mazo): **MaKo Mobile muestra las animaciones**
con la misma regla (sólo transform y opacity, nada atado al scroll, apagadas con «reducir movimiento»: si no, habría
dos landings según el aparato y nadie previsualizaría lo que publica); y **el ▶ del editor reproduce aunque quien
edita tenga «reducir movimiento»** (es una acción apretada a propósito), pero nada se auto-reproduce al abrir el
panel: ahí manda la preferencia del sistema, con un renglón que lo diga.

## Tanda 8 (15/10/2026): las animaciones, una sola `normalizarUrl` y el `window.opener` del Pixel

Pedido de Martín (14/10, a «¿cuál de los dos frentes?»): «las dos cosas», las animaciones de la página Y el video de
fondo en loop, y poder replicarlas al copiar una web. Las decisiones del 15/10 llegaron por el coordinador «Estrategia 3
cuentas» y están arriba, en «Etapas propuestas… y lo que falta decidir». Chat «Landing Generator», cuenta claude3.
Rama `web-anim` (worktree `C:/dev/wt-web-anim`).

### El contrato y el render (commit `607ceb205`, sale ANTES que el panel)

**Vive en:** `lib/editor-landing/animaciones.ts` (el contrato) · `doc.ts`, `api-tipos.ts`, `validar.ts`,
`especificacion.ts`, `render.ts`, `css.ts` (bloque 16), `pagina-publica.ts`, `publicar.ts` ·
`tests/editor-landing-animaciones.test.ts`, `tests/editor-landing-animaciones-render.test.ts`

- **Dos niveles, resueltos en el RENDER, no en el navegador.** La landing tiene un estilo
  (`config.pagina.estiloAnimacion`, 8, con los nombres de la «Animación de página» del Image Editor); cada sección
  guarda un efecto propio, `'ninguna'` o `null` (= hereda). `animacionDeSeccion(seccion, pagina, índice)` decide, y la
  sección sale con `data-anim` / `data-anim-dir` / `data-anim-texto`. «Alterna» (Deslizar) cuenta sólo las secciones
  VISIBLES: una oculta no corre la paridad.
- **«Subir» es EXACTAMENTE la entrada de siempre** (20 px, 1 s, la curva de Gamma, 80 ms entre bloques) y es el estilo
  por defecto: una landing que nunca eligió nada no cambia. Lo fija el test con el string entero.
- **El transform va en los BLOQUES, nunca en la sección** (la sección sigue con la entrada de opacidad): una sección con
  transform se vuelve el contenedor de lo `position:fixed` de adentro (la barra de CTA, el WhatsApp).
- **El HTML viejo sigue igual**: una publicada sin `data-anim` (hoja congelada) cae en las reglas de siempre
  (`gm-entrada`). La hoja nueva sólo agrega.
- **«Enfoque» (filter: blur) cae a «Desvanecer» en el teléfono**, por la regla de «sólo transform, opacity y clip-path».
  Un solo corte (`CORTE_CELULAR = '(max-width: 768px)'`) para la hoja, el `sizes` del póster y el script.
- **El hash de la CSP no hubo que tocarlo**: ya se calcula del script real (`hashScript(SCRIPT_PAGINA)`), y el test
  compara con el `<script>` servido.
- **«Palabras» y «Máquina de escribir» parten los títulos en `span.gm-u`** sin cambiar el `textContent` y con
  `aria-label` del texto original, y NUNCA lo que ya estaba en pantalla al cargar (el arreglo del parpadeo). ⚠️ **Los
  títulos con DEGRADADO (6 temas, `background-clip: text`) no se parten**: un pedazo que anima opacidad o transform se
  pinta en su propia capa y se vería vacío hasta terminar. Es lo esperado de Chrome, SIN MEDIR en un navegador.
- **La hoja creció de 105 a 173 KB sin comprimir (+4,9 KB gzip, +2,2 KB brotli)**: una regla por efecto, dirección y
  escalón, y queda congelada en cada foto. Si alguna vez pesa, la salida es pasar el escalón y la dirección a variables
  CSS (~6 KB).
- **Trampa de los tests de la hoja:** un test del bloque 17 busca la línea EXACTA `@media (max-width: 768px) {` como
  comienzo del bloque del celular; otro `@media` con el mismo corte antes lo rompía (1 de 626). Lo que use ese corte va
  en una sola línea.
- **El video de fondo, el LUGAR sin la pantalla**: `AttrsTarjeta.videoFondo` (`src`, `srcMovil`, `poster`,
  `posterMovil`: sin el póster vertical, el horizontal no calza con el primer cuadro del video del teléfono y pesa 3-4
  veces más), sólo URLs del bucket y siempre con póster (`videoFondoValido`). La publicada dibuja el póster como imagen y
  un `<video>` sin `autoplay` que el script carga después del load, muestra con `playing`, pausa fuera de pantalla y con
  la pestaña oculta, no carga con reduced-motion ni Save-Data, y lleva un botón de pausa (WCAG 2.2.2).
  `VIDEO_FONDO.disponible` es `false`: ninguna pantalla ni la API lo ofrecen.

### El 403 «sin la barra / con la barra»: el diagnóstico obvio era el equivocado

**Vive en:** `lib/landing-url.ts` (`claveDeLanding`, `direccionParaBajar`) · `lib/landing-analyst.ts` (`listarAnalizadas`) ·
`app/web-generator/panel-reglas.ts` (`filasDelPanel`) · `app/web-generator/diagnostico/PanelDiagnostico.tsx` ·
`app/api/landing-analyst/analyze/route.ts` · `tests/landing-url-unica.test.ts`

- **Síntoma** (lo vio el coordinador): la misma pantalla pedía la página dos veces, una sin la barra final del dominio
  (403) y otra con ella (200). **El diagnóstico obvio era «hay dos `normalizarUrl`»**, y era cierto que había dos, pero
  las dos sacan la barra. **La causa real: la LLAVE de `landing_analyses`** (sin barra, sin www, sin query) **se usaba
  como DIRECCIÓN.** Una analizada abierta desde la barra del Web Generator bajaba su llave; recién pegada, se bajaba lo
  pegado. Hay sitios que contestan 403 a la forma sin barra.
- **Ahora:** `listarAnalizadas` devuelve también `leer` = `url_final` si su llave es la de la fila
  (`direccionParaBajar`); el renglón de la barra baja eso, el Diagnóstico registra lo pegado, y la ruta del Landing
  Analyst le pasa `leer` a `analizarLanding`. **Regla: la llave busca la fila; para bajar va lo pegado o `url_final`.**
- **Una sola `normalizarUrl`**: la del Pixel (`lib/landing-paginas.ts`, «¿qué página es?»). La de `lib/landing-url.ts`
  se llama `claveDeLanding` («¿qué landing analizada es?») y NO se derivó de la otra: la del Pixel funde los hosts de
  deploy de Netlify, suelta credenciales y exige un punto en el host, y derivarla dejaba huérfanas filas ya guardadas
  (el test compara contra las dos implementaciones de antes congeladas, sobre 48 entradas). El test frena una segunda
  `normalizarUrl` exportada o importada de otro módulo (con `git grep --untracked`: leer los ~5.300 fuentes tardaba
  15-30 s con la máquina cargada; el grep, 1 s).

### El `window.opener` del camino del Pixel: lo que se cerró y lo que NO

**Vive en:** `lib/editor-landing/lector-script.ts` (`JS_LECTOR`) · `lib/landing-token.ts` (el Pixel: `PARAM_LEER`) ·
`tests/editor-landing-lector.test.ts`

- **Hecho (decisión del coordinador, a criterio):** el lector suelta `window.opener` apenas arranca TAMBIÉN en el camino
  del Pixel, como ya hacía la ventana aislada, y sigue contestando por la referencia que guardó. Corta lo que la
  página, un script de terceros o un sitio al que navegue podrían hacerle a la pestaña de MaKo DESPUÉS de ese momento
  (`opener.location = '<phishing>'`, el tabnabbing inverso). **Costo aceptado:** si la landing se redirige sola con
  JavaScript después de cargar el lector, su Pixel ya no ve opener y esa lectura se pierde.
- **El riesgo que QUEDA:** el rato entre que carga la página y que corre esa línea. Ahí la página (o un script de
  terceros que cargue antes que el Pixel) ve `window.opener` y podría navegar la pestaña de MaKo.
- **Por qué no se cerró del todo (coordinador, 15/10: «mucho costo para un hueco chico»; no va a la Ticketera):** esa
  conexión es más que la vuelta de la lectura. (1) El Pixel ya pegado la usa para saber «es MaKo leyendo»: no cuenta la
  visita y carga el lector; sin ella, cada lectura cuenta como una visita real con una página extra `?mako_leer=` en las
  analíticas del cliente, y nunca se lee nada. (2) No hay un camino de vuelta por el server para reusar: la firma y la
  ruta de la ventana sólo autorizan a MOSTRAR la página, y la ventana también contesta por esa conexión.
- **El plan, si algún día aparece un abuso real:** que la pestaña de MaKo abra la landing con `noopener` y el lector
  conteste por el server con la firma de la lectura: una ruta pública nueva (en `lib/rutas-publicas.ts`, sólo POST con
  la firma), una tabla donde dejar la lectura (migración) que la pestaña sondea, y un Pixel nuevo (v25) que reconozca la
  lectura por la firma en vez de por el opener. Le llega sólo a quien usa la línea corta `/m.js`; quien pegó el código
  entero sigue con el de hoy hasta repegarlo. Hoy lo que el lector manda tiene un tope de 58 KB para las piezas.
- **De paso:** `mako_leer` no está en `PARAMS_DE_MEDICION` (`lib/landing-paginas.ts`): si alguna vez se mide una visita
  de lectura, queda una página basura por cada una. No se tocó porque cambia la forma de la llave; va junto con el
  plan de arriba.

### El panel «Animar» (commit `7135a8235`)

**Vive en:** `app/web-generator/editor/paneles/PanelAnimacion.tsx`, `TileAnimacion.tsx` · `app/web-generator/editor/animacion-reglas.ts` ·
`app/web-generator/editor/extensiones/index.ts` (las decoraciones) · `tests/editor-landing-panel-animacion.test.ts`

- **Fuente copiada** (la regla de AGENTS.md): el panel de animaciones del Image Editor (`AnimatePanel.tsx`,
  `AnimateThumb.tsx`, `Animate.module.css`, `useReducedMotion.ts`, los textos `panel.*`) y la ayuda pública de Canva,
  https://www.canva.com/help/animate-designs/ (WebFetch le da 403; se leyó con curl). **No se copió, a propósito:**
  duración, velocidad y suavizado (los tiempos son del catálogo, para que la publicada sea la del panel), la pestaña
  Texto de Canva (los títulos por palabra o letra son estilos de página) y «Create an Animation».
- **⚠️ El lugar obvio para `data-anim` en el editor era el equivocado.** En los atributos DOM de la sección
  (`attrsDeSeccion`) fallaba SIN error: ProseMirror sólo vuelve a dibujar las secciones cuyo nodo cambió, así que
  cambiar el estilo de la página no tocaba ninguna, y agregar una sección arriba dejaba viejo el «alterna» de las de
  abajo. **Regla:** lo que depende de la config o de la POSICIÓN va en decoraciones de nodo; el armazón le pasa la
  config al plugin con `ponerAnimacionDePagina`, fuera del historial y sin disparar el autoguardado.
- **Las tiles son una mini sección real** animada con la MISMA hoja que la publicada (`.gm-reproducir`), achicada a un
  tercio porque el panel mide 360 px: si cambia el ancho del panel, hay que revisar la escala.
- **Los efectos del hijo corren antes que los del padre (React)**: la reproducción después de elegir un estilo espera
  un cuadro, o reproduce el estilo VIEJO.
- **El ▶ «Reproducir la página»** reproduce cada sección una vez al entrar en pantalla, con el mismo umbral que la
  publicada (todas juntas, las de abajo animarían sin que nadie las viera); a diferencia de la publicada, anima también
  lo que ya está en pantalla. Con «reducir movimiento» nada se mueve solo; el ▶ sí.
- «Animar sección» está en el menú ⋮ de la sección: el ▾ de la mini barra abre «Diseños», que no es el menú de la
  sección.
- ⚠️ **El guard del voseo deja pasar «Elegí… animá»**: no genera el imperativo de los verbos en -ir (se escribe igual
  que el pretérito: el agujero permanente que ya está en `docs/hallazgos-copy.md`) y no conoce «animar». La primera
  sospecha («no ve los archivos nuevos») era falsa: los ve con `git add -N`. Sin hacer: sumar «animar» a los
  infinitivos del guard.

### La API de MaKo (commit `7135a8235`)

**Vive en:** `lib/api-mako/areas/landing-editor.def.ts` / `.run.ts` (`cambiar_animacion_landing`) ·
`landing-contenido.helpers.ts` (`planAnimacion`) · `lib/mako-intencion.ts` (tipo `animar`) · `tests/api-mako-landing-animacion.test.ts`

- `cambiar_animacion_landing`: el interruptor, el estilo, y el efecto y la dirección de una sección (por id o número);
  confirmación por chat, admin, reversible, `PATCH /landing/documentos/{id}/animaciones`; escribe por la misma fábrica
  que las demás ediciones (versión de antes y compare-and-set). La dirección al cambiar de efecto sale de
  `cambiosAlElegir`, que vive en el CONTRATO para que el panel y la API usen la misma función. `ver_configuracion_landing`
  cuenta el estilo y los efectos propios. El catálogo va en el `enum` (fijo; los temas tienen lectura aparte porque cada
  negocio suma los suyos).
- **⚠️ Sumar la operación sacó de WhatsApp a `publicar_landing`** («subí los cambios de mi landing»). La frase que
  repiten las 16 ediciones (`VERSION`) decía «subirla» (raíz de publicar) e «internet» (de despublicar). **Regla:** un
  SINÓNIMO del verbo de otra operación también cuenta como su raíz; la frase repetida no los lleva (hay test).
- **⚠️ El diagnóstico obvio era el equivocado:** con el clasificador ya bien, 2 frases seguían sin la herramienta. No era
  el clasificador sino el presupuesto de 12.000 caracteres: la def pesaba 2.490 y empataba con una docena declaradas
  antes. **Regla:** un pedido chico lleva su propio tipo (`animar`), con una relevancia que nombra su herramienta, y la
  def se acorta. «anima» + «les» = «animales»: por eso «anima» no acepta esos pronombres.
- **Sin hacer:** «quita el botón de la web» sale como despublicar (`SACAR_DE_INTERNET` acepta cualquier cosa antes de
  «de la web»; ya pasaba antes); «analiza las animaciones de mi landing» no llega a analizar (queda a 4 palabras y el
  límite es 3). Los dos en `lib/mako-intencion.ts`.

### Replicar las animaciones (commit `ec9226345`)

**Vive en:** `lib/editor-landing/replicar-animaciones.ts` (puro) · `estilo-original.ts`, `lector-script.ts` (las señales) ·
`replicar.ts`, `replicar-reglas.ts` · `app/web-generator/crear/aviso-replica.ts`, `Replicar.tsx`, `editor/EditorLanding.tsx` (el aviso) ·
`lib/api-mako/areas/landing.{def,run}.ts` (`replicar_landing`) · `tests/editor-landing-replicar-animaciones.test.ts`

- De AOS, animate.css y el primer cuadro de lo que dan `getAnimations()`, Framer appear o el estado en línea de Webflow,
  a efectos del catálogo; el estilo de la landing es el que domina más partes; cada sección que no coincide lleva el
  suyo. Sólo en «Landing». Nada se ejecuta de la página ajena (Framer y Webflow se leen como datos).
- **⚠️ El diagnóstico obvio era el equivocado: «fade-left = viene de la izquierda» es al revés.** AOS lo arranca en
  `+100px`: viene de la DERECHA. **Regla:** las direcciones de una librería ajena se leen de su CSS, no de su nombre.
  zoom-out → Pisotón: es el único efecto del catálogo que entra desde más grande.
- **⚠️ El aviso de Replicar no se veía NUNCA.** Si replicar sale bien, la pantalla navega directo al editor; desde la
  tanda 6 «sin diseño», «sin el estilo» e «imágenes no copiadas» sólo los leía MaKo. **Regla:** lo que dice el
  resultado de Replicar viaja al editor de la copia (sessionStorage atado al id de la copia, una vez, nunca por la
  URL). Hecho sólo para «Los efectos que siguen al scroll no se copian.»; mostrar los otros avisos es decisión de
  pantalla, sin tomar.
- Un envoltorio con `data-aos` abre antes de que cierre su título: asignarlo al título anterior lo mandaba a la sección
  de antes; va con el mismo mecanismo pendiente que las imágenes de fondo.
- AOS genera una transición POR PROPIEDAD y el navegador da la matriz: se juntan las de un mismo elemento o todo sale
  «Desvanecer» (por la especificación, sin medir).
- Rebote y Elástico sólo se distinguen por la curva, Deriva es diagonal, y Deslizar arriba/abajo con fundido tiene la
  forma de Caer/Subir: **por el primer cuadro no se reconocen** (escrito en el test).
- Un backtick en un comentario dentro del `String.raw` del lector rompe la compilación con «Expected ";"»: en los
  comentarios de ese bloque, «».
- Lo que suma a la lectura: hasta 60 señales y 6.000 caracteres (normalmente < 1 KB), dentro del tope de 17 s; el envío
  final no tiene un corte de 64 KB (eso es del plan del opener): el tope real es de 58 KB para las piezas.
- **Sin hacer:** los tweens de GSAP y el texto por palabra/letra; el hero de Webflow (ya se animó antes de leer); el JSON
  de Framer no se comparó contra un sitio real; desde «Aplicar» del Diagnóstico la línea del scroll no se muestra (ese
  camino no abre el editor).

### La verificación de la publicada (16/10/2026, sin la base)

**Vive en:** el arnés `verif-anim/` del scratchpad de la sesión f3876a09 (`build.mts` con `node --import tsx` desde el
worktree, `sh correr.sh`, `node resumen.cjs`; las salidas en `out/resumen.txt`) · `lib/editor-landing/pagina-publica.ts`
(`TOPE_TEXTO`) · `tests/editor-landing-animaciones-render.test.ts`

La publicada REAL (`htmlDePagina(…, { modo: 'publico' })` + `armarDocumento`) de «Clásico claro» con tres objetivos,
servida con `ctx.route` y la red cortada, Chromium sin ventana, CPU ×4, a 390×844 y 1280×800:
- **Parpadeo, 0 en 16 corridas** (los 8 estilos × 2 tamaños): el H1 y la primera sección en opacidad 1 desde el primer
  cuadro; lo que entra en la primera pantalla queda quieto.
- **Los 23 efectos con sus direcciones, 23/23 en cada tamaño**: los bloques corren el `gm-e-…` esperado con su cascada
  (150/230/310 ms), la sección `gm-aparecer` (600 ms), y todo termina visible, sin transform, clip-path ni filter.
- Interruptor apagado y «ninguna»: 0 escondidos, 0 animaciones. **Reducir movimiento:** sin `gm-anim`, nada partido.
- **«Palabras» y «Máquina de escribir»:** 12 de 21 títulos partidos con el MISMO `textContent` y `aria-label`; ninguno de
  la primera pantalla; con el tema de degradado («eclipse»), 0 de 20 partidos.
- **El teléfono:** «Enfoque» corre `gm-e-desvanecer` sólo con opacidad. **Compatibilidad:** un HTML sin `data-anim` con la
  hoja y el script nuevos, 23/23 en la entrada de siempre.
- **LCP del H1 (ms, 3 corridas, alternadas y con una visita de calentamiento):** agenda-llamada con 364/472/448 y sin
  552/344/372; lead-magnet 476/396/392 y 392/328/364; webinar 504/516/480 y 420/520/616. **Con y sin cuestan lo mismo.**
- **Video de fondo** (mp4 de 2 s): no se baja antes del load, aparece con `playing`, el teléfono baja la versión 480 y su
  póster, se pausa fuera de pantalla, con reducir movimiento hace 0 pedidos y no hay botón, y el botón se llama «Pausar
  el video de fondo». La pestaña oculta sólo se pudo SIMULAR (en Chromium sin ventana nunca se marca oculta).
- **Arreglado (WCAG 2.2.2):** un título de 140 letras con «Máquina de escribir» tardaba 5,7 s en terminar de escribirse
  (150 + 139 × 35 + 700 ms). Ahora el script le junta los pedazos para que termine en 5 s (`TOPE_TEXTO`), y uno corto no
  cambia. Lo fija un test, probado rompiéndolo (sin el tope y con 6 s: 17 / 1).
- **Trampas del arnés:** Chrome devuelve `style.animation` como `"auto ease 0s 1 normal none running none"`, no `"none"`
  (para saber si algo está quieto se lee `animationName`); `scrollIntoView` marca también a las vecinas, que ya
  terminaron cuando se las mide (se anotan las animaciones en el momento en que entra `gm-visto`, con un
  MutationObserver); la PRIMERA navegación de un Chromium recién lanzado tarda 1,3-1,8 s más (visita de calentamiento y
  alternar con y sin, o «con animaciones» sale más lento por la razón equivocada); un test de efectos necesita relleno
  arriba, porque el hero de las plantillas es corto y 3 secciones entran en la primera pantalla.
- **Sin medir:** que un título con degradado partido se vea vacío mientras anima (sólo se comprobó que no se parte).

### La revisión adversarial de lo invisible (16/10/2026)

**Vive en:** `lib/editor-landing/pagina-publica.ts` (el observador, `partirTitulos`) · `app/web-generator/editor/animacion-reglas.ts`
(`ENTRADA_EN_PANTALLA`) · `lib/landing-token.ts` (el Pixel, `PARAM_LEER`) · `lib/landing-paginas.ts` (`PARAMS_DE_MEDICION`) ·
`lib/landing-analyst.ts` (`analizarLanding`) · `lib/editor-landing/replicar-animaciones.ts` (`scrollEnHtml`, `etiquetas`)

Un agente de sólo lectura repasó las ocho preguntas de lo invisible. Quedaron bien: las publicadas viejas con el script
nuevo, nada escondido en la app, el saneo, la API, Replicar sin ejecutar nada ajeno, `claveDeLanding`, el opener y
«Editar con IA»/«Aplicar» conservando los attrs. Lo que encontró, todo arreglado salvo lo último:
- **(MEDIA, de antes) Una sección más alta que ~16 pantallas quedaba INVISIBLE para siempre.** El observador entraba con
  `threshold: 0.06`, y una sección de más de ~13.000 px (una «Página web» copiada con su HTML entero, un FAQ larguísimo
  en el teléfono) nunca llegaba a mostrar el 6 % de su alto: con `gm-anim`, opacity 0 sin vuelta. Ahora `threshold: 0`
  (entra al cruzar la línea del margen), en la publicada y en el ▶ del editor (el test del panel los ata). Va en el
  SCRIPT: le llega a todas las publicadas sin republicar. Sin medir en Chromium (la regla de RAM): lo sostienen la cuenta
  y el comportamiento del observador por debajo del primer umbral.
- **(MEDIA, de esta tanda) El opener suelto en el camino del Pixel ensuciaba las analíticas.** Si la landing se recargaba
  sola durante una lectura, el documento nuevo ya no veía el opener y su Pixel medía una visita real con `?mako_leer=<id>`
  (una página basura por lectura). Ahora el Pixel (`/m.js`, la versión que se sirve siempre) no mide nunca con un
  `mako_leer` válido, haya o no opener; y `mako_leer` pasó a los parámetros de medición, así que con un Pixel pegado
  antes cae en la misma página. ⚠️ El primer test de esto dio verde SIN el arreglo: el arnés chocaba contra lo que no
  simulaba antes de llegar a medir, y «0 pedidos» salía igual. Se afinó marcando si el script llega a leer la cookie del
  visitante (lo primero que hace al medir): con eso la rotura cae.
- **(BAJA) Los títulos con un enlace o un botón adentro perdían el nombre accesible del enlace** (los pedazos van
  `aria-hidden`; WCAG 4.1.2). Ahora no se parten.
- **(BAJA) El arreglo del 403 no cubría lo leído en el navegador ni el texto pegado**: esas ramas guardaban la llave como
  `url_final`. Ahora guardan lo que pegó la persona si es la misma landing.
- **(BAJA) Buscar efectos de scroll en el HTML era cuadrático** con un «<a » repetido sin cerrar (240 KB → 43 s, medido) y
  trababa el server, que baja hasta 5 MB al replicar. Acotar las regex a 2.000 bajó a 1,4 s pero seguía creciendo; ahora
  `etiquetas` recorre etiqueta por etiqueta en una pasada (5 MB → 6 ms) y un «<» suelto no se traga lo de después.
- **Sin hacer (latente; ANTES de prender el video de fondo):** si la IA o la API ponen una imagen nueva en el hero, el
  `videoFondo` no se borra y su póster tapa la imagen nueva; y «Probar nuevo diseño» pasa a `diseno: 'sin'` un hero que
  sólo tiene video. El arreglo: tratar `videoFondo` como el acento (reemplazar la imagen lo borra; si hay video, cuenta
  como imagen). **Vive en:** `lib/editor-landing/ia-bloques.ts:933`, `lib/editor-landing/ia-reglas.ts:796`.

### Trampas del entorno de esta tanda

- **Mandarle un mensaje a un agente que está DENTRO de un Workflow no le llega: levanta una COPIA desde su transcript.**
  La regla de RAM del coordinador, mandada a los dos paquetes que corrían, creó dos instancias más de cada uno, y las
  dos escribieron los mismos archivos sin enterarse (un test se pisó a los 20:00:37). Se paró el Workflow y siguieron
  las copias. **Regla:** a un agente de un Workflow no se le escribe; si hay que cambiarle las reglas, se para la
  corrida y se retoma con el guion editado.
- **Los fuentes del worktree son CRLF aunque `grep -c $'\r'` del Git Bash diga 0**, y `sed -i` del Git Bash los deja en
  LF (git lo normaliza al commitear: el diff no se infla). Un arnés que busca texto con `\n` no encuentra nada en
  silencio.
- **Con la máquina sin RAM (240 MB libres, 12 chats) el tsc completo no se corre**: se valida con el ACOTADO
  (`"include": []` + `"files"` de lo que cambia y sus consumidores, heap de 2,5 GB), probado metiendo un error a
  propósito. Para este commit: 37 archivos, 40 s, y el error inyectado salió (TS2322).

## Los pedidos sueltos en el chat del agente (16/10/2026)

**Vive en:** `app/web-generator/editor/pedidos-chat.ts` (`pulsar`, `sinTerminar`, `alTerminar`) ·
`app/web-generator/editor/paneles/PanelAgente.tsx` · `tests/editor-landing-pedidos-chat.test.ts`. El módulo compartido y
sus trampas: `docs/diseno-mako-pedidos.md` y `docs/hallazgos-ia.md` → «Los pedidos sueltos en los chats».

- **«Sí» a «¿Terminamos esto y después creamos otra landing?» quiere decir PRIMERO esto.** La primera versión abría
  Crear con IA en el acto: el chat se iba del editor con el cambio de la landing abierta sin aceptar ni descartar (el
  hilo sobrevive a navegar, pero «esto» quedaba a medias). Ahora, con un cambio del agente sin terminar (`pendiente`,
  `aplicando`, `sin-version`), «Sí» deja la burbuja esperando y la creación se abre sola al aceptarlo o descartarlo;
  «Después» sigue prendido por si cambia de idea.
- **«Página» dentro del editor es una página del sitio abierto** («Añadir página»), no otra landing: el núcleo la trata
  como una parte de lo abierto (`PARTES_DE_LO_ABIERTO` en `lib/mako-pedidos.ts`).
- **La landing abierta nunca se borra desde el chat** («elimina esta landing»): se dice dónde está «⋯ › Eliminar». Otra
  landing va a la Papelera con confirmación (la misma acción que «Archivar» del Panel) y se restaura con «Deshacer».

### Mirado con clics en producción (16/10/2026, ws9, la sesión de Martín, con la IA de verdad)

En el chat del agente de tres landings de prueba (23 a 25, todas a la Papelera al terminar; ws9 quedó como estaba):
- «Cambia el título del hero por algo más corto»: editó como siempre, sin burbujas. Interpretar costó 2,3 s.
- «Mejora el título. Y luego y también quiero que me crees otra landing para mi otro producto»: la burbuja «¿Terminamos
  esto y después creamos otra landing?» salió bien. «Después» → «Cuando quieras, la creamos.» con «Crear ahora». «Sí» con
  el cambio sin aceptar → «Al terminar esto, la abro.», y al descartarlo se abrió Crear con IA con el pedido arriba.
- «Borra la otra landing» con dos más: «¿Cuál: «…Webinar…» o «…Taller…»?», la más reciente primero; elegida, «¿Mando «…» a
  la Papelera?», y «Sí» la archivó de verdad.
- «Agéndame una reunión con Juan el viernes»: «Eso se hace en CRM.» con «Ir a CRM» → `/crm?ws=9`, en 1,3 s.

Lo que encontró, además:
- **La IA de los pedidos no corría nunca** (arreglado; el detalle en docs/hallazgos-ia.md): el mensaje mixto esperaba
  5-9 s y salía con las reglas. Ahora 3-5,5 s y con la IA.
- **La edición con IA del editor es lenta**: 44,5 s el primer cambio, 12,6 s otro, y uno se cortó a los 65 s («Tardó
  demasiado. Vuelve a intentar.»). `landing-editor-ia` corre en Gemini `flash-latest`, que desde el 14/10 piensa en
  `low` (no acepta `minimal`); en `anthropic_usage`, hasta 2.256 tokens de salida y un «reparar el JSON» detrás.
  ⚠️ **Probado Groq ahí, y NO se cambió** (pedido de Cerebro, medido el mismo día con `editar()` real sobre el hero de
  la landing 23 de ws9, «Acorta el subtítulo», 3 corridas por opción):

  | Opción | Tiempo | Acierta |
  |---|---|---|
  | Gemini `flash-latest`, como está (`effort: 'high'` → piensa en `medium`) | 19-33 s | 3 de 3 |
  | Gemini pensando en `low` (`effort: 'medium'`) | 16-21 s | 3 de 3 |
  | Groq `gpt-oss-120b` primero | 7,5-11 s | 2 de 3: una cambió «Consigue» por «Alcanza» en el título y dejó el subtítulo; otra cambió el sentido («qué haríamos en tu lugar» → «qué harías») |

  Groq es 2-3 veces más rápido pero falla en lo que la persona revisa, y su plan gratis da ~8.000 tokens por minuto:
  una edición son ~5.000 (3.900 de entrada), así que la segunda en el mismo minuto caería en 429. Pensar menos en Gemini
  gana poco. Los picos de 44-65 s eran «high demand» de Google con reintentos, no el modelo. Lo que mejoraría de verdad:
  mandar menos (el contexto del negocio entra entero en cada edición) o un modelo rápido que acierte; medido así, hoy
  ninguno de los gratis.
- **«Mi otro producto» no se resolvía**: Crear con IA armó el esquema sobre la oferta principal del negocio. Ahora
  (`productoDelPedido` en lib/mako-pedidos.ts, la burbuja `producto` en pedidos-chat.ts): si nombra un producto
  activo del catálogo, va escrito en el pedido («… Es para el producto «X».»); si dice «producto» sin nombrarlo y hay
  varios, «¿Para cuál producto?» con los primeros 4 del catálogo, y elegido sigue la creación de siempre (con la
  propuesta, si había). ⚠️ Con UN solo producto, «mi OTRO producto» no es ése: no pregunta y crea como antes. Es el
  caso de ws9 hoy (un solo activo, «WhatsApp Ads Funnel»): Martín no va a ver la pregunta ahí. Lo que falta: cuando
  el producto no está en el catálogo, preguntarlo en texto libre.
- **«Crear ahora» se veía igual que las sugerencias** de abajo («Mejorar la escritura»…): las dos eran pastillas
  celestes (`secundario` y `gma-ag-pildora`). Arreglado: «Crear ahora» va azul con «+» (también tras «Después»), las
  candidatas de «¿Cuál?» y los links «Abrir…»/«Ir a…» en contorno, y `secundario` dejó de ser una variante de las
  burbujas (`VarianteBoton`): volver a usarla no compila.
- **El aviso «Archivada» con «Deshacer» no se alcanzó a ver** (ya no estaba cuando se miró): sin verificar.

## El Diagnóstico, la vista previa y tres pedidos de MaKo (17/10/2026, «Pendientes B3»)

Los tres vinieron de la revisión con Código Inmobiliario (16/10, Fathom 863534246) y de los «Chicos» de las tandas 7 y 8.

### «MaKo no encontró nada que señalar» (#863): no era la IA ni el scraper
- **Síntoma.** Martín abrió el Diagnóstico de la landing de Código Inmobiliario y leyó «MaKo no encontró nada que
  señalar» (01:34). La tarea del Plan pedía revisar el prompt y el scraper.
- **El diagnóstico obvio era el equivocado.** La fila de `landing_analyses` de esa landing tenía **3 hallazgos con
  cita**. La había escrito el **Landing Analyst** (el análisis automático del Pixel, 06/10), que guarda la fila pero
  no los comentarios (`landing_sugerencias`). El panel, al abrir, LISTA: hay veredicto, hay cero comentarios, y como ya
  hay veredicto no analiza solo. Medido en producción el 17/10: ws 11, 13 y 14, tres hallazgos y cero comentarios cada uno.
- **La regla.** Dos escritores del mismo análisis (la tab Landing Analyst y el Diagnóstico) necesitan un puente al
  LEER: `listar` de una de afuera pasa los hallazgos guardados que no son comentarios (`hallazgosSinComentario`, por la
  misma clave que deduplica al guardar: lo descartado no vuelve). Y un vacío no se pinta como «está bien»: el análisis
  pide de 3 a 8 hallazgos, cero es «no dejó comentarios», no «nada que señalar».
- **Vive en:** `lib/editor-landing/diagnostico.ts` (`hallazgosSinComentario`) · `diagnostico-server.ts`
  (`analisisGuardado`, `sugerenciasDeAfuera`) · `tests/web-generator-diagnostico-vista-previa.test.ts`.

### La vista previa no dejaba pausar el VSL ni scrollear (#861): dos causas, ninguna era el CSS del scroll
- **`inert` sobre todo el lienzo** (VistaNuestra) apagaba también el reproductor. Y el VSL arrancaba **con sonido**:
  el iframe del video lleva `allow="autoplay"` (`ALLOW_EMBED`, lib/embeds.ts) y la persona ya había hecho clic en la
  página, así que Chrome lo deja sonar. Ahora: sin `inert`; links, botones, campos y todo iframe que no sea un video
  con `pointer-events: none`; el clic y el envío frenados en captura (el teclado también «hace clic»); y
  `htmlParaVistaPrevia` le saca el permiso de arrancar con sonido a cada iframe y le pone controles al `<video>` que
  arranca solo. Un `allow` cambiado con el iframe ya cargado no cuenta: se cambia en el TEXTO antes de pintar.
- **«El scroll quedó totalmente trabado» era el RECORRIDO**: su capa de pantalla entera (`.gdg-rec`, `inset: 0`) se
  comía la rueda y los clics, y el recorrido se abre solo después de analizar. La capa va con `pointer-events: none` y
  sólo la tarjeta recibe el mouse; el recorte ya seguía al bloque porque el recorrido re-mide en cada scroll.
- **Sin verificar en un navegador** (la regla de RAM): el arreglo está fijado por fuente y por el HTML que se pinta.
  Lo que hay que mirar con clics: un diseño con VSL en el Diagnóstico, pausar, scrollear con el recorrido abierto.
- **Vive en:** `app/web-generator/diagnostico/VistaNuestra.tsx`, `vista.ts` (`htmlParaVistaPrevia`,
  `SELECTOR_SIN_CLIC`), la hoja de `PanelDiagnostico.tsx`, `RecorridoDiagnostico.tsx`.

### Tres pedidos de landing que MaKo entendía mal
- **«quita el botón de la web» → despublicar.** `SACAR_DE_INTERNET` aceptaba cualquier cosa entre el verbo y «de la
  web». Ahora no acepta una PARTE de la landing en el medio (`PARTE_DE_LANDING`): sacar el botón es editar. «sacá la
  landing de internet» sigue siendo despublicar.
- **«quítale el formulario a la landing» sin la herramienta.** Se clasificaba bien (editar), pero
  `acomodar_bloque_landing` no entraba en los 12.000 caracteres: la raíz «quita» empujaba primero a
  `quitar_dominio_landing` y `quitar_cobro_landing`. **El arreglo obvio era el equivocado:** poner «quitar» en el
  TÍTULO (peso doble) la hacía entrar, y le sacaba `listar_landings_creadas` a «quítale la animación a la sección 2»
  (medido con el test de animaciones). Va en la DESCRIPCIÓN, con las piezas que se borran. Regla: antes de tocar el
  título o la descripción de una operación, correr los tests de turno de TODA el área, no sólo el del pedido.
- **«analiza las animaciones de mi landing» se GUARDABA como captura** («sin señal clara», con `ver_plan` y
  `listar_pendientes`): quedaba a 4 palabras de «landing» y el tope es 3. Analizar UNA PARTE de la landing nombrada es
  analizar; las animaciones van al tipo `animar`, porque lo que las LEE es `ver_configuracion_landing`, que viaja con
  esa relevancia (la de analizar trae el análisis del copy, que no las mira).
- **Sin hacer:** «sacá el video de la web» ya es editar, pero `acomodar_bloque_landing` no entra en el presupuesto
  («sacá» y «video» suman más en `listar_videos_landing` y `despublicar_landing`).
- **Vive en:** `lib/mako-intencion.ts` (`PARTE_DE_LANDING`, `PEDIDO_ANALIZAR_PARTE`, `PEDIDO_ANALIZAR_ANIMACION`) ·
  `lib/api-mako/areas/landing-editor.def.ts` · `tests/mako-intencion-landing.test.ts` (T1-T4).

*17/10/2026, «Pendientes B3» (`claude4`).*

## Pendientes B3, segunda tanda (17/10/2026): la plata, el dominio, la poda y las copias de la API

### El reuso de un cobro de prueba después de pasar a claves reales
- **Síntoma** (revisión de la tanda 4): `cobroReusable` no miraba el `modo`; un pendiente creado con las claves de prueba,
  reusado después del cambio a reales, mandaba al comprador a un checkout de PRUEBA (no cobra y nadie se entera).
- **Dónde estaba el dato:** el modo de la clave de hoy sólo lo sabía `crearCobro` (lib/cobros.ts, de Integraciones). Se
  sacó a UNA función, `modoDeLaPasarela`, y la landing la pregunta sólo si hay pendientes (con Mercado Pago es una
  consulta a su API). Sin saber el modo, no se reusa: crear uno nuevo es lo seguro.
- **Vive en:** `lib/cobros.ts` (`modoDeLaPasarela`) · `lib/editor-landing/pago-pedido.ts` (`cobroReusable`, `DepPago.modo`).

### Reclamar una raíz ajena tapaba el www del dueño real
- **Causa:** desde la tanda 7 el www se sumaba al CONECTAR, y conectar es un reclamo sin probar nada (pendiente, sin TXT).
  El www no es una fila con reserva de 72 h: el bloqueo no vencía. **Ahora el www se suma recién con la raíz VERIFICADA**
  (`debeSumarWww`, en `comprobar`), que además le da su www a las raíces de antes del 15/10 al mirar la pestaña.
- **El www que no apunta pasó a informativo** (decisión del 15/10): fuera de `falta`. ⚠️ Y entonces la tabla de
  registros desaparecía en un verificado (`verTabla` miraba sólo `falta`): se ve también por la fila del www sin listo.
- **Vive en:** `lib/editor-landing/dominios.ts` (`comprobar`), `dominios-reglas.ts` (`debeSumarWww`, `AVISO_WWW`, la fila
  `para: 'www'`), `app/web-generator/editor/dialogos/DialogoPublicar.tsx`.

### Las copias de seguridad de MaKo no se podaban
- `podarVersionesAuto` miraba sólo «Guardado automático»: «Antes de un cambio de MaKo» (cada edición por la API o
  WhatsApp) y «Antes de aplicar el diagnóstico» crecían sin tope. Se podan las tres, por motivo (`MOTIVOS_QUE_SE_PODAN`).
  Los textos viven en tres módulos; el test los compara con los de allá.

### Las reglas copiadas de la API, unificadas
- `rutaLibre`, `hacerInicio`, `motivoRuta`, `duplicarPagina`, «Restablecer estilo» y el tema sugerido vivían en archivos
  'use client' y la API los tenía COPIADOS. Ahora viven en `lib/editor-landing/paginas-reglas.ts` y `reglas-pantalla.ts`;
  los 'use client' re-exportan y la API usa los MISMOS (los tests comparan la identidad de la función, no el resultado).

### Lo que quedó SIN hacer (de la lista B3, Web Generator)
- **Avisarle al negocio un pago rechazado o una pasarela caída** (decidido el 14/10: plantilla del catálogo, un evento de
  MaKo como `pago_recibido`). No se hizo: toca el motor de avisos (`lib/disparadores.ts`, `avisos-catalogo.ts`,
  `variables-aviso.ts`, `plantillas-automatizaciones.ts`) que el chat Automations reescribía ese día. El plan, en
  docs/relevo/landing-generator.md → «Lo que sigue (17/10)».
- «sacá el video de la web» es editar, pero `acomodar_bloque_landing` no entra en el presupuesto del turno.
- «Mi otro producto»: preguntar en texto libre pide decidir cómo vuelve la respuesta al pedido (hoy cada mensaje se
  interpreta suelto en /api/mako/pedidos).

*17/10/2026, «Pendientes B3» (`claude4`).*

## Adjuntar documentos al chat del editor y varios a la caja de crear (20/10/2026)

Pedido de la llamada de Fathom 864249059 (el onboarding de Florencia, 18/10): ella no pudo darle al chat del editor su
documento y el PDF «Lo que vendes» («No me permite»). El hito, literal, en la bitácora del área.

### El esquema corta a 60.000 caracteres sin avisar: varios archivos pegados perdían el último
- **Dónde:** `esquema` en modo «pegar» (`lib/editor-landing/ia.ts`) hace `slice(0, MAX_TEXTO_ENTRADA)` callado. Cada
  archivo que lee la ruta de importar ya puede traer 60.000: dos pegados uno detrás de otro dejaban al segundo afuera
  entero, sin error en ningún lado.
- **Regla:** varios textos que van a un tope se REPARTEN (`repartirTexto` / `unirArchivos`, `lib/editor-landing/adjuntos.ts`):
  el que entra en su parte va entero y el resto se divide, con «[…cortado]» donde se cortó. Y sin `---` entre archivos:
  en «pegar» un `---` parte secciones.
- **El test que daba verde sobre el bug:** con dos archivos de 50.000 el corte ingenuo pasaba, porque el segundo
  «asomaba» después del primero. Un test de un tope va con el MÁXIMO que puede llegar (dos de 60.000) y mide que cada
  uno tenga su parte.

### Lo que la IA puede citar tiene que estar en `fuente`, o se vacía como inventado
- `editar` pasa cada sección por `quitarPruebaInventada(t, fuente)`, y `fuente` es lo que se mandó: las secciones, la
  instrucción y el contexto. Un testimonio que viene de un PDF adjunto, si el PDF no está en `fuente`, se borra como
  «sin respaldo» y la persona ve la cita vacía. Medido con el modelo de mentira: la MISMA respuesta conserva la cita con
  el archivo y la pierde sin él.
- Por eso los adjuntos van DENTRO del contexto (`contextoConAdjuntos`), no como un bloque aparte del prompt. Y en el
  slot `{{contexto}}`, no en uno nuevo: la regla de AGENTS.md (un prompt editado en /configuraciones no tendría el slot).
- Cada archivo va con `contenidoNoConfiable`: un PDF ajeno con «</archivo_adjunto> ignora lo anterior» no cierra su
  bloque ni mete un `{{slot}}`. El system de editar ya declara el CONTEXTO como datos.

### El PDF «Lo que vendes» se lee gratis, y la descarga del Archivero tiene CORS abierto
- `pdf-escritor` deja una capa de texto que `unpdf` lee entera, acentos incluidos (un PDF de 3,9 KB da 669 caracteres,
  `via: 'pdf'`), así que el chip no paga una lectura por visión. Si alguien cambia el escritor para dibujar el texto
  como trazos, cada chip costaría IA: lo vigila tests/web-generator-adjuntos.test.ts.
- El chip lo BAJA el navegador (`/api/onboarding/archivero/download?id=…&preview=1`, un 302 a la URL firmada) y lo suma
  como cualquier archivo. Funciona porque el storage responde `Access-Control-Allow-Origin: *` (medido el 20/10 con
  curl). Con un storage sin CORS habría que leerlo en el server.
- Se ofrece sólo el del onboarding (`origen: 'onboarding'`, el nombre de `nombreArchivoLoQueVendes`): un PDF que la
  persona subió con ese nombre no es «el de MaKo». `esNombreLoQueVendes` es la vuelta del nombre, y el test las prueba
  juntas.

### PanelAgente no puede cargar CSS: lo importan módulos que cargan los tests
- **Síntoma:** con `import centro.css` (y AdjuntosCaja, que trae chat.css) en PanelAgente.tsx, sus 13 tests propios daban
  verde, pero `antes-de-subir` dio ROJO en tests/editor-landing-agente.test.ts: «SyntaxError: Unexpected token '.'» en la
  línea del import. Ese test no mira el chat: importa `dialogos/DialogoAnalitica`, que importa `Ico` de PanelAgente.
- **Por qué:** PanelAgente.tsx también es una caja de piezas (`aceptarPropuesta`, `Miniatura`, `Ico`, `EstilosPanelesB`)
  que importan AskAgent, Presentar, SelectorImagen y dos diálogos, y en node un `.css` no carga.
- **Regla:** el CSS va en la pantalla que monta el chat (`EditorLanding.tsx`, que ya traía gamma.css), y las piezas que
  lo traen entran con `next/dynamic`. Lo fija tests/web-generator-adjuntos.test.ts (ningún `import '….css'` en el panel).

### Lo que quedó SIN hacer
- **No se probó con clics en el ws3**: el ⊕ abriendo hacia arriba en el panel de 336 px, soltar y pegar, el chip, y los
  colores de las piezas en el oscuro del editor. Hay que verlo en `/web-generator/<id>` del ws3.
- **Un archivo de más de ~4,5 MB, sin medir.** La pantalla promete 15 MB (`TOPE_IMPORTAR_BYTES`) y la ruta de importar
  dice que el tope de abajo es el proxy (~18 MB), pero lib/mako-adjuntos.ts dice que Vercel corta todo POST de más de
  ~4,5 MB con un 413 en texto plano. Una de las dos está vieja.
- Si `/api/mako/pedidos` parte el mensaje («usa este PDF y créame otra landing»), los archivos van sólo a la parte de la
  landing abierta: la creación nueva sale sin ellos (`pedirEdicion` en PanelAgente.tsx, `burbujasDe` en pedidos-chat.ts).
- Las píldoras de sugerencias no llevan los archivos de la caja (los dejan ahí para el próximo mensaje).
- El «Documento» del «+» ofrece lo del Ops Center (`ACCEPT_ADJUNTOS_CENTRO`: fotos, PDF, Office y texto); soltar o pegar
  toma además audio, video y OpenDocument (lo que lee el lector). `MasCaja` no recibe un `accept`.
- MaKo Mobile (`/m/landing`) no tiene el chat del editor, así que tampoco el ⊕.

*20/10/2026, jefe Web Generator (`claude4`).*

## Crear webs desde el Ops Center: la receta y los datos de los bloques (20/10/2026, piezas 1.12, 1.13 y 1.15)

Pedido de Martín (20/10): «que Ops Center sea lo principal en MaKo… crear webs». El plan, en docs/ops-center-principal.md.

### «Mi otro producto»: cuatro rondas de reglas, y la red es PREGUNTAR con los nombres
- **El caso:** con un solo producto en el catálogo, «créame una landing para mi otro producto» creaba igual, y el esquema
  salía del perfil del negocio: la landing del producto que ya tiene.
- **Dónde se impone:** en el `preparar` de generar_landing_con_ia (`productoDeLanding`,
  lib/editor-landing/producto-de-landing.ts): si no se sabe para cuál es, no se prepara nada y el error ES la pregunta. La
  receta (RECETA_LANDING) sólo hace que MaKo pregunte antes de proponer.
- **El diagnóstico obvio era el equivocado, cuatro veces.** Cada ronda de reglas cerró lo que la revisión marcaba y abrió
  agujeros nuevos (20 y 21/10, un escéptico por hallazgo):
  - contar palabras «que no son relleno»: «ventas», «porfa» o el voseo «creás» la saltaban;
  - comparar con los nombres y reconocer «otro» como destino: el modelo copiaba la referencia en `producto` («mi otro
    producto») y saltaba el guardia; «un producto nuevo» pegaba el único;
  - negaciones, plurales, «todo el negocio» y el nombre largo: la tercera probó ~200 frases y encontró «una landing que
    venda mi otro producto» (no se veía), «ya tengo la de la Mentoría; créame una para mi otro producto» (elegía la
    Mentoría) y la vuelta «Curso de fotografía» (caía en el «Curso» del catálogo);
  - elegir el producto nombrado si no hay ninguna palabra de una lista de DUDA (otr, nuev, «no», «ya tengo», parecid…):
    la cuarta probó 44 frases naturales de excluir, comparar o vender cruzado y las 44 elegían el nombrado («sin
    mencionar la Mentoría», «como la de la Mentoría pero para mi taller», «que al final lleve a la Mentoría», «not the
    Mentoría»). **Una lista de palabras de duda siempre deja afuera la frase siguiente → preguntar.**
  Leer texto libre con reglas falla en lo obvio: es la regla de AGENTS.md («la red es que la persona CONFIRME»).
- **Lo que quedó: el texto no elige nunca.** Con catálogo, se elige sin preguntar SÓLO si el modelo manda en `producto`
  un nombre del catálogo (sin tildes, mayúsculas ni artículo definido: «un curso» no es el Curso) o «El negocio en
  general», o un producto nuevo con nombre en `producto_nuevo` (aunque diga «curso»). Lo demás PREGUNTA con opciones:
  los productos, «Un producto nuevo» y «El negocio en general». Que «la landing es PARA la Mentoría» lo decide el
  modelo, que lee la conversación, y la persona lo ve en la tarjeta. Preguntar de más cuesta un toque; elegir mal, una
  landing mala.
- **Sin catálogo no es «no hay cuál elegir mal».** El esquema sale de la oferta del brief (`ofertaPrincipal`, tabla
  `ofertas` o el brief), no de `productos`, que puede estar vacío o todo inactivo. Así que un nombre en `producto` con
  el catálogo vacío es un producto nuevo (tirarlo dejaba la landing sobre la oferta del brief), «Un producto nuevo» sin
  nombre pide el nombre, y si el catálogo no se pudo leer valen «El negocio en general» y un `producto_nuevo` con nombre.
  Sin ningún producto, la tarjeta lo dice: «sobre el perfil del negocio (sin un producto elegido)».
- **Con el catálogo ilegible, un `producto` hace VOLVER A INTENTAR, no se tira ni se adivina.** Al confirmar en
  /mako/revisar se vuelve a correr el preparar: si ahí la base fallaba, la tarjeta confirmada decía un producto y la
  landing salía sin él. Distinguir sin catálogo un nombre de una referencia sería otra lista de palabras («Mentoría 1 a
  1» está hecha toda de palabras vagas): el error pide reintentar.
- **La clave del catálogo guarda los símbolos que cambian el nombre.** Borrarlos (`[^a-z0-9]`) hacía de «Curso de C» el
  «Curso de C++» (el primero que coincidía), de «Descuento 50» el «Descuento 50%» y de «?» un «🚀». Sólo se saca la
  puntuación que no cambia el nombre (comillas, puntos, comas, paréntesis, guiones); un nombre que queda vacío no se
  compara. Dos del catálogo con la misma clave («Mentoría» y «Mentoria»): vale el que coincide EXACTO con lo mandado, y si
  todos se llaman igual SIN MIRAR mayúsculas, el primero (abajo sólo llega el nombre, y el G1 ve «Mentoría» y «MENTORÍA»
  como la misma opción: con las dos, la pregunta no se podía dibujar). Se pregunta sólo si no coincide exacto con ninguno: una
  pregunta cuyas opciones vuelven a preguntar (la 6ª revisión) es peor que ninguna.
- **Un `producto_nuevo` que nombra uno del catálogo pregunta sólo si no dice nada más** («no es Kairos», «uno parecido a
  la Mentoría 1 a 1»). Uno que lo nombra Y dice qué es («Mentoría grupal para emprendedoras» con «Mentoría») es nuevo:
  si preguntara, la persona elegiría «Un producto nuevo», volvería lo mismo y no saldría nunca.
- **La red es la tarjeta:** lo decidido REEMPLAZA a lo que mandó el modelo y va adelante en el resumen que se confirma
  («para el producto «X»», «para un producto nuevo, «X»», «para el negocio en general»): pegado al final de la idea, el
  corte de 140 caracteres lo escondía. Y la frase del producto en la idea nunca es lo que se corta: con una idea de 8.000,
  el tope se comía «Es para el producto…» y la tarjeta mostraba lo que el esquema no recibía (se corta la idea antes).
- **El chat del editor no se tocó:** `productoDelPedido` (lib/mako-pedidos.ts) quedó byte a byte como en main. Una
  regla «mejor» compartida le metía regresiones en producción («que venda mi otro producto» pasó a pegar la Mentoría).
  Su test fija lo que devolvía main.
- **Corre en TODO pedido:** uno que no nombra producto también saldría sobre el principal.
- **Una frase prueba una regla sólo si esa regla es la ÚNICA que la decide.** Varias frases de las revisiones daban bien
  sin la regla que decían probar; una rotura que queda en verde pide una frase nueva. Ahora que el guardia no recibe el
  texto, una batería de frases contra la función pasaría sola: las ~190 frases van por el `preparar` de VERDAD (un
  proceso hijo con el catálogo de mentira), así una regla nueva que lea el texto se ve.
- **La receta no nombra herramientas:** no siempre viajan las que nombraría (lo fija su test). Y la línea del producto
  viaja SÓLO con generar_landing_con_ia, la única con dónde ponerlo: con las otras cuatro (en blanco, desde un diseño,
  presentación, replicar) la pregunta se hacía y la respuesta se perdía, porque `validarInput` descarta lo no declarado.
  Pero en un turno de crear viajan las cuatro JUNTAS (`herramientasDelChat`), así que la línea dice a qué camino aplica
  («si la creas con IA desde una idea o un texto; desde un diseño, en blanco o con una plantilla no se usa»). Un test de
  la receta con UNA herramienta no prueba el turno real.
- **Trampa:** armar una regex uniendo templates con «+» la rompe el minificador del build en producción
  (tests/minificador-templates lo frena): en una lista con `join('|')`.

### Un bloque no puede viajar en la respuesta de la herramienta
- La salida de una lectura (`SalidaLectura`) es lo que lee el MODELO, y la tarjeta de una landing necesita su primera
  sección en JSON para la miniatura. Ponerla ahí sería pagarla en cada paso del turno. Por eso
  lib/editor-landing/bloques-chat.ts arma los datos aparte y el marco del Ops Center 3 (1.7) decide por dónde llegan al
  hilo sin pasar por el modelo. Se le preguntó la forma el 20/10.
- Diseños, temas y formatos son catálogo del navegador (crear/tipo.ts, temas.ts): el bloque lleva sus IDS y la pantalla
  dibuja la miniatura, como el Panel. Sólo la tarjeta de una landing creada trae su sección.

### Dos tests que daban verde sobre la rotura
- «Nunca ofrece el tema que ya tiene» pasaba con el filtro roto: con «mako» como tema actual, «mako» no es el primero de
  su grupo y no salía igual. Un test de «nunca X» va con el X que saldría PRIMERO (el primero de cada grupo).
- Es la misma lección que la del corte de 60.000 de arriba: el caso de prueba es el borde, no uno cualquiera.

### Sobre el marco de bloques (ola1, 20/10): la landing es un bloque del área, no un G5
- **El G5 genérico (`creado`) pide una IMAGEN** (una ruta de la app o una pública de Storage) y una landing no tiene: su
  miniatura se dibuja con su primera sección. Por eso `landing`, `elegir` (el G2), `publicada` y `dominio` son bloques del
  área (lib/editor-landing/bloques-web.ts), enganchados en DOS lugares del marco: la unión `Bloque` y el `default:` de
  `sanearBloque`. La sección viaja en el bloque con tope (40.000 caracteres en JSON): más grande, la tarjeta sale sin
  miniatura antes que inflar el mensaje guardado.
- **El saneo recibe `rutaInterna` como parámetro**: chat-bloques.ts importa bloques-web.ts, y al revés sería un ciclo.
- **La única dirección de afuera es la de una landing publicada** (`urlPublicada`): `https:`, sin usuario, contraseña ni
  puerto, con host de dominio. Se muestra y se abre con `noopener`; nunca es una miniatura.
- **El bloque no llega al modelo:** `confirmar_accion` le devuelve sólo «✅ Hecho: resumen». La API HTTP sí devuelve
  `datos` entero (con la sección): un cliente de la API que sea un modelo la lee. Es poco (1-3 KB un hero), pero es del
  marco decidir si `rest.ts` saca `bloque`.
- **`crear` devuelve la landing COMPLETA y `duplicar` el resumen del Panel** (`LandingResumen`, con `primera` y `tema`):
  la tarjeta se arma con `bloqueDeCompleta` en uno y con `bloqueLanding` en el otro. Los tests que leen el fuente daban
  verde con el equivocado; lo vio el tsc.
- **BloqueHilo los carga con `next/dynamic`** (traen la hoja del contenido, ~100 KB): en un test con
  `renderToStaticMarkup` el hilo no los dibuja; se dibuja BloqueWeb directo.
- **Un bloque nuevo hereda el contrato del marco, no sólo su forma.** El G2 (`elegir`) nació en la rama antes del arreglo
  del G1 en main (3099aa97c, 21/10: «Respondiste» sólo si el mensaje salió, las opciones esperan mientras MaKo trabaja,
  y lo contestado vale en CADA render) y el merge no lo trajo: decía «Respondiste» con el mensaje sin mandar, y al
  recargar volvía activo porque `conRespuestas` sólo miraba la `pregunta`. Ahora Elegir hace lo mismo que PreguntaHilo,
  BloqueHilo le pasa `ocupado`, y `conRespuestas` cuenta también el `elegir`.
- **El G2 de diseños y el G1 del producto salen en el MISMO mensaje:** a cuál contesta cada mensaje de la persona lo
  decide el chat de MaKo (`conRespuestas`), y su cosecha está en docs/hallazgos-second-brain.md («Varios selectores en el
  hilo»). Lo que toca a esta área es que el G2 mande textos que digan de cuál vienen («Diseño: saltear»,
  `respuestasDeElegir` en bloques-web.ts, la misma fuente que el botón).
- **Una lectura que dibuja tiene que leer el pedido.** `listar_disenos_landing` dibujaba el G2 sin mirar
  `ctx.mensajeUsuario`: siempre los mismos tres, también en una presentación o con el diseño ya nombrado. Ahora
  `elegirDisenoPara` los ordena por el pedido y no dibuja nada en esos dos casos. «MaKo» es también el nombre de la app:
  cuenta como diseño sólo dicho como tal («el diseño de MaKo»).

- **Una lectura deja su bloque AL LADO de lo que lee el modelo:** devuelve `{ content, bloque }` (`SalidaLectura`).
  `ejecutarOperacion` lo sanea y lo dibuja por `ctx.aDibujar` (ola1, 061c1b74d: el canal de Pagos, uno solo para todas
  las áreas); el modelo recibe sólo `content`, y sin el canal (WhatsApp, HTTP) se descarta. El primer camino, un campo
  `bloque` ADENTRO del JSON de `content` (508cb901f), se sacó: había que parsear la salida para encontrarlo. UN bloque
  por herramienta (hasta 4 por mensaje entre todas): la lista de landings es un solo bloque (`landings`, hasta 4
  tarjetas y «Ver todas»). `listar_disenos_landing` deja el G2 de 3 diseños, y la papelera no lleva tarjetas.

### Lo que quedó SIN hacer
- «Armame una landing» sin diseño muestra los 3 SÓLO si el modelo llama a listar_disenos_landing: que llegue la
  herramienta es del clasificador (1.2). Los temas y el formato de Replicar no se emiten todavía: un «elegir tema» sin
  la landing a la que va confundiría.
- La miniatura de una landing con un tema propio (`ws:<id>`) sale con el tema de base: el hilo no tiene los temas propios.
- No se vio con clics en el ws3 (la computadora y Android): la tarjeta, el G2, el link y «Verificar ahora».
- El chat del EDITOR (/api/mako/pedidos, `productoDelPedido`) sigue con las fallas de producción que marcó la tercera
  revisión: «ya tengo la de la Mentoría 1 a 1; créame una para mi otro producto», «para mi próximo producto» o «mi otro
  producto, Mentoría grupal» eligen el que hay. Pasarlo a `productoDeLanding` pide decidir cómo vuelve la respuesta a
  un pedido (cada mensaje se interpreta suelto); al hacerlo, cambia la tabla de main en tests/ops-center-landing-receta.
- La pregunta del producto va en TEXTO: con el marco ya en main puede ir como un G2 `elegir` con las opciones.
- `producto_nuevo` acepta cualquier cosa con una palabra de contenido: «mi otra marca» pasa como nombre. La red es la
  tarjeta, que lo muestra adelante (lib/editor-landing/producto-de-landing.ts, `esDescripcionVaga`).
- Pregunta de más, a propósito: con catálogo, TODO pedido sin `producto` pregunta, también «landing para la Mentoría 1
  a 1» si el modelo no pasa el nombre. Si en el uso molesta, el arreglo es que el modelo lo pase (la receta lo pide),
  no una regla sobre el texto.
- La API HTTP con escritura directa devuelve el `datos.bloque` de las acciones (la tarjeta, ~1,3 KB con la primera
  sección): lo saca Dashboard en lib/api-mako/rutas-http.ts en su rama; no se tocó acá para no chocar.
- La regla de cuándo dibujar los diseños es de palabras (`elegirDisenoPara`, bloques-chat.ts): «diapos», «ppt»,
  «powerpoint» o «keynote» no cuentan como presentación, «mi curso de presentaciones en público» sí, y «editorial»,
  «fresco», «tecnológico», «cálido» o «audaz» como palabras comunes cuentan como un diseño ya nombrado.
- Tocar «Mentoría» en el G1 llega sin herramientas de landing: el clasificador no reconoce la respuesta a una pregunta
  (lib/mako-intencion.ts, `clasificarIntencion`). Lo vio el escéptico de la 5ª revisión; falta verificarlo.
- `producto_nuevo` «el otro que no es la mentoría individual» (no nombra el del catálogo) pasa como nombre: la red es
  la tarjeta.
- `publicar_landing` devuelve en `datos.url` la dirección de MaKo aunque la landing tenga un dominio propio verificado
  (`urlDeLanding(r.slug)` en landing.run.ts): el bloque de publicada tiene que recibir la del dominio.

*20/10/2026, jefe Web Generator (`claude4`).*

## La charla del agente queda en la base y llega al Ops Center (22/10/2026, TB1)

Hasta el 22/10 el chat del agente vivía en la memoria de la pestaña (el store de módulo de PanelAgente.tsx; la cabecera
decía «no hay tabla para eso»): recargar la perdía y nunca llegaba al Ops Center. La tabla existía: `chart_sessions` con
la clave `landing:<id>`, por `/api/hilo-de-tab` (lib/hilo-de-tab-reglas.ts). Cada turno se guarda al terminar
(`terminar`, en `pedirEdicion`), y una landing que la pestaña todavía no trajo trae su charla (`traerHilo`).

- **Se guarda lo que se dijo, no la propuesta**: «Original | Modificado» trae secciones enteras de ESA página. Después de
  recargar, lo aceptado ya está en el documento y una propuesta pendiente se vuelve a pedir (como antes).
- **Los archivos del pedido van en un renglón «Adjuntos: …»** y vuelven como chips (../hilo-agente.ts).
- **Trampa de la ruta, para el que sume otra tab:** escribe lo que manda el navegador. Sin la lista de prefijos
  (`PREFIJOS_HILO_DE_TAB`) cualquiera escribía en `mako-movil:<persona>`, el chat del Ops Center de OTRA persona. Y dos
  guardados a la vez sobre una entidad sin charla crean DOS sesiones (los dos ven «no hay»): el cliente los encola por
  clave (lib/hilo-de-tab-cliente.ts).
- **Medido en producción el 22/10, en el ws3** (landing 31): el turno quedó guardado aunque el ws3 no tiene IA para editar
  (el aviso vuelve en rojo, por la marca «⚠️ »), recargar trajo la charla y el Ops Center la abre con sus dos mensajes.
- **Sin hacer:** en el Ops Center la fila sale suelta, sin el grupo «Web Generator»: el prefijo `landing:` no tiene
  etiqueta de origen (la de `dashboard:` sí; es de OC4, del chat Ops Center). El diagnóstico (`landing-diagnostico:*`) ya
  guardaba por /api/chart-insights. La caja y el hilo únicos, TB3.

**Vive en:** app/web-generator/editor/hilo-agente.ts, paneles/PanelAgente.tsx · app/api/hilo-de-tab/route.ts ·
tests/hilo-de-tab.test.ts · *22/10/2026, chat «Chats de las tabs».*

## El agente con las piezas del Ops Center, por un archivo aparte (22/10/2026, TB3)

El hilo del agente es `HiloMako` (criatura «Web Generator») y la caja `CajaChat`, que ya trae el «+», las miniaturas,
pegar, los emojis y el micrófono: el panel le pasa sus archivos (`adjuntos={adj}`) y soltar sigue siendo de la pantalla.
La propuesta con «Original | Modificado», las burbujas de pedidos y los errores entran por el hueco `enMensaje`; la sección
del pedido va como «desde …» y sus archivos como fichas del hilo (sin abrir: viajó su texto, no se guardaron).

- **Las piezas viven en paneles/ChatAgente.tsx y el panel las carga con `next/dynamic`.** PanelAgente.tsx lo importa
  DialogoAnalitica, que carga tests/editor-landing-agente.test.ts, y `CajaChat`/`HiloMako` traen CSS: importadas directo, ese
  test ni carga (probado). La guarda del chat único registra ChatAgente.tsx como «caja única»; PanelAgente salió de la lista.
- Las piezas usan los tokens de la app: `.gma-ag` ya redefinía `--surface`, `--ink`…, y ahora también `--primary` (el
  botón de mandar, con el azul del editor).
- **Con el super admin mirando un cliente, la caja del agente quedaba abajo de la vista**: la barra de la agencia estira todo
  `<aside>` (docs/hallazgos-ui.md). El que se pasaba era la columna `aside.gma-izq` (761 px en un cuerpo de 713), no el
  panel: las tres columnas del editor son `<section>` desde el 22/10.

**Vive en:** app/web-generator/editor/paneles/ChatAgente.tsx, PanelAgente.tsx · tests/web-generator-agente-piezas.test.ts,
tests/web-generator-adjuntos.test.ts · *22/10/2026, chat «Chats de las tabs».*

## La landing de hola-mako.com en Web Generator: el bloque «Diseño editable» (23/10/2026)

Pedido de Martín: «Que tenga la landing principal de MaKo en el editable de web generator y que le pueda hacer
cambios de allí y se apliquen. Revisa que no se dañe la landing». Contrato: lib/editor-landing/html-editable.ts.

- **Un diseño a medida NO entra en los bloques de Gamma sin perder la forma.** La landing es HTML de Claude
  Design con estilos en línea, su hoja y comportamientos (carruseles, red de MaKo, Calendly). La salida: el bloque
  `htmlEditable`, el HTML de UNA sección tal cual (sin JS: lo saca sanitize-html en el server), editable a la vista
  en un iframe `sandbox="allow-same-origin"` SIN `allow-scripts` (el editor toca su DOM; el HTML no corre nada).
- **La página «libre»: el diseño nunca adentro de `.gm-doc`.** CSS_CONTENIDO tiene reglas de elemento colgadas de
  `.gm-doc` (`h1..h4` con `text-wrap`, `-webkit-text-fill-color`, `a` subrayado, `li + li`…) que pisan cualquier
  diseño. Una página con diseño editable se publica en `.gm-libre`: las secciones de diseño a sangre y las de
  Gamma en TRAMOS con su propia raíz. Y cada sección de diseño en un envoltorio `display: contents`: con una caja
  por sección, el header `position: sticky` queda pegado sólo al alto de su sección.
- **La landing heredaba el preflight de Tailwind sin saberlo.** En la app, los `h1`/`p` sin margen, las imágenes
  en bloque y el `line-height: 1.5` venían de Tailwind (`@layer base`). En hola-mako.site y en el editor no hay
  Tailwind: la base va como `CSS_BASE_LIBRE`, colgada de `.gm-libre` y EN UNA CAPA (una regla con capa pierde contra
  cualquier regla sin capa, igual que en la app). Sin la capa, la base le ganaba a reglas del diseño de menor
  especificidad.
- **Un `@import` después de cualquier regla se ignora SIN avisar.** La Geist no cargaba en la publicada (todos los
  textos 3-10% más angostos, medido con el DOM: 25 diferencias en los primeros 75 elementos). Dos causas juntas: la
  base iba antes del `@import` de la hoja, y la regex del import cortaba en el primer `;` — y la URL de Google
  Fonts LLEVA `;` (`wght@400;500;600`). `hojaDeDiseno` sube los imports; el test lo fija.
- **Cómo se midió «igual»: Chrome sin ventana por CDP, DOM contra DOM.** Cada elemento de la raíz con su caja y
  18 estilos calculados, comparados por índice contra producción (scratchpad `captura.mjs` + `diff-dom.cjs`). Una
  captura sola no alcanza: el ancho de un texto cambia con la fuente y a ojo no se ve. Resultado: mismo alto
  (10.156 px escritorio, 16.254 teléfono) y 759/763 y 760/763 elementos idénticos; los que difieren son un
  carrusel y puntos animados en movimiento.
- **El contenido que se armaba en el navegador quedó escrito una vez.** Landing.tsx mutaba la landing en un
  efecto (cards inyectadas, hooks, el realce de #beta, «Entrar»): si eso seguía en runtime, el editor mostraba otra
  cosa que la portada y pisaba lo que Martín escribiera. Pasó a `app/vsl/landing-contenido.ts` y la importación
  (scripts/landing-mako-a-web-generator.mts) lo aplica en Chrome sin ventana: jsdom está ROTO en node_modules (le
  falta un módulo de `cssstyle`), y tsx le mete `__name` a las funciones que se pasan como texto a la página.
- **La portada tiene que seguir saliendo sin la base.** app/page.tsx lee la foto publicada con caché (`landing-mako`
  vence con «Publicar») y, si no hay documento o la base no contesta, sirve la landing de siempre. La portada pasó
  a `app/vsl/Portada.tsx` porque app/page.tsx ahora importa server-only y el test de la razón social la renderiza.
- **El orden de subida importa.** El editor VIEJO tira un nodo que no conoce y el autoguardado lo borra: los
  documentos se suben DESPUÉS del deploy del bloque, nunca antes.

- **REGLA: el CSS del diseño nunca lleva `<`.** La revisión de Integración (23/10) lo encontró: `cssDisenoLimpio` sacaba
  `</?style` en UNA pasada y se evadía anidando (`<</style/style>` deja un `</style>`; lo que sigue es HTML y un `<script>`
  corría en hola-mako.com, donde la portada pinta la hoja tal cual). Ahora se saca TODO `<` (una hoja no lo necesita; el `>`
  del selector hijo se queda) y la portada re-escapa `</style` como pagina-publica.ts. Un filtro que borra una palabra
  peligrosa en una pasada se evade armándola con sus pedazos: se borra el CARÁCTER que la abre.
- **El widget de Calendly escribe una UTM en `undefined` como el TEXTO «undefined»** (medido en producción el 23/10, ya
  con la landing subida: `utm_medium=undefined` en la URL de la agenda, que llega a las UTM del lead). El objeto `utm` se arma
  sólo con las que vienen. Lo vio la verificación en producción, no los tests: la URL del iframe se mira.
- **Y la revisión mía (063f3932f): el iframe del editor es del MISMO origen que la app** (para poder editar su DOM): un
  `<img src="/api/…">` o un url() relativo salía con la cookie de quien abre. Medios sólo https absolutos y nunca /api/.

Lo que quedó SIN hacer:
- ~~«Editar con IA» no reescribe el texto de un diseño editable: lo conserva entero (`conservar` en ia-bloques.ts).~~ **Hecho el 24/10/2026** (abajo, «Las páginas de MaKo editables por sección»): viajan sus textos (`{"t":"diseno"}`).
- La miniatura de una sección de diseño es un iframe de 640 px de alto (no se sabe su alto antes de dibujarla).
- «Replicar → Página web» sigue armando HTML personalizado (aislado, sin texto editable); podría usar este bloque.
- El tsc acotado de esta tanda lo cortó el vigía de RAM: los tipos los vio Integración.

## El Diagnóstico el 23/10/2026: el 403 ya no estaba; lo que quedaba era el MARCO

Chat «Landings de MaKo en Web Generator», cuenta claude1. Dos mensajes de Cerebro y Estrategia llegaron el 23/10 con el
estado del 15/10 («el panel de animaciones no está», «dos `normalizarUrl` y un 403»). **El diagnóstico obvio era creerles:
medido en producción (deploy `mako-jnb7ohn00` = `594ecd41b`), las dos cosas estaban cerradas desde el 16/10** (tanda 8,
arriba). Un mensaje entre chats con un estado tiene la fecha de quien lo escribió, no la de cuando llega: se mide antes
de construir.

**Vive en:** `lib/landing-marco.ts` (`dejaEmbeberse`) · `lib/landing-fetch.ts` (`paginaParaVer`) ·
`app/api/landing-generator/diagnostico/pagina/route.ts` · `lib/editor-landing/diagnostico.ts` (`data-marco`, `marco` en
«listo» y «pinto») · `app/web-generator/diagnostico/VistaAfuera.tsx` · `tests/landing-marco.test.ts`,
`tests/editor-landing-diagnostico.test.ts`

- **Lo medido, con la landing del caso (multiplicatusresultados.com, armada con JavaScript) en el Chrome de Martín:** un
  solo pedido a la vista, con la barra final, 200; el recuadro cae a la página real con «Esta página se dibuja con
  JavaScript: se muestra la página real». En local, el mismo documento aislado manda «listo» a los ~110 ms y 9 caracteres
  de texto; una estática (gnu.org) manda 6.439 y se queda en la vista aislada.
- **El agujero que quedaba:** la caída a la página real se hacía SIEMPRE, y una página que no se deja embeber
  (`X-Frame-Options` o `frame-ancestors`) se ve en blanco, con el aviso afirmando «se muestra la página real». Es una
  pantalla que le dice al cliente algo falso sobre su propia página. Medido sobre páginas reales con la misma bajada que
  la ruta: GitHub (`frame-ancestors 'none'`), Webflow (`frame-ancestors 'self' …`), Framer (`DENY`) y las publicadas de
  hola-mako.site (`DENY` + `frame-ancestors 'none'`) no se dejan; la del caso, sí.
- **El navegador no lo puede contar** (un iframe bloqueado dispara `load` igual) **y el server sí**: baja la página, así
  que tiene las cabeceras. `pedirPagina` las guarda (las del ÚLTIMO salto), `dejaEmbeberse` decide con las reglas del
  navegador (frame-ancestors manda sobre X-Frame-Options; cada política cuenta; `'self'` es la landing, nunca MaKo;
  `*.dominio` no incluye al pelado; ALLOW-FROM no bloquea), y el veredicto viaja en `data-marco` del script del
  documento, que lo lee al arrancar y lo manda con el texto. Con `false`, la vista no intenta la real: dice «Esta página se
  dibuja con JavaScript y no deja mostrarse aquí» con «Abrir la página». Lo que NO se afirma: que esté vacía.
- **Trampa de los tests:** el atributo se busca como `<script data-marco=`, nunca como `data-marco` suelto: el script
  mismo contiene `getAttribute('data-marco')`, y un `doesNotMatch(/data-marco/)` falla siempre.
- **Probado rompiéndolo** (base 40/0 en los dos archivos; 18/0 en `tests/editor-landing-crear-panel.test.ts`): la vista
  que cae a la real igual → 1 rojo; el «listo» sin el marco → 2; el script que lee mal el atributo → 1 (lo ve el test que
  EJECUTA el script en un contexto de vm); el documento sin `data-marco="no"` → 2; frame-ancestors ignorado → 3;
  SAMEORIGIN que deja pasar → 1; la ruta que no decide → 1; `paginaParaVer` sin bajar tal cual → 1.
- **Sin verificar en un navegador real con una página JS que no se deja embeber**: el componente se probó por su fuente y
  el script ejecutándolo. Cuando esté desplegado, se mira con una landing así en el Diagnóstico.

## Animaciones, etapa 4: relevamiento en papel (23/10/2026, sin código)

Chat «Landings de MaKo en Web Generator», cuenta claude1. Hecho a mano y sin agentes (la guardia de RAM no dejó lanzar el
workflow: 3 corriendo en la máquina) y sin navegador (once chats, 0,5-2,7 GB libres). Lo que falta para construir está
dicho en cada punto.

**Vive en:** `lib/editor-landing/animaciones.ts` · `lib/editor-landing/doc.ts` (`OPTIMIZADOS`) · `especificacion.ts`
(`attrsOptimizado`) · `app/web-generator/editor/nodos/OptimizadoVista.tsx` · `lib/editor-landing/ia-bloques.ts`,
`ia-reglas.ts` · `lib/editor-landing/html-editable.ts` (`SCRIPT_DISENO`) · `lib/editor-landing/pagina-publica.ts`
(`SCRIPT_PAGINA`, la pausa del video)

- **La mitad de las piezas YA tiene dónde vivir: los «Diseños optimizados»** (`NODO.optimizado`, la copia de los smart
  layouts de Gamma, con su `variante`). La cinta es una forma de `logos` y de `citas`/`citas-caras`; el contador, de las
  de «Estadísticas» (`numeros-grandes`, `metrica-destacada`, `estadisticas-*`: el número ya vive en `valor`, un attr del
  ítem); los pasos que avanzan solos, de «Etapas» (`etapas-*`); el carrusel, de `galeria` y `citas-caras`. **El
  diagnóstico obvio (un bloque nuevo por pieza) era el caro**: cada bloque nuevo son ~15 lugares (nodo, NodeView,
  catálogo, insertar, especificación, render, CSS, IA, replicar, exportadores, API, móvil, tests); una variante nueva es
  una fila de `OPTIMIZADOS` + su CSS + su descripción para la IA (`CUANDO_OPTIMIZADO`, ia-bloques.ts).
- **Y como VARIANTE sobrevive a «Editar con IA»**, que es la razón por la que el panel «Animar» nunca anima por bloque:
  la IA elige la variante del catálogo (ia-bloques.ts:1360) y la conserva; un attr suelto de «movimiento» en el bloque
  se perdería al rehacerlo. Lo que es de la SECCIÓN (los efectos de scroll) va como attr de la sección, como el efecto de
  entrada: eso sí sobrevive.
- **Trampa de deploy de una variante nueva:** el selector la muestra apenas existe (`OptimizadoVista.tsx` dibuja
  `OPTIMIZADOS` «sin filtro», y un test lo fija), y los saneos (`attrsOptimizado`, ia-reglas.ts:544, ia-bloques.ts:1253)
  convierten un valor que no conocen en `vinetas-grandes`. Una pestaña del editor vieja abierta durante el deploy le
  reescribe la variante nueva a viñetas en el próximo autoguardado. «El attr antes que su UI» acá quiere decir: un
  deploy con el valor aceptado por los saneos y ESCONDIDO del selector y de la IA, y recién el siguiente lo ofrece (hace
  falta una lista de ocultas y ajustar el test del selector).
- **Las piezas, con su forma propuesta:**
  - **Cinta** (variantes `logos-cinta` y `citas-cinta`): desplazamiento continuo en CSS (`transform` en bucle, la fila
    duplicada para que no corte), velocidad en px/s, dirección izquierda/derecha, separación, bordes que se desvanecen
    (una máscara, como enseña Framer), **pausa al pasar el mouse y con el foco**, y con «reducir movimiento» queda quieta
    como la grilla de siempre. Más de 5 s en movimiento: lleva su botón de pausa (WCAG 2.2.2), el mismo mecanismo que el
    video de fondo (`gm-video-pausa`, pagina-publica.ts:439).
  - **Carrusel** (variantes `galeria-carrusel` y `citas-carrusel`): `scroll-snap` nativo (se desliza con el dedo sin
    JavaScript), flechas y puntos con el script, avance solo APAGADO por defecto; si se prende, con pausa visible y pausa
    al pasar el mouse o con el foco, y nada de avance con «reducir movimiento».
  - **Contador** (comportamiento de las variantes de «Estadísticas», sin control nuevo): con «Animaciones» prendido, el
    número de `valor` sube desde 0 al entrar. El HTML trae el número FINAL (sin JavaScript, para un buscador y con
    «reducir movimiento», se ve el final); el script anima sólo la parte numérica, deja el prefijo y el sufijo («US$»,
    «+», «%», «k») y termina exactamente en el texto escrito. Un `valor` sin número (el `[00]%` de una plantilla) no se
    anima.
  - **Pasos que avanzan solos** (opción de «Etapas», o una variante `etapas-automaticas`): uno resaltado a la vez cada
    ~2,2 s (el de la página del video de Motion Sites), con pausa; quieto con «reducir movimiento».
  - **Efectos de scroll** (un grupo nuevo «Al desplazarse» del panel «Animar», attr de la SECCIÓN, combinable con la
    entrada): paralaje del fondo, «se desvanece al salir» (el hero) y «crece al entrar» (0,88 a 1). CSS puro con
    `animation-timeline: view()` adentro de `@supports`: Chrome y Safari/iOS 26 los muestran; Firefox estable deja la
    página quieta y completa. **Apagados en el teléfono y con «reducir movimiento»** (la regla de MaKo Mobile y WCAG
    2.3.3). Sin tocar el script: no rompe las hojas congeladas.
  - **Máquina de escribir**: ya existe como ESTILO de página («Máquina de escribir», los títulos de a letra). Lo que no
    existe es el texto ROTATIVO (escribe, borra y escribe otra palabra): sería una marca de texto adentro de un título, y
    una marca se pierde con «Editar con IA». Queda para después de las demás.
- **La referencia, y lo que falta para copiarla:** la app que resolvió estas piezas para constructores de webs es
  **Framer** (Gamma, la fuente del editor, no las tiene; en Canva no se encontraron). Lo que dice su documentación
  oficial (no la app, que pide cuenta): el efecto **Appear** vive en Propiedades → Effects, con Trigger (On Appear, On
  Scroll, Layer in View —top/center/bottom—, Section in View, Replay), Preset (Fade, Scale, Flip, Slide In), Enter
  (Opacity, Scale, Rotation, Skew, Offset) y Transition (Spring por defecto, o Easing con curva, tiempo y demora), sin
  stagger propio (https://www.framer.com/academy/lessons/framer-animations-appear-effect); **Scroll Speed** es el
  paralaje (100 % = normal, menos para el fondo, más para el frente:
  https://www.framer.com/academy/lessons/framer-animations-scroll-speed-parallax); y los bordes de una **Ticker** se
  desvanecen con una máscara de degradé en un marco que recorta
  (https://www.framer.com/academy/lessons/fading-the-edges-of-a-ticker). Los controles exactos del componente Ticker
  (Speed, Hover —0 % pausa—, Direction, Gap) y del Slideshow sólo están en guías de TERCEROS: **antes de construir la
  cinta y el carrusel hay que abrir el editor de Framer** (cuenta gratis, en el Chrome de Martín) y copiar su panel,
  como manda AGENTS.md. Si no se puede abrir, se avisa y se frena.
- **La demanda del 25/10 ya está cubierta por otro lado:** la landing de MaKo y las de cada funnel (documentos del ws9 con
  el bloque «Diseño editable») se mueven con `SCRIPT_DISENO` (html-editable.ts:211): reveal al bajar, tres carruseles con
  avance solo cada 5-6 s, video en bucle y la red en canvas, en hola-mako.com Y en hola-mako.site. No hace falta ninguna
  pieza de la etapa 4 para el lanzamiento.
- ⚠️ **Lo que SÍ quedó mal en esa landing, y es de la etapa 4: sus carruseles avanzan solos para siempre, sin pausa y sin
  mirar «reducir movimiento»** (`SCRIPT_DISENO`, el `setInterval` de `arrancar`; el reveal tampoco lo mira, sólo la red
  en canvas). Es WCAG 2.2.2 (más de 5 s, en paralelo con el resto, sin forma de pararlo). Arreglarlo es chico (pausa al
  pasar el mouse y con el foco, un botón de pausa, nada de avance con «reducir movimiento») y toca el script de las
  páginas con las que se vende: **después del 25/10**, por la misma vara que el cierre del opener.
- **Sin medir:** el peso que suma cada pieza a la hoja (hoy 173 KB sin comprimir; si pesa, las velocidades y direcciones
  van como variables CSS); la cinta y el carrusel en un iPhone y en un Android de gama baja; y los controles reales de
  Framer.
- **El orden para construir (después del 25/10):** (1) los efectos de scroll (CSS puro, attr de sección: el saneo y el
  render en un deploy; el grupo del panel y `cambiar_animacion_landing` en el siguiente); (2) el contador (sin control
  nuevo: el script y su test); (3) la cinta y el carrusel con el panel de Framer abierto (variantes ocultas en un deploy,
  ofrecidas en el siguiente, con su descripción para la IA y su fila en Replicar: marquee, Swiper, Splide, Slick); (4) los
  pasos; (5) el texto rotativo. Y el arreglo de la pausa de `SCRIPT_DISENO`, reusando el de la cinta.

## Publicar una landing de MaKo, y los carruseles que no se paraban (23/10/2026)

Chat «Landings de MaKo en Web Generator», cuenta claude2. Dos cosas se vieron al sacar `avatares-ia`, la única de las
ocho que nunca había estado arriba, y las dos son trampas del camino, no del contenido.

**Publicar una de las ocho con el script: SIEMPRE con `--solo <slug>`.** `scripts/landings-mako-funnels.mts` llama a
`subir(doc, undefined, slug, false)`: sin id de documento, `subir` hace un `insert` y no un `update`. Correr
`--subir --incluir-pausadas` a secas vuelve a insertar **las ocho** como documentos nuevos (ids nuevos, el mismo slug) y
la portada y las siete que estaban arriba quedan con un duplicado al lado. Antes de escribir, mirar qué documentos
`Landing MaKo · …` hay en el ws9 (hoy: #33–#39 las siete, #40 `avatares-ia`) y subir sólo la que falta:
`node --conditions=react-server --import tsx scripts/landings-mako-funnels.mts --subir --incluir-pausadas --solo avatares-ia`.
Para REEMPLAZAR el texto de una ya publicada el script no sirve tal cual: hace falta pasarle su id.

**El 404 de `/vsl/<slug>` se queda 5 minutos después de publicar.** `app/vsl/[slug]/page.tsx` es `revalidate = 300` y
`landingMako(slug)` va por `unstable_cache` (300 s, tag `TAG_LANDING_MAKO`, clave por slug) y **también cachea el «no
existe»**. Si alguien pidió `/vsl/avatares-ia` mientras estaba pausada, la dirección de hola-mako.com sigue en 404 hasta
5 minutos después de subir el documento aunque hola-mako.site/<slug> ya dé 200 (ese lado lee la foto publicada sin esa
caché). Medido el 23/10: 200 en `.site` a los segundos, 200 en `/vsl/` a los ~4 min. No es un fallo: se espera, y se
verifica **las dos direcciones**, no una. El script escribe directo en la base, así que no revalida el tag; publicar
desde el editor sí.

**Los carruseles de `SCRIPT_DISENO` avanzaban solos para siempre.** Medido en la landing real con Chrome sin ventana
(`/api/track/*` cortado): cada 5-6 s, con el mouse encima, sin botón y con «reducir movimiento» prendido. WCAG 2.2.2
(más de 5 s, sin forma de pararlo) en las páginas con las que se vende MaKo. El diagnóstico «es de la etapa 4 de
animaciones, queda para después» era el equivocado: no hacía falta ninguna pieza nueva, sólo cuatro reglas dentro del
mismo script (html-editable.ts): con «reducir movimiento» no arranca el reloj ni se desliza el reveal; mouse o foco
encima de CUALQUIER parte del carrusel (su contenedor con las flechas, y el marco del carril si es otro) lo frena; un
botón de pausa (`data-act="pausa"`, `aria-pressed`) que el propio script arma arriba a la derecha, sólo si hay más de
una foto y no hay «reducir movimiento»; las flechas y los puntos siguen andando siempre. El script lo comparten
hola-mako.com (`app/vsl/Landing.tsx`) y hola-mako.site (`pagina-publica.ts`), y el hash de la CSP sale de la misma
constante: un deploy lo cambia en los dos lados.

**Cómo se midió un script de página sin levantar la app** (para la próxima): bajar la página publicada, reemplazar el
texto del script por el nuevo y **cambiar el hash en el `<meta>` de la CSP** (si no, Chrome bloquea el script nuevo y la
prueba da «no avanza» por una razón que no es la tuya), servirla con `route` de Playwright y medir contando los cambios
del `transform` del carril (comparar posiciones engaña: con 2-3 fotos vuelve al mismo lugar). Dos trampas del arnés: la
página tiene `scroll-behavior: smooth`, así que `scrollIntoView` hay que pasarlo con `behavior: 'instant'` o el mouse
cae fuera de lugar; y el carril se desplaza dentro de su marco, así que el centro del CARRIL puede estar fuera de
pantalla: el mouse va al centro del MARCO. Probado rompiéndolo: el script viejo falla las tres (hover, botón,
«reducir movimiento») y el nuevo las pasa; el test de `tests/editor-landing-html-editable.test.ts` falla con el script
viejo, sin el corte del reloj y sin mirar `parado()`.

**La primera versión «pasaba» y en un teléfono dejaba el carrusel parado para siempre.** Frenaba con `mouseenter` y
`focusin`. En el arnés de escritorio todo andaba porque yo le quitaba el foco al botón con `blur()` a mano; con un toque
real (Chrome emulando móvil, `hasTouch`) el toque deja puesto el «mouse encima» emulado y el foco del botón, y nada los
saca hasta tocar otra cosa: el carrusel no volvía a avanzar tras reanudarlo. Lo mismo con un clic en una flecha o un
punto en escritorio. La regla que quedó: frena **sólo un mouse de verdad** (`pointerenter` con `pointerType ===
"mouse"`) y **sólo el foco de teclado** (`:focus-visible`); un toque o un clic nunca dejan parado. **Un arnés que
arregla a mano lo que el usuario no puede arreglar mide otra cosa:** no limpiar el estado entre pasos de la prueba.
Medido en móvil (390 px, toque): el botón (32 px, dentro de la pantalla) frena y reanuda.

**Lo que NO se midió:** el botón con lector de pantalla, y el reveal sin movimiento en un iPhone real (sólo Chrome
emulado). Y sigue pendiente (después del 25/10) todo lo que
no es esto de la etapa 4: efectos de scroll, contador, cinta y carrusel como variantes, pasos y texto rotativo, con el
panel de Framer abierto antes de copiar sus controles (relevo de Web Generator, «Animaciones, etapa 4»).

## El mapa de versiones del Pixel no prueba que una landing nueva mida (23/10/2026)

**Vive en:** `lib/pixel-aviso.ts` (`anotarVersionDePagina`, `VERSIONES_POR_PAGINA_KEY`) · `app/api/track/vsl/route.ts`

- **Síntoma:** de las ocho landings del lanzamiento, el mapa `landing.snippet_versiones` del ws9 sólo nombraba la
  portada, `/vsl/coaches` y la principal en hola-mako.site. **El diagnóstico obvio («las otras no miden») era el
  equivocado:** el mapa lo escribe el beacon con cada pageview y sólo cuando la página es nueva o cambió de versión, así
  que una landing recién publicada y sin tráfico (los anuncios todavía no corren) no aparece hasta su primera visita real.
- **Lo que sí prueba que mide:** abrir la página en Chrome sin ventana CORTANDO `/api/track/*` (no deja visitas) y mirar
  que cargue `/m.js?id=<token del negocio>` y que intente el beacon. Así se midieron avatares-ia y las otras.
- **Regla:** una ausencia en el mapa de versiones no es «no mide»; para afirmar que una landing mide, se mira lo que
  carga y manda la página, nunca el mapa.

## Las ocho landings por funnel sin el video de la principal en el hero (24/10/2026)

Chat «Landings de MaKo en Web Generator», cuenta claude1. Lo encontró Cerebro midiendo antes del lanzamiento del 25/10:
las ocho embebían en el hero el MISMO VSL de la principal (Panda `25c0684d…`), que habla de MaKo en general y arranca
solo, en silencio, con «Si vendés High Ticket con VSL Funnel», al lado de un titular que promete el dolor de cada ángulo
(«Más cierres para tu inmobiliaria…»). Para el visitante, la promesa se rompía en el primer pantallazo; para el test de
anuncios, el video dominaba el primer pantallazo de las ocho por igual.

**Vive en:** `scripts/landings-mako-funnels.mts` (`heroSinVideo`, `VSL_PRINCIPAL`, el campo `video` de cada funnel, `--id`)
· los documentos #33 a #40 del workspace de la plataforma (MaKo)

- **Decidido (el diseño es del chat): hasta que cada funnel tenga su VSL, el hero queda con la promesa y su botón,
  centrado, y el VSL de la principal baja justo debajo con el rótulo «Así funciona MaKo».** El plan de registro
  (docs/vsl/README.md) ya era que las ocho compartan el lugar del VSL en el hero y se cambie el `src` cuando el video de
  cada una exista: eso es `video` en `COPY` (con él, el hero vuelve a tener video y no se aplica `heroSinVideo`).
- **El texto de cada landing no se tocó** (avatares-ia sale tal cual, decisión de Martín): lo único nuevo es el rótulo
  de tres palabras arriba del video.
- ⚠️ **Trampa del script, cerrada:** `--subir` llamaba a `subir(doc, undefined, …)`, o sea que volver a correrlo
  INSERTABA un documento nuevo con el mismo slug en vez de actualizar el que está arriba. Ahora pide `--id <documento>`
  (con `--solo`), o `--nueva` a propósito.
- **Cómo se hizo sin romper nada:** (1) los ocho documentos que generaba el código de hoy eran IDÉNTICOS a los publicados
  (comparados con las claves ordenadas: jsonb las reordena y un `JSON.stringify` directo dice «distinto» sobre lo mismo),
  así que lo único que cambia es el hero; (2) los ocho no tenían ediciones a mano (`updated_at` = creación, sin
  versiones); (3) respaldo de los ocho antes de subir (en el scratchpad de la sesión); (4) vista previa FIEL antes de
  escribir: la página publicada de verdad con el hero nuevo puesto encima en Chrome sin ventana, escritorio y teléfono,
  cortando /api/track/* para no dejar visitas; (5) se subieron de a uno por su id (v1 → v2) y se verificó que cada slug
  siga en un solo documento.
- **Verificado en producción, las 16 direcciones** (Chrome sin ventana, /api/track/* cortado): hero sin video, el VSL debajo
  con su rótulo, el botón, el Pixel de MaKo con su beacon y el de Meta cargando, sin desborde. ⚠️ **hola-mako.site lo
  mostró al instante y hola-mako.com/vsl tardó ~10 minutos y dos pedidos**: el script escribe la base directo y no vence
  `TAG_LANDING_MAKO` (lo vence «Publicar» en la app), y esa página tiene DOS cachés de 5 min encadenadas
  (`unstable_cache` en lib/editor-landing/landing-mako.ts y `revalidate = 300` en app/vsl/[slug]/page.tsx) que sirven lo
  viejo una vez más mientras se regeneran. Quien cambie una landing de MaKo por script, que mida .com después de ese rato.
- **Lo que esto NO resuelve:** el video sigue siendo el de la principal para las ocho, ahora como contexto y no como la
  promesa. Para que cada ángulo tenga su VSL hay que grabarlo (los guiones están en docs/vsl/) y ponerle su `video`.

## `/web-generator` pelado ya no es el Panel: un link al Panel lleva `?panel=1` (24/10/2026)

Al convertir el editor en el molde de Automations (docs/diseno-editor-web-como-automations.md, 7ae16876e).

**Vive en:** `app/web-generator/page.tsx` · `app/web-generator/panel-reglas.ts` (`landingMasReciente`, `RUTA_NUEVA_LANDING`) ·
`app/web-generator/editor/paneles/PanelLandings.tsx` · `app/web-generator/Inicio.tsx`

- **La regla:** `/web-generator` sin nada en la URL (o sólo `?ws=`) abre la última landing tocada; el Panel sale sin landings,
  con `?panel=1` o con un pedido en la URL. **Un link nuevo que quiera el Panel usa `RUTA_NUEVA_LANDING`**
  (`/web-generator?panel=1`): el pelado lleva a una landing, y desde la pantalla de error de una landing que no abre era un
  lazo (llevaba a esa misma).
- ⚠️ **El Panel reescribe su URL con lo que muestra** (`queryDeDerecha` + `history.replaceState`): con la derecha por
  default no escribía nada y dejaba `/web-generator` pelado, así que un F5 sobre el Panel saltaba a una landing. Ahora,
  sin nada que escribir, deja `?panel=1`.
- **La lista de la tarjeta lee con `pedirDocs({ accion: 'listar' })`**, el mismo del Panel, y un error de lectura se dice
  («No pude leer tus landings» + Reintentar), no se dibuja como una lista vacía. La redirección tampoco salta con la lista
  sin leer.

## «Nueva landing» adentro del editor, «Compartir» en un solo botón y sin «Guardado» (24/10/2026 noche, tanda 1 de claude5)

Pedidos de Martín del 24/10, textuales en `docs/feedback-24-10.md` (sección «Editor web → chat Landings», puntos 3, 7 y 9).
**El 3 y el 7 ya se habían dado por hechos ese mismo día (7ae16876e) y no cumplían.**

**Vive en:** `app/web-generator/editor/EditorLanding.tsx` (`setNueva`, `creando`, la barra) ·
`app/web-generator/editor/paneles/PanelLandings.tsx` · `app/web-generator/Inicio.tsx` (`embebido`) ·
`app/web-generator/editor/dialogos/DialogoCompartir.tsx` · `app/web-generator/[id]/page.tsx` (las analizadas y las bases).

- **El diagnóstico equivocado: «Nueva landing abre las plantillas» se leyó como «llega a las plantillas por cualquier
  camino».** Lo entregado era un `<Link>` a `/web-generator?panel=1`: otra RUTA y otra barra lateral (la del Panel). Martín:
  «NO me debe redireccionar a otra ruta... Y la sidebar no debe cambiar». **Regla:** cuando Martín dice «que no me
  redirija», no cambia la URL NI la columna de la izquierda; se reemplaza sólo el área que nombra.
- **Cómo quedó:** «Nueva landing» es un botón que prende `nueva` en el editor; la barra y el lienzo quedan MONTADOS y
  ocultos (`display: none`: volver es instantáneo, con el deshacer intacto) y en su lugar va el Panel ENTERO en modo
  `embebido` (sin su barra de documentos, sin reescribir la URL y con la lista leída al montar). Es el mismo `Inicio`, no
  una copia: crear, Analizar, Replicar y las plantillas son los del Panel. Se carga perezoso (`lazy`): trae Crear, el
  Diagnóstico y Replicar, que el editor no necesita hasta ese clic.
- ⚠️ **El Panel reescribe la URL con lo que muestra** (`queryDeDerecha` + `history.replaceState`): montado adentro del
  editor, ponía `?panel=1` sobre `/web-generator/<id>`. Embebido, ese efecto no corre.
- **`nueva` se ve sólo con la LISTA a la izquierda** (`creando = nueva && panelIzq === 'landings'`) y salir de la lista lo
  apaga: ir al chat (la criatura, Mod+E) es volver a ESTA landing, y el chat edita la abierta.
- **El panel Compartir es de Canva, no de Gamma:** se abre DEBAJO del botón (un `Flotante` con su ancla, no un modal),
  el enlace con UN botón grande y una fila de atajos (Descargar, Vista previa, Enlace privado, Presentar). Lo que tiene
  opciones (Descargar, Enlace privado) cambia el panel con «←», sin otro modal encima. Se fueron las pestañas, «Quién
  puede editar» y los tres botones del pie. El ▾ del botón lleva Publicar, Vista previa, la publicada, Descargar y Presentar.
- **En una presentación, Presentar quedó como ícono al lado de Compartir** (T3 pedía «tal cual Gamma», que pone «Present»
  junto a «Share»); el azul es uno solo en las dos.
- **«Guardado» no se dibuja, los problemas sí:** «No se guardó · Reintentar» y «Versión más nueva» siguen (callarlos sería
  la app contando algo que no pasa). El título no baja de 160 px (`flex: 0 0 auto`); lo que cede es el formato del medio.

Lo que quedó SIN hacer:
- **No se miró con clics ni a 1280 px.** Con ~2 GB libres el vigía mató el chequeo de tipos de 2,4 GB, y el editor en
  `next dev` pide 5-6 GB. Lo de la barra a 1280 sigue en «Sin verificar en pantalla» (docs/pendientes.md).
- El clic derecho (P5), los botones amontonados del lienzo (5), la sidebar del chat que no se pliega (10), los
  placeholders tapados (6), la segunda barra de formato (8) y las páginas de MaKo editables por sección (4): tandas que siguen.

## Los botones amontonados en la esquina del lienzo y el chat que no se pliega (24/10/2026 noche, tanda 2a de claude5)

Puntos 5 y 10 del 24/10 (docs/feedback-24-10.md). **Vive en:** `app/web-generator/editor/extensiones/estilos-nodos.ts`
(`.gmc-lado`) · `app/web-generator/gamma.css` (el margen del lienzo) · `nodos/TarjetaVista.tsx` · `EditorLanding.tsx`
(`PanelIzq`, la barra) · `paneles/PanelAgente.tsx`.

- **La causa del amontonamiento NO era el botón de la tira (que se movió igual): eran TRES piezas que caen en el mismo
  punto.** En una landing toda sección va a sangre (css.ts, 15c), así que la columna ⋮ ✨ ▤ iba ADENTRO, a 12 px de la
  esquina; el asa de cada bloque (AsaBloque) se ubica 52 px a la izquierda del bloque, que con el padding de 3,5em del
  cuerpo y el lienzo de ~850 px (padding-inline de la sección en 0) es justo el borde de la sección; y el primer bloque
  del header es el logo. **Regla:** en una landing de escritorio la columna va AFUERA, en un margen de 40 px que el
  lienzo le deja a la página (sólo en el editor); adentro queda donde lo de afuera se recorta (el marco de teléfono o
  tableta tiene `overflow: hidden`) y en una diapositiva a sangre.
- **La columna en una landing es UN botón (⋮):** el ✨ «Editar con IA» se fue (el chat de la tarjeta está siempre) y las
  notas del orador quedan sólo en una presentación (en una landing siguen en el ⋮).
- **La tira de secciones es una vista de la TARJETA de la izquierda** (`PanelIzq = 'tira'`), con su botón en la barra,
  como Páginas. Ya no es una columna entre la tarjeta y el lienzo: el lienzo ganó ~150 px, que a 1280 hacen falta.
- **El chat no se pliega:** `PanelIzq` ya no admite `null` (el tipo lo impide), se fueron el «⇤» de la cabecera, «Abrir
  MaKo» de la barra y el `agentePlegado`; Mod+E lleva al chat y le pone el cursor. Cerrar Páginas o la tira vuelve al chat.
  El 12/10 Martín había pedido «de ultima que se pueda plegar»: lo del 24/10 es posterior y gana.
- **El placeholder partido** («Envía un mensaje al / agente…») no cabía al lado del «+», los emojis y el micrófono: va
  «Escribe a MaKo», el molde del Ops Center («Escribe a <quién>»), y el `::placeholder` no corta renglón.

Lo que quedó SIN hacer:
- **«Discutir / Editar» en lugar de «Toda la landing / Sin título»** (la otra mitad del punto 10): «Discutir» necesita que
  la IA del editor conteste sin tocar la landing, y hoy sólo sabe editar (`accion: 'editar'`, lib/editor-landing/ia.ts).
  Va en la tanda 2b, con su prompt y su lugar en la API de MaKo.
- La columna en el teléfono y la tableta sigue ADENTRO (el marco recorta lo de afuera) y ahí todavía puede encimarse con
  el asa del primer bloque.
- Sin mirar con clics (la RAM no dio para levantar el editor).

## «Discutir | Editar» en el chat del editor (24/10/2026 noche, tanda 2b de claude5)

La otra mitad del punto 10: «Tampoco pongas los botones de "toda la landing, sin titulo" pon los botones de "Discutir,
editar"». **Vive en:** `app/_chat/SelectorIntencion.tsx` (el selector, compartido) · `app/web-generator/editor/paneles/PanelAgente.tsx`
(`pedirDiscusion`, `pedirEdicion`) · `lib/editor-landing/ia.ts` (`discutir`, la pista en `editar`) ·
`lib/editor-landing/ia-reglas.ts` (los prompts y lo puro) · `lib/prompt-registry.ts` · `app/api/landing-generator/ia/route.ts`.

- **«Sin título» no era un bug de título: era el chip de la SECCIÓN con el cursor** (una sección sin encabezado se llama
  «Sin título»). Los chips eran el alcance de la edición; sin ellos, el alcance se decide solo.
- **Regla del alcance sin chips:** «Editar» manda la landing ENTERA y la sección del cursor viaja como PISTA (`enFoco` →
  `focoParaEditar`, en el slot `alcance` que arma el código: el prompt editable no cambió): si la instrucción no dice
  dónde («mejora la escritura»), es ésa; si nombra otra parte, la IA hace eso. Antes, con el chat abierto y una sección
  tocada, se mandaba SÓLO esa sección por defecto. Si la página no entra de una vez (`MUCHO_PARA_EDITAR`, compartida en
  api-tipos), se vuelve a pedir sólo la sección del cursor y la respuesta lo dice; sin cursor, pide tocar una.
- **«Discutir» es una acción nueva de la IA (`accion: 'discutir'`), no «editar» con otra bandera:** lee el TEXTO de cada
  sección (no el JSON), lo último de la charla (sin eso «como te dije» no existe: la lección de Automations, 22/10), los
  archivos de la caja y el negocio; devuelve texto. Sus dos prompts están en el registro (/configuraciones), con el
  mismo contrato que los demás del editor (lo fija tests/editor-landing-ia.test.ts).
- **El selector es UNO para los chats** (`app/_chat/SelectorIntencion.tsx`, la misma clave `mako-chat-intencion`): quien
  eligió «Discutir» en Automations lo encuentra igual acá. ⚠️ **Automations todavía dibuja su copia** (app/automations/ChatMako.tsx,
  `SelectorIntencion`): no se tocó porque ese chat estaba trabajando en el archivo. Al migrarla, se borra la copia.
- **No va a la API de MaKo, a propósito:** «Discutir» no configura nada; quien usa la API ya es una IA que lee la
  página con `ver_secciones_landing` y opina sola. Lo que la API sí tiene es `editar_landing_con_ia`.

Lo que quedó SIN hacer:
- Sin mirar con clics ni con la IA de verdad: el modelo de mentira fija lo que le llega y lo que vuelve, no la calidad de
  lo que contesta.

## Los placeholders que se iban debajo de otras secciones, y el editor de texto en una segunda barra (24/10/2026 noche, tanda 3 de claude5)

Puntos 6 y 8 del 24/10. **Vive en:** `app/web-generator/editor/extensiones/estilos-nodos.ts` (el placeholder) ·
`extensiones/esquema.ts` (`PLACEHOLDER_GENERAL`) · `EditorLanding.tsx` (el botón «Texto» y `.gma-formato`) · `gamma.css`.

- **La causa (sin la captura de Martín, deducida del código y medida en Chrome sin ventana):** el placeholder de TipTap
  es un `::before` que FLOTA con alto 0, para que el cursor quede al principio. Alto 0 = no ocupa lugar: si el texto no
  entra en un renglón (una columna angosta, un título grande), los renglones de más se derraman hacia abajo, encima de lo
  que sigue, y la sección siguiente lo tapa (cada sección es su capa, `isolation: isolate`, y pinta su fondo encima).
  Medido con la hoja real (scratchpad, `ph-antes.png` / `ph-ahora.png`): en una columna de 150 px, «Escribe algo o
  escribe «/» para ver los comandos» ocupaba 3 renglones en un párrafo de 1.
- **Regla:** en un párrafo o un título, el placeholder es ABSOLUTO sobre su renglón (`left: 0; right: 0`), en UN renglón
  y cortado con «…». No empuja al cursor y queda alineado como el texto (flotando, un título centrado lo mostraba a la
  izquierda). ⚠️ **No vale «alto 0 + `overflow: hidden`»**: con alto 0, el recorte lo borra entero. Los demás nodos (el
  botón, la pregunta de un desplegable) siguen flotando: tienen padding y no se derraman.
- El texto general se acortó a «Escribe o pulsa «/» para comandos».
- **El editor de texto es un botón «Texto» (Aa) que abre una SEGUNDA barra** debajo de la de herramientas, con todas las
  opciones de `BarraFormato` y sin scroll (si no entran, se parten en renglones). Se recuerda en el navegador
  (`gma.formato.abierto`). La barra flotante sobre la selección sigue igual. Con la segunda barra cerrada, Mod+K para un
  enlace lo atiende la flotante (aparece con la selección).

Lo que quedó SIN hacer:
- Sin mirar con clics en el editor de verdad (la medición fue con la hoja real en una página armada a mano).

## Las páginas de MaKo editables por sección, sin romper el diseño (24/10/2026 noche, tanda 4 de claude5)

Punto 4 del 24/10: «Todas las paginas de MaKo no son editables, clickeo y no se pueden editar las secciones... Deben
serlo. Y eso no implica romper el diseño, en todo caso agregar funcionalidades al editor web.» **Vive en:**
`lib/editor-landing/html-editable-textos.ts` (nuevo, puro) · `lib/editor-landing/ia-bloques.ts` (el bloque `diseno`) ·
`app/web-generator/editor/nodos/HtmlEditableVista.tsx` · `contexto.ts` (`marcarActiva`).

- **El diagnóstico obvio era el equivocado: escribir adentro SÍ andaba.** Se midió en Chrome sin ventana por CDP, con un
  iframe igual al del editor (`sandbox="allow-same-origin"`, sin scripts): el clic llega, se escribe y el editor se
  entera (`mousedown`, `input`). Lo que no andaba era todo lo de ALREDEDOR: (1) un clic adentro del diseño pasa en el
  iframe y ProseMirror no lo ve, así que la sección nunca quedaba ACTIVA (ni sus controles ni el chat se enteraban);
  (2) la IA del chat recibía cada sección de diseño como `{"t":"conservar"}`, una caja cerrada: MaKo no veía ni una
  palabra, y pedirle «cambia el título» no cambiaba nada.
- **Regla para que la IA edite un diseño sin romperlo:** viaja la LISTA DE TEXTOS de la sección, en orden (`{"t":"diseno",
  "ref","textos"}`), y vuelve con la MISMA cantidad; cada texto va a su lugar exacto del HTML. Etiquetas, clases,
  estilos en línea y atributos no se tocan; lo que escribe la IA se escapa (nunca abre una etiqueta); un texto igual deja
  su pedazo byte por byte; otra cantidad = la sección queda como estaba (y queda en los descartes). Los textos de un
  `<style>`, un `<script>` o un ícono `<svg>` no viajan. Más de 400 textos en una sección: cerrada, como antes.
- ⚠️ **El tokenizador es propio (sin DOM ni parser):** ia-bloques corre en el server, en el navegador y en los tests. Un
  atributo entre comillas puede traer `>` (`data-x="a>b"`): la expresión de etiqueta lo respeta. El HTML que llega ya
  pasó el saneo del server (sin scripts).
- **Clic adentro = sección activa:** `ctx.marcarActiva(id)` (sin mover el cursor ni el scroll), buscando la tarjeta del
  diseño desde `getPos()`. Las escuchas del iframe se ponen una vez al cargar: leen el contexto por un ref.
- **Negrita y cursiva** en la barrita del diseño, con el comando de edición del documento del iframe (el botón no le roba
  el foco). La API de MaKo hereda sola lo de la IA: `editar_landing_con_ia` usa la misma `editar`.

Lo que quedó SIN hacer:
- La prueba de que la IA no inventa (`quitarPruebaInventada`) mira los nodos de Gamma, no los textos de un diseño: un
  testimonio o una cifra que la IA escriba en una página de MaKo no se vacía sola.
- El ⋮ de una sección de diseño ofrece cosas de Gamma que no le aplican (color de fondo, estilo, «Probar nuevo diseño»).
- Sin mirar con clics en el editor de verdad.

## El clic derecho en los chats embebidos y en el lienzo (24/10/2026 noche, P5 de claude5)

Martín, 24/10: «en Automations o Web Generator, si le doy click derecho, no hace nada» y «en el lienzo de Web tambien
debería funcionar el click derecho, como en otros editores». Plan en [diseno-editor-web-como-automations.md](diseno-editor-web-como-automations.md) §5.
**Vive en:** `app/_chat/HiloMako.tsx` (`MenuDelMensaje`) · `app/web-generator/editor/paneles/PanelAgente.tsx` y
`ChatAgente.tsx` (la cita) · `app/web-generator/editor/nodos/TarjetaVista.tsx` (el lienzo) · `extensiones/piezas.tsx`
(`Flotante` con un punto).

- **La causa:** el menú de un mensaje vive en `MensajeWA` y se prende con `ContextoWA`; sólo lo daban el Ops Center, el
  teléfono y el Second Brain. **Regla:** `HiloMako` pone uno MÍNIMO si quien lo monta no trae el suyo (Copiar siempre;
  Responder si la pantalla le pasa `onCitar`). Si viene uno de afuera, gana el de afuera. Así lo heredan los chats que
  dibujan con `HiloMako` sin tocar cada pantalla; **Responder sólo aparece donde la pantalla sabe poner la cita en su caja**
  (hoy, el editor web). En la caja va `CitaCaja` del Ops Center y lo escrito sale con `armarConCita`, igual que allá.
- **Con el dedo no se abre:** en Android el `contextmenu` que llega después del mantener apretado cierra el menú en el mismo
  gesto (MensajeWA.tsx, «POR QUÉ SE CERRABA SOLO»). Los embebidos son de la computadora; el teléfono trae su ContextoWA.
- **El lienzo de Automations no se pisa:** su `onContextMenu` (app/_components/Lienzo.tsx) mira si el clic fue ADENTRO de
  su caja por el DOM (`caja.current.contains`), no por el árbol de React, así que un chat en un portal no le abre el menú.
- **El lienzo del editor web:** el clic derecho sobre una sección abre el MISMO menú del ⋮, en el punto del clic (no una
  lista nueva: lo que crece en el ⋮ crece acá). Lo que se abre desde ahí (estilo, notas, diseños) se sigue anclando al ⋮.
  Quedan con el menú del navegador: Shift + clic derecho, y el clic derecho con texto elegido (copiar, el corrector).
- ⚠️ **Trampa para quien sume otro clic derecho adentro de una sección:** el de la sección es un listener NATIVO en su
  elemento, y React escucha en la raíz: el nativo corre ANTES que cualquier `onContextMenu` de React de un bloque de
  adentro, así que `e.preventDefault()` en React llega tarde. Un bloque que quiera su propio menú se escucha también con un
  listener nativo (en su elemento) y hace `preventDefault`: el de la sección respeta `defaultPrevented`.
- **Un `Diseño editable` (iframe) no lo dispara:** el `contextmenu` adentro del iframe no sale del iframe. Ahí queda el del
  navegador (que es el que sirve para copiar y pegar texto del diseño).

Lo que quedó SIN hacer:
- Responder en los demás chats que dibujan con `HiloMako` (Automations, Offer, el onboarding, Dashboard…): hoy traen
  Copiar; cada pantalla suma Responder pasándole `onCitar` y la cita a su caja (`arriba` de CajaChat).
- Sin mirar con clics en el editor de verdad.

## La página de Mauricio ya no da 403 en producción, y cómo medirlo sin escribir nada (24/10/2026 noche, claude5)

Medido en producción (el despliegue de las ~19 h, con c3af56f7b) desde el Chrome de Martín, en el Cliente de Prueba: la
vista aislada del Diagnóstico (`GET /api/landing-generator/diagnostico/pagina?url=https://sprint.mauriciobustos.com`)
bajó la página y avisó «listo». Usa `paginaParaVer` → `bajarHtml`, el MISMO camino (con el reintento ante un 403) que
Offer y el análisis (`extraerLanding`), así que el 403 que vio Martín no sale más.

- ⚠️ **Esa ruta responde 200 también cuando NO pudo leer la página:** el error va ADENTRO, como un documento que avisa
  por `postMessage({ gmDg: 1, tipo: 'error', mensaje })` (`documentoErrorDiagnostico`). El código de estado no dice nada;
  para medirla desde afuera hay que escuchar el mensaje: `tipo: 'listo'` = la bajó, `tipo: 'error'` = no.
- **Medirla sin escribir:** es un GET de sólo lectura, pero sólo se sirve a un iframe (`Sec-Fetch-Dest: iframe`). Se
  arma con un `<iframe sandbox="allow-scripts">` desde cualquier página de hola-mako.com con la sesión del admin, y
  `&ws=3`. No crea análisis ni filas en ningún negocio.
- **La pestaña del editor se cuelga con la extensión** (dos veces el 24/10: `Runtime.evaluate` sin respuesta a los 45 s).
  Una página liviana del mismo dominio (`/api/auth/me`) sirve de base para medir rutas: responde enseguida.

## La landing principal con lo que hace la competencia: dos portadas, precios vivos y nada prometido de más (25/10/2026, claude5)

Martín (25/10): «investigues al 100% como lo venden otros». La investigación del Cerebro (80 productos, §6a) propone la landing
sección por sección; `scripts/landings-mako-v2.mts` la arma como dos documentos de Web Generator (portada A «el equipo», slug
`mako-equipo`; portada B «todo junto», `mako-todo-junto`), una sección por «Diseño editable». **El diseño es el de 100ads.ai**
(abierto el 25/10: etiqueta chica, titular apretado con una línea en cursiva serif, tarjetas grises, franja oscura de precios,
preguntas en dos columnas, el fundador con tres números), con la tinta, el azul y la estrella de MaKo, y Geist.

- **Los precios, nunca escritos en el documento.** Una foto publicada se queda con el precio del día en que se publicó. La
  landing MARCA (`data-mako-desde`, `data-mako-precio="pro"`) y deja el lugar de las columnas (`data-mako-planes`);
  hola-mako.com los llena con los planes de hoy (`conPreciosEnHtml`, lib/editor-landing/precios-en-landing.ts, en
  app/vsl/Landing.tsx). Lo de adentro es el respaldo del editor, y sale de lib/planes-mako.ts, no de un número tipeado.
- **Planes ya ponía las columnas de precios del lado del cliente**, en el lugar de la agenda (`[data-calendly]`) o antes del
  pie. Reusar `data-calendly` en un diseño nuevo hacía cargar Calendly en el editor y en hola-mako.site. El lugar propio gana.
- ⚠️ **La garantía de 14 días está «decidida» (docs/ofertas-mako.md) pero /reembolsos dice que el mes pagado no se devuelve.**
  La landing no la promete (`GARANTIA = null` en el script; un test la ata a /reembolsos). La escribe Planes.
- ⚠️ **No hay demo por WhatsApp todavía.** «Escríbele a MaKo» como demo (Aurora, Skalex) necesita un número público y un
  setter que atienda a desconocidos: el botón secundario es «Ver los planes». Tampoco hay un video corto de demo (el de
  Mauricio es el caso real, no una demo de producto).
- ⚠️ **WhatsApp se conecta sólo por QR**: la bandeja oficial (Cloud API) se borró el 09/10. Las preguntas frecuentes lo dicen.
- **La voz es «tú», no voseo**, aunque la investigación recomienda voseo: la regla de Martín (español neutro, audiencia
  México) la vigila `tests/puente-panel-copy.test.ts`, que barre también los scripts. Cambiarla es una decisión de Martín.
- **La cuenta del ahorro se arma de la misma tabla que se muestra** (`AHORRO`, sin el media buyer: US$352 sin él), y «más de
  US$350» se redondea hacia abajo para que sea cierto.
- **Trampas de las herramientas:** un reset `.mkv p { margin: 0 }` le gana por especificidad a cada clase y se come sus
  márgenes (va con `:where`); un `.mts` se importa con extensión `.mjs`; un módulo con `server-only` se importa adentro de la
  función (y su prueba corre en un node aparte con `--conditions=react-server`); tsx compila a CommonJS un `.mts` importado
  desde un test `.ts`, y ahí no hay `await` de primer nivel.

Lo que quedó SIN hacer:
- **Publicar.** `--subir` escribe en producción (ws 9) y el permiso se lo pide a Martín; la portada (`--principal`) recién
  después de que se despliegue el cambio de app/vsl/Landing.tsx (antes, los precios saldrían dos veces).
- La portada C («del anuncio a la llamada»), la sección del control (los límites del media buyer) y la fila del media buyer
  en la cuenta: con el media buyer en producción.
- La demo por WhatsApp y el video corto de demo. (La garantía ya no va: la reemplaza la prueba gratis, abajo.)
- Las landings por funcionalidad y por avatar: hechas en la tanda 2 (abajo).

**Tanda 2 (25/10, tarde): las landings por funcionalidad y por avatar** (`scripts/landings-mako-v2-funnels.mts`, §6b)
- **Doce documentos NUEVOS, con slug `mako-…`:** páginas de venta, setter, tableros, creativos, avatares, media buyer, closing,
  cursos, coaches, infoproductores, inmobiliarias y agencias. Las ocho del 23/10 (crear-landings, coaches…) pueden estar en
  anuncios corriendo: no se pisan. Cada slug está en `LANDINGS_MAKO` (lib/origen-cuenta.ts), con `media-buyer`, `closing` y
  `cursos` como funcionalidades nuevas y `agencias` como avatar nuevo. Nadie fuera de origen-cuenta usa esos tipos.
- **Se arman y NO se suben (`pausada`, con su motivo):** la del media buyer (no está en producción) y la de avatares (en
  pausa desde el 23/10). El `--subir` las saltea, y un test lo vigila.
- **Lo que se verificó en el código antes de escribirlo:**
  - El análisis de llamadas usa las grabaciones de Fathom y puntúa siete partes, del diagnóstico al cierre. Por eso el titular
    dice «en qué parte se te cae», no «en qué objeción».
  - No hay un resumen diario de números para el dueño. La landing de tableros dice «pregúntale a MaKo cómo va tu negocio».
  - Esencial y Pro abren las mismas tabs (cambian los topes). Por eso «va en MaKo Pro» sólo donde lo dice el plan: el análisis
    de llamadas y lo de agencia.
- **Las piezas son las de la principal** (exportadas de landings-mako-v2.mts), más cinco bloques: tarjetas, pasos, una
  conversación de ejemplo (sin cifras), una comparación en tabla y la tarjeta de prueba. Las preguntas salen de un catálogo con
  clave: un cambio en una respuesta llega a todas las landings.
- **La prueba gratis de 7 días** (Martín, 25/10 ~10:20, en lugar de la garantía de devolución). La fuente es UN número,
  `PRUEBA_DIAS` (lib/planes-mako.ts, de Planes). El botón («Empieza tus 7 días gratis») y la línea corta («7 días gratis ·
  Cancela cuando quieras · Usas tu propia IA») se arman con ese número en `botonDePrueba`/`lineaDePrueba`
  (precios-en-landing.ts). El cierre y la pregunta de cómo cancelar dicen lo mismo que /planes (app/planes/Vitrina.tsx): el
  día del cobro es `PRUEBA_DIAS + 1` y la baja se hace desde «Tu plan». Lo que va bajo el botón de CADA plan («Después US$
  97/mes…», `textoDespuesDeLaPrueba`) ya lo pone la columna, porque las columnas de la landing son las de /planes.
  Los textos que se ven llevan la marca `data-mako-prueba` (linea, boton, dias, cobro). hola-mako.com los llena con
  `PRUEBA_DIAS`, como los precios. Un test frena un «7 días gratis» escrito a mano en un script, días que no son (0,
  negativos, con coma) y cualquier «garantía» o «te devolvemos» de vuelta. El pie sí enlaza a /reembolsos, la política legal.
  - **La trampa: un nombre adelantado para no esperar CAMBIA.** Para no frenar, el Cerebro fijó un objeto `PRUEBA_GRATIS`
    (días, línea, botón, «se cobra sola»), y se programó contra un sustituto local. Planes exportó otra cosa: un número y una
    función con monto y período. Cuando la fuente es de otro chat, se depende de lo MÍNIMO (aquí, los días) y las frases se
    arman de este lado. Así un cambio de forma toca un import, no cuatro archivos.

## Los tooltips tapados, el «+ ⠿» encima del logo, Compartir con el ▾ redondo y los paneles que saltan (25/10/2026, claude5)

Martín, 25/10 (~11:30 y ~11:40), con capturas de la landing principal (#32): «Los placeholder... se siguen ocultando detrás de
otras secciones y no se leen», «Los botones... se siguen superponiendo», «El desplegable al lado de "compartir" no debe ser
redondo», «"tira de imagenes" y "pagina" no deben cambiar el ancho de la sidebar del chat... con un botón de flecha para
regresar... No la X» y «el botón de "texto" debe estar al principio de todo». **Vive en:** editor/TooltipsFlotantes.tsx (nuevo)
· editor/AsaBloque.tsx · gamma.css · EditorLanding.tsx · PanelPaginas.tsx · TiraSecciones.tsx · layout.tsx.

- **Lo que Martín llama «placeholders» eran los TOOLTIPS:** el «Editor de texto» debajo de la barra de formato y el «Volver al
  ch…» cortado en el borde del panel. Eran `::after`/`::before` (`.gma-tip`, `.gmc-tip`): un pseudo-elemento vive adentro de
  su botón, así que lo corta el `overflow` de cualquier ancestro y lo tapa la capa de al lado. **No hay z-index que lo arregle
  para todos.** Ahora es UN tooltip en un portal en `body`, `position: fixed`, dado vuelta si no entra y corrido para quedar en
  la ventana; montado en el layout de /web-generator, apaga los pseudo-elementos con `html[data-tips-flotantes]`.
- **El ▾ redondo era un `:last-child`:** con cambios sin publicar, el último hijo de `.gma-partido` es el puntito azul, y la
  regla del ▾ (`.gma-boton:last-child`) dejaba de aplicar: quedaba un botón suelto, redondo. **Regla:** las mitades de un botón
  partido llevan su clase (`gma-partido-principal`, `gma-partido-flecha`), nunca una posición.
- **El «+ ⠿» y el ⋮ se pisaban en el margen:** el asa va 52 px a la izquierda del bloque, y en una sección a sangre («Diseño
  editable») eso caía encima del ⋮ (en el margen de 40 px) y del borde. Ahora el margen de una landing en escritorio es de 88 px
  y el asa va a 84 px de la sección (`ASA_FUERA_DE_LA_SECCION`): [+ ⠿] [⋮] | sección. Un test hace la cuenta.
- **«Páginas» medía 280 px y el chat 340:** el lienzo saltaba al abrirla. Ningún panel de la izquierda tiene ancho propio.
  Para volver, la flecha del chat («←», arriba a la izquierda) en «Páginas» y en la tira; «Texto» es la primera herramienta.

Lo que quedó SIN hacer:
- ~~Que se pueda escribir en las secciones de las landings de MaKo (el punto 1 de Martín).~~ Hecho: la sección de abajo.
- Mirarlo con clics a 1280 y 1440 (la barra, los paneles y los tooltips): cuando despliegue el tren con esta rama.

## Las secciones de las landings de MaKo no dejaban escribir: el clic NUNCA llegaba al iframe (25/10/2026, claude5)

Martín, 25/10 ~11:30: «Las landing de MaKo NO son editables, no puedo ni cambiar un título de lo que ya esta, cada bloque debe
ser editable». Es el mismo pedido del 24/10 («clickeo y no se pueden editar las secciones»), que se dio por arreglado.

- **La causa:** una regla del 11/10 en BarraFormato (`CSS_G2`), `.gmx-nv:not([data-activo="si"]) iframe{pointer-events:none}`,
  para que un video o un embed no se trague el clic que elige su bloque. El «Diseño editable» (23/10) es un iframe dentro de
  un `.gmx-nv`, y su sección se activa con el `mousedown` de ADENTRO del iframe. Era un círculo: sin activar no recibe el
  clic, y sin el clic no se activa. Ni cursor, ni sección activa, ni barra. **El arreglo:** una regla en `CSS_EDITABLE`
  (HtmlEditableVista.tsx) que le devuelve el clic a ese iframe y gana por ESPECIFICIDAD (0,3,1 contra 0,2,1), no por orden: las
  dos hojas son `<style>` distintos y su orden de carga no está garantizado.
- **El diagnóstico obvio era el equivocado, dos veces.** El 24/10 se leyó como «el clic pasa en el iframe y ProseMirror no lo
  ve», y se sumó `marcarSeccion()` al `mousedown` del iframe. Ese `mousedown` nunca llegaba, así que el arreglo no podía
  andar. «Escribir ya andaba, medido por CDP» se había medido en un iframe SUELTO. El 25/10, con las 9 secciones reales de la
  #32 y su CSS, también se escribía en Chrome sin ventana, aun dentro de un padre `contenteditable`. **Lo que faltaba era la
  hoja del editor.** **Regla:** un «en Chrome anda» sobre una maqueta no cierra un «no puedo hacer clic» del editor. Lo que
  lo cierra es `document.elementFromPoint(x, y)` en el editor REAL, en el punto exacto del clic. Si devuelve otra cosa que el
  elemento que debería recibirlo, la causa está en el CSS de la página (`pointer-events`, una capa encima), no en el
  componente. Así salió en un minuto: el clic caía en `div.gmx-nv-marco.gmx-editable-vivo`.
- **Cómo se midió, sin tocar la publicada:**
  - En la #32, sólo clics y lectura: hoy no hay foco, ni cursor, ni barra. Con la regla apagada nada más que en la pestaña,
    el cursor entra al H1 y aparece la barra de la sección.
  - En una COPIA (#41, «Duplicar landing»): con la regla apagada se escribió, guardó solo y siguió ahí al recargar. El
    guardado nunca estuvo roto. La copia quedó en la papelera.
  - **Trampa:** «Duplicar» vuelve a guardar lo pendiente del original, y la fecha de edición de la #32 se movió sin que
    nada cambiara. Se comprobó comparando las 9 secciones y el CSS con el borrador bajado antes.
- **El test** (tests/editor-web-diseno-editable-clic.test.ts) no busca un texto. Arma el camino del DOM que dibuja la vista
  (`.gmx-nv` sin activar > marco > iframe), junta todas las reglas de `pointer-events` de las dos hojas y decide la ganadora
  por especificidad; un empate cuenta como falla. También vigila que los embeds sigan sin tragarse el clic. Se probó
  rompiéndolo (5 roturas, cada una cae). Además, en Chrome sin ventana con las dos hojas reales en los dos órdenes, el clic
  cae en el iframe y escribe; sin la regla nueva, cae en el envoltorio (como en producción).

- **Por la API pasaba lo mismo:** `ver_landing_creada` no veía ni una palabra de estas páginas y `cambiar_texto_landing` no
  las encontraba. Arreglado el mismo día: docs/hallazgos-api-mako.md, «Las páginas de MaKo no se leían ni se cambiaban por
  la API».

**Verificado en producción (25/10, ~14:55, main 9c684f88c), con clics sobre una COPIA (#42, ya en la papelera):**
- con la sección sin activar, el clic cae en el iframe;
- se escribió « PRUEBA» en el título, se guardó solo y siguió ahí al recargar;
- la #32 no cambió.

**Y a 1280 la barra no entraba (lo vio la misma prueba):**
- pedía 872 px en 848, y el «⋯» (Menú del documento) quedaba cortado fuera de la pantalla;
- la app tiene `overflow-x: hidden`, pero un foco igual la scrollea: al abrir «Páginas» todo se corría 15 px. Era el salto
  que parecía del ancho del panel;
- la causa: el título con `flex: 0 0 auto` (24/10) no cedía nada, y lo que «cedía» (el formato del medio) está vacío sin un
  texto elegido;
- el arreglo: `flex: 0 1 auto`, que no baja de 160 px. Medido en la pestaña: entra justo; chat, «Páginas» y la tira quedan en
  el mismo lugar (340 px, el lienzo en x=424). A 1440 ya entraba.

**Regla:** un `overflow: hidden` no impide que el contenedor se scrollee: sólo esconde la barra. Si algo adentro desborda,
un `focus()` o un `scrollIntoView` lo corre. Lo que hay que medir es `scrollWidth > clientWidth`, no que «no se vea la barra».

Lo que quedó SIN hacer:
- La tira de secciones muestra en gris las miniaturas de las secciones «Diseño editable» hasta que cargan (a 1280 todas
  grises un rato; a 1440 algunas se dibujaron). A mirar si cargan todas.
- `editable` en HtmlEditableVista se lee una vez, al cargar el iframe (`editor.isEditable` no es reactivo ahí). Si el editor
  cambia de editable a no editable con la sección cargada, el `contenteditable` del iframe no lo sigue. Hoy no se ve: el
  editor abre editable. Si algún día se abre en modo lectura (una versión vieja), hay que seguirlo con `useEditorState`, como
  TarjetaVista.

## Servir una prueba A/B de una landing: las reglas que no dependen del motor (Landing AI, L2; 25/10/2026, claude5)

docs/diseno-pruebas-ab.md, L2; manda la crítica (Anexo 2 §E). El motor (`lib/pruebas/`: `asignar`, el store, la foto de B en
`prueba_variantes.contenido`) lo arma Automations en A1/A2, y al 25/10 todavía no existe. Lo que sí quedó, puro y probado,
en lib/editor-landing/prueba-landing.ts:

- **B tiene la MISMA estructura que A, o no se sirve.** Las rutas laterales leen la foto de A (el iframe de `htmlLibre`, el pago
  contra `publicado.pagos`), y el Landing AI nunca toca precio, oferta, links, formularios, pagos ni Pixel. Se compara lo que
  la foto guarda (config, pagos, htmlLibre, título y descripción de cada página) y lo que el HTML lleva (destinos, formularios,
  iframes, scripts, marcas de precio) **como multiconjunto**: subir una sección cambia el orden, no qué hay. Probado contra la
  foto real de la #32: otro hook con dos secciones intercambiadas pasa; un botón a otro lado, no.
- **Fijo a A va sólo lo de MaKo**: el lector (`?mako_leer`) y el análisis y la vigilancia (User-Agent `MaKoPixel/`). Nunca un bot
  de terceros por su User-Agent: con Google es cloaking, y con Meta el anuncio se aprueba mirando A.
- **La rama vive en `mko_ab_<prueba>`, HttpOnly y del servidor**, que se renueva en cada respuesta: la cookie del visitante la
  reescribe el Pixel por JavaScript, y Safari corta esas a los 7 días. Una rama apagada no se respeta (se asigna de nuevo).
- **Con prueba, la respuesta es `private, no-cache` + `Vary: Cookie`** (hoy `public`).

Lo que quedó SIN hacer (espera a A1/A2 de Automations, que pasa las firmas):
- Conectarlo en `responderPublico` (pagina-publica.ts): la marca de prueba en la misma fila que ya lee (sin una lectura extra por
  visita), `asignar`, la foto de la rama, las cabeceras y la cookie; la vista previa con `?variante=B`; publicar a mano detiene la
  prueba; el medidor `clic_conversion` contra la interfaz `Medidor`; y la API (crear, ver, aprobar, detener).

## Todo editable en las páginas de MaKo (cada botón, video, imagen e ícono) y el clic derecho (25/10/2026, claude5)

Martín, 25/10 ~15:10: «en las landing de MaKo, quiero que TODO sea editable, cada botón, cada video, cada cosa que hay...
Para eso ya tenemos casi todo construido de funcionalidades dentro del editor... Y no funciona aún el click derecho en el
editor web».

**El hecho: qué tenía la #32 y qué se podía editar, medido en producción el 25/10 (copia #43; todas las secciones son de
«Diseño editable»):**

| Elemento | En la #32 | Antes (producción) | Ahora (esta rama), con el control que ya existía |
|---|---|---|---|
| Títulos y textos | 8 títulos, 25 párrafos | se escribían (desde el arreglo del clic) | igual; negrita y cursiva en la barrita |
| Texto de los botones | 29 botones (5 «Agenda tu llamada», 23 tarjetas a hola-mako.com/vsl/…, 1 del encabezado) | se escribía | igual |
| A dónde lleva un botón o enlace | 29 + 3 enlaces | un campo de texto suelto, después de tocarlo | **SelectorDestino**, el del botón de un bloque: secciones, páginas, enlace, pestaña nueva |
| Imágenes | 10 | «Imagen», después de tocarla | igual (el selector de imágenes); el botón se marca al elegirla |
| Video del VSL (Panda, `iframe`) | 1 | sólo por «Código» | **el panel «Pegar una URL» del bloque Insertar** |
| Videos de archivo (`<video>`) | 3 | sólo por «Código» | **el selector en modo video**, el del bloque Video |
| Íconos (`svg`) | 75 | sólo por «Código» | **SelectorIcono**, con el tamaño y la clase del que estaba |
| Fondos con imagen, precios, formularios, listas | 0 | — | — |
| Clic derecho | — | no abría nada (el evento quedaba en el iframe) | **el menú de la sección**, en el punto |

**Lo que costó, y la regla de cada uno:**
- **Un clic derecho adentro de un iframe NO sube a la página.** La sección (TarjetaVista) escuchaba `contextmenu` en su elemento y
  nunca se enteraba: se medía con `window.__ctx` adentro del iframe (llegaba) y ningún menú del editor abría. Se reenvía al
  marco con el punto pasado a la página (`r.left + e.clientX`). Quedan con el menú del navegador lo mismo que en un bloque: con
  Shift y con texto elegido. Probado en Chrome: la sección recibe el punto exacto, y con Shift o texto elegido, nada.
- **Un video del diseño se tragaba el clic que lo elige**: un `iframe` o `video` adentro del iframe del diseño se lleva el
  mouse. Adentro del editor van con `pointer-events: none` (esa hoja no se guarda) y se eligen por su CAJA.
- **«Una sección» como destino (`#t-<id>`) no existía en una sección de diseño**: SelectorDestino escribe `#t-<id>`, y el
  `div.gm-libre-seccion` no puede llevar el id (con `display: contents` no tiene caja, y un ancla sin caja no hace scroll). El
  render le pone adelante un `span#t-<id>` de alto 0, con el mismo `scroll-margin-top` que una de bloques. Sin esto, un botón
  apuntado a una sección de diseño no iba a ningún lado, sin un error.
- **La barrita de la sección chocaba con el «+ ✦ ⌄» de entre secciones** y le tapaba el tacho (captura del 25/10). Ahora va
  con íconos y el nombre en el tooltip (el portal de los tooltips): ~280 px, lejos del centro.
- **Por la API, lo mismo** (lib/editor-landing/html-editable-elementos.ts, sin DOM). Se toca SÓLO lo pedido, el resto vuelve
  byte por byte, y lo nuevo se escapa. `configurar_boton_landing` cambia los botones de un diseño (con `seccion` o `todos` para
  los cinco iguales; un ancla del diseño, `#beta`, vale como destino; el estilo es parte del diseño). `poner_enlace_landing`
  cambia el reproductor de un diseño (y un `<video>` con un .mp4). `cambiar_imagen_landing` es NUEVA: una imagen de un diseño
  por un pedazo de su dirección o su alt, copiada a la biblioteca al confirmar. `ver_secciones_landing` trae los elementos de
  cada diseño. Un botón con título y bajada (las tarjetas) no se cambia de un golpe: cada texto, con cambiar_texto_landing.

Lo que quedó SIN hacer:
- **Probarlo con clics en producción, a 1280 y 1440, cuando despliegue** (en una copia). Mirar también que la barrita ya no
  choque con el «+ ✦ ⌄».
- Los íconos por la API (sólo en la pantalla); borrar o duplicar un elemento adentro de un diseño (hoy, por «Código»).
- Fondos con imagen, precios, formularios y listas adentro de un diseño: la #32 no tiene ninguno; cuando una página los traiga,
  medir de nuevo.

## Las cajas vacías y las franjas grises de las páginas de MaKo en el editor (25/10/2026, claude5)

Martín, 25/10, sobre la #36: «en muchas secciones hay como una separación, no entiendo por que» y «toda esta sección en
blanco, realmente copiaste muy mal a las landing de MaKo... Eso significa que no funciona bien el editor web».

**El recorrido (las 23 landings: las 9 publicadas desde su borrador, las 14 nuevas desde el generador), dibujadas como el
editor en Chrome sin ventana, y la publicada en hola-mako.site:**

| Landing | Lo que se veía mal en el editor | En hola-mako.site |
|---|---|---|
| #32 a #40 (las 9 publicadas) | franja de 255 px debajo del encabezado; de 230 px al final; de ~26 px en «¿Qué es MaKo…»; **la caja blanca de 700 px** en «Sé uno de los primeros» (la agenda); el VSL de Panda, una caja negra | bien: la agenda de Calendly y el video cargan, sin franjas |
| Las 14 nuevas (2 portadas y 12 por funcionalidad o avatar) | franja de 255 px debajo del encabezado, de 19 px en «Tu IA, al costo» y de 64 px al final | no están publicadas |

Después del arreglo, el mismo recorrido: **nada raro en las 23** (ni franjas, ni cajas vacías, ni contenido recortado).

- **Las franjas: el alto salía del `scrollHeight` del DOCUMENTO del iframe, que nunca es menor que la ventana del iframe.** Una
  sección arrancaba en 320 px y no bajaba nunca (el encabezado mide 65 px: 255 px de gris), y una que se achicaba al cargar sus
  fuentes dejaba la diferencia. **Regla:** el alto de un iframe se mide por su CONTENIDO (la caja de la raíz, con `flow-root` para
  que los márgenes queden adentro, más lo que se sale), nunca por el `scrollHeight` de su documento.
- **La caja blanca era la agenda** (`#cal-embed[data-calendly]`): una caja de 700 px que en hola-mako.site llena el script del
  diseño (SCRIPT_DISENO) con Calendly, y en hola-mako.com Landing.tsx cambia por las columnas de precios. El editor no corre
  scripts: quedaba en blanco. **El VSL** (el iframe de Panda) adentro de un iframe sin scripts es una caja negra.
- **El arreglo, sólo del editor y sin tocar el contenido** (lib/editor-landing/vista-embeds.ts): una ficha que dice qué es (su
  ícono, «Agenda de Calendly» o «Video de Panda», su enlace) y se cambia con el control «Video» (pegando el enlace; la agenda
  guarda la página de Calendly sin la query del embed). La ficha va marcada y `leer` la saca al guardar; el saneo del server
  borra igual cualquier `srcdoc`.

Lo que quedó SIN hacer:
- Probarlo con clics en producción, a 1280 y 1440, cuando despliegue (sobre una copia).
- En hola-mako.com la agenda de las 9 publicadas se ve como columnas de precios y en hola-mako.site como Calendly: dos cosas
  distintas para la misma página. Que diga lo mismo en las dos es una decisión de Martín (las 12 nuevas ya traen las columnas).

## Una regla de CSS fijada por DOS tests: arreglar uno y correr sólo ese deja el otro roto (25/10/2026, claude5)

El arreglo de la barra a 1280 (`8a1fb5af9`, el título de `flex: 0 0 auto` a `0 1 auto`) se probó con
tests/editor-web-ui-25-10.test.ts, que lo pide. Pero tests/editor-web-como-automations.test.ts fijaba la regla vieja
TEXTUAL y quedó rojo hasta el commit siguiente: nadie lo corrió porque «no era de la barra».

**Regla:** antes de cambiar una regla de CSS o un trozo de JSX que un test lee como texto, buscar el texto viejo en
`tests/` (`grep -rn "flex: 0 0 auto" tests`) y correr TODOS los que lo nombran, no sólo el del arreglo.

## El color de fondo de una sección de las páginas de MaKo: el menú lo ofrecía y no hacía nada (25/10/2026, claude5)

Martín, 25/10: «tampoco puedo editar el color del bg de cada sección». El menú de la sección (⋮ y clic derecho) ya decía
«Cambiar el color de fondo»: abría el panel de estilo y guardaba `fondo`/`fondoColor` en la TARJETA. **En una sección de
«Diseño editable» eso no llega a ningún lado:** se publica a sangre, su HTML tal cual (render.ts), y en el editor el iframe
tapa el fondo de la tarjeta. No daba error: no cambiaba nada.

**De dónde sale el fondo que se ve (medido en la #32 y en las 14 nuevas):** del `style` de la raíz
(`<section style="background:#F5F7FA">`); de una clase de la hoja (`.mkv-sec-gris`); de una regla con `!important`
(`.gm-libre #beta`, que le gana al `style` de la raíz); o de nada, porque la raíz es una columna de 1080-1120 px centrada y se
ve el fondo de la página (el hero, «¿Qué es MaKo?» y «Cómo funciona» de la #32).

**Y entre secciones hay MÁRGENES** (`margin-top`: 96 px en «historia», 40 px en «para quién» y en «beta» de la #32). Muestran
el fondo de la página. Con el color en la raíz, el margen quedaba afuera de lo pintado: pintado el hero, aparecía una franja
blanca de 96 px, justo la «separación» de la que se quejó Martín.

**El arreglo (lib/editor-landing/fondo-de-diseno.ts), en el HTML, que es lo que se publica:**
- Cada sección pintada va en una envoltura de ancho completo:
  `<div data-gm-fondo data-gm-envoltura style="background:…;display:flow-root">`. **`flow-root` deja los márgenes de la raíz
  ADENTRO**, así dos secciones pintadas se tocan sin franja. Sin pintar, nada cambia.
- **El margen NO se pasó a padding.** Las 14 nuevas cambian su padding por pantalla con `@media`, y un padding escrito en el
  `style` lo pisaría en el celular.
- Si la raíz trae fondo propio, se suma `background:transparent !important` AL FINAL de su `style` (marca
  `data-gm-fondo="transparent"`). Un `style` con `!important` gana también a la regla `!important` de la hoja.
- **Una raya de arriba con margen arriba quedaba flotando 96 px adentro de lo pintado** (el `border-top` de «historia», que
  marcaba dónde empezaba): se hace transparente (`data-gm-sin-borde`). Sin margen, la raya sigue en el borde y se queda.
- Lo que traía queda escrito, y el `;` que separa lo agregado es siempre uno nuevo: «Del diseño» vuelve byte por byte (las 9
  de la #32, y un `style` que ya terminaba en `;`).
- **El encabezado pegajoso nunca se envuelve:** adentro de una caja de su mismo alto deja de pegarse. Su color va al `style`.
- Medido en Chrome sin ventana, a 1280 y 1440, y en el editor: lo pintado se toca en las 4 uniones, el contenido no se mueve
  un píxel y el encabezado sigue pegado. En el editor, los 96 px de arriba de «historia» son del color.
- **Trampa de la medición:** el pie «se movía» 58 px entre corridas, para un lado o para el otro. Era el alto de
  «testimonios», que depende de qué imágenes cargaron. Medir después de cargarlas todas (`loading="eager"`, `onload`, las
  fuentes listas), no con una espera fija.

**Regla:** en una sección de diseño, todo lo que se cambie tiene que ir a su HTML. Un atributo de la tarjeta (ancho,
acento, alto, fondo) no llega a lo publicado: el panel ahora es sólo «Color de sección», y la API dice que lo demás no aplica.

Lo que quedó SIN hacer:
- Pintada una sección cuya VECINA de abajo no está pintada, el margen de la vecina sigue con el color de la página: es de
  ella, y el diseño lo puso así. Se ve si se pinta el hero y no «historia».
- Probarlo con clics en producción cuando despliegue, sobre una copia.

## El cierre de las landings de MaKo con los planes y la prueba gratis (26/10/2026, claude5)

Martín (26/10 01:23), a «¿el bloque de cierre muestra los planes con la prueba gratis o la agenda para una llamada?»:
«Los planes con la prueba gratis». `cierre()` (scripts/landings-mako-v2.mts) es UNO para las dos portadas y las doce de
`scripts/landings-mako-v2-funnels.mts`: ahora dibuja las tarjetas de los planes activos, con el molde de /planes
(app/planes/Tarjetas.tsx). Pro va destacado porque así lo dice el plan, y cada botón «Empezar mis 7 días gratis» lleva a
`/planes/<plan>?landing=<slug>`. La llamada queda como un link chico debajo.

- **Un botón `inline-flex` se come los espacios.** `.mkv-btn` es `display: inline-flex`. Con texto suelto y una marca
  adentro (`Empezar mis <span data-mako-prueba="dias">7</span> días`), cada pedazo queda como un elemento aparte y el
  espacio entre ellos desaparece: se leía «Empezar mis7días gratis». **Regla:** en un botón flex, el texto con marcas va
  envuelto en UN `<span>`, como `data-mako-prueba="boton"` de la portada. El test fija el `<span>` y la foto lo muestra.
- **El texto del botón no es el de la marca `boton`.** `botonDePrueba` dice «Empieza tus 7 días gratis» y hola-mako.com
  lo pisa en cada `data-mako-prueba="boton"`. El cierre pide «Empezar mis…», así que va con la marca `dias` adentro de su
  propia frase. Si fuera con `boton`, en producción saldría otro texto que el de la vista previa.
- **El cierre NO es el lugar de las columnas.** `data-mako-planes` tiene que estar una sola vez por página, porque
  hola-mako.com pone ahí las columnas de Planes. El cierre arma sus tarjetas en el HTML, con el precio por marca
  (`data-mako-precio`). Por eso se ven igual en la vista previa suelta y en producción.
- **La vista previa suelta no es la página entera.** Los `.html` de `--salida` no corren app/vsl/Landing.tsx. La franja
  oscura de precios (`#planes`) muestra su respaldo, no las columnas de Planes. El cierre sí se ve como saldrá.

Lo que quedó SIN hacer:
- **Si Martín quiere WhatsApp en el link de abajo.** MaKo no tiene agenda en sus landings (Martín sacó Calendly el 24/10),
  y su número es el de los grupos de los clientes: no se publica sin su sí. Por eso el link dice «¿Prefieres hablar antes?
  Déjanos tus datos y te escribimos» y `hablarAntes()` lleva al pedido que ya existe, el del Acelerador (el Cerebro, 26/10).
  Se cambia en ese único lugar.
- **Publicar.** Espera el sí de Martín, después de ver las vistas previas (`--subir`, en producción).

## El editor web de punta a punta con las páginas de MaKo: lo que un iframe sin scripts no deja ver (26/10/2026, claude5)

Martín pidió probar el editor de punta a punta y listó siete cosas: el menú del clic derecho que no se cierra, la barra
de texto gris, los botones, las secciones que no se acomodan, el video, los botones flotantes que se van, la animación de
MaKo y el Calendly. Se reprodujeron en producción sobre una COPIA de la landing principal (#44) y sobre una creada desde
cero (#45, plantilla sin IA). Casi todo tenía la misma raíz: cada sección de MaKo es un «Diseño editable», un iframe
`sandbox="allow-same-origin"` SIN scripts.

- **Un clic adentro de un diseño no existe para la página.** Los menús y paneles se cierran con un `pointerdown` en el
  `document` de la página, y el clic pasa en el documento del iframe. Como en una landing de MaKo casi todo «otro lado»
  es otro iframe, el menú no se cerraba nunca. El diseño reenvía su `pointerdown` al marco, igual que ya hacía con el
  clic derecho. **Regla:** un panel nuevo se cierra con `pointerdown` en captura. AskAgent usaba `mousedown` y no se
  enteraba.
- **El sandbox se HEREDA.** Un iframe de Panda o de Calendly ADENTRO del diseño tampoco puede correr scripts, aunque lleve
  su propio `sandbox` abierto. Por eso se veía la ficha y no el video. Lo real va en una capa ENCIMA de su lugar, en la
  página, con el `sandbox` de los insertados. Medido: el reproductor de Panda carga ahí. La capa no recibe el mouse hasta
  que se elige el elemento, así el primer clic elige y el segundo ya es del reproductor.
- **El diagnóstico obvio era el equivocado (los botones).** Se pensaba que el texto de un botón de diseño no se podía
  escribir: medido, sí se podía (el `<a>` es editable adentro del `contentEditable`). Lo que faltaba era un control: al
  elegirlo sólo aparecía «Enlace», un ícono chico, y nada para sus colores. Ahora aparece «Botón» con su nombre a la vista:
  texto, a dónde lleva y los dos colores. El color va con `!important`, porque la hoja de un diseño lo escribe así
  (`.mkv-btn { color: #fff !important }`) y un estilo sin él no gana. En una landing creada desde cero el botón ya andaba.
- **«El SVG de MaKo» es un canvas que dibuja un script** (`/vsl-assets/mako-anim.js`). **El diagnóstico obvio era el
  equivocado:** la primera versión cargaba el dibujante en la página y pintaba en el canvas DEL IFRAME, que es del mismo
  origen. En producción el canvas tenía el dibujo (17.143 píxeles opacos) y la pantalla lo mostraba en blanco. Medido en
  Chrome sin ventana: un iframe con `sandbox` sin `allow-scripts` NO presenta lo que se le pinta desde afuera; el mismo
  iframe sin `sandbox`, sí. Ahora la red va como el video: un canvas de LA PÁGINA encima del lugar del canvas del diseño
  (`vivos`, tipo `red`), y se pinta ése, sólo mientras se ve. El `width`/`height` que una versión vieja pudo dejar en
  el canvas del diseño se saca antes de guardar.
- **Una captura de la pestaña con el panel del navegador OCULTO no prueba lo de adentro de un iframe**: una página de
  fondo no repinta (Calendly cargó, con 4 subframes, y la captura lo mostraba negro). Para una prueba visual, el panel a la
  vista, o un Chrome sin ventana con la misma estructura.
- **La barra «Texto» quedaba gris porque lee la selección de ProseMirror**, y el cursor de un diseño está en su iframe.
  `puente-diseno.ts` le dice qué documento tiene el cursor, y `acciones-diseno.ts` hace ahí lo mismo con
  `execCommand`. Medido: funciona con el foco en el botón de la barra, y «deshacer» del iframe lo vuelve atrás. Los
  estilos que no son una etiqueta HTML (antetítulo, grande, pequeño, tareas) y la etiqueta no se ofrecen en un diseño.
- **Arrastrar por la mitad de la sección no sirve con secciones de 2.000 px.** «Mover arriba/abajo» del menú andaba. El
  arrastre del ⋮ no movía nada, porque la mitad de la sección vecina quedaba unos 900 px fuera de la pantalla. Mientras se
  arrastra, cada sección se ve como una franja de 132 px (`body[data-gm-reordenando]`): entran todas y se suelta donde
  se ve. Medido en producción: la franja de un diseño es casi siempre su margen de arriba, en blanco, así que cada una
  lleva el nombre de su sección encima (`data-rotulo`, el primer h1–h3 de su HTML: `rotuloDeSeccion`).
- **Controles que se van con el hover:** la barrita del diseño estaba 12 px por arriba y se iba con el `mouseleave` al
  cruzar ese aire. Ahora se queda mientras su diseño es el activo y va pegada arriba de lo que se ve (un ancla `sticky`
  de alto 0, que no mueve nada). El ⋮ de la sección también va `sticky` y tarda medio segundo en irse. `pointer-events`
  no tiene transición; `visibility` sí, con retardo, y mientras se ve se puede apretar.
- **Tests que fijaban nombres:** `setActivo(true)` en el `mousedown`, `boton('Enlace'…)` y el `className` de la
  barrita. Se respetaron los nombres; sólo se cambió la activación, que ahora es el puente.
- **El test nuevo pasaba acá y caía en el tren:** leía los fuentes sin normalizar el fin de línea y buscaba `\n`. En este
  worktree los archivos estaban en LF; en wt-push-q (`core.autocrlf=true`) llegan en CRLF. La regla ya estaba en
  AGENTS.md («Fin de línea»): todo `readFileSync` de un fuente va con `.replace(/\r\n/g, '\n')`. **Cómo se prueba:**
  pasar a CRLF los fuentes que lee el test y correrlo (`probar-crlf.mjs` del scratchpad). Con la lectura vieja daba 7/1;
  con la normalizada, 8/8.

**El analizador y «Replicar», con una de la competencia (100ads.ai).** El análisis dejó 2 comentarios. «Aplicar» replicó
la página (#46), pasó los comentarios y aplicó el que tenía sección: el documento cambió de verdad. Lo que falló:
- **Un comentario SIN sección no tenía «Aplicar».** Su cita estaba en el título de la pestaña (el del voseo), así que no
  se ubicó en ninguna sección. No tenía botón ni en la pantalla ni en la API, y el aplicado automático de la copia
  terminaba en «No ubiqué esa sección». Ahora se aplica a TODA la página de inicio: `editar` con alcance `landing`,
  que cambia sólo las secciones que el comentario toca. «Aplicar todos» los suma al final.
- **La réplica dejaba los botones como texto.** Medido en los logs: la IA del negocio no contestó a tiempo (17 de 20
  secciones sin IA). Ese paso no es de esta área: se le avisó al Cerebro. El respaldo (`tarjetaDesdeEsquema`) volcaba
  cada renglón en una viñeta, con las marcas del lector escritas («[BOTÓN] Ver todo lo que incluye»). Ahora
  `[BOTÓN] texto → destino` es un botón (hasta 3 en la fila) y `[DESPLEGABLE] pregunta → respuesta` es un
  desplegable. Un destino en palabras queda `#`: no se inventa una dirección. Sin marcas sigue igual (uno es un
  párrafo, varios son viñetas), porque lo usa también `agregar_seccion_landing`.
- **«Aplicar» con la IA cayéndose escribió «[BOTÓN] Quiero ver la demo gratis» como texto.** Lo copió de la sección,
  que ya tenía esas marcas. Con el respaldo nuevo, la sección trae botones de verdad.
- **Las descripciones de la API se ACORTARON** (−33 en landing.def.ts) para decir «sin sección, toca la landing entera»:
  el presupuesto del turno de la app tiene 38 caracteres de margen (más arriba, «El presupuesto del turno de la app»).

Lo que quedó SIN hacer (en este documento cuando se haga):
- Los clics en producción de todo esto, cuando se despliegue la punta (sobre la copia #44 y la #45; la réplica #46).
- Que la IA del editor de landings del ws9 no corra en Gemini (saturado y con timeouts el 26/10): es del área de IA.

## Lo que se veía bien en el editor y se perdía al GUARDAR un diseño (26/10/2026, claude5)

La revisión adversarial de tren-l lo encontró en lo nuevo de la barra «Texto» y de «Botón» en los diseños. Se veía bien
en el editor, pero el HTML de un diseño pasa por el saneo del server (html-editable-seguro.ts) al guardar, al abrir y al
publicar, y tres cosas se iban sin aviso:

- **`execCommand` sin `styleWithCSS` escribe etiquetas VIEJAS.** El tachado sale `<strike>` y un color, `<font
  color>`. La lista blanca del saneo no las tenía y su modo es `discard`: se va la etiqueta, queda el texto y el formato
  se pierde. **Regla:** antes de un formato con `execCommand`, `styleWithCSS` en `true` (sale un `span` con estilo);
  y el saneo pasa `strike`/`del` a `s` y `font color` a `span` con su color. Eso cubre también lo ya guardado y
  lo pegado.
- **Un enlace «a otra página» (`pagina:<id>`) se borraba**, porque `pagina` no era un esquema permitido. Y aunque pasara,
  el HTML de un diseño se publica TAL CUAL: `resolverHref` corría sólo en los botones de bloque. Ahora el esquema se acepta
  en `<a>` con un id válido, y al publicar `conEnlacesDePaginas` (html-editable.ts, desde render.ts y especificacion.ts)
  lo cambia por la dirección de la página, o por `#` si ya no existe.
- **Un precio con formato quedaba congelado.** La marca (`data-mako-precio`, `data-mako-desde`, `data-mako-prueba`) se
  reconocía sólo con texto plano adentro (`[^<]*`). Una negrita encima la dejaba con el precio del día de publicar, aunque
  cambiara en Planes. Ahora se reemplaza sólo el texto y las etiquetas de formato quedan. Con formato sobre una PARTE, el
  número va al primer pedazo. Esto arregla también lo ya publicado con negrita o cursiva.

Test: tests/editor-web-guardado-diseno-26-10.test.ts (probado rompiéndolo: 6 roturas, cada una 2/1).

## Lo que se edita a mano, también por prompt: lo que faltaba y por qué no llegaba (27/10/2026, claude5)

Martín (27/10): «si una persona quiere editar lo que sea debería poder. Con prompts en mako». Se cruzó cada control del
editor con el comando de la API que lo cambia. La tabla está en docs/relevo/landing-generator.md. Faltaban tres:

- **El formato de un texto.** La barra «Texto» (negrita, cursiva, subrayado, tachado, color, tamaño, alineación) no tenía
  comando. Ahora está `dar_formato_texto_landing`.
- **Los colores de un botón de diseño.** Ahora `configurar_boton_landing` acepta `color` y `colorTexto`.
- **La imagen de un bloque y la de un ítem de un «diseño optimizado».** `cambiar_imagen_landing` sólo encontraba las de
  un «Diseño editable». Para cambiar las otras había que agregar una imagen nueva y borrar la vieja. Ahora
  `ver_secciones_landing` da la dirección de cada imagen de bloque, para poder nombrarla.

Las trampas:

- **Un bloque y un diseño no tienen los mismos colores.** Un bloque usa los del tema (`acento`, `paleta-1`…), y un
  botón de bloque elige su `estilo`. Un diseño trae su propia hoja: ahí un color del tema no existe y el color va en hex.
  Cada lado rechaza lo del otro y dice por qué. El color de un botón de diseño se escribe con `!important` en su `style`.
  `conDeclaracion` (html-editable-elementos.ts) reemplaza la declaración; no la apila.
- **El tamaño en un diseño no es el de un bloque.** Los escalones de la barra en un diseño (`TAM_EN_DISENO`,
  app/web-generator/editor/acciones-diseno.ts: l 1.125em, xl 1.375em) son distintos de los de un bloque (css.ts: l 1.25em,
  xl 1.5em). La API copia los del diseño en `TAM_DISENO` (landing-contenido.helpers.ts), porque lib no importa de app.
  Si cambia uno, hay que cambiar el otro.
- **El diagnóstico obvio era el presupuesto, y al principio no lo era.** «pon en negrita «Aprende a vender» en mi
  landing» llegaba por WhatsApp sin la herramienta. El clasificador lo leía como `pensar`: la frase citada dejaba
  «landing» a más de 3 palabras del verbo, y «negrita» no era una pieza de la landing. Ahora son piezas (negrita, cursiva,
  subrayado, tachado, alineación, tamaño, letra). Y un verbo de formato (subrayá, tachá, centrá, resaltá, alineá) cuenta
  con la landing nombrada.
- **Después sí era el presupuesto.** Las palabras del formato estaban sólo en la descripción, que suma 1 punto. Así
  empataba con una docena de operaciones declaradas antes y quedaba afuera. Ahora van en el título (2 puntos):
  «Negrita, cursiva, subrayado, tachado o centrado». Ver docs/hallazgos-api-mako.md → «El presupuesto del turno de la app».
- **Lo citado es texto de la landing.** «subrayá «Agenda tu llamada»» se cortaba por «llamada», una palabra de otra área
  (las llamadas). Con un verbo de formato, lo citado se saca antes de buscar otra área (`sinCitas`, lib/mako-intencion.ts).

Tests:
- tests/api-mako-landing-contenido.test.ts
- tests/api-mako-landing-diseno-editable.test.ts
- tests/mako-intencion-landing.test.ts

Probados rompiéndolos, una falla por vez: cada rotura la atrapa su test.

Sin hacer:
- **La red de MaKo.** Es el dibujo animado de una sección de las páginas de MaKo. No se cambia ni a mano ni por prompt,
  porque es parte del diseño. El efecto de entrada de su sección sí: `cambiar_animacion_landing`.
- **La prueba por prompt en producción.** Espera el deploy de esta punta.

## «Replicar y adaptar»: el diseño de afuera con el texto del negocio, y la réplica con animaciones (27/10/2026, claude5)

Leila, en la llamada (ticket 876470842-27): «Replicar y adaptar». Ya existía «Replica esta landing», con el texto de la
original. Ahora el cuadro de crear tiene las dos opciones en la pastilla del link, y el panel «Replicar landing» también
(«Tal cual» y «Adaptada a tu oferta»). Por prompt: `replicar_landing` con `adaptar`.

- **Cómo adapta sin tocar el diseño.** En «Landing», el esquema sigue en «Conservar»: salen las mismas secciones en el
  mismo orden, y el estilo y las imágenes de la original se ponen igual que siempre. La que reescribe es la tanda de
  secciones, con `modoTexto: 'generar'` y `INSTRUCCION_ADAPTAR` (replicar-reglas.ts). El contexto del negocio ya
  viajaba en cada tanda (`buildLandingBrief`). En «Presentación», la instrucción va en las dos tandas.
- **Trampa: la sección que no pasa por la IA queda con el texto de la OTRA.** La réplica sin IA usa el texto de la
  original (`tarjetaDesdeEsquema`). En una copia «tal cual» eso está bien. En una adaptada es el texto del competidor
  dentro de la landing del negocio. El aviso lo dice con esas palabras («quedó con el texto de la original: adáptala con
  MaKo»), no con el «quedó sin diseño» de siempre.
- La copia adaptada se llama «Adaptada de <dominio>», no con el título del competidor. La «Página web» (la copia
  idéntica) no se adapta: el server contesta con `probar: 'landing'`, y la pantalla no ofrece ese formato con adaptar.

**La réplica de una landing con animaciones (ticket 876825880-07): el diagnóstico obvio era el equivocado.** «La copia
fiel saca los scripts» no es cierto. `sinRastreadores` (replicar-reglas.ts) saca sólo los rastreadores conocidos
(`RE_RASTREADOR`), y los demás scripts viajan a la copia. Lo que sí no corre es lo atado al scroll de la página, y eso
ya lo avisa `AVISO_SCROLL`. **Sin medir:** sendipro.com, la página del ticket, no existe en el DNS (ENOTFOUND, con y
sin www, medido el 27/10), y una búsqueda tampoco la encuentra. Falta la dirección exacta para ver qué no se copió.

Tests: tests/web-generator-replicar-adaptar.test.ts y tests/editor-landing-replicar.test.ts. Probados rompiéndolos.

## Replicar por partes: diseño, estructura, ángulos y texto, y la estructura que perdía secciones (28/10/2026, claude4)

Martín: «una cosa es replicar el branding, otra cosa es replicar la estructura, otra cosa es replicar los ángulos de
comunicación, los copies». «Replicar landing» lee primero la página y muestra su estructura, sus ángulos y su diseño.
Después pregunta QUÉ replicar con cuatro partes combinables: Diseño · Estructura · Ángulos · Texto literal. El default es
el caso de Martín: estructura + ángulos, con SU tema y el texto escrito para SU oferta. Vive en
`lib/editor-landing/replicar-partes.ts` (las reglas), `replicar-estructura.ts`, `replicar-angulos.ts`,
`replicar-lectura.ts` (POST `/api/landing-generator/replicar/leer`) y `app/web-generator/crear/Replicar.tsx`.

- **El diagnóstico obvio era el equivocado: «la réplica tiene las mismas secciones» no era cierto en una landing larga.**
  «Conservar» (`esquemaConservado`, el de «Pegar texto») cortaba en CADA `#`, `##` y `###` y se quedaba con las primeras
  20 (`MAX_SECCIONES`), sin avisar. Medido el 28/10 con el HTML real y el respaldo sin IA: 100ads.ai llegaba con 965 de
  2.148 palabras (45%), 3 de 8 botones y SIN la garantía, las preguntas ni el cierre; gohighlevel 79%, kommo 68%,
  hotmart 83%, leadsales 90%. Y cada tarjeta de una grilla (un `###` adentro de un `##`) salía como sección suelta.
  **Regla:** una página LEÍDA se corta en su NIVEL DE SECCIÓN (el título más alto que aparece dos veces; un h1 solo es
  el hero), lo de adentro queda como subtítulo `### …`, y si sobran secciones se JUNTAN las vecinas más chicas: nunca se
  tira texto (`esquemaDeReplica`). Ahora: 100% de las palabras y de los botones en las cinco. Lo usa también «Importar»
  con «Conservar» (ia.ts); lo pegado por la persona sigue como antes.
- **El respaldo sin IA escribía el `###` como texto.** `tarjetaDesdeEsquema` ahora lo dibuja como subtítulo
  (`RE_SUBTITULO_LEIDO`, ia-reglas.ts).
- **El ws3 no tiene NINGUNA IA** (0 filas en `credenciales`), y el crédito de Claude para `landing-editor` está
  habilitado sólo en el espacio de MaKo (`CREDITO_HABILITADO_PARA`, `soloLaPlataforma`). La cascada barata de la
  plataforma no contestó. En el ws3 sólo se puede medir lo que no usa IA: la lectura de la estructura y del diseño, y la
  réplica «texto literal» con el respaldo. Los ángulos y la reescritura necesitan otro negocio con IA.
- **Medir desde un script, sin levantar la app:** `runWithWorkspace(3, …)` (lib/workspace.ts) fija el negocio. `crear` llama
  a `cookies()` para el autor: fuera de un pedido tira «`cookies` was called outside a request scope». En el script se
  reemplaza `next/headers` con un `Module._load` que devuelve un almacén vacío (el autor queda null). Se corre con
  `node --env-file=<.env.local> --conditions=react-server --require <stub> --import tsx`.
- **La instrucción de la réplica va con las REGLAS primero y los datos al final** (el molde de cada sección y los
  ángulos), y con el tope de `instrucciones` (5.000): si algo no entra, se recorta un dato, nunca «no copies frases».
- **Los ángulos son una lectura aparte del Landing Analyst**: el Analyst diagnostica una página PROPIA contra su tráfico
  (veredicto, puntajes, hallazgos) y guarda una fila en `landing_analyses`; para replicar hace falta CÓMO vende una página
  AJENA (promesa, dolores, forma de venta, objeciones, tipo de prueba y el ángulo de cada sección). No se guarda: viaja en
  la pantalla y vuelve con el pedido de la réplica (no se paga dos veces). Su prompt es editable
  (`landing_editor.angulos.*` en lib/prompt-registry.ts).
- **100ads.ai cambia su h1 entre una bajada y otra** («100 anuncios en lo que dura un café» / «en lo que tardás en hacer
  uno» / «Lo que te lleva horas, listo en 10 minutos»): prueba A/B de su portada. Medir dos veces la misma página puede
  dar dos títulos; la estructura no cambia.
- **El presupuesto del turno de la app:** `replicar_landing` sumó `partes` y quedó MÁS CHICA (2.464 → 2.437 caracteres,
  `scripts/presupuesto-turno-app.mts`), recortando la descripción.
- **`quitarPruebaInventada` deja pasar justo lo de la competencia** en una réplica reescrita: sus testimonios y sus
  cifras «están en el material» (el material ES la página de otro). La red en código es `quitarPruebaDeLaOriginal`
  (ia-reglas.ts): una cita TEXTUAL de la original o una cifra con sus mismos números se vacían, y las frases iguales a
  la original se cuentan en el log y en el aviso. Los números se comparan ENTEROS (ver la revisión, más abajo).
- **Mirar la pantalla sin build:** con ~10 chats, el vigía mató el `next build --debug-build-paths` de `/web-generator`
  dos veces (2,3 y 3,4 GB privados, con 0,7 GB libres). Lo que anduvo: renderizar los componentes REALES con
  `renderToStaticMarkup` (tsx, `NODE_PATH` al `node_modules` del worktree y `import React`), con las hojas del Panel
  (`CSS_GP`, `CSS_PANEL`, `CSS_TIPO`, `CSS_REPLICAR`) y los datos medidos, servirlo con `python -m http.server` en
  127.0.0.1 (un `file://` el panel del navegador lo muestra como foto y no deja medir) y medirlo a 375 px y en
  escritorio. Encontró dos cosas: la grilla de temas compartida pide 180 px por columna y en un teléfono son seis
  tarjetas altas antes de «Replicar» (en Replicar va de a dos), y un chip con `--gp-azul-50` no cambia en el modo
  oscuro (va con los tokens `activo`).

- **Un test que lee el fuente como TEXTO da verde sobre un archivo que no compila.** Un script de edición convirtió el
  `'
'` de un `.join` en un salto de línea real dentro del string, y el test de replicar (que hace `readFileSync` +
  regex) siguió en 10/10. Lo cazó `tests-afectados --rapido`, por los tests que IMPORTAN replicar.ts. **Regla:** después
  de editar con un script, transpilar cada archivo tocado (`esbuild.transformSync`); el test de replicar lo hace ahora
  (test 0). Y escribir el reemplazo con el editor, no con escapes anidados (bash → python → TS).
- **«Cómo está acomodado» con lo que ya se lee:** el estilo trae las imágenes de cada parte de la página
  (`ImagenOriginal.seccion`, `fondo`); con los subtítulos del molde alcanza para decir «una imagen junto al texto»,
  «imagen de fondo», «6 imágenes (galería o logos)» o «3 tarjetas con su subtítulo» (`acomodoDeSeccion`). Va al final
  de cada línea del molde. Sin el diseño, el estilo se lee igual, pero SÓLO para eso: nada de él pasa a la copia
  (`const estilo = partes.diseno ? estiloLeido : null`), y la IA deja el hueco de la imagen donde la otra tenía una.
- **El molde no entraba en la instrucción.** La instrucción es UNA para todas las tandas, con tope de 5.000 caracteres.
  Medido con ángulos de largo real: con 16 a 20 secciones (gohighlevel, leadsales, kommo) se cortaban las últimas líneas
  del molde y del ángulo de cada sección. **Regla:** lo que es de UNA sección viaja CON la sección. `SeccionEsquema.nota`
  (opcional, ≤ 400) lleva su ángulo, su forma y su acomodo, y `pedidoDeTanda` la escribe junto a su título. Así cada
  tanda manda sólo las suyas. Sin nota, el pedido es el de siempre (todos los demás usos del editor).
- **Otro tope que corta callado:** `esquemaDelPedido` deja 60 renglones por sección (`slice(0, 60)`), y la tanda pasa
  por ahí. Ninguna sección de las cinco medidas pasa de 46. Pero `juntarHasta` puede armar una más larga al juntar
  vecinas en una página de muchas secciones: ahí la IA no vería el final de esa sección (el respaldo sí).
- **El Diagnóstico de una de afuera copiaba todo directo** (el menú «Replicar» con los tres formatos). Ahora el menú
  arranca con «Elegir qué replicar…», que abre «Replicar landing» con esa página: la lee y pregunta las partes. Los
  formatos directos quedan como «copia completa».

### Las 5 landings de Martín (28/10/2026, noche): Reportei, Holo, MasterAds, Closermood y respond.io

- **El diagnóstico obvio era el equivocado otra vez: no era el prompt, era la OFERTA.** Con IA (ws9, el espacio de MaKo)
  la réplica «adaptada» seguía hablando de la competencia: Reportei quedó nombrada 11 veces en su copia, respond.io 22,
  y 15 a 28 frases quedaban iguales a la original. El perfil del negocio del ws9 está VACÍO
  (`buildLandingBrief` → «PERFIL DEL NEGOCIO» sin nada): la IA no tenía de qué hablar y volvía sobre lo único que tenía.
  **Regla:** reescribir «para tu oferta» exige la oferta. La lectura dice si el negocio la tiene (`tieneOferta`), el
  panel pide «Tu oferta» (y avisa si el perfil está vacío), la instrucción la pone PRIMERO como la que manda y nombra la
  marca de la referencia para que no aparezca (`marcaDeUrl`), y las menciones que queden se cuentan y se dicen
  (`mencionesDe`).
- **Un `<header>` fijo es la barra del sitio, aunque no tenga `<nav>`.** respond.io tiene su megamenú y el selector de
  idiomas en `<header class="fixed …">`: entraban ~80 renglones a la primera sección. El extractor lo trata como un
  `<nav>` (sus botones pasan). En las otras 11 páginas medidas no cambió nada.
- **Letras dobles de una animación:** tryholo.ai escribe cada letra dos veces («a a d d s s»); `sinLetrasDobles` las junta
  (dos pares o más de letras sueltas iguales).
- **Un testimonio entero en un `h3`** (reportei): el respaldo cortaba el subtítulo en 120 caracteres (el tope de un título
  de sección) y se perdían 124 palabras. Va con el tope de un texto.
- **El destino de un botón no es texto:** el lector del navegador escribe «[BOTÓN] Crear mi cuenta → envía el formulario»;
  `palabrasDe` lo contaba como palabras de la original.
- **Leer una página con el lector de la app SIN la app:** `scriptLector(id, 'pixel', origen)` corre en la página real si
  `window.opener` es la propia ventana (el saludo y el «dale» van y vienen ahí). El navegador del panel no deja que una
  página pública le pida algo a 127.0.0.1, así que se corre en un Chrome sin ventana por CDP (Node 24 trae WebSocket;
  `--headless=new --mute-audio`). Script: notas del Cerebro, `replicar-landings-scripts/leer-cdp.mts`.
- **Server o navegador:** en reportei y respond.io el lector del navegador anota cada link y cada pestaña como botón (167 y
  71); el server da una estructura más limpia. El orden de la app (server primero, navegador si no puede) es el correcto.
  MasterAds (una app que se arma en el navegador) sólo se lee en el navegador: 7 secciones, 431 palabras.
- **Réplica «texto literal» con su tema, en el ws3 (#49 a #53):** Reportei 16/16 secciones · 39/39 títulos · 68/68 textos ·
  8/8 botones; Holo 12/12 · 20/20 · 223/224 · 3/3; MasterAds 7/7 · 19/19 · 72/72 · 11/11; Closermood 8/8 · 21/21 · 79/79 ·
  6/6; respond.io 8/8 · 26/26 · 82/82 · 3/3. El 100% de las palabras en las cinco (con los dos arreglos de arriba).
- **Con «Tu oferta» (la de MaKo, en las palabras de su landing principal), en el ws9, #60 a #64**, antes → ahora:
  menciones de la otra marca Reportei 11→3, respond.io 22→1, Closermood 4→0, Holo 2→0, MasterAds 2→0; frases iguales
  a la original Reportei 27→9, Closermood 28→0, MasterAds 15→1. Las secciones, todas y en su orden (16, 12, 7, 8, 8).
  El largo se respeta peor donde la página tiene decenas de renglones cortos (carruseles, sugerencias de un chat): Holo
  53% y respond.io 65% de las palabras; MasterAds 140%. La forma de cada sección viaja en su nota; la IA (Gemini Flash
  Lite) la sigue mejor en secciones de texto que en listas largas.
- **Mirar una réplica sin la app:** `htmlDePagina` (render.ts) + `documentoExportable` (exportar-html.ts) son puros: con el
  documento y el tema de la base dan la página como la publicaría MaKo. Servida en 127.0.0.1, se mide a 375 px y en
  escritorio en el navegador del panel.
- **En la app (build parcial + `next start`, sesión del ws3 firmada con `crearToken`):** el link de la caja abre la lectura
  sola, «Qué replicar» arranca en el caso de Martín, y al replicar se ve armarse: las fases con su tilde, un punto por
  sección y la lista que crece de a una (con el ws3 sin IA, las 8 secciones llegaron juntas a los 25 s y se mostraron en
  1,6 s), y después se abre la copia. **Un bug que sólo se vio ahí:** arrancaba con las cuatro partes prendidas, porque
  `partesDePedido(null)` es «todas» (el pedido viejo de la API) y el `?? PARTES_INICIALES` nunca entraba.
- **Trampas del build parcial:** en `--debug-build-paths`, `[id]` es un patrón de caracteres (no matchea la carpeta
  `[id]`) y la ruta no entra; con `app/web-generator/**` entra (pide ~4 GB: el vigía lo mató a los 3,1 con la máquina
  llena, y anduvo en 97 s con la RAM reservada por el Cerebro). **Y aun compilada, una ruta DINÁMICA da 404:** el
  `routes-manifest.json` de un build parcial sale sin `dynamicRoutes`. Para mirarla en local se agrega a mano
  (`{ page: '/web-generator/[id]', regex, routeKeys: { nxtPid }, namedRegex }`) y se reinicia `next start`. Con eso la copia
  replicada abrió en el editor: 8 secciones, 8 títulos, `contenteditable` y con foco.
  La cookie de la sesión se pone desde una página de 127.0.0.1 en OTRO puerto (las cookies no miran el puerto), sin pasar
  el token por ninguna herramienta.
- **El gasto de IA de una réplica en el ws9: US$0.** Gemini Flash Lite con las claves gratis del negocio: entre 4 y 11
  llamadas y 22 a 47 mil tokens por landing. La lectura de ángulos tardó 55 s porque Gemini estaba saturada.

### La revisión adversarial de 45a8e5234 (Cerebro, 28/10/2026): siete defectos, todos arreglados

Informe: `C:/dev/revisiones/2810-replicar-45a8e5234.md`. Cada uno con su test (10a a 10d) y su rotura (R16 a R27).

- **El tope en el lugar equivocado colapsaba la página entera.** `nivelDeSeccion` bajaba de h1 a h2 «mientras no pase
  del tope de 20». Una página con un h1 en el hero y otro en el cierre (Webflow, Framer) y 19 h2 o más quedaba en DOS
  secciones, la primera con todo adentro; con 1 h1 y los mismos 20 h2 daba 20. **Regla:** el nivel de corte no mira el
  tope. Lo que sobra lo junta `juntarHasta`, que ya estaba para eso. Un tope que decide QUÉ nivel usar en vez de cuánto
  juntar convierte «una sección de más» en «18 secciones de menos».
- **Comparar números como texto vacía cifras propias.** `quitarPruebaDeLaOriginal` buscaba cada número con `includes`
  sobre la página ajena: «100%» del negocio se vaciaba porque «100» está dentro de «2.100», y «24/7» porque «24» y «7»
  están en cualquier página. Y el aviso le echaba la culpa a la original. **Regla:** los números van como tokens enteros
  («2.100» es 2100, con límites a los dos lados). Una cifra es de la otra si TODOS sus números están entre los de la
  otra, y al menos uno tiene 3 cifras o más y no es redondo (100, 1000).
- **Los botones de la copia mandaban a la competencia.** Venía de antes de esta rama: «Replicar y adaptar» ya lo hacía.
  Ahora es el camino por defecto, y el destino no se ve en el texto del editor. La IA veía «[BOTÓN] Probar → https://
  app.competidor.com/signup» en su tanda, y el respaldo sin IA armaba el botón con ese href. **Regla:** con el texto
  escrito de nuevo, la tanda no ve los destinos (`sinDestinoDeBoton`). Todo enlace al dominio de la original, con
  cualquier subdominio (`dominioBase`), pasa a «#» en todas las tarjetas, también las de respaldo
  (`sinEnlacesALaOriginal`). Se cuenta en el aviso. Sólo se lee el destino cuando la página la lee el NAVEGADOR: el
  server escribe «[BOTÓN] texto» sin destino.
  **El dominio no alcanzaba (segunda pasada, 28/10):** su Calendly y su «wa.me/549…» no son de «competidor.com», y el
  respaldo los armaba igual. La IA, además, los ve en un renglón que no es botón: «[CALENDARIO] Calendly (https://…)».
  **Regla:** un enlace de la copia que APARECE en el texto de la original es de la competencia (`enlacesDeLaOriginal`:
  host sin www y camino, sin consulta; uno dentro del otro también cuenta, porque la IA acorta). Un host pelado
  («calendly.com») no alcanza, y lo que no estaba en la original (el Calendly del negocio) se queda. Corre sólo con las
  mismas secciones, que es cuando el esquema ES el texto de la original.
- **«Replicar y adaptar» por la API pagaba una IA más, ANTES del esquema.** Sin `partes`, el pedido viejo de adaptar
  pasa a tener ángulos. La API no trae la lectura, así que se bajaba la página y se llamaba a la IA por los ángulos (hasta
  60 s). Ese tiempo salía del plazo de las tandas: con la IA lenta, entraban menos tandas y quedaban más secciones con el
  texto de la competencia. **El diagnóstico obvio («correrlos en paralelo») no hacía falta:** con la estructura, el
  esquema no los usa, y el texto de la original ya trae los ángulos sección por sección. Ahora se leen ahí sólo SIN la
  estructura, que es cuando el esquema los necesita.
- **En una Presentación, la «original» del chequeo era el esquema que ya había escrito la IA.** Se vaciaban cifras
  propias, se contaban frases «iguales» contra texto propio, y el aviso decía «quedó con el texto de la original». Ahora
  `adaptar` (el chequeo y ese aviso) va sólo con las MISMAS secciones (Landing con estructura).
- **La lectura y la réplica cortaban distinto un texto pegado con títulos.** La lectura usaba `esquemaDeReplica` y la
  réplica el `esquemaConservado` de «Pegar». Se perdía el final, y el ángulo de la «sección 3» caía en otra sección.
  Ahora el pedido de esquema lleva `corte: 'pagina'` (ia.ts). El «Pegar texto» del editor no cambia.
- **La «Página web» de la caja pagaba ángulos al abrir y se pasaba sola a «Landing».** Ahora arranca con las cuatro
  partes, y su lectura va sin ángulos (`angulos: false` en /leer, `conAngulos` en `leerParaReplicar`). La copia
  idéntica no los usa.
- **El tsc acotado de estos archivos trae 14 errores que no son de ellos:** `app/video-editor/_opencut` no resuelve
  `opencut-wasm/opencut_wasm_bg.js` (TS7016) y de ahí salen los TS2305. Antes de creerle a un rojo del acotado, mirar si
  el archivo es tuyo.

Lo que quedó SIN hacer:
- Leer una SPA en la ventana del clic DENTRO de la app (el camino del lector con la ventana aislada): se midió el mismo
  lector por CDP (MasterAds), no el ida y vuelta de la ventana. Y la réplica con IA en vivo dentro de la app (en el ws3
  no hay IA: las secciones llegaron todas juntas al final).
- Un tope de 60 renglones por sección en `esquemaDelPedido` (la tanda): ninguna sección medida pasa de 46.
- La POSICIÓN de la imagen (a la izquierda o a la derecha) y las columnas de una grilla no se leen: el estilo guarda
  qué imágenes tiene cada parte, no dónde están. Saldría de la lectura del navegador (lector-script.ts), midiendo las
  cajas.
- De la revisión (los restos, de severidad baja): «Leer de nuevo» en Replicar.tsx vuelve a pagar los ángulos (no hay
  caché por URL, y uno guardado no reintentaría la lectura que falló). Y sin la estructura, si la lectura volvió sin
  ángulos, replicar.ts se los pide a la IA ANTES del esquema y ese tiempo sale del plazo de las tandas: ahí el esquema
  sí los necesita, y correr t0 pasaría el maxDuration de 300 s.
- Que Martín abra una copia del ws9 en PRODUCCIÓN con su sesión: el recorrido entero se vio con el build real (la #66
  abre en el editor con sus 8 secciones), pero no en hola-mako.com, donde ningún navegador de esta máquina tiene su
  sesión.

Tests: tests/web-generator-replicar-partes.test.ts (probado rompiéndolo: 31 roturas, cada una caza), y los de Replicar
que fijaban el flujo viejo (la ventana del clic ahora la usa la LECTURA, y la réplica sale de lo leído sin abrir otra).

## La copia fiel deja ciego al chat del editor, y pasarla a «Diseño editable» le saca el diseño (28/10/2026, Cerebro)

**Vive en:** `lib/editor-landing/doc.ts:333-407` · `html-editable-seguro.ts:11-13` · `ia.ts:676` · `ia-reglas.ts:692-724`

- **El síntoma:** Martín revisó la réplica de respond.io en producción: «esta horriblemente mal, no solo el diseño no se
  parece en nada, sino que tampoco los copy». Quiere primero una copia IDÉNTICA y después pedirle cambios por prompt.
- **Lo que hay que saber antes de tocarlo:**
  - la copia fiel (`htmlLibre`) es invisible para Editar y Discutir: `textoDe` devuelve '' y Discutir recibe «Sección N:
    (sin texto)». Ningún pedido por prompt puede leerla;
  - pasarla a `htmlEditable` para que se pueda editar pierde el diseño: el saneo saca `style`, `link` y `meta`, y el
    bloque se publica sin iframe. El CSS de la original tiene que ir a `config.diseno.css` (tope 200k, contra 400k de
    `htmlLibre`);
  - `quitarPruebaInventada` y `quitarPruebaDeLaOriginal` no miran el HTML de un diseño editable.
- **La regla:** la fidelidad se mide con capturas lado a lado (1440 y 390) y el diff del texto visible, ANTES de elegir el
  formato del bloque.

## El chat del Web Generator no sabía qué función de MaKo vende la landing (28/10/2026, claude4)

**Síntoma:** Martín: «hacé de esta copia la landing de los Chats». El brief de Editar y Discutir (`buildLandingBrief`,
lib/landing-writer.ts) era funnel + perfil del onboarding + 4 del RAG: «MaKo en general» (y en el ws 9 el perfil está vacío),
nada de Chats. «Discutir» además lleva la regla de lo que no existe sin ningún catálogo: podía negar una función real.
- **Lo que quedó:** en la PLATAFORMA, antes del perfil, todas las funciones en una línea (`catalogoCorto`) y la que vende ESTA
  landing entera, por id con profundidad 0 y sus vecinos aparte (`funcionEntera`), con la regla de no prometer lo que figura
  en «No hace»; el perfil pasa a ser «la marca que la vende». En un cliente el brief queda como siempre.
- **Cómo se elige la función** (`funcionQueVende`, lib/cerebro-funciones.ts): la que nombra el PEDIDO (nombre 2, alias 1,
  sin empate); si no nombra ninguna («cambia el hero»), la que la PÁGINA nombra al menos dos veces y el doble que la siguiente;
  si no, ninguna. «Landing», «página», «web» nombran lo que se edita, no el Web Generator: no cuentan.
- **Trampa:** «Tu oferta» de Replicar por partes NO se guarda en la landing (queda en el navegador). Lo que sí queda es la
  original (`config.origen.basadoEnUrl`), pero Editar no la recibe. La copia idéntica ya viaja como «Diseño editable» y su
  texto se lee (`textoDe`), así que la página de una copia de respond.io alcanza para elegir Chats.

**Sin hacer:** guardar la función en la landing (MaKo pregunta con opciones del catálogo y Martín confirma, en el mismo flujo
que el producto: `productoDelPedido`); usar la original como pista; los generadores de marketing con el mismo brief (Ads
Manager, los writers de Instagram, Email) siguen sin la función.

## La copia idéntica de una página: la foto del navegador, editable por sección (28/10/2026, claude4)

Martín (28/10, ~09:40), sobre la réplica reescrita de respond.io: «esta horriblemente mal, no solo el diseño no se parece
en nada, sino que tampoco los copy... Enfocate primero en replicar tal cual, tanto en diseño como copy y luego vemos de
personalizarlo». Replicar arranca ahora en la copia IDÉNTICA: el lector, en el navegador de la persona, saca la FOTO de la
página ya armada (copia-identica-script.ts) y el server la arma en secciones «Diseño editable» (copia-identica.ts), con
el texto palabra por palabra y en su idioma (nada pasa por una IA). Personalizar es otro paso, que todavía no existe.

**Cómo lo resuelven los que clonan, y qué se tomó.** SingleFile guarda el DOM ya armado, sin scripts, con sus hojas, y
saca las reglas que no usa nada: eso es esta copia. html.to.design y html-to-figma leen el estilo CALCULADO de cada
elemento a UN ancho: pierden las media queries (importan el teléfono aparte), las animaciones y los ::before. Por eso acá
viajan las hojas con sus media queries, y la MISMA copia se ve a 1440 y a 390.

Medido con las 5 de Martín, en un Chrome sin ventana, con la foto sacada por el lector de la app (el mismo protocolo que la
ventana), armada por las funciones del server y dibujada con el render de la página publicada (con su política). Las
capturas lado a lado y el diff del texto: `C:/dev/revisiones/replica-tal-cual/`.

| Landing | Texto a 1440 (renglones · palabras) | Texto a 390 | Alto 1440 original → copia | Alto 390 | Imágenes rotas |
|---|---|---|---|---|---|
| respond.io | 98,9 % · 93,8 % (a) | 100 % · 100 % | 7.237 → 7.237 | 10.555 → 10.555 | 0 |
| reportei.com/es | 100 % · 100 % | 100 % · 100 % | 14.039 → 11.160 (b) | 16.000+ → 14.607 | 1 → 1 (la misma) |
| tryholo.ai | 99,2 % · 99,1 % | 98,9 % · 98,3 % | 16.000+ → 16.000+ | 16.000+ → 16.000+ | 0 |
| masterads.ai/mkt/register | 81,7 % · 93,9 % (c) | 81,6 % · 93,9 % (c) | 4.849 → 4.849 | 6.790 → 6.790 | 0 |
| closermood.com | 93,9 % · 95,8 % (a) | 98,5 % · 97,8 % | 6.093 → 6.093 | 9.561 → 9.561 | 0 |

(a) un componente que rota solo (el «Capture / Convert» de respond.io, la demo de closermood) salió en otro estado en la
captura que en la foto. (b) la original tiene un hueco blanco de contenido que no había cargado. (c) las 23 opciones de
su `<select>` (el innerText las trae todas) y los placeholders de los campos.

Las trampas, en el orden en que aparecieron (cada una con su test en tests/web-generator-copia-identica.test.ts):

- **La comilla escapada de Tailwind se comía la hoja.** El lector de CSS tomaba el `\'` de `.content-\[\'\'\]` por el
  comienzo de un string y lo que seguía quedaba adentro: de la hoja de respond.io se leían 623 de unas 1.250 reglas, y la
  copia salía sin estilos. **Regla:** afuera de un string, una barra escapa lo que sigue.
- **Lo ESCAPADO es parte de la clase.** La poda tomaba el `\[` de `.\[\&\>\*\]\:p-2` por un atributo, el `\(` de
  `.max-w-\(--page-max-width\)` por un argumento, el `\#` de `.bg-\[\#0A0B14\]` por un id y el `\.` de
  `.p-\[0\.060rem\]` por otra clase, y tiraba reglas vivas: en tryholo.ai el contenedor de 1.080 px quedaba en 1.377 y
  se perdían TODOS los fondos oscuros. Y un `>` adentro de `class="[&>*]:p-2"` cortaba la etiqueta al leer las clases.
- **Un tope de cantidad que corta en silencio.** La foto de respond.io traía 120 de sus 208 hojas y la mitad de abajo
  salía desarmada (los bloques de Builder.io sin su `display:flex`, los íconos 3D volando al hero). **El diagnóstico obvio
  era el equivocado:** «el lector baja demasiado rápido y las islas no llegan a hidratarse con su `<style>`». Se le dio al
  lector una bajada lenta con la foto (250 ms por paso, 40 s de tope) y siguió en 120. Al terminar el lector la página YA
  tenía las 208: el que cortaba era `TOPES_COPIA.hojas` (120) en `sanearInstantanea`, sin avisar (Builder.io mete un
  `<style>` por bloque). Ahora el tope es 1.000 y el tamaño lo cuida `hojasTotal`. La bajada lenta quedó (sin medir que
  haga falta: a 60 ms por paso, una isla puede no alcanzar a hidratarse). **Regla:** antes de culpar a la página, contar
  lo que hay en la página y lo que llegó, en el mismo momento.
- **sanitize-html borra lo vacío que esconde.** Por defecto sólo deja vacío `alt`: un `hidden=""` y un `popover=""` se iban
  y aparecía lo escondido (el menú de idiomas de respond.io, abierto). `allowedEmptyAttributes` ahora los nombra.
- **«Nunca una ruta /api/» no era de cualquier dominio.** respond.io sirve sus imágenes desde
  `assets1-proxy.respond.io/api/v1/image/…` y `medioPermitido` las rechazaba todas. La guarda cuida que una imagen del
  editor no salga con la cookie de MaKo: sólo importa en NUESTROS dominios (`esDominioPropio`).
- **La política de la publicada sólo deja imágenes del bucket y fuentes de Google.** Una copia con las imágenes de la
  original se veía bien en el editor y ROTA publicada (125 imágenes en respond.io). Los orígenes de la copia entran en
  img-src, font-src y media-src (`origenesDeMedios`, pagina-publica.ts). Copiarlas al bucket no se pudo: el bucket
  `landing-imagenes` sólo acepta png, jpeg, webp, gif, mp4 y webm (mig 0246), ni fuentes ni SVG ni avif.
- **Un elemento propio de la página no pasa el saneo.** respond.io envuelve sus secciones en `<astro-island>` con 477 KB de
  props en UN atributo: el envoltorio no pasaba y la sección quedaba suelta. **Regla:** sin caja (`display: contents`) se
  suelta; con caja pasa a `<div>`; un atributo de más de 2.000 caracteres que no dibuja nada se va.
- **El corte del primer nivel no alcanza.** El `<main>` de respond.io (648 KB) iba en UNA sección, pasaba el tope (200 KB) y
  se vaciaba. Abrir todo lo grande, en cambio, daba en reportei.com (Elementor) 116 secciones de 1-3 KB y 15 niveles de
  envoltorio (los topes son 60 secciones y 14 envoltorios). **Regla:** lo grande se abre en sus hijos y lo chico vecino se
  junta (`juntarVecinas`, 16 KB), con tope de profundidad.
- **Los envoltorios repetidos en cada sección cambian la página.** Un `min-height:100vh` del envoltorio se repetiría por
  sección, y el `gap` del `<main>` y el `main > section` dejarían de valer. **Regla:** la página publicada los abre UNA vez
  alrededor de las secciones que los comparten, sin la caja `.gm-libre-seccion` en el medio; el editor los pone adentro del
  iframe y edita sólo lo de adentro (`data-gm-raiz`).
- **La base de Tailwind del «Diseño editable» pisa la original.** El preflight le sacaba los márgenes y los tamaños del
  navegador en los que la página se apoyaba. La copia va con `config.diseno.sinBase`.
- **La foto se traía la cara de «ya bajé» de lo fijo.** Al bajar, el header de reportei.com (Astra) pasa a
  `ast-header-sticked` y la barra de respond.io se corre: la foto, que sale después de bajar y volver, se lo traía, y en
  la copia el menú quedaba debajo del título. **Regla:** el lector anota la cara de cada elemento ANTES de bajar
  (`JS_ANTES_DE_BAJAR`); lo fijo o pegajoso, y lo que tiene adentro, vuelve a esa cara. Lo demás queda como quedó al bajar.
- **Una aparición que se DESHACE al salir de pantalla.** tryholo.ai esconde de nuevo lo que ya no se ve, y la foto (que
  sale arriba de todo) traía media página invisible: el texto estaba, la opacidad en 0. **Regla:** en cada paso de la
  bajada el lector anota la cara VISIBLE de lo que está en pantalla (`JS_MIRAR_VISIBLES`); lo que se vio y quedó
  escondido vuelve a esa cara (con `!important`: si la esconde una animación, una regla común no le gana). Lo que nunca se
  vio (un menú cerrado, un tooltip) queda como está.
- **`o.src` de un `<img src="">` es la dirección de la PÁGINA.** Seis imágenes rotas en la copia de respond.io: el src
  se lee del atributo, no de la propiedad.
- **Un `vh` en el iframe del editor es el alto del iframe**, y el editor lo ajusta al contenido: una sección de `110vh`
  agrandaba el iframe, el `vh` crecía con él, y así sin fin (closermood.com en la vista del editor: 16.000 px). En el
  iframe de una copia el `vh` se mide contra una ventana fija de 900 px (`conVhFijo`); la publicada usa el real.
- **Un `<canvas>` en PNG no entra.** El fondo animado de closermood.com medía ~700 KB y sacaba su sección del tope: va en
  WebP, y si pasa de 150 KB queda vacío.
- **La hoja de una copia pasa el tope de la de un diseño.** La de reportei.com, ya podada, mide ~380 KB y con 200 KB se
  quitaba entera: el tope de `TOPES.cssDiseno` es 600 KB.
- **El diff del texto ve diferencias que no se ven.** El `innerText` de un `<select>` trae TODAS sus opciones (masterads: 23
  países que en pantalla no están), un placeholder no cuenta en la original y sí en la copia (va como texto), y la
  publicada suma «Hecho con MaKo». Y un componente que rota solo (el «Capture / Convert» de respond.io) sale en otro estado
  en la captura que en la foto. Leer el diff con eso en la cabeza.

### La verificación de 5004dba08 (Cerebro): el HTML AJENO en el MISMO origen

Informe: `C:/dev/revisiones/2810-verificacion-5004dba08.md`, con sus cargas en `C:/dev/revisiones/scratch-5004/`. El
rojo-verde de esas cargas da 1 de 23 seguras antes y 23 de 23 después (`rojo-antes.txt`, `verde-despues.txt`). Su batería
`ataques.ts` daba 4 casos con hallazgos de 37 y ahora da 0.

- **El filtro de url() era ciego a cómo lee CSS el navegador.** El iframe del editor es del MISMO origen que la app
  (`allow-same-origin`, para poder editar), y lo que pide sale con la sesión de quien edita. La CSP de la app no tiene
  img-src. `medioPermitido` miraba el literal `url(`, pero el navegador lee `\75 rl(` y `u\rl(` como `url(` y
  `@\69mport` como `@import`. Y `image-set`, `cross-fade` y `src()` piden un STRING como dirección. Pasaban un GET a
  `/api/ads-manager/ad-aprobacion`, que manda un WhatsApp, y `mask`, `fill` y `clip-path` de un SVG. **Regla:** el CSS se
  mira sin escapes ni comentarios, declaración por declaración (`cssSinCargasAjenas`), y la que pide algo no permitido se
  va entera. También se va la que arma la dirección con `var()`, `attr()` o `env()`, porque no se puede saber a dónde va.
  Vale para la hoja, los `style`, los envoltorios y los atributos de SVG. **La segunda capa:** el iframe de una COPIA
  lleva su propia política (`politicaDelEditor`), con sus orígenes y NUNCA los nuestros, antes de cualquier cosa que
  cargue. Aunque algo se escape del filtro, el navegador no lo pide.
- **El filtro viejo, de paso, rompía lo legítimo.** Un `url(#grad)` de un SVG, que no pide nada, quedaba en `url()`. Los
  íconos en `data:image/svg+xml,%3Csvg…` y las fuentes de íconos en `data:application/font-woff;base64` también se
  perdían: respond.io, reportei.com y closermood.com las usan. Un SVG o una fuente como recurso de CSS no corre código ni
  carga nada. Medido sobre las hojas de las 5 copias, el filtro nuevo no saca ni una declaración legítima.
- **`target="_BLANK"` con `rel="opener"` se colaba.** El guardia comparaba `=== '_blank'`, pero el navegador no distingue
  mayúsculas, y un nombre (`target="pwn"`) también abre otra pestaña. **Regla:** con CUALQUIER target va
  `rel="noopener noreferrer"`.
- **La copia le avisaba al sitio original de cada visita.** Sus imágenes y fuentes se piden a SU sitio (la política de la
  publicada deja pasar sus orígenes) con el Referer del dominio del cliente. Ahora la publicada de una copia y el iframe
  del editor van con `referrer: no-referrer`. El IP del visitante igual le llega, así que lo que falta es el bucket o un
  proxy (sin hacer).
- **Una agenda de la página copiada con `position:fixed` y 12.000 px** se dibujaba en la app encima de TODO el lienzo, y
  los clics iban a la agenda: `vivosDe` medía la caja entera. Ahora la capa se recorta a la caja del iframe.
- **Un origen con `;` partía la política.** El parser de URL acepta `;` en el host (`https://a;script-src.example`). Ahora
  un origen entra sólo con un host de letras, dígitos, punto y guion.
- **La copia idéntica mandaba los leads a la otra.** Su Calendly o su HubSpot embebidos, y sus enlaces al registro o al
  WhatsApp. **Regla:** en una copia idéntica todo enlace que no sea un ancla de la misma página pasa a «#». La agenda
  embebida se reemplaza por una caja vacía del mismo tamaño, marcada (`data-gm-agenda-original`), y un `data-calendly`
  se va. El aviso lo dice.
- **Un `data-gm-raiz` que venga en el HTML** cambiaba qué guardaba el editor. El saneo lo saca, y el editor también.

Lo que quedó SIN hacer:
- Copiar las imágenes y las fuentes al bucket: hoy quedan en el sitio de la original (si la otra las cambia o bloquea el
  enlace, la copia lo sufre). Pide sumar fuentes, SVG y avif a `landing-imagenes` (una migración) o un bucket aparte.
  Mientras tanto la original ve el IP de cada visitante y cada `:hover` que pide una imagen. Con el bucket o un proxy de
  MaKo, eso se termina.
- La política propia del iframe va sólo en las COPIAS. Un diseño de MaKo usa imágenes de la app (`/vsl-assets`), y
  queda cubierto sólo por el filtro.
- Lo que hace el JavaScript de la original: un carrusel queda en su primera diapositiva, un menú del teléfono no abre, un
  acordeón queda como estaba. Los formularios se ven pero no envían (copiados tal cual en nuestro dominio serían phishing).
- El Pixel no mide por sección en una copia: sus secciones van sin `.gm-libre-seccion` (alcance-secciones.ts y el Pixel
  v26 las buscan por esa caja).
- La API de MaKo (`replicar_landing`, «Página web») no tiene navegador: sin foto sigue saliendo la copia vieja en iframes.
- Personalizar sobre la copia (el texto para el negocio, su marca, sus ángulos) como paso aparte.
- El editor con una copia abierta NO se vio en un navegador: se midió el documento que arma (`documentoEditable` con los
  envoltorios) y la página publicada, no la pantalla con sus clics. Tampoco el pedido entero por la ruta (la foto por la
  ventana del lector de la app y el POST): se midió con las mismas funciones, llamadas desde un script.
- Los popups que la original abre sola («You've got a surprise!» de tryholo.ai) no se copian: son JavaScript.

Para lo que viene (Martín, ~09:50: personalizar después, POR PROMPTS y por FUNCIÓN: respond.io → la landing de los Chats
de MaKo): por qué la copia es «Diseño editable» y no la «Página web» vieja en iframes (`htmlLibre`). El chat del editor
está ciego sobre `htmlLibre` (`textoDe` da '' y Discutir recibe «(sin texto)»); sobre un diseño editable LEE los textos
(`textoDe`, `textosDeHtmlEditable`), la sección se llama por su primer título (`rotuloDeSeccion`) y `conTextos` cambia un
texto sin rehacer la sección. Medido con la copia real de respond.io: 12 textos en el hero, el título es el 3.º, y al
cambiarlo cambió sólo ese texto (el resto, igual byte por byte). La API de MaKo edita un diseño con `{ ...attrs, html }`:
los envoltorios sobreviven. Toda réplica guarda `config.origen.basadoEnUrl` (la URL de la original): de ahí se puede saber
qué función de MaKo reemplaza a quién. «Tu oferta» de Replicar por partes NO se guarda en la landing.

Tests: tests/web-generator-copia-identica.test.ts (14; los 13 primeros, probados rompiéndolo: 21 roturas, cada una caza). El arnés
de medición y la comparación quedan en el scratchpad de la sesión (`medir-identica.mts`, `comparar-identica.mts`,
`sondear.mts`): sacan la foto por el lector de la app, la arman y la dibujan como la publicada.

## «No pude sacar la foto de la página»: la ventana del lector le borraba el árbol a una app de Next (29/10/2026, claude3)

**Vive en:** `lib/editor-landing/replicar-reglas.ts` (`sinRastreadores`, `esDatosDeLaPagina`), `lib/editor-landing/lector-pagina.ts`
(`documentoLector`), `lib/editor-landing/lector-script.ts` (`sacarFoto`, `terminar`), `lib/editor-landing/lector.ts`
(`MOTIVOS_SIN_FOTO`), `lib/editor-landing/lector-navegador.ts` (`mensajeSinFoto`), `app/web-generator/crear/Replicar.tsx`.

El ticket de Martín (ws9, /web-generator/68, «Replicar», 29/10 00:38): «No pude sacar la foto de la página. Vuelve a
intentar.» con https://100ads.ai/ (la URL salió del log de Vercel de `/api/landing-generator/replicar/leer`: el ticket no la traía).

- **El diagnóstico obvio era el equivocado.** La sospecha era el tope de 40 s del lector: que una página larga llegara al
  tope antes de la foto. Los pedidos de Vercel lo descartaron en un minuto: la ventana abrió a las 03:38:41 y a las 03:38:53,
  y el ticket salió a las 03:38:58. El segundo intento falló en menos de 5 s. **Regla:** antes de culpar a un tope, mirar
  CUÁNTO tardó la falla en los logs.
- **Inyectar el lector directo en la página daba foto (8,4 s).** El camino de Martín era otro: 100ads.ai no tiene el Pixel y
  se lee en la ventana AISLADA (`responderPaginaLector`, con la política sandbox). Reproducida tal cual (la misma función,
  servida en 127.0.0.1, y una página «MaKo» que la abre como `leerEnNavegador`): fin a los 3 s, **0 palabras**, y la foto con
  el cuerpo VACÍO, que `sanearInstantanea` tiraba sin decir nada.
- **La causa:** 100ads.ai es una app de Next (App Router). Su árbol viaja en pedazos `self.__next_f.push(…)` y uno, de
  113 KB, es la página entera. Nombra a Facebook y a Clarity porque el layout los carga, y `sinRastreadores` saca cualquier
  `<script>` que nombre a un rastreador. Sin ese pedazo React no puede armar la página («Connection closed», error #423), la
  borra, y el `<body>` queda sólo con scripts. **Regla:** un script de DATOS (el árbol de Next, un
  `<script type="application/json">` como `__NEXT_DATA__` o `__NUXT_DATA__`) no es un rastreador: nombrarlo no lo corre.
  En la ventana se quedan (`guardarDatos`), porque el preludio ya apagó los rastreadores antes de la página (`fbq` mudo y
  los pedidos a sus dominios atajados). Con eso: 684 palabras y la foto de 115 KB, 12 de 12.
- **Cerrar la ventana 300 ms después de mandar la foto la PERDÍA** (2 de 18 corridas). No era una demora: MaKo esperó 4 s
  más y la foto nunca llegó. **Regla:** con un mensaje de megas, lo cierra quien lo recibe (`leerEnNavegador` al recibirlo);
  el cierre propio del lector, con foto, es un respaldo a los 10 s.
- **Lo que corre un editor devuelve su motivo** (AGENTS.md). Sin foto, el lector manda `sinFoto` (`vacia`, `excepcion` con
  el error, `error`, `salio`, `tope`) y el saneo suma `grande` y `vacia` si la foto vino y no pasa. Si llega el tope sin
  foto, la saca igual (parcial). La pantalla dice un texto por motivo, y «Vuelve a intentar» sólo con `tope`; para el
  resto ofrece el formato Landing.

**Sin hacer:**
- La vista del Diagnóstico (`documentoDiagnostico`, diagnostico.ts) y la copia fiel (`copiaFiel`) siguen sacando los datos.
  Ninguna de las dos apaga los rastreadores antes de la página, así que una app de Next ahí probablemente también queda en
  blanco. No está medido.
- Los errores de hidratación #418 (los `<script>` de rastreadores que se sacan del HTML) siguen; React rearma la página
  en el navegador y se ve, pero es más lenta de armar.

Tests: tests/web-generator-foto.test.ts (8; el lector corre de verdad en un `vm` con un DOM y un reloj de mentira, y el
reloj frena los temporizadores como en una ventana en segundo plano para que el tope llegue antes que la foto). Probado
rompiéndolo: 18 roturas, cada una caza. El arnés de la ventana aislada y las mediciones: `C:/dev/revisiones/web-generator-foto/`
(`ventana-repro.mts`: `node --conditions=react-server --import tsx ventana-repro.mts <worktree> <url> <salida.json>`).

## «Las páginas clonadas se desfasaron todas»: la publicada era fiel, el EDITOR no (29/10/2026, claude3)

**Vive en:** `lib/editor-landing/copia-identica-script.ts` (`JS_HIJOS_JUNTOS`), `lib/editor-landing/copia-identica.ts`
(`partirParaCopia`, `esCajaJunta`, `esParteVacia`), `lib/editor-landing/html-editable.ts` (`documentoEditable`,
`CSS_CAJA_BODY_EN_EL_EDITOR`), `app/web-generator/editor/nodos/HtmlEditableVista.tsx`.

Martín: «Lo que más me interesa es que funcione al 100% Web Generator, porque las páginas clonadas se desfasaron todas».
Medido DOM contra DOM (`C:/dev/revisiones/clonadas-2910/`, arnés `medir-clonadas.mts`): cada sección con su primer texto
como ancla, y dónde cae (x, y, ancho, letra) en la ORIGINAL, la PUBLICADA (armarFoto + armarDocumento) y el EDITOR (un
iframe por sección con `documentoEditable`, alto medido como `medir()`), a 1440 y a 390, con las copias reales #68–#72.

- **El diagnóstico obvio era el equivocado.** Parecía la copia (CSS perdido, fuentes, medidas). La PUBLICADA estaba bien
  en las 5: el mismo alto que la original a 1440 y a 390, y cada ancla a menos de 100 px. Lo que se desfasaba era el
  EDITOR, y las capturas «como las dibuja el editor» del 28/10 ya lo mostraban; nadie las comparó. **Regla:** una copia
  se verifica también en el EDITOR, no sólo en la publicada.
- **La causa grande: el corte partía columnas.** La publicada arma las secciones juntas en un documento, con los
  envoltorios abiertos una vez; el editor pone CADA sección sola en su iframe. `partirParaCopia` abría una caja en sus
  hijos sin saber si eran franjas apiladas o columnas de una fila (el HTML no lo dice). El hero de tryholo.ai, una grilla
  de dos columnas, eran dos secciones: en el editor «30+ posts a month» pasaba de x 727 · y 170 a x 197 · y 1064. Ahora
  la foto marca con la geometría de la página armada las cajas cuyos hijos van juntos (columnas, encimados, un absoluto:
  `data-gm-junto`) y el corte no las abre si entran en `TOPES.htmlEditable`, **tampoco bajando por un envoltorio de un
  solo hijo** (por ahí se llegaba al hero, y la primera versión del arreglo no cambió nada). En holo, la mediana del
  corrimiento en el editor bajó de 912 a 177 px.
- **La caja del <body> se repetía por sección.** Lleva las clases del body (`min-h-screen` en 100ads.ai): en la
  publicada envuelve la página una vez; en el editor, cada sección, y un `<div>` vacío medía 900 px. En el editor no
  impone su alto (`CSS_CAJA_BODY_EN_EL_EDITOR`). Y lo que no dibuja nada (`<div hidden>`, el anunciador de rutas de
  Next) ya no es una sección (`esParteVacia`; ojo: llega con comentarios de Suspense adentro). Con eso, la copia NUEVA de
  100ads.ai mide en el editor lo mismo que la original: 10.330 px a 1440 y 11.590 a 390.
- **Trampa del arnés:** una página sin `<meta viewport>` con la emulación de teléfono se dibuja a 980 px, y sus iframes
  también. El editor se mide en escritorio (el lienzo «movil» es una columna de 390 en la computadora).

- **El editor dibujaba al ancho del LIENZO** (~980 px en la pantalla de Martín) y la copia elegía su diseño de tableta.
  Ahora una copia en escritorio se dibuja a 1440 y se achica al lienzo (`escalaDeCopia`, `transform: scale`); en tableta
  y celular, como siempre. El clic, el cursor y la selección los lleva el navegador a través del transform; lo que la
  vista pasa entre el iframe y la página (el clic reenviado, las capas vivas) va × escala. Medido con clics REALES (CDP
  `Input.dispatchMouseEvent`, arnés `clic-escalado.mts`) a escala 0,68: cada clic llega a su punto exacto (±1 px).
  **Trampa del arnés:** al llevar un elemento a la vista cargan imágenes diferidas de arriba y la sección se corre
  (588 px): el punto se recalcula hasta que se queda quieto.
- **Lo FIJO** (el aviso de cookies, un encabezado fijo) era una sección propia: en el editor, un bloque al final. La foto
  lo marca (`data-gm-fijo`) y el corte lo pega adentro de la primera sección en flujo (`pegarLoFijo`), también cuando
  viene detrás de algo vacío o adentro de una caja que sólo lo tiene a él. Y un `<title>` en el body no es una sección.
- **Antes y después, DOM contra DOM** (`C:/dev/revisiones/clonadas-2910/final/tabla.md`, cada ancla). Mediana de la
  distancia de cada ancla en el editor a la original, antes (producción, copia vieja) → después (copia nueva): holo
  913 → 98 px a 1440 y 1.755 → 107 a 980 (el lienzo); respond 42 → 2 y 1.264 → 8; reportei 870 → 289 y 1.035 → 295;
  closermood y masterads 0 → 0 a 1440 y 248/230 → 0 a 980; 100ads, sin copia (la foto no salía) → 0.

**Sin hacer:**
- A 390, holo y reportei están corridos también en la PUBLICADA (~320 px en holo): la foto se saca a 1280 y lo que la
  página arma recién en el celular no viaja igual. Es de la copia, no del editor.
- Una sección de holo mide en el editor ~486 px más que en la publicada (la de «from bakeries to B2B SaaS.», con algo
  pegajoso adentro). Sin mirar.
- Las copias viejas (#68–#72) se abren igual (no cambia cómo se guardan) y ganan con la escala y la regla del body, pero
  sus columnas siguen partidas: para tenerlas tal cual, replicarlas de nuevo.

Tests: tests/web-generator-copia-franjas.test.ts (10; la geometría corre en un `vm` con cajas de mentira). Probado
rompiéndolo: 33 roturas, cada una caza (`romper_franjas.py`).

## Lo que la landing puede vender (medido el 29/10/2026, el taller del Cerebro)

**Vive en:** las tarjetas de la #32 (`scripts/landing-principal-high-ticket.mts`, `TARJETAS`) · lo que promete cada plan
(`lib/planes-mako.ts`, `incluye`) · la tabla (`lib/planes-comparacion.ts`) · el detalle del taller en el journal
`~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/4d1a09d4-c870-4075-94b3-7d1450a71bcc/subagents/workflows/wf_081f1b8b-822/journal.jsonl`

Martín vio las 6 tarjetas que elegí («lo que anda hoy, como un equipo») y contestó: «Esas no son las funcionalidades más
hot... ¿Y el scraper? ¿Y el Avatar con IA? ¿Y la edición?». **El diagnóstico obvio («lo hot es lo que vende el rubro») era
el equivocado sin el inventario:** lo hot es lo que el cliente VE y le resuelve algo hoy, y eso hay que medirlo pantalla
por pantalla, no recordarlo. El taller (inventario + lo que vende el rubro + tres jurados) dio 9 tarjetas, 3 x 3.

- **En producción y lo ve el cliente:** el setter de WhatsApp, el CRM automático, Instagram (comentario → DM), el scraper
  de grupos de WhatsApp (sólo Pro), el Video Editor (sólo Pro), el Web Generator, el media buyer (apagado por defecto),
  Closing (sólo Pro), el consultor y la grabación de la visita con su mapa de calor.
- **A medias o sólo para el super admin:** AI Avatar (sólo super admin, sin probar con un look real: entra cuando un
  cliente lo abra y le salga el video), la difusión (hasta tren-ab), Image con IA, Video Generator, y los otros scrapers
  (Leads Scraper retirado el 25/10, ce27df948; LinkedIn nunca).
- **Ya no existe:** crear campañas desde el Ads Manager.
- **Gana el código, y quedó anotado:** Pro prometía «crea campañas» y «avatares con IA» (/planes dejó de venderlos el
  28/10, `TABS_TODAVIA_CERRADAS`) y decía «sin topes» con tope de WhatsApp y de personas: corregido en `incluye`. Image
  Editor y Video Generator se abren por la CAPA (`requireRolWs`), no sólo para el super admin.
- **Que el código lo abra no alcanza (corregido a la tarde, el Cerebro recorriendo la portada en producción):** yo había
  dejado en la tabla «Videos para tus anuncios, armados con IA» (✓ en los tres planes) y «Crear y retocar imágenes con IA»
  porque el código los da. Pero el Video Generator depende de la extensión y de los créditos de Flow del cliente, y al motor
  nunca se lo midió en vivo; y generar imágenes con IA no existe (`NO_SE_PUEDE_CHAT_IMAGEN`): el editor tipo Canva sí. La
  fila del video salió, la de imágenes dice «Diseñar tus imágenes sin salir de MaKo», y Pro promete edición de video y de
  imágenes. Guarda: `tests/portada-high-ticket.test.ts` («no prometen videos ni imágenes hechos con IA»). Sin tocar: la
  pregunta de la prueba en /planes (Vitrina.tsx) cuenta «1 video con avatar de IA» y «20 imágenes» como TOPES de la prueba;
  la fija `tests/prueba-topes.test.ts`, y cambiarla es decisión de Planes.

**Regla:** una tarjeta o un renglón de precios sale de un inventario MEDIDO ese día (qué abre el cliente, con qué plan) y
del código (`lib/topes-plan.ts`, `lib/planes-comparacion.ts`), nunca de la memoria de lo que «ya anda». Y algo a medias no se
promete aunque el código lo abra: se vende cuando un cliente lo usó y le salió.

## La copia con las imágenes rotas: la dirección pegada no es la de la página (30/10/2026, claude1)

**Vive en:** `lib/landing-fetch.ts` (`paginaConDireccion`) · `lib/editor-landing/replicar-reglas.ts` (`baseDeDocumento`).
Se vio en el recorrido visual: [recorrido-visual-30-10.md](recorrido-visual-30-10.md), W2.

**Síntoma:** la landing #88 (copia de `contentpartner.com.co/…-inmersion`) abre con el logo y el hero rotos: sus 27 imágenes dan 404.

**Causa:** se pegó la dirección sin la barra final y el sitio redirige a la misma con barra. Lo relativo (`kit-marca/x.webp`) se
resuelve distinto según esa barra: contra la dirección pegada pierde la carpeta de la página. La bajada seguía la redirección, pero
devolvía sólo el HTML y la dirección final se perdía.

**El diagnóstico obvio era el equivocado:** `baseDeDocumento` ya «resolvía la base» y por eso no parecía el problema. Pero usaba el
`canonical` y el `og:url` como sustitutos, que el navegador nunca usa para resolver una ruta, y esta página no tiene ninguno.

**Regla:** una ruta relativa se resuelve contra lo mismo que el navegador: `<base href>`, y si no hay, la dirección FINAL después de las
redirecciones. Nunca contra lo que pegó la persona, nunca contra el `canonical`.

**Probado (30/10):** de las 32 imágenes de esa copia, hoy respondían 0 y con la base corregida 32. Es el caso que Martín mostró en la llamada con Leila (minuto 4, ws9; pendientes-30-10.md, 1.16). #88 reparada, con respaldo. De las otras 8 copias de afuera, ninguna tiene imágenes con 404 (hasta 12 por copia).

**Trampa de la medición:** `copiaFiel` da 0 imágenes con esa página, porque las copias de hoy salen de la foto del navegador. Para probarlo hay que resolver las direcciones guardadas contra `baseDeDocumento`.

**Sin hacer (rama `recorrido-web-3010`, sin subir):**

- Correr sus tests: los frenó la falta de RAM. Hay 4 aserciones actualizadas sin correr en `tests/editor-landing-{crear-panel,estilo,replicar,replicar-animaciones}.test.ts`.
- ⚠️ **Medirlo con la página real.** `copiaFiel(html, final)` devolvió la dirección con barra y `ok`, pero mi prueba encontró 0 imágenes de ese
  dominio en la copia. O la prueba busca mal, o la #88 no salió por este camino (`lib/editor-landing/copia-identica.ts`, la foto del
  navegador). **Hasta medirlo, este arreglo no está probado para el caso que lo originó.**
- Reparar la #88 (el prefijo de sus imágenes, con respaldo antes). De las 28 copias que hay es la única con esta causa.

## El feedback del 24/10: ya estaba hecho, y lo roto era otra cosa (30/10/2026, claude1)

**Vive en:** `app/web-generator/gamma.css` (`container: gma-barra`) · `tests/editor-landing-iconos.test.ts` · `scripts/banco-editor-web/` (el banco).

- ⚠️ **El diagnóstico obvio era el equivocado.** Se pidió de nuevo «Nueva landing sin navegar» y «un solo botón Compartir» como no cumplidos. Están en main desde `f24afff79` (24/10) y `docs/diseno-editor-web-como-automations.md` lo decía. Reescribirlos era perder el trabajo. Medido en el banco con clics: «Nueva landing» cambia la barra y el lienzo por «¿Qué vas a crear hoy?» y no navega (`window.__nav` vacío, misma URL). Lo que SÍ iba a `?panel=1` era otro link, «Ver todo en el Panel», al pie de la lista: por eso el arreglo del 24/10 parecía no cumplido.
- ⚠️ **De dónde salió el error:** `f24afff79` es del 24/10 a las 21:04 y el feedback con sus capturas es de esa misma noche, así que las capturas son de la versión anterior. La nota «no cumple» de `docs/feedback-24-10.md` comparó esa captura contra un código que ya la había dejado atrás. **Un pedido viejo se mide contra el código de hoy, y un pedido posterior de Martín le gana.**
- **«Ver todo en el Panel» tampoco navega desde el 30/10** (decisión del Cerebro: lo pedido era el comportamiento, no un botón). Mismo lugar que «Nueva landing», con la columna del Panel para lo que la tarjeta no tiene (lo analizado, los menús, Plantillas, Temas, Papelera). ⚠️ La columna **no ofrece la landing abierta**: renombrarla o eliminarla ahí dejaría al editor guardando sobre lo que ya no es. Y lo que cambie ahí hace releer la lista de la tarjeta (`revisionLista`).
- **Compartir se ve como un solo botón desde el 30/10** (decisión del Cerebro: «lo que importa es lo que se ve»). ⚠️ Sacar la raya no alcanzaba: dos fondos pegados dejan una línea cuando el ancho cae entre dos píxeles. El fondo es del contenedor y los dos blancos de clic son transparentes.
- **Lo que estaba roto de verdad, y ningún test ni lectura de código lo había visto:**
  - **La barra cortaba Compartir y el ⋯.** A 1024, con la tarjeta del chat, pedía 712 px en 660; un panel de la derecha (Tema, Animar) la achica igual a cualquier ancho. El `@media` mira la ventana, y lo que importa es lo que mide la barra: `container: gma-barra`. ⚠️ El contenedor es la barra y no `.gma-centro`: `container-type` hace de esa caja el bloque de lo `position: fixed`, y adentro están el lienzo y sus flotantes.
  - ⚠️ **`.gma-dispositivos { display: flex }` está más abajo en el CSS y le ganaba al pliegue:** la primera versión no escondía nada y parecía andar en la lectura. Por eso va con `.gma-herr-der` adelante. Lo agarró la medición, no el código.
  - **La X de Compartir era un cuadrado con una diagonal.** `Ico` dibuja `neutro` si el nombre no existe, a propósito («nunca un hueco»): nada avisa. Ahora un test recorre los nombres fijos que van a `Ico`. **Los que vienen de una variable no los cubre.**
  - ⚠️ **Hay DOS catálogos de íconos, y creer que había uno rompió cuatro.** Las pestañas de Publicar y del editor de tema usan `Icono` de `piezas-gma.tsx` (TRAZOS), donde `engrane`, `navegacion`, `fuente` y `marca` sí existen y un nombre desconocido cae a tres puntitos. Mi primer test los medía contra `lib/editor-landing/iconos.ts`, dio rojo y los «arreglé»: estaban bien y quedaron rotos, con el test en verde. Lo agarró la revisión independiente. Antes de renombrar un ícono, mirar qué componente lo dibuja.

**Lo que encontró la revisión de «Ver todo en el Panel» adentro (ya arreglado):**
- **Remontar la pieza tiraba lo escrito** al pasar de «Nueva landing» al Panel: sin `key`, y al volver al cuadro se resetea la vista.
- **`Inicio` se desmonta al volver a la landing:** lo analizado que se eliminó reaparecía, y tocarlo volvía a gastar IA. Vive en el editor (`analizadasVivas`).
- **El Diagnóstico navegaba igual** con `irDuro` (Aplicar, Ver copia): ahora `onAbrirDiagnostico`.
- **La landing abierta seguía alcanzable pegando su dirección:** aplicar ahí le sube la versión por debajo del editor oculto y el guardado daba conflicto. Al volver se lee de nuevo, y «Abrir en el editor» vuelve a ella en vez de ser un link a la misma ruta.
- **Los rótulos de la barra colgaban del `@media`:** por encima de 1440 de ventana con un panel abierto, el ⋯ salía de la barra. Se pliegan con el contenedor. (Calculado, no medido.)

**El banco (`scripts/banco-editor-web`), para la próxima:** el `EditorLanding` real, con esbuild, `fetch` simulado y sin base. Compila en ~1 min y no pide más memoria que esbuild; no necesita sesión ni escribe en producción.
- Lo que costó: las acciones de server (`'use server'` en cualquier archivo, no sólo los `actions.ts`) se reemplazan por funciones vacías; los módulos de node van como un Proxy en CJS, porque esbuild exige los nombres de un ESM; `CONFIG_DEFAULT`, porque `config.pagina` es obligatorio.
- **Lo que NO mide:** sin la barra lateral de la app (la real tiene ~58 px menos: todo aprieta antes) y sin el CSS de Tailwind; un «Diseño editable» sale sin estilos si su hoja no se le pasa en la config, y eso es del banco, no un bug.
- ⚠️ El banco anterior (`banco-create-qa`, 29/10) quedó en una carpeta de notas y hoy no se pudo encontrar: por eso éste vive en el repo.

**Lo que quedó SIN hacer:**

- **Nada de esto se vio en producción ni con la barra lateral real.** Si Martín sigue viendo los dos botones o la otra ruta, es otra cosa: un despliegue viejo, o lo que mira no es este editor. Hace falta su captura.
- **`docs/feedback-24-10.md` y `docs/pendientes.md` siguen atrasados** en lo demás: los corrige el Cerebro con la lista de lo que sigue vivo.
- **Punto 6 (placeholders detrás de otras secciones):** en el banco el «Encabezado 2» de una sección vacía se lee y no queda tapado. No se reprodujo el caso original: se necesita la landing donde lo vio.
- **Por debajo de ~336 px de barra** (640 de ventana, sin lugar real) sigue sin entrar.

## Las tarjetas siguen la demo de Martín, no el ranking del rubro (29/10/2026, noche)

**Vive en:** `scripts/landing-principal-high-ticket.mts` (`TARJETAS`, `TARJETA_AVATAR`, `REEMPLAZA_A`, `Y_ADEMAS`, `NO_ESTA`) ·
la llamada con Thiago (Fathom 197943284) y su análisis en el scratchpad del Cerebro (`llamada/como-presento-mako.md` y
`promesas.md`, sesión 4d1a09d4).

Martín: «revisa cómo le presenté la app a Thiago, qué cosas prioricé, y metelas en la landing de funcionalidades». A la
tarde, las 9 del taller salieron del ranking del rubro (qué vende un coach o un infoproductor). **El diagnóstico obvio
(«lo hot es lo que puntúa el mercado») era el equivocado:** lo hot es lo que Martín muestra EN VIVO cuando vende, y en qué
orden. En la llamada, el scraper, las automatizaciones («un ManyChat 2.0») y replicar una landing fueron en vivo, y los
dashboards se llevaron el mayor tiempo. Ninguno de los cuatro estaba arriba, y los dashboards ni tenían tarjeta. Al revés:
el análisis de llamadas tenía tarjeta y ni lo nombró.

- **El orden:** las cuatro en vivo o con más tiempo; después las de peso alto en el orden en que salieron (Plan desde las
  reuniones, media buyer, editor de video, MaKo en tu WhatsApp); y los chats. El CRM, «QUIERO», el Calendario, School,
  Canva, el Copywriter, el análisis de llamadas, la app, la API y la seguridad van a «Y además».
- **Lo que dijo y no se pone:** LinkedIn en Chats y Automations, lanzar campañas desde el chat, el scraper de Instagram y
  las publicaciones recurrentes no existen (`promesas.md`). `NO_ESTA` frena el script si alguno aparece en la sección. Del
  media buyer dijo «él solo decide»: eso es sólo en Pro con el piloto prendido, así que la tarjeta dice «te propone» y «En
  Pro, lo aplica solo».
- **«Reemplaza a»** nombra sólo lo que MaKo reemplaza hoy: ManyChat, CapCut, Canva, Notion, Trello, Skool y el CRM.
- **El script se puede volver a correr:** el marco y «Y además» llevan `data-mk` y se sacan antes de ponerlos. La base de
  cada tarjeta es la ya publicada con su `data-feature`; si no está, la de `de`; y si tampoco, una azul. Medido: una
  segunda pasada sobre su propia salida da lo mismo.
- **Sin hacer:** el Avatar está detrás de `--con-avatar` (entra después del editor de video y los chats pasan a «Y
  además»), y espera un look generado en producción. Automatizaciones, Plan y chats llevan a `#beta`, porque no tienen
  página propia. /vsl/dashboard y /vsl/mako son textos viejos que no revisé. Con 9 tarjetas, a 390 la última queda sola.

**Regla:** la grilla de la landing sale de cómo Martín presenta MaKo en vivo (el orden y el tiempo de su última demo),
cruzado con lo que está en producción. El ranking del rubro sirve para desempatar, no para ordenar.

## Black November: los bloques de venta, sólo con datos del negocio (5/11/2026, nube)

**Pedido.** Cuenta regresiva (a una fecha real; al vencer no reinicia sola), prueba social y escasez, con datos que pone el
negocio. Sin el dato, el bloque no sale. También en el celular y en la API.

**Lo que no se ve en el código, y costó una vuelta cada uno:**
- **El pedido nombraba `app/web-generator/BloqueWeb.tsx`, que es el bloque del CHAT.** Las landings se editan en el editor
  (TipTap): los tres son nodos nuevos con UNA forma HTML (lib/editor-landing/especificacion.ts) que usan el editor y la página
  publicada.
- **`<time>` no sobrevive al guardado:** `htmlDeArbol` lo saca. La fecha de cada compra va en un `span[data-fecha]`.
- **Un `position: fixed` adentro de una sección animada se ancla a la sección**, porque la animación le pone `transform`. El
  aviso de compras se muda al final de `.gm-doc` (`SCRIPT_VENTA`).
- **Editar la landing con IA los convertía en párrafos:** el modelo no los conoce. Van con `conservar` por su ref
  (lib/editor-landing/ia-bloques.ts), como los demás bloques que el modelo no reescribe.
- **El celular va en `movil()`** (lib/editor-landing/css.ts), no en un `@media` propio: así lo ve también la vista de teléfono
  del editor, y el test de diseños lee el primer bloque del celular.
- **La hora de cierre es la del NEGOCIO, no la de la computadora:** el editor la lee con `tzWorkspaceAction` y no deja
  poner la fecha hasta tenerla. La primera versión usaba la zona del navegador (un super admin mirando a un cliente estaría en
  otra) y un «Ciudad de México» de respaldo: tests/zona-negocio.test.ts lo frenó, porque el default es UNO (`ZONA_POR_DEFECTO`).
- **El test del reloj daba verde por casualidad:** la fecha relativa usaba `new Date()` y el test fijaba `Date.now()`. Toda
  hora del script sale de `Date.now()`.
- **La operación de la API pasa por la fábrica de ediciones** (`edicion` con `conZona`, lib/api-mako/areas/landing-editor.run.ts):
  primero el freno de las automatizaciones, después la zona del negocio (sin poder leerla, no cambia nada).

**Dónde vive.** lib/editor-landing/bloques-venta.ts (la forma, cuándo están listos, el script),
app/web-generator/editor/nodos/BloqueVentaVista.tsx (el panel), `planBloqueVenta` en
lib/api-mako/areas/landing-contenido.helpers.ts. Test: tests/bloques-venta-landing.test.ts.

**Sin medir:** una página publicada en producción con los tres (desde la nube no hay base), y cómo los usa Leila.

**Regla:** un bloque que afirma algo de afuera (una fecha, una compra, un número) sale sólo con el dato que cargó el negocio.
La cuenta regresiva tiene UNA fecha para todos: nunca un reloj por visitante que vuelve a empezar.

## El carrusel 4:5 en el Web Generator (6/11/2026, Recorrido visual, nube, `punta/recorrido-visual`)

- **Pedido** (Leila 5/11): el carrusel 4:5 existía en Image (lib/carruseles/) y no en el Web Generator.
- **Una tabla, no una por pantalla:** `FORMA_DE` y `ANCHO_DIAPO_EM` (lib/editor-landing/api-tipos.ts) los leen la pantalla, las
  miniaturas, la tira de secciones, Presentar, el PDF y el PowerPoint. Con la relación escrita en cada una, la quinta se olvida.
- **Trampa 1:** una diapositiva vertical con el ancho de la horizontal (64,5 em) no entra en la pantalla: la 4:5 va a 43 em, y la
  miniatura deriva `--gm-base` de ESE ancho (`100cqw / 43`). Con un ancho para todas, la miniatura salía cortada.
- **Trampa 2:** pptxgenjs sólo trae sus layouts: la 4:5 pide `pptx.defineLayout(…)` ANTES de `pptx.layout = …`. Al revés, el
  archivo sale en 16:9 sin un error.
- **Trampa 3:** el acento de arriba de la tarjeta (`gm-tarjeta`) se come el alto de una vertical: la 4:5 no lo lleva.

**Vive en:** lib/editor-landing/api-tipos.ts, lib/editor-landing/css.ts, lib/editor-landing/exportar-pptx.ts, app/web-generator/editor/Presentar.tsx, app/web-generator/MiniaturaLanding.tsx, tests/editor-landing-carrusel-45.test.ts
