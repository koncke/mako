// =============================================================================
// cerebro-modelo — la FORMA del grafo del negocio (tipos + las diez áreas)
// =============================================================================
// DATOS PUROS a propósito: **sin `server-only` y sin un solo import de otro
// módulo**. Lo consumen las dos puntas — el constructor server-side
// (lib/cerebro-grafo.ts) y el componente que lo dibuja en el browser
// (app/second-brain/Grafo.tsx) — y ese es exactamente el motivo de que exista
// separado, igual que `lib/capas.ts` y `lib/angulos-data.ts`.
//
// El día que esto viva en el mismo archivo que el constructor, el componente
// cliente arrastra al bundle del browser toda la cadena
// cerebro-grafo → productos → workspace → auth → next/headers, y la compilación
// se cae con «You're importing a module that depends on next/headers». No es
// hipotético: pasó al escribirlo, y el typecheck NO lo ve — `tsc --noEmit` da
// verde porque los tipos son correctos; lo que rompe es el grafo de imports.
// La única red que lo caza es levantar la página.
// =============================================================================

/** Las diez áreas del negocio. El orden ES el orden del reloj en el lienzo, y no
 *  es arbitrario: sigue el recorrido del onboarding, así que el mapa terminado se
 *  lee como la historia de cómo se construyó. */
export const AREAS = [
  { id: 'norte', nombre: 'Norte', que: 'En qué fase está el negocio, qué lo frena y cómo vende.' },
  { id: 'documentos', nombre: 'Documentos', que: 'Lo que soltaste en el Archivero y MaKo leyó.' },
  { id: 'panorama', nombre: 'Panorama', que: 'Lo que MaKo entendió del negocio, en sus seis planos.' },
  { id: 'oferta', nombre: 'Oferta', que: 'Qué vendes, a cuánto, qué prometes y qué garantizas.' },
  { id: 'cliente', nombre: 'Cliente', que: 'A quién le vendes, qué le duele y qué objeta.' },
  { id: 'productos', nombre: 'Productos', que: 'El catálogo con el que el CRM cierra cada venta.' },
  { id: 'entregables', nombre: 'Gancho', que: 'El elemento tangible que hace deseable la oferta.' },
  { id: 'avatares', nombre: 'Segmentos', que: 'Los tres segmentos que se pueden targetear en Meta.' },
  { id: 'razones', nombre: 'Razones', que: 'Por qué compra cada segmento: las celdas de la matriz.' },
  { id: 'voz', nombre: 'Voz y cara', que: 'Cómo suena tu marca y qué cara tiene en los creativos.' },
] as const;

export type AreaId = (typeof AREAS)[number]['id'];

/** Quién puso este nodo. Es la única dimensión de color permanente del lienzo:
 *  un borde, nunca un relleno — «un filo de 3 px alcanza; fondos de color
 *  distinto son una bolsa de caramelos» (la regla ya escrita en ui.css). */
export type Autoria = 'mako' | 'usuario' | 'pendiente';

export type NodoCerebro = {
  id: string;
  area: AreaId;
  /** Lo que se dibuja al lado del punto. Corto: es una etiqueta, no una frase. */
  etiqueta: string;
  /** El hover: qué es esto, en las palabras del propio dato cuando se puede. */
  detalle: string;
  /** De dónde salió. Vacío solo si de verdad no se sabe. */
  fuente: string;
  autoria: Autoria;
  /** El Norte: el único nodo dorado permanente del mapa. */
  destacado?: boolean;
  /** El cuello de botella: naranja de warning, porque es lo que hay que mover. */
  alerta?: boolean;
};

/** Una arista se dibuja solo si SIGNIFICA algo verificable. `motivo` es lo que se
 *  lee al pasar por encima; si no se puede escribir, la arista no va. */
export type AristaCerebro = { de: string; a: string; motivo: string };

/**
 * El radio del nodo, en unidades de mundo. Es la fórmula de Obsidian tal cual:
 * `max(8, min(3·√(grado+1), 30))`.
 *
 * Vive acá y no en el layout porque la consumen las DOS puntas —la colisión del
 * servidor y el dibujo del cliente— y cuando estaba escrita dos veces, cada archivo
 * llevaba un comentario avisando que si divergían los nodos se pisaban. Eso es la
 * definición de «una cosa, un lugar».
 *
 * El piso de 8 domina hasta grado 6, así que el mapa queda casi uniforme en tamaño:
 * una hoja mide 8,0 y un hub de grado 14 mide 11,6. Eso es a propósito y es lo que
 * hace que un grafo de Obsidian se vea como se ve — la jerarquía la dan la POSICIÓN
 * y el color, no el diámetro. La versión anterior daba un rango de 3,4× (con el
 * `pendiente` en 3,5) y producía un mapa de burbujas de tamaños dispares.
 */
export function radioNodo(grado: number): number {
  return Math.max(8, Math.min(3 * Math.sqrt(grado + 1), 30));
}

export type Punto = { x: number; y: number };
/** El cuadrado del mundo que hay que mirar. Sale del bbox de las posiciones ya
 *  asentadas, no es fijo: un negocio con 12 nodos y otro con 300 se ven igual de bien. */
export type Encuadre = { x: number; y: number; lado: number };

export type Cerebro = {
  negocio: string;
  nodos: NodoCerebro[];
  aristas: AristaCerebro[];
  cuenta: { total: number; mako: number; usuario: number; pendientes: number };
  /** Las áreas que todavía no tienen un solo nodo real. */
  vacias: AreaId[];
  /**
   * Dónde va cada nodo. Se calcula EN EL SERVIDOR con d3-force (lib/cerebro-layout.ts)
   * y viaja como números: así el motor de física nunca entra al bundle del browser.
   */
  posiciones: Record<string, Punto>;
  encuadre: Encuadre;
};
