// =============================================================================
// grupo-puerta — quién entra al grupo de un negocio, leído contra la base en CADA pedido (3/11/2026)
// =============================================================================
// El juicio vive en lib/grupo-reglas.ts (puro); acá la lectura, con el molde de lib/agencia.ts: por pedido, sin caché entre pedidos y
// fail-closed. Autoriza a la PERSONA, no al workspace.
//
// ⛔ NO SE TOCA `proxy.ts`, NI `getWorkspaceActual`, NI SE DA `?ws=` NI COOKIE: las tres abren el negocio ENTERO. Un invitado sigue parado en
// SU negocio: el ws del grupo sale de la URL, ya autorizado acá, y se lee con el cliente de servicio. Por eso estas tablas nunca van
// por `getTenantDb()`: le daría a un invitado el grupo de SU negocio, y un insert se estamparía con SU ws.
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { getUsuarioActual } from './auth';
import { getSupabaseServer } from './supabase';
import { negocioPausado, wsSuperAdmin } from './workspace';
import { agenciasAprobadasDe, carteraDeAgencia } from './agencia';
import { administraActivo } from './agencia-equipo-grupo';
import { juzgarAcceso, letraDeAcceso, rolDelEquipo, type AccesoJuzgado, type LetraGrupo, type PersonaLeida, type TipoDeAcceso } from './grupo-reglas';

const COLS_PERSONA = 'id, email, nombre, rol, rol_ws, estado, workspace_id, foto_url';
type FilaPersona = PersonaLeida & { email: string; nombre: string | null; foto_url: string | null };

export type PersonaDelGrupo = AccesoJuzgado & { ws: number; usuarioId: number; email: string; nombre: string; fotoUrl: string | null; letra: LetraGrupo; invitado: boolean };

const db = () => getSupabaseServer();

/** La invitación VIGENTE de esta persona a este grupo. null también si no se pudo leer: ese camino dice que no. */
async function invitacionDe(ws: number, usuarioId: number): Promise<{ desdeId: number } | null> {
  const { data, error } = await db().from('grupo_invitados').select('desde_id')
    .eq('workspace_id', ws).eq('usuario_id', usuarioId).is('salio_at', null).limit(1).maybeSingle();
  if (error || !data) return null;
  const desde = Number((data as { desde_id?: unknown }).desde_id);
  return Number.isSafeInteger(desde) && desde >= 0 ? { desdeId: desde } : null;
}

/** El juicio sobre una persona ya leída. Cada lectura que falla cierra SU camino, no los otros. */
async function juzgar(ws: number, persona: FilaPersona | null): Promise<AccesoJuzgado | null> {
  if (!persona) return null;
  const [plataforma, invitacion, agencias, pausado] = await Promise.all([
    wsSuperAdmin().catch(() => null),
    invitacionDe(ws, Number(persona.id)).catch(() => null),
    agenciasAprobadasDe(ws).catch(() => null),
    negocioPausado(ws).catch(() => false),
  ]);
  return juzgarAcceso({
    ws, esPlataforma: plataforma == null || plataforma === ws, negocioPausado: pausado,
    persona: { ...persona, id: Number(persona.id) }, invitacion, agenciasAprobadas: agencias,
  });
}

/** La persona de la sesión, de la base. Una sesión sin fila (legacy, dev, contraseña maestra) no es una persona: no entra. */
async function personaDeLaSesion(): Promise<FilaPersona | null> {
  const s = await getUsuarioActual().catch(() => null);
  if (!s || !/^\d+$/.test(String(s.sub ?? '')) || s.legacy) return null;
  const { data, error } = await db().from('usuarios').select(COLS_PERSONA).eq('id', Number(s.sub)).maybeSingle();
  if (error || !data) return null;
  return data as unknown as FilaPersona;
}

/**
 * ¿La persona de ESTE pedido entra a ESTE grupo? null = no: se le contesta 404, siempre el mismo. Por pedido (`cache`) y contra la base
 * en cada pedido: sacarla, revocar la agencia o suspenderla corta en el siguiente sondeo.
 */
export const accesoAlGrupo = cache(async (ws: number): Promise<PersonaDelGrupo | null> => {
  if (!Number.isSafeInteger(ws) || ws <= 0) return null;
  const p = await personaDeLaSesion();
  const a = await juzgar(ws, p);
  if (!a || !p) return null;
  return {
    ...a, ws, usuarioId: Number(p.id), email: String(p.email ?? '').toLowerCase(), nombre: (p.nombre ?? '').trim(), fotoUrl: p.foto_url ?? null,
    letra: letraDeAcceso(a), invitado: a.tipo === 'invitado',
  };
});

/**
 * La letra de quien escribió, AHORA (lib/mako-doer-in.ts, al armar el lote y en el cron): un invitado sacado entre el POST y el turno, o una
 * agencia revocada mientras el mensaje esperaba, corren sin herramientas. `m` sólo con la prueba positiva leída sin error; cualquier
 * otra cosa, `i`.
 */
export async function letraVigente(ws: number, email: string): Promise<LetraGrupo> {
  try {
    const { data, error } = await db().from('usuarios').select(COLS_PERSONA).eq('email', email.trim().toLowerCase()).maybeSingle();
    if (error || !data) return 'i';
    return letraDeAcceso(await juzgar(ws, data as unknown as FilaPersona));
  } catch { return 'i'; }
}

export type MiembroDelGrupo = { usuarioId: number; email: string; nombre: string; fotoUrl: string | null; tipo: Exclude<TipoDeAcceso, 'soporte'>; abrio: boolean };
export type Miembros = { conCuenta: MiembroDelGrupo[]; invitadosSinCuenta: string[] };

/**
 * LOS MIEMBROS DE VERDAD: quienes administran el negocio, quienes administran su agencia y los invitados. El super admin entra por soporte y
 * no figura (si está invitado, sí). En el grupo de la plataforma, los que tienen el rol global. Una lectura que falla deja afuera a
 * ese grupo de personas: para el push es un aviso de menos, nunca uno de más.
 */
export async function miembrosDelGrupo(ws: number): Promise<Miembros> {
  const fila = (u: FilaPersona, tipo: MiembroDelGrupo['tipo'], abrio = true): MiembroDelGrupo => ({
    usuarioId: Number(u.id), email: String(u.email ?? '').toLowerCase(), nombre: (u.nombre ?? '').trim(), fotoUrl: u.foto_url ?? null, tipo, abrio,
  });
  const plataforma = await wsSuperAdmin().catch(() => null);
  if (plataforma === ws) {
    const { data } = await db().from('usuarios').select(COLS_PERSONA).eq('rol', 'admin');
    return { conCuenta: ((data ?? []) as unknown as FilaPersona[]).filter((u) => u.estado !== 'suspendido').map((u) => fila(u, 'admin')), invitadosSinCuenta: [] };
  }
  const out = new Map<number, MiembroDelGrupo>();
  const { data: propios } = await db().from('usuarios').select(COLS_PERSONA).eq('workspace_id', ws);
  for (const u of (propios ?? []) as unknown as FilaPersona[]) {
    if (u.rol === 'admin') continue;
    if (administraActivo(u)) out.set(Number(u.id), fila(u, 'admin'));
    // Su EQUIPO (13/11/2026): el closer y el setter también están en el grupo (`juzgarAcceso`).
    else if (rolDelEquipo(u)) out.set(Number(u.id), fila(u, 'equipo'));
  }
  const agencias = await agenciasAprobadasDe(ws).catch(() => [] as number[]);
  if (agencias.length) {
    const { data: deAgencia } = await db().from('usuarios').select(COLS_PERSONA).in('workspace_id', agencias);
    for (const u of (deAgencia ?? []) as unknown as FilaPersona[]) if (u.rol !== 'admin' && administraActivo(u) && !out.has(Number(u.id))) out.set(Number(u.id), fila(u, 'agencia'));
  }
  const { data: invs } = await db().from('grupo_invitados').select('email, usuario_id, abrio_at').eq('workspace_id', ws).is('salio_at', null);
  const invitados = (invs ?? []) as Array<{ email: string; usuario_id: number | null; abrio_at: string | null }>;
  const ids = invitados.map((i) => i.usuario_id).filter((x): x is number => x != null).map(Number);
  const invitadosSinCuenta = invitados.filter((i) => i.usuario_id == null).map((i) => i.email);
  if (ids.length) {
    const { data: filas } = await db().from('usuarios').select(COLS_PERSONA).in('id', ids);
    for (const u of (filas ?? []) as unknown as FilaPersona[]) {
      // Alguien del equipo a quien quien administra invitó queda INVITADO, como en la puerta (`juzgarAcceso`): no figura dos veces ni con más de lo que ya tenía.
      if (u.estado === 'suspendido' || (out.has(Number(u.id)) && out.get(Number(u.id))?.tipo !== 'equipo')) continue;
      const inv = invitados.find((i) => Number(i.usuario_id) === Number(u.id));
      out.set(Number(u.id), fila(u, 'invitado', !!inv?.abrio_at));
    }
  }
  return { conCuenta: [...out.values()], invitadosSinCuenta };
}

export type GrupoDeLaPersona = { ws: number; acceso: PersonaDelGrupo };

/**
 * Los grupos de la persona de este pedido: el propio si administra, los invitados, la cartera aprobada si administra una agencia, y al super
 * admin el de la pestaña o la plataforma. Parada en la pestaña de otro negocio (un cliente de su cartera), sólo el de ése. Cada candidato pasa por la MISMA puerta: una cuenta del workspace de la plataforma sin el rol global no
 * ve ese grupo, y una lista no es otro camino para entrar.
 */
export async function gruposDeLaPersona(wsDeLaPestana: number | null): Promise<GrupoDeLaPersona[]> {
  const p = await personaDeLaSesion();
  if (!p) return [];
  const candidatos = new Set<number>();
  if (p.rol === 'admin') {
    const plataforma = await wsSuperAdmin().catch(() => null);
    const uno = wsDeLaPestana ?? plataforma;
    if (uno != null) candidatos.add(uno);
  } else if (p.workspace_id != null) {
    const propio = Number(p.workspace_id);
    // Parada en la pestaña de OTRO negocio (un cliente de su cartera): sólo el grupo de ése. Sin esto, quien administra una agencia veía,
    // adentro de la cuenta de un cliente, los grupos de todos los demás (ticket #55, 4/11/2026). Es la LISTA: la puerta sigue igual.
    if (wsDeLaPestana != null && wsDeLaPestana !== propio) {
      const acceso = await accesoAlGrupo(wsDeLaPestana);
      return acceso ? [{ ws: wsDeLaPestana, acceso }] : [];
    }
    candidatos.add(propio);
    if (administraActivo(p)) {
      const cartera = await carteraDeAgencia(Number(p.workspace_id)).catch(() => []);
      for (const c of cartera) if (c.estado === 'aprobado') candidatos.add(Number(c.cliente_ws));
    }
  }
  const { data: invs } = await db().from('grupo_invitados').select('workspace_id').eq('usuario_id', Number(p.id)).is('salio_at', null);
  for (const i of (invs ?? []) as Array<{ workspace_id: number }>) candidatos.add(Number(i.workspace_id));
  const out: GrupoDeLaPersona[] = [];
  for (const ws of [...candidatos].slice(0, 30)) {
    const acceso = await accesoAlGrupo(ws);
    if (acceso) out.push({ ws, acceso });
  }
  return out;
}
