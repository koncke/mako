// =============================================================================
// mako-router — elige el modelo POR TURNO (barato vs Sonnet vs Opus)
// =============================================================================
// El dueño no quiere que TODO vaya a Opus 4.8. Este router clasifica cada
// instrucción del doer con una HEURÍSTICA de costo 0 (sin gastar un LLM extra) y
// decide el tier. Reglas de oro:
//   · needs-tools ⇒ NUNCA barato (chatCheap no manda tools → inventaría datos).
//   · default = Sonnet (no Opus): el grueso del doer son lecturas simples/acciones.
//   · Opus solo para razonamiento multi-paso, copywriting con voz de marca o media.
//   · barato (Groq, sin tools) solo para saludos/charla SIN dato ni acción.
//   · ante la duda se ESCALA (a Sonnet/Opus), nunca se degrada.
// El resultado queda en `motivo` (router:tier) para auditar en el Saldo de IA.

export type Tier = 'cheap' | 'sonnet' | 'opus';
export type RutaDoer = { tier: Tier; needsTools: boolean; model: string; effort: 'low' | 'medium' | 'high'; motivo: string };

const SONNET = 'claude-sonnet-5';
const OPUS = 'claude-opus-4-8';

// Verbos de razonamiento/análisis → Opus (multi-paso, no una sola tool de lectura).
const RAZONAMIENTO = /\b(por\s?qu[eé]|analiz|diagnos|compar|eval[uú]|recomend|estrateg|opin|conven[ií]|deber[ií]a|qu[eé] hago|c[oó]mo mejor|optimiz|proyect[aá]|estim|interpret)/i;
// Verbos de copywriting / voz de marca → Opus (o Sonnet si el dueño lo baja).
const COPY = /\b(escrib[ií]|redact[aá]|arm[aá]\s+(el|un|una|la)\s+(mensaje|copy|texto|nutrici|secuencia|campa|anuncio|email|correo)|guion|creativ)/i;
// Verbos de acción (escritura sobre la cuenta) → tool-use → piso Sonnet.
const ACCION = /\b(apag|pausa|activ|prend|encend|renombr|renam|mov[eé]|cambi|actualiz|sub[ií]|baj[aá]|program|agend|env[ií]|mand[aá]|cre[aá]|borr[aá]|elimin|marc[aá]|asign|confirm|cancel)/i;
// Verbos de consulta de datos → necesitan una tool de lectura → Sonnet.
const DATOS = /\b(cu[aá]nt|cu[aá]l|qui[eé]n|cu[aá]ndo|d[oó]nde|mostr|mostrame|busc|dame|dec[ií]me|list[aá]|tra[eé]|revis|ten[ge]|hay|mis|último|ultimo|reuni|lead|cliente|campa|gast|venta|cierre|pago)/i;
// Saludo / charla / acuse SIN pedido concreto → barato (Groq, sin tools). Anclado
// al INICIO (no exige que TODA la frase sea saludo: "gracias MaKo", "buenísimo, dale"
// tienen relleno). Incluye el nombre (mako/maco) porque casi siempre lo nombran. La
// seguridad la dan los chequeos de dato/acción/razonamiento que corren ANTES.
const SALUDO = /^[\s¡!¿?]*(hola|buenas|buen[oa]s|hey\b|ey\b|qu[eé] tal|c[oó]mo (and|est|va)|todo bien|gracias|mil gracias|dale|genial|perfecto|joya|b[aá]rbaro|buen[ií]simo|de una|okey?\b|listo|bien\b|de nada|s[ií]p?\b|nop?\b|jaja|mako\b|maco\b|abrazo|saludos|chau|nos vemos|buen finde)/i;
// Mensaje que es SOLO emojis/reacción (👍🔥🙌…) → también charla.
const SOLO_EMOJI = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}!?.]+$/u;
// Preguntas sobre las capacidades de MaKo (no requieren datos del negocio).
const CAPACIDAD = /(qu[eé] pod[eé]s hacer|qui[eé]n sos|para qu[eé] serv[ií]s|c[oó]mo (funcion|te us|and[aá]s como)|qu[eé] sab[eé]s hacer|en qu[eé] (me pod[eé]s|pod[eé]s) ayud|ayuda\b|comandos)/i;

/**
 * Clasifica una instrucción del doer. `ctx.hayMedia` = imagen/PDF adjunto (requiere
 * visión → Anthropic). `ctx.hayPendientes` = hay una acción esperando confirmación
 * (el turno suele ser un "sí/no" → tool-use). Puro y sincrónico (0 costo).
 */
export function rutearDoer(texto: string, ctx: { hayMedia?: boolean; hayPendientes?: boolean } = {}): RutaDoer {
  const t = (texto || '').trim();

  // 1) Media (imagen/PDF): requiere visión → Anthropic. Interpretar bien → Opus.
  if (ctx.hayMedia) return { tier: 'opus', needsTools: true, model: OPUS, effort: 'high', motivo: 'router:opus (media)' };

  // 2) Razonamiento / copywriting → Opus (voz de marca / multi-paso).
  if (RAZONAMIENTO.test(t) || COPY.test(t)) return { tier: 'opus', needsTools: true, model: OPUS, effort: 'high', motivo: 'router:opus (razonamiento/copy)' };

  // 3) Confirmando una acción pendiente → tool-use (confirmar_accion) → Sonnet.
  if (ctx.hayPendientes) return { tier: 'sonnet', needsTools: true, model: SONNET, effort: 'medium', motivo: 'router:sonnet (confirmación)' };

  // 4) Acción sobre la cuenta o consulta de datos → tool-use → Sonnet.
  if (ACCION.test(t) || DATOS.test(t)) return { tier: 'sonnet', needsTools: true, model: SONNET, effort: 'medium', motivo: 'router:sonnet (dato/acción)' };

  // 5) Saludo / charla / capacidades / solo-emoji SIN pedido concreto → barato (sin
  //    tools). Solo si es corto y no cayó en ninguna anterior (fail-safe: la duda escala).
  if ((SALUDO.test(t) || CAPACIDAD.test(t) || SOLO_EMOJI.test(t)) && t.length <= 160) {
    return { tier: 'cheap', needsTools: false, model: '', effort: 'low', motivo: 'router:cheap (saludo/charla)' };
  }

  // 6) Ambiguo → Sonnet con tools (nunca barato: podría necesitar un dato).
  return { tier: 'sonnet', needsTools: true, model: SONNET, effort: 'medium', motivo: 'router:sonnet (default)' };
}
