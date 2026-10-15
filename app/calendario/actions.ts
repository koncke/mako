'use server';

// =============================================================================
// Server actions del Calendario — lo PROPIO (`calendario_eventos`) y, desde el 14/10/2026, lo de Google
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
import { crearEventoGoogle, cambiarEventoGoogle, borrarEventoGoogle, restaurarEventoGoogle, type ResultadoEscrituraGoogle } from '@/lib/calendario-google';
import type { EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { linkDeAgenda, type LinkDeAgenda } from '@/lib/agenda-link';

const guard = () => requireRolWs([], { nav: 'calendario' });

async function autor(): Promise<string | null> {
  try { const s = await getUsuarioActual(); return s?.email ?? s?.sub ?? null; } catch { return null; }
}

/** Crea uno o varios eventos (uno a mano o una plantilla). */
export async function crearEventosAction(entradas: EntradaEvento[], origen: 'user' | 'plantilla'): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  await guard();
  const o = origen === 'plantilla' ? origen : 'user';
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

// ── Google (14/10/2026, decisión de Martín: lo que se crea, mueve o borra desde MaKo se escribe en Google) ─────────
// Las escrituras van a lib/calendario-google.ts, que valida el calendario (existe en la cuenta y se puede editar) y
// el permiso del token antes de pegarle a Google. Nada de esto pasa por la IA.

const textoCorto = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');

export async function crearEventoGoogleAction(calendarioId: string, entrada: EntradaEventoGoogle): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await crearEventoGoogle(textoCorto(calendarioId, 300), entrada, await zonaDelCalendario());
  if (r.ok) revalidatePath('/calendario');
  return r;
}

export async function cambiarEventoGoogleAction(calendarioId: string, eventoId: string, entrada: EntradaEventoGoogle, avisar: boolean): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await cambiarEventoGoogle(textoCorto(calendarioId, 300), textoCorto(eventoId, 300), entrada, await zonaDelCalendario(), !!avisar);
  if (r.ok) revalidatePath('/calendario');
  return r;
}

/** Borra en Google. El «Deshacer» llama a `restaurarEventoGoogleAction` con el MISMO id. */
export async function borrarEventoGoogleAction(calendarioId: string, eventoId: string, avisar: boolean): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await borrarEventoGoogle(textoCorto(calendarioId, 300), textoCorto(eventoId, 300), !!avisar);
  if (r.ok) revalidatePath('/calendario');
  return r;
}

export async function restaurarEventoGoogleAction(calendarioId: string, eventoId: string): Promise<ResultadoEscrituraGoogle> {
  await guard();
  const r = await restaurarEventoGoogle(textoCorto(calendarioId, 300), textoCorto(eventoId, 300));
  if (r.ok) revalidatePath('/calendario');
  return r;
}

// ── Agendar una llamada (14/10/2026, Martín: «agregar el calendly o cal, para agendar llamadas») ──────────────────
// Devuelve el link de la página de reserva del negocio (lib/agenda-link.ts): Calendly o Cal.com, nunca el de otro. La
// reserva la hace una persona en esa página y entra al CRM por el webhook; el Calendario la lee de ahí (capa Llamadas).

export async function linkDeAgendaAction(cual: 'R1' | 'R2'): Promise<LinkDeAgenda> {
  await guard();
  try {
    return await linkDeAgenda(cual === 'R2' ? 'R2' : 'R1');
  } catch (e) {
    console.error('[calendario] link de agenda:', e instanceof Error ? e.message : e);
    return { ok: false, motivo: 'No pude leer tus integraciones.', faltan: [] };
  }
}
