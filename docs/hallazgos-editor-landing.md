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
  bloque «HTML personalizado» **no ejecuta scripts en la publicada** aunque en el editor sí. Pendiente
  (abajo).
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
- **HTML personalizado en la publicada**: servirlo desde su propia URL con
  `Content-Security-Policy: sandbox allow-scripts` (p.ej. `app/l/html/[docId]/[bloque]`) y renderizar con
  `src`; hoy en la publicada no corre JS.
- **No copiado de Gamma, a propósito**: Formato libre (posicionamiento absoluto por bloque), edición en
  tiempo real, dominio propio (el proxy contesta 410 a otros hosts), insertar la landing en otra web
  (`X-Frame-Options: DENY`), Google Tag Manager y código personalizado, Imagine, la caja de agente de
  Gamma 5 con preguntas (se usa el generador clásico con modo Plan/Express).
- **API de MaKo**: listar/ver/publicar landings no están en el registro (`lib/api-mako/areas/landing.*`):
  existen para la pantalla y no para los agentes.
- Se borró `app/api/landing-writer/route.ts` (no la llamaba nadie): al integrar en el clon hay que correr
  `npx next typegen` para que `.next/types/validator.ts` deje de nombrarla.
