// =============================================================================
// La gramática de MaKo — los nueve estados de la inteligencia, en un solo lugar
// =============================================================================
// Parte 3 del rediseño (tarea #520). El diagnóstico del documento: «La
// inteligencia de MaKo aparece fragmentada. Retro, Second Brain, Perro Guardián,
// Semáforo, Chatbot, Pregúntale a MaKo y recomendaciones analíticas no
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

/**
 * Las TRES formas en pantalla. Los nueve estados siguen siendo nueve —definen
 * qué campos son obligatorios, que es para lo que sirven— pero **no son nueve
 * cajas distintas**.
 *
 * Nueve tratamientos visuales fue el error de la primera versión: nadie
 * distingue nueve cajas y el resultado era una bolsa de tarjetas de colores. Las
 * referencias coinciden en un vocabulario chico: Linear usa cinco tipos para sus
 * agentes (thought · action · elicitation · response · error) y Copilot tres
 * (plan · aprobar · ejecutar).
 *
 * Frente a una pantalla el usuario se hace TRES preguntas, y de ahí salen las
 * tres formas:
 *
 *   decision  ¿tengo que decidir algo?   → tarjeta con salidas explícitas
 *   curso     ¿está pasando algo?        → una línea con progreso y fuente
 *   aviso     ¿me estoy enterando?       → tarjeta tranquila, sin acciones
 */
export type FormaMako = 'decision' | 'curso' | 'aviso';

export type DefEstado = {
  /** Lo que LEE el usuario. Es lo que tiene que ser igual en las cuatro tabs. */
  rotulo: string;
  /** Cuál de las tres formas usa en pantalla. */
  forma: FormaMako;
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
  /**
   * true si NADA se mueve hasta que el usuario conteste.
   *
   * ⚠️ Antes se llamaba `esperaAlUsuario` y lo tenían DOS estados: la aprobación
   * y «falta un dato». Ahí estaba el error de raíz del diseño viejo: agrupaba por
   * «¿tiene botones?» cuando la pregunta que importa es **qué pasa si el usuario
   * no hace nada**. Y son cosas opuestas: si ignorás una aprobación, el envío
   * queda congelado y vos sos el cuello de botella; si ignorás «falta un dato»,
   * no hay nada esperando — MaKo simplemente no puede contestar esa pregunta.
   *
   * Con el nombre viejo las dos se pintaban con fondo de color «para que no se te
   * pasen», y como una de las dos era `neutral`, su fondo salía `--surface-2` —
   * la misma superficie que usa media app. Un realce invisible por construcción.
   *
   * Hoy `bloquea` gobierna tres cosas y nada más: la fila arranca abierta, su
   * botón es el único lleno, y es el único naranja de la pantalla.
   */
  bloquea?: boolean;
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
    // ⚠️ Los rótulos NO nombran a MaKo. Cinco de los nueve decían «MaKo algo»:
    // la IA hablando de sí misma en vez de decirte qué pasa. Y en el chip, «MaKo
    // detectó» es un pasado sin objeto que no informa nada. El dorado ya dice
    // que intervino la inteligencia; repetir el nombre es ruido.
    rotulo: 'Algo cambió',
    forma: 'aviso',
    tono: 'mako',
    comunica: 'Encontró una señal que merece atención. Todavía no dice qué hacer.',
    exige: ['un indicador discreto', 'la evidencia resumida', 'el nivel de importancia'],
  },
  analizando: {
    // «Analizando» a secas es lenguaje de spinner. Apple lo marca explícitamente:
    // en vez de «Processing…», nombrar la subtarea real. Por eso el rótulo viaja
    // SIEMPRE con la fuente al lado («Revisando · 14 campañas activas»).
    rotulo: 'Revisando',
    forma: 'curso',
    tono: 'mako',
    comunica: 'Está trabajando ahora. El usuario tiene que poder ver sobre qué.',
    // ⚠️ Textual del documento: «no usar animación decorativa indefinida». Un
    // spinner eterno no informa: a los diez segundos es indistinguible de una
    // pantalla colgada, y el usuario recarga.
    exige: ['progreso real', 'la fuente de datos que está leyendo'],
  },
  explica: {
    rotulo: 'Por qué pasa',
    forma: 'aviso',
    tono: 'mako',
    comunica: 'Traduce lo que encontró. Es el estado que construye confianza.',
    exige: ['un título directo', 'la evidencia, expandible'],
  },
  recomienda: {
    // Es `decision` y no `aviso`: trae dos salidas (aceptar / descartar), igual
    // que una sugerencia de Linear.
    //
    // «Qué conviene hacer» era una frase, no un nombre, y encima duplicaba lo que
    // ya dice el título de la fila. Un rótulo tiene que poder leerse suelto en un
    // chip, en una columna de tabla y en un filtro: ahí «Sugerencia» funciona y
    // «Qué conviene hacer» pide un renglón entero.
    rotulo: 'Sugerencia',
    forma: 'decision',
    tono: 'mako',
    comunica: 'Propone una acción concreta. Sin los cinco campos es un consejo genérico.',
    exige: ['la acción', 'el impacto esperado', 'el esfuerzo', 'el responsable', 'con qué objetivo se relaciona'],
  },
  aprobacion: {
    // ⚠️ SOLO para lo IRREVERSIBLE. Lo que se puede desandar —pausar, renombrar,
    // mover presupuesto— se hace y se ofrece `completo` con Deshacer. La razón no
    // es comodidad: un diálogo de confirmación pierde poder con el uso («if you
    // warn people too much, they stop paying attention», NN/g), así que gastarlo
    // en lo reversible deja sin efecto el día que MaKo quiera borrar algo.
    rotulo: 'Aprobación pendiente',
    forma: 'decision',
    tono: 'warn',
    comunica: 'Solo para lo que no se puede deshacer. Nada se mueve hasta tu sí.',
    // ⚠️ «los cambios previstos» significa lo que va a pasar DE VERDAD, con el
    // texto a la vista: los mensajes que se van a mandar, los nombres de la
    // lista. No un resumen de cuántos son. Microsoft lo pide textual en su guía
    // de confirmaciones —«Don't hide needed information because users might not
    // find it»— y era el defecto más grave del diseño anterior: el botón que
    // mandaba 340 mensajes estaba a la vista y QUÉ decían esos mensajes vivía
    // detrás de un click. Se podía aprobar un envío sin haberlo leído nunca.
    exige: ['el alcance', 'los cambios previstos', 'la consecuencia, pegada al botón'],
    bloquea: true,
  },
  ejecuta: {
    // Dorado y no azul, aunque «está pasando algo» tiente a usar el azul de
    // acción: el azul es «VOS actuás» y acá el que actúa es MaKo. Se vio recién
    // al renderizar los nueve juntos — ocho dorados y uno azul en el medio, sin
    // que nada explicara por qué ése era distinto.
    //
    // «Ejecutando» era jerga de sistema y encima redundante: el título ya decía
    // «Pausando los anuncios en Meta».
    rotulo: 'Aplicando el cambio',
    forma: 'curso',
    tono: 'mako',
    comunica: 'Está haciendo el cambio. Sobrevive a que cierres la pantalla.',
    // «Persistente» es la palabra del documento y es un requisito de verdad: si
    // el estado vive en un useState, recargar la página lo borra y el usuario
    // no tiene forma de saber si lo que pidió pasó o no.
    exige: ['un estado persistente', 'qué elementos toca'],
  },
  completo: {
    // «Listo» es ambiguo en español: significa «terminado» y también «preparado
    // para arrancar». En un estado final esa ambigüedad se paga. Y obligaba a
    // repetirlo en el título («Listo: 3 anuncios pausados»), que es justo donde
    // tiene que ir el RESULTADO.
    rotulo: 'Hecho',
    forma: 'aviso',
    tono: 'good',
    comunica: 'Terminó. Si la acción se puede desandar, aquí va el Deshacer.',
    exige: ['el resultado', 'los cambios', 'el próximo control'],
  },
  vigila: {
    // «MaKo vigila», sin objeto, se lee como que te vigilan a vos. Y chocaba con
    // su propio ejemplo, escrito en primera persona: dos voces en una tarjeta.
    rotulo: 'En seguimiento',
    forma: 'aviso',
    tono: 'mako',
    comunica: 'Quedó una guardia puesta. Es el estado del Perro Guardián.',
    exige: ['la condición', 'la frecuencia', 'la última revisión', 'el criterio de alerta'],
  },
  sin_conclusion: {
    // «No alcanza para concluir» es jerga de informe y suena a fracaso — que es
    // exactamente lo que este estado NO es. Nombrar la causa («falta un dato»)
    // ya insinúa la salida, que es lo que pide el capítulo de failstates de PAIR:
    // explicar el límite y dar un camino concreto, nunca un error genérico.
    rotulo: 'Falta un dato',
    forma: 'decision',
    tono: 'neutral',
    comunica: 'Le falta información. NO es un error: es un pedido de datos.',
    // La diferencia con ErrorState importa. Un error se reintenta; esto no se
    // arregla reintentando, se arregla conectando algo o cargando un dato.
    exige: ['qué fuente falta', 'cómo resolverlo'],
    // Sin `bloquea`: acá no espera nadie. Es un análisis que no llegó, no una
    // decisión pendiente. Ver el comentario de `bloquea` arriba.
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

// ── Cómo se escribe el nombre ────────────────────────────────────────────────
// **MaKo**: M mayúscula, a minúscula, K MAYÚSCULA, o minúscula. Y no se traduce,
// ni se declina, ni se le pone acento.
//
// No es una preocupación estética: el nombre entra al sistema por la puerta de
// atrás. El dueño manda un audio por WhatsApp, Whisper transcribe «Maco» —que es
// como suena—, esa cadena se convierte en el TÍTULO de una tarea («Configurar
// plantillas de funnels por tipo (TOFU) en Maco»), y desde ahí el Perro la repite
// en su razón de puntaje y en el deadline. Una marca mal escrita se propaga sola
// porque cada eslabón copia el texto del anterior.
//
// Por eso hay dos capas y las dos hacen falta: la REGLA en el prompt (para lo que
// la IA escribe de cero) y esta corrección DETERMINISTA (para lo que entra
// transcripto, donde el prompt no llega).

export const MARCA = 'MaKo';

/** La regla, para los prompts. Va dentro de MAKO_NUCLEO, que lo lee toda la IA. */
export const REGLA_MARCA = `CÓMO SE ESCRIBE LA MARCA: **MaKo** — M mayúscula, K MAYÚSCULA en el medio. Nunca "Maco", "Mako", "MAKO" ni "Macko". Si te llega escrito de otra forma (una transcripción de audio suele dejar "Maco"), corrígelo al escribirlo tú.`;

/**
 * Corrige las variantes del nombre en un texto. Palabra completa y sin importar
 * mayúsculas: `maco`, `mako`, `macko`, `makko` → `MaKo`.
 *
 * ⚠️ La lista es CERRADA y las palabras van completas, a propósito. "Marco" no
 * está —es un nombre de persona, y convertir el nombre de alguien en el de la
 * marca es peor que dejar un "Maco" suelto— y sin los límites de palabra se
 * romperían "makoto" o cualquier cosa que empiece igual.
 */
export function corregirMarca(texto: string): string {
  if (!texto) return texto;
  return texto.replace(/\b(maco|mako|macko|makko)\b/gi, MARCA);
}
