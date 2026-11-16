// =============================================================================
// Lo que dice /accelerator, como datos (15/11/2026)
// =============================================================================
// El texto es el de la landing de Martín en Lovable (https://panda-stream-spark.lovable.app/, la de su servicio
// personalizado), pasado a «tú» y corregido con lo que el programa es HOY. Martín, 15/11/2026: «revisa esa nueva landing,
// los copies que tiene, porque hay cosas que cambiar. Por ejemplo, el testimonio de Mauricio, que hoy en día ya vamos más
// de $100.000 facturados… hay varias partes donde menciona el acompañamiento 1 a 1 conmigo, y eso ya no es así».
//
// ⚠️ LO QUE NO VIVE ACÁ, A PROPÓSITO: el nombre del programa (`PROGRAMA_ACELERADOR.nombre`), lo que incluye
//    (`LISTA_DEL_ACELERADOR`: los nombres de la columna de /planes, con el detalle de su «i» en la tabla) y el precio con cuánto dura
//    (`PROGRAMA_ACELERADOR`, el de la columna del Accelerator de /planes): se importan de lib/planes-mako.ts. Si
//    Martín cambia la oferta, cambia en los dos lugares a la vez. El 15/11 a la noche, sin ir más lejos, cambió cuatro veces en
//    dos horas: la lista pasó de 7 renglones a 10, después a nombres cortos y después a nombres con detalle; el nombre pasó a
//    inglés y la promesa perdió la garantía. Tampoco viven acá el formulario de aplicación ni adónde lleva cada «Aplica ahora»
//    (`RUTA_APLICAR`, lib/aplicacion-accelerator.ts: las preguntas, quién califica y la agenda).
// ⚠️ NINGUNA GARANTÍA EN ESTA PÁGINA. Martín, 15/11 ~21:30: «la parte de garantía por contrato directamente la quitaría de
//    todos lados. Incluso de la descripción de nuestra promesa»; y de la columna, «con garantía de entrega… eso elimínalo».
//    La de entrega sigue en /reembolsos §2, que el pie enlaza: ahí se lee lo que es contrato. Esta página tuvo un sello
//    «Garantía por contrato» escrito a mano al lado de la promesa importada, y cuando la fuente sacó la garantía el sello la
//    siguió afirmando: lo escrito a mano al lado de algo importado lo ata un test (tests/acelerador-landing.test.ts).
//
// LO QUE SE SACÓ DE LA DE LOVABLE (y por qué, para que no vuelva): los tres testimonios de texto firmados «Nombre Apellido»
// (eran relleno: un testimonio inventado no se publica) y las dos cajas «Video · Consultor B2B» y «Video · Coach de negocios»
// (lugares vacíos, sin video). Con eso la sección «Lo que dicen los que ya trabajaron conmigo» quedó sin nada que mostrar y
// se fue entera; su única frase real (la de la agencia de Axel) pasó al final de los casos. Cuando haya testimonios de
// verdad, vuelve. También: «una sesión 1:1 por semana», «No es una mentoría grupal» y el «1 a 1» del acompañamiento: hoy
// son 3 sesiones 1 a 1 de 2 horas y la asesoría de cada semana es grupal.
// El detalle de cada cambio (antes → después y por qué) está en el comentario de cada bloque.
// =============================================================================

/** Un texto con partes en negrita: `**así**`. Lo parte `negritas()` (./LandingAcelerador.tsx). */
export type Rico = string;

/**
 * El VSL: el mismo video de la de Lovable, en Panda (allá se llama «Mentoría 1a1 con Martín Koncke»). Lo dio Martín con la
 * landing: «una landing que yo ya tenía tanto con mi VSL…».
 * ✓ CONFIRMADO POR MARTÍN (16/11/2026, dictado): «pone el BCL [el VSL] que ya estaba ahí»; y el «Pulse aquí» con el que
 *   arranca el player de Panda (el cartel para activar el sonido), «eso está bien». Antes este comentario avisaba que nadie lo
 *   había escuchado y que, si decía «una sesión por semana» o los $50.000 de Mauricio, hacía falta otro video: el video queda;
 *   si Martín graba otro, se cambia este id y nada más.
 *   Lo que se miró (15/11/2026): su config pública, la que lee el player (config.tv.pandavideo.com.br/vz-dd4ad08b-375/<id>.json),
 *   trae sólo el `profile`, sin `videoRedirect`: al terminar no salta a otro video (docs/hallazgos-landing.md, «El video que
 *   sigue al video»).
 */
export const VSL_ACELERADOR = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=d0b3e8db-29b7-4e73-a350-b9ce7bd9f81f';

/**
 * El id de la sección del final (el título, los cuatro pasos y el botón grande). Hasta el 15/11 los «Aplica ahora» bajaban acá,
 * donde estaba la agenda; desde el 16/11 TODOS van al formulario (`RUTA_APLICAR`) y ninguno baja: el id queda como nombre de la
 * sección (la barra de abajo del teléfono termina justo antes, ./estilo.ts).
 */
export const ANCLA_APLICAR = 'aplicar';
/**
 * Lovable: «APLICÁ AHORA». Lo dicen la barra, el héroe, la barra de abajo del teléfono y la sección del final (las cuatro van al
 * formulario, `RUTA_APLICAR`); el botón de la tarjeta del precio lo dice en mayúsculas, como «MÁS INFORMACIÓN» en /planes.
 */
export const TEXTO_APLICAR = 'Aplica ahora';

export const HERO = {
  ceja: 'Programa por aplicación · Cupos limitados',
  /** El título, con la palabra que va en cursiva naranja en el medio. Lovable: «Construí un sistema…». */
  titulo: ['Construye un sistema de adquisición de clientes ', 'predecible', '.'] as const,
  // SIN BAJADA (16/11/2026, Martín: «eliminaría también la frase de con el acompañamiento más personalizado del mercado de la landing
  // de Accelerator»). Era «Con el acompañamiento más personalizado del mercado.» (Lovable: «…1 a 1 más personalizado…»); se fue
  // también de la descripción de la página (./page.tsx). Debajo del título va directo a quién es el programa.
  calificacion: ['Exclusivo para profesionales, coaches y negocios que ya generan ', '+$5.000 USD/mes', '.'] as const,
};

export const APLICAR = {
  titulo: 'Para trabajar conmigo tienes que pasar por un proceso de aplicación.',
  bajada: 'Trabajo con muy pocos clientes. Para meterme de verdad en tu negocio y ayudarte a implementar cambios reales, necesito tener espacio.',
  /**
   * Los cuatro pasos, con sus palabras. La llamada del paso 3 sí es 1 a 1: es la llamada de venta, no el acompañamiento.
   * «Aplicas en el formulario» ES un formulario desde el 16/11/2026: el de /accelerator/aplicar (`RUTA_APLICAR`, sus preguntas
   * en lib/aplicacion-accelerator.ts, el molde del de Mastery Haus que mandó Martín), adonde lleva cada «Aplica ahora». Hasta
   * el 15/11 el «formulario» era la agenda de Calendly del botón final, que pedía siete respuestas antes de confirmar; ahora
   * esa agenda se abre DESPUÉS de aplicar, ya contestada, a quien califica. El paso 2 («Analizo personalmente tu caso») es
   * lo que le pasa a cada aplicación: la lee Martín, califique o no.
   */
  pasos: ['Aplicas en el formulario', 'Analizo personalmente tu caso', 'Tenemos una llamada 1 a 1', 'Si hay match, avanzamos'] as const,
};

export const MAURICIO = {
  /** El título: los $100.000 en naranja (Martín, 16/11/2026: «lo de $100.000 es como más impactante… debería ser lo más importante»).
   *  El «de $300 a más de $7.000 por cliente», que era el título, pasa al texto. */
  titulo: ['Con Mauricio llevamos más de ', '$100.000 dólares', ' facturados.'] as const,
  video: '/vsl-assets/mauricio.mp4',
  // MÁS CORTO (Martín: «está muy largo desde el título hasta no existe ningún método estándar»): eran tres párrafos, la frase de
  // los $100k y dos más del escenario; quedan dos y uno, con los mismos hechos.
  intro: [
    'Mauricio no era ningún novato: más de 20 años de trayectoria y videos con millones de visitas. Pero la viralidad le traía los clientes equivocados, que **solo le pagaban $300 dólares.**',
    'No empezamos por el marketing: primero entendimos qué negocio quería tener y construimos su oferta desde cero. Hoy **cobra más de $7.000 por cliente.**',
  ] as readonly Rico[],
  importa: 'Y hay algo que me importa más que el número.',
  escenario: [
    'Quería ser referente de su industria. Viajé de Argentina a Cancún para hacer un evento con él: fue speaker frente a más de 100 personas de su sector.',
  ] as readonly Rico[],
  /** Las tres fotos del carrusel, en el orden de Lovable. Son las mismas que usa el resto del sitio (public/vsl-assets). */
  fotos: [
    { src: '/vsl-assets/caso-equipo.jpg', alt: 'Mauricio con el equipo en Cancún', ancho: 959, alto: 1280 },
    { src: '/vsl-assets/caso-stage.png', alt: 'Mauricio en el escenario', ancho: 885, alto: 1393 },
    { src: '/vsl-assets/caso-martin.jpg', alt: 'Mauricio con Martín', ancho: 960, alto: 1280 },
  ] as const,
  remate: 'No existe ningún método estándar que hubiera resuelto el caso de Mauricio.',
  otros: [
    'Una agencia de marketing le hubiera dicho que siguiera optimizando sus reels para ser más viral.',
    'Un mentor de anuncios le hubiera armado campañas para el avatar equivocado, gastando miles en el proceso.',
    'Un mentor de lanzamientos le hubiera propuesto un webinar para una audiencia que todavía no estaba preparada para pagar lo que vale su servicio.',
  ] as const,
  loQueNecesitaba: '**Lo que Mauricio necesitaba** era alguien que se metiera de verdad en su negocio y tomara las decisiones correctas para su caso específico.' as Rico,
  cierre: 'No para un caso genérico. Para el suyo. **Eso es lo que yo hago.**' as Rico,
};

export const RESULTADOS = {
  titulo: 'No es un caso aislado.',
  /** Las tres cifras grandes. `v` es una lista: cada elemento, un renglón. */
  numeros: [
    { v: ['+$1M', 'usd'], k: 'generados para mis clientes en nichos completamente distintos.' },
    { v: ['+80M views'], k: 'y +1M de seguidores generados para mis clientes.' },
    { v: ['+20 nichos'], k: 'distintos donde validé funnels con éxito.' },
  ] as ReadonlyArray<{ v: readonly string[]; k: string }>,
  /**
   * Los cuatro casos, con su foto o video (los mismos archivos que la landing de MaKo; los de Lovable son éstos). Sus palabras,
   * salvo la ortografía: Lovable decía «+200M de Views» (en minúscula, como «+80M views» de arriba) y «vídeos» (la de España).
   * Axel (16/11/2026): «Agencia de IA» → «Agencia y academia de IA». Martín: «Axel es ambos, es una agencia y es una academia»
   * (el texto ya decía «la mejor academia de IA en Latam» y el nombre sólo nombraba la agencia).
   */
  casos: [
    { num: '+$60k', nombre: 'Axel — Agencia y academia de IA', texto: 'Reestructuramos su oferta y su sistema de adquisición y logramos ser la mejor academia de IA en Latam.', video: '/vsl-assets/testi-axel.mp4' },
    { num: '<10k → millones', nombre: 'Securiters — Hacking ético', texto: 'De menos de 10.000 seguidores a millones de follows y views. En el camino, lanzamientos de múltiples 5 cifras.', foto: '/vsl-assets/testi-securiters.png', alt: 'Caso Securiters' },
    { num: '+200M de views', nombre: 'QS Media — Canales automatizados de YouTube', texto: 'Con más de 40 empleados en nómina generamos +200M views en YouTube.', foto: '/vsl-assets/testi-qs.jpg', alt: 'Caso QS Media' },
    { num: '+20 nichos', nombre: 'Social Media Lab — Agencia de Marketing', texto: 'Con un equipo de +30, creábamos videos virales en más de 20 nichos diferentes.', foto: '/vsl-assets/testi-sml.jpg', alt: 'Caso Social Media Lab' },
  ] as ReadonlyArray<{ num: string; nombre: string; texto: string; video?: string; foto?: string; alt?: string }>,
  /**
   * Era la bajada de los testimonios de Lovable (se fueron: ver arriba). Es lo único real de esa sección.
   * 16/11/2026: «en la agencia de IA de Axel» → «en la agencia y academia de IA de Axel», como su caso de arriba.
   */
  // La frase de la metodología («Y como profesor de marketing y ventas…») se fue: Martín, 16/11/2026, «esa parte elimínala».
};

/** El nombre de cada ícono de los entregables (lucide, los mismos de Lovable; el del calendario, del 16/11/2026). */
export type IconoEntregable = 'mapa' | 'castillo' | 'ojo' | 'ejes' | 'red' | 'iman' | 'calendario' | 'manos' | 'rompecabezas' | 'barras' | 'persona' | 'compartir';

export const PROGRAMA = {
  titulo: 'Esto obtendrás cuando comencemos a trabajar juntos.',
  // Lovable: «No es un curso grabado. No es una mentoría grupal. Es trabajar conmigo, metido de verdad en tu negocio.
  // Estrategia, ejecución y acompañamiento real en todos los frentes. Conmigo, no con un equipo.» Se va SÓLO «No es una
  // mentoría grupal»: la asesoría de cada semana ES grupal. «Conmigo, no con un equipo» QUEDA: Martín, 15/11 ~21:00, «yo
  // todavía no tengo equipo, así que está bien que lo digas conmigo y no con un equipo» (el sistema lo arma él). Por lo
  // mismo, nunca «conmigo y con mi equipo» ni «nuestro equipo» (lo vigila tests/acelerador-landing.test.ts).
  intro: 'No es un curso grabado. Es trabajar conmigo, metido de verdad en tu negocio. Estrategia, ejecución y acompañamiento real en todos los frentes. Conmigo, no con un equipo.',
  /**
   * Las tres fases y los 12 entregables, con sus palabras (pasados a «tú»), salvo donde contradecían el programa de hoy.
   * 4, 4 Y 4 (16/11/2026). Martín: «no me gusta de que las tarjetas queden 3 y 1, pondría 2 y 2. Y pondría también tal vez una
   * más en sistema de adquisición de clientes predecibles… que quede 4, 4 y 4». Eran 4, 3 y 4 en una grilla de tres columnas
   * (la fila de abajo quedaba con una sola tarjeta); ahora cada fase tiene cuatro, en dos columnas (./estilo.ts).
   * Y «que se tenga mucho más en cuenta el software de MaKo… en esas partes»: lo nuevo y lo de la fase 03 cuentan lo que hace
   * MaKo, con funciones que EXISTEN (cada una, con dónde vive, en su comentario).
   * LOS 12 CONTADOS CON MaKo (16/11/2026, a la tarde): los textos de docs/accelerator-entregables-con-mako.md, uno por entregable,
   * MENOS el #7 (Appointment Setting), que sigue diciendo que el setter manda tu agenda hasta que el setter reserve la llamada (I-6
   * de ese documento). Ahí está, de cada uno, lo que MaKo ya hace y lo que falta construir (I-1 a I-12) para que el texto sea entero.
   * Los comentarios de abajo cuentan el texto de antes de cada uno.
   */
  fases: [
    {
      num: '01', titulo: 'Fundamentos y oferta',
      entregables: [
        // Lovable: «Sesión 1:1 donde armamos juntos el paso a paso exacto del programa. Tu hoja de ruta, desde el día uno.»
        // Hoy la hoja de ruta la arma MaKo y se aprueba antes de empezar (`PROGRAMA_ACELERADOR.incluye`, y más abajo en esta
        // misma página: «Tu hoja de ruta, armada por MaKo»), y una «Sesión 1:1» suelta se leía como una cuarta sesión además
        // de las tres. Es la primera de las tres, y «1 a 1» como en el resto de la página.
        { nombre: 'Blueprint', icono: 'mapa', texto: 'MaKo arma tu hoja de ruta de 90 días, en nuestra primera sesión 1 a 1 la ajustamos y la apruebas: cada entregable con su fecha y su avance.' },
        { nombre: 'Foundations Method', icono: 'castillo', texto: 'Dejamos firmes tu nicho, tu avatar, tu oferta y tu precio: MaKo los revisa con IA punto por punto y los usa en cada guion, anuncio y landing.' },
        { nombre: 'Market Domination', icono: 'ojo', texto: 'MaKo pone tu oferta al lado de la de tu competencia y te muestra el hueco libre: ahí definimos dónde compites, fiel a tu forma de ser y tus valores.' },
        { nombre: 'Communication Angles', icono: 'ejes', texto: 'El Marketing CoPilot saca tus ángulos de tus llamadas, tus chats y tus anuncios, los cruza con tu competencia y te dice cuál vende y cuál se quemó.' },
      ],
    },
    {
      num: '02', titulo: 'Sistema de adquisición de clientes predecible',
      entregables: [
        { nombre: 'Marketing Ecosystem', icono: 'red', texto: 'MaKo arma tu semana de contenido según tu funnel: qué pieza, en qué red y qué día, cada una en tu calendario lista para editar y publicar.' },
        { nombre: 'Lead Generation', icono: 'iman', texto: 'Elegimos tu funnel con lo que ya te funcionó y lo montamos en MaKo: tu landing, tus anuncios, tu lead magnet y cada lead en tu CRM con su origen.' },
        // NUEVO (16/11/2026), el cuarto de la fase: entre conseguir el lead y cerrarlo, el paso que faltaba (marketing → leads →
        // agenda → cierre). Es el setter con IA de MaKo Pro, que el programa trae entero: le contesta SOLO a quien escribe, en el
        // momento («Si responde» no deja esperas, lib/nutricion.ts), con un objetivo como «Que agende una llamada»
        // (lib/setter-ia-reglas.ts; en /planes, «Setter con IA que responde y agenda por WhatsApp e IG», lib/planes-comparacion.ts).
        // ⚠️ NO AGENDA ÉL (revisión del 16/11/2026): decía «le agenda la llamada», y el setter no ve la agenda: manda el link para
        // que la persona elija el horario (lib/flujo-ia.ts, regla 4: «MaKo no ve la agenda; para agendar, el "link" de agenda»). Sin
        // «nadie se enfría esperando», que no entraba en los 150 caracteres de una tarjeta: «en segundos» ya lo dice.
        { nombre: 'Appointment Setting', icono: 'calendario', texto: 'El setter con IA de MaKo contesta a cada lead por WhatsApp en segundos, lo califica y le manda tu agenda para que elija el horario.' },
        { nombre: 'Closing Method', icono: 'manos', texto: 'Cierras sin presión falsa: MaKo arma tu guion con tus objeciones reales y el análisis de llamadas transcribe, traduce y puntúa cada una con SPIN.' },
      ],
      // Lovable: «Y acá no te dejo solo con la estrategia. Según el funnel que elijamos, construimos juntos todo lo que haga
      // falta para que funcione: anuncios, VSL, reels, lead magnets, landing pages, mensajes de venta y todo lo que haga
      // falta.» Era una promesa sin borde («todo lo que haga falta», dos veces) y con piezas que el programa no trae hechas
      // (anuncios, reels, lead magnets). Hoy: lo que Martín arma la primera semana y las plantillas y guiones probados
      // (`PROGRAMA_ACELERADOR.incluye`), en primera persona porque lo arma él. «acá» → «aquí», el español neutro del sitio.
      // NEUTRO (16/11/2026, Martín: «para una mujer atento no aplica»): era «no te dejo solo con la estrategia»; «solo» le habla a un
      // hombre. Lo dice quien no se queda en la estrategia: Martín.
      creativos: {
        texto: 'Y aquí no me quedo en la estrategia. Según el funnel que elijamos, armo lo que necesita para funcionar:',
        lista: 'tu página de venta, tu CRM, tus automatizaciones y tu sistema de contenido, con plantillas y guiones probados para tus anuncios, tu VSL y tus mensajes de venta.',
      },
    },
    {
      num: '03', titulo: 'Sistematización y escala',
      entregables: [
        { nombre: 'Delivery System', icono: 'rompecabezas', texto: 'MaKo arma las etapas de tu entrega desde tu oferta: cada cliente en su etapa, tu curso y tu comunidad en la app, y quién necesita atención hoy.' },
        // Lovable: «Instalamos los sistemas, las automatizaciones, el CRM y las métricas…». Hoy el CRM y las automatizaciones
        // se arman la PRIMERA semana (`PROGRAMA_ACELERADOR.incluye`, lo que es contrato): en la fase 3 se afinan.
        // 16/11/2026, «en MaKo»: antes → «Afinamos los sistemas, las automatizaciones, el CRM y las métricas para decidir con
        // números en la mano.» Las métricas son el tablero de resultados que el programa trae (`LISTA_DEL_ACELERADOR`, el mismo
        // nombre que se lee más abajo en «Lo que incluye»), y todo vive en MaKo.
        { nombre: 'Operations & Metrics', icono: 'barras', texto: 'Afinamos en MaKo tus automatizaciones y tu CRM, y cada lunes lees tus leads, reuniones y ventas en tu tablero de resultados: decides con números.' },
        // 16/11/2026, CON MaKo. Antes → «Sistema para atraer, evaluar y sumar a las personas correctas sin perder tiempo ni bajar
        // tus estándares.» Martín: «voy a dejar Hiring Process y Delegation Framework. Yo lo que me gustaría que se haga ahí es que
        // se tenga mucho más en cuenta el software de MaKo». Con MaKo, contratar empieza por lo que ya no hace falta contratar:
        // el setter con IA (el entregable #7) y la IA que escribe tus textos cubren puestos enteros. Y a quien entra, MaKo lo
        // mide: el análisis de llamadas puntúa cada llamada de venta y la anota a nombre de su closer (lib/closing.ts,
        // «analizar el desempeño del closer»; en /planes, «Análisis de llamadas», de MaKo Pro).
        { nombre: 'Hiring Process', icono: 'persona', texto: 'Definimos qué puestos ya cubre MaKo y a quién sumar: MaKo filtra a tus candidatos y el análisis de llamadas te muestra cómo vende quien entra.' },
        // 16/11/2026, CON MaKo. Antes → «Definimos qué delegar, cuándo y a quién, para soltar tareas sin perder el control ni el
        // nivel de tu equipo.» Lo que hace que delegar no sea perder el control, en MaKo: cada persona entra con SU rol (setter,
        // closer o admin, y cada rol ve lo suyo: app/equipo/EquipoView.tsx) y sus tareas viven en tu plan, con su responsable y
        // su avance (app/plan/board).
        { nombre: 'Delegation Framework', icono: 'compartir', texto: 'Definimos qué delegar y a quién: cada persona entra a MaKo con su rol, recibe sus tareas en tu plan y ahí ves si las cumple a tiempo.' },
      ],
    },
  ] as ReadonlyArray<{
    num: string; titulo: string;
    entregables: ReadonlyArray<{ nombre: string; icono: IconoEntregable; texto: string }>;
    creativos?: { texto: string; lista: string };
  }>,
  // «Y EN LAS TRES FASES, SIEMPRE:» SE FUE (16/11/2026, Martín: «yo eliminaría también esa parte de, y en las tres fases, siempre
  // conmigo, cero relleno, todo accionable, todo eso lo eliminaría para directamente el precio»). Eran dos tarjetas escritas a mano
  // debajo de los entregables: «Acompañamiento continuo · Conmigo, para que no te frenes.» (las 3 sesiones 1 a 1 de 2 horas, la
  // asesoría grupal de cada semana y el WhatsApp personal de Martín) y «El programa completo + recursos · Cero relleno: todo
  // accionable.» (las tres fases con plantillas y recursos). Lo mismo lo dice «La inversión», con la lista del programa importada
  // (`LISTA_DEL_ACELERADOR`): de los entregables y su tira (./Tiras.tsx) se pasa directo al precio.
  /**
   * El rótulo de la lista de «La inversión» (16/11/2026, a la tarde: lo que incluye vive adentro de ese bloque, debajo del precio).
   * Hasta el 16/11 era «Lo que incluye», la ceja de un bloque aparte que tenía al lado «Nuestra promesa».
   */
  incluyeCeja: 'Incluye',
};

/**
 * LA INVERSIÓN (16/11/2026). Martín: «en esta Landing Accelerator también necesita tener el precio… es mi política de que ya tenga
 * todo el precio». Esa tarde, el bloque de lo que incluye pasó a llamarse así, con el precio arriba (ya no la columna de /planes
 * sola debajo): «me gustaría que esa parte de lo que incluye se llame la inversión». Acá vive su ceja.
 */
export const PRECIO = {
  ceja: 'La inversión',
};

export const FILTRO = {
  titulo: '¿Esto es realmente para ti?',
  siTitulo: 'Es para ti si…',
  noTitulo: 'No es para ti si…',
  // 16/11/2026, el corte de la aplicación (`califica`, lib/aplicacion-accelerator.ts), con las palabras de Martín: «pon facturas
  // más de 5.000 está bien. Y no pondría con clientes recurrentes. Pondría con oferta validada. Con clientes y oferta validada».
  // Antes → «Facturas entre $5K-$10K USD mensuales, con clientes recurrentes.» El «entre 5 y 10» dejaba afuera a quien factura
  // más, y es el mismo corte que la calificación del héroe («+$5.000 USD/mes»), que no cambia.
  si: [
    { t: 'Ya tienes un negocio funcionando', d: 'Facturas más de $5.000 USD al mes, con clientes y oferta validada.' },
    { t: 'Ya validaste tu oferta', d: 'Tienes casos de éxito, testimonios o experiencia comprobable en el mercado.' },
    { t: 'Tienes presencia digital activa', d: 'Creas contenido y ya empezaste a construir una audiencia.' },
    { t: 'Puedes dedicar tiempo', d: 'Cuentas con algunas horas por día para implementar lo que definamos juntos.' },
    // NEUTRO (16/11/2026, Martín: «para una mujer atento no aplica… que sea neutro»). Antes → «Estás listo para invertir en tu negocio».
    { t: 'Es tu momento de invertir en tu negocio', d: 'Entiendes que crecer requiere inversión y compromiso.' },
    { t: 'Buscas estructura, no atajos', d: 'Quieres profesionalizar tu empresa con procesos y sistemas.' },
    { t: 'Tienes mentalidad de ejecución', d: 'Sabes que los resultados dependen de implementar, no solo aprender.' },
  ] as const,
  no: [
    { t: 'Estás arrancando desde cero', d: 'Todavía no generaste ingresos consistentes con tu negocio.' },
    // 16/11/2026, sin «recurrentes» (Martín: «no pondría con clientes recurrentes»). Antes → «No tienes clientes recurrentes,
    // testimonios o resultados demostrables.» Con «ni»: es la negación de los tres.
    { t: 'Tu oferta aún no está validada', d: 'No tienes clientes, testimonios ni resultados demostrables.' },
    { t: 'Buscas que te resuelvan todo', d: 'Esperas resultados sin involucrarte en la implementación.' },
    { t: 'No puedes comprometer tiempo', d: 'Tienes otras prioridades que hoy están por encima del negocio.' },
    { t: 'Tienes un negocio de productos', d: 'La metodología está diseñada específicamente para servicios y expertise.' },
    { t: 'Operas desde la excusa', d: 'Responsabilizas al mercado, la competencia o el algoritmo por tus resultados.' },
    // NEUTRO (16/11/2026), el espejo del «es para ti» de arriba. Antes → «No estás listo para invertir».
    { t: 'No es tu momento de invertir', d: 'Buscas soluciones económicas esperando resultados de alto nivel.' },
  ] as const,
};

// EL PIE PROPIO SE FUE (16/11/2026): la página lleva el pie del sitio (`PieGlobal`, app/accelerator/page.tsx), que escondía éste
// y trae los legales en su columna Legal (Reembolsos incluida, la que Meta pide en la página de destino). Se fueron con él su
// frase («Acompañamiento personalizado para construir un sistema de adquisición de clientes predecible.», que en Lovable decía
// «1 a 1»), el «© Martín Koncke» y sus tres links (Términos, Privacidad y Reembolsos).
