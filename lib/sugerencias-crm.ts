// =============================================================================
// sugerencias-crm — lo que MaKo le sugiere a UN CRM, PURO (sin IA, sin base, sin server-only)
// =============================================================================
// Pedido de Martín (13/10/2026, General 3 del feedback del CRM): «replica el mismo chat que hay en
// Automations, que se abre al costado… que siempre esté plegado y que ahí aparezcan notificaciones»,
// con sugerencias «inteligentes y personalizadas». Y el 14/10: «No veo nada sobre el chat de MaKo y
// las recomendaciones...». El mapa de qué se propone y qué lo dispara es docs/sugerencias-mako-crm.md;
// esto es su motor.
//
// QUÉ HACE: con la foto de un CRM (sus etapas, sus transiciones, los plazos por etapa, cómo vende y
// cómo le llega la gente, sus leads, lo que tiene conectado y las automatizaciones que YA tiene el
// negocio) devuelve una lista corta de sugerencias, cada una de UNA línea y con su acción:
//
//   · `plantilla`: «Hacerlo» crea la automatización de la galería (lib/plantillas-automatizaciones.ts)
//     por la puerta de siempre (`crearDesdePlantilla`, lib/plantilla-crear.ts), PAUSADA, con el CRON en
//     la etapa (`disparador`, el valor del desplegable del CRON). Sólo el admin: crear automatizaciones
//     es suyo.
//   · `link`: «Hacerlo» lleva a la pantalla donde se arregla (conectar Fathom). También del admin.
//   · `chat`: «Hacerlo» le pasa el pedido al chat de MaKo del CRM, que PROPONE y la persona confirma
//     en la tarjeta. Cualquiera que vea el CRM: el gating de cada acción lo mira el registro.
//
// LAS CLASES DEL MAPA que cubre (las otras dos, en «Lo que no está»):
//   · CLASE 1, «Armás el CRM»: una etapa sin su automatización. Entrada → «Un Lead Entró»; reunión →
//     «Un Lead Agendó Llamada» y, en su No Show, «Un Lead No Asistió»; pago → «Un Lead Confirmó la
//     Compra»; Ganado → «Un Cliente Empezó» (en la ENTREGA del producto); una etapa con plazo → «Un Lead
//     No Avanzó»; cuotas en la cartera → «Una Cuota Venció».
//   · CLASE 3, «El tablero llega a un estado»: parados en la entrada más de N días, reuniones que ya
//     pasaron sin marcar (sin Fathom conectado), ganados sin cobro o cuotas vencidas, nutriciones
//     manuales vencidas.
//
// ⚠️ «NUNCA TE PROPONE UNA AUTOMATIZACIÓN QUE YA EXISTE» (el mapa). Se compara por DISPARADOR, con la
// misma lista de CRON que lee el motor (`disparadoresDe`, lib/disparadores.ts: el primero de las
// columnas y los demás de `disparadores`): si alguna automatización viva arranca en esa etapa de este
// CRM (o de todos: un embudo `null` es «a TODOS», lib/nutricion.ts), no se propone otra. La única
// excepción es una que se SABE de otra plantilla (su `clave` nace `plantilla-<id>-…`,
// lib/plantilla-crear.ts): «Un Lead Entró» en la entrada no tapa «Un Lead No Avanzó» en la misma
// etapa. Una escrita a mano tapa todo lo de su etapa: no se sabe qué hace, y duplicar es peor que no
// sugerir. Y una creada desde la plantilla que quedó SIN CRON (la etapa no se pudo guardar) tapa esa
// plantilla en todos lados: sigue esperando que alguien le elija la etapa.
//
// ⚠️ LO QUE NO SE PUDO LEER NO SUGIERE NADA. `null` en un dato (los leads, las cuotas, Fathom) es «no
// sé», y una sugerencia que sale de un «no sé» afirma algo que nadie midió (AGENTS.md, «Un chequeo que
// no puede mirar se abstiene»). Sólo `false` es «no está conectado».
//
// Los umbrales son los del mapa (`UMBRALES_SUGERENCIAS`); los que el mapa no da están dichos ahí.
// Lo usan lib/sugerencias-crm-server.ts (el server, una vez y cacheado), la API de MaKo
// (`sugerencias_crm`, lib/api-mako/areas/crm.run.ts) y tests/sugerencias-crm.test.ts.
// =============================================================================

import { disparadoresDe, TRIGGER_AVISO_MAKO, type FilaDisparadores, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER } from './disparadores';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA } from './nutricion-etapa';
import { PLANTILLAS, PLANTILLAS_REEMPLAZADAS, plantillaPorId, canalesDe } from './plantillas-automatizaciones';
import { etapaNoShowDe, TERMINAL_DEL_PIPELINE, type FunnelTransition, type Stage } from './pipeline';
import { etapaDeEntrada } from './lead-funnel-reglas';
import { textoDuracion } from './espera-duracion';

// ── Los umbrales ─────────────────────────────────────────────────────────────

/**
 * Los números del mapa (docs/sugerencias-mako-crm.md), como default. Los que el mapa no da, con su
 * porqué: `paradosMinimo` y `ganadosSinCobroMinimo` (el mapa da el ejemplo de 34 parados, no un piso:
 * con menos de 5 es mirar la columna), `hechaDias` (cuánto se calla una sugerencia ya hecha: lo que
 * tarda en vencer la caché del server en TODAS sus instancias, con margen; después la tapa la
 * automatización creada) y `tope` (una lista de N líneas que no entra en el panel deja de leerse).
 */
export const UMBRALES_SUGERENCIAS = {
  /** «Leads parados en "Lead entrante" más de N días (N: 2 en chat, 3 en landing, 7 en llamada)». */
  paradosDias: { chat: 2, landing: 3, llamada: 7 },
  paradosMinimo: 5,
  /** «Reuniones que ya pasaron sin marcar asistencia (5 o más)». */
  reunionesSinMarcarMinimo: 5,
  /** «Nutrición manual vencida (3 o más)». */
  manualVencidaMinimo: 3,
  ganadosSinCobroMinimo: 3,
  /** «"Ahora no" la calla 30 días para ese CRM». */
  callarDias: 30,
  hechaDias: 1,
  tope: 8,
  /** Clase 2 (20/10/2026): la ventana del historial y cuántas veces es «repetir un gesto». */
  gestosDias: 14,
  /** «Movés a mano 5 o más leads de la misma etapa A a la misma B en 14 días». */
  gestosMovimientos: 5,
  /** «Marcás No show a mano 3 veces». */
  gestosNoShow: 3,
  /** «Pegás el link de Fathom a mano 3 veces». */
  gestosFathom: 3,
  /** «Mandás el mismo mensaje a 3 o más leads de una etapa» (20/10/2026). */
  gestosMensaje: 3,
  /** Un mensaje más corto que esto («ok», «gracias», «¿pudiste ver?») no es una secuencia: es una respuesta. */
  mensajeMinimoLetras: 25,
} as const;

// ── El dato ──────────────────────────────────────────────────────────────────

export type EtapaSug = Pick<Stage, 'key' | 'label'> & { kind?: string | null; band?: string | null };

/** Una automatización del negocio, con lo que hace falta para saber dónde arranca. */
export type AutomatizacionSug = FilaDisparadores & {
  id: number;
  nombre?: string | null;
  /** `plantilla-<id>-…` si nació de la galería (lib/plantilla-crear.ts). */
  clave?: string | null;
  archivada_at?: string | null;
};

/** Un lead del tablero, como lo mira el motor. Sólo los de la CASA (no los agregados). */
export type LeadSug = {
  /** la etapa donde lo dibuja el tablero (`etapaVigenteDe`) */
  etapa: string;
  /** created_at (ISO) */
  creado: string | null;
  /** fecha de la R1 y la R2 (YYYY-MM-DD o ISO) y si asistió */
  r1: string | null; asistioR1: boolean | null;
  r2: string | null; asistioR2: boolean | null;
  /** total_cobrado_usd: null o 0 = sin cobro registrado */
  cobrado: number | null;
  /** venta_tipo: 'sin_cobro' es un becado (lib/venta-tipo.ts) y no debe nada */
  ventaTipo: string | null;
  /** nutricion_manual_deadline (YYYY-MM-DD o ISO) */
  manualVence: string | null;
};

export type FunnelSug = {
  /** el id REAL del embudo (el del negocio también tiene el suyo): va en el CRON (`venta:<id>:<etapa>`) */
  id: number;
  /** cómo se cierra (lib/fase-diagnostico.ts, `canalEfectivo`) */
  canal: string | null;
  /** cómo entra la gente (`funnels.data.entradas`); `[]` = no declarado */
  entradas: readonly string[];
  /** el producto principal del embudo y las etapas de su ENTREGA (para «Un Cliente Empezó») */
  productoId: number | null;
  etapasEntrega: readonly string[];
};

export type EntradaSugerencias = {
  funnel: FunnelSug;
  /** las etapas del funnel generado (`stages`), con su `kind` y su banda */
  etapas: readonly EtapaSug[];
  transiciones: readonly FunnelTransition[];
  /** `funnels.data.umbrales.porEtapa`, ya saneado (días por etapa) */
  plazos: Readonly<Record<string, number>>;
  /** las automatizaciones VIVAS del negocio (no archivadas) */
  automatizaciones: readonly AutomatizacionSug[];
  /** null = no se pudieron leer: no hay sugerencias de clase 3 */
  leads: readonly LeadSug[] | null;
  /** cuotas sin pagar de los leads de este CRM; null = no se pudo leer */
  cuotas: { vencidas: number; pendientes: number } | null;
  /** true / false / null (no se pudo mirar: no frena ni sugiere) */
  conectado: { whatsapp: boolean | null; fathom: boolean | null };
  /** hoy en la zona del negocio, YYYY-MM-DD */
  hoy: string;
  /** ms */
  ahora: number;
  /**
   * CLASE 2 (20/10/2026): los gestos A MANO de una persona en los últimos `gestosDias` días en este CRM (el historial
   * del lead: `lead_audit` con un email de autor; lo que hizo MaKo o una automatización no cuenta). Ausente o null =
   * no se pudieron leer: no hay sugerencias de clase 2.
   */
  gestos?: {
    movimientos: ReadonlyArray<{ desde: string; hacia: string }>; noShowsAMano: number; fathomAMano?: number;
    /** Los mensajes que una persona mandó a mano: el texto ya normalizado (`textoComparable`), a qué lead y en qué etapa
     *  está ese lead hoy. Ausente = no se pudieron leer (esa sugerencia se calla). */
    mensajes?: ReadonlyArray<{ texto: string; muestra: string; lead: number; etapa: string }>;
  } | null;
  /** CLASE 4 (20/10/2026): lo nuevo que llegó en esos días (conversaciones de Instagram y Messenger). null = no se leyó. */
  nuevos?: {
    dmInstagram: number; dmMessenger: number;
    /** Las landings y campañas de Meta que trajeron leads sin estar conectadas a ningún CRM (cayeron al principal), sólo
     *  si el negocio tiene más de un CRM. Ausente = no se leyó. */
    sinCrm?: ReadonlyArray<{ tipo: 'landing' | 'campaña'; nombre: string; leads: number }>;
    /** Leads de ESTE CRM que volvieron a la landing o miraron el VSL dos veces, el más reciente primero. Ausente = no se leyó. */
    volvieron?: ReadonlyArray<{ lead: number; nombre: string; etapa: string }>;
  } | null;
};

export type AccionSugerencia =
  | { tipo: 'plantilla'; plantilla: string; disparador: string | null }
  | { tipo: 'link'; href: string }
  | { tipo: 'chat'; pedido: string };

export type Sugerencia = {
  /** estable: `<plantilla>:<etapa>` o el nombre de la situación. Es lo que se calla. */
  id: string;
  /** 1: armás el CRM · 2: repetís un gesto · 3: el tablero llega a un estado · 4: llega algo nuevo (docs/sugerencias-mako-crm.md). */
  clase: ClaseSugerencia;
  /** UNA línea (`TOPE_TEXTO`) */
  texto: string;
  /** la etapa de la que habla (key), si habla de una */
  etapa: string | null;
  accion: AccionSugerencia;
  /** sólo el admin la puede hacer (crear automatizaciones, conectar integraciones) */
  soloAdmin: boolean;
};

/**
 * Lo que la PANTALLA recibe de una sugerencia (app/api/crm/mako/route.ts → app/crm/mako-crm/PanelMakoCrm.tsx):
 * qué dice, qué hace «Hacerlo» y si ESTA persona lo puede hacer. Ni la plantilla ni la etapa viajan: al
 * crear, el server vuelve a calcular y decide él (lib/sugerencias-crm-server.ts).
 */
export type ClaseSugerencia = 1 | 2 | 3 | 4;

export type SugerenciaDePantalla = {
  id: string; clase: ClaseSugerencia; texto: string;
  tipo: AccionSugerencia['tipo'];
  href?: string; pedido?: string;
  /** false = no se le ofrece «Hacerlo» (crear automatizaciones y conectar integraciones son del admin) */
  hacer: boolean;
};

export const dePantalla = (s: Sugerencia, admin: boolean): SugerenciaDePantalla => ({
  id: s.id, clase: s.clase, texto: s.texto, tipo: s.accion.tipo,
  ...(s.accion.tipo === 'link' ? { href: s.accion.href } : {}),
  ...(s.accion.tipo === 'chat' ? { pedido: s.accion.pedido } : {}),
  hacer: admin || !s.soloAdmin,
});

/**
 * El pedido de una sugerencia `chat` cuando sale al chat «Cerebro» (22/10/2026, la estrella del CRM es la del Ops
 * Center): el Cerebro no sabe desde qué CRM se lo mandan, así que «este CRM» y «a éste» pasan a NOMBRARLO. Sin el
 * nombre (no se pudo leer el CRM) sale como está.
 */
export function pedidoParaElCerebro(pedido: string, crm: string | null | undefined): string {
  const nombre = crm?.trim();
  if (!nombre) return pedido;
  return pedido
    .replace(/\b([Ee])n este CRM\b/g, (_, e: string) => `${e}n el CRM ${comillas(nombre)}`)
    .replace(/\bde este CRM\b/g, `del CRM ${comillas(nombre)}`)
    .replace(/\ba éste\b/g, `al CRM ${comillas(nombre)}`);
}

/** El techo de una línea de una lista de N (AGENTS.md, «La pantalla dice QUÉ pasó»). */
export const TOPE_TEXTO = 110;

// ── Cuántos días son «parados» ───────────────────────────────────────────────

/**
 * N del mapa: 2 en chat, 3 en landing, 7 en llamada. Lo decide primero cómo ENTRA la gente (un chat
 * se enfría en dos días aunque el cierre sea por llamada) y después cómo se cierra. Sin nada
 * declarado, el de landing: el del medio.
 */
export function diasParadosDe(canal: string | null, entradas: readonly string[]): number {
  const d = UMBRALES_SUGERENCIAS.paradosDias;
  if (canal === 'conversaciones' || entradas.some((e) => e === 'chat_entrante' || e === 'chat_saliente')) return d.chat;
  if (entradas.some((e) => e === 'landing' || e === 'formulario_anuncio')) return d.landing;
  if (canal === 'llamadas' || entradas.includes('agenda_sola')) return d.llamada;
  return d.landing;
}

// ── Lo que espera la plantilla: lo que la sugerencia PROMETE ─────────────────

/**
 * Cuánto espera una plantilla de la galería antes de hacer algo (su primer «Esperar» por tiempo), en
 * el texto de la pastilla del lienzo («3 días», «36 h»): leído de SU definición, nunca copiado a mano.
 * null = la plantilla no espera.
 *
 * ⚠️ «Un Lead No Avanzó» espera un plazo FIJO desde que el lead entra a la etapa y avisa después: ni
 * el plazo de la etapa (`funnels.data.umbrales.porEtapa`) ni el N de los parados del mapa. La
 * sugerencia que la crea dice ESE plazo; prometer «más de lo previsto» o «hace más de N días» era
 * ofrecer una automatización que hace otra cosa (revisión del 14/10/2026).
 */
export function esperaDePlantilla(plantilla: string): string | null {
  const paso = plantillaPorId(plantilla)?.pasos.find((x) => x.nodo === 'esperar' && x.espera?.modo === 'tiempo');
  const minutos = Number(paso?.espera?.minutos);
  return minutos > 0 ? textoDuracion(minutos * 60) : null;
}

// ── De qué plantilla nació una automatización ────────────────────────────────

/** Los ids de la galería, el más largo primero: `startsWith` no confunde `lead-no-asistio` con otro. */
const IDS_GALERIA = [...PLANTILLAS.map((p) => p.id), ...Object.keys(PLANTILLAS_REEMPLAZADAS)].sort((a, b) => b.length - a.length);

/**
 * La plantilla de la que nació, por su `clave` (`plantilla-<id>-<hora>-<azar>`), con un id de antes
 * traducido a la de su categoría. null = no nació de la galería (o no se sabe).
 */
export function plantillaDeClave(clave: string | null | undefined): string | null {
  const c = String(clave ?? '');
  if (!c.startsWith('plantilla-')) return null;
  const id = IDS_GALERIA.find((x) => c.startsWith(`plantilla-${x}-`));
  if (!id) return null;
  return plantillaPorId(id) ? id : (PLANTILLAS_REEMPLAZADAS[id] ?? null);
}

// ── ¿Ya existe? ──────────────────────────────────────────────────────────────

const keysDe = (d: { etapa?: string | null; etapas?: readonly string[] | null }): string[] =>
  [d.etapa, ...(d.etapas ?? [])].filter((k): k is string => typeof k === 'string' && k.length > 0);

/** Lo que una sugerencia de plantilla pregunta: en qué etapa (venta o entrega) o en qué evento. */
export type Pregunta =
  | { donde: 'venta'; plantilla: string; funnelId: number; etapa: string }
  | { donde: 'entrega'; plantilla: string; productoId: number | null }
  | { donde: 'evento'; plantilla: string; trigger: string; subtipo: string };

/**
 * ¿Hay una automatización viva que ya hace esto? Ver la cabecera: por disparador, y una de OTRA
 * plantilla conocida no tapa.
 */
export function yaExiste(automs: readonly AutomatizacionSug[], q: Pregunta): boolean {
  for (const a of automs) {
    if (a.archivada_at) continue;
    const de = plantillaDeClave(a.clave);
    const ds = disparadoresDe(a);
    // Creada desde ESTA plantilla y sin CRON elegido: espera que le elijan dónde arranca.
    if (de === q.plantilla && ds.every((d) => d.trigger_tipo === 'manual')) return true;
    if (q.donde === 'evento') {
      if (ds.some((d) => d.trigger_tipo === q.trigger && d.subtipo === q.subtipo)) return true;
      continue;
    }
    if (de != null && de !== q.plantilla) continue;
    for (const d of ds) {
      if (q.donde === 'venta' && d.trigger_tipo === TRIGGER_ETAPA) {
        // Sin embudo en el disparador, el de la fila; `null` en la fila es «a TODOS».
        const f = d.funnel_id === undefined ? (a.funnel_id == null || a.funnel_id === '' ? null : Number(a.funnel_id)) : d.funnel_id;
        if ((f == null || f === q.funnelId) && keysDe(d).includes(q.etapa)) return true;
      }
      if (q.donde === 'entrega' && d.trigger_tipo === TRIGGER_ENTREGA) {
        if (d.producto_id == null || q.productoId == null || d.producto_id === q.productoId) return true;
      }
    }
  }
  return false;
}

// ── El motor ─────────────────────────────────────────────────────────────────

/**
 * El texto de un mensaje para compararlo con otro (clase 2, «el mismo mensaje a 3 leads»): sin mayúsculas, acentos ni
 * signos, y sin el primer nombre del lead («Hola Ana, …» y «Hola Juan, …» son el MISMO mensaje).
 */
export function textoComparable(texto: string, nombreLead?: string | null): string {
  const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const palabras = plano(texto).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  const nombre = plano(nombreLead ?? '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')[0] ?? '';
  return (nombre.length >= 2 ? palabras.filter((w) => w !== nombre) : palabras).join(' ');
}

/**
 * EL ID DE UNA SUGERENCIA: lo que «Ahora no» guarda y relee (`claveCallada`, `parsearCalladas`) y lo que acepta la ruta
 * (app/api/crm/mako/route.ts). Una sola regla para los tres. ⚠️ Un id con «.», «/», «>» o «ñ» la ruta lo rechazaba y la
 * sugerencia volvía en cada carga sin poder callarse (revisión del 21/10/2026): lo que viene de afuera (una URL, el
 * nombre de una campaña, dos keys de etapa) va como un hash corto.
 */
export const ID_SUGERENCIA = /^[a-z0-9:_-]{1,120}$/i;
const hashCorto = (s: string): string => {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};
/** «Hace 5 veces que mueves de A a B»: un id por par de etapas. */
export const idGestoMover = (desde: string, hacia: string): string => `gesto-mover:${hashCorto(`${desde}>${hacia}`)}`;
/** «Llegaron leads de la landing X»: un id por landing o campaña. */
export const idSinCrm = (tipo: 'landing' | 'campaña', nombre: string): string => `sin-crm:${tipo === 'campaña' ? 'campana' : 'landing'}:${hashCorto(nombre)}`;

const DIA_MS = 86_400_000;
const dia = (s: string | null | undefined): string => String(s ?? '').slice(0, 10);
const comillas = (s: string) => `«${s.trim()}»`;
const corto = (s: string): string => (s.length <= TOPE_TEXTO ? s : `${s.slice(0, TOPE_TEXTO - 1).trimEnd()}…`);
/**
 * Una línea con una etapa entre comillas en el MEDIO: si no entra, se acorta la ETAPA y no lo que se
 * ofrece («¿Te aviso si…?»). Cortar la línea al final dejaba una etapa larga y la promesa a medias.
 */
const conEtapa = (armar: (etapa: string) => string, etapa: string): string => {
  const entera = armar(comillas(etapa));
  if (entera.length <= TOPE_TEXTO) return entera;
  const e = etapa.trim();
  const queda = Math.max(1, e.length - (entera.length - TOPE_TEXTO) - 1);
  return corto(armar(comillas(`${e.slice(0, queda).trimEnd()}…`)));
};

/** Las entradas a las que les sirve «Un Lead Entró» («Gracias por dejarnos tus datos»). Sin declarar, también. */
const ENTRA_DEJANDO_DATOS = new Set(['landing', 'formulario_anuncio']);

/**
 * Las sugerencias de UN CRM, en orden: lo que dice el tablero (clase 3) primero —trae números y es de
 * hoy— y después lo que le falta al CRM armado (clase 1), en el orden del embudo. Una sola por `id`
 * (gana la primera: la de clase 3 trae el número) y como mucho `tope`.
 */
export function sugerenciasDelCrm(e: EntradaSugerencias, tope: number = UMBRALES_SUGERENCIAS.tope): Sugerencia[] {
  const U = UMBRALES_SUGERENCIAS;
  const pipeline = e.etapas.filter((s) => (s.band ?? 'pipeline') === 'pipeline');
  const label = (key: string) => e.etapas.find((s) => s.key === key)?.label?.trim() || key;
  const existe = (q: Pregunta) => yaExiste(e.automatizaciones, q);
  const venta = (etapa: string) => `venta:${e.funnel.id}:${etapa}`;
  const out: Sugerencia[] = [];
  const ofrecer = (s: Sugerencia) => { if (!out.some((x) => x.id === s.id)) out.push({ ...s, texto: corto(s.texto) }); };

  // «Sin WhatsApp no te propone un mensaje por WhatsApp»: una plantilla que le habla al lead SÓLO por
  // WhatsApp no se ofrece si se SABE que no hay línea. «MaKo en WhatsApp» (el grupo) no cuenta: sale por
  // el número de MaKo.
  const sirve = (plantilla: string): boolean => {
    const p = plantillaPorId(plantilla);
    if (!p) return false;
    if (e.conectado.whatsapp !== false) return true;
    const c = canalesDe(p);
    return !(c.includes('whatsapp') && !c.includes('email') && !c.includes('instagram') && !c.includes('messenger'));
  };
  /** Una que crea la plantilla en una etapa de VENTA de este CRM. */
  const enEtapa = (clase: ClaseSugerencia, plantilla: string, etapa: string, texto: string) => {
    if (!sirve(plantilla) || existe({ donde: 'venta', plantilla, funnelId: e.funnel.id, etapa })) return;
    ofrecer({ id: `${plantilla}:${etapa}`, clase, texto, etapa, accion: { tipo: 'plantilla', plantilla, disparador: venta(etapa) }, soloAdmin: true });
  };
  const cobranza = (clase: 1 | 3, texto: string) => {
    if (existe({ donde: 'evento', plantilla: 'mako-cobranza', trigger: TRIGGER_AVISO_MAKO, subtipo: 'cuota_vencida' })) return;
    ofrecer({ id: 'mako-cobranza', clase, texto, etapa: null, accion: { tipo: 'plantilla', plantilla: 'mako-cobranza', disparador: null }, soloAdmin: true });
  };

  const entrada = etapaDeEntrada(pipeline);
  const leads = e.leads;
  // Lo que espera «Un Lead No Avanzó» (su definición): es lo que se ofrece. Sin espera, no hay qué prometer.
  const plazoNoAvanzo = esperaDePlantilla('lead-no-avanzo');

  // ── CLASE 3: el tablero ──────────────────────────────────────────────────────
  if (leads) {
    if (entrada && plazoNoAvanzo) {
      // El conteo usa el N del mapa; lo que se OFRECE es lo que la plantilla hace (`plazoNoAvanzo`).
      const dias = diasParadosDe(e.funnel.canal, e.funnel.entradas);
      const parados = leads.filter((l) => l.etapa === entrada && l.creado && e.ahora - Date.parse(l.creado) > dias * DIA_MS).length;
      if (parados >= U.paradosMinimo) {
        enEtapa(3, 'lead-no-avanzo', entrada, conEtapa((et) => `${parados} leads parados en ${et} hace más de ${dias} días. ¿Te aviso si uno pasa ${plazoNoAvanzo} ahí?`, label(entrada)));
      }
    }
    if (e.conectado.fathom === false) {
      const sinMarcar = leads.reduce((n, l) =>
        n + (l.r1 && dia(l.r1) < e.hoy && l.asistioR1 == null ? 1 : 0) + (l.r2 && dia(l.r2) < e.hoy && l.asistioR2 == null ? 1 : 0), 0);
      if (sinMarcar >= U.reunionesSinMarcarMinimo) {
        ofrecer({
          id: 'conectar-fathom', clase: 3, etapa: null, soloAdmin: true,
          texto: `${sinMarcar} reuniones pasadas sin asistencia. ¿Conectas Fathom para marcarlas solo?`,
          accion: { tipo: 'link', href: '/integraciones?abrir=fathom' },
        });
      }
    }
    if (e.cuotas && e.cuotas.vencidas > 0) {
      cobranza(3, `${e.cuotas.vencidas} ${e.cuotas.vencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'} sin cobrar. ¿Te aviso cuando venza una?`);
    }
    const ganado = e.etapas.some((s) => s.key === TERMINAL_DEL_PIPELINE) ? TERMINAL_DEL_PIPELINE : null;
    if (ganado) {
      const sinCobro = leads.filter((l) => l.etapa === ganado && !(Number(l.cobrado) > 0) && l.ventaTipo !== 'sin_cobro').length;
      if (sinCobro >= U.ganadosSinCobroMinimo) cobranza(3, `${sinCobro} en ${comillas(label(ganado))} sin cobro registrado. ¿Te aviso de las cuotas?`);
    }
    const vencidas = leads.filter((l) => l.etapa === 'manual' && l.manualVence && dia(l.manualVence) < e.hoy).length;
    if (vencidas >= U.manualVencidaMinimo) {
      ofrecer({
        id: 'manual-vencida', clase: 3, etapa: 'manual', soloAdmin: false,
        texto: `${vencidas} leads con la nutrición manual vencida. ¿Los reviso contigo?`,
        accion: { tipo: 'chat', pedido: `En este CRM hay ${vencidas} leads en ${comillas(label('manual'))} con el plazo vencido. ¿Quiénes son y a qué etapa conviene pasar a cada uno?` },
      });
    }
  }

  // ── CLASE 2: repetís un gesto (20/10/2026) ───────────────────────────────────
  // Va antes que la 1: si el gesto pide lo mismo que el CRM armado (reagendar a los No show), gana el texto que dice
  // por qué se ofrece ahora («marcaste 3 No show a mano»). `ofrecer` se queda con la primera de cada id.
  if (e.gestos) {
    const pasos = new Set(pipeline.map((s) => s.key));
    const veces = new Map<string, number>();
    for (const m of e.gestos.movimientos) {
      // Sólo de un paso del recorrido a otro: ganar, perder o mandar a nutrición son decisiones, no rutina.
      if (!pasos.has(m.desde) || !pasos.has(m.hacia) || m.desde === m.hacia || m.hacia === TERMINAL_DEL_PIPELINE) continue;
      const k = `${m.desde}>${m.hacia}`;
      veces.set(k, (veces.get(k) ?? 0) + 1);
    }
    for (const [k, n] of [...veces].sort((a, b) => b[1] - a[1])) {
      if (n < U.gestosMovimientos) continue;
      const [desde, hacia] = k.split('>');
      ofrecer({
        id: idGestoMover(desde, hacia), clase: 2, etapa: hacia, soloAdmin: false,
        texto: `Hace ${n} veces que mueves de ${comillas(label(desde))} a ${comillas(label(hacia))}. ¿Lo hago solo?`,
        accion: {
          tipo: 'chat',
          pedido: `En este CRM moví a mano ${n} leads de ${comillas(label(desde))} a ${comillas(label(hacia))} en las últimas dos semanas. ¿Qué tenían en común, y qué automatización los movería sola?`,
        },
      });
    }
    const r1 = pipeline.find((s) => s.kind === 'reunion');
    const noShow = r1 ? etapaNoShowDe(e.etapas as Stage[], e.transiciones as FunnelTransition[], r1.key, 'r1') : null;
    if (noShow && e.gestos.noShowsAMano >= U.gestosNoShow) {
      enEtapa(2, 'lead-no-asistio', noShow, `Marcaste ${e.gestos.noShowsAMano} No show a mano. ¿Les escribo solo para reagendar?`);
    }
    // «Mandás el mismo mensaje a 3 o más leads de una etapa → dejarlo como secuencia de esa etapa». Cuenta LEADS distintos
    // (mandárselo dos veces al mismo es insistir, no repetir) y la etapa en la que están HOY; una por etapa, la del mensaje
    // más repetido. No hay plantilla para «este texto en esta etapa»: la arma MaKo por el chat, con el texto.
    const enCrm = new Set(e.etapas.map((s) => s.key));
    const grupos = new Map<string, { etapa: string; muestra: string; leads: Set<number> }>();
    for (const m of e.gestos.mensajes ?? []) {
      if (m.texto.length < U.mensajeMinimoLetras || !enCrm.has(m.etapa)) continue;
      const k = `${m.etapa}|${m.texto}`;
      const g = grupos.get(k) ?? { etapa: m.etapa, muestra: m.muestra, leads: new Set<number>() };
      g.leads.add(m.lead);
      grupos.set(k, g);
    }
    for (const g of [...grupos.values()].sort((a, b) => b.leads.size - a.leads.size)) {
      const n = g.leads.size;
      if (n < U.gestosMensaje) continue;
      ofrecer({
        id: `gesto-mensaje:${g.etapa}`, clase: 2, etapa: g.etapa, soloAdmin: false,
        texto: `Mandaste el mismo mensaje a ${n} leads de ${comillas(label(g.etapa))}. ¿Lo dejo como secuencia de esa etapa?`,
        accion: {
          tipo: 'chat',
          pedido: `En este CRM mandé a mano el mismo mensaje a ${n} leads de ${comillas(label(g.etapa))}: ${comillas(g.muestra)}. Ármame una automatización de esa etapa que lo mande sola.`,
        },
      });
    }
    // «Pegás el link de Fathom a mano 3 veces → conectar Fathom». Con Fathom conectado no hay nada que ofrecer, y si la
    // clase 3 ya lo pidió (reuniones sin asistencia), gana la suya (va antes).
    const pegados = e.gestos.fathomAMano ?? 0;
    if (e.conectado.fathom === false && pegados >= U.gestosFathom) {
      ofrecer({
        id: 'conectar-fathom', clase: 2, etapa: null, soloAdmin: true,
        texto: `Pegaste ${pegados} veces el link de Fathom a mano. ¿Lo conectas para que llegue solo?`,
        accion: { tipo: 'link', href: '/integraciones?abrir=fathom' },
      });
    }
  }

  // ── CLASE 4: llega algo nuevo (20/10/2026) ───────────────────────────────────
  // «El primer DM de Instagram o Messenger → que MaKo los conteste»: las plantillas que ya existen, si no hay una
  // automatización viva que ya reciba esos mensajes.
  if (e.nuevos) {
    const dm = (n: number, plantilla: string, trigger: string, red: string) => {
      if (n <= 0 || !sirve(plantilla) || existe({ donde: 'evento', plantilla, trigger, subtipo: 'dm' })) return;
      ofrecer({
        id: plantilla, clase: 4, etapa: null, soloAdmin: true,
        texto: `Te ${n === 1 ? 'escribió 1 persona' : `escribieron ${n} personas`} por ${red}. ¿Que MaKo conteste los mensajes?`,
        accion: { tipo: 'plantilla', plantilla, disparador: null },
      });
    };
    dm(e.nuevos.dmInstagram, 'instagram-te-escribieron', TRIGGER_INSTAGRAM, 'Instagram');
    dm(e.nuevos.dmMessenger, 'messenger-te-escribieron', TRIGGER_MESSENGER, 'Messenger');
    // «El primer lead de un formulario o una landing que no estaba conectado a ningún CRM → conectarlo a uno». En MaKo
    // un lead de una landing o una campaña sin asignar cae al CRM principal; el server sólo lo manda si hay otro CRM a
    // donde conectarla. Uno por landing o campaña (el id lleva su nombre: «Ahora no» calla ésa y no las demás).
    for (const f of e.nuevos.sinCrm ?? []) {
      if (f.leads <= 0) continue;
      ofrecer({
        id: idSinCrm(f.tipo, f.nombre), clase: 4, etapa: null, soloAdmin: true,
        texto: `${f.leads === 1 ? 'Llegó 1 lead' : `Llegaron ${f.leads} leads`} de la ${f.tipo} ${comillas(f.nombre)}, que no está en ningún CRM. ¿La conecto?`,
        accion: {
          tipo: 'chat',
          pedido: `La ${f.tipo} ${comillas(f.nombre)} no está conectada a ningún CRM: sus leads caen al CRM principal. ¿A qué CRM conviene conectarla? Si es a éste, conéctala.`,
        },
      });
    }
    // «Un lead que vuelve a la landing o mira el VSL dos veces → avisarle al closer». No hay disparador para «volvió»
    // (no se puede armar la automatización): con uno, su ficha; con varios, MaKo arma la lista para el closer por el chat.
    const volvieron = e.nuevos.volvieron ?? [];
    if (volvieron.length === 1) {
      const v = volvieron[0];
      ofrecer({
        id: 'volvieron', clase: 4, etapa: v.etapa, soloAdmin: false,
        texto: `${comillas(v.nombre)} volvió a mirar tu landing o el VSL. ¿Abro su ficha?`,
        accion: { tipo: 'link', href: `/crm/${v.lead}` },
      });
    } else if (volvieron.length > 1) {
      const quienes = volvieron.slice(0, 10).map((v) => `${v.nombre} (${label(v.etapa)})`).join(', ');
      ofrecer({
        id: 'volvieron', clase: 4, etapa: null, soloAdmin: false,
        texto: `${volvieron.length} leads volvieron a mirar tu landing o el VSL. ¿Te armo la lista para el closer?`,
        accion: {
          tipo: 'chat',
          pedido: `Estos leads de este CRM volvieron a la landing o miraron el VSL dos veces en las últimas dos semanas: ${quienes}${volvieron.length > 10 ? ` y ${volvieron.length - 10} más` : ''}. Ármame la lista para el closer: a quién llamar primero y qué decirle.`,
        },
      });
    }
  }

  // ── CLASE 1: el CRM armado ───────────────────────────────────────────────────
  const declaradas = e.funnel.entradas;
  if (entrada && (!declaradas.length || declaradas.some((x) => ENTRA_DEJANDO_DATOS.has(x)))) {
    enEtapa(1, 'lead-entro', entrada, `Saludar solo a quien entra a ${comillas(label(entrada))} y avisarte si no agenda`);
  }
  const reuniones = pipeline.filter((s) => s.kind === 'reunion');
  reuniones.forEach((r, i) => {
    enEtapa(1, 'lead-agendo', r.key, `Recordarle la reunión a quien llega a ${comillas(label(r.key))}`);
    // El No Show de esa reunión, por la TRANSICIÓN (nunca por una key literal): sólo la R1 y la R2
    // tienen columnas donde marcar la asistencia.
    if (i > 1) return;
    const noShow = etapaNoShowDe(e.etapas as Stage[], e.transiciones as FunnelTransition[], r.key, i === 0 ? 'r1' : 'r2');
    if (noShow) enEtapa(1, 'lead-no-asistio', noShow, `Escribirle para reagendar a quien cae en ${comillas(label(noShow))}`);
  });
  for (const p of pipeline.filter((s) => s.kind === 'pago')) {
    enEtapa(1, 'lead-confirmo-compra', p.key, `Seguir a quien llega a ${comillas(label(p.key))} y todavía no paga`);
  }
  if (e.etapas.some((s) => s.key === TERMINAL_DEL_PIPELINE) && sirve('cliente-empezo')
    && !existe({ donde: 'entrega', plantilla: 'cliente-empezo', productoId: e.funnel.productoId })) {
    // El CRON de «Un Cliente Empezó» es la ENTREGA del producto (`pide: 'etapa_entrega'`): su primera
    // etapa. Sin producto o sin entrega, nace con el CRON a elegir y se elige en el lienzo.
    const primera = e.funnel.productoId != null ? e.funnel.etapasEntrega[0] ?? null : null;
    ofrecer({
      id: 'cliente-empezo', clase: 1, etapa: TERMINAL_DEL_PIPELINE, soloAdmin: true,
      texto: `Darle la bienvenida a quien llega a ${comillas(label(TERMINAL_DEL_PIPELINE))}`,
      accion: { tipo: 'plantilla', plantilla: 'cliente-empezo', disparador: primera ? `entrega:${e.funnel.productoId}:${primera}` : null },
    });
  }
  for (const [key, dias] of Object.entries(e.plazos)) {
    if (!plazoNoAvanzo || !e.etapas.some((s) => s.key === key) || !(dias > 0)) continue;
    enEtapa(1, 'lead-no-avanzo', key, conEtapa((et) => `Avisarte si un lead pasa ${plazoNoAvanzo} en ${et}`, label(key)));
  }
  if (e.cuotas && e.cuotas.pendientes > 0) cobranza(1, 'Avisarte cuando vence una cuota sin cobrar');

  return out.slice(0, Math.max(0, tope));
}

// ── «Ahora no» y lo ya hecho: lo que se calla, por CRM ───────────────────────

/** La clave de `app_settings` (por workspace) con lo callado de todos sus CRM. */
export const CLAVE_CALLADAS = 'crm.sugerencias.calladas';
/** Cuántas entradas guarda como mucho (las más nuevas): un CRM no tiene cien sugerencias. */
export const TOPE_CALLADAS = 200;

/** `<embudo>|<sugerencia>`: lo callado en un CRM no calla la misma en otro. */
export const claveCallada = (funnelId: number, sugerenciaId: string): string => `${funnelId}|${sugerenciaId}`;

/** Lo guardado, saneado: clave → hasta cuándo (ISO). Lo que no se entiende se descarta. */
export function parsearCalladas(raw: string | null | undefined): Record<string, string> {
  let j: unknown;
  try { j = JSON.parse(String(raw ?? '')); } catch { return {}; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
    const [crm, id] = k.split('|');
    if (/^\d+$/.test(crm ?? '') && ID_SUGERENCIA.test(id ?? '') && k.split('|').length === 2 && typeof v === 'string' && Number.isFinite(Date.parse(v))) out[k] = v;
  }
  return out;
}

/** El mapa con una más (hasta `ahora + dias`), sin las vencidas y con su tope. */
export function conCallada(mapa: Readonly<Record<string, string>>, clave: string, dias: number, ahora: number): Record<string, string> {
  const vivas = Object.entries(mapa).filter(([k, v]) => k !== clave && Date.parse(v) > ahora);
  vivas.push([clave, new Date(ahora + dias * DIA_MS).toISOString()]);
  vivas.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
  return Object.fromEntries(vivas.slice(0, TOPE_CALLADAS));
}

/** ¿Está callada (y sin vencer) esta clave? */
export const estaCallada = (mapa: Readonly<Record<string, string>>, clave: string, ahora: number): boolean => {
  const hasta = mapa[clave];
  return !!hasta && Date.parse(hasta) > ahora;
};

/**
 * «Volver a mostrar»: el mapa SIN esa clave (y sin las vencidas). Deshace el «Ahora no» en ESE CRM
 * sólo: la misma sugerencia callada en otro CRM sigue callada.
 */
export function sinCallada(mapa: Readonly<Record<string, string>>, clave: string, ahora: number): Record<string, string> {
  return Object.fromEntries(Object.entries(mapa).filter(([k, v]) => k !== clave && Date.parse(v) > ahora));
}

/**
 * Las que siguen a la vista en ESTE CRM, cuántas se callaron y CUÁLES (con hasta cuándo), en el orden
 * del motor: lo callado se ve y se deshace («Calladas» en el panel, `sugerencias_crm` en la API).
 */
export function sinCalladas<S extends Pick<Sugerencia, 'id'>>(sugs: readonly S[], mapa: Readonly<Record<string, string>>, funnelId: number, ahora: number): { visibles: S[]; calladas: number; lista: Array<{ s: S; hasta: string }> } {
  const visibles: S[] = [];
  const lista: Array<{ s: S; hasta: string }> = [];
  for (const s of sugs) {
    const clave = claveCallada(funnelId, s.id);
    if (estaCallada(mapa, clave, ahora)) lista.push({ s, hasta: mapa[clave] });
    else visibles.push(s);
  }
  return { visibles, calladas: lista.length, lista };
}

// ── «Hacerlo»: el candado vive en la BASE, no en la memoria del proceso ──────

/**
 * UN CLIC, UNA VEZ (6/11/2026, #514). «Hacerlo» se guardaba de los dobles clics con un `Set` a nivel
 * de módulo, y eso es POR PROCESO: dos pestañas (o dos instancias serverless) pasaban las dos y la
 * acción se hacía DOS veces — al cliente le quedaban dos automatizaciones, o dos mensajes, por un solo
 * clic. Ahora se reclama en `app_settings` con compare-and-set (`cambiarSettingSi`, lib/settings.ts):
 * es atómico en la base, así que de dos requests gana UNO lo atienda el proceso que lo atienda. Es el
 * mismo molde que la marca de un pedido de difusión (lib/difusion.ts).
 *
 * LA CLAVE lleva el CRM y la sugerencia (`claveCallada`): dos sugerencias distintas no se tapan entre
 * sí, y lo que se está haciendo en un CRM no frena el mismo botón en otro. NO lleva el workspace a
 * propósito — `app_settings` tiene PK (workspace_id, key) y `cambiarSettingSi` escribe con el ws del
 * request (`wsObligatorio`), así que el candado de un negocio no puede chocar con el de otro.
 */
export const claveHaciendo = (funnelId: number, sugerenciaId: string): string => `crm.sugerencias.haciendo:${claveCallada(funnelId, sugerenciaId)}`;

/**
 * CUÁNTO VIVE EL CANDADO. Un candado que no vence es un candado sin llave: si el proceso se muere con
 * él puesto (Vercel corta la función, se cae la instancia) nadie lo suelta y la sugerencia queda muerta
 * PARA SIEMPRE — peor que el defecto que arregla. Diez minutos porque el techo de la ruta que lo usa
 * son siete (`maxDuration = 420`, app/api/crm/mako/route.ts): más que eso, así que ningún pedido vivo
 * puede perder su candado mientras trabaja, y poco como para que la sugerencia vuelva sola.
 */
export const CANDADO_HACERLO_MS = 10 * 60_000;

/**
 * ¿El candado guardado sigue vivo? El valor ES el instante en que se puso (ISO), y por eso un candado
 * se puede soltar comparándolo (`borrarSettingSi`): lo vencido y lo ilegible no frenan a nadie.
 */
export function haciendoseAhora(raw: string | null | undefined, ahora: number): boolean {
  const t = Date.parse(String(raw ?? ''));
  return Number.isFinite(t) && ahora - t < CANDADO_HACERLO_MS;
}
