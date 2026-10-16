// =============================================================================
// /offer — las ayudas PURAS de la pantalla (sin React, sin fetch)
// =============================================================================
// Viven aparte para que un test las pueda importar sin montar nada, y para que
// la pantalla no tenga dos lecturas de la misma pregunta: qué tono lleva una nota,
// si una opción es «Armar mi oferta», cuántas piezas se saben, qué sesión es más
// nueva. Todo lo que el marco define (piezas, dimensiones, la marca de «completar»)
// sale de lib/offer-marco.ts y no se copia aquí.

import { familiaDeArchivo } from '@/lib/formatos-archivo';
import {
  MARCA_COMPLETAR, PIEZAS, PUNTOS_CONTROL,
  type FuentePieza, type PuntoControl, type OfferMensaje, type OfferSesionResumen, type OfferSesionVista, type PiezaKey, type PiezasSabidas, type VariableValor,
} from '@/lib/offer-marco';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

// ── Las vistas ───────────────────────────────────────────────────────────────

export type VistaOffer = 'chat' | 'generando' | 'conclusion';

/**
 * Dónde abre una sesión. Una sesión concluida abre en su conclusión: es lo que
 * la persona vino a buscar. Se mira `conclusion` y no sólo `estado`, porque una
 * vista de conclusión sin conclusión sería una pantalla en blanco.
 */
export function vistaDeEntrada(s: OfferSesionVista | null): 'chat' | 'conclusion' {
  return s && s.estado === 'concluida' && s.conclusion ? 'conclusion' : 'chat';
}

// ── Las piezas ───────────────────────────────────────────────────────────────

export type EstadoPieza = 'vacia' | 'negocio' | 'confirmada';

/**
 * Tres estados y no dos: lo que MaKo ya sabía del negocio (el Archivero, la
 * oferta guardada) no es lo mismo que lo que el dueño confirmó en el chat o en un
 * documento. Lo primero se dibuja con borde dorado (lo trajo MaKo), lo segundo con
 * check verde (está confirmado).
 */
export function estadoDePieza(piezas: PiezasSabidas, k: PiezaKey): EstadoPieza {
  const p = piezas[k];
  if (!p || !p.valor?.trim()) return 'vacia';
  return p.fuente === 'negocio' ? 'negocio' : 'confirmada';
}

/** Cuántas de las 13 tienen algo. Es el número de arriba del riel («8/13»). */
export function contarSabidas(piezas: PiezasSabidas): number {
  return PIEZAS.filter((p) => estadoDePieza(piezas, p.key) !== 'vacia').length;
}

export const FUENTE_TITULO: Record<FuentePieza, string> = {
  negocio: 'Del negocio',
  chat: 'Del chat',
  doc: 'De un documento',
};

/**
 * El `title` de una pieza: de dónde salió y qué dice. Va en el title (no ocupa
 * lugar) y recortado: un valor largo en un tooltip tapa media pantalla.
 */
export function tituloDePieza(piezas: PiezasSabidas, k: PiezaKey): string | undefined {
  const p = piezas[k];
  if (!p || !p.valor?.trim()) return undefined;
  const v = p.valor.trim().replace(/\s+/g, ' ');
  return `${FUENTE_TITULO[p.fuente]} · ${v.length > 140 ? v.slice(0, 139) + '…' : v}`;
}

/**
 * Las piezas agrupadas por tema, para que 20 renglones se lean de un vistazo (Martín, 12/10/2026: «más
 * legible, más fácil»). Es SÓLO cómo se dibujan: el orden y la lista salen de PIEZAS (lib/offer-marco.ts),
 * y una pieza nueva que nadie agrupó cae en «Más» en vez de desaparecer (tests/offer-pulir-pdf.test.ts).
 * Vive aquí y no en PiezasRail.tsx ('use client', que lo re-exporta) porque «Tu oferta» del teléfono
 * (app/m/offer) agrupa con lo mismo (AGENTS.md, MaKo Mobile: lo que /m reusa no vive en un módulo de cliente).
 */
export const GRUPOS_PIEZAS: ReadonlyArray<{ titulo: string; keys: readonly PiezaKey[] }> = [
  { titulo: 'Para quién', keys: ['cliente', 'problema', 'resultado', 'objecion'] },
  { titulo: 'Cómo', keys: ['mecanismo', 'entregables', 'semana', 'formato'] },
  { titulo: 'Prueba', keys: ['ventas', 'prueba'] },
  { titulo: 'Precio', keys: ['precio', 'cobro', 'valor', 'costo'] },
  { titulo: 'Cierre', keys: ['garantia', 'bonos', 'urgencia', 'frase'] },
  { titulo: 'Tu negocio', keys: ['escalera', 'otras'] },
];

/** Los grupos con sus piezas, en el orden de GRUPOS_PIEZAS, más «Más» con lo que no esté agrupado. */
export function piezasAgrupadas<P extends { key: string }>(
  lista: readonly P[] = PIEZAS as unknown as readonly P[],
  gruposDef: ReadonlyArray<{ titulo: string; keys: readonly string[] }> = GRUPOS_PIEZAS,
): Array<{ titulo: string; piezas: P[] }> {
  const usadas = new Set<string>();
  const grupos = gruposDef.map((g) => {
    const piezas = lista.filter((p) => g.keys.includes(p.key));
    piezas.forEach((p) => usadas.add(p.key));
    return { titulo: g.titulo, piezas };
  }).filter((g) => g.piezas.length > 0);
  const resto = lista.filter((p) => !usadas.has(p.key));
  return resto.length ? [...grupos, { titulo: 'Más', piezas: resto }] : grupos;
}

// ── Las opciones de MaKo ─────────────────────────────────────────────────────

const normal = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * ¿Esta opción es «Armar mi oferta»? Igualdad EXACTA tras normalizar (tildes,
 * mayúsculas, signos), nunca «contiene armar y oferta»: una opción como «Todavía
 * no quiero armar la oferta» dispararía la generación, que es lo contrario.
 *
 * El texto canónico NO se escribe aquí: es `OPCION_ARMAR` de lib/offer-reglas.ts
 * (el motor lo pone en las opciones) y baja por props desde page.tsx. Importarlo
 * en el navegador arrastraría las reglas enteras del motor al bundle por un string.
 */
export function esOpcionArmar(op: string, opcionArmar: string): boolean {
  return !!opcionArmar && normal(op) === normal(opcionArmar);
}

/**
 * El rótulo del botón de armar cuando ya hay una versión (12/10/2026): volver a armar es sacar el PDF
 * pulido, no «armar» de cero. ⚠️ ES EL DEFAULT DE LA PANTALLA mientras el motor no tenga su constante:
 * page.tsx le pasa a OfferApp `opcionActualizar` y, el día que lib/offer-reglas.ts la exporte, la pasa de
 * ahí y este texto deja de usarse (una cosa, un lugar).
 */
export const ACTUALIZAR_PDF = 'Actualizar el PDF';

/** Lo que dice el botón de armar: sin versión, «Armar mi oferta»; con una, el de actualizar. */
export function etiquetaArmar(hayVersion: boolean, opcionArmar: string, opcionActualizar: string): string {
  return hayVersion && opcionActualizar.trim() ? opcionActualizar : opcionArmar;
}

// ── Las sesiones ─────────────────────────────────────────────────────────────

/** El renglón del selector que corresponde a una conversación abierta (./arbol.ts). */
export function resumenDe(s: OfferSesionVista): OfferSesionResumen {
  return { id: s.id, titulo: s.titulo, estado: s.estado, total: s.conclusion?.calculo.total ?? null, updatedAt: s.updatedAt };
}

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** La más reciente de una lista (no se confía en el orden con que llegó). */
export function masReciente(lista: OfferSesionResumen[]): OfferSesionResumen | null {
  let mejor: OfferSesionResumen | null = null;
  for (const s of lista) if (!mejor || ms(s.updatedAt) > ms(mejor.updatedAt)) mejor = s;
  return mejor;
}

/**
 * ¿La sesión que acaba de llegar reemplaza a la que hay? Un archivo se puede leer
 * MIENTRAS MaKo contesta un turno, y las dos respuestas traen la sesión entera: si
 * llega última la más vieja, pisaría los mensajes del turno. Gana la de
 * `updatedAt` más nuevo; con empate, la que llegó (es la última que escribió).
 */
export function reemplaza(actual: OfferSesionVista | null, nueva: OfferSesionVista): boolean {
  if (!actual || actual.id !== nueva.id) return true;
  return ms(nueva.updatedAt) >= ms(actual.updatedAt);
}

/**
 * «11 oct». Lo usa el renglón de una conversación en el selector (./arbol.ts): ese texto sólo se
 * DIBUJA con el menú abierto (un portal que no existe en el HTML del server), así que la zona
 * horaria del server no llega a pintarse y no hay hidratación que se desarme.
 */
export function fechaCorta(iso: string): string {
  const t = ms(iso);
  if (!t) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(t)).replace('.', '');
}

/**
 * «14:32», la hora de una burbuja (como la de ChatHilo). ⚠️ Depende de la zona horaria de quien la
 * calcula: la pantalla la pide sólo DESPUÉS de montar (ChatOffer, `montado`), o el HTML del server
 * diría otra hora que el navegador y la hidratación fallaría.
 */
export function horaDe(iso: string | null | undefined): string {
  const t = iso ? ms(iso) : 0;
  if (!t) return '';
  return new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ── La conversación ──────────────────────────────────────────────────────────

/**
 * Las palomitas de un mensaje del dueño: azules (leído) si MaKo ya contestó algo DESPUÉS, una
 * sola si todavía no. Es la misma lectura que hace WhatsApp, y sale del hilo, no de un estado.
 */
export function ticksDe(mensajes: readonly OfferMensaje[], i: number): 'read' | 'sent' {
  return mensajes.slice(i + 1).some((m) => m.de === 'mako') ? 'read' : 'sent';
}

/**
 * ¿El mensaje que se mandó YA quedó guardado? Para cuando el turno se cortó sin decir nada (un corte
 * de red, un 504): se relee la conversación y se busca un mensaje del dueño NUEVO (después de los
 * `antes` que había al mandar) que sea ése — el mismo texto, o una nota de voz si se mandó una. Si
 * está, devolver lo enviado al composer haría que se mande dos veces.
 */
export function quedoGuardado(mensajes: readonly OfferMensaje[], antes: number, enviado: { texto: string; audio: boolean }): boolean {
  const t = enviado.texto.trim();
  return mensajes.slice(Math.max(0, antes)).some((m) => m.de === 'yo' && (enviado.audio ? !!m.audio : m.texto.trim() === t));
}

/**
 * Desde qué paso se reintenta ARMAR la oferta cuando falló el de la oferta nueva ('generar'):
 *   · si al releer la conversación ya hay una conclusión MÁS NUEVA que la de antes de armar, el
 *     servidor terminó (se cortó la conexión, no el trabajo): 'listo', y se muestra;
 *   · si contestó 409, falta el diagnóstico (otra pestaña mandó un mensaje y lo vació, o ya lo
 *     consumió una generación): repetir 'generar' contestaría el mismo 409 en cada clic, así que se
 *     reintenta DESDE el diagnóstico;
 *   · si no, fue pasajero: se reintenta la oferta (el diagnóstico ya pagado no se rehace).
 * `versionAhora` null = no se pudo releer (se decide sólo por el status).
 */
export function pasoTrasFalloDeOferta(e: { status: number | undefined; versionAntes: number; versionAhora: number | null }): 'listo' | 'diagnostico' | 'oferta' {
  if (e.versionAhora != null && e.versionAhora > e.versionAntes) return 'listo';
  if (e.status === 409) return 'diagnostico';
  return 'oferta';
}

/** Lo que avisa 'guardar-oferta' cuando la oferta se escribió pero algo quedó a medias. */
export type AvisoGuardado = { texto: string; reintentable: boolean };

/**
 * ¿La conclusión se dibuja como «Guardada» (o el botón «Guardar en este funnel»)?
 *   · sin oferta guardada en su versión vigente (`ofertaId` null) → el botón;
 *   · con un aviso RECIÉN devuelto: si se arregla reintentando (`reintentable`: la liga al funnel falló),
 *     el botón, porque el aviso pide volver a tocarlo y el segundo toque liga (camino idempotente del
 *     servidor); si no se arregla reintentando (el funnel se borró o se archivó), «Guardada» con el aviso
 *     al lado — ofrecer el botón sería mandar a repetir algo que no se arregla repitiendo;
 *   · sin aviso (también después de RECARGAR, cuando el aviso ya no existe): lo dice `ligada` de la
 *     vista — false es «hay oferta, el funnel existe y la liga falta», y ahí va el botón.
 * Con «Guardada» en el lugar del botón no había nada que tocar y la oferta quedaba suelta para
 * siempre (revisión del 11/10).
 */
export function guardadaVisible(ofertaId: number | null, ligada: boolean | undefined, aviso: AvisoGuardado | null): boolean {
  if (ofertaId == null) return false;
  if (aviso && aviso.texto.trim()) return !aviso.reintentable;
  return ligada !== false;
}

/**
 * Qué dice la pantalla sin conversación abierta. «No pude leer» NO es «no hay»: con el árbol caído,
 * mandar a «crear un funnel» a un negocio que tiene tres es el mensaje falso que esta casa no deja
 * dibujar. Sin leer, se dice que no cargó y se ofrece volver a cargar.
 */
export function bienvenidaDe(arbolLeido: boolean, vacio: boolean): 'no-cargo' | 'sin-funnels' | 'elegir' {
  if (!arbolLeido) return 'no-cargo';
  return vacio ? 'sin-funnels' : 'elegir';
}

/** El tope de un mensaje del dueño: el mismo que acepta la ruta (app/api/offer/route.ts). */
export const TOPE_MENSAJE = 12_000;

/**
 * Los links de un mensaje (la web o la landing del negocio), para leerlos con 'leer-link' ANTES del
 * turno: el pedido es «si partimos de un documento o un link de su web o landing… sería mucho más
 * fácil», y en WhatsApp un link se pega en el mensaje, no en un botón aparte. Acepta `https://…`,
 * `http://…` y `www.…` (a éste le agrega https), sin la puntuación que cierra la frase, sin
 * repetidos y hasta 3: más que eso en un mensaje no es «mi web», es una lista que no se va a leer.
 */
export function linksDe(texto: string, max = 3): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi)) {
    let u = m[0].replace(/[).,;:!?”’\]]+$/u, '');
    if (/^www\./i.test(u)) u = `https://${u}`;
    if (!/^https?:\/\/[^/\s.]+\.[^/\s]+/i.test(u)) continue;
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

// ── El PDF en el chat ────────────────────────────────────────────────────────
// Pedido de Martín (12/10/2026): «sería bueno que MaKo en el mismo chat te proponga pulir la oferta, y
// que cuando se haya pulido te re-envie el PDF las veces que sea necesario con la versión final». Después
// de cada 'generar' el servidor agrega al chat un mensaje de MaKo con `pdf: { version }`; la pantalla lo
// dibuja como un documento de WhatsApp que baja ESA versión (cada mensaje, la suya: la v1 sigue bajando la
// v1 aunque ya exista la v3).

/**
 * El PDF que viaja en un mensaje de MaKo, o null. A la defensiva: lo escribe el servidor, pero los
 * mensajes de antes no lo traen y una versión que no es un entero positivo no baja nada.
 */
export function pdfDeMensaje(m: object | null | undefined): { version: number } | null {
  const pdf = (m as { pdf?: unknown } | null | undefined)?.pdf;
  if (!pdf || typeof pdf !== 'object') return null;
  const v = (pdf as { version?: unknown }).version;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? { version: v } : null;
}

/**
 * La ruta del PDF de una conversación: sin `v`, la versión vigente (el botón de la Conclusión); con `v`,
 * esa versión (el documento de un mensaje). El `?ws=` lo pega el parche de WsFetch al `fetch`.
 */
export function urlPdf(sesionId: number, version?: number | null): string {
  const v = typeof version === 'number' && Number.isInteger(version) && version > 0 ? `&v=${version}` : '';
  return `/api/offer/pdf?id=${sesionId}${v}`;
}

/** Lo que dice el documento del chat (el nombre del archivo lo pone el servidor al bajarlo). */
export const nombrePdfVersion = (version: number): string => `Tu oferta · versión ${version}`;

// ── Lo que la Conclusión marca aparte ────────────────────────────────────────

const textoLimpio = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');

/** Las partes que salen PROVISIONALES (con Cliente ideal o Promesa en 3 o menos) y por qué. */
export type Provisional = { partes: Array<'precio' | 'bonos'>; motivo: string };

/**
 * La marca de provisional de una conclusión, saneada (viene de un modelo pasado por el motor: se lee a la
 * defensiva). null = nada provisional. Una parte desconocida se ignora; sin partes válidas no hay marca.
 */
export function provisionalDe(c: object | null | undefined): Provisional | null {
  const p = (c as { provisional?: unknown } | null | undefined)?.provisional;
  if (!p || typeof p !== 'object') return null;
  const crudas = (p as { partes?: unknown }).partes;
  const partes = (Array.isArray(crudas) ? crudas : []).filter((x): x is 'precio' | 'bonos' => x === 'precio' || x === 'bonos');
  const unicas = partes.filter((x, i) => partes.indexOf(x) === i);
  if (!unicas.length) return null;
  return { partes: unicas, motivo: textoLimpio((p as { motivo?: unknown }).motivo) };
}

/** La sección de la oferta nueva que dibuja cada parte provisional (el precio vive en «Inversión»). */
export const SECCION_DE_PARTE: Record<Provisional['partes'][number], string> = { precio: 'inversion', bonos: 'bonos' };

/** ¿Esta sección de la oferta nueva va marcada como provisional? */
export function esSeccionProvisional(key: string, prov: Provisional | null): boolean {
  return !!prov && prov.partes.some((p) => SECCION_DE_PARTE[p] === key);
}

/** «Lo que propuso MaKo»: lo que MaKo puso de su cosecha (no lo dijo el dueño), saneado y sin vacíos. */
export function propuestoPorMakoDe(p: object | null | undefined): Array<{ seccion: string; que: string }> {
  const xs = (p as { propuestoPorMako?: unknown } | null | undefined)?.propuestoPorMako;
  if (!Array.isArray(xs)) return [];
  return xs
    .map((x) => ({ seccion: textoLimpio((x as { seccion?: unknown } | null)?.seccion), que: textoLimpio((x as { que?: unknown } | null)?.que) }))
    .filter((x) => x.que);
}

/** Un punto del control final de «lista para vender» como se DIBUJA: su nombre para el dueño, si pasa y qué falta. */
export type PuntoVisible = { punto: PuntoControl; label: string; ok: boolean; porque: string };

/**
 * El control final de una conclusión (`calculo.controlFinal`, el «Check final» que calcula el motor),
 * saneado y en el ORDEN del marco (`PUNTOS_CONTROL`, de donde sale también el nombre que ve el dueño: no se
 * escribe acá). Un punto desconocido no se dibuja; `ok` sólo con un `true` explícito (un punto que no dice
 * si pasa, no pasa: afirmar «lista» de más es el error caro). Las conclusiones de antes no lo traen: [].
 */
export function controlFinalDe(calculo: object | null | undefined): PuntoVisible[] {
  const xs = (calculo as { controlFinal?: unknown } | null | undefined)?.controlFinal;
  if (!Array.isArray(xs)) return [];
  const out: PuntoVisible[] = [];
  for (const def of PUNTOS_CONTROL) {
    const x = xs.find((y) => (y as { punto?: unknown } | null)?.punto === def.punto) as { ok?: unknown; porque?: unknown } | undefined;
    if (x) out.push({ punto: def.punto, label: def.label, ok: x.ok === true, porque: textoLimpio(x.porque) });
  }
  return out;
}

/**
 * Lo que dice el chip del héroe. Lista → «Lista para vender». Si no, y el motor dijo qué falta (control
 * final), cuántas cosas faltan: es lo que hay que hacer. Sin control final (las conclusiones de antes),
 * lo de siempre: la dimensión que más frena.
 */
export function textoDeEstado(e: { lista: boolean; faltan: number; cuello: string }): string {
  if (e.lista) return 'Lista para vender';
  if (e.faltan > 0) return e.faltan === 1 ? 'Le falta 1 cosa para venderla' : `Le faltan ${e.faltan} cosas para venderla`;
  return `Lo que más frena: ${e.cuello}`;
}

// (El chip de «Leyendo… / Listo» de arriba de la barra se fue el 11/10/2026: elegir un archivo ya no lo
// lee. Lo elegido se ve en la vista previa de la casa, app/whatsapp/_shared/VistaAdjuntos.tsx, y se lee
// recién al enviar: ./adjuntos-envio.ts.)

// ── El diagnóstico ───────────────────────────────────────────────────────────

export type TonoNota = 'good' | 'warn' | 'bad';

/**
 * La misma partición que la rúbrica del marco: 0-3 débil, 4-6 a medias, 7-10
 * fuerte. Sirve para las barras (nota de 0 a 10) y para el total (0-100, que se
 * pasa dividido por diez). Una nota con decimales cae en el tramo de su redondeo.
 */
export function tonoDeNota(nota: number): TonoNota {
  const n = Math.round(nota);
  if (n <= 3) return 'bad';
  if (n <= 6) return 'warn';
  return 'good';
}

/**
 * El ancho de una barra de 0 a 10, RECORTADO al 100 % (AGENTS.md: una barra que
 * pasa del 100 % no desborda la barra, desborda la página). Y sin negativos.
 */
export function anchoDeNota(nota: number): number {
  if (!Number.isFinite(nota)) return 0;
  return Math.max(0, Math.min(100, nota * 10));
}

export const VARIABLE_LABEL: Record<VariableValor, string> = {
  resultado: 'Resultado',
  probabilidad: 'Probabilidad',
  tiempo: 'Tiempo',
  esfuerzo: 'Esfuerzo',
};

// ── La marca de «completar» ──────────────────────────────────────────────────

export type TrozoTexto = { t: 'texto'; v: string } | { t: 'marca'; v: string };

/**
 * Parte un texto en trozos normales y marcas de «completar», para pintar cada
 * marca como una pastilla ámbar. La expresión sale de MARCA_COMPLETAR (no se
 * escribe la palabra dos veces) y acepta lo que un modelo escribe de verdad:
 * mayúsculas y un detalle adentro («[completar: precio]»), que se conserva.
 */
export function partirCompletar(texto: string): TrozoTexto[] {
  const palabra = MARCA_COMPLETAR.replace(/^\[|\]$/g, '');
  const re = new RegExp('\\[' + palabra + '([^\\]]*)\\]', 'gi');
  const out: TrozoTexto[] = [];
  let desde = 0;
  for (const m of texto.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > desde) out.push({ t: 'texto', v: texto.slice(desde, i) });
    const detalle = (m[1] ?? '').replace(/^\s*[:\-–]\s*/, '').trim();
    out.push({ t: 'marca', v: detalle ? `Completar: ${detalle}` : 'Completar' });
    desde = i + m[0].length;
  }
  if (desde < texto.length) out.push({ t: 'texto', v: texto.slice(desde) });
  return out;
}

/** ¿Hay algo que mostrar? Un campo vacío no dibuja su rótulo. */
export const tiene = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim().length > 0;

// ── Los archivos ─────────────────────────────────────────────────────────────

/**
 * El ícono del set según la familia del archivo (lib/formatos-archivo.ts). Nunca un emoji.
 * `via: 'audio'` es la «Transcripción del audio»: el documento que arma el servidor cuando una nota de
 * voz no entra en el mensaje. No tiene extensión, así que por el nombre caería en «archivo».
 */
export function iconoDeAdjunto(nombre: string, mime = '', via?: string): NombreIconoMenu {
  if (via === 'audio') return 'audio';
  switch (familiaDeArchivo(nombre, mime)) {
    case 'audio': return 'audio';
    case 'video': return 'video';
    case 'imagen': return 'imagen';
    default: return 'archivo';
  }
}

/**
 * El nombre del archivo que manda el servidor en el Content-Disposition. Acepta
 * las dos formas (`filename*=UTF-8''…`, que trae tildes, y `filename="…"`) y, si
 * no viene ninguna, usa la de respaldo.
 */
export function nombreDeDescarga(cd: string | null, respaldo: string): string {
  const s = cd ?? '';
  const ext = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(s)?.[1];
  if (ext) {
    try { return decodeURIComponent(ext.trim().replace(/^"|"$/g, '')); } catch { /* cae al siguiente */ }
  }
  const comun = /filename\s*=\s*"([^"]+)"/.exec(s)?.[1] ?? /filename\s*=\s*([^;]+)/.exec(s)?.[1];
  return comun?.trim() || respaldo;
}
