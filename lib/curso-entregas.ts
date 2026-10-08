import 'server-only';

// =============================================================================
// curso-entregas — lo que el alumno ENTREGA (archivos, grabaciones) y la nota de sus quizzes
// =============================================================================
// Pedido de Martín (07/10/2026, item 18 del curso tipo Skool): «Piensa en qué otras tareas se podría
// pedir aparte de formularios e impleméntalas». Los tipos nuevos de campo viven en lib/curso.ts
// (`CampoTipo`), con su saneo, su «está completo» y la corrección del quiz, todo PURO y con test
// (tests/curso-tareas-tipos.test.ts). Acá está sólo lo que toca la base y Storage. Bucket y columna:
// supabase/migrations/0218_curso_entregas.sql.
//
// Lo usan dos rutas del portal del alumno, SIN sesión y siempre adentro de
// `runWithWorkspace(firma.ws, …)` después de `resolverAccesoPortal` (el workspace sale de la FIRMA
// del link, nunca del pedido):
//   · /api/compartido/curso/entrega — firma la subida de un archivo y el link para volver a verlo.
//   · /api/compartido/curso/tarea   — verifica las entregas antes de guardar, corrige el quiz y, si
//     aprueba, deja la tarea aprobada sola.
// Y el EQUIPO, con su sesión, para abrir lo que entregó un cliente (`urlEntregaParaEquipo`) y para
// darle otro intento a un quiz (`darOtroIntento`): esas dos esperan su action en
// app/customer-success/curso-ficha-actions.ts.
//
// ⚠️ EL ARCHIVO NO PASA POR EL SERVER, igual que el video del curso (lib/curso-admin.ts, `urlSubida`):
// el navegador lo sube directo al bucket con una URL firmada (una ruta que reciba el archivo topa en
// 1 MB). Al guardar la tarea se verifica que el path sea de ESE alumno y ESA clase (`pathEsDeEntrega`)
// y que el archivo haya llegado (`exists`), y recién ahí queda en `valores`.
//
// ⚠️ NO MODIFICA `guardarTarea` (lib/curso-datos.ts): lo que hay que hacer antes (verificar) o
// después (anotar la nota, aprobar sola) va acá, y lo llama la ruta alrededor de aquella.

import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import {
  archivosDeValor, esCampoDeArchivo, leerCalificacion, pathDeEntrega, pathsDeEntregas, pathEsDelCliente,
  pathEsDeEntrega, nombreDeEntrega, mimesDeCampo, topeDeSubidasAlcanzado, TOPE_ENTREGA_BYTES,
  type Calificacion, type Campo, type DuenoEntrega, type EstadoTarea, type SubidaHecha, type Valores,
} from './curso';

/** El bucket privado de la mig 0218. */
export const BUCKET_ENTREGAS = 'curso-entregas';

/**
 * Cuánto vive el link para VER una entrega. No son los 120 s de un adjunto de nota: una grabación se
 * escucha o se mira entera, y el `<audio>`/`<video>` pide rangos a medida que avanza contra esa URL.
 * Diez minutos cubren el tope de una grabación (`MAX_SEG_MAX`) con pausas.
 */
const VIDA_VER_SEG = 600;

type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

/** Lo que se abre en el navegador; lo demás (una planilla, un Word) se baja con su nombre original. */
const SE_VE = /\.(pdf|png|jpg|webp|gif|txt|weba|ogg|m4a|mp3|wav|aac|webm|mp4|mov)$/i;

// ── La subida ─────────────────────────────────────────────────────────────────

/** Lo que se le dice al alumno cuando la falla es nuestra (Storage): corto y sin el detalle técnico. */
const NO_SE_PUDO_SUBIR = 'No se pudo preparar la subida.';

/**
 * Lo que este alumno ya subió a las entregas de ESTE programa, de todas sus clases, leído del bucket
 * (`<ws>/<producto>/<lead>/<clase>/…`, ver `pathDeEntrega`). `null` = no se pudo leer entero.
 *
 * ⚠️ FAIL-CLOSED: con un listado a medias no se sabe cuánto subió, y «no pude contar» no es «subió
 * poco». Quien llama no firma (`urlSubidaEntrega`). Es el mismo Storage que recibiría la subida: si no
 * contesta el listado, tampoco iba a andar la subida.
 */
async function subidasDelAlumno(d: DuenoEntrega): Promise<SubidaHecha[] | null> {
  try {
    const st = getSupabaseServer().storage.from(BUCKET_ENTREGAS);
    const base = `${d.ws}/${d.productoId}/${d.leadId}`;
    const { data: carpetas, error } = await st.list(base, { limit: 1000 });
    if (error || !carpetas) {
      console.error('[curso-entregas] no pude listar lo que subió un alumno:', error?.message ?? 'sin datos');
      return null;
    }
    // Sin `id` es una carpeta (una clase); con `id`, un archivo suelto que no debería estar acá y
    // cuenta igual.
    const out: SubidaHecha[] = [];
    const clases: string[] = [];
    for (const it of carpetas) {
      if (it.id) out.push({ creado: it.created_at ?? null, bytes: Number(it.metadata?.size) || null });
      else if (/^\d{1,12}$/.test(it.name)) clases.push(it.name);
    }
    // Las más nuevas primero: si una carpeta pasara de 1000 objetos (sólo un abuso llega ahí), lo
    // que se cuenta es lo de hoy.
    const listas = await Promise.all(clases.map((c) => st.list(`${base}/${c}`, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })));
    for (const { data, error: e } of listas) {
      if (e || !data) {
        console.error('[curso-entregas] no pude listar una carpeta de entregas:', e?.message ?? 'sin datos');
        return null;
      }
      for (const it of data) if (it.id) out.push({ creado: it.created_at ?? null, bytes: Number(it.metadata?.size) || null });
    }
    return out;
  } catch (e) {
    console.error('[curso-entregas] no pude contar lo que subió un alumno:', msg(e, String(e)));
    return null;
  }
}

/**
 * La URL firmada para que el NAVEGADOR del alumno suba UNA entrega directo al bucket. El mismo pedido
 * que el de los videos del curso: PUT multipart a `signedUrl`, que vale 2 h.
 *
 * ⚠️ EL DUEÑO (workspace, producto, alumno, clase) LO ARMA LA RUTA desde la firma y desde
 * `claseDelAlumno`, nunca el pedido. El tipo y el tamaño sí llegan del navegador: se validan contra
 * lo que acepta el CAMPO (un `audio` no se contesta con un PDF) y contra el tope del bucket.
 *
 * ⚠️ Y ANTES DE FIRMAR SE CUENTA LO QUE YA SUBIÓ HOY (`topeDeSubidasAlcanzado`, lib/curso.ts): la
 * ruta es pública y cada firma es un archivo de hasta 100 MB en un Storage de 5 GiB para toda la
 * plataforma. Revisión del 08/10/2026: sin esto, un solo link llenaba el Storage en dos minutos.
 *
 * ⚠️ LOS ERRORES DE STORAGE NO VIAJAN AL ALUMNO: llegaban crudos a su pantalla (en inglés y técnicos,
 * «Bucket not found»). Se anotan en el log y él lee `NO_SE_PUDO_SUBIR`.
 */
export async function urlSubidaEntrega(
  dueno: DuenoEntrega, campo: Pick<Campo, 'tipo'>, mime: string, bytes: number,
): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>> {
  try {
    if (!esCampoDeArchivo(campo.tipo)) return { ok: false, error: 'Ese campo no recibe archivos.' };
    if (!mimesDeCampo(campo.tipo).includes(mime)) return { ok: false, error: 'Ese formato no va.' };
    if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: 'El archivo está vacío.' };
    if (bytes > TOPE_ENTREGA_BYTES) return { ok: false, error: 'Pasa de 100 MB.' };
    const path = pathDeEntrega(dueno, mime, randomUUID());
    if (!path) return { ok: false, error: NO_SE_PUDO_SUBIR };
    const hechas = await subidasDelAlumno(dueno);
    if (!hechas) return { ok: false, error: NO_SE_PUDO_SUBIR };
    if (topeDeSubidasAlcanzado(hechas, Date.now())) return { ok: false, error: 'Llegaste al tope de hoy.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_ENTREGAS).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[curso-entregas] no pude firmar una subida:', error?.message ?? 'sin datos');
      return { ok: false, error: NO_SE_PUDO_SUBIR };
    }
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    console.error('[curso-entregas] no pude preparar una subida:', msg(e, String(e)));
    return { ok: false, error: NO_SE_PUDO_SUBIR };
  }
}

/** El link de vida corta para ver o bajar una entrega cuyo path YA se validó. `null` = no se pudo. */
async function firmarVer(path: string, nombre: unknown): Promise<string | null> {
  const opciones = SE_VE.test(path) ? undefined : { download: nombreDeEntrega(nombre) };
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_ENTREGAS).createSignedUrl(path, VIDA_VER_SEG, opciones);
  if (error || !data) {
    console.warn('[curso-entregas] no pude firmar el link de una entrega:', error?.message ?? 'sin datos');
    return null;
  }
  return data.signedUrl;
}

/**
 * El link para que el ALUMNO vuelva a ver lo que entregó en ESTA clase. Sólo si el path es suyo y de
 * esta clase (`pathEsDeEntrega`): el path viaja desde su navegador.
 */
export async function urlVerEntrega(dueno: DuenoEntrega, path: unknown, nombre: unknown): Promise<Resultado<{ url: string }>> {
  if (!pathEsDeEntrega(path, dueno)) return { ok: false, error: 'Ese archivo no es de esta tarea.' };
  const url = await firmarVer(path as string, nombre);
  return url ? { ok: true, url } : { ok: false, error: 'No pude abrir el archivo.' };
}

/**
 * El link para que el EQUIPO abra lo que entregó un cliente. Corre con la SESIÓN (la action que lo
 * llame pasa antes por la puerta de la ficha): el workspace sale de `getWorkspaceActual`, y el path
 * tiene que ser de ese workspace y de ESE cliente (`pathEsDelCliente`).
 */
export async function urlEntregaParaEquipo(leadId: number, path: unknown, nombre: unknown): Promise<Resultado<{ url: string }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws || !pathEsDelCliente(path, ws, leadId)) return { ok: false, error: 'Ese archivo no es de este cliente.' };
    const url = await firmarVer(path as string, nombre);
    return url ? { ok: true, url } : { ok: false, error: 'No pude abrir el archivo.' };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude abrir el archivo.') };
  }
}

// ── Lo que ya estaba guardado ────────────────────────────────────────────────

export type EntregaGuardada = { estado: EstadoTarea; valores: Valores; calificacion: Calificacion | null };

/**
 * La respuesta guardada de una tarea (de un área, o la del cliente con `''`). `null` = nunca la tocó.
 * Tira si no puede leer: la ruta decide (y un «no pude leer» no puede tomarse como «no hay nada»,
 * porque con eso se volvería a cobrar un intento de quiz o se volvería a preguntar a Storage).
 *
 * `conCalificacion`: sólo cuando la clase tiene un quiz. Así una tarea sin quiz no depende de la
 * columna de la 0218.
 */
export async function leerEntrega(leadId: number, claseId: number, area: string, conCalificacion: boolean): Promise<EntregaGuardada | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_progreso')
    .select(conCalificacion ? 'estado, valores, calificacion' : 'estado, valores')
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const f = data as unknown as { estado: EstadoTarea; valores: Valores | null; calificacion?: unknown };
  return { estado: f.estado, valores: f.valores ?? {}, calificacion: leerCalificacion(f.calificacion) };
}

/**
 * Las entregas que trae un guardado, VERIFICADAS: de este alumno y esta clase, y que hayan llegado
 * al bucket. Devuelve lo que llegó con las listas de archivos limpias (lo demás, intacto: lo sanea
 * `guardarTarea`) y cuántas se tiraron.
 *
 *   · Un path que no es de ESTE alumno en ESTA clase se tira SIEMPRE (`archivosDeValor` con dueño):
 *     es un pedido armado a mano que nombra la entrega de otro.
 *   · Uno que ya estaba guardado no se vuelve a preguntar: ya se verificó cuando entró, y el
 *     autoguardado manda la tarea cada pocos segundos.
 *   · Uno NUEVO se pregunta a Storage (`exists`): la subida se pudo cortar. Si NO está, se tira y se
 *     cuenta (la pantalla dice que hay que subirlo de nuevo). Si Storage no contesta, se CONSERVA: el
 *     path ya es de él, y tirarle un archivo bueno por un bache nuestro es peor que guardar uno que
 *     quizás no terminó (que el equipo ve como «no abre»).
 */
export async function verificarEntregas(
  campos: readonly Campo[], raw: unknown, dueno: DuenoEntrega, guardados: Valores | null,
): Promise<{ valores: unknown; descartados: number }> {
  const deArchivo = campos.filter((c) => esCampoDeArchivo(c.tipo));
  if (!deArchivo.length || !raw || typeof raw !== 'object' || Array.isArray(raw)) return { valores: raw, descartados: 0 };
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const yaEstaban = new Set(pathsDeEntregas(guardados));
  const sb = getSupabaseServer();
  let descartados = 0;
  for (const c of deArchivo) {
    const v = out[c.id];
    if (!Array.isArray(v)) continue;
    const suyos = archivosDeValor(c, v, dueno);
    descartados += v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).length - suyos.length;
    const llegaron = await Promise.all(suyos.map(async (a) => {
      if (yaEstaban.has(a.path)) return true;
      // `exists` contesta `data: false` SÓLO ante un 400/404 (leído en @supabase/storage-js, 07/10/2026:
      // «no está»); cualquier otra falla la TIRA, y eso es «no pude preguntar», no «no está».
      try {
        const { data } = await sb.storage.from(BUCKET_ENTREGAS).exists(a.path);
        return data === true;
      } catch (e) {
        console.warn('[curso-entregas] Storage no contestó si llegó una entrega; la conservo:', msg(e, String(e)));
        return true;
      }
    }));
    const quedan = suyos.filter((_, i) => llegaron[i]);
    descartados += suyos.length - quedan.length;
    out[c.id] = quedan;
  }
  return { valores: out, descartados: Math.max(0, descartados) };
}

// ── El quiz ───────────────────────────────────────────────────────────────────

/**
 * Anota la nota de los quizzes de una respuesta. Va DESPUÉS de `guardarTarea` (que crea la fila si no
 * existía). No tira: la respuesta ya está guardada, y si esto falla lo peor es un intento que no se
 * contó (el alumno vuelve a enviar y se vuelve a corregir). Devuelve si quedó escrita.
 */
export async function registrarCalificacion(leadId: number, claseId: number, area: string, calificacion: Calificacion): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_progreso').update({ calificacion })
      .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area).select('clase_id');
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  } catch (e) {
    console.error('[curso-entregas] la tarea se guardó y la nota del quiz NO:', msg(e, String(e)));
    return false;
  }
}

/**
 * La tarea con el quiz aprobado queda APROBADA sola (la regla de cuándo es `seApruebaSola`, en
 * lib/curso.ts; esto sólo escribe). Sólo sobre la fila de ESTA área y sólo si quedó `enviada`:
 * compare-and-set en el WHERE, así un «Marcar revisada» del equipo en el medio no se pisa.
 * `true` = quedó aprobada. No tira: la tarea ya quedó enviada, que es lo que cierra la etapa.
 */
export async function aprobarSola(leadId: number, claseId: number, area: string): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_progreso')
      .update({ estado: 'aprobada', aprobada_at: new Date().toISOString() })
      .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area).eq('estado', 'enviada')
      .select('clase_id');
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  } catch (e) {
    console.error('[curso-entregas] el quiz aprobó y la tarea no quedó aprobada sola:', msg(e, String(e)));
    return false;
  }
}

/**
 * El EQUIPO le da otro intento a un quiz que se quedó sin intentos: vuelve a cero los usados de ESE
 * quiz y conserva la nota (para que se vea en qué quedó). Corre con la sesión: la action que lo llame
 * pasa antes por la puerta de la ficha. `false` = no había nada que destrabar.
 */
export async function darOtroIntento(leadId: number, claseId: number, area: string, campoId: string): Promise<boolean> {
  const previa = await leerEntrega(leadId, claseId, area, true);
  const nota = previa?.calificacion?.[campoId];
  if (!previa || !nota || nota.aprobado) return false;
  const calificacion: Calificacion = { ...previa.calificacion, [campoId]: { ...nota, intentos: 0 } };
  const db = await getTenantDb();
  const { error } = await db.from('curso_progreso').update({ calificacion })
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area);
  if (error) throw new Error(error.message);
  return true;
}
