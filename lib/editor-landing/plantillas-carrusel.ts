// =============================================================================
// editor-landing/plantillas-carrusel — el carrusel vertical 4:5 en el Web Generator
// =============================================================================
// Pedido de Leila, TRES veces (llamada del 5/11/2026, pedidos 2.14 / 3.9 / 4.10 de
// docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:66): «falta el formato vertical 4:5 en el
// Web Generator». Lo tenía que armar en el Image Editor —lento, emulando Canva— porque el
// rápido (este editor, el estilo Gamma) no ofrecía ese tamaño.
//
// La PROPORCIÓN 4:5 ya existía desde el 6/11 (`cd0f4811e`, api-tipos.ts y
// tests/editor-landing-carrusel-45.test.ts): una presentación de 4:5 es un carrusel. Lo que
// faltaba es OFRECERLA AL CREAR, con plantillas de carrusel: hasta acá, el único camino era
// crear una presentación 16:9 y cambiarle la relación de aspecto a mano en Configuración.
//
// ⚠️ NO DUPLICA NINGUNA PLANTILLA. La estructura lámina por lámina es la de MaKo, la de
//    lib/carruseles/tipos.ts (`TIPOS_CARRUSEL`: lista, paso a paso, historia, antes y después,
//    mito, opinión, caso, preguntas), la MISMA que usa el Image Editor. Acá sólo se traduce cada
//    lámina a una diapositiva de este editor; si mañana se suma un tipo allá, aparece acá solo
//    (el test lo exige contando).
//    Lo que NO se puede reusar es `documentoDeCarrusel` (lib/carruseles/documento.ts): ése arma
//    el documento del MOTOR del Image Editor (textbox/rect/ellipse en un lienzo de 1080 × 1350
//    px), y este editor es un documento de bloques. Dos representaciones de la misma estructura:
//    lo compartido es `TIPOS_CARRUSEL`, no el documento.
//
// Las reglas del copy son las de plantillas.ts y plantillas-presentaciones.ts, y acá salen
// gratis: los textos de la estructura de `TIPOS_CARRUSEL` ya son la GUÍA de qué va en cada
// lámina (decisión de Martín del 29/10: la plantilla muestra la estructura, el ejemplo lleno se
// ve aparte). Por eso esta conversión NUNCA toca el texto: ni corchetes nuevos, ni cifras, ni
// nombres. El ejemplo de cada tipo (`tipo.ejemplo`) se queda en el Image Editor: acá entraría
// como un dato de un negocio que no es el de quien mira.
// =============================================================================

import { nuevoId, docPagina, type LandingContenido, type Pagina } from './doc';
import { CONFIG_DEFAULT, type Proporcion } from './api-tipos';
import { TEMAS } from './temas';
import { bloquesATarjetas, type BloqueIA, type TarjetaIA } from './ia-bloques';
import { TIPOS_CARRUSEL, type Lamina, type TipoCarrusel } from '../carruseles/tipos';
import type { PlantillaPresentacion } from './plantillas-presentaciones';

/**
 * El tamaño de un carrusel de Instagram, el que pidió Leila (api-tipos.ts, `PROPORCIONES`).
 * El tipo es `Extract<…>` y no `Proporcion` a propósito: así queda el LITERAL (y si alguien saca
 * '4:5' de `PROPORCIONES`, esto no compila en vez de quedar en silencio).
 */
export const PROPORCION_CARRUSEL: Extract<Proporcion, '4:5'> = '4:5';

/**
 * Una plantilla de carrusel tiene la MISMA forma que una de presentación (la pantalla de crear
 * las dibuja con el mismo componente y el alta sale del mismo `pedidoDePlantilla`), con su
 * proporción en 4:5 en vez de 16:9.
 */
export type PlantillaCarrusel = PlantillaPresentacion & { proporcion: typeof PROPORCION_CARRUSEL };

const IDS_TEMA = new Set<string>(TEMAS.map((t) => t.id));
const temaDe = (...candidatos: string[]): string => candidatos.find((c) => IDS_TEMA.has(c)) ?? CONFIG_DEFAULT.tema;

/**
 * El tema de este editor que más se parece al estilo del tipo en el Image Editor
 * (`TipoCarrusel.estilo`: su fondo y su acento). A mano y con respaldo: los estilos de allá son
 * colores sueltos y los temas de acá son paletas con letra, así que no hay cómo derivar uno del
 * otro sin inventar. Si un id de tema cambia, cae al siguiente y al final a `pewter` (el default).
 */
const TEMA_POR_TIPO: Readonly<Record<string, readonly string[]>> = {
  lista: ['torch', 'canyon', 'pewter'],
  tutorial: ['sapphire', 'cornflower', 'pewter'],
  historia: ['espresso', 'mocha', 'pewter'],
  'antes-despues': ['malachite', 'mint', 'pewter'],
  mito: ['nightsky', 'eclipse', 'pewter'],
  opinion: ['ultraviolet', 'indigo', 'pewter'],
  caso: ['founder', 'anvil', 'pewter'],
  preguntas: ['cirrus', 'serene', 'pewter'],
};

const titulo = (texto: string): BloqueIA => ({ t: 'titulo', texto });
const h2 = (texto: string): BloqueIA => ({ t: 'h2', texto });
const p = (texto: string): BloqueIA => ({ t: 'p', texto });
const pg = (texto: string): BloqueIA => ({ t: 'p-grande', texto });
const ante = (texto: string): BloqueIA => ({ t: 'antetitulo', texto });

/**
 * Una lámina del carrusel como una diapositiva de este editor. Las tres que hay:
 *   · la PORTADA es el gancho: titular grande y la bajada, sin rótulo (nadie rotula la tapa);
 *   · el CIERRE es la acción, con el FONDO DE ACENTO: el carrusel de MaKo también termina con
 *     otro fondo (lib/carruseles/documento.ts, `fondoCierre`), y es lo que marca que ahí se pide
 *     algo;
 *   · las de ADENTRO llevan el rótulo arriba («Punto 2», «Paso 3»: el `rotulo` de la lámina, que
 *     allá es el nombre de la página), el titular y el texto.
 * Sin notas del orador a propósito: un carrusel se publica, no se presenta.
 */
export function tarjetaDeLamina(l: Lamina): TarjetaIA {
  if (l.rol === 'portada') return { bloques: [titulo(l.titulo), ...(l.cuerpo ? [pg(l.cuerpo)] : [])] };
  if (l.rol === 'cierre') return { fondo: 'acento', bloques: [h2(l.titulo), ...(l.cuerpo ? [pg(l.cuerpo)] : [])] };
  return { bloques: [ante(l.rotulo), h2(l.titulo), ...(l.cuerpo ? [p(l.cuerpo)] : [])] };
}

// Lo que la conversión corrigió o tiró (para el test: una plantilla bien armada no tiene
// NINGUNO). Igual que en plantillas-presentaciones.ts.
let colector: string[] | undefined;

/** Arma una plantilla y devuelve también lo que la conversión tuvo que corregir (para el test). */
export function armarCarrusel(pl: Pick<PlantillaCarrusel, 'contenido'>): { contenido: LandingContenido; descartes: string[] } {
  const previo = colector;
  const descartes: string[] = [];
  colector = descartes;
  try {
    return { contenido: pl.contenido(), descartes };
  } finally {
    colector = previo;
  }
}

/** El documento de un carrusel: UNA página, una diapositiva por lámina (como una presentación). */
function carrusel(laminas: readonly Lamina[]): LandingContenido {
  const tarjetas: TarjetaIA[] = laminas.map(tarjetaDeLamina);
  const pagina: Pagina = { id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: docPagina(bloquesATarjetas(tarjetas, { descartes: colector })) };
  return { v: 1, paginas: [pagina] };
}

/** La plantilla del Web Generator de un tipo de carrusel de MaKo, con sus láminas por default. */
function plantillaDe(t: TipoCarrusel): PlantillaCarrusel {
  return {
    // `carr-` adelante: el id viaja a `config.origen.plantilla` y no se puede cruzar con el de
    // una presentación (`pres-…`) ni con el del tipo en el Image Editor.
    id: `carr-${t.id}`,
    nombre: t.nombre,
    descripcion: t.cuando,
    // La categoría es la de la tarjeta de la pantalla de crear. Todas las de carrusel caen en
    // «Marketing»: es contenido para publicar, no un documento de negocio.
    categoria: 'Marketing',
    tema: temaDe(...(TEMA_POR_TIPO[t.id] ?? []), CONFIG_DEFAULT.tema),
    formato: 'presentacion',
    proporcion: PROPORCION_CARRUSEL,
    contenido: () => carrusel(t.estructura(t.laminas.def)),
  };
}

/** Las plantillas de carrusel, UNA por tipo de MaKo y en el mismo orden que allá. */
export const PLANTILLAS_CARRUSEL: readonly PlantillaCarrusel[] = TIPOS_CARRUSEL.map(plantillaDe);

export function plantillaCarruselPorId(id: string): PlantillaCarrusel | undefined {
  return PLANTILLAS_CARRUSEL.find((x) => x.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se le pega a la IA cuando el documento es un CARRUSEL (4:5). Reemplazan a las
// `REGLAS_DIAPOSITIVAS_*` de plantillas-presentaciones.ts, no se suman: una lámina de 4:5 entra
// la MITAD de lo que entra en una diapositiva 16:9 (43 em de ancho contra 64,5: `ANCHO_DIAPO_EM`),
// y lo que se lee en el teléfono con el pulgar no es lo que se proyecta en una pared.
// Viven acá y no en ia.ts porque ia.ts es server-only y ningún test lo puede importar; ia.ts las
// mete en los slots que ya existen (`{{ajustes}}`, `{{texto}}`), sin tocar los prompts editables.
// ─────────────────────────────────────────────────────────────────────────────

/** Para el ESQUEMA: qué es un carrusel y cómo se arma. */
export const REGLAS_CARRUSEL_ESQUEMA = [
  'FORMATO: es un CARRUSEL vertical para redes (4:5, el tamaño de Instagram), no una landing ni una presentación. Cada sección del esquema es UNA lámina que se ve en el teléfono.',
  '- La PRIMERA lámina es el gancho: se lee sola, en menos de dos segundos, y hace querer deslizar. Si no engancha, nadie ve el resto.',
  '- Una sola idea por lámina, y cortísima: en 4:5 entra la mitad que en una diapositiva. Un titular de hasta 8 palabras y una o dos líneas de texto.',
  '- Entre 5 y 10 láminas. La penúltima resume para quien llegó directo; la ÚLTIMA pide UNA sola acción (escribir una palabra, guardarlo, compartirlo).',
  '- Nada de tablas, gráficos, formularios ni columnas: no se leen en el teléfono.',
].join('\n');

/** Para las SECCIONES: cómo se escribe cada lámina. */
export const REGLAS_CARRUSEL_SECCIONES = [
  'Es un CARRUSEL vertical (4:5) para redes: cada sección es una lámina que se ve en el teléfono.',
  '- MUY poco texto: un titular de hasta 8 palabras y, como mucho, dos líneas debajo. Lo que no entra se parte en otra lámina.',
  '- La primera lámina es el gancho (titular grande y una bajada). La última pide UNA acción.',
  '- Las de adentro llevan un rótulo corto arriba («Punto 2», «Paso 3») para que se sepa dónde va.',
  '- Sin tablas, gráficos, formularios ni columnas. Una lista de viñetas cortas sí, con pocas palabras cada una.',
].join('\n');

/** Al EDITAR un carrusel que ya existe. */
export const REGLAS_CARRUSEL_EDITAR = 'Es un CARRUSEL vertical (4:5) para redes: cada sección es una lámina que se lee en el teléfono, con una sola idea, un titular de hasta 8 palabras y a lo sumo dos líneas de texto; lo que agregues tiene que entrar en la lámina (si no entra, pártelo en dos). Sin tablas ni gráficos.';
