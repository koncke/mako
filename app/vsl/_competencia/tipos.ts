// =============================================================================
// Las piezas de una landing de funcionalidad que copia la ESTRUCTURA de un competidor (11/11/2026)
// =============================================================================
// Pedido de Martín (11/11/2026): una landing por función, «siguiendo la estructura de la landing ganadora (el orden de
// secciones) y su storytelling, pero con el diseño de MaKo». La investigación que eligió cada ganadora vive en
// docs/competencia/landings-por-funcion.md.
//
// Una landing es una LISTA de bloques en el MISMO orden que la ganadora. Cada tipo de bloque es una forma de sección
// que aparece en esas landings (el hero, el «sin / con», los pasos, las preguntas…), dibujada con el sistema visual de
// /vsl (app/vsl/_detalle/FeatureDetail.tsx: Geist, el azul #2F6FED, la estrella dorada). El orden lo pone la referencia;
// la cara, MaKo.
//
// Reglas que valen para todo lo que se escribe acá (AGENTS.md):
//   · Sólo lo que MaKo hace HOY: se mira en el código (lib/funciones-mako.ts y el módulo de la función) antes de escribirlo.
//   · Nada inventado: ni testimonios, ni contadores de uso, ni cifras de antes y después. Un número sale del código.
//   · Ninguna pieza que la referencia no tenga.
//   · Español neutro, de tú (tests/puente-panel-copy.test.ts).
// Los textos admiten <strong> y <em>.
// =============================================================================

/** De dónde sale la estructura: la página que se copió, con la fecha en que se leyó. */
export type Referencia = { nombre: string; url: string; leida: string };

export type Item = { titulo: string; texto: string };

export type Bloque =
  /** La portada: etiqueta, titular, bajada, los renglones chicos y el botón, con el visual de la función al costado. */
  | { tipo: 'hero'; etiqueta: string; titulo: string; bajada: string; puntos?: string[]; visual: VisualHero }
  /** Una fila de números. Sólo números que salen del código (lo que la función TRAE), nunca de uso. */
  | { tipo: 'cifras'; titulo?: string; items: { valor: string; label: string }[] }
  /** «Sin X / Con X»: el problema y la solución, lado a lado. */
  | { tipo: 'contraste'; etiqueta?: string; titulo: string; sin: Item; con: Item; cta?: boolean }
  /** Una grilla de tarjetas con su ícono (beneficios, casos de uso, piezas). */
  | { tipo: 'tarjetas'; etiqueta?: string; titulo: string; bajada?: string; items: (Item & { icono?: string[]; meta?: string })[]; columnas?: 2 | 3; fondo?: boolean; cta?: boolean }
  /** Los pasos numerados («De la idea al video en 3 pasos»). */
  | { tipo: 'pasos'; etiqueta?: string; titulo: string; bajada?: string; pasos: Item[]; fondo?: boolean }
  /** La prueba: el caso de Mauricio, el mismo de todas las landings de MaKo (no se inventa uno por función). */
  | { tipo: 'caso' }
  /** Las preguntas frecuentes, desplegables. */
  | { tipo: 'preguntas'; titulo: string; items: { p: string; r: string }[] }
  /** Capacidades en FILAS ALTERNADAS (texto + gráfico), con los gráficos que ya tiene la landing de /vsl de ese slug. */
  | { tipo: 'filas'; etiqueta?: string; titulo: string; bajada?: string; slug: string; items: (Item & { puntos?: string[]; grafico?: number })[]; fondo?: boolean }
  /** Una fila de logos de lo que se conecta (sólo logos que existen en /vsl-assets/logos). */
  | { tipo: 'logos'; titulo: string; items: { logo: string; nombre: string }[] };

/** Una escena del visual de AI Avatar: la imagen REAL del preset (public/formatos/presets/, hecha en Flow con la cara de
 *  Martín) y lo que dice el avatar. Todo sale del código de la función: el nombre de la plantilla de venta, la imagen de su
 *  preset, la primera frase de su gancho y los segundos del ejemplo. */
export type EscenaAvatar = { escena: string; poster: string; frase: string; segundos: number };

/** El visual de la portada. Cada función tiene el suyo, dibujado en ./Visuales.tsx. */
export type VisualHero =
  /** AI Avatar: tu foto → tus escenas. La primera es la principal (con su subtítulo); las otras van a sus lados. */
  | { tipo: 'avatar'; escenas: readonly EscenaAvatar[] }
  /** Lo que ya tiene la landing de /vsl de ese slug: su mini-VSL de Panda si lo tiene, si no su gráfico de portada. */
  | { tipo: 'detalle'; slug: string }
  /** Un visual propio de la función, dibujado en ./visuales-propios/<slug>.tsx (para las funciones que no tenían landing en /vsl). */
  | { tipo: 'propio'; slug: string };

export type LandingCompetencia = {
  slug: string;
  /** El nombre de la función, como en la barra de la app. */
  nombre: string;
  /** El ícono de la función (paths SVG, viewBox 0 0 24 24). */
  icono: string[];
  referencia: Referencia;
  bloques: Bloque[];
  metaTitle: string;
  metaDesc: string;
};
