// =============================================================================
// offer-plantillas — las 9 plantillas de «Nueva oferta»: la FORMA de cada tipo de oferta y su ejemplo COMPLETO
// =============================================================================
// SIN `server-only` A PROPÓSITO: es data pura y la leen la pantalla (la grilla de «Nueva oferta», el ejemplo en el
// centro), el servidor (el bloque `offer.experto` del turno y de la propuesta) y los tests.
//
// De dónde sale: docs/plantillas-reales/offer.md, sección 2 (las plantillas 1 a 9, cada una con «La forma»,
// «Miniatura», «Preguntas, en orden» y «El ejemplo completo» en las 20 secciones del marco) y sección 5 (la forma de
// los datos). Martín (29/10/2026): «Los templates tienen que ser reales». El ejemplo tiene la forma de
// `PropuestaOferta` (lib/offer-marco.ts), que es lo que dibujan el PDF y la pantalla.
//
// LOS NEGOCIOS SON FICTICIOS (el elenco de docs/plantillas-reales/README.md, 2.2): Cierre Consultivo, Consulta
// Rentable, Pulso Dental, Voz de Líder y Torre Alameda, con sus clientes inventados. Ningún texto nombra a alguien de
// la lista REALES (tests/_reales.ts), y todo va en español neutro con «tú» (tests/puente-panel-copy.test.ts barre lib/).
// El ejemplo enseña la FORMA: sus datos no existen y nunca entran a las fuentes del dueño (trampa 14 del plan).
//
// Lo que se tomó de afuera, traducido y reescrito (sin texto en inglés): el bucle de diagnóstico de una palanca por
// vuelta, la elección de garantía por el miedo más grande, un bono por objeción, la escasez honesta y el formato
// antes → diagnóstico → después de la skill `offers` de marketingskills
// (https://github.com/coreyhaines31/marketingskills, MIT, «Copyright (c) 2025 Corey Haines»,
// lib/avisos/LICENSE-MARKETINGSKILLS).
//
// ⚠️ LOS `id` SON PERMANENTES: viajan guardados en las conversaciones (`OfferMensaje.plantilla`, tanda B del plan).
// Se puede cambiar un nombre, un texto o un número del ejemplo; el id, no.
//
// ⚠️ Los precios del ejemplo van COMPLETOS y con moneda (`USD 1,500`, `MXN 2,400,000`), como en México: `precioDe` y
// `nivelDeOferta` (lib/offer-reglas.ts) leen de ahí el nivel. Y una cifra seguida de «al mes» NO la lee `precioDe`
// (la toma por una cantidad por mes): por eso los precios mensuales dicen «mensuales» o «membresía mensual».
//
// ⚠️ Ningún ejemplo lleva «[completar]» (el plan lo dejaba a propósito en la 7 y la 9): lo que falta se dice en
// palabras y va en `completar`, que es la lista en lenguaje simple. Las fechas de inicio de las cohortes no se
// escriben: el texto dice «un lunes», y la fecha la calcula quien la muestre (trampa 9).
// =============================================================================

import {
  dimensionLabel,
  type BonoPropuesto, type CalculoDiagnostico, type DiagnosticoOferta, type EcuacionFila, type Entregable, type FaseRuta,
  type PiezaKey, type PropuestaOferta,
} from './offer-marco';
import { cortarSinPartir } from './unicode-seguro';

// ── Los tipos ─────────────────────────────────────────────────────────────────

/** Los grupos de la grilla, en el orden en que se dibujan (después de «Tus funnels», que vive en app/offer/arbol.ts). */
export type GrupoOferta = 'Programas y mentorías' | 'Servicios' | 'Entrada y continuidad' | 'Inmobiliaria' | 'Revisar tu oferta';
export const GRUPOS_OFERTA: readonly GrupoOferta[] = ['Programas y mentorías', 'Servicios', 'Entrada y continuidad', 'Inmobiliaria', 'Revisar tu oferta'];

export type TipoOferta = 'programa' | 'servicio' | 'entrada' | 'continuidad' | 'producto' | 'revisar';

/**
 * La FORMA: qué tipo de oferta es, quién hace el trabajo y qué garantía, urgencia y pago le quedan. Los opcionales
 * son las piezas que la plantilla del plan nombra aparte (el bono típico del servicio, el tramo premium, la prueba sin
 * casos, los pasos de la revisión).
 */
export type FormaOferta = {
  tipo: TipoOferta;
  quienHace: string;
  garantia: string;
  urgencia: string;
  pago: string;
  /** La palanca de la ecuación de valor que mueve esta forma. */
  mueve: string;
  precio?: string;
  prueba?: string;
  bono?: string;
  pasos?: string;
};

/** Lo que dibuja la tarjeta: la insignia de arriba y los 3 chips (precio · garantía · escasez). */
export type FichaOferta = { insignia: string; chips: readonly [string, string, string] };

/** El diagnóstico de la plantilla 8, con la forma de las props de `VistaDiagnostico` (app/offer/Conclusion.tsx). */
export type DiagnosticoDePlantilla = { d: DiagnosticoOferta; calculo: CalculoDiagnostico };

/** El antes y el después de la plantilla 8 (el formato de marketingskills, con la palanca que se movió). */
export type RevisionOferta = {
  antes: string;
  resultados: string;
  precioAntes: string;
  precioDespues: string;
  versiones: readonly string[];
  movio: string;
};

export type PlantillaOferta = {
  /** PERMANENTE: viaja guardado en las conversaciones. */
  id: string;
  nombre: string;
  /** «Cuándo usarla», en una línea. */
  cuando: string;
  grupo: GrupoOferta;
  /** `momento` sólo cuando el ejemplo es el negocio en otro momento («en su lanzamiento»). */
  negocio: { nombre: string; nicho: string; momento?: string };
  forma: FormaOferta;
  /** «Preguntas, en orden»: la pieza del marco y una pregunta por hechos. */
  preguntas: ReadonlyArray<{ pieza: PiezaKey; pregunta: string }>;
  ficha: FichaOferta;
  /** Las 20 secciones del marco, llenas. En la 8 es la versión pulida (la oferta de la plantilla 3). */
  ejemplo: PropuestaOferta;
  /** Sólo la 8. */
  diagnostico?: DiagnosticoDePlantilla;
  /** Sólo la 8. */
  revision?: RevisionOferta;
};

// ── Ayudas para escribir los datos ────────────────────────────────────────────

const fase = (f: string, objetivo: string, hito: string): FaseRuta => ({ fase: f, objetivo, hito });
const entregable = (nombre: string, beneficio: string): Entregable => ({ nombre, beneficio });
const bono = (nombre: string, objecion: string, valor: string): BonoPropuesto => ({ nombre, objecion, valor });
const fila = (variable: EcuacionFila['variable'], antes: string, despues: string): EcuacionFila => ({ variable, antes, despues });

// ── 1 · Programa con garantía de aplicación · Cierre Consultivo ─────────────

const CIERRE_CONSULTIVO_90: PropuestaOferta = {
  nombre: 'Cierre Consultivo: 90 días',
  frase: 'Ayudo a coaches que venden programas por llamada a cerrar 4 de cada 10 llamadas calificadas en 90 días con una llamada de diagnóstico de 6 preguntas, sin presionar ni bajar su precio.',
  mensajes: {
    corto: 'Llamadas que cierran sin presionar',
    largo: 'Si haces llamadas de venta y escuchas "lo voy a pensar", el problema casi nunca es tu precio: es el orden de la llamada. En 90 días aprendes a llevar una llamada de diagnóstico de 6 preguntas, la practicas con tus llamadas reales y Andrea revisa cada una.',
    entrada: 'Te digo en qué minuto se cae tu venta.',
  },
  paraQuien: {
    perfil: 'Coaches y consultores que venden un programa de USD 500 a 3,000 por llamada y hacen al menos 4 llamadas de venta por semana.',
    minimo: 'Ya tienen clientes que les pagaron y graban sus llamadas con permiso de la persona.',
    noEs: 'Quien todavía no vende por llamada o busca frases para presionar.',
  },
  problema: {
    hoy: 'Explican su programa 20 minutos, escuchan «me encanta» y terminan con «déjame consultarlo». Cierran 1 o 2 de cada 10 y bajan el precio para no perder la venta.',
    despues: 'Llevan la llamada con preguntas, la persona dice cuánto le cuesta seguir igual antes de oír el precio, y cierran 4 de cada 10 sin descuento.',
    obstaculos: ['Presentan antes de diagnosticar', 'No saben qué contestar a «lo voy a pensar»', 'No escuchan sus llamadas', 'Dan el precio sin atarlo al problema'],
    yaProbo: 'Cursos grabados de cierre y guiones de objeciones que suenan a vendedor.',
  },
  mecanismo: {
    nombres: ['Llamada de diagnóstico en 6 preguntas (propuesta)', 'Cierre por diagnóstico (propuesta)'],
    pasos: [
      'Preparar la llamada con un formulario de 4 preguntas.',
      'Abrir con el motivo: «¿por qué ahora?».',
      'Medir el costo de seguir igual.',
      'Mostrar el camino en 3 pasos, sin módulos.',
      'Dar el precio atado al problema y callar.',
      'Cerrar con una fecha de inicio.',
    ],
    distinto: 'Los cursos de cierre enseñan a contestar objeciones al final; aquí la objeción no aparece porque la persona dijo su problema y su costo antes del precio.',
  },
  ruta: [
    fase('Semanas 1-2 · Ordenar la llamada', 'Usar el guion de 6 preguntas', 'Primera llamada grabada con el guion, en la semana 1'),
    fase('Semanas 3-5 · Precio y objeciones', 'Dar el precio atado al problema', '3 llamadas revisadas, con nota'),
    fase('Semanas 6-8 · Seguimiento', 'Recuperar a los que dijeron «lo voy a pensar»', 'Seguimiento de 3 mensajes en marcha'),
    fase('Semanas 9-13 · Práctica revisada', '6 llamadas revisadas', '4 de cada 10 en las llamadas calificadas'),
  ],
  incluye: [
    entregable('8 sesiones en vivo, los martes a las 7 p. m. (CDMX)', 'Practicas el guion en grupo con llamadas reales.'),
    entregable('Revisión de 6 llamadas grabadas, con nota por minuto', 'Sabes en qué minuto se cae cada venta.'),
    entregable('El guion de 6 preguntas y las respuestas a 9 objeciones', 'No improvisas en la llamada.'),
    entregable('Práctica en parejas', 'Ensayas antes de la llamada real.'),
  ],
  formato: '90 días: 8 semanas en vivo y 5 de práctica revisada. En grupo, 15 personas por cohorte. Lo hacen juntos: tú haces las llamadas y Andrea las revisa y corrige. Soporte en el grupo de la cohorte, de lunes a viernes, con respuesta en 24 horas hábiles.',
  prueba: '52 personas en 4 cohortes desde 2025. 35 llegaron a 3 de cada 10 o más en 90 días, y la mediana pasó de 2 a 4 de cada 10. Son resultados de esas cohortes, no una promesa.',
  garantia: {
    nombre: 'Garantía de aplicación',
    condiciones: 'Asistes a 7 de las 8 sesiones, aplicas el guion en al menos 6 llamadas y las mandas a revisar.',
    plazo: '90 días desde el inicio.',
    siNoCumple: 'Si tu cierre no mejoró, te devolvemos el 100 % o pasas a la cohorte siguiente sin costo, lo que prefieras.',
  },
  bonos: [
    bono('Revisión de 3 llamadas antes de empezar', '«No sé si el problema es la llamada o los prospectos»', 'USD 150, el precio al que se vende suelta'),
    bono('Plantilla de seguimiento en 3 mensajes', '«Se me van los que dicen "lo voy a pensar"»', 'USD 97, el precio al que se vendió suelta'),
  ],
  inversion: {
    valorTotal: 'Suelto vale USD 2,444 (8 sesiones a USD 200, 6 revisiones a USD 50, el guion como curso grabado de USD 297, y los dos bonos). El resultado vale más: con un programa de USD 1,000, dos ventas más al mes son USD 24,000 al año, 16 veces el precio.',
    precio: 'USD 1,600 en 2 pagos de USD 800, hoy y a 30 días.',
    contado: 'USD 1,500.',
    plan: '2 pagos de USD 800: hoy y a 30 días.',
    comoDecirlo: '«La inversión son 1,600 dólares en dos pagos de 800, hoy y en 30 días. Si lo pagas completo hoy, queda en 1,500.» Y después, silencio.',
  },
  urgencia: 'La cohorte arranca un lunes con 15 lugares, que es lo que Andrea puede revisar llamada por llamada. Las inscripciones cierran el jueves anterior o al llenarse.',
  escenarios: {
    mejor: 'Cierras 4 de cada 10 y dejas de bajar tu precio.',
    peor: 'Aplicas el guion en 6 llamadas, no mejora, y recuperas tu dinero o repites la cohorte.',
  },
  ecuacion: [
    fila('resultado', '«Vender mejor»', '4 de cada 10 llamadas calificadas en 90 días'),
    fila('probabilidad', 'Testimonios sin números', '35 de 52 con su antes y después, y la garantía de aplicación'),
    fila('tiempo', 'El primer cambio, en el mes 2', 'La primera llamada con el guion, en la semana 1'),
    fila('esfuerzo', '30 videos para estudiar', 'Un guion de 6 preguntas y la revisión de tus llamadas'),
  ],
  numeros: [
    'Margen bruto: 78 %. Cuesta USD 330 entregar el programa a cada persona.',
    'Meta por cohorte: 15 ventas, unos USD 22,500. Es la cohorte llena: más no caben en la revisión de Andrea, y cada cohorte dura 90 días.',
    'Llamadas calificadas necesarias: 38 por cohorte, con un cierre de 4 de cada 10.',
    '% cobrado al firmar esperado: 75 %, si la mitad paga de contado.',
    'Costo por cliente: USD 380, con lo que el LTV:CAC queda en 4 a 1.',
  ],
  validar: [
    'Meta: llenar la próxima cohorte (15 ventas).',
    'Qué medir: el % cobrado al firmar y el cierre sobre llamadas calificadas.',
    'Cuándo subir el precio: si 5 ventas seguidas pagan de contado sin pedir cuotas, a USD 1,800 en la cohorte siguiente.',
  ],
  siguiente: 'Al terminar, el problema es tener más llamadas calificadas. Va un acompañamiento de 6 meses para sumar un setter (fase 2, solo anotado).',
  completar: [],
  propuestoPorMako: [
    { seccion: 'Método', que: 'Los dos nombres.' },
    { seccion: 'Inversión', que: 'El precio de lista en 2 pagos, con el contado como ahorro.' },
  ],
};

// ── 2 · Cohorte con resultado rápido · Consulta Rentable ─────────────────────

const CONSULTORIO_LLENO_90: PropuestaOferta = {
  nombre: 'Consultorio Lleno en 90 días',
  frase: 'Ayudo a nutriólogas que atienden en línea a llegar a 15 pacientes al mes en 90 días con una valoración de 20 minutos que agenda, sin publicar todos los días.',
  mensajes: {
    corto: 'Tu consulta, sin publicar a diario',
    largo: 'Las nutriólogas con agenda llena no publican más: tienen un paso entre "me interesa" y "agendé". En 90 días armas tu plan de 3 meses, tu valoración de 20 minutos y tu mensaje de precio, con revisión semanal de tus mensajes reales.',
    entrada: 'Clase gratuita: cómo pasar de un "¿precio?" a una cita con un mensaje de 5 líneas.',
  },
  paraQuien: {
    perfil: 'Nutriólogas con cédula que atienden en línea y tienen menos de 10 pacientes al mes.',
    minimo: 'Ya cobran consulta y tienen una lista de contactos o al menos 1,000 seguidores.',
    noEs: 'Quien busca un plan de alimentación para sí misma o todavía no se titula.',
  },
  problema: {
    hoy: 'Publican recetas, contestan «¿precio?» y no agendan. Cobran consultas sueltas de MXN 600 y no les alcanza.',
    despues: 'Venden un plan de 3 meses, agendan desde una valoración de 20 minutos y llenan sus jueves.',
    obstaculos: ['Venden consultas sueltas', 'No hay un paso entre el interés y la cita', 'Dicen el precio sin contexto', 'Publicar les quita tiempo de atender'],
    yaProbo: 'Publicar más, bajar la consulta a MXN 400 y pagar promociones sin un paso para agendar.',
  },
  mecanismo: {
    nombres: ['Valoración que agenda (propuesta)', 'Ruta de 3 claves (propuesta)'],
    pasos: [
      'Armar el plan de 3 meses: resultado, tiempo y lo que no tiene que sacrificar.',
      'Abrir la valoración de 20 minutos.',
      'Mandar el mensaje del precio después de la valoración.',
      'Dar seguimiento en 48 horas a quien no agendó.',
    ],
    distinto: 'Lo que ya probaron suma seguidoras; esto arma el paso que convierte a quien ya escribió.',
  },
  ruta: [
    fase('Semanas 1-3 · El plan de 3 meses', 'Tener la oferta publicada', 'La primera valoración hecha en la semana 1'),
    fase('Semanas 4-7 · La valoración', 'Hacer valoraciones con el guion', '10 valoraciones hechas'),
    fase('Semanas 8-12 · Precio y seguimiento', 'Convertir valoraciones en pacientes', '15 pacientes en el mes, o el plan para llegar'),
  ],
  incluye: [
    entregable('12 sesiones en grupo en vivo, los jueves a las 7 p. m. (CDMX)', 'Avanzas con un grupo que está en lo mismo.'),
    entregable('Revisión semanal de tus mensajes', 'Corriges el mensaje que no agenda.'),
    entregable('Plantillas del plan, de la valoración y del mensaje de precio', 'No escribes desde cero.'),
  ],
  formato: '90 días, 12 sesiones semanales y una semana de cierre. En grupo, 20 nutriólogas por cohorte. Lo haces tú con nuestra guía: tú atiendes y escribes, nosotras revisamos. Dudas en el grupo, de lunes a viernes.',
  prueba: '140 alumnas desde 2023. En las cohortes de 2026, la mediana pasó de 7 a 15 pacientes al mes. Lucía Garza, nutrióloga en Monterrey, pasó de 6 a 21 pacientes en la semana 9 y subió su consulta de MXN 600 a 900. Es el resultado de una alumna, no una promesa.',
  garantia: {
    nombre: 'Garantía de la semana 4',
    condiciones: 'Asistes a las 4 primeras sesiones y haces 5 valoraciones con el guion.',
    plazo: 'Hasta el final de la semana 4.',
    siNoCumple: 'Si no agendaste ningún paciente nuevo, te devolvemos todo.',
  },
  bonos: [
    bono('Revisión 1 a 1 de tu plan de 3 meses (30 min)', '«No sé si mi plan sirve para mi ciudad»', 'USD 120, lo que cuesta su sesión 1 a 1'),
  ],
  inversion: {
    valorTotal: 'Suelto vale USD 1,560 (el programa en USD 1,200, las plantillas sueltas en USD 240 y el bono en USD 120). El resultado vale más: 8 pacientes más con un plan de MXN 2,400 al mes son MXN 230,400 al año.',
    precio: 'USD 1,300 en 2 pagos de USD 650, hoy y a 30 días.',
    contado: 'USD 1,200.',
    plan: '2 pagos de USD 650: hoy y a 30 días.',
    comoDecirlo: '«Son 1,300 dólares en dos pagos de 650. Si lo pagas hoy completo, queda en 1,200.»',
  },
  urgencia: 'La cohorte empieza un jueves con 20 lugares, porque más no caben en la revisión semanal de mensajes.',
  escenarios: {
    mejor: 'Llenas tus jueves con pacientes de un plan de 3 meses.',
    peor: 'Haces 5 valoraciones en un mes, no agendas a nadie y recuperas tu dinero.',
  },
  ecuacion: [
    fila('resultado', '«Más pacientes»', '15 pacientes al mes en 90 días'),
    fila('probabilidad', 'Sin casos', '140 alumnas, la mediana de 7 a 15, y el caso de Lucía'),
    fila('tiempo', 'Meses de publicar', 'La primera valoración en la semana 1'),
    fila('esfuerzo', 'Publicar a diario', 'Una valoración y un mensaje de precio'),
  ],
  numeros: [
    'Margen bruto: 84 %. Cuesta USD 190 atender a cada alumna.',
    'Meta por cohorte: 20 ventas, unos USD 25,000.',
    'Embudo: 400 registros, 160 asisten a la clase y 20 compran, 1 de cada 8 asistentes.',
    '% cobrado al firmar esperado: 80 %, si 6 de cada 10 pagan de contado.',
  ],
  validar: [
    'Meta: llenar los 20 lugares.',
    'Qué medir: registro → asistencia a la clase → compra.',
    'Cuándo subir el precio: si se llena antes de la fecha, la cohorte siguiente sube a USD 1,400.',
  ],
  siguiente: 'Quien termina quiere sostener su agenda. Va un círculo mensual para egresadas, el «Círculo Consultorio Lleno».',
  completar: [],
  propuestoPorMako: [
    { seccion: 'Garantía', que: 'La de la semana 4 en vez de una de 90 días.' },
  ],
};

// ── 3 · Servicio hecho por ti · Pulso Dental (también es el «después» de la 8) ─

const AGENDA_IMPLANTES_90: PropuestaOferta = {
  nombre: 'Agenda de Implantes en 90 días',
  frase: 'Ayudo a clínicas dentales a llenar su agenda de valoraciones de implantes en 90 días con anuncios del tratamiento y respuesta en menos de 5 minutos, sin que su recepción deje de atender.',
  mensajes: {
    corto: 'Valoraciones de implantes, no likes',
    largo: 'Si tus anuncios traen mensajes pero no pacientes de implantes, el problema está después del anuncio. Hacemos los anuncios del tratamiento, contestamos cada mensaje en menos de 5 minutos con tu rango de precios y te entregamos valoraciones agendadas.',
    entrada: 'Auditoría gratis de 30 minutos: revisamos tus anuncios y tus últimos 20 mensajes.',
  },
  paraQuien: {
    perfil: 'Clínicas dentales con 2 sillones o más, que hacen implantes o tratamientos de más de USD 1,000 y ya invierten en anuncios.',
    minimo: 'Pueden invertir USD 1,500 al mes en anuncios, aparte del servicio, y tienen agenda para valoraciones.',
    noEs: 'Clínicas que solo hacen limpiezas o buscan seguidores.',
  },
  problema: {
    hoy: 'Entran de 80 a 100 mensajes al mes y se contestan 3 horas después. La mitad pregunta «¿precio?» y desaparece, y 1 de cada 3 agendados no llega.',
    despues: 'Cada mensaje se contesta en menos de 5 minutos, el paciente llega sabiendo el rango de precio y la agenda de valoraciones se llena.',
    obstaculos: ['Anuncios de limpiezas que no traen implantes', 'Respuesta lenta', 'El precio se dice sin contexto o nunca', 'Inasistencias'],
    yaProbo: 'Dos o tres agencias que entregaban seguidores y reportes de alcance.',
  },
  mecanismo: {
    nombres: ['Método 5-5-1: 5 minutos, 5 preguntas, 1 cita (propuesta)', 'Del anuncio a la valoración (propuesta)'],
    pasos: [
      'Anunciar el tratamiento, no la clínica.',
      'Contestar en menos de 5 minutos, con guion.',
      'Hacer 5 preguntas de filtro antes de agendar.',
      'Decir el rango de precio antes de la cita.',
      'Mandar recordatorios 24 horas y 2 horas antes.',
    ],
    distinto: 'Las agencias anteriores medían alcance. Aquí se miden valoraciones agendadas y asistidas, porque la venta se pierde después del anuncio.',
  },
  ruta: [
    fase('Mes 1 · Arranque', 'Anuncios y guion de respuesta funcionando, y los mensajes sin contestar recuperados', 'Las primeras valoraciones agendadas en la semana 1'),
    fase('Mes 2 · Volumen', 'Llegar al volumen', '15 valoraciones agendadas en el mes'),
    fase('Mes 3 · Asistencia y cierre', 'Que lleguen y compren', 'Inasistencias por debajo del 20 % y reporte de tratamientos cerrados'),
  ],
  incluye: [
    entregable('Anuncios del tratamiento en Meta, hechos y manejados por nosotros', 'No pagas por seguidores.'),
    entregable('Respuesta en menos de 5 minutos, de lunes a sábado de 8 a. m. a 8 p. m.', 'Ningún mensaje se enfría.'),
    entregable('Guion de 5 preguntas y rango de precio', 'Llegan pacientes que pueden pagar.'),
    entregable('Reporte cada lunes: mensajes, valoraciones agendadas y asistidas', 'Sabes qué compra tu inversión.'),
  ],
  formato: 'Contrato de 3 meses. Lo hacemos por ti: anuncios, respuestas y agenda; tu equipo solo atiende la valoración. Reporte cada lunes y llamada de 30 minutos cada dos semanas.',
  prueba: '31 clínicas atendidas desde 2022, en Colombia y México. Clínica Dental Altamira (Medellín, Dr. Felipe Cárdenas) pasó de 6 a 23 valoraciones al mes en el mes 3, con la misma inversión, y cerró 9 tratamientos. Es el resultado de una clínica en particular.',
  garantia: {
    nombre: 'Garantía de 15 valoraciones',
    condiciones: 'Inviertes al menos USD 1,500 al mes en anuncios, tu equipo atiende las valoraciones agendadas y nos das acceso a la agenda.',
    plazo: 'El cierre del mes 2.',
    siNoCumple: 'Si en el mes 2 no hay 15 valoraciones agendadas, el mes 3 no se cobra.',
  },
  bonos: [
    bono('Alta sin costo: anuncios, guiones y conexión con tu agenda', '«Arrancar con otra agencia es un mes perdido»', 'USD 800, lo que se cobra el alta por separado'),
    bono('Recuperación de los mensajes de los últimos 90 días', '«Ya perdí a muchos que escribieron»', 'USD 300, el precio de la recuperación suelta'),
  ],
  inversion: {
    valorTotal: 'Suelto vale USD 4,700 (3 meses de servicio, el alta y la recuperación).',
    precio: 'USD 1,200 mensuales más tu inversión en anuncios, con un mínimo de 3 meses.',
    contado: 'USD 3,300 por los 3 meses, pagados al firmar.',
    plan: 'USD 1,200 al firmar y el mismo día de cada mes.',
    comoDecirlo: '«Son 1,200 dólares al mes por 3 meses, más lo que inviertes en anuncios. Si pagas los 3 meses hoy, quedan en 3,300.»',
  },
  urgencia: 'Tomamos 2 clínicas nuevas por mes y una sola por especialidad en cada zona, para no competir con nuestros propios clientes. El número de lugares del mes sale de la capacidad real.',
  escenarios: {
    mejor: 'Tu agenda de implantes se llena con la misma inversión en anuncios.',
    peor: 'Si en el mes 2 no hay 15 valoraciones, el mes 3 no lo pagas.',
  },
  ecuacion: [
    fila('resultado', '«Más pacientes»', 'Valoraciones de implantes agendadas cada semana'),
    fila('probabilidad', 'Agencias que no funcionaron', 'El caso Altamira y la garantía de 15 valoraciones'),
    fila('tiempo', 'Resultados «en 6 meses»', 'Las primeras valoraciones en la semana 1'),
    fila('esfuerzo', 'La recepción contesta todo', 'Lo contestamos por ti'),
  ],
  numeros: [
    'Margen bruto: 70 %. Cuesta USD 360 al mes atender a cada clínica, entre quien contesta y quien maneja los anuncios.',
    'Meta: 12 clínicas activas, USD 14,400 al mes.',
    'Llamadas: 6 auditorías para cerrar 2 clínicas, 1 de cada 3.',
    '% cobrado al firmar: 33 % en el plan mensual y 92 % si pagan el trimestre.',
  ],
  validar: [
    'Meta: 2 clínicas por mes durante 3 meses.',
    'Qué medir: valoraciones agendadas y asistidas por clínica.',
    'Cuándo subir el precio: si 3 clínicas seguidas pagan el trimestre, el mensual pasa a USD 1,400.',
  ],
  siguiente: 'En el mes 3, la clínica quiere cerrar más tratamientos de sus valoraciones. Va un entrenamiento de cierre para su recepción (fase 2).',
  completar: [],
  propuestoPorMako: [
    { seccion: 'Garantía', que: 'El umbral de 15 valoraciones.' },
    { seccion: 'Urgencia', que: 'Una clínica por especialidad en cada zona.' },
  ],
};

// ── 4 · Entrada que se acredita · Cierre Consultivo ──────────────────────────

const REVISION_3_LLAMADAS: PropuestaOferta = {
  nombre: 'Revisión de 3 llamadas',
  frase: 'Reviso 3 de tus llamadas de venta grabadas y en 5 días hábiles te digo en qué minuto se cae cada venta y qué decir ahí, sin que cambies tu programa ni tu precio.',
  mensajes: {
    corto: '¿En qué minuto se cae tu venta?',
    largo: 'Mándame 3 llamadas grabadas. En 5 días hábiles recibes un video por llamada con el minuto exacto donde se perdió la venta y la frase que lo arregla. Si después entras al programa, los USD 150 se descuentan.',
    entrada: 'Te digo en qué minuto se cae tu venta.',
  },
  paraQuien: {
    perfil: 'Coaches que hacen llamadas de venta y las graban con permiso de la persona.',
    minimo: 'Tienen 3 llamadas grabadas de este mes.',
    noEs: 'Quien todavía no hace llamadas.',
  },
  problema: {
    hoy: 'No saben si pierden ventas por la llamada o por los prospectos.',
    despues: 'Saben en qué minuto se cae y qué frase usar.',
    obstaculos: ['No escuchan sus llamadas', 'No saben qué buscar'],
    yaProbo: 'Pedirle opinión a colegas que no revisan con método.',
  },
  mecanismo: {
    nombres: ['Revisión por minuto (propuesta)'],
    pasos: [
      'Subes 3 llamadas.',
      'Andrea marca el minuto donde se cae cada una.',
      'Recibes un video de 10 minutos por llamada, con la frase que lo arregla.',
    ],
    distinto: 'No es una opinión general; cada corrección tiene su minuto y su frase.',
  },
  ruta: [
    fase('Día 1 · Subes tus llamadas', 'Mandar 3 llamadas grabadas de este mes', '3 llamadas recibidas'),
    fase('Días 2 a 5 · Revisión', 'Marcar el minuto donde se cae cada venta', '3 videos entregados'),
    fase('Día 6 · Llamada opcional de 20 minutos', 'Ver qué cambiar en tu próxima llamada', 'Decides si entras al programa'),
  ],
  incluye: [
    entregable('3 videos de revisión, uno por llamada', 'Ves el error con tu propia voz.'),
    entregable('Lista de 5 frases para tu próxima llamada', 'La usas mañana.'),
  ],
  formato: 'Lo hace Andrea; tú solo subes las llamadas. Entrega en 5 días hábiles.',
  prueba: 'Más de 80 revisiones desde mediados de 2025, cuando el programa ya llevaba dos cohortes. 1 de cada 5 personas entró después al programa (16 de las 52 alumnas).',
  garantia: {
    nombre: 'Garantía sin preguntas',
    condiciones: 'Ninguna.',
    plazo: '7 días desde la entrega.',
    siNoCumple: 'Si la revisión no te sirvió, te devolvemos los USD 150.',
  },
  bonos: [
    bono('Crédito de USD 150 al programa', '«No quiero pagar dos veces»', 'USD 150'),
  ],
  inversion: {
    valorTotal: 'USD 150, lo que vale la revisión suelta, y se acredita completo al programa.',
    precio: 'USD 150 en un solo pago, sin cuotas.',
    contado: 'Es un solo pago.',
    plan: 'Sin cuotas.',
    comoDecirlo: '«Son 150 dólares. Si en los 14 días siguientes entras al programa, se descuentan completos.»',
  },
  urgencia: 'El crédito al programa vale 14 días desde la entrega.',
  escenarios: {
    mejor: 'Sabes qué cambiar en tu próxima llamada y, si entras, la revisión te salió gratis.',
    peor: 'No te sirvió y recuperas los USD 150.',
  },
  ecuacion: [
    fila('resultado', '«Saber qué falla»', 'El minuto exacto y la frase'),
    fila('probabilidad', 'Opiniones sueltas', 'Revisión con método y devolución'),
    fila('tiempo', 'Semanas', '5 días hábiles'),
    fila('esfuerzo', 'Escuchar tus propias llamadas', 'Solo subirlas'),
  ],
  numeros: [
    'Margen bruto: 67 %. Cuesta USD 50 hacer cada revisión, una hora.',
    'Con 1 de cada 5 que entra al programa, cada revisión trae USD 300 de venta del programa.',
  ],
  validar: [
    'Meta: 20 revisiones al mes.',
    'Qué medir: cuántos entran al programa en 14 días.',
    'Si entra menos de 1 de cada 5: revisar la llamada de 20 minutos, no el precio.',
  ],
  siguiente: 'El programa «Cierre Consultivo: 90 días».',
  completar: [],
  propuestoPorMako: [
    { seccion: 'Urgencia', que: 'Los 14 días del crédito.' },
  ],
};

// ── 5 y 7 · Voz de Líder (las secciones que comparte la primera camada) ─────

const PROBLEMA_VOZ: PropuestaOferta['problema'] = {
  hoy: 'Leen las diapositivas, los interrumpen en el minuto 2 y salen sin la aprobación que fueron a pedir.',
  despues: 'Abren con la decisión que piden, sostienen 10 minutos y contestan preguntas difíciles sin perder el hilo.',
  obstaculos: ['No preparan los primeros 20 segundos', 'Ensayan solos y en silencio', 'No saben contestar una objeción en público'],
  yaProbo: 'Cursos de oratoria con teoría y talleres de un día sin práctica.',
};

const MECANISMO_VOZ: PropuestaOferta['mecanismo'] = {
  nombres: ['Apertura de 20 segundos (propuesta)', 'Ensayo con directorio simulado (propuesta)'],
  pasos: [
    'Escribir la apertura: la decisión que pides, en una frase.',
    'Ensayar en vivo cada martes, con correcciones.',
    'Hacer un simulacro grabado con 3 preguntas difíciles.',
    'Dar la presentación real y revisarla.',
  ],
  distinto: 'Los cursos de oratoria enseñan técnica; aquí se ensaya la presentación real que tienes este trimestre.',
};

const RUTA_VOZ: FaseRuta[] = [
  fase('Semanas 1-3 · La apertura', 'Escribir la decisión que pides en una frase', 'Apertura de 20 segundos grabada en la semana 1'),
  fase('Semanas 4-7 · Los 10 minutos', 'Sostener la presentación completa sin leer', 'La presentación completa, cronometrada'),
  fase('Semanas 8-10 · Las preguntas difíciles', 'Contestar sin perder el hilo', '3 simulacros grabados'),
  fase('Semanas 11-13 · La presentación real', 'Presentar ante tu directorio', 'Presentas ante tu directorio y la revisamos'),
];

const INCLUYE_VOZ: Entregable[] = [
  entregable('10 sesiones en vivo, los martes a las 7 p. m. (Lima)', 'Ensayas frente a otros gerentes.'),
  entregable('3 simulacros grabados con preguntas difíciles', 'Te preparas para que te interrumpan.'),
  entregable('Revisión de tu presentación real', 'Sabes qué ajustar para la siguiente.'),
];

const ECUACION_VOZ: EcuacionFila[] = [
  fila('resultado', '«Hablar mejor»', '10 minutos sin leer ante tu directorio'),
  fila('probabilidad', 'Teoría', '86 gerentes, simulacros y la garantía'),
  fila('tiempo', 'Años de práctica', 'La apertura grabada en la semana 1'),
  fila('esfuerzo', 'Ensayar solo', 'Ensayo guiado cada martes'),
];

// ── 5 · Precio por tramos · Voz de Líder ─────────────────────────────────────

const VOZ_DE_LIDER_90: PropuestaOferta = {
  nombre: 'Voz de Líder: 90 días',
  frase: 'Ayudo a gerentes que presentan ante su directorio a hablar 10 minutos sin leer y sin que los interrumpan en 90 días, con práctica semanal en vivo y simulacros grabados, sin clases de teoría.',
  mensajes: {
    corto: 'Presenta sin leer y sin que te corten',
    largo: 'Sabes qué decir hasta que te toca el directorio. En 90 días preparas tu apertura, ensayas cada semana en vivo y haces 3 simulacros grabados con preguntas difíciles, en un grupo de 12 gerentes.',
    entrada: 'Taller gratuito: los primeros 20 segundos de tu presentación.',
  },
  paraQuien: {
    perfil: 'Gerentes y jefes de área que presentan resultados ante un directorio o un comité al menos una vez al mes.',
    minimo: 'Tienen una presentación real en los próximos 90 días.',
    noEs: 'Quien busca dar conferencias o hablar en eventos.',
  },
  problema: PROBLEMA_VOZ,
  mecanismo: MECANISMO_VOZ,
  ruta: RUTA_VOZ,
  incluye: INCLUYE_VOZ,
  formato: '90 días: 10 semanas en vivo y 3 de práctica con tu presentación real. En grupo, 12 personas por cohorte. Lo hacemos juntos.',
  prueba: '8 cohortes desde 2024, con 86 gerentes. Carla presentó el presupuesto anual sin que la interrumpieran, y Gabriel consiguió que le aprobaran su proyecto en el primer comité. Son casos de alumnos, no una promesa.',
  garantia: {
    nombre: 'Garantía del simulacro',
    condiciones: 'Asistes a 8 de las 10 sesiones y haces los 3 simulacros.',
    plazo: 'Hasta la semana 10.',
    siNoCumple: 'Si en el tercer simulacro no sostienes 10 minutos sin leer, Rodrigo te acompaña 1 a 1 sin costo hasta tu presentación real.',
  },
  bonos: [
    bono('Revisión de tus diapositivas', '«Mi problema también son las diapositivas»', 'USD 200, el precio de la revisión suelta'),
  ],
  inversion: {
    valorTotal: 'Suelto vale USD 2,600 por persona (el programa, 2 simulacros extra a USD 200 y la revisión de diapositivas).',
    precio: 'Individual: USD 2,100 en 2 pagos de USD 1,050, hoy y a 30 días. Equipo de 5: USD 8,500, con factura (el mismo programa, con 5 lugares). En tu empresa: USD 18,000, hasta 12 personas, con las sesiones en sus oficinas; es el tramo premium, existe de verdad y se vende a quien lo pide.',
    contado: 'USD 2,000 el individual.',
    plan: 'Individual: 2 pagos de USD 1,050, hoy y a 30 días. Equipo de 5: 50 % al firmar y 50 % a 30 días, con factura.',
    comoDecirlo: 'Primero el individual. Si te dicen que paga la empresa, ofreces el de equipo. El de «en tu empresa» se nombra solo si te piden algo para todo el directorio.',
  },
  urgencia: 'La cohorte arranca un martes con 12 lugares, el máximo para que cada gerente ensaye en todas las sesiones.',
  escenarios: {
    mejor: 'Presentas ante tu directorio sin leer y consigues la aprobación que fuiste a pedir.',
    peor: 'Si no lo logras en el simulacro, Rodrigo te acompaña 1 a 1 hasta tu presentación.',
  },
  ecuacion: ECUACION_VOZ,
  numeros: [
    'Margen bruto: 75 % en el individual y 70 % en el de equipo. Cuesta USD 500 atender a cada persona: USD 2,500 por un equipo que paga USD 8,500.',
    'Meta por cohorte: llenar los 12 lugares. Son USD 24,000 con 12 individuales, o USD 22,500 con un equipo y 7 individuales: el equipo cobra menos por lugar, y lo compensa que paga la empresa, con factura, en una sola venta.',
    '% cobrado al firmar esperado: 70 % en el individual; 50 % en el de equipo.',
  ],
  validar: [
    'Meta: llenar la próxima cohorte.',
    'Qué medir: cuántas ventas pagó una empresa.',
    'Cuándo publicar el tramo de equipo: si 2 cohortes seguidas llegan con 2 equipos o más, va en la página.',
  ],
  siguiente: 'Para quien ya presenta bien, una mentoría 1 a 1 para su primera presentación ante inversionistas o ante el consejo (fase 2).',
  completar: [],
  propuestoPorMako: [
    { seccion: 'Inversión', que: 'El tramo de equipo y la versión en tu empresa.' },
  ],
};

// ── 6 · Preventa por etapas · Torre Alameda ──────────────────────────────────

const TORRE_ALAMEDA_E2: PropuestaOferta = {
  nombre: 'Torre Alameda, etapa 2',
  frase: 'Ayudo a familias que rentan en Querétaro a comprar un departamento de 2 recámaras desde MXN 2.4 millones, con entrega en diciembre de 2027 y el enganche en 18 mensualidades, sin pagar el precio de obra terminada.',
  mensajes: {
    corto: 'Tu departamento, con el enganche en 18 meses',
    largo: '2 recámaras, 2 baños y 78 m² a 8 minutos de Constituyentes, desde MXN 2.4 millones. Pagas el 10 % de enganche en 18 meses mientras se construye, y la fecha de entrega está en el contrato.',
    entrada: 'Recibe hoy por WhatsApp la lista de precios de la etapa 2.',
  },
  paraQuien: {
    perfil: 'Familias que rentan en Querétaro, con ingresos para un crédito hipotecario, que quieren su primera vivienda.',
    minimo: 'Pueden pagar MXN 12,222 al mes de enganche durante la obra.',
    noEs: 'Quien busca rentar por noches (el reglamento del edificio no lo permite).',
  },
  problema: {
    hoy: 'Pagan MXN 14,000 de renta, ven que los precios suben cada año y no logran juntar el enganche de una vez.',
    despues: 'Pagan el enganche en mensualidades parecidas a su renta y en diciembre de 2027 reciben su departamento.',
    obstaculos: ['Juntar el enganche de golpe', 'El miedo a que la obra se retrase', 'No saber cuánto pagarían por mes'],
    yaProbo: 'Buscar casas terminadas, que suben de precio más rápido de lo que alcanzan a ahorrar.',
  },
  mecanismo: {
    nombres: ['Enganche en mensualidades durante la obra (propuesta)'],
    pasos: [
      'Apartado de MXN 20,000, que se devuelve si no se firma en 15 días.',
      'Firma del contrato, con fecha de entrega y penalización.',
      'Enganche en 18 mensualidades.',
      'Crédito o contado contra entrega.',
    ],
    distinto: 'En una casa terminada pagas completo el precio de hoy; en preventa pagas el precio de la etapa y el enganche mientras se construye.',
  },
  ruta: [
    fase('Apartado', 'Separar el departamento', 'Apartado hecho y precio de la etapa congelado'),
    fase('Contrato', 'Firmar con fecha de entrega', 'Contrato firmado en 15 días'),
    fase('Obra', 'Pagar el enganche', 'Visita de avance cada trimestre'),
    fase('Entrega', 'Escriturar', 'Llaves en diciembre de 2027'),
  ],
  incluye: [
    entregable('Departamento de 2 recámaras, 2 baños, 78 m² y un cajón', 'Hay espacio para una familia de 4.'),
    entregable('Alberca, gimnasio y roof garden', 'Tienes lo que no tienes rentando.'),
    entregable('Corrida financiera impresa con tu crédito', 'Sabes cuánto pagas por mes antes de firmar.'),
  ],
  formato: 'La desarrolladora construye y entrega; tú pagas el enganche durante la obra. Hay visitas de avance cada trimestre y un reporte de obra al mes por WhatsApp.',
  prueba: 'La etapa 1 (96 departamentos) se entregó en noviembre de 2025, en la fecha del contrato, y ahí viven 92 familias. La etapa 2 va en el 60 % de obra.',
  garantia: {
    nombre: 'Entrega con fecha en el contrato',
    condiciones: 'Estás al corriente con tus mensualidades de enganche.',
    plazo: 'Diciembre de 2027.',
    siNoCumple: 'Por cada mes de retraso, la desarrolladora te paga el 0.5 % de lo que llevas pagado, como dice el contrato.',
  },
  bonos: [
    bono('Un cajón de estacionamiento más, sin costo, para los primeros 10 contratos de la etapa 2', '«Somos dos autos»', 'MXN 180,000, el precio del cajón suelto'),
  ],
  inversion: {
    valorTotal: 'El departamento en MXN 2,400,000 y el cajón extra de MXN 180,000 para los primeros 10 contratos.',
    precio: 'Desde MXN 2,400,000, el precio de la etapa 2.',
    contado: 'MXN 2,280,000 (un 5 % menos) si pagas el 100 % antes de la entrega.',
    plan: 'Apartado de MXN 20,000, el resto del 10 % de enganche en 18 mensualidades de MXN 12,222, y crédito o contado contra entrega. Crédito estimado al recibir: MXN 18,900 al mes por MXN 2,160,000 a 20 años, con una tasa fija de referencia del 8.6 %; depende del banco y se dice como estimado. Con una renta típica de MXN 14,000, la mensualidad del crédito es más alta: nunca se dice «el mismo pago».',
    comoDecirlo: '«El precio de la etapa 2 es de 2.4 millones. Apartas con 20 mil, el resto del enganche son 18 mensualidades de 12,222 mientras se construye, y el saldo lo cubre tu crédito al recibir.»',
  },
  urgencia: 'Quedan 46 de los 96 departamentos, y 14 de ellos tienen vista al parque. Al vender 80 de 96, el precio pasa al de la etapa 3, MXN 2,520,000, como dice la lista de precios publicada.',
  escenarios: {
    mejor: 'Recibes tu departamento en diciembre de 2027 con el precio de la etapa 2.',
    peor: 'Si la obra se retrasa, la desarrolladora te paga la penalización del contrato.',
  },
  ecuacion: [
    fila('resultado', 'Seguir rentando', 'Departamento propio en diciembre de 2027'),
    fila('probabilidad', 'Miedo a una obra que no se termina', 'La etapa 1 entregada a tiempo y la penalización en el contrato'),
    fila('tiempo', 'Años juntando el enganche', 'Apartas esta semana'),
    fila('esfuerzo', 'Juntar MXN 240,000 de golpe', '18 mensualidades de MXN 12,222'),
  ],
  numeros: [
    'Inventario: quedan 46 de 96, 14 de ellos con vista al parque.',
    'Visitas necesarias: 4 por venta, porque cierra 1 de cada 4 visitas al departamento muestra.',
    'Meta: 6 contratos al mes para vender la etapa antes de la entrega.',
  ],
  validar: [
    'Meta: 6 contratos al mes.',
    'Qué medir: visitas al departamento muestra → apartados → contratos.',
    'Si se pasa de 8 contratos 3 meses seguidos, adelantar la etapa 3.',
  ],
  siguiente: 'Para quien ya compró, un segundo departamento en la etapa 3 con precio de cliente (fase 2, solo anotado).',
  completar: [],
  propuestoPorMako: [
    { seccion: 'Bonos', que: 'El cajón extra para los primeros 10 contratos.' },
  ],
};

// ── 7 · Primera camada, sin casos · Voz de Líder en su lanzamiento ──────────

const VOZ_DE_LIDER_CAMADA: PropuestaOferta = {
  nombre: 'Voz de Líder: primera camada',
  frase: 'Ayudo a gerentes que presentan ante su directorio a sostener 10 minutos sin leer en 90 días, con ensayo semanal en vivo y simulacros grabados, sin clases de teoría.',
  mensajes: {
    corto: 'Presenta sin leer ante tu directorio',
    largo: 'Abro la primera camada de Voz de Líder: 8 gerentes, 90 días, ensayo cada martes y 3 simulacros con preguntas difíciles. Entras con el precio de primera camada a cambio de grabar tu antes y tu después.',
    entrada: 'Taller gratuito: los primeros 20 segundos de tu presentación.',
  },
  paraQuien: {
    perfil: 'Gerentes que presentan resultados ante un directorio o un comité al menos una vez al mes.',
    minimo: 'Tienen una presentación real en los próximos 90 días y aceptan grabar su antes y su después.',
    noEs: 'Quien busca dar conferencias.',
  },
  problema: PROBLEMA_VOZ,
  mecanismo: MECANISMO_VOZ,
  ruta: RUTA_VOZ,
  incluye: [
    ...INCLUYE_VOZ,
    entregable('Una sesión 1 a 1 de apertura para cada gerente', 'Empiezas con tu apertura revisada.'),
  ],
  formato: '90 días: 10 semanas en vivo y 3 de práctica. En grupo, 8 personas en la primera camada.',
  prueba: 'Todavía no hay casos de este programa, porque es la primera camada. Rodrigo fue gerente comercial durante 12 años y preparó las presentaciones de su equipo ante el directorio. Los resultados de esta camada se suman cuando termine.',
  garantia: {
    nombre: 'Garantía de primera camada',
    condiciones: 'Asistes a 8 de las 10 sesiones y haces los 3 simulacros.',
    plazo: 'Hasta tu presentación real, dentro de los 90 días.',
    siNoCumple: 'Si no sostienes 10 minutos sin leer, Rodrigo te acompaña 1 a 1 sin costo hasta lograrlo; y si aun así no lo logras, te devuelve el 100 %.',
  },
  bonos: [
    bono('Sesión 1 a 1 para tu presentación real', '«Mi caso es distinto»', 'USD 250, la tarifa de Rodrigo por sesión 1 a 1'),
  ],
  inversion: {
    valorTotal: 'Valuación del programa: USD 2,000.',
    precio: 'USD 1,400 la primera camada, en 2 pagos de USD 700, hoy y a 30 días.',
    contado: 'USD 1,300.',
    plan: '2 pagos de USD 700: hoy y a 30 días.',
    comoDecirlo: '«El programa está valuado en 2,000 dólares. La primera camada entra con 1,400 porque todavía no tengo casos, y a cambio te pido grabar tu antes y tu después. Son 2 pagos de 700; de contado, 1,300.»',
  },
  urgencia: 'La primera camada tiene 8 lugares y arranca un martes. La segunda sale a USD 2,000, como ya está anunciado.',
  escenarios: {
    mejor: 'Presentas sin leer y eres uno de los primeros casos del programa.',
    peor: 'Si no lo logras, sigues 1 a 1 sin costo o recuperas tu dinero.',
  },
  ecuacion: ECUACION_VOZ.map((f) => (f.variable === 'probabilidad'
    ? fila('probabilidad', 'Sin casos', 'Una garantía por acciones, 12 años de trayectoria y un grupo de 8')
    : f)),
  numeros: [
    'Margen bruto: 70 %. Cuesta USD 420 atender a cada persona, porque en la primera camada hay más tiempo 1 a 1.',
    'Meta: 8 ventas, USD 11,200.',
    '% cobrado al firmar esperado: 55 %.',
  ],
  validar: [
    'Meta: vender los 8 lugares.',
    'Qué medir: cuántos sostienen 10 minutos en el tercer simulacro.',
    'Cuándo subir el precio: con 5 casos con su antes y su después, la segunda camada sale a USD 2,000.',
  ],
  siguiente: 'La cohorte regular, «Voz de Líder: 90 días».',
  completar: ['Los resultados de la primera camada, cuando termine.'],
  propuestoPorMako: [
    { seccion: 'Inversión', que: 'El precio de la camada y la valuación.' },
    { seccion: 'Garantía', que: 'La extensión 1 a 1.' },
  ],
};

// ── 8 · Revisar tu oferta: el diagnóstico de la oferta de antes de Pulso Dental ─

const DIAGNOSTICO_PULSO: DiagnosticoDePlantilla = {
  d: {
    dimensiones: [
      { id: 'D1', nota: 5, porque: 'Dice «clínicas dentales», sin especialidad ni tamaño, e incluye a las que solo hacen limpiezas.', mejora: 'Nombrar a las clínicas con 2 sillones o más que hacen implantes y ya invierten en anuncios.' },
      { id: 'D2', nota: 3, porque: 'Vende el vehículo (las publicaciones), sin número ni plazo.', mejora: 'Prometer valoraciones de implantes agendadas, con número y plazo.' },
      { id: 'D3', nota: 4, porque: 'Suena a cualquier agencia de redes.', mejora: 'Decir por qué se mide en valoraciones y no en alcance: la venta se pierde después del anuncio.' },
      { id: 'D4', nota: 4, porque: 'Hay 31 clínicas atendidas, pero sin números de pacientes y sin garantía.', mejora: 'Mostrar el antes y el después de una clínica y sumar una garantía por entregable.' },
      { id: 'D5', nota: 6, porque: 'Lo hace la agencia, pero el resultado no tiene plazo.', mejora: 'Poner las primeras valoraciones en la semana 1.' },
      { id: 'D6', nota: 7, porque: 'El paquete es fijo.', mejora: 'Fijar cuántas clínicas nuevas se toman por mes.' },
      { id: 'D7', nota: 4, porque: 'Cobra por cantidad de publicaciones, por mes y sin mínimo.', mejora: 'Cobrar por el resultado, con un contrato de 3 meses.' },
      { id: 'D8', nota: 3, porque: 'No hay ninguna.', mejora: 'Una razón real: 2 clínicas nuevas por mes y una por especialidad en cada zona.' },
      { id: 'D9', nota: 8, porque: 'Una oferta y un nicho.', mejora: 'Sostener una sola oferta mientras se valida la nueva.' },
    ],
    tesis: 'La oferta vende publicaciones; la clínica compra pacientes de implantes.',
    fuerte: '31 clínicas atendidas y un paquete fijo que se entrega igual a todas.',
    cambios: [
      { titulo: 'Prometer valoraciones de implantes agendadas, con número y plazo', porque: 'La promesa saca 3: vende publicaciones, sin número ni plazo.', hipotesis: 'Se espera que el cierre pase de 1 de cada 8 a 1 de cada 4 llamadas.' },
      { titulo: 'Una garantía por entregable: 15 valoraciones en el mes 2, o el mes 3 no se cobra', porque: 'La certeza saca 4: hay clínicas atendidas, pero sin números y sin garantía.', hipotesis: 'Se espera que baje «ya probé agencias» como motivo de no compra.' },
      { titulo: 'Un contrato de 3 meses y 2 clínicas nuevas por mes, según la capacidad', porque: 'El precio y cobro saca 4 y la razón para decidir, 3.', hipotesis: 'Se espera que las bajas en el mes 2 caigan por debajo de 1 de cada 10.' },
    ],
  },
  // Lo calcula el CÓDIGO (`calcularDiagnostico`, lib/offer-reglas.ts) y el test lo vuelve a calcular: el promedio de
  // las 9 notas (44 / 9 = 4.9 → 49), el cuello en D2 (empata en 3 con D8 y gana la de más arriba) y no lista (D2 y D4
  // por debajo de 7). Con D2 en 3, el precio y los bonos de la versión 1 salen provisionales (marco §4).
  calculo: {
    total: 49,
    cuello: 'D2',
    lista: false,
    alertas: ['Promesa saca 3: el precio y los bonos de la oferta nueva quedan provisionales hasta arreglarlo.'],
  },
};

const REVISION_PULSO: RevisionOferta = {
  antes: 'Manejo de redes para clínicas: 12 publicaciones y 4 reels al mes, USD 600 al mes, sin contrato mínimo y sin garantía.',
  resultados: 'Cierra 1 de cada 8 llamadas, y 3 de cada 10 clientes se van en el mes 2.',
  precioAntes: 'USD 600 al mes',
  precioDespues: 'USD 1,200 al mes',
  versiones: [
    'Versión 1: «Agenda de Implantes en 90 días», con el precio y los bonos provisionales.',
    'Versión 2 (pulida): ya con el umbral de la garantía, el precio y los bonos confirmados por el dueño.',
  ],
  movio: 'La promesa (de publicaciones a valoraciones) y, con ella, la probabilidad.',
};

// ── 9 · Continuidad para egresados · Consulta Rentable ───────────────────────

const CIRCULO_CONSULTORIO: PropuestaOferta = {
  nombre: 'Círculo Consultorio Lleno',
  frase: 'Ayudo a nutriólogas que terminaron el programa a sostener 15 pacientes al mes con una revisión mensual de sus números y mensajes nuevos cada mes, sin volver a empezar.',
  mensajes: {
    corto: 'Sostén tu agenda llena',
    largo: 'Terminaste el programa y tu agenda se llenó. El Círculo te ayuda a sostenerla: cada mes revisamos tus números, recibes los mensajes del mes y hay una sesión de casos en vivo.',
    entrada: 'Solo para egresadas: la primera sesión del Círculo es abierta.',
  },
  paraQuien: {
    perfil: 'Egresadas del programa que ya tienen al menos 12 pacientes al mes.',
    minimo: 'Terminaron el programa.',
    noEs: 'Quien no hizo el programa, que va primero.',
  },
  problema: {
    hoy: 'Al terminar, la agenda baja en 2 o 3 meses porque dejan de revisar sus mensajes y su seguimiento.',
    despues: 'La agenda se mantiene con una revisión al mes.',
    obstaculos: ['Sin revisión vuelven a publicar sin un paso para agendar', 'Los mensajes se gastan'],
    yaProbo: 'Repetir el programa completo.',
  },
  mecanismo: {
    nombres: ['Revisión mensual de números (propuesta)'],
    pasos: [
      'Cargas tus números del mes.',
      'Sesión de casos en vivo.',
      'Recibes 4 mensajes nuevos para el mes.',
    ],
    distinto: 'No repite el programa: revisa cada mes lo que hace bajar la agenda antes de que baje.',
  },
  ruta: [
    fase('Mes 1 · El tablero de tus números', 'Ver dónde puede bajar tu agenda', 'Los números del mes cargados'),
    fase('Cada mes · Revisión y mensajes', 'Sostener la agenda', 'La agenda igual o mayor que el mes anterior'),
  ],
  incluye: [
    entregable('Una sesión de casos en vivo al mes', 'Resuelves lo que te frena este mes.'),
    entregable('4 mensajes nuevos al mes', 'No escribes desde cero.'),
    entregable('El tablero de tus números', 'Ves si la agenda baja antes de que pase.'),
  ],
  formato: 'Mensual y en grupo; cancelas cuando quieras. Lo haces tú, con revisión en grupo.',
  prueba: 'Es nueva: se abre para las 140 egresadas desde 2023. Lucía Garza fue la primera en pedirla.',
  garantia: {
    nombre: 'Garantía del primer mes',
    condiciones: 'Ninguna.',
    plazo: '30 días.',
    siNoCumple: 'Si el primer mes no te sirvió, te devolvemos los USD 97.',
  },
  bonos: [
    bono('Plantilla de seguimiento de pacientes', '«Se me van los pacientes en el mes 2»', 'USD 47, el precio al que se vende suelta'),
  ],
  inversion: {
    valorTotal: 'La membresía y la plantilla de seguimiento, que se vende suelta en USD 47.',
    precio: 'Membresía mensual de USD 97; cancelas cuando quieras.',
    contado: 'Anual: USD 970, con dos meses sin costo.',
    plan: 'Mensual o anual.',
    comoDecirlo: '«Son 97 dólares al mes y cancelas cuando quieras. Si pagas el año, son 970: dos meses sin costo.»',
  },
  urgencia: 'El precio de fundadoras (USD 97) es para la primera generación; después sube a USD 127 al mes. Quien entra ahora lo conserva mientras siga.',
  escenarios: {
    mejor: 'Tu agenda sigue llena 6 meses después de terminar.',
    peor: 'Pruebas un mes y recuperas los USD 97.',
  },
  ecuacion: [
    fila('resultado', 'Una agenda que se cae', 'Una agenda que se sostiene'),
    fila('tiempo', 'Repetir el programa de 90 días', 'Una sesión al mes'),
    fila('esfuerzo', 'Volver a empezar', 'Cargar tus números y usar los mensajes'),
  ],
  numeros: [
    'Margen bruto: 85 %.',
    'Meta: 60 egresadas activas, USD 5,820 al mes.',
    'Bajas esperadas: todavía no hay datos; se miden desde el primer mes.',
  ],
  validar: [
    'Meta: 30 egresadas en el primer mes.',
    'Qué medir: las bajas al mes 3.',
    'Si pasan del 10 % al mes: revisar qué se entrega antes que el precio.',
  ],
  siguiente: 'Para quien ya tiene 25 pacientes al mes, una mentoría para sumar a otra nutrióloga a su consulta (fase 2).',
  completar: ['Las bajas esperadas, cuando haya datos del primer mes.'],
  propuestoPorMako: [
    { seccion: 'Urgencia', que: 'El precio de fundadoras.' },
  ],
};

// ── Las 9 plantillas, en el orden del plan ───────────────────────────────────

export const PLANTILLAS_OFERTA: readonly PlantillaOferta[] = [
  {
    id: 'programa-garantia',
    nombre: 'Programa con garantía de aplicación',
    cuando: 'Vendes un programa en grupo en el que tu cliente aprende y aplica una habilidad con tu revisión, y ya tienes casos.',
    grupo: 'Programas y mentorías',
    negocio: { nombre: 'Cierre Consultivo', nicho: 'Coach de ventas' },
    forma: {
      tipo: 'programa',
      quienHace: 'juntos (el cliente aplica; el negocio revisa y corrige).',
      garantia: 'condicional a aplicar el método (asistir, aplicar, mandar a revisar), con devolución o repetir la cohorte.',
      urgencia: 'una cohorte con fecha de inicio y cupos según cuántos clientes puede revisar el negocio.',
      pago: 'de contado, o 2 pagos (hoy y a 30 días).',
      mueve: 'la probabilidad.',
    },
    preguntas: [
      { pieza: 'resultado', pregunta: '¿Con qué número se nota que tu cliente ya aplica lo que le enseñas, y en cuánto tiempo?' },
      { pieza: 'prueba', pregunta: '¿Cuántos de tus clientes llegaron a ese número, y cuánto tenían antes?' },
      { pieza: 'mecanismo', pregunta: '¿Qué pasos sigue tu cliente, en orden, desde la primera semana?' },
      { pieza: 'costo', pregunta: '¿Cuánto tiempo te lleva revisar a cada cliente, y cuántos puedes revisar a la vez?' },
      { pieza: 'garantia', pregunta: '¿Qué tiene que hacer tu cliente sí o sí para lograrlo?' },
      { pieza: 'urgencia', pregunta: '¿Tienes una fecha de inicio o un número de lugares por grupo?' },
    ],
    ficha: { insignia: 'Programa · alto ticket', chips: ['USD 1,500', 'Garantía de aplicación', '15 lugares'] },
    ejemplo: CIERRE_CONSULTIVO_90,
  },
  {
    id: 'cohorte-rapida',
    nombre: 'Cohorte con resultado rápido',
    cuando: 'Un grupo con fecha de inicio y de fin en el que tu cliente hace el trabajo con tu guía, y quieres que vea un resultado en la primera semana.',
    grupo: 'Programas y mentorías',
    negocio: { nombre: 'Consulta Rentable', nicho: 'Nutriólogas' },
    forma: {
      tipo: 'programa',
      quienHace: 'el cliente, con guía y revisión en grupo (la promesa nunca dice «lo hacemos por ti»).',
      garantia: 'por escalón: un resultado temprano y verificable.',
      urgencia: 'una cohorte con fecha.',
      pago: 'de contado, o 2 pagos (hoy y a 30 días).',
      mueve: 'el tiempo.',
    },
    preguntas: [
      { pieza: 'semana', pregunta: '¿Qué puede lograr tu cliente en su primera semana?' },
      { pieza: 'resultado', pregunta: '¿Con qué número se nota el resultado al final, y en cuánto tiempo?' },
      { pieza: 'prueba', pregunta: '¿Cuánto tenían tus clientes al empezar y cuánto al terminar?' },
      { pieza: 'formato', pregunta: '¿Cuántas sesiones hay, y qué hace tu cliente entre una y otra?' },
      { pieza: 'garantia', pregunta: '¿Qué resultado temprano podrías asegurar si tu cliente hace lo que le pides?' },
      { pieza: 'urgencia', pregunta: '¿Cuándo empieza el próximo grupo y cuántos lugares tiene?' },
    ],
    ficha: { insignia: 'Cohorte · alto ticket', chips: ['USD 1,200', 'Garantía de la semana 4', '20 lugares'] },
    ejemplo: CONSULTORIO_LLENO_90,
  },
  {
    id: 'servicio-hecho',
    nombre: 'Servicio hecho por ti',
    cuando: 'El negocio hace el trabajo por el cliente (agencia, implementación) y cobra por mes con un mínimo.',
    grupo: 'Servicios',
    negocio: { nombre: 'Pulso Dental', nicho: 'Clínicas dentales' },
    forma: {
      tipo: 'servicio',
      quienHace: 'el negocio.',
      garantia: 'por entregable («si en el mes 2 no hay X, el mes 3 no se cobra»).',
      urgencia: 'por capacidad (clientes nuevos por mes) y uno por especialidad en cada zona.',
      pago: 'mensual con un mínimo, o el trimestre adelantado con un ahorro.',
      bono: 'el costo de alta sin cargo.',
      mueve: 'el esfuerzo y la probabilidad.',
    },
    preguntas: [
      { pieza: 'entregables', pregunta: '¿Qué haces tú exactamente cada mes y qué tiene que hacer tu cliente?' },
      { pieza: 'resultado', pregunta: '¿Qué número le importa a tu cliente (citas, ventas, pacientes) y cuánto tarda en moverse?' },
      { pieza: 'prueba', pregunta: '¿Qué cliente tuyo movió ese número, y de cuánto a cuánto?' },
      { pieza: 'costo', pregunta: '¿Cuánto te cuesta atender a un cliente al mes, y cuántos puedes tomar?' },
      { pieza: 'garantia', pregunta: '¿Qué mínimo podrías asegurar en el segundo mes si tu cliente cumple su parte?' },
      { pieza: 'cobro', pregunta: '¿Cómo te pagan hoy: por mes, por adelantado, con contrato?' },
    ],
    ficha: { insignia: 'Servicio · mensual', chips: ['USD 1,200 al mes', 'Garantía: 15 valoraciones', '2 clínicas por mes'] },
    ejemplo: AGENDA_IMPLANTES_90,
  },
  {
    id: 'entrada-acredita',
    nombre: 'Entrada que se acredita',
    cuando: 'Tu oferta principal ya vende y quieres una entrada barata para que el prospecto pruebe tu método; lo que paga se descuenta si sube. No va antes de que la principal esté validada.',
    grupo: 'Entrada y continuidad',
    negocio: { nombre: 'Cierre Consultivo', nicho: 'Coach de ventas' },
    forma: {
      tipo: 'entrada',
      quienHace: 'el negocio (un diagnóstico).',
      garantia: 'sin preguntas, que en ticket bajo sí vale.',
      urgencia: 'el crédito a la oferta principal vence.',
      pago: 'un solo pago.',
      mueve: 'la probabilidad y el tiempo.',
    },
    preguntas: [
      { pieza: 'escalera', pregunta: '¿Qué vendes después de esta entrada, y a qué precio?' },
      { pieza: 'entregables', pregunta: '¿Qué recibe tu cliente en la entrada, y en cuántos días?' },
      { pieza: 'ventas', pregunta: 'De cada 10 que compran la entrada, ¿cuántos pasan a la oferta principal?' },
      { pieza: 'precio', pregunta: '¿Cuánto cobras por la entrada, y se descuenta si sube?' },
      { pieza: 'urgencia', pregunta: '¿Hasta cuándo vale el descuento para subir?' },
    ],
    ficha: { insignia: 'Entrada · ticket bajo', chips: ['USD 150', 'Se acredita al programa', 'Entrega en 5 días'] },
    ejemplo: REVISION_3_LLAMADAS,
  },
  {
    id: 'precio-tramos',
    nombre: 'Precio por tramos',
    cuando: 'El mismo programa lo compran personas y empresas, o hay clientes que piden más cercanía. Son tramos del mismo programa, no tres programas; si nadie te pide factura ni más cercanía, va un solo precio.',
    grupo: 'Programas y mentorías',
    negocio: { nombre: 'Voz de Líder', nicho: 'Gerentes' },
    forma: {
      tipo: 'programa',
      quienHace: 'juntos, en grupo.',
      garantia: 'condicional, con extensión 1 a 1.',
      urgencia: 'una cohorte de 12.',
      pago: 'el individual en 2 pagos o de contado; el de equipo, con factura.',
      precio: 'tramos del mismo programa, con un tramo premium que existe de verdad.',
      mueve: 'la probabilidad; además, el tramo de equipo baja el esfuerzo de la decisión cuando la empresa paga.',
    },
    preguntas: [
      { pieza: 'cliente', pregunta: '¿Quién paga hoy: la persona o su empresa?' },
      { pieza: 'precio', pregunta: '¿Cuánto cobras por persona, y alguien te pidió factura o un precio por grupo?' },
      { pieza: 'formato', pregunta: '¿Qué cambia si lo das a un equipo o dentro de una empresa?' },
      { pieza: 'costo', pregunta: '¿Cuánto te cuesta atender a una persona y a un equipo?' },
      { pieza: 'garantia', pregunta: '¿Qué tiene que hacer tu cliente sí o sí para lograrlo?' },
      { pieza: 'urgencia', pregunta: '¿Cuántos lugares tiene cada grupo, y por qué ese número?' },
    ],
    ficha: { insignia: 'Tramos · alto ticket', chips: ['USD 2,000', 'Equipo de 5: USD 8,500', '12 lugares'] },
    ejemplo: VOZ_DE_LIDER_90,
  },
  {
    id: 'preventa-etapas',
    nombre: 'Preventa por etapas',
    cuando: 'Vendes un inmueble, o algo que se entrega en el futuro, con un precio que sube por etapa y pagos durante la obra.',
    grupo: 'Inmobiliaria',
    negocio: { nombre: 'Torre Alameda', nicho: 'Querétaro' },
    forma: {
      tipo: 'producto',
      quienHace: 'el negocio construye y entrega; el cliente paga durante la obra.',
      garantia: 'por entregable: una penalización por retraso, escrita en el contrato.',
      urgencia: 'el inventario real y el precio por etapa publicado.',
      pago: 'apartado, enganche diferido y crédito o contado contra entrega.',
      mueve: 'la probabilidad y el esfuerzo.',
    },
    preguntas: [
      { pieza: 'entregables', pregunta: '¿Qué incluye cada unidad (metros, recámaras, cajones) y cuándo se entrega?' },
      { pieza: 'precio', pregunta: '¿Cuánto cuesta en esta etapa y cuándo sube?' },
      { pieza: 'cobro', pregunta: '¿Cómo se paga: apartado, enganche, crédito?' },
      { pieza: 'prueba', pregunta: '¿Qué entregaste antes, y en la fecha del contrato?' },
      { pieza: 'garantia', pregunta: '¿Qué dice el contrato si la obra se retrasa?' },
      { pieza: 'urgencia', pregunta: '¿Cuántas unidades quedan de cada tipo?' },
    ],
    ficha: { insignia: 'Preventa · inmobiliaria', chips: ['Desde MXN 2.4 M', 'Enganche en 18 meses', '14 con vista al parque'] },
    ejemplo: TORRE_ALAMEDA_E2,
  },
  {
    id: 'primera-camada',
    nombre: 'Primera camada, sin casos',
    cuando: 'Tu oferta es nueva y todavía no tienes casos con números.',
    grupo: 'Programas y mentorías',
    negocio: { nombre: 'Voz de Líder', nicho: 'Gerentes', momento: 'en su lanzamiento' },
    forma: {
      tipo: 'programa',
      quienHace: 'juntos, en un grupo chico.',
      garantia: 'por acciones, con extensión.',
      urgencia: 'una camada con cupo y una subida de precio anunciada.',
      pago: 'de contado, o 2 pagos (hoy y a 30 días).',
      prueba: 'trayectoria y proceso; el lugar de los casos queda marcado «[completar]» hasta que la camada termine.',
      precio: 'una valuación y el precio de la camada, con una razón real.',
      mueve: 'la probabilidad.',
    },
    preguntas: [
      { pieza: 'ventas', pregunta: '¿Alguien ya te pagó esta oferta? ¿Cuántos?' },
      { pieza: 'prueba', pregunta: '¿Qué hiciste antes que muestre que sabes lograrlo: tu trabajo, tus resultados propios, gente a la que ayudaste?' },
      { pieza: 'resultado', pregunta: '¿Qué resultado pequeño y seguro podría lograr alguien en tus primeras semanas?' },
      { pieza: 'costo', pregunta: '¿A cuántos puedes acompañar de cerca en esta primera camada?' },
      { pieza: 'precio', pregunta: '¿Cuánto cobrarías cuando tengas casos, y cuánto ahora?' },
      { pieza: 'garantia', pregunta: '¿Qué tiene que hacer tu cliente sí o sí para lograrlo?' },
    ],
    ficha: { insignia: 'Lanzamiento · sin casos', chips: ['USD 1,400 la camada', 'Garantía por asistencia', '8 lugares'] },
    ejemplo: VOZ_DE_LIDER_CAMADA,
  },
  {
    id: 'revisar-oferta',
    nombre: 'Revisar tu oferta: antes y después',
    cuando: 'Ya vendes algo y no cierra como quieres. MaKo lo puntúa con la rúbrica del marco y te dice qué cambiar primero.',
    grupo: 'Revisar tu oferta',
    negocio: { nombre: 'Pulso Dental', nicho: 'Clínicas dentales' },
    forma: {
      tipo: 'revisar',
      quienHace: 'el de la oferta de hoy: la revisión no lo cambia sin un motivo del diagnóstico.',
      garantia: 'la que salga del diagnóstico: si la certeza queda baja, una atada a lo que el negocio controla.',
      urgencia: 'solo si hay una razón real (capacidad, una fecha, el precio por etapa); si no hay ninguna, no se inventa.',
      pago: 'el de la oferta de hoy, salvo que el diagnóstico marque el precio y el cobro.',
      pasos: 'el diagnóstico de 9 notas, el cuello de botella, 3 cambios como hipótesis y la versión pulida.',
      mueve: 'la palanca que salga más baja.',
    },
    preguntas: [
      { pieza: 'entregables', pregunta: '¿Qué vendes hoy, qué recibe el cliente y cuánto cuesta?' },
      { pieza: 'ventas', pregunta: 'De cada 10 llamadas, ¿cuántas cierras?' },
      { pieza: 'objecion', pregunta: '¿Qué te dicen los que no compran?' },
      { pieza: 'prueba', pregunta: '¿Cuántos clientes lograron el resultado, y con qué números?' },
    ],
    ficha: { insignia: 'Revisar · antes y después', chips: ['9 notas', '3 cambios', 'Antes y después'] },
    ejemplo: AGENDA_IMPLANTES_90,
    diagnostico: DIAGNOSTICO_PULSO,
    revision: REVISION_PULSO,
  },
  {
    id: 'continuidad-egresados',
    nombre: 'Continuidad para egresados',
    cuando: 'Tu programa principal ya vende y tus egresados te piden seguir: les vendes una membresía mensual con algo nuevo cada mes. Solo si la oferta principal ya está validada.',
    grupo: 'Entrada y continuidad',
    negocio: { nombre: 'Consulta Rentable', nicho: 'Nutriólogas' },
    forma: {
      tipo: 'continuidad',
      quienHace: 'el cliente, con revisión en grupo.',
      garantia: 'el primer mes sin riesgo.',
      urgencia: 'precio de fundadoras para la primera generación.',
      pago: 'mensual o anual.',
      mueve: 'el tiempo y el esfuerzo de sostener el resultado.',
    },
    preguntas: [
      { pieza: 'escalera', pregunta: '¿Qué te piden tus clientes cuando terminan?' },
      { pieza: 'entregables', pregunta: '¿Qué recibirían cada mes que no tengan ya?' },
      { pieza: 'precio', pregunta: '¿Cuánto cobrarías por mes, y hay un precio anual?' },
      { pieza: 'urgencia', pregunta: '¿El primer grupo tendría un precio que después sube?' },
    ],
    ficha: { insignia: 'Continuidad · egresadas', chips: ['USD 97 al mes', 'Primer mes sin riesgo', 'Precio de fundadoras'] },
    ejemplo: CIRCULO_CONSULTORIO,
  },
];

/** La plantilla por su id, o null (un id que no es texto, o que no existe). */
export function plantillaOferta(id: unknown): PlantillaOferta | null {
  if (typeof id !== 'string') return null;
  return PLANTILLAS_OFERTA.find((p) => p.id === id) ?? null;
}

// ── Lo que viaja al prompt (el bloque `offer.experto`, plan §3.3) ────────────

const TIPO_LABEL: Record<TipoOferta, string> = {
  programa: 'un programa con un resultado y un plazo',
  servicio: 'un servicio que hace el negocio por su cliente',
  entrada: 'una entrada de ticket bajo que se acredita a la oferta principal',
  continuidad: 'una continuidad mensual para quien ya compró la oferta principal',
  producto: 'un producto que se entrega en el futuro: no es un programa, así que no le aplican la duración de 90 a 180 días ni la garantía por acciones',
  revisar: 'revisar la oferta que el negocio ya vende',
};

/** «- pieza: pregunta», una por renglón, en el orden de la forma (el slot `{{preguntas}}`). */
export function preguntasParaPrompt(p: PlantillaOferta): string {
  return p.preguntas.map((q) => `- ${q.pieza}: ${q.pregunta}`).join('\n');
}

/**
 * La forma en texto corto, para el prompt (el slot `{{forma}}`). Con `conPreguntas` (por defecto) suma al final las
 * preguntas de la forma; quien las mande en su propio slot (`{{preguntas}}`) pasa `conPreguntas: false`.
 */
export function formaParaPrompt(p: PlantillaOferta, opts: { conPreguntas?: boolean } = {}): string {
  const f = p.forma;
  const lineas = [
    `${p.nombre}. Cuándo usarla: ${p.cuando}`,
    `Tipo de oferta: ${TIPO_LABEL[f.tipo]}.`,
    `Quién hace el trabajo: ${f.quienHace}`,
    `Garantía que le queda: ${f.garantia}`,
    `Urgencia que le queda: ${f.urgencia}`,
    `Pago: ${f.pago}`,
    f.precio ? `Precio: ${f.precio}` : '',
    f.prueba ? `Prueba: ${f.prueba}` : '',
    f.bono ? `Bono típico: ${f.bono}` : '',
    f.pasos ? `Los pasos: ${f.pasos}` : '',
    `Lo que mueve: ${f.mueve}`,
  ].filter(Boolean);
  if (opts.conPreguntas !== false) lineas.push('Lo que esta forma necesita saber, en orden:', preguntasParaPrompt(p));
  return lineas.join('\n');
}

/** El tope del ejemplo resumido: el turno corre con un modelo chico (trampa 16 del plan). */
export const TOPE_EJEMPLO_PROMPT = 1_500;
/** El tope de cada renglón, para que una garantía larga no deje afuera la inversión. */
const TOPE_RENGLON = 380;

const renglon = (t: string): string => {
  const s = t.replace(/\s+/g, ' ').trim();
  return s.length <= TOPE_RENGLON ? s : `${cortarSinPartir(s, TOPE_RENGLON - 1).trimEnd()}…`;
};

/**
 * El ejemplo resumido, marcado FICTICIO adentro del texto (el slot `{{ejemplo}}`). Nunca pasa por
 * `contenidoNoConfiable` ni entra a las fuentes del dueño: es nuestro, y sus cifras no son las suyas (trampa 14).
 * Los renglones van por prioridad y se cortan en el último que entra en `TOPE_EJEMPLO_PROMPT`.
 */
export function ejemploParaPrompt(p: PlantillaOferta): string {
  const e = p.ejemplo;
  const negocio = `${p.negocio.nombre}${p.negocio.momento ? ` ${p.negocio.momento}` : ''}`;
  const lineas = [
    `EJEMPLO FICTICIO: ${negocio} (${p.negocio.nicho.toLowerCase()}) es un negocio inventado; sus nombres, cifras, casos, precios y fechas no existen.`,
  ];
  if (p.revision) lineas.push(`Antes: ${p.revision.antes} ${p.revision.resultados}`);
  if (p.diagnostico) {
    const c = p.diagnostico.calculo;
    lineas.push(`Diagnóstico: ${c.total}/100; lo que más frena: ${dimensionLabel(c.cuello)}.`);
  }
  if (p.revision) lineas.push(`Lo que se movió: ${p.revision.movio} Después:`);
  lineas.push(
    `Nombre: ${e.nombre}.`,
    `Frase: ${e.frase}`,
    `Garantía: ${e.garantia.nombre}. ${e.garantia.condiciones} Plazo: ${e.garantia.plazo} ${e.garantia.siNoCumple}`,
    `Bonos: ${e.bonos.map((b) => `${b.nombre} (contesta ${b.objecion})`).join('; ')}.`,
    `Inversión: ${e.inversion.precio} De contado: ${e.inversion.contado}`,
    `Urgencia: ${e.urgencia}`,
    `Formato: ${e.formato}`,
  );
  let out = '';
  for (const l of lineas.map(renglon)) {
    const siguiente = out ? `${out}\n${l}` : l;
    if (siguiente.length > TOPE_EJEMPLO_PROMPT) break;
    out = siguiente;
  }
  return out;
}

// ── «Nueva oferta»: la tarjeta y el primer mensaje (6/11/2026) ───────────────
// La regla de Create (Martín, 29/10/2026: «Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo"»): la
// tarjeta muestra la FORMA (el nombre de la plantilla, cuándo usarla y sus tres chips) y el ejemplo lleno se abre aparte
// con «Ver ejemplo». La conversación nace con lo que la persona eligió dicho en su PRIMER MENSAJE (`mensajeDePlantilla`):
// MaKo lo lee como cualquier pedido y pregunta lo que falta. Va como mensaje y no como un slot nuevo en un prompt: un slot
// nuevo no llega nunca a un prompt que alguien ya editó en /configuraciones (docs/plantillas-reales/README.md, §4).

/** El prefijo del id de una tarjeta de plantilla en «Nueva oferta» (las de cada funnel son `nueva:` y `analizar:`). */
export const PREFIJO_PLANTILLA_OFERTA = 'plantilla:';

/** La plantilla de una tarjeta, o null si la tarjeta es otra (crear o analizar en un funnel). */
export function plantillaDeTarjeta(id: string): PlantillaOferta | null {
  return id.startsWith(PREFIJO_PLANTILLA_OFERTA) ? plantillaOferta(id.slice(PREFIJO_PLANTILLA_OFERTA.length)) : null;
}

/** Lo que dice la persona al usar una plantilla: la forma que eligió y por dónde empezar. Sin datos del ejemplo. */
export function mensajeDePlantilla(p: PlantillaOferta): string {
  const f = p.forma;
  const primera = p.preguntas[0]?.pregunta;
  return [
    `Quiero armar mi oferta con la plantilla «${p.nombre}»: ${TIPO_LABEL[f.tipo]}.`,
    `- Quién hace el trabajo: ${f.quienHace}`,
    `- Garantía: ${f.garantia}`,
    `- Urgencia: ${f.urgencia}`,
    `- Pago: ${f.pago}`,
    primera ? `Pregúntame lo que falta, de a una, empezando por: ${primera}` : 'Pregúntame lo que falta, de a una.',
  ].join('\n');
}
