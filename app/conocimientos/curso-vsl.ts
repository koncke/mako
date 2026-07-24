// =============================================================================
// "Reglas para crear tu VSL y Landing Page" — método de Martín Koncke
// =============================================================================
// Módulo de /conocimientos (SuperAdmin), categoría "VSL y Landing Page".
// Es la versión viva de MaKo-VSL/_voz-martin.md: el checklist que hay que pasar
// ANTES de entregar un guión, un video o una landing de feature.
//
// Va en archivo propio (y no dentro de curso.ts) porque aquél es AUTO-GENERADO
// desde transcripciones: cualquier cosa que se escriba ahí se pierde al regenerar.

import type { Curso } from './curso';

export const CURSO_VSL: Curso = {
  slug: 'vsl-landing',
  categoria: 'VSL y Landing Page',
  cardDesc: 'El checklist completo para escribir, filmar y publicar el mini-VSL y la landing de cada funcionalidad.',
  eyebrow: 'Método interno',
  titulo: 'Reglas para crear tu VSL y Landing Page - Martin Koncke',
  subtitulo: 'Todo lo aprendido produciendo los mini-VSL de las funcionalidades: guión, video, audio y landing. Revisar ANTES de entregar.',
  volumen: '42 reglas',
  recursos: [],
  clases: [
    {
      n: 1,
      grupo: 'El guión',
      titulo: 'Las 13 reglas del guión',
      cardDesc: 'El checklist que hay que pasar antes de mostrar cualquier guión.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `CHECKLIST ANTES DE ENTREGAR CADA GUION

- **Impersonal.** Lo narra una voz de IA, no aparece ninguna persona. Nada en primera persona de Martín: no "construí MaKo", no "te acompaño", no "soy Martín". MaKo se narra impersonal: "aquí es donde entra MaKo".
- **Picante.** Preguntas retóricas que exponen: "hazte una pregunta incómoda", "eso no es tener un sistema, es tener una intuición". Sin picante no convierte.
- **Cero repetición.** No repetir palabras ni ideas. Barrer repeticiones antes de entregar.
- **Objeciones con lead-in directo:** "Y si tu objeción es X… déjame decirte algo:". Solo una o dos, la que ataca el tema de ESE video.
- **Sin jerga técnica.** Nada de R1/R2, CAC/ROAS, banda, fila, tipos de etapa. Hablar de dinero, negocio, escalones, pedazos.
- **Un concepto por VSL.** No mezclar funcionalidades: CRM, semáforo y análisis tienen su propio video.
- **No inventar nombres** de mecanismo o producto. Es MaKo, punto.
- **Regla del "solo":** concreto y puntual, nunca "MaKo hace TODO solo". Válido: "te avisa por WhatsApp cuando se agenda una llamada".
- Decir **"dinero"**, nunca "plata".
- **Todo en "tú"**, sin voseo. Y "aquí", no "acá".
- **La prueba es UNA cosa sostenida**, sin cortes rápidos: generan desconfianza. Se usa el funnel real de Mauricio.
- **Cierre: máximo 2 frases.** Nada de pila de clichés. Funciona el patrón "No es X. Es Y.".
- **Cuando falte contexto, preguntar cosas específicas del guión**, no generalistas. El avatar no admite sus dolores en voz alta: chocan con su ego. Son inconscientes y se los hacemos ver.`,
    },
    {
      n: 2,
      grupo: 'El video',
      titulo: 'Estilo visual',
      cardDesc: 'Fondo, colores, tipografía, marca de agua y estructura del video.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `REGLAS DE ESTILO

- **Fondo blanco, letras negras.** Nunca fondo oscuro.
- **El texto en pantalla es EXACTO al audio**, palabra por palabra. Nada de recortar ni parafrasear.
- **Énfasis en AZUL** (#2F6FED). El **dorado queda reservado solo para la palabra "MaKo"**.
- **Texto gigante siempre en pantalla** — no aparece nadie — salvo cuando hay gráfico, logos, foto o demo.
- **Apps: logos reales.** Aunque el locutor nombre pocas, se llena la pantalla con todas para dar sensación abrumadora.
- 16:9 · 1920×1080 · tipografía Geist bold.

MARCA DE AGUA

- Badge oscuro (#2A251C→#171511) + estrella dorada (#F6D365→#EF9F27) + wordmark "MaKo" con barrido dorado de IZQUIERDA a DERECHA, en loop de 2,6 s.
- Sin el texto "Marketing OS". Estrella y texto centrados verticalmente (el texto va nudgeado +6% del tamaño).

ESTRUCTURA

1. **Intro:** la animación de logos colisionando hasta formar MaKo, acelerada 1,5× (unos 5,6 s) sobre fondo blanco, con música fuerte y efectos.
2. **Después entra el narrador** con el texto cinético.`,
    },
    {
      n: 3,
      grupo: 'El video',
      titulo: 'Ritmo y dinamismo',
      cardDesc: 'Beats cortos, emojis, fondos azules y el efecto 3D de las capturas.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `RITMO

- **Máximo 2 líneas por pantalla.** Cuanto más corta la frase, más dinámico: mejor 80 beats cortos que 40 largos. Texto largo es video aburrido.
- Las frases largas se parten usando los timestamps palabra por palabra del forced-alignment, así el corte no rompe el sync.

RECURSOS DE DINAMISMO

- **Emojis sobre el título** en beats puntuales, no en todos.
- **Fondo AZUL alternado** en los golpes emocionales (frases cortas y punchy): gradiente #3B7BF5→#1E4FBF con TODO el texto en blanco. Sobre azul, el fondo ya es el énfasis. Corte duro, sin transición.
- **Capturas de la app a pantalla completa y SIN texto encima.** Solo queda la marca de agua abajo. Nada de tarjetitas con subtítulo.

EFECTO 3D DE LAS CAPTURAS

- No se animan de a una: son UNA sola tira horizontal, con separación entre capturas, que atraviesa UNA sola deformación cilíndrica fija de pantalla (centro cerca, bordes alejándose), más un zoom lento de 1,00 a 1,13 a lo largo de toda la secuencia.

VIDEO DE TESTIMONIO

- Vertical, muteado, a un costado, con borde fino oscuro y esquinas apenas redondeadas. El texto se corre al otro lado.`,
    },
    {
      n: 4,
      grupo: 'El video',
      titulo: 'Íconos, imágenes y stock',
      cardDesc: 'Cuándo poner un logo, cuándo un ícono y cuándo un video de stock.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [
        { nombre: 'Iconify', url: 'https://api.iconify.design', nota: 'Sin API key. Íconos de línea lucide y logos de marca.' },
        { nombre: 'Pexels', url: 'https://www.pexels.com', nota: 'Videos de stock. Clave en MaKo-VSL/_keys.env.' },
        { nombre: 'Pixabay', url: 'https://pixabay.com', nota: 'Ilustraciones con fondo transparente.' },
      ],
      resumen: `CUANDO EL GUION NOMBRA UNA APP

- Va el **logo real** de esa app sobre el título: Excel, Meta, Calendly, WhatsApp. Nombrar una app y no mostrarla es regalar el reconocimiento que ya tiene.
- Excel está en Iconify como vscode-icons:file-type-excel (en la colección logos NO está).

ICONOS DE CONCEPTO

- Íconos de línea de Iconify (lucide) en azul de marca. Se cargan como SVG directo en el canvas, no hace falta pasarlos a PNG.
- La ráfaga de la lista ("Tus anuncios / Tu landing / Tu VSL / Tus agendas…") lleva un ícono grande por frase. Es el momento más "ad" del video.
- Cuando el guión describe un recorrido, va un **diagrama de dos nodos** con conector punteado que se traza y punta de flecha.

IMAGENES Y VIDEO DE STOCK

- Para el dolor, **video de stock a pantalla completa** (no foto): oscurecido con gradiente negro y algo de desaturación, con el texto en blanco y sombra.
- **Ser criterioso:** pocas imágenes y solo donde el texto solo se queda corto. Mezclar fotos realistas con íconos planos ensucia. Elegir un lenguaje y sostenerlo.

TODO LO QUE APARECE, SUENA

- Pop por ícono, whoosh en el video de stock y al arrancar o salir el carrusel, shimmer cuando se traza un conector. Va como una segunda capa que se mezcla con el bed del intro.`,
    },
    {
      n: 5,
      grupo: 'El video',
      titulo: 'Audio y locución',
      cardDesc: 'Mezcla de música, techo de volumen y cómo hacer que ElevenLabs pronuncie bien.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [{ nombre: 'ElevenLabs', url: 'https://elevenlabs.io', nota: 'Voz David · modelo eleven_multilingual_v2' }],
      resumen: `MEZCLA

- El **intro va con la música cruda** para que conserve el punch de los graves.
- **Cuando entra el locutor**, la música pasa por una cadena que le pone techo real y le abre paso a la voz: corte de graves en 85 Hz (saca el 808 que "explota"), hueco en 2,6 kHz para la voz, compresor y limitador.
- Resultado medido: la variación entre secciones baja de 4,2 dB a 2,4 dB.
- El cruce entre las dos ramas va con un crossfade de medio segundo: el corte es inaudible.
- **Efectos bien fuertes:** pop por logo, riser en la convergencia, impacto y destello cuando se forma MaKo.

PRONUNCIACION EN ELEVENLABS

- **No abusar de los breaks:** dejan la voz muy pausada. El guión ya pausa por puntuación. Para que salga dinámico: casi sin breaks, velocidad 1,05-1,12, estabilidad 0,30-0,35, estilo 0,45-0,55.
- **Escribir fonético en español lo que el modelo lea mal.** MaKo se escribe "Máko" (sin acento sale "MaKó"). VSL se escribe en minúscula, "vsl" (validado: sale fluido en español; en mayúscula lo mezcla con inglés).
- Regla general: cualquier sigla o marca que suene mal, se escribe como suena en español.
- Un solo take por corrección: clavar texto y pronunciación ANTES de generar.`,
    },
    {
      n: 6,
      grupo: 'La landing',
      titulo: 'Auditar antes de escribir',
      cardDesc: 'El video es la promesa; la landing tiene que sostenerla.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `EL PRINCIPIO

El video es la promesa y la landing tiene que sostenerla. Si no hablan de lo mismo, el visitante siente un cambio de tema y se va.

REGLAS

- **Auditar ANTES de reescribir.** No dar por buenas las secciones que ya están. En funnel, las 4 secciones publicadas eran de OTRA funcionalidad y nada de eso aparecía en el guión.
- **El guión es la fuente de verdad de la landing**, no al revés. Lo que el VSL no menciona, no va en la página de esa funcionalidad.
- **Si algo no pertenece, se muda a una funcionalidad nueva.** No se borra ni se deja "porque ya estaba". Mejor 25 funcionalidades claras que 24 mezcladas.
- **El video reemplaza al párrafo introductorio.** Si hay mini-VSL, el subtítulo baja a UNA línea.
- **Nada de jerga ni de detalle de interfaz:** nombres de tablas, "modal con confirmación", "toast", "del lado del servidor", variables de entorno.
- **Buscar el copy dentro del producto:** la microcopy de la app suele ser mejor que la de la landing.
- **Antes de prometer, verificar en el código.** Y al revés: nunca prometer lo que todavía está apagado.
- **Cross-links con criterio.** Todo está conectado, así que a veces un bloque roza otra funcionalidad. Callarlo hace que quien entra a UNA sola landing se pierda la mitad del valor. Un renglón que lleve allá, solo si suma de verdad.`,
    },
    {
      n: 7,
      grupo: 'La landing',
      titulo: 'Maquetación de la página',
      cardDesc: 'Hero, fondos por sección, CTA y cómo se adapta el costado.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `ESTRUCTURA

- **El hero es el mismo que el de la landing principal:** pill, titular, subtítulo, botón y notita a la izquierda; el video a la derecha. No inventar un hero distinto por página.
- **El nombre de la funcionalidad va arriba a la derecha**, en la fila del "volver", no pegado al titular: si no, parecen dos títulos.
- **Fondo alternado por bloque**, a todo el ancho. Sin eso no se lee dónde termina una sección.
- **Cualquier título de sección va DENTRO del fondo de su sección**, no flotando sobre el del bloque anterior.
- **Nunca dos títulos seguidos diciendo lo mismo.**
- **CTA al cierre de cada bloque** y también después de "Cómo funciona".
- **El caso de Mauricio va abajo del CTA**, idéntico en todas las funcionalidades.

EL COSTADO SE ADAPTA

- Nunca un gráfico o video chico con aire arriba y abajo. El panel llena su columna con su propio fondo.
- **Es más fácil adaptar cómo presentamos el costado que adaptar el video.** El orden por defecto es algo a un lado y texto al otro; las excepciones se aceptan si el contenido lo pide.

LIMPIEZA

- **Auditar textos innecesarios en cada pasada**, no solo el copy nuevo: chips sueltos, subtítulos que repiten, listas que ya están en un bullet.
- **Nada de relleno:** las citas decorativas y las notas técnicas no venden.`,
    },
    {
      n: 8,
      grupo: 'La landing',
      titulo: 'El hilo del storytelling',
      cardDesc: 'Un gatillo que atraviesa la página, títulos que se entienden solos y el ¿para qué?',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `EL HILO

- **Un gatillo conector atraviesa TODA la página.** El subtítulo del hero no explica la sección: deja el efecto WOW y abre el hilo. En funnel: "Te hago una pregunta incómoda: ¿podés ver tu negocio entero ahora mismo?".
- Y ese hilo sigue en los bloques siguientes. **Menos es más:** el subtítulo corto y punzante le gana al párrafo explicativo.

LOS TITULOS SE ENTIENDEN SOLOS

- **Los leads deslizan.** Cada título tiene que entenderse por sí solo, sin leer el cuerpo.
- Se escriben **personales, en tú, hablándole al lead**: "Con MaKo vas a ver el recorrido de tus leads: del anuncio al pago".
- **Máximo 2 líneas.** Si no entra, se adapta el copy.

LA PREGUNTA QUE NUNCA FALTA

- **¿PARA QUE le sirve esto al cliente?** En cada sección hay que hacerse la pregunta y que la respuesta esté en el copy. No alcanza con explicar qué hace: eso es obvio y técnico.
- Ver el recorrido del funnel sirve para **saber exactamente dónde está fallando**. Ver el comportamiento por lead sirve para **hacerle seguimiento personalizado según dónde se quedó**.

OTRAS

- **Bloque de preguntas incómodas antes que lista de features.** Cada app se presenta con una pregunta que el dueño hoy no puede responder, con su logo al lado.
- **El logo va matcheado al texto, nunca suelto arriba.**
- **Los cierres fuertes van como card destacada**, no como párrafo suelto.
- **Plural cuando hablamos de leads en general**, singular solo cuando el bloque es de UN lead.
- **Nombres correctos:** es "Landing", no "tu web".
- **El puente a otra funcionalidad siempre arranca con "Descubrí cómo…"** y enlaza a la que MEJOR continúa el hilo, no a la más obvia.`,
    },
    {
      n: 9,
      grupo: 'La landing',
      titulo: 'Gráficos y animaciones',
      cardDesc: 'El norte (claridad > creatividad), los principios y el reproductor de video.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [{ nombre: 'Panda Video', url: 'https://dashboard.pandavideo.com', nota: 'Hosting del mini-VSL de cada funcionalidad.' }],
      resumen: `EL NORTE

**Si tenés que elegir entre creatividad o claridad, elegí claridad.** Un gráfico existe para que se entienda simple y rápido. Ante la duda, la opción más clara le gana a la más ingeniosa. Casi todas las reglas de abajo salen de acá.

LA REGLA DURA (antes de crear)

**Describir el concepto y el flujo EN PALABRAS y esperar el OK. No crear nada hasta saber EXACTAMENTE qué va ahí.** Los gráficos del CRM tardaron muchísimo por saltear esto. Nada de asumir ni de copiar el template anterior.

PRINCIPIOS (peleados con los del CRM)

- **Una idea por gráfico, un elemento a la vez.** Nunca todo junto: primero el texto, DESPUÉS el tablero. Que se lea de a uno, pausado.
- **Cada elemento se entiende solo.** Nombrar quién/qué/dónde (José = un lead, RECON = campaña de julio, en el CRM); no depender del anterior.
- **Consistencia de tamaño y tipografía.** UN solo elemento héroe (grande); el resto comparte tamaño, peso y color. "Que cada cosa cambie es mucho."
- **Legibilidad > efecto.** Texto sobre fondo cargado: difuminar/velar el fondo, contorno o sombra al texto, y decorativos (grietas, líneas) en gris, nunca en negro que compita con las letras.
- **Si hacés un efecto, hacelo completo:** el vidrio rompe TODO el Excel, no una parte. Las medias tintas se leen como error.
- **Nada de realismo forzado.** Si algo sale feo (las "manos" que movían tarjetas), se saca entero, no se pule. Mejor texto simple que dibujo mediocre.
- **Sin adornos que no aporten.** El gráfico NUNCA lleva título. La estrella de MaKo no va "porque sí" (antes de "Con" no significaba nada → afuera).
- **Diferenciá la marca con sutileza:** "MaKo" en azul dentro de la frase pega más que pegarle una estrella al lado.
- **El timing es diseño:** aparecer de a uno, esperar a que se lea, subrayar la acción clave con un barrido dorado / energía. Fluido, no robótico.

REGLAS TÉCNICAS

- Las animaciones van en **BUCLE**. Una que corre y se congela es peor que ninguna: quien llega scrolleando encuentra una imagen quieta.
- **Un recorrido se entiende mejor como chat de WhatsApp que como tabla.**
- Fondo blanco/claro; el **dorado** reservado para MaKo y para el barrido de la acción; el **azul (#2F6FED)** para el énfasis y para la palabra "MaKo".

EL REPRODUCTOR

- El flotante que sigue al scroll es el embed oficial con su API, no un parámetro de la URL.
- **Ojo:** la página de funcionalidad scrollea dentro de un contenedor fijo, no en la ventana. Hay que hacerle ver el scroll real del contenedor para que flote y vuelva.
- Arranca **muteado siempre**. La config del player es **por biblioteca, no por video**: cambiar algo afecta a todos.

PROCESO

- Martín prefiere verlo **VIVO** (pushear a main) más que descripciones. Para iterar rápido, tiras de capturas: varios frames del loop lado a lado.`,
    },
    {
      n: 10,
      grupo: 'Referencia',
      titulo: 'La voz de Martín',
      cardDesc: 'Registro, conectores, patrones de escritura y frases-firma.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `REGISTRO

- Todo en "tú", sin voseo. Tono personal directo igual: "Dime la verdad…", "¿no?".
- Frases cortas. Un punto tras otro. Mucho punto y aparte para respirar.
- Cercano, mentor que ya lo vivió, honesto y anti-humo. Nada corporativo.

CONECTORES Y MULETILLAS

- "De hecho, probablemente…"
- "Y ahí estás vos…"
- "Pero…" como pivote constante
- "Y lo peor es que…"
- "Te das cuenta a fin de mes."
- "Y esto no es teoría."
- "Y esta es la parte que importa."

PATRONES DE ESCRITURA

- **No es X. Es Y.** → "No tienes un sistema. Tienes una intuición."
- **Lista con remate en una palabra:** "Tus anuncios. Tu landing. Tu VSL. Tus agendas. Tu WhatsApp. Tus llamadas. Todo."
- **Stack de preguntas retóricas:** "¿Fue precio? ¿Fue falta de urgencia? ¿Fue una mala calificación?"
- **Repetir un número como frase:** "…abro solo cinco cupos. Cinco."

FRASES-FIRMA

- "escalar a ciegas" · "con información incompleta"
- "No tienes un sistema. Tienes una intuición. La intuición sirve para empezar. Pero para escalar, se queda corta."
- "Te das cuenta a fin de mes… y los números no te cierran."
- "Nadie te muestra tu negocio completo."`,
    },
    {
      n: 11,
      grupo: 'Referencia',
      titulo: 'El caso Mauricio y la oferta',
      cardDesc: 'La prueba que se usa en todos los videos y el contexto del CTA.',
      videoId: null,
      transcripcion: [],
      recursoSlugs: [],
      herramientas: [],
      resumen: `FICHA DE MAURICIO

- Ya vendía: el problema **no era arrancar, era escalar**. Meses por debajo de $10k y nunca sabía por qué. Dependía de su instinto.
- **Antes:** casi todo en un Excel que rehacía cada vez que necesitaba medir algo nuevo. Miraba Meta, saltaba a Calendly y cruzaba a mano.
- **Con MaKo:** su negocio completo en una sola pantalla, decidió con datos y multiplicó por 20 su inversión en ads sin que cayera el ROAS.
- **Resultado:** de menos de $10k a más de $70k en 3 meses (14k en abril, 20k en mayo, más de 40k en junio).
- La frase: "La misma oferta. Lo único que cambió fue que empezó a decidir con datos."

COMO SE MUESTRA

- Son **DOS bloques**: primero el video con la historia y el resultado; después los descartes ("ninguna app, ningún curso, ningún media buyer") con el carrusel de fotos.
- Idéntico en todas las funcionalidades. El carrusel es parte del segundo bloque: sin él, falta media sección.

LA OFERTA (para el CTA)

MaKo es IA multi-agente para negocios High Ticket con VSL Funnel. Beta de 5 cupos, uno a uno: se instala, se audita el funnel completo y se acompaña. Precio de fundador. El CTA es agendar una llamada.`,
    },
  ],
};
