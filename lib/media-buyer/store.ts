// =============================================================================
// Media Buyer — dónde se guarda: la configuración de cada negocio y el registro de decisiones
// =============================================================================
// Tablas de la migración 0332. TENANT-SAFETY: todo recibe `ws` EXPLÍCITO (lo llama el cron, sin sesión) y lee
// con el cliente del servidor y `.eq('workspace_id', ws)`, igual que lib/zernio.ts.
//
// ⚠️ FALTA LA MIG 0332 → `tablaFalta`. Sin la tabla de decisiones NO se lanza nada: una decisión que no queda
// registrada no se puede deshacer, y eso es la mitad del pedido. La configuración sin tabla es la de por defecto
// (piloto apagado). La pantalla lo dice en vez de fingir un registro vacío.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { esEsencialDe } from '@/lib/plan-esencial';
import { cupoDelPlan, type CupoMediaBuyer } from './plan';
import { mezclarTacticas, pideAutomatica, validarTacticas, type ConfigTacticas } from './tacticas';
import { diasHasta, fechaValida, leerHastaGuardadas, leerZonaGuardada, validarHastaCampanas, validarZona } from './zona';
import {
  CONFIG_POR_DEFECTO, VENCE_HORAS,
  type ConfigMediaBuyer, type Decision, type EstadoDecision, type Propuesta,
} from './tipos';

/** La 0350 (zona y fecha de fin) todavía no está: guardar una zona o una fecha da «columna inexistente» (PGRST204 / 42703). */
export class MediaBuyerSinZona extends Error {
  constructor() { super('Falta aplicar la migración 0350 del Media Buyer: la zona y la fecha de fin todavía no se pueden guardar.'); this.name = 'MediaBuyerSinZona'; }
}
const columnaFalta = (e: { code?: string | null; message?: string | null }): boolean =>
  e.code === 'PGRST204' || e.code === '42703' || /(zona|hasta_campanas|hasta).*(column|schema cache)|column.*(zona|hasta_campanas|hasta)/i.test(e.message ?? '');

export class MediaBuyerSinTabla extends Error {
  constructor() { super('Falta aplicar la migración 0332 (media_buyer_*): el registro de decisiones todavía no existe.'); this.name = 'MediaBuyerSinTabla'; }
}

/** ¿El error es «la tabla no existe»? (Postgres 42P01, o PostgREST PGRST205 cuando no la tiene en su caché). */
export function tablaFalta(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205' || /media_buyer_\w+.*(does not exist|schema cache)/i.test(e.message ?? '');
}

/** El plan no trae el piloto automático (MaKo Esencial por la pasarela: lib/media-buyer/plan.ts). */
export class PlanSinPiloto extends Error {
  constructor() { super('Tu plan trae el Media Buyer en modo «propone»: MaKo recomienda y tú decides. El piloto automático es de MaKo Pro.'); this.name = 'PlanSinPiloto'; }
}

/** El cupo del plan del negocio. Ante la duda (no se pudo leer la suscripción), sin cupo: lib/plan-esencial.ts. */
export const cupoDe = async (ws: number): Promise<CupoMediaBuyer> => cupoDelPlan(await esEsencialDe(ws));

const num = (x: unknown): number | null => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);

// ── Configuración ───────────────────────────────────────────────────────────

export type ConfigGuardada = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo: Record<string, unknown> | null; existeTabla: boolean };

export async function leerConfig(ws: number): Promise<ConfigGuardada> {
  const { data, error } = await getSupabaseServer().from('media_buyer_config').select('*').eq('workspace_id', ws).maybeSingle();
  if (error) {
    if (tablaFalta(error)) return { ...CONFIG_POR_DEFECTO, ultimaCorrida: null, ultimaCorridaInfo: null, existeTabla: false };
    throw new Error(`media_buyer_config: ${error.message}`);
  }
  if (!data) return { ...CONFIG_POR_DEFECTO, ultimaCorrida: null, ultimaCorridaInfo: null, existeTabla: true };
  return {
    encendido: data.encendido === true,
    modo: data.modo === 'piloto' ? 'piloto' : 'propone',
    kpi: data.kpi === 'agenda' || data.kpi === 'venta' ? data.kpi : 'lead',
    objetivo: num(data.objetivo),
    subidaMaxPctDia: num(data.subida_max_pct_dia) ?? CONFIG_POR_DEFECTO.subidaMaxPctDia,
    presupuestoMaxDia: num(data.presupuesto_max_dia),
    metaVentasMes: num(data.meta_ventas_mes),
    metaGastoMes: num(data.meta_gasto_mes),
    cuentaPublicitaria: typeof data.cuenta_publicitaria === 'string' ? data.cuenta_publicitaria : null,
    tacticas: (() => { const t = validarTacticas(data.tacticas ?? {}); return t.ok ? t.valor : {}; })(),
    // Sin la 0350 las columnas no vienen: sin zona y sin fecha, como hasta hoy.
    zona: leerZonaGuardada(data.zona),
    hasta: fechaValida(data.hasta),
    hastaCampanas: leerHastaGuardadas(data.hasta_campanas),
    ultimaCorrida: (data.ultima_corrida as string | null) ?? null,
    ultimaCorridaInfo: (data.ultima_corrida_info as Record<string, unknown> | null) ?? null,
    existeTabla: true,
  };
}

/**
 * Lo que se puede cambiar desde Ajustes. Valida acá: el cliente manda lo que quiera. `hastaCampana` cambia la fecha de UNA
 * campaña (Campañas, la API): se MEZCLA con las guardadas al escribir, como las tácticas (revisión de tren-l, falla 2).
 */
export type CambioConfig = Partial<ConfigMediaBuyer> & { hastaCampana?: { campanaId: string; fecha: string | null } };

export function validarCambio(c: CambioConfig): { ok: true; fila: Record<string, unknown> } | { ok: false; error: string } {
  const fila: Record<string, unknown> = {};
  if (c.encendido !== undefined) fila.encendido = c.encendido === true;
  if (c.modo !== undefined) {
    if (c.modo !== 'propone' && c.modo !== 'piloto') return { ok: false, error: 'Modo inválido.' };
    fila.modo = c.modo;
  }
  if (c.kpi !== undefined) {
    if (!['lead', 'agenda', 'venta'].includes(c.kpi)) return { ok: false, error: 'Resultado inválido.' };
    fila.kpi = c.kpi;
  }
  const positivoONulo = (v: unknown, nombre: string, col: string): string | null => {
    if (v === undefined) return null;
    if (v === null) { fila[col] = null; return null; }
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return `${nombre}: tiene que ser un número mayor que cero.`;
    fila[col] = Math.round(n * 100) / 100;
    return null;
  };
  const errs = [
    positivoONulo(c.objetivo, 'El objetivo', 'objetivo'),
    positivoONulo(c.presupuestoMaxDia, 'El presupuesto máximo por día', 'presupuesto_max_dia'),
    positivoONulo(c.metaVentasMes, 'La meta de ventas', 'meta_ventas_mes'),
    positivoONulo(c.metaGastoMes, 'La meta de gasto', 'meta_gasto_mes'),
  ].filter(Boolean);
  if (errs.length) return { ok: false, error: errs[0]! };
  if (c.tacticas !== undefined) {
    const t = validarTacticas(c.tacticas);
    if (!t.ok) return { ok: false, error: t.error };
    fila.tacticas = t.valor;
  }
  if (c.cuentaPublicitaria !== undefined) {
    const v = c.cuentaPublicitaria == null ? null : String(c.cuentaPublicitaria).trim().replace(/^(\d)/, 'act_$1');
    if (v != null && v !== '' && !/^act_\d{5,25}$/.test(v)) return { ok: false, error: 'La cuenta publicitaria es act_ y los números.' };
    fila.cuenta_publicitaria = v || null;
  }
  if (c.zona !== undefined) {
    const z = validarZona(c.zona);
    if (!z.ok) return { ok: false, error: z.error };
    fila.zona = z.valor;
  }
  if (c.hasta !== undefined) {
    const f = c.hasta == null || c.hasta === '' ? null : fechaValida(c.hasta);
    if (c.hasta != null && c.hasta !== '' && !f) return { ok: false, error: 'La fecha de fin va como AAAA-MM-DD.' };
    fila.hasta = f;
  }
  if (c.hastaCampanas !== undefined) {
    const h = validarHastaCampanas(c.hastaCampanas);
    if (!h.ok) return { ok: false, error: h.error };
    fila.hasta_campanas = h.valor;
  }
  if (c.hastaCampana !== undefined) {
    const id = String(c.hastaCampana?.campanaId ?? '');
    if (!/^\d{1,30}$/.test(id)) return { ok: false, error: 'La campaña va por su id numérico de Meta.' };
    const raw = c.hastaCampana.fecha;
    const f = raw == null || raw === '' ? null : fechaValida(raw);
    if (raw != null && raw !== '' && !f) return { ok: false, error: 'La fecha de fin va como AAAA-MM-DD.' };
    fila._hasta_campana = { id, fecha: f };
  }
  if (c.subidaMaxPctDia !== undefined) {
    const n = Number(c.subidaMaxPctDia);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: 'La subida máxima por día va de 0% a 100%.' };
    fila.subida_max_pct_dia = Math.round(n);
  }
  return { ok: true, fila };
}

export async function guardarConfig(ws: number, cambio: CambioConfig, quien: string): Promise<ConfigGuardada> {
  const v = validarCambio(cambio);
  if (!v.ok) throw new Error(v.error);
  // La ÚNICA puerta que prende el piloto (la pantalla, Ajustes, Automatizaciones y la API de MaKo pasan por acá): el modo
  // general o una táctica automática.
  const pidePiloto = v.fila.modo === 'piloto' || (v.fila.tacticas != null && pideAutomatica(v.fila.tacticas as ConfigTacticas));
  if (pidePiloto && !(await cupoDe(ws)).piloto) throw new PlanSinPiloto();
  // Las tácticas que llegan se mezclan con las guardadas (el piloto se juzgó arriba sobre lo que se PIDIÓ, no sobre lo mezclado).
  if (v.fila.tacticas != null) v.fila.tacticas = mezclarTacticas((await leerConfig(ws)).tacticas, v.fila.tacticas as ConfigTacticas);
  // La fecha de UNA campaña sobre las guardadas, leídas estrictas (leerConfig tira si la base falla: no se escribe encima de un
  // «vacío» que es un error).
  const una = v.fila._hasta_campana as { id: string; fecha: string | null } | undefined;
  delete v.fila._hasta_campana;
  if (una) {
    const base = { ...((v.fila.hasta_campanas as Record<string, string> | undefined) ?? (await leerConfig(ws)).hastaCampanas) };
    if (una.fecha) base[una.id] = una.fecha; else delete base[una.id];
    if (Object.keys(base).length > 300) throw new Error('Hasta 300 campañas con fecha de fin: saca las de campañas que ya no corren.');
    v.fila.hasta_campanas = base;
  }
  // Una fecha de fin que ya pasó pausaría todo en la próxima vuelta del vigía: no se guarda (hallazgo 4). Para pausar, se pausa.
  const fechasNuevas = [v.fila.hasta as string | null | undefined, una?.fecha].filter((f): f is string => !!f);
  if (fechasNuevas.length) {
    const { hoyDelNegocio } = await import('./datos');
    const hoy = await hoyDelNegocio(ws);
    if (hoy && fechasNuevas.some((f) => diasHasta(hoy, f) < 0)) throw new Error('Esa fecha de fin ya pasó: elige hoy o un día que venga.');
  }
  const { error } = await getSupabaseServer().from('media_buyer_config')
    .upsert({ workspace_id: ws, ...v.fila, updated_at: new Date().toISOString(), updated_by: quien.slice(0, 200) }, { onConflict: 'workspace_id' });
  if (error) {
    if (tablaFalta(error)) throw new MediaBuyerSinTabla();
    if (('zona' in v.fila || 'hasta' in v.fila || 'hasta_campanas' in v.fila) && columnaFalta(error)) throw new MediaBuyerSinZona();
    throw new Error(`media_buyer_config: ${error.message}`);
  }
  return leerConfig(ws);
}

export async function marcarCorrida(ws: number, info: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseServer().from('media_buyer_config')
    .upsert({ workspace_id: ws, ultima_corrida: new Date().toISOString(), ultima_corrida_info: info }, { onConflict: 'workspace_id' });
  if (error && !tablaFalta(error)) throw new Error(`media_buyer_config (corrida): ${error.message}`);
}

// ── Decisiones ──────────────────────────────────────────────────────────────

function deFila(f: Record<string, unknown>): Decision {
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  return {
    id: String(f.id),
    ws: Number(f.workspace_id),
    clave: String(f.clave),
    creada: String(f.creada),
    tipo: f.tipo as Decision['tipo'],
    tactica: f.tactica as Decision['tactica'],
    nivel: f.nivel as Decision['nivel'],
    entidadId: String(f.entidad_id),
    entidadNombre: String(f.entidad_nombre),
    campanaNombre: (f.campana_nombre as string | null) ?? null,
    titulo: String(f.titulo),
    titular: String(f.titular),
    porque: arr<string>(f.porque),
    numeros: arr(f.numeros),
    antes: (f.antes as Decision['antes']) ?? {},
    despues: (f.despues as Decision['despues']) ?? {},
    anuncioBase: (f.anuncio_base as Decision['anuncioBase']) ?? null,
    variaciones: f.variaciones ? arr(f.variaciones) : undefined,
    moneda: (f.moneda as string | null) ?? null,
    estado: f.estado as EstadoDecision,
    origen: (f.origen as Decision['origen']) ?? null,
    aplicadaPor: (f.aplicada_por as string | null) ?? null,
    aplicadaAt: (f.aplicada_at as string | null) ?? null,
    deshechaPor: (f.deshecha_por as string | null) ?? null,
    deshechaAt: (f.deshecha_at as string | null) ?? null,
    canal: (f.canal as Decision['canal']) ?? null,
    error: (f.error as string | null) ?? null,
    nota: (f.nota as string | null) ?? null,
    motivoDescarte: (f.motivo_descarte as string | null) ?? null,
    estrellas: num(f.estrellas),
    creados: arr<string>(f.creados),
  };
}

/**
 * Guarda las propuestas nuevas del día. Las que ya existen (misma clave) NO se pisan: una decisión que una persona
 * descartó a la mañana no vuelve a abrirse porque el cron corrió otra vez. Devuelve las que entraron.
 */
export async function guardarPropuestas(ws: number, props: Propuesta[], moneda: string | null): Promise<Decision[]> {
  if (!props.length) return [];
  const filas = props.map((p) => ({
    workspace_id: ws, clave: p.clave, tipo: p.tipo, tactica: p.tactica, nivel: p.nivel,
    entidad_id: p.entidadId, entidad_nombre: p.entidadNombre, campana_nombre: p.campanaNombre,
    titulo: p.titulo, titular: p.titular, porque: p.porque, numeros: p.numeros, antes: p.antes, despues: p.despues,
    anuncio_base: p.anuncioBase ?? null, variaciones: p.variaciones ?? null, moneda,
  }));
  const { data, error } = await getSupabaseServer().from('media_buyer_decisiones')
    .upsert(filas, { onConflict: 'workspace_id,clave', ignoreDuplicates: true }).select('*');
  if (error) {
    if (tablaFalta(error)) throw new MediaBuyerSinTabla();
    throw new Error(`media_buyer_decisiones (guardar): ${error.message}`);
  }
  return (data ?? []).map(deFila);
}

export async function leerDecision(ws: number, id: string): Promise<Decision | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getSupabaseServer().from('media_buyer_decisiones').select('*').eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) {
    if (tablaFalta(error)) throw new MediaBuyerSinTabla();
    throw new Error(`media_buyer_decisiones (leer): ${error.message}`);
  }
  return data ? deFila(data) : null;
}

/** Las decisiones de los últimos `dias` días, de la más nueva a la más vieja. */
export async function leerDecisiones(ws: number, dias = 30): Promise<{ decisiones: Decision[]; existeTabla: boolean }> {
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  const { data, error } = await getSupabaseServer().from('media_buyer_decisiones').select('*')
    .eq('workspace_id', ws).gte('creada', desde).order('creada', { ascending: false }).limit(500);
  if (error) {
    if (tablaFalta(error)) return { decisiones: [], existeTabla: false };
    throw new Error(`media_buyer_decisiones (listar): ${error.message}`);
  }
  return { decisiones: (data ?? []).map(deFila), existeTabla: true };
}

/**
 * Cambia el estado RECLAMANDO: sólo si sigue en `desde`. Dos clics, dos pestañas o el cron y una persona a la vez
 * lanzaban dos veces (AGENTS.md, «Confirmar RECLAMA antes de ejecutar»): con presupuesto, eso es plata.
 * Devuelve la decisión reclamada, o null si otro ya la tomó.
 */
export async function reclamar(ws: number, id: string, desde: EstadoDecision[], cambios: Record<string, unknown>): Promise<Decision | null> {
  const { data, error } = await getSupabaseServer().from('media_buyer_decisiones').update(cambios)
    .eq('workspace_id', ws).eq('id', id).in('estado', desde).select('*');
  if (error) {
    if (tablaFalta(error)) throw new MediaBuyerSinTabla();
    throw new Error(`media_buyer_decisiones (reclamar): ${error.message}`);
  }
  return data && data.length ? deFila(data[0]) : null;
}

export async function actualizar(ws: number, id: string, cambios: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseServer().from('media_buyer_decisiones').update(cambios).eq('workspace_id', ws).eq('id', id);
  if (error) {
    if (tablaFalta(error)) throw new MediaBuyerSinTabla();
    throw new Error(`media_buyer_decisiones (actualizar): ${error.message}`);
  }
}

/** Las abiertas de hace más de 48 h pasan a «vencida»: los números que las dispararon ya no son los de hoy. */
export async function vencerViejas(ws: number): Promise<number> {
  const corte = new Date(Date.now() - VENCE_HORAS * 3600_000).toISOString();
  // La pausa por fecha de fin no vence: es la regla de la persona, y se relanza hasta que salga (zona.ts → pausasPendientes).
  const { data, error } = await getSupabaseServer().from('media_buyer_decisiones').update({ estado: 'vencida' })
    .eq('workspace_id', ws).eq('estado', 'abierta').neq('tactica', 'hasta').lt('creada', corte).select('id');
  if (error) {
    if (tablaFalta(error)) return 0;
    throw new Error(`media_buyer_decisiones (vencer): ${error.message}`);
  }
  return data?.length ?? 0;
}
