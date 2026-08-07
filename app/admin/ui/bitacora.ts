// =============================================================================
// Change History — qué se cambió del rediseño, en orden, y por qué
// =============================================================================
// Se agrega UNA entrada por tanda de trabajo, al FINAL del array: la línea de
// tiempo va hacia abajo.
//
// Qué va y qué no, que es lo mismo que pide AGENTS.md para los hallazgos: el
// motivo y la trampa, no el changelog. «Se agregó el componente X» ya está en el
// commit. Lo que no está en ningún lado es POR QUÉ, y sobre todo **cuándo el
// diagnóstico obvio era el equivocado** — eso es lo que ahorra tiempo después.
//
// Los errores se cuentan. Son los que explican las decisiones raras: sin ellos,
// media página parece capricho.
//
// LA HORA sale del commit, no del recuerdo: `git log --date=format:'%d %b %H:%M'`.
// EL CHAT es el título de la sesión de Claude Code. LA CUENTA es cuál de las dos
// del repo lo hizo (ver docs/dos-cuentas.md): sin eso, con dos sesiones en
// paralelo no hay forma de saber a cuál preguntarle por una decisión.

/** Las dos cuentas que trabajan este repo. El detalle, en docs/dos-cuentas.md. */
export const CUENTAS = {
  claude1: { nombre: 'Mauricio', ventana: 'miércoles a viernes', config: '~\\.claude' },
  claude2: { nombre: 'Martín', ventana: 'sábado a martes', config: '~\\.claude-martin' },
} as const;

export type Cuenta = keyof typeof CUENTAS;

export type Hito = {
  /** Día, como se lee. */
  fecha: string;
  /** Hora del commit, 24 h. */
  hora: string;
  /** Título de la sesión de Claude Code donde se hizo. */
  chat: string;
  cuenta: Cuenta;
  titulo: string;
  puntos: string[];
};

// El título real de la sesión, no uno inventado. Sale del JSON de Claude Desktop:
// %APPDATA%\Claude\claude-code-sessions\<cuenta>\<org>\<sesión>.json → campo `title`.
const REDISENO = 'Rediseño por partes';

export const BITACORA: Hito[] = [
  {
    fecha: '6 ago', hora: '12:54', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Parte 1 · Los cimientos',
    puntos: [
      'Un solo dorado: había **cuatro** para la misma marca. Ahora es `#F2B01E`, el del logo.',
      'El warning dejó de ser un tercer dorado y pasó a naranja: era imposible que «cuidado» no se leyera como «MaKo».',
      'Biblioteca de primitives en `app/_ui`: botones con sus siete estados, campos, selects, badges.',
      'Los ocho estados de pantalla. Faltaban **cuatro enteros**: cero apariciones en todo el repositorio.',
      'Una sola confirmación (había dos, y ninguna mandaba) y un solo campo de texto (había tres).',
      'Mobile adentro del sistema: la tipografía y el área táctil suben solas en pantalla chica.',
    ],
  },
  {
    fecha: '6 ago', hora: '13:39', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Parte 2 · La navegación por intención',
    puntos: [
      'La barra dejó de ser el inventario de módulos y pasó a agruparse por para qué la abrís.',
      'Se fue el **flyout** que escondía WhatsApp y Chat Agent detrás de un hover.',
      'PageHeader con una línea de propósito: qué pregunta responde cada pantalla.',
      'Corrección sobre la Parte 1: la escala tipográfica del documento son **siete** niveles con base 14, no cuatro con base 15.',
    ],
  },
  {
    fecha: '6 ago', hora: '14:06', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Las correcciones de la barra',
    puntos: [
      'Se fue **Focus** (una familia entera para una sola pantalla) y «General» pasó a ser lo primero de Operate.',
      'Se fueron **MaKo Doer** (era el mismo chat que /mako) y **DM Writer** (lo hace el Chatbot).',
      'El saldo de IA se mudó al desplegable del perfil: visible, nunca protagonista.',
      'El logo dejó de tener «Marketing OS» debajo y pasó a ser un link a General.',
    ],
  },
  {
    fecha: '6 ago', hora: '18:33', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Tres bugs con la misma raíz',
    puntos: [
      'La sección se cerraba sola: la familia desplegada se recalculaba en cada render y se reseteaba al salir el cursor. Ahora es estado y tu elección se queda.',
      'El desplegable salía corrido: se posicionaba midiendo la barra **mientras** el ancho iba de 68 a 244 px. Ahora se calcula del ancho final.',
      '«Pasan cosas raras»: `Familia` y `GrupoFila` estaban declaradas dentro del render, así que React desmontaba la navegación entera en cada cambio de estado.',
    ],
  },
  {
    fecha: '7 ago', hora: '02:31', chat: REDISENO, cuenta: 'claude1',
    titulo: 'El hover que nunca se veía',
    puntos: [
      'La regla `.mk-navrow:hover` estaba escrita hacía tres commits y no se aplicaba **nunca**: el componente ponía `background: transparent` en línea, y un inline le gana a cualquier regla de hoja.',
      'Las secciones sí reaccionaban por casualidad — su hover cambia `opacity` con `!important`.',
      'Ahora el color, el fondo y el peso viven en la clase; el estilo en línea solo lleva geometría.',
    ],
  },
  {
    fecha: '7 ago', hora: '03:32', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Content Machine y Sales Machine',
    puntos: [
      'Content Machine pasó a ser sección propia: Ideas suelto arriba y tres desplegables por canal, con la marca de cada uno.',
      'Sales Machine reemplaza a Create, en tres bloques que son las tres etapas del embudo: capturar, conversar, cerrar.',
      'Trece rutas nuevas, todas con el nombre igual al path, todas con el chip «pronto»: no hay backend y prometer un canal que no existe es peor que no tenerlo.',
    ],
  },
  {
    fecha: '7 ago', hora: '04:08', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Los íconos, y la trampa del blanco',
    puntos: [
      'Diecisiete íconos nuevos, convertidos de archivos de 1500×1500 al set de 24.',
      'Cada uno se escala y se centra por su **caja de tinta**: si no, dos dibujos con el mismo lienzo pero distinto margen se ven de tamaños distintos en la misma columna.',
      'En estos exports el blanco **no es fondo, es el hueco**. Repintado con `currentColor` convertía el círculo en una mancha maciza.',
      'Me equivoqué dos veces razonándolo, así que el conversor se verifica preguntándole al navegador con `isPointInFill`, que es quien resuelve el fill-rule de verdad.',
    ],
  },
  {
    fecha: '7 ago', hora: '12:16', chat: REDISENO, cuenta: 'claude1',
    titulo: 'El registro se muda a la app',
    puntos: [
      'Dejó de ser un HTML publicado afuera. La barra y los íconos **no están escritos**: salen de `nav.ts` e `icons.tsx` en cada carga.',
      'Una página así, escrita a mano, envejece en silencio — se renombra una tab, nadie toca el HTML, y sigue mostrando la barra de anteayer con cara de estar al día.',
      'Lo único escrito a mano es este historial, en `app/admin/ui/bitacora.ts`.',
    ],
  },
  {
    fecha: '7 ago', hora: '12:36', chat: REDISENO, cuenta: 'claude1',
    titulo: 'El ancho, de una vez',
    puntos: [
      'La pantalla no llegaba al borde. No había ninguna regla escondida: **cada pantalla escribe su propio `<main>`** y ahí cada una eligió su `maxWidth` — 16 pantallas con el mismo padding y 7 variantes sueltas más.',
      'Ahora el `<main>` lo pone el primitive `Pagina` y el tope es un token (`--pagina-max`), no un número por pantalla.',
    ],
  },
  {
    fecha: '7 ago', hora: '15:20', chat: REDISENO, cuenta: 'claude1',
    titulo: 'La barra de esta página ES la barra',
    puntos: [
      'La sección mostraba una **imitación** de la barra, dibujada a mano acá adentro. No se parecía, y no había forma de que se pareciera: eran dos códigos distintos.',
      'Ahora `BarraPreview` usa los mismos componentes que la barra de verdad —`Marca`, `Familia`, `NavLink`, `Identidad`, `panelStyle`—, extraídos de `Sidebar.tsx` y compartidos por las dos.',
      'No se puede montar el `Sidebar` entero: no recibe props, y con el navegador parado en `/admin/ui` el `usePathname()` marcaría la fila equivocada. Peor: como esta cuenta es super-admin, `adminShell` pintaría el menú de administración en vez de las cuatro familias.',
      'Corolario para todo el catálogo: acá no se **dibuja** una pieza, se **monta**. Un catálogo que muestra el dibujo de un botón no sirve para revisar el botón.',
      'Y se llama «Sidebar», que es como se llama en la app. Se llamaba «La barra».',
    ],
  },
  {
    fecha: '7 ago', hora: '15:20', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Íconos y Marca, que faltaban',
    puntos: [
      'El set entero, agrupado como en la barra, con el nombre de cada uno. La lista sale de `NOMBRES_ICONO` (`icons.tsx`): escrita a mano acá, el día que se agregue un ícono el catálogo diría que no existe.',
      '**Marca** junta por primera vez lo que estaba en cinco lugares que no se hablan: el dorado (`globals.css`), el logo (`MakoBrand.tsx`), la voz de la IA (`mako-persona.ts`), las reglas de copy (`docs/mapa-del-proyecto.md`) y el material descargable (Conocimientos).',
      'El diagnóstico obvio era el equivocado: «Branding MaKo» dentro de Conocimientos **no es un manual de marca**, es una galería de archivos para descargar. No tiene una línea sobre color, tipografía ni voz.',
      'Buscándolo aparecieron cinco cosas que no cierran —dos dorados viejos vivos en `mako-grupo.ts`, seis neutros cálidos sin token, una serif de marca sin regla—. Están listadas al final de la tab en vez de arregladas: son de otro tamaño.',
    ],
  },
  {
    fecha: '7 ago', hora: '15:20', chat: REDISENO, cuenta: 'claude1',
    titulo: 'Dos reglas de layout',
    puntos: [
      'Una **barra de navegación no lleva scroll horizontal**. Va en contra del §19.2 del documento («las tabs deben soportar scroll horizontal en mobile») y gana la regla de la casa: esconder destinos detrás de un gesto lateral es esconderlos. Si no entran, bajan de renglón.',
      'El caso que lo probó no era este: las tabs de la **ficha del lead** scrolleaban de costado *y* tenían la barra de scroll oculta por CSS, así que las últimas no daban ni una pista de existir. Arreglado ahí también.',
      'El scroll lateral sigue bien donde lo que se corre es **contenido** —una tabla, una fila de filtros—, no el mapa de a dónde se puede ir.',
      'Y el ancho: si el contenido no llega al tope, va **centrado**. Un `maxWidth` pegado a la izquierda deja una franja muerta a la derecha que nadie puso a propósito.',
    ],
  },
  {
    fecha: '7 ago', hora: '15:20', chat: REDISENO, cuenta: 'claude1',
    titulo: 'La poda',
    puntos: [
      'Se fue la bajada del encabezado y siete notas de sección. La regla de la casa es **título limpio**: la única bajada admitida es la línea de propósito, y si se deduce del título va vacía.',
      'Lo que más sobraba era repetido: «esto sale del código, no está escrito a mano» estaba dicho **cinco veces** en la misma pantalla, y el párrafo de cierre del historial repetía palabra por palabra dos de sus propias entradas.',
      'Se queda lo que trae un dato que no está en otro lado. «Si el mismo color dice cinco cosas, no dice ninguna» era lindo y no decía nada: afuera.',
    ],
  },
];

/** Las nueve partes del rediseño y en qué anda cada una. */
export type Parte = { titulo: string; detalle: string; estado: 'hecha' | 'sigue' | 'cola' };

export const PARTES: Parte[] = [
  { titulo: 'Los cimientos', detalle: 'Un solo dorado · biblioteca de primitives · los 8 estados · bases mobile', estado: 'hecha' },
  { titulo: 'App Shell', detalle: 'Navegación por intención · PageHeader · Section', estado: 'hecha' },
  { titulo: 'Gramática de MaKo', detalle: 'Los 9 estados de la IA · unificar el Semáforo', estado: 'sigue' },
  { titulo: 'Second Brain', detalle: 'Selector de contexto · ciclo de aprendizaje', estado: 'cola' },
  { titulo: 'La pantalla «General»', detalle: 'La prioridad de la semana con sus seis campos', estado: 'cola' },
  { titulo: 'Plantilla Analyst', detalle: 'Se diseña una vez, se aplica en Closing y en Ads', estado: 'cola' },
  { titulo: 'Dashboard y Plan', detalle: 'Jerarquía · resultado esperado · un plan por rol', estado: 'cola' },
  { titulo: 'Ads Manager', detalle: 'DataTable y administrador de columnas', estado: 'cola' },
  { titulo: 'Chats, Onboarding y Configuración', detalle: 'Lo que queda', estado: 'cola' },
];
