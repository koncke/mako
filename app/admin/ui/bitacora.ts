// =============================================================================
// La bitácora del rediseño — qué se cambió, en orden, y por qué
// =============================================================================
// Se agrega UNA entrada por tanda de trabajo, arriba de todo del array no: al
// final, que es donde sigue la línea de tiempo.
//
// Qué va y qué no, que es lo mismo que pide AGENTS.md para los hallazgos: el
// motivo y la trampa, no el changelog. «Se agregó el componente X» ya está en el
// commit. Lo que no está en ningún lado es POR QUÉ, y sobre todo **cuándo el
// diagnóstico obvio era el equivocado** — eso es lo que ahorra tiempo después.
//
// Los errores se cuentan. Son los que explican las decisiones raras: sin ellos,
// media página parece capricho.

export type Hito = { fecha: string; titulo: string; puntos: string[] };

export const BITACORA: Hito[] = [
  {
    fecha: '6 ago',
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
    fecha: '6 ago',
    titulo: 'Parte 2 · La navegación por intención',
    puntos: [
      'La barra dejó de ser el inventario de módulos y pasó a agruparse por para qué la abrís.',
      'Se fue el **flyout** que escondía WhatsApp y Chat Agent detrás de un hover.',
      'PageHeader con una línea de propósito: qué pregunta responde cada pantalla.',
      'Corrección sobre la Parte 1: la escala tipográfica del documento son **siete** niveles con base 14, no cuatro con base 15.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Las correcciones de la barra',
    puntos: [
      'Se fue **Focus** (una familia entera para una sola pantalla) y «General» pasó a ser lo primero de Operate.',
      'Se fueron **MaKo Doer** (era el mismo chat que /mako) y **DM Writer** (lo hace el Chatbot).',
      'El saldo de IA se mudó al desplegable del perfil: visible, nunca protagonista.',
      'El logo dejó de tener «Marketing OS» debajo y pasó a ser un link a General.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Tres bugs con la misma raíz',
    puntos: [
      'La sección se cerraba sola: la familia desplegada se recalculaba en cada render y se reseteaba al salir el cursor. Ahora es estado y tu elección se queda.',
      'El desplegable salía corrido: se posicionaba midiendo la barra **mientras** el ancho iba de 68 a 244 px. Ahora se calcula del ancho final.',
      '«Pasan cosas raras»: `Familia` y `GrupoFila` estaban declaradas dentro del render, así que React desmontaba la navegación entera en cada cambio de estado.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'El hover que nunca se veía',
    puntos: [
      'La regla `.mk-navrow:hover` estaba escrita hacía tres commits y no se aplicaba **nunca**: el componente ponía `background: transparent` en línea, y un inline le gana a cualquier regla de hoja.',
      'Las secciones sí reaccionaban por casualidad — su hover cambia `opacity` con `!important`.',
      'Ahora el color, el fondo y el peso viven en la clase; el estilo en línea solo lleva geometría.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Content Machine y Sales Machine',
    puntos: [
      'Content Machine pasó a ser sección propia: Ideas suelto arriba y tres desplegables por canal, con la marca de cada uno.',
      'Sales Machine reemplaza a Create, en tres bloques que son las tres etapas del embudo: capturar, conversar, cerrar.',
      'Trece rutas nuevas, todas con el nombre igual al path, todas con el chip «pronto»: no hay backend y prometer un canal que no existe es peor que no tenerlo.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Los íconos, y la trampa del blanco',
    puntos: [
      'Diecisiete íconos nuevos, convertidos de archivos de 1500×1500 al set de 24.',
      'Cada uno se escala y se centra por su **caja de tinta**: si no, dos dibujos con el mismo lienzo pero distinto margen se ven de tamaños distintos en la misma columna.',
      'En estos exports el blanco **no es fondo, es el hueco**. Repintado con `currentColor` convertía el círculo en una mancha maciza.',
      'Me equivoqué dos veces razonándolo, así que el conversor se verifica preguntándole al navegador con `isPointInFill`, que es quien resuelve el fill-rule de verdad.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Esta página',
    puntos: [
      'El registro dejó de ser un HTML publicado afuera y pasó a vivir acá, adentro de **Sistema de diseño**. Las piezas y el porqué de cada una son la misma cosa mirada de dos maneras; en tabs separadas obligaban a saltar de una a otra.',
      'La barra y los íconos de «La barra» **no están escritos**: salen de `nav.ts` e `icons.tsx` en cada carga. Una página así, escrita a mano, envejece en silencio — se renombra una tab, nadie toca el HTML, y sigue mostrando la barra de anteayer con cara de estar al día.',
      'Lo único que se escribe es esta bitácora, en `app/admin/ui/bitacora.ts`.',
      'La sub-tab activa viaja en la URL (`?tab=barra`) para poder mandar el link a una sección en vez de decir «y bajá hasta…».',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'El ancho, de una vez',
    puntos: [
      'La pantalla no llegaba al borde. No había ninguna regla escondida: **cada pantalla escribe su propio `<main>`** y ahí cada una eligió su `maxWidth` — 16 pantallas con el mismo padding y 7 variantes sueltas más.',
      'Ahora el `<main>` lo pone el primitive `Pagina`, y su prop `style` está tipada `Omit<…, \'maxWidth\' | \'width\'>`: una pantalla **no puede** fijarse el ancho aunque quiera. La regla la sostiene el compilador, no la memoria de quien edita.',
      'Para el texto largo, que sí necesita tope, está `Lectura` (70ch) — el tope va en el párrafo, no en la página.',
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
