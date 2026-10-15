# Hallazgos · Editor de landings (Web Generator, ex Landing Generator, copiado de Gamma)

El editor de landings copiado de Gamma 5 (`app/web-generator` —hasta el 15/10/2026 `app/landing-generator`, que hoy sólo
redirige—, `lib/editor-landing`, `app/l`);
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
- `normalizarUrl` le saca el www y el query: es la LLAVE de `landing_analyses`, no una dirección para bajar. Los hosts
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
  diseno-editor-landing.md): `docs/relevo/crm-tanda-b1.md`, `docs/relevo/dashboard-v4.md`, `docs/dev-tabs-mapa.md`,
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
