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
import { esFallaTragada } from '@/lib/no-pude-frases';
import { canalKeyDe, canalDeClave, etiquetaDeCanal } from '../canal';
import { porId } from '../registro';
import { vistaDe } from '../vista';
import { pendientePorId, contarPendientesVigentes, propuestasAccionFallidas, propuestaConAplicacion, contarBandejas, MIN_SIN_RESULTADO } from './mako.helpers';
import { propuestasPendientes } from '@/lib/propuestas';
import { rutaDePropuesta, PANTALLA_DE_PROPUESTA } from '@/lib/propuestas-tipos';
import { listPropuestasPendientes } from '@/lib/plan-propuesta';
import { CAPACIDADES } from '@/lib/mako-capacidades';
import { funcionesMako } from '@/lib/funciones-mako';
import { TODOS_LOS_ITEMS, USER_NAV } from '@/app/_components/nav';
import { chatsDelSecondBrain, hiloDelSecondBrain } from '@/lib/chat-mako-indice';
import { arbolDelJefe, JEFE_SECOND_BRAIN, sesionDelCanal, tituloDe } from '@/lib/chat-mako-reglas';
import { loQueHizo } from '@/lib/chat-mako-hecho';
import { nombreValido } from '@/lib/centro-chats';
import { renameSession, type ChartSession } from '@/lib/chart-chats';
import { canalKeyDeSesion } from '@/lib/mako-turno-app-reglas';
import { linkApp } from '@/lib/app-url';
import { linkPantalla } from '../link';
import { revalidatePath } from 'next/cache';
import { cambiarRecolector, resumenDelRecolector } from '@/lib/recolector';
import { buscarEnElGrupo } from '@/lib/mako-doer-conv';
import { decidirRecomendacion, leerMemoriaDelNegocio, recomendacionesDe, senalesDelNegocio } from '@/lib/recomendaciones';
import { claveDe, clavesValidas, deSenal, decisionVigente, esDecision, esSuperficie, ultimaDecision, type Superficie } from '@/lib/recomendaciones-reglas';

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
  // ⚠️ LO QUE NO SE CONFIRMA ES UNA REGLA, y lleva la marca de guarda (la verificación de 692368a60): «No hay ninguna acción
  // pendiente vigente», «aclara cuál», «recién la propuse», «la confirma el administrador», «ya venció», el rechazo al tercero.
  // Un control que «salió bien» nunca pasaba por la marca de lib/api-mako/ejecutar.ts, y el «no pude» del modelo abría ticket.
  confirmar_accion: {
    correr: async (input, ctx) => {
      const r = await confirmarPendiente(ctx, num(input, 'id'));
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error, ...(r.vigentes ? { vigentes: r.vigentes } : {}), guarda: true });
      if (r.ok) return `✅ Hecho: ${r.resumen}`;
      // Lo que falló al ejecutarse ya dejó SU ticket (`ticket`, con su línea en el resumen), o es una negativa del runner: el
      // «no pude» que lo sigue no abre otro. Sin ticket y con la falla tragada (no se pudo abrir), sí.
      const yaAvisada = 'ticket' in r && r.ticket != null;
      return JSON.stringify({ ok: false, error: `No se pudo: ${r.resumen}`, ...(yaAvisada || !esFallaTragada(r.resumen) ? { guarda: true } : {}) });
    },
  },
  cancelar_accion: {
    correr: async (input, ctx) => {
      const r = await cancelarPendiente(ctx, num(input, 'id'));
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error, ...(r.vigentes ? { vigentes: r.vigentes } : {}), guarda: true });
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
        const camino = ruta.split(/[?#]/)[0];
        const deLaBarra = TODOS_LOS_ITEMS.find((i) => i.match(camino));
        // El menú de la foto (Settings, «Report a problem»): el que la abre con MENOS roles (/equipo abre Settings, que ven todos,
        // y Business settings, que es del admin: manda el del admin). No depende del plan: lo tiene todo negocio.
        const delMenu = deLaBarra ? undefined
          : USER_NAV.filter((i) => i.match(camino)).sort((a, b) => (a.rolesWs?.length ?? 0) - (b.rolesWs?.length ?? 0))[0];
        const item = deLaBarra ?? delMenu;
        // Lo del super admin, sólo en la plataforma; lo que no va en la plataforma (Partners), no en ella (la verificación de
        // 0c80dd3ce: el dueño de un negocio con plan completo recibía Customers, AI Avatar, Reels y Stories).
        if (item?.adminOnly && !vista.plataforma) return false;
        if (item?.noEnPlataforma && vista.plataforma) return false;
        if (vista.tabs != null && !delMenu && (!item || !vista.tabs.includes(item.key))) return false;
        if (vista.rol !== 'admin' && !(item?.rolesWs?.length)) return false;
        return true;
      };
      const pedidas = id ? CAPACIDADES.filter((c) => c.id === id) : CAPACIDADES;
      if (id && !pedidas.length) return fallo(`No existe la capacidad «${id}».`);
      const visibles = pedidas.filter((c) => disponible(c.ruta));
      if (id && !visibles.length) return fallo(`«${id}» no está disponible en este negocio (su tab no está en el plan contratado o no la ve tu rol).`);
      // Las FUNCIONES de este negocio, del catálogo (lib/funciones-mako.ts, 28/10/2026): qué hace cada una, qué no y qué
      // reemplaza. Con un id se pide UNA capacidad: van sólo sus pasos.
      const funciones = id ? [] : funcionesMako()
        .filter((f) => (!f.soloSuperAdmin || vista.plataforma) && !(f.noEnPlataforma && vista.plataforma) && disponible(f.ruta)).map((f) => ({
        funcion: f.nombre, url: linkPantalla(f.ruta), que: f.que,
        ...(f.noHace?.length ? { no_hace: f.noHace } : {}), ...(f.reemplaza ? { en_vez_de: f.reemplaza } : {}),
      }));
      return json({
        ...(funciones.length ? { funciones } : {}),
        capacidades: visibles.map((c) => ({ id: c.id, tab: c.tab, url: linkPantalla(c.ruta), que: c.que, como: c.como })),
        ...(visibles.length < pedidas.length ? { fuera_de_este_negocio: pedidas.length - visibles.length } : {}),
      });
    },
  },
  // Los chats con MaKo del Second Brain: la persona sale de la conversación del turno, nunca de un parámetro.
  listar_chats_mako: {
    leer: async (_input, ctx) => {
      const sid = sesionDelCanal(ctx.canalKey);
      const chats = sid == null ? null : await chatsDelSecondBrain(sid);
      if (!chats) return fallo('Esto sólo se puede desde un chat con MaKo en la app.');
      const { jefe } = arbolDelJefe(chats.map((c) => ({ id: c.id, titulo: c.titulo, pinned: c.pinned, updatedAt: c.updated_at })));
      return json({
        chats: chats.map((c) => ({
          id: c.id, titulo: c.id === jefe?.id ? JEFE_SECOND_BRAIN : tituloDe(c), ultimo_movimiento: c.updated_at,
          ...(c.id === sid ? { es_este_chat: true } : {}),
        })),
      });
    },
  },
  hilo_chat_mako: {
    leer: async (input, ctx) => {
      const sid = sesionDelCanal(ctx.canalKey);
      if (sid == null) return fallo('Esto sólo se puede desde un chat con MaKo en la app.');
      const id = num(input, 'id');
      const h = id == null ? null : await hiloDelSecondBrain(sid, id);
      if (!h) return fallo(`No encuentro el chat ${id ?? ''} entre los tuyos. Pide la lista con listar_chats_mako.`);
      // Los últimos 30 mensajes, cada uno acotado: el turno re-manda la conversación en cada paso.
      return json({
        titulo: tituloDe(h.sesion),
        mensajes: h.mensajes.slice(-30).map((m) => ({ de: m.role === 'user' ? 'persona' : 'mako', texto: m.content.slice(0, 1500), fecha: m.created_at ?? null })),
      });
    },
  },
  // El riel «Lo que hizo» y el «⋯» de cada chat (tandas 7 y 9): siempre sobre un chat de la persona del turno.
  lo_que_hizo_chat_mako: {
    leer: async (input, ctx) => {
      const c = await chatDeLaPersona(ctx, num(input, 'id'));
      if ('error' in c) return fallo(c.error);
      const hecho = await loQueHizo(ctx.ws, [canalKeyDeSesion(c.chat.id)]);
      return json({ chat: c.titulo, acciones: hecho.map((h) => ({ que: h.resumen, estado: h.estado, cuando: h.at })) });
    },
  },
  renombrar_chat_mako: {
    preparar: async (input, ctx) => {
      const c = await chatDeLaPersona(ctx, num(input, 'id'));
      if ('error' in c) return { error: c.error };
      if (c.esJefe) return { error: NO_RENOMBRA_JEFE };
      const v = nombreValido(str(input, 'nombre') ?? '');
      if (!v.ok) return { error: v.error };
      return { payload: { id: c.chat.id, nombre: v.nombre }, resumen: `Renombrar el chat «${c.titulo}» a «${v.nombre}»` };
    },
    ejecutar: async (p, ctx) => {
      // Se vuelve a mirar al confirmar: la tarjeta pudo quedar abierta mientras el chat cambiaba.
      const c = await chatDeLaPersona(ctx, typeof p.id === 'number' ? p.id : null);
      if ('error' in c) return { ok: false, resumen: c.error };
      if (c.esJefe) return { ok: false, resumen: NO_RENOMBRA_JEFE };
      const v = nombreValido(String(p.nombre ?? ''));
      if (!v.ok) return { ok: false, resumen: v.error };
      await renameSession(c.chat.id, v.nombre);
      return { ok: true, resumen: `Listo: el chat se llama «${v.nombre}».` };
    },
  },
  // MaKo recomienda (26/10/2026): lo mismo que el bloque de cada pantalla (lib/recomendaciones.ts). Por la API no se pide la
  // redacción de la IA (nadie espera un `after()` acá): sale la guardada si la hay, o la de las reglas.
  que_recomienda_mako: {
    leer: async (input, ctx) => {
      const superficie = pantallaDe(input, ctx);
      const r = await recomendacionesDe(superficie);
      return json({
        pantalla: superficie,
        recomendaciones: r.recomendaciones.map((x) => ({
          // `claves`: todas las señales que junta (la IA puede juntar varias). Decidir sobre ésta las manda TODAS, y nada más.
          clave: x.clave, claves: x.claves?.length ? x.claves : [x.clave], hacer: x.hacer, cambia: x.cambia, porque: x.porque, de_donde: x.fuentes,
          ...(x.accion?.tipo === 'link' ? { abrir: linkPantalla(x.accion.href) } : {}),
          ...(x.accion?.tipo === 'chat' ? { pedido_para_mako: x.accion.pedido } : {}),
          ...(x.seguimiento ? { ya_la_acepto_el: x.seguimiento.aceptadaEl.slice(0, 10), y_sigue_igual: true } : {}),
        })),
        lo_que_mejoro: r.funcionaron.map((f) => ({ clave: f.clave, aceptada_el: f.aceptadaEl.slice(0, 10) })),
        descartadas: r.descartadas.map((d) => ({ clave: d.clave, como: d.d, cuando: d.en.slice(0, 10), ...(d.motivo ? { motivo: d.motivo } : {}) })),
        ...(r.fallas.length ? { no_se_pudo_leer: r.fallas.map((f) => f.fuente) } : {}),
        ...(r.recomendaciones.length ? {} : { nota: 'Con los datos de hoy no hay nada que valga la pena recomendar. Dilo así: no inventes un consejo.' }),
      });
    },
  },
  // Ticket #40: sólo el grupo del turno. Un «no encontré» dice qué se guarda, para no sonar a que nunca se dijo.
  buscar_en_el_grupo: {
    leer: async (input, ctx) => {
      if (ctx.canal !== 'whatsapp' || !ctx.canalKey) return fallo('Esto se usa sólo dentro de un grupo de WhatsApp.');
      const texto = str(input, 'texto');
      if (!texto) return fallo('Falta qué buscar.');
      const filas = await buscarEnElGrupo(ctx.ws, ctx.canalKey, texto);
      return json({
        mensajes: filas.map((f) => ({ de: f.role === 'assistant' ? 'MaKo' : 'la persona', fecha: f.created_at.slice(0, 10), texto: f.content.slice(0, 600) })),
        ...(filas.length ? {} : { nota: 'No está entre lo guardado. MaKo guarda lo que le hablaron a ella: la charla del equipo entre ellos puede no estar. Dilo así, no digas que nunca se habló.' }),
      });
    },
  },
  // Ticket #45: el interruptor de la pantalla (app/second-brain/recolector-actions.ts). El estado sale de la misma lectura que ella.
  cambiar_aprende_solo: {
    preparar: async (input) => {
      if (typeof input.prendido !== 'boolean') return { error: 'Falta si se prende o se apaga «Aprende solo».', faltan: ['prendido'] };
      const resumen = await resumenDelRecolector();
      if (!resumen) return { error: 'No pude leer cómo está «Aprende solo». Intenta de nuevo.', falla: true };
      if (resumen.estado.prendido === input.prendido) return { error: `«Aprende solo» ya está ${input.prendido ? 'prendido' : 'apagado'}.`, yaEstaba: true };
      return {
        payload: { prendido: input.prendido },
        resumen: input.prendido
          ? 'Prender «Aprende solo»: MaKo aprende de tus conversaciones de WhatsApp con leads y lo suma al Second Brain, sin mandar ningún mensaje.'
          : 'Apagar «Aprende solo»: MaKo deja de aprender de tus conversaciones de WhatsApp. Lo que ya aprendió se queda.',
      };
    },
    ejecutar: async (payload, ctx) => {
      const prendido = (payload as { prendido?: unknown }).prendido === true;
      await cambiarRecolector(prendido);
      try { revalidatePath('/second-brain'); } catch { /* fuera de un request: vence sola */ }
      return { ok: true, resumen: `«Aprende solo» quedó ${prendido ? 'prendido' : 'apagado'}. Lo ves en la cabecera del Mapa del Second Brain: ${linkApp('/second-brain', ctx.ws)}` };
    },
  },
  decidir_recomendacion: {
    preparar: async (input, ctx) => {
      const superficie = pantallaDe(input, ctx);
      const clave = str(input, 'clave');
      const decision = input.decision;
      if (!clave) return { error: 'Falta la clave de la recomendación (de que_recomienda_mako).', faltan: ['clave'] };
      if (!esDecision(decision)) return { error: 'Falta qué decidió: hecha, ahora-no, no-aplica o reabierta.', faltan: ['decision'] };
      const motivo = str(input, 'motivo');
      const memoria = await leerMemoriaDelNegocio();
      if (!memoria) return { error: 'No pude leer lo que ya decidiste. Intenta de nuevo.', falla: true };
      const previa = ultimaDecision(memoria.m, clave);
      if (decision === 'reabierta') {
        if (!previa || (previa.d !== 'no-aplica' && previa.d !== 'ahora-no')) return { error: 'Esa recomendación no está descartada.' };
        return { payload: { pantalla: superficie, clave, decision }, resumen: `Volver a mostrar la recomendación que se descartó el ${previa.en.slice(0, 10)}` };
      }
      // Las señales que juntaba la recomendación que se MOSTRÓ (las `claves` de que_recomienda_mako): sin ellas, sólo la
      // principal. El servidor no completa nada (verificación del tren-m: completaba con lo que había AL DECIDIR).
      const otras = clavesValidas(input.claves).filter((k) => k !== clave);
      const ahora = new Date();
      // «Ya estaba así» sólo mientras esa decisión SIGUE callándolas a todas: pasado un «Ahora no» o una «Hecha», la
      // recomendación vuelve y callarla otra vez es nuevo (la misma regla que la ruta, `decisionVigente`).
      if ([clave, ...otras].every((k) => decisionVigente(ultimaDecision(memoria.m, k), decision, ahora))) return { error: 'Ya estaba anotada así.', yaEstaba: true };
      const { senales, fallas } = await senalesDelNegocio(superficie);
      const s = senales.find((x) => claveDe(x) === clave);
      if (!s) return { error: fallas.length ? 'No pude leer los datos de esa recomendación. Intenta de nuevo.' : 'Esa recomendación ya no está (el dato cambió). Pide de nuevo que_recomienda_mako.' };
      // El resumen NOMBRA todo lo que se va a anotar: la persona confirma sobre lo que lee, no sobre una clave.
      const juntas = [s, ...otras.map((k) => senales.find((x) => claveDe(x) === k)).filter((x): x is NonNullable<typeof x> => !!x)];
      const hacer = juntas.map((x) => `«${deSenal(x, superficie).hacer}»`).join(' y ');
      const que = decision === 'hecha' ? 'Anotar como hecha' : decision === 'ahora-no' ? 'Callar por 14 días' : 'No volver a recomendar';
      return {
        payload: { pantalla: superficie, clave, claves: juntas.map(claveDe), decision, ...(motivo ? { motivo } : {}) },
        resumen: `${que}: ${hacer}${motivo ? ` (motivo: «${motivo}»)` : ''}`,
      };
    },
    ejecutar: async (p, ctx) => {
      const superficie = esSuperficie(p.pantalla) ? p.pantalla : 'ops-center';
      if (!esDecision(p.decision) || typeof p.clave !== 'string') return { ok: false, resumen: 'La decisión llegó incompleta.' };
      const r = await decidirRecomendacion({
        superficie, clave: p.clave, claves: clavesValidas(p.claves), d: p.decision, motivo: typeof p.motivo === 'string' ? p.motivo : null,
        quien: ctx.quien?.email || ctx.actor || ctx.canal,
      });
      return r.ok ? { ok: true, resumen: 'Listo: quedó anotado.' } : { ok: false, resumen: r.error };
    },
  },
};

/** De qué pantalla: la pedida, o la del canal (WhatsApp tiene la suya; los demás, todo el negocio). */
const pantallaDe = (input: Record<string, unknown>, ctx: Ctx): Superficie =>
  esSuperficie(input.pantalla) ? input.pantalla : ctx.canal === 'whatsapp' ? 'whatsapp' : 'ops-center';

const NO_ES_DE_LA_APP = 'Esto sólo se puede desde un chat con MaKo en la app.';
const NO_RENOMBRA_JEFE = 'El chat «Second Brain» no se renombra: es el principal.';

/**
 * Un chat del Second Brain de la persona de ESTE turno (`id`, o el del turno sin él), con su título. La persona sale
 * de la conversación del turno (`ctx.canalKey`), nunca de un parámetro: un id de otra persona no existe.
 */
async function chatDeLaPersona(ctx: Ctx, id: number | null): Promise<{ chat: ChartSession; titulo: string; esJefe: boolean } | { error: string }> {
  const sid = sesionDelCanal(ctx.canalKey);
  const chats = sid == null ? null : await chatsDelSecondBrain(sid);
  if (sid == null || !chats) return { error: NO_ES_DE_LA_APP };
  const buscado = id ?? sid;
  const chat = chats.find((c) => c.id === buscado);
  if (!chat) return { error: `No encuentro el chat ${buscado} entre los tuyos. Pide la lista con listar_chats_mako.` };
  const { jefe } = arbolDelJefe(chats.map((c) => ({ id: c.id, titulo: c.titulo, pinned: c.pinned, updatedAt: c.updated_at })));
  const esJefe = chat.id === jefe?.id;
  return { chat, titulo: esJefe ? JEFE_SECOND_BRAIN : tituloDe(chat), esJefe };
}
