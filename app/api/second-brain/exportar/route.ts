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

  let body: { areas?: unknown; ids?: unknown };
  try { body = (await req.json()) as { areas?: unknown; ids?: unknown }; } catch { body = {}; }

  const validas = new Set(AREAS.map((a) => a.id as string));
  const pedidas = Array.isArray(body.areas) ? body.areas.filter((a): a is string => typeof a === 'string' && validas.has(a)) : [];
  // Sin áreas válidas se lleva todo: es lo que espera alguien que aprieta «exportar»
  // sin pensarlo, y devolver un ZIP vacío sería un error silencioso.
  const areas = (pedidas.length ? pedidas : AREAS.map((a) => a.id)) as AreaId[];

  // El recorte del mapa. Llega como lista de ids porque el filtro de la pantalla tiene
  // tres dimensiones que se combinan (carpeta, sección, autoría) más la búsqueda: mandar
  // los CRITERIOS obligaría a reimplementar acá el predicado que ya existe en el
  // navegador, y dos implementaciones de «qué se ve» divergen — es exactamente el bug
  // que este archivo ya pagó entre el README y las carpetas. Se manda el RESULTADO.
  const ids = Array.isArray(body.ids) && body.ids.length
    ? new Set(body.ids.filter((x): x is string => typeof x === 'string'))
    : undefined;

  try {
    const cerebro = await construirCerebro();
    const archivos = construirVault(cerebro, areas, ids);

    const zip = new JSZip();
    for (const a of archivos) zip.file(a.ruta, a.texto);
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    // ⚠️ EL NOMBRE DEL ZIP SALE DE LOS NOMBRES, NO DE LOS IDS. Los ids siguen siendo
    // `norte` y `panorama` —vocabulario interno que se renombró en pantalla hace dos
    // rondas— y salían a la cara del usuario justo acá:
    // `segundo-cerebro-…-norte-panorama-documentos-….zip`. Y con más de dos secciones el
    // corte a 40 caracteres partía la última palabra al medio, así que se cuenta.
    const nombreDe = (id: AreaId) => AREAS.find((a) => a.id === id)?.nombre ?? id;
    const detalle = ids
      ? 'recorte'
      : areas.length === AREAS.length
        ? 'completo'
        : areas.length <= 2
          ? areas.map((a) => slug(nombreDe(a))).join('-')
          : `${areas.length}-secciones`;
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
