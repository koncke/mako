// =============================================================================
// sugerencias-crm-server — las sugerencias de MaKo de UN CRM: leer, calcular UNA vez, hacer, callar
// =============================================================================
// El motor es puro (lib/sugerencias-crm.ts); esto le junta los datos, guarda el resultado y aplica lo
// que la persona decide. Lo usan la ruta del chat del CRM (app/api/crm/mako/route.ts) y la lectura
// `sugerencias_crm` de la API de MaKo (lib/api-mako/areas/crm.run.ts): las dos ven lo MISMO.
//
// ⚠️ LO CARO VA ACÁ, UNA VEZ Y CACHEADO, NUNCA EN EL RENDER DE /crm. Calcular lee los leads del CRM,
// las automatizaciones, el funnel, las cuotas y dos conexiones: es la carga del tablero otra vez. La
// página no lo llama; lo pide el botón plegado UNA vez al montarse y el resultado queda `TTL_MS` en
// memoria, por workspace y por CRM (AGENTS.md, «Una caché en memoria del server es de TODOS los
// inquilinos del proceso»: el `ws` va en la clave).
//
// ⚠️ LO CALLADO NO SE CACHEA: se lee de `app_settings` en cada pedido (una fila) y se aplica sobre lo
// calculado. Con eso «Ahora no» y lo recién hecho se ven en TODAS las instancias del server, no sólo en
// la que atendió el clic (cada instancia tiene su propia caché). Y lo callado VUELVE: viaja aparte
// (`calladas`, lo que se vería si no estuviera callado) y «Volver a mostrar» (`volverAMostrar`) lo saca
// del mapa con el mismo compare-and-set con que «Ahora no» lo puso.
//
// ⚠️ «HACERLO» CALCULA DE NUEVO, SIN CACHÉ, y crea sólo lo que la cuenta fresca todavía sugiere: la
// pantalla manda el ID de la sugerencia, nunca la plantilla ni la etapa (un cliente no elige qué se
// crea). Con eso, dos pestañas o una caché vieja no duplican una automatización: la segunda vez la
// cuenta fresca ya la ve (`yaExiste`) y contesta que la sugerencia ya no aplica. La automatización
// entra por la puerta de la galería (`crearDesdePlantilla`, lib/plantilla-crear.ts) con las mismas
// piezas que POST /api/chat-agent/secuencias `crear_desde_plantilla`: NACE PAUSADA.
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { leerFunnels, getFunnelDefault, getFunnelDe, umbralesDe, productoDeFunnel } from '@/lib/funnels';
import { listLeadsDeFunnel, type Lead } from '@/lib/leads';
import { cobradoDeLaVenta } from '@/lib/pagos-crm';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { sanearPlazosPorEtapa } from '@/lib/crm-auto-plan';
import { getDiagnosticoFase } from '@/lib/fase-store';
import { canalEfectivo } from '@/lib/fase-diagnostico';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { entregasDeProductos } from '@/lib/entrega-servicio';
import type { EntregaConfig } from '@/lib/servicio-etapas';
import { leerTodo, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { CAMPO_ETAPA } from '@/lib/etapa-historial';
import { hayGrabadorConectado } from '@/lib/grabadores';
import { estadoMedios } from '@/lib/disparadores-canales';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { hoyEnTz } from '@/lib/date-utils';
import { getSettingEstricto, cambiarSettingSi, borrarSettingSi } from '@/lib/settings';
import { esColumnaInexistente } from '@/lib/nutricion-grafo-motor';
import { crearDesdePlantilla, PlantillaInvalidaError, type DbPlantilla } from '@/lib/plantilla-crear';
import { guardarConfigAutomatizacion } from '@/lib/config-automatizacion-db';
import { setSecuenciaPasos, PasosInvalidosError } from '@/lib/nutricion';
import { guardarDisparadores } from '@/lib/disparadores-guardar';
import { TriggerInvalidoError } from '@/lib/setting-secuencias';
import { plantillaPorId } from '@/lib/plantillas-automatizaciones';
import { CONFIG_KEY as CLAVE_LANDINGS, parsearConfig, funnelIdsDeLanding } from '@/lib/landing-config';
import { leerCampanasAsignadasEstricto } from '@/lib/campana-funnel';
import { funnelIdDeCampana } from '@/lib/campana-config';
import { TERMINAL_DEL_PIPELINE } from '@/lib/pipeline';
import { conversacionesSocialesNuevas, salientesSocialesDesde } from '@/lib/canal-zernio';
import { esPreviewDeEditor } from '@/lib/landing-paginas';
import {
  sugerenciasDelCrm, sinCalladas, parsearCalladas, conCallada, sinCallada, estaCallada, claveCallada,
  CLAVE_CALLADAS, UMBRALES_SUGERENCIAS, textoComparable, claveHaciendo, haciendoseAhora,
  type AutomatizacionSug, type EntradaSugerencias, type LeadSug, type Sugerencia,
} from '@/lib/sugerencias-crm';

/** Cuánto vive lo calculado. La clase 3 del mapa se mira «una vez por día»; la 1, «en el momento»: diez
 *  minutos es lo que tarda en aparecer la sugerencia de una etapa recién creada. */
const TTL_MS = 10 * 60_000;

// ── El CRM ───────────────────────────────────────────────────────────────────

export type CrmDeLaPantalla = { id: number; esDefault: boolean; nombre: string };

/**
 * El CRM que se pidió, validado contra los de ESTE workspace con la regla de /crm (app/crm/page.tsx):
 * un id que no es de acá (o el del negocio) es el del negocio. null = el workspace no tiene ninguno.
 * Si la lectura FALLA, tira: «no pude leer» no es «no hay».
 */
export async function crmDeLaPantalla(pedido: number | null): Promise<CrmDeLaPantalla | null> {
  const funnels = await leerFunnels();
  if (!funnels) throw new Error('no pude leer los CRM del negocio');
  const f = funnels.find((x) => x.id === pedido && !x.esDefault) ?? funnels.find((x) => x.esDefault) ?? funnels[0] ?? null;
  return f ? { id: f.id, esDefault: f.esDefault, nombre: nombreVisible(f) } : null;
}

// ── La foto del CRM (lo que también lee MaKo) ────────────────────────────────

export type FotoCrm = {
  crm: { id: number; nombre: string; principal: boolean; canal: string | null; entradas: string[] };
  /** las etapas del tablero en orden, con cuántos leads tiene cada una (null = no se pudieron contar) */
  etapas: Array<{ key: string; label: string; tipo: string | null; banda: string; leads: number | null }>;
  total_leads: number | null;
  /** cuántas automatizaciones vivas hay en el negocio (null = no se pudieron leer) */
  automatizaciones: number | null;
};

export type SugerenciasDeUnCrm = {
  crm: CrmDeLaPantalla;
  foto: FotoCrm;
  sugerencias: Sugerencia[];
  /**
   * Las calladas en ESTE CRM («Ahora no» o recién hechas) que hoy se verían, en el orden del motor y
   * con hasta cuándo. null = lo callado no se pudo leer (no es «no hay»): se muestra todo.
   */
  calladas: Array<{ sugerencia: Sugerencia; hasta: string }> | null;
  calculadoAt: string;
};

type Calculo = { at: number; crm: CrmDeLaPantalla; foto: FotoCrm; todas: Sugerencia[] };

/** La caché: de TODOS los inquilinos del proceso, por eso el `ws` va en la clave. */
const CACHE: Map<string, Calculo> = ((globalThis as { __sugerenciasCrm?: Map<string, Calculo> }).__sugerenciasCrm ??= new Map());
const claveCache = (ws: number, crmId: number) => `${ws}:${crmId}`;

/** Lo que se ve de una automatización para saber dónde arranca (sin `etapas`/`disparadores` si la base es vieja). */
const COLS_AUTOM = 'id, nombre, clave, trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id, etapas, disparadores';
const COLS_AUTOM_VIEJAS = 'id, nombre, clave, trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id';

/** Las automatizaciones VIVAS del negocio. Tira si no se pueden leer: sin ellas no se sabe qué existe. */
async function automatizacionesVivas(): Promise<AutomatizacionSug[]> {
  const db = await getTenantDb();
  const pedir = (cols: string) => db.from('nutricion_secuencias').select(cols).is('archivada_at', null).order('id');
  let r = await pedir(COLS_AUTOM);
  // La lista de CRON (0241) y las etapas (0230): sin ellas, el primer CRON de cada una (lo de siempre).
  if (r.error && esColumnaInexistente(r.error)) r = await pedir(COLS_AUTOM_VIEJAS);
  if (r.error) throw new Error(`automatizaciones: ${r.error.message}`);
  return (r.data ?? []) as unknown as AutomatizacionSug[];
}

/** Las cuotas sin pagar de estos leads: cuántas vencieron y cuántas hay. Tira si no se pueden leer. */
async function cuotasDe(leadIds: ReadonlySet<number>, hoy: string): Promise<{ vencidas: number; pendientes: number }> {
  if (!leadIds.size) return { vencidas: 0, pendientes: 0 };
  // Paginado: una cartera con planes de 6 cuotas pasa las 1.000 filas, y PostgREST corta en silencio.
  const filas = await leerTodo<{ lead_id: number; fecha_esperada: string | null }>(await getTenantDb(), 'pagos', 'id, lead_id, fecha_esperada', {
    orden: 'id', eq: { pagado: false }, filtros: (q) => q.not('fecha_esperada', 'is', null) as unknown as ConsultaPaginada,
  });
  let vencidas = 0; let pendientes = 0;
  for (const f of filas) {
    if (!leadIds.has(Number(f.lead_id))) continue;
    pendientes++;
    if (String(f.fecha_esperada ?? '').slice(0, 10) < hoy) vencidas++;
  }
  return { vencidas, pendientes };
}

/**
 * CLASE 2 (20/10/2026): los gestos A MANO de una PERSONA en estos leads, en los últimos `gestosDias` días: los cambios de
 * etapa y los «No asistió» a la R1 del historial (`lead_audit`). Una persona firma con su email; MaKo, una automatización,
 * Meta o una importación firman con otro nombre y no cuentan. Paginado con tope: si en 14 días hay más de 10.000 líneas,
 * tira (y el motor se calla esta clase) en vez de leer todo.
 */
async function gestosAMano(leadIds: ReadonlySet<number>, ahora: number): Promise<NonNullable<EntradaSugerencias['gestos']>> {
  const desde = new Date(ahora - UMBRALES_SUGERENCIAS.gestosDias * 86_400_000).toISOString();
  const filas = await leerTodo<{ lead_id: number; campo: string; valor_anterior: string | null; valor_nuevo: string | null; autor: string | null }>(
    await getTenantDb(), 'lead_audit', 'id, lead_id, campo, valor_anterior, valor_nuevo, autor', {
      orden: 'id', maxPaginas: 10, paralelo: 4,
      filtros: (q) => q.gte('created_at', desde).in('campo', [CAMPO_ETAPA, 'Asistió R1', 'Links de Fathom']) as unknown as ConsultaPaginada,
    });
  const movimientos: Array<{ desde: string; hacia: string }> = [];
  let noShowsAMano = 0;
  let fathomAMano = 0;
  for (const f of filas) {
    if (!leadIds.has(Number(f.lead_id)) || !String(f.autor ?? '').includes('@')) continue;
    if (f.campo === CAMPO_ETAPA && f.valor_anterior && f.valor_nuevo) movimientos.push({ desde: f.valor_anterior, hacia: f.valor_nuevo });
    else if (f.campo === 'Asistió R1' && f.valor_nuevo === 'No') noShowsAMano++;
    else if (f.campo === 'Links de Fathom' && f.valor_nuevo) fathomAMano++;
  }
  return { movimientos, noShowsAMano, fathomAMano };
}

/**
 * CLASE 4 (20/10/2026): las conversaciones NUEVAS de Instagram y Messenger de esos días. Tira si no se leyó. Las tablas
 * del canal se leen por el canal (lib/canal-zernio.ts, tests/sin-instagram.test.ts).
 */
async function dmsNuevos(ahora: number): Promise<NonNullable<EntradaSugerencias['nuevos']>> {
  const desde = new Date(ahora - UMBRALES_SUGERENCIAS.gestosDias * 86_400_000).toISOString();
  const { instagram, messenger } = await conversacionesSocialesNuevas(desde);
  return { dmInstagram: instagram, dmMessenger: messenger };
}

/** Un lead de la casa del CRM, con lo que miran los tres lectores de abajo. */
type LeadDeCasa = { id: number; nombre: string; etapa: string; creado: string | null; visitorId: string | null; prueba: boolean };

/**
 * CLASE 2 (20/10/2026, noche): los mensajes que una PERSONA mandó a mano a estos leads en la ventana, para «el mismo
 * mensaje a 3 leads». Sólo Instagram/Messenger (`ig_mensajes` saliente: lo único que escribe ahí es el envío manual de
 * Chats; las automatizaciones van a `nutricion_envios`) y email (`email_mensajes` con `autor`, el que mandó desde Chats).
 * ⚠️ WhatsApp NO: `wa_mensajes` no sabe quién escribió un saliente (lib/cs-contacto.ts) y las automatizaciones mandan
 * por la misma función que Chats; contarlo diría «mandaste el mismo mensaje a 30 leads» por una secuencia.
 */
async function mensajesAMano(casa: ReadonlyMap<number, LeadDeCasa>, ahora: number): Promise<NonNullable<NonNullable<EntradaSugerencias['gestos']>['mensajes']>> {
  const desde = new Date(ahora - UMBRALES_SUGERENCIAS.gestosDias * 86_400_000).toISOString();
  const db = await getTenantDb();
  // Instagram y Messenger, por el canal (lib/canal-zernio.ts: sus tablas no se leen desde acá).
  const [ig, email] = await Promise.all([
    salientesSocialesDesde(desde),
    db.from('email_mensajes').select('lead_id, texto').eq('direccion', 'saliente').not('autor', 'is', null).gte('created_at', desde).limit(3000),
  ]);
  if (email.error) throw new Error(`emails: ${email.error.message}`);
  const out: Array<{ texto: string; muestra: string; lead: number; etapa: string }> = [];
  const sumar = (leadId: number | undefined | null, texto: string | null) => {
    const l = leadId != null ? casa.get(Number(leadId)) : undefined;
    const t = (texto ?? '').trim();
    if (!l || !t) return;
    out.push({ texto: textoComparable(t, l.nombre), muestra: t.length > 160 ? `${t.slice(0, 159).trimEnd()}…` : t, lead: l.id, etapa: l.etapa });
  };
  for (const f of ig) sumar(f.leadId, f.texto);
  for (const f of (email.data ?? []) as Array<{ lead_id: number | null; texto: string | null }>) sumar(f.lead_id, f.texto);
  return out;
}

/** «hola-mako.site/oferta» de «https://www.hola-mako.site/oferta/?x=1»: lo que se lee de una landing en una línea. */
const nombreDePagina = (url: string): string => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[?#].*$/, '').replace(/\/+$/, '') || url;

/**
 * CLASE 4 (20/10/2026, noche): las landings y campañas de Meta que trajeron leads en la ventana SIN estar conectadas a
 * ningún CRM. En MaKo ese lead cae al CRM principal (`funnel_id` null), igual que uno asignado a propósito al principal:
 * en la base no se distinguen, así que se vuelve a mirar la asignación de hoy (`landing.config` y `meta.campanas`).
 * Si el negocio tiene un solo CRM, no hay a dónde conectarla: lista vacía.
 * ⚠️ Las dos lecturas son ESTRICTAS: un setting caído leído como «sin asignar» haría que TODA landing pareciera suelta.
 */
async function fuentesSinCrm(ahora: number): Promise<NonNullable<NonNullable<EntradaSugerencias['nuevos']>['sinCrm']>> {
  const funnels = await leerFunnels();
  if (!funnels) throw new Error('no pude leer los CRM');
  if (!funnels.some((f) => !f.esDefault)) return [];
  const desde = new Date(ahora - UMBRALES_SUGERENCIAS.gestosDias * 86_400_000).toISOString();
  const [leads, landings, campanas] = await Promise.all([
    leerTodo<{ id: number; origen_lead: string | null; pagina_registro: string | null; meta_campaign_id: string | null; adset_id_origen: string | null; meta_campaign_name: string | null }>(
      await getTenantDb(), 'leads', 'id, origen_lead, pagina_registro, meta_campaign_id, adset_id_origen, meta_campaign_name', {
        orden: 'id', maxPaginas: 5,
        filtros: (q) => q.is('funnel_id', null).gte('created_at', desde).in('origen_lead', ['landing', 'instant_form']) as unknown as ConsultaPaginada,
      }),
    getSettingEstricto(CLAVE_LANDINGS).then(parsearConfig),
    leerCampanasAsignadasEstricto(),
  ]);
  const cuenta = new Map<string, { tipo: 'landing' | 'campaña'; nombre: string; leads: number }>();
  const sumar = (tipo: 'landing' | 'campaña', clave: string, nombre: string) => {
    const k = `${tipo}|${clave}`;
    const c = cuenta.get(k) ?? { tipo, nombre, leads: 0 };
    c.leads++;
    cuenta.set(k, c);
  };
  for (const l of leads) {
    if (l.origen_lead === 'landing' && l.pagina_registro?.trim()) {
      if (!funnelIdsDeLanding(landings, l.pagina_registro).length) sumar('landing', nombreDePagina(l.pagina_registro), nombreDePagina(l.pagina_registro));
    } else if (l.origen_lead === 'instant_form' && (l.meta_campaign_id || l.adset_id_origen)) {
      if (!funnelIdDeCampana(campanas, { campaignId: l.meta_campaign_id, adsetId: l.adset_id_origen }).asignada) {
        sumar('campaña', String(l.meta_campaign_id ?? l.adset_id_origen), l.meta_campaign_name?.trim() || String(l.meta_campaign_id ?? l.adset_id_origen));
      }
    }
  }
  return [...cuenta.values()].sort((a, b) => b.leads - a.leads).slice(0, 5);
}

/**
 * CLASE 4 (20/10/2026, noche): los leads de este CRM, todavía en el recorrido (ni ganados ni fuera), que VOLVIERON: una
 * visita a la landing un día DESPUÉS del que entraron, o el VSL dado play dos veces (sin contar el autoplay), en la
 * ventana. `landing_visits` y `vsl_events` no tienen `lead_id`: se cruzan por `leads.visitor_id`. Con tope: los 1.000
 * más nuevos con visitor_id (de a 150 por consulta).
 */
async function leadsQueVolvieron(casa: ReadonlyMap<number, LeadDeCasa>, enRecorrido: ReadonlySet<string>, tz: string, ahora: number): Promise<NonNullable<NonNullable<EntradaSugerencias['nuevos']>['volvieron']>> {
  const desde = new Date(ahora - UMBRALES_SUGERENCIAS.gestosDias * 86_400_000).toISOString();
  const porVisitor = new Map<string, LeadDeCasa>();
  for (const l of [...casa.values()].sort((a, b) => String(b.creado ?? '').localeCompare(String(a.creado ?? '')))) {
    if (l.visitorId && !l.prueba && enRecorrido.has(l.etapa) && !porVisitor.has(l.visitorId)) porVisitor.set(l.visitorId, l);
    if (porVisitor.size >= 1000) break;
  }
  const vids = [...porVisitor.keys()];
  if (!vids.length) return [];
  const db = await getTenantDb();
  const visitas: Array<{ visitor_id: string; created_at: string; landing_url: string | null }> = [];
  const plays: Array<{ visitor_id: string; created_at: string; auto: boolean | null; landing_url: string | null }> = [];
  const tandas: string[][] = [];
  for (let i = 0; i < vids.length; i += 150) tandas.push(vids.slice(i, i + 150));
  for (let i = 0; i < tandas.length; i += 4) {
    await Promise.all(tandas.slice(i, i + 4).map(async (t) => {
      const [v, p] = await Promise.all([
        // Sin las de PRUEBA (`?mko_test`, la prueba del Pixel) ni la vista previa del editor: no son del negocio
        // (`noEsDelNegocio`, lib/graficos-datos-extra.ts; revisión del 21/10/2026).
        db.from('landing_visits').select('visitor_id, created_at, landing_url').in('visitor_id', t).gte('created_at', desde).is('prueba', null).limit(5000),
        db.from('vsl_events').select('visitor_id, created_at, auto, landing_url').in('visitor_id', t).gte('created_at', desde).is('prueba', null).or('tipo_evento.eq.play,event.eq.vsl_play').limit(5000),
      ]);
      if (v.error) throw new Error(`visitas: ${v.error.message}`);
      if (p.error) throw new Error(`plays del VSL: ${p.error.message}`);
      visitas.push(...((v.data ?? []) as typeof visitas));
      plays.push(...((p.data ?? []) as typeof plays));
    }));
  }
  const diaDe = (iso: string) => hoyEnTz(tz, new Date(iso));
  const ultimaVuelta = new Map<number, string>();
  const marcar = (l: LeadDeCasa, cuando: string) => { if (String(ultimaVuelta.get(l.id) ?? '') < cuando) ultimaVuelta.set(l.id, cuando); };
  for (const v of visitas) {
    const l = porVisitor.get(v.visitor_id);
    if (l?.creado && !esPreviewDeEditor(v.landing_url ?? '') && diaDe(v.created_at) > diaDe(l.creado)) marcar(l, v.created_at);
  }
  // LOS PLAYS, POR DÍA (revisión del 21/10/2026): un solo clic en un VSL de Wistia con el snippet v16/v17 deja DOS filas
  // «play» a milisegundos (lib/video-id.ts), y una página con dos videos o una recarga también. Volver es mirarlo OTRO
  // día DESPUÉS de ser lead: sólo cuentan los plays posteriores al alta, por HORA (la segunda revisión del 21/10: por día,
  // un VSL mirado el 14 y el 15 a la mañana, antes del formulario de la tarde del 15, se leía «volvió»). Con el alta
  // conocida, es la regla de las visitas (un día después); sin el alta, plays en dos días distintos.
  const diasDe = new Map<string, Map<string, string>>();
  for (const p of plays) {
    if (p.auto === true || esPreviewDeEditor(p.landing_url ?? '')) continue;
    const dueno = porVisitor.get(p.visitor_id);
    if (dueno?.creado && p.created_at < dueno.creado) continue;
    const dias = diasDe.get(p.visitor_id) ?? new Map<string, string>();
    const d = diaDe(p.created_at);
    if (String(dias.get(d) ?? '') < p.created_at) dias.set(d, p.created_at);
    diasDe.set(p.visitor_id, dias);
  }
  for (const [vid, dias] of diasDe) {
    const l = porVisitor.get(vid);
    if (!l) continue;
    const alta = l.creado ? diaDe(l.creado) : null;
    const orden = [...dias.keys()].sort();
    const ultimoDia = orden.at(-1)!;
    const despuesDelAlta = alta != null && ultimoDia > alta;
    const dosDias = alta == null && orden.length >= 2;
    if (despuesDelAlta || dosDias) marcar(l, dias.get(ultimoDia)!);
  }
  return [...ultimaVuelta].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => {
    const l = casa.get(id)!;
    return { lead: l.id, nombre: l.nombre, etapa: l.etapa };
  });
}

const aLeadSug = (l: Lead, etapa: string): LeadSug => ({
  etapa, creado: l.created_at ?? null,
  r1: l.fecha_junta_1, asistioR1: l.asistio_j1, r2: l.fecha_junta_2, asistioR2: l.asistio_j2,
  // Lo cobrado de la venta de la casa (tercera revisión, B5): una renovación pagada no hace «cobrada» la venta ganada.
  cobrado: cobradoDeLaVenta(l), ventaTipo: l.venta_tipo ?? null, manualVence: l.nutricion_manual_deadline ?? null,
});

const avisar = (que: string) => (e: unknown) => {
  console.error(`[sugerencias-crm] ${que}:`, e instanceof Error ? e.message : String(e));
  return null;
};

/** Calcula, sin caché. Lo que falla se abstiene (null en la entrada del motor), salvo el funnel y las automatizaciones. */
async function calcular(ws: number, crm: CrmDeLaPantalla): Promise<Calculo> {
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  const hoy = hoyEnTz(tz);
  const [cfg, umbrales, leadsCrudos, automs, diag, producto, fathom, medios] = await Promise.all([
    crm.esDefault ? getFunnelDefault() : getFunnelDe(crm.id),
    umbralesDe(crm.esDefault ? null : crm.id),
    listLeadsDeFunnel(crm.esDefault ? null : crm.id).catch(avisar('leads')),
    automatizacionesVivas(),
    getDiagnosticoFase().catch(() => null),
    productoDeFunnel([crm.id]).then((m) => m.get(crm.id) ?? null).catch(() => null),
    // «Fathom conectado» = un grabador de reuniones, cualquiera (lib/grabadores, 26/10/2026): con Fireflies tampoco hace
    // falta pegar el link a mano.
    hayGrabadorConectado(ws).catch(() => null),
    estadoMedios(['whatsapp']).then((m) => m.whatsapp?.porDefecto?.conectado ?? null).catch(() => null),
  ]);
  // Un funnel que no se pudo leer cae al pipeline de fábrica: sugerir sobre etapas que el CRM no tiene es inventar.
  if (cfg.origen === 'error') throw new Error('no pude leer el funnel del CRM');
  const entrega = producto ? (await entregasDeProductos([producto.id]).catch(() => new Map<number, EntregaConfig>())).get(producto.id) ?? null : null;

  const casa = (leadsCrudos ?? []).filter((l) => l.de_fila == null);
  const leads: LeadSug[] | null = leadsCrudos ? casa.map((l) => aLeadSug(l, etapaVigenteDe(l, cfg.stages))) : null;
  const idsCasa = new Set(casa.map((l) => l.id));
  const ahora = Date.now();
  const deCasa = new Map<number, LeadDeCasa>(casa.map((l) => [l.id, {
    id: l.id, nombre: l.nombre?.trim() || 'Sin nombre', etapa: etapaVigenteDe(l, cfg.stages), creado: l.created_at ?? null, visitorId: l.visitor_id ?? null,
    // El lead que crea la prueba del Pixel (lib/lead-de-prueba.ts): no es del negocio.
    prueba: l.origen_lead === 'prueba',
  }]));
  // «Volver» importa mientras se le está vendiendo: los pasos del recorrido, sin el ganado.
  const enRecorrido = new Set(cfg.stages.filter((s) => (s.band ?? 'pipeline') === 'pipeline' && s.key !== TERMINAL_DEL_PIPELINE).map((s) => s.key));
  // Las lecturas que dependen de los leads, a la vez. Lo que falla se abstiene (null o ausente): esa sugerencia se calla.
  const [cuotas, gestosLeidos, mensajes, dms, sinCrm, volvieron] = await Promise.all([
    leadsCrudos ? cuotasDe(idsCasa, hoy).catch(avisar('cuotas')) : Promise.resolve(null),
    leadsCrudos ? gestosAMano(idsCasa, ahora).catch(avisar('gestos')) : Promise.resolve(null),
    leadsCrudos ? mensajesAMano(deCasa, ahora).catch(avisar('mensajes a mano')) : Promise.resolve(null),
    dmsNuevos(ahora).catch(avisar('conversaciones nuevas')),
    fuentesSinCrm(ahora).catch(avisar('landings y campañas sin CRM')),
    leadsCrudos ? leadsQueVolvieron(deCasa, enRecorrido, tz, ahora).catch(avisar('los que volvieron')) : Promise.resolve(null),
  ]);
  const gestos = gestosLeidos ? { ...gestosLeidos, ...(mensajes ? { mensajes } : {}) } : null;
  // Cada lectura de la clase 4 se abstiene sola: un DM que no se leyó no calla al lead que volvió.
  const nuevos = {
    dmInstagram: dms?.dmInstagram ?? 0, dmMessenger: dms?.dmMessenger ?? 0,
    ...(sinCrm ? { sinCrm } : {}), ...(volvieron ? { volvieron } : {}),
  };
  const { plazos } = sanearPlazosPorEtapa(umbrales?.porEtapa, new Set(cfg.stages.map((s) => s.key)));
  const canal = canalEfectivo(cfg.canal, diag?.canal);
  const entradas = [...cfg.entradas];

  const entrada: EntradaSugerencias = {
    funnel: {
      id: crm.id, canal, entradas,
      productoId: producto?.id ?? null,
      etapasEntrega: (entrega?.etapas ?? []).map((x) => x.key),
    },
    etapas: cfg.stages, transiciones: cfg.transitions, plazos,
    automatizaciones: automs, leads, cuotas,
    conectado: { whatsapp: medios, fathom }, hoy, ahora,
    gestos, nuevos,
  };

  // El conteo por etapa es el del tablero: TODAS las tarjetas, también las agregadas.
  const porEtapa = new Map<string, number>();
  for (const l of leadsCrudos ?? []) { const k = etapaVigenteDe(l, cfg.stages); porEtapa.set(k, (porEtapa.get(k) ?? 0) + 1); }
  const foto: FotoCrm = {
    crm: { id: crm.id, nombre: crm.nombre, principal: crm.esDefault, canal, entradas },
    etapas: cfg.stages.map((s) => ({ key: s.key, label: s.label, tipo: s.kind ?? null, banda: s.band ?? 'pipeline', leads: leadsCrudos ? porEtapa.get(s.key) ?? 0 : null })),
    total_leads: leadsCrudos ? leadsCrudos.length : null,
    automatizaciones: automs.length,
  };
  // Sin tope acá: el tope va DESPUÉS de callar (una callada no puede dejar el lugar vacío).
  return { at: Date.now(), crm, foto, todas: sugerenciasDelCrm(entrada, Number.MAX_SAFE_INTEGER) };
}

/**
 * Las sugerencias de UN CRM para quien mira: lo calculado (de la caché si tiene menos de `TTL_MS`)
 * menos lo callado en ESE CRM. null = el workspace no tiene CRM. Tira si no se pudo calcular (el
 * funnel o las automatizaciones no se leyeron): una lista vacía diría «no hay nada que sugerir».
 */
export async function sugerenciasDeUnCrm(ws: number, crmPedido: number | null, o: { fresco?: boolean } = {}): Promise<SugerenciasDeUnCrm | null> {
  return runWithWorkspace(ws, async () => {
    const crm = await crmDeLaPantalla(crmPedido);
    if (!crm) return null;
    const k = claveCache(ws, crm.id);
    const previo = CACHE.get(k);
    const calc = !o.fresco && previo && Date.now() - previo.at < TTL_MS ? previo : await calcular(ws, crm);
    CACHE.set(k, calc);
    // Lo callado es para DIBUJAR: si no se puede leer, se muestra todo (crear igual pasa por la cuenta
    // fresca). Se lee ESTRICTO para no decir «no hay nada callado» cuando fue «no pude leer».
    const mapa = await getSettingEstricto(CLAVE_CALLADAS).then(parsearCalladas, avisar('leer lo callado'));
    const { visibles, lista } = sinCalladas(calc.todas, mapa ?? {}, crm.id, Date.now());
    return {
      crm: calc.crm, foto: calc.foto, sugerencias: visibles.slice(0, UMBRALES_SUGERENCIAS.tope),
      calladas: mapa ? lista.map(({ s, hasta }) => ({ sugerencia: s, hasta })) : null,
      calculadoAt: new Date(calc.at).toISOString(),
    };
  });
}

// ── Callar: «Ahora no» (30 días) y lo recién hecho (`hechaDias`) ────────────

/**
 * Suma una a lo callado del workspace, con compare-and-set: dos admins que callan a la vez no se pisan
 * (gana uno, el otro relee y vuelve a sumar). Lee ESTRICTO: con «no pude leer» como `{}` se borraría
 * todo lo callado de todos los CRM.
 */
async function callar(crmId: number, sugerenciaId: string, dias: number): Promise<void> {
  for (let intento = 0; intento < 4; intento++) {
    const crudo = await getSettingEstricto(CLAVE_CALLADAS);
    const nuevo = JSON.stringify(conCallada(parsearCalladas(crudo), claveCallada(crmId, sugerenciaId), dias, Date.now()));
    if (await cambiarSettingSi(CLAVE_CALLADAS, crudo, nuevo)) return;
  }
  throw new Error('otra persona estaba cambiando lo callado: intenta de nuevo');
}

export type FalloSugerencia = { ok: false; error: string; status: 400 | 404 | 409 | 500 };

/** «Ahora no»: la calla `callarDias` en ESTE CRM. Sólo una sugerencia que hoy se ve (o se vería). */
export async function ahoraNo(ws: number, crmPedido: number | null, sugerenciaId: string): Promise<{ ok: true } | FalloSugerencia> {
  return runWithWorkspace(ws, async () => {
    const r = await sugerenciasDeUnCrm(ws, crmPedido);
    if (!r) return { ok: false, error: 'No encuentro ese CRM.', status: 404 };
    const calc = CACHE.get(claveCache(ws, r.crm.id));
    if (!calc?.todas.some((s) => s.id === sugerenciaId)) return { ok: false, error: 'Esa sugerencia ya no está.', status: 409 };
    await callar(r.crm.id, sugerenciaId, UMBRALES_SUGERENCIAS.callarDias);
    return { ok: true };
  });
}

/**
 * «Volver a mostrar»: deshace el «Ahora no» de una sugerencia en ESTE CRM, con el mismo compare-and-set
 * y la misma lectura ESTRICTA que callar (con «no pude leer» como `{}` se borraría todo lo callado).
 * `cambio: false` = ya no estaba callada (otra persona la volvió a mostrar o venció): no se escribió nada.
 */
export async function volverAMostrar(ws: number, crmPedido: number | null, sugerenciaId: string): Promise<{ ok: true; cambio: boolean } | FalloSugerencia> {
  return runWithWorkspace(ws, async () => {
    const crm = await crmDeLaPantalla(crmPedido);
    if (!crm) return { ok: false, error: 'No encuentro ese CRM.', status: 404 };
    const clave = claveCallada(crm.id, sugerenciaId);
    for (let intento = 0; intento < 4; intento++) {
      const crudo = await getSettingEstricto(CLAVE_CALLADAS);
      const mapa = parsearCalladas(crudo);
      const ahora = Date.now();
      if (!estaCallada(mapa, clave, ahora)) return { ok: true, cambio: false };
      if (await cambiarSettingSi(CLAVE_CALLADAS, crudo, JSON.stringify(sinCallada(mapa, clave, ahora)))) return { ok: true, cambio: true };
    }
    return { ok: false, error: 'Otra persona estaba cambiando lo callado. Intenta de nuevo.', status: 409 };
  });
}

// ── Hacerlo ──────────────────────────────────────────────────────────────────

export type Hecha = { ok: true; secuenciaId: number; nombre: string; aviso: string | null; href: string };

/** Lo que está creándose ahora en ESTE proceso: el primer filtro, y es GRATIS. El que decide es la base. */
const EN_CURSO = new Set<string>();

/** Lo mismo que contesta el candado del proceso y el de la base: un clic repetido no es un error nuevo. */
const YA_SE_ESTA: FalloSugerencia = { ok: false, error: 'Ya se está creando.', status: 409 };

/**
 * «Hacerlo» de una sugerencia de plantilla: la crea PAUSADA por la puerta de la galería, la calla
 * `hechaDias` (lo que tarda en vencer la caché de todas las instancias) y devuelve dónde abrirla. El rol
 * lo mira quien llama (crear automatizaciones es del admin).
 *
 * ⚠️ EL CANDADO LO DECIDE LA BASE, Y SE RECLAMA ANTES DE CALCULAR (6/11/2026, #514). El `Set` de arriba
 * es por PROCESO: dos pestañas atendidas por dos instancias serverless lo pasaban las dos y la acción se
 * hacía DOS veces. El candado de verdad es una fila de `app_settings` tomada con compare-and-set
 * (`claveHaciendo` + `cambiarSettingSi`, lib/sugerencias-crm.ts y lib/settings.ts): de dos requests gana
 * UNO. Va antes de `calcular` porque calcular tarda (es la carga del tablero otra vez) y es justo ahí
 * donde las dos pestañas se cruzaban.
 *
 * Se lee ESTRICTO (`getSettingEstricto`): «no pude leer» no es «no lo tiene nadie» — tratarlo así es
 * exactamente cómo se crean las dos. Y se suelta SIEMPRE (`finally`) y SÓLO si sigue siendo el mío
 * (`borrarSettingSi` compara el valor): si venció y otro lo tomó, borrarlo sería soltarle el de él.
 */
export async function hacerSugerencia(ws: number, crmPedido: number | null, sugerenciaId: string): Promise<Hecha | FalloSugerencia> {
  return runWithWorkspace(ws, async () => {
    const crm = await crmDeLaPantalla(crmPedido);
    if (!crm) return { ok: false, error: 'No encuentro ese CRM.', status: 404 };
    const llave = `${ws}:${crm.id}:${sugerenciaId}`;
    if (EN_CURSO.has(llave)) return YA_SE_ESTA;
    const candado = claveHaciendo(crm.id, sugerenciaId);
    const previo = await getSettingEstricto(candado);
    if (haciendoseAhora(previo, Date.now())) return YA_SE_ESTA;
    const reclamo = new Date().toISOString();
    if (!(await cambiarSettingSi(candado, previo, reclamo))) return YA_SE_ESTA;
    EN_CURSO.add(llave);
    try {
      // La cuenta FRESCA decide (ver la cabecera): lo que ya existe no se sugiere y no se crea.
      const calc = await calcular(ws, crm);
      CACHE.set(claveCache(ws, crm.id), calc);
      const s = calc.todas.find((x) => x.id === sugerenciaId);
      if (!s) return { ok: false, error: 'Ya no hace falta: alguien la armó.', status: 409 };
      if (s.accion.tipo !== 'plantilla') return { ok: false, error: 'Esta no crea una automatización.', status: 400 };
      if (!plantillaPorId(s.accion.plantilla)) return { ok: false, error: 'Esa plantilla ya no existe.', status: 409 };
      try {
        const r = await crearDesdePlantilla(s.accion.plantilla, {
          db: (await getTenantDb()) as unknown as DbPlantilla,
          setPasos: setSecuenciaPasos,
          setDisparadores: guardarDisparadores,
          motivoDeCron: (e) => (e instanceof TriggerInvalidoError ? e.message : null),
          setConfig: guardarConfigAutomatizacion,
        }, { disparador: s.accion.disparador ?? undefined });
        // Se calla DESPUÉS de crear: si callar falla, la automatización igual quedó (y la cuenta fresca la ve).
        await callar(crm.id, s.id, UMBRALES_SUGERENCIAS.hechaDias).catch(avisar('callar la hecha'));
        CACHE.delete(claveCache(ws, crm.id));
        return { ok: true, secuenciaId: r.id, nombre: r.nombre, aviso: r.aviso ?? (r.pide ? 'Le falta elegir dónde arranca.' : null), href: `/automations?sec=${r.id}` };
      } catch (e) {
        if (e instanceof PlantillaInvalidaError || e instanceof PasosInvalidosError) return { ok: false, error: e.message, status: 400 };
        throw e;
      }
    } finally {
      EN_CURSO.delete(llave);
      // Si no se puede borrar, el candado vence solo (`CANDADO_HACERLO_MS`): peor sería dejarlo puesto.
      await borrarSettingSi(candado, reclamo).catch(avisar('soltar el candado de «Hacerlo»'));
    }
  });
}

