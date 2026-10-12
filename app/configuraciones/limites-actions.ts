'use server';

// =============================================================================
// Los LÍMITES DE ENVÍO del negocio — leer y guardar (Automations › Configuraciones › Límites)
// =============================================================================
// Décima tanda (11/10/2026, GENERAL 4): «configuraciones sobre todo para limitaciones de todos los flujos…
// como que no se envien más de X cantidad de mensajes... Que todo eso sea configurable.» Las reglas, en
// lib/limites-envio.ts; lo lee el motor una vez por corrida (lib/nutricion.ts, `procesarEnvios`) y el setter
// en su call site (`asistirRespuesta`, `seguirCharla`).
//
// ⚠️ ADMIN, NO CUALQUIERA: decide cuántos mensajes salen de la línea del negocio. El setter LEE (la pantalla
// se dibuja sin editar), como el horario (horario-actions.ts).
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md): los tipos, los rangos y la
// clave viven en lib/limites-envio.ts.

import { requireSesion } from '@/lib/tab-access';
import { getSettingEstricto, setSetting } from '@/lib/settings';
import { usoDelCupo } from '@/lib/nutricion';
import { KEY_LIMITES_ENVIO, limitesDeFabrica, limitesParaGuardar, limitesVigentes, type LimitesEnvio, type UsoDelCupo } from '@/lib/limites-envio';

/** Lo que salió en la ventana de cada tope (para «24 h: 6 de 40»). `null` = no se pudo contar. */
type Uso = UsoDelCupo | null;

export async function getLimitesEnvioAction(): Promise<{ limites: LimitesEnvio; fabrica: LimitesEnvio; uso: Uso; puedeEditar: boolean }> {
  const rol = await requireSesion();
  const fabrica = limitesDeFabrica(process.env);
  // Estricto: si no se puede leer, la pantalla dice que no pudo, no que «está todo de fábrica».
  const [raw, uso] = await Promise.all([getSettingEstricto(KEY_LIMITES_ENVIO), usoDelCupo().catch((): Uso => null)]);
  return { limites: limitesVigentes(raw, fabrica), fabrica, uso, puedeEditar: rol === 'admin' };
}

/** Guarda los límites COMPLETOS que muestra la pantalla (`{}` en la base si todo es de fábrica: «Restaurar»). */
export async function saveLimitesEnvioAction(input: unknown): Promise<{ ok: boolean; error?: string; limites?: LimitesEnvio }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Solo un admin puede cambiar los límites.' };
  const fabrica = limitesDeFabrica(process.env);
  const r = limitesParaGuardar(input, fabrica);
  if (!r.ok) return { ok: false, error: r.error };
  try {
    await setSetting(KEY_LIMITES_ENVIO, r.valor);
    return { ok: true, limites: limitesVigentes(r.valor, fabrica) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
