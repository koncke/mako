// =============================================================================
// LA REVISIÓN: SALTAR A UN PASO DEL ONBOARDING V2 O DEL RETO, CON EL ESTADO REAL (20/11/2026)
// =============================================================================
// Lo de qué es cada paso vive en ./saltar.ts (puro, con su test). Acá se escribe: primero «Reiniciar onboarding»
// (lib/reiniciar-onboarding-server.ts, el mismo del botón: borra el estado del onboarding y del reto, y olvida los tutoriales vistos, sin
// tocar los datos del negocio), y después el estado del paso. Sólo lo llama /api/admin/saltar-onboarding, con la puerta puesta
// (`puedeVerLaRevision`: alguien de MaKo y un negocio de prueba).
// =============================================================================
import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { estadoDeLoGuardado } from '@/lib/onboarding-contrato';
import { reiniciarOnboarding } from '@/lib/reiniciar-onboarding-server';
import { getEstadoVerificacionContacto } from '@/lib/mako-grupo';
import { emailDelDuenoDelWs } from '@/lib/dueno-del-ws';
import { perfilConVisto } from '@/lib/recorridos';
import { ID_RECORRIDO } from './llegada';
import { CLAVE_RETO } from '@/lib/reto/dias';
import { codigoSimulado } from './whatsapp-simulado';
import { clavesVistasDelReto, despuesDelPaso, destinoDelPaso, diaDelPaso, esPasoDelArranque, estadoArranqueHasta, estadoRetoEnDia, saltoDelPaso, type PasoDeRevision, type SaltoPendiente } from './saltar';

const CLAVE_ARRANQUE = 'onboarding.arranque';

/** Adónde ir, lo visto que anota el navegador de quien mira (el reto de antes y, de hoy, lo del paso) y la marca que se arranca al llegar. */
export type Salto = { destino: string; vistos: string[]; salto: SaltoPendiente | null; avisos: string[] };

/** El recorrido del Ops Center, VISTO para el dueño (los días del reto vienen después de él). */
async function recorridoVistoDelDueno(ws: number, cuando: string, avisos: string[]): Promise<void> {
  const email = await emailDelDuenoDelWs(ws);
  if (!email) { avisos.push('No encontré al dueño: el recorrido quedó sin ver.'); return; }
  const db = getSupabaseServer();
  const r = await db.from('usuarios').select('id, perfil').eq('email', email).eq('workspace_id', ws).maybeSingle();
  if (r.error || !r.data) { avisos.push('No pude leer el perfil del dueño: el recorrido quedó sin ver.'); return; }
  const fila = r.data as { id: number; perfil: unknown };
  const u = await db.from('usuarios').update({ perfil: perfilConVisto(fila.perfil, ID_RECORRIDO, cuando) }).eq('id', fila.id);
  if (u.error) avisos.push(`No pude anotar el recorrido como visto: ${u.error.message}`);
}

/** Deja el negocio `ws` en `paso`, como si se hubiera llegado ahí. Devuelve adónde ir y, en el reto, su `inicio` (lo visto del navegador). */
export async function saltarAlPaso(ws: number, paso: PasoDeRevision): Promise<Salto> {
  const { resultado } = await reiniciarOnboarding(ws, { aplicar: true });
  const avisos = [...resultado.avisos];
  return runWithWorkspace(ws, async () => {
    const tel = await getEstadoVerificacionContacto(ws).catch(() => null);
    const numero = tel?.verificado && tel.telefono ? tel.telefono : null;
    if (esPasoDelArranque(paso)) {
      await setSetting(CLAVE_ARRANQUE, JSON.stringify(estadoArranqueHasta(paso, { telefonoNumero: numero, codigo: codigoSimulado() })));
      return { destino: destinoDelPaso(paso), vistos: [], salto: null, avisos };
    }
    // La llegada y el reto: el onboarding contestado entero y TERMINADO.
    const ahora = Date.now();
    const cuando = new Date(ahora).toISOString();
    await setSetting(CLAVE_ARRANQUE, JSON.stringify(estadoArranqueHasta('cierre', { telefonoNumero: numero })));
    const st = estadoDeLoGuardado(await getSetting('onboarding.state'));
    await setSetting('onboarding.state', JSON.stringify({ ...st, status: 'done', completedAt: cuando, completedBy: 'revision' }));
    const dia = diaDelPaso(paso);
    // La llegada y cada marca del recorrido (21/11): el recorrido sin ver; la marca la arranca el motor al llegar.
    if (dia == null) return { destino: destinoDelPaso(paso), vistos: [], salto: saltoDelPaso(paso), avisos };
    await recorridoVistoDelDueno(ws, cuando, avisos);
    const e = estadoRetoEnDia(dia, ahora);
    // Una tarea (21/11): las de hoy antes de ella, «Lo hago después», así es la próxima.
    const hoy = despuesDelPaso(paso);
    if (hoy.length) e.despues = [...(e.despues ?? []), ...hoy];
    await setSetting(CLAVE_RETO, JSON.stringify(e));
    return { destino: destinoDelPaso(paso), vistos: clavesVistasDelReto(e.inicio, dia, paso), salto: saltoDelPaso(paso), avisos };
  });
}
