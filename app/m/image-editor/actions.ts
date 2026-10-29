'use server';

// =============================================================================
// /m/image-editor — borrar un diseño desde el teléfono, por el MISMO camino que escritorio
// =============================================================================
// Escritorio borra por /api/image-editor/disenos (app/image-editor/mako/nube.ts); el teléfono, por esta acción: la MISMA
// puerta (`puerta`: sesión, quién abre el editor y el workspace) y la MISMA tabla (lib/image-editor/server.ts).
// CREAR no vive acá: es «Nuevo diseño» con las plantillas de «¿Qué vas a crear hoy?», la misma acción que la computadora
// (app/image-editor/actions.ts → `crearDisenoNuevoAction`, con la lista de app/image-editor/plantillas-crear.ts).
// No hay capacidad nueva: crear y borrar un diseño ya están en la API de MaKo (lib/api-mako/areas/imagen.*).
// =============================================================================

import { borrarDiseno, puerta } from '@/lib/image-editor/server';
import { uuidValido } from '@/lib/image-editor/reglas';

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Borra un diseño del workspace (el «Eliminar» del «⋯» de escritorio). */
export async function borrarDisenoMAction(id: string): Promise<Resultado<object>> {
  const p = await puerta();
  if (p instanceof Response) return { ok: false, error: 'No se pudo borrar el diseño.' };
  if (!uuidValido(id)) return { ok: false, error: 'Ese diseño no existe.' };
  const r = await borrarDiseno(p.ws, id);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
