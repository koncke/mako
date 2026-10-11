// =============================================================================
// offer-reglas — lo que el CÓDIGO decide sobre lo que escribe el modelo en la tab Offer
// =============================================================================
// SIN `server-only` A PROPÓSITO: es lógica pura y la importa el test (tests/offer-reglas.test.ts).
// Acá vive la SEGUNDA CAPA de cada regla del marco (AGENTS.md «Una regla en un prompt no es una
// regla»): el prompt le pide al modelo que acierte, y esto corrige lo que no acertó.
//
// Qué decide el código y nunca el modelo:
//   · Qué es una respuesta usable (`parseTurno`, `parseDiagnostico`, `parsePropuesta`). Son los MISMOS
//     parsers que usa el `validar` de la cascada (lib/offer-ia.ts): si el validador y el consumidor
//     leyeran distinto, la cascada aceptaría una salida que después se tira.
//   · Si ya se puede concluir (`faltanMinimas` de lib/offer-marco.ts) y si se ofrece «Armar mi oferta»
//     (`opcionesConCierre`). El `listo` del modelo es una opinión; la barra de progreso y el botón
//     salen de las piezas.
//   · El total, el cuello de botella y si la oferta está lista (`calcularDiagnostico`). Un promedio que
//     calcula un modelo es un número que puede no cerrar con las notas de al lado.
//   · Lo que el dueño NUNCA dio no se afirma (`aplicarReglasPropuesta`): urgencia, cifras de prueba y
//     valores de bonos quedan «[completar]».
//
// Las keys de piezas y dimensiones, los tipos y el marco viven en lib/offer-marco.ts (no se tocan
// desde acá: es el contrato que comparten la pantalla, el PDF y este motor).
// =============================================================================

import { parseJsonObject } from './json-del-modelo';
import { urgenciaUsable, type UrgenciaTipo } from './oferta-modelo';
import {
  DIMENSION_IDS, DIMENSIONES_CRITICAS, MARCA_COMPLETAR, PIEZAS, PREGUNTAS_GUIA,
  dimensionLabel, esDimensionId, esPiezaKey, faltanMinimas, piezaLabel,
  type AdjuntoVista, type BonoPropuesto, type CalculoDiagnostico, type CambioPropuesto, type DiagnosticoOferta,
  type DimensionId, type EcuacionFila, type Entregable, type FaseRuta, type FuentePieza,
  type NotaDimension, type OfferMensaje, type PiezaKey, type PiezaSabida, type PiezasSabidas,
  type PropuestaOferta, type VariableValor,
} from './offer-marco';

// ── Topes ────────────────────────────────────────────────────────────────────
// Cada uno es lo que el texto PUEDE ocupar donde se dibuja o se reinyecta, no un número estético:
// una pieza viaja en CADA turno (piezasParaPrompt) y el contexto entero tiene que entrar en el modelo.

/** Lo que dice MaKo en un turno: de 1 a 3 frases. 700 caracteres es el techo de «tres frases largas». */
export const TOPE_RESPUESTA = 700;
/** Una opción de respuesta rápida: es un botón, no un párrafo. */
export const TOPE_OPCION = 60;
export const MAX_OPCIONES = 4;
/** Lo que MaKo anota de una pieza (con las palabras del dueño). */
export const TOPE_PIEZA = 400;
/** La opción que cierra la conversación. La pantalla la reconoce por este texto exacto. */
export const OPCION_ARMAR = 'Armar mi oferta';

// ── Helpers de texto ─────────────────────────────────────────────────────────

/** Colapsa espacios y saltos de línea. Para piezas y opciones, que se dibujan en una línea. */
const colapsar = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Recorta en el último espacio antes del tope y marca el corte. Nunca a mitad de palabra. */
export function recortar(s: string, tope: number): string {
  if (s.length <= tope) return s;
  const corte = s.slice(0, tope - 1);
  const esp = corte.lastIndexOf(' ');
  return `${(esp > tope * 0.6 ? corte.slice(0, esp) : corte).trimEnd()}…`;
}

/** Texto de un campo: recortado, sin espacios de más (conserva los saltos de línea). */
const texto = (v: unknown, tope: number): string => {
  if (typeof v !== 'string') return '';
  const t = v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t ? recortar(t, tope) : '';
};

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** El objeto que trajo el modelo: acepta el texto crudo (lo repara `parseJsonObject`) o ya parseado. */
function aObjeto(raw: unknown): Record<string, unknown> | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try { o = parseJsonObject(raw); } catch { return null; }
  }
  return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
}

/**
 * ¿El modelo volcó su RAZONAMIENTO en vez de la respuesta?
 *
 * Los modelos «de razonamiento» de la cascada gratis (gpt-oss, los thinking de Gemini) a veces
 * escriben lo que piensan —en inglés y comentando la consigna— adentro del campo de la respuesta.
 * Es el mismo caso que ya rechaza el panorama del Archivero (`pareceRazonamiento`, lib/onboarding.ts),
 * con dos frases más en español: MaKo le habla de «tú» al dueño, así que «el usuario» o «debo
 * responder» en la respuesta delatan una nota interna. Rechazarlo hace que la cascada pruebe el
 * siguiente proveedor en vez de mostrárselo al cliente.
 */
export function pareceRazonamiento(t: string): boolean {
  const head = t.slice(0, 500).toLowerCase();
  if (/<\/?think>/.test(head)) return true;
  // Las de español sólo AL PRINCIPIO: «¿quién es el usuario final de tu app?» es una pregunta legítima
  // para un negocio de software, y rechazarla dejaría a ese negocio sin respuesta de ningún proveedor.
  return /\b(the user|we need to|let me|i should|i need to|i will|i'll|the instruction|as an ai|okay,? (so|the|let)|reasoning:|analysis:|thought:)\b/.test(head)
    || /^\s*(el usuario|debo (responder|devolver|contestar|preguntar))\b/.test(head);
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/** «sin dato: …» es lo que se anota cuando el dueño no sabe algo (regla del turno). */
export const esSinDato = (valor: string): boolean => /^\s*sin dato\b/i.test(valor);

/**
 * ¿La pieza tiene ALGO anotado? Incluye «sin dato»: es lo que decide si se vuelve a PREGUNTAR, y
 * re-preguntar lo que el dueño ya dijo que no sabe es exactamente la fricción que el turno prohíbe.
 */
export const piezaAnotada = (piezas: PiezasSabidas, k: PiezaKey): boolean => !!piezas[k]?.valor?.trim();

/**
 * ¿El dueño DIO este dato? «sin dato» NO cuenta. Es lo que decide qué puede afirmar la propuesta:
 * una urgencia, una cifra de casos o el valor de un bono sólo se escriben si salieron de él.
 */
export const tieneDato = (piezas: PiezasSabidas, k: PiezaKey): boolean => {
  const v = piezas[k]?.valor?.trim();
  return !!v && !esSinDato(v);
};

/** Lo que el modelo anotó de las piezas en un turno: sólo keys válidas, texto corto. */
function limpiarPiezas(v: unknown): Partial<Record<PiezaKey, string>> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Partial<Record<PiezaKey, string>> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!esPiezaKey(k)) continue;
    // El modelo a veces devuelve {valor: "…"} en vez del texto pelado: se acepta igual.
    const val = colapsar(typeof raw === 'string' ? raw : (raw as { valor?: unknown } | null)?.valor);
    if (val) out[k] = recortar(val, TOPE_PIEZA);
  }
  return out;
}

/**
 * Suma lo nuevo a lo que MaKo ya sabe.
 *
 * Lo nuevo GANA (el dueño corrigió algo que se sabía del negocio, o un documento lo precisa), con una
 * excepción: un «sin dato» no pisa un dato real. Si el negocio ya tenía el precio cargado y el modelo
 * escribe «sin dato: no sabe» porque el dueño dudó en el chat, borrar el precio sería perder algo que
 * sí se sabía.
 */
export function mergePiezas(
  sabidas: PiezasSabidas,
  nuevas: Partial<Record<PiezaKey, string>> | PiezasSabidas | null | undefined,
  fuente: FuentePieza,
  at: string = new Date().toISOString(),
): PiezasSabidas {
  const out: PiezasSabidas = { ...sabidas };
  for (const [k, raw] of Object.entries(nuevas ?? {})) {
    if (!esPiezaKey(k)) continue;
    const valor = recortar(colapsar(typeof raw === 'string' ? raw : (raw as PiezaSabida | null)?.valor), TOPE_PIEZA);
    if (!valor) continue;
    const previa = out[k];
    if (esSinDato(valor) && previa?.valor?.trim() && !esSinDato(previa.valor)) continue;
    out[k] = { valor, fuente, at };
  }
  return out;
}

/** Las piezas tal como vuelven de la base (jsonb): lo que no tenga la forma, se descarta. */
export function sanearPiezas(raw: unknown): PiezasSabidas {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PiezasSabidas = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!esPiezaKey(k) || !v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const valor = colapsar(o.valor);
    if (!valor) continue;
    const fuente: FuentePieza = o.fuente === 'negocio' || o.fuente === 'doc' ? o.fuente : 'chat';
    out[k] = { valor, fuente, at: typeof o.at === 'string' ? o.at : '' };
  }
  return out;
}

/** Los mensajes tal como vuelven de la base. Un mensaje sin texto ni adjuntos no se dibuja. */
export function sanearMensajes(raw: unknown): OfferMensaje[] {
  if (!Array.isArray(raw)) return [];
  const out: OfferMensaje[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    const de = o.de === 'yo' ? 'yo' : o.de === 'mako' ? 'mako' : null;
    if (!de || typeof o.id !== 'string') continue;
    const adjuntos = sanearAdjuntos(o.adjuntos);
    const t = typeof o.texto === 'string' ? o.texto : '';
    if (!t.trim() && !adjuntos.length) continue;
    const opciones = Array.isArray(o.opciones) ? o.opciones.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
    out.push({
      id: o.id, de, texto: t, at: typeof o.at === 'string' ? o.at : '',
      ...(opciones.length ? { opciones } : {}),
      ...(adjuntos.length ? { adjuntos } : {}),
    });
  }
  return out;
}

/** Un documento leído, como se guarda en `offer_sesiones.documentos` (con su texto). */
export type DocumentoGuardado = { id: string; nombre: string; via: string; texto: string; chars: number; aviso?: string; at: string };

/** Tope del texto que se guarda de un documento. */
export const TOPE_TEXTO_DOC = 40_000;
/** Cuántos documentos admite una conversación. */
export const MAX_DOCS_SESION = 12;

export function sanearDocumentos(raw: unknown): DocumentoGuardado[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentoGuardado[] = [];
  for (const d of raw) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.nombre !== 'string') continue;
    const t = typeof o.texto === 'string' ? o.texto : '';
    out.push({
      id: o.id, nombre: o.nombre, via: typeof o.via === 'string' ? o.via : 'texto', texto: t,
      chars: typeof o.chars === 'number' && Number.isFinite(o.chars) ? o.chars : t.length,
      ...(typeof o.aviso === 'string' && o.aviso.trim() ? { aviso: o.aviso } : {}),
      at: typeof o.at === 'string' ? o.at : '',
    });
  }
  return out;
}

/** Lo que de un documento ve la pantalla: todo MENOS el texto. */
export const adjuntoDe = (d: DocumentoGuardado): AdjuntoVista => ({
  id: d.id, nombre: d.nombre, via: d.via, chars: d.chars, ...(d.aviso ? { aviso: d.aviso } : {}),
});

function sanearAdjuntos(raw: unknown): AdjuntoVista[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && typeof (a as { id?: unknown }).id === 'string')
    .map((a) => ({
      id: a.id as string,
      nombre: typeof a.nombre === 'string' ? a.nombre : 'documento',
      via: typeof a.via === 'string' ? a.via : 'texto',
      chars: typeof a.chars === 'number' ? a.chars : 0,
      ...(typeof a.aviso === 'string' && a.aviso.trim() ? { aviso: a.aviso } : {}),
    }));
}

/** Los rótulos de las piezas mínimas que faltan, para decírselo al dueño en una frase. */
export const faltanTexto = (piezas: PiezasSabidas): string =>
  faltanMinimas(piezas).map((k) => piezaLabel(k).toLowerCase()).join(', ');

/**
 * Lo que MaKo ya sabe del negocio ANTES de la primera pregunta: la oferta principal que el negocio
 * cargó (onboarding, editor de ofertas). Determinista: no llama a ninguna IA.
 *
 * El tipo de la entrada es estructural (no se importa de lib/oferta-modelo.ts) para que esta función
 * sólo dependa de lo que lee. El precio es TEXTO libre (`oferta_ticket` lo es en 4 de 6 negocios
 * medidos): se copia tal cual, nunca se parsea.
 */
export type EntradaSemilla = {
  campos?: { precio?: string | null; promesa?: string | null; incluye?: string | null; garantia?: string | null } | null;
  oferta?: {
    para_quien?: string | null; objeciones?: string | null; prueba?: string | null;
    bonos?: Array<{ nombre?: string | null }> | null;
    urgencia_dato?: string | null; urgencia_razon?: string | null;
    urgencia_tipo?: UrgenciaTipo | null; urgencia_hasta?: string | null;
  } | null;
  /** «Hoy» para decidir si la urgencia de la oferta sigue vigente (inyectable para los tests). */
  hoy?: Date;
};

export function semillaDePiezas(e: EntradaSemilla, at: string = new Date().toISOString()): PiezasSabidas {
  const c = e.campos ?? {};
  const o = e.oferta ?? {};
  const bonos = (o.bonos ?? []).map((b) => colapsar(b?.nombre)).filter(Boolean).join(' · ');
  // Una urgencia que ya venció (una cohorte que arrancó el mes pasado) NO cuenta como sabida: si
  // contara, MaKo no la preguntaría y la oferta nueva daría como razón para decidir hoy una fecha que
  // ya pasó. `urgenciaUsable` es la regla determinista que ya existía para eso (lib/oferta-modelo.ts).
  const vigente = urgenciaUsable({ urgencia_tipo: o.urgencia_tipo ?? null, urgencia_dato: o.urgencia_dato ?? null, urgencia_hasta: o.urgencia_hasta ?? null }, e.hoy ?? new Date());
  const urgencia = vigente ? [colapsar(o.urgencia_dato), colapsar(o.urgencia_razon)].filter(Boolean).join(' — ') : '';
  const crudo: Partial<Record<PiezaKey, string>> = {
    precio: colapsar(c.precio),
    resultado: colapsar(c.promesa),
    entregables: colapsar(c.incluye),
    garantia: colapsar(c.garantia),
    cliente: colapsar(o.para_quien),
    objecion: colapsar(o.objeciones),
    prueba: colapsar(o.prueba),
    bonos,
    urgencia,
  };
  return mergePiezas({}, crudo, 'negocio', at);
}

/** La primera pregunta de la guía cuya pieza todavía no tiene nada anotado. */
export function siguientePregunta(piezas: PiezasSabidas): string | null {
  return PREGUNTAS_GUIA.find((q) => !piezaAnotada(piezas, q.pieza))?.pregunta ?? null;
}

/**
 * El primer mensaje de MaKo, SIN IA: es lo que la pantalla de bienvenida dibuja antes de que exista
 * una conversación, y el mismo texto con el que nace la sesión al primer mensaje del dueño (si
 * dependiera de un modelo, la bienvenida y la sesión dirían cosas distintas).
 *
 * Dos frases como mucho: la invitación (escribir, dictar o subir) y UNA pregunta.
 */
export function primerMensaje(
  piezas: PiezasSabidas,
  opts: { hayContexto?: boolean; at?: string } = {},
): OfferMensaje {
  const leyo = opts.hayContexto || Object.values(piezas).some((p) => p?.fuente === 'negocio' && p.valor.trim());
  const pregunta = siguientePregunta(piezas) ?? '¿Hay algo de tu oferta que quieras cambiar antes de armarla?';
  const invitacion = leyo
    ? 'Ya leí lo que tengo de tu negocio; puedes escribir, dictar o subir tu oferta, tu guion de ventas o tu web.'
    : 'Cuéntame de tu oferta: puedes escribir, dictar o subir tu oferta, tu guion de ventas o tu web.';
  const puede = faltanMinimas(piezas).length === 0;
  return {
    id: 'mako-inicio',
    de: 'mako',
    texto: `${invitacion} ${pregunta}`,
    at: opts.at ?? new Date().toISOString(),
    ...(puede ? { opciones: [OPCION_ARMAR] } : {}),
  };
}

// ── El turno ─────────────────────────────────────────────────────────────────

export type TurnoOffer = {
  respuesta: string;
  opciones: string[];
  piezas: Partial<Record<PiezaKey, string>>;
  /** Lo que dijo el modelo. NO decide nada: decide `faltanMinimas` sobre las piezas ya fusionadas. */
  listo: boolean;
};

/**
 * UNA pregunta por mensaje, también cuando el modelo hace dos.
 *
 * Se corta después del PRIMER signo de cierre de pregunta si viene otro detrás: «¿Cuánto cobras? ¿Y
 * cómo te pagan?» queda en la primera. Lo que se pierde es lo que venía después de la primera
 * pregunta (una segunda pregunta o una aclaración), y eso es a propósito: dos preguntas juntas se
 * contestan a medias, que es la regla del marco (§3, «una pregunta por mensaje»).
 */
export function unaSolaPregunta(t: string): string {
  const i = t.indexOf('?');
  if (i < 0 || !t.slice(i + 1).includes('?')) return t;
  return t.slice(0, i + 1).trim();
}

/**
 * El tope de la respuesta SIN perder la pregunta. Lo que el dueño tiene que contestar está al final, así
 * que recortar desde el principio (lo de siempre) se comería justo eso cuando el modelo se alarga: se
 * conserva la pregunta entera y se recorta lo de antes.
 */
export function recortarRespuesta(t: string): string {
  if (t.length <= TOPE_RESPUESTA) return t;
  const q = t.lastIndexOf('?');
  if (q < 0) return recortar(t, TOPE_RESPUESTA);
  // La pregunta arranca en el «¿» que la abre o, si el modelo no lo puso, después del último fin de frase.
  let ini = t.lastIndexOf('¿', q);
  if (ini < 0) {
    const fin = Math.max(t.lastIndexOf('. ', q), t.lastIndexOf('! ', q));
    ini = fin < 0 ? 0 : fin + 2;
  }
  const pregunta = t.slice(ini, q + 1).trim();
  if (pregunta.length >= TOPE_RESPUESTA - 40) return recortar(pregunta, TOPE_RESPUESTA);
  const antes = t.slice(0, ini).trim();
  return antes ? `${recortar(antes, TOPE_RESPUESTA - pregunta.length - 1)} ${pregunta}` : pregunta;
}

function limpiarOpciones(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const x of v) {
    const o = colapsar(x);
    // Una opción de más de 60 caracteres se DESCARTA, no se recorta: un botón cortado a la mitad
    // («Cobro 2.500 USD en dos pagos y el seg…») contesta otra cosa que la que el dueño elegiría.
    if (!o || o.length > TOPE_OPCION) continue;
    const n = normalizar(o);
    if (vistas.has(n)) continue;
    vistas.add(n);
    out.push(o);
    if (out.length >= MAX_OPCIONES) break;
  }
  return out;
}

/** El JSON del turno, o null si no sirve (la cascada prueba el próximo proveedor). */
export function parseTurno(raw: unknown): TurnoOffer | null {
  const o = aObjeto(raw);
  if (!o) return null;
  const crudo = texto(o.respuesta, 4000);
  if (!crudo || pareceRazonamiento(crudo)) return null;
  return {
    respuesta: recortarRespuesta(unaSolaPregunta(crudo)),
    opciones: limpiarOpciones(o.opciones),
    piezas: limpiarPiezas(o.piezas),
    listo: o.listo === true,
  };
}

/**
 * Las opciones que se dibujan, con «Armar mi oferta» puesta o sacada según las PIEZAS.
 *
 * Con las mínimas completas va siempre (al final, en lugar de la cuarta si no entra): el dueño puede
 * concluir cuando quiera, aunque MaKo siga preguntando por las piezas que suman. Sin las mínimas se
 * saca aunque el modelo la haya ofrecido: el botón llevaría a un «diagnosticar» que el servidor
 * rechaza, y un botón que contesta «faltan piezas» se lee como que la app está rota.
 */
export function opcionesConCierre(opciones: string[], puedeConcluir: boolean): string[] {
  const sin = opciones.filter((o) => normalizar(o) !== normalizar(OPCION_ARMAR));
  return puedeConcluir ? [...sin.slice(0, MAX_OPCIONES - 1), OPCION_ARMAR] : sin.slice(0, MAX_OPCIONES);
}

// ── El diagnóstico ───────────────────────────────────────────────────────────

/**
 * Una nota de 0 a 10, entera.
 *
 * Un decimal en rango se REDONDEA (7,6 → 8) en vez de rechazar el diagnóstico entero: rechazarlo
 * manda la cascada al proveedor siguiente —más lento y casi siempre un modelo peor— por algo que el
 * código resuelve sin ambigüedad. Lo que SÍ se rechaza es una nota fuera de rango (75, -1): ésa es un
 * modelo que confundió la escala, y redondearla inventaría una nota.
 */
function notaEntera(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return Math.round(n);
}

/** El JSON del diagnóstico, o null. Exige las 9 dimensiones (una vez cada una) y de 1 a 3 cambios. */
export function parseDiagnostico(raw: unknown): DiagnosticoOferta | null {
  const o = aObjeto(raw);
  if (!o || !Array.isArray(o.dimensiones)) return null;
  const porId = new Map<DimensionId, NotaDimension>();
  for (const d of o.dimensiones) {
    const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    const id = typeof x.id === 'string' ? x.id.trim().toUpperCase() : '';
    if (!esDimensionId(id) || porId.has(id)) continue;
    const nota = notaEntera(x.nota);
    const porque = texto(x.porque, 450);
    if (nota == null || !porque) return null;
    porId.set(id, { id, nota, porque, mejora: texto(x.mejora, 300) });
  }
  if (porId.size !== DIMENSION_IDS.length) return null;
  const tesis = texto(o.tesis, 320);
  if (!tesis || pareceRazonamiento(tesis)) return null;
  const cambios: CambioPropuesto[] = (Array.isArray(o.cambios) ? o.cambios : [])
    .map((c) => {
      const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      return { titulo: texto(x.titulo, 160), porque: texto(x.porque, 400), hipotesis: texto(x.hipotesis, 400) };
    })
    .filter((c) => c.titulo)
    .slice(0, 3);
  if (!cambios.length) return null;
  return {
    dimensiones: DIMENSION_IDS.map((id) => porId.get(id) as NotaDimension),
    tesis,
    fuerte: texto(o.fuerte, 320),
    cambios,
  };
}

/**
 * Lo que se calcula sobre las notas. Nunca lo escribe el modelo.
 *
 *  · total: el promedio × 10, redondeado (0-100).
 *  · cuello: la dimensión más baja; con empate, la que está más ARRIBA en el orden (D1 antes que D2):
 *    el marco dice que D1, D2 y D3 se apoyan una en la otra, así que lo de arriba se arregla primero.
 *  · lista: ninguna por debajo de 5, y cliente, promesa y certeza (D1, D2, D4) en 7 o más.
 *  · alertas: la de foco (si la hay), las de D1/D2 en 3 o menos, y las que mande el que llama.
 */
export function calcularDiagnostico(
  dims: NotaDimension[],
  extras: { foco?: string | null; otras?: Array<string | null | undefined> } = {},
): CalculoDiagnostico {
  const notas = new Map<DimensionId, number>();
  for (const d of dims) if (esDimensionId(d.id) && !notas.has(d.id)) notas.set(d.id, d.nota);
  const presentes = DIMENSION_IDS.filter((id) => notas.has(id));
  const suma = presentes.reduce((a, id) => a + (notas.get(id) as number), 0);
  // `suma * 10 / n` y no `(suma / n) * 10`: dividir último esquiva el error de coma flotante que
  // convierte un 55,5 exacto en 55,4999… y lo redondea para abajo.
  const total = presentes.length ? Math.round((suma * 10) / presentes.length) : 0;
  let cuello: DimensionId = DIMENSION_IDS[0];
  let min = Number.POSITIVE_INFINITY;
  for (const id of DIMENSION_IDS) {
    const n = notas.get(id);
    if (n != null && n < min) { min = n; cuello = id; }
  }
  const lista = presentes.length === DIMENSION_IDS.length
    && presentes.every((id) => (notas.get(id) as number) >= 5)
    && DIMENSIONES_CRITICAS.every((id) => (notas.get(id) ?? 0) >= 7);
  const alertas: string[] = [];
  if (extras.foco?.trim()) alertas.push(extras.foco.trim());
  for (const id of ['D1', 'D2'] as const) {
    const n = notas.get(id);
    if (n != null && n <= 3) alertas.push(`${dimensionLabel(id)} saca ${n}: conviene rehacer la oferta desde ahí antes de tocar el precio o los bonos.`);
  }
  for (const a of extras.otras ?? []) if (a?.trim()) alertas.push(a.trim());
  return { total, cuello, lista, alertas: [...new Set(alertas)] };
}

/**
 * La regla de FOCO de Martín (05/08/2026): «si alguien que no factura ni 5k al mes tiene 20
 * productos… Fase 1: un anuncio ganador para una oferta».
 *
 * `bandaFacturacion` es la respuesta 0 del diagnóstico de fase (lib/fase-diagnostico.ts,
 * `Diagnostico.respuestas[0]`): 0 = $0-3.000, 1 = $3.000-10.000, 2-4 = más. null = no lo contestó.
 *
 * ⚠️ EL UMBRAL ES UN PROXY Y NO ESTÁ MEDIDO (AGENTS.md «Un umbral es un proxy, y el proxy hay que
 * MEDIRLO contra los datos reales»): banda ≤ 1 y más de 2 productos u ofertas activas, o banda
 * desconocida y más de 5. Lo propuso el orquestador el 11/10/2026 a partir de la frase de arriba; no
 * se corrió contra los productos y ofertas reales de los negocios. Antes de confiar en él, contar
 * cuántos negocios activos lo disparan y mirar a mano tres: un catálogo de «productos» puede tener
 * variantes de precio de UNA oferta, y eso no es falta de foco.
 */
export function alertaFoco(p: { productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null }): string | null {
  const prods = Math.max(0, Math.floor(Number(p.productosActivos) || 0));
  const ofs = Math.max(0, Math.floor(Number(p.ofertasActivas) || 0));
  const n = Math.max(prods, ofs);
  const b = p.bandaFacturacion;
  const conocida = typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 4;
  const dispara = conocida ? (b as number) <= 1 && n > 2 : n > 5;
  if (!dispara) return null;
  const que = prods >= ofs ? `${prods} productos activos` : `${ofs} ofertas activas`;
  // El monto se dice en la MISMA unidad de la pregunta que el dueño contestó («$0 – $3.000»).
  const factura = !conocida ? '' : b === 0 ? ' y tu negocio factura menos de $3.000 al mes' : ' y tu negocio factura menos de $10.000 al mes';
  return `Tienes ${que}${factura}: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.`;
}

// ── La propuesta ─────────────────────────────────────────────────────────────

const VARIABLES: readonly VariableValor[] = ['resultado', 'probabilidad', 'tiempo', 'esfuerzo'];

/** Un campo de texto de la propuesta: si falta, queda «[completar]» (a la vista, nunca vacío). */
const campo = (v: unknown, tope = 700): string => texto(v, tope) || MARCA_COMPLETAR;

const lista = (v: unknown, max: number, tope = 300): string[] =>
  (Array.isArray(v) ? v : []).map((x) => texto(x, tope)).filter(Boolean).slice(0, max);

const objetos = (v: unknown, max: number): Array<Record<string, unknown>> =>
  (Array.isArray(v) ? v : []).filter((x) => x && typeof x === 'object' && !Array.isArray(x)).slice(0, max) as Array<Record<string, unknown>>;

const sub = (o: Record<string, unknown>, k: string): Record<string, unknown> => {
  const v = o[k];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

/** Lo que queda en la urgencia cuando el dueño nunca dio una razón real para decidir hoy. */
export const URGENCIA_SIN_DATO = `${MARCA_COMPLETAR} Una razón real para decidir hoy: una cohorte con fecha de inicio, cupos según cuántos clientes puedes atender a la vez o una subida de precio anunciada.`;

/**
 * Una cifra: dígitos con sus separadores y un % pegado. Lo que NO ve: las cifras escritas con letras
 * («tres clientes»). Una regex no distingue «tres» de una palabra cualquiera sin una lista, y una lista
 * de números en palabras se come «una» y «uno» como artículos: esa mitad queda en el prompt.
 */
const CIFRA = /\d+(?:[.,]\d+)*(?:\s?%)?/g;

/**
 * Las reglas del marco que el código puede verificar sobre la propuesta (la segunda capa).
 *
 *  1. URGENCIA: si el dueño nunca la dio, queda «[completar]» con cómo armar una real. Cualquier otra
 *     cosa que haya escrito el modelo es inventada por construcción: no salió del dueño.
 *  2. PRUEBA: sin pieza de prueba, toda cifra de «prueba» pasa a «[completar]». La frase queda
 *     («[completar] clientes lograron…») para que se vea QUÉ falta, no sólo que falta algo.
 *  3. BONOS: sin pieza de bonos, el valor de cada bono con dígitos pasa a «[completar]».
 *  4. COMPLETAR: todo campo con la marca queda listado, sin duplicar. Lo arma el código y no el modelo:
 *     el que sabe qué quedó marcado es el que lo marcó.
 *
 * «sin dato: …» cuenta como que el dueño NO lo dio (`tieneDato`).
 */
export function aplicarReglasPropuesta(p: PropuestaOferta, piezas: PiezasSabidas): PropuestaOferta {
  const out: PropuestaOferta = {
    ...p,
    bonos: p.bonos.map((b) => ({ ...b })),
  };
  if (!tieneDato(piezas, 'urgencia')) out.urgencia = URGENCIA_SIN_DATO;
  if (!tieneDato(piezas, 'prueba')) out.prueba = out.prueba.replace(CIFRA, MARCA_COMPLETAR);
  if (!tieneDato(piezas, 'bonos')) {
    out.bonos = out.bonos.map((b) => (/\d/.test(b.valor) ? { ...b, valor: MARCA_COMPLETAR } : b));
  }
  out.completar = listaCompletar(out);
  return out;
}

/** «Etiqueta: lo que dice después de la marca», o sólo la etiqueta si después no dice nada. */
function entradaCompletar(etiqueta: string, valor: string): string | null {
  const i = valor.indexOf(MARCA_COMPLETAR);
  if (i < 0) return null;
  // Si el campo tiene más de una marca («[completar] de [completar] clientes»), las de después se
  // leen como «…»: la entrada dice qué falta, y repetir la marca no agrega nada.
  const detalle = valor.slice(i + MARCA_COMPLETAR.length).replace(/^[\s:.—-]+/, '').split(MARCA_COMPLETAR).join('…').trim();
  return detalle ? `${etiqueta}: ${recortar(detalle, 140)}` : etiqueta;
}

/** Todo lo que quedó «[completar]», en el orden de la plantilla y con el nombre que ve el dueño. */
export function listaCompletar(p: PropuestaOferta): string[] {
  const pares: Array<[string, string]> = [
    ['Nombre de la oferta', p.nombre], ['La frase', p.frase],
    ['Mensaje corto', p.mensajes.corto], ['Mensaje largo', p.mensajes.largo], ['Promesa de entrada', p.mensajes.entrada],
    ['Para quién es', p.paraQuien.perfil], ['Condiciones mínimas', p.paraQuien.minimo], ['Para quién no es', p.paraQuien.noEs],
    ['El problema de hoy', p.problema.hoy], ['El destino', p.problema.despues], ['Lo que ya probó', p.problema.yaProbo],
    ...p.problema.obstaculos.map((o, i): [string, string] => [`Obstáculo ${i + 1}`, o]),
    ...p.mecanismo.nombres.map((n, i): [string, string] => [`Nombre del método ${i + 1}`, n]),
    ...p.mecanismo.pasos.map((s, i): [string, string] => [`Paso ${i + 1} del método`, s]),
    ['Por qué el método es distinto', p.mecanismo.distinto],
    ...p.ruta.flatMap((f, i): Array<[string, string]> => [[`Fase ${i + 1}`, f.fase], [`Fase ${i + 1}: objetivo`, f.objetivo], [`Fase ${i + 1}: hito`, f.hito]]),
    ...p.incluye.flatMap((e, i): Array<[string, string]> => [[`Entregable ${i + 1}`, e.nombre], [`Entregable ${i + 1}: beneficio`, e.beneficio]]),
    ['Formato', p.formato], ['Prueba', p.prueba],
    ['Garantía: nombre', p.garantia.nombre], ['Garantía: condiciones', p.garantia.condiciones],
    ['Garantía: plazo', p.garantia.plazo], ['Garantía: si no se cumple', p.garantia.siNoCumple],
    ...p.bonos.flatMap((b, i): Array<[string, string]> => [[`Bono ${i + 1}`, b.nombre], [`Bono ${i + 1}: objeción`, b.objecion], [`Bono ${i + 1}: valor`, b.valor]]),
    ['Valor total', p.inversion.valorTotal], ['Precio', p.inversion.precio], ['Pago de contado', p.inversion.contado],
    ['Plan de pagos', p.inversion.plan], ['Cómo decir el precio', p.inversion.comoDecirlo],
    ['Urgencia', p.urgencia],
    ['Mejor escenario', p.escenarios.mejor], ['Peor escenario', p.escenarios.peor],
    ...p.ecuacion.flatMap((f): Array<[string, string]> => [[`Ecuación de valor: ${f.variable} antes`, f.antes], [`Ecuación de valor: ${f.variable} después`, f.despues]]),
    ...p.numeros.map((n, i): [string, string] => [`Número ${i + 1}`, n]),
    ...p.validar.map((v, i): [string, string] => [`Cómo validarla ${i + 1}`, v]),
    ['Siguiente escalón', p.siguiente],
  ];
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const [etiqueta, valor] of pares) {
    const e = entradaCompletar(etiqueta, valor ?? '');
    if (!e) continue;
    const n = normalizar(e);
    if (vistas.has(n)) continue;
    vistas.add(n);
    out.push(e);
  }
  return out;
}

/**
 * El JSON de la propuesta, ya con la segunda capa aplicada, o null si no sirve.
 *
 * Exige el nombre y la frase (sin eso no hay oferta que mostrar); todo otro texto que falte queda
 * «[completar]» a la vista. Los topes de las listas son los del marco: 3 a 5 fases (hasta 6 por si el
 * modelo agrega una), hasta 3 bonos, 2 o 3 nombres para el método.
 */
export function parsePropuesta(raw: unknown, piezas: PiezasSabidas): PropuestaOferta | null {
  const o = aObjeto(raw);
  if (!o) return null;
  const nombre = texto(o.nombre, 120);
  const frase = texto(o.frase, 400);
  if (!nombre || !frase || frase === MARCA_COMPLETAR || pareceRazonamiento(`${nombre} ${frase}`)) return null;
  const m = sub(o, 'mensajes');
  const pq = sub(o, 'paraQuien');
  const pr = sub(o, 'problema');
  const me = sub(o, 'mecanismo');
  const ga = sub(o, 'garantia');
  const inv = sub(o, 'inversion');
  const esc = sub(o, 'escenarios');
  const ruta: FaseRuta[] = objetos(o.ruta, 6)
    .map((f) => ({ fase: texto(f.fase, 120), objetivo: campo(f.objetivo, 300), hito: campo(f.hito, 300) }))
    .filter((f) => f.fase);
  const incluye: Entregable[] = objetos(o.incluye, 12)
    .map((e) => ({ nombre: texto(e.nombre, 160), beneficio: campo(e.beneficio, 300) }))
    .filter((e) => e.nombre);
  const bonos: BonoPropuesto[] = objetos(o.bonos, 3)
    .map((b) => ({ nombre: texto(b.nombre, 160), objecion: campo(b.objecion, 300), valor: campo(b.valor, 120) }))
    .filter((b) => b.nombre);
  // Una fila por variable (la primera que venga), y sólo las cuatro de la ecuación de valor.
  const ecuacion: EcuacionFila[] = [];
  for (const f of objetos(o.ecuacion, 8)) {
    const variable = (typeof f.variable === 'string' ? f.variable.trim().toLowerCase() : '') as VariableValor;
    if (!VARIABLES.includes(variable) || ecuacion.some((e) => e.variable === variable)) continue;
    ecuacion.push({ variable, antes: campo(f.antes, 300), despues: campo(f.despues, 300) });
  }
  const base: PropuestaOferta = {
    nombre,
    frase,
    mensajes: { corto: campo(m.corto, 120), largo: campo(m.largo, 600), entrada: campo(m.entrada, 300) },
    paraQuien: { perfil: campo(pq.perfil, 600), minimo: campo(pq.minimo, 400), noEs: campo(pq.noEs, 400) },
    problema: { hoy: campo(pr.hoy, 600), despues: campo(pr.despues, 600), obstaculos: lista(pr.obstaculos, 6), yaProbo: campo(pr.yaProbo, 500) },
    mecanismo: { nombres: lista(me.nombres, 3, 120), pasos: lista(me.pasos, 8), distinto: campo(me.distinto, 600) },
    ruta,
    incluye,
    formato: campo(o.formato, 600),
    prueba: campo(o.prueba, 700),
    garantia: { nombre: campo(ga.nombre, 160), condiciones: campo(ga.condiciones, 500), plazo: campo(ga.plazo, 160), siNoCumple: campo(ga.siNoCumple, 400) },
    bonos,
    inversion: { valorTotal: campo(inv.valorTotal, 200), precio: campo(inv.precio, 200), contado: campo(inv.contado, 200), plan: campo(inv.plan, 300), comoDecirlo: campo(inv.comoDecirlo, 600) },
    urgencia: campo(o.urgencia, 500),
    escenarios: { mejor: campo(esc.mejor, 400), peor: campo(esc.peor, 400) },
    ecuacion,
    numeros: lista(o.numeros, 8),
    validar: lista(o.validar, 8),
    siguiente: campo(o.siguiente, 500),
    completar: [],
  };
  return aplicarReglasPropuesta(base, piezas);
}

// ── «Guardar como oferta» ────────────────────────────────────────────────────

/** Los campos de una fila de `ofertas` (lib/oferta-modelo.ts → OfertaInput) que salen de la propuesta. */
export type OfertaDesdePropuesta = {
  nombre: string;
  precio_nota: string | null;
  promesa: string | null;
  incluye: string | null;
  garantia: string | null;
  para_quien: string | null;
  objeciones: string | null;
  prueba: string | null;
  bonos: Array<{ nombre: string; valor_usd: null; porque: string }>;
  origen: 'offer';
};

const conMarca = (s: string): boolean => s.includes(MARCA_COMPLETAR);
/** El texto si no tiene «[completar]»; si lo tiene, null: un hueco no se escribe como dato del negocio. */
const limpio = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t && !conMarca(t) ? t : null;
};
const unir = (partes: Array<string | null>, sep: string): string | null => {
  const ok = partes.filter((x): x is string => !!x);
  return ok.length ? ok.join(sep) : null;
};

/**
 * La fila NUEVA de `ofertas` que se crea con la propuesta (nunca la principal: «Guardar como oferta»
 * agrega una oferta al negocio, no pisa la que ya vende).
 *
 *  · Lo que tiene «[completar]» NO se escribe: en la tabla del negocio un hueco tiene que verse como
 *    hueco (null), no como un texto que los ~20 prompts que leen la oferta tomarían por un dato.
 *  · El precio va a `precio_nota` como TEXTO, tal cual: nunca se parsea a `precio_usd` (una cifra
 *    sacada de una frase es una cifra inventada, lib/oferta-modelo.ts).
 *  · Los bonos van sin `valor_usd` por la misma razón.
 *  · La urgencia NO se escribe: la tabla exige un TIPO (fecha, cupos, capacidad, inicio) que la
 *    propuesta no trae, y deducirlo es inventar una restricción que después sale en un anuncio. Se
 *    declara a mano en el editor de la oferta.
 */
export function ofertaDesdePropuesta(p: PropuestaOferta, respaldoNombre: string): OfertaDesdePropuesta {
  const nombre = limpio(p.nombre) ?? (respaldoNombre.trim() || 'Oferta de MaKo');
  const noEs = limpio(p.paraQuien.noEs);
  return {
    nombre: recortar(nombre, 120),
    precio_nota: unir([limpio(p.inversion.precio), limpio(p.inversion.plan)], ' · '),
    promesa: limpio(p.frase),
    incluye: unir(p.incluye.map((e) => limpio(e.nombre)), ' · '),
    garantia: unir([limpio(p.garantia.nombre), limpio(p.garantia.condiciones), limpio(p.garantia.plazo)], ' — '),
    para_quien: unir([limpio(p.paraQuien.perfil), noEs ? `No es para: ${noEs}` : null], '. '),
    objeciones: unir(p.problema.obstaculos.map(limpio), ' · '),
    prueba: limpio(p.prueba),
    bonos: p.bonos
      .filter((b) => limpio(b.nombre))
      .map((b) => ({ nombre: b.nombre.trim(), valor_usd: null, porque: limpio(b.objecion) ?? '' })),
    origen: 'offer',
  };
}

// ── Lo que viaja al prompt ───────────────────────────────────────────────────
// Puro para poder probarlo: qué parte del historial y de los documentos ve el modelo decide si
// re-pregunta lo que ya se dijo.

/** Cuántos mensajes de la conversación ve el modelo. */
export const MAX_MENSAJES_PROMPT = 30;
/** Cuántos caracteres de documentos, sumados, entran en un pedido. */
export const TOPE_DOCS_PROMPT = 24_000;

/**
 * La conversación con RÓTULOS DE HABLANTE adentro del mensaje del usuario (molde:
 * app/api/chat-agent/onboarding/ensayo/route.ts). Va serializada y no como turnos de la API porque la
 * cascada barata manda un system y un user, y porque así el rótulo «DUEÑO» es parte de lo que el
 * modelo lee como dato.
 */
export function conversacionParaPrompt(mensajes: OfferMensaje[], max = MAX_MENSAJES_PROMPT): string {
  const ult = mensajes.slice(-max);
  const lineas = ult.map((m) => {
    const quien = m.de === 'yo' ? 'DUEÑO' : 'MaKo';
    const adj = m.adjuntos?.length ? ` (adjuntó: ${m.adjuntos.map((a) => a.nombre).join(', ')})` : '';
    const cuerpo = (m.texto ?? '').trim() || (m.adjuntos?.length ? '(mandó documentos sin texto)' : '(vacío)');
    // Lo del DUEÑO va entero hasta el tope que acepta la ruta (12.000, TOPE_MENSAJE en
    // app/api/offer/route.ts): recortarlo a 2.000 guardaba el mensaje y nunca se lo leía al modelo,
    // que preguntaba por el precio que estaba en el tramo cortado. Lo de MaKo es corto por construcción.
    return `${quien}${adj}: ${recortar(cuerpo, m.de === 'yo' ? 12_000 : 2_000)}`;
  });
  if (mensajes.length > ult.length) lineas.unshift(`(Se omiten los ${mensajes.length - ult.length} mensajes más viejos.)`);
  return lineas.join('\n');
}

export type DocParaPrompt = { id: string; nombre: string; texto: string; at: string };

/**
 * Los documentos que la IA puede leer: los que viajaron en algún mensaje del dueño, más los del
 * turno en curso. Un archivo se lee y se guarda apenas se elige (para mostrar el ✓), pero si el
 * dueño lo quita del composer antes de mandar nunca entra a la conversación: sin este filtro, el
 * contrato de otro cliente subido por error seguía viajando a los proveedores en cada turno.
 */
export function docsDeLaConversacion<T extends { id: string }>(docs: T[], mensajes: OfferMensaje[], nuevos: readonly string[] = []): T[] {
  const usados = new Set<string>(nuevos);
  for (const m of mensajes) for (const a of m.adjuntos ?? []) usados.add(a.id);
  return docs.filter((d) => usados.has(d.id));
}

/**
 * Los documentos recortados a un tope TOTAL, priorizando los recién subidos.
 *
 * Reparto en dos tandas con «llenado parejo»: primero los nuevos (hasta el 60% del tope), después el
 * resto (lo que quede). Dentro de cada tanda ningún documento se come el cupo de los demás: cada uno
 * recibe a lo sumo una parte igual, y lo que un documento corto no usa pasa a los otros.
 */
export function documentosParaPrompt(docs: DocParaPrompt[], nuevos: string[] = [], tope = TOPE_DOCS_PROMPT): string {
  if (!docs.length) return '';
  const esNuevo = new Set(nuevos);
  const recientes = (a: DocParaPrompt, b: DocParaPrompt) => (b.at || '').localeCompare(a.at || '');
  const tanda1 = docs.filter((d) => esNuevo.has(d.id)).sort(recientes);
  const tanda2 = docs.filter((d) => !esNuevo.has(d.id)).sort(recientes);
  const cupos = new Map<string, number>();
  const repartir = (lista: DocParaPrompt[], disponible: number): number => {
    let resto = disponible;
    const pendientes = [...lista].sort((a, b) => a.texto.length - b.texto.length);
    let n = pendientes.length;
    for (const d of pendientes) {
      const parte = Math.floor(resto / n);
      const toma = Math.min(d.texto.length, Math.max(0, parte));
      cupos.set(d.id, toma);
      resto -= toma;
      n -= 1;
    }
    return disponible - resto;
  };
  const usado = repartir(tanda1, tanda2.length ? Math.floor(tope * 0.6) : tope);
  repartir(tanda2, tope - usado);
  return [...tanda1, ...tanda2]
    .map((d) => {
      const c = cupos.get(d.id) ?? 0;
      const cuerpo = d.texto.length > c ? `${d.texto.slice(0, c)}\n[…recortado: ${d.texto.length - c} caracteres más]` : d.texto;
      return `— «${d.nombre}»${esNuevo.has(d.id) ? ' (recién subido)' : ''} —\n${cuerpo}`;
    })
    .join('\n\n');
}

/** Lo que ya se sabe de cada pieza y lo que falta, para el modelo. */
export function piezasParaPrompt(piezas: PiezasSabidas): { sabidas: string; faltan: string } {
  const sabidas = PIEZAS
    .filter((p) => piezaAnotada(piezas, p.key))
    .map((p) => `- ${p.key} (${p.label}): ${piezas[p.key]?.valor} [de: ${piezas[p.key]?.fuente}]`)
    .join('\n');
  const faltan = PIEZAS
    .filter((p) => !piezaAnotada(piezas, p.key))
    .map((p) => `- ${p.key}${p.minimo ? ' [mínima]' : ''}: ${p.que}`)
    .join('\n');
  return { sabidas: sabidas || '(ninguna todavía)', faltan: faltan || '(ninguna: ya están todas)' };
}

/** Las preguntas de la guía, en orden, para el system del turno. */
export const guiaParaPrompt = (): string =>
  PREGUNTAS_GUIA.map((q, i) => `${i + 1}. [${q.pieza}] ${q.pregunta}`).join('\n');
