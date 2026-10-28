// =============================================================================
// editor-landing/replicar-partes — QUÉ se replica de una landing de afuera: diseño, estructura, ángulos y texto
// =============================================================================
// Pedido de Martín (28/10/2026), textual: «es muy importante que al momento de replicar una landing se defina qué se
// quiere replicar, porque en mi caso, por ejemplo, yo tengo definido un estilo de diseño de landing y las quiero más o
// menos seguir. Pero sin embargo, lo que sí quiero replicar son los ángulos de comunicación, los dolores, la forma de
// venta, la cantidad de párrafos, los títulos, cómo está acomodado, etcétera. Entonces, una cosa es replicar el
// branding, otra cosa es replicar la estructura, otra cosa es replicar los ángulos de comunicación, los copies».
//
// Cuatro PARTES que se combinan (lo puro, con test: tests/web-generator-replicar-partes.test.ts):
//   · diseno      — sus colores, sus fuentes, sus imágenes y sus animaciones (un tema propio «Estilo de <sitio>»).
//                   Sin él, la réplica nace con el tema que elige la persona (el suyo);
//   · estructura  — sus secciones en su orden, con la misma cantidad de títulos, párrafos, viñetas y botones;
//   · angulos     — cómo vende: la promesa, los dolores, la forma de venta, las objeciones y la prueba de cada sección;
//   · texto       — lo que dice, palabra por palabra. Trae la estructura y los ángulos adentro (`alternarParte`).
// El caso de Martín (el default, `PARTES_INICIALES`): estructura + ángulos, con SU diseño y el texto escrito de nuevo
// para SU oferta. «Replicar y adaptar» (27/10, Leila) es diseño + estructura + ángulos; «tal cual», las cuatro.
//
// Cómo arma cada combinación (`recetaDePartes`; lo que baja, llama a la IA y crea vive en replicar.ts):
//   · con estructura: el esquema es el de la página (`esquemaDeReplica`, «Conservar»: sus secciones, en su orden);
//     sin el texto, la tanda de secciones lo escribe de nuevo (`generar`) con el MOLDE de cada sección y los ángulos;
//   · sin estructura: el esquema lo arma la IA para la oferta del negocio (`generar`), con los ángulos si se pidieron;
//   · con texto: «Conservar» en las dos tandas (la copia de siempre).
// =============================================================================

import type { ParamsGeneracion } from './api-tipos';
import type { FormatoReplicar } from './replicar-reglas';

export const PARTES_REPLICA = ['diseno', 'estructura', 'angulos', 'texto'] as const;
export type ParteReplica = (typeof PARTES_REPLICA)[number];
export type PartesReplica = Readonly<Record<ParteReplica, boolean>>;

/** Lo que dice la pantalla de cada parte: el nombre del botón y la línea de abajo (corta). */
export const NOMBRE_PARTE: Record<ParteReplica, { nombre: string; detalle: string; icono: string }> = {
  diseno: { nombre: 'Diseño', detalle: 'Colores, fuentes e imágenes', icono: 'paleta' },
  estructura: { nombre: 'Estructura', detalle: 'Secciones, títulos y párrafos', icono: 'paginas' },
  angulos: { nombre: 'Ángulos', detalle: 'Dolores, promesa y forma de venta', icono: 'objetivo' },
  texto: { nombre: 'Texto literal', detalle: 'Lo que dice, palabra por palabra', icono: 'copiar' },
};

/** El caso de Martín: la estructura y los ángulos de la otra, con el diseño propio y el texto de la oferta propia. */
export const PARTES_INICIALES: PartesReplica = { diseno: false, estructura: true, angulos: true, texto: false };
/** La copia de siempre («Replica esta landing» antes del 28/10, la API sin `partes`): todo. */
export const PARTES_TODAS: PartesReplica = { diseno: true, estructura: true, angulos: true, texto: true };
/** «Replicar y adaptar» (27/10/2026): el diseño y la estructura de afuera, con el texto de la oferta del negocio. */
export const PARTES_ADAPTAR: PartesReplica = { diseno: true, estructura: true, angulos: true, texto: false };

/**
 * Prender o apagar una parte, con sus dependencias: el TEXTO literal trae la estructura y los ángulos adentro (copiar
 * las palabras es copiar cómo vende y cómo está armado), así que prenderlo los prende y apagar cualquiera de los dos lo
 * apaga. Nunca deja las cuatro apagadas: apagar la última no hace nada.
 */
export function alternarParte(p: PartesReplica, parte: ParteReplica): PartesReplica {
  const prendida = !p[parte];
  let sig: Record<ParteReplica, boolean> = { ...p, [parte]: prendida };
  if (parte === 'texto' && prendida) sig = { ...sig, estructura: true, angulos: true };
  if ((parte === 'estructura' || parte === 'angulos') && !prendida) sig.texto = false;
  return algunaParte(sig) ? sig : p;
}

export const algunaParte = (p: PartesReplica): boolean => PARTES_REPLICA.some((k) => p[k]);
export const mismasPartes = (a: PartesReplica, b: PartesReplica): boolean => PARTES_REPLICA.every((k) => a[k] === b[k]);

/**
 * Las partes de un pedido, sin forma confiable. Un pedido SIN `partes` (la pantalla de antes del 28/10, el Diagnóstico,
 * la API de MaKo vieja) es lo de siempre: `adaptar` → diseño + estructura + ángulos; si no, las cuatro. Las
 * dependencias se aplican igual (texto sin estructura no existe). null si vino `partes` y no dice ninguna.
 */
export function partesDePedido(raw: unknown, adaptar = false): PartesReplica | null {
  if (raw === undefined || raw === null) return adaptar ? PARTES_ADAPTAR : PARTES_TODAS;
  let lista: unknown[] | null = null;
  if (Array.isArray(raw)) lista = raw;
  else if (typeof raw === 'object') lista = PARTES_REPLICA.filter((k) => (raw as Record<string, unknown>)[k] === true);
  else if (typeof raw === 'string') lista = raw.split(/[\s,]+/);
  if (!lista) return null;
  const si = new Set(lista.map((x) => String(x).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')));
  const p: Record<ParteReplica, boolean> = { diseno: si.has('diseno'), estructura: si.has('estructura'), angulos: si.has('angulos'), texto: si.has('texto') };
  if (p.texto) { p.estructura = true; p.angulos = true; }
  return algunaParte(p) ? p : null;
}

export const listaDePartes = (p: PartesReplica): ParteReplica[] => PARTES_REPLICA.filter((k) => p[k]);

/**
 * ¿Se puede este formato con estas partes? La «Página web» (la copia idéntica, el HTML de la original) es TODO: su
 * diseño, su estructura y su texto. Con cualquier parte apagada va «Landing» o «Presentación».
 */
export const formatoConPartes = (f: FormatoReplicar, p: PartesReplica): boolean => f !== 'web' || (p.diseno && p.estructura && p.texto);
/** El error de pedir la copia idéntica con algo apagado (la pantalla ofrece «Landing» con `probar`). */
export const ERROR_WEB_PARCIAL = 'La copia idéntica copia todo: para elegir qué replicar, usa «Landing».';

/**
 * El nombre de la copia en el Panel: con el texto, el título de la original (es la misma página); sin él ya no es la
 * de la original y no lleva su nombre («Adaptada de 100ads.ai» desde el 27/10, «Basada en …» desde el 28/10).
 */
export function nombreDeCopia(p: PartesReplica, host: string, tituloOriginal: string): string {
  if (p.texto) return tituloOriginal;
  return p.diseno && p.estructura ? `Adaptada de ${host}` : `Basada en ${host}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que lee la IA
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que nunca pasa de la referencia a la copia cuando el texto se escribe de nuevo (la regla de «adaptar»). */
const NADA_PROPIO = 'De la referencia no pasa nada propio: ni su marca, ni sus nombres, ni sus testimonios, ni sus cifras, ni sus precios, ni sus garantías. Si a una sección le falta un dato que el negocio no dio, escribe entre corchetes qué falta: "[testimonio real de un cliente]".';

/** El tope de `instrucciones` en ia.ts (MAX_INSTRUCCIONES). La instrucción entera tiene que entrar: un corte se llevaría datos. */
export const TOPE_INSTRUCCION = 5_000;

/**
 * La instrucción de la réplica para la IA, según las partes (null con el texto literal: ahí no se escribe nada).
 * `molde`: la forma de cada sección de la original (`textoDeMolde`); `angulos`: cómo vende (`textoDeAngulos`). Va en
 * `instrucciones`, envuelta como contenido no confiable por ia.ts: los ángulos y el molde salen de la página de un
 * TERCERO. Las REGLAS van primero y los datos al final: si algo no entra en `TOPE_INSTRUCCION`, se recortan los datos,
 * nunca la regla de no copiar.
 */
export function instruccionDePartes(p: PartesReplica, extra: { molde?: string; angulos?: string } = {}): string | null {
  if (p.texto) return null;
  const reglas: string[] = [
    p.estructura
      ? 'REPLICAR UNA LANDING DE REFERENCIA PARA ESTE NEGOCIO. El esquema es la página de OTRO negocio.'
      : 'ARMAR UNA LANDING PARA ESTE NEGOCIO tomando cosas de una landing de referencia de OTRO negocio.',
    p.estructura
      ? 'ESTRUCTURA (se toma): las mismas secciones, en el mismo orden y con el mismo tipo de bloque. En cada sección, la misma cantidad de títulos, subtítulos, párrafos, viñetas, botones y preguntas que la de la referencia, con un largo parecido y el mismo acomodo (si la referencia tiene tres tarjetas con un título y dos renglones cada una, la copia también; si tiene una imagen, la copia deja su hueco). Cada sección pedida trae su «Molde de la referencia».'
      : 'ESTRUCTURA (no se toma): elige las secciones y su orden para vender la oferta de ESTE negocio.',
    p.angulos
      ? (p.estructura
        ? 'ÁNGULOS (se toman): en cada sección, el mismo ángulo que la de la referencia (el de su molde): el mismo dolor, el mismo deseo, la misma promesa, la misma forma de vender, la misma objeción respondida y el mismo tipo de prueba, trasladados a la oferta de ESTE negocio.'
        : 'ÁNGULOS (se toman): usa los ángulos de comunicación de la referencia (abajo): su promesa, sus dolores, su forma de vender, las objeciones que responde y el tipo de prueba, trasladados a la oferta de ESTE negocio.')
      : (p.estructura
        ? 'ÁNGULOS (no se toman): de la referencia usa SOLO la forma. Lo que dice cada sección (los dolores, la promesa, los argumentos, las objeciones, la prueba) sale del contexto de ESTE negocio.'
        : 'ÁNGULOS (no se toman): los dolores, la promesa y los argumentos salen del contexto de ESTE negocio.'),
    `TEXTO (no se toma): no copies frases de la referencia; escribe el texto de nuevo para la oferta de ESTE negocio, según su contexto: su producto, su promesa, su audiencia, su precio y su llamado a la acción. ${NADA_PROPIO}`,
  ];
  const datos = [
    p.estructura && extra.molde ? `MOLDE de la referencia, sección por sección:\n${extra.molde}` : '',
    p.angulos && extra.angulos ? `ÁNGULOS de la referencia:\n${extra.angulos}` : '',
  ].filter(Boolean);
  const texto = [...reglas, ...datos].join('\n\n');
  return texto.length > TOPE_INSTRUCCION ? `${texto.slice(0, TOPE_INSTRUCCION - 1)}…` : texto;
}

/** El pedido del esquema cuando la estructura NO se toma (la IA arma las secciones para la oferta del negocio). */
export const PEDIDO_SIN_ESTRUCTURA = 'Una landing de venta para la oferta principal de este negocio, según su contexto.';

/**
 * Lo que la réplica le pide a la IA, por partes (el resto de la receta, el formato y la configuración, sale de
 * `configDeReplica`). `esquema`: cómo se arma el esquema; `paramsEsquema` / `paramsSecciones`: lo que va en cada tanda.
 */
export type RecetaDePartes = {
  esquema: 'pagina' | 'generar';
  paramsEsquema: Partial<ParamsGeneracion>;
  paramsSecciones: Partial<ParamsGeneracion>;
  /** Copiar el estilo de la original (tema, imágenes y animaciones). */
  copiaDiseno: boolean;
};

/**
 * La receta por partes, PURA. `base`: los parámetros del formato (`configDeReplica(...).params`): Landing conserva,
 * Presentación condensa. `instruccion`: la de `instruccionDePartes` para cada tanda (la del esquema va sin el molde,
 * que sale del esquema; null con el texto literal).
 *   · con el texto literal: lo de siempre (Landing conserva; Presentación condensa);
 *   · Landing con estructura: el esquema es el de la página (conservado) y las secciones se escriben de nuevo;
 *   · Presentación con estructura: la IA arma las diapositivas de la página escribiendo de nuevo;
 *   · sin estructura: la IA arma el esquema para la oferta (Landing o Presentación), con la instrucción en las dos.
 */
export function recetaDePartes(
  formato: FormatoReplicar,
  base: Partial<ParamsGeneracion>,
  p: PartesReplica,
  instruccion: { esquema: string | null; secciones: string | null } = { esquema: null, secciones: null },
): RecetaDePartes {
  const escribir = (x: Partial<ParamsGeneracion>, i: string | null): Partial<ParamsGeneracion> => ({ ...x, modoTexto: 'generar', ...(i ? { instrucciones: i } : {}) });
  if (p.texto) return { esquema: 'pagina', paramsEsquema: base, paramsSecciones: base, copiaDiseno: p.diseno };
  if (!p.estructura) {
    return { esquema: 'generar', paramsEsquema: escribir(base, instruccion.esquema), paramsSecciones: escribir(base, instruccion.secciones), copiaDiseno: p.diseno };
  }
  if (formato === 'presentacion') {
    return { esquema: 'pagina', paramsEsquema: escribir(base, instruccion.esquema), paramsSecciones: escribir(base, instruccion.secciones), copiaDiseno: p.diseno };
  }
  return { esquema: 'pagina', paramsEsquema: base, paramsSecciones: escribir(base, instruccion.secciones), copiaDiseno: p.diseno };
}
