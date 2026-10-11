// =============================================================================
// api-mako/areas/mako.run — los cuerpos del área `mako`
// =============================================================================
// Las tres de pendientes delegan en lib/api-mako/acciones.ts, que es donde vive el
// ciclo (reclamar → ejecutar → resolver). Nada de lógica acá.
// =============================================================================

import { wsEnContexto, getWorkspaceActual } from '@/lib/workspace';
import 'server-only';
import type { Ctx, Runners } from '../tipos';
import { listarPendientes, confirmarPendiente, cancelarPendiente, RUTA_BANDEJA } from '../acciones';
import { canalKeyDe, canalDeClave, etiquetaDeCanal } from '../canal';
import { porId } from '../registro';
import { vistaDe } from '../vista';
import { pendientePorId, contarPendientesVigentes, propuestasAccionFallidas, propuestaConAplicacion, contarBandejas, MIN_SIN_RESULTADO } from './mako.helpers';
import { propuestasPendientes } from '@/lib/propuestas';
import { rutaDePropuesta, PANTALLA_DE_PROPUESTA } from '@/lib/propuestas-tipos';
import { listPropuestasPendientes } from '@/lib/plan-propuesta';
import { CAPACIDADES } from '@/lib/mako-capacidades';
import { TODOS_LOS_ITEMS } from '@/app/_components/nav';
import { linkApp } from '@/lib/app-url';
import { linkPantalla } from '../link';

const num = (input: Record<string, unknown>, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (msg: string) => ({ content: msg, isError: true });
const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const horasDesde = (iso: string): number | null => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 3_600_000)) : null;
};

/** Las claves de pendientes que ESTE canal puede ver y confirmar; `null` = todas (la
 *  bandeja de la app). Es la misma regla que `vigentesPara` de acciones.ts: WhatsApp
 *  ve su grupo MÁS lo que vino por la API; el resto, solo su clave. */
const clavesDelCanal = (ctx: Ctx): string[] | null => {
  if (ctx.bandeja) return null;
  if (ctx.canal === 'whatsapp') return [ctx.canalKey, canalKeyDe('http', ctx.ws)];
  return [ctx.canalKey];
};

/** Por HTTP solo EXISTEN las propuestas que hizo la API: ni se listan ni se ven por
 *  id (tampoco su resumen, que preparar() arma con el mismo contenido: nombres,
 *  montos, asuntos). Del resto se da solo el conteo y el link a la bandeja. Es la
 *  misma regla que listar_pendientes / ver_pendiente. Las genéricas de la API llevan
 *  datos.canal='http' (acciones.ts); las de contactos, origen 'claude' (crm.run.ts y
 *  /api/agente/lead). Los otros canales tienen a una persona del negocio: ven todo. */
const propuestaVisible = (p: { datos: Record<string, unknown>; origen: string | null }, ctx: Ctx): boolean =>
  ctx.canal !== 'http' || p.datos.canal === 'http' || p.origen === 'claude';

/** El resultado de una propuesta, en lista blanca: acciones.ts guarda además `por`
 *  (el email de quien confirmó) y lo que devuelva ejecutar() en `datos`. */
const resultadoPropuesta = (r: Record<string, unknown> | null) =>
  r && typeof r.ok === 'boolean' ? { ok: r.ok, resumen: typeof r.resumen === 'string' ? r.resumen : null } : null;

/** El texto de una pendiente resuelta termina en « (confirmado por <actor>)», o en
 *  «… por <actor>» al cancelar (acciones.ts): el actor es una persona del equipo y por
 *  HTTP no sale. */
const resultadoPendiente = (txt: string | null, ctx: Ctx): string | null => {
  if (txt == null || ctx.canal !== 'http') return txt;
  return txt
    .replace(/ \(confirmado por (?!la API\))[^)]*\)$/, ' (confirmado por una persona del equipo)')
    .replace(/^(cancelada desde \w+) por .+$/, '$1');
};

const minutosDesde = (iso: string | null): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60_000)) : null;
};

const TOPE_PROPUESTAS = 100;
const TOPE_FALLIDAS = 20;
const DIAS_FALLIDAS = 7;

export const RUNNERS: Runners = {
  listar_pendientes: {
    leer: async (_input, ctx) => {
      const vig = await listarPendientes(ctx);
      if (!vig.length) return 'No hay acciones pendientes de confirmar.';
      return JSON.stringify(vig.map((p) => ({ id: p.id, resumen: p.resumen, origen: p.origen, vence: p.vence })));
    },
  },
  confirmar_accion: {
    correr: async (input, ctx) => {
      const r = await confirmarPendiente(ctx, num(input, 'id'));
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error, ...(r.vigentes ? { vigentes: r.vigentes } : {}) });
      return r.ok ? `✅ Hecho: ${r.resumen}` : `❌ No se pudo: ${r.resumen}`;
    },
  },
  cancelar_accion: {
    correr: async (input, ctx) => {
      const r = await cancelarPendiente(ctx, num(input, 'id'));
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error, ...(r.vigentes ? { vigentes: r.vigentes } : {}) });
      return r.resumen;
    },
  },
  ver_pendiente: {
    leer: async (input, ctx) => {
      const id = num(input, 'id');
      if (id == null) return fallo('Pasa el id de la acción pendiente (de listar_pendientes).');
      const p = await pendientePorId(id);
      const claves = clavesDelCanal(ctx);
      if (!p || (claves && !claves.includes(p.grupoJid))) {
        return fallo(`No encuentro la acción #${id} entre las que se ven desde este canal. Por la API solo se ven las que se propusieron por la API; lo propuesto por WhatsApp o desde la app se revisa en ${linkPantalla(RUTA_BANDEJA)}.`);
      }
      // La lectura no barre vencidas (eso escribe): una 'pendiente' con vence_at en el
      // pasado se informa como vencida, que es lo que ve cualquier confirmación.
      const vencida = p.estado === 'pendiente' && Date.parse(p.venceAt) <= Date.now();
      // 'confirmada' sin resuelto_at = se reclamó y nunca se resolvió. No hay columna
      // con la hora del reclamo, pero reclamar exige que siga vigente: pasados
      // MIN_SIN_RESULTADO minutos del vencimiento, seguro se cortó; antes, puede estar
      // corriendo todavía.
      const colgada = p.estado === 'confirmada' && !p.resueltoAt;
      const cortada = colgada && Date.parse(p.venceAt) < Date.now() && (minutosDesde(p.venceAt) ?? 0) > MIN_SIN_RESULTADO;
      const estado = vencida ? 'vencida' : cortada ? 'sin_resultado' : p.estado;
      const nota = vencida
        ? 'Venció sin que nadie la confirmara: ya no se puede confirmar. Si todavía hace falta, vuelve a proponerla.'
        : cortada
          ? `Se confirmó y la ejecución nunca dejó resultado: pudo haber escrito a medias. NO la vuelvas a proponer sin revisar antes en MaKo si se hizo (${linkPantalla(RUTA_BANDEJA)}).`
          : colgada
            ? 'Se confirmó y todavía no hay resultado: puede estar ejecutándose o haberse cortado. Vuelve a consultarla en unos minutos antes de proponerla otra vez.'
            : null;
      return json({
        id: p.id, operacion: porId(p.tipo)?.id ?? p.tipo, titulo: porId(p.tipo)?.titulo ?? null, resumen: p.resumen,
        estado,
        ...(nota ? { nota } : {}),
        resultado: resultadoPendiente(p.resultado, ctx),
        origen: etiquetaDeCanal(p.grupoJid), canal: canalDeClave(p.grupoJid),
        creada_utc: p.createdAt, vence_utc: p.venceAt, resuelta_utc: p.resueltoAt,
        bandeja: linkPantalla(RUTA_BANDEJA),
      });
    },
  },
  listar_propuestas_revisar: {
    leer: async (_input, ctx) => {
      const [ps, fallidas] = await Promise.all([
        propuestasPendientes('accion'),
        propuestasAccionFallidas(DIAS_FALLIDAS, TOPE_FALLIDAS),
      ]);
      const opDe = (datos: Record<string, unknown>) => {
        const op = String(datos.operacion ?? '');
        return { operacion: op, titulo: porId(op)?.titulo ?? null };
      };
      const psVis = ps.filter((p) => propuestaVisible(p, ctx));
      const fallVis = fallidas.filter((f) => propuestaVisible(f, ctx));
      const fuera = (total: number, vis: number) => (total > vis
        ? { otras_fuera_de_la_api: total - vis, nota_fuera: 'Por la API solo se listan las propuestas que hizo la API; el resto se revisa en la bandeja.' }
        : {});
      return json({
        bandeja: linkPantalla(PANTALLA_DE_PROPUESTA.accion.bandeja),
        pendientes: {
          tope: TOPE_PROPUESTAS, recortado: ps.length >= TOPE_PROPUESTAS, ...fuera(ps.length, psVis.length),
          propuestas: psVis.map((p) => ({
            id: p.id, ...opDe(p.datos), resumen: p.resumen, origen: p.origen,
            url: linkPantalla(rutaDePropuesta(p.tipo, p.id)),
            creada_utc: p.createdAt, horas_esperando: horasDesde(p.createdAt),
          })),
        },
        fallidas_al_aplicar: {
          ventana_dias: DIAS_FALLIDAS, tope: TOPE_FALLIDAS, recortado: fallidas.length >= TOPE_FALLIDAS, ...fuera(fallidas.length, fallVis.length),
          nota: `Se confirmaron en la pantalla y NO quedaron hechas; ya no vuelven a la bandeja. Con sin_resultado=false la ejecución falló y no se hizo: si todavía hace falta, vuelve a proponerla. Con sin_resultado=true se empezó a aplicar y no dejó resultado en más de ${MIN_SIN_RESULTADO} min, así que pudo haber escrito a medias: revisa en MaKo antes de volver a proponerla.`,
          propuestas: fallVis.map((f) => ({
            id: f.id, ...opDe(f.datos), resumen: f.resumen, origen: f.origen, sin_resultado: f.sinResultado,
            motivo: typeof f.resultado?.resumen === 'string' ? f.resultado.resumen : null,
            url: linkPantalla(rutaDePropuesta('accion', f.id)), aplicada_utc: f.appliedAt,
          })),
        },
      });
    },
  },
  ver_propuesta_accion: {
    leer: async (input, ctx) => {
      const id = str(input, 'id');
      if (!id) return fallo('Pasa el id de la propuesta (empieza con «prop»).');
      const p = await propuestaConAplicacion(id);
      if (!p || !propuestaVisible(p, ctx)) {
        return fallo(`No encuentro la propuesta «${id}» entre las que se ven desde este canal. Por la API solo se ven las que propuso la API; el resto se revisa en ${linkPantalla(PANTALLA_DE_PROPUESTA.accion.bandeja)}.`);
      }
      const url = linkPantalla(rutaDePropuesta(p.tipo === 'lead' ? 'lead' : 'accion', p.id));
      const base = { id: p.id, tipo: p.tipo, estado: p.estado, origen: p.origen, resumen: p.resumen, creada_utc: p.createdAt, url };
      if (p.tipo !== 'accion') {
        return json({ ...base, nota: 'Es una propuesta de contactos: sus datos se revisan en la pantalla del link, no por aquí.' });
      }
      const op = String(p.datos.operacion ?? '');
      const def = porId(op);
      const operacion = def && def.tipo === 'accion'
        ? { id: def.id, titulo: def.titulo, escribe: def.escribe, reversible: def.reversible }
        : { id: op, titulo: null, ...(p.estado === 'pendiente' ? { nota: 'Esa operación ya no existe en MaKo: la propuesta no se puede aplicar.' } : {}) };
      const resultado = resultadoPropuesta(p.resultado);
      // aplicarPropuestaGenerica (acciones.ts) marca {en_curso:true} ANTES de ejecutar
      // y pisa con {ok} al terminar: 'aplicada' sin `ok` es «se está aplicando» o, pasados
      // MIN_SIN_RESULTADO minutos, «se cortó en el medio». Leerla como hecha es mentir.
      const aplicada = p.estado === 'aplicada';
      const minutos = minutosDesde(p.appliedAt);
      const sinOk = aplicada && resultado == null;
      const cortada = sinOk && (minutos == null || minutos > MIN_SIN_RESULTADO);
      const estadoReal = !aplicada ? p.estado : cortada ? 'sin_resultado' : sinOk ? 'aplicandose' : resultado?.ok ? 'hecha' : 'fallida';
      const nota = !aplicada ? null
        : cortada ? `Se empezó a aplicar y no quedó resultado: pudo haber escrito a medias. NO la vuelvas a proponer sin revisar antes en ${url}.`
        : sinOk ? 'Se está aplicando en este momento: vuelve a consultarla en unos minutos.'
        : resultado?.ok === false ? 'Se confirmó y la ejecución FALLÓ: no se hizo lo que proponía.'
        : null;
      return json({
        ...base, estado_real: estadoReal, operacion,
        ...(aplicada ? { aplicada_ok: resultado?.ok ?? null, aplicada_utc: p.appliedAt } : {}),
        ...(nota ? { nota } : {}),
        datos: p.datos.payload ?? {}, resultado,
      });
    },
  },
  resumen_bandejas_confirmacion: {
    leer: async (_input, ctx) => {
      const vista = await vistaDe(ctx);
      const tiene = (key: string) => vista.tabs == null || vista.tabs.includes(key);
      const tieneCrm = tiene('crm');
      const tienePlan = tiene('todo');
      // allSettled: una bandeja que falla da n:null con su nota, no tira el resumen.
      const [chatR, conteosR, borradoresR] = await Promise.allSettled([
        contarPendientesVigentes(clavesDelCanal(ctx)),
        contarBandejas(DIAS_FALLIDAS),
        tienePlan ? listPropuestasPendientes(TOPE_PROPUESTAS) : Promise.resolve(null),
      ]);
      const chat = chatR.status === 'fulfilled' ? chatR.value : { total: null, delCanal: null };
      const c = conteosR.status === 'fulfilled' ? conteosR.value : { acciones: null, leads: null, fallidas: null, crmAuto: null };
      const NULO = { nota: 'No se pudo leer esta bandeja: null no es cero.' };
      const nulo = (n: number | null) => (n == null ? NULO : {});
      const bandejaAcciones = linkPantalla(PANTALLA_DE_PROPUESTA.accion.bandeja);
      const borradores = borradoresR.status === 'fulfilled' ? borradoresR.value : null;
      return json({
        acciones_chat: { n: chat.total, n_confirmables_desde_este_canal: chat.delCanal, url: linkPantalla(RUTA_BANDEJA), ...nulo(chat.total) },
        acciones_revisar: { n: c.acciones, url: bandejaAcciones, ...nulo(c.acciones) },
        acciones_fallidas_al_aplicar: {
          n: c.fallidas, ventana_dias: DIAS_FALLIDAS, url: bandejaAcciones,
          ...(c.fallidas == null ? NULO : { nota: `Fallaron, o se empezaron a aplicar y no dejaron resultado en más de ${MIN_SIN_RESULTADO} min.` }),
        },
        ...(tieneCrm ? { contactos: { n: c.leads, url: linkPantalla(PANTALLA_DE_PROPUESTA.lead.bandeja), ...nulo(c.leads) } } : {}),
        ...(tienePlan ? {
          borradores_plan: borradores
            ? {
                n: borradores.length, tope: TOPE_PROPUESTAS, recortado: borradores.length >= TOPE_PROPUESTAS, url: linkApp('/plan', wsEnContexto()),
                nota: `Se leen los ${TOPE_PROPUESTAS} borradores más nuevos y después se descartan los vacíos: si hay más, el número puede quedar corto.`,
              }
            : { n: null, url: linkApp('/plan', wsEnContexto()), ...NULO },
        } : {}),
        ...(tieneCrm ? { confirmaciones_crm: { n: c.crmAuto, url: linkApp('/crm', await getWorkspaceActual()), como: 'Aparecen como aviso al entrar al CRM, repartidas por producto.', ...nulo(c.crmAuto) } } : {}),
        bandejas_que_este_negocio_no_tiene: [...(tieneCrm ? [] : ['contactos', 'confirmaciones_crm']), ...(tienePlan ? [] : ['borradores_plan'])],
      });
    },
  },
  listar_capacidades_mako: {
    leer: async (input, ctx) => {
      const id = str(input, 'id');
      const vista = await vistaDe(ctx);
      // La lista no conoce capas: cada ruta se cruza con el item del nav que la abre,
      // y queda solo si la capa del negocio incluye esa key. En positivo: con una capa
      // restringida, una ruta que no cae en ningún item del nav no sale.
      const disponible = (ruta: string): boolean => {
        // Sin la query: una capacidad puede apuntar a `/dashboard?hoja=closing`, y el `match` del nav mira el camino.
        const item = TODOS_LOS_ITEMS.find((i) => i.match(ruta.split(/[?#]/)[0]));
        if (vista.tabs != null && (!item || !vista.tabs.includes(item.key))) return false;
        if (vista.rol !== 'admin' && !(item?.rolesWs?.length)) return false;
        return true;
      };
      const pedidas = id ? CAPACIDADES.filter((c) => c.id === id) : CAPACIDADES;
      if (id && !pedidas.length) return fallo(`No existe la capacidad «${id}».`);
      const visibles = pedidas.filter((c) => disponible(c.ruta));
      if (id && !visibles.length) return fallo(`«${id}» no está disponible en este negocio (su tab no está en el plan contratado o no la ve tu rol).`);
      return json({
        capacidades: visibles.map((c) => ({ id: c.id, tab: c.tab, url: linkPantalla(c.ruta), que: c.que, como: c.como })),
        ...(visibles.length < pedidas.length ? { fuera_de_este_negocio: pedidas.length - visibles.length } : {}),
      });
    },
  },
};
