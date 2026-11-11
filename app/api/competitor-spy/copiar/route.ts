// =============================================================================
// /api/competitor-spy/copiar — «Copiar estructura» de una pieza de un competidor (punto 9 del 4/11/2026)
// =============================================================================
// Martín, 4/11: «si se selecciona un reel, un YT, un carrusel, o una web, debería fácilmente estar el botón de "Copiar
// estructura", y que lo procese en todas las herramientas que ya tenemos en MaKo».
//
//   POST { piezaId } → { ok, href }       la página nueva del Copywriter, con su estructura y su texto citado
//                    → { ok, texto }      quien mira no tiene el Copywriter: la pantalla copia el texto al portapapeles
//
// La web no pasa por acá: va al Web Generator, que ya sabe copiar una página (`/web-generator?analizar=<url>`).
//
// ⚠️ LO QUE SE ESCRIBE LO ARMA EL CÓDIGO (`textoParaCopiar`, lib/spy-detalle.ts): de dónde viene, lo que la IA del negocio
// ya leyó y su texto citado. Ninguna IA corre acá: la versión propia la escribe MaKo en el chat del Copywriter, con la
// IA del negocio, cuando la persona se la pide.
// ⚠️ LA PUERTA DEL COPYWRITER ES LA SUYA (`esAdminDeTab('copywriter')` + `veCopywriter()`: el corte de `soloAdminDeTab` de /api/copywriter, sin cerrar la ruta): una
// ruta de Spy no abre una tab que a quien mira no le corresponde.
// =============================================================================

import type { NextRequest } from 'next/server';
import { veCopywriter } from '@/app/copywriter/acceso';
import { getUsuarioActual } from '@/lib/auth';
import { crear } from '@/lib/copywriter/server';
import { docDeTexto } from '@/lib/copywriter/texto';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { leerPieza } from '@/lib/spy';
import { textoParaCopiar, tipoParaCopiar, tituloDeCopia } from '@/lib/spy-detalle';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const no = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s && (await getRolWsEfectivo()) ? await getWorkspaceActual() : null;
  if (!s || ws == null) return no(401, 'No autorizado');
  const cuerpo = (await req.json().catch(() => ({}))) as { piezaId?: unknown };
  const id = Number(cuerpo.piezaId);
  if (!Number.isInteger(id) || id <= 0) return no(400, 'Falta la pieza.');

  const leida = await leerPieza(id);
  if (!leida) return no(404, 'No encontré esa pieza.');
  const { pieza, competidor } = leida;
  if (pieza.canal === 'landing') return no(400, 'Una web se copia en el Web Generator.');
  const texto = textoParaCopiar(competidor, pieza);

  // Sin el Copywriter, el texto vuelve y la pantalla lo copia: el botón sirve igual.
  if (!(await esAdminDeTab('copywriter')) || !(await veCopywriter())) return Response.json({ ok: true, texto }, { headers: { 'Cache-Control': 'no-store' } });

  const titulo = tituloDeCopia(competidor.nombre, pieza.analisis?.gancho || pieza.titulo || pieza.texto || '');
  const r = await crear({ tipo: tipoParaCopiar(pieza), titulo, contenido: docDeTexto(texto) });
  if (!r.ok) return Response.json({ ok: true, texto, error: r.error }, { headers: { 'Cache-Control': 'no-store' } });
  return Response.json({ ok: true, href: `/copywriter/${r.pagina.id}`, texto }, { headers: { 'Cache-Control': 'no-store' } });
}
