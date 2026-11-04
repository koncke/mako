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
import { RE_LO_HACE_EL_CLIENTE, RE_LO_HACE_EL_NEGOCIO, RE_PROMETE_HACERLO } from './offer-quien-hace';
import {
  DIMENSION_IDS, DIMENSIONES_CRITICAS, MARCA_COMPLETAR, PIEZAS, PIEZAS_DEL_ARRANQUE, PIEZA_KEYS, PREGUNTAS_GUIA,
  dimensionLabel, esDimensionId, esPiezaKey, faltanMinimas, piezaLabel,
  type AdjuntoVista, type ArbolOffer, type ArchiveroDoc, type BonoPropuesto, type CalculoDiagnostico, type CambioPropuesto, type DiagnosticoOferta,
  type DimensionId, type EcuacionFila, type Entregable, type FaseRuta, type FuentePieza, type ModoSesion,
  type NotaDimension, type OfferMensaje, type OfferSesionResumen, type PiezaKey, type PiezaSabida, type PiezasSabidas,
  type PropuestaOferta, type PuntoControlFinal, type VariableValor, type PasoArmado, type ArmadoVista,
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
  return o && typeof o === 'object' && !Array.isArray(o) ? (conMarcaCompletar(o) as Record<string, unknown>) : null;
}

/**
 * «[Completar: …]», «[COMPLETAR]» → la marca de la casa (16/10/2026). El modelo a veces la escribe con mayúscula y
 * dos puntos, y todo lo que la busca (el resaltado del PDF y la pantalla, «N datos para completar», `sinMarca`) es
 * EXACTO: esos datos quedaban sin marcar, como si fueran reales. Se normaliza todo lo que trae el modelo, a fondo.
 */
export function normalizarCompletar(t: string): string {
  return t.replace(/\[\s*completar\s*(?::\s*)?([^\]]*)\]/gi, (_, resto: string) => (resto.trim() ? `${MARCA_COMPLETAR} ${resto.trim()}` : MARCA_COMPLETAR));
}
function conMarcaCompletar(v: unknown): unknown {
  // Y sin la marca de fuente que el modelo copia del bloque de piezas («[de: chat]» salía 7 veces en un PDF: en las
  // notas del diagnóstico, en «Lo que me gustó» y en un paso; segunda prueba, 22/10/2026).
  if (typeof v === 'string') return normalizarCompletar(/\[de:/i.test(v) ? sinMarcaDeFuente(v) : v);
  if (Array.isArray(v)) return v.map(conMarcaCompletar);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, conMarcaCompletar(x)]));
  return v;
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

/**
 * La marca de la fuente que el prompt pone al lado de cada pieza (`piezasParaPrompt`: «… [de: chat]») y que el modelo
 * copia de vuelta al anotar (22/10/2026, prueba de los chats: 3 de 3; las piezas de Mauricio la tienen). Se saca al
 * ENTRAR lo del modelo y al LEER lo guardado: en el riel se veía y en el prompt se duplicaba.
 */
export const sinMarcaDeFuente = (t: string): string => t.replace(/\s*\[de:\s*[a-záéíóúñ ]{2,20}\]\s*/gi, ' ').trim();

/** De dónde dice el modelo que sacó una pieza (`"de"` en el JSON del turno). Sin `de`, lo dijo el dueño. */
export type OrigenDePieza = 'contexto' | 'documento';

/** Las keys que el modelo inventa con el nombre de todos los días, y la pieza que son (sin tildes, en minúscula). */
const ALIAS_PIEZA: Readonly<Record<string, PiezaKey>> = {
  promesa: 'resultado', transformacion: 'resultado', avatar: 'cliente', publico: 'cliente', cliente_ideal: 'cliente',
  dolor: 'problema', metodo: 'mecanismo', entregable: 'entregables', incluye: 'entregables', testimonios: 'prueba',
  casos: 'prueba', ticket: 'precio', bono: 'bonos',
};

/**
 * Lo que el modelo anotó de las piezas en un turno: sólo keys válidas, texto corto, y de dónde la sacó si lo dice
 * (`{"valor": "…", "de": "contexto"}`, 22/10/2026: lo que salía de lo cargado en MaKo se guardaba como dicho por el dueño).
 */
function limpiarPiezas(v: unknown): { piezas: Partial<Record<PiezaKey, string>>; origen: Partial<Record<PiezaKey, OrigenDePieza>> } {
  const piezas: Partial<Record<PiezaKey, string>> = {};
  const origen: Partial<Record<PiezaKey, OrigenDePieza>> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { piezas, origen };
  for (const [crudo, raw] of Object.entries(v as Record<string, unknown>)) {
    // Una key que no existe se descartaba EN SILENCIO (22/10/2026, segunda prueba: «queda anotada tal cual» y la
    // promesa no quedó en ninguna pieza). Las que el modelo inventa con el nombre de todos los días van a la suya.
    const plano = normalizar(crudo);
    const k = esPiezaKey(crudo) ? crudo : esPiezaKey(plano) ? plano : ALIAS_PIEZA[plano];
    if (!k) { console.warn(`[offer] el modelo anotó una pieza que no existe: «${crudo}»`); continue; }
    // El modelo a veces devuelve {valor: "…"} en vez del texto pelado: se acepta igual.
    const val = sinMarcaDeFuente(colapsar(typeof raw === 'string' ? raw : (raw as { valor?: unknown } | null)?.valor));
    if (!val) continue;
    piezas[k] = recortar(val, TOPE_PIEZA);
    const de = raw && typeof raw === 'object' ? normalizar(String((raw as { de?: unknown }).de ?? '')) : '';
    if (de === 'contexto') origen[k] = 'contexto';
    else if (de === 'documento' || de === 'documentos') origen[k] = 'documento';
  }
  return { piezas, origen };
}

/**
 * Lo que el turno sabe de ESTA oferta en MaKo: si se armó y si se guardó (22/10/2026, prueba de los chats: «¿ya quedó
 * guardada mi oferta en MaKo?» se contestaba «sí, ya está registrada» sin una versión armada ni guardada). Va al
 * contexto del turno, que lo leen también los prompts editados en /configuraciones.
 * Segunda prueba (22/10/2026): «se guarda automáticamente cuando tocas Armar mi oferta» (Armar no guarda: guarda el botón
 * «Guardar»), y «¿qué más te falta saber?» se contestaba con una pieza opcional (o con «otras», que empuja la regla 14)
 * mientras lo que frenaba «Armar» era la prueba. Por eso dice, como un HECHO, qué falta para armarla con las `piezas`.
 */
export function estadoDeLaOferta(f: {
  conclusiones: ReadonlyArray<{ version: number }>; ofertaId: number | null; ofertaVersion: number | null; piezas?: PiezasSabidas;
}): string {
  const v = f.conclusiones.reduce((m, c) => Math.max(m, c.version), 0);
  const titulo = 'ESTADO DE ESTA OFERTA EN MaKo (si el dueño pregunta, contesta con esto)';
  const guardar = 'Se guarda SÓLO con el botón «Guardar» de la ventana de la oferta, en su funnel: «Armar mi oferta» la arma pero NO la guarda. Nunca digas que se guarda sola.';
  const faltan = f.piezas ? faltanMinimas(f.piezas) : null;
  const armar = v ? 'armar otra versión' : 'armarla';
  const paraArmar = faltan == null ? ''
    : faltan.length
      ? ` Para ${armar} falta: ${faltan.map((k) => piezaLabel(k).toLowerCase()).join(', ')}. Si pregunta qué te falta, es eso y nada más.`
      : ` Ya tiene lo mínimo para ${armar}: si pregunta qué te falta, dile que puede tocar «Armar mi oferta»; lo demás es opcional, para afinarla.`;
  if (!v) return `${titulo}: todavía NO está armada ni guardada. ${guardar}${paraArmar}`;
  if (f.ofertaId != null && f.ofertaVersion === v) return `${titulo}: la versión ${v} está armada y GUARDADA en MaKo.${paraArmar}`;
  return `${titulo}: la versión ${v} está armada (en PDF) pero NO está guardada. ${guardar}${paraArmar}`;
}

/**
 * Las piezas de un turno sumadas a las que ya se sabían, cada una con SU fuente (22/10/2026, prueba de los chats):
 * lo que el modelo sacó de lo cargado en MaKo va como 'negocio', de un documento como 'doc', y lo demás con la de
 * siempre (`porDefecto`: 'doc' si el turno trajo documentos, si no 'chat'). Y «otras» (cuántas ofertas vende además de
 * ésta) sólo si MaKo ACABA de preguntarlo (`preguntoOtras`): el modelo la anotaba con «0» leído de «no vendí ninguno»,
 * que es otra pregunta, y con eso la guía la daba por sabida.
 */
export function fundirPiezasDelTurno(
  sabidas: PiezasSabidas, turno: Pick<TurnoOffer, 'piezas' | 'origen'>, p: { porDefecto: FuentePieza; preguntoOtras: boolean; at?: string },
): PiezasSabidas {
  const at = p.at ?? new Date().toISOString();
  const grupos: Record<FuentePieza, Partial<Record<PiezaKey, string>>> = { negocio: {}, doc: {}, chat: {} };
  for (const [k, v] of Object.entries(turno.piezas) as Array<[PiezaKey, string]>) {
    if (k === 'otras' && !p.preguntoOtras) continue;
    const o = turno.origen?.[k];
    grupos[o === 'contexto' ? 'negocio' : o === 'documento' ? 'doc' : p.porDefecto][k] = v;
  }
  return (['negocio', 'doc', 'chat'] as const).reduce((acc, f) => mergePiezas(acc, grupos[f], f, at), sabidas);
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
    const valor = sinMarcaDeFuente(colapsar(o.valor));
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
    const linksSinLeer = de === 'yo' ? sanearLinksSinLeer(o.linksSinLeer) : [];
    const pdf = de === 'mako' ? sanearPdf(o.pdf) : undefined;
    // Sin esta línea, «estoy leyendo tus documentos» se perdía en la primera escritura y la pantalla dejaba de esperar.
    const leyendo = de === 'mako' ? sanearLeyendo(o.leyendo) : undefined;
    // Sin esta línea la selección múltiple se veía al llegar el turno y se perdía al reabrir la conversación.
    const varias = de === 'mako' && !pregunta && opciones.length > 1 && o.varias === true;
    out.push({
      id: o.id, de, texto: t, at: typeof o.at === 'string' ? o.at : '',
      ...(opciones.length ? { opciones } : {}),
      ...(varias ? { varias: true as const } : {}),
      ...(adjuntos.length ? { adjuntos } : {}),
      ...(audio ? { audio } : {}),
      ...(pregunta ? { pregunta } : {}),
      ...(respuesta ? { respuesta } : {}),
      ...(linksSinLeer.length ? { linksSinLeer } : {}),
      ...(pdf ? { pdf } : {}),
      ...(leyendo ? { leyendo } : {}),
    });
  }
  return out;
}

function sanearLeyendo(raw: unknown): MensajeGuardado['leyendo'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.desde !== 'string' || typeof o.intento !== 'string' || !Array.isArray(o.nombres)) return undefined;
  const nombres = o.nombres.filter((x): x is string => typeof x === 'string').slice(0, MAX_DOCS_LOTE);
  return { nombres, desde: o.desde, intento: o.intento, texto: typeof o.texto === 'string' ? o.texto : '' };
}

// ── Muchos documentos: los lee el servidor y MaKo avisa (22/10/2026, O9) ─────────────────────────────────────────
// Mauricio (llamada del 22/10, 39:44): «mientras analiza muchos documentos, que diga "los analizo y te aviso cuando
// termine"» y dejar seguir usando la app. Con 3 o más archivos (`UMBRAL_LOTE`, app/offer/OfferApp.tsx), la pantalla los sube y manda `leer-lote`: el
// servidor anota este mensaje, los lee en un `after()` (la misma lectura de uno por uno) y al terminar manda el turno
// con lo que escribió el dueño y avisa en la campanita.

/** Hasta cuántos en un lote (el tope de documentos de una conversación manda igual). */
export const MAX_DOCS_LOTE = 12;
/** Una lectura que lleva más que esto se cortó (el `maxDuration` de la ruta es 800 s). */
export const LECTURA_VENCE_MS = 15 * 60_000;

/** El mensaje de MaKo mientras lee. */
export function mensajeLeyendo(p: { id: string; at: string; nombres: string[]; texto: string; intento: string }): MensajeGuardado {
  const n = p.nombres.length;
  const cuales = p.nombres.slice(0, 4).map((x) => `«${x}»`);
  const lista = n > 4 ? `${cuales.join(', ')} y ${n - 4} más` : listaConY(cuales);
  return {
    id: p.id, de: 'mako', at: p.at,
    texto: `Estoy leyendo tus ${n} documentos (${lista}). Te aviso cuando termine: mientras, puedes seguir usando MaKo.`,
    leyendo: { nombres: p.nombres, desde: p.at, intento: p.intento, texto: p.texto },
  };
}

/** La lectura en curso de una conversación, como la ve la pantalla: la del último mensaje que la tenga. */
export function leyendoParaVista(mensajes: ReadonlyArray<Pick<MensajeGuardado, 'leyendo'>>, ahora: number): { nombres: string[]; vencido: boolean } | null {
  const m = [...mensajes].reverse().find((x) => x.leyendo);
  if (!m?.leyendo) return null;
  const desde = Date.parse(m.leyendo.desde);
  return { nombres: m.leyendo.nombres, vencido: !Number.isFinite(desde) || ahora - desde > LECTURA_VENCE_MS };
}

/** El texto de un «estoy leyendo» que se cortó: deja de prometer un aviso que no va a llegar. */
export const TEXTO_LECTURA_CORTADA = 'Se cortó la lectura de tus documentos. Vuelve a mandarlos y los leo de nuevo.';

/** Lo que dice MaKo de los que no pudo leer (queda en lugar del «estoy leyendo»). null si leyó todos. */
export function resumenDelLote(p: { total: number; leidos: number; errores: string[] }): string | null {
  if (!p.errores.length) return null;
  const cuales = p.errores.slice(0, 4).join(' · ');
  return p.leidos
    ? `Leí ${p.leidos} de tus ${p.total} documentos. No pude con: ${cuales}. Si los necesitas, mándalos de nuevo.`
    : `No pude leer tus documentos: ${cuales}. Prueba de nuevo, o pega el texto en el chat.`;
}

/** Los links que no abrieron, como los manda la pantalla o los guarda la base: sólo http(s), cinco como mucho. */
export function sanearLinksSinLeer(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && /^https?:\/\/\S+$/i.test(x.trim()) && x.length <= 500).map((x) => x.trim()))].slice(0, 5);
}

/** El PDF de una versión, en un mensaje de MaKo: sólo una versión entera y positiva. */
function sanearPdf(raw: unknown): MensajeGuardado['pdf'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = (raw as { version?: unknown }).version;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? { version: v } : undefined;
}

/**
 * Un documento leído, como se guarda en `offer_sesiones.documentos` (con su texto). `archivero` = qué pasó
 * al guardarlo también en El Archivero (lib/offer-marco.ts → ArchiveroDoc); lo escribe `conArchivero`.
 * `lectura` y `partes`: un documento que no entra en un pedido se lee ENTERO por partes (`partirEnPartes`, #865), y
 * lo que viaja a los pedidos es esa lectura (`cuerpoDelDoc`).
 */
export type DocumentoGuardado = {
  id: string; nombre: string; via: string; texto: string; chars: number; aviso?: string; archivero?: ArchiveroDoc; at: string;
  lectura?: string; partes?: number;
};

/**
 * Tope del texto que se guarda de un documento: unas 4 horas de transcripción. Hasta el 17/10/2026 era 40.000 y la
 * llamada de venta del ws13 (64.462) se guardaba cortada; desde entonces se guarda entera y se lee por partes.
 */
export const TOPE_TEXTO_DOC = 300_000;
/** Cuántos documentos admite una conversación. */
export const MAX_DOCS_SESION = 12;

// ── Un documento largo se lee ENTERO, por partes (17/10/2026, tarjeta #865) ──
// Medido en el ws13: la transcripción de una llamada de venta tenía 64.462 caracteres, se guardó cortada en 40.000
// («Leí sólo el principio») y en cada pedido la IA leía ~17.000, porque los documentos de un pedido comparten 24.000.
// Lo que dijo el cliente en la segunda mitad de la llamada no llegaba nunca. Ahora:
//  · se guarda el texto entero (hasta `TOPE_TEXTO_DOC`, unas 4 horas de transcripción);
//  · uno que no entra en un pedido (`TOPE_DOC_ENTERO`) se parte en pedazos SIN PERDER un carácter (`partirEnPartes`),
//    la IA lee CADA pedazo y anota lo que sirve para la oferta, y lo que viaja a los pedidos es esa lectura entera
//    (`lecturaPorPartes`), en orden y con todas las partes;
//  · un pedazo que la IA no pudo leer va tal cual: se lee igual, sin resumir, y el chip lo dice (`avisoDeLectura`).

/** Lo más largo que entra entero en un pedido: más que esto, se lee por partes. */
export const TOPE_DOC_ENTERO = 16_000;
/** Lo que lee la IA de una vez al leer por partes (unos 4.000 tokens, cabe en cualquier modelo gratis de la cascada). */
export const TOPE_PARTE = 16_000;
/** Cuántas partes como mucho (con `TOPE_TEXTO_DOC` / `TOPE_PARTE` alcanza; es el techo de pedidos por documento). */
export const MAX_PARTES = 20;

/** Dónde conviene cortar, de mejor a peor: un párrafo, una línea, una frase, una palabra. */
const CORTES = ['\n\n', '\n', '. ', ' '];

/**
 * El texto en pedazos de hasta `tope`, cortando donde menos se rompe (un párrafo, una línea, una frase, una palabra; si
 * no hay nada de eso, a la fuerza). Unidos dan EXACTAMENTE el texto: `partes.join('') === texto`. Con más partes que
 * `MAX_PARTES`, el tope crece para que entre todo (nunca se descarta la cola).
 */
export function partirEnPartes(texto: string, tope = TOPE_PARTE): string[] {
  if (!texto) return [];
  const t = Math.max(tope, Math.ceil(texto.length / MAX_PARTES));
  const out: string[] = [];
  let i = 0;
  while (i < texto.length) {
    if (texto.length - i <= t) { out.push(texto.slice(i)); break; }
    const ventana = texto.slice(i, i + t);
    let corte = -1;
    for (const c of CORTES) {
      const k = ventana.lastIndexOf(c);
      // Un corte en la primera mitad deja una parte enana: mejor el siguiente separador.
      if (k >= t / 2) { corte = k + c.length; break; }
    }
    if (corte <= 0) corte = t;
    out.push(texto.slice(i, i + corte));
    i += corte;
  }
  return out;
}

/** La lectura de una parte que devuelve la IA, o null: `{"lectura": "..."}` con algo adentro. */
export const TOPE_LECTURA_PARTE = 3_000;
export function parseLectura(raw: unknown): string | null {
  const o = aObjeto(raw);
  const t = o && typeof o.lectura === 'string' ? o.lectura.trim() : '';
  return t ? recortar(t, TOPE_LECTURA_PARTE) : null;
}

/**
 * La lectura del documento entero: cada parte en orden, con lo que la IA anotó o, si no pudo, el pedazo TAL CUAL (no se
 * pierde: se lee sin resumir).
 */
export function lecturaPorPartes(lecturas: ReadonlyArray<string | null | undefined>, partes: readonly string[]): string {
  const n = partes.length;
  return partes.map((p, i) => {
    const l = lecturas[i]?.trim();
    return l ? `[Parte ${i + 1} de ${n}]\n${l}` : `[Parte ${i + 1} de ${n}, tal cual]\n${p.trim()}`;
  }).join('\n\n');
}

/** El aviso del chip: sólo si una parte quedó sin leer (se manda tal cual). Leído entero, no hace falta decir nada. */
export function avisoDeLectura(lecturas: ReadonlyArray<string | null | undefined>, n: number): string | null {
  const sin = lecturas.map((l, i) => (l?.trim() ? 0 : i + 1)).filter(Boolean);
  if (!sin.length) return null;
  const cuales = sin.length === 1 ? `la parte ${sin[0]}` : `las partes ${sin.slice(0, -1).join(', ')} y ${sin[sin.length - 1]}`;
  return `No pude resumir ${cuales} de ${n}: va${sin.length === 1 ? '' : 'n'} tal cual.`;
}

/** Lo que de un documento viaja a un pedido: su lectura por partes si la tiene, si no el texto. */
export const cuerpoDelDoc = (d: { texto: string; lectura?: string }): string => (d.lectura?.trim() ? d.lectura : d.texto);

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
      ...conArchiveroSaneado(o.archivero),
      at: typeof o.at === 'string' ? o.at : '',
      // ⚠️ Lista blanca: sin estas dos, la próxima escritura de la conversación borraba la lectura por partes.
      ...(typeof o.lectura === 'string' && o.lectura.trim() ? { lectura: o.lectura } : {}),
      ...(typeof o.partes === 'number' && Number.isInteger(o.partes) && o.partes > 0 ? { partes: o.partes } : {}),
    });
  }
  return out;
}

/**
 * El estado del Archivero, tal como vuelve de la base. ⚠️ Sin esto, la próxima escritura de la conversación
 * lo BORRA: `sanearDocumentos` y `sanearAdjuntos` rearman cada objeto con los campos que conocen.
 */
export function sanearArchiveroDoc(raw: unknown): ArchiveroDoc | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (o.ok === true && typeof o.id === 'string' && o.id.trim()) {
    return { ok: true, id: o.id, ...(typeof o.aviso === 'string' && o.aviso.trim() ? { aviso: o.aviso } : {}) };
  }
  if (o.ok === false && typeof o.motivo === 'string' && o.motivo.trim()) return { ok: false, motivo: o.motivo };
  return undefined;
}
const conArchiveroSaneado = (raw: unknown): { archivero?: ArchiveroDoc } => {
  const a = sanearArchiveroDoc(raw);
  return a ? { archivero: a } : {};
};

/** Lo que de un documento ve la pantalla: todo MENOS el texto. */
export const adjuntoDe = (d: DocumentoGuardado): AdjuntoVista => ({
  id: d.id, nombre: d.nombre, via: d.via, chars: d.chars, ...(d.aviso ? { aviso: d.aviso } : {}),
  ...(d.archivero ? { archivero: d.archivero } : {}),
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
      ...conArchiveroSaneado(a.archivero),
    }));
}

// ── El documento, también en El Archivero ────────────────────────────────────
// Decisión de Martín (Ticketera, 15/10/2026 05:32, ref `offer-archivero`): «¿El Archivero del chat guarda
// el archivo y paga una extracción por documento? → A · Sí». Lo hace la ruta POR DETRÁS (lib/archivero.ts
// → registrarDocumentoSinPisar); acá, lo que decide.

/**
 * Qué lectura de 'leer' va también al Archivero: un ARCHIVO del negocio (texto, Word, PDF, imagen,
 * planilla, presentación, OpenDocument). NO un audio o un video subido como documento (`via: 'audio'`): El
 * Archivero no los acepta en su pantalla y lo que se guardaría es la grabación entera para sacarle campos
 * de una transcripción. La página de un link ('leer-link') tampoco pasa por acá: no hay archivo que
 * guardar, y lo que Martín aprobó es guardar el archivo.
 */
export function seArchivaDesdeOffer(via: string): boolean {
  return ['texto', 'docx', 'pdf', 'pdf-vision', 'imagen', 'planilla', 'diapositivas', 'opendocument'].includes(via);
}

/** El `motivo` de la extracción en el Saldo de IA: la feature es la del Archivero, el motivo dice de dónde vino. */
export const motivoArchivoOffer = (nombre: string): string => `Offer → El Archivero: extraer campos de «${recortar(nombre, 120)}»`;

/**
 * La conversación con el resultado del Archivero anotado en el documento Y en los adjuntos de los
 * mensajes que lo llevan (son copias: el chip se dibuja desde el mensaje). null = el documento ya no está
 * en esta conversación, no hay nada que anotar. No toca nada más: ni el texto, ni las piezas, ni el
 * borrador.
 */
export function conArchivero(
  f: { documentos: DocumentoGuardado[]; mensajes: MensajeGuardado[] }, docId: string, estado: ArchiveroDoc,
): { documentos: DocumentoGuardado[]; mensajes?: MensajeGuardado[] } | null {
  if (!f.documentos.some((d) => d.id === docId)) return null;
  const documentos = f.documentos.map((d) => (d.id === docId ? { ...d, archivero: estado } : d));
  let tocados = 0;
  const mensajes = f.mensajes.map((m) => {
    if (!m.adjuntos?.some((a) => a.id === docId)) return m;
    tocados++;
    return { ...m, adjuntos: m.adjuntos.map((a) => (a.id === docId ? { ...a, archivero: estado } : a)) };
  });
  return tocados ? { documentos, mensajes } : { documentos };
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
  const q = PREGUNTAS_GUIA.find((x) => !piezaAnotada(piezas, x.pieza));
  if (!q) return null;
  // La de la escalera, según el nivel (en una entrada importa qué vende DESPUÉS).
  return q.pieza === 'escalera' ? preguntaEscalera(nivelDeOferta(piezas)?.nivel) : q.pregunta;
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
 * El diagnóstico de fase que se congela en la conclusión, con el canal de ESTA oferta (el de su funnel) si se sabe: el
 * del negocio dice dónde cierra la venta su oferta de siempre, no ésta (22/10/2026, prueba de los chats: «Dónde cierras
 * la venta: Llamada de venta» en el PDF de una oferta que el dueño dijo tres veces que se vende sin llamadas). Sólo el
 * rótulo: la fase y el cuello de botella no cambian.
 * Sin canal en el funnel (los que crea Customer Success, el alta sin canal), el que DIJO el dueño (`canalQueDijo`); y si
 * dijo que no hay llamadas y no nombró otro canal, el de llamadas del negocio no se imprime (segunda prueba, 22/10).
 */
export function conCanalDeLaOferta(
  fase: Diagnostico | null, canalDelFunnel: CanalId | null, dicho: { canal: CanalId | null; sinLlamadas: boolean } = { canal: null, sinLlamadas: false },
): Diagnostico | null {
  if (!fase) return fase;
  if (canalDelFunnel) return { ...fase, canal: canalDelFunnel };
  if (dicho.canal) return { ...fase, canal: dicho.canal };
  if (dicho.sinLlamadas && fase.canal === 'llamadas') { const { canal: _sin, ...resto } = fase; return resto; }
  return fase;
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

/** El nombre del documento que guarda un mensaje escrito más largo que el chat. */
export const NOMBRE_DOC_TEXTO_LARGO = 'Tu mensaje largo';

/** Lo que queda en el chat de un texto largo: su principio. Es también lo que mira la guardia del onboarding (el insulto). */
export const PRINCIPIO_TEXTO_LARGO = 1_500;

/**
 * Un mensaje ESCRITO más largo que el tope del chat (20/10/2026, Florencia, ws21: el texto que armó con ChatGPT tenía
 * 21.629 caracteres, rebotó con «Súbelo como documento» y tardó 12 minutos en armar un .docx). Va por el camino del audio
 * (`repartirTranscripcion`): el texto ENTERO queda como documento de la conversación y el mensaje lleva el principio y lo
 * dice. null = la conversación ya no admite documentos: cortarlo en silencio sería peor que decirlo.
 */
export function repartirTextoLargo(
  texto: string, opts: { tope: number; topeDoc: number; docsLibres: number; inicio?: number },
): { cuerpo: string; doc: { texto: string; chars: number; aviso?: string } | null } | null {
  if (texto.length <= opts.tope) return { cuerpo: texto, doc: null };
  if (opts.docsLibres <= 0) return null;
  const principio = recortar(texto, Math.min(opts.inicio ?? PRINCIPIO_TEXTO_LARGO, opts.tope));
  const recortado = texto.length > opts.topeDoc;
  return {
    cuerpo: `${principio}\n\n(Tu mensaje sigue entero en el documento «${NOMBRE_DOC_TEXTO_LARGO}».)`,
    doc: {
      texto: texto.slice(0, opts.topeDoc),
      chars: texto.length,
      ...(recortado ? { aviso: `Tu mensaje tiene ${texto.length.toLocaleString('es-MX')} caracteres: guardé los primeros ${opts.topeDoc.toLocaleString('es-MX')}.` } : {}),
    },
  };
}

/** Los parámetros de un link que no cambian la página que se ve (seguimiento de anuncios, de mails, de previews). */
const PARAM_DE_SEGUIMIENTO = /^(utm_[a-z0-9_]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|ttclid|yclid|twclid|igshid|igsh|mc_cid|mc_eid|_ga|_gl|_hs[a-z]+|hsa_[a-z]+|ref|ref_src|sfnsn|__lovable_load_id)$/i;

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
 * A qué funnels va la oferta al guardarla (17/10/2026, tarjeta #895: «una oferta se guarda en uno o varios funnels»).
 *  · `elegidos` null (un pedido sin elección: MaKo Mobile, una versión vieja de la pantalla): el de la conversación,
 *    como antes; una conversación sin funnel (la v1) no se liga a ninguno.
 *  · `elegidos` vacío: TODOS los funnels activos (la convención de `ElegirFunnels`: vacío = todos).
 *  · Si no, los elegidos, sin repetir y en el orden en que se eligieron.
 */
export function destinoDeLaOferta(p: { funnelConversacion: number | null; elegidos: readonly number[] | null | undefined; activos: readonly number[] }): number[] {
  if (p.elegidos == null) return p.funnelConversacion != null ? [p.funnelConversacion] : [];
  if (!p.elegidos.length) return [...new Set(p.activos)];
  return [...new Set(p.elegidos)];
}

/**
 * Los avisos de ligar la oferta a VARIOS funnels, en uno: el primero que se arregla reintentando manda (es el que pide
 * volver a tocar «Guardar»); si no, el primero. Sin avisos, nada.
 */
export function juntarLigas(rs: ReadonlyArray<{ aviso?: string; avisoReintentable?: boolean }>): { aviso?: string; avisoReintentable?: boolean } {
  const conAviso = rs.filter((r) => r.aviso?.trim());
  if (!conAviso.length) return {};
  const reintentable = conAviso.find((r) => r.avisoReintentable);
  const r = reintentable ?? conAviso[0];
  const mas = conAviso.length - 1;
  return { aviso: mas ? `${r.aviso} (y ${mas} aviso${mas === 1 ? '' : 's'} más)` : r.aviso, avisoReintentable: !!reintentable };
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
  /** De dónde sacó el modelo cada pieza, si lo dijo (`fundirPiezasDelTurno`). */
  origen?: Partial<Record<PiezaKey, OrigenDePieza>>;
  /** Lo que dijo el modelo. NO decide nada: decide `faltanMinimas` sobre las piezas ya fusionadas. */
  listo: boolean;
  /** Las opciones se suman (el dueño puede marcar varias). Ver `OfferMensaje.varias`. `parseTurno` lo pone siempre. */
  varias?: boolean;
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
/**
 * El turno sin el saludo de arriba ni la despedida de abajo (22/10/2026, Mauricio, 43:11: «saluda de nuevo en cada
 * mensaje»). Las 25 respuestas de su conversación empezaban con «Hola estimado Mauricio ! espero que estes muy bien !»
 * y una terminaba en «Bendiciones.»: el modelo copiaba a la charla con el DUEÑO la voz que el negocio usa con SUS
 * clientes. Ningún turno saluda: el primer mensaje de la conversación lo escribe el código, así que cuando habla la IA
 * ya están conversando. La regla del prompt va igual; esto es lo que no depende del modelo.
 */
export function sinSaludo(t: string): string {
  let out = t.trimStart();
  // «Hola estimado Mauricio !», «¡Buenas tardes!», «Hola Mauricio, …» (hasta la coma), y atrás «espero que estés muy bien».
  out = out.replace(/^[¡!]?\s*(?:hola|buen(?:os|as)\s+(?:d[ií]as|tardes|noches)|saludos|qu[eé]\s+tal)\b[^.!?¿,\n]{0,60}(?:[.!?]+|,)\s*/i, '');
  out = out.replace(/^[¡!]?\s*espero\s+que\s+(?:est[eé]s|te\s+encuentres|se\s+encuentre|est[eé]|te\s+vaya)\b[^.!?¿\n]{0,60}[.!?]+\s*/i, '');
  out = out.replace(/\s*[¡]?\s*(?:bendiciones|saludos(?:\s+cordiales)?|un\s+(?:fuerte\s+)?abrazo|abrazos|quedo\s+atent[oa])\s*[.!]*\s*$/i, '');
  out = out.trim();
  if (!out) return '';
  return out === t.trim() ? out : out.charAt(0).toUpperCase() + out.slice(1);
}

export function parseTurno(raw: unknown): TurnoOffer | null {
  const o = aObjeto(raw);
  if (!o) return null;
  const crudo = texto(o.respuesta, 4000);
  if (crudo && pareceRazonamiento(crudo)) return null;
  const diagnostico = limpiarDiagnostico(o.diagnostico);
  if (!crudo && !diagnostico) return null;
  const sinSaludar = crudo ? sinSaludo(crudo) : '';
  return {
    respuesta: sinSaludar ? recortarRespuesta(unaSolaPregunta(sinSaludar)) : '',
    opciones: limpiarOpciones(o.opciones),
    ...(() => { const l = limpiarPiezas(o.piezas); return { piezas: l.piezas, origen: l.origen }; })(),
    listo: o.listo === true,
    varias: o.varias === true,
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
    // Un «diagnóstico» aparte NO existe (16/10/2026, la conversación real de Leila: con todo listo, MaKo preguntó
    // «¿Quieres que avancemos con el diagnóstico de tu negocio?» con «Sí, ver diagnóstico», y el turno siguiente sólo
    // dijo «toca el botón»). El análisis y la oferta salen de «Armar mi oferta»: con las mínimas, eso es lo que se dice,
    // y una opción de «diagnóstico» en un mensaje que no es del diagnóstico de fase se saca siempre.
    const ofreceOtroPaso = p.puedeConcluir && RE_PASO_DIAGNOSTICO.test(turno.respuesta);
    const propias = ofreceOtroPaso ? [] : turno.opciones.filter((o) => !RE_OPCION_DIAGNOSTICO.test(o));
    const opciones = opcionesConCierre(propias, p.puedeConcluir);
    const varias = propias.length > 1 && (turno.varias || preguntaPorOtrasOfertas(turno.respuesta));
    return {
      id: p.id, de: 'mako', texto: ofreceOtroPaso ? TEXTO_LISTA_PARA_ARMAR : turno.respuesta, at: p.at,
      ...(opciones.length ? { opciones } : {}), ...(varias ? { varias: true as const } : {}),
    };
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
/**
 * ¿La pregunta del turno es la de qué OTRAS ofertas vende? Ésa se contesta con varias a la vez («un curso y una
 * mentoría») aunque el modelo se olvide de `"varias": true` o el prompt esté editado. Se mira sólo la PREGUNTA
 * (desde el último «¿»): «tus otros productos los vemos después. ¿Cuánto cobras?» no es esa pregunta.
 */
const RE_PREGUNTA_OTRAS = /\botr[oa]s?\s+(?:ofertas?|productos?|servicios?|programas?|cursos?)\b|\badem[aá]s\b[^?]*\b(?:vend|ofrec)/i;
export function preguntaPorOtrasOfertas(respuesta: string): boolean {
  const fin = respuesta.lastIndexOf('?');
  if (fin < 0) return false;
  return RE_PREGUNTA_OTRAS.test(respuesta.slice(Math.max(0, respuesta.lastIndexOf('¿', fin)), fin + 1));
}

/** Un mensaje que ofrece el diagnóstico como un paso aparte (ver `mensajeDeMako`). */
const RE_PASO_DIAGNOSTICO = /\bavan(?:ce|za|zar)?mos con (?:el|tu|un) diagn[oó]stico|\bver (?:el |tu )?diagn[oó]stico|\b(?:hacer|empezar|seguir con|pasar al?) (?:el |tu )?diagn[oó]stico/i;
/** Una opción de «diagnóstico» en un mensaje que no es del diagnóstico de fase (las de ése llevan `pregunta`). */
const RE_OPCION_DIAGNOSTICO = /diagn[oó]stico/i;
export const TEXTO_LISTA_PARA_ARMAR = 'Ya tengo lo necesario para armar tu oferta. Cuando quieras, toca «Armar mi oferta»; si quieres afinar algo antes, cuéntamelo.';

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
/**
 * El diagnóstico de una oferta que NO es del dueño (4/11/2026, Competitors Spy; Martín: «en "Su Funnel" debe "exponer" su
 * OFERTA con el analizador de oferta que ya tenemos construido»). Es EL MISMO analista —la rúbrica, las reglas y el parse
 * de arriba—, con su web como documento. Lo que cambia es de quién habla: el prompt dice «el dueño» y escribe de «tú», y
 * leído por OTRO negocio un «tu promesa no dice…» parece hablar de la suya. Esto va pegado al system ya armado (y no en un
 * slot del template): un prompt editado en /configuraciones lo lleva igual. El nombre lo escribió una persona: va sin
 * saltos ni comillas y recortado.
 */
export function bloqueOfertaDeOtro(nombre: string): string {
  const quien = recortar(String(nombre ?? '').replace(/[\r\n«»"]+/g, ' ').replace(/\s+/g, ' ').trim(), 80) || 'un competidor';
  return [
    `ESTA VEZ LA OFERTA NO ES DEL DUEÑO: es la de «${quien}», un competidor que el dueño mira, leída de su web pública (viene en LOS DOCUMENTOS). Diagnostícala igual, con la misma rúbrica y las mismas reglas, con estos cambios:`,
    '- Habla de ella en tercera persona («su oferta», «promete», «su web no lo dice»), nunca de «tú» ni de «tu oferta»: quien lo lee es otro negocio.',
    '- Lo que cites sale de su web, entre «comillas». Lo que su web no dice, dilo así: «su web no lo dice».',
  ].join('\n');
}

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
  // Lo que ya hace bien (16/10/2026): de 1 a 3, sin repetidas. `fuerte` sigue siendo la primera para lo que ya lo lee.
  const fuertes = [...new Set((Array.isArray(o.fuertes) ? o.fuertes : []).map((x) => texto(x, 320)).filter(Boolean))].slice(0, 3);
  const fuerte = texto(o.fuerte, 320) || fuertes[0] || '';
  return {
    dimensiones: DIMENSION_IDS.map((id) => porId.get(id) as NotaDimension),
    tesis,
    fuerte,
    fuertes: fuertes.length ? fuertes : fuerte ? [fuerte] : [],
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

/**
 * Una hora («0:04:43», «12:30») o una fecha («16/10», «16/10/2026», «2026-10-16»): nunca es una cifra del negocio. Medido
 * el 17/10/2026 en el ws13: la transcripción de una llamada que subió el dueño («0:04:43 Pedro: ¿Qué haces?») volvía
 * «del negocio» a todos los números del 0 al 59, y el «43%» y el «36%» pasaban por dichos por él.
 */
const HORA_O_FECHA = /\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/g;
const sinHorasNiFechas = (t: string | null | undefined): string => (t ?? '').replace(HORA_O_FECHA, ' ');

/**
 * Una FECHA de calendario («24/10», «24/10/2026», «24 de octubre»), como clave (`fecha:24/10`), o null. 22/10/2026 (prueba
 * de los chats): la fecha que dio el dueño salía «[completar]/10» en el PDF. Sus números no son cifras del negocio
 * (`sinHorasNiFechas`, el 0:04:43 de una transcripción), pero la fecha ENTERA sí es un dato que dio: se compara entera.
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FECHA_CALENDARIO = new RegExp(`\\b(\\d{1,2})/(\\d{1,2})(?:/\\d{2,4})?\\b|\\b(\\d{1,2})\\s+de\\s+(${MESES.join('|')})\\b`, 'gi');
function claveFecha(m: RegExpMatchArray): string | null {
  const dia = Number(m[1] ?? m[3]);
  const mes = m[2] != null ? Number(m[2]) : MESES.indexOf(String(m[4]).toLowerCase()) + 1;
  return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 ? `fecha:${dia}/${mes}` : null;
}

/**
 * Todas las cifras de unos textos, como claves (`claveCifra`). Es «lo que dio el negocio». Sin horas ni fechas sueltas:
 * las fechas van ENTERAS (`claveFecha`).
 */
export function cifrasDelNegocio(textos: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const t of textos) {
    for (const m of sinHorasNiFechas(t).matchAll(CIFRA_ESCALA)) {
      const k = claveCifra(m[0]);
      if (k) out.add(k);
    }
    for (const m of (t ?? '').matchAll(FECHA_CALENDARIO)) {
      const k = claveFecha(m);
      if (k) out.add(k);
    }
  }
  return out;
}

/** Lo que viene DESPUÉS de una cifra y la hace un plazo o una parte de la estructura, no un resultado. */
const UNIDAD_PLAZO = /^\s*(?:d[ií]as?|semanas?|mes(?:es)?|años?|horas?|minutos?|pasos?|fases?|etapas?|pilares?|m[oó]dulos?|sesi[oó]n(?:es)?|bonos?|niveles?|partes?|pagos?|cuotas?)(?![a-záéíóúñ])/i;
/**
 * Un TIEMPO que es un RESULTADO, no un plazo (16/10/2026): la oferta de Leila decía «liberar 10 horas semanales», un
 * número que ella nunca dio, y pasaba porque «horas» es una unidad de plazo. Un tiempo que se REPITE («10 horas
 * semanales», «2 horas al día») o que se gana («liberar», «ahorrar», «recuperar» 10 horas) es lo que el cliente LOGRA:
 * se revisa como toda cifra de resultados. «En 90 días» sigue siendo un plazo.
 */
const UNIDAD_TIEMPO = /^\s*(?:horas?|minutos?|d[ií]as?|semanas?|mes(?:es)?)(?![a-záéíóúñ])/i;
const TIEMPO_QUE_SE_REPITE = /^\s*(?:horas?|minutos?|d[ií]as?)\s+(?:semanales|diari[ao]s|mensuales|al d[ií]a|al mes|a la semana|por (?:semana|d[ií]a|mes)|cada (?:semana|d[ií]a|mes))/i;
const SE_GANA_TIEMPO = /\b(?:liber|ahorr|recuper|gan|sum|qued)[a-záéíóúñ]*\s+(?:hasta\s+|unas?\s+|m[aá]s de\s+|al menos\s+)?$/i;
const esTiempoDeResultado = (antes: string, despues: string): boolean =>
  TIEMPO_QUE_SE_REPITE.test(despues) || (UNIDAD_TIEMPO.test(despues) && SE_GANA_TIEMPO.test(antes));

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
  // Una fecha se mira ENTERA (22/10/2026): la que dio el dueño queda tal cual; una que nadie dio es un dato inventado y
  // pasa entera a «[completar]» (antes, cada número por su lado: «24/10» salía «[completar]/10»).
  const partes: string[] = [];
  let desde = 0;
  for (const m of texto.matchAll(FECHA_CALENDARIO)) {
    const k = claveFecha(m);
    if (!k) continue;
    partes.push(filtrarCifrasSinFechas(texto.slice(desde, m.index), permitidas, opts), permitidas.has(k) ? m[0] : MARCA_COMPLETAR);
    desde = (m.index ?? 0) + m[0].length;
  }
  if (!partes.length) return filtrarCifrasSinFechas(texto, permitidas, opts);
  return partes.join('') + filtrarCifrasSinFechas(texto.slice(desde), permitidas, opts);
}

function filtrarCifrasSinFechas(texto: string, permitidas: Set<string>, opts: { plazos?: boolean }): string {
  if (!texto) return texto;
  return texto.replace(CIFRA_ESCALA, (m: string, offset: number, todo: string) => {
    const k = claveCifra(m);
    if (!k || permitidas.has(k)) return m;
    if (ES_ANIO.test(m.trim())) return m;
    if (ROTULO_ANTES.test(todo.slice(0, offset))) return m;
    const despues = todo.slice(offset + m.length);
    if (opts.plazos && UNIDAD_PLAZO.test(despues) && !esTiempoDeResultado(todo.slice(0, offset), despues)) return m;
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
  // Un PRESUPUESTO de anuncios no es lo que cuesta atender a un cliente (22/10/2026, Mauricio: «tenemos pensado
  // invertir $3,000 usd en publicidad en Meta» quedó como el costo por cliente de un taller de 270 USD, y el aviso dijo
  // «el margen bruto queda en 0%»). Sin un «por cliente» explícito, no hay costo para calcular el margen.
  if (PRESUPUESTO_DE_ANUNCIOS.test(valor ?? '') && !COSTO_POR_CLIENTE.test(valor ?? '')) return null;
  return montosDe(valor)[0] ?? null;
}
const PRESUPUESTO_DE_ANUNCIOS = /\b(?:publicidad|anuncios?|ads|pauta|campañas?)\b/i;
const COSTO_POR_CLIENTE = /\bpor\s+(?:cliente|participante|alumno|persona|asistente|inscrito|cupo)\b|\bcada\s+(?:cliente|participante|alumno|persona|uno)\b/i;

// ── El NIVEL de la oferta (16/10/2026) ───────────────────────────────────────
// Feedback de la llamada con Leila (12/10): cargó su oferta de ENTRADA (800 MXN al mes) y MaKo le preguntó «¿qué le
// vendes antes?» y la reescribió como un programa de 1.000 USD, unas 25 veces el precio. No era un error del modelo: el
// marco daba por hecho el alto ticket en todos lados (los prompts, «desde 1.000 USD», los avisos del código). Martín:
// «la oferta tiene que saber distinguir qué es un low ticket y qué es un high ticket», y en una de entrada la pregunta
// es «¿qué le vendes después?». El nivel lo decide el CÓDIGO con el precio que dio el dueño, nunca el modelo.

export type NivelTicket = 'bajo' | 'medio' | 'alto';
export type NivelOferta = { nivel: NivelTicket; precio: Monto; recurrente: boolean };

/**
 * Los cortes, POR MONEDA (docs/offer-marco.md §6.5: el low ticket es lo de menos de 300-500 USD y el alto ticket
 * arranca en 1.000 USD). Por moneda y no convirtiendo: la conversión con el tipo de cambio fijo está prohibida en los
 * lectores (tests/moneda-meta.test.ts), y para separar una entrada de un alto ticket alcanza el orden de magnitud. Lo
 * que se cobra por MES se mide con sus propios cortes (una membresía de 50 USD al mes es una entrada).
 */
const CORTES_TICKET: Record<'USD' | 'MXN' | 'EUR', { bajo: number; alto: number; bajoMes: number; altoMes: number }> = {
  USD: { bajo: 500, alto: 1_000, bajoMes: 150, altoMes: 300 },
  EUR: { bajo: 500, alto: 1_000, bajoMes: 150, altoMes: 300 },
  MXN: { bajo: 9_000, alto: 17_000, bajoMes: 2_500, altoMes: 5_000 },
};
const RE_POR_MES = /\b(?:al|por|cada)\s+mes\b|\bmensual(?:es|idad)?\b|\/\s*mes\b/i;

/** El nivel de un precio, con los cortes de SU moneda (sin moneda, USD): así se comparan precios en monedas distintas. */
function nivelDeMonto(precio: Monto, recurrente: boolean): NivelTicket {
  const c = CORTES_TICKET[precio.moneda ?? 'USD'];
  const [bajo, alto] = recurrente ? [c.bajoMes, c.altoMes] : [c.bajo, c.alto];
  return precio.monto < bajo ? 'bajo' : precio.monto >= alto ? 'alto' : 'medio';
}

/** El nivel de la oferta según su precio, o null si el dueño todavía no lo dio (o no se entiende). Sin moneda, USD. */
export function nivelDeOferta(piezas: PiezasSabidas): NivelOferta | null {
  const v = piezas.precio?.valor;
  if (!v || esSinDato(v)) return null;
  const precio = precioDe(v);
  if (!precio) return null;
  const recurrente = RE_POR_MES.test(v);
  return { nivel: nivelDeMonto(precio, recurrente), precio, recurrente };
}

/** La pregunta de la escalera según el nivel: en una ENTRADA importa qué vende después; en un alto ticket, qué antes. */
export function preguntaEscalera(nivel: NivelTicket | null | undefined): string {
  if (nivel === 'bajo') return '¿Qué le vendes DESPUÉS a quien compra esta oferta: el siguiente escalón, más caro, o una continuidad?';
  if (nivel === 'alto') return '¿Qué le vendes antes de esta oferta (una entrada más barata) y qué después (una continuidad)?';
  return PREGUNTAS_GUIA.find((q) => q.pieza === 'escalera')?.pregunta ?? '¿Qué le vendes antes de esta oferta y qué le vendes después?';
}

/**
 * Lo que el modelo tiene que saber del nivel, para los tres prompts (turno, diagnóstico, propuesta). Viaja PEGADO al
 * bloque de las piezas (`piezasParaPrompt`): ese slot está en todos los prompts, también en los que alguien guardó
 * editados en /configuraciones (un slot nuevo no les llegaría). '' si no hay precio todavía.
 */
export function bloqueNivel(n: NivelOferta | null): string {
  if (!n) return '';
  const precio = `${fmtMonto(n.precio)}${n.recurrente ? ' al mes' : ''}`;
  if (n.nivel === 'bajo') {
    return `EL NIVEL DE ESTA OFERTA (lo calcula el sistema con el precio): TICKET BAJO (${precio}). Es una oferta de ENTRADA.
- No la conviertas en una de alto ticket: mejórala EN SU NIVEL. El precio se mueve poco, y sólo si el diagnóstico lo justifica y lo dices.
- Las reglas del marco que son de alto ticket NO aplican aquí: el precio «desde 1.000 USD», el programa de 90 a 180 días y las cuotas con 50% al inicio.
- El alto ticket es el escalón que viene DESPUÉS: va en "siguiente". La pregunta de la escalera es: «${preguntaEscalera('bajo')}»`;
  }
  if (n.nivel === 'alto') {
    return `EL NIVEL DE ESTA OFERTA (lo calcula el sistema con el precio): TICKET ALTO (${precio}). Valen las reglas de alto ticket del marco. La pregunta de la escalera es: «${preguntaEscalera('alto')}»`;
  }
  return `EL NIVEL DE ESTA OFERTA (lo calcula el sistema con el precio): TICKET MEDIO (${precio}), entre una entrada y un alto ticket. Puede subir hacia el alto ticket sólo si el diagnóstico lo justifica, y se dice.`;
}

/** El % cobrado al firmar que dijo el dueño, o null: «50%», «la mitad», «todo de contado». */
/**
 * Lo que devuelve el lector de afuera (r.jina.ai, app/api/offer/route.ts → `leerConLectorExterno`), como texto de una
 * página: el título, la URL y el contenido. null si no sirve: muy corto (menos de 200 caracteres: una página vacía o un
 * error) o una página de desafío de un antibots, que el lector también puede recibir en vez de la página.
 */
export function textoDelLectorExterno(raw: string): { titulo: string; url: string; texto: string } | null {
  const t = (raw ?? '').replace(/\r\n/g, '\n');
  const titulo = t.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const url = t.match(/^URL Source:\s*(\S+)/m)?.[1]?.trim() ?? '';
  const i = t.indexOf('Markdown Content:');
  const texto = (i >= 0 ? t.slice(i + 'Markdown Content:'.length) : t).trim();
  if (texto.length < 200) return null;
  if (/\b(?:just a moment|checking your browser|verify you are human|access denied|attention required|captcha)\b/i.test(`${titulo}\n${texto.slice(0, 600)}`)) return null;
  return { titulo, url, texto };
}

// ── El lector de afuera no recibe credenciales (OF2, 22/10/2026) ──────────────
// Una URL con un token en sus parámetros (un link de vista previa, un acceso firmado, una página privada compartida) le
// llegaba a r.jina.ai tal cual: un tercero con el acceso del dueño. El lector de afuera es para lo PÚBLICO que nuestro
// servidor no puede abrir; lo que pide acceso, el dueño lo sube en .zip o pega su texto.

/** Lo que se le dice al dueño en vez de mandar su link afuera. */
export const PIDE_ACCESO = 'Esa página pide acceso: súbela en .zip o copia su texto y pégalo aquí.';

/** Nombres de parámetro que llevan un acceso: token, key, sig, auth, code, secret, password, session… y las firmas de S3 y GCS. */
const PARAM_CREDENCIAL = /(?:^|[_.-])(?:token|access|auth|authorization|key|apikey|sig|signature|secret|password|passwd|pwd|pass|session|sessionid|sid|jwt|code|otp|credential|credentials)(?:[_.-]|$)|^x-(?:amz|goog)-/i;
/**
 * Los links para COMPARTIR archivos: el acceso va en la ruta (`/d/<id>`, `/s/<código>`), no en un parámetro, y quien
 * tiene el link abre el archivo. No se mira la ruta de cualquier página: un slug largo con números es una landing.
 */
const HOST_DE_COMPARTIR = /(?:^|\.)(?:drive\.google\.com|docs\.google\.com|dropbox\.com|dropboxusercontent\.com|1drv\.ms|onedrive\.live\.com|sharepoint\.com|box\.com|wetransfer\.com|we\.tl)$/i;
/** Un valor que parece un código: 24 o más caracteres de base64 o hex, con letras y números. */
const VALOR_CREDENCIAL = /^(?=.*[a-z])(?=.*\d)[a-z0-9_\-.~+/=%]{24,}$/i;

/**
 * ¿La URL lleva algo con forma de credencial? Devuelve QUÉ (el nombre del parámetro, «usuario y clave» o «un link para
 * compartir») para el log, nunca el valor; null si no. Mira el usuario y clave del link, si es un link para compartir
 * archivos (Drive, Dropbox, OneDrive…), los parámetros (por el nombre o por un valor que parece
 * un código) y el fragmento, que algunos accesos usan (`#access_token=`). Los de SEGUIMIENTO no cuentan: `linkParaLeer`
 * ya los sacó, y un `fbclid` es largo pero no abre nada.
 */
export function credencialEnLaUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.username || u.password) return 'usuario y clave';
  if (HOST_DE_COMPARTIR.test(u.hostname)) return 'un link para compartir';
  const params = [...u.searchParams.entries()];
  if (u.hash.includes('=')) params.push(...new URLSearchParams(u.hash.slice(1)).entries());
  for (const [k, v] of params) {
    if (PARAM_DE_SEGUIMIENTO.test(k)) continue;
    if (PARAM_CREDENCIAL.test(k) || VALOR_CREDENCIAL.test(v)) return k;
  }
  return null;
}

/**
 * ¿Es un .zip? Por la extensión o el tipo (los navegadores mandan varios). Offer lo abre y lee sus páginas
 * (lib/offer-zip.ts, 22/10/2026: la carpeta de la landing de Mauricio). Vive acá y no allá porque la pantalla también lo
 * usa, y allá está jszip.
 */
export const esZip = (nombre: string, mime: string): boolean =>
  /\.zip$/i.test(nombre) || /^application\/(?:x-)?zip(?:-compressed)?$/i.test(mime);

/** ¿El precio se cobra en UN solo pago? («Pago único de $270 USD vía Stripe», «de contado», «un solo pago»). */
export function esPagoUnico(valor: string | null | undefined): boolean {
  const t = (valor ?? '').trim();
  if (!t || esSinDato(t)) return false;
  return /\b(?:pago unico|un solo pago|un unico pago|de contado|al contado)\b/.test(normalizar(t));
}

/**
 * Con un precio de PAGO ÚNICO, el cobro al firmar ya se sabe: el 100% (22/10/2026, Mauricio, 01:10:49: MaKo le
 * preguntó «¿es pago único?» dos veces, primero con el precio y después con el % al firmar). Se anota la pieza `cobro`
 * para que la guía la salte; si ya tenía dato, no se toca.
 */
export function conCobroDelPrecio(piezas: PiezasSabidas, at: string = new Date().toISOString()): PiezasSabidas {
  if (tieneDato(piezas, 'cobro') || !esPagoUnico(piezas.precio?.valor)) return piezas;
  return mergePiezas(piezas, { cobro: '100% al inscribirse: es un pago único, lo dijo con el precio' }, 'chat', at);
}

// ── Lo que el dueño DICE con todas las letras, anotado por el código (22/10/2026, segunda prueba de los chats) ──
// Las piezas salían sólo de lo que devolvía el modelo (`fundirPiezasDelTurno`), y tres cosas dichas sin vueltas se
// perdían o quedaban al revés: «Todavía no vendí ninguno… No tengo casos ni testimonios» (no anotaba la prueba, volvía a
// preguntar las ventas y «Armar» rebotaba con «falta: prueba»; otra vez anotó ventas «sin dato: ya vende el Sprint»,
// leído de «Vendo el Sprint»), «quiero que la promesa sea exactamente esta: «…». Anótala así» (contestaba «queda
// anotada tal cual» y no la anotaba), y «por WhatsApp… no hay llamadas de venta» (el PDF decía «Llamada de venta»).
// Como `conCobroDelPrecio`: lo determinista no depende de que el modelo lo anote.

/** «Todavía no vendí ninguno», «nadie la compró todavía», «cero ventas». Sobre el texto normalizado (sin tildes). */
const SIN_VENTAS = /\b(?:todavia no (?:vendi|he vendido|vendo)|aun no (?:vendi|he vendido|vendo)|no (?:vendi|he vendido) (?:ninguno|ninguna|nada|ni uno|ni una)|nadie (?:la |lo )?(?:compro|pago|ha comprado)|cero ventas|0 ventas|ninguna venta|sin ventas)\b/;
/** «No tengo casos ni testimonios», «todavía no tengo resultados». */
const SIN_PRUEBA = /\b(?:no tengo|todavia no tengo|aun no tengo|no hay|sin) (?:casos|testimonios|resultados|pruebas)\b/;
/** El dueño pide que algo quede LITERAL. Sobre el texto sin tildes: «anótala así» llega como «anot[ao]l[ao] asi». */
const LITERAL = /\b(?:exactamente|tal cual|textual|textualmente|palabra por palabra|sin cambiar\w*|anot[ao]l[ao] asi)\b/;
/** La pieza que nombra antes de las comillas. «La promesa» es el resultado prometido (la pieza `resultado`). */
const PIEZA_NOMBRADA: ReadonlyArray<[string, PiezaKey]> = [['promesa', 'resultado'], ['resultado', 'resultado'], ['frase', 'frase'], ['garantia', 'garantia'], ['precio', 'precio']];

/**
 * Lo que el dueño pidió anotar TAL CUAL: la pieza que nombra (la última antes de las comillas) y el texto entre «», "" o
 * “”. null si no pidió que quede literal, si no hay comillas o si no nombra una pieza.
 */
export function literalDelDueno(texto: string): { key: PiezaKey; valor: string } | null {
  if (!LITERAL.test(normalizar(texto))) return null;
  const q = texto.match(/[«"“]([^»"”]{3,400})[»"”]/);
  if (!q || q.index == null) return null;
  const antes = normalizar(texto.slice(0, q.index));
  let mejor: { key: PiezaKey; i: number } | null = null;
  for (const [nombre, key] of PIEZA_NOMBRADA) {
    const i = antes.lastIndexOf(nombre);
    if (i >= 0 && (!mejor || i > mejor.i)) mejor = { key, i };
  }
  return mejor ? { key: mejor.key, valor: q[1].trim() } : null;
}

/**
 * Las piezas con lo que el dueño acaba de decir sin vueltas (`texto`: su último mensaje): que todavía no vendió, que no
 * tiene casos, o el texto que pidió anotar tal cual. Gana sobre lo que haya: es lo último que dijo. Va con fuente
 * 'chat' y en sus palabras: «0: …» es lo que lee `alertaSinDatos` como una oferta sin ventas.
 */
export function conLoQueDijoElDueno(piezas: PiezasSabidas, texto: string, at: string = new Date().toISOString()): PiezasSabidas {
  const n = normalizar(texto ?? '');
  const nuevas: Partial<Record<PiezaKey, string>> = {};
  if (SIN_VENTAS.test(n)) nuevas.ventas = '0: todavía no vendió ninguna (lo dijo en el chat)';
  if (SIN_PRUEBA.test(n)) nuevas.prueba = 'Todavía no tiene casos ni testimonios (lo dijo en el chat)';
  const literal = literalDelDueno(texto ?? '');
  if (literal) nuevas[literal.key] = literal.valor;
  return Object.keys(nuevas).length ? mergePiezas(piezas, nuevas, 'chat', at) : piezas;
}

/**
 * Dónde cierra la venta según lo que DIJO el dueño, del mensaje más nuevo al más viejo: el primero que nombra un canal
 * gana. «No hay llamadas» / «sin llamadas» descarta las llamadas (también las de un mensaje más viejo) y, si ningún
 * mensaje nombra otro canal, queda `sinLlamadas` para no imprimir «Llamada de venta». «Por WhatsApp» es vender por chat.
 */
export function canalQueDijo(textos: readonly string[]): { canal: CanalId | null; sinLlamadas: boolean } {
  let sinLlamadas = false;
  for (const t of [...textos].reverse()) {
    const n = normalizar(t ?? '');
    if (/\b(?:sin|no hay|no hago|no tengo|nada de|ni) (?:llamadas?|videollamadas?)\b/.test(n)) sinLlamadas = true;
    if (!sinLlamadas && /\b(?:(?:por|en|con) (?:una )?llamada|agend\w* (?:una )?llamada)\b/.test(n)) return { canal: 'llamadas', sinLlamadas };
    if (/\b(?:por|via|en|desde) (?:whatsapp|wsp|chat|dm|mensajes? directos?|instagram|telegram)\b/.test(n)) return { canal: 'conversaciones', sinLlamadas };
    if (/\b(?:checkout|carrito|link de pago|compran (?:directo|solos))\b/.test(n)) return { canal: 'carrito', sinLlamadas };
    if (/\bwebinar\b/.test(n)) return { canal: 'webinar', sinLlamadas };
    if (/\b(?:presencial|en (?:mi|el|nuestro) local|en persona)\b/.test(n)) return { canal: 'presencial', sinLlamadas };
  }
  return { canal: null, sinLlamadas };
}

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
  const n = normalizar(t);
  // «1: sólo esta» cuenta ESTA oferta, no otra (22/10/2026, prueba de los chats: se leía como 1 otra oferta).
  if (/^\d+\s*:?\s*(?:solo|unicamente)\s+(?:esta|este|esa|ese)\b/.test(n)) return 0;
  const d = t.match(/\d+/);
  if (d) return Number(d[0]);
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
  // Un número con letras también lo es (22/10/2026: «Tu primer cliente de diseño en 14 días» salía «no tiene número»).
  return /\d/.test(sinPlazo) || /\b(?:duplic|triplic|el doble|la mitad|el triple)/i.test(sinPlazo)
    || /\b(?:primer[oa]?s?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|cien|mil)\s+[a-záéíóúñ]/i.test(sinPlazo);
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
export function alertaFoco(p: {
  productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null; otrasDeclaradas?: number | null;
  /** Los nombres de lo que se cuenta en `ofertasActivas` (lib/offer-reglas.ts → `loQueVendeEnMako`). */
  nombres?: readonly string[] | null;
}): string | null {
  const prods = Math.max(0, Math.floor(Number(p.productosActivos) || 0));
  const ofs = Math.max(0, Math.floor(Number(p.ofertasActivas) || 0));
  const decl = typeof p.otrasDeclaradas === 'number' && p.otrasDeclaradas >= 0 ? Math.floor(p.otrasDeclaradas) + 1 : 0;
  const n = Math.max(prods, ofs, decl);
  const b = p.bandaFacturacion;
  const conocida = typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 4;
  if (conocida && (b as number) >= 2) return null;
  if (n < 3) return null;
  // Cada número dice de dónde sale (17/10/2026, tarjeta #888): lo cargado en MaKo, lo que dijo el dueño o su
  // diagnóstico de fase. Y lo de MaKo se NOMBRA (22/10/2026, Mauricio: «no tiene seis, no sé por qué dice que tiene
  // seis»): un conteo que el dueño no puede contrastar no le sirve. Con un empate gana lo cargado, que se nombra.
  const nombres = (p.nombres ?? []).map((x) => x.trim()).filter(Boolean);
  const cuales = nombres.length === ofs ? ` (${listaConY(nombres.map((x) => `«${x}»`))})` : '';
  const que = ofs === n ? `Tienes ${ofs} ofertas activas en tus funnels de MaKo${cuales}`
    : decl === n ? `Vendes ${decl} ofertas, según me dijiste`
      : `Tienes ${prods} productos activos en tus funnels de MaKo`;
  // El monto se dice en la MISMA unidad de la pregunta que el dueño contestó («$0 – $3.000»).
  const factura = !conocida ? '' : `, y según tu diagnóstico de fase facturas menos de ${b === 0 ? '$3.000' : '$10.000'} al mes`;
  return `${que}${factura}: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.`;
}

/**
 * Lo que el negocio VENDE hoy según MaKo, para el aviso de foco y el contexto de la IA (22/10/2026): cada funnel
 * ACTIVO del CRM con al menos una oferta activa ligada es una cosa que vende, y sus ofertas son las que cuentan.
 *
 * Por qué no `ofertas.activa` a secas: en el ws1 eran 6 y Mauricio vende 3. Las otras 3 eran de prueba, con su funnel
 * archivado o sin funnel, y el diagnóstico de su Sprint le dijo «tienes seis ofertas activas en MaKo» (Fathom
 * 195129619, 01:44:37). Y por qué se cuentan FUNNELS y no ofertas: «Guardar» suma cada versión de una oferta a su
 * funnel, así que el Sprint y su versión mejorada son dos filas y una sola cosa que se vende.
 *
 * Los productos: los activos que van en esas ofertas (`oferta_productos`). Un producto suelto del catálogo no se
 * está vendiendo en ningún funnel. null = alguna lectura falló: no se sabe, y no se afirma nada.
 */
export function loQueVendeEnMako(p: {
  funnels: ReadonlyArray<{ id: number; nombre: string }> | null;
  ligas: ReadonlyArray<{ funnel_id: number; oferta_id: number; es_principal?: boolean }> | null;
  ofertas: ReadonlyArray<{ id: number; nombre: string; activa: boolean }> | null;
  ligasProducto: ReadonlyArray<{ oferta_id: number; producto_id: number }> | null;
  productos: ReadonlyArray<{ id: number }> | null;
}): { nombres: string[]; ofertaIds: Set<number>; productos: number } | null {
  if (!p.funnels || !p.ligas || !p.ofertas || !p.ligasProducto || !p.productos) return null;
  const activas = new Map(p.ofertas.filter((o) => o.activa).map((o) => [o.id, o] as const));
  const nombres: string[] = [];
  const ofertaIds = new Set<number>();
  for (const f of p.funnels) {
    const suyas = p.ligas.filter((l) => l.funnel_id === f.id && activas.has(l.oferta_id))
      .sort((a, b) => Number(!!b.es_principal) - Number(!!a.es_principal));
    if (!suyas.length) continue;
    // Se nombra por su oferta (la principal del funnel): es como el dueño la llama («Sprint 3 días»).
    nombres.push(activas.get(suyas[0].oferta_id)?.nombre.trim() || f.nombre);
    for (const l of suyas) ofertaIds.add(l.oferta_id);
  }
  const vivos = new Set(p.productos.map((x) => x.id));
  const productos = new Set(p.ligasProducto.filter((l) => ofertaIds.has(l.oferta_id) && vivos.has(l.producto_id)).map((l) => l.producto_id)).size;
  return { nombres, ofertaIds, productos };
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
  return `Con el precio (${fmtMonto(precio)}) y el costo por cliente (${fmtMonto(costo)}) que me diste, el margen bruto queda en ${pct(Math.max(0, margen))}: por debajo de 60% (el objetivo es 80%).`;
}

/** El margen bruto con los dos montos del dueño (misma moneda), o null. Lo usa también `cifrasConFuente`. */
function margenDe(piezas: PiezasSabidas): number | null {
  const precio = precioDe(piezas.precio?.valor);
  const costo = costoDe(piezas.costo?.valor);
  if (!precio || !costo || precio.monto <= 0) return null;
  if (precio.moneda && costo.moneda && precio.moneda !== costo.moneda) return null;
  return Math.max(0, (precio.monto - costo.monto) / precio.monto);
}

/**
 * El embudo de los últimos 90 días, en CUENTAS de la misma gente y con su período (17/10/2026, tarjeta #888). Lo arma
 * `contextoOffer` con lib/analisis-negocio.ts.
 *
 * Antes eran tasas sueltas, y la de cierre dividía los cierres DEL PERÍODO por las asistencias DEL PERÍODO: a Código
 * Inmobiliario (ws13) el diagnóstico le dijo «Cierras el 43% de todas las llamadas» (9 cierres sobre 21 asistencias), y
 * 4 de esas 9 ventas nunca pasaron por una llamada. Martín, en la revisión del 16/10 (01:48:49): «43, ¿de dónde sacó ese
 * número?». Ahora cada aviso cuenta a la MISMA gente («de los 21 que asistieron, compraron 6») y dice de dónde sale.
 *
 *  · `agendas`: los que reservaron en el período.
 *  · `llamadas`: las primeras llamadas con fecha en el período, por cómo quedó marcada la asistencia.
 *  · `calificados`: de los que asistieron, los marcados como calificados; `sinCalificar`, los que nadie marcó.
 *  · `compraron` / `compraronCalificados`: de los que asistieron (o de los calificados), los que compraron, con
 *    cualquier fecha de cierre.
 */
export type EmbudoOffer = {
  desde: string; hasta: string;
  agendas: number;
  llamadas: { asistieron: number; noAsistieron: number; sinMarcar: number };
  calificados: number; sinCalificar: number;
  compraron: number; compraronCalificados: number;
  /**
   * El funnel del que salen las cuentas (22/10/2026), o ausente si son del negocio entero (una conversación sin
   * funnel). Va en la fuente de cada número: «tu CRM, funnel «Sprint 3 días», del 25/07 al 21/10».
   */
  funnel?: string;
};

/** Con menos llamadas que esto, una tasa es ruido. */
export const MIN_ASISTENCIAS_EMBUDO = 10;

/** Lo que de lib/analisis-negocio.ts (`AnalisisNegocio`) usa el embudo de Offer. */
export type AnalisisParaEmbudo = {
  periodo: { desde: string; hasta: string };
  serie: Array<{ agendas_creadas: number; j1_noshow: number; j1_sin_marcar: number }>;
  calificacion: { asistieron: number; calificados: number; sin_marcar: number; compraron?: number; compraron_calificados?: number };
};

/**
 * El embudo de Offer con el análisis del negocio: la asistencia y la calificación salen de la MISMA lectura que las
 * compras (`leerCalificacion`, los que asistieron a una primera llamada del período). null si el análisis no trae las
 * compras de esa gente o las cuentas no cierran (`embudoValido`).
 */
export function embudoDeAnalisis(a: AnalisisParaEmbudo | null | undefined, funnel?: string | null): EmbudoOffer | null {
  if (!a?.calificacion || !Array.isArray(a.serie)) return null;
  const k = a.calificacion;
  if (k.compraron == null || k.compraron_calificados == null) return null;
  const suma = (f: (x: AnalisisParaEmbudo['serie'][number]) => number) => a.serie.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const e: EmbudoOffer = {
    desde: a.periodo?.desde ?? '', hasta: a.periodo?.hasta ?? '',
    agendas: suma((x) => x.agendas_creadas),
    llamadas: { asistieron: k.asistieron, noAsistieron: suma((x) => x.j1_noshow), sinMarcar: suma((x) => x.j1_sin_marcar) },
    calificados: k.calificados, sinCalificar: k.sin_marcar,
    compraron: k.compraron, compraronCalificados: k.compraron_calificados,
    ...(funnel?.trim() ? { funnel: funnel.trim() } : {}),
  };
  return embudoValido(e) ? e : null;
}

const cuenta = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * ¿Las cuentas se pueden afirmar? Enteros no negativos, y nadie compra ni califica más de los que asistieron. Un
 * embudo que no cierra no dice nada: arriba de 100% hay un escalón contado de menos (el «170%» del 12/10/2026).
 */
export function embudoValido(e: EmbudoOffer | null | undefined): e is EmbudoOffer {
  if (!e || !FECHA_ISO.test(e.desde ?? '') || !FECHA_ISO.test(e.hasta ?? '')) return false;
  const l = e.llamadas;
  if (!l || ![l.asistieron, l.noAsistieron, l.sinMarcar, e.agendas, e.calificados, e.sinCalificar, e.compraron, e.compraronCalificados].every(cuenta)) return false;
  return e.calificados + e.sinCalificar <= l.asistieron && e.compraron <= l.asistieron && e.compraronCalificados <= e.calificados && e.compraronCalificados <= e.compraron;
}

/** «del 19/07 al 16/10» (con el año si el período cruza de un año a otro). */
export function periodoCorto(desde: string, hasta: string): string {
  const a = desde.match(FECHA_ISO);
  const b = hasta.match(FECHA_ISO);
  if (!a || !b) return '';
  const conAnio = a[1] !== b[1];
  const f = (m: RegExpMatchArray) => `${m[3]}/${m[2]}${conAnio ? `/${m[1]}` : ''}`;
  return `del ${f(a)} al ${f(b)}`;
}

/** De dónde sale cada número del embudo, como se dice en un aviso. */
const enTuCrm = (e: EmbudoOffer): string => `tu CRM, ${e.funnel ? `funnel «${e.funnel}», ` : ''}${periodoCorto(e.desde, e.hasta)}`;

/**
 * ¿El funnel de esta oferta todavía no tiene NADA que medir? Ni agendas, ni primeras llamadas, ni compras (22/10/2026,
 * el Sprint de Mauricio: una oferta nueva). Sólo con las cuentas de UN funnel: del negocio entero no se deduce nada
 * de una oferta.
 */
export function embudoSinDatos(e: EmbudoOffer | null | undefined): boolean {
  if (!embudoValido(e) || !e.funnel) return false;
  const l = e.llamadas;
  return e.agendas === 0 && l.asistieron + l.noAsistieron + l.sinMarcar === 0 && e.compraron === 0;
}

/**
 * El aviso de una oferta que todavía no tiene datos de venta: lo dice su funnel (sin agendas, llamadas ni compras) o
 * lo dijo el dueño («¿cuántas personas ya pagaron?» → «0»). Sin esto, el diagnóstico buscaba un cuello de botella en
 * el embudo y lo encontraba en el de OTRA oferta (Mauricio, 22/10/2026, 01:42:50).
 */
export function alertaSinDatos(p: { embudo?: EmbudoOffer | null; ventas?: string | null }): string | null {
  const dijoCero = /^\s*(?:0|cero|ninguna?|nadie)\b/i.test(p.ventas ?? '');
  if (embudoSinDatos(p.embudo)) {
    const e = p.embudo as EmbudoOffer;
    return `«${e.funnel}» todavía no tiene agendas, llamadas ni ventas en tu CRM (${periodoCorto(e.desde, e.hasta)})${dijoCero ? ', y me dijiste que nadie la compró todavía' : ''}: es una oferta sin datos de venta. Este diagnóstico mira la oferta, no sus resultados.`;
  }
  if (dijoCero) return 'Me dijiste que nadie compró esta oferta todavía: es una oferta sin datos de venta. Este diagnóstico mira la oferta, no sus resultados.';
  return null;
}

/**
 * El cierre que un aviso puede AFIRMAR: sobre los calificados si hay suficientes (los rangos del marco son sobre las
 * llamadas calificadas), si no sobre todos los que asistieron. `texto` es la frase con su fuente. null sin datos.
 */
export function cierreDelEmbudo(e: EmbudoOffer | null | undefined): { base: number; compraron: number; tasa: number; calificados: boolean; texto: string } | null {
  if (!embudoValido(e)) return null;
  const calificados = e.calificados >= MIN_ASISTENCIAS_EMBUDO;
  const base = calificados ? e.calificados : e.llamadas.asistieron;
  if (base < MIN_ASISTENCIAS_EMBUDO) return null;
  const compraron = calificados ? e.compraronCalificados : e.compraron;
  const quienes = calificados ? 'calificadas que asistieron' : 'que asistieron';
  return {
    base, compraron, tasa: compraron / base, calificados,
    texto: `De las ${base} personas ${quienes} a la primera llamada (${enTuCrm(e)}), compraron ${compraron}: el ${pct(compraron / base)}.`,
  };
}

/** La asistencia, sobre las llamadas con la asistencia MARCADA: las que nadie marcó no se cuentan como faltas. */
export function asistenciaDelEmbudo(e: EmbudoOffer | null | undefined): { marcadas: number; tasa: number } | null {
  if (!embudoValido(e)) return null;
  const marcadas = e.llamadas.asistieron + e.llamadas.noAsistieron;
  return marcadas >= MIN_ASISTENCIAS_EMBUDO ? { marcadas, tasa: e.llamadas.asistieron / marcadas } : null;
}

/**
 * Dónde se cortan las ventas, contra los rangos del §6.4 (asistencia 60-80%, cierre 25-40% de las llamadas
 * calificadas): «la oferta es lo último que se corrige». Sin datos suficientes, nada. El cierre bajo se afirma sólo
 * sobre los calificados: sobre todos los que asistieron puede estar bajo por los que no calificaban.
 */
export function alertasEmbudo(e: EmbudoOffer | null | undefined): string[] {
  if (!embudoValido(e)) return [];
  const out: string[] = [];
  const a = asistenciaDelEmbudo(e);
  if (a && a.tasa < 0.6) {
    const sin = e.llamadas.sinMarcar > 0 ? `; ${e.llamadas.sinMarcar} sin marcar no cuentan` : '';
    out.push(`De ${a.marcadas} primeras llamadas con la asistencia marcada (${enTuCrm(e)}${sin}), vinieron ${e.llamadas.asistieron}: el ${pct(a.tasa)}. Lo sano es de 60% a 80%: las ventas se cortan antes de la llamada; antes de cambiar la oferta, revisa cómo se confirman las agendas.`);
  }
  const c = cierreDelEmbudo(e);
  if (c?.calificados && c.tasa < 0.25) {
    out.push(`${c.texto} Lo sano es de 25% a 40%: las ventas se cortan en la llamada; antes de cambiar la oferta, revisa el cierre.`);
  }
  return out;
}

/**
 * Cuándo subir (o no tocar) el precio, con las señales del §6.2: el % cobrado al firmar que dijo el dueño y el cierre
 * del embudo. Cada aviso dice el número que lo dispara y de dónde sale.
 */
export function alertasPrecio(p: { cobro: number | null; embudo?: EmbudoOffer | null }): string[] {
  const out: string[] = [];
  if (p.cobro != null && p.cobro > 75) {
    out.push(`Te pagan el ${p.cobro}% al firmar, según me dijiste: más de 75% es señal de que el precio está barato. Súbelo por escalones (entre 250 y 1.000 USD, o un 20%, cada 3 a 5 ventas sin fricción).`);
  } else if (p.cobro != null && p.cobro < 50) {
    out.push(`Te pagan el ${p.cobro}% al firmar, según me dijiste: menos de la mitad. Antes de tocar el precio, revisa el cliente ideal y el valor.`);
  }
  const c = cierreDelEmbudo(p.embudo);
  if (c && c.tasa > 0.3) out.push(`${c.texto} Más de 30% es señal de que hay margen para subir el precio.`);
  return out;
}

/**
 * El embudo que lee la IA del diagnóstico, con las MISMAS cuentas que los avisos y su fuente (17/10/2026). Antes iba el
 * informe entero de lib/analisis-modelo.ts (`analisisAMarkdown`), con la tasa de cierre del período (el «43%») y
 * recortado a 4.000 caracteres: la IA repetía un número que el aviso ya no decía. '' sin datos.
 */
export function embudoParaPrompt(e: EmbudoOffer | null | undefined): string {
  if (!embudoValido(e)) return '';
  const l = e.llamadas;
  if (embudoSinDatos(e)) {
    return [
      `Fuente: ${enTuCrm(e)}.`,
      `- El funnel de esta oferta todavía NO tiene agendas, llamadas ni ventas: es una oferta sin datos de venta.`,
      '- No digas dónde se corta su embudo ni cuánto cierra, y no uses números de otros funnels ni del negocio entero.',
    ].join('\n');
  }
  const lineas = [
    `Fuente: ${enTuCrm(e)}.`,
    `- Agendas (reservaron una llamada): ${e.agendas}.`,
    `- Primeras llamadas: ${l.asistieron + l.noAsistieron + l.sinMarcar} (asistieron ${l.asistieron}, no asistieron ${l.noAsistieron}, sin marcar ${l.sinMarcar}).`,
    `- De las ${l.asistieron} que asistieron: ${e.calificados} calificadas, ${e.sinCalificar} sin marcar si calificaban.`,
    `- Compraron ${e.compraron} de las ${l.asistieron} que asistieron (${e.compraronCalificados} de las ${e.calificados} calificadas).`,
  ];
  return lineas.join('\n');
}

/**
 * Todos los avisos que el CÓDIGO calcula antes del diagnóstico, en orden: foco, margen, embudo, precio. Los
 * lee la IA que pone las notas (tarjeta «foco»: «se calcula ANTES del diagnóstico») y quedan en el cálculo.
 */
export function avisosAntesDelDiagnostico(p: {
  foco: { productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null; nombres?: readonly string[] | null };
  piezas: PiezasSabidas; embudo?: EmbudoOffer | null;
}): { foco: string | null; otras: string[] } {
  const foco = alertaFoco({ ...p.foco, otrasDeclaradas: ofertasDeclaradas(p.piezas.otras?.valor) });
  const margen = alertaMargen(p.piezas);
  const sinDatos = alertaSinDatos({ embudo: p.embudo, ventas: p.piezas.ventas?.valor });
  // El % al firmar es señal de precio barato cuando el cliente PODÍA pagar en cuotas y no quiso (§6.2). Con un pago
  // único no hay cuotas: el 100% no dice nada (22/10/2026, el Sprint de 270 USD: «súbelo entre 250 y 1.000 USD»).
  const cobroComoSenal = esPagoUnico(p.piezas.precio?.valor) ? null : porcentajeAlFirmar(p.piezas.cobro?.valor);
  return {
    foco,
    otras: [...(sinDatos ? [sinDatos] : []), ...(margen ? [margen] : []), ...alertasEmbudo(p.embudo), ...alertasPrecio({ cobro: cobroComoSenal, embudo: p.embudo })],
  };
}

// ── Cada número del diagnóstico dice de dónde sale (17/10/2026, tarjeta #888) ──
// «Cada número del diagnóstico dice de dónde sale, o no aparece.» Los avisos ya lo dicen (arriba). Lo que escribe la
// IA (la tesis, el porqué y la mejora de cada nota, lo fuerte, los cambios) se revisa CIFRA por CIFRA:
//  · una que dio el dueño (sus mensajes, sus documentos, sus piezas, lo que tenía cargado) queda: la cita a él;
//  · una que calculó el sistema con el CRM o con su precio y su costo queda, con su fuente al lado la primera vez
//    («el 46% (según tu CRM)»), salvo que la frase ya la diga;
//  · una de los rangos del marco que traen los avisos («lo sano es de 60% a 80%») queda;
//  · cualquier otra es un número inventado: la FRASE que la trae no aparece. En lo que PROPONE (la mejora, el título y
//    la hipótesis de un cambio), sólo si la frase la afirma sobre el negocio de hoy («dado que cierras el 43%»):
//    «súbelo a 2.490 USD» es una propuesta y se lee así.
// Sólo se revisan las MEDICIONES (un porcentaje o un número de 10 para arriba): «3 cambios», «1 a 1» o «5 filtros»
// son partes de la estructura, no datos del negocio. Nunca se revisan un año, un rótulo («Fase 1», «D7»), un plazo
// («en 90 días») ni una escala («8 de 10», «24/7»).

/** De dónde sale una cifra que calculó el sistema, como se dice al lado del número. */
export const FUENTE_CRM = 'según tu CRM';
export const FUENTE_MARGEN = 'con tu precio y tu costo';

/**
 * Las cifras que calculó el SISTEMA, con su fuente (las del embudo y el margen). Un porcentaje va con su «%» en la clave
 * (`claveConFuente`): en el ws13, «43 llamadas marcadas» y «60 agendas» chocaban con «43%» y «60%».
 */
/** La clave de una cifra del sistema: el valor, y «%» si es un porcentaje. */
export const claveConFuente = (clave: string | null, porcentaje: boolean): string | null => (clave == null ? null : porcentaje ? `${clave}%` : clave);

export function cifrasConFuente(e: EmbudoOffer | null | undefined, piezas: PiezasSabidas): Map<string, string> {
  const out = new Map<string, string>();
  const poner = (k: string | null, fuente: string) => { if (k && !out.has(k)) out.set(k, fuente); };
  if (embudoValido(e)) {
    const l = e.llamadas;
    for (const n of [e.agendas, l.asistieron, l.noAsistieron, l.sinMarcar, l.asistieron + l.noAsistieron, l.asistieron + l.noAsistieron + l.sinMarcar, e.calificados, e.sinCalificar, e.compraron, e.compraronCalificados]) {
      poner(claveConFuente(String(n), false), FUENTE_CRM);
    }
    const a = asistenciaDelEmbudo(e);
    const porc = (x: number) => claveConFuente(claveCifra(pct(x)), true);
    if (a) poner(porc(a.tasa), FUENTE_CRM);
    if (l.asistieron > 0) poner(porc(e.compraron / l.asistieron), FUENTE_CRM);
    if (e.calificados > 0) poner(porc(e.compraronCalificados / e.calificados), FUENTE_CRM);
  }
  const m = margenDe(piezas);
  if (m != null) poner(claveConFuente(claveCifra(pct(m)), true), FUENTE_MARGEN);
  return out;
}

/** Lo que escribió el DUEÑO en la conversación y lo que dicen sus documentos: de ahí salen, con las piezas y lo cargado, las cifras que dio el negocio. */
export function fuentesDelDueno(f: { mensajes: ReadonlyArray<Pick<MensajeGuardado, 'de' | 'texto'>>; documentos: ReadonlyArray<{ texto: string }> }): string[] {
  return [...f.mensajes.filter((m) => m.de === 'yo').map((m) => m.texto), ...f.documentos.map((d) => d.texto)];
}

/** Los valores de las piezas con dato: una «sin dato» no es una cifra del negocio. */
export const valoresDeLasPiezas = (piezas: PiezasSabidas): string[] =>
  PIEZA_KEYS.filter((k) => tieneDato(piezas, k)).map((k) => piezas[k]?.valor ?? '');

/**
 * Las cifras de unos textos con la MISMA clave que `cifrasConFuente` (un porcentaje lleva su «%»), sin horas ni fechas.
 * Para el diagnóstico (#888): lo que dio el dueño y lo que traen los avisos. «De 43 primeras llamadas» no le da fuente a
 * un «43%», y un porcentaje es del dueño sólo si él dijo un porcentaje («50%», «50 por ciento»).
 */
export function cifrasConPorcentaje(textos: ReadonlyArray<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const t of textos) {
    const limpio = sinHorasNiFechas(t);
    for (const m of limpio.matchAll(CIFRA_ESCALA)) {
      const porCiento = /^\s*por\s*ciento\b/i.test(limpio.slice((m.index ?? 0) + m[0].length));
      const k = claveConFuente(claveCifra(m[0]), m[0].includes('%') || porCiento);
      if (k) out.add(k);
    }
  }
  return out;
}

/**
 * Lo que el diagnóstico sabe de cada cifra: lo que dio el negocio, lo que calculó el sistema y lo que traen los avisos,
 * las tres con la clave de `cifrasConPorcentaje` / `cifrasConFuente`.
 */
export type FuentesDeCifras = { delNegocio: Set<string>; conFuente: Map<string, string>; deLosAvisos: Set<string> };

/** Una ESCALA o una notación, no un dato: «8 de 10», «71 de 100», «24/7», «5/5». */
const ES_ESCALA_ANTES = /\d\s*(?:de|\/)\s*$/i;
const ES_NOTACION_DESPUES = /^\/\d/;
const LETRA_ANTES = /[a-záéíóúñ]$/i;

type CifraDeTexto = { m: string; offset: number; clave: string; llave: string };

/** Las MEDICIONES de un texto (ver arriba): un porcentaje o un número de 10 para arriba que no es año, rótulo, plazo ni escala. */
function medicionesDe(t: string): CifraDeTexto[] {
  const out: CifraDeTexto[] = [];
  for (const x of t.matchAll(CIFRA_ESCALA)) {
    const m = x[0];
    const offset = x.index ?? 0;
    const clave = claveCifra(m);
    if (!clave) continue;
    const antes = t.slice(0, offset);
    const despues = t.slice(offset + m.length);
    const porcentaje = m.includes('%');
    if (!porcentaje && Number(clave) < 10) continue;
    if (ES_ANIO.test(m.trim()) || LETRA_ANTES.test(antes) || ROTULO_ANTES.test(antes) || ES_NOTACION_DESPUES.test(despues)) continue;
    if ((clave === '10' || clave === '100') && ES_ESCALA_ANTES.test(antes)) continue;
    if (!porcentaje && UNIDAD_PLAZO.test(despues) && !esTiempoDeResultado(antes, despues)) continue;
    out.push({ m, offset, clave, llave: claveConFuente(clave, porcentaje) as string });
  }
  return out;
}

/** Las frases de un texto, con su separador pegado (para volver a juntarlas tal cual). */
const frasesDe = (t: string): string[] => t.split(/(?<=[.!?])\s+/).filter((f) => f.trim() !== '');

/**
 * Lo que vuelve una cifra de una PROPUESTA en una afirmación sobre el negocio de HOY: «dado que cierras el 43%», «hoy
 * vendes 12». En la mejora, el título y la hipótesis de un cambio, una cifra sin esto es lo que MaKo propone («súbelo a
 * 2.490 USD», «limita a 5 cupos») y se lee como propuesta; con esto, es un dato y necesita su fuente.
 */
const AFIRMA_HOY = /\b(?:dado que|ya que|hoy|actualmente|cierras|cierra|asisten?|vendes|vende|facturas|factura|tienes|tiene|cobras|cobra|conviertes|convierte|logras|logra|pierdes|pierde|gastas|gasta)\b/i;

/**
 * Un texto de la IA con sus cifras revisadas (ver arriba): la frase con una cifra sin fuente sale; la primera cifra del
 * sistema lleva su fuente al lado. Con `propuesta` (la mejora, el título y la hipótesis de un cambio), una cifra sin
 * fuente sólo saca la frase si la AFIRMA sobre el negocio de hoy (`AFIRMA_HOY`). Devuelve '' si no queda ninguna frase.
 */
export function textoConFuentes(t: string, f: FuentesDeCifras, opts: { propuesta?: boolean } = {}): string {
  if (!t?.trim()) return t ?? '';
  const anotadas = new Set<string>();
  const frases: string[] = [];
  for (const frase of frasesDe(t)) {
    const cifras = medicionesDe(frase);
    const sinFuente = (c: CifraDeTexto) => !f.delNegocio.has(c.llave) && !f.conFuente.has(c.llave) && !f.deLosAvisos.has(c.llave)
      && (!opts.propuesta || AFIRMA_HOY.test(frase.slice(0, c.offset)));
    if (cifras.some(sinFuente)) continue;
    let out = frase;
    // De atrás para adelante, así los offsets de las de antes siguen valiendo.
    for (const c of [...cifras].reverse()) {
      if (f.delNegocio.has(c.llave)) continue;
      const fuente = f.conFuente.get(c.llave);
      if (!fuente || anotadas.has(fuente)) continue;
      const yaLaDice = normalizar(t).includes(normalizar(fuente)) || (fuente === FUENTE_CRM && /\bCRM\b/i.test(t));
      if (yaLaDice) continue;
      // Sólo la PRIMERA de cada fuente en el texto: si hay otra antes en esta frase, ésa es la que se anota.
      if (cifras.some((o) => o.offset < c.offset && !f.delNegocio.has(o.llave) && f.conFuente.get(o.llave) === fuente)) continue;
      out = `${out.slice(0, c.offset + c.m.length)} (${fuente})${out.slice(c.offset + c.m.length)}`;
      anotadas.add(fuente);
    }
    frases.push(out);
  }
  return frases.join(' ');
}

/** El diagnóstico de la IA con cada texto revisado por `textoConFuentes`. Un cambio que se queda sin título lo dice. */
export function diagnosticoConFuentes(d: DiagnosticoOferta, f: FuentesDeCifras): DiagnosticoOferta {
  const r = (t: string) => textoConFuentes(t, f);
  const p = (t: string) => textoConFuentes(t, f, { propuesta: true });
  const fuertes = (d.fuertes ?? []).map(r).filter((x) => x.trim() !== '');
  return {
    ...d,
    tesis: r(d.tesis),
    fuerte: r(d.fuerte) || fuertes[0] || '',
    fuertes,
    dimensiones: d.dimensiones.map((n) => ({ ...n, porque: r(n.porque), mejora: p(n.mejora) })),
    cambios: d.cambios.map((c) => ({ titulo: p(c.titulo) || `${MARCA_COMPLETAR} otro cambio con impacto`, porque: r(c.porque), hipotesis: p(c.hipotesis) })),
  };
}

/**
 * Lo guardado ANTES del 17/10/2026 (sin `cifrasConFuente`), como se puede MOSTRAR: los avisos del embudo de entonces
 * (la tasa del período, sin fuente: el «43%» de Código Inmobiliario) no aparecen, y en lo que escribió la IA tampoco
 * la frase que repite la cifra de uno de ellos, salvo que la haya dado el dueño. Lo demás queda como estaba. No se
 * reescribe la fila: es la lectura de la pantalla, el PDF y la API de MaKo.
 */
const AVISO_VIEJO_DEL_EMBUDO = /^(?:Asiste el \d+(?:[.,]\d+)?\s?% de los que agendan|Cierras (?:el|menos del) \d+(?:[.,]\d+)?\s?% de (?:todas )?las llamadas)/;
export function conclusionParaMostrar<C extends { diagnostico: DiagnosticoOferta; calculo: CalculoDiagnostico }>(c: C, delNegocio: () => Set<string>): C {
  if (!c?.calculo || c.calculo.cifrasConFuente) return c;
  const alertas = Array.isArray(c.calculo.alertas) ? c.calculo.alertas : [];
  const viejas = alertas.filter((a) => typeof a === 'string' && AVISO_VIEJO_DEL_EMBUDO.test(a));
  if (!viejas.length) return c;
  const delDueno = delNegocio();
  const sinFuente = new Set(viejas.map((a) => claveConFuente(claveCifra(a.match(/\d+(?:[.,]\d+)?\s?%/)?.[0] ?? ''), true)).filter((k): k is string => !!k && !delDueno.has(k)));
  const llaveDe = (m: string) => claveConFuente(claveCifra(m), m.includes('%')) ?? '';
  const sacar = (t: string) => (t ? frasesDe(t).filter((fr) => ![...fr.matchAll(CIFRA_ESCALA)].some((x) => sinFuente.has(llaveDe(x[0])))).join(' ') : t);
  const d = c.diagnostico;
  const fuertes = (d.fuertes ?? []).map(sacar).filter((x) => x.trim() !== '');
  return {
    ...c,
    calculo: { ...c.calculo, alertas: alertas.filter((a) => !viejas.includes(a)) },
    diagnostico: {
      ...d,
      tesis: sacar(d.tesis),
      fuerte: sacar(d.fuerte) || fuertes[0] || '',
      fuertes,
      dimensiones: d.dimensiones.map((n) => ({ ...n, porque: sacar(n.porque), mejora: sacar(n.mejora) })),
      cambios: d.cambios.map((x) => ({ titulo: sacar(x.titulo) || `${MARCA_COMPLETAR} otro cambio con impacto`, porque: sacar(x.porque), hipotesis: sacar(x.hipotesis) })),
    },
  };
}

/** Lo guardado antes del 22/10/2026 puede traer «[de: chat]» copiado por el modelo: se LEE sin la marca, a fondo. */
function sinMarcasAFondo<T>(v: T): T {
  // Sin marcas devuelve el MISMO objeto: quien lee compara por referencia para saber si hubo algo que arreglar.
  if (typeof v === 'string') return (/\[de:/i.test(v) ? sinMarcaDeFuente(v) : v) as T;
  if (Array.isArray(v)) { const m = v.map(sinMarcasAFondo); return (m.every((x, i) => x === v[i]) ? v : m) as T; }
  if (v && typeof v === 'object') {
    let cambio = false;
    const o = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => { const y = sinMarcasAFondo(x); if (y !== x) cambio = true; return [k, y]; }));
    return (cambio ? o : v) as T;
  }
  return v;
}

/**
 * `conclusionParaMostrar` con las cifras que dio el negocio en ESTA conversación (sus piezas, sus mensajes, sus
 * documentos). Y «Los números» de una propuesta guardada ANTES del 17/10/2026 se leen con la marca de lo que estimó MaKo
 * (`numeroDeLaPropuesta`), sin reescribir la fila: el PDF de Código Inmobiliario se vuelve a armar desde lo guardado.
 * Acá no está el contexto cargado (el CRM): una cifra que salió de ahí se lee «estimada», que es el lado seguro.
 */
export function conclusionVisible<C extends { diagnostico: DiagnosticoOferta; calculo: CalculoDiagnostico }>(
  c: C, f: { piezas: PiezasSabidas; mensajes: ReadonlyArray<Pick<MensajeGuardado, 'de' | 'texto'>>; documentos: ReadonlyArray<{ texto: string }> },
): C {
  const vista = conclusionParaMostrar(sinMarcasAFondo(c), () => cifrasConPorcentaje([...valoresDeLasPiezas(f.piezas), ...fuentesDelDueno(f)]));
  const pr = (vista as { propuesta?: PropuestaOferta | null }).propuesta;
  if (!pr || !Array.isArray(pr.numeros) || !pr.numeros.length) return vista;
  const permitidas = cifrasDelNegocio([...valoresDeLasPiezas(f.piezas), ...fuentesDelDueno(f), pr.inversion?.precio, pr.inversion?.contado, pr.inversion?.plan]);
  const margen = margenDe(f.piezas);
  const k = margen != null ? claveCifra(pct(margen)) : null;
  if (k) permitidas.add(k);
  const numeros = pr.numeros.map((n) => numeroDeLaPropuesta(n, permitidas).texto);
  if (numeros.every((n, i) => n === pr.numeros[i])) return vista;
  return { ...vista, propuesta: { ...pr, numeros } };
}

// ── La oferta provisional y el PDF en el chat (tarjeta «rehacer») ─────────────

// ── Lo guardado no se recalcula: el diagnóstico armado con el embudo de otro funnel (OF1, 22/10/2026) ──
// Hasta el 22/10/2026 el embudo de una conversación CON funnel era el del negocio entero (`analisisNegocio`): la v1 del
// Sprint de Mauricio (ws1, sesión 18) quedó guardada con «solo 2 ventas de 24 asistentes», que eran de «Negocio que
// ESCALA». `embudoDeFunnel` lo arregló hacia adelante, pero una conclusión es un documento guardado y nadie la vuelve a
// armar: se seguía mostrando y la API de MaKo se la pasaba a los chats como contexto para prospectar. Al leer se MARCA
// (no se reescribe): la pantalla avisa con «Rehacer el diagnóstico» y la API no la entrega. Se escribe sólo cuando la
// persona la rehace.

/**
 * Desde cuándo rige el embudo POR FUNNEL en producción: el aviso de Integración de que 4ddff71d1 (O1-O3) estaba
 * desplegado llegó a las 07:33:25 UTC del 22/10/2026 (el merge a main fue a las 07:12, y el run 233 arrancó a las 07:17).
 * Lo armado antes, en una conversación con funnel, usó el CRM entero.
 */
export const EMBUDO_POR_FUNNEL_DESDE = '2026-10-22T07:33:00Z';

/**
 * ¿Esta conclusión se armó con el embudo del negocio entero en una conversación de un funnel? Pura: si el negocio
 * tenía leads de OTROS funnels (si no, el negocio entero ERA ese funnel y los números están bien: el ws13 tiene uno solo)
 * lo dice quien lee la base (`nombresDeSesion`). Una conclusión sin fecha es de antes: se la trata como vieja.
 */
export function armadaConElEmbudoViejo(c: { at?: unknown } | null | undefined, funnelId: number | null): boolean {
  if (!c || funnelId == null) return false;
  const t = typeof c.at === 'string' ? Date.parse(c.at) : NaN;
  return !Number.isFinite(t) || t < Date.parse(EMBUDO_POR_FUNNEL_DESDE);
}

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
/**
 * Para qué sirve lo que se acaba de armar (22/10/2026, Mauricio al recibir el PDF, 01:49:58: «¿le guardo o qué hago? O
 * sea, ¿cuál es el propósito?»). Lo dice el mensaje del PDF y el de «Así está bien».
 */
export const PARA_QUE_SIRVE = 'Guárdala en tu funnel: MaKo usa esta oferta como contexto para prospectar y para escribirles a tus leads.';

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
    texto: `Aquí está la versión ${p.version} de tu oferta, en PDF. ${PARA_QUE_SIRVE} ¿La pulimos? ${empezar}`,
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
    texto: `Perfecto: la versión ${ultimoMako.pdf.version} es la final. ${PARA_QUE_SIRVE} También puedes volver a pulirla cuando quieras.`,
    opciones: [OPCION_PULIR],
  };
}

// ── El armado en el servidor (16/10/2026) ────────────────────────────────────
// «Armar mi oferta» eran dos pedidos que esperaba el NAVEGADOR (diagnóstico y oferta): si la persona cerraba
// la pestaña en el primero, la oferta no se hacía nunca, y al volver había que empezar de cero. Ahora el
// servidor corre los dos pasos solo (`after()` en app/api/offer/route.ts) y la pantalla sólo mira cómo va.
// Lo que queda guardado en la fila (`offer_sesiones.armado`, mig 0296) es esto:

export type ArmadoOffer = {
  /** Cuándo arrancó (ISO). Con esto se sabe si se cortó: ver `ARMADO_VENCE_MS`. */
  desde: string;
  paso: PasoArmado;
  /** De dónde se pidió: el onboarding o la tab. Viaja al aviso de «oferta lista» (el link cambia). */
  origen: 'arranque' | 'tab';
  /** Quién de este armado: un paso de un armado VIEJO no puede pisar el de uno nuevo. */
  intento: string;
  /** Si falló: lo que se le muestra al dueño. El reintento arranca desde `paso`. */
  error?: string;
};

/**
 * Lo más que puede durar un armado entero: el `maxDuration` de la ruta (800 s) y un margen. Pasado eso sin
 * terminar, la función se cortó (un deploy, un corte de la plataforma) y el armado se da por fallido: si no,
 * la pantalla quedaría «armando» para siempre y nadie podría volver a pedirlo.
 */
export const ARMADO_VENCE_MS = 15 * 60_000;
export const ARMADO_CORTADO = 'Se cortó mientras armaba tu oferta. Vuelve a tocar «Armar mi oferta».';

export function sanearArmado(raw: unknown): ArmadoOffer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.desde !== 'string' || Number.isNaN(Date.parse(o.desde))) return null;
  if (o.paso !== 'diagnostico' && o.paso !== 'oferta') return null;
  if (typeof o.intento !== 'string' || !o.intento) return null;
  return {
    desde: o.desde, paso: o.paso, intento: o.intento,
    origen: o.origen === 'arranque' ? 'arranque' : 'tab',
    ...(typeof o.error === 'string' && o.error.trim() ? { error: o.error.trim().slice(0, 400) } : {}),
  };
}

/** ¿Hay un armado corriendo AHORA? (Ni fallido ni vencido.) Mientras lo hay, no se arranca otro. */
export function armadoEnCurso(a: ArmadoOffer | null, ahora: number): boolean {
  return !!a && !a.error && ahora - Date.parse(a.desde) < ARMADO_VENCE_MS;
}

/**
 * Lo que ve la pantalla del armado: en curso (con su paso) o fallido (con el error y desde qué paso se
 * reintenta). Uno vencido es un fallido con `ARMADO_CORTADO`. null = no hay ninguno. (El tipo vive en
 * lib/offer-marco.ts, que es el que importa la pantalla.)
 */
export function armadoParaVista(a: ArmadoOffer | null, ahora: number): ArmadoVista | null {
  if (!a) return null;
  if (a.error) return { paso: a.paso, corriendo: false, error: a.error };
  if (!armadoEnCurso(a, ahora)) return { paso: a.paso, corriendo: false, error: ARMADO_CORTADO };
  return { paso: a.paso, corriendo: true, error: null };
}

/** Desde qué paso arranca un armado nuevo: si el diagnóstico ya está hecho (`borrador`), desde la oferta. */
export const pasoInicialDelArmado = (hayBorrador: boolean): PasoArmado => (hayBorrador ? 'oferta' : 'diagnostico');

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
/** Cuántas veces el precio de una ENTRADA ya es convertirla en otra oferta (Leila: 800 MXN al mes → 1.000 USD, ~25×). */
const SALTO_DE_ENTRADA = 3;

/**
 * Lo que de la oferta nueva lee el CLIENTE del negocio (la landing, el VSL, la llamada): todo menos los números, cómo
 * validarla y el escalón siguiente, que son para el dueño.
 */
function textoParaElCliente(p: PropuestaOferta): string {
  return [
    p.nombre, p.frase, p.mensajes.corto, p.mensajes.largo, p.mensajes.entrada,
    p.paraQuien.perfil, p.paraQuien.minimo, p.paraQuien.noEs,
    p.problema.hoy, p.problema.despues, ...p.problema.obstaculos, p.problema.yaProbo,
    ...p.mecanismo.pasos, p.mecanismo.distinto,
    ...p.ruta.flatMap((f) => [f.fase, f.objetivo, f.hito]),
    ...p.incluye.flatMap((e) => [e.nombre, e.beneficio]),
    p.formato, p.garantia.nombre, p.garantia.condiciones, p.garantia.siNoCumple,
    ...p.bonos.flatMap((b) => Object.values(b).filter((x): x is string => typeof x === 'string')),
    p.inversion.comoDecirlo, p.urgencia, p.escenarios.mejor, p.escenarios.peor,
  ].filter(Boolean).join('\n');
}

/**
 * La jerga de consultor (16/10/2026, Leila: «demasiado corporativo, un poco marquetinero», sobre una oferta para
 * dueños de negocio de 40 a 55 con «baja familiaridad técnica» que hablaba de SOPs, LTV:CAC y «descentralización»).
 * Sólo se avisa la que el DUEÑO no usó: si él dice «KPIs», su cliente también.
 */
const JERGA: readonly string[] = [
  'SOP', 'SOPs', 'KPI', 'KPIs', 'LTV', 'CAC', 'ROI', 'sistematización', 'sistematizar', 'microgestión', 'descentralización',
  'escalabilidad', 'framework', 'stakeholders', 'apalancamiento', 'sinergia', 'sinergias', 'gerencial', 'benchmark', 'workflow', 'upsell',
];
export function jergaAjena(p: PropuestaOferta, fuentes: ReadonlyArray<string | null | undefined>): string[] {
  const texto = normalizar(textoParaElCliente(p));
  const delDueno = normalizar(fuentes.filter(Boolean).join('\n'));
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const esta = (t: string, en: string) => new RegExp('(^|[^a-z0-9])' + escapar(normalizar(t)) + '([^a-z0-9]|$)').test(en);
  const out = JERGA.filter((t) => esta(t, texto) && !esta(t, delDueno));
  // «SOP» y «SOPs» son la misma palabra: queda una.
  return out.filter((t) => !(t.endsWith('s') && out.includes(t.slice(0, -1))));
}

// Los detectores (nombran la forma rioplatense para reconocerla): lib/offer-quien-hace.ts, fuera de la guarda de voseo.
/**
 * QUIÉN HACE EL TRABAJO (16/10/2026, Martín en la llamada con Leila: «yo no le puedo prometer implementar una
 * estructura cuando lo tiene que hacer él… Es un curso»; Leila: hay que distinguir «do-it-yourself, done-with-you y
 * done-for-you»). Si lo que vende el dueño lo hace su cliente y la oferta promete hacerlo por él, el aviso; si no, null.
 * Sin formato ni entregables no se sabe, y no se avisa.
 */
export function prometeHacerloPorElCliente(p: PropuestaOferta, piezas: PiezasSabidas): string | null {
  const loQueVende = [piezas.formato?.valor, piezas.entregables?.valor].filter((x): x is string => !!x && !esSinDato(x)).join(' · ');
  if (!loQueVende || !RE_LO_HACE_EL_CLIENTE.test(loQueVende) || RE_LO_HACE_EL_NEGOCIO.test(loQueVende)) return null;
  const m = RE_PROMETE_HACERLO.exec(textoParaElCliente(p));
  if (!m) return null;
  return `La oferta promete hacerlo POR tu cliente («${m[0]}»), y lo que vendes lo hace él con tu guía (${recortar(colapsar(loQueVende), 90)}). Cámbialo antes de usarla.`;
}

/**
 * La marca de un número de «Los números» que ESTIMÓ MaKo (17/10/2026, la mitad que quedó del «43», #888).
 *
 * El caso: en la Parte 2 del PDF de Código Inmobiliario la IA escribía márgenes y un «LTV:CAC estimado superior a 5 a
 * 1» que nadie le dio (el prompt le pide margen bruto, ventas y llamadas necesarias, % cobrado al firmar y LTV:CAC
 * «con la cuenta a la vista»). Decisión con criterio (la dejó abierta docs/hallazgos-offer.md): el código no los puede
 * CALCULAR —no tiene el costo de adquisición, la recompra ni la retención—, así que los MARCA, como la decisión 10 de
 * Martín (12/10/2026: «el PDF lista lo que propuso MaKo, separado de lo que dijo el negocio»): una línea con una cifra
 * que el negocio no dio queda escrita, con esta marca al final, y va a «Lo que propuso MaKo». Una CUENTA a la vista
 * hecha sólo con cifras del negocio («10.000 USD / 2.490 USD = 4 ventas») es un cálculo, no una estimación.
 */
export const MARCA_ESTIMADO = '(estimado por MaKo)';

/** Una línea de «Los números», con la marca si trae una cifra que el negocio no dio (ver `MARCA_ESTIMADO`). */
export function numeroDeLaPropuesta(linea: string, permitidas: Set<string>): { texto: string; estimado: boolean } {
  const t = (linea ?? '').trim();
  if (!t || t.includes(MARCA_COMPLETAR)) return { texto: linea, estimado: false };
  const sinMarca = t.replace(MARCA_ESTIMADO, '').trim();
  if (!tieneCifraAjena(sinMarca, permitidas)) return { texto: sinMarca, estimado: false };
  // La cuenta a la vista: si todo lo que va antes del ÚLTIMO «=» lo dio el negocio, lo de después sale de ahí.
  const igual = sinMarca.lastIndexOf('=');
  if (igual > 0 && /\d/.test(sinMarca.slice(0, igual)) && !tieneCifraAjena(sinMarca.slice(0, igual), permitidas)) {
    return { texto: sinMarca, estimado: false };
  }
  return { texto: `${sinMarca} ${MARCA_ESTIMADO}`, estimado: true };
}

export function aplicarReglasPropuesta(p: PropuestaOferta, piezas: PiezasSabidas, ctx: ContextoReglas = {}): PropuestaOferta {
  const deLasPiezas = valoresDeLasPiezas(piezas);
  const permitidas = cifrasDelNegocio([...deLasPiezas, ...(ctx.fuentes ?? [])]);
  const conPropuesta = new Set([...permitidas, ...cifrasDelNegocio([p.inversion.precio, p.inversion.contado, p.inversion.plan])]);
  // «Los números» cuentan con lo que dio el negocio, el precio que se propone y el margen que el código calcula con su
  // precio y su costo (`margenDe`): lo demás es una estimación de MaKo y se marca (`numeroDeLaPropuesta`).
  const margen = margenDe(piezas);
  const paraNumeros = new Set([...conPropuesta, ...(margen != null ? [claveCifra(pct(margen))].filter((k): k is string => !!k) : [])]);
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
    numeros: p.numeros.map((n) => numeroDeLaPropuesta(n, paraNumeros).texto),
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

  // La garantía nunca incondicional en high ticket: se le sacan las condiciones y se marca. Sólo en high ticket (en una
  // entrada no es la regla), y sólo si la AFIRMA (22/10/2026, el Sprint de Mauricio, una entrada sin garantía: «no se
  // contempla reembolso ni garantía incondicional» disparaba el aviso y le pedía «[completar] las condiciones»).
  const textoGarantia = `${out.garantia.nombre} ${out.garantia.condiciones} ${out.garantia.siNoCumple}`
    .replace(/\b(?:ni|no|sin|nunca)\b[^.;]{0,40}?\b(?:incondicional|sin (?:hacer )?preguntas|sin condiciones)/gi, '');
  if (nivelDeOferta(piezas)?.nivel !== 'bajo' && /incondicional|sin (?:hacer )?preguntas|sin condiciones/i.test(textoGarantia)) {
    out.garantia.condiciones = `${MARCA_COMPLETAR} lo que el cliente tiene que cumplir para reclamarla (asistir, hacer las tareas)`;
    if (/incondicional/i.test(out.garantia.nombre)) out.garantia.nombre = `${MARCA_COMPLETAR} el nombre de la garantía`;
    avisos.push('La garantía que escribió la IA era incondicional: en high ticket va atada a que el cliente cumpla el método. Completa sus condiciones.');
  }

  // La duración del programa (90 a 180 días) y el precio de lista (desde 1.000 USD) son reglas de ALTO TICKET: en una
  // oferta de entrada no aplican (16/10/2026). Ahí lo que se avisa es lo contrario: que la IA la haya convertido en otra.
  const nivel = nivelDeOferta(piezas);
  const precio = out.inversion.precio.includes(MARCA_COMPLETAR) ? null : precioDe(out.inversion.precio);
  if (nivel?.nivel !== 'bajo') {
    const dias = duracionEnDias(out.formato);
    if (dias != null && (dias < 90 || dias > 180)) {
      avisos.push(`El programa dura ${dias} días según el formato: el marco pide de 90 a 180 días, con un resultado definido.`);
    }
    if (precio && precio.monto < 1_000 && precio.moneda !== 'EUR') {
      avisos.push(`El precio de lista (${fmtMonto(precio)}) está por debajo de 1.000 USD, el piso del high ticket.`);
    }
  } else if (precio) {
    // En la misma moneda, cuántas veces; en otra (la de Leila: 800 MXN al mes → «1,000 USD»), si el propuesto ya es de
    // alto ticket con los cortes de SU moneda. Sin convertir: ver `CORTES_TICKET`.
    const veces = precio.moneda === nivel.precio.moneda ? precio.monto / nivel.precio.monto : null;
    const saltoDeVeces = veces != null && veces >= SALTO_DE_ENTRADA;
    if (saltoDeVeces || nivelDeMonto(precio, RE_POR_MES.test(out.inversion.precio)) === 'alto') {
      const cuanto = saltoDeVeces ? `es ${Math.round(veces!)} veces el de tu oferta de entrada` : 'es de alto ticket, y tu oferta es de entrada';
      avisos.push(`El precio que propuso la IA (${fmtMonto(precio)}) ${cuanto} (${fmtMonto(nivel.precio)}${nivel.recurrente ? ' al mes' : ''}): una entrada no se vuelve high ticket. Si quieres un alto ticket, es el escalón siguiente.`);
    }
  }

  // Quién hace el trabajo: un curso o un acompañamiento no prometen que el negocio lo implementa por el cliente.
  const promete = prometeHacerloPorElCliente(out, piezas);
  if (promete) avisos.push(promete);
  // Las palabras: la jerga de consultor que el dueño no usó no va en lo que lee su cliente.
  const jerga = jergaAjena(out, [...deLasPiezas, ...(ctx.fuentes ?? [])]);
  if (jerga.length) avisos.push(`Usa palabras que tu cliente quizás no usa (${jerga.map((j) => `«${j}»`).join(', ')}): dilo como lo diría él.`);

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
  for (const n of p.numeros) {
    if (n.includes(MARCA_ESTIMADO)) seguros.push({ seccion: 'Números', que: n.replace(MARCA_ESTIMADO, '').trim() });
  }

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
export function entradaCompletar(etiqueta: string, valor: string): string | null {
  const i = valor.indexOf(MARCA_COMPLETAR);
  if (i < 0) return null;
  // Si el campo tiene más de una marca («[completar] de [completar] clientes»), las de después se
  // leen como «…»: la entrada dice qué falta, y repetir la marca no agrega nada.
  const detalle = valor.slice(i + MARCA_COMPLETAR.length).replace(/^[\s:.—-]+/, '').split(MARCA_COMPLETAR).join('…').trim();
  // Lo de después de la marca es «qué hay que poner» cuando empieza con palabras. Si es un resto («/10)», de una cifra
  // marcada adentro de una frase), va el campo entero con «…» donde falta (22/10/2026, prueba de los chats).
  if (detalle && !/^[a-záéíóúñ¿«"(]/i.test(detalle)) return `${etiqueta}: ${recortar(valor.split(MARCA_COMPLETAR).join('…').replace(/\s+/g, ' ').trim(), 140)}`;
  return detalle ? `${etiqueta}: ${recortar(detalle, 140)}` : etiqueta;
}

/** El nombre de un número de «Los números»: lo que dice antes de la marca (sin «:» ni «—» al final), o «Número N». */
export function rotuloDeNumero(n: string, i: number): string {
  const j = (n ?? '').indexOf(MARCA_COMPLETAR);
  const antes = (j > 0 ? n.slice(0, j) : '').replace(/[\s:—–-]+$/, '').trim();
  return antes.length >= 2 && antes.length <= 60 ? antes : `Número ${i + 1}`;
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
    // El rótulo de un número es lo que dice ANTES de la marca («Ventas objetivo por mes: [completar] …», «LTV:CAC
    // [completar]»): por la posición salía «Número 2: ventas para validar» y «Número 5» solo (segunda prueba, 22/10/2026).
    ...p.numeros.map((n, i): [string, string] => [rotuloDeNumero(n, i), n]),
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
export type MensajeParaPrompt = Pick<OfferMensaje, 'de' | 'texto' | 'adjuntos' | 'linksSinLeer' | 'leyendo'> & { audio?: unknown };

export function conversacionParaPrompt(mensajes: MensajeParaPrompt[], max = MAX_MENSAJES_PROMPT): string {
  // «Estoy leyendo tus documentos» es de la pantalla, no de la conversación: al modelo no le dice nada (O9, 22/10/2026).
  const visibles = mensajes.filter((m) => !m.leyendo);
  const ult = visibles.slice(-max);
  const lineas = ult.map((m) => {
    // «por audio»: el texto es una transcripción, y el modelo tiene que poder dudar de una palabra rara.
    const quien = m.de === 'yo' ? (m.audio ? 'DUEÑO (por audio)' : 'DUEÑO') : 'MaKo';
    const adj = m.adjuntos?.length ? ` (adjuntó: ${m.adjuntos.map((a) => a.nombre).join(', ')})` : '';
    // Un link que no abrió, dicho (20/10/2026, Florencia): sin esto MaKo dijo «vi tu Instagram» infiriéndolo del nombre.
    const sinLeer = m.de === 'yo' && m.linksSinLeer?.length ? ` (NO se pudo abrir: ${m.linksSinLeer.join(', ')}; no lo viste)` : '';
    const cuerpo = (m.texto ?? '').trim() || (m.adjuntos?.length ? '(mandó documentos sin texto)' : '(vacío)');
    // Lo del DUEÑO va entero hasta el tope que acepta la ruta (12.000, TOPE_MENSAJE en
    // app/api/offer/route.ts): recortarlo a 2.000 guardaba el mensaje y nunca se lo leía al modelo,
    // que preguntaba por el precio que estaba en el tramo cortado. Lo de MaKo es corto por construcción.
    return `${quien}${adj}${sinLeer}: ${recortar(cuerpo, m.de === 'yo' ? 12_000 : 2_000)}`;
  });
  if (visibles.length > ult.length) lineas.unshift(`(Se omiten los ${visibles.length - ult.length} mensajes más viejos.)`);
  return lineas.join('\n');
}

export type DocParaPrompt = { id: string; nombre: string; texto: string; at: string; lectura?: string; partes?: number };

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
export function documentosParaPrompt(todos: DocParaPrompt[], nuevos: string[] = [], tope = TOPE_DOCS_PROMPT): string {
  if (!todos.length) return '';
  // Un documento largo viaja como su lectura por partes (#865): la del documento ENTERO, no su principio.
  const docs = todos.map((d) => ({ ...d, texto: cuerpoDelDoc(d) }));
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
      const porPartes = d.lectura?.trim() && d.partes ? ` (leído entero, en ${d.partes} partes)` : '';
      return `— «${d.nombre}»${esNuevo.has(d.id) ? ' (recién subido)' : ''}${porPartes} —\n${cuerpo}`;
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
  // El nivel va pegado a lo que se sabe: así llega a los tres prompts, también a los editados (`bloqueNivel`).
  const nivel = bloqueNivel(nivelDeOferta(piezas));
  return { sabidas: [sabidas || '(ninguna todavía)', nivel].filter(Boolean).join('\n\n'), faltan: faltan || '(ninguna: ya están todas)' };
}

/** Las preguntas de la guía, en orden, para el system del turno. */
export const guiaParaPrompt = (): string =>
  PREGUNTAS_GUIA.map((q, i) => `${i + 1}. [${q.pieza}] ${q.pregunta}`).join('\n');

/**
 * La conversación del ONBOARDING (17/10/2026, `PIEZAS_DEL_ARRANQUE`): sólo lo que vende. La guía son las
 * preguntas de esas piezas, en el orden de la de Offer, y lo que falta son sólo ellas: con la lista entera
 * (`piezasParaPrompt`), el modelo se pondría a preguntar por la garantía o el costo, que son del análisis.
 */
// ── El corte del onboarding (20/10/2026, Florencia, ws21) ─────────────────────────────────────────────────────────
/**
 * Que la conversación del ONBOARDING terminó lo decide el CÓDIGO, nunca el modelo. Florencia (18/10): con las tres piezas
 * anotadas a las 22:43:34, MaKo siguió 6 preguntas y 10 minutos más, y antes le preguntó el precio 4 veces; el «listo» del
 * modelo se parseaba y nadie lo leía. Con `faltanDelArranque` vacío, el mensaje es éste, diga lo que diga el modelo.
 */
export const CIERRE_DEL_ARRANQUE = '¡Gracias!';
export function mensajeDeCierreDelArranque(id: string, at: string): MensajeSinAudio {
  return { id, de: 'mako', texto: CIERRE_DEL_ARRANQUE, at };
}

/** Cuántas veces se pregunta una pieza del onboarding antes de anotarla «sin dato» y seguir. */
export const REPREGUNTAS_DEL_ARRANQUE = 2;

/**
 * Cómo se reconoce que MaKo pregunta por cada pieza del onboarding (sin tildes). El del precio es estricto a propósito:
 * «¿Cuántas personas ya pagaron?» no pregunta el precio (revisión del Cerebro, 20/10).
 */
const PREGUNTA_POR: Partial<Record<PiezaKey, RegExp>> = {
  entregables: /que (?:vend|ofrec|haces|incluye|recibe)|vendes|ofreces|servicio|producto|programa|entrega|te dedicas/,
  cliente: /client|para quien|a quien|publico|perfil|se dedican|ideal/,
  precio: /cobr|precio|cuesta|tarifa|cuotas?|cuanto (?:te )?(?:sale|vale|pag)|como (?:te )?pag|forma de pago|inversion/,
};

/**
 * El tope de repreguntas del onboarding. La pieza que se está preguntando es la primera que falta en el orden de la guía
 * (el prompt pide ese orden: `guiaDelArranque`). Si desde la última pieza anotada MaKo ya la preguntó
 * `REPREGUNTAS_DEL_ARRANQUE` veces y el dueño contestó cada una sin que se anotara nada (un «depende», un «varía»), esa
 * pieza queda «sin dato:» y no se vuelve a preguntar. Sin el texto del dueño, a propósito: lo que dijo queda igual en la
 * conversación (la tab Offer lo lee).
 * ⚠️ Cuenta sólo las preguntas POR ESA PIEZA (`PREGUNTA_POR`) y nunca el pedido de documento (revisión del Cerebro, 20/10):
 *    con el pedido contado, «qué vendes» quedaba «sin dato» después de una sola pregunta de verdad; y dos preguntas por otra
 *    cosa dejaban el precio «sin dato» sin que nadie lo hubiera preguntado.
 */
export function conTopeDelArranque(piezas: PiezasSabidas, mensajes: ReadonlyArray<{ de: string; texto: string; at?: string }>, at: string): PiezasSabidas {
  const falta = PREGUNTAS_GUIA.find((q) => PIEZAS_DEL_ARRANQUE.includes(q.pieza) && !piezaAnotada(piezas, q.pieza))?.pieza;
  if (!falta) return piezas;
  const porLaPieza = PREGUNTA_POR[falta];
  const desde = Math.max(0, ...PIEZAS_DEL_ARRANQUE.map((k) => Date.parse(piezas[k]?.at ?? '') || 0));
  let preguntas = 0;
  let abierta = false;
  for (const m of mensajes) {
    if ((Date.parse(m.at ?? '') || 0) < desde) continue;
    if (m.de === 'mako') {
      const t = normalizar(m.texto);
      abierta = m.texto.includes('?') && !m.texto.includes(PEDIDO_DOCUMENTO) && !!porLaPieza?.test(t);
    } else if (m.de === 'yo' && abierta) { preguntas += 1; abierta = false; }
  }
  return preguntas >= REPREGUNTAS_DEL_ARRANQUE ? mergePiezas(piezas, { [falta]: 'sin dato:' }, 'chat', at) : piezas;
}

/**
 * Las respuestas rápidas del onboarding (20/10/2026, Florencia, ws21). Una opción tocada se anota como si la hubiera
 * dicho el dueño: los rangos de precio que inventó MaKo («Entre $100 y $300 USD») terminaron siendo su precio, y la ÚNICA
 * opción de un turno («Un plan de trabajo con hitos…») terminó siendo la 1ª sección de su PDF. Se va la que trae un
 * número que el dueño no dijo (ni en sus mensajes ni en sus documentos), y con menos de dos no se ofrece ninguna: una
 * sola opción no es elegir, es contestar por él.
 */
export function opcionesDelArranque(opciones: readonly string[] | undefined, dichoPorElDueno: readonly string[]): string[] {
  const suyos = new Set(dichoPorElDueno.flatMap(numerosDe));
  const sirven = (opciones ?? []).filter((o) => numerosDe(o).every((n) => suyos.has(n)));
  return sirven.length >= 2 ? sirven : [];
}

/** El mensaje de MaKo del onboarding con sus respuestas rápidas filtradas (`opcionesDelArranque`). */
export function conOpcionesDelArranque(m: MensajeSinAudio, dichoPorElDueno: readonly string[]): MensajeSinAudio {
  if (!m.opciones?.length || m.pregunta) return m;
  const { opciones: propuestas, varias, ...resto } = m;
  const opciones = opcionesDelArranque(propuestas, dichoPorElDueno);
  return { ...resto, ...(opciones.length ? { opciones } : {}), ...(varias && opciones.length > 1 ? { varias: true as const } : {}) };
}

export const guiaDelArranque = (): string =>
  PREGUNTAS_GUIA.filter((q) => PIEZAS_DEL_ARRANQUE.includes(q.pieza)).map((q, i) => `${i + 1}. [${q.pieza}] ${q.pregunta}`).join('\n');

export function faltanDelArranqueParaPrompt(piezas: PiezasSabidas): string {
  const faltan = PIEZAS
    .filter((p) => PIEZAS_DEL_ARRANQUE.includes(p.key) && !piezaAnotada(piezas, p.key))
    .map((p) => `- ${p.key}: ${p.que}`)
    .join('\n');
  return faltan || '(ninguna: ya sabes lo que vende)';
}

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
