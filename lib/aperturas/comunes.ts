// =============================================================================
// Los pasos que comparten las aperturas: la oferta, el objetivo y lo que falta para pedirle a la IA (PURO; 29/10/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («pasoOferta», «pasoObjetivo») y §2.6 (sin la app de escritorio). Cada superficie los usa con
// SU prefijo (`copywriter:oferta`, `web:objetivo`), así que cada una recuerda lo suyo; los que comparten un hecho del negocio
// (`negocio:funnel`) lo hacen a propósito, con la misma clave.
// =============================================================================

import type { Apertura, RotuloCallar } from './reglas';
import { TOPE_ROTULO } from './reglas';

/** Una oferta como la necesita un botón: su id (de `listarOfertas`, lib/ofertas.ts) y su nombre. */
export type OfertaCorta = { id: number; nombre: string };

/** Cuántas ofertas entran como botones: con el de callar, cuatro. */
export const TOPE_OFERTAS_BOTONES = 3;

/** El valor de una oferta elegida: «oferta:12». */
export const valorDeOferta = (id: number): string => `oferta:${id}`;
export const ofertaDelValor = (v: string | undefined): number | null => {
  const m = /^oferta:(\d+)$/.exec(v ?? '');
  return m ? Number(m[1]) : null;
};
/** «Para otra cosa» (una oferta) y «Te la cuento» (ninguna): la cuenta escribiendo. */
export const OTRA_COSA = 'otra';

/** Un nombre largo cabe en un botón: corto, con «…». */
export const rotuloDe = (s: string): string => {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length <= TOPE_ROTULO ? t : `${t.slice(0, TOPE_ROTULO - 1).trimEnd()}…`;
};

/**
 * «¿Para cuál de tus ofertas es?»: con 2 o más, hasta 3 como botones (la principal primero: `listarOfertas` ordena así); con
 * una, «¿Es para «X»?»; con ninguna, «¿Qué vas a vender con esto?» de texto libre. SIN LA APP la caja no escribe: ese paso sale
 * sin el texto libre, con «Cargar una oferta» (plan.md §2.6).
 */
export function pasoOferta(o: { superficie: string; ofertas: readonly OfertaCorta[]; conApp: boolean; callar?: RotuloCallar; antes?: string }): Apertura {
  const id = `${o.superficie}:oferta`;
  const callar = { tipo: 'callar' as const, rotulo: o.callar ?? 'Ahora no' };
  const antes = o.antes ? `${o.antes} ` : '';
  if (o.ofertas.length >= 2) {
    return {
      id, alcance: 'entidad', texto: `${antes}¿Para cuál de tus ofertas es?`,
      botones: [...o.ofertas.slice(0, TOPE_OFERTAS_BOTONES).map((x) => ({ tipo: 'respuesta' as const, rotulo: rotuloDe(x.nombre), valor: valorDeOferta(x.id) })), callar],
    };
  }
  if (o.ofertas.length === 1) {
    const x = o.ofertas[0];
    return {
      id, alcance: 'entidad', texto: `${antes}¿Es para «${x.nombre.trim()}»?`,
      botones: [{ tipo: 'respuesta', rotulo: 'Sí', valor: valorDeOferta(x.id) }, { tipo: 'respuesta', rotulo: 'Para otra cosa', valor: OTRA_COSA }, callar],
    };
  }
  if (!o.conApp) {
    return {
      id, alcance: 'entidad', texto: `${antes}Necesito saber qué vendes. ¿Ya está tu oferta en Offer?`,
      botones: [{ tipo: 'ir', rotulo: 'Cargar una oferta', href: '/offer' }, { tipo: 'callar', rotulo: 'Ahora no' }],
    };
  }
  return {
    id, alcance: 'entidad', texto: `${antes}¿Qué vas a vender con esto?`, libre: true,
    botones: [{ tipo: 'respuesta', rotulo: 'Te la cuento', valor: OTRA_COSA }, { tipo: 'ir', rotulo: 'Cargar una oferta', href: '/offer' }, callar],
  };
}

/** Qué tiene que hacer quien vea la pieza. El del funnel va primero. */
export const OBJETIVOS = [
  { valor: 'agendar', rotulo: 'Agendar una llamada' },
  { valor: 'whatsapp', rotulo: 'Escribirte por WhatsApp' },
  { valor: 'clase', rotulo: 'Registrarse a tu clase' },
  { valor: 'comprar', rotulo: 'Comprar en tu página' },
] as const;
export type ObjetivoPieza = (typeof OBJETIVOS)[number]['valor'];

/**
 * «¿Qué tiene que hacer quien la vea?»: tres objetivos (el de su funnel primero) y el de callar. `null` si el funnel ya lo dice
 * (`saltar`): no se pregunta lo que se sabe.
 */
export function pasoObjetivo(o: { superficie: string; delFunnel?: ObjetivoPieza | null; saltar?: boolean; callar?: RotuloCallar }): Apertura | null {
  if (o.saltar) return null;
  const orden = [...OBJETIVOS].sort((a, b) => Number(b.valor === o.delFunnel) - Number(a.valor === o.delFunnel));
  return {
    id: `${o.superficie}:objetivo`, alcance: 'entidad', texto: '¿Qué tiene que hacer quien la vea?',
    botones: [...orden.slice(0, 3).map((x) => ({ tipo: 'respuesta' as const, rotulo: x.rotulo, valor: x.valor })), { tipo: 'callar', rotulo: o.callar ?? 'Ahora no' }],
  };
}

/**
 * Lo que falta para que un `pedir` salga (plan.md §2.6): sin la app, «Instalar MaKo» (la pieza de la caja); con la app y sin su
 * IA, «Conectar tu IA»; ya con su IA y algo pendiente, «Escríbelo». `null` = se puede pedir ya.
 * El pedido pendiente queda en la memoria de la apertura que lo pidió (`pendiente`), así que sobrevive a cerrar la pestaña.
 */
export function pasoSinIA(o: { superficie: string; app: 'tiene' | 'bloquea' | 'en-la-computadora' | null; iaConectada: boolean | null; pendiente?: { texto: string; para?: string } | null }): Apertura | null {
  if (o.app === 'bloquea') {
    return {
      id: `${o.superficie}:sin-app`, alcance: 'negocio', texto: 'Para escribirlo uso tu Claude o tu ChatGPT, desde la app de MaKo.',
      botones: [{ tipo: 'hacer', rotulo: 'Instalar MaKo', accion: 'instalar' }, { tipo: 'callar', rotulo: 'Ahora no' }],
    };
  }
  if (o.iaConectada === false) {
    return {
      id: `${o.superficie}:sin-ia`, alcance: 'negocio', texto: 'Conecta tu Claude o tu ChatGPT y lo escribo.',
      botones: [{ tipo: 'hacer', rotulo: 'Conectar tu IA', accion: 'conectar' }, { tipo: 'callar', rotulo: 'Ahora no' }],
    };
  }
  if (o.pendiente) {
    const para = o.pendiente.para ? ` para «${o.pendiente.para}»` : '';
    return {
      id: `${o.superficie}:pendiente`, alcance: 'entidad', texto: `Ya tengo tu IA. Lo escribo${para} cuando quieras.`,
      botones: [{ tipo: 'pedir', rotulo: 'Escríbelo', pedido: o.pendiente.texto }, { tipo: 'callar', rotulo: 'Ahora no' }],
    };
  }
  return null;
}
