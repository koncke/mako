// =============================================================================
// POST /api/compartido/curso/tarea  {t, c, valores, enviar}
// =============================================================================
// Lo que el alumno contestó en la tarea de una clase, desde su portal SIN sesión. `enviar: false`
// guarda el borrador (el botón «Guardar», el autoguardado y el beacon al cerrar la pestaña);
// `enviar: true` la marca ENVIADA si lo contestado alcanza (`respuestaCompleta`). Contesta
// `{progreso, faltaCompletar, avance}`.
//
// Al quedar ENVIADA se llama a `alEnviarTarea` (lib/curso-avance.ts): si con eso completó la etapa
// en la que está, lo pasa a la siguiente y le avisa. Nunca tira por contrato; igual va envuelto,
// porque la tarea YA quedó guardada y eso es lo que no puede perderse por un paso de etapa.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN (`leerAccesoCurso(t).ws`), nunca de un parámetro,
// y todo corre adentro de `runWithWorkspace`. Lo que llega en `valores` se sanea contra los
// campos de ESA clase (`sanearValores`, adentro de `guardarTarea`): las claves que la clase no
// tiene se tiran.
//
// ⚠️ LA ETAPA TIENE QUE ESTAR ABIERTA para él (la actual o una anterior). Una clase de una etapa
// bloqueada se ve en el mapa pero no se contesta: 403. Clase inexistente o de un producto que no
// es suyo: 404, igual que un token inválido.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerAccesoCurso } from '@/lib/curso-acceso';
import { resolverAcceso, guardarTarea, progresoDelCliente } from '@/lib/curso-datos';
import { alEnviarTarea, type ResultadoAvance } from '@/lib/curso-avance';
import { tieneTarea } from '@/lib/curso';
import { claseDelAlumno, leerJsonTopeado, idDeClase, TOPE_TAREA } from '@/lib/curso-portal';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Guardar es una escritura; el paso de etapa puede mandar un WhatsApp (Evolution retiene el HTTP
// varios segundos). Con 60 s sobra y no queda colgado hasta el tope de la plataforma.
export const maxDuration = 60;

const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
const NO = () => Response.json({ ok: false }, { status: 404, headers: SIN_CACHE });
const MUCHO = () => Response.json({ ok: false, error: 'demasiados pedidos' }, { status: 429, headers: SIN_CACHE });

export async function POST(req: NextRequest) {
  if (!rateLimit(`curso-tarea:ip:${clientIp(req)}`, 120, 60_000)) return MUCHO();

  const cuerpo = await leerJsonTopeado(req, TOPE_TAREA);
  if (!cuerpo.ok) return Response.json({ ok: false }, { status: cuerpo.status, headers: SIN_CACHE });
  const b = (cuerpo.valor && typeof cuerpo.valor === 'object' ? cuerpo.valor : {}) as Record<string, unknown>;
  const token = typeof b.t === 'string' ? b.t : '';
  const claseId = idDeClase(b.c);
  const enviar = b.enviar === true;
  if (!claseId) return NO();

  const firma = leerAccesoCurso(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAcceso(token);
    if (!acceso) return NO();
    // El autoguardado manda uno cada pocos segundos mientras escribe; 40 por minuto deja margen.
    if (!rateLimit(`curso-tarea:lead:${acceso.ws}:${acceso.leadId}`, 40, 60_000)) return MUCHO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeEtapa: true });
      if (r.decision !== 'ok') {
        return r.decision === 'bloqueada'
          ? Response.json({ ok: false, error: 'etapa bloqueada' }, { status: 403, headers: SIN_CACHE })
          : NO();
      }
      // Una clase que no pide nada no tiene tarea que guardar: es un pedido armado a mano.
      if (!tieneTarea(r.clase)) return NO();

      // ⚠️ UN BORRADOR NO PISA UNA TAREA YA ENVIADA. La pantalla sólo autoguarda una pendiente,
      // pero una pestaña vieja (su beacon al ocultarse) o un pedido armado a mano cambiaban lo que
      // Mauricio ya revisó sin reenviarlo, con la ficha diciendo «Revisada». Para cambiar una
      // enviada está «Enviar de nuevo», que vuelve a pasar por la revisión.
      if (!enviar) {
        const previo = (await progresoDelCliente(acceso.leadId)).get(r.clase.id);
        if (previo && previo.estado !== 'pendiente') {
          return Response.json({ ok: false, error: 'ya enviada' }, { status: 409, headers: SIN_CACHE });
        }
      }

      const { progreso, faltaCompletar } = await guardarTarea(acceso.leadId, r.clase, b.valores, enviar);

      let avance: ResultadoAvance | null = null;
      if (enviar && !faltaCompletar && progreso.estado === 'enviada') {
        try {
          avance = await alEnviarTarea({ leadId: acceso.leadId, claseId: r.clase.id });
        } catch (e) {
          // El contrato dice que no tira; si igual tira, la tarea ya está guardada.
          const motivo = e instanceof Error ? e.message : String(e);
          console.error('[curso-portal] el paso de etapa tiró:', motivo);
          avance = { movido: false, motivo };
        }
      }
      return Response.json({
        ok: true,
        progreso: { estado: progreso.estado, valores: progreso.valores },
        faltaCompletar,
        avance: avance ? { movido: avance.movido, hacia: avance.hacia ?? null } : null,
      }, { headers: SIN_CACHE });
    } catch (e) {
      console.error('[curso-portal] no pude guardar la tarea:', e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'no se pudo guardar' }, { status: 500, headers: SIN_CACHE });
    }
  });
}
