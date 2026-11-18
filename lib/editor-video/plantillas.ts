// =============================================================================
// editor-video/plantillas — las plantillas de anuncio vertical (el catálogo)
// =============================================================================
// Orden de Martín (15/10/2026, por «Estrategia 3 cuentas»): «Cinco plantillas para
// anuncios verticales con lo que el editor ya tiene: gancho, testimonio, antes y
// después, beneficios, oferta con cuenta regresiva». Sin música (no hay con licencia).
// El plan, con el porqué de cada número: docs/editor-video/plan-plantillas-anuncio.md.
// Las dos variantes que sumó el coordinador ese día (gancho con máquina de escribir,
// oferta con glitch) se retiraron el 18/11/2026, y entraron las seis del plan de
// plantillas reales (docs/plantillas-reales/video.md): ver «Las seis nuevas», abajo.
//
// Una plantilla es una línea de tiempo con HUECOS CON NOMBRE (las `modifications` de
// Creatomate): un hueco de texto es el texto que trae; uno de clip, una imagen de
// muestra que se sustituye con «Reemplazar el clip» (como «Utilizar plantilla» de
// CapCut). El MISMO objeto `HuecoClip` en varias piezas es UN hueco: llenarlo las
// llena todas (en «Antes y después», el antes sale solo y después arriba de la
// pantalla partida).
//
// Las reglas de los números:
//   · Tiempos en segundos absolutos de la línea de tiempo, en cuadros de 30 fps.
//   · Posiciones en px de LIENZO_REF (1080x1920, y desde ARRIBA); el armado las
//     escala con f = ancho del lienzo / 1080 (app/video-editor/_opencut/plantillas/armar.ts).
//   · La pista principal va pegada de 0 a `duracion`; lo de encima empieza y termina
//     adentro de la pieza principal que acompaña: la vinculación (ripple/iman.ts) ancla
//     por el INICIO, así que si la persona alarga su clip, el cierre y sus textos se
//     corren juntos.
//   · Todo texto cae en la zona segura de Meta.
//
// Los IDS (efectos de texto, animaciones, transiciones, fuentes, subtítulos) viven en
// el motor, que este módulo no puede importar: los fija el test contra el motor
// (tests/video-editor-plantillas.test.ts, test 1).
//
// Puro: SIN `server-only` y sin importar nada de `_opencut/` (lo importan la ruta del
// chat, la page y los tests, como chat-catalogo.ts).
// =============================================================================

import { ordenarConSugeridas, type ConSugerencia, type SenalesNegocio } from '../plantillas-sugeridas';
import { ETIQUETAS_VIDEO } from './plantillas-etiquetas';

export const LIENZO_REF = { ancho: 1080, alto: 1920 } as const;
/** Meta Ads Guide «Instagram Reels» (15/10/2026): 14 % arriba, 35 % abajo, 6 % por lado. */
export const ZONA_SEGURA = { arriba: 269, abajo: 1248, izquierda: 65, derecha: 1015 } as const;
/** Margen lateral de un texto (proporción del ancho): el 6 % + el relleno de una tarjeta (119 px). */
export const MARGEN_TEXTO = 0.11;

/** [id del preset, segundos]. Los ids son los de animaciones/catalogo.ts. */
export type Anim = { entrada?: [id: string, s: number]; salida?: [id: string, s: number]; bucle?: [id: string, s: number] };
export type HuecoClip = { nombre: string; rotulo: string; acepta: 'video' | 'imagen' | 'ambos'; opcional?: boolean };
export type HuecoTexto = { nombre: string; maxCaracteres: number };
/** Px de LIENZO_REF, desde arriba a la izquierda. */
export type Celda = { x: number; y: number; ancho: number; alto: number };
export type PistaPlantilla = 'principal' | 'video-1' | 'forma-1' | 'texto-1' | 'texto-2' | 'texto-3' | 'texto-4';

export type PiezaClip = {
  tipo: 'clip';
  hueco: HuecoClip;
  pista: 'principal' | 'video-1';
  inicio: number;
  fin: number;
  /** Sin celda, el lienzo entero (cubre). */
  celda?: Celda;
  animacion?: Pick<Anim, 'entrada' | 'salida'>;
  /** En la pieza de la IZQUIERDA del corte (transiciones/claves.ts). */
  transicion?: { id: string; duracion: number };
  /** Al sustituirlo por un video, sin sonido (dos clips a la vez no se pisan la voz). */
  silenciar?: boolean;
};

export type EstiloTexto = {
  /** Un id de EFECTOS_TEXTO (text/estilos-predefinidos.ts). */
  efecto: string;
  fuente: string;
  /** Alto de la letra en px de LIENZO_REF. */
  px: number;
  negrita?: boolean;
  cursiva?: boolean;
  mayusculas?: boolean;
  alineacion?: 'centro' | 'izquierda';
  /** El relleno de la tarjeta en em (veces la letra): [horizontal, vertical]. Sólo con un efecto con fondo. */
  relleno?: [em_x: number, em_y: number];
  opacidad?: number;
};

export type AnclaPieza = { borde: 'arriba' | 'centro' | 'abajo'; y: number };

export type PiezaTexto = {
  tipo: 'texto';
  /** Sin hueco es decoración (la cuenta regresiva). */
  hueco?: HuecoTexto;
  muestra: string;
  pista: 'texto-1' | 'texto-2' | 'texto-3' | 'texto-4';
  inicio: number;
  fin: number;
  estilo: EstiloTexto;
  /** Qué borde de la caja va en `y` (px de LIENZO_REF desde arriba). */
  ancla: AnclaPieza;
  animacion?: Anim;
};

export type PiezaForma = {
  tipo: 'forma';
  forma: 'rectangle';
  pista: 'forma-1';
  inicio: number;
  fin: number;
  celda: Celda;
  /** Color de relleno (#rrggbb): es CONTENIDO del video, va en hex. */
  relleno: string;
  animacion?: Anim;
};

export type Pieza = PiezaClip | PiezaTexto | PiezaForma;

export type Plantilla = {
  id: string;
  nombre: string;
  /** La leen el chat y la API. */
  descripcion: string;
  duracion: number;
  /** El segundo que muestra la miniatura quieta. */
  portada: number;
  /** Un id de PLANTILLAS_SUBTITULO para los subtítulos automáticos (subtitles/estilos.ts). */
  subtitulos?: string;
  /** De qué plantilla de remotion-templates salen la idea y los tiempos (sin licencia: no el código). */
  ideaDe: string[];
  piezas: Pieza[];
};

// ── Los huecos de clip y el cierre común ─────────────────────────────────────

const CLIP: HuecoClip = { nombre: 'clip', rotulo: 'Tu clip', acepta: 'ambos' };
const ANTES: HuecoClip = { nombre: 'antes', rotulo: 'Antes', acepta: 'ambos' };
const DESPUES: HuecoClip = { nombre: 'despues', rotulo: 'Después', acepta: 'ambos' };
const PRODUCTO: HuecoClip = { nombre: 'producto', rotulo: 'Tu producto', acepta: 'ambos' };
/** El fondo del cierre: opcional (la muestra lisa sirve como está) y sin rótulo. */
const FINAL: HuecoClip = { nombre: 'final', rotulo: '', acepta: 'ambos', opcional: true };

/** Celdas APILADAS: en 9:16 una partición a lo ancho deja columnas de 540 px. */
const ARRIBA: Celda = { x: 0, y: 0, ancho: 1080, alto: 960 };
const ABAJO: Celda = { x: 0, y: 960, ancho: 1080, alto: 960 };

/** Segundos con la suma ya redondeada (12 + 0,6 no deja 12,600000000000001). */
const mas = (a: number, b: number) => Math.round((a + b) * 1000) / 1000;

/**
 * El cierre de «End Card»: la tarjeta escala en ~35 cuadros y el botón entra en el
 * cuadro 20 (≈ 0,67 s → 0,6 s). Va en la PRINCIPAL (ver la cabecera).
 */
function cierre(inicio: number, fin: number, titulo: string, cta: string): Pieza[] {
  return [
    { tipo: 'clip', hueco: FINAL, pista: 'principal', inicio, fin },
    {
      tipo: 'texto', hueco: { nombre: 'titulo-final', maxCaracteres: 32 }, muestra: titulo, pista: 'texto-1', inicio, fin,
      estilo: { efecto: 'sombra-suave', fuente: 'Montserrat', px: 72, negrita: true },
      ancla: { borde: 'centro', y: 620 }, animacion: { entrada: ['acercar', 0.6] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'cta', maxCaracteres: 20 }, muestra: cta, pista: 'texto-2', inicio: mas(inicio, 0.6), fin,
      estilo: { efecto: 'recuadro-amarillo', fuente: 'Montserrat', px: 64, negrita: true, relleno: [0.6, 0.3] },
      ancla: { borde: 'centro', y: 840 }, animacion: { entrada: ['aparecer-gradualmente', 0.5], bucle: ['pulso', 1] },
    },
  ];
}

// ── Las cinco ────────────────────────────────────────────────────────────────

const gancho: Plantilla = {
  id: 'gancho',
  nombre: 'Anuncio con gancho',
  descripcion: 'Una frase que frena el scroll, tu clip y un cierre con botón.',
  duracion: 15,
  portada: 1,
  subtitulos: 'palabra-resaltada',
  ideaDe: ['Popping Scale Text', 'End Card'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 12, transicion: { id: 'mezclar', duracion: 0.5 } },
    ...cierre(12, 15, '¿Listo para empezar?', 'Escríbenos hoy'),
    {
      tipo: 'texto', hueco: { nombre: 'gancho', maxCaracteres: 28 }, muestra: 'ESTO LO CAMBIA TODO', pista: 'texto-1', inicio: 0, fin: 2.5,
      estilo: { efecto: 'amarillo-trazo-negro', fuente: 'Anton', px: 104, mayusculas: true },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.5], salida: ['desaparecer-gradualmente', 0.3] },
    },
  ],
};

const testimonio: Plantilla = {
  id: 'testimonio',
  nombre: 'Testimonio',
  descripcion: 'Un cliente cuenta su experiencia: la cita, su nombre y un cierre.',
  duracion: 15,
  portada: 2,
  subtitulos: 'predeterminado',
  ideaDe: ['Quote Card', 'Lower Third', 'End Card'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 12, transicion: { id: 'mezclar', duracion: 0.5 } },
    ...cierre(12, 15, 'Únete a nuestros clientes', 'Pide el tuyo'),
    {
      tipo: 'texto', hueco: { nombre: 'cita', maxCaracteres: 48 }, muestra: '“Lo recomiendo a todos”', pista: 'texto-1', inicio: 0, fin: 3.5,
      estilo: { efecto: 'recuadro-blanco', fuente: 'Playfair Display', px: 72, cursiva: true, relleno: [0.45, 0.25] },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['subir', 0.6], salida: ['desaparecer-gradualmente', 0.3] },
    },
    {
      // «Lower Third»: crece hacia ARRIBA desde 1010 y el detalle, hacia abajo desde
      // 1030: un nombre en dos renglones no pisa el detalle.
      tipo: 'texto', hueco: { nombre: 'nombre', maxCaracteres: 28 }, muestra: 'María López', pista: 'texto-2', inicio: 1, fin: 6,
      estilo: { efecto: 'translucido', fuente: 'Montserrat', px: 56, negrita: true, alineacion: 'izquierda', relleno: [0.4, 0.2] },
      ancla: { borde: 'abajo', y: 1010 }, animacion: { entrada: ['deslizar-derecha', 0.5], salida: ['deslizar-izquierda', 0.4] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'detalle', maxCaracteres: 32 }, muestra: 'Clienta desde 2024', pista: 'texto-3', inicio: 1.3, fin: 6,
      estilo: { efecto: 'sombra-suave', fuente: 'Montserrat', px: 40, opacidad: 0.8, alineacion: 'izquierda' },
      ancla: { borde: 'arriba', y: 1030 },
      animacion: { entrada: ['aparecer-gradualmente', 0.4], salida: ['desaparecer-gradualmente', 0.3] },
    },
  ],
};

// Cada rótulo es UN hueco con dos piezas: grande sobre su clip y chico en la pantalla partida.
const ROTULO_ANTES: HuecoTexto = { nombre: 'rotulo-antes', maxCaracteres: 12 };
const ROTULO_DESPUES: HuecoTexto = { nombre: 'rotulo-despues', maxCaracteres: 12 };
type Rotulo = { hueco: HuecoTexto; muestra: string; efecto: string };
const R_ANTES: Rotulo = { hueco: ROTULO_ANTES, muestra: 'ANTES', efecto: 'recuadro-negro' };
const R_DESPUES: Rotulo = { hueco: ROTULO_DESPUES, muestra: 'DESPUÉS', efecto: 'recuadro-amarillo' };

const rotuloGrande = ({ hueco, muestra, efecto }: Rotulo, inicio: number, fin: number): PiezaTexto => ({
  tipo: 'texto', hueco, muestra, pista: 'texto-1', inicio, fin,
  estilo: { efecto, fuente: 'Anton', px: 96, mayusculas: true, relleno: [0.4, 0.15] },
  ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.4] },
});
const rotuloChico = ({ hueco, muestra, efecto }: Rotulo, pista: 'texto-1' | 'texto-2', inicio: number, y: number): PiezaTexto => ({
  tipo: 'texto', hueco, muestra, pista, inicio, fin: 11,
  estilo: { efecto, fuente: 'Anton', px: 64, mayusculas: true, alineacion: 'izquierda', relleno: [0.4, 0.15] },
  ancla: { borde: 'arriba', y }, animacion: { entrada: ['aparecer-gradualmente', 0.3], salida: ['desaparecer-gradualmente', 0.4] },
});

const antesDespues: Plantilla = {
  id: 'antes-despues',
  nombre: 'Antes y después',
  descripcion:
    'Muestra el cambio: el antes, el después y los dos juntos. Para cosmética o cirugía, Meta pide mostrarlo a mayores de 18; para bajar de peso, decir en cuánto tiempo.',
  duracion: 14,
  portada: 8,
  ideaDe: ['Split Screen', 'Image Comparison'],
  piezas: [
    { tipo: 'clip', hueco: ANTES, pista: 'principal', inicio: 0, fin: 3, transicion: { id: 'barrido-derecha', duracion: 0.5 } },
    { tipo: 'clip', hueco: DESPUES, pista: 'principal', inicio: 3, fin: 6 },
    {
      tipo: 'clip', hueco: ANTES, pista: 'principal', inicio: 6, fin: 11, celda: ARRIBA, silenciar: true,
      animacion: { entrada: ['deslizar-derecha', 0.5], salida: ['desaparecer-gradualmente', 0.4] },
    },
    ...cierre(11, 14, 'Tu cambio empieza hoy', 'Reserva tu cita'),
    {
      tipo: 'clip', hueco: DESPUES, pista: 'video-1', inicio: 6.2, fin: 11, celda: ABAJO, silenciar: true,
      animacion: { entrada: ['deslizar-izquierda', 0.5], salida: ['desaparecer-gradualmente', 0.4] },
    },
    {
      tipo: 'forma', forma: 'rectangle', pista: 'forma-1', inicio: 6.6, fin: 11, celda: { x: 0, y: 954, ancho: 1080, alto: 12 }, relleno: '#ffffff',
      animacion: { entrada: ['aparecer-gradualmente', 0.3], salida: ['desaparecer-gradualmente', 0.4] },
    },
    rotuloGrande(R_ANTES, 0.2, 3),
    rotuloGrande(R_DESPUES, 3.2, 6),
    rotuloChico(R_ANTES, 'texto-1', 6.6, 300),
    rotuloChico(R_DESPUES, 'texto-2', 6.8, 990),
  ],
};

const beneficio = (n: number, muestra: string, inicio: number, y: number): PiezaTexto => ({
  tipo: 'texto', hueco: { nombre: `beneficio-${n}`, maxCaracteres: 24 }, muestra,
  pista: `texto-${n + 1}` as PiezaTexto['pista'], inicio, fin: 12,
  estilo: { efecto: 'recuadro-blanco', fuente: 'Montserrat', px: 60, negrita: true, alineacion: 'izquierda', relleno: [0.45, 0.22] },
  ancla: { borde: 'arriba', y }, animacion: { entrada: ['deslizar-derecha', 0.5], salida: ['desaparecer-gradualmente', 0.3] },
});

const beneficios: Plantilla = {
  id: 'beneficios',
  nombre: 'Beneficios',
  descripcion: 'Tres razones para comprar, una tras otra, sobre tu clip.',
  duracion: 15,
  portada: 6,
  ideaDe: ['Animated List', 'End Card'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 12, transicion: { id: 'mezclar', duracion: 0.5 } },
    { tipo: 'clip', hueco: FINAL, pista: 'principal', inicio: 12, fin: 15 },
    {
      tipo: 'texto', hueco: { nombre: 'titulo', maxCaracteres: 28 }, muestra: '3 RAZONES PARA PROBARLO', pista: 'texto-1', inicio: 0, fin: 12,
      estilo: { efecto: 'blanco-trazo-negro', fuente: 'Anton', px: 88, mayusculas: true },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.5], salida: ['desaparecer-gradualmente', 0.3] },
    },
    // «Animated List»: 1,5 s entre ítems para que se lean.
    beneficio(1, 'Fácil de usar', 2, 560),
    beneficio(2, 'Envío gratis', 3.5, 720),
    beneficio(3, 'Garantía de 30 días', 5, 880),
    {
      tipo: 'texto', hueco: { nombre: 'cta', maxCaracteres: 20 }, muestra: 'Pruébalo hoy', pista: 'texto-1', inicio: 12.4, fin: 15,
      estilo: { efecto: 'recuadro-amarillo', fuente: 'Montserrat', px: 72, negrita: true, relleno: [0.6, 0.3] },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['rebote', 0.5], bucle: ['pulso', 1] },
    },
  ],
};

/** «Countdown Timer»: 0,8 s por número. Decoración: sin hueco. */
const numero = (n: string, inicio: number): PiezaTexto => ({
  tipo: 'texto', muestra: n, pista: 'texto-1', inicio, fin: mas(inicio, 0.8),
  estilo: { efecto: 'sombra-dura', fuente: 'Anton', px: 300 },
  ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['rebote', 0.3], salida: ['desaparecer-gradualmente', 0.3] },
});

const oferta: Plantilla = {
  id: 'oferta',
  nombre: 'Oferta con cuenta regresiva',
  descripcion: 'Tu producto, la oferta, una cuenta regresiva y el botón para comprar.',
  duracion: 15,
  portada: 4,
  ideaDe: ['Countdown Timer', 'End Card'],
  piezas: [
    { tipo: 'clip', hueco: PRODUCTO, pista: 'principal', inicio: 0, fin: 9, transicion: { id: 'destello-blanco', duracion: 0.4 } },
    { tipo: 'clip', hueco: FINAL, pista: 'principal', inicio: 9, fin: 15 },
    {
      tipo: 'texto', hueco: { nombre: 'gancho', maxCaracteres: 28 }, muestra: 'SOLO POR 48 HORAS', pista: 'texto-1', inicio: 0, fin: 3,
      estilo: { efecto: 'etiqueta-roja', fuente: 'Anton', px: 104, mayusculas: true, relleno: [0.4, 0.15] },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.5], salida: ['desaparecer-gradualmente', 0.3] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'oferta', maxCaracteres: 22 }, muestra: '50 % DE DESCUENTO', pista: 'texto-1', inicio: 3, fin: 9,
      estilo: { efecto: 'amarillo-trazo-negro', fuente: 'Anton', px: 112, mayusculas: true },
      ancla: { borde: 'arriba', y: 300 },
      animacion: { entrada: ['acercar', 0.5], bucle: ['latido', 1.2], salida: ['desaparecer-gradualmente', 0.3] },
    },
    numero('3', 9),
    numero('2', 9.8),
    numero('1', 10.6),
    {
      tipo: 'texto', hueco: { nombre: 'cta', maxCaracteres: 20 }, muestra: '¡COMPRA AHORA!', pista: 'texto-1', inicio: 11.4, fin: 15,
      estilo: { efecto: 'etiqueta-roja', fuente: 'Montserrat', px: 80, negrita: true, mayusculas: true, relleno: [0.6, 0.3] },
      ancla: { borde: 'centro', y: 700 }, animacion: { entrada: ['rebote', 0.5], bucle: ['pulso', 1] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'detalle', maxCaracteres: 28 }, muestra: 'Envío gratis incluido', pista: 'texto-2', inicio: 11.8, fin: 15,
      estilo: { efecto: 'sombra-suave', fuente: 'Montserrat', px: 48 },
      ancla: { borde: 'arriba', y: 830 }, animacion: { entrada: ['aparecer-gradualmente', 0.5] },
    },
  ],
};

// ── Las seis nuevas de docs/plantillas-reales/video.md (§2.2, 2.5–2.8 y 2.10; F164, 18/11/2026) ──
// Cada pieza es la fila de su tabla en el doc: segundos, pista, hueco con su tope, estilo y animación. Lo que la tabla
// no dice se copia de la pieza del catálogo que ya hace lo mismo, no se elige: el relleno de cada efecto con fondo
// (el test 1 exige «fondo ⇔ relleno») sale de la tarjeta de hoy con ese efecto, y «sale 0.3» es el
// `desaparecer-gradualmente` de todas. Las muestras son los textos del doc (≤ 5 palabras, test 7); el ejemplo lleno de
// cada una, en ./plantillas-ejemplos.ts.
// ⚠️ LA TOMA DE APOYO OPCIONAL VA SIN RÓTULO (doc §6, trampa 7): una muestra opcional que no se reemplaza se exporta
//    tal cual, y `quedanMuestras` no la cuenta. Con «Toma de apoyo» dibujado, saldría así en el anuncio.

/** La toma de apoyo opcional: encima de la principal, silenciada y sin rótulo (trampa 7). */
const BROLL: HuecoClip = { nombre: 'broll', rotulo: '', acepta: 'ambos', opcional: true };
/** «Sale 0.3»: el fundido de salida de todo el catálogo. */
const sale = (s: number): [string, number] => ['desaparecer-gradualmente', s];
/** La toma de apoyo de la tabla («0.3 / 0.3»): entra y sale con un fundido. */
const broll = (inicio: number, fin: number): PiezaClip => ({
  tipo: 'clip', hueco: BROLL, pista: 'video-1', inicio, fin, silenciar: true,
  animacion: { entrada: ['aparecer-gradualmente', 0.3], salida: sale(0.3) },
});
/** El gancho amarillo de arriba, el de `gancho` (Anton, trazo negro, mayúsculas, en y=300, rebota y se va). */
const ganchoArriba = (muestra: string, fin: number, px = 104): PiezaTexto => ({
  tipo: 'texto', hueco: { nombre: 'gancho', maxCaracteres: 28 }, muestra, pista: 'texto-1', inicio: 0, fin,
  estilo: { efecto: 'amarillo-trazo-negro', fuente: 'Anton', px, mayusculas: true },
  ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.5], salida: sale(0.3) },
});

const respuestaComentario: Plantilla = {
  id: 'respuesta-comentario',
  nombre: 'Respuesta a un comentario',
  descripcion: 'Respondes una pregunta de precio o de confianza, con la pregunta en una burbuja, y un cierre con botón.',
  duracion: 28,
  portada: 2,
  ideaDe: ['Quote Card', 'End Card'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 25, transicion: { id: 'mezclar', duracion: 0.5 } },
    ...cierre(25, 28, '3 llamadas revisadas: USD 150', 'Escribe LLAMADA'),
    // ⚠️ El rótulo dice «Pregunta frecuente» y nunca un @ inventado (doc 2.2: un @ inventado puede ser una cuenta real).
    {
      tipo: 'texto', hueco: { nombre: 'usuario', maxCaracteres: 24 }, muestra: 'Pregunta frecuente', pista: 'texto-2', inicio: 0, fin: 4,
      estilo: { efecto: 'sombra-suave', fuente: 'Montserrat', px: 36, negrita: true, opacidad: 0.8, alineacion: 'izquierda' },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['aparecer-gradualmente', 0.3] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'comentario', maxCaracteres: 80 }, muestra: '¿Pagar si YouTube es gratis?', pista: 'texto-1', inicio: 0.2, fin: 4,
      estilo: { efecto: 'recuadro-blanco', fuente: 'Montserrat', px: 52, negrita: true, alineacion: 'izquierda', relleno: [0.45, 0.25] },
      ancla: { borde: 'arriba', y: 350 }, animacion: { entrada: ['acercar', 0.3], salida: sale(0.3) },
    },
    {
      tipo: 'texto', hueco: { nombre: 'frase-clave', maxCaracteres: 28 }, muestra: 'LA CORRECCIÓN NO ES GRATIS', pista: 'texto-1', inicio: 10, fin: 14,
      estilo: { efecto: 'recuadro-amarillo', fuente: 'Montserrat', px: 72, negrita: true, mayusculas: true, relleno: [0.6, 0.3] },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.4], salida: sale(0.3) },
    },
  ],
};

/** Un número del caso: entra arriba, en amarillo, cuando se dice (doc 2.5, «ídem» de `dato-1`). */
const datoCaso = (n: number, muestra: string, inicio: number, fin: number): PiezaTexto => ({
  tipo: 'texto', hueco: { nombre: `dato-${n}`, maxCaracteres: 28 }, muestra, pista: 'texto-1', inicio, fin,
  estilo: { efecto: 'recuadro-amarillo', fuente: 'Montserrat', px: 64, negrita: true, mayusculas: true, relleno: [0.6, 0.3] },
  ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['acercar', 0.3], salida: sale(0.2) },
});

const casoNumeros: Plantilla = {
  id: 'caso-numeros',
  nombre: 'Caso con números',
  descripcion: 'Cuentas el caso de un cliente y, encima, la captura de su panel con cada número cuando lo dices.',
  duracion: 25,
  portada: 7,
  subtitulos: 'predeterminado',
  ideaDe: ['Animated List', 'End Card'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 22, transicion: { id: 'mezclar', duracion: 0.5 } },
    // La captura del panel a lienzo entero y silenciada: la voz sigue debajo.
    {
      tipo: 'clip', hueco: { nombre: 'pantalla', rotulo: 'Captura del panel', acepta: 'ambos' }, pista: 'video-1', inicio: 5, fin: 18,
      silenciar: true, animacion: { entrada: ['deslizar-arriba', 0.4], salida: sale(0.3) },
    },
    ...cierre(22, 25, '¿Tu clínica quiere lo mismo?', 'Escribe CITAS'),
    ganchoArriba('DE 6 A 23 VALORACIONES', 4),
    datoCaso(1, 'VALORACIONES: 6 → 23', 6, 10),
    datoCaso(2, '9 TRATAMIENTOS CERRADOS', 10.5, 14),
    datoCaso(3, 'MISMA INVERSIÓN EN ANUNCIOS', 14.5, 18),
  ],
};

/** Una etiqueta de la historia («ANTES · 2021», «EL CAMBIO», «DESDE 2022»): entra de costado arriba y se va. */
const etiquetaHistoria = (nombre: string, muestra: string, efecto: string, inicio: number, fin: number): PiezaTexto => ({
  tipo: 'texto', hueco: { nombre, maxCaracteres: 16 }, muestra, pista: 'texto-1', inicio, fin,
  estilo: {
    efecto, fuente: 'Montserrat', px: 56, negrita: true, mayusculas: true,
    // El relleno de la tarjeta de hoy con ese efecto: la etiqueta roja de `oferta`, el botón amarillo de `cierre()`.
    relleno: efecto === 'etiqueta-roja' ? [0.4, 0.15] : [0.6, 0.3],
  },
  ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['deslizar-izquierda', 0.3], salida: sale(0.2) },
});

const historia: Plantilla = {
  id: 'historia',
  nombre: 'Historia del fundador',
  descripcion: 'Antes, el quiebre y hoy: tu historia con un número que la prueba, y un cierre con botón.',
  duracion: 30,
  portada: 10,
  subtitulos: 'palabra-resaltada',
  ideaDe: ['Typewriter', 'End Card'],
  // ⚠️ El quiebre NO se arma con dos piezas del mismo hueco (doc §6, trampa 13): lo propone el Editor con `dividir`.
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 27, transicion: { id: 'mezclar', duracion: 0.5 } },
    broll(4, 8),
    ...cierre(27, 30, '¿Tu clínica pierde mensajes?', 'Escribe AUDITORIA'),
    ganchoArriba('PERDÍ 4 DE 6 CLÍNICAS', 3),
    etiquetaHistoria('etiqueta-antes', 'ANTES · 2021', 'etiqueta-roja', 3.2, 9),
    {
      // La máquina de escribir de la variante retirada `gancho-escrito` vive acá (doc 2.0): el quiebre se escribe solo.
      tipo: 'texto', hueco: { nombre: 'quiebre', maxCaracteres: 32 }, muestra: '14 mensajes, 5 respuestas', pista: 'texto-2', inicio: 9, fin: 13,
      estilo: { efecto: 'recuadro-blanco', fuente: 'Montserrat', px: 64, negrita: true, relleno: [0.45, 0.25] },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['maquina-escribir', 1], salida: sale(0.3) },
    },
    etiquetaHistoria('etiqueta-cambio', 'EL CAMBIO', 'recuadro-amarillo', 13.2, 20),
    etiquetaHistoria('etiqueta-hoy', 'DESDE 2022', 'recuadro-amarillo', 20.2, 27),
    {
      tipo: 'texto', hueco: { nombre: 'numero', maxCaracteres: 24 }, muestra: '31 CLÍNICAS ATENDIDAS', pista: 'texto-2', inicio: 21, fin: 27,
      estilo: { efecto: 'amarillo-trazo-negro', fuente: 'Anton', px: 112, mayusculas: true },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['acercar', 0.4], salida: sale(0.3) },
    },
  ],
};

/** El título de un bloque del reel («ERROR 1 · …»): recuadro negro arriba, todo el bloque (doc 2.7, «ídem» de `titulo-1`). */
const tituloError = (n: number, muestra: string, inicio: number, fin: number): PiezaTexto => ({
  tipo: 'texto', hueco: { nombre: `titulo-${n}`, maxCaracteres: 28 }, muestra, pista: 'texto-1', inicio, fin,
  // El relleno del recuadro negro de hoy (los rótulos de `antes-despues`).
  estilo: { efecto: 'recuadro-negro', fuente: 'Montserrat', px: 60, negrita: true, mayusculas: true, relleno: [0.4, 0.15] },
  ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['deslizar-izquierda', 0.3], salida: sale(0.2) },
});

const tresErrores: Plantilla = {
  id: 'tres-errores',
  nombre: 'Reel de 3 errores',
  descripcion: 'Enseñas tres errores, uno por bloque con su título, pides un comentario y cierras con un botón.',
  duracion: 38,
  portada: 4,
  subtitulos: 'palabra-resaltada',
  ideaDe: ['Animated List'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 38 },
    broll(14, 16),
    ganchoArriba('3 ERRORES ANTE EL DIRECTORIO', 3, 100),
    tituloError(1, 'ERROR 1 · INICIO IMPROVISADO', 3, 11),
    tituloError(2, 'ERROR 2 · LEER DIAPOSITIVAS', 11, 20),
    tituloError(3, 'ERROR 3 · DEMASIADOS DATOS', 20, 29),
    {
      tipo: 'texto', hueco: { nombre: 'pregunta', maxCaracteres: 24 }, muestra: 'Comenta 1, 2 o 3', pista: 'texto-2', inicio: 29, fin: 35,
      estilo: { efecto: 'recuadro-blanco', fuente: 'Montserrat', px: 72, negrita: true, relleno: [0.45, 0.25] },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['rebote', 0.5], salida: sale(0.3) },
    },
    {
      tipo: 'texto', hueco: { nombre: 'cta', maxCaracteres: 20 }, muestra: 'Escribe JUNTA', pista: 'texto-2', inicio: 35, fin: 38,
      estilo: { efecto: 'recuadro-amarillo', fuente: 'Montserrat', px: 72, negrita: true, relleno: [0.6, 0.3] },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['rebote', 0.5], bucle: ['pulso', 1] },
    },
  ],
};

const clipPodcast: Plantilla = {
  id: 'clip-podcast',
  nombre: 'Clip de podcast o clase',
  descripcion: 'Un momento de un video largo (podcast, clase, webinar) en vertical, con su gancho y de dónde sale.',
  duracion: 40,
  portada: 1,
  subtitulos: 'karaoke',
  ideaDe: ['Popping Scale Text'],
  piezas: [
    { tipo: 'clip', hueco: CLIP, pista: 'principal', inicio: 0, fin: 40 },
    ganchoArriba('TU PRECIO NO ES CARO', 3),
    {
      tipo: 'texto', hueco: { nombre: 'encabezado', maxCaracteres: 32 }, muestra: 'Podcast Ventas sin presión', pista: 'texto-3', inicio: 3, fin: 37,
      estilo: { efecto: 'sombra-suave', fuente: 'Montserrat', px: 36, opacidad: 0.8 },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['aparecer-gradualmente', 0.4] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'cta', maxCaracteres: 32 }, muestra: 'Episodio completo en el perfil', pista: 'texto-1', inicio: 37, fin: 40,
      estilo: { efecto: 'recuadro-blanco', fuente: 'Montserrat', px: 56, negrita: true, relleno: [0.45, 0.25] },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['subir', 0.4] },
    },
  ],
};

// Los seis espacios del tour: uno por toma, en el orden del recorrido.
const FACHADA: HuecoClip = { nombre: 'fachada', rotulo: 'Fachada u obra', acepta: 'ambos' };
const SALA: HuecoClip = { nombre: 'sala', rotulo: 'Sala', acepta: 'ambos' };
const COCINA: HuecoClip = { nombre: 'cocina', rotulo: 'Cocina', acepta: 'ambos' };
const RECAMARA: HuecoClip = { nombre: 'recamara', rotulo: 'Recámara', acepta: 'ambos' };
const AMENIDAD: HuecoClip = { nombre: 'amenidad', rotulo: 'Amenidad', acepta: 'ambos' };
const ASESOR: HuecoClip = { nombre: 'asesor', rotulo: 'Asesor a cámara', acepta: 'ambos' };

/** Un dato de la ficha en una etiqueta abajo, mientras se ve su espacio (doc 2.10: cada etiqueta es un dato de la ficha). */
const chipTour = (n: number, muestra: string, inicio: number, fin: number): PiezaTexto => ({
  tipo: 'texto', hueco: { nombre: `chip-${n}`, maxCaracteres: 28 }, muestra, pista: 'texto-2', inicio, fin,
  estilo: { efecto: 'recuadro-blanco', fuente: 'Montserrat', px: 48, negrita: true, relleno: [0.45, 0.25] },
  ancla: { borde: 'abajo', y: 1200 }, animacion: { entrada: ['deslizar-arriba', 0.3], salida: sale(0.2) },
});

const tourPropiedad: Plantilla = {
  id: 'tour-propiedad',
  nombre: 'Tour de propiedad',
  descripcion: 'Un espacio por toma con sus datos en etiquetas, y el asesor a cámara invitando a la visita.',
  duracion: 24,
  portada: 1,
  // Sin subtítulos: mientras no hay voz no hay qué subtitular (doc 2.10; se generan sólo sobre el asesor).
  ideaDe: ['Lower Third', 'Animated List'],
  piezas: [
    { tipo: 'clip', hueco: FACHADA, pista: 'principal', inicio: 0, fin: 3, transicion: { id: 'empujar-izquierda', duracion: 0.3 } },
    { tipo: 'clip', hueco: SALA, pista: 'principal', inicio: 3, fin: 6, transicion: { id: 'empujar-izquierda', duracion: 0.3 } },
    { tipo: 'clip', hueco: COCINA, pista: 'principal', inicio: 6, fin: 9, transicion: { id: 'empujar-izquierda', duracion: 0.3 } },
    { tipo: 'clip', hueco: RECAMARA, pista: 'principal', inicio: 9, fin: 12, transicion: { id: 'empujar-izquierda', duracion: 0.3 } },
    { tipo: 'clip', hueco: AMENIDAD, pista: 'principal', inicio: 12, fin: 15, transicion: { id: 'mezclar', duracion: 0.4 } },
    { tipo: 'clip', hueco: ASESOR, pista: 'principal', inicio: 15, fin: 24 },
    {
      tipo: 'texto', hueco: { nombre: 'gancho', maxCaracteres: 28 }, muestra: 'DEPTO CON VISTA AL PARQUE', pista: 'texto-1', inicio: 0, fin: 3,
      estilo: { efecto: 'amarillo-trazo-negro', fuente: 'Anton', px: 96, mayusculas: true },
      ancla: { borde: 'arriba', y: 300 }, animacion: { entrada: ['rebote', 0.5] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'precio', maxCaracteres: 20 }, muestra: 'DESDE MXN 2.4 M', pista: 'texto-2', inicio: 0.4, fin: 3,
      estilo: { efecto: 'recuadro-negro', fuente: 'Montserrat', px: 56, negrita: true, mayusculas: true, relleno: [0.4, 0.15] },
      ancla: { borde: 'arriba', y: 560 }, animacion: { entrada: ['deslizar-arriba', 0.3] },
    },
    chipTour(1, '78 m² frente al parque', 3.2, 5.9),
    chipTour(2, 'Cocina integral con barra', 6.2, 8.9),
    chipTour(3, '2 recámaras · 2 baños', 9.2, 11.9),
    chipTour(4, 'Roof garden y alberca', 12.2, 14.9),
    // El zócalo de `testimonio`, tal cual: el nombre crece hacia arriba desde 1010 y el detalle, hacia abajo desde 1030.
    {
      tipo: 'texto', hueco: { nombre: 'nombre', maxCaracteres: 28 }, muestra: 'Karen Méndez', pista: 'texto-2', inicio: 15.5, fin: 20,
      estilo: { efecto: 'translucido', fuente: 'Montserrat', px: 56, negrita: true, alineacion: 'izquierda', relleno: [0.4, 0.2] },
      ancla: { borde: 'abajo', y: 1010 }, animacion: { entrada: ['deslizar-derecha', 0.5], salida: ['deslizar-izquierda', 0.4] },
    },
    {
      tipo: 'texto', hueco: { nombre: 'detalle', maxCaracteres: 32 }, muestra: 'Asesora · Torre Alameda', pista: 'texto-3', inicio: 15.8, fin: 20,
      estilo: { efecto: 'sombra-suave', fuente: 'Montserrat', px: 40, opacidad: 0.8, alineacion: 'izquierda' },
      ancla: { borde: 'arriba', y: 1030 },
      animacion: { entrada: ['aparecer-gradualmente', 0.4], salida: sale(0.3) },
    },
    {
      tipo: 'texto', hueco: { nombre: 'cta', maxCaracteres: 20 }, muestra: 'Escribe VISITA', pista: 'texto-1', inicio: 20.5, fin: 24,
      estilo: { efecto: 'recuadro-amarillo', fuente: 'Montserrat', px: 72, negrita: true, relleno: [0.6, 0.3] },
      ancla: { borde: 'centro', y: 760 }, animacion: { entrada: ['rebote', 0.5], bucle: ['pulso', 1] },
    },
  ],
};

// ⚠️ «Gancho escrito» y «Oferta con glitch» SE RETIRARON el 18/11/2026 (doc 2.0, F164): eran su original con otra
//    animación, y con el ejemplo lleno quedaban dos tarjetas iguales en la grilla. La máquina de escribir quedó en el
//    quiebre de `historia`; el glitch, como transición que el Editor puede usar. Un proyecto viejo armado con ellas sigue
//    andando (doc §6, trampa 14): `chat/linea.ts` sólo pierde el tope de caracteres de sus huecos.

/** En el orden de la tabla del doc (2.0): por objetivo, de vender una llamada a la propiedad. */
export const PLANTILLAS: readonly Plantilla[] = [
  gancho, respuestaComentario, beneficios, testimonio, casoNumeros, historia, tresErrores, clipPodcast, oferta, tourPropiedad,
  antesDespues,
];

export function plantillaPorId(id: unknown): Plantilla | null {
  return typeof id === 'string' ? (PLANTILLAS.find((p) => p.id === id) ?? null) : null;
}

/**
 * La galería en el orden en que se muestra: primero las sugeridas para ESTE negocio, con su porqué, y después las
 * demás en el orden de siempre (lib/plantillas-sugeridas.ts; la tabla, ./plantillas-etiquetas.ts). Sin señales, el
 * orden de siempre. Lo usan la pestaña Plantillas, la API de MaKo y el chat: los tres, la misma lista.
 */
export const plantillasEnOrden = (senales: SenalesNegocio | null | undefined): ConSugerencia<Plantilla>[] =>
  ordenarConSugeridas(PLANTILLAS, ETIQUETAS_VIDEO, senales);

// ── Los huecos ───────────────────────────────────────────────────────────────

export type Hueco = {
  nombre: string;
  tipo: 'clip' | 'texto';
  /** Clip: qué acepta, su rótulo de muestra y si se puede dejar la muestra. */
  acepta?: HuecoClip['acepta'];
  rotulo?: string;
  opcional?: boolean;
  /** Texto: el tope y lo que dice la plantilla. */
  maxCaracteres?: number;
  muestra?: string;
  /** Lo que dura su pieza más larga: un video más corto no lo llena («Muy corto», como CapCut). */
  segundos: number;
};

/** Los huecos de una plantilla: primero los clips, después los textos en el orden en que aparecen. */
export function huecosDe(p: Plantilla): Hueco[] {
  const porNombre = new Map<string, Hueco & { desde: number }>();
  for (const pieza of p.piezas) {
    if (pieza.tipo === 'forma' || !pieza.hueco) continue;
    const dura = Math.round((pieza.fin - pieza.inicio) * 1000) / 1000;
    const ya = porNombre.get(pieza.hueco.nombre);
    if (ya) {
      ya.segundos = Math.max(ya.segundos, dura);
      ya.desde = Math.min(ya.desde, pieza.inicio);
      continue;
    }
    porNombre.set(
      pieza.hueco.nombre,
      pieza.tipo === 'clip'
        ? {
            nombre: pieza.hueco.nombre, tipo: 'clip', acepta: pieza.hueco.acepta, rotulo: pieza.hueco.rotulo,
            opcional: pieza.hueco.opcional === true, segundos: dura, desde: pieza.inicio,
          }
        : {
            nombre: pieza.hueco.nombre, tipo: 'texto', maxCaracteres: pieza.hueco.maxCaracteres, muestra: pieza.muestra,
            segundos: dura, desde: pieza.inicio,
          },
    );
  }
  return [...porNombre.values()]
    .map((h, orden) => ({ h, orden }))
    .sort((a, b) => (a.h.tipo === b.h.tipo ? (a.h.tipo === 'clip' ? a.orden - b.orden : a.h.desde - b.h.desde) : a.h.tipo === 'clip' ? -1 : 1))
    .map(({ h: { desde: _desde, ...h } }) => h);
}

/** Como las `modifications` de Creatomate: nombre del hueco → texto, o medio para un clip. */
export type Valores = Record<string, string | { medio: string }>;

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Caracteres de verdad (un emoji es uno), no unidades de UTF-16. */
export const largoTexto = (s: string) => [...s].length;

/** Lo que mandan el chat o la page para llenar una plantilla. El motivo lo lee la IA. */
export function validarValores(p: Plantilla, v: unknown): { ok: true; valores: Valores } | { ok: false; motivo: string } {
  if (v == null) return { ok: true, valores: {} };
  if (!esObjeto(v)) return { ok: false, motivo: 'los valores van como un objeto {"hueco": valor}' };
  const huecos = new Map(huecosDe(p).map((h) => [h.nombre, h]));
  const valores: Valores = {};
  for (const [nombre, valor] of Object.entries(v)) {
    const h = huecos.get(nombre);
    if (!h) {
      return { ok: false, motivo: `la plantilla "${p.id}" no tiene el hueco "${nombre}" (tiene: ${[...huecos.keys()].join(', ')})` };
    }
    if (h.tipo === 'texto') {
      if (typeof valor !== 'string') return { ok: false, motivo: `"${nombre}" es un texto: va como texto, no como un medio` };
      const t = valor.trim();
      if (!t) return { ok: false, motivo: `"${nombre}" está vacío` };
      const largo = largoTexto(t);
      if (largo > (h.maxCaracteres ?? 0)) {
        return { ok: false, motivo: `"${nombre}" admite hasta ${h.maxCaracteres} caracteres (tiene ${largo})` };
      }
      valores[nombre] = t;
    } else {
      const medio = esObjeto(valor) && typeof valor.medio === 'string' ? valor.medio.trim() : '';
      if (!medio) return { ok: false, motivo: `"${nombre}" es un clip: va como {"medio": "<ref del medio>"}` };
      valores[nombre] = { medio };
    }
  }
  return { ok: true, valores };
}

// ── Lo que lee la API de MaKo (listar_plantillas_video) ──────────────────────
// El catálogo en JSON, sin las piezas (tiempos, estilos, posiciones): lo que sirve para
// elegir una plantilla y decir qué llenar. Usarla por la API NO se puede: el proyecto vive
// en el navegador de quien edita (docs/hallazgos-video-editor.md → «La API de MaKo y el
// chat al costado»). Puro, para que lo pruebe un test sin el runner (que es server-only).
// Las señales del negocio las lee el runner: sale el MISMO orden que la pestaña, con la
// sugerida marcada (`sugerida: "<porqué>"`).

export function plantillasParaApi(senales?: SenalesNegocio | null) {
  return {
    total: PLANTILLAS.length,
    formato: { relacion: '9:16', ancho: LIENZO_REF.ancho, alto: LIENZO_REF.alto },
    plantillas: plantillasEnOrden(senales).map(({ plantilla: p, porque }) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      ...(porque ? { sugerida: porque } : {}),
      duracion_segundos: p.duracion,
      huecos: huecosDe(p).map((h) =>
        h.tipo === 'clip'
          ? { nombre: h.nombre, tipo: 'clip' as const, acepta: h.acepta ?? 'ambos', segundos: h.segundos, opcional: h.opcional === true }
          : { nombre: h.nombre, tipo: 'texto' as const, max_caracteres: h.maxCaracteres ?? 0, ejemplo: h.muestra ?? '' },
      ),
    })),
    notas: [
      'Primero van las sugeridas para este negocio (por cómo vende, según sus funnels, su oferta y su diagnóstico); "sugerida" dice por qué. Las demás, en el orden de la pestaña.',
      'Un hueco de clip se llena con un video o una foto de Multimedia: un video más corto que sus segundos no entra; una foto sirve siempre. Uno opcional puede quedar con su imagen de muestra.',
      'Usar una plantilla no se puede por la API: el proyecto vive en el navegador. Se usa en /video-editor, en la pestaña Plantillas o pidiéndoselo al chat «Editar con IA» con la línea de tiempo vacía.',
    ],
  };
}

// ── La caja ESTIMADA de un texto ─────────────────────────────────────────────
// Sin medir con la fuente (eso pasa en el navegador, subtitles/build-subtitle-text-
// element.ts → partirYUbicar): la usan la miniatura de la pestaña y el test de la zona
// segura. Anchos medios por letra en em, a ojo y del lado ancho (mejor que sobre caja
// a que la zona segura se pase de verdad).

const ANCHO_LETRA: Record<string, { minuscula: number; mayuscula: number }> = {
  Anton: { minuscula: 0.45, mayuscula: 0.55 },
  Montserrat: { minuscula: 0.62, mayuscula: 0.78 },
  'Playfair Display': { minuscula: 0.52, mayuscula: 0.68 },
};
const ANCHO_ESPACIO = 0.28;
/** El interlineado por defecto del motor (timeline/defaults.ts, `lineHeight`). */
const INTERLINEADO = 1.2;

/** El rectángulo que ocupa un texto (con su tarjeta), en px de LIENZO_REF. */
export function cajaDeTexto(p: PiezaTexto, texto: string = p.muestra): Celda {
  const { px, fuente, mayusculas, relleno, alineacion } = p.estilo;
  const letra = ANCHO_LETRA[fuente] ?? ANCHO_LETRA.Montserrat;
  const visto = mayusculas ? texto.toUpperCase() : texto;
  const ancho = (s: string) =>
    [...s].reduce((a, c) => a + (c === ' ' ? ANCHO_ESPACIO : c !== c.toLowerCase() ? letra.mayuscula : letra.minuscula), 0) * px;
  const disponible = LIENZO_REF.ancho * (1 - 2 * MARGEN_TEXTO);
  // Partida por palabras como partirEnLineas: una palabra que no entra baja entera.
  const lineas: string[] = [];
  for (const palabra of visto.trim().split(/\s+/).filter(Boolean)) {
    const ultima = lineas[lineas.length - 1];
    if (ultima !== undefined && ancho(`${ultima} ${palabra}`) <= disponible) lineas[lineas.length - 1] = `${ultima} ${palabra}`;
    else lineas.push(palabra);
  }
  if (lineas.length === 0) lineas.push('');
  const [rx, ry] = relleno ?? [0, 0];
  const w = Math.max(...lineas.map(ancho)) + 2 * rx * px;
  const h = lineas.length * px * INTERLINEADO + 2 * ry * px;
  // partirYUbicar ubica la caja ENTERA (con la tarjeta): a la izquierda, el borde de la
  // tarjeta va en el margen y la letra entra `rx` más adentro.
  const x = alineacion === 'izquierda' ? LIENZO_REF.ancho * MARGEN_TEXTO : (LIENZO_REF.ancho - w) / 2;
  const { borde, y } = p.ancla;
  const arriba = borde === 'arriba' ? y : borde === 'centro' ? y - h / 2 : y - h;
  return { x, y: arriba, ancho: w, alto: h };
}
