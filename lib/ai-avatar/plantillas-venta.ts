// =============================================================================
// Las PLANTILLAS DE VENTA de AI Avatar: anuncios de ejemplo completos, de un negocio ficticio (tanda AV-1)
// =============================================================================
// Martín (29/10/2026): «Los templates tienen que ser reales… deben ser ejemplos reales». El plan entero, con el porqué de
// cada plantilla, sus cuentas y sus trampas: docs/plantillas-reales/avatar.md (sección 2, las 10 fichas; sección 5, la tanda
// AV-1). La regla común de las cinco tabs de Create: docs/plantillas-reales/README.md.
//
// UNA PLANTILLA DE VENTA NO ES UN PRESET, y son DOS listas distintas:
//   · el PRESET es la escena (los 28 de ./plantillas.ts, `PLANTILLAS_AVATAR`), y se queda en la galería del estudio;
//   · la PLANTILLA DE VENTA es escena + guion + textos en pantalla + negocio de ejemplo, y APUNTA a un preset por su id
//     (`presetId`). No copia el prompt: si la escena cambia, cambia en el preset.
// Las escenas que las plantillas necesitaban y no existían son los 5 presets de `PRESETS_NUEVOS_VENTA` (abajo). Viven aquí
// hasta que se sumen a `PLANTILLAS_AVATAR` (el paso 1 de la tanda AV-1 en el plan): mientras tanto, la galería no los muestra
// y quien resuelva el `presetId` de una plantilla busca en las dos listas.
//
// LOS IDS SON PERMANENTES: un proyecto guarda la plantilla de la que nació, y un `?plantilla=` puede viajar en un link. No se
// renombran; una plantilla que se va deja su id sin reusar.
//
// LOS NEGOCIOS SON FICTICIOS: el elenco del README (2.2), Cierre Consultivo, Consulta Rentable, Pulso Dental, Torre Alameda y
// Voz de Líder, con sus clientes inventados. Ninguno nombra a alguien de `REALES` (tests/_reales.ts). Ningún ejemplo tiene un
// «[DATO: …]» ni un «[completar]»: eso aparece sólo en la versión que adapta el Director.
//
// CÓMO SE ESCRIBE UN GUION:
//   · la etiqueta va sola en su línea, en mayúsculas y sin tilde (las de lib/guion-estructuras.ts, en su orden): no se
//     pronuncia (`soloHablado`) y parte el guion en tarjetas (`parsearSecciones`), igual que en el Copywriter;
//   · los números HABLADOS van con letras («mil quinientos dólares»), porque la duración se calcula contando palabras y
//     «1,500» cuenta como una (trampa 9). En pantalla (`tramos[].texto`, `ganchos[].texto`) van en cifras;
//   · español neutro con «tú». El guion que adapta el Director sigue el acento del negocio (`acentoEsVoseante`), pero los
//     ejemplos del producto van siempre de tú;
//   · `duracion` son los segundos que necesita lo hablado a la densidad de la puesta del preset (`cabidaDeGuion`, el chip
//     «~33 s» de la tarjeta). ⚠️ No es el largo del video: una puesta con piso de tomas (el auto y el plano secuencia, 7 tomas
//     de 8 s como mínimo) entrega más segundos que los que se hablan.
//
// ⚠️ LA PLANTILLA 5 (podcast) QUEDA «A MEDIR» (trampa 6): su preset, `podcast-experto`, usa la puesta `podcast`, que declara
// DOS personas, y el avatar es una sola. Antes de ofrecerla se filma un video de 2 tomas; si el plan reparte el guion entre
// dos voces, el preset pasa a `ugc-sin-producto`.
//
// DE DÓNDE SALE LA FORMA (traducida y reescrita, sin texto en inglés salvo los prompts de escena, que van a Flow):
//   · los disparadores del gancho y la terna dicho / texto en pantalla, y el arco del guion UGC: motion-creative/skills,
//     `hook-writing` y `ugc-scriptwriter` (https://github.com/motion-creative/skills, MIT, «Copyright (c) 2025 Motion»,
//     lib/avisos/LICENSE-MOTION-SKILLS), sin su promoción;
//   · cuándo conviene un avatar, «los subtítulos siempre» y «el texto lo pone el editor, el video nunca»: marketingskills,
//     `skills/video/SKILL.md` (https://github.com/coreyhaines31/marketingskills, MIT, «Copyright (c) 2025 Corey Haines»,
//     lib/avisos/LICENSE-MARKETINGSKILLS);
//   · el vocabulario de cámara, lente y luz de los prompts de los presets nuevos: Google Cloud, «Video generation prompt
//     guide» (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide), contenido bajo
//     CC BY 4.0. Sin los términos que disparan la guarda de cara (trampa 2).
//
// PURO, SIN `server-only`: lo leen la pantalla, el teléfono, el server y los tests.
// =============================================================================

import { ESTRUCTURAS_GUION_DEFAULT } from '../guion-estructuras';
import type { PlantillaAvatar } from './plantillas';

/** Los negocios del elenco común (docs/plantillas-reales/README.md, 2.2). Ficticios. */
export const NEGOCIOS_ELENCO = ['Cierre Consultivo', 'Consulta Rentable', 'Pulso Dental', 'Torre Alameda', 'Voz de Líder'] as const;
export type NegocioElenco = (typeof NEGOCIOS_ELENCO)[number];

export type TramoAvatar = {
  /** La etiqueta de la sección del guion a la que pertenece (una de `estructura`). */
  etiqueta: string;
  /** El texto en pantalla, en cifras. Vacío cuando el tramo no lleva texto. Lo pone el editor, nunca el video. */
  texto: string;
  /** Lo que se ve en ese tramo. */
  seVe: string;
};

export type GanchoAvatar = {
  /** Qué disparador usa: identidad, idea contraria, curiosidad, prueba… */
  disparador: string;
  /** Lo que dice el avatar en lugar de la primera frase del GANCHO (con letras: se habla). */
  dice: string;
  /** El texto en pantalla de ese gancho (en cifras). */
  texto: string;
};

export type PlantillaVentaAvatar = {
  /** Permanente, en kebab-case: 'confesion-auto'. */
  id: string;
  /** «Confesión en el auto». */
  nombre: string;
  /** Cuándo usarla, en una línea (el `title` de la tarjeta). */
  cuando: string;
  /** El negocio ficticio del ejemplo. */
  negocio: NegocioElenco;
  /** El chip del rubro: «Coach de ventas». */
  rubro: string;
  /** El id de un preset: uno de `PLANTILLAS_AVATAR` (./plantillas.ts) o de `PRESETS_NUEVOS_VENTA`. */
  presetId: string;
  /** El ajuste de la escena, en español: ropa, momento del día, un objeto. Nunca la cara. */
  detalle: string;
  /** El id de una estructura de lib/guion-estructuras.ts. */
  estructuraId: string;
  /** Los segundos que necesita lo hablado del ejemplo (el chip «~33 s»). */
  duracion: number;
  /** Una voz de la galería para escuchar el tono (`vozSugerida`). El video habla con la voz de Flow (trampa 17). */
  voz?: string;
  /** Las etiquetas de las secciones del guion, en orden: con lo que nace el proyecto. Salen de la estructura. */
  estructura: readonly string[];
  /** El ejemplo completo, del negocio ficticio. */
  ejemplo: {
    guion: string;
    tramos: ReadonlyArray<TramoAvatar>;
    ganchos: ReadonlyArray<GanchoAvatar>;
  };
  /** Los hechos del negocio que el ejemplo usa, en orden: el Director busca estos y pregunta sólo los que faltan. */
  pide: readonly string[];
};

/** El guion de un ejemplo: cada sección es su etiqueta, sola en su línea, y el texto debajo. Sin `\r`, en cualquier checkout. */
const guion = (...secciones: ReadonlyArray<readonly [string, string]>): string =>
  secciones.map(([etiqueta, texto]) => `${etiqueta}\n${texto}`).join('\n');

/** Las etiquetas de una estructura, de su única fuente. Vacío si el id no existe (el test lo frena). */
function etiquetasDe(estructuraId: string): readonly string[] {
  const e = ESTRUCTURAS_GUION_DEFAULT.find((x) => x.id === estructuraId);
  return Object.freeze([...(e?.etiquetas ?? [])]);
}

const conEstructura = (p: Omit<PlantillaVentaAvatar, 'estructura'>): PlantillaVentaAvatar =>
  Object.freeze({ ...p, estructura: etiquetasDe(p.estructuraId) });

/** Las 10 plantillas de venta, en el orden del plan (dos por negocio del elenco). */
export const PLANTILLAS_VENTA_AVATAR: readonly PlantillaVentaAvatar[] = Object.freeze([
  // ── 1 · Confesión en el auto · Cierre Consultivo ───────────────────────────
  conEstructura({
    id: 'confesion-auto',
    nombre: 'Confesión en el auto',
    cuando: 'Con público frío que no te conoce, para vender una llamada de diagnóstico. Es lo-fi: parece grabado con el teléfono.',
    negocio: 'Cierre Consultivo',
    rubro: 'Coach de ventas',
    presetId: 'auto-testimonio',
    detalle: 'Con camisa blanca de lino',
    estructuraId: 'pas',
    duracion: 33,
    voz: 'mexicano-mujer-1',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Esta semana tres personas me dijeron «lo voy a pensar». Y no, no era el precio.'],
        ['PROBLEMA', 'Yo explicaba mi programa veinte minutos seguidos. Les encantaba, me decían que sí, y nunca me volvían a escribir.'],
        ['AGITACION', 'Cada «lo voy a pensar» eran mil quinientos dólares que se quedaban en un chat. Y al mes siguiente, yo bajaba el precio.'],
        ['SOLUCION', 'Ahora la persona habla primero: seis preguntas, siempre en el mismo orden. El precio llega al final, cuando ya me dijo cuánto le cuesta seguir igual.'],
        ['CTA', 'Si haces llamadas de venta, toca «Más información» y agenda treinta minutos conmigo.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: '3 "lo voy a pensar" esta semana', seVe: 'Andrea al volante, mirando al lente.' },
        { etiqueta: 'PROBLEMA', texto: '', seVe: 'La misma toma.' },
        { etiqueta: 'AGITACION', texto: 'USD 1,500 en un chat', seVe: 'Zoom digital al 110 % para disimular el corte.' },
        { etiqueta: 'SOLUCION', texto: '6 preguntas · el precio al final', seVe: 'La misma toma.' },
        { etiqueta: 'CTA', texto: 'Diagnóstico gratis · 30 min', seVe: 'La misma toma; subtítulos en todo el video.' },
      ],
      ganchos: [
        { disparador: 'Identidad', dice: 'Si eres coach y tus llamadas terminan en "déjame consultarlo", esto es para ti.', texto: 'Coaches: "déjame consultarlo"' },
        { disparador: 'Idea contraria', dice: 'Bajar el precio no cierra más llamadas. Cambiar el orden de la llamada, sí.', texto: 'No es el precio' },
        { disparador: 'Curiosidad', dice: 'Hay una pregunta que hago antes de decir el precio, y cambió mis llamadas.', texto: 'La pregunta antes del precio' },
      ],
    },
    pide: ['El precio', 'Qué pasa hoy en sus llamadas', 'Cuántas preguntas o pasos tiene su método', 'La acción que pide el anuncio'],
  }),

  // ── 2 · Respondo un comentario · Cierre Consultivo ─────────────────────────
  conEstructura({
    id: 'respondo-comentario',
    nombre: 'Respondo un comentario',
    cuando: 'Retargeting y la objeción de precio más común, para quien ya vio otro anuncio.',
    negocio: 'Cierre Consultivo',
    rubro: 'Coach de ventas',
    presetId: 'selfie-iphone',
    detalle: 'Con suéter gris claro, en un parque de la ciudad',
    estructuraId: 'gancho-valor-cta',
    duracion: 27,
    voz: 'mexicano-mujer-1',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Me escribieron esto: «¿Mil quinientos dólares, si en YouTube está todo gratis?». Tienes razón. Y te explico por qué igual lo cobro.'],
        ['VALOR', 'En YouTube están las seis preguntas. Lo que no está es alguien que escuche tu llamada grabada y te diga en qué minuto la perdiste. En el programa reviso seis llamadas tuyas, una por una. Por eso son quince lugares: cada llamada la escucho yo.'],
        ['CTA', 'Si quieres saber si es para ti, toca el botón y responde cuatro preguntas.'],
      ),
      tramos: [
        {
          etiqueta: 'GANCHO',
          texto: '¿USD 1,500, si en YouTube está todo gratis?',
          seVe: 'Andrea a cámara. El comentario va como globo de respuesta, arriba a la izquierda: una imagen hecha en el Image Editor y puesta encima en el Video Editor. En el ejemplo es de un usuario ficticio.',
        },
        { etiqueta: 'VALOR', texto: '6 llamadas tuyas, revisadas una por una', seVe: 'La misma toma.' },
        { etiqueta: 'CTA', texto: '15 lugares por cohorte', seVe: 'La misma toma.' },
      ],
      ganchos: [
        { disparador: 'Idea contraria', dice: 'Todo lo que enseño está gratis en internet. Lo que no está gratis es que alguien escuche tu llamada.', texto: 'Gratis en internet' },
        { disparador: 'Pregunta', dice: '¿Por qué pagarías por algo que está en YouTube?', texto: '¿Pagar por lo gratis?' },
        { disparador: 'Identidad', dice: 'Si ya viste diez videos de ventas y sigues sin cerrar, lee este comentario.', texto: '10 videos y 0 cierres' },
      ],
    },
    pide: ['El comentario real (la captura, con el nombre tapado y su permiso)', 'Qué incluye el programa que no está gratis', 'Por qué hay cupo'],
  }),

  // ── 3 · Pizarra: el método en 3 pasos · Consulta Rentable ──────────────────
  conEstructura({
    id: 'pizarra-metodo',
    nombre: 'Pizarra: el método en 3 pasos',
    cuando: 'Para invitar a una clase gratuita en vivo que vende un programa high ticket: educa con el método y cierra en el registro.',
    negocio: 'Consulta Rentable',
    rubro: 'Infoproducto',
    presetId: 'pizarra-estudio',
    detalle: 'Con blazer azul marino',
    estructuraId: 'gancho-valor-cta',
    duracion: 24,
    voz: 'mexicano-mujer-2',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Si eres nutrióloga, publicas recetas todos los días y tu agenda sigue vacía, te falta un paso.'],
        ['VALOR', 'Uno: una oferta de entrada clara, con resultado y tiempo. Dos: el paso del medio, una valoración de veinte minutos. Tres: el mensaje del precio. El paso dos es el que casi nadie diseña.'],
        ['CTA', 'El jueves doce lo explico en una clase gratuita en vivo, con ejemplos. Reserva tu lugar en el enlace.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: 'Agenda vacía con recetas diarias', seVe: 'Mariana junto a la pizarra vacía.' },
        {
          etiqueta: 'VALOR',
          texto: '1 Oferta de entrada · 2 El paso del medio · 3 El mensaje del precio',
          seVe: 'Sobre la pizarra, uno por vez: el editor anima los tres textos. La pizarra va vacía en la imagen: la IA no escribe texto legible.',
        },
        { etiqueta: 'CTA', texto: 'Clase gratuita · jueves 12 · en vivo', seVe: 'Una placa con la fecha de la clase.' },
      ],
      ganchos: [
        { disparador: 'Idea contraria', dice: 'Publicar recetas no te trae pacientes. Te trae seguidores que cocinan.', texto: 'Menos recetas, más citas' },
        { disparador: 'Prueba', dice: 'Así trabajan las ciento cuarenta alumnas del programa.', texto: '140 alumnas desde 2023' },
        { disparador: 'Curiosidad', dice: 'Entre "me interesa" y "agendé" hay un paso que nadie diseña.', texto: 'El paso que falta' },
      ],
    },
    pide: ['Los pasos de su método', 'El día y la hora de la clase', 'La prueba: cantidad de alumnos o un caso con permiso'],
  }),

  // ── 4 · Mañana en la cocina · Consulta Rentable ────────────────────────────
  conEstructura({
    id: 'manana-cocina',
    nombre: 'Mañana en la cocina',
    cuando: 'Orgánico o tráfico tibio en Instagram: el método aparece dentro de la rutina y el CTA es por mensaje.',
    negocio: 'Consulta Rentable',
    rubro: 'Infoproducto',
    presetId: 'cocina-manana',
    detalle: 'Con suéter de punto color crema',
    estructuraId: 'reel-nicho',
    duracion: 26,
    voz: 'mexicano-mujer-2',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Son las siete de la mañana y, antes del café, reviso una sola cosa: cuántas valoraciones tengo hoy.'],
        ['PROBLEMA', 'Casi todas las nutriólogas que me escriben publican todos los días. Les llegan mensajes, pero nadie agenda.'],
        ['SOLUCION', 'A una alumna le escribieron sesenta personas el mes pasado. Dieciocho llegaron a la valoración de veinte minutos, y once hoy son sus pacientes.'],
        ['CTA', 'Si quieres el mensaje exacto con el que invita a la valoración, escríbeme VALORACIÓN por mensaje directo.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: '7:00 a. m. · valoraciones de hoy', seVe: 'Mariana con la taza.' },
        { etiqueta: 'PROBLEMA', texto: 'Mensajes sí, citas no', seVe: 'La misma toma.' },
        {
          etiqueta: 'SOLUCION',
          texto: 'Una alumna: 60 mensajes → 18 valoraciones → 11 pacientes · Resultado de un caso',
          seVe: 'B-roll de 1 s: la agenda. En el ejemplo es una maqueta del Image Editor con nombres ficticios difuminados; en la versión de la persona, su captura real o la de un cliente con permiso.',
        },
        {
          etiqueta: 'CTA',
          texto: 'Escríbeme VALORACIÓN',
          seVe: 'La misma toma. Va sólo si existe la respuesta automática a esa palabra; si no, «Agenda desde el enlace».',
        },
      ],
      ganchos: [
        { disparador: 'Escena con resultado', dice: 'Antes de abrir la consulta ya sé quién viene hoy, y no publiqué nada ayer.', texto: 'Sin publicar ayer' },
        { disparador: 'Curiosidad', dice: 'A una alumna le escribieron sesenta personas y once hoy son sus pacientes. Te cuento qué pasa en el medio.', texto: '60 → 11' },
        { disparador: 'Identidad', dice: 'Si eres nutrióloga y te escriben pero no agendan, mira esto.', texto: 'Te escriben y no agendan' },
      ],
    },
    pide: [
      'Los números reales de mensajes, valoraciones y pacientes, suyos o de un cliente con permiso (sin números, la solución pasa a ser de proceso)',
      'Si tiene la respuesta automática para la palabra clave',
    ],
  }),

  // ── 5 · Episodio de podcast · Pulso Dental (a medir: trampa 6) ─────────────
  conEstructura({
    id: 'episodio-podcast',
    nombre: 'Episodio de podcast',
    cuando: 'Para vender autoridad a dueños de clínicas en frío: abre con una idea contraria a lo que cree el mercado y cierra en la auditoría gratis.',
    negocio: 'Pulso Dental',
    rubro: 'Agencia',
    presetId: 'podcast-experto',
    detalle: 'Con suéter negro de cuello redondo y auriculares al cuello',
    estructuraId: 'gancho-valor-cta',
    duracion: 26,
    voz: 'colombiano-hombre-1',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Revisé cincuenta anuncios de clínicas dentales. Cuarenta y tres están quemando dinero, y el problema no es el anuncio.'],
        ['VALOR', 'Les escribimos a las cincuenta como si fuéramos pacientes. Tardaron, en promedio, tres horas y cuarenta minutos en contestar. Once nunca contestaron. Quien pregunta por un implante no espera tres horas: le escribe a la clínica de al lado.'],
        ['CTA', 'Si tienes una clínica, agenda la auditoría gratis de treinta minutos y revisamos juntos tus últimos veinte mensajes.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: '43 de 50 anuncios queman dinero', seVe: 'Diego en el set, plano medio.' },
        {
          etiqueta: 'VALOR',
          texto: '3 h 40 min para responder · 11 nunca contestaron',
          seVe: 'Corte al segundo ángulo (un segundo look, de perfil desde la izquierda) en «Once nunca contestaron».',
        },
        { etiqueta: 'CTA', texto: 'Auditoría gratis · 30 min', seVe: 'Primer ángulo.' },
      ],
      ganchos: [
        { disparador: 'Pregunta', dice: '¿Cuánto tarda tu clínica en contestar un mensaje? Mídelo hoy.', texto: '¿Cuánto tardas en responder?' },
        { disparador: 'Idea contraria', dice: 'Tu problema no son los anuncios. Es lo que pasa después del anuncio.', texto: 'Después del anuncio' },
        { disparador: 'Prueba', dice: 'Una clínica pasó de seis a veintitrés valoraciones sin subir la inversión.', texto: '6 → 23 valoraciones' },
      ],
    },
    pide: ['Un dato propio medido (sin dato, el gancho pasa a ser una pregunta)', 'La oferta de entrada (auditoría, diagnóstico)'],
  }),

  // ── 6 · Caso de un cliente, caminando por la oficina · Pulso Dental ────────
  conEstructura({
    id: 'caso-cliente-oficina',
    nombre: 'Caso de un cliente, caminando por la oficina',
    cuando: 'Prueba social contada por el dueño, nunca por un avatar que se hace pasar por el cliente. Para retargeting o público tibio.',
    negocio: 'Pulso Dental',
    rubro: 'Agencia',
    presetId: 'oficina-presentador',
    detalle: 'Con camisa oxford celeste',
    estructuraId: 'gancho-historia-cta',
    duracion: 39,
    voz: 'colombiano-hombre-1',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Esta clínica de Medellín invertía lo mismo que hoy en anuncios y tenía seis valoraciones al mes.'],
        ['HISTORIA', 'Los anuncios funcionaban. El problema venía después: los mensajes se contestaban por la tarde y nadie decía el rango de precio. Cambiamos tres cosas: respuesta en menos de cinco minutos, cinco preguntas de filtro y una sola invitación, la valoración. Al tercer mes tuvieron veintitrés valoraciones y nueve tratamientos.'],
        ['CTA', 'Si tu clínica recibe mensajes pero no pacientes, agenda la auditoría de treinta minutos.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: 'Clínica Dental Altamira · Medellín', seVe: 'Diego camina por la oficina y habla.' },
        {
          etiqueta: 'HISTORIA',
          texto: 'Respuesta en < 5 min · 5 preguntas · 1 invitación',
          seVe: 'En off. B-roll: un chat de WhatsApp respondido en 4 min. En el ejemplo, una maqueta del Image Editor.',
        },
        { etiqueta: 'HISTORIA', texto: '6 → 23 valoraciones al mes · misma inversión', seVe: 'Diego habla a cámara.' },
        {
          etiqueta: 'HISTORIA',
          texto: '9 tratamientos al tercer mes · Resultado de una clínica en particular',
          seVe: 'En off. B-roll: el tablero semanal. En el ejemplo, una maqueta.',
        },
        { etiqueta: 'CTA', texto: 'Auditoría · 30 min', seVe: 'Diego a cámara.' },
      ],
      ganchos: [
        { disparador: 'Antes y después', dice: 'Seis valoraciones al mes. Tres meses después, veintitrés. Mismo presupuesto.', texto: '6 → 23' },
        // «casi cuadruplicó» sale de 6 → 23: el Director recalcula la palabra con los números de cada caso, nunca la copia.
        { disparador: 'Curiosidad', dice: 'No cambiamos ni un anuncio de esta clínica, y casi cuadruplicó sus valoraciones.', texto: 'Sin tocar los anuncios' },
        { disparador: 'Identidad', dice: 'Si tu clínica recibe mensajes y no pacientes, este caso es el tuyo.', texto: 'Mensajes ≠ pacientes' },
      ],
    },
    pide: [
      'El caso real, con el permiso escrito del cliente para decir su nombre y sus números (sin permiso, va sin nombre)',
      'Qué cambió',
      'En cuánto tiempo',
    ],
  }),

  // ── 7 · Recorrido de la preventa · Torre Alameda ───────────────────────────
  conEstructura({
    id: 'recorrido-preventa',
    nombre: 'Recorrido de la preventa',
    cuando: 'Inmobiliarias en preventa con público tibio: la asesora presenta y el departamento se ve sólo en el video o los renders oficiales.',
    negocio: 'Torre Alameda',
    rubro: 'Inmobiliaria',
    presetId: 'oficina-presentador',
    detalle: 'Con blazer color camel, en una oficina de ventas',
    estructuraId: 'cuatro-p',
    duracion: 36,
    voz: 'mexicano-mujer-1',
    ejemplo: {
      guion: guion(
        ['PROMESA', 'Si estás comparando preventas en Querétaro, este recorrido te ahorra dos visitas.'],
        ['PINTURA', 'Setenta y ocho metros, dos recámaras y dos baños. Enfrente hay un parque municipal. Además, alberca, gimnasio y roof garden.'],
        ['PRUEBA', 'La etapa uno se entregó en noviembre de dos mil veinticinco, en la fecha del contrato. La etapa dos va en el sesenta por ciento.'],
        ['CTA', 'Escríbeme por WhatsApp y hoy te mando la lista de precios y la corrida con enganche diferido.'],
      ),
      tramos: [
        { etiqueta: 'PROMESA', texto: 'Desde MXN 2.4 M · 2 recámaras · 78 m²', seVe: 'La asesora en la oficina de ventas.' },
        {
          etiqueta: 'PINTURA',
          texto: 'Vista al parque · alberca · roof garden',
          seVe: 'En off. Video o renders OFICIALES del departamento. En el ejemplo, un cuadro rotulado «Video oficial del departamento muestra»: un interior hecho por la IA sería publicidad engañosa.',
        },
        { etiqueta: 'PRUEBA', texto: 'Etapa 1 entregada a tiempo · avance de obra 60 %', seVe: 'La asesora a cámara; foto oficial de la obra si existe.' },
        { etiqueta: 'CTA', texto: 'Enganche 10 % a 18 meses', seVe: 'La asesora a cámara.' },
      ],
      ganchos: [
        { disparador: 'Pregunta', dice: '¿Rentar tres años más o dar el enganche este año?', texto: 'La cuenta que nadie te hace' },
        { disparador: 'Prueba primero', dice: 'La etapa uno se entregó a tiempo. Esta es la etapa dos.', texto: 'Entregamos lo que prometimos' },
        // Sólo si es real. Nunca «14 de 96»: se lee como «quedan 14 en total», y quedan 46.
        { disparador: 'Cuenta regresiva', dice: 'Quedan catorce departamentos con vista al parque.', texto: '14 con vista al parque' },
      ],
    },
    pide: [
      'El precio desde',
      'Los metros y los ambientes',
      'La forma de pago',
      'La fecha de entrega',
      'El avance de obra',
      'Si tiene video o renders oficiales del departamento (sin eso, la plantilla no se ofrece: se propone «Pantalla dividida»)',
      'Si el inventario que queda es real',
    ],
  }),

  // ── 8 · Entrevista en la calle · Voz de Líder ──────────────────────────────
  conEstructura({
    id: 'entrevista-calle',
    nombre: 'Entrevista en la calle',
    cuando: 'Público frío: responde la pregunta que se hace el cliente ideal, y la pregunta aparece en pantalla.',
    negocio: 'Voz de Líder',
    rubro: 'Coach',
    presetId: 'calle-microfono',
    detalle: 'Con chaqueta de mezclilla',
    estructuraId: 'reel-nicho',
    duracion: 26,
    voz: 'latino-hombre-1',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Casi siempre te interrumpen por lo mismo: tardaste en llegar al punto.'],
        ['PROBLEMA', 'Un gerente me dijo: «Sé exactamente qué decir, hasta que me toca el directorio». No son nervios. Nunca preparó los primeros veinte segundos.'],
        ['SOLUCION', 'Abre con la conclusión, no con el contexto: qué decidiste, cuánto cuesta y qué necesitas de ellos. Lo demás va después, si te lo piden.'],
        ['CTA', 'Si presentas ante un directorio, escríbeme JUNTA y te cuento si la cohorte es para ti.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: '¿Qué haces si te interrumpen en una junta?', seVe: 'Del segundo 0 al 3: Rodrigo con el micrófono, en la calle.' },
        { etiqueta: 'PROBLEMA', texto: 'Los primeros 20 segundos', seVe: 'La misma toma.' },
        { etiqueta: 'SOLUCION', texto: 'Conclusión → costo → pedido', seVe: 'La misma toma.' },
        { etiqueta: 'CTA', texto: 'Escríbeme JUNTA', seVe: 'La misma toma. Va sólo si existe la respuesta automática a esa palabra.' },
      ],
      ganchos: [
        { disparador: 'Identidad', dice: 'Si eres gerente y te cortan a mitad de la presentación, esto es para ti.', texto: 'Gerentes: te cortan' },
        { disparador: 'Idea contraria', dice: 'No te falta seguridad. Te sobra contexto.', texto: 'Te sobra contexto' },
        { disparador: 'Prueba', dice: 'Una alumna presentó el presupuesto anual y nadie la interrumpió.', texto: '0 interrupciones' },
      ],
    },
    pide: [
      'La pregunta que más le hacen sus clientes',
      'La respuesta corta de su método',
      'La acción que pide el anuncio',
      'Si tiene la respuesta automática para la palabra clave',
    ],
  }),

  // ── 9 · Carta del fundador (cierre de cohorte) · Voz de Líder ──────────────
  conEstructura({
    id: 'carta-fundador',
    nombre: 'Carta del fundador (cierre de cohorte)',
    cuando: 'Público que ya te conoce, al cierre de inscripciones: la oferta directa, con fecha y cupo reales. Tono sobrio, como un spot.',
    negocio: 'Voz de Líder',
    rubro: 'Coach',
    presetId: 'despacho-noche',
    detalle: 'Con camisa blanca de cuello abierto',
    estructuraId: 'gancho-propuesta-cta',
    duracion: 27,
    voz: 'latino-hombre-1',
    ejemplo: {
      guion: guion(
        ['GANCHO', 'Te voy a decir algo incómodo: tu próximo ascenso depende menos de lo que sabes y más de cómo lo dices frente a un directorio.'],
        ['PROPUESTA', 'La cohorte de mayo son diez semanas en vivo, los martes, con doce personas. Cada semana presentas, te grabamos y te corrijo yo. Carla, de la cohorte pasada, presentó el presupuesto anual y nadie la interrumpió. La inversión es de dos mil dólares.'],
        ['CTA', 'Quedan cuatro lugares y cierro inscripciones el viernes. Si quieres uno, escríbeme JUNTA.'],
      ),
      tramos: [
        { etiqueta: 'GANCHO', texto: '', seVe: 'Rodrigo apoyado en el escritorio; sostiene el silencio.' },
        {
          etiqueta: 'PROPUESTA',
          texto: 'Cohorte de mayo · 90 días · 12 personas · junto a Carla: Resultado individual. No es garantía.',
          seVe: 'La captura autorizada del mensaje de Carla. En el ejemplo, una maqueta.',
        },
        { etiqueta: 'CTA', texto: 'Quedan 4 lugares · cierra el viernes', seVe: 'Rodrigo a cámara. Va sólo si es verdad.' },
      ],
      ganchos: [
        { disparador: 'Urgencia real', dice: 'Cierro inscripciones el viernes y quedan cuatro lugares.', texto: 'Quedan 4' },
        { disparador: 'Aspiración', dice: 'La próxima vez que presentes, que nadie te interrumpa.', texto: 'Sin interrupciones' },
        { disparador: 'Prueba', dice: 'Doce gerentes, diez semanas, una presentación por semana.', texto: '12 · 10 · 1' },
      ],
    },
    pide: [
      'La fecha de inicio, el cupo y la fecha de cierre reales (sin eso, el CTA pasa a «agenda una llamada», sin escasez)',
      'El precio',
      'Un caso con permiso',
      'Si tiene la respuesta automática para la palabra clave',
    ],
  }),

  // ── 10 · Pantalla dividida: renta o mensualidad · Torre Alameda ────────────
  conEstructura({
    id: 'renta-o-mensualidad',
    nombre: 'Pantalla dividida: renta o mensualidad',
    cuando: 'Para la objeción «rentar o comprar», con público que ya conoce el producto: a la izquierda lo que paga hoy, a la derecha la asesora.',
    negocio: 'Torre Alameda',
    rubro: 'Inmobiliaria',
    presetId: 'sala-de-ventas',
    detalle: 'Con camisa clara',
    estructuraId: 'bab',
    duracion: 30,
    voz: 'mexicano-mujer-1',
    ejemplo: {
      guion: guion(
        ['ANTES', 'A la izquierda, tu recibo de renta. A la derecha, el crédito de un departamento en Torre Alameda: desde dieciocho mil novecientos pesos al mes, a veinte años.'],
        ['DESPUES', 'Si hoy pagas una renta parecida, en veinte años uno de los dos es tuyo. Si pagas menos, hagamos la cuenta antes de que decidas.'],
        ['PUENTE', 'Y el enganche no lo juntas de golpe: es del diez por ciento, diferido a dieciocho meses. La entrega es en diciembre de dos mil veintisiete.'],
        ['CTA', 'Escríbeme y te mando la corrida con tu mensualidad exacta.'],
      ),
      tramos: [
        {
          etiqueta: 'ANTES',
          texto: 'Izquierda: Renta: $ ____ al mes · Derecha: Crédito desde $18,900 al mes* · *Estimado a 20 años. Depende del banco.',
          seVe: 'Dos mitades, armadas a mano en el Video Editor. El recibo es un gráfico del Image Editor, sin marca ni persona.',
        },
        { etiqueta: 'DESPUES', texto: 'Si tu renta es parecida, en 20 años uno es tuyo', seVe: 'La asesora a cámara.' },
        { etiqueta: 'PUENTE', texto: 'Enganche 10 % a 18 meses · entrega dic. 2027', seVe: 'La misma toma.' },
        { etiqueta: 'CTA', texto: 'Corrida con tu mensualidad', seVe: 'La misma toma.' },
      ],
      ganchos: [
        // Sólo si la renta de la zona lo confirma: la típica es de MXN 14,000, y «el mismo pago» sería falso para casi todos.
        { disparador: 'Contraste', dice: 'Si tu renta ronda los diecinueve mil, ese mismo pago podría ser de algo tuyo.', texto: 'Renta o crédito' },
        { disparador: 'Objeción', dice: '¿Cuánto pago al mes? Te lo muestro.', texto: 'Crédito desde $18,900 al mes' },
        { disparador: 'Situación', dice: 'Cuando el segundo hijo ya no cabe en la recámara…', texto: 'Necesitas otra recámara' },
      ],
    },
    pide: [
      'La mensualidad del crédito, con su plazo y su tasa de referencia',
      'El enganche y su plazo',
      'La fecha de entrega',
      'La renta típica de la zona (si es mucho menor que la mensualidad, el gancho de contraste no se usa)',
    ],
  }),
]);

/** La plantilla de venta por su id, o `null`. Acepta lo que venga de una URL o de un JSON guardado. */
export function plantillaVentaAvatar(id: unknown): PlantillaVentaAvatar | null {
  if (typeof id !== 'string' || !id) return null;
  return PLANTILLAS_VENTA_AVATAR.find((p) => p.id === id) ?? null;
}

/**
 * El esqueleto vacío de una plantilla: una línea por etiqueta, con su «:», y un renglón en blanco entre secciones
 * («GANCHO:\n\nPROBLEMA:\n\n…»). Es lo que recibe la caja al usar la plantilla. `parsearSecciones` (lib/guion-secciones.ts)
 * le saca el «:» y `soloHablado` lo deja vacío, así que parte en las mismas tarjetas que el ejemplo y no suma palabras.
 */
export function estructuraComoGuion(p: PlantillaVentaAvatar): string {
  return p.estructura.map((etiqueta) => `${etiqueta}:`).join('\n\n');
}

/**
 * Los 5 presets nuevos que piden las plantillas 3, 4, 8, 9 y 10 (docs/plantillas-reales/avatar.md, sección 2). Mismo tipo y
 * mismas reglas que los de ./plantillas.ts: el prompt es la COMPOSICIÓN y nunca la cara, y todos usan `ugc-sin-producto`,
 * la puesta donde el avatar habla siempre (trampa 1). La pizarra y el micrófono van vacíos o sin marca: la IA no escribe
 * texto legible (trampa 19).
 */
export const PRESETS_NUEVOS_VENTA: readonly PlantillaAvatar[] = Object.freeze([
  {
    id: 'pizarra-estudio',
    nombre: 'Pizarra en el estudio',
    categoria: 'Negocio',
    resumen: 'Explicas tu método junto a una pizarra, en un estudio luminoso.',
    lugar: 'En un estudio luminoso, junto a una pizarra en blanco',
    prompt: 'Vertical medium-wide shot of a person standing beside a clean blank whiteboard in a bright studio, holding a marker and pointing at the empty board, high-key softbox lighting, white background, static tripod, 35mm lens, deep focus, clean educational video look',
    puestaId: 'ugc-sin-producto',
    guion: 'Te explico mi método en tres pasos. El segundo es el que casi nadie hace, y es el que más cambia los resultados.',
    voz: 'mexicano-mujer-2',
    nuevo: true,
  },
  {
    id: 'cocina-manana',
    nombre: 'Mañana en la cocina',
    categoria: 'Instagram',
    resumen: 'Hablas a cámara con la taza de la mañana, como en un día cualquiera.',
    lugar: 'En la cocina de casa, temprano',
    prompt: 'Vertical medium close-up of a person leaning on a bright kitchen counter at 7 a.m., holding a steaming mug and talking to a phone propped on the counter, warm low morning sun from a side window, steam backlit, phone on a mini tripod at a slightly low angle, 28mm lens, authentic day-in-the-life creator footage',
    puestaId: 'ugc-sin-producto',
    guion: 'Son las siete de la mañana y, antes de empezar, te cuento lo primero que reviso todos los días en mi negocio.',
    voz: 'mexicano-mujer-2',
    nuevo: true,
  },
  {
    id: 'calle-microfono',
    nombre: 'Entrevista en la calle',
    categoria: 'UGC y TikTok',
    resumen: 'Respondes una pregunta con un micrófono en la mano, en plena calle.',
    lugar: 'En una calle del centro, con un micrófono de mano',
    prompt: 'Vertical medium close-up on a busy downtown sidewalk, person holding a handheld wireless microphone with a plain black foam windscreen, answering an interviewer behind the camera, handheld camera at chest height with slight natural sway, 35mm lens, bright overcast daylight, pedestrians and storefronts softly blurred',
    puestaId: 'ugc-sin-producto',
    guion: 'Me preguntaron qué haría distinto si empezara hoy. Te respondo en treinta segundos.',
    voz: 'latino-hombre-1',
    nuevo: true,
  },
  {
    id: 'despacho-noche',
    nombre: 'Despacho al anochecer',
    categoria: 'Negocio',
    resumen: 'Hablas apoyado en el escritorio, con la ciudad encendida detrás.',
    lugar: 'En una oficina ejecutiva, al anochecer',
    prompt: 'Vertical cinematic medium shot of a person in a dark blazer leaning on the edge of a walnut desk in an executive office at dusk, bookshelves behind and city lights as soft bokeh through the window, Rembrandt key light from the window side, warm desk lamp practical, low-key contrast, subtle teal and amber grade, 50mm lens, shallow depth of field, slow dolly-in',
    puestaId: 'ugc-sin-producto',
    guion: 'Te voy a decir algo que nadie te dice el primer año. Quédate hasta el final, porque ahí está lo importante.',
    voz: 'latino-hombre-1',
    nuevo: true,
  },
  {
    id: 'sala-de-ventas',
    nombre: 'Sala de ventas',
    categoria: 'Negocio',
    resumen: 'Atiendes desde el escritorio de una oficina de ventas luminosa.',
    lugar: 'En el escritorio de una oficina de ventas',
    prompt: 'Vertical medium shot of a person in a camel blazer seated at a tidy desk in a bright real estate sales office, large window with soft daylight, plants and a plain neutral wall behind, static tripod, 50mm lens, natural colors, calm professional look',
    puestaId: 'ugc-sin-producto',
    guion: 'Si estás comparando opciones, te muestro en un minuto qué incluye y cuánto pagarías al mes.',
    voz: 'mexicano-mujer-1',
    nuevo: true,
  },
]);

/** El texto de una sección del guion del ejemplo (su etiqueta va sola en su línea y el texto debajo, hasta la siguiente). */
export function seccionDelGuion(guion: string, etiqueta: string, etiquetas: readonly string[]): string {
  const lineas = guion.replace(/\r/g, '').split('\n');
  const i = lineas.findIndex((l) => l.trim().replace(/:$/, '') === etiqueta);
  if (i < 0) return '';
  const fin = lineas.findIndex((l, j) => j > i && etiquetas.includes(l.trim().replace(/:$/, '')));
  return lineas.slice(i + 1, fin < 0 ? undefined : fin).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * El gancho del ejemplo, para la tarjeta de «Nuevo avatar»: el primer texto en pantalla y lo que dice el avatar en
 * la primera sección. Es copy REAL del ejemplo; la tarjeta antes repetía el nombre de la plantilla como título (11/11/2026).
 */
export function ganchoDeEjemplo(p: PlantillaVentaAvatar): { enPantalla: string; dice: string } {
  return {
    // El primer tramo CON texto: hay ganchos que arrancan sin texto en pantalla («Carta del fundador»).
    enPantalla: p.ejemplo.tramos.find((t) => t.texto.trim())?.texto ?? '',
    dice: p.estructura[0] ? seccionDelGuion(p.ejemplo.guion, p.estructura[0], p.estructura) : '',
  };
}
