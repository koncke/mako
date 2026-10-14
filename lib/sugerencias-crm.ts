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

import { disparadoresDe, TRIGGER_AVISO_MAKO, type FilaDisparadores } from './disparadores';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA } from './nutricion-etapa';
import { PLANTILLAS, PLANTILLAS_REEMPLAZADAS, plantillaPorId, canalesDe } from './plantillas-automatizaciones';
import { etapaNoShowDe, TERMINAL_DEL_PIPELINE, type FunnelTransition, type Stage } from './pipeline';
import { etapaDeEntrada } from './lead-funnel-reglas';

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
};

export type AccionSugerencia =
  | { tipo: 'plantilla'; plantilla: string; disparador: string | null }
  | { tipo: 'link'; href: string }
  | { tipo: 'chat'; pedido: string };

export type Sugerencia = {
  /** estable: `<plantilla>:<etapa>` o el nombre de la situación. Es lo que se calla. */
  id: string;
  clase: 1 | 3;
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
export type SugerenciaDePantalla = {
  id: string; clase: 1 | 3; texto: string;
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

const DIA_MS = 86_400_000;
const dia = (s: string | null | undefined): string => String(s ?? '').slice(0, 10);
const comillas = (s: string) => `«${s.trim()}»`;
const corto = (s: string): string => (s.length <= TOPE_TEXTO ? s : `${s.slice(0, TOPE_TEXTO - 1).trimEnd()}…`);

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
  /** Una de clase 1 o 3 que crea la plantilla en una etapa de VENTA de este CRM. */
  const enEtapa = (clase: 1 | 3, plantilla: string, etapa: string, texto: string) => {
    if (!sirve(plantilla) || existe({ donde: 'venta', plantilla, funnelId: e.funnel.id, etapa })) return;
    ofrecer({ id: `${plantilla}:${etapa}`, clase, texto, etapa, accion: { tipo: 'plantilla', plantilla, disparador: venta(etapa) }, soloAdmin: true });
  };
  const cobranza = (clase: 1 | 3, texto: string) => {
    if (existe({ donde: 'evento', plantilla: 'mako-cobranza', trigger: TRIGGER_AVISO_MAKO, subtipo: 'cuota_vencida' })) return;
    ofrecer({ id: 'mako-cobranza', clase, texto, etapa: null, accion: { tipo: 'plantilla', plantilla: 'mako-cobranza', disparador: null }, soloAdmin: true });
  };

  const entrada = etapaDeEntrada(pipeline);
  const leads = e.leads;

  // ── CLASE 3: el tablero ──────────────────────────────────────────────────────
  if (leads) {
    if (entrada) {
      const dias = diasParadosDe(e.funnel.canal, e.funnel.entradas);
      const parados = leads.filter((l) => l.etapa === entrada && l.creado && e.ahora - Date.parse(l.creado) > dias * DIA_MS).length;
      if (parados >= U.paradosMinimo) {
        enEtapa(3, 'lead-no-avanzo', entrada, `${parados} leads parados en ${comillas(label(entrada))} hace más de ${dias} días. ¿Te aviso?`);
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
    if (!e.etapas.some((s) => s.key === key) || !(dias > 0)) continue;
    enEtapa(1, 'lead-no-avanzo', key, `Avisarte si un lead se queda en ${comillas(label(key))} más de lo previsto`);
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
    if (/^\d+\|[a-z0-9:_-]{1,120}$/i.test(k) && typeof v === 'string' && Number.isFinite(Date.parse(v))) out[k] = v;
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

/** Las que siguen a la vista en ESTE CRM, y cuántas se callaron. */
export function sinCalladas<S extends Pick<Sugerencia, 'id'>>(sugs: readonly S[], mapa: Readonly<Record<string, string>>, funnelId: number, ahora: number): { visibles: S[]; calladas: number } {
  const visibles = sugs.filter((s) => {
    const hasta = mapa[claveCallada(funnelId, s.id)];
    return !(hasta && Date.parse(hasta) > ahora);
  });
  return { visibles, calladas: sugs.length - visibles.length };
}
