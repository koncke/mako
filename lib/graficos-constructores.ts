// =============================================================================
// graficos-constructores — las piezas con que se declara un conjunto de datos del Dashboard
// =============================================================================
// Separado del catálogo para que un conjunto se pueda declarar en OTRO archivo (las fuentes de las
// tabs de Analysts, lib/graficos-fuentes-extra.ts) sin que ese archivo importe el catálogo y arme un
// ciclo. Puro y sin `server-only`.

export type Formato = 'numero' | 'usd' | 'pct' | 'veces' | 'segundos';
export type ClaseDim = 'tiempo' | 'categoria';

export type Dimension = {
  id: string; nombre: string; clase: ClaseDim;
  /** Los tramos tienen su propio orden (la edad de Meta: '18-24' … '65+'): se ordenan por la etiqueta y no
   *  por la métrica. Ordenada por impresiones, la edad salía 45-54, 55-64, 18-24 y no se leía como edad. */
  ordenEtiqueta?: true;
  /**
   * El ORDEN FIJO de los valores (v5, 12/10/2026): las bandas de prioridad van Alta, Media, Baja, A futuro,
   * no por la métrica ni por el alfabeto. Un valor de la lista sin filas sale EN CERO (la banda vacía es un
   * dato); uno que aparece y no está en la lista va DESPUÉS, en el orden de siempre (no se tira). Lo
   * aplica el agregador (lib/graficos-agregar.ts).
   */
  valores?: readonly string[];
  /** El color de cada valor, como TOKEN de la casa (`'var(--bad)'`): se da vuelta en oscuro. Lo que no está, con la paleta. */
  colores?: Readonly<Record<string, string>>;
};
/**
 * Una métrica es una SUMA de lo que aporta cada fila, una cuenta de valores DISTINTOS (las
 * personas, no las visitas), o una RAZÓN entre dos sumas. Una razón NUNCA se promedia fila por
 * fila: se divide lo sumado del grupo (el CTR de una campaña es sus clics ÷ sus impresiones).
 */
export type Metrica = {
  id: string; nombre: string; formato: Formato;
  distinto?: true;
  /**
   * `minimo` (v5): con un denominador MENOR que esto, la razón no se da como número —se dibuja «X de Y» o
   * «—»—. Un promedio de 2 casos se lee como un dato firme (el SCL y el ratio de cierre de la tab vieja
   * decían «X de Y» con menos de 3).
   */
  razon?: { num: string; den: string; factor: number; minimo?: number };
  /** No se suma entre filas (el ALCANCE: la misma persona está en dos plataformas). El total va vacío. */
  sinTotal?: true;
  /** v5: MENOS es mejor (un costo, el no-show, un ciclo en días). La barra y el color lo respetan. Ausente = más es mejor. */
  mejor?: 'menos';
  /**
   * v5: un PERCENTIL de los valores POR FILA de la métrica `de` (el P90 del ciclo de venta), no una suma. El
   * agregador guarda la lista de valores del grupo y saca el percentil `p` (1-99). Si `de` es una razón, el
   * valor de una fila es su num ÷ den y la fila entra SÓLO con den > 0 (un lead sin ciclo no es un cero).
   * No entra donde sólo se suma (`soloSumas`).
   */
  percentil?: { de: string; p: number };
};
export type Area = 'Negocio' | 'Marketing' | 'CRM y ventas' | 'Comunicación' | 'Automations' | 'Plan' | 'Customer Success' | 'Second Brain' | 'Onboarding' | 'IA y contenido';
export const AREAS: readonly Area[] = ['Negocio', 'Marketing', 'CRM y ventas', 'Comunicación', 'Automations', 'Plan', 'Customer Success', 'Second Brain', 'Onboarding', 'IA y contenido'];

export type Fuente = {
  id: string;
  nombre: string;
  area: Area;
  descripcion: string;
  /**
   * Las fechas que pueden decidir qué filas entran. `sinRango` = la foto de hoy, sin período.
   * `futuro` (v5) = la fecha MIRA HACIA ADELANTE (el vencimiento de una cuota): el período NO se corta en hoy
   * (`hastaDe`, lib/graficos-catalogo.ts). Sin la marca, «lo que vence este mes» contaba sólo hasta hoy.
   */
  fechas: Array<{ id: string; nombre: string; sinRango?: true; futuro?: true }>;
  dimensiones: Dimension[];
  metricas: Metrica[];
  /**
   * Cada DIMENSIÓN es una lectura distinta (la audiencia de Meta: un desglose por edad, otro por
   * región). Juntarlas sumaría las impresiones tres veces: el lector recibe la dimensión pedida y la
   * clave de lectura la incluye (lib/graficos-datos.ts).
   */
  porDimension?: true;
  /** Los cruces que SÍ son una sola lectura (Meta da edad y género juntos): dimensión → desgloses. */
  cruces?: Record<string, readonly string[]>;
};

export const TIEMPO: Dimension[] = [
  { id: 'dia', nombre: 'Día', clase: 'tiempo' },
  { id: 'semana', nombre: 'Semana', clase: 'tiempo' },
  { id: 'mes', nombre: 'Mes', clase: 'tiempo' },
];
export const cat = (id: string, nombre: string): Dimension => ({ id, nombre, clase: 'categoria' });
export const m = (id: string, nombre: string, formato: Formato = 'numero'): Metrica => ({ id, nombre, formato });
export const dist = (id: string, nombre: string): Metrica => ({ id, nombre, formato: 'numero', distinto: true });
export const r = (id: string, nombre: string, formato: Formato, num: string, den: string, factor = 1): Metrica => ({ id, nombre, formato, razon: { num, den, factor } });
