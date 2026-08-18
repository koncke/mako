// =============================================================================
// VSL Generator — el registro de construcción del área
// =============================================================================
// Alcance: escribir el guion de un VSL largo (20 a 45 minutos). Hoy la pantalla
// es un `<ComingSoon />` y no hay lib propia ni API — pero el área NO está en
// cero: el cimiento (el catálogo de estructuras de VSL largo) se escribió el 5
// de agosto, y desde entonces lo que se movió fue el nombre, la ruta y el
// enganche con el resto de la app.
// Vive en: app/vsl-generator/, app/vsl-writer/ (redirect), lib/vsl-estructuras.ts,
// app/_components/nav.ts.
//
// De dónde salió esto: el `pedido` es textual, de la sesión «Cerrar VSL Analyst
// y VSL Generator» (docs/chats.md → docs/chats/chat-vsl-analyst-y-generator-
// tareas-pendientes-e491f6d6.md); fecha, hora, sha y tamaño de cada commit, de
// `git log` sobre esas rutas; el estado declarado del área, de app/admin/dev/areas.ts.
//
// ⚠️ Ojo con las horas: la transcripción de la sesión está en otro huso que los
// commits (-03). Acá la hora de un hito con commits sale SIEMPRE del commit; la
// del hito de tipo `prompt`, del sello de la transcripción.
//
// NO es un changelog. Va el motivo, la trampa, y lo que quedó SIN hacer.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Las estructuras de VSL largo', detalle: '5 estructuras de 20 a 45 min con guía bloque por bloque y minutaje · las 7 de guion-estructuras.ts son de anuncio de 30-90 s y no sirven acá', estado: 'hecha' },
  { titulo: 'El nombre coincide con la ruta', detalle: '/vsl-writer → /vsl-generator, con el path viejo redirigiendo porque está escrito en tareas del plan y en mensajes que MaKo ya mandó', estado: 'hecha' },
  { titulo: 'El motor: lib/vsl-writer.ts', detalle: 'Compositor de brief (funnel + perfil + método + ganadores), el {{jsonShape}} del guion por bloques, y los 4 prompts en el registry · nada de esto existe todavía', estado: 'cola' },
  { titulo: 'La ruta y los borradores', detalle: '/api/vsl-generator + tabla de borradores en TENANT_TABLES + alta en model-registry e ia-labels · sin esto no hay override de modelo ni desglose de gasto', estado: 'cola' },
  { titulo: 'La pantalla y su onboarding', detalle: 'Quitar el comingSoon de nav.ts y el ComingSoon de la page, más las 3 etapas de la tab (Conectar → Contexto → Ensayo), que es regla en toda tab', estado: 'cola' },
  { titulo: 'El loop Analyst → Generator', detalle: 'El Analyst detecta el bloque donde se cae la curva, el Generator reescribe ESE bloque, se mide la variante · es el único diferencial real de la dupla', estado: 'cola' },
  { titulo: 'Estructuras editables desde /admin/guiones', detalle: 'Como las de ads · hoy el catálogo es código y solo lo puede tocar quien commitea', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '5 ago', hora: '20:30', chat: 'Cerrar VSL Analyst y VSL Generator', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«Terminar completamente» las dos features, con la reunión al día siguiente',
    pedido: 'Revisa el plan... Mañana tengo reunión con Mauricio y quiero terminar completamente la funcionalidad de VSL Analyst y VSL Generator, para ello hay muchas tareas pendientes, revisalo.\n\nSi, carga todo al plan y comencemos a desarrollar todo, si llegamos bien, sino, no importa.',
    puntos: [
      '**Las «muchas tareas pendientes» no existían.** De 37 proyectos del tablero, ninguno era VSL Analyst ni VSL Generator; lo único relacionado eran 3 tareas sueltas sin puntuar, y las 12 que traían «VSL» en el título eran de la **landing propia** (grabar el VSL de MaKo, YouTube), no del producto. Cuando alguien dice «revisá las pendientes», la primera respuesta útil puede ser que el registro está vacío.',
      '**Y la causa de que estuviera vacío es estructural:** el catálogo CERRADO de `lib/plan-proyectos-catalogo.ts` no tenía entrada para ninguna de las dos, así que cualquier tarea nueva que el Perro ruteara caía en «Vender MaKo: Landing y VSL» — que es el marketing propio, no la funcionalidad. Un área sin fila en el catálogo no queda sin tareas: queda con las tareas **mezcladas en la carpeta de otro**, que es peor porque no se nota.',
      'De ahí salió la lista real: **9 tareas para el Generator** (catálogo de estructuras de VSL largo, editables desde /admin/guiones, `lib/vsl-writer.ts` con el compositor de brief, el `{{jsonShape}}` por bloques, los 4 prompts en el registry, model-registry + ia-labels, la ruta y la tabla de borradores, la pantalla con su onboarding, y el loop con el Analyst).',
      'La decisión de alcance que se tomó en el mismo turno y sigue vigente: **las fases 2-4 de la tarea #204 —stock, gráficos, avatar— no entran.** «Prometer un editor de video mañana es lo único de esta lista que no podés sostener.» El Generator escribe el guion; producir el video es otro negocio.',
      'Lo que se construyó ese día fue el **cimiento**: `lib/vsl-estructuras.ts`, cinco estructuras reales de 20 a 45 minutos con guía bloque por bloque y minutaje (Respuesta directa · Clase gratuita · Contrarian · Diagnóstico · Historia del fundador). Las siete de `guion-estructuras.ts` (PAS, AIDA, BAB, 4P) son de anuncio de 30 a 90 segundos y **no sirven**: un VSL necesita bloques que en un ad no existen —mecanismo único, prueba, objeciones, garantía—.',
      '⚠️ **Las etiquetas de los bloques son contrato DOBLE**: las lee el parser de la UI y las lee el VSL Analyst, que ancla cada bloque a un tramo de la curva de retención. Por eso el normalizador **descarta lo inválido en vez de guardarlo roto**, y hay tests que lo fijan. Si alguien renombra una etiqueta «para que se lea mejor», rompe el enganche del loop entero.',
    ],
    commits: [
      { sha: '9d9d0f46', msg: 'La curva del VSL: el player nunca dijo la duracion (+ lib/vsl-estructuras.ts, arrancando el VSL Writer)', lineas: 826, archivos: 8 },
    ],
    archivos: [
      'lib/vsl-estructuras.ts — las 5 estructuras de VSL largo; es lo único del Generator que ya existe',
      'tests/vsl-estructuras.test.ts — fija las etiquetas, que son contrato con el parser Y con el Analyst',
    ],
  },

  {
    fecha: '6 ago', hora: '16:02', chat: 'Rediseño: sidebar y nueva navegación', cuenta: 'claude1',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El nombre pasa a coincidir con la ruta: /vsl-writer muere como URL, no como key',
    puntos: [
      'Pedido del dueño dentro del rediseño de la barra: «Luego vienen "Landing Generator" y "VSL Generator", **siempre los nombres deben coincidir con la ruta**». Así que `/vsl-writer` pasó a `/vsl-generator`.',
      '⚠️ **La key de nav NO se renombró, y está bien así.** Sigue siendo `vsl-writer` porque está **escrita en la base**: el estado del onboarding por tab y las capas la guardan como texto. Renombrarla habría reabierto la tab a todos los que ya la tenían cerrada. El comentario que lo explica vive arriba de `app/vsl-generator/page.tsx`, que es donde alguien lo va a buscar.',
      'Y la ruta vieja quedó como **redirect**, no borrada: el path anterior está escrito en tareas del plan, en mensajes que MaKo ya mandó y en marcadores del navegador — lugares que no se pueden editar de golpe.',
    ],
    commits: [
      { sha: '4e8380f4', msg: 'Rediseño · la barra deja de perder dónde estabas parado', lineas: 307, archivos: 13 },
    ],
  },

  {
    fecha: '8 ago', hora: '18:58', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El área queda declarada «por-construir», y con eso hereda un punto ciego',
    puntos: [
      'Siete agentes barrieron la superficie del producto y de ahí salieron las 121 áreas de /admin/dev. VSL Generator entró declarada `por-construir`, con su alcance escrito contra el código real: ComingSoon puro, sin lib ni API.',
      '**El CHANGE HISTORY de cada área no se escribe: sale de `git log` sobre las rutas de su `vive[]`** (`scripts/gen-dev-historial.mjs` → `_historial.generado.ts`). Eso es lo que lo mantiene honesto, y también lo que lo vuelve frágil: un `vive[]` corto no da un área con poca historia, da un área **invisible**. El precedente medido es Conocimientos, que veía 11 commits de 68.',
      '⚠️ **Acá pasó exactamente eso:** el `vive[]` declaraba tres archivos —la page, el redirect y `nav.ts`— y dejaba afuera `lib/vsl-estructuras.ts`, que es lo ÚNICO que el área tiene construido. El propio alcance del catálogo lo dice al revés («existe pero lo consume el Landing Analyst, no esto») cuando el commit que lo creó dice, textual, «arrancando el VSL Writer». Se corrigió el 17/08 sumándolo al `vive[]` junto con su test.',
      '`tests/dev-areas.test.ts` chequea contra el disco que cada ruta exista y cazó 30 rutas plausibles pero inexistentes. **Lo que no puede chequear es la omisión**: una ruta que falta no da error, da un punto ciego.',
    ],
    commits: [
      { sha: '74d40781', msg: 'Mapa de /admin/dev: las 208 piezas relevadas contra el código', lineas: 731, archivos: 1 },
      { sha: 'e3063fc3', msg: 'Cosecha del barrido: 121 áreas, y dos trampas que costaron caro', lineas: 272, archivos: 3 },
      { sha: '93cde614', msg: 'Las 121 áreas del producto, con su Roadmap y su Change History derivados', lineas: 2453, archivos: 5 },
    ],
  },

  {
    fecha: '16 ago', hora: '10:47', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El redirect de la ruta vieja perdía la pestaña del cliente',
    puntos: [
      '`app/vsl-writer/page.tsx` hacía `redirect(\'/vsl-generator\')` con la ruta pelada, así que **abrir un link viejo mientras mirabas a un cliente te sacaba del cliente**. Ahora pasa por `rutaConWs` (`lib/workspace.ts`), como los otros 25 redirects internos que se barrieron ese día.',
      'Es un módulo que todavía no hace nada y aun así tenía una forma de fallar que no se parece a un bug: **no hay error ni pantalla rota, hay una cuenta distinta**. Se reporta como «algo está pasando».',
      '⚠️ La regla que queda para cuando esta tab se construya: **hay CUATRO formas de navegar** y las cuatro tienen que llevar el `?ws=` — `app/_ui/Link` para los links, el parche de `WsFetch` para `/api`, `rutaConWs` para un `redirect()` del server y `conWs(destino, useWs())` para un `window.location.href`. En ese mismo barrido se dio la regla por cerrada contando tres, y la cuarta quedó viva justo en el panel que solo se dibuja mirando a otro cliente.',
    ],
    commits: [
      { sha: '897ce26e', msg: 'Un redirect es navegación: los 26 que perdían el ?ws= de la pestaña', lineas: 126, archivos: 26 },
    ],
  },
];
