// =============================================================================
// GET /api/ia-pc/descargar?os=windows — el instalador CON ASISTENTE de «MaKo en tu computadora» (0.4.0, 23/10/2026)
// =============================================================================
// PRIVADA (con sesión: la persona que conecta SU computadora). Firma 10 minutos el instalador del bucket privado `ia-pc`
// (lo sube scripts/ia-pc/publicar-binarios.mts) y redirige ahí, con el nombre MaKo-Setup-<versión>.exe. Martín (22/10/2026):
// «jamás por Powershell... que sea una app de escritorio con el típico panel de "avanzar"... Que al darle conectar si no
// tenes instalada la app, te deje descargarla». Por ahora sólo Windows: la Mac sigue con su línea hasta tener su .pkg.
// ⚠️ Lo que falta NO pasa callado (IA2): sin el archivo queda en errores_app y se dice, como /api/ia-pc/instalar.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { limitePorIp } from '@/lib/limite-publico';
import { archivoDelInstalador, nombreDelInstalador, VERSION_PC } from '@/lib/ia-pc-reglas';
import { registrarError } from '@/lib/errores-app';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const texto = (t: string, status: number) => new NextResponse(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(req: NextRequest) {
  const frenado = limitePorIp(req, 'ia-pc-descargar', 20, 10 * 60_000);
  if (frenado) return frenado;
  const persona = await personaDelRequest();
  if ('error' in persona) return texto(persona.error, persona.status);
  if (req.nextUrl.searchParams.get('os') !== 'windows') return texto('Por ahora el instalador es para Windows. En la Mac, sigue los pasos de MaKo.', 400);
  const { data, error } = await getSupabaseServer().storage.from('ia-pc').createSignedUrl(archivoDelInstalador(), 600, { download: nombreDelInstalador() });
  if (!data?.signedUrl) {
    await registrarError({
      origen: 'servidor', nombre: 'IaPcFaltaInstalador', ruta: '/api/ia-pc/descargar',
      mensaje: `ia-pc: falta el instalador ${VERSION_PC} (${archivoDelInstalador()}): ${error?.message ?? 'sin URL firmada'}`,
    }, null).catch(() => undefined);
    return texto('No pude preparar la descarga. Intenta de nuevo en un rato.', 503);
  }
  return NextResponse.redirect(data.signedUrl, 302);
}
