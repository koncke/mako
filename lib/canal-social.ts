// =============================================================================
// canal-social — Instagram y Messenger como CANALES de las automatizaciones (por Zernio)
// =============================================================================
// Decisión de Martín (09/10/2026, sexta tanda, CRON 4, 5, 6 y 7), textual: «Con respecto a agregar
// Instagram, ya tenemos la integración de Zernio, utiliza eso para poder enviar mensajes por allí» y
// «También agrega "Messenger", con todo lo que te pedí de Instagram». Instagram había SALIDO del
// producto el 06/10/2026 (la tab, su bandeja y su programador: commit 8d16c6ff); vuelve como un CANAL
// de las automatizaciones de /chatbot, no como la tab vieja.
//
// Módulo PURO y sin `server-only`: lo leen el lienzo (las tarjetas INSTAGRAM y MESSENGER), «Probar»,
// el motor (lib/nutricion.ts, al guardar y al mandar), el webhook de Zernio y los tests. Lo que habla
// con Zernio vive aparte: lib/zernio.ts (el cliente), lib/canal-zernio.ts (mandar) y
// lib/zernio-entrante.ts (recibir).
//
// ⚠️ LA REGLA QUE MÁS CUESTA: META NO DEJA ESCRIBIRLE PRIMERO A NADIE. Un DM sale sólo dentro de las
// 24 h del último mensaje DE LA PERSONA (o como la única respuesta privada a un comentario, dentro de
// los 7 días). Fuera de eso Instagram acepta sólo la etiqueta HUMAN_AGENT, que por política de Meta es
// para una PERSONA que contesta, nunca para una automatización: no se usa. Medido en la doc de Zernio
// (docs.zernio.com, 09/10/2026: «To message outside the 24-hour window, send messageTag: HUMAN_AGENT»
// y el `400 PLATFORM_LIMITATION` cuando no) — no en un envío real: no se mandó ninguno. El reloj de
// acá es la PRE-guarda; lo que manda es la respuesta de Zernio (lib/canal-zernio.ts).

export const CANALES_SOCIALES = ['instagram', 'messenger'] as const;
export type CanalSocial = (typeof CANALES_SOCIALES)[number];

export const esCanalSocial = (c: unknown): c is CanalSocial => c === 'instagram' || c === 'messenger';

/** Cómo se llama la plataforma en Zernio. Messenger es `facebook` (la página de Facebook). */
export type PlataformaZernio = 'instagram' | 'facebook';
export const plataformaDe = (c: CanalSocial): PlataformaZernio => (c === 'instagram' ? 'instagram' : 'facebook');
export const canalDePlataforma = (p: unknown): CanalSocial | null => (p === 'instagram' ? 'instagram' : p === 'facebook' ? 'messenger' : null);

/** El nombre que se lee. */
export const NOMBRE_CANAL: Record<CanalSocial, string> = { instagram: 'Instagram', messenger: 'Messenger' };

/**
 * EL CANAL DE UN PASO, AL GUARDARLO (`setSecuenciaPasos`, lib/nutricion.ts). Hasta el 09/10 era
 * `email` o `whatsapp` y NADA MÁS: un paso de Instagram se guardaba como WhatsApp y el motor se lo
 * mandaba al lead POR WHATSAPP, sin un error. Lo de antes no cambia: un email que no es audio es
 * email, todo lo demás WhatsApp.
 */
export function canalAGuardar(canal: unknown, tipo: unknown): 'email' | 'whatsapp' | CanalSocial {
  if (esCanalSocial(canal)) return canal;
  return canal === 'email' && tipo !== 'audio' ? 'email' : 'whatsapp';
}

// ── La ventana de Meta ───────────────────────────────────────────────────────────

/** Un DM sale dentro de las 24 h del último mensaje de la persona. */
export const VENTANA_META_MS = 24 * 3600_000;
/** La respuesta privada a un comentario: UNA por comentario, dentro de los 7 días. */
export const VENTANA_COMENTARIO_MS = 7 * 24 * 3600_000;

/** Lo que el motor sabe de la conversación del lead en un canal (`ig_conversaciones`). */
export type ConversacionSocial = {
  conversacionId: string | null;
  cuentaId: string | null;
  ventanaExpiraAt: string | null;
  comentarioId: string | null;
  comentarioPostId: string | null;
  comentarioAt: string | null;
  comentarioRespondidoAt: string | null;
};

export type Salida =
  | { via: 'dm'; conversacionId: string; cuentaId: string }
  | { via: 'respuesta_privada'; comentarioId: string; postId: string; cuentaId: string }
  | { via: null; motivo: string; terminal: boolean };

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/**
 * POR DÓNDE PUEDE SALIR UN MENSAJE AL LEAD, AHORA, o por qué no puede. Pura y con test.
 *
 *   · Con la ventana abierta (escribió hace menos de 24 h): un DM en su conversación.
 *   · Si no, con un comentario sin contestar de hace menos de 7 días: la respuesta privada (es el
 *     «comenta y te mando el link» de ManyChat). Una sola por comentario.
 *   · Si no, NO SALE, y es terminal: reintentar no abre la ventana (sólo la abre la persona,
 *     escribiendo, y eso PAUSA la salida y corre la respuesta: lib/flujo-grafo.ts).
 */
export function decidirSalida(c: ConversacionSocial | null, ahoraMs: number, canal: CanalSocial = 'instagram'): Salida {
  const nombre = NOMBRE_CANAL[canal];
  if (!c) return { via: null, motivo: `el lead no tiene una conversación por ${nombre}`, terminal: true };
  const cuenta = (c.cuentaId ?? '').trim();
  if (!cuenta) return { via: null, motivo: `no sé desde qué cuenta de ${nombre} escribirle`, terminal: true };
  const conv = (c.conversacionId ?? '').trim();
  const ventana = ms(c.ventanaExpiraAt);
  if (conv && Number.isFinite(ventana) && ventana > ahoraMs) return { via: 'dm', conversacionId: conv, cuentaId: cuenta };
  const coment = (c.comentarioId ?? '').trim();
  const post = (c.comentarioPostId ?? '').trim();
  const cuando = ms(c.comentarioAt);
  if (coment && post && !c.comentarioRespondidoAt && Number.isFinite(cuando) && ahoraMs - cuando < VENTANA_COMENTARIO_MS) {
    return { via: 'respuesta_privada', comentarioId: coment, postId: post, cuentaId: cuenta };
  }
  if (conv) return { via: null, motivo: `pasaron más de 24 h desde su último mensaje: ${nombre} no deja escribirle`, terminal: true };
  return { via: null, motivo: `el lead no le escribió a la cuenta de ${nombre}`, terminal: true };
}

/** Hasta cuándo se le puede escribir después de un mensaje suyo que llegó en `iso`. */
export const ventanaDesde = (iso: string): string => new Date(ms(iso) + VENTANA_META_MS).toISOString();

// ── Qué se puede mandar ──────────────────────────────────────────────────────────

/**
 * LO QUE INSTAGRAM Y MESSENGER ACEPTAN COMO ADJUNTO, medido en la doc de Zernio (09/10/2026):
 * Instagram toma PNG/JPEG (8 MB), MP4/MOV/WEBM (25 MB) y PDF (25 MB), y RECHAZA el audio MP3 y el
 * OGG/Opus — o sea las notas de voz de la biblioteca de WhatsApp. Por eso el editor social no graba
 * audio. Messenger toma imágenes, videos, audio y archivos.
 */
export function problemaDeAdjunto(canal: CanalSocial, mime: string | null | undefined): string | null {
  const m = (mime ?? '').toLowerCase();
  if (canal === 'instagram') {
    if (m === 'image/jpeg' || m === 'image/png') return null;
    if (m === 'video/mp4' || m === 'video/quicktime' || m === 'video/webm') return null;
    if (m === 'application/pdf') return null;
    return 'Instagram acepta foto, video o PDF';
  }
  if (m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/') || m === 'application/pdf') return null;
  return 'Messenger acepta foto, video, audio o PDF';
}

/** El tipo de adjunto que pide Zernio para un mime. */
export function tipoAdjuntoZernio(mime: string | null | undefined): 'image' | 'video' | 'audio' | 'file' {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'file';
}

/** Instagram corta un mensaje con botones a 640; sin botones, Meta topea en 1000. */
export const TOPE_TEXTO_SOCIAL = 1000;

// ── Los eventos que entran (lo que ManyChat ofrece y lo que Zernio entrega) ──────

/**
 * Qué hizo la persona. `tienda` no lo produce ningún evento (Zernio no lo entrega): existe para que el
 * disparador se dibuje apagado con su nombre. `mencion_historia` sí llega y no lo pidió nadie: no lo
 * escucha ningún disparador, y por eso una mención NO cuenta como «te envía un mensaje».
 */
export type SubtipoSocial =
  | 'mensaje' | 'historia' | 'mencion_historia' | 'comentario' | 'comentario_vivo' | 'anuncio' | 'referencia' | 'qr' | 'tienda';

/**
 * EL CÓDIGO QR ES UN ENLACE DE REFERENCIA, CON UN `ref` QUE EMPIEZA ASÍ. Meta no distingue escanear un
 * QR de tocar el link (los «Messenger Codes» se retiraron): el QR es el link `m.me/<página>?ref=qr-…`
 * dibujado como QR. Convención de la casa, declarada en un solo lugar.
 */
export const PREFIJO_REF_QR = 'qr-';

export type DisparadorSocial = {
  canal: CanalSocial;
  subtipo: SubtipoSocial;
  /** Cómo lo dice ManyChat, traducido. */
  rotulo: string;
  /** Qué evento de Zernio lo trae. */
  evento: string;
  /** false = Zernio no lo entrega: se dibuja apagado con `motivo`. */
  disponible: boolean;
  motivo?: string;
  /** Lo que hay que saber para que funcione (va al comentario de la pantalla, no a la pantalla). */
  ojo?: string;
};

/**
 * LOS DISPARADORES QUE PIDIÓ MARTÍN (la captura de ManyChat), CONTRA LO QUE ZERNIO ENTREGA. Lo
 * consume el editor del CRON (la parte «disparadores» de la sexta tanda): lo que dice
 * `disponible: false` se dibuja apagado, con su motivo. La tabla larga, con la fuente de cada fila,
 * está en docs/hallazgos-chatbot.md («Canales: Instagram y Messenger por Zernio»).
 */
export const DISPARADORES_SOCIALES: readonly DisparadorSocial[] = [
  { canal: 'instagram', subtipo: 'comentario', rotulo: 'Comenta tu publicación o Reel', evento: 'comment.received', disponible: true,
    ojo: 'La respuesta es privada, una sola y dentro de los 7 días. A quien no te sigue sólo le llega texto.' },
  { canal: 'instagram', subtipo: 'historia', rotulo: 'Responde a tu historia', evento: 'message.received (metadata.storyReply)', disponible: true },
  { canal: 'instagram', subtipo: 'mensaje', rotulo: 'Te envía un mensaje', evento: 'message.received', disponible: true },
  { canal: 'instagram', subtipo: 'anuncio', rotulo: 'Hace clic en tu anuncio', evento: 'message.received (metadata.referral.ad_id)', disponible: true,
    ojo: 'Meta manda primero el post del anuncio sin referral y el referral en el mensaje que sigue.' },
  { canal: 'instagram', subtipo: 'comentario_vivo', rotulo: 'Comenta en tu En vivo', evento: 'comment.received (comment.isLive)', disponible: true,
    ojo: 'La respuesta privada sale mientras el En vivo está al aire.' },
  { canal: 'instagram', subtipo: 'referencia', rotulo: 'Hace clic en tu enlace de referencia', evento: 'referral.received / metadata.referral.ref', disponible: true,
    ojo: 'En un chat NUEVO, Instagram manda el ref sólo si la cuenta tiene al menos un Ice Breaker.' },
  { canal: 'messenger', subtipo: 'anuncio', rotulo: 'Hace clic en tu anuncio', evento: 'message.received (metadata.referral.ad_id) / referral.received', disponible: true },
  { canal: 'messenger', subtipo: 'comentario', rotulo: 'Comenta tu publicación', evento: 'comment.received', disponible: true,
    ojo: 'NO medido: el id de quien comenta en Facebook puede no ser el de su chat de Messenger (en Instagram es el mismo IGSID).' },
  { canal: 'messenger', subtipo: 'mensaje', rotulo: 'Te envía un mensaje', evento: 'message.received', disponible: true },
  { canal: 'messenger', subtipo: 'referencia', rotulo: 'Hace clic en tu enlace de referencia', evento: 'referral.received / metadata.referral.ref', disponible: true },
  { canal: 'messenger', subtipo: 'qr', rotulo: 'Escanea un código QR', evento: 'referral.received (ref qr-…)', disponible: true,
    ojo: 'Es un enlace de referencia dibujado como QR: Meta no distingue escanear de tocar.' },
  { canal: 'messenger', subtipo: 'tienda', rotulo: 'Mensajes de tu tienda de Facebook', evento: '—', disponible: false,
    motivo: 'Zernio no avisa los mensajes que llegan desde la tienda' },
];

/** El evento normalizado que sale del webhook: lo que el motor necesita para disparar y responder. */
export type EventoSocial = {
  canal: CanalSocial;
  subtipo: SubtipoSocial;
  /** El id de la persona en esa plataforma (IGSID / PSID; en un comentario, el del autor). */
  participanteId: string;
  nombre: string | null;
  usuario: string | null;
  texto: string | null;
  /** La conversación de Zernio (no existe en un comentario). */
  conversacionId: string | null;
  cuentaId: string | null;
  perfilId: string | null;
  mensajeId: string | null;
  comentarioId: string | null;
  postId: string | null;
  anuncioId: string | null;
  ref: string | null;
  /** Otra app de la página atiende la charla (handover de Meta): se guarda y no se dispara nada. */
  standby: boolean;
  /** Cuándo pasó, como lo dice la plataforma. */
  fecha: string;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** El referral (de `metadata.referral` o de `referral.received`) dice qué subtipo es. */
function subtipoDeReferral(ref: Obj): { subtipo: SubtipoSocial; ref: string | null; anuncioId: string | null } {
  const anuncioId = str(ref.ad_id);
  const r = str(ref.ref);
  if (anuncioId || ref.source === 'ADS') return { subtipo: 'anuncio', ref: r, anuncioId };
  if (r && r.toLowerCase().startsWith(PREFIJO_REF_QR)) return { subtipo: 'qr', ref: r, anuncioId: null };
  return { subtipo: 'referencia', ref: r, anuncioId: null };
}

/**
 * UN CUERPO DEL WEBHOOK DE ZERNIO → EL EVENTO QUE DISPARA, o por qué se ignora. Pura y con test sobre
 * las formas de la doc (docs.zernio.com/webhooks/inbox, medida el 09/10/2026).
 *
 * ⚠️ La forma se midió en la doc del WEBHOOK, no en la API REST: son dos contratos (AGENTS.md). El
 * REST trae `storyReply` en el mensaje; el webhook lo trae en `metadata.storyReply`.
 */
export function eventoSocialDe(body: unknown): { evento: EventoSocial } | { ignorar: string } {
  const b = obj(body);
  if (!b) return { ignorar: 'no es un objeto' };
  const ev = str(b.event) ?? '';
  const cuenta = obj(b.account);
  const cuentaId = str(cuenta?.accountId) ?? str(cuenta?.id);
  const perfilId = str(cuenta?.profileId);
  const fecha = str(b.timestamp) ?? new Date(0).toISOString();

  if (ev === 'message.received') {
    const m = obj(b.message);
    const conv = obj(b.conversation);
    const canal = canalDePlataforma(m?.platform ?? cuenta?.platform);
    if (!m || !canal) return { ignorar: `plataforma ${String(m?.platform ?? '—')}` };
    if (m.direction === 'outgoing') return { ignorar: 'es un mensaje nuestro' };
    const sender = obj(m.sender);
    const participanteId = str(sender?.id) ?? str(conv?.participantId);
    if (!participanteId) return { ignorar: 'sin remitente' };
    const md = obj(b.metadata) ?? {};
    let subtipo: SubtipoSocial = 'mensaje';
    let ref: string | null = null;
    let anuncioId: string | null = null;
    const referral = obj(md.referral);
    const adjuntos = Array.isArray(m.attachments) ? (m.attachments as unknown[]) : [];
    if (referral) ({ subtipo, ref, anuncioId } = subtipoDeReferral(referral));
    else if (canal === 'instagram' && obj(md.storyReply)) subtipo = 'historia';
    else if (canal === 'instagram' && (md.isStoryMention === true || adjuntos.some((a) => obj(a)?.originalType === 'story_mention'))) subtipo = 'mencion_historia';
    return {
      evento: {
        canal, subtipo, participanteId,
        nombre: str(sender?.name) ?? str(conv?.participantName), usuario: str(sender?.username) ?? str(conv?.participantUsername),
        texto: typeof m.text === 'string' ? m.text : null,
        conversacionId: str(conv?.id) ?? str(m.conversationId), cuentaId, perfilId, mensajeId: str(m.id),
        comentarioId: null, postId: null, anuncioId, ref, standby: md.standby === true,
        fecha: str(m.sentAt) ?? fecha,
      },
    };
  }

  if (ev === 'referral.received') {
    const referral = obj(b.referral);
    const conv = obj(b.conversation);
    const canal = canalDePlataforma(cuenta?.platform);
    const sender = obj(b.sender);
    const participanteId = str(sender?.id) ?? str(conv?.participantId);
    if (!referral || !canal || !participanteId) return { ignorar: 'referral incompleto' };
    const r = subtipoDeReferral(referral);
    return {
      evento: {
        canal, subtipo: r.subtipo, participanteId, nombre: str(conv?.participantName), usuario: str(conv?.participantUsername), texto: null,
        conversacionId: str(conv?.id), cuentaId, perfilId, mensajeId: null, comentarioId: null, postId: null,
        anuncioId: r.anuncioId, ref: r.ref, standby: false, fecha,
      },
    };
  }

  if (ev === 'comment.received') {
    const c = obj(b.comment);
    const canal = canalDePlataforma(c?.platform ?? cuenta?.platform);
    if (!c || !canal) return { ignorar: `plataforma ${String(c?.platform ?? '—')}` };
    const autor = obj(c.author);
    if (autor?.isOwnAccount === true) return { ignorar: 'es un comentario de la cuenta' };
    const participanteId = str(autor?.id);
    const comentarioId = str(c.id);
    const postId = str(c.platformPostId);
    if (!participanteId || !comentarioId || !postId) return { ignorar: 'comentario incompleto' };
    return {
      evento: {
        canal, subtipo: c.isLive === true && canal === 'instagram' ? 'comentario_vivo' : 'comentario', participanteId,
        nombre: str(autor?.name), usuario: str(autor?.username), texto: typeof c.text === 'string' ? c.text : null,
        conversacionId: null, cuentaId, perfilId, mensajeId: null, comentarioId, postId,
        anuncioId: str(obj(c.ad)?.id), ref: null, standby: false, fecha: str(c.createdAt) ?? fecha,
      },
    };
  }

  return { ignorar: `evento ${ev || '—'}` };
}

/** El nombre con que nace el lead: el de la persona, o su usuario, o la plataforma. */
export function nombreDeParticipante(e: Pick<EventoSocial, 'nombre' | 'usuario' | 'canal'>): string {
  return e.nombre ?? (e.usuario ? `@${e.usuario.replace(/^@/, '')}` : `Contacto de ${NOMBRE_CANAL[e.canal]}`);
}

/**
 * EL ENLACE DE REFERENCIA de una cuenta: `ig.me/m/<usuario>?ref=…` o `m.me/<página>?ref=…`. Lo usa el
 * editor del CRON para mostrar qué compartir (y el QR, que es este link dibujado).
 */
export function linkDeReferencia(canal: CanalSocial, usuarioCuenta: string, ref: string): string {
  const u = encodeURIComponent(usuarioCuenta.replace(/^@/, '').trim());
  const r = encodeURIComponent(ref.trim());
  return canal === 'instagram' ? `https://ig.me/m/${u}?ref=${r}` : `https://m.me/${u}?ref=${r}`;
}

// ── Cómo se ven ──────────────────────────────────────────────────────────────────

/**
 * LA IDENTIDAD DE CADA APP (CRON 5: «que tenga sus colores y que la interfaz editable y "probar" se
 * parezcan a Instagram»). Los colores de marca se MEZCLAN con tokens que se redefinen en oscuro
 * (`color-mix` con `--surface`, `--border`, `--ink`), nunca solos: un `#D62976` puro de fondo en
 * oscuro es un rectángulo fosforescente (la misma regla que la tarjeta de WhatsApp, `identidadDeTarjeta`
 * en app/_components/Lienzo.tsx).
 */
export const IDENTIDAD_SOCIAL: Record<CanalSocial, {
  fondo: string; borde: string; titulo: string;
  /** La burbuja que sale (del negocio) y su texto. */
  burbuja: string; burbujaTexto: string;
  /** El degradé del logo. */
  degradado: string;
}> = {
  instagram: {
    fondo: 'color-mix(in srgb, #D62976 5%, var(--surface))',
    borde: 'color-mix(in srgb, #D62976 40%, var(--border))',
    titulo: 'color-mix(in srgb, #C13584 80%, var(--ink))',
    // La burbuja de Instagram que sale es el degradé violeta-azul de su DM.
    burbuja: 'linear-gradient(135deg, #8134AF 0%, #5B51D8 55%, #405DE6 100%)',
    burbujaTexto: '#FFFFFF',
    degradado: 'linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)',
  },
  messenger: {
    fondo: 'color-mix(in srgb, #0084FF 6%, var(--surface))',
    borde: 'color-mix(in srgb, #0084FF 45%, var(--border))',
    titulo: 'color-mix(in srgb, #0068D6 80%, var(--ink))',
    burbuja: 'linear-gradient(180deg, #00B2FF 0%, #006AFF 100%)',
    burbujaTexto: '#FFFFFF',
    degradado: 'linear-gradient(45deg, #0099FF 0%, #A033FF 60%, #FF5280 90%, #FF7061 100%)',
  },
};

/** Los glifos oficiales (simple-icons 13.21.0, `instagram` y `messenger`), en blanco sobre el degradé. */
export const GLIFO_SOCIAL: Record<CanalSocial, string> = {
  instagram: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  messenger: 'M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z',
};

/** El logo como `data:` SVG (el ＋ del lienzo y la cabecera de «Probar», que dibujan un `<img>`). */
export function logoSocialSvg(canal: CanalSocial): string {
  const [a, b] = canal === 'instagram' ? ['#F58529', '#8134AF'] : ['#00B2FF', '#A033FF'];
  const cuerpo = `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="24" height="24" rx="6" fill="url(#g)"/><g transform="translate(4.5 4.5) scale(0.625)"><path fill="#fff" d="${GLIFO_SOCIAL[canal]}"/></g>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${cuerpo}</svg>`)}`;
}
