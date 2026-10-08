import 'server-only';

// =============================================================================
// curso-purga — barre los archivos HUÉRFANOS de los buckets del curso
// =============================================================================
// Los videos del curso (`curso-videos`, mig 0202) y los adjuntos de las notas (`curso-notas`,
// mig 0208) los sube el navegador directo al bucket con una URL firmada, y recién después se
// guardan en una fila. El editor descarta lo que se subió y no se guardó — pero sólo con eventos
// del editor (guardar con otro, cerrar, desmontar). Si se cierra la pestaña o se cae la red a
// mitad, el archivo queda en el bucket sin que ninguna fila lo nombre: hasta 2 GiB por video, en
// un Storage con 5 GiB de tope para TODA la plataforma (lib/curso-admin.ts, `descartarVideo`).
// Lo corre el cron diario /api/cron/curso-purga.
//
// ⚠️ POR DEFAULT NO BORRA: CUENTA. Sin `borrar: true` devuelve los candidatos, cuántos son y
// cuánto pesan, y no toca el bucket. El contenido de los dos buckets nunca se midió, así que lo
// primero que hace en producción es el modo prueba: se lee la salida y recién ahí se prende
// (`pideBorrarPurga`, app/customer-success/curso/reglas.ts: `?borrar=1` a mano, o
// `CURSO_PURGA_BORRAR=1` para el cron diario).
//
// ⚠️ Y CUANDO BORRA, BORRA DE VERDAD, y por eso es FAIL-CLOSED en cada paso. La regla de qué se borra es pura y
// tiene test (`decidirPurga` / `huerfanosABorrar`, app/customer-success/curso/reglas.ts); acá
// sólo se junta lo que esa regla necesita, y ante cualquier duda no se borra nada:
//   · si el listado del bucket falla en cualquier carpeta, no se sigue (un listado a medias no
//     borra de más, pero un bucket que no se pudo leer es una vuelta que no se entiende);
//   · si la lectura de las filas falla, o vuelve VACÍA con archivos en el bucket, no se borra;
//   · y justo antes de borrar se vuelve a preguntar por los candidatos: una fila que se guardó
//     entre la lectura y el borrado los salva.
//
// ⚠️ LA LECTURA ES DE TODOS LOS WORKSPACES, con el cliente de servicio y SIN `getTenantDb()`: el
// bucket es uno solo para toda la plataforma, y cruzarlo contra las filas de un inquilino
// declararía huérfanos los videos de todos los demás. Es la única lectura cruzada de esta área,
// y es a propósito: no devuelve datos a nadie, sólo decide qué archivo no usa nadie.
//
// ⚠️ Y PRIMERO SE LISTA, DESPUÉS SE LEEN LAS FILAS: así la lectura es más nueva que el listado.
// Al revés, un archivo subido y guardado entre las dos lecturas aparecería sin dueño (lo salvaría
// igual la edad de 24 h, pero no hay por qué depender de eso).

import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { BUCKET_CURSO } from './curso-admin';
import { BUCKET_NOTAS } from './curso-notas';
import { BUCKET_ADJUNTOS, esAdjuntoDescripcionSubido } from './curso-adjuntos-reglas';
import { BUCKET_COMUNIDAD } from './comunidad-reglas';
import { decidirPurga, esVideoSubido, esAdjuntoSubido, type ArchivoBucket } from '@/app/customer-success/curso/reglas';

/** Cuántos objetos se borran por bucket y por vuelta. Lo que sobre, mañana. */
const TOPE_POR_VUELTA = 300;
/**
 * De a cuántos se borran (un `remove` con una lista). Y de a cuántos se vuelve a preguntar: la
 * segunda pregunta es un `in.(…)` en la URL de PostgREST, y 50 rutas de ~60 caracteres dejan la
 * URL lejos del tope del gateway.
 */
const LOTE = 50;
/** Hasta qué profundidad se baja: `<ws>/<producto>/<archivo>` son tres niveles. */
const PROFUNDIDAD = 3;

type Config = { bucket: string; tabla: string; columna: string; esPropio: (p: string) => boolean };

/** Los dos buckets del curso y qué columna nombra sus archivos. */
const BUCKETS: readonly Config[] = [
  { bucket: BUCKET_CURSO, tabla: 'curso_clases', columna: 'video_path', esPropio: esVideoSubido },
  { bucket: BUCKET_NOTAS, tabla: 'curso_clase_notas', columna: 'archivo_path', esPropio: esAdjuntoSubido },
  // Los adjuntos de la descripción de una clase (mig 0216): barre lo subido y nunca registrado. Lo
  // registrado que la descripción dejó de nombrar todavía no tiene regla (queda en el bucket).
  { bucket: BUCKET_ADJUNTOS, tabla: 'curso_adjuntos', columna: 'path', esPropio: esAdjuntoDescripcionSubido },
  // Los adjuntos de los posts de la comunidad (mig 0217): <ws>/<producto>/<uuid>.<ext>, y sólo los
  // posts llevan adjunto. La guarda de 24 h no toca una subida en curso.
  {
    bucket: BUCKET_COMUNIDAD, tabla: 'comunidad_posts', columna: 'adjunto_path',
    esPropio: (p) => /^\d{1,12}\/\d{1,12}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(p),
  },
];

export type ResultadoPurga = {
  bucket: string;
  /** `false` = modo prueba: contó y no borró nada. */
  borra: boolean;
  archivos: number;
  referencias: number | null;
  /** Cuántos da por huérfanos la regla, en total (no sólo los de esta vuelta). */
  huerfanos: number;
  /**
   * Los que esta vuelta borraría (o intentó borrar), hasta el tope por vuelta. En modo prueba es
   * lo que hay que leer antes de prenderla.
   */
  candidatos: string[];
  /** Cuánto pesan los `candidatos`, según el listado del bucket. */
  bytesCandidatos: number;
  borrados: number;
  /** Por qué no se borró nada (fail-closed), o `null`. */
  motivo: string | null;
  /** Un error de verdad (listado, lectura o borrado): el cron contesta 500 para que se vea. */
  error: string | null;
};

const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

/**
 * Lista un bucket entero (paginando de a 1000 por carpeta). TIRA si cualquier carpeta falla: un
 * listado a medias se reporta como error, no como «había menos».
 */
async function listarBucket(bucket: string): Promise<Array<ArchivoBucket & { bytes: number }>> {
  const sb = getSupabaseServer();
  const out: Array<ArchivoBucket & { bytes: number }> = [];
  const bajar = async (prefijo: string, prof: number): Promise<void> => {
    if (prof > PROFUNDIDAD) return;
    for (let offset = 0; ; ) {
      const { data, error } = await sb.storage.from(bucket).list(prefijo, { limit: 1000, offset });
      if (error) throw new Error(`listar ${bucket}/${prefijo}: ${error.message}`);
      const items = data ?? [];
      for (const it of items) {
        const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
        // Sin `id` es una «carpeta» (un prefijo virtual): hay que bajar.
        // El tamaño es sólo para el reporte (cuánto liberaría): no decide nada, y sin él cuenta 0.
        if (it.id) out.push({ path: ruta, createdAt: it.created_at ?? null, bytes: Number(it.metadata?.size) || 0 });
        else await bajar(ruta, prof + 1);
      }
      if (items.length < 1000) break;
      offset += items.length;
    }
  };
  await bajar('', 1);
  return out;
}

/** Las rutas que nombra alguna fila, de TODOS los workspaces (ver la cabecera). */
async function rutasUsadas(tabla: string, columna: string): Promise<string[]> {
  const filas = await leerTodo<Record<string, string | null>>(getSupabaseServer(), tabla, `id, ${columna}`,
    { filtros: (q) => q.not(columna, 'is', null), orden: 'id' });
  return filas.map((f) => f[columna]).filter((p): p is string => typeof p === 'string' && p.length > 0);
}

/**
 * Purga UN bucket. No tira: todo lo que pasa queda en el resultado. Con `borra` en false hace
 * todo lo mismo (lista, lee las filas, aplica la regla) y se detiene antes de la segunda pregunta
 * y del `remove`: devuelve los candidatos y no toca nada.
 */
async function purgarBucket(cfg: Config, ahoraMs: number, borra: boolean): Promise<ResultadoPurga> {
  const r: ResultadoPurga = {
    bucket: cfg.bucket, borra, archivos: 0, referencias: null, huerfanos: 0, candidatos: [], bytesCandidatos: 0,
    borrados: 0, motivo: null, error: null,
  };
  let archivos: Array<ArchivoBucket & { bytes: number }>;
  try {
    archivos = await listarBucket(cfg.bucket);
  } catch (e) {
    r.error = msg(e);
    r.motivo = 'No pude listar el bucket: no borro nada.';
    return r;
  }
  r.archivos = archivos.length;

  let referencias: { ok: true; paths: string[] } | { ok: false; error: string };
  try {
    referencias = { ok: true, paths: await rutasUsadas(cfg.tabla, cfg.columna) };
    r.referencias = referencias.paths.length;
  } catch (e) {
    referencias = { ok: false, error: msg(e) };
    r.error = msg(e);
  }

  const d = decidirPurga({ archivos, referencias, ahoraMs, esPropio: cfg.esPropio });
  r.motivo = d.motivo;
  r.huerfanos = d.borrar.length;
  const candidatos = d.borrar.slice(0, TOPE_POR_VUELTA);
  r.candidatos = candidatos;
  const peso = new Map(archivos.map((a) => [a.path, a.bytes]));
  r.bytesCandidatos = candidatos.reduce((s, p) => s + (peso.get(p) ?? 0), 0);
  if (d.borrar.length > candidatos.length) r.motivo = `Quedan ${d.borrar.length - candidatos.length} para la próxima vuelta.`;
  // Modo prueba: hasta acá llega. Ni la segunda pregunta ni el `remove`.
  if (!candidatos.length || !borra) return r;

  const sb = getSupabaseServer();
  for (let i = 0; i < candidatos.length; i += LOTE) {
    const lote = candidatos.slice(i, i + LOTE);
    // La segunda pregunta, justo antes de borrar: ¿alguna fila los nombra AHORA? Si la consulta
    // falla, no se borra este lote ni los que siguen.
    const { data: usados, error: eUso } = await sb.from(cfg.tabla).select(cfg.columna).in(cfg.columna, lote);
    if (eUso) { r.error = `releer ${cfg.tabla}: ${eUso.message}`; break; }
    const vivos = new Set(((usados ?? []) as unknown as Array<Record<string, string | null>>).map((f) => f[cfg.columna]));
    const borrar = lote.filter((p) => !vivos.has(p));
    if (!borrar.length) continue;
    const { error } = await sb.storage.from(cfg.bucket).remove(borrar);
    if (error) { r.error = `borrar en ${cfg.bucket}: ${error.message}`; break; }
    r.borrados += borrar.length;
  }
  return r;
}

/**
 * Purga los dos buckets del curso. Uno que falla no frena al otro.
 *
 * ⚠️ `borrar` es `false` por default: sin pedirlo explícito, sólo cuenta. Quien la llama decide
 * con `pideBorrarPurga` (la ruta del cron), nunca con un truthy suelto.
 */
export async function purgarHuerfanosDelCurso(
  { borrar = false, ahoraMs = Date.now() }: { borrar?: boolean; ahoraMs?: number } = {},
): Promise<ResultadoPurga[]> {
  const out: ResultadoPurga[] = [];
  for (const cfg of BUCKETS) {
    const r = await purgarBucket(cfg, ahoraMs, borrar === true);
    out.push(r);
    // Al log van los conteos; las rutas viajan en la respuesta (hasta 300 por bucket ensucian el log).
    const { candidatos, ...conteos } = r;
    console.log(`[curso-purga] ${JSON.stringify({ ...conteos, candidatos: candidatos.length })}`);
  }
  return out;
}
