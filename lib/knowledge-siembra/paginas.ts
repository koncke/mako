import type { FichaKnowledge } from './tipos';

// Páginas de venta: VSL y landing. Destilado del curso propio de MaKo sobre VSL y landing, con el contrato de bloques del
// redactor de landings (lib/landing-writer.ts). Paráfrasis propia, sin nombres de personas ni de clientes.
export const FICHAS_PAGINAS: readonly FichaKnowledge[] = [
  {
    modulo: 'paginas',
    titulo: 'Una página, una promesa: define el norte antes de escribir',
    categoria: 'Estructura',
    cuerpo: `Qué es: el norte es el diferencial de lo que vendes, el argumento central de la página. Video, gráficos y landing cuelgan de ahí.

Cuándo se usa: siempre, antes de la primera palabra. Si el norte no está claro, no se empieza.

La regla práctica:
- Escribe en una línea qué NO es (la categoría saturada que el visitante ya conoce) y qué ES (lo que haces distinto).
- Un concepto por página y por video. Si dos funciones o dos ofertas compiten, cada una tiene su propia página.
- Lo que no sostiene el norte no va en esa página. Si algo no pertenece, se muda a otra página; no se deja ahí "porque ya estaba".
- El visitante no es analista: quiere decidir y actuar. Habla de lo que va a poder hacer hoy, no de todo lo que el producto tiene.

El error típico: una página que enumera todo lo que existe. Mejor veinte páginas claras que una que mezcla veinte temas.`,
    de: ['vsl-landing'],
  },
  {
    modulo: 'paginas',
    titulo: 'El video es la promesa y la página la sostiene',
    categoria: 'Estructura',
    cuerpo: `Qué es: cuando hay un VSL, la landing no lo repite: lo continúa. Si video y página hablan de cosas distintas, el visitante siente un cambio de tema y se va.

Cuándo se usa: al escribir o revisar cualquier landing que tenga video.

Los pasos:
- El guión es la fuente de verdad de la página. Lo que el video no menciona, no es protagonista de la página.
- Audita antes de reescribir: no des por buenas las secciones que ya estaban. Revisa que cada una responda a la promesa del video.
- El video reemplaza al párrafo introductorio: el subtítulo baja a una sola línea.
- Antes de prometer algo en la página, verifica que existe y funciona hoy. Nunca anuncies lo que está apagado o por venir como si ya estuviera.
- Si un bloque roza otra oferta, un renglón corto que lleve allá, solo si suma de verdad.

El error típico: pegar la transcripción del video en la página, o dejar secciones viejas de otra oferta debajo de un video nuevo.`,
    de: ['vsl-landing'],
  },
  {
    modulo: 'paginas',
    titulo: 'El orden de una landing que convierte',
    categoria: 'Estructura',
    cuerpo: `Qué es: una secuencia de 6 a 10 bloques que lleva al visitante de la atención a la decisión sin saltos.

El orden que funciona:
1. Hero: promesa en el titular, una línea de apoyo, botón y, si hay, el video al lado.
2. Prueba rápida: un dato real o un logo verdadero, en una franja corta.
3. Problema: la pregunta incómoda que el dueño hoy no sabe responder.
4. Solución: qué cambia, dicho como resultado.
5. Cómo funciona: dos o tres pasos, no una lista de funciones.
6. Prueba larga: caso real con antes y después.
7. Objeciones: una o dos, las que de verdad frenan esta compra.
8. Oferta y precio, con las condiciones completas (cuotas incluidas).
9. Cierre: botón final con una sola acción.

Reglas: el primer bloque es siempre el hero y el último siempre el cierre con botón. Un botón al final de cada bloque importante y también después de "Cómo funciona". Si no tienes testimonios reales, el bloque va vacío con la nota de qué prueba falta; nunca se inventa.`,
    de: ['vsl-landing', 'lib/landing-writer.ts'],
  },
  {
    modulo: 'paginas',
    titulo: 'Títulos que se entienden solos y el para qué',
    categoria: 'Copy de la página',
    cuerpo: `Qué es: los visitantes deslizan, no leen. Cada título tiene que funcionar sin el texto de abajo.

La regla práctica:
- Escríbelos personales, en tú y hablándole al lead: "Con esto vas a ver el recorrido de tus leads, del anuncio al pago".
- Máximo dos líneas. Si no entra, se recorta el copy, no el tamaño de letra.
- En cada sección hazte la pregunta: ¿para qué le sirve esto al cliente? Explicar qué hace es obvio y técnico; la respuesta útil es el beneficio (por ejemplo, saber exactamente dónde se cae el recorrido, o dar seguimiento según dónde se quedó cada lead).
- Nunca dos títulos seguidos que digan lo mismo.
- Un hilo conector atraviesa la página: el subtítulo del hero abre una pregunta y los bloques siguientes la van contestando. Menos es más: un subtítulo corto y punzante le gana al párrafo explicativo.
- Plural cuando hablas de leads en general; singular solo cuando el bloque trata de un lead concreto.

El error típico: títulos ingeniosos que solo entiende el equipo.`,
    de: ['vsl-landing'],
  },
  {
    modulo: 'paginas',
    titulo: 'Nombres explícitos y cero jerga',
    categoria: 'Copy de la página',
    cuerpo: `Qué es: cada nombre de función, sección o botón se entiende a la primera, sin contexto.

La prueba: dile el nombre a alguien de afuera. Si tiene que preguntar qué es, el nombre está mal.

La regla práctica:
- Explícito le gana a ingenioso. "Anuncios para tu embudo" y "WhatsApp" se entienden; un apodo interno suelto no.
- Un apodo con personalidad solo vale acompañado de la palabra clara, nunca solo.
- Fuera la jerga de interfaz y de analista: nombres de tablas, siglas de métricas, "modal", "toast", "del lado del servidor". Habla de dinero, negocio, pasos y pedazos.
- Usa el mismo nombre para la misma cosa en toda la página y en el video.
- Dilo como lo diría el cliente ("tu landing", "tus agendas"), con sus palabras y en tú.
- Un puente a otra sección arranca con una invitación clara ("Descubre cómo…") y enlaza a la que mejor continúa el hilo, no a la más obvia.

El error típico: que la página suene a producto interno y no a conversación con un dueño de negocio.`,
    de: ['vsl-landing'],
  },
  {
    modulo: 'paginas',
    titulo: 'Guion de VSL: el checklist antes de grabar',
    categoria: 'VSL',
    cuerpo: `Qué es: las reglas que un guion debe pasar antes de mostrarse a nadie.

Cuándo se usa: en cada borrador de VSL corto, sea una voz narrada o una persona a cámara.

El checklist:
- Define el norte antes de la primera frase.
- Picante: preguntas retóricas que exponen ("Eso no es tener un sistema, es tener una intuición"). Sin tensión no hay atención.
- Cero repetición de palabras ni de ideas: barre el texto antes de entregarlo.
- Objeciones con entrada directa: "Y si tu objeción es X, déjame decirte algo". Solo una o dos, la que ataca el tema de ese video.
- Sin jerga técnica; habla de dinero y de decisiones.
- Un concepto por VSL.
- Concreto y puntual, nunca "hace todo solo": "te avisa por WhatsApp cuando se agenda una llamada" sí.
- Cierre de máximo dos frases. Funciona el patrón "No es X. Es Y."
- Si falta contexto, pregunta cosas específicas del guion, no generales. Los dolores del cliente chocan con su ego: no los admite en voz alta, hay que hacérselos ver.

El error típico: cerrar con una pila de clichés y frases de relleno.`,
    de: ['vsl-landing'],
  },
  {
    modulo: 'paginas',
    titulo: 'La prueba: una sola cosa, real y sostenida',
    categoria: 'Prueba',
    cuerpo: `Qué es: la evidencia de que lo que prometes ya funcionó para alguien. Es el bloque que más pesa en una decisión de ticket alto.

La regla práctica:
- Muestra una prueba sostenida, sin cortes rápidos: los cambios veloces de imagen generan desconfianza.
- Estructura de un caso: situación antes (qué intentaba, qué número tenía), qué cambió, resultado con cifras y un plazo, y una línea que lo resuma ("La misma oferta. Lo único que cambió fue decidir con datos").
- Todo número sale de datos que el cliente puede confirmar y se dice de dónde viene. Los resultados de un caso no se presentan como garantía para todos.
- Dos bloques funcionan mejor que uno: primero el video o texto con la historia, luego los descartes ("ninguna otra app lo resolvió") con las capturas.
- El caso va idéntico en todas las páginas de la misma oferta, y debajo del botón.
- Si no tienes prueba real, el bloque va vacío con la nota de qué conseguir. Nunca se inventan testimonios, nombres, cifras ni logos.

El error típico: llenar la página de pruebas pequeñas en vez de un caso entero y creíble.`,
    de: ['vsl-landing', 'lib/landing-writer.ts'],
  },
  {
    modulo: 'paginas',
    titulo: 'Maquetación: un hero, fondos por bloque y botón al cierre',
    categoria: 'Diseño',
    cuerpo: `Qué es: reglas visuales que hacen que la página se lea sola.

La regla práctica:
- El hero sigue la misma estructura en todas las páginas: etiqueta, titular, subtítulo, botón y nota pequeña a un lado; video o imagen al otro. No inventes un hero distinto por página.
- Fondo alternado por bloque, a todo el ancho, para que se vea dónde termina una sección. El título de cada sección vive dentro de su fondo.
- Botón al cierre de cada bloque y tras el cómo funciona.
- El costado (video, gráfico, captura) llena su columna: nunca una pieza chica con aire arriba y abajo.
- Claridad antes que creatividad. Si dudas entre ingenioso y claro, gana claro.
- Audita textos innecesarios en cada pasada: etiquetas sueltas, subtítulos que repiten, citas decorativas, notas técnicas. Lo que no vende, sobra.
- El video arranca en silencio; si hay animaciones, van en bucle (una que se congela es peor que ninguna).

El error típico: sumar elementos nuevos sin quitar los viejos.`,
    de: ['vsl-landing'],
  },
  {
    modulo: 'paginas',
    titulo: 'Texto en pantalla y ritmo del VSL',
    categoria: 'VSL',
    cuerpo: `Qué es: cómo se ve y se escucha un VSL corto para que se entienda sin esfuerzo.

La regla práctica:
- Fondo claro y letra oscura legible; un color de énfasis para las palabras clave y uno solo de marca.
- El texto en pantalla es exacto al audio, palabra por palabra. Excepción: los números van como cifras ("9 de cada 10") aunque el audio los diga con letras.
- Máximo dos líneas por pantalla. Mejor ochenta frases cortas que cuarenta largas; el texto largo vuelve aburrido el video.
- Cuando el guion nombra una aplicación, muestra su logo real. Nombrarla sin mostrarla regala el reconocimiento que ya tiene.
- Una idea por gráfico y un elemento a la vez: primero el texto, después el tablero.
- Capturas a pantalla completa y sin texto encima cuando son la prueba.
- Antes de crear cualquier gráfico, describe en palabras el concepto y espera el visto bueno: asumir cuesta días.
- Valida la locución antes de armar el video: el audio es la espina y todo se re-alinea si cambia.

El error típico: efectos a medias; si haces un efecto, hazlo completo.`,
    de: ['vsl-landing'],
  },
];
