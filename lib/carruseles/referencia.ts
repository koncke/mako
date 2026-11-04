// =============================================================================
// carruseles/referencia — «Hacer el mío»: la ESTRUCTURA de un carrusel de otro, nunca su contenido
// =============================================================================
// Martín, 4/11/2026: «De una referencia a tu carrusel: el botón clave. Toma la ESTRUCTURA (gancho, cantidad de láminas,
// ritmo, cierre), no el contenido, y arma uno nuevo en el editor con los datos del negocio».
//
// Lo que se toma, y de dónde, sin inventar (lo que no se midió no se dice):
//   · el TIPO: el formato que la IA del negocio le leyó en Spy (o el que dice su texto, `formatoPorTexto`), llevado a un tipo
//     de MaKo (./tipos.ts, `tipoDeFormato`). Si no encaja con ninguno, no se adivina: se pregunta;
//   · las LÁMINAS: las que dijo su fuente (mig 0391). Sin el dato, las del tipo;
//   · el GANCHO: con qué ABRE (pregunta, promesa, dolor…), el vocabulario de Spy (`tipoGancho`), nunca sus palabras;
//   · el CIERRE: qué pide al final (que lo guarden, que comenten, que escriban…), leído de su texto con reglas.
// Antes de crear, la persona VE lo que se entendió y lo puede cambiar (AGENTS.md: lo que se interpreta de un texto pasa por
// un toque). Su texto no viaja al diseño: las láminas llevan las GUÍAS del tipo, ajustadas a su gancho y su cierre.
//
// Puro: lo usan la pantalla (la confirmación), la acción que crea, la API de MaKo y los tests.
// =============================================================================

import type { Carrusel } from './explorar';
import { cierreDeTexto, esCierre, type Cierre } from './texto';
import { TIPOS_CARRUSEL, esTipoCarrusel, laminasDelTipo, tipoCarrusel, tipoDeFormato, type IdTipoCarrusel, type Lamina, type TipoCarrusel } from './tipos';

export { CIERRES, cierreDeTexto, type Cierre } from './texto';

/** Qué pide cada cierre, como lo lee la persona («cierra pidiendo que lo guarden»). */
const QUE_PIDE: Record<Cierre, string> = {
  guardar: 'que lo guarden', compartir: 'que lo compartan', comentar: 'que comenten', mensaje: 'que le escriban por mensaje',
  seguir: 'que lo sigan', link: 'que entren al link de la bio',
};

/** La guía de la última lámina según el cierre de la referencia. */
const GUIA_CIERRE: Record<Cierre, { titulo: string; cuerpo: string }> = {
  guardar: { titulo: 'Pide que lo guarden', cuerpo: '«Guárdalo para cuando…»: una razón concreta para volver a leerlo.' },
  compartir: { titulo: 'Pide que lo compartan', cuerpo: '«Envíaselo a alguien que…»: a quién le serviría.' },
  comentar: { titulo: 'Una pregunta para los comentarios', cuerpo: 'Algo fácil de contestar: un número, una palabra, su caso.' },
  mensaje: { titulo: 'Que te escriban una palabra', cuerpo: '«Escríbeme [PALABRA] por mensaje y te mando…»: lo que reciben.' },
  seguir: { titulo: 'Que te sigan', cuerpo: 'Qué van a encontrar si te siguen, en una línea.' },
  link: { titulo: 'Que entren al link de tu bio', cuerpo: 'Qué hay en el link y por qué ahora.' },
};

/** Con qué abre (el vocabulario de Spy: lib/ads-analyst-vocabulario.ts, HOOK_TYPES), como lo lee la persona. */
const GANCHOS: Record<string, { dice: string; guia: string }> = {
  pregunta: { dice: 'abre con una pregunta', guia: 'Una pregunta que tu cliente se hace y no sabe contestar.' },
  promesa: { dice: 'abre con una promesa', guia: 'Lo que va a lograr quien lo lea, con un número si puedes.' },
  dolor: { dice: 'abre con un dolor', guia: 'El problema de tu cliente, dicho como lo diría él.' },
  resultado: { dice: 'abre con un resultado', guia: 'Un resultado tuyo o de un cliente (con permiso), con su número.' },
  testimonio: { dice: 'abre con lo que dijo un cliente', guia: 'Una frase de un cliente tuyo (con permiso), entre comillas.' },
  recordatorio: { dice: 'abre con un recordatorio', guia: 'Algo que tu cliente sabe pero se olvida de hacer.' },
};

export type Estructura = {
  /** El tipo que se entendió; null = no encaja con ninguno (la pantalla pregunta). */
  tipo: IdTipoCarrusel | null;
  /** Las láminas de la referencia (de su fuente); null = no se sabe. */
  laminas: number | null;
  gancho: string | null;
  cierre: Cierre | null;
  /** De quién es («@cuenta» o su nombre) y el link a su publicación: van en las notas del diseño, no en el lienzo. */
  de: string;
  url: string | null;
};

/** La estructura de un carrusel del explorador, con lo que hay medido. */
export function estructuraDe(c: Pick<Carrusel, 'formato' | 'laminas' | 'texto' | 'creador' | 'url'> & { tipoGancho?: string | null; cierre?: Cierre | null }): Estructura {
  return {
    tipo: tipoDeFormato(c.formato),
    laminas: c.laminas,
    gancho: c.tipoGancho && GANCHOS[c.tipoGancho] ? c.tipoGancho : null,
    // El del explorador se calculó con el texto ENTERO (./explorar.ts); el texto que viaja al navegador va cortado.
    cierre: c.cierre !== undefined ? (esCierre(c.cierre) ? c.cierre : null) : cierreDeTexto(c.texto),
    de: c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre,
    url: c.url,
  };
}

/** Lo que se entendió, en frases cortas para la confirmación («Lista o tips», «7 láminas», «abre con una pregunta»…). */
export function frasesDe(e: Estructura): string[] {
  const t = e.tipo ? tipoCarrusel(e.tipo) : null;
  return [
    t ? t.nombre : 'Sin un tipo claro',
    e.laminas ? `${e.laminas} láminas` : 'Láminas: no se sabe',
    e.gancho ? GANCHOS[e.gancho].dice : null,
    e.cierre ? `cierra pidiendo ${QUE_PIDE[e.cierre]}` : null,
  ].filter((x): x is string => !!x);
}

/**
 * Las láminas del carrusel nuevo: la estructura del tipo con `n` láminas (las de la referencia si se saben, dentro del
 * rango del tipo), con la portada guiada por SU gancho y la última por SU cierre. Ninguna palabra de la referencia.
 */
export function laminasDesde(e: Estructura, tipoElegido: IdTipoCarrusel, laminasElegidas?: number | null): Lamina[] {
  const t = tipoCarrusel(tipoElegido) ?? TIPOS_CARRUSEL[0];
  const n = laminasDelTipo(t, laminasElegidas ?? e.laminas ?? undefined);
  const ls = t.estructura(n).map((l) => ({ ...l }));
  const g = e.gancho ? GANCHOS[e.gancho] : null;
  if (g && ls[0]) ls[0] = { ...ls[0], cuerpo: `${g.guia} (${e.de} ${g.dice}).` };
  const ultima = ls[ls.length - 1];
  if (e.cierre && ultima?.rol === 'cierre') ls[ls.length - 1] = { ...ultima, ...GUIA_CIERRE[e.cierre] };
  return ls;
}

/** Las notas de la primera página: de dónde salió la estructura (no salen en la imagen). */
export const notasDe = (e: Estructura): string =>
  `Estructura tomada de un carrusel de ${e.de}${e.url ? ` (${e.url})` : ''}. Las palabras son tuyas: no copies las suyas.`;

/**
 * Qué se va a crear: el tipo elegido (o el que se entendió) y sus láminas dentro del rango del tipo. Sin tipo (la
 * referencia no encaja con ninguno y no se eligió), un error que pide elegirlo: no se adivina.
 */
export function planDeReferencia(e: Estructura, tipoPedido?: unknown, laminasPedidas?: unknown): { tipo: TipoCarrusel; laminas: number } | { error: string } {
  const id = esTipoCarrusel(tipoPedido) ? tipoPedido : e.tipo;
  const t = id ? tipoCarrusel(id) : null;
  if (!t) return { error: `Elige qué tipo de carrusel quieres: el de ${e.de} no encaja con ninguno de MaKo.` };
  const pedidas = typeof laminasPedidas === 'number' && Number.isFinite(laminasPedidas) ? laminasPedidas : e.laminas ?? undefined;
  return { tipo: t, laminas: laminasDelTipo(t, pedidas) };
}
