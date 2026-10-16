// =============================================================================
// editor-landing/animaciones — el catálogo de animaciones de una landing (el CONTRATO)
// =============================================================================
// Pedido de Martín (14/10/2026), a «¿cuál de los dos frentes?»: «las dos cosas» — las animaciones de la
// página Y el video de fondo en loop, y poder replicarlas al copiar una web. Decidido el 15/10 (Estrategia,
// por la vara de AGENTS.md: lo que se contesta con lo escrito no va a la Ticketera):
//   · El panel se COPIA del de animaciones del Image Editor (app/image-editor/_doory/editor/panels/
//     AnimatePanel.tsx), que ya es la copia del de Canva, más la ayuda pública de Canva. Los nombres de los
//     efectos y de los estilos salen de app/image-editor/_doory/editor/animation/strings.ts, tal cual.
//   · DOS niveles: un ESTILO para toda la landing («Animación de página» del panel) y un EFECTO por sección
//     («Elemento» del panel, acá la sección). Nunca por bloque: «Editar con IA» rehace los bloques de una
//     sección y perdería el ajuste; la sección (su `attrs`) sobrevive.
//   · Cada efecto se reproduce solo al pasar el mouse por encima (la tile del panel, como AnimateThumb).
//   · El contenido es propio: con la licencia de Lottie y la de motionsites se copia el FORMATO, no la
//     colección (docs/hallazgos-editor-landing.md → «Animaciones»). Todo es CSS nuestro: GSAP queda fuera
//     por licencia (mismo documento).
//   · El video de fondo lo genera SÓLO MaKo, cuando el puente a Flow pueda («B», Martín, 15/10). Hoy no puede
//     (`VIDEO_FONDO`, abajo): el modelo y el render tienen su lugar; la pantalla no lo ofrece.
//
// Puro, sin 'use client' ni server-only: lo leen la hoja (css.ts), el render (especificacion.ts), el script
// de la publicada (pagina-publica.ts), el panel del editor, la API de MaKo y Replicar. Una cosa, un lugar: si
// un efecto cambia, cambia acá y le llega a los seis.
//
// LO QUE NO VA, a propósito: salidas y énfasis del Image Editor (una página no «sale», y un bloque que se
// mueve solo más de 5 s pide pausa por WCAG 2.2.2), transiciones de página (son de Presentar), y efectos
// atados al scroll (Firefox estable no los tiene; quedan para la etapa 4 de los hallazgos).
// =============================================================================

/**
 * El ancho del TELÉFONO: el corte del bloque «17. Tableta y celular» de la hoja (css.ts lo usa ahí). Lo comparten
 * la hoja (Enfoque cae a Desvanecer), el póster del video (`sizes`, especificacion.ts) y el script de la publicada
 * (el video vertical): si el corte cambia, cambia acá para los tres.
 */
export const CORTE_CELULAR = '(max-width: 768px)';

export const DIRECCIONES = ['izquierda', 'derecha', 'arriba', 'abajo'] as const;
export type Direccion = (typeof DIRECCIONES)[number];

/** Los grupos de la grilla, con los títulos del Image Editor (`panel.groups`). */
export const GRUPOS_EFECTO = [
  { id: 'basicas', nombre: 'Básicas' },
  { id: 'movimiento', nombre: 'Movimiento' },
  { id: 'revelar', nombre: 'Revelar' },
  { id: 'intensas', nombre: 'Intensas' },
] as const;
export type GrupoEfecto = (typeof GRUPOS_EFECTO)[number]['id'];

/**
 * Un efecto de ENTRADA de los bloques de una sección. `desde` es el estado de partida (el cuadro 0) en CSS;
 * el de llegada es el natural del bloque (la animación va con `backwards`, como la de Gamma que ya estaba).
 * Con direcciones, `desde` trae una variante por dirección y la primera de `direcciones` es la de default.
 * Sólo transform, opacity, clip-path y filter: nada que mueva el layout. `filter` (Enfoque) cae a
 * Desvanecer en el teléfono (`soloEscritorio`): la regla de los hallazgos es «sólo transform, opacity y
 * clip-path en el teléfono».
 */
export type DefEfecto = {
  id: string;
  nombre: string;
  grupo: GrupoEfecto;
  desde: string | Readonly<Partial<Record<Direccion, string>>>;
  direcciones?: readonly Direccion[];
  duracionMs: number;
  curva: string;
  /** Demora entre un bloque y el siguiente de la misma sección (la cascada). */
  escalonMs: number;
  soloEscritorio?: boolean;
};

const SALIDA = 'cubic-bezier(0.22, 1, 0.36, 1)';      // la de Gamma (y la de «Subir» de siempre)
const RESORTE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const REBOTE = 'cubic-bezier(0.68, -0.55, 0.27, 1.55)';
const SUAVE = 'cubic-bezier(0.45, 0, 0.55, 1)';

export const EFECTOS = [
  // ── Básicas ──
  { id: 'desvanecer', nombre: 'Desvanecer', grupo: 'basicas', desde: 'opacity: 0;', duracionMs: 700, curva: 'ease', escalonMs: 80 },
  // «Subir» es EXACTAMENTE la entrada de siempre (css.ts, bloque 16: translateY(20px), 1 s, la curva de Gamma,
  // 80 ms entre bloques): una landing que nunca eligió nada se ve igual que antes de este catálogo.
  { id: 'subir', nombre: 'Subir', grupo: 'basicas', desde: 'opacity: 0; transform: translateY(20px);', duracionMs: 1000, curva: SALIDA, escalonMs: 80 },
  { id: 'caer', nombre: 'Caer', grupo: 'basicas', desde: 'opacity: 0; transform: translateY(-20px);', duracionMs: 900, curva: SALIDA, escalonMs: 80 },
  { id: 'aparecer', nombre: 'Aparecer', grupo: 'basicas', desde: 'opacity: 0; transform: scale(0.85);', duracionMs: 550, curva: RESORTE, escalonMs: 70 },
  { id: 'crecer', nombre: 'Crecer', grupo: 'basicas', desde: 'opacity: 0; transform: scale(0.6);', duracionMs: 700, curva: SALIDA, escalonMs: 80 },
  { id: 'enfoque', nombre: 'Enfoque', grupo: 'basicas', desde: 'opacity: 0; filter: blur(12px); transform: scale(1.04);', duracionMs: 800, curva: SALIDA, escalonMs: 90, soloEscritorio: true },
  // ── Movimiento ──
  {
    id: 'deslizar', nombre: 'Deslizar', grupo: 'movimiento', duracionMs: 750, curva: SALIDA, escalonMs: 90,
    direcciones: ['izquierda', 'derecha', 'arriba', 'abajo'],
    desde: {
      izquierda: 'opacity: 0; transform: translateX(-48px);',
      derecha: 'opacity: 0; transform: translateX(48px);',
      arriba: 'opacity: 0; transform: translateY(-48px);',
      abajo: 'opacity: 0; transform: translateY(48px);',
    },
  },
  { id: 'rebote', nombre: 'Rebote', grupo: 'movimiento', desde: 'opacity: 0; transform: translateY(40px);', duracionMs: 900, curva: REBOTE, escalonMs: 90 },
  { id: 'deriva', nombre: 'Deriva', grupo: 'movimiento', desde: 'opacity: 0; transform: translate(-16px, 16px);', duracionMs: 1400, curva: SUAVE, escalonMs: 120 },
  // ── Revelar ──
  {
    id: 'barrido', nombre: 'Barrido', grupo: 'revelar', duracionMs: 800, curva: SALIDA, escalonMs: 100,
    direcciones: ['izquierda', 'derecha', 'arriba', 'abajo'],
    desde: {
      izquierda: 'clip-path: inset(0 100% 0 0);',
      derecha: 'clip-path: inset(0 0 0 100%);',
      arriba: 'clip-path: inset(0 0 100% 0);',
      abajo: 'clip-path: inset(100% 0 0 0);',
    },
  },
  { id: 'telon', nombre: 'Telón', grupo: 'revelar', desde: 'clip-path: inset(0 50% 0 50%);', duracionMs: 900, curva: SALIDA, escalonMs: 100 },
  { id: 'iris', nombre: 'Iris', grupo: 'revelar', desde: 'clip-path: circle(0% at 50% 50%);', duracionMs: 900, curva: SALIDA, escalonMs: 100 },
  { id: 'desplegar', nombre: 'Desplegar', grupo: 'revelar', desde: 'clip-path: inset(0 0 100% 0); transform: translateY(-8px);', duracionMs: 800, curva: SALIDA, escalonMs: 90 },
  // ── Intensas ──
  { id: 'voltear', nombre: 'Voltear', grupo: 'intensas', desde: 'opacity: 0; transform: perspective(800px) rotateX(-70deg);', duracionMs: 800, curva: SALIDA, escalonMs: 100 },
  { id: 'balanceo', nombre: 'Balanceo', grupo: 'intensas', desde: 'opacity: 0; transform: rotate(-8deg) translateY(12px);', duracionMs: 900, curva: RESORTE, escalonMs: 100 },
  { id: 'elastico', nombre: 'Elástico', grupo: 'intensas', desde: 'opacity: 0; transform: scale(0.4);', duracionMs: 1000, curva: REBOTE, escalonMs: 100 },
  { id: 'pisoton', nombre: 'Pisotón', grupo: 'intensas', desde: 'opacity: 0; transform: scale(1.4);', duracionMs: 500, curva: 'cubic-bezier(0.55, 0, 1, 0.45)', escalonMs: 90 },
] as const satisfies readonly DefEfecto[];

export type IdEfecto = (typeof EFECTOS)[number]['id'];
export const IDS_EFECTO: readonly IdEfecto[] = EFECTOS.map((e) => e.id);
const POR_ID: ReadonlyMap<string, DefEfecto> = new Map(EFECTOS.map((e) => [e.id, e as DefEfecto]));
export const efectoPorId = (id: string | null | undefined): DefEfecto | null => (id ? POR_ID.get(id) ?? null : null);
export const esEfecto = (v: unknown): v is IdEfecto => typeof v === 'string' && POR_ID.has(v);

/** «Ninguna»: la sección queda quieta aunque la landing tenga un estilo. */
export const SIN_ANIMACION = 'ninguna';
/** Lo que guarda una sección: un efecto, «ninguna», o null = hereda el estilo de la landing. */
export type AnimacionSeccion = IdEfecto | typeof SIN_ANIMACION | null;

// ─────────────────────────────────────────────────────────────────────────────
// El ESTILO de la landing («Animación de página»)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los estilos de página del Image Editor (`PAGE_STYLES` de animation/pageStyles.ts), con sus nombres. Uno le
 * da a cada sección que no eligió el suyo: su efecto, la dirección (o «alterna» izquierda/derecha sección por
 * sección), y si los TÍTULOS entran de a palabra o de a letra (los demás bloques, con `efecto`).
 */
export type DefEstilo = {
  id: string;
  nombre: string;
  efecto: IdEfecto;
  direccion?: Direccion | 'alterna';
  texto?: { por: 'palabra' | 'letra'; efecto: IdEfecto; escalonMs: number };
};

export const ESTILOS_PAGINA = [
  { id: 'desvanecer', nombre: 'Desvanecer', efecto: 'desvanecer' },
  { id: 'subir', nombre: 'Subir', efecto: 'subir' },
  { id: 'aparecer', nombre: 'Aparecer', efecto: 'aparecer' },
  { id: 'deslizar', nombre: 'Deslizar', efecto: 'deslizar', direccion: 'alterna' },
  { id: 'palabras', nombre: 'Palabras', efecto: 'desvanecer', texto: { por: 'palabra', efecto: 'subir', escalonMs: 90 } },
  { id: 'maquina', nombre: 'Máquina de escribir', efecto: 'desvanecer', texto: { por: 'letra', efecto: 'desvanecer', escalonMs: 35 } },
  { id: 'barrido', nombre: 'Barrido', efecto: 'barrido', direccion: 'izquierda' },
  { id: 'enfoque', nombre: 'Enfoque', efecto: 'enfoque' },
] as const satisfies readonly DefEstilo[];

export type IdEstilo = (typeof ESTILOS_PAGINA)[number]['id'];
export const IDS_ESTILO: readonly IdEstilo[] = ESTILOS_PAGINA.map((e) => e.id);
/** El de siempre: el que tenía toda landing antes de este catálogo (la entrada de Gamma). */
export const ESTILO_DEFAULT: IdEstilo = 'subir';
const ESTILO_POR_ID: ReadonlyMap<string, DefEstilo> = new Map(ESTILOS_PAGINA.map((e) => [e.id, e as DefEstilo]));
export const estiloPorId = (id: string | null | undefined): DefEstilo => ESTILO_POR_ID.get(id ?? '') ?? (ESTILO_POR_ID.get(ESTILO_DEFAULT) as DefEstilo);
export const esEstilo = (v: unknown): v is IdEstilo => typeof v === 'string' && ESTILO_POR_ID.has(v);

// ─────────────────────────────────────────────────────────────────────────────
// Saneo (lo usan validar.ts y la API: un valor que no está en el catálogo no se guarda)
// ─────────────────────────────────────────────────────────────────────────────

export function sanearAnimacionSeccion(v: unknown): AnimacionSeccion {
  if (v === SIN_ANIMACION) return SIN_ANIMACION;
  return esEfecto(v) ? v : null;
}

/** La dirección vale sólo si el efecto la ofrece; si no, null (y se usa la de default del efecto). */
export function sanearDireccion(v: unknown, efecto: AnimacionSeccion): Direccion | null {
  const def = efectoPorId(efecto);
  if (!def?.direcciones || typeof v !== 'string') return null;
  return (def.direcciones as readonly string[]).includes(v) ? (v as Direccion) : null;
}

export const sanearEstilo = (v: unknown): IdEstilo => (esEstilo(v) ? v : ESTILO_DEFAULT);

/**
 * Lo que se escribe en una sección al ELEGIR un efecto (el panel «Animar» y la API de MaKo, una sola regla): el efecto
 * saneado y, si el efecto nuevo ofrece dirección, la que la sección ya tenía (de Deslizar a Barrido sigue «desde
 * abajo»); si no la ofrece, o es «ninguna» o «hereda», la dirección se cae.
 */
export function cambiosAlElegir(elegido: unknown, actual: { animacionDireccion?: unknown }): { animacion: AnimacionSeccion; animacionDireccion: Direccion | null } {
  const animacion = sanearAnimacionSeccion(elegido);
  const conDireccion = animacion !== null && animacion !== SIN_ANIMACION;
  return { animacion, animacionDireccion: conDireccion ? sanearDireccion(actual.animacionDireccion, animacion) : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que anima una sección (lo resuelve el RENDER, no el navegador)
// ─────────────────────────────────────────────────────────────────────────────

export type AnimacionResuelta = {
  /** null = la sección no se anima («ninguna», o el interruptor de la landing apagado). */
  efecto: IdEfecto | null;
  direccion: Direccion | null;
  /** Los títulos entran de a palabra o letra (sólo si el efecto vino del estilo de la landing). */
  texto: DefEstilo['texto'] | null;
  /** true = la sección eligió el suyo; false = lo heredó del estilo de la landing. */
  propio: boolean;
};

/**
 * El efecto que se le dibuja a la sección `indice` (0 = la primera de la página; el orden de las secciones
 * VISIBLES, el mismo que ve quien entra). Con «alterna», las pares entran desde la izquierda y las impares
 * desde la derecha (el `direction: 'alternate'` del Image Editor, que alterna objeto por objeto).
 */
export function animacionDeSeccion(
  seccion: { animacion?: unknown; animacionDireccion?: unknown },
  pagina: { animaciones: boolean; estiloAnimacion?: unknown },
  indice: number,
): AnimacionResuelta {
  const nada: AnimacionResuelta = { efecto: null, direccion: null, texto: null, propio: false };
  if (!pagina.animaciones) return nada;
  const propia = sanearAnimacionSeccion(seccion.animacion);
  if (propia === SIN_ANIMACION) return { ...nada, propio: true };
  if (propia) {
    const def = efectoPorId(propia) as DefEfecto;
    return { efecto: propia, direccion: sanearDireccion(seccion.animacionDireccion, propia) ?? def.direcciones?.[0] ?? null, texto: null, propio: true };
  }
  const estilo = estiloPorId(sanearEstilo(pagina.estiloAnimacion));
  const def = efectoPorId(estilo.efecto) as DefEfecto;
  const direccion = estilo.direccion === 'alterna'
    ? (indice % 2 === 0 ? 'izquierda' : 'derecha')
    : estilo.direccion ?? def.direcciones?.[0] ?? null;
  return { efecto: estilo.efecto, direccion, texto: estilo.texto ?? null, propio: false };
}

/**
 * Los `data-*` que la sección lleva en el DOM (`.gm-tarjeta`), en la publicada y en el editor: los lee la hoja
 * (css.ts, bloque 16) y el script de la publicada (pagina-publica.ts). `data-anim` = el efecto o «ninguna»;
 * sin `data-anim` (el interruptor apagado, o HTML de antes de este catálogo) la sección sigue con las reglas de
 * siempre. `data-anim-dir` sólo va con un efecto que ofrece direcciones; `data-anim-texto` sólo si los títulos
 * entran de a palabra o de a letra. Una sola función para el render y el NodeView: no hay dos copias del nombre.
 */
export type DatosAnimacion = { 'data-anim'?: string; 'data-anim-dir'?: string; 'data-anim-texto'?: string };
export function datosDeAnimacion(r: AnimacionResuelta | null | undefined): DatosAnimacion {
  if (!r) return {};
  if (!r.efecto) return r.propio ? { 'data-anim': SIN_ANIMACION } : {};
  const def = efectoPorId(r.efecto) as DefEfecto;
  const out: DatosAnimacion = { 'data-anim': r.efecto };
  if (def.direcciones?.length) out['data-anim-dir'] = r.direccion && def.direcciones.includes(r.direccion) ? r.direccion : def.direcciones[0];
  if (r.texto) out['data-anim-texto'] = r.texto.por;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja: los keyframes y el shorthand de cada efecto (UNA fuente para la publicada, el editor y las tiles)
// ─────────────────────────────────────────────────────────────────────────────

/** `gm-e-<efecto>` o `gm-e-<efecto>-<direccion>`: el nombre del @keyframes. */
export function nombreKeyframes(efecto: IdEfecto, direccion?: Direccion | null): string {
  const def = efectoPorId(efecto) as DefEfecto;
  if (typeof def.desde === 'string') return `gm-e-${efecto}`;
  const dirs = def.direcciones ?? [];
  const d = direccion && dirs.includes(direccion) ? direccion : dirs[0];
  return `gm-e-${efecto}-${d}`;
}

/** Todos los @keyframes del catálogo, en una cadena (van UNA vez en la hoja que los use). */
export function keyframesAnimaciones(): string {
  const out: string[] = [];
  for (const e of EFECTOS as readonly DefEfecto[]) {
    if (typeof e.desde === 'string') out.push(`@keyframes gm-e-${e.id} { from { ${e.desde} } }`);
    else for (const d of e.direcciones ?? []) out.push(`@keyframes gm-e-${e.id}-${d} { from { ${e.desde[d]} } }`);
  }
  return out.join('\n');
}

/**
 * El valor de `animation` del bloque `n` (0 = el primero) de una sección con este efecto. `demoraBaseMs` es la
 * de la sección (0,15 s en la de Gamma: la sección aparece y sus bloques suben en cascada).
 */
export function animacionCss(efecto: IdEfecto, direccion: Direccion | null, n = 0, demoraBaseMs = 150): string {
  const def = efectoPorId(efecto) as DefEfecto;
  const demora = demoraBaseMs + Math.min(n, 8) * def.escalonMs;
  return `${nombreKeyframes(efecto, direccion)} ${def.duracionMs}ms ${def.curva} ${demora}ms backwards`;
}

/** Cuánto dura la entrada entera de una sección de `bloques` bloques (para repetir una tile o el ▶). */
export function duracionTotalMs(efecto: IdEfecto, bloques = 1, demoraBaseMs = 150): number {
  const def = efectoPorId(efecto) as DefEfecto;
  return demoraBaseMs + Math.min(Math.max(bloques, 1) - 1, 8) * def.escalonMs + def.duracionMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// El video de fondo (el lugar previsto)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El video de fondo de una sección con el diseño «fondo» (el hero). Lo genera SÓLO MaKo por el puente a Flow
 * (Martín, 15/10: «B · Sólo generado por MaKo, cuando el puente pueda»; el modelo de Flow lo elige el usuario).
 * Calidad decidida con lo medido: 1280×720 en escritorio y 480×854 en el teléfono, H.264, ≤ 8 s, sin audio,
 * menos de 5 MB, con póster WebP (el póster es el LCP). URLs del bucket `landing-imagenes`, nunca de afuera.
 * `posterMovil` (agregado el 15/10 con el render, paquete A): el póster VERTICAL del video del teléfono. El póster
 * es el primer cuadro del video y el LCP: con el video vertical, el horizontal recortado no calza con su primer
 * cuadro (se ve un salto al arrancar) y pesa 3-4 veces más (37-42 KB a 480 vertical contra 143-167 KB a 1080p,
 * medido). Opcional: sin él, el teléfono usa `poster` recortado.
 */
export type VideoFondo = { src: string; srcMovil: string | null; poster: string; posterMovil?: string | null };

/**
 * Si la pantalla puede OFRECER el video de fondo. Hoy no: el puente a Flow genera clips pero MaKo no lee su
 * resultado (la respuesta posicional de BOQ y el sondeo de estado), y un hero con cuadro inicial y final es una
 * operación nueva que nadie enseñó todavía (hallazgos-editor-landing.md → «El puente a Flow HOY no puede hacer
 * un hero»). Cuando pueda, esto pasa a true y aparece el control; el modelo, el saneo y el render ya están.
 */
export const VIDEO_FONDO = {
  disponible: false,
  motivo: 'El puente a Flow todavía no devuelve el video generado a MaKo.',
} as const;
