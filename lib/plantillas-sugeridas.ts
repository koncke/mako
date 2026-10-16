// =============================================================================
// plantillas-sugeridas — las plantillas que le sirven a ESTE negocio, primero, con un «Sugerido» sutil
// =============================================================================
// Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se posicionen los sugeridos para
// el negocio, que MaKo lo tome de lo analizado de su offer, de su funnel... Y que tenga un texto sutil de "Sugerido"».
//
// UN módulo para todas las galerías: el Dashboard y General primero; Automations, Web Generator, Video Editor, Image
// Editor y el CRM después. Cómo se enchufa una galería (una función y una tabla de etiquetas): docs/plantillas-sugeridas.md.
//
// Lo que gobierna, y no se ve en las firmas:
//   · SIN IA AL ABRIR LA GALERÍA. Las señales salen de lo GUARDADO, con reglas (`senalesDe`, y la lectura en
//     lib/plantillas-sugeridas-server.ts): el canal y las entradas de los funnels, el diagnóstico de fase (el cuello de
//     botella y el canal, el que también contesta el dueño en Offer) y cómo cobra (sus ofertas y sus productos). El
//     server las lee en paralelo con lo demás de la página y la pantalla ordena con `ordenarConSugeridas`, pura: la
//     galería abre al instante y no salta.
//   · SÓLO LO QUE EL DUEÑO DIJO. Las entradas de un funnel cuentan si está DECLARADO (la migración le creó uno sin
//     declarar a cada negocio, y sugerir sobre eso sería afirmar algo que nunca dijo: la regla de `filaAFunnel`,
//     lib/funnel-fila.ts). Sin ninguna señal, el orden de siempre y ningún «Sugerido».
//   · POCAS: hasta `MAX_SUGERIDAS`. Si la mitad de la galería dice «Sugerido», no dice nada.
//   · EL RUBRO NO ENTRA: lo que el onboarding guarda de él es texto libre, y compararlo pediría IA.
//   · Entre las que empatan manda el orden de la galería, que ya es el curado (lo más importante primero).
//
// Puro y sin `server-only`: lo leen las galerías en el navegador, el server, la API de MaKo y los tests.
// =============================================================================

import { FASES, esCanal, type CanalId, type CuelloId } from './fase-diagnostico';
import type { EntradaId } from './pipeline';

/** Cómo cobra el negocio. */
export type Cobro = 'unico' | 'suscripcion';

/** Lo que se sabe del negocio para sugerir: sólo lo declarado. Un eje vacío es «no se sabe», nunca «no». */
export type SenalesNegocio = {
  /** Cómo cierra la venta (los funnels y el diagnóstico de fase). */
  canales: CanalId[];
  /** Por dónde le entran los leads (los funnels declarados). */
  entradas: EntradaId[];
  /** Cómo cobra (sus ofertas y sus productos activos). */
  cobros: Cobro[];
  /** El cuello de botella del diagnóstico de fase. */
  cuello: CuelloId | null;
};

/** Para qué negocio es una plantilla. Lo que no se dice no suma ni resta. `{}` = no se sugiere nunca. */
export type EtiquetasPlantilla = {
  canal?: readonly CanalId[];
  entrada?: readonly EntradaId[];
  cobro?: readonly Cobro[];
  cuello?: readonly CuelloId[];
};

/** Cuántas se sugieren como mucho. Con «Hoja en blanco» primera, son la primera fila de la galería. */
export const MAX_SUGERIDAS = 3;

/** Lo que pesa cada coincidencia: cómo vende es lo que más dice de un negocio. */
const PESO = { canal: 3, entrada: 2, cobro: 2, cuello: 2 } as const;
type Eje = keyof typeof PESO;
/** Los ejes del más pesado al más liviano: el porqué sale del primero que coincide. */
const EJES: readonly Eje[] = ['canal', 'entrada', 'cobro', 'cuello'];

/** El porqué, en pocas palabras (va al `title` de la tarjeta y a la API de MaKo; en la tarjeta se lee «Sugerido»). */
export const PORQUE: {
  canal: Record<CanalId, string>; entrada: Record<EntradaId, string>; cobro: Record<Cobro, string>; cuello: Record<CuelloId, string>;
} = {
  canal: {
    llamadas: 'Vendes por llamada', conversaciones: 'Vendes por chat', carrito: 'Vendes con checkout',
    webinar: 'Vendes en webinars', presencial: 'Cierras en persona',
  },
  entrada: {
    formulario_anuncio: 'Tus leads vienen de anuncios', landing: 'Tus leads llegan por tu página',
    agenda_sola: 'Te agendan solos', chat_entrante: 'Te escriben por chat', chat_saliente: 'Prospectas por chat',
    carrito: 'Te compran en tu página',
  },
  cobro: { unico: 'Cobras un pago único', suscripcion: 'Cobras una suscripción' },
  cuello: {
    oferta: 'Tu cuello: la oferta', conversion: 'Tu cuello: la conversión', sistema: 'Tu cuello: el sistema',
    delegacion: 'Tu cuello: delegar', foco: 'Tu cuello: el foco',
  },
};

const CUELLOS: readonly CuelloId[] = [...new Set(FASES.map((f) => f.cuello))];
const esCuello = (v: unknown): v is CuelloId => CUELLOS.includes(v as CuelloId);
const esCobro = (v: unknown): v is Cobro => v === 'unico' || v === 'suscripcion';
const sinRepetir = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** ¿Hay algo de qué agarrarse? Sin señales no se sugiere nada. */
export const haySenales = (s: SenalesNegocio | null | undefined): s is SenalesNegocio =>
  !!s && (s.canales.length > 0 || s.entradas.length > 0 || s.cobros.length > 0 || s.cuello != null);

/**
 * Las señales, de lo que se leyó. Puro: la lectura vive en lib/plantillas-sugeridas-server.ts. `null` = nada declarado.
 *   · un funnel: su canal si es uno de los cinco; sus entradas SÓLO si está declarado (ya pasadas por `parseEntradas`).
 *   · el diagnóstico de fase: su canal y su cuello, si son del catálogo.
 *   · las ofertas activas: su `modelo`, si lo dicen (es opcional y nace vacío).
 *   · los productos activos: SÓLO una suscripción. ⚠️ `tipo: 'unico'` lo pone el código al crear un funnel
 *     (lib/producto-con-funnel.ts) y al sembrar el producto del onboarding (`seedProductosDesdeOferta`): no es algo
 *     que el dueño eligió, y con él todo negocio «cobraría un pago único».
 */
export function senalesDe(p: {
  funnels: ReadonlyArray<{ canal: string | null; declarado: boolean; entradas: readonly EntradaId[] }>;
  fase: { canal?: unknown; cuello?: unknown } | null;
  ofertas: ReadonlyArray<{ modelo?: unknown }>;
  productos: ReadonlyArray<{ tipo?: unknown }>;
}): SenalesNegocio | null {
  const canales: CanalId[] = [];
  const entradas: EntradaId[] = [];
  for (const f of p.funnels) {
    if (esCanal(f.canal)) canales.push(f.canal);
    if (f.declarado) entradas.push(...f.entradas);
  }
  const faseCanal = p.fase?.canal;
  const faseCuello = p.fase?.cuello;
  if (esCanal(faseCanal)) canales.push(faseCanal);
  const cobros = [...p.ofertas.map((o) => o.modelo), ...p.productos.map((x) => x.tipo).filter((t) => t === 'suscripcion')].filter(esCobro);
  const s: SenalesNegocio = {
    canales: sinRepetir(canales), entradas: sinRepetir(entradas), cobros: sinRepetir(cobros),
    cuello: esCuello(faseCuello) ? faseCuello : null,
  };
  return haySenales(s) ? s : null;
}

const valoresDe = (s: SenalesNegocio, eje: Eje): readonly string[] =>
  eje === 'canal' ? s.canales : eje === 'entrada' ? s.entradas : eje === 'cobro' ? s.cobros : s.cuello ? [s.cuello] : [];

/** Lo que una plantilla tiene del negocio: el puntaje y el porqué (el del eje más pesado que coincide). */
function coincidencia(e: EtiquetasPlantilla | undefined, s: SenalesNegocio): { puntaje: number; porque: string | null } {
  let puntaje = 0;
  let porque: string | null = null;
  for (const eje of EJES) {
    const pide = (e?.[eje] ?? []) as readonly string[];
    const tiene = valoresDe(s, eje);
    const valor = pide.find((v) => tiene.includes(v));
    if (valor == null) continue;
    puntaje += PESO[eje];
    porque ??= (PORQUE[eje] as Record<string, string>)[valor] ?? null;
  }
  return { puntaje, porque };
}

/** Una plantilla de la galería, con su porqué si va sugerida (null = el lugar de siempre). */
export type ConSugerencia<T> = { plantilla: T; porque: string | null };

/**
 * LA FUNCIÓN DE LAS GALERÍAS. Las sugeridas primero (hasta `MAX_SUGERIDAS`, de más a menos coincidencias y, empatadas,
 * en el orden de la galería), y después las demás en el orden de siempre. Sin señales, la lista tal cual y sin porqué.
 * ⚠️ Se ordena la galería ENTERA y después se filtra lo que se busca (`plantilla` conserva el orden): ordenar lo
 * filtrado convertiría en «Sugerido» a la cuarta cuando la búsqueda deja afuera a las tres primeras.
 */
export function ordenarConSugeridas<T extends { id: string }>(
  plantillas: readonly T[],
  etiquetas: Readonly<Record<string, EtiquetasPlantilla>>,
  senales: SenalesNegocio | null | undefined,
): ConSugerencia<T>[] {
  if (!haySenales(senales)) return plantillas.map((plantilla) => ({ plantilla, porque: null }));
  const elegidas = plantillas
    .map((plantilla, i) => ({ plantilla, i, ...coincidencia(etiquetas[plantilla.id], senales) }))
    .filter((x) => x.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje || a.i - b.i)
    .slice(0, MAX_SUGERIDAS);
  const ids = new Set(elegidas.map((x) => x.plantilla.id));
  return [
    ...elegidas.map(({ plantilla, porque }) => ({ plantilla, porque })),
    ...plantillas.filter((p) => !ids.has(p.id)).map((plantilla) => ({ plantilla, porque: null })),
  ];
}
