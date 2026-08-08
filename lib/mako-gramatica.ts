// =============================================================================
// La gramática de MaKo — los nueve estados de la inteligencia, en un solo lugar
// =============================================================================
// Parte 3 del rediseño (tarea #520). El diagnóstico del documento: «La
// inteligencia de MaKo aparece fragmentada. Retro, Second Brain, Perro Guardián,
// Semáforo, Chat Agent, Pregúntale a MaKo y recomendaciones analíticas no
// comparten todavía una gramática única».
//
// Medido sobre el repo antes de escribir esto: 35 archivos resuelven por su
// cuenta el «MaKo está analizando…», cada uno con su texto y su animación. Y el
// Semáforo eran DOS tipos incompatibles (ver abajo).
//
// La tarea está lista cuando **el mismo estado se ve y se llama igual en el
// Plan, en el Dashboard, en el CRM y en el chat**. Por eso el rótulo vive acá y
// no en cada pantalla: si cada una escribe su propio string, en dos semanas
// «Analizando…», «Pensando…» y «MaKo está trabajando» son el mismo estado con
// tres nombres, y el usuario no tiene forma de saber que son lo mismo.
//
// ISOMÓRFICO a propósito: sin `server-only` y sin nada de React. Lo importan los
// client components (la primitive app/_ui/Mako.tsx), los route handlers y los
// crons. Es la misma razón por la que lib/formatos-archivo.ts no lleva
// `server-only`: el día que lo lleve, la mitad de los consumidores se copia el
// dato en vez de importarlo.

import type { Tono } from '@/app/_ui/tokens';

// ── El Semáforo, que eran dos ────────────────────────────────────────────────
// ⚠️ Esto NO era un problema de diseño, era un bug latente. Había dos tipos:
//
//   lib/meta-health-ui.ts    Semaforo      = 'rojo' | 'ambar'    | 'verde' | 'gris'
//   lib/avisos-catalogo.ts   SemaforoAviso = 'rojo' | 'amarillo' | 'verde' | 'na'
//
// No coinciden en DOS de los cuatro valores. Un `switch` sobre el tipo
// equivocado compila perfecto, no rompe nada, y pinta el color de otra cosa —
// que es la peor clase de error, porque no avisa. Se unifica en la variante de
// meta-health porque es la que manda: es la que leen las campañas, la salud de
// la cuenta y los nodos del Ads Manager.

export type Semaforo = 'verde' | 'ambar' | 'rojo' | 'gris';

/**
 * Los nombres viejos que siguen vivos en los datos. `amarillo` y `na` están
 * ESCRITOS en las filas de CATALOGO_AVISOS, así que no alcanza con renombrar el
 * tipo: hay que aceptarlos al leer. Por eso esto es una función y no un cast.
 */
export function normalizarSemaforo(v: string | null | undefined): Semaforo {
  switch (v) {
    case 'verde': return 'verde';
    case 'rojo': return 'rojo';
    case 'ambar':
    case 'amarillo': return 'ambar';
    default: return 'gris'; // incluye 'na', null y cualquier valor que no conozcamos
  }
}

/**
 * El puente entre el Semáforo y la regla de color. Es el punto que arregla la
 * confusión más vieja del producto: **el ámbar del semáforo es NARANJA, no el
 * dorado de marca**. Mientras «cuidado» y «MaKo» compartan tono, un usuario que
 * ve algo dorado no puede saber si eso es una advertencia o una intervención de
 * la inteligencia — que es justo lo contrario de lo que busca el rediseño.
 */
export function tonoDeSemaforo(s: Semaforo): Tono {
  return s === 'verde' ? 'good' : s === 'ambar' ? 'warn' : s === 'rojo' ? 'bad' : 'neutral';
}

/**
 * Para los mensajes de WhatsApp y email, donde no hay CSS y el color tiene que
 * viajar dentro del texto. NO usarlo en la interfaz: ahí está `<Mako>`, que
 * además pone el rótulo (un color solo deja afuera a quien no lo distingue).
 */
export const EMOJI_SEMAFORO: Record<Semaforo, string> = {
  verde: '🟢', ambar: '🟡', rojo: '🔴', gris: '⚪',
};

// ── Los nueve estados ────────────────────────────────────────────────────────

export type EstadoMako =
  | 'detecto'
  | 'analizando'
  | 'explica'
  | 'recomienda'
  | 'aprobacion'
  | 'ejecuta'
  | 'completo'
  | 'vigila'
  | 'sin_conclusion';

export type DefEstado = {
  /** Lo que LEE el usuario. Es lo que tiene que ser igual en las cuatro tabs. */
  rotulo: string;
  tono: Tono;
  /** Qué comunica, para quien elige el estado desde el código. */
  comunica: string;
  /**
   * Lo que ese estado está OBLIGADO a mostrar, textual del documento. No es
   * documentación: la primitive lo usa de checklist y el catálogo lo pinta.
   * Un «MaKo recomienda» sin impacto esperado ni esfuerzo es exactamente el
   * consejo genérico que el producto dice no dar.
   */
  exige: string[];
  /** true si la pelota queda del lado del usuario y la interfaz debe esperarlo. */
  esperaAlUsuario?: boolean;
};

/**
 * El orden NO es alfabético: es el CICLO real de la inteligencia, y leerlo de
 * arriba abajo cuenta la historia completa —detecta algo, lo analiza, lo
 * explica, propone, pide permiso, actúa, cierra y queda vigilando—. Los dos de
 * abajo son las salidas: `vigila` (quedó una guardia puesta) y `sin_conclusion`
 * (no llegó, y hay que decir por qué).
 */
export const GRAMATICA: Record<EstadoMako, DefEstado> = {
  detecto: {
    rotulo: 'MaKo detectó',
    tono: 'mako',
    comunica: 'Encontró una señal que merece atención. Todavía no dice qué hacer.',
    exige: ['un indicador discreto', 'la evidencia resumida', 'el nivel de importancia'],
  },
  analizando: {
    rotulo: 'Analizando',
    tono: 'mako',
    comunica: 'Está trabajando ahora. El usuario tiene que poder ver sobre qué.',
    // ⚠️ Textual del documento: «no usar animación decorativa indefinida». Un
    // spinner eterno no informa: a los diez segundos es indistinguible de una
    // pantalla colgada, y el usuario recarga.
    exige: ['progreso real', 'la fuente de datos que está leyendo'],
  },
  explica: {
    rotulo: 'MaKo explica',
    tono: 'mako',
    comunica: 'Traduce lo que encontró. Es el estado que construye confianza.',
    exige: ['un título directo', 'la evidencia, expandible'],
  },
  recomienda: {
    rotulo: 'MaKo recomienda',
    tono: 'mako',
    comunica: 'Propone una acción concreta. Sin los cinco campos es un consejo genérico.',
    exige: ['la acción', 'el impacto esperado', 'el esfuerzo', 'el responsable', 'con qué objetivo se relaciona'],
  },
  aprobacion: {
    rotulo: 'Necesita tu aprobación',
    tono: 'warn',
    comunica: 'Puede hacerlo, y no lo hace hasta que le digas que sí.',
    exige: ['el alcance', 'los cambios previstos'],
    esperaAlUsuario: true,
  },
  ejecuta: {
    // Dorado y no azul, aunque «está pasando algo» tiente a usar el azul de
    // acción: el azul es «VOS actuás» y acá el que actúa es MaKo. Se vio recién
    // al renderizar los nueve juntos — ocho dorados y uno azul en el medio, sin
    // que nada explicara por qué ése era distinto. La regla de la Parte 1 es
    // que ver dorado alcance para saber que intervino la inteligencia, y un
    // «MaKo está ejecutando» azul es exactamente el caso que la rompe.
    rotulo: 'MaKo está ejecutando',
    tono: 'mako',
    comunica: 'Está haciendo el cambio. Sobrevive a que cierres la pantalla.',
    // «Persistente» es la palabra del documento y es un requisito de verdad: si
    // el estado vive en un useState, recargar la página lo borra y el usuario
    // no tiene forma de saber si lo que pidió pasó o no.
    exige: ['un estado persistente', 'qué elementos toca'],
  },
  completo: {
    rotulo: 'Listo',
    tono: 'good',
    comunica: 'Terminó. Cierra el ciclo diciendo qué cambió y cuándo se revisa.',
    exige: ['el resultado', 'los cambios', 'el próximo control'],
  },
  vigila: {
    rotulo: 'MaKo vigila',
    tono: 'mako',
    comunica: 'Quedó una guardia puesta. Es el estado del Perro Guardián.',
    exige: ['la condición', 'la frecuencia', 'la última revisión', 'el criterio de alerta'],
  },
  sin_conclusion: {
    rotulo: 'No alcanza para concluir',
    tono: 'neutral',
    comunica: 'Le falta información. NO es un error: es un pedido de datos.',
    // La diferencia con ErrorState importa. Un error se reintenta; esto no se
    // arregla reintentando, se arregla conectando algo o cargando un dato.
    exige: ['qué fuente falta', 'cómo resolverlo'],
    esperaAlUsuario: true,
  },
};

/** El ciclo, en orden. Lo usa el catálogo de /admin/ui para pintarlos todos. */
export const ESTADOS: EstadoMako[] = [
  'detecto', 'analizando', 'explica', 'recomienda',
  'aprobacion', 'ejecuta', 'completo', 'vigila', 'sin_conclusion',
];

// ── Las traducciones que el documento pide fijar ─────────────────────────────
// «Los conceptos diferenciales requieren traducción»: un nombre propio no
// explica nada solo. Estas dos frases son textuales del documento y van SIEMPRE
// que aparezca el nombre por primera vez en una pantalla.

export const DESCRIPCIONES = {
  'second-brain': {
    nombre: 'Second Brain',
    que_hace: 'Analiza todo tu negocio, conecta las señales y encuentra qué mover.',
  },
  'perro-guardian': {
    nombre: 'Perro Guardián',
    que_hace: 'Vigila riesgos, compromisos y resultados para que nada importante se pierda.',
  },
} as const;
