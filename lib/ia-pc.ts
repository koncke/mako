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
//   5. lo que contesta la PC pasa por las mismas guardas que lo que contesta un modelo (en lib/mako-turno-app.ts).
// Nunca guarda un secreto en claro: los tokens y el código, sólo su sha256.
// =============================================================================

import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import {
  CODIGO_MS, ESPERA_TURNO_MS, PREFIJO_TOKEN_PC, PREFIJO_TOKEN_TURNO, TURNO_MS, VERSION_CONSENTIMIENTO, codigoDe, enLinea, normalizarCodigo,
  sanearCuentas, sanearNombrePc, sanearRespuesta, tieneFormaDeToken, type CuentaPc,
} from './ia-pc-reglas';
import type { ToolDef } from './anthropic';

const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
const tokenNuevo = (prefijo: string): string => `${prefijo}${randomBytes(32).toString('base64url')}`;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const db = () => getSupabaseServer();

export type Dispositivo = { id: number; ws: number; persona: string; nombre: string; ultimoLatido: string | null; cuentas: CuentaPc[] };

// ── Emparejar ────────────────────────────────────────────────────────────────

/**
 * Un código de 6 letras para que ESTA persona empareje una PC suya (10 minutos, un uso). `consentimiento` es la versión
 * del texto que aceptó con un toque (TEXTO_CONSENTIMIENTO): sin eso no hay código (mig 0321).
 */
export async function crearCodigo(ws: number, persona: string, consentimiento: string): Promise<{ codigo: string; venceAt: string }> {
  if (consentimiento !== VERSION_CONSENTIMIENTO) throw new Error('ia-pc: sin aceptar el texto de hoy no hay código');
  const codigo = codigoDe(randomBytes(8));
  const venceAt = new Date(Date.now() + CODIGO_MS).toISOString();
  const { error } = await db().from('ia_pc_codigos').insert({ codigo_hash: hash(codigo), workspace_id: ws, persona, vence_at: venceAt, consentimiento });
  if (error) throw new Error(`ia-pc: no pude crear el código: ${error.message}`);
  return { codigo, venceAt };
}

/** Canjea el código por el token de la PC. El código se gasta en el mismo update que lo valida (un solo uso). */
export async function emparejar(codigoCrudo: unknown, nombreCrudo: unknown): Promise<{ token: string; ws: number } | null> {
  const codigo = normalizarCodigo(codigoCrudo);
  if (!codigo) return null;
  const { data } = await db().from('ia_pc_codigos')
    .update({ usado_at: new Date().toISOString() })
    .eq('codigo_hash', hash(codigo)).is('usado_at', null).gt('vence_at', new Date().toISOString())
    .select('workspace_id, persona, consentimiento').maybeSingle();
  if (!data) return null;
  const token = tokenNuevo(PREFIJO_TOKEN_PC);
  const ws = Number(data.workspace_id);
  const { error } = await db().from('ia_pc_dispositivos').insert({
    workspace_id: ws, persona: String(data.persona), nombre: sanearNombrePc(nombreCrudo), token_hash: hash(token),
    // Lo que aceptó la persona al pedir el código, con la hora en que se conectó la PC (mig 0321).
    consentimiento: (data.consentimiento as string | null) ?? null, consentimiento_at: new Date().toISOString(),
  });
  if (error) throw new Error(`ia-pc: no pude emparejar: ${error.message}`);
  return { token, ws };
}

const aDispositivo = (r: Record<string, unknown>): Dispositivo => ({
  id: Number(r.id), ws: Number(r.workspace_id), persona: String(r.persona), nombre: String(r.nombre),
  ultimoLatido: (r.ultimo_latido as string | null) ?? null, cuentas: sanearCuentas(r.cuentas),
});

/** La PC de un token, o null. El NEGOCIO sale de acá, nunca de lo que diga el pedido (regla 1). */
export async function dispositivoDelToken(token: unknown): Promise<Dispositivo | null> {
  if (!tieneFormaDeToken(token, PREFIJO_TOKEN_PC)) return null;
  const { data } = await db().from('ia_pc_dispositivos')
    .select('id, workspace_id, persona, nombre, ultimo_latido, cuentas').eq('token_hash', hash(token)).is('revocado_at', null).maybeSingle();
  return data ? aDispositivo(data) : null;
}

export async function latir(d: Dispositivo, cuerpo: unknown): Promise<void> {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : {};
  const version = typeof o.version === 'string' ? o.version.replace(/[^\w.\-+]/g, '').slice(0, 40) : null;
  await db().from('ia_pc_dispositivos')
    .update({ ultimo_latido: new Date().toISOString(), version, cuentas: sanearCuentas(o.cuentas) })
    .eq('id', d.id).eq('workspace_id', d.ws);
}

/** La PC de ESTA persona en este negocio (la más reciente que no se desconectó), con si está en línea. */
export async function pcDe(ws: number, persona: string): Promise<(Dispositivo & { enLinea: boolean }) | null> {
  const { data } = await db().from('ia_pc_dispositivos')
    .select('id, workspace_id, persona, nombre, ultimo_latido, cuentas')
    .eq('workspace_id', ws).eq('persona', persona).is('revocado_at', null)
    .order('ultimo_latido', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (!data) return null;
  const d = aDispositivo(data);
  return { ...d, enLinea: enLinea(d.ultimoLatido) };
}

export async function desconectar(ws: number, id: number): Promise<void> {
  await db().from('ia_pc_dispositivos').update({ revocado_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', ws);
}

/** Lo que ve «Tus cuentas de IA»: las PC del negocio (el admin, todas; los demás, las suyas), sin ningún secreto. */
export async function listarDispositivos(ws: number, persona: string, esAdmin: boolean): Promise<Array<Dispositivo & { enLinea: boolean; version: string | null; esMia: boolean }>> {
  let q = db().from('ia_pc_dispositivos')
    .select('id, workspace_id, persona, nombre, ultimo_latido, cuentas, version')
    .eq('workspace_id', ws).is('revocado_at', null).order('creado_at', { ascending: false }).limit(20);
  if (!esAdmin) q = q.eq('persona', persona);
  const { data } = await q;
  return (data ?? []).map((r) => {
    const d = aDispositivo(r);
    return { ...d, enLinea: enLinea(d.ultimoLatido), version: (r.version as string | null) ?? null, esMia: d.persona === persona };
  });
}

/** ¿Puede esta persona desconectar esa PC? La suya, siempre; la de otro, sólo el admin del negocio. */
export async function puedeDesconectar(ws: number, id: number, persona: string, esAdmin: boolean): Promise<boolean> {
  const { data } = await db().from('ia_pc_dispositivos').select('persona').eq('id', id).eq('workspace_id', ws).is('revocado_at', null).maybeSingle();
  return !!data && (esAdmin || String(data.persona) === persona);
}

// ── Los turnos ───────────────────────────────────────────────────────────────

/** El pedido de un turno. `modelo` es el único valor del comando que viene del servidor: la PC lo pasa por su lista. */
export type PedidoPc = { system: string; prompt: string; tools: ToolDef[]; modelo?: string };

/** Encola un turno para la PC. El token de sus herramientas todavía no existe: se acuña cuando la PC lo toma. */
export async function encolarTurno(d: Dispositivo, sesionId: number, pedido: PedidoPc): Promise<number> {
  const { data, error } = await db().from('ia_pc_turnos').insert({
    workspace_id: d.ws, dispositivo_id: d.id, sesion_id: sesionId, pedido,
    vence_at: new Date(Date.now() + TURNO_MS).toISOString(),
  }).select('id').single();
  if (error || !data) throw new Error(`ia-pc: no pude encolar el turno: ${error?.message ?? 'sin fila'}`);
  return Number(data.id);
}

/**
 * La PC pide el próximo turno (long-poll). Se toma UNA vez: el update pasa de `esperando` a `tomado` sólo si nadie lo
 * tomó antes, y ahí se acuña el token de sus herramientas, que recibe sólo esta PC.
 */
export async function tomarTurno(d: Dispositivo, hastaMs = ESPERA_TURNO_MS): Promise<{ id: number; pedido: PedidoPc; token: string } | null> {
  const fin = Date.now() + hastaMs;
  for (;;) {
    const ahora = new Date().toISOString();
    const { data: prox } = await db().from('ia_pc_turnos').select('id')
      .eq('dispositivo_id', d.id).eq('workspace_id', d.ws).eq('estado', 'esperando').gt('vence_at', ahora)
      .order('creado_at').limit(1).maybeSingle();
    if (prox) {
      const token = tokenNuevo(PREFIJO_TOKEN_TURNO);
      const { data } = await db().from('ia_pc_turnos')
        .update({ estado: 'tomado', tomado_at: ahora, token_hash: hash(token) })
        .eq('id', prox.id).eq('estado', 'esperando').select('id, pedido').maybeSingle();
      if (data) return { id: Number(data.id), pedido: data.pedido as PedidoPc, token };
    }
    if (Date.now() + 1000 > fin) return null;
    await esperar(1000);
  }
}

/** La PC contesta un turno SUYO que tomó. Lo de otra PC, de otro negocio o ya cerrado no se toca. */
export async function contestarTurno(d: Dispositivo, id: number, cuerpo: unknown): Promise<boolean> {
  const r = sanearRespuesta(cuerpo);
  if (!r || !Number.isInteger(id)) return false;
  const { data } = await db().from('ia_pc_turnos')
    .update(r.ok
      ? { estado: 'listo', respuesta: r.texto, cuenta: r.cuenta, uso: r.uso, listo_at: new Date().toISOString() }
      : { estado: 'error', error: r.error, listo_at: new Date().toISOString() })
    .eq('id', id).eq('dispositivo_id', d.id).eq('workspace_id', d.ws).eq('estado', 'tomado').select('id').maybeSingle();
  return !!data;
}

/** El turno de un token de herramientas: sólo mientras está tomado y no venció. */
export async function turnoDelToken(token: unknown): Promise<{ id: number; ws: number; tools: ToolDef[] } | null> {
  if (!tieneFormaDeToken(token, PREFIJO_TOKEN_TURNO)) return null;
  const { data } = await db().from('ia_pc_turnos').select('id, workspace_id, pedido')
    .eq('token_hash', hash(token)).eq('estado', 'tomado').gt('vence_at', new Date().toISOString()).maybeSingle();
  if (!data) return null;
  return { id: Number(data.id), ws: Number(data.workspace_id), tools: ((data.pedido as PedidoPc)?.tools ?? []) as ToolDef[] };
}

// ── Las herramientas: las pide la PC, las corre el turno que espera ─────────────

/** El MCP deja la llamada y espera a que el turno la corra. null = el turno ya no espera. */
export async function pedirLlamada(turnoId: number, nombre: string, entrada: Record<string, unknown>, hastaMs = 60_000): Promise<{ salida: string; esError: boolean } | null> {
  const { data, error } = await db().from('ia_pc_llamadas').insert({ turno_id: turnoId, nombre: nombre.slice(0, 120), entrada }).select('id').single();
  if (error || !data) return null;
  const fin = Date.now() + hastaMs;
  while (Date.now() < fin) {
    await esperar(400);
    const { data: l } = await db().from('ia_pc_llamadas').select('estado, salida, es_error').eq('id', data.id).maybeSingle();
    if (l?.estado === 'lista') return { salida: String(l.salida ?? ''), esError: !!l.es_error };
  }
  return null;
}

export type Ejecutor = (nombre: string, entrada: Record<string, unknown>) => Promise<string | { content: string; isError?: boolean }>;

/**
 * El turno que espera a la PC: corre las herramientas que ella pide (con SU `runTool`, el del chat: el gating de la vista,
 * el memo y las tarjetas) y vuelve con la respuesta. null = no volvió a tiempo (y el turno se da por vencido).
 */
export async function esperarALaPc(turnoId: number, ws: number, ejecutar: Ejecutor, hastaMs: number): Promise<{ texto: string } | { error: string } | null> {
  const fin = Date.now() + hastaMs;
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
    const { data: t } = await db().from('ia_pc_turnos').select('estado, respuesta, error').eq('id', turnoId).eq('workspace_id', ws).maybeSingle();
    if (t?.estado === 'listo') return { texto: String(t.respuesta ?? '') };
    if (t?.estado === 'error') return { error: String(t.error ?? 'error') };
    if (!t || t.estado === 'vencido') return null;
    if (!llamadas?.length) await esperar(500);
  }
  // No volvió: se da por vencido, así lo que conteste después no se muestra (docs/ia-del-cliente.md §12).
  await db().from('ia_pc_turnos').update({ estado: 'vencido' }).eq('id', turnoId).in('estado', ['esperando', 'tomado']);
  return null;
}
