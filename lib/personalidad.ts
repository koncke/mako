// =============================================================================
// personalidad — el QUIZ de personalidad del creador (la voz de sus anuncios)
// =============================================================================
// Reemplaza el viejo form de "tono": en vez de autodescripciones vagas
// ("Directo", "Cercano"), un quiz de a UNA pregunta con FRASES CONCRETAS de
// anuncio — el dueño elige la que más suena a cómo lo diría él (patrón
// forced-choice de los quiz de personalidad/brand-voice: la gente se describe
// mal a sí misma, pero reconoce al instante su propia forma de hablar).
//
// Cada opción lleva un "rasgo" oculto (el descriptor que se inyecta al prompt
// de guiones). Las frases de acá son los DEFAULTS genéricos confiables — el
// server las PERSONALIZA con el negocio real vía IA antes de mostrarlas
// (lib/personalidad-store.ts → personalizarPregunta), con estas como fallback.
//
// DATOS PUROS (sin 'server-only'): las consume el quiz en el browser.

export type OpcionPersonalidad = { texto: string; rasgo: string };
export type PersonalidadPregunta = { key: string; dimension: string; pregunta: string; opciones: OpcionPersonalidad[] };

/** Una respuesta elegida: el rasgo (para el prompt) + la frase que eligió. */
export type RespuestaPersonalidad = { rasgo: string; texto: string };

export type Personalidad = {
  /** key de pregunta → la opción elegida. */
  respuestas: Record<string, RespuestaPersonalidad>;
  /** Muletillas o frases que SIEMPRE dice (libre, opcional). */
  muletillas: string;
};

export const PERSONALIDAD_VACIA: Personalidad = { respuestas: {}, muletillas: '' };

export const PERSONALIDAD_PREGUNTAS: PersonalidadPregunta[] = [
  {
    key: "energia-arranque", dimension: "energia",
    pregunta: "Estás grabando el arranque de un anuncio. ¿Cuál de estos inicios dirías tú?",
    opciones: [
      { texto: "Déjame contarte algo que cambió por completo mi negocio.", rasgo: "energía serena, arranque calmado y confiado" },
      { texto: "Tengo algo importante que decirte. Dame 30 segundos.", rasgo: "energía media, firme sin gritar" },
      { texto: "¡Detente! Lo que vas a ver puede cambiar tus ventas hoy mismo.", rasgo: "alto voltaje, intensidad explosiva" },
    ],
  },
  {
    key: "trato-tu-usted", dimension: "trato",
    pregunta: "Viendo a la cámara, hablándole a tu cliente ideal, ¿cómo se lo dirías?",
    opciones: [
      { texto: "Usted sabe lo difícil que es conseguir clientes constantes.", rasgo: "trato de usted, respetuoso y formal" },
      { texto: "Tú sabes lo difícil que es conseguir clientes constantes.", rasgo: "tuteo cercano, habla de igual a igual" },
    ],
  },
  {
    key: "registro-lenguaje", dimension: "registro",
    pregunta: "El mismo consejo, dicho de tres maneras. ¿Cuál suena más a ti?",
    opciones: [
      { texto: "Deja de tirar tu dinero a la basura con anuncios que no venden.", rasgo: "lenguaje de calle, crudo y sin filtro" },
      { texto: "Te voy a mostrar los tres errores que están frenando tus ventas.", rasgo: "profesional cercano, claro y accesible" },
      { texto: "Hoy quiero compartirte tres áreas de oportunidad en tu estrategia comercial.", rasgo: "registro corporativo, cuidado e institucional" },
    ],
  },
  {
    key: "humor-remate", dimension: "humor",
    pregunta: "Acabas de contar que perdiste dinero por un error. ¿Cómo lo rematas?",
    opciones: [
      { texto: "Perdí mucho dinero por ese error. Sí, ríete… yo también me río, ahora.", rasgo: "humor suave, se ríe de sí mismo" },
      { texto: "Perdí mucho dinero por ese error, el mismo que los 'expertos' te siguen cobrando.", rasgo: "humor ácido, sarcasmo con filo" },
      { texto: "Perdí mucho dinero por ese error, y no quiero que te pase a ti.", rasgo: "serio siempre, cero bromas" },
    ],
  },
  {
    key: "narrativa-apertura", dimension: "narrativa",
    pregunta: "Tienes 30 segundos para explicar tu método. ¿Por dónde empiezas?",
    opciones: [
      { texto: "Hace dos años un cliente llegó conmigo a punto de cerrar su negocio. Esto fue lo que hicimos…", rasgo: "narrador, abre con historia personal" },
      { texto: "Mi método tiene tres pasos. Paso uno: deja de perseguir clientes que no compran.", rasgo: "directo al grano, cero rodeos" },
    ],
  },
  {
    key: "filo-culpables", dimension: "filo",
    pregunta: "Vas a explicar por qué la gente no logra resultados. ¿Cuál frase dirías?",
    opciones: [
      { texto: "No es tu culpa: te han enseñado métodos que ya no funcionan.", rasgo: "empático, nunca culpa al cliente" },
      { texto: "En esta industria te venden humo, y hoy te voy a enseñar a distinguirlo.", rasgo: "señala culpables, defiende al cliente" },
      { texto: "Te lo digo de frente: te han estado viendo la cara, y tú lo permitiste.", rasgo: "confrontativo, polariza sin miedo" },
    ],
  },
  {
    key: "vocabulario-explicacion", dimension: "vocabulario",
    pregunta: "Explicando lo que haces en un anuncio, ¿cuál te suena más natural?",
    opciones: [
      { texto: "Hago que la gente que ya conoció tu negocio regrese y te compre.", rasgo: "vocabulario simple, palabras de todos los días" },
      { texto: "Optimizo tu embudo de conversión con campañas sobre audiencias calificadas.", rasgo: "vocabulario técnico, habla como experto" },
    ],
  },
  {
    key: "vulnerabilidad-confianza", dimension: "vulnerabilidad",
    pregunta: "Para ganarte la confianza del que te está viendo, ¿qué dirías?",
    opciones: [
      { texto: "Yo fracasé dos veces antes de descubrir esto, y me costó carísimo.", rasgo: "vulnerable, cuenta sus fracasos abiertamente" },
      { texto: "He ayudado a cientos de negocios a lograr esto, y los números lo respaldan.", rasgo: "autoridad pura, habla desde resultados" },
    ],
  },
  {
    key: "presion-cta", dimension: "presion",
    pregunta: "Cierre del anuncio: es hora del llamado a la acción. ¿Cuál dirías tú?",
    opciones: [
      { texto: "Si esto te hace sentido, agenda una llamada cuando quieras. Sin prisa.", rasgo: "cero presión, invitación suave" },
      { texto: "Agenda tu llamada hoy; los lugares se llenan rápido.", rasgo: "urgencia moderada, empuje amable" },
      { texto: "Solo me quedan tres lugares esta semana. Agenda ahora o te quedas fuera.", rasgo: "urgencia y escasez explícitas, cierra fuerte" },
    ],
  },
  {
    key: "ritmo-frase-clave", dimension: "ritmo",
    pregunta: "Vas a soltar la idea más importante del video. ¿Cómo la dices?",
    opciones: [
      { texto: "Escucha bien. Esto es clave. Y nadie te lo dice.", rasgo: "frases cortas, ritmo percusivo y punch" },
      { texto: "Quiero explicarte con calma por qué esto es tan importante, porque cuando lo entiendas, todo lo demás va a hacer clic.", rasgo: "explicativo, oraciones largas y pausadas" },
    ],
  },
];

/** ¿Contestó todas las preguntas del quiz? (muletillas es opcional). */
export function personalidadCompleta(p: Personalidad): boolean {
  return PERSONALIDAD_PREGUNTAS.every((q) => !!p.respuestas[q.key]?.rasgo);
}

/** El perfil de voz como texto para el prompt de guiones/copy. */
export function personalidadTexto(p: Personalidad): string {
  const partes: string[] = [];
  for (const q of PERSONALIDAD_PREGUNTAS) {
    const r = p.respuestas[q.key];
    if (!r?.rasgo) continue;
    partes.push(`- ${q.dimension}: ${r.rasgo}${r.texto ? ` (ej. de como lo dice: "${r.texto}")` : ''}`);
  }
  if (p.muletillas.trim()) partes.push(`- Muletillas/frases tipicas (usa 1-2, natural, sin forzar): ${p.muletillas.trim()}`);
  return partes.join('\n');
}

const sTxt = (x: unknown) => (typeof x === 'string' ? x.trim() : '');

export function normalizarPersonalidad(v: unknown): Personalidad {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const resp = (o.respuestas && typeof o.respuestas === 'object' ? o.respuestas : {}) as Record<string, unknown>;
  const limpio: Record<string, RespuestaPersonalidad> = {};
  for (const q of PERSONALIDAD_PREGUNTAS) {
    const r = (resp[q.key] && typeof resp[q.key] === 'object' ? resp[q.key] : null) as Record<string, unknown> | null;
    const rasgo = r ? sTxt(r.rasgo) : '';
    // El rasgo tiene que ser uno del catálogo de ESA pregunta (las frases pueden
    // venir personalizadas por IA, pero el rasgo es fijo — si no matchea, se
    // descarta: una edición del catálogo deja la pregunta sin contestar, no rota).
    if (rasgo && q.opciones.some((op) => op.rasgo === rasgo)) {
      limpio[q.key] = { rasgo, texto: r ? sTxt(r.texto).slice(0, 300) : '' };
    }
  }
  return { respuestas: limpio, muletillas: sTxt(o.muletillas).slice(0, 500) };
}
