// =============================================================================
// /api/plan-fathom — extraer tareas del plan desde una reunión de Fathom (G3)
// =============================================================================
// POST { action:'reuniones' }                         → { ok, reuniones:[…], borradores, descartadas (las «Sin leer») }
// POST { action:'extraer', recordingId, proyectos:[{id,emoji,nombre}], uso? }
//      → con caché: { ok, tareas:[…], cached:true, borradorId } (al instante, sin IA)
//      → sin caché: { ok, procesando:true, borradorId } — la lectura sigue en `after()` (16/10/2026)
// POST { action:'estado-borrador', id, conReunion? }  → el sondeo del modal
//
// ⛔ Acá vivía `action:'cruzar'` (el cruce con IA contra el tablero, que llamaban los dos modales
// al abrirse). Se fue el 16/10/2026: el cruce corre del lado del server (lib/reunion-cruce.ts).
// Solo super-admin: usa la Fathom key de la agencia (la misma del Closing Analyst)
// y alimenta el PlanBoard (localStorage). El transcript es contenido no confiable.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listReunionesRecientes, extraerTareasDeTexto, cacheKeyReunion, type ProyectoRef, type Yo, type TareaCandidata, type Participante } from '@/lib/plan-fathom';
import { guardarTermino } from '@/lib/glosario';
import { resolverClienteDeReunion, nombreDeProyectoPara, opcionesDeCliente } from '@/lib/reunion-cliente';
import { getSetting } from '@/lib/settings';
import { esFechaValida } from '@/lib/date-utils';
import { resumenPropuestasPorRefs, crearPropuesta, estadoDePropuesta, ponerProcesando, RESUMEN_SIN_COMPROMISOS } from '@/lib/plan-propuesta';
import { completarBorradorDeArchivos } from '@/lib/importar-en-segundo-plano';
import { completarBorradorDeReunion, tareasDeLaExtraccion, extrasDeLectura } from '@/lib/leer-reunion-en-segundo-plano';
import { tomarLectura, leyendoAhora } from '@/lib/reunion-leyendo';
import { listarDescartadas, marcarDescartadaLeida } from '@/lib/reunion-descartadas';
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
    const cli = await resolverClienteDeReunion({ titulo, participantes }).catch(() => null);
    const proyCliente = cli ? await nombreDeProyectoPara(cli).catch(() => '') : '';
    const mias = tareas.filter((t) => !t.esDeOtro).length;
    return await crearPropuesta({
      ref: `fathom:${recordingId}`,
      origen: 'fathom',
      fuenteTitulo: titulo ?? undefined,
      resumen: `MaKo leyó «${titulo ?? 'la reunión'}» y sacó ${mias} compromiso${mias === 1 ? '' : 's'} tuyo${mias === 1 ? '' : 's'}.`,
      // El map vive en UN lugar desde el 16/10/2026 (`tareasDeLaExtraccion`): lo comparte con la
      // lectura en segundo plano. Copiado acá, el que se quedaba viejo perdía `minuto` o `recurrente`.
      tareas: tareasDeLaExtraccion(tareas, proyectos, proyCliente),
      // El cliente va al borrador: «Cargar» (sin IA) lo necesita para abrir su proyecto.
      clienteNombre: cli?.nombre, clienteLeadId: cli?.leadId,
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
      after(() => completarBorradorDeArchivos({ ws, borradorId, archivos, proyectos, yo, hasta: Date.now() + 285_000 }));

      return Response.json({ ok: true, borradorId, estado: 'procesando', procesando: true, archivos: archivos.map((a) => a.nombre) });
    } catch (e) {
      console.error(`[api:plan-fathom] archivo: ${msg(e)}`);
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  let body: { action?: string; recordingId?: number; proyectos?: ProyectoRef[]; uso?: string; titulo?: string; cursor?: string; recordedAfter?: string; termino?: string; definicion?: string; reanalizar?: boolean; id?: string; conReunion?: boolean };
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
      // LAS QUE EL CRON NO LEYÓ (mig 0300, 16/10/2026): las que descartó por tipo (ventas u «otra»)
      // y las que iban al plan y fallaron, con su motivo, para la lista corta «Sin leer» con «Leer
      // igual». Sólo en la primera página (no depende del cursor) y sin las que ya tienen borrador
      // (se leyeron después, por otro lado o en un reintento). `null` = no se pudo leer: la lista no
      // aparece, en vez de decir «ninguna» sobre una lectura que falló.
      let descartadas: Awaited<ReturnType<typeof listarDescartadas>> = null;
      if (!cursor) {
        const todas = await listarDescartadas();
        if (todas) {
          const conBorrador = await resumenPropuestasPorRefs(todas.map((d) => `fathom:${d.recordingId}`)).catch(() => ({} as Record<string, unknown>));
          descartadas = todas.filter((d) => !conBorrador[`fathom:${d.recordingId}`]);
        }
      }
      return Response.json({ ok: true, reuniones, nextCursor, borradores, descartadas });
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
        minuto: t.minuto, minutos: t.minutos, recurrente: t.recurrente,
      }));
            // `guardadas` es el MISMO array con otro nombre: `tareas` ya lo consume el modal de
      // sondeo con la forma de candidata, y meterle la revisión adentro lo rompía. Dos
      // nombres, dos consumidores, cero sorpresas.
      const guardadas = est.tareas.map((t) => ({ titulo: t.titulo, enriquece: t.enriquece, incluir: t.incluir, ampliar: t.ampliar }));
      // UNA REUNIÓN LEÍDA EN SEGUNDO PLANO (16/10/2026): cuando el sondeo del modal la ve terminada,
      // necesita lo mismo que antes devolvía `extraer` de un saque —las dudas del glosario, a qué
      // cliente va y, si no lo sabe, las opciones para preguntar—. Sólo si el modal lo pide
      // (`conReunion`): son lecturas del CRM que el resto de los sondeos no necesita.
      let reunion: Record<string, unknown> = {};
      const rid = est.ref?.startsWith('fathom:') ? Number(est.ref.slice(7)) : NaN;
      if (body.conReunion === true && est.estado === 'pendiente' && Number.isFinite(rid)) {
        const ex = await extrasDeLectura(rid);
        const participantes = ex?.participantes ?? [];
        const cli = await resolverClienteDeReunion({ titulo: est.fuenteTitulo ?? null, participantes }).catch(() => null);
        const cliente = cli ? { nombre: cli.nombre, empresa: cli.empresa, proyecto: await nombreDeProyectoPara(cli), email: cli.email } : null;
        const opcionesCliente = cliente ? [] : await opcionesDeCliente({ participantes }).catch(() => []);
        reunion = { dudas: ex?.dudas ?? [], participantes, partesFallidas: ex?.partesFallidas ?? 0, cliente, opcionesCliente };
      }
      // «Sin compromisos» también es 'fallado' (lib/plan-propuesta.ts, `marcarSinCompromisos`): el
      // modal lo dibuja como una lectura vacía, con «Volver a analizar», y no como un error.
      const sinCompromisos = est.estado === 'fallado' && est.resumen === RESUMEN_SIN_COMPROMISOS;
      return Response.json({ ok: true, estado: est.estado, n: est.n, resumen: est.resumen, tareas, guardadas, cruzadoAt: est.cruzadoAt, sinCompromisos, ...reunion });
    }
    // Guardar un término del glosario (punto 7): la respuesta del usuario a "¿qué es X?".
    if (body.action === 'glosario-guardar') {
      await guardarTermino(String(body.termino ?? ''), String(body.definicion ?? ''));
      return Response.json({ ok: true });
    }
    // ⛔ `action:'cruzar'` (el «Gate del Perro», punto 8) se fue el 16/10/2026: era una llamada de
    // IA que el NAVEGADOR disparaba al abrir el modal, y el modal no dejaba cargar mientras tanto.
    // Ahora el borrador llega ya cruzado y sellado desde el server (lib/reunion-cruce.ts). Un
    // modal viejo que todavía lo pida recibe «acción desconocida» y carga igual: el cruce es una
    // ayuda, no un paso (`aplicarPropuestas` tiene su propio anti-duplicado).
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
      // «Leer igual» (o cualquier lectura a mano): si el cron la había descartado, sale de la lista
      // «Descartadas». No se borra nada: queda `leida_at` (mig 0300).
      await marcarDescartadaLeida(recordingId);
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
      // ── EN SEGUNDO PLANO (16/10/2026, «Fathom sin fricción»). Hasta ese día esto leía la reunión
      // ENTERA adentro del pedido —1 a 5 minutos medidos en vivo— con el modal girando, y si lo
      // cerrabas no había dónde ver qué pasó. Ahora es el molde de los archivos (más arriba): el
      // borrador de ESA reunión queda en 'procesando', la respuesta sale al instante con su id, y la
      // lectura sigue en `after()` (lib/leer-reunion-en-segundo-plano.ts). El modal mira el borrador:
      // puedes cerrarlo y seguir usando la app; cuando termina, aparece en tus pendientes.
      //
      // ⚠️ UNA LECTURA A LA VEZ (lib/reunion-leyendo.ts): el cron y el webhook también leen. Si otro
      // la está leyendo, no se lanza una segunda: ése llena este mismo borrador al terminar
      // (`crearPropuesta` llena una fila 'procesando').
      const ref = `fathom:${recordingId}`;
      const previo = (await resumenPropuestasPorRefs([ref]).catch(() => ({} as Record<string, never>)))[ref];
      if (previo?.estado === 'procesando' && await leyendoAhora(recordingId)) {
        return Response.json({ ok: true, procesando: true, borradorId: previo.id });
      }
      const leyendo = `Leyendo «${(titulo ?? 'la reunión').slice(0, 120)}»…`;
      const borradorId = await crearPropuesta({ ref, origen: 'fathom', estado: 'procesando', tareas: [], resumen: leyendo, fuenteTitulo: titulo ?? undefined });
      // `crearPropuesta` revive 'descartada' y 'fallado' a 'procesando'. Una que estaba pendiente o
      // aplicada («Volver a analizar») se pone a mano: si no, el sondeo la vería «lista» con lo viejo.
      if (previo && (previo.estado === 'pendiente' || previo.estado === 'aplicada')) await ponerProcesando(borradorId, leyendo);
      if (!(await tomarLectura(recordingId))) {
        return Response.json({ ok: true, procesando: true, borradorId });
      }
      // El ws se captura ACÁ: `after()` corre fuera del runWithWorkspace del pedido. Y el reloj es el
      // de esta ruta (`after()` comparte su maxDuration de 300 s), con margen para escribir.
      const ws = (await getWorkspaceActual()) ?? OWNER_WS;
      const hasta = Date.now() + 285_000;
      after(() => completarBorradorDeReunion({ ws, borradorId, recordingId, titulo, proyectos, yo, uso, hasta }));
      return Response.json({ ok: true, procesando: true, borradorId });
    }
    return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:plan-fathom] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
