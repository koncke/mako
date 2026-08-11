// =============================================================================
// cs-tarea-vista — el programa + lo que este cliente ya contestó, en una lista
// =============================================================================
// Junta las dos mitades: el temario, que es igual para todos
// (`lib/programa-catalogo.ts`), y las filas de ESTE cliente (`cs_respuestas`).
// Vive aparte de los dos porque la pantalla pública no puede importar ninguno de
// los dos caminos completos: el catálogo no sabe de base y la lib de base no
// sabe del temario.
//
// ⚠️ Corre bajo el workspace DEL SHARE, no del request: quien entra no tiene
// sesión. Por eso recibe `ws` y envuelve la lectura en `runWithWorkspace`.

import 'server-only';
import { runWithWorkspace, getTenantDb } from './workspace';
import { PROGRAMA, rotuloDe } from './programa-catalogo';
import { bloquesDeCliente, type Bloque } from './cs-respuestas';

export type BloqueVista = {
  claseId: string;
  rotulo: string;
  modulo: string;
  pregunta: string;
  atoro?: string;
  quienContesta: string;
  respuesta: string;
  respuestaIa: string | null;
  estado: Bloque['estado'];
};

export async function vistaDeTarea(ws: number, leadId: number): Promise<{
  bloques: BloqueVista[];
  /** Cuál abrir: el que espera aprobación gana, después el primero sin contestar. */
  inicial: string;
  nombre: string | null;
}> {
  return runWithWorkspace(ws, async () => {
    const filas = await bloquesDeCliente(leadId).catch(() => [] as Bloque[]);
    // La clave incluye el área porque los módulos 6 a 9 se repiten por área. Hoy
    // la pantalla muestra la vuelta sin área (''), que es la que existe siempre.
    const porClase = new Map(filas.filter(f => !f.area).map(f => [f.clase_id, f]));

    const bloques: BloqueVista[] = PROGRAMA.flatMap(m =>
      m.clases.map(c => {
        const f = porClase.get(c.id);
        return {
          claseId: c.id,
          rotulo: rotuloDe(c.id),
          modulo: `Módulo ${m.numero} · ${m.titulo}`,
          pregunta: c.pregunta,
          atoro: c.atoro,
          quienContesta: m.quien,
          respuesta: f?.respuesta ?? '',
          respuestaIa: f?.respuesta_ia ?? null,
          estado: f?.estado ?? 'pendiente',
        };
      }),
    );

    // Lo que espera SU ok va primero: es lo único que está frenado esperándolo.
    const inicial =
      bloques.find(b => b.estado === 'revisada_ia')?.claseId
      ?? bloques.find(b => b.estado === 'pendiente')?.claseId
      ?? bloques[0]?.claseId
      ?? '';

    const nombre = await nombreDelCliente(leadId);
    return { bloques, inicial, nombre };
  });
}

/** El nombre para saludar. Si no está, se saluda sin nombre: mejor eso que un
 *  «Hola undefined» o un id. */
async function nombreDelCliente(leadId: number): Promise<string | null> {
  try {
    const db = await getTenantDb();
    const { data } = await db.from('leads').select('nombre').eq('id', leadId).maybeSingle();
    const n = (data as { nombre?: string | null } | null)?.nombre?.trim();
    return n || null;
  } catch { return null; }
}
