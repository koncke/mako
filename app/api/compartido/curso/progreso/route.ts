// =============================================================================
// POST /api/compartido/curso/progreso  {t, c, seg, dur}
// =============================================================================
// Hasta dónde vio un video el alumno, desde su portal SIN sesión (/compartido/curso/<token>).
// Lo manda el reproductor cada ~10 s mientras reproduce, en pausa, al terminar y —por
// `navigator.sendBeacon`— al cerrar la pestaña. Contesta el progreso ya guardado.
//
// ⚠️ NUNCA LLEGA UN %: llegan segundos y duración, y el % lo calcula `guardarVisto` (lo más lejos
// que llegó sobre lo que dura, sin retroceder). Un % armado en el navegador es el que el
// navegador quiera.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN, nunca de un parámetro: `leerAccesoCurso(t).ws`, y
// todo adentro de `runWithWorkspace` (sin sesión, `getTenantDb` caería al workspace por defecto,
// el de Mauricio — y en una prueba con un cliente de Mauricio se vería perfecto).
//
// Es pública de ESCRITURA (lib/rutas-publicas.ts, PUBLICOS_ESCRITURA, ruta exacta): la credencial
// es el token, que viaja en el CUERPO y que el navegador no manda solo. Token inválido, revocado o
// clase ajena: 404 genérico, igual que si no existiera.
//
// ⚠️ ACÁ NO SE EXIGE QUE LA ETAPA ESTÉ ABIERTA (en /tarea y /video sí). Es la ruta que más
// pega —un pedido cada 10 s por cada video abierto— y la etapa cuesta otra ronda de lecturas;
// un reproductor de una etapa bloqueada no se dibuja ni se sirve, así que lo único que se
// podría grabar armando el pedido a mano es un número sobre una clase de SU producto. La
// pertenencia al producto sí se valida siempre.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerAccesoCurso } from '@/lib/curso-acceso';
import { resolverAcceso, guardarVisto } from '@/lib/curso-datos';
import { claseDelAlumno, leerJsonTopeado, idDeClase, TOPE_PROGRESO, videoDeClase } from '@/lib/curso-portal';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
const NO = () => Response.json({ ok: false }, { status: 404, headers: SIN_CACHE });
const MUCHO = () => Response.json({ ok: false, error: 'demasiados pedidos' }, { status: 429, headers: SIN_CACHE });

const numero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);

export async function POST(req: NextRequest) {
  // Por IP antes de leer nada: corta el barrido de tokens sin tocar la base.
  if (!rateLimit(`curso-progreso:ip:${clientIp(req)}`, 240, 60_000)) return MUCHO();

  const cuerpo = await leerJsonTopeado(req, TOPE_PROGRESO);
  if (!cuerpo.ok) return Response.json({ ok: false }, { status: cuerpo.status, headers: SIN_CACHE });
  const b = (cuerpo.valor && typeof cuerpo.valor === 'object' ? cuerpo.valor : {}) as Record<string, unknown>;
  const token = typeof b.t === 'string' ? b.t : '';
  const claseId = idDeClase(b.c);
  const seg = numero(b.seg);
  const dur = numero(b.dur);
  if (!claseId || !Number.isFinite(seg) || seg < 0) return NO();

  const firma = leerAccesoCurso(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAcceso(token);
    if (!acceso) return NO();
    // Por alumno: seis por minuto por video es lo normal; esto deja varias pestañas y pausas.
    if (!rateLimit(`curso-progreso:lead:${acceso.ws}:${acceso.leadId}`, 60, 60_000)) return MUCHO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeEtapa: false });
      if (r.decision !== 'ok') return NO();
      // Un video que no se puede medir (Drive, Loom, sin video) no recibe progreso: crearle la fila
      // con `visto_at` lo contaría como «lo vio» sin que nadie lo haya medido.
      if (!videoDeClase(r.clase).medible) return NO();
      const progreso = await guardarVisto(acceso.leadId, r.clase, seg, Number.isFinite(dur) && dur > 0 ? dur : null);
      return Response.json({ ok: true, progreso: { pct: progreso.pct, segundosMax: progreso.segundosMax } }, { headers: SIN_CACHE });
    } catch (e) {
      console.error('[curso-portal] no pude guardar el progreso:', e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'no se pudo guardar' }, { status: 500, headers: SIN_CACHE });
    }
  });
}
