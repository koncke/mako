// =============================================================================
// Una página de un competidor capturada con la extensión, en el navegador de la persona (4/11/2026)
// =============================================================================
// Martín: «Pero podemos hacerlo con la extension de mako... Muchas extensiones capturan sitios web... Yo no quiero vulnerar a
// nadie, solo quiero capturar el diseño». Y, después de probar Replicar con `beacons.page/denborg` («La página pide comprobar que
// es una persona»): «Si, tendremos que hacerlo con la extension entonces».
//
// EL RECORRIDO (y por qué no pide ningún permiso nuevo):
//   1. «Sus páginas» no la pudo mostrar (el servidor no la baja, o el marco no avisó que la pintó): ofrece «Capturar».
//   2. Al tocarlo, la extensión abre ESA página en una pestaña a la vista. Si pide comprobar que es una persona, lo hace ella:
//      la extensión no hace clic ni resuelve nada.
//   3. Cuando la ve, la persona toca el ícono de MaKo: con ese toque Chrome le da la pestaña a la extensión (`activeTab`), que
//      saca una foto de lo que se ve, lee su título, su texto y a dónde enlaza, cierra la pestaña y vuelve a Spy. Sin ese toque no se lee nada: abrir una pestaña no da permiso para leerla, y un permiso de
//      sitios nuevo desactivaría la extensión a cada cliente hasta que lo acepte (AGENTS.md).
//   4. Lo capturado se guarda para todo el negocio. De una página de enlaces (Beacons, Linktree) salen sus otras páginas, para
//      el desplegable; cada una se captura igual, cuando la persona la pide. Nunca en segundo plano ni en un cron.
//
// ⚠️ EL DISEÑO (el HTML ya dibujado, para «Copiar su sitio») TODAVÍA NO SE GUARDA: `spy-miniaturas` es público y sólo acepta
// imágenes (mig 0361), y un HTML ajeno no va ahí. Hace falta un bucket privado (una migración con número del Cerebro). Del HTML
// sólo viaja el principio, para reconocer el desafío de un antibots, y no se guarda.
//
// Este módulo es lo puro: qué se acepta de la extensión (`leerCapturaDePagina`), si lo capturado es la página
// (`juzgarCaptura`: el desafío, su página de error o nada no se guardan) y qué páginas suyas enlaza. Sin `server-only`: lo usan
// la ruta, la pantalla y los tests.
// =============================================================================

import { esDesafioDeBot } from './landing-extraer';
import { esPaginaDeError, TEXTO_MINIMO_PINTADO } from './pagina-real';
import { esAgregador, paginasQueEnlaza } from './spy-otras-redes-reglas';
import { MAX_ENLACES, webComparable } from './spy-oferta';

/** La versión de la extensión que sabe capturar una página (y la que la pantalla pide, si la que hay es más vieja). */
export const VERSION_CAPTURA = '0.76.0';

/** Los topes de lo que llega. Del HTML, sólo el principio: alcanza para reconocer el desafío de un antibots. */
export const TOPE_CAPTURA = { html: 30_000, texto: 60_000, titulo: 300, enlaces: 500 } as const;
/** Lo que se guarda del texto (para leer su oferta y mostrarlo): el resto queda en el HTML. */
export const TEXTO_GUARDADO = 20_000;
/** Cuántas páginas capturadas se guardan por competidor: las más nuevas. */
export const PAGINAS_POR_COMPETIDOR = 24;

/** Lo que manda la extensión (extension/spy-pagina.js). */
export type CapturaDePagina = {
  /** La dirección de la pestaña al capturar (la página a la que llegó, después de cualquier redirección). */
  final: string;
  titulo: string;
  texto: string;
  enlaces: string[];
  /** El principio de su HTML ya dibujado: sólo para reconocer el desafío. No se guarda. */
  html: string;
};

const http = (u: unknown): string | null => {
  if (typeof u !== 'string') return null;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null;
  } catch {
    return null;
  }
};

/** Lo que llegó de la extensión, sólo con lo que se espera y con sus topes. `null` si no es una captura. */
export function leerCapturaDePagina(crudo: unknown): CapturaDePagina | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const c = crudo as Record<string, unknown>;
  const final = http(c.final);
  if (!final) return null;
  const enlaces = Array.isArray(c.enlaces) ? c.enlaces.map(http).filter((u): u is string => !!u).slice(0, TOPE_CAPTURA.enlaces) : [];
  return {
    final,
    titulo: typeof c.titulo === 'string' ? c.titulo.slice(0, TOPE_CAPTURA.titulo) : '',
    texto: typeof c.texto === 'string' ? c.texto.slice(0, TOPE_CAPTURA.texto) : '',
    enlaces,
    html: typeof c.html === 'string' ? c.html.slice(0, TOPE_CAPTURA.html) : '',
  };
}

/**
 * ¿Lo capturado es la página? Lo que no lo es, no se guarda, y la pantalla dice qué hacer:
 *  · `desafio`: la página pide comprobar que es una persona. La pestaña queda abierta para que la persona lo pase y vuelva a
 *    tocar el ícono;
 *  · `error`: es su página de error («500», «Application error»), no la página;
 *  · `vacia`: no cargó (sin texto que alcance), y tampoco hay foto.
 */
export function juzgarCaptura(c: CapturaDePagina, conFoto: boolean): 'ok' | 'desafio' | 'error' | 'vacia' {
  if (esDesafioDeBot(c.html) || esDesafioDeBot(`<title>${c.titulo}</title>${c.texto.slice(0, 2000)}`)) return 'desafio';
  if (esPaginaDeError(c.texto.slice(0, 240), c.titulo)) return 'error';
  if (c.texto.replace(/\s+/g, ' ').trim().length < TEXTO_MINIMO_PINTADO && !conFoto) return 'vacia';
  return 'ok';
}

/**
 * Sus otras páginas: de una página de enlaces (Beacons, Linktree), lo que enlaza que no es una red ni otra página de enlaces —
 * la misma regla que su oferta (`paginasQueEnlaza`, hasta `MAX_ENLACES`)—. De un sitio común, ninguna: su menú no son «sus
 * páginas».
 */
export function paginasDeLaCaptura(pedida: string, c: Pick<CapturaDePagina, 'final' | 'enlaces'>): string[] {
  if (!esAgregador(pedida) && !esAgregador(c.final)) return [];
  return paginasQueEnlaza(c.enlaces, c.final, MAX_ENLACES);
}

/** Lo que queda guardado de una página capturada (en `spy.paginas.<competidor>`, por su dirección). */
export type PaginaCapturada = {
  url: string;
  final: string;
  titulo: string;
  /** La foto de lo que se veía (URL pública de nuestro Storage). */
  foto: string | null;
  /** Sus otras páginas, si era una página de enlaces. */
  paginas: string[];
  texto: string;
  capturadaEn: string;
};

export const claveDePaginasCapturadas = (competidorId: number) => `spy.paginas.${competidorId}`;

/** El registro guardado, sano. Lo que no tiene forma de página capturada se deja afuera. */
export function leerPaginasCapturadas(crudo: unknown): Record<string, PaginaCapturada> {
  let v = crudo;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return {}; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, PaginaCapturada> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const p = x as Partial<PaginaCapturada> | null;
    const url = http(p?.url);
    const final = http(p?.final) ?? url;
    if (!p || !url || !final || typeof p.capturadaEn !== 'string') continue;
    out[k] = {
      url, final,
      titulo: typeof p.titulo === 'string' ? p.titulo : '',
      foto: http(p.foto),
      paginas: Array.isArray(p.paginas) ? p.paginas.map(http).filter((u): u is string => !!u).slice(0, MAX_ENLACES) : [],
      texto: typeof p.texto === 'string' ? p.texto.slice(0, TEXTO_GUARDADO) : '',
      capturadaEn: p.capturadaEn,
    };
  }
  return out;
}

/** El registro con una página nueva (o capturada otra vez), y sólo las `PAGINAS_POR_COMPETIDOR` más nuevas. */
export function conPaginaCapturada(reg: Record<string, PaginaCapturada>, p: PaginaCapturada): Record<string, PaginaCapturada> {
  const todas = { ...reg, [webComparable(p.url)]: p };
  const orden = Object.entries(todas).sort((a, b) => b[1].capturadaEn.localeCompare(a[1].capturadaEn));
  return Object.fromEntries(orden.slice(0, PAGINAS_POR_COMPETIDOR));
}

/** La capturada de una dirección, si la hay. */
export const capturaDe = (reg: Record<string, PaginaCapturada>, url: string): PaginaCapturada | null => reg[webComparable(url)] ?? null;
