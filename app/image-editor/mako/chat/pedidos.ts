// =============================================================================
// mako/chat/pedidos — los pedidos SUELTOS en el chat del Image Editor: lo que no es del diseño abierto (18/11/2026)
// =============================================================================
// F136 tanda 3 de docs/pendientes-verificados-17-11.md (docs/diseno-mako-pedidos.md: «Un chat de MaKo interpreta el mensaje con
// /api/mako/pedidos ANTES de su modelo»). COPIA del Video Editor (app/video-editor/_opencut/chat/pedidos.ts), el primer editor
// que se enganchó, con lo de Image:
//   · LOS DISEÑOS LOS LISTA EL SERVIDOR (`objetosDeTab('imagen')`, app/api/mako/pedidos/route.ts, con la puerta del editor): acá
//     no viajan `objetos` (eso es sólo para las tabs cuyos objetos viven en el navegador, el Video Editor).
//   · LA RESPUESTA SE VALIDA CON LA REGLA DEL WEB GENERATOR (`interpretacionDe`): si la ruta falla, tarda o vuelve con otra forma,
//     el mensaje ENTERO va a la IA del chat, como antes.
//   · BORRAR UN DISEÑO NO SE HACE DESDE EL CHAT: la burbuja dice dónde (el «⋯» de la lista de diseños) y deja el link.
//   · Un diseño nuevo es un link a «Nuevo diseño» (las plantillas); con algo del abierto en el mismo mensaje, primero la pregunta
//     «¿Terminamos esto y después…?», como en el Video Editor y el Web Generator.
// Puro: lo prueba tests/image-editor-pedidos-chat.test.ts.
// =============================================================================

import type { Interpretacion, ObjetoChat } from '@/lib/mako-pedidos';
import { RUTA_CREAR } from '../../ruta';

export { interpretacionDe, textoActual } from '@/app/web-generator/editor/pedidos-chat';

/** Cuánto se espera a la ruta (el del Video Editor: lee la sesión, la vista y los diseños; la IA tiene 7,5 s). */
export const PLAZO_PEDIDOS_MS = 12_000;

/** El cuerpo de POST /api/mako/pedidos para el chat del editor. Sin `objetos`: los diseños los lista el servidor. */
export function cuerpoPedidos(texto: string, diseno: { id: string; nombre: string }) {
  return { texto: texto.trim(), tab: 'imagen' as const, actualId: diseno.id, actualNombre: diseno.nombre.trim() };
}

export type LinkBurbuja = { texto: string; href: string };
/** Una burbuja de MaKo: lo que dice y a dónde lleva. */
export type BurbujaPedido = { texto: string; links: LinkBurbuja[] };

export const TEXTOS = {
  propuesta: '¿Terminamos esto y después creamos otro diseño?',
  directa: 'Eso va en un diseño nuevo.',
  crear: 'Crear un diseño',
  cual: '¿Cuál? Dime su nombre.',
  abiertoBorrar: 'Este diseño está abierto: se borra desde la lista de diseños.',
  lista: 'Ir a mis diseños',
} as const;

/** «Nuevo diseño» con la lista de diseños (la pantalla de Create, app/image-editor/ruta.ts → RUTA_CREAR). */
export const RUTA_LISTA = RUTA_CREAR;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** El editor de un diseño (el ?ws= lo pega el `Link` de app/_ui/Link al dibujarlo). */
export const rutaDeDiseno = (o: ObjetoChat): string | null => (typeof o.id === 'string' && UUID.test(o.id) ? `/image-editor/${o.id}` : null);

const corto = (o: ObjetoChat, max = 60): string => {
  const n = (o.nombre ?? '').replace(/\s+/g, ' ').trim() || 'Diseño sin título';
  return n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n;
};
/** Un link de la ruta es de ADENTRO de la app: `/algo`, nunca `//otro.com` ni `javascript:`. */
const esInterno = (v: string): boolean => /^\/(?!\/)/.test(v) && !/[\s<>"]/.test(v);

/**
 * Una burbuja por cada pedido que NO es del diseño abierto, en el orden del mensaje. Sin un diseño claro ni dos candidatos, se
 * pregunta el nombre: nunca se elige el primero de una lista.
 */
export function burbujasDe(i: Interpretacion, actualId: string): BurbujaPedido[] {
  const hayActual = i.pedidos.some((p) => p.sobre === 'actual');
  const primero = i.pedidos.find((p) => p.sobre !== 'actual');
  return i.pedidos.flatMap((p): BurbujaPedido[] => {
    if (p.sobre === 'actual') return [];
    if (p.sobre === 'nuevo') {
      const texto = hayActual ? (p === primero && i.propuesta?.texto) || TEXTOS.propuesta : TEXTOS.directa;
      return [{ texto, links: [{ texto: TEXTOS.crear, href: RUTA_LISTA }] }];
    }
    if (p.sobre === 'otra-tab') return esInterno(p.link) ? [{ texto: `Eso se hace en ${p.titulo}.`, links: [{ texto: `Ir a ${p.titulo}`, href: p.link }] }] : [];
    if (p.verbo === 'borrar' && String(p.objeto?.id) === actualId) return [{ texto: TEXTOS.abiertoBorrar, links: [{ texto: TEXTOS.lista, href: RUTA_LISTA }] }];
    const objetos = (p.objeto ? [p.objeto] : p.candidatos).filter((o) => String(o.id) !== actualId && rutaDeDiseno(o));
    const claro = !!p.objeto && objetos.length === 1;
    const dos = !p.objeto && objetos.length === 2;
    if (!claro && !dos) return [{ texto: TEXTOS.cual, links: [] }];
    if (p.verbo === 'borrar') {
      const nombres = objetos.map((o) => `«${corto(o)}»`).join(' o ');
      return [{ texto: `${nombres} se borra desde la lista de diseños.`, links: [{ texto: TEXTOS.lista, href: RUTA_LISTA }] }];
    }
    const texto = objetos.length === 2 ? `¿Cuál: «${corto(objetos[0])}» o «${corto(objetos[1])}»?` : `Eso va en «${corto(objetos[0])}».`;
    return [{ texto, links: objetos.map((o) => ({ texto: `Abrir «${corto(o, 28)}»`, href: rutaDeDiseno(o)! })) }];
  });
}
