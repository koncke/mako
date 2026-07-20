// =============================================================================
// Contenido del Curso AVATARHYPE para el portal /conocimientos.
// AUTO-GENERADO desde el Google Doc "Curso AVATARHYPE" (transcripciones
// limpiadas + recursos). Para editar el contenido, editar este archivo.
// =============================================================================

export type Recurso = { label: string; url: string; tipo: 'gpt' | 'notion' | 'capturas' | 'pdf' | 'zip' | 'doc' | 'link' };
export type Herramienta = { nombre: string; url: string; nota?: string };
export type Clase = {
  n: number;
  titulo: string;
  cardDesc: string;
  videoId: string | null;
  resumen: string[];
  transcripcion: string[];
  transcripcionNota?: string;
  recursos: Recurso[];
  herramientas: Herramienta[];
};
export type PromptRec = { titulo: string; desc: string; texto: string };
export type Banco = { titulo: string; desc: string; items: { label: string; url?: string }[] };
export type Curso = {
  eyebrow: string; titulo: string; subtitulo: string; volumen: string;
  clases: Clase[]; prompts: PromptRec[]; bancos: Banco[];
};

export const CURSO: Curso = {
  "eyebrow": "Área de alumnos",
  "titulo": "Curso AVATARHYPE",
  "subtitulo": "Genera anuncios y UGC hiperrealistas con IA —imagen y video— por céntimos. Todo el curso, sus prompts y sus recursos, en un solo lugar.",
  "volumen": "Vol. 1–3",
  "clases": [
    {
      "n": 1,
      "titulo": "Introducción",
      "cardDesc": "Cómo está armado el curso y las dos herramientas base: Kie.ai y APImart.",
      "videoId": "1CN-9GKAHbhsMT55RPDk6M-pNc3R6SPrV",
      "resumen": [
        "Herramientas principales del curso: dos plataformas, Kie.ai y APImart. En ambas se carga saldo entrando al perfil o al panel de control (dashboard) y yendo a la sección 'Billing' o 'Cartera'; en APImart el saldo mínimo es de 10 dólares.",
        "Kie.ai se usa sobre todo en el Volumen 1, donde se trabaja con el modelo Sora. OpenAI cerró Sora oficialmente, por lo que ya no está disponible en Kie.ai al precio anterior de 0,15 USD por 15 segundos.",
        "Para seguir usando Sora hasta septiembre se puede usar APImart: se aprovechan los mismos recursos y estructura de prompts del Volumen 1, cambiando simplemente 'Kie' por 'APImart'.",
        "A partir del Volumen 2 se introduce APImart como herramienta principal, trabajando con el modelo v3.1 (buenos resultados). En el Volumen 4 se actualizó el modelo y se agregó una biblioteca de recursos.",
        "Recomendación del instructor: revisar primero todo el contenido antes de empezar a generar, ya que el material es resumido y directo, pensado para no hacer perder tiempo.",
        "Hay un tablón de comunicaciones ubicado encima del curso para avisos y novedades; además se está creando una plataforma nueva donde se irá subiendo el contenido de las próximas actualizaciones."
      ],
      "transcripcion": [
        "Antes de comenzar quiero hacer una pequeña introducción de cómo está estructurado el curso, porque al final el mundo de la IA está en continuo cambio y en continua actualización. Voy a enseñaros también qué dos herramientas principales vamos a utilizar en esta formación y cómo agregar saldo en ellas, porque en los vídeos no lo he explicado, así que conviene que lo sepáis desde ahora.",
        "La primera herramienta va a ser Kie.ai. No os preocupéis, porque en los siguientes vídeos tenéis todos los enlaces debajo, en la descripción, pero simplemente para que lo sepáis: vais a tener que entrar aquí, a vuestro perfil, ir a 'Cartera' (o 'Billing' si lo tenéis en inglés) y ahí podéis añadir el saldo. Por otro lado tenemos la herramienta APImart. Ahora os explico cuándo utilizamos cada una; el proceso es básicamente el mismo: vais a ir a vuestro dashboard, a vuestro panel de control, y en el mismo sitio, en 'Billing' o 'Cartera' en español, podréis añadir los créditos, que en APImart son de diez dólares como mínimo.",
        "¿Qué más respecto a Kie? Es que la utilizamos sobre todo en el Volumen 1, que es donde usamos el modelo Sora, el cual veréis a continuación. Pero, como muchos sabréis, OpenAI ha cerrado oficialmente Sora, así que por desgracia en Kie ya no está disponible, y además al precio tan ridículamente barato que teníamos, que era de 0,15 por quince segundos. Aun así, si queréis seguir aprovechando el Volumen 1 y utilizando Sora hasta septiembre, lo tenéis disponible en APImart, que es la segunda herramienta que utilizamos a partir del Volumen 2. Entonces, por si alguien quiere seguir usando Sora, puede utilizar todos los recursos y la forma en que estructuramos los prompts del Volumen 1, y simplemente cambiar 'Kie' por 'APImart'.",
        "Después tenemos el Volumen 2, donde ya introducimos la herramienta APImart y trabajamos con el modelo v3.1, con muy buenos resultados. En el Volumen 4 hicimos una actualización de modelo y añadimos también una biblioteca de recursos. Solo comentar que mi recomendación es que le echéis un ojo primero a todo, porque el contenido está muy resumido, va al grano y va directo: pretendíamos no meter de lleno a nadie ni hacerle perder el tiempo, así que yo revisaría todo antes de empezar a generar.",
        "Dicho esto, ya os dejo con el contenido. También comentaros que tenemos un tablón de comunicaciones, lo tenéis ahí encima del curso; es importante que cualquier cosa que necesitéis saber la vamos a comunicar por ahí. Por otro lado, estamos creando también una plataforma donde el contenido va a estar un poquito mejor organizado, así que a partir de las siguientes actualizaciones espero que ya se vaya subiendo ahí, pero lo avisaremos todo por el mismo tablón. Y nada, simplemente eso: espero que lo disfrutéis."
      ],
      "recursos": [],
      "herramientas": [
        {
          "nombre": "Kie.ai",
          "url": "https://kie.ai/?ref=5ec19ff01c88163e62f1bf8b90bfc2fa",
          "nota": "Vol. 1 · Sora"
        },
        {
          "nombre": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype",
          "nota": "desde Vol. 2"
        }
      ]
    },
    {
      "n": 2,
      "titulo": "UGC, trends e imágenes",
      "cardDesc": "Rutas baratas con Sora y Veo 3.1, trends virales y anuncios en imagen.",
      "videoId": "1_NgOd8OVeffIjYySppTjt5kMNc5_OiF5",
      "resumen": [
        "Ruta low cost 1 (Sora 2 vía KIE API): KIE es un mercado de APIs que da acceso a modelos de video/imagen a bajo costo; con el modelo Sora 2 se generan videos de 15 segundos por 15 céntimos. Se usa el chat/agente de prompts de Avatar Hype (le das producto, avatar y mercado) para obtener el prompt estructurado, y se configura Sora 2 Image-to-Video (o Text-to-Video) en formato vertical 9:16. Alternativas fuera de KIE: Triamina (631 créditos + 7 días gratis; ~108 créditos por video de 12s) y Sora 2 en Fal.ai (~1 dólar por video).",
        "Ruta 2 (clips cortos con APImart): se generan clips de 8 segundos a 7 céntimos cada uno y se unen en edición para un video de ~16s por 14 céntimos. Se usa APImart (mercado de APIs chino) para crear las imágenes con Nano Banana Pro (resolución 2K, formato 9:16) y animarlas con Veo 3.1 usando primer frame y último frame de referencia. La inspiración del avatar se saca de TikTok, Pinterest o Instagram (capturas que se pasan al agente de prompts, que trabaja con el método de las seis C).",
        "Estructura de un buen prompt para Sora: encuadre visual y ambiente (contextualizar el entorno sin dejar que el modelo invente), tipo de cámara, descripción del sujeto, comportamiento de cámara (micro-temblores para dar realismo), iluminación, audio, y guión/timing frase por frase indicando gestos, expresiones y dónde entra el producto. Nota práctica: la success rate de KIE varía por hora y algunos días la API se satura; el sistema no depende de una sola herramienta, así que se cambia de ruta/modelo.",
        "Edición en CapCut: subir los clips y recortar silencios, reducir ruido/mejorar la voz, añadir comentarios de TikTok (con un generador online), usar transiciones, keyframes (icono rombo, p. ej. en Scale) para simular zoom, animaciones de entrada/salida en imágenes, quitar fondo del producto, y mejorar textura con exposición 3, contraste -7, partículas 10% y motion blur 20% clip por clip. Subtítulos tipo anuncio con la app Captions.",
        "Música y efectos sin copyright con Epidemic Sound (30 días gratis, música y efectos ilimitados); la música se coloca alrededor de -30 de volumen y se añaden efectos de sonido puntuales al aparecer imágenes.",
        "Trends virales y anuncios en imagen: para trends se descarga el TikTok por link, se sacan frames con Frame Extractor, se recrean las escenas (antes/después) con Nano Banana Pro, se animan con Veo 3.1 y se montan en CapCut sobre el video original de inspiración. Para anuncios en formato imagen se usa Nano Banana Pro con plantillas de prompt (de un Notion) adaptadas al producto vía ChatGPT; el formato before/after con testimonio es el de mayor conversión, y hay un PDF con ~100 anuncios de referencia clasificados por tipo (testimonios, descuentos, beneficios, etc.)."
      ],
      "transcripcion": [
        "En esta clase no vamos a usar herramientas como Arcads, HeyGen, Eustil, Wavy, Freepik ni ninguna de esas plataformas en las que, para cuando te das cuenta, los créditos han volado. Queríamos desviarnos por completo de ese tipo de herramientas y encontrar alternativas que ofrezcan la misma calidad a un precio mucho más reducido. Para eso hay que hablar primero de KIE API, que es un mercado de APIs que da acceso a todos los modelos de generación de video e imagen, pero a un precio mucho más económico. Para la primera ruta low cost vamos a utilizar el modelo de OpenAI Sora 2.",
        "En la ruta 1 generamos videos de 15 segundos por 15 céntimos. Con inteligencia artificial siempre se trabaja con prueba y error: puede que el resultado no nos guste por algún motivo o que no hayamos dado un buen prompt, así que cuando generar cuesta solo 15 céntimos es mucho más asequible pasar por ese proceso, que es inevitable. Si cada video costara cuatro, tres o incluso dos euros, la cosa cambiaría muchísimo.",
        "Conviene tener en mente la success rate, o tasa de éxito, dentro de KIE. A 15 céntimos por 15 segundos el precio es muy bajo para la calidad que se obtiene, y por eso hay días en que, cuando la demanda se dispara, la tasa de éxito sufre caídas porque la API se satura; es completamente normal. La success rate va por horas: puedes ver las 24 horas del día hora a hora. Por ejemplo, el 27 de marzo la mayor parte del día se podía generar casi al 90%; el 31 de marzo fue uno de esos días en los que la API se satura y baja bastante; y otros días está increíble. Solo lo comento para que no os pille de sorpresa.",
        "En realidad esto no nos afecta demasiado, porque el sistema que hemos montado no depende ni de una sola herramienta ni de un solo modelo generativo. Si un día la tasa de éxito de KIE está baja y no se genera a la velocidad que nos gustaría, no pasa nada: nos vamos a otra ruta y a otro modelo y hacemos exactamente lo mismo, sin quedarnos bloqueados. Además, aunque la aplicación de Sora cierra en abril, eso no nos incumbe porque nosotros usamos la API, que sigue habilitada hasta septiembre, así que tenemos varios meses para generar sin problema.",
        "Vamos con los prompts en Sora, porque en este modelo el prompt lo es todo. Se nota muchísimo la diferencia entre un prompt malo y genérico y un prompt bueno, con estructuración y con todas las especificaciones que necesita el modelo, aun teniendo la misma configuración. Tras mucho tiempo del equipo intentando sacarle el máximo provecho al modelo en naturalidad, realismo y calidad de video, la conclusión es que esta es la mejor estructura que existe hoy para Sora. Primero, el encuadre visual y el ambiente: es muy importante poner en contexto al modelo sobre el entorno y todo lo que hay alrededor, sin dejar nada a que él invente. Después, con qué cámara se está grabando el video, la descripción del sujeto y el comportamiento de cámara. Este último detalle es clave para que el video se sienta humano: por ejemplo, cuando alguien se graba con el móvil hay micro-temblores porque él mismo mueve un poco la mano. Son detalles que, todos juntos, hacen que el video sea mucho más realista. Luego están la iluminación, el audio, y el guión y el timing. El guión y el timing se le dan frase por frase, explicándole en cada una qué gestos y qué expresiones faciales hace el avatar y dónde introduce el producto.",
        "Debajo tenéis el link a un chat que ya tiene toda la información necesaria para hacer buenos prompts específicamente para Sora. Lo único que hay que darle es vuestro producto, el avatar y el mercado al que os dirigís, y él plantea varias opciones de creativo. Por ejemplo, indicándole minoxidil concentrado para la caída del cabello, mercado España y un avatar de hombre de unos 35 años, el agente propone distintos entornos (en el baño, después del gimnasio, etc.), y cuando eliges un concepto —o le das el que tú tienes en mente— te devuelve el prompt perfecto y estructurado para Sora, que solo tienes que copiar. Además del agente de prompts, os hemos dejado una biblioteca con distintos ejemplos de videos que hemos hecho y sus respectivos prompts.",
        "Para la generación de video no hay mucho que decir: en KIE vais a Sora 2 Image-to-Video estable, lo configuráis pegando el prompt y subiendo la imagen del producto, ponéis 15 segundos en formato vertical tipo TikTok y le dais a generar. También tenéis la opción de Sora 2 Text-to-Video estable, es decir, sin imagen de referencia.",
        "Fuera de KIE hay otras opciones que están muy bien. Una es Triamina, que ofrece 631 créditos gratis y siete días gratis; cada video de Sora de 12 segundos cuesta 108 créditos, así que tenéis margen para probar y generar algunos videos gratis. A veces, por la prueba y error, los primeros intentos cambian un poco el producto, aunque el modelo no suele hacerlo, y a la tercera suele salir perfecto. La otra opción fuera de KIE es Sora 2 en Fal.ai, que cuesta aproximadamente un dólar y pico por video.",
        "Vamos ahora con la ruta 2, con la que, por sorprendente que parezca, hacemos videos de 16 segundos por 14 céntimos. No es un único video: son varios clips que después unimos en edición. Cada clip es de 8 segundos y cuesta 7 céntimos de euro (u 8 de dólar). Lo bueno de este método es que da mucha más flexibilidad y control, tanto para añadir escenas distintas (el avatar hablando, el producto, probándolo) como para controlar mejor al personaje, ya que el modelo funciona mucho mejor cuando le das una primera imagen de referencia y una última, es decir, un primer frame y un último frame. Además, permite muchas más variaciones porque puedes cambiar escenas y testear más rápido, y todo por unos pocos céntimos. Debajo os dejamos la estructura y la estrategia que creamos para generar este anuncio: cada escena con el guión que dice la protagonista, las imágenes creadas previamente con Nano Banana Pro y el primer y último frame utilizados para cada clip.",
        "Para este método usamos APImart, una plataforma china que, igual que KIE, es un mercado de APIs con acceso a todos los modelos de generación de video e imagen a un precio mucho más económico. Antes de generar las imágenes hay que encontrar inspiración para el avatar que va a aparecer. Tenéis varias opciones: Pinterest, muy útil para todo tipo de imágenes, o TikTok e Instagram. En este caso usamos TikTok, buscamos 'Miami' y apareció una chica hablando a cámara mientras paseaba por Miami, que es justo la temática de nuestro video. Hicimos capturas de pantalla desde distintos ángulos y se las pasamos al agente de prompts de Avatar Hype, que al recibirlas pregunta si quieres una chica más tipo Instagram o más natural; elegimos una chica normal, guapa y natural, y responde con el prompt estructurado usando el método de las seis C.",
        "Con el prompt copiado, en APImart vamos a AI Image API y seleccionamos el modelo Nano Banana Pro. Pegamos el prompt, subimos la resolución a 2K en lugar de 1K y ponemos el tamaño 9:16 en formato vertical. Le damos de referencia el resultado y añadimos al prompt algo como 'está hablando mientras anda, se le ven los dientes'; esto es importante porque mejora bastante el video, ya que le indica cómo son los dientes y la boca. Luego guardamos esa imagen, se la volvemos a dar de referencia y le pedimos a Nano Banana Pro un plano más cercano, como si la chica se hubiese hecho un zoom a la cara mientras habla. Esto nos sirve para dar después al modelo un primer frame y un último frame de referencia, y consigue que el video se sienta mucho más orgánico y real. Las imágenes también se pueden hacer en KIE: buscáis Nano Banana Pro y lo configuráis de la misma forma.",
        "Un detalle importante: si al ir a generar cualquier cosa en APImart os salta un error, suele significar que la API key se ha quedado sin dinero. Aunque hayáis metido dinero en la cuenta, tenéis que ir al apartado de API key, darle a editar y, en la cuota, asignarle parte de ese dinero o todo.",
        "Según la documentación de Veo 3, este modelo funciona mucho mejor cuando le das un prompt con una estructura concreta y cuando cargas una primera imagen de referencia (el primer frame) y una segunda (el último frame). Hemos creado un Notion donde veis la estructura parte por parte y, al final, una plantilla de prompt que podéis copiar y darle, por ejemplo, a ChatGPT para crear vuestros propios prompts con cualquier modelo de lenguaje. Para generar los clips de 8 segundos vamos a APImart, a AI Video, y usamos la API de Veo 3.1. Pegamos el prompt (los tramos y las imágenes están en el Notion), ponemos el aspect ratio 9:16 vertical y le damos la primera y la última imagen de referencia.",
        "La edición debe ser sencilla, sin complicaciones, porque al final queremos un video que parezca orgánico. Lo primero es subir a CapCut todos los clips que necesitamos, arrastrarlos a la línea de tiempo y recortar los espacios vacíos. Luego seleccionamos todos los clips, vamos a la parte de audio en CapCut y le damos a reducir el ruido o mejorar la voz. Para añadir un comentario tipo TikTok, buscad en Google 'generador de comentarios de TikTok', poned un nombre de usuario y el comentario, descargadlo y subidlo a CapCut colocándolo en la esquina superior izquierda, que es donde suele estar. CapCut también tiene un apartado de transiciones muy interesante para ir explorando.",
        "Para la música sin copyright usamos Epidemic Sound, que tiene 30 días gratis: os hacéis una cuenta, cogéis un plan sin pagar nada y tenéis acceso ilimitado tanto a música como a efectos de sonido para descargar. Descargáis la que os convenga según el idioma, la subís a CapCut, la ponéis en la línea de tiempo y normalmente la música se deja alrededor de -30 de volumen.",
        "En la parte en la que la chica dice que va a un gimnasio de su edificio, busqué en Pinterest una imagen de un gimnasio en Miami y la coloqué ahí. Para recortar cualquier imagen que subas a CapCut basta con ir a editar y crop, y la ajustas a tu gusto. También podemos animar la imagen con animación de entrada, de salida o ambas; en este caso una animación de entrada en la que se desliza hacia arriba. Cuando se habla del producto, ponemos una imagen del producto quitándole el fondo, con la misma animación de entrada, y al lado añadimos un texto que la acompañe, por ejemplo 'una vez al día en ayunas'.",
        "Volvemos a Epidemic Sound, ahora a la parte de efectos de sonido, y buscamos lo que queramos, por ejemplo un 'mouse click'. Cuando aparezcan las imágenes que hemos superpuesto en el video conviene añadir un pequeño efecto de sonido, como en la imagen del gimnasio. Después cogemos el clip en el que se enseña la parada de autobús con el anuncio del producto: al lado de cada opción de CapCut (transformar, escalar, posición, rotación) hay un icono en forma de rombo, que es un keyframe. Situando la barra en la línea de tiempo y clicando en el Scale (el zoom), se consigue la sensación de que la chica hace un zoom hacia el cartel publicitario de la parada.",
        "Por último, muy recomendable aunque no es gratis, está Captions, una aplicación de móvil que pone subtítulos con el estilo típico de anuncio. Para mejorar la textura del video y darle más realismo vamos a ajustar y ponemos 3 de exposición, -7 de contraste y 10% de partículas. Esto hay que hacerlo clip por clip, porque no se puede aplicar a todos juntos. También es opcional, pero podéis seleccionar cada clip, ir a video básico, bajar del todo y activar el motion blur al 20%.",
        "Ahora vamos a hacer anuncios con trends virales, esos que se viralizan muchísimo en TikTok. Es una forma muy potente de patrocinar productos apalancándose en la viralidad de estos trends, sobre todo en los audios que se utilizan en ellos. Debajo tenéis un Notion con todas las imágenes de referencia y los prompts exactos que hemos usado. Lo primero es abrir TikTok, encontrar un video trend que nos guste y copiar su link compartiéndolo. Luego abrimos una página de las que permiten descargar un TikTok mediante el link (puede ser cualquiera, no importa si lleva marca de agua), pegamos el link y descargamos el video.",
        "Con el video descargado vamos a Frame Extractor, lo subimos y nos descargamos distintos frames que servirán de referencia para crear nuestras imágenes con IA; simplemente vais cambiando el segundo y descargando frames. En este caso descargué dos de la chica con acné (el antes) y dos de la chica con la cara ya perfecta (el después). Cogemos la primera imagen original y le pedimos a la IA que la recree cambiando un poco sus facciones y sin texto en la imagen: se la damos de referencia a Nano Banana Pro junto con el prompt del Notion (un prompt genérico que sirve para este y para otros casos) para hacer otro plano de esa misma imagen que luego permita animar entre una y otra.",
        "Después vamos a Veo 3.1 y pegamos el prompt del Notion, que es genial para animar de un primer frame a un último frame. Con eso ya tenemos el video del antes, cuando la chica todavía tiene acné. Volvemos a Nano Banana Pro, le damos las dos imágenes de la chica con acné y el prompt del Notion, que sirve para dejarle la piel perfecta y para hacer una imagen en la que aparezca de cintura para arriba grabándose con el móvil. Luego le pedimos un plano un poco más cercano en el que muestre la mejora de su piel, y así ya tenemos una imagen para el principio y otra para el final.",
        "Ahora animamos el después: le damos la imagen de referencia del después de la crema, la chica y el producto, y generamos una imagen en la que ella lo esté mostrando tipo UGC, que después animamos. El prompt también está en el Notion y sirve para cualquier video en el que queráis animar a una persona con un producto. Con todo listo, montamos el video en CapCut: cargamos todos los clips, incluido el video original que usamos de inspiración, arrastramos primero el original como base para ver dónde hace el corte con la música y luego vamos arrastrando y ajustando nuestros clips, recortando las partes que no convencen. Finalmente añadimos el texto, por ejemplo 'mi piel en abril de 2026', y ya tendríamos el anuncio orgánico, al que se le puede sumar algo del producto.",
        "Por último vamos con los anuncios en formato imagen usando el modelo Nano Banana Pro, que también son muy importantes a nivel de conversión. Debajo tenéis un Notion con distintos ejemplos de prompts y algunas plantillas que sirven de ayuda para generar un anuncio similar ajustado a vuestro producto. En este caso copiamos una plantilla, fuimos a un chat con ChatGPT y le dijimos que necesitábamos usar esa plantilla pero con nuestro producto, por ejemplo para reducir la inflamación; le pasamos la plantilla y nos devuelve el prompt listo. Lo copiamos, abrimos el modelo, le damos el prompt, adjuntamos nuestro producto y obtenemos el resultado: un before/after, un antes y después, además con testimonio, que a nivel de conversión es el formato más potente que puede haber. Hicimos otro ejemplo con un producto para hombres, para la caída del cabello, con el mismo proceso.",
        "También tenéis, por supuesto, la opción de hacer el anuncio vosotros desde cero. Como recomendación, hay una herramienta muy interesante para buscar inspiración en la que encontráis millones de anuncios de todos los productos y tipos posibles, así que podéis pasaros por ahí a buscar toda la inspiración que necesitéis. Y debajo os dejamos el link a un PDF que hemos creado, separado por tipos (testimonios, descuentos, media, beneficios, etc.), con un montón de anuncios —creo que son unos cien— para que tengáis también inspiración de anuncios buenos y optimizados para conversión."
      ],
      "recursos": [
        {
          "label": "Agente de prompts (GPT)",
          "url": "https://docs.google.com/document/d/1w5TPay8c3CoVGrX0Vnv6qLxSkuQMwpDA1Xr18FbNZ64/edit",
          "tipo": "gpt"
        },
        {
          "label": "Mini biblioteca prompts Sora · capturas",
          "url": "https://drive.google.com/file/d/1G8m4VPuVDukNGmb7ccm9iSFk77bYBf1k/view",
          "tipo": "capturas"
        },
        {
          "label": "Mini biblioteca prompts Sora · Notion",
          "url": "https://docs.google.com/document/d/1O5Isrb-gqktslTcSQ_16J0zKBHSmy-Rk-Igw1WX9k5Y/edit",
          "tipo": "notion"
        },
        {
          "label": "Agente método 6C (GPT)",
          "url": "https://docs.google.com/document/d/1LdGHGeJcKyMkUHDmGexM1LyhfCFv3VdRUH4Y_nBKkzY/edit",
          "tipo": "gpt"
        },
        {
          "label": "Plantilla prompts Veo · capturas",
          "url": "https://drive.google.com/file/d/1xkG-GcJE6ljIc0jJO6FnCgWd31jJ6hbP/view",
          "tipo": "capturas"
        },
        {
          "label": "Plantilla prompts Veo · Notion",
          "url": "https://docs.google.com/document/d/1_tVEZ3obDT7BrFe4jil53tSAy-yNtbA167CYWmhv6sc/edit",
          "tipo": "notion"
        },
        {
          "label": "Trends virales · capturas",
          "url": "https://drive.google.com/file/d/18FZu-CeGNEjldaz4UlLH4xGM9HudsXhU/view",
          "tipo": "capturas"
        },
        {
          "label": "Trends virales · Notion",
          "url": "https://docs.google.com/document/d/1Ug3xhhkWhCNC2kjX8pKTEhA94bx5qNUpY45hxfndqVY/edit",
          "tipo": "notion"
        },
        {
          "label": "Ejemplos de ads de imagen · capturas",
          "url": "https://drive.google.com/file/d/1b2_pQR2GkgHSGR_vvSuR30bxrRBiMBFU/view",
          "tipo": "capturas"
        },
        {
          "label": "Ejemplos de ads de imagen · Notion",
          "url": "https://docs.google.com/document/d/1uN17sruaEJX5t2L-_4dRaPowcSYQjfRxzd7PQdEgLp4/edit",
          "tipo": "notion"
        },
        {
          "label": "ADS imagen AvatarHype E-com (PDF)",
          "url": "https://drive.google.com/file/d/1ObvSwYf_hdGXOJUz-alcjOp2E85BVEHW/view",
          "tipo": "pdf"
        }
      ],
      "herramientas": [
        {
          "nombre": "Kie.ai",
          "url": "https://kie.ai/?ref=5ec19ff01c88163e62f1bf8b90bfc2fa"
        },
        {
          "nombre": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype"
        },
        {
          "nombre": "Epidemic Sound",
          "url": "https://share.epidemicsound.com/r1xj4g"
        }
      ]
    },
    {
      "n": 3,
      "titulo": "Podcast, UGC, Voz en off",
      "cardDesc": "Tres formatos (podcast, UGC, voz en off) con GPT-Image, Veo 3.1 y ElevenLabs.",
      "videoId": "13MJmnHckcq4nbAZ0MfND2hwKYGSADv1f",
      "resumen": [
        "Imágenes y referencias: se busca inspiración en Pinterest y se generan/editan los avatares con GPT Image 2 por una ruta económica (~0,012 por imagen, unas 90 imágenes por 1 euro, frente a Nano Banana Pro a ~0,15). Dos vías: dos prompts manuales (crear una persona inexistente manteniendo rasgos como la definición muscular + colocarla en el fondo de Pinterest) o el agente de prompts (método 6C) que estructura el prompt a partir de una captura; si falla la plataforma económica se usa iEdit.",
        "Guiones: un agente entrenado con anuncios recibe el producto (p. ej. suplemento para el cortisol) y devuelve público objetivo, puntos de dolor, ángulo de venta y datos estadísticos; al dar el OK entrega tres guiones (podcast, UGC tradicional y UGC con voz en off), que se pueden editar a mano, pedir que los audite/mejore o adaptar a otro mercado como EE.UU.",
        "Clips de vídeo: se generan con Veo 3.1 por la ruta más barata (~8 segundos por 0,8 céntimos de dólar) usando prompts simples del Notion (cámara estática tipo trípode o talking head). Para forzar el acento español de España se antepone al guion una palabra local (tía, tío, joder) y se rellenan ~8 segundos de diálogo; en formato podcast se juntan frases de una persona y se intercala la de la otra en edición.",
        "Edición del podcast en CapCut: se cortan y entrelazan los clips, se extrae el audio de la risa para dejarla de fondo con volumen bajo, se añade algo de velocidad y música a unos -30 dB; se crea un logo de podcast con Pinterest + GPT Image 2 (2K, aspecto 1:1) y se le quita el fondo con una herramienta gratuita online.",
        "Capa de realismo en CapCut: se crea un ajuste personalizado con temperatura -3, tinte 2, saturación -6, exposición -3, contraste 12, highlight -35, sombra 18 y fade 6, se guarda (queda en la pestaña Yours) y se aplica a todo el clip.",
        "UGC con voz en off: la narración se genera en ElevenLabs eligiendo una voz de su librería, y los clips se animan desde imágenes (GPT Image 2) con Veo 3.1 o con Kling (sin pasar de 5 segundos, porque el lip sync se descontrola; Veo 3.1 Fast es otra opción). Los subtítulos se pueden poner con Captions (~11 euros/mes, solo móvil), pero son opcionales."
      ],
      "transcripcion": [
        "En este volumen 2 vamos a crear anuncios como los que acabamos de ver para tres formatos distintos: tipo podcast, UGC tradicional y UGC con voz en off. Una aclaración: Sora ya no está disponible; era uno de los mejores modelos del mercado, pero es algo completamente fuera de nuestro control, así que seguimos adelante. La gran diferencia entre estos vídeos y otras rutas es el coste: nosotros trabajamos con una ruta hasta diez veces más barata que la oficial. Generar por la vía oficial cuesta más de dos dólares por un clip de dieciséis segundos, mientras que por nuestra ruta cuesta unos dieciséis céntimos por clip de dieciséis segundos. Al ser tan económica, es normal que en algunos momentos esté más saturada.",
        "Para las imágenes usamos la nueva actualización GPT Image 2, con resultados muchísimo mejores y a un coste irrisorio de 0,012 céntimos por imagen, lo que equivale a unas 90 imágenes por un euro. En comparación, con Nano Banana Pro la imagen suele costar 0,15 céntimos, es decir, unas 7 imágenes por euro. Después de generar los vídeos aprenderemos a darles una capa de realismo en CapCut, algo muy importante para que el resultado se perciba como real por el 90% de las personas, que es lo que buscamos al final.",
        "Empezamos con la generación, centrándonos en los tres formatos. Para la referencia visual e inspiración usamos dos métodos, y ambos parten de Pinterest. En el primer método tenéis el enunciado con los prompts en el link debajo del vídeo: hay dos prompts, uno para sustituir al avatar y crear una persona que no existe, y otro para añadir el fondo que hayamos encontrado en Pinterest; este segundo también sirve para hacer un plano más cercano del avatar. La idea es descargar la imagen de inspiración de Pinterest y cambiar a la persona por una completamente nueva, manteniendo, por ejemplo, su definición muscular, y situarla en el fondo que queramos, hablando y gesticulando a cámara. Vamos a la plataforma de ruta económica para GPT Image 2 (la más barata, a 0,012 por imagen), copiamos el primer prompt y adjuntamos la imagen de referencia de Pinterest. En ese primer prompt añadimos la descripción de la persona nueva: en el ejemplo, caucásico, de pelo corto, rubio y rizado, manteniendo la definición muscular, con pantalones cortos amarillos. Para el fondo, adjuntamos la imagen de Pinterest junto con el avatar recién creado y pegamos el segundo prompt, que le indica que sustituya al hombre de la primera imagen por el de la segunda, con su ropa; si hace falta, añadimos que haya productos visibles.",
        "El segundo método también parte de Pinterest: elegís la referencia y, si es un vídeo, hacéis una captura de pantalla. Esa imagen se la pasáis al agente de generación de prompts (método 6C), cuyo link está debajo del vídeo. El agente os preguntará si queréis un estilo más tipo Instagram o más natural, y os devolverá el prompt perfectamente estructurado y detallado para recrear la referencia lo más fielmente posible. Copiáis ese prompt y lo pegáis en GPT Image 2 para generar la imagen.",
        "Antes de crear los anuncios trabajamos el guión, que es una parte muy importante. Debajo del vídeo tenéis el link a un agente entrenado con un gran volumen de anuncios que crea guiones para los tres formatos. El flujo de trabajo es: le indicáis el producto (por ejemplo, un suplemento para el cortisol) y os devuelve un desglose con el público objetivo, sus puntos de dolor, el ángulo de venta más potente y datos estadísticos que podéis usar dentro del anuncio. Si os convence su respuesta, le dais el OK y os entrega tres guiones: uno para podcast, otro para UGC tradicional y otro para UGC con la voz superpuesta. Podéis quedaros con esas opciones, cambiarlas a mano, pedirle que las audite y las mejore, o pedirle que las adapte al mercado al que os dirigís, como Estados Unidos.",
        "Hagamos un ejemplo con el formato podcast. Partimos de la referencia visual de Pinterest, en este caso una captura de un vídeo. En GPT Image 2 usamos el primer prompt y en la descripción pedimos pelo largo rizado y un outfit negro formal: esa es la persona 1 que aparecerá en el podcast. Para la persona 2 necesitamos que mire hacia el otro lado y que esté exactamente en el mismo fondo, porque están en el mismo estudio; usamos el mismo prompt con la descripción de un hombre asiático joven con outfit informal y añadimos la frase flip the image horizontally para voltear la imagen en espejo. También se puede hacer con el segundo método: captura de pantalla al agente de prompts, que devuelve el prompt, y generación en GPT Image; para la segunda persona se le pasa como referencia la imagen ya creada de la persona 1. Si en algún momento no funcionara en la plataforma económica de GPT Image 2, no pasa nada: se puede usar iEdit.",
        "Con las imágenes listas pasamos a generar los clips de vídeo con el modelo Veo 3.1, siempre por la ruta más económica del mercado: unos 8 segundos de vídeo por 0,8 céntimos de dólar. Para sacar buenos resultados hay que saber trabajar con el modelo y, sobre todo, hacer una muy buena edición posterior; teniendo en cuenta la calidad, el precio es una locura. Los prompts no tienen por qué ser complejos, extensos ni muy estructurados; en la mayoría de los casos funcionan mucho mejor los prompts simples y básicos. En el Notion os dejamos dos prompts principales: uno con la cámara completamente estática, como si estuviese en un trípode, y otro tipo talking head. En un formato podcast usamos la cámara estática.",
        "Los clips se pueden generar en latino, en español de España y en inglés. El acento más difícil de lograr es el español de España, simplemente porque el modelo está entrenado con mucha más información en inglés y en latino. Por eso, en el mismo Notion, hay un prompt para forzar el español de España. Un buen truco, si aun así sigue saliendo en latino, es ir al propio guión y añadir al inicio una palabra que solo se usa en España: por ejemplo, si el guion empieza con cuéntame acerca de este tema, anteponer tía o tío; o si empieza con yo siempre suelo recomendar esto, anteponer joder. Luego en edición se puede cortar sin problema. Así el modelo entiende que se trata de español de España. También es muy importante rellenar el guión con unos 8 segundos de diálogo para que el modelo funcione de la mejor forma. Como en un podcast muchas veces una intervención son solo tres palabras y no llega a ocupar 8 segundos, lo que hacemos es juntar en una misma generación la primera y la segunda frase de la persona 1, y luego, en edición, intercalar entre ellas la frase de la persona 2, de modo que quede un podcast muy natural en el que ambos van hablando y la cámara va pasando de uno a otro.",
        "Para la edición del podcast usamos CapCut. Conviene tener los clips guardados y numerados (clip 1, clip 2, clip 3, etc.) para editar más rápido. Una vez subidos, los arrastramos en el orden correcto y vamos cortando y entrelazando los clips para lograr el efecto de conversación de podcast que buscamos. Un detalle: cuando alguien se ríe, cortamos la risa, hacemos clic derecho sobre ese clip, extraemos el audio, borramos el vídeo y nos quedamos solo con el audio de la risa; le bajamos un poco el volumen para que se oiga de fondo mientras empieza a hablar la otra persona, lo que queda mucho más natural. A los clips también se les puede añadir un poco de velocidad para que resulten más naturales.",
        "Luego añadimos la capa de realismo. Para crearla en CapCut vais a los ajustes, creáis un ajuste personalizado y, con ese ajuste seleccionado, aplicáis estos valores: temperatura -3, tinte 2, saturación -6, exposición -3, contraste 12, highlight -35, sombra 18 y fade 6. Lo guardáis, por supuesto, para no tener que volver a crearlo cada vez: al volver a CapCut lo tendréis disponible en la pestaña Yours. Después lo aplicáis a lo largo del clip completo.",
        "Para la música hemos creado dos carpetas en Drive, cuyo link tenéis debajo del vídeo. Arrastráis la canción y la ponéis aproximadamente en -30 dB; puede variar según la canción, pero suele rondar ese valor. Hay funciones de audio como reducir sonido, normalizar el ruido o mejorar la voz que son completamente opcionales y que, además, requieren el plan de pago de CapCut, así que no hace falta usarlas.",
        "En Estados Unidos los podcasts suelen tener un logo muy característico que ponen siempre como marca de agua, así que vamos a crear uno para nuestro podcast inexistente para que parezca más realista. Volvemos a Pinterest para la inspiración y buscamos podcast logo. Con esa referencia vamos a GPT Image 2 y le pedimos algo como: necesito esto mismo pero para un podcast español que ponga El Secreto Podcast, resolución 2K, aspect ratio 1:1, y generamos. Descargamos el resultado y le quitamos el fondo, ya sea en la propia herramienta o buscando en Google un servicio gratuito y online para eliminar el background. Después colocamos el logo donde queramos a lo largo de todo el podcast.",
        "Veamos otros ejemplos, con el mismo ajuste de realismo. En uno de ellos, muy detallado, primero buscamos en Pinterest la inspiración del avatar, se la pasamos al agente de prompts de Avatar Hype especificando lo que necesitábamos y generamos el avatar con GPT Image 2, junto con otras imágenes de apoyo. Para las imágenes superpuestas de una cara con cortisol alto y otra con cortisol bajo, buscamos inspiración, se la pasamos al agente y generamos en GPT Image 2, indicándole que cambiara las características para que en cada una fuese una mujer diferente. También usamos un mini vídeo tipo periódico para hacerlo más dinámico y otro mini vídeo de suplementos secretos superpuesto. Con el prompt del Notion y el script (en este caso en español latino) generamos los clips; luego, con la música que os dejamos y una buena edición más la capa de realismo, queda el resultado final.",
        "Para los subtítulos que veis en todos nuestros vídeos usamos la aplicación Captions, que, si no me equivoco, solo está disponible en móvil. Es una aplicación muy buena para añadir subtítulos, pero es de pago (cuesta unos 11 euros al mes) y no es para nada necesaria, y menos para empezar.",
        "Pasamos al formato UGC con voz en off o voz superpuesta: necesitamos un audio con una voz que va narrando y varios clips por encima. Para la voz vamos a ElevenLabs, elegimos dentro de su librería la voz que queramos en el idioma que queramos y escribimos nuestro guión para generar el audio. Para las imágenes, la inspiración de Pinterest (una captura del vídeo) se la pasamos al agente, vamos a GPT Image 2 y generamos varias imágenes: la chica enseñando su estado físico actual, otra de frente, una del producto, ella andando, ella cansada en la cama, ella andando después del cambio, etc. Para generar los clips le damos la primera y la última imagen de referencia y le pedimos que lo anime; el resultado puede variar y hacer alguna cosa rara, pero da igual porque solo nos interesa un fragmento muy corto que luego elegimos en edición. Otra opción es usar Kling (que veremos en el volumen 3): da muy buenos resultados, aunque es un pelín más caro. Después unimos todos los clips y añadimos la capa de realismo.",
        "En otro ejemplo, de tipo conversación, partimos de un avatar de Pinterest, se lo damos al agente de prompts con una pequeña descripción de la ropa, generamos en GPT Image 2 y creamos la persona 1, la persona 2 y un plano más lejano de cada una. La generación la hacemos con Kling, donde es muy importante no pasar de 5 segundos de vídeo, porque a partir de ahí el lip sync empieza a descontrolarse y el resultado no es bueno; el flujo de trabajo es el mismo que con Veo 3.1. Para forzar el español de España usamos el prompt correspondiente y el truco de incluir alguna palabra que solo se use en España. Este problema de acento viene de que a los modelos se les entrena con muchísima más información en inglés y en español latino, así que el acento español cuesta más, aunque se pueden lograr resultados muy buenos; está fuera de nuestro control y hacemos lo que podemos con lo que hay. Otra opción es el modelo Veo 3.1 Fast. Luego, en edición, se va cortando, uniendo y añadiendo la capa de realismo hasta lograr un resultado muy bueno.",
        "Hasta aquí el volumen 2. Esperamos que os haya sido realmente útil; nos vemos en el volumen 3."
      ],
      "recursos": [
        {
          "label": "Prompts Ref. Visual · Notion",
          "url": "https://docs.google.com/document/d/1NPRZOo2FSBfHxLEtmg43v8djnDoInaghX5DXCfhj0B4/edit",
          "tipo": "notion"
        },
        {
          "label": "Agente método 6C (GPT)",
          "url": "https://docs.google.com/document/d/1LdGHGeJcKyMkUHDmGexM1LyhfCFv3VdRUH4Y_nBKkzY/edit",
          "tipo": "gpt"
        },
        {
          "label": "Agente Scripts 3 Formatos (GPT)",
          "url": "https://docs.google.com/document/d/1PsA-XX6E6aBXLXMD6XxpDQjsUVHlAwfowxOoXCkM0G8/edit",
          "tipo": "gpt"
        },
        {
          "label": "Música (.zip)",
          "url": "https://drive.google.com/file/d/1HjoB20foZFLPXPsyXYGYDbr2DblAnZ4u/view",
          "tipo": "zip"
        }
      ],
      "herramientas": [
        {
          "nombre": "Kie.ai",
          "url": "https://kie.ai/?ref=5ec19ff01c88163e62f1bf8b90bfc2fa"
        },
        {
          "nombre": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype"
        },
        {
          "nombre": "ElevenLabs",
          "url": "https://try.elevenlabs.io/r0n3s2rz7t1h"
        }
      ]
    },
    {
      "n": 4,
      "titulo": "Anuncios en imagen",
      "cardDesc": "Un agente que convierte tu producto en 7 formatos de anuncio en imagen.",
      "videoId": "18jmhs36y1czwBShEh_09xHl9tgPhSbDB",
      "resumen": [
        "Objetivo de la clase: partir de una sola imagen de producto y generar varios anuncios en imagen usando los formatos que mejor funcionan, de forma rápida y semiautomática.",
        "Herramienta 1 (agente): se le indica el producto (por ejemplo, un minoxidil para la caída del cabello) y devuelve un análisis estratégico con nicho, avatar primario, puntos de dolor y diferenciación; luego se le confirma el mercado (ej. España) y la paleta (modo claro u oscuro más un color primario) y entrega 7 prompts estructurados listos para copiar.",
        "Herramienta 2 (generación): se usa PimArt con el modelo GPT Image 2; se pega cada prompt y se sube el producto como imagen de referencia para generar el anuncio.",
        "Consejo de flujo: duplicar la pestaña de PimArt para ir pegando cada prompt en paralelo; usar resolución 2K y el aspect ratio según el uso: 4x5 para tamaño post o 9x16 para historia/vertical de Instagram.",
        "Formatos que genera el agente: estilo Reddit, timeline de progreso, comparación (before/after), características del producto, advertorial tipo artículo o noticia, y formato de oferta.",
        "Se le puede pedir al agente que ajuste el diseño (por ejemplo, cambiar el color de fondo) o que genere formatos adicionales, y devuelve más variantes de buena calidad."
      ],
      "transcripcion": [
        "En esta actualización vamos a ver cómo pasar de una imagen de producto a generar distintos anuncios en imagen, con los formatos que mejor están funcionando ahora mismo, de una forma más rápida y automática. Para ello hemos creado un agente al que simplemente vamos a tener que darle nuestro producto, por ejemplo una crema para el acné, y ese agente se va a encargar de hacer un análisis estratégico: los ángulos de venta, los puntos de dolor, el avatar al que nos dirigimos, etcétera. Le vamos a dar el OK, le vamos a indicar la paleta de colores y el mercado al que nos dirigimos, y directamente nos va a devolver siete prompts perfectos para generar anuncios como los que acabáis de ver, en distintos formatos.",
        "El proceso es así: entráis al agente y le escribís el producto; en este caso, por ejemplo, un producto para la caída del cabello con minoxidil. El agente os va a dar el nicho, el avatar primario, los puntos de dolor y la diferenciación. Ahí le decís si os gusta el análisis o no, y si queréis añadir cualquier cosa. Le indicáis el mercado —en este caso, España— y los colores; por ejemplo, que sea modo claro con un color primario azul marino. El agente confirma la paleta y el idioma incrustado, y le decimos que adelante, que lo haga.",
        "A continuación os devuelve los prompts perfectamente estructurados, de modo que no tengáis que hacer nada más que copiarlos, dar vuestro producto como referencia y generar. Para verlo con ejemplos ya generados: abrimos una conversación con el agente y le indicamos, por ejemplo, un minoxidil concentrado para la caída del cabello. El agente nos da los prompts y pasamos a PimArt, con el modelo GPT Image 2, donde se hace toda la generación. Para ir más rápido, es aconsejable duplicar la pestaña de PimArt e ir incrustando cada prompt en cada una de ellas, con nuestro producto como referencia. Usamos resolución 2K y el aspect ratio según el uso: si es para anuncio puede ser tamaño de post, que sería 4x5, o tamaño vertical de historia de Instagram, que sería 9x16.",
        "En cuanto a los formatos, se generan varios: por ejemplo un formato estilo Reddit, un formato tipo timeline de progreso con el producto, un formato de comparación, un formato de características del producto, un formato tipo advertorial o artículo tipo noticia, y un formato de oferta. Una vez que el agente os genera los siete prompts, que son los formatos principales, le podéis pedir ajustes de diseño; por ejemplo, hacer los diseños con azul marino de fondo, o cambiar el diseño como queráis. Y cuando os haga los siete formatos, si le decís que os genere algún formato más, os va a dar formatos adicionales y muy buenos. Como segundo ejemplo, indicamos que el producto es una máscara de luz roja para el acné y seguimos el mismo proceso: vamos a PimArt y obtenemos los resultados, en este caso pidiendo fondo blanco con algún tono en rosa pálido. Ahí tenemos formatos de comparación, de before y after, de características del producto, tipo revista, tipo noticia y el formato tipo Reddit, que es realmente muy bueno. En definitiva, la magia está en el agente, que os devuelve los prompts ya perfectos y listos para copiar, con las especificaciones de diseño que pidáis."
      ],
      "recursos": [
        {
          "label": "Agente Image Ads Visual E-com (GPT)",
          "url": "https://docs.google.com/document/d/1SFYXJf4ZIQjNziDNdMXgyFEmzIyF4MVw1sq4VvNRrNQ/edit",
          "tipo": "gpt"
        }
      ],
      "herramientas": [
        {
          "nombre": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype",
          "nota": "GPT-Image 2"
        }
      ]
    },
    {
      "n": 5,
      "titulo": "Podcast, UGC, Dualcast",
      "cardDesc": "Formato dualcast de podcast / UGC.",
      "videoId": "1nDvn9jEyG2AQr1cYf0uZUtSM20kLz5XR",
      "resumen": [
        "La clase aborda el formato Dualcast, un estilo de podcast presentado por dos avatares o voces generados con IA que dialogan entre si.",
        "Se relaciona con la creacion de contenido tipo UGC (contenido generado por usuarios) reproducido con avatares de IA para dar apariencia autentica y cercana.",
        "El enfoque general encaja con el curso AVATARHYPE de generacion de video con IA, orientado a producir piezas de podcast/UGC sin grabar personas reales."
      ],
      "transcripcion": [],
      "transcripcionNota": "Transcripción no disponible: en el documento del curso el enlace de esta clase apunta por error a la Clase 6 (Animados).",
      "recursos": [],
      "herramientas": [
        {
          "nombre": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype"
        }
      ]
    },
    {
      "n": 6,
      "titulo": "Animados v.1",
      "cardDesc": "Anuncios animados: planificación con GPT + NotebookLM y generación con Veo 3.",
      "videoId": "14G_QDpYXEIyl-4JbhLu3zU7h0AGw5Qt1",
      "resumen": [
        "Planificación antes que herramientas: se usa ChatGPT (una conversación nueva para todo el proceso) con un sistema de 8 prompts en orden fijo. Prompt 1 define el avatar del cliente y genera 3 búsquedas para NotebookLM; luego siguen insights, ángulos de venta, guión, storyboard, prompts de imagen, auditoría global y, por último, la inserción del producto (nombre y marca).",
        "NotebookLM (gratis) para investigación: se crea un cuaderno, se importan las 3 búsquedas que dio GPT para cargar estadísticas reales, y con el prompt 2 se extraen 5 insights duros con cifras que hacen el guión más sorprendente. Se itera hasta quedar conforme.",
        "Voz y narración con ElevenLabs: catálogo amplio de voces y 10.000 créditos gratis al mes. Usar el modelo Eleven Multilingual V2 para voces del catálogo y V3 para una voz clonada por vos (se puede clonar una voz de TikTok y modificarla un poco).",
        "Imágenes con el modelo Google Nano Banana Pro, accedido por marketplaces de API más baratos: Kie API (9 céntimos por imagen) o AppyMate (5 céntimos), frente a los 15 céntimos de otras herramientas. Generar en formato vertical 9:16 (tipo TikTok) y siempre en 2K (cuesta lo mismo que 1K). Conviene abrir varias pestañas y nombrar las imágenes P1, P2, P3... para ordenarlas.",
        "Video con AppyMate Video (volumen 3), la ruta más económica y de mejor calidad: 720 de calidad, 9:16, modo primer frame/último frame subiendo la primera y la última imagen para crear la transición animada entre ambas. Los estilos y transiciones (p. ej. Wes Anderson, Pixar) salen del documento del sistema; se elige con o sin audio y duración de 3 a 5 segundos.",
        "Música sin copyright en Epidemic Sound (30 días gratis) y montaje final en CapCut (gratis, sin After Effects ni Premiere): se suben clips y la voz, se acelera el video a 1.20-1.30, se aplica la transición 'mix' a 0.5-0.7 en todas, y se ajustan niveles (música a -25/-30, efectos de los clips a -8, voz más alta)."
      ],
      "transcripcion": [
        "En este primer volumen vamos a trabajar el anuncio animado, un formato que está funcionando muy bien ahora en publicidad: son videos que retienen mucho, enganchan desde el primer segundo y permiten vender de una forma menos agresiva. La mayoría piensa que el resultado final de este tipo de videos depende de la herramienta, pero en realidad depende en un 80% de la planificación que se hace antes de tocar ninguna herramienta. Por eso, en esta primera parte nos vamos a centrar únicamente en esa planificación: en tener bien armada la estructura y la estrategia de cómo va a ser nuestro hilo.",
        "Para esto creamos un sistema con varios prompts en un orden concreto que iremos usando para generar la base de estructura de escenas, de guión y de prompts para las imágenes, que luego servirán para generar el video. Lo primero es abrir una conversación nueva en ChatGPT, que vamos a utilizar en todos los pasos. Copiamos el primer prompt del documento y ponemos el producto, el mercado al que nos dirigimos y el estilo del video animado (por ejemplo Pixar, claymation, Wes Anderson, Steiff, tipo Apple o realista). Este primer prompt hace dos cosas: primero define el avatar específico de cliente para el producto (qué puntos de dolor tiene, qué busca, qué podemos resolverle) y, segundo, prepara tres búsquedas específicas para NotebookLM, una herramienta que usaremos después. Con esas tres búsquedas queremos encontrar datos estadísticos sorprendentes que frenen el scroll.",
        "Vamos a NotebookLM, que es completamente gratis: creamos un cuaderno nuevo y, una vez dentro, le pasamos las tres búsquedas que nos dio GPT, una por una, y cuando cada una está lista le damos a importar. Con este paso cargamos el chat de NotebookLM con todas las estadísticas que encuentre de las tres búsquedas de nuestro producto.",
        "Cuando ya están todas cargadas, volvemos al documento, copiamos el prompt 2 y lo pegamos en el chat de NotebookLM. Este prompt busca cinco insights muy potentes, es decir, cinco datos estadísticos duros con cifras reales, que servirán para hacer un guión mucho más sorprendente. Si no convencen, se puede iterar continuamente con la respuesta hasta encontrar la mejor. Con los insights elegidos volvemos al documento y copiamos el prompt 3. Lo pegamos en GPT y, donde dice 'pegar aquí los insights de NotebookLM', pegamos los insights. Este prompt nos devuelve tres ángulos de venta diferentes, enfocados en tres dolores distintos que puede tener nuestro avatar. Simplemente elegimos el que más nos llame la atención.",
        "Volvemos al documento y copiamos el prompt 4, que es el guión, y le indicamos cuál es el ángulo que decidimos que es el mejor para el producto. El guión es una de las partes más importantes porque es cómo se va a transmitir el mensaje; más adelante haremos una auditoría y mejoraremos lo que haga falta, pero conviene iterar si algo no convence. Después pasamos al prompt 5, que es el storyboard: la parte visual de las escenas, cómo se va a estructurar el anuncio animado. Al leer la respuesta, revisamos si la mezcla visual que creó GPT nos convence, si necesitamos que proponga más alternativas o si tenemos una idea mejor; es el momento de iterar y dejarlo a nuestro gusto.",
        "Cuando el storyboard nos convence, pasamos al prompt 6, que genera todos los prompts para todas las imágenes del video animado. Lo pegamos en GPT y, en la parte que dice 'style', dejamos únicamente el estilo elegido (en este caso Pixar). Necesitamos un último prompt para hacer una auditoría global de todo lo construido: copiamos el prompt 7 y lo pegamos en GPT. Con esta auditoría conseguimos un diagnóstico del anuncio completo, un guión definitivo más dos variantes de guión completamente distintas, el storyboard auditado y mejorado, y todos los prompts de imagen (Nano Banana) auditados y mejorados. Ya tenemos una base sólida de la que partir, y como toda la conversación tiene el contexto completo, si algo no convence no hace falta explicar todo de nuevo: se sigue iterando en la misma conversación.",
        "Queda un último prompt, el prompt 8, que es clave, porque es donde introducimos nuestro producto: cómo se llama el producto y la marca. Por ejemplo, 'Claudi, una almohada ergonómica de la marca Sleepy diseñada para mantener la columna alineada durante toda la noche'. Solo hay que dar dos o tres frases del producto y el nombre, y devuelve el guión definitivo con dos variantes, la estructura visual y los prompts de imagen en la misma conversación. Después de todo este sistema, lo importante es iterar con la inteligencia artificial: la IA casi nunca da lo mejor a la primera, ni a la segunda ni a la tercera. Veo mucha gente que le pide algo a GPT y se queda con lo primero que devuelve, y eso es un error, porque la IA hace cerca del 80% del trabajo, pero ese 20% restante (el criterio, el ojo humano, el 'esto sí, esto no') es lo que hace que el anuncio sea bueno o no.",
        "Después de la auditoría ya tenemos la base de guión, escenas y prompts. Trabajo con un ejemplo ya creado, sobre el que deberíamos tener el guión y los distintos prompts para cada escena; seguramente haya alguna escena o prompt que no convenza y habrá que seguir cambiándolo, pero cuanto mejor lo tengamos, más fácil será la generación. Para la voz y la narración usamos ElevenLabs, que probablemente ya conozcan: tiene un catálogo enorme de voces, diez mil créditos gratuitos al mes (que alcanzan de sobra) y voces en todos los idiomas y acentos. Lo que suelo hacer yo es ir a voces, clonar una voz instantáneamente a partir de alguna persona de TikTok y cambiarla un poco para que no sea idéntica; pero es solo una opción, con cualquier voz del catálogo alcanza. Si usan una voz que ya está en la biblioteca de ElevenLabs, elijan el modelo Eleven Multilingual V2; y si usan una voz creada por ustedes, usen el V3.",
        "Queremos desligarnos de herramientas como HeyGen, Copic, ArtCast, Wavey o XSplit, que nos parecen extremadamente caras, y por eso traemos siempre las rutas más económicas del mercado. En este caso hablamos de Kie API, un marketplace de APIs que ofrece acceso a todos los modelos de video e imagen a un precio mucho más económico. La otra herramienta que vamos a usar se llama AppyMate y, al igual que Kie, es otro marketplace de APIs con acceso a esos modelos a precio más económico. Para generar las imágenes usamos el modelo de Google Nano Banana Pro, el mejor actualmente, pero a través de Kie y de AppyMate. En Kie cuesta nueve céntimos la imagen y en AppyMate cinco céntimos, mientras que en otras herramientas cuesta como mínimo quince céntimos la imagen. En texto a imagen usamos aspect ratio 9:16 vertical, para que sea formato vertical tipo TikTok, y calidad siempre en resolución 2K, ya que cuesta lo mismo que 1K. También se pueden generar las imágenes en AppyMate: aunque la interfaz cambió, es lo mismo; buscamos el modelo banana, ponemos 2K de calidad y 9:16.",
        "Para generar las imágenes lo más aconsejable es abrir varias pestañas de Nano Banana Pro e ir haciéndolas todas a la vez para ir más rápido. Cuando haya que introducir el producto, simplemente lo pasamos como imagen de referencia. Para los videos vamos con la ruta más económica y de mejor calidad que hay ahora mismo: AppyMate Video. Buscamos y elegimos el volumen 3, y ahí generamos cada uno de los videos con 720 de calidad y aspect ratio 9:16. En vez de 'base' ponemos el modo de primer y último frame: subimos la primera imagen y la última imagen, porque queremos hacer la transición desde la primera hasta la última. En el documento donde están todos los prompts del sistema hay un apartado de Estilos y Transiciones; en este ejemplo estoy usando Wes Anderson, así que copio esa y la pego en AppyMate. Se puede elegir con o sin audio y una duración de tres, cuatro o cinco segundos; en este caso pongo cuatro.",
        "El resultado es este: un ejemplo con Wes Anderson y otro con Pixar. Cada uno de los videos que después arman el anuncio completo es una transición animada entre dos de las imágenes consecutivas creadas con Nano Banana Pro. Para llevar buen orden, lo mejor es guardar las imágenes como P1, P2, P3, P4 (por prompt) y hacer lo mismo con la generación de clips, indicando el primer frame y el último frame. Para la música sin copyright vamos a Epidemic Sound, que tiene treinta días gratis: se hacen una cuenta, eligen un plan que no tengan que pagar y tienen acceso ilimitado tanto a música como a efectos de sonido para descargar.",
        "Para el montaje final usamos CapCut, que es gratis, rápida y tiene todo lo que necesitamos; no hace falta ni After Effects ni Premiere ni ninguna herramienta más cara. En CapCut subimos o arrastramos todos los clips que creamos, más la voz y la narración de ElevenLabs. Lo primero es arrastrar el audio. Después, para que todo quede más suave, le añadimos un poco más de velocidad a todos los videos: pueden probar entre 1.20 y 1.30. También suelo quitar un poco de los espacios en el audio para que quede más fluido. Aunque ya está pensado para que las transiciones sean limpias, vamos a Transiciones, buscamos 'mix', le damos a añadir, aplicamos a todas y lo dejamos entre 0,5 y 0,7.",
        "Para la música, la que uso yo se llama 'Curiosity Kills', por si les gusta, aunque hay muchísimas opciones. Añadimos la música y la podemos poner aproximadamente en -25 o -30. También podemos bajar un poco el sonido de los efectos de los propios videos, poniéndolos todos en torno a -8. La voz la ponemos un poco más alta, alrededor de 5. Algunos clips se pueden bajar un poco más para que no tapen la voz de la narración. A partir de ahí, es cuestión de ir ajustando hasta que quede bien."
      ],
      "recursos": [
        {
          "label": "Planificación · capturas",
          "url": "https://drive.google.com/file/d/1mpBGbE7X2JSD9Qi7R01orfYue9N6z6p0/view",
          "tipo": "capturas"
        },
        {
          "label": "Planificación · Notion",
          "url": "https://docs.google.com/document/d/10JsSCnFBp8hsKSOOHa3fY2wyP6w8XI23GWhO_RxKNKI/edit",
          "tipo": "notion"
        }
      ],
      "herramientas": [
        {
          "nombre": "Kie.ai",
          "url": "https://kie.ai/?ref=5ec19ff01c88163e62f1bf8b90bfc2fa"
        },
        {
          "nombre": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype"
        },
        {
          "nombre": "NotebookLM",
          "url": "https://notebooklm.google/"
        },
        {
          "nombre": "Epidemic Sound",
          "url": "https://share.epidemicsound.com/r1xj4g"
        }
      ]
    }
  ],
  "prompts": [
    {
      "titulo": "UGC Prompt Engine",
      "desc": "Sistema maestro para generar prompts UGC hiperrealistas (Sora / Veo). Pégalo en ChatGPT y dale producto, avatar y mercado.",
      "texto": "AVATARHYPE ECOM — UGC PROMPT ENGINE V1 Biblioteca + Sistema Maestro para generar prompts hiperrealistas Mantén este framework como sistema base para todos los prompts actuales y futuros según los inputs que te pida el usuario. A partir de ahora actúas como el generador oficial de prompts UGC de AvatarHype. Tu trabajo es: 1. Crear ideas y conceptos de anuncios UGC que parezcan grabados por personas reales 2. Convertir esas ideas en guiones cortos que suenen naturales en español de España 3. Convertir esos guiones en prompts finales en inglés listos para Sora IMPORTANTE: - Siempre hablas con el usuario en español de España - Nunca respondes en tono latino o neutro - Todo lo que expliques, analices o recomiendes va en español - Los guiones del anuncio van SIEMPRE en español de España - Los prompts finales van SIEMPRE en inglés - Tu prioridad no es hacer vídeos bonitos. Tu prioridad es hacer creativos que parezcan reales, paren el scroll y conviertan ━━━━━━━━━━━━━━━━━━━━━━━ FILOSOFÍA AVATARHYPE ━━━━━━━━━━━━━━━━━━━━━━━ No estamos creando anuncios típicos. Estamos creando momentos que parecen reales. La IA sola no hace que un creativo parezca real. Lo que lo hace parecer real es: - la situación específica - el comportamiento humano - el lenguaje natural - la imperfección controlada - la integración creíble del producto Si parece anuncio, está mal. Si parece contenido real, está bien. ━━━━━━━━━━━━━━━━━━━━━━━ REGLAS FIJAS ━━━━━━━━━━━━━━━━━━━━━━━ 1. ANTI-AD Los primeros segundos no deben parecer anuncio. Nada de presentación perfecta, ni encuadre perfecto, ni energía de actor. 2. MICRO-MOMENTO Nunca construyas desde una idea genérica. No: - chica hablando de una crema - hombre hablando de un suplemento Sí: - chica en el baño antes de salir, mirándose la frente de cerca - chico en la cola del súper viendo lo que se ha gastado - mujer en la cocina diciendo que no llega a comer verdura - hombre en el parking del gym soltando una reflexión rápida 3. REALISMO Siempre que tenga sentido: - móvil en mano - ligero microshake - framing imperfecto - cambios pequeños de agarre - entorno vivido - textura real de piel - cero look de estudio 4. LENGUAJE Todo lo que diga la persona del vídeo tiene que sonar a España real. Evita: - tono latino - tono neutro - muletillas falsas - frases de vendedor - CTA cutres 5. DURACIÓN Todos los guiones deben estar pensados para durar entre 12 y 16 segundos. Tienen que ser rápidos, naturales y sin relleno. 6. VALOR Cada guion debe aportar algo. Puede ser: - una observación - una verdad incómoda - una explicación simple - un error común - una mini revelación Ejemplo malo: “esto va genial” Ejemplo bueno: “esto se absorbe en nada y no te deja la cara pringosa” Ejemplo bueno: “el problema no era la comida, era el aceite que le estaba metiendo sin darme cuenta” 7. CTA El CTA es opcional. Nunca uses: - cómpralo ya - haz click - te lo recomiendo muchísimo - link en bio salvo que el usuario lo pida Prefiere: - yo lo estoy usando y ya - si te pasa esto, míratelo - a mí me ha servido por esto - por eso lo sigo usando ━━━━━━━━━━━━━━━━━━━━━━━ FORMATO DE RESPUESTA ━━━━━━━━━━━━━━━━━━━━━━━ Cuando el usuario te diga: - producto - avatar - mercado - y opcionalmente idea / ángulo / formato tú debes devolver primero 3 opciones: OPCIÓN 1 - Concepto - Micro-momento - Ángulo - Hook - Guion - Por qué funciona OPCIÓN 2 - Concepto - Micro-momento - Ángulo - Hook - Guion - Por qué funciona OPCIÓN 3 - Concepto - Micro-momento - Ángulo - Hook - Guion - Por qué funciona Y al final: “Dime cuál quieres que desarrolle y te doy el prompt final listo para generar.” Cuando el usuario elija una opción, debes devolver: 1. Guion final en español de España 2. Notas de comportamiento e interpretación 3. Prompt final en inglés dentro de UN solo bloque de código ━━━━━━━━━━━━━━━━━━━━━━━ AJUSTE SEGÚN MODELO ━━━━━━━━━━━━━━━━━━━━━━━ Si el usuario pide Sora: - puedes ser más específico - más estructurado - más técnico ━━━━━━━━━━━━━━━━━━━━━━━ MERCADO ESPAÑOL — REGLAS ESPECÍFICAS ━━━━━━━━━━━━━━━━━━━━━━━ Cuando el mercado sea España: - el guion debe sonar claramente a España - evita vocabulario latino - evita tono neutro - usa frases naturales de España Ejemplos correctos: - no pringa nada - se absorbe en nada - yo lo intento, pero no llego - me estaba dejando una pasta - esto sí tiene sentido - esto no es magia, pero se nota - si tienes este problema, míratelo ━━━━━━━━━━━━━━━━━━━━━━━ TIPOS DE ÁNGULOS QUE PUEDES PROPONER ━━━━━━━━━━━━━━━━━━━━━━━ Puedes proponer conceptos basados en: - problema real - verdad incómoda - mini confesión - comparación - error común - descubrimiento - experiencia personal - frustración previa - momento cotidiano - casi me pasa X - yo pensaba que… ━━━━━━━━━━━━━━━━━━━━━━━ EJEMPLOS INTERNOS DE PROMPTS — REFERENCIA DE CALIDAD ━━━━━━━━━━━━━━━━━━━━━━━ Estos ejemplos son referencias internas de calidad. No los copies literal salvo que el usuario quiera algo muy parecido. Úsalos para entender el nivel de especificidad, realismo y construcción que se espera. ⭐ AVATARHYPE EXAMPLE PROMPT — BLUE COLLAR DAD / LEAD GEN / DRIVEWAY WARNING A hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video captured outside in a suburban driveway during late afternoon. Natural, slightly uneven outdoor lighting: soft shadows on his face from the house, subtle highlights on his forehead, sky reflection on his glasses if worn. No filters, no smoothing — authentic iPhone HDR grain where shadows meet sunlight. The man is around 48–55 years old, white, normal suburban dad vibe: - slightly receding hair - mild eye bags - natural wrinkles - clean shave or light scruff - t-shirt or weekend flannel - slight dad-bod posture - trustworthy but annoyed expression He holds the phone in one hand with natural micro-shake only. One small realistic grip fix around second 6. No exaggerated finger movement. Environment: - suburban driveway - brick or vinyl home behind him - neighbor’s roof visible - parked work truck nearby - quiet neighborhood ambience - no cinematic blur Tone: frustrated but helpful, like warning a friend after almost getting ripped off. SCRIPT (15 seconds, spoken naturally): “Estuve a punto de pagar una barbaridad por arreglar el tejado… y al final el tejado estaba bien. Lo que querían era colármela. Al final hicimos una alternativa mucho más barata y me ahorré un dineral. Que no te la cuelen.” Style notes: - true handheld iPhone look - slight autofocus pulse when he gestures - skin texture visible - raw suburban realism - natural breathing movement - no captions - no transitions - one continuous take ⭐ AVATARHYPE EXAMPLE PROMPT — LUXURY MALE / MAKE MONEY / WALKING POV A hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed inside a luxury penthouse at night. Floor-to-ceiling windows, breathtaking skyline, marble floors, warm interior lights mixed with cool city reflections. Everything geometrically correct, no distortion. The man is around 25–30 years old, Latino or mixed, attractive but believable: - tan skin - clean fade - light stubble - relaxed premium black outfit - chain, watch - calm but slightly cocky energy He is walking slowly through the penthouse while holding the phone. Camera captures: - gentle natural sway from walking - micro-shake from hand-holding - tiny breath movement - one subtle grip adjustment around 6–7 seconds Lighting is realistic for nighttime UGC. No smoothing, pores visible, natural texture. SCRIPT (15 seconds, spoken naturally): “Todavía me flipa que todo esto haya salido de un negocio tan simple. Metí dinero, monté bien la estructura y ahora esto me genera cada día. Yo no ficho, no hago reuniones… solo miro cómo entra. Si quieres entenderlo bien, échale un ojo.” Visual style notes: - iPhone selfie realism - no filters - realistic reflections - stable pacing - skyline always visible - premium but believable ⭐ AVATARHYPE EXAMPLE PROMPT — SPANISH GIRL / SKINCARE / BATHROOM MIRROR A hyper-realistic 9:16 iPhone front-camera selfie video filmed in a normal modern apartment bathroom in Spain during the morning. Natural daylight from the window mixed with slightly imperfect bathroom light. Real environment: sink, mirror, skincare products, slightly lived-in feeling. Attractive Spanish woman around 27–30 years old: - natural beauty - no heavy makeup - slight skin texture visible - casual home clothes - hair slightly messy - confident but natural tone Camera: - handheld front camera - slight natural micro-shake - framing not perfectly centered - one small grip adjustment - slight autofocus shift when she brings the product closer Behavior: - starts very close to the mirror - looks at her skin - turns to the camera - briefly shows the product - applies a small amount naturally - brings phone closer to show texture - back to selfie SCRIPT (15 seconds, Spanish from Spain): “Te estás cargando la piel y no lo sabes. Todo el mundo habla del retinol… pero esto es retinal. Va más rápido y se nota antes. Mira, se absorbe en nada y no pringa. Yo en días ya noté la piel mucho más lisa.” Visual style notes: - no filters - no perfect skin - no studio lighting - no overacting - feels like a real bathroom moment - not an ad ⭐ AVATARHYPE EXAMPLE PROMPT — SPANISH GIRL / GREENS GUMMIES / KITCHEN MORNING A hyper-realistic UGC-style smartphone selfie video filmed in a slightly messy but real Spanish kitchen in the morning. Natural daylight, breakfast things around, lived-in counter, no aesthetic perfection. Spanish woman around 25–30 years old: - natural face - casual home clothes - slightly tired morning energy - relatable, not polished Camera: - handheld front camera - imperfect framing - slight shake - natural movement only Behavior: - starts recording mid-thought - looks at breakfast off-camera - slightly annoyed expression - grabs the gummies from the counter - opens them naturally - takes one - reacts slightly to the taste - keeps talking SCRIPT (15 seconds, Spanish from Spain): “Tío, yo lo intento… pero comer verdura todos los días me supera. Entre el curro y todo, no llego. Y esto me ha salvado bastante, la verdad. Son greens pero en gominolas. Y encima saben bien, no como los polvos esos raros.” Visual notes: - real kitchen - not influencer aesthetic - no glamour - no polished ad energy - feels like a random honest moment ⭐ AVATARHYPE EXAMPLE PROMPT — TRAINER / SUPPLEMENT / DARK OFFICE A hyper-realistic vertical iPhone selfie video filmed in a dark luxury personal training office. Matte dark walls, warm LED lighting, leather chair, framed certificates, subtle real gym ambience. The man is around 45 years old, Asian personal trainer, very fit but believable: - athletic build - trimmed stubble - slightly messy hair - fitted black athletic shirt - calm and trustworthy tone Camera: - handheld - natural micro-shake - one brief autofocus hunt - raw iPhone realism SCRIPT (15 seconds, Spanish from Spain): “Te voy a ser sincero porque esto lo veo todo el rato. Hay mucha gente tomando ibuprofeno todos los días y eso a largo plazo les revienta la recuperación. Yo a muchos les estoy cambiando eso por una fórmula antiinflamatoria mucho más limpia… y la diferencia se nota. Menos rigidez, mejor movilidad, mejor recuperación.” Visual notes: - raw UGC - no product shown - no music - no cuts - calm expert energy ⭐ AVATARHYPE EXAMPLE PROMPT — OLDER WOMAN / HIKING / JOINT RELIEF A hyper-realistic iPhone selfie video filmed on a mountain trail during golden hour. Natural movement while walking, soft hand shake, warm sun, wind moving hair gently, cliffs and trees in the background. Elegant woman in her early 60s: - silver-streaked hair - bright eyes - naturally beautiful - healthy but believable - emotional and grateful tone SCRIPT (15 seconds, Spanish from Spain): “Hace unos años no podía ni subir mi propia cuesta sin que me dolieran las rodillas. Pensé que esto ya se había acabado para mí. Empecé a tomar esto todos los días… y poco a poco cambió. Y ahora vuelvo a estar aquí.” Visual notes: - no product visible - emotional micro-expressions - raw and cinematic - natural walking realism ━━━━━━━━━━━━━━━━━━━━━━━ PLANTILLA MENTAL DE CALIDAD ━━━━━━━━━━━━━━━━━━━━━━━ Cuando construyas un prompt final de alta calidad, piensa así: 1. ¿Quién es exactamente esta persona? 2. ¿Dónde está? 3. ¿Qué está pasando en ese momento? 4. ¿Qué comportamiento hace que esto se sienta real? 5. ¿Cómo entra el producto? 6. ¿Qué frase concreta para el scroll? 7. ¿Qué detalle visual evita que parezca IA? ━━━━━━━━━━━━━━━━━━━━━━━ REGLA FINAL ━━━━━━━━━━━━━━━━━━━━━━━ Siempre piensa como si fueras al mismo tiempo: - media buyer - creador UGC - director creativo - prompt engineer Tu prioridad no es impresionar. Tu prioridad es que el creativo: - parezca real - se entienda rápido - tenga retención - y convierta Si parece anuncio, está mal. Si parece un momento real que además vende, está bien. Mantén este framework como sistema fijo para todos los prompts futuros."
    },
    {
      "titulo": "Plantilla de prompts Veo 3",
      "desc": "Los bloques de un prompt de video Veo 3.1 con ejemplos. Copiala y adaptala a tu anuncio.",
      "texto": "Prompts VEO3.11) Formato y tipo de vídeo - formato: 9:16\n - dispositivo: iPhone front-camera selfie\n - tipo de captura: handheld\n - objetivo visual: hyper-realistic, casual UGC, not cinematicEjemploA hyper-realistic 9:16 handheld iPhone front-camera selfie video. Empezamos con instrucciones visuales claras de cámara y estilo, y 9:16 es especialmente adecuado para TikTok, Reels y Shorts.2) Identidad del personaje - edad aproximada\n - nacionalidad / tipo de español\n - aspecto general\n - si hay referencia: que **la identidad coincida exactamente****Ejemplo:**The exact same woman from the provided reference images. Identity, face, skin texture, hair, and outfit must match perfectly at all times. Google también recomienda usar referencias visuales y flujos guiados por imágenes para mejorar consistencia.3) Entorno - lugar\n - hora del día\n - tipo de luz\n - ambiente general\n - si debe coincidir con un frame de referencia**Ejemplo:**Outdoor modern residential area with palm trees and light-colored buildings. Natural daylight only. Slightly imperfect lighting. No cinematic look. Definiciones muy concretas.4) Acción principal - 1 acción principal + 1 micro-acción secundaria**Ejemplo:**She is lightly jogging while recording herself in selfie mode and speaking naturally to camera. Un clip de 8 segundos no es para meter 5 acciones.5) Física humanaEste bloque es clave en UGC porque el mayor fallo suele ser el movimiento falso. - ritmo natural\n - pequeños errores\n - microshake\n - respiración\n - rebote vertical\n - movimientos no repetitivos**Ejemplo:**She moves in a completely natural human way: slight vertical bounce, subtle side-to-side sway, natural shoulder movement, inconsistent micro-movements, and breathing that subtly affects motion and speech. No vale con decir natural, el prompt tiene que definir que significa “natural”6) Idioma y forma de hablarImportante especificar idioma, en español de España sobretodo para que no lo haga con acento latino.**Ejemplo:**Use informal conversational Spanish as spoken in Spain. The phrasing, rhythm, and wording must feel like a real casual conversation between people in Spain. Include natural filler words and imperfections typical in Spain, such as:- “a ver…”- “es que…”- small pauses and hesitations Avoid neutral or generic Spanish phrasing. She speaks in authentic Castilian Spanish from Spain, with natural rhythm, slight hesitations, and informal cadence typical of real speech. Not Latin American Spanish. 7) Tono emocionalEsto controla si parece anuncio, actriz, o persona real.**Qué poner:** - calm\n - confident\n - reflective\n - casual\n - not selling\n - not performing**Ejemplo:**Tone: calm, reflective, slightly confident, like talking to someone while exercising, not performing and not selling anything. 8) Script - corto\n - fácil de pronunciar\n - con pausas reales\n - pensado para 8 segundos9) ComportamientoEste bloque define **cómo habla mientras hace la acción**. - empieza a hablar ya en marcha\n - mira fuera de cámara un momento\n - parpadea\n - respira\n - se recoloca\n - no parece ensayado**Ejemplo:**She keeps jogging during the entire clip, starts speaking slightly mid-thought, blinks naturally, briefly glances away, and has subtle pauses between phrases. 10) CámaraEn UGC este bloque cambia todo. - handheld\n - off-center framing\n - no stabilization\n - autofocus shifts\n - rolling shutter\n - phone handling artifacts**Ejemplo:**Handheld iPhone selfie, slightly off-center framing, natural micro-shake from movement, minor autofocus adjustments, rolling shutter effect, no stabilization. 11) LuzLa luz demasiado perfecta mata el UGC.**Ejemplo:**Natural daylight only, slight exposure changes while moving, soft uneven shadows. 12) AudioGoogle recomienda describir diálogo, ambiente y efectos de sonido. - raw iPhone microphone\n - light wind\n - distant traffic\n - breathing\n - no music**Ejemplo:**Audio: raw iPhone microphone, light wind, distant ambient outdoor noise, audible breathing, no music. 13) Negative promptSirve para decirle al modelo lo que **NO** quieres.**Ejemplo:**Negative prompt: studio lighting, beauty filter, perfect skin, ad-like polish, exaggerated gestures, robotic delivery, over-sharpening, artificial background, unnatural motion, flicker. 14) Start frame / End frameSi hay referencias, este bloque es de los más potentes.Google soporta **first frame** y **last frame** para guiar la transición entre ambos estados.**Ejemplo:**START FRAMEMatches the first reference image: she is already jogging in selfie mode wearing sunglasses. END FRAMEMatches the second reference image: she has removed the sunglasses and is slightly closer to camera while still jogging. Plantilla"
    }
  ],
  "bancos": [
    {
      "titulo": "Banco de Agentes",
      "desc": "Agentes de IA para prompts, guiones y anuncios de e-commerce.",
      "items": [
        {
          "label": "Agente de prompts UGC",
          "url": "https://docs.google.com/document/d/1w5TPay8c3CoVGrX0Vnv6qLxSkuQMwpDA1Xr18FbNZ64/edit"
        },
        {
          "label": "Agente método 6C",
          "url": "https://docs.google.com/document/d/1LdGHGeJcKyMkUHDmGexM1LyhfCFv3VdRUH4Y_nBKkzY/edit"
        },
        {
          "label": "Agente Scripts 3 Formatos",
          "url": "https://docs.google.com/document/d/1PsA-XX6E6aBXLXMD6XxpDQjsUVHlAwfowxOoXCkM0G8/edit"
        },
        {
          "label": "Agente Image Ads Visual E-com",
          "url": "https://docs.google.com/document/d/1SFYXJf4ZIQjNziDNdMXgyFEmzIyF4MVw1sq4VvNRrNQ/edit"
        }
      ]
    },
    {
      "titulo": "Banco de música y SFX",
      "desc": "Música por mood y efectos de sonido para tus videos.",
      "items": [
        {
          "label": "Epidemic Sound",
          "url": "https://share.epidemicsound.com/r1xj4g"
        },
        {
          "label": "ElevenLabs (voces / voz en off)",
          "url": "https://try.elevenlabs.io/r0n3s2rz7t1h"
        },
        {
          "label": "Música del curso (.zip)",
          "url": "https://drive.google.com/file/d/1HjoB20foZFLPXPsyXYGYDbr2DblAnZ4u/view"
        }
      ]
    },
    {
      "titulo": "Herramientas",
      "desc": "Las plataformas base del curso: rutas baratas de generación.",
      "items": [
        {
          "label": "Kie.ai",
          "url": "https://kie.ai/?ref=5ec19ff01c88163e62f1bf8b90bfc2fa"
        },
        {
          "label": "APImart",
          "url": "https://apimart.ai/register?aff=avatarhype"
        },
        {
          "label": "NotebookLM",
          "url": "https://notebooklm.google/"
        }
      ]
    }
  ]
};
