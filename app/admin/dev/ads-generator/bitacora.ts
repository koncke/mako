// =============================================================================
// Ads Generator — el registro de construcción de la fábrica de creativos
// =============================================================================
// El área: la Matriz avatar × razón, los ángulos, las estructuras y el guion que
// sale de ahí. Vive en `app/ads-writer/`, `app/onboarding/MatrizView.tsx`,
// `lib/guion-angulos.ts`, `lib/guion-estructuras.ts`, `lib/razones.ts` y
// `lib/avatares.ts`.
//
// De dónde salió esto: los prompts son TEXTUALES, sacados de los transcripts de
// las sesiones (`~/.claude/projects/<proyecto>/<sesión>.jsonl`, hora local
// UTC−3); las fechas, horas y commits salen de `git log` sobre esas rutas; lo
// que quedó abierto sale de `docs/hallazgos-ads.md` y de `docs/chats.md`.
//
// Casi toda la historia ocurrió dentro de dos sesiones larguísimas:
// «Conocimientos - CURSOS» (230 turnos, del 19/7 al 6/8) y «Ads Writer y Ads
// Generator» (14 turnos, del 5/8 al 7/8). Si buscás una decisión de acá en el
// chat equivocado, no la vas a encontrar.
//
// NO ES UN CHANGELOG: el changelog está en `git log`. Acá va el porqué, el
// pedido con sus palabras, y sobre todo cuándo el diagnóstico obvio era el
// equivocado.

import type { Hito, Parte } from '../_registro/tipos';

// Los dos títulos reales de sesión donde vive todo esto.
const CURSOS = 'Conocimientos - CURSOS';
const AWAG = 'Ads Writer y Ads Generator';

export const PARTES: Parte[] = [
  { titulo: 'Avatares y la Matriz 3×3', detalle: 'Avatares segmentables en Meta · una razón de compra por avatar · 9 celdas para testear', estado: 'hecha' },
  { titulo: 'Entregable, Ángulos y Persona', detalle: 'El Gancho tangible · ángulos por formato, separados de las razones · la cara de la marca', estado: 'hecha' },
  { titulo: 'La fábrica de guiones', detalle: 'Ángulos con hook/cuerpo/CTA/nunca · estructuras configurables · quiz de Personalidad', estado: 'hecha' },
  { titulo: 'Generar sin interrogar', detalle: 'MaKo lo hace solo o sugiere todo · jamás una pregunta abierta · CTA según el funnel', estado: 'hecha' },
  { titulo: 'Content Machine', detalle: 'La tab entera: vista global de guiones · galería cuando son muchos · diseño «wow»', estado: 'sigue' },
  { titulo: 'IDEAS', detalle: 'Un input suelto al estilo Mila que se guía hasta convertirse en guion', estado: 'sigue' },
  { titulo: 'El bucle con Ads Analyst', detalle: 'Ganadores y Patrones alimentando la generación · etiquetar lo publicado fuera de la app', estado: 'cola' },
  { titulo: 'Imagen y video por celda', detalle: 'Hoy la Matriz llega hasta el guion; el creativo todavía no sale de acá', estado: 'cola' },
  { titulo: 'Los prompts, editables', detalle: 'Las 4 claves `razones.*` fuera de prompt-registry: invisibles en /configuraciones', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 28 de julio · nace la Matriz ───────────────────────────────────────────
  {
    fecha: '28 jul', hora: '15:31', chat: CURSOS, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'La metodología de Jan: primero los avatares, después los ángulos',
    pedido: 'Bien, ahora te consulto como esto se relaciona a la metodología de Jan.\n¿Nos faltaría definir "Avatares" antes de angulos? y sobre todo, tal vez sería bueno que el resultado saque una matriz de 3x3 como propone Jan para testear los ads RECON con esas razones...\n\nQuisiera tener en claro el panorama de lo que hicimos vs lo que propone Jan para saber si agregarlo o no',
    puntos: [
      'Acá nace la Matriz, y nace **con su número adentro**: 3 avatares × 3 razones = 9 celdas. Ese 9 no es decorativo — después reaparece en la recomendación de la fase NACIMIENTO del diagnóstico («deberíamos recomendarle lanzar 9 creativos, ya que justamente luego la matriz 3x3 le va a crear 9», 30/7).',
      'El pedido no es «implementá»: es «comparame lo que hicimos contra lo que propone Jan». Lo que había hasta ese momento eran ángulos sueltos sin dueño; faltaba la capa de **a quién** le hablás.',
    ],
  },
  {
    fecha: '28 jul', hora: '16:09', chat: CURSOS, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Avatares y la Matriz 3×3',
    puntos: [
      'La matriz se construye como el **cruce** de dos catálogos que ya no se mezclan: los avatares (quién) y las razones (por qué compra ESE). Cada celda es una hipótesis de anuncio, no un texto suelto.',
      'La cascada quedó atada al Archivero: se sube el documento del negocio y de ahí salen avatares y ángulos sin que el usuario los escriba a mano. Es la misma regla que gobierna todo el onboarding — defaults y sugerencias antes que configuración manual.',
    ],
    commits: [{ sha: '2d78e15', msg: 'Avatares + matriz 3x3 de ángulos (metodología de Jan)', lineas: 529, archivos: 11 }],
    archivos: [
      'lib/avatares.ts — genera los avatares y las preguntas para afinarlos',
      'lib/razones.ts — las razones de compra por avatar',
      'app/onboarding/MatrizView.tsx — la vista de la Matriz',
    ],
  },
  {
    fecha: '28 jul', hora: '19:37', chat: CURSOS, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Tres pedidos que redefinieron la fábrica entera',
    pedido: '(16:44) Revisa como creó "Los avatares", en definitiva son los mismos avatares, ¿Cómo los diferenciamos? si tuvisemos que hacer una campaña de escalo horizontal por cada avatar que propuso ¿Cómo se diferencia uno del otro? ¿Cómo lo segmentaríamos en Meta?... Son textos muy ambiguos que no clasifican bien a un avatar. Diferente es por ejemplo uno que tiene empresa de RETAIL con X cantidad de empleados o ubicado en tal lugar y otro que se dedica a los supermercados... Lo que escribió ahora se parece mucho más a "angulos".\n\n(18:12) Creo que sería bueno separar "Angulos" de "Razones"... Lo que está actualmente son las razones de compra. Porque me imagino a los ángulos separados por IMAGENES y por VIDEO... Me gustaría que la matriz, sea literalmente una matriz, que se pueda ver como una tabla. Y que al darle click a uno ahí recién me abra el detail tipo pop-up.\nTambién quisiera agregar una sección que sea "Gancho"… todos los servicios tienen un elemento TANGIBLE, que hace que su oferta se entienda rápido, que genera FOMO, que aumenta la conversión de sus ads… puede ser un excel, un documento, una metodología concreta tangible.\n\n(19:37) En "El Gancho" no me hizo preguntas... Tal vez el usuario ya tiene un elemento tangible claro. Y sería bueno llamar a la sección "Entregable".\nSiento que la parte de las razones no queda claro... Hoy en día lo veo más como un generador de hooks... Lo cierto es que un avatar tiene diferentes razones de comprar un producto... El ejemplo que utiliza Jan es para un curso de ingles, un avatar lo compra porque quiere un mejor salario, otro porque se va de vacaciones.',
    puntos: [
      '**El criterio del avatar quedó fijado acá y no se movió más: un avatar es un filtro de segmentación de Meta** (rubro, tamaño, ubicación), no una descripción psicológica. La prueba que lo define es suya: si no podés armar una campaña de escalo horizontal por cada uno, no son avatares distintos.',
      'De ese mismo párrafo sale la separación que ordena todo el módulo. Lo que la IA escribía como «avatar» eran ángulos; lo que se llamaba «ángulos» eran razones de compra. Hoy son tres cosas con archivo propio: `lib/avatares.ts` (quién), `lib/razones.ts` (por qué) y `lib/guion-angulos.ts` (cómo se cuenta).',
      'Las razones **no** son dolor/deseo ni hooks: son las motivaciones distintas por las que el MISMO avatar compra. El ejemplo del curso de inglés (salario vs vacaciones) es el que quedó como definición operativa.',
      'El Entregable es lo que él más defendió y lo que menos existía: el objeto tangible de la oferta. Sin eso el anuncio promete un servicio abstracto y no genera FOMO.',
    ],
  },
  {
    fecha: '28 jul', hora: '20:23', chat: CURSOS, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La fábrica se parte en capas',
    puntos: [
      'Tres commits en cuatro horas para el mismo rediseño conceptual: avatares segmentables → Gancho + Ángulos por formato + Razones como tabla → Entregable + Persona + gating.',
      'La Matriz pasó a ser una **tabla real clickeable** con pop-up. La razón por la que no alcanzaba con la lista: el pop-up tiene que poder crecer con tabs internas, porque adentro de una celda va a vivir el guion, la imagen y a futuro el video. Una lista no tiene dónde poner eso.',
      '**Gating:** no se puede avanzar de paso sin haber cerrado el anterior. Salió de que él llegó al paso Entregable y el botón «Siguiente» seguía habilitado con el campo vacío.',
      'Los avatares se corren con Gemini, no con Claude: es un paso del onboarding que se repite mucho y no justifica el modelo caro.',
    ],
    commits: [
      { sha: '7fc9858', msg: 'Rediseño del hub de onboarding + avatares segmentables (feedback Mauricio)', lineas: 770, archivos: 13 },
      { sha: 'e1e873e', msg: 'Fábrica de creativos v2: Gancho, Ángulos=formatos, Razones-tabla, afinar, auto-cascada', lineas: 1079, archivos: 14 },
      { sha: '1f6fa84', msg: 'Fábrica v3: Entregable, Razones=motivaciones, Matriz+pop-up, Persona, gating', lineas: 1079, archivos: 20 },
    ],
    archivos: [
      'app/onboarding/MatrizView.tsx — la tabla, el pop-up y (después) el creador de guiones. Es el archivo más grande del área',
      'lib/razones.ts — pasó de generar hooks a generar motivaciones de compra',
      'lib/avatares.ts — preguntas cerradas para afinar el avatar hasta que sea segmentable',
    ],
  },

  // ── 30 y 31 de julio · el guion ────────────────────────────────────────────
  {
    fecha: '30 jul', hora: '20:23', chat: CURSOS, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«Un anuncio tiene que tener un solo objetivo»',
    pedido: 'Listo, ya hace bien el resto, vamos con la generacion de guion, ya que lo hizo muy mal, te pego el guion en md y captura.\n\n3. NO agregues nada de acciones, esto es SOLO el guion, solo lo que se dice.\n4. El guion esta HIPER tecnico, no es para nada marketinero… esta tan tecnico que nadie lo entendería, ni siquiera yo lo entendí fácil que conozco toda la metodología de Leandro. Eso no es marketing.\n5. Deberías buscar por la web o incluso en las skills de http://skills.sh/ si hay ayuda en copywriting para ads.\n6. Siento que la IA mezcló todos los conceptos, intentó juntarlo TODO en un solo guion... El entregable, el dolor, las acciones, fue mucho. Un anuncio tiene que tener un solo objetivo, menos es más. Podemos crear un guion que hable solo del entregable, otro que hable solo del dolor.\n7. Creo que tampoco siguió ninguna estructura de las que yo te habia enviado.\n8. El CTA es larguisimo y no se entiende, es lo peor que hay... Le invitó a la gente a un taller gratuito, ¿De donde se inventó un taller gratuito?\n9. Esta skill de creacion de guiones realmente tiene que ser buena, no puede dar un resultado tan pesimo así.',
    puntos: [
      '**«Un anuncio tiene que tener un solo objetivo, menos es más»** es la regla del área. La consecuencia práctica: la variedad no sale de meter más cosas en un guion, sale de **multiplicar ángulos** — un guion del entregable, otro del dolor, otro del testimonio.',
      'El punto 8 es el síntoma más caro: la IA inventó un taller gratuito que no existía. Un CTA alucinado no es un error de estilo, manda tráfico pago a una promesa falsa.',
      'El punto 4 se generalizó después a la regla de la casa: MaKo asesora en argentino, pero **lo que sale hacia el cliente final va en español plano y sin jerga interna** — nada de «la matriz 3x3» ni «la fábrica de creativos» en lo que ve el usuario.',
    ],
  },
  {
    fecha: '30 jul', hora: '23:33', chat: CURSOS, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«Los ángulos están muy pobres» + el quiz de Personalidad',
    pedido: '1. Quiero que re hagas toda la sección de "Tono y personalidad", primero que se llame solo "Personalidad".\n3. En lugar de descripciones vagas como "Directo" o "Cercano" quiero que les hagas preguntas especificas, preguntas siempre cerradas, y que sea como un quiz para descubrir su personalidad… Me las imagino como: ¿En un anuncio cual de estas 2 frases te representaría más?\n\n3. Los angulos estan muy pobres, no solo tiene que tener una instrucción en texto para la IA... Separalo en partes, Tiene que haber un apartado de ejemplos de hook, otro de cuerpo, de CTA, cosas que siempre hacer, cosas que NUNCA hacer, requisitos para poder elegir ese angulo, preguntas que se le debe hacer al usuario cuando intente crear un guion con ese angulo... Todo lo más completo que te imagines.\n4. El tema de la estructura, creo que se merece otro apartado… un angulo puede contarse con diferentes estructuras.',
    puntos: [
      'Un ángulo dejó de ser una línea de instrucción y pasó a ser una **ficha**: hook, cuerpo, CTA, siempre, nunca, requisitos y preguntas. Ese cambio es el que hace que el guion salga distinto según el ángulo en vez de salir siempre igual con otro título.',
      'La separación ángulo ↔ estructura importa porque **no son la misma dimensión**: un mismo ángulo se puede contar con varias estructuras. Atarlos era la razón por la que todo salía en GANCHO-HISTORIA-CTA.',
      'El quiz de Personalidad reemplaza al selector de adjetivos. El motivo que dio: sin eso «a un argentino le escribía de tú». Y el norte de la feature es humanizar — que el guion parezca del creador, no de una IA.',
    ],
  },
  {
    fecha: '31 jul', hora: '00:19', chat: CURSOS, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'De un guion suelto a una fábrica: ángulos ricos, estructuras y Personalidad',
    puntos: [
      'Tres commits encadenados en cuatro horas. El primero rehizo el guion apoyándose en investigación de copywriting; el segundo trajo multi-guion, tono del creador y Lead Magnet; el tercero abrió `lib/guion-angulos.ts` (los ángulos como ficha completa) y `lib/guion-estructuras.ts` (las estructuras, aparte y configurables).',
      'El **CTA se define por el paso siguiente del funnel**, no por costumbre: un VSL Funnel manda al video, uno de mensajes manda a WhatsApp, un webinar manda a registrarse. Agendar llamada sigue siendo válido, pero dejó de ser el default.',
      '⚠️ **Trampa de reuso que conviene saber antes de copiar este catálogo:** los ángulos están escritos para **tráfico frío de Meta** — «retargeting» presupone que ya vio un anuncio y «oferta-directa» es urgencia comercial. Reusarlos tal cual para contenido orgánico produce piezas que suenan a anuncio. Lo reusable es el mecanismo (requisitos + gate de honestidad + anti-repetición), no la lista.',
    ],
    commits: [
      { sha: '1916135', msg: 'guion de video rediseñado (investigación de copywriting) + verificación de teléfono por WhatsApp', lineas: 475, archivos: 9 },
      { sha: 'ba5ee90', msg: 'fábrica de guiones v3 — ángulos + multi-guion + tono del creador + Lead Magnet', lineas: 1050, archivos: 20 },
      { sha: '541acea', msg: 'guiones v4 — quiz de Personalidad + ángulos ricos + estructuras configurables + tab Guiones', lineas: 1614, archivos: 28 },
    ],
    archivos: [
      'lib/guion-angulos.ts — NUEVO. Los ángulos con hook, cuerpo, CTA, siempre, nunca, requisitos y preguntas',
      'lib/guion-estructuras.ts — NUEVO. Las estructuras, desatadas del ángulo',
      'lib/razones.ts — el generador del guion; usa `renderPrompt` con las claves `razones.system`, `razones.user`, `razones.sugerir` y `razones.guion`',
      'app/onboarding/MatrizView.tsx — el creador de guion adentro del pop-up de la celda',
    ],
  },
  {
    fecha: '31 jul', hora: '00:43', chat: CURSOS, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«La idea es que la IA facilite»',
    pedido: 'Se volvió super complejo crear un guion, me pide muchas preguntas abiertas, esa NO es la idea...\nLa idea es que la IA facilite.\n\n1. Te pido que elimines todos los guiones de Leandro, lo haremos de nuevo.\n2. La idea es que ya con algo de contexto, la IA sugiera todo... Que sugiera el angulo, la estructura, que complete por si misma todo lo que pueda completar, y que en caso de que si o si necesite hacer preguntas lo haga con preguntas cerradas.\n3. Al momento de crear un nuevo guion, sería idea que haya un botón de que lo haga todo la IA, como ya hablamos. Y otro para sugerirle, en ese caso para sugerirle por ejemplo el angulo y esas cosas... Pero NUNCA preguntas abiertas, en ningun lugar.\n4. Por "Avatar" "Razon de compra" y "Lead Magnet" dentro de contexto, que sea todo desplegable. Y el modal NO debe modificarse de tamaño según la tab, en todo caso, tener scroll.',
    puntos: [
      '**Es la regla más importante del área y aplica a todo MaKo:** cada pregunta abierta que le hace la IA al usuario es trabajo que la IA le devolvió. Si hay contexto, se sugiere; si de verdad falta un dato, se pregunta **cerrado**.',
      'El pedido llegó **24 horas después** de haber shipeado el flujo con preguntas. La señal de que estaba mal no era un bug: era que él, que conoce la metodología entera, no lo quería usar.',
      'El punto 4 es una regla de UX que se repite en toda la app: un modal **nunca** cambia de tamaño según la tab que tengas abierta adentro. Si no entra, scrollea.',
    ],
  },
  {
    fecha: '31 jul', hora: '01:15', chat: CURSOS, cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: 'Crear un guion deja de interrogar, y el error que culpaba a la key equivocada',
    puntos: [
      'Dos botones: «lo hace todo la IA» y «sugerime». Todo lo que se puede derivar del brief se deriva; lo que falta se pregunta con opciones.',
      'Media hora después él volvió con el guion generado: «lo hizo bastante mal». Tres causas concretas, todas de prompt y ninguna de plomería — no siguió los ejemplos de hook del ángulo Lead Magnet, salió confuso, y **metió a la fuerza los tres lead magnets en un solo guion**, que es exactamente la regla de «un anuncio, un objetivo» rota por dentro.',
      '⚠️ **El diagnóstico obvio era el equivocado, y lo dio él.** Leila hacía el onboarding y el guion fallaba con «conectá tu API key»: ya la tenía cargada. Lo que se había acabado era la **cuota gratuita** de Gemini. Un error de cuota disfrazado de error de credencial manda al usuario a re-pegar una key que estaba perfecta.',
    ],
    commits: [
      { sha: '83998c8', msg: 'crear un guion ya no interroga — MaKo lo hace solo o sugiere todo con preguntas cerradas', lineas: 342, archivos: 3 },
      { sha: '8fb0a71', msg: 'calidad del guion (un solo lead magnet + hooks del ángulo + CTA acorde) + voseo + muletillas cerradas', lineas: 86, archivos: 5 },
      { sha: 'f6d2bd1', msg: 'el error del guion decía "conectá tu API key" a quien ya la tenía (era la cuota)', lineas: 49, archivos: 2 },
    ],
    archivos: [
      'lib/razones.ts — el prompt del guion y la distinción cuota / credencial',
      'app/onboarding/MatrizView.tsx — los dos botones y el modal con scroll',
    ],
  },

  // ── 5, 6 y 7 de agosto · Content Machine ───────────────────────────────────
  {
    fecha: '5 ago', hora: '17:35', chat: AWAG, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Que reemplace lo que hoy vive en Ads Writer',
    pedido: '(17:25) Revisa el plan... Mañana tengo reunión con Mauricio y quiero terminar completamente la funcionalidad de creación de guiones, para ello hay muchas tareas pendientes, revisalo.\n\n(17:35) Si, hazlo todo e implementalo en Ads Writer, reemplaza completamente lo que hoy vive en ads writer',
    puntos: [
      'La fábrica había nacido **adentro del onboarding** (`app/onboarding/MatrizView.tsx`) y ahí se quedó. Este pedido la manda a su tab: lo que vivía en `/ads-writer` era el Ad Copy Studio de julio, otra cosa.',
      '⚠️ **El label y la ruta no coinciden, a propósito.** La tab se llama «Content Machine» pero la ruta sigue siendo `/ads-writer`: el rename se intentó y se revirtió porque había otra sesión trabajando sobre esos archivos. `/content-machine` es un **404 duro**.',
    ],
  },
  {
    fecha: '5 ago', hora: '19:27', chat: AWAG, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La vista global de guiones',
    puntos: [
      'Nació `GuionesGlobal.tsx`: los guiones dejan de estar escondidos adentro del pop-up de una celda y se ven todos juntos, con su estado. `lib/guion-estado.ts` es el estado compartido — antes cada vista lo derivaba por su cuenta.',
      '⚠️ **Este trabajo NO está en un commit que hable de él.** Los 214 archivos nuevos de `GuionesGlobal.tsx`, más `MatrizView.tsx`, `lib/razones.ts` y `lib/guion-estado.ts`, viajaron adentro de `0943b7a`, cuyo asunto habla de Fathom y del detalle de una reunión. Es el patrón que documenta AGENTS.md: la otra sesión hizo `git add -A` con este trabajo a medias en el árbol. Si buscás cuándo nació la vista global con `git log --follow`, vas a caer en un commit sobre el board `/plan`.',
    ],
    commits: [{ sha: '0943b7a', msg: 'Buscar más aunque no haya resultados, Ver más por tandas, y el detalle de una reunión que no miente (se llevó la vista global de guiones adentro)', lineas: 729, archivos: 14 }],
    archivos: [
      'app/ads-writer/GuionesGlobal.tsx — NUEVO (214). Todos los guiones del workspace en una vista',
      'app/ads-writer/AdsWriterApp.tsx — reescrito alrededor de la fábrica (278 líneas tocadas)',
      'lib/guion-estado.ts — NUEVO (55). El estado del guion, en un solo lugar',
      'app/onboarding/EstadoChip.tsx · app/onboarding/guion-ui.ts — lo compartido entre las dos vistas',
    ],
  },
  {
    fecha: '6 ago', hora: '13:30', chat: AWAG, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'No limitar a la IA, aprovechar Ads Analyst, y que se vea «wow»',
    pedido: 'Revisa el plan, hay muchas tareas respecto a la generación de guiones...\nPor otro lado:\n\n1. Creo que sería bueno que aprovechemos la IA y no la limitemos en la generación. Me refiero a que en lugar de generar solo 3 avatares, solo 3 razones, solo 3 lead magnet... No se, pueda generar 100. Y que de eso eliga el mejor y que luego el usuario si no está conforme pueda cambiarlo por todas las otras disponibles.\n2. Ya tenemos construida toda la funcionalidad de Ads Analyst, y no la estamos aprovechando para la generación de guiones... No estamos viendo cuales son los ganadores para basarnos más en eso o recomendarle al usuario que ese es un angulo ganador... No estamos etiquetando a los guiones que se crearon y publicaron en Meta por fuera de Ads Writes con las etiquedas de avatar, angulo, razon, etc... No estamos aprovechando los "Patrones" que ya hace ads analyst... Revisalo bien todo para poder aprovecharlo.\n3. Revisa bien el diseño de la tab, tiene que ser mucho más simple de utilizar, de navegar... Tiene que ser minimalista, se tiene que ver "wow" no puro texto o botones amontonados... Si son muchos guiones podemos hacer un formato galería.',
    puntos: [
      'El punto 1 rompe una restricción que nadie había pedido: el 3×3 era la unidad de **testeo**, no el techo de la **generación**. Generar 100 y elegir el mejor cuesta lo mismo en atención del usuario y le deja un banco de repuesto.',
      '**El punto 2 es el agujero grande del área y sigue abierto.** La fábrica genera a ciegas: Ads Analyst ya sabe qué anuncios ganaron y ya calcula Patrones, y nada de eso entra al prompt del guion. Los dos módulos ni siquiera comparten vocabulario — un workspace tiene 89 análisis de anuncios y **cero** avatares.',
      'Del mismo lote salió el umbral de ganador: **desde 1 agenda**, con la intención declarada (formularios rellenados) como señal secundaria. Las agendas siempre mandan.',
      'En la misma respuesta fijó el nombre: «Será "Content Machine" el nombre. Hay otro claude trabajando en la sidebar y las rutas» — y por eso la ruta quedó como quedó.',
    ],
  },
  {
    fecha: '7 ago', hora: '03:27', chat: AWAG, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'IDEAS: un input suelto que se expande hasta guion',
    pedido: 'A demás de los guiones, los angulos, los avatares, etc... Me gustaría agregar "IDEAS" que sea algo similar a lo de la landing de Mila, un solo input de texto que tiene una animación que va escribiendo y borrando, y a raiz de eso, salen las IDEAS que los dueños de negocio pueden ir teniendo sueltas...\n\nEsa idea dentro de la content machine se puede transformar en muchas piezas de contenido.\n\nLuego tenemos que procesar esas ideas, ir guiandole al usuario para expandirla y transformarla en un guion.',
    puntos: [
      'El origen es explícito: mila.gg. Lo que le interesó de ahí no es el input, es la premisa — «eso es lo que le falta a muchas cosas de MaKo, que se sienta como IA».',
      '⚠️ **La sesión cerró sin verificar.** Su último mensaje, 36 minutos después, fue «En donde lo metiste? hay una tab de ideas». No encontró dónde había quedado. `app/ideas/page.tsx` existe pero entró por la sidebar (commit del rediseño), no por acá.',
      '**El diseño correcto de esto ya está estudiado y contradice el instinto:** una idea rinde muchas piezas **por ÁNGULO, no por canal**. Si producís 5 piezas cambiando «escribilo como reel / como email / como carrusel», son la misma cosa reformateada — el canal es envase. Multiplicar ángulos da variedad genuina sin backend nuevo; multiplicar formatos cuesta N generadores con N parsers.',
    ],
  },
  {
    fecha: '7 ago', hora: '12:23', chat: 'Estrategia de dos cuentas Claude', cuenta: 'claude1', actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que quedó escrito, y lo que quedó abierto',
    puntos: [
      '⚠️ **Los cuatro prompts que gobiernan toda la Content Machine son invisibles.** `lib/razones.ts` llama a `renderPrompt()` con `razones.system`, `razones.user`, `razones.sugerir` y `razones.guion`. Los overrides funcionan, pero ninguna de las cuatro está en `lib/prompt-registry.ts`, que es lo único que alimenta la UI de /configuraciones. O sea: no aparecen, no se pueden editar, y **el compilador no lo ve**. Incluye la regla de las preguntas cerradas, justo la que él más quiere tocar. Hay skill para auditarlo: `verify-prompt-registry-sync`.',
      '**Lo que envenena el brief sin avisar:** el Archivero acepta cualquier URL y `computeEffective` itera con «el último pisa». Pegar la web de un competidor le reescribe los 11 campos del brief al cliente — y ese brief es lo que alimenta avatares, razones y guiones. Un guion malo puede no ser culpa del prompt.',
      'Pendientes con archivo: CRUD de ángulos y avatares editable desde Script Analyst · guardar la transcripción del anuncio al cargarlo, para no transcribir dos veces · el **ENTREGABLE** y la capa de **Personas** de la fábrica quedaron sin salir · ruta propia (deep link) para cada guion analizado, que hoy vive solo en sub-tabs.',
      'Todo esto vive en `docs/hallazgos-ads.md`, sección «Análisis de creativos, guiones y diagnóstico». Antes de actuar sobre una entrada, verificá contra el código: parte del material es de segunda mano, de la cosecha retroactiva de 260 corridas multi-agente.',
    ],
    commits: [
      { sha: 'f315269', msg: 'Cosecha retroactiva: 134 de 260 corridas no habian escrito nada', lineas: 193, archivos: 1 },
      { sha: 'dc0e1bd', msg: 'Los hallazgos, reorganizados para que se puedan leer', lineas: 645, archivos: 1 },
    ],
    archivos: ['docs/hallazgos-ads.md — las trampas del área, con la ruta adentro de cada entrada para poder grepearla'],
  },
];
