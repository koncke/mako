// =============================================================================
// El programa, por bloques — FUENTE ÚNICA
// =============================================================================
// Un bloque = una clase = un video + una tarea. Es la unidad del bucle de
// entrega: el cliente mira el video, deja la tarea contestada, y recién ahí se
// agenda la sesión. Después la IA reescribe la respuesta con lo que se habló y
// el cliente la aprueba.
//
// ⚠️ ESTO LO LEEN TRES COSAS Y POR ESO VIVE ACÁ Y NO EN CADA UNA:
//   1. El cargador de Whop (`scripts/cargar-programa-whop.ts`) — crea el curso,
//      los capítulos y las lecciones desde este archivo.
//   2. El formulario de la tarea que contesta el cliente.
//   3. El prompt que reescribe la respuesta después de la junta: necesita saber
//      QUÉ preguntaba el bloque para no inventar.
// Si el temario se copia en cualquiera de los tres, el segundo se queda viejo.
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
  /** El atoro medido, cuando lo hay. Va en el video, no en la letra chica. */
  atoro?: string;
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
        atoro: 'El dueño no asume que él es el proyecto. Hoy se resuelve en la venta y se olvida.',
      },
      {
        id: 'm0c2', titulo: 'Estándar no es criterio',
        pregunta: 'Una decisión de tu negocio que tiene estándar pero no tiene criterio.',
      },
      {
        id: 'm0c3', titulo: 'Cómo funciona cada bloque',
        pregunta: 'Qué hacés antes de cada sesión y qué se revisa en ella.',
      },
    ],
  },
  {
    id: 'm1', numero: 1, titulo: 'Tu negocio en números', fase: 'norte', quien: 'dueño',
    clases: [
      {
        id: 'm1c1', titulo: 'La unidad que se repite',
        pregunta: 'Si tu negocio se juega en puntos de operación, en oportunidades comerciales o en proyectos, y cuántos tenés.',
      },
      {
        id: 'm1c2', titulo: 'Tus áreas y quién responde',
        pregunta: 'Qué áreas existen hoy y quién rinde cuentas de cada una, con nombre y apellido.',
      },
      {
        id: 'm1c3', titulo: 'Venta y resultado de 24 meses',
        pregunta: 'Los números mes a mes, por línea de negocio y por unidad, con la fuente de cada cifra.',
      },
      {
        id: 'm1c4', titulo: 'Qué te hace perder plata',
        pregunta: 'Los tres costos que más pesan, el punto de equilibrio, y qué unidades venden bien sin ser rentables.',
      },
      {
        id: 'm1c5', titulo: 'Tu paradoja en una frase',
        pregunta: 'Los dos números tuyos que se contradicen.',
      },
      {
        id: 'm1c6', titulo: 'Lo que no sabés todavía',
        pregunta: 'La lista de datos que no existen, con quién los consigue y para cuándo.',
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
      },
      {
        id: 'm2c2', titulo: 'Las decisiones que te suben',
        pregunta: 'Ocho renglones: la decisión, quién la toma hoy, qué resultado se espera, cómo se logra y qué hacer cuando no se logra.',
        atoro: 'Las tres últimas columnas SON el criterio. Si solo podés llenar «qué resultado se espera», esa decisión tiene estándar y no tiene criterio: por eso te sigue subiendo.',
      },
      {
        id: 'm2c3', titulo: 'Tu agenda real',
        pregunta: 'Dos semanas medidas, no la ideal, repartidas en dirección, crecimiento, innovación, gente y operación.',
      },
      {
        id: 'm2c4', titulo: 'Lo que no está pasando',
        pregunta: 'La alianza que no cerraste, la línea que no lanzaste, el mercado que no exploraste.',
      },
      {
        id: 'm2c5', titulo: 'Cuánto estás dispuesto a que baje',
        pregunta: 'El número que aceptás resistir mientras soltás, y por cuánto tiempo.',
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
      },
      {
        id: 'm3c2', titulo: 'Qué puestos faltan',
        pregunta: 'Qué haría cada uno, a quién reportaría, y si sale de adentro o se contrata.',
      },
    ],
  },
  {
    id: 'm4', numero: 4, titulo: 'Las dos MCIs', fase: 'norte', quien: 'dueño',
    clases: [
      {
        id: 'm4c1', titulo: 'La MCI 1, el resultado',
        pregunta: '«Pasar de ___ a ___ para el ___», con base real, fuente y responsable del dato.',
      },
      {
        id: 'm4c2', titulo: 'La MCI 2, el criterio',
        pregunta: '«Pasar de un equipo que ___ a un equipo que ___ para el ___».',
        atoro: 'El error más frecuente: redactarla sobre lo que el dueño deja de hacer. Un equipo no puede ganar «el director trabaja menos»; sí puede ganar adueñarse de sus números. El tiempo del dueño es el LAG que comprueba la MCI 2, no la MCI 2. HMO las escribió las dos sobre criterio y se quedó sin marcador económico.',
      },
      {
        id: 'm4c3', titulo: 'El objetivo de cada área',
        pregunta: 'Qué sostiene, cuál es su número, su base de hoy, su fuente, quién rinde cuentas, y si el área YA lo calcula.',
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
      },
      {
        id: 'm5c2', titulo: 'Quién es el adversario',
        pregunta: 'Concreto y medible, no abstracto, y cómo se siente eso en el piso.',
      },
      {
        id: 'm5c3', titulo: 'Los valores como conducta',
        pregunta: 'Qué hace alguien de la casa que otro no haría, exactamente.',
      },
      {
        id: 'm5c4', titulo: 'Cómo se lo contás al equipo',
        pregunta: 'Quién lo dice, en qué foro, con qué ritual y cómo se ancla en la junta semanal.',
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
        atoro: 'Lo que destraba no es el formulario, es el contexto. Un director de HMO llegó solo con sus tres números puestos cuando su rol ya tenía una razón de existir dentro del sistema.',
      },
      {
        id: 'm6c2', titulo: 'Qué te está pidiendo el frente',
        pregunta: 'Lo que el área comercial u operativa le pide a esta área y no está recibiendo.',
      },
      {
        id: 'm6c3', titulo: 'Elegir las palancas',
        pregunta: 'Máximo tres por objetivo, cada una pasando el filtro de cuatro: predice el resultado, lo controla el equipo, se mide al menos semanal, y es hoy un cuello real.',
        atoro: 'Si la respuesta a la cuarta es «ya lo hacen bien», eso no es una palanca: es un estándar que ya opera. Se anota y se saca del tablero.',
      },
      {
        id: 'm6c4', titulo: 'La ficha de nueve campos',
        pregunta: 'Nombre con verbo y objeto, cómo se mide con numerador y denominador, frecuencia, hora de corte, unidad, verde, amarillo, rojo, y un responsable con nombre.',
      },
    ],
  },
  {
    id: 'm7', numero: 7, titulo: 'La evidencia', fase: 'palancas', quien: 'dueño', porArea: true,
    clases: [
      {
        id: 'm7c1', titulo: 'Qué prueba que se hizo',
        pregunta: 'Por cada palanca: foto, checklist, formulario, lectura, registro en sistema o entregable.',
        atoro: 'Es el bloqueo número uno de todo el programa. Baja Teriyaki estuvo tres semanas detenida en esta sola pregunta. «El cliente sabe qué quiere que pase. No sabe cómo probar que pasó.»',
      },
      {
        id: 'm7c2', titulo: 'Si es foto, de qué exactamente',
        pregunta: 'Desde qué ángulo, y qué la hace aprobada o rechazada.',
        atoro: 'En TEXX el protocolo de servicio no se podía medir porque el mystery shopper solo captura cuando hay alguien observando.',
      },
      {
        id: 'm7c3', titulo: 'Quién sube y quién valida',
        pregunta: 'Cuántas capturas por día, en qué momentos, y cuánto tarda la persona en subirla.',
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
        atoro: 'El dueño no tiene referencia de qué es exigente pero posible, y ante la duda no contesta: Patricia no devolvió el archivo. Por eso la pregunta que sí funciona es esta, y no «¿cuál sería una buena meta?».',
      },
      {
        id: 'm8c2', titulo: 'Qué es exigente pero alcanzable',
        pregunta: 'Con lo que tenés hoy: sin gente nueva y sin presupuesto nuevo.',
      },
      {
        id: 'm8c3', titulo: 'Cuándo se cae',
        pregunta: 'Qué tendría que pasar para que esto salga mal. Esa es la definición del rojo.',
        atoro: 'Rangos sin traslape entre verde, amarillo y rojo: es el error más común. Y nada de 100% salvo donde el incumplimiento sea inadmisible por seguridad, legal o pérdida de cliente.',
      },
    ],
  },
  {
    id: 'm9', numero: 9, titulo: 'La carta de expectativas', fase: 'palancas', quien: 'dueño', porArea: true,
    clases: [
      {
        id: 'm9c1', titulo: 'Qué puede decidir sin consultarte',
        pregunta: 'El límite explícito: hasta cuánto de gasto, qué tipo de decisión, en qué situaciones.',
        atoro: 'Es la sección crítica de todo el programa. Si queda vacía, el tablero puede estar perfecto y el líder va a seguir escalando: la junta semanal sigue siendo el dueño resolviendo.',
      },
      {
        id: 'm9c2', titulo: 'Qué sí te tiene que escalar',
        pregunta: 'Corto y específico. Todo lo que no esté ahí, no se escala.',
      },
      {
        id: 'm9c3', titulo: 'Qué le vas a dar vos',
        pregunta: 'Presupuesto, gente, capacitación y decisiones que dependen de vos, con fecha.',
      },
      {
        id: 'm9c4', titulo: 'Qué pasa cuando no se logra',
        pregunta: 'Qué hacemos si el número falla dos semanas seguidas, definido en frío.',
      },
    ],
  },
  {
    id: 'm10', numero: 10, titulo: 'La cadencia', fase: 'build', quien: 'dueño',
    clases: [
      {
        id: 'm10c1', titulo: 'Las tres juntas',
        pregunta: 'Día, hora y participantes de la diaria de sincronización, la semanal de accountability y la mensual de rentabilidad.',
      },
      {
        id: 'm10c2', titulo: 'El guion de la semanal',
        pregunta: 'Rendir cuentas del compromiso, solo rojos y amarillos, despejar obstáculos, y un compromiso concreto con fecha.',
      },
      {
        id: 'm10c3', titulo: 'La única métrica que importa',
        pregunta: 'Cómo vas a medir que hablás menos del 20% del tiempo en la junta semanal.',
        atoro: 'Si el dueño habla más, la junta está reforzando la dependencia en vez de disolverla.',
      },
    ],
  },
  {
    id: 'm11', numero: 11, titulo: 'Arranque', fase: 'build', quien: 'dueño',
    clases: [
      {
        id: 'm11c1', titulo: 'Los catálogos que faltan',
        pregunta: 'Lo que no existe (productos por margen, inventario, descripciones de puesto, rangos operativos), con responsable y fecha.',
        atoro: 'En TEXX se detectaron trece catálogos faltantes, cada uno bloqueando una palanca. No es trabajo de tablero: es trabajo previo que aparece al final.',
      },
      {
        id: 'm11c2', titulo: 'Las dos primeras semanas',
        pregunta: 'Qué mirar cuando el tablero empieza a recibir captura real, y qué corregir.',
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
