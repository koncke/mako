// =============================================================================
// /m/experimentos — las escrituras: LAS DE ESCRITORIO, por las mismas rutas
// =============================================================================
// Escritorio no tiene server actions acá: sus tabs hablan con /api/experimentos (crear, iniciar,
// cerrar, descartar), /api/experimentos/suggest (MaKo diseña desde una hipótesis) y /api/retro
// (`action: 'plan'`: aceptar, posponer, descartar, deshacer). El teléfono llama a las MISMAS, con
// los mismos cuerpos: mismo gating y mismos efectos (aceptar crea el experimento y sus tareas en
// el server, no acá). El gating lo hace CADA RUTA, no la página: `soloAdminDeTab('experimentos')`
// (lib/puerta-admin-tab.ts) le contesta 403 a un closer o un setter que las llame desde la consola.
// El `?ws=` lo pone el parche de fetch de la casa (app/_components/WsFetch.tsx);
// el workspace NUNCA viaja en el cuerpo.
//
// Nunca tira: una falla vuelve como `{ ok: false }` con el error del server (para el log) y la
// pantalla dice algo corto en su toast.
// =============================================================================

import type { Propuesta } from '@/lib/experimentos';
import type { RetroReporte } from '@/lib/retro-reporte';
import type { OpPlan } from './modelo';

type Resp<T> = { ok: true; datos: T } | { ok: false; error: string };

async function post<T>(url: string, body: unknown, leer: (j: Record<string, unknown>) => T | null): Promise<Resp<T>> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (j?.ok) {
      const datos = leer(j);
      if (datos != null) return { ok: true, datos };
    }
    const error = typeof j?.error === 'string' ? j.error : `HTTP ${r.status}`;
    console.warn(`[m/experimentos] ${url} no salió: ${error}`);
    return { ok: false, error };
  } catch (e) {
    console.warn(`[m/experimentos] sin respuesta de ${url}:`, e);
    return { ok: false, error: 'sin respuesta' };
  }
}

/** El ciclo de vida de un experimento (ExperimentsTab.tsx, `accion`). */
export function accionExperimento(action: 'iniciar' | 'cerrar' | 'descartar', id: number) {
  return post('/api/experimentos', { action, id }, () => true);
}

/** MaKo convierte la hipótesis en un experimento (no crea nada: se revisa y se inicia). */
export function disenarExperimento(hipotesis: string) {
  return post('/api/experimentos/suggest', { hipotesis, contexto: '' }, (j) => (j.propuesta as Propuesta | undefined) ?? null);
}

/** Crea y arranca el experimento de la propuesta, con el cuerpo de escritorio (NuevoExperimentoModal, `iniciar`). */
export function iniciarPropuesta(p: Propuesta) {
  return post('/api/experimentos', {
    action: 'crear',
    experimento: {
      titulo: p.titulo, hipotesis: p.hipotesis, cambio: p.cambio, metrica: p.metrica, direccion: p.direccion,
      objetivo_valor: p.objetivo_valor, criterio_exito: p.criterio_exito, ventana_dias: p.ventana_dias,
      presupuesto_usd: p.presupuesto_usd, origen: 'mako', racional: p.racional, config: { propuesta: p }, arrancar: true,
    },
  }, () => true);
}

/** Una decisión sobre una recomendación de la Retro. Devuelve el reporte como quedó en la base. */
export function decidirPlan(retroId: number, itemId: string, op: OpPlan, motivo?: string) {
  return post('/api/retro', { action: 'plan', id: retroId, itemId, op, motivo }, (j) => (j.reporte as RetroReporte | undefined) ?? null);
}
