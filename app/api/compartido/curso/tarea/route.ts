// =============================================================================
// POST /api/compartido/curso/tarea  {t, c, valores, enviar, a?}  ·  {t, c, a?, aprobar}
// =============================================================================
// (`aprobar` = el cliente aprueba la versión de la IA de esta tarea: el paso 5 de #665, ver abajo.)
//
// Lo que el alumno contestó en la tarea de una clase, desde su portal SIN sesión. `enviar: false`
// guarda el borrador (el botón «Guardar», el autoguardado y el beacon al cerrar la pestaña);
// `enviar: true` la marca ENVIADA si lo contestado alcanza (`respuestaCompleta`). Contesta
// `{progreso, faltaCompletar, avance}`, y desde la #18 (07/10/2026) `calificacion` si corrigió un
// quiz y `descartados` si un archivo no entró (ver «LOS TIPOS DE TAREA DE LA #18», abajo). Un quiz
// sin intentos, o desaprobado sobre una tarea ya enviada, es un 409 con su `calificacion`.
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
import { marcarActividadDeLead } from '@/lib/comunidad-datos';
import {
  tieneTarea, esCampoDeArchivo, sanearValores, respuestaCompleta, corregirEnvio, conQuizzesAprobadosIntactos, seApruebaSola,
  type DuenoEntrega, type ResultadoQuiz,
} from '@/lib/curso';
import { leerEntrega, verificarEntregas, registrarCalificacion, aprobarSola } from '@/lib/curso-entregas';
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
    // «En línea» en la comunidad (mig 0217) cuenta también la actividad en el curso. El líder de un
    // área no es miembro de la comunidad: escribiría con el nombre del cliente. No tira (ver ahí).
    if (acceso.area == null) void marcarActividadDeLead(acceso.leadId);
    // El autoguardado manda uno cada pocos segundos mientras escribe; 40 por minuto deja margen.
    // ⚠️ Por LEAD, no por acceso: el cliente y sus líderes comparten el tope, así que N links de
    // líderes no multiplican lo que un solo cliente puede escribir.
    if (!rateLimit(`curso-tarea:lead:${acceso.ws}:${acceso.leadId}`, 40, 60_000)) return MUCHO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeEtapa: true, lider: acceso.area, alcance: acceso.alcance });
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

      // ── LOS TIPOS DE TAREA DE LA #18 (07/10/2026): entregas y quiz ───────────────────────────
      // Lo que ya estaba guardado se lee UNA vez y sólo si la tarea lo necesita: con archivos (para
      // no volver a preguntarle a Storage por lo que ya entró) o con un quiz (su nota y sus intentos).
      const campos = r.clase.campos;
      const conQuiz = campos.some((c) => c.tipo === 'quiz');
      const conArchivos = campos.some((c) => esCampoDeArchivo(c.tipo));
      const leida = conQuiz || conArchivos;
      const previa = leida ? await leerEntrega(acceso.leadId, r.clase.id, area, conQuiz) : null;

      // ⚠️ UN BORRADOR NO PISA UNA TAREA YA ENVIADA. La pantalla sólo autoguarda una pendiente,
      // pero una pestaña vieja (su beacon al ocultarse) o un pedido armado a mano cambiaban lo que
      // Mauricio ya revisó sin reenviarlo, con la ficha diciendo «Revisada». Para cambiar una
      // enviada está «Enviar de nuevo», que vuelve a pasar por la revisión. Se mira la fila de ESA
      // área: el estado de la clase entera (el de todas sus áreas) no dice nada de ésta.
      if (!enviar) {
        const previo = leida ? previa?.estado : await estadoDeTareaEnArea(acceso.leadId, r.clase.id, area);
        if (previo && previo !== 'pendiente') {
          return Response.json({ ok: false, error: 'ya enviada' }, { status: 409, headers: SIN_CACHE });
        }
      }

      // ⚠️ LAS ENTREGAS SE VERIFICAN ANTES DE GUARDAR, con el DUEÑO que sale de la firma y de la clase:
      // un path que no es de este alumno en esta clase, o que no llegó al bucket, no entra
      // (lib/curso-entregas.ts, `verificarEntregas`). `guardarTarea` vuelve a sanear sin dueño (no lo
      // conoce): lo que pasó esta puerta pasa aquélla igual. `descartados` vuelve a la pantalla.
      const dueno: DuenoEntrega = { ws: acceso.ws, productoId: r.clase.productoId, leadId: acceso.leadId, claseId: r.clase.id };
      let crudo: unknown = b.valores;
      let descartados = 0;
      if (conArchivos) {
        const v = await verificarEntregas(campos, crudo, dueno, previa?.valores ?? null);
        crudo = v.valores;
        descartados = v.descartados;
      }
      // Un quiz ya aprobado no se vuelve a contestar: sus respuestas quedan como estaban.
      if (conQuiz) crudo = conQuizzesAprobadosIntactos(campos, crudo, previa?.valores, previa?.calificacion);

      // ⚠️ EL QUIZ SE CORRIGE ACÁ, EN EL SERVER, con los campos de la BASE (con las correctas, que al
      // navegador del alumno no llegan: `camposParaAlumno`). Sólo un ENVÍO completo se corrige: uno al
      // que le falta contestar no gasta un intento (sale por `faltaCompletar`, como siempre).
      let quiz: ResultadoQuiz | null = null;
      if (enviar && conQuiz) {
        const v = sanearValores(campos, crudo, dueno);
        if (respuestaCompleta(r.clase, v)) quiz = corregirEnvio(campos, v, previa?.calificacion, new Date().toISOString());
      }
      if (quiz?.tipo === 'sin-intentos') {
        return Response.json({ ok: false, error: 'sin intentos', calificacion: quiz.calificacion }, { status: 409, headers: SIN_CACHE });
      }
      const corregido = quiz?.tipo === 'corregido' ? quiz : null;
      // ⚠️ UN QUIZ DESAPROBADO NO DEJA LA TAREA ENVIADA: se guarda como borrador (lo contestado no se
      // pierde, el intento sí se cuenta) y el alumno ve su nota y reintenta. Un envío con el quiz
      // abajo de la nota mínima no cierra una etapa.
      const desaprobo = corregido != null && !corregido.aprobado;
      if (desaprobo && previa && previa.estado !== 'pendiente') {
        // Una tarea YA enviada (con su quiz aprobado) que vuelve con un quiz nuevo desaprobado: lo
        // enviado no se pisa con un borrador (la regla de arriba). Se cuenta el intento y se dice.
        await registrarCalificacion(acceso.leadId, r.clase.id, area, corregido.calificacion);
        return Response.json({ ok: false, error: 'no aprobó', calificacion: corregido.calificacion }, { status: 409, headers: SIN_CACHE });
      }

      const { progreso, faltaCompletar } = await guardarTarea(acceso.leadId, r.clase, crudo, enviar && !desaprobo, area);
      if (corregido) await registrarCalificacion(acceso.leadId, r.clase.id, area, corregido.calificacion);

      // Aprobado y sin nada más que pida una revisión: la tarea queda APROBADA sola (`seApruebaSola`).
      let estado = progreso.estado;
      if (corregido?.aprobado && progreso.estado === 'enviada' && seApruebaSola(campos)) {
        if (await aprobarSola(acceso.leadId, r.clase.id, area)) estado = 'aprobada';
      }

      let avance: ResultadoAvance | null = null;
      if (enviar && !desaprobo && !faltaCompletar && progreso.estado === 'enviada') {
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
        progreso: { estado, valores: progreso.valores },
        faltaCompletar,
        avance: avance ? { movido: avance.movido, hacia: avance.hacia ?? null } : null,
        // La nota del quiz recién corregido (la pantalla la dice), y cuántos archivos no entraron.
        ...(corregido ? { calificacion: corregido.calificacion } : {}),
        ...(descartados ? { descartados } : {}),
      }, { headers: SIN_CACHE });
    } catch (e) {
      console.error('[curso-portal] no pude guardar la tarea:', e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'no se pudo guardar' }, { status: 500, headers: SIN_CACHE });
    }
  });
}
