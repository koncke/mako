// =============================================================================
// /api/plan-fathom — extraer tareas del plan desde una reunión de Fathom (G3)
// =============================================================================
// POST { action:'reuniones' }                         → { ok, reuniones:[…] }
// POST { action:'extraer', recordingId, proyectos:[{id,emoji,nombre}], uso? }
//                                                      → { ok, tareas:[…], usage? }
// Solo super-admin: usa la Fathom key de la agencia (la misma del Closing Analyst)
// y alimenta el PlanBoard (localStorage). El transcript es contenido no confiable.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listReunionesRecientes, extraerTareasDeReunion, extraerTareasDeTexto, cacheKeyReunion, type ProyectoRef, type Yo, type TareaCandidata, type Participante } from '@/lib/plan-fathom';
import { glosarioTexto, guardarTermino } from '@/lib/glosario';
import { resolverClienteDeReunion, nombreDeProyectoPara, opcionesDeCliente } from '@/lib/reunion-cliente';
import { getSetting, setSetting } from '@/lib/settings';
import { cruzarCandidatas } from '@/lib/mako-guardian';
import { esFechaValida } from '@/lib/date-utils';
import { resumenPropuestasPorRefs, crearPropuesta } from '@/lib/plan-propuesta';

export const dynamic = 'force-dynamic';
// 300s porque una reunión larga se extrae POR PARTES (lib/plan-fathom → trocear): son
// varias llamadas en paralelo y el timeout interno de la IA escala con maxTokens. Con
// 120 la función de Vercel moría antes de que la IA pudiera siquiera rendirse.
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MAX_ARCHIVO = 2 * 1024 * 1024; // 2 MB de md/txt/transcript alcanza y sobra

const proyectosDe = (raw: unknown): ProyectoRef[] =>
  Array.isArray(raw)
    ? raw.filter((p): p is ProyectoRef => !!p && typeof (p as ProyectoRef).id === 'string').map((p) => ({ id: String(p.id), emoji: String(p.emoji ?? ''), nombre: String(p.nombre ?? '') }))
    : [];

/**
 * Responde la extracción diciendo A QUÉ CLIENTE va la reunión. Si no hay certeza
 * manda las OPCIONES para que el modal pregunte una sola vez, en vez de dejar 15
 * tareas repartidas por tema — que es lo que hacía el modelo cuando decidía él.
 */
/**
 * El BORRADOR de una reunión, creado SIEMPRE que haya tareas. Es lo que hace que la
 * extracción quede guardada: sin esto vivía solo en el estado de React y al volver
 * atrás no quedaba nada — había que darle a "cargar al plan" para que existiera.
 *
 * Se llama desde los DOS caminos (extracción fresca y cache) porque `crearPropuesta`
 * es idempotente por `ref`: si ya hay una fila para esta grabación devuelve la que
 * está, no crea una segunda. Devuelve el id (o '' si falló) para que el modal pueda
 * marcar la reunión como leída y guardar las correcciones sobre esa misma fila.
 */
async function asegurarBorrador(
  recordingId: number,
  titulo: string | null,
  proyectos: ProyectoRef[],
  tareas: TareaCandidata[],
  participantes: Participante[],
): Promise<string> {
  try {
    const nombreProy = new Map(proyectos.map((pr) => [pr.id, pr.nombre]));
    const cli = await resolverClienteDeReunion({ titulo, participantes }).catch(() => null);
    const proyCliente = cli ? await nombreDeProyectoPara(cli).catch(() => '') : '';
    const mias = tareas.filter((t) => !t.esDeOtro).length;
    return await crearPropuesta({
      ref: `fathom:${recordingId}`,
      origen: 'fathom',
      fuenteTitulo: titulo ?? undefined,
      resumen: `MaKo leyó «${titulo ?? 'la reunión'}» y sacó ${mias} compromiso${mias === 1 ? '' : 's'} tuyo${mias === 1 ? '' : 's'}.`,
      tareas: tareas.map((t) => ({
        titulo: t.titulo, detalle: t.detalle || undefined, prioridad: t.prioridad,
        proyecto: proyCliente || (t.proyectoId ? nombreProy.get(t.proyectoId) : (t.proyectoNombre?.trim() || undefined)),
        dueno: t.dueño || undefined, duenoEmail: t.dueñoEmail || undefined,
        esDeOtro: t.esDeOtro || undefined, minuto: t.minuto, minutos: t.minutos,
      })),
    });
  } catch (e) { console.error(`[api:plan-fathom] borrador: ${msg(e)}`); return ''; }
}

async function conCliente(payload: Record<string, unknown>, titulo: string | null) {
  const participantes = (payload.participantes ?? []) as Array<{ nombre?: string; email?: string | null }>;
  const cli = await resolverClienteDeReunion({ titulo, participantes }).catch(() => null);
  const cliente = cli ? { nombre: cli.nombre, empresa: cli.empresa, proyecto: await nombreDeProyectoPara(cli), email: cli.email } : null;
  const opcionesCliente = cliente ? [] : await opcionesDeCliente({ participantes }).catch(() => []);
  return Response.json({ ok: true, ...payload, cliente, opcionesCliente });
}

export async function POST(req: NextRequest) {
  // Cualquier usuario logueado puede extraer de SU Fathom: la key sale de
  // credWs('FATHOM_API_KEY') que ya está scopeada por workspace (el dueño usa la de
  // la agencia; cada cliente, la suya). Si el workspace no tiene key, falla lindo.
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  const yo: Yo = { nombre: sesion.nombre ?? '', email: sesion.email ?? '' };

  // ── Subida de archivo (punto 5): md/txt/transcript → mismo pipeline de extracción.
  // Va por multipart, no por JSON. Para .md/.txt no hace falta storage: file.text().
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    try {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return Response.json({ ok: false, error: 'Falta el archivo.' }, { status: 400 });
      if (file.size > MAX_ARCHIVO) return Response.json({ ok: false, error: 'El archivo supera 2 MB.' }, { status: 400 });
      const nombre = file.name.toLowerCase();
      if (!/\.(md|txt|vtt|srt)$/.test(nombre)) return Response.json({ ok: false, error: 'Subí un .md, .txt, .vtt o .srt.' }, { status: 400 });
      // 250k chars ≈ 6 horas de transcript. Antes 60k: un .md de una reunión de 2 horas
      // (145k) se cortaba en el minuto 52 y se perdía la mitad de la charla EN SILENCIO.
      // El largo ya no lo resuelve el recorte sino el troceado (extraerTareasDeTexto).
      const texto = (await file.text()).slice(0, 250000);
      const proyectos = proyectosDe(JSON.parse(String(form.get('proyectos') ?? '[]')));
      const glosario = await glosarioTexto().catch(() => '');
      const out = await extraerTareasDeTexto(texto, proyectos, yo, { glosario, usoMotivo: `Extraer tareas del archivo ${file.name}` });
      // Un archivo no trae invitados, así que la única señal del cliente es el nombre
      // del archivo ("Baja Teriyaki - seguimiento.md"). Si no alcanza, el modal pregunta.
      return conCliente(out as unknown as Record<string, unknown>, file.name.replace(/\.[a-z]+$/i, '').replace(/[_-]+/g, ' '));
    } catch (e) {
      console.error(`[api:plan-fathom] archivo: ${msg(e)}`);
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  let body: { action?: string; recordingId?: number; proyectos?: ProyectoRef[]; uso?: string; titulo?: string; cursor?: string; recordedAfter?: string; termino?: string; definicion?: string; reanalizar?: boolean; candidatas?: Array<{ titulo?: string; detalle?: string }>; existentes?: Array<{ id?: string; titulo?: string; detalle?: string }> };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const uso = String(body.uso ?? '').trim() || undefined;

  try {
    if (body.action === 'reuniones') {
      // Una página + cursor (antes traía todo el histórico y tardaba). El selector
      // pide más con nextCursor. recordedAfter = filtro por fecha (ISO), opcional.
      const cursor = typeof body.cursor === 'string' && body.cursor ? body.cursor : undefined;
      const recordedAfter = typeof body.recordedAfter === 'string' && esFechaValida(body.recordedAfter) ? body.recordedAfter : undefined;
      const { reuniones, nextCursor } = await listReunionesRecientes({ cursor, recordedAfter });
      // Qué salió YA de cada una de estas reuniones (mismo request, mismo workspace).
      // Sin esto, el selector ofrece "Extraer →" en una reunión de la que MaKo ya sacó
      // 61 tareas: el usuario paga tokens para que le muestren lo que ya tiene.
      const borradores = await resumenPropuestasPorRefs(reuniones.map((r) => `fathom:${r.recordingId}`)).catch(() => ({}));
      return Response.json({ ok: true, reuniones, nextCursor, borradores });
    }
    // Guardar un término del glosario (punto 7): la respuesta del usuario a "¿qué es X?".
    if (body.action === 'glosario-guardar') {
      await guardarTermino(String(body.termino ?? ''), String(body.definicion ?? ''));
      return Response.json({ ok: true });
    }
    // Gate del Perro (punto 8): cruzar las candidatas contra el plan ACTUAL (que vive
    // en el localStorage del cliente, por eso viaja en el body) para enriquecer en
    // vez de duplicar. Devuelve solo las que ya existen.
    if (body.action === 'cruzar') {
      const candidatas = Array.isArray(body.candidatas) ? body.candidatas.map((c) => ({ titulo: String(c?.titulo ?? ''), detalle: String(c?.detalle ?? '') })) : [];
      const existentes = Array.isArray(body.existentes) ? body.existentes.filter((e) => e?.id).map((e) => ({ id: String(e.id), titulo: String(e.titulo ?? ''), detalle: String(e.detalle ?? '') })) : [];
      const out = await cruzarCandidatas(candidatas, existentes, uso);
      return Response.json({ ok: true, ...out });
    }
    if (body.action === 'extraer') {
      const recordingId = Number(body.recordingId);
      if (!Number.isFinite(recordingId)) return Response.json({ ok: false, error: 'Falta la reunión.' }, { status: 400 });
      const proyectos = proyectosDe(body.proyectos);
      // El título viaja desde el modal porque es la SEGUNDA vía para reconocer al
      // cliente (Fathom devuelve como participante solo al que grabó en media agenda) y
      // porque desde el cache no hay de dónde sacarlo.
      const titulo = typeof body.titulo === 'string' ? body.titulo : null;
      // CACHE por reunión (feedback jul-19): NO re-cobrar tokens si ya extrajimos esta
      // reunión (la transcripción no cambia). Guardamos el resultado y lo devolvemos con
      // `cached:true`. `body.reanalizar===true` fuerza volver a correr Claude si hace falta.
      const cacheKey = cacheKeyReunion(recordingId);
      if (body.reanalizar !== true) {
        const raw = await getSetting(cacheKey).catch(() => null);
        if (raw) {
          try {
            const prev = JSON.parse(raw) as { tareas?: unknown; participantes?: unknown };
            // El cliente NO se cachea: se resuelve también acá. Cacheado se devolvía sin
            // él, así que re-abrir una reunión ya leída decía "no reconocí a ningún
            // cliente" para la misma llamada que la primera vez sí había reconocido.
            if (Array.isArray(prev.tareas)) {
              // El borrador se asegura TAMBIÉN acá. Antes esta rama volvía sin pasar por
              // crearPropuesta, así que una reunión con cache y sin fila en
              // plan_propuestas no se persistía NUNCA — por más veces que la extrajeras
              // se veía la lista y al salir no quedaba nada. crearPropuesta es
              // idempotente por `ref`, así que llamarla de más no duplica.
              const borradorId = await asegurarBorrador(recordingId, titulo, proyectos, prev.tareas as TareaCandidata[], (prev.participantes ?? []) as Participante[]);
              return conCliente({ tareas: prev.tareas, participantes: prev.participantes ?? [], cached: true, borradorId }, titulo);
            }
          } catch { /* cache corrupto → re-extrae */ }
        }
      }
      const glosario = await glosarioTexto().catch(() => '');
      const out = await extraerTareasDeReunion(recordingId, proyectos, yo, { glosario, usoMotivo: uso });
      // Guardar en cache — AWAIT (con `void` el serverless termina antes de escribir y
      // NO quedaba nada cacheado → volvía a cobrar). Re-abrir la misma reunión ya no gasta.
      // Los PARTICIPANTES van al cache a propósito: son la lista blanca contra la que
      // /api/plan-reunion valida a quién se le puede mandar algo de esta reunión.
      // NUNCA se cachea un resultado vacío o leído a medias: ese cache se servía para
      // siempre como "MaKo no encontró nada", escondiendo que la corrida había fallado
      // (y la única salida era descubrir el botón "Volver a analizar (gasta tokens)").
      // Mismo criterio que el cron (lib/reunion-auto.ts).
      // El CACHE solo si la corrida salió entera (uno a medias se serviría para siempre).
      // El BORRADOR, en cambio, se guarda IGUAL: si un tramo del transcript falló, las
      // tareas que sí salieron son reales y perderlas es peor que tenerlas incompletas.
      if (out.tareas.length && !out.partesFallidas) {
        await setSetting(cacheKey, JSON.stringify({ tareas: out.tareas, participantes: out.participantes ?? [], ts: Date.now() })).catch(() => {});
      }
      let borradorId = '';
      if (out.tareas.length) {
        borradorId = await asegurarBorrador(recordingId, titulo, proyectos, out.tareas, out.participantes ?? []);
      }
      // ACÁ NO SE MANDA NINGÚN WHATSAPP, a propósito. Antes esta ruta preguntaba
      // "saqué N compromisos, ¿los cargo?" — y era una pregunta al vacío: el usuario
      // está MIRANDO la lista en la app (la disparó él desde el modal), y la pregunta
      // no quedaba anclada a nada. Cuando contestaba "sí, cargalo" por WhatsApp, el doer
      // no tenía ese turno en su historial, se agarraba de la conversación anterior que
      // encontrara y creaba tareas de OTRO día (pasó: duplicó dos del 26/07).
      // El WhatsApp con lista y link lo manda el CRON (lib/reunion-auto), que es el que
      // sí necesita avisar de algo que el dueño no está viendo.
      // ¿La reunión es con un CLIENTE? Si lo es, TODAS sus tareas van a su proyecto:
      // el tema de cada tarea deja de decidir dónde se archiva. Se resuelve acá (server,
      // contra el CRM) y no en el prompt, porque el modelo ve un título y no el CRM —
      // por eso repartía una misma llamada entre proyectos temáticos inventados.
      // `borradorId` viaja al modal: con eso la lista puede marcar la reunión como YA
      // LEÍDA sin recargar y el modal puede ir guardando las correcciones del usuario
      // sobre esa misma fila (autosave), que antes se perdían al volver atrás.
      return conCliente({ ...(out as unknown as Record<string, unknown>), borradorId }, titulo);
    }
    return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:plan-fathom] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
