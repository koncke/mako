// =============================================================================
// POST /api/compartido/curso/progreso  {t, c, seg, dur}  ó  {t, c, hecha: true|false}
// =============================================================================
// Hasta dónde vio un video el alumno, desde su portal SIN sesión (/compartido/curso/<token>).
// Lo manda el reproductor cada ~10 s mientras reproduce, en pausa, al terminar y —por
// `navigator.sendBeacon`— al cerrar la pestaña. Contesta el progreso ya guardado.
//
// ⚠️ NUNCA LLEGA UN %: llegan segundos y duración, y el % lo calcula `guardarVisto` (lo más lejos
// que llegó sobre lo que dura, sin retroceder). Un % armado en el navegador es el que el
// navegador quiera.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN, nunca de un parámetro: `leerTokenPortal(t).ws`, y
// todo adentro de `runWithWorkspace` (sin sesión, `getTenantDb` caería al workspace por defecto,
// el de Mauricio — y en una prueba con un cliente de Mauricio se vería perfecto).
//
// Es pública de ESCRITURA (lib/rutas-publicas.ts, PUBLICOS_ESCRITURA, ruta exacta): la credencial
// es el token, que viaja en el CUERPO y que el navegador no manda solo. Token inválido, revocado o
// clase ajena: 404 genérico, igual que si no existiera.
//
// ⚠️ DESDE EL 08/10/2026 SE EXIGE QUE LA CLASE ESTÉ ABIERTA, como en /tarea y /video. Antes no:
// es la ruta que más pega —un pedido cada 10 s por cada video abierto— y lo único que se podía
// grabar armando el pedido a mano era un número sin consecuencias. Ya no es sin consecuencias: «vio
// el 90 %» y «la marcó hecha» COMPLETAN una clase sin tarea, y completar ABRE lo que espera a «la
// anterior» (D2, lib/curso-bloqueo.ts). Grabarlo sobre una clase cerrada sería abrirse el curso a
// mano. El costo es la ronda de lecturas del candado en cada pedido (la zona, el inicio y el nivel
// se leen sólo si algún candado los necesita: lib/curso-modulos-datos.ts, `contextoDelAlumno`).
//
// `{hecha}`: el alumno marca como hecha (o desmarca) una clase SIN tarea — el tilde de Skool. Una
// clase con tarea no se marca: se completa enviándola (404, como un pedido armado a mano).

//
// ⚠️ EL TOKEN PUEDE SER EL DEL LÍDER DE UN ÁREA (#665, `c2.`): sólo abre clases POR ÁREA
// (`claseDelAlumno` con `lider`), y lo que ve queda en la fila del CLIENTE (`guardarVisto` explica
// por qué cuánto se vio un video no se parte por área).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { resolverAccesoPortal, guardarVisto, marcarHecha } from '@/lib/curso-datos';
import { tieneTarea } from '@/lib/curso';
import { claseDelAlumno, leerJsonTopeado, idDeClase, TOPE_PROGRESO, videoDeClase } from '@/lib/curso-portal';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { marcarActividadDeLead } from '@/lib/comunidad-datos';

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
  // `hecha` sólo como booleano: un `'true'` o un 1 armados a mano no marcan nada.
  const hecha = typeof b.hecha === 'boolean' ? b.hecha : null;
  if (!claseId || (hecha == null && (!Number.isFinite(seg) || seg < 0))) return NO();

  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAccesoPortal(token);
    if (!acceso) return NO();
    // «En línea» en la comunidad (mig 0217) cuenta también la actividad en el curso. El líder de un
    // área no es miembro de la comunidad: escribiría con el nombre del cliente. No tira (ver ahí).
    if (acceso.area == null) void marcarActividadDeLead(acceso.leadId);
    // Por alumno: seis por minuto por video es lo normal; esto deja varias pestañas y pausas.
    if (!rateLimit(`curso-progreso:lead:${acceso.ws}:${acceso.leadId}`, 60, 60_000)) return MUCHO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeAbierta: true, lider: acceso.area, alcance: acceso.alcance });
      if (r.decision !== 'ok') return NO();
      if (hecha != null) {
        // El líder de un área no completa clases por el cliente: su portal es el de sus tareas.
        if (acceso.area != null || tieneTarea(r.clase)) return NO();
        const p = await marcarHecha(acceso.leadId, r.clase, hecha);
        return Response.json({ ok: true, progreso: { hecha: !!p.hechaAt } }, { headers: SIN_CACHE });
      }
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
