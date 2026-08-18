// =============================================================================
// Carousels — el registro de construcción del área
// =============================================================================
// Alcance: la tab de Content Machine que arma el carrusel de Instagram lámina
// por lámina — pedido (tema + tipo educativo/storytelling/venta) → slides
// tipadas (texto adentro de la imagen + escena visual) + caption → borrador en
// /instagram. Vive en: app/carousels/ (page, CarouselsApp, OnboardingCarousels,
// actions) sobre el motor compartido lib/ig-writer.ts, la fuente única
// lib/ig-formatos.ts y el puente lib/ig-contenido.ts; la feature
// `carousels-writer` en lib/model-catalogo.ts y los pasos `carousels_*` en
// lib/tab-onboarding-state.ts.
//
// De dónde salió esto: el `pedido` del 7/8 es textual, de la sesión «Rediseño:
// sidebar y nueva navegación» (docs/chats.md → docs/chats/chat-redise-o-por-
// partes-88457d97.md); fechas, horas, shas y tamaños salen de `git log` sobre
// esas rutas; las trampas, de docs/hallazgos-comunicacion.md → «Los writers de
// contenido IG (Reels / Carousels / Stories)».
//
// ⚠️ El hito del 9/8 explica por qué esta bitácora hacía falta: el Change
// History AUTOMÁTICO de esta área muestra doce commits, los mismos doce que
// muestra Reels, y ninguno habla de la tab.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La ruta, sin prometer de más', detalle: 'Nace en el sidebar con chip «pronto» y ComingSoon · el nombre de la tab es el de la ruta', estado: 'hecha' },
  { titulo: 'La metodología, con su AVISO de cobertura', detalle: 'Los cursos comprados tienen POCO de carrusel y el módulo lo declara · lo demás son las reglas del reel trasladadas', estado: 'hecha' },
  { titulo: 'El motor: pedido → slides TIPADAS', detalle: 'lib/ig-writer.ts compartido · el mínimo RECHAZA con motivo y el máximo recorta, y cada decisión está justificada aparte', estado: 'hecha' },
  { titulo: 'Del carrusel al borrador de /instagram', detalle: 'crearBorradorPublicacion escribe en contenido_posts sin tocar Zernio · las notas de producción van anexadas a la caption con rótulo', estado: 'hecha' },
  { titulo: 'Onboarding con salida', detalle: 'WizardShell embebido que NO tapa el sidebar · la cuenta de Instagram no bloquea · «Lo configuro después» cierra con estado de cliente', estado: 'hecha' },
  { titulo: 'Historial que sobreviva a un F5', detalle: 'Hoy vive en memoria de la página y se pierde al recargar; la tab lo dice en pantalla en vez de fingir que guarda', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── agosto: la promesa ─────────────────────────────────────────────────────
  {
    fecha: '7 ago', hora: '02:31', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Carousels nace de una decisión de navegación, no de una necesidad de contenido',
    pedido: '2. Te había pedido que al pasar el cursor por las tabs estas interactuen, como lo hacen las secciones.\n3. Quiero que "Content Machine" sea otra sección más, dentro tendrá "Ideas" luego un desplegable llamado "Ads" que contenga "Ads Writer" - "Image Generator" - "Video Generator". Luego otro desplegable llamado "Instagram" con "Reels" - "Carousels" - "Stories". Por último uno que sea "YouTube" con "YouTube Writer" - "Thumbnails". Los 3 desplegables con los logos reales, utiliza el de Meta para el caso de Ads. Y bueno para Ideas un foco o algo así.',
    puntos: [
      'El área no empezó por el producto: empezó porque **Content Machine dejó de ser un ítem de Create y pasó a sección propia con un grupo por canal**. Carousels es uno de los ocho destinos que se crearon esa madrugada, y el criterio está escrito en el commit: «no es UNA herramienta: es un taller con secciones por canal, y cada canal tiene sus formatos».',
      'La regla que se aplicó al crearlas: **todas nacieron con el chip «pronto»** — «no hay backend todavía y prometer lo que no existe es peor que no tenerlo». El nombre de la tab es el mismo que el de la ruta, sin excepción.',
      '⚠️ Un efecto lateral de abrir ocho proyectos con nombre de formato, medido cinco días después del lado del tablero: la tarea «Definir la escalera de contenidos estilo podcast» **caía en «Feature: Reels» por parecido de palabra**, porque la capa de estrategia del contenido no tenía destino propio. Se resolvió sumando «Content Machine» al catálogo de proyectos, no tocando estas tabs. Y en el mismo barrido «Feature: Carousels» quedó como el caso testigo de que **un proyecto con una sola tarea puede ser perfectamente legítimo**: es una tab real del sidebar (docs/hallazgos-plan.md).',
    ],
    commits: [{ sha: '72984b8f', msg: 'Rediseño · el hover roto, Content Machine como sección y tus tres íconos', lineas: 202, archivos: 12 }],
  },

  // ── agosto: el registro ────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '01:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El área entra al mapa de /admin/dev, y su historial es el de Reels',
    puntos: [
      'El Change History de un área **no se escribe: se DERIVA**. `scripts/gen-dev-historial.mjs` corre `git log` sobre las rutas del `vive[]` y se queda con los últimos `POR_AREA = 12`. Carousels entró al mapa declarando **dos** rutas: `app/carousels/page.tsx` y `app/_components/nav.ts`.',
      '⚠️ **Medido el 17/08 sobre `_historial.generado.ts`: los 12 commits del bloque `"carousels"` son sha por sha los mismos que los de `"reels"`, y ninguno habla de ninguna de las dos tabs.** Son todos de `nav.ts`: la barra de super admin, Products & Offers entrando al sidebar, la puerta de /admin/dev. La lección es más fina que «una ruta que apunta a la nada»: acá la ruta existe y anda, y el daño lo hace **un archivo compartido y caliente compitiendo por los mismos doce lugares** contra las rutas propias del área. Dos áreas distintas terminaron mostrando el historial de un tercer archivo.',
      'Segunda mitad del punto ciego: el generado **se corre a mano, no en el build**. El archivo se generó el 11/08, así que `a3d0ffb0` —la corrida que construyó la tab entera cuatro días después— no aparece. Un historial derivado que no se regenera envejece igual que uno escrito a mano, y sin avisar.',
      'La guarda que sí existe (`tests/dev-areas.test.ts`) chequea contra el disco que cada ruta del `vive[]` exista. Lo que **no** puede chequear es la omisión: una ruta que falta no da error, da un punto ciego.',
    ],
    commits: [{ sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 }],
    archivos: [
      'app/admin/dev/areas.ts — el `vive[]` de carousels, ampliado el 17/08 de 2 rutas a las 10 donde cae el trabajo',
      'app/admin/dev/_historial.generado.ts — el bloque `"carousels"`: los 12 commits ajenos, idénticos a los de reels',
      'scripts/gen-dev-historial.mjs — `POR_AREA = 12`, el tope que produce el desplazamiento',
    ],
  },

  // ── agosto: la materia prima ───────────────────────────────────────────────
  {
    fecha: '13 ago', hora: '00:38', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El carrusel es el formato del que los cursos casi no hablan, y el módulo lo declara',
    puntos: [
      '⚠️ **`METODOLOGIA_CARRUSEL` abre con un AVISO DE COBERTURA, y ese aviso es el hallazgo del área.** De los cursos comprados, lo único específico de carrusel son **dos clases de Sell Your Knowledge** (Ramiro Cubria), y enseñan UN solo formato: storytelling estilo cómic/viñetas producido con IA. No hay doctrina de curso sobre cantidad ideal de slides ni sobre taxonomía. En vez de rellenar con reglas de manual, el módulo lo dice en el prompt y manda a aplicar **las reglas del reel trasladadas**: portada = gancho, desarrollo = historia con curiosidad sostenida, cierre = moraleja + CTA con palabra clave. Un writer que declara qué NO sabe es auditable; uno que inventa doctrina no.',
      'Lo que **sí** sale de curso y por eso está escrito con esa fuerza: la **slide 1 es donde el juego se gana o se pierde** —problema visible, sin explicarlo, y sin revelar la solución—; el texto va en **diálogos cortos repartidos dentro de la imagen**, nunca un bloque en una esquina, porque el usuario de Instagram no lee párrafos; y los planos varían entre slides (general → primer plano → cámara por detrás) para que la lectura no se plancha.',
      '⚠️ **La taxonomía que ofrece la tab —educativo / storytelling / venta— NO es de los cursos: es criterio general**, y `app/carousels/actions.ts` lo dice en el comentario. El tipo elegido solo **colorea el pedido** que se le pasa al writer: no cambia el contrato de la pieza ni el saneo. Si mañana alguien la cita como metodología, está citando una decisión de producto.',
      'La regla transversal que hereda del resto de la Content Machine, y que vale igual acá: **la doctrina de hashtags es NEGATIVA** —los cursos los descartan como palanca— y los 125 caracteres de la caption no son doctrina, son dónde trunca la UI de Instagram.',
    ],
    commits: [
      { sha: '79980f0b', msg: 'Sell Your Knowledge entra al portal, y dos trampas de EPERM en Windows', lineas: 2060, archivos: 110 },
      { sha: '071353b1', msg: 'ManyChat Master - Instagram entra a Orgánico: 25 clases, completo', lineas: 407, archivos: 28 },
    ],
  },

  // ── agosto: la tab ─────────────────────────────────────────────────────────
  {
    fecha: '15 ago', hora: '10:44', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab deja de ser una promesa, y el saneo elige distinto en cada punta',
    puntos: [
      '⚠️ **El mínimo RECHAZA y el máximo RECORTA, y las dos decisiones están justificadas por separado.** Con menos de 2 slides el saneo falla con el motivo en vez de rellenar con slides inventadas —«rechazar deja una deuda» y esa deuda la paga el reintento del usuario, nunca un fallback que estaba pensado para otra cosa—; con más de 10 se hace `slice`, porque Instagram no publica más y **las primeras slides son las que cargan el gancho y la historia**. El error caro sería tratar las dos puntas igual.',
      '⚠️ **El tag de la feature es load-bearing y el compilador no lo ve.** `carousels-writer` tiene que existir idéntico en `lib/model-catalogo.ts`; si no coincide, el override no aplica y —como no hay modelo por default— la llamada **queda vetada**, no cae a Claude. Su `def` es `GEMINI()`, gratis.',
      '⚠️ **El historial de esta tab vive en memoria de la página y se pierde al recargar**, y la tab lo dice en pantalla en vez de fingir que guarda. No es descuido: no existe tabla genérica de piezas generadas (`landing_drafts` es del Landing Generator, `contenido_posts` guarda solo lo ENVIADO) y una migración nueva ese día colisionaba con la numeración de otras corridas. Reels sí persiste, en `app_settings` con tope 10. El día que se quiera durable y cross-formato, es UNA tabla con migración coordinada — no copiar el parche de reels acá.',
      '⚠️ **Las notas de producción viajan ANEXADAS a la caption.** `contenido_posts` (mig 0136) no tiene columna para el guion slide a slide: aceptarlas y tirarlas era pérdida silenciosa, así que van pegadas con un rótulo visible que pide borrarlas antes de publicar. Consecuencia asumida: el borrador puede pasar los 2.200 — el tope lo aplica Instagram al publicar. Y `crearBorradorPublicacion` **no es idempotente**: acá lo único que hay es el botón deshabilitado, sin `borradorId` guardado como en reels.',
      '**El onboarding sí abre como wizard, a diferencia de Reels**, y por eso necesitaba salida: `WizardShell` embebido que **no tapa el sidebar**, y «Lo configuro después» / la ✕ cierran con **estado de cliente** (`setSalir`), nunca con `router.refresh()` — un refresh re-corre el guard del server y devuelve el mismo wizard, que es el gemelo ya pagado en el onboarding de tabs. Conectar Instagram no bloquea: escribir no necesita la cuenta, publicar sí, y publicar vive en /instagram.',
      '⚠️ **Queda vivo un desacuerdo de keys entre las tres tabs hermanas.** Reels y Stories usan la key COMPARTIDA `conectar` (conectar en /instagram las marca solas); Carousels se inventó `carousels_instagram`, opcional, que **nunca se marca desde ningún lado** — el comentario del propio archivo dice que es un aviso, no una tarea. El pendiente escrito es que las tres usen la compartida. El prefijo `carousels_` en los otros dos pasos, en cambio, está bien puesto a propósito: `contexto`/`ensayo` pelados **colisionan** vía `KEY_PASOS_COMPARTIDOS` con el Chat Agent y con Instagram, y terminar el ensayo acá marcaría el ensayo de otra tab.',
      '⚠️ **Y una deuda de UI:** `CarouselsApp.tsx` importa de `app/_ui` solo `Pagina` y `Button`, y define a mano su tipografía, su eyebrow, sus cajas y su textarea. Reels usa la biblioteca entera (`Field`, `Select`, `Alert`, `Status`, `Mako`, `MONO`). Son dos tabs hermanas del mismo grupo que ya divergieron en el primer día — que es exactamente cómo empiezan los cinco tratamientos de la misma pieza que el sistema de diseño vino a unificar.',
      '⚠️ **Los prompts del writer son constantes locales, con TODO puesto:** el archivo de `prompt-registry` estaba tomado por una sesión paralela ese día. Hoy **no son editables desde /configuraciones**. Migrarlos con la skill `add-editable-prompt` cuando se libere.',
    ],
    commits: [{ sha: 'a3d0ffb0', msg: 'Content Machine IG (Reels/Carousels/Stories) + onboarding Zernio-first', lineas: 3613, archivos: 29 }],
    archivos: [
      'lib/ig-formatos.ts — `LIMITES_CARRUSEL` (2..10, mezcla imagen/video, userTags, firstComment) y `METODOLOGIA_CARRUSEL` con su aviso de cobertura',
      'lib/ig-writer.ts — `sanearCarrusel`: el mínimo que falla y el máximo que recorta',
      'lib/ig-contenido.ts — `crearBorradorPublicacion`: la pieza entra a /instagram como borrador',
      'app/carousels/actions.ts — `GUIA_TIPO` (la taxonomía que es criterio general, no curso) y `ctxAdmin`',
      'app/carousels/OnboardingCarousels.tsx — el wizard embebido y su salida por estado de cliente',
      'app/carousels/CarouselsApp.tsx — las slides navegables con edición inline; el historial de sesión',
      'docs/hallazgos-comunicacion.md → «Los writers de contenido IG (Reels / Carousels / Stories)» — las trampas y la lista de lo que quedó sin hacer',
    ],
  },
];
