// =============================================================================
// ia-pc — la puerta del servidor a la computadora de CADA cliente (docs/ia-del-cliente.md §3, ola 1)
// =============================================================================
// Es la puerta del Centro de Operaciones (AGENTS.md, «El Centro de Operaciones es una puerta a la PC de Martín») pero
// con la confianza al revés: la PC del cliente sólo PIENSA (Claude Code sin herramientas propias), y todo lo que hace
// pasa por acá, con las reglas del chat. Las reglas que se revisan (§3):
//   1. el negocio sale SIEMPRE del token, nunca de un parámetro;
//   2. el token de la PC sólo late, toma turnos de SU negocio Y DE SU PERSONA y los contesta;
//   3. las herramientas van con un token POR TURNO, que se acuña cuando la PC lo toma;
//   4. un turno se toma una sola vez, y vence;
//   5. lo que contesta la PC pasa por las mismas guardas que lo que contesta un modelo (en lib/mako-turno-app.ts);
//   6. un tope de turnos por minuto por NEGOCIO.
// Nunca guarda un secreto en claro: los tokens y el código, sólo su sha256.
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY» (revisión del Cerebro, 21/10/2026). Cada lectura mira `error` y TIRA: una falla de la
// base que se leía como «este token no existe» le contestaba 401 a la PC, el programa de Windows se apagaba para siempre y
// el chat decía «préndela» con la PC prendida; la misma falla leída como «no tiene PC» mandaba el turno a Gemini. Las
// rutas de la PC contestan 503 cuando algo tira (el programa reintenta), y el turno falla CERRADO (lib/mako-turno-app.ts).
// =============================================================================

import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import {
  CODIGO_MS, ESPERA_TURNO_MS, LARGO_CODIGO, PREFIJO_TOKEN_PC, PREFIJO_TOKEN_TURNO, SIN_LATIDO_MS, SIN_TOMAR_MS, TURNO_MS, VERSION_CONSENTIMIENTO,
  codigoDe, enLinea, normalizarCodigo, sanearCuentas, sanearNombrePc, sanearRespuesta, tieneFormaDeToken, type CuentaPc, type TipoFalloPc,
} from './ia-pc-reglas';
import type { ToolDef } from './anthropic';

const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
const tokenNuevo = (prefijo: string): string => `${prefijo}${randomBytes(32).toString('base64url')}`;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = () => getSupabaseServer();
/** Una lectura que falló TIRA: nunca se confunde con «no hay». */
const sinError = <T>(r: { data: T; error: { message: string } | null }, que: string): T => {
  if (r.error) throw new Error(`ia-pc: no pude leer ${que}: ${r.error.message}`);
  return r.data;
};

/** Cuántos turnos por minuto acepta la puerta de UN negocio, entre todas sus PC (§3, regla 6). */
export const TOPE_TURNOS_POR_MINUTO = 20;
/** Cuánto se guardan los turnos y sus herramientas (llevan el system con datos del negocio y lo que leyó la PC). */
export const GUARDA_TURNOS_MS = 24 * 60 * 60_000;

export type Dispositivo = { id: number; ws: number; persona: string; nombre: string; ultimoLatido: string | null; cuentas: CuentaPc[] };

// ── Emparejar ────────────────────────────────────────────────────────────────

/**
 * Un código para que ESTA persona empareje una PC suya (10 minutos, un uso). `consentimiento` es la versión del texto
 * que aceptó con un toque (TEXTO_CONSENTIMIENTO): sin eso no hay código (mig 0321). Los códigos vivos que ya tenía se
 * anulan: uno solo a la vez.
 */
export async function crearCodigo(ws: number, persona: string, consentimiento: string): Promise<{ codigo: string; venceAt: string }> {
  if (consentimiento !== VERSION_CONSENTIMIENTO) throw new Error('ia-pc: sin aceptar el texto de hoy no hay código');
  const ahora = new Date().toISOString();
  await db().from('ia_pc_codigos').update({ vence_at: ahora })
    .eq('workspace_id', ws).eq('persona', persona).is('usado_at', null).gt('vence_at', ahora);
  const codigo = codigoDe(randomBytes(LARGO_CODIGO));
  const venceAt = new Date(Date.now() + CODIGO_MS).toISOString();
  const { error } = await db().from('ia_pc_codigos').insert({ codigo_hash: hash(codigo), workspace_id: ws, persona, vence_at: venceAt, consentimiento });
  if (error) throw new Error(`ia-pc: no pude crear el código: ${error.message}`);
  return { codigo, venceAt };
}

/**
 * Canjea el código por el token de la PC. El código se gasta en el mismo update que lo valida (un solo uso). Devuelve
 * también A QUÉ NEGOCIO y COMO QUIÉN se conecta: el programa se lo muestra a la persona y le pregunta si es el suyo antes
 * de dejarla conectada (revisión del 21/10/2026: el código de otro negocio, pegado con la línea oficial, no decía nada).
 */
export async function emparejar(codigoCrudo: unknown, nombreCrudo: unknown): Promise<{ token: string; ws: number; negocio: string; persona: string } | null> {
  const codigo = normalizarCodigo(codigoCrudo);
  if (!codigo) return null;
  const data = sinError(await db().from('ia_pc_codigos')
    .update({ usado_at: new Date().toISOString() })
    .eq('codigo_hash', hash(codigo)).is('usado_at', null).gt('vence_at', new Date().toISOString())
    .select('workspace_id, persona, consentimiento').maybeSingle(), 'el código');
  if (!data) return null;
  const token = tokenNuevo(PREFIJO_TOKEN_PC);
  const ws = Number(data.workspace_id);
  const persona = String(data.persona);
  const { error } = await db().from('ia_pc_dispositivos').insert({
    workspace_id: ws, persona, nombre: sanearNombrePc(nombreCrudo), token_hash: hash(token),
    // Lo que aceptó la persona al pedir el código, con la hora en que se conectó la PC (mig 0321).
    consentimiento: (data.consentimiento as string | null) ?? null, consentimiento_at: new Date().toISOString(),
  });
  if (error) throw new Error(`ia-pc: no pude emparejar: ${error.message}`);
  const w = await db().from('workspaces').select('nombre').eq('id', ws).maybeSingle();
  return { token, ws, negocio: String((w.data as { nombre?: unknown } | null)?.nombre ?? '').trim() || 'tu negocio', persona };
}

/**
 * ¿El código sigue vivo (sin usar y sin vencer)? Lo mira el instalador ANTES de bajar el programa: con un código vencido
 * se bajaba 43 MB para recién ahí decir «pide otro» (revisión del 21/10/2026). No es un oráculo nuevo: `emparejar` ya
 * contesta lo mismo, y gastándolo. Tira si la base falla (el instalador sigue: lo dirá emparejar).
 */
export async function codigoVivo(codigoCrudo: unknown): Promise<boolean> {
  const codigo = normalizarCodigo(codigoCrudo);
  if (!codigo) return false;
  const data = sinError(await db().from('ia_pc_codigos').select('codigo_hash')
    .eq('codigo_hash', hash(codigo)).is('usado_at', null).gt('vence_at', new Date().toISOString()).maybeSingle(), 'el código');
  return !!data;
}

const aDispositivo = (r: Record<string, unknown>): Dispositivo => ({
  id: Number(r.id), ws: Number(r.workspace_id), persona: String(r.persona), nombre: String(r.nombre),
  ultimoLatido: (r.ultimo_latido as string | null) ?? null, cuentas: sanearCuentas(r.cuentas),
});

/**
 * La PC de un token, o null si no existe o la desconectaron. El NEGOCIO sale de acá, nunca de lo que diga el pedido
 * (regla 1). Si la base falla TIRA: la ruta contesta 503 y la PC reintenta (null es 401 `revocado`, y el programa se apaga).
 */
export async function dispositivoDelToken(token: unknown): Promise<Dispositivo | null> {
  if (!tieneFormaDeToken(token, PREFIJO_TOKEN_PC)) return null;
  const data = sinError(await db().from('ia_pc_dispositivos')
    .select('id, workspace_id, persona, nombre, ultimo_latido, cuentas').eq('token_hash', hash(token)).is('revocado_at', null).maybeSingle(), 'la PC');
  return data ? aDispositivo(data) : null;
}

export async function latir(d: Dispositivo, cuerpo: unknown): Promise<void> {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : {};
  const version = typeof o.version === 'string' ? o.version.replace(/[^\w.\-+]/g, '').slice(0, 40) : null;
  const { error } = await db().from('ia_pc_dispositivos')
    .update({ ultimo_latido: new Date().toISOString(), version, cuentas: sanearCuentas(o.cuentas) })
    .eq('id', d.id).eq('workspace_id', d.ws);
  if (error) throw new Error(`ia-pc: no pude anotar el latido: ${error.message}`);
}

/** La PC suelta su propia conexión (al reemplazarla por otra, o si la persona dijo que no era su negocio). */
export async function soltar(d: Dispositivo): Promise<void> {
  await desconectar(d.ws, d.id);
}

/** La PC de ESTA persona en este negocio (la más reciente que no se desconectó), con si está en línea. Tira si falla. */
export async function pcDe(ws: number, persona: string): Promise<(Dispositivo & { enLinea: boolean }) | null> {
  const data = sinError(await db().from('ia_pc_dispositivos')
    .select('id, workspace_id, persona, nombre, ultimo_latido, cuentas')
    .eq('workspace_id', ws).eq('persona', persona).is('revocado_at', null)
    .order('ultimo_latido', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(), 'la PC de la persona');
  if (!data) return null;
  const d = aDispositivo(data);
  return { ...d, enLinea: enLinea(d.ultimoLatido) };
}

/**
 * ¿El NEGOCIO conectó alguna PC (de cualquier persona, en línea o no)? D6b se decide por negocio (revisión del 21/10/2026):
 * el turno de un closer de un negocio que conectó su Claude tampoco va a Gemini. Tira si falla.
 */
export async function negocioConPc(ws: number): Promise<boolean> {
  const data = sinError(await db().from('ia_pc_dispositivos').select('id').eq('workspace_id', ws).is('revocado_at', null).limit(1), 'las PC del negocio');
  return (data ?? []).length > 0;
}

/** Desconecta una PC: su token deja de servir, y el turno que tenía en curso también (sus herramientas no corren más). */
export async function desconectar(ws: number, id: number): Promise<void> {
  const { error } = await db().from('ia_pc_dispositivos').update({ revocado_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', ws).is('revocado_at', null);
  if (error) throw new Error(`ia-pc: no pude desconectar: ${error.message}`);
  await db().from('ia_pc_turnos').update({ estado: 'vencido' }).eq('dispositivo_id', id).eq('workspace_id', ws).in('estado', ['esperando', 'tomado']);
}

/** Lo que ve «Tus cuentas de IA»: las PC del negocio (el admin, todas; los demás, las suyas), sin ningún secreto. */
export async function listarDispositivos(ws: number, persona: string, esAdmin: boolean): Promise<Array<Dispositivo & { enLinea: boolean; version: string | null; esMia: boolean }>> {
  let q = db().from('ia_pc_dispositivos')
    .select('id, workspace_id, persona, nombre, ultimo_latido, cuentas, version')
    .eq('workspace_id', ws).is('revocado_at', null).order('creado_at', { ascending: false }).limit(20);
  if (!esAdmin) q = q.eq('persona', persona);
  const data = sinError(await q, 'las PC');
  return (data ?? []).map((r) => {
    const d = aDispositivo(r);
    return { ...d, enLinea: enLinea(d.ultimoLatido), version: (r.version as string | null) ?? null, esMia: d.persona === persona };
  });
}

/** ¿Puede esta persona desconectar esa PC? La suya, siempre; la de otro, sólo el admin del negocio. */
export async function puedeDesconectar(ws: number, id: number, persona: string, esAdmin: boolean): Promise<boolean> {
  const data = sinError(await db().from('ia_pc_dispositivos').select('persona').eq('id', id).eq('workspace_id', ws).is('revocado_at', null).maybeSingle(), 'la PC');
  return !!data && (esAdmin || String(data.persona) === persona);
}

// ── Los turnos ───────────────────────────────────────────────────────────────

/** El pedido de un turno. `modelo` es el único valor del comando que viene del servidor: la PC lo pasa por su lista. */
export type PedidoPc = { system: string; prompt: string; tools: ToolDef[]; modelo?: string };

/** El negocio pasó su tope de turnos por minuto (§3, regla 6): el turno no se encola. */
export class TopeDeTurnos extends Error {}

/** Encola un turno para la PC. El token de sus herramientas todavía no existe: se acuña cuando la PC lo toma. */
export async function encolarTurno(d: Dispositivo, sesionId: number, pedido: PedidoPc): Promise<number> {
  const { count, error: e1 } = await db().from('ia_pc_turnos').select('id', { count: 'exact', head: true })
    .eq('workspace_id', d.ws).gt('creado_at', new Date(Date.now() - 60_000).toISOString());
  if (e1) throw new Error(`ia-pc: no pude contar los turnos: ${e1.message}`);
  if ((count ?? 0) >= TOPE_TURNOS_POR_MINUTO) throw new TopeDeTurnos(`el negocio pasó ${TOPE_TURNOS_POR_MINUTO} turnos por minuto`);
  const { data, error } = await db().from('ia_pc_turnos').insert({
    workspace_id: d.ws, dispositivo_id: d.id, sesion_id: sesionId, pedido,
    vence_at: new Date(Date.now() + TURNO_MS).toISOString(),
  }).select('id').single();
  if (error || !data) throw new Error(`ia-pc: no pude encolar el turno: ${error?.message ?? 'sin fila'}`);
  return Number(data.id);
}

/**
 * La PC pide el próximo turno (long-poll). Se toma UNA vez: el update pasa de `esperando` a `tomado` sólo si nadie lo
 * tomó antes, y ahí se acuña el token de sus herramientas, que recibe sólo esta PC. Tira si la base falla (503).
 */
export async function tomarTurno(d: Dispositivo, hastaMs = ESPERA_TURNO_MS): Promise<{ id: number; pedido: PedidoPc; token: string } | null> {
  const fin = Date.now() + hastaMs;
  for (;;) {
    const ahora = new Date().toISOString();
    const prox = sinError(await db().from('ia_pc_turnos').select('id')
      .eq('dispositivo_id', d.id).eq('workspace_id', d.ws).eq('estado', 'esperando').gt('vence_at', ahora)
      .order('creado_at').limit(1).maybeSingle(), 'los turnos');
    if (prox) {
      const token = tokenNuevo(PREFIJO_TOKEN_TURNO);
      const data = sinError(await db().from('ia_pc_turnos')
        .update({ estado: 'tomado', tomado_at: ahora, token_hash: hash(token) })
        .eq('id', prox.id).eq('estado', 'esperando').select('id, pedido').maybeSingle(), 'el turno');
      if (data) return { id: Number(data.id), pedido: data.pedido as PedidoPc, token };
    }
    if (Date.now() + 1000 > fin) return null;
    await esperar(1000);
  }
}

/**
 * La PC contesta un turno SUYO que tomó. Lo de otra PC, de otro negocio o ya cerrado no se toca. Un error con su tipo
 * (`tope`, `sesion`) guarda el tipo y cuándo se repone en `uso`, para que el chat diga lo cierto.
 */
export async function contestarTurno(d: Dispositivo, id: number, cuerpo: unknown): Promise<boolean> {
  const r = sanearRespuesta(cuerpo);
  if (!r || !Number.isInteger(id)) return false;
  const data = sinError(await db().from('ia_pc_turnos')
    .update(r.ok
      ? { estado: 'listo', respuesta: r.texto, cuenta: r.cuenta, uso: r.uso, listo_at: new Date().toISOString() }
      : { estado: 'error', error: r.error, uso: r.tipo ? { tipo: r.tipo, ...(r.repone ? { repone: r.repone } : {}) } : null, listo_at: new Date().toISOString() })
    .eq('id', id).eq('dispositivo_id', d.id).eq('workspace_id', d.ws).eq('estado', 'tomado').select('id').maybeSingle(), 'el turno');
  return !!data;
}

/** El turno de un token de herramientas: sólo mientras está tomado, no venció y su PC sigue conectada. Tira si falla. */
export async function turnoDelToken(token: unknown): Promise<{ id: number; ws: number; tools: ToolDef[]; venceAt: string } | null> {
  if (!tieneFormaDeToken(token, PREFIJO_TOKEN_TURNO)) return null;
  const data = sinError(await db().from('ia_pc_turnos').select('id, workspace_id, dispositivo_id, pedido, vence_at')
    .eq('token_hash', hash(token)).eq('estado', 'tomado').gt('vence_at', new Date().toISOString()).maybeSingle(), 'el turno');
  if (!data) return null;
  // Desconectar la PC corta también este token (desconectar ya vence sus turnos; esto es la red por si eso falló).
  const pc = sinError(await db().from('ia_pc_dispositivos').select('id').eq('id', data.dispositivo_id).is('revocado_at', null).maybeSingle(), 'la PC del turno');
  if (!pc) return null;
  return { id: Number(data.id), ws: Number(data.workspace_id), tools: ((data.pedido as PedidoPc)?.tools ?? []) as ToolDef[], venceAt: String(data.vence_at) };
}

// ── Las herramientas: las pide la PC, las corre el turno que espera ─────────────

/**
 * El MCP deja la llamada y espera a que el turno la corra: mientras el turno siga tomado, hasta `hastaMs` (lo que le
 * queda a la ruta del MCP). Con 60 s fijos, una herramienta que arrancaba tarde se informaba «no se corrió» y se corría
 * igual (revisión del 21/10/2026). null = el turno ya no espera.
 */
export async function pedirLlamada(turnoId: number, nombre: string, entrada: Record<string, unknown>, hastaMs: number): Promise<{ salida: string; esError: boolean } | null> {
  const { data, error } = await db().from('ia_pc_llamadas').insert({ turno_id: turnoId, nombre: nombre.slice(0, 120), entrada }).select('id').single();
  if (error || !data) return null;
  const fin = Date.now() + hastaMs;
  let vueltas = 0;
  while (Date.now() < fin) {
    await esperar(400);
    const { data: l } = await db().from('ia_pc_llamadas').select('estado, salida, es_error').eq('id', data.id).maybeSingle();
    if (l?.estado === 'lista') return { salida: String(l.salida ?? ''), esError: !!l.es_error };
    // Cada ~5 s: si el turno ya no espera (venció, lo desconectaron), no tiene sentido seguir.
    if (++vueltas % 12 === 0) {
      const { data: t, error: et } = await db().from('ia_pc_turnos').select('estado').eq('id', turnoId).maybeSingle();
      if (!et && t?.estado !== 'tomado') break;
    }
  }
  // No se esperó más: si nadie la empezó, se la saca de la fila (así «no se corrió» es cierto); si ya corrió, su salida.
  const { data: sacada } = await db().from('ia_pc_llamadas').update({ estado: 'lista', salida: '(no se esperó)', es_error: true, lista_at: new Date().toISOString() })
    .eq('id', data.id).eq('estado', 'esperando').select('id').maybeSingle();
  if (sacada) return null;
  const { data: l } = await db().from('ia_pc_llamadas').select('estado, salida, es_error').eq('id', data.id).maybeSingle();
  if (l?.estado === 'lista') return { salida: String(l.salida ?? ''), esError: !!l.es_error };
  return { salida: 'Se está corriendo y tarda: no la pidas de nuevo.', esError: true };
}

export type Ejecutor = (nombre: string, entrada: Record<string, unknown>) => Promise<string | { content: string; isError?: boolean }>;

/** Cómo terminó la espera de la PC. `apagada`: no lo tomó a tiempo o dejó de latir (el turno queda vencido). */
export type FinDeLaPc = { texto: string } | { error: string; tipo?: TipoFalloPc; repone?: string } | { apagada: true } | null;

/**
 * El turno que espera a la PC: corre las herramientas que ella pide (con SU `runTool`, el del chat: el gating de la vista,
 * el memo y las tarjetas) y vuelve con la respuesta. null = no volvió a tiempo. Antes de devolver algo que no es la
 * respuesta, el turno queda VENCIDO: lo que la PC conteste después no se muestra.
 *   · si la PC no lo tomó en SIN_TOMAR_MS y no está ocupada con otro turno, se apagó: `{ apagada }` (no 4 minutos);
 *   · si lo tomó y dejó de latir SIN_LATIDO_MS, se apagó a mitad de turno: `{ apagada }`;
 *   · un error de lectura se reintenta dentro del plazo (antes daba «tardó demasiado» al instante y dejaba el turno vivo).
 */
export async function esperarALaPc(turnoId: number, ws: number, dispositivoId: number, ejecutar: Ejecutor, hastaMs: number): Promise<FinDeLaPc> {
  const inicio = Date.now();
  const fin = inicio + hastaMs;
  const vencer = () => db().from('ia_pc_turnos').update({ estado: 'vencido' }).eq('id', turnoId).in('estado', ['esperando', 'tomado']).then(() => undefined, () => undefined);
  let ultimaMirada = 0;
  while (Date.now() < fin) {
    const { data: llamadas } = await db().from('ia_pc_llamadas').select('id, nombre, entrada')
      .eq('turno_id', turnoId).eq('estado', 'esperando').order('id').limit(5);
    for (const l of llamadas ?? []) {
      let salida = '';
      let esError = false;
      try {
        const r = await ejecutar(String(l.nombre), (l.entrada ?? {}) as Record<string, unknown>);
        if (typeof r === 'string') salida = r;
        else { salida = r.content; esError = !!r.isError; }
      } catch (e) {
        salida = e instanceof Error ? e.message : String(e);
        esError = true;
      }
      await db().from('ia_pc_llamadas').update({ estado: 'lista', salida: salida.slice(0, 50_000), es_error: esError, lista_at: new Date().toISOString() })
        .eq('id', l.id).eq('estado', 'esperando');
    }
    const { data: t, error } = await db().from('ia_pc_turnos').select('estado, respuesta, error, uso').eq('id', turnoId).eq('workspace_id', ws).maybeSingle();
    if (!error) {
      if (t?.estado === 'listo') return { texto: String(t.respuesta ?? '') };
      if (t?.estado === 'error') {
        const u = (t.uso ?? {}) as { tipo?: unknown; repone?: unknown };
        const tipo = u.tipo === 'tope' || u.tipo === 'sesion' ? u.tipo : undefined;
        return { error: String(t.error ?? 'error'), ...(tipo ? { tipo } : {}), ...(typeof u.repone === 'string' ? { repone: u.repone } : {}) };
      }
      if (!t || t.estado === 'vencido') return null;
      // ¿Se apagó? Cada ~5 s, mirando si la tomó y si sigue latiendo.
      if (Date.now() - ultimaMirada > 5_000) {
        ultimaMirada = Date.now();
        const { data: pc, error: ep } = await db().from('ia_pc_dispositivos').select('ultimo_latido').eq('id', dispositivoId).maybeSingle();
        const latido = pc?.ultimo_latido ? Date.parse(String(pc.ultimo_latido)) : NaN;
        if (!ep && t.estado === 'tomado' && Number.isFinite(latido) && Date.now() - latido > SIN_LATIDO_MS) { await vencer(); return { apagada: true }; }
        if (!ep && t.estado === 'esperando' && Date.now() - inicio > SIN_TOMAR_MS) {
          const { count, error: eo } = await db().from('ia_pc_turnos').select('id', { count: 'exact', head: true }).eq('dispositivo_id', dispositivoId).eq('estado', 'tomado');
          if (!eo && !count) { await vencer(); return { apagada: true }; }
        }
      }
    }
    if (!llamadas?.length) await esperar(500);
  }
  // No volvió: se da por vencido, así lo que conteste después no se muestra (docs/ia-del-cliente.md §12).
  await vencer();
  return null;
}

// ── La limpieza ──────────────────────────────────────────────────────────────

/**
 * Borra los turnos de más de GUARDA_TURNOS_MS (sus herramientas se van con ellos: `on delete cascade`) y los códigos
 * viejos. Los turnos llevan el system con datos del negocio y lo que leyó la PC (PII de leads): no se guardan para
 * siempre (revisión del 21/10/2026). Lo corre /api/cron/ia-pc-purga, una vez por día. `seco` sólo cuenta.
 */
export async function purgarTurnosViejos(o: { seco?: boolean } = {}): Promise<{ turnos: number; codigos: number }> {
  const corte = new Date(Date.now() - GUARDA_TURNOS_MS).toISOString();
  const turnos = await db().from('ia_pc_turnos').select('id', { count: 'exact', head: true }).lt('creado_at', corte);
  const codigos = await db().from('ia_pc_codigos').select('codigo_hash', { count: 'exact', head: true }).lt('vence_at', corte);
  if (turnos.error) throw new Error(`ia-pc: no pude contar los turnos viejos: ${turnos.error.message}`);
  if (codigos.error) throw new Error(`ia-pc: no pude contar los códigos viejos: ${codigos.error.message}`);
  if (!o.seco) {
    const a = await db().from('ia_pc_turnos').delete().lt('creado_at', corte);
    if (a.error) throw new Error(`ia-pc: no pude borrar los turnos viejos: ${a.error.message}`);
    const b = await db().from('ia_pc_codigos').delete().lt('vence_at', corte);
    if (b.error) throw new Error(`ia-pc: no pude borrar los códigos viejos: ${b.error.message}`);
  }
  return { turnos: turnos.count ?? 0, codigos: codigos.count ?? 0 };
}
