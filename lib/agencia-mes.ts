// =============================================================================
// agencia-mes — la MENSUALIDAD de una agencia: leerla, marcar «Pagado», corregir el reloj de un cliente y avisar
// =============================================================================
// Lo puro (quién cuenta, desde cuándo, el total del mes y los textos) vive en lib/agencia-mes-reglas.ts, con su test;
// acá, las lecturas y las escrituras. El acuerdo y el porqué de cada regla, en la cabecera de ese módulo.
//
// DÓNDE VIVE CADA COSA:
//   · Si una agencia tiene la mensualidad prendida, qué mes se pagó y qué aviso ya salió: en `app_settings` de la
//     PLATAFORMA (`wsSuperAdmin()`), con el número de la agencia en la clave. Es el libro de MaKo sobre esa agencia: la
//     agencia no lo escribe, y un reset de su cuenta no lo borra.
//        agencia.mensualidad.<agencia>.config            {desde, medio, prendidaPor, prendidaAt}
//        agencia.mensualidad.<agencia>.pago.<YYYY-MM>    {mes, pagadoEl, totalUsd, marcadoPor, marcadoAt}
//        agencia.mensualidad.<agencia>.aviso.<YYYY-MM>   {at, totalUsd}           (el cron: no se repite en el mes)
//        agencia.mensualidad.<agencia>.plazo.<cliente>.<YYYY-MM-DD>  {at}       (el aviso de 2 días antes)
//   · La corrección del reloj de un cliente: `agencia_clientes.cobra_desde` (mig 0402), en la fila de la cartera.
//
// ⚠️ APAGADA POR DEFECTO. Lo prende el super admin por agencia (Agency Dashboard, parado en la agencia, o la API): el cobro
//    por pasarela de lib/agencia-cobro.ts sigue para las demás, y mandarle a una agencia que paga con tarjeta un «paga por
//    Binance» sería cobrarle dos veces.
// ⚠️ MaKo NO COBRA NADA ACÁ: no hay pasarela, link ni tarjeta. Calcula, avisa, y el super admin anota lo que entró.
// ⚠️ LAS LECTURAS QUE DECIDEN UN MONTO SON ESTRICTAS: la zona, la cartera, los planes elegidos y lo guardado. «No pude
//    leer» no es «no hay clientes» ni «nadie eligió Pro»: con eso se le avisaría un total equivocado.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { cambiarSettingSi, borrarSetting, borrarSettingSi, getSettingsConPrefijo, setSetting } from './settings';
import { zonaDelNegocioEstricta } from './timezone';
import { hoyEnTz } from './date-utils';
import { planesMako } from './compra-plan';
import { esAgencia } from './agencia';
import { adminsDeCuenta } from './agencia-baja';
import { avisarDePlataforma } from './invitaciones';
import { crearNotificacion } from './notificaciones';
import { linkApp } from './app-url';
import { KEY_PLAN_CAMBIADO, leerCambioDePlan, planDeCapa, type PlanCuenta } from './agencia-cobro-reglas';
import { ESTADOS_CARTERA, type EstadoCartera } from './agencia-cartera';
import {
  avisoDelMes, avisoDePlazo, cuentaDelMes, esDia, esMes, leerConfigMensualidad, leerPagoDelMes, mesDe, mesQueSeAvisa,
  mesesEntre, planQueSeCobra, plazosPorVencer, preciosDelCatalogo, situacion, arrancaElReloj, sumarDias, conceptoDeLinea, DIAS_SIN_COSTO, DIA_LIMITE_DE_PAGO,
  MEDIO_POR_DEFECTO, NOMBRE_PLAN,
  type ClienteDeAgencia, type ConfigMensualidad, type Correo, type CuentaDelMes, type Dia, type Mes, type PagoDelMes, type Precios, type Situacion,
} from './agencia-mes-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const PREFIJO = (ag: number) => `agencia.mensualidad.${ag}.`;
const KEY_CONFIG = (ag: number) => `${PREFIJO(ag)}config`;
const KEY_PAGO = (ag: number, mes: Mes) => `${PREFIJO(ag)}pago.${mes}`;
const KEY_AVISO = (ag: number, mes: Mes) => `${PREFIJO(ag)}aviso.${mes}`;
const KEY_PLAZO = (ag: number, cliente: number, dia: Dia) => `${PREFIJO(ag)}plazo.${cliente}.${dia}`;
/** Lo que contesta todo lo que corrige una fecha mientras la migración no esté aplicada. */
export const FALTA_LA_0402 = 'Aplica la migración 0402 (agencia_clientes.cobra_desde) para poder corregir una fecha.';

const enLaPlataforma = async <T>(fn: () => Promise<T>): Promise<T> => runWithWorkspace(await wsSuperAdmin(), fn);
const esWs = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

// ── Lecturas ──────────────────────────────────────────────────────────────────────────────────────────────────────

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

/** Lo guardado en la plataforma sobre una agencia: la config, los pagos y los avisos que ya salieron. */
async function leerLibro(agenciaWs: number): Promise<{ config: ConfigMensualidad | null; pagos: Map<Mes, PagoDelMes>; avisos: Map<Mes, string> }> {
  const filas = await enLaPlataforma(() => getSettingsConPrefijo(PREFIJO(agenciaWs)));
  const config = leerConfigMensualidad(filas.get(KEY_CONFIG(agenciaWs)) ?? null);
  const pagos = new Map<Mes, PagoDelMes>();
  const avisos = new Map<Mes, string>();
  for (const [k, v] of filas) {
    const resto = k.slice(PREFIJO(agenciaWs).length);
    if (resto.startsWith('pago.')) { const p = leerPagoDelMes(v); if (p && `pago.${p.mes}` === resto) pagos.set(p.mes, p); }
    if (resto.startsWith('aviso.') && esMes(resto.slice(6))) {
      try { avisos.set(resto.slice(6), String((JSON.parse(v) as { at?: unknown }).at ?? '')); } catch { avisos.set(resto.slice(6), ''); }
    }
  }
  return { config, pagos, avisos };
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
};

export type MesDeMensualidad = { mes: Mes; cuenta: CuentaDelMes; pago: PagoDelMes | null; avisado: boolean };

export type Mensualidad =
  | {
    ok: true;
    agenciaWs: number;
    agencia: string;
    hoy: Dia;
    zona: string;
    /** null = la mensualidad está apagada para esta agencia (sigue el cobro por pasarela). */
    config: ConfigMensualidad | null;
    precios: Precios;
    planAgencia: PlanCuenta;
    clientes: FilaMensualidad[];
    /** La cartera como la leen las reglas (lo que usa el cron para los plazos). */
    cartera: ClienteDeAgencia[];
    /** El mes de hoy (con la mensualidad apagada, cómo quedaría si se prendiera desde este mes). */
    actual: MesDeMensualidad;
    /** Los meses desde que se prendió, del más nuevo al más viejo (sin el de hoy). */
    anteriores: MesDeMensualidad[];
    /** ¿Se puede corregir una fecha? (la migración 0402 aplicada) */
    puedeCorregir: boolean;
  }
  | { ok: false; error: string };

/**
 * La mensualidad de una agencia, hoy. ⚠️ No mira quién pregunta: el que llama decide si puede verla (el admin de la
 * agencia, o el super admin).
 */
export async function mensualidadDeAgencia(agenciaWs: number, ahora: Date = new Date()): Promise<Mensualidad> {
  if (!esWs(agenciaWs)) return { ok: false, error: 'Agencia inválida.' };
  try {
    if (!(await esAgencia(agenciaWs))) return { ok: false, error: 'Este negocio no es Agency.' };
    const [zona, cartera, libro, planes, agencia] = await Promise.all([
      zonaDelNegocioEstricta(agenciaWs),
      leerCartera(agenciaWs),
      leerLibro(agenciaWs),
      planesMako(),
      getSupabaseServer().from('workspaces').select('nombre, capa').eq('id', agenciaWs).maybeSingle(),
    ]);
    if (agencia.error) throw new Error(`No pude leer la agencia: ${agencia.error.message}`);
    const precios = preciosDelCatalogo(planes);
    if (!precios) return { ok: false, error: 'No encontré el precio de MaKo Esencial o de MaKo Pro en los planes.' };
    const ag = (agencia.data ?? {}) as { nombre?: string | null; capa?: string | null };

    const ids = [...new Set(cartera.filas.map((f) => Number(f.cliente_ws)))];
    const [wss, marcas] = ids.length
      ? await Promise.all([
        getSupabaseServer().from('workspaces').select('id, nombre, capa').in('id', ids),
        getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', KEY_PLAN_CAMBIADO).in('workspace_id', ids),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (wss.error) throw new Error(`No pude leer las cuentas de los clientes: ${wss.error.message}`);
    if (marcas.error) throw new Error(`No pude leer el plan de los clientes: ${marcas.error.message}`);
    const cuentaDe = new Map(((wss.data ?? []) as Array<{ id: number; nombre: string | null; capa: string | null }>).map((w) => [Number(w.id), w]));
    const elegidos = new Set(((marcas.data ?? []) as Array<{ workspace_id: number; value: unknown }>)
      .filter((m) => leerCambioDePlan(m.value) != null).map((m) => Number(m.workspace_id)));

    const dia = (iso: string | null): Dia | null => (iso && Number.isFinite(Date.parse(iso)) ? hoyEnTz(zona, new Date(iso)) : null);
    const clientes: ClienteDeAgencia[] = [];
    for (const f of cartera.filas) {
      const ws = Number(f.cliente_ws);
      const invitado = dia(f.created_at);
      if (!invitado) continue;
      const estado: EstadoCartera = (ESTADOS_CARTERA as readonly string[]).includes(f.estado) ? (f.estado as EstadoCartera) : 'pendiente';
      const w = cuentaDe.get(ws);
      clientes.push({
        ws, nombre: w?.nombre?.trim() || `Cliente ${ws}`, estado, invitado,
        corregido: esDia(f.cobra_desde) ? f.cobra_desde : null,
        baja: estado === 'revocado' ? dia(f.decidido_at) : null,
        plan: planQueSeCobra({ elegido: elegidos.has(ws), capa: w?.capa }),
      });
    }

    const hoy = hoyEnTz(zona, ahora);
    const mesHoy = mesDe(hoy);
    const config = libro.config;
    const primerMes = config?.desde ?? mesHoy;
    const planAgencia = planDeCapa(ag.capa);
    const armar = (mes: Mes): MesDeMensualidad | null => {
      const cuenta = cuentaDelMes({ mes, primerMes, planAgencia, clientes, precios });
      return cuenta ? { mes, cuenta, pago: libro.pagos.get(mes) ?? null, avisado: libro.avisos.has(mes) } : null;
    };
    // Prendida desde un mes que todavía no llegó: lo de hoy es cómo va a quedar ese primer mes.
    const actual = armar(mesHoy >= primerMes ? mesHoy : primerMes)!;
    const anteriores = config ? mesesEntre(primerMes, mesHoy).filter((m) => m !== mesHoy).reverse().map(armar).filter((x): x is MesDeMensualidad => !!x) : [];

    const filas: FilaMensualidad[] = clientes
      .map((c) => ({ ws: c.ws, nombre: c.nombre, estado: c.estado, plan: c.plan, invitado: c.invitado, corregido: c.corregido, arranca: arrancaElReloj(c), situacion: situacion(c, hoy) }))
      .sort((a, b) => peso(a.situacion) - peso(b.situacion) || a.nombre.localeCompare(b.nombre, 'es'));
    return {
      ok: true, agenciaWs, agencia: ag.nombre?.trim() || `Agencia ${agenciaWs}`, hoy, zona, config, precios, planAgencia,
      clientes: filas, cartera: clientes, actual, anteriores, puedeCorregir: cartera.conColumna,
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Primero los que vencen pronto, después los que cuentan, después las bajas. */
const peso = (s: Situacion): number => (s.tipo === 'sin-costo' ? 0 : s.tipo === 'cuenta' ? 1 : s.tipo === 'baja' ? 2 : 3);

/** ¿Esta agencia tiene la mensualidad prendida? `null` = no se pudo leer (no es «no»). */
export async function mensualidadPrendida(agenciaWs: number): Promise<boolean | null> {
  try { return (await leerLibro(agenciaWs)).config != null; } catch { return null; }
}

// ── Escrituras (las llama el super admin: la puerta es de quien llama) ───────────────────────────────────────────

export type Resultado = { ok: true; resumen: string; yaEstaba?: true } | { ok: false; error: string };

/** Prende la mensualidad de una agencia desde un mes (el primero que se factura así), por un medio de pago. */
export async function prenderMensualidad(p: { agenciaWs: number; desde: string; medio?: string | null; autor: string }): Promise<Resultado> {
  if (!esWs(p.agenciaWs)) return { ok: false, error: 'Agencia inválida.' };
  if (!esMes(p.desde)) return { ok: false, error: 'El mes va como AAAA-MM (por ejemplo 2026-11).' };
  try {
    if (!(await esAgencia(p.agenciaWs))) return { ok: false, error: 'Ese negocio no es Agency.' };
    const medio = (p.medio ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || MEDIO_POR_DEFECTO;
    const antes = (await leerLibro(p.agenciaWs)).config;
    if (antes && antes.desde === p.desde && antes.medio === medio) return { ok: true, resumen: 'La mensualidad ya estaba prendida así.', yaEstaba: true };
    const valor: ConfigMensualidad = { desde: p.desde, medio, prendidaPor: p.autor.slice(0, 120), prendidaAt: new Date().toISOString() };
    await enLaPlataforma(() => setSetting(KEY_CONFIG(p.agenciaWs), JSON.stringify(valor)));
    return { ok: true, resumen: `Mensualidad prendida desde ${p.desde}, por ${medio}.` };
  } catch (e) {
    return { ok: false, error: `No pude prender la mensualidad: ${msg(e)}` };
  }
}

/** La apaga: deja de avisar. Lo pagado y lo avisado quedan anotados. */
export async function apagarMensualidad(p: { agenciaWs: number }): Promise<Resultado> {
  if (!esWs(p.agenciaWs)) return { ok: false, error: 'Agencia inválida.' };
  try {
    if (!(await leerLibro(p.agenciaWs)).config) return { ok: true, resumen: 'La mensualidad ya estaba apagada.', yaEstaba: true };
    await enLaPlataforma(() => borrarSetting(KEY_CONFIG(p.agenciaWs)));
    return { ok: true, resumen: 'Mensualidad apagada: no se le avisa más. Lo pagado queda anotado.' };
  } catch (e) {
    return { ok: false, error: `No pude apagar la mensualidad: ${msg(e)}` };
  }
}

/**
 * Marca un mes «Pagado», con el día en que entró. Guarda el total de ese momento: lo que se corrija después no lo cambia.
 * Un mes del que todavía falta más de uno no se marca (no hay cuenta que pagar).
 */
export async function marcarMesPagado(p: { agenciaWs: number; mes: string; pagadoEl: string; autor: string }, ahora: Date = new Date()): Promise<Resultado & { totalUsd?: number }> {
  if (!esMes(p.mes)) return { ok: false, error: 'El mes va como AAAA-MM (por ejemplo 2026-11).' };
  if (!esDia(p.pagadoEl)) return { ok: false, error: 'La fecha del pago va como AAAA-MM-DD.' };
  const m = await mensualidadDeAgencia(p.agenciaWs, ahora);
  if (!m.ok) return { ok: false, error: m.error };
  if (!m.config) return { ok: false, error: 'Esta agencia no tiene la mensualidad prendida.' };
  if (p.mes < m.config.desde) return { ok: false, error: `La mensualidad arranca en ${m.config.desde}: ese mes no se factura así.` };
  // Un mes que todavía no empezó no tiene cuenta: la arma su día 1, con quien cuente ese día.
  if (p.mes > mesDe(m.hoy)) return { ok: false, error: 'Ese mes todavía no empezó: se marca desde su día 1.' };
  if (p.pagadoEl > sumarDias(m.hoy, 1)) return { ok: false, error: 'La fecha del pago no puede ser futura.' };
  const mes = p.mes === m.actual.mes ? m.actual : m.anteriores.find((x) => x.mes === p.mes);
  if (!mes) return { ok: false, error: 'No pude armar la cuenta de ese mes.' };
  if (mes.pago && mes.pago.pagadoEl === p.pagadoEl) return { ok: true, resumen: `Ya estaba marcado pagado el ${p.pagadoEl}.`, yaEstaba: true, totalUsd: mes.pago.totalUsd };
  const valor: PagoDelMes = { mes: p.mes, pagadoEl: p.pagadoEl, totalUsd: mes.cuenta.totalUsd, marcadoPor: p.autor.slice(0, 120), marcadoAt: new Date().toISOString() };
  try {
    await enLaPlataforma(() => setSetting(KEY_PAGO(p.agenciaWs, p.mes), JSON.stringify(valor)));
  } catch (e) {
    return { ok: false, error: `No pude marcarlo pagado: ${msg(e)}` };
  }
  return { ok: true, resumen: `Listo: ${p.mes} quedó pagado el ${p.pagadoEl}.`, totalUsd: mes.cuenta.totalUsd };
}

/** Saca la marca de «Pagado» de un mes (el «Deshacer»). Sólo si sigue diciendo lo que se marcó: no pisa otra marca. */
export async function quitarMesPagado(p: { agenciaWs: number; mes: string; pagadoEl?: string | null }): Promise<Resultado> {
  if (!esWs(p.agenciaWs) || !esMes(p.mes)) return { ok: false, error: 'Mes inválido.' };
  try {
    const crudo = (await enLaPlataforma(() => getSettingsConPrefijo(PREFIJO(p.agenciaWs)))).get(KEY_PAGO(p.agenciaWs, p.mes));
    if (!crudo) return { ok: true, resumen: 'Ese mes no estaba marcado pagado.', yaEstaba: true };
    const pago = leerPagoDelMes(crudo);
    if (p.pagadoEl && pago && pago.pagadoEl !== p.pagadoEl) return { ok: false, error: 'Ese mes se volvió a marcar con otra fecha: no lo toqué.' };
    const borrado = await enLaPlataforma(() => borrarSettingSi(KEY_PAGO(p.agenciaWs, p.mes), crudo));
    return borrado ? { ok: true, resumen: `${p.mes} quedó sin pagar.` } : { ok: false, error: 'Otro lo cambió recién: vuelve a abrir la pantalla.' };
  } catch (e) {
    return { ok: false, error: `No pude sacar la marca: ${msg(e)}` };
  }
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
      ? `Listo: sus ${DIAS_SIN_COSTO} días corren desde el ${p.dia}; cuenta desde el ${sumarDias(p.dia, DIAS_SIN_COSTO)}.`
      : `Listo: sus ${DIAS_SIN_COSTO} días vuelven a correr desde la invitación.`,
  };
}

// ── Los avisos (el cron) ──────────────────────────────────────────────────────────────────────────────────────────

const TIPO_AVISO = 'agencia-mensualidad';

/** Lo deja en las notificaciones de la agencia (las ven sus admins) y le manda el correo a cada admin. */
async function avisarALaAgencia(agenciaWs: number, c: Correo, payload: Record<string, unknown>): Promise<{ enLaApp: boolean; correos: number; errores: string[] }> {
  const errores: string[] = [];
  const feed = await crearNotificacion({
    ws: agenciaWs, tipo: TIPO_AVISO, severidad: payload.plazo ? 'warn' : 'info', titulo: c.titulo, descripcion: c.resumen,
    link: '/agency?vista=mensualidad', entityType: 'agencia-mensualidad', payload, origen: `sistema:${TIPO_AVISO}`,
  });
  let correos = 0;
  const admins = await adminsDeCuenta(agenciaWs).catch((e) => { errores.push(`admins: ${msg(e)}`); return [] as string[]; });
  for (const to of admins) {
    const r = await avisarDePlataforma({ to, asunto: c.asunto, preheader: c.preheader, cuerpo: c.cuerpo, tag: TIPO_AVISO })
      .catch((e) => ({ enviado: false, error: msg(e) }));
    if (r.enviado) correos += 1; else errores.push(`correo: ${r.error ?? 'no salió'}`);
  }
  return { enLaApp: feed != null, correos, errores };
}

/**
 * Reclama un aviso (compare-and-set: de dos corridas a la vez gana UNA) y lo manda. Si no salió por ningún lado, suelta
 * el reclamo para que la corrida de mañana lo vuelva a intentar.
 */
async function avisarUnaVez(key: string, agenciaWs: number, c: Correo, payload: Record<string, unknown>): Promise<'avisado' | 'ya-estaba' | 'fallo'> {
  const valor = JSON.stringify({ at: new Date().toISOString(), ...payload });
  const gano = await enLaPlataforma(() => cambiarSettingSi(key, null, valor));
  if (!gano) return 'ya-estaba';
  const r = await avisarALaAgencia(agenciaWs, c, payload);
  if (r.enLaApp || r.correos > 0) return 'avisado';
  await enLaPlataforma(() => borrarSettingSi(key, valor)).catch(() => false);
  console.warn(`[agencia-mes] agencia ${agenciaWs}: el aviso no salió (${r.errores.join(' · ') || 'sin destinatarios'}); se reintenta mañana.`);
  return 'fallo';
}

export type CorridaDeAgencia = {
  agenciaWs: number; ok: boolean; mes?: 'avisado' | 'ya-estaba' | 'fallo' | 'pagado' | 'saldria' | null; plazos?: number; error?: string;
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
 * La corrida del día: a cada agencia con la mensualidad prendida, el aviso del mes (del 1 al 5, una vez por mes, si no
 * está pagado) y el de cada cliente al que le quedan 1 o 2 días sin costo (una vez por cliente y por fecha).
 */
export async function avisarMensualidades(ahora: Date = new Date(), o: { dry?: boolean } = {}): Promise<CorridaDeAgencia[]> {
  const out: CorridaDeAgencia[] = [];
  for (const agenciaWs of await agenciasConMensualidad()) {
    try {
      const m = await mensualidadDeAgencia(agenciaWs, ahora);
      if (!m.ok) { out.push({ agenciaWs, ok: false, error: m.error }); continue; }
      if (!m.config) { out.push({ agenciaWs, ok: true, mes: null, plazos: 0 }); continue; }
      const link = linkApp('/agency?vista=mensualidad', agenciaWs);
      let estadoMes: CorridaDeAgencia['mes'] = null;
      const saldrian: string[] = [];
      const mesAviso = mesQueSeAvisa(m.hoy, m.config.desde);
      if (mesAviso && mesAviso === m.actual.mes) {
        if (m.actual.pago) estadoMes = 'pagado';
        else {
          const sinCosto = m.clientes.flatMap((c) => (c.situacion.tipo === 'sin-costo' ? [{ nombre: c.nombre, hasta: c.situacion.hasta }] : []));
          const correo = avisoDelMes({ agencia: m.agencia, cuenta: m.actual.cuenta, medio: m.config.medio, sinCosto, link });
          if (o.dry) { estadoMes = m.actual.avisado ? 'ya-estaba' : 'saldria'; saldrian.push(correo.titulo); }
          else estadoMes = await avisarUnaVez(KEY_AVISO(agenciaWs, mesAviso), agenciaWs, correo, { mes: mesAviso, totalUsd: m.actual.cuenta.totalUsd });
        }
      }
      let plazos = 0;
      for (const p of plazosPorVencer(m.cartera, m.hoy)) {
        const correo = avisoDePlazo({ nombre: p.nombre, desde: p.desde, plan: p.plan, precioUsd: m.precios[p.plan], link });
        if (o.dry) { saldrian.push(correo.titulo); continue; }
        const r = await avisarUnaVez(KEY_PLAZO(agenciaWs, p.ws, p.desde), agenciaWs, correo, { plazo: true, clienteWs: p.ws, desde: p.desde });
        if (r === 'avisado') plazos += 1;
      }
      out.push({ agenciaWs, ok: estadoMes !== 'fallo', mes: estadoMes, plazos, ...(o.dry ? { saldrian } : {}) });
    } catch (e) {
      out.push({ agenciaWs, ok: false, error: msg(e) });
    }
  }
  return out;
}

// ── Lo que lee MaKo (la API: ver_mensualidad_agencia y ver_mensualidades_agencias) ─────────────────────────────────

/** La mensualidad en la forma que lee un modelo: con la unidad en el nombre de cada campo y sin texto que adivinar. */
export function mensualidadParaMako(m: Extract<Mensualidad, { ok: true }>) {
  const s = (c: FilaMensualidad) => c.situacion;
  return {
    prendida: m.config != null,
    agencia: m.agencia,
    agencia_ws: m.agenciaWs,
    medio: m.config?.medio ?? null,
    prendida_desde: m.config?.desde ?? null,
    hoy: m.hoy,
    este_mes: {
      mes: m.actual.mes,
      total_usd: m.actual.cuenta.totalUsd,
      se_paga_hasta: m.actual.cuenta.limite,
      pagado: m.actual.pago != null,
      pagado_el: m.actual.pago?.pagadoEl ?? null,
      renglones: m.actual.cuenta.lineas.map((l) => ({ concepto: conceptoDeLinea(l), monto_usd: l.montoUsd })),
    },
    clientes: m.clientes.map((c) => ({
      cliente_ws: c.ws, nombre: c.nombre, plan: NOMBRE_PLAN[c.plan], estado: s(c).tipo,
      cuenta_desde: s(c).tipo === 'cuenta' || s(c).tipo === 'baja' ? (s(c) as { desde: Dia }).desde : null,
      sin_costo_hasta: s(c).tipo === 'sin-costo' ? (s(c) as { hasta: Dia }).hasta : null,
      faltan_dias: s(c).tipo === 'sin-costo' ? (s(c) as { faltan: number }).faltan : null,
      de_baja_el: s(c).tipo === 'baja' || s(c).tipo === 'baja-sin-costo' ? (s(c) as { baja: Dia }).baja : null,
      reloj_desde: c.arranca,
      fecha_corregida: c.corregido != null,
    })),
    meses_anteriores: m.anteriores.map((x) => ({ mes: x.mes, total_usd: x.pago?.totalUsd ?? x.cuenta.totalUsd, pagado: x.pago != null, pagado_el: x.pago?.pagadoEl ?? null })),
    nota: `estado: cuenta (ya paga), sin-costo (en sus ${DIAS_SIN_COSTO} días desde que se lo invitó; sin_costo_hasta es el primer día que cuenta), baja-sin-costo (de baja antes de sus ${DIAS_SIN_COSTO} días: no se cobra), baja (contó y se dio de baja). Lo que se paga del 1 al ${DIA_LIMITE_DE_PAGO} es ese mes por adelantado; los días del mes en que un cliente empezó a contar se suman al mes siguiente. MaKo no cobra: el pago va por fuera y lo anota el super admin.`,
  };
}
