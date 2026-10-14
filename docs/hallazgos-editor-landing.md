# Hallazgos · Editor de landings (Landing Generator, copiado de Gamma)

El editor de landings copiado de Gamma 5 (`app/landing-generator`, `lib/editor-landing`, `app/l`);
el diseño y los contratos, en [diseno-editor-landing.md](diseno-editor-landing.md). Lo que hay que
saber ANTES de tocarlo. Lo que se hizo está en el commit. Corrida del 11/10/2026 (relevo de 6
agentes, construcción de 12 paquetes en paralelo, integración).

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
| Editor | `app/landing-generator/editor/*` | armazón dueño del documento (`EditorLanding.tsx`) + contexto |

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
  **Vive en:** `lib/editor-landing/diagnostico*.ts`, `app/landing-generator/diagnostico/*`, mig 0264.

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
- **Las redirecciones de `next.config.ts` corren antes del proxy en un dominio de cliente** (`/extension`,
  `/leads`, `/todo`, `/graphics`, `/script-analyst`): van con `has: host` de MaKo, que también tiene que
  aceptar `localhost` y los `*.vercel.app`. `next.config.ts` (`redirects`).
- **El matcher de `proxy.ts` no corre en rutas con sufijo de archivo**: en el dominio del cliente se sirven
  `/_next/*`, el `favicon.ico` de MaKo, `/m.js`, `/sw.js`. Un rewrite `beforeFiles` con `missing` host de MaKo
  hacia un 404. `proxy.ts` (matcher), `next.config.ts`.
- **Servir `/l/html` desde un dominio aparte, sólo para contenido de usuarios**: lo de fondo contra el
  phishing. `lib/editor-landing/html-libre.ts`, `especificacion.ts`.
- **Los popups del bloque heredan el sandbox** (un checkout ajeno puede fallar): decidir con Martín
  `allow-popups-to-escape-sandbox`. `html-libre.ts` (`SANDBOX_PUBLICO`).
- **La pestaña «Dominios» no avisa que una reserva venció** (`queFalta` no lo sabe); el `www.` no se agrega
  solo; los subdominios `<slug>.hola-mako.com` quedan para Martín. `dominios-reglas.ts`.
- **«Probar nuevo diseño» no recibe el formato** (el server `disenos` no toma params) y **el PDF de una
  presentación sale vertical**. `lib/editor-landing/ia.ts`, `exportar-pdf.ts`.
- **Las rutas `analyze`, `sync` y `pulso` del Landing Analyst no miran el rol** (quedó como tarea aparte).
  `app/api/landing-analyst/*`.
- **Una página armada como app** (`html/body` al 100% con scroll interno) queda en 400 px por sección en la
  copia fiel. **Sólo se analiza la página de inicio**, el puntaje de una landing nuestra no se guarda, y una
  landing con dominio propio analizada en `https://<dominio>` aparece «de afuera» (`LandingResumen` no trae el
  dominio). `replicar-reglas.ts`, `diagnostico.ts`, `panel-reglas.ts`.
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
  **Vive en:** `app/landing-generator/editor/extensiones/estilos-nodos.ts`.
- **Las «plantillas» eran COPY con un tema pegado**: diez objetivos (agendar, webinar, lead magnet…), cada
  uno con su tema fijo, así que elegir cómo se VE era elegir qué DICE. Ahora son dos ejes que se cruzan al
  crear: `DISENOS_LANDING` (tema + hero + zigzag de las imágenes) y el objetivo (el copy de
  `PLANTILLAS`, por id). `landingDesde(diseño, objetivo)` arma el contenido; la caja de crear y la galería
  del Panel muestran los diseños y preguntan el objetivo en un pop-up (`DialogoObjetivo`). Las
  presentaciones no cambian (ahí la plantilla sí es una pieza entera). El `origen.plantilla` guarda
  `<diseño>:<objetivo>`. **Vive en:** `lib/editor-landing/disenos-landing.ts`, `app/landing-generator/crear/`.
- **Las herramientas de MaKo entran VACÍAS y sin un bloque nuevo**: la agenda (Calendly o Cal.com) y el VSL
  (YouTube, Panda, Vimeo, Wistia) son el `insertado` de siempre con su proveedor de entrada (lo decide
  después el enlace que se pegue, `lib/embeds.ts`); el pago es un botón «Pagar ahora» al que se le pega el
  link de Stripe o Mercado Pago. Un `insertado` con `src` vacío pasa el saneo del server sin descartes:
  medido sobre los 80 cruces diseño × objetivo (`tests/editor-landing-disenos.test.ts`). En el menú de
  bloques son la categoría «Herramientas de MaKo» (Agenda, VSL, Botón de pago). **Vive en:**
  `lib/editor-landing/catalogo-bloques.ts`, `app/landing-generator/editor/insertar.ts`.
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
- **API de MaKo**: listar/ver/publicar landings no están en el registro (`lib/api-mako/areas/landing.*`):
  existen para la pantalla y no para los agentes.
- Se borró `app/api/landing-writer/route.ts` (no la llamaba nadie): al integrar en el clon hay que correr
  `npx next typegen` para que `.next/types/validator.ts` deje de nombrarla.

## La caja de pedir, compartida con /automations (12/10/2026, decimocuarta tanda de Automations)

- La caja de «¿Qué vas a crear hoy?» (el campo con el ejemplo que se escribe solo, el micrófono y el ↑) vive en
  `app/landing-generator/CajaPedido.tsx`. La monta también el modal «Nueva automatización». El «+» y «Plan | Express»
  siguen en `CajaCrear.tsx` (`antes`). **Regla:** un cambio de la caja es para las dos puertas. Lo de una sola va en
  `antes`.
- `Ico` salió a `app/landing-generator/Ico.tsx` (MiniaturaLanding lo re-exporta). Quien no es el editor importa de
  ahí: MiniaturaLanding trae el render de la landing.
- ⚠️ Los tokens `--gp-*` de CSS_GP leen `--gma-*` con respaldo CLARO. Fuera de `.gma` (sin gamma.css) el oscuro no
  los da vuelta. Afuera, `.gp.cp-casa` + `CSS_TOKENS_CASA`.
- Con `scrollHeight` 0 (escondida en un modal que todavía no entró en la pila) la caja no fija el alto. Cierra el «sin
  hacer» de la decimotercera de Automations sobre CajaCrear.
