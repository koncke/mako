// =============================================================================
// ig-formatos — LA fuente única de los formatos de contenido de Instagram
// =============================================================================
// «Una cosa, un lugar»: los límites técnicos de publicar vía Zernio y la
// metodología destilada de los cursos viven ACÁ, y los importan los writers
// (lib/ig-writer.ts), el puente al programador (lib/ig-contenido.ts) y la UI de
// las tabs Reels/Carousels/Stories.
//
// SIN `server-only` a propósito: los textos de metodología van adentro de
// prompts (server) pero los límites también los muestra la UI (client), y un
// módulo con server-only no lo puede importar ningún test.
//
// Los límites salen del spec de Zernio (verificados contra el contrato, no
// contra la doc de Meta, que se contradice). La metodología sale de las
// transcripciones de los cursos de public/cono-tx (Master Marca Personal 5.0,
// Mateo Maffia BYF, Inteligencia Viral 2026, ManyChat Master, Sell Your
// Knowledge) — cada bloque cita su fuente para poder auditarlo.
// =============================================================================

/** Los tres formatos que escriben las tabs. Los valores son EXACTAMENTE los del
 *  check de `contenido_posts.tipo` (mig 0136): se insertan tal cual. */
export type FormatoIg = 'reel' | 'carrusel' | 'story';

export const FORMATOS_IG: FormatoIg[] = ['reel', 'carrusel', 'story'];

// ── Límites técnicos (Zernio → Instagram) ─────────────────────────────────────

/** Caption: tope duro de Instagram. */
export const CAPTION_MAX = 2200;
/** Lo visible antes del «… más». No es doctrina de cursos: es el corte de la UI de IG. */
export const CAPTION_VISIBLE = 125;

export const LIMITES_REEL = {
  /** MP4/MOV H.264 30fps. */
  videoMimes: ['video/mp4', 'video/quicktime'],
  codec: 'H.264 30fps',
  maxSeg: 90,
  maxMB: 300,
  /** Zernio acepta thumbOffset / instagramThumbnail. */
  thumbnail: true,
  /** audioConfiguration { audioId, audioVolume, videoVolume }. */
  audioConfigurable: true,
  /** shareToFeed default true. */
  shareToFeedDefault: true,
  colaboradoresMax: 3,
} as const;

export const LIMITES_STORY = {
  aspecto: '9:16',
  videoMaxSeg: 60,
  videoMaxMB: 100,
  imagenMaxMB: 8,
  colaboradores: false,
  /** Limitación de META, no de Zernio: stickers/encuestas/links NO salen por API.
   *  Lo interactivo se agrega A MANO en la app después de publicar. */
  interactivosPorApi: false,
} as const;

export const LIMITES_CARRUSEL = {
  itemsMin: 2,
  itemsMax: 10,
  /** Se puede mezclar imagen y video en el mismo carrusel. */
  mezclaImagenVideo: true,
  /** userTags { username, x, y, mediaIndex } y firstComment disponibles. */
  userTags: true,
  firstComment: true,
} as const;

export const LIMITES_IMAGEN = {
  /** SOLO JPEG en orgánico: un PNG rebota. */
  formato: 'JPEG',
  aspectoRecomendado: '4:5',
  maxMB: 8,
} as const;

/** Flag de Zernio para etiquetar contenido generado con IA. */
export const FLAG_IA_DISPONIBLE = 'isAiGenerated';

/**
 * Cupo de publicaciones: NO se hardcodea (la doc de Meta se contradice).
 * Se lee en runtime de GET content_publishing_limit. Esta constante existe
 * solo para que nadie «sepa» un número inventado.
 */
export const CUPO_PUBLICACION = 'leer de GET content_publishing_limit — no hardcodear' as const;

export function limitesDe(formato: FormatoIg) {
  switch (formato) {
    case 'reel': return LIMITES_REEL;
    case 'story': return LIMITES_STORY;
    case 'carrusel': return LIMITES_CARRUSEL;
  }
}

// ── Metodología destilada (bloques listos para inyectar en prompts) ───────────
// Cada bloque es TEXTO para el system prompt del writer del formato. La regla
// transversal va SIEMPRE junto con la del formato (los tres cursos la repiten).

export const METODOLOGIA_TRANSVERSAL = `PRINCIPIOS QUE REPITEN LOS TRES CURSOS DE ORGÁNICO (trátalos como ley):
1) El GANCHO es la variable #1 y se planifica más que el resto de la pieza (80% del esfuerzo).
2) Lo orgánico le gana a lo producido: cero transiciones, cero efectos, set casero, hablarle a un amigo. Producción alta se lee como anuncio.
3) Curiosidad sostenida: la respuesta de la promesa se entrega al FINAL, nunca antes.
4) UNA sola idea por pieza (un reel, un carrusel o un día de stories).
5) Simple: lo entiende alguien de 12 años. Cero jerga (ROAS, funnel, KPI, MVP), cero regionalismos.
6) La promesa y la entrega al mismo nivel: el hook nunca mejor que el contenido («el error es un tráiler mejor que la película» — Inteligencia Viral 2026).
7) Hablar solo desde experiencia real del negocio: se nota y es lo que convierte.

CTA HACIA COMENTARIOS/DM (regla unificada de los tres cursos): imperativo + palabra clave + promesa concreta e inmediata («Comenta INGLÉS y te envío la clase gratis»), nunca «si te gustaría saber más, sígueme». Micro-CTAs dentro de la pieza («guárdalo», «compártelo con tu socio») suben retención. La palabra clave dispara la automatización comment→DM: tiene que ser ÚNICA, universal y en mayúsculas.

COMMENT→DM — el sistema (ManyChat Master): dos tipos de contenido. (a) ALCANCE (~70% de los posts): se regala algo universal del nicho a cambio de un comentario con palabra clave; la métrica son los COMENTARIOS; esa gente NO es lead todavía. (b) CONVERSIÓN: lleva a lead magnet u oferta; la métrica es el CTR. Con lead frío NUNCA mandar directo a la oferta paga: cadena regalo → segundo gancho → lead magnet → oferta. El intercambio tiene que valer la pena («te ahorro la búsqueda, te doy la herramienta»), nunca un premio flojo.

CAPTION: ningún curso enseña doctrina de caption — el peso comunicacional va en el guion y el título EN PANTALLA (50% mira sin audio). La caption acompaña reforzando la palabra clave del CTA y nada más: corta.

HASHTAGS: los cursos los DESCARTAN como palanca («no fue el algoritmo, no fue la hora, no fue el hashtag» — Inteligencia Viral 2026; el mismo video con otro gancho pasó de 40.000 a 2,8 millones de views — BYF). No los prometas como palanca de alcance; si van, con moderación descriptiva y punto.`;

export const METODOLOGIA_REEL = `ESTRUCTURA DEL GUION (metodología ViralCopy — Master Marca Personal 5.0):
1) IDEA con objetivo explícito: ¿qué hace la persona al terminar (seguir, comentar palabra clave, ir al link)?
2) GANCHO: los primeros 3 segundos.
3) HISTORIA/CONTEXTO: 30-40 s de desarrollo.
4) MORALEJA: 10-15 s, la enseñanza resumida en una frase.
5) CTA: 5-7 s máximo.
Total óptimo 50-60 s (más largo SOLO si cada segundo aporta — BYF «Retención»).
Estructura alternativa para reel de NICHO (BYF): Hook → Problema del cliente → Solución realista ligada a lo que se vende → CTA; con caso real de cliente como prueba. Alterna reel viral (gancho amplio) y reel de nicho (gancho específico: menos views, pero views que compran).

GANCHO — LA REGLA MAESTRA: 80% del esfuerzo va al gancho; el 80% de la gente decide en los primeros 3-5 s. El gancho NO es solo la frase: es TODO lo que pasa en los primeros 3-5 s — frase + encuadre + título en pantalla + elementos visuales. Debe cumplir DOS trabajos: frenar el scroll Y abrir una curiosidad que solo se resuelve al final.
Reglas duras del gancho (BYF «Anatomía de un gancho» + «Masterclass de Ganchos»):
- PROHIBIDO abrir segmentando explícito («¿Eres arquitecto?»): así empiezan los anuncios y el cerebro lo descarta. Segmenta IMPLÍCITO por tema.
- Frase de 5-9 palabras, máxima información en mínimo tiempo. La palabra clave del tema en las posiciones 1-3 de la frase.
- Que lo entienda alguien de 12 años. Cero jerga, cero regionalismos.
- Ni un microsegundo de silencio al arrancar. Nunca presentarse, nunca «hoy te voy a contar», nunca intro.
- Que se entienda SIN audio: título en pantalla grande que dice algo DISTINTO a la frase hablada (doble gancho). Palabras fuertes en el título: error, secreto, verdad, revelación, cifra concreta.
- Gancho visual: fondo que cuenta historia, pantalla verde con imagen impactante, o acción fuera de contexto natural. Nunca forzado.
- Energía congruente con el mensaje (tema serio sin sonrisa) y actitud de hablarle a un amigo.
- Variante (Inteligencia Viral 2026): abrir con una PREGUNTA que el espectador crea que puede responder, mostrar una escena cotidiana y romperla con un twist visual; la cotidianidad se planifica al detalle.
BANCO DE TIPOS DE HOOK (Master Marca Personal, catálogo de 30 — usar como banco): cotilla/famoso, hoyo de curiosidad («Esta persona ganó 140.000 en 24 hs haciendo una sola cosa»), negativo («Si no conoces este error…»), acciones discordantes, reto/porcentaje («Solo el 1% entenderá esto»), pregunta con respuesta contraintuitiva, contracorriente («Para perder peso, come hamburguesas»), enemigo común, lista, frase célebre, fact con total seguridad, «en un minuto te explico X», objeto mágico, razones, situación («Si tuviera que empezar de cero…»), resultado propio con cifra, sorpresa física, entrevista, «una sola cosa», doble sentido, storytelling inmediato (mini-historia real con transformación en 2 frases + promesa).

RETENCIÓN (BYF + Master Marca Personal): cada segundo aporta valor — por CADA frase preguntarse «¿la puedo sacar?»; cortar muletillas y silencios; nunca repetir; nada de «quédate hasta el final». Información en cuentagotas balanceando valor y curiosidad. NUNCA revelar la respuesta del gancho antes del final. Ejemplos y metáforas como herramienta de claridad. Credibilidad: metáforas, personajes famosos, estudios («según la universidad de…»), historia personal. Micro-CTAs a mitad de video suben retención. Variar tono, velocidad, planos, gestos. SIN transiciones, SIN efectos de sonido, SIN música trillada: se prioriza lo orgánico. Formatos con multiplicador de viralidad: hablar a cámara x1, selfie caminando x1.1, entrevista/podcast x1.3, vlog x1.4, POV gran angular 0.5 x1.4.

MORALEJA: enseñanza final simple, idealmente UNA frase, fácil de recordar. Es lo que separa al experto (que vende) del influencer (que solo entretiene). Sin moraleja no hay permiso para vender.

CTA: SIEMPRE imperativo + promesa concreta con beneficio claro («Comenta INGLÉS y te envío la clase gratis»), con una razón de peso. Si el objetivo del video es solo alcance, puede NO llevar CTA. El preferido: palabra clave en comentarios o DM (dispara la automatización comment→DM).

CAPTION del reel: los cursos NO dan doctrina — el peso está en el guion y el título en pantalla. Regla derivada: caption corta que refuerce la palabra clave del CTA.

ERRORES QUE LOS CURSOS MARCAN: parecer anuncio (segmentar explícito, set profesional, alta producción); prometer exagerado — prometer lo realista (BYF); gancho mejor que el contenido; ser genérico sin ángulo propio; compararse con creadores que ya tienen audiencia; hablar de temas que el negocio no vivió.`;

export const METODOLOGIA_CARRUSEL = `AVISO DE COBERTURA (honesto): los cursos comprados tienen POCO material de carrusel. Lo específico son dos clases de Sell Your Knowledge (Ramiro Cubria) y enseñan UN formato: el carrusel de storytelling estilo cómic/viñetas producido con IA + edición. NO hay doctrina de curso sobre cantidad ideal de slides ni taxonomía educativo/storytelling/venta: para eso aplica criterio general + las reglas de REEL trasladadas (el carrusel es un reel en slides: portada = gancho, desarrollo = historia con curiosidad sostenida, cierre = moraleja + CTA con palabra clave).

LO QUE SÍ SALE DE LOS CURSOS (Sell Your Knowledge):
- SLIDE 1 = el juego se gana o se pierde aquí: portada llamativa, con gancho, igual que el hook de un reel. El problema VISIBLE en la primera imagen, sin explicarlo. La portada NO revela la solución.
- Estructura escena a escena: escena 1 plano general que muestra el problema con contexto; escena 2 primer plano con emoción/reacción (genera curiosidad); escena 3 la respuesta o el siguiente beat. Variar planos entre slides (general → primer plano → cámara por detrás) para que sea dinámico.
- TEXTO POR SLIDE: diálogos cortos repartidos dentro de la imagen — NUNCA un bloque grande de texto en una esquina; el usuario de Instagram no lee párrafos. UNA tipografía coherente en todo el carrusel, máximo 2-3.
- Storytelling con personajes consistentes: personaje con accesorios/rasgos distintivos para mantenerlo identificable slide a slide.
- FUENTE DE IDEAS: los posteos con MÁS COMENTARIOS de los competidores — eso es lo que se adapta a carrusel.
- Una sola idea por carrusel; cierre con moraleja simple + CTA imperativo con palabra clave en comentarios (conecta con la automatización comment→DM).
- Contexto de embudo (ManyChat Master): el post con automatización necesita que el intercambio valga la pena — la última slide ofrece un recurso concreto a cambio del comentario, no un «sígueme» seco.`;

export const METODOLOGIA_STORY = `ROL EN EL EMBUDO (Master Marca Personal + ManyChat Master): los reels atraen; las stories CALIENTAN y VENDEN. Solo el 5-20% de los seguidores ve stories y +90% de los viewers son seguidores → todo el que mira stories ya es lead. «El mejor lugar para vender son las historias» (Andy Landa vendió +100 asesorías SOLO por stories). Proporción: en el feed 80% valor / 20% venta; en stories al revés: ~20% personal / 80% venta.

ARCO DE UN DÍA DE STORIES (Master Marca Personal): un día de stories se estructura EXACTAMENTE como un reel: primera historia = gancho (curiosidad que no se resuelve), luego contexto/contenido con metáforas y cambios de formato, conclusión = moraleja, y CTA final (no siempre obligatorio). UNA SOLA IDEA POR DÍA — pueden ser 8, 15 o 50 frames, pero una idea; varias ideas el mismo día = no se entiende ninguna. El bloque se sube JUNTO (5-10 min entre historias, no regadas en horas). La PRIMERA historia del día es crítica: marca las views de todas las siguientes.

FORMATOS Y ERRORES: PROHIBIDO hablar a cámara +30-45 s sobre lo mismo — stories no es para eso, para eso están los reels. Cambiar de formato en CADA frame: video paparazzi (alguien te graba en acción), video o foto selfie, POV 0.5 gran angular, foto con texto subrayado, texto sobre fondo liso, capturas de mensajes/chats, layout de 2-4 fotos, video con música. Intercalar siempre; ni solo texto ni solo video. Creatividad obligatoria: el testimonio se graba jugando al básquet, no sentado en una silla.

SUBIR VIEWS: 1) mostrar algo épico/curioso/envidiable que no se vea todos los días; 2) provocar RESPUESTAS: preguntas, retos — la respuesta a una story pesa para el algoritmo más que un comentario en reel; 3) pixelar/tapar algo y no revelarlo hasta el final de la secuencia (loop de curiosidad).

PLANTILLA DE VENTA EN 7 DÍAS (Master Marca Personal): Lun-Mar: hablar SOLO del problema que se resuelve (tangible e intangible). Mié-Jue: llegan DMs pidiendo solución → capturas como prueba social y «permiso» para hablar del tema; Jue: explicar CÓMO se resolvió. Vie: caso de éxito completo contado de forma creativa (antes/después). Sáb: «¿Quieren que abra plazas?» — dejar el melón abierto. Dom: mostrar la demanda (capturas), escasez real (X plazas) y anunciar apertura con día y hora exacta; pedir que activen alarma. Lun: abrir con algo llamativo → palabra clave → bot → link de compra. Extensible a 20-30 días: más calentamiento = más venta.

MOVER A DM (ManyChat Master «FLOW 3»): el trigger es RESPONDER LA STORY con una palabra clave específica («Responde GRUPAL y reserva tu lugar») — nunca «cualquier respuesta». Las automatizaciones de story son las menos usadas y las que MÁS convierten. Mensaje único y corto (el flow ganador: tag + mensaje); 1-2 botones, y el segundo hace que el lead se perfile solo; si no hay nada que vender aún, la conversión es capturar el mail con un incentivo concreto; siempre respuesta de lista de espera si no hay cupo.

LÍMITE TÉCNICO A RESPETAR EN EL GUION: por API NO salen stickers, encuestas ni links (limitación de Meta) — si un frame los necesita, marcarlo como paso manual en la app, no prometerlo automático.`;

/** Metodología del formato + la transversal (siempre juntas). */
export function metodologiaDe(formato: FormatoIg): string {
  const propia = formato === 'reel' ? METODOLOGIA_REEL : formato === 'carrusel' ? METODOLOGIA_CARRUSEL : METODOLOGIA_STORY;
  return `${propia}\n\n${METODOLOGIA_TRANSVERSAL}`;
}
