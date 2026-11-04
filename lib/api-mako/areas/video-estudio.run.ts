// =============================================================================
// api-mako/areas/video-estudio.run — los cuerpos de video-estudio.def.ts (los botones del estudio, por prompt)
// =============================================================================
// Un runner por id. Cada `ejecutar` llama a LA MISMA server action que el botón del estudio (app/video-generator/
// video-action.ts, actions.ts, cargar-guiones-action.ts): así el chat hace exactamente lo que haría la persona, con las
// guardas, los topes de la prueba y los mensajes de esas acciones, y no una segunda implementación.
//
// ⚠️ ESO SÓLO SIRVE EN LA APP, y por eso las definiciones salen sólo por `['app']`: esas acciones leen la sesión de la
//    cookie (su `ctxAdmin`). El turno del chat de la app y la confirmación de su tarjeta (o de /mako/revisar) corren en un
//    pedido del navegador de la persona, con su cookie; el registro corre todo adentro de `runWithWorkspace(ctx.ws)`, así
//    que `getWorkspaceActual()` de la acción contesta ESTE negocio. (El encabezado de video.run.ts dice que las acciones
//    «no sirven» fuera de un navegador: es cierto para WhatsApp y HTTP, que acá no llegan.)
// ⚠️ Lo que se puede saber SIN escribir falla en `preparar()` (regla 3 de AGENTS.md: confirmar reclama la pendiente). Y en
//    particular lo que la acción devolvería como un ÉXITO SIN HACER NADA: `generarTomaAction` contesta `ok: true` sobre una
//    toma ya filmada o en vuelo. Por eso filmar mira el estado de la toma antes, y otra vez al confirmar (`faltaParaConfirmar`).
// ⚠️ El historial guarda prompts, data URIs y urls firmadas: ninguna respuesta devuelve el item crudo, sólo el planId.
// =============================================================================

import 'server-only';
import type { AccionRun, Ctx, Ejecutado, Preparado, Run, Runners } from '../tipos';
import { PREFIJO_FLUJO } from '../canal';
import type { PlanGuardado } from '@/app/video-generator/video-datos';
import { guionesDisponibles } from '@/app/video-generator/guiones-datos';
import { leerSaldoGuardado, costoPorClip, COSTO_CLIP_ESTIMADO } from '@/app/video-generator/saldo-datos';
import { escenariosReusables } from '@/app/video-generator/escenario-reuso';
import { estadoDelComposer, lugarDelPedido, planExistente, LUGAR_MAKO } from '@/app/video-generator/estudio/composer-reglas';
import { filaDeProyecto, tituloDeProyecto, urlConPlan } from '@/app/video-generator/estudio/proyectos';
import { porQueNoFilmar, PUENTE_VIEJO, SIN_PUENTE } from '@/app/video-generator/estudio/filmar';
import { puestaPorId } from '@/lib/puestas-data';
import { escenarioPorId } from '@/lib/escenarios-data';
import { creditosDeClip } from '@/lib/costo-clip';
import { getPersona } from '@/lib/persona';
import { linkApp } from '@/lib/app-url';
import { EXTENSION_VERSION } from '@/lib/extension-version';
import {
  HistorialIlegible, compararVersion, estadoDeImagen, estadoDeToma, leerHistorialEstricto, leerMontaje, leerPuenteEstricto, puenteAnda,
} from './video.helpers';

// Las acciones de la tab se cargan AL USARLAS (`import()`), no al importar este archivo: el registro (lib/api-mako/runners.ts)
// lo importan las rutas de WhatsApp, los crons y los webhooks, que no tienen por qué cargar el Video Generator entero.
const deVideo = () => import('@/app/video-generator/video-action');
const delPlan = () => import('@/app/video-generator/actions');
const deGuiones = () => import('@/app/video-generator/cargar-guiones-action');
const delPuente = () => import('@/app/video-generator/puente-actions');

// ── utilidades ───────────────────────────────────────────────────────────────

const num = (o: Record<string, unknown>, k: string): number | null => {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const str = (o: Record<string, unknown>, k: string): string | null => {
  const v = o[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const corto = (t: string, n = 140): string => {
  const s = (t || '').trim().replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** El día y el mes de una fecha ISO, para fechar una lectura guardada. Vacío si no se puede leer. */
const diaMes = (iso: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])}/${Number(m[2])}` : '';
};

/** El link que abre ESTE anuncio en el estudio (la misma ruta, con `?plan=`). */
const linkDelEstudio = (planId: string | null, ws: number): string =>
  linkApp(urlConPlan('/video-generator', planId), ws);

const NO_LEI = 'No pude leer tus anuncios (falló la base). No es que no haya: vuelve a intentarlo en un rato.';

/** El anuncio por id, contra el historial ESTRICTO (una base caída no es «no existe»). */
async function anuncio(input: Record<string, unknown>): Promise<{ item: PlanGuardado; historial: PlanGuardado[] } | { error: string; falla?: true }> {
  const planId = str(input, 'planId');
  if (!planId) return { error: 'Falta el anuncio: pídelo con listar_anuncios_video.' };
  let historial: PlanGuardado[];
  try {
    historial = await leerHistorialEstricto();
  } catch (e) {
    if (e instanceof HistorialIlegible) return { error: NO_LEI, falla: true };
    throw e;
  }
  const item = historial.find((p) => p.id === planId);
  if (!item) return { error: `No encuentro ese anuncio en este negocio (guarda los últimos 10). Pide la lista con listar_anuncios_video.` };
  return { item, historial };
}

const tomaDe = (item: PlanGuardado, input: Record<string, unknown>) => {
  const n = num(input, 'toma');
  const clip = n == null ? null : item.plan.clips.find((c) => c.n === n) ?? null;
  return clip ? { n: clip.n, clip } : null;
};
const sinToma = (item: PlanGuardado): Preparado => ({ error: `Esa toma no existe: este anuncio tiene ${item.plan.clips.length}.` });

const escenaDe = (item: PlanGuardado, input: Record<string, unknown>) => {
  const n = num(input, 'escenario');
  return n == null ? null : item.escenas?.find((e) => e.n === n) ?? null;
};
const sinEscena = (item: PlanGuardado): Preparado => item.escenas
  ? { error: `Ese escenario no existe: este anuncio tiene ${item.escenas.length}.` }
  : { error: 'Este anuncio todavía no tiene escenarios: pídeselos a MaKo (escribir_escenarios_anuncio) o ábrelo en el estudio.' };

/** ¿El navegador del cliente puede trabajar con Google Flow ahora? Con la extensión vieja, no. */
async function puenteListo(): Promise<{ anda: boolean; vieja: boolean }> {
  const p = await leerPuenteEstricto().catch(() => null);
  if (!p) return { anda: false, vieja: false };
  const v = p.version || '';
  const cmp = v ? compararVersion(v, EXTENSION_VERSION) : null;
  return { anda: puenteAnda(p, Date.now()).anda, vieja: !!v && (cmp == null ? v !== EXTENSION_VERSION : cmp < 0) };
}

/** Lo que devuelve una acción del estudio, como resultado de la operación. */
function hecho(r: { ok: true } | { ok: false; error: string }, resumen: string, planId: string, ctx: Ctx, extra?: Record<string, unknown>): Ejecutado {
  if (!r.ok) return { ok: false, resumen: r.error };
  return { ok: true, resumen, datos: { planId, link: linkDelEstudio(planId, ctx.ws), ...extra } };
}

/** El preparar de las acciones que sólo nombran el anuncio y una toma. */
async function conToma(input: Record<string, unknown>, que: (item: PlanGuardado, n: number) => Preparado | null, resumen: (t: string, n: number) => string): Promise<Preparado> {
  const a = await anuncio(input);
  if ('error' in a) return a;
  const t = tomaDe(a.item, input);
  if (!t) return sinToma(a.item);
  const no = que(a.item, t.n);
  if (no) return no;
  return { payload: { planId: a.item.id, toma: t.n }, resumen: resumen(tituloDeProyecto(a.item), t.n) };
}

/** El preparar de las acciones que sólo nombran el anuncio y un escenario. */
async function conEscena(input: Record<string, unknown>, que: (item: PlanGuardado, n: number) => Preparado | null, resumen: (t: string, n: number) => string, extra: Record<string, unknown> = {}): Promise<Preparado> {
  const a = await anuncio(input);
  if ('error' in a) return a;
  const e = escenaDe(a.item, input);
  if (!e) return sinEscena(a.item);
  const no = que(a.item, e.n);
  if (no) return no;
  return { payload: { planId: a.item.id, escenario: e.n, ...extra }, resumen: resumen(tituloDeProyecto(a.item), e.n) };
}

const pid = (p: Record<string, unknown>) => String(p.planId ?? '');
const nToma = (p: Record<string, unknown>) => Number(p.toma);
const nEsc = (p: Record<string, unknown>) => Number(p.escenario);

/**
 * Sólo una PERSONA en la app: las acciones leen su sesión. Un paso de una automatización (la clave `PREFIJO_FLUJO`, que
 * también es el canal `app`) no tiene sesión: la lista de «⚡ Acción» ya no las ofrece (NO_EN_FLUJOS, lib/api-mako/flujo.ts),
 * y esto frena un paso viejo o importado. WhatsApp y HTTP no las ven (`canales: ['app']`); esto lo repite por si cambia.
 */
const SOLO_EN_LA_APP = 'Esto se hace en el estudio de Video Generator o en su chat, no desde una automatización.';
const sinPersona = (ctx: Ctx): boolean => ctx.canal !== 'app' || ctx.canalKey.startsWith(PREFIJO_FLUJO);
function soloDesdeLaApp(rs: Record<string, Run>): Runners {
  const out: Record<string, Run> = {};
  for (const [id, r] of Object.entries(rs)) {
    if (!('ejecutar' in r)) { out[id] = r; continue; }
    const a: AccionRun = r;
    out[id] = {
      ...a,
      ...(a.preparar ? { preparar: async (i: Record<string, unknown>, ctx: Ctx): Promise<Preparado> => (sinPersona(ctx) ? { error: SOLO_EN_LA_APP } : a.preparar!(i, ctx)) } : {}),
      ejecutar: async (p, ctx) => (sinPersona(ctx) ? { ok: false, resumen: SOLO_EN_LA_APP } : a.ejecutar(p, ctx)),
    };
  }
  return out;
}

// ── los runners ──────────────────────────────────────────────────────────────

export const RUNNERS: Runners = soloDesdeLaApp({
  abrir_anuncio_en_estudio: {
    leer: async (input, ctx) => {
      const a = await anuncio(input);
      if ('error' in a) return { content: a.error, isError: true };
      const f = filaDeProyecto(a.item);
      return JSON.stringify({ planId: a.item.id, titulo: f.titulo, en_que_anda: f.detalle, link: linkDelEstudio(a.item.id, ctx.ws) });
    },
  },

  crear_anuncio_con_guion: {
    preparar: async (input, ctx) => {
      const guionId = str(input, 'guionId');
      const formatoId = str(input, 'formatoId');
      const lugar = str(input, 'lugar');
      const g = (await guionesDisponibles().catch(() => [])).find((x) => x.id === guionId);
      if (!g) return { error: 'No encuentro ese guion. Pide la lista con listar_guiones_para_video.' };
      const puesta = formatoId ? puestaPorId(formatoId) ?? null : null;
      if (!puesta) return { error: 'No reconozco ese formato. Pide la lista con listar_formatos_video.' };
      if (lugar) {
        const l = lugarDelPedido(puesta, lugar);
        if (!l.ok) return { error: l.error };
      }
      let historial: PlanGuardado[];
      try { historial = await leerHistorialEstricto(); } catch (e) { if (e instanceof HistorialIlegible) return { error: NO_LEI, falla: true }; throw e; }
      const existente = planExistente(historial, g.id, puesta.id);
      if (existente) {
        return { error: `Ese guion ya tiene un anuncio con ${puesta.nombre}: ábrelo en ${linkDelEstudio(existente, ctx.ws)}`, yaEstaba: true };
      }
      const puente = await puenteListo();
      const est = estadoDelComposer({ guion: { id: g.id, hablado: g.hablado || g.texto }, puesta, existente: null, puenteAnda: puente.anda, extensionVieja: puente.vieja });
      if (!est.puede) return { error: est.consecuencia };
      const donde = !lugar ? '' : lugar === LUGAR_MAKO ? ', el lugar lo elige MaKo' : `, en ${escenarioPorId(lugar)?.nombre ?? lugar}`;
      return {
        payload: { guionId: g.id, formatoId: puesta.id, ...(lugar ? { lugar } : {}) },
        resumen: `Escribir un anuncio con «${corto(g.primeraLinea || g.hablado || g.texto, 90)}» en ${puesta.nombre}${donde}. ${est.consecuencia}`,
      };
    },
    ejecutar: async (p, ctx) => {
      const g = (await guionesDisponibles().catch(() => [])).find((x) => x.id === p.guionId);
      if (!g) return { ok: false, resumen: 'Ese guion ya no está.' };
      const r = await (await delPlan()).generarPlanAction({
        puestaId: String(p.formatoId), guionId: g.id, guionTexto: g.texto, adaptarVoz: false,
        ...(typeof p.lugar === 'string' ? { lugar: p.lugar } : {}),
      });
      if (!r.ok) return { ok: false, resumen: r.error };
      return hecho(r, `Listo: «${tituloDeProyecto(r.item)}» quedó en tus anuncios, con ${r.item.plan.clips.length} tomas.`, r.item.id, ctx);
    },
  },

  cargar_guion_propio: {
    preparar: async (input) => {
      let texto = str(input, 'texto');
      const link = str(input, 'link');
      if (!texto && link) {
        // El texto detrás del link, con la MISMA lectura que el botón «Pegar un link» (valida el destino en cada salto).
        const l = await (await deGuiones()).textoDeLinkAction(link);
        if (!l.ok) return { error: l.error };
        texto = l.texto.trim();
      }
      if (!texto) return { error: 'Falta el guion: pega el texto o un link.' };
      const r = await (await deGuiones()).previoCargaAction(texto);
      if (!r.ok) return { error: r.error };
      const n = r.previo.guiones.length;
      if (r.previo.yaEstaban === n) return { error: n === 1 ? 'Ese guion ya está en tus guiones.' : 'Esos guiones ya están en tus guiones.', yaEstaba: true };
      const nuevos = n - r.previo.yaEstaban;
      return {
        payload: { texto },
        resumen: `Guardar ${nuevos === 1 ? 'un guion' : `${nuevos} guiones`} en tus guiones${r.previo.yaEstaban ? ` (${r.previo.yaEstaban} ya estaban)` : ''}.`,
      };
    },
    ejecutar: async (p) => {
      const texto = String(p.texto ?? '');
      const previo = await (await deGuiones()).previoCargaAction(texto);
      if (!previo.ok) return { ok: false, resumen: previo.error };
      const r = await (await deGuiones()).cargarGuionesAction(texto, previo.previo.guiones.map((_, i) => i));
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Guardé ${r.cargados === 1 ? 'un guion' : `${r.cargados} guiones`}${r.salteados ? ` (${r.salteados} ya estaban)` : ''}.`, datos: { cargados: r.cargados } };
    },
  },

  editar_texto_toma: {
    preparar: async (input) => {
      const texto = str(input, 'texto');
      if (!texto) return { error: 'Falta lo que tiene que decir la toma.' };
      const a = await anuncio(input);
      if ('error' in a) return a;
      const t = tomaDe(a.item, input);
      if (!t) return sinToma(a.item);
      if ((t.clip.voz ?? '').trim() === texto) return { error: `La toma ${t.n} ya dice eso.`, yaEstaba: true };
      const e = estadoDeToma(a.item, t.n);
      if (e === 'filmada') return { error: `La toma ${t.n} ya está filmada: descarta el clip para cambiar lo que dice.` };
      if (e === 'generando' || e === 'sin_poder_leer') return { error: `La toma ${t.n} se está filmando: espera a que termine.` };
      return { payload: { planId: a.item.id, toma: t.n, texto }, resumen: `Cambiar la toma ${t.n} de «${tituloDeProyecto(a.item)}» a: «${corto(texto)}».` };
    },
    // Las dos que usa la pantalla: mientras se revisa el guion, la del guion (recalcula el tope de la toma); con algo ya
    // pedido a Google, la de las tomas (no deja cambiar lo filmado).
    ejecutar: async (p, ctx) => {
      const a = await anuncio(p);
      if ('error' in a) return { ok: false, resumen: a.error };
      const texto = String(p.texto ?? '');
      const r = Object.keys(a.item.video ?? {}).length
        ? await (await deVideo()).escribirVozTomaAction(pid(p), nToma(p), texto)
        : await (await delPlan()).editarLineaPlanAction(pid(p), nToma(p), texto);
      return hecho(r, `Cambié la toma ${nToma(p)}.`, pid(p), ctx);
    },
  },

  reescribir_toma_con_ia: {
    preparar: async (input) => {
      const instruccion = str(input, 'instruccion');
      if (!instruccion) return { error: 'Falta qué cambiarle a la toma.' };
      const r = await conToma(input, () => null, (t, n) => `Reescribir la toma ${n} de «${t}»: ${corto(instruccion, 120)}.`);
      return 'payload' in r ? { ...r, payload: { ...r.payload, instruccion } } : r;
    },
    ejecutar: async (p, ctx) => hecho(await (await delPlan()).reescribirTomaAction(pid(p), nToma(p), String(p.instruccion ?? '')), `Reescribí la toma ${nToma(p)}.`, pid(p), ctx),
  },

  cambiar_tomas_anuncio: {
    preparar: async (input) => {
      const que = str(input, 'que');
      const segundos = num(input, 'segundos');
      if ((que === 'agregar' || que === 'duracion') && segundos == null) return { error: 'Dime cuántos segundos.' };
      const a = await anuncio(input);
      if ('error' in a) return a;
      const t = tomaDe(a.item, input);
      if (!t) return sinToma(a.item);
      const titulo = tituloDeProyecto(a.item);
      if (que === 'quitar' && a.item.plan.clips.length <= 1) return { error: 'Es la única toma del anuncio: no se puede quitar.' };
      if (que === 'duracion' && t.clip.segundos === segundos) return { error: `La toma ${t.n} ya dura ${segundos} segundos.`, yaEstaba: true };
      const frase = que === 'agregar' ? `Agregar una toma de ${segundos} s después de la ${t.n}`
        : que === 'partir' ? `Partir la toma ${t.n} en dos`
        : que === 'quitar' ? `Quitar la toma ${t.n}`
        : `Cambiar la toma ${t.n} a ${segundos} s`;
      return { payload: { planId: a.item.id, que, toma: t.n, ...(segundos != null ? { segundos } : {}) }, resumen: `${frase} en «${titulo}».` };
    },
    ejecutar: async (p, ctx) => {
      const n = nToma(p);
      const s = Number(p.segundos);
      const orden = p.que === 'agregar' ? { que: 'agregar' as const, despuesDe: n, segundos: s }
        : p.que === 'partir' ? { que: 'partir' as const, n }
        : p.que === 'quitar' ? { que: 'quitar' as const, n }
        : { que: 'duracion' as const, n, segundos: s };
      return hecho(await (await deVideo()).editarClipsAction(pid(p), orden), 'Listo: cambié las tomas.', pid(p), ctx);
    },
  },

  adaptar_voz_anuncio: {
    preparar: async (input) => {
      const adaptar = input.adaptar === true;
      const a = await anuncio(input);
      if ('error' in a) return a;
      if (a.item.plan.clips.some((c) => ['filmada', 'generando', 'sin_poder_leer'].includes(estadoDeToma(a.item, c.n)))) {
        return { error: 'Ya hay tomas filmadas con este guion: cambiarlo ahora las dejaría sin sentido.' };
      }
      return {
        payload: { planId: a.item.id, adaptar },
        resumen: `${adaptar ? 'Decir el guion de' : 'Volver al guion tal cual en'} «${tituloDeProyecto(a.item)}»${adaptar ? ' con tus muletillas' : ''}. Se vuelven a escribir sus escenarios.`,
      };
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).cambiarMuletillasAction(pid(p), p.adaptar === true), 'Listo: rehice el guion del anuncio.', pid(p), ctx),
  },

  elegir_lugar_anuncio: {
    preparar: async (input) => {
      const lugar = str(input, 'lugar');
      const a = await anuncio(input);
      if ('error' in a) return a;
      const puesta = puestaPorId(a.item.plan.puestaId);
      if (!puesta) return { error: 'No reconozco el formato de este anuncio.' };
      const l = lugarDelPedido(puesta, lugar);
      if (!l.ok) return { error: l.error };
      if (!l.escenarioId) return { error: 'Dime qué lugar: la lista está en listar_lugares_grabacion.' };
      if (a.item.escenarioId === l.escenarioId && a.item.escenas?.length) return { error: 'Este anuncio ya se graba ahí.', yaEstaba: true };
      return {
        payload: { planId: a.item.id, lugar: l.escenarioId },
        resumen: `Grabar «${tituloDeProyecto(a.item)}» en ${escenarioPorId(l.escenarioId)?.nombre ?? l.escenarioId}. MaKo vuelve a escribir sus escenarios.`,
      };
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).elegirEscenarioAction(pid(p), String(p.lugar ?? '')), 'Listo: cambié el lugar.', pid(p), ctx),
  },

  corregir_escenario_anuncio: {
    preparar: async (input) => {
      const ajuste = str(input, 'ajuste');
      if (!ajuste) return { error: 'Falta qué cambiarle al escenario.' };
      return conEscena(input, () => null, (t, n) => `Corregir el escenario ${n} de «${t}»: ${corto(ajuste, 120)}.`, { ajuste });
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).corregirEscenaAction(pid(p), nEsc(p), String(p.ajuste ?? '')), `Corregí el escenario ${nEsc(p)}.`, pid(p), ctx),
  },

  otro_fondo_escenario: {
    preparar: async (input) => conEscena(input, () => null, (t, n) => `Probar otro rincón para el escenario ${n} de «${t}».`),
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).otroFondoAction(pid(p), nEsc(p)), `Cambié el fondo del escenario ${nEsc(p)}.`, pid(p), ctx),
  },

  reusar_escenarios_anuncio: {
    preparar: async (input) => {
      const a = await anuncio(input);
      if ('error' in a) return a;
      if (!a.item.escenas) return sinEscena(a.item);
      const lista = escenariosReusables(a.item, a.historial);
      if (!lista.length) return { error: 'No hay escenarios de otro anuncio para reusar en este.' };
      return { payload: { planId: a.item.id }, resumen: `Reusar ${lista.length === 1 ? 'un escenario' : `${lista.length} escenarios`} de otro anuncio en «${tituloDeProyecto(a.item)}».` };
    },
    ejecutar: async (p, ctx) => {
      const r = await (await deVideo()).reusarEscenariosAction(pid(p));
      return hecho(r, r.ok ? `Reusé ${r.cuantos === 1 ? 'un escenario' : `${r.cuantos} escenarios`}.` : '', pid(p), ctx);
    },
  },

  elegir_foto_anuncio: {
    preparar: async (input) => {
      const pedida = str(input, 'fotoId');
      const a = await anuncio(input);
      if ('error' in a) return a;
      const fotos = (await getPersona().catch(() => null))?.fotos ?? [];
      if (!fotos.length) return { error: 'No hay fotos tuyas cargadas: súbelas en el estudio.' };
      // Por id, o por su lugar en la lista («la segunda»).
      const porLugar = pedida && /^\d{1,2}$/.test(pedida) ? fotos[Number(pedida) - 1] : undefined;
      const foto = fotos.find((f) => f.id === pedida) ?? porLugar;
      if (!foto) return { error: 'No encuentro esa foto.', disponibles: fotos.map((f, i) => ({ fotoId: f.id, nombre: f.nombre, lugar: i + 1 })) };
      if (a.item.fotoId === foto.id) return { error: 'Este anuncio ya usa esa foto.', yaEstaba: true };
      return { payload: { planId: a.item.id, fotoId: foto.id }, resumen: `Usar la foto «${corto(foto.nombre, 60)}» en «${tituloDeProyecto(a.item)}». Las imágenes de sus escenarios se vuelven a generar.` };
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).elegirFotoAction(pid(p), String(p.fotoId ?? '')), 'Listo: cambié la foto.', pid(p), ctx),
  },

  escribir_escenarios_anuncio: {
    preparar: async (input) => {
      const ajuste = str(input, 'ajuste');
      const a = await anuncio(input);
      if ('error' in a) return a;
      if (a.item.plan.clips.some((c) => estadoDeToma(a.item, c.n) !== 'sin_filmar' && estadoDeToma(a.item, c.n) !== 'sin_texto' && estadoDeToma(a.item, c.n) !== 'con_error')) {
        return { error: 'Ya hay tomas filmadas con estos escenarios: para cambiar uno, corrígelo (corregir_escenario_anuncio).' };
      }
      return {
        payload: { planId: a.item.id, ...(ajuste ? { ajuste } : {}) },
        resumen: `${a.item.escenas?.length ? 'Volver a escribir' : 'Escribir'} los escenarios de «${tituloDeProyecto(a.item)}»${ajuste ? `: ${corto(ajuste, 100)}` : ''}.`,
      };
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).escribirEscenasAction(pid(p), typeof p.ajuste === 'string' ? p.ajuste : undefined), 'Listo: escribí los escenarios.', pid(p), ctx),
  },

  generar_imagen_escenario: {
    preparar: async (input) => {
      const puente = await puenteListo();
      return conEscena(input, (item, n) => {
        if (estadoDeImagen(item.imagenes?.[String(n)]) === 'generando') return { error: `La imagen del escenario ${n} ya se está generando.` };
        if (puente.vieja) return { error: PUENTE_VIEJO };
        if (!puente.anda) return { error: SIN_PUENTE };
        return null;
      }, (t, n) => `Generar en Google Flow la imagen del escenario ${n} de «${t}». Las imágenes no gastan créditos.`);
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).generarImagenAction(pid(p), nEsc(p)), `Pedí la imagen del escenario ${nEsc(p)}: tarda unos segundos.`, pid(p), ctx),
  },

  elegir_opcion_escenario: {
    preparar: async (input) => {
      const opcion = num(input, 'opcion');
      const a = await anuncio(input);
      if ('error' in a) return a;
      const e = escenaDe(a.item, input);
      if (!e) return sinEscena(a.item);
      const m = a.item.imagenes?.[String(e.n)];
      const opciones = m?.opciones ?? [];
      const url = opcion != null ? opciones[opcion - 1] : undefined;
      if (!url) return { error: opciones.length ? `El escenario ${e.n} tiene ${opciones.length} ${opciones.length === 1 ? 'imagen' : 'imágenes'}.` : `El escenario ${e.n} todavía no tiene imágenes.` };
      if (m?.elegida === url) return { error: 'Ya es la elegida.', yaEstaba: true };
      return { payload: { planId: a.item.id, escenario: e.n, opcion }, resumen: `Quedarse con la imagen ${opcion} del escenario ${e.n} de «${tituloDeProyecto(a.item)}».` };
    },
    ejecutar: async (p, ctx) => {
      // La url se resuelve OTRA VEZ al confirmar: entre la tarjeta y el «sí» pudieron llegar imágenes nuevas.
      const a = await anuncio(p);
      if ('error' in a) return { ok: false, resumen: a.error };
      const url = a.item.imagenes?.[String(nEsc(p))]?.opciones?.[Number(p.opcion) - 1];
      if (!url) return { ok: false, resumen: 'Esa imagen ya no está.' };
      return hecho(await (await deVideo()).elegirImagenAction(pid(p), nEsc(p), url), `Elegí la imagen ${Number(p.opcion)}.`, pid(p), ctx);
    },
  },

  aprobar_escenario_anuncio: {
    preparar: async (input) => conEscena(input, (item, n) => {
      const e = estadoDeImagen(item.imagenes?.[String(n)]);
      if (e === 'confirmada') return { error: `El escenario ${n} ya está aprobado.`, yaEstaba: true };
      if (e !== 'generada_sin_confirmar') return { error: `El escenario ${n} todavía no tiene una imagen para aprobar.` };
      return null;
    }, (t, n) => `Aprobar la imagen del escenario ${n} de «${t}»: es la que se usa para filmar sus tomas.`),
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).confirmarEscenaAction(pid(p), nEsc(p)), `Aprobé el escenario ${nEsc(p)}.`, pid(p), ctx),
  },

  filmar_toma_anuncio: {
    preparar: async (input) => {
      const a = await anuncio(input);
      if ('error' in a) return a;
      const t = tomaDe(a.item, input);
      if (!t) return sinToma(a.item);
      const no = porQueNoFilmar(a.item, t.n, estadoDeToma(a.item, t.n), await puenteListo());
      if (no) return { error: no, ...(estadoDeToma(a.item, t.n) === 'filmada' ? { yaEstaba: true } : {}) };
      const [costo, saldo] = await Promise.all([
        costoPorClip().catch(() => ({ creditos: COSTO_CLIP_ESTIMADO, medido: false })),
        leerSaldoGuardado().catch(() => ({ creditos: null, at: null, tier: '' })),
      ]);
      const creditos = creditosDeClip(t.clip.segundos) ?? costo.creditos;
      // ⚠️ EL SALDO GUARDADO NO ES EL DE AHORA, Y ESTA TARJETA ES DE PLATA. `leerSaldoGuardado` devuelve la ÚLTIMA lectura
      // (refrescarla contra Google se hace desde la tab, `pedirSaldoAction`): «Te quedan 42» afirmaba como actual un número
      // de fecha desconocida, justo en la confirmación de lo único que gasta créditos del cliente. El mismo saldo por el
      // chat ya avisa que «el saldo real puede ser otro» (ver_saldo_flow, video.run.ts), y `SaldoFlow.at` lo dice entero:
      // «un saldo sin fecha no se puede juzgar». Con fecha se dice que es una lectura vieja; SIN fecha se OMITE la
      // afirmación (no se escribe «falta»): el costo de la toma, que es lo que decide, va igual.
      const fecha = diaMes(saldo.at);
      const queda = saldo.creditos != null && fecha ? ` En la última lectura (${fecha}) te quedaban ${saldo.creditos}.` : '';
      return {
        payload: { planId: a.item.id, toma: t.n },
        resumen: `Filmar la toma ${t.n} de «${tituloDeProyecto(a.item)}» en Google Flow: ${costo.medido ? '' : 'unos '}${creditos} créditos de tu cuenta.${queda}`,
      };
    },
    faltaParaConfirmar: async (p) => {
      const a = await anuncio(p);
      if ('error' in a) return a.error;
      return porQueNoFilmar(a.item, nToma(p), estadoDeToma(a.item, nToma(p)), await puenteListo());
    },
    ejecutar: async (p, ctx) => {
      const r = await (await deVideo()).generarTomaAction(pid(p), nToma(p));
      if (!r.ok) return { ok: false, resumen: r.error };
      // `ok: true` también vuelve sin filmar (la toma ya estaba): se cuenta lo que quedó marcado, no el ok.
      const m = r.item.video?.[String(nToma(p))];
      if (!m?.trabajoId && !m?.operacion && !m?.url) return { ok: false, resumen: `No se pudo pedir la toma ${nToma(p)}: ábrela en el estudio.` };
      return hecho(r, `Pedí la toma ${nToma(p)} a Google Flow: tarda un par de minutos.`, pid(p), ctx);
    },
  },

  descartar_toma_anuncio: {
    preparar: async (input) => conToma(input, (item, n) => (estadoDeToma(item, n) === 'filmada' ? null : { error: `La toma ${n} no tiene un clip para descartar.` }),
      (t, n) => `Descartar el clip de la toma ${n} de «${t}» para volver a filmarla (queda guardado).`),
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).descartarTomaAction(pid(p), nToma(p)), `Descarté el clip de la toma ${nToma(p)}.`, pid(p), ctx),
  },

  restaurar_toma_anuncio: {
    preparar: async (input) => conToma(input, (item, n) => (item.video?.[String(n)]?.descartadas?.some((d) => d.url) ? null : { error: `La toma ${n} no tiene un clip descartado para volver a poner.` }),
      (t, n) => `Volver a poner el último clip descartado de la toma ${n} de «${t}».`),
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).restaurarTomaAction(pid(p), nToma(p)), `Restauré el clip de la toma ${nToma(p)}.`, pid(p), ctx),
  },

  montar_anuncio_final: {
    preparar: async (input) => {
      const a = await anuncio(input);
      if ('error' in a) return a;
      const falta = a.item.plan.clips.find((c) => estadoDeToma(a.item, c.n) !== 'filmada');
      if (falta) return { error: `Falta filmar la toma ${falta.n}.` };
      const m = await leerMontaje(a.item.id).catch(() => null);
      if (m?.fase === 'encolado' || m?.fase === 'montando') return { error: 'Ya se está montando.', yaEstaba: true };
      return { payload: { planId: a.item.id }, resumen: `Montar «${tituloDeProyecto(a.item)}» con sus ${a.item.plan.clips.length} tomas.` };
    },
    ejecutar: async (p, ctx) => hecho(await (await deVideo()).montarAnuncioAction(pid(p)), 'Empecé el montaje: en unos minutos está en tus anuncios terminados.', pid(p), ctx),
  },

  rehabilitar_puente_flow: {
    preparar: async () => {
      const p = await leerPuenteEstricto().catch(() => null);
      if (!p) return { error: 'No pude leer tu navegador conectado. Vuelve a intentarlo.', falla: true };
      if (!puenteAnda(p, Date.now()).pausadaPorGoogle) return { error: 'Google Flow no está pausado: no hay nada que volver a habilitar.', yaEstaba: true };
      return { payload: {}, resumen: 'Volver a habilitar Google Flow en tu navegador. Sólo si ya hiciste lo que pedía el aviso.' };
    },
    ejecutar: async (_p, ctx) => {
      const r = await (await delPuente()).rehabilitarPuenteAction();
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: 'Listo: Google Flow volvió a quedar habilitado.', datos: { link: linkDelEstudio(null, ctx.ws) } };
    },
  },
});
