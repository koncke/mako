'use server';

// =============================================================================
// «Traer de un grupo de WhatsApp» — las acciones del CRM (23/10/2026)
// =============================================================================
// Lo que hacen está en ./grupo-wa-server.ts. Acá, la puerta: sesión y ADMIN del negocio (los números de un grupo son datos
// personales: sólo quien administra el negocio los trae, y quedan sólo en su workspace). Las usa ./TraerDeGrupoWA.tsx.

import { revalidatePath } from 'next/cache';
import { exigirSesion } from '@/lib/sesion-accion';
import { getRolWsEfectivo } from '@/lib/workspace';
import { idDelFunnelDefault } from '@/lib/funnels';
import { autorDelMovimiento } from '@/lib/leads';
import type { GrupoWA, ParticipanteWA } from '@/lib/grupo-wa-reglas';
import {
  etapasParaTraer, gruposDeLinea, lineasDelNegocio, marcarEnElCrm, participantesDelGrupo, traerDelGrupo,
  type LineaGrupos, type ResultadoTraer,
} from './grupo-wa-server';

type Res<T> = ({ ok: true } & T) | { ok: false; error: string };
const SOLO_ADMIN = 'Sólo el administrador del negocio puede traer los contactos de un grupo.';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const funnelDe = async (funnelId: number | null): Promise<number | null> => funnelId ?? (await idDelFunnelDefault());

/** Al abrir: las líneas del negocio y las etapas de este funnel (las que mandan algo, marcadas: no se ofrecen). */
export async function abrirTraerDeGrupoAction(funnelId: number | null): Promise<Res<{ lineas: LineaGrupos[]; etapas: Array<{ key: string; label: string; manda: boolean }>; entrada: string | null }>> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    const destino = await funnelDe(funnelId);
    if (destino == null) return { ok: false, error: 'Este negocio todavía no tiene un funnel.' };
    const [lineas, etapas] = await Promise.all([lineasDelNegocio(), etapasParaTraer(destino)]);
    return { ok: true, lineas, ...etapas };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Las etapas de otro funnel (al cambiarlo en la pantalla): las que mandan algo solas, marcadas. */
export async function etapasDeFunnelAction(funnelId: number | null): Promise<Res<{ etapas: Array<{ key: string; label: string; manda: boolean }>; entrada: string | null }>> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    const destino = await funnelDe(funnelId);
    if (destino == null) return { ok: false, error: 'Este negocio todavía no tiene un funnel.' };
    return { ok: true, ...(await etapasParaTraer(destino)) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Los grupos de una línea del negocio. */
export async function gruposDeLineaAction(linea: string | null): Promise<Res<{ linea: string; grupos: GrupoWA[]; deLaBase: boolean }>> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try { return await gruposDeLinea(linea); } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Los participantes de un grupo, marcando los que ya son un lead del CRM. */
export async function participantesDeGrupoAction(linea: string | null, jid: string): Promise<Res<{ participantes: Array<ParticipanteWA & { enElCrm: boolean }>; sinNumero: number }>> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await participantesDelGrupo(linea, jid);
    if (!r.ok) return r;
    return { ok: true, participantes: await marcarEnElCrm(r.participantes), sinNumero: r.sinNumero };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Trae una TANDA de participantes (la pantalla manda de a `TANDA_GRUPO`): crea o suma, sin duplicar, a la etapa elegida. */
export async function traerDeGrupoAction(p: { linea: string | null; jid: string; nombreGrupo: string; funnelId: number | null; etapa: string; telefonos: string[]; etiqueta?: string }): Promise<ResultadoTraer> {
  await exigirSesion();
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    const destino = await funnelDe(p.funnelId);
    if (destino == null) return { ok: false, error: 'Este negocio todavía no tiene un funnel.' };
    const telefonos = (Array.isArray(p.telefonos) ? p.telefonos : []).filter((t) => typeof t === 'string').slice(0, 200);
    const r = await traerDelGrupo({
      linea: p.linea, jid: p.jid, nombreGrupo: String(p.nombreGrupo ?? '').slice(0, 120), funnelId: destino, etapa: String(p.etapa ?? ''),
      telefonos, autor: await autorDelMovimiento(), etiqueta: typeof p.etiqueta === 'string' ? p.etiqueta.slice(0, 80) : null,
      // Con tope también desde la pantalla: una acción del server tiene 60 s, y cortada a la mitad dejaba a un lead recién
      // creado en la etapa de entrada sin moverlo. Lo que no entra vuelve en `quedan` (la revisión de privacidad, 23/10/2026).
      hasta: Date.now() + 45_000,
    });
    if (r.ok) revalidatePath('/crm');
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}
