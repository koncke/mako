// =============================================================================
// fase-diagnostico — en qué FASE está el negocio, y cuál es su cuello de botella
// =============================================================================
// Adaptación del "Análisis de Negocio" de Andrea Estratega (Fórmula 100k) al
// caso de MaKo. La idea central, textual del original:
//
//   "Esto es lo que le da el NORTE a todo el sistema. Ese Norte se presetea,
//    porque TODOS los emprendedores comparten los MISMOS problemas según en qué
//    situación estén."
//
// O sea: 6 preguntas rápidas sobre la situación real del negocio → una FASE
// (0-4) + su CUELLO DE BOTELLA + qué priorizar. De ahí sale el objetivo del
// cliente, y más adelante alimenta al Perro Guardián y a la Retro.
//
// ADAPTACIÓN CLAVE: Andrea es orgánico por Instagram; MaKo es VSL Funnel con
// pauta. Así que "seguidores" → LEADS/MES, "sistema de captación" → el FUNNEL
// (VSL/landing/nutrición), y las dimensiones se hablan en términos de embudo.
// Se descartó lo específico de IG orgánico (mezcla de contenido Viral/Autoridad/
// Ventas, el examen), que no aplica a un negocio de ads + VSL.
//
// DATOS PUROS a propósito (sin 'server-only'): lo consume el wizard en el browser
// y la persistencia en el server. La lógica de diagnóstico está testeada abajo.
// =============================================================================

export type CuelloId = 'visibilidad' | 'conversion' | 'sistemas' | 'delegacion' | 'foco';

export type FaseDef = {
  /** 0..4 */
  id: number;
  nombre: string;
  emoji: string;
  /** La dimensión donde se rompe la cadena en esta fase. */
  cuello: CuelloId;
  cuelloLabel: string;
  /** Rango que caracteriza la fase (para mostrar en el diagnóstico). */
  rango: string;
  /** La frase-objetivo de la fase: es el "Norte" que se presetea. */
  objetivo: string;
  /** Cómo se siente estar acá (para que el cliente se reconozca). */
  sintomas: string[];
  /** Las jugadas de esta fase, en orden. Las 1-2 primeras son CRÍTICAS. */
  acciones: string[];
  /** Cuántas de `acciones` son críticas (van marcadas). */
  criticas: number;
  /** Qué NO hacer todavía (el error caro de saltarse la fase). */
  noHacer: string;
  /** La condición para pasar a la fase siguiente. */
  metaAvanzar: string;
  color: string;
};

// Las 5 fases, adaptadas a un negocio que vende con VSL Funnel + pauta.
export const FASES: FaseDef[] = [
  {
    id: 0, nombre: 'Nacimiento', emoji: '🐣', cuello: 'visibilidad', cuelloLabel: 'Visibilidad',
    rango: '$0 – $1.000/mes · casi sin leads',
    objetivo: 'Validar la oferta y el nicho, y armar el primer VSL que convierta a desconocidos.',
    sintomas: [
      'Todavía no vendés, o las ventas son muy esporádicas',
      'No tenés un VSL o una oferta clara y probada',
      'Casi no entra tráfico: nadie ve tu oferta',
      'Cero pauta, o pauta sin un embudo detrás',
    ],
    acciones: [
      'Definir UN nicho específico y UNA oferta clara con la que ya tengas experiencia',
      'Armar un VSL corto (5-7 min) que explique el problema, la promesa y el próximo paso',
      'Poner una landing con un solo llamado a la acción (agendar o dejar el dato)',
      'Probar pauta con $5-10/día solo para validar qué mensaje engancha',
    ],
    criticas: 2,
    noHacer: 'No armes equipo, ni escalado, ni high-ticket todavía. Primero un embudo mínimo que convierta a UN desconocido.',
    metaAvanzar: 'Un VSL en vivo, una oferta validada con las primeras ventas, y leads entrando de forma constante.',
    color: '#7C5CFB',
  },
  {
    id: 1, nombre: 'Crecimiento', emoji: '🌱', cuello: 'conversion', cuelloLabel: 'Conversión',
    rango: '$1.000 – $5.000/mes · leads que entran pero no cierran',
    objetivo: 'Que el funnel convierta: encontrar exactamente dónde se rompe la cadena entre el lead y la venta.',
    sintomas: [
      'Entran leads, pero pocos agendan o compran',
      'Vendés solo cuando escribís o perseguís vos al lead',
      'El VSL o la landing no terminan de convertir',
      'No sabés en qué punto exacto se cae el lead',
    ],
    acciones: [
      'Medir el funnel tramo por tramo (impresión → clic → VSL → agenda → cierre) para ver dónde se rompe',
      'Afinar la oferta a UNA sola propuesta clara: si cambia según el cliente, no es oferta, es un favor',
      'Arreglar el tramo más flojo primero (retención del VSL, CTA de la landing, o el show de la R1)',
      'Documentar las objeciones que matan el cierre y su respuesta estándar',
    ],
    criticas: 2,
    noHacer: 'No escales el gasto ni sumes equipo todavía: escalar un funnel que no convierte es tirar plata.',
    metaAvanzar: 'Una tasa de cierre estable y un costo por venta que cierra: el funnel convierte sin que persigas a nadie.',
    color: '#1E9E57',
  },
  {
    id: 2, nombre: 'Monetización', emoji: '💰', cuello: 'sistemas', cuelloLabel: 'Sistemas',
    rango: '$5.000 – $15.000/mes · vendés, pero solo cuando empujás',
    objetivo: 'Crear un sistema evergreen que venda sin depender 100% de vos: nutrición y follow-up que corren solos.',
    sintomas: [
      'Vendés bien cuando hacés una campaña, pero entre campaña y campaña se apaga',
      'No hay nutrición ni follow-up automático: el lead que no compra hoy se pierde',
      'El seguimiento vive en tu cabeza o en mensajes sueltos',
      'La pauta corre, pero el sistema atrás depende de que estés vos',
    ],
    acciones: [
      'Prender la nutrición multicanal: el lead que no agenda entra a una secuencia que lo trabaja solo',
      'Armar los recordatorios de reunión y el follow-up post-llamada (el no-show es el asesino #1)',
      'Documentar el guion de setter y closer para que la venta no dependa de tu día',
      'Dejar el funnel corriendo en evergreen, no solo en lanzamientos',
    ],
    criticas: 2,
    noHacer: 'No metas más tráfico a un sistema que no retiene: primero que el follow-up y la nutrición corran solos.',
    metaAvanzar: 'El sistema vende de forma constante sin que empujes: nutrición, recordatorios y follow-up corriendo solos.',
    color: '#C8870C',
  },
  {
    id: 3, nombre: 'Escalamiento', emoji: '🚀', cuello: 'delegacion', cuelloLabel: 'Delegación',
    rango: '$15.000 – $50.000/mes · todo depende de vos',
    objetivo: 'Escalar el gasto y el equipo sin que se rompa: que la máquina siga girando sin que la empujes vos.',
    sintomas: [
      'Vendés consistente, pero no tenés tiempo: todo pasa por vos',
      'Cada vez que subís el presupuesto, algo se rompe o el costo se dispara',
      'El equipo existe pero todo depende del fundador',
      'No hay quién cierre ni quién opere la pauta sin tu supervisión',
    ],
    acciones: [
      'Subir el presupuesto de forma controlada sobre el anuncio ganador, cuidando el costo por venta',
      'Sumar y entrenar setter/closer con el guion documentado para dejar de cerrar vos',
      'Delegar la operación de la pauta con reglas claras de cuándo escalar y cuándo apagar',
      'Poner métricas y un tablero para decidir con datos, no con sensaciones',
    ],
    criticas: 2,
    noHacer: 'No sumes productos nuevos ni frentes nuevos: escalá lo que ya funciona antes de dispersarte.',
    metaAvanzar: 'La mitad de la operación delegada, el gasto escalando sin romper el costo por venta, y vos fuera del cierre.',
    color: '#2F6FED',
  },
  {
    id: 4, nombre: 'Priorización', emoji: '👑', cuello: 'foco', cuelloLabel: 'Foco',
    rango: '$50.000+/mes · disperso en demasiados frentes',
    objetivo: 'Simplificar, filtrar y escalar solo lo más rentable: menos frentes, más margen, más retención.',
    sintomas: [
      'Facturás alto pero disperso: muchos productos, algunos dan trabajo y poca plata',
      'Llegan leads de menor nivel adquisitivo que antes',
      'Equipo grande pero todavía depende demasiado del fundador',
      'Sin sistema sólido de retención, referidos o LTV',
    ],
    acciones: [
      'Auditar y apagar los productos y campañas que no son rentables o traen clientes de bajo ticket',
      'Limpiar el mensaje para atraer exclusivamente al cliente premium',
      'Montar retención y referidos para escalar el LTV de la cartera que ya tenés',
      'Delegar el 50% de la operación con procesos documentados',
    ],
    criticas: 1,
    noHacer: 'No abras frentes nuevos por aburrimiento: el crecimiento acá es por foco, no por sumar.',
    metaAvanzar: 'Facturación alta sin ventas manuales, media operación delegada y métricas claras para decidir.',
    color: '#D6489B',
  },
];

export const faseDef = (id: number): FaseDef => FASES[Math.max(0, Math.min(4, id))];

// ── Las 6 preguntas (adaptadas a VSL Funnel) ────────────────────────────────
// Cada opción, por orden, "vota" a una fase (índice 0-4). El diagnóstico combina
// los 6 votos (ver diagnosticar()).
export type Pregunta = { id: string; emoji: string; texto: string; opciones: string[] };

export const PREGUNTAS: Pregunta[] = [
  {
    id: 'ingresos', emoji: '💵', texto: '¿Cuánto factura tu negocio por mes?',
    opciones: ['$0 – $1.000 o todavía nada', '$1.000 – $5.000', '$5.000 – $15.000', '$15.000 – $50.000', 'Más de $50.000'],
  },
  {
    id: 'leads', emoji: '🧲', texto: '¿Cuántos leads nuevos generás por mes?',
    opciones: ['Casi ninguno todavía', 'Menos de 50', '50 – 200', '200 – 800', 'Más de 800'],
  },
  {
    id: 'funnel', emoji: '🎬', texto: '¿Cómo está tu funnel de captación?',
    opciones: [
      'No tengo VSL ni landing armada',
      'Tengo landing, pero sin VSL o sin agenda clara',
      'VSL + landing que agenda, pero sin nutrición atrás',
      'Funnel completo: VSL + agenda + nutrición + follow-up',
      'Funnel + pauta sistematizada + remarketing',
    ],
  },
  {
    id: 'ventas', emoji: '🤝', texto: '¿Cómo se generan tus ventas hoy?',
    opciones: [
      'No vendo aún, o ventas muy esporádicas',
      'Solo cuando escribo o persigo yo al lead',
      'Cuando hago campañas o lanzamientos puntuales',
      'Mix evergreen + campañas, pero cierro yo (o mi closer con mi supervisión)',
      'Sistema con setter/closer, ya no cierro yo',
    ],
  },
  {
    id: 'cuello', emoji: '🧠', texto: '¿Cuál es tu MAYOR cuello de botella hoy?',
    opciones: [
      'No llega tráfico / nadie ve mi oferta',
      'Entran leads pero no agendan ni compran',
      'Solo vendo cuando empujo, no hay flujo constante',
      'No tengo tiempo, todo depende de mí',
      'Demasiados productos / dispersión / mensaje diluido',
    ],
  },
  {
    id: 'equipo', emoji: '🛠️', texto: '¿Cómo opera tu negocio en equipo y sistemas?',
    opciones: [
      'Yo solo/a, sin sistemas ni equipo',
      'Yo solo/a, con algunas plantillas y procesos básicos',
      'Yo + 1 freelance ocasional (editor, setter o asistente)',
      'Equipo de 3-6 personas, pero todo depende del fundador',
      'Equipo de 7+, procesos documentados, opero por delegación',
    ],
  },
];

// ── El diagnóstico ──────────────────────────────────────────────────────────
export type Diagnostico = {
  fase: number;
  cuello: CuelloId;
  /** % de las respuestas que caen en la fase diagnosticada (qué tan parejo es). */
  consistencia: number;
  /** true si las respuestas están repartidas entre fases (avanzó en una dimensión y se atrasó en otra). */
  mixto: boolean;
  /** Reparto de votos por fase, para el texto del diagnóstico mixto ("F0:1 · F1:2 …"). */
  reparto: number[];
  /** Las respuestas crudas (índice de opción por pregunta). */
  respuestas: number[];
};

/**
 * De las 6 respuestas al diagnóstico. La fase es la MEDIANA de los votos (no la
 * moda): cuando el negocio está repartido, se queda en la fase MÁS BAJA con peso
 * — "trabaja primero el cuello de tu fase más baja antes de saltar adelante".
 * Con [0,1,1,2,2,2] la mediana cae en 1 → Fase 1, y la consistencia = 2/6 = 33%,
 * igual que el original.
 */
export function diagnosticar(respuestas: number[]): Diagnostico {
  const votos = respuestas.map((r) => Math.max(0, Math.min(4, r | 0)));
  const orden = [...votos].sort((a, b) => a - b);
  // Mediana con sesgo hacia abajo (índice 2 de 6 = el más bajo del par central).
  const fase = orden[Math.floor((orden.length - 1) / 2)];
  const reparto = [0, 0, 0, 0, 0];
  for (const v of votos) reparto[v]++;
  const consistencia = Math.round((reparto[fase] / votos.length) * 100);
  return {
    fase,
    cuello: faseDef(fase).cuello,
    consistencia,
    mixto: consistencia < 60,
    reparto,
    respuestas: votos,
  };
}

/** El reparto como texto: "F0:1 · F1:2 · F2:3". Solo las fases con votos. */
export function repartoTexto(reparto: number[]): string {
  return reparto.map((n, i) => (n > 0 ? `F${i}:${n}` : null)).filter(Boolean).join(' · ');
}

/**
 * El "Norte" preseteado, en una línea: lo que este cliente tiene que priorizar.
 * Es lo que después alimenta al Perro Guardián y a la Retro.
 */
export function norteDeFase(fase: number): string {
  const f = faseDef(fase);
  return `Fase ${f.id} (${f.nombre}) · Cuello: ${f.cuelloLabel}. ${f.objetivo}`;
}

/** Texto para inyectar en el contexto de MaKo (sabe en qué fase está el cliente). */
export function faseContextoTexto(d: Diagnostico | null): string {
  if (!d) return '';
  const f = faseDef(d.fase);
  const lineas = [
    `FASE DEL NEGOCIO: ${f.id} — ${f.nombre} (${f.rango}).`,
    `Cuello de botella principal: ${f.cuelloLabel}.`,
    `Objetivo/Norte de esta fase: ${f.objetivo}`,
    `Prioridades: ${f.acciones.slice(0, f.criticas).join(' · ')}.`,
    `NO conviene todavía: ${f.noHacer}`,
  ];
  if (d.mixto) lineas.push(`Diagnóstico mixto (${repartoTexto(d.reparto)}): trabajar primero el cuello de la fase más baja.`);
  return lineas.join('\n');
}
