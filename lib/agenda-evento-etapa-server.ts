import 'server-only';

// =============================================================================
// agenda-evento-etapa-server — la base y las agendas detrás del vínculo evento → etapa
// =============================================================================
// Las reglas (puras, con test) viven en lib/agenda-evento-etapa.ts; acá se leen y escriben las filas
// de `agenda_evento_etapa` (mig 0293), se habla con Calendly y Cal.com para listar los eventos del
// negocio, y se ubica al lead que reservó. Lo usan los dos webhooks, la API de MaKo (área crm) y las
// server actions de la pantalla (app/crm/agenda-evento-actions.ts). Una implementación, tres puertas.
//
// Lo que NO se ve leyendo el código y ya importa:
//
//   · SIN FILA EN `webhook_routing` EL VÍNCULO NO SIRVE. El webhook resuelve de qué negocio es una
//     reserva por ese índice (lib/webhook-routing.ts), y la fila de una credencial J1/J2 la escribe su
//     guardado. La de un evento vinculado la reclama `vincularEvento` (primer reclamante gana: si es
//     de otro negocio, no se vincula) y la suelta `desvincularEvento`, pero SÓLO si ya nadie la usa:
//     el evento de la R1 suele ser el mismo que el vinculado, y soltarlo dejaría la R1 «sin_ruteo».
//   · `eliminarCredencial` borra TODAS las filas del servicio (`borrarRoutingDeWs`): quitar la R2
//     se llevaba la de la R1 y, desde hoy, las de los eventos vinculados. Después de borrar se vuelve
//     a reclamar lo que se sigue usando (`reclamarRuteoDeAgenda`).
//   · «NO PUDE LEER» NO ES «NO HAY VÍNCULOS». Las lecturas del webhook son estrictas: un error de la
//     base tira y sale por el clasificador del webhook (transitorio → 503 y Calendly reintenta). Sólo
//     la tabla que FALTA (la mig 0293 sin aplicar) se lee como «ninguno», que es verdad: nadie pudo
//     vincular nada sin la tabla.
// =============================================================================

import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { credWs, credWsEstricta } from './credenciales';
import { upsertRouting, soltarIdentificador } from './webhook-routing';
import { listarEventTypes } from './calendly-agenda';
import { listarEventTypesCalcom } from './calcom';
import { listarFunnels } from './funnels';
import { filaAFunnel, COLS, type FilaFunnel } from './funnel-fila';
import { casaParaEscribir, casaReal, nombreVisible } from './lead-funnel-reglas';
import { etapaVigenteDe } from './funnel-etapas';
import { productosDelLead, agregarAProducto, moverEtapaEnProducto, etapasDeProducto } from './lead-funnel';
import { getLead, setPipelineStage, type Lead } from './leads';
import {
  CREDS_DE_REUNION, NOMBRE_PROVEEDOR, PROVEEDORES_AGENDA, SERVICIO_DE_RUTEO, MAX_IDENTIFICADOR,
  esProveedorAgenda, faltaLaTabla, identificadoresNecesarios, mismoIdentificador, moverAlReservar,
  problemaDeVinculo, reunionDeEtapa, rutaDeEvento,
  type FunnelDelNegocio, type ProveedorAgenda, type RutaDeReserva, type VinculoEvento,
} from './agenda-evento-etapa';

const TABLA = 'agenda_evento_etapa';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Un error de la base con su `code` (lo lee el clasificador del webhook de Calendly). */
function errorDeBase(donde: string, error: { message: string; code?: string; details?: string | null; hint?: string | null }): Error {
  return Object.assign(new Error(`${donde}: ${error.message}`), { code: error.code, details: error.details, hint: error.hint });
}

type FilaVinculo = { id: number | string; workspace_id: number | string; proveedor: string; identificador: string; nombre: string | null; funnel_id: number | string; etapa: string };

const aVinculo = (f: FilaVinculo): (VinculoEvento & { id: number }) | null => (esProveedorAgenda(f.proveedor)
  ? { id: Number(f.id), workspaceId: Number(f.workspace_id), proveedor: f.proveedor, identificador: f.identificador, nombre: f.nombre ?? null, funnelId: Number(f.funnel_id), etapa: f.etapa }
  : null);

/**
 * Los vínculos del negocio EN CURSO. Estricta: un error tira. La tabla que falta (mig 0293 sin
 * aplicar) es `{ vinculos: [], tabla: false }`: nadie pudo vincular nada.
 */
export async function leerVinculos(): Promise<{ vinculos: Array<VinculoEvento & { id: number }>; tabla: boolean }> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select('id, workspace_id, proveedor, identificador, nombre, funnel_id, etapa').order('id');
  if (error) {
    if (faltaLaTabla(error)) return { vinculos: [], tabla: false };
    throw errorDeBase('agenda_evento_etapa', error);
  }
  return { vinculos: ((data ?? []) as FilaVinculo[]).map(aVinculo).filter((v): v is VinculoEvento & { id: number } => !!v), tabla: true };
}

type FunnelLeido = FunnelDelNegocio & { esDefault: boolean; nombre: string; etiquetas: Record<string, string> };

/** Los embudos ACTIVOS del negocio en curso, con su pipeline. Estricta: un error tira. */
async function leerFunnelsActivos(): Promise<FunnelLeido[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('funnels').select(`${COLS}, workspace_id`).eq('activo', true).order('id');
  if (error) throw errorDeBase('funnels', error);
  return ((data ?? []) as unknown as Array<FilaFunnel & { workspace_id: number | string }>).map((f) => {
    const cfg = filaAFunnel(f);
    const etiquetas: Record<string, string> = {};
    for (const s of cfg.pipeline) etiquetas[s.key] = s.label;
    return { id: Number(f.id), workspaceId: Number(f.workspace_id), pipeline: cfg.pipeline, esDefault: cfg.esDefault, nombre: cfg.nombre, etiquetas };
  });
}

// ── EL WEBHOOK ─────────────────────────────────────────────────────────────────

/** Lo que el webhook necesita de un evento vinculado: la ruta, y con qué casa nace un lead nuevo. */
export type ReservaVinculada = {
  ruta: RutaDeReserva | null;
  /** Para `upsertLeadFromCalendly` (sólo al CREAR): la casa ya traducida (`casaParaEscribir`) y la etapa. */
  alCrear: { funnelId: number | null; etapa: string } | null;
  /** Los embudos leídos, para ubicar sin volver a leer. */
  funnels: FunnelDelNegocio[];
  /** El id del producto del NEGOCIO (`es_default`), de la MISMA lectura estricta. */
  defaultId: number | null;
};

/**
 * ¿Esta reserva es de un evento vinculado? Corre adentro de `runWithWorkspace(ws)` del webhook.
 * Sin vínculos no lee los embudos: un negocio que no vinculó nada paga UNA lectura más por reserva.
 */
export async function rutaDeReserva(proveedor: ProveedorAgenda, candidatos: readonly (string | null | undefined)[], ws: number): Promise<ReservaVinculada> {
  const { vinculos } = await leerVinculos();
  const delProveedor = vinculos.filter((v) => v.proveedor === proveedor);
  if (!delProveedor.length) return { ruta: null, alCrear: null, funnels: [], defaultId: null };
  const funnels = await leerFunnelsActivos();
  // ⚠️ El producto del NEGOCIO se escribe NULL en `leads.funnel_id` (`casaParaEscribir`): con su id
  // escrito, el lead no aparece en NINGÚN tablero. El id del default sale de la MISMA lectura.
  const defaultId = funnels.find((f) => f.esDefault)?.id ?? null;
  const ruta = rutaDeEvento({ ws, proveedor, candidatos, vinculos: delProveedor, funnels });
  if (!ruta) return { ruta: null, alCrear: null, funnels, defaultId };
  return { ruta, alCrear: { funnelId: casaParaEscribir(ruta.funnelId, defaultId), etapa: ruta.etapa }, funnels, defaultId };
}

/**
 * Pone al lead que reservó un evento vinculado en ESA etapa de ESE embudo. Se llama con el lead YA
 * escrito por la reserva (la fecha puesta), y nunca para un lead recién creado (nace en su lugar).
 *
 *   · Si ese embudo es su CASA: se mueve por `setPipelineStage` (el choke point de todo movimiento:
 *     historial, etiquetas, automatización de la etapa) — salvo que `moverAlReservar` diga que no.
 *   · Si está AGREGADO a ese embudo: se mueve su fila (`moverEtapaEnProducto`), con la misma regla.
 *   · Si no está: se lo AGREGA en esa etapa (`agregarAProducto`). Su casa NO cambia: «no se debe
 *     "Mover", se debe agregar al otro producto» (Martín, 06/10/2026).
 *
 * Devuelve qué hizo, para el log y la respuesta del webhook.
 */
export async function ubicarReservaVinculada(lead: Lead, reserva: ReservaVinculada, canal: string): Promise<string> {
  const ruta = reserva.ruta;
  if (!ruta) return 'sin vínculo';
  const pipeline = reserva.funnels.find((f) => f.id === ruta.funnelId)?.pipeline ?? [];
  const porQue = `Reservó en ${canal} el evento vinculado a esta etapa.`;

  // La casa se resuelve con el default de la lectura ESTRICTA del webhook, no con `idDelFunnelDefault`: ésa
  // devuelve null si la base tose, y entonces el lead del producto principal (funnel_id NULL) parecía no
  // estar en él y se le agregaba una fila para su propia casa — lo que el modelo prohíbe.
  if (casaReal(lead.funnel_id ?? null, reserva.defaultId) === ruta.funnelId) {
    // ⚠️ RELEÍDO, no el que trajo el webhook: el de la R2 es el de ANTES de escribir la fecha, y con
    // él la etapa derivada todavía es la R1 — se movía a la R2 a mano y quedaba un override que
    // después frena la derivación (asistió a la R2 → Facturando). Con la fecha ya escrita, en un
    // embudo con las etapas de siempre la derivada YA es la vinculada y no se escribe nada.
    const fresco = (await getLead(lead.id)) ?? lead;
    const actual = etapaVigenteDe(fresco, (await etapasDeProducto(ruta.funnelId)).map((s) => ({ key: s.key, kind: s.kind ?? undefined })));
    if (!moverAlReservar(pipeline, actual, ruta.etapa, fresco.estado_lead)) return `casa: se queda en ${actual}`;
    await setPipelineStage(lead.id, ruta.etapa, { autor: canal, requisitos: { omitir: porQue } });
    return `casa: ${actual} → ${ruta.etapa}`;
  }
  const { productos } = await productosDelLead(lead.id);
  const enEse = productos.find((p) => !p.esCasa && p.funnelId === ruta.funnelId);
  if (enEse) {
    if (!moverAlReservar(pipeline, enEse.etapa, ruta.etapa)) return `agregado: se queda en ${enEse.etapa}`;
    await moverEtapaEnProducto(lead.id, ruta.funnelId, ruta.etapa, { autor: canal });
    return `agregado: ${enEse.etapa} → ${ruta.etapa}`;
  }
  await agregarAProducto(lead.id, ruta.funnelId, { autor: canal, etapa: ruta.etapa });
  return `agregado al funnel ${ruta.funnelId} en ${ruta.etapa}`;
}

// ── LOS EVENTOS DE LA AGENDA DEL NEGOCIO ───────────────────────────────────────

/** Un tipo de evento de la agenda del negocio, como lo leen la pantalla y la API. */
export type EventoDeAgenda = {
  proveedor: ProveedorAgenda;
  /** El que se vincula y el que llega en el webhook (Calendly: URI del event type; Cal.com: su id). */
  identificador: string;
  nombre: string;
  duracionMin: number | null;
  /** Si es el que está cargado como R1 o R2 en Integraciones (CALENDLY/CALCOM_EVENT_TYPE_J1/J2). */
  credencial: 'R1' | 'R2' | null;
  /** false: sigue vinculado pero ya no aparece en la cuenta (se desactivó o se borró allá). */
  enLaCuenta: boolean;
  vinculo: { funnelId: number; funnel: string; etapa: string; etapaNombre: string; reunion: 'R1' | 'R2' | null } | null;
};

/** Una etapa a la que se le puede vincular un evento: de reunión, R1 o R2, en un embudo activo. */
export type EtapaVinculable = { funnelId: number; funnel: string; etapa: string; etapaNombre: string; reunion: 'R1' | 'R2' };

export type AgendaDelNegocio = {
  eventos: EventoDeAgenda[];
  /** Por proveedor: si está conectado y, si no se pudo leer su cuenta, por qué. */
  proveedores: Array<{ proveedor: ProveedorAgenda; conectado: boolean; error: string | null }>;
  etapas: EtapaVinculable[];
  /** false mientras falte la migración 0293: se lista, pero no se puede vincular. */
  sePuedeVincular: boolean;
};

/** Un evento de la cuenta con los otros nombres con los que alguien lo puede pegar o nombrar. */
type EventoDeCuenta = { identificador: string; nombre: string; duracionMin: number | null; alias: string[] };

/**
 * Los eventos de UN proveedor: los de su cuenta (con el token o la API key) más los que estén
 * cargados como R1/R2 y la cuenta no devuelva. Nunca tira: lo que no se pudo leer va en `error`.
 */
async function eventosDelProveedor(proveedor: ProveedorAgenda): Promise<{ eventos: EventoDeCuenta[]; creds: { R1: string | null; R2: string | null }; conectado: boolean; error: string | null }> {
  const claves = CREDS_DE_REUNION[proveedor];
  const [r1, r2] = await Promise.all([credWs(claves.R1).catch(() => null), credWs(claves.R2).catch(() => null)]);
  const creds = { R1: r1?.trim() || null, R2: r2?.trim() || null };
  let eventos: EventoDeCuenta[] = [];
  let error: string | null = null;
  let conAcceso = false;
  try {
    if (proveedor === 'calendly') {
      conAcceso = !!(await credWs('CALENDLY_API_TOKEN'));
      if (conAcceso) {
        eventos = (await listarEventTypes()).map((e) => ({
          identificador: e.uri, nombre: e.nombre || e.uri, duracionMin: e.duracionMin ?? null,
          alias: [e.nombre, e.schedulingUrl].filter((x): x is string => !!x && !!x.trim()),
        }));
      }
    } else {
      const key = await credWs('CALCOM_API_KEY');
      conAcceso = !!key;
      if (key) {
        eventos = (await listarEventTypesCalcom(key)).map((e) => ({
          identificador: e.id, nombre: e.nombre, duracionMin: e.duracionMin,
          alias: [e.slug, e.nombre].filter((x): x is string => !!x && !!x.trim()),
        }));
      }
    }
  } catch (e) {
    error = msg(e).slice(0, 200);
  }
  // Lo cargado como R1/R2 que la cuenta no devolvió (o que no se pudo leer) entra TAL CUAL: es el
  // identificador con el que hoy ya se rutea, así que vincularlo no cambia de qué negocio es.
  for (const c of [creds.R1, creds.R2]) {
    if (!c) continue;
    if (eventos.some((e) => mismoIdentificador(e.identificador, c) || e.alias.some((a) => mismoIdentificador(a, c)))) continue;
    eventos.push({ identificador: c, nombre: c, duracionMin: null, alias: [] });
  }
  return { eventos, creds, conectado: conAcceso || !!creds.R1 || !!creds.R2, error };
}

const calza = (e: EventoDeCuenta, valor: string | null | undefined): boolean =>
  !!valor && (mismoIdentificador(e.identificador, valor) || e.alias.some((a) => mismoIdentificador(a, valor)));

/** Las etapas vinculables de los embudos activos (para la pantalla y para que el modelo elija). */
function etapasVinculables(funnels: readonly FunnelLeido[], nombres: Map<number, string>): EtapaVinculable[] {
  const out: EtapaVinculable[] = [];
  for (const f of funnels) {
    for (const s of f.pipeline) {
      if (problemaDeVinculo(f.pipeline, s.key)) continue;
      const reunion = reunionDeEtapa(f.pipeline, s.key);
      if (reunion) out.push({ funnelId: f.id, funnel: nombres.get(f.id) ?? f.nombre, etapa: s.key, etapaNombre: s.label ?? s.key, reunion });
    }
  }
  return out;
}

/** Los eventos de la agenda del negocio en curso, con su vínculo. Tira sólo si la base no contesta. */
export async function listarEventosDeAgenda(): Promise<AgendaDelNegocio> {
  const [{ vinculos, tabla }, funnels, resumen] = await Promise.all([leerVinculos(), leerFunnelsActivos(), listarFunnels()]);
  const nombres = new Map(resumen.map((f) => [f.id, nombreVisible(f)]));
  const eventos: EventoDeAgenda[] = [];
  const proveedores: AgendaDelNegocio['proveedores'] = [];
  for (const proveedor of PROVEEDORES_AGENDA) {
    const p = await eventosDelProveedor(proveedor);
    proveedores.push({ proveedor, conectado: p.conectado, error: p.error });
    const suyos = vinculos.filter((v) => v.proveedor === proveedor);
    const vinculoVisible = (v: VinculoEvento | undefined): EventoDeAgenda['vinculo'] => {
      if (!v) return null;
      const f = funnels.find((x) => x.id === v.funnelId);
      return { funnelId: v.funnelId, funnel: nombres.get(v.funnelId) ?? f?.nombre ?? `#${v.funnelId}`, etapa: v.etapa, etapaNombre: f?.etiquetas[v.etapa] ?? v.etapa, reunion: f ? reunionDeEtapa(f.pipeline, v.etapa) : null };
    };
    for (const e of p.eventos) {
      eventos.push({
        proveedor, identificador: e.identificador, nombre: e.nombre, duracionMin: e.duracionMin,
        credencial: calza(e, p.creds.R1) ? 'R1' : calza(e, p.creds.R2) ? 'R2' : null,
        enLaCuenta: true,
        vinculo: vinculoVisible(suyos.find((v) => calza(e, v.identificador))),
      });
    }
    // Vinculados que la cuenta ya no devuelve: se muestran igual, para poder desvincularlos.
    for (const v of suyos) {
      if (p.eventos.some((e) => calza(e, v.identificador))) continue;
      eventos.push({ proveedor, identificador: v.identificador, nombre: v.nombre || v.identificador, duracionMin: null, credencial: null, enLaCuenta: false, vinculo: vinculoVisible(v) });
    }
  }
  return { eventos, proveedores, etapas: etapasVinculables(funnels, nombres), sePuedeVincular: tabla };
}

// ── VINCULAR Y DESVINCULAR ─────────────────────────────────────────────────────

/** Lo que se va a vincular, ya resuelto contra la cuenta y el embudo (no escribe nada). */
export type VinculoPreparado = {
  evento: { proveedor: ProveedorAgenda; identificador: string; nombre: string };
  funnelId: number;
  funnel: string;
  etapa: string;
  etapaNombre: string;
  reunion: 'R1' | 'R2';
  /** Ya está vinculado a ESA etapa: no hay nada que hacer. */
  yaEstaba: boolean;
};

export type ResultadoVincular = ({ ok: true } & VinculoPreparado) | { ok: false; error: string };

/**
 * Todo lo que se puede saber de un vínculo SIN escribir (la API de MaKo lo corre en `preparar()`: lo
 * que falla después de reclamar la pendiente la consume igual). `evento` puede ser el identificador,
 * el nombre o el link de reserva: se resuelve contra la cuenta del negocio y se guarda el
 * identificador con el que llega el webhook.
 *
 * ⚠️ SÓLO EVENTOS DE SU CUENTA (o cargados como R1/R2). Los identificadores no son secretos: si
 * cualquiera pudiera vincular cualquier evento, el primero en pegar el de otro negocio se quedaría con
 * sus reservas (el «primer reclamante gana» de `webhook_routing` protege al que ya lo tiene, no al
 * que todavía no lo cargó).
 */
export async function prepararVinculo(input: { proveedor: unknown; evento: unknown; funnelId: unknown; etapa: unknown }): Promise<ResultadoVincular> {
  if (!esProveedorAgenda(input.proveedor)) return { ok: false, error: 'La agenda tiene que ser calendly o calcom.' };
  const proveedor = input.proveedor;
  const nombreProv = NOMBRE_PROVEEDOR[proveedor];
  const evento = typeof input.evento === 'string' ? input.evento.trim() : '';
  if (!evento || evento.length > MAX_IDENTIFICADOR) return { ok: false, error: 'Falta el evento.' };
  const funnelId = Number(input.funnelId);
  const etapa = typeof input.etapa === 'string' ? input.etapa.trim() : '';
  if (!Number.isInteger(funnelId) || funnelId <= 0 || !etapa) return { ok: false, error: 'Falta el funnel o la etapa.' };

  const [{ vinculos, tabla }, funnels, resumenFunnels] = await Promise.all([leerVinculos(), leerFunnelsActivos(), listarFunnels()]);
  if (!tabla) return { ok: false, error: 'Falta un paso nuestro en la base (migración 0293): todavía no se puede vincular.' };
  const nombreDe = (id: number) => { const r = resumenFunnels.find((x) => x.id === id); return r ? nombreVisible(r) : funnels.find((x) => x.id === id)?.nombre ?? `#${id}`; };
  const f = funnels.find((x) => x.id === funnelId);
  if (!f) return { ok: false, error: 'Ese funnel no existe o está archivado.' };
  const problema = problemaDeVinculo(f.pipeline, etapa);
  if (problema) return { ok: false, error: problema };
  const reunion = reunionDeEtapa(f.pipeline, etapa)!;

  const cuenta = await eventosDelProveedor(proveedor);
  // Por identificador primero; por nombre o link, sólo si uno solo calza (dos eventos pueden
  // llamarse igual, y elegir uno sería adivinar).
  const exacto = cuenta.eventos.find((x) => mismoIdentificador(x.identificador, evento));
  const porNombre = cuenta.eventos.filter((x) => calza(x, evento));
  if (!exacto && porNombre.length > 1) return { ok: false, error: `Hay ${porNombre.length} eventos que se llaman así en ${nombreProv}: pasa su identificador.` };
  const e = exacto ?? porNombre[0];
  if (!e) {
    if (cuenta.error) return { ok: false, error: `No pude leer tus eventos de ${nombreProv}: ${cuenta.error}` };
    const hay = cuenta.eventos.map((x) => x.nombre).slice(0, 8).join(' · ');
    return { ok: false, error: `Ese evento no está en tu cuenta de ${nombreProv}.${hay ? ` Los que hay: ${hay}.` : ''}` };
  }
  const listo: VinculoPreparado = {
    evento: { proveedor, identificador: e.identificador, nombre: e.nombre },
    funnelId, funnel: nombreDe(funnelId), etapa, etapaNombre: f.etiquetas[etapa] ?? etapa, reunion, yaEstaba: false,
  };

  // UN evento, UN lugar: el segundo vínculo se rechaza (el índice único de la mig 0293 lo vuelve a frenar).
  const ya = vinculos.find((v) => v.proveedor === proveedor && calza(e, v.identificador));
  if (ya) {
    if (ya.funnelId === funnelId && ya.etapa === etapa) return { ok: true, ...listo, yaEstaba: true };
    const otro = funnels.find((x) => x.id === ya.funnelId);
    return { ok: false, error: `Ese evento ya está en «${otro?.etiquetas[ya.etapa] ?? ya.etapa}» de «${nombreDe(ya.funnelId)}». Desvincúlalo primero.` };
  }
  return { ok: true, ...listo };
}

/** Vincula un evento a una etapa de reunión: `prepararVinculo` otra vez (pudo cambiar), el índice del webhook y la fila. */
export async function vincularEvento(input: { proveedor: unknown; evento: unknown; funnelId: unknown; etapa: unknown; autor: string }): Promise<ResultadoVincular> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No hay un negocio elegido.' };
  const p = await prepararVinculo(input);
  if (!p.ok || p.yaEstaba) return p;
  const { proveedor, identificador, nombre } = p.evento;

  // El índice del webhook ANTES que la fila: un vínculo sin ruteo promete reservas que no llegan.
  const ruteo = await upsertRouting(SERVICIO_DE_RUTEO[proveedor], identificador, ws);
  if (ruteo === 'ocupado') return { ok: false, error: `Ese evento de ${NOMBRE_PROVEEDOR[proveedor]} ya lo usa otro negocio en MaKo: no se puede vincular aquí.` };
  if (ruteo === 'error') return { ok: false, error: 'No pude registrar el evento para que lleguen sus reservas. Intenta de nuevo.' };

  const db = await getTenantDb();
  const { error } = await db.from(TABLA).insert({ proveedor, identificador, nombre: nombre.slice(0, 200), funnel_id: p.funnelId, etapa: p.etapa, por: input.autor || 'CRM' });
  if (error) {
    // La fila de ruteo recién reclamada se suelta si ya nadie la usa: un vínculo que no se guardó
    // no puede dejar el evento reclamado por este negocio para siempre.
    await soltarSiNadieLoUsa(proveedor, identificador, ws);
    if (error.code === '23505') return { ok: false, error: 'Ese evento ya quedó vinculado en otra pestaña. Vuelve a abrir la lista.' };
    throw errorDeBase('agenda_evento_etapa', error);
  }
  return p;
}

export type VinculoGuardado = { proveedor: ProveedorAgenda; identificador: string; nombre: string | null; funnelId: number; etapa: string };

/** El vínculo de un evento (por su identificador o su nombre), o null. Estricta. */
export async function buscarVinculo(input: { proveedor: unknown; evento: unknown }): Promise<(VinculoGuardado & { id: number }) | null> {
  if (!esProveedorAgenda(input.proveedor)) return null;
  const proveedor = input.proveedor;
  const evento = typeof input.evento === 'string' ? input.evento.trim() : '';
  if (!evento) return null;
  const { vinculos } = await leerVinculos();
  const v = vinculos.find((x) => x.proveedor === proveedor && (mismoIdentificador(x.identificador, evento) || mismoIdentificador(x.nombre, evento)));
  return v ? { id: v.id, proveedor, identificador: v.identificador, nombre: v.nombre, funnelId: v.funnelId, etapa: v.etapa } : null;
}

export type ResultadoDesvincular =
  | { ok: true; cambio: false }
  | { ok: true; cambio: true; vinculo: VinculoGuardado }
  | { ok: false; error: string };

/**
 * Desvincula un evento (por su identificador o su nombre). Sin vínculo, `cambio: false`. Sus reservas
 * vuelven a lo de antes; la fila de `webhook_routing` se suelta sólo si ya nadie la usa.
 */
export async function desvincularEvento(input: { proveedor: unknown; evento: unknown }): Promise<ResultadoDesvincular> {
  if (!esProveedorAgenda(input.proveedor)) return { ok: false, error: 'La agenda tiene que ser calendly o calcom.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No hay un negocio elegido.' };
  const v = await buscarVinculo(input);
  if (!v) return { ok: true, cambio: false };
  const db = await getTenantDb();
  const { error } = await db.from(TABLA).delete().eq('id', v.id);
  if (error) throw errorDeBase('agenda_evento_etapa', error);
  await soltarSiNadieLoUsa(v.proveedor, v.identificador, ws);
  const { id: _id, ...vinculo } = v;
  return { ok: true, cambio: true, vinculo };
}

// ── EL ÍNDICE DEL WEBHOOK ──────────────────────────────────────────────────────

/**
 * Lo que el negocio `ws` necesita en `webhook_routing` para un proveedor: sus credenciales R1/R2 y
 * sus eventos vinculados. Con `ws` EXPLÍCITO (lo llama `eliminarCredencial`, que lo recibe así).
 * `null` si algo no se pudo leer: «no pude leer» no autoriza a soltar nada.
 */
async function necesariosDe(proveedor: ProveedorAgenda, ws: number): Promise<string[] | null> {
  try {
    const claves = CREDS_DE_REUNION[proveedor];
    const [r1, r2] = await Promise.all([credWsEstricta(claves.R1, ws), credWsEstricta(claves.R2, ws)]);
    const { data, error } = await getSupabaseServer().from(TABLA).select('proveedor, identificador').eq('workspace_id', ws).eq('proveedor', proveedor);
    if (error && !faltaLaTabla(error)) throw errorDeBase('agenda_evento_etapa', error);
    const vinculos = ((error ? [] : data ?? []) as Array<{ proveedor: string; identificador: string }>)
      .filter((v): v is { proveedor: ProveedorAgenda; identificador: string } => esProveedorAgenda(v.proveedor));
    return identificadoresNecesarios({ proveedor, creds: [r1, r2], vinculos });
  } catch (e) {
    console.error(`[agenda-evento] no pude leer qué usa el ws ${ws} de ${proveedor}: ${msg(e)}`);
    return null;
  }
}

/** Suelta el identificador de `webhook_routing` sólo si ni una credencial R1/R2 ni otro vínculo lo usan. */
async function soltarSiNadieLoUsa(proveedor: ProveedorAgenda, identificador: string, ws: number): Promise<void> {
  const necesarios = await necesariosDe(proveedor, ws);
  if (necesarios == null || necesarios.some((x) => mismoIdentificador(x, identificador))) return;
  await soltarIdentificador(SERVICIO_DE_RUTEO[proveedor], identificador, ws);
}

/**
 * Vuelve a reclamar en `webhook_routing` lo que el negocio sigue usando de un servicio de agenda.
 * Lo llama `eliminarCredencial` (lib/credenciales.ts) DESPUÉS de `borrarRoutingDeWs`, que se lleva
 * todas las filas del servicio: sin esto, quitar la R2 dejaba la R1 y los eventos vinculados «sin
 * ruteo» y sus reservas se perdían con un 200. Best-effort: nunca tira.
 */
export async function reclamarRuteoDeAgenda(servicio: string, ws: number): Promise<void> {
  const proveedor = PROVEEDORES_AGENDA.find((p) => SERVICIO_DE_RUTEO[p] === servicio);
  if (!proveedor) return;
  const necesarios = await necesariosDe(proveedor, ws);
  for (const id of necesarios ?? []) {
    const r = await upsertRouting(servicio, id, ws);
    if (r !== 'ok') console.error(`[agenda-evento] el ws ${ws} no pudo volver a reclamar ${servicio}/${id}: ${r}`);
  }
}
