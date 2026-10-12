// =============================================================================
// editor-landing/catalogo-bloques — lo que se puede INSERTAR en una sección
// =============================================================================
// Una sola lista para el menú «/» (slash), la barra de inserción de la derecha y
// la IA. Los NOMBRES y las CATEGORÍAS son los de Gamma en español (relevo del
// 11/10/2026: «Bloques básicos», «Formularios y botones», «Diseños optimizados»,
// «Gráficos y diagramas», «Imágenes», «Videos y multimedia», «Incrustaciones»,
// «Tablas»). Puro: lo importan el editor y los tests.
//
// Quien inserta es `insertarBloque(editor, id, opciones)` en
// app/landing-generator/editor/insertar.ts: un `switch` sobre `IdBloque`. Un id
// nuevo acá sin su `case` allá lo frena el test del catálogo.
// =============================================================================

import type { VarianteOptimizado, TonoRecuadro, TipoGrafico } from './doc';

export const CATEGORIAS_BLOQUE = [
  'Bloques básicos',
  // Lo que conecta la landing con MaKo (feedback de Martín, 12/10/2026: «aproveches las herramientas que
  // tenemos dentro de MaKo, como por ejemplo, embed de calendly, de cal, de stripe, de mercado pago, del VSL»).
  'Herramientas de MaKo',
  'Diseños optimizados',
  'Formularios y botones',
  'Imágenes',
  'Videos y multimedia',
  'Incrustaciones',
  'Gráficos y diagramas',
  'Tablas',
] as const;
export type CategoriaBloque = (typeof CATEGORIAS_BLOQUE)[number];

export type IdBloque =
  // Bloques básicos
  | 'titulo' | 'h1' | 'h2' | 'h3' | 'h4' | 'antetitulo' | 'parrafo' | 'texto-grande' | 'texto-pequeno'
  | 'vinetas' | 'numerada' | 'tareas' | 'cita' | 'separador' | 'espaciador' | 'desplegable'
  | 'columnas-2' | 'columnas-3' | 'columnas-4'
  | 'recuadro-info' | 'recuadro-nota' | 'recuadro-advertencia' | 'recuadro-precaucion' | 'recuadro-exito' | 'recuadro-pregunta'
  // Diseños optimizados (uno por variante destacada; el resto se elige adentro)
  | 'opt-vinetas' | 'opt-cajas' | 'opt-iconos' | 'opt-tiempo' | 'opt-etapas' | 'opt-flechas'
  | 'opt-estadisticas' | 'opt-comparacion' | 'opt-piramide' | 'opt-embudo' | 'opt-ciclo'
  | 'opt-citas' | 'opt-equipo' | 'opt-logos' | 'opt-galeria'
  // Herramientas de MaKo
  | 'agenda' | 'vsl' | 'pago'
  // Formularios y botones
  | 'boton' | 'botones-2' | 'formulario' | 'etiqueta'
  // Imágenes
  | 'imagen' | 'imagen-buscar' | 'imagen-url'
  // Videos y multimedia
  | 'video-subir' | 'video-enlace'
  // Incrustaciones
  | 'insertar' | 'html-libre'
  // Gráficos y diagramas
  | 'grafico-barras' | 'grafico-columnas' | 'grafico-lineas' | 'grafico-circular' | 'grafico-dona'
  // Tablas
  | 'tabla-2' | 'tabla-3' | 'tabla-4';

export type DefBloque = {
  id: IdBloque;
  nombre: string;
  categoria: CategoriaBloque;
  /** Una línea para el menú «/». */
  ayuda: string;
  /** Palabras que también lo encuentran al escribir después de «/». Sin acentos. */
  buscar: string[];
  /** Ícono de lib/editor-landing/iconos.ts (nombre). */
  icono: string;
  /** Datos para el insertador (la variante del diseño optimizado, el tono, el tipo de gráfico…). */
  variante?: VarianteOptimizado | TonoRecuadro | TipoGrafico | number;
};

export const BLOQUES: readonly DefBloque[] = [
  // ── Bloques básicos ─────────────────────────────────────────────────────────
  { id: 'titulo', nombre: 'Título', categoria: 'Bloques básicos', ayuda: 'El texto más grande de la sección', buscar: ['title', 'titular', 'display'], icono: 'texto-t' },
  { id: 'h1', nombre: 'Encabezado 1', categoria: 'Bloques básicos', ayuda: 'Título de la sección', buscar: ['h1', 'heading', 'encabezado'], icono: 'texto-h1' },
  { id: 'h2', nombre: 'Encabezado 2', categoria: 'Bloques básicos', ayuda: 'Subtítulo', buscar: ['h2', 'subtitulo'], icono: 'texto-h2' },
  { id: 'h3', nombre: 'Encabezado 3', categoria: 'Bloques básicos', ayuda: 'Título chico', buscar: ['h3'], icono: 'texto-h3' },
  { id: 'h4', nombre: 'Encabezado 4', categoria: 'Bloques básicos', ayuda: 'El más chico de los títulos', buscar: ['h4'], icono: 'texto-h4' },
  { id: 'antetitulo', nombre: 'Antetítulo', categoria: 'Bloques básicos', ayuda: 'El texto chico sobre el título', buscar: ['eyebrow', 'kicker', 'sobretitulo'], icono: 'texto-aa' },
  { id: 'parrafo', nombre: 'Párrafo', categoria: 'Bloques básicos', ayuda: 'Texto normal', buscar: ['texto', 'paragraph', 'p'], icono: 'texto-parrafo' },
  { id: 'texto-grande', nombre: 'Texto grande', categoria: 'Bloques básicos', ayuda: 'Un párrafo más grande', buscar: ['grande', 'lead'], icono: 'texto-aa' },
  { id: 'texto-pequeno', nombre: 'Texto pequeño', categoria: 'Bloques básicos', ayuda: 'Un párrafo más chico', buscar: ['chico', 'pequeno', 'small'], icono: 'texto-aa' },
  { id: 'vinetas', nombre: 'Lista con viñetas', categoria: 'Bloques básicos', ayuda: 'Una lista simple', buscar: ['lista', 'bullets', 'ul'], icono: 'lista' },
  { id: 'numerada', nombre: 'Lista numerada', categoria: 'Bloques básicos', ayuda: 'Una lista con números', buscar: ['numeros', 'ol', 'ordenada'], icono: 'lista-numerada' },
  { id: 'tareas', nombre: 'Lista de tareas pendientes', categoria: 'Bloques básicos', ayuda: 'Casillas para tildar', buscar: ['checklist', 'todo', 'tareas'], icono: 'lista-check' },
  { id: 'cita', nombre: 'Cita en bloque', categoria: 'Bloques básicos', ayuda: 'Una frase destacada', buscar: ['quote', 'cita', 'testimonio'], icono: 'cita' },
  { id: 'separador', nombre: 'Separador', categoria: 'Bloques básicos', ayuda: 'Una línea divisoria', buscar: ['divisor', 'hr', 'linea'], icono: 'separador' },
  { id: 'espaciador', nombre: 'Espacio', categoria: 'Bloques básicos', ayuda: 'Aire entre bloques', buscar: ['spacer', 'espacio', 'aire'], icono: 'espacio' },
  { id: 'desplegable', nombre: 'Desplegable', categoria: 'Bloques básicos', ayuda: 'Se abre y se cierra: preguntas frecuentes', buscar: ['toggle', 'faq', 'acordeon', 'preguntas'], icono: 'desplegable' },
  { id: 'columnas-2', nombre: '2 columnas', categoria: 'Bloques básicos', ayuda: 'Dos columnas iguales', buscar: ['columnas', 'columns', 'dos'], icono: 'columnas-2', variante: 2 },
  { id: 'columnas-3', nombre: '3 columnas', categoria: 'Bloques básicos', ayuda: 'Tres columnas iguales', buscar: ['columnas', 'tres'], icono: 'columnas-3', variante: 3 },
  { id: 'columnas-4', nombre: '4 columnas', categoria: 'Bloques básicos', ayuda: 'Cuatro columnas iguales', buscar: ['columnas', 'cuatro'], icono: 'columnas-4', variante: 4 },
  { id: 'recuadro-info', nombre: 'Cuadro de información', categoria: 'Bloques básicos', ayuda: 'Un recuadro azul', buscar: ['callout', 'info', 'recuadro'], icono: 'info', variante: 'info' },
  { id: 'recuadro-nota', nombre: 'Cuadro de nota', categoria: 'Bloques básicos', ayuda: 'Un recuadro con el color del tema', buscar: ['callout', 'nota'], icono: 'nota', variante: 'nota' },
  { id: 'recuadro-advertencia', nombre: 'Cuadro de advertencia', categoria: 'Bloques básicos', ayuda: 'Un recuadro amarillo', buscar: ['callout', 'warning', 'advertencia'], icono: 'advertencia', variante: 'advertencia' },
  { id: 'recuadro-precaucion', nombre: 'Cuadro de precaución', categoria: 'Bloques básicos', ayuda: 'Un recuadro rojo', buscar: ['callout', 'peligro', 'precaucion'], icono: 'precaucion', variante: 'precaucion' },
  { id: 'recuadro-exito', nombre: 'Cuadro de operación exitosa', categoria: 'Bloques básicos', ayuda: 'Un recuadro verde', buscar: ['callout', 'exito', 'success', 'garantia'], icono: 'exito', variante: 'exito' },
  { id: 'recuadro-pregunta', nombre: 'Cuadro de pregunta', categoria: 'Bloques básicos', ayuda: 'Un recuadro gris', buscar: ['callout', 'pregunta'], icono: 'pregunta', variante: 'pregunta' },

  // ── Diseños optimizados ─────────────────────────────────────────────────────
  { id: 'opt-vinetas', nombre: 'Viñetas', categoria: 'Diseños optimizados', ayuda: 'Puntos grandes con texto', buscar: ['smart', 'bullets', 'beneficios'], icono: 'opt-vinetas', variante: 'vinetas-grandes' },
  { id: 'opt-cajas', nombre: 'Cajas', categoria: 'Diseños optimizados', ayuda: 'Cada idea en su caja', buscar: ['smart', 'cards', 'tarjetas', 'boxes'], icono: 'opt-cajas', variante: 'cajas-solidas' },
  { id: 'opt-iconos', nombre: 'Íconos con texto', categoria: 'Diseños optimizados', ayuda: 'Un ícono por idea', buscar: ['smart', 'icons', 'beneficios', 'caracteristicas'], icono: 'opt-iconos', variante: 'iconos-texto' },
  { id: 'opt-tiempo', nombre: 'Línea de tiempo', categoria: 'Diseños optimizados', ayuda: 'Hitos en orden', buscar: ['timeline', 'historia', 'cronologia'], icono: 'opt-tiempo', variante: 'tiempo-horizontal' },
  { id: 'opt-etapas', nombre: 'Etapas', categoria: 'Diseños optimizados', ayuda: 'Cómo funciona, paso a paso', buscar: ['pasos', 'proceso', 'steps', 'como funciona'], icono: 'opt-etapas', variante: 'etapas-horizontales' },
  { id: 'opt-flechas', nombre: 'Flechas', categoria: 'Diseños optimizados', ayuda: 'Una cosa lleva a la otra', buscar: ['arrows', 'chevron'], icono: 'opt-flechas', variante: 'flechas-horizontales' },
  { id: 'opt-estadisticas', nombre: 'Estadísticas', categoria: 'Diseños optimizados', ayuda: 'Números grandes', buscar: ['stats', 'numeros', 'metricas', 'resultados'], icono: 'opt-estadisticas', variante: 'numeros-grandes' },
  { id: 'opt-comparacion', nombre: 'Comparación', categoria: 'Diseños optimizados', ayuda: 'Antes y después, nosotros contra otros', buscar: ['vs', 'versus', 'antes despues', 'comparar'], icono: 'opt-comparacion', variante: 'lado-a-lado' },
  { id: 'opt-piramide', nombre: 'Pirámide', categoria: 'Diseños optimizados', ayuda: 'Niveles de abajo hacia arriba', buscar: ['pyramid', 'niveles'], icono: 'opt-piramide', variante: 'piramide' },
  { id: 'opt-embudo', nombre: 'Embudo', categoria: 'Diseños optimizados', ayuda: 'De muchos a pocos', buscar: ['funnel', 'embudo'], icono: 'opt-embudo', variante: 'embudo' },
  { id: 'opt-ciclo', nombre: 'Ciclo', categoria: 'Diseños optimizados', ayuda: 'Algo que se repite', buscar: ['cycle', 'circulo', 'loop'], icono: 'opt-ciclo', variante: 'ciclo' },
  { id: 'opt-citas', nombre: 'Citas con caras', categoria: 'Diseños optimizados', ayuda: 'Testimonios', buscar: ['testimonios', 'quotes', 'reseñas', 'resenas'], icono: 'opt-citas', variante: 'citas-caras' },
  { id: 'opt-equipo', nombre: 'Fotos del equipo', categoria: 'Diseños optimizados', ayuda: 'Personas con nombre y rol', buscar: ['team', 'equipo', 'personas'], icono: 'opt-equipo', variante: 'equipo' },
  { id: 'opt-logos', nombre: 'Galería de logotipos', categoria: 'Diseños optimizados', ayuda: 'Empresas, socios y patrocinadores', buscar: ['logos', 'clientes', 'marcas', 'confian'], icono: 'opt-logos', variante: 'logos' },
  { id: 'opt-galeria', nombre: 'Galería', categoria: 'Diseños optimizados', ayuda: 'Varias imágenes juntas', buscar: ['gallery', 'fotos', 'imagenes'], icono: 'opt-galeria', variante: 'galeria' },

  // ── Herramientas de MaKo ────────────────────────────────────────────────────
  // Atajos a lo que ya existe: la agenda y el VSL son el bloque «Insertar» (lib/embeds.ts decide qué
  // proveedores entran) con su proveedor de entrada; el pago es un botón al link de pago que se pegue.
  { id: 'agenda', nombre: 'Agenda', categoria: 'Herramientas de MaKo', ayuda: 'Calendly o Cal.com, para que agenden aquí', buscar: ['calendly', 'calcom', 'cal', 'agendar', 'reservar', 'llamada', 'cita'], icono: 'calendario-check' },
  { id: 'vsl', nombre: 'VSL', categoria: 'Herramientas de MaKo', ayuda: 'Tu video de venta: YouTube, Panda, Vimeo, Wistia', buscar: ['video', 'youtube', 'panda', 'vimeo', 'wistia', 'venta'], icono: 'video-enlace' },
  { id: 'pago', nombre: 'Botón de pago', categoria: 'Herramientas de MaKo', ayuda: 'Lleva al link de pago de Stripe o Mercado Pago', buscar: ['stripe', 'mercado pago', 'mercadopago', 'pagar', 'checkout', 'cobrar', 'comprar'], icono: 'tarjeta-credito' },

  // ── Formularios y botones ───────────────────────────────────────────────────
  { id: 'boton', nombre: 'Botón', categoria: 'Formularios y botones', ayuda: 'Lleva a un link, a una sección o a tu agenda', buscar: ['button', 'cta', 'boton'], icono: 'boton' },
  { id: 'botones-2', nombre: '2 botones', categoria: 'Formularios y botones', ayuda: 'Un botón principal y uno secundario', buscar: ['buttons', 'cta'], icono: 'botones' },
  { id: 'formulario', nombre: 'Formulario', categoria: 'Formularios y botones', ayuda: 'Los datos entran a tu CRM', buscar: ['form', 'captura', 'lead', 'registro', 'datos'], icono: 'formulario' },
  { id: 'etiqueta', nombre: 'Etiqueta', categoria: 'Formularios y botones', ayuda: 'Una píldora: «Más vendido», «Oferta»', buscar: ['label', 'pill', 'badge', 'tag'], icono: 'etiqueta' },

  // ── Imágenes ────────────────────────────────────────────────────────────────
  { id: 'imagen', nombre: 'Subir imagen', categoria: 'Imágenes', ayuda: 'Desde tu computadora', buscar: ['image', 'foto', 'upload', 'subir'], icono: 'imagen' },
  { id: 'imagen-buscar', nombre: 'Buscar imágenes', categoria: 'Imágenes', ayuda: 'Fotos de uso libre', buscar: ['stock', 'buscar', 'fotos'], icono: 'buscar-imagen' },
  { id: 'imagen-url', nombre: 'Imagen desde un enlace', categoria: 'Imágenes', ayuda: 'Pega la dirección de una imagen', buscar: ['url', 'link', 'enlace'], icono: 'enlace' },

  // ── Videos y multimedia ─────────────────────────────────────────────────────
  { id: 'video-subir', nombre: 'Subir video', categoria: 'Videos y multimedia', ayuda: 'MP4 o WebM', buscar: ['video', 'mp4', 'upload'], icono: 'video' },
  { id: 'video-enlace', nombre: 'Video de YouTube, Vimeo, Loom…', categoria: 'Videos y multimedia', ayuda: 'Pega el enlace del video', buscar: ['youtube', 'vimeo', 'loom', 'wistia', 'panda', 'vsl'], icono: 'video-enlace' },

  // ── Incrustaciones ──────────────────────────────────────────────────────────
  { id: 'insertar', nombre: 'Insertar', categoria: 'Incrustaciones', ayuda: 'Calendly, Cal.com, Google Calendar y más', buscar: ['embed', 'iframe', 'calendly', 'agenda', 'calcom', 'hubspot'], icono: 'insertar' },
  { id: 'html-libre', nombre: 'HTML personalizado', categoria: 'Incrustaciones', ayuda: 'Tu propio HTML, en un recuadro aislado', buscar: ['html', 'codigo', 'code', 'custom'], icono: 'codigo' },

  // ── Gráficos y diagramas ────────────────────────────────────────────────────
  { id: 'grafico-barras', nombre: 'Gráfico de barras', categoria: 'Gráficos y diagramas', ayuda: 'Barras horizontales', buscar: ['chart', 'bar', 'grafico'], icono: 'grafico-barras', variante: 'barras' },
  { id: 'grafico-columnas', nombre: 'Gráfico de columnas', categoria: 'Gráficos y diagramas', ayuda: 'Columnas verticales', buscar: ['chart', 'columnas'], icono: 'grafico-columnas', variante: 'columnas' },
  { id: 'grafico-lineas', nombre: 'Gráfico de líneas', categoria: 'Gráficos y diagramas', ayuda: 'Cómo cambia algo en el tiempo', buscar: ['chart', 'line', 'lineas', 'tendencia'], icono: 'grafico-lineas', variante: 'lineas' },
  { id: 'grafico-circular', nombre: 'Gráfico circular', categoria: 'Gráficos y diagramas', ayuda: 'Partes de un total', buscar: ['chart', 'pie', 'torta', 'circular'], icono: 'grafico-circular', variante: 'circular' },
  { id: 'grafico-dona', nombre: 'Gráfico de dona', categoria: 'Gráficos y diagramas', ayuda: 'Partes de un total, con hueco', buscar: ['chart', 'donut', 'dona', 'anillo'], icono: 'grafico-dona', variante: 'dona' },

  // ── Tablas ──────────────────────────────────────────────────────────────────
  { id: 'tabla-2', nombre: 'Tabla 2×2', categoria: 'Tablas', ayuda: 'Dos filas, dos columnas', buscar: ['table', 'tabla'], icono: 'tabla', variante: 2 },
  { id: 'tabla-3', nombre: 'Tabla 3×3', categoria: 'Tablas', ayuda: 'Tres filas, tres columnas', buscar: ['table', 'tabla', 'precios'], icono: 'tabla', variante: 3 },
  { id: 'tabla-4', nombre: 'Tabla 4×4', categoria: 'Tablas', ayuda: 'Cuatro filas, cuatro columnas', buscar: ['table', 'tabla', 'comparar planes'], icono: 'tabla', variante: 4 },
];

export function bloquePorId(id: string): DefBloque | undefined {
  return BLOQUES.find((b) => b.id === id);
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lo que muestra el menú «/» para lo que se escribió después de la barra. */
export function buscarBloques(consulta: string): DefBloque[] {
  const q = sinAcentos(consulta.trim());
  if (!q) return [...BLOQUES];
  return BLOQUES.filter((b) => sinAcentos(b.nombre).includes(q) || b.buscar.some((k) => sinAcentos(k).includes(q)) || sinAcentos(b.categoria).includes(q));
}
