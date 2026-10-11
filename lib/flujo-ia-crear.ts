// =============================================================================
// flujo-ia-crear — crear una automatización con IA desde un pedido en palabras (server-only)
// =============================================================================
// Décima tanda (11/10/2026, docs/diseno-automations-galeria-v2.md §2): UNA implementación, DOS puertas. Hasta hoy todo
// esto vivía adentro de la ruta (app/api/chat-agent/secuencias/ia/route.ts); se mudó acá para que la llame también la
// API de MaKo (`crear_automatizacion_con_ia`, lib/api-mako/areas/chatbot.run.ts: «Pídeselo a MaKo» por WhatsApp). La
// ruta convierte `alFase` en el stream; la API lo llama sin stream.
//
//   · `armarContexto`, `crearNuevas` y `generar`: lo que comparten crear y editar (la ruta los usa para editar).
//   · `crearFlujoConIA`: el ORDEN de crear vive en lib/flujo-ia-crear-core.ts (puro, con test); acá se le enchufan las
//     dependencias de verdad, adentro de `runWithWorkspace(ws)` (un turno del doer no tiene cookies).
//
// ⚠️ NUNCA POR CLAUDE, NI POR NADA QUE COBRE. La llamada es `chatCheapCascade` sobre `PROVS_CREAR_IA` (gemini → groq →
// openrouter, lib/flujo-ia.ts), con el pin de /modelos-ia PRIMERO si es un proveedor gratis. `chatClaude` sin
// `fallback: []` caería a Sonnet PAGO, y la feature no tiene fila en CLAUDE_PERMITIDO.
//
// ⚠️ LA FALLA DE PRODUCCIÓN DEL 09/10/2026 (ws1, «Hay un problema de configuración de MaKo…»), medida con las keys
// reales: Gemini 403 (Google bloqueó el proyecto de la key), OpenRouter 404 (el modelo ya no es gratis), Mistral 429
// (siempre), OpenAI en la lista (cobra) y Groq —que contesta 200 con un flujo válido en 3,4 s— SALTEADO: la cascada suma
// prompt + maxTokens contra su techo (7k) y el pedido pesaba ~10k. Arreglo: el contexto compacto, la salida que entra
// (`salidaParaIA`), la lista sin pagos ni rebotes crónicos, un modelo gratis vivo para OpenRouter (`MODELOS_CREAR_IA`),
// y el motivo por proveedor (`falloDeIA`) en vez de la bolsa entera.
// =============================================================================

import 'server-only';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { chatCheapCascade, MODELO_DOCS, provsDe, tokensAprox, techoDeEntrada, type ProvName } from '@/lib/ai-cheap';
import { overrideDeFeature } from '@/lib/model-registry';
import { getPromptText } from '@/lib/prompt-render';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getVozGuia } from '@/lib/nutricion-generator';
import { setSecuenciaPasos, setSecuenciaActiva, PasosInvalidosError, type PasoSecuencia } from '@/lib/nutricion';
import {
  productosConEtapas, renombrarSecuencia, nombreDeSecuencia, setTriggerSecuencia, crearSecuenciaVacia, TriggerInvalidoError,
} from '@/lib/setting-secuencias';
import { listarEtiquetas, crearEtiqueta } from '@/lib/etiquetas';
import { listAudios } from '@/lib/setting-audios';
import { listarAdjuntos } from '@/lib/setting-adjuntos';
import { accionesParaFlujo } from '@/lib/api-mako/flujo';
import { getEntregables } from '@/lib/entregable';
import { getSetting } from '@/lib/settings';
import { KEY_LINK_VIDEO } from '@/lib/audios-paso';
import { eventTypeDeReunion } from '@/lib/calendly-agenda';
import { TRIGGERS } from '@/lib/email-marketing';
import { seccionesDisparo, pedidoDisparo } from '@/lib/flujo-conversacion';
import { marcasDeVoseo } from '@/lib/puestas-data';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import {
  FEATURE_CREAR_IA, LISTA_BLANCA_IA, CREAR_IA_SYSTEM_TEMPLATE, PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA,
  disparadoresParaIA, numerosEn, normNombre,
  type CtxIA, type ResultadoIA, type ResultadoEdicion, type LinkIA, type FalloIA,
} from '@/lib/flujo-ia';
import { crearConIA, type OptsCrearIA, type ResultadoCrearIA, type DepsCrearIA } from '@/lib/flujo-ia-crear-core';

/** Lo mínimo que tiene que quedar para intentar un escalón más (reparar o corregir). */
const MIN_PARA_OTRO_MS = 45_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Traducido = { r: ResultadoIA | ResultadoEdicion; errores: string[] };

// ── El contexto: lo que el negocio tiene configurado ─────────────────────────────

/**
 * El link de AGENDA: el del event type de la R1 de Calendly (`CALENDLY_EVENT_TYPE_J1`), que es lo
 * que el negocio configuró para que lo agenden. Medido el 08/10/2026: no hay otro link de agenda
 * guardado en ningún workspace. Sin Calendly, o si tarda más de 5 s, no hay link de agenda y la IA
 * no lo promete (`LINKS` va sin esa clave).
 */
async function linkDeAgenda(): Promise<string | null> {
  try {
    const et = await Promise.race([
      eventTypeDeReunion('R1'),
      new Promise<null>((r) => setTimeout(() => r(null), 5_000)),
    ]);
    const u = (et?.schedulingUrl ?? '').trim();
    return /^https?:\/\//i.test(u) ? u : null;
  } catch {
    return null;
  }
}

/**
 * Arma `CtxIA`. ⚠️ LAS ETIQUETAS SE LEEN ESTRICTAS (AGENTS.md: una lectura que cae al default sirve
 * para dibujar, nunca para decidir): con la lectura caída, `deIA` las tomaría a todas por NUEVAS y
 * crearía duplicados. Lo demás puede faltar: lo que no está se saca del flujo y queda en `avisos`.
 * (Las otras automatizaciones ya no se leen: sólo servían para un «Ir a», que la IA no arma más.)
 */
export async function armarContexto(ws: number, pedido: string): Promise<{ ctx: CtxIA; perfil: string; voz: string | null }> {
  const [etiquetas, productos, audios, archivos, accionesWs, entregables, video, agenda, perfil, voz] = await Promise.all([
    listarEtiquetas({ incluirArchivadas: true }),
    productosConEtapas().catch(() => []),
    listAudios().catch(() => []),
    listarAdjuntos().catch(() => []),
    accionesParaFlujo(ws).catch(() => []),
    getEntregables().catch(() => []),
    getSetting(KEY_LINK_VIDEO).catch(() => null),
    linkDeAgenda(),
    perfilNegocioTexto().catch(() => ''),
    getVozGuia().catch(() => null),
  ]);

  // LOS LINKS: clave → URL. La URL NO viaja al modelo (`userDeCrear` manda la clave y el «para»).
  const links: Record<string, LinkIA> = {};
  if (agenda) links.agenda = { url: agenda, para: 'el link para que agende la llamada' };
  const v = (video ?? '').trim();
  if (/^https?:\/\//i.test(v)) links.video = { url: v, para: 'el video que conviene ver antes de hablar' };
  entregables.filter((e) => /^https?:\/\//i.test((e.enlace ?? '').trim())).forEach((e, k) => {
    links[`material:${k + 1}`] = { url: e.enlace!.trim(), para: `${e.nombre}${e.tipo ? ` (${e.tipo})` : ''}` };
  });

  const prods = productos.map((p) => ({
    funnelId: p.funnelId, productoId: p.productoId, nombre: p.nombre, esDefault: p.esDefault,
    etapas: p.etapas, etapasEntrega: p.etapasEntrega,
  }));
  // EL DISPARADOR: el mismo catálogo cerrado que el desplegable del CRON, aplanado CON EL PRODUCTO
  // en el rótulo (`disparadoresParaIA`: con dos productos con la misma etapa, el rótulo pelado
  // elegía el embudo equivocado). `manual` no inscribe a nadie: se saca (la secuencia vacía nace
  // con él y la sección «La que tiene puesta» lo trae).
  const disparadores = disparadoresParaIA(seccionesDisparo({
    disparadores: TRIGGERS, productos: prods, etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre, archivada_at: e.archivada_at })),
    actual: { trigger_tipo: 'manual' }, textoActual: 'manual',
  })).filter((o) => o.value !== 'trigger:manual');

  // LA LISTA BLANCA, cruzada con lo que la capa del workspace ve, y otra vez contra gratis y
  // reversible por si el registro cambia (el test lo cruza también).
  const acciones = accionesWs
    .filter((a) => LISTA_BLANCA_IA.includes(a.id) && a.costo === 'gratis' && a.reversible)
    .map((a) => ({ id: a.id, titulo: a.titulo, parametros: a.parametros }));

  const ctx: CtxIA = {
    etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre, archivada: !!e.archivada_at })),
    productos: prods,
    disparadores,
    audios: audios.map((a) => ({ id: a.id, titulo: a.titulo, transcript: a.transcript })),
    archivos: archivos.map((a) => ({ id: a.id, titulo: a.titulo, mime: a.media_mime })),
    acciones,
    links,
    usaVoseo: !!voz && marcasDeVoseo(voz).length > 0,
    // Un MONTO de una acción sólo vale si lo escribió una persona: en el perfil o en el pedido.
    numerosPermitidos: numerosEn(`${perfil}\n${pedido}`),
    // La segunda capa de «un alumno → todas las etapas de la entrega» (cuarta tanda, punto 14).
    pedido,
  };
  return { ctx, perfil, voz };
}

// ── Las etiquetas nuevas, recién al final ─────────────────────────────────────────

/**
 * Crea las etiquetas nuevas y devuelve ref → id real. Si una ya existe con ese nombre (otra
 * pestaña la creó en el medio), se usa ésa: lo que se buscaba era la etiqueta, no crear una.
 */
export async function crearNuevas(nuevas: ResultadoIA['etiquetasNuevas']): Promise<{ ids: Map<number, number>; creadas: Array<{ id: number; nombre: string }> }> {
  const ids = new Map<number, number>();
  const creadas: Array<{ id: number; nombre: string }> = [];
  for (const n of nuevas) {
    try {
      const { etiqueta } = await crearEtiqueta({ nombre: n.nombre });
      ids.set(n.ref, etiqueta.id);
      creadas.push({ id: etiqueta.id, nombre: etiqueta.nombre });
    } catch (e) {
      const ya = (await listarEtiquetas({ incluirArchivadas: false })).find((x) => normNombre(x.nombre) === normNombre(n.nombre));
      if (!ya) throw new Error(`No pude crear la etiqueta «${n.nombre}»: ${msg(e)}`);
      ids.set(n.ref, ya.id);
    }
  }
  return { ids, creadas };
}

// ── La llamada al modelo, con sus tres escalones ──────────────────────────────────

/**
 * UNA pasada por la cascada GRATIS. `traducir` es la segunda capa (parsea + `deIA` + `validarIA` +
 * `validarGrafo`) y va como `validar`: una salida inservible prueba el proveedor siguiente en vez
 * de llegar a la pantalla. Devuelve el resultado bueno, o lo que hace falta para el escalón
 * siguiente: los textos que no parsearon y los errores de la última salida que sí.
 */
async function pasada<R extends ResultadoIA>(p: {
  system: string; user: string; motivo: string; hastaMs: number;
  traducir: (obj: Record<string, unknown>) => { r: R; errores: string[] };
  provs: ProvName[]; modelos: Partial<Record<ProvName, string>>; errores: string[];
}): Promise<{ bueno: R | null; crudos: string[]; ultimo: string[] | null }> {
  const out: { bueno: R | null; crudos: string[]; ultimo: string[] | null } = { bueno: null, crudos: [], ultimo: null };
  // ⚠️ LA SALIDA SE DIMENSIONA PARA QUE GROQ ENTRE (`salidaParaIA`): con 6000 fijos la cascada lo
  // salteaba siempre, y era el único proveedor que le contestaba al ws1.
  const maxTokens = salidaParaIA(tokensAprox(p.system) + tokensAprox(p.user), techoDeEntrada('groq'));
  await chatCheapCascade({
    system: p.system, user: p.user, json: true, maxTokens, temperature: 0.4,
    feature: FEATURE_CREAR_IA, motivo: p.motivo,
    provs: p.provs, modelos: p.modelos, timeoutMs: 100_000, hastaMs: p.hastaMs,
    erroresOut: p.errores,
    validar: (t) => {
      let obj: Record<string, unknown>;
      try { obj = parseJsonObject(t); } catch { out.crudos.push(t); return false; }
      const tr = p.traducir(obj);
      if (tr.errores.length) { out.ultimo = tr.errores; return false; }
      out.bueno = tr.r;
      return true;
    },
  }).catch((e) => { p.errores.push(msg(e)); return ''; });
  return out;
}

/** La lista de proveedores con el pin de /modelos-ia PRIMERO si es gratis, y sus modelos. */
async function proveedores(): Promise<{ provs: ProvName[]; modelos: Partial<Record<ProvName, string>> }> {
  // El pin de /modelos-ia va PRIMERO y el resto de la lista atrás: con el pin solo, una key de ese
  // proveedor bloqueada dejaba la feature sin nadie a quien caer. Un pin pago (Claude, OpenAI) no se
  // usa: esta feature no cobra nunca.
  const pin = await overrideDeFeature(FEATURE_CREAR_IA).catch(() => null);
  const pinGratis = pin != null && PROVS_GRATIS_PIN.includes(pin.provider as ProvName) ? pin : null;
  const provs: ProvName[] = pinGratis
    ? [pinGratis.provider as ProvName, ...PROVS_CREAR_IA.filter((x) => x !== pinGratis.provider)]
    : [...PROVS_CREAR_IA];
  const modelos: Partial<Record<ProvName, string>> = {
    ...MODELO_DOCS, ...MODELOS_CREAR_IA,
    ...(pinGratis ? { [pinGratis.provider]: pinGratis.model } : {}),
  };
  return { provs, modelos };
}

/**
 * ¿HAY UNA IA GRATIS para crear? La pregunta que hace la API de MaKo ANTES de proponer (`preparar`: lo que se
 * puede saber sin escribir falla ahí, AGENTS.md). Las mismas cuentas que va a probar `generar`.
 */
export async function hayIAParaCrear(): Promise<boolean> {
  const { provs } = await proveedores();
  return (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
}

/**
 * Los TRES escalones (molde: `objetoDelPlan` de lib/video-planner.ts, más el reintento con los
 * errores del relevo R5):
 *   1. la cascada, con `parseJsonObject` (repara sin red) adentro del `validar`;
 *   2. si algún proveedor escribió un JSON que no se pudo leer, la cascada lo COPIA como JSON
 *      válido (no se le pide que piense) y se vuelve a traducir;
 *   3. si lo que se leyó tenía errores de validación, UN reintento listándolos («corrige esto»).
 * Si nada sirve, el error honesto: `falloDeIA` (el motivo por proveedor, en una línea) cuando nadie
 * contestó, o qué quedó mal. `hastaMs`: hasta cuándo tiene la cascada (deja aire para guardar).
 */
export async function generar<R extends ResultadoIA>(p: {
  system: string; user: string; hastaMs: number;
  traducir: (obj: Record<string, unknown>) => { r: R; errores: string[] };
}): Promise<{ r: R } | FalloIA> {
  const { provs, modelos } = await proveedores();
  const hastaMs = p.hastaMs;
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];

  const uno = await pasada({ ...p, motivo: 'Crear una automatización con IA', hastaMs, provs, modelos, errores });
  if (uno.bueno) return { r: uno.bueno };
  let ultimo = uno.ultimo;

  // 2. Un JSON que no se pudo leer: que la cascada lo copie bien.
  if (uno.crudos.length && quedan() > MIN_PARA_OTRO_MS) {
    const crudo = uno.crudos[uno.crudos.length - 1];
    console.error('[secuencias/ia] JSON inválido del modelo (2000):', crudo.slice(0, 2000));
    const copia = await chatCheapCascade({
      system: 'Recibes un texto que pretende ser un JSON pero tiene errores de sintaxis. Devuelve EXACTAMENTE el mismo contenido como JSON válido: mismas claves, mismos valores, mismo orden. No agregues, no quites, no comentes. Solo el JSON.',
      user: crudo.slice(0, 60_000), json: true, maxTokens: 8000, temperature: 0,
      feature: FEATURE_CREAR_IA, motivo: 'reparar el JSON de la automatización', provs, modelos, hastaMs, erroresOut: errores,
      validar: (t) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (copia) {
      try {
        const tr = p.traducir(parseJsonObject(copia));
        if (!tr.errores.length) return { r: tr.r };
        ultimo = tr.errores;
      } catch { /* sigue al reintento o al error */ }
    }
  }

  // 3. Lo que se leyó tenía errores: un reintento diciéndole cuáles.
  if (ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${p.user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON COMPLETO:\n${ultimo.slice(0, 12).map((e) => `- ${e}`).join('\n')}`;
    const dos = await pasada({ ...p, user: corregir, motivo: 'Corregir la automatización con IA', hastaMs, provs, modelos, errores });
    if (dos.bueno) return { r: dos.bueno };
    if (dos.ultimo) ultimo = dos.ultimo;
  }

  if (ultimo) {
    // ⚠️ EL DETALLE VA AL LOG, NO A LA PANTALLA (revisión, 09/10/2026): los errores de
    // `validarGrafo` traen ids internos («tarjetas sueltas: m2»), que no le dicen nada a nadie.
    console.error('[secuencias/ia] la salida no pasó la revisión:', ultimo.join(' | '));
    return { error: 'MaKo armó el flujo pero quedó mal. Prueba de nuevo o cambia una palabra del pedido.' };
  }
  if (uno.crudos.length) return { error: 'MaKo escribió el flujo pero se cortó al leerlo. Prueba de nuevo.' };
  console.error('[secuencias/ia] ningún proveedor armó el flujo:', errores.join(' | '));
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
  return falloDeIA(errores, hayIA);
}

// ── Crear: el orden en lib/flujo-ia-crear-core.ts, con las dependencias de verdad ──

/** Lo que devuelve crear (re-exportado para las dos puertas). */
export type { ResultadoCrearIA, OptsCrearIA } from '@/lib/flujo-ia-crear-core';

/** Las dependencias de verdad, para el workspace del contexto (ver `crearFlujoConIA`). */
function depsReales(ws: number): DepsCrearIA {
  const filaDe = async (id: number) => {
    const db = await getTenantDb();
    const { data, error } = await db.from('nutricion_secuencias').select('pasos, nombre').eq('id', id).maybeSingle();
    if (error) throw new Error(`No pude leer la automatización: ${error.message}`);
    if (!data) return null;
    const d = data as { pasos?: unknown; nombre?: unknown };
    return { pasos: Array.isArray(d.pasos) ? (d.pasos as PasoGrafo[]) : [], nombre: String(d.nombre ?? '') };
  };
  return {
    contexto: (pedido) => armarContexto(ws, pedido),
    // Sin slots: lo variable va en el `user` (un override guardado no conoce bloques nuevos).
    system: () => getPromptText('chatbot.crear-ia.system', CREAR_IA_SYSTEM_TEMPLATE),
    generar: (p) => generar(p),
    crearEtiquetas: crearNuevas,
    filaDe,
    // `crearSecuenciaVacia`: PAUSADA, `manual` (no inscribe a nadie) y con el nombre normalizado.
    insertar: (nombre) => crearSecuenciaVacia(nombre),
    borrar: async (id) => {
      const db = await getTenantDb();
      const { error } = await db.from('nutricion_secuencias').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    pausar: (id) => setSecuenciaActiva(id, false),
    guardarPasos: (id, pasos) => setSecuenciaPasos(id, pasos as unknown as PasoSecuencia[]),
    motivoDePasos: (e) => (e instanceof PasosInvalidosError ? e.message : null),
    ponerDisparador: async (id, valor) => {
      const pedidoTrigger = pedidoDisparo(valor, id);
      if (!pedidoTrigger) throw new TriggerInvalidoError('no se entiende');
      await setTriggerSecuencia(id, {
        trigger_tipo: String(pedidoTrigger.trigger_tipo ?? ''),
        etapa: pedidoTrigger.etapa == null ? null : String(pedidoTrigger.etapa),
        // VARIAS etapas (punto 14): las del alumno, o las que pidió el modelo en una lista.
        etapas: Array.isArray(pedidoTrigger.etapas) ? (pedidoTrigger.etapas as unknown[]).map(String) : null,
        producto_id: pedidoTrigger.producto_id == null ? null : Number(pedidoTrigger.producto_id),
        etiqueta_id: pedidoTrigger.etiqueta_id == null ? null : Number(pedidoTrigger.etiqueta_id),
        // Ausente = no toca el embudo (`setTriggerSecuencia`); sólo una etapa de venta lo trae.
        ...('funnel_id' in pedidoTrigger ? { funnel_id: pedidoTrigger.funnel_id == null ? null : Number(pedidoTrigger.funnel_id) } : {}),
      });
    },
    motivoDeDisparador: (e) => (e instanceof TriggerInvalidoError ? e.message : null),
    renombrar: async (id, nombre) => {
      const n = nombreDeSecuencia(nombre);
      if (!n) return null;
      await renombrarSecuencia(id, n);
      return n;
    },
  };
}

/**
 * CREA UNA AUTOMATIZACIÓN CON IA, pausada, en el workspace `ws`. Sin `secuenciaId`, la fila nace al guardar (un fallo
 * o un «Cancelar» no deja nada); con él, escribe encima de esa (que tiene que estar vacía y pausada: lo mira quien
 * llama). Nunca lanza por un fallo del modelo o de los pasos: vuelve `{ ok: false, error, link? }`.
 */
export async function crearFlujoConIA(o: OptsCrearIA): Promise<ResultadoCrearIA> {
  // ⚠️ EL WORKSPACE ES LA PRIMERA LÍNEA (AGENTS.md): todo lo de abajo lee el del contexto.
  return runWithWorkspace(o.ws, () => crearConIA(o, depsReales(o.ws)));
}
