// =============================================================================
// lead-magnets/plantillas — las plantillas del Lead Magnet Generator (PURO)
// =============================================================================
// Martín, 29/10/2026, textual: «me lo imagino como una o varias plantillas... compartir un Notion con prompts, una guía, un
// checklist; un quiz (preguntas que llevan a un diagnóstico)... con el Web Generator; si la landing no lo permite, que el editor
// permita agregar formularios, enviar emails, conectarlo con el CRM o las automatizaciones; una clase grabada o un curso, que ya
// está Classroom... pensá qué más, por ejemplo dashboards».
//
// La tab NO es un editor nuevo: cada plantilla crea la pieza en la herramienta que ya existe y lleva a ella.
//   · Lo que se LEE o se USA (guía, checklist, prompts, planilla) es una página del Copywriter: nace con su ESTRUCTURA (un
//     título por sección y una guía en itálica debajo), nunca con el ejemplo. El ejemplo se ve aparte («Ver ejemplo»), como en
//     las demás tabs de Create (docs/plantillas-reales/README.md; Martín, 29/10: «el usuario piensa que es el guion que MaKo le
//     creó para su negocio»).
//   · Lo que se VE (la clase grabada) es una landing del Web Generator: registro arriba y el video en su página de gracias.
//   · Lo que se DESCUBRE (el quiz con diagnóstico) es una landing con el bloque `quiz` (lib/editor-landing/quiz.ts): preguntas
//     con puntos, el contacto (al CRM) y un resultado según el puntaje.
//
// ⚠️ Lo que NO es una plantilla, y por qué (docs/investigacion-lead-magnets.md):
//   · Un curso de Classroom: el portal abre un curso sólo a un cliente GANADO de ese producto (dar_acceso_curso). Regalarlo a
//     un lead es cambiar quién entra al portal, y eso lo decide Martín. La clase grabada va en la landing.
//   · Un Dashboard de MaKo: su link público muestra los números DEL NEGOCIO. El «tablero» que se regala es una planilla que el
//     lead copia (`planilla`), con las columnas de la plantilla.
//
// Los ejemplos son del elenco ficticio de docs/plantillas-reales/README.md (2.2), con sus cifras y nada más. Un resultado con
// número dice que es un caso, no una promesa. Español neutro con «tú» (la guarda de voseo barre este archivo).
// =============================================================================

/** Dónde se crea la pieza. */
import { cortarSinPartir } from '../unicode-seguro';

export type HerramientaLM = 'copywriter' | 'web';

/** Qué lleva cada sección del esqueleto, debajo de su título y su guía. */
export type FormaSeccion =
  | { tipo: 'parrafo' }
  | { tipo: 'tareas'; items: number }
  | { tipo: 'prompts'; items: number }
  | { tipo: 'tabla'; columnas: readonly string[]; filas: number };

/** Una sección de la pieza: su etiqueta (la del Copywriter: MAYÚSCULA, 2 a 20), su guía y su forma. */
export type SeccionLM = { etiqueta: string; guia: string; forma: FormaSeccion };

/** Una parte del ejemplo lleno: el título de la sección y su texto (un renglón por línea). */
export type ParteEjemplo = { titulo: string; texto: string };

export type PlantillaLeadMagnet = {
  id: string;
  nombre: string;
  /** La sección de la galería. */
  grupo: 'Para leer y usar' | 'Para ver' | 'Para descubrir';
  /** Arriba de la miniatura: el formato y su tamaño. */
  insignia: string;
  /** Cuándo usarla, en una línea (el `title` de la tarjeta). */
  ayuda: string;
  herramienta: HerramientaLM;
  /** El `tipo` del lead magnet (lib/entregable.ts): Documento, Checklist, Plantilla, Planilla Excel… */
  tipo: string;
  /** El emoji de la página del Copywriter. */
  emoji: string;
  /** Las secciones (Copywriter) o las partes de la landing (Web): los chips de la tarjeta. */
  secciones: readonly SeccionLM[];
  /** El objetivo de la landing del Web Generator (lib/editor-landing/plantillas.ts), si es una landing. */
  objetivoLanding?: string;
  /** El ejemplo de un negocio FICTICIO del elenco. Nunca nace en la pieza: se ve con «Ver ejemplo». */
  ejemplo: { negocio: string; rubro: string; titulo: string; partes: readonly ParteEjemplo[] };
  /** Los hechos del negocio que el ejemplo usa, en orden: lo que MaKo pregunta al adaptarla. */
  pide: readonly string[];
};

const p = (etiqueta: string, guia: string): SeccionLM => ({ etiqueta, guia, forma: { tipo: 'parrafo' } });

// ── 1 · Guía · Consulta Rentable ─────────────────────────────────────────────
const GUIA: PlantillaLeadMagnet = {
  id: 'guia',
  nombre: 'Guía práctica',
  grupo: 'Para leer y usar',
  insignia: '📘 Guía · 7 partes',
  ayuda: 'Para enseñar un método corto que deja ganas de más.',
  herramienta: 'copywriter',
  tipo: 'Documento',
  emoji: '📘',
  secciones: [
    p('LO QUE VAS A LOGRAR', 'En dos líneas: qué va a poder hacer quien la lea y en cuánto tiempo.'),
    p('PARA QUIÉN', 'A quién le sirve y a quién no. Que el lector se reconozca.'),
    p('PASO 1', 'El primer cambio, con un ejemplo de tu negocio.'),
    p('PASO 2', 'El segundo cambio. Un paso por sección, sin teoría de más.'),
    p('PASO 3', 'El tercero. Si cabe, un caso real (dilo como caso, no como promesa).'),
    p('ERRORES COMUNES', 'Lo que hace la mayoría y no funciona.'),
    p('SIGUIENTE PASO', 'Qué hacer ahora: agendar, ver la clase o escribirte.'),
  ],
  ejemplo: {
    negocio: 'Consulta Rentable',
    rubro: 'programa para nutriólogas',
    titulo: 'Guía: tu consulta llena sin publicar todos los días',
    partes: [
      { titulo: 'Lo que vas a lograr', texto: 'En 15 minutos vas a saber por qué tu agenda tiene huecos aunque publiques seguido, y qué cambiar esta semana para que los mensajes se vuelvan valoraciones.' },
      { titulo: 'Para quién', texto: 'Para nutriólogas que ya atienden pacientes y quieren llenar su consulta con un plan de 3 meses, no con consultas sueltas.' },
      { titulo: 'Paso 1 · Vende un plan, no una consulta', texto: 'Una consulta suelta se compara por precio. Un plan de 3 meses con nombre y resultado se compara por lo que logra. Ejemplo: un plan de MXN 2,400 al mes.' },
      { titulo: 'Paso 2 · Abre con una valoración de 20 minutos', texto: 'Antes del plan, una valoración corta: escuchas, mides y propones. Es la puerta, no la venta.' },
      { titulo: 'Paso 3 · Contesta el mismo día', texto: 'Un mensaje que espera se enfría. Responde con una pregunta, no con la lista de precios.\nUn caso, no una promesa: una alumna pasó en un mes de 60 mensajes a 18 valoraciones y 11 pacientes.' },
      { titulo: 'Errores comunes', texto: 'Publicar recetas en lugar de casos.\nMandar el precio antes de la valoración.\nCobrar por sesión suelta.' },
      { titulo: 'Siguiente paso', texto: 'Mira la clase gratuita de 42 minutos: «Cómo llenar tu consulta online sin publicar todos los días».' },
    ],
  },
  pide: ['oferta', 'avatar', 'metodo', 'caso', 'accion'],
};

// ── 2 · Checklist · Pulso Dental ─────────────────────────────────────────────
const CHECKLIST: PlantillaLeadMagnet = {
  id: 'checklist',
  nombre: 'Checklist',
  grupo: 'Para leer y usar',
  insignia: '✅ Checklist · 12 puntos',
  ayuda: 'Para que tu cliente se revise solo y vea lo que le falta.',
  herramienta: 'copywriter',
  tipo: 'Checklist',
  emoji: '✅',
  secciones: [
    p('PARA QUÉ SIRVE', 'Qué revisa esta lista y qué gana quien la completa.'),
    { etiqueta: 'ANTES', guia: 'Lo que tiene que estar listo antes de empezar. Un punto por renglón.', forma: { tipo: 'tareas', items: 4 } },
    { etiqueta: 'DURANTE', guia: 'Lo que se revisa mientras se hace.', forma: { tipo: 'tareas', items: 4 } },
    { etiqueta: 'DESPUÉS', guia: 'Lo que se mide al terminar.', forma: { tipo: 'tareas', items: 4 } },
    p('CÓMO LEER EL PUNTAJE', 'Qué significa marcar pocos, la mitad o casi todos.'),
    p('SIGUIENTE PASO', 'Qué hacer con lo que salió: agendar, ver una clase o escribirte.'),
  ],
  ejemplo: {
    negocio: 'Pulso Dental',
    rubro: 'agencia de pacientes para clínicas dentales',
    titulo: 'Checklist: 12 puntos antes de invertir en anuncios para tu clínica',
    partes: [
      { titulo: 'Para qué sirve', texto: 'Revisas en 5 minutos si tus anuncios van a traer pacientes o sólo mensajes. Analizamos 50 anuncios de clínicas: 43 no traían pacientes y 7 sí.' },
      { titulo: 'Antes', texto: '☐ Anuncias un tratamiento de alto valor, no la limpieza\n☐ Tienes una oferta con fecha\n☐ Sabes cuánto vale un paciente de implantes\n☐ Alguien contesta los mensajes el mismo día' },
      { titulo: 'Durante', texto: '☐ El anuncio muestra un caso, no el consultorio\n☐ El texto habla de un problema del paciente\n☐ El botón lleva a agendar, no a la página de inicio\n☐ Revisas el costo por valoración cada semana' },
      { titulo: 'Después', texto: '☐ Contaste cuántas valoraciones salieron\n☐ Sabes cuántas terminaron en tratamiento\n☐ Llamaste a los que no se presentaron\n☐ Guardaste qué anuncio trajo a cada paciente' },
      { titulo: 'Cómo leer el puntaje', texto: 'De 0 a 5: tus anuncios traen mensajes, no pacientes.\nDe 6 a 9: vas bien, falta medir.\nDe 10 a 12: listo para invertir más.' },
      { titulo: 'Siguiente paso', texto: 'Agenda la auditoría gratis de 30 minutos y la revisamos juntos.' },
    ],
  },
  pide: ['avatar', 'problema', 'pasos', 'accion'],
};

// ── 3 · Prompts para copiar (estilo Notion) · Cierre Consultivo ──────────────
const PROMPTS: PlantillaLeadMagnet = {
  id: 'prompts',
  nombre: 'Prompts para copiar',
  grupo: 'Para leer y usar',
  insignia: '🤖 Prompts · 9',
  ayuda: 'Una página tipo Notion con prompts listos para pegar en una IA.',
  herramienta: 'copywriter',
  tipo: 'Plantilla',
  emoji: '🤖',
  secciones: [
    p('CÓMO USARLOS', 'En qué IA se pegan y qué cambiar antes de usarlos.'),
    { etiqueta: 'PARA EMPEZAR', guia: 'Los prompts del primer paso. Cada uno, un desplegable: su nombre arriba y el prompt adentro.', forma: { tipo: 'prompts', items: 3 } },
    { etiqueta: 'PARA AVANZAR', guia: 'Los del segundo paso.', forma: { tipo: 'prompts', items: 3 } },
    { etiqueta: 'PARA CERRAR', guia: 'Los del último paso.', forma: { tipo: 'prompts', items: 3 } },
    p('SIGUIENTE PASO', 'Qué hacer cuando ya los probó.'),
  ],
  ejemplo: {
    negocio: 'Cierre Consultivo',
    rubro: 'coach de ventas para coaches',
    titulo: '9 prompts para preparar una llamada de venta',
    partes: [
      { titulo: 'Cómo usarlos', texto: 'Pégalos en ChatGPT o en Claude. Cambia lo que está entre corchetes por los datos de tu cliente.' },
      { titulo: 'Para empezar', texto: '▸ Lo que ya sé de mi cliente: «Resume en 5 puntos lo que sé de [cliente] por su formulario: [respuestas]».\n▸ Su problema real: «¿Qué problema de fondo hay detrás de esto que dijo: [frase]?».\n▸ Mis preguntas: «Dame 6 preguntas abiertas para entender por qué [cliente] no ha resuelto [problema]».' },
      { titulo: 'Para avanzar', texto: '▸ Las objeciones: «¿Qué 3 objeciones va a tener [cliente] con un programa de USD 1,500?».\n▸ El caso que le sirve: «De estos casos, ¿cuál se parece más a [cliente]?».\n▸ La propuesta: «Explica en 4 frases cómo el programa resuelve [problema]».' },
      { titulo: 'Para cerrar', texto: '▸ El cierre: «Escribe la pregunta para cerrar, sin presionar».\n▸ Si dice que lo va a pensar: «¿Qué le pregunto para saber qué falta?».\n▸ El mensaje del día siguiente: «Escribe un mensaje corto para quien no decidió».' },
      { titulo: 'Siguiente paso', texto: 'Si quieres que revisemos tus llamadas, la Revisión de 3 llamadas cuesta USD 150 y se acredita al programa.' },
    ],
  },
  pide: ['avatar', 'proceso', 'oferta', 'accion'],
};

// ── 4 · Planilla para copiar · Torre Alameda ───────────────────────
const PLANILLA: PlantillaLeadMagnet = {
  id: 'planilla',
  nombre: 'Planilla',
  grupo: 'Para leer y usar',
  insignia: '📊 Planilla · para copiar',
  ayuda: 'Una tabla que tu cliente copia y llena con sus números.',
  herramienta: 'copywriter',
  tipo: 'Planilla Excel',
  emoji: '📊',
  secciones: [
    p('PARA QUÉ SIRVE', 'Qué decide quien la llena, y en cuánto tiempo.'),
    { etiqueta: 'LA TABLA', guia: 'Las columnas y un renglón por concepto. Puedes pegar el link a tu hoja de cálculo para que la copien.', forma: { tipo: 'tabla', columnas: ['Concepto', 'Monto', 'Cuándo'], filas: 4 } },
    p('CÓMO LLENARLA', 'De dónde sale cada número.'),
    p('QUÉ MIRAR', 'La fila que decide, y qué hacer según lo que dé.'),
    p('SIGUIENTE PASO', 'Qué hacer con el resultado.'),
  ],
  ejemplo: {
    negocio: 'Torre Alameda',
    rubro: 'departamentos en preventa en Querétaro',
    titulo: 'Planilla: cuánto pagarías al mes por un depa en preventa',
    partes: [
      { titulo: 'Para qué sirve', texto: 'En 10 minutos sabes si te alcanza para un departamento de 2 recámaras en preventa, antes de visitar.' },
      { titulo: 'La tabla', texto: 'Apartado · MXN 20,000 · hoy\nEnganche del 10 % · 18 mensualidades de MXN 12,222 · hasta la entrega\nCrédito estimado · MXN 18,900 al mes · desde diciembre de 2027\nRenta típica de la zona · MXN 14,000 al mes · para comparar' },
      { titulo: 'Cómo llenarla', texto: 'El precio de la etapa 2 es desde MXN 2,400,000. El crédito es de MXN 2,160,000 a 20 años, con una tasa fija de referencia del 8.6 %: depende del banco.' },
      { titulo: 'Qué mirar', texto: 'Si la mensualidad del enganche entra en tu mes, puedes apartar. Si el crédito se parece a una renta, el depa se paga solo.' },
      { titulo: 'Siguiente paso', texto: 'Agenda una visita al showroom y Karen Méndez te arma los números con tu banco.' },
    ],
  },
  pide: ['producto', 'precio', 'numeros', 'accion'],
};

// ── 5 · Clase grabada (landing del Web Generator) · Voz de Líder ─────────────
const CLASE: PlantillaLeadMagnet = {
  id: 'clase-grabada',
  nombre: 'Clase grabada',
  grupo: 'Para ver',
  insignia: '🎬 Clase · página + video',
  ayuda: 'Una página donde se registran y después ven tu clase.',
  herramienta: 'web',
  objetivoLanding: 'clase-grabada',
  tipo: 'Metodología',
  emoji: '🎬',
  secciones: [
    p('REGISTRO', 'El título de la clase, lo que va a lograr y el formulario.'),
    p('QUÉ VAS A APRENDER', 'Las tres ideas de la clase.'),
    p('QUIÉN ENSEÑA', 'Por qué sabes de esto, en dos líneas.'),
    p('LA CLASE', 'La página de gracias: el video y el siguiente paso.'),
  ],
  ejemplo: {
    negocio: 'Voz de Líder',
    rubro: 'oratoria para gerentes',
    titulo: 'Clase grabada: presenta tus números sin que te interrumpan',
    partes: [
      { titulo: 'Registro', texto: 'Clase gratuita de 25 minutos. Deja tu nombre y tu correo y mírala ahora.' },
      { titulo: 'Qué vas a aprender', texto: 'Cómo abrir con la decisión que necesitas, no con el contexto.\nCómo contestar una pregunta difícil sin perder el hilo.\nCómo cerrar para que te aprueben en la misma junta.' },
      { titulo: 'Quién enseña', texto: 'Rodrigo Ibarra. Desde 2024 entrenó a 86 gerentes en 8 cohortes. Un caso, no una promesa: Carla presentó el presupuesto anual sin que la interrumpieran.' },
      { titulo: 'La clase', texto: 'El video de la clase y, abajo, la invitación: «Voz de Líder: 90 días», las inscripciones cierran el viernes (hora de Lima).' },
    ],
  },
  pide: ['tema', 'promesa', 'quien_soy', 'video', 'accion'],
};

// ── 6 · Quiz con diagnóstico (landing del Web Generator, bloque `quiz`) · Pulso Dental ───────────
// El flujo copiado de SurveyJS (docs/investigacion-lead-magnets.md): la portada, una pregunta por paso, el contacto y el
// resultado según el puntaje (lib/editor-landing/quiz.ts). Nace con la ESTRUCTURA del quiz (tres preguntas, tres resultados) y
// sin textos: hasta que se escriben, la página no lo muestra.
const QUIZ: PlantillaLeadMagnet = {
  id: 'quiz',
  nombre: 'Quiz con diagnóstico',
  grupo: 'Para descubrir',
  insignia: '🧭 Quiz · 5 preguntas',
  ayuda: 'Preguntas que llevan a un resultado distinto según lo que contestan.',
  herramienta: 'web',
  objetivoLanding: 'quiz',
  tipo: 'Metodología',
  emoji: '🧭',
  secciones: [
    p('LA PORTADA', 'El título y qué va a saber quien lo conteste.'),
    p('LAS PREGUNTAS', 'De opción única; cada opción suma puntos.'),
    p('EL CONTACTO', 'Nombre y correo antes del resultado: entran a tu CRM.'),
    p('LOS RESULTADOS', 'Uno por rango de puntaje, con qué hacer ahora.'),
  ],
  ejemplo: {
    negocio: 'Pulso Dental',
    rubro: 'agencia para clínicas dentales',
    titulo: 'Quiz: ¿por qué tus anuncios no te traen pacientes?',
    partes: [
      { titulo: 'La portada', texto: '5 preguntas, 2 minutos. Al final sabes qué está frenando tu agenda de implantes.' },
      { titulo: 'Las preguntas', texto: '¿Qué anuncias? Limpieza (0) · Un tratamiento con precio (1) · Implantes con un caso real (2).\n¿Cuánto tardas en contestar un mensaje? Más de 3 horas (0) · 1 hora (1) · Menos de 10 minutos (2).\n¿Quién contesta? Nadie fijo (0) · La recepción (1) · Una persona con guion (2).' },
      { titulo: 'El contacto', texto: 'Nombre, correo y WhatsApp. Entran al CRM de la clínica con su resultado.' },
      { titulo: 'Los resultados', texto: 'De 0 a 4: «Tus anuncios atraen curiosos». De 5 a 7: «Llegan pacientes, se pierden en el chat». Desde 8: «Listo para escalar implantes», con el botón a la auditoría gratis de 30 minutos.' },
    ],
  },
  pide: ['tema', 'preguntas', 'resultados', 'accion'],
};

/** Las plantillas, en el orden de la galería. */
export const PLANTILLAS_LEAD_MAGNET: readonly PlantillaLeadMagnet[] = [GUIA, CHECKLIST, PROMPTS, PLANILLA, CLASE, QUIZ];

/** La plantilla con ese id, o null: la ruta no confía en lo que llega del navegador. */
export function plantillaLeadMagnet(id: unknown): PlantillaLeadMagnet | null {
  return typeof id === 'string' ? PLANTILLAS_LEAD_MAGNET.find((x) => x.id === id) ?? null : null;
}

/** El nombre con que nace el lead magnet si no se pidió otro: el de la plantilla. */
export function nombreInicial(pl: PlantillaLeadMagnet, pedido?: string | null): string {
  // Cortado sin partir un emoji (`cortarSinPartir`): medio emoji hace que la base rechace la lista entera.
  const n = cortarSinPartir((pedido ?? '').replace(/\s+/g, ' ').trim(), 120).trim();
  return n || pl.nombre;
}

/** Los chips de la tarjeta: los nombres de las secciones, como los lee la página. */
export function chipsDeLeadMagnet(pl: PlantillaLeadMagnet): string[] {
  return pl.secciones.map((s) => s.etiqueta.charAt(0) + s.etiqueta.slice(1).toLowerCase());
}

/** El extracto de la hoja de la tarjeta: el título del ejemplo y su primera parte. */
export function extractoDeLeadMagnet(pl: PlantillaLeadMagnet): string {
  const primera = pl.ejemplo.partes[0]?.texto.split('\n')[0] ?? '';
  return `${pl.ejemplo.titulo}\n${primera}`;
}

/** Lo que dice la herramienta donde nace, para la tarjeta y el detalle. */
export const NOMBRE_HERRAMIENTA: Readonly<Record<HerramientaLM, string>> = { copywriter: 'Copywriting', web: 'Web Generator' };
