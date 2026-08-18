// =============================================================================
// Reels — el registro de construcción del área
// =============================================================================
// Alcance: la tab de Content Machine que escribe el GUION de un reel de
// Instagram — pedido (tema + objetivo + duración) → guion tipado (gancho con
// frase, título en pantalla y visual · escenas con locución e indicación de
// cámara · moraleja · CTA con palabra clave · caption) → borrador en /instagram.
// Vive en: app/reels/ (page, ReelsApp, actions, reel-pedido, reels-datos) sobre
// el motor compartido lib/ig-writer.ts, la fuente única lib/ig-formatos.ts y el
// puente lib/ig-contenido.ts; la feature `reels-writer` en lib/model-catalogo.ts
// y los pasos `reels_*` en lib/tab-onboarding-state.ts.
//
// De dónde salió esto: el `pedido` del 7/8 es textual, de la sesión «Rediseño:
// sidebar y nueva navegación» (docs/chats.md → docs/chats/chat-redise-o-por-
// partes-88457d97.md); fechas, horas, shas y tamaños salen de `git log` sobre
// esas rutas; las trampas, de docs/hallazgos-comunicacion.md → «Los writers de
// contenido IG (Reels / Carousels / Stories)».
//
// ⚠️ El hito del 9/8 explica por qué esta bitácora hacía falta: el Change
// History AUTOMÁTICO de esta área muestra doce commits y ninguno habla de la
// tab. No es una opinión — está medido ahí adentro.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'La ruta, sin prometer de más', detalle: 'Nace en el sidebar con chip «pronto» y ComingSoon · el nombre de la tab es el de la ruta', estado: 'hecha' },
  { titulo: 'La metodología, citada por curso', detalle: 'lib/ig-formatos.ts destila cuatro cursos de /conocimientos · el gancho es el 80% · la doctrina de caption y hashtags es NEGATIVA y lo dice', estado: 'hecha' },
  { titulo: 'El motor: pedido → pieza TIPADA', detalle: 'lib/ig-writer.ts compartido por las 3 tabs · saneo determinista de lo duro, el estilo queda declarado como expresión de deseo', estado: 'hecha' },
  { titulo: 'Del guion al borrador de /instagram', detalle: 'crearBorradorPublicacion escribe en contenido_posts sin tocar Zernio · las notas de producción van anexadas a la caption con rótulo', estado: 'hecha' },
  { titulo: 'Onboarding que se configura usándose', detalle: 'La cuenta de Instagram es opcional y va última · el contexto sale del perfil de AHORA · el primer guion ES el ensayo', estado: 'hecha' },
  { titulo: 'Historial durable y prompts editables', detalle: 'Hoy el historial es JSON en app_settings con tope 10, y los prompts del writer son constantes locales fuera de /configuraciones', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  // ── agosto: la promesa ─────────────────────────────────────────────────────
  {
    fecha: '7 ago', hora: '02:31', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Reels nace de una decisión de navegación, no de una necesidad de contenido',
    pedido: '2. Te había pedido que al pasar el cursor por las tabs estas interactuen, como lo hacen las secciones.\n3. Quiero que "Content Machine" sea otra sección más, dentro tendrá "Ideas" luego un desplegable llamado "Ads" que contenga "Ads Writer" - "Image Generator" - "Video Generator". Luego otro desplegable llamado "Instagram" con "Reels" - "Carousels" - "Stories". Por último uno que sea "YouTube" con "YouTube Writer" - "Thumbnails". Los 3 desplegables con los logos reales, utiliza el de Meta para el caso de Ads. Y bueno para Ideas un foco o algo así.',
    puntos: [
      'El área no empezó por el producto: empezó porque **Content Machine dejó de ser un ítem de Create y pasó a sección propia con un grupo por canal**. Reels es uno de los ocho destinos que se crearon esa madrugada, y la decisión que lo ordenó está escrita en el commit: «no es UNA herramienta: es un taller con secciones por canal, y cada canal tiene sus formatos».',
      'La regla que se aplicó al crearlas, y que conviene no perder cuando se abra la novena: **todas nacieron con el chip «pronto»** — «no hay backend todavía y prometer lo que no existe es peor que no tenerlo». El nombre de la tab es el mismo que el de la ruta, sin excepción.',
      'Entre esta fecha y el 15/08 el área fue **exactamente lo que decía el registro**: una ruta con guard de rol y un ComingSoon. Sirve para leer el resto: lo del 15 no es una mejora incremental, es la tab entera de una sentada.',
    ],
    commits: [{ sha: '72984b8f', msg: 'Rediseño · el hover roto, Content Machine como sección y tus tres íconos', lineas: 202, archivos: 12 }],
  },

  // ── agosto: el registro ────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '01:33', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El área entra al mapa de /admin/dev, y su historial queda secuestrado por nav.ts',
    puntos: [
      'El Change History de un área **no se escribe: se DERIVA**. `scripts/gen-dev-historial.mjs` corre `git log` sobre las rutas del `vive[]` y se queda con los últimos `POR_AREA = 12`. Reels entró al mapa declarando **dos** rutas: `app/reels/page.tsx` y `app/_components/nav.ts`.',
      '⚠️ **Medido el 17/08 sobre `_historial.generado.ts`: los 12 commits que el panel muestra para `reels` son EXACTAMENTE los mismos 12 que muestra para `carousels`, y ninguno de los dos habla de la tab.** Son todos de `nav.ts`: la barra de super admin, Products & Offers entrando al sidebar, la puerta de /admin/dev. Es una vuelta de tuerca de «una ruta que apunta a la nada»: acá la ruta existe y anda — el problema es que **un archivo compartido y caliente adentro de un `vive[]` no suma historia, la DESPLAZA**, porque compite por los mismos doce lugares contra las rutas propias del área. Un `vive[]` chico con un archivo hot es peor que uno chico y solo.',
      'Segunda mitad del mismo punto ciego: el generado **se corre a mano, no en el build** (el `git log` sobre 121 áreas tarda). El archivo se generó el 11/08, así que `a3d0ffb0` —la corrida que construyó la tab entera cuatro días después— no figura en ningún lado. Un historial derivado que no se regenera envejece igual que uno escrito a mano, y sin avisar.',
      'Lo que sí quedó bien de esa corrida y por eso el diagnóstico se pudo hacer: la guarda `tests/dev-areas.test.ts` chequea contra el disco que cada ruta exista. Lo que **no** puede chequear es la omisión — una ruta que falta no da error, da un punto ciego.',
    ],
    commits: [{ sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 }],
    archivos: [
      'app/admin/dev/areas.ts — el `vive[]` de reels, ampliado el 17/08 de 2 rutas a las 11 donde cae el trabajo',
      'app/admin/dev/_historial.generado.ts — el bloque `"reels"`: los 12 commits ajenos, tal cual quedaron',
      'scripts/gen-dev-historial.mjs — `POR_AREA = 12`, el tope que produce el desplazamiento',
    ],
  },

  // ── agosto: la materia prima ───────────────────────────────────────────────
  {
    fecha: '14 ago', hora: '16:46', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'La metodología del guion no se inventó: entró como cursos 24 horas antes',
    puntos: [
      '`METODOLOGIA_REEL` (lib/ig-formatos.ts) **no es criterio propio**: es la destilación de las transcripciones de cuatro cursos que entraron a /conocimientos entre el 13 y el 14/08 —Inteligencia Viral 2026, ManyChat Master, Mateo Maffia BYF y Master Marca Personal 5.0—, y cada bloque **cita su fuente** justamente para poder auditarlo después. Los commits viven en el área Conocimientos; se listan acá porque sin ellos el writer no existiría.',
      'La regla maestra que gobierna el prompt entero: **el gancho se lleva el 80% del esfuerzo, y el gancho no es la frase** — es todo lo que pasa en los primeros 3-5 s (frase + encuadre + título en pantalla + elementos visuales), con dos trabajos obligatorios: frenar el scroll y abrir una curiosidad que solo se resuelve al final. El dato que la sostiene es de BYF y es medido, no doctrina: el mismo video con otro gancho pasó de 40.000 a 2,8 millones de views.',
      '⚠️ **La doctrina de caption y de hashtags es NEGATIVA, y eso también es un dato.** Ningún curso de la casa los enseña como palanca; los cursos los descartan de frente. El módulo lo dice honesto en vez de inventar metodología, y la tab lo repite en pantalla. Si alguien pide «mejorá los hashtags», la respuesta correcta es que **no hay doctrina positiva que aplicar**. Y la «regla de los 125 caracteres» que sí muestra la UI no es doctrina: es el corte de la UI de Instagram, dónde trunca el feed.',
      'Corolario que ya está pagado en otra área y aplica acá: **una idea rinde piezas por ÁNGULO, no por canal**. Un reel y un email con el mismo ángulo son la misma pieza en dos envases. Y los 14 ángulos de `lib/guion-angulos.ts` están escritos para tráfico frío de Meta: reusarlos tal cual para orgánico produce piezas que suenan a anuncio (docs/hallazgos-ads.md).',
    ],
    commits: [
      { sha: '4d38cc59', msg: 'Un ZIP no es un PDF que falló: el downloader de recursos daba éxito por vacío (Inteligencia Viral 2026)', lineas: 1037, archivos: 50 },
      { sha: '071353b1', msg: 'ManyChat Master - Instagram entra a Orgánico: 25 clases, completo', lineas: 407, archivos: 28 },
      { sha: '13bffe7a', msg: 'Mateo Maffia - BYF entra a Orgánico: 33 clases, y pasa todos los chequeos nuevos', lineas: 527, archivos: 36 },
      { sha: '16ff2a45', msg: 'Master Marca Personal 5.0 entra a Orgánico: 92 clases, y NO reemplaza a la 4.0', lineas: 1408, archivos: 93 },
    ],
  },

  // ── agosto: la tab ─────────────────────────────────────────────────────────
  {
    fecha: '15 ago', hora: '10:44', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab deja de ser una promesa: pedido → guion tipado → borrador en /instagram',
    puntos: [
      'Lo que devuelve el motor **no es texto: es una pieza TIPADA** (gancho con frase, título en pantalla y visual · escenas con locución e indicación de cámara · moraleja · CTA · palabra clave · caption · duración). Y el saneo está partido en dos mitades **a propósito**: lo DURO se valida determinista (sin `hook.frase` o sin escenas se falla con el motivo), y lo de estilo —frase de 5-9 palabras, título distinto a la frase— queda SOLO en el prompt **declarado como expresión de deseo**, porque validarlo rechazaría piezas buenas. Es la regla de las dos capas con la excepción escrita en el comentario, como pide AGENTS.md.',
      '⚠️ **El tag de la feature es load-bearing y el compilador no lo ve.** `reels-writer` tiene que existir idéntico en `lib/model-catalogo.ts`; si no coincide, el override no aplica y —como no hay modelo por default— la llamada **queda vetada**, no cae a Claude. Su `def` es `GEMINI()`, gratis, que es lo que corresponde a un writer sin PII.',
      '⚠️ **Dos recortes SILENCIOSOS que conviene tener presentes.** (a) `generarPieza` corta el pedido a 4.000 caracteres sin avisar — por eso `reel-pedido.ts` topea campo por campo ANTES de componer: mejor recortar el tema que perder el final del feedback. (b) El saneo clampea la duración a los 90 s de `LIMITES_REEL`: el guion queda entero y **solo la cifra miente**. Lo segundo sigue sin avisarse en pantalla.',
      '**El historial es un parche declarado, y el comentario dice por qué el número no se sube.** No existe tabla genérica de piezas generadas (`landing_drafts` es del Landing Generator y `contenido_posts` guarda solo lo ENVIADO a publicación), así que vive como JSON en `app_settings` con tope 10 y read-modify-write **sin lock**: dos generaciones simultáneas pueden perder una entrada del historial, nunca la pieza en pantalla. Si el producto quiere historial durable o cross-formato, eso es UNA tabla con migración coordinada — no subir el tope ni colonizar la tabla de otra feature.',
      '⚠️ **Las notas de producción viajan ANEXADAS a la caption.** `contenido_posts` (mig 0136) no tiene columna para el guion: aceptarlas y tirarlas era pérdida silenciosa, así que van pegadas con un rótulo visible que pide borrarlas antes de publicar. Consecuencia asumida: el borrador puede pasar los 2.200 caracteres — el tope lo aplica Instagram al publicar, no la base. Y `crearBorradorPublicacion` **no es idempotente** (doble click = dos borradores): reels lo mitiga guardando el `borradorId` en la entrada del historial; carousels y stories solo deshabilitan el botón.',
      'El onboarding **se configura usándose** y respeta el orden de la casa: `conectar` es OPCIONAL y va ÚLTIMO (escribir un guion no necesita la cuenta; recién publicar la necesita, y eso vive en /instagram), y es la **misma key compartida** que /instagram — conectar allá lo marca acá. `reels_contexto` sale del perfil de AHORA (estado vivo, no recordado) con un matiz fino: `faltan` vacío con `listo:false` significa que **la consulta falló**, no que el perfil esté vacío, así que un error de infra no desmarca un paso que el cliente ya cerró. `reels_ensayo` lo marca el primer guion generado.',
      '⚠️ **Los prompts del writer son constantes locales, con TODO puesto:** el archivo de `prompt-registry` estaba tomado por una sesión paralela ese día. Hoy **no son editables desde /configuraciones** — el mismo agujero que la Content Machine de ads ya tenía documentado. Migrarlos con la skill `add-editable-prompt` cuando el archivo se libere.',
    ],
    commits: [{ sha: 'a3d0ffb0', msg: 'Content Machine IG (Reels/Carousels/Stories) + onboarding Zernio-first', lineas: 3613, archivos: 29 }],
    archivos: [
      'lib/ig-formatos.ts — límites técnicos de Zernio + metodología citada por curso (sin server-only: la UI también los muestra)',
      'lib/ig-writer.ts — `generarPieza`, los contratos JSON y el saneo por formato',
      'lib/ig-contenido.ts — `crearBorradorPublicacion`: la pieza entra a /instagram como borrador',
      'app/reels/reel-pedido.ts — módulo PURO: catálogos del pedido y `guionATexto` (lo importan la UI y las actions)',
      'app/reels/reels-datos.ts — el historial en `app_settings` (`reels.historial`) y `estadoContextoReels`',
      'app/reels/ReelsApp.tsx — el guion legible para grabar, con el corte de los 125 caracteres marcado',
      'docs/hallazgos-comunicacion.md → «Los writers de contenido IG (Reels / Carousels / Stories)» — las trampas y la lista de lo que quedó sin hacer',
    ],
  },
];
