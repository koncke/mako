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
// QUÉ HACE ESTE MÓDULO (el catálogo NO cambia todavía: lib/editor-video/plantillas.ts lo lleva otro chat):
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
//   gancho-escrito y oferta-glitch: el doc las RETIRA (2.0, «prefiero deprecar antes que conservar»): sin ejemplo.
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
//   · En las cinco: los créditos de las muestras de Pexels (doc 2.0 y 7: ninguna está elegida todavía).
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
