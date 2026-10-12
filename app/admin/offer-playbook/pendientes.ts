// =============================================================================
// pendientes — la pestaña «A definir»: lo que Martín tiene que decidir de Offer
// =============================================================================
// Pedido de Martín (11/10/2026, tarde), textual: «ponme una tab de "A definir" que
// sea justamente estas 9 correcciones o las 4 o las que vayas teniendo... Que esté
// bien explicado, de manera simple qué necesitas que decida».
//
// Sale del cruce del 11/10/2026 entre docs/offer-marco.md y lo que corre en HEAD
// (lib/offer-marco.ts, lib/offer-reglas.ts, lib/offer-ia.ts y el grupo Offer de
// lib/prompt-registry.ts). El dónde de cada uno, con archivo y línea, está en
// docs/hallazgos-offer.md → «El marco contra el código». Acá va lo que se DIBUJA,
// escrito para alguien que no programa: sin archivos, sin «D1», sin jerga.
//
// Dos clases:
//   · correccion → el marco YA decide la regla y el código no la aplica. La
//     pregunta es «¿Lo arreglo?» y cada opción dice qué cambia para el negocio
//     que usa Offer.
//   · decision → el marco no alcanza: es una decisión de producto.
//
// ⚠️ EL NÚMERO NO SE GUARDA: sale del orden (correcciones primero, por importancia;
// la primera es la de las cifras inventadas). Martín contesta «1 A» en el chat
// mirando esta pantalla, así que el número que lee es el de esta lista.
//
// ⚠️ ES UNA LISTA QUE SE ACHICA. Cuando una se resuelve (en el código o en el
// marco), se saca de acá y queda escrita en los hallazgos. Los textos tienen techo
// (lo fija el test): el porqué largo va a los hallazgos, no a la tarjeta.
// =============================================================================

export type TipoPendiente = 'correccion' | 'decision';

export type LetraOpcion = 'A' | 'B' | 'C';

export type OpcionPendiente = {
  letra: LetraOpcion;
  /** La opción, en dos a seis palabras. */
  texto: string;
  /** Qué pasa si se elige, en una línea. */
  consecuencia: string;
};

export type Pendiente = {
  /** Estable, para el ancla de la tarjeta. No se dibuja. */
  clave: string;
  tipo: TipoPendiente;
  titulo: string;
  /** Qué pasa hoy, en una o dos frases, con un ejemplo si ayuda. */
  hoy: string;
  /** Qué tiene que decidir Martín. */
  pregunta: string;
  opciones: readonly OpcionPendiente[];
  /** La letra recomendada y por qué, en una frase. */
  recomiendo: LetraOpcion;
  porque: string;
};

export const ROTULO_TIPO: Readonly<Record<TipoPendiente, string>> = {
  correccion: 'Correcciones',
  decision: 'Decisiones',
};

const OP_SI = 'Sí, arréglalo';
const OP_NO = 'No, déjalo así';

/** El marco ya decide; falta aplicarlo. Por importancia. */
const CORRECCIONES: readonly Omit<Pendiente, 'tipo'>[] = [
  {
    clave: 'cifras',
    titulo: 'Cifras inventadas en el PDF',
    hoy: 'Si el negocio dio algún dato de sus casos o sus bonos, todas las cifras de esa parte pasan sin revisar, y el valor total no se revisa nunca. El PDF puede decir «27 clientes duplicaron sus ventas» sin que nadie lo dijera.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: OP_SI, consecuencia: 'Toda cifra que el negocio no dio sale como «[completar]», también el valor total.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'El negocio puede repetir en su venta un número que nadie le dio.' },
    ],
    recomiendo: 'A',
    porque: 'Es lo que el marco más prohíbe, y el dueño lee el PDF como un hecho.',
  },
  {
    clave: 'lista',
    titulo: 'Dice «lista» sin el control final',
    hoy: 'MaKo declara la oferta lista para vender mirando sólo las notas. No pasa el control final del marco (dolor urgente, resultado medible, entregables, garantía fuerte, precio por valor): puede decir «lista» con el precio en 5 de 10.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, súmale el control final', consecuencia: 'Sólo dice «lista» si además cumple esos cinco puntos.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'Una oferta con el precio flojo puede salir como lista para vender.' },
    ],
    recomiendo: 'A',
    porque: 'Con ese «lista», el negocio sale a gastar en anuncios.',
  },
  {
    clave: 'garantia',
    titulo: 'Garantía fuerte con pocos casos',
    hoy: 'La IA propone una garantía suave sólo si el negocio no tiene ningún caso. Con 3 casos ya puede proponer una garantía fuerte; el marco pide de 10 a 15 casos para eso.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, usa los 10 a 15 casos', consecuencia: 'Con menos casos propone garantía por cumplir tareas o por entregable, no devolver el dinero.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'Un negocio con pocos casos puede prometer devoluciones que después no puede pagar.' },
    ],
    recomiendo: 'A',
    porque: 'Una devolución que no se puede pagar es un riesgo de dinero y legal.',
  },
  {
    clave: 'anclas',
    titulo: 'Notas sin números de referencia',
    hoy: 'La IA pone las notas sin los números del marco: no sabe que un margen sano es de 70 a 80%, ni que lo sano es cobrar entre 50 y 75% al firmar. Hoy cobrar todo al firmar saca nota alta; para el marco, es señal de precio barato.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, pásale los números', consecuencia: 'Cliente ideal, entrega y precio se califican con las mismas cifras del marco.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'La misma oferta puede sacar notas distintas según la IA que conteste.' },
    ],
    recomiendo: 'A',
    porque: 'Sin números, cada IA califica a su manera.',
  },
  {
    clave: 'preguntas',
    titulo: 'Preguntas que MaKo no hace',
    hoy: 'MaKo hace 13 de las 39 preguntas del marco. No pregunta cuánto gana el cliente con el resultado, cuánto cuesta atenderlo, qué logra en la primera semana ni cuánto se cobra al firmar.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, suma las cuatro', consecuencia: 'Precio y entrega se califican con datos. La charla tiene cuatro preguntas más.' },
      { letra: 'B', texto: 'Sólo la del valor del resultado', consecuencia: 'Con una pregunta más se destraba la nota de precio.' },
      { letra: 'C', texto: OP_NO, consecuencia: 'El precio se sigue calificando sin saber cuánto vale el resultado.' },
    ],
    recomiendo: 'A',
    porque: 'Son las preguntas que destraban precio, entrega y esfuerzo.',
  },
  {
    clave: 'alertas',
    titulo: 'Avisos que faltan',
    hoy: 'MaKo sólo avisa dos cosas: que hay demasiadas ofertas a la vez y que el cliente ideal o la promesa están muy flojos. No avisa si el margen baja de 60%, dónde se cortan las ventas ni cuándo subir el precio.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, súmalos', consecuencia: 'El dueño ve si pierde margen, en qué paso se le caen las ventas y cuándo subir el precio.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'Puede rehacer una oferta sana cuando el problema está en los anuncios o en el cierre.' },
    ],
    recomiendo: 'A',
    porque: 'El marco pide decir dónde se cortan las ventas antes de culpar a la oferta.',
  },
  {
    clave: 'foco',
    titulo: 'Aviso de foco tardío',
    hoy: 'Si MaKo no sabe cuánto factura el negocio, avisa de falta de foco recién con 6 ofertas a la vez; el marco dice que con 3 ya es mala nota. Y la IA que califica el foco no ve ese aviso.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, avisa desde 3 ofertas', consecuencia: 'Coincide con el marco; un negocio grande con varias líneas puede recibir el aviso de más.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'Un negocio pequeño con 4 o 5 ofertas no recibe el aviso.' },
    ],
    recomiendo: 'A',
    porque: 'Para el marco, tener muchas ofertas es la primera señal de alerta.',
  },
  {
    clave: 'cobro',
    titulo: 'Reglas de cobro que la IA no lee',
    hoy: 'El resumen del marco que lee la IA deja afuera reglas de cobro: cuotas con al menos 50% al inicio, valor total de 4 a 5 veces el precio, cada bono con su porqué y cuánto deja un cliente frente a lo que cuesta conseguirlo.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, súmalas', consecuencia: 'La oferta que genera MaKo respeta esas reglas de cobro y de bonos.' },
      { letra: 'B', texto: OP_NO, consecuencia: 'La IA puede proponer cuotas sin pago inicial fuerte o bonos sin razón.' },
    ],
    recomiendo: 'A',
    porque: 'Son reglas del marco que hoy no llegan a la IA.',
  },
  {
    clave: 'topes',
    titulo: 'Listas sin tope',
    hoy: 'MaKo acepta una ruta de 6 fases (el marco dice de 3 a 5), una oferta sin bonos (de 1 a 3) y un método sin nombres propuestos (2 o 3), y no lo marca.',
    pregunta: '¿Lo arreglo?',
    opciones: [
      { letra: 'A', texto: 'Sí, revísalo', consecuencia: 'Lo que sobra se recorta y lo que falta queda como «[completar]».' },
      { letra: 'B', texto: OP_NO, consecuencia: 'El PDF puede salir con 6 fases o sin bonos y nadie lo nota.' },
    ],
    recomiendo: 'A',
    porque: 'Es un ajuste pequeño que evita un PDF fuera del marco.',
  },
];

/** Decisiones de producto. Por importancia. */
const DECISIONES: readonly Omit<Pendiente, 'tipo'>[] = [
  {
    clave: 'supuestos',
    titulo: 'Qué propuso MaKo y qué dijo el negocio',
    hoy: 'La última sección del PDF sólo lista los datos a completar. No separa lo que propuso MaKo (un nombre, una garantía, un precio) de lo que contó el dueño.',
    pregunta: '¿El PDF separa lo que propuso MaKo de lo que dijo el negocio?',
    opciones: [
      { letra: 'A', texto: 'Sí, en una lista al final', consecuencia: 'Una sección con todo lo que propuso MaKo; el resto del PDF queda igual.' },
      { letra: 'B', texto: 'Sí, marcado en cada parte', consecuencia: 'Cada dato propuesto lleva una marca donde aparece: más claro, pero más cargado.' },
      { letra: 'C', texto: 'No, déjalo como está', consecuencia: 'El dueño puede tomar como propio algo que MaKo inventó.' },
    ],
    recomiendo: 'A',
    porque: 'Es lo que pide el marco y no ensucia el resto del documento.',
  },
  {
    clave: 'minimas',
    titulo: 'Qué necesita MaKo para analizar',
    hoy: 'MaKo analiza cuando sabe cinco cosas: cliente, problema, resultado, entregables y precio. No pide cuántos pagaron ni cuántos lograron el resultado, y un «no sé» cuenta como respuesta.',
    pregunta: '¿Qué tiene que saber MaKo antes de dar el diagnóstico?',
    opciones: [
      { letra: 'A', texto: 'Sumar la prueba a las mínimas', consecuencia: 'Pregunta cuántos pagaron y cuántos lograron el resultado; un «no sé» queda como supuesto.' },
      { letra: 'B', texto: 'Sumarla y no aceptar «no sé»', consecuencia: 'Sin esos dos datos no hay diagnóstico. Algunos dueños van a abandonar.' },
      { letra: 'C', texto: 'Dejar las cinco de hoy', consecuencia: 'Analiza más rápido, pero la certeza se califica a ciegas.' },
    ],
    recomiendo: 'A',
    porque: 'La certeza es una de las tres notas críticas, y el marco anota el «no sé» como supuesto.',
  },
  {
    clave: 'rehacer',
    titulo: 'Cliente o promesa muy flojos',
    hoy: 'Si el cliente ideal o la promesa sacan 3 o menos, MaKo avisa pero entrega la oferta completa, con precio y bonos. El marco dice rehacer desde ahí antes de tocar lo demás.',
    pregunta: 'Con el cliente o la promesa en 3 o menos, ¿qué entrega MaKo?',
    opciones: [
      { letra: 'A', texto: 'Sólo el arreglo de cliente y promesa', consecuencia: 'El dueño recibe menos, pero lo urgente; precio y bonos llegan en la vuelta siguiente.' },
      { letra: 'B', texto: 'Todo, con el aviso arriba', consecuencia: 'Como hoy: recibe la oferta completa, aunque se apoye en una base floja.' },
      { letra: 'C', texto: 'Todo, con precio y bonos provisionales', consecuencia: 'Recibe todo, pero sabe qué partes dependen de arreglar lo primero.' },
    ],
    recomiendo: 'C',
    porque: 'Respeta el marco sin dejar al dueño con las manos vacías.',
  },
  {
    clave: 'reglas-ia',
    titulo: 'Reglas que dependen de la IA',
    hoy: 'Cuatro reglas sólo están en las instrucciones de la IA: duración de 90 a 180 días, precio desde 1.000 USD, garantía nunca incondicional y nombres del método como propuesta. Una IA gratis puede saltarse alguna sin que nadie se entere.',
    pregunta: '¿Las revisa MaKo o confías en la IA?',
    opciones: [
      { letra: 'A', texto: 'Que MaKo las revise', consecuencia: 'Si la IA se salta una, se corrige o se marca antes de llegar al PDF.' },
      { letra: 'B', texto: 'Sólo avisar', consecuencia: 'La oferta sale igual, con un aviso de qué regla no cumple.' },
      { letra: 'C', texto: 'Confiar en la IA', consecuencia: 'Como hoy: casi siempre se cumplen, pero no hay red.' },
    ],
    recomiendo: 'A',
    porque: 'Son reglas que no se negocian; si dependen de la IA, alguna se va a escapar.',
  },
];

/** La lista que se dibuja, numerada por su posición: correcciones y después decisiones. */
export const A_DEFINIR: ReadonlyArray<Pendiente & { n: number }> = [
  ...CORRECCIONES.map((p) => ({ ...p, tipo: 'correccion' as const })),
  ...DECISIONES.map((p) => ({ ...p, tipo: 'decision' as const })),
].map((p, i) => ({ ...p, n: i + 1 }));

/** El orden de los grupos en pantalla (el mismo que el de la numeración). */
export const ORDEN_TIPOS: readonly TipoPendiente[] = ['correccion', 'decision'];
