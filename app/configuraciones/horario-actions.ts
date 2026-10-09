'use server';

// =============================================================================
// El HORARIO DE ENVÍO del negocio — leer y guardar (Configuraciones › Horario)
// =============================================================================
// Decisión de Martín (09/10/2026, sexta tanda): por defecto las automatizaciones mandan a cualquier
// hora y cada negocio puede ponerles un horario acá. El porqué y las reglas, en lib/horario-envio.ts;
// lo lee el motor (lib/nutricion.ts, `procesarEnvios`) y el tick (app/api/cron/nutricion-tick).
//
// ⚠️ ADMIN, NO CUALQUIERA: decide cuándo le llega un mensaje a cada lead del negocio. Mismo corte que
// el criterio (criterio-actions.ts): `requireRolWs` redirige, y en una acción se devuelve el error.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): los tipos y las
// constantes viven en lib/horario-envio.ts.

import { requireSesion } from '@/lib/tab-access';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { KEY_TIMEZONE } from '@/lib/timezone';
import { zonaDelMotor } from '@/lib/nutricion-grafo-motor';
import { KEY_HORARIO_ENVIO, HORARIO_SUGERIDO, sanearHorario, horarioParaGuardar, type HorarioEnvio } from '@/lib/horario-envio';

export async function getHorarioEnvioAction(): Promise<{ horario: HorarioEnvio; zona: string; puedeEditar: boolean }> {
  const rol = await requireSesion();
  // Estricto: si no se puede leer, la pantalla dice que no pudo, no que «no hay horario».
  const [raw, tz] = await Promise.all([getSettingEstricto(KEY_HORARIO_ENVIO), getSetting(KEY_TIMEZONE).catch(() => null)]);
  // Sin nada guardado, la pantalla propone el horario de siempre APAGADO: prenderlo es un clic.
  const horario = sanearHorario(raw) ?? { ...HORARIO_SUGERIDO, activo: false };
  return { horario, zona: zonaDelMotor(tz), puedeEditar: rol === 'admin' };
}

export async function saveHorarioEnvioAction(h: unknown): Promise<{ ok: boolean; error?: string; horario?: HorarioEnvio }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Solo un admin puede cambiar el horario.' };
  const r = horarioParaGuardar(h);
  if (!r.ok) return { ok: false, error: r.error };
  try {
    await setSetting(KEY_HORARIO_ENVIO, r.valor);
    return { ok: true, horario: sanearHorario(r.valor) ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
