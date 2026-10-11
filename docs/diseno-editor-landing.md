# El editor de landings copiado de Gamma: decisiones y contratos

Pedido de Martín (11/10/2026), textual: «Quiero que implementes en la tab de "Landing Generator" un
editor de landing tipo GAMMA. Replica por completo a Gamma, que se pueda hacer todo lo que ahí se
hace.» Y después: «También puedes apoyarte de esto: https://github.com/presenton/presenton».

Este documento fija las DECISIONES y los CONTRATOS entre piezas para que varias manos trabajen en
paralelo sin pisarse (molde: `docs/diseno-curso-skool.md`). El relevo que lo sostiene (6 informes de
solo lectura: interfaz de Gamma 5, catálogo de funciones, tokens visuales medidos, mapa de
integración en MaKo, reuso de `EditorRico`, reuso de Presenton) se cosecha en
`docs/hallazgos-editor-landing.md`.

> Regla de copia (memoria «Copiar una app TAL CUAL»): se copia **igual** a Gamma 5 —layout, nombres
> como Gamma los dice en español, colores, flujo—, con su CSS limitado a un scope propio que NO se
> «arregla» a los componentes de `app/_ui`. Lo que no se copia se dice en el comentario del archivo.
> En una página web Gamma llama **«sección»** a la tarjeta (en presentaciones, «diapositiva»): acá
> siempre «sección».

---

## D1. El documento: TipTap, UN editor por página, `doc: tarjeta+`

- La fuente de verdad es el **JSON de ProseMirror** (jsonb), nunca HTML. Forma, nombres de nodo y
  listas cerradas de atributos: `lib/editor-landing/doc.ts` (puro). Una landing es
  `{ v: 1, paginas: Pagina[] }` (Gamma Sites es multipágina: inicio, gracias, oferta).
- Cada página se edita con **un solo editor TipTap 3** cuyo `doc` sólo admite tarjetas
  (`content: 'tarjeta+'`): deshacer común, arrastrar bloques entre secciones, `/` y barra de formato
  en todo el documento, y la IA opera sobre un JSON. Cambiar de página = `setContent` de la otra
  (el historial de deshacer es por página).
- **Sin dependencias de TipTap nuevas**: el menú `/`, la barra flotante, el asa de bloques y los ids
  se escriben a mano (`@tiptap/suggestion`, `extension-drag-handle` y `unique-id` no están; los dos
  primeros menús existen sólo como opcionales transitivos y no se usan). Lo instalado y medido:
  `docs/hallazgos-editor-landing.md` → «Qué hay de TipTap».
- Se HEREDAN las trampas resueltas de `app/_ui/EditorRico.tsx` (lista de 29 en el relevo):
  `immediatelyRender: false`, `shouldRerenderOnTransaction: false` + `useEditorState`, la barra no le
  roba el foco (`onMouseDown` + `preventDefault`), subidas con la posición corrida por
  `transaction.mapping`, pegado de Word limpio, `setContent(v, { emitUpdate: false })`, Ctrl+Z nativo
  del texto gana, paneles portaleados y registrados en la pila de modales.

## D2. Los datos: tablas nuevas; `landing_drafts` no se toca

Migración **0246** (revisar el número con `ls supabase/migrations | sort | tail` justo antes de
commitear: hay sesiones paralelas). Cabecera: **ANTES o JUNTO con el deploy** (el código nuevo la lee).

| Tabla | Para qué |
|---|---|
| `landing_docs` | una fila por landing: `titulo`, `contenido jsonb`, `config jsonb`, `version int` (concurrencia optimista), `slug text` (único global, parcial `where slug is not null`), `publicado jsonb` (la FOTO servida: `{ paginas: [{ruta, html, titulo, descripcion}], css, fuentes, version }`), `publicado_at`, `publicado_version int`, `sitio_activo bool`, `vista_token text` (link privado al borrador, único parcial), `favorito`, `carpeta`, `papelera_at`, `creado_por` (sub), `creado_por_nombre`, `created_at`, `updated_at` |
| `landing_doc_versiones` | historial: `doc_id → landing_docs on delete cascade`, `titulo`, `contenido`, `config`, `motivo`, `autor`, `created_at` |
| `landing_doc_comentarios` | `doc_id`, `tarjeta_id text`, `parent_id`, `texto`, `autor_sub`, `autor_nombre`, `resuelto`, `created_at` |
| bucket `landing-imagenes` | **público**, `allowed_mime_types` png/jpeg/webp/gif/mp4/webm (**nunca svg**: XSS bajo nuestro dominio), path `<ws>/<uuid>.<ext>` |

- Las tres tablas: `workspace_id bigint not null references workspaces on delete cascade`, índice por
  ws, RLS prendida + `revoke all … from anon, authenticated`.
- Van a `TENANT_TABLES` (`lib/workspace.ts`), a `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts`,
  alfabético) y el bucket a `BUCKETS` (`lib/reset-workspace.ts`).
- **La página pública NO usa `getTenantDb`** (sin cookie cae al ws1, un cliente): lee con
  `getSupabaseServer()` por slug o por token.
- `landing_drafts` (el generador anterior) queda como está: la leen 5 lugares con la forma de
  `LandingSpec` (`lib/api-mako/areas/landing.*`). Sus filas se ofrecen en «Importar → Del generador
  anterior» y se convierten con `specADoc`.
- Temas propios del workspace: `app_settings` clave `landing.temas` (lista validada).

## D3. Un renderizador y una hoja: lo que se edita es lo que se publica

- `lib/editor-landing/render.ts` (puro, sin DOM): JSON + tema → HTML string. Escapa TODO texto y
  sólo conoce los nodos/atributos de `doc.ts` (lo que no conoce no sale). Lo usan: la publicación
  (foto en `landing_docs.publicado`), la vista previa privada, la exportación (HTML, PDF, PNG, PPTX),
  las miniaturas de la tira y del Panel, y el modo Presentar. **Es la única fábrica de HTML público.**
- `lib/editor-landing/css.ts`: `CSS_CONTENIDO`, la hoja ÚNICA del contenido, en `em` relativos a la
  sección (tokens medidos en `docs/hallazgos-editor-landing.md` → «Tokens de Gamma»), con su
  versión responsive. La comparten el editor y la página publicada.
- `lib/editor-landing/temas.ts`: catálogo de temas (`TEMAS`, `Tema`, `temaPorId`), las variables CSS
  de un tema (`varsDeTema(tema): Record<string,string>` y `estiloDeTema(tema): string` para ponerlas
  INLINE en cada raíz `.gm-doc` — así conviven varias miniaturas con temas distintos) y
  `urlFuentes(temas)` (Google Fonts).
- **Contrato de clases del CONTENIDO** (lo emiten igual `render.ts` y los NodeViews/`renderHTML` del
  editor; prefijo `gm-`):

```
.gm-doc (vars del tema inline)  > .gm-fondo  > .gm-pagina
  section.gm-tarjeta#t-<id>[data-diseno][data-ancho][data-alinea][data-alto][data-fondo][data-superposicion]
    > .gm-tarjeta-fondo                 (pinta fondo, sombra y radio; absoluto, detrás)
    > .gm-acento[data-ajuste]           (background-image; style con url y background-position)
    > .gm-tarjeta-cuerpo                (los bloques)
bloques: h1..h4 (h1.gm-titulo = el «Título» grande) · p[data-variante] · ul/ol/li · ul[data-type=taskList]
  · blockquote · hr · .gm-tabla > table
  · .gm-columnas[style="--gm-cols: 4fr 8fr"][data-divisores] > .gm-columna
  · .gm-optimizado[data-variante][data-cols][data-iconos] > .gm-item[data-destacado] > .gm-item-marca + .gm-item-cuerpo
  · .gm-botones[data-alinea] > a.gm-boton[data-variante]
  · aside.gm-recuadro[data-tono] > .gm-recuadro-icono + .gm-recuadro-cuerpo
  · details.gm-desplegable > summary.gm-desplegable-titulo + .gm-desplegable-cuerpo
  · figure.gm-imagen[data-ancho][data-alinea][data-forma] > (a >) img
  · figure.gm-video > video · .gm-insertado > iframe · .gm-html > iframe[sandbox]
  · form.gm-formulario · .gm-grafico > svg · .gm-espaciador[data-alto]
marcas: strong em u s a · span[data-color] · mark[data-color] · span[data-tam] · span.gm-etiqueta
sitio: nav.gm-nav · footer.gm-pie · a.gm-marca («Hecho con MaKo»)
```

- El **chrome** del editor (barras, paneles, menús) vive en otra hoja y otro prefijo: `.gma`
  (`app/landing-generator/gamma.css`, importada desde los componentes cliente como `github.css` en
  /api-mako). Colores y tipografía de la UI de Gamma medidos (titanium/trueblue/aurora); la fuente
  de UI de Gamma (PP Mori) no está en Google Fonts: se usa la más cercana libre y se dice en el
  comentario. Modo oscuro: `[data-tema="oscuro"] .gma { … }` redefiniendo tokens.

## D4. Publicar: `/l/<slug>` como route handler con HTML completo

- `app/l/[slug]/route.ts` y `app/l/[slug]/[ruta]/route.ts` devuelven el HTML ENTERO de la foto
  (`publicado`), sin pasar por el layout raíz (sin sidebar, sin pollers, sin Suspense). GET/HEAD.
  `app/l/vista/[token]/route.ts` sirve el BORRADOR por el link privado (`noindex`). Van en `PUBLICOS`
  (`lib/rutas-publicas.ts`) y su test.
- **Publicar promueve lo GUARDADO** (AGENTS.md «Un BORRADOR no es un DEFAULT»): la pantalla manda
  lo pendiente primero (cancela el respiro), y el server renderiza desde la fila, no desde el body.
  «Tienes cambios que publicar» = `updated_at > publicado_at`. Slug: `slugValido` de `doc.ts`, único
  global, primer reclamante gana.
- La página publicada carga el **Pixel de MaKo** del workspace (`lineaCargador(getOrCreateLandingToken(ws))`):
  la mide el Landing Analyst y el bloque Formulario entra al CRM por el opt-in que el Pixel ya captura
  (`<form>` real con `type=email`/`type=tel`/`name=nombre`; un script inline propio sólo hace
  `preventDefault` y muestra el mensaje de éxito o redirige — nunca un GET con datos en la URL). La
  vista previa del editor y el link privado **no** cargan el Pixel.
- **Nada de JavaScript de terceros en `hola-mako.com`**: la sesión de MaKo es una cookie del mismo
  origen y un script ajeno podría llamar `/api/*` como el que mira. Por eso NO se copian «código
  personalizado» ni Google Tag Manager; sí el **Píxel de Meta** (el código oficial, armado por el
  server con un id de sólo dígitos). El bloque «HTML personalizado» va en `<iframe sandbox="allow-scripts">`
  con `srcdoc`: origen opaco, como lo hace Gamma.
- `X-Frame-Options: DENY` es de toda la app: no se ofrece «Insertar en otra web». Dominio propio: el
  proxy contesta 410 a otros hosts — queda afuera de esta tanda y se dice.

## D5. IA: gratis por default, prompts editables, la misma red del resto

- Dos features en `lib/model-catalogo.ts`, `def: GEMINI()`, sin `fallback: []`:
  `landing-editor` (esquema, secciones, importar) y `landing-editor-ia` (editar, texto, diseños,
  notas). Etiquetas en `lib/ia-labels.ts`. Claude vetado (nada en `CLAUDE_PERMITIDO`).
- Se llama con `chatClaude(system, [{role:'user', content}], { feature, motivo, maxTokens })` (respeta
  `/modelos-ia`). Errores con `errorDeCascada`. JSON con `parseJsonObject` + UN paso de reparación por
  la cascada barata; si igual no sale, error con la salida cruda en el log. **Nunca más de un
  reintento propio** (presenton reintenta hasta 12 veces: no se copia).
- Prompts en el registro editable (`lib/prompt-registry.ts`, grupo «Editor de landings»), en español
  NEUTRO (el guard de voseo barre los strings), con `brandSystem` y el bloque de idioma del copy del
  cliente. Contexto del negocio: el mismo brief del generador anterior (funnel + perfil + diagnóstico
  del Landing Analyst si hay `basadoEnUrl`) — se exportan de `lib/landing-writer.ts`, no se copian.
- **Gramática de la IA** (`lib/editor-landing/ia-bloques.ts`, puro, con test): la IA no escribe
  JSON de ProseMirror; escribe bloques simples (`{t:'h2', texto}`, `{t:'optimizado', variante, items}`…
  con `**negrita**`, `*cursiva*` y `[link](url)` en el texto) que el código convierte a tarjetas, y
  `tarjetaABloques` hace la vuelta para «Editar con IA». La validación de la vuelta es determinista
  (variantes de la lista cerrada, topes, «no inventes testimonios» chequeado en código donde se
  pueda).
- **Generación en dos pasos, como Gamma**: esquema (rápido) → la persona lo edita → secciones en
  tandas de 3 (cada pedido < 60 s, la pantalla las va revelando). `fetch` con
  `AbortSignal.timeout`. Imágenes: la IA propone la búsqueda (en inglés) y el server la resuelve con
  la búsqueda de stock (D6), en paralelo acotado; si falla, la sección queda sin imagen (no un
  placeholder que mienta).
- **«Generar imagen con IA» va por GOOGLE FLOW** (decisión de Martín, 11/10/2026, entre «Flow», «API
  paga con cupo» y «por ahora no»): el mismo puente de la extensión que usa el Video Generator, con la
  cuenta y los créditos de Google del CLIENTE — a MaKo no le cuesta nada. Es asíncrono (cola +
  sondeo), necesita la extensión, y la URL que devuelve Flow VENCE: el resultado se copia al bucket
  `landing-imagenes` antes de ponerlo en el documento. Sin extensión conectada, la pestaña lo dice y
  lleva a conectarla (no hay botón muerto). Se construye después del primer armado, sobre
  `lib/flow-imagen.ts` / `lib/flow-cola.ts`.

## D6. Imágenes

- Subir: firma (`createSignedUploadUrl`) → el navegador sube con XHR y progreso real → el server
  registra verificando que exista y sus **magic bytes** (`sniffImagen` de `/api/portadas`). Nunca por
  server action (tope de 1 MB).
- Buscar: Openverse + Picsum, la lógica que ya vive en `app/api/portadas/route.ts` **se muda a una
  lib** (`lib/imagenes-stock.ts`) y la usan las dos rutas; al elegir, se copia al bucket
  `landing-imagenes` (el navegador manda el ID, nunca una URL: anti-SSRF).
- Desde un enlace: baja con la guarda de `lib/landing-fetch.ts` (`validarDestino`) y la copia.
- Biblioteca multimedia: lo subido por el workspace al bucket.
- `render.ts` sólo acepta `src` del bucket público propio (`${SUPABASE_URL}/storage/v1/object/public/landing-imagenes/`).

## D7. Exportar

PDF (vista de impresión: una sección por hoja, `window.print()`), PNG (una imagen por sección en
un .zip; `html-to-image`, carga perezosa), PPTX (una diapositiva por sección con título, texto,
viñetas, imagen y notas; `pptxgenjs`, carga perezosa) y HTML (un archivo autocontenido). Las dos
dependencias se fijan en versiones con más de dos semanas.

## D8. Colaborar, versiones, analítica, presentar

- Edición en tiempo real: NO (sin infraestructura de presencia). Concurrencia optimista: `guardar`
  exige la `version` que se abrió; si otro guardó, la pantalla lo dice y ofrece recargar.
- Comentarios por sección (tabla de D2), con respuestas y «Resolver».
- Historial de versiones: se guarda una versión al publicar, antes de aplicar un cambio de la IA,
  al restaurar, a mano («Guardar versión») y sola cada 10 minutos de edición (el server decide).
- Análisis: visitas, visitantes y leads de los últimos 30 días de las URLs publicadas
  (`landing_visits`, `normalizarUrl`), el alcance por sección si el Pixel lo midió (`null` = no
  medido, nunca 0) y el link al Landing Analyst.
- Presentar: pantalla completa, una sección por vez, flechas, Esc, «Destacar» (S) y notas del orador.

## D9. La tab

- La key del nav sigue siendo `landing-writer` (contrato en la base). Rutas: `/landing-generator`
  (Panel), `/landing-generator/crear` (crear con IA), `/landing-generator/<id>` (editor a pantalla
  completa). `/landing-writer` redirige reenviando la query (hoy la pierde: bug del deep link).
- El deep link del Landing Analyst (`?url=`) abre «Crear» con esa landing de base.
- Onboarding: los pasos `generar` y `guardar` se siguen marcando (primera generación, primer
  guardado); se suma `lg_publicar` OPCIONAL.
- `lib/mako-capacidades.ts`, `app/admin/dev/areas.ts` (con `hallazgos`), la bitácora del área con
  el pedido literal, y `docs/hallazgos-editor-landing.md` + índice.

---

## Mapa de archivos (quién escribe qué)

Contratos ya escritos (no se cambian sin avisar): `lib/editor-landing/doc.ts`,
`lib/editor-landing/catalogo-bloques.ts`, `lib/editor-landing/api-tipos.ts`,
`app/landing-generator/editor/contexto.ts`.

| Paquete | Archivos (dueño único) |
|---|---|
| A · Núcleo | `lib/editor-landing/especificacion.ts` (la forma HTML de cada nodo: la usan `render.ts` y los `renderHTML` de las extensiones), `render.ts`, `validar.ts` (`sanearContenido`, `sanearConfig`, descartes con motivo), `grafico-svg.ts` (gráficos como SVG puro), tests |
| B · Visual | `lib/editor-landing/temas.ts`, `css.ts`, `iconos.ts` (subset generado de Phosphor, MIT, con aviso) + `scripts/gen-iconos-landing.mjs` |
| C · Contenido | `lib/editor-landing/plantillas.ts` (landings completas + «diseños de sección»), `ia-bloques.ts` (gramática ↔ tarjetas), `spec-a-doc.ts` (LandingSpec → contenido), tests |
| D · Server | `supabase/migrations/0246_editor_landing.sql`, `lib/editor-landing/server.ts`, `lib/editor-landing/server-reglas.ts` (lo puro de server.ts: un `server-only` no lo importa ningún test), `lib/editor-landing/publicar.ts`, `lib/imagenes-stock.ts` (+ que `app/api/portadas/route.ts` la use), `app/api/landing-generator/route.ts`, `app/api/landing-generator/imagenes/route.ts`, `lib/workspace.ts` (TENANT_TABLES), `lib/tablas-de-inquilino.ts`, `lib/reset-workspace.ts`, tests |
| E · IA | `lib/editor-landing/ia.ts`, `lib/editor-landing/ia-reglas.ts` (lo puro: prompts, tandas, validación; lleva el aviso Apache-2.0 de Presenton), `app/api/landing-generator/ia/route.ts`, `app/api/landing-generator/importar/route.ts`, `lib/model-catalogo.ts`, `lib/ia-labels.ts`, `lib/prompt-registry.ts`, exports de `lib/landing-writer.ts`, tests |
| F · Público | `app/l/[slug]/route.ts`, `app/l/[slug]/[ruta]/route.ts`, `app/l/vista/[token]/route.ts`, `app/l/vista/[token]/[ruta]/route.ts` (las otras páginas del borrador, sumada en la integración), `lib/editor-landing/pagina-publica.ts` (documento HTML completo: head, SEO, OG, favicon, fuentes, Pixel, Meta, script del formulario), `lib/rutas-publicas.ts` + su test |
| G · Motor del editor | `app/landing-generator/editor/extensiones/*` (todos los nodos y marcas, ids, placeholder por nodo, el menú `/` como plugin), `editor/nodos/*` (NodeViews React: tarjeta con sus controles e imagen de acento, imagen, video, insertado, formulario, gráfico, HTML libre), `editor/insertar.ts` (`insertarBloque`, `moverTarjeta`, `duplicarTarjeta`…), `editor/MenuBarra.tsx` (el `/`), `editor/BarraFormato.tsx`, `editor/AsaBloque.tsx` |
| H · Armazón | `app/landing-generator/[id]/page.tsx`, `editor/EditorLanding.tsx` (barra superior, toolbar con Edición manual / Edición con IA, deshacer, «Agregar bloque», tira de secciones, lienzo, autoguardado, atajos, zoom, vista previa por dispositivo, proveedor del contexto), `editor/AgregarBloque.tsx`, `editor/TiraSecciones.tsx`, `editor/PanelPaginas.tsx`, `app/landing-generator/gamma.css` |
| I1 · Paneles A | `editor/paneles/PanelTema.tsx` (+ editor de tema), `editor/dialogos/piezas-gma.tsx` (las piezas de Gamma que comparten sus siete componentes), `editor/paneles/EstiloSeccion.tsx`, `editor/dialogos/DialogoPublicar.tsx` (sitio: slug, SEO, favicon, OG, nav, pie, indexar, Píxel de Meta), `editor/dialogos/DialogoCompartir.tsx`, `editor/dialogos/DialogoExportar.tsx` + `lib/editor-landing/exportar-*.ts`, `editor/dialogos/DialogoConfiguracion.tsx` |
| I2 · Paneles B | `editor/paneles/PanelAgente.tsx` (Edición con IA: chat, alcance, Original/Modificado, aceptar/restaurar), `editor/diff-tarjetas.ts` (lo puro del Original/Modificado), `editor/AskAgent.tsx` (el popover ✨ de una sección), `editor/paneles/PanelComentarios.tsx`, `editor/paneles/PanelHistorial.tsx`, `editor/dialogos/DialogoAnalitica.tsx`, `editor/Presentar.tsx`, `editor/SelectorImagen.tsx`, `editor/dialogos/DialogoAtajos.tsx` |
| J · Panel y crear | `app/landing-generator/page.tsx`, `app/landing-generator/Inicio.tsx` (Panel: gammas, recientes, favoritos, carpetas, plantillas, temas, papelera, búsqueda, grilla/lista), `app/landing-generator/crear/page.tsx`, `crear/CrearConIA.tsx` (la caja de Gamma 5 «¿Qué quieres crear?» + el generador clásico: Generar · Pegar texto · Importar · Plantillas → Esquema → Tema → generando en vivo) |
| K · Cierre (orquestador) | `app/landing-generator/cliente.ts` (los pedidos a las rutas y la letra del chrome, en UN módulo sin `'use client'`: había cuatro copias), nav, onboarding, `lib/mako-capacidades.ts`, `app/landing-writer/page.tsx`, retiro de `LandingWriterApp.tsx`, `app/admin/dev/*`, tests de integración, build, hallazgos |

## Contratos entre paquetes

- **A → G, H, I, J**: `htmlDeTarjeta(t, tema, op?)`, `htmlDePagina(p, config, tema, op?)`,
  `documentoPublico(...)` lo arma F sobre `htmlDePagina`. `especificacion.ts` exporta una función por
  nodo que devuelve `DOMOutputSpec` (`['section', {class, 'data-…'}, 0]`): G la llama desde
  `renderHTML`, A la serializa en `render.ts`. Un solo lugar decide la forma HTML de cada nodo.
- **B → todos**: `Tema`, `TEMAS`, `temaPorId(id, propios?)`, `estiloDeTema(t)`, `varsDeTema(t)`,
  `urlFuentes(temas)`, `CSS_CONTENIDO`, `ICONOS` + `svgIcono(nombre)` + `buscarIconos(q)`.
- **C → E, J**: `PLANTILLAS` (`{ id, nombre, descripcion, tema, contenido() }`), `DISENOS_SECCION`
  (`{ id, nombre, crear(): JsonNodo }`), `bloquesATarjeta`, `tarjetaABloques`, `GRAMATICA_IA` (el texto
  que se le pega al prompt describiendo los bloques), `specADoc`.
- **G → H, I**: `extensionesLanding(op)` (`op: { subirArchivo, elegirImagen, placeholder? }`),
  `insertarBloque(editor, id: IdBloque, op?)`, `moverTarjeta`, `duplicarTarjeta`, `borrarTarjeta`
  (con 5 s de deshacer del MISMO nodo), `tarjetaEnCursor(editor)`.
- **D, E, F → pantalla**: exactamente `lib/editor-landing/api-tipos.ts`.
- **H → piezas**: exactamente `app/landing-generator/editor/contexto.ts`.

## Reglas que muerden acá (además de AGENTS.md entero)

- Español NEUTRO en todo string (tú/tienes/puedes): el guard de voseo barre `app/` y `lib/`.
- Texto que se dibuja CORTO (toast 3-4 palabras, rótulo = el nombre de la cosa).
- `Link`/`useRouter` de `@/app/_ui/Link`; `window.location` con `conWs`.
- Todo `<Modal>` con `onCerrar` de identidad fija; paneles flotantes portaleados y en la pila.
- Nada de `<select>` nativo; borrar = tacho rojo (`BotonBorrar`).
- Un botón pegado abajo a la derecha lleva `data-esquina-ocupada`.
- Sin `'use server'` nuevos (todo por route handlers); si hubiera uno, sólo exporta funciones async.
- Tests: `node --import tsx --test tests/<x>.test.ts`; cada test nuevo se prueba ROMPIÉNDOLO y el
  resultado de la rotura va en su comentario con números.

---

# Tanda 2 (11/10/2026, tarde): el feedback de Martín sobre el Panel, presentaciones, diagnóstico y publicar

Pedido textual (con dos capturas del Panel en producción):

> 1. Aún no se ve igual... Muchos botones a la derecha.
> 2. "Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la derecha.
> 3. Elimina las tab de "Recientes, creadas por mi, publicadas y favoritas". También elimina la tab de "landings", que en la sidebar aparezcan las landings creadas/analizadas con el nombre de las mismas... Y también elimina el botón de "diagnostico" de la sidebar, en su lugar que esté dentro de los 3 puntos que debe tener cada landing, junto a otros botones como renombrar, eliminar, archivar, duplicar, etc... También elimina la funcionalidad de "carpetas".
> 4. También agrega el botón de "Nueva landing" como placeholder en el primer puesto arriba de las demás landing.
> 5. Falta la funcionalidad de crear presentaciones, no solo landings... Diapositivas, tal cual como lo hace gamma.
> 6. Al momento de crear nuevo tengo que elegir si crear landing, presentación... Sería bueno que ahí aparezcan los templates (deberías hacer más templates de presentaciones)... Y también quiero ahí mismo agregar la funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar la funcionalidad de dictarle con audio, como lo tenemos en donde te mencioné.
> 7. También quiero que al analizar una landing sea como un "tutorial" de los que tenemos en MaKo, que se ponga opaco y señale el lugar donde se esta haciendo el comentario, y luego que queden guardados todos los comentarios y sugerencias y claro, la opción de solucionarlo allí mismo con IA.
> 8. También si traigo una landing de afuera, tiene que funcionar el paso anterior, se tiene que previsualizar y comenzar con los "comentarios"... Y me gustaría si es una landing de afuera tener la opción de replicarla con nuestro editor.
> 9. Si se tiene que poder editar libremente con "HTML personalizado", esto permitirá copiar otras landing...
> 10. Y claro, falta la opción de publicar, ya sea con una URL creada por MaKo, como lo hace Gamma, o la opción de traer tu dominio.

## Decisiones de la tanda 2

- **T1 · El Panel es una barra lateral de DOCUMENTOS, no de filtros** (puntos 1, 3, 4). Se van Landings,
  Recientes, Creadas por mí, Favoritos, Publicadas, Diagnóstico y Carpetas (la columna `carpeta` queda en
  la tabla sin uso). La barra lista las landings y presentaciones POR NOMBRE (ícono según el tipo, las
  analizadas de afuera también), con «+ Nueva landing» como primer renglón, y cada renglón con su «⋯»:
  Abrir, Diagnóstico, Renombrar, Duplicar, Archivar (= papelera, restaurable), Eliminar (tacho rojo).
  Plantillas, Temas y Papelera quedan abajo. La derecha es la caja «¿Qué vas a crear hoy?» con muchos
  menos botones (se van Crear nuevo/Nuevo desde cero/Importar/Ordenar/Cuadrícula/Lista como fila de botones).
- **T2 · El Diagnóstico se abre a la DERECHA del Panel** (punto 2), no en otra ruta: seleccionar
  «Diagnóstico» de una landing (o pegar una URL de afuera) dibuja el análisis en el área principal.
  `/landing-generator/analizar` (lo montó la sesión Graphics al retirar el Landing Analyst) pasa a
  redirigir al Panel con la landing abierta en diagnóstico.
- **T3 · Presentaciones** (punto 5): `config.formato: 'pagina' | 'presentacion'` y, en presentación,
  `config.proporcion: '16:9' | '4:3' | 'fluido'`. Cada sección es una DIAPOSITIVA de proporción fija
  (CSS `aspect-ratio`, guías de desbordamiento como Gamma), la UI dice «diapositiva», Presentar es la
  acción principal (en vez de Publicar), y la IA genera diapositivas (menos texto, más diseños
  optimizados). ~12 plantillas de presentación propias (pitch, propuesta comercial, informe mensual,
  caso de éxito, onboarding de cliente, plan de marketing, webinar, clase de curso, roadmap, equipo,
  ventas, reporte de resultados).
- **T4 · Crear** (punto 6): la caja «¿Qué vas a crear hoy?» con selector Landing | Presentación, el
  micrófono `BotonDictar` (el de «Nueva automatización»: en vivo con el reconocimiento del navegador y,
  de respaldo, grabar y transcribir) y el ejemplo que se escribe solo (`useEjemploQueSeEscribe`), y
  debajo las plantillas del tipo elegido.
- **T5 · Diagnóstico como RECORRIDO** (puntos 7, 8): previsualización de la landing (la nuestra, con el
  render; la de afuera, con su HTML bajado por `lib/landing-fetch.ts` y servido aislado), y un recorrido
  como los de MaKo (`RecorridoAutomations`): la pantalla se oscurece y el foco señala el bloque al que
  apunta cada comentario (se ubica por la cita textual del hallazgo). Los comentarios/sugerencias quedan
  GUARDADOS por landing, con estado (pendiente / resuelto / descartado) y «Solucionar con IA» (en una
  landing nuestra, «Editar con IA» sobre esa sección). Para una de afuera: «Replicar en el editor».
- **T6 · HTML libre de verdad** (punto 9): una sección puede ser «Formato libre (HTML)»: HTML/CSS/JS
  propios editables con código y vista en vivo. En la publicada se sirve desde su PROPIA URL con
  `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups` (origen opaco: no toca la
  sesión de MaKo) y el iframe se ajusta al alto por `postMessage`. «Replicar» una landing de afuera
  arma secciones así cuando la conversión a bloques no es fiel.
- **T7 · Publicar con dominio propio** (punto 10): además de `hola-mako.com/l/<slug>` (la URL de MaKo),
  «Conectar tu dominio»: se registra en el proyecto de Vercel por API (`VERCEL_API_TOKEN`,
  `VERCEL_TEAM_SLUG`), se muestran los registros DNS a cargar, se verifica el estado, y `proxy.ts`
  sirve en ESE host sólo la landing publicada (nada de la app ni de `/api`, salvo lo que la página
  necesita). Subdominios `<slug>.hola-mako.com` quedan fuera (necesitan DNS comodín: lo decide Martín).
