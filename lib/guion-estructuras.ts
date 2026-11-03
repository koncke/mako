// =============================================================================
// guion-estructuras — las ESTRUCTURAS de guion (el esqueleto narrativo del ad)
// =============================================================================
// Una ESTRUCTURA es el orden de los bloques del guion (Gancho→Historia→CTA,
// PAS, AIDA…). Es ORTOGONAL al ángulo (el enfoque): un mismo ángulo puede
// contarse con varias estructuras — cada ángulo declara cuáles le calzan
// (lib/guion-angulos.ts → estructuras[]) y el dueño elige una al crear el guion.
//
// Las `etiquetas` son CONTRATO con el parser de la UI (SeccionCard): el guion
// generado marca cada bloque con su etiqueta EXACTA en MAYÚSCULA en su propia
// línea, y la app lo parte en tarjetas por esas líneas. Cambiar una etiqueta
// rompe el render de los guiones ya guardados con ella — agregar estructuras
// nuevas es seguro; renombrar etiquetas de una existente, no.
//
// DATOS PUROS (sin 'server-only'). El super-admin edita/agrega estructuras en
// la página "Guiones" del sidebar — override global en el OWNER_WS
// (lib/guion-estructuras-store.ts), mismo patrón que los ángulos.
// =============================================================================

import { esTipoGuion, type TipoGuion } from './copywriter/tipos';

export type EstructuraGuion = {
  id: string;
  nombre: string;
  emoji: string;
  /** Cuándo conviene (1-2 frases — se ve al elegir estructura). */
  cuando: string;
  /** Los bloques del guion, EN ORDEN, en MAYÚSCULA exacta (contrato del parser). */
  etiquetas: string[];
  /** Guía por bloque para la IA: qué hace cada uno, con tiempos y ejemplos. */
  guia: string;
  activo: boolean;
  /**
   * Los formatos a los que calza (28/10/2026, el Copywriter: docs/diseno-copywriter.md, D6). SIN el campo, es de
   * anuncios ('ad'): así nacieron las siete primeras y así siguen. Las de reel y story NO se le ofrecen al Ads Writer
   * (`soloDeAnuncios`): un anuncio con la estructura de un día de stories no es un anuncio.
   */
  tipos?: TipoGuion[];
};

/** Las estructuras de anuncios (las que ve el Ads Writer): las que no declaran `tipos`, o declaran 'ad'. */
export function soloDeAnuncios<T extends Pick<EstructuraGuion, 'tipos'>>(es: readonly T[]): T[] {
  return es.filter((e) => !e.tipos?.length || e.tipos.includes('ad'));
}

export const ESTRUCTURAS_GUION_DEFAULT: EstructuraGuion[] = [
  {
    id: 'gancho-historia-cta', nombre: 'Gancho → Historia → CTA', emoji: '📖', activo: true,
    cuando: 'La clásica de tráfico frío: el espectador se identifica con una historia antes de que le vendas nada. Ideal para ángulos narrativos (dolor, testimonio, historia del fundador).',
    etiquetas: ['GANCHO', 'HISTORIA', 'CTA'],
    guia: `GANCHO (3-5 segundos, 1-2 frases): llama la atención con el dolor/deseo real, CUALIFICA para quién es (nombra al avatar o su situación) y genera curiosidad por lo que sigue.
HISTORIA (el cuerpo): una historia que muestre los problemas por los que pasa el avatar y cómo se descubrió una manera nueva de hacer las cosas que los eliminó. ANTES creíble → el descubrimiento (una sola razón, contada simple) → DESPUÉS concreto. El objetivo es que se identifique y le dé curiosidad ver cómo es esa manera nueva.
CTA (5-10 segundos, 1-2 frases): antes del llamado puedes rebatir UNA objeción corta ("no es porque X, es porque…"); después, una sola instrucción clara.`,
  },
  {
    id: 'gancho-valor-cta', nombre: 'Gancho → Valor → CTA', emoji: '🎓', activo: true,
    cuando: 'Educar antes de pedir: el espectador se lleva algo útil aunque no haga clic. Ideal para ángulos educativos, comparación, contrarian y mecanismo.',
    etiquetas: ['GANCHO', 'VALOR', 'CTA'],
    guia: `GANCHO (3-5 segundos, 1-2 frases): nombra al avatar/su situación y promete lo que va a APRENDER en este video ("te voy a mostrar los 3 pasos para…").
VALOR (el cuerpo): educa de verdad, como un mini-tutorial: 2-3 pasos o ideas accionables con una explicación BREVE de cada una. Puede abrir diciendo qué debe DEJAR de hacer antes de mostrar qué hacer. El espectador tiene que llevarse algo útil aunque no haga clic.
CTA (5-10 segundos, 1-2 frases): dirigido a quien ya quiere ayuda aplicándolo (no al curioso que solo quiere aprender gratis); una sola instrucción clara.`,
  },
  {
    id: 'gancho-propuesta-cta', nombre: 'Gancho → Propuesta directa → CTA', emoji: '🎯', activo: true,
    cuando: 'Al grano, sin historia ni tutorial: cualifica fuerte y trae al que ya busca ayuda. Ideal para lead magnet, propuesta directa, retargeting y ofertas.',
    etiquetas: ['GANCHO', 'PROPUESTA', 'CTA'],
    guia: `GANCHO (3-5 segundos, 1-2 frases): pregunta o afirmación que cualifica al avatar y nombra su situación, directo al grano.
PROPUESTA (el cuerpo): presenta la propuesta de forma clara y atractiva, sin vueltas: qué ofreces, a quién y qué logra. Puedes conectar primero con lo que YA intentó y no le funcionó (2-3 cosas, rápido) para ganar confianza, y después mostrar la manera más simple. Sin tutorial y sin historia larga: al grano.
CTA (5-10 segundos, 1-2 frases): mostrar directamente la intención y el paso a seguir; una sola instrucción clara.`,
  },
  {
    id: 'pas', nombre: 'PAS (Problema → Agitación → Solución)', emoji: '🔥', activo: true,
    cuando: 'El formato de respuesta directa más probado: nombrar el problema, hacer sentir su costo real, y recién ahí la salida. Ideal para dolor, mecanismo y retargeting.',
    etiquetas: ['GANCHO', 'PROBLEMA', 'AGITACION', 'SOLUCION', 'CTA'],
    guia: `GANCHO (3 segundos, 1 frase): el problema dicho como el avatar lo piensa de sí mismo — que se reconozca al instante.
PROBLEMA (breve): pon el problema sobre la mesa con un ejemplo concreto de su día a día; nada de estadísticas abstractas.
AGITACION (el corazón del guion): haz VIVIR el costo de seguir igual — qué le cuesta en dinero, tiempo o tranquilidad, adónde lleva esto en 6 meses. Emocional pero honesto: agitas lo que YA siente, no inventas miedo.
SOLUCION (clara y simple): presenta la salida como el alivio natural — UNA idea central de por qué esto sí funciona, sin catálogo de features.
CTA (1-2 frases): del alivio a la acción, una sola instrucción.`,
  },
  {
    id: 'aida', nombre: 'AIDA (Atención → Interés → Deseo → Acción)', emoji: '🧲', activo: true,
    cuando: 'El embudo clásico dentro de un solo guion: parar el scroll, retener con algo que le importa, hacer querer el resultado, y pedir la acción. Versátil para casi cualquier ángulo.',
    etiquetas: ['ATENCION', 'INTERES', 'DESEO', 'CTA'],
    guia: `ATENCION (3 segundos, 1 frase): afirmación fuerte, pregunta o dato que corta el scroll — para ESTE avatar, no para cualquiera.
INTERES (breve): un hecho o verdad de su situación que le importa de verdad y que lo hace quedarse ("la razón por la que X no es la que crees…").
DESEO (el cuerpo): pinta el resultado que quiere — cómo se ve su negocio/su día cuando esto está resuelto — y conéctalo con lo que ofreces. Beneficios sentidos, no features.
CTA (1-2 frases): una sola acción concreta, dicha sin vueltas.`,
  },
  {
    id: 'bab', nombre: 'BAB (Antes → Después → Puente)', emoji: '🌉', activo: true,
    cuando: 'El contraste como motor: la vida CON el problema, la vida SIN él, y el puente entre las dos. Ideal para caso de éxito, comparación y demostración.',
    etiquetas: ['ANTES', 'DESPUES', 'PUENTE', 'CTA'],
    guia: `ANTES (el gancho + apertura): la situación actual del avatar con el problema, contada con detalles que reconozca como suyos — este bloque también frena el scroll, así que la primera frase cualifica y duele.
DESPUES (el cuerpo temprano): la misma vida sin el problema — concreta, creíble, sin prometer cifras que no estén en el contexto. Que se lo pueda imaginar.
PUENTE (el cuerpo tardío): QUÉ conecta el antes con el después — la oferta/mecanismo, explicado simple, como el camino obvio entre los dos.
CTA (1-2 frases): cruzar el puente = la acción concreta.`,
  },
  {
    id: 'cuatro-p', nombre: '4P (Promesa → Pintura → Prueba → Push)', emoji: '🤝', activo: true,
    cuando: 'Cuando hay PRUEBA real para mostrar (casos, números, resultados del contexto): promesa grande, imagen vívida, evidencia y empujón. Ideal para caso de éxito, testimonio y ofertas.',
    etiquetas: ['PROMESA', 'PINTURA', 'PRUEBA', 'CTA'],
    guia: `PROMESA (el gancho, 1-2 frases): la promesa central específica para este avatar — grande pero defendible con lo que hay en el contexto.
PINTURA (el cuerpo temprano): pinta vívidamente cómo se ve esa promesa cumplida en SU negocio/su día — narrativo, sensorial, concreto.
PRUEBA (el cuerpo tardío): la evidencia de que es real — SOLO hechos del contexto del negocio (caso, resultado, mecanismo). Si no hay prueba dura, explica el porqué lógico; nunca inventes cifras.
CTA (el push, 1-2 frases): el empujón final a UNA acción, con confianza y sin presión falsa.`,
  },
  // ── Orgánico (28/10/2026, el Copywriter): las de reel y story salen de la metodología de los cursos que ya usa MaKo
  //    (lib/ig-formatos.ts, METODOLOGIA_REEL y METODOLOGIA_STORY), no se inventaron. YouTube tiene la suya desde el
  //    29/10/2026 (`youtube-retencion`, al final): la fuente es claude-youtube (D6 cerrada).
  {
    id: 'reel-viral', nombre: 'Reel: Gancho → Historia → Moraleja → CTA', emoji: '🎬', activo: true, tipos: ['reel'],
    cuando: 'El reel que atrae (metodología ViralCopy): un gancho que frena el scroll y abre una curiosidad que se resuelve al final. 50-60 segundos.',
    etiquetas: ['GANCHO', 'HISTORIA', 'MORALEJA', 'CTA'],
    guia: `GANCHO (los primeros 3 segundos): una frase de 5 a 9 palabras con la palabra clave del tema adelante; frena el scroll Y abre una curiosidad que sólo se resuelve al final. Prohibido segmentar explícito («¿Eres arquitecto?»): se segmenta por el tema.
HISTORIA (30-40 segundos): el desarrollo, con la curiosidad sostenida; cada segundo tiene que aportar.
MORALEJA (10-15 segundos): la enseñanza resumida en una frase.
CTA (5-7 segundos como máximo): lo que la persona hace al terminar (seguir, comentar una palabra clave, ir al link).`,
  },
  {
    id: 'reel-nicho', nombre: 'Reel de nicho: Hook → Problema → Solución → CTA', emoji: '🎯', activo: true, tipos: ['reel'],
    cuando: 'El reel que vende: un gancho específico del nicho (menos vistas, pero vistas que compran), el problema del cliente y la solución ligada a lo que se vende, con un caso real como prueba.',
    etiquetas: ['GANCHO', 'PROBLEMA', 'SOLUCION', 'CTA'],
    guia: `GANCHO (3 segundos): específico del nicho, con la palabra clave del tema adelante.
PROBLEMA: el problema del cliente, como él lo vive.
SOLUCION: la salida realista, ligada a lo que vende el negocio, con un caso real de cliente como prueba (sólo si está en el negocio: nunca inventar).
CTA (5-7 segundos): una sola acción.`,
  },
  {
    id: 'story-dia', nombre: 'Día de stories: Gancho → Contexto → Moraleja → CTA', emoji: '📱', activo: true, tipos: ['story'],
    cuando: 'Un día de stories con UNA sola idea (Master Marca Personal): las stories calientan y venden a quien ya sigue la cuenta. Se suben juntas.',
    etiquetas: ['GANCHO', 'CONTEXTO', 'MORALEJA', 'CTA'],
    guia: `GANCHO (la primera story, la que marca las vistas de todas las siguientes): una curiosidad que no se resuelve todavía; algo épico, curioso o tapado que se revela al final.
CONTEXTO (varias stories): el contenido, con metáforas y cambiando de formato en cada una (selfie, texto sobre fondo, captura de chats, video en acción); nada de hablar a cámara más de 30 segundos sobre lo mismo. Preguntas y retos para provocar respuestas.
MORALEJA: la conclusión del día, en una frase.
CTA (no siempre obligatorio): responder la story con una palabra clave en MAYÚSCULAS para seguir por DM. Los stickers, encuestas y links se marcan como paso manual.`,
  },
  // ── YouTube (29/10/2026, plantillas reales: docs/plantillas-reales/copywriter.md, 5.3). La forma sale de
  //    claude-youtube, `sub-skills/script.md` (https://github.com/agricidaniel/claude-youtube, MIT, «Copyright (c) 2025
  //    Daniel Agrici», aviso en lib/avisos/LICENSE-CLAUDE-YOUTUBE): el gancho de 30 s en tres tiempos, los bloques con
  //    interrupción, resumen y puente, el CTA cerca del 25 %, el regancho cerca del 60 % y el cierre sin despedida.
  //    Traducida y reescrita; SIN sus metas numéricas (la retención que promete no cita fuente).
  {
    id: 'youtube-retencion', nombre: 'YouTube: Gancho → Bloques → Regancho → Cierre', emoji: '▶️', activo: true, tipos: ['youtube'],
    cuando: 'Un video largo que sostiene la atención: el primer minuto cumple la miniatura, cada bloque abre con una interrupción y el final entrega la recompensa.',
    etiquetas: ['GANCHO', 'INTRO', 'BLOQUE UNO', 'CTA MEDIO', 'BLOQUE DOS', 'BLOQUE TRES', 'REGANCHO', 'BLOQUE FINAL', 'CIERRE'],
    guia: `GANCHO (0:00-0:30, en tres tiempos): el agarre (hasta el segundo 5) muestra lo que promete la miniatura; la promesa (hasta el 15) dice qué se lleva quien mire el video; lo que está en juego (hasta el 30) dice qué pierde si no lo sabe. Sin saludo y sin presentarte antes del gancho.
INTRO (0:30-1:30): quién eres, en una frase y en función del tema, y de dónde salen los datos del video. Cierra con un puente al primer bloque.
BLOQUE UNO (1:30-3:00): abre con una interrupción (cambio de cámara, gráfico o ejemplo en pantalla), entrega una idea completa que se pueda aplicar y cierra con un resumen de una línea y un puente al bloque siguiente.
CTA MEDIO (cerca del minuto 3, el 25 % del video; 15 segundos como máximo): un recurso gratuito ligado al tema (una guía, un checklist) y dónde encontrarlo. No pide comprar ni agendar.
BLOQUE DOS (3:15-5:00): su primera línea vuelve a enganchar a quien se iba a ir («lo que sigue te va a doler»). Misma forma: interrupción, una idea, resumen y puente.
BLOQUE TRES (5:00-7:30): la idea más teórica, siempre con un ejemplo en pantalla. Misma forma.
REGANCHO (cerca del minuto 7:30, el 60 % del video): una o dos frases que resumen lo que ya vio y prometen lo mejor que falta.
BLOQUE FINAL (7:30-11:00): la recompensa que prometió la miniatura, entera. Una interrupción cada 30 a 40 segundos.
CIERRE (11:00-12:00): una sola acción y el video que sigue. Sin despedida larga, y sin anunciar que termina antes de entregar la recompensa.
Los tiempos son de un video de 12 minutos: en otro largo se escalan en proporción, salvo el gancho, que dura siempre 30 segundos. Marca la producción entre corchetes: [B-ROLL], [GRAFICO] y [CAMBIO DE CAMARA]. Unas 150 palabras por minuto.`,
  },
];

export function estructuraPorId(estructuras: EstructuraGuion[], id: string): EstructuraGuion | undefined {
  return estructuras.find((e) => e.id === id);
}

/** Normaliza un catálogo crudo (del override editable). Descarta entradas sin lo mínimo. */
export function normalizarEstructurasGuion(v: unknown): EstructuraGuion[] {
  if (!Array.isArray(v)) return [];
  const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const out: EstructuraGuion[] = [];
  for (const raw of v) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = s(o.id).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const nombre = s(o.nombre);
    const guia = s(o.guia);
    const etiquetas = (Array.isArray(o.etiquetas) ? o.etiquetas : []).map(s).filter(Boolean)
      // Contrato del parser: MAYÚSCULA, sin espacios raros, corta.
      .map((e) => e.toUpperCase().replace(/\s+/g, ' ').trim()).filter((e) => e.length >= 2 && e.length <= 20);
    if (!id || !nombre || !guia || etiquetas.length < 2) continue;
    const tipos = Array.isArray(o.tipos) ? [...new Set(o.tipos.filter(esTipoGuion))] : [];
    out.push({ id, nombre, emoji: s(o.emoji) || '🧱', cuando: s(o.cuando), etiquetas, guia, activo: o.activo !== false, ...(tipos.length ? { tipos } : {}) });
  }
  return out;
}
