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
  let falloAlgo = false;

  for (const curso of cursos.data) {
    const caps = await listarCapitulos(curso.id, ws);
    if (!caps.ok) { falloAlgo = true; continue; }
    for (const cap of caps.data) {
      const lecs = await listarLecciones(cap.id, ws);
      if (!lecs.ok) { falloAlgo = true; continue; }
      for (const l of lecs.data) {
        const claseId = porTitulo.get(norm(l.title));
        if (claseId) mapa[l.id] = claseId;
      }
    }
  }

  // ⚠️ UNA RECONSTRUCCIÓN A MEDIAS NO PISA UNA BUENA.
  // Son ~14 requests a Whop; un 429 a mitad de la tanda dejaba un mapa con la
  // mitad de las lecciones, y se guardaba igual «con tal de que haya matcheado
  // alguna». El efecto: las clases del tramo que falló pasaban a contestar
  // «lección desconocida» para siempre, y cada evento suyo disparaba OTRA
  // reconstrucción — la tormenta se alimenta sola.
  const previo = await getMapaLecciones();
  const completo = Object.keys(mapa).length;
  if (falloAlgo && completo <= Object.keys(previo).length) {
    console.warn(`[cs-avance] reconstrucción parcial (${completo} de ${Object.keys(previo).length} conocidas): NO se guarda`);
    return previo;
  }
  if (completo) await guardarMapaLecciones(mapa);
  return mapa;
}

/** Cuándo se reconstruyó por última vez, para no hacerlo en cada evento.
 *
 *  Sin esto, una lección que de verdad no está en el mapa —una que Mauricio
 *  agregó a mano en Whop, por ejemplo— dispara 14 requests sincrónicos DENTRO
 *  del handler del webhook, en CADA evento suyo. Con un alumno mirando cinco
 *  clases seguidas son 70 requests y cinco webhooks al borde del timeout.
 *
 *  Es memoria del proceso y no base a propósito: el peor caso de perderlo es
 *  una reconstrucción de más, no un dato mal. */
const ultimaReconstruccion = new Map<number, number>();
const ESPERA_RECONSTRUIR = 10 * 60 * 1000;

async function reconstruirConFreno(ws: number): Promise<MapaLecciones> {
  const ultima = ultimaReconstruccion.get(ws) ?? 0;
  if (Date.now() - ultima < ESPERA_RECONSTRUIR) return getMapaLecciones();
  ultimaReconstruccion.set(ws, Date.now());
  return reconstruirMapa(ws);
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
  email: string | null;
  /** Cuándo la completó DE VERDAD. El webhook no lo pasa (se dispara al completar,
   *  así que «ahora» es esa hora); el backfill SÍ, con el `completed_at` que da
   *  Whop — si no, estamparía todo lo anterior con la fecha del día del backfill. */
  vistoAt?: string;
}): Promise<ResultadoAvance> {
  // 1. Lección → clase, con auto-reparación.
  let mapa = await getMapaLecciones();
  let claseId = mapa[input.leccionId];
  if (!claseId) {
    mapa = await reconstruirConFreno(input.ws);
    claseId = mapa[input.leccionId];
  }
  if (!claseId) return { ok: false, motivo: 'leccion-desconocida' };

  // 2. Usuario de Whop → lead del CRM, por email.
  const leadId = await leadDeAlumno(input.email);
  if (!leadId) return { ok: false, motivo: 'cliente-desconocido' };

  // 3. Solo `visto_at`. El estado lo mueve el cliente al contestar.
  await anotarVisto(leadId, claseId, input.vistoAt ?? new Date().toISOString());
  return { ok: true, claseId, leadId };
}

/**
 * Anota que un cliente vio una clase, sin retroceder nunca la fecha.
 *
 * ⚠️ LA ESCRITURA SE COMPRUEBA, Y SI FALLA SE LANZA. supabase-js NO lanza ante un
 * error de base: lo devuelve en `{ error }`. Esto hacía el upsert y no lo miraba,
 * así que `registrarAvanceDeClase` contestaba `{ ok: true, clase, lead }` pasara lo
 * que pasara — y esa respuesta es exactamente la que se tomó como prueba de que el
 * camino andaba («probado con un evento real: m7c1, lead 91»). Probaba el CRUCE de
 * ids, no la escritura. Al ir a verlo el 17/09, `cs_respuestas` tenía cero filas.
 *
 * Y el webhook ya estaba preparado para esto: su `catch` devuelve 500 «a propósito:
 * acá SÍ queremos el reintento de Whop». Pero para llegar al catch hay que lanzar,
 * y un `{ error }` ignorado no lanza. El camino de reintento existía y estaba muerto.
 *
 * ⚠️ Y LA FECHA NO RETROCEDE: «vio la clase» es la PRIMERA vez. Un repaso un mes
 * después volvía a disparar el webhook y movía la fecha hacia adelante; peor, un
 * backfill de lo viejo corriendo después de un webhook nuevo la habría pisado con
 * una más reciente. Se escribe solo si no había fecha o si la nueva es anterior.
 */
export async function anotarVisto(leadId: number, claseId: string, vistoAt: string): Promise<'nuevo' | 'antes' | 'igual'> {
  const db = await getTenantDb();
  const { data: prev, error: errLeer } = await db.from('cs_respuestas')
    .select('visto_at').eq('lead_id', leadId).eq('clase_id', claseId).eq('area', '').maybeSingle();
  if (errLeer) throw new Error(`no pude leer cs_respuestas: ${errLeer.message}`);

  const actual = (prev as { visto_at?: string | null } | null)?.visto_at ?? null;
  if (actual && actual <= vistoAt) return 'igual';

  const { error } = await db.from('cs_respuestas').upsert(
    { lead_id: leadId, clase_id: claseId, area: '', visto_at: vistoAt, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,lead_id,clase_id,area' },
  );
  if (error) throw new Error(`no pude anotar visto_at: ${error.message}`);
  return actual ? 'antes' : 'nuevo';
}

/** El lead de este alumno, o null. Devuelve null en vez de adivinar: adivinar mal
 *  acá le escribe avance a OTRO cliente. */
export async function leadDeAlumno(email: string | null): Promise<number | null> {
  if (!email || !email.includes('@')) return null;
  const db = await getTenantDb();
  // ⚠️ `ilike` es un PATRÓN, no una igualdad sin mayúsculas: `_` es «cualquier
  // carácter» y `%` es «cualquier cosa». Pasado crudo, `juan_perez@x.com` también
  // matchea `juanXperez@x.com` — y `_` es de lo más común en un email. El comentario
  // de arriba lo dice: adivinar mal acá le escribe avance a OTRO cliente. Se escapan
  // los tres comodines (la barra primero, que es el carácter de escape).
  const literal = email.trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const { data } = await db.from('leads').select('id, estado_lead').ilike('email', literal).limit(10);
  const filas = (data as { id: number; estado_lead: string | null }[] | null) ?? [];
  if (filas.length === 1) return filas[0].id;
  // Varios leads con el mismo email pasa —un lead que volvió a entrar por otro
  // formulario—. El programa lo cursa un CLIENTE, así que si exactamente uno es
  // `ganado`, es ése. Si no hay ninguno o hay varios, no se elige: es la misma regla
  // que el mapa de lecciones, y la contraria le carga el avance al primero que salga.
  const ganados = filas.filter((f) => f.estado_lead === 'ganado');
  return ganados.length === 1 ? ganados[0].id : null;
}
