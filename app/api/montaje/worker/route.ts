// =============================================================================
// La puerta del worker de montaje — un solo viaje: reporta y se lleva trabajo
// =============================================================================
// ── Por qué un endpoint y no una server action ─────────────────────────────
// El worker no es un navegador: no tiene cookie de sesión, no tiene `?ws=`, y no
// puede ejecutar una server action. Se autentica con un bearer propio, igual que
// el puente de Flow.
//
// ⚠️ Y POR ESO VA EN `lib/rutas-publicas.ts`. Sin eso `proxy.ts` la corta con un
// 401 ANTES de que este código corra — y en local no se ve, porque sin
// `AUTH_SECRET` el middleware es no-op: la ruta anda contra localhost y falla
// sólo en producción. La integración con Claude vivió meses así.
//
// ── Un viaje, no dos ───────────────────────────────────────────────────────
// El mismo POST devuelve lo hecho y se lleva lo próximo. Es la lección que costó
// media hora de latencia en la cola de Flow: parquear el resultado para el
// siguiente ciclo le agrega un viaje entero a CADA trabajo.
//
// ── Lo que el worker NO tiene ──────────────────────────────────────────────
// No tiene la service key ni la de Supabase. Baja los clips por su url pública y
// sube el resultado con una url FIRMADA que se acuña acá, al entregar el
// trabajo. Firmarla al ENCOLAR no serviría: un trabajo puede esperar en la cola
// más de lo que dura la firma.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { nombreDeAnuncio } from '@/app/video-generator/video-pedido';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'video-clips';
/** Cuánto vale la firma de subida. Un render largo pasa los cinco minutos. */
const FIRMA_SEG = 60 * 45;

type Resultado = {
  id: number;
  ok: boolean;
  /** Dónde quedó el mp4, y los dos números que ve la persona. */
  salida?: { ruta?: string; segundosAntes?: number; segundosDespues?: number; palabrasPerdidas?: number };
  motivo?: string;
  error?: string;
};

/**
 * ⚠️ COMPARACIÓN EN TIEMPO CONSTANTE, y no es ceremonia.
 *
 * Un `===` sobre un token sale antes cuanto más temprano difiere, y eso es
 * suficiente para adivinarlo carácter por carácter contra un endpoint público.
 * Es barato hacerlo bien.
 */
function tokenValido(dado: string, esperado: string): boolean {
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  // `timingSafeEqual` tira si los largos difieren, así que eso se contesta antes
  // —y el largo de un token no es un secreto que importe—.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const esperado = process.env.MONTAJE_WORKER_TOKEN || '';
  // ⚠️ SIN TOKEN CONFIGURADO, LA PUERTA NO EXISTE. No se cae a «cualquiera
  // pasa»: un secreto vacío que compara igual a un header vacío es una puerta
  // abierta que se lee como cerrada. Y 404 en vez de 401 — un 401 confirma que
  // la ruta existe, y eso ya cuenta algo de la plataforma.
  if (!esperado) return new NextResponse('no encontrado', { status: 404 });

  const dado = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!dado || !tokenValido(dado, esperado)) {
    return NextResponse.json({ error: 'token de worker invalido' }, { status: 401 });
  }

  const db = admin();
  if (!db) return NextResponse.json({ error: 'sin credenciales de base' }, { status: 500 });

  let body: { resultados?: Resultado[]; cuantos?: number } = {};
  try { body = (await req.json()) as typeof body; } catch { /* cuerpo vacío es válido: sólo pedir trabajo */ }

  // ── 1. Lo que el worker terminó ───────────────────────────────────────────
  for (const r of body.resultados ?? []) {
    if (!Number.isFinite(r?.id)) continue;
    if (r.ok) {
      await db.from('montaje_trabajos').update({
        estado: 'listo',
        listo_at: new Date().toISOString(),
        resultado: r.salida ?? {},
        motivo: '',
        error: '',
      }).eq('id', r.id);
      continue;
    }

    // ⚠️ UN FALLO NO ES SIEMPRE UN REINTENTO. `material` es un clip corrupto o
    // mudo: volver a intentarlo da el mismo resultado y ocupa el worker para
    // siempre. `verificacion` es peor todavía — el montaje SALIÓ pero perdió
    // texto, así que no se entrega y tampoco se reintenta a ciegas.
    const definitivo = r.motivo === 'material' || r.motivo === 'verificacion';
    await db.from('montaje_trabajos').update({
      estado: definitivo ? 'fallido' : 'pendiente',
      tomado_at: definitivo ? undefined : null,
      listo_at: definitivo ? new Date().toISOString() : null,
      motivo: String(r.motivo || 'interno').slice(0, 40),
      error: String(r.error || '').slice(0, 2000),
    }).eq('id', r.id);
  }

  // ── 2. Lo próximo ─────────────────────────────────────────────────────────
  const cuantos = Math.max(1, Math.min(Number(body.cuantos) || 1, 3));
  const { data: tomados, error } = await db.rpc('montaje_tomar', { p_cuantos: cuantos });
  if (error) {
    console.error('[montaje] no se pudo tomar trabajo:', error.message);
    return NextResponse.json({ error: 'no se pudo tomar trabajo' }, { status: 500 });
  }

  const trabajos = [];
  for (const t of (tomados ?? []) as Array<Record<string, unknown>>) {
    const pedido = (t.pedido ?? {}) as Record<string, unknown>;
    const planId = String(t.plan_id ?? '');
    const titulo = String(pedido.titulo || 'Anuncio');
    const ruta = `video-generator/${planId}/montado-${t.id}.mp4`;

    // La firma se acuña ACÁ, al entregar. Firmarla al encolar sería firmar algo
    // que puede esperar horas en la cola: la url llegaría vencida y el worker
    // fallaría en el último paso, después de gastar el render entero.
    const { data: firma, error: eFirma } = await db.storage.from(BUCKET)
      .createSignedUploadUrl(ruta, { upsert: true });
    if (eFirma || !firma?.signedUrl) {
      // No se entrega un trabajo que no va a poder devolver el resultado: se
      // suelta y lo toma el ciclo siguiente. Fallar al final del render es la
      // forma más cara de fallar.
      console.error('[montaje] sin url de subida para', t.id, eFirma?.message);
      await db.from('montaje_trabajos')
        .update({ estado: 'pendiente', tomado_at: null, motivo: 'transitorio', error: 'no se pudo firmar la subida' })
        .eq('id', t.id);
      continue;
    }

    trabajos.push({
      id: t.id,
      planId,
      titulo,
      nombreArchivo: nombreDeAnuncio(titulo),
      // Las urls públicas de las tomas, en orden. El bucket es público, así que
      // el worker las baja con un GET pelado.
      clips: Array.isArray(pedido.clips) ? pedido.clips : [],
      // El guion contra el que se verifica que no se perdió una palabra.
      guion: String(pedido.guion || ''),
      // Los parámetros del formato. Sin adivinar: el worker no conoce las puestas.
      segundosPorToma: Array.isArray(pedido.segundosPorToma) ? pedido.segundosPorToma : [],
      subida: { url: firma.signedUrl, ruta, token: firma.token },
      publica: db.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl,
    });
  }

  return NextResponse.json({ trabajos });
}
