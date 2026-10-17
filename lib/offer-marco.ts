// =============================================================================
// offer-marco — el marco de OFERTA de MaKo: piezas, rúbrica, plantilla y tipos
// =============================================================================
// SIN `server-only` A PROPÓSITO: lo importan la pantalla de /offer (los rótulos
// de las piezas y de las dimensiones), el PDF, el motor de IA y los tests. Es la
// ÚNICA fuente del marco (AGENTS.md § «Una cosa, un lugar»): si el prompt dijera
// «13 piezas» y la pantalla dibujara 12, el chat preguntaría por algo que la
// barra de progreso nunca marca.
//
// De dónde sale: docs/offer-marco.md, la destilación de los cursos de la casa
// sobre oferta (Sofía Contreras · MasteryHaus, Marcos Razzetti · BlueHacker,
// Ramiro Cubría y Matías Molina · Sell Your Knowledge, Juan Carrizo · ATV,
// Hormozi, Maffia, Caicedo y un barrido de otros doce). Ese documento tiene el
// porqué de cada regla y a qué autor se le debe; acá vive sólo lo que el código
// necesita como VALOR.
//
// ⚠️ Las `key` de piezas y dimensiones viajan guardadas en `offer_sesiones`
// (piezas, conclusion). Cambiar una key deja huérfanas las sesiones viejas: se
// puede cambiar el `label`, la key no.
// =============================================================================

import type { Diagnostico as DiagnosticoFase } from './fase-diagnostico';

// ── Las piezas de una oferta ─────────────────────────────────────────────────
// Eran 13; el 12/10/2026 se sumaron siete con las respuestas de Martín a «A definir» del Offer Playbook:
// `ventas` (mínima: cuántos pagaron; antes compartía la pieza con «cuántos lograron el resultado» y la
// segunda pregunta se salteaba), `valor`, `costo`, `semana` y `cobro` (las cuatro preguntas del §3 que
// destraban precio, entrega y esfuerzo), `escalera` (qué vende antes y después: la escalera de valor) y
// `otras` (las ofertas que vende además de ésta, aunque no estén cargadas: entran al aviso de foco).
// Van como piezas APARTE y no adentro de las que ya había porque `mergePiezas` REEMPLAZA el texto de una
// pieza: el valor anual anotado en `resultado` borraría el resultado, y el % al firmar borraría el precio.

export type PiezaKey =
  | 'cliente' | 'problema' | 'resultado' | 'objecion' | 'mecanismo'
  | 'entregables' | 'semana' | 'formato' | 'ventas' | 'prueba'
  | 'precio' | 'cobro' | 'valor' | 'costo' | 'garantia' | 'bonos' | 'urgencia'
  | 'frase' | 'escalera' | 'otras';

export type Pieza = {
  key: PiezaKey;
  /** Una o dos palabras: es lo que se DIBUJA en la barra de progreso. */
  label: string;
  /** Qué es, en una frase. Va al prompt, no a la pantalla. */
  que: string;
  /** Sin esto no hay análisis posible (marca [mín] del marco). */
  minimo: boolean;
};

export const PIEZAS: readonly Pieza[] = [
  { key: 'cliente', label: 'Cliente', minimo: true, que: 'Para quién es (y para quién no): un grupo concreto que comparte el problema, puede pagar y decide solo.' },
  { key: 'problema', label: 'Problema', minimo: true, que: 'El dolor urgente que hoy lo separa de lo que quiere; lo que ya intentó resolver solo.' },
  { key: 'resultado', label: 'Resultado', minimo: true, que: 'La transformación: un resultado principal, con número y plazo, que el programa alcanza a cumplir.' },
  { key: 'objecion', label: 'Objeción', minimo: false, que: 'La barrera que quiere evitar, quitada desde la promesa («sin…»).' },
  { key: 'mecanismo', label: 'Método', minimo: false, que: 'El cómo propio: 3 a 6 pasos y por qué esta vez sí funciona.' },
  { key: 'entregables', label: 'Entregables', minimo: true, que: 'La ruta en fases con hitos y lo concreto que recibe en cada una.' },
  { key: 'semana', label: 'Primera semana', minimo: false, que: 'Qué logra el cliente en su primera semana: el primer resultado rápido.' },
  { key: 'formato', label: 'Formato', minimo: false, que: 'Cómo se entrega y QUIÉN HACE EL TRABAJO: 1 a 1, grupal o grabado; el cliente solo (curso), con acompañamiento, o el negocio por él; soporte y duración.' },
  { key: 'ventas', label: 'Ventas', minimo: true, que: 'Cuántas personas ya pagaron esta oferta tal como está hoy.' },
  { key: 'prueba', label: 'Prueba', minimo: true, que: 'Cuántos clientes lograron el resultado y con qué números; casos del mismo cliente.' },
  { key: 'precio', label: 'Precio', minimo: true, que: 'Cuánto cuesta y cómo se paga.' },
  { key: 'cobro', label: 'Cobro al firmar', minimo: false, que: 'Qué parte del precio le pagan el día que firma (el % cobrado al firmar).' },
  { key: 'valor', label: 'Valor', minimo: false, que: 'Cuánto dinero gana o ahorra el cliente en un año gracias al resultado.' },
  { key: 'costo', label: 'Costo', minimo: false, que: 'Cuánto le cuesta atender a un cliente (equipo, herramientas, comisiones) y cuántos puede atender a la vez.' },
  { key: 'garantia', label: 'Garantía', minimo: false, que: 'Qué arriesga el negocio si el cliente cumple y no llega.' },
  { key: 'bonos', label: 'Bonos', minimo: false, que: 'Extras que atacan una objeción concreta (no son los entregables).' },
  { key: 'urgencia', label: 'Urgencia', minimo: false, que: 'Una razón REAL para decidir hoy: cohorte, cupos por capacidad, subida de precio.' },
  { key: 'frase', label: 'La frase', minimo: false, que: 'La oferta entera en una frase que un extraño entiende.' },
  { key: 'escalera', label: 'Escalera', minimo: false, que: 'Dónde va esta oferta en su escalera: lo que vende antes (más barato) y lo que vende después (el escalón siguiente, más caro, o la continuidad).' },
  { key: 'otras', label: 'Otras ofertas', minimo: false, que: 'Cuántas ofertas vende además de ésta, aunque no estén cargadas en MaKo.' },
] as const;

export const PIEZA_KEYS: readonly PiezaKey[] = PIEZAS.map((p) => p.key);
export const PIEZAS_MINIMAS: readonly PiezaKey[] = PIEZAS.filter((p) => p.minimo).map((p) => p.key);
export const esPiezaKey = (v: unknown): v is PiezaKey => typeof v === 'string' && (PIEZA_KEYS as readonly string[]).includes(v);
export const piezaLabel = (k: PiezaKey): string => PIEZAS.find((p) => p.key === k)?.label ?? k;

// ── La rúbrica: 9 dimensiones de 0 a 10 ──────────────────────────────────────

export type DimensionId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9';

export type Dimension = {
  id: DimensionId;
  /** Lo que se dibuja al lado de la barra. */
  label: string;
  mide: string;
  bajo: string;   // 0-3
  medio: string;  // 4-6
  alto: string;   // 7-10
  /** Las señales de alerta del §4 del marco (van al prompt). */
  alerta: string;
  /** La pregunta que la destraba (va al prompt). */
  destraba: string;
};

/**
 * La rúbrica con los NÚMEROS del §4 de docs/offer-marco.md (decisión de Martín, 12/10/2026, tarjeta
 * «anclas»): sin ellos cada IA califica a su manera, y cobrar el 100% al firmar sacaba nota alta en D7
 * cuando para el marco es señal de precio barato. Las señales de alerta y la pregunta que destraba cada
 * dimensión también viajan al prompt (`MARCO_OFERTA_TEXTO`).
 */
export const DIMENSIONES: readonly Dimension[] = [
  { id: 'D1', label: 'Cliente ideal', mide: 'Qué tan específico es, si puede pagar y si le duele.',
    bajo: '«Emprendedores», «cualquiera», varios avatares; no puede pagar el ticket.',
    medio: 'Rubro o rol definido, pero falta el nivel o la situación; capacidad de pago dudosa.',
    alto: 'Tres niveles de especificidad; se reconoce en el nombre; Dinero × Dolor × Acceso de 75 o más; dice para quién no es.',
    alerta: 'Principiantes sin ingresos, nicho en declive, decisor lejano, nombre con jerga.',
    destraba: 'Piensa en tus 3 mejores clientes: ¿a qué se dedican?' },
  { id: 'D2', label: 'Promesa', mide: 'Si promete un resultado medible, con plazo, sobre un dolor urgente, y si es creíble.',
    bajo: 'Vende el vehículo (curso, sesiones, «hacer anuncios») o una emoción vaga («plenitud»); sin plazo.',
    medio: 'Resultado claro sin número o sin plazo, o dos resultados en una frase; problema agradable de resolver pero no urgente.',
    alto: 'Un resultado con número y plazo que el programa alcanza; dolor que ya intentaron resolver; un extraño lo entiende.',
    alerta: 'Promesa imposible o tomada del mejor caso; dos fechas; jerga técnica.',
    destraba: '¿Con qué número se nota que tu cliente logró el resultado?' },
  { id: 'D3', label: 'Diferenciación', mide: 'Si el cliente puede compararte con otro o no.',
    bajo: 'Suena igual que todos; compite por precio; «no tengo competencia».',
    medio: 'Tiene método, pero sin nombre o sin explicar por qué es distinto.',
    alto: 'Mecanismo con nombre descriptivo, pasos claros y por qué falló lo que probó antes; encaja con la sofisticación del mercado.',
    alerta: 'Copiado de un gurú; nombre de promoción o siglas; el método se llama como la empresa.',
    destraba: '¿Qué probó tu cliente antes y por qué tu forma es distinta?' },
  { id: 'D4', label: 'Certeza', mide: 'Cuánto cree el cliente que lo va a lograr (prueba y riesgo).',
    bajo: 'Sin casos y sin garantía.',
    medio: 'Testimonios genéricos o de otro avatar; garantía vaga.',
    alto: 'Casos del mismo avatar con números de antes y después; garantía condicional atada a hitos; autoridad visible.',
    alerta: 'Garantía sin un método probado detrás; garantía que no le pide nada al cliente; testimonios forzados.',
    destraba: '¿Cuántos clientes parecidos a tu cliente ideal lograron el resultado, y con qué números?' },
  { id: 'D5', label: 'Esfuerzo y tiempo', mide: 'Cuánto le cuesta llegar, en trabajo y en espera.',
    bajo: 'Todo lo hace solo, sin hitos, resultado después de varios meses.',
    medio: 'Hay ruta, pero sin resultado rápido; el cliente carga mucho trabajo.',
    alto: 'Ruta de 3 a 5 fases con hitos, primer resultado en días, plantillas o parte hecha por el negocio.',
    alerta: '«Más contenido» como solución; acceso de por vida a una biblioteca.',
    destraba: '¿Qué logra tu cliente en su primera semana?' },
  { id: 'D6', label: 'Entrega sostenible', mide: 'Si se puede entregar igual a muchos clientes y con margen.',
    bajo: 'Todo a medida, margen por debajo del 30%, el dueño está en todo.',
    medio: 'Paquete definido con límites borrosos (1 a 1 sin reglas) o margen entre 30% y 60%.',
    alto: 'Productizada (entregables, duración y soporte fijos), margen bruto de 70% a 80% o más, capacidad clara.',
    alerta: '1 a 1 ilimitado; una «bolsa» de entregables; soporte 24/7 prometido sin equipo.',
    destraba: '¿Cuánto te cuesta atender a un cliente y cuántos puedes atender a la vez?' },
  { id: 'D7', label: 'Precio y cobro', mide: 'Si el precio sale del valor y si el cobro sostiene la caja.',
    bajo: 'Precio por horas o por competencia, o menos de 1.000 USD en high ticket; cuotas desde el inicio.',
    medio: 'Precio razonable que no se justifica con el valor; sin datos de fricción.',
    alto: 'El valor del resultado es entre 5 y 10 veces el precio o más y se muestra con números; se cobra entre 50% y 75% al firmar; el plan de pagos no dura más que el programa.',
    alerta: 'Todos dicen que sí y nadie pide cuotas (está barato); más de 75% cobrado al firmar (está barato); menos de 50% cobrado al firmar aunque el proceso de venta es bueno (está caro o el cliente es el equivocado); 12 cuotas; el mismo precio desde hace un año.',
    destraba: '¿Cuánto dinero gana o ahorra tu cliente en un año gracias al resultado?' },
  { id: 'D8', label: 'Razón para decidir', mide: 'Si hay un motivo real y valioso para decidir hoy (bonos y urgencia).',
    bajo: 'No hay motivo, o la urgencia es falsa.',
    medio: 'Bonos genéricos o un descuento sin explicación.',
    alto: '1 a 3 bonos que atacan objeciones concretas y un motivo real: cohorte, cupos según la capacidad o subida de precio programada.',
    alerta: '«Últimos cupos» permanentes; descuentos en lugar de bonos; bonos sin relación con el problema.',
    destraba: '¿Tienes cupos o una fecha de inicio reales?' },
  { id: 'D9', label: 'Foco', mide: 'Si el negocio empuja una sola oferta.',
    bajo: 'Tres o más ofertas o nichos a la vez; ofertas baratas que le quitan ventas a la principal.',
    medio: 'Una oferta principal con variantes a medida o un segundo nicho.',
    alto: 'Un nicho, una oferta, un mensaje; lo demás aparece sólo como alternativa en la llamada o queda para la fase 2.',
    alerta: 'Escalera de valor antes de validar; cambiar de oferta cada mes sin datos; cambiar precio, anuncio y landing al mismo tiempo.',
    destraba: 'Si este trimestre solo pudieras vender una cosa, ¿cuál sería?' },
] as const;

export const DIMENSION_IDS: readonly DimensionId[] = DIMENSIONES.map((d) => d.id);
export const esDimensionId = (v: unknown): v is DimensionId => typeof v === 'string' && (DIMENSION_IDS as readonly string[]).includes(v);
export const dimensionLabel = (id: DimensionId): string => DIMENSIONES.find((d) => d.id === id)?.label ?? id;

/** Las tres que la llamada de venta no puede arreglar (cliente, promesa, certeza). */
export const DIMENSIONES_CRITICAS: readonly DimensionId[] = ['D1', 'D2', 'D4'];

// ── La conversación ──────────────────────────────────────────────────────────

/**
 * Qué pasó al guardar el documento TAMBIÉN en El Archivero (decisión de Martín, Ticketera 15/10/2026 05:32,
 * ref `offer-archivero`). Lo escribe la ruta POR DETRÁS, cuando termina: sin el campo, todavía no terminó
 * o el documento no va al Archivero (una nota de voz, la página de un link). `ok: false` se dibuja en el
 * chip del archivo; NUNCA entra a un prompt (la IA lee el texto del documento, no esto).
 */
export type ArchiveroDoc = { ok: true; id: string; aviso?: string } | { ok: false; motivo: string };

/** Un adjunto ya leído. El texto NO viaja a la pantalla: vive en `documentos`. */
export type AdjuntoVista = { id: string; nombre: string; via: string; chars: number; aviso?: string; archivero?: ArchiveroDoc };

export type OfferMensaje = {
  id: string;
  de: 'mako' | 'yo';
  texto: string;
  /** ISO. */
  at: string;
  /** Respuestas rápidas que MaKo ofrece (sólo en mensajes de MaKo). */
  opciones?: string[];
  /**
   * Las `opciones` se SUMAN (16/10/2026): el dueño marca varias y las manda juntas («Un curso grabado y una
   * mentoría»). Es la pregunta de qué otras ofertas vende, y las que se le parecen. Nunca en una del diagnóstico
   * (ésas tienen UNA respuesta). La pantalla que no lo lee (MaKo Mobile) sigue con un toque, una opción.
   */
  varias?: true;
  /** Los documentos que se mandaron con este mensaje. */
  adjuntos?: AdjuntoVista[];
  /**
   * Un mensaje del dueño que se DICTÓ (v2). `texto` es la TRANSCRIPCIÓN; `url` reproduce el binario
   * (`/api/offer/audio?id=<sesionId>&m=<mensajeId>`, que redirige a una URL firmada de Storage).
   * ⚠️ Para un `<audio src>` la pantalla le pega el `?ws=` con `conWs(url, useWs())`: no es un fetch, así
   * que el parche de WsFetch no lo toca, y sin el parámetro el super admin que mira a un cliente recibe 403.
   */
  audio?: { url: string; secs: number };
  /**
   * Marca una pregunta del DIAGNÓSTICO DE FASE (lib/fase-diagnostico.ts) hecha adentro del chat (v2).
   * Las `opciones` de ese mensaje son las respuestas PERSONALIZADAS, en el MISMO orden que las originales:
   * la opción N es la respuesta N del diagnóstico. Sin «Armar mi oferta» entre ellas.
   */
  pregunta?: { tipo: 'diagnostico'; id: string };
  /**
   * En un mensaje del DUEÑO: la opción que eligió de una pregunta del diagnóstico (v2). `idx` es el índice
   * de la opción ORIGINAL (0-4). `inferida` = no tocó la opción: lo dijo con sus palabras (o por audio) y
   * MaKo lo leyó así.
   */
  respuesta?: { preguntaId: string; idx: number; inferida?: boolean };
  /**
   * En un mensaje de MaKo: el PDF de esa VERSIÓN de la oferta (12/10/2026, pedido de Martín: «que MaKo en el
   * mismo chat te proponga pulir la oferta, y que cuando se haya pulido te re-envíe el PDF las veces que sea
   * necesario»). Lo agrega el servidor después de cada «generar». La pantalla lo baja de
   * `GET /api/offer/pdf?id=<sesión>&v=<version>` (con el `?ws=` de la pestaña, como el audio).
   */
  pdf?: { version: number };
};

/** Qué sabe MaKo de cada pieza y de dónde lo sacó. */
export type FuentePieza = 'negocio' | 'chat' | 'doc';
export type PiezaSabida = { valor: string; fuente: FuentePieza; at: string };
export type PiezasSabidas = Partial<Record<PiezaKey, PiezaSabida>>;

// ── La conclusión: diagnóstico (Analyst) + oferta nueva (Generator) ──────────

export type NotaDimension = {
  id: DimensionId;
  /** Entero 0-10. */
  nota: number;
  /** Por qué esa nota, en una o dos frases, citando lo que dijo el dueño. */
  porque: string;
  /** Qué la sube, en una frase. */
  mejora: string;
};

/** Un cambio propuesto. Se presenta como HIPÓTESIS: se prueba en Experiments. */
export type CambioPropuesto = { titulo: string; porque: string; hipotesis: string };

export type DiagnosticoOferta = {
  dimensiones: NotaDimension[];
  /** La lectura en una frase (el «titular» del diagnóstico). */
  tesis: string;
  /** Lo mejor que ya tiene la oferta actual, en una frase (la primera de `fuertes`; la leen la pantalla y el teléfono). */
  fuerte: string;
  /**
   * Lo que la oferta actual YA hace bien, de 1 a 3, cada una citando al dueño (16/10/2026, feedback de la llamada con
   * Leila: «de tu oferta me gustó esto, esto y esto»). Opcional: las conclusiones de antes sólo tienen `fuerte`.
   */
  fuertes?: string[];
  /** Los 3 cambios con más impacto, del más importante al menos. */
  cambios: CambioPropuesto[];
};

/** Lo que calcula el CÓDIGO sobre el diagnóstico — nunca el modelo. */
export type CalculoDiagnostico = {
  /** 0-100: el promedio de las 9 notas × 10, redondeado. */
  total: number;
  /** La dimensión más baja; con empate, la que está más arriba en el orden. */
  cuello: DimensionId;
  /** Ninguna por debajo de 5, D1, D2 y D4 en 7 o más y, si hay `controlFinal`, sus cinco puntos en ok. */
  lista: boolean;
  /** Avisos deterministas (foco, cliente o promesa muy flojos, margen, embudo, precio). Una frase cada uno. */
  alertas: string[];
  /**
   * El «Check final» de Contreras (§4 del marco), DETERMINISTA: dolor urgente, resultado medible,
   * entregables concretos, garantía fuerte y precio por valor, con las notas y las piezas. Sin un punto en
   * ok no está «lista para vender», y `porque` dice qué falta. Ausente en las conclusiones anteriores al
   * 12/10/2026.
   */
  controlFinal?: PuntoControlFinal[];
};

/**
 * Los avisos guardados que se pueden MOSTRAR: ninguno que afirme un porcentaje arriba de 100. Las versiones
 * guardadas antes del 14/10/2026 pueden traer «Cierras el 170% de las llamadas calificadas» (los calificados
 * eran un piso; lo arregla `cierreConfiable`, lib/offer-reglas.ts), y el PDF, la pantalla y la API de MaKo
 * leen lo guardado. Lo usan los tres; un lector nuevo de `calculo.alertas` también.
 */
export function avisosAfirmables(alertas: readonly unknown[] | null | undefined): string[] {
  return (alertas ?? [])
    .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
    .filter((a) => ![...a.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].some((m) => Number(m[1].replace(',', '.')) > 100));
}

export type PuntoControl = 'dolor' | 'resultado' | 'entregables' | 'garantia' | 'precio';
export type PuntoControlFinal = { punto: PuntoControl; ok: boolean; porque: string };

/** Los cinco puntos del control final, en el orden del marco, con el nombre que ve el dueño. */
export const PUNTOS_CONTROL: ReadonlyArray<{ punto: PuntoControl; label: string }> = [
  { punto: 'dolor', label: 'Dolor urgente' },
  { punto: 'resultado', label: 'Resultado medible' },
  { punto: 'entregables', label: 'Entregables concretos' },
  { punto: 'garantia', label: 'Garantía fuerte' },
  { punto: 'precio', label: 'Precio por valor' },
];

// ── «Tu oferta hoy» (16/10/2026) ────────────────────────────────────────────
// Feedback de Martín en la llamada con Leila (12/10, 00:45:30): el PDF tiene que decir primero, de la oferta de HOY,
// «me gustó esto, esto y esto, y esto lo cambiaría y lo haría de tal forma», y aparte «esta es la propuesta que yo te
// armo». Lo que va en la primera parte lo arman estas dos funciones con lo que YA dejó el diagnóstico: no hay IA nueva.

/** Una nota alta (7 o más) es algo que la oferta ya hace bien; una baja (5 o menos), lo que más conviene subir. */
const NOTA_FUERTE = 7;
const NOTA_FLOJA = 5;

/**
 * LO QUE ME GUSTÓ de la oferta de hoy: lo que el diagnóstico marcó como fuerte (`fuertes`, o `fuerte` en las
 * conclusiones de antes), las dimensiones con nota alta (con su porqué, que cita al dueño) y los puntos del control
 * final que ya cumple. Sin repetidas y con tope: es una lista para leer, no el diagnóstico entero.
 */
export function loQueMeGusto(c: Pick<ConclusionOferta, 'diagnostico' | 'calculo'>, tope = 6): string[] {
  const d = c.diagnostico;
  const etiqueta = (id: DimensionId) => DIMENSIONES.find((x) => x.id === id)?.label ?? id;
  const out = [
    ...(d.fuertes?.length ? d.fuertes : d.fuerte ? [d.fuerte] : []),
    ...d.dimensiones.filter((n) => n.nota >= NOTA_FUERTE && n.porque?.trim()).map((n) => `${etiqueta(n.id)}: ${n.porque.trim()}`),
    ...(c.calculo.controlFinal ?? []).filter((x) => x.ok && x.porque?.trim()).map((x) => x.porque.trim()),
  ].map((s) => s.trim()).filter(Boolean);
  return [...new Set(out)].slice(0, tope);
}

/**
 * PARA SUBIR CADA PARTE: las dimensiones flojas (5 o menos), de la más baja a la más alta, con lo que las sube
 * (`mejora`). Es el «cómo» de lo que cambiaría, parte por parte; antes sólo se veía en la pantalla.
 */
export function paraSubirCadaParte(c: Pick<ConclusionOferta, 'diagnostico'>, tope = 4): Array<{ label: string; nota: number; mejora: string }> {
  return c.diagnostico.dimensiones
    .filter((n) => n.nota <= NOTA_FLOJA && n.mejora?.trim())
    .sort((a, b) => a.nota - b.nota)
    .slice(0, tope)
    .map((n) => ({ label: DIMENSIONES.find((x) => x.id === n.id)?.label ?? n.id, nota: n.nota, mejora: n.mejora.trim() }));
}

export type FaseRuta = { fase: string; objetivo: string; hito: string };
export type Entregable = { nombre: string; beneficio: string };
export type BonoPropuesto = { nombre: string; objecion: string; valor: string };
export type VariableValor = 'resultado' | 'probabilidad' | 'tiempo' | 'esfuerzo';
export type EcuacionFila = { variable: VariableValor; antes: string; despues: string };

/**
 * La oferta nueva, sección por sección (plantilla §5 de docs/offer-marco.md).
 * Todo dato que el dueño no dio y que no se puede deducir va como «[completar]»:
 * MaKo NUNCA inventa testimonios, cifras de casos, valores de bonos ni cupos.
 */
export type PropuestaOferta = {
  nombre: string;
  frase: string;
  mensajes: { corto: string; largo: string; entrada: string };
  paraQuien: { perfil: string; minimo: string; noEs: string };
  problema: { hoy: string; despues: string; obstaculos: string[]; yaProbo: string };
  mecanismo: { nombres: string[]; pasos: string[]; distinto: string };
  ruta: FaseRuta[];
  incluye: Entregable[];
  formato: string;
  prueba: string;
  garantia: { nombre: string; condiciones: string; plazo: string; siNoCumple: string };
  bonos: BonoPropuesto[];
  inversion: { valorTotal: string; precio: string; contado: string; plan: string; comoDecirlo: string };
  urgencia: string;
  escenarios: { mejor: string; peor: string };
  ecuacion: EcuacionFila[];
  numeros: string[];
  validar: string[];
  siguiente: string;
  /** Los datos que quedaron como «[completar]», en lenguaje simple. */
  completar: string[];
  /**
   * Lo que MaKo PROPUSO y el negocio no dijo (un precio, una garantía, los nombres del método, las fases,
   * los bonos, un plazo…): el PDF lo lista al final, separado de «Datos a completar» (decisión de Martín,
   * 12/10/2026, tarjeta «supuestos»). Lo escribe el modelo y el código le suma lo que sabe con certeza.
   * Ausente en las conclusiones anteriores.
   */
  propuestoPorMako?: Array<{ seccion: string; que: string }>;
  /** Lo que el dueño dijo que NO sabe («sin dato»): queda como supuesto, a la vista. Lo arma el código. */
  supuestos?: string[];
  /**
   * Las reglas del marco que la propuesta no cumple y el código no pudo corregir (duración fuera de 90 a
   * 180 días, precio por debajo de 1.000 USD, garantía incondicional…). Lo arma el código; el PDF lo
   * muestra antes de la oferta.
   */
  avisos?: string[];
};

export const MARCA_COMPLETAR = '[completar]';

export type ConclusionOferta = {
  diagnostico: DiagnosticoOferta;
  calculo: CalculoDiagnostico;
  propuesta: PropuestaOferta;
  /** Número de versión dentro de la sesión (1, 2, …): afinar y volver a concluir no pisa la anterior. */
  version: number;
  /** ISO. */
  at: string;
  /** Proveedor/modelo que contestó (para el Saldo de IA y para auditar). */
  modelo: string;
  /**
   * El diagnóstico de FASE del negocio (v2), congelado al armar esta versión: el que el dueño contestó en
   * esta conversación o, si el negocio ya lo tenía, el guardado. Va al PDF («El diagnóstico de tu
   * negocio»); en el chat NO se muestra. Ausente en las conclusiones de la v1.
   */
  fase?: DiagnosticoFase | null;
  /**
   * v2: si se armó la oferta SIN diagnóstico de fase (no estaba guardado y el dueño no contestó todas las
   * preguntas en el chat), cuántas contestó de cuántas. El PDF lo dice en vez de omitir la sección en
   * silencio. Ausente (o null) cuando hay `fase`, y en las conclusiones de la v1.
   */
  diagnosticoFaltante?: { contestadas: number; total: number } | null;
  /**
   * Con el Cliente ideal o la Promesa en 3 o menos, la oferta sale completa pero con estas partes
   * PROVISIONALES (decisión de Martín, 12/10/2026, tarjeta «rehacer»: «C»): dependen de arreglar lo primero.
   * El PDF las marca y el mensaje del PDF propone pulirla empezando por ahí. Ausente o null si no aplica.
   */
  provisional?: { partes: Array<'precio' | 'bonos'>; motivo: string } | null;
};

// ── Lo que ve la pantalla de una sesión ──────────────────────────────────────

export type EstadoSesion = 'conversando' | 'concluida';

export type OfferSesionVista = {
  id: number;
  titulo: string;
  estado: EstadoSesion;
  mensajes: OfferMensaje[];
  piezas: PiezasSabidas;
  docs: AdjuntoVista[];
  /** La conclusión vigente (la última versión), o null. */
  conclusion: ConclusionOferta | null;
  /** Cuántas versiones de conclusión hay guardadas. */
  versiones: number;
  /** Id de la fila de `ofertas` si se guardó como oferta del negocio. */
  ofertaId: number | null;
  /** Lo calcula el código: están las piezas mínimas. */
  puedeConcluir: boolean;
  updatedAt: string;
  /** v2: el FUNNEL (fila de `funnels`, el desplegable del CRM) al que está atada; null en las de la v1. */
  funnelId: number | null;
  /** El nombre como lo muestra el CRM: el producto principal del funnel, si no el nombre del funnel. '' si no se pudo leer. */
  funnelNombre: string;
  /** La oferta existente que se analiza (modo 'analizar'), o null. */
  ofertaBaseId: number | null;
  ofertaBaseNombre: string;
  /** 'analizar' si parte de una oferta que ya existe; 'crear' si arma una nueva. Se DERIVA de `ofertaBaseId`. */
  modo: ModoSesion;
  /**
   * La columna CRUDA `oferta_id`: la última oferta que se guardó desde esta conversación, de la versión que
   * sea. Es la que usa `construirArbol` para ubicar la conversación bajo su oferta. `ofertaId` (arriba) vale
   * sólo si lo guardado es la versión VIGENTE; las dos existen porque contestan preguntas distintas.
   */
  ofertaGuardadaId: number | null;
  /**
   * false SÓLO si tocar «Guardar en este funnel» lo puede arreglar: hay oferta guardada (`ofertaGuardadaId`),
   * la conversación tiene funnel, ese funnel existe y la oferta NO está en `funnel_ofertas` de ese funnel
   * (la liga había fallado). true en todo lo demás: v1 sin funnel, nada guardado, ya ligada, o el funnel se
   * borró (reintentar no lo arregla). ⚠️ La lectura es TOLERANTE: si falla, true — mostrar «Guardada» de
   * más es un rótulo; invitar a reintentar en falso es mandar a repetir algo que no se arregla repitiendo.
   */
  ligada: boolean;
  /**
   * El armado en el servidor (mig 0296, `armadoParaVista` en lib/offer-reglas.ts): en curso con su paso, o
   * fallido con el error. null = no hay ninguno. Mientras corre, la pantalla relee hasta que aparezca la
   * conclusión: el armado sigue aunque la persona cierre la pestaña.
   */
  armando: ArmadoVista | null;
};

/** El paso del armado de la oferta en el servidor. */
export type PasoArmado = 'diagnostico' | 'oferta';
export type ArmadoVista = { paso: PasoArmado; corriendo: boolean; error: string | null };

export type ModoSesion = 'crear' | 'analizar';

export type OfferSesionResumen = { id: number; titulo: string; estado: EstadoSesion; total: number | null; updatedAt: string };

/**
 * El selector de la tab, en árbol (v2): funnel → sus ofertas → sus conversaciones.
 *
 * «Funnel» = una fila de `funnels` (lo que el CRM dibuja en su desplegable). Sus ofertas salen de
 * `funnel_ofertas` (mig 0171). `sesionesNuevas` = conversaciones de ese funnel que todavía no son de
 * ninguna oferta suya (crear una nueva, o una que se guardó como una oferta que ya no está en el funnel).
 * `sueltas` = las de la v1 (sin funnel) y las de un funnel que se archivó. Cada conversación aparece UNA
 * sola vez (lo decide `construirArbol`, lib/offer-reglas.ts).
 */
export type ArbolOffer = {
  funnels: Array<{
    id: number;
    nombre: string;
    ofertas: Array<{ id: number; nombre: string; principal: boolean; sesiones: OfferSesionResumen[] }>;
    sesionesNuevas: OfferSesionResumen[];
  }>;
  sueltas: OfferSesionResumen[];
};

/** ¿Están las piezas sin las que no hay análisis? (lo decide el código, no el modelo) */
export function faltanMinimas(piezas: PiezasSabidas): PiezaKey[] {
  return PIEZAS_MINIMAS.filter((k) => !piezas[k]?.valor?.trim());
}

/**
 * LO QUE PREGUNTA EL ONBOARDING (17/10/2026). Martín: «Sería bueno que la funcionalidad de "OFFER" no esté en el
 * onboarding... Pero simular "Offer" en el onboarding simplemente para organizar en un PDF lo que vende el usuario. Y
 * eso le sirve a MaKo para crear las cosas que necesite». El arranque conversa como Offer, pero sólo hasta saber QUÉ
 * VENDE: qué es y qué recibe, para quién, qué le resuelve, qué logra y cuánto cuesta. Sin las piezas del análisis
 * (cuántos pagaron, cuántos lograron el resultado, valor, costo, escalera), sin el diagnóstico de la oferta y sin la
 * oferta mejorada: eso se hace después, en la tab Offer, sobre la MISMA conversación.
 */
export const PIEZAS_DEL_ARRANQUE: readonly PiezaKey[] = ['entregables', 'cliente', 'problema', 'resultado', 'precio'];

/** Las piezas del arranque que faltan. «sin dato: …» cuenta como contestada (la persona ya dijo que no lo sabe). */
export function faltanDelArranque(piezas: PiezasSabidas): PiezaKey[] {
  return PIEZAS_DEL_ARRANQUE.filter((k) => !piezas[k]?.valor?.trim());
}

// ── El marco, en el texto que leen los modelos ───────────────────────────────
// Compacto a propósito: viaja en CADA turno del chat. El detalle largo y las
// discrepancias entre autores viven en docs/offer-marco.md.
//
// 12/10/2026 (respuestas de Martín a «A definir»): la rúbrica lleva los números del §4, las señales de
// alerta y la pregunta que destraba cada dimensión (tarjeta «anclas»); las reglas suman las de cobro y
// bonos que antes no llegaban (tarjeta «cobro»). La garantía NO exige los 10 a 15 casos de Molina (tarjeta
// «garantia»: «nadie dijo que no la pudiesen pagar»): con casos ya puede ser condicional fuerte, y ningún
// texto que lee la IA lo dice (lo fija tests/offer-reglas.test.ts).

export const MARCO_OFERTA_TEXTO = `QUÉ ES UNA OFERTA
El paquete completo que recibe el cliente a cambio de dinero, tiempo, esfuerzo y riesgo: un resultado concreto, para una persona concreta, en un plazo, por un camino propio, con el riesgo del lado del vendedor y a un precio que se ve pequeño al lado del valor. El servicio, el precio, el descuento o la garantía, por separado, NO son la oferta. Está bien hecha cuando el cliente ideal «se siente tonto diciendo que no» y no puede compararte con nadie. Hasta que alguien la paga, es una hipótesis.

LAS ${PIEZAS.length} PIEZAS (key — qué es — fuerte vs débil; [mínima] = sin eso no hay análisis)
${PIEZAS.map((p) => `- ${p.key}${p.minimo ? ' [mínima]' : ''} — ${p.que}`).join('\n')}
Fuerte vs débil, lo esencial:
- cliente: «coaches de salud que ya facturan 3.000 USD al mes» (fuerte) vs «emprendedores», dos avatares, principiantes sin ingresos (débil).
- resultado: un resultado, con número y plazo («reduce tu ciclo de ventas a la mitad en 90 días»); débil: «plenitud», sin plazo, el mejor caso vendido como promesa.
- mecanismo: nombre DESCRIPTIVO distinto del programa y de la empresa, 3-6 pasos, por qué falló lo anterior; débil: suena igual que todos, copiado, siglas, «Método <empresa>».
- entregables: 3 a 5 fases con hito y un primer resultado en la primera semana; débil: «10 llamadas, 20 PDF y comunidad» (lista de supermercado), acceso de por vida.
- prueba: casos del mismo avatar con números de antes y después; débil: testimonios genéricos o de otro nicho.
- precio: sale del valor (10-20% de lo que el cliente gana en un año; que perciba 5-10 veces lo que paga); débil: por horas, «un poco menos que la competencia», cuotas de entrada.
- garantía: condicional a cumplir el método (asistir, hacer las tareas), con plazo y nombre; débil: ninguna en una oferta riesgosa, incondicional en high ticket, sobre algo que el negocio no controla.
- bonos: 1 a 3, cada uno ataca una objeción (tiempo, esfuerzo, miedo, probabilidad) y dice por qué se da; se dan en lugar de descuentos.
- urgencia: SOLO real (cohorte con fecha, cupos según la capacidad, subida de precio anunciada). Nunca «últimos cupos» que no se terminan.
- frase: «Ayudo a [cliente] a [resultado + número] en [plazo] con [método] sin [objeción]».
- escalera: dónde va esta oferta: lo que vende antes (más barato) y después (el escalón siguiente o la continuidad); en la fase 1 sólo se anota. Si la oferta es una ENTRADA (ticket bajo), lo que importa es qué vende después.
- formato: quién hace el trabajo manda sobre lo que se puede prometer: un curso (lo hace el cliente) o un acompañamiento (lo hace con guía) nunca promete que el negocio lo implementa por él.

RÚBRICA (cada dimensión 0-10; 0-3 débil · 4-6 a medias · 7-10 fuerte)
${DIMENSIONES.map((d) => `- ${d.id} ${d.label}: ${d.mide} 0-3: ${d.bajo} 4-6: ${d.medio} 7-10: ${d.alto} Señales de alerta: ${d.alerta} La destraba: «${d.destraba}»`).join('\n')}

REGLAS DE MaKo (no negociables)
1. Fase 1: una oferta, un cliente, un mensaje. Muchos productos para un negocio chico es una señal de alerta. Escalera, low ticket y continuidad quedan anotados para la fase 2. Pregunta siempre si vende otras ofertas además de ésta, aunque no estén cargadas en MaKo.
2. La promesa sale del resultado TÍPICO de los casos, no del mejor. «Hasta X» solo si X pasó de verdad. Sin casos: se promete un escalón intermedio.
3. NUNCA inventar testimonios, cifras de casos, valores de bonos, valores del stack, cupos ni fechas. Lo que falte se escribe «[completar]». Lo que MaKo propone a sabiendas (un precio, un plazo, la cantidad de fases, un nombre) se marca como propuesta.
4. Garantía: sin casos, por acciones, por entregable o por escalón; con casos del mismo cliente, condicional fuerte, con nombre y atada a hitos. Nunca incondicional en high ticket.
5. Precio: nunca bajar el precio de una oferta que ya se vende; una oferta nueva arranca en precio de primera camada dentro del rango high ticket (desde 1.000 USD) y sube por escalones. Un solo precio de lista (el del plan) y el contado como ahorro.
6. Cuotas: al menos el 50% al inicio; primero se ofrecen 2 pagos (hoy y a 30 días) y después 3; nunca duran más que el programa. Nunca 12 cuotas ni cuotas antes de que aparezca una objeción.
7. Stack de valor: cada entregable y cada bono con su valor; el valor total suma de 4 a 5 veces el precio o más. Cada bono dice por qué se da y de dónde sale su valor (lo que costó crearlo o el precio al que ya se vendió).
8. Para el método, 2 o 3 nombres DESCRIPTIVOS marcados como propuesta, nunca con el nombre del negocio.
9. La oferta es lo último que se corrige: si hay datos del embudo, primero se dice dónde se corta (volumen → asistencia → cierre → oferta). Asistencia sana: 60-80%; cierre sano: 25-40% de las llamadas calificadas.
10. Duración entre 90 y 180 días, con un resultado definido.
11. Margen bruto: alerta por debajo de 60%; objetivo 80%. Los números de la oferta incluyen LTV:CAC (mínimo 3 a 1).
12. Fuera de /experimentos MaKo no declara verdades: los cambios se proponen como hipótesis para probar.`;

/**
 * Las preguntas de la guía, en orden de prioridad (§3 del marco). Una por mensaje.
 *
 * 12/10/2026: la de «otras ofertas» va segunda porque MaKo la hace SIEMPRE y temprano (decisión de Martín:
 * lo cargado en MaKo no alcanza para saber cuántas ofertas empuja), y entra al aviso de foco. Después de
 * las mínimas van las cuatro que destraban precio, entrega y esfuerzo (tarjeta «preguntas»), y al final la
 * escalera de valor.
 */
export const PREGUNTAS_GUIA: ReadonlyArray<{ pieza: PiezaKey; pregunta: string }> = [
  { pieza: 'entregables', pregunta: '¿Qué vendes hoy y qué recibe exactamente el cliente?' },
  { pieza: 'otras', pregunta: '¿Vendes otras ofertas además de ésta, aunque no las tengas cargadas en MaKo?' },
  { pieza: 'ventas', pregunta: '¿Cuántas personas ya pagaron esta oferta tal como está hoy?' },
  { pieza: 'cliente', pregunta: 'Piensa en tus 3 mejores clientes: ¿a qué se dedican?' },
  { pieza: 'resultado', pregunta: '¿Qué logra tu cliente gracias a ti, con qué número se nota y en cuánto tiempo?' },
  { pieza: 'problema', pregunta: '¿Qué le está pasando a tu cliente cuando decide buscarte?' },
  { pieza: 'precio', pregunta: '¿Cuánto cobras y cómo te pagan?' },
  { pieza: 'prueba', pregunta: '¿Cuántos de los que pagaron lograron el resultado, y con qué números?' },
  { pieza: 'valor', pregunta: '¿Cuánto dinero gana o ahorra tu cliente en un año gracias al resultado?' },
  { pieza: 'costo', pregunta: '¿Cuánto te cuesta atender a un cliente y cuántos puedes atender a la vez?' },
  { pieza: 'semana', pregunta: '¿Qué logra tu cliente en su primera semana?' },
  { pieza: 'cobro', pregunta: '¿Qué parte del precio te pagan el día que firman?' },
  { pieza: 'objecion', pregunta: '¿Qué probó antes que no le funcionó, o qué es lo que más pereza le da hacer?' },
  { pieza: 'mecanismo', pregunta: '¿Qué haces distinto de los demás? ¿Tu forma de trabajar tiene pasos o un nombre?' },
  { pieza: 'formato', pregunta: '¿Es 1 a 1, grupal o grabado, cuánto dura, y quién hace el trabajo: tu cliente solo, con tu acompañamiento o lo haces tú por él?' },
  { pieza: 'garantia', pregunta: '¿Das alguna garantía?' },
  { pieza: 'bonos', pregunta: '¿Das algo extra además del programa?' },
  { pieza: 'urgencia', pregunta: '¿Tienes cupos o fechas de inicio reales?' },
  // La de la escalera depende del NIVEL de la oferta (`preguntaEscalera`, lib/offer-reglas.ts): ésta es la neutra.
  { pieza: 'escalera', pregunta: '¿Qué le vendes antes de esta oferta y qué le vendes después?' },
];
