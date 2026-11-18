// =============================================================================
// editor-video/plantillas-ejemplos — el ejemplo COMPLETO de cada plantilla de anuncio («Ver ejemplo», DATOS PUROS)
// =============================================================================
// Martín (29/10/2026): «Los templates tienen que ser reales… deben ser ejemplos reales». El plan, con el porqué de cada
// pieza: docs/plantillas-reales/video.md (catálogo en 2.0, un ejemplo por plantilla en 2.1–2.11, la tanda 1 en la
// sección 5) y la regla común en docs/plantillas-reales/README.md.
//
// LOS NEGOCIOS SON FICTICIOS (el elenco del README, 2.2): Cierre Consultivo (Andrea Salcedo), Consulta Rentable
// (Dra. Mariana Ochoa, con su alumna Lucía Garza), Torre Alameda (sin desarrolladora con nombre) y Voz de Líder
// (Rodrigo Ibarra). Ninguno nombra a alguien de la lista REALES (tests/_reales.ts), y los datos son los mismos que usa
// Copywriter para que la persona reconozca el negocio.
//
// QUÉ HACE ESTE MÓDULO:
//   · `EJEMPLOS_VIDEO`: por id de plantilla EXISTENTE, el negocio, cuándo usarla, un texto por hueco de texto (con su
//     tope y sus mayúsculas), el guion para grabar con segundos, las tomas de apoyo y el texto del anuncio.
//   · `plantillaConEjemplo`: una COPIA de la plantilla con la `muestra` de cada pieza cambiada por el texto de su hueco,
//     para que MiniaturaPlantilla dibuje el ejemplo. Un hueco con varias piezas (los rótulos de «Antes y después») las
//     cambia todas; la decoración sin hueco (la cuenta regresiva) queda como está. Ningún tiempo se toca.
//   · `insigniaDeVideo`: «Sugerida · 15 s · 1 clip» (la insignia de la tarjeta de CapCut, doc 1 y 5).
//
// QUÉ PLANTILLA DEL DOC VA EN CADA ID DE HOY:
//   gancho        → 2.1 «Anuncio con gancho» (Cierre Consultivo)
//   testimonio    → 2.4 «Testimonio de cliente» (Consulta Rentable)
//   antes-despues → 2.11 «Antes y después» (Torre Alameda)
//   beneficios    → 2.3 «Lo que te llevas» (Voz de Líder)
//   oferta        → 2.9 «Invitación a clase en vivo» (Consulta Rentable)
//   y desde el 18/11/2026 (F164) las seis nuevas, cada una con su id del doc: respuesta-comentario (2.2), caso-numeros
//   (2.5), historia (2.6), tres-errores (2.7), clip-podcast (2.8) y tour-propiedad (2.10). Sus textos SON las muestras de
//   su plantilla (el doc no trae otras), así que su miniatura no cambia con el ejemplo.
//   gancho-escrito y oferta-glitch: el doc las RETIRA (2.0, «prefiero deprecar antes que conservar»): se sacaron del
//   catálogo el 18/11/2026.
//
// LO QUE DEL DOC NO ENTRA EN LOS HUECOS DE HOY (va al chat de Video cuando cambie el catálogo):
//   · gancho: el doc dura 24 s (clip 0–21) y suma la toma de apoyo `broll` (6–9.5), el `dato` «2/10 → 4/10 CIERRES» y el
//     `aviso` «Mediana de 52 alumnas» (14–19). Hoy hay gancho, titulo-final y cta: el guion se condensó a 0–12 s y la
//     aclaración de la mediana sobrevive sólo en el texto del anuncio.
//   · testimonio: el doc dura 33 s (clip 0–30) y suma `broll` (10–14), el `dato` «21 PACIENTES AL MES» y el `aviso`
//     «Resultado de un caso» (18–25). El guion se condensó a 0–12 s y se cayó el bloque 25–30 («Si eres nutrióloga y
//     vives de consultas sueltas, este programa es para ti.»). ⚠️ Sin el aviso, el ejemplo no dice que es un caso: el
//     chat de Video lo tiene que devolver con el hueco.
//   · beneficios: el `detalle` «12 lugares por cohorte» (texto-2, 12.8–15) es un hueco nuevo: no está.
//     ⚠️ «Práctica en vivo semanal» tiene 24 caracteres, el tope justo: la caja estimada entra en un renglón con 1,2 px de
//     margen (cajaDeTexto: 841,2 de 842,4); medido con la fuente de verdad puede partirse y pisar al beneficio 3. Y
//     «Simulacro con directorio» ya se estima en dos renglones (880–1050): entra porque abajo no hay nada a la vez.
//   · oferta: el doc dura 16 s (clip 0–13) y es otra plantilla con el mismo id. Su `fecha` va en el hueco `oferta` de hoy
//     (22 caracteres: «JUEVES 12 DE NOVIEMBRE» los ocupa todos); el `horario` «19:00 México · 20:00 Bogotá» no tiene
//     hueco; el título del cierre «Llena tu consulta online» tampoco (la oferta de hoy no tiene titulo-final); el botón
//     va en MAYÚSCULAS porque la pieza de hoy las dibuja (en el doc es el de `cierre()`, sin ellas); y la cuenta
//     regresiva 3-2-1 que el doc saca sigue dibujándose (es decoración, sin hueco). El guion se condensó a 0–9 s.
//   · antes-despues: entra entero (el doc sólo cambia los textos). Sin voz: el guion va vacío y lo cuenta el anuncio.
//   · En todas: los créditos de las muestras de Pexels (doc 2.0 y 7: ninguna está elegida todavía), y la captura propia
//     de `caso-numeros`.
//
// ⚠️ Español neutro con «tú» (tests/puente-panel-copy.test.ts barre lib/); los números como en el doc (USD 1,500,
// MXN 2.4 M). Lo fija tests/video-plantillas-ejemplos.test.ts.
//
// Puro: SIN `server-only`, y de ./plantillas sólo TIPOS (el catálogo puede importar este módulo sin un ciclo de valores).
// =============================================================================

import type { Pieza, Plantilla } from './plantillas';

/** Los objetivos del doc (2.0), en el orden en que se muestran: son la sección (`grupo`) de la tarjeta en Create. */
export const OBJETIVOS_VIDEO = ['Vender una llamada', 'Prueba social', 'Educar', 'Evento', 'Propiedad'] as const;
export type ObjetivoVideo = (typeof OBJETIVOS_VIDEO)[number];

export type EjemploVideo = {
  /** El negocio FICTICIO del ejemplo («Cierre Consultivo»): la cinta «Ejemplo» de la tarjeta. */
  negocio: string;
  /** Una línea sobre ese negocio: quién es y qué vende (lo lee «Ver ejemplo» y, después, el Editor de MaKo). */
  sobre: string;
  objetivo: ObjetivoVideo;
  /** «Cuándo usarla», en una línea. */
  cuando: string;
  /** Por NOMBRE de hueco de texto (huecosDe): exactamente los de la plantilla, cada uno en su tope y con sus mayúsculas. */
  textos: Readonly<Record<string, string>>;
  /** El guion para grabar, con los segundos de cada parte («0–3 s»). Vacío = sin voz: lo cuenta el texto del anuncio. */
  guion: ReadonlyArray<{ segundos: string; dice: string }>;
  /**
   * El segundo en que empieza la voz, si antes hay tomas SIN voz (el tour de propiedad: los espacios van sin hablar y el
   * asesor habla desde el 15; doc 2.10). Sin el campo, la voz arranca en 0. Las tomas de antes se cuentan en `tomas`.
   */
  vozDesde?: number;
  /** Las tomas de apoyo que se graban (nunca la cara de una persona de stock: doc 2.0). */
  tomas: readonly string[];
  /** El texto del anuncio, si el doc lo trae. */
  anuncio?: string;
};

/** El ejemplo de cada plantilla de HOY, por su id (lib/editor-video/plantillas.ts). Las retiradas no tienen. */
export const EJEMPLOS_VIDEO: Readonly<Partial<Record<string, EjemploVideo>>> = {
  // ── 2.1 Anuncio con gancho · Cierre Consultivo ─────────────────────────────
  gancho: {
    negocio: 'Cierre Consultivo',
    sobre: 'Andrea Salcedo, coach de ventas para coaches en CDMX. Vende un programa de 90 días de USD 1,500.',
    objetivo: 'Vender una llamada',
    cuando: 'Anuncio pagado o reel que vende una llamada a público frío: frena el scroll en 3 s, prueba con un dato y cierra pidiendo un mensaje.',
    textos: {
      gancho: '¿CIERRAS MENOS DEL 20 %?',
      'titulo-final': '¿Vendes programas de +USD 1,000?',
      cta: 'Escribe LLAMADA',
    },
    guion: [
      { segundos: '0–3 s', dice: '«Si cierras menos del 20 % de tus llamadas de venta, bajar el precio no lo va a arreglar.»' },
      { segundos: '3–6.5 s', dice: '«Las llamadas que cierran empiezan con preguntas sobre lo que le cuesta al cliente seguir igual.»' },
      { segundos: '6.5–9.5 s', dice: '«Con ese cambio, la mitad de mis alumnas ya cierra 4 de cada 10 llamadas o más.»' },
      { segundos: '9.5–12 s', dice: '«Si vendes programas de más de mil dólares, escríbeme LLAMADA.»' },
    ],
    tomas: ['Una agenda de llamadas en la pantalla de una laptop', 'Manos tomando notas junto a una videollamada'],
    anuncio:
      'Te mando gratis el guion de los primeros cinco minutos de mi llamada de venta. Escríbeme LLAMADA por mensaje directo. El dato del video es la mediana de 52 alumnas en 4 cohortes; no es una promesa.',
  },

  // ── 2.4 Testimonio de cliente · Consulta Rentable ──────────────────────────
  testimonio: {
    negocio: 'Consulta Rentable',
    sobre: 'La Dra. Mariana Ochoa enseña a nutriólogas a llenar su consulta: programa de 90 días de USD 1,200. Habla su alumna Lucía Garza, nutrióloga en Monterrey.',
    objetivo: 'Prueba social',
    cuando: 'Prueba social para anuncios y orgánico: un cliente real cuenta su resultado y abre con el resultado, no con el saludo.',
    textos: {
      cita: '“De 6 a 21 pacientes”',
      nombre: 'Lucía Garza',
      detalle: 'Nutrióloga · Monterrey',
      'titulo-final': 'Únete al próximo grupo',
      cta: 'Agenda tu llamada',
    },
    // Sólo las respuestas: las preguntas de quien entrevista se cortan. Sin lo que cobra ni lo que gana (va en anuncios).
    guion: [
      { segundos: '0–3.5 s', dice: '«Pasé de 6 a 21 pacientes al mes, y no fue por publicar más recetas.»' },
      { segundos: '3.5–6.5 s', dice: '«Atendía por consulta suelta: semanas llenas y semanas vacías.»' },
      { segundos: '6.5–10 s', dice: '«Con la Dra. Ochoa armé un plan de tres meses y aprendí a explicarlo en la primera consulta.»' },
      { segundos: '10–12 s', dice: '«En la semana 9 ya atendía 21 pacientes al mes.»' },
    ],
    tomas: [
      'Las manos de la nutrióloga armando un plan de alimentación',
      'El consultorio con luz de ventana: escritorio, báscula y plato',
    ],
  },

  // ── 2.11 Antes y después · Torre Alameda ───────────────────────────────────
  'antes-despues': {
    negocio: 'Torre Alameda',
    sobre: 'Preventa de departamentos en Querétaro: 2 recámaras desde MXN 2.4 M. La etapa 2 va al 60 % de avance.',
    objetivo: 'Propiedad',
    cuando: 'Mostrar un cambio con el mismo encuadre: el avance de una obra, una remodelación o un espacio preparado para vender.',
    textos: {
      'rotulo-antes': '2025',
      'rotulo-despues': 'HOY · 60 %',
      'titulo-final': 'Preventa desde MXN 2.4 M',
      cta: 'Escribe PRECIOS',
    },
    guion: [],
    tomas: ['El terreno en 2025, a pantalla completa', 'La torre en obra hoy, desde el mismo ángulo'],
    anuncio:
      'Así estaba el terreno en 2025. Así va la etapa 2 hoy: 60 % de avance. La etapa 1 se entregó en noviembre de 2025, en la fecha del contrato. Departamentos de 2 recámaras desde MXN 2.4 millones. Escríbenos PRECIOS.',
  },

  // ── 2.3 Lo que te llevas · Voz de Líder ────────────────────────────────────
  beneficios: {
    negocio: 'Voz de Líder',
    sobre: 'Rodrigo Ibarra enseña oratoria a gerentes en Lima: programa de 90 días en cohortes de 12, USD 2,000.',
    objetivo: 'Vender una llamada',
    cuando: 'Retargeting a quien ya vio tu contenido: tres entregables concretos, uno tras otro, y agendar.',
    textos: {
      titulo: 'LO QUE TE LLEVAS',
      'beneficio-1': 'Apertura ensayada',
      'beneficio-2': 'Práctica en vivo semanal',
      'beneficio-3': 'Simulacro con directorio',
      cta: 'Agenda tu llamada',
    },
    guion: [
      {
        segundos: '0–12 s',
        dice: '«Si te toca presentar resultados, en 90 días te llevas tres cosas: una apertura ensayada, práctica en vivo cada martes y un simulacro frente a un directorio. Agenda tu llamada.»',
      },
    ],
    tomas: ['La sala de juntas vacía, con la pantalla encendida'],
  },

  // ── 2.9 Invitación a clase en vivo · Consulta Rentable ─────────────────────
  oferta: {
    negocio: 'Consulta Rentable',
    sobre: 'La Dra. Mariana Ochoa enseña a nutriólogas a llenar su consulta online. Invita a su clase gratis en vivo por Zoom.',
    objetivo: 'Evento',
    cuando: 'Llenar el registro de una clase gratis en vivo, la puerta de entrada a un programa de alto valor: fecha clara y un solo llamado.',
    textos: {
      gancho: 'CLASE GRATIS EN VIVO',
      oferta: 'JUEVES 12 DE NOVIEMBRE',
      cta: 'REGÍSTRATE GRATIS',
      detalle: 'Sin costo · por Zoom',
    },
    guion: [
      { segundos: '0–3 s', dice: '«Si eres nutrióloga y tu consulta no se llena, esta clase es para ti.»' },
      { segundos: '3–7 s', dice: '«El jueves 12 de noviembre te enseño en vivo cómo llenar tu consulta online sin publicar todos los días.»' },
      { segundos: '7–9 s', dice: '«Es gratis y por Zoom. Regístrate en el link.»' },
    ],
    tomas: ['Una laptop abierta en una videollamada, con la galería borrosa'],
  },

  // ── Las seis del 18/11/2026 (F164): el ejemplo es el del doc, y los textos son las muestras de su plantilla ──────

  // ── 2.2 Respuesta a un comentario · Cierre Consultivo ──────────────────────
  'respuesta-comentario': {
    negocio: 'Cierre Consultivo',
    sobre: 'Andrea Salcedo, coach de ventas para coaches en CDMX. Vende un programa de 90 días de USD 1,500.',
    objetivo: 'Vender una llamada',
    cuando: 'Contenido de cierre para quien ya está considerando comprar: responde una objeción de precio o de confianza con el formato de respuesta a un comentario.',
    // ⚠️ El comentario tiene que ser real; si no hay uno, el rótulo dice «Pregunta frecuente» (nunca un @ inventado).
    textos: {
      usuario: 'Pregunta frecuente',
      comentario: '¿Pagar si YouTube es gratis?',
      'frase-clave': 'LA CORRECCIÓN NO ES GRATIS',
      'titulo-final': '3 llamadas revisadas: USD 150',
      cta: 'Escribe LLAMADA',
    },
    guion: [
      { segundos: '0–4 s', dice: '«Me preguntan seguido por qué cobro 1,500 dólares si en YouTube está casi todo gratis.»' },
      { segundos: '4–10 s', dice: '«Es cierto: la información está. Lo que no está es alguien que escuche tu llamada de venta y te diga en qué minuto la perdiste.»' },
      { segundos: '10–16 s', dice: '«Ver un video es gratis. Que alguien corrija tu llamada, no. Mis alumnas me pagan para lograrlo en 90 días y no en tres años.»' },
      { segundos: '16–21 s', dice: '«Si quieres probar, reviso tres de tus llamadas por 150 dólares, y se descuentan si después entras.»' },
      { segundos: '21–25 s', dice: '«Escríbeme LLAMADA.»' },
    ],
    tomas: ['Un escritorio con un micrófono y una laptop, sin nadie'],
  },

  // ── 2.5 Caso con números · Pulso Dental ────────────────────────────────────
  'caso-numeros': {
    negocio: 'Pulso Dental',
    sobre: 'Diego Ferrer, agencia para clínicas dentales en Bogotá: USD 1,200 al mes con contrato de 3 meses. El caso es su cliente, la Clínica Dental Altamira de Medellín.',
    objetivo: 'Prueba social',
    cuando: 'Agencias y servicios con un resultado medible: quien habla cuenta el caso y, encima, la captura del panel con los números.',
    textos: {
      gancho: 'DE 6 A 23 VALORACIONES',
      'dato-1': 'VALORACIONES: 6 → 23',
      'dato-2': '9 TRATAMIENTOS CERRADOS',
      'dato-3': 'MISMA INVERSIÓN EN ANUNCIOS',
      'titulo-final': '¿Tu clínica quiere lo mismo?',
      cta: 'Escribe CITAS',
    },
    guion: [
      { segundos: '0–4 s', dice: '«Así pasó una clínica dental de Medellín de 6 a 23 valoraciones de implantes al mes.»' },
      { segundos: '4–9 s', dice: '«Sus anuncios traían mensajes de "¿precio?", pero nadie los contestaba a tiempo y casi ninguno volvía.»' },
      { segundos: '9–15 s', dice: '«Cambiamos tres cosas: un anuncio por tratamiento, respuesta en menos de cinco minutos y el rango de precio dicho antes de agendar.»' },
      { segundos: '15–19 s', dice: '«Al tercer mes, con la misma inversión, cerraron 9 tratamientos.»' },
      { segundos: '19–22 s', dice: '«Si tienes una clínica dental, escríbeme CITAS y reviso tus anuncios.»' },
    ],
    // ⚠️ Sólo con el permiso del cliente, y con los nombres de los pacientes tapados antes de subir la captura (doc 2.5).
    tomas: ['El escritorio de una agencia con dos monitores, sin personas', 'La captura del panel con los números del caso: 6, 23 y 9'],
    anuncio:
      'Así pasó la Clínica Dental Altamira de 6 a 23 valoraciones de implantes al mes. Resultados de una clínica en particular, mostrados con su permiso. Escríbenos CITAS y revisamos tus anuncios sin costo.',
  },

  // ── 2.6 Historia del fundador · Pulso Dental ───────────────────────────────
  historia: {
    negocio: 'Pulso Dental',
    sobre: 'Diego Ferrer, agencia para clínicas dentales en Bogotá. En 2021 manejaba seis clínicas y perdió cuatro en un semestre.',
    objetivo: 'Prueba social',
    cuando: 'Orgánico de conexión: antes, quiebre y hoy, y cierra pidiendo un mensaje. Habla de clientes atendidos, nunca de la facturación propia.',
    textos: {
      gancho: 'PERDÍ 4 DE 6 CLÍNICAS',
      'etiqueta-antes': 'ANTES · 2021',
      quiebre: '14 mensajes, 5 respuestas',
      'etiqueta-cambio': 'EL CAMBIO',
      'etiqueta-hoy': 'DESDE 2022',
      numero: '31 CLÍNICAS ATENDIDAS',
      'titulo-final': '¿Tu clínica pierde mensajes?',
      cta: 'Escribe AUDITORIA',
    },
    guion: [
      { segundos: '0–3 s', dice: '«En 2021 manejaba los anuncios de seis clínicas y perdí cuatro en un semestre.»' },
      { segundos: '3–9 s', dice: '«Los anuncios traían mensajes baratos, y yo creía que con eso alcanzaba. Las clínicas no veían pacientes.»' },
      { segundos: '9–13 s', dice: '«Una tarde, en la recepción de una clínica, vi entrar 14 mensajes. Se contestaron 5.»' },
      { segundos: '13–20 s', dice: '«Ahí entendí que yo vendía mensajes y la clínica necesitaba pacientes. Sumamos lo que pasa después del anuncio: respuesta a cada paciente en menos de cinco minutos, con un guion.»' },
      { segundos: '20–27 s', dice: '«Desde 2022 atendimos a 31 clínicas de Colombia y México. Si tu clínica recibe mensajes y no pacientes, escríbeme AUDITORIA y reviso tus mensajes.»' },
    ],
    // El 31 es el total desde 2022, no las clínicas activas (doc 2.6).
    tomas: ['La recepción de una clínica vacía', 'Un escritorio desordenado de noche, con una laptop'],
  },

  // ── 2.7 Reel de 3 errores · Voz de Líder ───────────────────────────────────
  'tres-errores': {
    negocio: 'Voz de Líder',
    sobre: 'Rodrigo Ibarra enseña oratoria a gerentes en Lima: programa de 90 días en cohortes de 12, USD 2,000.',
    objetivo: 'Educar',
    cuando: 'Contenido orgánico de autoridad: enseña algo concreto, junta comentarios y termina en un mensaje directo.',
    textos: {
      gancho: '3 ERRORES ANTE EL DIRECTORIO',
      'titulo-1': 'ERROR 1 · INICIO IMPROVISADO',
      'titulo-2': 'ERROR 2 · LEER DIAPOSITIVAS',
      'titulo-3': 'ERROR 3 · DEMASIADOS DATOS',
      pregunta: 'Comenta 1, 2 o 3',
      cta: 'Escribe JUNTA',
    },
    guion: [
      { segundos: '0–3 s', dice: '«Tres errores que hacen que el directorio deje de escucharte en el primer minuto.»' },
      { segundos: '3–11 s', dice: '«Error uno: improvisas el inicio. Los primeros 20 segundos se escriben y se ensayan en voz alta, como un discurso corto.»' },
      { segundos: '11–20 s', dice: '«Error dos: lees las diapositivas. Si la frase ya está en la pantalla, no la repitas; di lo que la pantalla no dice.»' },
      { segundos: '20–29 s', dice: '«Error tres: respondes una pregunta difícil con más datos. Primero contesta sí o no, y después da un solo número.»' },
      { segundos: '29–35 s', dice: '«¿Cuál te pasa más? Comenta 1, 2 o 3.»' },
      { segundos: '35–38 s', dice: '«Y si te toca presentar este mes, escríbeme JUNTA.»' },
    ],
    tomas: ['Una pantalla de presentación en una sala vacía', 'Una mesa de directorio vacía'],
  },

  // ── 2.8 Clip de podcast o clase · Cierre Consultivo ────────────────────────
  'clip-podcast': {
    negocio: 'Cierre Consultivo',
    sobre: 'El podcast «Ventas sin presión» de Andrea Salcedo, coach de ventas para coaches en CDMX: el fragmento del episodio 27.',
    objetivo: 'Educar',
    cuando: 'Sacar un clip vertical de un video largo (podcast, clase en vivo o webinar), que arranca en la frase más fuerte y no en la pregunta de quien entrevista.',
    textos: {
      gancho: 'TU PRECIO NO ES CARO',
      encabezado: 'Podcast Ventas sin presión',
      cta: 'Episodio completo en el perfil',
    },
    guion: [
      {
        segundos: '0–40 s',
        dice: '«Tu precio no es caro. Es caro para el cliente equivocado. Cuando alguien te dice "está caro", te está diciendo que no ve el problema tan grande como lo ves tú. Entonces no bajes el precio: vuelve al problema. Pregúntale cuánto le cuesta cada mes seguir así, y deja que haga la cuenta en voz alta. Casi siempre, la objeción se cae sola.»',
      },
    ],
    tomas: ['Un micrófono y audífonos en una mesa, sin nadie'],
  },

  // ── 2.10 Tour de propiedad · Torre Alameda ─────────────────────────────────
  'tour-propiedad': {
    negocio: 'Torre Alameda',
    sobre: 'Preventa de departamentos en Querétaro: 2 recámaras desde MXN 2.4 M. Presenta Karen, asesora de la sala de ventas.',
    objetivo: 'Propiedad',
    cuando: 'Presentar una propiedad o un departamento muestra: un espacio por toma, los datos en etiquetas y una visita como llamado.',
    // ⚠️ Cada etiqueta es un dato de la ficha de la propiedad: si la persona no lo dio, se pregunta; nunca se ponen los
    //    metros, el precio ni las amenidades de este ejemplo (doc 2.10).
    textos: {
      gancho: 'DEPTO CON VISTA AL PARQUE',
      precio: 'DESDE MXN 2.4 M',
      'chip-1': '78 m² frente al parque',
      'chip-2': 'Cocina integral con barra',
      'chip-3': '2 recámaras · 2 baños',
      'chip-4': 'Roof garden y alberca',
      nombre: 'Karen Méndez',
      detalle: 'Asesora · Torre Alameda',
      cta: 'Escribe VISITA',
    },
    vozDesde: 15,
    guion: [
      { segundos: '15–24 s', dice: '«Soy Karen, de Torre Alameda. Este sábado abrimos el departamento muestra. Escríbeme VISITA y te paso los horarios y la lista de precios.»' },
    ],
    // Las cinco primeras van SIN voz, con movimiento (hacia adelante o un paneo lento).
    tomas: [
      'La obra vista desde la calle',
      'La sala del departamento muestra, con el parque por la ventana',
      'La cocina',
      'La recámara principal',
      'El roof garden con la alberca',
    ],
    anuncio:
      'Departamentos de 2 recámaras en preventa en Querétaro, frente a un parque y a 8 minutos de Constituyentes. Desde MXN 2.4 millones, con enganche del 10 % diferido a 18 meses. Escríbenos VISITA para conocer el departamento muestra este sábado.',
  },
};

/** El ejemplo de una plantilla, o null (las retiradas, un id que no existe y lo que no es propio del objeto). */
export function ejemploDeVideo(id: string): EjemploVideo | null {
  return Object.prototype.hasOwnProperty.call(EJEMPLOS_VIDEO, id) ? (EJEMPLOS_VIDEO[id] ?? null) : null;
}

/**
 * Una COPIA de la plantilla con la `muestra` de cada pieza de texto cambiada por el texto de su hueco en el ejemplo (como
 * el `enMinuscula` de tests/video-editor-plantillas-uso.test.ts). Sólo cambia `muestra`: tiempos, estilos, anclas y la
 * decoración sin hueco quedan como están, y la plantilla del catálogo no se toca. Sin ejemplo, la copia es igual.
 */
export function plantillaConEjemplo<P extends Plantilla>(p: P, ejemplo: EjemploVideo | null = ejemploDeVideo(p.id)): P {
  const textos = ejemplo?.textos ?? {};
  const piezas = p.piezas.map((x): Pieza => {
    if (x.tipo !== 'texto' || !x.hueco || !Object.prototype.hasOwnProperty.call(textos, x.hueco.nombre)) return x;
    return { ...x, muestra: textos[x.hueco.nombre] };
  });
  return { ...p, piezas };
}

/**
 * La insignia de la tarjeta (doc 1 y 5): «Sugerida · » si corresponde, la duración y los clips que hay que poner (los de
 * relleno opcional, como el fondo del cierre, no cuentan). `sugerida` acepta el `porque` de plantillasEnOrden.
 */
export function insigniaDeVideo(p: Plantilla, sugerida?: boolean | string | null): string {
  const clips = new Set(p.piezas.flatMap((x) => (x.tipo === 'clip' && !x.hueco.opcional ? [x.hueco.nombre] : []))).size;
  return `${sugerida ? 'Sugerida · ' : ''}${p.duracion} s · ${clips} ${clips === 1 ? 'clip' : 'clips'}`;
}
