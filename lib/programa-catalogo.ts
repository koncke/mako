// =============================================================================
// El programa, por bloques — FUENTE ÚNICA
// =============================================================================
// Un bloque = una clase = una tarea. Es la unidad del bucle de entrega: el
// cliente mira el video, deja la tarea contestada, y recién ahí se agenda la
// sesión. Después la IA reescribe la respuesta con lo que se habló y el cliente
// la aprueba.
//
// ⚠️ UNA CLASE NO ES UN VIDEO. Varias clases pueden compartir una grabación
// (`mismoVideoQue`), y eso es lo que separa el trabajo del CLIENTE del trabajo
// de MAURICIO: las 44 tareas se contestan de a una, pero se graban 25 veces.
// El corte estaba puesto donde el CUESTIONARIO se partía, no donde se parte una
// clase: los cuatro campos de la carta de expectativas son cuatro respuestas y
// una sola explicación, y grabar cuatro videos de eso es grabar cuatro veces la
// misma introducción. El detalle de cada fusión está en docs/programa-mauricio.md.
//
// ⚠️ ESTO LO LEEN CUATRO COSAS Y POR ESO VIVE ACÁ Y NO EN CADA UNA:
//   1. El cargador de Whop (`scripts/cargar-programa-whop.ts` y `lib/cs-sync-whop.ts`)
//      — crea el curso, los capítulos y las lecciones desde este archivo.
//   2. El formulario de la tarea que contesta el cliente.
//   3. El prompt que reescribe la respuesta después de la junta: necesita saber
//      QUÉ preguntaba el bloque para no inventar.
//   4. La tab Program, que es donde Mauricio ve qué le falta grabar.
// Si el temario se copia en cualquiera de las cuatro, la segunda se queda vieja.
// Ya pasó con el contrato del `detalle`; ver AGENTS.md → «Una cosa, un lugar».
//
// SIN `server-only` A PROPÓSITO: lo importa el formulario (client component) y
// lo importan los tests.
//
// De dónde sale: el material de Mauricio Bustos · Sistema Negocio que Escala™
// (los dos Cuestionarios Maestros, el análisis de fases y el contexto del
// sistema). El texto largo y el porqué de cada módulo están en
// `docs/programa-mauricio.md`. Acá va lo que el código necesita.
// =============================================================================

/** En qué fase del encargo cae el módulo. Ordena y agrupa la entrega. */
export type FasePrograma = 'arranque' | 'norte' | 'pas' | 'palancas' | 'build';

/** Quién contesta la tarea. Los umbrales los pone el LÍDER del área, no el
 *  dueño, porque es quien va a responder por ellos. No es un detalle: si lo
 *  contesta el dueño, el equipo no se compromete con el número. */
export type QuienContesta = 'dueño' | 'líder de área';

export type Clase = {
  /** Estable y único. Es la clave de la respuesta guardada: NO se renumera. */
  id: string;
  titulo: string;
  /** UNA línea: qué tiene que dejar contestado. Es el enunciado de la tarea. */
  pregunta: string;
  /**
   * UNA línea: de qué va esta parte del video. Es CONTEXTO para grabar, no un
   * guion — Mauricio sabe su material, lo que necesita es saber qué cubre cada
   * grabación y por qué existe. Nunca «decí esto»; siempre «acá va esto».
   */
  graba: string;
  /**
   * Los puntos a cubrir en el video, EN ORDEN. Es el esqueleto de la grabación:
   * cada uno dice qué dejar claro, nunca con qué palabras — Mauricio sabe su
   * material y un guion palabra por palabra se lee como leído.
   *
   * El criterio para escribirlos: el video existe para que el cliente pueda
   * contestar la tarea. Así que salen de los CAMPOS reales de esa clase
   * (`lib/programa-campos.ts`), no de una idea general del tema: si un campo
   * pide «marca cuáles son dato duro y cuáles estimación», el video tiene que
   * haber explicado por qué se pregunta eso.
   *
   * Opcional mientras se escriben módulo por módulo.
   */
  puntos?: string[];
  /** El atoro medido, cuando lo hay. Va en el video, no en la letra chica. */
  atoro?: string;
  /**
   * Comparte grabación con otra clase del MISMO módulo, que tiene que estar
   * antes en la lista. La tarea sigue siendo propia: lo que se comparte es el
   * video, no el bloque.
   */
  mismoVideoQue?: string;
};

export type Modulo = {
  /** Estable y único. */
  id: string;
  numero: number;
  titulo: string;
  fase: FasePrograma;
  quien: QuienContesta;
  /** Se repite una vez por área del cliente. El video es el mismo; la tarea no. */
  porArea?: true;
  clases: Clase[];
};

export const PROGRAMA: Modulo[] = [
  {
    id: 'm0', numero: 0, titulo: 'Cómo se juega', fase: 'arranque', quien: 'dueño',
    clases: [
      {
        id: 'm0c1', titulo: 'Qué vas a tener al final',
        pregunta: 'Cuántas horas TUYAS cuesta esto, y por qué no se delega al equipo.',
        graba: 'Qué queda instalado al terminar, y el precio real en horas del dueño. Es la clase que evita que arranque alguien que no está dispuesto a ponerlas.',
        atoro: 'El dueño no asume que él es el proyecto. Hoy se resuelve en la venta y se olvida.',
      },
      {
        id: 'm0c2', titulo: 'Estándar no es criterio',
        pregunta: 'Una decisión de tu negocio que tiene estándar pero no tiene criterio.',
        graba: 'La distinción que sostiene el programa entero: el estándar dice qué resultado se espera; el criterio dice cómo se logra y qué hacer cuando no se logra. Va sola porque es el concepto que se cita en los once módulos siguientes.',
      },
      {
        // Comparte video con 0.1 sin estar pegada a ella: agrupar NO reordena.
        // El rótulo sale de la POSICIÓN en el módulo («0.3 · Cómo funciona cada
        // bloque») y es lo que ve el cliente en Whop y en sus mensajes, así que
        // mover una clase de lugar para juntar videos le renumera el temario.
        id: 'm0c3', titulo: 'Cómo funciona cada bloque',
        pregunta: 'Qué hacés antes de cada sesión y qué se revisa en ella.',
        graba: 'La mecánica del bucle, en el mismo video que 0.1: mirás, contestás la tarea ANTES de la sesión, se debate, y después te vuelve reescrita para que la apruebes. La tarea sin contestar es una sesión perdida.',
        mismoVideoQue: 'm0c1',
      },
    ],
  },
  {
    id: 'm1', numero: 1, titulo: 'Tu negocio en números', fase: 'norte', quien: 'dueño',
    clases: [
      {
        id: 'm1c1', titulo: 'La unidad que se repite',
        pregunta: 'Si tu negocio se juega en puntos de operación, en oportunidades comerciales o en proyectos, y cuántos tenés.',
        graba: 'Cómo se elige la unidad que se repite —sucursal, oportunidad o proyecto— y por qué todo lo que viene después se cuelga de esa elección.',
        puntos: [
          'Por qué esta pregunta va primera: todo lo que se mide después se cuelga de la unidad que elijan acá. Elegida mal, se mide tres meses lo que no mueve el resultado.',
          'Las tres opciones con un ejemplo de rubro cada una: punto de operación (sucursales, rutas, consultorios), oportunidad comercial (deals que avanzan por etapas) y proyecto (obra con inicio, fin y presupuesto comprometido).',
          'Cómo se reconoce la propia: es lo que se REPITE muchas veces y determina el resultado. Si algo cambia el resultado pero pasa una vez al año, no es la unidad.',
          'Que hay que dar el número de hoy, y qué contar en cada caso: cuántos puntos abiertos, cuántas oportunidades abiertas al mes en promedio, cuántos proyectos simultáneos.',
          'El caso mixto: tener dos de las tres conviviendo es común y no es un problema, pero cada línea se mide distinto. Pedir que digan qué línea se comporta como cada una.',
        ],
      },
      {
        id: 'm1c2', titulo: 'Tus áreas y quién responde',
        pregunta: 'Qué áreas existen hoy y quién rinde cuentas de cada una, con nombre y apellido.',
        graba: 'La otra mitad del mismo mapa: las áreas y el nombre y apellido de quien responde por cada una. Sin apellido no hay accountability, hay un organigrama.',
        puntos: [
          'Que se listen las áreas COMO SON HOY, no como deberían ser. Si una persona cubre tres, se ponen las tres con el mismo nombre al lado.',
          'Nombre y apellido, no el puesto. «Operaciones» no rinde cuentas de nada; Fulano sí. Es la diferencia entre un organigrama y un responsable.',
          'Qué hacer con un área sin dueño claro: se escribe igual y se deja el responsable vacío. Ese hueco es la mitad del valor del ejercicio, no un error.',
          'Cerrar diciendo para qué se usa: de acá salen los objetivos por área del módulo 4. Inventar un área que no existe se paga tres módulos después.',
        ],
        mismoVideoQue: 'm1c1',
      },
      {
        id: 'm1c3', titulo: 'Venta y resultado de 24 meses',
        pregunta: 'Los números mes a mes, por línea de negocio y por unidad, con la fuente de cada cifra.',
        graba: 'Qué números se piden y por qué 24 meses y no 12: con un solo ciclo no se distingue una tendencia de una estacionalidad. Y que cada cifra viaja con su fuente, porque después hay que poder discutirla.',
        puntos: [
          'Por qué 24 meses y no 12: con un solo ciclo no se distingue una tendencia de una estacionalidad, y media MCI se escribe mal por eso.',
          'Los tres cortes que se piden y para qué sirve cada uno: mes a mes es la curva, por línea de negocio es dónde está el margen, y por unidad agrupada es la dispersión.',
          'Las salidas permitidas, dichas de frente para que nadie se frene: si no hay mes a mes, trimestre a trimestre; si no tienen resultado neto, el bruto y que lo aclaren.',
          'El agrupado cuando hay muchas unidades: no hace falta una fila por sucursal. Tres bloques —las buenas, las medias y las que pierden—, cuántas hay en cada uno y el rango.',
          'La cuarta tabla, que es la que nadie espera: por CADA cifra, de dónde sale, quién la calcula y si es dato duro o estimación. Explicar el porqué — dos meses después alguien discute un número y sin la fuente no hay forma de cerrar la discusión.',
        ],
      },
      {
        id: 'm1c4', titulo: 'Qué te hace perder plata',
        pregunta: 'Los tres costos que más pesan, el punto de equilibrio, y qué unidades venden bien sin ser rentables.',
        graba: 'La cara del costo: los tres que más pesan, el punto de equilibrio, y el caso incómodo de la unidad que vende bien y no deja nada.',
        puntos: [
          'Los tres costos que más pesan van en PORCENTAJE sobre la venta, no en pesos: es lo único que se puede comparar entre unidades de tamaños distintos.',
          'El punto de equilibrio, y la pregunta que casi nadie tiene contestada: si es el mismo para todas las unidades o cambia por tamaño.',
          'La lista de causas para las que no llegan —ubicación, renta, nómina, tamaño, competencia, precio— y que se puede marcar más de una. Casi siempre son dos.',
          'El caso incómodo y el que más sirve: la unidad que vende bien y aun así no deja nada. Insistir en el «por qué», no solo en cuál — el nombre solo no sirve para nada.',
        ],
      },
      {
        id: 'm1c5', titulo: 'Tu paradoja en una frase',
        pregunta: 'Los dos números tuyos que se contradicen.',
        graba: 'En el mismo video, el cierre: los dos números propios que se contradicen. Sale de lo que acaba de cargar, así que conviene armarla en vivo con un ejemplo.',
        puntos: [
          'Aclarar de entrada que esta clase NO pide datos nuevos: se contesta con lo que ya cargaron en las dos anteriores.',
          'La cifra que no cuadra, con las cuatro varas contra las que puede no cuadrar: el tamaño del mercado, el margen que reportan, el punto de equilibrio, o simplemente la intuición del dueño.',
          'Separar lo que cambió en los últimos doce meses en interno (precios, personal, estructura) y externo (competencia, regulación, mercado). Importa porque la MCI se va a escribir sobre lo interno.',
          'Armar una paradoja EN VIVO con un ejemplo: «crecimos 40% y ganamos menos», «vendemos más que nunca y estoy más atrapado que nunca». Verla armarse es lo que hace que el ejercicio se entienda.',
          'La regla de la frase: lleva DOS NÚMEROS. Sin números es una queja, y una queja no se puede convertir en MCI.',
        ],
        mismoVideoQue: 'm1c4',
      },
      {
        id: 'm1c7', titulo: 'Quién te compite de verdad',
        pregunta: 'En qué frente pega cada competidor, si perdiste venta medible, y qué hace que un cliente te prefiera.',
        graba: 'Cómo se separa el competidor que duele del que molesta, y la diferencia entre una pérdida percibida y una medible.',
        puntos: [
          'La tabla de competidores va por FRENTE —precio, servicio, ubicación, plazo— y en qué unidades o líneas se siente. Una lista de nombres no sirve.',
          'La distinción que decide todo el módulo: ¿perdieron venta MEDIBLE o es percepción? Si es medible, cuánto y desde cuándo.',
          'Por qué importa tanto: la MCI se escribe sobre lo que se puede medir. Si la amenaza es percepción, el trimestre se ataca por otro lado.',
          'Dar vuelta la pregunta: qué hace que un cliente los prefiera, y qué les dicen los clientes cuando los escuchan de verdad.',
          'La unidad, el vendedor o el proyecto que salió notablemente mejor que el resto: ésa es la escuela del sistema. Si saben por qué, ya tienen media palanca escrita.',
          'Cerrar con lo que sí funcionó y quieren conservar, para que el ejercicio no quede solo en lo que falta.',
        ],
        atoro: 'Casi siempre es percepción y no dato. Distinguirlo cambia la MCI: se ataca lo que se puede medir.',
      },
      {
        id: 'm1c6', titulo: 'Lo que no sabés todavía',
        pregunta: 'La lista de datos que no existen, con quién los consigue y para cuándo.',
        graba: 'La clase que da permiso a no tener el dato. Conviene grabarla en tono de alivio y no de reproche: es la que evita que el programa se frene esperando un número que nadie tiene.',
        puntos: [
          'Abrir dando permiso, y decirlo con todas las letras: esta clase se contesta con lo que NO tienen, y eso es una respuesta completa.',
          'Pedir que revisen hacia atrás todo el módulo: de cada cifra que se pidió, cuál no existe o nadie calcula hoy.',
          'Las tres columnas y por qué las tres: el dato que falta, quién debería generarlo, para cuándo. Sin nombre y sin fecha es una lista de deseos.',
          'Contar el caso de TEXX —19 días con la MCI abierta esperando una cifra de margen— para que se entienda que declarar el hueco ahorra semanas, no las cuesta.',
          'Cerrar con la regla: un hueco identificado vale más que una cifra inventada. La inventada rompe el tablero tres meses después, y para entonces nadie se acuerda de dónde salió.',
        ],
        atoro: 'El dato base no existe: le pasó a los cuatro clientes. TEXX vivió 19 días con la MCI abierta esperando una cifra de margen. Contestar «no lo tengo, lo consigue Fulano el 12» es una respuesta válida.',
      },
    ],
  },
  {
    id: 'm2', numero: 2, titulo: 'Dónde vive el criterio', fase: 'norte', quien: 'dueño',
    clases: [
      {
        id: 'm2c1', titulo: 'Si desaparecés dos semanas',
        pregunta: 'Qué se degrada primero, con nombre concreto. No «todo».',
        graba: 'El arranque del ejercicio, y sirve de entrada al siguiente: la respuesta «se cae todo» no es una respuesta. Lo que se busca es el primer nombre concreto.',
      },
      {
        id: 'm2c2', titulo: 'Las decisiones que te suben',
        pregunta: 'Ocho renglones: la decisión, quién la toma hoy, qué resultado se espera, cómo se logra y qué hacer cuando no se logra.',
        graba: 'En el mismo video, la tabla que sale de eso. Vale la pena llenar un renglón en vivo: es la primera vez que el cliente ve el estándar y el criterio separados en columnas.',
        atoro: 'Las tres últimas columnas SON el criterio. Si solo podés llenar «qué resultado se espera», esa decisión tiene estándar y no tiene criterio: por eso te sigue subiendo.',
        mismoVideoQue: 'm2c1',
      },
      {
        id: 'm2c3', titulo: 'Tu agenda real',
        pregunta: 'Dos semanas medidas, no la ideal, repartidas en dirección, crecimiento, innovación, gente y operación.',
        graba: 'Por qué se piden dos semanas MEDIDAS y no la agenda ideal. La ideal ya la sabe; el ejercicio sirve por la distancia entre las dos.',
      },
      {
        id: 'm2c4', titulo: 'Lo que no está pasando',
        pregunta: 'La alianza que no cerraste, la línea que no lanzaste, el mercado que no exploraste.',
        graba: 'El costo de oportunidad de esa agenda, en el mismo video: lo que no ocurrió por estar donde estuvo. Es lo que le pone precio al tiempo del dueño.',
        mismoVideoQue: 'm2c3',
      },
      {
        id: 'm2c5', titulo: 'Cuánto estás dispuesto a que baje',
        pregunta: 'El número que aceptás resistir mientras soltás, y por cuánto tiempo.',
        graba: 'La conversación incómoda y por eso va sola: soltar tiene un costo de corto plazo y hay que ponerle número y plazo ANTES, no cuando duela.',
        atoro: 'Si no se define ahora, a la tercera semana todo vuelve a como estaba.',
      },
    ],
  },
  {
    id: 'm3', numero: 3, titulo: 'El equipo real', fase: 'norte', quien: 'dueño',
    clases: [
      {
        id: 'm3c1', titulo: 'Quién hace qué de verdad',
        pregunta: 'Por cada persona clave: qué hace realmente, qué le sobra, qué le falta, y la decisión (desarrollar, mover, sustituir, mantener).',
        graba: 'El equipo que hay, no el del organigrama, y las cuatro decisiones posibles sobre cada persona. Conviene marcar que «mantener» también es una decisión y se elige, no se omite.',
      },
      {
        id: 'm3c2', titulo: 'Qué puestos faltan',
        pregunta: 'Qué haría cada uno, a quién reportaría, y si sale de adentro o se contrata.',
        graba: 'La otra mitad del mismo ejercicio, en el mismo video: el hueco que queda cuando el mapa de arriba se mira contra lo que el negocio necesita.',
        mismoVideoQue: 'm3c1',
      },
    ],
  },
  {
    id: 'm4', numero: 4, titulo: 'Las dos MCIs', fase: 'norte', quien: 'dueño',
    clases: [
      {
        id: 'm4c1', titulo: 'La MCI 1, el resultado',
        pregunta: '«Pasar de ___ a ___ para el ___», con base real, fuente y responsable del dato.',
        graba: 'La MCI de resultado y su fórmula. Lo que hay que dejar clavado es que sin base real medida hoy no hay MCI: «crecer» no es un punto de partida.',
      },
      {
        id: 'm4c2', titulo: 'La MCI 2, el criterio',
        pregunta: '«Pasar de un equipo que ___ a un equipo que ___ para el ___».',
        graba: 'La segunda MCI va en el MISMO video que la primera, porque el error es confundirlas y el contraste es la clase. Las dos al lado, en pantalla, y el tiempo del dueño mostrado como lo que comprueba la MCI 2, no como la MCI 2.',
        atoro: 'El error más frecuente: redactarla sobre lo que el dueño deja de hacer. Un equipo no puede ganar «el director trabaja menos»; sí puede ganar adueñarse de sus números. El tiempo del dueño es el LAG que comprueba la MCI 2, no la MCI 2. HMO las escribió las dos sobre criterio y se quedó sin marcador económico.',
        mismoVideoQue: 'm4c1',
      },
      {
        id: 'm4c3', titulo: 'El objetivo de cada área',
        pregunta: 'Qué sostiene, cuál es su número, su base de hoy, su fuente, quién rinde cuentas, y si el área YA lo calcula.',
        graba: 'Cómo baja cada MCI a un objetivo por área. La pregunta que decide es la última: si el área todavía no calcula ese número, el objetivo no entra en este ciclo.',
        atoro: 'El tablero recibe cifras que el área ya cierra. Si hay que inventar un reporte, no entra en este ciclo.',
      },
    ],
  },
  {
    id: 'm5', numero: 5, titulo: 'El propósito, en la voz de tu gente', fase: 'pas', quien: 'dueño',
    clases: [
      {
        id: 'm5c1', titulo: 'Por qué seguirían',
        pregunta: 'Si el dinero estuviera resuelto, por qué seguirían con esto, y qué construyeron que antes no existía en su zona.',
        graba: 'Las tres piezas del propósito van en UN video, porque la redacción sale bien en los cuatro clientes y no es donde se traba. Ésta es la primera: la pregunta del dinero resuelto, que es la que saca la respuesta honesta.',
      },
      {
        id: 'm5c2', titulo: 'Quién es el adversario',
        pregunta: 'Concreto y medible, no abstracto, y cómo se siente eso en el piso.',
        graba: 'La segunda pieza: el adversario tiene que ser algo que se pueda señalar en el piso. «La mediocridad» no sirve; «que el cliente espere 20 minutos», sí.',
        mismoVideoQue: 'm5c1',
      },
      {
        id: 'm5c3', titulo: 'Los valores como conducta',
        pregunta: 'Qué hace alguien de la casa que otro no haría, exactamente.',
        graba: 'La tercera: el valor escrito como conducta observable. Si no se puede describir qué hace la persona, no es un valor, es un cartel.',
        mismoVideoQue: 'm5c1',
      },
      {
        id: 'm5c4', titulo: 'Cómo se lo contás al equipo',
        pregunta: 'Quién lo dice, en qué foro, con qué ritual y cómo se ancla en la junta semanal.',
        graba: 'Va solo, y es el único del módulo que necesita video propio. Tres cosas concretas: quién lo dice, en qué foro, y cómo queda anclado en la junta semanal para que no sea un anuncio de una sola vez.',
        atoro: 'Acá se atora la bajada, no la redacción: el enunciado sale bien en los cuatro clientes, comunicarlo no ocurre solo. Y el vocabulario traiciona: en Baja Teriyaki «honrar» se cambió a «consentirse» porque sonaba demasiado formal para hablarle al equipo.',
      },
    ],
  },
  {
    id: 'm6', numero: 6, titulo: 'Las palancas', fase: 'palancas', quien: 'dueño', porArea: true,
    clases: [
      {
        id: 'm6c1', titulo: 'Para qué existe esta área',
        pregunta: 'A cuál de las dos MCIs sirve, y qué número movería si hiciera todo perfecto un trimestre.',
        graba: 'El primer video del tramo que se repite por área, y el primero que le habla al LÍDER y no al dueño. Sirve para ubicarlo: dónde encaja su área en las dos MCIs, antes de pedirle un solo número.',
        atoro: 'Lo que destraba no es el formulario, es el contexto. Un director de HMO llegó solo con sus tres números puestos cuando su rol ya tenía una razón de existir dentro del sistema.',
      },
      {
        id: 'm6c2', titulo: 'Qué te está pidiendo el frente',
        pregunta: 'Lo que el área comercial u operativa le pide a esta área y no está recibiendo.',
        graba: 'En el mismo video, la mirada desde afuera: qué le está pidiendo el área de al lado y no recibe. Casi siempre es de ahí que sale la primera palanca real.',
        mismoVideoQue: 'm6c1',
      },
      {
        id: 'm6c3', titulo: 'Elegir las palancas',
        pregunta: 'Máximo tres por objetivo, cada una pasando el filtro de cuatro: predice el resultado, lo controla el equipo, se mide al menos semanal, y es hoy un cuello real.',
        graba: 'El filtro de cuatro preguntas, una por una, y el máximo de tres por objetivo. Vale la pena pasar una palanca falsa por el filtro en vivo para que se vea dónde falla.',
        atoro: 'Si la respuesta a la cuarta es «ya lo hacen bien», eso no es una palanca: es un estándar que ya opera. Se anota y se saca del tablero.',
      },
      {
        id: 'm6c5', titulo: 'El número del área, con su base y su fuente',
        pregunta: 'El indicador consecuencia del área: su base real hoy, la meta, cada cuánto se cierra y si el área ya lo calcula.',
        graba: 'El indicador consecuencia del área: qué mide, cuál es su base real de hoy y cada cuánto se cierra. La última pregunta del formulario es la que decide si entra o no en este ciclo.',
        atoro: 'Si hay que inventar un reporte para calcularlo, no entra en este ciclo. El tablero recibe cifras que el área YA cierra.',
      },
      {
        id: 'm6c4', titulo: 'La ficha de nueve campos',
        pregunta: 'Nombre con verbo y objeto, cómo se mide con numerador y denominador, frecuencia, hora de corte, unidad, verde, amarillo, rojo, y un responsable con nombre.',
        graba: 'En el mismo video, la ficha campo por campo: es CÓMO se escribe el número de arriba para que dos personas lo calculen igual. Los que se saltean son la hora de corte y el denominador, y son justo los que hacen que el dato se discuta después.',
        mismoVideoQue: 'm6c5',
      },
    ],
  },
  {
    id: 'm7', numero: 7, titulo: 'La evidencia', fase: 'palancas', quien: 'dueño', porArea: true,
    clases: [
      {
        id: 'm7c1', titulo: 'Qué prueba que se hizo',
        pregunta: 'Por cada palanca: foto, checklist, formulario, lectura, registro en sistema o entregable.',
        graba: 'El video para tomarse el tiempo. Las seis formas de evidencia —foto, checklist, formulario, lectura, registro en sistema y entregable— con un ejemplo de cada una en un rubro distinto.',
        atoro: 'Es el bloqueo número uno de todo el programa. Baja Teriyaki estuvo tres semanas detenida en esta sola pregunta. «El cliente sabe qué quiere que pase. No sabe cómo probar que pasó.»',
      },
      {
        id: 'm7c2', titulo: 'Si es foto, de qué exactamente',
        pregunta: 'Desde qué ángulo, y qué la hace aprobada o rechazada.',
        graba: 'El caso difícil va en el MISMO video, porque separarlo parte en dos el único bloqueo grande: la foto sirve si está definido el ángulo y el criterio de aprobado. El caso de TEXX explica el límite mejor que cualquier definición.',
        atoro: 'En TEXX el protocolo de servicio no se podía medir porque el mystery shopper solo captura cuando hay alguien observando.',
        mismoVideoQue: 'm7c1',
      },
      {
        id: 'm7c3', titulo: 'Quién sube y quién valida',
        pregunta: 'Cuántas capturas por día, en qué momentos, y cuánto tarda la persona en subirla.',
        graba: 'La logística de la captura: cuántas veces al día, en qué momentos y quién valida. Va solo porque es una regla operativa con número propio, no una idea.',
        atoro: 'Si subir la evidencia pasa de dos minutos, no se va a hacer. Y sin evidencia subida, rojo, aunque el trabajo se haya hecho.',
      },
    ],
  },
  {
    id: 'm8', numero: 8, titulo: 'Los umbrales', fase: 'palancas', quien: 'líder de área', porArea: true,
    clases: [
      {
        id: 'm8c1', titulo: 'Qué ya lograste alguna vez',
        pregunta: 'Ese número es el piso de lo posible, no la meta.',
        graba: 'Un solo video para los tres umbrales: son un ejercicio, no tres. Arranca por el piso —lo que ya se logró alguna vez—, que es el único ancla que el líder tiene para calibrar todo lo demás.',
        atoro: 'El dueño no tiene referencia de qué es exigente pero posible, y ante la duda no contesta: Patricia no devolvió el archivo. Por eso la pregunta que sí funciona es esta, y no «¿cuál sería una buena meta?».',
      },
      {
        id: 'm8c2', titulo: 'Qué es exigente pero alcanzable',
        pregunta: 'Con lo que tenés hoy: sin gente nueva y sin presupuesto nuevo.',
        graba: 'El verde, con la restricción que lo hace honesto: con la gente y el presupuesto de hoy. Sin esa cláusula la meta se convierte en un pedido de recursos.',
        mismoVideoQue: 'm8c1',
      },
      {
        id: 'm8c3', titulo: 'Cuándo se cae',
        pregunta: 'Qué tendría que pasar para que esto salga mal. Esa es la definición del rojo.',
        graba: 'El rojo se define al revés que los otros dos: no es «cuánto menos», es qué tendría que pasar para que esto salga mal. Cerrá mostrando los tres rangos juntos, ya escritos, que es cuando se ve si encajan.',
        atoro: 'Rangos sin traslape entre verde, amarillo y rojo: es el error más común. Y nada de 100% salvo donde el incumplimiento sea inadmisible por seguridad, legal o pérdida de cliente.',
        mismoVideoQue: 'm8c1',
      },
    ],
  },
  {
    id: 'm9', numero: 9, titulo: 'La carta de expectativas', fase: 'palancas', quien: 'dueño', porArea: true,
    clases: [
      {
        id: 'm9c1', titulo: 'Qué puede decidir sin consultarte',
        pregunta: 'El límite explícito: hasta cuánto de gasto, qué tipo de decisión, en qué situaciones.',
        graba: 'La carta entera es UN video: son cuatro secciones de un mismo documento y una sola explicación. Abrí por ésta y sé concreto con montos — un límite sin número no es un límite.',
        atoro: 'Es la sección crítica de todo el programa. Si queda vacía, el tablero puede estar perfecto y el líder va a seguir escalando: la junta semanal sigue siendo el dueño resolviendo.',
      },
      {
        id: 'm9c2', titulo: 'Qué sí te tiene que escalar',
        pregunta: 'Corto y específico. Todo lo que no esté ahí, no se escala.',
        graba: 'La contracara, y la regla que la hace funcionar: la lista es corta y cerrada, porque todo lo que no está escrito ahí no se escala.',
        mismoVideoQue: 'm9c1',
      },
      {
        id: 'm9c3', titulo: 'Qué le vas a dar vos',
        pregunta: 'Presupuesto, gente, capacitación y decisiones que dependen de vos, con fecha.',
        graba: 'La parte que convierte la carta en un acuerdo y no en una lista de exigencias: lo que el dueño se compromete a poner, con fecha.',
        mismoVideoQue: 'm9c1',
      },
      {
        id: 'm9c4', titulo: 'Qué pasa cuando no se logra',
        pregunta: 'Qué hacemos si el número falla dos semanas seguidas, definido en frío.',
        graba: 'El cierre del video: qué pasa si falla dos semanas seguidas, acordado EN FRÍO. Acordarlo cuando ya falló es discutir, no acordar. Y vale decir que la carta se entrega en persona: escribirla no es transferirla.',
        mismoVideoQue: 'm9c1',
      },
    ],
  },
  {
    id: 'm10', numero: 10, titulo: 'La cadencia', fase: 'build', quien: 'dueño',
    clases: [
      {
        id: 'm10c1', titulo: 'Las tres juntas',
        pregunta: 'Día, hora y participantes de la diaria de sincronización, la semanal de accountability y la mensual de rentabilidad.',
        graba: 'Las tres juntas y para qué sirve cada una. Lo que hay que dejar claro es que son tres cosas distintas y que mezclarlas es lo que convierte a la semanal en una reunión de operación.',
      },
      {
        id: 'm10c2', titulo: 'El guion de la semanal',
        pregunta: 'Rendir cuentas del compromiso, solo rojos y amarillos, despejar obstáculos, y un compromiso concreto con fecha.',
        graba: 'Los cuatro pasos de la semanal, en su propio video porque es la junta que sostiene todo el sistema. El paso que más se saltea es el último: sin compromiso con fecha, la junta fue un informe.',
      },
      {
        id: 'm10c3', titulo: 'La única métrica que importa',
        pregunta: 'Cómo vas a medir que hablás menos del 20% del tiempo en la junta semanal.',
        graba: 'El cierre del mismo video: cómo se mide que el dueño hable menos del 20% del tiempo. Vale sugerir la forma práctica —alguien que cronometre, una grabación— para que no quede como una buena intención.',
        atoro: 'Si el dueño habla más, la junta está reforzando la dependencia en vez de disolverla.',
        mismoVideoQue: 'm10c2',
      },
    ],
  },
  {
    id: 'm11', numero: 11, titulo: 'Arranque', fase: 'build', quien: 'dueño',
    clases: [
      {
        id: 'm11c1', titulo: 'Los catálogos que faltan',
        pregunta: 'Lo que no existe (productos por margen, inventario, descripciones de puesto, rangos operativos), con responsable y fecha.',
        graba: 'Por qué esto aparece recién al final: lo que falta solo se ve cuando cada palanca ya tiene nombre y hay que ir a buscar su dato. Se piden con responsable y fecha, como cualquier otro compromiso.',
        atoro: 'En TEXX se detectaron trece catálogos faltantes, cada uno bloqueando una palanca. No es trabajo de tablero: es trabajo previo que aparece al final.',
      },
      {
        id: 'm11c2', titulo: 'Las dos primeras semanas',
        pregunta: 'Qué mirar cuando el tablero empieza a recibir captura real, y qué corregir.',
        graba: 'El cierre del programa, en el mismo video que 11.1: qué mirar cuando entra la primera captura real. Y la regla de alcance, que conviene aplicar desde el arranque y no como rescate — con Patricia funcionó bajar de ocho áreas a tres; con Esquer, enfocarse en CEDIS.',
        mismoVideoQue: 'm11c1',
      },
    ],
  },
];

// -- Derivados. Nadie recuenta a mano. ---------------------------------------

/** Todas las clases, aplanadas, con su módulo al lado. */
export const CLASES: { modulo: Modulo; clase: Clase }[] =
  PROGRAMA.flatMap(modulo => modulo.clases.map(clase => ({ modulo, clase })));

export const TOTAL_MODULOS = PROGRAMA.length;
export const TOTAL_CLASES = CLASES.length;

/**
 * Una GRABACIÓN es un video. Puede cubrir varias clases.
 *
 * Es lo que Mauricio mira para saber qué le falta grabar, y por eso se DERIVA
 * en vez de listarse: una lista a mano se queda vieja el día que se agrega una
 * clase, y el síntoma sería un video que nadie sabe que falta.
 */
export type Grabacion = {
  /** El id de la clase que encabeza el video. */
  id: string;
  modulo: Modulo;
  /** Las clases que cubre, en el orden del módulo. La primera es la que encabeza. */
  clases: Clase[];
};

export const GRABACIONES: Grabacion[] = PROGRAMA.flatMap(modulo => {
  const porId = new Map<string, Grabacion>();
  const orden: string[] = [];
  for (const clase of modulo.clases) {
    const jefe = clase.mismoVideoQue ?? clase.id;
    const ya = porId.get(jefe);
    if (ya) { ya.clases.push(clase); continue; }
    // Si `mismoVideoQue` apunta a algo que no vino antes, la clase encabeza su
    // propio video en vez de desaparecer. El test es el que avisa; la pantalla
    // no puede quedarse sin mostrar una clase por un id mal escrito.
    porId.set(clase.id, { id: clase.id, modulo, clases: [clase] });
    orden.push(clase.id);
  }
  return orden.map(id => porId.get(id)!);
});

export const TOTAL_GRABACIONES = GRABACIONES.length;

/** Cuántos videos tiene un módulo. */
export function grabacionesDe(moduloId: string): Grabacion[] {
  return GRABACIONES.filter(g => g.modulo.id === moduloId);
}

/** Los cinco atoros medidos en sus cuatro clientes. Si hay que grabar de a
 *  poco, estos cinco son los que destraban; el resto se sostiene en sesión un
 *  ciclo más. Se derivan de `atoro`, no se listan a mano. */
export const CLASES_QUE_DESTRABAN = ['m1c6', 'm4c2', 'm7c1', 'm7c2', 'm8c1'] as const;

export function claseDe(id: string): { modulo: Modulo; clase: Clase } | null {
  return CLASES.find(c => c.clase.id === id) ?? null;
}

/** El rótulo que ve el cliente: «4.2 · La MCI 2, el criterio». */
export function rotuloDe(id: string): string {
  const hit = claseDe(id);
  if (!hit) return id;
  const n = hit.modulo.clases.indexOf(hit.clase) + 1;
  return `${hit.modulo.numero}.${n} · ${hit.clase.titulo}`;
}

/** Los módulos que se repiten una vez por área del cliente. Un cliente con tres
 *  áreas hace este tramo tres veces: el video es el mismo, la tarea no. */
export const MODULOS_POR_AREA = PROGRAMA.filter(m => m.porArea).map(m => m.id);
