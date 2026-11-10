// =============================================================================
// motion/plantillas — el catálogo de motion graphics y su saneo (la ÚNICA puerta de un spec)
// =============================================================================
// Nueve plantillas, sacadas de las recetas de las skills de iart-ai (MIT, Copyright (c) 2026 iart.ai,
// github.com/iart-ai/motion-skills): titular (kinetic-typography + el hero de web-animation), palabras (kinetic
// typography), cifra (stat counter de data-animation), tercio (lower-thirds), logo (motion-design/logo-animation),
// barras (chart build de data-animation), testimonio (ad-video/testimonial), oferta (el sello de descuento de los
// showcases de ad-video) y cierre (end card + CTA de ad-video).
//
// Lo que se edita es PLANO (`ValoresMotion`): lo guardan igual el Video Editor (los params de un `graphic`), la landing
// (los atributos del nodo) y la API. `normalizarMotion` es la única validación: la usan la pantalla, el chat, la API y el
// render. Lo que no calza se DESCARTA con su motivo, no se inventa: un texto obligatorio vacío deja la plantilla con su
// texto de ejemplo y lo dice (las skills: «nunca inventes un nombre, una cifra o una calificación»).
//
// Puro, sin DOM y sin server-only: lo leen el editor de video, el de la landing, la ruta de la IA y los tests.
// =============================================================================

import { PLANTILLAS_MOTION, TONOS_MOTION, type CampoMotion, type IdPlantilla, type MotionSpec, type Tono, type ValoresMotion } from './tipos';

/**
 * Las fuentes que el motor sabe cargar en los dos lados (Google Fonts), con los pesos que EXISTEN: pedirle a Google un
 * peso que la familia no tiene devuelve 400 y no carga ninguno (el lienzo dibuja con la del sistema, en silencio).
 */
export const FUENTES_MOTION: Record<string, readonly number[]> = {
  Inter: [400, 600, 800],
  Montserrat: [400, 600, 800],
  Poppins: [400, 600, 800],
  'Archivo Black': [400],
  'Bebas Neue': [400],
  Anton: [400],
  'Playfair Display': [400, 700, 800],
  'DM Serif Display': [400],
  Lora: [400, 600, 700],
};
export const FUENTE_MOTION_DEFECTO = 'Inter';

/** El peso que existe más cercano al pedido (una Archivo Black siempre es 400, y ya es negra). */
export function pesoDisponible(familia: string, pedido: number): number {
  const pesos = FUENTES_MOTION[familia] ?? FUENTES_MOTION[FUENTE_MOTION_DEFECTO];
  return pesos.reduce((mejor, p) => (Math.abs(p - pedido) < Math.abs(mejor - pedido) ? p : mejor), pesos[0]);
}

const COLOR = /^#[0-9a-f]{6}$/i;

export const ROTULO_TONO: Record<Tono, string> = {
  premium: 'Premium',
  corporativo: 'Corporativo',
  energico: 'Enérgico',
  jugueton: 'Juguetón',
};

/** Los campos que tienen todas: el tono (del que salen tiempos y curvas), los colores, el fondo y la fuente. */
const COMUNES: CampoMotion[] = [
  { clave: 'tono', tipo: 'opcion', rotulo: 'Tono', porDefecto: 'corporativo', opciones: TONOS_MOTION.map((t) => ({ valor: t, rotulo: ROTULO_TONO[t] })) },
  { clave: 'colorFondo', tipo: 'color', rotulo: 'Fondo', porDefecto: '#0e1116' },
  { clave: 'colorTexto', tipo: 'color', rotulo: 'Texto', porDefecto: '#f5f7fa' },
  { clave: 'colorAcento', tipo: 'color', rotulo: 'Acento', porDefecto: '#ffc24b' },
  { clave: 'conFondo', tipo: 'si-no', rotulo: 'Con fondo', porDefecto: true },
  { clave: 'fuente', tipo: 'opcion', rotulo: 'Fuente', porDefecto: FUENTE_MOTION_DEFECTO, opciones: Object.keys(FUENTES_MOTION).map((f) => ({ valor: f, rotulo: f })) },
];

export type DefPlantilla = {
  id: IdPlantilla;
  nombre: string;
  /** Qué es y cuándo usarla: lo lee la persona en la biblioteca y lo lee la IA. */
  para: string;
  campos: CampoMotion[];
  /** Duración por defecto de un clip en el Video Editor. */
  duracionMs: number;
  /** El tercio inferior va SIN fondo: se apoya sobre el video. */
  sinFondo?: boolean;
};

const txt = (clave: string, rotulo: string, max: number, porDefecto: string, extra: Partial<Extract<CampoMotion, { tipo: 'texto' }>> = {}): CampoMotion =>
  ({ clave, tipo: 'texto', rotulo, max, porDefecto, ...extra });

export const PLANTILLAS: Record<IdPlantilla, DefPlantilla> = {
  titular: {
    id: 'titular', nombre: 'Titular', duracionMs: 5000,
    para: 'Un titular que entra línea por línea, con un antetítulo arriba y una bajada abajo. Para abrir una landing o un video.',
    campos: [
      txt('antetitulo', 'Antetítulo', 40, 'NUEVO'),
      txt('titulo', 'Título', 90, 'Vende más con menos esfuerzo', { obligatorio: true }),
      txt('bajada', 'Bajada', 140, 'Todo tu marketing en un solo lugar.'),
    ],
  },
  palabras: {
    id: 'palabras', nombre: 'Frases que golpean', duracionMs: 4500,
    para: 'Hasta tres frases cortas que aparecen una tras otra, palabra por palabra, grandes y centradas (tipografía cinética). Para un gancho.',
    campos: [
      txt('frase1', 'Frase 1', 40, 'Más clientes', { obligatorio: true }),
      txt('frase2', 'Frase 2', 40, 'Menos tiempo'),
      txt('frase3', 'Frase 3', 40, 'Un solo lugar'),
    ],
  },
  cifra: {
    id: 'cifra', nombre: 'Cifra', duracionMs: 4000,
    para: 'Un número grande que rueda hasta su valor, con su etiqueta. Sólo con un número que dio la persona: nunca uno inventado.',
    campos: [
      txt('prefijo', 'Antes del número', 4, '+'),
      // ⚠️ Paso 0,01, no 1 (10/11/2026): con paso 1, `normalizarMotion` redondeaba 4,5 a 5 antes de que `decimales`
      // pudiera decir nada, y la cifra mostraba un número que la persona no dio. Lo que se muestra lo decide
      // `decimalesAMostrar` (./escena.ts): los del número, y `decimales` como mínimo.
      { clave: 'numero', tipo: 'numero', rotulo: 'Número', min: -999_999_999, max: 999_999_999, paso: 0.01, porDefecto: 1250, ayuda: 'Hasta 2 decimales, con coma: 4,5.' },
      { clave: 'decimales', tipo: 'numero', rotulo: 'Decimales', min: 0, max: 2, paso: 1, porDefecto: 0, ayuda: 'Los que se muestran como mínimo: un número con decimales nunca se redondea.' },
      txt('sufijo', 'Después del número', 8, ''),
      txt('etiqueta', 'Etiqueta', 60, 'clientes felices', { obligatorio: true }),
      txt('nota', 'Nota', 90, ''),
    ],
  },
  tercio: {
    id: 'tercio', nombre: 'Tercio inferior', duracionMs: 6000, sinFondo: true,
    para: 'El nombre y el cargo de quien habla, abajo a la izquierda, sobre el video. Sólo con un nombre que dio la persona.',
    campos: [
      txt('nombre', 'Nombre', 32, 'Ana Pérez', { obligatorio: true }),
      txt('rol', 'Cargo', 40, 'Fundadora'),
      { clave: 'colorPanel', tipo: 'color', rotulo: 'Panel', porDefecto: '#14161b' },
    ],
  },
  logo: {
    id: 'logo', nombre: 'Logo animado', duracionMs: 3500,
    para: 'La marca que se arma: el símbolo con la inicial, el nombre letra por letra y el lema. Para abrir o cerrar.',
    campos: [
      txt('marca', 'Marca', 24, 'Tu marca', { obligatorio: true }),
      txt('lema', 'Lema', 60, 'Hecho para crecer'),
    ],
  },
  barras: {
    id: 'barras', nombre: 'Gráfico de barras', duracionMs: 5000,
    para: 'Barras que crecen hasta su valor, una tras otra, con su título. Hasta 6 datos «Etiqueta: valor», uno por línea; sólo con datos que dio la persona.',
    campos: [
      txt('titulo', 'Título', 60, 'Ventas por mes'),
      txt('datos', 'Datos («Etiqueta: valor», uno por línea)', 240, 'Enero: 120\nFebrero: 180\nMarzo: 260', { obligatorio: true }),
      txt('unidad', 'Unidad', 6, ''),
    ],
  },
  testimonio: {
    id: 'testimonio', nombre: 'Testimonio', duracionMs: 7000,
    para: 'Una cita de un cliente, con su nombre, cargo y estrellas. La cita va TAL CUAL y con nombre; sin calificación, sin estrellas.',
    campos: [
      txt('cita', 'Cita', 160, 'En un mes duplicamos las consultas.', { obligatorio: true }),
      txt('nombre', 'Nombre', 40, 'Juan Gómez', { obligatorio: true }),
      txt('cargo', 'Cargo', 50, 'Cliente'),
      { clave: 'estrellas', tipo: 'numero', rotulo: 'Estrellas (0 = sin estrellas)', min: 0, max: 5, paso: 0.5, porDefecto: 5 },
    ],
  },
  oferta: {
    id: 'oferta', nombre: 'Oferta', duracionMs: 5000,
    para: 'Un sello con el descuento que entra de golpe, el producto, el precio (y el de antes tachado) y un botón. Precios tal cual los dio la persona.',
    campos: [
      txt('antetitulo', 'Antetítulo', 30, 'Sólo por hoy'),
      txt('descuento', 'Descuento', 10, '-50%', { obligatorio: true }),
      txt('producto', 'Producto', 60, 'Plan anual'),
      txt('precio', 'Precio', 20, '$49'),
      txt('precioAntes', 'Precio de antes', 20, '$98'),
      txt('boton', 'Botón', 28, 'Lo quiero'),
    ],
  },
  cierre: {
    id: 'cierre', nombre: 'Cierre con botón', duracionMs: 4500,
    para: 'El cierre: un titular, un botón que late y un detalle (la web, el usuario). Para el final de un anuncio o de una landing.',
    campos: [
      txt('titulo', 'Título', 60, 'Empieza hoy', { obligatorio: true }),
      txt('boton', 'Botón', 28, 'Probar gratis', { obligatorio: true }),
      txt('detalle', 'Detalle', 60, 'tunegocio.com'),
    ],
  },
};

/** Todos los campos de una plantilla: los suyos y, después, los comunes. */
export function camposDe(id: IdPlantilla): CampoMotion[] {
  const def = PLANTILLAS[id];
  return [...def.campos, ...COMUNES.map((c): CampoMotion => (c.clave === 'conFondo' && def.sinFondo && c.tipo === 'si-no' ? { ...c, porDefecto: false } : c))];
}

export function valoresPorDefecto(id: IdPlantilla): ValoresMotion {
  return Object.fromEntries(camposDe(id).map((c) => [c.clave, c.porDefecto]));
}

export const esPlantilla = (x: unknown): x is IdPlantilla => typeof x === 'string' && (PLANTILLAS_MOTION as readonly string[]).includes(x);

/** Caracteres de control fuera; los saltos de línea sólo quedan en los datos de las barras. */
function limpiarTexto(s: string, conSaltos: boolean): string {
  const sin = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return conSaltos ? sin.replace(/\r\n?/g, '\n') : sin.replace(/[\r\n\t]+/g, ' ');
}

/** Cuántos decimales tiene un paso (0,01 → 2; 0,5 → 1; 1 → 0). */
const decimalesDelPaso = (paso: number): number => {
  for (let d = 0; d <= 6; d++) if (Math.abs(Math.round(paso * 10 ** d) - paso * 10 ** d) < 1e-9) return d;
  return 6;
};

/**
 * `n` llevado a su paso SIN el error de la coma flotante: `Math.round(1.15 / 0.01) * 0.01` da 1.1500000000000001, y un
 * número así no se compara igual ni se muestra igual.
 */
function alPaso(n: number, paso: number): number {
  return Number((Math.round(n / paso) * paso).toFixed(decimalesDelPaso(paso)));
}

/** Un número para un motivo, con coma decimal y sin separador de miles (4.567 → «4,567»). */
const formatoPlano = (n: number): string => String(n).replace('.', ',');

export type ResultadoMotion = { spec: MotionSpec; descartes: string[] };

/**
 * Lo que llegue (de la IA, de la API, de un atributo guardado) → un spec válido y COMPLETO. Lo que no se puede usar
 * se descarta con su motivo y queda el valor por defecto; nada se recorta en silencio: un texto largo se rechaza.
 */
export function normalizarMotion(raw: unknown, op: { estricto?: boolean } = {}): ResultadoMotion {
  // Lo que escribe la IA o llega por la API respeta el tope de cada campo (el layout está pensado para eso). Lo que la
  // persona escribe a mano en el panel no se rechaza ni se corta (Martín: nunca cortar un texto por caracteres): pasa
  // hasta un tope duro y el motor achica la letra para que entre.
  const estricto = op.estricto !== false;
  const descartes: string[] = [];
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  let plantilla: IdPlantilla = 'titular';
  if (esPlantilla(o.plantilla)) plantilla = o.plantilla;
  else if (o.plantilla !== undefined) descartes.push(`plantilla «${String(o.plantilla).slice(0, 30)}»: no existe`);
  const entrada = o.valores && typeof o.valores === 'object' && !Array.isArray(o.valores) ? (o.valores as Record<string, unknown>) : {};
  const valores = valoresPorDefecto(plantilla);
  const campos = camposDe(plantilla);
  const claves = new Set(campos.map((c) => c.clave));
  for (const k of Object.keys(entrada)) if (!claves.has(k)) descartes.push(`${k}: no es un campo de «${PLANTILLAS[plantilla].nombre}»`);
  for (const c of campos) {
    if (!(c.clave in entrada)) continue;
    const v = entrada[c.clave];
    switch (c.tipo) {
      case 'texto': {
        if (typeof v !== 'string') { descartes.push(`${c.rotulo}: no es un texto`); break; }
        const s = limpiarTexto(v, c.clave === 'datos').trim();
        const tope = estricto ? c.max : Math.max(c.max * 4, 240);
        if (s.length > tope) { descartes.push(`${c.rotulo}: tiene ${s.length} caracteres y el tope es ${tope}`); break; }
        if (!s && c.obligatorio) { descartes.push(`${c.rotulo}: no puede quedar vacío`); break; }
        valores[c.clave] = s;
        break;
      }
      case 'numero': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
        if (!Number.isFinite(n)) { descartes.push(`${c.rotulo}: no es un número`); break; }
        if (n < c.min || n > c.max) { descartes.push(`${c.rotulo}: ${n} está fuera de ${c.min} a ${c.max}`); break; }
        const redondo = alPaso(n, c.paso);
        // Lo que escribe la IA o llega por la API no se redondea en silencio: 4,567 en un campo de 2 decimales, o 4,3
        // estrellas (van de a media), se rechazan con su motivo. Lo de la persona en el panel sí se lleva al paso.
        if (estricto && Math.abs(redondo - n) > 1e-9) { descartes.push(`${c.rotulo}: ${formatoPlano(n)} no va de a ${formatoPlano(c.paso)}`); break; }
        valores[c.clave] = redondo;
        break;
      }
      case 'color': {
        if (typeof v !== 'string' || !COLOR.test(v.trim())) { descartes.push(`${c.rotulo}: «${String(v).slice(0, 20)}» no es un color #RRGGBB`); break; }
        valores[c.clave] = v.trim().toLowerCase();
        break;
      }
      case 'opcion': {
        if (typeof v !== 'string' || !c.opciones.some((op) => op.valor === v)) { descartes.push(`${c.rotulo}: «${String(v).slice(0, 30)}» no es una opción`); break; }
        valores[c.clave] = v;
        break;
      }
      case 'si-no': {
        if (typeof v !== 'boolean') { descartes.push(`${c.rotulo}: no es sí o no`); break; }
        valores[c.clave] = v;
        break;
      }
    }
  }
  return { spec: { plantilla, valores }, descartes };
}

/** Lee un valor ya normalizado con su tipo (el spec viene de `normalizarMotion`, nunca de afuera). */
export const texto = (v: ValoresMotion, k: string): string => (typeof v[k] === 'string' ? (v[k] as string) : '');
export const numero = (v: ValoresMotion, k: string): number => (typeof v[k] === 'number' ? (v[k] as number) : 0);
export const color = (v: ValoresMotion, k: string, def: string): string => (typeof v[k] === 'string' && COLOR.test(v[k] as string) ? (v[k] as string) : def);

/** Los datos de las barras: «Etiqueta: valor», uno por línea (también «Etiqueta = valor» o separados por «;»). */
export function datosDeBarras(s: string): Array<{ etiqueta: string; valor: number }> {
  return s
    .split(/[\n;]+/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const m = /^(.*?)[:=]\s*(-?[\d.,]+)\s*$/.exec(linea);
      if (!m) return null;
      const crudo = m[2];
      // «1.250» y «1,5»: el último separador con 1-2 cifras detrás es el decimal; con 3, de miles.
      const dec = /[.,](\d{1,2})$/.exec(crudo);
      const n = dec ? Number(crudo.slice(0, dec.index).replace(/[.,]/g, '') + '.' + dec[1]) : Number(crudo.replace(/[.,]/g, ''));
      return Number.isFinite(n) && m[1].trim() ? { etiqueta: m[1].trim().slice(0, 24), valor: n } : null;
    })
    .filter((x): x is { etiqueta: string; valor: number } => x !== null)
    .slice(0, 6);
}

/** El catálogo para el texto que lee la IA: una línea por plantilla, con sus campos y topes. */
export function catalogoMotionParaPrompt(): string {
  return PLANTILLAS_MOTION.map((id) => {
    const d = PLANTILLAS[id];
    const campos = d.campos
      .map((c) => (c.tipo === 'texto' ? `${c.clave} (texto ≤${c.max}${c.obligatorio ? ', obligatorio' : ''})` : c.tipo === 'numero' ? `${c.clave} (número ${c.min} a ${c.max})` : `${c.clave} (${c.tipo})`))
      .join(', ');
    return `- ${id} — ${d.nombre}: ${d.para} Campos: ${campos}.`;
  }).join('\n') +
    `\nComunes a todas: tono (${TONOS_MOTION.join(' | ')}), colorFondo, colorTexto, colorAcento (#RRGGBB), conFondo (true/false), fuente (${Object.keys(FUENTES_MOTION).join(', ')}).`;
}
