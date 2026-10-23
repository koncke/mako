// =============================================================================
// POST /api/soporte/reportar — el botón «Reportar a Soporte» de un aviso de error (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «SIEMPRE que sale un error, en donde sea, debe aparecer el botón de "Reportar a Soporte" y que cuando
// lo apreten se mande automático un mensaje aquí [su Ticketera] reportando solo lo que pasó». Lo manda el botón único
// (app/_ui/ReportarASoporte.tsx); el ticket es un bug que la persona marcó, con el error en su DETALLE, y lo ve ella en su
// Ticketera. ⚠️ El error NO va en `contexto.error` (lib/soporte-reporte.ts → ticketDelReporte): lo puede escribir cualquiera con
// sesión, y el triage lo leería como «el sistema lo vio fallar» y lo mandaría al arreglo automático.
//
// ⚠️ DE QUIÉN ES, SÓLO DE LA SESIÓN: el workspace y el email salen de `getUsuarioActual` / `getWorkspaceActual`. Nada del
//    cuerpo elige el negocio ni la persona: el ticket es de SU workspace y lo ven ella y el equipo de MaKo.
// ⚠️ DEL MISMO ORIGEN y con un tope de tamaño, como /api/errores: un sitio de afuera no llena la Ticketera.
// ⚠️ SE SANEA ACÁ OTRA VEZ (lib/soporte-reporte.ts): sin claves, sin emails ni teléfonos, sin la query de la pantalla.
// ⚠️ El tope del día de la persona (TOPE_POR_DIA, lib/tickets-db.ts) también vale: un aviso que se repite no es soporte.

import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { crearTicket, identidadDe } from '@/lib/tickets-db';
import { TOPE_BYTES, sanearReporteSoporte, semillaDeRef, ticketDelReporte } from '@/lib/soporte-reporte';

export const dynamic = 'force-dynamic';

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return json({ ok: false, error: 'No salió de MaKo' }, 403);
  const s = await getUsuarioActual();
  const ws = await getWorkspaceActual();
  if (!s?.email?.includes('@') || !ws) return json({ ok: false, error: 'Vuelve a entrar a MaKo para mandarlo' }, 401);
  // El tope, antes de leer el cuerpo (lo que dice que mide) y después (lo que midió de verdad).
  if (Number(req.headers.get('content-length') ?? 0) > TOPE_BYTES) return json({ ok: false, error: 'El aviso es demasiado largo' }, 413);
  const texto = await req.text();
  if (texto.length > TOPE_BYTES) return json({ ok: false, error: 'El aviso es demasiado largo' }, 413);
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(texto); } catch { return json({ ok: false, error: 'No entendí el aviso' }, 400); }
  const r = sanearReporteSoporte(cuerpo);
  if (!r) return json({ ok: false, error: 'No hay un error que reportar' }, 400);

  const email = s.email.trim().toLowerCase();
  const t = ticketDelReporte(r);
  const ref = `soporte:${createHash('sha256').update(semillaDeRef(ws, email, r)).digest('hex').slice(0, 40)}`;
  const creado = await crearTicket({
    identidad: await identidadDe(ws, email, s.nombre ?? ''),
    tipo: 'bug', declaradoPor: 'persona',
    titulo: t.titulo, descripcion: t.descripcion, canal: 'formulario', contexto: t.contexto, ref,
  });
  if (!creado.ok) return json({ ok: false, error: creado.error }, 200);
  return json({ ok: true, id: creado.id, yaExistia: creado.yaExistia });
}
