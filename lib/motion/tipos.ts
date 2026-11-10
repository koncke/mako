// =============================================================================
// motion/tipos — el contrato del motor de motion graphics
// =============================================================================
// Un motion graphic es un `MotionSpec`: la plantilla y los valores de sus campos (textos, colores, tono). Es PLANO a
// propósito: el Video Editor lo guarda como los parámetros de un elemento `graphic` (params del motor de OpenCut), la
// landing como los atributos de un nodo, y la IA y la API escriben lo mismo. Nada más viaja.
//
// De un spec sale UNA escena (`armarEscena`, ./escena.ts): capas con su caja y su coreografía (cuándo entra cada pedazo,
// con qué efecto y qué curva). La escena la dibujan dos: el lienzo en cualquier tiempo t (./canvas.ts, el Video Editor y
// las miniaturas) y el HTML con CSS de la landing (./html.ts). Los dos leen los MISMOS tiempos y las mismas curvas.
//
// Unidades: x y los anchos son fracciones del ANCHO de la caja; y y los altos, fracciones del ALTO; los tamaños de letra,
// fracciones del ancho (en el CSS, `cqw`). Así una escena vale a cualquier resolución.
//
// Las recetas de todo lib/motion salen de las skills de motion graphics de iart.ai (MIT, Copyright (c) 2026 iart.ai,
// github.com/iart-ai/motion-skills): la licencia entera viaja en ./LICENSE-IART.
// =============================================================================

import type { Curva } from './curvas';

export const PLANTILLAS_MOTION = ['titular', 'palabras', 'cifra', 'tercio', 'logo', 'barras', 'testimonio', 'oferta', 'cierre'] as const;
export type IdPlantilla = (typeof PLANTILLAS_MOTION)[number];

export const TONOS_MOTION = ['premium', 'corporativo', 'energico', 'jugueton'] as const;
export type Tono = (typeof TONOS_MOTION)[number];

export type ValorCampo = string | number | boolean;
export type ValoresMotion = Record<string, ValorCampo>;

export type MotionSpec = { plantilla: IdPlantilla; valores: ValoresMotion };

export type CampoMotion =
  | { clave: string; tipo: 'texto'; rotulo: string; max: number; porDefecto: string; obligatorio?: boolean; ayuda?: string }
  | { clave: string; tipo: 'numero'; rotulo: string; min: number; max: number; paso: number; porDefecto: number; ayuda?: string }
  | { clave: string; tipo: 'color'; rotulo: string; porDefecto: string }
  | { clave: string; tipo: 'opcion'; rotulo: string; opciones: ReadonlyArray<{ valor: string; rotulo: string }>; porDefecto: string }
  | { clave: string; tipo: 'si-no'; rotulo: string; porDefecto: boolean };

/** Lo que hace un pedazo de una capa al entrar (y, al revés, al salir). */
export const EFECTOS = [
  'aparecer', 'subir', 'deslizar', 'caer', 'escalar', 'desenfoque', 'barrido', 'crecer-x', 'crecer-y', 'girar', 'rodar',
] as const;
export type Efecto = (typeof EFECTOS)[number];

/** Un tramo de la coreografía: desde `t0` (ms), cada pedazo i arranca en `t0 + i·paso` y dura `dur`. */
export type Tramo = { efecto: Efecto; t0: number; dur: number; curva: Curva; paso: number };

/** Un latido: después de entrar, la capa crece a `escala` y vuelve, `veces` veces (WCAG 2.2.2: nada se mueve solo > 5 s). */
export type Latido = { t0: number; periodo: number; veces: number; escala: number };

type BaseCapa = {
  id: string;
  entra: Tramo;
  /** Sólo en un clip de video: en la landing el bloque queda quieto en su estado final. */
  sale?: Tramo;
  latido?: Latido;
  /** Opacidad fija (la bajada un poco más tenue que el título). */
  tinta?: number;
};

export type Alineacion = 'izquierda' | 'centro' | 'derecha';
export type Partir = 'linea' | 'palabra' | 'letra';

export type CapaTexto = BaseCapa & {
  k: 'texto';
  lineas: string[];
  x: number;
  y: number;
  ancho: number;
  alinear: Alineacion;
  /** Tamaño de la letra, fracción del ancho de la caja. */
  tam: number;
  peso: number;
  color: string;
  familia: string;
  mayus: boolean;
  /** Espacio entre letras, en em. */
  tracking: number;
  interlineado: number;
  partir: Partir;
  cursiva?: boolean;
  tachado?: boolean;
  /** Recorte fijo por la derecha (0 a 1): las estrellas de una calificación de 4,5 muestran el 90 %. */
  corte?: number;
};

export type CapaCaja = BaseCapa & {
  k: 'caja';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Radio de las esquinas, fracción del ALTO de la caja (0,5 = píldora). */
  radio: number;
};

/** Una estrella de N puntas (un sello de descuento) o, con 0 puntas, un círculo. */
export type CapaForma = BaseCapa & {
  k: 'forma';
  cx: number;
  cy: number;
  /** Radio, fracción del ancho. */
  r: number;
  puntas: number;
  interior: number;
  color: string;
};

/** Una cifra que rueda como un odómetro: cada dígito es una columna que gira hasta su valor. */
export type CapaCifra = Omit<CapaTexto, 'k' | 'lineas' | 'partir'> & {
  k: 'cifra';
  /** El texto final partido: un dígito rueda; lo demás (signo, separadores) queda fijo. */
  partes: Array<{ d: number } | { s: string }>;
};

export type Capa = CapaTexto | CapaCaja | CapaForma | CapaCifra;

export type Escena = {
  /** Ancho / alto. */
  aspecto: number;
  durMs: number;
  /** Color del fondo, o null si es transparente (un tercio inferior sobre el video, una sección con su propio fondo). */
  fondo: string | null;
  capas: Capa[];
  /** El texto entero, en orden de lectura: el `aria-label` de la landing. */
  texto: string;
};
