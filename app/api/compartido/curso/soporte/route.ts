// =============================================================================
// POST /api/compartido/curso/soporte  {t, error, accion?, ruta?, hora?, zona?, navegador?, pantalla?, idioma?}
// =============================================================================
// «Reportar a Soporte» desde el portal del ALUMNO (27/10/2026). Leandro (llamada del 24/10, 874749710-18): su alumno no
// tenía cómo reportar. El botón es el de toda la app (app/_ui/ReportarASoporte.tsx), pero /api/soporte/reportar pide la
// sesión de MaKo y el alumno no la tiene (le contestaba «no autenticado»: por eso el 24/10 se lo escondió). Acá entra con
// SU credencial, el token del portal en el CUERPO, como /progreso y /tarea; desde /mi-curso es el mismo token, traducido
// de su cookie.
//
// EL REPORTE LE LLEGA AL DUEÑO DEL CURSO: el ticket es del dueño del negocio de la firma (`emailDuenoWorkspace`), lo ve él
// en su Ticketera y el equipo de MaKo en la bandeja, y dice que lo reportó un alumno y su ficha (lib/soporte-reporte.ts →
// `ticketDelAlumno`).
//
// ⚠️ EL TOKEN NO ABRE MÁS QUE ESTO: la ruta sólo CREA el ticket y contesta su número. No lee tickets, no elige negocio, ni
//    persona, ni tipo: el workspace sale de la FIRMA, el dueño de la base y el resto lo fija el servidor.
// ⚠️ EL TEXTO LO ESCRIBE UN TERCERO SIN CUENTA (cualquiera con el link): se sanea igual que el del botón con sesión, el
//    error va en el DETALLE (nunca en `contexto.error`) y el ticket NUNCA va solo al arreglo, tampoco con la regla del
//    negocio (`tercero` en lib/tickets-db.ts → `deTercero` en el triage). El tope del día se le cuenta AL ALUMNO
//    (TOPE_POR_DIA_TERCERO), no al dueño, y el mismo error el mismo día es el mismo ticket.
// ⚠️ LA PANTALLA LA PONE EL SERVIDOR (`rutaDelPortal`): el camino del link lleva el token del alumno, su credencial entera.
// ⚠️ Pública de ESCRITURA (lib/rutas-publicas.ts, PUBLICOS_ESCRITURA, ruta exacta), con tope por IP antes de leer nada y
//    del mismo origen, como /api/soporte/reportar: un sitio de afuera no le llena la Ticketera al dueño.

import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { resolverAccesoPortal } from '@/lib/curso-datos';
import { leerJsonTopeado } from '@/lib/curso-portal';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { emailDuenoWorkspace } from '@/lib/usuarios';
import { SIN_ACCESO_PORTAL } from '@/lib/curso-portal-aviso';
import { crearTicket, identidadDe } from '@/lib/tickets-db';
import { TOPE_BYTES, claveDelAlumno, rutaDelPortal, sanearReporteSoporte, semillaDeRef, ticketDelAlumno } from '@/lib/soporte-reporte';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status, headers: SIN_CACHE });
// Un token malo, revocado o de alguien que ya no es cliente: la misma frase que la entrada del portal, sin el porqué.
const NO = () => json({ ok: false, error: SIN_ACCESO_PORTAL }, 404);
const MUCHO = () => json({ ok: false, error: 'Mandaste muchos seguidos: vuelve a tocar en un rato.' }, 429);

export async function POST(req: NextRequest) {
  // Por IP antes de leer nada: corta el barrido de tokens sin tocar la base.
  if (!rateLimit(`curso-soporte:ip:${clientIp(req)}`, 20, 60_000)) return MUCHO();
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return json({ ok: false, error: 'No salió de MaKo' }, 403);

  const cuerpo = await leerJsonTopeado(req, TOPE_BYTES);
  if (!cuerpo.ok) return json({ ok: false, error: cuerpo.status === 413 ? 'El aviso es demasiado largo' : 'No entendí el aviso' }, cuerpo.status);
  const b = (cuerpo.valor && typeof cuerpo.valor === 'object' && !Array.isArray(cuerpo.valor) ? cuerpo.valor : {}) as Record<string, unknown>;
  const token = typeof b.t === 'string' ? b.t : '';
  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAccesoPortal(token);
    if (!acceso) return NO();
    if (!rateLimit(`curso-soporte:lead:${acceso.ws}:${acceso.leadId}`, 10, 3_600_000)) return MUCHO();
    const r = sanearReporteSoporte(b);
    if (!r) return json({ ok: false, error: 'No hay un error que reportar' }, 400);
    try {
      const dueno = await emailDuenoWorkspace(acceso.ws);
      if (!dueno.includes('@')) return json({ ok: false, error: 'No salió. Vuelve a tocar en un rato.' });
      const clave = claveDelAlumno(acceso.ws, acceso.leadId);
      const t = ticketDelAlumno(r, { leadId: acceso.leadId, area: acceso.area });
      const ref = `${clave}:${createHash('sha256').update(semillaDeRef(acceso.ws, clave, { ...r, ruta: rutaDelPortal(r.ruta) })).digest('hex').slice(0, 40)}`;
      const creado = await crearTicket({
        identidad: await identidadDe(acceso.ws, dueno),
        tipo: 'bug', declaradoPor: 'persona',
        titulo: t.titulo, descripcion: t.descripcion, canal: 'formulario', contexto: t.contexto, ref, tercero: { clave },
      });
      if (!creado.ok) return json({ ok: false, error: creado.error });
      return json({ ok: true, id: creado.id, yaExistia: creado.yaExistia });
    } catch (e) {
      console.error('[curso-soporte] no pude levantar el reporte del alumno:', e instanceof Error ? e.message : e);
      return json({ ok: false, error: 'No salió. Vuelve a tocar en un rato.' }, 500);
    }
  });
}
