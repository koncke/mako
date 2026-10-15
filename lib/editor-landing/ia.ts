// =============================================================================
// editor-landing/ia — MaKo en el editor de landings (lo que habla con la IA)
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D5).
//
// Seis operaciones, una por `accion` de PedidoIA (lib/editor-landing/api-tipos.ts):
//   esquema   → el plan de secciones (Generar · Pegar texto · Importar), rápido;
//   secciones → el copy y el diseño de hasta 3 secciones del esquema por pedido;
//   editar    → «Edición con IA» sobre la landing o una sección (respeta «Bloquear»);
//   texto     → las acciones de la barra (Mejorar, Corregir, Acortar, Traducir…);
//   disenos   → «Probar nuevo diseño»: hasta 3 alternativas que conservan el texto;
//   notas     → las notas del orador de una sección.
//
// Cómo se llama a la IA (D5, y las reglas de la casa que lo gobiernan):
//   · `chatClaude(system, [{role:'user', content}], { feature, motivo, maxTokens })`
//     con las features `landing-editor` / `landing-editor-ia`: default GEMINI y
//     respeta /modelos-ia. Claude está vetado (sin fila en CLAUDE_PERMITIDO).
//   · cada pedido va acotado con `hastaMs`: si el plazo no alcanza, falla — nunca
//     paga para ganar tiempo (lib/anthropic.ts);
//   · el JSON pasa por `parseJsonObject` y, si no alcanza, UNA reparación por la
//     cascada barata (`objetoConUnaReparacion`, ia-reglas.ts). Nunca más;
//   · los errores van por `errorDeCascada`: el único mensaje que distingue «no hay
//     IA» de «hay IA y falló» (lib/ia-mensajes.ts).
//
// La IA no escribe JSON de ProseMirror: escribe la gramática de ia-bloques.ts
// (paquete C) y el código la convierte. Lo puro de este archivo (prompts, cortes,
// tandas, validación de la salida, la regla de una reparación) vive en
// ia-reglas.ts, que se puede testear.
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { chatCheapCascade, errorDeCascada } from '../ai-cheap';
import { renderPrompt, contenidoNoConfiable } from '../prompt-render';
import { brandSystem, buildLandingBrief, diagnosticoDe } from '../landing-writer';
import { extraerLanding } from '../landing-fetch';
import { parseJsonObject } from '../json-del-modelo';
import { buscarYCopiar } from '../imagenes-stock';
import { getWorkspaceActual } from '../workspace';
import {
  GRAMATICA_IA, bloquesATarjeta, tarjetaABloques, comoTarjetasIA, recolectarBusquedas, aplicarImagenes,
  idTarjetaConFormulario, type TarjetaIA,
} from './ia-bloques';
import {
  PROMPTS_EDITOR, FORMATO_ESQUEMA, FORMATO_SECCIONES, FORMATO_EDITAR, FORMATO_DISENOS, SYSTEM_REPARAR_JSON,
  MAX_TEXTO_ENTRADA, MAX_INSTRUCCIONES,
  normalizarParams, bloqueIdioma, bloqueIdiomaDelTexto, lineaVerbosidad, lineaModoTexto, ajustesAutoritativos,
  cortarPegado, esquemaConservado, textoConTrozos, sanearEsquema, esquemaDelPedido,
  indicesValidos, pedidoDeTanda, ordenarPorIndice, tarjetaDesdeEsquema, bajarTitulo,
  sinStockEnPersonas, resolverBusquedas, sanearNodo, quitarPruebaInventada,
  seccionesParaEditar, emparejarEdicion, convertirEdicion, attrsDe,
  prepararAlternativa, elegirAlternativas,
  instruccionTexto, accionTextoValida, limpiarTextoDelModelo, limpiarNotas,
  objetoConUnaReparacion, SalidaInvalida, REGLAS_PAGINA,
} from './ia-reglas';
import { NODO, TOPES, textoDe, type JsonNodo } from './doc';
import type { Esquema, ParamsGeneracion, FuenteImagenes, AccionTexto } from './api-tipos';
import { fallaEnNavegador, motivoDeError, motivoDePagina, sanearLectura } from './lectura-reglas';
import type { MotivoEnNavegador, SeLeeEnNavegador } from './lectura-tipos';
import { REGLAS_DIAPOSITIVAS_ESQUEMA, REGLAS_DIAPOSITIVAS_SECCIONES, REGLAS_DIAPOSITIVAS_EDITAR } from './plantillas-presentaciones';

/**
 * T3 (tanda 2): ¿el pedido es para una PRESENTACIÓN? Se lee del pedido CRUDO porque
 * `normalizarParams` (ia-reglas.ts) arma los parámetros campo por campo y no conoce `formato`.
 * Con diapositivas, las reglas de `REGLAS_DIAPOSITIVAS_*` (plantillas-presentaciones.ts: una idea
 * por diapositiva, poco texto, diseños optimizados) se agregan a los slots que ya existen
 * (`{{ajustes}}`, «mandan»; `{{alcance}}` al editar): los prompts editables no cambian.
 */
const esDiapositivas = (params: unknown): boolean =>
  !!params && typeof params === 'object' && (params as { formato?: unknown }).formato === 'presentacion';

/** Esquema, secciones e importar (lo que crea una landing). */
export const FEATURE_GENERAR = 'landing-editor';
/** Editar, texto, diseños y notas (lo que trabaja sobre una que ya existe). */
export const FEATURE_EDITAR = 'landing-editor-ia';

/**
 * El resultado de cada operación: el `ok: true` de RespuestaIA o la falla con su
 * mensaje. `status` lo usa SOLO la ruta para el código HTTP (400 = el pedido vino
 * mal, 422 = la página no se puede leer desde el server, 502 = la IA no pudo) y no
 * viaja en el cuerpo: el contrato es `Falla` (o `FallaEnNavegador`, con
 * `pegable`/`enNavegador`/`motivo`, tanda 6).
 */
export type ResultadoIA<T> = ({ ok: true } & T) | ({ ok: false; error: string; status: 400 | 422 | 502 } & Partial<SeLeeEnNavegador>);

/** El pedido vino mal: no se llamó a ninguna IA. */
const invalido = (error: string) => ({ ok: false as const, error, status: 400 as const });
/** La IA contestó pero no dejó nada usable. */
const sinResultado = (error: string) => ({ ok: false as const, error, status: 502 as const });
/** La página no se lee desde el server y en el navegador de la persona sí (tanda 6, lectura-tipos.ts). */
const enNavegador = (motivo: MotivoEnNavegador) => ({ ...fallaEnNavegador(motivo), status: 422 as const });

/**
 * Cuánto puede tardar cada pedido. Las secciones tienen que entrar en menos de 60 s
 * (D5: la pantalla las va revelando de a tres); lo demás, dentro de los 300 s de la
 * ruta con aire. La IA corre hasta `ia`; las fotos, hasta `total`.
 */
const PLAZOS = {
  esquema: { ia: 50_000 },
  secciones: { ia: 42_000, total: 57_000 },
  editar: { ia: 150_000, total: 200_000 },
  texto: { ia: 40_000 },
  disenos: { ia: 60_000 },
  notas: { ia: 30_000 },
} as const;

/** El tope de lo que se le manda a «Edición con IA» de una vez. */
const MAX_JSON_EDICION = 90_000;

// ─────────────────────────────────────────────────────────────────────────────
// Piezas comunes
// ─────────────────────────────────────────────────────────────────────────────

/** El paso de reparación: UN pedido a la cascada barata que copia la salida como JSON válido. */
function reparador(feature: string, motivo: string, hastaMs: number) {
  return async (crudo: string): Promise<string> => {
    const errores: string[] = [];
    return chatCheapCascade({
      system: SYSTEM_REPARAR_JSON,
      user: crudo,
      json: true,
      maxTokens: 8000,
      temperature: 0,
      feature,
      motivo: `reparar el JSON (${motivo})`,
      erroresOut: errores,
      // Si el plazo de la IA ya se fue, igual se le dan unos segundos: reparar es barato
      // y es la diferencia entre devolver lo que se escribió y tirarlo.
      hastaMs: Math.max(hastaMs, Date.now() + 10_000),
      validar: (t: string) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch(() => '');
  };
}

/**
 * El mensaje de una falla, para la persona. Lo técnico va al log.
 *
 * ⚠️ «Claude vetado» no es una causa que le sirva a nadie: con estas features en
 * Gemini y sin fila en CLAUDE_PERMITIDO, ese error significa que la cascada gratis
 * ENTERA no contestó y `chatClaude` intentó el último recurso, que el veto cortó.
 * `chatClaude` no expone los errores de la cascada, así que se le pasa la lista
 * vacía a `errorDeCascada`: dice «no hay IA conectada» o «está conectada pero no
 * pudo», que es lo cierto, sin inventar una causa.
 */
async function falloIA(e: unknown, tema: string): Promise<string> {
  if (e instanceof SalidaInvalida) {
    console.error(`[landing-editor] ${tema}: ${e.message}`);
    console.error(`[landing-editor] salida cruda (2000): ${e.crudo.slice(0, 2000)}`);
    return 'MaKo respondió pero no se pudo leer. Vuelve a intentar.';
  }
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[landing-editor] ${tema}: ${msg}`);
  return errorDeCascada(/Claude vetado/i.test(msg) ? [] : [msg], tema);
}

/** El onboarding de la tab se completa usándola (TAB_ONBOARDINGS): accesorio al resultado. */
async function marcarGenerar(): Promise<void> {
  try {
    const { marcarPasoTab } = await import('../tab-onboarding-state');
    await marcarPasoTab('landing-writer', 'generar');
  } catch { /* accesorio */ }
}

/** El system de cada operación: la voz de MaKo + la plantilla editable ya renderizada. */
async function system(p: { key: string; tpl: string }, vars: Record<string, string>): Promise<string> {
  return brandSystem(await renderPrompt(p.key, p.tpl, vars));
}

/**
 * Resuelve las fotos de stock de un lote de secciones de la gramática. Con
 * «Fotos de stock», cada búsqueda va a `buscarYCopiar` (D6: la copia al bucket
 * propio; la IA nunca pone una URL) de a dos en paralelo y hasta el plazo; lo que
 * no llegó o no se encontró queda SIN imagen. Con «Marcadores» no se busca nada y
 * queda el hueco para elegir; con «Sin imágenes», todo sin imagen.
 *
 * Antes de buscar, el equipo, las caras de los testimonios y los logos pierden su
 * búsqueda (`sinStockEnPersonas`): una foto de stock ahí miente.
 */
async function conImagenes(ts: TarjetaIA[], fuente: FuenteImagenes, hastaMs: number): Promise<TarjetaIA[]> {
  const limpias = ts.map((t) => sinStockEnPersonas(t));
  if (fuente === 'marcadores') return limpias;
  if (fuente === 'ninguna') return aplicarImagenes(limpias, new Map(), { siFalta: 'quitar' });
  const busquedas = recolectarBusquedas(limpias);
  const mapa = new Map<string, string>();
  // La copia va a `<ws>/…` del bucket: el workspace sale de la sesión, como en toda la app.
  // Sin workspace no se busca nada (y nunca se cae al dueño): las secciones quedan sin foto.
  const ws = busquedas.length ? await getWorkspaceActual().catch(() => null) : null;
  if (ws != null && busquedas.length && hastaMs - Date.now() > 3_000) {
    const espera = new Promise<void>((r) => setTimeout(r, Math.max(0, hastaMs - Date.now())));
    await Promise.race([
      resolverBusquedas(busquedas, (q) => buscarYCopiar(q, ws), { limite: 2, hastaMs, mapa }),
      espera,
    ]).catch(() => { /* lo que no llegó queda sin imagen */ });
  }
  return aplicarImagenes(limpias, mapa, { siFalta: 'quitar' });
}

/** Una tarjeta del documento que llega del navegador, con lo mínimo para operar sobre ella. */
function esTarjeta(n: unknown): n is JsonNodo {
  if (!n || typeof n !== 'object') return false;
  const t = n as JsonNodo;
  return t.type === NODO.tarjeta && typeof t.attrs?.id === 'string' && !!t.attrs.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// esquema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `lectura` (tanda 6, sólo en «importar»): la página ya LEÍDA en el navegador de la persona (el lector
 * del Diagnóstico, lectura-tipos.ts). Con ella no se baja nada: es la salida para la página que se arma
 * con JavaScript o que no deja leerse a nuestro servidor. Llega del navegador sin forma confiable: la
 * sanea `sanearLectura`.
 */
export type PedidoEsquema = { modo: 'generar' | 'pegar' | 'importar'; prompt?: string; texto?: string; url?: string; lectura?: unknown; params?: Partial<ParamsGeneracion> };

/**
 * El esquema de la landing. Tres puertas, como la pantalla de crear de Gamma:
 *   · Generar: desde un pedido escrito;
 *   · Pegar texto: los `---` cortan secciones, y el modo de texto decide qué se
 *     hace con lo que pegó (Generar · Condensar · Conservar);
 *   · Importar: la URL de una landing (lo que la persona ya tiene) por el mismo
 *     extractor que usa el Landing Analyst, con su guarda anti-SSRF; o, si esa
 *     página no se lee desde el server, su `lectura` hecha en el navegador.
 * «Conservar» NO pasa por la IA: el texto de la persona es el esquema.
 */
export async function esquema(p: PedidoEsquema): Promise<ResultadoIA<{ esquema: Esquema }>> {
  const t0 = Date.now();
  const params = normalizarParams(p.params);
  const diapos = esDiapositivas(p.params);
  let texto = '';
  let pedido = '';
  let tituloFallback = diapos ? 'Presentación' : 'Landing';

  if (p.modo === 'generar') {
    pedido = String(p.prompt ?? '').trim().slice(0, 8_000);
    if (!pedido) return invalido(diapos ? 'Escribe qué presentación quieres.' : 'Escribe qué landing quieres.');
  } else if (p.modo === 'pegar') {
    texto = String(p.texto ?? '').slice(0, MAX_TEXTO_ENTRADA).trim();
    if (!texto) return invalido('Pega el texto primero.');
  } else if (p.modo === 'importar') {
    // Tanda 6. Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude
    // leer el texto de esa página". Soluciona eso...». Ese texto era TODO lo que se contestaba cuando
    // la página no traía texto en el HTML (una app de React/Vite/Lovable: `<div id="root"></div>` y
    // scripts) o nos rechazaba (403 de un antibots): un callejón. Ahora la respuesta dice POR QUÉ y que
    // en el navegador de la persona sí se lee (`enNavegador`, lectura-tipos.ts): la pantalla ofrece el
    // lector o pegar el texto, y la lectura vuelve por acá en `lectura`.
    const lectura = p.lectura === undefined || p.lectura === null ? null : sanearLectura(p.lectura);
    if (p.lectura !== undefined && p.lectura !== null && !lectura) return invalido('La lectura de la página llegó vacía.');
    if (lectura) {
      texto = lectura.texto.slice(0, MAX_TEXTO_ENTRADA);
      if (!texto.trim()) return invalido('Tu navegador no encontró texto en esa página. Pega el texto.');
    } else {
      const url = String(p.url ?? '').trim();
      if (!url) return invalido('Falta el enlace.');
      try {
        // TAL CUAL la pegó la persona: `claveDeLanding` le saca el www y el querystring (es la LLAVE de
        // landing_analyses, no una dirección para bajar), y hay hosts que sólo existen con www.
        const pagina = await extraerLanding(url, { talCual: true });
        const motivo = motivoDePagina(pagina);
        if (motivo) return enNavegador(motivo);
        texto = pagina.texto.slice(0, MAX_TEXTO_ENTRADA);
        tituloFallback = pagina.titulo || tituloFallback;
      } catch (e) {
        const motivo = motivoDeError(e);
        if (motivo) return enNavegador(motivo);
        // El extractor ya escribe el motivo para una persona («La página respondió 404…»).
        return { ok: false, error: e instanceof Error ? e.message : 'No pude abrir esa página.', status: 502 };
      }
    }
  } else {
    return invalido('Modo desconocido.');
  }

  // «Conservar»: el texto de la persona ES el esquema, palabra por palabra.
  if (p.modo !== 'generar' && params.modoTexto === 'conservar') {
    const e = esquemaConservado(texto, tituloFallback);
    if (!e.secciones.length) return invalido('No encontré secciones en el texto.');
    await marcarGenerar();
    return { ok: true, esquema: e };
  }

  const trozos = p.modo === 'generar' ? [] : cortarPegado(texto);
  const exactas = trozos.length > 1 ? esquemaConservado(trozos.join('\n---\n'), tituloFallback) : undefined;
  const cantidad = exactas ? exactas.secciones.length : params.cantidad;

  // Lo importado (bajado o leído en el navegador) es la página de un TERCERO, no algo que escribió la
  // persona: va con su propia etiqueta, igual de no confiable.
  const contenido = p.modo === 'generar'
    ? contenidoNoConfiable(pedido, 'pedido')
    : contenidoNoConfiable(trozos.length > 1 ? textoConTrozos(trozos) : texto, p.modo === 'importar' ? 'pagina_importada' : 'texto_de_la_persona');
  const instrucciones = [
    params.instrucciones ? contenidoNoConfiable(params.instrucciones.slice(0, MAX_INSTRUCCIONES), 'instrucciones') : '',
    p.modo !== 'generar' ? lineaModoTexto(params.modoTexto) : '',
    trozos.length > 1 ? `El texto viene partido por la persona en ${trozos.length} TROZOS: una sección por trozo, en el mismo orden.` : '',
  ].filter(Boolean).join('\n') || '(ninguna)';

  try {
    const [contexto, diagnostico] = await Promise.all([
      buildLandingBrief(pedido || texto.slice(0, 600)),
      diagnosticoDe(params.basadoEnUrl),
    ]);
    const sys = await system(PROMPTS_EDITOR.esquemaSystem, { idioma: bloqueIdioma(params.idioma), formato: FORMATO_ESQUEMA });
    const user = await renderPrompt(PROMPTS_EDITOR.esquemaUser.key, PROMPTS_EDITOR.esquemaUser.tpl, {
      ajustes: ajustesAutoritativos(params, cantidad) + `\n${diapos ? REGLAS_DIAPOSITIVAS_ESQUEMA : REGLAS_PAGINA}`,
      contenido,
      instrucciones,
      contexto,
      diagnostico,
    });
    const hastaMs = t0 + PLAZOS.esquema.ia;
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_GENERAR,
      motivo: `Esquema de ${diapos ? 'presentación' : 'landing'}${p.modo === 'importar' ? (p.lectura ? ' (leída en el navegador)' : ' (importada)') : p.modo === 'pegar' ? ' (texto pegado)' : ''}`,
      maxTokens: 4_000,
      effort: 'medium',
      hastaMs,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(FEATURE_GENERAR, 'esquema', hastaMs));
    const e = sanearEsquema(raw, { exactas, tituloFallback });
    if (!e.secciones.length) return sinResultado('MaKo no armó ninguna sección. Vuelve a intentar.');
    await marcarGenerar();
    return { ok: true, esquema: e };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'armar el esquema'), status: 502 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// secciones
// ─────────────────────────────────────────────────────────────────────────────

export type PedidoSecciones = { esquema: unknown; indices: unknown; params?: Partial<ParamsGeneracion>; temaId?: string };

/**
 * Hasta 3 secciones del esquema (la pantalla las pide en tandas con `tandasDe`).
 *
 * CONTRATO con la pantalla: `tarjetas` trae UNA tarjeta por índice pedido, en el
 * orden de los índices ya ordenados de menor a mayor. Si el modelo se olvidó de
 * una, esa sale armada desde el esquema (`tarjetaDesdeEsquema`) y el `resumen` lo
 * dice: nunca una tanda con secciones de menos, que dejaría a la pantalla sin
 * saber cuál faltó.
 *
 * `temaId` viaja en el pedido por contrato y hoy no cambia nada: la gramática no
 * tiene nada que dependa del tema (los colores los pone el tema al dibujar).
 */
export async function secciones(p: PedidoSecciones): Promise<ResultadoIA<{ tarjetas: JsonNodo[]; resumen?: string }>> {
  const t0 = Date.now();
  const esq = esquemaDelPedido(p.esquema);
  if (!esq) return invalido('Falta el esquema.');
  const v = indicesValidos(p.indices, esq.secciones.length);
  if (!v.ok) return invalido(v.error);
  const indices = v.indices;
  const params = normalizarParams(p.params);
  const diapos = esDiapositivas(p.params);

  // En «Conservar» un punto es un párrafo entero de la persona (hasta el tope de un nodo):
  // tres secciones así pueden no entrar en un pedido, y la salida tiene que copiarlas enteras.
  const tanda = pedidoDeTanda(esq, indices);
  if (tanda.pedidas.length > MAX_TEXTO_ENTRADA) return invalido('Esas secciones tienen demasiado texto. Divídelas.');

  try {
    const material = [esq.titulo, ...indices.flatMap((i) => [esq.secciones[i].titulo, ...esq.secciones[i].puntos])].join('\n');
    const contexto = await buildLandingBrief(material.slice(0, 600));
    const sys = await system(PROMPTS_EDITOR.seccionesSystem, {
      gramatica: GRAMATICA_IA,
      texto: lineaVerbosidad(params.textoPorSeccion),
      modoTexto: lineaModoTexto(params.modoTexto),
      idioma: bloqueIdioma(params.idioma),
      formato: FORMATO_SECCIONES,
    });
    const user = await renderPrompt(PROMPTS_EDITOR.seccionesUser.key, PROMPTS_EDITOR.seccionesUser.tpl, {
      ajustes: ajustesAutoritativos(params, esq.secciones.length) + `\n${diapos ? REGLAS_DIAPOSITIVAS_SECCIONES : REGLAS_PAGINA}`,
      esquema: contenidoNoConfiable(tanda.esquema, 'esquema'),
      pedidas: contenidoNoConfiable(tanda.pedidas, 'secciones_pedidas'),
      instrucciones: params.instrucciones ? contenidoNoConfiable(params.instrucciones, 'instrucciones') : '(ninguna)',
      contexto,
    });
    const hastaIA = t0 + PLAZOS.secciones.ia;
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_GENERAR,
      motivo: `${diapos ? 'Diapositivas' : 'Secciones'} ${indices.map((i) => i + 1).join(', ')} de «${esq.titulo.slice(0, 60)}»`,
      // Una sección con un diseño optimizado de seis ítems ronda los 1.500 tokens; con texto
      // conservado, la salida copia lo pedido entero (~4 caracteres por token, más la gramática).
      maxTokens: Math.min(16_000, Math.max(2_200 * indices.length + 800, Math.ceil(tanda.pedidas.length / 2.5))),
      effort: 'medium',
      hastaMs: hastaIA,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(FEATURE_GENERAR, 'secciones', hastaIA));
    const orden = ordenarPorIndice(comoTarjetasIA(raw), indices);
    const resueltas = await conImagenes(orden.secciones.map((s) => s.tarjeta), params.fuenteImagenes, t0 + PLAZOS.secciones.total);
    const porIndice = new Map(orden.secciones.map((s, k) => [s.indice, resueltas[k]]));

    const descartes: string[] = [];
    const fuente = [material, contexto, params.instrucciones].join('\n');
    let quitados = 0;
    const tarjetas = indices.map((i) => {
      const t = porIndice.get(i);
      let n = t ? sanearNodo(bloquesATarjeta(t, { descartes })) : null;
      if (!n?.content?.length) n = tarjetaDesdeEsquema(esq.secciones[i], i === 0);
      if (i !== 0) n = bajarTitulo(n);
      const prueba = quitarPruebaInventada(n, fuente);
      quitados += prueba.quitados;
      return prueba.tarjeta;
    });
    if (descartes.length) console.warn(`[landing-editor:secciones] descartes: ${descartes.slice(0, 20).join(' · ')}`);
    if (quitados) console.warn(`[landing-editor:secciones] ${quitados} citas o cifras sin respaldo, vaciadas`);
    await marcarGenerar();
    const faltan = orden.faltan.length;
    return { ok: true, tarjetas, ...(faltan ? { resumen: faltan === 1 ? 'Una sección quedó con el esquema.' : `${faltan} secciones quedaron con el esquema.` } : {}) };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'generar las secciones'), status: 502 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// editar
// ─────────────────────────────────────────────────────────────────────────────

export type PedidoEditar = { instruccion: string; tarjetas: unknown; alcance: 'landing' | 'seccion'; params?: Partial<ParamsGeneracion> };

/**
 * «Edición con IA». Devuelve SOLO las secciones que cambian: las que ya existían
 * con su id de siempre (la pantalla las reemplaza con `reemplazarTarjetas`, en una
 * transacción deshacible) y las nuevas con un id que no es de ninguna mandada (la
 * pantalla las inserta: son las que no encuentra en el documento). Las secciones
 * con «Bloquear» (`bloqueadaIA`) viajan al modelo solo con su título y lo que
 * vuelva con su id se descarta. `resumen` es una frase para el chat del agente.
 */
export async function editar(p: PedidoEditar): Promise<ResultadoIA<{ tarjetas: JsonNodo[]; resumen?: string }>> {
  const t0 = Date.now();
  const instruccion = String(p.instruccion ?? '').trim().slice(0, 4_000);
  if (!instruccion) return invalido('Escribe qué quieres cambiar.');
  const originales = (Array.isArray(p.tarjetas) ? p.tarjetas : []).filter(esTarjeta).slice(0, TOPES.tarjetasPorPagina);
  if (!originales.length) return invalido('Faltan las secciones.');
  if (originales.every((t) => attrsDe(t).bloqueadaIA === true)) {
    return invalido(originales.length === 1 ? 'Esa sección está bloqueada.' : 'Todas las secciones están bloqueadas.');
  }
  const params = normalizarParams(p.params);
  const formularioId = idTarjetaConFormulario(originales);
  const vista = seccionesParaEditar(originales, (t) => tarjetaABloques(t, { formularioId }));
  const json = JSON.stringify({ tarjetas: vista }, null, 1);
  if (json.length > MAX_JSON_EDICION) return invalido('Es mucho de una vez. Edita por sección.');

  try {
    const contexto = await buildLandingBrief(instruccion);
    const sys = await system(PROMPTS_EDITOR.editarSystem, { gramatica: GRAMATICA_IA, idioma: bloqueIdioma(params.idioma), formato: FORMATO_EDITAR });
    const user = await renderPrompt(PROMPTS_EDITOR.editarUser.key, PROMPTS_EDITOR.editarUser.tpl, {
      instruccion: contenidoNoConfiable(instruccion, 'instruccion'),
      alcance: (p.alcance === 'seccion' ? 'una sección: cambia solo esa' : 'toda la landing: cambia solo las secciones que la instrucción toca')
        + `\n${esDiapositivas(p.params) ? REGLAS_DIAPOSITIVAS_EDITAR : REGLAS_PAGINA}`,
      secciones: contenidoNoConfiable(json, 'secciones'),
      contexto,
    });
    const hastaIA = t0 + PLAZOS.editar.ia;
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_EDITAR,
      motivo: `Edición con IA (${p.alcance === 'seccion' ? 'sección' : 'landing'})`,
      maxTokens: Math.min(16_000, 2_000 + Math.ceil(json.length / 3)),
      effort: 'high',
      hastaMs: hastaIA,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(FEATURE_EDITAR, 'edición', hastaIA));
    const { pares, descartes } = emparejarEdicion(comoTarjetasIA(raw), originales);
    const conFotos = await conImagenes(pares.map((x) => x.tarjeta), params.fuenteImagenes, t0 + PLAZOS.editar.total);
    const resultado = convertirEdicion(
      pares.map((x, k) => ({ tarjeta: conFotos[k], base: x.base })),
      originales,
      (t, base) => bloquesATarjeta(t, { base, descartes, formularioId }),
      descartes,
    );
    const fuente = [originales.map((t) => textoDe(t)).join('\n'), instruccion, contexto].join('\n');
    let quitados = 0;
    const tarjetas = resultado.tarjetas.map((t) => {
      const r = quitarPruebaInventada(t, fuente);
      quitados += r.quitados;
      return r.tarjeta;
    });
    if (descartes.length) console.warn(`[landing-editor:editar] descartes: ${descartes.slice(0, 20).join(' · ')}`);
    if (quitados) console.warn(`[landing-editor:editar] ${quitados} citas o cifras sin respaldo, vaciadas`);
    const resumenModelo = typeof raw.resumen === 'string' ? raw.resumen.trim().split('\n')[0].slice(0, 200) : '';
    return { ok: true, tarjetas, resumen: tarjetas.length ? resumenModelo || 'Listo.' : 'Sin cambios.' };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'editar la landing'), status: 502 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// texto
// ─────────────────────────────────────────────────────────────────────────────

export type PedidoTexto = { tipo: AccionTexto; texto: string; contexto?: string; tono?: string; idioma?: string };

/**
 * Una acción de texto sobre una selección. Devuelve SOLO el texto nuevo (con su
 * markdown en línea: la pantalla lo vuelve a marcas); en «Continuar» es solo lo
 * que sigue, para agregarlo después de la selección.
 */
export async function texto(p: PedidoTexto): Promise<ResultadoIA<{ texto: string }>> {
  const t0 = Date.now();
  if (!accionTextoValida(p.tipo)) return invalido('Acción desconocida.');
  const original = String(p.texto ?? '').trim().slice(0, 8_000);
  if (!original) return invalido('Selecciona un texto.');
  try {
    const sys = await system(PROMPTS_EDITOR.textoSystem, {
      accion: instruccionTexto(p.tipo, { tono: p.tono, idioma: p.idioma }),
      idioma: p.tipo === 'traducir' ? bloqueIdioma(String(p.idioma ?? '').trim() || 'inglés') : bloqueIdiomaDelTexto(),
    });
    const ctx = String(p.contexto ?? '').trim().slice(0, 4_000);
    const user = await renderPrompt(PROMPTS_EDITOR.textoUser.key, PROMPTS_EDITOR.textoUser.tpl, {
      texto: contenidoNoConfiable(original, 'texto'),
      contexto: ctx ? `CONTEXTO (la sección donde está el texto):\n${contenidoNoConfiable(ctx, 'contexto')}\n` : '',
    });
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_EDITAR,
      motivo: `Texto: ${p.tipo}`,
      maxTokens: Math.min(4_000, Math.max(600, Math.ceil(original.length / 2))),
      thinking: false,
      hastaMs: t0 + PLAZOS.texto.ia,
    });
    const nuevo = limpiarTextoDelModelo(salida).slice(0, TOPES.caracteresTexto);
    if (!nuevo) return sinResultado('MaKo no devolvió texto. Vuelve a intentar.');
    return { ok: true, texto: nuevo };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'reescribir el texto'), status: 502 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// disenos («Probar nuevo diseño»)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El formato de la landing en «Probar nuevo diseño» (tanda 6; pendiente de la tanda 2: «"Probar nuevo
 * diseño" no recibe el formato»). Sin él, en una PRESENTACIÓN proponía secciones de página que no
 * entran en la diapositiva. Va al slot `{{formato}}` detrás de FORMATO_DISENOS (es el único slot que
 * tiene disenosSystem): el prompt editable no cambia.
 *
 * ⚠️ NO SON `REGLAS_DIAPOSITIVAS_EDITAR` NI `REGLAS_PAGINA` (las de editar), A PROPÓSITO: las dos piden
 *    algo que acá contradice el pedido. «Si no entra, pártelo en dos», cuando cada tarjeta devuelta es
 *    UNA alternativa (partida, cada mitad pierde texto y `conservaElTexto` las descarta); y «cada una
 *    lleva el copy que una página necesita para convencer», cuando acá el texto se conserva palabra por
 *    palabra. Es la regla de GRAMATICA_IA: el formato de un pedido no contradice al system.
 */
const REGLAS_DISENOS = {
  diapositiva: 'Es una PRESENTACIÓN: la sección es UNA diapositiva de tamaño fijo, con una sola idea. Cada alternativa tiene que entrar ENTERA en la diapositiva (estructuras compactas: columnas, un diseño optimizado, cajas), nunca algo que se lea con scroll. No la partas en dos: cada tarjeta que devuelves es una alternativa completa.',
  pagina: 'Es una LANDING, una página que se lee de corrido con scroll; NO es una presentación: ninguna alternativa se arma ni se nombra como diapositiva.',
} as const;

/**
 * Hasta 3 alternativas de UNA sección que dicen lo mismo con otra forma. Cada una
 * sale con el id de la original (la reemplaza al elegirla), conserva su imagen y
 * sus notas, y pasa el chequeo de que el texto se conservó (`conservaElTexto`).
 * `params.formato` decide si las alternativas son diapositivas o secciones de página.
 */
export async function disenos(p: { tarjeta: unknown; params?: Partial<ParamsGeneracion> }): Promise<ResultadoIA<{ opciones: JsonNodo[] }>> {
  const t0 = Date.now();
  if (!esTarjeta(p.tarjeta)) return invalido('Falta la sección.');
  const original = p.tarjeta;
  if (attrsDe(original).bloqueadaIA === true) return invalido('Esa sección está bloqueada.');
  const formularioId = idTarjetaConFormulario([original]);
  const vista = tarjetaABloques(original, { formularioId });
  const formato = `${FORMATO_DISENOS}\n${esDiapositivas(p.params) ? REGLAS_DISENOS.diapositiva : REGLAS_DISENOS.pagina}`;
  try {
    const sys = await system(PROMPTS_EDITOR.disenosSystem, { gramatica: GRAMATICA_IA, formato });
    const user = await renderPrompt(PROMPTS_EDITOR.disenosUser.key, PROMPTS_EDITOR.disenosUser.tpl, {
      seccion: contenidoNoConfiable(JSON.stringify(vista, null, 1), 'seccion'),
    });
    const hastaIA = t0 + PLAZOS.disenos.ia;
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_EDITAR,
      motivo: 'Probar nuevo diseño',
      maxTokens: 7_000,
      effort: 'medium',
      hastaMs: hastaIA,
    });
    const raw = await objetoConUnaReparacion(salida, reparador(FEATURE_EDITAR, 'diseños', hastaIA));
    const descartes: string[] = [];
    const opciones = elegirAlternativas(
      comoTarjetasIA(raw).map((t) => prepararAlternativa(t, original)),
      original,
      (t) => bloquesATarjeta(t, { base: original, descartes, formularioId }),
      descartes,
    );
    if (descartes.length) console.warn(`[landing-editor:disenos] descartes: ${descartes.slice(0, 20).join(' · ')}`);
    if (!opciones.length) return sinResultado('No salió un diseño distinto. Vuelve a intentar.');
    return { ok: true, opciones };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'proponer otros diseños'), status: 502 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notas del orador
// ─────────────────────────────────────────────────────────────────────────────

export async function notas(p: { tarjeta: unknown }): Promise<ResultadoIA<{ notas: string }>> {
  const t0 = Date.now();
  if (!esTarjeta(p.tarjeta)) return invalido('Falta la sección.');
  const contenido = textoDe(p.tarjeta).trim().slice(0, 8_000);
  if (!contenido) return invalido('La sección no tiene texto.');
  try {
    const sys = await system(PROMPTS_EDITOR.notasSystem, { idioma: bloqueIdiomaDelTexto() });
    const user = await renderPrompt(PROMPTS_EDITOR.notasUser.key, PROMPTS_EDITOR.notasUser.tpl, {
      seccion: contenidoNoConfiable(contenido, 'seccion'),
    });
    const salida = await chatClaude(sys, [{ role: 'user', content: user }], {
      feature: FEATURE_EDITAR,
      motivo: 'Notas del orador',
      maxTokens: 900,
      thinking: false,
      hastaMs: t0 + PLAZOS.notas.ia,
    });
    const n = limpiarNotas(salida);
    if (!n) return sinResultado('MaKo no devolvió notas. Vuelve a intentar.');
    return { ok: true, notas: n };
  } catch (err) {
    return { ok: false, error: await falloIA(err, 'escribir las notas'), status: 502 };
  }
}
