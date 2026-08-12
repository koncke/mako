// =============================================================================
// programa-campos — LAS PREGUNTAS de verdad, una por una
// =============================================================================
// `lib/programa-catalogo.ts` tiene la ESTRUCTURA del programa (12 módulos, 42
// clases) y una línea por clase que resume qué hay que contestar. Esto es el
// FORMULARIO: los campos concretos que el cliente completa en cada bloque.
//
// DE DÓNDE SALE, y por qué importa: de los dos Cuestionarios Maestros de
// Mauricio Bustos —el de Norte Estratégico (bloques A a J) y el de Objetivos,
// Palancas y Umbrales (bloques 0 a 8)—. Cada campo lleva su `origen` con el
// código de la pregunta original (A5, D2, 5.1…) para poder auditar que no se
// perdió ninguna y que ninguna quedó preguntada dos veces.
//
// ⚠️ EL `label` ES TEXTUAL DE MAURICIO, y va en TUTEO mexicano («contesta»,
// «tienes»), no en el voseo de MaKo. No es un descuido: acá MaKo no habla. Es
// Mauricio preguntándole a SU cliente, con sus palabras — y su propio
// cuestionario dice la regla: «el documento final se escribe con tu vocabulario,
// no con el de una metodología».
//
// LAS TABLAS SON TABLAS. D2 («mínimo ocho renglones»), E4 (las cinco carteras),
// E6, F1, G6, el filtro de cuatro y la ficha de nueve campos no son un párrafo:
// tienen columnas con nombre, y algunas tienen filas fijas. Aplanarlas a un
// textarea era perder justamente la estructura que hace que la respuesta sirva.
//
// SIN `server-only` a propósito: lo renderiza el formulario del cliente, que es
// un client component, y lo miran los tests.
// =============================================================================

/** Qué se le pide al cliente en un campo.
 *
 *  `linea` vs `texto` no es cosmético: un campo de una línea le dice «esto se
 *  contesta corto» y un párrafo le dice «acá hay que pensar». El cuestionario
 *  distingue las dos cosas todo el tiempo. */
export type TipoCampo = 'texto' | 'linea' | 'numero' | 'eleccion' | 'checks' | 'tabla';

export type Campo = {
  /** Único DENTRO de la clase. Es la clave con la que se guarda la respuesta,
   *  así que NO se renombra: renombrarlo pierde lo que el cliente ya escribió. */
  id: string;
  /** La pregunta, textual del cuestionario. */
  label: string;
  tipo: TipoCampo;
  /** La aclaración que el cuestionario da debajo. Solo donde existe. */
  ayuda?: string;
  /** Para `eleccion` y `checks`. */
  opciones?: string[];
  /** Para `tabla`: los encabezados, en orden. */
  columnas?: string[];
  /** Para `tabla` con filas predefinidas: el contenido de la primera columna. */
  filasFijas?: string[];
  /** Mínimo de renglones que el cuestionario exige. */
  filasMin?: number;
  obligatorio?: true;
  /** El código de la pregunta original. Es lo que permite auditar la cobertura. */
  origen: string;
};

/** claseId → sus campos. */
export const CAMPOS: Record<string, Campo[]> = {
  m0c1: [
    { id: "frase-de-cierre", label: "¿Qué esperas de este trabajo para considerarlo un éxito? Con qué frase te gustaría cerrar dentro de seis meses.", tipo: "texto", obligatorio: true, origen: "J1" },
    { id: "horas-que-apartas", label: "¿Cuántas horas tuyas vas a apartar para contestar esto, y en qué días?", tipo: "linea", ayuda: "Entre cuatro y seis horas repartidas en varios días. La parte que más tarda es conseguir los números del bloque B.", obligatorio: true, origen: "Cómo contestarlo · Cuánto" },
    { id: "quien-consigue-los-datos", label: "Los bloques B, C, F y H se reparten con quien tenga el dato. ¿Con quién?", tipo: "texto", ayuda: "Se vale delegar la recolección, no la reflexión.", obligatorio: true, origen: "Cómo contestarlo · Quién" },
  ],
  // ⚠️ La tabla D2 completa NO va acá: vive en m2c2 («Las decisiones que te
  // suben»), que es su bloque. Acá el ejercicio es entender la DISTINCIÓN entre
  // estándar y criterio con UN ejemplo, no llenar la tabla de ocho renglones dos
  // veces. Un test lo fija: la misma pregunta en dos bloques es la forma más
  // rápida de que el cliente abandone el formulario.
  m0c2: [
    { id: "decision-que-te-sube", label: "Escribe UNA decisión que se repite en tu negocio y que te sigue subiendo a ti.", tipo: "linea", obligatorio: true, origen: "D2-ejemplo" },
    { id: "que-resultado-se-espera", label: "De esa decisión: ¿qué resultado se espera?", tipo: "texto", obligatorio: true, origen: "D2-ejemplo-estandar" },
    { id: "como-se-logra-y-que-hacer-si-no", label: "Ahora la parte difícil: ¿cómo se logra, y qué hacer cuando no se logra?", tipo: "texto", ayuda: "Estas dos son el criterio. Si no las puedes llenar, esa decisión tiene estándar y no tiene criterio, y por eso sigue subiendo a ti.", obligatorio: true, origen: "D2-ejemplo-criterio" },
  ],
  m0c3: [
    { id: "que-no-quieres-que-pase", label: "¿Qué no quieres que pase durante el proceso?", tipo: "texto", obligatorio: true, origen: "J2" },
    { id: "que-te-preocupa", label: "¿Qué te preocupa? Sin filtro.", tipo: "texto", obligatorio: true, origen: "J3" },
    { id: "quien-mas-tiene-que-estar-de-acuerdo", label: "¿Quién más en tu empresa tiene que estar de acuerdo con esto para que funcione?", tipo: "texto", obligatorio: true, origen: "J4" },
  ],
  m1c1: [
    { id: "empresa-marca-giro", label: "Nombre de la empresa, marca comercial y giro en una sola línea.", tipo: "linea", obligatorio: true, origen: "A1" },
    { id: "unidad-que-se-repite", label: "¿Qué cosa se repite muchas veces en tu negocio y determina el resultado? Elige una:", tipo: "eleccion", opciones: ["Un punto de operación. Tiendas, sucursales, rutas, plantas, consultorios, unidades de servicio. El mismo estándar se ejecuta muchas veces al día.", "Una oportunidad comercial. Prospectos y deals que avanzan por etapas hasta cerrar. El resultado depende de cuántos entran y qué porcentaje avanza.", "Un proyecto o una obra. Trabajos con inicio, fin, presupuesto y fecha comprometida."], obligatorio: true, origen: "A2" },
    { id: "cuantas-unidades", label: "¿Cuántas de esas unidades tienes hoy?", tipo: "numero", ayuda: "Si son puntos de operación, cuántos. Si son oportunidades, cuántas abiertas en promedio al mes. Si son proyectos, cuántos simultáneos.", obligatorio: true, origen: "A3" },
    { id: "conviven-dos-arquetipos", label: "¿Conviven dos de las tres anteriores en tu negocio? Si sí, ¿qué línea se comporta como cada una?", tipo: "texto", ayuda: "Es común y no es un problema, pero cambia cómo se mide cada línea.", origen: "A4" },
  ],
  m1c2: [
    { id: "areas-y-responsables", label: "Lista las áreas o funciones que existen hoy, aunque una persona cubra varias. Al lado, quién responde por cada una.", tipo: "tabla", columnas: ["Área o función", "Quién responde"], obligatorio: true, origen: "A5" },
    { id: "quien-rinde-cuentas", label: "¿Quién rinde cuentas hoy de cada área? Nombre y apellido. Si hay áreas sin dueño claro, dilo.", tipo: "texto", obligatorio: true, origen: "F3" },
  ],
  m1c3: [
    { id: "venta-y-resultado-24-meses", label: "Venta y resultado de los últimos veinticuatro meses, mes a mes o al menos trimestre a trimestre.", tipo: "tabla", ayuda: "Si el resultado neto no lo tienes, pon el bruto y dilo.", columnas: ["Mes o trimestre", "Venta", "Resultado"], filasMin: 8, obligatorio: true, origen: "B2" },
    { id: "por-linea-de-negocio", label: "Por cada línea de negocio, producto o servicio principal: cuánto vendió, qué margen deja y qué porcentaje de la venta total representa.", tipo: "tabla", columnas: ["Línea de negocio, producto o servicio", "Cuánto vendió", "Qué margen deja", "% de la venta total"], obligatorio: true, origen: "B3" },
    { id: "resultado-por-unidad", label: "Resultado por unidad. Si son muchas, agrúpalas en tres bloques: las buenas, las medias y las que pierden. Cuántas hay en cada bloque y cuál es el rango.", tipo: "tabla", columnas: ["Bloque", "Cuántas hay", "Rango"], filasFijas: ["Las buenas", "Las medias", "Las que pierden"], obligatorio: true, origen: "B4" },
    { id: "fuente-de-cada-cifra", label: "Por cada cifra que diste arriba: ¿de dónde sale y quién la calcula? Marca cuáles son dato duro y cuáles son estimación.", tipo: "tabla", columnas: ["Cifra", "De dónde sale", "Quién la calcula", "¿Dato duro o estimación?"], obligatorio: true, origen: "B11" },
  ],
  m1c4: [
    { id: "tres-costos-que-mas-pesan", label: "Los tres costos que más pesan, con su porcentaje sobre la venta.", tipo: "tabla", columnas: ["Costo", "% sobre la venta"], filasMin: 3, obligatorio: true, origen: "B7" },
    { id: "punto-de-equilibrio", label: "¿Cuál es el punto de equilibrio? ¿Es igual para todas las unidades o cambia por tamaño?", tipo: "texto", obligatorio: true, origen: "B8" },
    { id: "que-las-hace-perder", label: "De las que no llegan al punto de equilibrio, ¿qué las hace perder?", tipo: "checks", opciones: ["Ubicación", "Renta", "Nómina", "Tamaño", "Competencia", "Precio", "Otra"], obligatorio: true, origen: "B5" },
    { id: "venden-bien-y-no-son-rentables", label: "¿Hay unidades que venden bien y aun así no son rentables? ¿Cuáles y por qué?", tipo: "texto", obligatorio: true, origen: "B6" },
  ],
  m1c5: [
    { id: "cifra-que-no-cuadra", label: "¿Qué cifra que ustedes manejan no cuadra? Contra el tamaño del mercado, contra el margen que reportan, contra el punto de equilibrio, o simplemente contra su intuición.", tipo: "texto", obligatorio: true, origen: "B1" },
    { id: "que-cambio-en-doce-meses", label: "¿Qué cambió en los últimos doce meses? Separa lo interno, precios, personal, estructura, de lo externo, competencia, regulación, mercado.", tipo: "texto", obligatorio: true, origen: "B9" },
    { id: "la-paradoja", label: "Ahora escribe la paradoja en una frase, usando dos números que se contradicen.", tipo: "linea", ayuda: "Ejemplos de la forma: «crecimos X y ganamos menos», «vendemos más que nunca y estoy más atrapado que nunca», «abrimos N unidades y el resultado por unidad bajó».", obligatorio: true, origen: "B10" },
  ],
  // Bloque C del Cuestionario de Norte. Estaba ENTERO sin clase donde ir: el
  // programa no tenía un bloque de mercado y competencia, así que las cinco
  // preguntas se habrían perdido. Lo encontró la auditoría de cobertura.
  m1c7: [
    { id: "quien-te-compite", label: "¿Quién te compite de verdad, en qué frente pega cada uno y en qué unidades o líneas se siente?", tipo: "tabla", columnas: ["Competidor", "En qué frente pega", "En qué unidades o líneas se siente"], obligatorio: true, origen: "C1" },
    { id: "perdida-medible-o-percepcion", label: "¿Has perdido venta de forma medible o es percepción? Si es medible, cuánto y desde cuándo.", tipo: "texto", obligatorio: true, origen: "C2" },
    { id: "por-que-te-prefieren", label: "¿Qué hace que un cliente te prefiera? ¿Qué te dicen los clientes cuando los escuchas?", tipo: "texto", obligatorio: true, origen: "C3" },
    { id: "el-que-salio-mejor", label: "¿Hay una unidad, un vendedor o un proyecto que salió notablemente mejor que el resto? ¿Sabes por qué?", tipo: "texto", ayuda: "Esa es la escuela del sistema.", obligatorio: true, origen: "C4" },
    { id: "lo-que-si-funciono", label: "¿Qué han hecho que sí funcionó y quieren conservar?", tipo: "texto", obligatorio: true, origen: "C5" },
  ],
  m1c6: [
    { id: "datos-que-no-existen", label: "Datos que no existen o que nadie calcula hoy y que harían falta para medir lo del bloque G. Por cada uno: quién debería generarlo y para cuándo.", tipo: "tabla", columnas: ["Dato que falta", "Quién debería generarlo", "Para cuándo"], obligatorio: true, origen: "H1" },
  ],
  m2c1: [
    { id: "que-se-degrada-primero", label: "Si desapareces dos semanas sin teléfono, ¿qué se degrada primero? Sé específico.", tipo: "texto", obligatorio: true, origen: "D1" },
  ],
  m2c2: [
    { id: "decisiones-que-te-suben", label: "Llena esta tabla con las decisiones que te suben cada semana y que alguien más debería estar tomando. Mínimo ocho renglones.", tipo: "tabla", ayuda: "Las últimas tres columnas son el criterio. Si solo puedes llenar la tercera, esa decisión tiene estándar pero no tiene criterio, y por eso sigue subiendo a ti.", columnas: ["Decisión que se repite", "Hoy la toma", "Qué resultado se espera", "Cómo se logra", "Qué hacer cuando no se logra"], filasMin: 8, obligatorio: true, origen: "D2" },
    { id: "donde-se-detiene-tu-equipo", label: "Esta se la haces a tu equipo, no la contestes tú. Pregúntale a cada responsable de área: «en tu camino a tu número, ¿en qué punto te detienes porque no sabes qué decidir, o decides y luego te corrigen?». Anota las respuestas textuales.", tipo: "tabla", columnas: ["Responsable de área", "Respuesta textual"], obligatorio: true, origen: "D3" },
  ],
  m2c3: [
    { id: "que-te-quita-mas-tiempo", label: "¿Qué te quita más tiempo hoy? Con nombre de actividad, no en categorías.", tipo: "texto", obligatorio: true, origen: "E1" },
    { id: "agenda-real-dos-semanas", label: "Registra dos semanas de tu agenda real, no la ideal, y clasifica cada bloque en una de estas cinco carteras:", tipo: "tabla", columnas: ["Cartera", "Qué incluye", "Horas semana 1", "Horas semana 2"], filasFijas: ["1 · Dirección", "2 · Crecimiento", "3 · Innovación", "4 · Gente y cultura", "5 · Operación"], obligatorio: true, origen: "E4" },
    { id: "porcentaje-carteras-1-a-4", label: "¿Qué porcentaje de tu tiempo está hoy en las carteras 1 a 4? ¿Qué porcentaje quieres tener y para cuándo?", tipo: "linea", obligatorio: true, origen: "E5" },
  ],
  m2c4: [
    { id: "lo-que-no-esta-pasando", label: "¿Qué no está pasando en tu negocio porque tú no tuviste tiempo de hacerlo? La alianza que no cerraste, la línea que no lanzaste, la conversación que no tuviste, el mercado que no exploraste.", tipo: "texto", ayuda: "Esta es la pregunta más importante del bloque.", obligatorio: true, origen: "E2" },
    { id: "descripcion-de-tu-puesto", label: "Si el negocio corriera solo tres meses, ¿en qué usarías ese tiempo? Escríbelo como si fuera la descripción de tu puesto.", tipo: "texto", obligatorio: true, origen: "E3" },
  ],
  m2c5: [
    { id: "actividades-de-la-cartera-5", label: "Por cada actividad recurrente de la cartera 5, contesta tres cosas:", tipo: "tabla", columnas: ["Actividad", "¿Solo la puedes hacer tú, o solo la estás haciendo tú?", "Si la hiciera otro, ¿qué es lo peor que puede pasar y lo puedes vivir?", "¿Qué le falta a esa persona: información, autoridad, habilidad o criterio?"], obligatorio: true, origen: "E6" },
    { id: "cuanto-estas-dispuesto-a-resistir", label: "Si soltar una actividad hace que el resultado baje temporalmente, ¿lo aceptas? Pon el número que estás dispuesto a resistir y por cuánto tiempo.", tipo: "linea", ayuda: "Si no lo defines ahora, a la tercera semana todo regresa a como estaba.", obligatorio: true, origen: "E7" },
  ],
  m3c1: [
    { id: "personas-clave", label: "Por cada persona clave, llena esta tabla.", tipo: "tabla", ayuda: "Sé honesto, este documento no se comparte con ellos.", columnas: ["Nombre", "Rol formal", "Qué hace realmente", "Qué le sobra y qué le falta", "Decisión: desarrollar, mover, sustituir, mantener"], obligatorio: true, origen: "F1" },
    { id: "clasificacion-abcd", label: "Clasifica a cada uno en una de estas cuatro categorías:", tipo: "texto", ayuda: "A. Alto desempeño y alto compromiso con el proyecto. B. Comprometido pero todavía sin la habilidad. Es la mejor inversión. C. Muy bueno en lo que hace pero no comprometido con el proyecto. D. Ni desempeño ni compromiso.", obligatorio: true, origen: "F2" },
    { id: "reportes-directos", label: "¿Cuántas personas te reportan directo?", tipo: "numero", origen: "F5" },
    { id: "con-quienes-te-reunes", label: "¿Con quiénes te reúnes y con qué frecuencia hoy?", tipo: "texto", origen: "F5" },
  ],
  m3c2: [
    { id: "puestos-que-faltan", label: "¿Qué puestos faltan? Por cada uno: qué haría, a quién reportaría, y si crees que se puede promover desde dentro o hay que contratar afuera.", tipo: "tabla", columnas: ["Puesto que falta", "Qué haría", "A quién reportaría", "¿Se puede promover desde dentro o hay que contratar afuera?"], obligatorio: true, origen: "F4" },
  ],
  m4c1: [
    { id: "problema-numero-uno", label: "¿Cuál es hoy el problema número uno del negocio, en una frase?", tipo: "linea", origen: "G1" },
    { id: "una-sola-cosa-en-90-dias", label: "Si pudieras arreglar una sola cosa en noventa días, ¿cuál sería?", tipo: "linea", origen: "G2" },
    { id: "numero-del-ano", label: "El número del año. Completa: \"pasar de ___ a ___ para el ___\".", tipo: "linea", ayuda: "Puede ser margen, utilidad, ingreso originado por el sistema, tiendas sobre punto de equilibrio, lo que corresponda a tu negocio.", obligatorio: true, origen: "G3 · B0.1" },
    { id: "base-y-quien-la-calcula", label: "Anota de dónde sale la base y quién la calcula.", tipo: "linea", obligatorio: true, origen: "G3" },
    { id: "historico-respalda-el-numero", label: "¿El histórico respalda ese número? ¿Lo lograste alguna vez o lo logró alguien comparable?", tipo: "texto", ayuda: "Si no, bájalo. Una meta que el equipo cree imposible normaliza el rojo.", origen: "G4" },
  ],
  m4c2: [
    { id: "que-tiene-que-ser-cierto-del-equipo", label: "¿Qué tiene que ser cierto de tu equipo para que ese número se sostenga el año siguiente sin ti?", tipo: "texto", obligatorio: true, origen: "G5" },
    { id: "mci-2-redaccion", label: "Escríbelo como \"pasar de un equipo que ___ a un equipo que ___ para el ___\".", tipo: "linea", obligatorio: true, origen: "G5 · B0.2" },
    { id: "verificacion-de-las-dos-mcis", label: "Verificación. Marca cada una:", tipo: "checks", opciones: ["¿La MCI 2 está redactada sobre lo que el equipo se adueña, y no sobre lo que el dueño deja de hacer? Un equipo no puede ganar \"el director trabaja menos\".", "¿La MCI 1 tiene base real, con fuente y con responsable del dato?", "¿Son dos y no tres? Si hay tres, colapsa las que sirven al mismo propósito.", "¿El equipo cree que son alcanzables? Si no, se baja la cifra sin bajar la exigencia.", "¿Si se logra la 1 sin la 2, se cae al año siguiente? Si la respuesta es no, la 2 está mal planteada."], origen: "B0.3" },
  ],
  m4c3: [
    { id: "objetivo-por-area", label: "Por cada área que listaste en A5, llena esta tabla:", tipo: "tabla", ayuda: "La última columna importa. Si el área no lo calcula hoy, no se puede exigir la semana que entra.", columnas: ["Área", "Qué sostiene para que el negocio gane", "Su número", "Base real hoy", "Fuente", "Quién rinde cuentas", "¿El área ya lo calcula hoy?"], obligatorio: true, origen: "G6" },
    { id: "area-que-tumba-el-frente", label: "¿Qué área, aunque no venda, puede hacer que el resultado del frente se caiga?", tipo: "texto", ayuda: "Esas también necesitan número propio.", origen: "G7" },
  ],
  // El origen — de dónde viene el negocio.
  m5c1: [
    { id: "por-que-seguirian", label: "Si el dinero ya estuviera resuelto, ¿por qué seguirían con esto?", tipo: "texto", origen: "I1" },
    { id: "que-construyeron-aqui", label: "¿Qué construyeron aquí que antes no existía en su zona o en su industria?", tipo: "texto", origen: "I2" },
  ],
  // El PAS y la narrativa — el propósito grandote y el contexto contra el que se recorta.
  m5c2: [
    { id: "orgullo-que-el-grande-no-puede", label: "¿De qué se sienten orgullosos que un competidor grande no podría hacer, ni con todo su dinero?", tipo: "texto", origen: "I3" },
    { id: "solucion-que-solo-este-equipo-da", label: "¿Cuál es la solución que solo este equipo puede dar?", tipo: "texto", origen: "I14" },
  ],
  // La promesa a los colaboradores.
  m5c3: [
    { id: "en-que-se-convierte-quien-trabaja-aqui", label: "¿En qué se convierte una persona que trabaja aquí? ¿Qué se lleva aunque un día se vaya?", tipo: "texto", origen: "I7" },
  ],
  // La promesa a los clientes.
  m5c4: [
    { id: "que-le-resuelve-al-cliente", label: "Cuando un cliente los elige en vez del competidor, ¿qué le resuelve más allá de la compra o del servicio?", tipo: "texto", origen: "I4" },
    { id: "cliente-que-enorgullece", label: "Descríbeme un cliente real que te enorgullece atender. Con nombre.", tipo: "texto", origen: "I5" },
    { id: "que-perderia-ese-cliente", label: "Si ustedes no existieran, ¿qué perdería ese cliente?", tipo: "texto", origen: "I6" },
  ],
  // La promesa a los accionistas.
  m5c5: [
    { id: "que-les-devuelve-el-negocio", label: "Más allá de la utilidad, ¿qué les devuelve este negocio a ustedes como socios o como familia?", tipo: "texto", origen: "I8" },
  ],
  // Los valores EN ACCIÓN (así los llama Mauricio, no «como conducta»).
  m5c6: [
    { id: "lo-que-no-aceptarian-nunca", label: "¿Qué no aceptarían nunca, aunque les costara ventas o aunque les pagaran por ello?", tipo: "texto", origen: "I9" },
    { id: "conducta-que-exigen-y-reconocen", label: "¿Qué conducta exigen y reconocen todos los días?", tipo: "texto", origen: "I10" },
    { id: "al-estilo-de-la-casa", label: "Cuando alguien hace las cosas bien hechas al estilo de la casa, ¿qué hace exactamente que otro no haría?", tipo: "texto", origen: "I11" },
  ],
  // Cómo se lo contás al equipo — la bajada, que es donde se atora.
  m5c7: [
    { id: "te-las-creerian", label: "Lee tus respuestas en voz alta imaginando a tu equipo enfrente. ¿Te las creerían? ¿Qué parte no?", tipo: "texto", origen: "I15" },
    { id: "sigue-siendo-verdad-si-crecen", label: "¿Todo lo que escribiste sigue siendo verdad si mañana abren otra plaza, otra línea u otro formato?", tipo: "texto", origen: "I16" },
    { id: "quien-lo-dice-y-en-que-foro", label: "¿Quién lo dice, en qué foro y con qué ritual?", tipo: "texto", origen: "NUEVO (sin pregunta en ninguno de los dos cuestionarios)" },
    { id: "como-se-ancla-en-la-junta-semanal", label: "¿Cómo se ancla en la junta semanal?", tipo: "texto", origen: "NUEVO (sin pregunta en ninguno de los dos cuestionarios)" },
  ],
  m6c1: [
    { id: "area-y-responsable", label: "Nombre del área y de quien rinde cuentas por ella.", tipo: "linea", ayuda: "Un nombre, no un puesto compartido.", obligatorio: true, origen: "1.1" },
    { id: "mci-a-la-que-sirve", label: "¿A cuál de las dos MCIs sirve esta área?", tipo: "checks", ayuda: "Puede ser a una o a las dos.", opciones: ["MCI 1", "MCI 2"], obligatorio: true, origen: "1.2" },
    { id: "como-sirve-a-la-mci", label: "Explica cómo en una línea.", tipo: "linea", obligatorio: true, origen: "1.2" },
    { id: "numero-que-moveria", label: "Si esta área hiciera todo perfecto durante un trimestre, ¿qué número de la MCI se movería y aproximadamente cuánto?", tipo: "texto", ayuda: "Si no sabes contestar esto, el área todavía no tiene claro para qué existe dentro del plan.", obligatorio: true, origen: "1.3" },
    { id: "que-se-cae-si-falla", label: "Si esta área falla, ¿qué se cae en el frente que sí vende?", tipo: "texto", ayuda: "Esta pregunta es la que justifica que las áreas habilitadoras tengan tablero propio.", obligatorio: true, origen: "1.4" },
  ],
  m6c2: [
    { id: "pedido-del-frente", label: "¿Qué te está pidiendo hoy el frente a esta área y no está recibiendo?", tipo: "texto", ayuda: "Pregúntaselo al gerente operativo o al responsable comercial, no al área misma.", obligatorio: true, origen: "1.5" },
  ],
  m6c3: [
    { id: "enunciado-de-la-palanca", label: "Enuncia la palanca con verbo y objeto.", tipo: "linea", ayuda: "No una categoría, una conducta o un estándar concreto.", obligatorio: true, origen: "3.1" },
    { id: "filtro-de-cuatro", label: "Filtro de cuatro. Si falla una sola, la palanca no entra", tipo: "tabla", columnas: ["Pregunta", "Sí / No"], filasFijas: ["¿Predice el resultado? Si se hace bien un mes, ¿el LAG se mueve?", "¿Lo controla el equipo? Prueba de la coartada: ¿puede culpar a un externo?", "¿Se puede medir al menos semanal?", "¿Es hoy un cuello de botella real, o ya lo hacen bien?"], obligatorio: true, origen: "3.2" },
    { id: "estandar-que-ya-opera", label: "Si la cuarta salió \"ya lo hacen bien\", la palanca no es palanca, es un estándar que ya opera. Anótalo como estándar y sácalo del tablero.", tipo: "texto", origen: "3.3" },
    { id: "palanca-repetida-en-otra-area", label: "¿Esta palanca ya aparece en otra área con otro nombre?", tipo: "texto", ayuda: "Si sí, se queda en una sola, con el responsable que realmente la puede mover.", obligatorio: true, origen: "3.4" },
  ],
  // BLOQUE 2 del Cuestionario de Objetivos. También estaba entero sin clase: el
  // módulo 6 arrancaba en las palancas y se saltaba el OBJETIVO del área, que es
  // lo que las palancas mueven. Sin esto, una palanca no se puede rastrear hasta
  // una MCI — que es la prueba de que la matriz está bien armada.
  m6c5: [
    { id: "que-sostiene-el-area", label: "¿Qué sostiene esta área para que el negocio gane? En una línea, con verbo.", tipo: "linea", obligatorio: true, origen: "2.1" },
    { id: "cual-es-su-numero", label: "¿Cuál es su número? El indicador consecuencia que dirá si lo sostuvo o no.", tipo: "linea", obligatorio: true, origen: "2.2" },
    { id: "base-real-hoy", label: "¿Cuál es la base real hoy? Con cifra, periodo y fuente.", tipo: "tabla", columnas: ["Cifra", "Periodo", "Fuente"], obligatorio: true, origen: "2.3" },
    { id: "meta-y-para-cuando", label: "¿Cuál es la meta y para cuándo?", tipo: "texto", ayuda: "Si no hay base confiable, escribe la meta como hipótesis y anota quién consigue el dato y para qué fecha.", obligatorio: true, origen: "2.4" },
    { id: "frecuencia-de-cierre", label: "¿Con qué frecuencia se puede cerrar este número?", tipo: "eleccion", opciones: ["Diaria", "Semanal", "Mensual"], obligatorio: true, origen: "2.5" },
    { id: "ya-lo-calcula-el-area", label: "¿El área ya calcula este número hoy en su operación normal, o habría que inventar un reporte nuevo? Si hay que inventarlo, quién lo va a calcular y con qué herramienta.", tipo: "texto", ayuda: "El tablero recibe cifras que el área ya cierra. No se construyen reportes nuevos dentro del tablero ni se convierte en sistema contable.", obligatorio: true, origen: "2.6" },
    { id: "a-que-mci-se-conecta", label: "¿A qué MCI se conecta y por qué vía?", tipo: "texto", obligatorio: true, origen: "2.7" },
  ],
  m6c4: [
    { id: "ficha-de-palanca", label: "Ficha de palanca", tipo: "tabla", ayuda: "Nueve campos. Una palanca sin los nueve no se programa: entra al tablero marcada como pendiente de definición.", columnas: ["Campo", "Respuesta"], filasFijas: ["Nombre de la palanca, verbo y objeto", "Cómo se mide: numerador y denominador explícitos", "Frecuencia: diaria, por turno, semanal", "Hora de corte, a qué hora vence", "Unidad de medición: por punto, por persona, por proyecto, por turno", "Umbral verde", "Umbral amarillo", "Umbral rojo", "Responsable que rinde cuentas, un nombre", "Catálogo o formato que hace falta para que funcione"], obligatorio: true, origen: "BLOQUE 4" },
  ],
  m7c1: [
    { id: "que-prueba-que-se-hizo", label: "¿Qué prueba que se hizo?", tipo: "eleccion", opciones: ["Foto", "Checklist", "Formulario", "Lectura", "Registro en sistema", "Entregable"], obligatorio: true, origen: "6.1" },
    { id: "de-donde-sale-el-dato-duro", label: "¿De dónde sale el dato duro?", tipo: "eleccion", opciones: ["Punto de venta", "CRM", "Cierre contable", "Nómina", "Captura manual"], obligatorio: true, origen: "6.6" },
  ],
  m7c2: [
    { id: "si-es-foto", label: "Si es foto: ¿de qué exactamente, desde qué ángulo, y qué la hace aprobada o rechazada?", tipo: "texto", obligatorio: true, origen: "6.2" },
  ],
  m7c3: [
    { id: "capturas-por-dia", label: "¿Cuántas capturas por día y en qué momentos?", tipo: "texto", obligatorio: true, origen: "6.3" },
    { id: "quien-sube-y-quien-valida", label: "¿Quién sube y quién valida?", tipo: "linea", ayuda: "Pueden ser la misma persona solo si el dato viene de un sistema.", obligatorio: true, origen: "6.4" },
    { id: "conservacion-de-la-evidencia", label: "¿Cuánto tiempo se conserva la evidencia?", tipo: "linea", ayuda: "Sugerido: cuatro semanas, con el semáforo ya guardado.", obligatorio: true, origen: "6.5" },
    { id: "cuanto-tarda-en-subirlo", label: "¿Cuánto tiempo le toma a la persona subir esto?", tipo: "linea", ayuda: "Si pasa de dos minutos, hay que simplificarlo o no lo va a hacer.", obligatorio: true, origen: "6.7" },
  ],
  // Los tres umbrales en UN bloque (Mau, 12/08): «aquí literalmente sería una sola».
  m8c1: [
    { id: "nivel-ya-logrado", label: "¿Qué nivel ya lograste alguna vez?", tipo: "linea", origen: "5.1" },
    { id: "nivel-exigente-alcanzable", label: "¿Qué nivel te parece exigente pero alcanzable con lo que tienes hoy, sin gente nueva y sin presupuesto nuevo?", tipo: "linea", origen: "5.2" },
    { id: "que-tendria-que-pasar-para-caerse", label: "¿Qué tendría que pasar para que esto se caiga?", tipo: "texto", origen: "5.3" },
    { id: "incumplimiento-inadmisible", label: "¿Hay algún caso donde el incumplimiento sea inadmisible, por seguridad, legal o pérdida de cliente?", tipo: "texto", origen: "5.4" },
  ],
  m9c1: [
    { id: "gasto", label: "Hasta cuánto de gasto", tipo: "numero", ayuda: "Si esta sección queda vacía, nada de lo anterior va a funcionar, porque el líder seguirá escalando.", obligatorio: true, origen: "B7.4" },
    { id: "tipo-de-decision", label: "Qué tipo de decisión", tipo: "texto", obligatorio: true, origen: "B7.4" },
    { id: "situaciones", label: "En qué situaciones", tipo: "texto", obligatorio: true, origen: "B7.4" },
  ],
  m9c2: [
    { id: "lo-que-si-me-tienes-que-escalar", label: "Lo que sí me tienes que escalar", tipo: "texto", ayuda: "Corto y específico. Todo lo que no esté aquí no se escala.", obligatorio: true, origen: "B7.5" },
  ],
  m9c3: [
    { id: "lo-que-yo-te-voy-a-dar", label: "Lo que yo te voy a dar", tipo: "texto", ayuda: "Presupuesto, gente, capacitación, decisiones que dependen del dueño, con fecha. El accountability es de dos lados.", obligatorio: true, origen: "B7.6" },
  ],
  m9c4: [
    { id: "como-se-ve-perder", label: "Cómo se ve perder, y qué pasa entonces", tipo: "texto", ayuda: "Qué hacemos cuando el número no se logra dos semanas seguidas. Se define antes, en frío, no en la junta donde ya pasó.", obligatorio: true, origen: "B7.7" },
  ],
  m10c1: [
    { id: "dia-y-hora", label: "¿Qué día y a qué hora es la junta semanal de esta área?", tipo: "linea", ayuda: "Fija, no movible.", obligatorio: true, origen: "B8.1" },
    { id: "quien-asiste", label: "¿Quién asiste?", tipo: "texto", ayuda: "Solo quienes rinden cuentas de estos números.", obligatorio: true, origen: "B8.2" },
    { id: "cuanto-dura", label: "¿Cuánto dura?", tipo: "numero", ayuda: "Entre veinte y cuarenta minutos por área. Si dura más, se está resolviendo operación en lugar de rendir cuentas.", origen: "B8.3" },
  ],
  m10c2: [
    { id: "guion-cuatro-pasos", label: "Guion de la junta, cuatro pasos", tipo: "checks", opciones: ["Rendir cuentas del compromiso de la semana pasada. Se cumplió o no se cumplió. No hay explicaciones aquí.", "Revisar el marcador. Solo los rojos y los amarillos. Los verdes se mencionan en una línea.", "Despejar obstáculos. Aquí es donde el líder pide y el dueño da criterio, no soluciones.", "Comprometer una acción para la semana que entra. Una, concreta, con fecha."], origen: "B8 · Guion" },
  ],
  m10c3: [
    { id: "dueno-menos-del-veinte", label: "¿El dueño está hablando menos del veinte por ciento del tiempo?", tipo: "texto", ayuda: "Es la única métrica de la junta que importa. Si habla más, la junta está reforzando la dependencia en vez de disolverla.", obligatorio: true, origen: "B8.4" },
  ],
  m11c2: [
    { id: "auditoria-de-vinculacion", label: "Seis verificaciones sobre la matriz completa", tipo: "checks", ayuda: "Se corren antes de programar nada.", opciones: ["Área sin ningún objetivo vinculado a una MCI.", "MCI sin ninguna área que la sirva.", "Objetivo con más de tres palancas.", "Palanca repetida en dos áreas con distinto nombre.", "Responsable que no tiene autoridad para mover lo que se le está midiendo.", "Área habilitadora crítica sin objetivo propio."], origen: "Auditoría de vinculación" },
  ],
};

/** Los campos de una clase. Vacío si todavía no tiene formulario. */
export function camposDe(claseId: string): Campo[] {
  return CAMPOS[claseId] ?? [];
}

/** Cuántas preguntas tiene el programa entero. */
export const TOTAL_CAMPOS = Object.values(CAMPOS).reduce((n, c) => n + c.length, 0);
