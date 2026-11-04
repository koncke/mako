// =============================================================================
// grabar-llamada-reglas — grabar una llamada desde MaKo: lo que se decide SIN la base (puro, sin server-only)
// =============================================================================
// Pedido de Martín (04/11/2026): «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard
// template que sea "Call Calling"». El botón graba en el navegador, el audio queda en el lead, y MaKo lo transcribe y lo
// analiza con el Closing. Lo lee la pantalla (app/_components/grabar/), el server (lib/grabar-llamada.ts) y los tests.
//
// Lo que no se ve en la firma:
//   · EL AUDIO VA EN PARTES de `SEGUNDOS_POR_PARTE`, cada una un archivo ENTERO (el grabador se reinicia). Un trozo del medio
//     de un MediaRecorder no se puede abrir solo (le falta la cabecera), y una llamada de una hora no entra en un pedido a
//     Vercel (~4,5 MB). Con partes, lo grabado hasta un corte queda guardado y cada parte se transcribe por su lado.
//   · LA TRANSCRIPCIÓN SALE CON SU MINUTO: cada parte lleva dónde empieza (`inicio_seg`), y el Closing cita «[mm:ss]».
//   · LO QUE NO SE PUEDE GRABAR SE DICE, EN UNA LÍNEA (`queSeGraba`). Medido en la documentación de cada plataforma
//     (docs/relevo/nube-grabar.md): una llamada TELEFÓNICA no se graba desde el mismo teléfono (Android le da silencio a
//     cualquier app mientras hay una llamada; iOS corta el micrófono de la página), y el otro lado de una llamada por
//     computadora sólo se oye si se comparte la pestaña (Chrome y Edge; Safari y Firefox no dan el audio de una pestaña).
//   · EL TIPO DEL ARCHIVO SE MIRA EN SUS PRIMEROS BYTES, no en lo que dice el navegador (`mimeDeBytes`).
// =============================================================================

import { claveDeReunion, type Reunion, type TurnoReunion } from './grabadores/reunion';

/** Cada parte: un archivo entero. 3 min de opus a 32 kbps son ~0,7 MB; de AAC a 128 kbps (Safari), ~2,9 MB: entra en Vercel. */
export const SEGUNDOS_POR_PARTE = 180;
/** El tope de una llamada: 2 horas (40 partes). Una grabación olvidada no sigue para siempre. */
export const MAX_SEGUNDOS = 2 * 3600;
export const MAX_PARTES = Math.ceil(MAX_SEGUNDOS / SEGUNDOS_POR_PARTE);
/** Lo que acepta la ruta por parte (Vercel corta en ~4,5 MB). */
export const TOPE_BYTES_PARTE = 4_000_000;
/** Los bits por segundo que se le piden al grabador (opus de voz). El navegador puede ignorarlo (Safari). */
export const BITS_POR_SEGUNDO = 32_000;

/** Lo que se le recuerda a quien graba, en la pantalla, ANTES de empezar (grabar a alguien pide avisarle). */
export const AVISO_CONSENTIMIENTO = 'Avísale que estás grabando.';

/** Los tipos en el orden en que se prueban (`MediaRecorder.isTypeSupported`). Chrome y Firefox: webm/opus; Safari: mp4/AAC. */
export const MIMES_GRABACION = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'] as const;

/** El primer tipo que el navegador sabe grabar, o null (el navegador no graba audio). */
export function elegirMime(soporta: (mime: string) => boolean): string | null {
  for (const m of MIMES_GRABACION) {
    try { if (soporta(m)) return m; } catch { /* un navegador viejo que tira: probar el siguiente */ }
  }
  return null;
}

/** El tipo base de un archivo de audio, por sus primeros bytes. null = no es uno de los que se graban acá. */
export function mimeDeBytes(b: Uint8Array): 'audio/webm' | 'audio/mp4' | 'audio/ogg' | null {
  if (b.length < 12) return null;
  // EBML (Matroska/WebM)
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';
  // OggS
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  // ISO BMFF: «ftyp» en el byte 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'audio/mp4';
  return null;
}

export const extDeMime = (mime: string): string => (mime.startsWith('audio/mp4') ? 'm4a' : mime.startsWith('audio/ogg') ? 'ogg' : 'webm');

/** La ruta de una parte en el bucket privado: `<ws>/<grabación>/<n>.<ext>`. El id de la grabación es un uuid. */
export function rutaDeParte(ws: number, grabacionId: string, n: number, mime: string): string | null {
  if (!Number.isSafeInteger(ws) || ws <= 0) return null;
  if (!esIdGrabacion(grabacionId)) return null;
  if (!Number.isInteger(n) || n < 0 || n >= MAX_PARTES) return null;
  return `${ws}/${grabacionId.toLowerCase()}/${n}.${extDeMime(mime)}`;
}

export const esIdGrabacion = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ── Cómo terminó: lo dice la PERSONA, con un toque ──────────────────────────────────────────────────────────────────────

export const RESULTADOS = ['no_contesto', 'hablo', 'agendo', 'no_interesa'] as const;
export type ResultadoLlamada = (typeof RESULTADOS)[number];
export const ROTULO_RESULTADO: Readonly<Record<ResultadoLlamada, string>> = {
  no_contesto: 'No contestó', hablo: 'Habló', agendo: 'Agendó', no_interesa: 'No le interesa',
};
export const esResultado = (v: unknown): v is ResultadoLlamada => typeof v === 'string' && (RESULTADOS as readonly string[]).includes(v);
/** ¿Hubo conversación? «No contestó» es la única que no. Lo cuenta Cold Calling («Contestaron»). */
export const contesto = (r: ResultadoLlamada | null | undefined): boolean => r === 'hablo' || r === 'agendo' || r === 'no_interesa';

export const ORIGENES = ['ficha', 'cold-calling'] as const;
export type OrigenGrabacion = (typeof ORIGENES)[number];
export const esOrigen = (v: unknown): v is OrigenGrabacion => typeof v === 'string' && (ORIGENES as readonly string[]).includes(v);

export type FuenteAudio = 'microfono' | 'microfono_y_pestana';

// ── Lo que se puede grabar en este aparato ─────────────────────────────────────────────────────────────────────────────

export type Entorno = {
  /** ¿Existe MediaRecorder y getUserMedia? Sin eso no se graba nada. */
  graba: boolean;
  /** Un teléfono o una tablet (la pantalla, no el user agent: un iPad pide la vista de computadora). */
  telefono: boolean;
  /** ¿El navegador puede dar el audio de una pestaña? (getDisplayMedia; en la práctica Chrome y Edge de computadora). */
  pestana: boolean;
};

export type QueSeGraba = { puede: boolean; ofrecePestana: boolean; linea: string };

/**
 * Qué se graba acá, y la UNA línea que lo dice. La línea dice lo que NO se puede, que es lo que la persona no sabe.
 */
export function queSeGraba(e: Entorno): QueSeGraba {
  if (!e.graba) return { puede: false, ofrecePestana: false, linea: 'Este navegador no graba audio. Usa Chrome, Edge o Safari al día.' };
  if (e.telefono) return { puede: true, ofrecePestana: false, linea: 'Graba el micrófono. Una llamada de este mismo teléfono no se graba: hazla en otro aparato y en altavoz.' };
  if (e.pestana) return { puede: true, ofrecePestana: true, linea: 'Para que se oiga al otro lado, comparte la pestaña de la llamada (Meet, Zoom web).' };
  return { puede: true, ofrecePestana: false, linea: 'Graba sólo tu micrófono: pon la llamada en altavoz para que se oiga al otro lado.' };
}

// ── Las partes y su transcripción ──────────────────────────────────────────────────────────────────────────────────────

export type EstadoParte = 'pendiente' | 'lista' | 'sin_ia' | 'error';
export type ParteGuardada = { n: number; inicio_seg: number; segundos: number | null; estado: EstadoParte; texto: string | null; motivo?: string | null };

/** La transcripción de la llamada: una línea por parte con texto, en orden, con el segundo en que empieza. */
export function turnosDePartes(partes: readonly ParteGuardada[]): TurnoReunion[] {
  return [...partes]
    .sort((a, b) => a.n - b.n)
    .filter((p) => p.estado === 'lista' && (p.texto ?? '').trim())
    .map((p) => ({ hablante: null, email: null, texto: (p.texto ?? '').trim(), segundo: Math.max(0, Math.floor(p.inicio_seg)) }));
}

export type QueSigue =
  /** Faltan partes por llegar o por transcribir. */
  | { tipo: 'esperar' }
  /** Todas llegaron y se transcribieron: a analizar. `vacia`: no se oyó nada en ninguna. */
  | { tipo: 'analizar'; vacia: boolean }
  /** Alguna parte no se pudo transcribir. `sinIa`: porque el negocio no tiene con qué. */
  | { tipo: 'trabada'; sinIa: boolean; motivo: string };

/**
 * Qué sigue con una llamada que ya terminó (la pantalla dijo cuántas partes mandó). Mientras no terminó, siempre esperar: la
 * última parte todavía se está grabando.
 */
export function queSigue(partes: readonly ParteGuardada[], partesTotal: number | null): QueSigue {
  if (partesTotal == null) return { tipo: 'esperar' };
  const porN = new Map(partes.map((p) => [p.n, p]));
  for (let n = 0; n < partesTotal; n++) {
    const p = porN.get(n);
    if (!p || p.estado === 'pendiente') return { tipo: 'esperar' };
  }
  const malas = [...porN.values()].filter((p) => p.n < partesTotal && (p.estado === 'sin_ia' || p.estado === 'error'));
  if (malas.length) {
    const sinIa = malas.every((p) => p.estado === 'sin_ia');
    return { tipo: 'trabada', sinIa, motivo: malas[0].motivo?.trim() || (sinIa ? SIN_IA_PARA_TRANSCRIBIR : 'No pude transcribir una parte del audio.') };
  }
  const vacia = turnosDePartes(partes.filter((p) => p.n < partesTotal)).length === 0;
  return { tipo: 'analizar', vacia };
}

/** Lo que dice una llamada cuyo negocio no tiene con qué transcribir. El audio NO se pierde. */
export const SIN_IA_PARA_TRANSCRIBIR = 'El audio quedó guardado. Para transcribirlo, conecta tu IA (GPT, Gemini o Groq).';
/** Lo que dice una llamada sin Claude para analizarla: la transcripción sí está. */
export const SIN_CLAUDE_PARA_ANALIZAR = 'Transcrita. Para el análisis, conecta tu Claude.';

// ── Lo que dice la pantalla de una grabación ───────────────────────────────────────────────────────────────────────────

export type EstadoGrabacion = 'grabando' | 'transcribiendo' | 'analizando' | 'lista' | 'sin_ia' | 'error';
export const ESTADOS_GRABACION: readonly EstadoGrabacion[] = ['grabando', 'transcribiendo', 'analizando', 'lista', 'sin_ia', 'error'];

/** El rótulo corto del estado (la pastilla de la fila). */
export const ROTULO_ESTADO: Readonly<Record<EstadoGrabacion, string>> = {
  grabando: 'Grabando', transcribiendo: 'Transcribiendo', analizando: 'Analizando', lista: 'Lista', sin_ia: 'Sin IA', error: 'Con error',
};

/** ¿Se puede volver a intentar? Lo que se trabó (la IA no contestó, el negocio la conectó después). */
export const sePuedeReintentar = (estado: EstadoGrabacion): boolean => estado === 'sin_ia' || estado === 'error';
/** ¿Sigue trabajando? (la pantalla vuelve a preguntar). */
export const sigueTrabajando = (estado: EstadoGrabacion): boolean => estado === 'transcribiendo' || estado === 'analizando';

/** «12:05» o «1:02:05». */
export function duracionTexto(seg: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dd = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(r)}` : `${m}:${dd(r)}`;
}

/** El título de la llamada para el Closing (no lleva el nombre del lead: ese viaja aparte, con su id). */
export const tituloDeLlamada = (origen: OrigenGrabacion): string => (origen === 'cold-calling' ? 'Llamada en frío (grabada en MaKo)' : 'Llamada grabada en MaKo');

// ── La llamada como una reunión, para el Closing ───────────────────────────────────────────────────────────────────────


export type FilaGrabacion = {
  id: string; lead_id: number; origen: OrigenGrabacion; autor: string | null; estado: EstadoGrabacion;
  duracion_seg: number | null; created_at: string; terminada_at: string | null;
};

/** La clave de la llamada en el Closing (`closing_analyses.recording_id`): negativa, como la de cualquier grabador que no es Fathom. */
export const claveDeGrabacion = (id: string): number => claveDeReunion('grabadora', id.toLowerCase());

/**
 * La llamada en la forma común de las reuniones (lib/grabadores/reunion.ts): lo que lee el Closing. Sin invitados ni emails (el
 * lead lo fija quien grabó, `analizarReunionDeLead`); el anfitrión es quien grabó, que es el closer de la llamada.
 */
export function reunionDeGrabacion(f: FilaGrabacion, partes: readonly ParteGuardada[]): Reunion {
  const id = f.id.toLowerCase();
  const inicio = f.created_at;
  const fin = f.duracion_seg != null && Number.isFinite(Date.parse(inicio))
    ? new Date(Date.parse(inicio) + f.duracion_seg * 1000).toISOString()
    : f.terminada_at;
  const r: Reunion = {
    grabador: 'grabadora', id, clave: claveDeGrabacion(id), titulo: tituloDeLlamada(f.origen),
    inicio, fin, programada: null, aparecio: inicio, invitados: [],
    anfitrion: f.autor ? { nombre: f.autor, email: null } : null,
    link: null, linkCompartido: null,
    transcripcion: turnosDePartes(partes), resumen: null, acciones: [],
  };
  return r;
}

// ── Lo que cuenta el Dashboard (la plantilla Cold Calling) ─────────────────────────────────────────────────────────────

/** De dónde se grabó, como lo lee la persona. */
export const ROTULO_ORIGEN: Readonly<Record<OrigenGrabacion, string>> = { ficha: 'Desde la ficha', 'cold-calling': 'En frío' };
/** Una llamada que todavía no tiene «cómo terminó» (se está grabando, o se cortó sin elegir). Se cuenta, y se dice. */
export const SIN_MARCAR = 'Sin marcar';
/** El orden fijo de los resultados en un gráfico: de lo mejor a lo que falta marcar. */
export const VALORES_RESULTADO: readonly string[] = [
  ROTULO_RESULTADO.agendo, ROTULO_RESULTADO.hablo, ROTULO_RESULTADO.no_interesa, ROTULO_RESULTADO.no_contesto, SIN_MARCAR,
];
export const COLORES_RESULTADO: Readonly<Record<string, string>> = {
  [ROTULO_RESULTADO.agendo]: 'var(--good)', [ROTULO_RESULTADO.hablo]: 'var(--primary)', [ROTULO_RESULTADO.no_interesa]: 'var(--bad)',
  [ROTULO_RESULTADO.no_contesto]: 'var(--faint)', [SIN_MARCAR]: 'var(--dim)',
};

export type GrabacionParaContar = {
  lead_id: number | string; origen: string; autor: string | null; estado: string;
  resultado: string | null; duracion_seg: number | null; created_at: string;
};
/** Una fila del agregador del Dashboard (la forma de `Fila`, lib/graficos-agregar.ts). */
export type FilaLlamadaGrabada = {
  f: string | null; d: Record<string, string | null>; r: Record<string, string | null>; v: Record<string, number>; u: Record<string, string | null>;
};

/**
 * Una llamada grabada → la fila que cuenta el Dashboard. «Contestaron» sale de lo que marcó la PERSONA (`contesto`): una llamada
 * sin marcar NO cuenta como contestada ni como no contestada, cuenta en «Sin marcar». Los minutos son los grabados (con el timbre
 * de una que no contestó adentro). `fecha` es el día de la llamada ya pasado a la zona del Dashboard; `lead`, su nombre.
 */
export function filaDeLlamadaGrabada(x: GrabacionParaContar, o: { fecha: string | null; lead: string | null }): FilaLlamadaGrabada {
  const r = esResultado(x.resultado) ? x.resultado : null;
  const leadId = String(x.lead_id);
  const seg = typeof x.duracion_seg === 'number' && Number.isFinite(x.duracion_seg) && x.duracion_seg > 0 ? x.duracion_seg : 0;
  const estado = (ESTADOS_GRABACION as readonly string[]).includes(x.estado) ? (x.estado as EstadoGrabacion) : null;
  return {
    f: o.fecha,
    d: {
      resultado: r ? ROTULO_RESULTADO[r] : SIN_MARCAR,
      origen: esOrigen(x.origen) ? ROTULO_ORIGEN[x.origen] : null,
      autor: x.autor?.trim() || null,
      lead: o.lead?.trim() || `Lead #${leadId}`,
      estado: estado ? ROTULO_ESTADO[estado] : null,
    },
    r: { lead: leadId },
    v: {
      llamadas: 1,
      contestaron: contesto(r) ? 1 : 0,
      agendaron: r === 'agendo' ? 1 : 0,
      no_interesa: r === 'no_interesa' ? 1 : 0,
      no_contesto: r === 'no_contesto' ? 1 : 0,
      sin_marcar: r ? 0 : 1,
      minutos: seg / 60,
      transcritas: estado === 'lista' || estado === 'analizando' ? 1 : 0,
    },
    u: { leads_llamados: leadId },
  };
}
