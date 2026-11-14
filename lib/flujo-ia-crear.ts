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
import { chatCheapCascade, MODELO_DOCS, provsDe, provsGratisDePlataforma, suClaudeContesta, tokensAprox, techoDeEntrada, type ProvName } from '@/lib/ai-cheap';
import { overrideDeFeature } from '@/lib/model-registry';
import { getPromptText } from '@/lib/prompt-render';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getVozGuia } from '@/lib/nutricion-generator';
import { setSecuenciaPasos, setSecuenciaActiva, setSecuenciaReentrada, leadsDeCohorte, PasosInvalidosError, type PasoSecuencia } from '@/lib/nutricion';
import { etapasDe } from '@/lib/nutricion-etapa';
import {
  productosConEtapas, renombrarSecuencia, nombreDeSecuencia, crearSecuenciaVacia, TriggerInvalidoError,
} from '@/lib/setting-secuencias';
import { guardarDisparadores } from '@/lib/disparadores-guardar';
import { estadoCanalesDisparo } from '@/lib/disparadores-canales';
import { opcionesCronIA, disparadorDeValorIA, recurrenteDeValorIA, PIDE_ANUNCIO, PIDE_MENCION, type CanalesConectadosIA } from '@/lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '@/lib/condiciones-catalogos';
import { catalogosRemotos } from '@/lib/condiciones-catalogo-datos';
import { listarEtiquetas, crearEtiqueta } from '@/lib/etiquetas';
import { listAudios } from '@/lib/setting-audios';
import { listarAdjuntos } from '@/lib/setting-adjuntos';
import { accionesParaFlujo } from '@/lib/api-mako/flujo';
import { getEntregables } from '@/lib/entregable';
import { getSetting } from '@/lib/settings';
import { KEY_LINK_VIDEO } from '@/lib/audios-paso';
import { eventTypeDeReunion } from '@/lib/calendly-agenda';
import { marcasDeVoseo } from '@/lib/puestas-data';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { guardarSinSetterSiFrena } from '@/lib/setter-ia-reglas';
import type { QuienContesto } from '@/lib/quien-contesto';
import {
  FEATURE_CREAR_IA, LISTA_BLANCA_IA, CREAR_IA_SYSTEM_TEMPLATE, PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA,
  disparadoresParaIA, numerosEn, normNombre,
  type CtxIA, type ResultadoIA, type ResultadoEdicion, type LinkIA, type FalloIA, falloDeRevision,
} from '@/lib/flujo-ia';
import { crearConIA, type OptsCrearIA, type ResultadoCrearIA, type DepsCrearIA } from '@/lib/flujo-ia-crear-core';
import { agregarAlChat } from '@/lib/automatizacion-chat-db';

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

/** Hasta cuánto se espera a saber qué canales están conectados (Meta, Zernio y las pasarelas contestan por red). */
const TOPE_CANALES_MS = 10_000;

/**
 * ¿QUÉ CANALES PUEDE ELEGIR LA IA EN EL CRON? Los que `estadoCanalesDisparo` (la MISMA lectura que el selector del CRON)
 * dice conectados. «No pude comprobarlo», un error o la demora valen «no»: la pantalla tampoco ofrece esos eventos, y
 * un CRON que no puede llegar es una automatización que no arranca nunca, sin un error.
 */
async function canalesConectados(): Promise<CanalesConectadosIA> {
  const nada: CanalesConectadosIA = { instagram: false, messenger: false, email: false, pagos: false };
  try {
    const e = await Promise.race([
      estadoCanalesDisparo(),
      new Promise<null>((r) => setTimeout(() => r(null), TOPE_CANALES_MS)),
    ]);
    if (!e) return nada;
    return {
      instagram: e.instagram?.conectado === true, messenger: e.messenger?.conectado === true,
      email: e.email?.conectado === true, pagos: e.pagos?.conectado === true,
    };
  } catch (err) {
    console.error('[flujo-ia-crear] los canales del CRON:', msg(err));
    return nada;
  }
}

/**
 * Arma `CtxIA`. ⚠️ LAS ETIQUETAS SE LEEN ESTRICTAS (AGENTS.md: una lectura que cae al default sirve
 * para dibujar, nunca para decidir): con la lectura caída, `deIA` las tomaría a todas por NUEVAS y
 * crearía duplicados. Lo demás puede faltar: lo que no está se saca del flujo y queda en `avisos`.
 * (Las otras automatizaciones ya no se leen: sólo servían para un «Ir a», que la IA no arma más.)
 *
 * DUODÉCIMA TANDA (12/10/2026, docs/diseno-duodecima-tanda.md §2.2 y §2.3): el CRON y las condiciones salen de las
 * MISMAS funciones que la pantalla (`opcionesCronIA`, `catalogosDe` + `catalogosRemotos`).
 */
export async function armarContexto(ws: number, pedido: string, o: { textos?: string; anuncio?: boolean; mencion?: boolean } = {}): Promise<{ ctx: CtxIA; perfil: string; voz: string | null }> {
  const [etiquetas, productos, audios, archivos, accionesWs, entregables, video, agenda, perfil, voz, conectados, remotos] = await Promise.all([
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
    canalesConectados(),
    // Como el editor: si la lectura falla, `remotos` es null y las condiciones que la necesitan no se ofrecen.
    catalogosRemotos().catch((e: unknown) => { console.error('[flujo-ia-crear] los catálogos de las condiciones:', msg(e)); return null; }),
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
  // EL DISPARADOR: el mismo catálogo cerrado que el desplegable del CRON (`opcionesCronIA`: los kanbans, las
  // etiquetas, y los eventos de Instagram, Messenger, Email y Pagos de los canales CONECTADOS), aplanado CON EL
  // PRODUCTO en el rótulo (`disparadoresParaIA`: con dos productos con la misma etapa, el rótulo pelado elegía el
  // embudo equivocado). Ni `manual` ni el Recurrente: uno no inscribe a nadie, y el horario del otro lo saca el CÓDIGO del
  // pedido (20/10/2026, `recurrenteDelPedido`, lib/flujo-ia-recurrente.ts): de esta lista sale sólo A QUIÉN le llega.
  // DUODÉCIMA TANDA: de ESTO salen también las preguntas de MaKo (`preguntaAntes`, lib/flujo-ia-preguntas.ts), en la
  // pantalla y en la API (`preparar` llama a esta misma función): las dos ven las MISMAS opciones.
  const disparadores = disparadoresParaIA(opcionesCronIA({
    productos: prods, etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre, archivada_at: e.archivada_at })), conectados,
    // El «clic en un anuncio» sólo si el pedido habla de anuncios (28/10/2026): el techo de Groq.
    // También si lo nombró en «Otra cosa» (`textos`) o si el CRON guardado ES el del anuncio (`anuncio`, la ruta al explicar o
    // editar): sin eso «¿Qué hace esta automatización?» no encontraba su CRON y contestaba «no tiene CRON».
    anuncio: o.anuncio === true || PIDE_ANUNCIO.test(o.textos ? `${pedido}\n${o.textos}` : pedido),
    // La mención en una historia (10/11/2026), con la misma regla y por el mismo techo.
    mencion: o.mencion === true || PIDE_MENCION.test(o.textos ? `${pedido}\n${o.textos}` : pedido),
  }));
  // LAS CONDICIONES: el MISMO catálogo que arma el editor (`catalogosDe`), con las etapas y los productos como se los
  // pasa el lienzo (`etapasDeCondicion`).
  const catalogoCondicion = catalogosDe({ etapas: etapasDeCondicion(prods), productos: prods, remotos });

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
    catalogoCondicion,
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
 *
 * ⚠️ `pararEnRevision` (17/10/2026, tarjeta #847, «se quedó pensando»): con un JSON que se LEE pero no pasa la revisión,
 * la cascada para y el error va al «Corregir» (escalón 3). Probar el proveedor siguiente con el MISMO pedido repite el
 * error, porque casi siempre es el pedido el que lo pide: Joan (ws13) quería «el día y hora de la reunión» en el aviso,
 * y Gemini, Groq dos veces y Gemini de la red lo repitieron (16/10 21:27-21:29, medido en anthropic_usage y en el log);
 * con un Gemini colgado 100 s en el medio, el plazo se fue y el «Corregir» nunca corrió: 2,5 min y un error.
 */
/**
 * EL TOPE DE UN INTENTO (17/10/2026, tarjeta #847: «que tarde segundos en lugar de minutos»). Era 100 s: un proveedor
 * colgado se comía casi medio plazo antes de pasar al siguiente. Medido en `anthropic_usage` (14 días, 36 llamadas de
 * `chatbot-crear-ia`): entre un intento y el siguiente, la mediana es 11 s, OpenRouter contestaba entre 38 y 47 s, y los
 * huecos de 76 a 206 s son los colgados. Y NINGUNA salida de más de 45 s fue la que se aceptó: las de OpenRouter a los
 * 76-97 s (ws10 y ws11) y la de Gemini a los 86 s (ws13) siguieron de largo al proveedor de después. Con 45 s entra lo
 * que contesta y lo que cuelga cuesta menos de la mitad.
 */
export const INTENTO_CREAR_MS = 45_000;

async function pasada<R extends { avisos: string[] }>(p: {
  system: string; user: string; motivo: string; hastaMs: number;
  traducir: (obj: Record<string, unknown>) => { r: R; errores: string[] };
  provs: ProvName[]; modelos: Partial<Record<ProvName, string>>; errores: string[]; erroresRed: string[];
  pararEnRevision?: boolean;
  alIntentar?: () => void;
}): Promise<{ bueno: R | null; crudos: string[]; ultimo: string[] | null; ultimoR: R | null; quien: QuienContesto | null }> {
  const out: { bueno: R | null; crudos: string[]; ultimo: string[] | null; ultimoR: R | null; quien: QuienContesto | null } = { bueno: null, crudos: [], ultimo: null, ultimoR: null, quien: null };
  // Quién escribió lo que se aceptó (lib/quien-contesto.ts): el chat lo dice («Con tu Claude»).
  const quien: Partial<QuienContesto> = {};
  // ⚠️ LA SALIDA SE DIMENSIONA PARA QUE GROQ ENTRE (`salidaParaIA`): con 6000 fijos la cascada lo
  // salteaba siempre, y era el único proveedor que le contestaba al ws1.
  const maxTokens = salidaParaIA(tokensAprox(p.system) + tokensAprox(p.user), techoDeEntrada('groq'));
  await chatCheapCascade({
    system: p.system, user: p.user, json: true, maxTokens, temperature: 0.4,
    feature: FEATURE_CREAR_IA, motivo: p.motivo,
    provs: p.provs, modelos: p.modelos, timeoutMs: INTENTO_CREAR_MS, hastaMs: p.hastaMs, alIntentar: p.alIntentar,
    // ⚠️ SIN EL MODELO DE RESPALDO (duodécima tanda, §1.3): después del 429 de gemini-flash la cascada probaba
    // gemini-flash-lite, que escribió #243 y #245 de ws10 (un flujo por WhatsApp pedido por Instagram). Sin él, el
    // 429 pasa a Groq.
    sinRespaldoDeModelo: true,
    erroresOut: p.errores,
    quienOut: quien,
    // ⚠️ LA RED DE PLATAFORMA (15/10/2026, AGENTS.md: «todo camino de IA que use un cliente necesita su red»): con las
    // keys del negocio caídas, las gratis de la agencia, empezando por otro proveedor, y el uso queda anotado como «⚠ red
    // de plataforma». Hasta hoy no estaba: un negocio con UNA key de Gemini (Joan, ws17) se quedaba sin el chat del lienzo.
    // Lo que falla en la red va a su lista (`erroresPlataformaOut`), no a la del negocio: el mensaje habla de SUS keys.
    redDePlataforma: true,
    erroresPlataformaOut: p.erroresRed,
    validar: (t) => {
      let obj: Record<string, unknown>;
      try { obj = parseJsonObject(t); } catch { out.crudos.push(t); return false; }
      const tr = p.traducir(obj);
      if (tr.errores.length) { out.ultimo = tr.errores; out.ultimoR = tr.r; return !!p.pararEnRevision; }
      out.bueno = tr.r;
      return true;
    },
  }).catch((e) => { p.errores.push(msg(e)); return ''; });
  if (out.bueno && quien.proveedor && quien.de) out.quien = quien as QuienContesto;
  return out;
}

/**
 * ¿Su Claude puede armar el flujo? Su clave de Claude, o el crédito que le asignó Martín (el ws1, 22/10/2026: «habilita los
 * tokens de la API de la cuenta de Mauricio… así puedo seguir probando en Automations»). La cascada lo prueba PRIMERO, así que
 * quien lo tiene, tiene con qué crear, aunque no tenga ninguna clave barata. Sólo pregunta (lib/ai-cheap.ts): esta ruta no
 * importa la capa de Claude.
 */
const suClaudeCrea = (): Promise<boolean> => suClaudeContesta(FEATURE_CREAR_IA).catch(() => false);

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
 * puede saber sin escribir falla ahí, AGENTS.md). Las mismas cuentas que va a probar `generar`: las del negocio
 * Y la red de la plataforma.
 *
 * ⚠️ Hasta el 16/10/2026 miraba sólo las del negocio, y `generar` ya corría con la red: a un cliente nuevo sin
 * API (que desde el 15/10 no la trae) MaKo le contestaba «conecta tu IA» por WhatsApp para algo que la pantalla
 * le creaba sin problema.
 */
export async function hayIAParaCrear(): Promise<boolean> {
  if (await suClaudeCrea()) return true;
  const { provs } = await proveedores();
  if ((await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0)) return true;
  return (await provsGratisDePlataforma().catch(() => [])).length > 0;
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
 * `motivo`: lo que queda en el registro de uso de IA (editar pasa «Editar una automatización con IA»).
 */
export async function generar<R extends { avisos: string[] }>(p: {
  system: string; user: string; hastaMs: number;
  traducir: (obj: Record<string, unknown>) => { r: R; errores: string[] };
  motivo?: string;
  /** El número de cada pedido a un proveedor, al arrancarlo (1, 2, …), contando los tres escalones (#847). */
  alIntento?: (n: number) => void;
}): Promise<{ r: R; quien?: QuienContesto | null } | FalloIA> {
  const { provs, modelos } = await proveedores();
  let intentos = 0;
  const alIntentar = p.alIntento ? () => { intentos += 1; p.alIntento!(intentos); } : undefined;
  const hastaMs = p.hastaMs;
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];
  /**
   * Lo que falló en la RED DE PLATAFORMA (las keys de la agencia): al log, y nunca mezclado con las keys del negocio. Sólo
   * entra al mensaje cuando el negocio no tiene keys propias, para decir qué le pasó a la IA gratis de MaKo (`sinIAPropia`).
   */
  const erroresRed: string[] = [];
  const motivo = p.motivo?.trim() || 'Crear una automatización con IA';

  const uno = await pasada({ ...p, motivo, hastaMs, provs, modelos, errores, erroresRed, pararEnRevision: true, alIntentar });
  if (uno.bueno) return { r: uno.bueno, quien: uno.quien };
  let ultimo = uno.ultimo;
  let ultimoR = uno.ultimoR;

  // 2. Un JSON que no se pudo leer: que la cascada lo copie bien.
  if (uno.crudos.length && quedan() > MIN_PARA_OTRO_MS) {
    const crudo = uno.crudos[uno.crudos.length - 1];
    console.error('[secuencias/ia] JSON inválido del modelo (2000):', crudo.slice(0, 2000));
    const quienCopia: Partial<QuienContesto> = {};
    const copia = await chatCheapCascade({
      system: 'Recibes un texto que pretende ser un JSON pero tiene errores de sintaxis. Devuelve EXACTAMENTE el mismo contenido como JSON válido: mismas claves, mismos valores, mismo orden. No agregues, no quites, no comentes. Solo el JSON.',
      user: crudo.slice(0, 60_000), json: true, maxTokens: 8000, temperature: 0,
      feature: FEATURE_CREAR_IA, motivo: `reparar el JSON · ${motivo}`, provs, modelos, hastaMs, erroresOut: errores, alIntentar,
      sinRespaldoDeModelo: true, redDePlataforma: true, erroresPlataformaOut: erroresRed, quienOut: quienCopia,
      validar: (t) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (copia) {
      try {
        const tr = p.traducir(parseJsonObject(copia));
        // Se dice quién lo pasó en limpio: el primero escribió un JSON roto y no quedó anotado.
        if (!tr.errores.length) return { r: tr.r, quien: quienCopia.proveedor && quienCopia.de ? quienCopia as QuienContesto : null };
        ultimo = tr.errores;
        ultimoR = tr.r;
      } catch { /* sigue al reintento o al error */ }
    }
  }

  // 3. Lo que se leyó tenía errores: un reintento diciéndole cuáles.
  if (ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${p.user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON COMPLETO:\n${ultimo.slice(0, 12).map((e) => `- ${e}`).join('\n')}`;
    const dos = await pasada({ ...p, user: corregir, motivo: `Corregir · ${motivo}`, hastaMs, provs, modelos, errores, erroresRed, alIntentar });
    if (dos.bueno) return { r: dos.bueno, quien: dos.quien };
    if (dos.ultimo) { ultimo = dos.ultimo; ultimoR = dos.ultimoR; }
  }

  if (ultimo) {
    console.error('[secuencias/ia] la salida no pasó la revisión:', ultimo.join(' | '));
    return { error: falloDeRevision(ultimo, (ultimoR as { pasos?: PasoGrafo[] } | null)?.pasos ?? []) };
  }
  if (uno.crudos.length) return { error: 'MaKo escribió el flujo pero se cortó al leerlo. Prueba de nuevo.' };
  console.error('[secuencias/ia] ningún proveedor armó el flujo:', errores.join(' | '), erroresRed.length ? `· red de plataforma: ${erroresRed.join(' | ')}` : '');
  // Su Claude (su clave o el crédito asignado) también es una IA suya: el mensaje no le pide conectar lo que ya tiene.
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0) || (await suClaudeCrea());
  // `erroresRed` sólo cuenta si el negocio no tiene keys propias: dice qué le pasó a la IA gratis de MaKo (AU3).
  return falloDeIA(errores, hayIA, erroresRed);
}

// ── Crear: el orden en lib/flujo-ia-crear-core.ts, con las dependencias de verdad ──

/** Lo que devuelve crear (re-exportado para las dos puertas). */
export type { ResultadoCrearIA, OptsCrearIA, PreguntaCrearIA } from '@/lib/flujo-ia-crear-core';

/**
 * CUÁNTOS ALCANZA HOY EL CRON DE UN VALOR (la pregunta «¿A quién le llega?» y el mensaje de «Creé…», 20/10/2026): la
 * MISMA cohorte que barre el motor (`leadsDeCohorte`, con su ventana de 90 días), no los leads del embudo. Contar el
 * embudo entero diría un número plausible y falso. null = no se pudo (sin número, nunca un cero inventado).
 */
export async function contarCohorte(valor: string): Promise<number | null> {
  const [d] = disparadorDeValorIA(valor);
  if (!d) return null;
  try {
    const ids = await leadsDeCohorte(d.trigger_tipo, etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null }), d.funnel_id ?? null, d.producto_id ?? null, d.etiqueta_id ?? null);
    return ids.length;
  } catch (e) {
    console.error('[flujo-ia-crear] no pude contar la cohorte:', msg(e));
    return null;
  }
}

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
    contexto: (pedido, x) => armarContexto(ws, pedido, x),
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
    // Con MaKo Esencial, lo que arma la IA nace SIN el setter con IA si la puerta lo frena (14/11/2026, lib/setter-ia-reglas.ts):
    // cada «Sola» en «Para aprobar», y la automatización se crea igual.
    guardarPasos: (id, pasos) => guardarSinSetterSiFrena(pasos, (ps) => setSecuenciaPasos(id, ps as unknown as PasoSecuencia[])),
    motivoDePasos: (e) => (e instanceof PasosInvalidosError ? e.message : null),
    // ⚠️ POR LA PUERTA DE LA PANTALLA (duodécima tanda, §1.4): `guardarDisparadores` escribe las COLUMNAS (el 409 de
    // la ruta y los quince lectores de siempre) Y la lista de la 0241, y valida contra el negocio. Con
    // `setTriggerSecuencia` la lista quedaba en NULL (#243 y #245 de ws10) y un CRON de Instagram no se podía poner.
    // VARIAS etapas (punto 14) viajan en el valor (`venta:5:a,b`) y `disparadorDeValorIA` las conserva.
    // Con `cron` (20/10/2026) es un Recurrente: el valor es a quién y el horario lo puso el código (`recurrenteDeValorIA`).
    ponerDisparador: async (id, valor, cron) => {
      const lista = cron ? recurrenteDeValorIA(valor, cron) : disparadorDeValorIA(valor);
      if (!lista.length) throw new TriggerInvalidoError('no se entiende');
      await guardarDisparadores(id, lista);
    },
    motivoDeDisparador: (e) => (e instanceof TriggerInvalidoError ? e.message : null),
    ponerReentrada: (id, modo) => setSecuenciaReentrada(id, modo),
    contar: contarCohorte,
    renombrar: async (id, nombre) => {
      const n = nombreDeSecuencia(nombre);
      if (!n) return null;
      await renombrarSecuencia(id, n);
      return n;
    },
    // El chat de la fila nueva (§2.5), con el ws de ESTE pedido (`agregarAlChat` va con `runWithWorkspace(ws)`).
    guardarChat: async (id, mensajes) => { await agregarAlChat(ws, id, mensajes); },
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
