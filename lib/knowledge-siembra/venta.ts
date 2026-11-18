import type { FichaKnowledge } from './tipos';

// Método de conversación y cierre para servicios de ticket alto: del primer mensaje a la llamada, y de la llamada al seguimiento.
// Paráfrasis propia destilada de las fichas de asesores y de los documentos de conocimiento del repo; sin nombres de personas,
// sin escasez inventada y sin promesas de ingresos.
export const FICHAS_VENTA: readonly FichaKnowledge[] = [
  {
    modulo: 'venta',
    titulo: 'Las seis etapas de una llamada de venta de ticket alto',
    categoria: 'Estructura de la llamada',
    cuerpo: `Qué es: una llamada de ticket alto tiene seis tramos: apertura, marco, cualificación, presentación, cierre y objeciones.
Cuándo se usa: en toda llamada de venta o de diagnóstico.
- Apertura: la parte más corta. Un saludo cálido y de inmediato el tema. Alargarla para caer bien no vende: la gente compra porque le resuelves un problema.
- Marco: di cómo va a ser la llamada, cuánto dura y qué decidirán al final (seguir o no). Pregunta ahí mismo si hay alguien más que participe en la decisión (pareja, socio) y si puede estar. Si se pregunta al final, aparece como «lo tengo que consultar».
- Cualificación: aquí se hace casi toda la venta. Pregunta y escucha (ver la ficha de descubrimiento).
- Presentación: solo lo que ataca lo que la persona dijo.
- Cierre: pide la decisión con claridad.
- Objeciones: se resuelven con lo que la propia persona contó.
Quien lidera la llamada es quien vende: si no avanza, falta guiarla.
El error típico: presentar la oferta sin haber cualificado, o dar un marco vago y recibir el «lo pienso» al final. Y si todas las llamadas cuestan, revisa lo que pasa antes de ellas (a quién llega el anuncio, qué se le dijo).`,
    de: ['lib/asesores/ficha-augusto-bianchi.ts', 'lib/asesores/ficha-samuel-albaa.ts', 'academia-five-stars'],
  },
  {
    modulo: 'venta',
    titulo: 'Del primer mensaje a la llamada: abrir y calificar por WhatsApp o DM',
    categoria: 'Setter',
    cuerpo: `Qué es: el primer contacto por mensaje tiene un solo trabajo: confirmar que encaja y llevarlo a una conversación o llamada de evaluación.
Cuándo se usa: cuando llega un lead por anuncio, formulario o mensaje directo.
- Responde en minutos, por el canal donde escribió y con su nombre. La motivación es máxima al principio y cae con cada hora.
- Abre con referencia a lo que pidió o respondió, no con un texto genérico. Un mensaje, una pregunta; la conversación se avanza de a una.
- Califica con dos o tres preguntas cortas: la primera, fácil, confirma que es el lugar correcto; otra filtra por presupuesto o prioridad; otra, por tiempo y expectativas. Mejor indirectas que «¿cuánto ganas?».
- No mandes PDF y precios de entrada: la conversación vende la conversación, no el programa.
- Presenta la llamada como una evaluación: duración, quién atiende, qué se lleva aunque no compre, y que si no encaja se le dice.
- Ofrece dos horarios concretos y confirma en su zona horaria. Quien no califica no ve la agenda: recibe el recurso o el escalón que le sirve.
El error típico: contestar horas después, hacer cinco preguntas seguidas o mandar el precio sin contexto.`,
    de: ['lib/asesores/ficha-agustin-nievas.ts', 'docs/conocimiento/anuncios-high-ticket.md', 'docs/conocimiento/patrones-email.md'],
  },
  {
    modulo: 'venta',
    titulo: 'Objeciones: identificar, aislar y resolver con lo que la persona contó',
    categoria: 'Objeciones',
    cuerpo: `Qué es: casi siempre una objeción es una duda o una falta de certeza, no un rechazo. Las más comunes: dinero, pareja o socio, tiempo, miedo, valor y confianza. Dinero, pareja y tiempo pueden ser logística real o miedo disfrazado.
Cuándo se usa: cuando aparece un «pero», un «lo pienso» o un «es caro».
Pasos:
- Escucha completa y no discutas: nunca vayas en contra («no es caro»). Acompaña y sigue: «entiendo, veamos qué incluye».
- Pregunta «¿a qué te refieres?» o repite en forma de pregunta su última frase, para que se explique.
- Aísla: «si no fuera por esto, ¿habría otra razón para no avanzar?». Así llegas a la que de verdad traba.
- Resuelve con sus propias palabras del descubrimiento, no con una respuesta de manual.
- Si es miedo, valida lo que siente y pregunta qué lo haría sentirse seguro. Si es logística (plata, tiempo), habla claro de cuánto puede hoy y después, y si no alcanza, recomienda otro camino.
- Confirma: «si resolvemos esto, ¿avanzamos?».
Ante una creencia sobre el precio, pregunta de dónde sacó ese número y cómo lo calculó: casi siempre se cae sola.
El error típico: tratar a fondo la primera objeción, que a veces era humo, o suponer en vez de preguntar.`,
    de: ['lib/asesores/ficha-agustin-nievas.ts', 'lib/asesores/ficha-tino-mossu.ts', 'lib/asesores/ficha-augusto-bianchi.ts'],
  },
  {
    modulo: 'venta',
    titulo: 'Descubrimiento: los tres dolores y cómo prevenir objeciones',
    categoria: 'Estructura de la llamada',
    cuerpo: `Qué es: la etapa de preguntas donde la persona ve su situación con claridad y el costo de no actuar. Dura de 15 a 25 minutos y se hace antes de hablar de tu oferta.
Cuándo se usa: siempre, después del marco.
Tres bloques:
- Dolor presente: qué hace hoy, qué funciona y qué no, qué resultados tiene.
- Futuro deseado: qué quiere lograr y por qué esa meta.
- Costo de no cambiar: qué pasa en uno o dos años si todo sigue igual y por qué hacerlo ahora.
Mientras responde, anota en cuatro columnas: su problema principal, su situación, sus objetivos y lo que tendría que lograr (el qué, no el cómo). Esas notas son el guion de la oferta: se le muestra lo que dijo que necesita.
Prevenir objeciones aquí cuesta menos que resolverlas al final:
- Tiempo: cuántas horas reales puede dedicar.
- Dinero: qué rango de inversión maneja, antes de ofertar.
- Decisión: si alguien más participa.
- Qué intentó antes y por qué no funcionó.
Ante una respuesta vaga («quiero ganar más»), pide que se explique con «¿a qué te refieres?».
El error típico: pasar a la oferta con datos a medias, o inventar un dolor que no dijo.`,
    de: ['lib/asesores/ficha-agustin-nievas.ts', 'lib/asesores/ficha-samuel-albaa.ts', 'growing-closer-agustin-nievas-samuel-albaa'],
  },
  {
    modulo: 'venta',
    titulo: 'Presentar la oferta y pedir la decisión',
    categoria: 'Cierre',
    cuerpo: `Qué es: pasar de entender a proponer, en poco tiempo, y pedir una decisión clara.
Cuándo se usa: cuando el descubrimiento tiene dolor, meta y razones para cambiar.
Transición: pregunta si falta algo importante, atiende las dudas y, si ayuda, cuenta un caso real parecido (solo verdaderos).
La oferta, en tres partes y de 10 a 15 minutos como máximo:
- El resultado concreto y el plazo, con las palabras del cliente.
- El puente por fases: de dónde está a dónde llega, y por qué funciona cada fase.
- Lo que recibe y cómo lo acompañas.
Vende resultados, no características: une cada beneficio con lo que significa para su vida. Demasiada información genera dudas.
El cierre:
- Compromiso: pregunta si encaja al cien por ciento. Busca certeza, no un «creo que sí».
- Próximos pasos: qué sigue para entrar.
- Inversión: di el precio claro y calla.
Pregunta de transición útil: «del 1 al 10, ¿qué tan cerca estás de avanzar?». Con 7 o más, deja de vender y cierra.
Cuotas: no las ofrezcas de entrada. Pregunta cuánto puede pagar hoy y cuándo el resto, y muéstralas completas, sin esconder nada.
El error típico: prometer garantías o resultados que no existen por escrito.`,
    de: ['lib/asesores/ficha-agustin-nievas.ts', 'lib/asesores/ficha-tino-mossu.ts'],
  },
  {
    modulo: 'venta',
    titulo: 'Seguimiento: crear razones para volver a hablar sin saturar',
    categoria: 'Seguimiento',
    cuerpo: `Qué es: la mayoría de las ventas de ticket alto se decide después del primer contacto. Seguir es crear razones para mantener la conversación; casi nunca aparecen solas.
Cuándo se usa: con quien no respondió, no agendó, no asistió o no compró.
Tres tipos de toque, de menos a más presión:
- De contacto: aporta algo útil (un caso, un dato del rubro, un recurso).
- De venta: vuelve a presentar la propuesta desde otro ángulo.
- De cierre: pide la decisión con claridad.
Lo hacen efectivo cuatro cosas: rapidez, constancia, personalización y variedad de canales. Un ritmo razonable (una o dos veces por semana, alternando valor y propuesta) mantiene la relación; muchos mensajes seguidos la queman y, en WhatsApp, ponen en riesgo la línea.
Después de una llamada sin compra:
- Al día siguiente, un mensaje corto y sin link: «¿qué pasó, fue el momento, la inversión u otra cosa?». Una frase alcanza.
- Luego casos parecidos, una observación del rubro y una objeción por mensaje.
- Cuando se abra un lugar real, avísale primero.
El error típico: un solo intento y silencio, o repetir el mismo mensaje con otras palabras.`,
    de: ['lib/asesores/ficha-tino-mossu.ts', 'docs/conocimiento/patrones-email.md'],
  },
  {
    modulo: 'venta',
    titulo: 'Entre la agenda y la llamada: lograr que la gente llegue',
    categoria: 'Seguimiento',
    cuerpo: `Qué es: la gente falta por falta de información y de compromiso, no por mala fe. Entre agendar y la llamada se trabaja la asistencia.
Cuándo se usa: desde el momento en que alguien agenda.
- Confirma al instante: día y hora en su zona horaria, el link de la sala y cómo reagendar. Pide un «sí» por WhatsApp para confirmar.
- Escribe o llama en menos de 5 minutos si hay un horario libre hoy.
- Presenta a quien atiende (nombre, rol, algo humano) y dile qué va a pasar en la llamada: dónde está, a dónde quiere llegar, qué le frena.
- Una tarea corta antes de la llamada (un video breve, reunir sus números) y qué traer, incluida la persona que decide.
- Recordatorios simples y sobrios: la víspera, una hora antes y diez minutos antes, con el link. Por dos canales (email y WhatsApp).
- Una victoria rápida y una objeción por mensaje, con espacio entre uno y otro.
- Siempre ofrece reagendar: es mejor mover la cita que perder el lead.
- Si no llega: escribe el mismo día, sin culpa, con dos horarios nuevos. Después, un caso parecido y una pregunta de sí o no.
El error típico: confiar solo en un recordatorio automático, o llenar al lead de mensajes largos.`,
    de: ['docs/conocimiento/patrones-email.md', 'docs/conocimiento/anuncios-high-ticket.md'],
  },
  {
    modulo: 'venta',
    titulo: 'Práctica y números del closer',
    categoria: 'Práctica',
    cuerpo: `Qué es: cerrar es un oficio que se mejora con práctica y con datos, no con un guion memorizado.
Cuándo se usa: todos los días, y antes de las llamadas importantes.
- Role play frecuente: repite la parte que salió peor hasta que salga sola. Concéntrate en presentación y cierre: el orden en que dices las cosas cambia el resultado.
- Adáptate a la persona, no a un guion: escucha en vez de pensar en la siguiente pregunta. Quien pregunta por el retorno quiere ir al grano.
- El precio no cambia el proceso: se vende igual un servicio de 500 que de 30.000. Lo que cambia es el nervio, y se vence haciéndolo.
- Registra cada día: llamadas agendadas, asistencias, inasistencias, cancelaciones, seguimientos y cierres.
Ubica la pérdida: si fallan los cierres, mira la cualificación y las objeciones; si faltan asistencias, el trabajo previo; si faltan agendas, el mensaje y el primer contacto.
El error típico: medir solo cuántas ventas se cerraron, sin saber en qué etapa se pierde la gente.`,
    de: ['lib/asesores/ficha-samuel-albaa.ts', 'lib/asesores/ficha-augusto-bianchi.ts'],
  },
  {
    modulo: 'venta',
    titulo: 'Mensajes y correos que venden: una idea, un pedido y pedir respuesta',
    categoria: 'Redacción',
    cuerpo: `Qué es: un mensaje de venta por email o WhatsApp lleva a una conversación, no a una compra del programa.
Cuándo se usa: al redactar secuencias, seguimientos o plantillas.
- Una pieza, una idea y un pedido. Dos pedidos (comprar lo barato y agendar la llamada) dividen la decisión. En una secuencia cambia el ángulo, nunca el pedido.
- Claridad antes que ingenio: frases cortas, voz activa, beneficio antes que característica, las palabras del cliente. Escribe como a una persona, con su nombre.
- La estructura es andamiaje: atención, interés, deseo y acción; o problema, consecuencia y salida; o antes, después y puente. No se nota.
- Pide respuesta: «respóndeme con una palabra» sirve para medir intención y para que el equipo arranque la conversación. Quien responde recibe contestación en minutos.
- Segmenta por estado: el mensaje depende de si agendó, asistió o compró. Verifica antes de cada toque y no lo repitas a quien ya lo recibió.
- El asunto: de 4 a 8 palabras, un solo ángulo, sin mayúsculas ni signos excesivos.
- La urgencia solo si es real y comprobable; nunca inventes cupos ni plazos.
El error típico: prometer lo que el negocio no puede cumplir o mandar el mismo texto a toda la lista.`,
    de: ['lib/copywriting-metodo.ts', 'docs/conocimiento/patrones-email.md'],
  },
];
