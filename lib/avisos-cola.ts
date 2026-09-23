import 'server-only';

// =============================================================================
// avisos-cola — dónde espera un aviso que no necesitaba interrumpirte
// =============================================================================
// La tabla es la mig 0161. Acá viven las tres operaciones que la tocan, y nada más: la
// decisión de QUÉ puede esperar y el TEXTO del resumen están en `lib/avisos-agrupables.ts`,
// sin `server-only`, para que un test los pueda importar.
//
// ⚠️ ENCOLAR ES ESCRIBIR, NO DESCARTAR. Si el insert falla, el aviso NO se pospone: sale
// por WhatsApp como siempre. Es la diferencia entre «lo dejé para mañana» y «se perdió», y
// la única forma de que un fallo de la base no se lleve puesto un aviso en silencio.
// =============================================================================

import { getTenantDb, runWithWorkspace, listarWorkspaces } from '@/lib/workspace';
import type { AvisoEnCola } from '@/lib/avisos-agrupables';

export type AvisoParaCola = {
  tipo: string;
  titulo: string;
  texto: string;
  categoria?: string;
  semaforo?: string;
  link?: string;
  alDueno?: boolean;
};

/** Guarda el aviso para el resumen. Devuelve false si NO se pudo: ahí sale en el momento. */
export async function encolarAviso(ws: number, a: AvisoParaCola): Promise<boolean> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { error } = await db.from('avisos_cola').insert({
        tipo: a.tipo,
        titulo: a.titulo.slice(0, 300),
        texto: a.texto.slice(0, 4000),
        categoria: a.categoria ?? 'aviso',
        semaforo: a.semaforo ?? 'na',
        link: a.link ?? '',
        al_dueno: !!a.alDueno,
      });
      if (error) { console.error(`[avisos-cola] no pude encolar ${a.tipo} (ws ${ws}): ${error.message}`); return false; }
      return true;
    });
  } catch (e) {
    console.error(`[avisos-cola] encolar ${a.tipo}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

export type PendienteCola = { id: number; wsId: number; alDueno: boolean } & AvisoEnCola;

/**
 * Todo lo que espera, agrupado por workspace Y por canal.
 *
 * ⚠️ SE RECORRE WORKSPACE POR WORKSPACE, y no con una query global. `getTenantDb` scopea
 * TODA consulta por el workspace del contexto, y sin contexto usa `-1`: una lectura «sin
 * scope» no devuelve todo, devuelve NADA. Medido acá mismo: la primera versión encolaba
 * bien y el cron veía la cola vacía. Es el patrón que ya usan los otros crons que iteran
 * inquilinos (objectives-vigilante).
 *
 * El canal entra en la clave porque un mismo workspace puede tener avisos suyos (al grupo
 * del cliente) y avisos de agencia (al grupo del super-admin): juntarlos en un mensaje los
 * mandaría a un solo lado, y la mitad le llegaría a quien no le corresponde.
 */
export async function pendientesDeResumen(): Promise<Map<string, PendienteCola[]>> {
  const out = new Map<string, PendienteCola[]>();
  const workspaces = await listarWorkspaces().catch(() => []);
  for (const w of workspaces) {
    if ((w.estado ?? 'activo') !== 'activo') continue;
    const filas = await runWithWorkspace(w.id, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('avisos_cola')
        .select('id, workspace_id, tipo, titulo, texto, al_dueno, created_at')
        .is('enviado_at', null)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) { console.error(`[avisos-cola] ws ${w.id}: ${error.message}`); return []; }
      return (data ?? []) as Array<Record<string, unknown>>;
    }).catch(() => [] as Array<Record<string, unknown>>);

    for (const r of filas) {
      const alDueno = !!r.al_dueno;
      const clave = `${w.id}:${alDueno ? 'dueno' : 'cliente'}`;
      const lista = out.get(clave) ?? [];
      lista.push({
        id: Number(r.id), wsId: w.id, alDueno,
        tipo: String(r.tipo), titulo: String(r.titulo ?? ''), texto: String(r.texto ?? ''),
        cuando: String(r.created_at ?? '').slice(0, 10),
      });
      out.set(clave, lista);
    }
  }
  return out;
}

/** Marca como enviadas. Se llama DESPUÉS de que el resumen salió de verdad. */
export async function marcarEnviados(ws: number, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { error } = await db.from('avisos_cola').update({ enviado_at: new Date().toISOString() }).in('id', ids);
    if (error) console.error(`[avisos-cola] no pude marcar ${ids.length} como enviados (ws ${ws}): ${error.message}`);
  });
}
