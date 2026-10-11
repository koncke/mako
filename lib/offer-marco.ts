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

// ── Las 13 piezas de una oferta ──────────────────────────────────────────────

export type PiezaKey =
  | 'cliente' | 'problema' | 'resultado' | 'objecion' | 'mecanismo'
  | 'entregables' | 'formato' | 'prueba'
  | 'precio' | 'garantia' | 'bonos' | 'urgencia'
  | 'frase';

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
  { key: 'formato', label: 'Formato', minimo: false, que: 'Cómo se entrega: 1 a 1 o grupal, cuánto hace el cliente, soporte y duración.' },
  { key: 'prueba', label: 'Prueba', minimo: false, que: 'Cuántos pagaron y cuántos lograron el resultado; casos del mismo cliente con números.' },
  { key: 'precio', label: 'Precio', minimo: true, que: 'Cuánto cuesta, cómo se paga y qué parte se cobra al firmar.' },
  { key: 'garantia', label: 'Garantía', minimo: false, que: 'Qué arriesga el negocio si el cliente cumple y no llega.' },
  { key: 'bonos', label: 'Bonos', minimo: false, que: 'Extras que atacan una objeción concreta (no son los entregables).' },
  { key: 'urgencia', label: 'Urgencia', minimo: false, que: 'Una razón REAL para decidir hoy: cohorte, cupos por capacidad, subida de precio.' },
  { key: 'frase', label: 'La frase', minimo: false, que: 'La oferta entera en una frase que un extraño entiende.' },
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
  /** La pregunta que la destraba (va al prompt). */
  destraba: string;
};

export const DIMENSIONES: readonly Dimension[] = [
  { id: 'D1', label: 'Cliente ideal', mide: 'Qué tan específico es, si puede pagar y si le duele.',
    bajo: '«Emprendedores», «cualquiera», varios avatares; no puede pagar el ticket.',
    medio: 'Rubro o rol definido, pero falta el nivel o la situación; capacidad de pago dudosa.',
    alto: 'Tres niveles de especificidad; se reconoce en el nombre; dinero × dolor × acceso alto; dice para quién no es.',
    destraba: 'Piensa en tus 3 mejores clientes: ¿a qué se dedican?' },
  { id: 'D2', label: 'Promesa', mide: 'Si promete un resultado medible, con plazo, sobre un dolor urgente, y si es creíble.',
    bajo: 'Vende el vehículo (curso, sesiones) o una emoción vaga; sin plazo.',
    medio: 'Resultado claro sin número o sin plazo, o dos resultados en una frase; problema no urgente.',
    alto: 'Un resultado con número y plazo que el programa alcanza; dolor que ya intentaron resolver; un extraño lo entiende.',
    destraba: '¿Con qué número se nota que tu cliente logró el resultado?' },
  { id: 'D3', label: 'Diferenciación', mide: 'Si el cliente puede compararte con otro o no.',
    bajo: 'Suena igual que todos; compite por precio.',
    medio: 'Tiene método, pero sin nombre o sin explicar por qué es distinto.',
    alto: 'Mecanismo con nombre descriptivo, pasos claros y por qué falló lo que probó antes.',
    destraba: '¿Qué probó tu cliente antes y por qué tu forma es distinta?' },
  { id: 'D4', label: 'Certeza', mide: 'Cuánto cree el cliente que lo va a lograr (prueba y riesgo).',
    bajo: 'Sin casos y sin garantía.',
    medio: 'Testimonios genéricos o de otro avatar; garantía vaga.',
    alto: 'Casos del mismo avatar con números de antes y después; garantía condicional atada a hitos.',
    destraba: '¿Cuántos clientes parecidos a tu cliente ideal lograron el resultado, y con qué números?' },
  { id: 'D5', label: 'Esfuerzo y tiempo', mide: 'Cuánto le cuesta llegar, en trabajo y en espera.',
    bajo: 'Todo lo hace solo, sin hitos, resultado después de varios meses.',
    medio: 'Hay ruta, pero sin resultado rápido; el cliente carga mucho trabajo.',
    alto: 'Ruta de 3 a 5 fases con hitos, primer resultado en días, plantillas o parte hecha por el negocio.',
    destraba: '¿Qué logra tu cliente en su primera semana?' },
  { id: 'D6', label: 'Entrega sostenible', mide: 'Si se puede entregar igual a muchos clientes y con margen.',
    bajo: 'Todo a medida, margen bajo, el dueño está en todo.',
    medio: 'Paquete definido con límites borrosos o margen intermedio.',
    alto: 'Productizada (entregables, duración y soporte fijos), margen bruto alto, capacidad clara.',
    destraba: '¿Cuánto te cuesta atender a un cliente y cuántos puedes atender a la vez?' },
  { id: 'D7', label: 'Precio y cobro', mide: 'Si el precio sale del valor y si el cobro sostiene la caja.',
    bajo: 'Precio por horas o por competencia, o menos de 1.000 USD en high ticket; cuotas de entrada.',
    medio: 'Precio razonable que no se justifica con el valor; sin datos de fricción.',
    alto: 'El valor del resultado es 5 a 10 veces el precio y se muestra con números; se cobra la mayor parte al firmar.',
    destraba: '¿Cuánto dinero gana o ahorra tu cliente en un año gracias al resultado?' },
  { id: 'D8', label: 'Razón para decidir', mide: 'Si hay un motivo real y valioso para decidir hoy (bonos y urgencia).',
    bajo: 'No hay motivo, o la urgencia es falsa.',
    medio: 'Bonos genéricos o un descuento sin explicación.',
    alto: '1 a 3 bonos que atacan objeciones concretas y un motivo real: cohorte, cupos o subida de precio.',
    destraba: '¿Tienes cupos o una fecha de inicio reales?' },
  { id: 'D9', label: 'Foco', mide: 'Si el negocio empuja una sola oferta.',
    bajo: 'Tres o más ofertas o nichos a la vez.',
    medio: 'Una oferta principal con variantes a medida o un segundo nicho.',
    alto: 'Un nicho, una oferta, un mensaje.',
    destraba: 'Si este trimestre solo pudieras vender una cosa, ¿cuál sería?' },
] as const;

export const DIMENSION_IDS: readonly DimensionId[] = DIMENSIONES.map((d) => d.id);
export const esDimensionId = (v: unknown): v is DimensionId => typeof v === 'string' && (DIMENSION_IDS as readonly string[]).includes(v);
export const dimensionLabel = (id: DimensionId): string => DIMENSIONES.find((d) => d.id === id)?.label ?? id;

/** Las tres que la llamada de venta no puede arreglar (cliente, promesa, certeza). */
export const DIMENSIONES_CRITICAS: readonly DimensionId[] = ['D1', 'D2', 'D4'];

// ── La conversación ──────────────────────────────────────────────────────────

/** Un adjunto ya leído. El texto NO viaja a la pantalla: vive en `documentos`. */
export type AdjuntoVista = { id: string; nombre: string; via: string; chars: number; aviso?: string };

export type OfferMensaje = {
  id: string;
  de: 'mako' | 'yo';
  texto: string;
  /** ISO. */
  at: string;
  /** Respuestas rápidas que MaKo ofrece (sólo en mensajes de MaKo). */
  opciones?: string[];
  /** Los documentos que se mandaron con este mensaje. */
  adjuntos?: AdjuntoVista[];
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
  /** Lo mejor que ya tiene la oferta actual, en una frase. */
  fuerte: string;
  /** Los 3 cambios con más impacto, del más importante al menos. */
  cambios: CambioPropuesto[];
};

/** Lo que calcula el CÓDIGO sobre el diagnóstico — nunca el modelo. */
export type CalculoDiagnostico = {
  /** 0-100: el promedio de las 9 notas × 10, redondeado. */
  total: number;
  /** La dimensión más baja; con empate, la que está más arriba en el orden. */
  cuello: DimensionId;
  /** Ninguna por debajo de 5 y D1, D2 y D4 en 7 o más. */
  lista: boolean;
  /** Avisos deterministas (foco, embudo). Una frase cada uno. */
  alertas: string[];
};

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
};

export type OfferSesionResumen = { id: number; titulo: string; estado: EstadoSesion; total: number | null; updatedAt: string };

/** ¿Están las piezas sin las que no hay análisis? (lo decide el código, no el modelo) */
export function faltanMinimas(piezas: PiezasSabidas): PiezaKey[] {
  return PIEZAS_MINIMAS.filter((k) => !piezas[k]?.valor?.trim());
}

// ── El marco, en el texto que leen los modelos ───────────────────────────────
// Compacto a propósito: viaja en CADA turno del chat. El detalle largo y las
// discrepancias entre autores viven en docs/offer-marco.md.

export const MARCO_OFERTA_TEXTO = `QUÉ ES UNA OFERTA
El paquete completo que recibe el cliente a cambio de dinero, tiempo, esfuerzo y riesgo: un resultado concreto, para una persona concreta, en un plazo, por un camino propio, con el riesgo del lado del vendedor y a un precio que se ve pequeño al lado del valor. El servicio, el precio, el descuento o la garantía, por separado, NO son la oferta. Está bien hecha cuando el cliente ideal «se siente tonto diciendo que no» y no puede compararte con nadie. Hasta que alguien la paga, es una hipótesis.

LAS 13 PIEZAS (key — qué es — fuerte vs débil)
${PIEZAS.map((p) => `- ${p.key} — ${p.que}`).join('\n')}
Fuerte vs débil, lo esencial:
- cliente: «coaches de salud que ya facturan 3.000 USD al mes» (fuerte) vs «emprendedores», dos avatares, principiantes sin ingresos (débil).
- resultado: un resultado, con número y plazo («reduce tu ciclo de ventas a la mitad en 90 días»); débil: «plenitud», sin plazo, el mejor caso vendido como promesa.
- mecanismo: nombre DESCRIPTIVO distinto del programa y de la empresa, 3-6 pasos, por qué falló lo anterior; débil: suena igual que todos, copiado, siglas, «Método <empresa>».
- entregables: 3 a 5 fases con hito y un primer resultado en la primera semana; débil: «10 llamadas, 20 PDF y comunidad» (lista de supermercado), acceso de por vida.
- prueba: casos del mismo avatar con números de antes y después; débil: testimonios genéricos o de otro nicho.
- precio: sale del valor (10-20% de lo que el cliente gana en un año; que perciba 5-10 veces lo que paga); débil: por horas, «un poco menos que la competencia», cuotas de entrada.
- garantía: condicional a cumplir el método (asistir, hacer las tareas), con plazo y nombre; débil: ninguna en una oferta riesgosa, incondicional en high ticket, sobre algo que el negocio no controla.
- bonos: 1 a 3, cada uno ataca una objeción (tiempo, esfuerzo, miedo, probabilidad); se dan en lugar de descuentos.
- urgencia: SOLO real (cohorte con fecha, cupos según la capacidad, subida de precio anunciada). Nunca «últimos cupos» que no se terminan.
- frase: «Ayudo a [cliente] a [resultado + número] en [plazo] con [método] sin [objeción]».

RÚBRICA (cada dimensión 0-10; 0-3 débil · 4-6 a medias · 7-10 fuerte)
${DIMENSIONES.map((d) => `- ${d.id} ${d.label}: ${d.mide} 0-3: ${d.bajo} 4-6: ${d.medio} 7-10: ${d.alto}`).join('\n')}

REGLAS DE MaKo (no negociables)
1. Fase 1: una oferta, un cliente, un mensaje. Muchos productos para un negocio chico es una señal de alerta. Escalera, low ticket y continuidad quedan anotados para la fase 2.
2. La promesa sale del resultado TÍPICO de los casos, no del mejor. «Hasta X» solo si X pasó de verdad. Sin casos: se promete un escalón intermedio.
3. NUNCA inventar testimonios, cifras de casos, valores de bonos, cupos ni fechas. Lo que falte se escribe «[completar]».
4. Garantía: sin casos, por acciones, por entregable o por escalón; con casos, condicional fuerte con nombre. Nunca incondicional en high ticket.
5. Precio: nunca bajar el precio de una oferta que ya se vende; una oferta nueva arranca en precio de primera camada dentro del rango high ticket (desde 1.000 USD) y sube por escalones. Un solo precio de lista (el del plan) y el contado como ahorro. Cuotas que nunca duran más que el programa.
6. Para el método, 2 o 3 nombres DESCRIPTIVOS marcados como propuesta.
7. La oferta es lo último que se corrige: si hay datos del embudo, primero se dice dónde se corta (volumen → asistencia → cierre → oferta).
8. Duración entre 90 y 180 días, con un resultado definido.
9. Margen bruto: alerta por debajo de 60%; objetivo 80%.
10. Fuera de /experimentos MaKo no declara verdades: los cambios se proponen como hipótesis para probar.`;

/** Las preguntas mínimas, en orden de prioridad (§3 del marco). Una por mensaje. */
export const PREGUNTAS_GUIA: ReadonlyArray<{ pieza: PiezaKey; pregunta: string }> = [
  { pieza: 'entregables', pregunta: '¿Qué vendes hoy y qué recibe exactamente el cliente?' },
  { pieza: 'prueba', pregunta: '¿Cuántas personas ya pagaron esta oferta tal como está hoy?' },
  { pieza: 'cliente', pregunta: 'Piensa en tus 3 mejores clientes: ¿a qué se dedican?' },
  { pieza: 'resultado', pregunta: '¿Qué logra tu cliente gracias a ti, con qué número se nota y en cuánto tiempo?' },
  { pieza: 'problema', pregunta: '¿Qué le está pasando a tu cliente cuando decide buscarte?' },
  { pieza: 'precio', pregunta: '¿Cuánto cobras y cómo te pagan?' },
  { pieza: 'objecion', pregunta: '¿Qué probó antes que no le funcionó, o qué es lo que más pereza le da hacer?' },
  { pieza: 'mecanismo', pregunta: '¿Qué haces distinto de los demás? ¿Tu forma de trabajar tiene pasos o un nombre?' },
  { pieza: 'formato', pregunta: '¿Es 1 a 1, grupal o grabado, y cuánto dura?' },
  { pieza: 'prueba', pregunta: '¿Cuántos clientes lograron el resultado? ¿Tienes casos con números?' },
  { pieza: 'garantia', pregunta: '¿Das alguna garantía?' },
  { pieza: 'bonos', pregunta: '¿Das algo extra además del programa?' },
  { pieza: 'urgencia', pregunta: '¿Tienes cupos o fechas de inicio reales?' },
];
