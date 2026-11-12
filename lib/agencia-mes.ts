// =============================================================================
// agencia-mes — la MENSUALIDAD de una agencia: leerla, avisarla al grupo, anotar lo que entra y pausar a quien no paga
// =============================================================================
// Lo puro (el ciclo del 5 al 5, el diferencial, quién está adentro, quién va en pausa, los textos) vive en
// lib/agencia-mes-reglas.ts, con su test; aplicar las pausas, en lib/agencia-mes-pausas.ts; leer el comprobante del grupo, en
// lib/agencia-mes-comprobante.ts. Acá, las lecturas, las escrituras y los envíos al grupo. Las reglas de Martín (5/11/2026),
// en la cabecera de las reglas.
//
// DÓNDE VIVE CADA COSA (el libro de MaKo sobre la agencia, en `app_settings` de la PLATAFORMA, `wsSuperAdmin()`):
//   agencia.mensualidad.<ag>.config                 {desde, entradasDesde, medio, prendidaPor, prendidaAt}
//   agencia.mensualidad.<ag>.pago.<AAAA-MM>         {mes, pagadoEl, totalUsd, pagadoUsd, ordenes[], marcadoPor, marcadoAt, recibo?}
//   agencia.mensualidad.<ag>.entrada.<cliente>      {ws, desde, montoUsd, pagadoUsd, pagadoEl, ordenes[], marcadoPor, recibo?}
//   agencia.mensualidad.<ag>.orden.<ORDEN>          {orden, monto, moneda, montoUsd, fecha, comprobante, aplicado[]}  ← una orden, UNA vez
//   agencia.mensualidad.<ag>.aviso.<AAAA-MM>        {at, totalUsd, canal}                (el aviso del mes: el último total que se dijo)
//   agencia.mensualidad.<ag>.avisoentrada.<cliente>.<día>  {at, montoUsd}                (el PDF de su entrada)
//   agencia.mensualidad.<ag>.pausa.<cuenta>.<causa>        {at}                          (el aviso de que quedó en pausa)
// La corrección del reloj de un cliente: `agencia_clientes.cobra_desde` (mig 0402). «Paga para entrar»: `workspaces.estado` +
// el corte `paga-para-entrar` en `plan.corte_por_pago` de cada cuenta (lib/plan-acceso-reglas.ts).
//
// ⚠️ APAGADA POR DEFECTO. La prende el super admin por agencia (Agency Dashboard o la API). No se prende desde acá.
// ⚠️ LAS LECTURAS QUE DECIDEN UN MONTO O UNA PAUSA SON ESTRICTAS: «no pude leer» tira, y la pausa no corre.
// ⚠️ POR EL GRUPO DE WHATSAPP CON LA AGENCIA, NUNCA A SUS CLIENTES: todo sale al grupo de MaKo de la AGENCIA (`agenciaWs`).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { cambiarSettingSi, borrarSetting, borrarSettingSi, getSettingsConPrefijo, setSetting } from './settings';
import { zonaDelNegocioEstricta } from './timezone';
import { hoyEnTz } from './date-utils';
import { planesMako } from './compra-plan';
import { esAgencia } from './agencia';
import { crearNotificacion } from './notificaciones';
import { anotarLoDelEquipo, enviarAlGrupoMaKo, enviarAlGrupoSuperAdmin, enviarPartesAlGrupoMaKo } from './mako-grupo';
import { atarIdDeWhatsApp, copiarAlGrupo } from './grupo-app';
import type { PartePreparada } from './mako-tarjeta';
import { KEY_PLAN_CAMBIADO, leerCambioDePlan, planDeCapa, type PlanCuenta } from './agencia-cobro-reglas';
import { ESTADOS_CARTERA, type EstadoCartera } from './agencia-cartera';
import { CLAVE_CORTE, leerCorte, type CorteGuardado } from './plan-acceso-reglas';
import { pdfDelCobro, nombreDelPdf } from './agencia-mes-pdf';
import { revisarPausas, type DepsPausas, type EstadoDeCuenta, type LecturaParaPausas, type ResultadoPausas } from './agencia-mes-pausas';
import { reclamarYMandar } from './agencia-mes-avisos';
import {
  conceptoDeLinea, cubre, cuentaDelMes, cuentaDesde, diaCorto, diaLimite, diasEntre, entradaCompleta, entradasPorAvisar, esDia, esMes,
  leerConfigMensualidad, leerEntrada, leerPagoDelMes, mesDe, mesQueSeAvisa, mesesEntre, nombreDelMes, periodoDelCiclo, planQueSeCobra,
  preciosDelCatalogo, situacion, arrancaElReloj, sumarDias, tablaDeEntradas, tablaDelMes, textoDeComprobante, textoDePausaDelMes,
  textoDeMesImpago, textoDelAvisoDeEntradas, textoDelAvisoDelMes, usd, clavePendiente, diferencialDe, DIAS_SIN_COSTO, DIA_LIMITE_DE_PAGO, MEDIO_POR_DEFECTO,
  NOMBRE_PLAN, leerOrden, mesSiguiente,
  type ClienteDeAgencia, type ConfigMensualidad, type CuentaDelMes, type Dia, type Diferencial, type EntradaGuardada, type Mes,
  type OrdenAnotada, type PagoDelMes, type Pendiente, type Precios, type Situacion,
} from './agencia-mes-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const PREFIJO = (ag: number) => `agencia.mensualidad.${ag}.`;
const KEY_CONFIG = (ag: number) => `${PREFIJO(ag)}config`;
const KEY_PAGO = (ag: number, mes: Mes) => `${PREFIJO(ag)}pago.${mes}`;
const KEY_ENTRADA = (ag: number, cliente: number) => `${PREFIJO(ag)}entrada.${cliente}`;
const KEY_ORDEN = (ag: number, orden: string) => `${PREFIJO(ag)}orden.${orden}`;
const KEY_AVISO = (ag: number, mes: Mes) => `${PREFIJO(ag)}aviso.${mes}`;
const KEY_AVISO_ENTRADA = (ag: number, cliente: number, dia: Dia) => `${PREFIJO(ag)}avisoentrada.${cliente}.${dia}`;
const KEY_PAUSA = (ag: number, cuenta: number, causa: string) => `${PREFIJO(ag)}pausa.${cuenta}.${causa.replace(':', '-')}`;
/** El aviso al super admin de un mes que no se pagó: uno por agencia y por mes (#498, 6/11/2026). */
const KEY_IMPAGO = (ag: number, mes: Mes) => `${PREFIJO(ag)}impago.${mes}`;
/** Lo que contesta todo lo que corrige una fecha mientras la migración no esté aplicada. */
export const FALTA_LA_0402 = 'Aplica la migración 0402 (agencia_clientes.cobra_desde) para poder corregir una fecha.';
/** El tipo de aviso en el grupo de la app: lo de la mensualidad, escondido a los invitados (como el recibo). */
export const AVISO_TIPO_MENSUALIDAD = 'recibo';

const enLaPlataforma = async <T>(fn: () => Promise<T>): Promise<T> => runWithWorkspace(await wsSuperAdmin(), fn);
const esWs = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const redondo = (n: number) => Math.round(n * 100) / 100;

// ── Lecturas (estrictas) ──────────────────────────────────────────────────────────────────────────────────────────

/** La columna que falta (la 0402 sin aplicar): PostgREST la rechaza con 42703 o PGRST204. */
const faltaLaColumna = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || (/cobra_desde/.test(e.message ?? '') && /column|columna/i.test(e.message ?? '')));

type FilaCartera = { cliente_ws: number; estado: string; decidido_at: string | null; created_at: string; cobra_desde: string | null };

/** La cartera de la agencia, con la corrección si la migración ya está. «No pude leer» tira. */
async function leerCartera(agenciaWs: number): Promise<{ filas: FilaCartera[]; conColumna: boolean }> {
  const db = getSupabaseServer();
  const con = await db.from('agencia_clientes').select('cliente_ws, estado, decidido_at, created_at, cobra_desde').eq('agencia_ws', agenciaWs);
  if (!con.error) return { filas: (con.data ?? []) as FilaCartera[], conColumna: true };
  if (!faltaLaColumna(con.error)) throw new Error(`No pude leer los clientes de la agencia: ${con.error.message}`);
  const sin = await db.from('agencia_clientes').select('cliente_ws, estado, decidido_at, created_at').eq('agencia_ws', agenciaWs);
  if (sin.error) throw new Error(`No pude leer los clientes de la agencia: ${sin.error.message}`);
  return { filas: ((sin.data ?? []) as Omit<FilaCartera, 'cobra_desde'>[]).map((f) => ({ ...f, cobra_desde: null })), conColumna: false };
}

// Una orden anotada y su lector viven en las reglas (10/11/2026): también los lee Admin › Revenue (lib/admin-ingresos-libro.ts),
// y dos lectores del mismo registro se desincronizan.
export type { OrdenAnotada };

type Libro = {
  config: ConfigMensualidad | null;
  pagos: Map<Mes, PagoDelMes & { recibo?: boolean }>;
  entradas: Map<number, EntradaGuardada & { recibo?: boolean }>;
  ordenes: Map<string, OrdenAnotada>;
  avisos: Map<Mes, { at: string; totalUsd: number | null }>;
  avisosEntrada: Set<string>;
  pausasAvisadas: Set<string>;
  crudo: Map<string, string>;
};

/** Lo guardado en la plataforma sobre una agencia. Estricto: «no pude leer» tira. */
async function leerLibro(agenciaWs: number): Promise<Libro> {
  const filas = await enLaPlataforma(() => getSettingsConPrefijo(PREFIJO(agenciaWs)));
  const libro: Libro = { config: leerConfigMensualidad(filas.get(KEY_CONFIG(agenciaWs)) ?? null), pagos: new Map(), entradas: new Map(), ordenes: new Map(), avisos: new Map(), avisosEntrada: new Set(), pausasAvisadas: new Set(), crudo: filas };
  for (const [k, v] of filas) {
    const resto = k.slice(PREFIJO(agenciaWs).length);
    const json = (): Record<string, unknown> => { try { return JSON.parse(v) as Record<string, unknown>; } catch { return {}; } };
    if (resto.startsWith('pago.')) { const p = leerPagoDelMes(v); if (p && `pago.${p.mes}` === resto) libro.pagos.set(p.mes, { ...p, recibo: json().recibo === true }); }
    else if (resto.startsWith('entrada.')) { const e = leerEntrada(v); if (e && `entrada.${e.ws}` === resto) libro.entradas.set(e.ws, { ...e, recibo: json().recibo === true }); }
    else if (resto.startsWith('orden.')) { const o = leerOrden(v); if (o) libro.ordenes.set(o.orden, o); }
    else if (resto.startsWith('aviso.') && esMes(resto.slice(6))) { const j = json(); libro.avisos.set(resto.slice(6), { at: String(j.at ?? ''), totalUsd: typeof j.totalUsd === 'number' ? j.totalUsd : null }); }
    else if (resto.startsWith('avisoentrada.')) libro.avisosEntrada.add(resto.slice('avisoentrada.'.length));
    else if (resto.startsWith('pausa.')) libro.pausasAvisadas.add(resto.slice('pausa.'.length));
  }
  return libro;
}

/** El estado de cada cuenta (pausada o no) y su corte guardado. Estricto. */
async function leerCuentas(ids: readonly number[]): Promise<Map<number, EstadoDeCuenta & { nombre: string; capa: string | null }>> {
  const out = new Map<number, EstadoDeCuenta & { nombre: string; capa: string | null }>();
  if (!ids.length) return out;
  const db = getSupabaseServer();
  const [wss, cortes] = await Promise.all([
    db.from('workspaces').select('id, nombre, capa, estado').in('id', [...ids]),
    db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_CORTE).in('workspace_id', [...ids]),
  ]);
  if (wss.error) throw new Error(`No pude leer las cuentas: ${wss.error.message}`);
  if (cortes.error) throw new Error(`No pude leer los cortes de las cuentas: ${cortes.error.message}`);
  const corteDe = new Map(((cortes.data ?? []) as Array<{ workspace_id: number; value: string }>).map((r) => [Number(r.workspace_id), leerCorte(r.value)]));
  for (const w of (wss.data ?? []) as Array<{ id: number; nombre: string | null; capa: string | null; estado: string | null }>) {
    out.set(Number(w.id), { pausada: w.estado === 'pausado', corte: corteDe.get(Number(w.id)) ?? null, nombre: w.nombre?.trim() ?? '', capa: w.capa ?? null });
  }
  return out;
}

/** Un cliente de la cartera, como lo dibuja la pantalla. */
export type FilaMensualidad = {
  ws: number;
  nombre: string;
  estado: EstadoCartera;
  plan: PlanCuenta;
  invitado: Dia;
  corregido: Dia | null;
  /** El día desde el que corren sus 14 días (la corrección, o la invitación). */
  arranca: Dia;
  situacion: Situacion;
  /** Su entrada guardada (completa o con un pago parcial). */
  entrada: EntradaGuardada | null;
  /** Está en «Paga para entrar» (por lo que sea: su entrada o el mes). */
  enPausa: boolean;
};

export type MesDeMensualidad = {
  mes: Mes;
  cuenta: CuentaDelMes;
  pago: PagoDelMes | null;
  pagadoUsd: number;
  debeUsd: number;
  pagado: boolean;
  /** El último total que se le dijo a la agencia (el aviso del grupo), o null si no salió. */
  avisadoUsd: number | null;
};

export type MensualidadOk = {
  ok: true;
  agenciaWs: number;
  agencia: string;
  hoy: Dia;
  zona: string;
  /** null = la mensualidad está apagada para esta agencia. */
  config: ConfigMensualidad | null;
  /** Desde qué día se cobran las entradas (con la mensualidad apagada, hoy: así se ve cómo quedaría). */
  entradasDesde: Dia;
  precios: Precios;
  planAgencia: PlanCuenta;
  clientes: FilaMensualidad[];
  /** La cartera como la leen las reglas. */
  cartera: ClienteDeAgencia[];
  /** El mes de hoy (con la mensualidad apagada, cómo quedaría si se prendiera desde este mes). */
  actual: MesDeMensualidad;
  /** El mes que viene, con los clientes de hoy (12/11/2026, Martín: «cuánto va a pagar Código Inmobiliario el mes entrante con todos los
   *  clientes»). Cuenta a quien para entonces ya terminó sus días sin costo; no sabe de altas ni bajas que todavía no pasaron. */
  siguiente: MesDeMensualidad | null;
  /** Los meses desde que se prendió, del más nuevo al más viejo (sin el de hoy). */
  anteriores: MesDeMensualidad[];
  /** Lo que se debe hoy, lo vencido primero: los meses y las entradas. */
  pendientes: Pendiente[];
  /** Cómo está cada cuenta (la agencia y sus clientes). */
  cuentas: Map<number, EstadoDeCuenta>;
  /** ¿La agencia misma está en pausa? */
  agenciaEnPausa: boolean;
  /** ¿Se puede corregir una fecha? (la migración 0402 aplicada) */
  puedeCorregir: boolean;
  /** Lo guardado (para los avisos y los pagos). */
  libro: Libro;
};
export type Mensualidad = MensualidadOk | { ok: false; error: string };

/**
 * Lo que viaja a la PANTALLA (un componente de cliente): sin el libro crudo ni los cortes de las cuentas, que son de MaKo y no le
 * hacen falta a quien mira. ⚠️ Todo lo que pasa como prop a un `'use client'` llega al navegador.
 */
export type MensualidadPantalla = Omit<MensualidadOk, 'libro' | 'cuentas' | 'cartera'> | { ok: false; error: string };
export function paraLaPantalla(m: Mensualidad): MensualidadPantalla {
  if (!m.ok) return m;
  const { libro: _libro, cuentas: _cuentas, cartera: _cartera, ...resto } = m;
  return resto;
}

const enPausaPorMensualidad = (c: CorteGuardado | null, agenciaWs: number): boolean =>
  !!c?.vigente && c.motivo === 'paga-para-entrar' && c.mensualidad?.agenciaWs === agenciaWs;

/**
 * La mensualidad de una agencia, hoy. ⚠️ No mira quién pregunta: el que llama decide si puede verla (el admin de la agencia,
 * o el super admin). Todas las lecturas son estrictas: si una falla, `ok: false` (y nada que dependa de esto corre).
 */
export async function mensualidadDeAgencia(agenciaWs: number, ahora: Date = new Date()): Promise<Mensualidad> {
  if (!esWs(agenciaWs)) return { ok: false, error: 'Agencia inválida.' };
  try {
    if (!(await esAgencia(agenciaWs))) return { ok: false, error: 'Este negocio no es Agency.' };
    const [zona, cartera, libro, planes] = await Promise.all([zonaDelNegocioEstricta(agenciaWs), leerCartera(agenciaWs), leerLibro(agenciaWs), planesMako()]);
    const precios = preciosDelCatalogo(planes);
    if (!precios) return { ok: false, error: 'No encontré el precio de MaKo Esencial o de MaKo Pro en los planes.' };

    const ids = [...new Set(cartera.filas.map((f) => Number(f.cliente_ws)))];
    const [cuentas, marcas] = await Promise.all([
      leerCuentas([agenciaWs, ...ids]),
      ids.length ? getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', KEY_PLAN_CAMBIADO).in('workspace_id', ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (marcas.error) throw new Error(`No pude leer el plan de los clientes: ${marcas.error.message}`);
    const ag = cuentas.get(agenciaWs);
    if (!ag) throw new Error('No encontré la cuenta de la agencia.');
    const elegidos = new Set(((marcas.data ?? []) as Array<{ workspace_id: number; value: unknown }>).filter((m) => leerCambioDePlan(m.value) != null).map((m) => Number(m.workspace_id)));

    const hoy = hoyEnTz(zona, ahora);
    const mesHoy = mesDe(hoy);
    const config = libro.config;
    const entradasDesde = config?.entradasDesde ?? hoy;
    const dia = (iso: string | null): Dia | null => (iso && Number.isFinite(Date.parse(iso)) ? hoyEnTz(zona, new Date(iso)) : null);
    const clientes: ClienteDeAgencia[] = [];
    const filas: FilaMensualidad[] = [];
    for (const f of cartera.filas) {
      const ws = Number(f.cliente_ws);
      const invitado = dia(f.created_at);
      if (!invitado) continue;
      const estado: EstadoCartera = (ESTADOS_CARTERA as readonly string[]).includes(f.estado) ? (f.estado as EstadoCartera) : 'pendiente';
      const w = cuentas.get(ws);
      const guardada = libro.entradas.get(ws) ?? null;
      const corte = w?.corte ?? null;
      const c: ClienteDeAgencia = {
        ws, nombre: w?.nombre || `Cliente ${ws}`, estado, invitado,
        corregido: esDia(f.cobra_desde) ? f.cobra_desde : null,
        baja: estado === 'revocado' ? dia(f.decidido_at) : null,
        plan: planQueSeCobra({ elegido: elegidos.has(ws), capa: w?.capa }),
        entrada: guardada && entradaCompleta(guardada) ? { desde: guardada.desde, pagadoEl: guardada.pagadoEl, montoUsd: guardada.montoUsd } : null,
        fueraPorEntrada: enPausaPorMensualidad(corte, agenciaWs) && !!corte?.mensualidad?.causas.includes('entrada'),
      };
      clientes.push(c);
      filas.push({
        ws, nombre: c.nombre, estado, plan: c.plan, invitado, corregido: c.corregido, arranca: arrancaElReloj(c),
        situacion: situacion(c, hoy, entradasDesde, precios[c.plan]), entrada: guardada, enPausa: enPausaPorMensualidad(corte, agenciaWs),
      });
    }

    const primerMes = config?.desde ?? mesHoy;
    const planAgencia = planDeCapa(ag.capa);
    const armar = (mes: Mes): MesDeMensualidad | null => {
      const cuenta = cuentaDelMes({ mes, primerMes, planAgencia, clientes, precios, hoy, entradasDesde });
      if (!cuenta) return null;
      const pago = libro.pagos.get(mes) ?? null;
      const pagadoUsd = pago?.pagadoUsd ?? 0;
      const debeUsd = redondo(Math.max(0, cuenta.totalUsd - pagadoUsd));
      return { mes, cuenta, pago, pagadoUsd, debeUsd, pagado: cubre(pagadoUsd, cuenta.totalUsd), avisadoUsd: libro.avisos.get(mes)?.totalUsd ?? null };
    };
    // Prendida desde un mes que todavía no llegó: lo de hoy es cómo va a quedar ese primer mes.
    const actual = armar(mesHoy >= primerMes ? mesHoy : primerMes)!;
    // ⚠️ El que viene desde HOY, no desde `actual` (12/11/2026, medido por Planes y cobros): con la mensualidad prendida desde un mes
    // que todavía no llegó (Código, desde diciembre), `actual` YA es ese mes, y `mesSiguiente(actual.mes)` daba enero.
    const siguiente = armar(mesSiguiente(mesHoy));
    const anteriores = config ? mesesEntre(primerMes, mesHoy).filter((m) => m !== mesHoy).reverse().map(armar).filter((x): x is MesDeMensualidad => !!x) : [];

    // Lo que se debe hoy: los meses que ya empezaron y no se cubrieron, y cada entrada por pagar (con lo que ya entró a cuenta).
    const pendientes: Pendiente[] = [];
    if (config) {
      for (const m of [...anteriores].reverse().concat(mesHoy >= primerMes ? [actual] : [])) {
        if (m.debeUsd > 0.01) pendientes.push({ tipo: 'mes', mes: m.mes, totalUsd: m.cuenta.totalUsd, pagadoUsd: m.pagadoUsd, debeUsd: m.debeUsd, limite: diaLimite(m.mes) });
      }
      for (const f of filas) {
        const s = f.situacion;
        const deb: Diferencial | null = s.tipo === 'debe-entrada' || s.tipo === 'paga-para-entrar' ? s.entrada : s.tipo === 'sin-costo' ? s.entrada : null;
        if (!deb || deb.dias <= 0) continue;
        // Con un pago a cuenta, la entrada quedó fijada el día de ese primer pago.
        const parcial = f.entrada && !entradaCompleta(f.entrada) ? f.entrada : null;
        const e = parcial ? diferencialDe(parcial.desde, precios[f.plan]) : deb;
        const pagadoUsd = parcial?.pagadoUsd ?? 0;
        pendientes.push({ tipo: 'entrada', ws: f.ws, nombre: f.nombre, plan: f.plan, entrada: e, pagadoUsd, debeUsd: redondo(Math.max(0, e.montoUsd - pagadoUsd)), limite: e.limite });
      }
      pendientes.sort((a, b) => (a.limite < b.limite ? -1 : a.limite > b.limite ? 1 : a.tipo === b.tipo ? 0 : a.tipo === 'entrada' ? -1 : 1));
    }

    const orden = (s: Situacion): number => (s.tipo === 'paga-para-entrar' ? 0 : s.tipo === 'debe-entrada' ? 1 : s.tipo === 'sin-costo' ? 2 : s.tipo === 'cuenta' ? 3 : s.tipo === 'baja' ? 4 : 5);
    filas.sort((a, b) => orden(a.situacion) - orden(b.situacion) || a.nombre.localeCompare(b.nombre, 'es'));
    const estados = new Map<number, EstadoDeCuenta>([...cuentas].map(([ws, c]) => [ws, { pausada: c.pausada, corte: c.corte }]));
    return {
      ok: true, agenciaWs, agencia: ag.nombre || `Agencia ${agenciaWs}`, hoy, zona, config, entradasDesde, precios, planAgencia,
      clientes: filas, cartera: clientes, actual, siguiente, anteriores, pendientes, cuentas: estados, agenciaEnPausa: enPausaPorMensualidad(ag.corte, agenciaWs),
      puedeCorregir: cartera.conColumna, libro,
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** ¿Esta agencia tiene la mensualidad prendida? `null` = no se pudo leer (no es «no»). */
export async function mensualidadPrendida(agenciaWs: number): Promise<boolean | null> {
  try { return (await leerLibro(agenciaWs)).config != null; } catch { return null; }
}

// ── Escrituras del super admin (la puerta es de quien llama) ─────────────────────────────────────────────────────

export type Resultado = { ok: true; resumen: string; yaEstaba?: true } | { ok: false; error: string };

/**
 * Prende la mensualidad de una agencia: desde qué mes la avisa MaKo, desde qué día se cobran las entradas (sin el día, hoy: los
 * clientes cuyos 14 días terminaron antes entraron a mano) y por qué medio paga.
 */
export async function prenderMensualidad(p: { agenciaWs: number; desde: string; entradasDesde?: string | null; medio?: string | null; autor: string }, ahora: Date = new Date()): Promise<Resultado> {
  if (!esWs(p.agenciaWs)) return { ok: false, error: 'Agencia inválida.' };
  if (!esMes(p.desde)) return { ok: false, error: 'El mes va como AAAA-MM (por ejemplo 2026-12).' };
  if (p.entradasDesde != null && p.entradasDesde !== '' && !esDia(p.entradasDesde)) return { ok: false, error: 'El día de las entradas va como AAAA-MM-DD.' };
  try {
    if (!(await esAgencia(p.agenciaWs))) return { ok: false, error: 'Ese negocio no es Agency.' };
    const medio = (p.medio ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || MEDIO_POR_DEFECTO;
    const hoy = hoyEnTz(await zonaDelNegocioEstricta(p.agenciaWs), ahora);
    const antes = (await leerLibro(p.agenciaWs)).config;
    const entradasDesde = p.entradasDesde || antes?.entradasDesde || hoy;
    if (antes && antes.desde === p.desde && antes.medio === medio && antes.entradasDesde === entradasDesde) return { ok: true, resumen: 'La mensualidad ya estaba prendida así.', yaEstaba: true };
    const valor: ConfigMensualidad = { desde: p.desde, entradasDesde, medio, prendidaPor: p.autor.slice(0, 120), prendidaAt: new Date().toISOString() };
    await enLaPlataforma(() => setSetting(KEY_CONFIG(p.agenciaWs), JSON.stringify(valor)));
    return { ok: true, resumen: `Mensualidad prendida: avisa desde ${nombreDelMes(p.desde)} ${p.desde.slice(0, 4)} y cobra las entradas desde el ${diaCorto(entradasDesde)}, por ${medio}.` };
  } catch (e) {
    return { ok: false, error: `No pude prender la mensualidad: ${msg(e)}` };
  }
}

/** La apaga: deja de avisar y de pausar. Lo pagado queda anotado. ⚠️ Las cuentas que estén en pausa siguen así: se reabren a mano. */
export async function apagarMensualidad(p: { agenciaWs: number }): Promise<Resultado> {
  if (!esWs(p.agenciaWs)) return { ok: false, error: 'Agencia inválida.' };
  try {
    if (!(await leerLibro(p.agenciaWs)).config) return { ok: true, resumen: 'La mensualidad ya estaba apagada.', yaEstaba: true };
    await enLaPlataforma(() => borrarSetting(KEY_CONFIG(p.agenciaWs)));
    return { ok: true, resumen: 'Mensualidad apagada: no se le avisa ni se pausa más. Lo pagado queda anotado.' };
  } catch (e) {
    return { ok: false, error: `No pude apagar la mensualidad: ${msg(e)}` };
  }
}

/** Un pago con su orden de Binance (lo que leyó el comprobante, o lo que carga el super admin). */
export type PagoConOrden = { orden: string; monto: number; moneda: string; montoUsd: number; fecha: string; comprobante?: string | null };

/** Escribe un registro del libro con compare-and-set (hasta 4 vueltas). `cambiar` recibe lo de antes (null) y devuelve lo nuevo, o null para no escribir. */
async function cambiarRegistro(key: string, cambiar: (antes: string | null) => string | null): Promise<string | null> {
  return enLaPlataforma(async () => {
    for (let i = 0; i < 4; i++) {
      const antes = (await getSettingsConPrefijo(key.slice(0, key.lastIndexOf('.') + 1))).get(key) ?? null;
      const nuevo = cambiar(antes);
      if (nuevo == null) return antes;
      if (await cambiarSettingSi(key, antes, nuevo)) return nuevo;
    }
    throw new Error(`otro escribió ${key} a la vez cuatro veces`);
  });
}

/**
 * APLICA UN PAGO al libro: anota la orden (una vez: si ya estaba, no hace nada y lo dice), y suma a cada pendiente lo que le
 * toca (`aplicado`). Devuelve las claves que QUEDARON completas con este pago. No pausa ni reabre ni manda nada: eso lo hace
 * quien llama, después.
 */
export async function aplicarPagoDeAgencia(m: MensualidadOk, pago: PagoConOrden, aplicado: ReadonlyArray<{ clave: string; montoUsd: number }>, autor: string): Promise<{ ok: true; completas: string[] } | { ok: false; error: string; repetida?: true }> {
  const ag = m.agenciaWs;
  const orden = String(pago.orden).toUpperCase();
  const dia = esDia(pago.fecha.slice(0, 10)) ? pago.fecha.slice(0, 10) : m.hoy;
  const registro: OrdenAnotada = { orden, monto: pago.monto, moneda: pago.moneda, montoUsd: pago.montoUsd, fecha: pago.fecha, comprobante: pago.comprobante ?? null, aplicado: [...aplicado] };
  const tomada = await enLaPlataforma(() => cambiarSettingSi(KEY_ORDEN(ag, orden), null, JSON.stringify(registro))).catch((e) => { throw new Error(`No pude anotar la orden: ${msg(e)}`); });
  if (!tomada) return { ok: false, error: 'Esa orden ya estaba anotada.', repetida: true };
  const completas: string[] = [];
  try {
    for (const a of aplicado) {
      const p = m.pendientes.find((x) => clavePendiente(x) === a.clave);
      if (!p) throw new Error(`no encontré ${a.clave} entre lo que se debe`);
      if (p.tipo === 'mes') {
        let completa = false;
        await cambiarRegistro(KEY_PAGO(ag, p.mes), (antes) => {
          const viejo = antes ? leerPagoDelMes(antes) : null;
          if (viejo?.ordenes.includes(orden)) return null;
          const pagadoUsd = redondo((viejo?.pagadoUsd ?? 0) + a.montoUsd);
          completa = !cubre(viejo?.pagadoUsd ?? 0, p.totalUsd) && cubre(pagadoUsd, p.totalUsd);
          const extra = antes ? (JSON.parse(antes) as Record<string, unknown>) : {};
          return JSON.stringify({ ...extra, mes: p.mes, pagadoEl: dia, totalUsd: p.totalUsd, pagadoUsd, ordenes: [...(viejo?.ordenes ?? []), orden], marcadoPor: autor.slice(0, 120), marcadoAt: new Date().toISOString() });
        });
        if (completa) completas.push(a.clave);
      } else {
        let completa = false;
        await cambiarRegistro(KEY_ENTRADA(ag, p.ws), (antes) => {
          const viejo = antes ? leerEntrada(antes) : null;
          if (viejo?.ordenes.includes(orden)) return null;
          // Con un pago a cuenta de antes, la entrada ya quedó fijada ese día: se suma a esa.
          const base = viejo && !entradaCompleta(viejo) ? viejo : null;
          const pagadoUsd = redondo((base?.pagadoUsd ?? 0) + a.montoUsd);
          const monto = base?.montoUsd ?? p.entrada.montoUsd;
          completa = cubre(pagadoUsd, monto);
          const extra = antes ? (JSON.parse(antes) as Record<string, unknown>) : {};
          return JSON.stringify({ ...extra, ws: p.ws, desde: base?.desde ?? p.entrada.desde, montoUsd: monto, pagadoUsd, pagadoEl: dia, ordenes: [...(base?.ordenes ?? []), orden], marcadoPor: autor.slice(0, 120), recibo: false });
        });
        if (completa) completas.push(a.clave);
      }
    }
  } catch (e) {
    return { ok: false, error: `La orden quedó anotada pero no pude sumarla toda: ${msg(e)}` };
  }
  return { ok: true, completas };
}

/**
 * EL RECIBO de lo que quedó completo con un pago (lib/recibos.ts, `emitirReciboManual`): UNO por comprobante, con los renglones
 * de todo lo que completó y las órdenes que le entraron (las de antes, a cuenta, si todavía no están en otro recibo). La clave es
 * la que pidió la rama de recibos: `mensualidad:<ag>:<mes>` si completó un mes, `diferencial:<ag>:<cliente>:<ciclo>` si no.
 */
export async function emitirReciboDeLoCompleto(agenciaWs: number, completas: readonly string[], autor: string): Promise<{ ok: boolean; numero?: number; error?: string }> {
  if (!completas.length) return { ok: true };
  const m = await mensualidadDeAgencia(agenciaWs);
  if (!m.ok) return { ok: false, error: m.error };
  const { emitirReciboManual, reciboDePago } = await import('./recibos');
  const lineas: Array<{ concepto: string; mes: string | null; monto: number; moneda: string }> = [];
  const ordenes = new Set<string>();
  let clave: string | null = null;
  for (const c of completas) {
    if (c.startsWith('mes:')) {
      const mes = c.slice(4);
      const x = mes === m.actual.mes ? m.actual : m.anteriores.find((y) => y.mes === mes);
      if (!x) continue;
      for (const l of x.cuenta.lineas) lineas.push({ concepto: conceptoDeLinea(l), mes: `${nombreDelMes(mes)} ${mes.slice(0, 4)}`, monto: l.montoUsd, moneda: 'USD' });
      for (const o of x.pago?.ordenes ?? []) ordenes.add(o);
      clave ??= m.libro.pagos.get(mes)?.recibo ? `mensualidad:${agenciaWs}:${mes}:${[...(x.pago?.ordenes ?? [])].at(-1)}` : `mensualidad:${agenciaWs}:${mes}`;
    } else if (c.startsWith('entrada:')) {
      const ws = Number(c.slice(8));
      const e = m.libro.entradas.get(ws);
      const fila = m.clientes.find((f) => f.ws === ws);
      if (!e || !fila) continue;
      const d = diferencialDe(e.desde, m.precios[fila.plan]);
      lineas.push({ concepto: `Entrada de ${fila.nombre}: del ${diaCorto(d.desde)} al ${diaCorto(d.hasta)}, ${d.dias} días`, mes: `${nombreDelMes(d.ciclo)} ${d.ciclo.slice(0, 4)}`, monto: e.montoUsd, moneda: 'USD' });
      for (const o of e.ordenes) ordenes.add(o);
      clave ??= `diferencial:${agenciaWs}:${ws}:${d.ciclo}`;
    }
  }
  if (!lineas.length || !clave) return { ok: false, error: 'no encontré qué se completó' };
  const pagos = [];
  for (const o of ordenes) {
    const det = m.libro.ordenes.get(o);
    if (!det) continue;
    if (await reciboDePago('binance', o).catch(() => null)) continue; // ya está en otro recibo
    pagos.push({ medio: 'binance', referencia: o, fecha: det.fecha, monto: det.monto, moneda: det.moneda, monto_usd: det.montoUsd, comprobante_path: det.comprobante });
  }
  if (!pagos.length) return { ok: false, error: 'las órdenes ya están en otro recibo' };
  const r = await emitirReciboManual({ destinoWs: agenciaWs, aNombre: m.agencia, lineas, pagos, clave, mes: completas.find((c) => c.startsWith('mes:'))?.slice(4) ?? null, enviar: true, autor });
  if (!r.ok) return { ok: false, error: r.error };
  // Marca el recibo en lo que completó (la próxima vez que ese mes se complete, por un total que subió, la clave lleva la orden).
  for (const c of completas) {
    const key = c.startsWith('mes:') ? KEY_PAGO(agenciaWs, c.slice(4)) : KEY_ENTRADA(agenciaWs, Number(c.slice(8)));
    await cambiarRegistro(key, (antes) => (antes ? JSON.stringify({ ...(JSON.parse(antes) as Record<string, unknown>), recibo: true }) : null)).catch(() => null);
  }
  return { ok: true, numero: r.numero };
}

/**
 * Marca un mes «Pagado» A MANO (el super admin, por ejemplo después de revisar un comprobante dudoso). Con la orden de Binance
 * sale el recibo; sin ella, queda anotado sin recibo. Guarda el total de ese momento.
 */
export async function marcarMesPagado(p: { agenciaWs: number; mes: string; pagadoEl: string; autor: string; pago?: Omit<PagoConOrden, 'fecha'> | null }, ahora: Date = new Date()): Promise<Resultado & { totalUsd?: number; recibo?: number }> {
  if (!esMes(p.mes)) return { ok: false, error: 'El mes va como AAAA-MM (por ejemplo 2026-12).' };
  if (!esDia(p.pagadoEl)) return { ok: false, error: 'La fecha del pago va como AAAA-MM-DD.' };
  const m = await mensualidadDeAgencia(p.agenciaWs, ahora);
  if (!m.ok) return { ok: false, error: m.error };
  if (!m.config) return { ok: false, error: 'Esta agencia no tiene la mensualidad prendida.' };
  if (p.mes < m.config.desde) return { ok: false, error: `La mensualidad arranca en ${m.config.desde}: ese mes no se factura así.` };
  if (p.mes > mesDe(m.hoy)) return { ok: false, error: 'Ese mes todavía no empezó: se marca desde su día 1.' };
  if (p.pagadoEl > sumarDias(m.hoy, 1)) return { ok: false, error: 'La fecha del pago no puede ser futura.' };
  const mes = p.mes === m.actual.mes ? m.actual : m.anteriores.find((x) => x.mes === p.mes);
  if (!mes) return { ok: false, error: 'No pude armar la cuenta de ese mes.' };
  if (mes.pagado) return { ok: true, resumen: `${nombreDelMes(p.mes)} ya estaba pagado.`, yaEstaba: true, totalUsd: mes.cuenta.totalUsd };
  if (p.pago) {
    const r = await aplicarPagoDeAgencia(m, { ...p.pago, fecha: `${p.pagadoEl}T12:00:00Z` }, [{ clave: `mes:${p.mes}`, montoUsd: mes.debeUsd }], p.autor);
    if (!r.ok) return { ok: false, error: r.error };
    const rec = r.completas.length ? await emitirReciboDeLoCompleto(p.agenciaWs, r.completas, p.autor) : { ok: true };
    await revisarPausasDeAgencia(p.agenciaWs, { ahora }).catch(() => null);
    return { ok: true, resumen: `Listo: ${nombreDelMes(p.mes)} quedó pagado el ${diaCorto(p.pagadoEl)}.${rec.ok ? '' : ` El recibo no salió: ${rec.error}`}`, totalUsd: mes.cuenta.totalUsd, ...('numero' in rec && rec.numero ? { recibo: rec.numero } : {}) };
  }
  try {
    await cambiarRegistro(KEY_PAGO(p.agenciaWs, p.mes), (antes) => {
      const extra = antes ? (JSON.parse(antes) as Record<string, unknown>) : {};
      const viejo = antes ? leerPagoDelMes(antes) : null;
      return JSON.stringify({ ...extra, mes: p.mes, pagadoEl: p.pagadoEl, totalUsd: mes.cuenta.totalUsd, pagadoUsd: mes.cuenta.totalUsd, ordenes: viejo?.ordenes ?? [], marcadoPor: p.autor.slice(0, 120), marcadoAt: new Date().toISOString(), aMano: true });
    });
  } catch (e) {
    return { ok: false, error: `No pude marcarlo pagado: ${msg(e)}` };
  }
  await revisarPausasDeAgencia(p.agenciaWs, { ahora }).catch(() => null);
  return { ok: true, resumen: `Listo: ${nombreDelMes(p.mes)} quedó pagado el ${diaCorto(p.pagadoEl)} (sin recibo: no tiene orden).`, totalUsd: mes.cuenta.totalUsd };
}

/** Saca la marca de «Pagado» de un mes (el «Deshacer») y anula su recibo. Sólo si sigue diciendo lo que se marcó. */
export async function quitarMesPagado(p: { agenciaWs: number; mes: string; pagadoEl?: string | null; autor?: string }): Promise<Resultado> {
  if (!esWs(p.agenciaWs) || !esMes(p.mes)) return { ok: false, error: 'Mes inválido.' };
  try {
    const crudo = (await enLaPlataforma(() => getSettingsConPrefijo(PREFIJO(p.agenciaWs)))).get(KEY_PAGO(p.agenciaWs, p.mes));
    if (!crudo) return { ok: true, resumen: 'Ese mes no estaba marcado pagado.', yaEstaba: true };
    const pago = leerPagoDelMes(crudo);
    if (p.pagadoEl && pago && pago.pagadoEl !== p.pagadoEl) return { ok: false, error: 'Ese mes se volvió a marcar con otra fecha: no lo toqué.' };
    const borrado = await enLaPlataforma(() => borrarSettingSi(KEY_PAGO(p.agenciaWs, p.mes), crudo));
    if (!borrado) return { ok: false, error: 'Otro lo cambió recién: vuelve a abrir la pantalla.' };
    // Sus órdenes vuelven a estar libres, y su recibo (si salió) queda anulado.
    for (const o of pago?.ordenes ?? []) {
      const k = KEY_ORDEN(p.agenciaWs, o);
      const v = (await enLaPlataforma(() => getSettingsConPrefijo(PREFIJO(p.agenciaWs)))).get(k);
      if (v) await enLaPlataforma(() => borrarSettingSi(k, v)).catch(() => false);
    }
    const { anularRecibo } = await import('./recibos');
    const an = await anularRecibo({ clave: `mensualidad:${p.agenciaWs}:${p.mes}`, autor: p.autor ?? 'MaKo' }).catch((e) => ({ ok: false as const, error: msg(e) }));
    return { ok: true, resumen: `${nombreDelMes(p.mes)} quedó sin pagar.${an.ok ? ` Recibo N.º ${String(an.numero).padStart(4, '0')} anulado.` : ''}` };
  } catch (e) {
    return { ok: false, error: `No pude sacar la marca: ${msg(e)}` };
  }
}

/**
 * Marca la ENTRADA de un cliente pagada A MANO (el super admin, después de revisar un comprobante dudoso). Con la orden sale el
 * recibo. El día cuenta como el del pago: si estaba en pausa, la entrada se cuenta desde ese día.
 */
export async function marcarEntradaPagada(p: { agenciaWs: number; clienteWs: number; pagadoEl: string; autor: string; pago?: Omit<PagoConOrden, 'fecha'> | null }, ahora: Date = new Date()): Promise<Resultado & { recibo?: number }> {
  if (!esWs(p.clienteWs)) return { ok: false, error: 'Cliente inválido.' };
  if (!esDia(p.pagadoEl)) return { ok: false, error: 'La fecha del pago va como AAAA-MM-DD.' };
  const m = await mensualidadDeAgencia(p.agenciaWs, ahora);
  if (!m.ok) return { ok: false, error: m.error };
  if (!m.config) return { ok: false, error: 'Esta agencia no tiene la mensualidad prendida.' };
  const pend = m.pendientes.find((x) => x.tipo === 'entrada' && x.ws === p.clienteWs);
  const fila = m.clientes.find((f) => f.ws === p.clienteWs);
  if (!fila) return { ok: false, error: 'Ese cliente no es de esta agencia.' };
  if (!pend) return { ok: true, resumen: `${fila.nombre} no debe su entrada.`, yaEstaba: true };
  const orden = p.pago?.orden ? String(p.pago.orden).toUpperCase() : `AMANO${p.clienteWs}${p.pagadoEl.replace(/-/g, '')}`;
  const r = await aplicarPagoDeAgencia(m, { orden, monto: p.pago?.monto ?? pend.debeUsd, moneda: p.pago?.moneda ?? 'USD', montoUsd: p.pago?.montoUsd ?? pend.debeUsd, fecha: `${p.pagadoEl}T12:00:00Z` }, [{ clave: clavePendiente(pend), montoUsd: pend.debeUsd }], p.autor);
  if (!r.ok) return { ok: false, error: r.error };
  const rec = p.pago && r.completas.length ? await emitirReciboDeLoCompleto(p.agenciaWs, r.completas, p.autor) : null;
  await revisarPausasDeAgencia(p.agenciaWs, { ahora }).catch(() => null);
  return { ok: true, resumen: `Listo: la entrada de ${fila.nombre} quedó pagada (${usd(pend.debeUsd)}).${rec && !rec.ok ? ` El recibo no salió: ${rec.error}` : !p.pago ? ' Sin recibo: no tiene orden.' : ''}`, ...(rec?.numero ? { recibo: rec.numero } : {}) };
}

/**
 * Corrige desde qué día corren los 14 días de un cliente (`cobra_desde`). `dia: null` lo devuelve a la invitación.
 * Sólo un cliente de ESA agencia (la fila de la cartera es agencia + cliente).
 */
export async function corregirRelojDeCliente(p: { agenciaWs: number; clienteWs: number; dia: string | null }, ahora: Date = new Date()): Promise<Resultado> {
  if (!esWs(p.agenciaWs) || !esWs(p.clienteWs)) return { ok: false, error: 'Cuenta inválida.' };
  if (p.dia != null && !esDia(p.dia)) return { ok: false, error: 'La fecha va como AAAA-MM-DD.' };
  if (p.dia != null && (p.dia < '2024-01-01' || p.dia > hoyEnTz('UTC', new Date(ahora.getTime() + 366 * 86_400_000)))) {
    return { ok: false, error: 'Esa fecha está fuera de rango.' };
  }
  const db = getSupabaseServer();
  const { data: fila, error } = await db.from('agencia_clientes').select('cliente_ws').eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).maybeSingle();
  if (error) return { ok: false, error: `No pude leer la cartera: ${error.message}` };
  if (!fila) return { ok: false, error: 'Ese cliente no es de esta agencia.' };
  const { data, error: e2 } = await db.from('agencia_clientes').update({ cobra_desde: p.dia })
    .eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).select('cliente_ws');
  if (e2) return { ok: false, error: faltaLaColumna(e2) ? FALTA_LA_0402 : `No pude guardar la fecha: ${e2.message}` };
  if (!data?.length) return { ok: false, error: 'Ese cliente ya no está en la cartera.' };
  return {
    ok: true,
    resumen: p.dia
      ? `Listo: sus ${DIAS_SIN_COSTO} días corren desde el ${p.dia}; empieza el ${sumarDias(p.dia, DIAS_SIN_COSTO)}.`
      : `Listo: sus ${DIAS_SIN_COSTO} días vuelven a correr desde la invitación.`,
  };
}

// ── «Paga para entrar»: la base de verdad para lib/agencia-mes-pausas.ts ───────────────────────────────────────────

/** Lo que lee la revisión de pausas, armado de la mensualidad (estricta: si `ok` es false, TIRA y no se pausa nada). */
export function lecturaParaPausas(m: MensualidadOk): LecturaParaPausas {
  if (!m.config) throw new Error('la mensualidad está apagada');
  const meses = [...m.anteriores, m.actual].filter((x) => x.mes >= m.config!.desde && x.mes <= mesDe(m.hoy))
    .map((x) => ({ mes: x.mes, totalUsd: x.cuenta.totalUsd, pagadoUsd: x.pagadoUsd, avisadoUsd: x.avisadoUsd }));
  const clientes = m.clientes.map((f) => ({
    ws: f.ws, situacion: f.situacion,
    avisoEntrada: f.situacion.tipo === 'debe-entrada' && m.libro.avisosEntrada.has(`${f.ws}.${f.situacion.limite}`),
  }));
  return { agenciaWs: m.agenciaWs, hoy: m.hoy, meses, clientes, cuentas: m.cuentas };
}

async function guardarCorte(ws: number, c: CorteGuardado): Promise<void> {
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: CLAVE_CORTE, value: JSON.stringify(c), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(`No pude guardar el corte de la cuenta ${ws}: ${error.message}`);
}

/** La base de verdad de la revisión de pausas. `leer` puede venir ya leída (el cron la tiene a mano). */
export function depsDePausas(leida?: MensualidadOk): DepsPausas {
  return {
    leer: async (agenciaWs) => {
      const m = leida ?? (await mensualidadDeAgencia(agenciaWs));
      if (!m.ok) throw new Error(m.error);
      return lecturaParaPausas(m);
    },
    pausar: async (ws, corte) => {
      const db = getSupabaseServer();
      const { data, error } = await db.from('workspaces').update({ estado: 'pausado', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'activo').select('id');
      if (error) throw new Error(`No pude pausar la cuenta ${ws}: ${error.message}`);
      if (!data?.length) return false;
      try { await guardarCorte(ws, corte); } catch (e) {
        await db.from('workspaces').update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'pausado');
        throw e;
      }
      console.log(`[agencia-mes] cuenta ${ws} en «Paga para entrar»: ${corte.mensualidad?.causas.join(', ')}`);
      return true;
    },
    reabrir: async (ws, corte) => {
      // El corte primero: si después falla el estado, la cuenta queda pausada SIN corte vigente, que ya no corta el acceso.
      await guardarCorte(ws, corte);
      const { data, error } = await getSupabaseServer().from('workspaces').update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', ws).eq('estado', 'pausado').select('id');
      if (error) throw new Error(`No pude reabrir la cuenta ${ws}: ${error.message}`);
      if (data?.length) console.log(`[agencia-mes] cuenta ${ws} reabierta: entró el pago`);
      return !!data?.length;
    },
    guardarCorte,
  };
}

/** Revisa las pausas de una agencia contra la base (lo que llaman el cron, el comprobante y los «Marcar pagado»). */
export async function revisarPausasDeAgencia(agenciaWs: number, o: { enSeco?: boolean; ahora?: Date; leida?: MensualidadOk } = {}): Promise<ResultadoPausas> {
  return revisarPausas(agenciaWs, depsDePausas(o.leida), { enSeco: o.enSeco, ahora: o.ahora });
}

// ── Los avisos al grupo (el cron) ─────────────────────────────────────────────────────────────────────────────────

/**
 * MANDA UN PDF AL GRUPO DE MaKo DE LA AGENCIA. Primero al hilo de la app (`copiarAlGrupo`, escondido a los invitados), después a
 * WhatsApp por la línea de MaKo (`enviarPartesAlGrupoMaKo`, que lo anota en el anillo anti-eco con `anotarEnviadosAlGrupo`), y lo
 * que salió queda como dicho por el equipo (`anotarLoDelEquipo`): un «ok» del dueño no es una confirmación al turno de MaKo.
 * Salió si llegó por WhatsApp o quedó en la app (`enApp`): quien reintenta no suma burbujas.
 */
export async function mandarPdfAlGrupoDeLaAgencia(agenciaWs: number, p: { texto: string; pdf: Uint8Array; nombrePdf: string }): Promise<{ ok: boolean; canal: 'whatsapp' | 'app' | null; error?: string }> {
  const partes: PartePreparada[] = [{ tipo: 'media', base64: Buffer.from(p.pdf).toString('base64'), media: { tipo: 'document', mimetype: 'application/pdf', fileName: p.nombrePdf }, caption: p.texto }];
  const copia = await copiarAlGrupo(agenciaWs, { texto: p.texto, de: 'equipo', avisoTipo: AVISO_TIPO_MENSUALIDAD, partes }).catch(() => null);
  const s = await enviarPartesAlGrupoMaKo(agenciaWs, partes);
  if (copia) await Promise.all(copia.ids.map((f, i) => (s.ids[i] ? atarIdDeWhatsApp(agenciaWs, f, s.ids[i]) : Promise.resolve()))).catch(() => {});
  if (s.ok && s.ids[0]) await anotarLoDelEquipo(agenciaWs, p.texto, s.ids[0]).catch((e) => console.warn(`[agencia-mes] agencia ${agenciaWs}: no lo pude anotar en el grupo: ${msg(e)}`));
  if (s.ok) return { ok: true, canal: 'whatsapp' };
  if (copia) return { ok: true, canal: 'app', error: s.error };
  return { ok: false, canal: null, error: s.error ?? 'no salió' };
}

/** Un texto del equipo al grupo de la agencia (lo que contesta MaKo a un comprobante, el aviso de una pausa). Copia y anota solo. */
export async function textoAlGrupoDeLaAgencia(agenciaWs: number, texto: string): Promise<boolean> {
  const r = await enviarAlGrupoMaKo(agenciaWs, texto, 'equipo').catch(() => ({ ok: false as const }));
  return r.ok;
}

/**
 * A Martín, por el grupo de SuperAdmin (y la campanita de la plataforma): lo que no se decide solo. Nunca tira.
 *
 * Devuelve si LLEGÓ por algún lado (6/11/2026): el aviso del mes impago se marca «ya avisado» una sola vez por mes, y
 * marcarlo cuando no salió por ninguno de los dos canales es perder el único aviso de que una agencia no pagó.
 */
export async function avisarAMartin(texto: string): Promise<boolean> {
  const grupo = await enviarAlGrupoSuperAdmin(texto).then(() => true).catch((e) => { console.error(`[agencia-mes] no pude avisar a Martín: ${msg(e)}`); return false; });
  const campanita = await crearNotificacion({
    ws: await wsSuperAdmin(), tipo: 'agencia-mensualidad', severidad: 'warn', titulo: 'Mensualidad de una agencia: revisar', descripcion: texto.slice(0, 280),
    link: '/admin/cobros', entityType: 'agencia-mensualidad', payload: {}, origen: 'sistema:agencia-mensualidad',
  }).then(() => true).catch(() => false);
  return grupo || campanita;
}

/** Reclama un aviso (compare-and-set: de dos corridas a la vez gana UNA) y lo manda; si no salió, suelta el reclamo. */
async function avisarUnaVez(key: string, valor: Record<string, unknown>, mandar: () => Promise<{ ok: boolean; canal?: string | null; error?: string }>, reemplaza?: string | null): Promise<'avisado' | 'ya-estaba' | 'fallo'> {
  const v = JSON.stringify({ at: new Date().toISOString(), ...valor });
  const gano = await enLaPlataforma(() => cambiarSettingSi(key, reemplaza ?? null, v));
  if (!gano) return 'ya-estaba';
  const r = await mandar();
  if (r.ok) {
    if (r.canal) await enLaPlataforma(() => cambiarSettingSi(key, v, JSON.stringify({ ...JSON.parse(v), canal: r.canal }))).catch(() => false);
    return 'avisado';
  }
  // No salió: se vuelve a lo de antes, para que la corrida de mañana lo intente.
  if (reemplaza) await enLaPlataforma(() => cambiarSettingSi(key, v, reemplaza)).catch(() => false);
  else await enLaPlataforma(() => borrarSettingSi(key, v)).catch(() => false);
  console.warn(`[agencia-mes] ${key}: el aviso no salió (${r.error ?? 'sin detalle'}); se reintenta mañana.`);
  return 'fallo';
}

export type CorridaDeAgencia = {
  agenciaWs: number; ok: boolean; error?: string;
  mes?: 'avisado' | 'ya-estaba' | 'fallo' | 'pagado' | 'saldria' | null;
  entradas?: number;
  pausas?: ResultadoPausas['cambios'];
  /** Con `dry`: lo que saldría, sin mandar nada. */
  saldrian?: string[];
};

/** Las agencias con la mensualidad prendida (estricto: «no pude leer» tira). */
async function agenciasConMensualidad(): Promise<number[]> {
  const plataforma = await wsSuperAdmin();
  const { data, error } = await getSupabaseServer().from('app_settings').select('key, value')
    .eq('workspace_id', plataforma).like('key', 'agencia.mensualidad.%.config').limit(500);
  if (error) throw new Error(`No pude leer las mensualidades: ${error.message}`);
  const out: number[] = [];
  for (const f of (data ?? []) as Array<{ key: string; value: unknown }>) {
    const m = /^agencia\.mensualidad\.(\d{1,12})\.config$/.exec(f.key);
    if (m && leerConfigMensualidad(f.value)) out.push(Number(m[1]));
  }
  return out;
}

/**
 * LA CORRIDA DEL DÍA, a cada agencia con la mensualidad prendida:
 *   1. del 1 al 5, el PDF del mes al grupo (una vez; otra vez si el total cambió y todavía no está pagado);
 *   2. el PDF de las entradas que vencen en 1 o 2 días, o hoy (una vez por cliente y por día);
 *   3. «Paga para entrar»: pausa a quien no pagó y reabre a quien pagó (lib/agencia-mes-pausas.ts), y avisa al grupo de cada
 *      pausa nueva, una vez.
 * ⚠️ Si la mensualidad no se pudo leer, no se manda ni se pausa nada (`ok: false` con el error).
 */
export async function avisarMensualidades(ahora: Date = new Date(), o: { dry?: boolean } = {}): Promise<CorridaDeAgencia[]> {
  const out: CorridaDeAgencia[] = [];
  for (const agenciaWs of await agenciasConMensualidad()) {
    try {
      out.push(await corridaDeUnaAgencia(agenciaWs, ahora, o));
    } catch (e) {
      out.push({ agenciaWs, ok: false, error: msg(e) });
    }
  }
  return out;
}

async function corridaDeUnaAgencia(agenciaWs: number, ahora: Date, o: { dry?: boolean }): Promise<CorridaDeAgencia> {
  const m = await mensualidadDeAgencia(agenciaWs, ahora);
  if (!m.ok) return { agenciaWs, ok: false, error: m.error };
  if (!m.config) return { agenciaWs, ok: true, mes: null, entradas: 0 };
  const config = m.config;
  const saldrian: string[] = [];
  let ok = true;

  // 1. El mes.
  let estadoMes: CorridaDeAgencia['mes'] = null;
  const mesAviso = mesQueSeAvisa(m.hoy, config.desde);
  if (mesAviso && mesAviso === m.actual.mes) {
    const a = m.actual;
    if (a.pagado) estadoMes = 'pagado';
    else {
      const avisado = m.libro.avisos.get(a.mes) ?? null;
      const cambio = avisado?.totalUsd != null && Math.abs(avisado.totalUsd - a.cuenta.totalUsd) > 0.009;
      if (avisado && !cambio) estadoMes = 'ya-estaba';
      else {
        const tabla = tablaDelMes({ agencia: m.agencia, cuenta: a.cuenta, medio: config.medio, pagadoUsd: a.pagadoUsd });
        const texto = textoDelAvisoDelMes({ agencia: m.agencia, tabla, medio: config.medio, actualizado: !!avisado });
        if (o.dry) { estadoMes = 'saldria'; saldrian.push(`${tabla.titulo}: ${usd(tabla.totalUsd)}${avisado ? ' (actualizado)' : ''}`); }
        else {
          const pdf = await pdfDelCobro(tabla, m.hoy, m.agencia);
          estadoMes = await avisarUnaVez(KEY_AVISO(agenciaWs, a.mes), { mes: a.mes, totalUsd: a.cuenta.totalUsd },
            () => mandarPdfAlGrupoDeLaAgencia(agenciaWs, { texto, pdf, nombrePdf: nombreDelPdf(tabla) }), avisado ? m.libro.crudo.get(KEY_AVISO(agenciaWs, a.mes)) ?? null : null);
          if (estadoMes === 'fallo') ok = false;
        }
      }
    }
  }

  // 2. Las entradas que vencen pronto (una sola tabla con todas las de hoy).
  let entradas = 0;
  const porAvisar = entradasPorAvisar(m.cartera, m.hoy, m.entradasDesde, m.precios)
    .filter((e) => !m.libro.avisosEntrada.has(`${e.ws}.${e.entrada.limite}`) && e.entrada.dias > 0);
  if (porAvisar.length) {
    const lista = porAvisar.map((e) => ({ nombre: e.nombre, entrada: e.entrada, pagadoUsd: m.libro.entradas.get(e.ws)?.pagadoUsd ?? 0 }));
    const tabla = tablaDeEntradas({ agencia: m.agencia, medio: config.medio, entradas: lista });
    const texto = textoDelAvisoDeEntradas({ tabla, medio: config.medio, entradas: lista });
    if (o.dry) saldrian.push(`${tabla.titulo}: ${usd(tabla.totalUsd)}`);
    else {
      // ⚠️ EL PDF ANTES DE RECLAMAR, Y SE SUELTA TAMBIÉN SI ALGO TIRA (6/11/2026): la marca `avisoentrada.*` no es sólo «no
      // lo repitas» — `lecturaParaPausas` la lee como «ya se le avisó» y `quienVaEnPausa` sólo pausa al que se le avisó.
      // Una marca puesta sin que el PDF saliera deja al cliente sin aviso PARA SIEMPRE (queda filtrado) y lo pausa el día
      // de su vencimiento por una entrada que nadie le mandó. Ver lib/agencia-mes-avisos.ts.
      const pdf = await pdfDelCobro(tabla, m.hoy, m.agencia);
      const r = await reclamarYMandar(
        porAvisar.map((e) => ({
          clave: KEY_AVISO_ENTRADA(agenciaWs, e.ws, e.entrada.limite),
          valor: JSON.stringify({ at: new Date().toISOString(), montoUsd: e.entrada.montoUsd }),
        })),
        () => mandarPdfAlGrupoDeLaAgencia(agenciaWs, { texto, pdf, nombrePdf: nombreDelPdf(tabla) }),
        {
          reclamar: (clave, valor) => enLaPlataforma(() => cambiarSettingSi(clave, null, valor)),
          soltar: (clave, valor) => enLaPlataforma(() => borrarSettingSi(clave, valor)),
        },
      );
      entradas = r.mandadas;
      if (!r.ok) ok = false;
    }
  }

  // 3. «Paga para entrar».
  const pausas = await revisarPausasDeAgencia(agenciaWs, { enSeco: o.dry, ahora, leida: m });
  if (!pausas.ok) return { agenciaWs, ok: false, error: pausas.error, mes: estadoMes, entradas, ...(o.dry ? { saldrian } : {}) };
  if (o.dry) {
    for (const c of pausas.cambios) saldrian.push(`${c.paso} la cuenta ${c.ws}${c.causas.length ? ` (${c.causas.join(', ')})` : ''}`);
  } else {
    await avisarPausasNuevas(m, pausas.cambios).catch((e) => console.warn(`[agencia-mes] agencia ${agenciaWs}: aviso de las pausas: ${msg(e)}`));
  }
  if (pausas.cambios.some((c) => !c.ok)) ok = false;

  // 4. PASADO EL DÍA 5, SI UN MES NO ENTRÓ, SE LE AVISA A MARTÍN (#498, 6/11/2026). Lo que va al grupo de la agencia es
  //    otra cosa (`textoDePausaDelMes`, arriba): esto es para que nadie tenga que entrar a mirar la pantalla. Sin él, una
  //    agencia podía quedar meses sin pagar y no enterarse nadie. Uno por agencia y por mes; si el aviso no sale por
  //    ningún canal, `avisarUnaVez` suelta la marca y mañana se reintenta.
  //    ⚠️ En seco no se avisa: `?dry=1` no manda nada.
  if (!o.dry) {
    for (const p of m.pendientes) {
      if (p.tipo !== 'mes' || m.hoy <= p.limite) continue;
      await avisarUnaVez(
        KEY_IMPAGO(agenciaWs, p.mes), { mes: p.mes, debeUsd: p.debeUsd },
        async () => ({ ok: await avisarAMartin(textoDeMesImpago({ agencia: m.agencia, mes: p.mes, debeUsd: p.debeUsd, diasDeAtraso: diasEntre(p.limite, m.hoy) })) }),
      ).catch((e) => { console.warn(`[agencia-mes] agencia ${agenciaWs}: no pude avisar el impago de ${p.mes}: ${msg(e)}`); return 'fallo' as const; });
    }
  }

  return { agenciaWs, ok, mes: estadoMes, entradas, pausas: pausas.cambios, ...(o.dry ? { saldrian } : {}) };
}

/** Avisa al grupo de la agencia cada pausa nueva, una vez: la del mes (a la agencia) y la entrada vencida de cada cliente (con su PDF). */
async function avisarPausasNuevas(m: MensualidadOk, cambios: ResultadoPausas['cambios']): Promise<void> {
  const nuevas = cambios.filter((c) => c.ok && (c.paso === 'pausar' || c.paso === 'actualizar'));
  if (!nuevas.length) return;
  const ag = m.agenciaWs;
  // La del mes: una vez por mes, al grupo, cuando la que se pausa es la agencia.
  for (const c of nuevas.filter((x) => x.ws === ag)) {
    for (const causa of c.causas.filter((x) => x.startsWith('mes:'))) {
      const mes = causa.slice(4);
      const x = mes === m.actual.mes ? m.actual : m.anteriores.find((y) => y.mes === mes);
      if (!x) continue;
      await avisarUnaVez(KEY_PAUSA(ag, ag, causa), {}, async () => ({ ok: await textoAlGrupoDeLaAgencia(ag, textoDePausaDelMes({ mes, faltaUsd: x.debeUsd })) }));
    }
  }
  // Las entradas vencidas: una tabla con lo que pagarían hoy.
  const entradas = nuevas.filter((c) => c.ws !== ag && c.causas.includes('entrada'))
    .map((c) => m.pendientes.find((p): p is Extract<Pendiente, { tipo: 'entrada' }> => p.tipo === 'entrada' && p.ws === c.ws))
    .filter((p): p is Extract<Pendiente, { tipo: 'entrada' }> => !!p && !m.libro.pausasAvisadas.has(`${p.ws}.entrada-${cuentaDesdeDe(m, p.ws)}`));
  if (!entradas.length || !m.config) return;
  const lista = entradas.map((p) => ({ nombre: p.nombre, entrada: diferencialDe(m.hoy, m.precios[p.plan]) }));
  const tabla = tablaDeEntradas({ agencia: m.agencia, medio: m.config.medio, entradas: lista });
  const texto = textoDelAvisoDeEntradas({ tabla, medio: m.config.medio, entradas: lista, enPausa: true });
  const pdf = await pdfDelCobro(tabla, m.hoy, m.agencia);
  const r = await mandarPdfAlGrupoDeLaAgencia(ag, { texto, pdf, nombrePdf: nombreDelPdf(tabla) });
  if (r.ok) for (const p of entradas) await enLaPlataforma(() => cambiarSettingSi(KEY_PAUSA(ag, p.ws, `entrada:${cuentaDesdeDe(m, p.ws)}`), null, JSON.stringify({ at: new Date().toISOString() }))).catch(() => false);
}
const cuentaDesdeDe = (m: MensualidadOk, ws: number): Dia => {
  const c = m.cartera.find((x) => x.ws === ws);
  return c ? cuentaDesde(c) : m.hoy;
};

// ── Lo que lee MaKo (la API: ver_mensualidad_agencia y ver_mensualidades_agencias) ─────────────────────────────────

/** La mensualidad en la forma que lee un modelo: con la unidad en el nombre de cada campo y sin texto que adivinar. */
export function mensualidadParaMako(m: MensualidadOk) {
  const s = (c: FilaMensualidad) => c.situacion;
  return {
    prendida: m.config != null,
    agencia: m.agencia,
    agencia_ws: m.agenciaWs,
    medio: m.config?.medio ?? null,
    prendida_desde: m.config?.desde ?? null,
    entradas_desde: m.config?.entradasDesde ?? null,
    hoy: m.hoy,
    agencia_en_pausa: m.agenciaEnPausa,
    este_mes: {
      mes: m.actual.mes,
      cubre: periodoDelCiclo(m.actual.mes),
      total_usd: m.actual.cuenta.totalUsd,
      pagado_usd: m.actual.pagadoUsd,
      debe_usd: m.actual.debeUsd,
      se_paga_hasta: m.actual.cuenta.limite,
      pagado: m.actual.pagado,
      avisado_usd: m.actual.avisadoUsd,
      renglones: m.actual.cuenta.lineas.map((l) => ({ concepto: conceptoDeLinea(l), monto_usd: l.montoUsd })),
    },
    // «¿Cuánto paga el mes que viene?» (12/11/2026): con los clientes de hoy; quien entra o se va en el medio no está.
    mes_que_viene: m.siguiente ? {
      mes: m.siguiente.mes,
      cubre: periodoDelCiclo(m.siguiente.mes),
      total_usd: m.siguiente.cuenta.totalUsd,
      se_paga_hasta: m.siguiente.cuenta.limite,
      renglones: m.siguiente.cuenta.lineas.map((l) => ({ concepto: conceptoDeLinea(l), monto_usd: l.montoUsd })),
    } : null,
    se_debe_hoy: m.pendientes.map((p) => (p.tipo === 'mes'
      ? { que: `mensualidad de ${nombreDelMes(p.mes)}`, debe_usd: p.debeUsd, pagado_usd: p.pagadoUsd, vence: p.limite }
      : { que: `entrada de ${p.nombre}`, cliente_ws: p.ws, desde: p.entrada.desde, hasta: p.entrada.hasta, dias: p.entrada.dias, precio_dia_usd: p.entrada.tarifaUsd, debe_usd: p.debeUsd, pagado_usd: p.pagadoUsd, vence: p.limite })),
    clientes: m.clientes.map((c) => ({
      cliente_ws: c.ws, nombre: c.nombre, plan: NOMBRE_PLAN[c.plan], estado: s(c).tipo, en_pausa: c.enPausa,
      cuenta_desde: s(c).tipo === 'cuenta' || s(c).tipo === 'baja' ? (s(c) as { desde: Dia }).desde : null,
      sin_costo_hasta: s(c).tipo === 'sin-costo' ? (s(c) as { hasta: Dia }).hasta : null,
      entrada_usd: s(c).tipo === 'sin-costo' || s(c).tipo === 'debe-entrada' || s(c).tipo === 'paga-para-entrar' ? ((s(c) as { entrada: Diferencial | null }).entrada?.montoUsd ?? null) : null,
      de_baja_el: s(c).tipo === 'baja' || s(c).tipo === 'baja-sin-costo' ? (s(c) as { baja: Dia }).baja : null,
      reloj_desde: c.arranca,
      fecha_corregida: c.corregido != null,
    })),
    meses_anteriores: m.anteriores.map((x) => ({ mes: x.mes, total_usd: x.cuenta.totalUsd, pagado_usd: x.pagadoUsd, pagado: x.pagado, pagado_el: x.pago?.pagadoEl ?? null })),
    nota: `estado: cuenta (ya está adentro), sin-costo (en sus ${DIAS_SIN_COSTO} días; entrada_usd es lo que paga ese día), debe-entrada (terminaron sus días y no pagó su entrada), paga-para-entrar (en pausa hasta que pague; entrada_usd es lo de hoy), baja-sin-costo, baja. Lo que se paga del 1 al ${DIA_LIMITE_DE_PAGO} cubre del 5 de ese mes al 5 del siguiente. La entrada de un cliente son sus días hasta el próximo 5 (sin contar ese 5) a su plan ÷ días del ciclo. El día 6 sin el total, la agencia y sus clientes quedan en pausa. Se paga por Binance mandando el comprobante al grupo de MaKo con la agencia.`,
  };
}

/** Un mes cualquiera de la mensualidad (para la pantalla). */
export const mesDeLaMensualidad = (m: MensualidadOk, mes: Mes): MesDeMensualidad | null => (mes === m.actual.mes ? m.actual : m.anteriores.find((x) => x.mes === mes) ?? null);

/** Días que le quedan a un mes para vencer (negativo: vencido). */
export const diasParaVencer = (m: MensualidadOk, mes: Mes): number => diasEntre(m.hoy, diaLimite(mes));

/** El texto que contesta un comprobante (re-exportado para lib/agencia-mes-comprobante.ts). */
export { textoDeComprobante };
