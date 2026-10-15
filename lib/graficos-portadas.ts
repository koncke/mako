// =============================================================================
// graficos-portadas — la PORTADA de cada plantilla: UNA pieza a lo ancho, con la forma de su objetivo y su color
// =============================================================================
// Martín, 14/10/2026: «A simple vista se tienen que diferenciar MUY bien de qué es cada template… que se note el objetivo
// del template con un vistazo… evita que al principio tenga muchos textos, muchos números… Luego abajo puede tener más
// cosas», y «Y nuevamente muchos gráficos juntos parece dashboard... el cuadrado que se llega a ver, sea muy épico... el
// bloque de anuncios, podría justamente traer la preview de algunos ads ganadores». Copiado de las portadas de informe de
// la galería de Canva (lib/graficos-identidad.ts cuenta qué se copió y de dónde).
//
// QUÉ ES UNA PORTADA: la primera pieza de la hoja, 12 columnas × `ALTO_PORTADA` filas, pintada con el color de la
// plantilla (`portada`, lib/graficos-identidad.ts). Es lo que se ve en la miniatura de la galería (la miniatura ES la hoja
// en chico: app/dashboard/MiniaturaHoja.tsx) y lo primero que se ve al abrirla. Cada una tiene OTRA FORMA según lo que esa
// hoja viene a contestar —un número, una barra partida, pósters de anuncios, la página con el calor, una curva, un reloj,
// columnas, personas, una matriz, trapecios, un anillo—: el color nunca es lo único que las distingue.
//
// DE DÓNDE SALE: una pieza que la plantilla YA tenía (`sube`: se saca de su lugar, se le cambia lo que diga `cambios` y
// va arriba) o una NUEVA (`nueva`), siempre de un tipo y unos datos del catálogo. No inventa un cálculo.
//
// EL HUECO: lo que la portada deja al irse (`cerrarHueco`): si estaba en una fila de números, sus vecinos se reparten el
// ancho; si estaba sola en sus filas, lo de abajo sube. Después todo baja `ALTO_PORTADA`. Reemplaza al titular 6 × 6 del
// 14/10 (`conTitular`): con la portada arriba, un segundo protagonista abajo le compite.
//
// ⚠️ LOS IDS de lo que ya existía NO cambian (`sube` mueve la MISMA pieza): la hoja del closer se lee en memoria con los ids
//    de la plantilla, y la caja de IA de la cuenta se busca por (hoja, elemento) — ver lib/graficos-plantillas-analysts.ts.
// ⚠️ Puro y sin server-only. SIN DATOS DE NINGÚN CLIENTE: los títulos son frases genéricas.
// =============================================================================

import { COLOR_DASHBOARD } from './graficos-identidad';

type Crudo = Record<string, unknown>;
type Id = (local: string) => string;

/** El alto de la portada (filas de la grilla): casi toda la miniatura de la galería (16:10) y medio escritorio. */
export const ALTO_PORTADA = 11;
const COLS = 12;

/** La portada de una plantilla: una pieza que ya tenía (`sube`, por su id local) o una nueva. */
export type DefinicionPortada =
  | { sube: string; cambios?: Crudo }
  | { nueva: (id: Id) => Crudo };

/** ¿Este id (con el prefijo que le pone `armar`) es el local `local`? */
const esLocal = (id: unknown, local: string) => typeof id === 'string' && (id === local || id.endsWith(`-${local}`) || id.endsWith(local));
const num = (v: unknown) => Number(v) || 0;
const esNumero = (c: Crudo) => c.clase === 'grafico' && (c.tipo === 'numero' || c.tipo === 'numero_compacto' || c.tipo === 'numero_tendencia');

/**
 * Cierra el hueco de una pieza que se fue. En una FILA (piezas con el mismo `y` y el mismo `h`), los que quedan se reparten
 * las 12 columnas en su orden; si no, se compacta para arriba (lo mismo que hace la grilla del editor: react-grid-layout
 * compacta en vertical).
 */
export function cerrarHueco(comps: readonly Crudo[], ido: Crudo): Crudo[] {
  const y = num(ido.y); const h = num(ido.h);
  const fila = comps.filter((c) => num(c.y) === y && num(c.h) === h);
  const ocupaLaFila = comps.filter((c) => num(c.y) < y + h && num(c.y) + num(c.h) > y);
  let out = comps.map((c) => ({ ...c }));
  if (fila.length && fila.length === ocupaLaFila.length && fila.every((c) => esNumero(c) === esNumero(fila[0]))) {
    // Una fila pareja (los números de arriba, dos gráficos de media hoja): los que quedan llenan el ancho.
    const orden = [...fila].sort((a, b) => num(a.x) - num(b.x));
    const w = Math.floor(COLS / orden.length);
    const extra = COLS - w * orden.length;
    let x = 0;
    const lugar = new Map(orden.map((c, i) => { const ancho = w + (i < extra ? 1 : 0); const l = { x, w: ancho }; x += ancho; return [c.id, l] as const; }));
    out = out.map((c) => (lugar.has(c.id) ? { ...c, ...lugar.get(c.id)! } : c));
  } else {
    // Al lado de la que se fue (dentro de sus filas): los de su derecha se estiran a la izquierda y, si no hay, los de su
    // izquierda a la derecha. Sin esto queda un hueco a lo ancho que la compactación vertical no llena.
    const adentro = (c: Crudo) => num(c.y) >= y && num(c.y) + num(c.h) <= y + h;
    const derecha = out.filter((c) => adentro(c) && num(c.x) === num(ido.x) + num(ido.w));
    const izquierda = out.filter((c) => adentro(c) && num(c.x) + num(c.w) === num(ido.x));
    if (derecha.length) out = out.map((c) => (derecha.includes(c) ? { ...c, x: num(ido.x), w: num(c.w) + num(ido.w) } : c));
    else if (izquierda.length) out = out.map((c) => (izquierda.includes(c) ? { ...c, w: num(c.w) + num(ido.w) } : c));
  }
  return compactar(out);
}

/**
 * Cada pieza sube hasta donde no pisa a otra (en el orden de la hoja): sin huecos verticales.
 * ⚠️ POR POSICIÓN, no por id: una plantilla puede traer dos piezas con el mismo id local antes del saneo (la de «Funnel
 *    de llamadas» tiene la sección «cierre» y el número «cierre»), y un mapa por id les daba el mismo lugar.
 */
export function compactar(comps: readonly Crudo[]): Crudo[] {
  const orden = comps.map((c, i) => ({ c, i })).sort((a, b) => num(a.c.y) - num(b.c.y) || num(a.c.x) - num(b.c.x));
  const puestas: Crudo[] = [];
  const ys = new Array<number>(comps.length);
  const pisa = (a: Crudo, y: number) => puestas.some((b) => num(a.x) < num(b.x) + num(b.w) && num(b.x) < num(a.x) + num(a.w) && y < num(b.y) + num(b.h) && num(b.y) < y + num(a.h));
  for (const { c, i } of orden) {
    let y = num(c.y);
    while (y > 0 && !pisa(c, y - 1)) y--;
    puestas.push({ ...c, y });
    ys[i] = y;
  }
  return comps.map((c, i) => ({ ...c, y: ys[i] }));
}

/**
 * La hoja con su portada arriba. Pura sobre los componentes CRUDOS (antes del saneo), así vale para las plantillas
 * escritas a mano y para las que arma `acomodar`. Sin definición, la hoja tal cual.
 */
export function conPortada(hoja: Crudo, def: DefinicionPortada | undefined, color: string | undefined, id: Id): Crudo {
  const comps = Array.isArray(hoja.componentes) ? (hoja.componentes as Crudo[]) : [];
  if (!def || !color) return hoja;
  let resto = comps;
  let pieza: Crudo;
  if ('sube' in def) {
    const vieja = comps.find((c) => esLocal(c.id, def.sube));
    if (!vieja) return hoja;
    resto = cerrarHueco(comps.filter((c) => c !== vieja), vieja);
    pieza = { ...vieja, subtitulo: '', ...(def.cambios ?? {}) };
  } else {
    pieza = def.nueva(id);
  }
  return {
    ...hoja,
    componentes: [
      { ...pieza, x: 0, y: 0, w: COLS, h: ALTO_PORTADA, portada: color },
      ...resto.map((c) => ({ ...c, y: num(c.y) + ALTO_PORTADA })),
    ],
  };
}

/** El pop-up del anuncio, para las tarjetas de anuncios de una portada (lo arma lib/graficos-plantillas-analysts.ts). */
type PopupDe = (id: Id, base: string) => Crudo;

/**
 * Las portadas del Dashboard, por plantilla. Lo que contesta cada una:
 *   · Marketing — ¿cuánto me cuesta un cliente? El CAC solo, gigante.
 *   · Comercial — ¿cuánto entró y cuánto falta? La barra cobrado / pendiente.
 *   · Ads Analyst — ¿qué anuncio funciona? Los ganadores como pósters, con su miniatura de Meta.
 *   · Landing — ¿qué miran y qué tocan? El mapa de calor: la página con el calor encima.
 *   · VSL Analyst — ¿dónde se van del video? La curva de retención.
 *   · Chat Analyst — ¿respondo rápido? El % respondido en 15 minutos, como un reloj.
 *   · Closing — ¿cuántas llamadas se ganan? R1 → R2 → ganadas, en columnas.
 *   · CS Analyst — ¿a quién atiendo? Las personas que piden atención.
 *   · Productividad — ¿cómo van mis proyectos? El avance de cada proyecto activo (la matriz, abajo: pide proyectos evaluados).
 *   · CRM — ¿dónde se me caen los leads? El embudo del lead al cierre.
 *   · Cobranza — ¿a quién le cobro? La lista con «Marcar cobrada».
 *   · Automatizaciones — ¿me contestan? Enviados → abiertos → respondieron.
 *   · Contenido e IA — ¿en qué se va la IA? El anillo con el costo en el centro.
 */
export function portadasDashboard(popupAnuncio: PopupDe): Readonly<Record<string, DefinicionPortada>> {
  return {
    marketing: { sube: 'mk-cac', cambios: { titulo: 'Cada cliente te cuesta', comparar: true } },
    comercial: { sube: 'co-revenue-barra', cambios: { titulo: 'Lo que entró y lo que falta cobrar' } },
    'ads-analyst': {
      nueva: (id) => ({
        // Los GUIONES de la hoja (no el conjunto de Meta): traen su miniatura y respetan los filtros de ángulo y tipo de la hoja.
        id: id('ad-portada'), clase: 'grafico', tipo: 'tarjetas', fuente: 'guiones', dimension: 'guion', metricas: ['agendas', 'cpa'],
        ordenMetrica: 'agendas', barra: 'agendas', limite: 4, titulo: 'Tus anuncios ganadores',
        alClic: 'popup', popup: popupAnuncio(id, 'ad-portada'),
      }),
    },
    landing: { sube: 'la-mapa-mapa', cambios: { titulo: 'Qué miran y qué tocan' } },
    'vsl-analyst': { sube: 'vs-curva', cambios: { titulo: 'Dónde se van del video' } },
    'chat-analyst': { sube: 'ch-rapidos', cambios: { tipo: 'indicador', maximo: 100, titulo: 'Respondes en 15 minutos' } },
    closing: { sube: 'cl-embudo-embudo', cambios: { tipo: 'embudo_columnas', titulo: 'Cuántas llamadas se ganan' } },
    'cs-analyst': {
      nueva: (id) => ({
        id: id('cs-portada'), clase: 'grafico', tipo: 'tarjetas', fuente: 'cartera', dimension: 'cliente', metricas: ['atencion', 'deuda_vencida_usd', 'sesiones'],
        ordenMetrica: 'atencion', barra: 'deuda_vencida_usd', limite: 4, tabla: { columnas: ['senal', 'tramo_contacto'] }, titulo: 'Quién te necesita hoy',
      }),
    },
    // El avance de cada proyecto activo, no la matriz: la matriz sólo dibuja los proyectos EVALUADOS (impacto y esfuerzo), y
    // en producción (ws1, 15/10) no había ninguno: la portada era un bloque vacío. La matriz sigue abajo.
    productividad: { sube: 'pr-avance-proyecto', cambios: { titulo: 'Cómo van tus proyectos', limite: 8 } },
    crm: { sube: 'embudo', cambios: { titulo: 'Dónde se caen tus leads' } },
    cobranza: { sube: 'a-quien', cambios: { titulo: 'A quién cobrarle', limite: 6 } },
    automatizaciones: {
      nueva: (id) => ({
        id: id('automatizaciones-portada'), clase: 'grafico', tipo: 'embudo_barras', fuente: 'envios', metricas: ['envios', 'abiertos', 'respuestas'],
        titulo: '¿Te contestan?',
      }),
    },
    'ia-contenido': {
      nueva: (id) => ({
        id: id('ia-contenido-portada'), clase: 'grafico', tipo: 'anillo', fuente: 'ia', dimension: 'funcion', metricas: ['costo'],
        ordenMetrica: 'costo', limite: 6, titulo: 'En qué se va la IA',
      }),
    },
  };
}

/** El color de la portada de una plantilla del Dashboard. */
export const colorDashboard = (plantilla: string): string | undefined => COLOR_DASHBOARD[plantilla];
