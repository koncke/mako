// =============================================================================
// POST /api/compartido/curso/tarea  {t, c, valores, enviar, a?}  ·  {t, c, a?, aprobar}
// =============================================================================
// (`aprobar` = el cliente aprueba la versión de la IA de esta tarea: el paso 5 de #665, ver abajo.)
//
// Lo que el alumno contestó en la tarea de una clase, desde su portal SIN sesión. `enviar: false`
// guarda el borrador (el botón «Guardar», el autoguardado y el beacon al cerrar la pestaña);
// `enviar: true` la marca ENVIADA si lo contestado alcanza (`respuestaCompleta`). Contesta
// `{progreso, faltaCompletar, avance}`.
//
// Al quedar ENVIADA se llama a `alEnviarTarea` (lib/curso-avance.ts): si con eso completó la etapa
// en la que está, lo pasa a la siguiente y le avisa. Nunca tira por contrato; igual va envuelto,
// porque la tarea YA quedó guardada y eso es lo que no puede perderse por un paso de etapa.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN (`leerTokenPortal(t).ws`), nunca de un parámetro,
// y todo corre adentro de `runWithWorkspace`. Lo que llega en `valores` se sanea contra los
// campos de ESA clase (`sanearValores`, adentro de `guardarTarea`): las claves que la clase no
// tiene se tiran.
//
// ⚠️ LA ETAPA TIENE QUE ESTAR ABIERTA para él (la actual o una anterior). Una clase de una etapa
// bloqueada se ve en el mapa pero no se contesta: 403. Clase inexistente o de un producto que no
// es suyo: 404, igual que un token inválido.
//
// ⚠️ EL TOKEN PUEDE SER EL DEL LÍDER DE UN ÁREA (#665, un `c2.`): `resolverAccesoPortal` lo resuelve
// y el ÁREA SALE DE SU FILA EN LA BASE, nunca del pedido. Con un líder, `claseDelAlumno` abre sólo
// las clases POR ÁREA (otra: 404) y la tarea se guarda SIEMPRE en su área (`areaDeLaTarea`), mande
// lo que mande `a`. El cliente, en una clase por área, elige el área con `a`, y tiene que ser una de
// las que declaró. Un área que no le toca: 404, sin decir por qué.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { resolverAccesoPortal, guardarTarea, estadoDeTareaEnArea, avanceDelCliente, aprobarPropuestaIA } from '@/lib/curso-datos';
import { alEnviarTarea, type ResultadoAvance } from '@/lib/curso-avance';
import { tieneTarea } from '@/lib/curso';
import { claseDelAlumno, areaDeLaTarea, leerJsonTopeado, idDeClase, TOPE_TAREA } from '@/lib/curso-portal';
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

  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAccesoPortal(token);
    if (!acceso) return NO();
    // El autoguardado manda uno cada pocos segundos mientras escribe; 40 por minuto deja margen.
    // ⚠️ Por LEAD, no por acceso: el cliente y sus líderes comparten el tope, así que N links de
    // líderes no multiplican lo que un solo cliente puede escribir.
    if (!rateLimit(`curso-tarea:lead:${acceso.ws}:${acceso.leadId}`, 40, 60_000)) return MUCHO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeEtapa: true, lider: acceso.area });
      if (r.decision !== 'ok') {
        return r.decision === 'bloqueada'
          ? Response.json({ ok: false, error: 'etapa bloqueada' }, { status: 403, headers: SIN_CACHE })
          : NO();
      }
      // Una clase que no pide nada no tiene tarea que guardar: es un pedido armado a mano.
      if (!tieneTarea(r.clase)) return NO();

      // De qué área es lo que se guarda (ver la cabecera). Las áreas del cliente se leen sólo si
      // hacen falta: una clase por área que contesta el cliente.
      const areas = r.clase.porArea === true && acceso.area == null ? (await avanceDelCliente(acceso.leadId)).areas : [];
      const area = areaDeLaTarea(r.clase, acceso, b.a, areas);
      if (area == null) return NO();

      // ── «APROBAR» LA VERSIÓN DE LA IA (paso 5 de #665) ──────────────────────────────────────
      // `aprobar` = el `desde` de la propuesta que el cliente VIO. Pasa por todas las puertas de
      // arriba (la firma, el resolver, la clase de ESTE alumno, la etapa abierta, el área que le toca:
      // un líder aprueba sólo la de su área) y escribe con compare-and-set (`aprobarPropuestaIA`):
      // sólo si sigue pendiente y es la misma. Si no, 409 y no se pisa nada. No manda nada ni mueve
      // de etapa: la tarea ya estaba enviada. «Corregir» no pasa por acá: es mandar su versión con
      // `enviar`, y eso resuelve la propuesta (`guardarTarea`).
      if (typeof b.aprobar === 'string' && b.aprobar) {
        const aprobada = await aprobarPropuestaIA(acceso.leadId, r.clase, area, b.aprobar);
        if (!aprobada) return Response.json({ ok: false, error: 'ya no está' }, { status: 409, headers: SIN_CACHE });
        return Response.json({
          ok: true,
          progreso: { estado: aprobada.estado, valores: aprobada.valores },
          faltaCompletar: false,
          avance: null,
        }, { headers: SIN_CACHE });
      }

      // ⚠️ UN BORRADOR NO PISA UNA TAREA YA ENVIADA. La pantalla sólo autoguarda una pendiente,
      // pero una pestaña vieja (su beacon al ocultarse) o un pedido armado a mano cambiaban lo que
      // Mauricio ya revisó sin reenviarlo, con la ficha diciendo «Revisada». Para cambiar una
      // enviada está «Enviar de nuevo», que vuelve a pasar por la revisión. Se mira la fila de ESA
      // área: el estado de la clase entera (el de todas sus áreas) no dice nada de ésta.
      if (!enviar) {
        const previo = await estadoDeTareaEnArea(acceso.leadId, r.clase.id, area);
        if (previo && previo !== 'pendiente') {
          return Response.json({ ok: false, error: 'ya enviada' }, { status: 409, headers: SIN_CACHE });
        }
      }

      const { progreso, faltaCompletar } = await guardarTarea(acceso.leadId, r.clase, b.valores, enviar, area);

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
