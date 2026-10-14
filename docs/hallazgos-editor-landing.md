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
- ~~**Las redirecciones de `next.config.ts` corren antes del proxy en un dominio de cliente**~~: hecho en la
  tanda 4 (`has: host` de la app con `.map(enLaApp)`, abajo).
- **El matcher de `proxy.ts` no corre en rutas con sufijo de archivo**: en el dominio del cliente se sirven
  `/_next/*`, el `favicon.ico` de MaKo, `/m.js`, `/sw.js`. Un rewrite `beforeFiles` con `missing` host de MaKo
  hacia un 404. `proxy.ts` (matcher), `next.config.ts`. Medido en la tanda 4 y sigue pendiente (por qué, abajo).
- ~~**Servir `/l/html` desde un dominio aparte, sólo para contenido de usuarios**~~: hecho en la tanda 4 (las
  landings y su `/l/html` viven en hola-mako.site; en producción hola-mako.com ya no lo sirve).
- **Los popups del bloque heredan el sandbox** (un checkout ajeno puede fallar): decidir con Martín
  `allow-popups-to-escape-sandbox`. `html-libre.ts` (`SANDBOX_PUBLICO`). Con las landings en hola-mako.site el
  riesgo de aflojarlo es menor (un popup sin sandbox que cargue algo de su propio host ya no corre con el
  origen de la app ni con su cookie), pero sigue siendo su decisión.
- **La pestaña «Dominios» no avisa que una reserva venció** (`queFalta` no lo sabe); el `www.` no se agrega
  solo; los subdominios `<slug>.hola-mako.com` quedan para Martín. `dominios-reglas.ts`.
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
- **Sin hacer**: el botón de pago no arma el link desde la pasarela de MaKo (`lib/cobros.ts`, `crearCobro`):
  la persona pega el suyo. Conectarlo es un cobro por visitante, con su producto y su moneda, y no entraba
  en «cambios simples». Y falta mirarlo con clics (la barra en una sección del medio y en la última, y el
  pop-up desde el Panel y desde la caja).

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
  `/<slug>/pagar/<bloque>` (`SUBRUTAS_FIJAS`), `/vista/<token>[/<ruta>]`; `/l/html` pasa; el POST de
  `/api/landing-generator/pagar` pasa. Lo demás reescrito a `/l/…` caería en el not-found de la APP, con su
  layout y sus `/_next`, en el dominio de los clientes. **Regla: una carpeta fija nueva bajo `app/l/[slug]/` se
  suma a `SUBRUTAS_FIJAS`.** Las mayúsculas se corrigen en el proxy ANTES de reescribir (el 308 de
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

### Lo que quedó sin hacer (tanda 4)

- **Los estáticos de MaKo se sirven en hola-mako.site y en el dominio de un cliente** (el matcher de `proxy.ts`
  no corre en rutas con sufijo). Medido el 14/10 en hola-mako.site: `/_next/static/chunks/…js` 200,
  `/favicon.ico` 200 (el de MaKo), `/sw.js` 200; `/m.js` 404 y `/robots.txt` 404. Una landing no necesita
  ninguno (arriba), así que bloquearlos no rompe una landing; lo que NO se hizo es el bloqueo: un rewrite
  `beforeFiles` con `missing` host de la app, si el patrón no matchea en Vercel como en Next local, deja a la
  APP sin su JavaScript. No exponen datos (son archivos públicos). Si se hace: medir antes con un preview y
  `curl` en los dos hosts. `next.config.ts`, `proxy.ts` (matcher).
- **El pago de un bloque en el dominio propio de un cliente**: `decidirHost` sirve sólo `/` y `/<ruta>`, así que
  `/pagar/<bloque>` y el POST de `/api/landing-generator/pagar` son 404 ahí (en hola-mako.site pasan). Lo decide
  el paquete del pago. `dominios-reglas.ts` (`decidirHost`).
- **Textos que todavía dicen `hola-mako.com/l/<…>`** en archivos de otras áreas: `lib/mako-capacidades.ts:73`
  (lo que MaKo cuenta de la tab) y `app/admin/dev/areas.ts:598` (el alcance del área). Los cambia la sesión
  principal. El comentario de `/l` en `lib/rutas-publicas.ts` también (en producción el proxy la muda antes).
- **HSTS propio para hola-mako.site** (con o sin `includeSubDomains`): hoy sólo el de Vercel. Decide Martín.
- **Verlo en producción después del deploy**: `curl -sI https://hola-mako.site/` (307 a hola-mako.com),
  `https://hola-mako.site/leads` (404 de landing, no 307), `https://hola-mako.com/leads` (307 a /crm: las
  redirecciones con `has` siguen andando en la app), `https://hola-mako.com/l/x` (308 a hola-mako.site/x) y
  una landing publicada de prueba en el ws3 (abrirla, el formulario, el HTML libre, la vista previa privada).

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
