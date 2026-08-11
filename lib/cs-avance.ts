// =============================================================================
// cs-avance — de un evento de Whop a una fila de este cliente
// =============================================================================
// El webhook trae dos ids de Whop (`less_…` y `user_…`) y nada más. Para que eso
// sirva hay que cruzarlo con dos cosas nuestras: qué CLASE del programa es esa
// lección, y qué CLIENTE es ese usuario.
//
// Los dos cruces fallan distinto y por eso se resuelven distinto:
//
//   lección → clase   Se guarda un mapa al cargar el programa (es el único
//                     momento en que se conocen las dos puntas). Si falta, se le
//                     pregunta a Whop por el título y se hace match contra el
//                     catálogo: el mapa se auto-repara y no hay que recargar
//                     nada a mano.
//   usuario → cliente Por email contra el CRM. Acá NO hay auto-reparación
//                     posible: si el cliente compró en Whop con otro mail que el
//                     que tiene en el CRM, no hay forma de adivinarlo. Se
//                     devuelve el motivo para que se vea, en vez de descartar en
//                     silencio.
//
// ⚠️ COMPLETAR LA CLASE NO ES CONTESTAR LA TAREA. Esto escribe `visto_at` y NADA
// más. El estado del bloque lo mueve el cliente cuando contesta. Confundirlos
// borraría el estado que dispara el recordatorio: «la vio y no la contestó».

import 'server-only';
import { getTenantDb } from './workspace';
import { getSetting, setSetting } from './settings';
import { CLASES, rotuloDe } from './programa-catalogo';
import { listarCursos, listarCapitulos, listarLecciones } from './whop';

const KEY_MAPA = 'mako.whop.lecciones';

export type MapaLecciones = Record<string, string>; // leccionId → claseId

export async function getMapaLecciones(): Promise<MapaLecciones> {
  const raw = await getSetting(KEY_MAPA);
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === 'object' ? (j as MapaLecciones) : {};
  } catch { return {}; }
}

export async function guardarMapaLecciones(mapa: MapaLecciones): Promise<void> {
  await setSetting(KEY_MAPA, JSON.stringify(mapa));
}

// El título de una lección lo arma `rotuloDe` en lib/programa-catalogo.ts, y
// NADIE lo escribe de nuevo. El cargador lo usa para crear la lección y esto
// para reconocerla: si fueran dos plantillas, bastaría un espacio de diferencia
// para que la reconstrucción del mapa devolviera {} sin un solo error.

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Reconstruye el mapa preguntándole a Whop, y lo guarda. Es lo que hace que un
 * mapa perdido (o un curso recargado) no exija tocar nada a mano.
 *
 * Se llama solo cuando una lección desconocida llega por webhook, no en cada
 * evento: recorrer 12 capítulos son 13 requests a Whop.
 */
export async function reconstruirMapa(ws?: number): Promise<MapaLecciones> {
  const cursos = await listarCursos(ws);
  if (!cursos.ok) return {};
  const porTitulo = new Map(CLASES.map(c => [norm(rotuloDe(c.clase.id)), c.clase.id]));
  const mapa: MapaLecciones = {};

  for (const curso of cursos.data) {
    const caps = await listarCapitulos(curso.id, ws);
    if (!caps.ok) continue;
    for (const cap of caps.data) {
      const lecs = await listarLecciones(cap.id, ws);
      if (!lecs.ok) continue;
      for (const l of lecs.data) {
        const claseId = porTitulo.get(norm(l.title));
        if (claseId) mapa[l.id] = claseId;
      }
    }
  }
  if (Object.keys(mapa).length) await guardarMapaLecciones(mapa);
  return mapa;
}

export type ResultadoAvance =
  | { ok: true; claseId: string; leadId: number }
  | { ok: false; motivo: 'leccion-desconocida' | 'cliente-desconocido' };

/**
 * Anota que este cliente completó esta clase.
 *
 * Corre SIEMPRE dentro de `runWithWorkspace` (el webhook no tiene sesión, y sin
 * el contexto `getTenantDb()` no estampa el workspace_id).
 */
export async function registrarAvanceDeClase(input: {
  ws: number;
  leccionId: string;
  userId: string | null;
  email: string | null;
}): Promise<ResultadoAvance> {
  // 1. Lección → clase, con auto-reparación.
  let mapa = await getMapaLecciones();
  let claseId = mapa[input.leccionId];
  if (!claseId) {
    mapa = await reconstruirMapa(input.ws);
    claseId = mapa[input.leccionId];
  }
  if (!claseId) return { ok: false, motivo: 'leccion-desconocida' };

  // 2. Usuario de Whop → lead del CRM, por email.
  const leadId = await leadDeAlumno(input.email);
  if (!leadId) return { ok: false, motivo: 'cliente-desconocido' };

  // 3. Solo `visto_at`. El estado lo mueve el cliente al contestar.
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  await db.from('cs_respuestas').upsert(
    { lead_id: leadId, clase_id: claseId, area: '', visto_at: ahora, updated_at: ahora },
    { onConflict: 'workspace_id,lead_id,clase_id,area' },
  );
  return { ok: true, claseId, leadId };
}

/** El lead de este alumno, o null. Devuelve null en vez de adivinar: adivinar mal
 *  acá le escribe avance a OTRO cliente. */
async function leadDeAlumno(email: string | null): Promise<number | null> {
  if (!email || !email.includes('@')) return null;
  const db = await getTenantDb();
  const { data } = await db.from('leads').select('id').ilike('email', email.trim()).limit(1).maybeSingle();
  return (data as { id?: number } | null)?.id ?? null;
}
