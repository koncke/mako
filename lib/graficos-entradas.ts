// =============================================================================
// graficos-entradas — la ANIMACIÓN DE ENTRADA de una hoja, elegida en «Estilo de la hoja» (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «quiero que las animaciones de entrada sean configurables en "Personalización" en la edición, para seleccionar
// la animación de entrada, con todas las que tenemos». Hasta ese día cada hoja copiada traía la suya pegada a su diseño (la de
// Halden en Closing, la de Kestrel en Marketing…) y las demás hojas no tenían ninguna. Desde que cada tarjeta es un bloque de la
// grilla (lib/disenos-partes.ts), la entrada es de la HOJA: la grilla la corre sobre sus tarjetas, en el orden en que se leen.
//
// «Todas las que tenemos» son las MEDIDAS de cada demo copiado (sus INFORME, docs/diseno/mockups-dashboard/demos/<demo>/, y los
// valores escritos en el encabezado de cada app/dashboard/disenos/Hoja<X>.tsx): cada una se llama por lo que hace y dice de qué
// hoja viene. No se inventa ninguna: las que no tienen su receta medida (Selvar, Orvel, Moorly, Corvane) no están.
//
// ⚠️ SIN `server-only`: lo leen el saneo (lib/graficos-catalogo.ts), el panel y la grilla.
// ⚠️ EL ID ES UNA CLAVE que guardan las hojas (`Hoja.entrada`): no se renombra.
// ⚠️ CON «REDUCIR MOVIMIENTO» DEL SISTEMA NO CORRE NINGUNA: lo mira quien anima (`correrEntrada`), no el catálogo.
// =============================================================================

/** Las curvas de GSAP de los demos, traducidas (las de docs/diseno/mockups-dashboard/movimiento.css). */
const P3O = 'cubic-bezier(.215,.61,.355,1)';
const EXPO = 'cubic-bezier(.16,1,.3,1)';
const BACK = 'cubic-bezier(.34,1.56,.64,1)';
const SUAVE = 'cubic-bezier(.25,.46,.45,.94)';

export type EntradaHoja = {
  id: string;
  /** Lo que hace, en pocas palabras (es lo que se lee en el panel). */
  nombre: string;
  /** La hoja copiada de la que viene (null = la de siempre). */
  de: string | null;
  /** Cómo arranca cada tarjeta (el «desde» de un Element.animate); termina como está. */
  desde: Keyframe;
  /** Una tarjeta sí y otra no, el giro al revés (la de Lumora). */
  alternar?: Keyframe;
  duracion: number;
  curva: string;
  /** La escalera entre una tarjeta y la siguiente, y la demora de la primera (ms). */
  escalon: number;
  demora: number;
};

export const ENTRADAS: readonly EntradaHoja[] = [
  { id: 'ninguna', nombre: 'Sin animación', de: null, desde: {}, duracion: 0, curva: 'linear', escalon: 0, demora: 0 },
  { id: 'fundido', nombre: 'Aparecen', de: null, desde: { opacity: 0 }, duracion: 600, curva: SUAVE, escalon: 50, demora: 50 },
  // Halden (Closing) y Coffer (Cobranza): «oo», opacity, y 36, scale .985 · .85 s power3.out · .06, desde .1.
  { id: 'suben', nombre: 'Suben escalonadas', de: 'Closing', desde: { opacity: 0, transform: 'translateY(36px) scale(.985)' }, duracion: 850, curva: P3O, escalon: 60, demora: 100 },
  // Kestrel (Marketing): y 22, escala .985, .85 s, cada .07.
  { id: 'suben-suave', nombre: 'Suben suaves', de: 'Marketing', desde: { opacity: 0, transform: 'translateY(22px) scale(.985)' }, duracion: 850, curva: P3O, escalon: 70, demora: 0 },
  // Parley (Chat Analyst): y 28, escala .985, .8 s power3.out, cada .08.
  { id: 'se-asientan', nombre: 'Suben y se asientan', de: 'Chat Analyst', desde: { opacity: 0, transform: 'translateY(28px) scale(.985)' }, duracion: 800, curva: P3O, escalon: 80, demora: 0 },
  // Corbel (Landing): y 26, escala .985, .9 s expo.out, cada .07.
  { id: 'suben-lentas', nombre: 'Suben lentas', de: 'Landing', desde: { opacity: 0, transform: 'translateY(26px) scale(.985)' }, duracion: 900, curva: EXPO, escalon: 70, demora: 0 },
  // Torque (Inmobiliaria): 34 px con escala .985 (.9 s, power3.out, cada .07).
  { id: 'suben-largo', nombre: 'Suben desde más abajo', de: 'Inmobiliaria', desde: { opacity: 0, transform: 'translateY(34px) scale(.985)' }, duracion: 900, curva: P3O, escalon: 70, demora: 0 },
  // Pelago (VSL y YouTube): suben desde 16 px (.7 s, desde .25 s, cada .06).
  { id: 'suben-cerca', nombre: 'Suben poco', de: 'VSL y YouTube', desde: { opacity: 0, transform: 'translateY(16px)' }, duracion: 700, curva: P3O, escalon: 60, demora: 250 },
  // Vitrea (Curso o comunidad): se descubren desde 22 px, .975 y un recorte de abajo (.75 s, expo.out, 60 ms, desde .2 s).
  { id: 'se-descubren', nombre: 'Se descubren desde abajo', de: 'Curso o comunidad', desde: { transform: 'translateY(22px) scale(.975)', clipPath: 'inset(30% 0 0 0 round 22px)' }, duracion: 750, curva: EXPO, escalon: 60, demora: 200 },
  // Pane (Focus): suben con su recorte (.9 s expo).
  { id: 'recorte', nombre: 'Suben con su recorte', de: 'Focus', desde: { transform: 'translateY(26px) scale(.97)', clipPath: 'inset(40% 0 0 0 round 26px)' }, duracion: 900, curva: EXPO, escalon: 70, demora: 100 },
  // Sunrow (Agencia o servicio): la tarjeta oscura entra desde 30 px a la derecha y .97 (.8 s); las demás suben 30 px (.9 s, 70 ms).
  { id: 'de-costado', nombre: 'Entran de costado', de: 'Agencia o servicio', desde: { opacity: 0, transform: 'translateX(30px) scale(.97)' }, duracion: 800, curva: P3O, escalon: 70, demora: 0 },
  // Lumora (Mi día): y 40, giro de ±3°, escala .94 · .8 s back.out(1.4) · .06.
  { id: 'giran', nombre: 'Giran al entrar', de: 'Mi día', desde: { opacity: 0, transform: 'translateY(40px) rotate(-3deg) scale(.94)' }, alternar: { opacity: 0, transform: 'translateY(40px) rotate(3deg) scale(.94)' }, duracion: 800, curva: BACK, escalon: 60, demora: 0 },
  // Noria (Automatizaciones): las tarjetas suben 18 px (.8 s power3.out, desde .18 s, cada .06).
  { id: 'suben-18', nombre: 'Suben un poco', de: 'Automatizaciones', desde: { opacity: 0, transform: 'translateY(18px)' }, duracion: 800, curva: P3O, escalon: 60, demora: 180 },
];

export type IdEntrada = string;
export const ENTRADA_SIN = 'ninguna';

export const entradaDe = (id: string | null | undefined): EntradaHoja | undefined => ENTRADAS.find((e) => e.id === id);

/** La entrada que trae cada diseño copiado (la de su demo, o la más parecida medida). Una hoja sin diseño: ninguna. */
const DE_DISENO: Readonly<Record<string, IdEntrada>> = {
  closing: 'suben', cobranza: 'suben', marketing: 'suben-suave', chat: 'se-asientan', landing: 'suben-lentas', inmobiliaria: 'suben-largo',
  vsl: 'suben-cerca', curso: 'se-descubren', foco: 'recorte', servicio: 'de-costado', 'mi-dia': 'giran',
  // Noria y Ondra suben 18 px (≈ Kestrel); Mender .6-.7 s (≈ Kestrel); Fernly y Orrery, sus títulos (las tarjetas, como Halden).
  // Ondra (Hooks) sube 18 px como Noria; Mender (CS) 16 px como Pelago; Fernly (Productividad) 36 px con .985 como Halden; Murmura
  // (Instagram) 34 px con .985 como Torque; Prism (Anuncio ganador) 16 px como Pelago.
  automatizaciones: 'suben-18', hooks: 'suben-18', cs: 'suben-cerca', productividad: 'suben', instagram: 'suben-largo', anuncio: 'suben-cerca',
  contenido: 'suben',
  // Las que no tienen la entrada de su página medida (el chunk que el INFORME no muestra) quedaban quietas: siguen quietas.
  comercial: 'ninguna', general: 'ninguna', operacion: 'ninguna', 'cold-calling': 'ninguna',
  // Tend (10/11/2026): la entrada de la cabecera está medida (la `R` de la librería: el título letra por letra) y la dibuja su tarjeta;
  // la de las tarjetas de «Today» vive en su chunk, que el INFORME no muestra.
  velocidad: 'ninguna',
};

/** La entrada que se usa: la elegida, o la de su diseño, o ninguna. */
export function entradaEfectiva(h: { entrada?: string | null; diseno?: { id: string } | null }): EntradaHoja {
  return entradaDe(h.entrada) ?? entradaDe(h.diseno ? DE_DISENO[h.diseno.id] : null) ?? ENTRADAS[0];
}

/** Lo que se guarda: un id del catálogo, o nada (= la de su diseño). */
export function sanearEntrada(raw: unknown): IdEntrada | null {
  return typeof raw === 'string' && entradaDe(raw) ? raw : null;
}

/**
 * Corre la entrada sobre `nodos`, en el orden dado. No hace nada con «reducir movimiento» del sistema ni con «Sin animación».
 * Devuelve las animaciones (para cancelarlas si se vuelve a correr).
 */
export function correrEntrada(nodos: readonly Element[], e: EntradaHoja): Animation[] {
  if (!e.duracion || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return [];
  return nodos.map((n, i) => (n as HTMLElement).animate?.([i % 2 && e.alternar ? e.alternar : e.desde, {}], {
    duration: e.duracion, easing: e.curva, delay: e.demora + i * e.escalon, fill: 'backwards',
  })).filter((a): a is Animation => !!a);
}
