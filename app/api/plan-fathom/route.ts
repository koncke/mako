// =============================================================================
// /api/plan-fathom — extraer tareas del plan desde una reunión de Fathom (G3)
// =============================================================================
// POST { action:'reuniones' }                         → { ok, reuniones:[…] }
// POST { action:'extraer', recordingId, proyectos:[{id,emoji,nombre}], uso? }
//                                                      → { ok, tareas:[…], usage? }
// Solo super-admin: usa la Fathom key de la agencia (la misma del Closing Analyst)
// y alimenta el PlanBoard (localStorage). El transcript es contenido no confiable.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listReunionesRecientes, extraerTareasDeReunion, extraerTareasDeTexto, cacheKeyReunion, type ProyectoRef, type Yo, type TareaCandidata, type Participante } from '@/lib/plan-fathom';
import { glosarioTexto, guardarTermino } from '@/lib/glosario';
import { resolverClienteDeReunion, nombreDeProyectoPara, opcionesDeCliente } from '@/lib/reunion-cliente';
import { getSetting, setSetting } from '@/lib/settings';
import { cruzarCandidatas } from '@/lib/mako-guardian';
import { esFechaValida } from '@/lib/date-utils';
import { resumenPropuestasPorRefs, crearPropuesta, estadoDePropuesta } from '@/lib/plan-propuesta';
import { completarBorradorDeArchivos } from '@/lib/importar-en-segundo-plano';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
// 300s porque una reunión larga se extrae POR PARTES (lib/plan-fathom → trocear): son
// varias llamadas en paralelo y el timeout interno de la IA escala con maxTokens. Con
// 120 la función de Vercel moría antes de que la IA pudiera siquiera rendirse.
export const maxDuration = 300;

import { createHash } from 'node:crypto';
import { archivoATexto } from '@/lib/archivo-a-texto';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
      // VARIOS archivos, no uno. El modal manda `file` repetido (y acepta `file0..N`
      // por compatibilidad con lo que ya estaba).
      const files = form.getAll('file').filter((f): f is File => f instanceof File);
      if (!files.length) return Response.json({ ok: false, error: 'Falta el archivo.' }, { status: 400 });
      if (files.length > 12) return Response.json({ ok: false, error: 'Máximo 12 archivos por vez.' }, { status: 400 });

      // ── ACÁ NO SE LEE NADA. Leer un .md de 6 KB y extraerle las tareas tardó 122
      // segundos MEDIDOS: más de lo que sobrevive la respuesta HTTP. Antes esto se
      // hacía adentro del request y el modal giraba para siempre; si lo cerrabas,
      // dos minutos de IA a la basura.
      //
      // Ahora el request solo hace lo barato: copia los bytes, crea el borrador VACÍO
      // en 'procesando' y devuelve su id. La lectura sigue en `after()`, después de que
      // la respuesta ya salió, y cuando termina llena ese mismo borrador. El modal mira
      // el borrador: puede cerrarse, volver más tarde o quedarse esperando.
      //
      // Los bytes se copian a un File nuevo a propósito: el File de `formData()` puede
      // estar respaldado por el stream del request, que muere con la respuesta. Copiarlo
      // cuesta memoria (hasta 18 MB, el techo del proxy) y compra que `after()` tenga
      // qué leer.
      const bytes = await Promise.all(files.map(async (f) => ({ nombre: f.name, buf: await f.arrayBuffer(), tipo: f.type })));
      const archivos = bytes.map((b) => ({ nombre: b.nombre, file: new File([b.buf], b.nombre, { type: b.tipo }) }));

      // El `ref` es el hash del CONTENIDO: volver a subir el mismo archivo devuelve el
      // borrador que ya existe en vez de pagar la extracción otra vez (mismo candado que
      // usan las reuniones con fathom:<recordingId>). Antes se hasheaba el texto ya
      // extraído — o sea, después de pagar; hasheando los bytes el candado sirve.
      const huella = createHash('sha1');
      for (const b of bytes) huella.update(Buffer.from(b.buf));
      const ref = `archivo:${huella.digest('hex').slice(0, 24)}`;

      // Si ese archivo YA se leyó y quedó pendiente, no se vuelve a leer: se devuelve.
      const yaEsta = (await resumenPropuestasPorRefs([ref]).catch(() => ({} as Record<string, never>)))[ref];
      if (yaEsta && (yaEsta.estado === 'pendiente' || yaEsta.estado === 'aplicada')) {
        return Response.json({ ok: true, borradorId: yaEsta.id, estado: yaEsta.estado, yaEstaba: true, n: yaEsta.creadas });
      }

      const proyectos = proyectosDe(JSON.parse(String(form.get('proyectos') ?? '[]')));
      const etiqueta = archivos.length === 1 ? archivos[0].nombre : `${archivos.length} archivos`;
      const borradorId = await crearPropuesta({
        tareas: [], origen: 'archivo', ref, estado: 'procesando',
        resumen: `Leyendo ${etiqueta}…`, fuenteTitulo: etiqueta,
      });

      // El ws se captura ACÁ: `after()` corre fuera del runWithWorkspace del request y
      // el AsyncLocalStorage no viaja. Sin esto, el borrador se llenaría en el ws
      // equivocado (o en ninguno).
      const ws = (await getWorkspaceActual()) ?? OWNER_WS;
      after(() => completarBorradorDeArchivos({ ws, borradorId, archivos, proyectos, yo }));

      return Response.json({ ok: true, borradorId, estado: 'procesando', procesando: true, archivos: archivos.map((a) => a.nombre) });
    } catch (e) {
      console.error(`[api:plan-fathom] archivo: ${msg(e)}`);
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  let body: { action?: string; recordingId?: number; proyectos?: ProyectoRef[]; uso?: string; titulo?: string; cursor?: string; recordedAfter?: string; termino?: string; definicion?: string; reanalizar?: boolean; candidatas?: Array<{ titulo?: string; detalle?: string }>; existentes?: Array<{ id?: string; titulo?: string; detalle?: string }>; id?: string };
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
    // ── ¿Ya terminó de leer? El modal pregunta cada pocos segundos mientras la lectura
    // corre en segundo plano. Es barato (una fila) y NO hace trabajo: solo mira.
    if (body.action === 'estado-borrador') {
      const est = await estadoDePropuesta(String(body.id ?? ''));
      if (!est) return Response.json({ ok: false, error: 'Ese borrador no existe.' }, { status: 404 });
      // Las tareas viajan con la forma que espera el modal (proyectoNombre, no proyecto).
      //
      // ⚠️ VAN TAMBIÉN `enriquece`, `incluir` y `ampliar`, que antes se caían acá. Son LA
      // REVISIÓN: el resultado del cruce contra el plan y lo que el dueño decidió sobre
      // cada fila. Sin ellos, volver a abrir la reunión devolvía las tareas «vírgenes» y
      // el modal la comparaba con el plan otra vez —una llamada de IA y su espera— y
      // encima pisaba lo que él ya había destildado. Y `minuto`/`minutos` con ellos: sin
      // esos, la tarjeta pierde el link al momento de la grabación.
      const tareas = est.tareas.map((t) => ({
        titulo: t.titulo, detalle: t.detalle ?? '', prioridad: t.prioridad ?? 'media',
        proyectoId: null, proyectoNombre: t.proyecto ?? '',
        dueño: t.dueno ?? '', dueñoEmail: t.duenoEmail ?? '', esDeOtro: !!t.esDeOtro,
        enriquece: t.enriquece, incluir: t.incluir, ampliar: t.ampliar,
        minuto: t.minuto, minutos: t.minutos,
      }));
            // `guardadas` es el MISMO array con otro nombre: `tareas` ya lo consume el modal de
      // sondeo con la forma de candidata, y meterle la revisión adentro lo rompía. Dos
      // nombres, dos consumidores, cero sorpresas.
      const guardadas = est.tareas.map((t) => ({ titulo: t.titulo, enriquece: t.enriquece, incluir: t.incluir, ampliar: t.ampliar }));
      return Response.json({ ok: true, estado: est.estado, n: est.n, resumen: est.resumen, tareas, guardadas, cruzadoAt: est.cruzadoAt });
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
