// =============================================================================
// Change History — el rediseño, pedido por pedido y commit por commit
// =============================================================================
// ESTO NO ES UN CHANGELOG. Un changelog ya lo tenés en `git log`. Acá va lo que
// git no guarda: qué pidió el dueño con sus palabras, qué se entendió, qué se
// hizo, y —sobre todo— **cuándo el diagnóstico obvio era el equivocado**.
//
// PARA QUÉ. Este repo lo trabajan DOS cuentas de Claude Code en paralelo
// (docs/dos-cuentas.md) y el contexto de una sesión NO viaja a la otra. Cuando
// la cuenta 2 abra el rediseño, esto es todo lo que va a tener. Por eso cada
// entrada lleva los archivos, el commit y la línea donde vive lo que se decidió.
//
// CÓMO SE AGREGA UNA ENTRADA
//   fecha/hora  del commit, no del recuerdo:
//               git log --date=format:'%d %b %H:%M' --format='%h %ad %s'
//               (los prompts salen del transcript de la sesión, en hora local)
//   chat        el título de la sesión de Claude Code. Vive en
//               %APPDATA%\Claude\claude-code-sessions\<cuenta>\<org>\<sesión>.json
//               campo `title`.
//   cuenta      cuál de las dos. ⚠️ NO se puede detectar sola: el 8/8 esta
//               sesión corría en la 2 con CLAUDE_CONFIG_DIR vacío, y
//               ~\.claude.json declaraba «Mauricio» de un login de julio. La
//               app de escritorio se loguea aparte del CLI, así que el config
//               dir, el oauthAccount y el nombre de la carpeta mienten los
//               tres. Preguntá; no lo deduzcas. (docs/dos-cuentas.md)
//   actor       'martin' si es un pedido suyo · 'claude' si es trabajo del agente
//   tipo        prompt · implementacion · investigacion · correccion · cosecha
//
// Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

// Los tipos se mudaron a app/admin/dev/_registro/tipos.ts cuando dejó de haber
// una sola bitácora: Onboarding, General, Chatbot y Ads Generator tienen la
// suya y se pintan con el mismo componente.
import type { Hito, Parte } from '@/app/admin/dev/_registro/tipos';

export type { Hito, Parte };

// El título real de la sesión, no uno inventado.
const CH = 'Rediseño por partes';
/** La sesión que retoma el rediseño desde la cuenta 2. */
const CH3 = 'Parte 3 · Gramática de MaKo';

export const BITACORA: Hito[] = [
  // ── 6 de agosto ────────────────────────────────────────────────────────────
  {
    fecha: '6 ago', hora: '12:20', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Arrancar el rediseño, por partes',
    pedido: 'Quiero implementar todo el rediseño que esta en el plan, es bastante, asi que vamos por partes.',
    puntos: [
      'El alcance son **21 tareas** del board `/plan` (#516–#535 y #538), agrupadas después en las nueve partes que se ven arriba.',
      '«Por partes» resultó ser la decisión más importante de todo esto: el documento dice que el rediseño **no debe empezar corrigiendo pantallas aisladas**. Primero el sistema, después las tabs. Sin eso, cada tab vuelve a resolver localmente los mismos problemas.',
    ],
  },
  {
    fecha: '6 ago', hora: '12:54', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Parte 1 · Los cimientos',
    puntos: [
      'Lo que se midió antes de tocar nada, sobre `app/`: **7.510** `style={{…}}` contra 767 `className`, **1.158** `<button>` sueltos, 269 `<input>`, 93 `<textarea>` y **2 media queries** en todo `globals.css`.',
      'Un solo dorado. Había **cuatro** para la misma marca: `#C8870C` (`--accent`), `#F0C60A` (`--accent-soft`) y el par `#F6D365`/`#EF9F27` que `MakoBrand.tsx` definía por su cuenta. Ahora es `#F2B01E`, el del logo entregado.',
      'El warning dejó de ser un tercer dorado y pasó a **naranja** (`--warn-fill: #EE7B1C`): era imposible que «cuidado» no se leyera como «MaKo».',
      'Los ocho estados de pantalla. Faltaban **cuatro enteros** —cero apariciones en todo el repositorio—: `NoResults`, `StaleData`, `PermissionState` y `Banner`/`Alert`.',
      'Una sola confirmación (había dos, y ninguna mandaba) y un solo campo de texto (había tres).',
      '⚠️ **Se coló en el commit de otra sesión.** Los primitives (`ui.css`, `Button`, `Field`, `tokens`, `Toggle`, `Select`, `globals.css`) entraron en `974b4a4`, cuyo asunto habla de «Los 24 proyectos de cliente». Es exactamente el peligro que documenta AGENTS.md: la otra cuenta hizo `git add -A` con mi trabajo a medias en el árbol. Si buscas cuándo nació `app/_ui`, `git log --follow` te va a mandar a un commit que habla de otra cosa.',
    ],
    commits: [
      { sha: '974b4a4', msg: 'Los 24 proyectos de cliente + las 11 invenciones corregidas (se llevó app/_ui adentro)', lineas: 1108, archivos: 10 },
      { sha: '50a95b2', msg: 'Rediseño · Parte 1: los cimientos (un solo dorado + biblioteca de primitives)', lineas: 1306, archivos: 21 },
    ],
    archivos: [
      'app/_ui/tokens.ts — SANS/MONO, radius, space, type, weight, TOUCH, shadow, FOCUS, EASE, TONO',
      'app/_ui/ui.css — TODO lo que necesita :hover, :focus-visible, :disabled o animación. Se importa una sola vez desde globals.css',
      'app/globals.css — la regla de color escrita arriba de todo, y los tokens de la escala',
      'app/_ui/Button.tsx · Field.tsx · Select.tsx · Toggle.tsx · Badge.tsx · Feedback.tsx · Tooltip.tsx · Avatar.tsx',
      'app/_ui/Estados.tsx — los 8 estados de pantalla + Banner/Alert',
      'app/_ui/Confirm.tsx · Toast.tsx — una sola implementación de cada uno',
      'app/_ui/LEEME.md — qué hay, cuándo se usa cada cosa y las reglas de crecimiento',
      'app/admin/ui/CatalogoUI.tsx — el catálogo vivo, que nació aquí',
    ],
  },
  {
    fecha: '6 ago', hora: '13:20', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Los documentos fuente, poder verlo, y buscar referencias',
    pedido: 'Te paso también los archivos de contexto, para que tengas más info…\nSería bueno que a medida que vayas implementando pueda ir visualizando y también que te bases en https://www.skills.sh/ para aprovechar las skills de diseño.\nY también busques como lo diseñan otras apps que lo hacen bien, así tienes referencia.',
    puntos: [
      'Adjuntó `Arquitectura MaKo.md` y `MaKo_Contexto_Integral_Rediseno_Claude_Code.pdf` (40 páginas). Es el documento que gobierna todo esto: los §18.3 (escala tipográfica) y §19.2 (tabs) que se citan más abajo salen de ahí.',
      'De aquí salió la skill `frontend-design`, que quedó instalada en `.claude/skills/frontend-design/`.',
      '«Poder ir visualizando» fue el germen de esta pantalla: primero fue un HTML publicado afuera, después `/admin/rediseno`, y terminó siendo esta tab.',
    ],
  },
  {
    fecha: '6 ago', hora: '13:39', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Parte 2 · La navegación por intención',
    puntos: [
      'La barra dejó de ser el inventario de módulos y pasó a agruparse por **para qué la abres**: cuatro familias con su pregunta.',
      '`PageHeader` con una línea de propósito: qué pregunta responde cada pantalla.',
      '**Corrección sobre la Parte 1:** la escala tipográfica del documento (§18.3) son **siete** niveles con base 14 px, no cuatro con base 15 que había shipeado. Los tokens se renombraron por USO (`--fs-card`, `--fs-sect`) y no por tamaño, justamente para que un cambio de valor no obligue a renombrar nada.',
    ],
    commits: [{ sha: '19f2597', msg: 'Rediseño · Parte 2: navegación por intención + PageHeader', lineas: 1146, archivos: 14 }],
    archivos: [
      'app/_components/nav.ts — reescrito. `FAMILIAS` con `bloques` (a la vista) y `grupos` (desplegable al costado). ⚠️ La `key` de cada item es CONTRATO: se escribe en base para las capas (lib/capas.ts) y para el onboarding por tab. El label y el href se pueden cambiar; la key no.',
      'app/_components/Sidebar.tsx — el rail de 68 px que se ensancha a 244',
      'app/_ui/PageHeader.tsx — PageHeader / Section / Eyebrow',
    ],
  },
  {
    fecha: '6 ago', hora: '13:55', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Diez correcciones a la primera barra',
    pedido: '1. Elimina "MaKo DOER" eso no tiene sentido. Es lo mismo que preguntale a MaKo.\n2. Que saldo de IA viva dentro del desplegable que aparece al pasar el cursor por la foto de perfil.\n3. Elimina "DM Writer" Ya está Chat Agent.\n4. Elimina FOCUS y que esté dentro de Operate.\n5. No elimines los iconos de antes, eso hace que sea entendible facilmente.\n6. Que por default esté abierto siempre "Operate".\n7. Agrupa las tabs como estaba antes también, con un desplegable al costado, porque no tiene sentido ver un montón de chats por ejemplo.\n8. Revisa el espaciado y el diseño minimalista, es importante eso. Ya tienes las referencia, las skills, hazlo bien.\n9. Elimina "Marketing OS" del logo de MaKo y centra la palabra MaKo con el logo.\n10. En el html me dejaste un montón de cosas ilegibles como en la captura…',
    puntos: [
      'El punto 5 fija una regla que se sostiene hasta hoy: **todos los ítems llevan ícono**, también los anidados. El dibujo es lo que hace que la fila se reconozca sin leerla.',
      'El punto 7 revirtió una decisión mía: había sacado los desplegables para «aplanar» la navegación y el resultado era ver nueve Analysts abiertos para entrar a uno.',
      'El punto 10 era un bug real del HTML que le había mandado: `ul.lista li { display: grid }` hacía que cada `<strong>` fuera su propio item de grilla, así que el texto se metía en una columna implícita angostísima.',
    ],
  },
  {
    fecha: '6 ago', hora: '14:06', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Las diez correcciones',
    puntos: [
      'Se fue **Focus** (una familia entera para una sola pantalla) y «General» pasó a ser lo primero de Operate.',
      'Se fueron **MaKo Doer** (era el mismo chat que `/mako`) y **DM Writer** (lo hace el Chatbot).',
      'El saldo de IA se mudó al desplegable del perfil: «visible, nunca protagonista». Al lado de las tabs competía todo el tiempo por algo que se mira una vez por semana.',
      'El logo dejó de tener «Marketing OS» debajo y pasó a ser un **link** a `/general`, que es lo que todo el mundo espera del logo de una app.',
    ],
    commits: [{ sha: '39dc0a9', msg: 'Rediseño · la barra, con las correcciones de Martín', lineas: 453, archivos: 4 }],
    archivos: [
      'app/_components/Sidebar.tsx (292 líneas tocadas)',
      'app/_components/nav.ts (115)',
      'app/_components/SaldoMaKo.tsx (33) — le nació la prop `tema?: claro | oscuro`, default claro, porque ahora vive en el menú blanco del perfil',
    ],
  },
  {
    fecha: '6 ago', hora: '15:13', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Hover, desplegables en blanco y separar las secciones',
    pedido: '1. Haz que "Hoy" vuelva a ser "General"\n2. Saldo de Ia arriba del todo. Y cerrar sesión en rojo.\n3. Los desplegables en blanco, como el del perfil.\n4. Si tengo abierto "Operate" y la barra está plegada, se tienen que ver los otros íconos.\n5. No me gusta el ícono de "Operate" cambialo a uno más adecuado, y que no sea muy parecido al de "Create".\n6. Al pasar el cursor por las tabs de la sidebar se tienen que pintar o algo debe pasar, para que sea más intuitivo.\n7. Diferencia más las 3 secciones de las tabs internas, de alguna manera.',
    puntos: [
      'El punto 6 y el 7 son los que van a volver **cinco veces más**. Ninguno se resolvió aquí.',
      'El punto 3 fijó una regla: los desplegables van en **blanco**, como el del perfil. Uno oscuro flotando sobre el contenido claro se leía como parte de la barra, y entonces no quedaba claro si te habías ido de la sección.',
    ],
  },
  {
    fecha: '6 ago', hora: '15:21', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hover, jerarquía y los desplegables en blanco',
    puntos: [
      'El desplegable de una colección pasó a `createPortal` sobre `document.body`: adentro del `<aside>` quedaba recortado por el `overflow: hidden` del panel.',
      'Salir de sesión en rojo (`.mk-salir`): es la única acción destructiva del menú del perfil, la que no quieres tocar por error buscando Configuraciones.',
      'El ícono de Operate pasó a `rayo`.',
    ],
    commits: [{ sha: '4f12f78', msg: 'Rediseño · la barra: hover, jerarquía y los desplegables en blanco', lineas: 212, archivos: 4 }],
    archivos: ['app/_components/Sidebar.tsx (168)', 'app/_ui/ui.css (26)', 'app/_components/nav.ts (14)', 'app/_components/icons.tsx (4)'],
  },
  {
    fecha: '6 ago', hora: '15:45', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«Al navegar por la sidebar pasan cosas raras»',
    pedido: 'Al navegar por la sidebar pasan cosas raras…\n\n1. Si yo abro uno de las 3 secciones, se debería mantener abierta.\n2. Muchas veces para abrir una sección o lo que sea tengo que dar doble click, es como que queda en lo anterior, no se si es por los deplegables o que.\n3. Abro un desplegable e incluso sin cerrar la sidebar se cierra la sección en la que estaba navegando y se abre operate.\n4. En "Create" elimina el desplegable y que quede: "Content Machine" reemplazando Ads Writer. Y si, debes reemplazar la ruta. Abajo "Chat Agent" y cambiale el ícono que no tiene nada que ver. Luego vienen "Landing Generator" y "VSL Generator", siempre los nombres deben coincidir con la ruta.\n5. En Analyze agrega la primera tab que sea "Second Brain", por ahora replica lo que hay en onboardin allí dentro. Luego dashboard, luego saca a "Market Analyst" y pongo abajo de dashboard como "Competitor Spy", cambiale el icono claro. Luego experiments y luego analysts.\n6. Reordena "Analysts". Así: Offer, Ads, Landing, VSL, Closing, CS… Todos con el Analyst, claro.\n7. Reordena "Operate": General, Plan por un lado. Luego separalo con una linea o separando un poco más de distancia y "CRM" y "Ads Manager". La misma separación y abajo los chats, pero sin el desplegable, los tres uno abajo del otro.\n8. Las 3 secciones se tienen que diferenciar claramente de las tabs, hoy tienen el mismo diseño y eso hace que se confunda y no sea intuitivo. Tanto cuando esta plegada como cuando esta desplegada la sidebar.',
    puntos: [
      'Los puntos 1, 2 y 3 son **tres síntomas de causas distintas**, y ese fue el error de lectura: los traté como un solo bug de estado durante un rato.',
      'El punto 4 fijó otra regla que se sostiene: **el nombre de la tab tiene que coincidir con la ruta**. De aquí salieron los renombres `/landing-writer`→`/landing-generator`, `/vsl-writer`→`/vsl-generator`, `/market-analyst`→`/competitor-spy`.',
    ],
  },
  {
    fecha: '6 ago', hora: '16:02', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra deja de perder dónde estabas parado',
    puntos: [
      '**La causa raíz del punto 1:** la familia desplegada se **derivaba** en cada render de la ruta y del cursor, y se limpiaba en el `onMouseLeave`. Pasó a ser estado (`useState`) con un ajuste en fase de render cuando cambia la ruta — el patrón de React de «ajustar estado cuando cambia una prop», hecho en render y no en un efecto (un efecto pintaría un frame con la familia equivocada).',
      'Los renombres de ruta se hicieron con `git mv` **más un stub de redirect** en la ruta vieja: los links viejos circulan.',
      '⚠️ Aquí casi rompo el trabajo de la otra sesión: hice `git mv app/ads-writer` con **367 + 199 líneas sin commitear** de la otra cuenta adentro. Se detectó y se devolvió intacto, y por eso Content Machine sigue apuntando a `/ads-writer`.',
    ],
    commits: [{ sha: '4e8380f', msg: 'Rediseño · la barra deja de perder dónde estabas parado', lineas: 454, archivos: 13 }],
    archivos: [
      'app/_components/nav.ts (121) · app/_components/Sidebar.tsx (119)',
      'app/second-brain/page.tsx (49) — stub nuevo',
      'app/landing-generator/ + app/vsl-writer/ + app/landing-writer/ — renombres con redirect',
    ],
  },
  {
    fecha: '6 ago', hora: '16:15', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'El chip, el cerebro, y «espera a que la barra esté abierta»',
    pedido: '1. Está bien que el chip con el número aparezca en la sección, pero una vez que esa sección está desplegada no debe aparecer más allí, sino en la tab correspondiente.\n2. Las secciones aún no se diferencian bien de las tabs, revisa como hacerlo y que quede bien.\n3. Second Brain un icono de cerebro, obvio.\n4. Revisa la captura, funciona mal el desplegable, eso es porque debe esperar a que la sidebar esté abierta del todo para recién poder desplegar. Creo que muchos bugs se deben a eso, debería tener un status de abierto o cerrado la sidebar y guiarse por ahí muchas cosas…\n5. Agrega un "Chat Analyst" antes de closing analyst.\n6. Siento que "MaKo" con el logo arriba están muy sueltos… Tal vez podrías ponerle una animación o algo.\n7. Quiero agregar una tab de "Reportar problema" que sea "Tickets" la ruta, pero no se si ponerla abajo de "Preguntale a MaKo" o dentro del desplegable del perfil. Decide tu',
    puntos: [
      '**El punto 4 fue el diagnóstico correcto, y lo dio él, no yo.** El desplegable se posicionaba midiendo la barra con `getBoundingClientRect()` **mientras** el ancho estaba animándose de 68 a 244 px. Se agregó el estado `moviendo` + `barraQuieta`, y nada que dependa de la geometría se ejecuta durante esos 200 ms.',
      'El punto 1 tiene una razón que vale escribir: un contador en la sección abierta te dice que hay 14 cosas pendientes, pero no cuál de las siete filas las tiene.',
      'Del punto 7 decidí: **abajo de «Preguntale a MaKo» no** — va en el menú del perfil, porque reportar un problema no es una capacidad del producto.',
    ],
  },
  {
    fecha: '6 ago', hora: '16:47', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El número baja a la tab, y el estado de la barra',
    puntos: [
      'Red de seguridad del `transitionend`: ese evento **no llega** si la animación se interrumpe, si la pestaña está en segundo plano o si el usuario pidió menos movimiento. Sin un `setTimeout(260)` de respaldo, `moviendo` se quedaba en `true` para siempre y los desplegables no volvían a abrir nunca — un cuelgue silencioso.',
      'El contador solo se muestra en la familia mientras está **cerrada**: es un resumen de lo que no estás viendo.',
    ],
    commits: [{ sha: 'a57ee54', msg: 'Rediseño · el número baja a la tab, y la sección deja de parecer una tab', lineas: 367, archivos: 6 }],
    archivos: ['app/_components/Sidebar.tsx (299)', 'app/_ui/ui.css (21)', 'app/tickets/page.tsx (13) — stub nuevo', 'app/chat-analyst/page.tsx (9) — stub nuevo'],
  },
  {
    fecha: '6 ago', hora: '18:23', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«Se cierra sola» y los primeros SVG',
    pedido: '1. Te paso como quiero el ícono de second brain. Y el de "Chat Agent". Que por cierto, cambia el nombre como el de la ruta a "Chat Bot". Y también te paso el de "Content Machine".\n2. Aún no se logra diferencias las 3 secciones de las tabs… Tal vez hacer más grande lo de las 3 secciones y englobar las tabs dentro de. No lo se, pero revisalo.\n3. Estoy navegando por la sidebar y al pasar el cursor por una sección o por algunos lugares, se cierra sola, no debería tener ese comportamiento. Revisa eso muy bien, pruebalo o haz lo necesario, eso tiene que ser muy fluido.',
    puntos: [
      'El punto 2 trae la solución que terminó funcionando —«englobar las tabs dentro»—, después de tres intentos míos que no funcionaron.',
    ],
  },
  {
    fecha: '6 ago', hora: '18:33', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra deja de cerrarse sola',
    puntos: [
      '**El diagnóstico obvio era el equivocado.** No era un problema de timers ni de zonas muertas: `Familia` y `GrupoFila` estaban **declaradas dentro del render** de `Sidebar`. Cada render creaba tipos de componente nuevos, así que React desmontaba y remontaba la navegación entera en cada cambio de estado. Se hoistearon a scope de módulo.',
      'El segundo mecanismo: cuando un hijo se re-crea debajo del cursor, el navegador dispara `mouseout` y React lo traduce a `mouseleave` **aunque el puntero no se haya movido un píxel**. Y como después no hay `mouseenter` (nunca saliste), nada cancelaba el reloj de plegado.',
      'La solución no es más timers: antes de plegar se le **pregunta al DOM** (`panelRef.current?.matches(\':hover\')`). `:hover` es la verdad del navegador y no depende de que los eventos hayan llegado bien.',
      'Las secciones: el rótulo salió AFUERA de la caja y las tabs quedaron ADENTRO, con fondo al 6 % y borde al 8 %. El intento anterior le había puesto una superficie al rótulo y salió peor — una franja clara con texto es exactamente lo que hace un item ACTIVO, así que la sección parecía la tab seleccionada.',
    ],
    commits: [{ sha: 'f00f9cf', msg: 'Rediseño · la barra deja de cerrarse sola, y la sección deja de ser una fila', lineas: 149, archivos: 19 }],
    archivos: ['app/_components/Sidebar.tsx (69) — el hoist + programarPlegado()', 'app/_components/icons.tsx (36)', 'app/chat-bot/page.tsx (14) — renombre de /chat-agent'],
  },

  // ── 7 de agosto ────────────────────────────────────────────────────────────
  {
    fecha: '7 ago', hora: '02:17', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Content Machine como sección propia, y «haz bien esto de una vez»',
    pedido: '1. Aún no se diferencia bien las secciones de las tabs. Haz bien esto de una vez…\n2. Te había pedido que al pasar el cursor por las tabs estas interactuen, como lo hacen las secciones.\n3. Quiero que "Content Machine" sea otra sección más, dentro tendrá "Ideas" luego un desplegable llamado "Ads" que contenga "Ads Writer" - "Image Generator" - "Video Generator". Luego otro desplegable llamado "Instagram" con "Reels" - "Carousels" - "Stories". Por último uno que sea "YouTube" con "YouTube Writer" - "Thumbnails". Los 3 desplegables con los logos reales, utiliza el de Meta para el caso de Ads. Y bueno para Ideas un foco o algo así.\n4. Te paso los SVG',
    puntos: [
      'El punto 2 lo había pedido **dos veces antes** (15:13 punto 6 y otra). Que haya que repetirlo dos veces era la señal de que no era «me olvidé»: era un bug.',
    ],
  },
  {
    fecha: '7 ago', hora: '02:31', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: 'El hover que nunca se veía',
    puntos: [
      '**La causa, después de dos rondas de no encontrarla:** la regla `.mk-navrow:hover` estaba escrita hacía tres commits y no se aplicaba **nunca**. El componente ponía `background: transparent` en el `style` en línea, y un inline le gana a cualquier regla de hoja sin `!important`.',
      'Las secciones sí reaccionaban, pero **por casualidad**: su hover cambia `opacity` con `!important`. Eso explica por qué el síntoma era «las secciones sí, las tabs no» y por qué mirar el CSS no alcanzaba.',
      'La regla que queda: el `style` en línea lleva **solo geometría**. Color, fondo, peso e indicador de activo viven en la clase (`filaStyle()` en `Sidebar.tsx` es literalmente eso, con el porqué escrito arriba).',
      'Content Machine pasó a ser sección propia: Ideas suelto arriba y tres desplegables por canal con la marca de cada uno.',
    ],
    commits: [{ sha: '72984b8', msg: 'Rediseño · el hover roto, Content Machine como sección y tus tres íconos', lineas: 258, archivos: 12 }],
    archivos: ['app/_ui/ui.css (37) — `.mk-navrow`, `.mk-navrow:hover`, `.is-activo`', 'app/_components/Sidebar.tsx (45)', 'app/_components/icons.tsx (59)', 'app/_components/nav.ts (53)', 'app/ideas/ · image-generator/ · video-generator/ · reels/ · carousels/ · stories/ · youtube-writer/ · thumbnails/ — stubs'],
  },
  {
    fecha: '7 ago', hora: '03:21', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Sales Machine y el set de íconos',
    pedido: '1. Cambiar "Create" por "Sales Machine". Y las tabs dentro serán "Landing Generator" - "VSL Generator" - "Lead Magnet Generator" - separación - "Chatbot" - "Sales Email" - "Newsletters" - separación - "Closing Script" - "Sales Roleplay"\n2. Te dejo todos los iconos, asegurate de que esten del mismo tamaño que el resto.',
    puntos: [
      'Los tres bloques de Sales Machine son las tres etapas del embudo: **capturar · conversar · cerrar**.',
      '«Del mismo tamaño que el resto» resultó ser el requisito difícil: los archivos venían a 1500×1500 con márgenes distintos entre sí.',
    ],
  },
  {
    fecha: '7 ago', hora: '03:32', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Sales Machine y los 14 íconos del set',
    puntos: [
      'Cada ícono se escala y se centra por su **caja de tinta**, no por su lienzo: si no, dos dibujos con el mismo tamaño de archivo pero distinto margen se ven de tamaños distintos en la misma columna.',
      'Trece rutas nuevas, todas con el nombre igual al path y todas con el chip «pronto»: no hay backend, y prometer un canal que no existe es peor que no tenerlo.',
    ],
    commits: [{ sha: 'a56135f', msg: 'Rediseño · Sales Machine y los 14 íconos del set', lineas: 214, archivos: 13 }],
    archivos: ['app/_components/icons.tsx (119)', 'app/_components/nav.ts (39)', 'app/closing-script/ · lead-magnet-generator/ · newsletters/ · sales-email/ · sales-roleplay/ — stubs de 8 líneas'],
  },
  {
    fecha: '7 ago', hora: '03:48', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'El ícono de Sales Machine, cuatro veces',
    pedido: '«Reemplaza» (03:48) · «Reemplaza otra vez» (03:54) · «Nuevamente» (03:57) · «Pero si te lo habia pasado sin fondo, va nuevamente» (04:02)',
    puntos: [
      'Cuatro SVG en catorce minutos, cada uno con un commit mío en el medio (`8635a08`, `02ae9f4`, `6c8c379`). Ninguno quedó bien, y el problema no eran los archivos.',
    ],
  },
  {
    fecha: '7 ago', hora: '04:04', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«Se supone que es un símbolo de dólar y me pasaste un círculo»',
    pedido: 'El icono de Sales Machine se supone que es un simbolo de dolar y lo que me pasaste es un circulo…',
    puntos: [
      'Aquí se cortó el ciclo. El problema no era el archivo que mandaba: era mi conversor.',
    ],
  },
  {
    fecha: '7 ago', hora: '04:08', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: 'La trampa del blanco: el hueco no es fondo',
    puntos: [
      'En estos exports el blanco **no es fondo, es el hueco** del dibujo. Repintar todo con `currentColor` convertía el símbolo en una mancha maciza.',
      '**Me equivoqué dos veces razonándolo.** Primero tiré las paths blancas (pero la de abajo es un disco macizo, no un anillo). Después fusioné el hueco con la path *anterior* (que era un contorno fino). Lo correcto: fusionar el hueco con la path de **mayor área neta** y poner `fill-rule="evenodd"`.',
      '**Y mi primera verificación también estaba mal:** medía con `isPointInFill` en coordenadas del viewBox (0–24) en vez de las de la path (0–1500), así que reportaba «hueco» en todos lados. Por eso el conversor termina preguntándole al navegador, que es quien resuelve el fill-rule de verdad.',
      'Nota de entorno: `merge-set.mjs` no encontraba el cierre del mapa porque `icons.tsx` es **CRLF** y el patrón buscaba `\\n};\\n`. Va `/\\r?\\n\\};\\r?\\n/`.',
    ],
    commits: [{ sha: '0e9664c', msg: 'Sales Machine: el signo de dolar, esta vez verificado', lineas: 4, archivos: 1 }],
    archivos: ['app/_components/icons.tsx — el ícono `sales`, con `fill-rule="evenodd"`'],
  },
  {
    fecha: '7 ago', hora: '12:03', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Dejar por escrito lo que se va cambiando',
    pedido: 'Puedes ir dejando todos los cambios y cosas que vayamos trabajando en el link? Rediseño en curso\n\nY la parte de los íconos dejala pero ordenada, como esta en la sidebar',
    puntos: [
      'Este pedido es el que creó esta pantalla. Empezó siendo un HTML publicado afuera.',
    ],
  },
  {
    fecha: '7 ago', hora: '12:07', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El artefacto se genera desde el código',
    puntos: [
      'Primera decisión que sobrevivió a todo lo demás: la barra y los íconos **no se escriben**, se leen de `nav.ts` e `icons.tsx` al generar. Un documento así, escrito a mano, envejece en silencio.',
    ],
    commits: [{ sha: '8856968', msg: 'El artefacto del rediseno se genera desde el codigo', lineas: 446, archivos: 1 }],
    archivos: ['scripts/artefacto-rediseno.ts (446) — borrado después, cuando esto pasó a ser una pantalla'],
  },
  {
    fecha: '7 ago', hora: '12:10', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Que viva en una ruta de MaKo',
    pedido: 'En lugar de que este en esa ruta, lo puedes ir poniendo en una ruta de mako?',
    puntos: [
      'Un HTML publicado afuera hay que regenerarlo. Una pantalla de la app lee el código **en cada carga**: no hay nada que pueda quedar viejo sin que se note.',
    ],
  },
  {
    fecha: '7 ago', hora: '12:16', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El registro se muda a /admin/rediseno',
    puntos: ['Solo super-admin, como el catálogo: es una herramienta de construcción, no producto.'],
    commits: [{ sha: 'e14f624', msg: 'El registro del rediseño se muda a la app: /admin/rediseno', lineas: 806, archivos: 5 }],
    archivos: ['app/admin/rediseno/Rediseno.tsx (225) · bitacora.ts (111) · page.tsx (20)', 'scripts/artefacto-rediseno.ts — eliminado'],
  },
  {
    fecha: '7 ago', hora: '12:24', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Todo en la tab «ui», con sub-tabs. Y el ancho',
    pedido: 'Ponlo todo en la misma tab de "ui". Que dentro de la tab hayan sub tabs para ir organizandolo. Y también revisa que no esta extendido a todo el ancho de las tabs. Eso es algo muy normal que suele pasar cada vez que creamos algo nuevo y no debería, tal vez hay una regla o algo que lo esta haciendo, revisalo para que no vuelva a pasar.',
    puntos: [
      '«Tal vez hay una regla o algo que lo está haciendo» — la hipótesis era razonable y resultó ser al revés: **no había ninguna regla**, y ese era el problema.',
    ],
  },
  {
    fecha: '7 ago', hora: '12:36', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Sub-tabs, y el ancho deja de ser decisión de cada pantalla',
    puntos: [
      '**No había ninguna regla escondida.** Cada pantalla escribe su propio `<main>`, así que cada una elegía su `maxWidth` por separado. Medido: de **44** `<main>`, solo **3** centraban; 16 valores de padding distintos; topes de 720, 980, 1000, 1100 y 1200 según quién la escribió. Copiar la pantalla de al lado propagaba el número.',
      'La solución no es acordarse: el `<main>` lo pone `Pagina` y su prop `style` está tipada **sin** `maxWidth`, `width` ni `margin`. Una pantalla no puede fijarse el ancho aunque quiera; lo rechaza `tsc`.',
      'Trampa de Next que costó un rato: con `useSearchParams()` el boundary **se saltea el render del servidor**. La primera pintura salía vacía y quedaba un `<main>` duplicado y oculto (`div#S:1`) en el DOM. La sub-tab se lee ahora en el server component y baja como prop.',
    ],
    commits: [
      { sha: '37db747', msg: 'Sistema de diseño: una sola tab con sub-tabs, y el ancho deja de ser decisión de cada pantalla', lineas: 722, archivos: 12 },
      { sha: 'ea6f707', msg: 'AGENTS.md: la regla del ancho, donde se lee antes de escribir una pantalla', lineas: 21, archivos: 1 },
    ],
    archivos: [
      'app/_ui/Pagina.tsx — NUEVO. El `<main>` de toda la app',
      'app/_ui/Tabs.tsx — NUEVO',
      'app/admin/ui/CatalogoUI.tsx — el shell con las sub-tabs',
      'app/admin/rediseno/ → app/admin/ui/ — `git mv` de Rediseno.tsx y bitacora.ts, redirect en la ruta vieja',
      'AGENTS.md — la regla, donde se lee antes de escribir código',
    ],
  },
  {
    fecha: '7 ago', hora: '14:05', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Siete puntos: centrado, topbar sin scroll, íconos, Sidebar, branding y podar texto',
    pedido: '1. No es necesario que se extiendan todos los bloques al ancho completo, pueden estar centrados, pero lo que no es como estaba antes.\n2. Como regla de diseño, y esto te pasa mucho, si haces una topbar de navegación NO le pongas scroll, eso está mal.\n3. No veo los íconos allí.\n4. Todas las cosas que vayas poniendo allí se tienen que ver igual que en la app y llamarse igual. Pusiste "La barra" cuando lo llamamos siempre "Sidebar" y no se ve para nada igual que en la app. Puedes agregar más info claro, porque estamos viendolo en la tab de diseño. Pero a simple vista se tiene que ver igual.\n5. Revisa en CONOCIMIENTOS de extraer de allí también las cosas del apartado de "Branding MaKo".\n6. Otra cosa que te pasa mucho al construir una nueva tab o alguna sección es que pones subtitulos innecesarios, textos innecesarios. En este caso "Las piezas y el porqué de cada una. Todo se renderiza de la biblioteca real, no de capturas: si algo se ve mal acá, se ve mal en toda la app.". Revisa esto no solo para ese subititulo, sino para toda la tab de ui\n7. En lugar de "Qué se fue cambiando" pon "Change History". Y agrega fecha, hora, nombre del chat y cuenta. Que esté bien diseñado, estamos justamente trabajando en eso.',
    puntos: [
      'Los puntos 2 y 6 vienen marcados como **«esto te pasa mucho»**: no son correcciones de esta pantalla, son reglas. Por eso terminaron en `AGENTS.md` y en `app/_ui/LEEME.md`, no solo arregladas aquí.',
      'El punto 4 fija el criterio del catálogo entero: **se ve igual y se llama igual que en la app**.',
    ],
  },
  {
    fecha: '7 ago', hora: '14:14', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'investigacion',
    titulo: 'Cinco agentes en paralelo sobre el repo',
    puntos: [
      'Cinco frentes independientes: el branding en Conocimientos · el texto que sobra en la tab · si se puede montar el `Sidebar` real · cómo saber la cuenta y el chat de una corrida · una auditoría de anchos y topbars sobre todo `app/`.',
      '**El hallazgo que cambió el plan:** «Branding MaKo» dentro de Conocimientos **no es un manual de marca**. Es una galería de archivos para descargar (bucket privado `branding` de Storage, catálogo en `branding_assets`, migraciones 0098 y 0100). Cero líneas sobre color, tipografía o voz. Lo que se buscaba estaba en `globals.css`, `MakoBrand.tsx`, `mako-persona.ts` y `docs/mapa-del-proyecto.md`.',
      'La auditoría de topbars encontró la violación que de verdad importaba, y no era la de esta pantalla: las tabs de la **ficha del lead** scrolleaban de costado *y* tenían la barra de scroll oculta por CSS.',
      'De aquí salió también cómo llenar «cuenta» y «chat»: `CLAUDE_CONFIG_DIR` vacío = `~\\.claude` = cuenta 1, y el título de la sesión vive en `%APPDATA%\\Claude\\claude-code-sessions\\<cuenta>\\<org>\\<sesión>.json`.',
      '⚠️ Trampa del entorno: `vercel ls` escribe la tabla por **stderr**. Un `2>/dev/null` para limpiar el ruido deja solo las URLs, sin la columna Status, y un bucle que espera `● Ready` se cuelga para siempre sin decir por qué.',
    ],
  },
  {
    fecha: '7 ago', hora: '14:25', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La Sidebar se monta, y las tabs Íconos y Marca',
    puntos: [
      'La sección mostraba una **imitación** de la barra, dibujada a mano aquí adentro. Dos códigos distintos para la misma cosa: no había forma de que coincidieran.',
      '**No se puede montar el `Sidebar` entero, y el motivo no es el obvio.** No es solo que `usePathname()` devuelva `/admin/ui` y marque la fila equivocada: es que `adminShell = rol === \'admin\' && !impersonando` hace que para el super-admin la barra pinte `ADMIN_NAV` en vez de las cuatro familias. La tab que documenta la barra habría mostrado otra barra.',
      'La solución fue extraer las piezas y compartirlas: `Marca`, `Familia`, `NavLink`, `Identidad`, `panelStyle`, `identidadStyle` pasaron a estar exportadas en `Sidebar.tsx` y las usan la barra de verdad y la vista previa.',
      'La lista de íconos sale de `NOMBRES_ICONO` (`icons.tsx`), no escrita a mano: si no, el día que se agrega un ícono el catálogo dice que no existe.',
      'El ancho pasó a un token (`--pagina-max: 1280px`) y `Pagina` **centra**: un `maxWidth` pegado a la izquierda era lo que dejaba la franja muerta.',
      'La poda: se fue la bajada del encabezado y siete notas de sección. «Esto sale del código» estaba dicho **cinco veces** en la misma pantalla.',
    ],
    commits: [
      { sha: '29d0491', msg: 'Sistema de diseño: la Sidebar se monta en vez de dibujarse, más Íconos y Marca', lineas: 1134, archivos: 15 },
      { sha: '9e87e17', msg: 'Cosecha: los cuatro hallazgos de la corrida sobre /admin/ui', lineas: 107, archivos: 2 },
    ],
    archivos: [
      'app/_components/BarraPreview.tsx — NUEVO (93). Monta la barra con las piezas reales',
      'app/_components/Sidebar.tsx (128) — exporta `Marca`, `Familia`, `NavLink`, `Identidad`, `panelStyle`, `identidadStyle`, `RAIL`, `FULL`',
      'app/admin/ui/Barra.tsx — NUEVO (182). La sección Sidebar + el set de íconos',
      'app/admin/ui/Marca.tsx — NUEVO (195). La marca, junta por primera vez',
      'app/_components/icons.tsx — exporta `NOMBRES_ICONO`',
      'app/_ui/Pagina.tsx — `ancho: medida | completo`, `marginInline: auto`',
      'app/_ui/Tabs.tsx — `flex-wrap` en vez de `.mk-scroll-x`',
      'app/crm/lead-view/LeadTabs.tsx:47 — las tabs del lead dejan de scrollear (la usan LeadDetailBody, EditLeadForm y LeadSheet)',
      'app/globals.css — `--pagina-max`, y se borró `.lead-tabs-scroll`',
      'docs/hallazgos-ui.md — los cuatro hallazgos, con el índice al día en el mismo commit',
    ],
  },
  {
    fecha: '8 ago', hora: '08:33', chat: CH, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'El historial con los prompts, desplegable y con contexto para la otra cuenta',
    pedido: 'En el change history, además de los cambios, quisiera que agregues todos mis prompts.\nQuisiera que:\n\n1. Pongas "Cuenta 1: Mauricio" en lugar de solo Mauricio. Y no lo pongas en un chip.\n2. En el "Rediseño por partes" pongas antes "Nombre del chat: NOMBRE". Y como va a ser largo revisa que no quede mal en el diseño.\n3. Agregues una "Foto de perfil" que en este caso para mis prompts aparecerá la mia de Martin y para tus cambios la tuya, un ícono de Claude.\n4. Los puntos morados, que sean naranjas del color de Claude para tu caso. Y para mis prompts que sean azules.\n5. Como va a ser mucho, haz que se pueda "desplegar" más info. Que al principio solo sea el título. Todos los títulos tienen que tener: "Prompt: TÍTULO" o "Implementación: TÍTULO", o también pueden ser otras palabras como "Investigación" o lo que consideres…\n6. Se más específico en todo. Más detallista para que el Claude de la otra cuenta tenga todo el contexto. Menciona sobre que archivos trabajaste, el commit, no se si incluso el número de las lineas de codigo que tocaste, bueno agrega la info que consideres necesaria para que el otro Claude tenga todo el contexto.\n7. Haz que quede bien en diseño.',
    puntos: [
      'El punto 6 le cambia el propósito a esta pantalla: deja de ser un registro para el dueño y pasa a ser el **traspaso entre las dos cuentas**. Por eso ahora cada entrada trae archivos, commit y líneas.',
    ],
  },
  {
    fecha: '8 ago', hora: '09:10', chat: CH, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El historial completo, con los 19 prompts',
    puntos: [
      'Los prompts y sus horas **no se escribieron de memoria**: salen del transcript de la sesión (`~/.claude/projects/<proyecto>/<sesión>.jsonl`), filtrando los `tool_result`, los `system-reminder` y el resumen de compactación. Las horas están pasadas a local (UTC−3).',
      'Cada fila arranca plegada: solo el título con su tipo. El detalle —el pedido textual, los archivos, los commits— se abre al tocarla.',
      'La metadata pasó de una columna angosta a una **línea horizontal** debajo del título: «Nombre del chat: Rediseño por partes» no entra en 108 px, y era exactamente lo que él avisó que iba a pasar.',
      'Naranja `#D97757` (el de Claude) para lo que hizo el agente, azul `#2F6FED` para los pedidos. Es color de CATEGORÍA, no semántico.',
      'La foto de las entradas de Martín sale de `/api/perfil` (`usuarios.foto_url`): si la cambia en su perfil, cambia aquí. Sin foto, cae a iniciales, que es lo que hace `Avatar`.',
    ],
    archivos: [
      'app/admin/ui/bitacora.ts — reescrito. Tipos `Actor`, `Tipo`, `Commit`; 33 entradas',
      'app/admin/ui/Rediseno.tsx — `ChangeHistory` con filas plegables',
      'app/_components/icons.tsx — ícono `claude`',
      'app/_ui/ui.css — `.mk-hist`',
    ],
  },

  // ── 8 de agosto · la cuenta 2 retoma el rediseño ───────────────────────────
  {
    fecha: '8 ago', hora: '10:58', chat: CH3, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Retomar el rediseño, y dos correcciones',
    pedido: 'Tienes absolutamente todo el contexto? Quiero seguir con la parte del rediseño de MaKo. Te dejé todo preparado para la estrategia de las 2 cuentas, quiero asegurarme que antes tengas todo.\n\n[…] En realidad estás corriendo en claude2 y es la cuenta de Leandro Tejado. Corrigelo, por ahora no vamos a trabajar con la cuenta de Martin.\n\nPon como resuelto la diferenciación de las secciones, eso ya está bien. Y continua con la parte 3. ¿Que hay que hacer?',
    puntos: [
      '**La cuenta 2 es de Leandro Tejado, no de Martín.** Estaba mal en `docs/dos-cuentas.md`, en `docs/conectores.md`, en el `$PROFILE` y en la constante `CUENTAS` que pinta esta misma pantalla: cada tanda de commits le atribuía el trabajo a la persona equivocada.',
      '⚠️ **El disco no alcanza para saber qué cuenta corre.** `~\\.claude.json` declaraba «Mauricio» de un login de julio, `~\\.claude-martin` ni tenía `.credentials.json`, y aun así la sesión era la 2: la app de escritorio se loguea aparte del CLI. La instrucción de arriba de este archivo decía cómo deducirlo — decía mal.',
      '«Diferenciar las secciones» deja de ser la queja viva: la dio por buena. Lo que quedó escrito no es que se hizo, sino por qué fallaron los tres intentos anteriores.',
    ],
    commits: [{ sha: '68a251a', msg: 'La cuenta 2 es de Leandro Tejado, y las secciones ya se distinguen', lineas: 49, archivos: 5 }],
  },
  {
    fecha: '8 ago', hora: '11:34', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Parte 3 · Los nueve estados de MaKo',
    puntos: [
      'Antes de escribir nada: **35 archivos** resolvían por su cuenta el «analizando…», y en `app/_ui/` no había NINGUNA pieza de MaKo — solo el color (un tono `mako` en Button, Badge y Progress).',
      '⚠️ **El Semáforo eran dos tipos incompatibles.** `Semaforo` decía `ambar`/`gris`, `SemaforoAviso` decía `amarillo`/`na`: no coincidían en dos de los cuatro valores, en 158 usos sobre 22 archivos. Un `switch` sobre el equivocado compila perfecto y pinta otro color — no avisa nunca. No era un problema de diseño, era un bug latente.',
      '**El rótulo no es un prop.** Sale del catálogo y no se puede pasar por parámetro: es la única forma de que el criterio de «listo» de la tarea (que se llame igual en Plan, Dashboard, CRM y chat) no dependa de que cada pantalla se acuerde.',
      '**El error que solo se vio renderizando los nueve juntos:** «MaKo está ejecutando» me había quedado AZUL. Azul es «tú actúas» y el que actúa ahí es MaKo. Leído de a un estado parecía razonable; con los nueve uno debajo del otro eran ocho dorados y uno azul sin nada que lo explicara. Va dorado.',
      '**El segundo error, del mismo tipo:** el chequeo de campos obligatorios disparaba también en la variante compacta, que por diseño no muestra esos campos — nueve avisos imposibles de resolver. Una guarda con falsos positivos se ignora a la semana, y ahí deja de avisar de los verdaderos.',
      'La forma: el estado se reconoce por el **filo izquierdo**, no por el fondo. Seis tarjetas seguidas con seis fondos de color son una bolsa de caramelos. Y la estrella brilla solo en «analizando» y «ejecutando» — por eso `MakoStar` ahora acepta `animate`.',
      '⚠️ Convivencia: `app/_ui/ui.css` tenía trabajo sin commitear de la otra sesión pegado al final, así que git daba UN solo hunk de 145 líneas con lo de los dos. Se separó con `hash-object` + `update-index` (el `git add -p` que decía el hallazgo no corre aquí: es interactivo). La receta quedó en `docs/hallazgos-infra.md`.',
    ],
    commits: [{ sha: 'bad3b90', msg: 'Parte 3 · La gramática de MaKo: los nueve estados, en un solo lugar', lineas: 737, archivos: 9 }],
    archivos: [
      'lib/mako-gramatica.ts — NUEVO. La fuente única: los 9 estados con su rótulo, su tono y lo que cada uno exige, más el Semáforo unificado y `normalizarSemaforo()`',
      'app/_ui/Mako.tsx — NUEVO. Un componente, nueve variantes, y el aviso de desarrollo cuando falta un campo obligatorio',
      'app/admin/ui/Gramatica.tsx — NUEVO. El catálogo, con ejemplos del producto real. Va aparte por la tarea #534 (CatalogoUI ya pasa las 500 líneas)',
      'lib/meta-health-ui.ts — `Semaforo` se re-exporta; los colores salen de la paleta de tonos',
      'lib/avisos-catalogo.ts — `SemaforoAviso` marcado deprecado (los datos viejos se migran aparte)',
      'app/_components/MakoBrand.tsx — `MakoStar` acepta `animate`',
      'app/_ui/ui.css — `.mk-mako` y sus partes · app/_ui/index.ts — el export',
      'AGENTS.md — `lib/mako-gramatica.ts` sumado a «Una cosa, un lugar», con la regla del rótulo',
    ],
  },
  {
    fecha: '8 ago', hora: '12:10', chat: CH3, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La barra de super admin, y limpiar sus tabs',
    pedido: 'Por otro lado, corrige la sidebar de super admin, el diseño tiene que ser exactamente el mismo que en cualquier workspace.\nLas secciones no son así, son desplegables...\n\nTabs a modificar o eliminar en SuperAdmin porque no tienen sentido, revisalas igualmente para ver si hacen algo importante...\n\n1. Ruta /metodo tab "Integraciones". Ya existe una tab de integraciones, no tiene sentido ver eso... Eliminala directamente.\n2. La ruta de /admin/guiones la tab de "Guiones" debería estar dentro de la sección de "dev" con nombre de "Ads Writer" que así se llama la feature... Y que ambas tabs de "angulos y estructura" vivan dentro de las tabs que ya estamos acostumbrados a poner, con la primera tab siempre en "roadmap".\n3. Hay una tab llamada "MaKo" que me redirije a otra tab, a la de admin, "clientes". Eso no tiene sentido, elimina MaKo.\n4. Lleva a "Grafo" a dev, y ponlo primero.\n5. Quiero que traigas TODAS las secciones de cualquier workspace al super admin. Ya que vamos a salir a vender MaKo y vamos a utilizar todo. Con la particularidad de que en SuperAdmin existirá una sección de "Admin" y otra de "Dev".',
    puntos: [
      'El pedido 5 cambia qué ES el shell de admin: dejaba de ser «sin tabs de marketing, solo gestión» —que es como estaba escrito— para ser el producto entero MÁS dos secciones propias. La razón es de negocio: van a vender MaKo usándolo.',
    ],
  },
  {
    fecha: '8 ago', hora: '13:05', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra de admin deja de ser otra barra',
    puntos: [
      '⚠️ **No era un problema de estilos: eran dos JSX distintos.** El shell de admin no usaba `<Familia>` — tenía su propia rama con un rótulo estático y una lista plana. Por eso las secciones no se desplegaban y no se parecía a la del producto: ninguna cantidad de CSS lo iba a arreglar. Ahora `ADMIN_SECCIONES` (que era `{titulo, items}`) son dos `NavFamilia` más, y hay **una sola rama** que pinta los dos shells.',
      'La regla que queda: **si dos cosas tienen que verse igual, tienen que ser el mismo componente.** Mientras sean dos ramas de JSX vuelven a divergir a la tercera edición — que es exactamente lo que había pasado aquí.',
      'El super admin ve las CUATRO familias de producto además de Admin y Dev. Funciona sin impersonar porque un admin que no impersona cae en su PROPIO workspace (`resolverDesdeCookies`, lib/workspace.ts). ⚠️ Si el usuario admin no tiene workspace asignado, esas tabs dan 403: para ese caso está el flag `entrarComoDueno`, que quedó enchufado aunque hoy ningún item lo use.',
      '**«MaKo» no era una tab que redirigía: era la ÚNICA puerta a una feature.** Apuntaba a `/admin?tab=copy` y adentro vive el cerebro de copywriting (metodología + swipe de ejemplos); el tab bar de /admin solo mostraba Clientes y Super Admins. Y casi nunca funcionaba, porque el `?tab=` lo lee un efecto de MONTAJE: estando ya en /admin, la navegación del cliente no remontaba nada y te dejaba en Clientes — eso es lo que se veía como «me redirige». Se sacó de la barra y volvió a tener botón propio adentro de /admin.',
      '**«Integraciones» (/metodo) sí hace algo**: es el asistente guiado de credenciales. Se saca de la barra porque duplica la tab de Integraciones, pero la ruta queda: sigue colgando de Configuraciones → «Método».',
      '«Guiones» era el tercer nombre de la misma cosa (la feature es /ads-writer, el registro decía «Ads Generator»). Todo pasa a llamarse **Ads Writer**, y las bibliotecas de Ángulos y Estructuras son dos sub-tabs al lado de Roadmap. Las dos rutas viejas redirigen.',
      '⚠️ Detalle que se ve al final y arruina el trabajo si no se piensa: las dos sub-tabs devuelven el MISMO `<GuionesAdminView>` con otra prop (`panelDe`), no un nodo por tab. Con un nodo por tab, React remonta al cambiar de sub-tab, vuelve a pedir los dos endpoints y **te borra lo que estabas editando**. Verificado en vivo: ir y volver entre Ángulos y Estructuras no dispara ni un request nuevo.',
      'El semáforo se fue a su propia área (`/admin/dev/semaforo`): apareció trabajando la gramática de MaKo, pero no es parte del rediseño. Que dos cosas se toquen no las hace la misma tarea.',
    ],
    archivos: [
      'app/_components/nav.ts — `ADMIN_FAMILIAS` (dos NavFamilia) reemplaza a `ADMIN_SECCIONES`; se van los items `plan`, `mako-admin`, `metodo-admin` y `guiones-admin`',
      'app/_components/Sidebar.tsx — una sola rama de navegación; `familiaDeRuta` busca en las seis; `onEntrarComoDueno` baja por `<Familia>`',
      'app/admin/dev/paneles.tsx — NUEVO. Las sub-tabs extra de un área y su panel, resuelto por tab activa',
      'app/admin/dev/[area]/RegistroArea.tsx — tabs de verdad, «Roadmap» siempre primera',
      'app/admin/dev/ads-generator/ → ads-writer/ (renombrada) · app/admin/dev/semaforo/ — NUEVA',
      'app/admin/guiones/page.tsx — redirige · GuionesAdminView.tsx — acepta `tabExterna` y deja de ser un `<main>` cuando va embebida',
      'app/admin/AdminView.tsx — vuelve el botón «Copywriting»',
    ],
  },
  // ── 9 de agosto ────────────────────────────────────────────────────────────
  {
    fecha: '9 ago', hora: '11:40', chat: CH3, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La tercera vez que rechaza las tarjetas de decisión',
    pedido: 'No solo está cargado, está MAL diseñado, por favor lanza multi agente para investigar como lo hacen otras apps, investiga en https://www.skills.sh/ investiga diseño, copy, buenas practicas de hacer lo que queremos hacer...\n\nNo te quedes con el diseño actual que tenemos, cambialo completamente, incluso la lógica, es mejor que muestre poco en la tarjeta y si la abrís te muestre todo.',
    puntos: [
      '⚠️ **Tercer rechazo de la MISMA pantalla.** Las dos rondas anteriores arreglaron cómo se veían los elementos y ninguna preguntó por qué estaban ahí: de 25 elementos de texto se bajó a 21, y dos de las tres tarjetas ni se tocaron. Cuando el mismo pedido vuelve tres veces, el problema no es el que se está arreglando.',
      'El pedido trae la dirección ya tomada («poco arriba, todo al abrir»), así que lo que quedaba por investigar era **cómo**, no **si**.',
    ],
  },
  {
    fecha: '9 ago', hora: '12:30', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'Seis líneas en paralelo, y skills.sh dio lo más filoso',
    puntos: [
      '**skills.sh es un catálogo de skills de agentes**, y adentro está `impeccable` (pbakaus), que tiene una lista de cosas que se rechazan sin discusión. Dos aplicaban textual a lo que teníamos: *«A kicker or eyebrow above a heading. This one is a **ban, not a default**: no brief earns it back. The heading carries its own weight»* — eso es el rótulo en monospace arriba del título, en las nueve tarjetas — y *«Same-size cards of icon plus heading plus text as the page structure. **Cards are the lazy container**»* — eso son las tres tarjetas iguales apiladas.',
      'Las apps reales dieron el número que faltaba: una fila de checks de GitHub tiene **UN** elemento de texto; una fila de GitHub Advisories tiene 4 y el cuarto es una **oración**, no pares etiqueta-valor. Stripe Radar documenta que su lista existe para *«scan a list of reviews without seeing details»*, y al abrir **todavía** hay un «Show all insights»: ni siquiera el segundo nivel vuelca todo.',
      'Sobre la aprobación irreversible convergen tres sistemas (Cloudscape de AWS, GitLab, Win32): el alcance identificado, la palabra «no se puede deshacer», y la consecuencia en su propia sección. Y Microsoft es explícito en lo que estábamos haciendo mal: *«Don\'t hide needed information because users might not find it»*.',
      'NN/g cerró dos discusiones con dato: varios paneles abiertos a la vez, nunca acordeón exclusivo («restringe la capacidad de combinar información»); y el caret gana sobre el «+» para decir «esto se abre aquí y no te lleva a otra página» (136 participantes, p<0.01).',
      'Lo único que la investigación NO resolvió: si el envío se puede cortar de verdad a mitad de tanda. La propuesta de reemplazar el botón por una ventana de gracia con «Detener» quedó **sin implementar** a propósito — prometer un corte que el backend no puede hacer es peor que el botón de hoy.',
    ],
  },
  {
    fecha: '9 ago', hora: '13:15', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La decisión deja de ser una tarjeta y pasa a ser una fila que se abre',
    puntos: [
      'Medido antes y después con Playwright, que es lo que convierte «está cargado» en algo que se puede cerrar: **de 7 / 8 / 6 elementos de texto visibles a 2 / 2 / 2**, y de 171 / 198 / 169 px de alto a **69 px**.',
      'Cerrada se ven dos cosas: el **título** (el hecho) y la **consecuencia** (la frase con el número que te deja decidir si vale abrir). Cero botones: un botón en una fila cerrada invita a decidir sin haber leído.',
      '⚠️ **La causa de raíz era que la tarjeta dibujaba los CAMPOS del estado en vez de la consecuencia de decidir.** `exige` se leyó como instrucción de layout, así que salía un formulario, y encima el `<details>` tenía como `summary` el índice de las etiquetas que había adentro. Se le sacaban filas al formulario y seguía siendo un formulario.',
      '⚠️ **Y lo que quedaba a la vista se elegía por POSICIÓN** (`datos[0]`). En la aprobación eso dejaba arriba «A quiénes: 340 contactos» y escondía «Qué reciben» detrás de un click, con el botón que manda los 340 mensajes irreversibles siempre visible: **se podía aprobar un envío sin haber visto nunca qué se enviaba**. Hoy el panel muestra el texto de los tres mensajes.',
      '⚠️ **El punto de color nunca se dibujó.** `.mk-dot` solo tiene tamaño por `.mk-status .mk-dot`, y dentro de `<Mako>` no hay ningún `.mk-status`: medía 0×0. Había quince renglones de comentario explicando cómo alinear «una estrella de 14 px y un punto de 7 px», y tres rondas de ajuste fino de centrado, sobre un elemento que no existía.',
      '`esperaAlUsuario` se llama ahora **`bloquea`** y lo tiene solo la aprobación. El nombre viejo agrupaba por «¿tiene botones?» cuando la pregunta es **qué pasa si no hago nada**, y por eso «falta un dato» —donde no espera nadie— se pintaba con fondo de color… que al ser de tono `neutral` salía `--surface-2`, la misma superficie que usa media app. Un realce invisible por construcción.',
      '⚠️ **El rediseño destapó un dato que estaba mal.** La tarjeta decía «Enviar 340 mensajes», y son **1.020**: tres mensajes a cada uno de los 340 contactos. Con la tarjeta abierta, el título, la consecuencia y el campo quedan uno debajo del otro y el mismo número repetido tres veces hace visible que uno miente. Sacar la redundancia no es sólo estética: es lo que deja ver los errores.',
      'Copy: «Tenés que decidir» → «Requiere tu decisión» (y sale el voseo, que es regionalismo y la UI va en neutro). «Qué conviene hacer» → «Sugerencia». «Descartar» → «Ignorar». «Enviar la secuencia» → «Enviar 340 mensajes» / «No enviar». **Regla nueva: ningún botón de MaKo puede ser «Sí», «No», «Aceptar» ni «Descartar» a secas.**',
      'Lo que quedó SIN hacer y dónde vive: las cuatro tarjetas de forma `aviso` siguen con el kicker en monospace (app/admin/ui/Gramatica.tsx + la rama de aviso en Mako.tsx), y la ventana de gracia con «Detener» del envío masivo depende de que el job se pueda cancelar de verdad.',
    ],
    archivos: [
      'app/_ui/Mako.tsx — `<Decision>` nuevo; props `consecuencia`, `advertencia` y `arrancaAbierta`; muere `const [primero, ...resto] = datos`',
      'lib/mako-gramatica.ts — `esperaAlUsuario` → `bloquea` (solo aprobación); rótulos «Sugerencia» y «Aprobación pendiente»',
      'app/_ui/ui.css — bloque `.mk-dec` (fila + panel); se van `.mk-mako--espera` y `.mk-mako__dato--frente`; se arregla `.mk-mako__marca .mk-dot`',
      'app/admin/ui/Gramatica.tsx — copy nuevo y el panel de la aprobación muestra el texto real de los 3 mensajes',
      'AGENTS.md — «Un contrato de datos no es un layout» · docs/hallazgos-ui.md — tres entradas',
    ],
  },
  {
    fecha: '9 ago', hora: '15:40', chat: CH3, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Siete defectos, y el desplegable no va',
    pedido: 'Sigue estando mal diseñado...\n\n1. Textos desordenados, sueltos, volando y letras muy chicas.\n2. Textos que se cortan al medio de la card... eso YA lo habiamos hablado.\n3. Cards que llegan al final del ancho y la info se queda aplastada a la izquierda...\n4. Prefiero que NO sea un desplegable, no se ve lindo, que sea un pop-up con detail BIEN diseñado.\n5. Pusiste cosas de SuperAdmin, como "Mostrar el play sin scroll en mobile" que tiene que ver eso con los clientes?\n6. Rediseñaste solo las primeras de "Requiere tu decisión" y luego dejaste todo feo y viejo.\n7. Siguen habiendo secciones viejas que ya no deberían estar...',
    puntos: [
      'Los puntos 2 y 3 eran **el mismo defecto**, y medido da feo: el contenido ocupaba **603 px dentro de una caja de 1134**. El 47% vacío a la derecha. La regla ya estaba escrita en AGENTS.md —«un maxWidth pegado a la izquierda es lo que deja la franja muerta»— y se violó igual, cuatro veces, cada una con su comentario justificándola.',
      'El punto 4 no es solo estético: un modal de 600 px **arregla el punto 2 y el 3 por construcción**, porque el texto llena su renglón sin que nadie le ponga un tope.',
    ],
  },
  {
    fecha: '9 ago', hora: '17:10', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'correccion',
    titulo: '⚠️ La verificación anterior no probaba nada: la página no hidrataba',
    puntos: [
      '⚠️ **EL HALLAZGO MÁS CARO DEL DÍA.** El rediseño anterior se «verificó» con Playwright —abría con clic, abría con Enter, el caret rotaba, el foco se veía— y al cambiar el `<details>` por un modal de React **nada respondía**. Causa: el árbol de la app nunca hidrataba, y lo que hacía funcionar la versión anterior es que **`<details>`/`<summary>` abre y cierra sin una línea de JavaScript**. Toda la evidencia era evidencia de que el HTML estaba bien.',
      'Cómo se detecta en una línea: `Object.keys(document.querySelector(".mi-clase")).filter(k => k.startsWith("__react"))`. Vacío = no hidrató. ⚠️ El overlay de Next (`<nextjs-portal>`) SÍ tiene fiber aunque la app no hidrate, así que hay que preguntarlo sobre un nodo de la app.',
      'Verificado contra producción para descartar que fuera el rediseño: `hola-mako.com` tiene `__reactFiber$` y `__reactProps$`; el local solo `__reactContainer$` —React crea la raíz y nunca monta—, y falla igual en `/inicio`, `/plan` y `/vsl`, que no se tocaron. Es del entorno local, no del código.',
      'La salida sin matar el server de la otra sesión: **un worktree**, que al ser otro directorio tiene su propio lock. Las tres trampas, todas nuevas: el junction de `node_modules` no le sirve a Turbopack («points out of the filesystem root»), `next dev --webpack` muere con `node:crypto`, y `next start` pone NODE_ENV=production, con lo cual `/api/auth/dev-login` devuelve 404 a propósito. Terminó siendo `npm ci` real adentro del worktree.',
      '✅ **La causa quedó acotada y el clic verificado.** `next dev` NO hidrata en este proyecto; **`next build` + `next start` SÍ**. Sobre el build local, con una cookie de sesión firmada a mano (dev-login es 404 en producción, y esa guarda no se toca): hidrata, el clic abre el modal de 600 px, Escape lo cierra y el foco vuelve a la fila. El worktree, al final, sobró.',
    ],
  },
  {
    fecha: '9 ago', hora: '17:35', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'El detalle se va a un modal de 600 px, y el ancho muerto se muere',
    puntos: [
      'Medido antes y después: los bloques del detalle pasaron de **603 px de contenido con 528 px muertos** a **550 px de contenido con 0 muertos**. Y los campos de un aviso, de 620 px en una caja de 1134 a 1100 px.',
      'La regla que sale, y vale para toda la app: **el único `max-width` del diseño vive en el contenedor**. Es literal de cómo lo resuelven los que lo tienen resuelto: en shadcn/Radix el único ancho está en `DialogContent` y adentro no hay ninguno; en Notion el `max-width` de la página se APAGA al entrar al peek; y Carbon usa un padding PORCENTUAL —que se achica solo— en vez de un tope en px.',
      'Tipografía: de siete elementos repartidos entre 12 y 13 px a cuatro niveles con salto de peso —20/600 el título, 14/400 el cuerpo, 14/500 el valor, 12/400 la etiqueta—. GitHub usa DOS tamaños en toda una fila (16 y 12) y hace la jerarquía con peso y color; la tabla de Geist de Vercel usa uno solo.',
      'La fila, copiada de la lista de advisories de GitHub: título + **píldora de estado INLINE al final del título** (no alineada a la derecha: con nombres de largo muy distinto, a la derecha dejan el borde izquierdo dentado fila por fila) + una línea gris, y el TIEMPO en el riel derecho, que es lo que impide que la fila se vea medio vacía.',
      '⚠️ **La barra de progreso pintaba 1% cuando el dato decía 62%.** `MakoProps.progreso` va de 0 a 1 y `Progress.value` de 0 a 100: los dos son `number` y el compilador no ve nada. Se le había ajustado el ancho TRES veces sin mirar el valor. Si algo se ve mal y ya lo ajustaste tres veces, el problema no es el estilo — es el dato.',
      'Se rediseñaron las cuatro secciones que habían quedado viejas: fuera la monospace del rótulo («monospace as a costume for technical»), `curso` pasa a filas con filete, y el «por qué» de la pastilla inline sale del `title` —un tooltip nativo que falla los tres requisitos de WCAG 1.4.13— y se hace visible.',
      'Se borró la sección «Second Brain y Perro Guardián»: era prosa, no una pieza, y este archivo abre diciendo que aquí no se explica nada. Los textos siguen en `DESCRIPCIONES`.',
      'Los ejemplos ahora cuentan la operación de UN cliente —una clínica que pauta en Meta— en vez de hablar del VSL de la casa y de Martín como responsable.',
    ],
    archivos: [
      'app/_ui/Modal.tsx — NUEVO. La tercera caja de la casa: `Confirm` pregunta, `Modal` muestra el detalle, `WizardShell` conduce un flujo',
      'app/_ui/Mako.tsx — `Decision` es una fila-botón que abre el modal; props `cuando` y `evidenciaRotulo`; el ×100 del progreso',
      'app/_ui/ui.css — `.mk-modal*` y `.mk-det__*`; se van los cuatro `max-width` de adentro; sin monospace en el rótulo',
      'app/admin/ui/Gramatica.tsx — ejemplos de cliente, y fuera la sección de prosa',
      'AGENTS.md — la regla del contenedor y las tres cajas · docs/hallazgos-ui.md · docs/hallazgos-infra.md',
    ],
  },
  {
    fecha: '9 ago', hora: '18:20', chat: CH3, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'No lo aplicaste al resto',
    pedido: 'No lo aplicaste al resto de cosas...\n\n1. Está pasando algo\n2. Te estás enterando\n3. Pegado al dato\n4. En una fila\n\nRevisa bien como hacer bien esos diseños, ya tienes toda la data, pero si necesitas investigar como lo hacen otras apps, hazlo.',
    puntos: [
      'Tenía razón y el diagnóstico salió más profundo que el pedido: **no era que faltara aplicarles el mismo estilo, era que no tenían por qué existir por separado**.',
    ],
  },
  {
    fecha: '9 ago', hora: '19:15', chat: CH3, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Cinco «piezas» eran una pieza con cuatro juegos de números',
    puntos: [
      'Convivían cinco tratamientos: fila (decisión), línea con barra suelta (curso), tarjeta con caja (aviso), caja crema (inline) y pastilla (chip). Los cuatro primeros **ya tenían la misma anatomía** —marca de 16 px, columna de texto que se estira, riel derecho— y diferían sólo en el relleno, el separador y qué iba en el riel. Cada uno se escribió en una sesión distinta resolviendo su caso, y ninguno miró al de al lado.',
      'Queda **`.mk-fila`** (con el modal como su segunda capa, no como un tratamiento aparte) y **`.mk-pill`**. Lo único que cambia entre los tres usos de la fila: decisión → riel con el cuándo, abre · en curso → riel con el porcentaje, no abre · aviso → riel con importancia y cuándo, abre.',
      '⚠️ **Yo mismo había creado la duplicación de la píldora**: al rediseñar las decisiones hice `.mk-dec__pill` y dejé `.mk-mako--chip` viva. El criterio para saber si hacen falta dos lo publica Primer y son dos ejes —¿es clickeable? ¿el vocabulario es cerrado o lo escribe el usuario?—: los nueve estados caen los dos en la misma celda. Polaris tiene UN Badge y resuelve suave-vs-fuerte con un `tone`; Material 3 tiene cuatro chips con nombres distintos y **la caja es idéntica en los cuatro**.',
      '⚠️ **Y había cajas adentro de cajas**: los avisos eran cuatro tarjetas con caja dentro de una `Section card`. Es el «nested cards are always wrong» que ya había citado para sacarle la caja a las decisiones y que no apliqué abajo.',
      '**La barra de progreso suelta no la usa nadie.** Medido sobre el DOM real: GitHub Actions no dibuja ninguna —anillo girando y el estado ocupando el MISMO slot que la duración—; Uppy la pone absoluta, 2 px, pegada al borde de la fila y a ancho completo, y lo único que cambia es su `width`; Geist lo dice textual: «the bar alone doesn\'t say what\'s progressing». Ahora es el borde de la fila, el porcentaje va al riel y la fuente y el avance a la segunda línea.',
      '**La sugerencia pegada al dato pierde la caja.** Ninguno de los que lo hacen bien la envuelve: Copilot no le pone ni fondo ni borde y la distingue sólo con opacidad, Attio tiñe la CELDA, Grammarly subraya el texto y se lleva la tarjeta afuera. Queda un filete dorado al costado. Y **una sola acción visible**: «Asignar a Carolina» al lado de un valor que ya decía «Carolina» repetía el dato adentro del botón.',
      'El rótulo es ahora **siempre** la píldora al final del título. Antes el aviso lo pintaba como kicker arriba, el curso en gris antes del título y la decisión como píldora: tres tratamientos para el mismo dato. Los títulos de `curso` pasaron a frases completas, porque ya no los arranca el rótulo.',
      'Verificado sobre el build de producción con la cookie firmada: hidrata, **0 px muertos en las CINCO secciones**, y los 7 modales abren con 600 px de ancho y 550 útiles, con su píldora y sus botones, y cierran con Escape.',
    ],
    archivos: [
      'app/_ui/ui.css — `.mk-fila*`, `.mk-pill*`, `.mk-inline*`; mueren `.mk-dec*`, `.mk-mako--chip/--curso/--inline`, `.mk-mako__cab/__rot/__datos/__ev/__evc`',
      'app/_ui/Mako.tsx — `Fila` y `Pill` reemplazan a `Decision` y a las tres ramas; `titulo` pasa a obligatorio en los NUEVE',
      'app/admin/ui/Gramatica.tsx — títulos de curso como frase completa, `cuando` en los cuatro avisos, una sola acción en el inline, y las tres secciones sin `gap`',
      'AGENTS.md — «todo lo que MaKo pone en una lista es .mk-fila» y la regla de la barra · docs/hallazgos-ui.md — dos entradas',
    ],
  },
];

/** Las nueve partes del rediseño y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'Los cimientos', detalle: 'Un solo dorado · biblioteca de primitives · los 8 estados · bases mobile', estado: 'hecha' },
  { titulo: 'App Shell', detalle: 'Navegación por intención · PageHeader · Section', estado: 'hecha' },
  // Construida y visible en /admin/ui?tab=mako; sigue abierta porque «lista»,
  // según la propia tarea, es que el estado se vea igual en las cuatro tabs.
  { titulo: 'Gramática de MaKo', detalle: 'Los 9 estados y el Semáforo unificado viven en lib/mako-gramatica.ts, con su pieza y su catálogo. El barrido de 42 lugares mostró que aplicarlos NO es trabajo de vista: en los 8 «recomienda» faltan 4 de los 5 campos, ningún «analizando» tiene progreso real y ningún «ejecuta» persiste. Primero hay que producir el dato — ver docs/hallazgos-ia.md', estado: 'sigue' },
  { titulo: 'Second Brain', detalle: 'Selector de contexto · ciclo de aprendizaje', estado: 'cola' },
  { titulo: 'La pantalla «General»', detalle: 'La prioridad de la semana con sus seis campos', estado: 'cola' },
  { titulo: 'Plantilla Analyst', detalle: 'Se diseña una vez, se aplica en Closing y en Ads', estado: 'cola' },
  { titulo: 'Dashboard y Plan', detalle: 'Jerarquía · resultado esperado · un plan por rol', estado: 'cola' },
  { titulo: 'Ads Manager', detalle: 'DataTable y administrador de columnas', estado: 'cola' },
  { titulo: 'Chats, Onboarding y Configuración', detalle: 'Lo que queda', estado: 'cola' },
];
