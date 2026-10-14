'use server';

// =============================================================================
// Server actions del Calendario — sólo lo PROPIO (`calendario_eventos`)
// =============================================================================
// ⚠️ TODAS EMPIEZAN CON EL GUARD DE LA PÁGINA: una server action es la API de esta pantalla, y esconder la tab no
//    impide invocarla. El aislamiento entre negocios lo pone `getTenantDb()` abajo (la tabla está en TENANT_TABLES).
// ⚠️ La zona es la del NEGOCIO, resuelta en el server: lo que manda el navegador es la fecha y la hora de pared.
// ⚠️ Un archivo `'use server'` sólo exporta funciones async: los tipos de entrada viven en lib/calendario-modelo.ts.

import { revalidatePath } from 'next/cache';
import { requireRolWs } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import {
  crearEventos, cambiarEvento, marcarEvento, borrarEvento, restaurarEvento, zonaDelCalendario, type EventoBorrado,
} from '@/lib/calendario';
import type { EntradaEvento } from '@/lib/calendario-modelo';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';

const guard = () => requireRolWs([], { nav: 'calendario' });

async function autor(): Promise<string | null> {
  try { const s = await getUsuarioActual(); return s?.email ?? s?.sub ?? null; } catch { return null; }
}

/** Crea uno o varios eventos (uno a mano, una plantilla, o lo que propuso MaKo y la persona confirmó). */
export async function crearEventosAction(entradas: EntradaEvento[], origen: 'user' | 'plantilla' | 'ia'): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  await guard();
  const o = origen === 'plantilla' || origen === 'ia' ? origen : 'user';
  try {
    const r = await crearEventos(Array.isArray(entradas) ? entradas : [], await zonaDelCalendario(), { origen: o, autor: await autor() });
    if (r.ok) {
      // «Tu primera semana» (el onboarding de la tab) se cierra al agendar algo. Que falle la marca no tumba lo agendado.
      try { const t = await getEstadoTab('calendario'); if (!t.steps.cal_semana?.done) await marcarPasoTab('calendario', 'cal_semana'); } catch { /* la marca se reintenta en el próximo */ }
      revalidatePath('/calendario');
    }
    return r;
  } catch (e) {
    console.error('[calendario] crear:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

export async function cambiarEventoAction(id: string, entrada: EntradaEvento): Promise<{ ok: true } | { ok: false; error: string }> {
  await guard();
  try {
    const r = await cambiarEvento(String(id), entrada, await zonaDelCalendario());
    if (r.ok) revalidatePath('/calendario');
    return r;
  } catch (e) {
    console.error('[calendario] cambiar:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

export async function marcarEventoAction(id: string, hecho: boolean): Promise<boolean> {
  await guard();
  const ok = await marcarEvento(String(id), !!hecho);
  if (ok) revalidatePath('/calendario');
  return ok;
}

/** Borra y devuelve lo que borró: el «Deshacer» del toast lo vuelve a poner con el MISMO id. */
export async function borrarEventoAction(id: string): Promise<EventoBorrado | null> {
  await guard();
  const b = await borrarEvento(String(id));
  revalidatePath('/calendario');
  return b;
}

export async function restaurarEventoAction(b: EventoBorrado): Promise<void> {
  await guard();
  await restaurarEvento(b);
  revalidatePath('/calendario');
}
