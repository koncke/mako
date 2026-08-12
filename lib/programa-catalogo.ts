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
        puntos: [
          'Abrir por el inventario de lo que queda instalado al terminar, dicho en objetos y no en promesas: las dos MCIs, el objetivo y las palancas de cada área, la ficha de cada número, la carta de expectativas y la junta semanal con su guion. El cliente necesita ver esa lista antes de que se le pida la primera hora, porque es contra ella que va a escribir con qué frase quiere cerrar dentro de seis meses. Sin el inventario, la frase le sale como un deseo —«que el negocio crezca»— y un deseo no se puede revisar al final.',
          'Cómo se escribe esa frase de cierre para que sirva: en su voz, sobre lo que él y su equipo van a estar haciendo distinto, y con algo adentro que se pueda comprobar. Conviene decir que la respuesta se guarda y se vuelve a leer al terminar, porque saber eso cambia lo que la gente escribe. Y aclarar que no es la MCI: acá todavía nadie le está pidiendo un número con fuente y responsable, eso llega en el módulo 4.',
          'El precio en horas, con el número de frente y sin adornarlo: entre cuatro y seis horas suyas, repartidas en varios días y no en una sentada. Se piden los DÍAS además de la cantidad, porque una hora sin día en la agenda es una hora que no ocurre. Y vale avisar cuál es el tramo que más tarda: conseguir los números del bloque B, la venta y el resultado de veinticuatro meses, que casi nunca están a mano.',
          'El reparto, que es la otra mitad de la respuesta: los bloques B, C, F y H se contestan con quien tenga el dato —contabilidad, el comercial, quien lleve la gente— y esos nombres se ponen ahora, no cuando el formulario se trabe. Conviene marcar dónde termina lo que se puede pasar a otro: conseguir la cifra sí, pensar la respuesta no. Si el contador escribe la paradoja o el gerente redacta la MCI, el documento sale prolijo y no lo sostiene nadie.',
          'El atoro, con todas las letras, porque es la razón de que esta clase exista: el dueño no asume que él es el proyecto. Hoy eso se resuelve en la conversación de venta y se olvida a la semana siguiente, así que acá queda grabado y por escrito. Vale no suavizar el filtro: quien no esté dispuesto a poner esas horas conviene que lo descubra en el bloque 0 y no en el módulo 4, con medio equipo ya involucrado.',
          'Cerrar pidiendo que esas horas queden agendadas antes de pasar al bloque siguiente, como una cita y no como una intención. Es la única tarea del programa que se contesta sin buscar un solo dato, y aun así es la que decide si todo lo demás ocurre: un cliente que no logra apartar cuatro horas suyas ya contestó algo importante sobre el proyecto.',
        ],
        atoro: 'El dueño no asume que él es el proyecto. Hoy se resuelve en la venta y se olvida.',
      },
      {
        id: 'm0c2', titulo: 'Estándar no es criterio',
        pregunta: 'Una decisión de tu negocio que tiene estándar pero no tiene criterio.',
        graba: 'La distinción que sostiene el programa entero: el estándar dice qué resultado se espera; el criterio dice cómo se logra y qué hacer cuando no se logra. Va sola porque es el concepto que se cita en los once módulos siguientes.',
        puntos: [
          'La distinción en seco y con un caso del piso, porque es el concepto que se va a citar en los once módulos siguientes: el estándar dice qué resultado se espera, y el criterio dice cómo se logra y qué hacer cuando no se logra. Casi todos los negocios tienen escrito el primero y nada del segundo, y ese hueco es exactamente lo que hace que la decisión vuelva a subir al dueño.',
          'Qué decisión sirve para el ejercicio, que es lo primero que se elige mal: tiene que REPETIRSE —semanal, o al menos todos los meses— y tener que llegar hasta él. Un descuento fuera de política, una excepción de crédito, autorizar una compra, mandar a alguien a cubrir un turno. Conviene descartar en voz alta lo que no entra: una decisión grande que se toma una vez al año no sirve acá, porque no hay nada que sistematizar.',
          'Que acá va UNA sola, y decirlo antes de que se pongan a llenar de más: la tabla completa de ocho renglones se pide en el módulo 2, con estas mismas columnas. Este bloque existe para que entienda la distinción con un caso propio, no para levantar el inventario. Aclararlo ataja las dos fallas: el que se frena porque cree que le piden ocho, y el que en el módulo 2 siente que le están preguntando lo mismo dos veces.',
          'Llenar un ejemplo en vivo y mostrar dónde se seca la respuesta, que es lo que hace entender el ejercicio. «Qué resultado se espera» sale rápido y muchas veces hasta está escrito en algún manual; «cómo se logra» y «qué hacer cuando no se logra» es donde el dueño se queda callado. Vale nombrar ese silencio cuando aparezca: es el hallazgo del bloque, no una falla del cliente.',
          'Qué hacer cuando la parte difícil no sale, porque si no se dice se rellena: escribir hasta donde se llegue y marcar dónde se cortó, en vez de tapar el hueco con una generalidad del tipo «que lo resuelva con sentido común». Una respuesta a medias y honesta es material para la sesión; una redondeada esconde justo lo que el ejercicio vino a encontrar.',
          'Cerrar con la lectura del resultado, que es lo único que el cliente se tiene que llevar de esta clase: si las dos últimas no se pueden llenar, esa decisión tiene estándar y no tiene criterio, y por eso le sigue subiendo. No es un defecto del negocio ni de la persona que debería estar tomándola: es información sobre dónde falta criterio escrito, y es con eso que arranca el módulo 2.',
        ],
      },
      {
        // Comparte video con 0.1 sin estar pegada a ella: agrupar NO reordena.
        // El rótulo sale de la POSICIÓN en el módulo («0.3 · Cómo funciona cada
        // bloque») y es lo que ve el cliente en Whop y en sus mensajes, así que
        // mover una clase de lugar para juntar videos le renumera el temario.
        id: 'm0c3', titulo: 'Cómo funciona cada bloque',
        pregunta: 'Qué hacés antes de cada sesión y qué se revisa en ella.',
        graba: 'La mecánica del bucle, en el mismo video que 0.1: mirás, contestás la tarea ANTES de la sesión, se debate, y después te vuelve reescrita para que la apruebes. La tarea sin contestar es una sesión perdida.',
        puntos: [
          'La mecánica del bucle en el orden exacto en que ocurre: mira el video, contesta la tarea, y recién con la tarea contestada se agenda la sesión; ahí se debate y se corrige, y después la respuesta vuelve reescrita con lo que se habló para que él la apruebe. Lo que hay que dejar clavado es la posición de la tarea, que va ANTES y no después. Una sesión con la tarea en blanco se va entera en juntar en voz alta lo que ya tendría que estar escrito.',
          'Que la respuesta reescrita se APRUEBA y no se acepta en silencio: el documento final queda con su vocabulario, no con el de una metodología, así que si algo quedó dicho con palabras que él no usaría, ese es el momento de cambiarlo. Decirlo temprano cambia cómo contesta desde el primer bloque: si sabe que va a poder corregir después, escribe suelto en vez de tratar de dejarlo perfecto de entrada.',
          'Por qué recién ahora, con la mecánica ya explicada, se le pregunta qué NO quiere que pase durante el proceso: ya sabe cómo va a funcionar, así que puede nombrar el modo de fallar que le importa. Sirve dar el tipo de respuesta que se busca —que el equipo se entere antes de tiempo, que esto se lea como una auditoría, que quede un documento lindo y no cambie nada, que le coma la agenda en plena temporada alta—. Todo eso se puede acomodar si está dicho en el bloque 0; en el módulo 7 ya no.',
          'La diferencia con la pregunta que sigue, que si no se aclara se contestan las dos igual: «qué no quiero que pase» es sobre el proceso y se puede prevenir; «qué me preocupa» es lo que él siente y puede no ser accionable —que el equipo no aguante, que él no sostenga el cambio, que termine siendo plata tirada—. Pedir explícitamente que ésta se conteste sin filtro y sin acomodarla para el consultor: la versión editada no sirve para nada.',
          'Quién más tiene que estar de acuerdo, y por qué se pregunta tan al principio y no cuando haga falta: hay tramos que no los contesta él. El módulo 8 lo contesta el líder de cada área, los módulos 6 al 9 se repiten una vez por área, y varios bloques de números salen de quien tiene el dato. Si el socio, el director general o el gerente que va a rendir cuentas se entera en la semana seis, el programa arranca dos veces.',
          'Cerrar dejando claro que estas tres respuestas no son un trámite de bienvenida: se releen y se usan. Lo que no quiere que pase decide cómo y cuándo se le comunica cada cosa al equipo, y la lista de quién tiene que estar de acuerdo decide a quién se invita a qué sesión. Si eso no se dice, se contestan en dos líneas de compromiso y después no sirven para nada.',
        ],
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
          'Por qué esta pregunta abre el programa. Todo lo que se mide en los once módulos siguientes se cuelga de la unidad que elija acá: las palancas, los umbrales y el tablero se arman sobre ella. Elegida mal, el cliente pasa un trimestre midiendo algo que no mueve el resultado, y el error recién se ve cuando el tablero ya lleva dos meses andando.',
          'La línea de identificación que abre el formulario, que pide tres cosas juntas en un solo renglón: empresa, marca comercial y giro. Vale aclarar que la marca comercial no siempre es la razón social y que la que sirve es con la que lo conoce su cliente, porque es la que va a aparecer en el documento final y en el tablero. El giro, en las palabras del dueño y no en una categoría fiscal.',
          'Las tres opciones una por una, cada una con un ejemplo de rubro, porque el nombre solo no alcanza para que alguien se reconozca. Punto de operación es sucursales, rutas, plantas o consultorios: el mismo estándar ejecutado muchas veces al día. Oportunidad comercial son prospectos y deals que avanzan por etapas, donde el resultado depende de cuántos entran y qué porcentaje avanza. Proyecto es una obra con inicio, fin, presupuesto y fecha comprometida.',
          'El criterio para reconocer la propia, que es lo que más se discute en la sesión: es lo que SE REPITE muchas veces y determina el resultado. Conviene decir el contraejemplo en voz alta, porque despeja la mitad de las dudas: algo que cambia mucho el resultado pero pasa una vez al año no es la unidad, es una decisión.',
          'Que además del tipo hay que dar un NÚMERO, y qué se cuenta en cada caso, porque no es obvio y es donde se traba el formulario. Si son puntos de operación, cuántos hay abiertos hoy. Si son oportunidades, cuántas abiertas en promedio al mes. Si son proyectos, cuántos corren en simultáneo.',
          'El caso mixto, que conviene desarmar antes de que lo pregunten. Tener dos de las tres conviviendo es común y no es un problema; lo único que cambia es que cada línea se mide distinto. Pedir que digan qué línea se comporta como cada una, porque de ahí salen después dos juegos de indicadores y no uno.',
        ],
      },
      {
        id: 'm1c2', titulo: 'Tus áreas y quién responde',
        pregunta: 'Qué áreas existen hoy y quién rinde cuentas de cada una, con nombre y apellido.',
        graba: 'La otra mitad del mismo mapa: las áreas y el nombre y apellido de quien responde por cada una. Sin apellido no hay accountability, hay un organigrama.',
        puntos: [
          'La primera tabla se llena con las áreas COMO SON HOY, no con las que deberían existir, y tiene dos columnas: el área o función de un lado, quién responde del otro. Si una sola persona cubre tres funciones, van las tres filas con el mismo nombre repetido al lado — eso es el dato, no un error de llenado. Un organigrama aspiracional acá arruina los tres módulos que después lo usan.',
          'La segunda pregunta parece la misma y no lo es: pide nombre y apellido de quien rinde cuentas de cada área. La distinción se entiende poniendo el nombre del área y el de la persona al lado y preguntando cuál de los dos puede contestar por el número — un área nunca rinde cuentas de nada. El apellido es lo que separa a un responsable de una casilla del organigrama, y es lo que va a permitir que el módulo 9 le escriba una carta de expectativas a alguien concreto.',
          'Qué hacer con un área que no tiene dueño claro, que es el caso que frena al cliente y hace que no mande el formulario. Se escribe el área igual y se dice con todas las letras que hoy no tiene responsable. Ese hueco declarado es la mitad del valor del ejercicio: es exactamente el que reaparece como puesto faltante en el módulo 3.',
          'Que las áreas listadas acá se usan literalmente más adelante: el objetivo por área del módulo 4 se llena una vez por cada renglón de esta tabla. Conviene decirlo en las dos direcciones, porque los dos errores cuestan igual — inventar un área que no opera se paga tres módulos después llenando un objetivo vacío, y olvidarse de una deja un pedazo del negocio sin número propio.',
          'Cerrar por lo que la tabla muestra cuando el mismo nombre se repite en casi todos los renglones: eso no se comenta, se deja a la vista. Vale pedir que no lo maquillen repartiendo responsables nominales para que el cuadro se vea más sano, porque el módulo que viene arranca justo de ahí — de qué decisiones le siguen subiendo al dueño y por qué. Una tabla honesta acá ahorra medio módulo 2.',
        ],
        mismoVideoQue: 'm1c1',
      },
      {
        id: 'm1c3', titulo: 'Venta y resultado de 24 meses',
        pregunta: 'Los números mes a mes, por línea de negocio y por unidad, con la fuente de cada cifra.',
        graba: 'Qué números se piden y por qué 24 meses y no 12: con un solo ciclo no se distingue una tendencia de una estacionalidad. Y que cada cifra viaja con su fuente, porque después hay que poder discutirla.',
        puntos: [
          'Por qué veinticuatro meses y no doce, dicho antes de que el cliente vea el tamaño de la tabla y se desanime. Con un solo ciclo no hay forma de distinguir una tendencia de una estacionalidad: una caída de marzo puede ser el mercado o pueden ser todos los marzos. Media MCI se escribe mal por leer un año como si fuera una curva.',
          'La primera tabla es mes a mes, con venta y resultado, y el formulario exige un mínimo de ocho renglones. Las salidas permitidas se dicen de frente para que nadie se frene: si no está mes a mes, va trimestre a trimestre; si no tienen resultado neto, ponen el bruto y lo aclaran ahí mismo. Un número aproximado y avisado sirve; un casillero vacío, no.',
          'La segunda tabla es por línea de negocio, producto o servicio, y de cada una se piden tres cifras: cuánto vendió, qué margen deja y qué porcentaje representa de la venta total. La del porcentaje es la que más se saltea y la que decide, porque una línea con margen alto que pesa el 4% de la venta no es donde está el negocio. Ahí se ve si el margen vive en lo grande o en lo chico.',
          'La tercera tabla no pide una fila por sucursal: pide tres bloques que ya vienen escritos —las buenas, las medias y las que pierden—, cuántas unidades hay en cada uno y el rango de cada bloque. Conviene explicar para qué sirve así, porque el agrupado parece pereza y no lo es: lo que se busca es la DISPERSIÓN, y con cuarenta filas no se ve. Si las buenas y las que pierden hacen lo mismo con resultados opuestos, ahí hay una palanca.',
          'La cuarta tabla es la que nadie espera y hay que justificarla: por cada cifra dada arriba, de dónde sale, quién la calcula y si es dato duro o estimación. La última columna es la clave, y no está para desconfiar del cliente — está para que dentro de dos meses, cuando alguien discuta un número en la junta, se sepa si lo que se discute es el dato o el método con que se calculó.',
          'Cerrar con lo que pasa cuando esa tabla de fuentes queda a medias, porque es la que más se abandona: sin ella cada cifra del tablero es discutible y ninguna es corregible. Y anticipar que casi siempre aparecen dos o tres estimaciones que venían marcadas como dato duro; que aparezcan es el resultado buscado, no un fracaso del ejercicio.',
        ],
      },
      {
        id: 'm1c4', titulo: 'Qué te hace perder plata',
        pregunta: 'Los tres costos que más pesan, el punto de equilibrio, y qué unidades venden bien sin ser rentables.',
        graba: 'La cara del costo: los tres que más pesan, el punto de equilibrio, y el caso incómodo de la unidad que vende bien y no deja nada.',
        puntos: [
          'Los tres costos que más pesan van en PORCENTAJE sobre la venta y no en pesos, y conviene decir por qué: es lo único comparable entre una unidad que factura tres millones y otra que factura trescientos mil. El formulario pide tres renglones como mínimo, y aunque la tabla no lo exija, vale pedir que los ordenen de mayor a menor peso.',
          'El punto de equilibrio, con la pregunta que casi ningún dueño tiene contestada al lado: si es el mismo para todas las unidades o si cambia por tamaño. Vale insistir acá más que en el número, porque un punto de equilibrio único aplicado a unidades de tamaños distintos es lo que hace que se cierren locales que estaban bien y se sostengan otros que no.',
          'La lista de causas para las unidades que no llegan —ubicación, renta, nómina, tamaño, competencia, precio— y que se marca más de una, que es lo normal: casi siempre son dos. Hay una casilla de «Otra» para lo que no entra, pero si la marcan conviene que escriban al lado cuál es, porque una causa sin nombre no se puede atacar en ningún módulo posterior.',
          'El caso incómodo, que es el que más rinde de todo el bloque: la unidad que vende bien y aun así no deja nada. Pedir el nombre y el porqué, porque el nombre solo no sirve para nada — la respuesta útil suena a «esa renta se firmó al doble» o «ahí tenemos dos turnos completos y en las demás uno».',
          'Cerrar mostrando que las cuatro respuestas juntas ya dibujan una hipótesis del negocio. Si el costo que más pesa es la nómina, la mayoría de las que no llegan es por tamaño y la que vende bien no deja nada, el problema no está en vender más. Conviene dejarlo dicho como hipótesis y no como conclusión: se confirma en la sesión, con el cliente enfrente.',
        ],
      },
      {
        id: 'm1c5', titulo: 'Tu paradoja en una frase',
        pregunta: 'Los dos números tuyos que se contradicen.',
        graba: 'En el mismo video, el cierre: los dos números propios que se contradicen. Sale de lo que acaba de cargar, así que conviene armarla en vivo con un ejemplo.',
        puntos: [
          'Aclarar de entrada que esta clase no pide un solo dato nuevo: se contesta entera con lo que ya quedó cargado en las dos anteriores. Es la que más rápido se abandona porque parece un ejercicio de redacción, así que conviene decir para qué está — es la que convierte tres tablas en una sola frase que después se cita en cada junta del año.',
          'La cifra que no cuadra, enunciando las cuatro varas contra las que puede no cuadrar, porque nombradas se contesta y en abstracto no: el tamaño del mercado, el margen que el propio negocio reporta, el punto de equilibrio, o directamente la intuición del dueño. Esa última es una respuesta válida y hay que decirlo: «me dan los números y no me da la caja» sirve.',
          'Separar lo que cambió en los últimos doce meses en interno —precios, personal, estructura— y externo —competencia, regulación, mercado—. La razón de partirlo es concreta y conviene darla: la MCI se va a escribir sobre lo interno, porque es lo único que el equipo controla, y mezclar las dos cosas termina en un objetivo que depende del dólar o de lo que haga el de enfrente.',
          'Armar una paradoja EN VIVO con un ejemplo, porque verla construirse es lo que hace que se entienda el pedido: «crecimos 40% y ganamos menos», «vendemos más que nunca y estoy más atrapado que nunca», «abrimos cuatro unidades y el resultado por unidad bajó». Lo más útil es tomar dos números de las tablas del bloque anterior y armarla ahí, sin preparación.',
          'La regla de la frase, que es también el filtro para saber si está bien escrita: lleva DOS NÚMEROS que se contradicen. Sin números es una queja, y una queja no se puede convertir en MCI porque no tiene de dónde ni hacia dónde. Y si el cliente no consigue el segundo número, ya sabe qué le falta medir: eso va derecho a la clase de los datos que no existen.',
        ],
        mismoVideoQue: 'm1c4',
      },
      {
        id: 'm1c7', titulo: 'Quién te compite de verdad',
        pregunta: 'En qué frente pega cada competidor, si perdiste venta medible, y qué hace que un cliente te prefiera.',
        graba: 'Cómo se separa el competidor que duele del que molesta, y la diferencia entre una pérdida percibida y una medible.',
        puntos: [
          'Qué es este bloque y qué no: no es un estudio de mercado, es identificar contra quién se pierde algo concreto. La tabla tiene tres columnas —el competidor, en qué frente pega, y en qué unidades o líneas se siente— y las tres se llenan, porque una lista de nombres sin frente no le dice nada al tablero ni a la sesión.',
          'Qué cuenta como «frente», para que la columna del medio no quede vacía ni llena de generalidades: precio, servicio, ubicación, plazo de entrega. Y por qué la tercera columna es la que vuelve útil a la tabla: un competidor que pega en dos sucursales de veinte es un problema local, y uno que pega justo en la línea que más margen deja es otra cosa completamente distinta.',
          'El atoro del bloque, y conviene traerlo con todas las letras porque se repite: lo que casi siempre hay es percepción y no dato. La pregunta que los separa es si perdieron venta MEDIBLE y, si la respuesta es sí, cuánto y desde cuándo. Distinguirlo cambia la MCI entera: el trimestre se escribe sobre lo que se puede medir, y si la amenaza es percepción se ataca por otro lado y queda anotada como hipótesis a verificar.',
          'Dar vuelta la pregunta, que es de donde sale la mejor información del bloque: qué hace que un cliente los prefiera, y qué les dicen los clientes cuando los escuchan de verdad. Vale separar las dos cosas en el video, porque lo que el dueño cree que lo diferencia y lo que el cliente repite en el mostrador casi nunca coinciden, y el que sirve es el segundo.',
          'La unidad, el vendedor o el proyecto que salió notablemente mejor que el resto, y por qué esa pregunta vive acá: ésa es la escuela del sistema. Si saben POR QUÉ salió mejor, ya tienen media palanca escrita para el módulo 6; si no lo saben, queda anotado como algo que hay que ir a mirar al piso antes de inventar una explicación.',
          'Cerrar con lo que sí funcionó y quieren conservar, para que el módulo no termine siendo un inventario de lo que falta. Tiene una función práctica además de la anímica: lo que se decide conservar es lo que no se toca cuando el tablero empiece a pedir cambios, y conviene tenerlo escrito antes de que empiecen los cambios.',
        ],
        atoro: 'Casi siempre es percepción y no dato. Distinguirlo cambia la MCI: se ataca lo que se puede medir.',
      },
      {
        id: 'm1c6', titulo: 'Lo que no sabés todavía',
        pregunta: 'La lista de datos que no existen, con quién los consigue y para cuándo.',
        graba: 'La clase que da permiso a no tener el dato. Conviene grabarla en tono de alivio y no de reproche: es la que evita que el programa se frene esperando un número que nadie tiene.',
        puntos: [
          'Abrir dando permiso, y decirlo en los primeros segundos: esta clase se contesta con lo que NO tienen, y una lista de huecos es una respuesta completa, no una entrega a medias. Es la única del módulo donde la respuesta correcta puede ser que no existe ningún dato, y si eso no queda claro el cliente inventa cifras para no quedar mal.',
          'Pedir que revisen el módulo entero hacia atrás con esta pregunta en la mano: de cada cifra que se pidió —venta por línea, margen, punto de equilibrio, resultado por unidad—, cuál no existe o nadie calcula hoy. Conviene nombrar dónde suelen estar los huecos, porque es siempre el mismo lugar: el margen por línea y el resultado por unidad.',
          'Las tres columnas de la tabla y por qué son tres y no una: el dato que falta, quién debería generarlo y para cuándo. Sin un nombre y sin una fecha es una lista de deseos y no se ejecuta nunca. La fecha se pone aunque sea tentativa — una fecha que después se mueve sigue siendo un compromiso, una fecha ausente no es nada.',
          'El caso de TEXX, que es lo que vuelve creíble todo lo anterior: diecinueve días con la MCI abierta esperando una cifra de margen que nunca llegó. Declarar el hueco el primer día habría ahorrado esas tres semanas, porque la MCI se podía escribir igual con la cifra marcada como pendiente y un responsable con fecha al lado.',
          'Cerrar con la regla que hay que dejar clavada: un hueco identificado vale más que una cifra inventada. La inventada no falla ahora, falla dentro de tres meses cuando el tablero muestre un verde que nadie puede sostener — y para entonces ya nadie se acuerda de dónde salió ese número ni quién lo puso ahí.',
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
        puntos: [
          'Este ejercicio no mide lo que parece, y conviene ubicarlo antes de leer la pregunta: el criterio no se ve mirando el organigrama ni las descripciones de puesto, se ve mirando qué se rompe cuando el dueño no está. La ausencia es el reactivo del módulo entero, y por eso esta pregunta va antes que cualquier tabla.',
          'La condición exacta, que es la mitad del ejercicio: dos semanas y SIN TELÉFONO. Unas vacaciones con el celular prendido no prueban nada, porque el dueño sigue decidiendo a distancia y el criterio del equipo nunca se pone a prueba. Vale insistir en que se imagine incomunicado de verdad, porque es la parte que la gente suaviza sola.',
          'La respuesta que hay que descartar en voz alta, porque es la que va a aparecer: «se cae todo». No es una respuesta, es una manera elegante de no contestar, y además casi nunca es cierta, el negocio sigue facturando. Lo que se busca es el PRIMER nombre concreto: qué se degrada, en qué área y a los cuántos días.',
          'Cómo se llega a ese nombre sin adivinar. En vez de imaginar el escenario, conviene pedir que se acuerde de la última vez que estuvo afuera, aunque hayan sido tres días, y de qué encontró al volver. Un caso vivido gana a cualquier hipótesis y casi siempre trae el nombre ya puesto.',
          'Qué significa «se degrada», que no es lo mismo que «se detiene». Es la calidad de una decisión bajando: un plazo que se estira, un precio que se regala, una compra que se hace de más, un cliente que se queja de algo que antes no pasaba. Pedir que digan en qué se NOTA, no solo qué área se ve afectada.',
          'Cerrar dejando armado el puente hacia la tabla que viene en el mismo video: eso que se degrada primero es donde vive el criterio que nunca se escribió. La respuesta de esta clase es el primer renglón de la siguiente, así que conviene que salga con nombre y no en abstracto.',
        ],
      },
      {
        id: 'm2c2', titulo: 'Las decisiones que te suben',
        pregunta: 'Ocho renglones: la decisión, quién la toma hoy, qué resultado se espera, cómo se logra y qué hacer cuando no se logra.',
        graba: 'En el mismo video, la tabla que sale de eso. Vale la pena llenar un renglón en vivo: es la primera vez que el cliente ve el estándar y el criterio separados en columnas.',
        puntos: [
          'Enganchar con lo anterior antes de mostrar la tabla: lo que se degrada cuando el dueño falta se convierte acá en renglones. Y explicar el mínimo de ocho, porque va a doler: las primeras dos o tres salen solas y son las grandes, y recién del cuarto en adelante aparecen las chicas y repetidas, que son las que de verdad se comen la semana.',
          'Las dos primeras columnas, que parecen las fáciles y no lo son. La decisión se enuncia como decisión y no como tema —«autorizar un descuento fuera de tabulador», no «precios»— y «hoy la toma» va con nombre propio. Si el mismo nombre aparece en ocho de ocho renglones, el diagnóstico está hecho antes de llenar el resto de la tabla.',
          'La tercera columna, «qué resultado se espera», es el estándar, y conviene decir de frente que es la que cualquiera puede llenar. Que salga bien no prueba nada: es justamente la columna que ya existe en los negocios donde igual todo termina subiendo al dueño.',
          'Las dos difíciles, una por una. «Cómo se logra» es el camino y el rango dentro del cual otro puede decidir sin preguntar; «qué hacer cuando no se logra» es el plan escrito, a quién se llama y qué se sacrifica. Acá vale la pena llenar un renglón en vivo con una decisión real, porque es la primera vez que el cliente ve el estándar y el criterio separados en columnas.',
          'El atoro, con su regla: las tres últimas columnas SON el criterio, y si lo único que se puede llenar es «qué resultado se espera», esa decisión tiene estándar y no tiene criterio, y por eso sigue subiendo. Y la instrucción que evita que el cliente maquille: un renglón a medias no se borra ni se rellena de compromiso, se deja incompleto, porque el hueco ES el hallazgo.',
          'La segunda pregunta cambia de dueño y hay que decirlo fuerte: ésta NO la contesta él. Se la hace a cada responsable de área, con la pregunta tal cual —en el camino a su número, dónde se detiene porque no sabe qué decidir, o decide y después lo corrigen— y anota las respuestas TEXTUALES, una por responsable.',
          'Por qué textuales y no resumidas: al resumir, el dueño traduce la respuesta al vocabulario suyo y ahí se pierde justo la palabra que muestra dónde se traba la persona. Conviene además mandar esa pregunta antes de sentarse a llenar la tabla de arriba, porque lo que contesta el equipo casi siempre agrega renglones que él no tenía en la lista.',
        ],
        atoro: 'Las tres últimas columnas SON el criterio. Si solo podés llenar «qué resultado se espera», esa decisión tiene estándar y no tiene criterio: por eso te sigue subiendo.',
        mismoVideoQue: 'm2c1',
      },
      {
        id: 'm2c3', titulo: 'Tu agenda real',
        pregunta: 'Dos semanas medidas, no la ideal, repartidas en dirección, crecimiento, innovación, gente y operación.',
        graba: 'Por qué se piden dos semanas MEDIDAS y no la agenda ideal. La ideal ya la sabe; el ejercicio sirve por la distancia entre las dos.',
        puntos: [
          'Abrir por la restricción y sacarle el miedo: medir dos semanas no es un proyecto, es abrir el calendario de las dos semanas ya cumplidas y clasificar bloque por bloque. Si el calendario está vacío, se reconstruye hacia atrás con lo que haya —correos, llamadas, quién lo fue a buscar—, pero se reconstruye con hechos, no con recuerdo general.',
          'La primera pregunta pide nombre de ACTIVIDAD, no categoría. «Autorizar compras de las tiendas» sirve; «operación» no sirve para nada y es la forma más común de no mirar. Ayuda pedir que lo escriba como si se lo estuviera explicando a alguien que va a hacerlo en su lugar la semana que viene.',
          'Las cinco carteras una por una —dirección, crecimiento, innovación, gente y cultura, operación—, con una aclaración sobre la columna «qué incluye»: la llena el cliente con SUS actividades reales, no con la definición genérica de la cartera. Esa columna es la que después permite decidir qué se puede soltar y qué no.',
          'Por qué las horas van en dos columnas separadas y nunca promediadas. Dos semanas puestas al lado muestran si la operación es constante o si fue una semana rara, y «esa semana fue atípica» es la excusa número uno para no creerle al propio número. Con las dos columnas a la vista, la excusa se sostiene o se cae sola.',
          'La trampa de la clasificación, que arruina el ejercicio si no se nombra: una hora en la que se hicieron dos cosas se asigna a UNA sola cartera, la que la ocupó de verdad. Si cada bloque se reparte entre varias, las cinco terminan cerca del veinte por ciento y la tabla deja de decir absolutamente nada.',
          'Los dos porcentajes del cierre. El de hoy en las carteras 1 a 4 se calcula desde la tabla, no desde la intuición; el que quiere tener va con FECHA, porque sin fecha es una aspiración y con fecha es el compromiso que el final del módulo va a tener que pagar con un número.',
          'Vale cerrar bajando la exigencia de prolijidad: la agenda que sirve es la fea y verdadera. Esta tabla es la base contra la cual se va a comparar dentro de un trimestre, así que una versión maquillada hoy no ahorra vergüenza, hace inservible la comparación después.',
        ],
      },
      {
        id: 'm2c4', titulo: 'Lo que no está pasando',
        pregunta: 'La alianza que no cerraste, la línea que no lanzaste, el mercado que no exploraste.',
        graba: 'El costo de oportunidad de esa agenda, en el mismo video: lo que no ocurrió por estar donde estuvo. Es lo que le pone precio al tiempo del dueño.',
        puntos: [
          'Marcar el giro del video como tal: la tabla de la parte anterior dice dónde estuvo el tiempo, y esta parte le pone precio. El precio del tiempo del dueño no son las horas que gastó, es lo que no ocurrió en el negocio mientras las gastaba.',
          'Decir que el cuestionario marca ésta como la pregunta más importante del bloque, y por qué: las horas de la semana que viene se recuperan, la alianza que se enfrió no. Por eso se piden casos con nombre —qué alianza y con quién, qué línea, qué mercado, cuándo se cayó cada una—, porque una lista de rubros no le duele a nadie.',
          'La trampa que aparece casi siempre: contestar con un plan a futuro, del tipo «tengo que ponerme con exportación». No se pide lo que quiere hacer, se pide lo que ya NO pasó, y va en pasado. Si no aparece un solo caso en pasado, eso también es una respuesta y vale la pena discutirla en la sesión.',
          'La segunda pregunta es un cambio de silla: si el negocio corriera solo tres meses, en qué usaría ese tiempo. Y la forma en que se pide no es decorativa, se escribe como una DESCRIPCIÓN DE PUESTO: responsabilidades, con qué frecuencia se hacen y qué entrega cada una.',
          'Por qué en ese formato y no como lista de deseos: ése es el puesto al que el dueño se está mudando, y contra ese texto se va a mirar su agenda el trimestre que viene. Un párrafo motivacional no se puede auditar; una descripción de puesto sí, y por eso se escribe así desde el primer día.',
          'Cerrar leyendo las dos respuestas contra la tabla de horas de la parte anterior. Si el puesto que acaba de describir no se parece en nada a las carteras donde estuvo sus dos semanas, ahí está el hallazgo del módulo entero, y es lo que vuelve inevitable la conversación de la clase que sigue.',
        ],
        mismoVideoQue: 'm2c3',
      },
      {
        id: 'm2c5', titulo: 'Cuánto estás dispuesto a que baje',
        pregunta: 'El número que aceptás resistir mientras soltás, y por cuánto tiempo.',
        graba: 'La conversación incómoda y por eso va sola: soltar tiene un costo de corto plazo y hay que ponerle número y plazo ANTES, no cuando duela.',
        puntos: [
          'Por qué esta clase va sola y arranca incómoda: soltar tiene un costo de corto plazo, siempre, y éste es el único momento del programa en que ese costo se dice ANTES de sentirlo. Conviene nombrarlo así de entrada y no suavizarlo, porque toda la clase depende de que el cliente acepte que el costo existe.',
          'De dónde salen las filas de la tabla: de la cartera 5, la de operación, de la agenda que midió dos clases atrás, actividad por actividad. Nada se filtra antes de pasar por las preguntas, y menos las que «obviamente tengo que hacer yo», que son justamente las que el ejercicio viene a revisar.',
          'La distinción de la segunda columna, que es la que hace todo el trabajo del bloque: «solo la puedo hacer yo» contra «solo la estoy haciendo yo». Casi todo cae en la segunda, y ahí lo que sobra es el hábito, no la capacidad de nadie del equipo.',
          'La tercera columna se contesta en dos partes y las dos son obligatorias: qué es lo peor que puede pasar si lo hace otro, y si eso se puede vivir. Un riesgo nombrado y tolerable es una actividad soltable; escribir el riesgo y saltear la segunda mitad deja la decisión colgada, que es exactamente lo que pasa hoy con esa actividad.',
          'La cuarta columna, con el porqué de que sean cuatro palabras y no una: información, autoridad, habilidad o criterio se resuelven distinto. La información se manda, la autoridad se firma y es la carta de expectativas del módulo 9, la habilidad se entrena, y el criterio se construye con las columnas de la tabla de decisiones de este mismo módulo. Elegir mal la palabra es capacitar a alguien que lo que necesitaba era permiso.',
          'El número y el plazo del cierre, con la exigencia puesta: una cifra sobre un indicador propio —puntos de margen, de venta, de nivel de servicio— y una ventana con fecha de terminación, no «unos meses». Un número sin plazo no se resiste, se aguanta hasta que duele y se abandona sin que nadie lo haya decidido.',
          'El atoro, dicho con su mecánica: si esto no se define ahora, a la tercera semana todo vuelve a como estaba. Cuando el indicador baja y no había acuerdo previo, el dueño retoma la actividad y el equipo aprende que soltar era provisional, y la segunda vez ya nadie se lo cree. Acordarlo en frío es lo que convierte la caída en un costo previsto y no en una emergencia.',
        ],
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
        puntos: [
          'Dónde encaja esta clase: en el módulo 1 se listaron las áreas y quién responde por cada una, y acá se baja de área a persona. Antes de la primera columna conviene decir en voz alta que esta tabla no se comparte con el equipo, porque el cliente escribe otra cosa si duda de quién la va a leer. Sin esa aclaración, la columna de decisiones sale entera en «mantener».',
          'Las cinco columnas de la tabla, y dónde está el hallazgo: en la distancia entre «rol formal» y «qué hace realmente». Vale la pena llenar un renglón en vivo con un caso típico —el gerente cuyo rol dice operación y que en la práctica cobra, atiende quejas y arma horarios— porque hasta que no se ven las dos columnas separadas nadie cree que estén tan lejos.',
          '«Qué le sobra y qué le falta» son dos preguntas metidas en una sola celda y conviene separarlas. Lo que sobra es lo que la persona hace y no debería estar haciendo; lo que falta se nombra con el vocabulario del módulo 2: información, autoridad, habilidad o criterio. Cuál de las cuatro sea cambia la decisión de la última columna, porque la información se resuelve en una semana y el criterio lleva un año.',
          'Las cuatro decisiones posibles, dichas como lo que son: una elección por persona, no un tono general sobre el equipo. «Mantener» también se elige y hay que sostenerla; no es la casilla que queda cuando no se decidió nada. Ninguna celda de esa columna puede quedar vacía, y la que quede vacía es exactamente la persona sobre la que hay que preguntar en la sesión.',
          'La clasificación en A, B, C y D, que cruza dos cosas distintas: desempeño y compromiso con el proyecto. La B —comprometido pero todavía sin la habilidad— es donde mejor rinde la inversión, y la C —muy bueno en lo suyo y no comprometido con el proyecto— es la que más cuesta decidir. Pedir que la letra y la decisión de la columna anterior no se contradigan: un D marcado «mantener» es una conversación pendiente, no una clasificación.',
          'Los dos últimos campos parecen de trámite y son los que cierran el módulo: cuántas personas le reportan directo, y con quiénes se reúne y cada cuánto. Si reportan nueve y hay reunión fija con dos, ahí queda escrita la razón por la que las decisiones del módulo 2 le siguen subiendo. Conviene pedir la frecuencia real, la que ocurrió el mes pasado, y no la que figura en el calendario.',
        ],
      },
      {
        id: 'm3c2', titulo: 'Qué puestos faltan',
        pregunta: 'Qué haría cada uno, a quién reportaría, y si sale de adentro o se contrata.',
        graba: 'La otra mitad del mismo ejercicio, en el mismo video: el hueco que queda cuando el mapa de arriba se mira contra lo que el negocio necesita.',
        puntos: [
          'De dónde sale un puesto que falta, porque esto no se contesta con una lista de deseos. Sale de leer la tabla de la mitad anterior contra lo que el negocio necesita para sostener su número, y tiene dos fuentes concretas: lo que quedó marcado como «le sobra» a alguien, y las decisiones del módulo 2 que hoy no tienen dueño.',
          'Qué va en «qué haría»: las decisiones que ese puesto tomaría, no la lista de tareas que ejecutaría. Un puesto descrito por tareas se llena rápido y no descarga a nadie, porque las decisiones siguen subiendo al mismo lugar de siempre. Es el mismo corte entre estándar y criterio, aplicado a una silla que todavía no existe.',
          '«A quién reportaría» es la columna que delata el diseño, y conviene avisarlo antes de que la llenen: si los tres puestos que faltan reportan al dueño, el ejercicio agrandó el problema en vez de resolverlo. Un puesto nuevo que cuelga del dueño es un radio más en la misma rueda.',
          'La cuarta columna —promover desde dentro o contratar afuera— se cruza con las decisiones de la mitad anterior: quien quedó marcado «desarrollar» o «mover» es el candidato natural. Pedir el nombre aunque la persona todavía no esté lista, porque un candidato con nombre se puede preparar y un «se busca afuera» cierra la puerta antes de mirar adentro.',
          'El cierre, con dos avisos. Un puesto que hoy no se puede pagar se escribe igual, junto con lo que tendría que pasar para poder pagarlo; y a veces lo que falta no es una contratación sino partir en dos un rol que hoy junta dos funciones. Sobre esta estructura se escriben después los objetivos por área y la carta de expectativas, así que un puesto de más o de menos se paga varios módulos adelante.',
        ],
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
        puntos: [
          'Las dos preguntas que abren el módulo —el problema número uno en una frase y la única cosa que arreglarías en noventa días— no piden datos nuevos: se contestan con lo que ya quedó cargado en los módulos 1 a 3. Existen para que la MCI salga de lo que duele y no de lo que suena bien en una junta. Vale decir que si esas dos frases no apuntan al mismo lado, ahí hay una conversación pendiente antes de seguir.',
          'La fórmula de la MCI 1 tiene tres huecos y los tres son obligatorios: de dónde, a dónde y para cuándo. El que más se saltea es el tercero, y sin fecha no hay MCI, hay una intención. Conviene decir de frente que «crecer» o «mejorar el margen» no son puntos de partida: sin la cifra de hoy no hay nada contra qué marcar el año que viene.',
          'Qué cosa puede ocupar ese primer hueco, con ejemplos de negocios distintos: margen, utilidad, ingreso originado por el sistema, unidades por encima del punto de equilibrio. La regla es que sea una cifra económica del negocio entero y que sea UNA sola. Si hay dos candidatas, se queda la que el dueño ya mira todos los meses, no la más ambiciosa.',
          'La base y su dueño van en un campo aparte a propósito: de dónde sale el número de hoy y quién lo calcula, con nombre. Es el mismo par que se pidió en la tabla de fuentes del módulo 1, y acá se cobra — si la base resulta ser una estimación, la MCI 1 se está escribiendo sobre una estimación y eso hay que decirlo ahora, no cuando se discuta el marcador. Si nadie la calcula, el dato entra a la lista de lo que falta antes de entrar a la MCI.',
          'El chequeo del histórico es el que baja la meta a la tierra: ese número, ¿se logró alguna vez acá, o lo logró alguien comparable? Si la respuesta es no, la regla es bajar la cifra, y conviene explicar el porqué en vez de dejarlo como consejo. Una meta que el equipo cree imposible normaliza el rojo, y un tablero donde el rojo es lo normal deja de avisar nada.',
        ],
      },
      {
        id: 'm4c2', titulo: 'La MCI 2, el criterio',
        pregunta: '«Pasar de un equipo que ___ a un equipo que ___ para el ___».',
        graba: 'La segunda MCI va en el MISMO video que la primera, porque el error es confundirlas y el contraste es la clase. Las dos al lado, en pantalla, y el tiempo del dueño mostrado como lo que comprueba la MCI 2, no como la MCI 2.',
        puntos: [
          'Las dos MCIs van en el mismo video y en la misma pantalla, una al lado de la otra, porque el error medido no es redactar mal cada una por separado: es no distinguirlas. La 1 se juega en dinero y se marca con un reporte; la 2 se juega en lo que el equipo hace y se marca con conducta observable. Si el cliente no puede decir en voz alta cuál es cuál, no tiene sentido que pase al formulario.',
          'La pregunta que produce la MCI 2 se contesta ANTES de redactarla: qué tiene que ser cierto del equipo para que el número de la MCI 1 se sostenga el año siguiente sin el dueño encima. Conviene pedir que la escriban en prosa y sin cuidar la forma. La redacción de una línea sale casi sola cuando esa respuesta está, y sale forzada cuando no.',
          'La fórmula, con el sujeto puesto donde va: pasar de un equipo que ___ a un equipo que ___ para el ___. Los dos huecos se llenan con conductas que alguien de afuera podría ver, nunca con actitudes. «Un equipo comprometido» no se puede marcar; «un equipo que llega a la junta con su número ya cerrado», sí.',
          'El error más frecuente, y el que hay que nombrar con su caso: redactar la 2 sobre lo que el dueño deja de hacer. Un equipo no puede ganar «el director trabaja menos»; sí puede ganar adueñarse de sus números. El tiempo del dueño es el LAG que COMPRUEBA la MCI 2, no la MCI 2. Y HMO se fue al extremo espejo —escribió las dos sobre criterio— y se quedó sin ningún marcador económico.',
          'La lista de cinco verificaciones no es un adorno del cierre: se marcan las cinco antes de dar el módulo por terminado, y una de ellas mira hacia atrás, a la MCI 1, para confirmar que tiene base real con fuente y con responsable del dato. Otra corta el exceso: son dos y no tres, y si aparecieron tres se colapsan las que sirven al mismo propósito.',
          'Las dos verificaciones que más devuelven trabajo merecen detenerse. La prueba de dependencia: si se lograra la 1 sin la 2, ¿se cae al año siguiente? Si la respuesta es que no, la 2 está mal planteada y hay que volver a la pregunta del equipo. Y la de exigencia: si el equipo no cree que son alcanzables, se baja la cifra sin bajar la exigencia.',
        ],
        atoro: 'El error más frecuente: redactarla sobre lo que el dueño deja de hacer. Un equipo no puede ganar «el director trabaja menos»; sí puede ganar adueñarse de sus números. El tiempo del dueño es el LAG que comprueba la MCI 2, no la MCI 2. HMO las escribió las dos sobre criterio y se quedó sin marcador económico.',
        mismoVideoQue: 'm4c1',
      },
      {
        id: 'm4c3', titulo: 'El objetivo de cada área',
        pregunta: 'Qué sostiene, cuál es su número, su base de hoy, su fuente, quién rinde cuentas, y si el área YA lo calcula.',
        graba: 'Cómo baja cada MCI a un objetivo por área. La pregunta que decide es la última: si el área todavía no calcula ese número, el objetivo no entra en este ciclo.',
        puntos: [
          'Las filas de esta tabla ya están decididas: son las áreas que el cliente listó en el módulo 1, tal cual, sin fusionar dos para ahorrarse una fila ni agregar una que no existe. Es el momento en que se cobra aquel ejercicio, y conviene decirlo — un área inventada allá reaparece acá pidiendo un número que nadie va a poder dar.',
          'Las dos primeras columnas se llenan en ese orden y no al revés: primero qué sostiene esa área para que el negocio gane, en una línea y con verbo, y recién después cuál es el número que dirá si lo sostuvo o no. Empezar por el número da un indicador sin propósito, que es justo el que nadie defiende cuando se pone rojo en la junta.',
          'El trío del medio —base real hoy, fuente y quién rinde cuentas— es el mismo que se le exigió a la MCI 1, y por el mismo motivo. La base es la cifra medida, no el promedio que alguien recuerda; la fuente es un reporte con nombre; y quien rinde cuentas es una persona con nombre y apellido, porque un área no rinde cuentas de nada.',
          'La última columna es la que decide y conviene tratarla como tal: si el área ya calcula ese número hoy en su operación normal, o si habría que inventar un reporte. Si hay que inventarlo, el objetivo no entra en este ciclo — el tablero recibe cifras que el área ya cierra y no se convierte en sistema contable. Contestar «todavía no lo calculamos» ahí no es un fracaso: es lo que evita arrancar en rojo por falta de dato en vez de por desempeño.',
          'La pregunta de cierre da vuelta la mirada: qué área, aunque no venda nada, puede hacer que el resultado del frente se caiga. Compras, mantenimiento, sistemas o gente entran casi siempre. Ésas también necesitan número propio, y es la única justificación honesta de que un área habilitadora tenga tablero.',
          'Cerrar mostrando la trazabilidad completa: cada objetivo de área tiene que poder subir hasta una de las dos MCIs, y cada MCI tiene que tener al menos un área que la sirva. La auditoría del final del programa lo vuelve a chequear, pero encontrarlo acá cuesta corregir una fila y encontrarlo allá cuesta rehacer el tablero.',
        ],
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
        puntos: [
          'Por qué el propósito viene DESPUÉS de los números y no antes. El cliente acaba de pasar cuatro módulos midiendo, y ahora se le pide el único bloque del programa sin una sola cifra: conviene decirlo de frente para que no lo lea como el relleno blando entre dos partes serias. Lo que se junta acá es la materia prima con la que después se le habla al equipo, y por eso las ocho respuestas se escriben en párrafo y no en una línea.',
          'La primera pregunta lleva una condición que no es un adorno: si el dinero YA estuviera resuelto, por qué seguirían con esto. Sin esa cláusula la respuesta es «para ganar dinero» y el ejercicio se termina ahí mismo. Vale la pena aclarar que se contesta como se piensa, no como se redactaría una misión y visión para colgar en la recepción.',
          'Las dos que van juntas: qué construyeron acá que antes no existía en su zona o en su industria, y de qué se sienten orgullosos que un competidor grande no podría hacer ni con todo su dinero. Son la misma búsqueda desde dos lados —lo propio y lo no comprable— y conviene decirlo, porque si no el cliente cree que se le pregunta dos veces lo mismo y contesta una sola vez. La segunda es la que ordena: lo que el grande sí puede comprar, no entra.',
          'El trío del cliente, que es donde el módulo se pone concreto. Primero qué le resuelve más allá de la compra o del servicio; después un cliente REAL, con nombre; y por último qué perdería ese cliente si la empresa no existiera. El nombre no es un capricho: sin él la respuesta sale en genérico. Y la tercera verifica a la primera — si lo que perdería no se parece a lo que se dijo que resuelve, una de las dos está escrita de adorno.',
          'Las dos que miran hacia adentro y que nadie espera en un cuestionario de negocio: en qué se convierte una persona que trabaja ahí y qué se lleva aunque un día se vaya, y qué les devuelve el negocio a ellos como socios o como familia, más allá de la utilidad. Están porque el propósito tiene que sostenerse ante el equipo y ante los dueños, no solo ante el cliente. Si únicamente hay respuesta para el cliente, lo que se tiene es una promesa comercial.',
          'El cierre, que ahorra el trabajo doble: nada de esto es todavía el texto final. Son respuestas crudas y largas, y cuanto más se parezcan a cómo se habla adentro de la empresa, menos hay que corregir después. Conviene anticipar que la clase 5.4 las va a poner a prueba leyéndolas en voz alta delante del equipo imaginado.',
        ],
      },
      {
        id: 'm5c2', titulo: 'Quién es el adversario',
        pregunta: 'Concreto y medible, no abstracto, y cómo se siente eso en el piso.',
        graba: 'La segunda pieza: el adversario tiene que ser algo que se pueda señalar en el piso. «La mediocridad» no sirve; «que el cliente espere 20 minutos», sí.',
        puntos: [
          'Qué es un adversario y por qué un propósito lo necesita. No es el competidor de la esquina: es aquello contra lo que el equipo pelea todos los días y que, si desapareciera, dejaría el trabajo sin pulso. Conviene advertir de entrada el error de poner ahí el nombre de un competidor, porque eso ata el propósito de la casa a que otro siga existiendo.',
          'El filtro que decide si la respuesta sirve, y es uno solo: que se pueda señalar en el piso. «La mediocridad» o «la falta de compromiso» no pasan porque nadie puede decir si hoy ocurrieron; «que el cliente espere veinte minutos» pasa porque alguien lo puede contar esta tarde. Vale la pena tomar un adversario abstracto en vivo e irlo bajando hasta que quede algo que se cuente con un número.',
          'La segunda pregunta pide la escena, no el adjetivo: cómo se siente eso en el piso, en el día a día de la gente. Se contesta describiendo un momento de la operación —quién está, qué pasa, qué cara pone el cliente—, porque de ahí sale la frase que después el equipo reconoce como propia. Si el dueño no puede describir la escena, lo más probable es que haya elegido el adversario en el escritorio.',
          'La tercera da vuelta el mismo eje: cuál es la solución que solo este equipo puede dar. Se apoya en lo que ya salió sobre lo que un competidor grande no podría hacer, así que conviene pedir que relean esa respuesta antes de contestar esta. Lo que hay que sacar es un «solo nosotros» concreto, no un «servicio de calidad» que podría firmar cualquiera del rubro.',
          'Las tres respuestas tienen un destino concreto y conviene decirlo antes de pasar a los valores: el adversario y la solución son lo que se dice en voz alta cuando el propósito se le presenta al equipo. Por eso se escriben para ser dichas y no para ser leídas. Una frase que hay que explicar dos veces ya perdió, y eso se descubre recién en la clase de la bajada si no se avisa acá.',
        ],
        mismoVideoQue: 'm5c1',
      },
      {
        id: 'm5c3', titulo: 'Los valores como conducta',
        pregunta: 'Qué hace alguien de la casa que otro no haría, exactamente.',
        graba: 'La tercera: el valor escrito como conducta observable. Si no se puede describir qué hace la persona, no es un valor, es un cartel.',
        puntos: [
          'Conviene abrir esta parte con el contraejemplo, porque despeja el 90% de las dudas: «integridad» no es una respuesta, ya que nadie sabe qué hacer con eso el lunes a las nueve. Un valor se escribe igual que un criterio —qué hace la persona, exactamente— y cuando no se puede describir la conducta, lo que hay es una palabra para la pared.',
          'La primera pregunta trae la cláusula que la vuelve verdadera: qué no aceptarían nunca, aunque les costara ventas o aunque les pagaran por ello. Sin ese costo enfrente, cualquier cosa parece un valor. Conviene pedir el caso real en el que ya costó algo, porque un valor que nunca costó nada todavía no se probó.',
          'La segunda pide las dos mitades juntas: la conducta que exigen Y que reconocen todos los días. Separadas no sirven — lo que se exige y no se reconoce es un reglamento, y lo que se reconoce sin exigirse es una anécdota que pasó una vez. El «todos los días» es un filtro más: lo que ocurre una vez al año es una política, no un valor.',
          'La tercera es comparativa y es la que peor se contesta si el video no la explica: qué hace exactamente alguien de la casa que otro no haría con la misma tarea enfrente. Lo que se busca es un gesto o una acción con verbo —qué dice, qué revisa, a quién avisa—, nunca un adjetivo. Vale la pena resolver una en vivo, porque el primer intento casi siempre vuelve con «lo hace con más dedicación».',
          'Queda una prueba final para que la lista no salga intercambiable: si lo que se escribió podría estar colgado en la pared de cualquier otro negocio del rubro, no es lo que se pidió. Lo que sirve es lo que un empleado nuevo no adivinaría solo y alguien de la casa hace sin pensarlo.',
        ],
        mismoVideoQue: 'm5c1',
      },
      {
        id: 'm5c4', titulo: 'Cómo se lo contás al equipo',
        pregunta: 'Quién lo dice, en qué foro, con qué ritual y cómo se ancla en la junta semanal.',
        graba: 'Va solo, y es el único del módulo que necesita video propio. Tres cosas concretas: quién lo dice, en qué foro, y cómo queda anclado en la junta semanal para que no sea un anuncio de una sola vez.',
        puntos: [
          'Por qué esta clase tiene su propio video, dicho con el dato que lo respalda: el enunciado del propósito sale bien en los cuatro clientes, y lo que no ocurre solo es la bajada. Acá ya no se pule la redacción — se arma el plan de cómo eso llega a la gente, que es exactamente donde se atora el módulo.',
          'La primera tarea es una prueba física, no una reflexión: leer las respuestas en voz alta imaginando al equipo enfrente. La mitad útil es la segunda parte —qué porción no le creerían—, y es ahí donde salta el vocabulario: en Baja Teriyaki «honrar» se cambió a «consentirse» porque la primera palabra sonaba demasiado formal para hablarle al equipo. La palabra que no sobrevive a decirse en voz alta tampoco sobrevive en el piso.',
          'La segunda prueba es de crecimiento: si todo lo escrito sigue siendo verdad cuando mañana abran otra plaza, otra línea u otro formato. Está acá y no en la clase donde se redactó porque recién con el texto terminado se ve cuánto de él dependía de la operación de hoy. Un propósito que hay que reescribir en la primera apertura se lleva puesta la credibilidad del primero.',
          'La tercera pregunta pide tres cosas concretas y ninguna admite un genérico: un nombre —no «la dirección»—, un foro con ocasión y fecha, y un ritual que lo repita. Conviene marcar que un correo o un comunicado interno no cuentan como foro: lo que se pregunta es quién lo dice con la boca y delante de quiénes.',
          'La cuarta es la que evita que todo esto termine siendo un anuncio de una sola vez: dónde queda anclado en la junta semanal. Se contesta con un lugar en el orden del día, no con una intención — en qué momento de la junta aparece, quién lo trae y qué se dice ahí. Vale la pena nombrar que ésa es la junta del módulo 10, para que el cliente sepa que va a volver sobre esto.',
          'Antes de terminar conviene decir qué cuenta como tarea contestada en esta clase: un plan con nombre, foro y fecha. «Lo vamos a comunicar pronto» no es una respuesta, y es la forma exacta que toma el atoro cuando aparece — nadie discute el propósito, simplemente nunca llega a decirse.',
        ],
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
        puntos: [
          'Este módulo se contesta UNA VEZ POR ÁREA y el video es el mismo para todas, así que conviene abrirlo diciéndolo: cada líder llena su propia copia y no existe una respuesta del negocio entero. También cambia quién habla — de acá en adelante el que contesta es el responsable del área y no el dueño, y saberlo desde el primer minuto es lo que evita que el dueño termine llenando cinco formularios solo.',
          'El primer campo pide el área y UN nombre, no un puesto compartido. Vale explicar por qué se insiste acá y no más adelante: todo lo que viene después —las palancas, los umbrales, la carta de expectativas— se le cuelga a esa persona, y una responsabilidad repartida entre dos es una responsabilidad de nadie. Si hoy el área la comparten dos, hay que elegir cuál va a responder por el número, y esa decisión es del dueño, no del formulario.',
          'Las dos MCIs tienen casilla propia y se puede marcar una o las dos. Lo que hace falta aclarar es que marcar las dos sin poder explicar cómo equivale a no marcar ninguna: por eso al lado hay una línea que pide el cómo, en una sola frase. Un área que sirve a la MCI 1 mueve el número económico; una que sirve a la MCI 2 hace que el equipo se adueñe de algo que hoy le sube al dueño.',
          'El número que se movería si el área hiciera todo perfecto durante un trimestre. Se acepta aproximado —nadie tiene la cifra exacta— pero tiene que ser un número y no una intención. La ayuda del formulario lo dice sin vueltas y conviene repetirlo en el video: si eso no se puede contestar, el área todavía no tiene claro para qué existe dentro del plan, y eso es un diagnóstico útil, no una falta.',
          'La pregunta que parece secundaria y es la que sostiene el módulo entero: qué se cae en el frente que sí vende cuando esta área falla. Es lo único que justifica que sistemas, compras, mantenimiento o administración tengan tablero propio. Sin esa respuesta, el tablero termina siendo el de comercial y las áreas habilitadoras no rinden cuentas de nada.',
          'El atoro medido, y conviene ubicarlo acá y no al final: lo que destraba no es el formulario, es el contexto. Un director de HMO llegó solo con sus tres números puestos cuando su rol ya tenía una razón de existir dentro del sistema. O sea que el tiempo que se gasta explicando dónde encaja el área se recupera entero en formularios que llegan llenos.',
        ],
        atoro: 'Lo que destraba no es el formulario, es el contexto. Un director de HMO llegó solo con sus tres números puestos cuando su rol ya tenía una razón de existir dentro del sistema.',
      },
      {
        id: 'm6c2', titulo: 'Qué te está pidiendo el frente',
        pregunta: 'Lo que el área comercial u operativa le pide a esta área y no está recibiendo.',
        graba: 'En el mismo video, la mirada desde afuera: qué le está pidiendo el área de al lado y no recibe. Casi siempre es de ahí que sale la primera palanca real.',
        puntos: [
          'La segunda mitad del mismo video da vuelta el punto de vista: recién se declaró para qué existe el área según el área, y ahora se pide qué le está pidiendo el de al lado y no recibe. Las dos respuestas casi nunca coinciden, y esa distancia es el material con el que se trabaja en el resto del módulo.',
          'La instrucción que ES el ejercicio, y sin ella el campo se contesta mal: esta pregunta no la contesta el área. Se la hace el líder al gerente operativo o al responsable comercial y anota lo que le digan. Un área que se autodiagnostica los pendientes escribe los que ya sabía, que son justamente los que ya está atendiendo.',
          'Qué cuenta como respuesta: algo que el frente pide y no está recibiendo, dicho con las palabras que usó el frente. «Mejor servicio» no es un pedido; «la cotización tarda tres días y para entonces el cliente ya compró en otro lado» sí lo es, porque trae un plazo adentro y se puede convertir después en una conducta medible.',
          'Por qué esto está antes de elegir las palancas y no después: de este pedido sale casi siempre la primera palanca real del área, la que predice el resultado y que el equipo controla, que son los dos primeros filtros de la clase que sigue. Buscarla acá ahorra la ronda entera de palancas inventadas que no pasan el filtro.',
          'La advertencia práctica, porque la respuesta suele volver en tono de reproche: conviene pedir que se anote textual y que no se discuta en el papel. La defensa del área tiene su lugar en la sesión; en el formulario, un pedido corregido antes de escribirlo ya dejó de ser el pedido del frente.',
        ],
        mismoVideoQue: 'm6c1',
      },
      {
        id: 'm6c3', titulo: 'Elegir las palancas',
        pregunta: 'Máximo tres por objetivo, cada una pasando el filtro de cuatro: predice el resultado, lo controla el equipo, se mide al menos semanal, y es hoy un cuello real.',
        graba: 'El filtro de cuatro preguntas, una por una, y el máximo de tres por objetivo. Vale la pena pasar una palanca falsa por el filtro en vivo para que se vea dónde falla.',
        puntos: [
          'Arrancar por cómo se escribe una palanca, porque un enunciado flojo hace fallar el filtro por el motivo equivocado: verbo y objeto, una conducta concreta que alguien hace. «Calidad» o «servicio» son categorías, no palancas; «revisar la temperatura de la cámara en cada apertura de turno» se puede observar, medir y asignarle un responsable.',
          'El tope de tres por objetivo, dicho antes del filtro para que la lista nazca corta. Tres palancas que se hacen mueven más que ocho que se miran, y cuando aparecen ocho casi siempre es que se está listando todo lo que el área hace en vez de lo que hoy está trabado.',
          'El primer filtro es el que separa una palanca de una tarea: si se hace bien durante un mes, ¿se mueve el número de resultado? Si el área no puede decir por qué vía se movería, la relación es una suposición, y sobre una suposición se está jugando el trimestre entero.',
          'El segundo, con la prueba de la coartada que ya trae el formulario: si el responsable puede echarle la culpa a un externo —el proveedor, el clima, el corporativo—, el equipo no lo controla y no puede ser su palanca. Conviene decir que esto no es rigor por rigor: una palanca que no se controla se convierte en un rojo que nadie puede resolver, y un rojo así enseña al equipo a ignorar el semáforo.',
          'El tercero es la frecuencia: se tiene que poder medir al menos una vez por semana. Algo que solo cierra a fin de mes llega a la junta semanal sin marcador, y sin marcador la junta se vuelve una conversación sobre cómo viene el mes en vez de una rendición de cuentas.',
          'El cuarto filtro es donde está el atoro, y se entiende mucho mejor pasando una palanca falsa por los cuatro en vivo. Si la respuesta es «ya lo hacen bien», eso no es una palanca: es un estándar que ya opera. Por eso hay un campo aparte para anotarlo — no se tira, se registra como estándar y se saca del tablero, que es distinto de olvidarlo.',
          'La última pregunta cierra hacia afuera del área: si esa misma palanca ya aparece en otra con otro nombre. Cuando pasa, se queda en una sola y con el responsable que de verdad la puede mover. Dos dueños de la misma palanca es la forma más común de que no la mueva ninguno, y es una de las verificaciones que se corren al final del programa.',
        ],
        atoro: 'Si la respuesta a la cuarta es «ya lo hacen bien», eso no es una palanca: es un estándar que ya opera. Se anota y se saca del tablero.',
      },
      {
        id: 'm6c5', titulo: 'El número del área, con su base y su fuente',
        pregunta: 'El indicador consecuencia del área: su base real hoy, la meta, cada cuánto se cierra y si el área ya lo calcula.',
        graba: 'El indicador consecuencia del área: qué mide, cuál es su base real de hoy y cada cuánto se cierra. La última pregunta del formulario es la que decide si entra o no en este ciclo.',
        puntos: [
          'Abrir separando las dos cosas que el módulo viene mezclando: las palancas de la clase anterior son lo que el equipo HACE, y este número es lo que pasa como consecuencia. El primer campo pide una línea con verbo sobre qué sostiene el área para que el negocio gane, y va antes que la cifra a propósito: un número sin esa frase al lado no se puede defender en una junta.',
          'Qué hace que el número sea consecuencia y no actividad, que es donde se equivoca la mitad de las áreas. Mide el resultado del área, no cuánto trabajó: «horas de mantenimiento ejecutadas» es actividad, «paradas no programadas al mes» es consecuencia. De esa distinción depende que el tablero muestre resultado y no esfuerzo.',
          'La base real se pide en tres columnas y las tres hacen falta: la cifra, el periodo y la fuente. El periodo es el que se saltea y es el que la hace comparable —un 92% sin decir de qué mes no se puede volver a medir—, y la fuente es qué sistema o qué persona la cierra hoy.',
          'El caso de que no haya base confiable, dicho de frente para que nadie se frene ahí: la meta se escribe como hipótesis, y al lado va quién consigue el dato y para qué fecha. Es la misma salida que el programa ya le dio al dato que no existe, y funciona igual de bien acá.',
          'La frecuencia de cierre se elige entre diaria, semanal y mensual, y la elección tiene consecuencia: un número que solo cierra a fin de mes deja al trimestre con dos oportunidades menos de corregir. Conviene pedir la frecuencia que el área puede sostener de verdad, no la que suena mejor.',
          'La pregunta que decide si el número entra o no en este ciclo, y que trae el atoro: si el área no lo calcula hoy dentro de su operación normal, hay que inventar un reporte, y eso no entra ahora. El tablero recibe cifras que el área YA cierra y no se convierte en sistema contable. Si igual hay que inventarlo, se anota quién lo va a calcular y con qué herramienta, y espera al ciclo siguiente.',
          'El cierre es la pregunta de trazabilidad: a qué MCI se conecta este número y por qué vía. Es la prueba de que la matriz quedó bien armada — si no se puede rastrear desde la palanca hasta una de las dos MCIs, el área está midiendo algo suyo que el plan nunca le pidió.',
        ],
        atoro: 'Si hay que inventar un reporte para calcularlo, no entra en este ciclo. El tablero recibe cifras que el área YA cierra.',
      },
      {
        id: 'm6c4', titulo: 'La ficha de nueve campos',
        pregunta: 'Nombre con verbo y objeto, cómo se mide con numerador y denominador, frecuencia, hora de corte, unidad, verde, amarillo, rojo, y un responsable con nombre.',
        graba: 'En el mismo video, la ficha campo por campo: es CÓMO se escribe el número de arriba para que dos personas lo calculen igual. Los que se saltean son la hora de corte y el denominador, y son justo los que hacen que el dato se discuta después.',
        puntos: [
          'La ficha va en el mismo video porque es la continuación directa: arriba se decidió QUÉ se mide, acá se escribe CÓMO, para que dos personas del área lo calculen igual. Ése es el examen de la ficha y conviene plantearlo así de simple: si dos personas la calculan por separado y les da distinto, hay un campo sin llenar.',
          'El nombre otra vez con verbo y objeto, y la medición con numerador y denominador explícitos. El denominador es uno de los dos campos que todo el mundo se saltea y el que hace que el dato se discuta tres semanas después: «80% de cumplimiento» sobre qué total — los turnos del mes, los turnos abiertos, las visitas programadas.',
          'La frecuencia —diaria, por turno o semanal— y la hora de corte, que es el otro campo que se saltea. Sin una hora escrita no hay forma de decidir si algo llegó tarde, y esa discusión se va a tener igual: la única diferencia es si se tiene una sola vez ahora, en frío, o todas las semanas en la junta.',
          'La unidad de medición —por punto, por persona, por proyecto o por turno— es lo que permite comparar unidades de tamaños distintos y lo que define cómo se suma el número al tablero. Sin ella, la sucursal grande siempre va a parecer mejor que la chica y el semáforo termina premiando el tamaño.',
          'Los tres umbrales se anotan acá, pero conviene decir dónde se calibran: el módulo de umbrales es el que los fija, y ése lo contesta el líder del área. Vale adelantar la regla que más se rompe —verde, amarillo y rojo no se traslapan— para que lo que se escriba en la ficha ya venga con esa forma.',
          'El responsable es un nombre y uno solo. La ficha es lo que se lee en voz alta en la junta semanal, así que lo que diga en ese renglón es quien va a contestar cuando el semáforo esté en rojo; poner ahí un área o un equipo deja la pregunta abierta justo el día en que hay que contestarla.',
          'La última fila parece de trámite y es la que más destraba: el catálogo o el formato que hace falta para que la palanca se pueda medir. De ahí sale la lista del módulo de arranque —en TEXX fueron trece catálogos faltantes, cada uno bloqueando una palanca— y de ahí sale también la regla de la ficha: sin los nueve campos la palanca no se programa, entra al tablero marcada como pendiente de definición.',
        ],
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
        puntos: [
          'Abrir nombrando el atoro y su caso, porque el que está por contestar esto se va a trabar y conviene que sepa que es normal. Es el bloqueo número uno del programa entero: Baja Teriyaki estuvo tres semanas detenida en esta sola pregunta. Y decir por qué se traba, que no es falta de claridad ni de ganas: el cliente sabe perfecto qué quiere que pase, lo que no sabe es cómo probar que pasó.',
          'Para qué existe la evidencia, dicho antes de las opciones: es lo que permite pintar una palanca de verde sin que nadie tenga que creerle a nadie. Sin evidencia el tablero es una declaración de buenas intenciones, y la junta semanal vuelve a ser una discusión sobre si se hizo o no se hizo. Vale adelantar la regla dura acá, aunque se repita al final del módulo: sin evidencia subida va rojo, aunque el trabajo se haya hecho.',
          'Que esto se contesta POR PALANCA y no por área, que es donde el formulario se siente más largo de lo que se esperaba. Cada palanca que quedó con ficha en el módulo anterior necesita su propia forma de prueba, y no siempre es la misma para todas. Conviene decir de frente que si un área quedó con seis palancas, esto son seis respuestas, no una.',
          'Las seis formas una por una, cada una con un ejemplo de un rubro distinto, porque el nombre suelto no alcanza para que alguien elija. Foto, checklist, formulario, lectura, registro en sistema y entregable no son seis sinónimos: cambian quién la genera, cuánto cuesta y qué tan discutible es después. Al recorrerlas conviene ir diciendo cuál deja rastro sola y cuál depende de que alguien se acuerde.',
          'El criterio para elegir entre dos que parecen servir igual, que es lo que destraba de verdad: gana la que menos depende de que una persona se acuerde. Si el mismo hecho queda registrado en el sistema y además se puede fotografiar, se elige el registro. La foto es la que todos eligen primero por costumbre y es la más cara de definir bien, que es justo lo que viene después.',
          'La segunda pregunta del formulario, que es otra cosa y se confunde con la primera todo el tiempo. La evidencia prueba que la conducta ocurrió; el dato duro es de dónde sale el número que después se pinta en el semáforo, y sus opciones son otras: punto de venta, CRM, cierre contable, nómina o captura manual. Conviene separarlas en voz alta con un ejemplo donde no coincidan, porque una palanca puede probarse con una foto y medirse con lo que cierra el punto de venta.',
          'Cerrar marcando «captura manual» como la bandera amarilla del formulario. Es una opción legítima y a veces es la única que hay, pero es la que se cae a las tres semanas, y elegirla cambia el peso de la clase siguiente: cuántas veces al día, quién y cuánto tarda dejan de ser logística y pasan a ser lo que decide si esa palanca sobrevive al trimestre.',
        ],
        atoro: 'Es el bloqueo número uno de todo el programa. Baja Teriyaki estuvo tres semanas detenida en esta sola pregunta. «El cliente sabe qué quiere que pase. No sabe cómo probar que pasó.»',
      },
      {
        id: 'm7c2', titulo: 'Si es foto, de qué exactamente',
        pregunta: 'Desde qué ángulo, y qué la hace aprobada o rechazada.',
        graba: 'El caso difícil va en el MISMO video, porque separarlo parte en dos el único bloqueo grande: la foto sirve si está definido el ángulo y el criterio de aprobado. El caso de TEXX explica el límite mejor que cualquier definición.',
        puntos: [
          'Por qué la foto se lleva su propio tramo sin cortar la grabación: es la forma que casi todos eligen primero y la única que se puede llenar mal sin que se note en el momento. Una foto sin ángulo definido y sin criterio de aprobado no prueba nada; simplemente traslada la discusión de la junta al momento de mirarla. Dos personas ven la misma imagen, una la aprueba y la otra la rechaza, y no hay forma de resolverlo.',
          'Las tres cosas que el campo pide y que hay que nombrar por separado, porque el cliente contesta la primera y se olvida de las otras dos. De QUÉ es la foto, o sea el objeto concreto; DESDE QUÉ ÁNGULO, o sea el encuadre que se repite siempre igual; y QUÉ LA HACE APROBADA O RECHAZADA. Vale la pena armar una en vivo con un ejemplo de rubro, porque verla completarse es lo que hace que se entienda que las tres son obligatorias.',
          'El ángulo es el que más se saltea y el más barato de arreglar: mismo punto, misma distancia, mismo encuadre, todos los días. Si cada quien la toma desde donde le queda cómodo, las fotos no se pueden comparar entre sí ni entre unidades, y comparar es lo único que el tablero hace. Conviene sugerir que se defina de una vez con una foto de referencia, que después es lo que se le muestra a quien entra nuevo.',
          'El criterio de aprobado se escribe como algo que se ve o no se ve en la imagen, nunca como un adjetivo. «Limpio» no es criterio y va a generar discusión; una lista corta de lo que tiene que aparecer o no aparecer en la foto, sí. Es exactamente la distinción entre estándar y criterio del arranque del programa, aplicada a una imagen, y vale decirlo con esas palabras porque ya la escucharon.',
          'El caso de TEXX, que explica el límite de la foto mejor que cualquier definición: el protocolo de servicio no se podía medir porque el mystery shopper solo captura cuando hay alguien observando. Ahí la evidencia mide al observador, no al equipo. Cuando aparece un caso así, la salida no es forzar la foto: se vuelve a las seis formas y se busca una que deje rastro sin que nadie esté mirando, o se cambia la palanca por otra que sí se pueda probar.',
        ],
        atoro: 'En TEXX el protocolo de servicio no se podía medir porque el mystery shopper solo captura cuando hay alguien observando.',
        mismoVideoQue: 'm7c1',
      },
      {
        id: 'm7c3', titulo: 'Quién sube y quién valida',
        pregunta: 'Cuántas capturas por día, en qué momentos, y cuánto tarda la persona en subirla.',
        graba: 'La logística de la captura: cuántas veces al día, en qué momentos y quién valida. Va solo porque es una regla operativa con número propio, no una idea.',
        puntos: [
          'Lo que se decide en esta clase no es si la palanca es buena: eso ya quedó resuelto. Acá se define si la captura es sostenible cinco días a la semana durante un trimestre entero, con la gente que hay y en el turno que hay. Las cuatro respuestas son una regla operativa con número propio, no una intención: por eso se contestan en concreto y no «lo vamos viendo».',
          'Cuántas capturas por día y en qué momentos, y que el momento pesa tanto como la cantidad. Una captura pegada a algo que ya pasa —la apertura, el cambio de turno, el corte de caja— ocurre; una captura «durante el día» no tiene dueño horario y no ocurre. Conviene cruzarlo en voz alta con la hora de corte que ya se definió en la ficha de nueve campos, porque capturar después del corte es lo mismo que no capturar.',
          'Quién sube y quién valida, con nombre y no con puesto, y la única condición para que sean la misma persona: solo si el dato viene de un sistema. Si la misma persona genera la evidencia y la aprueba sin nada atrás que la respalde, la palanca se autocalifica y el semáforo deja de significar algo. Es la conversación incómoda de la clase y conviene tenerla acá y no cuando aparezca el primer verde discutible.',
          'Cuánto tiempo se conserva la evidencia, con el sugerido de cuatro semanas y el semáforo ya guardado. Vale explicar por qué caduca una cosa y la otra no: lo que se revisa meses después es el número, y la foto o el checklist solo hacen falta mientras la discusión esté fresca. Sin un plazo escrito, la evidencia se acumula sin criterio y nadie borra nada por miedo a borrar lo que servía.',
          'El atoro, con su número, que es la razón de que esta pregunta exista: si subir la evidencia pasa de dos minutos, no se va a hacer. Pedir que lo cronometren de verdad una vez, no que lo estimen, porque estimado siempre da menos. Y decir la consecuencia de frente para que se entienda que los dos minutos no son una comodidad: sin evidencia subida es rojo, aunque el trabajo se haya hecho.',
          'Cerrar con qué hacer cuando el cronómetro da más de dos minutos, que es lo que evita que la clase termine en culpa. No se baja la exigencia ni se le pide a la persona que se apure: se cambia la forma de evidencia. Se vuelve a las seis opciones y se elige la que deje rastro sola, aunque sea menos vistosa que la foto.',
        ],
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
        puntos: [
          'Lo primero es quién contesta: los tres umbrales los pone el LÍDER del área, y es el único módulo cuya tarea sale entera de su mano y no de la del dueño. La razón conviene darla y no darla por obvia — el umbral lo pone quien va a responder por él en la junta semanal, y un número puesto por otro no compromete a nadie. Si el dueño termina llenando los tres, el módulo se cumplió en el papel y no pasó nada en el equipo.',
          'Ubicar el ejercicio antes de la primera pregunta: los tres bloques son una sola sesión de trabajo sobre UNA palanca, y se repiten por cada área. El líder no está eligiendo qué medir, eso ya quedó decidido en el módulo 6; está poniendo los cortes del semáforo del número que su ficha ya tiene.',
          'La pregunta del piso pide un hecho, no una opinión: qué nivel se alcanzó ALGUNA VEZ. Vale la pena pedir que venga con su circunstancia —qué mes, qué turno, qué sucursal—, porque un número sin fecha es una impresión y porque el piso se usa después para discutir si el verde es realista.',
          'Traer el atoro acá, que es lo que justifica la forma de la pregunta. Preguntado como «¿cuál sería una buena meta?», el que contesta no tiene contra qué calibrar, y ante la duda no contesta nada: Patricia directamente no devolvió el archivo. Lo ya logrado, en cambio, siempre existe y se puede recordar.',
          'Qué hacer cuando ese número nunca se midió, que es la mitad de los casos: sirve el mejor caso conocido —el mejor mes, el mejor turno, la unidad que salió mejor— dicho como lo que es, una estimación. Dejarlo en blanco frena las dos preguntas que siguen, porque sin piso el verde se pone a ojo.',
          'Cerrar diciendo para qué va a servir ese número en los dos bloques siguientes: es el ancla contra la que se calibran el verde y el rojo. Es lo único empírico que el líder tiene sobre la mesa, así que si sale mal medido, los otros dos umbrales salen mal detrás de él.',
        ],
        atoro: 'El dueño no tiene referencia de qué es exigente pero posible, y ante la duda no contesta: Patricia no devolvió el archivo. Por eso la pregunta que sí funciona es esta, y no «¿cuál sería una buena meta?».',
      },
      {
        id: 'm8c2', titulo: 'Qué es exigente pero alcanzable',
        pregunta: 'Con lo que tenés hoy: sin gente nueva y sin presupuesto nuevo.',
        graba: 'El verde, con la restricción que lo hace honesto: con la gente y el presupuesto de hoy. Sin esa cláusula la meta se convierte en un pedido de recursos.',
        puntos: [
          'El verde es el nivel que el área se compromete a sostener, y la cláusula que lo hace honesto es la mitad de la pregunta: con la gente y el presupuesto de HOY. Sin ella la respuesta se convierte en un pedido de recursos —«llego a eso si me dan dos personas más»— y un umbral condicionado no se puede pintar en un tablero.',
          'Cómo se calibra contra el piso que acaban de escribir: el verde va arriba de lo que ya se logró alguna vez, nunca abajo. Si queda por debajo del piso, el área se está poniendo una meta que ya superó; si queda muy por encima sin nada que lo respalde, el tablero va a estar en rojo todas las semanas y el rojo deja de significar algo.',
          'Que el verde se escriba en la MISMA unidad y con la misma frecuencia que la ficha de la palanca: si el número se mide como porcentaje semanal por punto, el umbral va en porcentaje semanal por punto. Un umbral escrito en otra unidad no se puede comparar con el dato que llega, y eso se descubre recién cuando el tablero ya está andando.',
          'Las dos formas de errarle, que conviene nombrar porque son las que aparecen: poner de verde lo que el área ya hace todas las semanas, que no exige nada, o poner el número que le gustaría al dueño, que no lo sostiene nadie. Exigente pero alcanzable es exactamente el punto entre esas dos.',
          'Antes de pasar al rojo vale decir adónde va este número: se copia a la ficha de la palanca y se pinta cada semana en la junta, donde el líder va a tener que explicarlo. Un verde que no se puede defender en voz alta delante del equipo todavía no está listo para escribirse, y el momento de bajarlo es ahora, no la semana en que se ponga rojo.',
        ],
        mismoVideoQue: 'm8c1',
      },
      {
        id: 'm8c3', titulo: 'Cuándo se cae',
        pregunta: 'Qué tendría que pasar para que esto salga mal. Esa es la definición del rojo.',
        graba: 'El rojo se define al revés que los otros dos: no es «cuánto menos», es qué tendría que pasar para que esto salga mal. Cerrá mostrando los tres rangos juntos, ya escritos, que es cuando se ve si encajan.',
        puntos: [
          'El rojo se define al revés que los otros dos y conviene decirlo de frente: no se pregunta cuánto menos, se pregunta qué tendría que PASAR para que esto salga mal. Pedido como número sale uno arbitrario; pedido como escena aparecen las causas reales —faltó gente un turno, se cayó el sistema, no llegó el insumo— y el número sale solo de ahí.',
          'Que la respuesta puede ser una descripción y no una cifra, porque el campo pide justamente eso. Lo que hay que sacar de esa escena antes de cerrar es el valor a partir del cual el área ya no llegó: ése, y no la anécdota, es el borde del rojo.',
          'La pregunta del caso inadmisible, que es la única puerta al 100%: dónde el incumplimiento no admite rango por seguridad, por obligación legal o porque se pierde un cliente. Fuera de ahí, nada de 100% — un umbral perfecto convierte cualquier desvío normal en rojo y el equipo aprende a ignorar el color. Y si en esa área no hay ningún caso así, decir que no hay es una respuesta completa.',
          'El hueco que hay que avisar, porque nadie lo pregunta y después falta: este módulo pide el piso, el verde y el rojo, pero el AMARILLO no se pregunta en ninguna de las tres clases. Vive en la ficha de nueve campos de 6.5, que ya contestó el dueño, así que al armar los rangos hay que ir a buscarlo ahí. Si nadie lo trae, entre el verde y el rojo queda un tramo sin color.',
          'El error más común, y solo se ve cuando los tres están escritos juntos: rangos que se pisan o que dejan huecos entre uno y otro. Conviene mostrarlos en pantalla, uno debajo del otro, y verificar que cualquier valor posible caiga en un color y en uno solo.',
          'Cerrar con la prueba que termina el ejercicio: que el líder mire el número de su área de esta semana y diga de qué color está, sin dudar. Si tiene que pensarlo, los cortes todavía no están bien puestos, y corregirlos ahora es mucho más barato que hacerlo después de dos semanas de captura real.',
        ],
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
        puntos: [
          'Ubicar el documento antes de la primera pregunta: la carta es el papel donde la autoridad cambia de manos, y se escribe UNA por área, dirigida por nombre a la persona que va a responder por los números. Todo lo anterior del programa define qué se mide; esto define quién decide. Conviene decir de entrada que las cuatro secciones se llenan de corrido, porque leídas por separado parecen cuatro pedidos sueltos y no un acuerdo.',
          'Nombrar el peso de esta sección con lo que se vio en los clientes: es la parte crítica de todo el programa, y si queda vacía el tablero puede estar impecable y el líder va a seguir escalando igual. El síntoma es siempre el mismo y conviene describirlo para que se reconozcan: la junta semanal vuelve a ser el dueño resolviendo, ahora con un marcador de fondo.',
          'El primer campo pide un NÚMERO, y ahí es donde el dueño se queda mirando el techo, así que vale la pena dar el método: revisar qué autorizaciones firmó en las últimas semanas y poner el límite por encima de la mayoría de ellas. Un monto que no cubre lo que ya pasa todos los días no cambia nada, solo le pone forma escrita a la misma consulta de siempre.',
          'El segundo campo es de otra naturaleza y conviene marcar la diferencia: no es plata, es DOMINIO. Compras, contrataciones, cambios de precio, excepciones a un cliente, parar una operación. «Decisiones operativas» no es una respuesta, porque el líder no puede saber si la suya entra ahí; pedir la lista por el nombre con que cada decisión se llama adentro del negocio.',
          'El tercer campo es el que casi todos dejan en blanco y el que hace que la carta funcione un sábado: en qué situaciones aplica lo anterior. Horario, urgencia, cliente esperando en el mostrador, proveedor caído. Sin eso el líder tiene el monto y el tipo, y aun así levanta el teléfono para preguntar si este caso cuenta.',
          'Cerrar con una prueba concreta: tomar las últimas tres cosas que ese líder escaló y leerlas contra lo que acaba de escribir. Si alguna sigue necesitando una llamada, el límite quedó corto y se corrige en ese momento. Descubrirlo ahí cuesta dos minutos; descubrirlo en la junta cuesta el trimestre entero de la transferencia.',
        ],
        atoro: 'Es la sección crítica de todo el programa. Si queda vacía, el tablero puede estar perfecto y el líder va a seguir escalando: la junta semanal sigue siendo el dueño resolviendo.',
      },
      {
        id: 'm9c2', titulo: 'Qué sí te tiene que escalar',
        pregunta: 'Corto y específico. Todo lo que no esté ahí, no se escala.',
        graba: 'La contracara, y la regla que la hace funcionar: la lista es corta y cerrada, porque todo lo que no está escrito ahí no se escala.',
        puntos: [
          'La regla que hace funcionar esta sección va antes que la lista, no después: es CERRADA. Lo que no está escrito acá, no se escala. Sin esa cláusula dicha con todas las letras la lista se lee como una sugerencia y el líder sigue consultando por las dudas, que es exactamente la conducta que la carta viene a cortar.',
          'El largo importa tanto como el contenido: si la lista se estira, es la sección anterior dada vuelta y no se delegó nada. Conviene poner un tope en voz alta —tres o cuatro renglones— y exigir que cada uno se entienda sin interpretación. La vara es que un tercero pueda decidir solo si un caso entra o no entra.',
          'Qué merece estar ahí, con ejemplos de forma: lo irreversible, lo que compromete a la empresa hacia afuera —un contrato, un tema legal, la baja de un cliente grande, algo de seguridad— y todo lo que se pase del límite de gasto que acaban de escribir. Ese vínculo con la sección anterior es explícito y conviene decirlo, no darlo por entendido.',
          'La confusión que aparece siempre: escalar no es avisar. Hay cosas que el líder decide y después informa, y si eso no queda separado en el papel, termina mandando todo por mensaje y llamándole escalar. Pedir que lo digan aunque no sea un campo del formulario, porque separar las dos cosas es la mitad del alivio que el dueño está buscando.',
          'Las dos secciones se leen juntas antes de seguir, que es además la revisión que se hace después en sesión: si una decisión aparece en las dos listas o en ninguna, hay un hueco. Lo primero deja al líder con dos instrucciones contrarias; lo segundo lo deja adivinando, y el que adivina pregunta — que es exactamente la llamada que la carta venía a evitar.',
        ],
        mismoVideoQue: 'm9c1',
      },
      {
        id: 'm9c3', titulo: 'Qué le vas a dar vos',
        pregunta: 'Presupuesto, gente, capacitación y decisiones que dependen de vos, con fecha.',
        graba: 'La parte que convierte la carta en un acuerdo y no en una lista de exigencias: lo que el dueño se compromete a poner, con fecha.',
        puntos: [
          'Por qué existe esta sección y a quién le habla: al líder le acaban de pedir que responda por un número, y lo que necesita para lograrlo también tiene dueño y fecha. Conviene mostrar cómo se contesta sin inventar nada, mirando las palancas y los umbrales que ya escribieron y separando qué de todo eso depende de una firma del dueño y de nadie más.',
          'Las cuatro clases de compromiso conviene recorrerlas una por una, porque escritas en bloque salen genéricas. Presupuesto es cuánto y cuándo se libera; gente es un puesto, una contratación o alguien que se mueve de área; capacitación es qué habilidad concreta y quién la da. La cuarta son las decisiones que solo el dueño puede tomar —un precio, un contrato, un permiso— y es la que más rápido deja clavado a un líder cuando no está escrita.',
          'Cada renglón lleva FECHA, y vale la pena frenar en esto: es la única mitad de la carta que se puede incumplir sin que nadie la marque, porque el que rinde cuentas en la junta es el líder. Un compromiso del dueño sin fecha no se puede reclamar, y a los dos meses no queda ni el recuerdo de que se prometió.',
          'La trampa del entusiasmo, que aparece en la conversación de entrega: prometer ocho cosas y cumplir tres es peor que comprometer tres. Y si algo de lo que el líder pide no se puede dar, se dice en ese momento y se renegocia el umbral. Un umbral que dependía de un recurso que nunca llegó es un rojo escrito de antemano.',
          'Lo que le da sentido a escribir esta sección es cómo se usa después: en la junta semanal la lista se revisa al revés, el líder rinde cuentas de su número y el dueño rinde cuentas de estos renglones. Si nunca se revisa, en un mes es papel y el equipo aprende que la carta obliga de un solo lado.',
        ],
        mismoVideoQue: 'm9c1',
      },
      {
        id: 'm9c4', titulo: 'Qué pasa cuando no se logra',
        pregunta: 'Qué hacemos si el número falla dos semanas seguidas, definido en frío.',
        graba: 'El cierre del video: qué pasa si falla dos semanas seguidas, acordado EN FRÍO. Acordarlo cuando ya falló es discutir, no acordar. Y vale decir que la carta se entrega en persona: escribirla no es transferirla.',
        puntos: [
          'El campo pide dos cosas y casi todos contestan una sola: primero cómo se VE perder, que ya quedó definido por el umbral rojo del módulo anterior y se cuenta como dos semanas seguidas, y recién después qué pasa entonces. Sin la primera parte escrita, cada rojo empieza con una discusión sobre si de verdad se perdió.',
          'En frío quiere decir hoy, y conviene explicar el porqué en vez de dejarlo como consigna: en la junta donde el rojo ya ocurrió, cualquier consecuencia se lee como castigo personal y la conversación se va entera a las excusas. Acordado antes, lo mismo es un protocolo que se ejecuta sin que nadie tenga que ganar la discusión.',
          'Qué es una respuesta útil acá: una secuencia de pasos, no una sanción. Revisar el criterio, que el dueño acompañe un ciclo, bajar el alcance, cambiar la palanca si resultó que no predecía nada. Vale decir que la primera reacción no es mover a la persona, porque si lo es, la sección se escribe suave para no comprometer a nadie y deja de servir.',
          'Lo que también tiene que quedar escrito es qué NO pasa: un rojo no le devuelve al dueño las decisiones que acaba de soltar en la primera sección. Si un mal número reabre todo, nadie va a reportar un rojo a tiempo, y desde ese día el tablero informa lo que conviene en vez de lo que ocurre.',
          'El cierre de la carta y del video: el documento se escribe solo, entregarlo no ocurre solo. Pedir que agenden la entrega en persona con el líder en el mismo momento en que terminan de escribirla, con día puesto, y que repitan el ejercicio completo por cada área. Leerla juntos y en voz alta es donde la transferencia pasa de verdad.',
        ],
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
        puntos: [
          'Dónde cae este módulo, porque el cliente llega acá con todo construido y todavía sin usar: las palancas tienen ficha, la evidencia tiene reglas, los umbrales tienen rangos y la carta está escrita. La cadencia es lo único que hace que eso se mire una vez por semana. Sin un lugar fijo en el calendario, el tablero es un archivo que alguien abre en marzo.',
          'Las tres juntas con su propósito propio, que es lo que las hace irreemplazables entre sí: la diaria sincroniza y destraba el día, la semanal es donde se rinden cuentas del marcador, y la mensual mira la rentabilidad. Conviene decir también para qué NO sirve cada una: la diaria no decide, la semanal no resuelve, la mensual no hace seguimiento de tareas.',
          'La trampa hay que nombrarla con su síntoma, no con la teoría: cuando lo que corresponde a la diaria se cuela en la semanal, la semanal deja de ser accountability y pasa a ser operación, y nadie lo nota porque la reunión se siente productiva. La señal es simple y vale darla: si al terminar hay tareas repartidas y ningún número revisado, se corrió la junta equivocada.',
          'Que el formulario pide únicamente la SEMANAL, y una por área, conviene aclararlo antes de mandarlos a contestar. Las otras dos se explican para que la semanal no termine convirtiéndose en ellas, no porque haya que agendarlas acá. Decirlo de entrada ahorra la pregunta más repetida del módulo.',
          'El día y la hora van fijos y no movibles, y vale insistir en el nivel de detalle que se espera: día de la semana y hora concreta, no «los lunes por la mañana». Una junta que se mueve una vez se mueve siempre, y la que se movió dos veces ya no existe aunque siga puesta en el calendario.',
          'Quién asiste tiene una regla dura: solo quienes rinden cuentas de esos números. Cada persona de más es alguien que escucha en vez de responder, y es lo que estira la junta y la vuelve informativa. Conviene decir de frente que quedar afuera no es un castigo — a quien no le toca rendir cuentas se le comparte el resultado después.',
          'La duración se pide como número y trae su propia lectura diagnóstica: entre veinte y cuarenta minutos por área, y pasarse no significa que falte tiempo, significa que se está resolviendo operación en vez de rendir cuentas. Pedir que escriban el número que van a comprometer, no el que hoy duran las reuniones que ya tienen.',
        ],
      },
      {
        id: 'm10c2', titulo: 'El guion de la semanal',
        pregunta: 'Rendir cuentas del compromiso, solo rojos y amarillos, despejar obstáculos, y un compromiso concreto con fecha.',
        graba: 'Los cuatro pasos de la semanal, en su propio video porque es la junta que sostiene todo el sistema. El paso que más se saltea es el último: sin compromiso con fecha, la junta fue un informe.',
        puntos: [
          'Por qué esta junta se graba aparte: es la que sostiene el sistema entero. Todo lo que se construyó en los módulos anteriores se mira acá una vez por semana o no se mira en ningún lado. Y por eso tiene guion fijo, con los cuatro pasos siempre en el mismo orden: una junta que se improvisa termina siempre en operación.',
          'El primer paso es rendir cuentas del compromiso de la semana pasada, y la regla que lo hace funcionar es que ahí se cumplió o no se cumplió, sin explicaciones. Vale anticipar que la primera vez alguien va a querer explicarse; no es dureza, es que el porqué tiene su lugar en el tercer paso y mezclarlos disuelve el compromiso.',
          'El segundo es el marcador, y solo los rojos y los amarillos: los verdes se mencionan en una línea y se sigue. Conviene dar el porqué, porque suena injusto — repasar lo que ya funciona es exactamente lo que estira la junta a hora y media y deja los problemas para el final, cuando ya nadie tiene cabeza.',
          'El tercero es despejar obstáculos, y es donde se define quién hace qué: el líder pide, y el dueño da criterio, no soluciones. Es el paso donde el dueño recae sin darse cuenta, porque es el que más rápido resuelve. La señal para reconocerlo vale decirla en voz alta: si el dueño sale de la junta con tareas propias, el paso se corrió al revés.',
          'El cuarto es comprometer UNA acción, concreta y con fecha, y es el que más se saltea. Sin eso la junta fue un informe: se habló del marcador y no cambió nada. Además es el que cierra el bucle, porque ese compromiso es exactamente lo que se rinde en el primer paso de la semana que viene.',
          'Cerrar diciendo qué significa marcar los cuatro en el formulario, porque no es un quiz de comprensión: es comprometerse a correrla así. Si hay un paso que ya saben que no van a hacer, conviene que lo digan antes de marcarlo — se debate en la sesión, que es donde ese tipo de resistencia se resuelve y no en la primera junta real.',
        ],
      },
      {
        id: 'm10c3', titulo: 'La única métrica que importa',
        pregunta: 'Cómo vas a medir que hablás menos del 20% del tiempo en la junta semanal.',
        graba: 'El cierre del mismo video: cómo se mide que el dueño hable menos del 20% del tiempo. Vale sugerir la forma práctica —alguien que cronometre, una grabación— para que no quede como una buena intención.',
        puntos: [
          'El cambio de registro que abre el cierre del mismo video: hasta acá se explicó cómo se corre la junta, y esto es cómo se sabe si está funcionando. La métrica no mira los números del tablero ni el cumplimiento de las palancas: mira quién habla.',
          'La regla, con el número traducido a la duración que acaban de comprometer en la clase anterior: el dueño hablando menos del veinte por ciento del tiempo. En una junta de treinta minutos son seis. Vale decir de frente que es contraintuitivo, porque el dueño suele ser el que más sabe del negocio y el que más rápido llega a la respuesta.',
          'Por qué esta métrica y no otra, que es el atoro medido: si el dueño habla más, la junta está reforzando la dependencia en vez de disolverla. Todo el programa apunta a que el criterio viva en el equipo, y una junta donde el dueño explica, resuelve y decide es la prueba de que sigue viviendo en él. Es el examen final del sistema, no un consejo de facilitación.',
          'Que la pregunta del formulario no se contesta con un sí: lo que pide es CÓMO lo va a medir. Una respuesta completa trae el método y quién lo toma, porque una métrica que nadie mide en concreto es una intención y a la tercera semana ya nadie se acuerda.',
          'Las formas prácticas dichas en voz alta, para que nadie tenga que inventarlas: alguien del equipo con un cronómetro, grabar la junta y revisarla después, o una marca por turno de palabra en una hoja. Cualquiera sirve mientras deje un número que se pueda comparar con el de la semana siguiente.',
          'Qué hacer cuando la primera medición da mal, que es lo normal y conviene avisarlo: no se toca la métrica, se corrige el tercer paso del guion. Preguntar en vez de contestar y devolverle la pregunta al líder que rinde cuentas es lo que baja el porcentaje, y solo baja si el dueño se aguanta el silencio.',
        ],
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
        puntos: [
          'Cómo se encuentran, que es lo que decide si esta clase se contesta de una sentada o queda a medias: la ficha de nueve campos del módulo 6 cierra con un renglón que pregunta qué catálogo o formato hace falta para que esa palanca funcione. Conviene mandar a releer esas fichas ANTES de abrir la lista de opciones, porque ahí ya está escrita la mitad de la respuesta, palanca por palanca y con nombre propio.',
          'Separar esto de la clase 1.7 antes de que lo pregunten, porque el cliente ya contestó una lista de faltantes y si le parece la misma pregunta dos veces abandona el formulario. Allá faltaba la CIFRA —el margen que nadie calcula—; acá falta la estructura que la produce, el catálogo de productos con su margen. Una es el número que hoy no existe, la otra es de dónde va a salir todos los meses de ahora en adelante.',
          'Las nueve opciones conviene agruparlas al decirlas, porque leídas de corrido suenan a checklist de auditoría y el dueño no se reconoce en ninguna. Tres son de producto y activo —productos por margen, inventario de equipos críticos, mapeo de unidades con su clasificación—, dos son de formato —el estándar de promoción o cotización y el calendario de cierre contable— y tres son de gente —descripciones de puesto, reglas de autoridad y tabulador de sueldos—. La que queda sola es la de estándar operativo, rangos como temperaturas o tiempos de respuesta: es la que más se saltea porque suena a manual, y es justo la que hace medible media operación.',
          'El caso de TEXX va acá y conviene contarlo sin dramatismo: trece catálogos faltantes, cada uno bloqueando una palanca ya escrita. Trece no es el diagnóstico de un negocio desordenado, es lo esperable en uno que creció rápido, y aparecen recién ahora porque hasta ahora nadie había necesitado ese dato para medir algo todas las semanas. Dicho así, la lista larga deja de sentirse como un reproche y se contesta completa.',
          'Que la lista de nueve es un disparador y no un inventario cerrado: no tiene casilla de «otro», así que lo que falte y no esté ahí se escribe igual en la primera columna de la tabla, que es texto libre. Vale decirlo de frente, porque si no el cliente asume que lo que no está listado no cuenta, y lo que se pierde es justo el catálogo propio de su rubro, que suele ser el que más bloquea.',
          'Las tres columnas de la tabla y el criterio que hace útil la fecha: no es «cuando se pueda», es antes de que la palanca que depende de ese catálogo empiece a medirse, porque si no el tablero arranca con un indicador que nadie puede calcular. Y quien lo genera casi nunca es el líder que rinde cuentas del número: conviene pedir el nombre de quien tiene el dato, aunque sea de otra área, porque esto es trabajo previo y no trabajo de tablero.',
        ],
        atoro: 'En TEXX se detectaron trece catálogos faltantes, cada uno bloqueando una palanca. No es trabajo de tablero: es trabajo previo que aparece al final.',
      },
      {
        id: 'm11c2', titulo: 'Las dos primeras semanas',
        pregunta: 'Qué mirar cuando el tablero empieza a recibir captura real, y qué corregir.',
        graba: 'El cierre del programa, en el mismo video que 11.1: qué mirar cuando entra la primera captura real. Y la regla de alcance, que conviene aplicar desde el arranque y no como rescate — con Patricia funcionó bajar de ocho áreas a tres; con Esquer, enfocarse en CEDIS.',
        puntos: [
          'Abrir diciendo qué es esta pasada, porque no se parece a nada de lo anterior: no se produce nada nuevo, se lee hacia atrás la matriz completa —las dos MCIs, las áreas, los objetivos, las palancas y los responsables— y se marca cada una de las seis fallas que aparezca. Marcar una casilla es declarar «esto me está pasando», no reprobar un examen: encontrarla acá cuesta una tarde, encontrarla con el tablero andando cuesta el ciclo entero.',
          'Las tres primeras verificaciones miran que todo cuelgue de algún lado. Un área sin ningún objetivo vinculado a una MCI está trabajando para algo que el negocio nunca declaró importante. Una MCI sin ninguna área que la sirva no tiene quién la mueva, y es la que se cae sola sin que nadie sea el culpable. Y un objetivo con más de tres palancas rompe el máximo del módulo 6, que no es un capricho: con cinco palancas el equipo no corre ninguna.',
          'Las otras tres son de responsabilidad y de duplicación. La palanca repetida en dos áreas con distinto nombre se resuelve dejándola en una sola, con quien de verdad la puede mover. El responsable al que se le mide algo que no tiene autoridad para mover no se arregla en el tablero: se arregla en la carta de expectativas del módulo 9, y conviene decirlo así de explícito. Y el área habilitadora crítica sin objetivo propio es la que no vende pero puede tumbar el frente.',
          'Qué mirar cuando entra la primera captura real, que es lo que nadie sabe de antemano: las dos primeras semanas se mira quién SUBE la evidencia, no de qué color da el número. Un rojo por evidencia no subida y un rojo por desempeño se ven idénticos en la pantalla y se corrigen al revés — el primero se arregla simplificando la captura, el segundo se lleva a la junta semanal. Confundirlos es cómo se termina retando a alguien que hizo el trabajo.',
          'Qué sí se corrige en esa ventana y qué deja de tocarse después: la hora de corte, el denominador y los umbrales que quedaron con traslape se ajustan ahora, con el dato real a la vista, y se ajustan una sola vez. Pasadas las dos semanas, mover un umbral deja de ser calibrar y pasa a ser correr la portería, que es exactamente cómo un tablero deja de significar algo para el equipo que lo mira.',
          'El alcance, con los dos casos y el criterio para elegir: bajar de ocho áreas a tres funcionó con Patricia y enfocarse en CEDIS funcionó con Esquer, pero en los dos llegó tarde, como rescate. Se arranca por donde YA hay dato y hay alguien con autoridad para mover el número, no por las áreas más importantes. Y las que quedan afuera no se cancelan, entran en el ciclo siguiente: decirlo así es lo que evita que el recorte se lea como que esa área no importa.',
          'El programa cierra por donde arrancó, contra el inventario que se prometió en el bloque 0: lo que quedó instalado no es el tablero, es que cada número tenga dueño, tenga evidencia y tenga una junta donde se rinden cuentas de él. Y conviene dejar dicha cuál es la señal de que está andando, porque no es la que el cliente espera. Si a las dos semanas hay amarillos pero la junta ocurrió las dos veces y salió con un compromiso concreto con fecha, el sistema funciona y el color se acomoda solo.',
        ],
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
