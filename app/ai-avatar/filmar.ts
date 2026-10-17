// =============================================================================
// filmar — filmar las tomas del video de un avatar, una por una (módulo PURO, sin React)
// =============================================================================
// Es el lazo de «Generar video» de AI Avatar (AiAvatarCliente.tsx → CrearVideo → `filmar`), sacado a un módulo sin
// 'use client' el 17/10/2026 para que lo use también el teléfono (app/m/ai-avatar), que no puede importar de una
// pantalla 'use client' de escritorio (AGENTS.md). Las reglas son las de allá, sin cambiar una:
//   · EN SERIE Y SIN REINTENTO, por plata: cada toma es un clip que se paga. Si una falla, la cadena para ahí y la
//     persona decide si vuelve a apretar.
//   · Cada toma se pide con `generarTomaAction` (ahí viven el freno de plata, el puente y la cara) y se pregunta cada
//     `SONDEO_MS` con `estadoTomaAction`, avisándole al puente que hay trabajo (`avisarPuente`).
//   · `a_ciegas` NO es `error`: el clip probablemente ya está hecho y lo roto es cómo preguntamos; se sigue
//     preguntando, con el motivo a la vista.
// ⚠️ Escritorio todavía tiene su copia adentro de CrearVideo: pasarla a esto es del chat «AI Avatar»
//    (docs/relevo/mako-mobile.md). Hasta ese día, un cambio a una regla de acá va en los DOS lados.
// =============================================================================

import { generarTomaAction, estadoTomaAction } from '@/app/video-generator/video-action';
import { avisarPuente } from '@/app/video-generator/avisar-puente';

/** Cada cuánto se pregunta por una toma: el sondeo del Video Generator. */
export const SONDEO_MS = 6000;

export type TomaAvatar = { n: number; fase: 'esperando' | 'filmando' | 'listo' | 'a_ciegas' | 'error'; url?: string; detalle?: string };

/**
 * Filma `lista` del plan `plan`, en orden. `alCambiar` recibe cada toma con su fase nueva (la pantalla la reemplaza
 * por número). Termina cuando todas salieron o en la primera que no salió.
 */
export async function filmarTomas(
  plan: string,
  lista: readonly number[],
  alCambiar: (t: TomaAvatar) => void,
  esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<void> {
  for (const n of lista) {
    alCambiar({ n, fase: 'filmando' });
    const g = await generarTomaAction(plan, n);
    if (!g.ok) {
      alCambiar({ n, fase: 'error', detalle: g.error });
      return;
    }
    avisarPuente();
    let fin: TomaAvatar | null = null;
    while (!fin) {
      await esperar(SONDEO_MS);
      avisarPuente();
      const e = await estadoTomaAction(plan, n);
      if (!e.ok) { fin = { n, fase: 'error', detalle: e.error }; break; }
      const s = e.estado;
      if (s.fase === 'listo') fin = { n, fase: 'listo', url: s.url };
      else if (s.fase === 'error') fin = { n, fase: 'error', detalle: s.error };
      else if (s.fase === 'a_ciegas') alCambiar({ n, fase: 'a_ciegas', detalle: s.error });
    }
    alCambiar(fin);
    if (fin.fase !== 'listo') return;
  }
}
