// =============================================================================
// /api/graficos/editar — «Editar con MaKo»: una frase cambia la hoja abierta del Dashboard o de General
// =============================================================================
// Martín, 16/10/2026: «en dashboard y general no está la edición con IA, y debería». Lo llama el panel de la hoja
// (app/dashboard/PanelEditarMako.tsx).
//
//   POST { hoja, pedido, modo: 'editar', editando: true, hojaId, historial?, informe? } →{ ok: true, respuesta, cambios, avisos, hoja? } | { ok: false, error, link? }
//
// ⚠️ NO GUARDA NADA, como «Pídeselo» (./../ia/route.ts): el informe lo reescribe entero el navegador con su autoguardado,
//    y un segundo escritor lo pisaría. Devuelve la hoja cambiada (sólo si cambió algo) y el editor la mete con `mutar`,
//    que además le da el deshacer.
// ⚠️ LA HOJA LLEGA DEL NAVEGADOR (lo que la persona tiene en pantalla, aunque no se haya guardado todavía) y se SANEA acá
//    antes de usarla: vale por lo que dice el catálogo, no por lo que mandó la pestaña.
// ⚠️ LA PUERTA: el admin del workspace y la tab en su capa (la del Dashboard o la de General, 404 si no está).
// ⚠️ EN VISTA, MaKo ASESORA (17/10/2026, Martín: «al estar en VISTA del dashboard debería asesorar, no modificar»): sin
//    `modo: 'editar'`, `editando: true` y el `hojaId` de la hoja que viene, 409 y ni un token (`permisoEdicionMako`).
// ⚠️ EL CUERPO VIVE EN lib/graficos-ia-editar.ts (`editarHojaIA`): lo llama también la API de MaKo.
// =============================================================================

import { NextResponse } from 'next/server';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { sanearHoja } from '@/lib/graficos-catalogo';
import { ALCANCE_GENERAL, TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { TURNOS_IA, permisoEdicionMako, type TurnoEdicion } from '@/lib/graficos-ia-edicion';
import { editarHojaIA } from '@/lib/graficos-ia-editar';
import { leerLosArchivos, pedidoConArchivos, traeArchivos } from '@/lib/adjuntos-del-chat';
import { lecturaDeArchivos, type AdjuntoListo } from '@/lib/mako-adjuntos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Lo mismo que «Pídeselo»: la cascada, la copia como JSON, un reintento y la red; el panel corta a 120 + margen. Con fotos o
 *  PDF (28/10/2026) primero se leen (una foto con la visión tardó 52 s medidos): 300, y el panel espera más (TOPE_CON_ARCHIVOS_MS). */
export const maxDuration = 300;
/** Lo que entra de la lectura de los archivos al prompt de la edición (la hoja y el catálogo ya son largos). */
const TOPE_LECTURA_EDICION = 8_000;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/** Lo que se habló en el panel: sólo turnos con quién y texto, los últimos. */
function historialDe(v: unknown): TurnoEdicion[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((t): TurnoEdicion[] => {
    if (!t || typeof t !== 'object') return [];
    const { quien, texto } = t as Record<string, unknown>;
    if ((quien !== 'persona' && quien !== 'mako') || typeof texto !== 'string' || !texto.trim()) return [];
    return [{ quien, texto: texto.trim().slice(0, 600) }];
  }).slice(-TURNOS_IA);
}

export async function POST(req: Request) {
  const inicio = Date.now();
  const rol = await getRolWsEfectivo();
  if (rol == null) return err(401, 'no autenticado');
  if (rol !== 'admin') return err(403, 'Sólo el admin de la cuenta');

  let body: Record<string, unknown>;
  let adjuntos: AdjuntoListo[] = [];
  if (traeArchivos(req)) {
    const p = await pedidoConArchivos(req);
    if (!p.ok) return err(p.status, p.error);
    try { body = JSON.parse(p.campos.datos ?? '{}'); } catch { return err(400, 'JSON inválido'); }
    adjuntos = p.adjuntos;
  } else {
    try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  }
  const general = body?.informe === 'general';
  if (!tabEnCapa(general ? 'general' : 'graphics', await getCapaActual())) return err(404, 'No existe');

  const hoja = sanearHoja(body?.hoja, 0);
  if (!hoja) return err(400, 'No llegó la hoja.');
  // 17/10/2026: en VISTA, MaKo asesora. Sólo cambia la hoja quien la está editando, en el modo «editar», y ESA hoja
  // (`permisoEdicionMako`): lo decide acá el server, antes de gastar un token, no el modelo ni el botón.
  const permiso = permisoEdicionMako(body, hoja.id);
  if (!permiso.ok) return NextResponse.json({ ok: false, error: permiso.error, analizar: true }, { status: 409 });
  const escrito = typeof body?.pedido === 'string' ? body.pedido.trim().slice(0, TOPE_PEDIDO_IA) : '';
  if (!escrito && !adjuntos.length) return err(400, 'Escribe qué quieres cambiar.');
  // Los archivos se leen ANTES (lib/adjuntos-del-chat.ts); la cascada arranca su plazo después de leerlos.
  const { lecturas, noLeidos } = await leerLosArchivos(adjuntos, 'graficos-editar');
  if (adjuntos.length && !lecturas.length && !escrito) return err(422, `No pude leer ${noLeidos.map((n) => `«${n}»`).join(', ')}: escribe qué quieres cambiar.`);
  const pedido = escrito || 'Usa lo que traen estos archivos para esta hoja.';
  const archivos = lecturas.length ? lecturaDeArchivos(lecturas, TOPE_LECTURA_EDICION) : undefined;

  const r = await editarHojaIA({ hoja, pedido, historial: historialDe(body?.historial), alcance: general ? ALCANCE_GENERAL : undefined, inicio: adjuntos.length ? Date.now() : inicio, archivos });
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error, ...(r.link ? { link: r.link } : {}) }, { status: 502 });
  if (r.correcciones.length) console.log('[graficos/editar] aceptada con correcciones:', r.correcciones.join(' | '));
  // `analizar` (#862): pidió un análisis, no un cambio; la hoja no se tocó y el panel ofrece pasar a «Analizar».
  const avisos = noLeidos.length ? [...r.avisos, `No pude leer ${noLeidos.map((n) => `«${n}»`).join(', ')}.`] : r.avisos;
  return NextResponse.json({ ok: true, respuesta: r.respuesta, cambios: r.cambios, avisos, analizar: r.analizar, ...(r.cambios.length ? { hoja: r.hoja } : {}) });
}
