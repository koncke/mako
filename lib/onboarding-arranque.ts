// =============================================================================
// onboarding-arranque — el chat de arranque: el onboarding de MaKo es una conversación
// =============================================================================
// Pedido de Martín (16/10/2026): «Quiero que elimines todo lo que hay hoy en onboarding tal como está y
// que lo reemplaces por el chat de "Offer"… este onboarding no tiene que ser solo de "offer" (aunque será
// la gran parte), sino que también debe preguntar otras cosas, como el nombre, luego de analizar su offer,
// preguntar su funnel para que lo elija (y así crear su primer CRM)… NO quiero que sea un onboarding
// eterno, es más, mientras más ágil y rápido mejor.» El wizard de antes quedó escrito, pantalla por
// pantalla, en docs/onboarding-pasos-anteriores.md.
//
// Acá viven las reglas PURAS (sin `server-only`, con test que las ejecuta): en qué ETAPA está la
// conversación, qué DICE MaKo en cada una y con qué OPCIONES, qué CRM recomienda, cómo se lee cada
// respuesta y qué se escribe en el perfil del negocio al terminar. La ruta (/api/onboarding/arranque) sólo
// lee los hechos, aplica lo que esto decide y persiste; la pantalla (app/onboarding/ChatArranque.tsx) sólo
// dibuja.
//
// DOS MODOS, porque las capas no ven lo mismo (lib/capas.ts):
//   · 'oferta' (Completo, Agencia): nombre → negocio → objetivo → LO QUE VENDE (la conversación de Offer,
//     reducida) → el PDF con lo que vende → el diagnóstico de fase (con sus opciones) → el CRM que elige → el
//     teléfono (o «ahora no») → cierre.
//   · 'plan' (Project Manager: no ve Offer ni el CRM): nombre → negocio → objetivo → a qué se dedica → el
//     diagnóstico de fase (las preguntas originales, con sus opciones) → cierre con el plan de arranque.
//
// ⚠️ EL ANÁLISIS DE LA OFERTA NO VA (Martín, 16/10/2026 a la tarde): «Sería bueno que la funcionalidad de
// "OFFER" no esté en el onboarding, sino que ya luego del onboarding el usuario pueda ir a analizar su oferta
// allí... Pero simular "Offer" en el onboarding simplemente para organizar en un PDF lo que vende el usuario».
// La conversación es la de Offer en su versión del onboarding (`OFFER_ARRANQUE_SYSTEM_TEMPLATE`,
// lib/offer-ia.ts): pregunta sólo `PIEZAS_DEL_ARRANQUE` y no ofrece «Armar mi oferta». El diagnóstico de la
// oferta y la oferta mejorada se hacen después, en la tab Offer, sobre la MISMA conversación. El diagnóstico
// de FASE sí queda (es el Norte de MaKo, no el análisis de la oferta), y lo pregunta el arranque con opciones.
// ⚠️ LO QUE NO SE PREGUNTA, y por qué: la zona horaria la toma sola el navegador del admin
// (ZonaDelNegocio en el layout); Meta se conecta después desde su tab (se posterga y queda el
// recordatorio en /general); la IA propia ya no hace falta para arrancar. Todo lo demás del perfil sale de
// la conversación de la oferta.
// ⚠️ LA VOZ: lo que lee el cliente va de «tú», neutro (AGENTS.md: la voz rioplatense es la de MaKo con
// Martín, no la del texto del cliente). El guard de voseo barre este archivo.
// =============================================================================

import { CANALES, PREGUNTAS, VOLUMEN_POR_CANAL, type CanalId } from './fase-diagnostico';
import { TIPOS_CRM, type TipoCrm, type TipoCrmId } from './pipeline';
import type { PiezasSabidas, PropuestaOferta } from './offer-marco';
import { RUTA_AUTOMATIONS } from './ruta-automations';

export type ModoArranque = 'oferta' | 'plan';

/** Lo que el chat guardó de la conversación (app_settings 'onboarding.arranque', un JSON por workspace). */
export type EstadoArranque = {
  nombre?: string;
  negocio?: string;
  /** El negocio que nombró junto con su nombre («Martín, de Acme»): se OFRECE en la pregunta del negocio, nunca
   *  se da por contestada (en «Martín de Córdoba» lo de después del «de» es un lugar). */
  negocioSugerido?: string;
  /** «¿Cómo llegaste a MaKo?»: una opción de `ORIGENES` o lo que escribió (17/10/2026). */
  origen?: string;
  /** «¿Qué quieres que MaKo resuelva primero?» (modo 'oferta'): decide a qué pestaña entra al terminar. */
  interes?: InteresId;
  objetivo?: string;
  /** Sólo en modo 'plan': en 'oferta' sale de la conversación de la oferta. */
  queHace?: string;
  /** La respuesta de cada pregunta del diagnóstico que hizo el ARRANQUE (índice de la opción ORIGINAL, -1 =
   *  sin contestar): todas en modo 'plan'; en 'oferta', sólo las que la conversación de la oferta no llegó a hacer. */
  faseResp?: number[];
  /** Dónde cierra la venta, si lo preguntó el arranque (la pregunta de canal va antes de la de volumen). */
  canal?: CanalId;
  /** El tipo de CRM que eligió (modo 'oferta'). */
  crmTipo?: TipoCrmId;
  /** Mostrar todos los tipos de CRM, no sólo los de su canal. */
  crmVerTodos?: boolean;
  /** El teléfono de los avisos: 'codigo' = se mandó el código y falta cargarlo. */
  telefono?: 'codigo' | 'verificado' | 'postergado';
  telefonoNumero?: string;
  /** La conversación de Offer donde vive la oferta (modo 'oferta'). */
  sesionId?: number;
  /** Ya vio la animación del principio: no se repite al recargar. */
  introVista?: boolean;
};

/** Lo que el server MIDE (nunca se guarda: estado vivo, no recordado). */
export type HechosArranque = {
  modo: ModoArranque;
  /** usuarios.nombre de quien entra (de Google o de quien lo invitó), para ofrecerlo como opción. */
  nombreCuenta: string;
  /** workspaces.nombre (lo puso el alta), para ofrecerlo como opción. */
  nombreWorkspace: string;
  /** El negocio ya tiene diagnóstico de fase guardado. */
  faseGuardada: boolean;
  /** El canal del diagnóstico guardado (dónde cierra la venta), o null. */
  canalNegocio: CanalId | null;
  /** La conversación ya sabe lo que vende (`PIEZAS_DEL_ARRANQUE`, lib/offer-marco.ts): está su PDF. */
  loQueVende: boolean;
  /** Lo que ya contestó del diagnóstico en la conversación de la oferta (id de pregunta → opción ORIGINAL, y el
   *  canal si lo contestó ahí), o null sin conversación. El arranque no lo vuelve a preguntar. */
  faseOffer?: { respuestas: Record<string, number>; canal: CanalId | null } | null;
  /** La capa ve el CRM: el chat siembra su funnel principal. */
  conCrm: boolean;
  /** La capa tiene el paso del teléfono ('tabs'). */
  conTelefono: boolean;
  /** El onboarding ya está cerrado. */
  terminado: boolean;
};

export type EtapaArranque =
  | 'nombre' | 'negocio' | 'origen' | 'interes' | 'objetivo' | 'que_hace' | 'fase' | 'oferta' | 'crm'
  | 'telefono' | 'codigo' | 'cierre' | 'listo';

/** `pdf`: el PDF con lo que vende (la ruta lo arma con las piezas de la conversación). */
export type TarjetaArranque = 'crm' | 'telefono' | 'pdf' | 'listo';

/** Un mensaje del chat de arranque (los de la conversación de la oferta son los de Offer, aparte). */
export type MensajeArranque = {
  id: string;
  de: 'mako' | 'yo';
  texto: string;
  opciones?: string[];
  tarjeta?: TarjetaArranque;
};

// ── Textos ──────────────────────────────────────────────────────────────────
export const OBJETIVOS_SUGERIDOS = ['Conseguir mis primeros clientes', 'Vender más cada mes', 'Escalar sin depender de mí'] as const;
export const AHORA_NO = 'Ahora no';
export const CAMBIAR_NUMERO = 'Cambiar número';
export const VER_OTROS_TIPOS = 'Ver otros tipos';
const PREGUNTA_CANAL = '¿Dónde cierras la venta?';

const TOPE_RESPUESTA = 300;

/**
 * LAS DOS PREGUNTAS NUEVAS (17/10/2026). Martín: «investiga las preguntas que nos hacen falta: me imagino "¿Cómo nos
 * conociste?", "¿Qué funcionalidad de estas te interesa más?"». Lo que se midió antes de sumarlas: el abandono de una
 * encuesta de bienvenida sube con cada pregunta (más rápido en las primeras), y una pregunta que no CAMBIA nada visible
 * se saca. Por eso son de un toque, y cada una decide algo: el origen dice de dónde vienen los clientes (lo mira el
 * super admin para la pauta) y el interés decide a qué pestaña entra al terminar. El detalle, en
 * docs/hallazgos-onboarding.md.
 */
/**
 * El primer mensaje: explica para qué son las preguntas y cuánto tardan ANTES de preguntar (18/10/2026, Martín: «empieza
 * a preguntar de la nada»).
 */
export const SALUDO_ARRANQUE = '¡Hola! Soy MaKo. Para dejar tu cuenta lista necesito conocer tu negocio: son unas preguntas rápidas, menos de 5 minutos. Para empezar, ¿cómo te llamas?';

export const ORIGENES = ['Instagram', 'YouTube', 'TikTok', 'Un anuncio', 'Me lo recomendaron', 'Google', 'Otro'] as const;

export type InteresId = 'anuncios' | 'ventas' | 'whatsapp' | 'organizar';
export const INTERESES: ReadonlyArray<{ id: InteresId; label: string; ruta: string }> = [
  { id: 'anuncios', label: 'Conseguir clientes con anuncios', ruta: '/ads-writer' },
  { id: 'ventas', label: 'Ordenar mis ventas y seguimientos', ruta: '/crm' },
  { id: 'whatsapp', label: 'Que WhatsApp responda solo', ruta: RUTA_AUTOMATIONS },
  { id: 'organizar', label: 'Organizar mi plan y mi equipo', ruta: '/plan' },
];

/** El setting donde el cierre deja cómo llegó y qué quiere resolver primero. Lo lee `ver_estado_onboarding`. */
export const CLAVE_ENCUESTA = 'onboarding.encuesta';

/** Cómo llegó un negocio y qué quería resolver primero, como lo lee el super admin (`llegadaDe`). */
export type LlegadaCliente = { origen: string | null; interes: string | null; at: string | null };

/**
 * La encuesta guardada (`CLAVE_ENCUESTA`), leída para la tabla de clientes del super admin (17/10/2026: «la respuesta se
 * guarda pero se lee cliente por cliente», docs/relevo/onboarding.md). `interes` sale con el RÓTULO de la opción, no con
 * su id. null si no hay o no se entiende.
 */
export function llegadaDe(raw: string | null | undefined): LlegadaCliente | null {
  if (!raw) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 80) : null);
  const origen = texto(o.origen);
  const interesId = texto(o.interes);
  const interes = interesId ? INTERESES.find((i) => i.id === interesId)?.label ?? interesId : null;
  const at = typeof o.at === 'string' && Number.isFinite(Date.parse(o.at)) ? o.at : null;
  return origen || interes ? { origen, interes, at } : null;
}

/** A dónde entra al terminar: la pestaña de lo que quiere resolver primero, o /general. */
/**
 * A dónde entra al terminar: el Ops Center (/second-brain), siempre (18/10/2026, Martín: «la primera tab que ve el cliente es
 * Ops Center»). Lo que dijo que quiere resolver primero queda en la encuesta y en `rutaDeEntrada`, pero ya no decide la entrada.
 */
export const RUTA_AL_TERMINAR = '/second-brain';

export function rutaDeEntrada(interes: InteresId | undefined): string {
  return INTERESES.find((i) => i.id === interes)?.ruta ?? '/general';
}

/** El interés de una respuesta: la opción tal cual, o lo escrito por sus palabras («los anuncios», «el WhatsApp»). */
export function interesDe(texto: string): InteresId | null {
  const t = (texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  if (!t) return null;
  const exacto = INTERESES.find((i) => i.label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() === t);
  if (exacto) return exacto.id;
  if (/anuncio|publicidad|\bads\b|meta|campan|conseguir/.test(t)) return 'anuncios';
  if (/whats|wsp|wpp|mensaje|responda|chat/.test(t)) return 'whatsapp';
  if (/venta|seguimiento|\bcrm\b|lead|cliente/.test(t)) return 'ventas';
  if (/plan|equipo|tarea|organiz/.test(t)) return 'organizar';
  return null;
}

/** El primer nombre, para saludar y ofrecerlo: «Martín Koncke» → «Martín». */
export function primerNombre(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] ?? '';
}

const SALUDO = /^(?:hola+|holi|buenas(?:\s+(?:tardes|noches))?|buen(?:os)?\s+d[ií]as?|hey|qu[eé]\s+tal|saludos)\b[\s,!.¡]*/i;
const PRESENTA = /^(?:(?:yo\s+)?soy|me\s+llamo|mi\s+nombre\s+es|me\s+dicen|puedes\s+llamarme|ll[aá]mame|dime|aqu[ií]|ac[aá])\b[\s,:]*/i;
const PALABRAS_NO_NOMBRE = /^(?:el|la|los|las|un|una|de|del|y|que|con|en|mi|tu|su|por|para|due[ñn][oa]|y\s+tengo)$/i;

/** Mayúscula la primera letra de cada palabra que vino toda en minúscula («martín» → «Martín»). */
const conMayuscula = (s: string) => s.replace(/(^|\s)(\p{Ll})(\p{Ll}*)/gu, (_m, a: string, b: string, c: string) => `${a}${b.toUpperCase()}${c}`);

/**
 * EL NOMBRE, ENTENDIDO (17/10/2026). Martín: «le dije "Soy Martin" y me respondió "Un gusto, Soy. ¿Cómo se llama tu
 * negocio?", eso es básico». Se saca el saludo y la presentación («hola, soy», «me llamo», «mi nombre es»), se corta en
 * la primera coma o en lo que ya no es un nombre («Martín, el dueño de Acme»), y se queda con hasta tres palabras. Si
 * nombró su negocio («Martín de Acme», «soy Martín, de Acme», «tengo una agencia que se llama Acme»), vuelve como
 * SUGERENCIA para la pregunta siguiente. Sin nombre entendible («hola»), vuelve vacío y se vuelve a preguntar.
 */
export function extraerNombre(texto: string): { nombre: string; negocio: string | null } {
  let t = limpiarRespuesta(texto).replace(/[!¡¿?]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(SALUDO, '').trim();
  t = t.replace(PRESENTA, '').trim();
  // «me dicen el Tano»: el artículo de un apodo no es parte del corte.
  t = t.replace(/^(?:el|la)\s+(?=\p{Lu})/u, '');
  // El negocio, si lo dijo: «… se llama Acme» / «… de Acme» / «… dueño de Acme».
  let negocio: string | null = null;
  const seLlama = /(?:se\s+llama|llamad[oa]|mi\s+(?:negocio|empresa|marca|agencia)\s+es)\s+(.+)$/i.exec(t);
  if (seLlama) negocio = seLlama[1];
  const partes = t.split(/[,.;:]| y | - /);
  const cabeza = (partes[0] ?? '').trim();
  const palabras = cabeza.split(/\s+/).filter(Boolean);
  const nombre: string[] = [];
  for (let i = 0; i < palabras.length && nombre.length < 3; i++) {
    const p = palabras[i];
    if (PALABRAS_NO_NOMBRE.test(p) || /\d/.test(p)) {
      // «Martín de Acme»: lo que sigue al «de» es una sugerencia de negocio.
      if (/^(?:de|del)$/i.test(p) && !negocio && i + 1 < palabras.length) negocio = palabras.slice(i + 1).join(' ');
      break;
    }
    nombre.push(p);
  }
  if (!negocio) {
    const deAlgo = /\b(?:de|del)\s+(?:la\s+empresa\s+|la\s+marca\s+)?(.+)$/i.exec(partes.slice(1).join(' ').trim());
    if (deAlgo) negocio = deAlgo[1];
  }
  const limpio = (s: string | null) => (s ?? '').replace(/^(?:la|el)\s+/i, '').replace(/[«»"']/g, '').trim().slice(0, 80);
  return { nombre: conMayuscula(nombre.join(' ')).slice(0, 60), negocio: limpio(negocio) || null };
}

/** El nombre del negocio, sin la frase alrededor: «Se llama Acme», «Mi negocio es Acme», «Es Acme» → «Acme». */
export function extraerNegocio(texto: string): string {
  let t = limpiarRespuesta(texto).replace(/[!¡¿?]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:mi\s+(?:negocio|empresa|marca|agencia|emprendimiento)\s+)?(?:se\s+llama|es|son|somos)\s+/i, '');
  t = t.replace(/^(?:la\s+empresa|la\s+marca|el\s+negocio)\s+(?:se\s+llama|es)\s+/i, '');
  return t.replace(/[«»"]/g, '').replace(/[.]+$/, '').trim();
}

/**
 * ¿El nombre del workspace parece el de un NEGOCIO? El alta pública lo arma con el nombre de quien pagó o
 * con su email (lib/cobros.ts), así que ofrecerlo tal cual como «tu negocio» sería afirmar algo que nadie
 * dijo. Un email o el mismo nombre de la persona no se ofrecen.
 */
export function pareceNegocio(nombreWorkspace: string, nombreCuenta: string): boolean {
  const w = (nombreWorkspace || '').trim();
  if (!w || w.includes('@')) return false;
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm(w) !== norm(nombreCuenta);
}

/** Una respuesta de texto libre: recortada y con tope. Vacía = no contestó. */
export function limpiarRespuesta(t: string): string {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, TOPE_RESPUESTA);
}

// ── El CRM que se propone ───────────────────────────────────────────────────
/** El tipo recomendado para cada canal (el primero de su canal en TIPOS_CRM, que ya viene ordenado así). */
export function tipoRecomendado(canal: CanalId | null): TipoCrm {
  const porCanal = canal ? TIPOS_CRM.filter((t) => t.canal === canal) : [];
  return porCanal[0] ?? TIPOS_CRM.find((t) => t.id === 'llamada') ?? TIPOS_CRM[0];
}

/**
 * Los tipos que se ofrecen: el recomendado primero y los demás de su canal; con «ver todos», los doce. El
 * marco de Offer es de alto ticket vendido por llamada (lib/offer-autores.ts), así que sin canal manda
 * «Llamada de venta».
 */
export function tiposOfrecidos(canal: CanalId | null, verTodos: boolean): { tipos: TipoCrm[]; hayMas: boolean } {
  const rec = tipoRecomendado(canal);
  const base = verTodos ? [...TIPOS_CRM] : TIPOS_CRM.filter((t) => t.canal === rec.canal);
  const tipos = [rec, ...base.filter((t) => t.id !== rec.id)];
  return { tipos, hayMas: !verTodos && tipos.length < TIPOS_CRM.length };
}

// ── El diagnóstico en modo 'plan' ───────────────────────────────────────────
export type PreguntaFase = { tipo: 'canal' } | { tipo: 'pregunta'; idx: number };

/** La próxima pregunta del diagnóstico sin contestar; la de canal va justo antes de la de volumen. */
export function siguientePreguntaFase(e: EstadoArranque): PreguntaFase | null {
  const resp = e.faseResp ?? [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    if (PREGUNTAS[i].id === 'volumen' && !e.canal) return { tipo: 'canal' };
    if (!(Number.isInteger(resp[i]) && resp[i] >= 0)) return { tipo: 'pregunta', idx: i };
  }
  return null;
}

function textoPreguntaFase(p: PreguntaFase, canal: CanalId | undefined): { texto: string; opciones: string[] } {
  if (p.tipo === 'canal') return { texto: PREGUNTA_CANAL, opciones: CANALES.map((c) => c.label) };
  const q = PREGUNTAS[p.idx];
  if (q.id === 'volumen') {
    const v = VOLUMEN_POR_CANAL[canal ?? 'llamadas'];
    return { texto: v.texto, opciones: v.opciones };
  }
  return { texto: q.texto, opciones: q.opciones };
}

/** Las respuestas del diagnóstico completas (para guardarlo), o null si falta alguna. */
export function faseCompleta(e: EstadoArranque): number[] | null {
  if (siguientePreguntaFase(e) !== null) return null;
  return PREGUNTAS.map((_, i) => (e.faseResp ?? [])[i]);
}

const contestada = (n: number | undefined): n is number => Number.isInteger(n) && (n as number) >= 0;

/**
 * El diagnóstico como lo ve el arranque en modo 'oferta': lo que contestó ACÁ manda y, si no, lo que ya
 * contestó en la conversación de la oferta. Así las preguntas que Offer ya hizo no se repiten.
 */
export function conFaseDeOffer(e: EstadoArranque, h: Pick<HechosArranque, 'faseOffer'>): EstadoArranque {
  const o = h.faseOffer;
  if (!o) return e;
  const faseResp = PREGUNTAS.map((q, i) => (contestada(e.faseResp?.[i]) ? e.faseResp![i] : (o.respuestas[q.id] ?? -1)));
  const canal = e.canal ?? o.canal ?? undefined;
  return { ...e, faseResp, ...(canal ? { canal } : {}) };
}

// ── La etapa ────────────────────────────────────────────────────────────────
/**
 * En qué etapa está la conversación. Sale de lo guardado Y de lo medido: así, si la persona cerró la
 * pestaña a la mitad, al volver sigue exactamente donde quedó, sin una marca de «paso actual» que haya que
 * acordarse de mover.
 */
export function etapaDeArranque(e: EstadoArranque, h: HechosArranque): EtapaArranque {
  if (h.terminado) return 'listo';
  if (!e.nombre) return 'nombre';
  if (!e.negocio) return 'negocio';
  // Sin el objetivo a 90 días (18/10/2026, Martín: «eliminar "Y en los próximos 90 días, ¿qué quieres lograr?"»): del
  // negocio se pasa directo a lo que vende. Una conversación de antes que lo contestó lo guarda (va al brief), pero ya
  // no se dibuja ni se pregunta. Y «¿Cómo llegaste?» y «¿Qué resolver primero?» van AL FINAL, antes del teléfono.
  if (h.modo === 'plan') {
    if (!e.queHace) return 'que_hace';
    if (!h.faseGuardada) return 'fase';
  } else {
    // Primero lo que vende (la conversación de Offer, reducida) y después el diagnóstico de fase, que lo
    // pregunta el arranque con sus opciones: la conversación del onboarding ya no lo hace (17/10/2026). Lo que
    // la persona haya contestado en una conversación de antes (`faseOffer`) no se repite.
    if (!h.loQueVende) return 'oferta';
    if (!h.faseGuardada) return 'fase';
    if (h.conCrm && !e.crmTipo) return 'crm';
  }
  if (!e.origen) return 'origen';
  if (h.modo === 'oferta' && !e.interes) return 'interes';
  if (h.conTelefono && e.telefono !== 'verificado' && e.telefono !== 'postergado') {
    return e.telefono === 'codigo' ? 'codigo' : 'telefono';
  }
  return 'cierre';
}

// ── Lo que dice MaKo ────────────────────────────────────────────────────────
/**
 * Los mensajes del arranque, partidos en dos: los de ANTES de la conversación de la oferta y los de
 * DESPUÉS. En modo 'plan' no hay oferta, así que todo va en `antes`. Sólo se dibuja hasta la etapa actual:
 * su pregunta es el último mensaje, con sus opciones.
 */
export function mensajesDeArranque(e: EstadoArranque, h: HechosArranque): { antes: MensajeArranque[]; despues: MensajeArranque[] } {
  const etapa = etapaDeArranque(e, h);
  const antes: MensajeArranque[] = [];
  const despues: MensajeArranque[] = [];
  const nombre = e.nombre ? primerNombre(e.nombre) : '';

  const preguntar = (lista: MensajeArranque[], id: string, texto: string, respuesta: string | undefined, opciones?: string[], tarjeta?: TarjetaArranque) => {
    lista.push({ id: `arr-${id}`, de: 'mako', texto, ...(respuesta === undefined && opciones?.length ? { opciones } : {}), ...(tarjeta ? { tarjeta } : {}) });
    if (respuesta !== undefined) lista.push({ id: `arr-${id}-r`, de: 'yo', texto: respuesta });
  };

  // 1. Quién es. EXPLICA ANTES DE PREGUNTAR (18/10/2026, Martín: «empieza a preguntar de la nada… debería decir algo como
  // "necesito que me cuentes de tu negocio para poder configurar tu cuenta... no tardaremos más de 5 minutos"»).
  // SIN respuestas rápidas en el nombre ni en el negocio (18/10/2026, 14:00, Martín): ofrecían lo que quedaba de otra
  // prueba («Ayelen» del perfil, «Consultesis» del nombre del workspace). Se escriben. tests/onboarding-preguntas.test.ts.
  preguntar(antes, 'nombre', SALUDO_ARRANQUE, e.nombre);
  if (etapa === 'nombre') return { antes, despues };
  preguntar(antes, 'negocio', `Un gusto, ${nombre}. ¿Cómo se llama tu negocio?`, e.negocio);
  if (etapa === 'negocio') return { antes, despues };

  // Las dos del 17/10 (`ORIGENES`, `INTERESES`), AL FINAL desde el 18/10 (Martín): antes del teléfono y del cierre.
  const finales = (lista: MensajeArranque[]): boolean => {
    // Sin «Antes de terminar» ni «Última cosa» (18/10/2026, Martín: «no me puede estar diciendo "Antes de terminar"...
    // cada rato»): cada pregunta va directa y el cierre se dice una vez, al final (tests/onboarding-sin-anuncios.test.ts).
    preguntar(lista, 'origen', `¿Cómo llegaste a MaKo, ${nombre}?`, e.origen, [...ORIGENES]);
    if (etapa === 'origen') return true;
    if (h.modo === 'oferta') {
      preguntar(lista, 'interes', '¿Qué te gustaría que MaKo resuelva primero?', INTERESES.find((i) => i.id === e.interes)?.label, INTERESES.map((i) => i.label));
      if (etapa === 'interes') return true;
    }
    return false;
  };

  // 2a. Modo 'plan': a qué se dedica y el diagnóstico, con las preguntas originales.
  if (h.modo === 'plan') {
    preguntar(antes, 'que-hace', '¿A qué se dedica tu negocio?', e.queHace);
    if (etapa === 'que_hace') return { antes, despues };
    if (preguntarFase(antes, e, preguntar)) return { antes, despues };
    if (finales(antes)) return { antes, despues };
    return { antes, despues: cierre(e, h, etapa, nombre) };
  }

  // 2b. Modo 'oferta': el pase a la conversación de lo que vende (sus mensajes los dibuja Offer).
  antes.push({ id: 'arr-oferta', de: 'mako', texto: `Gracias, ${nombre}. Ahora cuéntame qué vendes en ${e.negocio}: lo dejo ordenado para trabajar con eso.` });
  if (etapa === 'oferta') return { antes, despues };

  // 2c. Lo que vende, ordenado en un PDF (la tarjeta lleva el link).
  despues.push({ id: 'arr-pdf', de: 'mako', texto: 'Listo: ordené lo que vendes en un PDF. Lo uso para crear lo que necesites.', tarjeta: 'pdf' });

  // 2d. El diagnóstico de fase, con sus opciones: sólo lo que la persona no contestó ya en una conversación
  // de antes. Queda dibujado después, como parte de la historia.
  if (etapa === 'fase' || preguntoLaFase(e)) {
    const o = h.faseOffer;
    despues.push({ id: 'arr-fase', de: 'mako', texto: 'Ahora unas preguntas rápidas para saber en qué fase está tu negocio.' });
    if (preguntarFase(despues, conFaseDeOffer(e, h), preguntar, { canalYaDicho: !!o?.canal, yaContestada: (id) => o?.respuestas[id] != null })) {
      return { antes, despues };
    }
  }

  // 3. El CRM.
  if (h.conCrm) {
    const { tipos, hayMas } = tiposOfrecidos(h.canalNegocio, !!e.crmVerTodos);
    const elegido = e.crmTipo ? TIPOS_CRM.find((t) => t.id === e.crmTipo)?.label : undefined;
    const opciones = [...tipos.map((t) => t.label), ...(hayMas ? [VER_OTROS_TIPOS] : [])];
    preguntar(despues, 'crm', 'Ahora armemos tu CRM: con lo que me contaste, te propongo este.', elegido, opciones, 'crm');
    if (etapa === 'crm') return { antes, despues };
  }

  if (finales(despues)) return { antes, despues };
  despues.push(...cierre(e, h, etapa, nombre));
  return { antes, despues };
}

type Preguntar = (lista: MensajeArranque[], id: string, texto: string, respuesta: string | undefined, opciones?: string[], tarjeta?: TarjetaArranque) => void;

/** ¿El arranque ya hizo alguna pregunta del diagnóstico? (En modo 'oferta' sólo las escribe él.) */
const preguntoLaFase = (e: EstadoArranque): boolean => !!e.canal || (e.faseResp ?? []).some(contestada);

/**
 * Las preguntas del diagnóstico, en orden: las contestadas con su respuesta y la que toca, con las preguntas
 * ORIGINALES. Devuelve true si quedó una abierta. En modo 'oferta' saltea lo que el dueño ya contestó en la
 * conversación de la oferta (`yaContestada`, `canalYaDicho`): esas no se dibujan ni se repiten.
 */
function preguntarFase(lista: MensajeArranque[], e: EstadoArranque, preguntar: Preguntar,
  o: { canalYaDicho?: boolean; yaContestada?: (id: string) => boolean } = {}): boolean {
  const resp = e.faseResp ?? [];
  for (let i = 0; i < PREGUNTAS.length; i++) {
    if (PREGUNTAS[i].id === 'volumen' && !o.canalYaDicho) {
      const c = textoPreguntaFase({ tipo: 'canal' }, e.canal);
      const elegido = e.canal ? CANALES.find((x) => x.id === e.canal)?.label : undefined;
      preguntar(lista, 'fase-canal', c.texto, elegido, c.opciones);
      if (!e.canal) return true;
    }
    if (o.yaContestada?.(PREGUNTAS[i].id)) continue;
    const q = textoPreguntaFase({ tipo: 'pregunta', idx: i }, e.canal);
    const r = contestada(resp[i]) ? q.opciones[resp[i]] : undefined;
    preguntar(lista, `fase-${i}`, q.texto, r, q.opciones);
    if (r === undefined) return true;
  }
  return false;
}

/** El teléfono y el cierre (los dos modos). */
function cierre(e: EstadoArranque, h: HechosArranque, etapa: EtapaArranque, nombre: string): MensajeArranque[] {
  const out: MensajeArranque[] = [];
  if (h.conTelefono) {
    out.push({ id: 'arr-telefono', de: 'mako', texto: '¿A qué WhatsApp te escribo con los avisos y los reportes?', ...(etapa === 'telefono' ? { opciones: [AHORA_NO], tarjeta: 'telefono' as const } : {}) });
    if (e.telefono === 'postergado') out.push({ id: 'arr-telefono-r', de: 'yo', texto: AHORA_NO });
    else if (e.telefono === 'codigo' || e.telefono === 'verificado') out.push({ id: 'arr-telefono-r', de: 'yo', texto: e.telefonoNumero || 'Mi WhatsApp' });
    if (etapa === 'telefono') return out;
    if (e.telefono === 'codigo' || e.telefono === 'verificado') {
      out.push({ id: 'arr-codigo', de: 'mako', texto: `Te mandé un código de 6 dígitos por WhatsApp${e.telefonoNumero ? ` al ${e.telefonoNumero}` : ''}. Escríbelo aquí.`, ...(etapa === 'codigo' ? { opciones: [CAMBIAR_NUMERO, AHORA_NO] } : {}) });
      if (etapa === 'codigo') return out;
      if (e.telefono === 'verificado') out.push({ id: 'arr-codigo-r', de: 'yo', texto: 'Listo, ya lo cargué.' });
    }
  }
  if (etapa === 'listo') {
    out.push({ id: 'arr-listo', de: 'mako', texto: `¡Listo${nombre ? `, ${nombre}` : ''}! Tu MaKo ya está armado.`, tarjeta: 'listo' });
  }
  return out;
}

// ── Las respuestas ──────────────────────────────────────────────────────────
/**
 * Una respuesta. Con una opción viaja TAMBIÉN su texto (`opcionTexto`): el índice solo se lee contra la
 * pregunta ACTUAL del server, y una pestaña vieja que todavía muestra otra pregunta mandaría «la opción 0» de
 * otra cosa (medido en la revisión del 16/10: un clic en «Llamada de venta» del CRM se leía como «Ahora no»
 * del teléfono). Si el texto no coincide, la pregunta cambió y no se anota nada.
 */
export type Respuesta = { texto?: string; opcion?: number; opcionTexto?: string };
export type ResultadoRespuesta =
  /** `fase` al completar el diagnóstico, con el canal que vale (`faseCanal`: el de acá o el de la oferta). */
  | { ok: true; patch: Partial<EstadoArranque>; fase?: number[]; faseCanal?: CanalId }
  | { ok: false; error: string; cambio?: true };

/**
 * Cómo se lee una respuesta en la etapa actual: el `patch` que se guarda y, al completar el diagnóstico del
 * modo 'plan', las respuestas para `setDiagnosticoFase`. Las etapas de tarjeta (el CRM, el teléfono) y la
 * conversación de la oferta tienen su propia acción en la ruta: acá no entran.
 */
export function leerRespuesta(e: EstadoArranque, h: HechosArranque, r: Respuesta): ResultadoRespuesta {
  const etapa = etapaDeArranque(e, h);
  const { antes, despues } = mensajesDeArranque(e, h);
  const ultimo = [...antes, ...despues].filter((m) => m.de === 'mako').pop();
  const opcion = Number.isInteger(r.opcion) && ultimo?.opciones ? ultimo.opciones[r.opcion as number] : undefined;
  if (r.opcion !== undefined && r.opcionTexto !== undefined && opcion !== r.opcionTexto) {
    return { ok: false, error: 'La pregunta cambió.', cambio: true };
  }
  const texto = limpiarRespuesta(opcion ?? r.texto ?? '');

  if (etapa === 'nombre') {
    // Una opción es el nombre tal cual; lo escrito se ENTIENDE («Soy Martín», «me llamo…», «Martín de Acme»).
    if (opcion !== undefined && texto) return { ok: true, patch: { nombre: texto } };
    const { nombre, negocio } = extraerNombre(texto);
    if (!nombre) return { ok: false, error: 'No te entendí el nombre. ¿Cómo te llamo?' };
    return { ok: true, patch: { nombre, ...(negocio ? { negocioSugerido: negocio } : {}) } };
  }
  if (etapa === 'negocio') {
    const negocio = opcion !== undefined ? texto : extraerNegocio(texto);
    if (!negocio) return { ok: false, error: '¿Cómo se llama tu negocio?' };
    return { ok: true, patch: { negocio } };
  }
  if (etapa === 'origen') {
    // Una opción o lo que escriba («por un amigo», «en un podcast»): las dos sirven para saber de dónde viene.
    if (!texto) return { ok: false, error: 'Elige una opción o escríbelo.' };
    return { ok: true, patch: { origen: texto } };
  }
  if (etapa === 'interes') {
    const interes = interesDe(texto);
    if (!interes) return { ok: false, error: 'Elige una de las opciones.' };
    return { ok: true, patch: { interes } };
  }
  if (etapa === 'objetivo' || etapa === 'que_hace') {
    if (!texto) return { ok: false, error: 'Escríbeme tu respuesta.' };
    return { ok: true, patch: { [etapa === 'objetivo' ? 'objetivo' : 'queHace']: texto } };
  }
  if (etapa === 'fase') {
    // En modo 'oferta' cuenta lo que ya contestó en la conversación de la oferta (`conFaseDeOffer`).
    const ef = h.modo === 'oferta' ? conFaseDeOffer(e, h) : e;
    const p = siguientePreguntaFase(ef);
    if (!p) return { ok: false, error: 'El diagnóstico ya está completo.' };
    const { opciones } = textoPreguntaFase(p, ef.canal);
    // Sólo con una opción: el diagnóstico se CALCULA (lib/fase-diagnostico.ts) y una respuesta libre no
    // tiene índice. Se acepta el texto si es exactamente una opción.
    const idx = Number.isInteger(r.opcion) ? (r.opcion as number) : opciones.findIndex((o) => o.toLowerCase() === texto.toLowerCase());
    if (!(idx >= 0 && idx < opciones.length)) return { ok: false, error: 'Elige una de las opciones.' };
    if (p.tipo === 'canal') {
      const canal = CANALES[idx].id;
      const siguiente: EstadoArranque = { ...ef, canal };
      return { ok: true, patch: { canal }, ...(faseCompleta(siguiente) ? { fase: faseCompleta(siguiente)!, faseCanal: canal } : {}) };
    }
    const faseResp = [...(ef.faseResp ?? PREGUNTAS.map(() => -1))];
    while (faseResp.length < PREGUNTAS.length) faseResp.push(-1);
    faseResp[p.idx] = idx;
    const siguiente: EstadoArranque = { ...ef, faseResp };
    // Lo que se guarda en el estado es sólo lo que contestó ACÁ: lo de Offer se sigue leyendo de Offer, y
    // copiarlo haría que `preguntoLaFase` dibujara como del arranque preguntas que hizo la otra conversación.
    const propias = h.modo === 'oferta' ? faseResp.map((v, i) => (contestada(e.faseResp?.[i]) || i === p.idx ? v : -1)) : faseResp;
    const completa = faseCompleta(siguiente);
    return { ok: true, patch: { faseResp: propias }, ...(completa ? { fase: completa, ...(siguiente.canal ? { faseCanal: siguiente.canal } : {}) } : {}) };
  }
  if (etapa === 'codigo') {
    if (opcion === CAMBIAR_NUMERO) return { ok: true, patch: { telefono: undefined, telefonoNumero: undefined } };
    if (opcion === AHORA_NO) return { ok: true, patch: { telefono: 'postergado' } };
    return { ok: false, error: 'Escribe el código de 6 dígitos.' };
  }
  if (etapa === 'telefono' && opcion === AHORA_NO) return { ok: true, patch: { telefono: 'postergado' } };
  if (etapa === 'crm') {
    if (opcion === VER_OTROS_TIPOS) return { ok: true, patch: { crmVerTodos: true } };
    const t = TIPOS_CRM.find((x) => x.label === opcion);
    if (!t) return { ok: false, error: 'Elige un tipo de CRM.' };
    return { ok: true, patch: { crmTipo: t.id } };
  }
  return { ok: false, error: 'Ahora no estoy esperando eso.' };
}

// ── Lo que se cierra ────────────────────────────────────────────────────────
export type PasoDelArranque = 'negocio' | 'productos' | 'fase' | 'tabs' | 'integraciones' | 'plan';

/**
 * Qué pasos del onboarding cierra el chat al terminar, y CÓMO. El teléfono y Meta se POSTERGAN cuando no se
 * hicieron —nunca se marcan hechos—: sin destino, los reportes y los avisos no le llegan a nadie, y lo
 * postergado queda como recordatorio en /general (lib/onboarding-pendientes.ts).
 */
export function cierreDePasos(
  pasosCapa: readonly string[],
  hechos: { telefonoVerificado: boolean; metaConectado: boolean },
): Array<{ paso: PasoDelArranque; done?: boolean; postergar?: boolean }> {
  const out: Array<{ paso: PasoDelArranque; done?: boolean; postergar?: boolean }> = [];
  for (const p of pasosCapa) {
    if (p === 'negocio' || p === 'productos' || p === 'fase' || p === 'plan') out.push({ paso: p, done: true });
    else if (p === 'tabs') out.push(hechos.telefonoVerificado ? { paso: 'tabs', done: true } : { paso: 'tabs', postergar: true });
    else if (p === 'integraciones') out.push(hechos.metaConectado ? { paso: 'integraciones', done: true } : { paso: 'integraciones', postergar: true });
  }
  return out;
}

// ── El perfil del negocio que queda escrito ─────────────────────────────────
/**
 * Un texto que lleva la marca «[completar]» (la pone `filtrarCifras` donde una cifra que el dueño no dio
 * no se puede afirmar) NO se escribe en el brief ni en el catálogo: los prompts lo leerían como un dato. Es
 * la misma regla de `ofertaDesdePropuesta`. Vacío = no se escribe.
 */
export function sinMarca(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return /\[completar\]/i.test(t) ? '' : t;
}

/**
 * Las respuestas del brief (mako.onboarding.answers) que deja la conversación. El brief es lo que leen los
 * generadores (Ads Writer, contenido, video) y el Perro Guardián: si el chat no lo escribe, escriben sin
 * conocer el negocio. Se FUNDE con lo que ya hay (`fundirBrief`): nunca pisa una respuesta que el negocio
 * ya tenía (la del Archivero o una edición en Second Brain).
 *
 * ⚠️ EL PRECIO NO VA: `oferta_ticket` es «Precio / ticket (USD)» y lo que dijo el dueño es texto libre
 * («$3k», «3 pagos de 997», «800 MXN/mes»). Pasarlo a número inventa un precio en dólares (medido en la
 * revisión del 16/10: «$3k» daba 3, «800 MXN/mes» daba 800 USD), y lib/ofertas.ts ya lo prohíbe: «EL PRECIO
 * DEL BRIEF NO SE PARSEA A NÚMERO». El precio queda en la oferta, como texto.
 */
export function briefDesdeArranque(input: {
  estado: EstadoArranque;
  piezas?: PiezasSabidas;
  propuesta?: PropuestaOferta | null;
  /** El texto de la opción que eligió en «¿Cuál es tu MAYOR cuello de botella hoy?». */
  cuello?: string | null;
}): Record<string, string> {
  const v = (k: keyof PiezasSabidas) => sinMarca(input.piezas?.[k]?.valor);
  const prop = input.propuesta ?? null;
  const out: Record<string, string> = {
    negocio_que_hace: sinMarca(input.estado.queHace) || sinMarca(prop?.frase) || v('frase') || v('resultado'),
    negocio_objetivo: sinMarca(input.estado.objetivo),
    negocio_freno: sinMarca(input.cuello) || v('problema'),
    oferta_nombre: sinMarca(prop?.nombre),
    oferta_promesa: v('resultado'),
    oferta_incluye: v('entregables'),
    oferta_garantia: v('garantia'),
    avatar_quien: v('cliente'),
    avatar_dolor: v('problema'),
    avatar_deseo: v('resultado'),
    avatar_objecion: v('objecion'),
  };
  for (const k of Object.keys(out)) if (!out[k].trim()) delete out[k];
  return out;
}

/** Funde respuestas nuevas sobre las que ya hay: sólo llena lo VACÍO. */
export function fundirBrief(previas: Record<string, string>, nuevas: Record<string, string>): Record<string, string> {
  const out = { ...previas };
  for (const [k, val] of Object.entries(nuevas)) if (!(out[k] ?? '').trim() && val.trim()) out[k] = val.trim();
  return out;
}
