// =============================================================================
// El que atiende la cola de montaje — vercel.json: `*/2 * * * *`
// =============================================================================
// ⚠️ LA COLA NO TENÍA A NADIE ATENDIENDO. `montaje_trabajos` se llenaba desde el
// Video Generator y la ejecutaba un worker en contenedor (worker/) que NUNCA se
// desplegó: el 20/10/2026 había dos trabajos del 01/09 y 02/09 sin tomar, y la
// pantalla decía «Lleva 68.646 minutos esperando turno». Las tomas nunca llegaban
// al anuncio montado, y por eso tampoco al Video Editor.
//
// ⚠️ ACÁ Y NO EN EL CONTENEDOR. La decisión del 01/09 fue un contenedor porque un
// montaje son ~15 llamadas a ffmpeg y un render; pero un contenedor es otra
// pieza que desplegar y vigilar, y nadie la desplegó. Una función de Vercel con
// ffmpeg-static aguanta un anuncio de 30-80 s holgado dentro de `maxDuration`, y
// se despliega con todo lo demás. Además, el worker no habría montado NUNCA: el
// bash que llamaba lee la voz de cada toma de `sts-N.mp3`, y esos archivos no los
// creaba nadie (lib/montaje/pipeline.ts, el paso 0).
//
// Cada corrida: 1) da de baja los trabajos vencidos, con un texto honesto; 2)
// toma UNO; 3) lo monta, lo sube y lo marca. Las corridas se pisan sin problema:
// `montaje_tomar` toma con `for update skip locked`, así que dos corridas nunca
// agarran el mismo.

import { type NextRequest } from 'next/server';
import { access, chmod, copyFile, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { checkCronAuth } from '@/lib/cron-auth';
import { limpiar, montarAnuncio, type Herramientas } from '@/lib/montaje/pipeline';
import { clasificar, corteDeVencimiento, ERROR_VENCIDO, esDefinitiva, MOTIVO_VENCIDO } from '@/lib/montaje/cola';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
// Un montaje de 8 tomas tarda ~2-4 minutos en una función. El techo es el tope
// del plan: si un render se pasa, la función muere, el trabajo queda `tomado` y
// `montaje_tomar` lo rescata a los 20 minutos con un intento menos.
export const maxDuration = 800;

const BUCKET = 'video-clips';

/**
 * Las herramientas, donde las deja el deploy.
 *
 * ⚠️ LA RUTA DE FFMPEG SE ARMA A MANO y no con `import ffmpeg from 'ffmpeg-static'`:
 * el paquete calcula la ruta con `__dirname`, y empaquetado por Next ese
 * `__dirname` deja de apuntar a node_modules. El binario llega a la función por
 * `outputFileTracingIncludes` (next.config.ts), igual que los scripts y la fuente.
 * `FFMPEG_PATH` es para correrlo fuera de Vercel.
 */
function herramientas(): Herramientas {
  const raiz = process.cwd();
  return {
    ffmpeg: process.env.FFMPEG_PATH || path.join(raiz, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    node: process.execPath,
    scripts: path.join(raiz, 'scripts'),
    fuentes: path.join(raiz, 'worker', 'fuentes'),
    groqKey: process.env.GROQ_API_KEY || '',
    log: (s) => console.log(`[montaje] ${s}`),
  };
}

/**
 * El ffmpeg, listo para ejecutar, o '' si no está.
 *
 * ⚠️ SI LLEGÓ SIN PERMISO DE EJECUCIÓN, SE COPIA A /tmp. El empaquetado de la
 * función no garantiza conservar el bit `x` de un archivo que no es JS, y el
 * resto del disco de la función es de sólo lectura: chmod sólo se puede en /tmp.
 */
async function ffmpegEjecutable(ruta: string): Promise<string> {
  if (await access(ruta, constants.X_OK).then(() => true, () => false)) return ruta;
  if (!(await access(ruta, constants.R_OK).then(() => true, () => false))) return '';
  const copia = path.join(tmpdir(), 'ffmpeg-montaje');
  if (!(await access(copia, constants.X_OK).then(() => true, () => false))) {
    await copyFile(ruta, copia);
    await chmod(copia, 0o755);
  }
  return copia;
}

export async function GET(req: NextRequest) {
  const guard = checkCronAuth(req);
  if (guard) return guard;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'sin credenciales de base' }, { status: 500 });
  // Service key: la cola es de todos los negocios y el que la atiende no es
  // ninguno (mig 0151). Lo que es de cada uno —el archivo— va a la ruta del plan.
  const db = createClient(url, key, { auth: { persistSession: false } });

  // ── 1. Los vencidos ──────────────────────────────────────────────────────
  // ANTES de tomar: si no, el primero que tomaría sería el más viejo de todos,
  // justo el que ya nadie espera.
  const { data: vencidos, error: eVence } = await db
    .from('montaje_trabajos')
    .update({ estado: 'fallido', motivo: MOTIVO_VENCIDO, error: ERROR_VENCIDO, listo_at: new Date().toISOString() })
    .eq('estado', 'pendiente')
    .lt('created_at', corteDeVencimiento())
    .select('id, workspace_id');
  if (eVence) console.error('[montaje] no se pudieron vencer los viejos:', eVence.message);

  // ── 2. ¿Se puede montar? ─────────────────────────────────────────────────
  // ⚠️ SE PREGUNTA ANTES DE TOMAR. Tomar suma un intento: sin el binario o sin la
  // clave de la transcripción, cada corrida le quemaría un intento a un trabajo
  // que no tiene ninguna culpa, y a la tercera lo daría por fallido.
  const h = herramientas();
  const ffmpeg = await ffmpegEjecutable(h.ffmpeg).catch(() => '');
  const falta = !h.groqKey
    ? 'falta GROQ_API_KEY (transcribe la voz para los subtítulos)'
    : !ffmpeg ? `no está ffmpeg en ${h.ffmpeg}` : '';
  h.ffmpeg = ffmpeg;
  if (falta) {
    console.error(`[montaje] no se toma nada: ${falta}`);
    return Response.json({ ok: false, vencidos: vencidos?.length ?? 0, error: falta }, { status: 500 });
  }

  // ── 3. Tomar uno y montarlo ──────────────────────────────────────────────
  // Uno por corrida: un render satura el CPU de la función, así que dos en la
  // misma no terminan antes. La concurrencia la dan las corridas que se pisan.
  const { data: tomados, error: eToma } = await db.rpc('montaje_tomar', { p_cuantos: 1 });
  if (eToma) {
    console.error('[montaje] no se pudo tomar:', eToma.message);
    return Response.json({ ok: false, error: 'no se pudo tomar' }, { status: 500 });
  }
  const t = ((tomados ?? []) as Array<Record<string, unknown>>)[0];
  if (!t) return Response.json({ ok: true, vencidos: vencidos?.length ?? 0, montado: null });

  const id = Number(t.id);
  const pedido = (t.pedido ?? {}) as Record<string, unknown>;
  const ruta = `video-generator/${String(t.plan_id ?? '')}/montado-${id}.mp4`;
  const inicio = Date.now();
  let dir = '';
  try {
    const m = await montarAnuncio({
      id,
      clips: Array.isArray(pedido.clips) ? pedido.clips.map(String) : [],
      guion: String(pedido.guion || ''),
      segundosPorToma: Array.isArray(pedido.segundosPorToma) ? pedido.segundosPorToma.map(Number) : [],
      plan: pedido.plan ?? null,
      // La url de la música la puso el server desde el catálogo al encolar
      // (montarAnuncioAction): acá se baja lo que dice el pedido, nada más.
      musica: typeof pedido.musica === 'string' ? pedido.musica : '',
    }, h);
    dir = m.dir;

    // `upsert`: un reintento del mismo trabajo escribe en la misma ruta.
    const { error: eSube } = await db.storage.from(BUCKET)
      .upload(ruta, await readFile(m.archivo), { contentType: 'video/mp4', upsert: true });
    if (eSube) throw new Error(`la subida falló: ${eSube.message}`);

    await db.from('montaje_trabajos').update({
      estado: 'listo',
      listo_at: new Date().toISOString(),
      resultado: {
        ruta,
        url: db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl,
        segundosAntes: m.segundosAntes,
        segundosDespues: m.segundosDespues ?? undefined,
        bytes: m.bytes,
        // Los cortes que produjeron ESTE video: es lo que el editor edita.
        plan: m.plan,
      },
      motivo: '',
      error: '',
    }).eq('id', id);
    const seg = Math.round((Date.now() - inicio) / 1000);
    console.log(`[montaje] #${id} listo en ${seg} s (${m.bytes} bytes)`);
    return Response.json({ ok: true, vencidos: vencidos?.length ?? 0, montado: id, segundos: seg });
  } catch (e) {
    const motivo = clasificar(e);
    const definitiva = esDefinitiva(motivo);
    // El stderr de ffmpeg trae la causa al principio y el ruido al final.
    const detalle = `${(e as Error)?.message ?? String(e)} ${String((e as { stderr?: string })?.stderr ?? '').slice(0, 1500)}`.trim();
    console.error(`[montaje] #${id} falló (${motivo}):`, detalle);
    await db.from('montaje_trabajos').update({
      // Lo que no es definitivo vuelve a la fila; el tope de intentos lo pone
      // `montaje_tomar` (al tercero, fallido).
      estado: definitiva ? 'fallido' : 'pendiente',
      tomado_at: null,
      listo_at: definitiva ? new Date().toISOString() : null,
      motivo,
      error: detalle.slice(0, 2000),
    }).eq('id', id);
    return Response.json({ ok: false, vencidos: vencidos?.length ?? 0, montado: id, motivo }, { status: 200 });
  } finally {
    if (dir) await limpiar(dir);
  }
}
