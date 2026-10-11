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
  MARCA_COMPLETAR, PIEZAS,
  type FuentePieza, type OfferSesionResumen, type OfferSesionVista, type PiezaKey, type PiezasSabidas, type VariableValor,
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

// ── Las sesiones ─────────────────────────────────────────────────────────────

/** El renglón del historial que corresponde a una sesión abierta. */
export function resumenDe(s: OfferSesionVista): OfferSesionResumen {
  return { id: s.id, titulo: s.titulo, estado: s.estado, total: s.conclusion?.calculo.total ?? null, updatedAt: s.updatedAt };
}

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** La lista con este renglón puesto (o actualizado), de la más reciente a la más vieja. */
export function conResumen(lista: OfferSesionResumen[], r: OfferSesionResumen): OfferSesionResumen[] {
  return [r, ...lista.filter((x) => x.id !== r.id)].sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt));
}

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

/** ¿Se habló algo DESPUÉS de la última conclusión? Decide si la tarjeta del final invita a armar de nuevo. */
export function hayChatDespuesDe(s: OfferSesionVista): boolean {
  if (!s.conclusion) return true;
  const corte = ms(s.conclusion.at);
  return s.mensajes.some((m) => ms(m.at) > corte);
}

/** «11 oct». Sólo se llama en el navegador, después de abrir el menú (no hay hidratación de por medio). */
export function fechaCorta(iso: string): string {
  const t = ms(iso);
  if (!t) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(t)).replace('.', '');
}

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

/** El ícono del set según la familia del archivo (lib/formatos-archivo.ts). Nunca un emoji. */
export function iconoDeAdjunto(nombre: string, mime = ''): NombreIconoMenu {
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
