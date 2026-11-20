// =============================================================================
// LA PRUEBA POR WHATSAPP DE CADA DÍA, RESPONDIDA (20/11/2026, verificación de la auditoría: d24-16 y R57-10)
// =============================================================================
// La persona le escribe a MaKo por WhatsApp (siempre ella primero) y MaKo contesta: carga el lead (día 3), le dice qué le funciona a
// su competencia (día 4), le escribe el guion con su audio (día 5), le pasa a Martín el audio de cómo le fue (día 7). Lo contesta el
// chat de WhatsApp (lib/reto/respuestas.ts y el bot): cuando MaKo ya contestó, llama `pruebaRespondida`, y la tarjeta del chat del reto
// pasa a «✓ Hecho» con lo que hizo MaKo. El día 5 además deja hecha la tarea del guion (la maqueta, WA_DIA 5: «Escribí tu guion con
// tu audio de WhatsApp.»). Con compare-and-set (./cambiar.ts): no pisa la hora ni lo leído que llegan a la vez.
// =============================================================================
import type { EstadoReto } from './dias';
import { CLAVE_RETO, claveTarea } from './dias';
import { cambiarReto, type IoReto } from './cambiar';

/** Lo que dice la tarea del guion cuando la escribió MaKo con el audio del día 5. */
export const GUION_POR_WHATSAPP = 'Escribí tu guion con tu audio de WhatsApp.';

/** Puro: el reto con la prueba del día `dia` respondida (y, el día 5, el guion hecho). No vuelve a escribir una ya respondida. */
export function conPruebaRespondida(e: EstadoReto, dia: number, leido: string | undefined, ahora: number): EstadoReto {
  const k = String(dia);
  if (!Number.isInteger(dia) || dia < 2 || dia > 7 || e.pruebas?.[k]) return e;
  const en = new Date(ahora).toISOString();
  const txt = leido?.trim().slice(0, 200) || undefined;
  const r: EstadoReto = { ...e, pruebas: { ...(e.pruebas ?? {}), [k]: { en, ...(txt ? { leido: txt } : {}) } } };
  if (dia !== 5) return r;
  const g = claveTarea(5, 'guion');
  return { ...r, hechas: { ...r.hechas, [g]: r.hechas[g] ?? en }, leidas: { ...(r.leidas ?? {}), [g]: r.leidas?.[g] ?? GUION_POR_WHATSAPP } };
}

/**
 * Para el chat de WhatsApp: MaKo ya contestó la prueba del día `dia` de ese negocio. `leido`: lo que hizo, dicho corto («Cargué a Juan
 * Pérez en tu CRM.»). Devuelve si quedó guardado (false: sin reto, o no se pudo escribir).
 */
export async function pruebaRespondida(ws: number, dia: number, leido?: string): Promise<boolean> {
  const { runWithWorkspace } = await import('../workspace');
  const { cambiarSettingSi, getSetting } = await import('../settings');
  return runWithWorkspace(ws, async () => {
    const io: IoReto = { leer: () => getSetting(CLAVE_RETO).catch(() => null), cas: (esperado, nuevo) => cambiarSettingSi(CLAVE_RETO, esperado, nuevo) };
    const r = await cambiarReto(io, (e) => conPruebaRespondida(e, dia, leido, Date.now())).catch(() => null);
    return !!r?.pruebas?.[String(dia)];
  });
}
