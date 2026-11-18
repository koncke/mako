import type { FichaKnowledge } from './tipos';

// Módulo `oferta` («Oferta y modelo de negocio»): lo consumen Offer, General y CRM. Las tres primeras son las bases.
export const FICHAS_OFERTA: readonly FichaKnowledge[] = [
  {
    modulo: 'oferta',
    titulo: 'Nicho y avatar: a quién le vendes, en una frase',
    categoria: 'Nicho y avatar',
    cuerpo: `Qué es: el nicho no es una etiqueta, es un grupo de personas que están en una situación A y quieren llegar a una B. Mientras más angosto, más se reconoce el cliente y menos te compara solo por precio.
Cuándo se usa: cuando el mensaje suena genérico, todas las ofertas del mercado se ven iguales o te piden descuento en cada llamada.
La regla práctica:
- Suma capas de especificidad: a quién, en qué situación y con qué perfil. Un servicio para "empresas" se vuelve un servicio para clínicas dentales de una ciudad que ya invierten en publicidad. Sigue angostando mientras el cliente se reconozca más.
- Elige un solo nicho, aunque no sea perfecto: se corrige después. Con uno solo repites embudo, guiones y casos, y el segundo cliente cuesta mucho menos que el primero.
- Antes de fijarlo, comprueba tres cosas: que tengan dinero para pagar lo que vendes, que ya entiendan que su problema tiene solución y que tú entiendas su negocio.
- Resume el avatar en una frase que el cliente repetiría: "Ayudo a [quién] a pasar de [situación actual] a [resultado] sin [dolor que quiere evitar]".
Error típico: abrir varios nichos, canales y productos a la vez. Cada uno multiplica la operación y diluye el mensaje; primero un nicho y un producto, después se amplía.`,
    de: ['masteryhaus', 'agencia-6-cifras-v2', 'sell-your-knowledge', 'aumenta-tu-valor-y-atv-advantage'],
  },
  {
    modulo: 'oferta',
    titulo: 'Promesa y mecanismo: la oferta cabe en una frase',
    categoria: 'Promesa y mecanismo',
    cuerpo: `Qué es: una oferta no es una lista de entregables, es una promesa concreta más la razón por la que es creíble. La promesa es el resultado que el cliente puede imaginar; el mecanismo es tu forma propia y con nombre de lograrlo.
Cuándo se usa: antes de armar el producto, la página o el guion de ventas.
La regla práctica:
- Estructura: "Ayudo a [avatar específico] a lograr [resultado tangible] en [plazo realista] sin [dolor 1] ni [dolor 2], con [mecanismo]".
- El plazo es el tiempo en que se ven resultados, no la duración del programa.
- Construye el mecanismo desde los obstáculos del cliente: qué lo ha frenado, cuáles de esos obstáculos resuelves tú y cómo. Después le pones nombre, para que se note que hay un sistema y no improvisación.
- La ficha de entregables, la metodología y las herramientas van al final, para despejar objeciones; no abren la conversación.
- Toda oferta es una hipótesis hasta que alguien paga. Valídala vendiéndola a pocas personas antes de construir un producto perfecto: más o menos de 3 a 5 ventas si el ticket es alto, de 5 a 10 si es medio.
Error típico: prometer lo que depende del cliente o de la plataforma. Promete solo lo que tu proceso controla y lo que puedes sostener con casos reales; un resultado ajeno a tu método no se promete.`,
    de: ['aumenta-tu-valor-y-atv-advantage', 'masteryhaus', 'sell-your-knowledge', 'agencia-6-cifras-v2'],
  },
  {
    modulo: 'oferta',
    titulo: 'Precio: piso, techo, contexto y fricción',
    categoria: 'Precio',
    cuerpo: `Qué es: el precio se decide con cuatro variables, no con lo que cobra el vecino ni con lo que a ti te parece justo.
Cuándo se usa: al fijar el precio de una oferta nueva y cada vez que sientes que cobras poco o que te dicen "es caro".
Las cuatro variables:
- Piso: lo que te cuesta entregar, incluidos marketing, equipo, herramientas y comisiones. Por debajo de eso pierdes dinero por cada venta.
- Techo: el valor que el cliente percibe en el cambio que le generas. Se calcula con su resultado, no con tus horas de trabajo.
- Contexto: mira qué cobra la competencia para ubicarte, no para copiar su promedio. Bajar el precio sin cambiar lo que entregas te vuelve un producto intercambiable.
- Fricción: qué tan fácil es decir que sí (cuotas, garantía, un primer paso pequeño).
La regla práctica: al lanzar, usa poca fricción para juntar ventas y casos; después sube el precio y quita lo que cuesta mucho entregar, como las sesiones uno a uno. Toma el número como hipótesis y revísalo cada 5 a 10 ventas, no con una o dos.
Señales: si casi nadie pide cuotas, probablemente el precio es bajo; si muchos dicen que sí de inmediato, también. Si las objeciones son siempre de precio, falta valor o convicción antes de que falte rebaja.
Error típico: tratar un descuento como estrategia. Cámbialo por una modificación de qué se entrega o cómo se paga.`,
    de: ['masteryhaus', 'aumenta-tu-valor-y-atv-advantage', '100m-money-models'],
  },
  {
    modulo: 'oferta',
    titulo: 'Ecuación de valor: qué sube y qué baja la percepción',
    categoria: 'Valor',
    cuerpo: `Qué es: el valor que el cliente percibe es el resultado que desea multiplicado por la probabilidad que ve de lograrlo, dividido entre el esfuerzo que debe poner y el tiempo que tarda. El cliente no paga por el entregable: paga por certeza.
Cuándo se usa: cuando la oferta es buena pero no convence, o para decidir qué mejorar antes de bajar el precio.
Las cuatro palancas:
- Subir el resultado soñado: hazlo concreto y visible, con cifras de su negocio y no con adjetivos.
- Subir la probabilidad percibida: casos de clientes parecidos, un proceso con pasos claros, un diagnóstico previo y una garantía que puedas cumplir.
- Bajar el esfuerzo: que el cliente no tenga que aprender ni coordinar; dile qué hace él y qué hacen ustedes.
- Bajar la demora: un primer resultado temprano y visible, aunque pequeño, dentro de las primeras semanas.
La regla práctica: evalúa las cuatro juntas y mejora la más débil. A veces basta con mostrar el avance (un tablero, un reporte semanal) para que el cliente sienta progreso aunque el resultado final tarde lo mismo.
Error típico: cargar la oferta de extras. Más entregables no suben el valor si no mueven alguna de las cuatro palancas; suelen subir el esfuerzo percibido.`,
    de: ['masteryhaus', '100m-money-models'],
  },
  {
    modulo: 'oferta',
    titulo: 'Garantías honestas que sí puedes cumplir',
    categoria: 'Garantía',
    cuerpo: `Qué es: una garantía reduce el riesgo del cliente al decidir. Funciona cuando es específica, está escrita y tú puedes cumplirla sin que te quiebre.
Cuándo se usa: cuando el cliente duda por miedo a pagar y que no pase nada, sobre todo en ticket alto.
Tipos que se pueden sostener:
- De proceso: te comprometes a entregar lo acordado en fechas concretas, y si no lo haces, lo corriges sin costo o devuelves la parte correspondiente.
- De satisfacción con plazo corto: el cliente prueba el primer tramo y puede salir si no ve lo prometido, con condiciones claras.
- De desempeño condicionado: devolución o trabajo extra si no se alcanza un resultado que depende de tu entrega y del cumplimiento de pasos que el cliente también firma.
- Pago ligado al resultado: un fijo menor más un porcentaje de lo que se genera, solo cuando el resultado se puede medir con datos que ambos ven.
La regla práctica: calcula el peor caso antes de ofrecerla; si cumplirla un par de veces te rompería la caja, ajusta las condiciones o el precio. Escríbela con las excepciones a la vista, no en letra chica. La garantía es el remate de la oferta, no su base.
Error típico: garantías infladas, con condiciones escondidas o un resultado que no controlas. Eso genera disputas y destruye la confianza que querías construir. Tampoco mezcles la garantía con cupos o plazos inventados para presionar.`,
    de: ['aumenta-tu-valor-y-atv-advantage', 'growth-partner', 'masteryhaus'],
  },
  {
    modulo: 'oferta',
    titulo: 'Escalera de productos: entrada, principal y continuidad',
    categoria: 'Escalera de productos',
    cuerpo: `Qué es: partir la misma transformación en escalones para que cada cliente entre por el que le corresponde y suba cuando esté listo. Normalmente hay una entrada, una oferta principal y una continuidad.
Cuándo se usa: cuando una sola venta no paga lo que cuesta conseguir al cliente o cuando muchos dicen "ahora no".
Los escalones:
- Entrada: una sola puerta clara, de bajo riesgo (diagnóstico, auditoría, producto pequeño, sesión de valor). Sirve para abrir la conversación y recuperar parte del costo de adquisición; no para regalar tu servicio central.
- Principal: la transformación completa, con su promesa, precio y garantía. Cada escalón superior incluye lo del anterior.
- Continuidad: un pago recurrente por algo que se consume mes a mes (mantenimiento, optimización, acompañamiento). Cuota baja y valor constante.
- Complemento: un extra natural que va con lo principal (algo que sin eso queda incompleto), ofrecido en el momento en que el cliente lo necesita.
Si dicen que no al precio: cambia cómo pagan o qué reciben (cuotas, pago dividido, un tramo menor). Nunca ofrezcas lo mismo más barato.
Error típico: crear demasiados escalones desde el inicio. Agrega capas de a una y mide si el escalón nuevo mejora lo que gana cada cliente antes de sumar otro.`,
    de: ['aumenta-tu-valor-y-atv-advantage', '100m-money-models', 'agencia-6-cifras-v2', 'growth-partner'],
  },
  {
    modulo: 'oferta',
    titulo: 'Los números del negocio: margen, CAC, recuperación y LTV',
    categoria: 'Números del negocio',
    cuerpo: `Qué es: cuatro cuentas que dicen si crecer con publicidad es sano. Se sacan con datos reales del CRM y de los cobros.
Cuándo se usa: antes de subir la inversión en anuncios y cuando el negocio factura pero queda poco.
Las cuentas:
- Margen bruto: lo que cobras menos el costo de entregar. Un margen sano en servicios suele ser arriba de 60%; guía precios, contrataciones y anuncios.
- CAC: todo lo que gastaste en conseguir clientes nuevos (anuncios, sueldos, comisiones, software) entre los clientes nuevos del periodo.
- Recuperación: meses que tardas en recuperar el CAC con la ganancia bruta, no con ingresos.
- LTV: la ganancia bruta que deja un cliente en toda su relación. Una aproximación: precio mensual por margen, entre la tasa de cancelación mensual.
Regla práctica: un cliente debería dejar al menos 3 veces su CAC en toda su vida, y conviene que lo recuperes lo antes posible; cobrar por adelantado o sumar un segundo producto lo acorta.
Tasa de cierre: se lee sobre las mismas personas. De los que asistieron a una llamada, cuántos compraron, y no ventas del mes entre llamadas del mes: así mezclas gente distinta y el porcentaje miente. Lo mismo con agenda y asistencia.
Error típico: buscar leads más baratos cuando el problema es que cada cliente deja poco. Primero mira cuánto vale cada cliente y recién después cuánto cuesta cada lead.`,
    de: ['100m-money-models', 'masteryhaus', 'agencia-6-cifras-v2', 'sell-your-knowledge', 'docs/offer-marco.md'],
  },
  {
    modulo: 'oferta',
    titulo: 'Oferta de una agencia de servicios: oportunidad, no conveniencia',
    categoria: 'Agencias de servicios',
    cuerpo: `Qué es: cómo se arma lo que vende una agencia o consultoría. Hay servicios de conveniencia (lo que el cliente podría hacer solo: contenido, redes, páginas) y de oportunidad (le traen ingresos medibles: anuncios, SEO, correo, ventas). Los segundos justifican un precio más alto porque el cliente ve el retorno.
Cuándo se usa: al definir qué vende una agencia, cuándo subir el precio y cómo cobrar.
La regla práctica:
- Un servicio y un nicho. Cada servicio extra es como operar otra agencia. Parte de lo que ya sabes entregar.
- Si hoy vendes conveniencia, no sueltes clientes: migra poco a poco hacia resultados medibles en 6 a 12 meses.
- Vende a la carta, con lo que el cliente necesita, y evita paquetes inflados con extras que no pidió.
- Cobra por adelantado y con contrato mínimo de tres meses; un resultado serio no cabe en un mes.
- Si el negocio del cliente ya factura y puede medirse, puedes proponer un fijo mensual más un porcentaje de lo que se genera. Ese porcentaje se acuerda por escrito, con la fuente de datos que ambos revisan.
- Elige bien al cliente: descarta al que regatea todo, se sale del canal acordado o exige respuestas fuera de lo pactado. Un cliente malo cuesta más que el ingreso que deja.
Error típico: competir por precio con un servicio idéntico al de todos. Sal de esa pelea con nicho, mecanismo con nombre y un resultado que el cliente pueda comprobar en sus propias cifras.`,
    de: ['iman-gadzhi-agency-navigator', 'growth-partner', 'sell-your-knowledge', 'agencia-6-cifras-v2'],
  },
];
