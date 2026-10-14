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
// 12/10/2026 (las 13 respuestas de Martín a «A definir» del Offer Playbook): también deciden el CÓDIGO
//   · las cifras, POR CIFRA y no por pieza (`filtrarCifras`), y lo que propuso MaKo (`propuestoPorMako`);
//   · el control final del marco antes de decir «lista» (`controlFinal`) y los avisos que la IA lee antes
//     de poner las notas (`avisosAntesDelDiagnostico`: foco desde 3 ofertas, margen, embudo, precio);
//   · los topes de las listas, las reglas que antes dependían del prompt (duración, precio, garantía,
//     nombres del método) y la oferta provisional con su PDF en el chat (`provisionalDe`, `mensajePdf`).
//
// Las keys de piezas y dimensiones, los tipos y el marco viven en lib/offer-marco.ts (no se tocan
// desde acá: es el contrato que comparten la pantalla, el PDF y este motor).
//
// v2 (11/10/2026, pedido de Martín: «aprovechá lo que ya construimos»): también deciden el CÓDIGO
//   · el árbol del selector (funnel → ofertas → conversaciones), con cada conversación UNA vez
//     (`construirArbol`);
//   · el diagnóstico de FASE adentro del chat: qué pregunta toca, cuándo es obligatoria, que la opción N
//     personalizada sea la opción N original (`estadoDiagnostico`, `planDiagnostico`,
//     `opcionesDiagnostico`, `mensajeDeMako`). El cálculo es `diagnosticar` de lib/fase-diagnostico.ts,
//     el mismo del onboarding: acá no hay otra cuenta;
//   · el primer mensaje de una conversación atada a un funnel (`primerMensajeFunnel`), sin IA.
// =============================================================================

import { parseJsonObject } from './json-del-modelo';
import { urgenciaUsable, type UrgenciaTipo } from './oferta-modelo';
import { CANALES, PREGUNTAS, VOLUMEN_POR_CANAL, diagnosticar, type CanalId, type Diagnostico } from './fase-diagnostico';
import {
  DIMENSION_IDS, DIMENSIONES_CRITICAS, MARCA_COMPLETAR, PIEZAS, PIEZA_KEYS, PREGUNTAS_GUIA,
  dimensionLabel, esDimensionId, esPiezaKey, faltanMinimas, piezaLabel,
  type AdjuntoVista, type ArbolOffer, type BonoPropuesto, type CalculoDiagnostico, type CambioPropuesto, type DiagnosticoOferta,
  type DimensionId, type EcuacionFila, type Entregable, type FaseRuta, type FuentePieza, type ModoSesion,
  type NotaDimension, type OfferMensaje, type OfferSesionResumen, type PiezaKey, type PiezaSabida, type PiezasSabidas,
  type PropuestaOferta, type PuntoControlFinal, type VariableValor,
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

/**
 * El audio de un mensaje como se GUARDA: la ruta del binario en el bucket `archivero`
 * (`<ws>/offer/<uuid>`), nunca una URL. La pantalla recibe `{ url, secs }` (`mensajeParaVista`): la ruta
 * interna de Storage no baja al navegador.
 */
export type AudioGuardado = { path: string; mime: string; secs: number };
/** Un mensaje como vive en la fila: igual que el de la pantalla, salvo el audio. */
export type MensajeGuardado = Omit<OfferMensaje, 'audio'> & { audio?: AudioGuardado };
/**
 * Un mensaje SIN audio (todos los de MaKo): sirve igual como mensaje guardado y como el de la pantalla, porque
 * las dos formas sólo difieren en el audio.
 */
export type MensajeSinAudio = Omit<OfferMensaje, 'audio'>;

/** La forma de la ruta de un binario de Offer, sin el workspace (la ruta lo exige con el suyo). */
const RE_PATH_OFFER = /^\d+\/offer\/[0-9a-f-]{36}$/;

/** La URL con la que la pantalla reproduce el audio de un mensaje (app/api/offer/audio/route.ts). */
export const urlAudio = (sesionId: number, mensajeId: string): string =>
  `/api/offer/audio?id=${sesionId}&m=${encodeURIComponent(mensajeId)}`;

/** El mensaje como lo ve la pantalla: el audio pasa de ruta interna a URL. */
export function mensajeParaVista(sesionId: number, m: MensajeGuardado): OfferMensaje {
  const { audio, ...resto } = m;
  return audio ? { ...resto, audio: { url: urlAudio(sesionId, m.id), secs: audio.secs } } : resto;
}

function sanearAudio(raw: unknown): AudioGuardado | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.path !== 'string' || !RE_PATH_OFFER.test(o.path)) return undefined;
  const secs = typeof o.secs === 'number' && Number.isFinite(o.secs) && o.secs >= 0 ? Math.round(o.secs) : 0;
  return { path: o.path, mime: typeof o.mime === 'string' ? o.mime : '', secs };
}

function sanearPregunta(raw: unknown): MensajeGuardado['pregunta'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return o.tipo === 'diagnostico' && typeof o.id === 'string' && o.id.trim() ? { tipo: 'diagnostico', id: o.id } : undefined;
}

function sanearRespuesta(raw: unknown): MensajeGuardado['respuesta'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const idx = typeof o.idx === 'number' ? o.idx : NaN;
  if (typeof o.preguntaId !== 'string' || !o.preguntaId.trim() || !Number.isInteger(idx) || idx < 0 || idx >= N_OPCIONES_DIAG) return undefined;
  return { preguntaId: o.preguntaId, idx, ...(o.inferida === true ? { inferida: true } : {}) };
}

/** Los mensajes tal como vuelven de la base. Un mensaje sin texto, sin adjuntos y sin audio no se dibuja. */
export function sanearMensajes(raw: unknown): MensajeGuardado[] {
  if (!Array.isArray(raw)) return [];
  const out: MensajeGuardado[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    const de = o.de === 'yo' ? 'yo' : o.de === 'mako' ? 'mako' : null;
    if (!de || typeof o.id !== 'string') continue;
    const adjuntos = sanearAdjuntos(o.adjuntos);
    const audio = de === 'yo' ? sanearAudio(o.audio) : undefined;
    const t = typeof o.texto === 'string' ? o.texto : '';
    if (!t.trim() && !adjuntos.length && !audio) continue;
    const opciones = Array.isArray(o.opciones) ? o.opciones.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
    const pregunta = de === 'mako' ? sanearPregunta(o.pregunta) : undefined;
    const respuesta = de === 'yo' ? sanearRespuesta(o.respuesta) : undefined;
    const pdf = de === 'mako' ? sanearPdf(o.pdf) : undefined;
    out.push({
      id: o.id, de, texto: t, at: typeof o.at === 'string' ? o.at : '',
      ...(opciones.length ? { opciones } : {}),
      ...(adjuntos.length ? { adjuntos } : {}),
      ...(audio ? { audio } : {}),
      ...(pregunta ? { pregunta } : {}),
      ...(respuesta ? { respuesta } : {}),
      ...(pdf ? { pdf } : {}),
    });
  }
  return out;
}

/** El PDF de una versión, en un mensaje de MaKo: sólo una versión entera y positiva. */
function sanearPdf(raw: unknown): MensajeGuardado['pdf'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = (raw as { version?: unknown }).version;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? { version: v } : undefined;
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
): MensajeSinAudio {
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

// ── v2: la conversación atada a un funnel ────────────────────────────────────

/**
 * Lo primero que pide MaKo en una conversación v2, textual del pedido de Martín («si partimos de un
 * documento o un link de su web o landing… sería mucho más fácil»): lo que más rinde por pregunta.
 */
export const PEDIDO_DOCUMENTO = '¿Tienes un documento de tu oferta, tu guion de ventas o el link de tu web o landing? Súbelo o pégalo aquí.';
/** La salida para el que no tiene nada: MaKo pasa a preguntar. Es un botón (≤ 60 caracteres). */
export const OPCION_SIN_DOCUMENTO = 'No tengo, pregúntame';

/** «a, b y c». */
const listaConY = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/**
 * El primer mensaje de una conversación atada a un funnel, SIN IA (el mismo texto lo ve la pantalla al
 * abrirla, y no depende de que conteste un modelo). Pide el documento o el link; si MaKo ya sabe piezas
 * (de la oferta que se analiza o del producto del funnel), lo dice en UNA línea antes. «sin dato» no
 * cuenta como sabido.
 */
export function primerMensajeFunnel(
  piezas: PiezasSabidas,
  opts: { modo: ModoSesion; ofertaBaseNombre?: string; at?: string },
): MensajeSinAudio {
  const sabidas = PIEZAS.filter((p) => tieneDato(piezas, p.key)).map((p) => p.label.toLowerCase());
  const lista = listaConY(sabidas);
  const nombre = (opts.ofertaBaseNombre ?? '').replace(/\s+/g, ' ').trim();
  const linea = opts.modo === 'analizar' && nombre
    ? (lista ? `De «${recortar(nombre, 60)}» ya tengo ${lista}.` : `Vamos a revisar «${recortar(nombre, 60)}».`)
    : (lista ? `Ya tengo ${lista}.` : '');
  const puede = faltanMinimas(piezas).length === 0;
  return {
    id: 'mako-inicio',
    de: 'mako',
    texto: linea ? `${linea} ${PEDIDO_DOCUMENTO}` : PEDIDO_DOCUMENTO,
    at: opts.at ?? new Date().toISOString(),
    opciones: [OPCION_SIN_DOCUMENTO, ...(puede ? [OPCION_ARMAR] : [])],
  };
}

/** Lo que se lee de un producto del catálogo (lib/productos.ts → Producto), estructural a propósito. */
export type EntradaProducto = {
  tipo?: string | null; monto_usd?: number | null; suscripcion_meses?: number | null;
  promesa?: string | null; incluye?: string | null; garantia?: string | null;
};

/**
 * Lo que MaKo ya sabe al CREAR una oferta nueva para un funnel: el producto que ese funnel vende (lo que
 * se entrega y se factura). `monto_usd` SÍ es numérico (columna numeric), no texto libre: se escribe con
 * su unidad y su plazo.
 */
export function semillaDeProducto(p: EntradaProducto | null | undefined, at: string = new Date().toISOString()): PiezasSabidas {
  if (!p) return {};
  const monto = typeof p.monto_usd === 'number' && Number.isFinite(p.monto_usd) && p.monto_usd > 0 ? p.monto_usd : null;
  const plazo = p.tipo === 'suscripcion' ? ` al mes${p.suscripcion_meses ? ` durante ${p.suscripcion_meses} meses` : ''}` : '';
  const precio = monto != null ? `${monto.toLocaleString('es-MX')} USD${plazo}` : '';
  return mergePiezas({}, { precio, resultado: colapsar(p.promesa), entregables: colapsar(p.incluye), garantia: colapsar(p.garantia) }, 'negocio', at);
}

// ── v2: el diagnóstico de FASE adentro del chat ──────────────────────────────
// Pedido de Martín: «"El diagnóstico" (que en este caso las preguntas deben ser más personalizadas y el
// resultado del diagnóstico no se debe ver al finalizar esas preguntas, pero sí ser parte del PDF final)».
//
// Las preguntas y sus opciones son las de lib/fase-diagnostico.ts. La IA las ADAPTA al negocio, y el
// código garantiza que la opción N adaptada siga siendo la N original (`opcionesDiagnostico`): el `idx`
// que vuelve es el de la original, y el cálculo es `diagnosticar`, el mismo del onboarding.
//
// ⚠️ EL ESTADO SE DERIVA DE LOS MENSAJES, no se guarda aparte: las respuestas viven en los mensajes del
// dueño (`respuesta`) y todo lo demás —qué falta, cuál quedó abierta, el diagnóstico— se calcula. Un
// campo «diagnóstico de la sesión» al lado sería una segunda copia que se desincroniza con la primera.

/** Las opciones de cada pregunta del diagnóstico (las seis y la del canal). */
export const N_OPCIONES_DIAG = 5;
/** Una opción adaptada: es una fila tocable, puede ser más larga que un botón de respuesta rápida. */
export const TOPE_OPCION_DIAG = 120;
/** La pregunta adaptada, sin el puente. */
export const TOPE_PREGUNTA_DIAG = 300;
/** El id de la pregunta extra del canal, sólo cuando no se sabe dónde cierra la venta. */
export const PREGUNTA_CANAL = 'canal';
/** Sin el diagnóstico empezado, cuántos mensajes del dueño espera MaKo antes de hacerlo obligatorio. */
export const MENSAJES_ANTES_DEL_DIAGNOSTICO = 3;

export type PreguntaDiagnostico = { id: string; texto: string; opciones: string[] };

/**
 * El canal adapta la pregunta de volumen (lib/fase-diagnostico.ts → VOLUMEN_POR_CANAL). Si el funnel ni el
 * negocio lo declararon, se pregunta ANTES, como el selector de canal del wizard.
 */
const PREGUNTA_DEL_CANAL: PreguntaDiagnostico = {
  id: PREGUNTA_CANAL,
  texto: '¿Dónde cierras la venta?',
  opciones: CANALES.map((c) => `${c.label}: ${c.desc}`),
};

/** Las preguntas del diagnóstico en el orden en que se hacen. Sin canal conocido, la primera es el canal. */
export function preguntasDiagnostico(canalConocido: CanalId | null, canalRespondido: CanalId | null = null): PreguntaDiagnostico[] {
  const canal = canalConocido ?? canalRespondido ?? 'llamadas';
  const base = PREGUNTAS.map((q): PreguntaDiagnostico => (q.id === 'volumen'
    ? { id: q.id, texto: VOLUMEN_POR_CANAL[canal].texto, opciones: [...VOLUMEN_POR_CANAL[canal].opciones] }
    : { id: q.id, texto: q.texto, opciones: [...q.opciones] }));
  return canalConocido ? base : [PREGUNTA_DEL_CANAL, ...base];
}

export type EstadoDiagnostico = {
  preguntas: PreguntaDiagnostico[];
  /** id de pregunta → índice de la opción ORIGINAL. La última respuesta a cada una gana. */
  respuestas: Record<string, number>;
  canal: CanalId | null;
  /** Lo que falta preguntar. Vacío si el negocio ya tenía un diagnóstico guardado. */
  pendientes: PreguntaDiagnostico[];
  /** La pregunta del ÚLTIMO mensaje de MaKo, si todavía no se contestó. */
  abierta: string | null;
  /** El diagnóstico de ESTA conversación (con `diagnosticar`), o null si falta alguna respuesta. */
  diag: Diagnostico | null;
  /** El negocio ya tenía uno guardado (getDiagnosticoFase): se usa ése y no se pregunta nada. */
  yaGuardado: boolean;
};

type MensajeDiag = Pick<MensajeGuardado, 'de' | 'pregunta' | 'respuesta' | 'opciones'>;

export function estadoDiagnostico(mensajes: MensajeDiag[], opts: { canal: CanalId | null; yaGuardado: boolean }): EstadoDiagnostico {
  const respuestas: Record<string, number> = {};
  for (const m of mensajes) if (m.de === 'yo' && m.respuesta) respuestas[m.respuesta.preguntaId] = m.respuesta.idx;
  const idxCanal = respuestas[PREGUNTA_CANAL];
  const canalRespondido = !opts.canal && idxCanal != null ? (CANALES[idxCanal]?.id ?? null) : null;
  const canal = opts.canal ?? canalRespondido;
  const preguntas = preguntasDiagnostico(opts.canal, canalRespondido);
  const faltan = preguntas.filter((q) => respuestas[q.id] == null);
  let ultimoMako: MensajeDiag | undefined;
  for (let i = mensajes.length - 1; i >= 0; i--) if (mensajes[i].de === 'mako') { ultimoMako = mensajes[i]; break; }
  const idAbierta = ultimoMako?.pregunta?.id ?? null;
  const abierta = idAbierta && faltan.some((q) => q.id === idAbierta) ? idAbierta : null;
  const diag = faltan.length === 0 ? diagnosticar(PREGUNTAS.map((q) => respuestas[q.id]), canal ?? undefined) : null;
  return {
    preguntas, respuestas, canal,
    pendientes: opts.yaGuardado ? [] : faltan,
    abierta: opts.yaGuardado ? null : abierta,
    diag, yaGuardado: opts.yaGuardado,
  };
}

export type PlanDiagnostico =
  | { modo: 'no' }
  | { modo: 'ofrecer' | 'forzar'; pregunta: PreguntaDiagnostico; numero: number; total: number };

/**
 * ¿Toca una pregunta del diagnóstico en este turno? MaKo elige el momento (`ofrecer`), con tres redes que
 * la vuelven obligatoria (`forzar`):
 *   · el diagnóstico ya empezó → las preguntas van seguidas, como en el wizard (son toques rápidos);
 *   · ya están las piezas mínimas → el diagnóstico tiene que estar antes de armar la oferta;
 *   · el dueño ya mandó MENSAJES_ANTES_DEL_DIAGNOSTICO mensajes y MaKo todavía no lo empezó.
 * Si el dueño NO contestó la que quedó abierta (escribió otra cosa), este turno vuelve a `ofrecer`: insistir
 * con la misma pregunta mensaje tras mensaje es la fricción que el marco prohíbe. Y un turno que trae
 * DOCUMENTOS NUEVOS tampoco la fuerza: ese turno es para leer lo que mandó (con la obligatoria, el validar
 * del turno descarta a los proveedores que sólo leyeron el documento, y lo que sacaron se perdería).
 */
export function planDiagnostico(e: EstadoDiagnostico, c: { puedeConcluir: boolean; mensajesDelDueno: number; conDocumentosNuevos?: boolean }): PlanDiagnostico {
  const pregunta = e.pendientes[0];
  if (!pregunta) return { modo: 'no' };
  const contestadas = e.preguntas.filter((q) => e.respuestas[q.id] != null).length;
  const base = { pregunta, numero: contestadas + 1, total: e.preguntas.length };
  if (e.abierta || c.conDocumentosNuevos) return { modo: 'ofrecer', ...base };
  if (contestadas > 0 || c.puedeConcluir || c.mensajesDelDueno >= MENSAJES_ANTES_DEL_DIAGNOSTICO) return { modo: 'forzar', ...base };
  return { modo: 'ofrecer', ...base };
}

/** Los números de un texto, sin separadores («$3.000» y «3,000» son 3000). El cero no cuenta: «$0 – $3.000» se dice «menos de $3.000». */
const numerosDe = (s: string): string[] =>
  (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '')).filter((n) => n !== '0');

/**
 * Las opciones que se dibujan: las ADAPTADAS por la IA, mientras sigan siendo las originales.
 *
 *  · Tiene que haber exactamente tantas como originales, todas distintas: con una de más o de menos, o dos
 *    iguales, el orden ya no garantiza que la N sea la N, y se usan las originales enteras.
 *  · Cada adaptada tiene EXACTAMENTE los números de su original, uno a uno (los rangos de dinero y de
 *    cantidad son lo que la pregunta mide): «$3.000 – $10.000» puede pasar a «Entre $3.000 y $10.000 al
 *    mes», no a «unos 5 mil» ni a «$3.000 – $10.000 (unos 60 a 200 mil pesos)». La que los cambia, o
 *    viene vacía o larga, vuelve a su original — sólo ésa.
 *  · Y si al final dos opciones quedan iguales (o con los mismos números), se usan las originales enteras.
 * Es la segunda capa de la regla del prompt «no cambies los rangos»: el sentido de una frase no se puede
 * verificar, los números sí.
 *
 * ⚠️ IGUALES, NO «INCLUIDOS» (revisión adversarial del 11/10/2026). La primera versión aceptaba un
 *    SUPERCONJUNTO, y los rangos vecinos comparten un borde: una escala corrida un lugar («$3.000 –
 *    $10.000» en la posición 0, cuya original es «$0 – $3.000», que sin el cero pide sólo {3000}) pasaba en
 *    la 0 y las demás volvían a su original. Quedaban dos botones con el mismo rango, y el dueño que
 *    factura $5.000 tocaba el primero: idx 0, la banda de menos de $3.000, guardada en el diagnóstico del
 *    NEGOCIO. Y el chequeo de repetidas miraba las adaptadas ANTES de devolver cada una a su original.
 */
export function opcionesDiagnostico(original: string[], adaptadas: string[] | null | undefined): string[] {
  if (!Array.isArray(adaptadas) || adaptadas.length !== original.length) return [...original];
  const limpias = adaptadas.map((x) => colapsar(x));
  const norm = limpias.map((x) => normalizar(x));
  if (new Set(norm.filter(Boolean)).size !== norm.filter(Boolean).length) return [...original];
  const firma = (s: string) => [...new Set(numerosDe(s))].sort().join('|');
  const finales = original.map((o, i) => {
    const a = limpias[i];
    if (!a || a.length > TOPE_OPCION_DIAG) return o;
    return firma(a) === firma(o) ? a : o;
  });
  const textos = finales.map(normalizar);
  const numeros = finales.map(firma).filter(Boolean);
  if (new Set(textos).size !== textos.length || new Set(numeros).size !== numeros.length) return [...original];
  return finales;
}

/**
 * La respuesta del dueño a una pregunta del diagnóstico, validada: la pregunta existe, MaKo la hizo en algún
 * mensaje y el índice es una de sus opciones. Devuelve el texto de la opción que el dueño vio (la
 * adaptada), para cuando la pantalla manda el toque sin texto. null = no vale (se guarda como texto suelto).
 */
export function respuestaDiagnostico(
  mensajes: MensajeDiag[],
  r: { preguntaId?: unknown; idx?: unknown } | null | undefined,
  e: EstadoDiagnostico,
): { preguntaId: string; idx: number; texto: string } | null {
  if (!r || e.yaGuardado || typeof r.preguntaId !== 'string') return null;
  const q = e.preguntas.find((x) => x.id === r.preguntaId);
  const idx = typeof r.idx === 'number' ? r.idx : Number.NaN;
  if (!q || !Number.isInteger(idx) || idx < 0 || idx >= q.opciones.length) return null;
  let hecha: MensajeDiag | undefined;
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i].de === 'mako' && mensajes[i].pregunta?.id === q.id) { hecha = mensajes[i]; break; }
  }
  if (!hecha) return null;
  return { preguntaId: q.id, idx, texto: hecha.opciones?.[idx] ?? q.opciones[idx] };
}

/**
 * La respuesta que MaKo LEYÓ en las palabras del dueño (lo escribió o lo dictó en vez de tocar la opción):
 * se pega al último mensaje del dueño, marcada `inferida`, sólo si había una pregunta abierta y ese mensaje
 * no traía ya su respuesta.
 */
export function conRespuestaInferida(mensajes: MensajeGuardado[], e: EstadoDiagnostico, idx: number | null | undefined): { mensajes: MensajeGuardado[]; preguntaId: string | null } {
  const ultimo = mensajes[mensajes.length - 1];
  const q = e.abierta ? e.preguntas.find((x) => x.id === e.abierta) : undefined;
  if (!q || !ultimo || ultimo.de !== 'yo' || ultimo.respuesta || typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= q.opciones.length) {
    return { mensajes, preguntaId: null };
  }
  return { mensajes: [...mensajes.slice(0, -1), { ...ultimo, respuesta: { preguntaId: q.id, idx, inferida: true } }], preguntaId: q.id };
}

/** El bloque del diagnóstico que lee el modelo del turno. */
export function diagnosticoParaPrompt(plan: PlanDiagnostico, e: EstadoDiagnostico): string {
  const opciones = (q: PreguntaDiagnostico) => q.opciones.map((o, i) => `  ${i}) ${o}`).join('\n');
  const lineas: string[] = [];
  const abierta = e.abierta ? e.preguntas.find((q) => q.id === e.abierta) : undefined;
  if (abierta) {
    lineas.push(`QUEDÓ ABIERTA la pregunta «${abierta.id}» (${abierta.texto}) y el dueño no tocó ninguna opción. Si su último mensaje la contesta con sus palabras, devuelve en "diagnostico_respuesta" el número de la opción original que corresponde:\n${opciones(abierta)}`);
  }
  if (plan.modo === 'no') {
    if (!lineas.length) lineas.push('(No hay preguntas del diagnóstico pendientes: no lo menciones.)');
    return lineas.join('\n\n');
  }
  const q = plan.pregunta;
  lineas.push(`${plan.modo === 'forzar' ? 'OBLIGATORIA EN ESTE TURNO' : 'OPCIONAL (tú eliges el momento)'} — pregunta ${plan.numero} de ${plan.total}: «${q.id}» ${q.texto}\nOpciones originales, en este orden:\n${opciones(q)}`);
  return lineas.join('\n\n');
}

/**
 * El canal que se guarda en el diagnóstico del NEGOCIO (setDiagnosticoFase). Es el del NEGOCIO, no el de un
 * funnel: si la conversación es de un funnel secundario con canal propio (un taller presencial en un
 * negocio que vende por llamada), ese canal no puede quedar como «dónde cierra la venta» de todo el negocio
 * — lo heredan los funnels sin canal (`canalEfectivo`) y lo leen los guiones de audio.
 *
 *  · Si el dueño contestó la pregunta del canal en el chat, ése (es una respuesta sobre su negocio).
 *  · Si el canal vino del funnel por defecto, o del funnel de la conversación cuando ES el por defecto, ése.
 *  · Si vino del canal propio de un funnel secundario: ninguno (el voto de volumen igual vale: el índice
 *    mapea a la misma fase en todos los canales).
 */
export function canalParaElNegocio(
  e: Pick<EstadoDiagnostico, 'respuestas' | 'canal'>,
  funnel: { canal: CanalId | null; esDefault: boolean } | null,
): CanalId | undefined {
  if (!e.canal) return undefined;
  if (e.respuestas[PREGUNTA_CANAL] != null) return e.canal;
  if (!funnel || !funnel.canal || funnel.esDefault) return e.canal;
  return undefined;
}

/**
 * El diagnóstico de fase que VALE, en todos lados: el guardado en el negocio gana sobre el de la
 * conversación. Lo usan el contexto de los prompts (lib/offer-contexto.ts) y lo que se congela en la
 * conclusión y va al PDF (route.ts, `generar`). Con dos reglas, el dueño que rehízo el diagnóstico en el
 * onboarding después de contestarlo acá recibía un PDF que decía «Fase 1» con la tesis escrita para la 3
 * (revisión adversarial del 11/10/2026).
 */
export function faseVigenteDe(c: { faseGuardada: Diagnostico | null; faseSesion: Diagnostico | null }): Diagnostico | null {
  return c.faseGuardada ?? c.faseSesion ?? null;
}

/**
 * El valor del setting del diagnóstico de fase (`negocio.fase.diagnostico`), leído: el diagnóstico, o null
 * si no hay o no se entiende. Es la misma regla que `getDiagnosticoFase` (lib/fase-store.ts), que no la
 * exporta y lee con la lectura TOLERANTE; la ruta la necesita sobre una lectura ESTRICTA.
 */
export function faseDeSetting(raw: string | null): Diagnostico | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Diagnostico;
    return p && typeof p === 'object' && Array.isArray(p.respuestas) ? p : null;
  } catch {
    return null;
  }
}

/**
 * Cuántas preguntas del diagnóstico quedaron sin contestar, para que el PDF lo DIGA en vez de omitir la
 * sección en silencio. null si no falta nada (hay un diagnóstico, guardado o de la conversación).
 */
export function diagnosticoFaltante(e: EstadoDiagnostico): { contestadas: number; total: number } | null {
  if (e.yaGuardado || e.diag) return null;
  const contestadas = e.preguntas.filter((q) => e.respuestas[q.id] != null).length;
  return { contestadas, total: e.preguntas.length };
}

// ── v2: el audio largo, el link de la web y la espera del CAS ────────────────

/**
 * El mensaje del dueño cuando trae un audio: si lo escrito más la transcripción entran en el tope del chat,
 * van en el mensaje; si no, la transcripción ENTERA va como documento de la conversación (hasta el tope de
 * un documento) y el mensaje lleva el principio y lo dice. Nada se corta en silencio: el resto viaja
 * entero y el modelo lo lee como cualquier documento. Si la conversación ya no admite documentos
 * (`docsLibres` en 0), se recorta el mensaje y el corte queda escrito en el propio mensaje.
 *
 * ⚠️ La transcripción ya se pagó (una llamada de STT): contestar «es muy largo» después de transcribir
 *    la tiraría y habría que pagarla de nuevo (revisión adversarial del 11/10/2026).
 */
export function repartirTranscripcion(
  escrito: string, transcripcion: string,
  opts: { tope: number; topeDoc: number; docsLibres: number; inicio?: number },
): { cuerpo: string; doc: { texto: string; chars: number; aviso?: string } | null } {
  const junto = [escrito, transcripcion].filter((x) => x.trim()).join('\n\n');
  if (junto.length <= opts.tope) return { cuerpo: junto, doc: null };
  if (opts.docsLibres <= 0) {
    const sobra = junto.length - opts.tope;
    const nota = `\n\n[El audio sigue: quedaron afuera ${sobra.toLocaleString('es-MX')} caracteres porque la conversación ya tiene todos los documentos que admite.]`;
    return { cuerpo: `${junto.slice(0, Math.max(0, opts.tope - nota.length))}${nota}`, doc: null };
  }
  const largo = Math.min(opts.inicio ?? 1_500, opts.tope);
  const principio = recortar(transcripcion, largo);
  const cuerpo = [escrito, `${principio}\n\n(El audio sigue entero en el documento «Transcripción del audio».)`].filter((x) => x.trim()).join('\n\n');
  const recortado = transcripcion.length > opts.topeDoc;
  return {
    cuerpo,
    doc: {
      texto: transcripcion.slice(0, opts.topeDoc),
      chars: transcripcion.length,
      ...(recortado ? { aviso: `La transcripción tiene ${transcripcion.length.toLocaleString('es-MX')} caracteres: guardé los primeros ${opts.topeDoc.toLocaleString('es-MX')}.` } : {}),
    },
  };
}

/** Los parámetros de un link que no cambian la página que se ve (seguimiento de anuncios, de mails, de previews). */
const PARAM_DE_SEGUIMIENTO = /^(utm_[a-z0-9_]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|ttclid|yclid|twclid|igshid|mc_cid|mc_eid|_ga|_gl|_hs[a-z]+|hsa_[a-z]+|ref|ref_src|sfnsn|__lovable_load_id)$/i;

/**
 * La URL que se va a bajar para «pega el link de tu web»: LA que pegó el dueño, tal cual.
 *
 * ⚠️ Antes esto RECHAZABA el link si traía un parámetro propio («Copia el texto de la página y pégalo
 * aquí»), y era una limitación nuestra disfrazada de regla: `extraerLanding` sólo sabía bajar la URL
 * NORMALIZADA de Landing Analyst —sin `www.` y sin querystring—, así que un `?page_id=245` de un
 * WordPress sin permalinks habría bajado la HOME, otra oferta, y MaKo habría anotado piezas de ahí sin
 * decir nada. Rechazar era lo correcto mientras no hubiera alternativa; mandar a copiar el texto a mano
 * no lo era. Desde `extraerLanding(url, { talCual: true })` (lib/landing-fetch.ts) la alternativa existe.
 *
 * Lo único que se sigue sacando son los parámetros de SEGUIMIENTO: no cambian lo que se ve y ensucian el
 * nombre del documento. El `www.` se conserva — se baja el host que pegó, no uno parecido.
 */
export function linkParaLeer(url: string): { ok: true; leida: string } | { ok: false; error: string } {
  const bruto = url.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`);
  } catch {
    return { ok: false, error: 'Ese link no se puede abrir. Revisa que esté completo (por ejemplo, https://tusitio.com).' };
  }
  if (!u.hostname.includes('.')) {
    return { ok: false, error: 'Ese link no se puede abrir. Revisa que esté completo (por ejemplo, https://tusitio.com).' };
  }
  for (const k of [...u.searchParams.keys()]) if (PARAM_DE_SEGUIMIENTO.test(k)) u.searchParams.delete(k);
  u.hash = '';
  return { ok: true, leida: u.toString().replace(/\/$/, '') };
}

/**
 * La oferta que OTRO pedido ya anotó para esta versión (y que no es la que este pedido acaba de crear), o
 * null. Es la condición del compare-and-set de `guardarComoOferta` (lib/offer-sesiones.ts): si devuelve
 * una, gana ésa y la recién creada se borra. Dos pedidos de «Guardar» a la vez creaban dos ofertas iguales.
 */
export function ofertaYaAnotada(cur: { ofertaId: number | null; ofertaVersion: number | null }, version: number, propia: number): number | null {
  return cur.ofertaId != null && cur.ofertaVersion === version && cur.ofertaId !== propia ? cur.ofertaId : null;
}

/**
 * `OfferSesionVista.ligada`: false SÓLO si hay oferta guardada, la conversación tiene funnel y la lectura
 * dijo que falta la liga (`leida === false`). Una lectura que no se hizo o falló (`undefined`) es true:
 * invitar a reintentar en falso es peor que un «Guardada» de más.
 */
export function ligadaParaVista(f: { funnelId: number | null; ofertaId: number | null }, leida: boolean | undefined): boolean {
  if (f.funnelId == null || f.ofertaId == null) return true;
  return leida !== false;
}

/**
 * Cuántas veces reintenta el compare-and-set de una conversación y cuánto espera antes de cada vuelta.
 * Cinco intentos con una espera fija de 80-200 ms se rendían con 6-8 archivos subidos a la vez (medido por la
 * revisión: con filas grandes, el 68% de las tandas perdía uno). Diez, con espera creciente y azar.
 */
export const INTENTOS_CAS = 10;
export const esperaCAS = (intento: number, azar: number = Math.random()): number =>
  Math.min(1_500, 60 * 2 ** Math.max(0, intento)) + Math.floor(Math.max(0, Math.min(1, azar)) * 120);

// ── El turno ─────────────────────────────────────────────────────────────────

export type TurnoOffer = {
  respuesta: string;
  opciones: string[];
  piezas: Partial<Record<PiezaKey, string>>;
  /** Lo que dijo el modelo. NO decide nada: decide `faltanMinimas` sobre las piezas ya fusionadas. */
  listo: boolean;
  /** v2: la pregunta del diagnóstico ADAPTADA, si el modelo la hizo en este turno. Las opciones las valida `opcionesDiagnostico`. */
  diagnostico: { texto: string; opciones: string[] } | null;
  /** v2: el índice de la opción original que el modelo leyó en las palabras del dueño, o null. */
  diagnosticoRespuesta: number | null;
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

/** La pregunta del diagnóstico que adaptó el modelo: un texto con su «?» y una lista. La lista la juzga `opcionesDiagnostico`. */
function limpiarDiagnostico(v: unknown): TurnoOffer['diagnostico'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const t = texto(o.texto, 2000);
  if (!t || !t.includes('?') || pareceRazonamiento(t)) return null;
  const opciones = Array.isArray(o.opciones) ? o.opciones.map((x) => colapsar(x)) : [];
  return { texto: recortar(unaSolaPregunta(t), TOPE_PREGUNTA_DIAG), opciones };
}

/** Un índice de opción del diagnóstico (0-4), aunque venga como texto. */
function indiceDiag(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.trim()) : Number.NaN;
  return Number.isInteger(n) && n >= 0 && n < N_OPCIONES_DIAG ? n : null;
}

/**
 * El JSON del turno, o null si no sirve (la cascada prueba el próximo proveedor).
 *
 * La respuesta puede venir VACÍA sólo si el modelo hizo la pregunta del diagnóstico: en ese turno lo que se
 * dibuja es la pregunta (y la respuesta, si la hay, es un puente corto).
 */
export function parseTurno(raw: unknown): TurnoOffer | null {
  const o = aObjeto(raw);
  if (!o) return null;
  const crudo = texto(o.respuesta, 4000);
  if (crudo && pareceRazonamiento(crudo)) return null;
  const diagnostico = limpiarDiagnostico(o.diagnostico);
  if (!crudo && !diagnostico) return null;
  return {
    respuesta: crudo ? recortarRespuesta(unaSolaPregunta(crudo)) : '',
    opciones: limpiarOpciones(o.opciones),
    piezas: limpiarPiezas(o.piezas),
    listo: o.listo === true,
    diagnostico,
    diagnosticoRespuesta: indiceDiag(o.diagnostico_respuesta),
  };
}

/** Cuántas respuestas que sólo pasan el parse flojo acepta la cascada antes de cortar. */
export const FLOJOS_ANTES_DE_CORTAR = 2;

/**
 * El `validar` de la cascada con un RESPALDO: una respuesta que pasa `parse` se acepta y corta; una que
 * sólo pasa `parseFlojo` (sirve, pero sin lo que se pedía de más) se guarda —la primera— y la cascada sigue
 * buscando; a la `cortarTras`-ésima que sólo pasa el flojo, se corta. `resultado()` es la que pasó `parse`
 * o, si ninguna, el respaldo.
 *
 * Existe por el turno con la pregunta del diagnóstico OBLIGATORIA: con un validar que sólo aceptaba el
 * turno que la adaptaba, uno válido con las piezas que el dueño acababa de dar se tiraba entero y se
 * quemaba la cascada y la red de plataforma (revisión adversarial del 11/10/2026). Puro para tener test:
 * lib/offer-ia.ts es `server-only`.
 */
export function validadorConRespaldo<T>(
  parse: (raw: string) => T | null,
  parseFlojo?: (raw: string) => T | null,
  cortarTras: number = FLOJOS_ANTES_DE_CORTAR,
): { validar: (t: string) => boolean; resultado: () => T | null; fueRespaldo: () => boolean } {
  const caja: { valor: T | null; flojo: T | null; flojos: number } = { valor: null, flojo: null, flojos: 0 };
  return {
    validar: (t: string): boolean => {
      try {
        const v = parse(t);
        if (v != null) { caja.valor = v; return true; }
        const f = parseFlojo ? parseFlojo(t) : null;
        if (f == null) return false;
        if (caja.flojo == null) caja.flojo = f;
        caja.flojos += 1;
        return caja.flojos >= cortarTras;
      } catch { return false; }
    },
    resultado: () => caja.valor ?? caja.flojo,
    fueRespaldo: () => caja.valor == null && caja.flojo != null,
  };
}

/** El `validar` del turno cuando la pregunta del diagnóstico es OBLIGATORIA: sin ella, que conteste el próximo proveedor. */
export const parseTurnoConDiagnostico = (raw: unknown): TurnoOffer | null => {
  const t = parseTurno(raw);
  return t && t.diagnostico ? t : null;
};

/**
 * El mensaje de MaKo que se guarda, decidido por el CÓDIGO sobre lo que trajo el modelo.
 *
 *  · Si toca la pregunta del diagnóstico (obligatoria, u opcional y el modelo la hizo), el mensaje ES esa
 *    pregunta: el texto adaptado (o el original si el modelo no lo trajo, o lo trajo sin «?»), las opciones
 *    de `opcionesDiagnostico` y la marca `pregunta`. Sin «Armar mi oferta» entre las opciones: rompería la
 *    regla de que la opción N es la respuesta N. Lo que el modelo dijo antes va como puente sólo si no trae
 *    otra pregunta.
 *  · `turno` null (la IA falló) sólo llega con la pregunta obligatoria: sale la original, sin IA. El
 *    diagnóstico no se traba porque un proveedor no contestó.
 *  · `diagPara`: la pregunta para la que el modelo adaptó el texto. Si entre medio la pregunta que toca
 *    cambió (el modelo leyó la respuesta en las palabras del dueño), su adaptación no se usa.
 *  · Sin pregunta del diagnóstico y sin respuesta del modelo, sale la siguiente pregunta de la guía.
 */
export function mensajeDeMako(p: {
  turno: TurnoOffer | null; plan: PlanDiagnostico; piezas: PiezasSabidas; puedeConcluir: boolean;
  id: string; at: string; diagPara?: string | null;
}): MensajeSinAudio {
  const { turno, plan } = p;
  const hayRespuesta = !!turno?.respuesta.trim();
  if (plan.modo !== 'no') {
    const q = plan.pregunta;
    const d = turno?.diagnostico && (p.diagPara == null || p.diagPara === q.id) ? turno.diagnostico : null;
    if (plan.modo === 'forzar' || d || !hayRespuesta) {
      const pregunta = d?.texto && d.texto.includes('?') ? d.texto : q.texto;
      const puente = d && hayRespuesta && !turno!.respuesta.includes('?') ? turno!.respuesta : '';
      return {
        id: p.id, de: 'mako', at: p.at,
        texto: recortarRespuesta(puente ? `${puente} ${pregunta}` : pregunta),
        opciones: opcionesDiagnostico(q.opciones, d?.opciones),
        pregunta: { tipo: 'diagnostico', id: q.id },
      };
    }
  }
  if (turno && hayRespuesta) {
    const opciones = opcionesConCierre(turno.opciones, p.puedeConcluir);
    return { id: p.id, de: 'mako', texto: turno.respuesta, at: p.at, ...(opciones.length ? { opciones } : {}) };
  }
  const opciones = opcionesConCierre([], p.puedeConcluir);
  return {
    id: p.id, de: 'mako', at: p.at,
    texto: siguientePregunta(p.piezas) ?? '¿Hay algo más de tu oferta que quieras contarme antes de armarla?',
    ...(opciones.length ? { opciones } : {}),
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

/** Cuántos cambios lleva el diagnóstico (tarjeta «topes», 12/10/2026): tres, ni más ni menos. */
export const N_CAMBIOS = 3;

/**
 * El JSON del diagnóstico, o null. Exige las 9 dimensiones (una vez cada una) y al menos un cambio.
 *
 * Los cambios son TRES (§5 del marco): más de tres se cortan; con uno o dos, los que faltan quedan
 * «[completar]» a la vista. Se completan en vez de rechazar el diagnóstico porque rechazarlo quema la
 * cascada gratis por algo que no cambia ninguna nota.
 */
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
    .slice(0, N_CAMBIOS);
  if (!cambios.length) return null;
  while (cambios.length < N_CAMBIOS) {
    cambios.push({ titulo: `${MARCA_COMPLETAR} otro cambio con impacto`, porque: '', hipotesis: '' });
  }
  return {
    dimensiones: DIMENSION_IDS.map((id) => porId.get(id) as NotaDimension),
    tesis,
    fuerte: texto(o.fuerte, 320),
    cambios,
  };
}

/** Un número en un texto, con su escala: «3.000», «3,000», «2,5», «10k», «10 mil», «1,5 millones», «40%». */
const CIFRA_ESCALA = /\d+(?:[.,]\d+)*(?:\s?(?:k|mil|millones|mill[oó]n)(?![a-záéíóúñ]))?(?:\s?%)?/gi;

/**
 * El valor de una cifra como CLAVE comparable: «3.000», «3,000» y «3000» dan «3000»; «2,5» y «2.5» dan
 * «2.5»; «10k» y «10 mil» dan «10000». Un separador seguido de exactamente tres dígitos es de miles (la
 * forma de escribir montos en español y en inglés); con uno o dos, es decimal.
 */
export function claveCifra(token: string): string | null {
  const t = token.toLowerCase().trim().replace(/\s?%$/, '');
  const m = t.match(/^(\d+(?:[.,]\d+)*)(?:\s?(k|mil|millones|mill[oó]n))?$/);
  if (!m) return null;
  const num = m[1];
  let valor: number;
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(num)) valor = Number(num.replace(/[.,]/g, ''));
  else if (/^\d+[.,]\d{1,2}$/.test(num)) valor = Number(num.replace(',', '.'));
  else valor = Number(num.replace(/[.,]/g, ''));
  if (!Number.isFinite(valor)) return null;
  const escala = m[2] === 'k' || m[2] === 'mil' ? 1_000 : m[2] ? 1_000_000 : 1;
  return String(Math.round(valor * escala * 100) / 100);
}

/** Todas las cifras de unos textos, como claves (`claveCifra`). Es «lo que dio el negocio». */
export function cifrasDelNegocio(textos: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const t of textos) {
    for (const m of (t ?? '').matchAll(CIFRA_ESCALA)) {
      const k = claveCifra(m[0]);
      if (k) out.add(k);
    }
  }
  return out;
}

/** Lo que viene DESPUÉS de una cifra y la hace un plazo o una parte de la estructura, no un resultado. */
const UNIDAD_PLAZO = /^\s*(?:d[ií]as?|semanas?|mes(?:es)?|años?|horas?|minutos?|pasos?|fases?|etapas?|pilares?|m[oó]dulos?|sesi[oó]n(?:es)?|bonos?|niveles?|partes?|pagos?|cuotas?)(?![a-záéíóúñ])/i;
/** Lo que viene ANTES de una cifra y la hace un rótulo («Fase 1», «Paso 2», «Caso 3»), nunca un resultado. */
const ROTULO_ANTES = /(?:fase|paso|etapa|nivel|bono|m[oó]dulo|sesi[oó]n|caso|semana|mes|d[ií]a|versi[oó]n)\s*$/i;
/** Un año («de 2026»): no es una cifra del negocio. */
const ES_ANIO = /^20[2-3]\d$/;

/**
 * Pasa a «[completar]» toda cifra de `texto` que NO esté en `permitidas` (tarjeta «cifras», decisión de
 * Martín del 12/10/2026: «A»). Por CIFRA, no por pieza: antes, con cualquier dato en Prueba, todas sus
 * cifras pasaban, y «27 clientes duplicaron sus ventas» podía salir sin que nadie lo dijera.
 *
 *  · Nunca son cifras del negocio: un rótulo («Fase 1», «Caso 2») y un año.
 *  · Con `plazos`, tampoco lo que va seguido de un plazo o de una parte de la estructura («en 90 días»,
 *    «3 pasos»): eso lo PROPONE MaKo a sabiendas y va a «Lo que propuso MaKo», no a «[completar]». Se usa
 *    en la frase, los mensajes, los escenarios y la ecuación, donde lo que se revisa son las cifras de
 *    RESULTADOS. En la prueba, los bonos, el valor y los cupos se revisa todo.
 * Lo que NO ve: las cifras escritas con letras («tres clientes») — esa mitad queda en el prompt.
 */
export function filtrarCifras(texto: string, permitidas: Set<string>, opts: { plazos?: boolean } = {}): string {
  if (!texto || texto === MARCA_COMPLETAR) return texto;
  return texto.replace(CIFRA_ESCALA, (m: string, offset: number, todo: string) => {
    const k = claveCifra(m);
    if (!k || permitidas.has(k)) return m;
    if (ES_ANIO.test(m.trim())) return m;
    if (ROTULO_ANTES.test(todo.slice(0, offset))) return m;
    if (opts.plazos && UNIDAD_PLAZO.test(todo.slice(offset + m.length))) return m;
    return MARCA_COMPLETAR;
  });
}

/** ¿Tiene alguna cifra que no está en `permitidas`? (sin mirar rótulos ni años) */
const tieneCifraAjena = (texto: string, permitidas: Set<string>): boolean =>
  filtrarCifras(texto, permitidas) !== texto;

// ── Lo que se mide de las piezas (montos, porcentajes, cantidad de ofertas) ─────

export type Monto = { monto: number; moneda: 'USD' | 'MXN' | 'EUR' | null; texto: string };

const monedaDe = (t: string): Monto['moneda'] =>
  /\b(?:usd|us\$|d[oó]lar(?:es)?)\b/i.test(t) ? 'USD'
    : /\b(?:mxn|pesos?)\b/i.test(t) ? 'MXN'
      : /\beur\b|€|euros?\b/i.test(t) ? 'EUR' : null;

/**
 * Los montos de una pieza de texto libre: las cifras que no son un porcentaje, un plazo, una parte de la
 * estructura ni una cantidad de clientes. Es una lectura de HEURÍSTICA sobre lo que escribió el dueño: por
 * eso todo aviso que sale de acá dice los números que usó, para que el dueño vea si se leyó bien.
 */
function montosDe(valor: string | null | undefined): Monto[] {
  const t = (valor ?? '').trim();
  if (!t || esSinDato(t)) return [];
  const moneda = monedaDe(t);
  const out: Monto[] = [];
  for (const m of t.matchAll(CIFRA_ESCALA)) {
    const despues = t.slice((m.index ?? 0) + m[0].length);
    if (m[0].includes('%') || UNIDAD_PLAZO.test(despues) || /^\s*(?:clientes?|personas?|alumnos?|pacientes?|a la vez|por mes|al mes)\b/i.test(despues)) continue;
    const k = claveCifra(m[0]);
    if (!k) continue;
    out.push({ monto: Number(k), moneda, texto: m[0].trim() });
  }
  return out;
}

/** El precio de la pieza: el monto MÁS ALTO (en «2.500 USD o 2 pagos de 1.300» es 2.500). */
export function precioDe(valor: string | null | undefined): Monto | null {
  const xs = montosDe(valor);
  return xs.length ? xs.reduce((a, b) => (b.monto > a.monto ? b : a)) : null;
}

/** El costo de atender a un cliente: el PRIMER monto de la pieza (lo que viene después suele ser la capacidad). */
export function costoDe(valor: string | null | undefined): Monto | null {
  return montosDe(valor)[0] ?? null;
}

/** El % cobrado al firmar que dijo el dueño, o null: «50%», «la mitad», «todo de contado». */
export function porcentajeAlFirmar(valor: string | null | undefined): number | null {
  const t = (valor ?? '').trim();
  if (!t || esSinDato(t)) return null;
  const p = t.match(/(\d{1,3})\s?%/);
  if (p) {
    const n = Number(p[1]);
    return n >= 0 && n <= 100 ? n : null;
  }
  const n = normalizar(t);
  if (/\b(?:todo|completo|de contado|pago unico|un solo pago|al contado|100)\b/.test(n)) return 100;
  if (/\bla mitad\b/.test(n)) return 50;
  return null;
}

const NUMEROS_EN_LETRAS: Record<string, number> = { una: 1, uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

/**
 * Cuántas ofertas vende el dueño ADEMÁS de ésta, según la pieza `otras` (tarjeta «alertas»: la pregunta que
 * MaKo hace siempre). El turno la anota empezando por el número («0», «2: un curso y una mentoría»). null si
 * no la contestó o no se entiende: un dato que no se lee no cuenta para el aviso de foco.
 */
export function ofertasDeclaradas(valor: string | null | undefined): number | null {
  const t = (valor ?? '').trim();
  if (!t || esSinDato(t)) return null;
  const d = t.match(/\d+/);
  if (d) return Number(d[0]);
  const n = normalizar(t);
  if (/^(?:no|ninguna|ninguno|nada)\b|\bsolo (?:esta|esa|una)\b|\bunicamente esta\b|\bnada mas\b/.test(n)) return 0;
  const w = n.match(/\b(una|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
  return w ? NUMEROS_EN_LETRAS[w[1]] : null;
}

/** ¿El resultado tiene número y plazo? «10 clientes en 90 días» sí; «duplicar ventas en 3 meses» también. */
export function resultadoMedible(valor: string | null | undefined): boolean {
  const t = (valor ?? '').trim();
  if (!t || esSinDato(t)) return false;
  const plazo = /\d+\s*(?:d[ií]as?|semanas?|mes(?:es)?|años?)(?![a-záéíóúñ])|\b(?:una?|dos|tres|seis|doce)\s+(?:semanas?|mes(?:es)?|años?)\b/i;
  const m = t.match(plazo);
  if (!m) return false;
  const sinPlazo = t.replace(m[0], ' ');
  return /\d/.test(sinPlazo) || /\b(?:duplic|triplic|el doble|la mitad|el triple)/i.test(sinPlazo);
}

// ── El cálculo ───────────────────────────────────────────────────────────────

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const fmtMonto = (m: Monto): string => `${m.texto}${m.moneda && !/[a-z$€]/i.test(m.texto) ? ` ${m.moneda}` : ''}`;

/**
 * El «Check final» de Contreras (§4 del marco), DETERMINISTA (tarjeta «lista», decisión de Martín del
 * 12/10/2026: «A»). Antes «lista para vender» miraba sólo las notas, y con ese «lista» el negocio sale a
 * gastar en anuncios.
 *
 *  · dolor urgente: el problema anotado (no «sin dato») y la promesa (D2) en 7 o más;
 *  · resultado medible: la pieza resultado con número y plazo (`resultadoMedible`);
 *  · entregables concretos: anotados y la entrega sostenible (D6, «productizada») en 7 o más;
 *  · garantía fuerte: anotada y la certeza (D4) en 7 o más;
 *  · precio por valor: Precio y cobro (D7) en 7 o más.
 */
export function controlFinal(notas: Map<DimensionId, number>, piezas: PiezasSabidas): PuntoControlFinal[] {
  const n = (id: DimensionId) => notas.get(id) ?? 0;
  const resultado = piezas.resultado?.valor ?? '';
  return [
    {
      punto: 'dolor',
      ok: tieneDato(piezas, 'problema') && n('D2') >= 7,
      porque: !tieneDato(piezas, 'problema') ? 'Falta el dolor: qué le pasa a tu cliente cuando decide buscarte.'
        : n('D2') >= 7 ? 'El problema está claro y la promesa lo ataca.' : `La promesa saca ${n('D2')}: el dolor no se ve urgente o el resultado no se entiende.`,
    },
    {
      punto: 'resultado',
      ok: resultadoMedible(resultado),
      porque: resultadoMedible(resultado) ? 'El resultado tiene número y plazo.'
        : tieneDato(piezas, 'resultado') ? `El resultado no tiene número y plazo: «${recortar(colapsar(resultado), 90)}».` : 'Falta el resultado, con número y plazo.',
    },
    {
      punto: 'entregables',
      ok: tieneDato(piezas, 'entregables') && n('D6') >= 7,
      porque: !tieneDato(piezas, 'entregables') ? 'Faltan los entregables: qué recibe exactamente el cliente.'
        : n('D6') >= 7 ? 'Los entregables son concretos.' : `La entrega sostenible saca ${n('D6')}: los entregables, la duración o el soporte no están fijos.`,
    },
    {
      punto: 'garantia',
      ok: tieneDato(piezas, 'garantia') && n('D4') >= 7,
      porque: !tieneDato(piezas, 'garantia') ? 'No tiene garantía.'
        : n('D4') >= 7 ? 'La garantía es fuerte y hay casos que la respaldan.' : `La certeza saca ${n('D4')}: la garantía no es fuerte o faltan casos que la respalden.`,
    },
    {
      punto: 'precio',
      ok: n('D7') >= 7,
      porque: n('D7') >= 7 ? 'El precio sale del valor.' : `Precio y cobro saca ${n('D7')}: el precio no se justifica con el valor del resultado.`,
    },
  ];
}

/**
 * Lo que se calcula sobre las notas. Nunca lo escribe el modelo.
 *
 *  · total: el promedio × 10, redondeado (0-100).
 *  · cuello: la dimensión más baja; con empate, la que está más ARRIBA en el orden (D1 antes que D2):
 *    el marco dice que D1, D2 y D3 se apoyan una en la otra, así que lo de arriba se arregla primero.
 *  · lista: ninguna por debajo de 5, cliente, promesa y certeza (D1, D2, D4) en 7 o más y, con las
 *    piezas, el control final en ok. Sin piezas no hay control (la pestaña Criterio del Playbook calcula
 *    sólo con notas): la ruta las pasa SIEMPRE, y tests/offer-ia-cableado.test.ts lo fija.
 *  · alertas: la de foco (si la hay), las de D1/D2 en 3 o menos, y las que mande el que llama.
 */
export function calcularDiagnostico(
  dims: NotaDimension[],
  extras: { foco?: string | null; otras?: Array<string | null | undefined>; piezas?: PiezasSabidas } = {},
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
  const porNotas = presentes.length === DIMENSION_IDS.length
    && presentes.every((id) => (notas.get(id) as number) >= 5)
    && DIMENSIONES_CRITICAS.every((id) => (notas.get(id) ?? 0) >= 7);
  const control = extras.piezas ? controlFinal(notas, extras.piezas) : undefined;
  const lista = porNotas && (!control || control.every((c) => c.ok));
  const alertas: string[] = [];
  if (extras.foco?.trim()) alertas.push(extras.foco.trim());
  for (const id of ['D1', 'D2'] as const) {
    const n = notas.get(id);
    if (n != null && n <= 3) alertas.push(`${dimensionLabel(id)} saca ${n}: el precio y los bonos de la oferta nueva quedan provisionales hasta arreglarlo.`);
  }
  for (const a of extras.otras ?? []) if (a?.trim()) alertas.push(a.trim());
  return { total, cuello, lista, alertas: [...new Set(alertas)], ...(control ? { controlFinal: control } : {}) };
}

/**
 * La regla de FOCO de Martín (05/08/2026): «si alguien que no factura ni 5k al mes tiene 20
 * productos… Fase 1: un anuncio ganador para una oferta».
 *
 * `bandaFacturacion` es la respuesta 0 del diagnóstico de fase (lib/fase-diagnostico.ts,
 * `Diagnostico.respuestas[0]`): 0 = $0-3.000, 1 = $3.000-10.000, 2-4 = 10.000 o más. null = no lo contestó.
 *
 * 12/10/2026 (tarjeta «foco», decisión de Martín: «A»): sale desde TRES ofertas también con la facturación
 * desconocida (antes, con 6: el marco dice que con 3 ya es mala nota); con 10.000 o más al mes no sale.
 * Y el conteo suma las ofertas que el dueño dijo que vende aunque no estén cargadas en MaKo
 * (`otrasDeclaradas`, la pieza `otras`: ésta más las otras).
 *
 * ⚠️ EL UMBRAL ES UN PROXY Y NO ESTÁ MEDIDO contra los negocios reales: un catálogo de «productos» puede
 * tener variantes de precio de UNA oferta, y eso no es falta de foco. Por eso la pregunta de las otras
 * ofertas: lo que dice el dueño es mejor dato que lo que está cargado.
 */
export function alertaFoco(p: { productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null; otrasDeclaradas?: number | null }): string | null {
  const prods = Math.max(0, Math.floor(Number(p.productosActivos) || 0));
  const ofs = Math.max(0, Math.floor(Number(p.ofertasActivas) || 0));
  const decl = typeof p.otrasDeclaradas === 'number' && p.otrasDeclaradas >= 0 ? Math.floor(p.otrasDeclaradas) + 1 : 0;
  const n = Math.max(prods, ofs, decl);
  const b = p.bandaFacturacion;
  const conocida = typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 4;
  if (conocida && (b as number) >= 2) return null;
  if (n < 3) return null;
  const que = decl >= prods && decl >= ofs ? `Vendes ${decl} ofertas (contando las que no están cargadas en MaKo)`
    : prods >= ofs ? `Tienes ${prods} productos activos` : `Tienes ${ofs} ofertas activas`;
  // El monto se dice en la MISMA unidad de la pregunta que el dueño contestó («$0 – $3.000»).
  const factura = !conocida ? '' : b === 0 ? ' y tu negocio factura menos de $3.000 al mes' : ' y tu negocio factura menos de $10.000 al mes';
  return `${que}${factura}: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.`;
}

/**
 * El margen bruto con el precio y el costo que dio el dueño (tarjeta «alertas»): por debajo de 60%, aviso
 * (el objetivo es 80%, §6.1). Sólo con los dos montos leídos y en la misma moneda; el aviso dice los
 * números que usó.
 */
export function alertaMargen(piezas: PiezasSabidas): string | null {
  const precio = precioDe(piezas.precio?.valor);
  const costo = costoDe(piezas.costo?.valor);
  if (!precio || !costo || precio.monto <= 0) return null;
  if (precio.moneda && costo.moneda && precio.moneda !== costo.moneda) return null;
  const margen = (precio.monto - costo.monto) / precio.monto;
  if (margen >= 0.6) return null;
  return `Con un precio de ${fmtMonto(precio)} y un costo de ${fmtMonto(costo)} por cliente, el margen bruto queda en ${pct(Math.max(0, margen))}: por debajo de 60% (el objetivo es 80%).`;
}

/** Las tasas del embudo que se usan para los avisos (salen de lib/analisis-negocio.ts). */
export type TasasEmbudo = { show: number | null; cierreCalificados: number | null; cierreAsistencias: number | null; asistieron: number };

/** Con menos asistencias que esto, una tasa es ruido. */
export const MIN_ASISTENCIAS_EMBUDO = 10;

/**
 * Dónde se cortan las ventas, contra los rangos del §6.4 (asistencia 60-80%, cierre 25-40% de las
 * llamadas calificadas): «la oferta es lo último que se corrige». Sin datos suficientes, nada.
 */
export function alertasEmbudo(t: TasasEmbudo | null | undefined): string[] {
  if (!t || t.asistieron < MIN_ASISTENCIAS_EMBUDO) return [];
  const out: string[] = [];
  if (t.show != null && t.show < 0.6) {
    out.push(`Asiste el ${pct(t.show)} de los que agendan: por debajo de 60% (lo sano es de 60% a 80%). Las ventas se cortan antes de la llamada: antes de cambiar la oferta, revisa cómo se confirman las agendas.`);
  }
  const cierre = t.cierreCalificados ?? t.cierreAsistencias;
  if (cierre != null && cierre < 0.25) {
    out.push(`Cierras el ${pct(cierre)} de las llamadas: por debajo de 25% (lo sano es de 25% a 40%). Las ventas se cortan en la llamada: antes de cambiar la oferta, revisa el cierre.`);
  }
  return out;
}

/**
 * Cuándo subir (o no tocar) el precio, con las señales del §6.2: el % cobrado al firmar que dijo el dueño
 * y el cierre del embudo. Cada aviso dice el número que lo dispara.
 */
export function alertasPrecio(p: { cobro: number | null; tasas?: TasasEmbudo | null }): string[] {
  const out: string[] = [];
  if (p.cobro != null && p.cobro > 75) {
    out.push(`Te pagan el ${p.cobro}% al firmar: más de 75% es señal de que el precio está barato. Súbelo por escalones (entre 250 y 1.000 USD, o un 20%, cada 3 a 5 ventas sin fricción).`);
  } else if (p.cobro != null && p.cobro < 50) {
    out.push(`Te pagan el ${p.cobro}% al firmar: menos de la mitad. Antes de tocar el precio, revisa el cliente ideal y el valor.`);
  }
  const t = p.tasas;
  if (t && t.asistieron >= MIN_ASISTENCIAS_EMBUDO && t.cierreCalificados != null && t.cierreCalificados > 0.3) {
    out.push(`Cierras el ${pct(t.cierreCalificados)} de las llamadas calificadas: más de 30% es señal de que hay margen para subir el precio.`);
  }
  return out;
}

/**
 * Todos los avisos que el CÓDIGO calcula antes del diagnóstico, en orden: foco, margen, embudo, precio. Los
 * lee la IA que pone las notas (tarjeta «foco»: «se calcula ANTES del diagnóstico») y quedan en el cálculo.
 */
export function avisosAntesDelDiagnostico(p: {
  foco: { productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null };
  piezas: PiezasSabidas; tasas?: TasasEmbudo | null;
}): { foco: string | null; otras: string[] } {
  const foco = alertaFoco({ ...p.foco, otrasDeclaradas: ofertasDeclaradas(p.piezas.otras?.valor) });
  const margen = alertaMargen(p.piezas);
  return {
    foco,
    otras: [...(margen ? [margen] : []), ...alertasEmbudo(p.tasas), ...alertasPrecio({ cobro: porcentajeAlFirmar(p.piezas.cobro?.valor), tasas: p.tasas })],
  };
}

// ── La oferta provisional y el PDF en el chat (tarjeta «rehacer») ─────────────

export const OPCION_PULIR = 'Pulir la oferta';
export const OPCION_ASI_ESTA_BIEN = 'Así está bien';

/**
 * Con el Cliente ideal o la Promesa en 3 o menos, la oferta sale completa pero con el precio y los bonos
 * PROVISIONALES (decisión de Martín del 12/10/2026, tarjeta «rehacer»: «C»). null si no aplica.
 */
export function provisionalDe(d: Pick<DiagnosticoOferta, 'dimensiones'>): { partes: Array<'precio' | 'bonos'>; motivo: string } | null {
  const bajas = d.dimensiones.filter((x) => (x.id === 'D1' || x.id === 'D2') && x.nota <= 3);
  if (!bajas.length) return null;
  const que = bajas.map((x) => `${dimensionLabel(x.id)} saca ${x.nota}`).join(' y ');
  return { partes: ['precio', 'bonos'], motivo: `${que}: el precio y los bonos dependen de arreglar eso primero.` };
}

/**
 * El mensaje de MaKo con el PDF de una versión (pedido de Martín, 12/10/2026: «que MaKo en el mismo chat te
 * proponga pulir la oferta, y que cuando se haya pulido te re-envíe el PDF las veces que sea necesario»).
 * Lo agrega el servidor después de cada «generar». Propone empezar por lo provisional; si no hay, por el
 * cuello de botella; si está lista, ofrece pulirla igual.
 */
export function mensajePdf(p: {
  version: number; dimensiones: NotaDimension[]; cuello: DimensionId; lista: boolean; id: string; at: string;
}): MensajeSinAudio {
  const bajas = p.dimensiones.filter((x) => (x.id === 'D1' || x.id === 'D2') && x.nota <= 3);
  const empezar = bajas.length
    ? `Empezaría por ${bajas.map((x) => `«${dimensionLabel(x.id)}»`).join(' y ')}: el precio y los bonos de esta versión son provisionales hasta arreglarlo.`
    : p.lista ? 'Está lista para vender; si quieres, la pulimos igual.'
      : `Empezaría por «${dimensionLabel(p.cuello)}», que es lo que más la frena.`;
  return {
    id: p.id, de: 'mako', at: p.at,
    texto: `Aquí está la versión ${p.version} de tu oferta, en PDF. ¿La pulimos? ${empezar}`,
    opciones: [OPCION_PULIR, OPCION_ASI_ESTA_BIEN],
    pdf: { version: p.version },
  };
}

/**
 * La conclusión de una versión, para GET /api/offer/pdf?id=&v=. Sin versión, la más alta. Una versión que
 * la sesión no tiene es null: nunca se cae a otra (bajar la v2 cuando se pidió la v1 es entregar un
 * documento que dice otra cosa con el nombre del que se pidió).
 */
export function conclusionDeVersion<T extends { version: number }>(conclusiones: readonly T[], version: number | null): T | null {
  if (!conclusiones.length) return null;
  if (version == null) return conclusiones.reduce((a, b) => (b.version > a.version ? b : a));
  return conclusiones.find((c) => c.version === version) ?? null;
}

/**
 * Lo que MaKo contesta SIN IA. Hoy, uno: «Así está bien» después de un PDF (no hay nada que preguntar y
 * pagar un modelo por un «perfecto» no le compra nada al dueño). null = contesta la IA.
 */
export function respuestaSinIA(mensajes: Array<Pick<MensajeGuardado, 'de' | 'pdf'>>, texto: string, p: { id: string; at: string }): MensajeSinAudio | null {
  if (normalizar(texto) !== normalizar(OPCION_ASI_ESTA_BIEN)) return null;
  const ultimoMako = [...mensajes].reverse().find((m) => m.de === 'mako');
  if (!ultimoMako?.pdf) return null;
  return {
    id: p.id, de: 'mako', at: p.at,
    texto: `Perfecto: la versión ${ultimoMako.pdf.version} es la final. Puedes guardarla como tu oferta, o volver a pulirla cuando quieras.`,
    opciones: [OPCION_PULIR],
  };
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

/** Lo que queda en el valor total cuando trae una cifra que el negocio no dio. */
export const VALOR_TOTAL_SIN_DATO = `${MARCA_COMPLETAR} la suma del valor de cada entregable y bono (de 4 a 5 veces el precio o más).`;

/** Los topes de las listas del marco (tarjeta «topes», 12/10/2026). */
export const TOPES_PROPUESTA = { fasesMin: 3, fasesMax: 5, bonosMin: 1, bonosMax: 3, nombresMin: 2, nombresMax: 3 } as const;

/** La duración del programa en días, del primer «N días / semanas / meses / años» de un texto. */
export function duracionEnDias(texto: string): number | null {
  const m = (texto ?? '').match(/(\d+)\s*(d[ií]as?|semanas?|mes(?:es)?|años?)(?![a-záéíóúñ])/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  return u.startsWith('d') ? n : u.startsWith('s') ? n * 7 : u.startsWith('m') ? n * 30 : n * 365;
}

/** El contexto con el que se revisa la propuesta: de dónde salen las cifras que SÍ dio el negocio, y su nombre. */
export type ContextoReglas = {
  /** Los textos del negocio además de las piezas: los mensajes del dueño, los documentos y el contexto cargado. */
  fuentes?: Array<string | null | undefined>;
  /** El nombre del negocio: ningún nombre del método puede llevarlo (§2.5). */
  negocio?: string;
};

const PROPUESTA_SUFIJO = '(propuesta)';
const NOMBRE_METODO_SIN_DATO = `${MARCA_COMPLETAR} otro nombre descriptivo ${PROPUESTA_SUFIJO}`;

/**
 * Las reglas del marco que el código puede verificar sobre la propuesta (la segunda capa).
 *
 *  1. URGENCIA: si el dueño nunca la dio, queda «[completar]» con cómo armar una real. Si la dio, sus cupos
 *     y fechas se revisan por cifra.
 *  2. CIFRAS (tarjeta «cifras», 12/10/2026): por CIFRA, contra lo que dio el negocio (las piezas, lo que
 *     escribió el dueño, sus documentos y lo que tenía cargado). En la prueba, los valores de los bonos, el
 *     valor total, el stack de «cómo decirlo» y los cupos se revisa toda cifra; en la frase, los mensajes,
 *     los escenarios y la ecuación, las de resultados (un plazo o la cantidad de pasos los propone MaKo).
 *  3. REGLAS QUE ANTES DEPENDÍAN DE LA IA (tarjeta «reglas-ia»): los nombres del método llevan
 *     «(propuesta)» y nunca el nombre del negocio ni el de la oferta (se corrige); una garantía
 *     incondicional pierde sus condiciones y se marca; la duración fuera de 90 a 180 días y el precio por
 *     debajo de 1.000 USD se avisan (no se pueden corregir sin inventar).
 *  4. LO QUE PROPUSO MaKo (tarjeta «supuestos»): lo que dijo el modelo más lo que el código sabe con certeza
 *     (el precio con cifras que el negocio no dio, la garantía y los bonos que el dueño no tenía, los
 *     nombres del método, las fases y los plazos de la frase).
 *  5. SUPUESTOS: lo que el dueño dijo que no sabe («sin dato»), a la vista.
 *  6. COMPLETAR: todo campo con la marca queda listado, sin duplicar. Lo arma el código y no el modelo.
 *
 * «sin dato: …» cuenta como que el dueño NO lo dio (`tieneDato`).
 */
export function aplicarReglasPropuesta(p: PropuestaOferta, piezas: PiezasSabidas, ctx: ContextoReglas = {}): PropuestaOferta {
  const deLasPiezas = PIEZA_KEYS.filter((k) => tieneDato(piezas, k)).map((k) => piezas[k]?.valor);
  const permitidas = cifrasDelNegocio([...deLasPiezas, ...(ctx.fuentes ?? [])]);
  const conPropuesta = new Set([...permitidas, ...cifrasDelNegocio([p.inversion.precio, p.inversion.contado, p.inversion.plan])]);
  const res = (t: string) => filtrarCifras(t, permitidas, { plazos: true });
  const estricto = (t: string) => filtrarCifras(t, permitidas);
  const avisos: string[] = [];

  const out: PropuestaOferta = {
    ...p,
    frase: res(p.frase),
    mensajes: { corto: res(p.mensajes.corto), largo: res(p.mensajes.largo), entrada: res(p.mensajes.entrada) },
    prueba: estricto(p.prueba),
    bonos: p.bonos.map((b) => ({ ...b, valor: tieneCifraAjena(b.valor, permitidas) ? MARCA_COMPLETAR : b.valor })),
    inversion: {
      ...p.inversion,
      valorTotal: tieneCifraAjena(p.inversion.valorTotal, permitidas) ? VALOR_TOTAL_SIN_DATO : p.inversion.valorTotal,
      comoDecirlo: filtrarCifras(p.inversion.comoDecirlo, conPropuesta),
    },
    urgencia: tieneDato(piezas, 'urgencia') ? estricto(p.urgencia) : URGENCIA_SIN_DATO,
    escenarios: { mejor: res(p.escenarios.mejor), peor: res(p.escenarios.peor) },
    ecuacion: p.ecuacion.map((f) => ({ ...f, antes: res(f.antes), despues: res(f.despues) })),
    mecanismo: { ...p.mecanismo, nombres: [...p.mecanismo.nombres] },
    garantia: { ...p.garantia },
  };

  // Los nombres del método: propuestas, sin el nombre del negocio ni el de la oferta.
  const prohibidos = [ctx.negocio, out.nombre].map((x) => normalizar(x ?? '')).filter((x) => x.length >= 3);
  out.mecanismo.nombres = out.mecanismo.nombres.map((nm) => {
    if (nm.includes(MARCA_COMPLETAR)) return nm;
    const n = normalizar(nm.replace(/\(propuesta\)/i, ''));
    if (prohibidos.some((x) => n === x || n.includes(x))) return NOMBRE_METODO_SIN_DATO;
    return /\(propuesta\)\s*$/i.test(nm) ? nm : `${nm} ${PROPUESTA_SUFIJO}`;
  });

  // La garantía nunca incondicional en high ticket: se le sacan las condiciones y se marca.
  const textoGarantia = `${out.garantia.nombre} ${out.garantia.condiciones} ${out.garantia.siNoCumple}`;
  if (/incondicional|sin (?:hacer )?preguntas|sin condiciones/i.test(textoGarantia)) {
    out.garantia.condiciones = `${MARCA_COMPLETAR} lo que el cliente tiene que cumplir para reclamarla (asistir, hacer las tareas)`;
    if (/incondicional/i.test(out.garantia.nombre)) out.garantia.nombre = `${MARCA_COMPLETAR} el nombre de la garantía`;
    avisos.push('La garantía que escribió la IA era incondicional: en high ticket va atada a que el cliente cumpla el método. Completa sus condiciones.');
  }

  // La duración del programa (90 a 180 días) y el precio de lista (desde 1.000 USD): se avisan.
  const dias = duracionEnDias(out.formato);
  if (dias != null && (dias < 90 || dias > 180)) {
    avisos.push(`El programa dura ${dias} días según el formato: el marco pide de 90 a 180 días, con un resultado definido.`);
  }
  const precio = out.inversion.precio.includes(MARCA_COMPLETAR) ? null : precioDe(out.inversion.precio);
  if (precio && precio.monto < 1_000 && precio.moneda !== 'EUR') {
    avisos.push(`El precio de lista (${fmtMonto(precio)}) está por debajo de 1.000 USD, el piso del high ticket.`);
  }

  out.propuestoPorMako = propuestoPorMako(out, piezas, permitidas, p.propuestoPorMako ?? []);
  out.supuestos = PIEZAS
    .filter((x) => esSinDato(piezas[x.key]?.valor ?? ''))
    .map((x) => {
      const dijo = colapsar((piezas[x.key]?.valor ?? '').replace(/^\s*sin dato\s*:?\s*/i, ''));
      return `${x.label}: ${dijo ? recortar(dijo, 140) : 'no lo sabía'}`;
    });
  out.avisos = avisos;
  out.completar = listaCompletar(out);
  return out;
}

/** Cuánto entra en «Lo que propuso MaKo». */
const MAX_PROPUESTO = 14;

/**
 * Lo que MaKo propuso y el negocio no dijo: primero lo que el código sabe con certeza, después lo que dijo
 * el modelo (sin repetir).
 */
function propuestoPorMako(
  p: PropuestaOferta, piezas: PiezasSabidas, permitidas: Set<string>, delModelo: Array<{ seccion: string; que: string }>,
): Array<{ seccion: string; que: string }> {
  const seguros: Array<{ seccion: string; que: string }> = [];
  if (!p.inversion.precio.includes(MARCA_COMPLETAR) && tieneCifraAjena(p.inversion.precio, permitidas)) {
    seguros.push({ seccion: 'Inversión', que: `Precio: ${recortar(p.inversion.precio, 160)}` });
  }
  if (!tieneDato(piezas, 'garantia') && !p.garantia.nombre.includes(MARCA_COMPLETAR)) {
    seguros.push({ seccion: 'Garantía', que: recortar(`${p.garantia.nombre}: ${p.garantia.condiciones}`, 200) });
  }
  const nombres = p.mecanismo.nombres.filter((n) => !n.includes(MARCA_COMPLETAR));
  if (nombres.length) seguros.push({ seccion: 'Método', que: `Nombres: ${nombres.map((n) => n.replace(/\s*\(propuesta\)\s*$/i, '')).join(' · ')}` });
  const fases = p.ruta.filter((f) => !f.fase.includes(MARCA_COMPLETAR));
  if (fases.length) seguros.push({ seccion: 'Ruta', que: `${fases.length} ${fases.length === 1 ? 'fase' : 'fases'}: ${fases.map((f) => f.fase).join(' · ')}` });
  if (!tieneDato(piezas, 'bonos')) {
    for (const b of p.bonos) if (!b.nombre.includes(MARCA_COMPLETAR)) seguros.push({ seccion: 'Bonos', que: b.nombre });
  }
  const plazos = [...p.frase.matchAll(/(\d+(?:[.,]\d+)*)\s*(d[ií]as?|semanas?|mes(?:es)?|años?)(?![a-záéíóúñ])/gi)]
    .filter((m) => { const k = claveCifra(m[1]); return !!k && !permitidas.has(k); });
  for (const m of plazos) seguros.push({ seccion: 'La frase', que: `Plazo: ${m[0]}` });

  const out: Array<{ seccion: string; que: string }> = [];
  const vistas = new Set<string>();
  for (const x of [...seguros, ...delModelo]) {
    const seccion = recortar(colapsar(x.seccion), 60);
    const que = recortar(colapsar(x.que), 240);
    if (!que) continue;
    const k = normalizar(que);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push({ seccion: seccion || 'Oferta', que });
    if (out.length >= MAX_PROPUESTO) break;
  }
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
 * «[completar]» a la vista. Los topes de las listas son los del marco (tarjeta «topes», 12/10/2026): de 3 a
 * 5 fases (se corta a 5; con menos de 3, las que faltan quedan «[completar]»), de 1 a 3 bonos (sin bonos,
 * uno «[completar]») y 2 o 3 nombres para el método (con menos, los que faltan quedan «[completar]»).
 */
export function parsePropuesta(raw: unknown, piezas: PiezasSabidas, ctx: ContextoReglas = {}): PropuestaOferta | null {
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
  const T = TOPES_PROPUESTA;
  const ruta: FaseRuta[] = objetos(o.ruta, 12)
    .map((f) => ({ fase: texto(f.fase, 120), objetivo: campo(f.objetivo, 300), hito: campo(f.hito, 300) }))
    .filter((f) => f.fase)
    .slice(0, T.fasesMax);
  while (ruta.length < T.fasesMin) ruta.push({ fase: `${MARCA_COMPLETAR} Fase ${ruta.length + 1}`, objetivo: MARCA_COMPLETAR, hito: MARCA_COMPLETAR });
  const incluye: Entregable[] = objetos(o.incluye, 12)
    .map((e) => ({ nombre: texto(e.nombre, 160), beneficio: campo(e.beneficio, 300) }))
    .filter((e) => e.nombre);
  const bonos: BonoPropuesto[] = objetos(o.bonos, 12)
    .map((b) => ({ nombre: texto(b.nombre, 160), objecion: campo(b.objecion, 300), valor: campo(b.valor, 120) }))
    .filter((b) => b.nombre)
    .slice(0, T.bonosMax);
  if (bonos.length < T.bonosMin) bonos.push({ nombre: `${MARCA_COMPLETAR} un bono que ataque una objeción concreta`, objecion: MARCA_COMPLETAR, valor: MARCA_COMPLETAR });
  const nombres = lista(me.nombres, T.nombresMax, 120);
  while (nombres.length < T.nombresMin) nombres.push(NOMBRE_METODO_SIN_DATO);
  // Una fila por variable (la primera que venga), y sólo las cuatro de la ecuación de valor.
  const ecuacion: EcuacionFila[] = [];
  for (const f of objetos(o.ecuacion, 8)) {
    const variable = (typeof f.variable === 'string' ? f.variable.trim().toLowerCase() : '') as VariableValor;
    if (!VARIABLES.includes(variable) || ecuacion.some((e) => e.variable === variable)) continue;
    ecuacion.push({ variable, antes: campo(f.antes, 300), despues: campo(f.despues, 300) });
  }
  const propuesto = objetos(o.propuestoPorMako, 20)
    .map((x) => ({ seccion: texto(x.seccion, 60), que: texto(x.que, 240) }))
    .filter((x) => x.que);
  const base: PropuestaOferta = {
    nombre,
    frase,
    mensajes: { corto: campo(m.corto, 120), largo: campo(m.largo, 600), entrada: campo(m.entrada, 300) },
    paraQuien: { perfil: campo(pq.perfil, 600), minimo: campo(pq.minimo, 400), noEs: campo(pq.noEs, 400) },
    problema: { hoy: campo(pr.hoy, 600), despues: campo(pr.despues, 600), obstaculos: lista(pr.obstaculos, 6), yaProbo: campo(pr.yaProbo, 500) },
    mecanismo: { nombres, pasos: lista(me.pasos, 8), distinto: campo(me.distinto, 600) },
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
    propuestoPorMako: propuesto,
  };
  return aplicarReglasPropuesta(base, piezas, ctx);
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
/** Lo que el prompt lee de un mensaje: le da igual si es la forma guardada o la de la pantalla. */
export type MensajeParaPrompt = Pick<OfferMensaje, 'de' | 'texto' | 'adjuntos'> & { audio?: unknown };

export function conversacionParaPrompt(mensajes: MensajeParaPrompt[], max = MAX_MENSAJES_PROMPT): string {
  const ult = mensajes.slice(-max);
  const lineas = ult.map((m) => {
    // «por audio»: el texto es una transcripción, y el modelo tiene que poder dudar de una palabra rara.
    const quien = m.de === 'yo' ? (m.audio ? 'DUEÑO (por audio)' : 'DUEÑO') : 'MaKo';
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
export function docsDeLaConversacion<T extends { id: string }>(docs: T[], mensajes: Array<{ adjuntos?: AdjuntoVista[] }>, nuevos: readonly string[] = []): T[] {
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

// ── v2: el árbol del selector ────────────────────────────────────────────────

/** Un funnel como lo da `leerFunnels()` (lib/funnels.ts): el nombre que se muestra es el del producto, si lo hay. */
export type FunnelParaArbol = { id: number; nombre: string; producto?: string | null };
/** Una conversación con lo que decide dónde cuelga. `ofertaId` es la columna cruda (la última versión guardada). */
export type SesionParaArbol = OfferSesionResumen & { funnelId: number | null; ofertaId: number | null; ofertaBaseId: number | null };

/**
 * El árbol funnel → ofertas → conversaciones. Puro: lo arma el CÓDIGO con las cuatro listas leídas.
 *
 *  · El nombre de un funnel es el de su producto principal, si no el suyo (lo mismo que el desplegable del
 *    CRM: «Funnel principal» lo pone la migración y es igual para todos).
 *  · Las ofertas de un funnel salen de `funnel_ofertas`, la principal primero y después por `orden`. Una
 *    liga a una oferta que no está en `ofertas` (inactiva o borrada) no se dibuja.
 *  · Una conversación cuelga de la oferta que GUARDÓ (si está en su funnel), si no de la que ANALIZABA
 *    (si está en su funnel), si no va a «nuevas» de su funnel. Sin funnel, o con un funnel que ya no
 *    está (archivado), va a «sueltas». Cada conversación aparece UNA vez: ninguna se pierde porque le
 *    cambiaron una liga.
 *  · Adentro de cada lista, la más reciente primero.
 */
export function construirArbol(e: {
  funnels: FunnelParaArbol[];
  ofertas: Array<{ id: number; nombre: string }>;
  ligas: Array<{ funnel_id: number; oferta_id: number; es_principal: boolean; orden: number }>;
  sesiones: SesionParaArbol[];
}): ArbolOffer {
  const resumen = (s: SesionParaArbol): OfferSesionResumen => ({ id: s.id, titulo: s.titulo, estado: s.estado, total: s.total, updatedAt: s.updatedAt });
  const recientes = (a: SesionParaArbol, b: SesionParaArbol) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || b.id - a.id;
  const nombreOferta = new Map(e.ofertas.map((o) => [o.id, o.nombre] as const));
  const funnels: ArbolOffer['funnels'] = e.funnels.map((f) => {
    const ligas = e.ligas
      .filter((l) => l.funnel_id === f.id && nombreOferta.has(l.oferta_id))
      .sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.orden - b.orden || a.oferta_id - b.oferta_id);
    const vistas = new Set<number>();
    const ofertas: ArbolOffer['funnels'][number]['ofertas'] = [];
    for (const l of ligas) {
      if (vistas.has(l.oferta_id)) continue;
      vistas.add(l.oferta_id);
      ofertas.push({ id: l.oferta_id, nombre: nombreOferta.get(l.oferta_id) as string, principal: l.es_principal, sesiones: [] });
    }
    return { id: f.id, nombre: (f.producto ?? '').trim() || f.nombre, ofertas, sesionesNuevas: [] };
  });
  const porFunnel = new Map(funnels.map((f) => [f.id, f] as const));
  const sueltas: OfferSesionResumen[] = [];
  for (const s of [...e.sesiones].sort(recientes)) {
    const f = s.funnelId != null ? porFunnel.get(s.funnelId) : undefined;
    if (!f) { sueltas.push(resumen(s)); continue; }
    const deLaOferta = (id: number | null) => (id != null ? f.ofertas.find((o) => o.id === id) : undefined);
    const destino = deLaOferta(s.ofertaId) ?? deLaOferta(s.ofertaBaseId);
    (destino ? destino.sesiones : f.sesionesNuevas).push(resumen(s));
  }
  return { funnels, sueltas };
}
