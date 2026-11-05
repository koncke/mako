// =============================================================================
// /m/crm — lo que LEE el CRM del teléfono (server): el tablero y la ficha
// =============================================================================
// Ninguna regla propia: cada pieza es la lectura que ya usa el escritorio, recortada a lo que
// el teléfono dibuja.
//
//   · Tablero → lo mismo que app/crm/page.tsx: el funnel de la URL validado contra los de este
//               workspace, sus etapas, sus leads en la columna en la que los dibuja CrmBoard
//               (mapToCrmLead + etapasDelTablero), el orden manual y la plata de cada columna.
//               Hasta 40 tarjetas por columna; el conteo dice el total (v3, 14/10/2026).
//   · Ficha   → fichaMovil (lib/crm-movil.ts) + el historial con autor de escritorio
//               (getLeadAuditAction) para las notas y la actividad. Y desde el 15/10/2026 la ficha
//               del funnel del lead (qué piezas y en qué orden, ./ficha-bloques.ts) y «N sin marcar»,
//               con las MISMAS lecturas que la ficha de escritorio (`getLeadFullAction`):
//               `fichaDelFunnelDelLead` y lib/datos-del-lead.ts. Con una cuenta propia, el número del
//               teléfono y el de la computadora se separaban.
//
// La lista de la v2 (Hoy · Por responder · Nuevos y el filtro por etapa) se borró con la v3: el
// CRM del teléfono es el tablero, y lo que espera respuesta vive en la pestaña Chats.
//
// «No pude leer» y «no hay nada» son dos respuestas: el tablero vuelve null cuando su lectura
// falló, y la pantalla lo dice distinto de una columna vacía.
// =============================================================================

import { getCamposTarjetaCrm } from '@/lib/perfil';
import type { CampoTarjetaLead } from '@/lib/tarjeta-kanban';
import 'server-only';
import { getWorkspaceActual } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { fichaMovil, type FichaMovil } from '@/lib/crm-movil';
import { listLeadsDeFunnel, getLead } from '@/lib/leads';
import { getPipelineStagesDefault, getFunnelDe, listarFunnels, FUNNEL_DEFAULT_NOMBRE } from '@/lib/funnels';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { leerOrdenManual } from '@/lib/crm-orden';
import { ordenarKanbanManual } from '@/app/crm/orden-kanban';
import { totalDeColumna, textoDelTotal, plataCorta } from '@/app/crm/total-columna';
import { generateFunnel, DEFAULT_PIPELINE } from '@/lib/pipeline';
import { getCampaignNameMap } from '@/lib/queries';
import { etapasDeProducto } from '@/lib/lead-funnel';
import { mapToCrmLead, etapasDelTablero } from '@/app/crm/crm-map';
import { canalDeLead } from '@/app/crm/origen-lead';
import { getLeadAuditAction } from '@/app/crm/actions';
import { fichaDelFunnelDelLead } from '@/lib/ficha/config-server';
import { fichaEfectiva, RESPALDO_VACIO } from '@/lib/ficha/config';
import { datosSinMarcarDeLead, leerInsumosDatosLead } from '@/lib/datos-del-lead';
import { verTrackingDeLead } from '@/lib/tracking-ficha-server';
import { tieneEtapaDeReunion } from '@/lib/etapa-reunion';
import type { Lead } from '@/lib/leads';
import type { ContactoCopia } from '@/lib/sin-conexion/reglas';
import { filaDeAutomatizaciones, piezasDelTelefono, resumenDelTelefono, saldoDelTelefono, tabsQueVe, tonoDeAutomatizaciones, type PiezaPuesta, type ResumenTelefono, type SaldoTelefono } from './ficha-bloques';
import { enAutomatizaciones } from '@/lib/automatizaciones-del-lead';
import { fechaCorta, vistaDeEnAutomatizacion, type TonoTarjeta } from '@/app/crm/automatizacion-lead';
import { tiempoEnEtapaAction } from '@/app/crm/lead-view/ficha/resumen/bloques-actions';
import { listarCobros } from '@/lib/cobros';
import { cobradoDelLead } from '@/lib/cobrado-lead';
import { cambiosDeSuscripcion } from '@/lib/suscripcion-movimientos';
import { estadoDeCuenta } from '@/lib/pagos-vistazo';
import { planEnLead, tieneDeal } from '@/lib/muestra-pagos';
import { tratosDelLead } from '@/lib/pagos';
import { leadConTrato } from '@/lib/pagos-crm';
import { pipelineStageOf } from '@/lib/pipeline';
import {
  cuandoEnLista, etapaEnTablero, lineaActividad, llegoPor, progresoEnFunnel, proximaLlamada, senalDeTarjeta, seMueveEnElTelefono,
  seSacaEnElTelefono, soloInstagram, FUERA_DE_ACTIVIDAD, type LineaActividad, type SenalTarjeta,
} from './reglas';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── La ficha ──────────────────────────────────────────────────────────────────

export type NotaM = { id: number; texto: string; cuando: string; autor: string };
export type ActividadM = LineaActividad & { id: number; riel: string };

export type FichaV2 = {
  f: FichaMovil;
  /** «Hoy, 10:30» / null = sin agendar. */
  proxima: string | null;
  llegoPor: string | null;
  /** Las últimas notas (las del historial, con el nombre de quien la escribió), hasta 20. */
  notas: NotaM[];
  /** Cuántas hay en total (puede ser más que las que viajan). */
  totalNotas: number;
  actividad: ActividadM[];
  /** Lo que se dibuja debajo del encabezado, en el orden de la ficha del funnel (./ficha-bloques.ts). */
  piezas: PiezaPuesta[];
  /** «N sin marcar», el MISMO número que el escritorio. null = no se pudo contar (no se dibuja). */
  sinMarcar: number | null;
  /** El estado de cuenta en una fila (la pieza `saldo`), con la MISMA cuenta que el escritorio. null = nada que contar. */
  saldo: SaldoTelefono | null;
  /**
   * El de cada CRM agregado con plata (una renovación, CO2, 22/10/2026, mig 0324): su venta y su plan son otros. Una fila
   * más en la pieza `saldo`, con el nombre del CRM. Vacío si no está en otro CRM con plata.
   */
  saldosCrm: Array<{ crm: string; saldo: SaldoTelefono }>;
  /**
   * Las filas del Resumen nativo (16/10/2026): la siguiente acción, el equipo, la calificación, cuánto lleva en la
   * etapa… (`resumenDelTelefono`, ./ficha-bloques.ts). null = sin el lead (no se dibuja ninguna).
   */
  resumen: ResumenTelefono | null;
  /** El color del punto de la fila «Automatización» (24/10/2026): el estado de la que nombra. */
  autTono: TonoTarjeta | null;
  /**
   * La barra de avance del encabezado (17/10/2026, copiada de la ficha del deal de Pipedrive): cuántas etapas tiene
   * el camino del funnel de su casa y hasta cuál llegó (`progresoEnFunnel`). null = sin funnel.
   */
  progreso: { total: number; hasta: number | null } | null;
  /**
   * El @ de Instagram cuando es su ÚNICO canal (23/10/2026, `soloInstagram`): la ficha ofrece abrir su Instagram en vez de
   * un Llamar y un WhatsApp apagados, y el contacto dice el @ en vez de «Sin teléfono». null = tiene otro canal (o no se
   * pudo leer el lead): la ficha se dibuja como siempre.
   */
  soloInstagram: string | null;
};

/**
 * La ficha del funnel del lead, destilada, y sus datos sin marcar. Las lecturas son las de escritorio: la
 * ficha de SU funnel (sin ficha guardada, su plantilla; con la lectura caída, la de respaldo, como hace la
 * pantalla de escritorio), las etapas DEL LEAD para saber si ve Reuniones, la regla de Tracking, y
 * «N sin marcar» con sus insumos. Nunca tira: lo que falla no se dibuja.
 */
async function fichaDelFunnel(lead: Lead | null): Promise<{ piezas: PiezaPuesta[]; sinMarcar: number | null; saldo: SaldoTelefono | null; saldosCrm: Array<{ crm: string; saldo: SaldoTelefono }> }> {
  // El respaldo del negocio sólo cambia redes, ingreso, dirección, sexo y cohorte: ninguna tiene versión de
  // teléfono, así que el vacío da las mismas piezas que la pantalla de escritorio con su `resumen`.
  const respaldo = fichaEfectiva('respaldo', null, RESPALDO_VACIO);
  if (!lead) return { piezas: piezasDelTelefono(respaldo.tabs, ['resumen']), sinMarcar: null, saldo: null, saldosCrm: [] };
  const [ficha, insumos, verTracking] = await Promise.all([
    fichaDelFunnelDelLead(lead.funnel_id ?? null),
    leerInsumosDatosLead(lead),
    verTrackingDeLead(lead.funnel_id),
  ]);
  const efectiva = ficha?.efectiva ?? respaldo;
  const saldosCrm = await saldosDeCrms(lead);
  // Con una renovación con plata, la pieza del estado de cuenta se ve aunque la casa no tenga nada.
  const verPagos = saldosCrm.length > 0 || tieneDeal({ estado: lead.estado_lead, etapa: pipelineStageOf(lead), cuotas: insumos.pagos.length, planEnLead: planEnLead(lead) });
  const piezas = piezasDelTelefono(efectiva.tabs, tabsQueVe({ verTracking, verReuniones: tieneEtapaDeReunion(insumos.stages), verPagos }));
  let sinMarcar: number | null = null;
  try {
    sinMarcar = (await datosSinMarcarDeLead(lead, insumos)).datos.avisar.length;
  } catch (e) {
    console.error(`[m/crm] datos sin marcar ${lead.id}: ${msg(e)}`);
  }
  return { piezas, sinMarcar, saldo: verPagos ? await saldoDelLead(lead, insumos.pagos) : null, saldosCrm };
}

/**
 * El estado de cuenta de cada CRM agregado con plata (una venta o pagos), con la cuenta del escritorio sobre SU trato
 * (`leadConTrato`, lib/pagos-crm.ts): lo que ve la tab Pagos mirando ese CRM. Nunca tira: sin leer, ninguno.
 */
async function saldosDeCrms(lead: Lead): Promise<Array<{ crm: string; saldo: SaldoTelefono }>> {
  try {
    const [tratos, funnels, hoy] = await Promise.all([tratosDelLead(lead.id), listarFunnels(), hoyEnWorkspace()]);
    const out: Array<{ crm: string; saldo: SaldoTelefono }> = [];
    for (const t of tratos) {
      if (!t.pagos.length && t.monto_cierre_usd == null) continue;
      const l = leadConTrato(lead, t);
      const cobrado = cobradoDelLead({
        ventaTipo: l.venta_tipo ?? null, montoCierreUsd: l.monto_cierre_usd ?? null, suscripcionMontoUsd: null, suscripcionMeses: null,
        fechaCierre: l.fecha_cierre ?? null, pagos: t.pagos, cobros: [], hoy,
      });
      const saldo = saldoDelTelefono(estadoDeCuenta({ cobrado, pagos: t.pagos, ganado: l.estado_lead === 'ganado', hoy }));
      const f = funnels.find((x) => x.id === t.funnelId);
      if (saldo) out.push({ crm: f ? nombreVisible(f) : 'Otro CRM', saldo });
    }
    return out;
  } catch (e) {
    console.error(`[m/crm] estado de cuenta de los otros CRMs ${lead.id}: ${msg(e)}`);
    return [];
  }
}

/**
 * El estado de cuenta del lead, con la cuenta del escritorio (`cobradoDelLead` + `estadoDeCuenta`): las cuotas y,
 * para una suscripción de la pasarela, sus cobros (una renovación rechazada se dice). Nunca tira: sin los cobros,
 * cuenta con las cuotas.
 */
async function saldoDelLead(lead: Lead, pagos: Awaited<ReturnType<typeof leerInsumosDatosLead>>['pagos']): Promise<SaldoTelefono | null> {
  try {
    const ws = await getWorkspaceActual();
    const [cobros, hoy, cambios] = await Promise.all([
      ws != null ? listarCobros(ws, { leadId: lead.id, limite: 50 }).catch(() => []) : Promise.resolve([]),
      hoyEnWorkspace(),
      // Los cambios de la suscripción (mig 0401): la misma cuenta mes a mes que la tab Pagos del escritorio.
      lead.venta_tipo === 'suscripcion' ? cambiosDeSuscripcion(lead.id) : Promise.resolve(null),
    ]);
    const fila = lead as unknown as Record<string, unknown>;
    const cobrado = cobradoDelLead({
      ventaTipo: lead.venta_tipo ?? null, montoCierreUsd: lead.monto_cierre_usd ?? null, suscripcionMontoUsd: lead.suscripcion_monto_usd ?? null,
      suscripcionMeses: lead.suscripcion_meses ?? null, fechaCierre: lead.fecha_cierre ?? null,
      suscripcionCanceladaAt: (fila.suscripcion_cancelada_at as string | null | undefined) ?? null, pagos, cobros, hoy,
      movimientos: cambios?.movimientos ?? [],
    });
    return saldoDelTelefono(estadoDeCuenta({ cobrado, pagos, ganado: lead.estado_lead === 'ganado', hoy }));
  } catch (e) {
    console.error(`[m/crm] estado de cuenta ${lead.id}: ${msg(e)}`);
    return null;
  }
}

/** Las notas que viajan (la ficha dibuja 3 y el resto abre en un sheet); las más viejas, en el historial de escritorio. */
const TOPE_NOTAS = 20;
const TOPE_ACTIVIDAD = 4;

/** La ficha en LECTURA. null = el lead no es de este workspace (o no existe). */
export async function fichaV2(leadId: number): Promise<FichaV2 | null> {
  // El lead entero va en paralelo con la ficha del teléfono: lo piden la ficha del funnel y «N sin marcar».
  // getLead es del workspace, y sin `f` (el lead no es de esta cuenta) no se usa.
  const [f, lead] = await Promise.all([fichaMovil(leadId), getLead(leadId).catch(() => null)]);
  if (!f) return null;
  const casa = f.casa ?? f.productos[0] ?? null;
  // Cuánto lleva en su etapa: la MISMA lectura que el bloque de escritorio (`tiempoEnEtapaAction`), sólo si la ficha
  // del funnel pone ese bloque (no se paga una lectura del historial para una fila que no se dibuja).
  const [audit, stages, delFunnel] = await Promise.all([
    getLeadAuditAction(leadId).catch((e) => { console.error(`[m/crm] historial ${leadId}: ${msg(e)}`); return []; }),
    casa ? etapasDeProducto(casa.funnelId).catch(() => []) : Promise.resolve([]),
    fichaDelFunnel(lead),
  ]);
  const enEtapa = delFunnel.piezas.some((x) => x.pieza === 'en-etapa') ? await tiempoEnEtapaAction(leadId).catch(() => null) : null;
  // «Automatizaciones» (23/10/2026): la misma lectura que el bloque de escritorio, sólo si la ficha del funnel lo pone.
  const auts = delFunnel.piezas.some((x) => x.pieza === 'automatizaciones')
    ? await enAutomatizaciones([leadId]).then((m) => m.get(leadId) ?? []).catch((e) => { console.error(`[m/crm] automatizaciones ${leadId}: ${msg(e)}`); return null; })
    : null;
  const vistaAuts = auts ? vistaDeEnAutomatizacion(auts) : null;
  const etiqueta = (v: string) => stages.find((s) => s.key === v)?.label ?? stages.find((s) => s.label === v)?.label;
  const ahora = Date.now();
  const notasTodas = audit.filter((r) => r.campo === 'Nota' && (r.valor_nuevo ?? '').trim());
  const notas = notasTodas.slice(0, TOPE_NOTAS).map((r) => ({
    id: r.id, texto: (r.valor_nuevo ?? '').trim(), cuando: cuandoEnLista(r.created_at, f.tz, f.hoy), autor: r.autor_nombre,
  }));
  const actividad = audit
    .filter((r) => !FUERA_DE_ACTIVIDAD.has(r.campo))
    .slice(0, TOPE_ACTIVIDAD)
    .map((r) => ({ id: r.id, ...lineaActividad(r.campo, r.valor_nuevo, etiqueta), riel: cuandoEnLista(r.created_at, f.tz, f.hoy) }));

  return {
    f,
    proxima: proximaLlamada(f.reuniones, ahora, f.tz, f.hoy)?.texto ?? null,
    llegoPor: llegoPor(lead ? canalDeLead(lead) : f.origen.canal, f.origen.anuncio || f.origen.campana),
    notas,
    totalNotas: notasTodas.length,
    actividad,
    ...delFunnel,
    progreso: casa && stages.length ? progresoEnFunnel(stages, casa.etapa) : null,
    resumen: lead ? resumenDelTelefono(lead, {
      etapa: casa?.etapa ?? null, hoy: f.hoy, ahoraMs: ahora,
      siguiente: f.siguiente, enEtapa,
      automatizaciones: vistaAuts ? filaDeAutomatizaciones(vistaAuts, (iso) => fechaCorta(iso, f.tz, ahora)) : null,
    }) : null,
    autTono: vistaAuts ? tonoDeAutomatizaciones(vistaAuts) : null,
    // ⚠️ Con el lead ENTERO (`getLead`, select *) y su `telefono_normalizado`, NO con `f.telefono`: ése es `numeroCanonico` y da
    // null debajo de 10 dígitos, así que un teléfono corto se leería como «sin teléfono» y el lead pasaría por «sólo Instagram»
    // (ver `soloInstagram`, ./reglas.ts).
    soloInstagram: lead ? soloInstagram({ email: lead.email, telefonoNorm: lead.telefono_normalizado, instagram: lead.instagram }) : null,
  };
}

// ── El tablero (v3, 14/10/2026) ──────────────────────────────────────────────
// Martín: el CRM del teléfono es el TABLERO de escritorio, con menos cosas. Las mismas lecturas
// que app/crm/page.tsx: el funnel de la URL validado contra los de ESTE workspace (un id ajeno
// cae al del negocio, como en escritorio), sus etapas, sus leads con la columna en la que los
// dibuja CrmBoard (mapToCrmLead + etapasDelTablero), el orden manual de cada columna y la suma
// de plata de la columna (totalDeColumna). Las columnas van como las bandas de escritorio
// (pipeline → nutrición → salidas), en una sola fila.

/** Cuántas tarjetas viajan por columna. El conteo dice el total; el resto, en la computadora. */
const TOPE_COLUMNA = 40;

/**
 * El RELLENO de `mapToCrmLead` (app/crm/crm-map.ts) cuando el lead no tiene empresa: no es un dato. La fila del
 * teléfono decía «Sin empresa» en casi todos los leads (medido en el ws9 el 17/10/2026) y nunca llegaba a decir por
 * dónde llegó, que era su respaldo. Pipedrive pone ahí «$ · organización · persona»: lo que haya.
 */
const SIN_EMPRESA = 'Sin empresa';

export type TarjetaCrmM = {
  id: number;
  col: string;
  nombre: string;
  /** La empresa o por dónde llegó. */
  segunda: string | null;
  /**
   * A la derecha de la fila (17/10/2026, el indicador de Pipedrive): la reunión agendada, el plazo de la Nutrición
   * manual o cuándo llegó (`senalDeTarjeta`, ./reglas.ts). Lo mismo que el pie de la tarjeta de escritorio.
   */
  senal: SenalTarjeta;
  /** El monto (o el estimado, con «≈»), corto. */
  plata: string | null;
  /** Por dónde llegó (`canalDeLead`): el subtítulo y la insignia de la cara (17/10/2026, la familia de tarjetas). */
  canal: string;
  /** La cara: la elegida o la de WhatsApp guardada. Sin ninguna, iniciales. */
  foto: string | null;
  /** Sólo dígitos, para Llamar y WhatsApp en la ficha rápida. */
  telefono: string | null;
  /**
   * El @ (sin la @) cuando es su ÚNICO canal, sin email ni teléfono (23/10/2026, `soloInstagram`, ./reglas.ts): la tarjeta lo
   * dibuja como un chip, como la de escritorio, y la ficha rápida ofrece abrir su Instagram donde las demás ofrecen WhatsApp.
   * Viaja el usuario y no el `instagram` de todos los leads: sólo el de quien lo necesita. null = tiene otro canal.
   */
  soloInstagram: string | null;
  /** Sólo con `conContacto` (MaKo sin conexión, 28/10/2026): lo que dibuja la ficha sin conexión. El teléfono no lo pide. */
  contacto?: ContactoCopia;
};

/** «Próximo» (17/10/2026, la destacada del prototipo): la próxima reunión que todavía no pasó. */
export type ProximoCrmM = { id: number; nombre: string; cuando: string; plata: string | null; telefono: string | null; foto: string | null; col: string;
  /** Para la tarjeta que prepara la reunión (22/10/2026, app/crm/TarjetaReunion.tsx): el día, la hora, el link y la empresa. */
  fecha: string | null; dia: string; at: string | null; url: string | null; empresa: string | null };

export type TableroCrmM = {
  /** null = el funnel del negocio (como `leads.funnel_id`). */
  funnelId: number | null;
  /** El selector: el del negocio primero. Con uno solo, no hay selector. */
  funnels: Array<{ id: number | null; nombre: string }>;
  /** `movible`: se puede llevar un lead ACÁ desde el teléfono; `sale`: se puede sacar uno de acá. */
  columnas: Array<{ key: string; titulo: string; total: string | null; cuantos: number; movible: boolean; sale: boolean; camino: boolean }>;
  tarjetas: TarjetaCrmM[];
  proximo: ProximoCrmM | null;
  /** Qué muestra la tarjeta para quien mira (20/10/2026): la MISMA elección que en la computadora (lib/perfil.ts). */
  campos: CampoTarjetaLead[];
};

const BANDA_ORDEN = ['pipeline', 'nutricion', 'salidas'];

/** El tablero de un funnel. null = no se pudo leer. */
/**
 * `op` (MaKo sin conexión, 28/10/2026, app/api/sin-conexion/copia): `tope` las tarjetas por columna (el teléfono, 40) y
 * `conContacto` el email, la empresa, el origen, cuándo llegó, la reunión y el monto de cada una. Sin `op`, lo del teléfono.
 */
export async function tableroCrm(funnelPedido: number | null, op: { tope?: number; conContacto?: boolean } = {}): Promise<TableroCrmM | null> {
  try {
    const ws = await getWorkspaceActual();
    const [tz, hoy, funnels] = await Promise.all([
      ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
      hoyEnWorkspace(),
      listarFunnels().catch(() => []),
    ]);
    const funnelId = funnels.some((f) => f.id === funnelPedido && !f.esDefault) ? funnelPedido : null;
    const [leads, campMap, stagesRaw, orden] = await Promise.all([
      listLeadsDeFunnel(funnelId),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      (funnelId ? getFunnelDe(funnelId).then((f) => f.stages) : getPipelineStagesDefault()).catch(() => generateFunnel(DEFAULT_PIPELINE).stages),
      leerOrdenManual(funnelId),
    ]);
    const stages = [...stagesRaw].sort((a, b) =>
      (BANDA_ORDEN.indexOf(a.band ?? 'pipeline') - BANDA_ORDEN.indexOf(b.band ?? 'pipeline')) || ((a.col ?? 0) - (b.col ?? 0)));
    const tablero = etapasDelTablero(stages);
    // ⚠️ LA COLUMNA DE CADA LEAD SE CUENTA CON LAS ETAPAS EN EL ORDEN DEL FUNNEL, no en el de las
    // columnas: una etapa que el funnel ya no tiene cae a la PRIMERA (etapaEnTablero), y la primera
    // es la del funnel, la misma que usan CrmBoard y moverEtapaAction.
    const keys = stagesRaw.map((s) => s.key);
    // El más nuevo arriba (el orden de llegada de escritorio); después, el orden manual de cada columna.
    const crm = leads.map((l) => mapToCrmLead(l, campMap, tablero))
      .sort((a, b) => (Date.parse(b.createdISO ?? '') || 0) - (Date.parse(a.createdISO ?? '') || 0));
    const ordenados = ordenarKanbanManual(crm, (c) => c.id, (c) => etapaEnTablero(c.stage, keys), (e) => orden[e]);

    const porCol = new Map<string, typeof ordenados>(keys.map((k) => [k, []]));
    for (const c of ordenados) porCol.get(etapaEnTablero(c.stage, keys))?.push(c);

    const tarjetas: TarjetaCrmM[] = [];
    const ahoraMs = Date.now();
    for (const [col, cs] of porCol) {
      for (const c of cs.slice(0, op.tope ?? TOPE_COLUMNA)) {
        const monto = c.monto > 0 ? plataCorta(c.monto) : (c.ingresoEstimado ?? 0) > 0 ? `≈ ${plataCorta(c.ingresoEstimado ?? 0)}` : null;
        const empresa = c.company?.trim();
        tarjetas.push({
          id: c.id, col, nombre: c.name?.trim() || 'Sin nombre',
          segunda: (empresa && empresa !== SIN_EMPRESA ? empresa : null) || llegoPor(c.canal, c.origin) || null,
          senal: senalDeTarjeta({
            reunionISO: c.fechaJ1, manualDeadline: c.nutriManualDeadline, enManual: col === 'manual',
            abierto: c.estadoLead === 'abierto', creadoISO: c.createdISO,
          }, ahoraMs, tz, hoy),
          plata: monto,
          canal: c.canal,
          foto: c.foto ?? null,
          telefono: c.telefonoNorm ?? null,
          soloInstagram: soloInstagram({ email: c.email, telefonoNorm: c.telefonoNorm, instagram: c.instagram }),
          ...(op.conContacto ? {
            contacto: {
              email: c.email?.trim() || null, empresa: empresa && empresa !== SIN_EMPRESA ? empresa : null,
              origen: llegoPor(c.canal, c.origin) || null, creado: c.createdISO || null, reunion: c.fechaJ1 ?? null, monto: c.monto,
            },
          } : {}),
        });
      }
    }
    // «Próximo»: la reunión más cercana que no pasó, de un lead abierto. Una fecha sin hora (sólo el día) cuenta todo
    // el día; una con hora, hasta una hora después de empezar (la misma gracia que las reuniones de escritorio).
    let proximo: ProximoCrmM | null = null;
    {
      let mejor: { c: (typeof ordenados)[number]; ms: number } | null = null;
      for (const c of ordenados) {
        if (c.estadoLead !== 'abierto' || !c.fechaJ1) continue;
        const soloDia = c.fechaJ1.length <= 10;
        const ms = Date.parse(soloDia ? `${c.fechaJ1}T23:59:59` : c.fechaJ1);
        if (!Number.isFinite(ms)) continue;
        if (soloDia ? c.fechaJ1 < hoy : ms + 60 * 60_000 < ahoraMs) continue;
        if (!mejor || ms < mejor.ms) mejor = { c, ms };
      }
      if (mejor) {
        const c = mejor.c;
        const col = etapaEnTablero(c.stage, keys);
        const senal = senalDeTarjeta({ reunionISO: c.fechaJ1, manualDeadline: null, enManual: false, abierto: true, creadoISO: c.createdISO }, ahoraMs, tz, hoy);
        const plata = c.monto > 0 ? plataCorta(c.monto) : (c.ingresoEstimado ?? 0) > 0 ? `≈ ${plataCorta(c.ingresoEstimado ?? 0)}` : null;
        const soloDia = c.fechaJ1!.length <= 10;
        const empresa = c.company?.trim();
        proximo = {
          id: c.id, nombre: c.name?.trim() || 'Sin nombre', cuando: senal.tono === 'verde' && senal.texto ? senal.texto : (soloDia ? (c.fechaJ1 === hoy ? 'Hoy' : c.fechaJ1!.slice(8, 10) + '/' + c.fechaJ1!.slice(5, 7)) : 'Ahora'), plata, telefono: c.telefonoNorm ?? null, foto: c.foto ?? null, col,
          // Con sólo el día, la hora es `junta_1_at` (la tarjeta la usa sólo si cae ese día); con instante, ése.
          fecha: soloDia ? c.fechaJ1 : null,
          dia: soloDia ? (c.fechaJ1 === hoy ? 'hoy' : `${c.fechaJ1!.slice(8, 10)}/${c.fechaJ1!.slice(5, 7)}`) : 'hoy',
          at: soloDia ? c.atJ1 ?? null : c.fechaJ1, url: c.urlJ1 ?? null,
          empresa: empresa && empresa !== SIN_EMPRESA ? empresa : null,
        };
      }
    }
    const lite = stages.map((s) => ({ key: s.key, label: s.label, kind: s.kind ?? null }));
    const def = funnels.find((f) => f.esDefault);
    return {
      funnelId,
      funnels: [
        // El nombre, con LA regla de la casa (nombreVisible): no una copia, que es la que se queda vieja.
        { id: null, nombre: (def ? nombreVisible(def) : '') || FUNNEL_DEFAULT_NOMBRE },
        ...funnels.filter((f) => !f.esDefault).map((f) => ({ id: f.id, nombre: nombreVisible(f) })),
      ],
      columnas: stages.map((s) => {
        const cs = porCol.get(s.key) ?? [];
        const t = totalDeColumna(s.key, cs);
        return {
          key: s.key, titulo: s.label, total: t ? textoDelTotal(t) : null, cuantos: cs.length,
          movible: seMueveEnElTelefono(lite, s.key), sale: seSacaEnElTelefono(lite, s.key),
          // Es un PASO del recorrido (la banda pipeline): la barra de «Paso N de M» no cuenta nutrición ni salidas.
          camino: (s.band ?? 'pipeline') === 'pipeline',
        };
      }),
      tarjetas,
      proximo,
      campos: (await getCamposTarjetaCrm()).campos,
    };
  } catch (e) {
    console.error(`[m/crm] tablero: ${msg(e)}`);
    return null;
  }
}
