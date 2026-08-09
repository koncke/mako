// =============================================================================
// POST /api/second-brain/exportar — el segundo cerebro en un ZIP
// =============================================================================
// Devuelve el vault (carpetas + .md con frontmatter y enlaces [[wiki]]) de las áreas
// que el usuario eligió. Se abre con cualquier editor de texto, y con Obsidian se ve
// el mismo mapa que en MaKo porque los enlaces son los mismos.
//
// POST y no GET aunque solo lea: el cuerpo lleva la lista de áreas elegidas, y una
// lista en la querystring se rompe en cuanto alguien tiene diez áreas.
//
// El ZIP se arma EN MEMORIA y se devuelve entero. Con el techo de nodos que tiene el
// second brain (~124 en el workspace más rico) son decenas de kB de texto, así que no
// hace falta streaming. Si algún día se incluyen los binarios del Archivero, esto
// cambia y hay que decirlo acá.
// =============================================================================

import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireRolWs } from '@/lib/tab-access';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { construirVault } from '@/lib/vault';
import { AREAS, type AreaId } from '@/lib/cerebro-modelo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function POST(req: Request) {
  // Mismo gate que la pantalla: si podés ver el second brain, podés bajarlo. El
  // workspace lo resuelve la sesión, así que no hay forma de pedir el de otro.
  await requireRolWs([], { nav: 'second-brain' });

  let body: { areas?: unknown };
  try { body = (await req.json()) as { areas?: unknown }; } catch { body = {}; }

  const validas = new Set(AREAS.map((a) => a.id as string));
  const pedidas = Array.isArray(body.areas) ? body.areas.filter((a): a is string => typeof a === 'string' && validas.has(a)) : [];
  // Sin áreas válidas se lleva todo: es lo que espera alguien que aprieta «exportar»
  // sin pensarlo, y devolver un ZIP vacío sería un error silencioso.
  const areas = (pedidas.length ? pedidas : AREAS.map((a) => a.id)) as AreaId[];

  try {
    const cerebro = await construirCerebro();
    const archivos = construirVault(cerebro, areas);

    const zip = new JSZip();
    for (const a of archivos) zip.file(a.ruta, a.texto);
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const detalle = areas.length === AREAS.length ? 'completo' : areas.map(slug).join('-').slice(0, 40);
    const nombre = `segundo-cerebro-${slug(cerebro.negocio)}-${detalle}-${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        // Cuántos archivos van adentro, para que la UI lo pueda decir sin abrirlo.
        'X-Archivos': String(archivos.length),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
