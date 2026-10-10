// =============================================================================
// disparadores-guardar — guardar los CRON de una automatización (la lista entera)
// =============================================================================
// Lo llama POST /api/chat-agent/secuencias `{ action: 'disparadores', secuenciaId, disparadores }`
// (sexta tanda del Chatbot, CRON punto 10), y la API de MaKo (`cambiar_crons_secuencia`, con
// `prepararDisparadores` para chequear sin escribir). El modelo y las reglas puras viven en
// lib/disparadores.ts; acá se valida contra el NEGOCIO (que la etapa, el producto y la etiqueta
// existan) y se escribe:
//   · el PRIMERO en las columnas de siempre (`columnasDeDisparador`): las leen quince lugares que no
//     saben de listas;
//   · la LISTA entera en `disparadores` (mig 0241), con compare-and-set por `disparadores_rev`: la
//     escribe también el motor al avanzar la ocurrencia de un Recurrente que no es el primero
//     (`reclamarOcurrenciaExtra`, lib/nutricion.ts), y un guardado a ciegas le pisaría el avance.
//
// ⚠️ LA PRÓXIMA OCURRENCIA DE UN HORARIO QUE NO CAMBIÓ SE CONSERVA. Recalcularla en cada guardado
// (tocar «A quién», cambiar el evento de OTRO CRON) correría el ancla a «ahora», y un «todos los
// lunes» guardado un lunes a las 10 saltaba al lunes siguiente: la ocurrencia de hoy a las 9 ya
// estaba reclamada o se perdía. Sólo un horario nuevo o distinto siembra la suya, y sembrar no
// dispara (lib/nutricion-agenda.ts): la primera es estrictamente posterior a ahora.
//
// ⚠️ LO QUE NO CAMBIÓ NO SE VUELVE A VALIDAR. Un CRON colgado de una etapa que alguien borró del
// kanban (y que por eso no dispara) no puede impedir que se edite OTRO CRON de la misma
// automatización: la persona quedaría sin salida. Se valida lo nuevo o lo distinto.

import 'server-only';
import { getTenantDb } from './workspace';
import {
  sanearDisparadores, problemaDeDisparadores, disparadoresDe, columnasDeDisparador, conProximas, nuevosOCambiados,
  TRIGGERS_NUEVOS, TOPE_DISPARADORES, type Disparador, type FilaDisparadores,
} from './disparadores';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA, etapasDe } from './nutricion-etapa';
import { tzActual, TZ_DEFAULT } from './timezone';
import { esColumnaInexistente } from './nutricion-grafo-motor';
import { productosConEtapas, TriggerInvalidoError } from './setting-secuencias';

const COLS = 'id, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at';

type FilaLeida = { row: FilaDisparadores; rev: number | null };

/** La fila, con la lista si la 0241 está y sin ella si no (sólo con la COLUMNA que falta). */
async function leerFila(db: Awaited<ReturnType<typeof getTenantDb>>, id: number): Promise<FilaLeida | null> {
  const con = await db.from('nutricion_secuencias').select(`${COLS}, disparadores, disparadores_rev`).eq('id', id).maybeSingle();
  if (!con.error) {
    const r = con.data as (FilaDisparadores & { disparadores_rev?: number | null }) | null;
    return r ? { row: r, rev: Number(r.disparadores_rev ?? 0) } : null;
  }
  if (!esColumnaInexistente(con.error)) throw new Error(`guardarDisparadores (leer): ${con.error.message}`);
  const sin = await db.from('nutricion_secuencias').select(COLS).eq('id', id).maybeSingle();
  if (sin.error) throw new Error(`guardarDisparadores (leer): ${sin.error.message}`);
  return sin.data ? { row: sin.data as FilaDisparadores, rev: null } : null;
}

/**
 * Lo que tiene que existir en ESTE negocio para que un CRON dispare. Tira `TriggerInvalidoError` con
 * el motivo (la ruta lo contesta 400): una etapa de otro producto, un producto archivado o una
 * etiqueta borrada no dispararían NUNCA, sin un error — y eso se ataja al guardar, no en el log de un
 * cron (AGENTS.md).
 */
async function validarContraElNegocio(nuevos: readonly Disparador[]): Promise<void> {
  if (!nuevos.length) return;
  const productos = nuevos.some((d) => d.trigger_tipo === TRIGGER_ETAPA || d.trigger_tipo === TRIGGER_ENTREGA) ? await productosConEtapas() : [];
  const { TRIGGERS } = await import('./email-marketing');
  const db = await getTenantDb();
  for (const d of nuevos) {
    const t = d.trigger_tipo;
    const keys = etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null });
    if (t === TRIGGER_ETAPA) {
      for (const key of keys) {
        if (d.funnel_id == null) {
          if (!productos.some((pr) => pr.etapas.some((e) => e.value === key))) throw new TriggerInvalidoError(`La etapa «${key}» no existe en ninguno de tus productos.`);
        } else {
          const pr = productos.find((x) => x.funnelId === d.funnel_id);
          if (!pr) throw new TriggerInvalidoError('Ese producto no existe o está archivado.');
          if (!pr.etapas.some((e) => e.value === key)) throw new TriggerInvalidoError(`«${key}» no es una etapa de ${pr.nombre}.`);
        }
      }
    } else if (t === TRIGGER_ENTREGA) {
      const pr = productos.find((x) => x.productoId === d.producto_id);
      if (!pr) throw new TriggerInvalidoError('Ese producto no existe o está archivado.');
      for (const key of keys) if (!pr.etapasEntrega.some((e) => e.value === key)) throw new TriggerInvalidoError(`«${key}» no es una etapa de la entrega de ${pr.nombre}.`);
    } else if (t === TRIGGER_ETIQUETA) {
      const { data, error } = await db.from('crm_etiquetas').select('id, archivada_at').eq('id', d.etiqueta_id ?? 0).maybeSingle();
      if (error) throw new Error(`guardarDisparadores (etiqueta): ${error.message}`);
      const et = data as { archivada_at: string | null } | null;
      if (!et) throw new TriggerInvalidoError('Esa etiqueta no existe en este negocio.');
      if (et.archivada_at) throw new TriggerInvalidoError('Esa etiqueta está archivada.');
    } else if (t !== 'manual' && !TRIGGERS_NUEVOS.includes(t) && !TRIGGERS.some((x) => x.value === t)) {
      throw new TriggerInvalidoError(`«${t}» no es un disparador de las automatizaciones.`);
    }
  }
}

/** La lista que llegó, saneada y con lo que le falta dicho (sin leer la base). */
function listaValida(entrada: unknown): Disparador[] {
  if (!Array.isArray(entrada)) throw new TriggerInvalidoError('Falta la lista de CRON.');
  if (entrada.length > TOPE_DISPARADORES) throw new TriggerInvalidoError(`Hasta ${TOPE_DISPARADORES} CRON.`);
  const lista = sanearDisparadores(entrada);
  if (lista.length !== entrada.length) throw new TriggerInvalidoError('Hay un CRON que no se entiende.');
  const problema = problemaDeDisparadores(lista);
  if (problema) throw new TriggerInvalidoError(problema);
  return lista;
}

/**
 * TODO LO QUE `guardarDisparadores` CHEQUEA, SIN ESCRIBIR (segunda pasada de la sexta tanda, 09/10/2026).
 * Lo usa la API de MaKo (`cambiar_crons_secuencia`, lib/api-mako/areas/chatbot.run.ts) en su
 * `preparar()`: AGENTS.md, «todo lo que se pueda saber sin escribir falla en preparar()» — una
 * propuesta con una etapa que no existe se rechazaría recién al confirmar, con la pendiente ya
 * consumida. Devuelve la lista saneada y la de antes (para decir qué cambia y si cambia algo).
 */
export async function prepararDisparadores(secuenciaId: number, entrada: unknown): Promise<{ lista: Disparador[]; previos: Disparador[] }> {
  const lista = listaValida(entrada);
  const fila = await leerFila(await getTenantDb(), secuenciaId);
  if (!fila) throw new TriggerInvalidoError('Esa automatización no existe en este negocio.');
  const previos = disparadoresDe(fila.row);
  await validarContraElNegocio(nuevosOCambiados(lista, previos));
  if (fila.rev == null && lista.length > 1) throw new TriggerInvalidoError('Aún no se pueden varios CRON.');
  return { lista, previos };
}

/**
 * GUARDA LA LISTA ENTERA DE CRON y devuelve la que quedó (con la próxima ocurrencia de cada horario).
 * Sin la 0241, guarda UNO (el primero, en las columnas) y con dos o más contesta «Aún no se pueden
 * varios CRON»: guardar sólo el primero sería guardar otra cosa que lo elegido, en silencio.
 */
export async function guardarDisparadores(secuenciaId: number, entrada: unknown): Promise<Disparador[]> {
  const lista = listaValida(entrada);

  const db = await getTenantDb();
  const tz = await tzActual().catch(() => TZ_DEFAULT);
  // Hasta tres vueltas: si el motor avanzó una ocurrencia entre la lectura y la escritura, se vuelve
  // a leer (para conservar su avance) y se reintenta.
  for (let intento = 0; intento < 3; intento++) {
    const fila = await leerFila(db, secuenciaId);
    if (!fila) throw new TriggerInvalidoError('Esa automatización no existe en este negocio.');
    const previos = disparadoresDe(fila.row);
    if (intento === 0) await validarContraElNegocio(nuevosOCambiados(lista, previos));
    const ahora = new Date();
    const conProxima = conProximas(lista, previos, ahora, tz);
    const primero = conProxima[0];
    const cols = { ...columnasDeDisparador(primero), cron_proxima_at: primero.cron ? primero.cron_proxima_at : null, updated_at: ahora.toISOString() };
    if (fila.rev == null) {
      if (conProxima.length > 1) throw new TriggerInvalidoError('Aún no se pueden varios CRON.');
      const { error } = await db.from('nutricion_secuencias').update(cols).eq('id', secuenciaId);
      if (error) throw new Error(`guardarDisparadores: ${error.message}`);
      return conProxima;
    }
    const { data, error } = await db.from('nutricion_secuencias')
      .update({ ...cols, disparadores: conProxima, disparadores_rev: fila.rev + 1 })
      .eq('id', secuenciaId).eq('disparadores_rev', fila.rev)
      .select('id');
    if (error) throw new Error(`guardarDisparadores: ${error.message}`);
    if ((data ?? []).length) return conProxima;
  }
  throw new Error('La automatización cambió mientras se guardaba: prueba de nuevo.');
}
