// =============================================================================
// /api/admin/avisos-demo — crea un grupo de PRUEBAS y manda TODO el catálogo
// =============================================================================
// Solo admin. Crea un grupo nuevo "MaKo · Pruebas 🧪" con el número dado y le
// manda, agrupados por categoría, TODOS los mensajes posibles del catálogo de
// avisos (incluidos los que todavía no tienen lógica). Sirve para ver la voz de
// MaKo de punta a punta. Pensado para correr en dev (manda ~50 mensajes).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { crearGrupoSuelto, enviarAGrupoJid, descripcionGrupoMaKo } from '@/lib/mako-grupo';
import { catalogoPorCategoria, EMOJI_CATEGORIA, type CategoriaAviso } from '@/lib/avisos-catalogo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LABEL: Record<CategoriaAviso, string> = {
  reporte: 'REPORTES', aviso: 'AVISOS', accion: 'ACCIONES (con "¿lo hago?")', pregunta: 'PREGUNTAS',
};
const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { numero?: string; jid?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  const numero = (body.numero ?? '').replace(/\D/g, '');
  // Reusar un grupo existente (jid) o crear uno nuevo de pruebas.
  let jid = body.jid?.trim() || '';
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

  const DELAY = 250; // "escribiendo…" corto para la demo (anti-ban real en producción)
  await enviarAGrupoJid(jid, `🧪 *Demo de avisos de MaKo*\n\nAcá te mando TODOS los mensajes que MaKo te puede llegar a mandar (reportes, avisos, acciones y preguntas), con datos de ejemplo. Los agrupo por tipo. Algunos ya funcionan y otros son la voz de lo que viene. — MaKo`, DELAY);
  await sleep(500);

  for (const cat of ORDEN) {
    const items = porCat[cat];
    if (!items.length) continue;
    await enviarAGrupoJid(jid, `━━━━━━━━━━━━━━\n${EMOJI_CATEGORIA[cat]} *${LABEL[cat]}*  ·  ${items.length}\n━━━━━━━━━━━━━━`, DELAY);
    await sleep(500);
    for (const a of items) {
      const r = await enviarAGrupoJid(jid, a.ejemplo, DELAY);
      if (r.ok) enviados++; else fallos.push(a.id);
      await sleep(600);
    }
  }

  return NextResponse.json({ ok: true, jid, enviados, fallos });
}
