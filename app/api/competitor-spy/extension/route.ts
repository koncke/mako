// =============================================================================
// POST /api/competitor-spy/extension — «Guardar en Spy» desde la extensión
// =============================================================================
// La extensión no tiene sesión de MaKo: se autentica con el token del puente, como /api/flow/puente. Por
// eso está en `PUBLICOS` (lib/rutas-publicas.ts): se hace cargo de su auth y NO mira la cookie para nada.
//
// Dos pedidos:
//   · `lista`: los competidores del negocio, para que el desplegable diga «Guardar en la ficha de X». Va a
//     buscar la lista entera y compara allá: así, abrir el desplegable no le cuenta a MaKo qué sitio estás
//     mirando. Sólo un clic en el botón manda algo de esa página.
//   · `guardar`: lo que leyó extension/spy-leer.js. Se interpreta acá (lib/spy-captura.ts).

import { NextResponse, type NextRequest } from 'next/server';
import { workspaceDeToken } from '@/lib/flow-cola';
import { limitePorClave } from '@/lib/limite-publico';
import { leerCaptura } from '@/lib/spy-captura';
import { fichasParaLaExtension, guardarCaptura } from '@/lib/spy-captura-db';
import { leerCapturaDePagina } from '@/lib/spy-pagina-capturada';
import { guardarPaginaCapturada } from '@/lib/spy-pagina-capturada-servidor';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/** Una Biblioteca con 28 anuncios a la vista son ~95 KB (medido el 3/11/2026). Cuatro megas es otra cosa. */
const TOPE_CUERPO = 4_000_000;

export async function POST(req: NextRequest) {
  const token = (req.headers.get('x-flow-token') ?? '').trim();
  const ws = await workspaceDeToken(token);
  // 404 y no 403: a quien no le corresponde, no existe. El mismo criterio que /api/flow/puente.
  if (ws == null) return NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
  // Es el clic de una persona: sesenta por minuto por negocio sobran, y cada guardado baja imágenes.
  const frenado = limitePorClave('spy-extension', ws, 60, 60_000);
  if (frenado) return frenado;

  const crudo = await req.text().catch(() => '');
  if (crudo.length > TOPE_CUERPO) return NextResponse.json({ ok: false, error: 'Esta pestaña tiene demasiado para leer de una vez.' }, { status: 413 });
  let cuerpo: Record<string, unknown>;
  try { cuerpo = JSON.parse(crudo) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'cuerpo inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (cuerpo.accion === 'lista') return NextResponse.json({ ok: true, competidores: await fichasParaLaExtension() });
      // «Capturar» en «Sus páginas» (4/11/2026): la página que Spy pidió, en la pestaña que abrió la extensión, después del toque
      // de la persona en el ícono (lib/spy-pagina-capturada.ts).
      if (cuerpo.accion === 'pagina') {
        const id = Number(cuerpo.competidorId);
        const url = typeof cuerpo.url === 'string' ? cuerpo.url.trim() : '';
        const captura = leerCapturaDePagina(cuerpo.captura);
        if (!Number.isInteger(id) || id <= 0 || !/^https?:\/\//i.test(url) || !captura) {
          return NextResponse.json({ ok: false, motivo: 'falla', error: 'No puedo guardar esta página.' }, { status: 400 });
        }
        return NextResponse.json(await guardarPaginaCapturada(id, url, captura, cuerpo.foto));
      }
      if (cuerpo.accion !== 'guardar') return NextResponse.json({ ok: false, error: 'pedido desconocido' }, { status: 400 });
      const captura = leerCaptura(cuerpo.captura);
      if (!captura) return NextResponse.json({ ok: false, error: 'No puedo guardar esta página.' }, { status: 400 });
      const id = Number(cuerpo.competidorId);
      const r = await guardarCaptura(captura, Number.isInteger(id) && id > 0 ? id : null);
      return NextResponse.json(r);
    } catch (e) {
      console.error('[spy extensión]', e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, motivo: 'falla', error: 'No pude guardarlo. Vuelve a intentarlo.' }, { status: 500 });
    }
  });
}
