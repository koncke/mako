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
import { getUsuarioActual } from './auth';
import {
  CODIGO_MS, ESPERA_TURNO_MS, LARGO_CODIGO, PREFIJO_TOKEN_PC, PREFIJO_TOKEN_TURNO, SIN_LATIDO_MS, SIN_TOMAR_MS, TURNO_MS,
  codigoDe, elegirPc, enLinea, type PcDeNegocio, normalizarCodigo, sanearCuentas, sanearNombrePc, sanearRespuesta, sistemaDeLaVersion, tieneFormaDeToken, type CuentaPc, type TipoFalloPc,
  cuentasDeLaIA, iaDeLaPcConectada, iaDelConsentimiento, laPersonaEstaAdentro, pcUsable, type ProveedorPc,
} from './ia-pc-reglas';
import type { ToolDef } from './anthropic';
import { elTelefonoEsDeLaPersona, telefonoDeVerdad, type UsuarioDelNegocio } from './ia-pc-grupo-reglas';

const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
const tokenNuevo = (prefijo: string): string => `${prefijo}${randomBytes(32).toString('base64url')}`;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = () => getSupabaseServer();
/** Una lectura que falló TIRA: nunca se confunde con «no hay». */
const sinError = <T>(r: { data: T; error: { message: string } | null }, que: string): T => {
  if (r.error) throw new Error(`ia-pc: no pude leer ${que}: ${r.error.message}`);
  return r.data;
};

/**
 * ¿El error es de ESQUEMA (una columna o una tabla que la base todavía no tiene)? Postgres 42703 / 42P01, o PostgREST
 * con su caché de esquema (PGRST204 / PGRST205). Es lo que pasa si este código llega a producción antes que la mig 0322.
 */
export const esErrorDeEsquema = (e: { code?: string | null; message?: string | null } | null | undefined): boolean =>
  !!e && (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(String(e.code ?? '')) || /does not exist|schema cache/i.test(String(e.message ?? '')));

/** Cuántos turnos por minuto acepta la puerta de UN negocio, entre todas sus PC (§3, regla 6). */
export const TOPE_TURNOS_POR_MINUTO = 20;
/** Cuánto se guardan los turnos y sus herramientas (llevan el system con datos del negocio y lo que leyó la PC). */
export const GUARDA_TURNOS_MS = 24 * 60 * 60_000;

/**
 * Una PC. `confirmado`: la persona dijo que sí a «¿Es tu negocio?»; `activa`: además latió con una cuenta con sesión
 * (sólo las activas prenden D6b); `claudeFalta`: su último latido dijo que no hay Claude Code (mig 0322).
 */
export type Dispositivo = {
  id: number; ws: number; persona: string; nombre: string; ultimoLatido: string | null; cuentas: CuentaPc[];
  confirmado: boolean; activa: boolean; claudeFalta: boolean;
  /** Con qué IA se conectó: la del texto que aceptó quien la conectó (`iaDeLaPcConectada`). Sus `cuentas` son sólo de ésa. */
  ia: ProveedorPc;
};

// ── Emparejar ────────────────────────────────────────────────────────────────

/**
 * Un código para que ESTA persona empareje una PC suya (10 minutos, un uso). `consentimiento` es la versión del texto
 * que aceptó con un toque (TEXTO_CONSENTIMIENTO): sin eso no hay código (mig 0321). Los códigos vivos que ya tenía se
 * anulan: uno solo a la vez.
 */
export async function crearCodigo(ws: number, persona: string, consentimiento: string): Promise<{ codigo: string; venceAt: string }> {
  if (!iaDelConsentimiento(consentimiento)) throw new Error('ia-pc: sin aceptar el texto de hoy no hay código');
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
 *
 * ⚠️ LA PC NACE PENDIENTE (mig 0322; segunda revisión del Cerebro, 21/10/2026): sin `confirmado_at` no recibe turnos, no
 * se lista y no cuenta para D6b. La activaba esto mismo, antes del «sí»: una instalación abandonada en la pregunta dejaba
 * una PC fantasma que pasaba todo el negocio a «sólo su IA». La confirma el programa (`confirmar`, con su token).
 * El nombre del negocio se lee ANTES de gastar el código: sin él, la pregunta de seguridad decía «tu negocio».
 */
export async function emparejar(codigoCrudo: unknown, nombreCrudo: unknown): Promise<{ token: string; ws: number; negocio: string; persona: string } | null> {
  const codigo = normalizarCodigo(codigoCrudo);
  if (!codigo) return null;
  const ahora = new Date().toISOString();
  const vivo = sinError(await db().from('ia_pc_codigos').select('workspace_id')
    .eq('codigo_hash', hash(codigo)).is('usado_at', null).gt('vence_at', ahora).maybeSingle(), 'el código');
  if (!vivo) return null;
  const w = sinError(await db().from('workspaces').select('nombre').eq('id', Number(vivo.workspace_id)).maybeSingle(), 'el negocio');
  const negocio = String((w as { nombre?: unknown } | null)?.nombre ?? '').trim();
  if (!negocio) throw new Error('ia-pc: el negocio del código no tiene nombre');
  const data = sinError(await db().from('ia_pc_codigos')
    .update({ usado_at: ahora })
    .eq('codigo_hash', hash(codigo)).is('usado_at', null).gt('vence_at', ahora)
    .select('workspace_id, persona, consentimiento').maybeSingle(), 'el código');
  if (!data) return null;
  const token = tokenNuevo(PREFIJO_TOKEN_PC);
  const ws = Number(data.workspace_id);
  const persona = String(data.persona);
  const insertada = sinError(await db().from('ia_pc_dispositivos').insert({
    workspace_id: ws, persona, nombre: sanearNombrePc(nombreCrudo), token_hash: hash(token),
    // Lo que aceptó la persona al pedir el código, con la hora en que se conectó la PC (mig 0321).
    consentimiento: (data.consentimiento as string | null) ?? null, consentimiento_at: ahora,
  }).select('id').single(), 'la PC nueva');
  // Qué PC salió de este código (mig 0322): el tutorial sabe si se gastó sin conectar (`estadoDelCodigo`).
  if (insertada) {
    const l = await db().from('ia_pc_codigos').update({ dispositivo_id: Number(insertada.id) }).eq('codigo_hash', hash(codigo));
    // No se corta por esto (la PC ya está creada): el tutorial la ve aparecer igual; sólo el estado del código queda corto.
    if (l.error) console.error(`[ia-pc] ws=${ws}: no pude anotar la PC ${String(insertada.id)} en su código: ${l.error.message}`);
  }
  return { token, ws, negocio, persona };
}

/**
 * La persona dijo que SÍ a «¿Es tu negocio?»: la PC pendiente pasa a confirmada (mig 0322). Con SU token, y sólo una vez.
 * Pasa a ACTIVA (cuenta para D6b) con su primer latido con una cuenta con sesión de SU IA, Claude o ChatGPT (`latir`).
 */
export async function confirmar(d: Dispositivo, anterior?: unknown): Promise<boolean> {
  const data = sinError(await db().from('ia_pc_dispositivos').update({ confirmado_at: new Date().toISOString() })
    .eq('id', d.id).eq('workspace_id', d.ws).is('revocado_at', null).is('confirmado_at', null).select('id').maybeSingle(), 'la PC');
  const ok = !!data || d.confirmado;
  // ⚠️ REINSTALAR (tercera revisión del Cerebro, 21/10/2026): el programa suelta la conexión de antes apenas confirma, y
  // la nueva recién se activa con su primer latido con sesión; en ese hueco el negocio salía de «sólo su IA» (y si la
  // ventana se cerraba o la sesión había vencido, sin plazo). Con el token de la de ANTES (la que el programa va a
  // soltar), si era de la misma persona del mismo negocio y estaba ACTIVA, la activación pasa a la nueva acá mismo.
  if (ok && !d.activa && tieneFormaDeToken(anterior, PREFIJO_TOKEN_PC)) {
    const vieja = sinError(await db().from('ia_pc_dispositivos').select('id, workspace_id, persona, activa_at')
      .eq('token_hash', hash(anterior)).is('revocado_at', null).maybeSingle(), 'la PC de antes');
    if (vieja && Number(vieja.id) !== d.id && Number(vieja.workspace_id) === d.ws && String(vieja.persona) === d.persona && vieja.activa_at != null) {
      sinError(await db().from('ia_pc_dispositivos').update({ activa_at: new Date().toISOString() })
        .eq('id', d.id).eq('workspace_id', d.ws).is('activa_at', null).select('id').maybeSingle(), 'la PC nueva');
    }
  }
  return ok;
}

/** Cómo quedó un código, para el tutorial (lo pide quien lo pidió): si se gastó sin conectar, que pida otro. */
export type EstadoDelCodigo = 'vivo' | 'vencido' | 'eligiendo' | 'conectado' | 'cancelado';
/** Una pendiente que no se confirmó en este tiempo se abandonó (la persona cerró la ventana en la pregunta). */
export const PENDIENTE_MS = 15 * 60_000;
/** Lo que puede tardar emparejar entre gastar el código y anotarle su PC. */
const SIN_ANOTAR_MS = 60_000;

export async function estadoDelCodigo(ws: number, persona: string, codigoCrudo: unknown): Promise<EstadoDelCodigo> {
  const codigo = normalizarCodigo(codigoCrudo);
  if (!codigo) return 'vencido';
  const c = sinError(await db().from('ia_pc_codigos').select('usado_at, vence_at, dispositivo_id')
    .eq('codigo_hash', hash(codigo)).eq('workspace_id', ws).eq('persona', persona).maybeSingle(), 'el código');
  if (!c) return 'vencido';
  if (!c.usado_at) return Date.parse(String(c.vence_at)) > Date.now() ? 'vivo' : 'vencido';
  // Recién usado sin la PC anotada todavía: emparejar gasta el código, crea la PC y DESPUÉS la anota (dos viajes). Si el
  // tutorial pregunta en ese medio, la ventana está preguntando «¿Es tu negocio?»: no es «se usó sin conectar».
  if (c.dispositivo_id == null) return Date.now() - Date.parse(String(c.usado_at)) > SIN_ANOTAR_MS ? 'cancelado' : 'eligiendo';
  const pc = sinError(await db().from('ia_pc_dispositivos').select('revocado_at, confirmado_at').eq('id', Number(c.dispositivo_id)).maybeSingle(), 'la PC del código');
  if (!pc || pc.revocado_at) return 'cancelado';
  if (pc.confirmado_at) return 'conectado';
  return Date.now() - Date.parse(String(c.usado_at)) > PENDIENTE_MS ? 'cancelado' : 'eligiendo';
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

const COLUMNAS_PC = 'id, workspace_id, persona, nombre, ultimo_latido, cuentas, confirmado_at, activa_at, claude_falta, consentimiento';
/**
 * Una PC conectada con el texto de Claude no contesta con ChatGPT aunque su programa lo reporte (ni al revés): sólo cuentan
 * las cuentas de la IA que aceptó quien la conectó. Lo mismo al guardar el latido (`latir`), que es lo que la activa.
 */
const aDispositivo = (r: Record<string, unknown>): Dispositivo => {
  const ia = iaDeLaPcConectada(r.consentimiento);
  return {
    id: Number(r.id), ws: Number(r.workspace_id), persona: String(r.persona), nombre: String(r.nombre),
    ultimoLatido: (r.ultimo_latido as string | null) ?? null, cuentas: cuentasDeLaIA(sanearCuentas(r.cuentas), ia),
    confirmado: r.confirmado_at != null, activa: r.activa_at != null, claudeFalta: r.claude_falta === true, ia,
  };
};

/**
 * La PC de un token, o null si no existe, la desconectaron, o todavía no se confirmó (salvo `pendientesTambien`: lo que
 * la PC puede hacer antes del «sí» es confirmarse o soltarse). El NEGOCIO sale de acá, nunca de lo que diga el pedido
 * (regla 1). Si la base falla TIRA: la ruta contesta 503 y la PC reintenta (null es 401 `revocado`, y el programa se apaga).
 */
export async function dispositivoDelToken(token: unknown, o: { pendientesTambien?: boolean } = {}): Promise<Dispositivo | null> {
  if (!tieneFormaDeToken(token, PREFIJO_TOKEN_PC)) return null;
  const data = sinError(await db().from('ia_pc_dispositivos')
    .select(COLUMNAS_PC).eq('token_hash', hash(token)).is('revocado_at', null).maybeSingle(), 'la PC');
  if (!data) return null;
  const d = aDispositivo(data);
  return d.confirmado || o.pendientesTambien ? d : null;
}

/**
 * El latido: la PC está prendida, con sus cuentas. El primero de una PC confirmada que trae una cuenta con sesión la
 * ACTIVA (mig 0322): recién ahí cuenta para D6b. `sinClaude`: en esa PC no hay Claude Code.
 */
export async function latir(d: Dispositivo, cuerpo: unknown, extra: { ubicacion?: string | null } = {}): Promise<void> {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : {};
  const version = typeof o.version === 'string' ? o.version.replace(/[^\w.\-+]/g, '').slice(0, 40) : null;
  // Sólo las de SU IA (`aDispositivo`): una cuenta de otra IA no se guarda, no se ofrece y no activa la PC para D6b.
  const cuentas = cuentasDeLaIA(sanearCuentas(o.cuentas), d.ia);
  const ahora = new Date().toISOString();
  const fila = { ultimo_latido: ahora, version, cuentas, claude_falta: o.sinClaude === true && !cuentas.length };
  // La ubicación (sólo «ciudad, provincia, país»: textoDeUbicacion), si se supo; si no, queda la última. Sin la mig 0327, el
  // latido igual se anota.
  const conUbicacion = extra.ubicacion ? { ...fila, ubicacion: extra.ubicacion } : fila;
  let { error } = await db().from('ia_pc_dispositivos').update(conUbicacion).eq('id', d.id).eq('workspace_id', d.ws);
  if (error && conUbicacion !== fila) {
    // Sin la mig 0327, o un texto que la base no acepta: el latido igual se anota, sin la ubicación (revisión de privacidad).
    console.error(`[ia-pc] ⚠️ el latido no aceptó la ubicación${esErrorDeEsquema(error) ? ' (FALTA LA MIG 0327)' : ''}: ${error.message}`);
    ({ error } = await db().from('ia_pc_dispositivos').update(fila).eq('id', d.id).eq('workspace_id', d.ws));
  }
  if (error) throw new Error(`ia-pc: no pude anotar el latido: ${error.message}`);
  if (!d.activa && d.confirmado && cuentas.length) {
    const a = await db().from('ia_pc_dispositivos').update({ activa_at: ahora }).eq('id', d.id).eq('workspace_id', d.ws).is('activa_at', null);
    if (a.error) throw new Error(`ia-pc: no pude activar la PC: ${a.error.message}`);
  }
}

/** La PC suelta su propia conexión (al reemplazarla por otra, o si la persona dijo que no era su negocio). */
export async function soltar(d: Dispositivo): Promise<void> {
  await desconectar(d.ws, d.id);
}

/**
 * La PC de ESTA persona en este negocio (la más reciente confirmada que no se desconectó), con si está en línea. Una
 * pendiente no es de nadie todavía. Tira si falla.
 */
export async function pcDe(ws: number, persona: string, proveedor: ProveedorPc = 'claude'): Promise<(Dispositivo & { enLinea: boolean }) | null> {
  // VARIAS COMPUTADORAS (22/10/2026): todas las de la persona, y el turno va a la que elige `elegirPc` (lib/ia-pc-reglas.ts).
  const r = await db().from('ia_pc_dispositivos')
    .select(`${COLUMNAS_PC}, creado_at`)
    .eq('workspace_id', ws).eq('persona', persona).is('revocado_at', null).not('confirmado_at', 'is', null)
    .order('ultimo_latido', { ascending: false, nullsFirst: false }).limit(10);
  // Sin la mig 0322 ninguna PC puede estar confirmada: «sin PC», dicho fuerte en el log (ver `negocioConPc`).
  if (esErrorDeEsquema(r.error)) { console.error(`[ia-pc] ⚠️ FALTA LA MIG 0322: ${r.error?.message}`); return null; }
  const filas = sinError(r, 'las PC de la persona') ?? [];
  const pcs = filas.map((f) => { const d = aDispositivo(f); return { ...d, enLinea: enLinea(d.ultimoLatido), conectadaAt: (f.creado_at as string | null) ?? null }; });
  // El último turno TERMINADO de cada una (bien, con error o vencido), sólo si hay más de una que conteste (si no, no hace
  // falta preguntar). Con sólo los contestados bien, una que falla seguía siendo «la del último turno» (revisión adversarial).
  const ultimoTurno = new Map<number, { at: string; ok: boolean }>();
  if (pcs.filter((p) => pcUsable(p, proveedor)).length > 1) {
    const t = await db().from('ia_pc_turnos').select('dispositivo_id, estado, creado_at')
      .eq('workspace_id', ws).in('dispositivo_id', pcs.map((p) => p.id)).in('estado', ['listo', 'error', 'vencido'])
      .order('creado_at', { ascending: false }).limit(50);
    for (const f of (t.data ?? []) as Array<{ dispositivo_id: number; estado: string; creado_at: string }>) {
      if (!ultimoTurno.has(Number(f.dispositivo_id))) ultimoTurno.set(Number(f.dispositivo_id), { at: f.creado_at, ok: f.estado === 'listo' });
    }
  }
  // Por IA (la ola 3): con su ChatGPT elegido, sólo una PC con una cuenta de ChatGPT contesta.
  const elegida = elegirPc(pcs, ultimoTurno, proveedor);
  if (!elegida) return null;
  const { conectadaAt: _c, ...d } = elegida;
  return d;
}

/**
 * ¿El NEGOCIO tiene alguna PC ACTIVA (de cualquier persona, en línea o no)? D6b se decide por negocio (revisión del
 * 21/10/2026): el turno de un closer de un negocio que conectó su Claude tampoco va a Gemini. Sólo las ACTIVAS (mig 0322:
 * confirmadas y con un latido con sesión): una pendiente abandonada, o una que nunca tuvo Claude, no le saca la IA a nadie.
 * Tira si falla.
 *
 * ⚠️ SI LA BASE NO TIENE LA MIG 0322 (este código desplegado antes que ella): la columna `activa_at` no existe, y tirar
 * acá pasaba a «sólo su IA» —por la falla cerrada— a TODOS los negocios sin clave propia, que se quedaban sin ninguna IA
 * (tercera revisión del Cerebro, 21/10/2026). Un error de ESQUEMA (y sólo ése) se loguea fuerte y se contesta con lo que
 * se puede saber sin la columna: un negocio sin ninguna PC registrada no tiene PC («no»); uno con alguna, falla cerrada
 * («sí»). Cualquier otro error sigue tirando.
 */
export async function negocioConPc(ws: number): Promise<boolean> {
  const r = await db().from('ia_pc_dispositivos').select('id')
    .eq('workspace_id', ws).is('revocado_at', null).not('activa_at', 'is', null).limit(1);
  if (esErrorDeEsquema(r.error)) {
    console.error(`[ia-pc] ⚠️ FALTA LA MIG 0322 (ws=${ws}): ${r.error?.message}. Sin PC registrada: sin PC; con alguna: falla cerrada.`);
    const algunas = sinError(await db().from('ia_pc_dispositivos').select('id').eq('workspace_id', ws).is('revocado_at', null).limit(1), 'las PC del negocio (sin la 0322)');
    return (algunas ?? []).length > 0;
  }
  const data = sinError(r, 'las PC del negocio');
  return (data ?? []).length > 0;
}

/** Desconecta una PC: su token deja de servir, y el turno que tenía en curso también (sus herramientas no corren más). */
export async function desconectar(ws: number, id: number): Promise<void> {
  // Y se borra lo personal que guardó (revisión de privacidad, 23/10/2026): la fila queda para siempre, revocada, y su última
  // ubicación y los emails de sus cuentas no tienen por qué quedar con ella. Sin la mig 0327, sin la ubicación.
  const fila = { revocado_at: new Date().toISOString(), cuentas: [] };
  const desconectarCon = (cambios: Record<string, unknown>) => db().from('ia_pc_dispositivos').update(cambios).eq('id', id).eq('workspace_id', ws).is('revocado_at', null);
  let { error } = await desconectarCon({ ...fila, ubicacion: null });
  if (error && esErrorDeEsquema(error)) ({ error } = await desconectarCon(fila));
  if (error) throw new Error(`ia-pc: no pude desconectar: ${error.message}`);
  // Si vencer sus turnos falla, se dice (antes contestaba ok igual); las herramientas igual miran la revocación.
  const t = await db().from('ia_pc_turnos').update({ estado: 'vencido' }).eq('dispositivo_id', id).eq('workspace_id', ws).in('estado', ['esperando', 'tomado']);
  if (t.error) throw new Error(`ia-pc: la desconecté, pero no pude cortar su turno: ${t.error.message}`);
}

/** ¿Esta PC sigue conectada? Si la base falla, «no» (falla cerrada: una herramienta de más es peor que una de menos). */
async function sigueConectada(dispositivoId: number): Promise<boolean> {
  const { data, error } = await db().from('ia_pc_dispositivos').select('revocado_at').eq('id', dispositivoId).maybeSingle();
  return !error && !!data && !data.revocado_at;
}

/**
 * Lo que ve «Tus cuentas de IA»: las PC CONFIRMADAS del negocio (el admin, todas; los demás, las suyas), sin ningún
 * secreto. Una confirmada que todavía no latió se muestra («Esperando que se conecte»): tiene el arranque puesto y late
 * en el próximo inicio de sesión (antes se escondía a los 15 minutos y la purga la revocaba: tercera revisión).
 */
export async function listarDispositivos(ws: number, persona: string, esAdmin: boolean): Promise<Array<Dispositivo & { enLinea: boolean; version: string | null; esMia: boolean; conectadaAt: string | null; sistema: 'Windows' | 'Mac' | null; ubicacion: string | null }>> {
  const leer = (columnas: string) => {
    let q = db().from('ia_pc_dispositivos')
      .select(columnas)
      .eq('workspace_id', ws).is('revocado_at', null).not('confirmado_at', 'is', null).order('creado_at', { ascending: false }).limit(20);
    if (!esAdmin) q = q.eq('persona', persona);
    return q;
  };
  // Con la ubicación (mig 0327); sin la migración, sin ella (null), y la tarjeta igual sale.
  let r = await leer(`${COLUMNAS_PC}, version, creado_at, ubicacion`);
  if (esErrorDeEsquema(r.error)) { console.error(`[ia-pc] ⚠️ FALTA LA MIG 0327 (la ubicación): ${r.error?.message}`); r = await leer(`${COLUMNAS_PC}, version, creado_at`); }
  const data = sinError(r as { data: Array<Record<string, unknown>> | null; error: { message: string } | null }, 'las PC');
  return (data ?? [])
    .map((r) => {
      const d = aDispositivo(r);
      const version = (r.version as string | null) ?? null;
      return { ...d, enLinea: enLinea(d.ultimoLatido), version, esMia: d.persona === persona, conectadaAt: (r.creado_at as string | null) ?? null, sistema: sistemaDeLaVersion(version), ubicacion: (r.ubicacion as string | null) ?? null };
    });
}

/**
 * Las PC conectadas de UN negocio, para el super admin: la ficha de ese cliente (Clientes → su ficha → Equipo). Sin ningún
 * secreto: la persona, el nombre, el sistema, si está en línea, cuándo se conectó y cuándo latió. Quien llama mira que sea el
 * super admin. Tira si falla.
 * ⚠️ DE UN NEGOCIO, NUNCA DE TODOS (23/10/2026). El 22/10 Martín pidió las de todos en SuperAdmin › Uso («Lo mismo en
 *    SuperAdmin»), y al verlas en producción: «en mi SuperAdmin me aparece conectada la computadora de Mauricio, eso esta muy
 *    mal, no tiene nada que ver, estas cruzando workspace». La pantalla se llama «Tus cuentas de IA»: la máquina de un cliente
 *    ahí se lee como suya. Lo de un cliente va en la ficha de ese cliente, y no queda una lectura de todos que otra pantalla
 *    pueda volver a dibujar (docs/hallazgos-operaciones.md, «Las computadoras de los clientes…»).
 */
export async function listarPcDelNegocio(ws: number): Promise<PcDeNegocio[]> {
  const leer = (columnas: string) => db().from('ia_pc_dispositivos')
    .select(columnas)
    .eq('workspace_id', ws).is('revocado_at', null).not('confirmado_at', 'is', null).order('creado_at', { ascending: false }).limit(50);
  // Con la ubicación (mig 0327); sin la migración, sin ella.
  let r = await leer('id, workspace_id, persona, nombre, ultimo_latido, cuentas, version, creado_at, ubicacion');
  if (esErrorDeEsquema(r.error)) r = await leer('id, workspace_id, persona, nombre, ultimo_latido, cuentas, version, creado_at');
  const data = sinError(r as { data: Array<Record<string, unknown>> | null; error: { message: string } | null }, 'las PC del negocio') ?? [];
  const nombres = new Map<number, string>();
  if (data.length) {
    const w = sinError(await db().from('workspaces').select('id, nombre').eq('id', ws), 'el negocio') ?? [];
    for (const f of w) nombres.set(Number(f.id), String(f.nombre ?? '').trim() || `Negocio ${f.id}`);
  }
  return data.map((f) => ({
    id: Number(f.id), ws: Number(f.workspace_id), negocio: nombres.get(Number(f.workspace_id)) ?? `Negocio ${f.workspace_id}`,
    persona: String(f.persona), nombre: String(f.nombre), sistema: sistemaDeLaVersion((f.version as string | null) ?? null),
    enLinea: enLinea((f.ultimo_latido as string | null) ?? null), conClaude: sanearCuentas(f.cuentas).length > 0,
    conectadaAt: (f.creado_at as string | null) ?? null, ultimoLatido: (f.ultimo_latido as string | null) ?? null,
    cuentas: sanearCuentas(f.cuentas), ubicacion: (f.ubicacion as string | null) ?? null, version: (f.version as string | null) ?? null,
  }));
}

/** ¿Puede esta persona desconectar esa PC? La suya, siempre; la de otro, sólo el admin del negocio. */
export async function puedeDesconectar(ws: number, id: number, persona: string, esAdmin: boolean): Promise<boolean> {
  const data = sinError(await db().from('ia_pc_dispositivos').select('persona').eq('id', id).eq('workspace_id', ws).is('revocado_at', null).maybeSingle(), 'la PC');
  return !!data && (esAdmin || String(data.persona) === persona);
}

// ── Los turnos ───────────────────────────────────────────────────────────────

/**
 * El pedido de un turno. `modelo` es el único valor del comando que viene del servidor: la PC lo pasa por su lista.
 * `proveedor` (la ola 3): con qué IA lo corre la PC. Sin él, Claude, que es lo único que conoce el programa hasta la 0.4.2.
 */
export type PedidoPc = { system: string; prompt: string; tools: ToolDef[]; modelo?: string; proveedor?: ProveedorPc };

/** El negocio pasó su tope de turnos por minuto (§3, regla 6): el turno no se encola. */
export class TopeDeTurnos extends Error {}
/** No hay la sesión de quien conectó esa PC en ESTE pedido: el turno no se encola (D6a, `encolarTurno`). */
export class SinLaPersona extends Error {}

/**
 * ¿Quien escribe en el grupo (su teléfono) es la persona que conectó esta PC? Las personas del negocio de la PC, con su teléfono
 * del perfil; la regla, en lib/ia-pc-grupo-reglas.ts. Falla cerrada: si la base no contesta, no.
 */
async function esLaPersonaDelGrupo(d: Dispositivo, telefono: string): Promise<boolean> {
  if (!telefonoDeVerdad(telefono)) return false;
  const usuarios = await usuariosConTelefono(d.ws);
  return !!usuarios && elTelefonoEsDeLaPersona(telefono, usuarios, d.persona);
}

/** Las personas de un negocio con el teléfono de su perfil (lo que mira la puerta del grupo). null si la base no contesta. */
async function usuariosConTelefono(ws: number): Promise<UsuarioDelNegocio[] | null> {
  const { data, error } = await db().from('usuarios').select('id, email, nombre, estado, perfil').eq('workspace_id', ws).limit(500);
  if (error || !data) return null;
  return data.map((u) => ({
    id: u.id, email: u.email as string | null, nombre: u.nombre as string | null, estado: u.estado as string | null,
    telefono: ((u.perfil as { telefono?: string } | null)?.telefono) ?? null,
  }));
}

/**
 * ¿La puerta del grupo reconocería a esta persona por su teléfono? (25/10/2026, «MaKo en WhatsApp»: sin el teléfono en su perfil,
 * su grupo nunca contesta con su computadora y nadie se entera). Su propio teléfono del perfil, contra la MISMA regla de la
 * puerta: falta, no es un teléfono, o lo comparte con otra persona del equipo → false. null si no se pudo leer.
 */
export async function telefonoListoParaElGrupo(ws: number, persona: string): Promise<boolean | null> {
  const usuarios = await usuariosConTelefono(ws);
  if (!usuarios) return null;
  const yo = usuarios.find((u) => (u.email ?? '').toLowerCase() === persona.toLowerCase());
  return !!yo && elTelefonoEsDeLaPersona(yo.telefono, usuarios, persona);
}

/**
 * Encola un turno para la PC. El token de sus herramientas todavía no existe: se acuña cuando la PC lo toma. `esperaMs`: lo que
 * el chat lo va a esperar; después ya no se puede tomar. Lo llama SÓLO `turnoApp` (tests/ia-pc-nunca-a-leads.test.ts) y, con
 * `delGrupo`, el doer del grupo del dueño (lo suma «MaKo en WhatsApp», tanda 4 de docs/conexiones-y-ayuda.md).
 *
 * ⚠️ LA PUERTA MIRA LA SESIÓN (D6a; con ChatGPT, igual: Martín, 23/10/2026). No le cree a quien la llama: lee la cookie de
 * ESTE pedido, y tiene que ser la de quien conectó esa PC (`laPersonaEstaAdentro` contra `d.persona`). La primera versión de
 * la guarda la miraba sólo en `turnoApp`, y la refutación mostró que un alias, un envoltorio o un `?? pcDe(...)` la salteaban
 * sin que fallara un test: acá no hay forma de llegar sin la persona. Un cron o un webhook no tienen la cookie. Un `after()`
 * dentro de la ruta de la persona SÍ la tiene (Next la conserva): es la continuación de lo que ella pidió, y nada que corra
 * solo hacia un lead va ahí. `pruebaSinSesion`: sólo la PC de prueba del ws3.
 *
 * `delGrupo` (25/10/2026, el grupo de WhatsApp del DUEÑO a su computadora: docs/conexiones-y-ayuda.md, decisión 2): el doer
 * corre sin cookie, así que la prueba es otra y la hace esta puerta, no quien llama. El teléfono de quien escribe (el que manda
 * WhatsApp) tiene que ser de UNA sola persona activa del negocio de la PC, y ésa tiene que ser `d.persona`
 * (lib/ia-pc-grupo-reglas.ts). Con la base caída, no encola. Sin `delGrupo`, la cookie, como siempre.
 */
export async function encolarTurno(
  d: Dispositivo, sesionId: number, pedido: PedidoPc, esperaMs = TURNO_MS,
  // `email`: el grupo de la APP (3/11/2026). No hay teléfono que mirar: la persona salió de la SESIÓN (`participant`, lib/grupo-reglas.ts), y la puerta mira que sea quien conectó la PC.
  o: { pruebaSinSesion?: boolean; delGrupo?: { telefono: string } | { email: string } } = {},
): Promise<number> {
  if (o.delGrupo && 'email' in o.delGrupo) {
    if (o.delGrupo.email.trim().toLowerCase() !== String(d.persona ?? '').trim().toLowerCase()) {
      throw new SinLaPersona('ia-pc: quien escribe en el grupo de la app no es quien conectó esta PC, el turno no se encola');
    }
  } else if (o.delGrupo) {
    if (!(await esLaPersonaDelGrupo(d, o.delGrupo.telefono))) {
      throw new SinLaPersona('ia-pc: quien escribe en el grupo no es quien conectó esta PC, el turno no se encola');
    }
  } else {
    // Fuera de un pedido (un cron, un script) `cookies()` tira: es null, y no encola.
    const sesion = await getUsuarioActual().catch(() => null);
    if (!laPersonaEstaAdentro(sesion, { ws: d.ws, actor: d.persona }, o.pruebaSinSesion === true)) {
      throw new SinLaPersona('ia-pc: sin la sesión de quien conectó esta PC, el turno no se encola');
    }
  }
  const { count, error: e1 } = await db().from('ia_pc_turnos').select('id', { count: 'exact', head: true })
    .eq('workspace_id', d.ws).gt('creado_at', new Date(Date.now() - 60_000).toISOString());
  if (e1) throw new Error(`ia-pc: no pude contar los turnos: ${e1.message}`);
  if ((count ?? 0) >= TOPE_TURNOS_POR_MINUTO) throw new TopeDeTurnos(`el negocio pasó ${TOPE_TURNOS_POR_MINUTO} turnos por minuto`);
  const { data, error } = await db().from('ia_pc_turnos').insert({
    workspace_id: d.ws, dispositivo_id: d.id, sesion_id: sesionId, pedido,
    // Vence cuando el chat deja de esperarlo (`esperaMs`), nunca más tarde que TURNO_MS: un turno huérfano no se toma.
    vence_at: new Date(Date.now() + Math.max(0, Math.min(esperaMs, TURNO_MS))).toISOString(),
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
      if (data) {
        // La espera usa la PC leída al empezar: si la desconectaron en el medio, el turno no se le da (revisión adversarial).
        if (!(await sigueConectada(d.id))) {
          await db().from('ia_pc_turnos').update({ estado: 'vencido' }).eq('id', data.id).eq('estado', 'tomado');
          return null;
        }
        return { id: Number(data.id), pedido: data.pedido as PedidoPc, token };
      }
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
 * igual (revisión del 21/10/2026). null = el turno ya no espera. Si al no esperar más la herramienta está CORRIENDO (mig
 * 0322), no se la saca de la fila: se dice que se está corriendo.
 */
export async function pedirLlamada(turnoId: number, nombre: string, entrada: Record<string, unknown>, hastaMs: number): Promise<{ salida: string; esError: boolean } | null> {
  // Un turno que ya no está tomado (lo desconectaron, venció) no recibe llamadas nuevas.
  const { data: vivo, error: ev } = await db().from('ia_pc_turnos').select('estado, dispositivo_id').eq('id', turnoId).maybeSingle();
  if (ev || vivo?.estado !== 'tomado') return null;
  // Ni de una PC desconectada (aunque vencer su turno haya fallado).
  if (!(await sigueConectada(Number(vivo.dispositivo_id)))) return null;
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
  // No se esperó más: si nadie la empezó, se la saca de la fila (así «no se corrió» es cierto); si ya corrió, su salida;
  // si se está corriendo, eso.
  const { data: sacada } = await db().from('ia_pc_llamadas').update({ estado: 'lista', salida: '(no se esperó)', es_error: true, lista_at: new Date().toISOString() })
    .eq('id', data.id).eq('estado', 'esperando').select('id').maybeSingle();
  if (sacada) return null;
  const { data: l } = await db().from('ia_pc_llamadas').select('estado, salida, es_error').eq('id', data.id).maybeSingle();
  if (l?.estado === 'lista') return { salida: String(l.salida ?? ''), esError: !!l.es_error };
  return { salida: 'Se está corriendo y tarda: no la pidas de nuevo.', esError: true };
}

export type Ejecutor = (nombre: string, entrada: Record<string, unknown>) => Promise<string | { content: string; isError?: boolean }>;

/**
 * Cómo terminó la espera de la PC. `apagada`: no lo tomó a tiempo o dejó de latir (el turno queda vencido);
 * `desconectada`: la desconectaron a mitad del turno.
 */
export type FinDeLaPc = { texto: string } | { error: string; tipo?: TipoFalloPc; repone?: string } | { apagada: true } | { desconectada: true } | null;

/**
 * El turno que espera a la PC: corre las herramientas que ella pide (con SU `runTool`, el del chat: el gating de la vista,
 * el memo y las tarjetas) y vuelve con la respuesta. null = no volvió a tiempo. Antes de devolver algo que no es la
 * respuesta, el turno queda VENCIDO: lo que la PC conteste después no se muestra.
 *   · cada herramienta se TOMA antes de correrla (esperando → corriendo, mig 0322) y sólo con el turno todavía tomado:
 *     desconectar la PC a mitad de turno ya no deja correr la que estaba en la fila;
 *   · si la PC no lo tomó en SIN_TOMAR_MS, no está ocupada con otro turno y no latió en ese tiempo, se apagó: `apagada`
 *     (una PC prendida late cada 30 s: el hueco entre contestar un turno y tomar el siguiente no la da por apagada);
 *   · si lo tomó y dejó de latir SIN_LATIDO_MS, se apagó a mitad de turno: `apagada`;
 *   · un error de lectura se reintenta dentro del plazo (antes daba «tardó demasiado» al instante y dejaba el turno vivo).
 */
export async function esperarALaPc(turnoId: number, ws: number, dispositivoId: number, ejecutar: Ejecutor, hastaMs: number): Promise<FinDeLaPc> {
  const inicio = Date.now();
  const fin = inicio + hastaMs;
  const vencer = () => db().from('ia_pc_turnos').update({ estado: 'vencido' }).eq('id', turnoId).in('estado', ['esperando', 'tomado']).then(() => undefined, () => undefined);
  const turnoTomado = async () => {
    const { data, error } = await db().from('ia_pc_turnos').select('estado').eq('id', turnoId).maybeSingle();
    return !error && data?.estado === 'tomado' && (await sigueConectada(dispositivoId));
  };
  let ultimaMirada = 0;
  while (Date.now() < fin) {
    const { data: llamadas } = await db().from('ia_pc_llamadas').select('id, nombre, entrada')
      .eq('turno_id', turnoId).eq('estado', 'esperando').order('id').limit(5);
    for (const l of llamadas ?? []) {
      // Se toma ANTES de correrla: si el MCP ya la dio por no esperada, no corre; y si el turno se cortó, tampoco.
      const { data: tomada } = await db().from('ia_pc_llamadas').update({ estado: 'corriendo' }).eq('id', l.id).eq('estado', 'esperando').select('id').maybeSingle();
      if (!tomada) continue;
      let salida = '';
      let esError = false;
      if (!(await turnoTomado())) {
        salida = 'El turno se cortó: no se corrió.';
        esError = true;
      } else {
        try {
          const r = await ejecutar(String(l.nombre), (l.entrada ?? {}) as Record<string, unknown>);
          if (typeof r === 'string') salida = r;
          else { salida = r.content; esError = !!r.isError; }
        } catch (e) {
          salida = e instanceof Error ? e.message : String(e);
          esError = true;
        }
      }
      await db().from('ia_pc_llamadas').update({ estado: 'lista', salida: salida.slice(0, 50_000), es_error: esError, lista_at: new Date().toISOString() })
        .eq('id', l.id).eq('estado', 'corriendo');
    }
    const { data: t, error } = await db().from('ia_pc_turnos').select('estado, respuesta, error, uso').eq('id', turnoId).eq('workspace_id', ws).maybeSingle();
    if (!error) {
      if (t?.estado === 'listo') return { texto: String(t.respuesta ?? '') };
      if (t?.estado === 'error') {
        const u = (t.uso ?? {}) as { tipo?: unknown; repone?: unknown };
        const tipo = u.tipo === 'tope' || u.tipo === 'sesion' ? u.tipo : undefined;
        return { error: String(t.error ?? 'error'), ...(tipo ? { tipo } : {}), ...(typeof u.repone === 'string' ? { repone: u.repone } : {}) };
      }
      if (!t) return null;
      if (t.estado === 'vencido') {
        // Si la venció «Desconectar», eso es lo que pasó (no «tardó demasiado»).
        const { data: pc } = await db().from('ia_pc_dispositivos').select('revocado_at').eq('id', dispositivoId).maybeSingle();
        return pc?.revocado_at ? { desconectada: true } : null;
      }
      // ¿Se apagó? Cada ~5 s, mirando si la tomó y si sigue latiendo.
      if (Date.now() - ultimaMirada > 5_000) {
        ultimaMirada = Date.now();
        const { data: pc, error: ep } = await db().from('ia_pc_dispositivos').select('ultimo_latido').eq('id', dispositivoId).maybeSingle();
        const latido = pc?.ultimo_latido ? Date.parse(String(pc.ultimo_latido)) : NaN;
        const sinLatir = (ms: number) => Number.isFinite(latido) && Date.now() - latido > ms;
        if (!ep && t.estado === 'tomado' && sinLatir(SIN_LATIDO_MS)) { await vencer(); return { apagada: true }; }
        if (!ep && t.estado === 'esperando' && Date.now() - inicio > SIN_TOMAR_MS && sinLatir(SIN_TOMAR_MS)) {
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
 * siempre (revisión del 21/10/2026). Y revoca las PC abandonadas (mig 0322): las PENDIENTES (nunca dijeron que sí)
 * pasado PENDIENTE_MS. Una CONFIRMADA no, aunque no haya latido: tiene el arranque puesto y late en el próximo inicio de
 * sesión, y no prende D6b sin latir (tercera revisión: la purga de las 03:40 la daba de baja para siempre). Lo corre
 * /api/cron/ia-pc-purga, una vez por día. `seco` sólo cuenta.
 */
export async function purgarTurnosViejos(o: { seco?: boolean } = {}): Promise<{ turnos: number; codigos: number; abandonadas: number }> {
  const corte = new Date(Date.now() - GUARDA_TURNOS_MS).toISOString();
  const corteAbandonadas = new Date(Date.now() - PENDIENTE_MS).toISOString();
  const turnos = await db().from('ia_pc_turnos').select('id', { count: 'exact', head: true }).lt('creado_at', corte);
  const codigos = await db().from('ia_pc_codigos').select('codigo_hash', { count: 'exact', head: true }).lt('vence_at', corte);
  const abandonadas = await db().from('ia_pc_dispositivos').select('id', { count: 'exact', head: true })
    .is('revocado_at', null).is('confirmado_at', null).lt('creado_at', corteAbandonadas);
  if (turnos.error) throw new Error(`ia-pc: no pude contar los turnos viejos: ${turnos.error.message}`);
  if (codigos.error) throw new Error(`ia-pc: no pude contar los códigos viejos: ${codigos.error.message}`);
  if (abandonadas.error) throw new Error(`ia-pc: no pude contar las PC abandonadas: ${abandonadas.error.message}`);
  if (!o.seco) {
    const a = await db().from('ia_pc_turnos').delete().lt('creado_at', corte);
    if (a.error) throw new Error(`ia-pc: no pude borrar los turnos viejos: ${a.error.message}`);
    const b = await db().from('ia_pc_codigos').delete().lt('vence_at', corte);
    if (b.error) throw new Error(`ia-pc: no pude borrar los códigos viejos: ${b.error.message}`);
    const c = await db().from('ia_pc_dispositivos').update({ revocado_at: new Date().toISOString() })
      .is('revocado_at', null).is('confirmado_at', null).lt('creado_at', corteAbandonadas);
    if (c.error) throw new Error(`ia-pc: no pude revocar las PC abandonadas: ${c.error.message}`);
  }
  return { turnos: turnos.count ?? 0, codigos: codigos.count ?? 0, abandonadas: abandonadas.count ?? 0 };
}
