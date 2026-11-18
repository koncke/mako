// =============================================================================
// cerebro-grafo — el grafo del NEGOCIO del cliente (lo que MaKo entendió)
// =============================================================================
// ⚠️ NO confundir con /api/admin/graph: ése es el grafo del CÓDIGO FUENTE de MaKo
// (graphify, 4,1 MB, 4.440 nodos que son archivos .ts, gateado a super-admin). Es
// una herramienta de desarrollo y jamás se le muestra a un cliente: enseñarle la
// ingeniería interna en el momento en que esperaba ver su negocio es el opuesto
// exacto del efecto buscado. Ver docs/hallazgos-onboarding.md.
//
// Acá se arma el otro: un nodo por cada COSA QUE MAKO ENTENDIÓ del negocio, con
// de dónde la sacó. La regla que gobierna todo el módulo:
//
//   UN NODO ES UNA COSA QUE ALGUIEN PUEDE SEÑALAR Y DECIR «ESO ES MÍO».
//
// De ahí salen las tres decisiones que más importan, y las tres son de RESTA:
//  · Un atributo NO es un nodo. El copy de una razón, los 10 rasgos de voz y los
//    9 guiones son campos de otra cosa: van al hover, no al lienzo. Convertir
//    cada atributo en nodo triplica el conteo y divide el significado.
//  · El catálogo de MaKo NO es del cliente. Los 14 formatos de la biblioteca son
//    iguales para todos: solo entran los que ESTE negocio usa.
//  · Una razón y una celda de la matriz son la MISMA fila (RazonCelda). Pintarlas
//    como dos tipos de nodo son 9 nodos inventados.
//
// Y una exclusión que es una deuda, no un criterio: las 17 etapas del funnel
// quedan afuera hasta que se arregle app/api/onboarding/route.ts:252, que aplica
// FUNNEL_TEMPLATES[0] hardcodeada sin mirar el canal que el cliente declaró.
// Mostrarle dos etapas de «Reunión» a alguien que eligió «carrito», en la única
// pantalla cuyo argumento entero es «esto es tuyo», es peor que no mostrar nada.
//
// El aislamiento por workspace NO se resuelve acá: todos los getters que se usan
// pasan por getSetting/getTenantDb, que scopean con wsActual(). Este módulo no
// toca Supabase directo a propósito — si algún día lo hiciera, tendría que
// filtrar por workspace_id a mano, que es justo el error que la casa persigue.
// =============================================================================

// ⚠️ DESDE EL 18/11/2026 ESTE ARCHIVO LEE Y lib/cerebro-armado.ts ARMA (F109). Lo de acá abajo son las lecturas; los
// nodos y las aristas salen de `armarCerebro`, que es puro y lo prueba tests/cerebro-topologia.test.ts con las métricas
// de scripts/medir-grafo.mjs. Un nodo nuevo se arma allá; si necesita una lectura nueva, se lee acá y se le pasa.

import 'server-only';
import { getSchema, DEFAULT_SCHEMA } from './onboarding';
import { getDiagnosticoFase } from './fase-store';
import { listFiles, getManual, getPanorama } from './archivero';
import { listProductos } from './productos';
import { getEntregables } from './entregable';
import { getAvatares } from './avatares';
import { getRazones } from './razones';
import { getPersona } from './persona';
import { getPersonalidad } from './personalidad-store';
import { KEY_KITS } from './marca/kits';
import { layoutCerebro } from './cerebro-layout';
import { getFunnelDefault } from './funnels';
import { getSecuenciasActivas } from './nutricion';
import { landingsParaCerebro } from './landing-analyst';
import { listAudios } from './setting-audios';
import { getManual as getVozManual, getEvidencia as getVozEvidencia } from './chat-agent-voz';
import { listKnowledge } from './mako-knowledge';
import { getSetting } from './settings';
import { getTenantDb } from './workspace';
import { listarOfertas, productosDeOfertas, ofertasDeFunnels, listarLeadMagnets } from './ofertas';
import { listarFunnels } from './funnels';
import { listLeads } from './leads';
import { conteoPorEtapa } from './api-mako/areas/crm.helpers';
import { quarterActual, listObjectives, listKpis } from './objectives';
import { listarSesionesOffer } from './offer-sesiones';
import { LECTURAS_VACIAS, TOPES_VIVOS, type ChatMakoVivo, type ClientesVivos, type ConteoLeads, type FechasDeAlta, type LecturasVivas, type ReunionViva } from './cerebro-vivo';
import { armarCerebro } from './cerebro-armado';

// ── El modelo ────────────────────────────────────────────────────────────────
// Vive en `cerebro-modelo.ts`, SIN `server-only`, porque el componente que dibuja
// el grafo corre en el browser y necesita los tipos y las áreas. Si se trae acá,
// el bundle del cliente se lleva puesta la cadena productos → workspace → auth →
// next/headers y la compilación se cae. Ver la cabecera de ese archivo.
export { AREAS } from './cerebro-modelo';
export type { AreaId, Autoria, NodoCerebro, AristaCerebro, Cerebro } from './cerebro-modelo';

import type { NodoCerebro, AristaCerebro, Cerebro } from './cerebro-modelo';

// ── Lo vivo del negocio (punto 13, 17/10/2026): Offer, los funnels, los leads, los OKR/KPI y los chats ─────────
// Cada lectura con su `.catch()` a vacío, como las secundarias de abajo: una fuente que falle no deja sin mapa a
// nadie. Lo que se HACE con esto vive en lib/cerebro-vivo.ts (puro, probado sin base).

/** Las tablas cuyo `created_at` se lee para el `nace` de cada nodo. */
const TABLAS_CON_FECHA = ['ofertas', 'productos', 'lead_magnets', 'funnels', 'objectives', 'kpis', 'offer_sesiones'] as const;

/** El `created_at` de cada fila, por tabla. Una lectura chica por tabla (`id, created_at`), en paralelo. */
async function fechasDeAlta(): Promise<FechasDeAlta> {
  const db = await getTenantDb();
  const out: FechasDeAlta = {};
  await Promise.all(TABLAS_CON_FECHA.map(async (t) => {
    try {
      const { data, error } = await db.from(t).select('id, created_at').order('id', { ascending: false }).limit(500);
      if (error) return;
      out[t] = Object.fromEntries(((data ?? []) as Array<{ id: unknown; created_at: unknown }>)
        .filter((r) => typeof r.created_at === 'string').map((r) => [String(r.id), r.created_at as string]));
    } catch { /* sin fecha: el nodo va con `nace` null, nunca con una inventada */ }
  }));
  return out;
}

/** Los leads de hoy, contados con la MISMA regla que el CRM (`conteoPorEtapa`) más los nuevos de 7 días. */
async function contarLeads(): Promise<ConteoLeads | null> {
  const [c, leads] = await Promise.all([conteoPorEtapa(), listLeads()]);
  const desde = Date.now() - 7 * 86_400_000;
  return {
    total: c.total_leads,
    nuevos7d: leads.filter((l) => Date.parse(l.created_at) >= desde).length,
    sinAsignar: c.sin_closer_ni_setter,
    porEtapa: c.etapas.map((e) => ({ key: e.key, leads: e.leads })),
    origenes: c.origenes,
  };
}

/** Los CLIENTES (18/10/2026): los leads con la venta GANADA, que es la definición de «cliente» de todo el producto
 *  (lib/clientes-ganados.ts). Una lectura con tope: el total exacto y los más recientes, nunca los cientos. */
async function leerClientes(): Promise<ClientesVivos | null> {
  const db = await getTenantDb();
  const { data, count, error } = await db.from('leads')
    .select('id, nombre, empresa, fecha_cierre, venta_tipo', { count: 'exact' })
    .eq('estado_lead', 'ganado')
    .order('fecha_cierre', { ascending: false, nullsFirst: false })
    .limit(TOPES_VIVOS.clientes);
  if (error) return null;
  const filas = (data ?? []) as Array<{ id: number; nombre: string | null; empresa: string | null; fecha_cierre: string | null; venta_tipo: string | null }>;
  return {
    total: count ?? filas.length,
    recientes: filas.map((f) => ({ leadId: f.id, nombre: (f.nombre ?? '').trim(), empresa: f.empresa, fechaCierre: f.fecha_cierre, sinCobro: f.venta_tipo === 'sin_cobro' })),
  };
}

/** Las REUNIONES DE VENTA que el Closing Analyst ya leyó (`closing_analyses`, mig 0037): las más recientes. */
async function leerReuniones(): Promise<ReunionViva[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('closing_analyses')
    .select('recording_id, lead_id, lead_nombre, title, started_at, call_date, tipo, closer, score, outcome, summary, duration_min')
    .eq('status', 'analizada')
    .eq('category', 'venta')
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(TOPES_VIVOS.reuniones);
  if (error) return [];
  type Fila = { recording_id: number; lead_id: number | null; lead_nombre: string | null; title: string | null; started_at: string | null; call_date: string | null; tipo: string | null; closer: string | null; score: number | string | null; outcome: string | null; summary: string | null; duration_min: number | null };
  return ((data ?? []) as Fila[]).map((f) => ({
    id: f.recording_id, leadId: f.lead_id, leadNombre: f.lead_nombre, titulo: f.title, fecha: f.started_at ?? f.call_date, tipo: f.tipo,
    closer: f.closer, score: f.score == null ? null : Number(f.score), outcome: f.outcome, resumen: f.summary, duracionMin: f.duration_min,
  }));
}

/** Un `.catch` que devuelve el vacío de esa lectura y AVISA (28/10/2026): el grafo de los chats (lib/cerebro-para-chat.ts) no
 *  guarda en caché uno armado con una lectura caída. La pantalla no pasa `alFallar`: se degrada como siempre. */
const vacioAvisando = <T>(alFallar: ((fuente: string) => void) | undefined, fuente: string, vacio: T) => (): T => { alFallar?.(fuente); return vacio; };

async function leerLoVivo(chatsMako?: ChatMakoVivo[], alFallar?: (fuente: string) => void): Promise<LecturasVivas> {
  const [ofertas, ligasProducto, ligasFunnel, leadMagnets, funnels, leads, objetivos, kpis, chatsOffer, fechas, clientes, reuniones] = await Promise.all([
    listarOfertas(true).catch(vacioAvisando(alFallar, 'listarOfertas', [])),
    productosDeOfertas().catch(vacioAvisando(alFallar, 'productosDeOfertas', [])),
    ofertasDeFunnels().catch(vacioAvisando(alFallar, 'ofertasDeFunnels', [])),
    listarLeadMagnets().catch(vacioAvisando(alFallar, 'listarLeadMagnets', [])),
    listarFunnels().catch(vacioAvisando(alFallar, 'listarFunnels', [])),
    contarLeads().catch(vacioAvisando(alFallar, 'contarLeads', null)),
    quarterActual().then(({ qt }) => listObjectives(qt)).catch(vacioAvisando(alFallar, 'quarterActual', [])),
    listKpis(true).catch(vacioAvisando(alFallar, 'listKpis', [])),
    listarSesionesOffer().catch(vacioAvisando(alFallar, 'listarSesionesOffer', [])),
    fechasDeAlta().catch(vacioAvisando(alFallar, 'fechasDeAlta', ({}))),
    leerClientes().catch(vacioAvisando(alFallar, 'leerClientes', null)),
    leerReuniones().catch(vacioAvisando(alFallar, 'leerReuniones', [])),
  ]);
  return {
    ...LECTURAS_VACIAS,
    clientes, reuniones,
    ofertas: ofertas.map((o) => ({ ...o, bonos: (o.bonos ?? []).map((b) => ({ nombre: (b as { nombre?: string | null }).nombre ?? null })) })),
    ligasProducto, ligasFunnel, leadMagnets,
    funnels: funnels.map((f) => ({ id: f.id, nombre: f.nombre, canal: f.canal, esDefault: f.esDefault })),
    leads,
    objetivos: objetivos.map((o) => ({ id: o.id, titulo: o.titulo, metrica: o.metrica, metaValor: o.metaValor, unidad: o.unidad, quarter: o.quarter, anio: o.anio, funnelIds: o.funnelIds })),
    kpis: kpis.map((k) => ({ id: k.id, nombre: k.nombre, objectiveId: k.objectiveId, compromiso: k.compromiso, unidad: k.unidad, cadencia: k.cadencia, funnelIds: k.funnelIds })),
    chatsOffer: chatsOffer.map((c) => ({ id: c.id, titulo: c.titulo, estado: String(c.estado), updatedAt: c.updatedAt })),
    chatsMako,
    fechas,
  };
}

/**
 * @param opciones.chatsMako los chats con MaKo de QUIEN MIRA. Sólo los pasa la pantalla (app/second-brain/pagina.tsx):
 *   son de la persona y no del negocio, así que el ZIP y la API —que no tienen persona— arman el grafo sin ellos, y
 *   eso es a propósito (no es el «parámetro opcional que sólo pasa uno» que se advierte abajo para el funnel).
 */
export async function construirCerebro(opciones: { chatsMako?: ChatMakoVivo[]; sinLayout?: boolean; alFallar?: (fuente: string) => void } = {}): Promise<Cerebro> {
  // ⚠️ El funnel se LEE ACÁ ADENTRO y no entra por parámetro, aunque la página ya lo
  // tenga a mano. `construirCerebro()` tiene DOS llamadores —la pantalla y la ruta que
  // arma el ZIP— y un parámetro opcional que solo pasara uno dejaría el vault sin funnel
  // en silencio, que es la clase de bug que este repo ya pagó varias veces. Va en el
  // mismo Promise.all, así que no suma latencia, y `getFunnelDefault()` nunca lanza.
  const [schema, diag, files, manual, panorama, productos, entregables, avatares, razones, persona, personalidad, funnel, secuencias, landings, audios, vozManual, vozEvidencia, glosario, vivo, kitsCrudo] = await Promise.all([
    getSchema(),
    getDiagnosticoFase(),
    listFiles(),
    getManual(),
    getPanorama(),
    listProductos(),
    getEntregables(),
    getAvatares(),
    getRazones(),
    getPersona(),
    getPersonalidad(),
    getFunnelDefault(),
    // Las lecturas nuevas van con `.catch()` a un valor vacío: una fuente secundaria que
    // falle NO puede dejar sin mapa a un cliente. El grafo se degrada, no se cae.
    getSecuenciasActivas().catch(vacioAvisando(opciones.alFallar, 'getSecuenciasActivas', [])),
    landingsParaCerebro().catch(vacioAvisando(opciones.alFallar, 'landingsParaCerebro', [])),
    listAudios().catch(vacioAvisando(opciones.alFallar, 'listAudios', [])),
    getVozManual().catch(vacioAvisando(opciones.alFallar, 'getVozManual', ({} as Record<string, string>))),
    getVozEvidencia().catch(vacioAvisando(opciones.alFallar, 'getVozEvidencia', null)),
    listKnowledge().catch(vacioAvisando(opciones.alFallar, 'listKnowledge', [])),
    // ⚠️ Los settings viejos del objetivo (`objetivo_cierres`, `objetivo_cash_usd`) ya NO se leen acá (F82, 18/11/2026): la
    // meta sale de `objectives`, que lee lo vivo (`leerLoVivo` → `listObjectives`). Ver «D1» en lib/cerebro-armado.ts.
    leerLoVivo(opciones.chatsMako, opciones.alFallar).catch(vacioAvisando(opciones.alFallar, 'leerLoVivo', ({ ...LECTURAS_VACIAS, chatsMako: opciones.chatsMako }))),
    // La marca del negocio (5/11/2026, lib/marca/kits.ts): sus kits de colores, fuentes y logo.
    getSetting(KEY_KITS).catch(vacioAvisando(opciones.alFallar, 'getSetting', null)),
  ]);

  // El armado es PURO (lib/cerebro-armado.ts): todo lo leído entra junto, y de ahí salen los nodos y las aristas. Los
  // racimos sueltos ya vienen enganchados a la raíz (`puentesARaiz`, adentro del armado), ANTES de este layout.
  const armado = armarCerebro({
    schema, schemaPorDefecto: DEFAULT_SCHEMA, diag, files, manual, panorama, productos, entregables, avatares, razones, persona,
    personalidad, funnel, secuencias, landings, audios, vozManual, vozEvidencia, glosario, vivo, kitsCrudo,
  });
  const { nodos, aristas } = armado;
  // Un CHAT no usa posiciones (lib/cerebro-para-chat.ts): sin la física (400 ticks de d3) el grafo sale en lo que tardan
  // las lecturas.
  const { posiciones, encuadre } = opciones.sinLayout ? { posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 } } : layoutCerebro(nodos, aristas);
  return {
    ...armado,
    posiciones,
    encuadre,
    huella: huellaDeContenido(nodos, aristas),
  };
}

/** La huella del CONTENIDO del grafo (FNV-1a sobre ids, nombres, textos, datos y aristas): el grafo vivo de la
 *  pantalla la compara para no redibujar lo que no cambió. No es la de `huellaDe` (cerebro-layout.ts), que mira sólo
 *  ids y aristas porque es la del dibujo. */
export function huellaDeContenido(nodos: NodoCerebro[], aristas: AristaCerebro[]): string {
  const s = JSON.stringify([
    nodos.map((n) => [n.id, n.etiqueta, n.detalle, n.datos ?? null, n.cuerpo ?? null, n.autoria]),
    aristas.map((a) => [a.de, a.a, a.motivo]),
  ]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
