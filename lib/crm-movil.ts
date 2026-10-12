// =============================================================================
// MaKo Mobile — el CRM en el teléfono (lecturas del server)
// =============================================================================
// Lo leen app/m/crm/datos.ts (las reuniones de hoy de la lista y la ficha),
// app/m/crm/[id]/chat/page.tsx (el hilo de WhatsApp) y las acciones del buscador y de las
// notas. NO HAY UNA SEGUNDA IMPLEMENTACIÓN: cada pieza reusa la lectura que ya usa el
// escritorio (getJuntasProximas, getResumenLead, productosDelLead, chatEmpresaPorUltimos10,
// listLeads + coincideBusqueda). Lo único propio es el RECORTE: al teléfono viajan ~20 filas
// compactas, nunca la cartera (~1.500 leads × ~45 columnas).
//
// v2 (11/10/2026): se borró el «Hoy del CRM» de la v1 (hoyDelCrm, esperanDecision, quietos).
// La lista v2 tiene tres grupos (Hoy, Por responder, Nuevos) y ya no llama a
// `getPendientesDeMarcar`, que ESCRIBE aunque parezca una lectura (adjunta Fathom y cierra el
// historial de etapas derivadas): abrir /m/crm ya no escribe nada.
//
// Dos trampas que gobiernan este archivo (docs/hallazgos-crm.md, relevo del CRM):
//  · `getJuntasProximas` no trae la HORA: se completa con `junta_N_at` en UNA lectura
//    por ids, acotada a los leads de hoy y mañana.
//  · «No pude leer» y «no hay nada» son dos respuestas: cada sección vuelve `null`
//    cuando su lectura falló, y la pantalla lo dice distinto de un vacío.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { hoyEnWorkspace } from './timezone';
import { getJuntasProximas } from './queries';
import { listLeads, getLeadAudit, faltantesDeLead, type Lead } from './leads';
import { getResumenLead } from './lead-resumen';
import { productosDelLead, etapasDeProducto } from './lead-funnel';
import { listarFunnels } from './funnels';
import { nombreVisible } from './lead-funnel-reglas';
import { getUltimoInsightGenerado } from './lead-insights';
import { chatEmpresaPorUltimos10, ultimos10 } from './api-mako/areas/whatsapp.helpers';
import { numeroCanonico } from './contacto-lead';
import { etapaVigenteDe } from './funnel-etapas';
import { permisoCalendarioGoogle } from './google-calendar';
import { credWs, integracionConectada } from './credenciales';
import { puedeAgendarR2 } from '@/app/crm/agendar-r2';
import {
  buscarEnCartera, comoLite, cualAgendar, cuandoCorto, etapasMovibles, horaEnTz, siguienteAccion, telHref, waMeHref,
  type CualAgendar, type EtapaM, type FilaLeadM, type ReunionesLead, type SiguienteAccion,
} from '@/app/m/crm/reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── Reuniones de hoy (y mañana) ───────────────────────────────────────────────

export type ReunionM = { leadId: number; nombre: string; cual: 'R1' | 'R2'; dia: 'hoy' | 'mañana'; hora: string | null };

export async function reunionesDeHoy(hoy: string, tz: string): Promise<ReunionM[]> {
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
        nombre: (f ? nombreVisible(f) : '') || 'Funnel',
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
export function rotuloSinTexto(tipo: string | null): string {
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

