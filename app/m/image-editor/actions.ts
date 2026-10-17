'use server';

// =============================================================================
// /m/image-editor — crear y borrar un diseño desde el teléfono, por el MISMO camino que escritorio
// =============================================================================
// Escritorio crea y borra por /api/image-editor/disenos (app/image-editor/mako/nube.ts), con el documento en blanco
// armado por el motor de Doory en el navegador. El teléfono no carga el motor en su inicio (es de cliente, y entra
// sólo por ImageEditorCliente: tests/image-editor-integracion.test.ts, contrato 4), así que arma el documento en el
// server con `documentoEnBlanco` (lib/image-editor/reglas.ts), el mismo que usa la API de MaKo para
// `crear_diseno_imagen`, y escribe por lib/image-editor/server.ts: la MISMA puerta (`puerta`: sesión, quién abre el
// editor y el workspace), la MISMA validación del documento y la MISMA tabla.
// No hay capacidad nueva: crear y borrar un diseño ya están en la API de MaKo (lib/api-mako/areas/imagen.*).
// =============================================================================

import { randomUUID } from 'node:crypto';
import { borrarDiseno, crearDiseno, puerta } from '@/lib/image-editor/server';
import { documentoEnBlanco, uuidValido } from '@/lib/image-editor/reglas';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Un diseño en blanco de uno de los tamaños con nombre (TAMANOS_API). Devuelve su id para abrirlo. */
export async function crearDisenoMAction(tamano: string): Promise<Resultado<{ id: string }>> {
  const p = await puerta();
  if (p instanceof Response) return { ok: false, error: 'No se pudo crear el diseño.' };
  const t = Object.hasOwn(TAMANOS_API, tamano) ? TAMANOS_API[tamano] : null;
  if (!t) return { ok: false, error: 'Ese tamaño no existe.' };
  const r = await crearDiseno(p.ws, p.quien, { titulo: 'Diseño sin título', doc: documentoEnBlanco(t.ancho, t.alto, randomUUID()) });
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
}

/** Borra un diseño del workspace (el tacho de escritorio). */
export async function borrarDisenoMAction(id: string): Promise<Resultado<object>> {
  const p = await puerta();
  if (p instanceof Response) return { ok: false, error: 'No se pudo borrar el diseño.' };
  if (!uuidValido(id)) return { ok: false, error: 'Ese diseño no existe.' };
  const r = await borrarDiseno(p.ws, id);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
