import type { FichaKnowledge } from './tipos';

// 18/11/2026: método de contenido orgánico destilado de las fichas de asesores (lib/asesores/), con palabras propias.
// Las tres primeras son las BASES: gancho, retención y pilares. Lo demás entra si cabe.
export const FICHAS_ORGANICO: readonly FichaKnowledge[] = [
  {
    modulo: 'organico',
    titulo: 'El gancho promete y el video cumple',
    categoria: 'Ganchos',
    cuerpo: `Qué es: la primera frase o imagen que detiene a quien pasa rápido. Es una promesa; todo lo que sigue tiene que estar a su altura.
Cuándo se usa: al escribir cada guion, antes de pensar en la edición.
La regla práctica:
- No es gancho presentarte, saludar ni decir «hoy te voy a contar». Abre con una mini historia, una opinión fuerte, una pregunta frecuente de tu cliente, un dolor concreto o algo visual que rompa el patrón.
- Tienes unos dos segundos para que quede claro qué valor viene. Si no se entiende qué van a ver, siguen de largo.
- Segmenta con el tema, no con la etiqueta: en vez de «si eres dueño de una clínica», habla de lo que le pasa a esa persona y le llegará sin nombrarla.
- Toma la estructura de un gancho que ya funcionó en otro negocio y cuéntalo con lo tuyo; no esperes el gancho perfecto.
- Abrir fuerte está bien; prometer de más no. Si el contenido entrega menos de lo prometido, la próxima vez tu cara se asocia con el truco y la confianza baja.
Error típico: invertir la mitad del esfuerzo en producción y escribir el gancho al final, con prisa. Escribe cinco versiones del gancho y elige la que entiendas sin contexto.`,
    de: ['metodo-contenido-irresistible', 'mateo-maffia-byf', 'tiktok-100k-jordi-segues', 'hackeando-el-algoritmo'],
  },
  {
    modulo: 'organico',
    titulo: 'Estructura de un video corto y qué leer en sus métricas',
    categoria: 'Guiones de video corto',
    cuerpo: `Qué es: un orden simple para guionizar videos de unos 30 a 60 segundos y una forma de leer cómo les fue.
Estructura:
- Gancho: la promesa, en los primeros segundos.
- Contexto breve: por qué importa lo que vas a decir, para que la persona decida quedarse.
- Valor: una sola idea, con ejemplos y sin repetir. Si son dos ideas, son dos videos.
- Cierre: algo que aporte (una conclusión, una pregunta que invite a comentar) y no una despedida ni un favor.
Mantén el ritmo: cambia de plano o de recurso cada pocos segundos y entrega la información de a poco, dejando ver que todavía falta algo. Un audio claro pesa más que una cámara cara.
Qué mirar después:
- Tiempo visto y porcentaje que llega al final: dicen si el gancho y el ritmo funcionan.
- Compartidos y guardados: son la señal más confiable de que el video sirvió. Los me gusta dicen menos.
- Mira el conjunto, no un video: de cada diez, uno o dos destacan y es normal. Un video flojo a los tres días puede mejorar semanas después; no lo borres por impaciencia.
Error típico: juzgar al creador por un solo resultado, o estirar el video para llegar a una duración que nadie pidió.`,
    de: ['metodo-contenido-irresistible', 'tiktok-100k-jordi-segues', 'hackeando-el-algoritmo', 'mateo-maffia-byf'],
  },
  {
    modulo: 'organico',
    titulo: 'Pilares de contenido y ritmo de publicación sostenible',
    categoria: 'Pilares y ritmo',
    cuerpo: `Qué es: dos o tres grandes temas de la cuenta (pilares), con subtemas adentro, y un ritmo que puedas mantener.
Cómo se arma:
- Elige los pilares desde lo que tu cliente necesita saber antes de comprar: educativo, casos y testimonios, el detrás de escena de cómo trabajas y tu opinión sobre el sector.
- Cada video se clasifica en uno de tres trabajos: llegar a gente nueva (tema amplio), nutrir a quien ya te sigue (tema de nicho) o llevar a una acción (escribir, agendar, ir al enlace). Se miden distinto.
- La mayor parte del contenido educa o muestra; las promociones son pocas, y siempre con un plazo real.
Ritmo:
- Empieza con una publicación por semana y sube a cuatro y luego a seis solo cuando el nivel actual ya funciona sin cansarte.
- Un día fijo para planear y grabar por lotes, con una planilla de ideas y guiones del mes donde marcas lo ya grabado.
- La constancia la sostiene el sistema, no la inspiración. Delega por etapas, empezando por lo que más tiempo te quita (edición, luego ideas).
- Prueba horarios y quédate con los que muestren más alcance en tus datos.
Error típico: publicar sin pilar, lo que se te ocurre cada día; o fijar un ritmo diario y abandonar a las dos semanas.`,
    de: ['metodo-contenido-irresistible', 'growing-content-specialist', 'mateo-maffia-byf', 'instituto-de-marca-personal'],
  },
  {
    modulo: 'organico',
    titulo: 'Ideas que se comparten: juntar dos mundos lejanos',
    categoria: 'Ideas y formatos',
    cuerpo: `Qué es: un tema no es una idea. Un tema (finanzas, salud, ventas) ya lo cubren miles de cuentas con el mismo enfoque. Una idea aparece cuando chocan dos cosas que parecen no tener relación.
Cuándo se usa: antes de escribir, cuando todo lo que sale suena a lo ya visto.
Pasos:
- Prueba rápida: si puedes explicar tu video con una sola palabra, sigue siendo un tema. Si necesitas dos cosas sin relación para explicarlo, ya hay una idea.
- Junta semillas todo el tiempo: una frase, una escena, algo que te movió. La señal de una buena semilla es emocional, no intelectual.
- Para acelerar el choque no preguntes «¿qué video hago de esto?»; pregunta «¿a qué se parece esto?».
- Antes de grabar decide qué quieres que la persona sienta al terminar. Lo que se recuerda es el sentimiento, no el dato ni el truco.
- Busca que sea compartible: la gente reenvía lo que la hace ver bien (inteligente, graciosa, sensible). Pregúntate qué diría de quien lo manda.
- Mira videos que ya funcionaron, en tu sector y en otros, y toma la estructura; cuéntalo con lo tuyo.
Error típico: pedir ideas a una herramienta de IA sin más; ella va al punto más obvio porque se formó con lo ya dicho. Úsala para ordenar y pulir, no para encontrar la colisión.`,
    de: ['inteligencia-viral-2026', 'growing-content-specialist'],
  },
  {
    modulo: 'organico',
    titulo: 'De la audiencia a la conversación: contenido de nicho, historias y mensajes',
    categoria: 'Del alcance a la venta',
    cuerpo: `Qué es: el alcance solo no vende un servicio de ticket alto. Lo que vende es una conversación con la persona correcta.
Cómo se conecta:
- Prefiere contenido de nicho: un público, un mensaje, a diario. Mide por mensajes recibidos, prospectos y llamadas, no solo por vistas. Un video viral trae audiencia genérica sin el problema ni el presupuesto.
- Reparte el contenido: más de la mitad sobre los problemas de tu cliente, cerca de un tercio en soluciones y casos, el resto en las dudas que frenan la compra.
- Los reels sirven para que te conozcan; las historias, para vender a quien ya te sigue: resultados reales de clientes con su permiso, un antes y después verdadero, respuestas a preguntas.
- Invita a una acción simple: «comenta una palabra y te envío la guía por mensaje». Funciona solo si lo que ofreces vale el esfuerzo; si nadie comenta, mejora el regalo, no insistas. Revisa la automatización una vez al mes.
- El destino cuenta: la página o la agenda a la que llegan tiene que ser rápida y clara, o se pierde ahí lo que ganaste.
- Un lanzamiento orgánico dura una semana de historias seguidas (el problema, tu método, tu historia, resultados, una clase gratis y la invitación), sin saltarte días. Contesta a todos de forma personal.
Error típico: automatizar un mensaje frío a cualquiera. Responde primero a lo que la persona pidió.`,
    de: ['manychat-master-instagram', 'arcadia', 'academia-de-lanzamiento', 'the-perfect-launch', 'sell-your-knowledge', 'metodo-fukuda-poder-organico'],
  },
  {
    modulo: 'organico',
    titulo: 'Contenido que se encuentra: búsqueda en Google y YouTube',
    categoria: 'SEO y YouTube',
    cuerpo: `Qué es: parte del alcance no llega por un algoritmo de recomendación, sino porque alguien busca algo. Ese contenido sigue trayendo gente meses después.
Cómo se trabaja:
- La persona busca distinto según su etapa: tiene un problema, compara soluciones o está lista para comprar. Para vender importan las búsquedas de compra; las informativas atraen y se enlazan a las de compra.
- Antes de escribir mide cuánta gente busca esa frase y en qué época del año; una página sin búsquedas detrás no trae a nadie.
- Una página por intención. Dibuja el árbol de categorías de tu sitio antes de construirlo, para que dos páginas no compitan por lo mismo.
- Capta la atención en los dos primeros párrafos y resuelve de verdad lo que promete el título.
- En YouTube elige un nicho y planea unas 40 ideas con sus etiquetas; mira canales grandes de tu tema en otros idiomas para ver qué funciona y adáptalo sin copiar.
- Empaca primero: decide título y miniatura antes de grabar y estudia los que ya tuvieron buen clic. Lleva el esfuerzo a los primeros minutos y confirma pronto la promesa del título.
- Mezcla temas atemporales con temas del momento si tocan tu nicho.
Error típico: grabar sin saber cómo se va a titular y presentar, o publicar sin palabra clave que alguien escriba.`,
    de: ['bigseo-academy', 'universidad-de-youtube', 'instituto-de-marca-personal'],
  },
];
