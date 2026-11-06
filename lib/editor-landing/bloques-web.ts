// =============================================================================
// editor-landing/bloques-web — los bloques del Web Generator en el hilo con MaKo: los tipos y su saneo (1.12 y 1.13)
// =============================================================================
// Sobre el marco de bloques de Ops Center 3 (lib/chat-bloques.ts, pieza 1.7): «cada área dibuja las suyas con sus
// piezas» (docs/ops-center-principal.md §2.4). El G5 genérico (`creado`) pide una IMAGEN, y una landing no tiene: su
// miniatura se dibuja con su primera sección (MiniaturaLanding.tsx). Por eso estos cuatro son del área:
//   · `landing`: la tarjeta de una landing (la miniatura, el estado, el link si está en internet, «Abrir en el editor»);
//   · `landings`: las de una lista (listar_landings_creadas), hasta MAX_LANDINGS_BLOQUE tarjetas y «Ver todas». Una
//     herramienta devuelve UN bloque (el `bloque` de su salida, lib/chat-bloques.ts → `bloqueDeSalida`);
//   · `elegir`: el G2, elegir entre 3 con vista previa (diseños, temas, el formato de Replicar). Contesta como el G1:
//     lo elegido sale como un mensaje de la persona;
//   · `publicada`: el link público con Copiar y Abrir (1.13);
//   · `dominio`: los registros DNS con su estado, que se vuelve a mirar en el MISMO bloque (1.13).
// Los arma lib/editor-landing/bloques-chat.ts (con los catálogos) y los dibuja app/web-generator/BloqueWeb.tsx.
//
// ⚠️ LIVIANO A PROPÓSITO: lo importa lib/chat-bloques.ts, que carga cada chat. Nada de catálogos ni de render.
// ⚠️ EL MISMO CRITERIO DEL MARCO: lo que no calza se descarta entero, y los botones van a rutas de la app. La única
//    dirección de afuera es la de una landing PUBLICADA (la de MaKo o su dominio propio): `https:`, sin usuario ni
//    puerto, con un nombre de host válido. Se muestra y se abre en otra pestaña; nunca se usa como miniatura.
// =============================================================================

import type { JsonNodo } from './doc';
import { FORMA_DE, formaFija, type ProporcionFija } from './api-tipos';

export type Abrir = { titulo: string; href: string };

export type EstadoLanding = 'borrador' | 'publicada' | 'pausada';

export type BloqueLanding = {
  t: 'landing';
  id: number;
  titulo: string;
  formato: 'landing' | 'presentacion';
  estado: EstadoLanding;
  /** La dirección pública (la del dominio propio verificado si tiene uno), o null si no está en internet. */
  url: string | null;
  /** Lo que dibuja la miniatura (MiniaturaLanding): la primera sección y el tema. */
  miniatura: { tarjeta: JsonNodo | null; tema: string; proporcion: ProporcionFija | null };
  /** «Nueva», «Copia», «Replicada»: corto, en una píldora (además del estado). */
  nota?: string;
  abrir: Abrir;
};

export type OpcionBloque = { id: string; titulo: string; cuando: string };

export type BloqueElegir = {
  t: 'elegir';
  que: 'diseno' | 'tema' | 'formato';
  pregunta: string;
  opciones: OpcionBloque[];
  /** El id de la recomendada (una de `opciones`), o null. */
  recomendada: string | null;
  /** La operación que corre la opción elegida, y el parámetro que llena su id. */
  operacion: string;
  parametro: string;
};

export type BloquePublicada = { t: 'publicada'; id: number; titulo: string; url: string; editor: Abrir };

export type FilaDns = { tipo: string; nombre: string; valor: string; listo: boolean | null; para?: string };

export type BloqueDominio = {
  t: 'dominio';
  id: number;
  dominio: string;
  estado: 'pendiente' | 'verificado';
  registros: FilaDns[];
  /** Cuántos registros faltan cargar. El www que MaKo le suma a una raíz verificada es informativo y no cuenta. */
  faltan: number;
  falta: string | null;
};

/** Una lista de landings: las primeras con su tarjeta, cuántas hay en total y la vuelta al Panel. */
export type BloqueLandings = { t: 'landings'; titulo: string; landings: BloqueLanding[]; total: number; abrir: Abrir };

export type BloqueWeb = BloqueLanding | BloqueLandings | BloqueElegir | BloquePublicada | BloqueDominio;

export const TIPOS_WEB = ['landing', 'landings', 'elegir', 'publicada', 'dominio'] as const;

/** Cuántas tarjetas lleva una lista: las demás se ven en el Panel. */
/** Lo que manda cada opción del «elegir»: «Diseño: Minimal». Con eso MaKo sabe QUÉ se eligió, y el hilo sabe que esa
 *  respuesta es de ESTE selector (`respuestasDeElegir`, la usa `conRespuestas`). */
export const QUE_ELEGIR: Record<BloqueElegir['que'], string> = { diseno: 'Diseño', tema: 'Tema', formato: 'Formato' };
/** Los rótulos de los dos botones de abajo. Lo que MANDAN lleva el prefijo del selector («Diseño: elige tú»): con el mismo
 *  texto que los de la pregunta (G1) al lado, «Saltear» no decía de cuál venía (revisión del 21/10/2026). */
export const ELIGE_TU = 'Elige tú';
export const SALTEAR = 'Saltear';
export const textoDeOpcion = (b: BloqueElegir, o: { titulo: string }): string => `${QUE_ELEGIR[b.que]}: ${o.titulo}`;
export const textoEligeTu = (b: BloqueElegir): string => `${QUE_ELEGIR[b.que]}: elige tú`;
export const textoSaltear = (b: BloqueElegir): string => `${QUE_ELEGIR[b.que]}: saltear`;
/** Todo lo que un toque en este «elegir» puede mandar. */
export const respuestasDeElegir = (b: BloqueElegir): string[] => [...b.opciones.map((o) => textoDeOpcion(b, o)), textoEligeTu(b), textoSaltear(b)];

export const MAX_LANDINGS_BLOQUE = 4;

export const esBloqueWeb = (b: { t: string }): b is BloqueWeb => (TIPOS_WEB as readonly string[]).includes(b.t);

// ── El saneo ────────────────────────────────────────────────────────────────

/** Topes: una sección en JSON (la de la miniatura) no puede inflar el mensaje guardado. */
export const MAX_JSON_SECCION = 40_000;
const MAX_OPCIONES = 3;
const MAX_REGISTROS = 12;

// Se recorta DESPUÉS de cortar (revisión del 21/10/2026): cortar en un espacio dejaba el texto terminado en uno, y lo
// que manda el botón (recortado por la pantalla) ya no era igual a lo guardado: un selector viejo no se reconocía.
const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max).trim() : '');
const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 2 ** 31 ? v : null);
const ID_CATALOGO = /^(?:ws:)?[a-z0-9][a-z0-9_-]{0,79}$/;

/**
 * La dirección de una landing publicada: `https:`, sin usuario, contraseña ni puerto, y un host con forma de dominio
 * (letras, números, guiones y puntos, con al menos un punto). null si no. Es lo único de afuera que se muestra.
 */
export function urlPublicada(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 300) return null;
  let u: URL;
  try { u = new URL(v); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(u.hostname)) return null;
  return u.toString();
}

/** Una sección de la miniatura: un objeto `tarjeta` que, en JSON, no pase el tope. null si no. */
function seccion(v: unknown): JsonNodo | null {
  if (!v || typeof v !== 'object' || Array.isArray(v) || (v as { type?: unknown }).type !== 'tarjeta') return null;
  try { return JSON.stringify(v).length <= MAX_JSON_SECCION ? (v as JsonNodo) : null; } catch { return null; }
}

function abrir(v: unknown, rutaInterna: (v: unknown) => string | null): Abrir | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const titulo = texto(o.titulo, 60);
  const href = rutaInterna(o.href);
  return titulo && href ? { titulo, href } : null;
}

/**
 * Un bloque del Web Generator, saneado; null si no es uno o no calza. `rutaInterna` es la del marco
 * (lib/chat-bloques.ts): se recibe para no importarlo (ese módulo importa éste).
 */
export function sanearBloqueWeb(o: Record<string, unknown>, rutaInterna: (v: unknown) => string | null): BloqueWeb | null {
  switch (o.t) {
    case 'landing': {
      const id = entero(o.id);
      const titulo = texto(o.titulo, 120);
      const a = abrir(o.abrir, rutaInterna);
      const estado = (['borrador', 'publicada', 'pausada'] as const).find((e) => e === o.estado);
      const m = o.miniatura && typeof o.miniatura === 'object' ? (o.miniatura as Record<string, unknown>) : null;
      const tema = texto(m?.tema, 84);
      if (!id || !titulo || !a || !estado || !m || !ID_CATALOGO.test(tema)) return null;
      const url = o.url == null ? null : urlPublicada(o.url);
      if (o.url != null && !url) return null;
      const nota = texto(o.nota, 30);
      return {
        t: 'landing', id, titulo, formato: o.formato === 'presentacion' ? 'presentacion' : 'landing', estado,
        url: estado === 'borrador' ? null : url,
        miniatura: { tarjeta: seccion(m.tarjeta), tema, proporcion: typeof m.proporcion === 'string' && Object.hasOwn(FORMA_DE, m.proporcion) ? formaFija(m.proporcion) : null },
        ...(nota ? { nota } : {}), abrir: a,
      };
    }
    case 'landings': {
      const titulo = texto(o.titulo, 120);
      const a = abrir(o.abrir, rutaInterna);
      const landings = (Array.isArray(o.landings) ? o.landings : []).slice(0, MAX_LANDINGS_BLOQUE).flatMap((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
        const l = sanearBloqueWeb({ ...(x as Record<string, unknown>), t: 'landing' }, rutaInterna);
        return l && l.t === 'landing' ? [l] : [];
      });
      const total = typeof o.total === 'number' && Number.isInteger(o.total) && o.total >= landings.length ? o.total : landings.length;
      return titulo && a && landings.length ? { t: 'landings', titulo, landings, total, abrir: a } : null;
    }
    case 'elegir': {
      const que = (['diseno', 'tema', 'formato'] as const).find((q) => q === o.que);
      const pregunta = texto(o.pregunta, 200);
      const operacion = texto(o.operacion, 60);
      const parametro = texto(o.parametro, 40);
      const opciones = (Array.isArray(o.opciones) ? o.opciones : []).slice(0, MAX_OPCIONES).flatMap((x) => {
        if (!x || typeof x !== 'object') return [];
        const r = x as Record<string, unknown>;
        const id = texto(r.id, 84);
        const titulo = texto(r.titulo, 80);
        return ID_CATALOGO.test(id) && titulo ? [{ id, titulo, cuando: texto(r.cuando, 120) }] : [];
      });
      // Elegir entre una no es elegir; y dos iguales, tampoco.
      if (!que || !pregunta || !/^[a-z_]+$/.test(operacion) || !/^[a-z_]+$/.test(parametro) || opciones.length < 2
        || new Set(opciones.map((x) => x.id)).size !== opciones.length) return null;
      const recomendada = opciones.some((x) => x.id === o.recomendada) ? (o.recomendada as string) : null;
      return { t: 'elegir', que, pregunta, opciones, recomendada, operacion, parametro };
    }
    case 'publicada': {
      const id = entero(o.id);
      const titulo = texto(o.titulo, 120);
      const url = urlPublicada(o.url);
      const editor = abrir(o.editor, rutaInterna);
      return id && titulo && url && editor ? { t: 'publicada', id, titulo, url, editor } : null;
    }
    case 'dominio': {
      const id = entero(o.id);
      const dominio = texto(o.dominio, 253).toLowerCase();
      const estado = o.estado === 'verificado' ? 'verificado' : o.estado === 'pendiente' ? 'pendiente' : null;
      if (!id || !estado || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dominio)) return null;
      const registros = (Array.isArray(o.registros) ? o.registros : []).slice(0, MAX_REGISTROS).flatMap((x) => {
        if (!x || typeof x !== 'object') return [];
        const r = x as Record<string, unknown>;
        const tipo = texto(r.tipo, 10).toUpperCase();
        const nombre = texto(r.nombre, 253);
        const valor = texto(r.valor, 600);
        const para = texto(r.para, 20);
        if (!/^[A-Z]{1,10}$/.test(tipo) || !nombre || !valor) return [];
        return [{ tipo, nombre, valor, listo: r.listo === true ? true : r.listo === false ? false : null, ...(para ? { para } : {}) }];
      });
      const faltan = estado === 'verificado' ? 0 : registros.filter((r) => r.listo === false && r.para !== 'www').length;
      return { t: 'dominio', id, dominio, estado, registros, faltan, falta: estado === 'verificado' ? null : texto(o.falta, 300) || null };
    }
    default:
      return null;
  }
}
