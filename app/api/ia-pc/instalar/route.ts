// =============================================================================
// GET /api/ia-pc/instalar?os=windows|mac&codigo=XXXXXX — el instalador de un comando (docs/ia-del-cliente.md §7, ola 2)
// =============================================================================
// PÚBLICA (lib/rutas-publicas.ts): la pide PowerShell o curl en la PC del cliente, que no tiene sesión. Devuelve el
// script que baja el programa, conecta la PC con su código y la deja arrancando sola. NO gasta el código: lo gasta el
// programa al emparejar. Lo que lleva el script pasa por `scriptDeInstalacion` (lib/ia-pc-reglas.ts): el código por su
// alfabeto, el servidor de la app y URL firmadas de 10 minutos del bucket privado `ia-pc`.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { limitePorIp } from '@/lib/limite-publico';
import { APP_BASE_URL } from '@/lib/app-url';
import { SISTEMAS_PC, archivoDelPrograma, normalizarCodigo, scriptDeInstalacion, type SistemaPc } from '@/lib/ia-pc-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUCKET = 'ia-pc';
const texto = (t: string, status = 200) => new NextResponse(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(req: NextRequest) {
  // Cada pedido firma URL del bucket: 20 por IP cada 10 minutos.
  const frenado = limitePorIp(req, 'ia-pc-instalar', 20, 10 * 60_000);
  if (frenado) return frenado;
  const os = req.nextUrl.searchParams.get('os');
  const codigo = normalizarCodigo(req.nextUrl.searchParams.get('codigo'));
  if (!(SISTEMAS_PC as readonly (string | null)[]).includes(os) || !codigo) return texto("echo 'Ese enlace no vale: copia de nuevo la línea que te da MaKo.'", 400);
  const sistema = os as SistemaPc;
  const archivos = sistema === 'windows' ? (['windows-x64'] as const) : (['mac-arm64', 'mac-x64'] as const);
  const urls: Record<string, string> = {};
  for (const a of archivos) {
    const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(archivoDelPrograma(a), 600);
    if (!data?.signedUrl) return texto("echo 'No pude preparar la descarga. Intenta de nuevo en un rato.'", 503);
    urls[a] = data.signedUrl;
  }
  try {
    return texto(scriptDeInstalacion({ sistema, codigo, servidor: APP_BASE_URL.replace(/\/+$/, ''), urls }));
  } catch (e) {
    console.error('[ia-pc/instalar]', e instanceof Error ? e.message : String(e));
    return texto("echo 'No pude preparar la instalación. Intenta de nuevo en un rato.'", 500);
  }
}
