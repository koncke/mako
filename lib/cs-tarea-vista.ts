// =============================================================================
// cs-tarea-vista — el programa + lo que este cliente ya contestó
// =============================================================================
// Junta las dos mitades: el temario, que es igual para todos, y las filas de
// ESTE cliente. Vive aparte de los dos porque la pantalla pública no puede
// importar ninguno de los dos caminos completos: el catálogo no sabe de base y
// la lib de base no sabe del temario.
//
// ⚠️ Corre bajo el workspace DEL SHARE, no del request: quien entra no tiene
// sesión. Por eso recibe `ws` y envuelve la lectura en `runWithWorkspace`.

import 'server-only';
import { runWithWorkspace, getTenantDb } from './workspace';
import { PROGRAMA } from './programa-catalogo';
import { camposDe, type Campo } from './programa-campos';
import { faltantes, type Valores } from './cs-valores';
import { bloquesDeCliente, type Bloque } from './cs-respuestas';

export type EstadoBloque = Bloque['estado'];

export type ClaseVista = {
  claseId: string;
  /** «4.2» */
  numero: string;
  titulo: string;
  /** La línea que resume el bloque. Se muestra antes de las preguntas. */
  pregunta: string;
  atoro: string | null;
  campos: Campo[];
  valores: Valores;
  /** Lo que MaKo propuso después de la junta. */
  respuestaIa: string | null;
  /** Lo que quedó guardado como respuesta final, legible. */
  respuesta: string;
  estado: EstadoBloque;
  /** Obligatorias sin contestar. Es lo que le dice cuánto le queda. */
  faltan: number;
  vista: boolean;
};

export type ModuloVista = {
  moduloId: string;
  numero: number;
  titulo: string;
  /** El líder del área contesta los umbrales, no el dueño. */
  loContestaElLider: boolean;
  porArea: boolean;
  clases: ClaseVista[];
};

export async function vistaDeTarea(ws: number, leadId: number): Promise<{
  modulos: ModuloVista[];
  /** Cuál abrir: el que espera su ok gana, después el primero sin terminar. */
  inicial: string;
  nombre: string | null;
  /** Para el marcador de arriba. */
  totales: { clases: number; listas: number; esperandoSuOk: number };
}> {
  return runWithWorkspace(ws, async () => {
    const filas = await bloquesDeCliente(leadId).catch(() => [] as Bloque[]);
    // La clave incluye el área porque los módulos 6 a 9 se repiten por área. Hoy
    // la pantalla muestra la vuelta sin área (''), que es la que existe siempre.
    const porClase = new Map(filas.filter(f => !f.area).map(f => [f.clase_id, f]));

    const modulos: ModuloVista[] = PROGRAMA.map(m => ({
      moduloId: m.id,
      numero: m.numero,
      titulo: m.titulo,
      loContestaElLider: m.quien === 'líder de área',
      porArea: Boolean(m.porArea),
      clases: m.clases.map((c, i) => {
        const f = porClase.get(c.id);
        const valores = (f?.valores ?? {}) as Valores;
        return {
          claseId: c.id,
          numero: `${m.numero}.${i + 1}`,
          titulo: c.titulo,
          pregunta: c.pregunta,
          atoro: c.atoro ?? null,
          campos: camposDe(c.id),
          valores,
          respuestaIa: f?.respuesta_ia ?? null,
          respuesta: f?.respuesta ?? '',
          estado: f?.estado ?? 'pendiente',
          faltan: faltantes(c.id, valores).length,
          vista: Boolean(f?.visto_at),
        } satisfies ClaseVista;
      }),
    }));

    const todas = modulos.flatMap(m => m.clases);
    const inicial =
      todas.find(c => c.estado === 'revisada_ia')?.claseId
      ?? todas.find(c => c.estado === 'pendiente')?.claseId
      ?? todas[0]?.claseId
      ?? '';

    return {
      modulos,
      inicial,
      nombre: await nombreDelCliente(leadId),
      totales: {
        clases: todas.length,
        listas: todas.filter(c => c.estado === 'aprobada').length,
        esperandoSuOk: todas.filter(c => c.estado === 'revisada_ia').length,
      },
    };
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
