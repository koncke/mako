// =============================================================================
// /api/admin/avisos-demo — crea un grupo de PRUEBAS y manda TODO el catálogo
// =============================================================================
// Solo admin. Crea un grupo nuevo "MaKo · Pruebas 🧪" con el número dado y le
// manda, agrupados por categoría, TODOS los mensajes posibles del catálogo de
// avisos (incluidos los que todavía no tienen lógica). Sirve para ver la voz de
// MaKo de punta a punta. Pensado para correr en dev (manda ~50 mensajes).
//
// ⚠️ CON EL RITMO DE LA CASA (4/11/2026, lib/mako-salida-reglas.ts): ~50 mensajes seguidos por la línea de MaKo a 250 ms eran una
// ráfaga, la señal de cuenta automatizada que nombra WhatsApp. Ahora cada uno lleva su «escribiendo…» normal y unos segundos entre
// uno y otro, con variación. Y el `jid` tiene que ser un grupo: a una persona, MaKo no le manda 50 mensajes.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { crearGrupoSuelto, enviarAGrupoJid, descripcionGrupoMaKo } from '@/lib/mako-grupo';
import { catalogoPorCategoria, EMOJI_CATEGORIA, type CategoriaAviso } from '@/lib/avisos-catalogo';

export const dynamic = 'force-dynamic';
// ~50 mensajes con el ritmo de la casa son unos 6 minutos: el tope de fluid compute.
export const maxDuration = 800;

const LABEL: Record<CategoriaAviso, string> = {
  reporte: 'REPORTES', aviso: 'AVISOS', accion: 'ACCIONES (con "¿lo hago?")', pregunta: 'PREGUNTAS',
};
const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Entre mensaje y mensaje: 2 a 4 s, con variación. */
const pausa = () => sleep(2000 + Math.round(Math.random() * 2000));

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { numero?: string; jid?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  const numero = (body.numero ?? '').replace(/\D/g, '');
  // Reusar un grupo existente (jid) o crear uno nuevo de pruebas.
  let jid = body.jid?.trim() || '';
  if (jid && !jid.endsWith('@g.us')) return NextResponse.json({ ok: false, error: 'el jid tiene que ser de un grupo (@g.us)' }, { status: 400 });
  if (!jid) {
    if (!numero) return NextResponse.json({ ok: false, error: 'pasa numero o jid' }, { status: 400 });
    const g = await crearGrupoSuelto('MaKo · Pruebas 🧪', [numero], descripcionGrupoMaKo('Pruebas'));
    if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: 500 });
    jid = g.jid;
    await sleep(1500);
  }

  const porCat = catalogoPorCategoria();
  let enviados = 0;
  const fallos: string[] = [];

  await enviarAGrupoJid(jid, `🧪 *Demo de avisos de MaKo*\n\nAquí te mando TODOS los mensajes que MaKo te puede llegar a mandar (reportes, avisos, acciones y preguntas), con datos de ejemplo. Los agrupo por tipo. Algunos ya funcionan y otros son la voz de lo que viene. — MaKo`);
  await pausa();

  for (const cat of ORDEN) {
    const items = porCat[cat];
    if (!items.length) continue;
    await enviarAGrupoJid(jid, `━━━━━━━━━━━━━━\n${EMOJI_CATEGORIA[cat]} *${LABEL[cat]}*  ·  ${items.length}\n━━━━━━━━━━━━━━`);
    await pausa();
    for (const a of items) {
      const r = await enviarAGrupoJid(jid, a.ejemplo);
      if (r.ok) enviados++; else fallos.push(a.id);
      await pausa();
    }
  }

  return NextResponse.json({ ok: true, jid, enviados, fallos });
}
