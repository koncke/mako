// =============================================================================
// Proxy de archivos de Chatwoot (para previsualizar PDFs en un <iframe>).
// El host de Chatwoot (Railway) manda X-Frame-Options y no se deja embeber, así
// que el iframe directo da "conexión rechazada". Servimos el archivo desde NUESTRO
// origen (sin esa cabecera) para poder previsualizarlo inline.
// Allowlist estricto al host de Chatwoot → no es un proxy abierto (evita SSRF).
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get('url');
    if (!raw) return new Response('falta url', { status: 400 });

    let target: URL;
    try { target = new URL(raw); } catch { return new Response('url inválida', { status: 400 }); }

    const base = process.env.CHATWOOT_BASE_URL || '';
    const baseHost = base ? new URL(base).host : '';
    // Sólo archivos del propio Chatwoot, y sólo http(s).
    if (!baseHost || target.host !== baseHost || !/^https?:$/.test(target.protocol)) {
      return new Response('host no permitido', { status: 403 });
    }

    const upstream = await fetch(target.toString());
    if (!upstream.ok) return new Response('no se pudo obtener el archivo', { status: 502 });

    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': ct,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(msg, { status: 500 });
  }
}
