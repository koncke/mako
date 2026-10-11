// =============================================================================
// offer-autores — qué concluyó MaKo de cada curso que habla de OFERTA
// =============================================================================
// Lo lee la tab «Offer Playbook» del super admin (/admin/offer-playbook, pestaña
// Autores), donde Martín revisa de dónde sale el criterio de la tab Offer.
//
// De dónde sale: las seis investigaciones del 11/10/2026 sobre los cursos de la
// casa (C:/cursos/...), destiladas por autor y VERIFICADAS por un segundo agente
// contra esa investigación y, para cada cifra o marco con nombre, contra la clase
// o el recurso citado. `verificada: true` quiere decir que alguien abrió la fuente
// y lo confirmó; `false`, que lo sostiene la investigación pero la fuente no se
// reabrió (o no está en el disco).
//
// Lo que MaKo ADOPTÓ de todo esto vive en docs/offer-marco.md (el porqué) y en
// lib/offer-marco.ts (el valor que usa el código). Acá está lo que dijo cada autor,
// incluido lo que no se tomó.
//
// Sin `server-only`: es un módulo de datos y lo importa un test.
// =============================================================================

export type TemaOferta =
  | 'cliente' | 'problema' | 'resultado' | 'objecion' | 'mecanismo' | 'entregables' | 'formato'
  | 'prueba' | 'precio' | 'garantia' | 'bonos' | 'urgencia' | 'nombre' | 'validacion'
  | 'metricas' | 'escalera' | 'venta' | 'errores';

/** El rótulo de cada tema, en el orden en que se dibujan. */
export const TEMAS_OFERTA: ReadonlyArray<{ id: TemaOferta; label: string }> = [
  { id: 'cliente', label: 'Cliente ideal' },
  { id: 'problema', label: 'Problema' },
  { id: 'resultado', label: 'Transformación' },
  { id: 'objecion', label: 'Objeción' },
  { id: 'mecanismo', label: 'Mecanismo' },
  { id: 'entregables', label: 'Ruta y entregables' },
  { id: 'formato', label: 'Formato' },
  { id: 'prueba', label: 'Prueba' },
  { id: 'precio', label: 'Precio' },
  { id: 'garantia', label: 'Garantía' },
  { id: 'bonos', label: 'Bonos' },
  { id: 'urgencia', label: 'Urgencia' },
  { id: 'nombre', label: 'Nombre y frase' },
  { id: 'validacion', label: 'Validación' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'escalera', label: 'Escalera de valor' },
  { id: 'venta', label: 'Presentación y venta' },
  { id: 'errores', label: 'Errores' },
];

export type ConclusionAutor = {
  tema: TemaOferta;
  /** Una idea, parafraseada: lo que sostiene el autor (no lo que hace MaKo). */
  texto: string;
  /** La clase o el recurso donde lo dice. */
  fuente: string;
  /** true = alguien abrió la fuente en C:/cursos y lo confirmó. */
  verificada: boolean;
};

export type AutorOferta = {
  autor: string;
  curso: string;
  /** Carpeta en C:/cursos (o ruta del repo) de donde sale. */
  carpeta: string;
  /** La idea central del autor sobre la oferta. */
  tesis: string;
  conclusiones: readonly ConclusionAutor[];
  /** Lo que quedó en el marco de MaKo, con la sección (§N.N) de docs/offer-marco.md. */
  adopta: ReadonlyArray<{ que: string; seccion: string }>;
  /** Lo que el marco no tomó, o tomó distinto, y por qué. */
  descarta: ReadonlyArray<{ que: string; porque: string }>;
  /** Una frase textual de menos de 15 palabras, o null. */
  cita: string | null;
};

/** Cuándo se destiló y verificó (las investigaciones son del mismo día). */
export const AUTORES_FECHA = '11/10/2026';

// Las citas textuales de los cursos se dejaron afuera a propósito (null): lo que se muestra va
// parafraseado. La única que queda es la del curso propio de MaKo.
export const AUTORES_OFERTA: readonly AutorOferta[] = [
  {
    autor: "Sofía Contreras",
    curso: "MasteryHaus · Mastery Build",
    carpeta: "C:/cursos/masteryhaus",
    tesis: "Una oferta irresistible es un paquete especializado: nicho dorado, problema concreto, método propio con nombre y la objeción mayor rota, armado para resolver todos los dolores, cobrado por valor y validado vendiendo antes de construir.",
    conclusiones: [
      {
        tema: "cliente",
        texto: "El nicho dorado se crea, no se elige: al submercado se le suman niveles de especificidad (gestión del tiempo → agentes inmobiliarios → con foco en compradores → premium). Según la autora, ese último nivel se puede cobrar diez veces más.",
        fuente: "clase 084",
        verificada: true
      },
      {
        tema: "problema",
        texto: "Antes de pensar soluciones, se listan en detalle todos los problemas del avatar en orden cronológico: lo primero que debe hacer, lo siguiente. Con clientes, se usan sus fricciones con el servicio; sin clientes, las que viven con otras soluciones.",
        fuente: "Libro Oferta Irresistible 2026",
        verificada: true
      },
      {
        tema: "resultado",
        texto: "Al cliente le importa su transformación, no lo que haces: se vende lo que valora y se entrega lo que necesita. El resultado soñado se escribe como un gran sueño con un plazo más corto del habitual, por ejemplo bajar 10 kilos en 90 días.",
        fuente: "Libro Oferta Irresistible 2026",
        verificada: true
      },
      {
        tema: "objecion",
        texto: "El cuarto componente de la oferta rompe la objeción más grande del avatar desde la promesa («sin hacer dieta», «sin tener que ver la propiedad»). Según la autora, así baja la barrera de entrada y el prospecto presta atención.",
        fuente: "Libro Oferta Irresistible 2026",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "La forma única de resolver el problema se presenta como un método o sistema con nombre. Según la autora, un método que el cliente no conoce y que promete resolver su problema despierta intriga, deseo y necesidad, y se percibe como algo nuevo.",
        fuente: "Libro Oferta Irresistible 2026",
        verificada: true
      },
      {
        tema: "nombre",
        texto: "Toda la oferta cabe en una frase de posicionamiento: a qué nicho ayudas, qué problema concreto resuelves, con qué método propio y qué objeción le quitas. Habla del resultado que el cliente quiere, nunca del programa que lo entrega.",
        fuente: "Libro Oferta Irresistible 2026",
        verificada: true
      },
      {
        tema: "entregables",
        texto: "Cada problema del avatar se reescribe como un «Cómo…» y pasa a ser un paquete con nombre atractivo, un valor en dinero justificado por lo que ahorra o recupera y, debajo, sus vehículos de entrega reales. El conjunto resuelve todos los problemas percibidos.",
        fuente: "Libro Oferta Irresistible 2026",
        verificada: true
      },
      {
        tema: "formato",
        texto: "La ruta de éxito del cliente parte de cinco grandes bloques (siete como mucho), ordenados por la cronología de sus dolores. Cada etapa tiene acciones del cliente, acciones del equipo y un hito que la cierra; lo que acelera resultados va en los primeros días.",
        fuente: "clase 098",
        verificada: true
      },
      {
        tema: "prueba",
        texto: "Adopta la Ecuación de Valor de Hormozi: resultado soñado por probabilidad percibida, dividido por esfuerzo y demora. Arriba se maximiza y abajo se lleva casi a cero; insiste en que la probabilidad es percibida porque el cliente paga por certeza.",
        fuente: "clase 092",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Define el precio con cuatro variables: piso (los costos, con un margen de al menos 60% según la autora), techo (el valor que percibe el cliente), contexto (la competencia, como referencia y no como molde) y fricción (qué tan vendible resulta).",
        fuente: "clase 109",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Según la autora, lo más probable es que el precio esté por debajo de su punto correcto. Propone subirlo hasta una fricción pequeña, leída en volumen (piden cuotas o descuentos, o no compran), por escalones de 10-20% y sin tocar anuncios ni landing a la vez.",
        fuente: "clase 110",
        verificada: true
      },
      {
        tema: "garantia",
        texto: "Retoma de Hormozi que una garantía que no le quita el sueño a quien la da no alcanza. No es obligatoria, pero según la autora con ella al menos 50% más personas dicen que sí. Distingue tres tipos y pide atar la condicional a los hitos de la ruta de éxito.",
        fuente: "clase 107",
        verificada: true
      },
      {
        tema: "bonos",
        texto: "Los bonos deben valer más que lo principal, llevar un nombre propio y mostrarse después del precio, para subir el valor percibido. Prefiere listas y herramientas que ahorran tiempo, y sumar bonos antes que bajar el precio.",
        fuente: "clase 105",
        verificada: true
      },
      {
        tema: "urgencia",
        texto: "Separa escasez (cantidad: quedan 16 lugares) de urgencia (tiempo: una fecha límite). Las considera eficaces aunque estén muy usadas, pero advierte que dejan de funcionar si se perciben manipuladoras: hay que usarlas con datos reales.",
        fuente: "Psicología de ventas",
        verificada: true
      },
      {
        tema: "validacion",
        texto: "Propone vender la primera versión antes de construirla, con una planificación de no más de una semana: entre 5 y 10 clientes (menos de 5 es señal de alerta), margen de 60-70% y una conversión de lead a cliente de al menos 10%.",
        fuente: "clase 116",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "Invierte la escalera típica, como hizo Tesla: primero una oferta de ticket alto, y con esa caja el ticket medio y luego el de volumen. Empezar con un precio muy bajo para pocas personas, advierte, termina en problemas de flujo de caja.",
        fuente: "clase 065",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Nicho dorado: del mercado al submercado y tres niveles de especificidad",
        seccion: "§2.1"
      },
      {
        que: "La lista larga de fricciones del cliente en orden cronológico para encontrar el problema",
        seccion: "§2.2"
      },
      {
        que: "Resultado soñado con plazo reducido",
        seccion: "§2.3"
      },
      {
        que: "La objeción rota («sin…») como cuarto componente de la oferta especializada",
        seccion: "§2.4"
      },
      {
        que: "La forma única de resolver el problema, con nombre propio",
        seccion: "§2.5"
      },
      {
        que: "Ruta de éxito: problema → «Cómo…» → paquete con valor, en no más de cinco fases con hitos",
        seccion: "§2.6"
      },
      {
        que: "Las 13 preguntas de empaquetado (ratio, involucramiento, soporte, formato, velocidad y duración)",
        seccion: "§2.7"
      },
      {
        que: "Ecuación de valor y la idea de que el cliente paga por certeza",
        seccion: "§2.8"
      },
      {
        que: "Las cuatro variables del precio: piso, techo, contexto y fricción",
        seccion: "§2.9"
      },
      {
        que: "Garantía Irresistible: sus tipos y subtipos, y que le quite el sueño a quien la da",
        seccion: "§2.10"
      },
      {
        que: "Frase ABC como la oferta resumida en una frase",
        seccion: "§2.13"
      },
      {
        que: "Check final antes de salir a vender: dolor urgente, transformación medible, entregables concretos, garantía fuerte y precio por valor",
        seccion: "§4"
      },
      {
        que: "Aislar la variable: no cambiar oferta, precio, anuncio y landing a la vez",
        seccion: "§4"
      },
      {
        que: "Planificación de validación como base del plan de las próximas semanas",
        seccion: "§5"
      },
      {
        que: "El precio se define al final, cuando ya está armado todo el valor",
        seccion: "§6.1"
      },
      {
        que: "Subir el precio por escalones y tratarlo como reversible",
        seccion: "§6.2"
      },
      {
        que: "«El tiempo no hace al high ticket»: se paga la cercanía con el experto y la certeza",
        seccion: "§6.5"
      },
      {
        que: "Pago único como meta; cuotas solo ante fricción, primero 2 y después 3 con al menos 50% al inicio; nunca 12 cuotas ni 50% a seis meses",
        seccion: "§6.6"
      },
      {
        que: "Bonos después del precio, en lugar de descuentos, y herramientas antes que más clases",
        seccion: "§7.2"
      },
      {
        que: "Regla de oro: nunca comunicar una urgencia falsa",
        seccion: "§7.3"
      },
      {
        que: "Primera versión por debajo del precio objetivo y subida por escalones (el marco la vuelve precio de camada, nunca menos de 1.000 USD)",
        seccion: "§9.3"
      },
      {
        que: "Pirámide Tesla: primero una oferta high ticket validada; la escalera queda para la fase 2",
        seccion: "§9.6"
      },
      {
        que: "60% de margen bruto como umbral de alerta",
        seccion: "§9.10"
      }
    ],
    descarta: [
      {
        que: "Anunciar «agotado» sin haber vendido (sugerencia de la sesión 024)",
        porque: "El marco solo admite urgencia real: la escasez falsa quema a la audiencia y un lead high ticket la detecta (§9.9)."
      },
      {
        que: "La garantía como algo opcional",
        porque: "El marco exige que toda oferta pase algún riesgo al vendedor; lo que cambia es la forma, según la prueba que haya (§9.2)."
      },
      {
        que: "Garantía incondicional y acceso de por vida",
        porque: "La autora los reserva a cursos de ticket bajo y de volumen; el marco trabaja high ticket por llamada: nunca incondicional (§9.2) y duración de 90 a 180 días (§9.8)."
      },
      {
        que: "Rebaja de precio por decidir en la llamada (precio por incentivo)",
        porque: "El marco reemplaza los descuentos por bonos; perdonar el costo de alta si decide hoy sí aparece, pero como bono (§7.2)."
      },
      {
        que: "Margen de 60% como objetivo",
        porque: "El marco lo usa solo como umbral de alerta y fija el objetivo en 80%, como Hormozi y Razzetti (§9.10)."
      },
      {
        que: "Low ticket como compra de leads para subir a high ticket",
        porque: "La tab Offer trabaja la oferta high ticket; el low ticket entra solo en la fase 2 (§6.5)."
      }
    ],
    cita: null
  },
  {
    autor: "Marcos Razzetti (con Yosana, Lady y Edison)",
    curso: "BlueHacker 2.0 · Nicho y Oferta High Ticket (incluye Agencia 6 Cifras v2)",
    carpeta: "C:/cursos/bluehacker (y C:/cursos/agencia-6-cifras-v2)",
    tesis: "Un negocio high ticket escala cuando nicho, transformación, precio, vehículo y sistema están bien y se resuelven en ese orden: se vende un resultado medible, con un método propio que da certeza, y se cobra por valor, no por tiempo.",
    conclusiones: [
      {
        tema: "validacion",
        texto: "Según el autor, la oferta se valida por capas: nicho, promesa y precio quedan probados cuando alguien paga; el vehículo, cuando el resultado se entrega con ganancia; y el sistema, cuando consigue clientes de forma rentable.",
        fuente: "clase 184 · Las 5 Variables A Optimizar Para Escalar (NTPVS)",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Sostiene que el precio depende del resultado y de la certeza, no de cuántas horas o sesiones se entregan; al revés, lo que se entrega se decide según lo que se promete y se cobra, por eso el precio se fija antes que el vehículo.",
        fuente: "clase 185 · Dependencia entre las variables",
        verificada: true
      },
      {
        tema: "cliente",
        texto: "Propone crear un nicho propio, distinto al de la competencia (lo llama nicho azul), bajando tres niveles de profundidad, y puntuar del 1 al 10 cada hipótesis de nicho, transformación y vehículo para quedarse con la de mayor puntaje.",
        fuente: "clase 189 · Variables Para Seleccionar un Nicho Ganador",
        verificada: true
      },
      {
        tema: "problema",
        texto: "Pide atacar el problema y no el síntoma: discutir es un síntoma; la mala relación de pareja, el problema. El problema que conviene es uno que ya intentaron resolver solos durante un tiempo y que les quita el sueño de noche.",
        fuente: "clase 198 · La situación actual y deseada",
        verificada: true
      },
      {
        tema: "resultado",
        texto: "Exige que la promesa diga qué métrica se mueve, cuánto, en qué plazo y qué se evita. Si el resultado varía mucho entre clientes, usa «en hasta» con el máximo sin prometérselo a todos; si no se puede asegurar, promete un paso intermedio.",
        fuente: "clase 202 · Definiendo tu métrica específica",
        verificada: true
      },
      {
        tema: "objecion",
        texto: "En una sesión semanal, la coach saca de la promesa lo que el cliente quiere evitar («sin publicidad», «sin seguidores») y lo pasa al subtítulo: arriba a quién se habla, en el título la promesa y debajo el «sin…».",
        fuente: "sesión semanal 277 · Nicho y Oferta 23-11-16 (coach Lady)",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "Sostiene que si tu método se percibe igual al de la competencia, el cliente busca la opción más barata; por eso pide posicionar la oferta con un vehículo azul, un método que el mercado perciba como distinto y con el que no te pueda comparar.",
        fuente: "clase 206 · Introducción al Vehículo Azul",
        verificada: true
      },
      {
        tema: "entregables",
        texto: "Propone armar los entregables listando cada paso del cliente y sus problemas, y convertir cada problema en una solución lo más hecha para él posible; después quitar lo costoso y de poco valor, y quedarse con 80 a 95% de beneficio.",
        fuente: "clase 215 · Entregables",
        verificada: true
      },
      {
        tema: "formato",
        texto: "Recomienda limitar el programa a 3 a 6 meses, sin acceso de por vida, y armar la primera versión en no más de 7 días, entregándola en vivo semana a semana en lugar de grabarla, para mejorarla con lo que digan los primeros clientes.",
        fuente: "clase 210 · Estructuración de tu Programa Y Vehículo",
        verificada: true
      },
      {
        tema: "prueba",
        texto: "Ordena la creencia en tres niveles: me dicen que funciona, veo que funcionó en otros (los casos de éxito) y veo que funciona en mí. Propone dar mini victorias antes de la compra para llegar al tercer nivel.",
        fuente: "clase 217 · Prueba Social",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Propone «flujo, luego fricción»: empezar algo por debajo del precio final, nunca menos de 1.000 USD, sobreprometiendo y sobreentregando para conseguir ventas, y subir el precio recortando entregables cuando ya hay flujo de leads y ventas.",
        fuente: "clase 205 · Definiendo tu Precio",
        verificada: true
      },
      {
        tema: "garantia",
        texto: "Propone garantizar el resultado siempre que el cliente siga el método, y dejarlo escrito en el contrato; también se puede garantizar un paso previo al resultado final. Su regla: lo que no se puede garantizar, no se promete.",
        fuente: "clase 218 · 5 Garantía",
        verificada: true
      },
      {
        tema: "urgencia",
        texto: "Pide dar siempre una razón justificada para actuar ahora: urgencia por tiempo (cohorte, subida de precio, lo que se pierde cada día) y escasez por cupos, fijados con honestidad según la capacidad real de incorporar clientes.",
        fuente: "clase 219 · Urgencia y Escasez",
        verificada: true
      },
      {
        tema: "venta",
        texto: "En una sesión semanal, la coach deja en la página de captura solo la promesa; la oferta completa y la garantía se presentan después, dentro del VSL.",
        fuente: "sesión semanal 277 · Nicho y Oferta 23-11-16 (coach Lady)",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Una oferta es una hipótesis hasta que alguien la paga",
        seccion: "§1"
      },
      {
        que: "El orden de las variables (NTPVS): si el cliente ideal está mal, todo lo que viene después se degrada; ante un empate, el cuello de botella es la dimensión de más arriba",
        seccion: "§4"
      },
      {
        que: "Concentrarse en una o dos ofertas hasta tener encaje con el mercado",
        seccion: "§4"
      },
      {
        que: "Nicho Azul y su analizador de 13 criterios",
        seccion: "§2.1"
      },
      {
        que: "Situación actual y deseada en lo que se tiene y lo que se siente, y el problema ganador",
        seccion: "§2.2"
      },
      {
        que: "Métrica específica: métrica, volumen, tiempo y «sin dolor», con «hasta X» y escalón intermedio",
        seccion: "§2.3"
      },
      {
        que: "El subtítulo con «sin [objeción principal]»",
        seccion: "§2.4"
      },
      {
        que: "Vehículo Azul, Big Idea, Gran Dominó, niveles de sofisticación y la narrativa problema → razón → consecuencia → método → beneficio",
        seccion: "§2.5"
      },
      {
        que: "Estructura del programa del infierno al cielo y la oferta como píldora, no como bolsa",
        seccion: "§2.6"
      },
      {
        que: "Prueba social con tres creencias y tres niveles",
        seccion: "§2.8"
      },
      {
        que: "Las 4 puntas del precio y «flujo, luego fricción»",
        seccion: "§2.9"
      },
      {
        que: "Garantizar el resultado siguiendo el método; lo que no se puede garantizar, no se promete",
        seccion: "§7.1"
      },
      {
        que: "Las 10 formas de presentar los bonos; primero herramientas antes que clases, y se presentan después del precio",
        seccion: "§2.11"
      },
      {
        que: "Los cinco tipos de urgencia",
        seccion: "§2.12"
      },
      {
        que: "Elevator pitch y «Uniendo las partes» como base de la frase de la oferta",
        seccion: "§2.13"
      },
      {
        que: "Solo la promesa en el anuncio y la primera pantalla; garantía, precio y oferta van en el VSL y la llamada",
        seccion: "§5"
      },
      {
        que: "En la plantilla generada: para quién es y para quién no (Uniendo las partes), el problema y el destino (Desarrollador de Transformación) y qué incluye (Presentación de [PROGRAMA])",
        seccion: "§5"
      },
      {
        que: "La calculadora de precio: valor × tasa de éxito ÷ 10",
        seccion: "§6.1"
      },
      {
        que: "Subir el precio por escalones de 250 a 1.000 USD, con las primeras ventas a cargo de quien lidera el negocio o del mejor closer, y de forma reversible",
        seccion: "§6.2"
      },
      {
        que: "Matemática de ventas: ventas necesarias = meta ÷ precio (10.000 USD a 2.000 = 5 ventas)",
        seccion: "§6.4"
      },
      {
        que: "Piso de 1.000 USD para high ticket, con rangos de entrada de 1.000-2.000 (B2C) y 2.000-3.000 (B2B)",
        seccion: "§6.5"
      },
      {
        que: "Nada de nombres de promoción ni siglas para el método",
        seccion: "§9.7"
      },
      {
        que: "Duración de 3 a 6 meses, sin acceso de por vida",
        seccion: "§9.8"
      }
    ],
    descarta: [
      {
        que: "«Haz una gran promesa creíble con una gran garantía» como salida cuando no se tiene un vehículo claro",
        porque: "MaKo promete el resultado típico de los casos, no el mejor: el closer tiene que sostenerla cara a cara y el anuncio pasa por las políticas de Meta (§9.1)."
      },
      {
        que: "Ofrecer siempre una garantía, la más grande y audaz posible",
        porque: "MaKo ajusta la forma a la prueba disponible: sin casos, garantía por acciones o por entregable; con casos, condicional fuerte con nombre (§9.2)."
      },
      {
        que: "La garantía de BlueHackers (devolución más 1.000 USD) y la doble devolución",
        porque: "Tienen riesgo financiero y legal para un negocio chico; MaKo nunca propone doble devolución sin margen para pagarla (§9.2)."
      },
      {
        que: "Un precio y un programa, con el plan más largo cobrando interés",
        porque: "MaKo muestra como precio de lista el del plan y el contado como ahorro: premia al que paga de contado sin castigar al que paga en cuotas (§9.4)."
      },
      {
        que: "Empezar por debajo del precio final como regla general",
        porque: "MaKo nunca baja el precio de una oferta que ya se vende; para una nueva propone un precio de primera camada con una razón real y lo sube por escalones (§9.3)."
      },
      {
        que: "Retener de 80 a 95% de beneficio en entregables como meta",
        porque: "MaKo fija el objetivo en 80% de margen bruto y alerta por debajo de 60% (§9.10)."
      },
      {
        que: "Buscar la falla primero en nicho, promesa, precio o vehículo antes que en el sistema",
        porque: "MaKo siempre analiza la oferta, pero con datos del embudo antes dice dónde se corta: volumen, asistencia, cierre y recién ahí la oferta (§9.5)."
      },
      {
        que: "La escalera de valor de Agencia 6 Cifras con carnada gratis más una oferta baja",
        porque: "Está pensada para los clientes de una agencia (dentistas, gimnasios); MaKo trabaja en la fase 1 una sola oferta high ticket (§9.6)."
      },
      {
        que: "Las cifras del curso (5-10% reclama la garantía, ventas +20-50%, elasticidad del precio) tomadas como datos",
        porque: "Son reglas del autor sin fuente; MaKo las presenta como «según Razzetti»."
      },
      {
        que: "Aplicar los rangos de precio en USD tal cual en cualquier país",
        porque: "Las propias sesiones advierten fricción con la financiación en Argentina; se ajustan por país con cuotas manuales o una versión sin 1 a 1."
      },
      {
        que: "Elegir qué vender con el ikigai",
        porque: "Sirve a quien todavía no sabe qué vender; el público de MaKo ya tiene clientes."
      }
    ],
    cita: null
  },
  {
    autor: "Ramiro Cubría y Matías Molina",
    curso: "Sell Your Knowledge (SYK)",
    carpeta: "C:/cursos/Sell Your Knowledge - Ramiro Cubria",
    tesis: "La oferta es un espejo de lo que el cliente quiere: vende un resultado tangible con plazo, comparte el riesgo con el cliente, es simple y viable de entregar, y se arma al final, después de entender al nicho y su dolor.",
    conclusiones: [
      {
        tema: "resultado",
        texto: "Sostiene que se vende el estado final del cliente y no el vehículo (gestión de redes, edición de video), con número y plazo, como bajar 10 kg en 90 días; si no se puede medir, se vuelve tangible: un día libre por semana en 12 semanas.",
        fuente: "El Motor Cardinal (Oferta)",
        verificada: true
      },
      {
        tema: "problema",
        texto: "Para Molina la oferta se arma después de mapear lo que el prospecto ya trae: un impulso, una meta, problemas y dolor. El dolor no se crea: ya existe, y se expone y amplifica preguntando por sus consecuencias y por lo que pasaría si todo sigue igual.",
        fuente: "clase 004",
        verificada: true
      },
      {
        tema: "entregables",
        texto: "Propone cruzar cada paso del método con las objeciones que va a tener el prospecto y convertir cada una en un entregable que la resuelve; según él, una oferta se percibe más valiosa cuantos más obstáculos chicos le quita del camino.",
        fuente: "clase 004",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "Sostiene que lo que diferencia de la competencia son los «secretos», el vehículo propio: ponerle nombre propio a algo que ya existe lo posiciona distinto y apunta a un «mercado de uno», donde eso solo se consigue con él.",
        fuente: "clase 004",
        verificada: true
      },
      {
        tema: "formato",
        texto: "Prefiere plazos de 90 días o más y no arrancar con un cliente nuevo con una mensualidad: según él, un mes es poco tiempo para generar confianza y puede bajar la percepción de valor.",
        fuente: "clase 004",
        verificada: true
      },
      {
        tema: "garantia",
        texto: "Su «Oferta Espejo» exige riesgo compartido: el proveedor también pierde si el cliente no logra el resultado. Ejemplo: el mismo paquete de 10 videos por 1.000 USD al mes, pero garantizando al menos 1.000 suscriptores más en el período.",
        fuente: "El Motor Cardinal (Oferta)",
        verificada: true
      },
      {
        tema: "garantia",
        texto: "Molina sostiene que la garantía solo funciona cuando se sabe lo que se está haciendo: con menos de 10 a 15 casos de éxito, ofrecerla le parece difícil porque todavía falta experiencia.",
        fuente: "clase 004",
        verificada: true
      },
      {
        tema: "validacion",
        texto: "Distingue la oferta mínima viable, para validar cuando no se vendió varias veces a ese nicho con al menos un caso de éxito o se cambia la oferta, de la irresistible. En la primera propone cobrar a comisión, por resultado o con tarifa baja, y salir rápido.",
        fuente: "El Motor Cardinal (Oferta)",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "Reserva la escalera de valor, con servicios y promesas distintos por escalón, para agencias DFY que recién empiezan: cada escalón suma su propia venta y entrega. Para coaching propone la «Oferta Cebolla»: mismos entregables y más acceso al experto por capa.",
        fuente: "El Motor Cardinal (Oferta)",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Toma de Hormozi su filosofía de precios: el precio comunica valor, y si el cliente percibe menos de lo que pagó se sube el valor, que no tiene techo, en vez de bajar el precio. Ponerse apenas por debajo del promedio de la competencia es un círculo vicioso.",
        fuente: "El Motor Cardinal (Oferta)",
        verificada: true
      },
      {
        tema: "metricas",
        texto: "Usa como termómetro del precio el porcentaje del ticket que el cliente paga para arrancar el servicio: según Molina, del 50% al 75% es lo ideal; más del 80% sugiere que está barato, y menos del 33%, que no ve el valor o el precio está fuera de mercado.",
        fuente: "clase 070",
        verificada: true
      },
      {
        tema: "venta",
        texto: "En la llamada propone presentar el programa en no más de 8 a 10 minutos, con el precio dicho al principio y un máximo de tres pilares, y cerrar haciendo elegir entre dos formas de pago en vez de entre comprar o no comprar.",
        fuente: "clase 075",
        verificada: true
      },
      {
        tema: "urgencia",
        texto: "Exige que el «why now» sea real: subir el precio aunque sean 100 USD, o sumar o quitar un entregable. Propone vender en público una vez por mes o cada dos, durante una semana, y advierte que vivir en «últimos cupos» quema la audiencia.",
        fuente: "clase 031",
        verificada: true
      },
      {
        tema: "nombre",
        texto: "Pide comunicar la oferta en tres niveles: un mensaje corto de 3 a 6 palabras (escribiendo de 15 a 20 opciones), uno largo de 1 a 4 oraciones, centrado en el resultado y no en el cómo, para el titular de la landing o del video, y la presentación de oferta.",
        fuente: "clase 004",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "El servicio, el precio, el descuento o la garantía por separado no son la oferta",
        seccion: "§1"
      },
      {
        que: "Selección Noética y polarizar: decir para quién no es la oferta",
        seccion: "§2.1"
      },
      {
        que: "El dolor no se inventa: se expone y se amplifica (6 pilares, fuentes de dolor y La Brecha)",
        seccion: "§2.2"
      },
      {
        que: "Resultado con número y plazo; si no se puede medir, tangible con un «para qué», y la «estrella» para comunicar",
        seccion: "§2.3"
      },
      {
        que: "Secretos y pilares con nombre propio como parte del mecanismo",
        seccion: "§2.5"
      },
      {
        que: "Factores de valor: cada objeción del prospecto se vuelve un entregable",
        seccion: "§2.6"
      },
      {
        que: "Tríada de los servicios: DIY, DWY y DFY",
        seccion: "§2.7"
      },
      {
        que: "Fuentes de confianza como base de la prueba",
        seccion: "§2.8"
      },
      {
        que: "Filosofía de precios: por valor y nunca un poco por debajo de la competencia",
        seccion: "§2.9"
      },
      {
        que: "Seguro (garantía) y Ultimátum como piezas de la oferta",
        seccion: "§2.10"
      },
      {
        que: "Why Now, venta pública y venta privada",
        seccion: "§2.12"
      },
      {
        que: "Mensaje corto, mensaje largo y pitch",
        seccion: "§2.13"
      },
      {
        que: "Antes de 10.000 USD al mes, no más de una oferta salvo que se esté probando",
        seccion: "§4"
      },
      {
        que: "Auditoría de negocio en el diagnóstico; grilla de pagos, empaquetado por fases, entregables y Ultimátum de la planilla Oferta Espejo en la oferta generada",
        seccion: "§5"
      },
      {
        que: "El precio se define al final, cuando el valor ya está armado",
        seccion: "§6.1"
      },
      {
        que: "Un curso grabado sin acompañamiento no se cobra como high ticket en el mercado hispano",
        seccion: "§6.5"
      },
      {
        que: "Con menos de 10 a 15 casos, garantía condicional por acciones, por entregable o por escalón, y no una devolución fuerte",
        seccion: "§7.1"
      },
      {
        que: "La urgencia está gastada cuando bajan las respuestas y nadie cree en los cupos",
        seccion: "§7.3"
      },
      {
        que: "Una oferta se mejora quitando, no agregando (error «llenar la bolsa»)",
        seccion: "§8"
      },
      {
        que: "La idea del índice de complejidad operativa: cada oferta extra multiplica la complejidad",
        seccion: "§9.6"
      },
      {
        que: "Proyectos de 90 días o más, sin mensualidad para empezar (MaKo: de 90 a 180 días)",
        seccion: "§9.8"
      }
    ],
    descarta: [
      {
        que: "Oferta mínima viable a comisión, por resultado o con tarifa baja (300 a 500 USD por 3 meses)",
        porque: "§9.3: el público de MaKo ya vende con anuncios y llamada; a un negocio que ya factura no le propone trabajar gratis ni a comisión, sino un precio de primera camada desde 1.000 USD. El propio curso limita la comisión a servicios que generan dinero."
      },
      {
        que: "Esperar a tener 10 a 15 casos para ofrecer garantía",
        porque: "§9.2: toda oferta lleva alguna forma de pasar el riesgo al vendedor (sin casos, por acciones o por entregable), porque el cliente high ticket compra certeza. El umbral de Molina solo decide el tipo de garantía (§7.1)."
      },
      {
        que: "Oferta Cebolla y escalera de valor en la primera oferta",
        porque: "§9.6: en la fase 1 va una oferta, un cliente y un mensaje; la versión más barata solo aparece como respuesta en la llamada y la escalera queda para la fase 2. Cada oferta extra multiplica la complejidad."
      },
      {
        que: "Presentar las cuotas como un recargo sobre el pago único (de +20% a +28,6% de «interés» en su planilla Oferta Espejo)",
        porque: "§9.4 y §6.6: un solo precio de lista, el del plan, con el contado presentado como ahorro; no se castiga con un «interés» al que paga en cuotas."
      },
      {
        que: "Cerrar haciendo elegir entre dos planes de pago",
        porque: "§9.4: los planes más largos aparecen solo ante una objeción de liquidez, de a uno, para no regalar opciones."
      },
      {
        que: "Nombres de método evocadores, como «Caballo de Troya» o «sistema FASS», para que suene nuevo",
        porque: "§9.7: MaKo propone 2 o 3 nombres descriptivos, marcados como propuesta; un nombre que nadie entiende baja la conversión del tráfico frío."
      },
      {
        que: "Calcular el ICO y el IEN con los pesos de SYK y tomar sus métricas como estándar",
        porque: "Son reglas propias de SYK para servicios que venden por llamada y DM, no estándares de la industria, y tienen inconsistencias internas (LTV/AOV mínimo de 1,1 en la Auditoría de Negocio y de 1,3 en la clase de Métricas de Ventas). El marco solo usa la idea del ICO (§9.6)."
      },
      {
        que: "Bonos",
        porque: "El curso solo los define en el Diccionario de Ventas y no tiene un método para armarlos; el marco los toma de otros autores (§2.11)."
      }
    ],
    cita: null
  },
  {
    autor: "Juan Carrizo (con Naza y Fede)",
    curso: "Aumenta tu Valor · ATV Advantage",
    carpeta: "C:/cursos/Aumenta tu valor y ATV ADVANTAGE - Juan Carrizo",
    tesis: "La oferta es una frase que promete a un avatar concreto un resultado con plazo, esquivando sus dolores con un método propio. Es una hipótesis hasta que alguien paga, y su precio se ancla al valor de la transformación.",
    conclusiones: [
      {
        tema: "nombre",
        texto: "Sostiene que la oferta cabe en una sola frase con cinco piezas: un avatar específico, un resultado tangible, un plazo, uno o dos dolores que se evitan y el método único. Una lista de entregables o un documento largo no son una oferta.",
        fuente: "clase 039",
        verificada: true
      },
      {
        tema: "objecion",
        texto: "Los dolores del «sin…» salen de lo que el avatar ya probó y no le funcionó o de lo que odia hacer. En la mayoría de los casos recomienda decirlos en negativo («sin anuncios»), porque así resaltan mejor lo que la persona quiere evitar.",
        fuente: "clase 039",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "Construye el método único en cuatro pasos: punto A y punto B, los obstáculos que el avatar quiere evitar, cuáles se resuelven y con qué, y un nombre simple que describa la solución. No es el nombre de la empresa y puede cambiar con el tiempo.",
        fuente: "clase 038",
        verificada: true
      },
      {
        tema: "cliente",
        texto: "Segmenta al avatar por niveles según hasta dónde entendió la solución a su problema. Para cobrar más caro recomienda apuntar al nivel más avanzado, siempre que sea un avatar al que se quiera ayudar y haya suficientes personas en ese nivel.",
        fuente: "clase 037",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Fija la primera hipótesis de precio entre el 10% y el 20% de lo que el avatar va a ganar de más en un año gracias a la transformación. Si el resultado no es dinero, propone estimar el ahorro frente a otras soluciones y su impacto.",
        fuente: "clase 041",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Mide lo que el curso llama «AOV» (lo cobrado por adelantado sobre lo facturado) cada 5 a 10 ventas: según el autor, por encima del 75% hay que subir el precio, y por debajo del 50% se revisa el proceso de ventas antes de pensar en bajarlo.",
        fuente: "clase 041",
        verificada: true
      },
      {
        tema: "venta",
        texto: "Recomienda no presentar nunca un solo precio. En una oferta o un upsell anual dice el total, hace silencio y lo parte en dos pagos; en un programa de pocos meses dice primero el plan en cuotas y presenta el pago único como un ahorro.",
        fuente: "clase 041",
        verificada: true
      },
      {
        tema: "formato",
        texto: "Prefiere vender el año antes que programas de 3 o 4 meses: un objetivo corto y otro mayor o de mantenimiento, con un pago ahora y otro a los pocos meses. Según el autor, las cuotas se pagan mucho más que las renovaciones (60-80% contra 10-30%).",
        fuente: "clase 041",
        verificada: true
      },
      {
        tema: "validacion",
        texto: "La oferta es una hipótesis hasta que alguien la paga; un sí en redes o de exclientes no valida nada. Como meta propone 3 a 5 ventas cobradas en high ticket (más de 1.000 USD), 5 a 10 en ticket medio y al menos 10 en low ticket.",
        fuente: "clase 042",
        verificada: true
      },
      {
        tema: "metricas",
        texto: "Si tras 10 a 15 conversaciones no llegan las ventas buscadas, revisa en este orden: si hubo volumen de leads, si el chat y la llamada se ejecutaron bien, si la oferta se explicó bien y, recién al final, si la oferta es la correcta.",
        fuente: "clase 042",
        verificada: true
      },
      {
        tema: "entregables",
        texto: "El producto mínimo sale de listar en orden cronológico los problemas que tendrá el cliente, escribir al lado cómo resolver cada uno, agruparlos en 3 a 5 fases y asignar a cada fase su forma de entrega antes de salir a vender.",
        fuente: "SOP_ CREACION DE PRODUCTO MVP",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "Ve el upsell como consecuencia de entregar resultados: se descubre preguntando al cliente cuál es su próximo objetivo y qué lo frena, y se ofrece después de la primera victoria o una a tres semanas antes de terminar, sin bajar el precio.",
        fuente: "clase 104",
        verificada: true
      },
      {
        tema: "urgencia",
        texto: "Con leads de alto ego, que ya tienen resultados, descarta la presión externa en la llamada: prefiere la urgencia interna, que surge de preguntas de consecuencia y de que el lead vea cuánto pierde cada mes sin resolverlo, como costo de oportunidad.",
        fuente: "clase 091",
        verificada: true
      },
      {
        tema: "errores",
        texto: "Ve el negocio como capas que dependen de la anterior: si el avatar, la oferta o el producto fallan, todo lo de abajo se degrada. Por eso pide buscar la causa arriba antes de culpar al contenido, al setter o al closer.",
        fuente: "clase 031",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "La oferta es una hipótesis hasta que alguien la paga",
        seccion: "§1"
      },
      {
        que: "Niveles del avatar: para cobrar más, apuntar al nivel más avanzado",
        seccion: "§2.1"
      },
      {
        que: "Tabla de dolores y soluciones como fuente del problema",
        seccion: "§2.2"
      },
      {
        que: "Los dolores que se evitan, dichos en negativo («sin…»), tomados de la estructura main",
        seccion: "§2.4"
      },
      {
        que: "Método único en cuatro pasos, con un nombre que no sea el de la empresa (ejemplo Evergreen Value)",
        seccion: "§2.5"
      },
      {
        que: "MVP en cuatro pasos: problemas en orden cronológico, soluciones, 3 a 5 fases y un entregable por fase",
        seccion: "§2.6"
      },
      {
        que: "Modelos de servicio y límites a los 1 a 1 para no romper la capacidad",
        seccion: "§2.7"
      },
      {
        que: "El pilar de casos de éxito de la Auditoría de 6 pilares",
        seccion: "§2.8"
      },
      {
        que: "Urgencia interna en la llamada y «la escasez genera urgencia, no al revés»",
        seccion: "§2.12"
      },
      {
        que: "La frase de la oferta (estructura main), con el ejemplo FITCEO",
        seccion: "§2.13"
      },
      {
        que: "Tres estrategias de upsell y cuándo ofrecerlo: tras la primera victoria o 1 a 3 semanas antes de terminar (apartado «Fase 2: el siguiente escalón»)",
        seccion: "§2"
      },
      {
        que: "Las cuatro causas de no compra: no necesita la transformación, no confía en el vendedor, no confía en sí mismo, no tiene el dinero",
        seccion: "§3"
      },
      {
        que: "Capas de negocio: el orden importa; si falla una pieza de arriba (el cliente ideal), todo lo que viene después se degrada",
        seccion: "§4"
      },
      {
        que: "Meta de 3 a 5 ventas en high ticket para dar la oferta por validada",
        seccion: "§5"
      },
      {
        que: "Precio inicial entre el 10% y el 20% de lo que el cliente gana en un año, y que el cliente ideal pueda pagarlo (si no puede, el marco cambia de cliente antes que de precio)",
        seccion: "§6.1"
      },
      {
        que: "La regla del «AOV», renombrada «% cobrado al firmar»: más de 75% subir, menos de 50% revisar antes de tocar el precio, subida por escalones",
        seccion: "§6.2"
      },
      {
        que: "Anclajes (plan en cuotas con el contado como ahorro, anual en dos pagos) y stack de valor de 4 a 5 veces el precio",
        seccion: "§6.3"
      },
      {
        que: "Ante «no tengo el dinero»: preguntar si es liquidez, cuánto puede poner hoy y armar un solo plan",
        seccion: "§6.6"
      },
      {
        que: "Errores: lista de supermercado, precio por competencia, construir antes de vender, bajar el precio para que recompren",
        seccion: "§8"
      }
    ],
    descarta: [
      {
        que: "Escalera de valor gratis → low → high desde el arranque",
        porque: "En la fase 1 MaKo trabaja una oferta, un cliente y un mensaje; la escalera queda anotada para la fase 2 (§9.6)."
      },
      {
        que: "Vender el año como formato por defecto",
        porque: "MaKo propone de 90 a 180 días con un resultado definido; el año entra solo como segundo objetivo, con su segundo pago, cuando el resultado lo pide (§9.8)."
      },
      {
        que: "Arrancar con un precio bajo (por ejemplo 500 el trimestre) e ir subiendo",
        porque: "MaKo nunca propone menos de 1.000 USD en high ticket; una oferta nueva entra como «valuación X, camada Y» y sube por escalones (§9.3)."
      },
      {
        que: "Ofrecer primero el precio completo en un pago y las cuotas solo después (SOP de downsell)",
        porque: "MaKo muestra un solo precio de lista, el del plan, con el contado como ahorro: sube el pago de contado sin perder a quien no tiene liquidez (§9.4)."
      },
      {
        que: "Dejar la oferta para el final del diagnóstico («es lo último que se corrige»)",
        porque: "MaKo siempre analiza la oferta, que es su tarea; si hay datos del embudo, primero dice dónde se corta (§9.5)."
      },
      {
        que: "El modelo B2B del growth operator (porcentaje de ganancias, «o no pagan», upfront)",
        porque: "Es una sociedad con creadores, no la oferta al cliente final; solo se adapta la idea de pasar el riesgo al vendedor (no_aplica)."
      },
      {
        que: "Urgencia de lanzamiento: cupos, «nunca más a este precio» y el reparto 25/25/50 de ventas",
        porque: "No aplica a un embudo evergreen salvo campañas puntuales; MaKo solo usa urgencia real que salga de cómo trabaja el negocio (§9.9, no_aplica)."
      },
      {
        que: "Números del low ticket (hasta 97 USD al mes, conversión de landing del 2%)",
        porque: "La tab Offer trabaja high ticket; el low ticket entra solo en la fase 2 (§6.5, no_aplica)."
      },
      {
        que: "Validar con «la gente del formulario» de una audiencia orgánica de Instagram",
        porque: "El público de MaKo vende con anuncios, VSL y llamada: se valida con leads de anuncios y llamadas (no_aplica)."
      },
      {
        que: "Garantías",
        porque: "El curso casi no las desarrolla para el cliente final y no tiene un marco de tipos; el marco las toma de otros autores (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Alex Hormozi",
    curso: "$100M Money Models",
    carpeta: "C:/cursos/100M money Models - Alex Hormozi",
    tesis: "Una oferta sola no alcanza: el negocio gana con una serie deliberada de ofertas (atracción, upsell, downsell y continuidad) armada para que cada cliente pague lo que costó conseguirlo dentro de sus primeros 30 días.",
    conclusiones: [
      {
        tema: "escalera",
        texto: "Distingue cuatro tipos de oferta, cada uno con su objetivo: la de atracción paga lo que cuesta conseguir al cliente, el upsell maximiza la ganancia, el downsell maximiza la conversión de los que dicen que no y la continuidad estabiliza la caja.",
        fuente: "clase 32 (4 Types Of Offers)",
        verificada: true
      },
      {
        tema: "errores",
        texto: "Advierte contra montar todos los mecanismos a la vez: se perfecciona una oferta por vez, porque cada pieza nueva es algo más que se puede romper; lo resume en que lo simple escala y lo sofisticado falla.",
        fuente: "clase 03 (Make Your Own Money Models)",
        verificada: true
      },
      {
        tema: "metricas",
        texto: "Propone que la ganancia bruta de los primeros 30 días de un cliente supere lo que costó conseguirlo, e idealmente lo duplique, para crecer sin capital propio; el piso es que la de por vida lo supere, idealmente 3 veces o más.",
        fuente: "clase 30 (CFA)",
        verificada: true
      },
      {
        tema: "precio",
        texto: "En servicios pide un margen bruto de 80% o más, y calcular el costo de entrega por cliente dividiendo el sueldo de quien atiende por la cantidad de clientes que lleva.",
        fuente: "clase 28 (Gross Profit (GP))",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Afirma que la gente rechaza lo que cuesta demasiado hoy, no necesariamente en total; por eso propone decir primero el precio en cuotas y ofrecer el pago de contado como un ahorro, en lugar de recargar las cuotas.",
        fuente: "clase 11 (Payment Plan Downsells)",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "Ante un «no» se cambia cómo paga el cliente o qué recibe, pero nunca se ofrece lo mismo por menos dinero: según el autor, eso hace que el cliente desconfíe de todos tus precios.",
        fuente: "clase 10 (Downsell Offers)",
        verificada: true
      },
      {
        tema: "garantia",
        texto: "En el downsell por características, primero quita algo muy valioso, idealmente la garantía, y baja poco el precio. Cuenta el caso de un amigo que ofrecía 4.000 USD con garantía o menos sin ella y pasó de cerrar 25% a 75%.",
        fuente: "clase 13 (Feature Downsells)",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Recomienda mostrar primero, y en serio, una versión de 5 a 10 veces el precio con las mismas características principales; frente a ella la oferta principal se siente barata, y quien quiere más tiene qué comprar.",
        fuente: "clase 17 (Anchor Upsell)",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "El upsell resuelve el problema que destapa la primera oferta y se ofrece en el punto de mayor privación (en la misma venta, tras una primera victoria o a mitad del programa), no al final ni en el pico de satisfacción.",
        fuente: "clase 29 (Payback Period (PPD))",
        verificada: true
      },
      {
        tema: "bonos",
        texto: "Pide bonos relacionados con el núcleo, que ya existan y con un valor creíble, idealmente algo que se vendió antes; según él, los bonos ajenos al núcleo atraen a los clientes equivocados.",
        fuente: "clase 07 (Continuity Bonus)",
        verificada: true
      },
      {
        tema: "venta",
        texto: "Sostiene que el tiempo de consumo que un cliente necesita para comprar crece con el precio, con lo frío que esté el público y con el precio frente a su poder de compra: por encima de unos 500 USD, lo más probable es que haga falta venta por teléfono.",
        fuente: "clase 24 (Free With Consumption)",
        verificada: true
      },
      {
        tema: "resultado",
        texto: "Si nadie quiere lo que regalas, una causa es que no te creen: según el autor, prometer 500 USD extra al mes consigue más registros que prometer 5.000, porque más gente lo cree.",
        fuente: "clase 27 (Customer Acquisition Cost (CAC))",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "La oferta bien hecha es la que el cliente ideal se siente tonto rechazando",
        seccion: "§1"
      },
      {
        que: "Lo simple escala: en la fase 1, una sola oferta",
        seccion: "§4"
      },
      {
        que: "El precio en cuotas primero y el contado presentado como ahorro",
        seccion: "§9.4"
      },
      {
        que: "Ancla premium de 5 a 10 veces el precio, con las mismas características principales",
        seccion: "§6.3"
      },
      {
        que: "Ante un «no», cambiar qué recibe o cómo paga; nunca lo mismo por menos",
        seccion: "§6.6"
      },
      {
        que: "Quitar la garantía como versión más barata",
        seccion: "§2.10"
      },
      {
        que: "Bonos con valor creíble, idealmente algo que ya se vendió",
        seccion: "§2.11"
      },
      {
        que: "Recupero sobre la ganancia bruta de 30 días y LTV:CAC mínimo de 3 a 1",
        seccion: "§6.4"
      },
      {
        que: "Margen bruto objetivo de 80% en servicios",
        seccion: "§9.10"
      },
      {
        que: "Por encima de unos 500 USD, la venta se cierra por llamada",
        seccion: "§6.5"
      },
      {
        que: "Fase 2: el siguiente escalón resuelve el problema nuevo y se ofrece tras la primera victoria o a mitad del programa",
        seccion: "§2"
      },
      {
        que: "Lo recurrente con cabeza grande y cola baja, y cobros alineados con los días de pago",
        seccion: "§6.6"
      },
      {
        que: "Promesa creíble antes que espectacular",
        seccion: "§9.1"
      }
    ],
    descarta: [
      {
        que: "El Money Model completo (atracción, upsell, downsell y continuidad) desde la primera oferta",
        porque: "La fase 1 es una oferta, un cliente y un mensaje; la escalera, el low ticket y la continuidad quedan anotados para la fase 2 (§9.6)."
      },
      {
        que: "Ofertas de atracción gratis o con descuentos de 50% o más (señuelo, sorteo, «compra X y llévate Y»)",
        porque: "La tab trabaja la oferta high ticket que se vende por llamada; los descuentos se reemplazan por bonos y nunca se baja el precio de lo que ya se vende (§6.5, §7.2, §9.3)."
      },
      {
        que: "Prueba con penalidad y descuentos por compromiso cobrados al inicio",
        porque: "El propio autor los limita a servicios recurrentes donde el cliente tiene que trabajar o a industrias con garantía de cobro; no entraron al marco."
      },
      {
        que: "Financiación de terceros, crédito de tarjeta a 30 días y débito bancario automático",
        porque: "Son supuestos de EE. UU.; en LatAm el marco usa cuotas manuales por contrato alineadas con los días de pago del cliente (§6.6)."
      },
      {
        que: "La Ecuación de Valor de $100M Offers como aporte directo de Hormozi",
        porque: "Ese libro no está en el disco; en el marco llega a través de Contreras y Maffia (§10)."
      }
    ],
    cita: null
  },
  {
    autor: "Mateo Maffia",
    curso: "BYF · Build Your Freedom",
    carpeta: "C:/cursos/Mateo Maffia - BYF",
    tesis: "La oferta vale lo que el cliente percibe: un nicho específico, con dinero, dolor y acceso, permite cobrar caro si la promesa, la prueba, el plazo y el esfuerzo se trabajan con la ecuación de valor.",
    conclusiones: [
      {
        tema: "cliente",
        texto: "Puntúa el nicho multiplicando Dinero, Dolor y Acceso, de 1 a 5 cada uno: de 75 a 125 es un avatar premium, de 50 a 74 sirve solo con experiencia y casos, y por debajo de 50 se descarta.",
        fuente: "clase 32 (Nicho)",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Sostiene que el ticket sube con la especificidad del nicho (en su escalera, de 50-200 USD para «dueños de negocio» a 10.000-30.000 USD para un ultranicho) y que conviene empezar caro y nichado, no barato y amplio.",
        fuente: "clase 32 (Nicho)",
        verificada: true
      },
      {
        tema: "objecion",
        texto: "Lee las objeciones («lo tengo que pensar», «lo veo con mi pareja», no presentarse a la llamada) como síntoma de que el cliente no percibe el valor, y las ataca con la ecuación de valor que atribuye a Hormozi.",
        fuente: "clase 31 (Cómo hacer que quieran comprarte LO QUE SEA)",
        verificada: true
      },
      {
        tema: "prueba",
        texto: "Según el autor, la probabilidad percibida sube con la trayectoria del experto, la cantidad de casos de éxito (pagarías más por ser el paciente 10.000 de un cirujano que el primero) y el acompañamiento: el 1 a 1 da más certeza que lo grupal.",
        fuente: "clase 31 (Cómo hacer que quieran comprarte LO QUE SEA)",
        verificada: true
      },
      {
        tema: "formato",
        texto: "Ordena los entregables de «hazlo tú» a «lo hago por ti»: cuanto más hace el experto, más valor y más precio, pero el «hecho por ti» puede ahogar la operación; recomienda buscar el punto medio.",
        fuente: "clase 31 (Cómo hacer que quieran comprarte LO QUE SEA)",
        verificada: true
      },
      {
        tema: "formato",
        texto: "La duración es el mínimo que hace falta para el resultado: él usa 120 días porque, cuando vendió 6 meses o un año, los clientes se relajaban los primeros meses y no avanzaban.",
        fuente: "clase 17 (Cómo construir una marca personal de alto valor)",
        verificada: true
      },
      {
        tema: "nombre",
        texto: "Resume la oferta en una sola frase con cinco piezas: nicho, resultado deseado, mecanismo único, plazo para lograrlo y el obstáculo que el cliente quiere evitar.",
        fuente: "Blueprint de Oferta para Negocios Online",
        verificada: true
      },
      {
        tema: "bonos",
        texto: "En su plantilla, los bonos se completan en tres casilleros, esfuerzo, tiempo y miedo o riesgo: cada bono apunta a una de las trabas que frenan la compra.",
        fuente: "Blueprint de Oferta para Negocios Online",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Dinero × Dolor × Acceso de 75 o más para high ticket",
        seccion: "§2.1"
      },
      {
        que: "El ticket sube con la especificidad del nicho",
        seccion: "§2.1"
      },
      {
        que: "El obstáculo que el cliente quiere evitar como objeción rota («sin…»)",
        seccion: "§2.4"
      },
      {
        que: "Hazlo tú, juntos o por ti, con el punto medio en «juntos»",
        seccion: "§2.7"
      },
      {
        que: "La cantidad de casos como prueba",
        seccion: "§2.8"
      },
      {
        que: "Un bono por objeción",
        seccion: "§2.11"
      },
      {
        que: "El mensaje de marketing como frase de la oferta",
        seccion: "§2.13"
      },
      {
        que: "La ecuación de valor que explica atribuyéndola a Hormozi",
        seccion: "§5"
      },
      {
        que: "«Un cliente para todos» como error",
        seccion: "§8"
      }
    ],
    descarta: [
      {
        que: "Los 120 días como duración",
        porque: "El marco usa un rango de 90 a 180 días con un resultado definido y, si hace falta, un segundo objetivo con su segundo pago (§9.8)."
      },
      {
        que: "Empezar caro desde el primer día",
        porque: "Para una oferta nueva el marco propone un precio de primera camada dentro del rango high ticket, nunca menos de 1.000 USD, y lo sube por escalones según el % cobrado al firmar (§9.3)."
      },
      {
        que: "El blueprint de productos físicos y el módulo de e-commerce",
        porque: "Son para tiendas de productos; de ahí solo se toma la lógica de nicho, dolor, deseo y urgencia."
      }
    ],
    cita: null
  },
  {
    autor: "Iván Caicedo",
    curso: "Master Escala 100k",
    carpeta: "C:/cursos/master-escala-100k",
    tesis: "En su método de dropshipping, si los anuncios atraen clics y nadie compra, en la mayoría de los casos falla la oferta: se diagnostica con métricas, se prueban en orden precio, estructura y ángulo, y se supera a la competencia sin promesas prohibidas.",
    conclusiones: [
      {
        tema: "metricas",
        texto: "Si las métricas antes del clic están bien (CTR mayor a 2%, CPM y CPC bajos), el anuncio y la página son coherentes y aun así nadie compra, sostiene que en el 80% de los casos el problema es la oferta y no el diseño.",
        fuente: "clase 130 (Analisis de metricas antes del clic)",
        verificada: true
      },
      {
        tema: "validacion",
        texto: "Propone probar en orden y conociendo los números: primero bajar el precio al mínimo rentable para descartar que el problema sea el precio y, si no alcanza, probar otras estructuras como «paga uno y lleva dos» o paquetes de tres.",
        fuente: "clase 139 (Testeo de precios u ofertas)",
        verificada: true
      },
      {
        tema: "problema",
        texto: "Para encontrar el dolor real recomienda preguntar a tres o cuatro personas por qué comprarían, buscar los problemas de la alternativa y leer reseñas, y después atacar la alternativa con prueba antes del beneficio emocional.",
        fuente: "clase 098 (por que una persona comprara nuestro producto)",
        verificada: true
      },
      {
        tema: "errores",
        texto: "Si un competidor vende bien en tu mercado hay demanda, pero lanzar lo mismo, igual y al mismo precio pierde porque lo ven las mismas personas; hay que superarlo en algo: precio, regalo, paquete o más campañas.",
        fuente: "clase 070 (Gánale a tu competencia)",
        verificada: true
      },
      {
        tema: "resultado",
        texto: "Propone convertir una oferta «black» (resultados garantizados, devoluciones desmedidas, antes y después exagerados) en una «white» que cumpla las políticas de Meta y TikTok: la IA reescribe el copy, lista lo que quitó y se revisa que siga vendiendo.",
        fuente: "clase 120 (Creando ofertas BLACK con IA para Dropshipping)",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Calcula el precio con el costo real de conseguir cada venta, que suma las que se cancelan o no se entregan, y no con el costo por resultado que muestra el administrador de anuncios.",
        fuente: "clase 076 (calculadora de precios v2)",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Mirar los números del embudo antes de cambiar la oferta",
        seccion: "§9.5"
      },
      {
        que: "No copiar al competidor ni competir solo por precio",
        seccion: "§8"
      },
      {
        que: "Promesa «white»: nada de retornos garantizados en el anuncio",
        seccion: "§5"
      }
    ],
    descarta: [
      {
        que: "«El 80% de las veces es la oferta» como punto de partida",
        porque: "Con datos del embudo, el marco revisa volumen, asistencia y cierre antes de culpar a la oferta, para no rehacer una oferta sana por un problema de anuncios o de closer (§9.5)."
      },
      {
        que: "Bajar la utilidad al mínimo para descartar el precio, o entrar en punto de equilibrio contra un competidor",
        porque: "El marco nunca baja el precio de una oferta que ya se vende y usa a la competencia solo como contexto, nunca para ponerse por debajo (§9.3, §6.1)."
      },
      {
        que: "Calculadora con fletes, ofertas por cantidad, upsell post-compra y downsell al cerrar el formulario",
        porque: "Son de dropshipping con pago contra entrega y no aplican a servicios high ticket."
      }
    ],
    cita: null
  },
  {
    autor: "Agus Nievas y Samuel Albaa (con Gonzalo Seré)",
    curso: "Growing AMG, Growing Closer y Growing Content Specialist",
    carpeta: "growing-amg · growing-closer-agustin-nievas-samuel-albaa · growing-content-specialist",
    tesis: "Nadie paga un ticket alto por una promesa vaga: la oferta depende del nicho, promete un número grande en un plazo, se presenta corta y a la medida de cada prospecto, y la garantía es secundaria.",
    conclusiones: [
      {
        tema: "precio",
        texto: "Propone prometer como mínimo 10K extra al mes, o el objetivo que el prospecto dio en la llamada, y coincide en que lo ideal es un retorno de 10 veces sobre todo lo que el cliente invierte (equipo, anuncios y fee), no solo sobre el fee.",
        fuente: "Growing AMG, clase 06",
        verificada: true
      },
      {
        tema: "venta",
        texto: "La oferta en la llamada dura de 10 a 15 minutos y tiene tres partes: el resultado con su plazo, un puente de 3 a 5 pilares atado cada uno al beneficio del beneficio que contó el prospecto, y los entregables.",
        fuente: "Growing Closer, clases 039-043 y 050",
        verificada: true
      },
      {
        tema: "garantia",
        texto: "Hay que prometer siempre, pero la garantía se da solo si el cliente la pide para cerrar, y si se firma se cumple. Sostiene que «trabajo gratis hasta que lo logres» pesa poco y transmite duda.",
        fuente: "Growing AMG, clase 06",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Una oferta high ticket cuesta más de 2.000 USD, apunta a un nicho con poder adquisitivo, resuelve su problema más doloroso con un vehículo propio y se cobra por adelantado; si el prospecto dice que no, se baja a la oferta por defecto.",
        fuente: "Growing Content Specialist, clase 021",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Vender lo que el cliente quiere (el resultado) y entregar lo que necesita (el método)",
        seccion: "§1"
      },
      {
        que: "Que el cliente vea 10 veces lo que paga",
        seccion: "§6.1"
      },
      {
        que: "El beneficio del beneficio como la «estrella» de la comunicación",
        seccion: "§2.3"
      },
      {
        que: "La cadena error, problema, consecuencia y lo que hacemos para contar el mecanismo",
        seccion: "§2.5"
      },
      {
        que: "«Seguimos gratis hasta lograrlo», sola, como garantía gastada",
        seccion: "§7.1"
      },
      {
        que: "La oferta más barata solo como respuesta dentro de la llamada",
        seccion: "§9.6"
      }
    ],
    descarta: [
      {
        que: "Dar garantía solo si el cliente la pide para cerrar",
        porque: "MaKo pone en toda oferta alguna forma de pasar el riesgo al vendedor, adaptada a la prueba que haya, porque el cliente high ticket compra certeza (§9.2)."
      },
      {
        que: "Anclar alto y, si el prospecto dice que no, bajar el fee o el porcentaje por lo mismo",
        porque: "MaKo nunca da lo mismo por menos dinero: ante una objeción cambia qué recibe el cliente o cómo paga (§6.6 y §8)."
      },
      {
        que: "Las ofertas concretas del ecosistema Growing (insertar un setter certificado, bolsa de trabajo)",
        porque: "Se traslada la estructura (fee más porcentaje, promesa por 10, los tres pilares), no las ofertas (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Augusto Bianchi",
    curso: "Academia Five Stars",
    carpeta: "academia-five-stars",
    tesis: "El high ticket se diseña desde la promesa máxima de la marca hacia abajo, y se vende haciendo que el valor pese mucho más que el precio, hasta que decir que no resulte absurdo.",
    conclusiones: [
      {
        tema: "resultado",
        texto: "El high ticket se diseña empezando por el final: qué consigue el avatar si vive uno o dos años con el experto, preguntando «¿y eso para qué le sirve?» hasta llegar al deseo de fondo. De esa promesa de marca salen el contenido y la escalera.",
        fuente: "clase 09",
        verificada: true
      },
      {
        tema: "formato",
        texto: "Distingue el high ticket de volumen (mucho contenido), el de cercanía (acceso al experto) y la mezcla de los dos; sostiene que quien puede pagar un high ticket suele no tener tiempo y por eso valora más la cercanía que cientos de videos.",
        fuente: "clase 09",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "Junto a la oferta principal propone una de resultados rápidos (RR), más barata, para quien todavía no puede pagar el high ticket; según él, la RR desactiva las objeciones del high ticket.",
        fuente: "clase 18",
        verificada: true
      },
      {
        tema: "venta",
        texto: "En la llamada el valor tiene que pesar más que el precio: se cargan datos concretos en vez de respuestas vagas, las ganancias secundarias, lo que el cliente paga hoy por no resolverlo y el dolor futuro; lo intangible se traduce a dinero.",
        fuente: "clase 18",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Que el cliente «se sienta tonto diciendo que no» como señal de una oferta bien hecha",
        seccion: "§1"
      },
      {
        que: "El siguiente problema del cliente como próximo escalón (Escalera Cinco Estrellas)",
        seccion: "§2 (Fase 2)"
      },
      {
        que: "En high ticket se paga la cercanía con el experto, no la cantidad de contenido",
        seccion: "§6.5"
      },
      {
        que: "Traducir a dinero los resultados que no son dinero",
        seccion: "§6.1"
      },
      {
        que: "Una oferta menor solo como respuesta dentro de la llamada",
        seccion: "§9.6"
      },
      {
        que: "Cobrar una parte cuando el cliente logra el resultado",
        seccion: "§7.1"
      }
    ],
    descarta: [
      {
        que: "Los cuatro dominios internos (mindset high ticket, termostato financiero, merecimiento, nivel de conciencia)",
        porque: "No se pueden evaluar en un documento de oferta (no_aplica)."
      },
      {
        que: "Armar una escalera de productos más baratos debajo del high ticket",
        porque: "En la fase 1 va una oferta, un cliente y un mensaje; la escalera queda anotada para la fase 2 (§9.6)."
      }
    ],
    cita: null
  },
  {
    autor: "Javi Rodríguez",
    curso: "HIT High Impact Trainer",
    carpeta: "hit-higt-impact-trainer",
    tesis: "Una mentoría se cobra caro cuando su estructura lo justifica (cercanía, medición, premios) y cuando cada bono, descuento y plazo tiene una razón creíble; sin justificación, la oferta despierta desconfianza.",
    conclusiones: [
      {
        tema: "entregables",
        texto: "Su Estructura Maestra para una mentoría incluye sesión semanal, llamada de medición tres días después, área de miembros con material semanal, comunidad, premios por resultados y evento presencial; según él, así se cobra de 4 a 5 veces más.",
        fuente: "clase 093",
        verificada: true
      },
      {
        tema: "venta",
        texto: "Presenta la inversión con una secuencia fija (Pack Maestro): apilar cada ítem con su valor de mercado, bajar el valor con una razón (valor de mercado, precio coherente, precio para las primeras plazas) y rematar con un bono de acción rápida.",
        fuente: "clase 093",
        verificada: true
      },
      {
        tema: "bonos",
        texto: "Muchos bonos o una bajada de precio grande sin justificar hacen que la gente desconfíe: cada bono o descuento dice por qué existe. Y nunca se rebaja por presión del prospecto, porque eso muestra necesidad.",
        fuente: "clase 089",
        verificada: true
      },
      {
        tema: "problema",
        texto: "El dolor real del cliente se busca donde es anónimo (reseñas de libros del tema, foros, blogs) y no en sus redes, donde muestra su mejor versión.",
        fuente: "clase 089",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "El bono tsunami o de acción rápida",
        seccion: "§2.11"
      },
      {
        que: "El Pack Maestro como modelo para presentar la inversión",
        seccion: "§5"
      },
      {
        que: "Evitar la promesa que provoca un «sí, claro» del que no te cree",
        seccion: "§9.1"
      },
      {
        que: "Decir siempre por qué se da cada bono",
        seccion: "§7.2"
      },
      {
        que: "Un premio al lograr un hito como bono de reconocimiento",
        seccion: "§7.2"
      },
      {
        que: "No bajar el precio de lo mismo para cerrar",
        seccion: "§8"
      }
    ],
    descarta: [
      {
        que: "La venta desde el escenario, la logística de staff y las placas físicas",
        porque: "Son propias de formadores con eventos presenciales; la estructura maestra y el pack maestro sí se trasladan (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Álvaro Luque",
    curso: "The Perfect Launch",
    carpeta: "the-perfect-launch",
    tesis: "Un buen producto no es una oferta hasta que promete un destino claro: la promesa del producto dice resultado y plazo, la de entrada promete una pieza del método, y la entrega y el precio se ajustan al ticket.",
    conclusiones: [
      {
        tema: "resultado",
        texto: "La promesa del producto dice lo que consigue el cliente (verbo + destino + tiempo, u objeción) y no menciona el vehículo; tiene que atraer al avatar correcto, ahuyentar al incorrecto y motivar una acción rápida.",
        fuente: "clases 052 y 055",
        verificada: true
      },
      {
        tema: "nombre",
        texto: "La promesa de entrada (registro o lanzamiento) es distinta y más pequeña que la del producto: promete una pieza del mecanismo («los cinco sistemas clave…»), porque el destino completo prometido gratis no se cree.",
        fuente: "clase 056",
        verificada: true
      },
      {
        tema: "entregables",
        texto: "Reparte once tipos de entregable según el ticket: de 1 a 3 en low ticket, de 5 a 7 en medium, y en high ticket unos tres de cercanía (mentoría, hot seat, análisis), porque ese comprador no quiere más contenido.",
        fuente: "clase 162",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Según el autor, el high ticket va en números redondos (3.000, 5.000, 10.000) para que se perciba caro, y el low y el medium ticket terminan en 7; en esos dos conviene ir al extremo alto del rango, porque se pierden casi los mismos compradores.",
        fuente: "clase 047",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "La PUV del producto: verbo + destino + tiempo",
        seccion: "§2.3"
      },
      {
        que: "Las tres PUV y la promesa de entrada más pequeña que la del producto",
        seccion: "§2.13"
      },
      {
        que: "Los 11 elementos de entrega según el ticket",
        seccion: "§2.6"
      },
      {
        que: "La gráfica de proximidad: en high ticket se paga la cercanía",
        seccion: "§2.7"
      },
      {
        que: "Precios redondos en high ticket",
        seccion: "§6.3"
      },
      {
        que: "No meter en la promesa el nombre de un método que nadie conoce",
        seccion: "§9.7"
      }
    ],
    descarta: [
      {
        que: "Una promesa ambiciosa que «dé un poco de miedo»",
        porque: "MaKo promete el resultado típico de los casos, con número y plazo: el closer la sostiene cara a cara y una promesa incumplida destruye la renovación y los referidos (§9.1)."
      },
      {
        que: "Garantizar el método y no el resultado",
        porque: "MaKo garantiza el resultado siguiendo el método, con condiciones verificables (§7.1), porque el cliente high ticket compra certeza (§9.2)."
      },
      {
        que: "Entrar barato para levantar casos y subir entre lanzamientos",
        porque: "Una oferta nueva entra a precio de primera camada dentro del rango high ticket, nunca por debajo de 1.000 USD (§9.3)."
      },
      {
        que: "El carrito abierto de 7 días y el speed launch",
        porque: "Aplican a low y medium ticket vendido por lanzamiento; la tab trabaja high ticket por llamada (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Jaime Jiguera",
    curso: "Growth Partner",
    carpeta: "growth-partner",
    tesis: "Para un socio de crecimiento, la oferta se arma antes de salir a vender y se resume en una misión de una línea; ante una objeción se ajusta la estructura del trato, nunca se baja el valor.",
    conclusiones: [
      {
        tema: "nombre",
        texto: "El servicio no es la oferta: antes de vender, se condensa en una misión de una línea: «Ayudando a [nicho] a [gran promesa basada en ingresos] usando nuestra [fórmula con nombre] o no pagas».",
        fuente: "clase 084",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Presenta la propuesta antes que el precio (un fee mensual más un porcentaje de los beneficios): el cliente compra por la propuesta, y una diferencia de 1.000 € o del 10% no decide el acuerdo.",
        fuente: "clase 103",
        verificada: true
      },
      {
        tema: "objecion",
        texto: "Ante una objeción se cambia la estructura sin bajar el valor: si duda de la propuesta, prueba de seis semanas; si duda de ti, cobro por resultados; si le falta liquidez, menos fee y más porcentaje. Nunca se quita algo sin añadir otra cosa.",
        fuente: "clase 104",
        verificada: true
      },
      {
        tema: "escalera",
        texto: "Si al cliente no le alcanza para el servicio hecho por ti, ofrece un pack de consultoría de 6 a 8 semanas (una llamada semanal y soporte por WhatsApp) como lo que más retorno le da a su tamaño, y después le vende el servicio.",
        fuente: "clase 105",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "La Oferta Invencible como referencia para pasar el riesgo al vendedor",
        seccion: "§2.10"
      },
      {
        que: "Ante una objeción de dinero, cambiar qué recibe o cómo paga, nunca dar lo mismo por menos",
        seccion: "§6.6"
      },
      {
        que: "Cobrar por resultado (un porcentaje de lo generado) cuando todavía hay poca prueba",
        seccion: "§7.1"
      },
      {
        que: "No bajar el precio de lo mismo para cerrar",
        seccion: "§8"
      },
      {
        que: "La versión más barata (el pack de consultoría) solo como respuesta dentro de la llamada",
        seccion: "§9.6"
      }
    ],
    descarta: [
      {
        que: "La garantía como guinda, que no se usa si la venta no la necesita",
        porque: "MaKo pone en toda oferta alguna forma de pasar el riesgo, según la prueba que haya, porque el cliente high ticket compra certeza (§9.2)."
      },
      {
        que: "Trabajar solo a comisión o gratis con los primeros clientes",
        porque: "A un negocio que ya factura no se le recomienda trabajar gratis ni a comisión (§9.3)."
      },
      {
        que: "Las ofertas de adquisición y los rangos de fee según la facturación de la marca",
        porque: "Son para agencias de e-commerce, y la garantía de solo comisión exige poder medir las ventas del cliente (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Julián Otálora",
    curso: "Fórmula Ventas Ilimitadas 2024 y Protocolo IA",
    carpeta: "formula-ventas-ilimitadas-2024 · protocolo-ia",
    tesis: "Lo que vuelve irresistible una oferta no es el precio ni los entregables sino lo que va debajo (beneficios, garantía, prueba, pago y urgencia), con foco en un solo producto ganador vendido antes de construirlo.",
    conclusiones: [
      {
        tema: "entregables",
        texto: "Una oferta es el paquete entero, no una promoción: precio y entregables los tiene cualquiera, y lo que la vuelve irresistible es lo de abajo: beneficios, garantía, testimonios, entrega, formas de pago y urgencia.",
        fuente: "Fórmula Ventas Ilimitadas 2024, clase 009",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "En el VSL, cada paso del método se cuenta como un entregable para el cliente y no como una tarea del proveedor: «te vamos a entregar X; olvídate de [dolor] porque [solución] te permitirá [beneficio]», en 3 a 5 pasos.",
        fuente: "Fórmula Ventas Ilimitadas 2024, clase 141",
        verificada: true
      },
      {
        tema: "validacion",
        texto: "La oferta se planea y se vende antes de construir el programa, y el programa se fabrica según la respuesta del mercado.",
        fuente: "Fórmula Ventas Ilimitadas 2024, clase 174",
        verificada: true
      },
      {
        tema: "errores",
        texto: "Querer vender todo el portafolio a la vez es un error: hace falta un producto ganador, con su propio contenido y su propio canal.",
        fuente: "Protocolo IA, clase 002",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "El mecanismo único con pasos nombrados",
        seccion: "§2.5"
      },
      {
        que: "Un producto ganador, no todo el portafolio",
        seccion: "§4"
      },
      {
        que: "Construir antes de vender como error",
        seccion: "§8"
      },
      {
        que: "La garantía con nombre propio",
        seccion: "§2.10"
      },
      {
        que: "La devolución más un extra cuando el método está muy probado",
        seccion: "§7.1"
      },
      {
        que: "Decir el precio recién después de apilar el valor (stack)",
        seccion: "§6.3"
      }
    ],
    descarta: [
      {
        que: "Una garantía fuerte (devolución, o devolución más un extra) en cualquier oferta",
        porque: "MaKo siempre pasa algo del riesgo al vendedor, pero la forma depende de la prueba que haya: sin casos, condicional; nunca incondicional en high ticket ni doble devolución sin margen para pagarla (§9.2)."
      },
      {
        que: "La entrega gratis, el pago contra entrega, los kits y los combos",
        porque: "Son de e-commerce; el resto del marco de 8 elementos sí aplica (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Felipe Vergara",
    curso: "Vender por FB e IG Ads",
    carpeta: "vender-por-fb-e-ig-ads",
    tesis: "La oferta es lo que hace funcionar la publicidad: el cliente tiene que sentir que recibió cinco veces lo que pagó, y cualquier oferta mejora con algo gratis, una garantía superior o un pago más fácil.",
    conclusiones: [
      {
        tema: "precio",
        texto: "Propone la regla del por cinco: en toda oferta exitosa el cliente siente que recibió cinco veces el valor que pagó (algo de 20 dólares tiene que parecer que vale al menos 100).",
        fuente: "clase 057",
        verificada: true
      },
      {
        tema: "bonos",
        texto: "Cualquier oferta mejora por una de tres vías: algo gratis (en servicios, una auditoría o un diagnóstico), una garantía superior a la del mercado o un pago más fácil (más medios de pago y cuotas).",
        fuente: "clase 057 y recurso 3 Formas de Mejorar Cualquier Oferta (PDF)",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "Propone encontrar el diferencial listando lo que se hace mejor que la competencia y quedándose con lo que menos se menciona en ese mercado.",
        fuente: "recurso Las 7 Maletas de Cualquier Compra (PDF)",
        verificada: true
      },
      {
        tema: "venta",
        texto: "Lo que se comunica de la oferta depende de la consciencia del público: un dato o una historia para quien no ve el problema, empatía para quien lo ve, 1 a 3 beneficios para quien busca solución y por qué comprarte a ti para quien ya compara.",
        fuente: "recurso Niveles de Consciencia (PDF)",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Las 7 Maletas para encontrar el problema principal",
        seccion: "§2.2"
      },
      {
        que: "Que el cliente vea cinco veces lo que paga",
        seccion: "§6.1"
      },
      {
        que: "Construir antes de vender como error",
        seccion: "§8"
      }
    ],
    descarta: [
      {
        que: "Facilitar el pago con más cuotas como mejora de la oferta",
        porque: "MaKo muestra un solo precio de lista (el del plan, con el contado como ahorro), y los planes más largos aparecen solo ante una objeción de liquidez (§9.4)."
      },
      {
        que: "Los ejemplos de regalo, envío gratis y garantía de producto físico",
        porque: "En servicios high ticket se traducen en diagnóstico o auditoría gratis, minicursos complementarios y cuotas (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Club de Negocios (Mati y equipo)",
    curso: "Club de Negocios",
    carpeta: "club-de-negocios",
    tesis: "Una oferta de entrada nace de cruzar una habilidad con una necesidad del mercado, se valida barata hasta tener testimonios y se comunica corta, sin jerga y sin precio en el primer contacto.",
    conclusiones: [
      {
        tema: "resultado",
        texto: "La oferta mínima viable cruza una habilidad propia con una necesidad insatisfecha del mercado y define el punto A y el punto B: cuanto mayor es la brecha que se puede resolver, más se puede cobrar.",
        fuente: "clase 38",
        verificada: true
      },
      {
        tema: "validacion",
        texto: "Para quien empieza sin casos propone validar gratis o barato (por ejemplo, llamadas calificadas a cambio de una comisión) y subir el precio por escalones, de 100 a 10.000 USD, a medida que llegan los testimonios.",
        fuente: "clase 38",
        verificada: true
      },
      {
        tema: "cliente",
        texto: "Recomienda apuntar a nichos que ya cobran caro por lo que venden, para que el cliente recupere lo que invierte; con un negocio de tickets chicos, como una manicura, cuesta que esa inversión vuelva.",
        fuente: "clase 38",
        verificada: true
      },
      {
        tema: "venta",
        texto: "La oferta por mensaje es corta, deja cosas abiertas, va sin precio ni términos técnicos y se personaliza al rubro (ayudamos a [nicho] a [resultado] a través de [vehículo]). Dar el precio sin que lo pidan es rechazarse solo.",
        fuente: "clase 52",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Una frase de la oferta con nicho, resultado y vehículo, sin jerga, que se entiende a la primera",
        seccion: "§2.13"
      },
      {
        que: "Hecho por ti o hecho contigo como decisión del formato",
        seccion: "§2.7"
      },
      {
        que: "Un cliente ideal que pueda pagar el ticket",
        seccion: "§2.1"
      }
    ],
    descarta: [
      {
        que: "Validar gratis o barato y subir por escalones desde 100",
        porque: "A un negocio que ya factura no se le recomienda trabajar gratis ni a comisión, y una oferta nueva entra a precio de primera camada, nunca por debajo de 1.000 USD (§9.3)."
      }
    ],
    cita: null
  },
  {
    autor: "Josema Fernández",
    curso: "DominIA Academy",
    carpeta: "dominia-academy-skool",
    tesis: "En servicios B2B no se pone precio, se ofrece valor: se cuantifica el ahorro o el ingreso que genera la solución y se muestran el retorno y el tiempo de recupero antes de hablar de cuánto cuesta.",
    conclusiones: [
      {
        tema: "precio",
        texto: "El ticket alto se justifica cuantificando el retorno con datos de la reunión (personas, horas que dedica cada una a la tarea, costo por hora), calculados a la baja: el ahorro anual son las horas eliminadas por el costo de la hora.",
        fuente: "clase 154",
        verificada: true
      },
      {
        tema: "precio",
        texto: "Propone cobrar en la mitad inferior del valor calculado y mostrar el retorno en porcentaje junto con el tiempo de recupero («recuperas la inversión en tres meses»).",
        fuente: "clase 154",
        verificada: true
      },
      {
        tema: "bonos",
        texto: "Separa funciones que ya estaban en el servicio (integración con el CRM, agendamiento, mantenimiento por seis meses) y las presenta como bonificaciones aparte para subir el valor percibido.",
        fuente: "clase 154",
        verificada: true
      },
      {
        tema: "venta",
        texto: "Al presentar la oferta se recuerda el dolor, se pinta la situación deseada, se muestra el retorno, se suman bonificaciones, escasez y garantía, se enseña un prototipo si se puede, y después hay que quedarse callado.",
        fuente: "clase 156",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Llevar a dinero un resultado que no es dinero (horas ahorradas por el valor de la hora)",
        seccion: "§6.1"
      },
      {
        que: "Preguntar cuánto gana o ahorra el cliente en un año para fijar el techo del precio",
        seccion: "§3"
      },
      {
        que: "Que toda oferta pase algo del riesgo al vendedor",
        seccion: "§9.2"
      },
      {
        que: "Contar la propuesta sin términos técnicos",
        seccion: "§2.13"
      }
    ],
    descarta: [
      {
        que: "Calcular el retorno por horas ahorradas",
        porque: "Sirve si el negocio vende a empresas (B2B); en B2C el retorno se calcula por los ingresos esperados (no_aplica)."
      }
    ],
    cita: null
  },
  {
    autor: "Víctor Heras",
    curso: "Master Marca Personal 5.0",
    carpeta: "Master Marca Personal 5.0 - Victor Heras",
    tesis: "El cliente compra un resultado tangible y medible, así que la marca necesita una promesa principal con credibilidad y prueba, y un método propio con pasos que la vuelva creíble.",
    conclusiones: [
      {
        tema: "resultado",
        texto: "El cliente compra el resultado, no el servicio: por eso cada característica se pasa a beneficio y cada beneficio a promesa, hasta llegar a una promesa principal clara, concreta y con un beneficio evidente.",
        fuente: "clase 28",
        verificada: true
      },
      {
        tema: "prueba",
        texto: "Propone escribir tres promesas con la fórmula Credibilidad + Promesa + Refuerzo: un dato que da contexto, la solución más importante y la prueba de que ya se cumplió (por ejemplo, cuántos alumnos lo lograron).",
        fuente: "recurso Promesa irrechazable - PPM (docx) y clase 28",
        verificada: true
      },
      {
        tema: "mecanismo",
        texto: "El método único convierte la forma en que el experto consigue el resultado en pasos con nombre: da esperanza y deja que el cliente atribuya sus fracasos anteriores al método equivocado.",
        fuente: "clase 29",
        verificada: true
      },
      {
        tema: "cliente",
        texto: "El perfil del cliente ideal reúne al menos cinco problemas externos y cinco internos, lo que cree que merece, su enemigo común, objetivos emocionales y tangibles, y un deseo principal elegido de una lista de 16 deseos.",
        fuente: "recurso Cómo definir tu cliente ideal (docx)",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "La PPM: credibilidad + promesa + refuerzo",
        seccion: "§2.3"
      },
      {
        que: "El método único (M.U.): pasos y qué lo hace distinto",
        seccion: "§2.5"
      },
      {
        que: "El método único como fuente de la sección del mecanismo del documento",
        seccion: "§5"
      }
    ],
    descarta: [],
    cita: null
  },
  {
    autor: "Juan ADS",
    curso: "Academia Estratega",
    carpeta: "academia-estratega",
    tesis: "En la reunión de venta de servicios la prueba va primero y la promesa va aterrizada: un mínimo que se pueda garantizar vale más que un caso extremo presentado como promesa.",
    conclusiones: [
      {
        tema: "venta",
        texto: "En la reunión, la oferta de servicios va siempre en este orden: prueba (resultados, capturas, testimonios), promesa y camino; nunca se arranca por el camino, porque lo que hace el proveedor el cliente ya lo sabe.",
        fuente: "clase 068",
        verificada: true
      },
      {
        tema: "resultado",
        texto: "Prefiere una promesa aterrizada: un mínimo garantizable y escalonado (por ejemplo, ROAS 1 el primer mes, 2 el segundo y 3 o más desde el cuarto); los casos extremos se muestran como resultados de largo plazo, no como promesa.",
        fuente: "clase 068",
        verificada: true
      },
      {
        tema: "cliente",
        texto: "Si la promesa aterrizada no le sirve al prospecto, prefiere no trabajar juntos: cuida su reputación, porque un cliente que esperaba otra cosa terminaría diciendo que el servicio es malo.",
        fuente: "clase 068",
        verificada: true
      },
      {
        tema: "venta",
        texto: "Propone una «prueba de amor» en la reunión: 15 minutos de estrategia que el cliente pueda aplicar aunque no contrate.",
        fuente: "clase 068",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Mostrar el mejor caso como resultado de largo plazo, no como promesa",
        seccion: "§9.1"
      },
      {
        que: "Una garantía que cubra un mínimo que el negocio pueda cumplir siempre",
        seccion: "§9.1"
      },
      {
        que: "La promesa tomada del mejor caso como señal de alerta",
        seccion: "§4"
      }
    ],
    descarta: [
      {
        que: "Prometer bajo a propósito para que el resultado supere la promesa",
        porque: "MaKo toma el resultado típico de los casos, con número y plazo, y deja el mínimo para la garantía (§9.1)."
      }
    ],
    cita: null
  },
  {
    autor: "Martín Koncke",
    curso: "MaKo · Reglas para crear tu VSL y Landing Page",
    carpeta: "app/conocimientos/curso-vsl.ts (repo de MaKo)",
    tesis: "En las piezas de venta (VSL y landing) manda la claridad: un diferencial definido antes de escribir, un concepto por pieza, nombres que se entienden sin explicación y una landing que sostiene lo que promete el video.",
    conclusiones: [
      {
        tema: "mecanismo",
        texto: "Antes de escribir una palabra se define el Norte: el diferencial y el argumento central. Todo (guion, gráficos, landing) cuelga de ahí, y si no está claro no se arranca.",
        fuente: "curso-vsl.ts, clase 1",
        verificada: true
      },
      {
        tema: "errores",
        texto: "Cada video lleva un solo concepto: mezclar varias funcionalidades en la misma pieza es un error, y cada una tiene su propio video.",
        fuente: "curso-vsl.ts, clase 1",
        verificada: true
      },
      {
        tema: "venta",
        texto: "El video es la promesa y la landing tiene que sostenerla: el guion es la fuente de verdad, y lo que el video no menciona no va en la página. Si no hablan de lo mismo, el visitante siente un cambio de tema y se va.",
        fuente: "curso-vsl.ts, clase 6",
        verificada: true
      },
      {
        tema: "nombre",
        texto: "Un nombre tiene que entenderse solo, sin contexto: si alguien de afuera tiene que preguntar qué es, está mal. Los apodos con personalidad solo valen acompañados de la palabra explícita.",
        fuente: "curso-vsl.ts, clase 8",
        verificada: true
      }
    ],
    adopta: [
      {
        que: "Lo explícito le gana a lo ingenioso: nombres descriptivos y la promesa sin el nombre o con el nombre explicado",
        seccion: "§9.7"
      },
      {
        que: "Sin jerga técnica en la frase de la oferta",
        seccion: "§2.13"
      }
    ],
    descarta: [
      {
        que: "No inventar nombres de mecanismo",
        porque: "MaKo propone 2 o 3 nombres descriptivos marcados como propuesta, porque el nombre ayuda a salir de la comparación (§9.7)."
      },
      {
        que: "Las reglas de producción del VSL (voz, estilo visual, audio) y la oferta propia de MaKo",
        porque: "Son internas de MaKo, no reglas para construir la oferta de un negocio (no_aplica)."
      }
    ],
    cita: "Explícito le gana a ingenioso, siempre."
  }
];
