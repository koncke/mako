// =============================================================================
// El Banco de Skills de Mauricio, leído entero y cruzado contra el programa
// =============================================================================
// QUÉ ES: en agosto Mauricio compartió una carpeta de Drive («Banco Maestro de
// Skills») con 1,07 GB de material propio —26 grabaciones y 35 PDFs, ordenados
// por tema— con la expectativa razonable de que bajara la lista de lo que le
// falta grabar. Este archivo es el resultado de haberlo leído completo: las 26
// transcripciones y los 35 PDFs, no los títulos.
//
// ⚠️ EL HALLAZGO QUE ORDENA TODO LO DEMÁS: ninguna de las 26 grabaciones termina
// en una tarea. Explican un marco (4DX, OKRs, Sinek, Lencioni). Las clases del
// programa terminan todas en un entregable que el cliente produce sobre SU
// negocio. Un video sobre «Empieza por el porqué» y la clase «El origen» hablan
// del mismo tema, pero la clase pide que el cliente escriba EL SUYO.
//
// Por eso la unidad de acá no es el archivo: es el MÓDULO, y lo que se declara
// de cada uno es a qué NIVEL lo cubre el material. Un banco temático se cuelga
// como anexo; casi nunca reemplaza una clase.
//
// De dónde salen los números: `docs/hallazgos-customer-success.md` → «Un banco de
// material temático no es un temario» y «El inventario por nombre contaba 26
// videos donde había 25». Las duraciones salen de ffprobe, las palabras de
// pdftotext y los duplicados de md5 — nada de esto está tipeado a mano.
//
// SIN `server-only` A PROPÓSITO: lo lee la tab Program (client) y lo leen los
// tests.
//
// Lo lee: `app/customer-success/programa/` (la tab «Tu material»).
// =============================================================================

import { PROGRAMA } from './programa-catalogo';

// -----------------------------------------------------------------------------
// ⚠️ CONTRA QUÉ PROGRAMA SE MIDE, Y POR QUÉ NO ES EL CATÁLOGO
// -----------------------------------------------------------------------------
// El material se cruza contra el programa del DOCUMENTO que Mauricio escribió en
// agosto («Proceso de proceso en el servicio»), que tiene 13 módulos (0 a 12).
// El catálogo cargado en la plataforma —`programa-catalogo.ts`— todavía tiene los
// 12 viejos (0 a 11), y desde el 5 la numeración significa cosas distintas:
// «módulo 5» es El propósito en el catálogo y Objetivos por área en el documento.
//
// Por eso la cobertura se declara contra `MODULOS_DOC` y NO contra `PROGRAMA`:
// atarla al catálogo haría que la tab dijera que el banco cubre un módulo que no
// es. La diferencia entre los dos se calcula sola en `DIVERGENCIA` y se muestra,
// porque es algo que Mauricio tiene que resolver antes de grabar.

/** Los 13 módulos del documento de Mauricio. Es la referencia de la cobertura. */
export const MODULOS_DOC: { numero: number; titulo: string; etapa: string }[] = [
  { numero: 0, titulo: 'Cómo se juega', etapa: 'Claridad' },
  { numero: 1, titulo: 'Tu negocio en números', etapa: 'Claridad' },
  { numero: 2, titulo: 'Dónde vive el criterio', etapa: 'Claridad' },
  { numero: 3, titulo: 'El equipo real', etapa: 'Claridad' },
  { numero: 4, titulo: 'Las 2 Metas Crucialmente Importantes', etapa: 'Sistema de ejecución' },
  { numero: 5, titulo: 'Objetivos por área: el puente', etapa: 'Sistema de ejecución' },
  { numero: 6, titulo: 'Palancas', etapa: 'Sistema de ejecución' },
  { numero: 7, titulo: 'Umbrales y evidencia', etapa: 'Sistema de ejecución' },
  { numero: 8, titulo: 'Propósito y narrativa', etapa: 'Narrativa y lanzamiento' },
  { numero: 9, titulo: 'Tableros: el juego en tiempo real', etapa: 'Narrativa y lanzamiento' },
  { numero: 10, titulo: 'Diseñando el sistema de juntas', etapa: 'Operación y liderazgo' },
  { numero: 11, titulo: 'Accountability y consecuencias', etapa: 'Operación y liderazgo' },
  { numero: 12, titulo: 'La agenda del director y graduación', etapa: 'Operación y liderazgo' },
];

/** A qué nivel el material cubre un módulo. El orden importa: es una escalera. */
export type NivelCobertura =
  /** No hay nada aprovechable para este módulo. */
  | 'nada'
  /** Hay material para colgar como lectura o video de apoyo. No baja grabaciones. */
  | 'anexo'
  /** Alguna clase del módulo ya está cubierta a nivel de procedimiento. */
  | 'parcial'
  /** Alcanza para no tener que grabar la mayor parte del módulo. */
  | 'clase';

export const NIVELES: NivelCobertura[] = ['nada', 'anexo', 'parcial', 'clase'];

/** Una pieza del banco, con lo que aporta a ESTE módulo. */
export type Pieza = {
  /** El nombre del archivo tal cual está en Drive. Es como Mauricio lo busca. */
  archivo: string;
  /** Video con su duración medida, o documento con sus palabras. */
  formato: { tipo: 'video'; minutos: number } | { tipo: 'documento'; palabras: number };
  /** Qué aporta, en una línea. Escrito para que Mauricio lo entienda sin abrirlo. */
  aporta: string;
  /**
   * `true` solo cuando la pieza sirve como CLASE: trae el procedimiento, no el
   * concepto. Son dos en todo el banco, y ninguna lleva el nombre de un libro.
   */
  esClase?: boolean;
};

export type Cobertura = {
  /** El número del módulo en `MODULOS_DOC` (el documento), NO el id del catálogo. */
  modulo: number;
  nivel: NivelCobertura;
  piezas: Pieza[];
  /** Los contenidos del módulo que NINGUNA pieza cubre. Es lo que hay que grabar. */
  falta: string[];
  /**
   * La acción en tres palabras. NO es un resumen de `tarea`: es lo que el ojo
   * agarra al escanear las 13 filas sin abrir ninguna. Si no entra en una línea
   * corta, la fila deja de ser escaneable y la pantalla vuelve a ser un texto.
   */
  accion: string;
  /** Qué tiene que hacer Mauricio con este módulo. Una frase, en imperativo. */
  tarea: string;
  /**
   * Una advertencia sobre material que PARECE de este módulo y no lo es.
   *
   * No es adorno: los dos casos que hay acá son piezas donde la misma palabra
   * nombra otra cosa, y colgarlas del módulo le enseñaría al cliente lo
   * contrario de lo que el módulo dice. Un anexo equivocado es peor que ninguno.
   */
  ojo?: string;
};

/**
 * El inventario MEDIDO. No se estima: las duraciones salen de ffprobe sobre los
 * archivos bajados y las palabras de pdftotext.
 */
// SIN `as const` A PROPÓSITO: con literales, `videos !== videosUnicos` es un
// error de tipos («26 y 25 no se superponen») y la pantalla pierde la guarda que
// hace desaparecer la aclaración el día que Mauricio borre el duplicado.
export const INVENTARIO: {
  archivos: number; videos: number; videosUnicos: number;
  minutos: number; documentos: number; palabrasDocumentos: number; gigas: number;
} = {
  archivos: 61,
  videos: 26,
  /** 26 archivos de video, pero uno está duplicado: grabaciones distintas son 25. */
  videosUnicos: 25,
  minutos: 183,
  documentos: 35,
  palabrasDocumentos: 66_171,
  gigas: 1.07,
};

/**
 * Lo que hay que arreglar ANTES de publicar, y es independiente de grabar.
 * Ordenado por daño: primero lo que un cliente no debería ver nunca.
 */
export type Defecto = {
  id: string;
  titulo: string;
  archivos: string[];
  /** La prueba. Un md5, un conteo o una cita textual del archivo. */
  evidencia: string;
  /** Qué hacer. Concreto y chico. */
  arreglo: string;
  /** `true` si un cliente que abre el material lo ve. Eso lo vuelve urgente. */
  loVeElCliente: boolean;
};

export const DEFECTOS: Defecto[] = [
  {
    id: 'otro-cliente',
    titulo: 'Tres piezas traen el negocio (y el nombre) de otro cliente',
    archivos: [
      'SKILL_21_Rol del Director Comercial.pdf',
      'SKILL_04_Balanced Scorecard BSC.pdf',
      'SKILL_20_Roles y Responsabilidades.pdf',
    ],
    evidencia:
      'El de Director Comercial describe una empresa B2B industrial de automatización y refacciones, y nombra a la persona: «rol de Jorge a instalar con el DOS», «lo que hoy parece ser vendedora senior». Los otros dos están escritos para una campaña política: «resultados electorales», «coordinación territorial», y el ejemplo decide con «Coordinación política».',
    arreglo:
      'Reescribir los tres sacando el caso: el marco se queda, el rubro y los nombres se van. Son documentos cortos.',
    loVeElCliente: true,
  },
  {
    id: 'pdf-compartido',
    titulo: 'Dos Skills no tienen documento propio: apuntan al PDF de un tercero',
    archivos: [
      'SKILL_15_Conversaciones Difíciles e Integridad.pdf',
      'SKILL_16_Crear Estándares y Pedidos Efectivos.pdf',
    ],
    evidencia:
      'Los tres archivos (SKILL_14, 15 y 16) tienen el mismo md5: fa733a59ce8804fb4f4c6d9ecc229023. El contenido es el manual «Liderazgo Gerencial».',
    arreglo:
      'El manual sí cubre los dos temas adentro, así que alcanza con recortarlo en dos documentos, o con renombrarlos para que se entienda que son el mismo manual.',
    loVeElCliente: true,
  },
  {
    id: 'interfaz-pegada',
    titulo: 'Un PDF trae pegada la interfaz de la herramienta con la que se hizo',
    archivos: [
      'SKILL_05_Anti-Complex Simplicidad Ejecutiva.pdf',
      'SKILL_05_Anti-Complex Simplicidad Ejecutiva_Infográfico.pdf',
    ],
    evidencia:
      'Al final del PDF quedaron los botones y el historial de la herramienta («Chat», «Studio», «Resumen en audio») y el pedido tal cual se escribió: «Haz una infografía igual o similar a la que hiciste pero en formato vertical». El infográfico lleva el logo de la herramienta en las 12 páginas.',
    arreglo: 'Volver a exportar las dos piezas sin esa última parte y sin el logo.',
    loVeElCliente: true,
  },
  {
    id: 'vacios',
    titulo: 'Dos Skills están vacías',
    archivos: [
      'SKILL_07_Prioridades Covey_Primero lo Primero.pdf',
      'SKILL_22_Elévate con SCRUM.pdf',
    ],
    evidencia:
      'El de Covey son 7 palabras: un título y un link de YouTube. El de SCRUM son 38: las etiquetas sueltas de un diagrama, sin una sola frase.',
    arreglo: 'Escribirlas, o sacarlas del banco. Hoy ocupan un lugar que promete algo que no está.',
    loVeElCliente: true,
  },
  {
    id: 'duplicados',
    titulo: 'Tres archivos están duplicados con otro nombre',
    archivos: [
      'Time_Blocking__Logro_Diseñado.mp4',
      'Copia de SKILL_20_Roles y Responsabilidades.pdf',
      'Reaccionamos_primero_y_justificamos_después.m4a',
    ],
    evidencia:
      'Time_Blocking es byte por byte el mismo video que SKILL_19 (md5 493af358…), y la «Copia de» es idéntica al original (md5 a6d305d7…). El audio de 13 minutos es el mismo contenido que el video «Arquitectura del Pensamiento», en otro formato.',
    arreglo: 'Borrar los duplicados. Sin esto, el banco parece tener más material del que tiene.',
    loVeElCliente: false,
  },
];

/**
 * Módulo por módulo: a qué nivel lo cubre el banco, con qué, qué falta y qué hay
 * que hacer. Los `moduloId` se validan contra `programa-catalogo` en los tests.
 */
export const COBERTURA: Cobertura[] = [
  {
    modulo: 0,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_13_Accountability Total para Líderes.pdf',
        formato: { tipo: 'documento', palabras: 1_980 },
        aporta:
          'La fórmula «Resultado + Métrica + Fecha», con la frase de que sin un resultado medible no hay rendición de cuentas. Es la única pieza del banco que usa «estándar» con el mismo sentido que el módulo: el resultado esperado.',
      },
    ],
    ojo:
      'No cuelgues aquí el manual de Liderazgo Gerencial ni el de Soft Skills, aunque los dos hablen de «estándares». En los dos, estándar significa la manera acordada de comportarse —«cómo hacemos las cosas aquí», una escalera de 0 a 5 por habilidad—, que es casi lo contrario de tu definición. El cliente se llevaría la definición equivocada justo en la clase que la instala.',
    falta: [
      'La distinción madre: estándar es el resultado esperado, criterio es qué se espera + cómo lograrlo + qué hacer cuando no se logra',
      'La prueba de las dos semanas',
      'Las reglas del juego (tarea previa obligatoria, la sesión afina y no explica, todo se rinde sobre evidencia)',
      'El mapa del viaje',
      'Los cuatro ejercicios de apertura, que no aparecen en ningún material',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo entero. El manual solo aporta la mitad «estándar» de la distinción, no la de «criterio».',
  },
  {
    modulo: 1,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_10_Scaling Up_Ritmo y Cadencia de Juntas.pdf',
        formato: { tipo: 'documento', palabras: 795 },
        aporta:
          'Una lista de qué se mide en cada área del negocio (empleados, clientes, accionistas, compras, ventas, administración). Es lo más cerca que hay de «el negocio en números».',
      },
    ],
    falta: [
      'La unidad que se repite y produce el dinero',
      'Mapa de áreas y quién responde hoy por cada una',
      'Ventas, margen y flujo con línea base real',
      'Dónde se pierde dinero: fugas, retrabajos, cuellos',
      'La paradoja del dueño en una frase',
      'El inventario de datos que todavía no existen',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo entero. Es el módulo que arranca el programa y no tiene nada.',
  },
  {
    modulo: 2,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_14_Liderazgo Gerencial.pdf',
        formato: { tipo: 'documento', palabras: 12_777 },
        aporta:
          'La fórmula del pedido efectivo («con el fin de A, te pido B para la fecha C, ¿te puedes comprometer?»), las tres únicas respuestas que se aceptan y el catálogo de falsas promesas. Sirve como caso de contraste de la clase, no como la clase.',
      },
      {
        archivo: 'SKILL_16_Crear Estándares y Pedidos Efectivos.mp4',
        formato: { tipo: 'video', minutos: 2 },
        aporta: 'Resume en dos minutos las tres fases del pedido. Es un adelanto, no una clase.',
      },
      {
        archivo: 'No estás pensando… (Eric Kandel).pdf',
        formato: { tipo: 'documento', palabras: 769 },
        aporta:
          'Lo único del banco que ataca de frente «por qué no puedes soltar»: una creencia no es una opinión, es una red que se consolidó a fuerza de repetición y emoción, y la incomodidad al cuestionarla es la señal de que está cambiando, no de que estés equivocado.',
      },
    ],
    falta: [
      'El inventario de consultas recurrentes',
      'Delegaste la tarea, no el criterio',
      'Prompts a humanos: el componente «cómo decidir», que es el que da nombre al módulo',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo entero, las cuatro clases. Es el módulo donde más fácil es creer que el material alcanza, y es donde menos alcanza.',
    ojo:
      'El pedido efectivo del manual enseña a delegar una TAREA con fecha, impecablemente. Este módulo existe porque delegar tareas impecablemente no alcanza: en las 82 KB del manual, «criterio» aparece una sola vez y con otro sentido. Sirve como el ejemplo de lo que el cliente ya hace bien y sigue sin destrabarlo — que es un buen anexo, siempre que se presente así.',
  },
  {
    modulo: 3,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_20_Roles y Responsabilidades.pdf',
        formato: { tipo: 'documento', palabras: 522 },
        aporta:
          'RACI y RAPID: quién ejecuta, quién responde por el resultado y quién decide. Da vocabulario para la clase de «quién está listo para recibir criterio».',
      },
      {
        archivo: 'RACI_y_RAPID__Sin_Ambigüedad.mp4',
        formato: { tipo: 'video', minutos: 5 },
        aporta: 'El mismo material explicado, para colgar del módulo como apoyo.',
      },
      {
        archivo: 'SKILL_12_Las 5 Disfunciones de un Equipo_Lencioni.mp4',
        formato: { tipo: 'video', minutos: 7 },
        aporta: 'Por qué un equipo con buena gente no rinde. Contexto para leer el organigrama real.',
      },
    ],
    falta: [
      'Organigrama real contra el de papel',
      'Talento (de dónde saca energía la persona) contra competencia (lo que se entrena)',
      'Qué puestos faltan o no están funcionando',
      'El semáforo por puesto',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo entero y colgar RACI/RAPID como anexo. La distinción talento/competencia es tuya y no está escrita en ningún lado.',
  },
  {
    modulo: 4,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_06_Las 4 Disciplinas de la Ejecución 4DX.pdf',
        formato: { tipo: 'documento', palabras: 1_019 },
        aporta:
          'La definición de meta crucialmente importante con la fórmula «de X a Y para la fecha Z», la regla de pocas metas y la distinción entre indicador de resultado y de acción. Está escrito para tu programa, así que el vocabulario ya coincide.',
      },
      {
        archivo: 'SKILL_06_4DX_Del Caos al Control.mp4',
        formato: { tipo: 'video', minutos: 6 },
        aporta: 'El mismo marco explicado. Buena lectura previa antes de que el cliente escriba sus MCIs.',
      },
    ],
    falta: [
      'La MCI 2 de criterio: sacar al dueño de la operación',
      'La regla de redactarla sobre lo que el equipo empieza a hacer, nunca sobre lo que el dueño deja de hacer',
      'Que el indicador de la MCI 2 es la agenda del dueño: broncas resueltas al día y horas en operación',
      'El árbol completo MCI → objetivos por área → palancas',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo. 4DX cubre la MCI de resultado; la MCI de criterio, que es la tuya, no está en ningún material.',
  },
  {
    modulo: 5,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_08_Metodología OKRs.pdf',
        formato: { tipo: 'documento', palabras: 3_150 },
        aporta:
          'El método de OKRs de Google completo: cómo se escribe un objetivo, cómo un resultado clave, las seis trampas clásicas y el ciclo trimestral. Es el documento más sólido del banco.',
      },
      {
        archivo: 'SKILL_08_Metodología OKRs.mp4',
        formato: { tipo: 'video', minutos: 7 },
        aporta: 'El mismo método explicado, con el semáforo de calificación.',
      },
    ],
    falta: [
      'El puente: cómo contribuye cada área a la MCI, sin que ninguna quede afuera',
      'Objetivos separados por MCI 1 y MCI 2',
      'Que el objetivo es el prompt al líder de área',
      'La carta de expectativas, con la sección de lo que el líder puede decidir sin consultar',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo. OKRs da el concepto de objetivo medible; el puente área × MCI y la carta de expectativas son tuyos.',
  },
  {
    modulo: 6,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_06_Las 4 Disciplinas de la Ejecución 4DX.pdf',
        formato: { tipo: 'documento', palabras: 1_019 },
        aporta:
          'La distinción entre indicador de resultado y de acción, con ejemplos de acciones semanales que dependen del líder. Es el vocabulario base de la palanca.',
      },
    ],
    falta: [
      'La prueba de dos preguntas por palanca: ¿predice el resultado? ¿la controla el equipo?',
      'El filtro de selección y el máximo de tres palancas por objetivo',
      'La ficha completa de cada palanca',
      'La lectura del sistema: si las palancas están en verde, el objetivo se cumple',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo. El concepto está; el procedimiento para elegir y fichar una palanca no.',
  },
  {
    modulo: 7,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_08_Metodología OKRs.pdf',
        formato: { tipo: 'documento', palabras: 3_150 },
        aporta:
          'Lo único del banco con cortes de color explícitos: rojo de 0 a 0,3, amarillo de 0,4 a 0,6 y verde de 0,7 a 1. Ojo que es la calificación de un objetivo al cierre del trimestre, no un umbral por palanca — pero sirve para mostrar que el corte se declara con números y no con criterio.',
      },
      {
        archivo: 'SKILL_13_Accountability Total para Líderes.pdf',
        formato: { tipo: 'documento', palabras: 1_980 },
        aporta:
          'El tablero de métricos con las columnas Resultado, Métrica, Responsable, Estado, Avance y Observaciones. Es lo más parecido que hay al artefacto que se pide de tarea.',
      },
    ],
    falta: [
      'Que el umbral lo pone el líder del área, no el dueño',
      'Cuándo es verde, amarillo y rojo, por tipo de palanca',
      'La evidencia: qué se registra, quién, cuándo y dónde',
      'Cómo arrancar con una hipótesis cuando no hay referencia, y calibrar en dos semanas',
    ],
    accion: 'Grabarlo — y primero',
    tarea: 'Grabarlo entero, y primero. Es el bloqueo número uno medido en tus clientes, y las palabras «umbral» y «semáforo» no aparecen ni una vez en los 61 archivos.',
    ojo:
      'La escala de OKRs tienta, pero corta por porcentaje de avance y es igual para todo. Tu módulo dice que el umbral lo pone el líder del área, con una referencia y distinto según el tipo de palanca. Colgarla sin esa aclaración instala el corte genérico que el módulo viene a evitar.',
  },
  {
    modulo: 8,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_01_Start With Why_Sinek.mp4',
        formato: { tipo: 'video', minutos: 4 },
        aporta: 'El círculo dorado: por qué el propósito va antes que el producto. Es el mejor arranque para el módulo.',
      },
      {
        archivo: 'SKILL_04_Arquitectura_Narrativa.pdf',
        formato: { tipo: 'documento', palabras: 1_400 },
        aporta:
          'Por qué una organización se coordina por narrativa y no por organigrama, con la tabla de gestión tradicional contra arquitectura narrativa. Es el marco exacto del módulo.',
      },
      {
        archivo: 'SKILL_02_El Hombre en Busca de Sentido_Frankl.mp4',
        formato: { tipo: 'video', minutos: 5 },
        aporta: 'El sentido como motor. Buen material para la parte del origen.',
      },
      {
        archivo: 'El_Modelo_Zappos.mp4',
        formato: { tipo: 'video', minutos: 5 },
        aporta: 'Valores que operan de verdad, no de pared. Aterriza la clase de valores en acción.',
      },
    ],
    falta: [
      'El origen del cliente: qué lo motivó a fundar esto',
      'Las tres promesas: a colaboradores, a clientes y a accionistas',
      'La regla de los tres: si no gana para los tres a la vez, no está bien',
      'Valores en acción como conductas observables',
      'Cómo contarlo al equipo',
    ],
    accion: 'Grabarlo entero',
    tarea: 'Grabarlo. Es el módulo mejor surtido de anexos del banco: cuatro piezas para colgar como lectura previa, y ninguna reemplaza una clase.',
  },
  {
    modulo: 9,
    nivel: 'anexo',
    piezas: [
      {
        archivo: 'SKILL_06_Las 4 Disciplinas de la Ejecución 4DX.pdf',
        formato: { tipo: 'documento', palabras: 1_019 },
        aporta:
          'Los cuatro atributos de un tablero que funciona: simple, visible, que se entienda en cinco segundos y que deje sentir el progreso. Es el mejor material del banco para la clase de «qué es el tablero».',
      },
      {
        archivo: 'SKILL_13_Accountability Total para Líderes.pdf',
        formato: { tipo: 'documento', palabras: 1_980 },
        aporta:
          'El paso «Día 3: instala tableros y métricos» con su plantilla y el semáforo de estado. Es tuyo, y es lo más cerca de una clase que hay para este módulo.',
      },
    ],
    falta: [
      'Qué es el tablero y cómo se navega',
      'El breakdown de la meta anual a la semana',
      'Registrar sin miedo y anotar lo que no funciona',
      'Subir a una o dos personas de confianza',
      'El lanzamiento con narrativa: el tablero no es control, es el juego del propósito',
    ],
    accion: 'Grabar en pantalla',
    tarea: 'Grabarlo con captura de pantalla sobre un tablero real, no a cámara. Es el único módulo que no se puede grabar hablando.',
  },
  {
    modulo: 10,
    nivel: 'parcial',
    piezas: [
      {
        archivo: 'SKILL_13_Accountability Total para Líderes.pdf',
        formato: { tipo: 'documento', palabras: 1_980 },
        esClase: true,
        aporta:
          'Tu propio workbook: guion de junta diaria de 10-15 minutos, guion de junta semanal de 30-40, el check-in de energía y enfoque, y la plantilla de seguimiento. Esto sí es material de clase.',
      },
      {
        archivo: 'SKILL_10_Scaling Up_Ritmo y Cadencia de Juntas.pdf',
        formato: { tipo: 'documento', palabras: 795 },
        aporta: 'La cadencia diaria, semanal, mensual y anual, con la estructura de cada una.',
      },
      {
        archivo: 'SKILL_11_Sistema de Ejecución Empresarial.mp4',
        formato: { tipo: 'video', minutos: 6 },
        aporta: 'El sistema operativo de dirección completo, para colgar como apoyo.',
      },
    ],
    falta: [
      'Las 8 reglas para armar el sistema de juntas',
      'Que el mapa se arma por flujo de trabajo y no por organigrama',
      'Que todo acuerdo sale con responsable, fecha y qué palanca impacta',
    ],
    accion: 'Solo las 8 reglas',
    tarea: 'Grabar solo las 8 reglas. El resto del módulo se apoya en tu workbook de accountability, que ya trae los guiones.',
  },
  {
    modulo: 11,
    nivel: 'clase',
    piezas: [
      {
        archivo: 'SKILL_14_Liderazgo Gerencial.pdf',
        formato: { tipo: 'documento', palabras: 12_777 },
        esClase: true,
        aporta:
          'Conversaciones difíciles con los 7+1 pasos para escuchar y probar que escuchás, el lenguaje «yo», la escalera de inferencias, el escalamiento limpio y la mejor alternativa al acuerdo. Es el módulo entero, escrito.',
      },
      {
        archivo: 'SKILL_13_Accountability Total para Líderes.pdf',
        formato: { tipo: 'documento', palabras: 1_980 },
        esClase: true,
        aporta:
          'El checklist de conversación de integridad: describir el hecho sin juicio, explicar el impacto, pedir el plan de corrección, acordar fecha.',
      },
    ],
    falta: [
      'La ruta de consecuencias con los dos carriles y la tabla «si ves esto, haz esto»',
      'Los candados legales antes de operarla',
    ],
    accion: 'Nada: va en vivo',
    tarea: 'Nada por ahora: este módulo va en vivo. Pero es el mejor cubierto del banco — si algún día se graba, ya tienes escrito el 70 %.',
  },
  {
    modulo: 12,
    nivel: 'parcial',
    piezas: [
      {
        archivo: 'SKILL_19_Organizar Agenda en Bloques.pdf',
        formato: { tipo: 'documento', palabras: 703 },
        esClase: true,
        aporta:
          'Los seis tipos de bloque con su propósito, las duraciones recomendadas y las cinco reglas de un bloque efectivo. Es el procedimiento, no el concepto.',
      },
      {
        archivo: 'SKILL_23_Deep Work Ejecutivo para Líderes.pdf',
        formato: { tipo: 'documento', palabras: 242 },
        aporta: 'La plantilla de bloques semanales del director, con objetivo y resultado esperado de cada uno.',
      },
      {
        archivo: 'SKILL_19_Organizar Agenda en Bloques.mp4',
        formato: { tipo: 'video', minutos: 7 },
        aporta: 'El video de agenda por bloques. Ojo: está subido dos veces, también como «Time_Blocking».',
      },
      {
        archivo: 'SKILL_18_Hábitos Atómicos_James Clear.pdf',
        formato: { tipo: 'documento', palabras: 636 },
        esClase: true,
        aporta:
          'El único archivo del banco con una plantilla para llenar («Hábito nuevo: ___ / Identidad que refuerza: ___ / Anclaje: después de ___ haré ___»), y el único que nombra tu programa por dentro: habla de la «Semana de Rutinas y Rituales» y de la bitácora. Ya está escrito como material de curso.',
      },
    ],
    falta: [
      'El registro del indicador personal: broncas resueltas al día y horas en operación',
      'La prueba de las dos semanas en real, como examen de graduación',
      'El cierre del programa y el siguiente horizonte',
    ],
    accion: 'Grabar 2 clases',
    tarea: 'Grabar dos clases: la del indicador personal y la de graduación. El diseño de agenda ya está cubierto.',
  },
];

/**
 * Material que no cuelga de ningún módulo del programa — y no porque sobre.
 *
 * Son nueve archivos sobre cómo decide un cerebro (Kahneman, Dobelli, Taleb,
 * Kandel), y la pieza de Kandel dice explícitamente que están pensados como una
 * serie: uno muestra cómo piensas, otro cómo te equivocas, otro cómo te castiga
 * el mundo por eso, y el último por qué lo sigues haciendo igual.
 *
 * O sea: no son nueve archivos sueltos, es un curso corto que ya existe y que el
 * programa de 13 módulos no tiene dónde poner. Se declara como propuesta y no
 * como defecto: la decisión de qué hacer con esto es de Mauricio.
 */
export const MATERIAL_SUELTO = {
  titulo: 'Cómo decide un cerebro',
  archivos: 9,
  minutos: 47,
  /** Por qué es una unidad y no un cajón. Es la cita que lo prueba. */
  porQueEsUnaUnidad:
    'La pieza de Kandel presenta a los cuatro autores como una secuencia armada: uno explica cómo piensas, otro cómo te equivocas, otro cómo te castiga el mundo por eso, y el último por qué sigues haciéndolo aunque lo sepas.',
  propuesta:
    'Puede ir de dos maneras: como un módulo extra al final del programa, o como material de bonus abierto desde el arranque. Lo que no conviene es dejarlo suelto en el banco: es de lo mejor grabado que hay y hoy no lo encuentra nadie.',
} as const;

/** Los módulos donde el banco ahorra grabaciones de verdad. */
export const MODULOS_QUE_DESTRABA = COBERTURA
  .filter(c => c.nivel === 'parcial' || c.nivel === 'clase')
  .map(c => c.modulo);

/** Los módulos donde no hay absolutamente nada. Son los que van primero. */
export const MODULOS_EN_CERO = COBERTURA.filter(c => c.nivel === 'nada').map(c => c.modulo);

/** Las piezas que sirven como clase, sin repetir. Son las que valen la pena mirar. */
export const PIEZAS_CLASE = [
  ...new Map(
    COBERTURA.flatMap(c => c.piezas.filter(p => p.esClase)).map(p => [p.archivo, p]),
  ).values(),
];

/** Cuántas piezas del banco quedaron colgadas de algún módulo, sin repetir. */
export const PIEZAS_USADAS = new Set(COBERTURA.flatMap(c => c.piezas.map(p => p.archivo))).size;

/**
 * Lo que Mauricio tiene que hacer, en orden. Primero lo que puede hacer daño si
 * se publica, después lo que destraba la entrega.
 */
export type TareaMauricio = {
  id: string;
  titulo: string;
  /** Por qué es esta y no otra. Sin esto la lista se lee como una lista de deseos. */
  porque: string;
  /** Cómo se sabe que está hecha. */
  listoCuando: string;
  peso: 'chico' | 'medio' | 'grande';
};

export const TAREAS: TareaMauricio[] = [
  {
    id: 't1',
    titulo: 'Sacar de tres documentos el negocio y el nombre de otro cliente',
    porque:
      'Es lo único del banco que puede hacer daño publicado. Un cliente tuyo abriría el material y leería el rubro, el organigrama y el nombre de otro.',
    listoCuando: 'Los tres documentos no nombran ninguna empresa, persona ni rubro concreto.',
    peso: 'chico',
  },
  {
    id: 't2',
    titulo: 'Completar o sacar las cuatro piezas que hoy están vacías o repetidas',
    porque:
      'Dos Skills no tienen documento propio, dos están vacías (una es solo un link) y tres archivos son duplicados con otro nombre. El banco parece más grande de lo que es.',
    listoCuando: 'Cada Skill del banco tiene su documento propio, con contenido, y no hay duplicados.',
    peso: 'chico',
  },
  {
    id: 't3',
    titulo: 'Grabar Umbrales y evidencia',
    porque:
      'Es el bloqueo número uno medido en tus clientes, y ninguna de las 61 piezas lo toca. Si grabas una sola cosa, es esta.',
    listoCuando: 'Están las cuatro clases del módulo, con los ejemplos de verde, amarillo y rojo por tipo de palanca.',
    peso: 'medio',
  },
  {
    id: 't4',
    titulo: 'Grabar Tableros con captura de pantalla',
    porque:
      'Tampoco hay nada, y es el único módulo que no se puede grabar hablando a cámara: hay que navegar un tablero real mientras se explica.',
    listoCuando: 'Se ve el tablero en pantalla, se registra un dato y se muestra el corte de la meta anual a la semana.',
    peso: 'medio',
  },
  {
    id: 't5',
    titulo: 'Grabar Tu negocio en números',
    porque: 'Es el módulo que arranca el programa y es el otro que está en cero.',
    listoCuando: 'El cliente puede salir de ahí con su ficha de números y las líneas base marcadas.',
    peso: 'medio',
  },
  {
    id: 't6',
    titulo: 'Escribir qué es el ejercicio de «back to the future»',
    porque:
      'Aparece en el temario del módulo de apertura y no está definido en ningún lado: ni en el banco, ni en el documento del programa, ni en las juntas que tenemos grabadas. Sin la definición no se puede escribir la clase ni la tarea.',
    listoCuando: 'Hay un párrafo que dice qué se le pide al cliente y en qué se diferencia del ejercicio de venir del futuro.',
    peso: 'chico',
  },
  {
    id: 't7',
    titulo: 'Decidir dónde vive la carta de expectativas',
    porque:
      'Hoy está en dos módulos a la vez: en Objetivos por área, que se graba, y en Accountability, que va en vivo. El cliente la haría dos veces o ninguna.',
    listoCuando: 'La carta aparece en un solo módulo, y el otro la referencia.',
    peso: 'chico',
  },
];

/** El módulo del documento, por número. */
export function moduloDoc(numero: number) {
  return MODULOS_DOC.find(m => m.numero === numero) ?? null;
}

/** La cobertura de un módulo del documento, por número. */
export function coberturaDe(numero: number): Cobertura | null {
  return COBERTURA.find(c => c.modulo === numero) ?? null;
}

/**
 * En qué se diferencian el programa del DOCUMENTO y el que está cargado en la
 * plataforma. Se calcula, no se escribe: si alguien aplica el documento al
 * catálogo, esta lista se vacía sola y la advertencia desaparece de la tab.
 *
 * ⚠️ Es lo primero que hay que resolver, y no tiene nada que ver con grabar: hoy
 * un mismo número de módulo nombra dos cosas distintas según dónde se lo mire.
 */
export type Desajuste = {
  numero: number;
  /** Cómo se llama en el documento que escribió Mauricio. */
  enDocumento: string | null;
  /** Cómo se llama en el catálogo cargado en la plataforma. */
  enPlataforma: string | null;
};

export const DIVERGENCIA: Desajuste[] = (() => {
  const topes = Math.max(
    ...MODULOS_DOC.map(m => m.numero),
    ...PROGRAMA.map(m => m.numero),
  );
  const filas: Desajuste[] = [];
  for (let n = 0; n <= topes; n++) {
    const doc = MODULOS_DOC.find(m => m.numero === n)?.titulo ?? null;
    const plat = PROGRAMA.find(m => m.numero === n)?.titulo ?? null;
    // Solo interesa lo que NO coincide. La comparación es laxa a propósito
    // («Las 2 MCI» y «Las dos MCIs» son el mismo módulo): lo que se busca son
    // los números que nombran módulos distintos, no las diferencias de tipeo.
    const normal = (s: string | null) =>
      s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '') ?? '';
    const a = normal(doc), b = normal(plat);
    if (a && b && (a.startsWith(b) || b.startsWith(a))) continue;
    if (a === b) continue;
    filas.push({ numero: n, enDocumento: doc, enPlataforma: plat });
  }
  return filas;
})();
