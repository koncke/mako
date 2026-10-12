// =============================================================================
// editor-landing/plantillas — landings completas y «diseños de sección»
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer todo
// lo que ahí se hace.» Gamma ofrece plantillas para arrancar (Panel → Plantillas, y
// «Plantillas» en Crear) y, adentro del editor, DISEÑOS DE SECCIÓN que se insertan con su
// estructura armada («Un encabezado y tres columnas», «Título y subtítulo», «Imagen
// principal + título», «Una foto hermosa con texto superpuesto», «Un encabezado, un
// párrafo y un botón»…: relevo gamma-catalogo §6).
//
// PURO: lo leen el Panel y Crear (paquete J), «Agregar bloque» (paquete H) y la IA
// (paquete E, como ejemplos). Todo se arma con la gramática de ia-bloques.ts y
// `bloquesATarjetas`, así cada plantilla pasa por la MISMA validación que lo que escribe
// la IA (variantes, tonos, íconos, campos) y nace con ids nuevos en cada llamada.
//
// Reglas del copy (y por qué):
//   · Español NEUTRO (tú). El guard de voseo barre lib/.
//   · HUECOS ENTRE CORCHETES para todo lo que es del negocio: «[Tu servicio]», «[00]%»,
//     «[Nombre del cliente]». Un marcador se ve como lo que es; un dato de ejemplo se lee
//     como un dato (AGENTS.md: «el ejemplo que una pantalla dibuja con datos de un cliente
//     REAL se lee como un dato»). Ningún nombre de una persona o de un negocio real: lo
//     frena tests/editor-landing-plantillas.test.ts.
//   · Sin cifras, testimonios ni logos inventados: van como marcadores.
//   · Las imágenes de acento quedan SIN CARGAR (imagenSrc null): el editor muestra el
//     hueco para elegir. Una foto de stock elegida acá sería la misma en todas las landings.
//   · Los botones de captación apuntan al formulario de la página ('#formulario', que
//     `bloquesATarjetas` resuelve a '#t-<id>'). Los de pago quedan en '#': el enlace de
//     cobro es del negocio y no se inventa.
// =============================================================================

import { nuevoId, docPagina, type JsonNodo, type LandingContenido, type Pagina } from './doc';
import { CONFIG_DEFAULT } from './api-tipos';
import { TEMAS } from './temas';
import {
  bloquesATarjeta, bloquesATarjetas, primerIcono,
  type TarjetaIA, type BloqueIA, type ItemOptimizadoIA, type CampoIA, type BotonIA,
} from './ia-bloques';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIAS_PLANTILLA = ['Agendar', 'Captar contactos', 'Vender', 'Eventos', 'Servicios', 'Después del registro'] as const;
export type CategoriaPlantilla = (typeof CATEGORIAS_PLANTILLA)[number];

export type Plantilla = {
  id: string;
  nombre: string;
  /** Una frase para la tarjeta del Panel. */
  descripcion: string;
  categoria: CategoriaPlantilla;
  /** Id de TEMAS (lib/editor-landing/temas.ts). */
  tema: string;
  /** El documento, con ids NUEVOS en cada llamada (dos landings de la misma plantilla no comparten ids). */
  contenido: () => LandingContenido;
};

export type DisenoSeccion = {
  id: string;
  nombre: string;
  /** Ícono de lib/editor-landing/iconos.ts. */
  icono: string;
  /** Una tarjeta nueva (ids nuevos en cada llamada). */
  crear: () => JsonNodo;
};

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas para escribir las plantillas
// ─────────────────────────────────────────────────────────────────────────────

// El tema sugerido: el primero que exista en el catálogo (temas.ts, paquete B), o el default.
const IDS_TEMA = new Set<string>(TEMAS.map((t) => t.id));
const temaDe = (...candidatos: string[]): string => candidatos.find((c) => IDS_TEMA.has(c)) ?? CONFIG_DEFAULT.tema;

// Íconos: nombres del set de iconos.ts (paquete B, nombres en español). Se proponen sinónimos y
// queda el primero que exista: si el set cambia un nombre, el ítem se queda sin ícono en vez de
// guardar uno que no existe (el test exige que los diseños «con íconos» los tengan todos).
const I = {
  rayo: ['rayo', 'fuego'],
  objetivo: ['objetivo', 'brujula'],
  reloj: ['reloj', 'cronometro'],
  calendario: ['calendario-check', 'calendario'],
  check: ['check', 'exito', 'sello'],
  escudo: ['escudo', 'candado'],
  estrella: ['estrella', 'estrella-llena'],
  grafico: ['grafico', 'reporte', 'velocimetro'],
  usuarios: ['usuarios', 'comunidad'],
  chat: ['chat-texto', 'chat', 'comentarios'],
  regalo: ['regalo'],
  video: ['video', 'videollamada', 'camara'],
  libro: ['libro', 'graduacion'],
  cohete: ['cohete'],
  dinero: ['dinero', 'monedas', 'dolar'],
  herramienta: ['herramienta', 'engranaje'],
  candado: ['candado', 'escudo'],
  trofeo: ['trofeo', 'medalla'],
  archivo: ['archivo', 'portapapeles'],
  engranaje: ['engranaje', 'ajustes'],
  chispa: ['destellos', 'brillo'],
  acuerdo: ['apreton', 'mano-corazon'],
  idea: ['bombilla', 'cerebro'],
  correo: ['mail', 'enviar'],
  mundo: ['mundo', 'globo'],
  alerta: ['advertencia', 'precaucion'],
} as const;
type NombreIcono = keyof typeof I;

const it = (titulo: string, texto = '', icono?: NombreIcono, extra: Partial<ItemOptimizadoIA> = {}): ItemOptimizadoIA => {
  const x: ItemOptimizadoIA = { titulo, texto, ...extra };
  const ic = icono ? primerIcono(...I[icono]) : undefined;
  if (ic) x.icono = ic;
  return x;
};

const h2 = (texto: string): BloqueIA => ({ t: 'h2', texto });
const p = (texto: string): BloqueIA => ({ t: 'p', texto });
const pg = (texto: string): BloqueIA => ({ t: 'p-grande', texto });
const ante = (texto: string): BloqueIA => ({ t: 'antetitulo', texto });
const opt = (variante: Extract<BloqueIA, { t: 'optimizado' }>['variante'], items: ItemOptimizadoIA[], columnas?: number): BloqueIA => ({ t: 'optimizado', variante, items, ...(columnas ? { columnas } : {}) });
const botones = (...items: BotonIA[]): BloqueIA => ({ t: 'botones', items });
const boton = (texto: string, destino = '#formulario', estilo: BotonIA['estilo'] = 'primario'): BotonIA => ({ texto, destino, estilo });
const preguntas = (items: [string, string][]): BloqueIA => ({ t: 'desplegables', items: items.map(([titulo, texto]) => ({ titulo, texto })) });
const garantia = (texto: string): BloqueIA => ({ t: 'recuadro', tono: 'exito', texto });
const formulario = (campos: CampoIA[], textoBoton: string, exito = '¡Gracias! Ya recibimos tus datos.'): BloqueIA => ({ t: 'formulario', campos, boton: textoBoton, exito });

const NOMBRE: CampoIA = { tipo: 'nombre', etiqueta: 'Nombre', requerido: true };
const EMAIL: CampoIA = { tipo: 'email', etiqueta: 'Correo electrónico', requerido: true };
const TELEFONO: CampoIA = { tipo: 'telefono', etiqueta: 'Teléfono (WhatsApp)', requerido: true };
const EMPRESA: CampoIA = { tipo: 'empresa', etiqueta: 'Empresa', requerido: false };

/** Tres testimonios con marcadores explícitos (nunca inventados). */
const testimoniosMarcadores = (variante: 'citas-caras' | 'citas' = 'citas-caras'): BloqueIA => opt(variante, [1, 2, 3].map(() =>
  it('[Nombre del cliente] · [Cargo o negocio]', '«[Lo que dijo el cliente sobre el resultado que obtuvo, con sus palabras]»')));

// Lo que la conversión corrigió o tiró al armar una plantilla. Una plantilla bien escrita no
// tiene NINGUNO: si una variante, un ícono o un destino no existe, la conversión lo arregla
// en silencio para quien la usa, y el test necesita verlo (`armarConDescartes`).
let colector: string[] | undefined;

/** Arma algo de este módulo y devuelve también lo que la conversión tuvo que corregir. */
export function armarConDescartes<T>(armar: () => T): { valor: T; descartes: string[] } {
  const previo = colector;
  const descartes: string[] = [];
  colector = descartes;
  try {
    return { valor: armar(), descartes };
  } finally {
    colector = previo;
  }
}

function pagina(titulo: string, ruta: string, tarjetas: TarjetaIA[], seo?: { titulo: string; descripcion: string }): Pagina {
  return {
    id: nuevoId('p'),
    titulo,
    ruta,
    doc: docPagina(bloquesATarjetas(tarjetas, { descartes: colector })),
    ...(seo ? { seoTitulo: seo.titulo, seoDescripcion: seo.descripcion } : {}),
  };
}

const doc = (...paginas: Pagina[]): LandingContenido => ({ v: 1, paginas });

// ─────────────────────────────────────────────────────────────────────────────
// Las 10 landings
// ─────────────────────────────────────────────────────────────────────────────

const agendaLlamada = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'derecha',
    bloques: [
      ante('[Tu especialidad] para [tu cliente ideal]'),
      { t: 'titulo', texto: 'Consigue [resultado concreto] sin [lo que más le cuesta hoy]' },
      pg('En una llamada de 30 minutos revisamos tu caso y te decimos, con claridad, qué haríamos en tu lugar.'),
      botones(boton('Agendar mi llamada')),
    ],
    notas: 'La promesa del título tiene que ser concreta: qué logra, para quién y en cuánto tiempo.',
  },
  {
    bloques: [
      h2('¿Te suena familiar?'),
      opt('vinetas-iconos', [
        it('[Primer dolor de tu cliente]', '[Cómo se siente o qué le cuesta en su día a día]', 'alerta'),
        it('[Segundo dolor]', '[Qué intentó y por qué no le funcionó]', 'reloj'),
        it('[Tercer dolor]', '[Qué pierde si sigue igual]', 'dinero'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Así funciona'),
      opt('etapas-horizontales', [
        it('Agendas', 'Eliges el día y la hora que te queden bien.'),
        it('Conversamos', 'Revisamos tu situación y tus objetivos en 30 minutos.'),
        it('Te llevas un plan', 'Sales de la llamada con los próximos pasos claros, trabajes o no con nosotros.'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Lo que te llevas de la llamada'),
      opt('iconos-texto', [
        it('Un diagnóstico', '[Qué miras de su caso y qué le dices]', 'objetivo'),
        it('Un plan de acción', '[Los pasos concretos que le propones]', 'idea'),
        it('Una respuesta honesta', 'Si no somos la mejor opción para ti, te lo decimos.', 'acuerdo'),
      ]),
    ],
  },
  { bloques: [h2('Lo que dicen quienes ya trabajaron con nosotros'), testimoniosMarcadores()] },
  {
    diseno: 'izquierda',
    bloques: [
      ante('Quién te va a atender'),
      h2('[Tu nombre]'),
      p('[Tu historia en dos o tres líneas: qué haces, desde cuándo y por qué te dedicas a esto.]'),
      { t: 'lista', items: ['[Un logro o credencial verificable]', '[Otro logro o credencial]', '[Algo que te distinga]'] },
    ],
  },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿La llamada tiene costo?', '[Aclara si es gratuita y qué pasa después.]'],
        ['¿Cuánto dura?', '30 minutos.'],
        ['¿Qué necesito tener listo?', '[Lo que conviene que la persona prepare antes.]'],
        ['¿Y si no puedo en el horario que elegí?', '[Cómo reprogramar.]'],
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('Agenda tu llamada'),
      p('Déjanos tus datos y te escribimos para confirmar el día y la hora.'),
      formulario([NOMBRE, EMAIL, TELEFONO, { tipo: 'textoLargo', etiqueta: '¿Qué te gustaría resolver?', requerido: false }], 'Agendar mi llamada'),
    ],
  },
], { titulo: '[Tu servicio]: agenda una llamada', descripcion: '[Resultado que consigue tu cliente]. Agenda una llamada de 30 minutos y sal con un plan claro.' }));

const webinar = (): LandingContenido => doc(
  pagina('Inicio', '', [
    {
      diseno: 'fondo',
      superposicion: 'oscura',
      bloques: [
        { t: 'etiqueta', texto: 'Clase en vivo y gratuita' },
        { t: 'titulo', texto: '[Tema de la clase]: [la promesa en una línea]' },
        pg('[Día] a las [hora] ([zona horaria]). En [duración] te muestro [lo que la persona va a aprender].'),
        botones(boton('Reservar mi lugar')),
      ],
    },
    {
      bloques: [
        h2('Los detalles'),
        opt('cajas-iconos', [
          it('Fecha', '[Día y mes]', 'calendario'),
          it('Hora', '[Hora y zona horaria]', 'reloj'),
          it('Duración', '[60 minutos]', 'video'),
          it('Dónde', 'En vivo por [plataforma]. Te llega el enlace por correo.', 'mundo'),
        ], 4),
      ],
    },
    {
      bloques: [
        h2('Lo que vas a aprender'),
        opt('vinetas-numeradas', [
          it('[Primer aprendizaje]', '[Por qué le importa a quien asiste]'),
          it('[Segundo aprendizaje]', '[Qué va a poder hacer después]'),
          it('[Tercer aprendizaje]', '[El error que va a dejar de cometer]'),
          it('[Cuarto aprendizaje]', '[El resultado que puede esperar]'),
        ]),
      ],
    },
    {
      bloques: [
        h2('¿Es para ti?'),
        opt('pros-contras', [
          it('Es para ti si…', '[Situación de la persona ideal]\n\n[Lo que ya intentó]\n\n[Lo que quiere lograr]'),
          it('No es para ti si…', '[A quién no le sirve]\n\n[Qué expectativa no vas a cumplir]'),
        ]),
      ],
    },
    {
      diseno: 'izquierda',
      bloques: [
        ante('Quién da la clase'),
        h2('[Nombre de quien da la clase]'),
        p('[Quién es, qué hace y por qué sabe de esto, en dos o tres líneas.]'),
      ],
    },
    {
      bloques: [
        h2('Agenda de la clase'),
        opt('tiempo-vertical', [
          it('Bienvenida', '[Qué pasa en los primeros minutos]', undefined, { valor: '[00:00]' }),
          it('[Bloque principal]', '[Lo que vas a enseñar]', undefined, { valor: '[00:10]' }),
          it('Preguntas en vivo', 'Respondo las preguntas de quienes estén conectados.', undefined, { valor: '[00:45]' }),
        ]),
      ],
    },
    {
      fondo: 'acento',
      bloques: [
        h2('Reserva tu lugar'),
        p('Es gratis. Te mandamos el enlace y un recordatorio antes de empezar.'),
        formulario([NOMBRE, EMAIL, TELEFONO], 'Reservar mi lugar'),
      ],
    },
    {
      bloques: [
        h2('Preguntas frecuentes'),
        preguntas([
          ['¿Va a quedar grabada?', '[Aclara si habrá repetición y por cuánto tiempo.]'],
          ['¿Tiene costo?', 'No, la clase es gratuita.'],
          ['¿Qué necesito para conectarme?', 'Una computadora o un celular con internet.'],
        ]),
      ],
    },
  ], { titulo: 'Clase gratuita: [tema de la clase]', descripcion: 'Clase en vivo el [día] a las [hora]. Reserva tu lugar gratis.' }),
  pagina('Gracias', 'gracias', [
    {
      bloques: [
        { t: 'etiqueta', texto: 'Lugar reservado' },
        { t: 'titulo', texto: '¡Listo, ya tienes tu lugar!' },
        pg('Te mandamos el enlace a tu correo. Revisa también la carpeta de promociones.'),
      ],
    },
    {
      bloques: [
        h2('Antes de la clase'),
        opt('etapas-iconos', [
          it('Agéndalo', 'Guarda el [día] a las [hora] en tu calendario.', 'calendario'),
          it('Revisa tu correo', 'Ahí te llega el enlace para entrar.', 'correo'),
          it('Trae tus preguntas', 'Al final respondo en vivo.', 'chat'),
        ]),
      ],
    },
  ]),
);

const leadMagnet = (): LandingContenido => doc(
  pagina('Inicio', '', [
    {
      bloques: [
        {
          t: 'columnas',
          columnas: [
            [
              ante('Guía gratuita'),
              { t: 'titulo', texto: '[Nombre de la guía]: [lo que va a lograr quien la lea]' },
              pg('[En una frase: qué problema resuelve y para quién es.]'),
            ],
            [formulario([NOMBRE, EMAIL], 'Descargar gratis', '¡Listo! Revisa tu correo.')],
          ],
          anchos: [7, 5],
        },
      ],
    },
    {
      bloques: [
        h2('Qué vas a encontrar adentro'),
        opt('cajas-numeros', [
          it('[Capítulo o sección 1]', '[Qué aprende quien lo lee]'),
          it('[Capítulo o sección 2]', '[Qué aprende quien lo lee]'),
          it('[Capítulo o sección 3]', '[Qué aprende quien lo lee]'),
          it('[Bonus]', '[Plantilla, lista de verificación o herramienta incluida]'),
        ], 2),
      ],
    },
    {
      bloques: [
        h2('Es para ti si'),
        opt('iconos-texto', [
          it('[Situación 1]', '[Cómo te ayuda la guía]', 'objetivo'),
          it('[Situación 2]', '[Cómo te ayuda la guía]', 'idea'),
          it('[Situación 3]', '[Cómo te ayuda la guía]', 'rayo'),
        ]),
      ],
    },
    {
      bloques: [
        h2('Un vistazo a la guía'),
        opt('galeria', [it('[Página de muestra 1]'), it('[Página de muestra 2]'), it('[Página de muestra 3]')]),
      ],
    },
    {
      diseno: 'izquierda',
      bloques: [
        ante('Quién la escribió'),
        h2('[Tu nombre o el de tu marca]'),
        p('[Por qué sabes de esto, en dos líneas.]'),
      ],
    },
    {
      fondo: 'acento',
      bloques: [
        h2('Descárgala gratis'),
        p('Te la mandamos a tu correo en segundos.'),
        botones(boton('Quiero la guía')),
      ],
    },
  ], { titulo: '[Nombre de la guía] (gratis)', descripcion: 'Descarga gratis [nombre de la guía] y [lo que va a lograr quien la lea].' }),
  pagina('Gracias', 'gracias', [
    {
      bloques: [
        { t: 'titulo', texto: '¡Tu guía va en camino!' },
        pg('Revisa tu correo en los próximos minutos. Si no la ves, busca en promociones o spam.'),
        botones(boton('Descargar ahora', '#')),
      ],
      notas: 'Cambia el destino del botón por el enlace de la guía.',
    },
  ]),
);

const ventaDirecta = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'derecha',
    bloques: [
      ante('[Nombre del producto]'),
      { t: 'titulo', texto: '[El resultado que compra tu cliente], [en cuánto tiempo o con qué facilidad]' },
      pg('[Qué es, para quién es y por qué es distinto, en una frase.]'),
      botones(boton('Comprar ahora', '#seccion-6'), boton('Ver qué incluye', '#seccion-3', 'contorno')),
    ],
  },
  {
    bloques: [
      h2('El problema'),
      opt('linea-lateral', [
        it('[Problema 1]', '[Lo que le pasa a tu cliente hoy]'),
        it('[Problema 2]', '[Lo que intentó y no funcionó]'),
        it('[Problema 3]', '[Lo que le cuesta seguir así]'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Qué incluye'),
      opt('cajas-iconos', [
        it('[Componente 1]', '[Qué es y para qué sirve]', 'archivo'),
        it('[Componente 2]', '[Qué es y para qué sirve]', 'video'),
        it('[Componente 3]', '[Qué es y para qué sirve]', 'herramienta'),
        it('[Componente 4]', '[Qué es y para qué sirve]', 'chat'),
        it('[Componente 5]', '[Qué es y para qué sirve]', 'usuarios'),
        it('[Bonus]', '[El extra que suma]', 'regalo'),
      ], 3),
    ],
  },
  {
    bloques: [
      h2('Antes y después'),
      opt('versus', [
        it('Sin [nombre del producto]', '[Cómo es el día a día hoy]'),
        it('Con [nombre del producto]', '[Cómo cambia]'),
      ]),
    ],
  },
  { bloques: [h2('Lo que dicen nuestros clientes'), testimoniosMarcadores()] },
  {
    bloques: [
      h2('Elige tu opción'),
      opt('cajas-solidas', [
        it('[Opción básica]', '[Qué incluye]', undefined, { valor: '[$000]' }),
        it('[Opción recomendada]', '[Qué incluye]', undefined, { valor: '[$000]', destacado: true }),
        it('[Opción completa]', '[Qué incluye]', undefined, { valor: '[$000]' }),
      ], 3),
      botones(boton('Comprar ahora', '#')),
    ],
    notas: 'Cambia el destino del botón por tu enlace de pago.',
  },
  { bloques: [h2('Nuestra garantía'), garantia('[Qué garantizas, por cuánto tiempo y cómo se pide. Escribe sólo lo que de verdad ofreces.]')] },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿Cómo recibo el acceso?', '[Qué pasa después de pagar.]'],
        ['¿Qué medios de pago aceptan?', '[Tarjeta, transferencia, etc.]'],
        ['¿Puedo pagar en cuotas?', '[Aclara si es posible.]'],
        ['¿Y si no me sirve?', '[Tu política de garantía o devolución.]'],
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('[Una última frase que empuje a decidir]'),
      pg('[Recuerda el resultado y lo que incluye.]'),
      botones(boton('Comprar ahora', '#seccion-6')),
    ],
  },
], { titulo: '[Nombre del producto]', descripcion: '[El resultado que compra tu cliente]. Mira qué incluye y elige tu opción.' }));

const servicioLocal = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'derecha',
    bloques: [
      ante('[Tu ciudad o zona]'),
      { t: 'titulo', texto: '[Tu servicio] en [tu ciudad], [con qué rapidez o garantía]' },
      pg('[Quién eres y por qué te eligen, en una frase.]'),
      botones(boton('Pedir presupuesto'), boton('Ver servicios', '#seccion-2', 'contorno')),
    ],
  },
  {
    bloques: [
      h2('Nuestros servicios'),
      opt('cajas-iconos', [
        it('[Servicio 1]', '[Descripción breve]', 'herramienta'),
        it('[Servicio 2]', '[Descripción breve]', 'engranaje'),
        it('[Servicio 3]', '[Descripción breve]', 'escudo'),
        it('[Servicio 4]', '[Descripción breve]', 'reloj'),
        it('[Servicio 5]', '[Descripción breve]', 'check'),
        it('[Servicio 6]', '[Descripción breve]', 'estrella'),
      ], 3),
    ],
  },
  {
    bloques: [
      h2('Por qué elegirnos'),
      opt('numeros-grandes', [
        it('[Años de experiencia]', '', undefined, { valor: '[00]' }),
        it('[Trabajos realizados]', '', undefined, { valor: '[000+]' }),
        it('[Calificación de clientes]', '', undefined, { valor: '[0.0]' }),
      ]),
    ],
    notas: 'Pon sólo cifras reales. Si no las tienes, cambia esta sección por tus diferenciales.',
  },
  {
    bloques: [
      {
        t: 'columnas',
        columnas: [
          [{ t: 'h3', texto: 'Dónde trabajamos' }, { t: 'lista', items: ['[Zona o barrio 1]', '[Zona o barrio 2]', '[Zona o barrio 3]'] }],
          [{ t: 'h3', texto: 'Horarios' }, { t: 'lista', items: ['Lunes a viernes: [horario]', 'Sábados: [horario]', 'Urgencias: [cómo contactarte]'] }],
        ],
      },
    ],
  },
  {
    bloques: [
      h2('Trabajos recientes'),
      opt('galeria', [it('[Trabajo 1]'), it('[Trabajo 2]'), it('[Trabajo 3]'), it('[Trabajo 4]')], 4),
    ],
  },
  { bloques: [h2('Opiniones de clientes'), testimoniosMarcadores('citas')] },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿Cuánto tardan en venir?', '[Tiempo de respuesta habitual.]'],
        ['¿El presupuesto tiene costo?', '[Aclara si es gratis.]'],
        ['¿Dan garantía del trabajo?', '[Qué cubre y por cuánto tiempo.]'],
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('Pide tu presupuesto'),
      p('Cuéntanos qué necesitas y te respondemos por WhatsApp.'),
      formulario([
        NOMBRE, TELEFONO,
        { tipo: 'opciones', etiqueta: '¿Qué servicio necesitas?', requerido: true, opciones: ['[Servicio 1]', '[Servicio 2]', '[Servicio 3]', 'Otro'] },
        { tipo: 'textoLargo', etiqueta: 'Cuéntanos qué necesitas', requerido: false },
      ], 'Pedir presupuesto'),
    ],
  },
], { titulo: '[Tu servicio] en [tu ciudad]', descripcion: '[Tu servicio] en [tu ciudad]. Pide tu presupuesto y te respondemos por WhatsApp.' }));

const listaEspera = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'fondo',
    superposicion: 'oscura',
    bloques: [
      { t: 'etiqueta', texto: 'Muy pronto' },
      { t: 'titulo', texto: '[Nombre del lanzamiento]: [la promesa en una línea]' },
      pg('Abrimos el [fecha]. Anótate y entra antes que nadie.'),
      botones(boton('Unirme a la lista')),
    ],
  },
  {
    bloques: [
      h2('Qué es'),
      opt('iconos-grandes', [
        it('[Idea principal 1]', '[Qué resuelve]', 'cohete'),
        it('[Idea principal 2]', '[Qué resuelve]', 'chispa'),
        it('[Idea principal 3]', '[Qué resuelve]', 'objetivo'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Cómo va a ser el lanzamiento'),
      opt('tiempo-horizontal', [
        it('Hoy', 'Te anotas en la lista.', undefined, { valor: 'Paso 1' }),
        it('[Fecha]', 'Acceso anticipado para la lista.', undefined, { valor: 'Paso 2' }),
        it('[Fecha]', 'Apertura para todos.', undefined, { valor: 'Paso 3' }),
      ]),
    ],
  },
  {
    bloques: [
      h2('Por qué anotarte ahora'),
      opt('vinetas-iconos', [
        it('Entras primero', 'Tienes acceso antes de la apertura.', 'rayo'),
        it('[Beneficio de lanzamiento]', '[Precio especial, bonus o cupo limitado]', 'regalo'),
        it('Te enteras de todo', 'Te avisamos cada novedad por correo.', 'correo'),
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('Únete a la lista de espera'),
      formulario([NOMBRE, EMAIL], 'Unirme a la lista', '¡Listo! Ya estás en la lista.'),
    ],
  },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿Anotarme tiene costo?', 'No. Anotarte es gratis y no te compromete a nada.'],
        ['¿Cuándo abre?', 'El [fecha]. Te avisamos antes por correo.'],
        ['¿Cuántos lugares hay?', '[Aclara si hay cupo limitado.]'],
      ]),
    ],
  },
], { titulo: '[Nombre del lanzamiento]: lista de espera', descripcion: 'Abrimos el [fecha]. Anótate en la lista de espera y entra antes que nadie.' }));

const cursoPrograma = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'derecha',
    bloques: [
      ante('Programa de [N] semanas'),
      { t: 'titulo', texto: '[Nombre del programa]: [la transformación que promete]' },
      pg('[Para quién es y qué va a poder hacer al terminar, en una frase.]'),
      botones(boton('Inscribirme', '#seccion-7'), boton('Ver el temario', '#seccion-4', 'contorno')),
    ],
  },
  {
    bloques: [
      h2('De dónde partes y a dónde llegas'),
      opt('lado-a-lado', [
        it('Hoy', '[La situación de tu alumno antes del programa]'),
        it('Al terminar', '[Lo que sabe hacer y lo que consiguió]'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Lo que vas a lograr'),
      opt('iconos-texto', [
        it('[Logro 1]', '[Cómo lo consigue]', 'trofeo'),
        it('[Logro 2]', '[Cómo lo consigue]', 'grafico'),
        it('[Logro 3]', '[Cómo lo consigue]', 'idea'),
        it('[Logro 4]', '[Cómo lo consigue]', 'usuarios'),
      ], 2),
    ],
  },
  {
    bloques: [
      h2('El temario'),
      preguntas([
        ['Módulo 1 · [Nombre]', '[Qué se aprende en este módulo.]'],
        ['Módulo 2 · [Nombre]', '[Qué se aprende en este módulo.]'],
        ['Módulo 3 · [Nombre]', '[Qué se aprende en este módulo.]'],
        ['Módulo 4 · [Nombre]', '[Qué se aprende en este módulo.]'],
      ]),
    ],
  },
  {
    diseno: 'izquierda',
    bloques: [
      ante('Quién enseña'),
      h2('[Tu nombre]'),
      p('[Tu experiencia en dos o tres líneas, con lo que puedas demostrar.]'),
    ],
  },
  { bloques: [h2('Lo que dicen nuestros alumnos'), testimoniosMarcadores()] },
  {
    bloques: [
      h2('Inscríbete'),
      opt('cajas-solidas', [
        it('Pago único', '[Qué incluye]', undefined, { valor: '[$000]', destacado: true }),
        it('En cuotas', '[Cantidad de cuotas y qué incluye]', undefined, { valor: '[N] × [$00]' }),
      ], 2),
      botones(boton('Inscribirme', '#')),
    ],
    notas: 'Cambia el destino del botón por tu enlace de pago.',
  },
  { bloques: [h2('Garantía'), garantia('[Qué garantizas y en qué plazo. Escribe sólo lo que de verdad ofreces.]')] },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿Cuándo empieza?', '[Fecha de inicio o si es a tu ritmo.]'],
        ['¿Cuánto tiempo necesito por semana?', '[Horas estimadas.]'],
        ['¿Hasta cuándo tengo acceso?', '[Tiempo de acceso al contenido.]'],
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('[Una frase que invite a empezar hoy]'),
      botones(boton('Inscribirme', '#seccion-7')),
    ],
  },
], { titulo: '[Nombre del programa]', descripcion: '[La transformación que promete]. Mira el temario e inscríbete.' }));

const paginaGracias = (): LandingContenido => doc(pagina('Gracias', '', [
  {
    bloques: [
      { t: 'etiqueta', texto: 'Listo' },
      { t: 'titulo', texto: '¡Gracias! Ya recibimos tus datos' },
      pg('[Qué le llega a la persona y cuándo: un correo, un mensaje, una llamada.]'),
    ],
  },
  {
    bloques: [
      h2('Tus próximos pasos'),
      opt('etapas-iconos', [
        it('Revisa tu correo', 'Te escribimos desde [tu correo].', 'correo'),
        it('[Segundo paso]', '[Qué tiene que hacer]', 'check'),
        it('[Tercer paso]', '[Qué tiene que hacer]', 'calendario'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Mientras tanto'),
      { t: 'recuadro', tono: 'info', texto: '[Tu video aquí: escribe /video y pega el enlace.]' },
      p('[Un mensaje corto de bienvenida.]'),
    ],
  },
  {
    bloques: [
      h2('Lo que viene'),
      opt('tiempo-minimalista', [
        it('[Hoy]', '[Qué pasa hoy]'),
        it('[En unos días]', '[Qué pasa después]'),
        it('[Más adelante]', '[Lo que sigue]'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Sigue aprendiendo'),
      opt('cajas-delineadas', [
        it('[Recurso 1]', '[Para qué sirve]'),
        it('[Recurso 2]', '[Para qué sirve]'),
        it('[Recurso 3]', '[Para qué sirve]'),
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('Únete a la comunidad'),
      p('[Dónde está tu comunidad y qué va a encontrar ahí.]'),
      botones(boton('Unirme', '#')),
      { t: 'p-pequeno', texto: '¿Dudas? Escríbenos a [tu correo].' },
    ],
  },
], { titulo: '¡Gracias!', descripcion: 'Ya recibimos tus datos. Estos son tus próximos pasos.' }));

const consultoria = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'izquierda',
    bloques: [
      ante('Para [tipo de empresa] que [situación de partida]'),
      { t: 'titulo', texto: '[El resultado de negocio que consigues] en [plazo]' },
      pg('Trabajamos con pocas empresas a la vez. Aplica y vemos si podemos ayudarte.'),
      botones(boton('Aplicar a una sesión')),
    ],
  },
  {
    bloques: [
      h2('Resultados'),
      opt('numeros-grandes', [
        it('[Qué mide la cifra 1]', '', undefined, { valor: '[00]%' }),
        it('[Qué mide la cifra 2]', '', undefined, { valor: '[0]x' }),
        it('[Qué mide la cifra 3]', '', undefined, { valor: '[000]' }),
      ]),
    ],
    notas: 'Pon sólo cifras reales y verificables.',
  },
  {
    bloques: [
      h2('Nuestro método'),
      opt('escalera', [
        it('[Etapa 1]', '[Qué hacemos]'),
        it('[Etapa 2]', '[Qué hacemos]'),
        it('[Etapa 3]', '[Qué hacemos]'),
        it('[Etapa 4]', '[El resultado]'),
      ]),
    ],
  },
  {
    bloques: [
      h2('¿Encaja con tu empresa?'),
      opt('pros-contras', [
        it('Es para ti si', '[Facturación, tamaño o etapa]\n\n[El problema que tienes]\n\n[Lo que estás dispuesto a invertir]'),
        it('No es para ti si', '[Quién no encaja]\n\n[Qué no hacemos]'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Casos'),
      opt('cajas-linea-lateral', [
        it('[Rubro del cliente 1]', 'De [situación inicial] a [resultado], en [plazo].'),
        it('[Rubro del cliente 2]', 'De [situación inicial] a [resultado], en [plazo].'),
        it('[Rubro del cliente 3]', 'De [situación inicial] a [resultado], en [plazo].'),
      ]),
    ],
  },
  {
    bloques: [
      { t: 'p-pequeno', texto: 'Empresas que trabajaron con nosotros' },
      opt('logos', [it('[Logo de cliente 1]'), it('[Logo de cliente 2]'), it('[Logo de cliente 3]'), it('[Logo de cliente 4]'), it('[Logo de cliente 5]')], 5),
    ],
    notas: 'Sólo logos de clientes reales y con permiso. Si no los tienes, borra esta sección.',
  },
  {
    bloques: [
      h2('Cómo es el proceso'),
      opt('etapas-horizontales', [
        it('Aplicas', 'Completas el formulario de abajo.'),
        it('Sesión de diagnóstico', 'Revisamos tu caso en una llamada.'),
        it('Propuesta', 'Si encaja, te mandamos una propuesta a medida.'),
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('Aplica a una sesión'),
      p('Respondemos cada aplicación en [plazo].'),
      formulario([
        NOMBRE, EMAIL, TELEFONO, EMPRESA,
        { tipo: 'opciones', etiqueta: 'Facturación mensual', requerido: true, opciones: ['[Rango 1]', '[Rango 2]', '[Rango 3]'] },
        { tipo: 'textoLargo', etiqueta: '¿Cuál es tu principal desafío hoy?', requerido: false },
      ], 'Enviar mi aplicación'),
    ],
  },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿Cuánto cuesta?', '[Rango de inversión o cómo se define.]'],
        ['¿Cuánto dura el trabajo?', '[Plazo habitual.]'],
        ['¿Trabajan con empresas de cualquier rubro?', '[A quién atiendes.]'],
      ]),
    ],
  },
], { titulo: '[Tu consultoría]: aplica a una sesión', descripcion: '[El resultado de negocio que consigues]. Aplica a una sesión de diagnóstico.' }));

const appSoftware = (): LandingContenido => doc(pagina('Inicio', '', [
  {
    diseno: 'arriba',
    bloques: [
      { t: 'etiqueta', texto: 'Nuevo' },
      { t: 'titulo', texto: '[Nombre de la app]: [qué hace] en [cuánto tiempo]' },
      pg('[Para quién es y qué deja de tener que hacer a mano.]'),
      botones(boton('Probar gratis'), boton('Ver cómo funciona', '#seccion-3', 'contorno')),
    ],
  },
  {
    bloques: [
      h2('Hecha para [tu usuario ideal]'),
      opt('iconos-texto', [
        it('[Beneficio 1]', '[Qué gana el usuario]', 'rayo'),
        it('[Beneficio 2]', '[Qué gana el usuario]', 'reloj'),
        it('[Beneficio 3]', '[Qué gana el usuario]', 'candado'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Cómo funciona'),
      opt('flechas-horizontales', [
        it('[Paso 1]', '[Qué hace el usuario]'),
        it('[Paso 2]', '[Qué hace la app]'),
        it('[Paso 3]', '[El resultado]'),
      ]),
    ],
  },
  {
    bloques: [
      h2('Funciones'),
      opt('iconos-izquierda', [
        it('[Función 1]', '[Descripción breve]', 'engranaje'),
        it('[Función 2]', '[Descripción breve]', 'grafico'),
        it('[Función 3]', '[Descripción breve]', 'usuarios'),
        it('[Función 4]', '[Descripción breve]', 'chat'),
        it('[Función 5]', '[Descripción breve]', 'mundo'),
        it('[Función 6]', '[Descripción breve]', 'escudo'),
      ], 2),
    ],
  },
  {
    bloques: [
      h2('Comparada con hacerlo a mano'),
      { t: 'tabla', filas: [['', 'A mano', '[Nombre de la app]'], ['[Tarea 1]', '[Cómo es hoy]', '[Cómo es con la app]'], ['[Tarea 2]', '[Cómo es hoy]', '[Cómo es con la app]'], ['[Tarea 3]', '[Cómo es hoy]', '[Cómo es con la app]']], encabezado: true },
    ],
  },
  {
    bloques: [
      h2('Planes'),
      opt('cajas-delineadas', [
        it('Gratis', '[Qué incluye]', undefined, { valor: '$0' }),
        it('[Plan intermedio]', '[Qué incluye]', undefined, { valor: '[$00]/mes', destacado: true }),
        it('[Plan avanzado]', '[Qué incluye]', undefined, { valor: '[$00]/mes' }),
      ], 3),
      botones(boton('Empezar gratis')),
    ],
  },
  { bloques: [h2('Lo que dicen quienes la usan'), testimoniosMarcadores('citas')] },
  {
    bloques: [
      h2('Preguntas frecuentes'),
      preguntas([
        ['¿Necesito tarjeta para probarla?', '[Aclara cómo es la prueba.]'],
        ['¿Puedo cancelar cuando quiera?', '[Tu política de cancelación.]'],
        ['¿Mis datos están seguros?', '[Cómo los proteges.]'],
      ]),
    ],
  },
  {
    fondo: 'acento',
    bloques: [
      h2('Pruébala gratis'),
      p('Déjanos tus datos y te mandamos el acceso.'),
      formulario([NOMBRE, EMAIL, EMPRESA], 'Quiero probarla'),
    ],
  },
], { titulo: '[Nombre de la app]', descripcion: '[Qué hace la app] para [tu usuario ideal]. Pruébala gratis.' }));

export const PLANTILLAS: readonly Plantilla[] = [
  { id: 'agenda-llamada', nombre: 'Agenda una llamada', descripcion: 'Para servicios que se venden en una llamada.', categoria: 'Agendar', tema: temaDe('pewter', 'sapphire'), contenido: agendaLlamada },
  { id: 'webinar', nombre: 'Webinar o evento', descripcion: 'Registro a una clase en vivo, con página de gracias.', categoria: 'Eventos', tema: temaDe('ultraviolet', 'eclipse', 'nightsky'), contenido: webinar },
  { id: 'lead-magnet', nombre: 'Lead magnet / descarga', descripcion: 'Una guía gratis a cambio del correo.', categoria: 'Captar contactos', tema: temaDe('sapphire', 'cirrus', 'pewter'), contenido: leadMagnet },
  { id: 'venta-directa', nombre: 'Venta directa', descripcion: 'Producto con precio, garantía y objeciones.', categoria: 'Vender', tema: temaDe('torch', 'canyon', 'pewter'), contenido: ventaDirecta },
  { id: 'servicio-local', nombre: 'Servicio local', descripcion: 'Un oficio o servicio en tu ciudad.', categoria: 'Servicios', tema: temaDe('lawn', 'mint', 'pewter'), contenido: servicioLocal },
  { id: 'lista-espera', nombre: 'Lanzamiento con lista de espera', descripcion: 'Junta interesados antes de abrir.', categoria: 'Captar contactos', tema: temaDe('eclipse', 'ultraviolet', 'malachite'), contenido: listaEspera },
  { id: 'curso-programa', nombre: 'Curso o programa', descripcion: 'Temario, precio y garantía de un programa.', categoria: 'Vender', tema: temaDe('botanical', 'terrain', 'espresso'), contenido: cursoPrograma },
  { id: 'gracias', nombre: 'Página de gracias', descripcion: 'Lo que ve la persona después de registrarse.', categoria: 'Después del registro', tema: temaDe('mint', 'cirrus', 'pewter'), contenido: paginaGracias },
  { id: 'consultoria', nombre: 'Consultoría high ticket', descripcion: 'Aplicación a una sesión para servicios de alto valor.', categoria: 'Agendar', tema: temaDe('espresso', 'anvil', 'pewter'), contenido: consultoria },
  { id: 'app-software', nombre: 'App o software', descripcion: 'Funciones, planes y prueba gratis.', categoria: 'Vender', tema: temaDe('syntax', 'cirrus', 'circuit'), contenido: appSoftware },
];

export function plantillaPorId(id: string): Plantilla | undefined {
  return PLANTILLAS.find((x) => x.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Diseños de sección (se insertan como una tarjeta armada)
// ─────────────────────────────────────────────────────────────────────────────
// Los botones van a '#': la sección no sabe en qué página cae ni si hay formulario. Los
// títulos son Encabezado 1 o 2, nunca el «Título» (uno solo por página, y la página ya
// puede tener el suyo).

const seccion = (t: TarjetaIA) => (): JsonNodo => bloquesATarjeta(t, { descartes: colector });

export const DISENOS_SECCION: readonly DisenoSeccion[] = [
  {
    id: 'encabezado-tres-columnas', nombre: 'Un encabezado y tres columnas', icono: 'columnas-3',
    crear: seccion({ bloques: [h2('[Encabezado]'), { t: 'columnas', columnas: [1, 2, 3].map((n) => [{ t: 'h3', texto: `[Punto ${n}]` }, p('[Texto]')] as BloqueIA[]) }] }),
  },
  { id: 'titulo-subtitulo', nombre: 'Título y subtítulo', icono: 'texto-t', crear: seccion({ bloques: [{ t: 'h1', texto: '[Título]' }, pg('[Subtítulo]')] }) },
  { id: 'imagen-titulo', nombre: 'Imagen principal + título', icono: 'imagen', crear: seccion({ diseno: 'arriba', bloques: [{ t: 'h1', texto: '[Título]' }, p('[Texto]')] }) },
  {
    id: 'foto-texto-superpuesto', nombre: 'Una foto hermosa con texto superpuesto', icono: 'buscar-imagen',
    crear: seccion({ diseno: 'fondo', superposicion: 'oscura', bloques: [{ t: 'h1', texto: '[Título]' }, pg('[Una frase que acompañe la foto]')] }),
  },
  {
    id: 'encabezado-parrafo-boton', nombre: 'Un encabezado, un párrafo y un botón', icono: 'boton',
    crear: seccion({ bloques: [h2('[Encabezado]'), p('[Texto]'), botones(boton('[Texto del botón]', '#'))] }),
  },
  { id: 'texto-imagen', nombre: 'Texto con imagen al costado', icono: 'opt-galeria', crear: seccion({ diseno: 'derecha', bloques: [h2('[Encabezado]'), p('[Texto]'), { t: 'lista', items: ['[Punto 1]', '[Punto 2]', '[Punto 3]'] }] }) },
  {
    id: 'beneficios', nombre: 'Beneficios con íconos', icono: 'opt-iconos',
    crear: seccion({ bloques: [h2('[Beneficios]'), opt('iconos-texto', [it('[Beneficio 1]', '[Texto]', 'rayo'), it('[Beneficio 2]', '[Texto]', 'objetivo'), it('[Beneficio 3]', '[Texto]', 'estrella')])] }),
  },
  {
    id: 'testimonios', nombre: 'Testimonios', icono: 'opt-citas',
    crear: seccion({ bloques: [h2('Lo que dicen nuestros clientes'), testimoniosMarcadores()] }),
  },
  {
    id: 'precios', nombre: 'Precios en tres columnas', icono: 'opt-cajas',
    crear: seccion({
      bloques: [
        h2('Elige tu plan'),
        opt('cajas-solidas', [
          it('[Plan básico]', '[Qué incluye]', undefined, { valor: '[$00]' }),
          it('[Plan recomendado]', '[Qué incluye]', undefined, { valor: '[$00]', destacado: true }),
          it('[Plan completo]', '[Qué incluye]', undefined, { valor: '[$00]' }),
        ], 3),
        botones(boton('[Texto del botón]', '#')),
      ],
    }),
  },
  {
    id: 'preguntas-frecuentes', nombre: 'Preguntas frecuentes', icono: 'desplegable',
    crear: seccion({ bloques: [h2('Preguntas frecuentes'), preguntas([['[Pregunta 1]', '[Respuesta]'], ['[Pregunta 2]', '[Respuesta]'], ['[Pregunta 3]', '[Respuesta]'], ['[Pregunta 4]', '[Respuesta]']])] }),
  },
  {
    id: 'como-funciona', nombre: 'Cómo funciona en etapas', icono: 'opt-etapas',
    crear: seccion({ bloques: [h2('Cómo funciona'), opt('etapas-horizontales', [it('[Paso 1]', '[Texto]'), it('[Paso 2]', '[Texto]'), it('[Paso 3]', '[Texto]')])] }),
  },
  {
    id: 'estadisticas', nombre: 'Estadísticas', icono: 'opt-estadisticas',
    crear: seccion({ bloques: [h2('[Encabezado]'), opt('numeros-grandes', [it('[Qué mide]', '', undefined, { valor: '[00]%' }), it('[Qué mide]', '', undefined, { valor: '[000+]' }), it('[Qué mide]', '', undefined, { valor: '[0]x' })])] }),
  },
  {
    id: 'logos', nombre: 'Logos de clientes', icono: 'opt-logos',
    crear: seccion({ bloques: [{ t: 'p-pequeno', texto: 'Confían en nosotros' }, opt('logos', [1, 2, 3, 4, 5].map((n) => it(`[Logo ${n}]`)), 5)] }),
  },
  {
    id: 'equipo', nombre: 'Equipo', icono: 'opt-equipo',
    crear: seccion({ bloques: [h2('Nuestro equipo'), opt('equipo', [1, 2, 3, 4].map((n) => it(`[Nombre ${n}]`, '[Rol]')), 4)] }),
  },
  {
    id: 'comparacion', nombre: 'Comparación', icono: 'opt-comparacion',
    crear: seccion({ bloques: [h2('[Nosotros contra la alternativa]'), opt('versus', [it('[La alternativa]', '[Cómo es]'), it('[Tu propuesta]', '[Cómo es]')])] }),
  },
  { id: 'garantia', nombre: 'Garantía', icono: 'exito', crear: seccion({ bloques: [h2('Nuestra garantía'), garantia('[Qué garantizas, por cuánto tiempo y cómo se pide]')] }) },
  {
    id: 'formulario-contacto', nombre: 'Formulario de contacto', icono: 'formulario',
    crear: seccion({ bloques: [{ t: 'columnas', columnas: [[h2('Hablemos'), p('[Qué pasa cuando alguien te escribe]')], [formulario([NOMBRE, EMAIL, { tipo: 'textoLargo', etiqueta: 'Mensaje', requerido: false }], 'Enviar')]] }] }),
  },
  {
    id: 'video-boton', nombre: 'Video con botón', icono: 'video',
    crear: seccion({ bloques: [h2('[Encabezado]'), p('[Por qué vale la pena ver el video]'), { t: 'recuadro', tono: 'info', texto: '[Tu video aquí: escribe /video y pega el enlace.]' }, botones(boton('[Texto del botón]', '#'))] }),
  },
  {
    id: 'cierre', nombre: 'Cierre con llamado', icono: 'botones',
    crear: seccion({ fondo: 'acento', bloques: [h2('[Una frase que invite a dar el paso]'), pg('[Recuerda el resultado]'), botones(boton('[Texto del botón]', '#'))] }),
  },
];

export function disenoSeccionPorId(id: string): DisenoSeccion | undefined {
  return DISENOS_SECCION.find((x) => x.id === id);
}
