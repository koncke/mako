// =============================================================================
// MaKo Mobile — el CRM en el teléfono (lecturas del server)
// =============================================================================
// Lo leen app/m/crm/page.tsx (el «Hoy» del CRM), app/m/crm/[id]/page.tsx (la ficha
// en lectura), app/m/crm/[id]/chat/page.tsx (el hilo de WhatsApp) y la acción del
// buscador. NO HAY UNA SEGUNDA IMPLEMENTACIÓN: cada pieza reusa la lectura que ya
// usa el escritorio (getJuntasProximas, getPendientesDeMarcar, getResumenLead,
// productosDelLead, chatEmpresaPorUltimos10, listLeads + coincideBusqueda). Lo
// único propio es el RECORTE: al teléfono viajan ~20 filas compactas, nunca la
// cartera (~1.500 leads × ~45 columnas).
//
// Tres trampas que gobiernan este archivo (docs/hallazgos-crm.md, relevo del CRM):
//  · `getPendientesDeMarcar` ESCRIBE aunque parezca una lectura (adjunta Fathom con
//    throttle y cierra el historial de etapas derivadas). Es la misma lectura que
//    hace /crm en cada apertura y está cacheada; no se llama en ningún otro lado aquí.
//  · `getJuntasProximas` no trae la HORA: se completa con `junta_N_at` en UNA lectura
//    por ids, acotada a los leads de hoy y mañana.
//  · «No pude leer» y «no hay nada» son dos respuestas: cada sección vuelve `null`
//    cuando su lectura falló, y la pantalla lo dice distinto de un vacío.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from './timezone';
import { getJuntasProximas, getPendientesDeMarcar } from './queries';
import { listLeads, getLeadAudit, faltantesDeLead, type Lead } from './leads';
import { getResumenLead } from './lead-resumen';
import { productosDelLead, etapasDeProducto } from './lead-funnel';
import { listarFunnels, funnelsConUmbrales } from './funnels';
import { nombreVisible } from './lead-funnel-reglas';
import { getUltimoInsightGenerado } from './lead-insights';
import { chatEmpresaPorUltimos10, ultimos10 } from './api-mako/areas/whatsapp.helpers';
import { numeroCanonico } from './contacto-lead';
import { pipelineStageOf } from './pipeline';
import { etapaVigenteDe } from './funnel-etapas';
import { leerTodo } from './supabase-paginado';
import { CAMPO_ETAPA } from './etapa-historial';
import { entradaALaEtapa, leadsQuietos, plazosValidos, relojDesde, type EnEtapa } from './lead-quieto';
import { slotDeReunion } from './funnel-etapas';
import { permisoCalendarioGoogle } from './google-calendar';
import { credWs, integracionConectada } from './credenciales';
import { puedeAgendarR2 } from '@/app/crm/agendar-r2';
import {
  buscarEnCartera, comoLite, cualAgendar, cuandoCorto, etapasMovibles, horaEnTz, siguienteAccion, telHref, waMeHref,
  type CualAgendar, type EtapaM, type FilaLeadM, type ReunionesLead, type SiguienteAccion,
} from '@/app/m/crm/reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── Hoy del CRM ───────────────────────────────────────────────────────────────

export type ReunionM = { leadId: number; nombre: string; cual: 'R1' | 'R2'; dia: 'hoy' | 'mañana'; hora: string | null };
export type EsperaM = { leadId: number; nombre: string; frase: string };
export type QuietoM = { leadId: number; nombre: string; etapa: string; plazo: number };

export type HoyCrm = {
  tz: string;
  hoy: string;
  leidoEn: string;
  /** null = no se pudo leer (distinto de una lista vacía). */
  reuniones: ReunionM[] | null;
  esperan: EsperaM[] | null;
  quietos: QuietoM[] | null;
};

/** Hasta cuántas filas de cada sección viajan al teléfono. Lo demás está en la computadora. */
const TOPE_SECCION = 12;

async function reunionesDeHoy(hoy: string, tz: string): Promise<ReunionM[]> {
  const juntas = await getJuntasProximas(hoy, 2);
  if (!juntas.length) return [];
  // La HORA: getJuntasProximas no la expone. Una lectura por ids, sólo de estos leads.
  const ids = [...new Set(juntas.map((j) => j.lead_id))];
  const { data, error } = await (await getTenantDb())
    .from('leads').select('id, junta_1_at, junta_2_at').in('id', ids);
  if (error) throw new Error(`No pude leer las horas: ${error.message}`);
  const horas = new Map(((data ?? []) as Array<{ id: number; junta_1_at: string | null; junta_2_at: string | null }>)
    .map((l) => [Number(l.id), l]));
  const out: ReunionM[] = juntas
    .filter((j) => j.dia === 'hoy' || j.dia === 'mañana')
    .map((j) => {
      const l = horas.get(j.lead_id);
      const iso = j.tipo === 'J1' ? l?.junta_1_at : l?.junta_2_at;
      // Sólo si el instante cae EN ese día: un junta_N_at viejo (reagendado sin hora) no es la hora de hoy.
      const hora = iso && j.fecha === new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso)) ? horaEnTz(iso, tz) : null;
      return { leadId: j.lead_id, nombre: j.nombre?.trim() || 'Sin nombre', cual: j.tipo === 'J1' ? 'R1' : 'R2', dia: j.dia as 'hoy' | 'mañana', hora };
    });
  // Hoy primero, y dentro del día por hora (las sin hora al final del día).
  return out.sort((a, b) => (a.dia === b.dia ? (a.hora ?? '99').localeCompare(b.hora ?? '99') : a.dia === 'hoy' ? -1 : 1));
}

async function esperanDecision(hoy: string): Promise<EsperaM[]> {
  const { items } = await getPendientesDeMarcar(hoy);
  // R = la reunión pasó y falta decidir · M = la nutrición manual venció. Lo demás son
  // datos sueltos que se completan en la computadora.
  const vistos = new Set<number>();
  const out: EsperaM[] = [];
  for (const it of items) {
    if ((it.tipo !== 'R' && it.tipo !== 'M') || vistos.has(it.lead_id)) continue;
    vistos.add(it.lead_id);
    out.push({ leadId: it.lead_id, nombre: it.lead_nombre?.trim() || 'Sin nombre', frase: it.mensaje });
  }
  return out;
}

type FilaQuieta = {
  id: number; nombre: string | null; funnel_id: number | null; estado_lead: string | null; pipeline_stage: string | null;
  fecha_agenda: string | null; fecha_junta_1: string | null; fecha_junta_2: string | null; junta_1_at: string | null;
  junta_2_at: string | null; asistio_j1: boolean | null; asistio_j2: boolean | null; nutricion_realizada: boolean | null;
  etapa_vista: string | null; created_at: string | null;
};
const COLS_QUIETO = 'id, nombre, funnel_id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_realizada, etapa_vista, created_at';

/**
 * Los leads que pasaron el plazo que el dueño le puso a su etapa (lib/lead-quieto.ts).
 *
 * ⚠️ ES LA LECTURA DEL AVISO (lib/lead-quieto-aviso.ts → quietosDelWorkspace) SÓLO PARA LA
 * CASA: ese lector es privado y vive en un archivo de otra área. Reusa todas sus piezas
 * puras (plazosValidos, entradaALaEtapa, relojDesde, leadsQuietos) y deja afuera los
 * productos agregados. Deuda: extraer de allá un `itemsEnEtapa()` que llamen los dos.
 * Sin un solo plazo configurado no lee ni un lead.
 */
async function quietos(ahoraMs: number): Promise<QuietoM[]> {
  const funnels = await funnelsConUmbrales();
  if (!funnels) throw new Error('No pude leer los embudos.');
  const plazos = new Map<number, Record<string, number>>();
  const etiquetas = new Map<number, Map<string, string>>();
  const etapasDe = new Map<number, (typeof funnels)[number]['cfg']['stages']>();
  let idDefault: number | null = null;
  for (const f of funnels) {
    if (f.esDefault) idDefault = f.id;
    etiquetas.set(f.id, new Map(f.cfg.stages.map((s) => [s.key, s.label])));
    etapasDe.set(f.id, f.cfg.stages);
    const v = plazosValidos(f.umbrales?.porEtapa, f.cfg.stages);
    if (Object.keys(v.plazos).length) plazos.set(f.id, v.plazos);
  }
  if (!plazos.size) return [];
  const plazoDe = (fid: number, etapa: string) => plazos.get(fid)?.[etapa] ?? null;

  const db = await getTenantDb();
  const abiertos = await leerTodo<FilaQuieta>(db, 'leads', COLS_QUIETO, { orden: 'id', eq: { estado_lead: 'abierto' } });
  const candidatos: Array<{ l: FilaQuieta; funnelId: number; etapa: string }> = [];
  for (const l of abiertos) {
    const funnelId = l.funnel_id != null ? Number(l.funnel_id) : idDefault;
    if (funnelId == null) continue;
    const etapa = pipelineStageOf(l as unknown as Parameters<typeof pipelineStageOf>[0]);
    if (plazoDe(funnelId, etapa)) candidatos.push({ l, funnelId, etapa });
  }
  if (!candidatos.length) return [];

  const ultima = new Map<number, { valor: string | null; at: string }>();
  const ids = candidatos.map((c) => Number(c.l.id));
  for (let i = 0; i < ids.length; i += 200) {
    const filas = await leerTodo<{ id: number; lead_id: number; valor_nuevo: string | null; created_at: string }>(
      db, 'lead_audit', 'id, lead_id, valor_nuevo, created_at', {
        orden: [{ col: 'created_at', asc: false }, { col: 'id', asc: false }],
        filtros: (q) => q.eq('campo', CAMPO_ETAPA).in('lead_id', ids.slice(i, i + 200)),
      },
    );
    for (const f of filas) if (!ultima.has(Number(f.lead_id))) ultima.set(Number(f.lead_id), { valor: f.valor_nuevo, at: f.created_at });
  }

  const items: EnEtapa[] = candidatos.map(({ l, funnelId, etapa }) => {
    const slot = slotDeReunion(etapasDe.get(funnelId), etapa);
    const reunion = !slot ? null : slot.cual === 'r1' ? (l.junta_1_at ?? l.fecha_junta_1 ?? l.fecha_agenda) : (l.junta_2_at ?? l.fecha_junta_2);
    return {
      leadId: Number(l.id), nombre: l.nombre?.trim() || 'Sin nombre', funnelId, etapa,
      desde: relojDesde(entradaALaEtapa({ etapa, etapaVista: l.etapa_vista, ultimaEtapa: ultima.get(Number(l.id)), creadoEn: l.created_at }), reunion),
    };
  });
  return leadsQuietos(items, plazoDe, ahoraMs).map((q) => ({
    leadId: q.leadId, nombre: q.nombre, etapa: etiquetas.get(q.funnelId)?.get(q.etapa) ?? q.etapa, plazo: q.plazo,
  }));
}

/** El «Hoy» del CRM: tres secciones, cada una con su propio fallo. Nunca tira. */
export async function hoyDelCrm(): Promise<HoyCrm> {
  const ws = await getWorkspaceActual();
  const [tz, hoy] = await Promise.all([
    ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
    hoyEnWorkspace(),
  ]);
  const ahora = Date.now();
  const [r, e, q] = await Promise.allSettled([reunionesDeHoy(hoy, tz), esperanDecision(hoy), quietos(ahora)]);
  for (const [n, x] of [['reuniones', r], ['esperan', e], ['quietos', q]] as const) {
    if (x.status === 'rejected') console.error(`[crm-movil] ${n}: ${msg(x.reason)}`);
  }
  const vale = <T,>(x: PromiseSettledResult<T[]>) => (x.status === 'fulfilled' ? x.value.slice(0, TOPE_SECCION) : null);
  return { tz, hoy, leidoEn: new Date(ahora).toISOString(), reuniones: vale(r), esperan: vale(e), quietos: vale(q) };
}

// ── Buscador ──────────────────────────────────────────────────────────────────

/** Busca en el SERVER y devuelve ~20 filas compactas. La cartera nunca viaja al teléfono. */
export async function buscarLeads(q: string): Promise<{ filas: FilaLeadM[]; hayMas: boolean }> {
  const leads = await listLeads();
  return buscarEnCartera(leads.map((l) => ({ id: l.id, nombre: l.nombre, empresa: l.empresa, email: l.email, telefono: l.telefono })), q);
}

// ── Ficha ─────────────────────────────────────────────────────────────────────

export type ProductoM = {
  funnelId: number;
  nombre: string;
  esCasa: boolean;
  etapa: string | null;
  etapaLabel: string | null;
  /** A dónde se puede mover desde el teléfono (sin wizard, sin Ganado ni cobros). */
  movibles: EtapaM[];
};

export type LlamadaM = {
  cuando: string | null;
  resultado: string | null;
  resumen: string | null;
  abiertas: string[];
  resueltas: number;
  proximoPaso: string | null;
  url: string | null;
};

/** Por qué camino se agenda en ESTE negocio (decidido en el server, la agenda no pasa por IA). */
export type ModoAgenda = 'google' | 'calendly-r2' | 'link' | 'nada';

export type FichaMovil = {
  id: number;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  tel: string | null;
  waMe: string | null;
  productos: ProductoM[];
  casa: ProductoM | null;
  siguiente: SiguienteAccion | null;
  llamada: LlamadaM | null;
  respuestas: Array<{ pregunta: string; respuesta: string }>;
  origen: { campana: string | null; anuncio: string | null; canal: string | null };
  reuniones: ReunionesLead;
  agenda: CualAgendar;
  modoAgenda: ModoAgenda;
  /** El chat del lead en el espejo de la línea no oficial, o null si nunca escribió. */
  chat: { chatJid: string; linea: string | null } | null;
  seguimientoSinEnviar: boolean;
  notas: Array<{ id: number; texto: string; cuando: string; autor: string }>;
  tz: string;
  hoy: string;
};

const autorLegible = (a: string) => (a.includes('@') ? a.split('@')[0] : a);

/** Las notas del lead (eventos 'Nota' del historial), de la más nueva a la más vieja. */
export async function notasDeLead(leadId: number): Promise<FichaMovil['notas']> {
  const rows = await getLeadAudit(leadId);
  return rows
    .filter((r) => r.campo === 'Nota' && (r.valor_nuevo ?? '').trim())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
    .map((r) => ({ id: r.id, texto: r.valor_nuevo ?? '', cuando: r.created_at, autor: autorLegible(r.autor) }));
}

async function modoAgenda(ws: number | null, c: CualAgendar): Promise<ModoAgenda> {
  if (ws == null) return 'nada';
  const [google, calendly, et2] = await Promise.all([
    permisoCalendarioGoogle().catch(() => ({ conectado: false, puedeMover: false })),
    integracionConectada('calendly', ws).catch(() => false),
    credWs('CALENDLY_EVENT_TYPE_J2', ws).catch(() => null),
  ]);
  if (google.conectado && google.puedeMover) return 'google';
  // Calendly no mueve una reunión ya agendada por API: reservar otra sería una segunda R2.
  if (c.cual === 'r2' && !c.mueve && puedeAgendarR2({ calendlyConectada: calendly, eventTypeR2: et2 })) return 'calendly-r2';
  if (calendly) return 'link';
  return 'nada';
}

/** La ficha en LECTURA. null = el lead no es de este workspace (o no existe). */
export async function fichaMovil(leadId: number): Promise<FichaMovil | null> {
  const r = await getResumenLead(leadId);
  if (!r) return null;
  const l: Lead = r.lead;
  const ws = await getWorkspaceActual();
  const hoy = await hoyEnWorkspace();
  const ahora = Date.now();

  // Productos: en cuáles está y su etapa en cada uno (mig 0207: uno es la CASA).
  let productos: ProductoM[] = [];
  try {
    const [{ productos: suyos, etapaCasa }, funnels] = await Promise.all([productosDelLead(leadId), listarFunnels()]);
    productos = await Promise.all(suyos.map(async (p) => {
      const f = funnels.find((x) => x.id === p.funnelId);
      const stages = (await etapasDeProducto(p.funnelId).catch(() => [])) as EtapaM[];
      // La casa: la etapa EFECTIVA (override si sigue existiendo, si no la derivada).
      const etapa = p.esCasa ? (etapaCasa && stages.some((s) => s.key === etapaCasa) ? etapaCasa : etapaVigenteDe(l, comoLite(stages))) : p.etapa;
      return {
        funnelId: p.funnelId,
        nombre: (f ? nombreVisible(f) : '') || 'Producto',
        esCasa: p.esCasa,
        etapa,
        etapaLabel: stages.find((s) => s.key === etapa)?.label ?? etapa,
        movibles: etapasMovibles(stages, etapa),
      };
    }));
    productos.sort((a, b) => (a.esCasa === b.esCasa ? 0 : a.esCasa ? -1 : 1));
  } catch (e) {
    console.error(`[crm-movil] productos de ${leadId}: ${msg(e)}`);
  }
  const casa = productos.find((p) => p.esCasa) ?? null;

  const [insight, chat, notas] = await Promise.all([
    getUltimoInsightGenerado(leadId).catch(() => null),
    (async () => {
      const u = ultimos10(numeroCanonico(l.telefono) ?? l.telefono);
      if (u.length !== 10) return null;
      const c = await chatEmpresaPorUltimos10(u).catch(() => null);
      return c ? { chatJid: c.chatJid, linea: c.linea } : null;
    })(),
    notasDeLead(leadId).catch(() => []),
  ]);

  const ultima = r.llamadas[0] ?? null;
  const faltantes = (() => {
    try { return faltantesDeLead(l).map((s) => s.label).slice(0, 4); } catch { return []; }
  })();
  const reuniones: ReunionesLead = {
    fecha_junta_1: l.fecha_junta_1, junta_1_at: l.junta_1_at, fecha_junta_2: l.fecha_junta_2, junta_2_at: l.junta_2_at,
  };
  const agenda = cualAgendar(reuniones, ahora, hoy);

  return {
    id: l.id,
    nombre: l.nombre?.trim() || 'Sin nombre',
    empresa: l.empresa?.trim() || null,
    email: l.email?.trim() || null,
    telefono: numeroCanonico(l.telefono),
    tel: telHref(l.telefono),
    waMe: waMeHref(l.telefono),
    productos,
    casa,
    siguiente: siguienteAccion({
      proximaReunion: r.proximaReunion ? { cual: r.proximaReunion.cual, cuando: cuandoCorto(r.proximaReunion.iso, r.tz, hoy) } : null,
      proximoPasoLlamada: ultima?.proximoPaso ?? null,
      proximaAccionInsight: insight?.contenido?.proxima_accion ?? null,
      faltantes,
      seguimientoSinEnviar: !!r.borradorSeguimiento,
    }),
    llamada: ultima ? {
      cuando: ultima.startedAt ? cuandoCorto(ultima.startedAt, r.tz, hoy) : ultima.callDate,
      resultado: ultima.outcome,
      resumen: ultima.resumen,
      abiertas: ultima.objeciones.filter((o) => !o.handled).map((o) => o.quote).slice(0, 5),
      resueltas: ultima.objeciones.filter((o) => o.handled).length,
      proximoPaso: ultima.proximoPaso,
      url: ultima.url,
    } : null,
    respuestas: r.respuestas,
    origen: r.origen,
    reuniones,
    agenda,
    modoAgenda: await modoAgenda(ws, agenda),
    chat,
    seguimientoSinEnviar: !!r.borradorSeguimiento,
    notas,
    tz: r.tz,
    hoy,
  };
}

// ── Hilo de WhatsApp ──────────────────────────────────────────────────────────

export type MensajeM = { id: number; deMi: boolean; texto: string; sinTexto: boolean; cuando: string | null };

export type HiloM = {
  leadId: number;
  nombre: string;
  /** null = el lead nunca escribió por la línea no oficial (o no tiene teléfono). */
  chat: { chatJid: string; linea: string | null; telefono: string } | null;
  mensajes: MensajeM[];
  waMe: string | null;
  tz: string;
};

export const MENSAJES_HILO = 40;

/** Rótulo de un mensaje sin texto (nota de voz, foto, archivo): nunca una burbuja vacía. */
function rotuloSinTexto(tipo: string | null): string {
  switch (tipo) {
    case 'audio': return 'Nota de voz';
    case 'image': case 'imagen': return 'Foto';
    case 'video': return 'Video';
    case 'document': case 'documento': return 'Archivo';
    case 'sticker': return 'Sticker';
    default: return 'Mensaje sin texto';
  }
}

/**
 * Los últimos 40 mensajes del espejo para ESE chat y ESA línea, en orden cronológico.
 * Coincide por SUFIJO de 10 dígitos (como chatEmpresaPorUltimos10): la subcadena mezcla
 * personas. null = el lead no es de este workspace.
 */
export async function hiloWhatsApp(leadId: number): Promise<HiloM | null> {
  const r = await getResumenLead(leadId);
  if (!r) return null;
  const l = r.lead;
  const base: HiloM = { leadId, nombre: l.nombre?.trim() || 'Sin nombre', chat: null, mensajes: [], waMe: waMeHref(l.telefono), tz: r.tz };
  const u = ultimos10(numeroCanonico(l.telefono) ?? l.telefono);
  if (u.length !== 10) return base;
  const c = await chatEmpresaPorUltimos10(u);
  if (!c) return base;
  const db = await getTenantDb();
  let q = db.from('wa_mensajes').select('id, from_me, tipo, texto, wa_timestamp, telefono, instance_name')
    .like('telefono', `%${u}`).neq('tipo', 'evento');
  if (c.linea) q = q.eq('instance_name', c.linea);
  const { data, error } = await q.order('wa_timestamp', { ascending: false }).order('id', { ascending: false }).limit(MENSAJES_HILO);
  if (error) throw new Error(`No pude leer el chat: ${error.message}`);
  const filas = ((data ?? []) as Array<{ id: number; from_me: boolean; tipo: string | null; texto: string | null; wa_timestamp: string | null; telefono: string | null }>)
    .filter((m) => ultimos10(m.telefono) === u)
    .reverse();
  // El número EXACTO con que el espejo guarda el chat (52 y 521 conviven): por ése se contesta.
  const telefono = c.telefonos[0] ?? numeroCanonico(l.telefono) ?? '';
  return {
    ...base,
    chat: { chatJid: c.chatJid, linea: c.linea, telefono },
    mensajes: filas.map((m) => ({
      id: m.id, deMi: !!m.from_me,
      sinTexto: !m.texto?.trim(),
      texto: m.texto?.trim() || rotuloSinTexto(m.tipo),
      cuando: m.wa_timestamp,
    })),
  };
}

