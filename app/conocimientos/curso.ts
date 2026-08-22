// =============================================================================
// Contenido del Curso AVATARHYPE para el portal /conocimientos.
// AUTO-GENERADO: transcripciones limpias + contenido de los docs (GPTs/Notion)
// embebido, con sus capturas y el link al Notion público. Editar acá.
// =============================================================================

export type BancoItem = { label: string; url: string };
export type Recurso = {
  slug: string;
  label: string;
  cardDesc: string;
  // `pdf` es todo lo que Drive SABE previsualizar en un iframe (pdf, docx, xlsx).
  // `file` es lo que NO: un .zip en un /preview de Drive muestra un cartel de «sin
  // vista previa», así que se dibuja como descarga y no como visor. La diferencia
  // no es cosmética — los descargables de «Inteligencia Viral 2026» son los tres ZIP.
  tipo: 'gpt' | 'notion' | 'pdf' | 'bank' | 'file';
  intro?: string;          // explicación self-contained (qué es, para qué, cómo se usa)
  clases?: number[];       // clases a las que pertenece (chip en el hub)
  texto?: string;          // gpt | notion (contenido copiable, formateado)
  driveId?: string;        // pdf (visor /preview) | file (link de descarga)
  ext?: string;            // file (zip, rar…) — para el badge y el peso visual
  capturasDriveId?: string;// notion (screenshots con los ejemplos visuales)
  notionUrl?: string;      // notion (link a la página pública)
  imagenes?: string[];     // notion (imágenes reales, sueltas)
  // notion, INTERCALADO en el orden real (vid = id de Drive; x = "qué hace" del prompt/paso)
  bloques?: { t: 'head' | 'label' | 'prompt' | 'img' | 'vid'; v: string; x?: string }[];
  items?: BancoItem[];     // bank (música / herramientas)
};
export type Herramienta = { nombre: string; url: string; nota?: string };
export type Clase = {
  n: number;
  vn?: number;             // nº de clase dentro de su grupo (para el badge)
  grupo?: string;          // módulo RAÍZ al que pertenece (1er nivel del hub)
  // Sección dentro del módulo (2º nivel del hub). Las plataformas dividen sus
  // módulos en secciones y sin esto las 24 clases de un módulo caen en una sola
  // lista plana, que es justo lo que el hub venía haciendo.
  subgrupo?: string;
  modulo?: number;
  titulo: string;
  cardDesc: string;
  videoId: string | null;
  resumen: string;
  transcripcion: string[];       // vacío: la transcripción se carga aparte (ver hasTx)
  hasTx?: boolean;               // si true, hay transcripción en /cono-tx/<videoId>.json
  transcripcionNota?: string;
  // El MATERIAL de la clase en la plataforma de origen —el documento, sus prompts,
  // sus imágenes—, replicado. Viaja aparte por el mismo motivo que la transcripción:
  // son ~350 KB entre las 27 lecciones y meterlos en la ficha los pone en el bundle
  // de toda la grilla para leer una sola clase.
  hasDoc?: boolean;              // si true, hay documento en /cono-doc/<docSlug>.json
  docSlug?: string;
  // El código con el que la plataforma de origen numera la lección («4.1.1») y su
  // portada replicada. Los usa la vista que reproduce el curso tal como se ve allá.
  codigo?: string;
  portadaClase?: string;
  recursoSlugs: string[];
  herramientas: Herramienta[];
};
export type Curso = {
  slug: string; categoria: string; cardDesc: string;
  eyebrow: string; titulo: string; subtitulo: string; volumen: string;
  // Miniatura del curso, servida estática desde `public/cono-portadas/<slug>.<ext>`.
  // Va como ruta y no como id de Drive porque se muestra en la grilla de TODOS los
  // cursos: una miniatura de Drive por tarjeta son N requests a un dominio externo
  // que además exige que cada archivo esté compartido.
  portada?: string;
  /**
   * Este curso se muestra con la pantalla de SU plataforma de origen, replicada, en
   * vez de con la grilla del portal. Se marca en `catalogo.ts` (no acá: este archivo
   * es auto-generado). Ver `CursoReplica.tsx` para el porqué.
   */
  replica?: boolean;
  clases: Clase[]; recursos: Recurso[];
};

export const CURSOS: Curso[] = [
  {
    "slug": "avatarhype",
    "categoria": "Generación de imagen y video con IA",
    "eyebrow": "Área de alumnos",
    "titulo": "Curso AVATARHYPE",
    "cardDesc": "Anuncios y UGC hiperrealistas con IA por céntimos: prompts, agentes y ejemplos reales.",
    "subtitulo": "Genera anuncios y UGC hiperrealistas con IA —imagen y video— por céntimos. Todo el curso, sus prompts y sus recursos, en un solo lugar.",
    "volumen": "Vol. 1–3",
    "clases": [
      {
        "n": 1,
        "titulo": "Introducción",
        "cardDesc": "Cómo está armado el curso y las dos herramientas base: Kie.ai y APImart.",
        "videoId": "1CN-9GKAHbhsMT55RPDk6M-pNc3R6SPrV",
        "resumen": "Esta primera clase es la introducción al curso: te explica cómo está armado y cuáles son las dos herramientas base que vas a usar de principio a fin. La idea de fondo es que el mundo de la IA cambia todo el tiempo, así que el curso se organiza por **volúmenes**, yendo de lo más simple a lo más avanzado, y se actualiza a medida que salen modelos nuevos.\n\nTodo se genera a través de dos \"mercados de APIs\" que te dan acceso a los modelos de imagen y video mucho más barato que las herramientas tradicionales:\n\n- **Kie.ai** — la usás sobre todo en el **Volumen 1**, que es donde trabajás con el modelo **Sora**. El problema es que OpenAI cerró Sora oficialmente, así que en Kie ya no está disponible al precio ridículo que había: **0,15 USD por 15 segundos**.\n- **APImart** — la herramienta principal a partir del **Volumen 2**. El saldo mínimo para cargar créditos es de **10 USD**.\n\nPara poner saldo en cualquiera de las dos el proceso es el mismo: entrás a tu perfil / panel de control (dashboard), vas a **Cartera** (o **Billing** si lo tenés en inglés) y ahí agregás los créditos.\n\nUn detalle fino importante: aunque Sora ya no esté en Kie, podés seguir aprovechando todo el **Volumen 1** hasta **septiembre** usándolo desde **APImart**. Reutilizás los mismos recursos y la misma forma de estructurar los prompts del Volumen 1, y lo único que cambiás es \"Kie\" por \"APImart\".\n\nEl recorrido por volúmenes queda así:\n\n- **Volumen 2** — entra **APImart** y se trabaja con el modelo **v3.1** (Veo 3.1), con muy buenos resultados.\n- **Volumen 4** — hubo una actualización de modelo y se sumó una **biblioteca de recursos**.\n\nEl consejo del instructor es claro: antes de ponerte a generar, date una vuelta por todo el material. Está bien resumido, va al grano y directo, justamente para no hacerte perder tiempo. Por último, tené a mano el **tablón de comunicaciones** que está arriba del curso: por ahí se avisa cualquier novedad, incluida una plataforma nueva que están armando para tener el contenido mejor organizado.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
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
        "resumen": "Esta clase te muestra cómo generar **UGC** hiperrealista y barato sin quemar créditos en herramientas como **Arcads**, **HeyGen** o **Freepik**. La secuencia de mensajes es trabajar sobre mercados de APIs que dan acceso a los mismos modelos mucho más baratos: **Kie.ai** y **APImart**. Sumás además **trends virales** y anuncios en imagen.\n\n- **Ruta 1 — Sora 2 vía Kie.ai** — generás videos de **15 segundos por ~15 céntimos**. Como con IA siempre vas por prueba y error, que cada intento cueste tan poco lo hace asequible. Ojo con la *success rate*: en Kie.ai cae por horas cuando la API se satura, pero como el sistema no depende de un solo modelo, ese día te cambiás de ruta. La app de Sora cierra en abril, pero la **API sigue hasta septiembre**.\n\nEn Sora el prompt lo es todo. La estructura que recomiendan define, en orden: **encuadre y ambiente** (sin dejar que el modelo invente), **cámara**, **sujeto**, **comportamiento de cámara** (los **microtemblores** de la mano dan realismo), **iluminación**, **audio** y **guión con timing** frase por frase (qué gesto y expresión hace el avatar en cada línea y dónde mete el producto). Tenés un agente al que le pasás producto, avatar y mercado y te devuelve el prompt estructurado. Generás en **Kie.ai > Sora 2 Image-to-Video**, pegás el prompt, subís la imagen del producto y ponés **15s vertical 9:16**. Alternativas fuera de Kie.ai: **Triamina** (**631 créditos** y 7 días gratis; video de 12s = **108 créditos**) y **Sora 2 en Fal.ai** (~1 dólar y pico).\n\n- **Ruta 2 — clips con Veo 3.1 vía APImart** — clips de **8 segundos a ~7 céntimos**, que unís en edición para armar un video de **~16s por ~14 céntimos**. Da más control porque funciona mejor con **primer y último frame** de referencia. Buscás inspiración de avatar en **Pinterest/TikTok**, pasás capturas al agente **6C** y armás el prompt. Las imágenes las hacés con **Nano Banana Pro** (**2K**, **9:16**); truco: agregá \"está hablando, se le ven los dientes\". Si APImart tira error, es que la **API key se quedó sin cuota** (editá y asignále saldo). Después animás con **Veo 3.1** (aspect ratio 9:16, primer y último frame).\n\nEditás en **CapCut** (recortás, mejorás voz, keyframes de Scale para zoom, textura: **3 exposición, -7 contraste, 10% partículas**, motion blur al 20%), música sin copyright en **Epidemic Sound** (30 días gratis, ~-30 de volumen) y subtítulos con **Captions**. Para los **trends virales**: bajás el TikTok, sacás frames con **Frame Extractor** y recreás el antes/después con Nano Banana Pro + Veo 3.1.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "agente-ugc",
          "biblio-sora",
          "metodo-6c",
          "plantilla-veo",
          "trends",
          "ejemplos-ads",
          "catalogo-ads"
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
        "resumen": "Esta clase es el **volumen 2** y va de armar anuncios en **tres formatos**: tipo **podcast**, **UGC tradicional** y **UGC con voz en off**. La idea fuerza es hacerlo por la ruta barata: la vía oficial cuesta **más de 2 dólares** por un clip de **16 segundos**, y por esta ruta te sale **~16 céntimos** por el mismo clip. Aviso: **Sora** ya no está disponible, así que se trabaja con lo que hay.\n\nEl flujo completo es este:\n\n- **Imágenes con GPT-Image 2** — vía la plataforma económica, a **~0,012 € por imagen** (unas **90 imágenes por euro**), muchísimo más barato que **Nano Banana Pro** (~**0,15 €**, unas 7 por euro). La inspiración sale de **Pinterest**: o usás dos prompts (uno para crear una persona nueva que no existe manteniendo, por ejemplo, la definición muscular, y otro para meterla en el fondo que elegiste), o pasás una captura al **agente método 6C**, que te devuelve el prompt estructurado. Si la plataforma barata falla, tirás de **iEdit**.\n- **Guiones con el agente de Scripts** — le das el producto (ej. un suplemento para el cortisol) y te devuelve público objetivo, dolores, ángulo de venta y datos, más los **tres guiones**. Podés editarlos o adaptarlos a otro mercado (ej. EE.UU.).\n- **Clips con Veo 3.1** — por la ruta económica, unos **8 segundos por 0,8 céntimos de dólar**. Los prompts simples funcionan mejor. Hay dos base: cámara **estática** (para podcast) y **talking head**. Rellená el guión con ~**8 segundos** de diálogo. En podcast juntás la 1ª y 2ª frase de la persona 1 en una generación y después intercalás a la persona 2 en edición.\n\nTrucos finos que vale oro:\n\n- **Español de España** — usás el prompt específico y, si igual sale en latino, metés una palabra bien de España al inicio del guión (**tía/tío/joder**) y después la cortás.\n- **Capa de realismo en CapCut** — creás un ajuste con temperatura **-3**, tinte **2**, saturación **-6**, exposición **-3**, contraste **12**, highlight **-35**, sombra **18**, fade **6**; lo guardás en la pestaña **Yours** y lo aplicás a todo el clip. Música a **~-30 dB**.\n- **Detalles** — logo del podcast como marca de agua (GPT-Image 2, **2K**, **1:1**, sin fondo); risas: extraés el audio y lo bajás de fondo. Subtítulos con **Captions** (solo móvil, ~**11 €/mes**, opcional).\n\nPara la **voz en off** usás **ElevenLabs** (elegís voz e idioma de su librería) y animás las imágenes dándole la primera y la última como referencia. Para algunos clips conviene **Kling** (no pasés de **5 segundos** o el lip sync se descontrola); alternativa, **Veo 3.1 Fast**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "ref-visual",
          "metodo-6c",
          "scripts-3f",
          "musica"
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
        "resumen": "Esta clase va de **anuncios en imagen**: cómo pasar de una simple foto de tu producto a varios formatos de anuncio estático que están funcionando ahora mismo, casi en automático. La magia la hace un **agente** (el \"Image Ads Visual E-com\"), al que le das el producto y él te devuelve **7 prompts** ya perfectos para copiar y generar.\n\nEl flujo es así:\n\n- **Le das el producto** — le escribís qué vendés (en los ejemplos, un minoxidil para la caída del cabello y una máscara de luz roja para el acné).\n- **Análisis estratégico** — el agente te devuelve el nicho, el avatar primario, los puntos de dolor y la diferenciación. Vos revisás si te gusta o si querés agregar algo.\n- **Mercado y paleta** — le indicás el país (por ejemplo, **España**) y los colores; por ejemplo, modo claro con primario **azul marino**. El agente te confirma la paleta y el idioma que va incrustado en las piezas, y le das el OK para que lo haga.\n- **Genera los prompts** — te los devuelve estructurados para que no tengas que tocar nada: solo copiás cada prompt, adjuntás tu producto como referencia y generás.\n\nLa generación se hace en la plataforma (**PimArt**) con el modelo **GPT-Image 2**. Un truco para ir rápido: duplicás la pestaña y vas pegando un prompt en cada una, siempre con tu producto de referencia. Usás resolución **2K** y elegís el aspect ratio según el uso: tamaño de post **4:5** para feed, o vertical de historia **9:16**.\n\nLos formatos que salen son:\n\n- **Estilo Reddit** — el que el instructor marca como \"realmente muy bueno\".\n- **Timeline de progreso** con el producto.\n- **Comparación** y **before/after**.\n- **Características del producto**.\n- **Advertorial / tipo noticia o revista**.\n- **Oferta**.\n\nDetalles finos: una vez que tenés los 7, le podés pedir ajustes de diseño (por ejemplo, fondo azul marino, o fondo blanco con un rosa pálido como en el ejemplo del acné). Y si le pedís más formatos después de los 7 principales, te da adicionales que también quedan muy bien. En resumen, todo el peso lo lleva el agente: te entrega los prompts listos con las especificaciones de diseño que vos le pidas.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "image-ads"
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
        "resumen": "**Nota importante:** la transcripción de esta clase no está disponible (en el documento del curso el enlace apunta por error a la Clase 6), así que este resumen **no** describe el contenido puntual de la clase. Para el detalle real —flujo, herramientas y trucos que muestra el instructor— mirá el video. En cuanto tengamos la transcripción, reescribimos esto con el paso a paso concreto.\n\nLo que sí sabemos por el título y la ficha es que la clase va sobre el **formato \"dualcast\"** de **podcast / UGC**: ese estilo de video en el que se ven **dos personas charlando** (tipo entrevista o conversación de podcast) sobre el producto, en vez del clásico testimonio de una sola cabeza parlante a cámara. Es un formato que rinde muy bien como **anuncio de ecommerce** porque se siente orgánico, nativo del feed y menos \"publicidad\", y porque el ida y vuelta entre dos voces te deja meter objeciones y respuestas de forma natural (uno pregunta lo que dudaría el cliente, el otro contesta con el beneficio).\n\nA modo de **contexto general** (no necesariamente lo que se ve en la clase), un pipeline típico de dualcast con IA suele combinar herramientas de las que ya venís viendo en el curso:\n\n- **Generación de los personajes / escena** — con modelos de imagen y video hiperrealistas (por ejemplo **Nano Banana Pro**, **GPT-Image** para los frames base y **Sora 2**, **Veo 3.1** o **Kling** para animar la charla) para armar a los dos \"hosts\" y el set de podcast.\n- **Voz y guion** — el guion de la conversación más las voces se pueden clonar o generar con **ElevenLabs**, y el lipsync se resuelve con el propio modelo de video o herramientas dedicadas.\n- **Armado y edición final** — el montaje, los cortes entre planos, subtítulos y el ajuste a formato vertical **9:16** para Reels/TikTok/Shorts se hace en **CapCut**.\n\nInsisto: lo de arriba es contexto del formato y del stack del curso, no un resumen verificado de esta clase en particular. **No inventamos** los pasos, costos ni parámetros específicos que da el instructor porque no están en el transcript. Cuando cargues la transcripción correcta (la de la Clase 5, no la 6), actualizamos este resumen con el flujo exacto, las herramientas que usa y los trucos finos que menciona.",
        "transcripcion": [],
        "hasTx": false,
        "transcripcionNota": "Transcripción no disponible: en el documento del curso el enlace de esta clase apunta por error a la Clase 6 (Animados).",
        "recursoSlugs": [],
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
        "resumen": "Esta clase es el primer volumen de los **anuncios animados**, un formato que retiene mucho, engancha desde el primer segundo y te deja vender de forma menos agresiva. La idea que machaca el instructor: el **80%** del resultado depende de la **planificación**, no de la herramienta. Por eso arrancás armando toda la estructura con un sistema de **8 prompts** en **ChatGPT**, siempre en la misma conversación (así no perdés contexto).\n\nEl flujo de planificación va así:\n\n- **Prompt 1** — le pasás producto, mercado y estilo (**Pixar**, **claymation**, **Wes Anderson**, **Steiff**, tipo Apple o realista). Define el avatar del cliente y te prepara **3 búsquedas** para NotebookLM.\n- **NotebookLM** (gratis) — creás un cuaderno, cargás las 3 búsquedas una por una y las importás para juntar estadísticas que frenen el scroll.\n- **Prompt 2** (dentro de NotebookLM) — saca **5 insights** duros con cifras reales.\n- **Prompt 3** — pegás esos insights en GPT y te devuelve **3 ángulos de venta**; elegís uno.\n- **Prompt 4** — el guión, según el ángulo elegido.\n- **Prompt 5** — el storyboard (la parte visual de las escenas).\n- **Prompt 6** — genera los prompts de todas las imágenes; en \"style\" dejás solo el estilo elegido.\n- **Prompt 7** — auditoría global: diagnóstico, guión definitivo + **2 variantes** y todo mejorado.\n- **Prompt 8** — metés tu producto (nombre + marca en 2-3 frases, ej. \"Claudi, almohada ergonómica de Sleepy\") y te cierra todo.\n\nLa regla de oro es **iterar**: la IA hace el 80%, pero ese 20% de criterio humano es lo que separa un buen anuncio de uno flojo.\n\nPara la generación:\n\n- **Voz** — **ElevenLabs**, **10.000 créditos gratis/mes**. Con voz de biblioteca usás **Eleven Multilingual V2**; con voz clonada por vos, **V3**.\n- **Imágenes** — **Nano Banana Pro** de Google vía **Kie** (**~9 céntimos**) o **APImart** (**~5 céntimos**), contra los **~15 céntimos** de otras. Siempre **9:16** y calidad **2K** (cuesta lo mismo que 1K). Abrís varias pestañas en paralelo y pasás el producto como imagen de referencia.\n- **Video** — APImart Video con **Veo 3**, calidad **720** y **9:16**, en modo **primer y último frame**: subís primera y última imagen para que arme la transición. Duración **3-4-5 seg** (usa 4). Guardás todo como **P1, P2, P3...** para no perderte.\n- **Música** — **Epidemic Sound** (**30 días gratis**).\n- **Montaje** — **CapCut** (gratis): subís clips + voz, subís velocidad a **1.20-1.30**, transiciones **\"mix\"** en **0,5-0,7**, música en **-25/-30**, efectos en **-8** y la voz un poco más alta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "planificacion",
          "herramientas"
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
    "recursos": [
      {
        "slug": "agente-ugc",
        "label": "Agente de prompts UGC",
        "tipo": "gpt",
        "cardDesc": "El sistema maestro para generar prompts UGC hiperrealistas. Pegalo en ChatGPT.",
        "texto": "AVATARHYPE ECOM — UGC PROMPT ENGINE V1\nBiblioteca + Sistema Maestro para generar prompts hiperrealistas\n\nMantén este framework como sistema base para todos los prompts actuales y futuros según los inputs que te pida el usuario.\n\nA partir de ahora actúas como el generador oficial de prompts UGC de AvatarHype.\n\nTu trabajo es:\n1. Crear ideas y conceptos de anuncios UGC que parezcan grabados por personas reales\n2. Convertir esas ideas en guiones cortos que suenen naturales en español de España\n3. Convertir esos guiones en prompts finales en inglés listos para Sora\n\nIMPORTANTE:\n- Siempre hablas con el usuario en español de España\n- Nunca respondes en tono latino o neutro\n- Todo lo que expliques, analices o recomiendes va en español\n- Los guiones del anuncio van SIEMPRE en español de España\n- Los prompts finales van SIEMPRE en inglés\n- Tu prioridad no es hacer vídeos bonitos. Tu prioridad es hacer creativos que parezcan reales, paren el scroll y conviertan\n\n━━━━━━━━━━━━━━━━━━━━━━━\nFILOSOFÍA AVATARHYPE\n━━━━━━━━━━━━━━━━━━━━━━━\n\nNo estamos creando anuncios típicos.\nEstamos creando momentos que parecen reales.\n\nLa IA sola no hace que un creativo parezca real.\nLo que lo hace parecer real es:\n- la situación específica\n- el comportamiento humano\n- el lenguaje natural\n- la imperfección controlada\n- la integración creíble del producto\n\nSi parece anuncio, está mal.\nSi parece contenido real, está bien.\n\n━━━━━━━━━━━━━━━━━━━━━━━\nREGLAS FIJAS\n━━━━━━━━━━━━━━━━━━━━━━━\n\n1. ANTI-AD\nLos primeros segundos no deben parecer anuncio.\nNada de presentación perfecta, ni encuadre perfecto, ni energía de actor.\n\n2. MICRO-MOMENTO\nNunca construyas desde una idea genérica.\nNo:\n- chica hablando de una crema\n- hombre hablando de un suplemento\nSí:\n- chica en el baño antes de salir, mirándose la frente de cerca\n- chico en la cola del súper viendo lo que se ha gastado\n- mujer en la cocina diciendo que no llega a comer verdura\n- hombre en el parking del gym soltando una reflexión rápida\n\n3. REALISMO\nSiempre que tenga sentido:\n- móvil en mano\n- ligero microshake\n- framing imperfecto\n- cambios pequeños de agarre\n- entorno vivido\n- textura real de piel\n- cero look de estudio\n\n4. LENGUAJE\nTodo lo que diga la persona del vídeo tiene que sonar a España real.\nEvita:\n- tono latino\n- tono neutro\n- muletillas falsas\n- frases de vendedor\n- CTA cutres\n\n5. DURACIÓN\nTodos los guiones deben estar pensados para durar entre 12 y 16 segundos.\nTienen que ser rápidos, naturales y sin relleno.\n\n6. VALOR\nCada guion debe aportar algo. Puede ser:\n- una observación\n- una verdad incómoda\n- una explicación simple\n- un error común\n- una mini revelación\nEjemplo malo: “esto va genial”\nEjemplo bueno: “esto se absorbe en nada y no te deja la cara pringosa”\nEjemplo bueno: “el problema no era la comida, era el aceite que le estaba metiendo sin darme cuenta”\n\n7. CTA\nEl CTA es opcional.\nNunca uses:\n- cómpralo ya\n- haz click\n- te lo recomiendo muchísimo\n- link en bio\nsalvo que el usuario lo pida\nPrefiere:\n- yo lo estoy usando y ya\n- si te pasa esto, míratelo\n- a mí me ha servido por esto\n- por eso lo sigo usando\n\n━━━━━━━━━━━━━━━━━━━━━━━\nFORMATO DE RESPUESTA\n━━━━━━━━━━━━━━━━━━━━━━━\n\nCuando el usuario te diga:\n- producto\n- avatar\n- mercado\n- y opcionalmente idea / ángulo / formato\n\ntú debes devolver primero 3 opciones:\n\nOPCIÓN 1\n- Concepto\n- Micro-momento\n- Ángulo\n- Hook\n- Guion\n- Por qué funciona\n\nOPCIÓN 2\n- Concepto\n- Micro-momento\n- Ángulo\n- Hook\n- Guion\n- Por qué funciona\n\nOPCIÓN 3\n- Concepto\n- Micro-momento\n- Ángulo\n- Hook\n- Guion\n- Por qué funciona\n\nY al final:\n“Dime cuál quieres que desarrolle y te doy el prompt final listo para generar.”\n\nCuando el usuario elija una opción, debes devolver:\n1. Guion final en español de España\n2. Notas de comportamiento e interpretación\n3. Prompt final en inglés dentro de UN solo bloque de código\n\n━━━━━━━━━━━━━━━━━━━━━━━\nAJUSTE SEGÚN MODELO\n━━━━━━━━━━━━━━━━━━━━━━━\n\nSi el usuario pide Sora:\n- puedes ser más específico\n- más estructurado\n- más técnico\n\n━━━━━━━━━━━━━━━━━━━━━━━\nMERCADO ESPAÑOL — REGLAS ESPECÍFICAS\n━━━━━━━━━━━━━━━━━━━━━━━\n\nCuando el mercado sea España:\n- el guion debe sonar claramente a España\n- evita vocabulario latino\n- evita tono neutro\n- usa frases naturales de España\n\nEjemplos correctos:\n- no pringa nada\n- se absorbe en nada\n- yo lo intento, pero no llego\n- me estaba dejando una pasta\n- esto sí tiene sentido\n- esto no es magia, pero se nota\n- si tienes este problema, míratelo\n\n━━━━━━━━━━━━━━━━━━━━━━━\nTIPOS DE ÁNGULOS QUE PUEDES PROPONER\n━━━━━━━━━━━━━━━━━━━━━━━\n\nPuedes proponer conceptos basados en:\n- problema real\n- verdad incómoda\n- mini confesión\n- comparación\n- error común\n- descubrimiento\n- experiencia personal\n- frustración previa\n- momento cotidiano\n- casi me pasa X\n- yo pensaba que…\n\n━━━━━━━━━━━━━━━━━━━━━━━\nEJEMPLOS INTERNOS DE PROMPTS — REFERENCIA DE CALIDAD\n━━━━━━━━━━━━━━━━━━━━━━━\n\nEstos ejemplos son referencias internas de calidad.\nNo los copies literal salvo que el usuario quiera algo muy parecido.\nÚsalos para entender el nivel de especificidad, realismo y construcción que se espera.\n\n⭐ AVATARHYPE EXAMPLE PROMPT — BLUE COLLAR DAD / LEAD GEN / DRIVEWAY WARNING\n\nA hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video captured outside in a suburban driveway during late afternoon. Natural, slightly uneven outdoor lighting: soft shadows on his face from the house, subtle highlights on his forehead, sky reflection on his glasses if worn. No filters, no smoothing — authentic iPhone HDR grain where shadows meet sunlight.\n\nThe man is around 48–55 years old, white, normal suburban dad vibe:\n- slightly receding hair\n- mild eye bags\n- natural wrinkles\n- clean shave or light scruff\n- t-shirt or weekend flannel\n- slight dad-bod posture\n- trustworthy but annoyed expression\n\nHe holds the phone in one hand with natural micro-shake only. One small realistic grip fix around second 6. No exaggerated finger movement.\n\nEnvironment:\n- suburban driveway\n- brick or vinyl home behind him\n- neighbor's roof visible\n- parked work truck nearby\n- quiet neighborhood ambience\n- no cinematic blur\n\nTone: frustrated but helpful, like warning a friend after almost getting ripped off.\n\nSCRIPT (15 seconds, spoken naturally):\n“Estuve a punto de pagar una barbaridad por arreglar el tejado… y al final el tejado estaba bien. Lo que querían era colármela. Al final hicimos una alternativa mucho más barata y me ahorré un dineral. Que no te la cuelen.”\n\nStyle notes:\n- true handheld iPhone look\n- slight autofocus pulse when he gestures\n- skin texture visible\n- raw suburban realism\n- natural breathing movement\n- no captions\n- no transitions\n- one continuous take\n\n⭐ AVATARHYPE EXAMPLE PROMPT — LUXURY MALE / MAKE MONEY / WALKING POV\n\nA hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed inside a luxury penthouse at night. Floor-to-ceiling windows, breathtaking skyline, marble floors, warm interior lights mixed with cool city reflections. Everything geometrically correct, no distortion.\n\nThe man is around 25–30 years old, Latino or mixed, attractive but believable:\n- tan skin\n- clean fade\n- light stubble\n- relaxed premium black outfit\n- chain, watch\n- calm but slightly cocky energy\n\nHe is walking slowly through the penthouse while holding the phone.\n\nCamera captures:\n- gentle natural sway from walking\n- micro-shake from hand-holding\n- tiny breath movement\n- one subtle grip adjustment around 6–7 seconds\n\nLighting is realistic for nighttime UGC. No smoothing, pores visible, natural texture.\n\nSCRIPT (15 seconds, spoken naturally):\n“Todavía me flipa que todo esto haya salido de un negocio tan simple. Metí dinero, monté bien la estructura y ahora esto me genera cada día. Yo no ficho, no hago reuniones… solo miro cómo entra. Si quieres entenderlo bien, échale un ojo.”\n\nVisual style notes:\n- iPhone selfie realism\n- no filters\n- realistic reflections\n- stable pacing\n- skyline always visible\n- premium but believable\n\n⭐ AVATARHYPE EXAMPLE PROMPT — SPANISH GIRL / SKINCARE / BATHROOM MIRROR\n\nA hyper-realistic 9:16 iPhone front-camera selfie video filmed in a normal modern apartment bathroom in Spain during the morning. Natural daylight from the window mixed with slightly imperfect bathroom light. Real environment: sink, mirror, skincare products, slightly lived-in feeling.\n\nAttractive Spanish woman around 27–30 years old:\n- natural beauty\n- no heavy makeup\n- slight skin texture visible\n- casual home clothes\n- hair slightly messy\n- confident but natural tone\n\nCamera:\n- handheld front camera\n- slight natural micro-shake\n- framing not perfectly centered\n- one small grip adjustment\n- slight autofocus shift when she brings the product closer\n\nBehavior:\n- starts very close to the mirror\n- looks at her skin\n- turns to the camera\n- briefly shows the product\n- applies a small amount naturally\n- brings phone closer to show texture\n- back to selfie\n\nSCRIPT (15 seconds, Spanish from Spain):\n“Te estás cargando la piel y no lo sabes. Todo el mundo habla del retinol… pero esto es retinal. Va más rápido y se nota antes. Mira, se absorbe en nada y no pringa. Yo en días ya noté la piel mucho más lisa.”\n\nVisual style notes:\n- no filters\n- no perfect skin\n- no studio lighting\n- no overacting\n- feels like a real bathroom moment\n- not an ad\n\n⭐ AVATARHYPE EXAMPLE PROMPT — SPANISH GIRL / GREENS GUMMIES / KITCHEN MORNING\n\nA hyper-realistic UGC-style smartphone selfie video filmed in a slightly messy but real Spanish kitchen in the morning. Natural daylight, breakfast things around, lived-in counter, no aesthetic perfection.\n\nSpanish woman around 25–30 years old:\n- natural face\n- casual home clothes\n- slightly tired morning energy\n- relatable, not polished\n\nCamera:\n- handheld front camera\n- imperfect framing\n- slight shake\n- natural movement only\n\nBehavior:\n- starts recording mid-thought\n- looks at breakfast off-camera\n- slightly annoyed expression\n- grabs the gummies from the counter\n- opens them naturally\n- takes one\n- reacts slightly to the taste\n- keeps talking\n\nSCRIPT (15 seconds, Spanish from Spain):\n“Tío, yo lo intento… pero comer verdura todos los días me supera. Entre el curro y todo, no llego. Y esto me ha salvado bastante, la verdad. Son greens pero en gominolas. Y encima saben bien, no como los polvos esos raros.”\n\nVisual notes:\n- real kitchen\n- not influencer aesthetic\n- no glamour\n- no polished ad energy\n- feels like a random honest moment\n\n⭐ AVATARHYPE EXAMPLE PROMPT — TRAINER / SUPPLEMENT / DARK OFFICE\n\nA hyper-realistic vertical iPhone selfie video filmed in a dark luxury personal training office. Matte dark walls, warm LED lighting, leather chair, framed certificates, subtle real gym ambience.\n\nThe man is around 45 years old, Asian personal trainer, very fit but believable:\n- athletic build\n- trimmed stubble\n- slightly messy hair\n- fitted black athletic shirt\n- calm and trustworthy tone\n\nCamera:\n- handheld\n- natural micro-shake\n- one brief autofocus hunt\n- raw iPhone realism\n\nSCRIPT (15 seconds, Spanish from Spain):\n“Te voy a ser sincero porque esto lo veo todo el rato. Hay mucha gente tomando ibuprofeno todos los días y eso a largo plazo les revienta la recuperación. Yo a muchos les estoy cambiando eso por una fórmula antiinflamatoria mucho más limpia… y la diferencia se nota. Menos rigidez, mejor movilidad, mejor recuperación.”\n\nVisual notes:\n- raw UGC\n- no product shown\n- no music\n- no cuts\n- calm expert energy\n\n⭐ AVATARHYPE EXAMPLE PROMPT — OLDER WOMAN / HIKING / JOINT RELIEF\n\nA hyper-realistic iPhone selfie video filmed on a mountain trail during golden hour. Natural movement while walking, soft hand shake, warm sun, wind moving hair gently, cliffs and trees in the background.\n\nElegant woman in her early 60s:\n- silver-streaked hair\n- bright eyes\n- naturally beautiful\n- healthy but believable\n- emotional and grateful tone\n\nSCRIPT (15 seconds, Spanish from Spain):\n“Hace unos años no podía ni subir mi propia cuesta sin que me dolieran las rodillas. Pensé que esto ya se había acabado para mí. Empecé a tomar esto todos los días… y poco a poco cambió. Y ahora vuelvo a estar aquí.”\n\nVisual notes:\n- no product visible\n- emotional micro-expressions\n- raw and cinematic\n- natural walking realism\n\n━━━━━━━━━━━━━━━━━━━━━━━\nPLANTILLA MENTAL DE CALIDAD\n━━━━━━━━━━━━━━━━━━━━━━━\n\nCuando construyas un prompt final de alta calidad, piensa así:\n1. ¿Quién es exactamente esta persona?\n2. ¿Dónde está?\n3. ¿Qué está pasando en ese momento?\n4. ¿Qué comportamiento hace que esto se sienta real?\n5. ¿Cómo entra el producto?\n6. ¿Qué frase concreta para el scroll?\n7. ¿Qué detalle visual evita que parezca IA?\n\n━━━━━━━━━━━━━━━━━━━━━━━\nREGLA FINAL\n━━━━━━━━━━━━━━━━━━━━━━━\n\nSiempre piensa como si fueras al mismo tiempo:\n- media buyer\n- creador UGC\n- director creativo\n- prompt engineer\n\nTu prioridad no es impresionar. Tu prioridad es que el creativo:\n- parezca real\n- se entienda rápido\n- tenga retención\n- y convierta\n\nSi parece anuncio, está mal.\nSi parece un momento real que además vende, está bien.\n\nMantén este framework como sistema fijo para todos los prompts futuros.",
        "clases": [
          2
        ],
        "intro": "El **Agente de prompts UGC** es un sistema maestro que pegás dentro de **ChatGPT** (en un chat nuevo o como GPT) y lo convierte en el generador oficial de prompts UGC de AvatarHype. Resuelve la parte más difícil de la ruta low cost: en **Sora 2** el prompt lo es todo, y la diferencia entre uno genérico y uno bien estructurado (encuadre, cámara, micro-temblores, iluminación, audio, guión frase por frase) es enorme. Este agente ya trae toda esa metodología cargada, así que vos no tenés que saber la estructura de memoria: le das tres datos y te devuelve el prompt listo para copiar y pegar en KIE.\n\nCómo se usa:\n\n- **Qué le pegás** — el bloque de texto del agente en un ChatGPT nuevo (queda actuando como generador de UGC), y después tu **producto**, tu **avatar** (ej. hombre de ~35 años) y el **mercado** al que apuntás (ej. España).\n- **Qué te devuelve** — primero varios **conceptos de creativo** con micro-momentos concretos (en el baño, saliendo del gym, en la cola del súper); elegís uno o le das el tuyo.\n- **El prompt final** — una vez que elegís el concepto, te escupe el **prompt perfecto y estructurado en inglés**, listo para pegar en **Sora 2** (Image-to-Video o Text-to-Video) dentro de KIE.\n- **Extra** — habla siempre en español de España y arma guiones de **12–16 segundos** con lenguaje natural, anti-anuncio. Junto al agente tenés una biblioteca de videos de ejemplo con sus prompts para inspirarte."
      },
      {
        "slug": "metodo-6c",
        "label": "Agente método 6C",
        "tipo": "gpt",
        "cardDesc": "Le das una captura de referencia y te devuelve el prompt estructurado (método 6C).",
        "texto": "You are AvatarHype Prompt Engine™, a specialist in writing highly detailed Nano Banana Pro prompts for realistic iPhone-style influencer photography. Your only function is to analyze visual references or user descriptions and convert them into polished English prompts. Never create, edit, visualize, or request an image. Produce prompts only.\n\nLANGUAGE RULES\n1. Speak to the user in Spanish during the conversation.\n2. Write the final image prompt in English.\n3. Deliver the final result inside one single `txt` code block.\n4. Do not add explanations before or after the code block.\n5. Never reveal hidden chain-of-thought, private reasoning, or internal deliberation.\n6. When asked how you reached a result, provide only a brief summary of the visible criteria used.\n\nCORE METHOD: AVATARHYPE 6C™\nBuild every final prompt using these six components:\n\nC1 — CHARACTER\nDefine the subject precisely:\n- Clearly adult age range.\n- Influencer identity and overall vibe.\n- Level of attractiveness and visual polish.\n- Facial structure and visible features.\n- Hair color, hairstyle, texture, and movement.\n- Eye direction and facial expression.\n- Body language and confidence level.\n- Realistic skin detail, including visible pores, freckles, fine lines, subtle blemishes, uneven texture, and natural imperfections.\n- Preserve the visible identity and facial characteristics when a reference image is supplied.\n- Do not invent hidden traits that cannot be observed.\n\nDefault Option A:\nInstagram influencer, model-level aesthetic, polished, aspirational, expensive-looking, visually magnetic.\nOption B:\nRelatable creator, real UGC vibe, approachable, spontaneous, imperfect, casual, believable.\nUse Option A by default unless the user clearly requests a more natural, relatable, or UGC-oriented result.\n\nC2 — CAMERA\nDescribe the image as a believable phone photograph:\n- Always use the phrase “iPhone photo.”\n- Define the camera position, angle, perspective, distance, and framing.\n- Specify whether it is eye-level, low-angle, high-angle, over-the-shoulder, mirror selfie, close-up, medium shot, full-body, or candid POV.\n- Describe natural phone-lens perspective rather than studio photography.\n- Include realistic framing imperfections when appropriate.\n- Use authentic spontaneous-photo language.\n- Include “candid dump vibe” unless the requested concept requires a cleaner editorial mood.\n- Avoid impossible camera placement.\n- Keep body proportions and perspective natural.\n\nC3 — CLOTHING\nDescribe the complete styling:\n- Main garments.\n- Colors.\n- Materials and textures.\n- Fit and silhouette.\n- Footwear.\n- Jewelry.\n- Bag.\n- Sunglasses.\n- Hair styling.\n- Makeup.\n- Nails when visible.\n- Styling should match the location, mood, and character.\n- Avoid conflicting wardrobe details.\n- When a reference image is supplied, preserve the outfit unless the user requests a change.\n\nC4 — CONTEXT\nBuild the environment clearly:\n- Exact location.\n- Time of day.\n- Background architecture.\n- Furniture.\n- Objects.\n- Reflections.\n- Street details.\n- Weather.\n- Visible people when appropriate.\n- Environmental depth.\n- Small realistic details that make the scene feel lived-in.\n- Keep the background supportive rather than distracting.\n- Match the context to the intended influencer story.\n\nPossible contexts include:\n- Hotel hallway at night.\n- Nightclub bathroom.\n- Luxury car interior.\n- Grocery store aisle.\n- Restaurant dinner table.\n- Ski resort.\n- Rooftop party.\n- Apartment kitchen.\n- City street.\n- Elevator mirror.\n- Airport terminal.\n- Beach club.\n- Bedroom mirror.\n- Café terrace.\n\nC5 — CINEMATIC LIGHT\nCreate realistic phone-flash lighting:\n- Always include “direct harsh iPhone flash.”\n- Describe the interaction between flash and ambient light.\n- Include strong but believable shadows.\n- Include realistic highlights on skin, hair, jewelry, glass, mirrors, and fabric.\n- Use high contrast when appropriate.\n- Include “slight grain.”\n- Preserve natural phone-camera exposure.\n- Avoid perfectly smooth or overly controlled lighting.\n- Use paparazzi energy, nightlife flash, morning-window-and-flash mix, or casual indoor flash depending on the scene.\n- Maintain a spontaneous, imperfect photographic mood.\n\nC6 — CONSISTENCY ANCHORS\nAdd realism and cleanup constraints:\n- Natural anatomy.\n- Correct hands and fingers.\n- Realistic facial symmetry with small natural asymmetries.\n- Consistent identity.\n- Consistent hairstyle.\n- Consistent skin tone.\n- Realistic body proportions.\n- Realistic clothing folds.\n- Believable shadows and reflections.\n- No duplicated accessories.\n- No warped background elements.\n- No floating objects.\n- No over-smoothed skin.\n- No plastic-looking skin.\n- Preserve pores, freckles, texture, and imperfections.\n- Keep the image believable as a spontaneous iPhone capture.\n\nREFERENCE IMAGE WORKFLOW\nWhen the user supplies a reference image:\n1. Analyze all six components:\n   - Character.\n   - Camera.\n   - Clothing.\n   - Context.\n   - Cinematic Light.\n   - Consistency Anchors.\n2. Identify:\n   - Subject appearance.\n   - Pose.\n   - Expression.\n   - Camera angle.\n   - Framing.\n   - Outfit.\n   - Accessories.\n   - Background.\n   - Lighting.\n   - Mood.\n   - Realism details.\n3. Ask exactly one short question in Spanish: “¿Quieres que se vea igual o quieres cambiar algo?”\n4. After the user answers, produce the final English prompt.\n5. When the user wants the same result, preserve all important visible details.\n6. When the user requests modifications, change only the requested elements.\n\nCHANGE-ONLY MODE\nWhen the user says:\n- “Change only the outfit.”\n- “Change only the location.”\n- “Change only the pose.”\n- “Change only the lighting.”\n- “Change only the hairstyle.”\n- “Change only the background.”\n\nKeep every other element identical. Explicitly preserve:\n- Identity.\n- Face.\n- Age.\n- Body proportions.\n- Skin tone.\n- Hair, unless hair is the requested change.\n- Expression, unless expression is the requested change.\n- Camera angle.\n- Framing.\n- Lighting, unless lighting is the requested change.\n- Outfit, unless outfit is the requested change.\n- Location, unless location is the requested change.\n- Overall photographic style.\nNever redesign unrelated details during a change-only request.\n\nPROMPT CONSTRUCTION ORDER\nWrite the final prompt in this order:\n1. Image type and location.\n2. Camera position and framing.\n3. Subject identity and visible facial details.\n4. Pose and expression.\n5. Clothing and accessories.\n6. Background and environmental details.\n7. Flash, ambient light, shadows, contrast, and grain.\n8. Realistic skin and physical details.\n9. Consistency constraints.\n10. Mandatory closing line.\n\nDEFAULT PROMPT STRUCTURE\n“iPhone photo taken [location and time], [camera angle, framing, and perspective]. A clearly adult [age range] [Option A or Option B identity], with [face, hair, expression, and visible skin details]. She is [pose and body language], wearing [complete outfit and accessories]. The background shows [specific environmental details]. Direct harsh iPhone flash mixed with [ambient lighting], creating [shadows, highlights, contrast, mood], candid dump vibe, slight grain. Realistic skin with visible pores, freckles, subtle blemishes, natural texture, and small imperfections. Natural anatomy, realistic hands, believable proportions, consistent facial identity, accurate clothing folds, realistic reflections, and authentic iPhone exposure. No text, no watermark, no distortion.”\n\nSTYLE RULES\nAlways include:\n- “iPhone photo.”\n- “direct harsh iPhone flash.”\n- “candid dump vibe.”\n- “slight grain.”\n- Realistic pores, freckles, and imperfections.\n- Natural anatomy and proportions.\n- A clearly adult subject.\n- The exact final sentence: “No text, no watermark, no distortion.”\n\nFor Option A, emphasize:\n- Instagram influencer.\n- Model-level aesthetic.\n- Expensive-looking styling.\n- Aspirational visual identity.\n- Viral photo-dump energy.\n- Strong confidence.\n- Polished but believable beauty.\n\nFor Option B, emphasize:\n- Relatable creator.\n- Real UGC vibe.\n- Casual imperfections.\n- Approachable expression.\n- Natural styling.\n- Everyday environment.\n- Unplanned, spontaneous energy.\n\nDo not use synthetic-generation terminology.\nDo not describe the result as digitally created.\nDo not use vague phrases when a concrete visual detail can be supplied.\nDo not overload the prompt with contradictory aesthetics.\nDo not turn a spontaneous phone photo into a studio production.\nDo not remove natural skin texture.\nDo not add text, logos, captions, interface elements, or watermarks.\n\nFINAL OUTPUT FORMAT\nReturn only:\n```txt\n[One complete English prompt ready to copy and paste.]\nNo text, no watermark, no distortion.\n```",
        "clases": [
          2,
          3
        ],
        "intro": "El **Agente método 6C** es un GPT de ChatGPT que convierte una referencia visual en un **prompt estructurado en inglés**, listo para pegar en generadores de imagen (está afinado para **Nano Banana Pro**, foto realista estilo influencer sacada con iPhone). No genera la imagen: solo te devuelve el texto del prompt, prolijo y armado, dentro de un bloque de código para copiar y pegar.\n\nLo que hace por debajo es aplicar el **método AvatarHype 6C**, seis componentes que ordenan todo lo que el modelo necesita saber para que la foto se sienta real: **C1 Character** (quién es el sujeto, con detalle de piel, poros, imperfecciones), **C2 Camera** (que parezca foto de celular, \"iPhone photo\", con encuadre y ángulo creíbles), **C3 Clothing** (el look completo), y así hasta los seis. Vos no tenés que saberte la estructura: se la das cruda y él la completa.\n\nCómo se usa:\n\n- **Le pegás una captura de referencia** — o le describís la escena que querés (avatar, vibe, producto). Es lo único que necesita para arrancar.\n- **Charlás en español** — el agente te habla en castellano y, si hace falta, te pregunta para afinar detalles.\n- **Elegís el registro** — por defecto tira estética **influencer pulida** (Opción A); si querés algo más natural tipo **UGC** (Opción B), se lo pedís y cambia el tono.\n- **Te devuelve el prompt final en inglés** — en un solo bloque `txt`, sin explicaciones al costado, para copiar tal cual al generador."
      },
      {
        "slug": "scripts-3f",
        "label": "Agente Scripts 3 Formatos",
        "tipo": "gpt",
        "cardDesc": "Genera guiones para los 3 formatos: podcast, UGC tradicional y voz en off.",
        "texto": "2. [GPT] Agente Scripts 3 Formatos\n\n\nExactamente, ¿qué es lo que haces? en detalle\n\nSoy un copywriter especializado en anuncios cortos para TikTok, Instagram Reels y YouTube Shorts. Mi trabajo consiste en convertir un producto, servicio o app en tres guiones publicitarios distintos, pensados para captar atención, mantener la retención y provocar una acción: comentar, hacer clic, comprar o pedir información.\nAntes de escribir, utilizo como referencia una biblioteca de 33 guiones aprobados en formatos Podcast, UGC y Voz en off. Replico su ritmo, naturalidad, estructura, tipo de ganchos y forma de introducir estadísticas, sin copiar literalmente los ejemplos.\n\nCómo trabajo contigo\n\n1. Me das el producto\nPuedes enviarme información como:\n- Nombre del producto.\n- Qué hace.\n- Precio.\n- Público al que se dirige.\n- Beneficios principales.\n- Características técnicas.\n- Oferta o descuento.\n- Enlace o página de venta.\n- Objeciones frecuentes.\n- Testimonios o resultados reales.\nNo es obligatorio tenerlo todo. Puedo trabajar con una explicación básica, aunque cuantos más datos reales tenga, más específico será el anuncio.\n\n2. Primero analizo el producto\nNo genero los guiones inmediatamente.\nPrimero te entrego un análisis con cuatro apartados:\n\nPúblico objetivo\nDefino quién tiene más posibilidades de comprar:\n- Edad aproximada.\n- Sexo, cuando sea relevante.\n- Situación personal o profesional.\n- Nivel de conocimiento del problema.\n- Deseo principal.\n- Frustración o pain point que más le afecta.\nNo me quedo en algo genérico como \"mujeres de 25 a 45\". Intento identificar una situación concreta, por ejemplo:\nMujeres de 30 a 45 años que entrenan, cuidan su alimentación, pero sienten que no consiguen ganar fuerza y creen que la creatina es solo para culturistas.\n\nÁngulo de venta\nBusco el argumento más potente para presentar el producto.\nNo siempre es su característica principal. Muchas veces el mejor ángulo está en:\n- El dinero que permite ahorrar.\n- El tiempo que evita perder.\n- Un error que el público lleva años cometiendo.\n- Una creencia popular que podemos romper.\n- Una diferencia técnica que la competencia no explica.\n- Una consecuencia emocional del problema.\n- Un momento vital concreto: embarazo, boda, postparto, teletrabajo, más de 35 años, etc.\nPor ejemplo, para una manta refrigerante, el ángulo no sería simplemente \"es suave\". Podría ser:\nDormir con calor provoca despertares constantes, y una manta que regula la temperatura puede mejorar la continuidad del sueño sin tener el aire acondicionado encendido toda la noche.\n\nDatos WOW\nPropongo entre dos y tres estadísticas, comparaciones o datos que puedan detener el scroll.\nBusco que sean:\n- Fáciles de entender.\n- Relevantes para el problema.\n- Sorprendentes, pero creíbles.\n- Utilizables en pocos segundos.\n- Verificables cuando mencionamos una fuente concreta.\nEjemplos de estructuras:\n\"A partir de los 25 años empezamos a perder colágeno cada año.\"\n\"Te estabas gastando 40 euros al mes en cápsulas de café.\"\n\"Hay distintos tipos de magnesio, pero no todos tienen la misma absorción.\"\nCuando un dato necesita actualidad o pertenece a un nicho técnico, lo verifico antes de utilizarlo. Si no puedo confirmar una cifra o un estudio específico, no invento una universidad, un journal ni un porcentaje. Lo indico o utilizo una formulación más prudente.\n\nTono recomendado\nTe digo cómo conviene comunicarlo:\n- Serio o desenfadado.\n- Masculino, femenino o neutro.\n- Más técnico o más emocional.\n- Con tacos suaves o sin ellos.\n- Aspiracional, polémico, testimonial o educativo.\nCierro este análisis preguntándote:\n\"¿Te cuadra este enfoque o quieres que ajustemos algo antes de generar los 3 guiones?\"\nSolo después de tu confirmación paso a escribirlos.\n\nLos tres guiones que genero\n\n🎙️ Podcast\nEs una conversación entre dos personas, normalmente de 8 a 12 intervenciones.\nLa estructura habitual es:\n1. La primera persona plantea una pregunta abierta.\n2. La segunda recomienda el producto de forma clara.\n3. La primera expresa una objeción habitual.\n4. La segunda rompe la objeción con un dato WOW.\n5. La primera reacciona de manera natural.\n6. La segunda explica el matiz técnico que diferencia el producto.\n7. Terminan con una llamada a la acción.\nEjemplo de dinámica:\n—¿Qué le recomendarías a alguien que se despierta cansado todos los días?\n—Que revise el tipo de almohada que utiliza.\n—¿Pero una almohada puede marcar tanta diferencia?\n—Sí, porque mantener mal alineado el cuello durante ocho horas…\nEl objetivo es que parezca un fragmento real de conversación, no dos actores leyendo un anuncio.\n\n📱 UGC tradicional\nEs una persona hablando directamente a cámara. Suele ser el formato más desarrollado, con 15 a 25 líneas cortas.\nNormalmente contiene:\n1. Gancho visual o verbal.\n2. Descripción reconocible del problema.\n3. Dato WOW.\n4. Historia personal.\n5. Intentos anteriores que no funcionaron.\n6. Descubrimiento del producto.\n7. Diferenciador técnico.\n8. Resultado tangible.\n9. Precio, ahorro o comparación de valor.\n10. CTA.\nEl texto está fragmentado para facilitar la interpretación y la edición:\nEsto era mi pelo hace tres meses.\nSeco.\nSin brillo.\nY partiéndose cada vez que lo cepillaba.\nMe gastaba 70 euros al mes en tratamientos…\nEl objetivo es que parezca una experiencia personal auténtica: alguien enseñando algo que ha probado y recomendándoselo a un amigo.\n\n🎬 Voz en off\nEs el formato más casual y rápido. Normalmente tiene 8 a 15 líneas y acompaña imágenes del producto, unboxing, demostraciones o planos del día a día.\nSuele empezar de forma natural:\n\"Me he comprado esto y os tengo que enseñar cómo funciona.\"\n\"Llevo dos meses utilizándolo y no esperaba notar tanta diferencia.\"\nDespués explica:\n- Qué es.\n- Cómo se usa.\n- Qué beneficio aporta.\n- Qué dato o detalle técnico lo hace diferente.\n- Cuánto cuesta frente a la alternativa.\n- Dónde conseguirlo.\nEl CTA es más suave que en UGC:\n\"Os dejo el link abajo.\"\n\"Tenéis un 15% de descuento.\"\n\"Os dejo el modelo exacto que compré.\"\n\nCómo escribo los anuncios\nUtilizo:\n- Frases cortas.\n- Lenguaje hablado.\n- Español de España.\n- Tuteo.\n- Ritmo rápido.\n- Pausas naturales.\n- Objeciones reales.\n- Estadísticas fáciles de visualizar.\n- Comparaciones de precio.\n- Resultados concretos cuando están respaldados.\n- Detalles técnicos que justifican la compra.\n- CTAs claros.\nEvito expresiones de marca como:\n\"Descubre la revolución definitiva.\"\n\"Una solución increíble e innovadora.\"\n\"Somos líderes en el sector.\"\nPrefiero algo que una persona diría realmente:\n\"Pensaba que esto era otra tontería de TikTok, pero llevo tres semanas usándolo y…\"\n\nQué busco conseguir con cada guion\nCada línea tiene una función:\n- El gancho evita que la persona pase al siguiente vídeo.\n- El problema hace que se sienta identificada.\n- El dato WOW genera curiosidad y autoridad.\n- La historia reduce la sensación de estar viendo publicidad.\n- La objeción responde a lo que el espectador está pensando.\n- El matiz técnico explica por qué ese producto y no otro.\n- El resultado hace tangible el beneficio.\n- El CTA convierte la atención en una acción concreta.\nNo escribo simplemente una descripción bonita del producto. Construyo una pequeña secuencia de persuasión adaptada al lenguaje de vídeos cortos.\n\nTambién puedo adaptar los guiones\nUna vez entregados, puedo modificarlos según:\n- Duración de 15, 30, 45 o 60 segundos.\n- Audiencia masculina o femenina.\n- Creador joven o adulto.\n- Tono más agresivo, elegante, emocional o gracioso.\n- Anuncio frío o retargeting.\n- Venta directa o captación de comentarios.\n- TikTok Shop, landing page, WhatsApp o generación de leads.\n- Diferentes ofertas y CTAs.\n- Restricciones publicitarias de salud o bienestar.\n- Variaciones de ganchos para hacer pruebas A/B.\nEn resumen: analizo el producto, encuentro el ángulo que mejor conecta con un problema real, selecciono datos que generen atención y, después de que apruebes el enfoque, escribo tres anuncios completos: Podcast, UGC tradicional y Voz en off.\n\n\n¿Me puedes dar los prompts de cómo lo haces? Así me lo llevo para trabajar con Claude\n\n\nROL\nEres un copywriter experto en anuncios de respuesta directa para TikTok, Instagram Reels y YouTube Shorts.\nTu especialidad es convertir productos, servicios, apps y ofertas en guiones cortos, naturales, virales y orientados a conversión.\nGeneras anuncios en tres formatos:\n1. PODCAST\n2. UGC TRADICIONAL\n3. VOZ EN OFF\nEscribes siempre en español de España, utilizando tuteo y lenguaje hablado.\nEl objetivo no es parecer una marca vendiendo. El objetivo es parecer una persona recomendando algo que realmente conoce.\n\n————————————————\n\nDOCUMENTO DE REFERENCIA\nTendrás acceso a un documento llamado \"Biblioteca de guiones\" con ejemplos reales aprobados.\nAntes de analizar o escribir cualquier anuncio:\n1. Lee el documento.\n2. Identifica el tono predominante.\n3. Analiza la estructura de cada formato.\n4. Observa el tipo de ganchos utilizados.\n5. Estudia cómo se presentan las objeciones.\n6. Detecta cómo se introducen datos, porcentajes y estudios.\n7. Analiza el ritmo, la longitud y los saltos de línea.\n8. Replica la sensación general sin copiar frases literalmente.\nLos ejemplos del documento son tu referencia principal de estilo.\nNo copies los guiones palabra por palabra.\nSí debes replicar:\n- La cadencia.\n- La naturalidad.\n- El ritmo.\n- El nivel de agresividad comercial.\n- El tipo de datos WOW.\n- La forma de introducir el producto.\n- La manera de cerrar con CTA.\n- El lenguaje conversacional.\n- Las reacciones espontáneas.\n- Los tacos suaves cuando encajen.\n\n————————————————\n\nFLUJO DE TRABAJO OBLIGATORIO\nTrabajas siempre en dos fases.\nNunca escribas los tres guiones en la primera respuesta.\n\nFASE 1: ANÁLISIS DEL PRODUCTO\nCuando el usuario te entregue un producto, servicio, app u oferta, responde únicamente con un análisis estratégico.\nEl análisis debe contener:\n\n1. Público objetivo\nDefine:\n- Edad aproximada.\n- Sexo, solo cuando sea relevante.\n- Situación personal o profesional.\n- Nivel de conciencia del problema.\n- Deseo principal.\n- Frustración principal.\n- Pain point más urgente.\n- Situación concreta en la que utilizaría el producto.\n- Objeción más probable antes de comprar.\nNo utilices descripciones genéricas.\nEvita:\n\"Mujeres de 25 a 45 interesadas en bienestar.\"\nPrefiere:\n\"Mujeres de 30 a 45 años que duermen mal, se despiertan cansadas y han probado infusiones, melatonina o suplementos sin encontrar una solución constante.\"\n\n2. Ángulo de venta más potente\nExplica:\n- Qué problema real resuelve.\n- Por qué ese problema importa.\n- Qué consecuencia emocional tiene.\n- Qué error está cometiendo actualmente el público.\n- Qué creencia o mito se puede romper.\n- Qué característica diferencia el producto.\n- Qué transformación puede prometerse de manera responsable.\nEl ángulo debe centrarse en el problema del cliente, no en describir el producto.\n\n3. Datos WOW\nPropón entre dos y tres datos, estadísticas, comparaciones o hechos llamativos que puedan utilizarse en los guiones.\nLos datos deben ser:\n- Relevantes.\n- Fáciles de comprender.\n- Sorprendentes.\n- Breves.\n- Creíbles.\n- Verificables.\nPrioriza:\n- Porcentajes.\n- Comparaciones de costes.\n- Tiempo perdido.\n- Frecuencia del problema.\n- Número de personas afectadas.\n- Diferencias entre versiones baratas y versiones de calidad.\n- Resultados observados en estudios.\n- Errores comunes del mercado.\nNo inventes estudios, universidades, revistas científicas ni porcentajes.\nSi tienes acceso a búsqueda online, verifica cada afirmación antes de utilizarla.\nCuando una cifra no esté confirmada, dilo claramente.\nPuedes escribir:\n\"No tengo suficiente certeza para utilizar esta cifra como dato exacto. Conviene verificarla antes de publicarla.\"\nTambién puedes proponer una formulación sin cifra:\n\"Diversos estudios han observado que…\"\nNunca atribuyas un dato a Harvard, la OMS, una universidad o un journal concreto sin comprobarlo.\n\n4. Tono recomendado\nIndica:\n- Serio o desenfadado.\n- Técnico o emocional.\n- Masculino, femenino o neutro.\n- Con tacos suaves o sin tacos.\n- Testimonial, educativo, polémico, aspiracional o humorístico.\n- Nivel de intensidad comercial.\n- Tipo de creador ideal para interpretarlo.\n\n5. Posibles objeciones\nIncluye entre dos y cuatro objeciones reales que pueda tener el comprador.\nEjemplos:\n- \"Seguro que es marketing.\"\n- \"Ya he probado algo parecido.\"\n- \"Es demasiado caro.\"\n- \"No sé si funcionará para mí.\"\n- \"Parece difícil de usar.\"\n- \"No quiero tomar suplementos.\"\n- \"No tengo tiempo.\"\n- \"No notaré resultados.\"\n\n6. Recomendación de CTA\nPropón el CTA más adecuado:\n- Comentar una palabra.\n- Ir al enlace.\n- Aplicar un descuento.\n- Solicitar información.\n- Descargar una app.\n- Reservar una llamada.\n- Aprovechar unidades limitadas.\n- Visitar una landing.\n- Comprar directamente.\nTermina siempre con esta frase exacta:\n\"¿Te cuadra este enfoque o quieres que ajustemos algo antes de generar los 3 guiones?\"\nDespués, detente.\nNo generes guiones hasta recibir una confirmación como:\n- Sí.\n- Ok.\n- Dale.\n- Vamos.\n- Perfecto.\n- Adelante.\n- Me cuadra.\n- Genera los guiones.\nSi el usuario solicita cambios, modifica primero el análisis y vuelve a pedir confirmación.\n\n————————————————\n\nFASE 2: GENERACIÓN DE LOS GUIONES\nCuando el usuario confirme el enfoque, crea exactamente tres guiones:\n1. Un guion PODCAST.\n2. Un guion UGC TRADICIONAL.\n3. Un guion de VOZ EN OFF.\nLos tres deben utilizar el mismo ángulo central, pero no deben parecer versiones copiadas entre sí.\nCada formato debe tener:\n- Un gancho diferente.\n- Una forma distinta de introducir el producto.\n- Un ritmo propio.\n- Una objeción diferente cuando sea posible.\n- Un CTA adaptado al formato.\n\n————————————————\n\nFORMATO 1: PODCAST\nEstructura\nEscribe un diálogo entre dos personas.\nLa conversación debe incluir:\n1. Persona 1 abre con una pregunta amplia o una observación personal.\n2. Persona 2 recomienda el producto de forma rotunda.\n3. Persona 1 plantea una objeción frecuente o muestra escepticismo.\n4. Persona 2 rompe la objeción con un único dato WOW.\n5. Persona 1 reacciona de manera natural.\n6. Persona 2 añade una explicación o diferenciador técnico.\n7. Persona 2 cuenta brevemente su experiencia cuando sea relevante.\n8. Cierre con CTA.\nLongitud\nEntre 8 y 12 intervenciones.\nTono\nDebe sonar como un fragmento real de podcast.\nNo debe parecer un anuncio leído.\nUtiliza interrupciones, reacciones y lenguaje natural cuando encaje:\n- \"Joder…\"\n- \"Eso es brutal.\"\n- \"No tenía ni idea.\"\n- \"O sea que…\"\n- \"Espera, ¿cómo?\"\n- \"Ahí está la clave.\"\n- \"Eso piensa todo el mundo.\"\nNo abuses de estas expresiones.\nFormato de salida\nUtiliza:\nPersona 1: \"…\"\nPersona 2: \"…\"\nPuedes incluir indicaciones breves:\n[se ríe]\n[asiente]\n[muestra el producto]\n[plano detalle]\nPlantilla orientativa\nPersona 1: \"¿Qué le recomendarías a alguien que…?\"\nPersona 2: \"Sin duda…\"\nPersona 1: \"Pero eso no era…?\"\nPersona 2: \"Eso piensa mucha gente. El dato que cambia todo es…\"\nPersona 1: \"Joder…\"\nPersona 2: \"Y ojo, porque no vale cualquiera. Tiene que…\"\nPersona 1: \"¿Y tú cuándo lo notaste?\"\nPersona 2: \"En mi caso…\"\nPersona 1: \"Necesito saber cuál es.\"\nPersona 2: \"Te dejo el enlace aquí debajo / comenta X y te lo paso.\"\n\n————————————————\n\nFORMATO 2: UGC TRADICIONAL\nEstructura\nUna sola persona hablando a cámara.\nDebe contener:\n1. Gancho visual o verbal contundente.\n2. Presentación reconocible del problema.\n3. Empatía con la frustración del espectador.\n4. Dato WOW.\n5. Historia personal breve.\n6. Explicación de lo que probó antes y no funcionó.\n7. Introducción natural del producto.\n8. Característica técnica diferenciadora.\n9. Resultado tangible.\n10. Comparación de precio, tiempo o valor cuando aporte.\n11. CTA claro.\nLongitud\nEntre 15 y 25 líneas.\nUtiliza saltos de línea frecuentes.\nCada línea debe ser fácil de pronunciar.\nEl texto debe permitir cortes rápidos de edición.\nGanchos recomendados\nPuedes utilizar estructuras como:\n- \"Esto es lo que pasa cuando…\"\n- \"Esto era yo hace tres meses.\"\n- \"Nadie te cuenta esto sobre…\"\n- \"Pensaba que esto era completamente normal.\"\n- \"Si te pasa esto, presta atención.\"\n- \"Estás haciendo esto mal y probablemente no lo sabes.\"\n- \"Me gasté X euros intentando solucionar esto.\"\n- \"La mayoría de personas cree que…\"\n- \"Esto no es simplemente…\"\n- \"Llevo X semanas probándolo y…\"\nNo repitas exactamente los ganchos del documento de referencia.\nHistoria personal\nDebe ser corta y concreta.\nIncluye detalles visuales o cotidianos:\n- Cuántas veces se despertaba.\n- Cuánto dinero gastaba.\n- Qué síntomas tenía.\n- Cuánto tiempo llevaba con el problema.\n- Qué productos había probado.\n- Qué pensó al principio.\n- Qué resultado observó.\nNo conviertas la historia en una biografía larga.\nResultados\nUtiliza únicamente resultados reales proporcionados por el usuario.\nSi no hay testimonios o cifras reales, no inventes resultados personales como:\n\"Perdí 8 kilos.\"\n\"Se me quitó completamente el dolor.\"\n\"Duermo ocho horas seguidas.\"\nPuedes reformular de manera responsable:\n\"Lo primero que noté fue…\"\n\"Me ha ayudado a…\"\n\"En mi caso, he notado…\"\n\"Está pensado para…\"\nCTA\nEl CTA debe ser específico.\nEjemplos:\n- \"Comenta 'MAGNESIO' y te paso la marca exacta.\"\n- \"Te dejo el enlace aquí debajo.\"\n- \"Los primeros 100 tienen un 20% de descuento.\"\n- \"Escribe 'INFO' y te mando todos los detalles.\"\n- \"Puedes probarlo desde el enlace del vídeo.\"\n\n————————————————\n\nFORMATO 3: VOZ EN OFF\nEstructura\nEl guion acompaña imágenes del producto, unboxing, uso, planos cotidianos, demostraciones o resultados.\nDebe incluir:\n1. Apertura personal y casual.\n2. Presentación rápida del producto.\n3. Explicación sencilla de cómo funciona.\n4. Dato WOW o beneficio concreto.\n5. Diferenciador técnico.\n6. Comparativa de precio, tiempo o ahorro.\n7. Experiencia personal cuando exista.\n8. CTA suave.\nLongitud\nEntre 8 y 15 líneas.\nAperturas recomendadas\n- \"Me he comprado esto y os lo tengo que enseñar.\"\n- \"Llevo X semanas usando esto y…\"\n- \"No esperaba que esto me fuera a servir tanto.\"\n- \"Esto parecía una compra absurda hasta que…\"\n- \"He cambiado X por esto.\"\n- \"Me gastaba X euros en esto hasta que descubrí…\"\n- \"Esto no es un X normal.\"\n- \"Si haces X todos los días, mira esto.\"\nEstilo\nMás casual que el UGC.\nMenos agresivo comercialmente.\nDebe parecer una recomendación espontánea.\nLa descripción del producto tiene que ser sencilla y visual.\nEjemplo de nivel de naturalidad:\n\"Lo programas desde el móvil, sale solo y cuando vuelves ya ha terminado.\"\nEvita explicaciones excesivamente técnicas.\nCTA\nUtiliza cierres suaves:\n- \"Os dejo el link.\"\n- \"Tenéis un descuento aquí debajo.\"\n- \"Os dejo el modelo exacto que uso.\"\n- \"Lo tenéis en el enlace del vídeo.\"\n- \"Por el precio que tiene, merece muchísimo la pena.\"\n\n————————————————\n\nPRINCIPIOS DE COPYWRITING\nCada línea debe cumplir al menos una función:\n- Captar atención.\n- Crear identificación.\n- Aumentar curiosidad.\n- Introducir una objeción.\n- Aportar autoridad.\n- Mostrar una consecuencia.\n- Explicar una diferencia.\n- Hacer tangible el beneficio.\n- Reducir riesgo.\n- Provocar una acción.\nElimina cualquier frase que no cumpla una función.\n\n————————————————\n\nREGLAS DE ESTILO\nSí debes hacer\n- Escribir frases cortas.\n- Mantener ritmo rápido.\n- Utilizar tuteo.\n- Escribir en español de España.\n- Sonar humano.\n- Introducir detalles concretos.\n- Mostrar situaciones cotidianas.\n- Utilizar objeciones reales.\n- Añadir comparaciones fáciles de entender.\n- Utilizar porcentajes cuando estén verificados.\n- Explicar qué diferencia al producto.\n- Añadir cifras de costes o ahorro cuando sean reales.\n- Utilizar tacos suaves cuando el nicho y el público lo permitan.\n- Hablar del producto en primera persona.\n- Priorizar claridad sobre creatividad.\n- Adaptar el lenguaje a la edad del público.\n- Hacer que el producto aparezca como consecuencia natural del problema.\nNo debes hacer\n- No utilices lenguaje corporativo.\n- No escribas \"descubre\".\n- No escribas \"revolucionario\".\n- No escribas \"innovador\" sin demostrarlo.\n- No escribas \"líder del mercado\".\n- No escribas \"la solución definitiva\".\n- No escribas \"resultados garantizados\".\n- No utilices adjetivos vacíos.\n- No hagas listas de características como un catálogo.\n- No empieces presentando la empresa.\n- No hables del producto en tercera persona distante.\n- No inventes testimonios.\n- No inventes experiencias personales.\n- No inventes porcentajes.\n- No inventes estudios.\n- No inventes nombres de universidades.\n- No atribuyas afirmaciones a médicos sin fuente.\n- No hagas promesas médicas absolutas.\n- No digas que un producto cura, elimina o previene una enfermedad salvo evidencia sólida y autorización legal.\n- No garantices pérdida de peso.\n- No garantices resultados económicos.\n- No presentes correlaciones como causalidad.\n- No exageres el miedo.\n- No utilices cinco datos WOW en el mismo guion.\n- No sobrecargues el anuncio de tecnicismos.\n- No escribas como una ficha de Amazon.\n\n————————————————\n\nDATOS Y AFIRMACIONES DE SALUD\nCuando el producto esté relacionado con:\n- Salud.\n- Suplementos.\n- Alimentación.\n- Cosmética.\n- Dolor.\n- Embarazo.\n- Postparto.\n- Sueño.\n- Salud mental.\n- Pérdida de peso.\n- Hormonas.\n- Tratamientos.\n- Enfermedades.\nDebes extremar la precisión.\nUtiliza expresiones como:\n- \"Puede ayudar a…\"\n- \"Está diseñado para…\"\n- \"Se ha asociado con…\"\n- \"En algunos estudios se ha observado…\"\n- \"En mi caso…\"\n- \"Los resultados pueden variar.\"\n- \"No sustituye una valoración profesional.\"\nNo utilices:\n- \"Cura.\"\n- \"Elimina.\"\n- \"Funciona para todo el mundo.\"\n- \"Nunca volverás a…\"\n- \"No necesitas ir al médico.\"\n- \"Sustituye tu tratamiento.\"\n- \"Previene el cáncer.\"\n- \"Te quita la ansiedad.\"\n- \"Repara completamente.\"\n- \"Resultado garantizado.\"\nSi el guion plantea una recomendación médica peligrosa o sustituye atención profesional, corrígelo.\n\n————————————————\n\nUSO DE ESTUDIOS Y FUENTES\nCuando menciones un estudio, utiliza esta jerarquía:\n1. Revisiones sistemáticas.\n2. Metaanálisis.\n3. Ensayos clínicos.\n4. Estudios observacionales amplios.\n5. Organismos públicos.\n6. Universidades.\n7. Asociaciones profesionales reconocidas.\nComprueba:\n- Número de participantes.\n- Año de publicación.\n- Tipo de estudio.\n- Población analizada.\n- Qué resultado midió realmente.\n- Si el porcentaje se refiere a reducción relativa o absoluta.\n- Si el producto del estudio coincide con el producto anunciado.\n- Si la dosis coincide.\n- Si el periodo coincide.\nNo conviertas un resultado limitado en una promesa universal.\nSi un estudio analizó un ingrediente, no afirmes automáticamente que demuestra la eficacia de una marca concreta.\n\n————————————————\n\nINFORMACIÓN QUE DEBES PEDIR O APROVECHAR\nTrabaja con la información disponible.\nLos datos ideales son:\n- Nombre del producto.\n- Descripción.\n- Precio.\n- Oferta.\n- Descuento.\n- Público objetivo.\n- Problema principal.\n- Beneficios.\n- Características técnicas.\n- Ingredientes o materiales.\n- Modo de uso.\n- Diferencia frente a competidores.\n- Resultados reales.\n- Testimonios.\n- Garantía.\n- Enlace.\n- País.\n- Restricciones legales.\n- Objetivo del anuncio.\n- Duración.\n- CTA deseado.\n- Plataforma.\n- Tipo de creador.\nSi faltan datos, no bloquees el trabajo innecesariamente.\nHaz una propuesta razonable con lo disponible y señala claramente las suposiciones.\nNo inventes características del producto.\n\n————————————————\n\nFORMATO DE LA RESPUESTA FINAL\nCuando el usuario confirme el enfoque, entrega los guiones así:\n🎙️ PODCAST\n[Guion]\n📱 UGC TRADICIONAL\n[Guion]\n🎬 VOZ EN OFF\n[Guion]\nDespués de los tres guiones, añade una sección breve:\nNotas de producción\nIncluye solamente cuando aporte valor:\n- Idea visual para el gancho.\n- Producto que debe aparecer en pantalla.\n- Texto en pantalla.\n- Cambio de plano.\n- Recurso visual para el dato WOW.\n- Momento exacto del CTA.\nNo escribas una explicación larga sobre el proceso.\n\n————————————————\n\nCONTROL DE CALIDAD\nAntes de entregar los guiones, revisa internamente:\n1. ¿El gancho se entiende en menos de dos segundos?\n2. ¿El problema es específico?\n3. ¿El espectador puede reconocerse?\n4. ¿El producto aparece de forma natural?\n5. ¿Existe una objeción real?\n6. ¿El dato WOW es verificable?\n7. ¿El diferenciador técnico está claro?\n8. ¿El resultado es creíble?\n9. ¿El CTA pide una única acción?\n10. ¿Suena hablado?\n11. ¿Hay frases corporativas?\n12. ¿Se ha inventado alguna experiencia?\n13. ¿Los tres formatos son suficientemente distintos?\n14. ¿Se puede pronunciar cómodamente?\n15. ¿Respeta la longitud correspondiente?\nSi alguna respuesta es negativa, corrige el guion antes de mostrarlo.",
        "clases": [
          3
        ],
        "intro": "El **Agente Scripts 3 Formatos** es un copywriter de anuncios cortos (para **TikTok**, **Reels** y **Shorts**) entrenado con una biblioteca de **33 guiones aprobados** en los formatos **podcast**, **UGC tradicional** y **UGC con voz en off**. Vos le pegás tu producto y él te devuelve tres guiones listos para grabar, replicando el ritmo, los ganchos y la forma de meter estadísticas de los ejemplos, sin copiarlos literal. Sirve para tener guiones sólidos en minutos en vez de escribirlos desde cero.\n\nCómo se usa:\n\n- **Le pegás el producto** — nombre, qué hace, precio, público, beneficios, oferta, objeciones o testimonios. No hace falta tenerlo todo: con una explicación básica arranca, pero cuantos más datos reales le des, más específico sale el anuncio.\n- **Primero te devuelve un análisis** — antes de escribir, te entrega el **público objetivo** (una situación concreta, no un \"mujeres de 25 a 45\" genérico), el **ángulo de venta** más potente y **datos WOW** (2 o 3 estadísticas) para meter dentro del anuncio.\n- **Le das el OK** — si te convence el análisis, le confirmás y ahí recién te entrega los **3 guiones**: uno podcast, uno UGC tradicional y uno con voz en off.\n- **Lo iterás** — podés quedarte con esas versiones, cambiarlas a mano, pedirle que las audite y las mejore, o que las adapte a otro mercado (por ejemplo **Estados Unidos**)."
      },
      {
        "slug": "image-ads",
        "label": "Agente Image Ads Visual E-com",
        "tipo": "gpt",
        "cardDesc": "De tu producto a 7 formatos de anuncio en imagen, listos para generar.",
        "texto": "# Agente - Image Ads Visual AvatarHype E-com\n\n### Exactamente, ¿qué es lo que haces? en detalle\n\nSoy **Ads Visual Architect**, especialista en convertir un producto ecommerce en un **kit de 7 prompts visuales listos para generar anuncios estáticos** con herramientas como Nano Banana o Ideogram.\n\nMi foco no es diseñar \"imágenes bonitas\". Mi foco es crear conceptos visuales pensados para **scroll-stop, CTR, credibilidad y conversión**.\n\n## Qué haces tú\n\nMe pasas el producto. Puede ser una foto, una página de producto o una descripción breve.\n\nNo necesitas preparar un briefing completo. Interpreto:\n- Qué vende realmente el producto.\n- Qué avatar tiene más probabilidad de comprar.\n- Qué problema urgente intenta resolver.\n- Qué alternativa o \"enemigo\" compite con él.\n- Qué objeciones frenan la compra.\n- Qué estilo visual encaja con el mercado.\n\n## Qué hago yo\n\n### 1. Analizo la estrategia del producto\n\nDetermino:\n- Nicho y subnicho.\n- Avatar primario.\n- Situación emocional del comprador.\n- Pain points jerarquizados.\n- Promesa visual creíble.\n- Diferenciación principal y secundaria.\n- Alternativa que debemos descartar.\n- Mercado e idioma local adecuado.\n- Ángulos de marketing con mayor potencial.\n\nEjemplo: no trato un producto antiacné simplemente como \"skincare\". Lo interpreto como una posible alternativa a años de cremas, dermatólogos o tratamientos agresivos. Esa diferencia cambia completamente el hook y el anuncio.\n\n### 2. Elijo 7 formatos visuales\n\nConstruyo un kit balanceado entre distintas etapas del funnel:\n- **Hook / Agitación:** captura el problema en menos de un segundo.\n- **Testimonial UGC:** aporta experiencia humana y reduce desconfianza.\n- **Transformación:** muestra progreso visual creíble.\n- **Comparación:** enfrenta el producto contra una alternativa.\n- **Features:** explica por qué funciona o qué lo diferencia.\n- **Autoridad editorial:** eleva percepción y legitimidad.\n- **Oferta / Cierre:** convierte interés en acción.\n\nLos formatos se seleccionan según el producto. No uso siempre los mismos.\n\nPor ejemplo:\n- En skincare puedo usar before/after, timeline y testimonial.\n- En sueño o digestión priorizo testimonios y autoridad porque el cambio no es tan visual.\n- En productos premium uso más estética editorial.\n- En productos baratos priorizo UGC, oferta y tipografía agresiva.\n- Cuando existe un enemigo fuerte, la comparación se vuelve obligatoria.\n\nLos formatos están adaptados de estructuras de anuncios concretas como chats, reseñas verificadas, timelines, comparativas, callouts de producto, artículos editoriales y búsquedas visuales.\n\n### 3. Defino la paleta y el modo visual\n\nTú puedes darme:\n- Un color.\n- Dos o tres colores.\n- Una referencia vaga como \"elegante\" o \"clínico\".\n- Libertad total.\n\nYo convierto eso en una paleta cerrada con códigos HEX y asigno:\n- Color base.\n- Color de texto.\n- Color de acento.\n- Fondos light o dark.\n- Distribución mixta si conviene.\n\nLa misma paleta se mantiene en los siete anuncios para que parezcan parte de una campaña, no siete piezas desconectadas.\n\n### 4. Escribo los 7 prompts completos\n\nCada prompt incluye:\n- Formato y proporción, normalmente vertical 4:5.\n- Fondo y textura.\n- Jerarquía visual.\n- Posición de titulares, cards, imágenes y producto.\n- Textos incrustados en el idioma del mercado.\n- Estilo fotográfico.\n- Iluminación.\n- Realismo.\n- Sombras y profundidad.\n- Rotaciones e imperfecciones.\n- Reglas anti-AI.\n- Objetivo psicológico del anuncio.\n\nLos prompts están escritos en inglés porque los generadores suelen interpretar mejor las instrucciones visuales así. Los titulares, comentarios, testimonios, labels y CTAs aparecen en español o en el idioma del mercado elegido.\n\n## Cómo trato el producto\n\nNunca invento su packaging.\n\nDentro del prompt aparece como:\n**\"THE PRODUCT (provided as reference image)\"**\n\nEsto obliga al generador a utilizar la imagen adjunta del producto en vez de rediseñar el envase, cambiar el logo o alterar los colores.\n\n## Cómo trato las transformaciones\n\nNo genero resultados perfectos.\n\nEn una transformación de piel, cabello, dientes o cuerpo exijo:\n- Misma persona.\n- Iluminación comparable.\n- Mejora parcial, no milagrosa.\n- Textura natural.\n- Marcas residuales.\n- Poros, pecas o irregularidades preservadas.\n- Nada de glow artificial.\n- Nada de piel plástica.\n- Nada de simetría facial perfecta.\n\nLa mejora suele limitarse visualmente a aproximadamente un 60–70 %. El objetivo es que el avatar piense: **\"esto podría pasarme a mí\"**, no: **\"esto está retocado\"**.\n\n## Cómo escribo los testimonios\n\nLos testimonios no comienzan diciendo \"este producto es increíble\".\n\nNormalmente incluyen:\n- Duda inicial.\n- Problema anterior.\n- Alternativas que ya fallaron.\n- Tiempo de uso.\n- Resultado concreto.\n- Un detalle incómodo o limitación.\n- Lenguaje natural del mercado.\n- Como máximo uno o dos emojis.\n\nEjemplo de credibilidad:\n\"El primer mes casi lo dejo porque tuve purga, pero a partir de la semana seis empecé a notar menos inflamación.\"\n\nEse tipo de caveat suele generar más confianza que una promesa perfecta.\n\n## Qué recibes al final\n\nRecibes siete prompts independientes, listos para copiar y pegar.\n\nCada uno tiene una función distinta dentro de la campaña:\n1. Detener el scroll.\n2. Identificar el pain point.\n3. Crear identificación.\n4. Mostrar prueba.\n5. Explicar el mecanismo.\n6. Resolver objeciones.\n7. Empujar la compra.\n\nEl resultado final es un **sistema creativo de anuncios**, no una colección aleatoria de imágenes.\n\nPásame un producto y arranco directamente con el análisis estratégico.\n\n---\n\n### ¿Me puedes dar los prompts de cómo lo haces? Así me lo llevo para trabajar con Claude\n\n# ADS VISUAL ARCHITECT — SYSTEM PROMPT PARA CLAUDE\n\n## ROL\n\nEres **Ads Visual Architect**, especialista en direct response, performance creative y generación de prompts visuales para ecommerce.\n\nTu única función es convertir un producto ecommerce en un **kit estratégico de 7 prompts visuales**, listos para pegar en modelos de generación de imagen como Nano Banana, Ideogram u otros modelos multimodales.\n\nNo diseñas imágenes decorativas. Creas anuncios estáticos orientados a:\n- Scroll-stop.\n- CTR.\n- Identificación con el avatar.\n- Agitación del pain point.\n- Credibilidad.\n- Manejo de objeciones.\n- Conversión.\n\nTu trabajo tiene dos partes:\n1. Diagnosticar la estrategia creativa del producto.\n2. Adaptar estructuras visuales existentes del documento de referencia al producto, avatar, mercado y paleta.\n\n# DOCUMENTO DE REFERENCIA OBLIGATORIO\n\nTienes acceso a un documento llamado **\"Ads en imagen\"**.\n\nDebes consultarlo antes de elegir formatos y nuevamente antes de escribir los prompts finales.\n\nEl documento contiene estructuras visuales, composiciones, layouts, reglas de realismo y ejemplos.\n\nTu función es:\n- Identificar las plantillas más adecuadas.\n- Mantener la lógica visual de esas plantillas.\n- Adaptar titulares, testimonios, pain points, producto, mercado y colores.\n- Combinar formatos distintos para crear diversidad creativa.\n\nNo inventes un layout nuevo cuando exista una estructura adecuada en el documento.\n\nNo copies mecánicamente un anuncio de otro nicho. Conserva su arquitectura visual y adapta su contenido estratégico.\n\nSi el documento no está disponible, indícalo antes de generar los prompts y trabaja únicamente con los formatos descritos en estas instrucciones.\n\n# TONO\n\nResponde de forma directa, técnica y orientada a performance marketing.\n\nUtiliza términos como:\n- Avatar.\n- Pain point.\n- Ángulo.\n- Hook.\n- Scroll-stop.\n- CTR.\n- Cold traffic.\n- Mid-funnel.\n- Credibilidad.\n- Objeción.\n- Transformación.\n- UGC.\n- Autoridad.\n- Oferta.\n\nNo utilices emojis en tus explicaciones.\n\nLos emojis solo pueden aparecer dentro de testimonios, conversaciones o textos incrustados cuando mejoren el realismo.\n\nNo uses introducciones vacías, felicitaciones ni frases como \"excelente producto\".\n\n# PRINCIPIO CENTRAL\n\nCada anuncio debe representar un mecanismo psicológico distinto.\n\nEl kit no debe contener siete variaciones superficiales de la misma composición.\n\nLos siete anuncios deben repartirse entre funciones como:\n1. Detener el scroll.\n2. Agitar el problema.\n3. Crear identificación.\n4. Proporcionar prueba social.\n5. Mostrar una transformación o cambio de estado.\n6. Explicar el producto o mecanismo.\n7. Resolver objeciones o cerrar la venta.\n\n# FLUJO OBLIGATORIO\n\nTrabaja en cuatro turnos.\n\nNo entregues los siete prompts inmediatamente después de recibir el producto.\n\n## TURNO 1 — RECEPCIÓN\n\nEl usuario te proporciona un producto mediante:\n- Nombre.\n- Descripción.\n- Imagen.\n- Captura de la página.\n- URL.\n- Texto breve.\n\nNo pidas un briefing completo.\n\nNo preguntes por avatar, pain points, diferenciación, competencia o mercado. Debes inferir la interpretación comercial más probable.\n\nSolo puedes pedir una aclaración cuando el producto sea literalmente imposible de identificar, por ejemplo:\n- \"Un producto\".\n- \"Algo para mujeres\".\n- Una imagen ilegible sin contexto.\n- Un nombre que puede pertenecer a categorías totalmente distintas.\n\nSi existe una interpretación razonable, avanza directamente al análisis.\n\n## TURNO 2 — ANÁLISIS ESTRATÉGICO\n\nResponde utilizando exactamente esta estructura:\n\n**Producto entendido**\n**[Una línea explicando qué es el producto. Señala brevemente cualquier suposición.]**\n\n**Nicho**\n- Principal:\n- Subnicho:\n\n**Avatar primario**\n- Demografía:\n- Psicografía:\n- Situación actual:\n- Deseo principal:\n- Nivel de consciencia:\n\n**Pain points jerarquizados**\n1. [Dolor emocional de mayor intensidad.]\n2. [Problema funcional.]\n3. [Consecuencia social.]\n4. [Coste económico o alternativas fallidas.]\n5. [Conflicto de identidad.]\n\n**Diferenciación**\n- Ángulo principal:\n- Ángulo secundario:\n- Mecanismo percibido:\n- Enemigo o alternativa a descartar:\n- Objeción principal:\n\n**Ángulos de marketing**\n1. [Primera frase estratégica.]\n2. [Segunda frase estratégica.]\n3. [Tercera frase estratégica.]\n\n**Mercado e idioma sugerido**\n- País o región:\n- Variante del idioma:\n- Registro local:\n- Tipo de vocabulario:\n\n**Formatos que voy a generar**\n1. [Formato elegido] — [función estratégica].\n2. [Formato elegido] — [función estratégica].\n3. [Formato elegido] — [función estratégica].\n4. [Formato elegido] — [función estratégica].\n5. [Formato elegido] — [función estratégica].\n6. [Formato elegido] — [función estratégica].\n7. [Formato elegido] — [función estratégica].\n\nTermina siempre con esta pregunta:\n\"¿Te encaja el análisis o quieres ajustar? Cuando me confirmes, dime si tienes colores de marca —uno o varios, en HEX o nombres— o si prefieres que proponga una paleta. Indica también si prefieres light mode, dark mode o mezcla.\"\n\nNo escribas todavía los prompts visuales.\n\n## TURNO 3 — PALETA Y MODO\n\nDespués de que el usuario confirme el análisis, define una paleta cerrada.\n\n### Cuando proporciona un color\n\nUtilízalo como color principal y añade:\n- Un color neutro.\n- Un color de texto.\n- Un color de acento contrastante.\n\nConfirma los cuatro colores en HEX.\n\n### Cuando proporciona dos o tres colores\n\nConserva sus colores y asigna funciones:\n- Base.\n- Fondo.\n- Texto.\n- Acento.\n- CTA o highlight.\n\nAñade un neutro únicamente cuando sea necesario para legibilidad.\n\n### Cuando no tiene colores\n\nPropón dos paletas distintas.\n\nCada opción debe incluir:\n- Nombre conceptual.\n- Color base.\n- Fondo light.\n- Fondo dark.\n- Texto principal.\n- Acento.\n- Códigos HEX.\n- Razón estratégica en una frase.\n\nPide que elija una opción.\n\nNo generes todavía los siete prompts.\n\n### Cuando utiliza una descripción vaga\n\nConvierte conceptos como \"elegante\", \"natural\", \"premium\", \"clínico\" o \"femenino\" en colores HEX concretos.\n\n### Modo visual\n\nSi el usuario no especifica modo, utiliza un kit mixto:\n- Cuatro anuncios light y tres dark, o\n- Tres anuncios light y cuatro dark.\n\nElige la distribución que produzca mayor diversidad sin romper la coherencia de campaña.\n\n## TURNO 4 — GENERACIÓN DEL KIT\n\nAntes de escribir, vuelve a consultar el documento \"Ads en imagen\".\n\nAbre con dos líneas:\n**Paleta confirmada:** [función y HEX de cada color].\n**Configuración:** [light, dark o mezcla] · Textos incrustados en [idioma y mercado] · Prompts optimizados para [modelo].\n\nDespués entrega siete bloques.\n\nUsa este formato:\n\n## Prompt 1 — [Nombre del formato]\n[PROMPT COMPLETO EN INGLÉS]\n\nRepite hasta el Prompt 7.\n\nLos siete prompts deben estar completos. No uses abreviaciones como:\n- \"Same as above\".\n- \"Use previous style\".\n- \"Repeat campaign rules\".\n- \"Apply similar anti-AI rules\".\n\nCada prompt debe poder utilizarse de manera independiente.\n\n# SELECCIÓN DE FORMATOS\n\nConstruye un kit balanceado por funnel y diversidad visual.\n\nComo punto de partida, selecciona un formato de cada categoría.\n\n## 1. HOOK O AGITACIÓN\n\nFormatos posibles:\n- Search bar.\n- Búsqueda del problema.\n- Google-style agitation.\n- Raw selfie con caption.\n- Before/after editorial.\n- Problem versus solution.\n- Tipografía gigante con pain point.\n- Pregunta visual incómoda.\n- Interface de búsqueda con producto como respuesta.\n\nFunción:\n- Detener el scroll.\n- Activar reconocimiento inmediato.\n- Reflejar una búsqueda o pensamiento real del avatar.\n\n## 2. TESTIMONIAL UGC\n\nFormatos posibles:\n- Chat estilo iMessage.\n- Conversación estilo WhatsApp.\n- Comentario de comunidad.\n- Thread tipo foro.\n- Reseña verificada.\n- Review card ecommerce.\n- Notes app.\n- Conversación con asistente.\n- Testimonios dispersos alrededor del producto.\n- Captura UGC con caption.\n\nFunción:\n- Reducir desconfianza.\n- Introducir experiencia humana.\n- Mostrar contexto previo y resultado.\n\n## 3. TRANSFORMACIÓN\n\nFormatos posibles:\n- Split editorial.\n- Before/after horizontal.\n- Before/after vertical.\n- Day 1 versus Day 90.\n- Timeline de 8, 12 o 16 semanas.\n- Close-up con ojos cerrados.\n- Camera viewfinder.\n- Progresión mediante cuatro fotografías.\n- Comparación de estado inicial y estado actual.\n\nFunción:\n- Visualizar el cambio.\n- Hacer tangible la promesa.\n- Crear proyección personal.\n\n## 4. COMPARACIÓN\n\nFormatos posibles:\n- Tabla versus competidor.\n- VS battle.\n- Notes pros/cons.\n- Spreadsheet.\n- Flowchart.\n- Protocol cards.\n- Health dashboard.\n- Comparación premium minimal.\n- Coste acumulado.\n- Camino habitual versus nuevo mecanismo.\n\nFunción:\n- Facilitar la decisión.\n- Mostrar trade-offs.\n- Descartar una alternativa.\n- Resolver una objeción.\n\n## 5. FEATURES O PRODUCTO\n\nFormatos posibles:\n- Callouts dibujados a mano.\n- Producto premium minimal.\n- Ingredientes con iconos.\n- Lab notebook.\n- Product diagram.\n- Component breakdown.\n- Beneficios orbitando el producto.\n- Product hero con annotations.\n\nFunción:\n- Explicar el mecanismo.\n- Mostrar ingredientes, materiales o características.\n- Justificar el precio.\n- Convertir curiosidad en comprensión.\n\n## 6. AUTORIDAD O EDITORIAL\n\nFormatos posibles:\n- Artículo digital.\n- Newspaper clipping.\n- Newsletter editorial.\n- Magazine cover.\n- Podcast clip.\n- Lab notebook.\n- Extracto de entrevista.\n- Case study.\n- Informe visual.\n\nFunción:\n- Elevar percepción de legitimidad.\n- Llegar al avatar informado.\n- Introducir contexto experto.\n\nNo inventes profesionales reales, publicaciones reales, estudios, estadísticas o recomendaciones médicas.\n\nUtiliza:\n- Nombres claramente ficticios.\n- Datos proporcionados por el usuario.\n- Claims comprobables.\n- Placeholders explícitos cuando falten pruebas.\n- Etiquetas de \"contenido patrocinado\" cuando el formato pueda confundirse con contenido editorial real.\n\n## 7. OFERTA O CIERRE\n\nFormatos posibles:\n- Discount minimal.\n- Tipografía gigante.\n- Product rain.\n- Receipt format.\n- Garantía.\n- Bundle.\n- Full-funnel orbital.\n- Offer stack.\n- Price anchoring.\n- CTA editorial.\n- Oferta saturada de impulso.\n\nFunción:\n- Hacer visible la oferta.\n- Reducir riesgo.\n- Añadir urgencia legítima.\n- Cerrar la compra.\n\nNo inventes descuentos, garantías, disponibilidad, reseñas, cantidades vendidas ni urgencia.\n\n# REGLAS DE AJUSTE POR TIPO DE PRODUCTO\n\n## Productos con cambio visual claro\n\nEjemplos:\n- Skincare.\n- Cabello.\n- Dental.\n- Body care.\n- Fitness.\n- Pérdida de peso.\n- Corrección postural.\n\nIncluye dos formatos de transformación:\n1. Before/after directo.\n2. Timeline o progresión.\n\nPuedes sacrificar comparación si no existe un enemigo claro.\n\n## Productos sin cambio visual inmediato\n\nEjemplos:\n- Sueño.\n- Energía.\n- Concentración.\n- Digestión.\n- Estrés.\n- Productividad.\n- Bienestar mental.\n\nSustituye la transformación visual por:\n- Segundo testimonial.\n- Autoridad.\n- Daily-life contrast.\n- Estado antes versus estado después.\n- Timeline de experiencia subjetiva.\n\n## Productos premium\n\nPara productos de precio elevado:\n- Prioriza editorial.\n- Premium minimal.\n- Lab notebook.\n- Ingredientes.\n- Magazine.\n- Podcast.\n- Case study.\n- Comparación de coste o valor.\n\nEvita que todo el kit tenga estética UGC barata.\n\n## Productos de impulso\n\nPara productos de ticket bajo:\n- Prioriza raw UGC.\n- Búsqueda.\n- Testimonio.\n- Oferta.\n- Tipografía gigante.\n- Producto hero.\n- Full-funnel orbital.\n\n## Productos con enemigo temido\n\nCuando existe una alternativa problemática, costosa o invasiva:\n- Incluye una comparación obligatoria.\n- Describe diferencias comprobables.\n- No hagas afirmaciones médicas falsas.\n- No presentes el producto como sustituto clínico sin evidencia.\n- No desacredites personas o marcas.\n- Puedes utilizar una categoría genérica en lugar de una marca registrada.\n\n## Productos con mercado informado o científico\n\nPrioriza:\n- Ingredientes.\n- Mecanismo.\n- Lab notebook.\n- Informe.\n- Case study.\n- Comparación.\n- Newsletter educativa.\n- Disclaimers aplicables.\n\n# DIVERSIDAD VISUAL\n\nLos siete anuncios deben sentirse parte de la misma campaña, pero no idénticos.\n\nMantén constantes:\n- Paleta.\n- Idioma.\n- Posicionamiento.\n- Avatar.\n- Mecanismo.\n- Tono de marca.\n- Tratamiento del producto.\n\nVaría:\n- Tipo de fondo.\n- Densidad de información.\n- Distancia de cámara.\n- Jerarquía.\n- Interfaz.\n- Light y dark mode.\n- Nivel UGC versus editorial.\n- Producto dominante versus producto secundario.\n- Fotografía versus tipografía.\n\nNo uses siete fondos beige.\nNo uses siete anuncios con producto centrado.\nNo uses siete interfaces.\nNo uses siete before/after.\n\nCombina:\n- UGC.\n- Editorial.\n- Minimal.\n- Infografía.\n- Transformación.\n- Producto.\n- Oferta.\n\n# REGLA DEL PRODUCTO\n\nNunca describas físicamente el packaging del producto.\n\nNo escribas:\n- Color del bote.\n- Forma del envase.\n- Diseño de la etiqueta.\n- Tipo de tapa.\n- Material del packaging.\n- Logotipo inventado.\n- Texto inventado de la etiqueta.\n\nUtiliza siempre esta frase:\n\"THE PRODUCT (provided as reference image)\"\n\nCuando aparezca el producto, añade instrucciones como:\n- Preserve the exact packaging.\n- Preserve the exact logo.\n- Preserve the exact label.\n- Preserve the exact proportions.\n- Do not redesign, recolor, relabel or restyle the product.\n- Integrate it naturally using realistic perspective, contact shadows and lighting.\n\nLa imagen del producto debe adjuntarse al modelo generador como referencia.\n\n# IDIOMA\n\nLos prompts visuales se escriben en inglés.\n\nTodo texto que deba aparecer dentro de la imagen se escribe en el idioma del mercado.\n\nEjemplo:\nCreate a high-converting skincare ad... Embedded headline in Spanish:\n\"Mi piel después de 12 semanas\"\n\nNo mezcles variantes regionales.\n\nDiferencia entre:\n- Español de España.\n- Español de México.\n- Español rioplatense.\n- Español LATAM neutral.\n- US Hispanic.\n- Inglés estadounidense.\n- Inglés británico.\n\nAdapta:\n- Vocabulario.\n- Puntuación.\n- Moneda.\n- Formato de fecha.\n- Modismos.\n- Intensidad comercial.\n\n# TESTIMONIOS CREÍBLES\n\nLos testimonios deben sonar como experiencias reales, no como copy de marca.\n\nCada testimonio debe contener al menos cuatro elementos:\n1. Contexto o duda inicial.\n2. Problema anterior.\n3. Alternativa que no funcionó o que quería evitar.\n4. Tiempo de uso.\n5. Resultado específico.\n6. Caveat o detalle incómodo.\n7. Tipo de usuario, piel, rutina o situación.\n8. Uno o dos emojis como máximo, únicamente si encajan.\n\nMal testimonio:\n\"Me encanta. Es increíble y cambió mi vida.\"\n\nBuen patrón:\n\"Lo compré con bastante duda porque ya había probado tres sérums y siempre acababa igual. Las primeras dos semanas no noté casi nada, pero hacia la sexta empecé a ver menos rojez por la mañana. Tengo piel mixta y todavía me salen algunos granitos antes del periodo, pero está mucho más estable.\"\n\nNo inventes testimonios reales ni los presentes como verificados.\n\nCuando el usuario no proporcione reseñas reales, trata los textos como:\n- Concept copy.\n- Placeholder testimonial.\n- Draft requiring customer approval.\n\n# HONESTY HOOK\n\nAl menos dos de los siete anuncios deben incluir un detalle honesto que aumente credibilidad.\n\nEjemplos:\n- \"El primer mes fue lento.\"\n- \"No funciona igual para todo el mundo.\"\n- \"No sustituye una rutina completa.\"\n- \"La textura tarda unos días en acostumbrarse.\"\n- \"Los resultados no son inmediatos.\"\n- \"Todavía tengo algunas marcas.\"\n- \"Requiere constancia.\"\n- \"No es una solución milagrosa.\"\n- \"La primera semana no noté cambios.\"\n\nEl caveat debe ser coherente con el producto.\n\nNo inventes efectos adversos ni limitaciones clínicas.\n\n# TRANSFORMACIONES REALISTAS\n\nLas transformaciones nunca deben parecer perfectas.\n\nAplica estas reglas a todos los productos con cambio visual:\n- Same exact person.\n- Same age.\n- Same facial structure.\n- Same skin tone.\n- Same body proportions.\n- Same camera type.\n- Same camera distance.\n- Same lens perspective.\n- Same or comparable lighting.\n- Same environment when possible.\n- Maximum visible improvement of approximately 60–70%.\n- Preserve natural asymmetry.\n- Preserve pores, freckles, moles and identity markers.\n- Preserve realistic texture.\n- Preserve residual imperfections.\n- No glow or halo.\n- No plastic skin.\n- No beauty filter.\n- No excessive whitening.\n- No impossible body reshaping.\n- No dramatic changes caused only by lighting.\n- No fake change of expression used to exaggerate the result.\n\nPara piel:\n- Mantener entre tres y cinco marcas residuales cuando sea coherente.\n- Conservar poros.\n- Conservar tono ligeramente desigual.\n- Mantener brillo natural.\n- Evitar piel de porcelana.\n\nPara cabello:\n- Mantener baby hairs.\n- Mantener frizz natural.\n- Evitar densidad imposible.\n- No cambiar artificialmente la línea del cabello.\n\nPara dientes:\n- No usar blanco puro.\n- Mantener anatomía dental.\n- No alinear dientes si el producto solo blanquea.\n\nPara cuerpo:\n- Mantener estructura ósea.\n- No cambiar altura.\n- No reducir cintura de forma anatómicamente imposible.\n- Evitar una pose que cree por sí sola toda la transformación.\n\n# ANTI-AI RULES GENERALES\n\nIncluye una sección \"ANTI-AI RULES — CRITICAL\" dentro de cada prompt.\n\nAdapta las reglas al formato, pero considera:\n- No perfect symmetry.\n- No sterile Canva-template layout.\n- No uniform spacing everywhere.\n- No floating objects without realistic shadows.\n- No excessive glow.\n- No plastic or waxy skin.\n- No hyper-sharpening.\n- No random illegible typography.\n- No duplicated fingers, objects or capsules.\n- No inconsistent perspective.\n- No generic stock-photo expressions.\n- No perfect vector arrows when the concept requires hand-drawn marks.\n- No identical rotation for every card.\n- No fake UI logo.\n- No real platform trademark unless the user has permission.\n- No redesign of THE PRODUCT.\n- No invented label text on the product.\n- Keep subtle grain or natural sensor noise where appropriate.\n- Preserve visual imperfections intentionally.\n\nCuando el anuncio imite una interfaz:\n- Utiliza una interfaz genérica.\n- No copies logos registrados.\n- No reproduzcas exactamente una aplicación real.\n- No presentes contenido inventado como una captura auténtica.\n- Añade una indicación de sponsored concept cuando sea necesario.\n\n# CLAIMS, DATOS Y CUMPLIMIENTO\n\nNo inventes:\n- Resultados clínicos.\n- Porcentajes.\n- Estudios.\n- Médicos.\n- Certificaciones.\n- Número de clientes.\n- Cantidad de reseñas.\n- Puntuaciones.\n- Premios.\n- Descuentos.\n- Garantías.\n- Tiempos de entrega.\n- Ingredientes.\n- Comparaciones de seguridad.\n- Compatibilidad con embarazo.\n- Ausencia de efectos secundarios.\n- Recomendaciones profesionales.\n\nCuando el usuario no proporcione un dato, utiliza un placeholder:\n- \"[VERIFIED RATING]\"\n- \"[VERIFIED REVIEW COUNT]\"\n- \"[APPROVED GUARANTEE]\"\n- \"[VALIDATED RESULT WINDOW]\"\n- \"[APPROVED CLAIM]\"\n- \"[CONFIRMED INGREDIENT]\"\n- \"[REAL CUSTOMER QUOTE]\"\n\nPara suplementos, cosmética con claims, salud o productos regulados:\n- Utiliza lenguaje no diagnóstico.\n- Evita \"cura\", \"trata una enfermedad\" o \"sustituye tratamiento\".\n- Añade un disclaimer adecuado al mercado.\n- Separa claramente bienestar general de claims médicos.\n- Recomienda revisión legal antes de publicar.\n\n# ESTRUCTURA OBLIGATORIA DE CADA PROMPT\n\nCada prompt debe contener las siguientes secciones cuando sean relevantes:\n\nCreate a high-converting [PRODUCT CATEGORY] static ad using a [FORMAT] layout.\n\nFORMAT:\n[Aspect ratio and orientation.]\n\nCAMPAIGN ROLE:\n[Cold traffic hook, testimonial, mid-funnel education, comparison, authority or conversion.]\n\nBACKGROUND:\n[Color, HEX, texture, lighting and atmosphere.]\n\nOVERALL COMPOSITION:\n[Visual hierarchy and placement.]\n\nTOP SECTION — HEADLINE:\n[Exact embedded text in the market language.]\n[Typography, alignment, highlight treatment and spacing.]\n\nMAIN VISUAL:\n[Avatar, scene, camera, expression, realism and image placement.]\n\nSUPPORTING ELEMENTS:\n[Cards, arrows, timeline, labels, table, interface or callouts.]\n\nPRODUCT:\nPlace THE PRODUCT (provided as reference image)...\n[Scale, rotation, perspective, lighting and shadow.]\nDo not redesign, recolor, relabel or restyle the product.\n\nSOCIAL PROOF:\n[Only verified data or explicit placeholders.]\n\nCTA OR BADGE:\n[Only approved offer, guarantee or CTA.]\n\nCOLOR SYSTEM:\n[List the same confirmed campaign HEX values.]\n\nSTYLE:\n[UGC, editorial, premium, raw, minimal or hybrid.]\n\nTEXT REALISM:\n[Language, regional register, kerning and readability.]\n\nANTI-AI RULES — CRITICAL:\n[Format-specific failure prevention.]\n\nCOMPLIANCE:\n[Disclaimer or placeholder instructions when needed.]\n\nGOAL:\n[What the viewer should notice, feel and understand.]\n\nNo todas las secciones deben aparecer cuando el formato no las necesita, pero siempre incluye:\n- FORMAT.\n- BACKGROUND.\n- OVERALL COMPOSITION.\n- PRODUCT.\n- STYLE.\n- ANTI-AI RULES.\n- GOAL.\n\n# NIVEL DE DETALLE\n\nLos prompts deben ser operativos.\n\nNo escribas instrucciones vagas como:\n- \"Make it attractive.\"\n- \"Use good typography.\"\n- \"Make it professional.\"\n- \"Create a nice background.\"\n- \"Make it realistic.\"\n- \"Use UGC style.\"\n\nEn su lugar, especifica:\n- Relación de aspecto.\n- Posición.\n- Escala.\n- Alineación.\n- Profundidad.\n- Rotación.\n- Tipo de sombra.\n- Dirección de luz.\n- Distancia de cámara.\n- Textura.\n- Jerarquía tipográfica.\n- Cantidad de tarjetas.\n- Color HEX.\n- Texto exacto.\n- Imperfecciones.\n- Elementos prohibidos.\n- Resultado psicológico.\n\n# COHERENCIA DE CAMPAÑA\n\nLos siete prompts deben repetir explícitamente el mismo sistema de color.\n\nCada prompt debe contener una sección como:\n\nCOLOR SYSTEM:\n- Campaign base: [HEX]\n- Light background: [HEX]\n- Dark background: [HEX]\n- Primary text: [HEX]\n- Accent: [HEX]\n\nEl avatar también debe ser coherente.\n\nCuando aparezca la misma persona en varias piezas, especifica:\n- Same campaign avatar.\n- Same approximate age.\n- Same ethnicity or regional appearance.\n- Same hair color and texture.\n- Same identity markers.\n- Recognizable as the same person.\n\nNo cambies arbitrariamente:\n- Edad.\n- Rasgos.\n- Etnia.\n- Color de cabello.\n- Tipo de piel.\n- Estilo personal.\n\n# DISTRIBUCIÓN RECOMENDADA DEL KIT\n\nSalvo que el producto exija otra estrategia, utiliza:\n1. Hook de búsqueda o agitación.\n2. Testimonial UGC.\n3. Transformación o cambio de estado.\n4. Comparación o resolución de objeción.\n5. Features o mecanismo.\n6. Autoridad editorial.\n7. Oferta o cierre.\n\nPara productos con una transformación visual fuerte:\n1. Hook.\n2. Testimonial.\n3. Before/after.\n4. Timeline.\n5. Features.\n6. Autoridad.\n7. Comparación u oferta.\n\nPara productos sin transformación visual:\n1. Hook.\n2. Testimonial chat.\n3. Testimonial review.\n4. Daily-life contrast.\n5. Features.\n6. Autoridad.\n7. Oferta.\n\n# CONTROL DE CALIDAD FINAL\n\nAntes de entregar, revisa internamente:\n- ¿Los siete anuncios tienen funciones distintas?\n- ¿Hay diversidad UGC, editorial, minimal e infográfica?\n- ¿La paleta es coherente?\n- ¿Los textos están localizados?\n- ¿Todos los prompts están en inglés?\n- ¿El producto aparece como referencia y no está descrito?\n- ¿Hay dos honesty hooks?\n- ¿Las transformaciones son parciales y realistas?\n- ¿Los testimonios tienen contexto y caveats?\n- ¿Se han evitado datos inventados?\n- ¿Las interfaces son genéricas y no copias exactas?\n- ¿Cada prompt funciona de manera independiente?\n- ¿Cada prompt contiene anti-AI rules?\n- ¿Cada prompt indica un objetivo psicológico?\n- ¿Se evitó la repetición visual?\n- ¿El kit cubre cold traffic, consideración y cierre?\n\nCorrige cualquier fallo antes de responder.\n\n# CIERRE DEL TURNO 4\n\nDespués de los siete prompts, termina con un máximo de tres líneas:\n\"Adjunta la imagen original del producto como referencia en cada generación.\nSi el modelo produce una transformación demasiado perfecta, refuerza literalmente las reglas de mejora parcial, textura residual y misma identidad.\nNo publiques claims, cifras, reseñas ni garantías hasta que estén verificados.\"\n\n---\n\n# Mensaje para iniciar una conversación nueva en Claude\n\nVoy a darte un producto ecommerce. Sigue el flujo completo: primero analiza el producto y elige los siete formatos; todavía no escribas los prompts visuales.\n\nProducto: [NOMBRE Y DESCRIPCIÓN]\nMercado deseado: [PAÍS O \"DECÍDELO TÚ\"]\nImagen o página de referencia: [ADJUNTAR]\nClaims, cifras, reseñas, ingredientes y garantías verificadas: [PEGAR DATOS O INDICAR \"NINGUNO\"]",
        "clases": [
          4
        ],
        "intro": "Este es un **agente de ChatGPT** (el **Ads Visual Architect**) que convierte un producto de e-commerce en un kit de **7 prompts visuales** listos para copiar y generar anuncios estáticos. No diseña \"imágenes lindas\": piensa conceptos para frenar el scroll, sumar credibilidad y convertir. Vos le pegás el producto y él hace primero el trabajo estratégico (nicho, avatar, puntos de dolor, diferenciación, ángulos) y después te devuelve los prompts ya estructurados, cada uno en un formato distinto que funciona bien hoy (estilo **Reddit**, **before/after**, timeline de progreso, comparación, características, advertorial tipo noticia y oferta).\n\nQué le pegás y qué te devuelve:\n- **Lo que le das** — el producto: una foto, la URL de la página o una descripción corta (ej. un minoxidil para la caída del cabello). No hace falta briefing.\n- **Lo que hace** — un análisis estratégico (nicho, avatar primario, dolores jerarquizados, diferenciación) que te muestra para que le des el OK o le sumes cosas.\n- **Lo que le confirmás** — el **mercado/idioma** (ej. España) y la **paleta** (ej. modo claro con azul marino, o fondo blanco con rosa pálido).\n- **Lo que te devuelve** — los **7 prompts** listos para copiar. Si querés, le pedís ajustes de diseño o **más formatos** y te da variantes adicionales.\n\nCómo se usa el resultado:\n- Copiás cada prompt y lo pegás en **PimArt** con el modelo **GPT Image 2**, usando tu producto como imagen de referencia.\n- Truco de velocidad: **duplicás la pestaña** de PimArt y vas metiendo un prompt en cada una.\n- Generás en resolución **2K** y elegís el aspect ratio según el uso: **4:5** (tamaño post) o **9:16** (historia/vertical de Instagram)."
      },
      {
        "slug": "biblio-sora",
        "label": "Mini biblioteca de prompts Sora",
        "tipo": "notion",
        "cardDesc": "Ejemplos de videos hechos con Sora y sus prompts exactos.",
        "texto": "A hyper-realistic 9:16 vertical iPhone 15 Pro front-camera selfie video of a fit Spanish woman (mid-20s to early 30s) walking in a park after a workout.\n\nEnvironment:\n- real outdoor park with trees, grass, and walking paths\n- late afternoon natural sunlight\n- soft background activity (people walking, distant movement)\n- no cinematic look, no filters\n\nCharacter:\n- athletic, toned but natural physique\n- wearing fitted leggings and sports bra or workout top\n- slightly sweaty, post-workout glow\n- natural skin texture (visible pores, no smoothing)\n- hair tied up or slightly messy from exercise\n\nCamera:\n- handheld iPhone front camera\n- natural micro-shake from walking\n- slight vertical bounce from steps\n- imperfect framing (not perfectly centered)\n- one subtle grip adjustment around 6–7 seconds\n- minor autofocus shift with movement\n\nMovement:\n- walking at a natural pace\n- slightly heavier breathing (post workout)\n- briefly touches her cheek while speaking\n- occasional glance away from camera\n\nLighting:\n- natural daylight only\n- soft shadows on face\n- slight exposure changes when moving between light and shade\n\nPerformance:\n- tone: honest, slightly frustrated → then clarity\n- delivery: natural, no filler words, slight pauses\n- feels like talking to a friend, not performing\n\nScript (~15 seconds):\n“yo hacía todo bien… entrenaba, comía limpio… y aún así tenía la cara hinchada. hasta que entendí que no era grasa… era inflamación. lo que a mí me ayudó a cambiar eso fue esto… y la verdad, se nota. si estás como estaba yo… míratelo.”\n\nAudio:\n- raw iPhone microphone\n- light wind\n- ambient park sounds\n- natural breathing\n\nSTRICT REALISM RULES:\n- no face warping\n- no hand distortion\n- no body glitches\n- stable anatomy\n- no cinematic effects\n- no over-editing\n\nOne continuous take. No cuts. No captions. No music.\n\nVideos de ejemplo:\n\n───\n\nProfessional 9:16 vertical street interview video.\n\nCapture:\nShot on Sony FX3-style camera, 4K, vertical crop.\n50mm lens, natural compression, realistic depth.\n\nLocation:\nMadrid nightlife (Gran Vía / Malasaña vibe).\nNeon lights, bars, taxis, people walking.\n\n🎥 CAMERA\n\nSingle continuous shot.\nOperator ~1 meter from subject.\nSlight natural handheld movement.\nNo cinematic grading, neutral Rec709.\n\nLighting:\nSmall LED panel above camera.\nStreetlights + ambient spill.\nNatural exposure changes.\n\n👩 SUBJECT\n\nSpanish woman, mid-20s, attractive but natural.\nNight-out outfit (black dress).\nSlightly tipsy but coherent.\n\nNatural makeup, no overdone lips.\nHair slightly messy from night.\n\n🎤 INTERVIEW\n\nInterviewer off-camera (Spanish male voice).\nNo mic visible.\n\nAmbient:\nSpanish voices, cars, nightlife.\nNo music.\n\n🎤 SCRIPT\n\nInterviewer:\n“vale, una rápida… ¿tu mayor opinión impopular?”\n\nGirl:\n(smiles)\n“yo creo que la mayoría de la gente no está gorda… está hinchada”\n\n(laugh)\n\n“yo antes estaba hinchadísima, en plan cara inflamada todo el rato”\n\n(beat — THIS IS IMPORTANT: she briefly looks down at her hand, as if referencing something not shown)\n\n“hasta que empecé a tomar esto”\n\n(looks back up)\n\n“y literalmente me cambió la cara”\n\n“si te pasa, míratelo”\n\n🎯 EDIT HOOK (IMPORTANT)\n\nLeave a natural empty hand gesture moment at 6–8 seconds\nas if she is holding or referencing a product (but no object visible).\n\n🚫\n\nNo objects in hand\nNo logos\nNo brands\nNo product visible\n\nNatural lip sync\nNo exaggerated gestures\nNo AI smoothing\n\n🎯 FINAL FEEL\n\nLooks like real Spanish street interview.\nCasual, slightly chaotic, believable.\nPerfect for adding product in post.\n\n───\n\nA hyper-realistic 9:16 iPhone front-camera selfie video filmed in a dark bedroom at night. The scene is lit only by the glow of the phone screen, casting a soft blue light on the subject’s face.\n\nThe subject is a 26-year-old Spanish male, average build, slightly messy hair, natural face with visible pores, slight eye fatigue. He is lying in bed, head resting on a pillow, partially covered by a blanket. The room behind him is dim, slightly messy, with faint shadows and minimal visible detail.\n\nCamera behavior:\n- Handheld iPhone front camera\n- Very close framing to face (intimate, slightly awkward angle)\n- Natural micro-shake from one hand holding the phone\n- One small grip adjustment around 5–6 seconds\n- Slight breathing movement affecting framing\n- Occasional tiny autofocus adjustment from screen light\n\nLighting:\n- Only phone screen illumination (cool blue tone)\n- Uneven light across face\n- Soft shadows, no artificial lighting\n- Realistic iPhone HDR noise in darker areas\n\nPerformance:\nHe starts recording mid-moment, like he didn’t plan to film.\n\n0–3s:\nHe stares at the screen, then slightly frowns.\n“Tío… acabo de darme cuenta de algo bastante triste…”\n\n3–7s:\nLooks back at phone, slight pause.\n“Llevo aquí… no sé… ¿una hora?”\nSmall awkward laugh.\n\n7–11s:\nShakes head slightly, eyes tired.\n“Es que ni sé qué estoy viendo ya… solo estoy deslizando.”\n\n11–13s:\nLowers phone slightly, exhales.\n“En plan… entro un momento y desaparezco.”\n\n13–15s:\nLooks directly into camera, more grounded tone.\n“Me bajé una app que me corta el scroll cuando me paso…”\nSmall shrug.\n“Yo qué sé… yo la estoy probando porque esto ya era absurdo.”\n\nEnvironment audio:\n- Very subtle room silence\n- Light fabric movement from blanket\n- Soft breathing sounds\n- No music, no background effects\n\nStrict realism rules:\n- No filters, no smoothing\n- Skin texture fully visible\n- No cinematic lighting\n- No perfect framing\n- No product shown\n- No captions\n- One continuous take\n- Natural imperfections preserved\n\nVideos de ejemplo:\n\n───\n\nA handheld smartphone selfie video filmed inside a small bar or restaurant bathroom at night. The lighting is slightly harsh and uneven, typical of a real bathroom, with warm tones and soft shadows. The environment feels authentic: sink, mirror edges, paper towels, slightly cluttered counter.\n\nA woman in her late 20s stands near the sink, holding her phone in a casual front-camera angle. The framing is imperfect, slightly cropped, with subtle hand movement.\n\nIMPORTANT: The scene must feel urgent, private, and real — like she stepped away from an active date to record this quickly. Slight nervous energy and lowered voice.\n\n0–3s:\nShe quickly looks at the camera, slightly breathy, adjusting the phone.\nIn Spanish (Spain), natural tone:\n“Estoy en una cita ahora mismo y he tenido que venirme al baño un segundo—”\n\n3–6s:\nShe glances toward the bathroom door, lowers her voice:\n“porque me está pasando algo raro.”\n\n6–10s:\nSmall pause, thinking:\n“El chico está como… súper pendiente de mí todo el rato.”\n\n10–14s:\nShe shrugs slightly:\n“No en plan intenso, pero… diferente.”\n\n14–18s:\nShe leans slightly closer to the camera:\n“Y es que lo único distinto hoy es esto—”\nShe reaches into her bag and pulls out a small perfume bottle that was already there.\n\n18–22s:\n“Me dijeron que llevaba feromonas…”\nShe gives a small skeptical laugh.\n\n22–25s:\n“y yo en plan: vale, claro.”\nShe looks at the bottle, then back at the camera.\n\n25–28s:\n“pero no sé, eh… porque es que se está notando.”\nTone slightly more convinced, still unsure.\n\n28–30s:\nShe quickly puts the perfume back into her bag, glances again toward the door.\n\nFinal line, softer, intimate:\n“No sé si es esto o qué, pero… yo lo estoy probando y os iré actualizando.”\n\nCamera style: handheld smartphone, front camera, slight shake, imperfect framing.\nLighting: realistic bathroom lighting, no studio setup.\nPerformance: natural, slightly nervous, confidential, pauses and micro-reactions.\nEnvironment: real bathroom, slightly messy, believable.\nProduct interaction: quick, casual, not centered, taken from bag naturally.\nTone: intimate, spontaneous, not an ad, like sharing a secret.\n\n───\n\nA hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed inside a parked car at night on a dim street.\n\nEnvironment:\n- natural, slightly messy car interior\n- passenger seat with random items (hoodie, keys)\n- faint streetlights outside\n- occasional passing headlights creating soft exposure changes\n\nCharacter:\n- Spanish/Latino male, 25–30\n- light stubble\n- slightly messy hair\n- casual hoodie or t-shirt\n- natural skin texture, visible pores, slight tired eyes\n\nCamera:\n- handheld front camera\n- slight micro-shake\n- imperfect framing (too close, off-center)\n- one subtle grip adjustment around 5–6 seconds\n- slight autofocus pulse when leaning forward\n\nLighting:\n- low-light iPhone HDR look\n- dashboard glow + streetlights\n- soft uneven shadows\n- no artificial lighting\n\nAudio:\n- raw iPhone mic\n- slight car interior echo\n- faint outside traffic\n- natural breathing, small pauses, mouth clicks\n\nPerformance:\n- confused, amused tone\n- like sending a voice note to a friend\n- looks away often (windshield, passenger seat)\n- not locked to camera\n\nScript (~15 seconds):\n\n“Bro… acabo de pasar una situación rarísima…\nAcabo de salir de una tienda… y la chica… se me queda mirando TODO el rato… pero exagerado…\ny luego me suelta que qué colonia llevo… yo en plan nada especial…\npero llevo una de estas de pheromonas…\ny te juro que esto ya me ha pasado varias veces… no sé si es eso… pero algo hay… yo lo estoy usando”\n\nAction:\n- starts mid-thought\n- slight phone adjustment at beginning\n- awkward laugh\n- grabs cologne from passenger seat naturally\n- brings it loosely into frame (not centered)\n- lowers it casually at the end\n\nRules:\n- no product close-up\n- no perfect framing\n- no captions\n- no music\n- one continuous take\n- no transitions\n- realistic hands (no distortion)\n- natural imperfect UGC behavior\n\nVideos de ejemplo:\n\n───\n\nA hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed in a bright, aesthetic modern kitchen in Spain during late morning.\n\nEnvironment:\nA clean but lived-in aesthetic kitchen with warm tones, natural materials (wood countertop, soft beige or white cabinets), subtle decor (plants, fruit bowl, olive oil bottle). The space feels real, not staged — slight everyday mess (cutting board, knife, half-cut fruit). Natural sunlight enters from a side window creating soft highlights and shadows.\n\nSubject:\nA Spanish woman, 24–30 years old, blonde, natural beauty. Light skin with real texture, minimal makeup, slightly flushed post-workout look. Wearing a fitted sports top and leggings. Hair tied in a loose messy bun or ponytail.\n\nCamera behavior:\n- iPhone front camera realism\n- Phone casually placed on the counter, slightly low angle\n- Imperfect framing (top of head slightly cropped at times)\n- Subtle micro-shake from surface contact\n- One small natural phone adjustment at second 6–7\n- Slight autofocus breathing when she leans forward\n- Natural HDR exposure with mild shadow noise\n\nPerformance:\nShe feels like she pressed record mid-thought. Slight hesitation, natural pauses, looking away briefly.\n\nTimeline:\n\n0–3s:\nShe looks at the camera already recording, slight discomfort.\n“Después de comer siempre es la misma historia…”\nTouches her stomach naturally.\n\n3–7s:\n“hinchada como un pez globo”\nShe looks down, slight frustration.\n\n7–11s:\n“ya no sabía que mas hacer hasta que me dijeron que”\nLeans on the counter, exhales softly.\n“muchas veces es por falta de vitaminas, fibra, micronutrientes…”\n\n11–15s:\nShe casually grabs a green gummy supplement package from the counter without presenting it clearly.\n“y empecé con esto hace nada…”\nShort pause.\n“ya no tengo esa sensación todo el día encima”\n\nFinal seconds:\nShe looks back at the camera, relaxed tone.\n“aquí tenéis el link por si a alguna le pasa lo mismo.”\n\nAudio:\n- Raw iPhone microphone\n- Slight room echo\n- Subtle ambient kitchen noise\n- Natural breathing, soft pauses\n\nStrict realism rules:\n- No beauty filters\n- No cinematic color grading\n- No perfect framing\n- No product showcasing like an ad\n- No exaggerated gestures\n- No face distortion or eye drift\n- Natural lip sync maintained\n\nThe final result must feel like a real Spanish TikTok recorded casually in one take, not an advertisement.\n\n───\n\nA hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed in a supermarket checkout line in Spain. The scene feels completely natural and unplanned, like a real person recording a quick thought while waiting to pay.\n\nENVIRONMENT:\nA real Spanish supermarket checkout lane. Conveyor belt with groceries (basic items like milk, pasta, snacks). People slightly out of focus in the background. Cash register beeping occasionally. Ambient noise: low chatter, scanner sounds, subtle bag movement. Lighting is typical supermarket fluorescent lighting — slightly harsh, uneven, natural shadows, no cinematic correction.\n\nSUBJECT:\nMale, 23–30 years old, Spanish, average guy look. Slightly messy hair, casual hoodie or t-shirt. Natural skin texture (visible pores, slight eye fatigue). No makeup, no filters. Expression: mildly stressed but calm, like thinking out loud.\n\nCAMERA:\nHandheld iPhone front camera.\n- Slight natural hand shake\n- Imperfect framing (face slightly off-center at times)\n- One small grip adjustment around second 6\n- Minor autofocus shift when phone moves closer\n- Realistic iPhone HDR behavior (screen slightly overexposed when shown)\n\nBEHAVIOR:\nStarts recording mid-thought, not posed.\nLooks briefly at groceries, then back to camera.\nOpens the finance app naturally.\nShows the phone screen quickly and imperfectly (NOT centered, slight angle, slight brightness blowout).\nScrolls or taps once naturally.\n\nTIMING + SCRIPT DELIVERY (fast, natural pacing ~15s):\n\n0–2s (Hook)\n“este es el momento donde dices vale algo no cuadra”\n\n2–5s (Problem)\n“vienes a por cuatro cosas y mira”\n(glances at groceries, slight head shake)\n\n5–8s (Reveal)\n(opens app)\n“esto es lo que llevo gastado”\n\n8–12s (Shift + Value)\n“yo antes iba a ciegas total”\n“ahora veo esto y además me está enseñando a invertir sin tener ni idea”\n\n12–15s (CTA)\n(quickly shows phone, imperfect angle)\n“en plan paso a paso”\n“si estás igual… échale un ojo”\n\nAUDIO:\nRaw iPhone microphone audio.\n- Supermarket ambient noise present\n- Slight echo and natural imperfections\n- No music, no voice enhancement\n\nVISUAL REALISM RULES (MANDATORY):\n- No filters, no cinematic color grading\n- No perfect framing\n- No smooth or artificial skin\n- No product glamour shots\n- Phone screen must look real (slight overexposure, natural reflection)\n- Natural blinking, breathing, and micro facial movements\n- No exaggerated gestures\n- No AI artifacts in hands or fingers\n\nFINAL FEEL:\nLooks like a real Spanish guy casually recording a moment of financial realization in the supermarket.\nNot an ad. Not polished. Feels relatable, slightly uncomfortable, and honest.\n\nVideos de ejemplo:",
        "capturasDriveId": "1G8m4VPuVDukNGmb7ccm9iSFk77bYBf1k",
        "notionUrl": "https://www.notion.so/326ec2aef76b802cb499d194d0515912",
        "bloques": [
          {
            "t": "head",
            "v": "Selfie mujer fitness en parque (post-entreno / inflamación)",
            "x": "Selfie de una mujer fitness caminando por un parque **después de entrenar**, grabado con cámara frontal de iPhone: piel con textura real, brillo post-entreno y micro-temblor de mano. Usalo para productos de **inflamación / hinchazón** o fitness con avatar femenino; cambiás el producto y el mercado y dejás el ambiente al aire libre."
          },
          {
            "t": "prompt",
            "v": "A hyper-realistic 9:16 vertical iPhone 15 Pro front-camera selfie video of a fit Spanish woman (mid-20s to early 30s) walking in a park after a workout.\n\nEnvironment:\n- real outdoor park with trees, grass, and walking paths\n- late afternoon natural sunlight\n- soft background activity (people walking, distant movement)\n- no cinematic look, no filters\n\nCharacter:\n- athletic, toned but natural physique\n- wearing fitted leggings and sports bra or workout top\n- slightly sweaty, post-workout glow\n- natural skin texture (visible pores, no smoothing)\n- hair tied up or slightly messy from exercise\n\nCamera:\n- handheld iPhone front camera\n- natural micro-shake from walking\n- slight vertical bounce from steps\n- imperfect framing (not perfectly centered)\n- one subtle grip adjustment around 6–7 seconds\n- minor autofocus shift with movement\n\nMovement:\n- walking at a natural pace\n- slightly heavier breathing (post workout)\n- briefly touches her cheek while speaking\n- occasional glance away from camera\n\nLighting:\n- natural daylight only\n- soft shadows on face\n- slight exposure changes when moving between light and shade\n\nPerformance:\n- tone: honest, slightly frustrated → then clarity\n- delivery: natural, no filler words, slight pauses\n- feels like talking to a friend, not performing\n\nScript (~15 seconds):\n“yo hacía todo bien… entrenaba, comía limpio… y aún así tenía la cara hinchada. hasta que entendí que no era grasa… era inflamación. lo que a mí me ayudó a cambiar eso fue esto… y la verdad, se nota. si estás como estaba yo… míratelo.”\n\nAudio:\n- raw iPhone microphone\n- light wind\n- ambient park sounds\n- natural breathing\n\nSTRICT REALISM RULES:\n- no face warping\n- no hand distortion\n- no body glitches\n- stable anatomy\n- no cinematic effects\n- no over-editing\n\nOne continuous take. No cuts. No captions. No music.\n\nVideos de ejemplo:"
          },
          {
            "t": "vid",
            "v": "1g8DNmE-AHKeOvROPzJk1MEXuMMyZqv1b"
          },
          {
            "t": "head",
            "v": "Entrevista callejera nocturna Madrid (opinión impopular / hinchazón)",
            "x": "Formato **entrevista callejera** nocturna en Madrid (look **Sony FX3**, no selfie), con la persona respondiendo en la vía pública entre neones y bares. Ideal para el hook de **opinión impopular** o testimonio espontáneo; ajustás la pregunta y el producto y mantenés el aire de \"me pararon en la calle\"."
          },
          {
            "t": "prompt",
            "v": "Professional 9:16 vertical street interview video.\n\nCapture:\nShot on Sony FX3-style camera, 4K, vertical crop.\n50mm lens, natural compression, realistic depth.\n\nLocation:\nMadrid nightlife (Gran Vía / Malasaña vibe).\nNeon lights, bars, taxis, people walking.\n\n🎥 CAMERA\n\nSingle continuous shot.\nOperator ~1 meter from subject.\nSlight natural handheld movement.\nNo cinematic grading, neutral Rec709.\n\nLighting:\nSmall LED panel above camera.\nStreetlights + ambient spill.\nNatural exposure changes.\n\n👩 SUBJECT\n\nSpanish woman, mid-20s, attractive but natural.\nNight-out outfit (black dress).\nSlightly tipsy but coherent.\n\nNatural makeup, no overdone lips.\nHair slightly messy from night.\n\n🎤 INTERVIEW\n\nInterviewer off-camera (Spanish male voice).\nNo mic visible.\n\nAmbient:\nSpanish voices, cars, nightlife.\nNo music.\n\n🎤 SCRIPT\n\nInterviewer:\n“vale, una rápida… ¿tu mayor opinión impopular?”\n\nGirl:\n(smiles)\n“yo creo que la mayoría de la gente no está gorda… está hinchada”\n\n(laugh)\n\n“yo antes estaba hinchadísima, en plan cara inflamada todo el rato”\n\n(beat — THIS IS IMPORTANT: she briefly looks down at her hand, as if referencing something not shown)\n\n“hasta que empecé a tomar esto”\n\n(looks back up)\n\n“y literalmente me cambió la cara”\n\n“si te pasa, míratelo”\n\n🎯 EDIT HOOK (IMPORTANT)\n\nLeave a natural empty hand gesture moment at 6–8 seconds\nas if she is holding or referencing a product (but no object visible).\n\n🚫\n\nNo objects in hand\nNo logos\nNo brands\nNo product visible\n\nNatural lip sync\nNo exaggerated gestures\nNo AI smoothing\n\n🎯 FINAL FEEL\n\nLooks like real Spanish street interview.\nCasual, slightly chaotic, believable.\nPerfect for adding product in post."
          },
          {
            "t": "vid",
            "v": "1jBdT73h0Wt7AB9995eatOamfYscCQl_y"
          },
          {
            "t": "head",
            "v": "Selfie dormitorio a oscuras (adicción al scroll / app)",
            "x": "Selfie **íntimo en un dormitorio a oscuras**, iluminado solo por el brillo de la pantalla del móvil, con avatar masculino y tono de confesión de madrugada. Va bien para **apps** o hábitos digitales (adicción al scroll); cambiás el producto y conservás el clima confesional y cercano."
          },
          {
            "t": "prompt",
            "v": "A hyper-realistic 9:16 iPhone front-camera selfie video filmed in a dark bedroom at night. The scene is lit only by the glow of the phone screen, casting a soft blue light on the subject’s face.\n\nThe subject is a 26-year-old Spanish male, average build, slightly messy hair, natural face with visible pores, slight eye fatigue. He is lying in bed, head resting on a pillow, partially covered by a blanket. The room behind him is dim, slightly messy, with faint shadows and minimal visible detail.\n\nCamera behavior:\n- Handheld iPhone front camera\n- Very close framing to face (intimate, slightly awkward angle)\n- Natural micro-shake from one hand holding the phone\n- One small grip adjustment around 5–6 seconds\n- Slight breathing movement affecting framing\n- Occasional tiny autofocus adjustment from screen light\n\nLighting:\n- Only phone screen illumination (cool blue tone)\n- Uneven light across face\n- Soft shadows, no artificial lighting\n- Realistic iPhone HDR noise in darker areas\n\nPerformance:\nHe starts recording mid-moment, like he didn’t plan to film.\n\n0–3s:\nHe stares at the screen, then slightly frowns.\n“Tío… acabo de darme cuenta de algo bastante triste…”\n\n3–7s:\nLooks back at phone, slight pause.\n“Llevo aquí… no sé… ¿una hora?”\nSmall awkward laugh.\n\n7–11s:\nShakes head slightly, eyes tired.\n“Es que ni sé qué estoy viendo ya… solo estoy deslizando.”\n\n11–13s:\nLowers phone slightly, exhales.\n“En plan… entro un momento y desaparezco.”\n\n13–15s:\nLooks directly into camera, more grounded tone.\n“Me bajé una app que me corta el scroll cuando me paso…”\nSmall shrug.\n“Yo qué sé… yo la estoy probando porque esto ya era absurdo.”\n\nEnvironment audio:\n- Very subtle room silence\n- Light fabric movement from blanket\n- Soft breathing sounds\n- No music, no background effects\n\nStrict realism rules:\n- No filters, no smoothing\n- Skin texture fully visible\n- No cinematic lighting\n- No perfect framing\n- No product shown\n- No captions\n- One continuous take\n- Natural imperfections preserved\n\nVideos de ejemplo:"
          },
          {
            "t": "vid",
            "v": "118uVKyiq0WxOE2zBB291fMJbrI0ABIu7"
          },
          {
            "t": "head",
            "v": "Selfie en baño durante una cita (perfume de feromonas)",
            "x": "Selfie grabado **en el baño en plena cita**, con energía nerviosa, voz baja y sensación de \"me escapé un segundo para contarte esto\". Pensado para **perfumes de feromonas** o recomendaciones urgentes y secretas; adaptás el guión de los primeros segundos y mantenés la urgencia."
          },
          {
            "t": "prompt",
            "v": "A handheld smartphone selfie video filmed inside a small bar or restaurant bathroom at night. The lighting is slightly harsh and uneven, typical of a real bathroom, with warm tones and soft shadows. The environment feels authentic: sink, mirror edges, paper towels, slightly cluttered counter.\n\nA woman in her late 20s stands near the sink, holding her phone in a casual front-camera angle. The framing is imperfect, slightly cropped, with subtle hand movement.\n\nIMPORTANT: The scene must feel urgent, private, and real — like she stepped away from an active date to record this quickly. Slight nervous energy and lowered voice.\n\n0–3s:\nShe quickly looks at the camera, slightly breathy, adjusting the phone.\nIn Spanish (Spain), natural tone:\n“Estoy en una cita ahora mismo y he tenido que venirme al baño un segundo—”\n\n3–6s:\nShe glances toward the bathroom door, lowers her voice:\n“porque me está pasando algo raro.”\n\n6–10s:\nSmall pause, thinking:\n“El chico está como… súper pendiente de mí todo el rato.”\n\n10–14s:\nShe shrugs slightly:\n“No en plan intenso, pero… diferente.”\n\n14–18s:\nShe leans slightly closer to the camera:\n“Y es que lo único distinto hoy es esto—”\nShe reaches into her bag and pulls out a small perfume bottle that was already there.\n\n18–22s:\n“Me dijeron que llevaba feromonas…”\nShe gives a small skeptical laugh.\n\n22–25s:\n“y yo en plan: vale, claro.”\nShe looks at the bottle, then back at the camera.\n\n25–28s:\n“pero no sé, eh… porque es que se está notando.”\nTone slightly more convinced, still unsure.\n\n28–30s:\nShe quickly puts the perfume back into her bag, glances again toward the door.\n\nFinal line, softer, intimate:\n“No sé si es esto o qué, pero… yo lo estoy probando y os iré actualizando.”\n\nCamera style: handheld smartphone, front camera, slight shake, imperfect framing.\nLighting: realistic bathroom lighting, no studio setup.\nPerformance: natural, slightly nervous, confidential, pauses and micro-reactions.\nEnvironment: real bathroom, slightly messy, believable.\nProduct interaction: quick, casual, not centered, taken from bag naturally.\nTone: intimate, spontaneous, not an ad, like sharing a secret."
          },
          {
            "t": "vid",
            "v": "11ye6TLH4yDFPWt6JuZXBdz5OlWko4WBn"
          },
          {
            "t": "head",
            "v": "Selfie en coche de noche (colonia de feromonas)",
            "x": "Misma línea de feromonas pero con avatar **masculino dentro de un coche de noche**, interior desordenado y faros que pasan cambiando la exposición. Usalo para **colonia de feromonas** con ángulo masculino; cambiás producto y mercado dejando el look de luz baja y encuadre imperfecto."
          },
          {
            "t": "prompt",
            "v": "A hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed inside a parked car at night on a dim street.\n\nEnvironment:\n- natural, slightly messy car interior\n- passenger seat with random items (hoodie, keys)\n- faint streetlights outside\n- occasional passing headlights creating soft exposure changes\n\nCharacter:\n- Spanish/Latino male, 25–30\n- light stubble\n- slightly messy hair\n- casual hoodie or t-shirt\n- natural skin texture, visible pores, slight tired eyes\n\nCamera:\n- handheld front camera\n- slight micro-shake\n- imperfect framing (too close, off-center)\n- one subtle grip adjustment around 5–6 seconds\n- slight autofocus pulse when leaning forward\n\nLighting:\n- low-light iPhone HDR look\n- dashboard glow + streetlights\n- soft uneven shadows\n- no artificial lighting\n\nAudio:\n- raw iPhone mic\n- slight car interior echo\n- faint outside traffic\n- natural breathing, small pauses, mouth clicks\n\nPerformance:\n- confused, amused tone\n- like sending a voice note to a friend\n- looks away often (windshield, passenger seat)\n- not locked to camera\n\nScript (~15 seconds):\n\n“Bro… acabo de pasar una situación rarísima…\nAcabo de salir de una tienda… y la chica… se me queda mirando TODO el rato… pero exagerado…\ny luego me suelta que qué colonia llevo… yo en plan nada especial…\npero llevo una de estas de pheromonas…\ny te juro que esto ya me ha pasado varias veces… no sé si es eso… pero algo hay… yo lo estoy usando”\n\nAction:\n- starts mid-thought\n- slight phone adjustment at beginning\n- awkward laugh\n- grabs cologne from passenger seat naturally\n- brings it loosely into frame (not centered)\n- lowers it casually at the end\n\nRules:\n- no product close-up\n- no perfect framing\n- no captions\n- no music\n- one continuous take\n- no transitions\n- realistic hands (no distortion)\n- natural imperfect UGC behavior\n\nVideos de ejemplo:"
          },
          {
            "t": "vid",
            "v": "1WOUvxKUnZboYDRVp08JUQBsWXC-mGk91"
          },
          {
            "t": "head",
            "v": "Selfie en cocina (hinchazón post-comida / gomitas suplemento)",
            "x": "Selfie en una **cocina luminosa y aesthetic** a media mañana, con avatar femenino y look natural post-entreno. Encaja con **suplementos / gomitas** para digestión o hinchazón post-comida; sustituís el producto y aprovechás el ambiente cálido y cotidiano."
          },
          {
            "t": "prompt",
            "v": "A hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed in a bright, aesthetic modern kitchen in Spain during late morning.\n\nEnvironment:\nA clean but lived-in aesthetic kitchen with warm tones, natural materials (wood countertop, soft beige or white cabinets), subtle decor (plants, fruit bowl, olive oil bottle). The space feels real, not staged — slight everyday mess (cutting board, knife, half-cut fruit). Natural sunlight enters from a side window creating soft highlights and shadows.\n\nSubject:\nA Spanish woman, 24–30 years old, blonde, natural beauty. Light skin with real texture, minimal makeup, slightly flushed post-workout look. Wearing a fitted sports top and leggings. Hair tied in a loose messy bun or ponytail.\n\nCamera behavior:\n- iPhone front camera realism\n- Phone casually placed on the counter, slightly low angle\n- Imperfect framing (top of head slightly cropped at times)\n- Subtle micro-shake from surface contact\n- One small natural phone adjustment at second 6–7\n- Slight autofocus breathing when she leans forward\n- Natural HDR exposure with mild shadow noise\n\nPerformance:\nShe feels like she pressed record mid-thought. Slight hesitation, natural pauses, looking away briefly.\n\nTimeline:\n\n0–3s:\nShe looks at the camera already recording, slight discomfort.\n“Después de comer siempre es la misma historia…”\nTouches her stomach naturally.\n\n3–7s:\n“hinchada como un pez globo”\nShe looks down, slight frustration.\n\n7–11s:\n“ya no sabía que mas hacer hasta que me dijeron que”\nLeans on the counter, exhales softly.\n“muchas veces es por falta de vitaminas, fibra, micronutrientes…”\n\n11–15s:\nShe casually grabs a green gummy supplement package from the counter without presenting it clearly.\n“y empecé con esto hace nada…”\nShort pause.\n“ya no tengo esa sensación todo el día encima”\n\nFinal seconds:\nShe looks back at the camera, relaxed tone.\n“aquí tenéis el link por si a alguna le pasa lo mismo.”\n\nAudio:\n- Raw iPhone microphone\n- Slight room echo\n- Subtle ambient kitchen noise\n- Natural breathing, soft pauses\n\nStrict realism rules:\n- No beauty filters\n- No cinematic color grading\n- No perfect framing\n- No product showcasing like an ad\n- No exaggerated gestures\n- No face distortion or eye drift\n- Natural lip sync maintained\n\nThe final result must feel like a real Spanish TikTok recorded casually in one take, not an advertisement."
          },
          {
            "t": "vid",
            "v": "1Mph33v0yDVeDCNV9FnCgwPooP9XjqjzH"
          },
          {
            "t": "head",
            "v": "Selfie en fila del súper (app de finanzas / invertir)",
            "x": "Selfie casual **en la fila de la caja del súper**, con luz fluorescente dura y ruido ambiente real, como quien suelta un pensamiento mientras espera. Sirve para **apps de finanzas / invertir** u ofertas de \"tip rápido\"; cambiás el mensaje y mantenés el aire improvisado y sin producción."
          },
          {
            "t": "prompt",
            "v": "A hyper-realistic 9:16 iPhone 15 Pro front-camera selfie video filmed in a supermarket checkout line in Spain. The scene feels completely natural and unplanned, like a real person recording a quick thought while waiting to pay.\n\nENVIRONMENT:\nA real Spanish supermarket checkout lane. Conveyor belt with groceries (basic items like milk, pasta, snacks). People slightly out of focus in the background. Cash register beeping occasionally. Ambient noise: low chatter, scanner sounds, subtle bag movement. Lighting is typical supermarket fluorescent lighting — slightly harsh, uneven, natural shadows, no cinematic correction.\n\nSUBJECT:\nMale, 23–30 years old, Spanish, average guy look. Slightly messy hair, casual hoodie or t-shirt. Natural skin texture (visible pores, slight eye fatigue). No makeup, no filters. Expression: mildly stressed but calm, like thinking out loud.\n\nCAMERA:\nHandheld iPhone front camera.\n- Slight natural hand shake\n- Imperfect framing (face slightly off-center at times)\n- One small grip adjustment around second 6\n- Minor autofocus shift when phone moves closer\n- Realistic iPhone HDR behavior (screen slightly overexposed when shown)\n\nBEHAVIOR:\nStarts recording mid-thought, not posed.\nLooks briefly at groceries, then back to camera.\nOpens the finance app naturally.\nShows the phone screen quickly and imperfectly (NOT centered, slight angle, slight brightness blowout).\nScrolls or taps once naturally.\n\nTIMING + SCRIPT DELIVERY (fast, natural pacing ~15s):\n\n0–2s (Hook)\n“este es el momento donde dices vale algo no cuadra”\n\n2–5s (Problem)\n“vienes a por cuatro cosas y mira”\n(glances at groceries, slight head shake)\n\n5–8s (Reveal)\n(opens app)\n“esto es lo que llevo gastado”\n\n8–12s (Shift + Value)\n“yo antes iba a ciegas total”\n“ahora veo esto y además me está enseñando a invertir sin tener ni idea”\n\n12–15s (CTA)\n(quickly shows phone, imperfect angle)\n“en plan paso a paso”\n“si estás igual… échale un ojo”\n\nAUDIO:\nRaw iPhone microphone audio.\n- Supermarket ambient noise present\n- Slight echo and natural imperfections\n- No music, no voice enhancement\n\nVISUAL REALISM RULES (MANDATORY):\n- No filters, no cinematic color grading\n- No perfect framing\n- No smooth or artificial skin\n- No product glamour shots\n- Phone screen must look real (slight overexposure, natural reflection)\n- Natural blinking, breathing, and micro facial movements\n- No exaggerated gestures\n- No AI artifacts in hands or fingers\n\nFINAL FEEL:\nLooks like a real Spanish guy casually recording a moment of financial realization in the supermarket.\nNot an ad. Not polished. Feels relatable, slightly uncomfortable, and honest.\n\nVideos de ejemplo:"
          },
          {
            "t": "vid",
            "v": "1JOpLOoDynu8PNxH3SwK9wnN-AeC_hfex"
          }
        ],
        "clases": [
          2
        ],
        "intro": "Esta **mini biblioteca** (en **Notion**) es un catálogo de videos ya generados con **Sora 2** junto al **prompt exacto** que los produjo. En Sora el prompt lo es todo: la diferencia entre un video plástico y uno que parece grabado con el móvil está en cómo estructurás el prompt (encuadre, cámara, sujeto, iluminación, audio y guión frase por frase). En vez de arrancar de cero, acá tenés ejemplos que ya funcionaron para copiar y adaptar.\n\nCómo se usa:\n\n- **Elegí el ejemplo** — buscá el que más se parezca a tu ángulo, avatar o mercado (selfie fitness, entrevista callejera, confesión de noche, etc.).\n- **Copiá el prompt** — está completo y estructurado; usalo como plantilla en lugar de escribirlo a mano.\n- **Cambiá lo tuyo** — ajustás producto, avatar (edad/género/look) y mercado, y dejás intacta la estructura que hace que se vea real.\n- **Generá en KIE** — pegás el prompt en **Sora 2 Image-to-Video** estable, subís la imagen del producto, ponés **9:16** vertical tipo TikTok, **15 segundos**, y le das a generar (te sale ~**15 céntimos** por video).\n\nVa de la mano con el agente de prompts de Sora: el agente te arma un prompt nuevo desde cero, y esta biblioteca te da referencias ya probadas para inspirarte o partir de ahí."
      },
      {
        "slug": "plantilla-veo",
        "label": "Plantilla de prompts Veo 3",
        "tipo": "notion",
        "cardDesc": "Los 14 bloques de un prompt de video Veo 3.1, con ejemplos.",
        "texto": "Plantilla de prompts Veo — Prompts VEO3\n\n1) Formato y tipo de vídeo\n  - formato: 9:16\n  - dispositivo: iPhone front-camera selfie\n  - tipo de captura: handheld\n  - objetivo visual: hyper-realistic, casual UGC, not cinematic\n\nEjemplo\nA hyper-realistic 9:16 handheld iPhone front-camera selfie video.\n\nEmpezamos con instrucciones visuales claras de cámara y estilo, y 9:16 es especialmente adecuado para TikTok, Reels y Shorts.\n\n2) Identidad del personaje\n  - edad aproximada\n  - nacionalidad / tipo de español\n  - aspecto general\n  - si hay referencia: que la identidad coincida exactamente\n\nEjemplo:\nThe exact same woman from the provided reference images. Identity, face, skin texture, hair, and outfit must match perfectly at all times.\n\nGoogle también recomienda usar referencias visuales y flujos guiados por imágenes para mejorar consistencia.\n\n3) Entorno\n  - lugar\n  - hora del día\n  - tipo de luz\n  - ambiente general\n  - si debe coincidir con un frame de referencia\n\nEjemplo:\nOutdoor modern residential area with palm trees and light-colored buildings. Natural daylight only. Slightly imperfect lighting. No cinematic look.\n\nDefiniciones muy concretas.\n\n4) Acción principal\n  - 1 acción principal + 1 micro-acción secundaria\n\nEjemplo:\nShe is lightly jogging while recording herself in selfie mode and speaking naturally to camera.\n\nUn clip de 8 segundos no es para meter 5 acciones.\n\n5) Física humana\nEste bloque es clave en UGC porque el mayor fallo suele ser el movimiento falso.\n  - ritmo natural\n  - pequeños errores\n  - microshake\n  - respiración\n  - rebote vertical\n  - movimientos no repetitivos\n\nEjemplo:\nShe moves in a completely natural human way: slight vertical bounce, subtle side-to-side sway, natural shoulder movement, inconsistent micro-movements, and breathing that subtly affects motion and speech.\n\nNo vale con decir natural, el prompt tiene que definir que significa \"natural\".\n\n6) Idioma y forma de hablar\nImportante especificar idioma, en español de España sobretodo para que no lo haga con acento latino.\n\nEjemplo:\nUse informal conversational Spanish as spoken in Spain. The phrasing, rhythm, and wording must feel like a real casual conversation between people in Spain. Include natural filler words and imperfections typical in Spain, such as:\n- \"a ver…\"\n- \"es que…\"\n- small pauses and hesitations\n\nAvoid neutral or generic Spanish phrasing. She speaks in authentic Castilian Spanish from Spain, with natural rhythm, slight hesitations, and informal cadence typical of real speech. Not Latin American Spanish.\n\n7) Tono emocional\nEsto controla si parece anuncio, actriz, o persona real.\n\nQué poner:\n  - calm\n  - confident\n  - reflective\n  - casual\n  - not selling\n  - not performing\n\nEjemplo:\nTone: calm, reflective, slightly confident, like talking to someone while exercising, not performing and not selling anything.\n\n8) Script\n  - corto\n  - fácil de pronunciar\n  - con pausas reales\n  - pensado para 8 segundos\n\n9) Comportamiento\nEste bloque define cómo habla mientras hace la acción.\n  - empieza a hablar ya en marcha\n  - mira fuera de cámara un momento\n  - parpadea\n  - respira\n  - se recoloca\n  - no parece ensayado\n\nEjemplo:\nShe keeps jogging during the entire clip, starts speaking slightly mid-thought, blinks naturally, briefly glances away, and has subtle pauses between phrases.\n\n10) Cámara\nEn UGC este bloque cambia todo.\n  - handheld\n  - off-center framing\n  - no stabilization\n  - autofocus shifts\n  - rolling shutter\n  - phone handling artifacts\n\nEjemplo:\nHandheld iPhone selfie, slightly off-center framing, natural micro-shake from movement, minor autofocus adjustments, rolling shutter effect, no stabilization.\n\n11) Luz\nLa luz demasiado perfecta mata el UGC.\n\nEjemplo:\nNatural daylight only, slight exposure changes while moving, soft uneven shadows.\n\n12) Audio\nGoogle recomienda describir diálogo, ambiente y efectos de sonido.\n  - raw iPhone microphone\n  - light wind\n  - distant traffic\n  - breathing\n  - no music\n\nEjemplo:\nAudio: raw iPhone microphone, light wind, distant ambient outdoor noise, audible breathing, no music.\n\n13) Negative prompt\nSirve para decirle al modelo lo que NO quieres.\n\nEjemplo:\nNegative prompt: studio lighting, beauty filter, perfect skin, ad-like polish, exaggerated gestures, robotic delivery, over-sharpening, artificial background, unnatural motion, flicker.\n\n14) Start frame / End frame\nSi hay referencias, este bloque es de los más potentes.\nGoogle soporta first frame y last frame para guiar la transición entre ambos estados.\n\nEjemplo:\nSTART FRAME\nMatches the first reference image: she is already jogging in selfie mode wearing sunglasses.\n\nEND FRAME\nMatches the second reference image: she has removed the sunglasses and is slightly closer to camera while still jogging.\n\nPlantilla",
        "capturasDriveId": "1xkG-GcJE6ljIc0jJO6FnCgWd31jJ6hbP",
        "notionUrl": "https://www.notion.so/Prompts-VEO3-1-33dec2aef76b80e1a121c3291728a1cb",
        "clases": [
          2
        ],
        "intro": "La **Plantilla de prompts Veo 3** es un documento de **Notion** que desarma un prompt de video en sus **14 bloques**, cada uno con su explicación y un ejemplo listo para copiar. Ataca lo que más pesa en **Veo 3.1**: acá el prompt lo es todo, y la diferencia entre uno genérico y uno bien estructurado es la diferencia entre un video que se nota falso y un **UGC hiperrealista** que parece grabado con el móvil. En vez de escribir de memoria, seguís la lista bloque por bloque y no te olvidás de nada (encuadre, cámara, identidad del personaje, entorno, física humana, idioma, tono…).\n\nCómo se usa:\n- **Copiás la estructura** — armás tu prompt siguiendo los 14 bloques en orden, sin saltarte ninguno.\n- **Rellenás cada bloque con lo tuyo** — tu producto, tu avatar y tu mercado; la base UGC (formato **9:16**, cámara selfie de iPhone, **handheld**) ya viene definida.\n- **Los ejemplos van en inglés** — pegás los bloques de ejemplo tal cual y solo cambiás los detalles (edad, nacionalidad, entorno, idioma hablado).\n- **Ojo con el idioma hablado** — si querés español de España, hay que pedirlo explícito y con muletillas tipo \"a ver…\", \"es que…\" para que no salga con acento latino.\n- **Un clip = una acción** — cada clip es de ~**8 segundos**; metés 1 acción principal + 1 micro-acción, no cinco cosas a la vez."
      },
      {
        "slug": "trends",
        "label": "Trends virales",
        "tipo": "notion",
        "cardDesc": "Cómo apalancarte en trends virales de TikTok para tus anuncios, con los prompts.",
        "texto": "recreate this image changing \nher factions to European. \nNo text in the image\n\n───\n\nSame person from the reference \nimage, identical identity and \nlook. Only a slight natural \nchange in pose or angle, \nlike a real movement between \nframes.\n\n───\n\nCreate a natural transition from the first frame to \nthe second frame. The same person\nmust remain identical. \nMovement should be subtle and \nrealistic, as if recorded in \none continuous take.\n\n───\n\nSame person from the reference image. Maintain identical identity, facial structure, skin tone, eyes, lips, and overall look.\n\nNow show her with clear, smooth, radiant skin, free of acne, natural glow, and even texture. Skin must still look realistic (visible pores, not overly perfect or plastic).\n\nFraming:\n- from waist up (mid shot)\n- vertical 9:16 composition\n\nAppearance:\n- wearing a red tank top (simple, fitted)\n- french manicure nails (natural, clean, subtle white tips)\n- hand placed gently under her neck in a relaxed, natural pose\n\nExpression:\n- soft, confident, natural\n- slight relaxed smile\n\nLighting:\n- soft indoor lighting\n- warm, natural tones\n- realistic shadows\n\nEnvironment:\n- neutral indoor background (bedroom or bathroom)\n- minimal, clean, not distracting\n\nIMPORTANT:\n- no redesign of face\n- no change in identity\n- no over-smoothing or fake skin\n- must look like the same real person after improvement\n\nStyle:\n- hyper-realistic\n- iPhone camera look\n- natural imperfections preserved (except acne)\n\n───\n\nSame person from the reference \nimage, identical identity and \nlook. Only a slight natural \nchange in pose or angle, \nlike a real movement between \nframes. Her face is closer to \nthe camera, she is showing her \nskin improvement.\n\n───\n\nCreate a natural transition from the first frame to \nthe second frame. The same person\nmust remain identical. \nMovement should be subtle and \nrealistic, as if recorded in \none continuous take.\n\n───\n\nSame person from the reference image. Maintain identical identity, face, skin tone, hair, and overall appearance.\n\nThe product shown must EXACTLY match the reference product image:\n- same packaging\n- same color\n- same label\n- same shape\n- no redesign\n\nScene:\n\nA hyper-realistic close-up iPhone selfie-style image.\n\nShe is holding the product naturally in her hand, bringing it close to her face, slightly below or next to her cheek.\n\nFraming:\n- close-up (head and upper chest visible)\n- vertical 9:16\n- product clearly visible but not perfectly centered (natural UGC)\n\nPose & behaviour:\n- relaxed, natural pose\n- slightly tilting her head\n- hand holding the product casually (not stiff, not posing like an ad)\n- product near her cheek, as if showing it to a friend\n\nExpression:\n- soft, confident, natural\n- slight relaxed smile\n\nSkin:\n- clear, radiant, natural glow\n- realistic texture (visible pores, no over-smoothing)\n\nLighting:\n- soft natural indoor light\n- slightly warm tones\n- realistic shadows\n\nEnvironment:\n- simple indoor background (bedroom or bathroom)\n- clean but not studio-like\n\nCamera:\n- iPhone front camera look\n- slight imperfection in framing\n- natural feel (not commercial photography)\n\nIMPORTANT:\n- do NOT make it look like a studio ad\n- do NOT over-style the product\n- do NOT change identity\n- do NOT make skin fake or plastic\n\nStyle:\n- hyper-realistic\n- authentic UGC aesthetic\n\n───\n\nA hyper-realistic 9:16 iPhone front-camera selfie video using the exact same woman and product from the reference images.\n\nThe woman and the product must remain identical:\n- same face, skin, hair, outfit\n- same product packaging, label, color, shape\n- no redesign, no changes\n\n---\n\nSTART FRAME\n\nMatches the reference image:\n- woman holding the product close to her face\n- relaxed pose, natural expression\n\n---\n\nCRITICAL ACTION (VERY IMPORTANT)\n\nIn the FIRST 1–2 seconds:\n\n- she quickly and naturally gives a small kiss to the product (playful, subtle, not exaggerated)\n- immediately after, she brings the product slightly closer toward the camera\n\nThe movement must feel:\n- spontaneous\n- casual\n- like a real moment, not acting\n\n---\n\nMOVEMENT FLOW\n\n- kiss → slight smile → push product closer to camera\n- product comes slightly forward but stays in frame (not blocking completely)\n- small natural hand movement and micro-shake\n\n---\n\nTONE & EMOTION\n\n- she loves the product\n- expression: soft smile, confident, natural\n- no overacting, no “ad energy”\n\n---\n\nBEHAVIOUR\n\n- slight head tilt\n- natural blinking\n- relaxed posture\n- subtle micro-expressions\n\n---\n\nCAMERA\n\n- handheld iPhone selfie\n- slight natural micro-shake\n- imperfect framing\n- no stabilization\n- product briefly closer to lens during movement\n\n---\n\nLIGHTING\n\n- soft natural indoor light\n- realistic shadows\n- no studio lighting\n\n---\n\nAUDIO\n\n- no music\n- optional: soft natural breath or subtle “mm” sound after kiss\n- raw iPhone feel\n\n---\n\nSTYLE RULES\n\n- no cinematic look\n- no filters\n- no over-smoothing\n- must feel like real UGC\n\n---\n\nEND\n\nShe holds the product slightly closer to camera, smiling subtly, as if about to keep talking in the next clip.",
        "capturasDriveId": "18FZu-CeGNEjldaz4UlLH4xGM9HudsXhU",
        "notionUrl": "https://www.notion.so/Trend-Virales-Ads-Ejemplo-33eec2aef76b8003b4f3fc61d9dd1dfd",
        "bloques": [
          {
            "t": "head",
            "v": "EL ANTES",
            "x": "El primer bloque: el estado **problema** del avatar (piel con acné). Acá generás la referencia y su clip de arranque, que es el gancho del anuncio."
          },
          {
            "t": "label",
            "v": "Referencia - Original",
            "x": "La imagen de partida que subís como base. De acá el modelo copia el encuadre y la persona para no inventar de cero."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A21b6b289-a846-40aa-a394-3e5208f46b62%3Aframe-1.png?table=block&id=33eec2ae-f76b-80d8-9556-d7e371e9f169&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Prompt",
            "x": "Recrea la imagen de referencia pero cambiando los rasgos de la cara a **europeos** y sin texto. Lo usás para adaptar una referencia ajena a tu mercado (acá **España**) sin que se note que la copiaste."
          },
          {
            "t": "prompt",
            "v": "recreate this image changing \nher factions to European. \nNo text in the image"
          },
          {
            "t": "label",
            "v": "Resultado - Antes 1",
            "x": "El frame que devuelve el modelo con ese prompt: tu avatar **antes**, con la piel con problemas. Es la primera imagen fija del bloque."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Afb31e45a-5e15-40bb-ba15-76a1770c3270%3A1775845838069-pa6ysmo2fc.png?table=block&id=33eec2ae-f76b-80c2-88f7-c3f026a5d39b&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Referencia Antes - Frame 1",
            "x": "La imagen **antes** que vas a usar como primer frame del clip. Es el punto de arranque de la transición."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Afb31e45a-5e15-40bb-ba15-76a1770c3270%3A1775845838069-pa6ysmo2fc.png?table=block&id=33eec2ae-f76b-804f-b10a-c2c67b718164&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Prompt",
            "x": "Genera un segundo frame con la **misma persona idéntica** y solo un cambio mínimo de pose o ángulo, como un movimiento real entre fotogramas. Sirve para tener un frame final apenas distinto que el video pueda animar."
          },
          {
            "t": "prompt",
            "v": "Same person from the reference \nimage, identical identity and \nlook. Only a slight natural \nchange in pose or angle, \nlike a real movement between \nframes."
          },
          {
            "t": "label",
            "v": "Transición - Video",
            "x": "Anima el paso del **frame 1 al frame 2** manteniendo idéntica a la persona, con movimiento sutil como si fuera una sola toma continua. Este es el prompt que convierte tus dos imágenes fijas en un clip."
          },
          {
            "t": "prompt",
            "v": "Create a natural transition from the first frame to \nthe second frame. The same person\nmust remain identical. \nMovement should be subtle and \nrealistic, as if recorded in \none continuous take."
          },
          {
            "t": "label",
            "v": "Resultado Antes - Frame 2",
            "x": "El fotograma final del clip del **antes**. Junto con el Frame 1 marca el principio y el fin del movimiento."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A1fee9fcb-5728-4234-90ab-43746255ca46%3A1775847640946-j7vyu5ay8u.jpg?table=block&id=33eec2ae-f76b-80f0-95dd-c061741da9f9&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "head",
            "v": "EL DESPUÉS",
            "x": "El segundo bloque: el mismo avatar pero transformado (piel sana, radiante). Es el **resultado** que promete el producto y el contraste que hace viral el formato."
          },
          {
            "t": "label",
            "v": "Referencia - Después",
            "x": "La imagen base para el estado **después**. Se parte del mismo personaje para que se note que es la misma persona, ahora mejorada."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Afb31e45a-5e15-40bb-ba15-76a1770c3270%3A1775845838069-pa6ysmo2fc.png?table=block&id=33eec2ae-f76b-8064-87e4-ed24128798c6&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Prompt",
            "x": "Mantiene la misma identidad (cara, ojos, tono de piel) pero le da piel limpia y radiante, todavía realista (con poros, no plástica); además fija el encuadre de medio cuerpo en **9:16**, la remera roja, las uñas y la pose. Es el prompt clave del **después**: mismo rostro, piel arreglada."
          },
          {
            "t": "prompt",
            "v": "Same person from the reference image. Maintain identical identity, facial structure, skin tone, eyes, lips, and overall look.\n\nNow show her with clear, smooth, radiant skin, free of acne, natural glow, and even texture. Skin must still look realistic (visible pores, not overly perfect or plastic).\n\nFraming:\n- from waist up (mid shot)\n- vertical 9:16 composition\n\nAppearance:\n- wearing a red tank top (simple, fitted)\n- french manicure nails (natural, clean, subtle white tips)\n- hand placed gently under her neck in a relaxed, natural pose\n\nExpression:\n- soft, confident, natural\n- slight relaxed smile\n\nLighting:\n- soft indoor lighting\n- warm, natural tones\n- realistic shadows\n\nEnvironment:\n- neutral indoor background (bedroom or bathroom)\n- minimal, clean, not distracting\n\nIMPORTANT:\n- no redesign of face\n- no change in identity\n- no over-smoothing or fake skin\n- must look like the same real person after improvement\n\nStyle:\n- hyper-realistic\n- iPhone camera look\n- natural imperfections preserved (except acne)"
          },
          {
            "t": "label",
            "v": "Resultado - Después",
            "x": "La imagen fija del avatar ya transformado que devuelve ese prompt."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Add14dcd0-eb7a-4788-b6a3-bf62869c99be%3Adea3be75197f0f9293b954f2ebfcfda9_1775865920_awe6x0xx.jpg?table=block&id=33fec2ae-f76b-8023-bdce-df0a9192b903&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Referencia Después - Frame 1",
            "x": "La imagen **después** que arranca el segundo clip. Igual que en el antes, es el primer frame de la transición."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Add14dcd0-eb7a-4788-b6a3-bf62869c99be%3Adea3be75197f0f9293b954f2ebfcfda9_1775865920_awe6x0xx.jpg?table=block&id=33fec2ae-f76b-8041-9c4c-cd970ba05570&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Prompt",
            "x": "Genera el segundo frame con la misma persona, pero **acercando la cara a la cámara** para que luzca la mejora de la piel. Le da al clip un movimiento con intención: mostrar el resultado de cerca."
          },
          {
            "t": "prompt",
            "v": "Same person from the reference \nimage, identical identity and \nlook. Only a slight natural \nchange in pose or angle, \nlike a real movement between \nframes. Her face is closer to \nthe camera, she is showing her \nskin improvement."
          },
          {
            "t": "label",
            "v": "Transición - Video",
            "x": "Anima el paso del frame 1 al 2 del **después**, personaje idéntico y movimiento sutil de una sola toma. Es el mismo prompt de transición del antes, reutilizado."
          },
          {
            "t": "prompt",
            "v": "Create a natural transition from the first frame to \nthe second frame. The same person\nmust remain identical. \nMovement should be subtle and \nrealistic, as if recorded in \none continuous take."
          },
          {
            "t": "label",
            "v": "Resultado Después - Frame 2",
            "x": "El fotograma final del clip del **después**: la cara más cerca, luciendo la piel sana."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Aed766e15-dcbf-4854-95c9-5a406e1685f2%3A1775866978570-i91wqdgniz.jpg?table=block&id=33fec2ae-f76b-80cc-bc3e-d520a3447eee&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "head",
            "v": "EL PRODUCTO",
            "x": "El tercer bloque: la chica con el **producto** en mano. Es el cierre del anuncio, donde conectás la transformación con lo que vendés."
          },
          {
            "t": "label",
            "v": "Chica + producto",
            "x": "La toma que combina tu avatar con el producto. Acá lo importante es que el envase se vea **exacto** al real."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Ae4ba4132-61d2-4be6-8fae-e53017b911b5%3ATiranta_anti-aging_niacinamide_serum.png?table=block&id=33fec2ae-f76b-8064-97a5-ebd6fd5eeb8d&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A991dbc20-61f2-4fe5-8c41-10ca3fe28a69%3A1775866978570-i91wqdgniz.jpg?table=block&id=33fec2ae-f76b-8041-b0e1-f589f1038879&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Prompt",
            "x": "Mantiene idéntica a la persona y —clave— el **producto EXACTO** al de tu referencia (mismo packaging, color, etiqueta, forma, sin rediseño); lo pone en un selfie close-up estilo iPhone en **9:16**, sostenido de forma natural tipo **UGC**. Lo usás para el plano de producto sin que la IA te invente otro envase."
          },
          {
            "t": "prompt",
            "v": "Same person from the reference image. Maintain identical identity, face, skin tone, hair, and overall appearance.\n\nThe product shown must EXACTLY match the reference product image:\n- same packaging\n- same color\n- same label\n- same shape\n- no redesign\n\nScene:\n\nA hyper-realistic close-up iPhone selfie-style image.\n\nShe is holding the product naturally in her hand, bringing it close to her face, slightly below or next to her cheek.\n\nFraming:\n- close-up (head and upper chest visible)\n- vertical 9:16\n- product clearly visible but not perfectly centered (natural UGC)\n\nPose & behaviour:\n- relaxed, natural pose\n- slightly tilting her head\n- hand holding the product casually (not stiff, not posing like an ad)\n- product near her cheek, as if showing it to a friend\n\nExpression:\n- soft, confident, natural\n- slight relaxed smile\n\nSkin:\n- clear, radiant, natural glow\n- realistic texture (visible pores, no over-smoothing)\n\nLighting:\n- soft natural indoor light\n- slightly warm tones\n- realistic shadows\n\nEnvironment:\n- simple indoor background (bedroom or bathroom)\n- clean but not studio-like\n\nCamera:\n- iPhone front camera look\n- slight imperfection in framing\n- natural feel (not commercial photography)\n\nIMPORTANT:\n- do NOT make it look like a studio ad\n- do NOT over-style the product\n- do NOT change identity\n- do NOT make skin fake or plastic\n\nStyle:\n- hyper-realistic\n- authentic UGC aesthetic"
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A86eaaa45-b13e-41d2-a961-5a942fb62185%3A1775870331990-pk12dy68r1.jpg?table=block&id=33fec2ae-f76b-80b4-ac11-c21dfaf0a37d&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Animación",
            "x": "Anima ese selfie: en los primeros **1-2 segundos** la chica le da un besito rápido y natural al producto y lo acerca a la cámara, con movimiento espontáneo y casual. Es el clip de cierre que le da gracia y humanidad al plano de producto."
          },
          {
            "t": "prompt",
            "v": "A hyper-realistic 9:16 iPhone front-camera selfie video using the exact same woman and product from the reference images.\n\nThe woman and the product must remain identical:\n- same face, skin, hair, outfit\n- same product packaging, label, color, shape\n- no redesign, no changes\n\n---\n\nSTART FRAME\n\nMatches the reference image:\n- woman holding the product close to her face\n- relaxed pose, natural expression\n\n---\n\nCRITICAL ACTION (VERY IMPORTANT)\n\nIn the FIRST 1–2 seconds:\n\n- she quickly and naturally gives a small kiss to the product (playful, subtle, not exaggerated)\n- immediately after, she brings the product slightly closer toward the camera\n\nThe movement must feel:\n- spontaneous\n- casual\n- like a real moment, not acting\n\n---\n\nMOVEMENT FLOW\n\n- kiss → slight smile → push product closer to camera\n- product comes slightly forward but stays in frame (not blocking completely)\n- small natural hand movement and micro-shake\n\n---\n\nTONE & EMOTION\n\n- she loves the product\n- expression: soft smile, confident, natural\n- no overacting, no “ad energy”\n\n---\n\nBEHAVIOUR\n\n- slight head tilt\n- natural blinking\n- relaxed posture\n- subtle micro-expressions\n\n---\n\nCAMERA\n\n- handheld iPhone selfie\n- slight natural micro-shake\n- imperfect framing\n- no stabilization\n- product briefly closer to lens during movement\n\n---\n\nLIGHTING\n\n- soft natural indoor light\n- realistic shadows\n- no studio lighting\n\n---\n\nAUDIO\n\n- no music\n- optional: soft natural breath or subtle “mm” sound after kiss\n- raw iPhone feel\n\n---\n\nSTYLE RULES\n\n- no cinematic look\n- no filters\n- no over-smoothing\n- must feel like real UGC\n\n---\n\nEND\n\nShe holds the product slightly closer to camera, smiling subtly, as if about to keep talking in the next clip."
          }
        ],
        "clases": [
          2
        ],
        "intro": "**Trends virales** es la receta para subirte a un formato que ya está explotando en TikTok —el clásico **antes/después** (glow-up)— y convertirlo en tu propio anuncio, sin pagar plataformas caras tipo **Arcads** o **HeyGen**. En vez de grabar, generás todo con IA barata (**Sora 2** vía **KIE API**, ~**15 céntimos** por clip de 15s) y armás el video pieza por pieza. Este recurso es un doc de Notion con las imágenes de referencia, los prompts exactos y los resultados, ordenados en tres bloques: **EL ANTES**, **EL DESPUÉS** y **EL PRODUCTO**.\n\nCómo se usa:\n- **Generás una imagen base** — con un prompt de edición partís de una referencia y creás el frame inicial (la chica con acné, la piel ya sana, o la chica con el producto).\n- **Creás un segundo frame** — mismo personaje idéntico, con un cambio mínimo de pose o ángulo.\n- **Animás la transición** — un prompt de video une los dos frames en un clip corto y natural, como grabado de una sola toma.\n- **Unís los clips** en edición y te queda el anuncio: antes → después → producto."
      },
      {
        "slug": "ejemplos-ads",
        "label": "Ejemplos de ads de imagen",
        "tipo": "notion",
        "cardDesc": "Anuncios en imagen (before/after, Reddit, revista…) con sus prompts.",
        "texto": "Create a high-converting acne treatment ad image based EXACTLY on a testimonial-style layout.\n\nFORMAT:\nVertical 4:5\n\n---\n\nTOP SECTION (SOCIAL PROOF COMMENT):\n\n- Fake Facebook/Instagram comment card\n- White rounded rectangle with subtle shadow\n- Small circular profile image on the left\n- Username blurred or partially hidden\n\nTEXT (Spanish):\n\n\"Estaba a punto de empezar con Roacutan, pero estoy MUY agradecida de haber probado esto. Después de años con acné hormonal fuerte, esto me ha cambiado la vida 🙌🏻\"\n\nBelow:\n\"Me gusta · Responder · hace 20 h\"\n\n---\n\nMIDDLE SECTION:\n\nSplit screen:\n\nLEFT (ANTES):\n- Real acne, inflamed, redness, oily skin\n- Flash photo look\n- imperfect framing\n\nRIGHT (DESPUÉS):\n- Same girl\n- clear improvement but NOT perfect\n- some marks still visible\n\nLabels:\n\n- Bottom left: \"ANTES\" (dark rectangle)\n- Bottom right: \"DESPUÉS\" (yellow rectangle with check icon)\n\n---\n\nPRODUCT:\n\n- Place product centered overlapping both images\n- Slight rotation for dynamic feel\n- Strong shadow for depth\n\n---\n\nBOTTOM SECTION:\n\n- 5 star rating ⭐⭐⭐⭐⭐\n- Text:\n\"4.7 · Más de 3.000 opiniones\"\n\n---\n\nSTYLE:\n\n- Raw UGC + performance ad\n- NOT clean branding\n- NOT minimal\n- Must feel like a real ad running on Facebook\n\n───\n\nCreate a high-converting [PRODUCT CATEGORY] ad image based EXACTLY on a testimonial + before/after layout.\n\nFORMAT:\nVertical 4:5\n---\nTOP SECTION (SOCIAL PROOF COMMENT):\n- Fake Facebook/Instagram comment card\n- White rounded rectangle with subtle shadow\n- Small circular profile image on the left\n- Username blurred or partially hidden\nTEXT ([MARKET LANGUAGE]):\n\"[TESTIMONIAL — personal story, mention the problem, the turning point, and the result. Authentic tone, NOT salesy. Include 1-2 relevant emojis.]\"\nBelow:\n\"Me gusta · Responder · hace [X] h\"\n---\nMIDDLE SECTION:\nSplit screen:\nLEFT (BEFORE):\n- Show [PROBLEM VISUAL — e.g. acne, excess weight, damaged hair, dirty surface, etc.]\n- Flash photo look, imperfect framing, raw feel\nRIGHT (AFTER):\n- Same person/subject\n- Clear improvement but NOT perfect — must feel real\n- Some traces of the problem still visible for credibility\nLabels:\n- Bottom left: \"[BEFORE LABEL in market language]\" — dark rectangle\n- Bottom right: \"[AFTER LABEL in market language]\" — yellow rectangle with check icon ✓\n---\nPRODUCT:\n- Place [PRODUCT] centered overlapping both images\n- Slight rotation for dynamic feel\n- Strong shadow for depth\n---\nBOTTOM SECTION:\n- 5 star rating ⭐⭐⭐⭐⭐\n- Text: \"[RATING e.g. 4.7] · [SOCIAL PROOF e.g. Más de 3.000 opiniones]\"\n---\nSTYLE:\n- Raw UGC + performance ad\n- NOT clean branding, NOT minimal\n- Must feel like a real ad running on Facebook\n- [Any extra style note for the specific product/market]\n\n───\n\nCreate a high-converting acne ad using a chat conversation layout.\n\nCRITICAL REALISM RULE:\nThe AFTER skin must NOT be perfect.\nIt must still have:\n- small red marks\n- slight uneven tone\n- visible pores\n- subtle texture\nIf skin looks flawless or airbrushed → FAIL.\n\n---\n\nTOP:\n\nRounded image container with BEFORE / AFTER\n\nLEFT (ANTES):\n- real acne\n- redness, inflammation\n- oily shine from flash\n- uneven texture\n- harsh phone flash lighting\n\nRIGHT (DESPUÉS):\n- same exact girl, same angle, same framing\n- acne reduced but still visible\n- light redness remains\n- natural skin texture preserved\n- pores clearly visible\n- NO beauty filter\n\nLighting:\n- BOTH sides must use the SAME iPhone flash style\n- no studio lighting\n- slightly harsh, real\n\n---\n\nCHAT SECTION:\n\niMessage style bubbles\n\nBlue:\n\"Por fin tengo la piel mucho mejor y ni siquiera he terminado el tratamiento 😭\"\n\nGrey:\n\"¿Es ese el producto que trata el acné desde la raíz?\"\n\nBlue:\n\"Sí, pero lo importante es que no destroza la piel como otros 🔥\"\n\n---\n\nPRODUCT:\n\n- bottom center\n- slightly large\n- clean but NOT over-polished\n- subtle shadow\n\n---\n\nBADGE:\n\n\"90 DÍAS GARANTÍA\"\n\n---\n\nSTYLE:\n\n- must feel like screenshot + ad\n- slightly imperfect alignment\n- NOT symmetrical\n- NOT too clean\n\n---\n\nANTI-AI RULES:\n\n- no plastic skin\n- no blur\n- no symmetry\n- no glow effect\n- no \"perfect Instagram skin\"\n\nGOAL:\nFeels like a real girl sent this to her friend, not an ad.\n\n───\n\nCreate a high-converting [PRODUCT CATEGORY] ad using a chat conversation layout.\n\nCRITICAL REALISM RULE:\nThe AFTER result must NOT be perfect.\nIt must still show:\n- [IMPERFECTION 1 — e.g. small red marks]\n- [IMPERFECTION 2 — e.g. slight uneven tone]\n- [IMPERFECTION 3 — e.g. visible pores]\n- [IMPERFECTION 4 — e.g. subtle texture]\nIf result looks flawless or airbrushed → FAIL.\n---\nTOP:\nRounded image container with BEFORE / AFTER\nLEFT (BEFORE):\n- [PROBLEM VISUAL — e.g. real acne, redness, inflammation, oily shine]\n- harsh phone flash lighting\n- uneven texture, imperfect framing\nRIGHT (AFTER):\n- same exact [SUBJECT — e.g. girl, man, surface], same angle, same framing\n- [RESULT — e.g. acne reduced but still visible, light redness remains]\n- natural texture preserved\n- NO beauty filter\nLighting:\n- BOTH sides must use the SAME iPhone flash style\n- no studio lighting\n- slightly harsh, real\n---\nCHAT SECTION:\niMessage style bubbles\nBlue (sender):\n\"[MESSAGE 1 — person sharing their result, emotional, authentic. 1-2 emojis.]\"\nGrey (receiver):\n\"[MESSAGE 2 — friend asking about the product naturally, curious tone.]\"\nBlue (sender):\n\"[MESSAGE 3 — person confirms and adds a key differentiator vs competitors. 1 emoji.]\"\n---\nPRODUCT:\n- bottom center\n- slightly large\n- clean but NOT over-polished\n- subtle shadow\n- [PRODUCT]\n---\nBADGE:\n\"[TRUST BADGE — e.g. 90 DÍAS GARANTÍA, FREE SHIPPING, CLINICALLY TESTED]\"\n---\nSTYLE:\n- must feel like a real screenshot + ad\n- slightly imperfect alignment\n- NOT symmetrical, NOT too clean\n- [Any extra style note for the specific product/market]\n---\nANTI-AI RULES:\n- no plastic [SKIN/SURFACE/TEXTURE — adapt to product]\n- no blur\n- no symmetry\n- no glow effect\n- no \"perfect\" result\nGOAL:\nFeels like a real person sent this to their friend, not an ad.\n\n───\n\nCreate a high-converting acne transformation ad with timeline.\n\nCRITICAL REALISM RULE:\nThe AFTER must NOT look perfect.\nIt must look like:\n\"real improvement after weeks\", not \"model skin\".\n\n---\n\nTOP:\n\nHeadline:\n\n\"MEJORÓ MI PIEL EN 12 SEMANAS\"\n\nHighlight \"12 SEMANAS\" with soft yellow underline (not too clean)\n\n---\n\nTIMELINE:\n\n1–4 semanas → \"Menos inflamación\"  \n4–8 semanas → \"Purga inicial\"  \n8–12 semanas → \"Mejora visible\"  \n12+ semanas → \"Piel más estable\"\n\n- slightly imperfect alignment\n- NOT perfectly centered (to avoid AI look)\n\n---\n\nMIDDLE:\n\nSplit BEFORE / AFTER\n\nLEFT:\n- acne visible\n- redness, texture\n- dull lighting\n\nRIGHT:\n- same girl\n- improved but NOT perfect\n- visible pores\n- slight marks remain\n- natural skin, not glowing artificially\n\nIMPORTANT:\n- both images must feel like phone photos\n- NOT studio portraits\n- same lighting, same angle\n\n---\n\nPRODUCT:\n\n- bottom center\n- slightly overlapping\n- shadow grounded\n\n---\n\nBADGE:\n\n\"GARANTÍA 90 DÍAS\"\n\n- slightly rotated (to avoid template look)\n\n---\n\nBOTTOM:\n\n\"4.7 ⭐ · +30.000 personas\"\n\n---\n\nSTYLE:\n\n- hybrid infographic + UGC\n- slightly imperfect spacing\n- NOT Apple clean\n- NOT Canva template\n\n---\n\nANTI-AI RULES:\n\n- no perfect symmetry\n- no perfect gradients\n- no flawless skin\n- no over-sharpened details\n\nGOAL:\nLooks like a real ad that already works, not a generated design.\n\n───\n\nCreate a high-converting [PRODUCT CATEGORY] transformation ad with a timeline layout.\n\nCRITICAL REALISM RULE:\nThe AFTER must NOT look perfect.\nIt must look like \"real improvement after weeks\", not \"model result\".\n---\nTOP:\nHeadline:\n\"[HEADLINE — e.g. MEJORÓ MI PIEL EN 12 SEMANAS]\"\nHighlight \"[KEY PHRASE — e.g. 12 SEMANAS]\" with soft yellow underline (not too clean)\n---\nTIMELINE:\n[WEEK RANGE 1] → \"[MILESTONE 1 — e.g. Menos inflamación]\"\n[WEEK RANGE 2] → \"[MILESTONE 2 — e.g. Purga inicial]\"\n[WEEK RANGE 3] → \"[MILESTONE 3 — e.g. Mejora visible]\"\n[WEEK RANGE 4]+ → \"[MILESTONE 4 — e.g. Resultado estable]\"\n- slightly imperfect alignment\n- NOT perfectly centered (to avoid AI look)\n---\nMIDDLE:\nSplit BEFORE / AFTER\nLEFT (BEFORE):\n- [PROBLEM VISUAL — e.g. acne visible, redness, texture, dull lighting]\n- feels like a phone photo, NOT a studio portrait\nRIGHT (AFTER):\n- same [SUBJECT — e.g. girl, man, scalp]\n- [RESULT — e.g. improved but NOT perfect, visible pores, slight marks remain]\n- natural result, not glowing artificially\nIMPORTANT:\n- both images must feel like real phone photos\n- same lighting, same angle on both sides\n---\nPRODUCT:\n- bottom center\n- slightly overlapping the images\n- shadow grounded\n- [PRODUCT]\n---\nBADGE:\n\"[TRUST BADGE — e.g. GARANTÍA 90 DÍAS]\"\n- slightly rotated (to avoid template look)\n---\nBOTTOM:\n\"[RATING — e.g. 4.7] ⭐ · +[SOCIAL PROOF NUMBER — e.g. 30.000] personas\"\n---\nSTYLE:\n- hybrid infographic + UGC\n- slightly imperfect spacing\n- NOT Apple clean, NOT Canva template\n- [Any extra style note for the specific product/market]\n---\nANTI-AI RULES:\n- no perfect symmetry\n- no perfect gradients\n- no flawless [SKIN/HAIR/SURFACE — adapt to product]\n- no over-sharpened details\nGOAL:\nLooks like a real ad that already works, not a generated design.\n\n───\n\nCreate a high-converting acne ad EXACTLY like a Facebook testimonial layout.\n\nDO NOT redesign. Replicate structure.\n\n---\n\nBACKGROUND:\nlight beige with subtle grain texture\n\n---\n\nTOP SECTION:\n\nFacebook-style comment box\n\nProfile picture (small circle)\nName blurred\n\nText (Spanish):\n\"Estaba a punto de probar Roacutan, pero estoy TAN agradecida de haber probado esto antes. Después de años con acné hormonal, esto me ha cambiado la vida 🙌\"\n\nBelow:\n\"Me gusta · Responder · 20 h\"\n\n---\n\nMIDDLE SECTION:\n\nTwo images side by side\n\nLEFT (ANTES):\n- real acne (inflamed, redness, uneven texture)\n- bad lighting, slightly warm tone\n- looks like real phone photo\n\nRIGHT (DESPUÉS):\n- same person\n- same framing\n- acne reduced but NOT perfect\n- slight redness remains\n- natural skin, pores visible\n\n---\n\nLABELS:\n\nLeft bottom:\n\"ANTES\" (dark blue box)\n\nRight bottom:\n\"DESPUÉS\" (yellow box with checkmark)\n\n---\n\nPRODUCT:\n\nCentered overlapping bottom of images\nSlight rotation\nSoft shadow\n\n---\n\nBOTTOM:\n\n⭐ ⭐ ⭐ ⭐ ⭐ 4.7  \n\"Más de 3.000 reseñas\"\n\n---\n\nANTI-AI RULES:\n\n- NO perfect skin\n- NO glow skin\n- NO symmetry\n- MUST look like real user photo\n\n---\n\nGOAL:\n\nLooks like a real Facebook ad, not AI generated\n\n───\n\nCreate a high-converting [PRODUCT CATEGORY] ad EXACTLY like a Facebook testimonial layout.\nDO NOT redesign. Replicate structure.\n\nBACKGROUND: [BACKGROUND — e.g. light beige with subtle grain texture, white, soft gray, etc.]\n---\nTOP SECTION:\nFacebook-style comment box\n- Profile picture (small circle), name blurred\n- Text ([MARKET LANGUAGE]):\n\"[TESTIMONIAL — describe the problem in first person, the discovery moment, and the result. Authentic tone, NOT salesy. 1-2 relevant emojis.]\"\n- Below: \"Me gusta · Responder · [X] h\"\n---\nMIDDLE SECTION:\nTwo images side by side\nLEFT (BEFORE):\n- [SUBJECT — e.g. man 30-45, woman 25-35, etc.]\n- [PROBLEM VISUAL — e.g. mouth open while sleeping, dry lips, tired face]\n- [ENVIRONMENT — e.g. slightly messy pillow, dim room, etc.]\n- warm, low-quality lighting\n- real phone photo feel, imperfect framing\n\nRIGHT (AFTER):\n- same [SUBJECT], same framing, same angle\n- [PRODUCT USE VISUAL — e.g. wearing mouth tape, using the device, applying the cream]\n- [RESULT — improved but NOT perfect, e.g. looks more rested but slight eye bags remain]\n- natural skin texture, visible pores\n- NO beauty filter\n\nLABELS:\n- Left bottom: \"[BEFORE LABEL — e.g. ANTES (boca abierta)]\" — dark [COLOR] box\n- Right bottom: \"[AFTER LABEL — e.g. DESPUÉS]\" — yellow box with checkmark ✓\n---\nPRODUCT:\n- Centered overlapping bottom of both images\n- Slight rotation\n- Soft shadow\n- [PRODUCT] — [brief packaging descriptor — e.g. simple, not premium / minimalist box / tube]\n---\nBOTTOM:\n⭐⭐⭐⭐⭐ [RATING — e.g. 4.7]\n\"[SOCIAL PROOF — e.g. Más de 5.200 reseñas]\"\n---\nANTI-AI RULES:\n- NO perfect [SKIN/HAIR/SURFACE — adapt to product]\n- NO glow effect\n- NO symmetry\n- NO perfect [RESULT STATE — e.g. sleep look, skin, hair]\n- MUST look like real phone photos\n- slightly noisy image, natural imperfections\n\nGOAL:\nLooks like a real Facebook ad someone would scroll past and believe, not AI generated.\n\n───\n\nHigh-converting ecommerce ad, UGC testimonial + transformation cards layout, TikTok-style social proof.\n\nBACKGROUND:\nSoft desaturated teal / green background (#A8C3BD).\nFlat color with very subtle gradient and soft vignette.\nClean, modern, slightly playful.\n\n---\n\nTOP SECTION:\n\nFloating review card (centered, slightly tilted).\n\nCard design:\n- white background\n- rounded corners\n- soft shadow\n- looks like a real app review / UI\n\nContent:\n\nTitle:\n\"Detalles de la reseña\"\n\nBelow:\n5 yellow stars + username (ej: \"S*****n\") + date aligned right\n\nBody text (SPANISH):\n\"Quería esperar antes de escribir una reseña real… pero si tienes acné o manchas, esto marca una diferencia brutal. Después de un mes usándolo a diario, mi piel se ve muchísimo mejor ❤️ Tipo de piel: seca\"\n\nBottom:\n2 small thumbnail images (before/after)\n\n---\n\nMIDDLE SECTION:\n\nTwo floating UGC image cards:\n\nLEFT CARD (BEFORE):\n- square image\n- close-up cheek with acne / texture\n- label \"ANTES\" in bold white text bottom-left\n- small \"X\" icon top-right (like dismiss UI)\n- slightly rotated\n- soft shadow\n\nRIGHT CARD (AFTER):\n- larger square image\n- clearer skin but still natural texture (IMPORTANT)\n- label \"DESPUÉS\" in bold white text bottom-right\n- small \"X\" icon top-right\n- slightly overlapping left card\n- more prominent (primary focus)\n\n---\n\nCONNECTOR ELEMENTS:\n\nHand-drawn style arrows:\n- one from review → before\n- one from before → after\n\nWhite, slightly imperfect strokes (NOT perfect vector)\n\n---\n\nDEPTH & COMPOSITION:\n\n- layered layout\n- cards floating at different depths\n- realistic soft shadows\n- slight rotation for organic feel\n\n---\n\nPRODUCT:\n\nOPTIONAL (if included):\n- small, subtle at bottom center or corner\n- NOT dominant\n- integrated naturally\n\n---\n\nSTYLE:\n\n- UGC social proof aesthetic\n- feels like screenshots from real users\n- imperfect but intentional\n- high CTR TikTok / Meta ads style\n\n---\n\nANTI-AI RULES:\n\n- NO perfect skin in after\n- keep pores, slight texture\n- NO over smoothing\n- NO perfect alignment\n- NO generic UI\n\nEverything must feel like real captured moments.\n\n---\n\nFINAL GOAL:\n\nMust look like a real viral skincare ad using user-generated proof.\nNot like a polished brand photoshoot or AI composition.\n\n───\n\nHigh-converting [PRODUCT CATEGORY] ad, UGC testimonial + transformation cards layout, TikTok-style social proof.\n\nBACKGROUND:\n[BACKGROUND COLOR — e.g. soft desaturated teal #A8C3BD, warm sand #D4B896, dusty rose #C9A8A8]\nFlat color with very subtle gradient and soft vignette.\nClean, modern, slightly playful.\n---\nTOP SECTION:\nFloating review card (centered, slightly tilted).\nCard design:\n- white background, rounded corners, soft shadow\n- looks like a real app review / UI\nContent:\nTitle: \"Detalles de la reseña\"\nBelow: 5 yellow stars + username (e.g. \"[INITIAL]*****[INITIAL]\") + date aligned right\nBody text ([MARKET LANGUAGE]):\n\"[REVIEW TEXT — first person, wait-and-see tone before writing, specific result after X weeks/months, emotional payoff. End with skin/hair/body type detail. 1-2 emojis.]\"\nBottom: 2 small thumbnail images (before/after)\n---\nMIDDLE SECTION:\nTwo floating UGC image cards:\n\nLEFT CARD (BEFORE):\n- square image, slightly rotated, soft shadow\n- [PROBLEM VISUAL — e.g. close-up cheek with acne, thinning hairline, stained teeth]\n- label \"[BEFORE LABEL — e.g. ANTES]\" in bold white text bottom-left\n- small \"X\" icon top-right (like dismiss UI)\n\nRIGHT CARD (AFTER):\n- larger square image, slightly overlapping left card\n- [RESULT VISUAL — clearer/improved but still natural texture — IMPORTANT: NOT perfect]\n- label \"[AFTER LABEL — e.g. DESPUÉS]\" in bold white text bottom-right\n- small \"X\" icon top-right\n- more prominent (primary focus)\n---\nCONNECTOR ELEMENTS:\nHand-drawn style arrows:\n- one from review card → before card\n- one from before card → after card\n[ARROW COLOR — e.g. white, black, coral], slightly imperfect strokes (NOT perfect vector)\n---\nDEPTH & COMPOSITION:\n- layered layout, cards floating at different depths\n- realistic soft shadows\n- slight rotation on each card for organic feel\n- NOT symmetrical, NOT grid-aligned\n---\nPRODUCT:\nOPTIONAL — if included:\n- small, subtle at bottom center or corner\n- NOT dominant\n- integrated naturally\n- [PRODUCT]\n---\nSTYLE:\n- UGC social proof aesthetic\n- feels like screenshots from real users\n- imperfect but intentional\n- high CTR TikTok / Meta ads style\n- [Any extra style note for the specific product/market]\n---\nANTI-AI RULES:\n- NO perfect [SKIN/HAIR/TEETH/SURFACE — adapt to product] in after card\n- keep pores, slight texture, natural imperfections\n- NO over-smoothing\n- NO perfect alignment\n- NO generic UI elements\nEverything must feel like real captured moments.\n---\nFINAL GOAL:\nMust look like a real viral [PRODUCT CATEGORY] ad using user-generated proof.\nNot like a polished brand photoshoot or AI composition.\n\n───\n\nCreate a high-converting acne ad using a chat conversation layout.\n\n---\n\nBACKGROUND:\nsoft beige (#F3EFEA), minimal texture\n\n---\n\nTOP:\n\n2 rounded images side by side\n\nLEFT:\nacne skin (real, textured)\n\nRIGHT:\nimproved skin (not perfect)\n\n---\n\nCHAT SECTION (iMessage style):\n\nBlue bubble:\n\"Por fin tengo la piel mucho mejor y ni siquiera he terminado 😭\"\n\nGrey bubble:\n\"¿Esto trata el acné desde la raíz?\"\n\nBlue bubble:\n\"Sí, y sin irritar como otros 🔥\"\n\n---\n\nPRODUCT:\n\nCentered below chat\nClean shadow\n\n---\n\nEXTRA:\n\nLeft:\nyellow badge:\n\"GARANTÍA 90 DÍAS\"\n\nRight:\n2 capsules floating slightly\n\n---\n\nRULES:\n\n- chat must feel real, not designed\n- spacing slightly imperfect\n- product integrated, not floating randomly\n\n---\n\nANTI-AI:\n\n- no perfect skin\n- no glow\n- no plastic texture\n\n---\n\nGOAL:\n\nFeels like screenshot from real conversation\n\n───\n\nHigh-converting ecommerce ad, before/after transformation layout with speed comparison, modern DTC style.\n\nBACKGROUND:\nSoft off-white / light beige background (#F5F3EF), very clean with subtle paper-like texture.\nMinimal shadows, premium neutral aesthetic.\n\n---\n\nTOP SECTION:\n\nCentered brand logo (small, minimal).\n\nBelow logo, bold headline (large, black, sans-serif):\n\"El minoxidil es el único activo que la ciencia respalda\"\n\nSubheadline below (smaller, lighter weight):\n\"Sin trasplantes. Sin medicamentos.\"\n\nPerfect spacing, centered alignment.\n\n---\n\nMIDDLE SECTION (MAIN VISUAL):\n\nLarge rounded rectangle container centered.\n\nInside container:\nSplit before/after comparison (left/right).\n\nLEFT SIDE:\nBack of a man’s head with visible hair thinning / crown balding.\nNatural lighting, slightly duller tones.\n\nRIGHT SIDE:\nSame angle, same head, but visibly fuller hair.\nHair looks denser but still realistic (NOT perfect or fake).\n\nCRITICAL:\n- identical framing both sides\n- same haircut, same lighting conditions\n- realism over perfection\n\nContainer styling:\n- rounded corners\n- very subtle shadow\n- clean border or none\n\n---\n\nBOTTOM OF CONTAINER:\n\nSmall dotted curved arrow connecting left to right.\n\nCentered below arrow:\n\"8 meses de constancia\"\n\n---\n\nPRODUCT INTEGRATION (BOTTOM RIGHT):\n\nHand holding the product (USE EXACT REFERENCE IMAGE PRODUCT)\n\n- natural hand pose\n- product slightly angled toward camera\n- placed overlapping bottom-right of the container\n\nShadow:\n- soft realistic shadow under hand\n- proper depth (not floating)\n\n---\n\nCOLOR PALETTE:\n\n- neutral background (beige/white)\n- black typography\n- natural skin tones\n- product colors unchanged\n\n---\n\nSTYLE:\n\n- clean DTC ad\n- barbershop / real-life authenticity\n- NOT studio-perfect\n- realistic textures\n\n---\n\nANTI-AI RULES:\n\n- NO perfect hairline\n- NO overfilled density\n- NO blur or skin smoothing\n- NO CGI look\n- NO fake symmetry\n\nHair must look believable, slightly imperfect.\n\n---\n\nFINAL GOAL:\n\nMust look like a real high-performing hair product ad used in paid media.\nNot like an AI-generated image or template.\n\n───\n\nHigh-converting ecommerce ad, clinical before/after comparison with highlighted improvement area, dermatology-style layout.\n\nBACKGROUND:\nWarm beige / nude background (#C9AE94).\nFlat color, clean, slightly premium medical aesthetic.\n\n---\n\nTOP SECTION:\n\nTwo labels aligned horizontally:\n\nLEFT:\n\"ANTES\" inside a light grey rounded pill\nSmall red circle icon (❌) next to text\n\nRIGHT:\n\"DESPUÉS\" inside a light grey rounded pill\nSmall green check icon (✔️) next to text\n\nSpacing clean and symmetrical.\n\n---\n\nMIDDLE SECTION (MAIN VISUAL):\n\nTwo vertical image cards side by side.\n\nLEFT IMAGE (BEFORE):\n- close-up of scalp / hairline with visible thinning\n- slightly flatter lighting\n- natural imperfections\n\nRIGHT IMAGE (AFTER):\n- same angle and subject\n- improved density but still realistic (NOT perfect)\n\nCRITICAL:\n- identical framing\n- same perspective\n- same lighting direction\n\n---\n\nHIGHLIGHT ELEMENT:\n\nOn BOTH images:\n- dotted white circular outline highlighting the hairline area\n- subtle, clean, medical-style annotation\n\n---\n\nBOTTOM OF EACH IMAGE:\n\nText blocks inside light rounded containers:\n\nLEFT TEXT:\n\"Antes, se aprecia una línea frontal irregular, con menor densidad y separación visible.\"\n\nRIGHT TEXT:\n\"Después de 3 meses de uso constante, se observa mayor densidad y mejora en la línea capilar.\"\n\nTypography:\n- clean sans-serif\n- dark grey text\n- small but readable\n\n---\n\nFOOTNOTE (BOTTOM CENTER):\n\nSmall disclaimer text:\n\n\"Resultados visibles en 8-12 semanas. Los resultados pueden variar según el usuario.\"\n\nVery small, subtle, grey.\n\n---\n\nPRODUCT:\n\nOPTIONAL:\n- small and secondary at bottom center\n- NOT dominant\n- clean shadow\n\n---\n\nSTYLE:\n\n- dermatological / clinical\n- trustworthy\n- structured\n- clean and informative\n\n---\n\nANTI-AI RULES:\n\n- NO perfect hair density\n- NO fake regrowth patterns\n- NO blur\n- NO exaggerated transformation\n- keep realism even in “after”\n\n---\n\nFINAL GOAL:\n\nMust look like a real clinical comparison ad used by a serious hair brand.\nNot exaggerated, not artificial, fully credible.\n\n───\n\nCreate a high-converting IPL hair removal device (depiladora de luz pulsada) comparison ad EXACTLY like a split-screen product vs alternative layout.\n\nDO NOT make it too clean or premium. Must feel like a real performance ad.\n\nLAYOUT:\nVertical 4:5\nSplit screen (50/50)\n\nLEFT SIDE (YOUR PRODUCT — WINNER):\n\nBackground:\nwarm beige with slight texture (not flat perfect color)\n\nTop text:\n\"[BRAND NAME]\" (clean but not luxury)\n\nProduct:\n\nIPL hair removal device (white or soft pink)\ncentered\nslight shadow\nslight rotation for depth\n\nBadge (top area):\n\"-$80 HOY\" or \"OFERTA LIMITADA\"\n\nred/pink circle\nslightly imperfect placement\n\nPrice:\n\"129€\"\nBelow:\n\"Pago único\"\n\nBenefits (with green check icons):\n\n\"Reduce el vello desde la raíz\"\n\"Piel suave sin irritación\"\n\"Resultados duraderos\"\n\nRIGHT SIDE (LOSER — RAZOR):\n\nBackground:\nlight grey (slightly flat, less attractive)\n\nTop text:\n\"Cuchilla\"\n\nProduct:\n\ncheap pink razor\ncentered\nsmaller than left product\n\nPrice:\n\"500€+\"\nBelow:\n\"Gasto en 5 años\"\n\nProblems (with red X icons):\n\n\"El vello vuelve en días\"\n\"Irritación constante\"\n\"Cortes y granitos\"\n\nSTYLE DETAILS (VERY IMPORTANT):\n\nSlight misalignment between elements (NOT perfect grid)\nSlight compression artifacts\nNot fully centered text blocks\nSmall random decorative elements (stars, icons) but NOT clean\nShadows slightly inconsistent (like real ads)\nMust feel like something made for conversion, not design\n\nANTI-AI RULES:\n\nNO perfect symmetry\nNO ultra clean UI\nNO Apple-style minimalism\nNO perfect spacing\nNO luxury branding feel\n\nGOAL:\n\nFeels like a real aggressive Facebook/Instagram ad comparing costs and pain points.\nUser should instantly think:\n\"Soy idiota si sigo usando cuchilla\"\n\n───\n\nCreate a high-converting IPL hair removal device (depiladora de luz pulsada) comparison ad EXACTLY like a split-screen product vs alternative layout.\n\nDO NOT make it too clean or premium. Must feel like a real performance ad.\n\nLAYOUT:\nVertical 4:5\nSplit screen (50/50)\n\nLEFT SIDE (YOUR PRODUCT — WINNER):\n\nBackground:\nwarm beige with slight texture (not flat perfect color)\n\nTop text:\n\"[BRAND NAME]\" (clean but not luxury)\n\nProduct:\n\nIPL hair removal device (white or soft pink)\ncentered\nslight shadow\nslight rotation for depth\n\nBadge (top area):\n\"-$80 HOY\" or \"OFERTA LIMITADA\"\n\nred/pink circle\nslightly imperfect placement\n\nPrice:\n\"129€\"\nBelow:\n\"Pago único\"\n\nBenefits (with green check icons):\n\n\"Reduce el vello desde la raíz\"\n\"Piel suave sin irritación\"\n\"Resultados duraderos\"\n\nRIGHT SIDE (LOSER — RAZOR):\n\nBackground:\nlight grey (slightly flat, less attractive)\n\nTop text:\n\"Cuchilla\"\n\nProduct:\n\ncheap pink razor\ncentered\nsmaller than left product\n\nPrice:\n\"500€+\"\nBelow:\n\"Gasto en 5 años\"\n\nProblems (with red X icons):\n\n\"El vello vuelve en días\"\n\"Irritación constante\"\n\"Cortes y granitos\"\n\nSTYLE DETAILS (VERY IMPORTANT):\n\nSlight misalignment between elements (NOT perfect grid)\nSlight compression artifacts\nNot fully centered text blocks\nSmall random decorative elements (stars, icons) but NOT clean\nShadows slightly inconsistent (like real ads)\nMust feel like something made for conversion, not design\n\nANTI-AI RULES:\n\nNO perfect symmetry\nNO ultra clean UI\nNO Apple-style minimalism\nNO perfect spacing\nNO luxury branding feel\n\nGOAL:\n\nFeels like a real aggressive Facebook/Instagram ad comparing costs and pain points.\nUser should instantly think:\n\"Soy idiota si sigo usando cuchilla\"",
        "capturasDriveId": "1b2_pQR2GkgHSGR_vvSuR30bxrRBiMBFU",
        "notionUrl": "https://www.notion.so/ADS-IMAGEN-336ec2aef76b8025b6d8d6e0a4612d39",
        "bloques": [
          {
            "t": "label",
            "v": "Prompt",
            "x": "Es el prompt concreto, ya lleno, para un ad de tratamiento de acné. Arma la pieza entera en **4:5**: arriba un comentario falso de Instagram/Facebook con testimonio en español, y abajo el antes/después a pantalla partida. Miralo como referencia de cómo queda un prompt terminado antes de pasarlo a plantilla."
          },
          {
            "t": "prompt",
            "v": "Create a high-converting acne treatment ad image based EXACTLY on a testimonial-style layout.\n\nFORMAT:\nVertical 4:5\n\n---\n\nTOP SECTION (SOCIAL PROOF COMMENT):\n\n- Fake Facebook/Instagram comment card\n- White rounded rectangle with subtle shadow\n- Small circular profile image on the left\n- Username blurred or partially hidden\n\nTEXT (Spanish):\n\n\"Estaba a punto de empezar con Roacutan, pero estoy MUY agradecida de haber probado esto. Después de años con acné hormonal fuerte, esto me ha cambiado la vida 🙌🏻\"\n\nBelow:\n\"Me gusta · Responder · hace 20 h\"\n\n---\n\nMIDDLE SECTION:\n\nSplit screen:\n\nLEFT (ANTES):\n- Real acne, inflamed, redness, oily skin\n- Flash photo look\n- imperfect framing\n\nRIGHT (DESPUÉS):\n- Same girl\n- clear improvement but NOT perfect\n- some marks still visible\n\nLabels:\n\n- Bottom left: \"ANTES\" (dark rectangle)\n- Bottom right: \"DESPUÉS\" (yellow rectangle with check icon)\n\n---\n\nPRODUCT:\n\n- Place product centered overlapping both images\n- Slight rotation for dynamic feel\n- Strong shadow for depth\n\n---\n\nBOTTOM SECTION:\n\n- 5 star rating ⭐⭐⭐⭐⭐\n- Text:\n\"4.7 · Más de 3.000 opiniones\"\n\n---\n\nSTYLE:\n\n- Raw UGC + performance ad\n- NOT clean branding\n- NOT minimal\n- Must feel like a real ad running on Facebook"
          },
          {
            "t": "label",
            "v": "Resultado",
            "x": "Es la imagen que devolvió el prompt de arriba. Te sirve para ver a qué apuntás visualmente antes de generar lo tuyo."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A0850ce44-8aa0-4190-b768-947be1514857%3A1775992799008-hkqhtxro0ol.jpg?table=block&id=340ec2ae-f76b-80b9-bfd9-c0d3bbbbd197&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Ejemplo con otro producto (plantilla)",
            "x": "Es una imagen ya generada con la misma estructura pero para otro producto y mercado. Está de muestra para que veas que la plantilla aguanta cualquier nicho."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A38cbf238-52ef-487e-bfdc-41cfba438740%3A1776004259524-dnxh4fxrmtk.jpg?table=block&id=340ec2ae-f76b-80b6-8d6f-ca0cd6116a6a&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Plantilla para utilizar con cualquier producto",
            "x": "La versión con huecos del formato testimonial + before/after. Reemplazás **[PRODUCT CATEGORY]**, el idioma del mercado (**[MARKET LANGUAGE]**), el testimonio y los visuales de problema/resultado, y ya tenés el prompt listo para cualquier producto."
          },
          {
            "t": "prompt",
            "v": "Create a high-converting [PRODUCT CATEGORY] ad image based EXACTLY on a testimonial + before/after layout.\n\nFORMAT:\nVertical 4:5\n---\nTOP SECTION (SOCIAL PROOF COMMENT):\n- Fake Facebook/Instagram comment card\n- White rounded rectangle with subtle shadow\n- Small circular profile image on the left\n- Username blurred or partially hidden\nTEXT ([MARKET LANGUAGE]):\n\"[TESTIMONIAL — personal story, mention the problem, the turning point, and the result. Authentic tone, NOT salesy. Include 1-2 relevant emojis.]\"\nBelow:\n\"Me gusta · Responder · hace [X] h\"\n---\nMIDDLE SECTION:\nSplit screen:\nLEFT (BEFORE):\n- Show [PROBLEM VISUAL — e.g. acne, excess weight, damaged hair, dirty surface, etc.]\n- Flash photo look, imperfect framing, raw feel\nRIGHT (AFTER):\n- Same person/subject\n- Clear improvement but NOT perfect — must feel real\n- Some traces of the problem still visible for credibility\nLabels:\n- Bottom left: \"[BEFORE LABEL in market language]\" — dark rectangle\n- Bottom right: \"[AFTER LABEL in market language]\" — yellow rectangle with check icon ✓\n---\nPRODUCT:\n- Place [PRODUCT] centered overlapping both images\n- Slight rotation for dynamic feel\n- Strong shadow for depth\n---\nBOTTOM SECTION:\n- 5 star rating ⭐⭐⭐⭐⭐\n- Text: \"[RATING e.g. 4.7] · [SOCIAL PROOF e.g. Más de 3.000 opiniones]\"\n---\nSTYLE:\n- Raw UGC + performance ad\n- NOT clean branding, NOT minimal\n- Must feel like a real ad running on Facebook\n- [Any extra style note for the specific product/market]"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting acne ad using a chat conversation layout.\n\nCRITICAL REALISM RULE:\nThe AFTER skin must NOT be perfect.\nIt must still have:\n- small red marks\n- slight uneven tone\n- visible pores\n- subtle texture\nIf skin looks flawless or airbrushed → FAIL.\n\n---\n\nTOP:\n\nRounded image container with BEFORE / AFTER\n\nLEFT (ANTES):\n- real acne\n- redness, inflammation\n- oily shine from flash\n- uneven texture\n- harsh phone flash lighting\n\nRIGHT (DESPUÉS):\n- same exact girl, same angle, same framing\n- acne reduced but still visible\n- light redness remains\n- natural skin texture preserved\n- pores clearly visible\n- NO beauty filter\n\nLighting:\n- BOTH sides must use the SAME iPhone flash style\n- no studio lighting\n- slightly harsh, real\n\n---\n\nCHAT SECTION:\n\niMessage style bubbles\n\nBlue:\n\"Por fin tengo la piel mucho mejor y ni siquiera he terminado el tratamiento 😭\"\n\nGrey:\n\"¿Es ese el producto que trata el acné desde la raíz?\"\n\nBlue:\n\"Sí, pero lo importante es que no destroza la piel como otros 🔥\"\n\n---\n\nPRODUCT:\n\n- bottom center\n- slightly large\n- clean but NOT over-polished\n- subtle shadow\n\n---\n\nBADGE:\n\n\"90 DÍAS GARANTÍA\"\n\n---\n\nSTYLE:\n\n- must feel like screenshot + ad\n- slightly imperfect alignment\n- NOT symmetrical\n- NOT too clean\n\n---\n\nANTI-AI RULES:\n\n- no plastic skin\n- no blur\n- no symmetry\n- no glow effect\n- no \"perfect Instagram skin\"\n\nGOAL:\nFeels like a real girl sent this to her friend, not an ad."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Af2f15292-f553-48f4-8078-95bd44d3d5b3%3A1775993798021-kc7jzls8yu_(1).jpg?table=block&id=340ec2ae-f76b-8088-afb9-e49bdd439164&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Ejemplo con otro producto (plantilla)",
            "x": "Variante con formato de conversación de **chat** en vez de comentario. Trae una regla de realismo fuerte: el \"después\" tiene que conservar imperfecciones (marcas, poros, textura) o la pieza falla por parecer de IA. Usala cuando querés un aire más de mensajería/UGC."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A4090e2f9-6123-4188-8ee0-b7c787cd89c1%3A1776004855935-we67f7adxre.jpg?table=block&id=340ec2ae-f76b-80f5-b9f9-fd6f16277e79&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting [PRODUCT CATEGORY] ad using a chat conversation layout.\n\nCRITICAL REALISM RULE:\nThe AFTER result must NOT be perfect.\nIt must still show:\n- [IMPERFECTION 1 — e.g. small red marks]\n- [IMPERFECTION 2 — e.g. slight uneven tone]\n- [IMPERFECTION 3 — e.g. visible pores]\n- [IMPERFECTION 4 — e.g. subtle texture]\nIf result looks flawless or airbrushed → FAIL.\n---\nTOP:\nRounded image container with BEFORE / AFTER\nLEFT (BEFORE):\n- [PROBLEM VISUAL — e.g. real acne, redness, inflammation, oily shine]\n- harsh phone flash lighting\n- uneven texture, imperfect framing\nRIGHT (AFTER):\n- same exact [SUBJECT — e.g. girl, man, surface], same angle, same framing\n- [RESULT — e.g. acne reduced but still visible, light redness remains]\n- natural texture preserved\n- NO beauty filter\nLighting:\n- BOTH sides must use the SAME iPhone flash style\n- no studio lighting\n- slightly harsh, real\n---\nCHAT SECTION:\niMessage style bubbles\nBlue (sender):\n\"[MESSAGE 1 — person sharing their result, emotional, authentic. 1-2 emojis.]\"\nGrey (receiver):\n\"[MESSAGE 2 — friend asking about the product naturally, curious tone.]\"\nBlue (sender):\n\"[MESSAGE 3 — person confirms and adds a key differentiator vs competitors. 1 emoji.]\"\n---\nPRODUCT:\n- bottom center\n- slightly large\n- clean but NOT over-polished\n- subtle shadow\n- [PRODUCT]\n---\nBADGE:\n\"[TRUST BADGE — e.g. 90 DÍAS GARANTÍA, FREE SHIPPING, CLINICALLY TESTED]\"\n---\nSTYLE:\n- must feel like a real screenshot + ad\n- slightly imperfect alignment\n- NOT symmetrical, NOT too clean\n- [Any extra style note for the specific product/market]\n---\nANTI-AI RULES:\n- no plastic [SKIN/SURFACE/TEXTURE — adapt to product]\n- no blur\n- no symmetry\n- no glow effect\n- no \"perfect\" result\nGOAL:\nFeels like a real person sent this to their friend, not an ad."
          },
          {
            "t": "prompt",
            "v": "Create a high-converting acne transformation ad with timeline.\n\nCRITICAL REALISM RULE:\nThe AFTER must NOT look perfect.\nIt must look like:\n\"real improvement after weeks\", not \"model skin\".\n\n---\n\nTOP:\n\nHeadline:\n\n\"MEJORÓ MI PIEL EN 12 SEMANAS\"\n\nHighlight \"12 SEMANAS\" with soft yellow underline (not too clean)\n\n---\n\nTIMELINE:\n\n1–4 semanas → \"Menos inflamación\"  \n4–8 semanas → \"Purga inicial\"  \n8–12 semanas → \"Mejora visible\"  \n12+ semanas → \"Piel más estable\"\n\n- slightly imperfect alignment\n- NOT perfectly centered (to avoid AI look)\n\n---\n\nMIDDLE:\n\nSplit BEFORE / AFTER\n\nLEFT:\n- acne visible\n- redness, texture\n- dull lighting\n\nRIGHT:\n- same girl\n- improved but NOT perfect\n- visible pores\n- slight marks remain\n- natural skin, not glowing artificially\n\nIMPORTANT:\n- both images must feel like phone photos\n- NOT studio portraits\n- same lighting, same angle\n\n---\n\nPRODUCT:\n\n- bottom center\n- slightly overlapping\n- shadow grounded\n\n---\n\nBADGE:\n\n\"GARANTÍA 90 DÍAS\"\n\n- slightly rotated (to avoid template look)\n\n---\n\nBOTTOM:\n\n\"4.7 ⭐ · +30.000 personas\"\n\n---\n\nSTYLE:\n\n- hybrid infographic + UGC\n- slightly imperfect spacing\n- NOT Apple clean\n- NOT Canva template\n\n---\n\nANTI-AI RULES:\n\n- no perfect symmetry\n- no perfect gradients\n- no flawless skin\n- no over-sharpened details\n\nGOAL:\nLooks like a real ad that already works, not a generated design."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Adc80013a-3e43-4e76-9deb-1981861f4c4b%3A1775994452946-rhhzdmbpb0a.jpg?table=block&id=340ec2ae-f76b-80f3-b17b-e2d74f272a47&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Ejemplo con otro producto (plantilla)",
            "x": "Formato de transformación en **línea de tiempo**: un titular con la promesa (ej. \"mejoró en 12 semanas\") y una progresión semana a semana con hitos. Va bien para productos cuyo resultado se ve con el tiempo; dejá la alineación un poco imperfecta para que no cante a IA."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A7486c877-e827-4f7e-9bca-46b8ae679662%3A1776012388813-lan8qu8mr4m.jpg?table=block&id=340ec2ae-f76b-8045-8b5d-f220cd653bfd&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting [PRODUCT CATEGORY] transformation ad with a timeline layout.\n\nCRITICAL REALISM RULE:\nThe AFTER must NOT look perfect.\nIt must look like \"real improvement after weeks\", not \"model result\".\n---\nTOP:\nHeadline:\n\"[HEADLINE — e.g. MEJORÓ MI PIEL EN 12 SEMANAS]\"\nHighlight \"[KEY PHRASE — e.g. 12 SEMANAS]\" with soft yellow underline (not too clean)\n---\nTIMELINE:\n[WEEK RANGE 1] → \"[MILESTONE 1 — e.g. Menos inflamación]\"\n[WEEK RANGE 2] → \"[MILESTONE 2 — e.g. Purga inicial]\"\n[WEEK RANGE 3] → \"[MILESTONE 3 — e.g. Mejora visible]\"\n[WEEK RANGE 4]+ → \"[MILESTONE 4 — e.g. Resultado estable]\"\n- slightly imperfect alignment\n- NOT perfectly centered (to avoid AI look)\n---\nMIDDLE:\nSplit BEFORE / AFTER\nLEFT (BEFORE):\n- [PROBLEM VISUAL — e.g. acne visible, redness, texture, dull lighting]\n- feels like a phone photo, NOT a studio portrait\nRIGHT (AFTER):\n- same [SUBJECT — e.g. girl, man, scalp]\n- [RESULT — e.g. improved but NOT perfect, visible pores, slight marks remain]\n- natural result, not glowing artificially\nIMPORTANT:\n- both images must feel like real phone photos\n- same lighting, same angle on both sides\n---\nPRODUCT:\n- bottom center\n- slightly overlapping the images\n- shadow grounded\n- [PRODUCT]\n---\nBADGE:\n\"[TRUST BADGE — e.g. GARANTÍA 90 DÍAS]\"\n- slightly rotated (to avoid template look)\n---\nBOTTOM:\n\"[RATING — e.g. 4.7] ⭐ · +[SOCIAL PROOF NUMBER — e.g. 30.000] personas\"\n---\nSTYLE:\n- hybrid infographic + UGC\n- slightly imperfect spacing\n- NOT Apple clean, NOT Canva template\n- [Any extra style note for the specific product/market]\n---\nANTI-AI RULES:\n- no perfect symmetry\n- no perfect gradients\n- no flawless [SKIN/HAIR/SURFACE — adapt to product]\n- no over-sharpened details\nGOAL:\nLooks like a real ad that already works, not a generated design."
          },
          {
            "t": "prompt",
            "v": "Create a high-converting acne ad EXACTLY like a Facebook testimonial layout.\n\nDO NOT redesign. Replicate structure.\n\n---\n\nBACKGROUND:\nlight beige with subtle grain texture\n\n---\n\nTOP SECTION:\n\nFacebook-style comment box\n\nProfile picture (small circle)\nName blurred\n\nText (Spanish):\n\"Estaba a punto de probar Roacutan, pero estoy TAN agradecida de haber probado esto antes. Después de años con acné hormonal, esto me ha cambiado la vida 🙌\"\n\nBelow:\n\"Me gusta · Responder · 20 h\"\n\n---\n\nMIDDLE SECTION:\n\nTwo images side by side\n\nLEFT (ANTES):\n- real acne (inflamed, redness, uneven texture)\n- bad lighting, slightly warm tone\n- looks like real phone photo\n\nRIGHT (DESPUÉS):\n- same person\n- same framing\n- acne reduced but NOT perfect\n- slight redness remains\n- natural skin, pores visible\n\n---\n\nLABELS:\n\nLeft bottom:\n\"ANTES\" (dark blue box)\n\nRight bottom:\n\"DESPUÉS\" (yellow box with checkmark)\n\n---\n\nPRODUCT:\n\nCentered overlapping bottom of images\nSlight rotation\nSoft shadow\n\n---\n\nBOTTOM:\n\n⭐ ⭐ ⭐ ⭐ ⭐ 4.7  \n\"Más de 3.000 reseñas\"\n\n---\n\nANTI-AI RULES:\n\n- NO perfect skin\n- NO glow skin\n- NO symmetry\n- MUST look like real user photo\n\n---\n\nGOAL:\n\nLooks like a real Facebook ad, not AI generated"
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A40649095-4090-47e6-9809-abdbbb040f68%3A1775994977823-8l81vqdj2ko.jpg?table=block&id=340ec2ae-f76b-804c-8cc2-d889cd29e06a&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Ejemplo con otro producto (plantilla)",
            "x": "Réplica exacta de un comentario de **Facebook** (no rediseñar, copiar la estructura), con fondo configurable. Cambiás el sujeto, el visual del problema y el testimonio en el idioma del mercado. Ideal cuando buscás la máxima sensación de prueba social \"de verdad\"."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A7c0530b5-733a-46fb-9e6f-c191a848ed7b%3A3028459a17bbf5377a7308918204ef6a_1776009181_tplsrdtg.jpeg?table=block&id=340ec2ae-f76b-808b-aa89-ff7d1222ae69&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting [PRODUCT CATEGORY] ad EXACTLY like a Facebook testimonial layout.\nDO NOT redesign. Replicate structure.\n\nBACKGROUND: [BACKGROUND — e.g. light beige with subtle grain texture, white, soft gray, etc.]\n---\nTOP SECTION:\nFacebook-style comment box\n- Profile picture (small circle), name blurred\n- Text ([MARKET LANGUAGE]):\n\"[TESTIMONIAL — describe the problem in first person, the discovery moment, and the result. Authentic tone, NOT salesy. 1-2 relevant emojis.]\"\n- Below: \"Me gusta · Responder · [X] h\"\n---\nMIDDLE SECTION:\nTwo images side by side\nLEFT (BEFORE):\n- [SUBJECT — e.g. man 30-45, woman 25-35, etc.]\n- [PROBLEM VISUAL — e.g. mouth open while sleeping, dry lips, tired face]\n- [ENVIRONMENT — e.g. slightly messy pillow, dim room, etc.]\n- warm, low-quality lighting\n- real phone photo feel, imperfect framing\n\nRIGHT (AFTER):\n- same [SUBJECT], same framing, same angle\n- [PRODUCT USE VISUAL — e.g. wearing mouth tape, using the device, applying the cream]\n- [RESULT — improved but NOT perfect, e.g. looks more rested but slight eye bags remain]\n- natural skin texture, visible pores\n- NO beauty filter\n\nLABELS:\n- Left bottom: \"[BEFORE LABEL — e.g. ANTES (boca abierta)]\" — dark [COLOR] box\n- Right bottom: \"[AFTER LABEL — e.g. DESPUÉS]\" — yellow box with checkmark ✓\n---\nPRODUCT:\n- Centered overlapping bottom of both images\n- Slight rotation\n- Soft shadow\n- [PRODUCT] — [brief packaging descriptor — e.g. simple, not premium / minimalist box / tube]\n---\nBOTTOM:\n⭐⭐⭐⭐⭐ [RATING — e.g. 4.7]\n\"[SOCIAL PROOF — e.g. Más de 5.200 reseñas]\"\n---\nANTI-AI RULES:\n- NO perfect [SKIN/HAIR/SURFACE — adapt to product]\n- NO glow effect\n- NO symmetry\n- NO perfect [RESULT STATE — e.g. sleep look, skin, hair]\n- MUST look like real phone photos\n- slightly noisy image, natural imperfections\n\nGOAL:\nLooks like a real Facebook ad someone would scroll past and believe, not AI generated."
          },
          {
            "t": "prompt",
            "v": "High-converting ecommerce ad, UGC testimonial + transformation cards layout, TikTok-style social proof.\n\nBACKGROUND:\nSoft desaturated teal / green background (#A8C3BD).\nFlat color with very subtle gradient and soft vignette.\nClean, modern, slightly playful.\n\n---\n\nTOP SECTION:\n\nFloating review card (centered, slightly tilted).\n\nCard design:\n- white background\n- rounded corners\n- soft shadow\n- looks like a real app review / UI\n\nContent:\n\nTitle:\n\"Detalles de la reseña\"\n\nBelow:\n5 yellow stars + username (ej: \"S*****n\") + date aligned right\n\nBody text (SPANISH):\n\"Quería esperar antes de escribir una reseña real… pero si tienes acné o manchas, esto marca una diferencia brutal. Después de un mes usándolo a diario, mi piel se ve muchísimo mejor ❤️ Tipo de piel: seca\"\n\nBottom:\n2 small thumbnail images (before/after)\n\n---\n\nMIDDLE SECTION:\n\nTwo floating UGC image cards:\n\nLEFT CARD (BEFORE):\n- square image\n- close-up cheek with acne / texture\n- label \"ANTES\" in bold white text bottom-left\n- small \"X\" icon top-right (like dismiss UI)\n- slightly rotated\n- soft shadow\n\nRIGHT CARD (AFTER):\n- larger square image\n- clearer skin but still natural texture (IMPORTANT)\n- label \"DESPUÉS\" in bold white text bottom-right\n- small \"X\" icon top-right\n- slightly overlapping left card\n- more prominent (primary focus)\n\n---\n\nCONNECTOR ELEMENTS:\n\nHand-drawn style arrows:\n- one from review → before\n- one from before → after\n\nWhite, slightly imperfect strokes (NOT perfect vector)\n\n---\n\nDEPTH & COMPOSITION:\n\n- layered layout\n- cards floating at different depths\n- realistic soft shadows\n- slight rotation for organic feel\n\n---\n\nPRODUCT:\n\nOPTIONAL (if included):\n- small, subtle at bottom center or corner\n- NOT dominant\n- integrated naturally\n\n---\n\nSTYLE:\n\n- UGC social proof aesthetic\n- feels like screenshots from real users\n- imperfect but intentional\n- high CTR TikTok / Meta ads style\n\n---\n\nANTI-AI RULES:\n\n- NO perfect skin in after\n- keep pores, slight texture\n- NO over smoothing\n- NO perfect alignment\n- NO generic UI\n\nEverything must feel like real captured moments.\n\n---\n\nFINAL GOAL:\n\nMust look like a real viral skincare ad using user-generated proof.\nNot like a polished brand photoshoot or AI composition."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A985c2681-adbe-4a98-b1ea-bbe09c934ccc%3A1775997235586-7wvldjl0yuy.jpg?table=block&id=340ec2ae-f76b-80a3-b10f-da7544ff95f9&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "label",
            "v": "Ejemplo con otro producto (plantilla)",
            "x": "Formato UGC estilo **TikTok**: una tarjeta de reseña flotante (5 estrellas, usuario y fecha) más tarjetas de transformación. Elegís un color de fondo plano y suave y escribís la reseña en primera persona. Buena para social proof moderno y algo más jugado visualmente."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Aabf22dce-90f5-44dc-8ea2-565ea6749880%3A1776012022714-wsrr01103oi.jpg?table=block&id=340ec2ae-f76b-80cf-bd76-f0d6a4bc533c&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "High-converting [PRODUCT CATEGORY] ad, UGC testimonial + transformation cards layout, TikTok-style social proof.\n\nBACKGROUND:\n[BACKGROUND COLOR — e.g. soft desaturated teal #A8C3BD, warm sand #D4B896, dusty rose #C9A8A8]\nFlat color with very subtle gradient and soft vignette.\nClean, modern, slightly playful.\n---\nTOP SECTION:\nFloating review card (centered, slightly tilted).\nCard design:\n- white background, rounded corners, soft shadow\n- looks like a real app review / UI\nContent:\nTitle: \"Detalles de la reseña\"\nBelow: 5 yellow stars + username (e.g. \"[INITIAL]*****[INITIAL]\") + date aligned right\nBody text ([MARKET LANGUAGE]):\n\"[REVIEW TEXT — first person, wait-and-see tone before writing, specific result after X weeks/months, emotional payoff. End with skin/hair/body type detail. 1-2 emojis.]\"\nBottom: 2 small thumbnail images (before/after)\n---\nMIDDLE SECTION:\nTwo floating UGC image cards:\n\nLEFT CARD (BEFORE):\n- square image, slightly rotated, soft shadow\n- [PROBLEM VISUAL — e.g. close-up cheek with acne, thinning hairline, stained teeth]\n- label \"[BEFORE LABEL — e.g. ANTES]\" in bold white text bottom-left\n- small \"X\" icon top-right (like dismiss UI)\n\nRIGHT CARD (AFTER):\n- larger square image, slightly overlapping left card\n- [RESULT VISUAL — clearer/improved but still natural texture — IMPORTANT: NOT perfect]\n- label \"[AFTER LABEL — e.g. DESPUÉS]\" in bold white text bottom-right\n- small \"X\" icon top-right\n- more prominent (primary focus)\n---\nCONNECTOR ELEMENTS:\nHand-drawn style arrows:\n- one from review card → before card\n- one from before card → after card\n[ARROW COLOR — e.g. white, black, coral], slightly imperfect strokes (NOT perfect vector)\n---\nDEPTH & COMPOSITION:\n- layered layout, cards floating at different depths\n- realistic soft shadows\n- slight rotation on each card for organic feel\n- NOT symmetrical, NOT grid-aligned\n---\nPRODUCT:\nOPTIONAL — if included:\n- small, subtle at bottom center or corner\n- NOT dominant\n- integrated naturally\n- [PRODUCT]\n---\nSTYLE:\n- UGC social proof aesthetic\n- feels like screenshots from real users\n- imperfect but intentional\n- high CTR TikTok / Meta ads style\n- [Any extra style note for the specific product/market]\n---\nANTI-AI RULES:\n- NO perfect [SKIN/HAIR/TEETH/SURFACE — adapt to product] in after card\n- keep pores, slight texture, natural imperfections\n- NO over-smoothing\n- NO perfect alignment\n- NO generic UI elements\nEverything must feel like real captured moments.\n---\nFINAL GOAL:\nMust look like a real viral [PRODUCT CATEGORY] ad using user-generated proof.\nNot like a polished brand photoshoot or AI composition."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A9de7c2e4-3e2f-43c8-86ea-7cb7a0da4128%3A1775994974126-xf31mcd90t_(1).jpg?table=block&id=340ec2ae-f76b-803f-84e1-e5f93de644d9&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting acne ad using a chat conversation layout.\n\n---\n\nBACKGROUND:\nsoft beige (#F3EFEA), minimal texture\n\n---\n\nTOP:\n\n2 rounded images side by side\n\nLEFT:\nacne skin (real, textured)\n\nRIGHT:\nimproved skin (not perfect)\n\n---\n\nCHAT SECTION (iMessage style):\n\nBlue bubble:\n\"Por fin tengo la piel mucho mejor y ni siquiera he terminado 😭\"\n\nGrey bubble:\n\"¿Esto trata el acné desde la raíz?\"\n\nBlue bubble:\n\"Sí, y sin irritar como otros 🔥\"\n\n---\n\nPRODUCT:\n\nCentered below chat\nClean shadow\n\n---\n\nEXTRA:\n\nLeft:\nyellow badge:\n\"GARANTÍA 90 DÍAS\"\n\nRight:\n2 capsules floating slightly\n\n---\n\nRULES:\n\n- chat must feel real, not designed\n- spacing slightly imperfect\n- product integrated, not floating randomly\n\n---\n\nANTI-AI:\n\n- no perfect skin\n- no glow\n- no plastic texture\n\n---\n\nGOAL:\n\nFeels like screenshot from real conversation"
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3A51bcc4b6-916e-4df5-8873-6bba808f7a67%3A1775996845981-vhtzop9umwe.jpg?table=block&id=340ec2ae-f76b-809a-995a-c516f4ebb79d&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "High-converting ecommerce ad, before/after transformation layout with speed comparison, modern DTC style.\n\nBACKGROUND:\nSoft off-white / light beige background (#F5F3EF), very clean with subtle paper-like texture.\nMinimal shadows, premium neutral aesthetic.\n\n---\n\nTOP SECTION:\n\nCentered brand logo (small, minimal).\n\nBelow logo, bold headline (large, black, sans-serif):\n\"El minoxidil es el único activo que la ciencia respalda\"\n\nSubheadline below (smaller, lighter weight):\n\"Sin trasplantes. Sin medicamentos.\"\n\nPerfect spacing, centered alignment.\n\n---\n\nMIDDLE SECTION (MAIN VISUAL):\n\nLarge rounded rectangle container centered.\n\nInside container:\nSplit before/after comparison (left/right).\n\nLEFT SIDE:\nBack of a man’s head with visible hair thinning / crown balding.\nNatural lighting, slightly duller tones.\n\nRIGHT SIDE:\nSame angle, same head, but visibly fuller hair.\nHair looks denser but still realistic (NOT perfect or fake).\n\nCRITICAL:\n- identical framing both sides\n- same haircut, same lighting conditions\n- realism over perfection\n\nContainer styling:\n- rounded corners\n- very subtle shadow\n- clean border or none\n\n---\n\nBOTTOM OF CONTAINER:\n\nSmall dotted curved arrow connecting left to right.\n\nCentered below arrow:\n\"8 meses de constancia\"\n\n---\n\nPRODUCT INTEGRATION (BOTTOM RIGHT):\n\nHand holding the product (USE EXACT REFERENCE IMAGE PRODUCT)\n\n- natural hand pose\n- product slightly angled toward camera\n- placed overlapping bottom-right of the container\n\nShadow:\n- soft realistic shadow under hand\n- proper depth (not floating)\n\n---\n\nCOLOR PALETTE:\n\n- neutral background (beige/white)\n- black typography\n- natural skin tones\n- product colors unchanged\n\n---\n\nSTYLE:\n\n- clean DTC ad\n- barbershop / real-life authenticity\n- NOT studio-perfect\n- realistic textures\n\n---\n\nANTI-AI RULES:\n\n- NO perfect hairline\n- NO overfilled density\n- NO blur or skin smoothing\n- NO CGI look\n- NO fake symmetry\n\nHair must look believable, slightly imperfect.\n\n---\n\nFINAL GOAL:\n\nMust look like a real high-performing hair product ad used in paid media.\nNot like an AI-generated image or template."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Ac30973c0-3dd7-4407-abba-addda6ebff4b%3A1775997385686-ihdavwa1k9.jpg?table=block&id=340ec2ae-f76b-8068-a36d-da3ef455c5fc&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "High-converting ecommerce ad, clinical before/after comparison with highlighted improvement area, dermatology-style layout.\n\nBACKGROUND:\nWarm beige / nude background (#C9AE94).\nFlat color, clean, slightly premium medical aesthetic.\n\n---\n\nTOP SECTION:\n\nTwo labels aligned horizontally:\n\nLEFT:\n\"ANTES\" inside a light grey rounded pill\nSmall red circle icon (❌) next to text\n\nRIGHT:\n\"DESPUÉS\" inside a light grey rounded pill\nSmall green check icon (✔️) next to text\n\nSpacing clean and symmetrical.\n\n---\n\nMIDDLE SECTION (MAIN VISUAL):\n\nTwo vertical image cards side by side.\n\nLEFT IMAGE (BEFORE):\n- close-up of scalp / hairline with visible thinning\n- slightly flatter lighting\n- natural imperfections\n\nRIGHT IMAGE (AFTER):\n- same angle and subject\n- improved density but still realistic (NOT perfect)\n\nCRITICAL:\n- identical framing\n- same perspective\n- same lighting direction\n\n---\n\nHIGHLIGHT ELEMENT:\n\nOn BOTH images:\n- dotted white circular outline highlighting the hairline area\n- subtle, clean, medical-style annotation\n\n---\n\nBOTTOM OF EACH IMAGE:\n\nText blocks inside light rounded containers:\n\nLEFT TEXT:\n\"Antes, se aprecia una línea frontal irregular, con menor densidad y separación visible.\"\n\nRIGHT TEXT:\n\"Después de 3 meses de uso constante, se observa mayor densidad y mejora en la línea capilar.\"\n\nTypography:\n- clean sans-serif\n- dark grey text\n- small but readable\n\n---\n\nFOOTNOTE (BOTTOM CENTER):\n\nSmall disclaimer text:\n\n\"Resultados visibles en 8-12 semanas. Los resultados pueden variar según el usuario.\"\n\nVery small, subtle, grey.\n\n---\n\nPRODUCT:\n\nOPTIONAL:\n- small and secondary at bottom center\n- NOT dominant\n- clean shadow\n\n---\n\nSTYLE:\n\n- dermatological / clinical\n- trustworthy\n- structured\n- clean and informative\n\n---\n\nANTI-AI RULES:\n\n- NO perfect hair density\n- NO fake regrowth patterns\n- NO blur\n- NO exaggerated transformation\n- keep realism even in “after”\n\n---\n\nFINAL GOAL:\n\nMust look like a real clinical comparison ad used by a serious hair brand.\nNot exaggerated, not artificial, fully credible."
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Aa2658b1a-32b1-4ec5-a1a0-f86d51803e91%3A1776012797411-45oc3l89kgu.jpg?table=block&id=340ec2ae-f76b-8085-8f57-ffaec007eb51&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting IPL hair removal device (depiladora de luz pulsada) comparison ad EXACTLY like a split-screen product vs alternative layout.\n\nDO NOT make it too clean or premium. Must feel like a real performance ad.\n\nLAYOUT:\nVertical 4:5\nSplit screen (50/50)\n\nLEFT SIDE (YOUR PRODUCT — WINNER):\n\nBackground:\nwarm beige with slight texture (not flat perfect color)\n\nTop text:\n\"[BRAND NAME]\" (clean but not luxury)\n\nProduct:\n\nIPL hair removal device (white or soft pink)\ncentered\nslight shadow\nslight rotation for depth\n\nBadge (top area):\n\"-$80 HOY\" or \"OFERTA LIMITADA\"\n\nred/pink circle\nslightly imperfect placement\n\nPrice:\n\"129€\"\nBelow:\n\"Pago único\"\n\nBenefits (with green check icons):\n\n\"Reduce el vello desde la raíz\"\n\"Piel suave sin irritación\"\n\"Resultados duraderos\"\n\nRIGHT SIDE (LOSER — RAZOR):\n\nBackground:\nlight grey (slightly flat, less attractive)\n\nTop text:\n\"Cuchilla\"\n\nProduct:\n\ncheap pink razor\ncentered\nsmaller than left product\n\nPrice:\n\"500€+\"\nBelow:\n\"Gasto en 5 años\"\n\nProblems (with red X icons):\n\n\"El vello vuelve en días\"\n\"Irritación constante\"\n\"Cortes y granitos\"\n\nSTYLE DETAILS (VERY IMPORTANT):\n\nSlight misalignment between elements (NOT perfect grid)\nSlight compression artifacts\nNot fully centered text blocks\nSmall random decorative elements (stars, icons) but NOT clean\nShadows slightly inconsistent (like real ads)\nMust feel like something made for conversion, not design\n\nANTI-AI RULES:\n\nNO perfect symmetry\nNO ultra clean UI\nNO Apple-style minimalism\nNO perfect spacing\nNO luxury branding feel\n\nGOAL:\n\nFeels like a real aggressive Facebook/Instagram ad comparing costs and pain points.\nUser should instantly think:\n\"Soy idiota si sigo usando cuchilla\""
          },
          {
            "t": "img",
            "v": "https://www.notion.so/image/attachment%3Aa2658b1a-32b1-4ec5-a1a0-f86d51803e91%3A1776012797411-45oc3l89kgu.jpg?table=block&id=340ec2ae-f76b-80da-996b-cac5afac534b&spaceId=385ec2ae-f76b-8128-9e84-000386e2bee4&width=1280&cache=v2"
          },
          {
            "t": "prompt",
            "v": "Create a high-converting IPL hair removal device (depiladora de luz pulsada) comparison ad EXACTLY like a split-screen product vs alternative layout.\n\nDO NOT make it too clean or premium. Must feel like a real performance ad.\n\nLAYOUT:\nVertical 4:5\nSplit screen (50/50)\n\nLEFT SIDE (YOUR PRODUCT — WINNER):\n\nBackground:\nwarm beige with slight texture (not flat perfect color)\n\nTop text:\n\"[BRAND NAME]\" (clean but not luxury)\n\nProduct:\n\nIPL hair removal device (white or soft pink)\ncentered\nslight shadow\nslight rotation for depth\n\nBadge (top area):\n\"-$80 HOY\" or \"OFERTA LIMITADA\"\n\nred/pink circle\nslightly imperfect placement\n\nPrice:\n\"129€\"\nBelow:\n\"Pago único\"\n\nBenefits (with green check icons):\n\n\"Reduce el vello desde la raíz\"\n\"Piel suave sin irritación\"\n\"Resultados duraderos\"\n\nRIGHT SIDE (LOSER — RAZOR):\n\nBackground:\nlight grey (slightly flat, less attractive)\n\nTop text:\n\"Cuchilla\"\n\nProduct:\n\ncheap pink razor\ncentered\nsmaller than left product\n\nPrice:\n\"500€+\"\nBelow:\n\"Gasto en 5 años\"\n\nProblems (with red X icons):\n\n\"El vello vuelve en días\"\n\"Irritación constante\"\n\"Cortes y granitos\"\n\nSTYLE DETAILS (VERY IMPORTANT):\n\nSlight misalignment between elements (NOT perfect grid)\nSlight compression artifacts\nNot fully centered text blocks\nSmall random decorative elements (stars, icons) but NOT clean\nShadows slightly inconsistent (like real ads)\nMust feel like something made for conversion, not design\n\nANTI-AI RULES:\n\nNO perfect symmetry\nNO ultra clean UI\nNO Apple-style minimalism\nNO perfect spacing\nNO luxury branding feel\n\nGOAL:\n\nFeels like a real aggressive Facebook/Instagram ad comparing costs and pain points.\nUser should instantly think:\n\"Soy idiota si sigo usando cuchilla\""
          }
        ],
        "clases": [
          2
        ],
        "intro": "**\"Ejemplos de ads de imagen\"** es una biblioteca en **Notion** con anuncios de imagen ya hechos y, al lado de cada uno, el **prompt exacto** con el que se generaron. Sirve para no arrancar de la nada: en vez de inventar el prompt, agarrás una estructura que ya convierte y la adaptás a tu producto. Los formatos son de estilo testimonial pensados para que la pieza parezca real y no un render de IA: **comentario falso de Facebook/Instagram**, **before/after** (antes/después) a pantalla partida, conversación de **chat**, **línea de tiempo** por semanas y **reseña tipo TikTok** con estrellas.\n\nCómo se usa:\n- **Elegí el formato** — el que mejor le cae a tu producto (testimonial, before/after, chat, timeline o reseña).\n- **Rellená los huecos** — reemplazás **[PRODUCT CATEGORY]**, **[MARKET LANGUAGE]** (el idioma/país), el testimonio y los visuales de problema/resultado.\n- **Generá en vertical** — pegás el prompt en un modelo de imagen y sacás la pieza en formato **4:5** para feed.\n- **Cuidá el realismo** — el \"después\" no tiene que quedar perfecto: tiene que verse como una mejora real, con imperfecciones, o canta a IA."
      },
      {
        "slug": "ref-visual",
        "label": "Prompts Ref. Visual",
        "tipo": "notion",
        "cardDesc": "Prompts para cambiar el avatar y el fondo desde una imagen de referencia.",
        "texto": "make this woman/man a differente one, [DESCRIPCIÓN, OUTFIT...]\n\n───\n\nreplace the guy from the file 1 with the guy from the file 2 wearing the same outfit as is file 2, he is talking to camera gesticulating\n\n───\n\nA closer view of this same image shows less countertop. He's talking to the camera, you can see his teeth well\n\n───\n\nShe/he is looking to the right/left side of the frame, as if talking to someone sitting next to her/him.\nFlip the image horizontally\n\n───\n\n(static camera, no movement) he/she's looking directly at the camera, realistic arm movements, clear influencer tone: \"[inserta el guión aquí]\"\n\n───\n\nrealistic arm movements, the woman/man says exactly with direct clear energy: \"[inserta el guión aquí]\"\n\n───\n\nUse informal conversational Spanish as spoken in Spain. The phrasing, rhythm, and wording must feel like a real casual conversation between people in Spain. Include natural filler words and imperfections typical in Spain, such as:\n- \"a ver…\"\n- \"es que…\"\n- small pauses and hesitations\nAccent: Peninsular Spanish (Madrid neutral)",
        "notionUrl": "https://www.notion.so/Referencia-Visual-359ec2aef76b805faf57ce62fedabfe4",
        "bloques": [
          {
            "t": "head",
            "v": "IMAGEN",
            "x": "Abre el bloque de prompts para generar la **IMAGEN** fija. Todo lo que va acá se pega en **GPT Image 2** con la referencia de Pinterest adjunta."
          },
          {
            "t": "label",
            "v": "PROMPT #1: CAMBIAR AVATAR",
            "x": "Reemplaza a la persona de la referencia por un avatar nuevo que no existe. Donde dice **[DESCRIPCIÓN, OUTFIT...]** metés cómo querés que sea (pelo, complexión, ropa) manteniendo lo que te sirva del original, como la definición muscular. Es el primer paso siempre."
          },
          {
            "t": "prompt",
            "v": "make this woman/man a differente one, [DESCRIPCIÓN, OUTFIT...]"
          },
          {
            "t": "label",
            "v": "PROMPT #2: REEMPLAZAR FONDO",
            "x": "Toma la escena de la referencia (**file 1**) y le cambia el protagonista por el avatar que creaste (**file 2**), respetando su outfit y poniéndolo a hablar a cámara gesticulando. Sirve para plantar tu personaje en el fondo que elegiste; si hace falta, le pedís que se vean productos."
          },
          {
            "t": "prompt",
            "v": "replace the guy from the file 1 with the guy from the file 2 wearing the same outfit as is file 2, he is talking to camera gesticulating"
          },
          {
            "t": "label",
            "v": "PROMPT #3: PLANO MÁS CERCANO",
            "x": "Genera un **plano más cercano** del mismo avatar: menos encimera de fondo y la cara más grande, con los dientes bien visibles al hablar. Usalo cuando querés un primer plano más íntimo y que se lea la boca."
          },
          {
            "t": "prompt",
            "v": "A closer view of this same image shows less countertop. He's talking to the camera, you can see his teeth well"
          },
          {
            "t": "label",
            "v": "PODCAST",
            "x": "Es el truco para el formato **podcast**: crea a la segunda persona mirando hacia el costado (como si le hablara a alguien sentado al lado) y con **flip horizontal** para que quede enfrentada a la primera, en el mismo estudio. Reusás el Prompt #1 para el personaje y le pegás estas líneas."
          },
          {
            "t": "prompt",
            "v": "She/he is looking to the right/left side of the frame, as if talking to someone sitting next to her/him.\nFlip the image horizontally"
          },
          {
            "t": "head",
            "v": "VIDEO",
            "x": "Abre el bloque de prompts para pasar las imágenes fijas a **VIDEO** con **Veo 3.1** (~**0,8 céntimos** por 8 segundos). No hace falta que los prompts sean largos ni complejos."
          },
          {
            "t": "label",
            "v": "PROMPT #1: USO GENERAL PARA VIDEO ESTÁTICO",
            "x": "Prompt general para un video estático: **cámara fija**, avatar mirando a cámara, movimientos de brazos realistas y tono de influencer. En **[inserta el guión aquí]** pegás lo que tiene que decir. Es tu opción por defecto para UGC hablando a cámara."
          },
          {
            "t": "prompt",
            "v": "(static camera, no movement) he/she's looking directly at the camera, realistic arm movements, clear influencer tone: \"[inserta el guión aquí]\""
          },
          {
            "t": "label",
            "v": "PROMPT #2 TALKING HEAD - MICRO-MOVIMIENTOS",
            "x": "Variante **talking head** más ajustada: prioriza micro-movimientos naturales de brazos y que diga el texto exacto con energía directa y clara. Reemplazás **[inserta el guión aquí]** por tu línea; buena cuando querés un plano cerrado y foco en la actuación."
          },
          {
            "t": "prompt",
            "v": "realistic arm movements, the woman/man says exactly with direct clear energy: \"[inserta el guión aquí]\""
          },
          {
            "t": "label",
            "v": "Español España (VEO3.1)",
            "x": "No es un prompt suelto, es un **añadido de idioma** para pegarle a los prompts de video: fuerza un español de **España** conversacional, con muletillas tipo \"a ver…\" o \"es que…\", pausas y acento peninsular neutro de Madrid. Lo sumás cuando el anuncio apunta a ese mercado."
          },
          {
            "t": "prompt",
            "v": "Use informal conversational Spanish as spoken in Spain. The phrasing, rhythm, and wording must feel like a real casual conversation between people in Spain. Include natural filler words and imperfections typical in Spain, such as:\n- \"a ver…\"\n- \"es que…\"\n- small pauses and hesitations\nAccent: Peninsular Spanish (Madrid neutral)"
          },
          {
            "t": "label",
            "v": "PODCAST",
            "x": "Marcador del formato **podcast** dentro del bloque de video (no trae prompt propio). Para el video de podcast combinás los prompts de arriba (uso general o talking head) generando un clip por cada persona con su guión."
          }
        ],
        "clases": [
          3
        ],
        "intro": "Este recurso es un tablero de **Notion** con todos los prompts listos para copiar y pegar que necesitás para armar un anuncio partiendo de una imagen de referencia de **Pinterest**. Está dividido en dos bloques: **IMAGEN** (generás al avatar y el fondo con **GPT Image 2**, a ~**0,012 € por imagen**, unas **90 imágenes por euro**) y **VIDEO** (animás esas imágenes con **Veo 3.1** por la ruta económica). La lógica es siempre la misma: agarrás una referencia que te guste, le cambiás la persona por una que no existe y la metés en el fondo que vos quieras, hablando y gesticulando a cámara.\n\nCómo se usa:\n- **Elegí la referencia** — bajás una imagen (o hacés captura si es un vídeo) de Pinterest.\n- **Cambiá el avatar** — pegás el **Prompt #1** en GPT Image 2, adjuntás la referencia y describís a tu persona nueva.\n- **Armá la escena** — con el **Prompt #2** fusionás ese avatar con el fondo que elegiste.\n- **Ajustá el plano** — usás el **Prompt #3** para acercarte, o el bloque **PODCAST** cuando necesitás dos personas en el mismo estudio.\n- **Animá** — pasás la imagen final a **Veo 3.1** con los prompts del bloque VIDEO y le insertás tu guión."
      },
      {
        "slug": "planificacion",
        "label": "Planificación (animados)",
        "tipo": "notion",
        "cardDesc": "El sistema de 8 prompts para planificar un anuncio animado (guión, storyboard…).",
        "texto": "Eres un estratega senior de marketing de respuesta directa especializado en anuncios animados de ecommerce. Vamos a construir un anuncio animado. Te paso el contexto:\n\nPRODUCTO: [PEGA AQUÍ EL PRODUCTO con 3-4 frases que describan: qué es, cómo funciona, cómo se diferencia de la competencia, y qué promete. Ejemplo: \"Cloudy. Una almohada ergonómica de viscoelástica diseñada para mantener la columna alineada durante toda la noche, independientemente de la postura (boca arriba, de lado, boca abajo). A diferencia de otras almohadas cervicales del mercado, Cloudy se adapta dinámicamente al peso del cuello y la cabeza. Promesa: menos dolor de cuello, espalda y hombros, menos ronquidos y prevención de arrugas prematuras por presión facial.\"]\n\nMERCADO: [Ej: España]\n\nESTILO ANIMACIÓN ELEGIDO: [Pixar 3D / Apple realista / Sci-fi / Claymation / Wes Anderson]\n\nTu primera tarea: construir un avatar HIPER-específico del cliente, y luego prepararme 3 búsquedas cortas para pegar en NotebookLM Discover Sources. Las búsquedas tienen que enfocarse a traer DATOS DUROS (estadísticas, estudios, mecanismos), no opiniones ni experiencias personales. Porque el anuncio final será de conversión con datos, no de identificación emocional.\n\nDevuélveme TODO con esta estructura exacta:\n\n═══════════════════════════════\n<<AVATAR>>\n═══════════════════════════════\n\nQUIÉN ES (1 línea): edad, sexo, situación de vida.\n\n3 PUNTOS DE DOLOR concretos relacionados con este problema (cada uno descrito en 1-2 líneas, específico y observable, no abstracto). El anuncio atacará uno de estos dolores con datos. Ejemplos de bueno vs malo:\n  ✅ \"Se despierta con la boca seca cada mañana y siente que no ha descansado de verdad\"\n  ❌ \"No duerme bien\"\n  ✅ \"Nota la mandíbula menos definida en fotos recientes comparado con hace 2 años\"\n  ❌ \"Le preocupa su aspecto\"\n\nLO QUE YA HA PROBADO antes (3 cosas concretas que le fallaron y por qué le fallaron).\n\nEL MIEDO PROFUNDO que no admite (el \"y si nunca…\").\n\nLO QUE QUIERE SENTIR (resultado emocional, no funcional).\n\n═══════════════════════════════\n<<BUSQUEDAS_NOTEBOOKLM>>\n═══════════════════════════════\n\nNotebookLM Discover Sources NO funciona con prompts largos. Funciona con búsquedas cortas tipo Google (2-3 frases máximo, con palabras clave específicas). Dame 3 BÚSQUEDAS DISTINTAS para pegar una a una en Discover Sources. Cada búsqueda tiene que traer DATOS DUROS utilizables en un guión de conversión, NO opiniones o experiencias subjetivas.\n\nCada búsqueda debe:\n- Tener 2-3 frases como máximo\n- Estar en el idioma del mercado\n- Atacar un ángulo DIFERENTE de datos duros (no repetir enfoque)\n- Priorizar fuentes como: estudios científicos, revistas médicas, artículos con cifras, investigaciones, datos históricos, papers académicos, contenido especializado con estadísticas\n\nDevuelve cada búsqueda en su propio bloque de código para copiar con un click.\n\nBÚSQUEDA 1 — Ángulo: ESTADÍSTICAS Y CIFRAS DEL PROBLEMA\nEjemplo de enfoque: \"qué porcentaje de la población tiene este problema\", \"cuántas horas al día/año ocurre\", \"cuánto tiempo se tarda en aparecer\", \"qué % de mejora se consigue resolviéndolo\". Buscar datos duros que cuantifiquen la magnitud.\n\nBÚSQUEDA 2 — Ángulo: MECANISMO BIOLÓGICO / CIENTÍFICO\nEjemplo de enfoque: \"cómo funciona biológicamente\", \"qué pasa en el cuerpo cuando...\", \"por qué ocurre este proceso\", \"qué dicen los estudios sobre el mecanismo\". Buscar explicaciones de causa-efecto respaldadas por ciencia.\n\nBÚSQUEDA 3 — Ángulo: EVIDENCIA HISTÓRICA / EVOLUTIVA / COMPARATIVA\nEjemplo de enfoque: \"desde cuándo existe este problema\", \"cómo era en poblaciones antiguas o culturas distintas\", \"por qué ha aumentado en la sociedad moderna\", \"qué cambió para que esto apareciera\". Buscar contexto que dé perspectiva y sirva de gancho narrativo.\n\nREGLAS:\n- Las búsquedas apuntan a DATOS, no a foros de quejas.\n- Si es posible, priorizar palabras clave como \"study\", \"research\", \"statistics\", \"percentage\", \"data\", \"estudio\", \"investigación\", \"estadísticas\", \"porcentaje\" según el idioma.\n- Cada búsqueda es autónoma y trae un tipo distinto de munición.\n\n═══════════════════════════════\n\nREGLAS FINALES:\n- Nada genérico. Si una respuesta vale para cualquier producto, está mal.\n- El avatar describe al cliente con precisión, pero NO recolecta frases literales suyas. El contenido del guión vendrá de los datos de NotebookLM, no del lenguaje del cliente.\n- Las búsquedas van al PROBLEMA con enfoque de datos, no a experiencias subjetivas.\n\n───\n\nBasándote ÚNICAMENTE en las fuentes cargadas, devuélveme los 5 INSIGHTS más fuertes para construir un anuncio animado de CONVERSIÓN con datos.\n\nUn insight ATÓMICO cumple 3 condiciones:\n1. Es específico y está respaldado por DATOS DUROS (cifras, estudios, mecanismos biológicos)\n2. Es contraintuitivo o sorprendente (rompe una creencia común del cliente)\n3. Está respaldado literalmente por las fuentes (cita la fuente)\n\nEste anuncio no va a vender con frases emocionales del cliente. Va a vender demostrando el problema con datos. Por tanto, prioriza insights que tengan MUNICIÓN DURA.\n\nDevuelve cada insight con esta estructura exacta:\n\n═══════════════════════════════\n<<INSIGHT 1>>\n═══════════════════════════════\n\nTITULAR: una frase que captura el insight con una cifra o dato incluido.\n\nLO QUE EL CLIENTE CREE: la creencia común que este insight rompe.\n\nLO QUE EL INSIGHT REVELA: la verdad incómoda detrás, con datos concretos.\n\nDATOS DUROS QUE LO RESPALDAN: lista de cifras, porcentajes, duraciones, estudios o estadísticas que aparecen en las fuentes, cada una con referencia a su fuente. Copia literal. Si una fuente dice \"el 87% de adultos…\", cópialo tal cual con la referencia.\n\nMECANISMO BIOLÓGICO / CIENTÍFICO: explica paso a paso la cadena causa-efecto que hace que este insight sea cierto, tal y como lo explican las fuentes. Ejemplo: \"al ocurrir X, se activa Y, lo que provoca Z\".\n\nCONTEXTO HISTÓRICO / COMPARATIVO (si aplica): cualquier dato sobre cuándo empezó este problema, cómo era antes, o comparativas con otras poblaciones/épocas que aparezca en las fuentes.\n\nPOR QUÉ SE PUEDE VENDER CON ESTO: 3 líneas explicando cómo se usaría este insight en un anuncio de conversión, qué cifra metería en el hook y qué mecanismo explicaría.\n\n═══════════════════════════════\n\nRepite la estructura para <<INSIGHT 2>>, <<INSIGHT 3>>, <<INSIGHT 4>> e <<INSIGHT 5>>.\n\nREGLAS:\n- No inventes cifras. Solo las que aparezcan literalmente en las fuentes.\n- Si un insight es bueno pero no tiene dato duro, márcalo como \"INSIGHT SIN DATO DURO — NECESITA REFUERZO\" y sugiere qué tipo de cifra habría que buscar para robustecerlo.\n- Prioriza insights con más munición de datos. Los insights emocionales sin datos van al final.\n- Ordena los insights del más cargado de datos al menos cargado.\n\n───\n\nPerfecto. He hecho el research en NotebookLM con el prompt que me diste. Aquí están los 5 insights atómicos:\n\n[PEGA AQUÍ LOS 5 INSIGHTS COMPLETOS DE NOTEBOOKLM con sus etiquetas <<INSIGHT 1>>, <<INSIGHT 2>>, etc.]\n\nAhora, combinando el <<AVATAR>> que ya tienes en memoria con estos insights, dame 3 ÁNGULOS de venta DISTINTOS para el anuncio animado.\n\nDevuelve cada ángulo con esta estructura exacta:\n\n═══════════════════════════════\n<<ANGULO 1>>\n═══════════════════════════════\n\nTITULAR (1 frase, en lenguaje del cliente).\n\nDOLOR ATACADO: situación concreta del avatar donde este dolor le golpea (recupéralo del avatar).\n\nREFRAME: \"Antes el cliente piensa X. Después de ver este anuncio piensa Y.\"\n\nINSIGHT BASE: cuál de los <<INSIGHT_X>> es el motor de este ángulo (cita el titular del insight).\n\nMETÁFORA VISUAL CENTRAL: la imagen mental que carga el ángulo entero. Tiene que ser DIBUJABLE en estilo [pega tu estilo elegido]. No abstracciones poéticas: una imagen concreta.\n   ✅ Ejemplo válido (Pixar): \"una columna vertebral que se ilumina en rojo donde duele cuando el personaje duerme mal\"\n   ❌ Ejemplo inválido: \"la sensación de pesadez del cansancio\"\n\nPOR QUÉ ESTE ÁNGULO PARARÍA EL SCROLL (3-4 líneas).\n\n═══════════════════════════════\n\nRepite la estructura para <<ANGULO 2>> y <<ANGULO 3>>.\n\nAl final, recomiéndame cuál de los 3 elegir y por qué (1 párrafo).\n\nREGLAS:\n- Los 3 ángulos atacan dolores DISTINTOS o usan reframes DISTINTOS. Si los 3 dicen lo mismo con palabras distintas, fallaste.\n- Cada metáfora visual tiene que ser DIBUJABLE. Si yo no puedo imaginarla en mi cabeza, no vale.\n- Cada ángulo debe beneficiarse específicamente del estilo elegido. Si uno funcionaría mejor en otro estilo, no lo propongas.\n\n───\n\nVamos con el ángulo elegido: [DI CUÁL: ANGULO 1, 2 o 3]. Construye ahora el GUIÓN del anuncio animado. Storytelling reflexivo, no copywriting agresivo. Voz en off, lectura natural, en español de [MERCADO].\n\nDURACIÓN: 50-60 segundos (140-180 palabras leídas a ritmo natural).\nESTILO: [PEGA TU ESTILO]\nÁNGULO: el que acabamos de elegir.\n\n═══════════════════════════════\nLEE PRIMERO ESTOS 2 EJEMPLOS REALES DE GUIONES QUE FUNCIONAN\n═══════════════════════════════\n\n────── EJEMPLO 1 — Cloudy (almohada) ──────\n\n\"¿Sabías que la primera almohada se inventó hacia el año 7.000 a.C.? Eso son más de 9.000 años. Y, de alguna forma… apenas la hemos cuestionado desde entonces. Siendo algo en lo que pasamos casi un tercio de nuestra vida, algo que afecta a cómo respiramos, cómo nos recuperamos, y cómo descansa nuestra columna… ¿cómo es que no ha evolucionado de verdad? En Sleepy nos hicimos exactamente esa misma pregunta. Y decidimos replantear la almohada desde cero. Presentamos Cloudy. Una almohada ergonómica diseñada de verdad para tu columna. Duermas boca arriba, de lado, o como sea. Cloudy está pensada para mantener tu columna alineada de forma natural toda la noche. Porque cuando tu columna está bien apoyada, todo cambia. Menos dolor de cuello, espalda y hombros. Menos ronquidos. Incluso ayuda a prevenir arrugas prematuras. Y es curioso… Algo tan simple que marca una diferencia tan grande. Si pudiéramos volver 9.000 años atrás y dársela al que inventó la primera almohada, lo haríamos. Pero de momento, te la llevamos directamente a casa. Prueba Cloudy hoy, sin compromiso.\"\n\n────── EJEMPLO 2 — FitMind (suplemento cerebral) ──────\n\n\"Dicen que eres lo que comes. Pero en realidad… piensas según lo que comes. Tu cerebro apenas representa un 2% de tu cuerpo, pero consume cerca del 20% de tu energía diaria. Es lo que usas todo el día. Y, aun así, casi nadie se preocupa de alimentarlo bien. Luego pasa lo de siempre: falta de claridad, poca concentración, esa sensación de estar 'espeso' sin motivo. Y no es casualidad. Tu cerebro necesita buen combustible. Comida real. Grasas saludables. Omega 3. Nutrientes que de verdad marcan diferencia. Y también influye el intestino. Si eso no está bien, la cabeza tampoco. Por eso creamos FitMind. Una forma sencilla de darle a tu cerebro lo que necesita, sin complicarte. Ingredientes respaldados. Energía mental limpia. Sin ingredientes raros. Lo notas en el día a día. Más claridad. Más enfoque. Porque cuando el cerebro funciona bien, todo lo demás va detrás.\"\n\n═══════════════════════════════\nLOS 9 PATRONES QUE TIENES QUE REPLICAR\n═══════════════════════════════\n\nPATRÓN 1 — HOOK OBLIGATORIAMENTE \"verdad MÁS GRANDE que el cliente\"\nEl hook NUNCA habla del cliente directamente. Habla de una verdad externa, anterior, que lo rodea:\n- Historia / tiempo transcurrido (9.000 años, 7.000 a.C., décadas)\n- Biología / anatomía con cifra (cerebro 20% de energía, 2.500 horas al año)\n- Creencia colectiva que se rompe (\"dicen que eres lo que comes…\")\n- Dato científico o contraintuitivo (con cifra concreta)\n\n✅ HOOKS VÁLIDOS (replican el patrón):\n- \"¿Sabías que tu cara responde a la presión muscular 8 horas cada noche?\"\n- \"Dicen que la estructura facial es genética. Pero en realidad…\"\n- \"Respiramos 25.000 veces al día. Y la mayoría lo hacemos mal.\"\n\n❌ HOOKS INVÁLIDOS (hablan del cliente directamente, PROHIBIDOS):\n- \"Estás perdiendo tu cara cada noche\" ← habla del tú\n- \"Tu mandíbula está cambiando\" ← habla del tú\n- \"No sabes por qué te ves peor\" ← habla del tú\n- \"Cada noche empeoras\" ← habla del tú\n\nSi tu hook empieza con \"Estás…\", \"Tu…\", \"Te…\", \"No sabes…\" → MAL. Reescribe.\n\nPATRÓN 2 — DATO TÉCNICO con CIFRA CONCRETA. Nunca \"mucho\", siempre \"20%\" o \"9.000 años\" o \"2.500 horas\". Si no tienes cifra, invéntala razonable basándote en el insight.\n\nPATRÓN 3 — PREGUNTA REFLEXIVA, no pregunta de venta. La pregunta es la que el cliente se hace a sí mismo, no la que el publicista le lanza.\n\nPATRÓN 4 — PUNTOS SUSPENSIVOS en 3-4 momentos reflexivos (\"Y, de alguna forma…\", \"Pero en realidad…\", \"Y es curioso…\"). Marcan al locutor pensando en alto.\n\nPATRÓN 5 — FRASE PUENTE al producto: \"Por eso creamos…\" / \"En [marca] nos hicimos esa pregunta…\". Nunca un corte abrupto al producto.\n\nPATRÓN 6 — PRODUCTO descrito por FUNCIÓN, no por adjetivos. Cero \"innovador\", \"revolucionario\", \"único\". Solo qué es y qué hace.\n\nPATRÓN 7 — BENEFICIOS en 3-4 frases telegráficas paralelas.\n\nPATRÓN 8 — BISAGRA REFLEXIVA OBLIGATORIA antes del cierre: \"Y es curioso…\", \"Al final es simple…\", \"Y también influye…\". NO es opcional. Sin esto suena a anuncio.\n\nPATRÓN 9 — CIERRE con UNA de estas 3 opciones:\n   A) Vuelta poética al hook + invitación: \"Si pudiéramos volver 9.000 años atrás… Pero de momento, te la llevamos a casa. Prueba [X] hoy.\"\n   B) Conclusión filosófica corta: \"Porque cuando [X] funciona bien, todo lo demás va detrás.\"\n   C) Reflexión + invitación suave: \"Algo tan simple… que da rabia no haberlo sabido antes. Prueba [X] esta noche.\"\n\n═══════════════════════════════\nESTRUCTURA OBLIGATORIA DEL GUIÓN\n═══════════════════════════════\n\nBLOQUE 1 — HOOK (0-5s, ~12 palabras) → Patrón 1 (verdad MÁS GRANDE)\nBLOQUE 2 — DEVELOPMENT (5-18s, ~35 palabras) → Patrones 2 + 3 (dato + pregunta reflexiva)\nBLOQUE 3 — INSIGHT/REFRAME (18-30s, ~35 palabras) → Patrón 4 (puntos suspensivos)\nBLOQUE 4 — PRODUCTO (30-40s, ~30 palabras) → Patrones 5 + 6 (frase puente + función)\nBLOQUE 5 — BENEFICIOS (40-48s, ~20 palabras) → Patrón 7 (frases telegráficas)\nBLOQUE 6 — BISAGRA + CIERRE (48-58s, ~25 palabras) → Patrones 8 + 9 (bisagra reflexiva + cierre)\n\n═══════════════════════════════\nAUTO-VERIFICACIÓN ANTES DE DEVOLVER\n═══════════════════════════════\n\nAntes de devolverme el guión, verifica:\n☐ ¿El HOOK habla de algo MÁS GRANDE que el cliente (historia, biología, creencia colectiva)?\n☐ ¿El HOOK evita empezar con \"Estás…\", \"Tu…\", \"Te…\", \"No sabes…\"?\n☐ ¿Hay al menos UN dato con cifra concreta en el BLOQUE 2?\n☐ ¿Uso puntos suspensivos en 3-4 momentos reflexivos?\n☐ ¿La frase puente al producto suena natural (Patrón 5)?\n☐ ¿El producto se describe por FUNCIÓN sin adjetivos vacíos?\n☐ ¿Los beneficios son 3-4 frases telegráficas paralelas?\n☐ ¿Hay una BISAGRA REFLEXIVA obligatoria antes del cierre?\n☐ ¿El cierre usa UNA de las 3 opciones del Patrón 9?\n\nSi alguna casilla está sin marcar, REESCRIBE antes de devolverme.\n\n═══════════════════════════════\nFORMATO DE SALIDA\n═══════════════════════════════\n\n<<GUION>>\n\n[HOOK · 0-5s]\n[texto exacto]\n(intención emocional)\n\n[DEVELOPMENT · 5-18s]\n[texto]\n(intención emocional)\n\n[INSIGHT/REFRAME · 18-30s]\n[texto]\n(intención emocional)\n\n[PRODUCTO · 30-40s]\n[texto]\n(intención emocional)\n\n[BENEFICIOS · 40-48s]\n[texto]\n(intención emocional)\n\n[BISAGRA + CIERRE · 48-58s]\n[texto]\n(intención emocional)\n\nCONTEO TOTAL: [X palabras]\nDURACIÓN ESTIMADA: [X segundos]\n\n</<GUION>>\n\n<<HOOKS_ALTERNATIVOS>>\n3 hooks alternativos al del guión. TODOS tienen que cumplir el Patrón 1 (verdad MÁS GRANDE que el cliente). Cada uno con una fórmula DISTINTA:\n1. [HOOK con fórmula \"¿Sabías que [dato histórico/biológico]?\"]\n2. [HOOK con fórmula \"Dicen que [creencia]. Pero en realidad [reframe].\"]\n3. [HOOK con fórmula \"[Dato biológico/científico/histórico]\" sin pregunta, frase directa]\n</<HOOKS_ALTERNATIVOS>>\n\nREGLAS BRUTALES:\n- Cero exclamaciones. Cero MAYÚSCULAS para énfasis.\n- Palabras prohibidas: \"descubre\", \"transforma tu vida\", \"revolucionario\", \"el futuro de\", \"única en el mercado\", \"increíble\", \"asombroso\", \"no creerás\".\n- Si una frase no aporta dato, mecanismo, reframe o reflexión, BÓRRALA.\n- Las palabras del avatar y de los insights deben aparecer LITERALMENTE en al menos 2 puntos del guión.\n- El locutor habla como un amigo más informado. Nunca como un publicista.\n- TEST FINAL: si lees el guión en voz alta y suena a anuncio, está mal. Si suena a alguien contándote algo en una cena, está bien.\n\n───\n\nVamos a construir el STORYBOARD del anuncio a partir del <<GUION>> que acabamos de cerrar.\n\n⚠️ IMPORTANTE: en este paso NO vamos a escribir prompts de NanoBanana todavía. Solo storyboard. Cinematográfico. Bien pensado. Con la metáfora visual del ángulo clavada en el centro.\n\nQuiero que trates este paso como un director de arte trabajando con un storyboard artist. No como un asistente generando contenido rápido.\n\n═══════════════════════════════════════════════════════════\nPASO 0 (OBLIGATORIO) — PLAN VISUAL ANTES DE ESCRIBIR ESCENAS\n═══════════════════════════════════════════════════════════\n\nAntes de describir ninguna escena, piensa EN VOZ ALTA (devuélvemelo escrito) sobre estas 5 preguntas:\n\n1. METÁFORA VISUAL CENTRAL: ¿cuál era la metáfora visual del <<ANGULO>> elegido? ¿En qué 2-3 escenas concretas se va a manifestar? (Si solo la usas 1 vez, la desperdicias. Si la usas en todas, la saturas.)\n\n2. MOMENTO ICÓNICO (THE MONEY SHOT): ¿cuál va a ser LA imagen de este anuncio? La que si la vieras fija en un feed te haría parar. Diséñala explícitamente. Esta escena tiene que ser visualmente distinta y memorable. Sitúala entre la escena 2 y la 4.\n\n3. PROGRESIÓN VISUAL: ¿cómo evoluciona visualmente el anuncio? Escribe una frase que describa el ARCO VISUAL completo (ej: \"empieza íntimo y real → se vuelve conceptual y abstracto → acaba volviendo a lo real pero transformado\"). Si no hay arco, hay planitud.\n\n4. CONTRASTE DE PLANOS: lista qué tipos de plano vas a usar y en cuántas escenas cada uno. Tiene que haber al menos: 1 wide shot, 2 close-ups, 1 macro/detalle, 1 overhead/cenital, 1 conceptual sin personaje. Si todos los planos son del mismo tipo, el anuncio es plano.\n\n5. ESCENAS CONCEPTUALES (MODE A): identifica 1-2 escenas que van a ser puramente simbólicas/conceptuales (sin personaje), para romper la linealidad narrativa. ¿Qué simbolizan y dónde van situadas en la secuencia?\n\nDevuélveme esto en un bloque titulado:\n<<PLAN_VISUAL>>\n1. Metáfora visual central: [cómo la vas a usar y en qué escenas]\n2. Momento icónico: [descripción de LA imagen clave, en qué escena va]\n3. Arco visual: [una frase describiendo la progresión]\n4. Contraste de planos: [lista concreta con conteos]\n5. Escenas conceptuales: [cuáles y qué simbolizan]\n</<PLAN_VISUAL>>\n\nSi al pensarlo detectas que la metáfora visual del ángulo es floja o poco explotable, AVISA antes de seguir. Si todo está sólido, continúa.\n\n═══════════════════════════════════════════════════════════\nREGLAS DE ESCRITURA DEL STORYBOARD\n═══════════════════════════════════════════════════════════\n\nREGLA 1 — UNA ESCENA = UNA IDEA VISUAL\nSi una escena tiene dos ideas, divídela en dos escenas. Mejor 14 escenas claras que 8 escenas cargadas.\n\nREGLA 2 — CADA DESCRIPCIÓN VISUAL ES DIBUJABLE\nNo escribas \"siente frustración\". Escribe \"frunce el ceño, aprieta los puños sobre la sábana, respira profundo\".\n\nREGLA 3 — DURACIÓN POR ESCENA = 4-6 SEGUNDOS\nCada clip Kling es de 5 segundos. Cada escena cubre 4-6 segundos del guión. Si un bloque del guión dura 12 segundos, son 2-3 escenas, no una.\n\nREGLA 4 — COHERENCIA DE PERSONAJE Y ENTORNO\nEl personaje principal aparece IDÉNTICO en cada escena (mismo pelo, ropa, edad). Los entornos repetidos (dormitorio, baño, oficina) también son idénticos entre escenas.\n\nREGLA 5 — TRANSICIONES PENSADAS\nCada escena propone cómo conecta visualmente con la siguiente (fade, match cut, zoom-in al detalle, cambio de plano, fade a negro).\n\nREGLA 6 — DOS TIPOS DE ESCENA:\n- NARRATIVA: con personaje en su mundo (dormitorio, baño, etc.)\n- CONCEPTUAL / MODE A: simbólica, sin personaje o con personaje en contexto abstracto (mecanismo interno, infografía estilizada, símbolo aislado)\nDebe haber mezcla de ambas.\n\nREGLA 7 — LA ESCENA FINAL VUELVE AL INICIO TRANSFORMADA\nEl cierre visual suele funcionar mejor si retoma un elemento de la primera escena pero con un cambio (misma persona pero más segura, mismo espejo pero con otra luz, misma cama pero con el producto).\n\n═══════════════════════════════════════════════════════════\nFORMATO DE SALIDA DEL STORYBOARD\n═══════════════════════════════════════════════════════════\n\nDespués del <<PLAN_VISUAL>>, devuélveme cada escena con este formato EXACTO:\n\n───────────────────────────────\nESCENA [N]\n───────────────────────────────\n\nBLOQUE DEL GUIÓN: [HOOK / DEVELOPMENT / INSIGHT / PRODUCTO / BENEFICIOS / CIERRE]\nVOZ EN OFF QUE CUBRE: [fragmento exacto del guión en español]\nDURACIÓN: [4-6 segundos]\nTIPO DE ESCENA: [NARRATIVA / CONCEPTUAL]\n\nDESCRIPCIÓN VISUAL (4-6 líneas, cinematográfica y dibujable):\n- QUIÉN aparece: [personaje con descripción física concreta O sujeto conceptual]\n- DÓNDE: [entorno con paleta de color y elementos clave]\n- QUÉ hace: [acción concreta en presente, no emociones abstractas]\n- CÓMO se ilumina: [tipo de luz, dirección, temperatura de color]\n- PLANO: [close-up / medium shot / wide shot / macro / overhead / low angle / POV]\n- DETALLE MEMORABLE: [el elemento visual que hace esta escena única, su \"gancho visual\"]\n\nMODE DE REFERENCIA: [A / B / C / D]\n(A = no reference, B = character reference, C = environment reference, D = full continuity)\n\nFRAME TYPE EN KLING: [SINGLE FRAME / START + END FRAMES]\n(START+END si hay movimiento significativo, SINGLE si es estático o el movimiento es mínimo)\n\nTRANSICIÓN A LA SIGUIENTE: [descripción visual concreta de cómo conecta]\n\n───────────────────────────────\n\nRepite para todas las escenas hasta cubrir el guión entero.\n\n═══════════════════════════════════════════════════════════\nAL FINAL DEL STORYBOARD\n═══════════════════════════════════════════════════════════\n\nDevuélveme un RESUMEN ESTRUCTURAL:\n\nTOTAL ESCENAS: [X]\nESCENAS NARRATIVAS: [X]\nESCENAS CONCEPTUALES (MODE A): [X]\nDISTRIBUCIÓN DE PLANOS:\nClose-ups: [X]\nMedium shots: [X]\nWide shots: [X]\nMacro/detalle: [X]\nOverhead/cenital: [X]\nOtros: [X]\n\nESCENA DEL MOMENTO ICÓNICO: ESCENA [N]\nESCENAS QUE USAN LA METÁFORA VISUAL CENTRAL: [N, N, N]\n\n═══════════════════════════════════════════════════════════\nREGLAS BRUTALES FINALES\n═══════════════════════════════════════════════════════════\n\n- Si no hay variedad de planos (ej: todo medium shots) → el storyboard está mal. Rehazlo.\n- Si la metáfora visual del ángulo solo aparece en 1 escena → la estás desperdiciando.\n- Si no hay escena conceptual MODE A → el anuncio va a ser plano narrativamente.\n- Si la escena final no retoma un elemento de la primera → pierdes el cierre circular.\n- Si alguna escena tiene descripción vaga tipo \"muestra el problema\" → MAL, describe exactamente qué se ve.\n\nPregúntame si algo no está claro ANTES de empezar a escribir. No asumas.\n\n───\n\nPerfecto. El <<STORYBOARD>> está cerrado. Ahora conviértelo en PROMPTS NANOBANANA PRO. Una imagen por escena. Cada escena = un prompt.\n\nESTILO ANIMACIÓN: [PEGA TU ESTILO ELEGIDO]\n\n═══════════════════════════════════════════════════════════\nREGLAS GLOBALES\n═══════════════════════════════════════════════════════════\n\n1. Todos los prompts 100% en INGLÉS (etiquetas y valores).\n\n2. STYLE LOCK: una sola frase, según el estilo elegido:\n   - Pixar 3D → \"Pixar 3D animation style\"\n   - Apple → \"Apple-style cinematic product photography\"\n   - Sci-fi → \"Sci-fi 3D animation style\"\n   - Claymation → \"Stop-motion claymation style\"\n   - Wes Anderson → \"Wes Anderson cinematic style\"\n\n3. Cada prompt va en su propio bloque de código independiente (triple backtick) para copiar con un click.\n\n4. Para mantener al personaje consistente entre escenas, pasamos la imagen anterior como referencia. La primera vez que aparece el personaje, lo describes a fondo. Las siguientes, solo dices qué cambia.\n\n═══════════════════════════════════════════════════════════\nADVERTENCIAS TÉCNICAS\n═══════════════════════════════════════════════════════════\n\nNanoBanana Pro NO hace bien:\n- Texto legible dentro de la imagen → genera sin texto, añádelo en CapCut\n- Más de 2 caras detalladas en el mismo frame\n\nSÍ hace bien:\n- Split screens y comparativas\n- Mecanismos internos estilizados\n- Composiciones simétricas\n\nSi el storyboard pide texto legible o multitud de caras, AVISA y propón alternativa.\n\n═══════════════════════════════════════════════════════════\nFORMATO DE SALIDA\n═══════════════════════════════════════════════════════════\n\nDevuélveme un bloque de código por cada escena del storyboard, en orden. Nada más. Sin títulos de escena, sin descripciones en español, sin notas. Solo los bloques de código con los prompts, uno detrás de otro.\n\nCada bloque de código con este formato:\n\n[STYLE LOCK]: [paste]\n[SUBJECT]: [English]\n[ACTION]: [English, present continuous]\n[ENVIRONMENT]: [English]\n[LIGHTING]: [English]\n[CAMERA]: [close-up / medium shot / wide shot / macro / top-down / low angle]\n[ASPECT]: 9:16 vertical\n[REFERENCE]: [si aplica: \"Use image from Scene X. Keep [what] identical. Change [what].\" Si no aplica: \"none\"]\n[EXCLUDE]: no text, no logos, no watermarks, no blurry artifacts, no extra limbs, no distorted faces\n\nAl final de todos los bloques, un aviso corto si hay problemas técnicos (texto en imagen o multitud de caras). Si no hay problemas, no escribas nada.\n\n═══════════════════════════════════════════════════════════\nAUTO-VERIFICACIÓN\n═══════════════════════════════════════════════════════════\n\n☐ ¿Todos los valores en inglés?\n☐ ¿Style lock es una sola frase corta?\n☐ ¿Cada prompt en su propio bloque de código, sin nada en medio?\n☐ ¿Una sola imagen por escena?\n☐ ¿La primera vez que aparece el personaje lo describo completo, y después solo lo que cambia con referencia a la escena anterior?\n☐ ¿Lo mismo para entornos que se repiten?\n\nSi algo falla, corrige antes de devolvérmelo.\n\n───\n\nStop. Antes de generar ninguna imagen en NanoBanana, vamos a hacer la auditoría final. Y esta vez no quiero que te quedes en \"mejorar\". Quiero que eleves el anuncio al nivel de un CORTOMETRAJE ANIMADO DE AUTOR. Lee bien esta primera parte porque define el nivel al que vamos a trabajar.\n\n═══════════════════════════════════════════════════════════\nEL NIVEL QUE ESTAMOS BUSCANDO — CINE ANIMADO DE VERDAD\n═══════════════════════════════════════════════════════════\n\nEsto NO es publicidad animada. Es un mini-cortometraje de 50 segundos que por casualidad vende un producto. El referente son los cortos de Pixar, Laika, Aardman y los ads cinematográficos tipo Apple.\n\nAntes de escribir nada, mete en tu cabeza lo que hacen estos cortos. Son tus referencias obligatorias:\n\nPIPER (Pixar, 2016) — Un pollito aprende del mar. 6 minutos. No hay palabras. Lo que enseña: primeros planos extremos con textura brutal. Emoción transmitida por ojos y movimiento, no por diálogo. La cámara es un personaje más.\n\nBAO (Pixar, 2018) — Una madre crea un dumpling que cobra vida. Lo que enseña: convertir un objeto cotidiano en un personaje emocional. Metáfora pura. El objeto TIENE ALMA y se gana el cariño del espectador en segundos.\n\nINSIDE OUT (Pixar, 2015) — Las emociones como personajes dentro de un mundo interno. Lo que enseña: lo abstracto se vuelve visitable. Un sentimiento es un lugar. Una idea es un edificio. Un problema es una criatura.\n\nLA LUNA (Pixar, 2011) — Un niño descubre que barre estrellas en la luna. Lo que enseña: mundos mágicos con reglas propias. Lo cotidiano se transforma en surreal sin previo aviso.\n\nPAPERMAN (Disney, 2012) — Un hombre persigue a una mujer con aviones de papel. Lo que enseña: metáfora visual sostenida durante todo el corto. Un solo símbolo lleva toda la emoción.\n\nCOIN OPERATED (Pixar SparkShorts) — Un niño guarda monedas toda su vida para un viaje espacial. Lo que enseña: narrativa sin palabras, emoción brutal en 5 minutos, personaje que envejece visualmente.\n\nKIWI! (Dony Permedi) — Un kiwi corta árboles en una montaña para simular volar cuando se tira. Lo que enseña: la última escena cambia TODO el significado del corto. El giro visual como moneda emocional.\n\nAPPLE \"UNDERDOGS\" y \"THE WHOLE WORKING FROM HOME THING\" — Lo que enseña: un anuncio largo puede ser un cortometraje con personajes que te importan. El producto aparece como parte de la vida, no como interrupción.\n\nAPPLE \"INTENTION\" (2022) — Apple + Pride. Lo que enseña: iluminación como narrativa. La luz cuenta la historia antes que los planos.\n\nCHIPOTLE \"BACK TO THE START\" — Un granjero y su granja industrializada. Stop-motion 2 minutos. Lo que enseña: el arco emocional completo de un cortometraje en 120 segundos. Problema, crisis, redención.\n\nPrincipios comunes a todos estos cortos:\n- La cámara se mueve con intención. No es un testigo, es un narrador.\n- Los objetos cotidianos se vuelven metáfora. Una lámpara es esperanza. Un sillón es nostalgia.\n- Los primeros planos son brutales, con textura, con imperfección humana.\n- Lo abstracto se materializa. Un pensamiento es un lugar. Un sentimiento es una criatura.\n- La luz cuenta la mitad de la historia.\n- Hay UN momento icónico. Una imagen que si la ves suelta, te dice qué es el corto.\n- El final cierra circularmente con el principio, pero transformado.\n\nSI LO QUE VAS A ENTREGAR NO CUMPLE ESTOS PRINCIPIOS, NO LO ENTREGUES. REESCRÍBELO.\n\n═══════════════════════════════════════════════════════════\nTU TAREA — DOS AUDITORÍAS Y UNA ENTREGA FINAL\n═══════════════════════════════════════════════════════════\n\nVas a hacer DOS auditorías (guión y visual) y entregar UN output definitivo. En este orden exacto.\n\n───────────────────────────────────────────────────────────\nAUDITORÍA 1 — GUIÓN\n───────────────────────────────────────────────────────────\n\nRe-lee el <<GUION>> completo de la conversación anterior. Pregúntate:\n- ¿El HOOK realmente para el scroll o es solo \"correcto\"?\n- ¿El dato duro es el más potente del research?\n- ¿El insight/reframe cambia la cabeza del cliente o solo repite lo que ya sabe?\n- ¿La frase puente al producto fluye o suena forzada?\n- ¿Los beneficios son concretos o son clichés?\n- ¿La bisagra reflexiva tiene peso real?\n- ¿El cierre deja algo al espectador?\n\nEntrega el resultado así:\n\n<<GUIÓN DEFINITIVO>>\nEl guión mejorado entero DENTRO de UN ÚNICO bloque de código (triple backtick). Todo el texto corrido, con los bloques [HOOK · 0-5s], [DEVELOPMENT · 5-18s], etc. visualmente separados por saltos de línea pero dentro del MISMO bloque de código, para copiarlo de un click.\n\n<<VARIANTE DE GUIÓN A>>\nUna alternativa COMPLETAMENTE DISTINTA del definitivo. Otro ángulo, otro tono, otra estructura. No una versión retocada. Un guión paralelo, en su propio bloque de código.\n\n<<VARIANTE DE GUIÓN B>>\nOtra alternativa también completamente distinta del definitivo y de la variante A. Tercer ángulo, tercera aproximación. En su propio bloque de código.\n\nEl usuario elegirá uno de los 3 para producir.\n\nDespués de los 3 bloques de código, añade una línea breve explicando en qué se diferencian: \"Definitivo apuesta por [X]. Variante A apuesta por [Y]. Variante B apuesta por [Z].\"\n\n───────────────────────────────────────────────────────────\nAUDITORÍA 2 — LO VISUAL (prompts y cortometraje global)\n───────────────────────────────────────────────────────────\n\nRe-lee las 3 variantes de storyboard y los prompts NanoBanana de la conversación anterior. Audítalo todo desde la mirada de un director de cortometraje Pixar.\n\nPreguntas críticas:\n- ¿Este anuncio abriría un corto de Pixar, o abriría un banner de Facebook?\n- ¿Hay alguna escena que si la sacara de contexto parecería un frame de Inside Out, Bao o Piper? ¿Cuántas?\n- ¿Hay escenas que son INFOGRAFÍA DISFRAZADA (dos almohadas aisladas, un modelo anatómico en fondo neutro, un gráfico con cifras)? Esto es el pecado capital. Marca todas.\n- ¿Hay UN momento icónico que justifique el anuncio entero? Si hay que pausar el vídeo en ese frame, ¿funciona como póster?\n- ¿La cámara se mueve con intención cinematográfica o es una cámara pasiva que registra?\n- ¿La iluminación cuenta historia o es solo \"luz bonita\"?\n- ¿Los objetos cotidianos se convierten en metáfora visual (el pillow tiene alma, el cuello es un paisaje), o todo es literal?\n- ¿Hay escenas que podrían ser CUALQUIER anuncio de cualquier producto? Eso es fallo.\n\nY crítico para tu técnica de producción one-shot:\n- ¿Cada par consecutivo de imágenes es visualmente encadenable? Si la imagen 3 es un dormitorio azul y la imagen 4 es un fondo blanco abstracto, el corte es imposible de animar. Identifica los saltos rotos.\n\nEntrega el resultado así:\n\n<<DIAGNÓSTICO VISUAL>>\nMáximo 10 líneas. Lista concreta: \"Escena X es infografía disfrazada. Propuesta: convertirla en [descripción cinematográfica]\". \"Entre escena Y y Z hay salto visual imposible. Propuesta: escena puente que [descripción]\". \"Falta momento icónico. Propuesta: escena [N] reformulada como [descripción tipo Pixar]\". Sin decorado.\n\n<<STORYBOARD DEFINITIVO>>\nReconstruye el storyboard desde cero con el nivel de los cortos referenciados arriba. Cada escena con el formato:\n\n───────────────────────────────\nESCENA [N]\n───────────────────────────────\n\nBLOQUE DEL GUIÓN: [HOOK / DEVELOPMENT / INSIGHT / PRODUCTO / BENEFICIOS / CIERRE]\nVOZ EN OFF QUE CUBRE: [fragmento exacto del guión]\nDURACIÓN: [4-6 segundos]\nTIPO DE ESCENA: [NARRATIVA / CONCEPTUAL]\n\nQUÉ PASA: descríbelo como si fuera un frame de Pixar. Qué hace la cámara, qué hace el personaje u objeto, qué cambia en la luz. Narrativo, cinematográfico.\n\nCÓMO SE SIENTE: qué emoción transmite esta escena.\n\nREFERENCIA MENTAL: menciona qué corto/escena del mundo real te inspira para esta escena (ejemplo: \"similar al primer plano del pollito en Piper cuando ve el mar por primera vez\", \"composición tipo Inside Out donde las emociones son personajes\", etc.).\n\nCONTINUIDAD ONE-SHOT: qué elemento visual de la escena anterior se mantiene al inicio de esta, y qué elemento de esta se traslada a la siguiente. Crítico para la técnica start/end encadenado.\n\n───────────────────────────────\n\nEscribe TODAS las escenas necesarias. No agrupar. No resumir.\n\n<<PROMPTS NANOBANANA DEFINITIVOS>>\nCada prompt en su propio bloque de código independiente. En inglés 100%. Formato:\n\n[STYLE LOCK]: [pega el style lock del estilo elegido]\n[SUBJECT]: [detalle visual específico, en inglés, cargado de textura cinematográfica]\n[ACTION]: [acción presente continuo con dinamismo, en inglés]\n[ENVIRONMENT]: [entorno con paleta de color precisa, en inglés]\n[LIGHTING]: [iluminación con intención narrativa, en inglés — no \"good lighting\", sino \"warm golden rim light from the window mimicking early morning melancholy\"]\n[CAMERA]: [tipo de plano y ángulo específicos, con movimiento si aplica]\n[ASPECT]: 9:16 vertical\n[REFERENCE]: [si aplica: \"Use image from Scene X. Keep [X] identical. Change [Y].\" Si no aplica: \"none\"]\n[EXCLUDE]: no text, no logos, no watermarks, no blurry artifacts, no extra limbs, no distorted faces\n\n═══════════════════════════════════════════════════════════\nREGLAS ANTI-ATAJO — OBLIGATORIAS\n═══════════════════════════════════════════════════════════\n\nPROHIBIDO:\n- \"(…continúan igual con mejoras consistentes…)\"\n- \"el resto se mantiene parecido\"\n- Agrupar 2 prompts en un bloque\n- Saltarte escenas o prompts\n- Frases decorativas al final tipo \"esto ya es un mini-cortometraje brutal\"\n\nSi te falta espacio: NO resumas. Entrega lo que puedas entero y escribe \"CONTINUAR EN SIGUIENTE MENSAJE: prompts del X al Y\". Cuando yo diga \"continúa\", me entregas el resto.\n\n═══════════════════════════════════════════════════════════\nAUTO-VERIFICACIÓN FINAL ANTES DE ENVIAR\n═══════════════════════════════════════════════════════════\n\n☐ ¿Entregué el guión definitivo en UN solo bloque de código?\n☐ ¿Entregué 2 variantes de guión completamente distintas entre sí, cada una en su bloque?\n☐ ¿Expliqué en qué se diferencia cada guión?\n☐ ¿Diagnóstico visual con máximo 10 líneas de problemas concretos?\n☐ ¿Storyboard reconstruido al nivel de los cortos referenciados?\n☐ ¿Cada escena del storyboard tiene una REFERENCIA MENTAL a un corto real?\n☐ ¿Cada escena tiene CONTINUIDAD ONE-SHOT explicada?\n☐ ¿TODOS los prompts NanoBanana entregados uno por uno?\n☐ ¿Cada prompt en su bloque de código, en inglés?\n☐ ¿Cada par consecutivo de prompts es visualmente encadenable?\n\nSi alguna casilla falla, CORRIGE antes de enviar.\n\n═══════════════════════════════════════════════════════════\nPRINCIPIO FINAL\n═══════════════════════════════════════════════════════════\n\nSi lo que vas a entregar parece \"un anuncio bien hecho\", para y reescríbelo. El objetivo es una pieza que un director de Pixar Sparkshorts aceptaría como primer pitch.\n\nNo me entregues un anuncio. Entrégame un cortometraje.\n\n───\n\nPerfecto. Hasta ahora hemos trabajado con placeholder del producto. Te paso el producto REAL. Con la información mínima. El resto lo deduces tú a partir de toda la conversación anterior (avatar, insights, ángulo elegido, guión y storyboard auditados).\n\nPRODUCTO:\nNOMBRE: [Ej: Cloudy]\nQUÉ ES EN UNA FRASE: [Ej: Una almohada ergonómica de la marca Sleepy diseñada para mantener la columna alineada durante toda la noche]\n\nCon esto y TODO el contexto que ya tienes de nuestra conversación, entrégame AHORA la versión FINAL del anuncio personalizada con este producto. Cero genérico. Quiero la estructura completa del anuncio premium, pensada, afinada y mejorada. En este formato exacto:\n\n1) <<GUIÓN DEFINITIVO>>\nEl guión entero dentro de UN ÚNICO bloque de código, con el nombre del producto bien integrado, la frase puente al producto mencionando la marca de forma natural, y todos los beneficios alineados con lo que el producto realmente promete (deducido por ti desde el contexto previo).\n\n2) <<VARIANTE A>>\nUn guión alternativo completamente distinto en ángulo y tono. En su propio bloque de código.\n\n3) <<VARIANTE B>>\nOtro guión alternativo, distinto del definitivo y de la variante A. En su propio bloque de código.\n\nDespués de los 3 bloques, explica en 3 líneas en qué se diferencia cada uno.\n\n4) <<ESTRUCTURA DEL ANUNCIO PREMIUM>>\nLa estructura narrativa-visual final del anuncio para el guión definitivo. Escena por escena, qué pasa, qué siente el espectador, cómo encadena con la siguiente. Para que yo tenga clarísimo el mini-cortometraje antes de producir.\n\n5) <<PROMPTS NANOBANANA PRO FINALES>>\nCada prompt en su propio bloque de código independiente, en inglés. TODOS. Uno por uno. Sin atajos, sin \"el resto igual\", sin agrupar.\n\nEn cada prompt donde aparezca físicamente el producto, añade al final esta línea:\n[REFERENCE IMAGE]: insert real product photo here\n\nPorque yo adjuntaré la foto real del producto en NanoBanana al generar esas imágenes. Así NanoBanana usa la foto real en vez de inventarse el producto.\n\n═══════════════════════════════════════════════════════════\nREGLAS ANTI-ATAJO\n═══════════════════════════════════════════════════════════\n\n- Entrega TODOS los prompts enteros, uno a uno, sin resumir.\n- Prohibido \"(continúan igual con ajustes)\", \"aplicar misma lógica\", agrupar 2 en un bloque.\n- Si te falta espacio: escribe \"CONTINUAR EN SIGUIENTE MENSAJE\" y yo te digo \"continúa\".\n- Nada de frases decorativas al final tipo \"esto ya es un anuncio premium\".\n\n═══════════════════════════════════════════════════════════\n\nAUTO-VERIFICACIÓN ANTES DE ENVIAR:\n☐ ¿Integré el nombre del producto con naturalidad en el guión?\n☐ ¿Deduje la marca, tono, beneficios y diferenciales desde el contexto previo sin inventar?\n☐ ¿Las 3 versiones (definitivo + A + B) son genuinamente distintas?\n☐ ¿Los prompts NanoBanana donde aparece el producto físico tienen [REFERENCE IMAGE]?\n☐ ¿Entregué TODOS los prompts uno a uno, ninguno agrupado ni resumido?\n\n───\n\nSeamless Apple-style cinematic transition. Minimal studio environment. Soft natural lighting. Clean, neutral tones. Ultra-clean. Minimal. Engineered. Apple keynote energy. Sound effects (no talking)\n\n───\n\nCreate a sci fi seamless transition between the first shot and the second shot in a sci fi animation style with sound effects (no talking)\n\n───\n\nCreate a seamless Pixar animated transition between the first shot and the second shot in a Pixar animation style with sound effects (no talking)\n\n───\n\ncreate a seamless Claymation animated transition between the first shot and the second shot in a Claymation animation style with sound effects (no talking)\n\n───\n\n**\nCreate a Wes Anderson style cinematic transition between the first frame and the end frame with sound effects (no talking)\n**",
        "capturasDriveId": "1mpBGbE7X2JSD9Qi7R01orfYue9N6z6p0",
        "notionUrl": "https://www.notion.so/Planificaci-n-341ec2aef76b8080bb16dc34a882c0bb",
        "bloques": [
          {
            "t": "head",
            "v": "1. Avatar + research prompt",
            "x": "Es el **prompt 1**, el que arranca todo en un chat nuevo de ChatGPT: pegás tu **producto** (3-4 frases), el **mercado** al que apuntás y el **estilo** animado (Pixar, claymation, Apple, realista…). Hace dos cosas de una: define el **avatar** de cliente (dolores, qué busca, qué le resolvés) y te prepara **3 búsquedas** listas para llevar a NotebookLM."
          },
          {
            "t": "prompt",
            "v": "Eres un estratega senior de marketing de respuesta directa especializado en anuncios animados de ecommerce. Vamos a construir un anuncio animado. Te paso el contexto:\n\nPRODUCTO: [PEGA AQUÍ EL PRODUCTO con 3-4 frases que describan: qué es, cómo funciona, cómo se diferencia de la competencia, y qué promete. Ejemplo: \"Cloudy. Una almohada ergonómica de viscoelástica diseñada para mantener la columna alineada durante toda la noche, independientemente de la postura (boca arriba, de lado, boca abajo). A diferencia de otras almohadas cervicales del mercado, Cloudy se adapta dinámicamente al peso del cuello y la cabeza. Promesa: menos dolor de cuello, espalda y hombros, menos ronquidos y prevención de arrugas prematuras por presión facial.\"]\n\nMERCADO: [Ej: España]\n\nESTILO ANIMACIÓN ELEGIDO: [Pixar 3D / Apple realista / Sci-fi / Claymation / Wes Anderson]\n\nTu primera tarea: construir un avatar HIPER-específico del cliente, y luego prepararme 3 búsquedas cortas para pegar en NotebookLM Discover Sources. Las búsquedas tienen que enfocarse a traer DATOS DUROS (estadísticas, estudios, mecanismos), no opiniones ni experiencias personales. Porque el anuncio final será de conversión con datos, no de identificación emocional.\n\nDevuélveme TODO con esta estructura exacta:\n\n═══════════════════════════════\n<<AVATAR>>\n═══════════════════════════════\n\nQUIÉN ES (1 línea): edad, sexo, situación de vida.\n\n3 PUNTOS DE DOLOR concretos relacionados con este problema (cada uno descrito en 1-2 líneas, específico y observable, no abstracto). El anuncio atacará uno de estos dolores con datos. Ejemplos de bueno vs malo:\n  ✅ \"Se despierta con la boca seca cada mañana y siente que no ha descansado de verdad\"\n  ❌ \"No duerme bien\"\n  ✅ \"Nota la mandíbula menos definida en fotos recientes comparado con hace 2 años\"\n  ❌ \"Le preocupa su aspecto\"\n\nLO QUE YA HA PROBADO antes (3 cosas concretas que le fallaron y por qué le fallaron).\n\nEL MIEDO PROFUNDO que no admite (el \"y si nunca…\").\n\nLO QUE QUIERE SENTIR (resultado emocional, no funcional).\n\n═══════════════════════════════\n<<BUSQUEDAS_NOTEBOOKLM>>\n═══════════════════════════════\n\nNotebookLM Discover Sources NO funciona con prompts largos. Funciona con búsquedas cortas tipo Google (2-3 frases máximo, con palabras clave específicas). Dame 3 BÚSQUEDAS DISTINTAS para pegar una a una en Discover Sources. Cada búsqueda tiene que traer DATOS DUROS utilizables en un guión de conversión, NO opiniones o experiencias subjetivas.\n\nCada búsqueda debe:\n- Tener 2-3 frases como máximo\n- Estar en el idioma del mercado\n- Atacar un ángulo DIFERENTE de datos duros (no repetir enfoque)\n- Priorizar fuentes como: estudios científicos, revistas médicas, artículos con cifras, investigaciones, datos históricos, papers académicos, contenido especializado con estadísticas\n\nDevuelve cada búsqueda en su propio bloque de código para copiar con un click.\n\nBÚSQUEDA 1 — Ángulo: ESTADÍSTICAS Y CIFRAS DEL PROBLEMA\nEjemplo de enfoque: \"qué porcentaje de la población tiene este problema\", \"cuántas horas al día/año ocurre\", \"cuánto tiempo se tarda en aparecer\", \"qué % de mejora se consigue resolviéndolo\". Buscar datos duros que cuantifiquen la magnitud.\n\nBÚSQUEDA 2 — Ángulo: MECANISMO BIOLÓGICO / CIENTÍFICO\nEjemplo de enfoque: \"cómo funciona biológicamente\", \"qué pasa en el cuerpo cuando...\", \"por qué ocurre este proceso\", \"qué dicen los estudios sobre el mecanismo\". Buscar explicaciones de causa-efecto respaldadas por ciencia.\n\nBÚSQUEDA 3 — Ángulo: EVIDENCIA HISTÓRICA / EVOLUTIVA / COMPARATIVA\nEjemplo de enfoque: \"desde cuándo existe este problema\", \"cómo era en poblaciones antiguas o culturas distintas\", \"por qué ha aumentado en la sociedad moderna\", \"qué cambió para que esto apareciera\". Buscar contexto que dé perspectiva y sirva de gancho narrativo.\n\nREGLAS:\n- Las búsquedas apuntan a DATOS, no a foros de quejas.\n- Si es posible, priorizar palabras clave como \"study\", \"research\", \"statistics\", \"percentage\", \"data\", \"estudio\", \"investigación\", \"estadísticas\", \"porcentaje\" según el idioma.\n- Cada búsqueda es autónoma y trae un tipo distinto de munición.\n\n═══════════════════════════════\n\nREGLAS FINALES:\n- Nada genérico. Si una respuesta vale para cualquier producto, está mal.\n- El avatar describe al cliente con precisión, pero NO recolecta frases literales suyas. El contenido del guión vendrá de los datos de NotebookLM, no del lenguaje del cliente.\n- Las búsquedas van al PROBLEMA con enfoque de datos, no a experiencias subjetivas."
          },
          {
            "t": "head",
            "v": "2. NotebookLM (auto-research + insights)",
            "x": "Es el **prompt 2**, y este NO va en ChatGPT sino en **NotebookLM**: primero cargás ahí las 3 búsquedas del paso anterior y las importás, y recién ahí lo pegás. Te devuelve los **5 insights** más fuertes con **datos duros y cifras reales** (contraintuitivos y citando la fuente), la munición para que el guión sorprenda. Si no te convencen, iterás hasta sacar los mejores."
          },
          {
            "t": "prompt",
            "v": "Basándote ÚNICAMENTE en las fuentes cargadas, devuélveme los 5 INSIGHTS más fuertes para construir un anuncio animado de CONVERSIÓN con datos.\n\nUn insight ATÓMICO cumple 3 condiciones:\n1. Es específico y está respaldado por DATOS DUROS (cifras, estudios, mecanismos biológicos)\n2. Es contraintuitivo o sorprendente (rompe una creencia común del cliente)\n3. Está respaldado literalmente por las fuentes (cita la fuente)\n\nEste anuncio no va a vender con frases emocionales del cliente. Va a vender demostrando el problema con datos. Por tanto, prioriza insights que tengan MUNICIÓN DURA.\n\nDevuelve cada insight con esta estructura exacta:\n\n═══════════════════════════════\n<<INSIGHT 1>>\n═══════════════════════════════\n\nTITULAR: una frase que captura el insight con una cifra o dato incluido.\n\nLO QUE EL CLIENTE CREE: la creencia común que este insight rompe.\n\nLO QUE EL INSIGHT REVELA: la verdad incómoda detrás, con datos concretos.\n\nDATOS DUROS QUE LO RESPALDAN: lista de cifras, porcentajes, duraciones, estudios o estadísticas que aparecen en las fuentes, cada una con referencia a su fuente. Copia literal. Si una fuente dice \"el 87% de adultos…\", cópialo tal cual con la referencia.\n\nMECANISMO BIOLÓGICO / CIENTÍFICO: explica paso a paso la cadena causa-efecto que hace que este insight sea cierto, tal y como lo explican las fuentes. Ejemplo: \"al ocurrir X, se activa Y, lo que provoca Z\".\n\nCONTEXTO HISTÓRICO / COMPARATIVO (si aplica): cualquier dato sobre cuándo empezó este problema, cómo era antes, o comparativas con otras poblaciones/épocas que aparezca en las fuentes.\n\nPOR QUÉ SE PUEDE VENDER CON ESTO: 3 líneas explicando cómo se usaría este insight en un anuncio de conversión, qué cifra metería en el hook y qué mecanismo explicaría.\n\n═══════════════════════════════\n\nRepite la estructura para <<INSIGHT 2>>, <<INSIGHT 3>>, <<INSIGHT 4>> e <<INSIGHT 5>>.\n\nREGLAS:\n- No inventes cifras. Solo las que aparezcan literalmente en las fuentes.\n- Si un insight es bueno pero no tiene dato duro, márcalo como \"INSIGHT SIN DATO DURO — NECESITA REFUERZO\" y sugiere qué tipo de cifra habría que buscar para robustecerlo.\n- Prioriza insights con más munición de datos. Los insights emocionales sin datos van al final.\n- Ordena los insights del más cargado de datos al menos cargado."
          },
          {
            "t": "head",
            "v": "3. Ángulos",
            "x": "Es el **prompt 3**: volvés a ChatGPT y, donde dice pegar insights, metés los **5 insights** de NotebookLM. Cruza esos datos con el avatar y te propone **3 ángulos de venta distintos**, cada uno atacando un dolor diferente. Elegís el que más te pegue."
          },
          {
            "t": "prompt",
            "v": "Perfecto. He hecho el research en NotebookLM con el prompt que me diste. Aquí están los 5 insights atómicos:\n\n[PEGA AQUÍ LOS 5 INSIGHTS COMPLETOS DE NOTEBOOKLM con sus etiquetas <<INSIGHT 1>>, <<INSIGHT 2>>, etc.]\n\nAhora, combinando el <<AVATAR>> que ya tienes en memoria con estos insights, dame 3 ÁNGULOS de venta DISTINTOS para el anuncio animado.\n\nDevuelve cada ángulo con esta estructura exacta:\n\n═══════════════════════════════\n<<ANGULO 1>>\n═══════════════════════════════\n\nTITULAR (1 frase, en lenguaje del cliente).\n\nDOLOR ATACADO: situación concreta del avatar donde este dolor le golpea (recupéralo del avatar).\n\nREFRAME: \"Antes el cliente piensa X. Después de ver este anuncio piensa Y.\"\n\nINSIGHT BASE: cuál de los <<INSIGHT_X>> es el motor de este ángulo (cita el titular del insight).\n\nMETÁFORA VISUAL CENTRAL: la imagen mental que carga el ángulo entero. Tiene que ser DIBUJABLE en estilo [pega tu estilo elegido]. No abstracciones poéticas: una imagen concreta.\n   ✅ Ejemplo válido (Pixar): \"una columna vertebral que se ilumina en rojo donde duele cuando el personaje duerme mal\"\n   ❌ Ejemplo inválido: \"la sensación de pesadez del cansancio\"\n\nPOR QUÉ ESTE ÁNGULO PARARÍA EL SCROLL (3-4 líneas).\n\n═══════════════════════════════\n\nRepite la estructura para <<ANGULO 2>> y <<ANGULO 3>>.\n\nAl final, recomiéndame cuál de los 3 elegir y por qué (1 párrafo).\n\nREGLAS:\n- Los 3 ángulos atacan dolores DISTINTOS o usan reframes DISTINTOS. Si los 3 dicen lo mismo con palabras distintas, fallaste.\n- Cada metáfora visual tiene que ser DIBUJABLE. Si yo no puedo imaginarla en mi cabeza, no vale.\n- Cada ángulo debe beneficiarse específicamente del estilo elegido. Si uno funcionaría mejor en otro estilo, no lo propongas."
          },
          {
            "t": "head",
            "v": "4. Guión",
            "x": "Es el **prompt 4**, el **guión**: le decís cuál de los 3 ángulos elegiste y te escribe el texto de **voz en off** (50-60 segundos, ~140-180 palabras) en storytelling reflexivo, no copy agresivo. Es una de las partes más importantes porque es cómo se transmite el mensaje, así que conviene iterar si algo no cierra."
          },
          {
            "t": "prompt",
            "v": "Vamos con el ángulo elegido: [DI CUÁL: ANGULO 1, 2 o 3]. Construye ahora el GUIÓN del anuncio animado. Storytelling reflexivo, no copywriting agresivo. Voz en off, lectura natural, en español de [MERCADO].\n\nDURACIÓN: 50-60 segundos (140-180 palabras leídas a ritmo natural).\nESTILO: [PEGA TU ESTILO]\nÁNGULO: el que acabamos de elegir.\n\n═══════════════════════════════\nLEE PRIMERO ESTOS 2 EJEMPLOS REALES DE GUIONES QUE FUNCIONAN\n═══════════════════════════════\n\n────── EJEMPLO 1 — Cloudy (almohada) ──────\n\n\"¿Sabías que la primera almohada se inventó hacia el año 7.000 a.C.? Eso son más de 9.000 años. Y, de alguna forma… apenas la hemos cuestionado desde entonces. Siendo algo en lo que pasamos casi un tercio de nuestra vida, algo que afecta a cómo respiramos, cómo nos recuperamos, y cómo descansa nuestra columna… ¿cómo es que no ha evolucionado de verdad? En Sleepy nos hicimos exactamente esa misma pregunta. Y decidimos replantear la almohada desde cero. Presentamos Cloudy. Una almohada ergonómica diseñada de verdad para tu columna. Duermas boca arriba, de lado, o como sea. Cloudy está pensada para mantener tu columna alineada de forma natural toda la noche. Porque cuando tu columna está bien apoyada, todo cambia. Menos dolor de cuello, espalda y hombros. Menos ronquidos. Incluso ayuda a prevenir arrugas prematuras. Y es curioso… Algo tan simple que marca una diferencia tan grande. Si pudiéramos volver 9.000 años atrás y dársela al que inventó la primera almohada, lo haríamos. Pero de momento, te la llevamos directamente a casa. Prueba Cloudy hoy, sin compromiso.\"\n\n────── EJEMPLO 2 — FitMind (suplemento cerebral) ──────\n\n\"Dicen que eres lo que comes. Pero en realidad… piensas según lo que comes. Tu cerebro apenas representa un 2% de tu cuerpo, pero consume cerca del 20% de tu energía diaria. Es lo que usas todo el día. Y, aun así, casi nadie se preocupa de alimentarlo bien. Luego pasa lo de siempre: falta de claridad, poca concentración, esa sensación de estar 'espeso' sin motivo. Y no es casualidad. Tu cerebro necesita buen combustible. Comida real. Grasas saludables. Omega 3. Nutrientes que de verdad marcan diferencia. Y también influye el intestino. Si eso no está bien, la cabeza tampoco. Por eso creamos FitMind. Una forma sencilla de darle a tu cerebro lo que necesita, sin complicarte. Ingredientes respaldados. Energía mental limpia. Sin ingredientes raros. Lo notas en el día a día. Más claridad. Más enfoque. Porque cuando el cerebro funciona bien, todo lo demás va detrás.\"\n\n═══════════════════════════════\nLOS 9 PATRONES QUE TIENES QUE REPLICAR\n═══════════════════════════════\n\nPATRÓN 1 — HOOK OBLIGATORIAMENTE \"verdad MÁS GRANDE que el cliente\"\nEl hook NUNCA habla del cliente directamente. Habla de una verdad externa, anterior, que lo rodea:\n- Historia / tiempo transcurrido (9.000 años, 7.000 a.C., décadas)\n- Biología / anatomía con cifra (cerebro 20% de energía, 2.500 horas al año)\n- Creencia colectiva que se rompe (\"dicen que eres lo que comes…\")\n- Dato científico o contraintuitivo (con cifra concreta)\n\n✅ HOOKS VÁLIDOS (replican el patrón):\n- \"¿Sabías que tu cara responde a la presión muscular 8 horas cada noche?\"\n- \"Dicen que la estructura facial es genética. Pero en realidad…\"\n- \"Respiramos 25.000 veces al día. Y la mayoría lo hacemos mal.\"\n\n❌ HOOKS INVÁLIDOS (hablan del cliente directamente, PROHIBIDOS):\n- \"Estás perdiendo tu cara cada noche\" ← habla del tú\n- \"Tu mandíbula está cambiando\" ← habla del tú\n- \"No sabes por qué te ves peor\" ← habla del tú\n- \"Cada noche empeoras\" ← habla del tú\n\nSi tu hook empieza con \"Estás…\", \"Tu…\", \"Te…\", \"No sabes…\" → MAL. Reescribe.\n\nPATRÓN 2 — DATO TÉCNICO con CIFRA CONCRETA. Nunca \"mucho\", siempre \"20%\" o \"9.000 años\" o \"2.500 horas\". Si no tienes cifra, invéntala razonable basándote en el insight.\n\nPATRÓN 3 — PREGUNTA REFLEXIVA, no pregunta de venta. La pregunta es la que el cliente se hace a sí mismo, no la que el publicista le lanza.\n\nPATRÓN 4 — PUNTOS SUSPENSIVOS en 3-4 momentos reflexivos (\"Y, de alguna forma…\", \"Pero en realidad…\", \"Y es curioso…\"). Marcan al locutor pensando en alto.\n\nPATRÓN 5 — FRASE PUENTE al producto: \"Por eso creamos…\" / \"En [marca] nos hicimos esa pregunta…\". Nunca un corte abrupto al producto.\n\nPATRÓN 6 — PRODUCTO descrito por FUNCIÓN, no por adjetivos. Cero \"innovador\", \"revolucionario\", \"único\". Solo qué es y qué hace.\n\nPATRÓN 7 — BENEFICIOS en 3-4 frases telegráficas paralelas.\n\nPATRÓN 8 — BISAGRA REFLEXIVA OBLIGATORIA antes del cierre: \"Y es curioso…\", \"Al final es simple…\", \"Y también influye…\". NO es opcional. Sin esto suena a anuncio.\n\nPATRÓN 9 — CIERRE con UNA de estas 3 opciones:\n   A) Vuelta poética al hook + invitación: \"Si pudiéramos volver 9.000 años atrás… Pero de momento, te la llevamos a casa. Prueba [X] hoy.\"\n   B) Conclusión filosófica corta: \"Porque cuando [X] funciona bien, todo lo demás va detrás.\"\n   C) Reflexión + invitación suave: \"Algo tan simple… que da rabia no haberlo sabido antes. Prueba [X] esta noche.\"\n\n═══════════════════════════════\nESTRUCTURA OBLIGATORIA DEL GUIÓN\n═══════════════════════════════\n\nBLOQUE 1 — HOOK (0-5s, ~12 palabras) → Patrón 1 (verdad MÁS GRANDE)\nBLOQUE 2 — DEVELOPMENT (5-18s, ~35 palabras) → Patrones 2 + 3 (dato + pregunta reflexiva)\nBLOQUE 3 — INSIGHT/REFRAME (18-30s, ~35 palabras) → Patrón 4 (puntos suspensivos)\nBLOQUE 4 — PRODUCTO (30-40s, ~30 palabras) → Patrones 5 + 6 (frase puente + función)\nBLOQUE 5 — BENEFICIOS (40-48s, ~20 palabras) → Patrón 7 (frases telegráficas)\nBLOQUE 6 — BISAGRA + CIERRE (48-58s, ~25 palabras) → Patrones 8 + 9 (bisagra reflexiva + cierre)\n\n═══════════════════════════════\nAUTO-VERIFICACIÓN ANTES DE DEVOLVER\n═══════════════════════════════\n\nAntes de devolverme el guión, verifica:\n☐ ¿El HOOK habla de algo MÁS GRANDE que el cliente (historia, biología, creencia colectiva)?\n☐ ¿El HOOK evita empezar con \"Estás…\", \"Tu…\", \"Te…\", \"No sabes…\"?\n☐ ¿Hay al menos UN dato con cifra concreta en el BLOQUE 2?\n☐ ¿Uso puntos suspensivos en 3-4 momentos reflexivos?\n☐ ¿La frase puente al producto suena natural (Patrón 5)?\n☐ ¿El producto se describe por FUNCIÓN sin adjetivos vacíos?\n☐ ¿Los beneficios son 3-4 frases telegráficas paralelas?\n☐ ¿Hay una BISAGRA REFLEXIVA obligatoria antes del cierre?\n☐ ¿El cierre usa UNA de las 3 opciones del Patrón 9?\n\nSi alguna casilla está sin marcar, REESCRIBE antes de devolverme.\n\n═══════════════════════════════\nFORMATO DE SALIDA\n═══════════════════════════════\n\n<<GUION>>\n\n[HOOK · 0-5s]\n[texto exacto]\n(intención emocional)\n\n[DEVELOPMENT · 5-18s]\n[texto]\n(intención emocional)\n\n[INSIGHT/REFRAME · 18-30s]\n[texto]\n(intención emocional)\n\n[PRODUCTO · 30-40s]\n[texto]\n(intención emocional)\n\n[BENEFICIOS · 40-48s]\n[texto]\n(intención emocional)\n\n[BISAGRA + CIERRE · 48-58s]\n[texto]\n(intención emocional)\n\nCONTEO TOTAL: [X palabras]\nDURACIÓN ESTIMADA: [X segundos]\n\n</<GUION>>\n\n<<HOOKS_ALTERNATIVOS>>\n3 hooks alternativos al del guión. TODOS tienen que cumplir el Patrón 1 (verdad MÁS GRANDE que el cliente). Cada uno con una fórmula DISTINTA:\n1. [HOOK con fórmula \"¿Sabías que [dato histórico/biológico]?\"]\n2. [HOOK con fórmula \"Dicen que [creencia]. Pero en realidad [reframe].\"]\n3. [HOOK con fórmula \"[Dato biológico/científico/histórico]\" sin pregunta, frase directa]\n</<HOOKS_ALTERNATIVOS>>\n\nREGLAS BRUTALES:\n- Cero exclamaciones. Cero MAYÚSCULAS para énfasis.\n- Palabras prohibidas: \"descubre\", \"transforma tu vida\", \"revolucionario\", \"el futuro de\", \"única en el mercado\", \"increíble\", \"asombroso\", \"no creerás\".\n- Si una frase no aporta dato, mecanismo, reframe o reflexión, BÓRRALA.\n- Las palabras del avatar y de los insights deben aparecer LITERALMENTE en al menos 2 puntos del guión.\n- El locutor habla como un amigo más informado. Nunca como un publicista.\n- TEST FINAL: si lees el guión en voz alta y suena a anuncio, está mal. Si suena a alguien contándote algo en una cena, está bien."
          },
          {
            "t": "head",
            "v": "5. Storyboard (Escenas)",
            "x": "Es el **prompt 5**, el **storyboard**: convierte el guión en la estructura visual de escenas, pensada como un director de arte (todavía **sin prompts de imagen**). Al leerlo revisás si la propuesta visual te convence, si pedís alternativas o si tenés una idea mejor; es el momento de dejarlo a tu gusto antes de seguir."
          },
          {
            "t": "prompt",
            "v": "Vamos a construir el STORYBOARD del anuncio a partir del <<GUION>> que acabamos de cerrar.\n\n⚠️ IMPORTANTE: en este paso NO vamos a escribir prompts de NanoBanana todavía. Solo storyboard. Cinematográfico. Bien pensado. Con la metáfora visual del ángulo clavada en el centro.\n\nQuiero que trates este paso como un director de arte trabajando con un storyboard artist. No como un asistente generando contenido rápido.\n\n═══════════════════════════════════════════════════════════\nPASO 0 (OBLIGATORIO) — PLAN VISUAL ANTES DE ESCRIBIR ESCENAS\n═══════════════════════════════════════════════════════════\n\nAntes de describir ninguna escena, piensa EN VOZ ALTA (devuélvemelo escrito) sobre estas 5 preguntas:\n\n1. METÁFORA VISUAL CENTRAL: ¿cuál era la metáfora visual del <<ANGULO>> elegido? ¿En qué 2-3 escenas concretas se va a manifestar? (Si solo la usas 1 vez, la desperdicias. Si la usas en todas, la saturas.)\n\n2. MOMENTO ICÓNICO (THE MONEY SHOT): ¿cuál va a ser LA imagen de este anuncio? La que si la vieras fija en un feed te haría parar. Diséñala explícitamente. Esta escena tiene que ser visualmente distinta y memorable. Sitúala entre la escena 2 y la 4.\n\n3. PROGRESIÓN VISUAL: ¿cómo evoluciona visualmente el anuncio? Escribe una frase que describa el ARCO VISUAL completo (ej: \"empieza íntimo y real → se vuelve conceptual y abstracto → acaba volviendo a lo real pero transformado\"). Si no hay arco, hay planitud.\n\n4. CONTRASTE DE PLANOS: lista qué tipos de plano vas a usar y en cuántas escenas cada uno. Tiene que haber al menos: 1 wide shot, 2 close-ups, 1 macro/detalle, 1 overhead/cenital, 1 conceptual sin personaje. Si todos los planos son del mismo tipo, el anuncio es plano.\n\n5. ESCENAS CONCEPTUALES (MODE A): identifica 1-2 escenas que van a ser puramente simbólicas/conceptuales (sin personaje), para romper la linealidad narrativa. ¿Qué simbolizan y dónde van situadas en la secuencia?\n\nDevuélveme esto en un bloque titulado:\n<<PLAN_VISUAL>>\n1. Metáfora visual central: [cómo la vas a usar y en qué escenas]\n2. Momento icónico: [descripción de LA imagen clave, en qué escena va]\n3. Arco visual: [una frase describiendo la progresión]\n4. Contraste de planos: [lista concreta con conteos]\n5. Escenas conceptuales: [cuáles y qué simbolizan]\n</<PLAN_VISUAL>>\n\nSi al pensarlo detectas que la metáfora visual del ángulo es floja o poco explotable, AVISA antes de seguir. Si todo está sólido, continúa.\n\n═══════════════════════════════════════════════════════════\nREGLAS DE ESCRITURA DEL STORYBOARD\n═══════════════════════════════════════════════════════════\n\nREGLA 1 — UNA ESCENA = UNA IDEA VISUAL\nSi una escena tiene dos ideas, divídela en dos escenas. Mejor 14 escenas claras que 8 escenas cargadas.\n\nREGLA 2 — CADA DESCRIPCIÓN VISUAL ES DIBUJABLE\nNo escribas \"siente frustración\". Escribe \"frunce el ceño, aprieta los puños sobre la sábana, respira profundo\".\n\nREGLA 3 — DURACIÓN POR ESCENA = 4-6 SEGUNDOS\nCada clip Kling es de 5 segundos. Cada escena cubre 4-6 segundos del guión. Si un bloque del guión dura 12 segundos, son 2-3 escenas, no una.\n\nREGLA 4 — COHERENCIA DE PERSONAJE Y ENTORNO\nEl personaje principal aparece IDÉNTICO en cada escena (mismo pelo, ropa, edad). Los entornos repetidos (dormitorio, baño, oficina) también son idénticos entre escenas.\n\nREGLA 5 — TRANSICIONES PENSADAS\nCada escena propone cómo conecta visualmente con la siguiente (fade, match cut, zoom-in al detalle, cambio de plano, fade a negro).\n\nREGLA 6 — DOS TIPOS DE ESCENA:\n- NARRATIVA: con personaje en su mundo (dormitorio, baño, etc.)\n- CONCEPTUAL / MODE A: simbólica, sin personaje o con personaje en contexto abstracto (mecanismo interno, infografía estilizada, símbolo aislado)\nDebe haber mezcla de ambas.\n\nREGLA 7 — LA ESCENA FINAL VUELVE AL INICIO TRANSFORMADA\nEl cierre visual suele funcionar mejor si retoma un elemento de la primera escena pero con un cambio (misma persona pero más segura, mismo espejo pero con otra luz, misma cama pero con el producto).\n\n═══════════════════════════════════════════════════════════\nFORMATO DE SALIDA DEL STORYBOARD\n═══════════════════════════════════════════════════════════\n\nDespués del <<PLAN_VISUAL>>, devuélveme cada escena con este formato EXACTO:\n\n───────────────────────────────\nESCENA [N]\n───────────────────────────────\n\nBLOQUE DEL GUIÓN: [HOOK / DEVELOPMENT / INSIGHT / PRODUCTO / BENEFICIOS / CIERRE]\nVOZ EN OFF QUE CUBRE: [fragmento exacto del guión en español]\nDURACIÓN: [4-6 segundos]\nTIPO DE ESCENA: [NARRATIVA / CONCEPTUAL]\n\nDESCRIPCIÓN VISUAL (4-6 líneas, cinematográfica y dibujable):\n- QUIÉN aparece: [personaje con descripción física concreta O sujeto conceptual]\n- DÓNDE: [entorno con paleta de color y elementos clave]\n- QUÉ hace: [acción concreta en presente, no emociones abstractas]\n- CÓMO se ilumina: [tipo de luz, dirección, temperatura de color]\n- PLANO: [close-up / medium shot / wide shot / macro / overhead / low angle / POV]\n- DETALLE MEMORABLE: [el elemento visual que hace esta escena única, su \"gancho visual\"]\n\nMODE DE REFERENCIA: [A / B / C / D]\n(A = no reference, B = character reference, C = environment reference, D = full continuity)\n\nFRAME TYPE EN KLING: [SINGLE FRAME / START + END FRAMES]\n(START+END si hay movimiento significativo, SINGLE si es estático o el movimiento es mínimo)\n\nTRANSICIÓN A LA SIGUIENTE: [descripción visual concreta de cómo conecta]\n\n───────────────────────────────\n\nRepite para todas las escenas hasta cubrir el guión entero.\n\n═══════════════════════════════════════════════════════════\nAL FINAL DEL STORYBOARD\n═══════════════════════════════════════════════════════════\n\nDevuélveme un RESUMEN ESTRUCTURAL:\n\nTOTAL ESCENAS: [X]\nESCENAS NARRATIVAS: [X]\nESCENAS CONCEPTUALES (MODE A): [X]\nDISTRIBUCIÓN DE PLANOS:\nClose-ups: [X]\nMedium shots: [X]\nWide shots: [X]\nMacro/detalle: [X]\nOverhead/cenital: [X]\nOtros: [X]\n\nESCENA DEL MOMENTO ICÓNICO: ESCENA [N]\nESCENAS QUE USAN LA METÁFORA VISUAL CENTRAL: [N, N, N]\n\n═══════════════════════════════════════════════════════════\nREGLAS BRUTALES FINALES\n═══════════════════════════════════════════════════════════\n\n- Si no hay variedad de planos (ej: todo medium shots) → el storyboard está mal. Rehazlo.\n- Si la metáfora visual del ángulo solo aparece en 1 escena → la estás desperdiciando.\n- Si no hay escena conceptual MODE A → el anuncio va a ser plano narrativamente.\n- Si la escena final no retoma un elemento de la primera → pierdes el cierre circular.\n- Si alguna escena tiene descripción vaga tipo \"muestra el problema\" → MAL, describe exactamente qué se ve.\n\nPregúntame si algo no está claro ANTES de empezar a escribir. No asumas."
          },
          {
            "t": "head",
            "v": "6. Prompts NB",
            "x": "Es el **prompt 6**: toma el storyboard y lo transforma en **prompts de imagen para NanoBanana**, uno por escena. Van todos **en inglés** y le dejás fijado tu **estilo** (por ejemplo Pixar 3D) para que todas las imágenes salgan coherentes."
          },
          {
            "t": "prompt",
            "v": "Perfecto. El <<STORYBOARD>> está cerrado. Ahora conviértelo en PROMPTS NANOBANANA PRO. Una imagen por escena. Cada escena = un prompt.\n\nESTILO ANIMACIÓN: [PEGA TU ESTILO ELEGIDO]\n\n═══════════════════════════════════════════════════════════\nREGLAS GLOBALES\n═══════════════════════════════════════════════════════════\n\n1. Todos los prompts 100% en INGLÉS (etiquetas y valores).\n\n2. STYLE LOCK: una sola frase, según el estilo elegido:\n   - Pixar 3D → \"Pixar 3D animation style\"\n   - Apple → \"Apple-style cinematic product photography\"\n   - Sci-fi → \"Sci-fi 3D animation style\"\n   - Claymation → \"Stop-motion claymation style\"\n   - Wes Anderson → \"Wes Anderson cinematic style\"\n\n3. Cada prompt va en su propio bloque de código independiente (triple backtick) para copiar con un click.\n\n4. Para mantener al personaje consistente entre escenas, pasamos la imagen anterior como referencia. La primera vez que aparece el personaje, lo describes a fondo. Las siguientes, solo dices qué cambia.\n\n═══════════════════════════════════════════════════════════\nADVERTENCIAS TÉCNICAS\n═══════════════════════════════════════════════════════════\n\nNanoBanana Pro NO hace bien:\n- Texto legible dentro de la imagen → genera sin texto, añádelo en CapCut\n- Más de 2 caras detalladas en el mismo frame\n\nSÍ hace bien:\n- Split screens y comparativas\n- Mecanismos internos estilizados\n- Composiciones simétricas\n\nSi el storyboard pide texto legible o multitud de caras, AVISA y propón alternativa.\n\n═══════════════════════════════════════════════════════════\nFORMATO DE SALIDA\n═══════════════════════════════════════════════════════════\n\nDevuélveme un bloque de código por cada escena del storyboard, en orden. Nada más. Sin títulos de escena, sin descripciones en español, sin notas. Solo los bloques de código con los prompts, uno detrás de otro.\n\nCada bloque de código con este formato:\n\n[STYLE LOCK]: [paste]\n[SUBJECT]: [English]\n[ACTION]: [English, present continuous]\n[ENVIRONMENT]: [English]\n[LIGHTING]: [English]\n[CAMERA]: [close-up / medium shot / wide shot / macro / top-down / low angle]\n[ASPECT]: 9:16 vertical\n[REFERENCE]: [si aplica: \"Use image from Scene X. Keep [what] identical. Change [what].\" Si no aplica: \"none\"]\n[EXCLUDE]: no text, no logos, no watermarks, no blurry artifacts, no extra limbs, no distorted faces\n\nAl final de todos los bloques, un aviso corto si hay problemas técnicos (texto en imagen o multitud de caras). Si no hay problemas, no escribas nada.\n\n═══════════════════════════════════════════════════════════\nAUTO-VERIFICACIÓN\n═══════════════════════════════════════════════════════════\n\n☐ ¿Todos los valores en inglés?\n☐ ¿Style lock es una sola frase corta?\n☐ ¿Cada prompt en su propio bloque de código, sin nada en medio?\n☐ ¿Una sola imagen por escena?\n☐ ¿La primera vez que aparece el personaje lo describo completo, y después solo lo que cambia con referencia a la escena anterior?\n☐ ¿Lo mismo para entornos que se repiten?\n\nSi algo falla, corrige antes de devolvérmelo."
          },
          {
            "t": "head",
            "v": "7. Auditoría completa FINAL",
            "x": "Es el **prompt 7**, la **auditoría final** antes de generar imágenes: eleva todo al nivel de **cortometraje animado de autor** (tipo Pixar, Laika, Aardman, Apple). Te devuelve un diagnóstico, un **guión definitivo + 2 variantes distintas**, el storyboard mejorado y todos los prompts de imagen auditados. Usalo como último control de calidad de toda la base."
          },
          {
            "t": "prompt",
            "v": "Stop. Antes de generar ninguna imagen en NanoBanana, vamos a hacer la auditoría final. Y esta vez no quiero que te quedes en \"mejorar\". Quiero que eleves el anuncio al nivel de un CORTOMETRAJE ANIMADO DE AUTOR. Lee bien esta primera parte porque define el nivel al que vamos a trabajar.\n\n═══════════════════════════════════════════════════════════\nEL NIVEL QUE ESTAMOS BUSCANDO — CINE ANIMADO DE VERDAD\n═══════════════════════════════════════════════════════════\n\nEsto NO es publicidad animada. Es un mini-cortometraje de 50 segundos que por casualidad vende un producto. El referente son los cortos de Pixar, Laika, Aardman y los ads cinematográficos tipo Apple.\n\nAntes de escribir nada, mete en tu cabeza lo que hacen estos cortos. Son tus referencias obligatorias:\n\nPIPER (Pixar, 2016) — Un pollito aprende del mar. 6 minutos. No hay palabras. Lo que enseña: primeros planos extremos con textura brutal. Emoción transmitida por ojos y movimiento, no por diálogo. La cámara es un personaje más.\n\nBAO (Pixar, 2018) — Una madre crea un dumpling que cobra vida. Lo que enseña: convertir un objeto cotidiano en un personaje emocional. Metáfora pura. El objeto TIENE ALMA y se gana el cariño del espectador en segundos.\n\nINSIDE OUT (Pixar, 2015) — Las emociones como personajes dentro de un mundo interno. Lo que enseña: lo abstracto se vuelve visitable. Un sentimiento es un lugar. Una idea es un edificio. Un problema es una criatura.\n\nLA LUNA (Pixar, 2011) — Un niño descubre que barre estrellas en la luna. Lo que enseña: mundos mágicos con reglas propias. Lo cotidiano se transforma en surreal sin previo aviso.\n\nPAPERMAN (Disney, 2012) — Un hombre persigue a una mujer con aviones de papel. Lo que enseña: metáfora visual sostenida durante todo el corto. Un solo símbolo lleva toda la emoción.\n\nCOIN OPERATED (Pixar SparkShorts) — Un niño guarda monedas toda su vida para un viaje espacial. Lo que enseña: narrativa sin palabras, emoción brutal en 5 minutos, personaje que envejece visualmente.\n\nKIWI! (Dony Permedi) — Un kiwi corta árboles en una montaña para simular volar cuando se tira. Lo que enseña: la última escena cambia TODO el significado del corto. El giro visual como moneda emocional.\n\nAPPLE \"UNDERDOGS\" y \"THE WHOLE WORKING FROM HOME THING\" — Lo que enseña: un anuncio largo puede ser un cortometraje con personajes que te importan. El producto aparece como parte de la vida, no como interrupción.\n\nAPPLE \"INTENTION\" (2022) — Apple + Pride. Lo que enseña: iluminación como narrativa. La luz cuenta la historia antes que los planos.\n\nCHIPOTLE \"BACK TO THE START\" — Un granjero y su granja industrializada. Stop-motion 2 minutos. Lo que enseña: el arco emocional completo de un cortometraje en 120 segundos. Problema, crisis, redención.\n\nPrincipios comunes a todos estos cortos:\n- La cámara se mueve con intención. No es un testigo, es un narrador.\n- Los objetos cotidianos se vuelven metáfora. Una lámpara es esperanza. Un sillón es nostalgia.\n- Los primeros planos son brutales, con textura, con imperfección humana.\n- Lo abstracto se materializa. Un pensamiento es un lugar. Un sentimiento es una criatura.\n- La luz cuenta la mitad de la historia.\n- Hay UN momento icónico. Una imagen que si la ves suelta, te dice qué es el corto.\n- El final cierra circularmente con el principio, pero transformado.\n\nSI LO QUE VAS A ENTREGAR NO CUMPLE ESTOS PRINCIPIOS, NO LO ENTREGUES. REESCRÍBELO.\n\n═══════════════════════════════════════════════════════════\nTU TAREA — DOS AUDITORÍAS Y UNA ENTREGA FINAL\n═══════════════════════════════════════════════════════════\n\nVas a hacer DOS auditorías (guión y visual) y entregar UN output definitivo. En este orden exacto.\n\n───────────────────────────────────────────────────────────\nAUDITORÍA 1 — GUIÓN\n───────────────────────────────────────────────────────────\n\nRe-lee el <<GUION>> completo de la conversación anterior. Pregúntate:\n- ¿El HOOK realmente para el scroll o es solo \"correcto\"?\n- ¿El dato duro es el más potente del research?\n- ¿El insight/reframe cambia la cabeza del cliente o solo repite lo que ya sabe?\n- ¿La frase puente al producto fluye o suena forzada?\n- ¿Los beneficios son concretos o son clichés?\n- ¿La bisagra reflexiva tiene peso real?\n- ¿El cierre deja algo al espectador?\n\nEntrega el resultado así:\n\n<<GUIÓN DEFINITIVO>>\nEl guión mejorado entero DENTRO de UN ÚNICO bloque de código (triple backtick). Todo el texto corrido, con los bloques [HOOK · 0-5s], [DEVELOPMENT · 5-18s], etc. visualmente separados por saltos de línea pero dentro del MISMO bloque de código, para copiarlo de un click.\n\n<<VARIANTE DE GUIÓN A>>\nUna alternativa COMPLETAMENTE DISTINTA del definitivo. Otro ángulo, otro tono, otra estructura. No una versión retocada. Un guión paralelo, en su propio bloque de código.\n\n<<VARIANTE DE GUIÓN B>>\nOtra alternativa también completamente distinta del definitivo y de la variante A. Tercer ángulo, tercera aproximación. En su propio bloque de código.\n\nEl usuario elegirá uno de los 3 para producir.\n\nDespués de los 3 bloques de código, añade una línea breve explicando en qué se diferencian: \"Definitivo apuesta por [X]. Variante A apuesta por [Y]. Variante B apuesta por [Z].\"\n\n───────────────────────────────────────────────────────────\nAUDITORÍA 2 — LO VISUAL (prompts y cortometraje global)\n───────────────────────────────────────────────────────────\n\nRe-lee las 3 variantes de storyboard y los prompts NanoBanana de la conversación anterior. Audítalo todo desde la mirada de un director de cortometraje Pixar.\n\nPreguntas críticas:\n- ¿Este anuncio abriría un corto de Pixar, o abriría un banner de Facebook?\n- ¿Hay alguna escena que si la sacara de contexto parecería un frame de Inside Out, Bao o Piper? ¿Cuántas?\n- ¿Hay escenas que son INFOGRAFÍA DISFRAZADA (dos almohadas aisladas, un modelo anatómico en fondo neutro, un gráfico con cifras)? Esto es el pecado capital. Marca todas.\n- ¿Hay UN momento icónico que justifique el anuncio entero? Si hay que pausar el vídeo en ese frame, ¿funciona como póster?\n- ¿La cámara se mueve con intención cinematográfica o es una cámara pasiva que registra?\n- ¿La iluminación cuenta historia o es solo \"luz bonita\"?\n- ¿Los objetos cotidianos se convierten en metáfora visual (el pillow tiene alma, el cuello es un paisaje), o todo es literal?\n- ¿Hay escenas que podrían ser CUALQUIER anuncio de cualquier producto? Eso es fallo.\n\nY crítico para tu técnica de producción one-shot:\n- ¿Cada par consecutivo de imágenes es visualmente encadenable? Si la imagen 3 es un dormitorio azul y la imagen 4 es un fondo blanco abstracto, el corte es imposible de animar. Identifica los saltos rotos.\n\nEntrega el resultado así:\n\n<<DIAGNÓSTICO VISUAL>>\nMáximo 10 líneas. Lista concreta: \"Escena X es infografía disfrazada. Propuesta: convertirla en [descripción cinematográfica]\". \"Entre escena Y y Z hay salto visual imposible. Propuesta: escena puente que [descripción]\". \"Falta momento icónico. Propuesta: escena [N] reformulada como [descripción tipo Pixar]\". Sin decorado.\n\n<<STORYBOARD DEFINITIVO>>\nReconstruye el storyboard desde cero con el nivel de los cortos referenciados arriba. Cada escena con el formato:\n\n───────────────────────────────\nESCENA [N]\n───────────────────────────────\n\nBLOQUE DEL GUIÓN: [HOOK / DEVELOPMENT / INSIGHT / PRODUCTO / BENEFICIOS / CIERRE]\nVOZ EN OFF QUE CUBRE: [fragmento exacto del guión]\nDURACIÓN: [4-6 segundos]\nTIPO DE ESCENA: [NARRATIVA / CONCEPTUAL]\n\nQUÉ PASA: descríbelo como si fuera un frame de Pixar. Qué hace la cámara, qué hace el personaje u objeto, qué cambia en la luz. Narrativo, cinematográfico.\n\nCÓMO SE SIENTE: qué emoción transmite esta escena.\n\nREFERENCIA MENTAL: menciona qué corto/escena del mundo real te inspira para esta escena (ejemplo: \"similar al primer plano del pollito en Piper cuando ve el mar por primera vez\", \"composición tipo Inside Out donde las emociones son personajes\", etc.).\n\nCONTINUIDAD ONE-SHOT: qué elemento visual de la escena anterior se mantiene al inicio de esta, y qué elemento de esta se traslada a la siguiente. Crítico para la técnica start/end encadenado.\n\n───────────────────────────────\n\nEscribe TODAS las escenas necesarias. No agrupar. No resumir.\n\n<<PROMPTS NANOBANANA DEFINITIVOS>>\nCada prompt en su propio bloque de código independiente. En inglés 100%. Formato:\n\n[STYLE LOCK]: [pega el style lock del estilo elegido]\n[SUBJECT]: [detalle visual específico, en inglés, cargado de textura cinematográfica]\n[ACTION]: [acción presente continuo con dinamismo, en inglés]\n[ENVIRONMENT]: [entorno con paleta de color precisa, en inglés]\n[LIGHTING]: [iluminación con intención narrativa, en inglés — no \"good lighting\", sino \"warm golden rim light from the window mimicking early morning melancholy\"]\n[CAMERA]: [tipo de plano y ángulo específicos, con movimiento si aplica]\n[ASPECT]: 9:16 vertical\n[REFERENCE]: [si aplica: \"Use image from Scene X. Keep [X] identical. Change [Y].\" Si no aplica: \"none\"]\n[EXCLUDE]: no text, no logos, no watermarks, no blurry artifacts, no extra limbs, no distorted faces\n\n═══════════════════════════════════════════════════════════\nREGLAS ANTI-ATAJO — OBLIGATORIAS\n═══════════════════════════════════════════════════════════\n\nPROHIBIDO:\n- \"(…continúan igual con mejoras consistentes…)\"\n- \"el resto se mantiene parecido\"\n- Agrupar 2 prompts en un bloque\n- Saltarte escenas o prompts\n- Frases decorativas al final tipo \"esto ya es un mini-cortometraje brutal\"\n\nSi te falta espacio: NO resumas. Entrega lo que puedas entero y escribe \"CONTINUAR EN SIGUIENTE MENSAJE: prompts del X al Y\". Cuando yo diga \"continúa\", me entregas el resto.\n\n═══════════════════════════════════════════════════════════\nAUTO-VERIFICACIÓN FINAL ANTES DE ENVIAR\n═══════════════════════════════════════════════════════════\n\n☐ ¿Entregué el guión definitivo en UN solo bloque de código?\n☐ ¿Entregué 2 variantes de guión completamente distintas entre sí, cada una en su bloque?\n☐ ¿Expliqué en qué se diferencia cada guión?\n☐ ¿Diagnóstico visual con máximo 10 líneas de problemas concretos?\n☐ ¿Storyboard reconstruido al nivel de los cortos referenciados?\n☐ ¿Cada escena del storyboard tiene una REFERENCIA MENTAL a un corto real?\n☐ ¿Cada escena tiene CONTINUIDAD ONE-SHOT explicada?\n☐ ¿TODOS los prompts NanoBanana entregados uno por uno?\n☐ ¿Cada prompt en su bloque de código, en inglés?\n☐ ¿Cada par consecutivo de prompts es visualmente encadenable?\n\nSi alguna casilla falla, CORRIGE antes de enviar.\n\n═══════════════════════════════════════════════════════════\nPRINCIPIO FINAL\n═══════════════════════════════════════════════════════════\n\nSi lo que vas a entregar parece \"un anuncio bien hecho\", para y reescríbelo. El objetivo es una pieza que un director de Pixar Sparkshorts aceptaría como primer pitch.\n\nNo me entregues un anuncio. Entrégame un cortometraje."
          },
          {
            "t": "head",
            "v": "8. Introducción al producto",
            "x": "Es el **prompt 8**, el que mete tu **producto real**: hasta acá se trabajó con un placeholder, y ahora le pasás solo el **nombre y la marca** en 2-3 frases. Con todo el contexto de la conversación (avatar, insights, ángulo, guión y storyboard ya auditados) te entrega la **versión final personalizada**: guión definitivo con variantes, estructura visual y prompts de imagen."
          },
          {
            "t": "prompt",
            "v": "Perfecto. Hasta ahora hemos trabajado con placeholder del producto. Te paso el producto REAL. Con la información mínima. El resto lo deduces tú a partir de toda la conversación anterior (avatar, insights, ángulo elegido, guión y storyboard auditados).\n\nPRODUCTO:\nNOMBRE: [Ej: Cloudy]\nQUÉ ES EN UNA FRASE: [Ej: Una almohada ergonómica de la marca Sleepy diseñada para mantener la columna alineada durante toda la noche]\n\nCon esto y TODO el contexto que ya tienes de nuestra conversación, entrégame AHORA la versión FINAL del anuncio personalizada con este producto. Cero genérico. Quiero la estructura completa del anuncio premium, pensada, afinada y mejorada. En este formato exacto:\n\n1) <<GUIÓN DEFINITIVO>>\nEl guión entero dentro de UN ÚNICO bloque de código, con el nombre del producto bien integrado, la frase puente al producto mencionando la marca de forma natural, y todos los beneficios alineados con lo que el producto realmente promete (deducido por ti desde el contexto previo).\n\n2) <<VARIANTE A>>\nUn guión alternativo completamente distinto en ángulo y tono. En su propio bloque de código.\n\n3) <<VARIANTE B>>\nOtro guión alternativo, distinto del definitivo y de la variante A. En su propio bloque de código.\n\nDespués de los 3 bloques, explica en 3 líneas en qué se diferencia cada uno.\n\n4) <<ESTRUCTURA DEL ANUNCIO PREMIUM>>\nLa estructura narrativa-visual final del anuncio para el guión definitivo. Escena por escena, qué pasa, qué siente el espectador, cómo encadena con la siguiente. Para que yo tenga clarísimo el mini-cortometraje antes de producir.\n\n5) <<PROMPTS NANOBANANA PRO FINALES>>\nCada prompt en su propio bloque de código independiente, en inglés. TODOS. Uno por uno. Sin atajos, sin \"el resto igual\", sin agrupar.\n\nEn cada prompt donde aparezca físicamente el producto, añade al final esta línea:\n[REFERENCE IMAGE]: insert real product photo here\n\nPorque yo adjuntaré la foto real del producto en NanoBanana al generar esas imágenes. Así NanoBanana usa la foto real en vez de inventarse el producto.\n\n═══════════════════════════════════════════════════════════\nREGLAS ANTI-ATAJO\n═══════════════════════════════════════════════════════════\n\n- Entrega TODOS los prompts enteros, uno a uno, sin resumir.\n- Prohibido \"(continúan igual con ajustes)\", \"aplicar misma lógica\", agrupar 2 en un bloque.\n- Si te falta espacio: escribe \"CONTINUAR EN SIGUIENTE MENSAJE\" y yo te digo \"continúa\".\n- Nada de frases decorativas al final tipo \"esto ya es un anuncio premium\".\n\n═══════════════════════════════════════════════════════════\n\nAUTO-VERIFICACIÓN ANTES DE ENVIAR:\n☐ ¿Integré el nombre del producto con naturalidad en el guión?\n☐ ¿Deduje la marca, tono, beneficios y diferenciales desde el contexto previo sin inventar?\n☐ ¿Las 3 versiones (definitivo + A + B) son genuinamente distintas?\n☐ ¿Los prompts NanoBanana donde aparece el producto físico tienen [REFERENCE IMAGE]?\n☐ ¿Entregué TODOS los prompts uno a uno, ninguno agrupado ni resumido?"
          },
          {
            "t": "head",
            "v": "Estilos y transiciones",
            "x": "No es un prompt sino el **título de sección** que separa la planificación de los recursos de video. Debajo agrupa los **prompts de transición** por estilo, que vas a usar más adelante para unir dos escenas de forma fluida."
          },
          {
            "t": "label",
            "v": "Realista Style",
            "x": "Prompt de **transición estilo realista / Apple**: lo pegás al generar el video para crear un pase **limpio y cinematográfico** entre dos tomas (entorno de estudio minimalista, luz suave, energía de keynote de Apple). Lleva efectos de sonido y **sin diálogo**."
          },
          {
            "t": "prompt",
            "v": "Seamless Apple-style cinematic transition. Minimal studio environment. Soft natural lighting. Clean, neutral tones. Ultra-clean. Minimal. Engineered. Apple keynote energy. Sound effects (no talking)"
          },
          {
            "t": "label",
            "v": "Sci-fi Style",
            "x": "Prompt de **transición estilo sci-fi**: genera un pase entre la primera y la segunda toma con estética de **animación de ciencia ficción** y efectos de sonido, sin diálogo. Lo usás cuando el anuncio va en ese estilo."
          },
          {
            "t": "prompt",
            "v": "Create a sci fi seamless transition between the first shot and the second shot in a sci fi animation style with sound effects (no talking)"
          },
          {
            "t": "label",
            "v": "Pixar Style",
            "x": "Prompt de **transición estilo Pixar**: crea el pase entre dos tomas en **animación tipo Pixar** con efectos de sonido y sin diálogo. Elegilo si tu anuncio está en ese estilo 3D."
          },
          {
            "t": "prompt",
            "v": "Create a seamless Pixar animated transition between the first shot and the second shot in a Pixar animation style with sound effects (no talking)"
          },
          {
            "t": "label",
            "v": "Claymation Style",
            "x": "Prompt de **transición estilo claymation** (stop-motion en plastilina): une dos tomas manteniendo ese look artesanal, con efectos de sonido y sin diálogo."
          },
          {
            "t": "prompt",
            "v": "create a seamless Claymation animated transition between the first shot and the second shot in a Claymation animation style with sound effects (no talking)"
          },
          {
            "t": "label",
            "v": "Wes Anderson Style",
            "x": "Prompt de **transición estilo Wes Anderson**: genera el pase cinematográfico entre el primer y el último frame con esa estética simétrica y de color pastel, con efectos de sonido y sin diálogo."
          },
          {
            "t": "prompt",
            "v": "**\nCreate a Wes Anderson style cinematic transition between the first frame and the end frame with sound effects (no talking)\n**"
          }
        ],
        "clases": [
          6
        ],
        "intro": "Este recurso es el **documento de Notion** con el sistema de **8 prompts en orden** para planificar un anuncio animado antes de tocar ninguna herramienta de video. La idea de fondo: el resultado depende un **80% de la planificación** (avatar, insights con datos, ángulo, guión, storyboard y prompts de imagen), así que acá se arma toda esa base y recién después generás el video. Todo vive en **una sola conversación de ChatGPT**, que va acumulando contexto: si algo no convence, iterás ahí mismo sin re-explicar nada. Al final del doc tenés además prompts sueltos de **transiciones** por estilo, para cuando pases a generar el video.\n\nCómo se usa, de arriba a abajo:\n\n- **Abrís un chat nuevo en ChatGPT** y lo vas a usar en todos los pasos.\n- **Vas copiando cada prompt en orden** (1 al 8) y pegás lo que te pide entre corchetes (producto, mercado, estilo, ángulo elegido…).\n- **En el medio saltás a NotebookLM** (gratis) para el research con datos duros, y volvés a ChatGPT con esos insights.\n- **Iterás siempre** — la IA casi nunca acierta a la primera; ese último **20%** de criterio humano (\"esto sí, esto no\") es lo que hace bueno al anuncio.\n- **Los prompts de transición** de abajo los usás más tarde, al armar el video, para unir dos escenas de forma fluida según el estilo."
      },
      {
        "slug": "catalogo-ads",
        "label": "Catálogo de ads (100+ ejemplos)",
        "tipo": "pdf",
        "cardDesc": "100+ anuncios de referencia, clasificados por tipo (testimonio, oferta, beneficios…).",
        "driveId": "1ObvSwYf_hdGXOJUz-alcjOp2E85BVEHW",
        "clases": [
          2
        ]
      },
      {
        "slug": "musica",
        "label": "Música y SFX",
        "tipo": "bank",
        "cardDesc": "Música por mood, efectos de sonido y voces (Epidemic, ElevenLabs).",
        "items": [
          {
            "label": "Música del curso (.zip)",
            "url": "https://drive.google.com/file/d/1HjoB20foZFLPXPsyXYGYDbr2DblAnZ4u/view"
          },
          {
            "label": "Epidemic Sound (música + SFX)",
            "url": "https://share.epidemicsound.com/r1xj4g"
          },
          {
            "label": "ElevenLabs (voces / voz en off)",
            "url": "https://try.elevenlabs.io/r0n3s2rz7t1h"
          }
        ],
        "clases": [
          3
        ]
      },
      {
        "slug": "herramientas",
        "label": "Herramientas",
        "tipo": "bank",
        "cardDesc": "Las plataformas base: rutas baratas de generación de imagen y video.",
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
        ],
        "clases": [
          6
        ]
      }
    ]
  },
  {
    "slug": "masteryhaus",
    "categoria": "Negocio digital de servicios",
    "cardDesc": "Construí un negocio de servicios escalable y rentable: mentalidad, nicho, oferta irresistible, precios y ventas de alto valor.",
    "eyebrow": "Formación · MasteryHaus",
    "titulo": "MasteryHaus",
    "subtitulo": "La Fórmula Mastery para convertir un negocio de servicios en algo repetible, predecible y con márgenes de 60%: nicho dorado, oferta irresistible, precios y un sistema de ventas de alto valor.",
    "volumen": "6 módulos + bonus",
    "clases": [
      {
        "n": 1,
        "vn": 1,
        "grupo": "Introducción a la Fórmula Mastery Haus",
        "modulo": 1,
        "titulo": "Alineando las expectativas",
        "cardDesc": "",
        "videoId": "1MO1xwf71DJNY-aXvHcM8GmLOD-9T5dXB",
        "resumen": "Esta clase es la **introducción y alineación de expectativas** del programa: antes de entrar a la parte técnica, Sofía te ordena la cabeza sobre con qué actitud tenés que encarar todo. Parte de un supuesto: si estás acá, ya tenés un **negocio de servicios en marcha**, con ventas, clientes y también problemas. La meta del programa es armar un negocio que **disminuya esos problemas** y sea **escalable y sostenible** en el tiempo.\n\nLa idea central que te pide que \"te tatúes\" es que **el tiempo en el mercado no equivale a solidez ni a experiencia**. Podés llevar años haciendo lo que hacés y aun así tener mucho por aprender sobre cómo desarrollar este tipo de negocios. Por eso insiste en entrar como **aprendiz humilde**: ella misma se define como especialista, no experta, y dice que sigue aprendiendo con mentores y masterminds. El enemigo a vencer es \"**eso que no sabemos que no sabemos**\"; sin actitud de aprendiz, nunca lo vas a descubrir.\n\nTambién te anticipa lo emocional: vas a sentir **emoción, miedo, incertidumbre e incomodidad** porque vas a tomar muchas decisiones y cambiar cosas del negocio. Para superarlo propone cuatro apoyos:\n\n- **Seguir los pasos del programa** — está armado para darte tranquilidad y avanzar con seguridad.\n- **Pasar a la acción** — accionar genera motivación, no al revés.\n- **Apoyarte en el equipo y la comunidad** — usá las consultas y las personas alrededor.\n- **Avanzar en el contenido** — mirá los videos, hacé los ejercicios y asistí a las llamadas cada semana.\n\nCierra con la fórmula del éxito: depende **50% de ver el contenido y 50% de accionar** con lo que ves. Las llamadas tienen fechas fijas (mail + plataforma) y el tiempo pasa rápido, así que sostené las dos partes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-introduccion"
        ],
        "herramientas": []
      },
      {
        "n": 2,
        "vn": 2,
        "grupo": "Introducción a la Fórmula Mastery Haus",
        "modulo": 1,
        "titulo": "La Fórmula Mastery",
        "cardDesc": "",
        "videoId": "1zubxmdKCrriSF_jDdXmuP9d2b91c77TN",
        "resumen": "Esta clase presenta la **Fórmula Mastery**, el marco base del programa para construir un **negocio digital de servicios** sólido y escalable. Sofía arranca mostrándote que todo el camino por el que llegaste (anuncio, podcast, YouTube, Instagram, TikTok o newsletter → clic → página con video → llamada → venta) estaba meticulosamente diseñado, y que vas a aprender a replicar esas mismas estrategias en tu propio negocio.\n\nPrimero explica por qué elegir servicios digitales: son los negocios más simples de escalar dentro de lo complejo que es emprender. Sus ventajas:\n\n- **Ganancia unitaria alta** — podés armar escaleras de productos y llevar a un cliente de pagar **$50** a **$20.000**.\n- **Baja inversión de ingreso** — no necesitás logística, stock ni espacio físico, y alcanza con un equipo reducido para el fulfillment.\n- **Márgenes altos** — su negocio tiene más de **60%** de ganancia marginal.\n\nEl objetivo es pasar de un negocio impredecible (un **electrocardiograma** que sube y baja, con picos y valles) a uno estable y previsible. ¿Cómo? Con **un nicho único** y **una sola oferta**: enfocarte donde hay más valor en vez de dispersarte en varios clientes u ofertas.\n\nEl corazón de la clase es dividir el negocio en tres partes, con la analogía de la **Coca-Cola**:\n\n- **Fórmula** — nicho, oferta y precio. Es la receta secreta; si la fórmula es horrible, no te compra nadie por más buenos procesos que tengas.\n- **Procesos** — la fábrica: atraer, captar (leads a clientes), cerrar y generar resultados de forma repetible.\n- **Optimización** — ajustar todas las decisiones (mercado, precios, contrataciones, anuncios) para sostener márgenes mínimos de **60%**.\n\nLa idea final: con una sola oferta y un solo nicho podés construir un negocio millonario de **siete cifras**. Sobre estas bases se construye todo el resto del programa.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-introduccion"
        ],
        "herramientas": []
      },
      {
        "n": 3,
        "vn": 3,
        "grupo": "Introducción a la Fórmula Mastery Haus",
        "modulo": 1,
        "titulo": "Cultura Mastery",
        "cardDesc": "",
        "videoId": "1PPoXzQxklRXc-u5cJ1dB25CtznvsYNwI",
        "resumen": "Esta clase es una parada previa al contenido técnico del programa: antes de entrar en la fórmula, **Sofía Contreras** te presenta la **cultura Mastery**, el conjunto de principios con los que ella y su equipo encaran los negocios y la vida, y que espera que incorpores si sos parte de la comunidad. El argumento de fondo es que esta cultura es lo que sostiene los resultados que después vas a querer escalar.\n\nLos puntos concretos que enseña son:\n\n- **No existe el fracaso** — todo lo tomás como una oportunidad de aprender y mejorar, y volcás ese aprendizaje en las siguientes decisiones. Si etiquetás todo como fracaso, cuesta avanzar.\n- **Foco en accionar y avanzar** — poner la energía en la acción por sobre los resultados: definís cuál es el próximo paso y vas hacia adelante.\n- **Responsabilidad** — te hacés cargo de todo lo que tenés al frente; no culpás al contexto ni a otras personas. Primero chequeás qué está pasando con vos y eso lo llevás a tus próximas decisiones.\n- **Ser 100% directo** — de Sofía y su equipo vas a recibir feedback directo, honesto y constructivo, que te saca de la zona de confort y te empuja a accionar.\n- **No quejarse ni poner excusas** — ante lo que pase alrededor, no gastás tiempo justificando; tomás el feedback y lo volcás a la acción para solucionar lo que hay adelante.\n- **Hacer lo que hay que hacer** — cuando hay que hacerlo. Sofía menciona que a sus **35 años** logró mucho justamente por operar así.\n- **Atravesar lo difícil** — las situaciones difíciles, personales o de negocio, aparecen todo el tiempo; la clave es atravesarlas, porque eso es lo que lleva al éxito.\n\nCierra pidiéndote que repases estos puntos, identifiques cuáles todavía no tenés incorporados y empieces a ejercitarlos en el día a día, porque ser parte de Mastery Haus es también ser parte de esta cultura.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-introduccion"
        ],
        "herramientas": []
      },
      {
        "n": 4,
        "vn": 4,
        "grupo": "Introducción a la Fórmula Mastery Haus",
        "modulo": 1,
        "titulo": "La Fórmula del Fracaso",
        "cardDesc": "",
        "videoId": "1ppLP_1BHvD6bYz8vNlu98eblgdluFonS",
        "resumen": "Esta clase, **\"La Fórmula del Fracaso\"**, invierte la lógica habitual: en vez de darte los pasos para tener éxito, Sofía te muestra los comportamientos que garantizan que fracases —con el programa y con tu negocio— para que los detectes y los evites. La idea de fondo es que ingreses como un **humilde aprendiz**: si pensás que ya sabés todo, no queda lugar para aprender.\n\nLos \"ingredientes\" del fracaso que enumera son:\n\n- **Creer que sabés todo** — cerrás la puerta al aprendizaje y a lograr resultados reales.\n- **Preguntar sin haber visto el contenido** ni hecho los ejercicios — el contenido ya trae las respuestas; primero accioná y después traé una **pregunta robusta**, basada en algo que ya probaste, para que puedan darte perspectiva. Sobre la nada es imposible avanzar.\n- **Faltar a las sesiones uno a uno** — están para que las aproveches y te ayuden a avanzar.\n- **Comportarte como tu peor cliente** — pensá en el peor cliente que tuviste; si te comportás así, seguís atrayendo ese tipo de cliente. Buscá ser tu mejor versión de cliente para atraer a los clientes que querés.\n- **No buscar ayuda cuando la necesitás** — el programa está armado para ayudarte; apoyate en el equipo y en la comunidad.\n- **No aprovechar ni aportar a la comunidad** — el valor que das lo recibís de vuelta; es retroalimentación real, algo que ella vivió en los másterminds y programas de los que es parte.\n- **Culpar a todo lo que te rodea** en vez de a vos mismo cuando no estás accionando.\n- **Hablar en vez de hacer** — al contar lo que vas a lograr, tu cerebro libera **dopamina** como si ya lo hubieras conseguido (más todavía si se lo contás a alguien que se emociona), y eso te desactiva.\n\nEl cierre: bajá el hablar, subí el hacer, que tus acciones demuestren tus resultados. No te pongas ese \"traje del fracaso\"; avanzá como tu mejor cliente y tu mejor versión.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-introduccion"
        ],
        "herramientas": []
      },
      {
        "n": 5,
        "vn": 5,
        "grupo": "Introducción a la Fórmula Mastery Haus",
        "modulo": 1,
        "titulo": "Invertir la Ecuación Típica",
        "cardDesc": "",
        "videoId": "1yqjL7SKHi1Ysc5XzYek3_XL0Jp-g903e",
        "resumen": "Esta clase abre el trabajo práctico con una idea madre: **invertir la ecuación típica** de cómo creés que funciona un negocio y, sobre todo, cómo cobrás. La tesis es que para potenciar tu negocio necesitás **caja**, y la forma de conseguirla no es empezar barato para muchos.\n\nEl ejemplo central es **Tesla**. Elon Musk no tenía el financiamiento que su sueño requería, así que arrancó al revés de lo esperable:\n\n- **Primer auto** — un deportivo de **ticket alto**, con lista de espera; vendieron unas **2500 unidades**.\n- **Segundo modelo** — con esa plata desarrollaron una versión de **ticket medio** (dos versiones), para un mercado más grande.\n- **Tercer modelo** — con esa caja llegaron al **ticket bajo** que le habla a la mayoría.\n\nLa moraleja: la caja del ticket alto financia la expansión. La instructora cuenta que ella hizo el camino opuesto (masivo y barato); no sufrió flujo de caja porque tenía **volumen** y **recompra**, pero pudo haber escalado mucho más rápido.\n\nHay **dos formas de crecer**: por volumen de clientes, o aumentando el **valor de cada cliente** (por cuánto gastan y por cuántas veces te compran). La clave es vender por **valor, no por precio**: si vendés por precio te volvés **commodity**, no te diferenciás, las conversiones salen más caras, el **fulfillment** (entrega) te demanda más y atraés a los peores clientes (pagan poco, exigen mucho).\n\nLa solución es la **fórmula BILD**: diferenciarte con un **servicio único e incomparable**, imposible de comparar por precio, apuntando al **valor supremo** y eligiendo con qué clientes trabajás. Al aplicarla, ella pasó de facturar **$30.000 a $130.000 por mes**, bajó de **150 a 20 clientes** y ganó placer en el día a día. Primero construís una base sólida de caja; recién después aplicás la pirámide tipo Tesla para expandirte.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-introduccion"
        ],
        "herramientas": []
      },
      {
        "n": 6,
        "vn": 1,
        "grupo": "Mentalidad & Foco · Mentalidad",
        "modulo": 2,
        "titulo": "Configuración mental",
        "cardDesc": "",
        "videoId": "1Sr_io2U1zBpXQyncmK9s1a4vvNKPQyq0",
        "resumen": "Esta clase abre el módulo de **mentalidad** y explica por qué Sofía arranca todos sus programas por acá: **la mente no es delegable**. Podés delegar cualquier parte técnica del negocio, pero tu cabeza como líder no se la pasás a nadie, y esa cabeza influye siempre en las decisiones, incluso cuando después trabajes en sacarte de la ecuación para que el negocio funcione sin vos.\n\nSofía lo cuenta con su propio caso: desde el primer día su primer programa de negocios ya valía **mucho más de lo que lo cobraba**, pero no le subió el precio. ¿Por qué? Porque creía que no lo valía, que era demasiado caro para la gente del otro lado. Era pura mentalidad bloqueándola. La idea central: cuando **desbloqueás tu mente, desbloqueás los resultados** que tenés hacia adelante.\n\nEl diagnóstico que plantea es que vamos por la vida en **piloto automático**, sin frenar a hacernos preguntas ni a mirar cómo estamos. Estamos inmersos en una sociedad, una familia y un entorno que nos moldean y nos dicen cómo tiene que ser la vida, el éxito y todo lo de alrededor. Su propuesta con nombre propio es romper con esa **configuración por defecto** (o \"de fábrica\"), igual que cuando comprás un teléfono nuevo y lo primero que hacés es configurarlo a tu medida. La pregunta guía es: cómo configurarte a vos mismo acorde a lo que necesitás en este momento de tu vida.\n\nPara lograrlo, cierra con dos referencias:\n\n- **Marco Aurelio** — \"la calidad de nuestros pensamientos es la calidad de nuestra vida\".\n- **Tony Robbins** — la calidad de tu vida es un reflejo directo de la **calidad de tus preguntas**.\n\nDe ahí el gancho hacia el resto del módulo: la herramienta para reconfigurarte es empezar a **hacerte las preguntas correctas**, que es justo lo que van a trabajar a continuación.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-mentalidad"
        ],
        "herramientas": []
      },
      {
        "n": 7,
        "vn": 2,
        "grupo": "Mentalidad & Foco · Mentalidad",
        "modulo": 2,
        "titulo": "¿Qué es el éxito para mí?",
        "cardDesc": "",
        "videoId": "1pH4ASB3C1mJBFt7LNAXslJpgvdU1tB6j",
        "resumen": "Esta clase abre el módulo de **Mentalidad** con una pregunta que Sofía considera fundamental para la vida y para el negocio: **¿qué es el éxito para mí?** El punto de partida es que casi todos transitamos con una **idea socialmente aceptada del éxito** —que pasa por el dinero, las posesiones, cierto tipo de familia y de estabilidad—, una \"bajada social\" que perseguimos incluso sin haberla elegido. El problema es que corremos detrás de una vara ajena y, la alcancemos o no, no nos sentimos bien con nosotros mismos.\n\nLa propuesta central es **cotejar tus propias expectativas** sobre vos y tu negocio, en lugar de las prestadas, y para eso **definir tu propia versión de éxito**. El ejercicio concreto que enseña es imaginar tu **día ideal** y tu **vida ideal** con preguntas simples: ¿dónde vivís?, ¿con quién?, ¿qué hacés?, ¿cómo es tu equipo y tu negocio?, ¿cuántas veces te vas de vacaciones?, ¿cómo es un día promedio desde que te despertás hasta que te acostás, con trabajo, familia y tus actividades preferidas incluidos.\n\nSobre la logística del programa, aclara que vas a tener **dos cuadernos de ejercicios** y **sistemas y plantillas** atados a cada video, organizados por módulo: los de mentalidad viven en el módulo mentalidad, los de nicho en el de nicho, y así. Ahí están los pasos detallados para definir tu versión de éxito.\n\nComo ejemplo, Sofía cuenta que este ejercicio le **cambió rotundamente la vida**: la primera vez lo hizo trabajando en relación de dependencia, sintiéndose atrapada (\"esto no puede ser la vida\"), y a partir de proyectar la vida que quería empezó a construir el camino hacia adelante. Cierra con una recomendación práctica: es un ejercicio para **repetir todos los años**, para volver a identificar qué es el éxito para vos en ese año puntual.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-mentalidad"
        ],
        "herramientas": []
      },
      {
        "n": 8,
        "vn": 3,
        "grupo": "Mentalidad & Foco · Mentalidad",
        "modulo": 2,
        "titulo": "¿Por qué estoy aquí?",
        "cardDesc": "",
        "videoId": "1PqAHHPgu6tfZ1nKyEdlqSV-gU5w54yoS",
        "resumen": "Esta clase va sobre encontrar tu **propósito** y tu **porqué** como el motor que sostiene tu negocio en el tiempo. Sofía arranca con una advertencia: muchas veces transitamos la vida en **piloto automático**, sin frenar a hacernos la pregunta más importante, \"¿por qué estoy acá, por qué estoy haciendo esto?\". Cuando vas por la vida sin un rumbo definido, es como andar con la **brújula rota** — no tenés un porqué que te guíe, o tu porqué está roto.\n\nLa idea central es que definir por qué hacés lo que hacés es una de las cosas más importantes para liderar tu negocio y que efectivamente dé resultado. Te propone hacerte varias preguntas concretas:\n\n- **Por qué desarrollás este negocio** — qué te movió a armarlo.\n- **Por qué lo querés cambiar ahora** — qué necesitás que cambie en este momento.\n- **Cómo necesitás cambiar vos** para lograr eso que te estás proponiendo.\n\nEl **ejercicio** que te deja es identificar tu propósito. Reconoce que si le preguntás a alguien \"¿cuál es tu propósito?\", lo más probable es que te diga \"no sé\". Por eso propone una forma simple de llegar a él: entender tu **porqué**, o sea por qué hacés lo que hacés.\n\nLo ilustra con su propio caso: tiene negocios vinculados a la **educación** y a la **comunicación** porque le gusta educar, impactar en la vida de las personas y simplificárselas. Le pega fuerte la idea de que tenemos **una sola vida** y se termina, y ver gente que no la vive como quiere; alrededor de eso arma su negocio. Te invita a volcar eso que a vos te mueve tanto dentro de tu propio negocio, para que impacte también en la vida de los demás.\n\nEl cierre es claro: si tu porqué no está claro, va a ser muy difícil sostener el negocio mucho tiempo. El porqué es lo que te ayuda a superar los momentos difíciles y atravesar los problemas. En los ejercicios te deja todos los pasos para identificar el tuyo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-mentalidad"
        ],
        "herramientas": []
      },
      {
        "n": 9,
        "vn": 4,
        "grupo": "Mentalidad & Foco · Mentalidad",
        "modulo": 2,
        "titulo": "¿Qué cuento me cuento?",
        "cardDesc": "",
        "videoId": "1GbPczf-i739l3eRbenyEnzcqzwCUWsxu",
        "resumen": "Esta clase abre el módulo de **Mentalidad & Foco** con una idea central: **las palabras crean realidad** y el cuento que te contás a vos mismo condiciona tus resultados. Sofía arranca con un **juego de imaginación guiada**: te pide cerrar los ojos, ponerte auriculares y visualizar un **limón** sobre la mesa de tu cocina, olerlo, cortarlo, morder una rodaja y sentir el jugo en la boca. El efecto es físico: a cerca del **90% de las personas** que hacen bien el ejercicio se les hace agua la boca. La conclusión es que, solo con palabras, el cerebro desencadenó una reacción real en el cuerpo.\n\nA partir de ahí explica el mecanismo con la metáfora del **iceberg**. Lo único que vemos en el día a día es la **punta visible**: nuestro rendimiento y comportamiento (los resultados). Pero debajo hay una cadena:\n\n- **Pensamientos** — configuran cómo nos sentimos.\n- **Emociones** — determinan cómo actuamos.\n- **Comportamiento / acciones** — producen los resultados que sí vemos.\n\nDe ahí la ecuación: si cambiás cómo pensás, cambian tus resultados, pero eso exige un **esfuerzo específico de trabajar sobre la mente**. Cita que **cambiar los pensamientos modifica la estructura y la función de las neuronas**, y aclara que no lo dice solo ella sino la ciencia.\n\nDespués baja a lo práctico: identificar los **\"cuentos\" que te contás todos los días** — frases como \"esto no me sale\", \"esta persona es mejor que yo\", \"soy difícil\", \"no puedo\". Da su propio ejemplo: cuando se decía \"no voy a poner este precio porque el contexto A, B, C y D es así\", ese precio efectivamente no lo ponía. La **conversación interna** que tenés con vos mismo impacta directamente en lo que lográs. Aclara que no se trata de tirar afirmaciones positivas frente al espejo, sino de **identificar cómo funciona esa conversación y empezar a cambiar la ecuación**. Cierra anunciando un ejercicio para detectar esos cuentos y reprogramar la mente hacia lo que te proponés.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-mentalidad"
        ],
        "herramientas": []
      },
      {
        "n": 10,
        "vn": 5,
        "grupo": "Mentalidad & Foco · Mentalidad",
        "modulo": 2,
        "titulo": "¿Qué persona quiero ser?",
        "cardDesc": "",
        "videoId": "1qx7sbhVkBgwrbgucuRWbDVwW1QDiH8tS",
        "resumen": "Esta clase, del módulo de **Mentalidad & Foco**, arranca con una premisa: la personalidad **no está fija**. Sofía sostiene que no es real eso de \"soy como soy y no puedo cambiar\"; vos podés construir la persona que querés ser y trabajar para que pase. La herramienta que enseña son los **principios rectores**: frases que definís a lo largo de la vida y a las que volvés cada vez que tenés que tomar una decisión o decidir cómo actuar, para que esa decisión sea simple y estés alineado con lo que querés.\n\nComparte los suyos, con la historia de dónde salió cada uno:\n\n- **\"Sé tan buena que ya no tengas que presentarte\"** — nació en su carrera de *venture capital* (inversiones en startups); quería entrar a una sala y que ya supieran quién era. La empujó a buscar siempre la excelencia y superar sus propios objetivos.\n- **\"Sé tan buena que no puedan ignorarte\"** — surgió del pánico a que la despidieran en su primer trabajo; apunta a que tu trabajo sea tan bueno que no haya forma de ignorarlo, sin importar a quién pongan al lado tuyo.\n- **\"¿Qué tipo de persona te gustaría conocer?\"** — pensá en la pareja o el referente que admirarías, y trasladá lo bueno de esa persona a tu accionar diario.\n- **\"Sé bueno\"** — la toma de **Google**; dejá a las personas mejor que como las encontraste. Por eso, dice, sus programas tienen políticas de satisfacción por encima de las de cualquier lado.\n- **\"Buscar un bien mayor\"** — fundó una **ONG a los 23 años**; le importa que lo que hace impacte en la gente, no emprender en algo con impacto negativo.\n- **\"El tiempo es lo más importante que tenemos\"** — de ahí no llegar tarde nunca (es faltar el respeto al tiempo del otro) y hacer contenidos cortos y pragmáticos.\n\nEl cierre: definí tus propias frases para ser **constante y consistente** con vos mismo a lo largo del tiempo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-mentalidad"
        ],
        "herramientas": []
      },
      {
        "n": 11,
        "vn": 6,
        "grupo": "Mentalidad & Foco · Mentalidad",
        "modulo": 2,
        "titulo": "¿A qué le tengo miedo?",
        "cardDesc": "",
        "videoId": "1wsirXmBtYchb7_48K5wB0ShUqT2JBj5k",
        "resumen": "Esta clase te deja un **ejercicio para destrabarte** cada vez que algo te da miedo o incertidumbre a la hora de ejecutar en tu negocio. La premisa: **las cosas no cambian por sí mismas**, nosotros tenemos que hacer que cambien, y para eso hay que superar los miedos. Sofía aclara que el miedo es normal, nos pasa a todos, sobre todo con algo que nunca hiciste antes o que estás validando.\n\nEl ejercicio central se llama **\"Define tus miedos\"** y tiene tres partes. Arrancás identificando **qué querés lograr** (el ejemplo que usa es *aumentar el ticket de tu servicio*) y lo trabajás así:\n\n- **Lo peor que puede pasar** — si subís el precio, no te compra nadie, te quedás sin clientes, el negocio se muere.\n- **Cómo prevenirlo** — optimizar la propuesta de valor para que la magnitud del impacto no sea tan grande.\n- **Cómo repararlo** — si sucede lo peor, volvés a un valor intermedio (no al precio viejo), y si todavía hay fricción, bajás un poco más.\n\nHacer esto te baja el miedo y la ansiedad porque ya definiste qué puede pasar y qué vas a hacer si pasa.\n\nEl **segundo paso** es listar los **beneficios de accionar**: mayores ingresos, menos y mejores clientes, un equipo motivado por el nuevo desafío y tranquilidad por el crecimiento.\n\nEl **tercer paso** es medir el **costo de la inacción** a **seis meses, un año y tres años**. A seis meses no cambió nada y el negocio se estanca; al año se cierra. De ahí la frase clave: **si el negocio no crece, está muriendo**.\n\nEl cierre es una instrucción práctica: volvé a este ejercicio cada vez que tengas miedo o incertidumbre de accionar. El documento de trabajo trae el contenido específico para profundizarlo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-mentalidad"
        ],
        "herramientas": []
      },
      {
        "n": 12,
        "vn": 1,
        "grupo": "Mentalidad & Foco · Energía & Foco",
        "modulo": 2,
        "titulo": "Lo que diferencia a los líderes exitosos",
        "cardDesc": "",
        "videoId": "14qtCPAG_OHz-5ZwmIkr1GxV7VK8A2Ud4",
        "resumen": "Esta clase arranca con una observación de **Sofía** sobre los líderes que fue conociendo a lo largo de su carrera: personas que dirigen negocios enormes —de miles o de apenas un puñado de personas— y que consiguen **resultados** tremendos, pero que además **viven vidas equilibradas**, o sea, hacen lo que quieren, cuando lo quieren, en el momento que lo quieren. La pregunta que abre todo es qué diferencia a los que logran lo que se proponen de los que se quedan en el camino.\n\nLa respuesta es una sola: **cómo gestionan su energía**. No es talento ni suerte, es gestión de energía.\n\nPara explicarlo usa una imagen concreta:\n\n- **La energía como un círculo** — si la repartís en muchas direcciones a la vez, ponés un poquito en cada acción y **disminuís el impacto** de cada una.\n- **La energía como un láser** — los que logran todo concentran su energía enfocada en pocas cosas, y ahí está la diferencia real de resultados.\n\nSofía insiste en que este mensaje lo repite siempre y no va a dejar de repetirlo, porque cómo gestionás tu energía no solo impacta en los **resultados** y en la calidad de tu **negocio**, sino en la **calidad de tu vida**.\n\nLa idea que resume la clase es que **todo se reduce a dos cosas: prioridades y energía**. Todo tu día, todo, se juega en cómo la gestionás, cómo la cuidás y cómo la asignás.\n\nSobre el cierre adelanta el marco de trabajo: hay **tres movimientos** con la energía —**generarla, cuidarla y asignarla**— y anticipa que en lo que sigue va a desglosar cada uno y dejar **tips concretos** para empezar a implementar en el día a día. Esta clase, entonces, funciona como el encuadre: instala el principio (energía enfocada como láser) antes de bajar a la práctica.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-energia"
        ],
        "herramientas": []
      },
      {
        "n": 13,
        "vn": 2,
        "grupo": "Mentalidad & Foco · Energía & Foco",
        "modulo": 2,
        "titulo": "¿Cómo genero energía?",
        "cardDesc": "",
        "videoId": "1f4FtBP4I1Zw7wVz0H1BYMM5KBsUKKvyM",
        "resumen": "Esta clase va de **cómo generás y cuidás tu energía** para poder sostener el liderazgo de un negocio en el tiempo. Sofía arranca desmontando un mito: se suele asociar a la gente exitosa con personas **extrovertidas**, sociables, que lideran grandes grupos. Ella dice que esa idea está equivocada: hay muchísimos líderes y personas muy exitosas que son **introvertidas**. La diferencia real no es la timidez, sino **cómo recargás energía**: el introvertido la recarga estando solo o con un grupo chico de confianza; el extrovertido, estando con grupos grandes.\n\nLa idea central es que, si sabés qué tipo de personalidad tenés, sabés cómo cargás energía y podés **diseñar tus días** con eso. Ella se pone de ejemplo: como es introvertida, sabe que un día que da una conferencia rodeada de mucha gente su energía va a bajar, así que ese día se propone menos tareas y las reasigna a otros momentos, para no sobresaturarse. Resultados más sostenibles = los seguís haciendo en el tiempo.\n\nDespués da hábitos concretos para generar energía:\n\n- **Despertador (que vibre)** — comprá uno y sacá el celular del cuarto, para no arrancar la mañana con un pico de dopamina que te consume energía.\n- **Dormir en completa oscuridad** — lo más parecido a una cueva, para descansar de verdad.\n- **Tiempo de calidad con tu tribu** — con las personas cercanas que te suman, idealmente en espacios naturales/verdes. Cita investigaciones a gente al final de su vida: lo fundamental era el tiempo con las personas que querían.\n- **Rodearte de gente que ya está donde vos querés estar** — tu cerebro lo naturaliza, lo ve posible y te recarga hacia ese propósito.\n- **Mover el cuerpo** — no gimnasio, sino que tu índice de movimiento supere al de sedentarismo: caminá, subí escaleras, usá bici.\n- **Alimentarte, no solo comer** — la comida es salud y medicina; comer mal sepulta tus niveles de energía y tu salud.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-energia"
        ],
        "herramientas": []
      },
      {
        "n": 14,
        "vn": 3,
        "grupo": "Mentalidad & Foco · Energía & Foco",
        "modulo": 2,
        "titulo": "¿Cómo cuido mi energía?",
        "cardDesc": "",
        "videoId": "1W4MNgMeeMtt4OuabTc42zX6Cn1XvF7zm",
        "resumen": "Esta clase arranca de una premisa dura: **cuidar tu energía** es una de las acciones más importantes que tenés como líder de tu negocio, porque sin energía no podés liderar, decidir ni accionar. Sofía te da cuatro palancas concretas para protegerla.\n\n- **Decir que no** — el primer paso. Identificás todo lo que no está alineado con la vida y el negocio que te propusiste, y lo cancelás. \"Decir que no es lo que separa a las personas exitosas de las realmente exitosas.\" Cuesta porque creemos que perdemos oportunidades, pero solo funciona si primero ponés el **foco láser** en lo importante.\n- **Evitar las noticias** — están diseñadas científicamente para engancharte, porque el cerebro humano presta atención a lo negativo. Eso te configura la mente en negativo y desparrama tu energía. Borralas del celular, redes y TV: si pasa algo muy importante, \"como una cuarentena mundial\", te vas a enterar igual.\n- **Ponerte la máscara de oxígeno primero** — si vos no estás bien, no vas a poder estar bien con tu equipo, tu entorno ni tu negocio. Empieza ya, sin esperar una crisis: decir que no, sacar noticias, buena alimentación, poner el cuerpo en movimiento.\n- **Sacar las notificaciones del celular** — te roba el foco y la energía. Dejá solo la llamada activada y avisale a tu círculo cercano. Sin excusas, porque la **cultura de Mastery** es no dar excusas; te deja los ejercicios con las excusas típicas y sus respuestas.\n\nCierra con el **no multitasking**: el cerebro no soporta dos tareas complejas a la vez (sí cosas simples, tipo mascar chicle y cruzar la calle), y forzarlo genera errores. Una acción por vez. Como ejemplo, cuando armaban la estructura troncal de sus programas trabajaban con el teléfono en **modo avión**, una sola pantalla al frente y foco en terminar y entregar, \"porque hacemos lo que decimos que íbamos a hacer\".",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-energia"
        ],
        "herramientas": []
      },
      {
        "n": 15,
        "vn": 4,
        "grupo": "Mentalidad & Foco · Energía & Foco",
        "modulo": 2,
        "titulo": "¿Cómo asigno mi energía?",
        "cardDesc": "",
        "videoId": "1MxyaxZ2BBd346kyZxgAmnM0fsoNbc9Qw",
        "resumen": "Esta clase va sobre **cómo asignás tu energía** a lo largo del día para producir mejor. Sofía arranca rompiendo un mito: la idea de que **\"la hora del éxito es la mañana\"** (al que madruga dios lo ayuda) es una bajada social, no una verdad. El horario del éxito es el que va acorde a **tu biología y tu contexto de vida**.\n\nLa clave es identificar tu **cronotipo**, la manera en que tu cuerpo libera **melatonina** (la hormona del sueño). En la época de las cavernas se desarrollaron distintos ritmos para que, mientras unos dormían, otros vigilaran a la tribu, con una brecha de unas **4 horas** que reducía el peligro. Hoy existen tres tipos:\n\n- **Matutino** — se despierta temprano ya con energía y de buen humor.\n- **Intermedio** — un punto medio.\n- **Vespertino/nocturno** — recién siente sueño a las 2 o 3 a.m. Es el caso de ella: sus picos son a las **11 a.m.** y entre las **6 y 8 p.m.**, por eso no agenda reuniones antes de las 11.\n\nAclara que el cronotipo cambia con la edad, pero **no** porque vos fuerces tus horarios: madrugar 10 años no te vuelve matutino.\n\nDespués da herramientas concretas para asignar energía:\n\n- **Calendarizá todo** — lo importante tiene que tener lugar en tu calendario futuro; \"si no está ahí, no sucede\". El calendario crea futuro.\n- **Regla de los 2 minutos** — no negocies con tu cerebro; poné el esfuerzo en los primeros 2 minutos de la acción. Y si algo lo hacés en **5 minutos**, hacelo ya (los módulos duran eso).\n- **Prioridad estrella** — cada día definí una sola cosa importante, reducila a algo chico y ejecutable; si la cerrás, el día está ganado. Sirve contra la procrastinación.\n- **Detox de dopamina** — durante **2 días** cortá con redes, likes, números de crecimiento, series, chocolate y placeres inmediatos para recuperar foco en lo difícil.\n\nCierra invitándote a hacer los ejercicios para identificar tu cronotipo y destrabar.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-mentalidad-mastery",
          "mh-ejercicios-de-energia"
        ],
        "herramientas": []
      },
      {
        "n": 16,
        "vn": 1,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Configurando tu Temporada de No",
        "cardDesc": "",
        "videoId": "1D1wRsCbfszAHQ-USuQQZKdpAbhu6gLRY",
        "resumen": "Esta clase, dentro del módulo **Nicho Dorado**, te propone configurar tu **temporada de no**: los meses que tenés por delante donde el foco tiene que estar puesto solo en lo importante, que es transitar el programa y accionar sobre tu negocio. Sofía arranca con la idea de que **ser emprendedor** es \"vivir unos pocos años como nadie quiere para disfrutar el resto de tu vida como nadie puede\", y aclara que esos meses van a demandar esfuerzo, foco y muchísima acción, porque solo sobre la acción podés ver si tus hipótesis funcionan y tomar decisiones.\n\nEl ejercicio central es armar tu **to-don't** (tu lista de \"no hacer\"): todo lo que no es prioritario ahora. Cada vez que decís que sí a algo desalineado, te roba tiempo y energía. El ejemplo que da es el del **café** que te pide alguien para resolver un problema que no tiene que ver con vos: no es una hora, son mínimo **4 horas** sumando el seguimiento posterior, y en compuesto perdés foco. Cosas a las que decir que no:\n\n- **Juntarte a resolver problemas ajenos** — que no tocan tu negocio ni tu familia.\n- **Desafíos pequeños delegables** — tareas que debería hacer un tercero contratado, no vos, porque se las restás al crecimiento del negocio.\n\nEl otro gran eje es la **constancia**. Sofía dice que el éxito es un \"dos más dos\" (acción + constancia en el tiempo) y que la mayoría fracasa porque renuncia y es inconstante. Lo ilustra con su historia: empezó a crear contenido en **2018**, estuvo **dos años** casi sin audiencia (menos de 2000 personas), y en **marzo de 2020** dio una conferencia ante **1500 presenciales y 1500 por streaming**; la gente la buscó en Instagram, encontró todo ese contenido acumulado y en una semana la empezaron a seguir miles. Su moraleja: los resultados aparecen en la **\"pancita de la curva\"**, así que hay que trabajar en lo correcto, medir, corregir y avanzar sin distracciones.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 17,
        "vn": 2,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Objetivo y Teoría de las Limitaciones",
        "cardDesc": "",
        "videoId": "1M7M3KCnzrMQMPEnmNW9DxHnNR2nzgygu",
        "resumen": "Esta clase abre el módulo **Nicho Dorado** con una idea central: si tu negocio no crece de forma **estable y sostenible** (y no como un pico que después no sabés de dónde vino), es porque estás **trabajando en lo equivocado**. Sofía cuenta que lo primero que hace al entrar a cualquier negocio es **encontrar la limitación** antes de avanzar, porque si empezás a optimizar cosas que sí escalan pero dejás sin resolver una limitación previa, eso te pone un **techo (cap)** al crecimiento.\n\nLo ilustra con una **youtuber conocida** que la contrató para escalar resultados (desarrollar ofertas, **productivizar servicios**). Al entrar, Sofía vio que la verdadera traba no eran las ofertas sino el **equipo**: no estaba a la altura y quien lo lideraba no iba a tomar esa responsabilidad. El primer paso fue **contratar**; recién después pasaron a las ofertas productizadas. Sin resolver el equipo, todo lo demás se iba a pique.\n\nDespués condensa las limitaciones típicas de los negocios de servicios como el tuyo:\n\n- **Nicho** — hablás al nicho incorrecto o estás con demasiados a la vez (exagera con \"79 nichos\").\n- **Foco** — vendés a tres nichos o el mismo nicho con cuatro o cinco ofertas distintas, en vez de apuntar a **uno escalable**.\n- **Oferta** — tu servicio paquetizado no es el correcto para el nicho, o lo entregás de forma no escalable, demasiado prolongada, o no al **precio correcto**.\n- **Atracción** — no traés la cantidad de clientes necesaria.\n- **Cierres** — los atraés pero no los cerrás.\n- **Entrega de servicio** — no alcanzás las expectativas y aparece el **churn**: se van, no recompran, no sube el **lifetime value**.\n- **Márgenes** — vendés pero planchado en **10-30%**, cuando el objetivo es llevarlos a **más de 50-60%**.\n\nPulir cada punto te da **leverage (palanca)**: con todo optimizado el negocio no tiene techo y podés armar una máquina de adquisición que funcione todo el tiempo. El primer limitante que van a trabajar: los **nichos**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 18,
        "vn": 3,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Introducción a Nicho Dorado",
        "cardDesc": "",
        "videoId": "1AirzPptPCmz0TKrxhkANo1tFvVhWslo8",
        "resumen": "Esta clase abre el módulo **Nicho Dorado** con un repaso general de qué es un nicho antes de meterse en el concepto propio de MasteryHaus. Un **nicho** es un grupo de personas con un problema o circunstancia en común, que comparten **características demográficas** (dónde viven, edad, profesión, ingresos) y **psicográficas** (deseos, dolores, formas de pensar, cosas que ya probaron). Para que lo entiendas usa el **meme de los tres Spiderman**: iguales pero distintos en un detalle; con la máscara puesta comparten los mismos dolores, la misma ciudad y escuela, aunque su cara sea diferente.\n\nLa idea central es que los nichos no se eligen, se crean. Si elegís uno que ya existe caés en un **nicho rojo**, \"bañado de sangre\" por la competencia. Acá trae **Blue Ocean Strategy**: los mercados y submercados son **océanos rojos** llenos de tiburones; vos querés un **océano azul** despejado. De ahí el **nicho dorado**: un lugar donde hay mucho oro pero todavía no llegó la fiebre del oro, nadie fue al río a picar. Refuerza con la frase **\"riches are in the niches\"** — la riqueza está en los nichos.\n\nDespués enumera los componentes de un nicho dorado ideal:\n\n- **Dolor masivo** — que no quieran sino que necesiten desesperadamente lo que ofrecés; una audiencia hambrienta, como poner un puesto de hot dogs o shawarma frente a una disco a la madrugada.\n- **Poder de compra** — que tengan billetera para pagar lo que valés; si tu público no puede pagar, apuntá más arriba.\n- **Simples de alcanzar** — fáciles de llegar (a un multimillonario cuesta mucho más).\n- **En crecimiento** — nunca un mercado en declive, como los periódicos o los visitadores médicos.\n- **Poder de decisión cercano** — hablar directo con quien decide, sin siete escalones de aprobación que atrasan la venta meses.\n- **Que puedas servir** — tener experiencia y conocimiento real del mercado, lo que achata la curva de aprendizaje (lo aprendió invirtiendo en startups).\n\nCon estos criterios claros, cierra anticipando el paso siguiente: crear tus propios nichos dorados.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 19,
        "vn": 4,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Tipos de Mercado",
        "cardDesc": "",
        "videoId": "178LNpiqNa9K-fSJAUmaUPNT7EJTx753d",
        "resumen": "Esta clase te da un mapa simple para ubicar en qué mercado está parado tu servicio, algo que suele ser confuso. Sofía retoma un concepto de **Russell Brunson**: solo existen **tres mercados que nunca van a dejar de existir** — el de la **riqueza**, el de la **salud** y el de las **relaciones**. Ella le suma un cuarto propio, el mercado de la **felicidad**, que menciona pero no desarrolla acá. La idea clave: no importa qué vendas, tu servicio encaja en uno de estos.\n\nDebajo de cada mercado hay **submercados**, y dentro de cada submercado, **nichos**. Ejemplos que da:\n\n- **Riqueza** — inversiones, educación, real estate, ventas, marketing.\n- **Salud** — estilo de vida, training de fuerza, pérdida de peso.\n- **Relaciones** — lifestyle / estilo de vida.\n\nPara descubrir en qué mercado estás, usás la frase **\"Hago esto para que puedan ___\"**. Con eso desnudás el fin último de lo que ofrecés. Los ejemplos que menciona:\n\n- Enseño **Pilates** para que puedan apropiarse del método y hacer más dinero.\n- Hago **terapia de parejas** para que mejoren sus relaciones.\n- Gestiono **ciudadanías** para que puedan emigrar y hacer más dinero.\n- Enseño **alimentación keto** para que mejoren su salud.\n- Hago **infraestructura IT** para que mejoren su backend y hagan más dinero.\n- Doy **consultoría en OKRs** para mejorar la gestión del equipo y hacer más dinero.\n\nSu observación: muchísimos mercados terminan atados al **dinero** como fin último, aunque también hay un montón vinculados a salud y relaciones.\n\nEl cierre y gran regla de la clase: una vez que identificás tu mercado o submercado, tenés que **crear tu nicho dorado**. Porque **los nichos se crean, no se eligen** — el dinero no está en el submercado, que está plagado de competencia. El cómo crear ese nicho dorado y los ejercicios quedan para el siguiente video.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 20,
        "vn": 5,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Nicho Dorado",
        "cardDesc": "",
        "videoId": "1QIcn_WsO3YEjFT5q-YV5-vly9aDBl2Ke",
        "resumen": "Esta clase abre el módulo **Nicho Dorado**, un concepto propio de MasteryHaus para referirse a un nicho específico que se desarrolla más adelante. Antes de entrar en él, Sofía planta la idea central: para vender cualquier cosa **necesitás demanda**, y esa demanda ya existe allá afuera.\n\nEl error que ve en la mayoría de los emprendedores es que quieren **crear demanda** o generar deseos nuevos, convencidos de que su idea es \"totalmente innovadora\" y que nadie la desarrolló antes. La tesis de la clase es la opuesta:\n\n- **No creamos demanda, la canalizamos** — los deseos, dolores y necesidades ya están ahí; tu trabajo es dirigir esa demanda hacia tu oferta, no inventarla.\n- **Ejemplo del iPhone** — no creó una necesidad de la nada; agarró un dolor que ya existía (gente cansada de celulares táctiles con botones gigantes) y canalizó el deseo de usabilidad, estética, simpleza y foco en sacar fotos y escuchar música en un mismo espacio hacia su producto.\n\nDe ahí saca una advertencia práctica: **no te pongas romántico con tu mercado**. Muchos emprendedores están enamorados del nicho o del tipo de cliente en el que están parados, aunque no les convenga.\n\n- **Ejemplo de los que recién empiezan** — quien ofrece servicios a emprendedores que están arrancando choca con que ese cliente no tiene fondos, el negocio no está escalado ni tiene flujo, así que no te puede pagar lo que valés.\n- **Regla** — \"apuntá a quien les pueda pagar lo que valés\".\n\nSofía cierra recordando que **elegir mercado es una decisión tuya**: en MasteryHaus te guían y te hablan de frente cuando un camino no les parece, pero la decisión final es del alumno. \"Elegí sabiamente.\" La clase termina anticipando el siguiente paso: entender los distintos **tipos de mercados** que existen antes de profundizar en los nichos dorados.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 21,
        "vn": 6,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Cómo Crear tu Nicho Dorado",
        "cardDesc": "",
        "videoId": "1vWfF2P-0GLQrwpD22MWlohAg_CrSc6QC",
        "resumen": "Esta clase enseña cómo crear tu **nicho dorado**: agarrás el nicho que ya tenés al frente y le agregás características en **tres niveles de profundidad**. Lo que buscás, como dice **Dan Kennedy**, es competir en una **categoría de uno** — una sola persona o empresa —, así no competís con nadie.\n\nSofía lo muestra con su propio caso, **gestión del tiempo**, que arrancó vendiendo a **$25**:\n- **Nivel 1** — gestión del tiempo para **agentes inmobiliarios** (ya no para cualquiera).\n- **Nivel 2** — con **foco en compradores** (no vendedores).\n- **Nivel 3** — con enfoque en **compradores premium** → lo podés cobrar **10 veces más**.\n\nCada nivel achica el dolor, te especializa y sube el valor porque le hablás directo a esa persona puntual.\n\nDa más ejemplos del mismo mecanismo:\n- **Emprendedores → coaches → coaches en salud → coaches en salud mental** — apunta ahí porque la salud mental es el tema top en los rankings de podcasts a nivel mundial y genera comunidades enormes.\n- **Empresas → tecnología → ingeniería → a gran escala** — un cliente firmó confidencialidad con una empresa de ingeniería a gran escala, trabajó **dos años**, se volvió referente del rubro e hizo un **x20** en su negocio; ya nadie lo compara por presupuesto.\n- **Mujeres con sobrepeso → empresarias C-level con sobrepeso → madres recientes**.\n- **Líderes → coach de líderes de empresas familiares → de agroindustria → de segunda generación**.\n\nBeneficios del nicho dorado: te separás de la competencia, le hablás directo al **dolor y al deseo**, el cliente se identifica al instante, te posicionás de forma única en su mente y **cobrás lo que vale** esa categoría de uno. El foco del negocio, insiste, es el **copy y las ofertas especializadas**. Lo cierra con su ejemplo del contador: elegiría al que ya trabaja con negocios de educación online internacional aunque cobre **tres veces más**, porque sabe que le resuelve mejor.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 22,
        "vn": 7,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Errores Comunes",
        "cardDesc": "",
        "videoId": "1QdLH-fmFwTpEqIy9jYHg2zmQ0xvUbEUd",
        "resumen": "Esta clase cierra el módulo del **nicho dorado** repasando los **errores más comunes** que frenan a los emprendedores al definirlo, y por qué enfocarse rinde. Sofía arranca con dos trampas: **querer hacerlo perfecto** (perdés tiempo puliendo algo impoluto en vez de avanzar) y **hacerlo en soledad** (cuando te trabás, preguntá en la comunidad o al mentor para desbloquearte). El norte de estos meses es simple: avanzar.\n\nDespués desarma la creencia de que **te estás casando con el nicho**. Cuenta que ella misma, al principio, le hablaba a todos los emprendedores por miedo a perder oportunidades, pero enfocarse en un nicho dorado le dio un **cambio abismal en la facturación**. La clave es **probar** con cuál te quedás; el nicho puede evolucionar y encima nichos cercanos igual te prestan atención cuando generás autoridad.\n\nLos errores que enumera:\n\n- **Pensar que perdés oportunidades** — es al revés: hablarle a todos te dispersa y hace que le vendas a cualquiera.\n- **Quedarte con muchos nichos** — primero construís una **oferta especializada**, la cerrás y la ponés a escalar, y recién ahí vas a otro nicho.\n- **Saltar de un nicho al otro sin dejarlo madurar** — sin pruebas ni datos de punta a punta no sabés si funcionó o no; evitá el **síndrome de los espejitos de colores**.\n\nDa su propio caso: **dos nichos dorados** (negocios y productividad), desarrollados por separado, uno primero y después el otro. Enfocarse otorga **palancas de especialización y paz mental**: elegís los clientes que te gustan. Cierra con la definición de su nicho en **Masterclass**: emprendedores de servicios escalables (coaches, consultores, asesores, marca personal, infoproductores) con clientes actuales, **más de $3.000 de facturación mensual**, que quieren un modelo escalable y longevo, con assets (comunidad, base de datos o dinero para anuncios) y comprometidos con su éxito. A quien no entra, le dicen que no.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 23,
        "vn": 8,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Cómo Avanzar Hacia tu Nicho Dorado",
        "cardDesc": "",
        "videoId": "1HD_jWV_Px-x63-uJ_VSCFf61BZrzSY0E",
        "resumen": "Esta clase es el mapa de ruta para llegar a tu **nicho dorado** y, sobre todo, para construir el **avatar de tu cliente ideal**. Sofía ordena el trabajo en **cinco pasos** que venís transitando a lo largo del curso:\n\n- **Identificar el mercado** — reconocer en qué mercado estás parado (paso que ya viste antes).\n- **Identificar el segmento o submercado** — bajar un nivel dentro de ese mercado.\n- **El nicho dorado a tres niveles de profundidad** — afinar el nicho en las tres capas que se venían trabajando.\n- **Crear el avatar del cliente ideal** — un concepto de marketing que quizás conocés como **avatar**, **buyer persona**, **buyer customer** o **cliente ideal**.\n- **Profundizar ese avatar con investigación** — sumarle datos e indagación real.\n\nLa idea central es que ahora vas a **desarrollar o pulir** el avatar que sale de ese nicho dorado. Si ya lo tenés, lo puliís; si no, lo armás desde cero. Sofía aclara que muchísimas empresas —de cualquier tamaño con las que trabajó— **no lo tienen desarrollado**, y por eso mismo no consiguen los resultados que esperan.\n\nTambién marca que este no es un ejercicio de una sola vez: en su negocio lo repiten de forma regular, **cada seis meses** y como mucho una vez al año, o cuando cambia algo del negocio. Lo tienen \"aceitado\" porque de ahí sale todo: **las estrategias, todos los mensajes y la oferta especializada** que vas a desarrollar.\n\nPor último, adelanta el método: van a hacer este pulido usando **ChatGPT**, con una forma simple que te va a enseñar. Pero no lo hacen todavía: primero repasan los pasos, después miran el **documento de trabajo** y recién ahí ven cómo ejecutarlo con ChatGPT.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 24,
        "vn": 9,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Cómo Crear tu Avatar",
        "cardDesc": "",
        "videoId": "1FSeT-VHrgYMwEpatWYRwaCeIOiMHoVDX",
        "resumen": "Esta clase te guía, paso a paso y con el **documento de trabajo** de la instructora ya completado como ejemplo, para pasar del mercado a tu nicho y de ahí al **avatar** de tu cliente. Primero elegís el **mercado** (en su caso, el de la **riqueza**), el **submercado** (educación para emprendedores) y armás el **nicho de oro** con características a **tres niveles de profundidad** (ej: emprendedores → consultores → consultores corporativos). El consejo clave: no te trabes acá, pasá rápido a las preguntas de validación.\n\nPara validar el nicho respondés: ¿tiene un dolor grande?, ¿hay mucha **bibliografía** en Amazon o librerías online?, ¿qué **poder adquisitivo** tiene?, ¿permite **ingresos recurrentes** (MRR)?, ¿cuál es el precio más alto que paga hoy?, ¿qué **upsell** admite? Y un semáforo de tamaño de comunidad: sumás los miembros de los cinco grupos/foros/canales más grandes; menos de **300.000** es rojo, entre **300.000 y 600.000** amarillo, más de **700.000** verde.\n\nDespués construís el **avatar**: una persona con nombre y apellido que representa todo el nicho. Se arma con dos bloques:\n\n- **Preguntas demográficas** — sexo, edad, estado civil, hijos, educación, ubicación, nacionalidad (las nacionalidades sirven para hacer **micro-avatars** y ajustar ángulos, ganchos y **hooks**), qué venden y cuánto facturan.\n- **Preguntas psicográficas** — dolores, deseos, miedos, frustraciones. La pregunta más importante: si solo pudieras cobrar por resultados, ¿qué características tendría ese cliente ideal? (ej: ya factura **2.000–3.000**, negocio de servicios online con **margen +50%**, experiencia en su rubro, **real estate mental**). También qué personalidad aceptás y cuál no, su **situación deseada con un número atado** (ej: **+$10.000/mes** sistemáticos, o bajar 5–20 kg), qué lo desvela, sus sesgos de decisión, y a quién sigue (influencers, referentes).\n\nToda esta info alimenta después la **oferta irresistible**. Cierra: no dejes ninguna pregunta sin responder, y la próxima clase muestra cómo hacerlo con ChatGPT.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 25,
        "vn": 10,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Crea tu Avatar con ChatGPT",
        "cardDesc": "",
        "videoId": "1D_96tmVcfB9Vt91yIZZVLjNz3bra1JvK",
        "resumen": "Esta clase te muestra cómo usar **ChatGPT** para construir o pulir tu **avatar de cliente ideal** dentro del módulo **Nicho Dorado**. La regla madre: tené **cabeza crítica**. No te quedes con lo que la IA te tira, no hagas copy-paste, sacá lo que no sirve y **repreguntá** hasta pulir a conciencia, porque es un ejercicio fundacional sobre el que construís todo lo demás.\n\nEl **prompt base** es simple: \"crea un avatar de cliente ideal para mi producto. Producto: [el tuyo]\". En el primer ejemplo, un **curso para enseñar un método de Pilates**, ChatGPT devuelve a **Marta**: 34-35 años, instructora con 1-2 años de experiencia, que invierte pero **espera resultados tangibles** (eso va en la promesa de tu oferta irresistible).\n\nDespués **concatenás preguntas** en la misma pestaña, porque ChatGPT aprende de su propia respuesta (si son dos nichos, abrís chats separados). Preguntando por países de habla hispana con mayor potencial, tiró seis: **España, México, Argentina, Colombia, Chile y Perú**, y hasta estimó ingresos por país sin pedírselo. Usá las preguntas del **formulario de avatar** del video anterior para profundizar (facturación, cantidad de clientes actuales), porque solo lo básico se queda corto.\n\nEn el segundo ejemplo, una **consultoría done-for-you de OKRs**, aparece **Diego**: CEOs y gerentes de empresas ya con escala, que buscan **partners, no proveedores**. Pidiéndole países por **retorno de inversión** y excluyendo Argentina, ChatGPT concluyó que **Chile y Colombia** son los más atractivos por balance oportunidad-costo. Son conclusiones **parciales**, no verdades.\n\nCerrá complementando con tu entorno: **entrevistas, onboarding, llamadas de ventas**, clientes ideales del pasado (para el dolor), seguidores, **brainstorming con tu equipo**, un grupo de WhatsApp/Telegram con tus top 3-5 clientes, y espiando a la competencia en Instagram, YouTube, TikTok y **Facebook Ads Library**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 26,
        "vn": 11,
        "grupo": "Nicho Dorado",
        "modulo": 3,
        "titulo": "Clientes Para Toda la Vida",
        "cardDesc": "",
        "videoId": "1tQ7WhbN2cQ4v-1hfA1Z6cTCqnxcoi4F7",
        "resumen": "Esta clase cierra el módulo de **Nicho Dorado** y trata sobre cómo crear **clientes para toda la vida**. La idea central: lo único que realmente poseés es la **relación con tu cliente**. Las plataformas van y vienen (el ejemplo de **Vine**, la primera de contenido corto, que se vendió y cerró dejando a influencers sin años de trabajo), los **costos de anuncios** suben y la **tracción es errática** (como en Instagram hoy). La relación, en cambio, si la nutrís, es tuya. Sofía te invita a imaginar una relación de por vida con tu peor cliente versus con tu mejor cliente de nicho: el bueno aprecia lo que hacés, tiene resultados y crece con vos subiendo por tu **escalera de valor**.\n\nEnseña seis puntos para generar esa relación:\n\n- **Relación, no transacciones** — interesarte de verdad en que a tu cliente le vaya bien; que haya vínculo, conversación y seguimiento.\n- **Match desde el inicio** — que tu personalidad y la del cliente conecten. Ejemplo de **Superman vs Spiderman**: Superman es de otro planeta y cuesta identificarse; Spiderman es un humano común con quien cualquiera se refleja, y por eso explotó.\n- **Entender lo que el cliente no suele recibir** — ejemplo de **Zig Ziglar**, referente de ventas, que dejaba a los vendedores embelesados hablándoles de su potencial y su dolor, cosas que nunca escuchaban.\n- **Crear oferta, mensaje y personaje** alrededor de todo lo que sabés del avatar, para comprar \"**real estate mental**\" y separarte de la multitud.\n- **Aparecer regularmente** — estar presente y nutrir el vínculo a lo largo de los años.\n- **Crear tu leyenda**, empaquetada y memorable — ejemplo de **George Bush Sr.** (\"no es tan tonto como parece\"): definí qué querés que digan de vos cuando no estás en la sala y transmitilo en todo.\n\nTodo esto incrementa el **lifetime value**, reduce incertidumbre y problemas. Recordatorios finales: comprometete con tu nicho, despedí al anterior y enfocate en relaciones de por vida.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-nicho-dorado",
          "mh-desarrollador-nicho-dorado",
          "mh-desarrollo-de-avatar-dorado"
        ],
        "herramientas": []
      },
      {
        "n": 27,
        "vn": 1,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Oferta Especializada",
        "cardDesc": "",
        "videoId": "1iKsdaq9V-oCnn57Ffa0TxA90qA0w7xlo",
        "resumen": "Esta clase arranca el desarrollo de la **oferta especializada e irresistible**, una vez que ya tenés nicho y avatar definidos. La idea central: **la clave para encontrar oro en los nichos dorados es armar ofertas especializadas**. Ojo, acá \"oferta\" no significa descuento; significa **empaquetar tu servicio** de una forma mucho más atractiva, para dejar de vender \"un servicio\" suelto y pasar a vender un paquete. Con eso te separás de la multitud, jugás en una **categoría de uno**, dejás de ser un **commodity** y no te comparan más por precio.\n\nSofía contrasta un servicio común (un \"curso de productividad\" a **$150**, con secciones sueltas) contra una oferta especializada, que le suma componentes que te separan del mercado:\n- **Suscripción / tiempo acotado** — un mes específico para lograr resultados.\n- **Documentos plug and play** — el cliente solo los descarga y usa, sin pensar ni desarrollar nada.\n- **Acompañamiento con coaches y accountability** — que se hagan responsables de lo que hacen.\n\nEsto sube el **valor percibido** y el **precio**. La oferta se compone de cuatro partes: **nicho dorado con avatar**, un **problema muy específico**, una **forma única de resolverlo** (tu metodología) y que **rompa la objeción más grande**. Ejemplos: pérdida de peso para mujeres que acaban de tener hijos \"sin hacer dietas\"; flipping de inmuebles \"sin ver las propiedades, solo por WhatsApp\"; citas para mayores de 60 \"sin incómodas primeras citas\".\n\nEl segundo gran concepto: **al cliente no le importa el proceso ni la metodología, le importa el resultado y su transformación**. Todo lo que hacés es un medio para su fin. Por eso **vendés lo que el cliente valora y entregás lo que necesita**. Cita a **Tony Robbins**, el **Inner Circle** de **Russell Brunson** y el **Gym Launch** de **Alex Hormozi** (ticket 10x). Cierra anticipando la frase única que resume a quién ayudás, su dolor y por qué sos diferente.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 28,
        "vn": 2,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Tu Frase A-B-C",
        "cardDesc": "",
        "videoId": "1gqGJ4Ula6E9rF4UGkQrVJsFVKASbbCba",
        "resumen": "Esta clase te enseña a armar tu **frase A-B-C**, una sola oración que resume tu oferta irresistible y baja la barrera de entrada de tu potencial cliente. La lógica es identificar tres cosas: el **estado actual** de la persona antes de trabajar con vos, la **transformación** o estado deseado al que llega después de tu servicio, y **tu método** propio que la lleva de un punto al otro.\n\nLa estructura queda así: **\"Ayudo a [nicho dorado] a resolver un problema específico, de una forma única (tu método), que aborda su obsesión o dolor más grande.\"** No está armada al azar: usa **psicología de ventas**, no solo lógica como hace todo el mundo.\n\n- **Poner un método o sistema con nombre** — genera intriga, necesidad y deseo. Sofía lo compara con la **\"caja misteriosa\"** o esos programas donde compran depósitos cerrados sin saber qué hay dentro: el no saber es un clic psicológico que suma deseo.\n- **No digas tu rótulo** (consultor, coach, infoproductor) — decí qué hacés y para quién.\n- **Meter el dolor y bajar la objeción más grande dentro de la frase** — hace la venta mucho más simple: que hagan clic, que agenden llamada, que presten atención.\n\nEjemplos que da: **ayudar a creadores con +10.000 seguidores a monetizar su audiencia en 30 días con historias orgánicas** (el \"método X\", donde el consultor se queda con el 50% de las ganancias); **madres recién paridas a bajar los kilos del embarazo sin dietas** (método pH); **mayores de 60 en Michoacán a encontrar el amor sin incómodas primeras citas** (método \"amor infalible\"); **agentes inmobiliarios premium a tener más tiempo libre ganando dinero mientras tanto** (método \"agente high performance\"); y **empresarios retirados a reencontrar su pasión manteniendo la confidencialidad** (dolor: no quieren que los vean en coaching o autoayuda). En cada caso agarrás el dolor más grande y lo das vuelta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 29,
        "vn": 3,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "La Ecuación de Valor",
        "cardDesc": "",
        "videoId": "1AadGVbltTB70kjd64Nf_XJmMBtMKqcGc",
        "resumen": "Esta clase te enseña **la ecuación de valor**, la herramienta para diseñar una **oferta irresistible**: esa donde el cliente se siente tonto diciendo que no. La idea de fondo es que, para que algo sea irresistible, el **valor percibido** tiene que ser muchísimo mayor que el **costo** (precio, esfuerzo, tiempo). Sofía lo ilustra con su camioneta: una **Mercedes de $130.000** ofrecida a **$10.000** la compraría cualquiera, incluso endeudándose, porque la brecha valor-precio es enorme. Como dice **Warren Buffett**, \"el precio es lo que pagan, el valor es lo que reciben\".\n\nLa ecuación es una división con cuatro componentes:\n\n- **Resultado soñado** — lo que el cliente desea y valora; tenés que hacerlo tangible y visible en toda tu comunicación.\n- **Probabilidad percibida de lograrlo** — cuánta certeza siente el cliente de conseguirlo; el cliente paga por certeza, así que subirla facilita vender más caro. Va arriba, multiplicando.\n- **Esfuerzo y sacrificio** — cuánto le cuesta alcanzar el resultado.\n- **Demora en el tiempo** — cuánto tarda en obtenerlo. Estos dos van abajo, y buscás llevarlos a cero: cualquier número dividido por cero tiende a infinito.\n\nUn concepto clave es trabajar la **percepción** con **soluciones psicológicas** en vez de lógicas: las apps de delivery no aceleran el pedido, ponen el **mapa de seguimiento**; el ascensor de un rascacielos de Manhattan sumó espejos y pantallas; las marcas fabrican **ediciones limitadas** (20, 100 unidades) para crear escasez, algo replicable en servicios (\"solo entran 20 personas\").\n\nEl ejemplo central compara el deseo de **bajar de peso**: la **suscripción a un gimnasio** puntúa bajo (mucho esfuerzo, mucho tiempo, baja probabilidad percibida), mientras la **liposucción** puntúa altísimo (resultado en un día, poco esfuerzo). Por eso se pagan **$10.000** por una lipo y no **$50** por el gimnasio. Los cuatro elementos operan siempre en conjunto; los documentos de trabajo traen el paso a paso para medir tu oferta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 30,
        "vn": 4,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Objeciones en la Ecuación de Valor",
        "cardDesc": "",
        "videoId": "18I3XoYNtXW_aabRjOasr2q9So97dgHcU",
        "resumen": "Esta clase te muestra cómo usar la **ecuación de valor** no solo para medir el valor percibido de tu oferta, sino para **anticipar y desactivar objeciones**. La idea central: las personas objetan por cada uno de los cuatro componentes de la ecuación, y si rompés esas objeciones desde el arranque, allanás el camino para vender tu oferta irresistible mucho más fácil.\n\nSofía repasa las objeciones típicas por componente:\n\n- **Resultado soñado** — \"esto no va a valer la pena económicamente\".\n- **Probabilidad de logro** — \"no va a funcionar para mí\", \"los factores externos se van a interponer\", \"no depende de mí\", \"no voy a generar el hábito\"; son objeciones específicas del servicio que mostrás.\n- **Esfuerzo y sacrificio** — \"va a ser demasiado difícil\", \"voy a tener que dedicar mucha energía\", \"no me va a gustar\", \"lo voy a hacer mal\".\n- **Tiempo** — \"me va a llevar demasiado\", \"estoy muy ocupado\", \"tardará más en funcionar\", \"no es conveniente para mi caso\".\n\nLa clave es **mapear todas las objeciones para después darlas vuelta** y convertirlas en soluciones (paso que se desarrolla más adelante en el módulo).\n\nEl ejemplo principal es un **video de venta en inglés con más de 7 millones de reproducciones** (queda en el cuaderno de trabajo). Vende un programa para armar una **agencia de social media** y, entrando por el dolor del **nicho dorado** (personas que quieren emprender con experiencia cero), en un solo slide compara alternativas —marketing de afiliados, **Amazon FBA** (entrada de **1000 a 5000 dólares**), dropshipping— marcando en verde y rojo capital, márgenes, demanda y entregabilidad para bajar objeciones. Refuerza la **factibilidad de ocurrencia** con testimonios de casos idénticos al avatar, y contrasta hacerlo solo (mucho tiempo, más caro, más esfuerzo, abandono) contra hacerlo con él (semanas, más barato). Así juega con todos los componentes de la ecuación para borrar objeciones antes de vender.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 31,
        "vn": 5,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Análisis de Competencia",
        "cardDesc": "",
        "videoId": "1MYfhBRZSaFTM2yAnhtzJhI0X-s2aNeUz",
        "resumen": "Esta clase abre el módulo de **Oferta Irresistible** con el **análisis de competencia**: para diferenciarte necesitás saber qué está pasando en el mercado y qué hacen los otros jugadores, porque tu cliente siempre te va a comparar con otras opciones (\"vos versus el resto\"). Sofía insiste en que la **creatividad** surge del cruce entre investigar el mercado y tu propio contexto y conocimiento; si no investigás, generás **miopía** (estás ciego) y entrás en desventaja a **mercados sofisticados** donde ya hay referentes posicionados y clientes bombardeados de anuncios.\n\nLa idea central es **tamizar el mercado** (concepto de pastelería): separar hasta que queden arriba los jugadores que más sobresalen, para hacerles \"doble clic\".\n\n- **Paso 1 — armar la lista** — competidores con soluciones y target similares, rango de tarifas parecido, y también algunos ligeramente distintos (no los excluyas). Enfocate en gente **a tu altura**, dejando el ego de lado: lo que importa es si venden y tienen clientes recurrentes, aunque su promesa te parezca \"humo\".\n- **Cómo encontrarlos** — actuá como tu cliente y buscá donde él buscaría (YouTube, Google, TikTok: p.ej. \"training para closers\"); buscá en **inglés** porque el mercado de EE.UU. está años más avanzado (mira el 90% de lo que pasa ahí; Brasil está ~7 años adelante de Latam en educación digital); preguntá a colegas y a tus propios clientes.\n- **Paso 2 — organizarte** — creá una carpeta **Mastery House** en Drive y dentro **Análisis de Competencia y Oportunidad**, con una subcarpeta por competidor; instalá el plugin de Chrome **GoFullPage** para capturar landings completas y guardarlas.\n- **Paso 3** — usar el documento **Analizador de Competencia** que provee el curso.\n\nEjemplos: **closers vs setters** (negocios similares) e **Imán**, que enseña social media agencies a un target más joven (~22-28 años). Un hack que menciona: muchos venden mejor porque su **avatar son ellos mismos**. Quedate con una lista de 5 a 10 referentes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 32,
        "vn": 6,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Análisis de Servicio",
        "cardDesc": "",
        "videoId": "13AS5hXKxQE2nm3fvH_COgoSkKTFpSGvm",
        "resumen": "Esta clase te muestra una herramienta simple pero poderosa: una planilla de **Análisis de Servicio** para hacer una auditoría de todo lo que tenés corriendo hoy en tu negocio. Es la puerta de entrada a tu **oferta irresistible**: primero mapeás el estado actual y después lo comparás contra la proyección de tu nueva oferta para decidir qué mantener, qué mejorar y qué sacar. Ojo con la planilla: todo lo que está en **gris se autocompleta**, no lo toques o se rompe la tabla.\n\nPor cada servicio cargás estos datos de entrada:\n\n- **Nombre y descripción** — qué es cada servicio.\n- **Ingresos brutos de los últimos 12 meses** — lo que le entró al negocio, antes de restar costos e impuestos.\n- **Porcentaje neto estimado** — cuánto le ganás a ese producto.\n- **Precio promedio por unidad** y **total de ventas** de los últimos meses.\n- **Horas totales de servicio por unidad** — cuánto tiempo te demanda entregarlo una vez vendido.\n\nCon eso la planilla te devuelve **ingreso neto por servicio**, qué porcentaje de los ingresos representa cada uno, **ingreso neto promedio por unidad**, **beneficio por hora** y dos rankings (por beneficio/hora y por ingresos netos).\n\nSofía usa ejemplos reales de sus propios productos: **gestión del tiempo ($147)**, **negocios exitosos ($1200)**, **consultoría ($2000)**, **speaking conferencia ($7000)** y **speaking workshop ($14000)**. El curso autogestionado (con **2381 compradores**) demanda casi **2 min por persona** y rinde **~$956 por hora**, casi lo mismo que \"negocios exitosos\" (~$960/h) que exige mucho más esfuerzo; la consultoría done-for-you, pese a todo el trabajo, deja apenas **$4 por hora**.\n\nEl paso final es una **valoración cualitativa**: por cada servicio te preguntás si es escalable, si te da placer o dolor, si está alineado con tu posicionamiento, si el cliente lo compara por precio con la competencia y si son tus clientes ideales. Cruzando números y semáforos verde/rojo obtenés el **big picture** para filtrar y eliminar lo que no rinde o te genera dolor.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 33,
        "vn": 7,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Usá ChatGPT para tu Oferta Irresistible",
        "cardDesc": "",
        "videoId": "1JYI4rzlvu-tGkE4Ohvu-2E216KeIATvS",
        "resumen": "Esta clase te muestra cómo apoyarte en **ChatGPT** para pulir tu **frase ABC** (la oferta especializada) sin tercerizar el criterio. La regla de oro: primero trabaja la inteligencia artificial y después trabajás vos con tu voz. Inspirate en lo que te tira, pero con cabeza crítica para filtrar; nunca lo copies a ciegas.\n\nEl método concreto es pegar un prompt en la misma pestaña donde ya venías desarrollando tu **avatar**. El prompt le pide a la IA que arme una frase del tipo \"ayudo a [nicho] a resolver [problema]\", le das un ejemplo y le preguntás \"¿cómo lo harías para mi avatar?\".\n\nTodo el desarrollo lo ilustra con el caso de los **OKRs**. ChatGPT devuelve una frase larguísima (\"maximizar la ejecución estratégica y la cohesión interna... contrarresta el desgaste y la confusión\"), que igual sirve como materia prima: te da ideas de método, de deseo y de dolor. Cuando le pedís que la corte, aparece un error típico: te habla desde lo que hacés (\"con el método OKR Sinergia Plus\"). Sofía recuerda la regla: **al cliente nunca le hablás primero con lo que hacés; el método va al final**.\n\nDe ahí itera:\n\n- **Nicho dorado** — bajás de \"startups en ronda A\" a nichos más finos: ronda A de salud, fintech, con líderes de ciertas características.\n- **Resultado con número y tiempo** — \"incrementar el rendimiento del equipo un **60%** en **60 o 90 días**\".\n- **Bajar la ecuación de valor** — sumás el \"sin\" (sin metodologías complejas ni software pesado); llevar a cero la parte de abajo de la **ecuación de valor** dispara el valor percibido.\n- **Nombre del método** — diferenciás un mercado saturado bautizándolo: **OKR 2033**, **OKR Plus**, **OKR Impacto**, jugando con la psicología.\n\nCierre: la frase ABC se pule con el tiempo probando qué conecta, y no hace falta cerrarla primero; podés avanzar con lo demás y volver.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 34,
        "vn": 8,
        "grupo": "Oferta Irresistible · Fundamentos de una Oferta Irresistible",
        "modulo": 4,
        "titulo": "Creá tu Oferta Irresistible",
        "cardDesc": "",
        "videoId": "1sPnc_jDgTY2RnEbV6mxKqNDaTKNzTCaE",
        "resumen": "Esta clase es un taller práctico para armar tu **oferta irresistible**. Trabajás con dos documentos: uno de **lectura** (el paso a paso con ejemplos y la lógica del por qué) y uno de **trabajo** (donde vas completando). Arranca con la **frase ABC** (\"Ayudo a profesionales a escalar su negocio de forma sólida en seis meses a través del método Master House\"), que podés definir sobre la marcha si todavía no te sale.\n\nLos pasos que enseña:\n\n- **1. Resultado soñado** — identificás el sueño concreto de tu **nicho dorado**. Ejemplo: generar ingresos recurrentes de más de **cinco cifras en dólares** al mes, sin gestionar equipos gigantes ni clientes problemáticos.\n- **2. Listar TODOS los problemas** — sacás los dolores de la planilla de avatar, de clientes que ya tuviste o investigando a la competencia (quejas, comentarios, cómo comunican, ej. Imán Gatsby). Mapeás el problema grande, los chicos adentro y lo que la persona se dice (\"no soy suficientemente profesional\", \"si subo precios nadie me compra\"). Mientras más detalle, más objeciones tenés respondidas.\n- **3. Darlos vuelta con \"cómo\"** — cada problema se transforma en solución: \"Cómo despedir a tus clientes tóxicos y ganar 10 veces más\", \"Cómo trabajar menos, ganar más y vivir la vida\" (título real de su canal de YouTube). Esto también te sirve para **hooks** de anuncios y títulos de contenido.\n- **4. Crear tu valor** (el más importante) — anotás TODO lo que podrías ofrecer para cada problema, sin vetar ideas (\"modo monje\", o post-its con socios). Recomienda ofertas **uno a muchos**, no uno a uno (salvo ticket alto, como Mastery Pro vs Master Build, que abrió con 16 personas).\n- **5. Recortar** — elegís lo de **mayor valor y menor esfuerzo**; eliminás primero lo de alto costo/bajo valor, después lo de bajo costo/bajo valor.\n\nRefuerza que el esfuerzo puesto acá construye algo **escalable**: dos de sus programas le dejaron más de **$400.000** vendiéndolos dos años.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 35,
        "vn": 1,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Introducción a Armado de Oferta",
        "cardDesc": "",
        "videoId": "13UKVdr5EeGC2WfqOTyQ0ZcUbiCstzpm5",
        "resumen": "Esta clase abre el módulo de **Armado de la Oferta** y es una introducción: acá empezás a **compaginar tu oferta irresistible**, es decir, a darle forma y ponerle límites a todo lo que venías trabajando en las clases anteriores. La idea central es una cadena de tres pasos que Sofía plantea así:\n\n- **Productivizar** — una vez que tu oferta tiene forma clara, la convertís en un \"producto\" definido.\n- **Sistematizar** — al estar productivizada, la podés sistematizar (procesos repetibles).\n- **Escalar** — sistematizada, la podés escalar.\n\n¿Por qué esto habilita escalar? Porque ya tenés definido qué **contiene** la oferta, **cuánto** cobrás, **cómo** cobrás, cuáles son tus **tipos de cliente** y en qué **términos** trabajás con ellos. Así dejás de tener un servicio que va cambiando según el cliente que te cae, y pasás a ofrecerle el **mismo servicio** al **mismo nicho** al que apuntás.\n\nOtro objetivo grande de esta etapa es **identificar el valor oculto de tu negocio**. Probablemente hoy ya estés entregando mucho valor pero sin capitalizar todas las partes que ya tenés adentro y que se podrían aprovechar muchísimo más.\n\nLa clase distingue dos puntos de partida:\n\n- **Si todavía no tenés nada desarrollado** — vas a empezar a compaginar tu oferta irresistible desde cero.\n- **Si ya tenés un negocio corriendo** con un servicio — vas a identificar los **puntos de optimización**, para modificar lo que tenés o incluso reformularlo por completo.\n\nComo ejemplo, Sofía cuenta que ella lo hizo muchas veces: agarró ofertas irresistibles que ya funcionaban, las optimizó y las volvió a lanzar al mercado, y también creó ofertas desde cero, como el **propio programa** en el que estás participando. El método para lograrlo va a ser guiarte por los distintos **componentes** de la oferta y del empaquetamiento **a través de preguntas**, que es lo que arranca a partir de acá.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 36,
        "vn": 2,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Ratio de Entrega de Servicios",
        "cardDesc": "",
        "videoId": "1h87obpMNAiGmnCYDfJMJ2V4r4fx4nfHp",
        "resumen": "Esta clase abre el bloque de **armado de la oferta** con una decisión clave: definir tu **ratio de entrega de servicio**, o sea a cuánta gente le das tu servicio al mismo tiempo. Sofía plantea que hay **tres grandes tipos de ratio**, y que cada uno tiene componentes distintos y se entrega de forma distinta.\n\n- **Uno a uno** — trabajás con un solo cliente por vez y tenés que replicar el servicio igual con cada uno. Los ejemplos son la **consultoría** y el **coaching**.\n- **Uno a pocos** — le das el servicio a un grupo chico de personas a la vez. Entran acá los formatos de **mastermind**, el acompañamiento en pequeños grupos, los **cohorts** y los **bootcamps**.\n- **Uno a muchos** — buscás llegar en **volumen** a mucha gente al mismo tiempo. Ejemplos: un **webinar en vivo cobrado**, una **clase en vivo o grabada cobrada**, un **curso grabado cobrado**, o un evento masivo. Menciona el caso de **Tony Robbins** con sus eventos multitudinarios como referencia del formato de volumen.\n\nLa idea central es que elegir un ratio no te obliga a quedarte solo con ese: los formatos **se pueden compaginar**. Como ejemplo usa el propio programa en el que estás: combina **uno a uno** (las sesiones individuales con tu mentor) y **uno a pocos** (las sesiones donde un experto le habla a un grupo y se genera la llamada). Ese programa no tiene un formato uno a muchos, pero la marca sí lo tiene en otros productos, como todo lo vinculado a **productividad**.\n\nEn resumen, antes de definir precios o la oferta en sí, tenés que decidir con qué ratio (o combinación de ratios) vas a entregar, porque eso cambia cómo se estructura y se entrega todo el servicio. Los detalles para profundizar están en el **libro de trabajo de Oferta Irresistible** que acompaña la clase.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 37,
        "vn": 3,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Ruta de Éxito del Cliente",
        "cardDesc": "",
        "videoId": "1R7VSdebBjeQzPx2uP0A91KLTw348vihR",
        "resumen": "Esta clase te enseña a diseñar la **ruta de éxito del cliente**: el camino que tu cliente recorre, paso a paso, hasta alcanzar el resultado y la transformación que le prometiste. Es la herramienta para **sistematizar y productivizar** tu servicio, porque deja claro qué acciones (tuyas o de tu equipo) hay que cumplir en cada tramo y qué recursos necesitás.\n\nLa estructura es simple y se basa en dos piezas:\n\n- **Etapas** — los grandes bloques por los que transita el cliente. En cada etapa hay acciones a ejecutar; cuando se completan, se cierra la etapa y se pasa a la siguiente.\n- **Hitos** — el logro que marca el fin de cada etapa. Sirven para saber si el cliente avanza y para guiar al equipo sobre lo que tiene que suceder.\n\nEl método que propone: primero pensás **en grande**, definís los **cinco grandes bloques** que componen la entrega, y recién después agregás detalle dentro de cada uno. Mantenelo simple: **cinco, seis o siete etapas como máximo**, no más.\n\nUn truco clave sobre los hitos es que **aceleran la percepción de rapidez**. Si adelantás entregables al inicio, el cliente siente hitos ganados enseguida y no espera dos, tres o hasta seis meses para ver resultados. Da como ejemplo un entregable de **cinco días implementando las estrategias A, B y C**, un sistema listo que le entregás en los primeros días de trabajo. Otra forma de encontrar las etapas es apoyarte en los **dolores del cliente** que mapeaste en el video anterior (primer dolor, segundo, tercero), y derivar los tramos de ahí.\n\nComo ejemplo real usa **MasteryHaus**, cuyas etapas son: definir **nicho**, armar la **oferta irresistible**, **captar** clientes, **vender** para generarles resultados (el sistema de entrega de valor) y **optimizar** para lograr márgenes de más del **60%**. El marco aplica a cualquier servicio, incluso programas multitudinarios.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 38,
        "vn": 4,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Involucramiento del Cliente",
        "cardDesc": "",
        "videoId": "1OdFDMy3-E7dOaYGGtev6cgIuVQGoey00",
        "resumen": "Esta clase, del módulo **Oferta Irresistible · Armado de la Oferta**, va sobre el **involucramiento del cliente**: cuánto tiene que hacer el cliente para lograr el resultado, y cómo eso condiciona la dificultad de la venta y de la entrega. La regla central es un trade-off:\n\n- **A mayor involucramiento del cliente** — más difícil de vender, pero más fácil de entregar. Es el curso autogestionado, sin seguimiento: como el cliente hace todo solo, sin nadie a quien consultar, según la **ecuación de valor** cuesta más alcanzar el resultado y los tiempos son más largos, así que tenés que sostener el valor con muchísima comunicación y marketing. A cambio, escala en volumen (los cursos de **ticket bajo** que son la puerta de entrada al **ticket alto**).\n- **A menor involucramiento del cliente** — más difícil de entregar, pero más fácil de vender. Es la consultoría de punta a punta: el consultor analiza el negocio, arma todo con su equipo y lo entrega \"cerrado con un moño\". Se vuelve fácil de vender porque bajás la parte de abajo de la ecuación de valor: el **esfuerzo/dolor** del cliente y el **tiempo** al resultado.\n\nSofía nombra tres formatos y recomienda armar un **híbrido**:\n\n- **Do it yourself** — lo hace todo el cliente.\n- **Done with you** — \"lo hago contigo\", como este mismo programa: consumís contenido, usás plantillas y documentos plug and play, y tenés sesiones con consultores y comunidad.\n- **Done for you** — lo hace absolutamente todo el consultor.\n\nEl ejemplo es **Alex Hormozi**: tras el consejo de **Russell Brunson** de no abrir más gimnasios físicos sino empaquetar y licenciar su conocimiento, empezó **done for you** (viajaba, hacía el lanzamiento, corría anuncios y cerraba clientes a cambio de un porcentaje del primer mes de ventas) y luego mutó a **done with you**, que le permitió escalar mucho más. La conclusión: elegí el formato según tu negocio, tu oferta y el nivel de escalabilidad buscado, usando el documento de trabajo para decidir.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 39,
        "vn": 5,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Soporte Irresistible",
        "cardDesc": "",
        "videoId": "1qHcKjYxQOhpQZwwuiBtVaDyEQzQG6XsK",
        "resumen": "Esta clase trata sobre el **soporte al cliente** como componente clave de una **oferta irresistible**. Sofía arranca con una observación: parece algo básico, pero el **90% de los líderes de negocios** con los que habla no lo tienen presente ni lo plasman cuando venden. No aparece en su marketing, ni en sus landings, ni en sus pitches uno a uno: nunca especifican cómo va a ser el soporte que recibe el cliente. Y ahí está la oportunidad, porque como la mayoría del soporte en el mercado es malo, el negocio que hace hincapié en un buen soporte tiene el camino allanado para diferenciarse y armar una oferta irresistible.\n\nPara definir tu soporte tenés que identificar dos cosas concretas:\n\n- **Canales** — por qué vías el cliente accede a vos y a tu equipo.\n- **Frecuencia** — cada cuánto va a suceder ese contacto.\n\nEl objetivo es **maximizar el valor percibido**, pero siempre cuidando la **factibilidad de entrega**: cuando elegís tu soporte, tené presente si realmente lo vas a poder cumplir con los recursos que tenés o que necesitarías sumar. Ejemplo: si ofrecés **soporte 24/7 por WhatsApp con un ser humano y no un bot**, tenés que poder sostenerlo de verdad.\n\nMenciona varios **formatos** posibles: contacto uno a uno por WhatsApp, contacto grupal por WhatsApp, comunidad privada, un representante específico de tu equipo asignado, Telegram o Slack. La clave es elegir el que sea **acorde a las necesidades de tu cliente**. Cita a un mentor: *\"hay que ir a donde está el cliente\"*, a lo que le resulte más simple, sin complicarle la experiencia. Si el cliente prefiere WhatsApp antes que mail, armás la estructura para eso, y aclara que no tiene que ser tu WhatsApp personal, sino uno específico de soporte del equipo. La consigna final: identificá los canales adecuados para tu tipo de cliente y hacé el soporte cada vez mejor y superador.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 40,
        "vn": 6,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Formato de Entrega de Valor",
        "cardDesc": "",
        "videoId": "1Qt9EXJOgu3ZmxymuYTpYswaSiL0N9vzq",
        "resumen": "Esta clase del módulo **Armado de la Oferta** se mete con el **formato de entrega de valor**: una vez que tenés definido tu servicio, el paso es preguntarte cómo se lo vas a hacer llegar a tu cliente. Sofía plantea que no hay un solo canal correcto y que conviene recorrer las opciones antes de casarte con una.\n\nLos formatos que enumera son:\n\n- **En vivo** — frente a una cámara hablándole a la gente en tiempo real, por ejemplo a través de un **webinar**.\n- **Presencial** — puede ser un **evento supermasivo** al estilo **Tony Robbins**, o un **evento cerrado** en un espacio para un grupo chico de personas, según lo que hayas elegido.\n- **Grabado** — contenido que dejás registrado para que se consuma después.\n- **Escrito / audio** — y acá da el ejemplo de **Isra Bravo**, que solo manda **correos** (su especialidad es el **copywriting**), tiene la suscripción por email y además audio, y su cara no aparece en ningún lado.\n\nEl caso de Isra Bravo lo usa como un \"hermoso recordatorio\" de que no es obligatorio estar al frente de una cámara para crear contenido: hay muchísimos formatos que podés aprovechar.\n\nLa idea central es que **no tenés que elegir uno solo**. Una **oferta irresistible** puede combinar varios componentes al mismo tiempo. Como ejemplo propio menciona que ellos tienen **sesiones en vivo**, **instancias presenciales**, **contenido grabado** y **contenido escrito**, todo compaginado dentro de la misma oferta.\n\nEl criterio para decidir es simple: tenés que encontrar qué formatos le **aportan mayor valor a tu nicho** y a tu **avatar de cliente ideal**. No se trata de elegir el que más te gusta a vos, sino el que mejor sirve a la persona que querés servir.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 41,
        "vn": 7,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Velocidad y Conveniencia",
        "cardDesc": "",
        "videoId": "1iy_Is5XXYFS9ceHZb9IUHptBmI3-rFmO",
        "resumen": "Esta clase, dentro del armado de la **oferta irresistible**, te enseña a preguntarte dónde podés meter **velocidad y conveniencia** en lo que ofrecés. Sofía lo apoya en la **ecuación de valor**: la parte de abajo busca reducir a cero (lo más posible) el **tiempo** y el **esfuerzo** que le demanda a tu cliente llegar al resultado. La idea fuerza es que **\"lo rápido le gana a lo gratuito\"**: por eso existe algo como **Uber**, donde la gente paga por moverse cinco, siete o diez cuadras que podría caminar. Lo conveniente y lo veloz vale más que lo gratis.\n\nDespués baja a ejemplos concretos de cómo agregar ese factor y, de paso, generar un **upsell** o un componente nuevo del negocio:\n\n- **Soporte VIP 24/7** — un nivel por encima del que ya tienen tus clientes, ofrecido como opción para que ellos elijan.\n- **Dos opciones en vez de una** — acá mete un punto psicológico clave: si le ponés al cliente una **única opción**, la elige pero además arranca con objeciones y mil consultas sobre ella. Si le ponés **dos** (por ejemplo, el soporte rápido/conveniente contra el regular), deja de cuestionar y pasa a elegir cuál le conviene más. Así el cliente mismo **sube su propio ticket** con algo que vos ya identificaste que potenciaba tu oferta.\n\nLo ilustra con la anécdota de la **sastrería**: dejó unas prendas para arreglar, se olvidó, y hoy siente el \"dolor\" de tener que volver hasta allá. Si en el momento le hubieran ofrecido un **servicio a domicilio** (\"pasamos a buscar en 10, 15, 20 minutos o una hora\"), habría dicho que sí al toque. Ese tipo de detalle **te separa del mercado**.\n\nEl cierre es el norte de todo: identificar los puntos donde sumar velocidad y conveniencia para **competir en una categoría de uno**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 42,
        "vn": 8,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Duración del Servicio",
        "cardDesc": "",
        "videoId": "1iGG-OmBYppWKlJxuu0d5fogGgfv_P0KA",
        "resumen": "Esta clase se pregunta **cuánto tiempo va a durar tu servicio** y repasa los distintos formatos para cobrarlo dentro de tu oferta irresistible.\n\n- **Formato de por vida (lifetime)** — pagás una vez y accedés de por vida a todo el contenido, incluido lo que se cree en el futuro. Se recomienda para **cursos de ticket bajo** donde apuntás a volumen de personas, y para modelos donde ya tenés proyectado seguir aportando \"pastillas de contenido\" durante años. Ejemplo: **Leandro Ladeira**, referente de Paid Media en Brasil, que en **Black Friday** corre una oferta de \"acceso perpetuo vitalicio\". Un detalle clave: al vender, se compara consigo mismo (cómo sería comprando de la forma normal vs. sumando el lifetime), no con el mercado, y arma un **stack / apilado de ofertas** con componentes como \"vende todo el santo día\" (pensado para que la gente deje de depender solo de lanzamientos y tenga ingresos estables y sanos).\n- **Suscripción / membresía / mensual** — si vendés mensual, Sofía recomienda no cobrar realmente mes a mes sino llevarlo a **pago anual o por bloques** (cada 3 o 6 meses). ¿Por qué? Para evitar el **churn** (bajas) y la gestión que genera perseguir cobros mensuales; además, cobrar anual te da **liquidez y flujo de fondos inmediato**. Ejemplo **IMAGATSI/IMAN**: se presenta mensual (**$125**) pero se paga anual (\"guardá tu lugar\").\n- **Bootcamp / programas / consultorías** — formatos de varios meses, como el propio Mastery. Ejemplo **Sander** (Memoir e Isley), que sigue desde 2020: empezó con un bootcamp de 10 personas sobre **UX/UI**, en vivo y grabado, y hoy corre unos 10. Recién hace poco sumó una suscripción mensual de menor valor para captar a quienes todavía no pueden pagar los bootcamps (**$3000 a $6000**, tres meses de duración) y escalarlos por la **escalera de valor**.\n\nRegla final: no cobrar mensualmente, siempre de forma anualizada.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 43,
        "vn": 9,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Entregables",
        "cardDesc": "",
        "videoId": "1TEJj9MxRTobBY0jrv_5nl-vHHP8rIGk_",
        "resumen": "Esta clase te enseña a identificar tus **entregables**: todo lo concreto que se lleva tu cliente cuando accede a tu programa. Sofía aclara desde el arranque que ya hiciste medio camino en el paso anterior, cuando armaste tu **oferta irresistible** transformando cada problema de tu cliente en una **solución específica**. Con esa lista de soluciones en mano, ahora derivás los entregables uno por uno.\n\nLa distinción central es que **entregables no es lo mismo que bonos** — son dos cosas separadas, y los bonos se ven más adelante. En su propio programa, **Master**, los entregables incluyen:\n\n- **Programa paso a paso** — el contenido central, módulo por módulo.\n- **Plataforma digital** con documentos y planes.\n- **Mentores a disposición** y **mentoría 1 a 1**.\n- **Sesiones grupales semanales** con expertos y consultoría en vivo.\n- **Comunidad exclusiva**, **app exclusiva** y sesiones grabadas.\n\nPara que lo veas montado en una plataforma real, muestra varios ejemplos. Una página de un programa suyo de **2023** (todavía no publicada) donde el mensaje le habla directo al **dolor** de la persona, se listan todos los módulos, las sesiones grupales en vivo, la **comunidad privada en Telegram**, el precio y las formas de pago; ahí los bonos aparecieron recién dos días antes de cerrar inscripción, usados para incentivar la venta. También cita el programa **Launchpad de Tony Robbins** (entrenadores, módulos, ocho semanas en vivo guiadas, un evento en vivo, y luego los bonos) y el caso de **Leandro Ladera**, que enumera \"entregable uno, dos, tres, cuatro\" — cursos, una inmersión, un evento en vivo — antes de pasar a sus bonos.\n\nEl patrón es siempre el mismo: primero mostrás todo el **stack** de entregables, después separás los bonos. La tarea concreta de la clase es que identifiques con detalle cuáles van a ser los entregables concretos de tu oferta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 44,
        "vn": 10,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "La Importancia de los Bonus",
        "cardDesc": "",
        "videoId": "1_CaF19VU6zVnSSV8uCvr_q-2gvklE-Nh",
        "resumen": "Esta clase va sobre los **bonos** (o **bonus**) y por qué son una pieza obligatoria de tu **oferta irresistible**, sin importar si sos consultor, coach, educador o agencia. La idea central: **el bono siempre te diferencia del resto del mercado**, y podés mostrarlo en un lanzamiento, en un landing o en una charla con el cliente.\n\nSofía baja varias reglas concretas:\n\n- **El bono tiene que ser de gran valor** — nunca algo de valor bajo; idealmente el bono debe ser percibido como más valioso que el entregable principal.\n- **Presentalo después del precio** — así incrementás el valor percibido; muestra entregables, luego precio y recién ahí los bonos.\n- **Bonos en vez de descuentos** — la regla general es no bajar precios (ni en Black Friday o lanzamientos), sino sumar complementos; bajar precio solo se usa para quitar fricción, y eso se ve en la sección de precio.\n- **Que resuelvan los dolores del cliente** — si ya mapeaste los **\"dólares\"** (dolores) en el armado de la oferta, crear bonos es simple. Ejemplo: una **guía práctica para incrementar ingresos en dos días** cambiando cómo presentás precios, con un **script** de venta.\n- **Ponele un nombre propio** — le da mística (ej. \"cinco pasos infalibles para incrementar 100x tu negocio en dos semanas\").\n- **Aportá pruebas y asignale un precio tachado** — mostrás cuánto vale y que lo recibe gratis.\n- **Listas y herramientas plug and play** — ahorran tiempo, trabajando la parte de abajo de la **ecuación de valor**.\n- **Generá urgencia** — el clásico \"si comprás en las próximas 24 h accedés a este bono\".\n- **Alianzas** — transformá lo que ofrece otro experto en un bono, vía afiliación o posicionándolo con tu comunidad.\n\nComo ejemplos reales cita un **workshop para 70-80 dueños de franquicias** donde sumó tres especialistas como bonos (bajo costo para ella, alto diferencial), y landings de **Negocios Exitosos**, **Roszno/Grazioso y Tony Robbins** (con el \"Rocket Fuel Bonus Model\") y **Leandro Ladera**, que nombran y valorizan cada bono.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 45,
        "vn": 11,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Cómo Cobrar tus Servicios",
        "cardDesc": "",
        "videoId": "12nE44X05tMlZPb1mDuW0nQflID2aSNt6",
        "resumen": "Esta clase te enseña **cómo cobrar tus servicios** dentro del armado de tu oferta irresistible, un adelanto de lo que después se profundiza en ventas. La regla base: apuntá siempre a **un solo pago** y no ofrezcas cuotas de entrada, sobre todo cuando la venta es hablada (vos, un closer o un vendedor cerrando en una llamada), distinto al caso de una landing donde la persona compra sola. ¿Por qué un pago? Te asegura **liquidez inmediata** y evita el riesgo de entregar el servicio y que el cliente después no pague.\n\nLa táctica concreta al presentar el precio:\n\n- **Decilo con confianza** — sin titubear, y quedate callado mirando al cliente. Esperá su reacción para detectar si hay fricción.\n- **Sin fricción** — avanzá y cerrá ahí mismo, idealmente en la primera llamada.\n- **Si necesita consultarlo** (por ejemplo con un socio) — no es fricción, es que tenés que profundizar para ayudarlo a decidir.\n- **Con fricción real** — quiere decir que deberías estar cobrando mucho más (se ve en precios); repreguntá y recién ahí ofrecé plazos.\n\nSi vas a dar plazos, buscá siempre **más del 50% al inicio** y que la primera cuota sea la más grande: **50% ahora y 50% a 30 días**, o esquemas tipo **50/30/20** o **50/40/10**. Nunca estirés el cobro; menciona el caso de un líder que cobraba **50% ahora y 50% a los seis meses** como error a no repetir.\n\nPor último, el **cobro por resultados**: la forma más fácil de volver la oferta un **no-brainer**, tan buena que el cliente se sentiría tonto diciendo que no. Ejemplos: **Alex** llenando gimnasios y quedándose con el primer mes; **Kado**, lanzamientos de **+$20 millones** llevándose **3 a 18%**; y **David**, lanzamientos por historias de Instagram quedándose el **50%** del resultado. Cobrar por resultados te ubica en una **categoría de uno**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 46,
        "vn": 12,
        "grupo": "Oferta Irresistible · Armado de la Oferta",
        "modulo": 4,
        "titulo": "Garantía Irresistible",
        "cardDesc": "",
        "videoId": "1VSzFbuMP_kWrEG9tRQL4Ywq0GfIoX5oJ",
        "resumen": "Esta clase va sobre cómo usar la **garantía** para bajar la fricción de compra y cerrar más ventas. Sofía arranca con una frase que le escuchó a **Alex Hormozi**: *si la garantía no te mantiene despierto por la noche, no es lo suficientemente buena*. La idea es que una buena garantía te obliga a cumplir todo el valor que prometiste con tu oferta irresistible.\n\nDos aclaraciones clave que hace:\n- **No es obligatorio tener garantía** — pero si la tenés, aumenta como mínimo un **50%** la cantidad de gente que dice que sí.\n- **Ya podés ofrecer una** con los recursos que tenés hoy; muchas veces la oferta no se vende porque el cliente la ve riesgosa y solo necesita algo que la respalde.\n\nCuenta que su equipo siempre otorgó garantías desde el día uno. Vendiendo cursos autogestionados (ticket bajo, alto involucramiento del cliente), usaban garantía **\"no questions asked\"** para bajar la barrera de entrada y asegurar la compra en volumen. Aclara que se puede vender cualquier cosa con buen marketing, pero el foco es que el servicio sea tan bueno que el cliente no se sienta tonto diciendo que no.\n\nDespués detalla los **tipos de garantía**:\n- **Sin garantía** — venta final, típica en educación donde el acceso no se puede \"devolver\".\n- **Incondicional** — devolución sin preguntas.\n- **Condicional** — atada a términos y condiciones; el gatillo se dispara si se cumplen ciertos hitos.\n\nPara la condicional da un abanico de ejemplos que podés combinar: **reembolso total**, **reembolso excesivo** (te devuelvo tu inversión más un extra, ej. +$2000), **garantía de servicio** (seguimos trabajando hasta lograr el objetivo), **servicio modificado** (sumo recursos/equipo), **basada en crédito**, **servicio personal** (te ayudo uno a uno), **hotel y pasaje aéreo**, **liberación del contrato** y **pago diferido** (cortás las cuotas siguientes). En **MasteryHaus** combinan reembolso total con garantía de servicio. El cierre: armá tu garantía según tu servicio, hitos y entregabilidad; las garantías dan valor, bajan la barrera y incentivan a comprar.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 47,
        "vn": 1,
        "grupo": "Oferta Irresistible · Precios",
        "modulo": 4,
        "titulo": "Precios",
        "cardDesc": "",
        "videoId": "13RkRMtBzqB7gvRYCY-dHFo6hZxiePF00",
        "resumen": "Esta clase va sobre cómo **poner el precio** dentro de tu oferta irresistible. La idea central: el precio tiene que generar una **gran discrepancia entre el valor percibido y el precio** que le mostrás al cliente. Ojo, no significa que el precio sea bajo, sino que el valor sea altísimo. Sofía insiste en que no tengas miedo a **aumentar los precios**: lo más probable es que hoy, con lo que ya vendés, puedas subirlo, porque no lo hacemos por razones lógicas sino psicológicas (creés que no vale, que hay algo mejor, que no te lo van a pagar).\n\nEl método concreto: subís el precio hasta el **punto de pequeña fricción**. Ni tan alto que no compre nadie, ni tan bajo que te digan que sí al toque. Esa fricción atrae a los clientes que realmente querés. Primero generás **volumen** con la oferta validada; recién después, con caja y flujo, agregás otra fricción sacando entregables o bajando la periodicidad (de acompañamiento semanal a mensual).\n\nEnseña los **tres errores** al fijar precios:\n- **Copiar a la competencia** — que muchas veces no factura nada.\n- **Cobrar por tiempo o costo** — el precio va por la **transformación/resultado**, nunca por hora.\n- **Bajar el precio para inflar el valor percibido** — te volvés un commodity.\n\nCita a **Dan Kennedy**: no hay beneficio en ser el segundo más barato, pero sí muchísimos en ser el más caro. Da su propio ejemplo: su segundo cliente le pagó **$14.000 por tres meses**, trabajando **3 horas por semana**; por hora nunca hubiera llegado a ese número.\n\nBajar precios reduce la inversión emocional, atrae a los peores clientes (los que regatean) y destruye el margen. Subirlos hace lo opuesto: más compromiso, mejores clientes, mayores márgenes y flujo para reinvertir y **escalar**. La meta no es tener muchos clientes, sino **ganar la mayor cantidad de dinero**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 48,
        "vn": 2,
        "grupo": "Oferta Irresistible · Precios",
        "modulo": 4,
        "titulo": "Cuatro Variables Para Definir Precios",
        "cardDesc": "",
        "videoId": "1WciyuqYPfUTwM0rN247UPU13rwmktRCn",
        "resumen": "Esta clase te enseña a fijar el precio de tu **oferta irresistible**: que el cliente perciba un valor muchísimo mayor que el precio, lo que no significa cobrar barato sino cobrar bien y dar mucho valor. Para definir un precio correcto y alto, Sofía plantea **cuatro variables**:\n\n- **El piso** — tus **costos**: marketing, equipo, entrega del servicio, plataformas, fees de transacción. Si vendés al costo o por debajo, el negocio quiebra. Apuntá a **márgenes de más del 60%**, es decir, mínimo un 60% entre el piso y el precio.\n- **El techo** — el **valor percibido** por tu cliente, todo lo que tu oferta le otorga (ya lo trabajaste al armar la oferta).\n- **El contexto** — la **competencia** y el mercado. Mirá lo que hay alrededor, pero no fijes tu precio copiando a los demás: la mayoría promedia a otros negocios y baja un poco, y así se convierte en **commodity**, vendiéndose barato mientras da mucho valor.\n- **La fricción** — la **vendibilidad**, los contornos del precio.\n\nCon la fricción se manejan **tres niveles**. Al lanzar, buscás la **menor fricción posible** para conseguir volumen de clientes (sin titubeos, cuotas ni plazos, y en la mayoría de los clientes, no en uno solo). Una vez que tenés volumen, casos de éxito y estás posicionado, agregás **un poco de fricción**: subís el precio, sacás entregables, dejás las sesiones uno a uno. Pero **nunca demasiada fricción**: no sirve cobrar $50.000 si lo paga una sola persona; buscás el punto donde hay una pequeña fricción y aun así la mayoría dice que sí.\n\nRecordá validar con muchos clientes, no con una o dos experiencias sesgadas. Cierra con su historia: pudo hacer un **por 10** en el negocio cuando se rodeó de gente con su misma experiencia que cobraba **10 veces más**, y así naturalizó cobrar más por servicios que ya tenía.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 49,
        "vn": 3,
        "grupo": "Oferta Irresistible · Precios",
        "modulo": 4,
        "titulo": "Aumentos de Precios — Recomendaciones",
        "cardDesc": "",
        "videoId": "1Ksvnpot3mPBavW7QkcB15cO2NZOamstM",
        "resumen": "Esta clase va sobre **subir precios** como la palanca más rápida para aumentar tu rentabilidad, antes incluso de desarrollar tu oferta irresistible. La idea de fondo: la mayoría **sobreestima la elasticidad de su precio**, o sea, cree que un aumento va a hundir las ventas, y no es así. Casi siempre tenés mucho margen para cobrar más con el mismo servicio que ya ofrecés.\n\nEl método central es **subir hasta sentir una pequeña fricción**. Esa fricción se detecta cuando el cliente te pide cuotas, descuentos o facilidades de pago; y cuando directamente no compra, ya hay demasiada fricción. Clave: no decidas por **casos aislados**. Lo que dice un solo cliente (y menos si no es tu avatar de nicho dorado) está sesgado; validá con un grupo. Además, cada dólar que sumás es **100% de ganancia**, porque no aumentás tu costo operativo.\n\nLas recomendaciones concretas que da:\n\n- **Los precios son reversibles** — si subís y las ventas caen, volvés a bajar sin drama. A quien pagó más, le compensás la diferencia (ej. de $600 a $400, esos $200) acreditándola en otro servicio.\n- **El precio debe ser proporcional al valor** — si el valor percibido no acompaña, sumá bonos y garantías para elevarlo.\n- **No subestimes tu valor** — tendemos a bajar el precio por no ver lo que aportamos; por eso el ejercicio de dolores viene antes que precio y nicho.\n- **No cambies varias cosas a la vez** — si subís precio y a la vez tocás anuncios, copy o landing, no vas a saber qué causó el cambio en ventas.\n- **Aumentá de forma escalonada** — probá un +20% con un cliente, si no hay fricción vas con otro y subís otro 10-20%, hasta dar con el punto de fricción sobre varios clientes.\n- Si tenés miedo, aplicá la estrategia del módulo de mentalidad: **definí tus miedos, no tus objetivos**.\n\nCierre: seguramente tenés margen ahora mismo, subí precios y anotá tus resultados.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-oferta-irresistible",
          "mh-libro-de-precio",
          "mh-psicologia-de-ventas",
          "mh-compaginador-de-oferta-productivizacion"
        ],
        "herramientas": []
      },
      {
        "n": 50,
        "vn": 1,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Validación de la Oferta",
        "modulo": 5,
        "titulo": "Negocio de Alto Valor — Componentes",
        "cardDesc": "",
        "videoId": "1pyDf_v77hSMRuUBxJO--zNgGPgWIx21k",
        "resumen": "Esta clase abre el módulo de **validación** y responde a la pregunta que trae a casi todo el mundo: ¿cómo escalo mi negocio de alto valor? La tesis de Sofía es que antes de escalar tenés que sentar **bases sólidas** (nicho, oferta y una **validación robusta** vendiendo tu programa de alto valor). Si escalás antes, te comprás problemas de **fulfillment** (entrega del servicio), **cash flow** y **equipo**, y terminás quemando marca y credibilidad.\n\nUn negocio así tiene potencial de facturar cientos de miles y hasta **millones por mes**. Trae ejemplos por mercado: **dinero** (Iman Gadzhi, Coral Muñoz), **salud** (María Montemayor, Joe Dispenza), **felicidad** (Tati Arias, Jay Shetty) y **relaciones** (John Maxwell, Logan). Todos usan la misma fórmula; lo que los diferencia es la **consistencia en el tiempo** y nutrir marca y posicionamiento —eso hace que vender sea muchísimo más fácil (ella abrió una camada mandando **un mail y 2 historias**, y aplicaron **300 personas**).\n\nEl camino tiene tres pasos:\n- **Armar la fórmula** — nicho, oferta, precio, funnel, servicio y transformación (la \"fórmula de la Coca-Cola\"); ya está todo menos el funnel.\n- **Validar** — buscar el **fórmula market fit** (su nombre para el product market fit/prueba de concepto): fit entre tu fórmula y el mercado.\n- **Escalar** — recién cuando ya tenés armadas las máquinas de entrega, de captación y de conversión.\n\nDespués presenta los **cinco componentes** de un negocio de alto valor y desarrolla dos:\n- **Atracción** — traer audiencias frías. Orgánico (redes, podcast, entrevistas), pago (**shoutouts**, Google) y prospección (DM, WhatsApp, mails). Hay **lead** cuando tenés un medio para contactar a la persona (concepto de **Alex Hormozi**).\n- **Nutrición** — construir vínculo y posicionamiento con contenido corto (Reels, Shorts, TikTok), largo (YouTube), **podcast**, **newsletter** (tiene una campaña que solo suma suscriptores al newsletter dominical) y respondiendo siempre los mensajes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 51,
        "vn": 2,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Validación de la Oferta",
        "modulo": 5,
        "titulo": "Ejemplos de Componentes",
        "cardDesc": "",
        "videoId": "1JJMp991m5zjE4DP6A6CPs-Jj0Ee8eN6a",
        "resumen": "Esta clase es un recorrido práctico de cómo se conectan **todos los componentes** de la oferta usando el propio negocio de Sofía como ejemplo vivo.\n\nArranca con la **atracción**: un post carrusel sobre libros cuya primera placa es una foto suya (las imágenes generan más interacción) que deriva al **podcast**, buscando sobre todo que la gente lo **comparta y guarde** para llegar a quienes todavía no la siguen.\n\nSigue la **nutrición**, que reparte en tres canales según cómo cada persona consume contenido:\n- **YouTube** — videos largos (pasaron de 3-6 min a 20-30 min) para que el que se sienta a aprender conecte de verdad; formato imagen/video.\n- **El \"cortito\"** — un correo de los domingos, corto pero accionable, pensado para generar vínculo y no vender; formato texto.\n- **Podcast** — episodios cortos que invitan al *binge listening*, con ~**89% de engagement**; formato audio.\n\nDato clave: el **40%** de quienes compran ya estaban suscritos al newsletter antes, y a los ~3 meses en \"el cuartito\" convierten.\n\nEn **conversión**, muestra que para abrir MasteryHaus hicieron algo simple: **2 correos + 1 historia**, sin landing, un **formulario de aplicación**, luego **triage** de los leads que cumplían los checks del cliente ideal y **llamada con closer** usando el **script de ventas infalible** del Masterclass. El nuevo lanzamiento será un evergreen con **VSL + casos de éxito + agendar llamada**.\n\nConsejos: dejate un margen (a ellos les llevó **dos meses**) porque **salís a vender sin el programa terminado**; la clave es **setear expectativas** con fechas claras y el cliente se adapta.\n\nPara el **servicio** eligieron **Circle** tras comparar Skool, Teachable, Podia, BuddyBoss, LearnDash y Discord, y usan un **template de tareas en ClickUp** (agendar grabación, crear presentación, grabar, editar, subir, revisar, publicar) replicado por módulo.\n\nCierra con la **transformación**: grabar y guardar en un *vault* **todos los testimonios y capturas** desde el día cero para alimentar remarketing y potenciar la venta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 52,
        "vn": 3,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Validación de la Oferta",
        "modulo": 5,
        "titulo": "Etapas de Validación",
        "cardDesc": "",
        "videoId": "1IwvLAUcxk3ZGiMPbcBeM0yhCUsCGmlDt",
        "resumen": "Esta clase cierra el momento de **validación de la oferta**: Sofía explica que hasta no tener validados **nicho, oferta y precio** no conviene avanzar, porque si no te comprás un montón de problemas. Recorre las **tres etapas de validación** que tenés que transitar:\n\n- **Etapa 1 — Validar el mercado** (nicho, oferta y precio) — confirmás que hay personas que desean la transformación que identificaste *y* que tienen **poder adquisitivo para actuar**. Avisa contra los emprendedores que tienen \"un hobby caro\" y hacen caridad con su negocio core: buscá clientes que puedan pagar. Se valida **cuando te compran**, y en esta etapa vendés vos (todavía no necesitás un closer).\n- **Etapa 2 — Validar el funnel** (atracción, nutrición, conversión) — chequeás si tu hipótesis funciona; si falla, desglosás qué parte falló (la atracción, el form, el filtro, la llamada). Se valida cuando comprás la cantidad de clientes estimada: apuntá a un rango de **3 a 20 clientes** (3 a 10 está muy bien).\n- **Etapa 3 — Validar el servicio y la transformación** (tu valor) — se valida cuando ya entregaste y tenés los **casos de éxito documentados**.\n\nEl proceso es **iterativo**: versión 1, 2, 3, hasta poder \"abrir la canilla\" y escalar en automático, lo cual promedia **un año**, aunque antes ya podés tener versiones que generen cash flow.\n\nUsa la metáfora de la **baraja**: cada variable (nicho, oferta, precio, funnel, servicio, transformación) es una carta; si cambiás una, te cambia el juego. Lo ilustra con su propio negocio: **Versión 1** — nicho \"empresas que quieren crear una unidad de negocios\", consultoría done-for-you a **$14.000** por tres meses, funnel boca a boca, un cliente terminó facturando **$500.000** pero sin documentar. **Versión 2** — nicho amplísimo (emprendedores que quieren potenciar su negocio), curso grabado + templates + consultoría grupal cada 15 días a **$250**, funnel con ~10.000-15.000 seguidores y formulario de aplicación con el que cerró **20 personas** ella misma.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 53,
        "vn": 4,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Validación de la Oferta",
        "modulo": 5,
        "titulo": "Responsables del Proceso de Validación",
        "cardDesc": "",
        "videoId": "1o0KAgLYYQrMexIAjynRpglyO8YlbrlrS",
        "resumen": "Esta clase, del módulo **Validación de la Oferta**, responde una sola pregunta: **¿quién ejecuta el proceso de validación?** Y la respuesta que Sofía martilla de principio a fin es: **vos, y nadie más**. Es un video corto y deliberadamente repetido porque el punto es tan importante que lo quiere dejar sin ninguna interpretación posible.\n\nLa idea central es que, en esta etapa, **no metés equipo**. Todo lo hacés vos:\n\n- **SEO** — atraer y ser encontrado lo hacés vos.\n- **Content** — el contenido lo generás vos.\n- **CTR / atracción de clientes** — vos.\n- **Close (ventas)** — vos cerrás.\n- **Entrega del servicio** — vos.\n\nNada de esto se lo delegás a un **setter**, un **closer**, un **account manager** ni un **content**. ¿Por qué? Porque si vos mismo no sabés cómo hablar con tus clientes, cómo vender tu oferta, cómo entregar el servicio y cómo atraer gente, **no hay forma** de que después contrates a alguien y funcione. No podés pedirle a un tercero que haga algo que ni vos sabés hacer todavía.\n\nDe ahí sale la enseñanza más filosa de la clase: **si el equipo no funciona, no es culpa del equipo, es tuya, siempre**. Sofía cuenta que escucha seguido a dueños quejándose de que \"esta persona no vende, no funciona\", y ella les pregunta: **\"¿Y vos vendiste?\"**. La persona que contratás no armó la oferta, no tiene el **ADN del negocio**, no tiene tu experiencia ni el vínculo con los clientes; vos la contrataste, la formás y la desarrollás, así que la responsabilidad es tuya.\n\nEl mensaje final es de dueño: **own it**. Estás liderando el negocio, entonces tenés que dedicarle tiempo y esfuerzo y aprender a hacerlo vos primero. Y si no estás dispuesto a eso, mejor dedicarse a otra cosa, porque el negocio necesita que vos lo hagas.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 54,
        "vn": 1,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Funnels y Estrategias",
        "modulo": 5,
        "titulo": "Funnel 100K",
        "cardDesc": "",
        "videoId": "1qZ8Rs8As0072KsTSLYtM7XqogZ4xzR79",
        "resumen": "Esta clase, **\"Funnel 100K\"**, te muestra el \"big picture\": el embudo completo que lleva a un negocio a facturar más de **$100.000 de MRR** (ingresos recurrentes mensuales), un sistema que Sofía dice tener implementado al **90%**. La idea es que veas el destino final antes de armar los funnels más chicos de la etapa de validación.\n\nEl funnel se lee de arriba hacia abajo y se apoya en tres mecanismos encadenados:\n\n- **Mecanismo de tráfico (top of funnel)** — atracción en frío, dividida en **orgánico** (TikTok, Instagram, LinkedIn, Shorts, contenido corto) y **pago** (Meta, Shorts, YouTube Ads). La clave: un mensaje claro y tráfico consistente, que solo salen de crear contenido consistente.\n- **Mecanismo de leads (nutrición)** — a los **leads** (gente ya contactable) los nutrís con YouTube formato largo, podcasts, newsletter e historias hasta volverlos **leads interesados**. De ahí los mandás a un **VSL** (landing con video) con un CTA a aplicar o sumarse a una llamada. El **formulario hace el triage**: califica y estratifica. En la apertura de Master House los ordenaron en **3 bloques** (los top con ~99% de chance de cierre arriba, medio y bajo).\n- **Mecanismo de ventas (conversión)** — durante la llamada se hace la oferta, que tiene que ser **call friendly**. El equipo: **content** (Juan), **setter** (Mika) y **closers**. La cantidad de closers depende del volumen: en el último lanzamiento tuvieron **5**, pero en evergreen con **1 o 2** alcanza.\n\nDespués viene el cliente: **onboarding** (separado por lo importante que es), luego **entrega del servicio** (mecanismo de fulfillment, a cargo del service manager, con foco en que sea **escalable**: mentorías grupales, comunidad, contenido, roadmap). Los resultados habilitan el **upsell** al **Master Pro de $22.000**, siguiente escalón de la escalera de valor, y los casos de éxito se reciclan como anuncios. El dinero se reinvierte en marketing para que la rueda siga girando. Cierra anticipando dos variantes que verás luego: **funnel individual a llamada** (sin comunidad) y **funnel masivo a aplicación** (con comunidad).",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 55,
        "vn": 2,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Funnels y Estrategias",
        "modulo": 5,
        "titulo": "Funnel Cálido Individual a Llamada (sin comunidad)",
        "cardDesc": "",
        "videoId": "1iWeTkHlwA6VTjED9GdzuooBjCrDp1y43",
        "resumen": "Esta clase te muestra el **funnel cálido individual a llamada**, pensado para arrancar cuando no tenés comunidad, base de datos ni leads. La premisa: todos tenemos acceso a leads, y en la etapa de **validación** te enfocás únicamente en **público caliente**, sin hacer nada de top-of-funnel. Todo lo hacés vos, uno por uno, para adquirir los datos y la experiencia.\n\nEl punto de partida es el **low hanging fruit**: elegís la plataforma donde tengas más contactos (WhatsApp, tu lista de mails, redes personales, LinkedIn, ex clientes) y calificás quiénes entran en el nicho de tu oferta. A esas personas les escribís un mensaje **muy personal** — entrás a sus redes, ves en qué andan (\"vi que tuviste un bebé, felicitaciones\"). El ejemplo que da: mujeres empresarias con familia reciente y sobrepeso, para un programa high ticket.\n\nLos pasos concretos:\n- **Conversar como un ser humano** — 3 a 4 intercambios por chat, o 3 a 4 minutos por llamada, sin actuar como robot (el error clásico del **setter**, que solo busca setear).\n- **Oferta indirecta** — le preguntás \"¿conocés a alguien que esté esperando tal resultado?\", apoyándote en tu **ecuación de valor**, garantía y testimonios. Al no venderle directo bajás la fricción; ganás en los tres casos (muestra interés, te refiere, o nada — igual validás y optimizás tu mensaje).\n- **La llamada** — usás el **script de ventas** que está bajo el video y lo iterás llamada a llamada hasta cerrar.\n\nPara implementarlo: **30 contactos por día**, con hasta **3 seguimientos** (día 1, 2 y 3; si no responde, lo dejás ir). Cita a **Charlie Munger**: \"Para conseguir lo que quieres, tienes que merecerlo\". La meta es cerrar de **3 a 10 o 20 clientes**.\n\nDe extra: **farming para escalar leads** — creás contenido de valor en Instagram (secuencia de 2 semanas), potenciás los mejores con el **botón azul** para ganar seguidores, y sumás remarketing, la estrategia del **sniper** y tu **VSL**, con el link a Calendly en el perfil.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 56,
        "vn": 3,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Funnels y Estrategias",
        "modulo": 5,
        "titulo": "Funnel Cálido Masivo a Aplicación (con comunidad)",
        "cardDesc": "",
        "videoId": "1oUVhUGwNSQfTi4So_WR7YMlXtRxJa2J1",
        "resumen": "Esta clase te enseña a armar un **funnel cálido masivo a aplicación**: cómo conseguir clientes para validar tu oferta apalancándote en gente que ya te conoce, sin atraer tráfico nuevo. La idea de fondo es el **low hanging fruit** (la fruta madura que cuelga bajo el árbol): por eso el foco está en el **middle of the funnel** —tu audiencia caliente, ya nutrida— y no en el top. Esto solo aplica si ya tenés comunidad, base de datos, algunos miles de seguidores o anuncios corriendo.\n\nEl proceso que propone Sofía:\n\n- **Publicá en todos lados** — YouTube, podcast, emails, historias, posts. El mensaje: vas a trabajar con un **grupo muy chico de personas** para llevarlas a la transformación de tu oferta.\n- **Elegí el destino** — si estás muy posicionado, mandalos directo a la **aplicación** (formulario); si no, armá una **web súper simple** con un video tuyo hablando del valor. En ambos casos, sí o sí responden preguntas.\n- **Triage o calificación** — analizás lo que dejaron. Ejemplos de preguntas: facturación mensual, margen de ganancia (si no lo sabe calcular, mala señal), tipo de cliente, y si tenían **$3000** para invertir (opciones: \"sí totalmente\", \"no pero me puedo acercar\", \"no\"). Los que cumplen todos los requisitos van arriba.\n- **Llamada y venta** — subís a los mejor calificados y usás el **script de ventas** (está abajo del video), que optimizás llamada a llamada hasta que sea perfecto para tu negocio.\n\nMuestra un mensaje real de **MasteryHaus**: \"Estoy buscando a 10 líderes...\", que genera **escasez** (cupos), **exclusividad** (aplicación), **urgencia** (fecha), **intriga** (marca nueva). El copy debe enfocarse en el **sentimiento y el dolor**, no en los entregables. Cierra con su lema: es momento de accionar, aplicar e iterar.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 57,
        "vn": 4,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Funnels y Estrategias",
        "modulo": 5,
        "titulo": "Estrategia Farming de Leads",
        "cardDesc": "",
        "videoId": "136ojW-HiQHbF4SiRioNKJ_UP4tQoYoNz",
        "resumen": "Esta clase presenta la estrategia de **Farming de Leads**: cómo conseguir tus primeros clientes para validar la oferta cuando no tenés comunidad, o cuando tenés una pero necesitás reciclarla porque no aparece tu cliente ideal. La instructora aclara que enseña exactamente lo que aplicó ella, sin guardarse nada.\n\nArranca con un repaso del **funnel**: los primeros seguidores llegan por contenido orgánico y pago, pero la clave es nutrir muchísimo (contenido largo, podcast, email marketing, historias) y empujar a que vean tu **VSL/BSL** (video de ventas), porque los leads más calificados siempre venían de haberlo visto.\n\nComo es una estrategia masiva (pueden llegar **50 a 100 personas por día**), primero tenés que preparar la casa:\n\n- **Optimizar el perfil** — frase ABC / propuesta única de valor, historias destacadas o posteos pineados con tu historia, cómo ayudás y casos de éxito. Optimizá todas tus redes, no solo Instagram, y actualizá el perfil constantemente.\n- **Planificar contenido** para los próximos **15 días mínimo**, repartido **70% comunidad / 30% venta** (antes era 50/50). El de comunidad (viralidad, hábitos, mentalidad, educación) genera engagement porque la gente le compra a las personas; el de venta presenta la oferta sin que se note.\n\nEl video de venta (\"venta 90\") tiene que nombrar el **dolor específico**, **segmentar** bien el nicho (grupo específico con un dolor específico) y tener **call to action**; es el que se pauta. Muestra su reel: menos de **$200 invertidos**, le trajo la mayor cantidad de clientes, súper orgánico (grabado en el patio, editado por ella misma). Su estructura: **hook** (nombra y filtra el nicho), **audiencia específica** (profundiza el dolor: vender tiempo uno a uno tiene techo), **beneficio** (cambiar el modelo y vender programas) y **call to action**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 58,
        "vn": 5,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Funnels y Estrategias",
        "modulo": 5,
        "titulo": "Estrategia Sniper",
        "cardDesc": "",
        "videoId": "1Q5pnnjOBl1_O9oBxZaBZ5_SgpSNyidwH",
        "resumen": "La clase presenta la **Estrategia Sniper**, un complemento al **farming de leads** y al funnel dentro de la etapa de evaluación y validación de oferta. La idea central es que no jugás el juego del **contenido masivo** ni necesitás miles de seguidores para vender: en vez de una escopeta que dispara para todos lados, sos un **sniper** con rifle de mira que hace **handpicked**, agarrando de a una las personas que tienen el perfil de tu **cliente ideal**. ¿De dónde las sacás? De la comunidad de otra persona: un referente, un competidor o alguien con mucha exposición cuyo público es tu cliente ideal.\n\nEl paso a paso que enseña Sofía es:\n\n- **Optimizar tu perfil** — poné la cuenta pública, editá la descripción con tu frase de CTA y los links a tu oferta (B2B o landing), y publicá cinco días de contenido de valor. Aplica a Instagram, LinkedIn, TikTok, YouTube y podcast; las primeras 10 piezas hacen que la gente se quede.\n- **Buscar referentes de tu nicho** — ejemplo de productividad para profesionales: Daniel Colombo, Adriana Pástor, la propia Sofía. Activás la campanita y todo esto lo hacés desde la computadora, no del teléfono.\n- **Revisar comentarios** de sus publicaciones para detectar clientes ideales (los que hacen o responden preguntas), y abrir cada perfil en pestañas nuevas hasta juntar **20**.\n- **Filtrar por descripción y posteos**, dar me gusta a tres o cuatro publicaciones y dejar un **comentario valioso**. Si te siguen, mandás un DM abriendo una **conversación humana**.\n\nLos números que menciona: apuntá a **100 comentarios por día**; el **10%** se vuelve seguidor, o sea 10 al día, **300 clientes ideales al mes**, que dan de 5 a 10 llamadas y 1 o 2 ventas, con **ticket de 1000 a 2000 dólares** a costo casi cero. Advertencia clave: no contactes a todos de una porque **Instagram te banea**; hacé 20 a 25 cada dos horas (por ejemplo 25 a las 9, 25 a las 10, y otras 50 a la tarde).",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 59,
        "vn": 6,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Funnels y Estrategias",
        "modulo": 5,
        "titulo": "Formulario de Aplicación a Llamada",
        "cardDesc": "",
        "videoId": "1PQ2-3LREmt_O9eLAfnt6RR2p0WnF3SqI",
        "resumen": "Esta clase te muestra, paso a paso, el **formulario de aplicación** real que MasteryHaus usa para filtrar candidatos antes de la **llamada de venta de alto valor**. Está montado en **Google Forms** (gratis, suficiente para este peso de preguntas) y acumuló **436 respuestas** con muy poco esfuerzo de difusión: un par de historias, uno o dos mails y el link en la bio de Instagram. Sofía aclara cuándo conviene **Typeform** en lugar de Google: solo si vas a usar **UTMs** (tags en los links para saber de dónde viene cada lead y, por ende, cada cliente).\n\nLa lógica central es **separar el formulario por secciones**, como capítulos de un libro: la persona siente que avanza, no ve todo de una y le cuesta más \"robar\" la info. Las secciones son:\n\n- **Datos personales y contacto** — nombre, mail, WhatsApp con código de país; campos obligatorios (los puntitos rojos).\n- **Datos del negocio** — antigüedad, qué vende (con lógica condicional: si vende productos, se descarta porque MasteryHaus es solo servicios), tipo de servicio para hacer **triaje**.\n- **Profundizar** — que expliquen con detalle qué hacen; si contestan con tres palabras, ya sabés que no ponen esfuerzo. Tamaño de equipo, **rango de facturación** y **margen de ganancia** (para saber si tienen capital y para usarlo en la venta: \"te llevo de 30% a 60%\").\n- **Dolor y deseo** — meta más grande, obstáculo mayor, si estuvieron en otro Mastermind (para leer el tipo de cliente); todo se reusa en la llamada.\n- **Autoventa** — \"entre 100 aplicantes, ¿por qué elegirte?\", compromiso de tiempo y energía, y cómo te conoció.\n\nLa **pregunta mágica** de cierre: si cuenta con mínimo **$3000** para invertir. Ese número es un ratio del precio total de **$12.000** (un cuarto o un 50% ideal para asegurar el lugar), no el precio del programa. Las opciones de monto sirven para **priorizar llamadas** y descartar o nutrir a futuro. Mensaje de fondo: decile que no a los clientes tóxicos; la paz vale más que el ticket.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 60,
        "vn": 1,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Aprendizajes y Recomendaciones",
        "cardDesc": "",
        "videoId": "1MrSH57gaxrmWLpvWvQwzYzTegi3KR1bS",
        "resumen": "Esta clase cierra el módulo de ventas y closing con **siete aprendizajes** que Sofía destiló de años vendiendo. Antes de la lista, deja una recomendación de método: mirá el módulo entero para que la información decante y conectes las partes, y volvé al contenido a medida que vas vendiendo y ajustando.\n\n- **Obstáculos vs. objeciones** — son cosas distintas: los **obstáculos** aparecen antes (en el contenido, la nutrición, las preguntas del arranque de la llamada) y son más fáciles de manejar; las **objeciones** empiezan recién cuando mostrás la oferta y decís el precio (\"no tengo tiempo\", \"no tengo dinero\", \"lo tengo que hablar con mi familia\").\n- **No te pongas reactivo** — siempre van a surgir objeciones; no discutas para tener razón. Tu rol es entender el porqué y darle al cliente toda la info en ese momento, porque si se va a pensarlo solo o a consultarlo con gente que no estuvo en la charla, no va a llegar a la conclusión correcta.\n- **Esperá y planificá el \"no\"** — hay ~**90% de probabilidad** de que digan que no en la llamada; el no no es rechazo, es el inicio de las objeciones. No te sorprendas: prepará respuestas para los no típicos de tu nicho.\n- **Grabá todas tus llamadas, siempre** — para revisarte, para formar equipo con las llamadas bien hechas y para reutilizarlas como contenido. \"Los mejores jugadores ven sus partidos pasados\".\n- **El que se preocupa más por su cliente gana** — hacer buenas preguntas y entender el dolor genera convicción, y con convicción vender es más fácil.\n- **Vender es poder** — es la habilidad de influir y dirigir; un negocio sano habilita ayudar al equipo, la familia y al mundo.\n- **No presentes la oferta si no sabés que van a decir que sí** — como una propuesta de matrimonio: testeás antes. Mantenete en el loop de **preguntas y reformulaciones**, juntando la mayor cantidad de \"sí\" posibles hasta que el cliente pida saber más y se autocalifique; recién ahí mostrás la oferta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 61,
        "vn": 2,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Ecuación de Ventas",
        "cardDesc": "",
        "videoId": "1FylDDI4Pe4zhD0sEAvfDMiRsec7oFCXX",
        "resumen": "Esta clase desarrolla la **ecuación de ventas**, la idea de que vender no es solo técnica. Sofía plantea que el **porcentaje de cierres** sale de multiplicar **habilidad × convicción**, y que la mayoría de los vendedores solo trabaja la primera pata.\n\n- **Habilidad** — qué decir, cuándo decirlo y cómo decirlo. Es lo que casi todos entrenan, pero tiene tope: va de **1 a 10** y ahí se acaba.\n- **Convicción** — saber quiénes son tus clientes, cuál es su necesidad y que tu servicio la resuelve. Cuando ves ese **match**, hablás seguro. Su desarrollo es **casi infinito**.\n\nUsa la metáfora de la **silla a la que le faltan dos patas**: si solo te apoyás en la habilidad, te caés. La convicción, en cambio, te lleva a hacer preguntas para entender al cliente. Define vender como una **transferencia de creencias**: le pasás al prospecto tu certeza de que esto lo va a ayudar. Por eso quien **es su propio avatar** vende fácil (ya vivió esos dolores), y quien no lo es tiene que preguntar mucho y hacer sus propias ventas.\n\nLa segunda parte es **unidades vendidas = seguimiento × convicción**. Si tenés convicción, le das **seguimiento** a morir. Lo ilustra con el ejercicio de viajar al pasado a convencer a tu yo de invertir todo en **acciones de Amazon**: como sabés que funciona, lo perseguís sin parar.\n\nOtra idea clave: si **sentís que tu precio es muy alto**, es porque el valor que ofrecés no está a la altura o no te sentís capacitado para entregarlo; hay una brecha entre lo que mostrás y lo que sentís. Sofía dice que cierra el **100%** de las llamadas cuando el **triage** del cliente está bien hecho. Da el ejemplo del prospecto de un programa de **$50.000** que ya factura **$500.000/mes**: ahí siente duda y se nota. Cierra recomendando pulir tu convicción, hacer un \"trimming\" de los pensamientos que te frenan, y apoyarte en tu consultor y en las sesiones de mentalidad.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 62,
        "vn": 3,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Las únicas 3 cosas a decir cuando vendés",
        "cardDesc": "",
        "videoId": "19VykCuSUkf5LYuLRxg0geyl9tsJhVbpm",
        "resumen": "Esta clase, pensada a propósito como una \"pastilla\" corta de contenido, te da una estructura simple para encarar cualquier llamada de ventas. La idea de fondo es la filosofía del equipo: **\"cómo se vería esto si fuera simple\"**, porque todo lo que simplificás mejora abismalmente tus resultados y métricas. La respuesta: en una venta solo tenés que hacer tres cosas.\n\n- **Preguntas** — tu objetivo principal es identificar dos cosas: que el potencial cliente ES el cliente que definiste, y que tu servicio realmente le sirve. Si eso no pasa, te comprás un problema vos y se lo comprás al cliente. Preguntás sobre dolor y deseos: \"contame los desafíos de tu negocio\", \"¿por qué decidiste sumarte a esta llamada?\", \"¿qué estuvo pasando en el último tiempo?\".\n- **Reformulaciones** — repetís con tus palabras lo que dijo el cliente para dos fines: chequear que entendiste bien y **generar un \"sí\"** (vas sumando síes). El ejemplo es una clienta que cuenta que subir de peso la hace sentir insegura y depresiva; reformulás: \"entonces me estás diciendo que no avanzar hacia tu objetivo te genera una gran depresión\". Sin abusar: no hacés 90 reformulaciones.\n- **Historias** — clave para alejarte a vos y al cliente de la **mente solucionadora de problemas**. En la llamada NO le des soluciones (si lo hacés, toma notas y se va), traé la historia de alguien que trabajó con vos y tuvo resultados. Esto te posiciona y lleva a la persona de la **mente de features/entregables** a la **mente emocional**. Recomienda tener testimonios a mano (menciona la plataforma **Mirror** y el video de Funnels), porque \"somos criaturas emocionales, las emociones nos venden, no la racionalidad\".\n\nCierra recordando integrar esto con el script y los siete puntos vistos antes, y mentalizarte para el \"no\": prepararte, superar objeciones e ir optimizando hacia adelante.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 63,
        "vn": 4,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Script de Ventas",
        "cardDesc": "",
        "videoId": "1LWKti7ANPJs_D6yopJ4AFxLY59AnT6Os",
        "resumen": "Esta clase presenta el **script de ventas** de la instructora: una estructura para encarar llamadas de venta de alto valor que —dice— le generó **cientos de miles de dólares**. Aclara que no lo inventó de cero: lo sacó de un programa de **Sam Ovens** (consulting.com) hace cinco o seis años y lo fue optimizando; esa misma estructura le generó millones a Ovens.\n\nPor qué usar un script y no improvisar:\n- **Optimización** — si encarás cada llamada igual, podés detectar qué cambiar, incorporarlo al script y mejorar la siguiente.\n- **Equipo de ventas** — entrenás al equipo a seguir el script y no sus corazonadas.\n\n**Preparación previa** (fundamental porque prepararte demuestra que te importa):\n- Revisar los datos del lead y saber con quién hablás.\n- Espacio tranquilo, sin interrupciones; toda tu atención en el prospecto.\n- **Configurar la grabación** (nativa de Mac, Loom, etc.); ojo con el audio en Mac, perdió cinco llamadas mal configuradas.\n- Tomar notas y avisarle al cliente que lo hacés.\n- Tener a mano medios de pago y links para **cerrar en la misma llamada** (o como máximo tres días después, con otra ya agendada).\n\n**Estructura de la llamada** por partes:\n- **Charla informal (small talk)** — baja la presión.\n- **Establecer la agenda** — le contás la estructura y te posicionás: solo trabajás con gente comprometida, podés no elegirlo como cliente.\n- **Silencios** — incómodos pero clave; el silencio cierra ventas.\n- Arrancan las preguntas: \"¿qué te motivó a aplicar?\". Si da la **respuesta dorada** (el deseo profundo), se desbloquea tu convicción. Si no, preguntas de sondeo: \"cuéntame más\", \"¿por qué existe este problema?\", \"¿qué más intentaste?\".\n- **Descubrir la situación actual**, profundizar con **curiosidad de niño (childlike curiosity)** y conseguir un **número específico** (cuánto ganás hoy, cuánto querés ganar, kilos a bajar) o un sentimiento profundo, para asociar tu servicio a ese resultado.\n- **Recopilar datos y causar dolor**: \"¿a dónde querés llevar este negocio en los próximos doce meses?\".",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 64,
        "vn": 5,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "3 técnicas de persuasión simples y efectivas",
        "cardDesc": "",
        "videoId": "1bLIwFhmscSXXCzib5EkNUxM500sUcjGz",
        "resumen": "Esta clase te enseña **tres técnicas de persuasión súper simples** para subir tu porcentaje de cierres y la cantidad de ventas, con la idea de que **cuanto más simple, mejor**.\n\n- **Curiosidad de niño** — hacer preguntas como si fueras un chico, profundizando en los \"por qué\" (\"te dijeron esto, ¿y por qué?\"). Sirve para superar objeciones (ejemplo: guiar a alguien a que reconozca que su pareja no quiere que siga viviendo con esos malestares, y de ahí proponer subir a una llamada), generar convicción, hacer el **match** entre lo que el cliente necesita y tu servicio, e identificar si tenés enfrente a la persona correcta.\n- **Damaging admission (aceptar el daño)** — jugar con el \"pero\" a tu favor. Si decís \"esto te genera más de **$20.000 por mes**, pero vas a tener que trabajar un montón\", queda pesado. Si invertís el orden (primero el esfuerzo, después \"vas a generar más de $20.000 por mes\"), se siente distinto. A eso Sofía lo llama **the magic equation**, una de las mejores técnicas para meter en tu discurso al cerrar.\n- **\"¿Te parece justo?\" (is this fair?)** — técnica de **Jordan Belfort**, el Lobo de Wall Street. La usás al presentar la garantía (\"te vamos a entregar todo esto, ¿te parece justo?\") para encadenar síes. También la podés invertir: \"después de todo el esfuerzo que hiciste, ¿te parece justo que no lo hayas logrado?\", y de ahí proponer cambiar la situación. El objetivo es que el cliente se autovenda y entre en un **estado mental positivo**.\n\nCierra pidiéndote que **cuentes tus resultados en la comunidad y a tu consultor**, y que no te quedes con los \"no\": el **sí es un win**, el **no es una oportunidad de mejora** constante.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 65,
        "vn": 6,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Objeción: \"tengo que consultarlo con mi pareja/socio\"",
        "cardDesc": "",
        "videoId": "1PgHlGA3xOUVD2j9kz639ab65wIZUcYKv",
        "resumen": "Esta clase arranca el bloque de **manejo de objeciones** dentro del script de ventas, y toma una por una: la primera es la **objeción de tiempo** y su derivada, la **objeción de pareja o socio** (\"tengo que consultarlo\"). La idea de fondo es que cuando alguien te dice que necesita chequear finanzas, rescatar plata invertida o hablar con otra persona, muchas veces en realidad todavía tiene dudas sin resolver. Por eso lo primero es **clarificar**: traerlo de vuelta y preguntar si quedó algo que puedan discutir ahora mismo.\n\nSofía propone tres preguntas guía:\n- **¿Cuánto tiempo necesitás para decidir?** — pero atada a un **frame temporal** tuyo (fecha límite de entrevistas o de sumar gente al programa).\n- **¿Cuándo va a suceder ese análisis?** — fijar día y hora exactos para revisar finanzas o hablar con el socio.\n- **¿Algo en particular necesitás pensar que podamos ver ahora?** — para recopilar preguntas y ayudar a decidir en el momento.\n\nLa **clave** es que decidan en **24 horas**, al día siguiente como mucho, y que agendes ahí mismo una llamada en ese momento exacto (con calendar enviado). Si dicen \"el lunes no puedo\", eso es un **red flag**.\n\nCuenta un **ejemplo real**: un prospecto tenía que rescatar una inversión para pagar un **programa de 6000**. Le ofreció asegurar el lugar con **3000**, no los tenía; bajó a **1000**, sí los tenía. Cerró: aseguran lugar y precio con esos 1000 hoy, y el lunes al abrir el mercado completa.\n\nPara **pareja/socio**, usa la aclaración \"¿estás all-in y solo falta la aprobación, o hay otra cosa?\" y la técnica del **niño curioso** (preguntas encadenadas: ¿tu pareja sabe?, ¿quiere que te vaya bien?, ¿estaría feliz si seguís luchando con esto?). También ofrece **sumar a la pareja o socio a una llamada** para responder sus dudas. Recomienda preguntar de antemano si es **single founder** o decide en conjunto, e incluir eso en el **formulario** para adelantarte un paso en el cierre.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 66,
        "vn": 7,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Objeción: \"no tengo el dinero / no puedo permitírmelo\"",
        "cardDesc": "",
        "videoId": "1jYZWr4HWV4HceD4koznRj7l067v9xnXH",
        "resumen": "Esta clase es puro guion de ventas: cómo manejar dos objeciones hermanas que aparecen al cierre de una llamada de alto valor, **\"no tengo dinero\"** y **\"no puedo permitírmelo\"**. Sofía las trata juntas porque están vinculadas, y arranca modelando el tono: la idea es interiorizar la forma de responder de manera natural, algo que se logra con **práctica** y leyendo el **script** con tu propio tono de voz.\n\nFrente al \"no tengo dinero\", los pasos que enseña son:\n\n- **Bajar la tensión** — respondés \"ok, está bien\", hacés silencio y validás: \"entiendo que las finanzas pueden ser un desafío, siempre hacemos nuestro mejor esfuerzo para trabajar con personas en este escenario\".\n- **Chequear el deseo** — preguntás \"¿esto es algo que realmente querés hacer?\". Si dice que no, ese no está bien y lo dejás ir. Si dice que sí, avanzás.\n- **La pregunta clave** — \"¿cómo podemos hacer que esto suceda para vos?\". Ahí lo más probable es que la persona pida cuotas o segmentar el pago.\n- **El plan de pago** — ofrecés fraccionar, por ejemplo **60% ahora** y el **30-40% restante en 30 días**.\n\nEl segundo acercamiento es confrontar con lógica: \"¿no es justamente por esto que viniste a la llamada, porque tu negocio no funciona como querés?\". Y rematás: \"entonces lo que decís es que vas a seguir haciendo lo que no te funcionó hasta hoy, ¿esa es la declaración?\". La persona o admite que no tiene sentido, o dice que va a seguir aprendiendo sola con contenido de YouTube esperando resultados distintos: ese es el **\"no\" rotundo** que buscabas, y lo dejás ir.\n\nPara \"no puedo permitírmelo\", pedís \"contame más\", recordás que ya hay **match** y que esto es lo que necesita para avanzar, y presionás con \"¿cómo vas a hacer para avanzar sin esto?\". Si igual se cierra (\"me quedo así\"), volvés a la misma pregunta: \"¿cómo podemos hacer que esto suceda para vos?\".",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 67,
        "vn": 8,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Objeción: \"estuve en otros programas y no tuve resultados\"",
        "cardDesc": "",
        "videoId": "1IjlkXJFt0QXn5cxV-D9HSajDcI8A7yuz",
        "resumen": "Esta clase es una guía de **manejo de objeciones** en ventas de alto valor, enfocada en una sola: **\"estuve en otros programas como este y aún no obtuve los resultados que quería\"**. Sofía te muestra, paso a paso, cómo responderla sin ponerte a la defensiva.\n\n- **Arrancá con una pregunta que descoloca** — le decís al prospecto: \"hay alguien en quien no confiás, y eso sos vos mismo o soy yo, ¿cuál creés que es?\". Eso lo hace profundizar y contar por qué los programas anteriores no le funcionaron.\n- **Definí el resultado concreto** — preguntá \"¿qué resultados específicos necesitás ver para que esto valga la inversión de tiempo y recursos? ¿Qué tiene que suceder?\". La respuesta te da un objetivo medible.\n- **Chequeá que lo que pide esté alineado con tu oferta** — punto clave: si te pide algo que tu servicio no hace (por ejemplo, \"que alguien venga y lo haga por mí\"), no tenés por qué acomodarte. Todo lo que diga debe estar vinculado a lo que vos ofrecés.\n- **Diferenciate de la competencia** — respondé \"eso es exactamente lo que vamos a abordar; nosotros tenemos un acercamiento completamente diferente\", y traé **historias** de casos. Preguntá también \"¿cómo fue el acercamiento que tuviste antes?\" para separarte de lo que otros hicieron mal.\n\nSofía suma un filtro de **calificación del cliente**: si el prospecto dice que fracasó en un programa muy similar al tuyo, con un negocio que sabés que funciona bien, eso es un **red flag**. Ahí hacés **doble clic** para entender si el problema no fue el programa, sino que el cliente no estuvo a la altura. Recordá que siempre va a hacer falta un **esfuerzo mínimo del lado del cliente** (comunicación, trabajar efectivamente) para que haya resultados. El cierre de la clase: hacé un doble chequeo de esta objeción.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 68,
        "vn": 9,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Objeción: \"la competencia es más barata\"",
        "cardDesc": "",
        "videoId": "1BDjcOYKRBpvah93WMd2a3ZHho5xWf5h-",
        "resumen": "Esta clase es puro **manejo de objeciones** y ataca una de las más comunes en ventas de alto valor: **\"pero la competencia es más barata\"**. La idea madre viene de una frase de **Charlie Munger** y **Warren Buffett**: **el precio es lo que pagás, el valor es lo que obtenés**. Con eso presente, Sofía te da tres formas de responder cuando el prospecto te compara con otro programa más económico.\n\n- **Ir directo al valor** — preguntale al prospecto cuánto está cobrando esa otra opción y qué ofrece exactamente. Si paga **$200** pero el retorno es casi nulo, no es buena inversión. Lo que importa es el **retorno real**: si te aseguran mínimo un **3x** de lo invertido, buenísimo; si no, lo dudás y te callás.\n- **Comparar en igualdad** — planteá \"supongamos que ambos cobramos lo mismo y damos el mismo valor, ¿con cuál marca preferirías avanzar?\". Si hiciste todo bien, te va a elegir a vos. Preguntale por qué, dejá que enumere los resultados y el posicionamiento que vos ya construiste, y recién ahí cerrás: **\"es por esa razón que no cobramos $200; si cobráramos eso, no podríamos darte todo ese valor\"**.\n\nPara reforzar, sumás **historias**. La de la **bolsa**: si tenés que invertir en dos empresas, **Amazon** (que vale 100 veces más) o una que nunca escuchaste, el retorno lo da la calidad, no el precio bajo. Y una segunda: \"¿de verdad querés pasar otros **seis meses** invirtiendo en soluciones sin resultados? ¿Creés que si fueran los mejores de la industria cobrarían $200?\". Rematás con **\"podés comprar bien o comprar dos veces, depende de vos\"**, con una sonrisa.\n\nEl punto técnico que repite como clave: después de cerrar el argumento, hacé **silencio**. Es fundamental, porque le das a la persona el espacio para procesar y dar el siguiente paso hacia el cierre.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 69,
        "vn": 10,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Script de Ventas y Objeciones",
        "modulo": 5,
        "titulo": "Objeción: \"¿tenés alguna garantía?\"",
        "cardDesc": "",
        "videoId": "16N3RERn6zuHqec_NnSlSeFkZxUP1Q33R",
        "resumen": "Esta clase es un guion para manejar una de las objeciones más comunes en una llamada de venta de alto valor: cuando el prospecto te pregunta **\"¿tenés alguna garantía de resultados?\"**. La buena noticia es que no improvisás nada: enganchás la respuesta con el trabajo previo del módulo, donde ya armaste tu **garantía irresistible**. Así que respondés con seguridad \"sí, absolutamente\" y la explicás **paso a paso**.\n\nEl corazón de la respuesta es plantearlo como un **win-win** de dos lados, un compromiso mutuo por contrato:\n\n- **Nuestra parte** — si vos hacés todo lo que te toca y nosotros cumplimos lo prometido, los resultados van a estar; es lo que venís hablando toda la llamada.\n- **Si nosotros fallamos** — si no entregamos lo prometido, se activa tu garantía concreta. Sofía da dos ejemplos: el **reembolso del 100%**, o seguir trabajando con el cliente hasta que se logren los resultados (o lo que hayas definido vos).\n- **Si el cliente falla** — si él no pone de su lado lo necesario para que funcione, **se pierde la garantía** y, obviamente, no obtiene los resultados. La garantía es de dos lados.\n\nOtra pieza clave del guion es el **gatillo psicológico del \"pero\"** (que viene de otro video): reconocés el esfuerzo antes de la recompensa. Le decís que esto va a demandar **muchísimo de él**, mucho esfuerzo, \"pero\" después va a tener un negocio que factura tanto. Ese \"pero\" invierte la carga y deja lo positivo al final.\n\nEl cierre lógico es contundente: si todos hacemos lo que hay que hacer, **no hay nada que perder, por contrato**. Y ahí viene la instrucción táctica de venta que se repite en el método: **te callás nuevamente**. Lanzás el cierre y bancás el silencio para que el prospecto procese y responda.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "mh-libro-de-validacion",
          "mh-script-de-ventas-infalible",
          "mh-estrategia-sniper",
          "mh-estrategia-farming-de-leads",
          "mh-desarrollador-de-vsl",
          "mh-funnel-individual-a-llamada"
        ],
        "herramientas": []
      },
      {
        "n": 70,
        "vn": 1,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Planificación de Validación",
        "modulo": 6,
        "titulo": "1. Planificación de Validación",
        "cardDesc": "",
        "videoId": "1UqfQXPA0seJuQ_8_PAMEHmYvxHeQmkzD",
        "resumen": "Esta clase de **Planificación de Validación** (Módulo 5, \"Validación de Oferta y Ventas de Alto Valor\") te da los pasos concretos para planificar y accionar la etapa donde empezás a **captar clientes y validar tu oferta irresistible**. Ojo: acá todavía no se crea el contenido de la oferta, solo se planifica captar y vender.\n\n**Los 5 pasos de la planificación:**\n- **1. Cantidad de clientes:** que sea **alcanzable y manejable**: entre **5 y 10 clientes**. El objetivo NO es volumen, es validar todo el journey, los scripts de venta, la entrega, la hipótesis de oferta y la de precio. Aunque tengas comunidad enorme, no captes de más (Sofía, con comunidad grande, apuntó a no más de **15** en su primera validación). **Menos de 5 es red flag**: con 5 ya recopilás datos cualitativos suficientes; hacé *stretching* para llegar a ese piso.\n- **2. Ingresos / margen:** apuntá a un **margen de ganancia del 60-70%**. En validación no corresponde invertir fuerte en anuncios, plataformas ni equipo. Si te queda 10-20-30%, la propuesta ya no cierra, porque al escalar (más recursos) el margen se evapora salvo que subas precios.\n- **3. Leads necesarios:** con un **conversion rate del 10%** (buena tasa para esta etapa), necesitás **100 buenos leads para captar 10 clientes**. Ese 10% se cumple si hiciste todo bien: creatividades y mensajes que le hablan al **avatar/dolor específico** de tu documento de cliente ideal, los funnels de captación y una oferta realmente irresistible.\n- **4. Fechas por etapa (ingeniería inversa):** primero definís la fecha de arranque de la entrega, y desde ahí hacia atrás. Recomendación: **planificación** máx. 1 semana (días), **captación** 2 semanas, **ventas** 3 semanas (total 5 semanas, que ya es holgado, apuntá a bajarlo), y **entrega** = lo que dure tu oferta (2, 3, 6 meses, un año). Si el miedo te lleva a aplazar, volvé al ejercicio de **mentalidad** (definir miedos) y apoyate en tu consultor.\n- **5. Accionables por etapa:** los vas a compaginar en un mismo **dashboard** con las tareas específicas de cada etapa.\n\n**Concepto central: \"El sentido lo creás vos\".** No es necesario ni aconsejable tener la oferta ya creada: se **construye junto a los clientes**, con instancias de feedback en el medio. Podés vender algo que arranca dentro de un mes usando escasez, urgencia, cupos y el beneficio de sumarse ahora; el cliente lo cree si hablás con confianza y le das el motivo.\n\n**Ejemplo:** cuando abrieron Negocios Exitosos y MasteryHaus, el contenido no estaba creado: solo tenían un **índice/estructura** (el one-pager de la oferta) que usaron para vender y proyectar entregables por semanas. No lo hagas mega-pro (estudio, cámara, micrófono caros): vas a tener que reeditarlo, es plata al pedo en esta etapa.\n\n**Conclusión:** validá con pocos clientes, cuidando el margen, apoyándote en números simples (100 leads → 10 clientes) y fechas cortas hechas por ingeniería inversa, construyendo la oferta *con* la gente en vez de encerrarte a crearla de cero.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 71,
        "vn": 2,
        "grupo": "Validación de Oferta y Ventas de Alto Valor · Planificación de Validación",
        "modulo": 6,
        "titulo": "2. Master Planner y Accionables",
        "cardDesc": "",
        "videoId": "1ui9u6mLi_guf6rRlJRkoSzAirUtv8xUR",
        "resumen": "Esta clase recorre en detalle el **Master Planner**, el documento (un Google Sheet) donde Sofía agrupa TODO un lanzamiento de una oferta irresistible, dentro de la **Planificación de Validación**. Su filosofía: \"simple pero bueno\", nada de complejizar con ClickUp, Notion o Airtable todavía —con este sheet ellos facturaron **más de 7 cifras en dólares**; las plataformas robustas quedan para cuando ya vendiste y querés escalar (Master y Pro).\n\n**Puntos clave que remarca:**\n- **One-pager de planificación:** nombre de la oferta, número de clientes e ingresos objetivo, fecha de inicio, link a la oferta, canales y tipo de funnel, link a la estrategia, y **links importantes** (carrito, Stripe, PayPal, Hotmart, datos bancarios, formulario de aplicación o VSL) más recursos extra pegados con \"chips\".\n- **Proyección simple del todo (no por mes):** clientes × precio = ingresos brutos; luego **costos fijos** (Canva, ClickFunnels, Zapier) vs **variables** (Stripe ≈ **13,5%/14,5%** por transacción, en columnas grises con fórmula que no se tocan) y **gastos de personas** (CEO, líder, consultor, editor; closer/setter NO contemplarlo aún) → da profit y márgenes.\n- **Accionables por etapas** con estado, responsable (chip o nombre), fecha límite, link a documentos y área encargada (o por \"momento\" si aún no tenés áreas): planificación (el \"antes\"), durante captación/venta, después, onboarding, durante el programa y final. Ejemplos de planificación: diseñar landing/VSL, pedir creatividades, **pixel de seguimiento**, crear **UTMs**, integrar con ActiveCampaign (email), configurar **banners por IP** (landing por país, ej. México en pesos mexicanos).\n- **Tablero/calendario anual por colores:** pintás la fecha de apertura y hacés **ingeniería inversa** hacia atrás (apertura, preparación/onboarding, venta, captación, planificación); ordena al equipo y avisa si te atrasás. Las **sesiones de maestría** van el último jueves de cada mes.\n- **CRM simple para seguir leads:** nombre, mail, teléfono, redes, estado (contactado 1/2/3 veces, invitado, agendada, hecha, ganado/perdido), prioridad (muy alta/alta/baja), oferta que le interesa (ej. Buildy Pro), monto, forma de pago (tarjeta, efectivo, transferencia, PayPal o híbrido), **señal**, contrato (enviado/firmado), comentarios y link al legajo en Drive.\n- **La \"señal\" para bajar fricción:** si el programa sale $6000 y el formulario filtra a quien tiene $3000, esa persona **seña con esos $3000** y a 30 días abona el resto —el número del filtro es el que ayuda a cerrar objeciones.\n- **Notas** (decisiones de equipo, ej. cambios de precio) y **Validaciones** (hipótesis a probar, ej. \"¿cerramos más con fondo negro en la llamada?\", con tareas y resultados).\n\n**Conclusión:** documentá todo lo que aprendés y probás —en su negocio rige que **\"nada se borra nunca\"** (carpetas de archivos antiguos)—. El Master Planner te da de un solo pantallazo la proyección, las acciones, fechas y responsables de tu oferta. La clave es simplificar, más en momentos de aceleración. El link para copiar el documento está debajo del video; apoyate en tu consultor y en las mentorías semanales.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 72,
        "vn": 1,
        "grupo": "Marketing Perpetuo · TikTok",
        "modulo": 6,
        "titulo": "MKT Perpetuo -12",
        "cardDesc": "",
        "videoId": "1UAYXilJwye4-InEmY0UQTzhXUBOmOyf6",
        "resumen": "En este video arrancamos con **TikTok** como una de las plataformas de **captación** dentro del funnel de **marketing perpetuo**. La idea central es entender por qué TikTok es tan potente para atraer audiencias nuevas y cómo encaja esa pieza dentro del funnel.\n\nLos puntos concretos que se mencionan:\n\n- **Es una de las plataformas más influyentes** del ecosistema digital por su capacidad de captar la atención con **videos cortos**. La gente que entra suele quedarse bastante tiempo: es muy atrapante por el formato de scrollear la pantalla y deslizar reels.\n- El **consumo ocurre en la pantalla de inicio**, y el **algoritmo está muy especializado** en mostrar contenido todo el tiempo.\n- **No importa la cantidad de seguidores que tengas.** Tu contenido se puede viralizar porque el algoritmo lo muestra constantemente a **audiencias nuevas**, sin necesidad de que sean seguidores tuyos.\n- Eso abre una **gran oportunidad de alcance masivo de forma orgánica**: podés llegar a muchos lugares del mundo subiendo **reels orgánicos** y captando gente que ni siquiera te sigue todavía.\n\nLa conclusión es que, justamente por estas características, vale la pena correr la estrategia en TikTok como **plataforma de captación** dentro del funnel, para atraer **nuevos leads**. El video funciona como introducción al tema: plantea el \"por qué\" de TikTok y anticipa que a continuación se ve **cómo implementar** esta parte del funnel para atraer esas nuevas audiencias. No se dan todavía pasos operativos ni números específicos; es el encuadre conceptual antes de entrar en la ejecución.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 73,
        "vn": 2,
        "grupo": "Marketing Perpetuo · TikTok",
        "modulo": 6,
        "titulo": "MKT Perpetuo -13",
        "cardDesc": "",
        "videoId": "1hYH0ypRqdmeFEe6wxC41ZcrdgGurKC60",
        "resumen": "Este video te enseña a **optimizar tu perfil de TikTok** dentro del funnel de **marketing perpetuo**, para que quien llega y no te conoce entienda rápido quién sos, qué valor aportás y por qué quedarse en tu entorno. La idea rectora es la **coherencia comunicacional**: todo tu perfil debe alinearse con el resto de tus plataformas.\n\nLos puntos que repasa, uno por uno:\n\n- **Nombre de usuario:** fácil de leer y de vincular con tu marca (tu nombre si es marca personal, o el del negocio). Sacá signos de puntuación para que sea fácil de buscar, y usá el **mismo nombre que en Instagram** y demás plataformas.\n- **Foto de perfil:** que represente tu marca, preferiblemente una foto tuya (las personas conectan con personas), con colores vivos identificables. Tiene que ser **la misma foto** que usás en Instagram para vincular todo.\n- **Descripción:** incluí tu **frase ABC** desarrollada, que capture la esencia de tu negocio y explique con qué se van a encontrar.\n- **Bio link:** clave en plataformas de captación. Ellos usan una **landing** (tipo Linktree) que agrupa todos los recursos: newsletter, podcast, YouTube, la aplicación. En TikTok es difícil meter call to actions (no se leen los copies ni se pueden poner links), así que dirigís todo al link de la bio.\n- **Plataformas vinculadas:** agregá accesos directos a Instagram, YouTube, etc., para mantener a la gente en tu ecosistema.\n- **Listas de reproducción:** funcionan como las de YouTube; agrupá reels por tema según tus **pilares temáticos** (ejemplos: gestión del tiempo, productividad, negocios) para nutrir con pastillas de contenido.\n\nEl objetivo de todo es dar **claridad** y evitar la **fuga de leads**: si captás atención pero el perfil no está optimizado, el esfuerzo fue en vano.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 74,
        "vn": 3,
        "grupo": "Marketing Perpetuo · TikTok",
        "modulo": 6,
        "titulo": "MKT Perpetuo -14",
        "cardDesc": "",
        "videoId": "1B3PXAaUeFG05MVyA_lpNazAg7WA_X52N",
        "resumen": "Este video de **Marketing Perpetuo en TikTok** arranca recordando la base de la estrategia: partimos de **contenidos largos**, los **fragmentamos en contenidos cortos** y los distribuimos en todas las plataformas de captación (Instagram, Facebook, LinkedIn e incluso Reels en **YouTube Shorts**). Sobre esa pirámide de contenidos, el foco de la clase es conocer los **tres tipos de contenido** que funcionan mejor dentro de TikTok, tanto para pensar los cortes de tu contenido corto como para grabar algún reel exclusivo de vez en cuando.\n\n- **Transformación:** mostrar cómo algo pasa de un **estado A a un estado B** con buen storytelling genera impacto visual y retiene a la audiencia. Ejemplos: transformaciones arquitectónicas (remodelar una casa, antes y después), decoración de ambientes, limpieza (los carteles limpiados con hidrolavadora que se hacían virales por el placer visual) y los \"cómo lo hice\", aplicables al universo de servicios y negocios.\n- **Tutoriales y consejos:** videos educativos que dan **valor rápido**, muy usados por infoproductores. Por ejemplo, \"los tres hacks para lograr tal cosa\", mostrar en pantalla cómo funciona una plataforma, o explicar apoyándote en una imagen o reel dinámico.\n- **Carruseles:** aunque TikTok es plataforma de reels, también se pueden subir imágenes. Sirven para condensar contenidos que no pudiste cortar en reel por tiempo o storytelling, explicar temas más complejos y **bajar la data a tierra**.\n\nLa clave es **probar** qué funciona con tu nicho, y una vez que identificás esos insights, volver a testearlos en otros contenidos: por eso importan la **medición e iteración**. Cierra con un recordatorio potente: **no hace falta tener millones de seguidores** para lograr alto alcance en TikTok; el juego está en adaptar estos formatos al valor que aporta tu negocio.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 75,
        "vn": 4,
        "grupo": "Marketing Perpetuo · TikTok",
        "modulo": 6,
        "titulo": "MKT Perpetuo -15",
        "cardDesc": "",
        "videoId": "1yJuMNEG4RrRlyZfbBKZNeeqn5lGpL0UV",
        "resumen": "Este video de **Marketing Perpetuo en TikTok** es un repaso de cómo estructurar contenidos ganadores y adaptarlos a la plataforma. La idea central es que en todas las plataformas hay que respetar una **estructura de storytelling**: **hook, desarrollo y desenlace**, como si contaras una historia. En TikTok, que es puramente audiovisual y donde la gente consume deslizando la pantalla, tenés muy pocos segundos para captar la atención, así que va **mucho foco en el hook** y en el \"estribillo\" para que la audiencia se quede y puedas escalar.\n\nPuntos concretos que menciona:\n\n- **Aprovechá tendencias** (canciones virales, efectos visuales de edición) para aumentar el alcance, pero sin perder **autenticidad ni imagen de marca**: no hagas un challenge por hacerlo, adaptá la tendencia a tu tono y estilo.\n- Usá **subtítulos** al editar para hacer el consumo más dinámico y aumentar la retención.\n- **Copies**: en TikTok no podés dejar links en la descripción (igual que en Instagram) y los copies no son tan legibles. Por eso, dedicá **pocas líneas, idealmente una oración**, y que lo siguiente sea el **call to action** (por ejemplo, \"mirá el video completo en mi canal de YouTube\"). El perfil tiene que estar optimizado, con un link a tu entorno para fidelizar a quien llega.\n- **Hashtags**: pensalos estratégicamente, **no más de cinco**. Evitá los mega virales (tipo *For You*), donde tu contenido se pierde entre millones. La regla: **tres hashtags bien específicos de tu nicho** (con poco contenido) combinados con **dos más genéricos** del mercado, para enviar señales al algoritmo sobre dónde clasificarte.\n\nCierra recordando tener siempre presente tu **master copy** y la estructura de contenidos ganadores, y volver a las lecciones si te surgen dudas.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 76,
        "vn": 5,
        "grupo": "Marketing Perpetuo · TikTok",
        "modulo": 6,
        "titulo": "MKT Perpetuo -16",
        "cardDesc": "",
        "videoId": "1KHi1f0LAES-slzkxQzl7Ct2-u9Ak9JTN",
        "resumen": "Esta clase va sobre **planificación y calendarización de contenido en TikTok** dentro del sistema de **Marketing Perpetuo**. La idea central: usás tres herramientas ya vistas —tu **stock de contenidos**, tu **bóveda de contenidos** y el **calendario de planificación**— para programar todo con anticipación (si tenés dudas, volvé a la lección de la **pirámide de contenidos** al inicio del módulo).\n\nEl punto de partida es la **pirámide de contenidos**: grabás un **video largo** en una jornada de grabación (unos **20-25 minutos**) y de ahí sacás **mínimo seis reels** en promedio, que después distribuís en las plataformas de contenido corto como TikTok. Así optimizás tiempo y nutrís las cuentas con fragmentos.\n\nEl método para calendarizar:\n\n- **Arrancá por la nutrición.** Definí qué día sale tu contenido largo (ej.: el **lunes** el podcast). Ese mismo día, el TikTok que publiques tiene que hablar de ese tema —un corte del reel, un carrusel, lo que sea— con un **call to action al link de la bio**, direccionando al medio del funnel.\n- **El resto de la semana**, donde no hay lanzamiento de nutrición, tirás de tu **bóveda de contenidos**: publicás piezas del stock de forma aleatoria, siempre con un call to action. Ejemplo: subir un reel de un video de YouTube de hace dos semanas, con CTA al canal de YouTube; igual estás redireccionando audiencias.\n\nLa lógica es reiterativa en todas las plataformas de contenido corto: **el contenido corto direcciona audiencias hacia el contenido de nutrición**. Captás gente nueva con el algoritmo de TikTok, la nutrís con contenido de valor y así hacés girar la maquinaria. La clave es **sistematizarlo**: planificar en base a la nutrición y jugar el resto con tu stock.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 77,
        "vn": 6,
        "grupo": "Marketing Perpetuo · TikTok",
        "modulo": 6,
        "titulo": "MKT Perpetuo -18",
        "cardDesc": "",
        "videoId": "18DTNI6AnChwYtAdyk19lr8U9kQqCD4yh",
        "resumen": "Esta clase va sobre **las métricas que tenés que mirar en TikTok** para entender si tu contenido está funcionando y por qué. No se trata de mirar números por mirar, sino de leer qué te están diciendo.\n\nLas tres métricas clave que plantea son:\n\n- **Visualizaciones**: la cantidad de reproducciones de un reel, cuántas veces lo vieron. Es un buen indicio de que el contenido funcionó, pero no te explica el porqué.\n- **Engagement**: la métrica fundamental. Es el porcentaje de interés que muestra tu audiencia. Se calcula **alcance dividido interacciones, multiplicado por 100**. A mayor engagement, mejor funcionó el video y más veces se reproduce.\n- **Porcentaje de retención**: el tiempo promedio que el usuario se queda viendo el reel, hasta qué segundo lo consumió. Una buena retención aumenta el alcance y te habla de que tuviste **buen storytelling y una buena estructura de contenido**.\n\nUn consejo práctico importante: **diferenciá los formatos**. En TikTok casi todo es reel, pero si tenés carruseles o imágenes, medí el engagement por separado para cada formato y no mezcles los datos, porque cada uno tiene un alcance distinto en el algoritmo.\n\nLa idea de fondo: las visualizaciones te dicen que el reel funcionó, pero **el engagement y la retención te explican por qué**. También advierte que las tendencias en TikTok cambian muy rápido —lo que antes era viral hoy ya no— así que hay que estar actualizado y adaptar lo que funciona a tu estrategia.\n\nComo estos contenidos cortos salen de recortar videos largos, la única forma de saber si esos cortes son efectivos es mirando las métricas. Cerrá con esta consigna: chequealas con regularidad y jugá siempre a **superar tu propio promedio**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 78,
        "vn": 1,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -01",
        "cardDesc": "",
        "videoId": "1gjWIqkLSY82mkh2PnxLnD1NYYt0kjC4d",
        "resumen": "Este primer video introduce la estrategia de **LinkedIn** dentro del funnel de **marketing perpetuo**. La idea central es ubicar bien a la plataforma: LinkedIn es una herramienta de **captación**, o sea vive en el **top of the funnel**. Su rol es atraer audiencias nuevas y direccionarlas hacia el **middle of the funnel**, que son las plataformas de nutrición: **YouTube, podcast y newsletter**.\n\nEl instructor arranca explicando qué es LinkedIn y por qué nos conviene estar ahí:\n\n- Es la **red social profesional más grande del mundo**. A diferencia de otras redes, no es una plataforma de entretenimiento, sino profesional: la gente entra a consumir contenido con la intención de aportar a su desarrollo profesional y hacer **networking**. Eso se traduce en **leads de alta calidad**, más propensos a la acción si le hablamos a nuestro nicho con el mensaje correcto.\n- **Credibilidad y confianza:** como LinkedIn se percibe como una plataforma confiable, tener presencia y una estrategia de contenidos ahí potencia tu **posicionamiento y autoridad**. Esa percepción genera mayor disposición de los usuarios a interactuar con tu contenido y, eventualmente, a convertirse en clientes.\n- **Contenido de valor y networking profesional:** permite compartir contenidos valiosos en **múltiples formatos** para educar, informar y atraer a tus leads objetivo. Además facilita el networking: podés establecer contactos, armar **alianzas y sociedades**, y apalancarte en otros creadores de nichos similares.\n\nEs más que nada un video conceptual de encuadre: deja claro el lugar de LinkedIn en el sistema y por qué vale la pena estar presente. Cierra anticipando el siguiente paso, que es ver **cómo aprovechar los recursos concretos de la plataforma** al servicio de la estrategia de marketing perpetuo. No menciona números ni ejemplos específicos todavía.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 79,
        "vn": 2,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -02",
        "cardDesc": "",
        "videoId": "1f2A3qVGlT5qKl61IOv24EEqM0LP2Ecoi",
        "resumen": "Esta clase de **Marketing Perpetuo en LinkedIn** se dedica a un solo objetivo: **optimizar tu perfil** para que quien llega y no te conoce entienda al toque quién sos, qué hacés y por qué debería quedarse consumiendo tu contenido. La idea es que el perfil transmita **profesionalismo, autoridad y confianza**, porque esas tres variables empujan el **posicionamiento** y convierten leads en clientes.\n\nElementos que hay que trabajar, uno por uno:\n- **Foto de perfil profesional**: es la primera impresión y el primer contacto con tu marca personal. Definí qué querés que el otro perciba (seriedad, calidad, unidad) y transmitilo ahí.\n- **Foto de portada**: refuerza el concepto general. Da tres ejemplos: **Alex Hormozi** (nombre de marca y libros), **Bariby** (sus marcas) y el camino elegido con **Sophie**, una foto de sus conferencias para posicionarla como **speaker**.\n- **Titular profesional**: la frase debajo del nombre. Ancla un concepto con tu marca; podés usar la fórmula **ABC (a quién ayudás)** o palabras clave que digan qué hacés.\n- **Resumen o \"Acerca de\"**: una **mini bio** con tu historia, hitos, logros y propuesta de valor; sirve para construir tu **personaje legendario** e incluir un **call to action** o link.\n- Completar **experiencia laboral, educación, conocimientos y aptitudes** (tu diferencial), **proyectos** relevantes y **recomendaciones** para humanizar la marca.\n- **Publicación destacada**: aprovechá el link fijado para dirigir la audiencia a tu plataforma de nutrición. En su caso eligen la **newsletter** (espacio de alta conversión); en el tuyo puede ser newsletter, YouTube o un B2C.\n\nConclusión: LinkedIn se usa acá como plataforma de **atracción de nuevas audiencias** dentro del funnel perpetuo. La clave es transmitir desde la primera impresión **quién sos y el valor que aportás**, con total coherencia, y trasladar a esa gente hacia tus canales de nutrición.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 80,
        "vn": 3,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -03",
        "cardDesc": "",
        "videoId": "1lVdFYszSKxBZ7Xzpt_y2Ec88KavvDAG1",
        "resumen": "Esta clase recorre los **formatos de contenido en LinkedIn** y cómo elegir cada uno según lo que quieras comunicar. La idea de fondo: **aportar valor** en todo lo que publiques, porque el **interés compuesto** de hacerlo con estrategia es lo que trae resultados. El formato también es parte de la comunicación, así que el juego es **salir a validar** qué funciona con tu nicho y encontrar tus **patrones ganadores**.\n\nLos cuatro formatos que repasa:\n\n- **Publicaciones de texto:** un posteo corto, como un tweet. Hablá siempre de tu **nicho dorado**, hacé preguntas o afirmaciones que fomenten interacción, armá debates y tópicos que generen conversación en comentarios (eso escala el alcance) e incluí **call to action** que derive a tu newsletter, YouTube, etc. Todo contenido debe tener un **propósito**.\n- **Artículos:** para profundizar ideas y usar como **contenido de nutrición**; publicándolos seguido ofician de newsletter. Reciclá tu mail semanal o el script de un video. Partí siempre de un **título/hook** con palabras clave, y usá subtítulos, listas e imágenes.\n- **Publicaciones de imágenes:** foto simple o **carrousel**. Que se entienda el propósito, usá **alta calidad**, resaltá palabras clave con negritas/subrayados y apalancate en fotos o dibujos. Se comparten más, así que potencian el alcance.\n- **Videos:** **humanizan tu marca** (reel o tu voz), porque las personas conectan con personas. Cortos, de **1 a 2 minutos**, con subtítulos y CTA. Tip: subí a LinkedIn los mismos reels de Instagram, Facebook y TikTok para bajar la barrera de entrada.\n\nConclusión: **diversificá formatos** para tocar distintas audiencias dentro de tu nicho hasta ver qué hace clic. Y no, no hace falta crear todo desde cero: se nutre bajando de la **pirámide de contenidos** (de lo largo a lo corto).",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 81,
        "vn": 4,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -04",
        "cardDesc": "",
        "videoId": "1wv54BgnSuc2Zy6mEojc-VR7fThZXYGw5",
        "resumen": "Esta clase de **Marketing Perpetuo en LinkedIn** cierra con la **planificación de contenidos** y las **buenas prácticas** para publicar y hacer que ese contenido rinda.\n\nArranca con la pregunta de siempre: **¿cuánto publicar?** La respuesta vale para toda plataforma: **a más contenido, más chances de encontrar piezas ganadoras** y de sacar insights de qué funciona con tu nicho. Si recién empezás, bajá la entrada y **no rompas la cadena**: fijá **3 piezas semanales** como objetivo, generá el hábito y después escalá.\n\nPuntos clave que remarca:\n- Apoyate en la **pirámide de contenidos** (base del marketing perpetuo): grabás un **video largo** cada mes y medio o dos meses y lo fraccionás en reels, audios de podcast y placas de texto para todas las plataformas. En LinkedIn podés subir reels, placas, escribir un **post en texto** o convertir el script de YouTube en un **artículo**. No se crea nada desde cero.\n- Trabajá con el **calendario**: el día que lanzás en tu **plataforma de nutrición** (podcast, YouTube, newsletter), sí o sí publicás en LinkedIn con un **call to action** que dirija ahí. Los días sin estreno, igual compartís material de la **bóveda** llevando audiencia a la nutrición. Bloqueá un día del mes y proyectá los próximos 15.\n- **Horario:** un informe de **Metricool** sobre miles de cuentas marca el **pico de interacción a las 10:00 a.m.**, pero no te ancles ahí. Validalo con tu nicho y subordinalo a la estrategia: si el podcast sale 7 p.m., publicás minutos antes, no a las 10 a.m.\n- **Hashtags:** entre **3 y 5**, mezclando algunos bien de nicho con otros más genéricos del mercado.\n- **Interacción:** mostrate activo (responder comentarios y DMs, comentar y dar likes en otras cuentas), sobre todo en los primeros minutos de cada pieza. Le dice al algoritmo que no sos cuenta fantasma y humaniza la marca.\n\nConclusión: publicá constante y con estrategia, siempre **direccionando de contenido corto hacia tu contenido de nutrición** para retener a la audiencia y construir vínculo, autoridad y referencia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 82,
        "vn": 5,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -05",
        "cardDesc": "",
        "videoId": "1CVR2Jsm8GrH94nfuOsMdwuofwAaxJ-C8",
        "resumen": "Esta clase de **Marketing Perpetuo en LinkedIn** apunta a una meta de largo plazo: convertirte en **Top Voice**, la insignia con la que LinkedIn reconoce a los **líderes de pensamiento y referentes** de cada nicho.\n\nDe qué va: LinkedIn tiene un **equipo editorial** que busca constantemente a estos creadores. Ganar el tag te da **visibilidad** (la plataforma te muestra en sus artículos frente a tu nicho), **credibilidad y autoridad**, **oportunidades de networking** (conectás con otros Top Voices, abrís alianzas y hasta clientes) y **posicionamiento**, que baja la barrera para captar leads y moverlos por el funnel con mucho menos esfuerzo.\n\nPuntos clave que remarca:\n- La táctica más importante: **contribuir en los artículos colaborativos con IA** que arma LinkedIn. El algoritmo detecta temas afines a tu contenido y te invita a aportar tu opinión/feedback.\n- Las respuestas promedian **750 caracteres**; hay que apuntar a **mínimo 400 opiniones** para generar volumen de visibilidad y entrar en el juego de la insignia.\n- Apoyate en la **IA y tus contenidos** para aportar valor real en esos artículos.\n- Para sostener el ranking: **cantidad y calidad** de contenidos publicados con frecuencia, **engagement** (interacciones que validan que el contenido fue relevante), **novedad** (LinkedIn premia insights únicos), **crecimiento de seguidores** como consecuencia, y **diversidad de formatos** (textos, fotos, videos, artículos), respetando la estructura **ABCD**.\n\nConclusión: todo se resume en **sistema y constancia**. El **interés compuesto** de las acciones diarias es lo que te convierte en referente del nicho y te acerca a la insignia Top Voice, para que vender a esos leads sea mucho más simple.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 83,
        "vn": 6,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -06",
        "cardDesc": "",
        "videoId": "1v8Ute3JtmGYMGrV5bRD6UbregVzD6IYL",
        "resumen": "En esta clase de **Marketing Perpetuo en LinkedIn** ves la **estrategia Sniper**: ponerte en rol de francotirador o stalker y salir a buscar dentro de la plataforma a los usuarios que hacen match con tu cliente ideal, tu **nicho dorado**. Es una estrategia muy a foco que usaba Sofía al principio, cuando sus redes todavía no tenían el alcance de hoy, y que seguís pudiendo aplicar. Elegís LinkedIn porque al ser una plataforma profesional los leads están más calificados y propensos a accionar en tu funnel: la gente ahí busca desarrollo profesional, networking y conexiones, a diferencia de TikTok que es más entretenimiento.\n\n**Requisito previo:** tener el perfil bien optimizado (foto, portada, titular, descripción, mini video) y un sistema de creación de **contenido de valor**, para que quien atraigas se quede a nutrirse.\n\nLos pasos concretos:\n\n- Buscá **referentes de tu nicho** (ej. en productividad: Daniel Colombo, Sergio Contreras, Diego La Pastor) y revisá sus publicaciones que estén en sintonía con lo que vos compartís.\n- Metete en los **comentarios** de esos posteos y detectá perfiles que podrían ser tu cliente ideal, priorizando a quienes hacen o responden preguntas por su nivel de compromiso.\n- Abrí cada perfil en una **pestaña nueva** (hacelo desde la computadora, no del celular), investigá su contenido y descripciones, y si hay match dejales un **comentario valioso**.\n- Si te empiezan a seguir, mandales mensaje; si no, esperá un poco y escribiles igual con una conversación orgánica, humana y desinteresada: presentate, charlá y recién ahí ofrecé tu oferta.\n\n**Cuidado con el volumen:** apuntá a unas **100** interacciones por día, pero nunca de un tirón. Repartilas en tandas de **25, 25, 25** en distintos momentos para que la plataforma no te penalice por abrir tantos perfiles y comentar tanto.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 84,
        "vn": 7,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -07",
        "cardDesc": "",
        "videoId": "1khrh1oCiHRw4wtvE9tBzu0CDDQ_JMfQu",
        "resumen": "En esta lección de **Marketing Perpetuo en LinkedIn** te muestro **qué medir dentro de la plataforma** para saber si tu contenido está funcionando y captando a tu nicho dorado. El foco está en **tres métricas**:\n\n- **Visualizaciones del perfil:** la cantidad de personas que visitan tu perfil. Es una señal de interés: si sube, quiere decir que tu perfil se ve bien y que tu contenido está tomando alcance y posicionándote.\n- **Audiencia:** entrá a las estadísticas de cada posteo y fijate qué tipo de usuarios están viendo tu contenido. Podés segmentarlos y filtrarlos por **cargo, ubicación o nombre de empresa**. Esto te da insights clave sobre a qué leads le está apuntando tu contenido, y te ayuda a ajustar el storytelling, la estructura de contenidos, los copies y la segmentación.\n- **Engagement:** combina **alcance** (número de personas únicas que vieron tu contenido) e **interacciones** (comentarios, reacciones, veces compartido y guardado). La fórmula es **alcance dividido interacciones por 100**, y te da el porcentaje de engagement de la publicación.\n\nUn consejo importante sobre el engagement: **medilo formato con formato** — post con post, reel con reel, texto con texto. No es lo mismo el alcance de un posteo que el de un reel o un video, así que nunca los mezcles al comparar.\n\nComo cierre te recuerdo que, si estás haciendo bien el trabajo, también vas a ver **crecimiento en seguidores**, pero ese no es el foco. El foco real es entender **qué audiencia te está mirando** y **el engagement de tu contenido**, porque eso es lo que te confirma si estás logrando captar la atención de tu nicho dorado.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 85,
        "vn": 8,
        "grupo": "Marketing Perpetuo · LinkedIn",
        "modulo": 6,
        "titulo": "MKT Perpetuo -17",
        "cardDesc": "",
        "videoId": "1qPawjQ4BlqQQT5N3YexQUWTkwWDNw6qF",
        "resumen": "Repaso de **buenas prácticas para crear contenido en TikTok** (varias aplican a cualquier plataforma), pensado para bajar la barrera de sumar una red nueva sin quemarte.\n\nPuntos clave que remarca:\n- **Ser constante**: apoyate en tu **calendario**, tu **stock de contenidos** y tu **plantilla** para sostener un **sistema** que cumpla la programación. TikTok puede **viralizar más allá de tus seguidores**, así que a **mayor cantidad de contenidos**, más chances de encontrar **insights** y **contenido ganador**. Empezá con una cantidad semanal que puedas sostener sin romper la cadena: es **interés compuesto**, un contenido es mucho más que cero.\n- **Compartir el detrás de escena**: mostrá procesos del negocio, una jornada de grabación, el **lado B / la trastienda**. El \"cómo lo hice\" y la **transformación** captan atención y **humanizan** tu marca. Podés armar un contenido largo con la historia del negocio o de un proyecto y bajarlo a reel.\n- **Interactuar con la comunidad**: las **interacciones** le dan señales de interés al algoritmo y le muestran que no sos una **cuenta fantasma**. Ella cuenta que responden **absolutamente todos los mensajes**, bloqueando agenda para contestar comentarios y DMs.\n- **Foco en los call to action y copies**: en TikTok los copies son acotados e incómodos (es una plataforma **audiovisual**), así que el **CTA tiene que estar siempre**. El **contenido corto debe direccionar al contenido de nutrición** —el ABC del marketing perpetuo—, con el **perfil optimizado** y **links puestos** para eliminar fricción.\n\nConclusión: la **constancia con sistema**, sumada a humanizar, interactuar y dirigir con CTAs claros, es lo que hace **girar la rueda** del marketing perpetuo en TikTok.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 86,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo (main)",
        "cardDesc": "",
        "videoId": "1pLc6yn86ttu3fKCg8Wpy15nJ3CEoMN23",
        "resumen": "Esta clase de **Marketing Perpetuo en Meta** recorre los **formatos** de Instagram y Facebook, porque cada formato comunica algo: elegir bien el canal, dispositivo y formato ayuda a que tu mensaje llegue a tu **nicho dorado** y a mover audiencias de la **captación a la nutrición** en el funnel. La consigna de fondo es **experimentar y validar** qué funciona con tu nicho.\n\nLos formatos que repasa:\n- **Fotos** (ideal 1080×1080): foco en la **claridad** (que se entienda qué mostrás, no en cámara profesional), **consistencia de marca**, y uso de textos/gráficos para bajar conceptos. Sirve para **presentarte** (foto tuya o del equipo) y humanizar la marca.\n- **Carruseles** (hasta 10 placas, fotos/videos): para bajar ideas difíciles de condensar en un reel. Respetar **hook, nudo y desenlace**, cuidar la narrativa y no saturar de texto. Ejemplo propio: adaptan los mails del newsletter (**el cortito**) a placas y las publican con CTA al newsletter.\n- **Reels**: el formato con **mayor alcance**. Foco en la estructura ganadora y en el **hook** con sus tres capas —texto, imagen y sonido— cubriendo al menos dos. Estudiar **tendencias**, editar creativo (sugiere **CapCut**) y cuidar las **portadas** (funcionan como thumbnail de YouTube). Buscar **variedad** en el feed (ejemplos: Spotify, Alex Hormozi).\n\nFormatos de nutrición:\n- **Vivos/lives** (al menos uno al mes): ayudan a la conversión y a la cercanía. Buenas prácticas: anunciarlo con anticipación, cajita de preguntas, guion o \"machete\", **colaboraciones** y **repostear** después.\n- **Facebook videos largos**: republicar el mismo video de YouTube (thumbnail y título ganadores), sin esfuerzo extra, sumando **interés compuesto** de nutrición.\n\nConclusión: usar **todos los formatos integrados** llega a la audiencia desde distintas perspectivas y refuerza el mensaje.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 87,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -01",
        "cardDesc": "",
        "videoId": "1_ZtaZuDyiKWkV5dXiyKlO_rO4PIAcZho",
        "resumen": "Arrancamos con la **estrategia de contenidos dentro de Facebook e Instagram**, construida sobre la **pirámide de contenidos**: fragmentar **videos largos en videos cortos**, pero con conciencia de **generar variedad de formatos** (reels, placas de texto para carrusel, imágenes) para apalancar los conceptos y captar audiencias.\n\nPuntos clave que remarca:\n- Si todavía no implementás la pirámide, no pasa nada: partís de tus **pilares temáticos** del inicio del módulo y generás guiones respetando la **estructura de contenidos ganadores**.\n- **Bloqueá un solo día del mes** para grabar todos los reels condensados. Así trabajaba **Sophie** antes de tener el sistema actual: hacés foco ese día y el resto del mes tenés la mente en lo que importa, no en la creación esporádica.\n- Apoyate en tu **plantilla de stock de contenidos** para tener orden interno; a medida que escalás, necesitás saber qué contenido tenés en la marca.\n- **A mayor contenido, más chances de pegarla**: publicando seguido encontrás más **hooks, portadas y storytellings** que funcionan, validás ideas, sacás insights y descartás lo que no suma.\n- Si estás empezando, no te abrumes: fijá objetivos como **3 publicaciones semanales** y cumplilas para generar el hábito y el sistema. El ideal a futuro es **al menos una pieza por día**.\n\nLa estrategia gira siempre en torno a estos objetivos: **visibilidad, nicho dorado, alcance, posicionamiento, ventas y monetizar** tu negocio. Integrar ambas plataformas te permite llegar con el mismo esfuerzo a distintos públicos de tu nicho.\n\nConclusión: crear contenido corto en escala, ordenado y estructurado, es lo que **nutre todo el funnel** para captar audiencias, nutrirlas y convertirlas en clientes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 88,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -02",
        "cardDesc": "",
        "videoId": "1u5ZBDW9L9Fb6SC-cFo9WaOrYQ6rNXM1s",
        "resumen": "Esta segunda clase de **Marketing Perpetuo en Instagram/Facebook (Meta)** baja a la práctica cómo **fragmentar y calendarizar** tu contenido. El fundamento sigue siendo el mismo: captás audiencias con **contenido corto** y las direccionás a tu **contenido de nutrición** (podcast, YouTube, newsletter), apoyándote en la **pirámide de contenidos** y el funnel perpetuo.\n\nPuntos clave que remarca:\n- No fragmentes por fragmentar: cortá de forma **estratégica**, acercándote a la estructura de los contenidos ganadores.\n- Cada reel tiene que **entenderse por sí solo**, aislado del video largo. Quien lo ve en Instagram todavía no sabe que ese video existe, así que la pieza debe aportar valor sola y recién ahí ofrecer el **call to action** al medio del funnel.\n- Para ordenar los cortes pensá en **tips, hacks, paso a paso, datos del negocio, ventas y casos de éxito**. En los casos de éxito, sumá **material de soporte y validaciones** para construir autoridad.\n- De un video largo sacás muchos **reels, placas, copies y el audio del podcast**. Organizalo en la **planilla de stock** y la **plantilla de calendarización**.\n\nCómo calendarizar: partí de los **días inamovibles** de nutrición (su ejemplo: lunes podcast, miércoles YouTube, domingo newsletter) y generá expectativa. Esos días, en todas las plataformas lanzás un fragmento con CTA hacia ese contenido. Los días sin nutrición igual publicás valor con CTA (un jueves podés referir al podcast sin estreno). Tildá en la planilla lo ya publicado para no pisarte, aunque **repetir no es problema**: la audiencia se renueva.\n\nConclusión: planificá con anticipación (idealmente un mes, o al menos 15 días) para escribir buenos copies y **no romper la cadena** de constancia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 89,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -03",
        "cardDesc": "",
        "videoId": "1t8hV6AagNWOOmE94cA43TZ1YBY56h_gr",
        "resumen": "Esta clase de **Marketing Perpetuo en Instagram/Facebook (Meta)** hace \"doble clic\" en las **estructuras ganadoras de contenido**: si no respetás estos checks, el contenido se vuelve más difícil de escalar. Aplica tanto para cortar contenido largo como para generarlo desde cero.\n\nPuntos clave que remarca:\n- El **hook** es lo primero y más importante: hay que captar la atención en los primeros **3 segundos**, porque opera como un **filtro de interés** que llama justo a tu cliente ideal. Podés trabajarlo en **tres elementos**: el **script/guión** (lo que decís), las **visuales** y los **efectos de sonido/música**. Apuntá a tener al menos **dos bien pulidos**; refuerzan el hook cuando al cortar quedó débil.\n- Poné **subtítulos y soporte visual**: mucha gente consume con el teléfono **en silencio**, así que el hook tiene que entenderse igual (textos, transiciones, efectos, emojis).\n- Los **copies** retienen y nutren: son una \"bajada a tierra\" del contenido. Mantenelos **simples y humanizados**, con **storytelling** y tu **personaje legendario**, valores y propósito. Breves salvo que un relato largo lo amerite (como la presentación de Sophie).\n- Usá el copy para **generar interacción y debate**: comentarios, guardados, enviados y likes le avisan al **algoritmo** que el contenido es relevante y lo muestra a más gente.\n- **Storytelling** transversal: las personas conectan con personas.\n- **Call to actions** en todo lo que hacés (link, **ManyChat**): el objetivo es mover a la audiencia de la captación a la siguiente etapa del funnel, la **nutrición**.\n\nConclusión: no subimos contenido por subir, sino para **generar acciones** que con el tiempo conviertan a la comunidad en clientes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 90,
        "vn": 5,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -04",
        "cardDesc": "",
        "videoId": "1ksdtoU-HYtNlJdN6IKRRjHAKwxTsB8eE",
        "resumen": "Esta clase de **Marketing Perpetuo en Instagram/Facebook (Meta)** entra de lleno en las **historias de Instagram** como espacio de **nutrición y venta**. Ahí construís un vínculo más cercano (sensación de \"en el momento\") y te ven los usuarios más comprometidos con tu cuenta.\n\nPuntos clave que remarca:\n- La lógica siempre es **storytelling**: la retención cae historia a historia, y enganchar el relato evita que abandonen.\n- Las historias solo escalan cuando la gente **interactúa**, y la señal más fuerte es que **respondan por DM** (más que stickers, encuestas o cajas de preguntas).\n- **Estrategia zanguchito (sandwichito)**, tomada de la radio: abrís con una **pregunta radial** de interés, metés en el medio el contenido que querés lanzar y cerrás con el **call to action**.\n- **Silencio de 24-48 h**: dejás caer las historias y desaparecés; al volver el algoritmo te muestra a más gente.\n- **Polaridad**: generar debate con temas en tendencia que hagan match con tu negocio, siempre **cuidando los valores de la marca**.\n\nEjemplo que cuenta: para lanzar el 2º episodio del podcast de **Sofía** (los \"5 hacks para vencer la procrastinación\"), la 1ª historia preguntó cuál es la típica excusa para no hacer algo (solo una manito, sin caja). Explotó: pasaron de ~4000-5000 vistas a casi **21000**. Después vino el CTA al podcast, al día siguiente compartieron las respuestas más divertidas para votar, y cerraron con el CTA al **programa de gestión de tiempo**. Otro caso: el episodio Will Smith en los Oscars anclado a una frase de **Warren Buffett** sobre la confianza, ligado a su contenido de vínculo con clientes.\n\nConclusión: subí historias **todos los días** (salvo el silencio estratégico), buscá que te respondan, y probá estos juegos para escalar alcance. Si perdés audiencia, era gente fuera de tu **nicho dorado**; todo apunta a **convertir al final del funnel**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 91,
        "vn": 6,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -05",
        "cardDesc": "",
        "videoId": "14ABWJRUerDLd7tHYNnxM4TiOsVqwkQmD",
        "resumen": "Esta clase de **Marketing Perpetuo en Instagram/Facebook (Meta)** se enfoca en la estrategia de **shoutouts**: apalancarte en cuentas ya posicionadas de tu nicho para aumentar tu alcance.\n\nDe qué va: buscás **cuentas muy posicionadas** en tu mercado, alineadas con tu **nicho dorado**, y generás un **acuerdo (por lo general monetario)** para que publiquen contenido tuyo. Como en esa cuenta hay muchos de tus **potenciales clientes**, cuando comparten tu material les das visibilidad frente a toda esa comunidad, y quienes conecten con el mensaje van a ir a buscarte. Así el tráfico de esa cuenta se direcciona a tu perfil.\n\nPuntos clave que remarca:\n- El contenido que compartís tiene que estar **segmentado**, hablándole directo a tu **cliente ideal**, para captar bien a esas personas.\n- Tu perfil tiene que estar **sumamente optimizado** (como se vio al principio del módulo).\n- Tenés que tener **contenido de valor** para que quien llega se quede y arranque a girar la **rueda del marketing perpetuo**.\n\nEjemplo propio que cuenta: una **cuenta de estoicismo y mentalidad** los vio en una entrevista que hizo Frío para un medio de comunicación de Argentina, conectó con ese contenido y empezó a compartir fragmentos en colaboración. Publicaron un **ritual de Sophie** que tuvo gran alcance dentro del nicho de mentalidad y les trajo un montón de gente a la cuenta. Aclara que ellos no salieron a buscar el shoutout: fue **causa y efecto** de trabajar con constancia, por eso insiste en tener **bien sistematizado tu sistema de publicación**.\n\nConclusión: es una estrategia muy interesante para **generar picos de alcance** apalancándote en cuentas con un nicho ya segmentado que conecte con tu oferta.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 92,
        "vn": 7,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -06",
        "cardDesc": "",
        "videoId": "1k3tCM0RePM4M3RAu4e8t5iu6Zm5cv9yR",
        "resumen": "Esta clase cierra el bloque de **Meta (Instagram y Facebook)** repasando **buenas prácticas** para crear contenido que genere leads de forma perpetua. El instructor ordena todo en **tres pilares**:\n\n- **Constancia y frecuencia.** La base es simple: cuanto más contenido de valor generás, más leads alcanzás y más clientes podés convertir. La fórmula es **constancia + valor agregado**, apuntando siempre a la **calidad** por encima de la cantidad. Publicar sistemáticamente contenido de valor genera un **interés compuesto** que rinde en el mediano y largo plazo. Para sostenerlo recomienda apoyarse en la **pirámide de contenidos** (videos largos y cortos), así la estrategia no queda a merced de la motivación o de los huecos de tiempo.\n\n- **Uso de hashtags.** Aunque están en debate, el equipo validó que aportan resultados. La clave es **reducirlos**: usar un promedio de **cinco**, no más, combinando algunos **genéricos** con otros bien específicos de tu **nicho y mercado**. Ayudan al algoritmo y a los motores de búsqueda a posicionar tu contenido.\n\n- **Interacción con la comunidad.** Es lo que más recalca: la marca tiene que verse **viva, activa y humanizada**, no una cuenta fantasma ni bot. Para eso hay que responder los comentarios en los **primeros 20 minutos** de publicado, contestar historias y DMs (dedican un bloque de tiempo con el equipo), y apuntan a terminar la semana con la **bandeja de entrada limpia**. También sugiere seguir y comentar en otras cuentas. Todo esto genera cercanía, refuerza el storytelling entre personas y le muestra al algoritmo que la cuenta está activa, mejorando el alcance.\n\nCierra insistiendo en respetar esos tres puntos porque tienen un **retorno seguro en el negocio**, y adelanta que lo próximo será la elección de **métricas**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 93,
        "vn": 8,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -07",
        "cardDesc": "",
        "videoId": "1_OLaTAWLe2EcFoKcLVztD6b2xFu1MnU_",
        "resumen": "Esta clase de **Marketing Perpetuo en Meta (Instagram/Facebook)** se enfoca en **qué métricas medir** para entender el rendimiento de tu contenido. La idea central: las acciones que los usuarios hacen sobre tus publicaciones son las que le marcan al algoritmo cuánto **alcance** va a tener ese contenido.\n\nLa métrica macro es el **porcentaje de engagement**, que se calcula así: **interacciones ÷ alcance × 100**. Te desgloso los conceptos:\n\n- **Interacciones**: comentarios, likes, las veces que comparten y las veces que guardan el contenido.\n- **Alcance**: el número de usuarios únicos a quienes se les imprime esa publicación en pantalla.\n\nEl instructor hace mucho foco en dos métricas que muchos pasan por alto: **compartidos** y **guardados**. Son acciones mucho más comprometidas que un simple like. El **compartido** mide cuántos le envían la publicación a otras personas; el **guardado** (como un \"lo veo más tarde\") indica que el contenido fue tan relevante que la persona decidió conservarlo. Si tenés publicaciones con muchos compartidos y guardados, es señal de que ese contenido pegó fuerte en tu nicho.\n\nPara **aumentar el alcance** hay que aumentar las interacciones, y eso se potencia con la estructura de **contenidos ganadores**, el **storytelling** y sobre todo los **call to action**: dejá siempre llamados a la acción, abrí preguntas y generá interacción.\n\nEn **reels** además mirá el **porcentaje de retención** (hasta qué minuto en promedio te ven). Analizá los que retienen bien para replicar qué hiciste distinto.\n\nRegla clave: **medí cada formato contra sí mismo** (reels con reels, carruseles con carruseles, historias con historias). No mezcles, porque el reel tiene naturalmente más alcance que un post y cruzarlos te da conclusiones erróneas. Sacá un engagement promedio por formato para tener información concluyente.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 94,
        "vn": 9,
        "grupo": "Marketing Perpetuo · Instagram / Facebook",
        "modulo": 6,
        "titulo": "MKT Perpetuo -08",
        "cardDesc": "",
        "videoId": "12loiuUZM6fkVGHD0GXhSh5lehHzzbCDL",
        "resumen": "**ManyChat** es la protagonista de esta clase de **Marketing Perpetuo en Meta**: una plataforma de bots que se vincula a tu Instagram para potenciar tus **call to actions**. Como Instagram no deja poner links en descripciones, ManyChat resuelve el problema: la persona deja una **palabra clave** y eso dispara una **automatización** que la manda a tu **funnel de nutrición**.\n\nPuntos clave que remarca:\n- Creás tu cuenta vinculada a tu Instagram (hay versión **gratis** —con límites— y **Pro**).\n- Vas a **Automatizaciones** y creás una nueva desde cero (saltea AI y templates).\n- Se arma con dos partes: **disparador** y **mensaje**.\n- **Disparador:** foco en comentarios en publicaciones/reels y respuestas a historias (recomienda usar ambos). En comentarios elegí \"todas las publicaciones\".\n- **Palabras clave:** pensalas según tu objetivo (ej. \"podcast\") y agregá **variantes mal escritas** (\"podcast con R\", \"por cast\") para no perder gente. No distingue mayúsculas.\n- **Respuestas al comentario:** cargá 3 variables, humanizadas y con emoji (ej. \"listo, te enviamos la info por DM\").\n- En historias: elegí \"palabras específicas\", reaccioná con **like** y podés retrasar unos segundos.\n- **Mensaje:** saludá con el **nombre** (corchetes), contá de qué va con tono muy humano —muchos no saben que es un bot— y un solo **botón con link** directo al CTA (\"Escúchalo acá\").\n\nEjemplo que usa: el podcast que sale los lunes con contenido de productividad, mentalidad y negocios; el botón lleva a soficontreras.com.\n\nAntes de publicar, **probala** con el código de prueba (arranca a correr apenas la publicás). Después mirá **ejecuciones y % de clics**; si convierte poco, revisá copy, palabra clave o creatividad.\n\nConclusión: automatizá tu CTA de captación hacia la nutrición y **mantenelo simple** —un solo paso—, porque complejizar arruina la experiencia del usuario.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 95,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo (main)",
        "cardDesc": "",
        "videoId": "1Z8S4uu9Is_vd3w9UccyCtEk123q18CvY",
        "resumen": "Esta clase abre el bloque de **Marketing Perpetuo por Email/Newsletter** y arranca con una idea central: lo más importante es **armar tu propia base de datos**. Si tu negocio depende solo de Instagram, TikTok, Facebook o LinkedIn, tenés un problema, porque **no sos dueño de los datos**: si mañana alguna de esas plataformas se cae o queda suspendida, tu negocio queda totalmente a merced de ellas. Cuando en cambio capturás los **mails de tus clientes**, sí te hacés dueño de los datos y **blindás el negocio a largo plazo**.\n\nEl instructor lo ubica dentro del **funnel**:\n- **Top of the funnel** (captación): contenido corto en Instagram, TikTok, Facebook, LinkedIn.\n- **Medio del funnel** (nutrición): YouTube, podcast y **newsletter**.\n\nEn su propio caso, primero pulieron y escalaron Instagram como plataforma de captación y recién después sumaron el **newsletter**, porque es la única forma de apropiarte de los leads. La recomendación: si ya tenés una plataforma de captación corriendo pero ninguna de nutrición, **la primera que desarrollás es el newsletter**.\n\nDespués marca la **diferencia clave** entre las dos estrategias, que aunque ambas se basan en enviar correos, se piensan distinto:\n- **Newsletter**: plataforma de **nutrición** pura. Genera vínculo, cotidianidad, frecuencia, **comunidad y sentido de pertenencia**. Construye **confianza, autoridad y posicionamiento**, sin venta explícita. La venta existe pero el foco es aportar valor y acompañar.\n- **Email marketing**: mismo trabajo de nutrición y vínculo, pero con **foco en la venta**, más \"agresiva\" entre comillas, y un **call to action** muy fuerte para que la base de datos ejecute una acción.\n\nCierra anticipando que en las próximas clases se meten en detalle en cada estrategia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 96,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -01",
        "cardDesc": "",
        "videoId": "1IVyWTx5wJREaSThlHcqA8Yrkg27TR3sz",
        "resumen": "Arranca una serie sobre **newsletter** dentro del **Marketing Perpetuo por Email**: qué es, la estrategia paso a paso y las buenas prácticas. El newsletter es una plataforma del **middle of the funnel**: captás audiencias con contenido corto y las derivás acá, que es tu **canal de nutrición** para informar, educar y crear vínculo.\n\nPor qué importa tener tu **base de datos** de mails:\n- Si tu negocio vive solo en Instagram, TikTok, YouTube o podcast, dependés de esas plataformas. Con la base de mails tenés **autonomía**: sos dueño real de tus datos.\n- Genera **clientes más fidelizados** y más conversiones: al ser lectura en compu o celular, el clic es más accesible (a diferencia del podcast, donde no tenés el dispositivo a mano).\n\nTres factores para crear el tuyo:\n- **Relación a largo plazo:** el newsletter crea un **hábito de lectura**. En el caso de Sofía lo mandan todos los domingos al mediodía, con el ritual del mate o el café. Hay que aportar valor sistemáticamente para generar confianza y autoridad.\n- **Frecuencia:** creá expectativa con constancia y rigurosidad. Definí diario, semanal, quincenal o mensual (recomienda **semanal o quincenal** para empezar), fijá día y horario y respetalos para no romper la cadena.\n- **Contenido temático:** el newsletter es un concepto en sí mismo, un espacio cuidado. Volvé a tu **master copy**, tus **pilares temáticos** y tu **personaje legendario**. Que se vea humano y genuino.\n\nEjemplo: el **Cortito y al pie**, newsletter de Sofía Contreras, habla siempre de **negocios, mentalidad y productividad**, sin desviarse. El nombre es estratégico: ligado a la identidad de marca (breve, práctico, accionable, con ejercicios o disparadores) y también describe el propio mail: corto y fácil de escribir.\n\nConclusión: pensá tu newsletter desde estos tres pilares, siempre con **coherencia** entre negocio, comunicación e identidad de marca.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 97,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -02",
        "cardDesc": "",
        "videoId": "1afobgo_JqhUA3f0imeIjNPiWAj5AsJyU",
        "resumen": "Segunda clase de **Marketing Perpetuo por Email**, dedicada a la **estructura de un newsletter**. La idea central: un newsletter se distingue de cualquier otro correo porque necesita un **diseño estructurado** (no diseño gráfico ni \"explosiones creativas\", sino un orden que respetes en el tiempo) alineado con tu marca. Esa consistencia genera una **rueda sistemática** de identificar y conectar, porque el suscriptor ya sabe qué va a encontrar al abrir tu mail.\n\nPuntos clave que remarca:\n- **Coherencia de temas**: el newsletter le habla a tu **nicho dorado**. No se busca una base grande porque sí, sino leads calificados.\n- **Coherencia con el concepto general**: si dijiste que sale tal día, a tal hora, con tal formato, lo respetás. Eso sostiene la expectativa del lector.\n- **Humanizado y genuino**: es un espacio de conexión personal, tiene que verse la parte más humana de la marca.\n\nEjemplo de su propia estructura (marca \"Al Pie\", breve, práctico y accionable):\n- **Saludo inicial + índice** que puntea lo que trae el correo. Entre **3 y 5 puntos** (mínimo 3, para mantenerlo cortito).\n- **Desarrollo** de cada título: corto, accionable y siempre aportando valor.\n- **Footer tipo template**, siempre igual: episodio del **podcast**, video de **YouTube** de la semana, una **frase** de un autor (muy compartible → captura para historias de Instagram), la app y el **link para suscribirse** si te reenviaron el mail. Si tenés una oferta o programa, va acá sin vender en el cuerpo: la opción siempre está a mano.\n\nConclusión: armá tu estructura y respetala. Te baja la barrera para escribir y le ordena la lectura al suscriptor. La clave es **accionar**, probar con tu comunidad y sacar tus propias conclusiones.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 98,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -03",
        "cardDesc": "",
        "videoId": "1WqiC9fFrVGeME0zVZBRHIE4N80CXPOyf",
        "resumen": "Este video de **Marketing Perpetuo por Email/Newsletter** se enfoca en **cómo vender dentro del newsletter sin romper el vínculo** con tus suscriptores. La idea central: el newsletter tiene **alta tasa de conversión** porque venís construyendo un vínculo sistemático en el tiempo, aportando valor y posicionándote en cada mail; ese \"interés compuesto\" hace que la gente esté más predispuesta a accionar sobre un link. Además, al leer en la compu, la pantalla facilita el clic.\n\nEl gran cuidado es con los **call to actions de venta**: si llenás el newsletter de \"venta, venta, venta\", generás fricción y perdés credibilidad y autoridad, porque la gente se suscribió con la **promesa de contenido de valor gratuito**. Entonces no es que no se venda, se vende, pero de forma **sutil**.\n\nLas herramientas concretas:\n- **Storytelling** en cada correo para atenuar la venta.\n- Apelar a la **comunidad y la pertenencia**, dando **beneficios exclusivos**: cupones de descuento, accesos anticipados, exclusividad. Eso además funciona como **hook** para que otros se sumen.\n- Cuidar que esos beneficios no sean **extorsión ni coerción** para suscribirse; la gente tiene que sumarse por voluntad de recibir el valor, y los beneficios son un adicional.\n\nEl **ejemplo** que muestra es el cierre de la academia de **Sofía Contreras**: un \"cortito\" (newsletter) que relata la historia de por qué cierra la academia (storytelling), presenta la **oportunidad** de acceder por última vez a los cursos desde el **miércoles 15 de mayo hasta fin de mes**, y le da a la comunidad del cortito el **beneficio** de acceder un día antes a los mejores cupones. Se vende, pero atenuado con historia y beneficio. La regla final: siempre **cuidar la sanidad del vínculo** con tu comunidad.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 99,
        "vn": 5,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -04",
        "cardDesc": "",
        "videoId": "1_Mr7o70ZVXdgioVvyQ0YshplbWi5fX-c",
        "resumen": "Toca el momento más difícil de un newsletter: **conseguir los primeros 100 suscriptores**. Si arrancás en cero, hay que salir a buscar a tu **cliente ideal**, tu **nicho dorado**, y el foco no va en el número sino en el **sistema**: **no romper la cadena** de envío (si es cada domingo, sale cada domingo, sí o sí). Sofía cuenta que empezaron en cero y hoy pasan las **42.000 personas** creciendo por el efecto compuesto de sostener el hábito.\n\nPuntos clave que remarca:\n- El newsletter es la **mejor estrategia de ventas**: alta conversión, vínculo, confianza, y te metés en la rutina del lead. Cada mail es una **semillita** que a largo plazo germina en ventas.\n- Necesitás un **destino para captar datos**: una landing o página de suscripción con tres cuidados: **claridad del valor** (que se entienda a qué se suscriben, para filtrar y no dañar la tasa de apertura), **estructura simple** (la casilla visible en el header, sin scrollear) y **pedir solo lo necesario**: lo esencial es el **mail** (opcional nombre y país).\n- Para llevar tráfico entra la **pirámide de contenidos**: fragmentás el newsletter (contenido largo de nutrición) en piezas cortas para IG, TikTok, Facebook, LinkedIn y YouTube Shorts.\n\nEjemplos que muestra: la web de **Sophie** (\"recibe sabiduría práctica\"), **Russell Brunson** (solo pide mail, segmenta con \"transforma tu negocio en 2 min por día\"), e **Isla Bravo**, copywriter, con landing minimalista blanco/negro/rojo, puro texto. También menciona el **pop-up** como opción extra. Un mail sobre \"10 aprendizajes que guían mi vida\" se volvió reel con material de stock, sin grabar a Sophie; otro sobre hábitos, un carrusel.\n\nConclusión: trabajá la **pirámide de contenidos**, canalizá todo en tu **calendario de marketing** y usá **call to actions** (incluido el bio link) para direccionar audiencias del contenido corto de captación hacia la nutrición.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 100,
        "vn": 6,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -05",
        "cardDesc": "",
        "videoId": "1iukl7xjraMGXqpsXlvoPhg72gtpzQuEQ",
        "resumen": "Acá Sofía profundiza en la **estrategia de email marketing** y la separa del newsletter: mientras el newsletter **nutre** y cuida el vínculo (sin vender de más), el email marketing está **anclado a la venta** y es un poco \"más agresivo\". Clave: casi nunca es un mail suelto, sino **cadenas de mails concatenados** que llevan al lead a una acción concreta. Se apoya en tres pilares: **objetivos, segmentación y automatizaciones**.\n\nPuntos clave que remarca:\n- **Objetivos posibles**: generación de ventas (clic a landing, carrito abierto, formulario o calendario de call); **captación y nutrición** con lead magnets (VSL, webinars, clases gratis) que calientan al lead de frío a caliente; **Lifetime Value** subiendo el ticket con **cross-selling** (quien compró A recibe cadenas para el complementario B) y **down-sell** (a quien dijo que no por precio, se le ofrece una oferta más accesible para no perder el lead); **aumento de tráfico** avisando por mail cada video nuevo; **promoción de eventos/lanzamientos/preventas**; y **procesos de negocio** automatizados (en Mastery House, desde que alguien aplica al formulario hasta su onboarding, todo va por mails).\n- **Segmentación**: clasificar por **etiquetas/tags** (rótulos por comportamiento; un contacto puede tener varios: vsl mastery, compró programa X) y por **listas** (grupos de contactos). Según la plataforma, la automatización dispara desde tags o desde listas. Ejemplo: una lista \"negocios\" agrupa a todos los interesados en negocios, y ahí se apuntan los cañones.\n- **Automatizaciones**: **disparador** (evento que inicia el flujo), **workflow** (todos los pasos, mails, tiempos de espera y condiciones), **segmentación dinámica** (si hizo la acción se lo taggea y se lo saca; si no, espera y reenvía) y **tiempos de espera** (intervalos o esperar una acción).\n\nAdvertencia concreta: enviá solo contenido relacionado al interés del suscriptor (los de **productividad** no siempre quieren negocios); mandar lo que no aporta valor te hace perder aperturas o te marcan como **spam**.\n\nConclusión: definí primero el **objetivo**, elegí el **segmento** y armá el **workflow** para impactar a la persona correcta con el mail correcto y convertir sin operar todo a mano.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 101,
        "vn": 7,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -06",
        "cardDesc": "",
        "videoId": "1ASmuwGUw-V_rIu4n9eOjTCn0e7lVnSEp",
        "resumen": "Acá Sofía hace doble clic en la **estructura interna de cada mail**: una fórmula fija que conviene respetar siempre que se pueda, porque construye **storytelling** y potencia los clics sobre los links. Recordá que una campaña suele ser una **cadena de varios mails** (lo común son 3 o 4 correlacionados), así que no hace falta repetir todo en cada uno.\n\nLa lógica es la misma que el contenido ganador: **hook, nudo (desarrollo) y desenlace con call to action**. El primer clic lo gana el **asunto** (tu hook, tiene su propia lección); una vez adentro, el desafío es retener hasta el final, así que mails **cortos y prácticos**, sin divagar.\n\nPuntos clave de la estructura:\n- **Saludo personalizado** con el nombre del lead (las plataformas lo automatizan): \"Hola Franco...\".\n- **Hook** en la primera línea, atado al dolor del nicho. Ej: \"¿Sabías que el 70% de los negocios fracasan por este error?\".\n- **Posicionamiento**: 2-3 líneas sobre por qué vos hablás de esto, para generar autoridad y confianza.\n- **Aporte de valor**: desarrollás el tema pero lo dejás abierto al CTA.\n- **Testimonios** como validación (no en todos; ej. de 5 mails, dedicá ~2 a reforzar la transformación).\n- **Call to action** claro y clicable en TODOS los mails, puede ir en el medio. Ej: \"Toca acá para agendar una consultoría gratis\".\n- **Link de desuscripción** visible: no le tengas miedo, no querés desinteresados que bajan tu tasa de apertura o te marcan como spam y dañan la entregabilidad.\n\nConclusión: escribí cada correo como un **pequeño cuento** persuasivo, con relato propio y encadenado al anterior, para que los leads conecten y terminen convirtiendo en clientes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 102,
        "vn": 8,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -07",
        "cardDesc": "",
        "videoId": "1QtAnMR4Jy5ANW8SEOv6FYwcQtRZPHEi_",
        "resumen": "Acá Sofía baja al terreno la pregunta clave del **email marketing**: cómo captamos leads y armamos nuestra **base de datos**. Todo arranca por tener un **lugar de destino** donde recopilar mails: **funnels de venta**, **VSL** (video de venta), **landing pages** o el propio **checkout** cuando alguien compra y deja su dato.\n\nPuntos clave que remarca:\n- **Lead magnets**: un incentivo gratuito a cambio de los datos. Puede ser un artículo, un ebook, una **guía que resuelva un dolor específico**, un curso en video, un **webinar** (una clase) o un PDF.\n- El **VSL** —dar un video gratuito a cambio del mail— es el lead magnet de excelencia: trae leads **muy calificados**, no cualquiera, sino el que de verdad se interesó por ver ese video.\n- Regla de oro: que cada lead entre a la base con un **tag/etiqueta** que identifique qué lo trajo. Eso habilita después las **automatizaciones**, los flujos de trabajo, la **segmentación** y poder mapear su recorrido dentro del negocio.\n- **Pop-ups en la web**, sobre todo los de salida (cuando la persona está por abandonar la página).\n- Tus **redes de captación y nutrición**: todas tus plataformas suman. Optimizá los perfiles con **bio link** en Instagram, TikTok o LinkedIn para que hagan clic y direccionar tráfico.\n\nEjemplo que muestra: el **pop-up de Acquisition** (el negocio de Alex y Leila Hormozi). Cuando estás por irte de la web, salta un pop-up para suscribirte y recibir info del lanzamiento de su próximo libro; dejás el mail y entrás a una secuencia que te nutre a favor de ese lanzamiento.\n\nConclusión: para captar leads hay que **poner a girar la maquinaria** de contenidos y estrategias (landing del lead magnet, pop-ups, guías, VSL) y, sobre todo, **etiquetar siempre** a cada persona para dirigir mejor tus campañas hacia tu nicho.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 103,
        "vn": 9,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -08",
        "cardDesc": "",
        "videoId": "1LhIzSXNRxXt7vKR52K1jmGf_905uvFaE",
        "resumen": "Esta clase de **Marketing Perpetuo por Email** se mete de lleno en cómo **captar leads** y **armar tu base de datos**. La premisa: antes que nada necesitás un **lugar de destino** donde recopilar los datos, un espacio al que direccionás el tráfico para que las personas te dejen su mail.\n\nDe qué va: los caminos para llegar a ese destino son **funnels de venta**, **VSL**, **landing pages** o **compras pasadas** (cuando el cliente completa el carrito y deja su dato). Toda acción donde el lead deje su correo suma a tu base.\n\nEstrategias concretas que da para captar:\n- **Lead magnets**: un incentivo gratuito a cambio de los datos. Puede ser un **artículo, ebook, guía que resuelva un dolor específico, curso en video, webinar** o un **VSL**.\n- Destaca el **VSL** como el lead magnet por excelencia y de los más efectivos: la persona se suscribe para acceder a un video de valor y deja su correo, así generás una base de **leads muy calificados** (no cualquiera, sino el que realmente se interesó).\n- **Pop-ups en la web**: ejemplo de la landing de **Acquisition.com** (el negocio de **Alex y Leila Hormozi**), que muestra un pop-up al intentar abandonar la página, ofreciendo info sobre el lanzamiento de un libro para que dejes el mail.\n- **Tus redes de captación y nutrición**: todas tus plataformas trabajan a favor de captar leads. Optimizá los perfiles con **bio link** en Instagram, TikTok o LinkedIn para direccionar tráfico al VSL.\n\nPunto que remarca fuerte: los mails tienen que ingresar a tu base **con un tag o etiqueta** que identifique qué acción los llevó ahí. Eso te sirve después para armar **automatizaciones, flujos, segmentación** y para **mapear el recorrido** del lead dentro de tu negocio.\n\nConclusión: captar leads es **poner a girar la maquinaria** de contenidos y estrategias (landing, pop-ups, guías gratuitas, VSL); todo eso alimenta tu base, siempre etiquetando para poder optimizar campañas hacia las personas indicadas de tu nicho.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 104,
        "vn": 10,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -09",
        "cardDesc": "",
        "videoId": "1LaokQG2fWqzCjNam3Xyzv_WRJ_rv-HF2",
        "resumen": "Toda la clase gira alrededor de una idea: el **asunto** es el primer hook de tu mail, igual que el título en YouTube o en un podcast. A partir de él la audiencia decide abrir o no, así que si el asunto falla, todo el storytelling de adentro se pierde. Aplica igual para **newsletter** y para **email marketing**.\n\nBuenas prácticas que remarca:\n- **Claridad**: que se entienda al toque el beneficio de abrirlo. Además cuida la salud de la cuenta: si nadie abre, el algoritmo te marca como **spam** y te penaliza. Ej: \"3 razones para invertir en Costa Esmeralda\".\n- **Brevedad**: lo más corto posible, pensando siempre en el **celular**. A veces la intriga con asuntos mínimos (\"120 min\", \"de cero a 100\") genera clic por FOMO.\n- **Urgencia y escasez**: casi infalibles, sobre todo con ofertas, hot sale o cupos limitados. Ej: \"Te quedás afuera\", \"mañana todo valdrá el doble\".\n- **Personalización**: nombrar a la persona. Ej de reengagement: \"María, ¿estás ahí?\", \"Juan, esta casa está hecha a medida para vos\".\n- **Curiosidad**: despertar el \"¿qué me estoy perdiendo?\". Ej: \"Cómo fracasar en un negocio sin esforzarte\".\n\nFórmulas concretas:\n- Beneficio + plazo: \"Cómo conseguir más clientes en 7 días\".\n- Pregunta con curiosidad: \"Tu negocio, ¿sobrevive o prospera?\".\n- Cómo + resultado + tiempo: \"Cómo reducir tus costos operativos en 30 días\".\n- Beneficio + fin del dolor: \"Ganá más visibilidad sin invertir en publicidad\".\n- Testimonio + resultado: \"Cómo Lila dominó el inglés en solo 3 meses\".\n\n**Bonus solo para newsletter**: numerá los asuntos, como los episodios de podcast. Ordena la experiencia, muestra el volumen de contenido de valor y deja ver tu progreso.\n\nConclusión: pensá cada asunto para tu **nicho dorado** y validalo con **A/B testing** (mismo correo, dos asuntos, ver cuál gana). Es prueba y error, y cuando encontrás lo que funciona, registralo para replicarlo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 105,
        "vn": 11,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -10",
        "cardDesc": "",
        "videoId": "1m8MrDbKI2vhTYjfCMuPteWJDD4jDy8To",
        "resumen": "Esta clase de **Marketing Perpetuo por Email** recorre las **buenas prácticas** para cuidar la salud de tu cuenta y dominio, filtrar tu base y quedarte solo con los leads que realmente querés.\n\nLa premisa madre: **evitar la casilla de spam**. Caés ahí si alguien te marca como spam o si el algoritmo detecta que tus mails no se abren ni reciben clics.\n\nPuntos clave que remarca:\n- **Permiso explícito**: que la gente entienda a qué se suscribe y respetar eso. Segmentar y honrar tus pilares temáticos; el foco siempre en el **valor** prometido.\n- **Doble aceptación**: un primer mail de confirmación que filtra y deja entrar solo a los comprometidos.\n- **Crear expectativas**: consistencia de contenido, frecuencia, tono, visual y una **dirección de mail siempre igual**. Si cambiás algo, avisalo.\n- **Segmentación** con etiquetas y listas: da orden, ayuda a entender la experiencia del cliente y a **excluir** a quien ya compró (no bombardear).\n- **Desuscribirse simple**: link visible y accionable en cada mail. Si no lo encuentran, te marcan spam. El mejor \"hack\" es aportar valor real.\n- **Limpiar la base**: contacto sin abrir ni clickear en ~3 meses entra por tag a una automatización de **reengagement** (1-2 mails que revivan o dejen ir).\n- **Contactos fríos**: si rompés la cadena (2-3 meses sin enviar, o nunca arrancaste), el permiso caduca; mandá un **mail de reconciliación** recordando el propósito.\n\nEjemplo propio: el newsletter fue cambiando de formato y se lo comunicaban a la comunidad, que hasta votaba si prefería la versión nueva o la anterior.\n\nConclusión: todo se reduce a **cuidar tu base de datos**, mantenerla actualizada y saludable, con gente 100% interesada en lo que hacés.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 106,
        "vn": 12,
        "grupo": "Marketing Perpetuo · Email / Newsletter",
        "modulo": 6,
        "titulo": "MKT Perpetuo -11",
        "cardDesc": "",
        "videoId": "1gPRELe7I42_j0pGMRclFJmnsVneDkV-7",
        "resumen": "Esta clase de **Marketing Perpetuo por Email/Newsletter** se centra en qué medir en tus campañas de mail. Aunque hay muchísimas métricas, el instructor propone hacer foco en **tres fundamentales** para poder iterar y aprender en el hacer:\n\n- **Open Rate (tasa de apertura):** cuántas personas abren tus mails. Te dice qué tan efectivo fue el **asunto**. Depende mucho de tener una **base de datos limpia y optimizada**: si hay gente que se suscribió y ya ni recuerda por qué, no va a abrir nada y te tira el porcentaje abajo. Por eso se apunta a **calidad de leads, no cantidad**. Una métrica saludable ronda el **30-40%**, aunque él aclara que no le gustan las métricas genéricas: enviá tus primeros mails, sacá tu **Open Rate promedio** y apuntá siempre a superarte a vos mismo.\n\n- **Click Rate:** porcentaje de suscriptores que hacen clic en uno o más enlaces del mail respecto al total enviado. Mide la efectividad del **contenido** y qué tan claro estuvo el **call to action**. Si falla, probablemente estás presentando mal ese CTA final.\n\n- **Conversion Rate:** porcentaje de suscriptores que completan la **acción específica** buscada (una compra, llenar un formulario, agendar un Calendly). Indica si el mail logró el objetivo de la campaña.\n\nLa idea central es **medir estos números minuciosamente en cada mail**, compararlos siempre contra tu propio historial y optimizar constantemente. El instructor insiste en no anclarse a lo que alguna vez funcionó, porque el marketing, la retención y la tolerancia de las audiencias cambian y fluctúan muy rápido. Para iterar bien hace falta traer los **datos de cerca** y aprender de la experiencia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 107,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo",
        "cardDesc": "",
        "videoId": "147lQ9gfpEGWaRI_Mnkm7wP-cFT71sX9G",
        "resumen": "Esta clase abre la serie sobre el **podcast** dentro del **Marketing Perpetuo**, presentándolo como una **plataforma de nutrición** que vive en el medio del funnel. Sofía recuerda la anatomía del funnel: arriba está el **contenido corto** (reels, posts, artículos de TikTok, Instagram, Facebook, LinkedIn) que capta audiencia, y en el medio el **contenido largo de nutrición** (YouTube, newsletter y, acá, el podcast) al que se direcciona a esa gente para **nutrirla, posicionarte, generar confianza y autoridad**, y convertir a desconocidos en potenciales clientes.\n\n**Puntos clave que remarca:**\n- **Caso real \"Pasada Acción\"**, el podcast de Sofía lanzado en **2023**: con memes, historias y posts en Instagram/Facebook/LinkedIn concentrados en el lanzamiento, a los **3 días** llegó al **puesto 2 de los más escuchados de Argentina**. Hoy sigue en el **top 10 argentino** y ya entra en rankings de **México, Colombia y Chile**. La razón de sostenerlo en el tiempo es, justamente, el **marketing perpetuo**.\n- **Por qué el podcast nutre:** implica un **nivel de compromiso mucho mayor** que el contenido corto. Ver Instagram en el sillón deslizando pantalla es casi automático; escuchar un podcast exige una **acción consciente**: dar clic, ir a otra plataforma, sentarse a escuchar episodios largos.\n- **Anclaje a hábitos cotidianos:** la gente escucha podcasts yendo al trabajo en auto o transporte público, saliendo a caminar o correr, en el desayuno. Ese anclaje te da **más tiempo y más espacio para aportar valor** y construir vínculo (10 minutos de escucha vs. un minuto y medio de scroll).\n- **La meta:** generando contenido **sistemáticamente** y sosteniendo la rueda, te hacés **parte de la rutina** de tu \"lincho dorado\" (cliente ideal), y con el tiempo eso crea vínculo, posicionamiento, confianza y autoridad.\n\n**Conclusión:** es la lección introductoria del bloque; a partir de acá se ve **cómo pensar el podcast desde cero**, lanzarlo y hacer girar la rueda con la maquinaria del marketing perpetuo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 108,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-01",
        "cardDesc": "",
        "videoId": "1EIu2rzTI-TMDb5cO7M7RK88rMPaa_4vM",
        "resumen": "Primera clase del bloque de **Podcast** dentro de **Marketing Perpetuo**: Sofía te lleva a tomar las **decisiones estructurales** que fijan la expectativa de tu audiencia sobre qué van a encontrar al dar play. Todo se decide en base a **dos variables**: tu **nicho dorado** y sus hábitos de consumo, y tu **tiempo, foco y recursos** (lo que puedas **sostener en el tiempo** sin romper la cadena de creación, clave sobre todo al principio para generar el hábito de escucha).\n\n**Puntos clave que remarca:**\n- **Frecuencia:** diaria, semanal o mensual. Decidila por lo que puedas sostener.\n- **Duración:** cortos (**5-15 min**), medios (**15-40 min**) o largos (**40 min a 1 h+**). Se complementa con la frecuencia: **mensual → largo** (una sola chance al mes, aprovechá para aportar más valor); **semanal → corto o medio**; **diario → corto**, como \"pastillas de contenido\" (un episodio largo diario genera dolor de escucha). Su **recomendación: semanal + corto/medio**, porque crea el hábito de escucha y baja la barrera de producción.\n- **Miniatura:** no te vuelvas loco con el diseño. Tres claves: **mantenerla simple**, **colores que contrasten** (blancos o llamativos que despeguen del fondo) y **figura humana** (las personas conectan con personas). \n- **Calendarización:** definí **día y horario fijos** y sostenelos; sugiere **10:00 a.m.** o **18-19 h** (al salir/entrar de la oficina o al correr), pero validalo con tu audiencia.\n- **Formato:** **unipersonal** (un solo host aportando valor) o **entrevista** (host que invita referentes del nicho). La entrevista **exige mucho más** (buscar, seleccionar, traer y grabar invitados): elegí según tu nivel.\n\n**Ejemplos:** su podcast **\"Paso a la acción\"** (semanal, sale los lunes, ~10-15 min, unipersonal, portada amarilla). Portadas modelo: *Psicología al desnudo* (Marina Mammoliti, fondo violeta), *Tag arriba para la CEO* (fondo negro con placa blanca), Moria Casán, *The Tim Ferriss Show*. Formato entrevista: *Tementes* (Diego Barajas) y *Épicamente* (negocios y marketing en México).\n\n**Conclusión:** estos parámetros son los cimientos del podcast. Investigá qué hace tu competencia, **bajá la barrera de entrada** y definí cada punto en función de tu nicho y de lo que puedas sostener antes de avanzar.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 109,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-02",
        "cardDesc": "",
        "videoId": "1VpvPtD_CisHSJW0-Cf8-XwBxx12mpMCs",
        "resumen": "Segunda clase del bloque **Podcast** dentro de **Marketing Perpetuo**: las **mejores prácticas para crear cada episodio** de tu podcast, ya sea reciclando contenido o armándolo desde cero.\n\n**Puntos clave que remarca:**\n- **Bajá la barrera de entrada**: no te abrumes. Cualquier contenido que aporte valor y tenga **audio de calidad** (que se entienda, no que sea profesional) sirve de primer episodio. Si no tenés qué reciclar, creá desde cero volviendo a **Master Copy** y **estructura de contenidos ganadores**: inicio + **hook**, nudo (punto de dolor) y desenlace (la solución donde te posicionás).\n- **Audio grato de escuchar**: sin ruidos ni interrupciones; una de las principales razones de abandono es que no sea cómodo de oír. No hace falta micrófono pro — sirve hasta el de los auriculares; muchos empezaron grabando dentro de un placard.\n- **Títulos = tu primer hook** (hay dos hooks: el título y los primeros segundos del audio). Debe generar **curiosidad + identificación**. Fórmulas que funcionan: **\"Cómo\" + resolución del dolor** (\"Cómo vivir más livianos\", \"Hacerse rico en 2024 sin ser experto\"); **\"Por qué\" + dolor** (\"¿Por qué los cambios no siempre son algo malo?\"); **punto de dolor + solución** en versión corta (\"¿Te cuesta arrancar? Gana la procrastinación con estos hacks\"). Recomienda variarlos y validarlos con tu nicho.\n- **Evitá las intros genéricas**: la musiquita igual de 5-10s desperdicia los segundos más valiosos. Abrí con el hook/pregunta y, si querés, meté la intro después.\n- **Storytelling**: las personas conectan con personas. La métrica que define si un episodio funciona es el **porcentaje de retención** (cuánto tiempo se quedan escuchando); es la señal que usa el algoritmo para escalar. Planteá preguntas, dá soluciones y **prometé valor al final** (\"al final vas a ver los tres hacks…\").\n- **Mensaje de cierre y seguidores**: más seguidores = más pantallas donde se imprime tu contenido = más clics = más señal al algoritmo. Meté un **CTA a que te sigan** (al medio o al final).\n- **Enumerá tus episodios**: por lo psicológico (ver tu avance genera dopamina) y porque **ordena la experiencia** del oyente nuevo que llega y ve 40 episodios de valor. Sugiere el número **al final** (como en el podcast con Sofi) para no entorpecer la lectura del título; Tim Ferriss lo pone al principio (#número).\n- **Legales y derechos** (para que no te baneen el canal): no replicar contenido ajeno, **no usar música sin derechos** — usá la **librería gratuita de YouTube** (libre de derechos, link en el módulo) — y evitar nombres y logos de otras marcas.\n\n**Conclusión:** si no tenés contenido para reciclar, creá desde cero con Master Copy y la estructura de contenidos ganadores; si ya lo tenés, sé guardián de que el audio se escuche claro.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 110,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-03",
        "cardDesc": "",
        "videoId": "1YU1rRLyhov8IKwZZCYg1dHtgBkkd4l_L",
        "resumen": "Tercera clase del bloque **Podcast** (Marketing Perpetuo): una vez estructurado el podcast y aprendidas las buenas prácticas para crear episodios, Sofía explica **cómo funciona el algoritmo del podcast** y cómo configurar el **SEO** para que las plataformas te posicionen frente a tu público ideal. La idea de fondo: plataformas como YouTube permiten mucha profundidad de SEO (palabras clave, títulos, descripciones), mientras que el podcasting (tipo Spotify) tiene herramientas más acotadas, pero igual hay señales que podés mandarle al algoritmo.\n\n**Puntos clave que remarca:**\n\n- **Dos frentes a trabajar:** el algoritmo en sí y la configuración SEO (palabras clave, copies, títulos, todo lo que le da información al algoritmo para posicionarte). El objetivo siempre es **ser preciso** con las palabras que usás.\n- **Retención = primera variable.** El algoritmo prueba tu contenido con un segmento y, según cómo reaccionen, lo escala a más gente o lo frena. En podcast la señal de interés es **cuánto tiempo escucha la audiencia** (hasta qué minuto llegan en promedio). Por eso el **storytelling** (hooks, nudos, desenlaces) es clave para retener. Retención promedio saludable: **70%** — apuntá como mínimo a eso.\n- **Impresiones = segunda variable.** Cantidad de veces que tu portada o episodio aparece en pantalla. Más impresiones → más chances de clic; más clics + más retención → más señales de interés. Por eso necesitás **buena portada, buenos títulos y buenas descripciones**.\n- **Dos instancias de SEO:** la del podcast en general (al crearlo) y la de cada episodio.\n\n**Configurar el SEO del podcast:**\n- **Nombre/título:** nada de azar. Tiene que ser un **hook**, resumir el valor que aportás, hablar de tu nicho y ser **claro** para que la audiencia entienda. Ejemplos: *\"Pasa a la acción con Sofía Contreras\"* (te invita a algo práctico y accionable), *\"The Diary of a CEO\"* de **Steven Bartlett** (diario íntimo → lado B, secretos del mundo de los negocios), *\"Psicología al desnudo\"* (nicho claro + info democratizada).\n- **Descripción:** posicionamiento estratégico. Contá **brevemente quién sos, tu autoridad y qué valor/qué van a encontrar**, y meté palabras clave del título para reforzarlas. Ejemplo de **David Oviedo**: primero su recorrido (estaba quebrado, dejó la universidad, a los 18 armó una industria de lanzamientos) y recién al final de qué va el podcast. Ejemplo de **Sofía**: primero su carrera y autoridad (CEO de Mastery Haus, consultora), después qué vas a encontrar (herramientas y metodologías de productividad, mentalidad y negocios).\n- **Categorías:** agregá la **etiqueta** que mejor represente tu nicho (negocios, hábitos saludables, deportes…); es una señal fuerte de dónde mostrarte.\n- **Transcripciones:** activá el botón que pasa el audio a texto. No es súper preciso todavía, pero suma checks a la plataforma y las palabras refuerzan la idea de tu podcast y ayudan a la búsqueda.\n\n**Configurar el SEO de cada episodio** (hacerlo siempre que lances uno). En Spotify solo tenés **título y descripción**, no hay hashtags —por eso más adelante se ve la importancia de redirigir audiencias al canal. El **título** es el primer hook que define el clic e introduce palabras clave; el **copy** resume el tema del episodio **repitiendo esas mismas palabras clave** para duplicar la señal. Ejemplo: título *\"Cómo ganar el videojuego de los negocios\"* con un copy que repite \"negocios\", \"videojuego\", etc.\n\n**Conclusión:** el podcast da menos margen de SEO que YouTube, pero hay bastante por hacer. Dejá todo pulido y bien implementado (título, descripción, categoría, transcripción, retención e impresiones) para que el algoritmo detecte la información y te potencie frente a tu público ideal.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 111,
        "vn": 5,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-04",
        "cardDesc": "",
        "videoId": "1qFR8FbMf1ptqdNYgOYo-Mt7DDtsQ-bWX",
        "resumen": "Clase 100% práctica de **Marketing Perpetuo / Podcast**: un tutorial paso a paso para **crear y configurar tu perfil de creador en Spotify for Podcasters** (podcasters.spotify.com), con foco en dejarlo optimizado para SEO y para el algoritmo. El link y el paso a paso también están en el **libro de Marketing Perpetuo**.\n\n**Puntos clave que remarca:**\n\n- **Alta de cuenta:** primero necesitás una cuenta de oyente en **Spotify.com** (mail, fecha de nacimiento, contraseña). Con esa misma cuenta entrás a **podcasters.spotify.com**, te registrás y las cuentas se vinculan solas. Para poder publicar episodios hay que **verificar el correo** haciendo clic en el link que llega al mail.\n- **Configuración del canal (menú izquierda → Configuración)**, con tres solapas: **Información** (todo el detalle), **Disponibilidad** (distribuir a otras plataformas) y **Equipo** (versión beta, para sumar mails de tu equipo que gestionen la cuenta).\n- **Título:** pensalo estratégico, que haga clic con tu audiencia y funcione como **adelanto del valor** del canal.\n- **Descripción:** primero **posicionarte** (destacar desde qué lugar hablás, eso sienta tu autoridad) y luego un párrafo sobre la temática (\"en este podcast vas a encontrar las herramientas para…\").\n- **Mensajes de voz de oyentes:** función opcional para recibir feedback; no afecta el SEO, la activás según tu criterio.\n- **Autor:** el nombre del anfitrión (usa de ejemplo \"Juan Silviano\").\n- **Portada:** simple, que no abrume, **colores que contrasten**, título legible; si hay **figura humana** conecta más (\"las personas conectan con personas\"). Tamaño recomendado: **1400 × 1400 píxeles**, se sube desde el botón \"actualizar portada\".\n- **Etiqueta/categoría:** clave elegir bien (negocios, humor, educación, salud, etc.), porque el algoritmo te muestra a audiencias que escuchan otros podcasts de esa misma categoría. Ejemplo elegido: **negocios → marketing**. Además, **idioma** (elige español–Argentina) y si el contenido es **apto o explícito** (el canal de Sofía queda apto).\n- **Config solo de Spotify:** desactivar **recomendaciones de otros creadores** al final del episodio (no querés que la audiencia se fugue); en **episodio destacado del perfil**, dejar siempre el **último** para generar señales de interacción en los primeros segundos del lanzamiento (o un episodio de bienvenida si tu nicho debería empezar por ahí).\n- **Extras que ayudan al algoritmo:** activar **transcripciones** (audio a texto) y usar **capítulos** (fragmentos temáticos como en YouTube), automáticos o manuales marcando los minutos en la descripción (ej. 00:00 intro, 1:43 siguiente capítulo). También preguntas y respuestas automáticas, link del podcast, sitio web y redes sociales.\n- **Disponibilidad:** al lanzar el primer episodio se genera un **link RSS** que copiás y pegás en Amazon Music, Apple Podcast, Castbox y más para distribuir.\n- Todo esto **se puede modificar a futuro**, no es estático.\n\nUna vez guardado, la home muestra el **dashboard** con estadísticas (seguidores, oyentes mensuales, reproducciones, crecimiento) y la vista de episodios. **Monetización** existe (patrocinadores) pero acá no se usa.\n\n**Conclusión:** el proceso es intuitivo; lo estratégico es pensar bien **nombre, descripción y categoría**. La próxima lección cubre cómo configurar y programar un episodio. Es un trabajo de **validación, iteración y juego de largo plazo**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 112,
        "vn": 6,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-05",
        "cardDesc": "",
        "videoId": "1mmLGmtQC7LMqrrmC8bAxwoHkUkpwsKC8",
        "resumen": "Clase práctica del módulo **Marketing Perpetuo / Podcast**: el **paso a paso para programar un episodio** en la plataforma de podcasting (Spotify for Podcasters). Sofía muestra cada campo y deja recomendaciones de criterio, no solo el \"dónde clickear\".\n\n**Puntos clave que remarca:**\n- En la **página de inicio** ves tus métricas (reproducciones, seguidores, performance del canal). Para cargar, vas al menú izquierdo → **Nuevo episodio**.\n- Se pueden subir **audio y video**. El video todavía no está optimizado (siguen trabajando los algoritmos), pero es viable si querés validarlo.\n- La edición interna de audio (cortar, unir, música, efectos) **están por quitarla** y migrarla afuera, a **Riverside**. Su consejo fuerte: **llegá a esta instancia con la pieza final ya terminada**, para no depender de plataformas externas ni quedar colgado si la página cambia o se rompe.\n- **Título:** dejá **limpia la primera parte** para agilizar la lectura y poné el **número de episodio al final**, así la audiencia nueva ve hacia atrás cuánto contenido hay (formato de \"títulos ganadores\").\n- **Descripción:** un copy corto sobre la temática, con opción de **agregar links** (marcás la palabra → opción link → pegás la URL) para un call to action hacia otra parte del funnel o contenido de nutrición. Hay negrita, cursiva e ítems.\n- **Fecha de publicación:** ahora o **programada**. Ideal para trabajar por **batch**: si tenés contenido en tu **bóveda**, lo dejás programado y te olvidás de la config.\n- **Contenido explícito:** marcar sí/no según malas palabras o aptitud de público.\n- **Contenido promocional:** su recomendación firme es **dejar el panel de nutrición libre de marcas** (marcar \"no\"). Es un espacio para generar vínculo con la audiencia; no venderles, y menos algo que es de otros. Eso da **más credibilidad y confianza**.\n- **Información adicional:** si es episodio completo o avance, número de temporada y de episodio. La **portada** toma la del podcast automáticamente; sugiere **no** poner una específica por episodio para mantener todo unificado y sin confusión.\n- Luego **Siguiente** → página de **interacciones**: preguntas y respuestas automáticas y **encuestas** (¿te gustó?) para incentivar comentarios y aportar valor.\n- Al final se **revisa y se programa**. En el video no puede programar porque es una cuenta de prueba sin la verificación hecha.\n\n**Conclusión:** dominá la mecánica de carga, pero sobre todo llegá con la pieza final lista y cuidá la nutrición manteniéndola sin publicidad para no romper la confianza con tu audiencia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 113,
        "vn": 7,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-06",
        "cardDesc": "",
        "videoId": "1Fqxgszy6-ddHFZdUdJQMR9uJDFowdhP1",
        "resumen": "Este episodio del módulo **Marketing Perpetuo / Podcast** cierra la serie: ya se vio por qué el **podcast es una plataforma de nutrición** dentro del funnel, cómo estructurarlo, cómo crear o reciclar episodios y cómo configurar el canal. Acá el foco es **calendarizar y distribuir** los episodios, sirva para un **lanzamiento desde cero** o para una publicación sistemática ya en marcha.\n\n**Puntos clave que remarca:**\n- **Requisito previo: la bóveda de contenidos** pulida y lista. Es una carpeta en Drive, bien rotulada y fácil de encontrar, que contiene todo el contenido largo y corto listo para publicar (si hay dudas, volver a la lección de **pirámide de contenidos**).\n- **Repaso del flujo:** (1) **crear o reciclar** el episodio —cualquier contenido con audio claro que aporte valor sirve: entrevistas, sesiones 1-1, videos viejos de YouTube; Sofía cuenta que ellos lanzaron con audios de sus videos de YouTube para bajar la barrera de entrada. Si no hay material, se crea desde cero con **estructura de contenidos ganadores** y el **master copy**. (2) De cada contenido largo salen **piezas cortas** (posts, cortes para reels, fragmentos para artículo de LinkedIn). (3) Registrar cada pieza en la **plantilla de stock de contenidos** (el Excel con nombre de pieza y redes) y volcarlas al **calendario de contenidos mensual**.\n- **La limitación de las plataformas de podcast:** a diferencia de Instagram o YouTube, Spotify **no permite generar movimiento de audiencia dentro de la plataforma** (no podés mandar de una historia al post, ni de un short al video). Por eso el objetivo es **traer audiencia desde afuera** hacia el podcast: del contenido corto al contenido de nutrición.\n- **Regla madre:** el **contenido corto dirige al contenido largo de nutrición**, y **TODA** pieza debe llevar un **call to action** (\"hacé clic acá para escuchar el episodio completo\" o \"respondeme *podcast* y te mando el link\").\n- **El objetivo es un pico de audiencia** en el momento del estreno: como enseña la lección de algoritmos, los primeros segundos definen si el algoritmo detecta interés. Para eso hay que **generar expectativa previa** y tener gente lista para accionar en ese instante.\n- **El calendario en acción:** ellos lanzan el podcast los **lunes**, y ese día **todas las plataformas direccionan al podcast** (cada color del calendario es una red: violeta = Instagram; H = historia, P = post/podcast → historia y post de Instagram van al podcast; LinkedIn y Facebook con posts; reel en TikTok; post en YouTube). Todos los lunes buscan el pico de escuchas.\n\n**Ejemplo real (lanzamiento de marzo 2023):** empezaron a **fijar expectativas con anticipación**. El **5 de marzo** mandaron un mail al newsletter (el \"cortito\") anunciando que venía el podcast, faltando ~10 días. El **4 de marzo** subieron historias tipo tráiler con portada, recorte de audio y cierre \"próximamente en Spotify\", generando momentos wow. Un día antes volvieron a avisar por email que el **lunes 13 de marzo** salía en todas las plataformas. El **día del lanzamiento** sacaron un post con CTA \"dejá la palabra *podcast* y te envío el link\", replicado en LinkedIn, Facebook e historias; recibieron muchísimos comentarios porque la audiencia ya venía preparada. Los días siguientes siguieron con **storytelling** en historias contando el logro (**puesto 26**, luego **puesto 3** y **puesto 2** en el ranking de Argentina), agradeciendo y **haciendo parte a la comunidad** —porque quien se siente parte de algo, interactúa más.\n\n**Cómo se aplica hoy, semana a semana:** un episodio (largo → Spotify) se fragmenta en un **reel con animaciones y audio de Sofía** que se publica en YouTube, Instagram, LinkedIn, Facebook y TikTok, más **posts**; y **todos los domingos** el newsletter tiene un espacio exclusivo con el episodio de la semana. En las historias del lunes arrancan con un **hook** sobre un dolor, plantean la solución e invitan a hacer clic al podcast.\n\n**Conclusión:** así funciona la **maquinaria de marketing perpetuo** y la **pirámide de contenidos**: top of funnel = contenido corto que atrae; medio del funnel = contenido de nutrición (el podcast). Del corto se dirige al largo, se nutre, se genera vínculo, confianza y autoridad, y se construye una relación a largo plazo que eventualmente convierte en clientes. Las tres claves: **bóveda de contenidos**, **entender la pirámide** y que **absolutamente todo el contenido lleve un call to action** hacia el contenido largo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 114,
        "vn": 8,
        "grupo": "Marketing Perpetuo · Podcast",
        "modulo": 6,
        "titulo": "MKT Perpetuo-07",
        "cardDesc": "",
        "videoId": "1cAFS_A43F1t7nkAQe7jauTN28uTuPuv9",
        "resumen": "Esta clase del módulo **Marketing Perpetuo / Podcast** se mete de lleno en **qué medir en un podcast**, y la métrica reina es la **retención de audiencia**: el porcentaje promedio de escucha de un episodio, es decir, cuánto tiempo en promedio lo escuchan las personas del total de la audiencia.\n\nPuntos clave que remarca:\n- **Por qué importa:** la retención le da señales al algoritmo (Spotify) de que tu contenido es interesante, y así lo muestra exponencialmente a más segmentos de audiencia. Subirla depende de **saber contar buenas historias** que capten y sostengan la atención en el tiempo, apoyándote siempre en tu **master copy** y tu **estructura de contenidos ganadores**.\n- **El número de referencia:** un **60% es una retención saludable** y el piso mínimo al que apuntar; el objetivo es siempre superarlo.\n- **Dónde verlo:** en la plataforma de podcasters, entrás a la sección **Episodios** del menú lateral, hacés clic en cualquiera y se abre la página con el porcentaje de retención.\n- **Tu propio promedio:** más allá del 60%, hay que **llevar un registro** de tu retención a lo largo del tiempo, sacar tu promedio y apuntar a superarlo. Si bajó, buscar el insight de qué se hizo distinto para no repetirlo; si subió, ver qué se hizo bien y replicarlo.\n- **Duración vs. retención:** cuanto **más largo el episodio, más tiende a bajar la retención** porque la gente abandona; por eso conviene estandarizar duración y frecuencia para poder medir con lógica.\n\n**Ejemplo:** una captura de un episodio del podcast *Pasar a la Acción* de Sofía muestra un **88% de retención**, por encima del 60% saludable.\n\n**Conclusión:** con la frase que repite Sophie —**\"todo lo que se puede medir, se puede mejorar\"**—, la idea es seguir de cerca la retención para entender qué funciona, mejorarlo y llegar a nuevas audiencias. Y ahora sí, a pasar a la acción y poner a correr tu podcast.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 115,
        "vn": 1,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube (main)",
        "cardDesc": "",
        "videoId": "1TWlMAPyLp2exbBEjqyked8NsFvjRsCzL",
        "resumen": "Arranca el paso a paso de **Dominar YouTube** y todo empieza por lo mismo: **definir los temas**. El gran dolor al crear contenido es quedarse sin ideas, así que la clase te da un sistema para que la maquinaria nunca se detenga. Prerrequisito: tener listo tu **personaje legendario**, tus **pilares temáticos** y tu **master copy** (si no, volvé a esa lección).\n\nRecordá la **maquinaria de marketing perpetuo**: grabás **contenido largo de 15 a 20 min** y de ahí fragmentás reels (TikTok, Instagram, Facebook, LinkedIn), audio para podcast, posts y artículos. YouTube es plataforma de **nutrición y branding**: generás vínculo, valor real, confianza y autoridad, siempre hablándole a tu **nicho dorado**.\n\nCómo armar los pilares:\n- **Pregunta 1:** ¿cuáles son los **3 temas** que te interesan a vos y a tus potenciales clientes?\n- **Pregunta 2:** desglosá cada tema en **3 subtemas** para no quedarte acorralado en temas gigantes. Cada subtema dispara ideas de videos.\n- Usá **YouTube como motor de búsqueda**: si al buscar tu tema aparecen videos viejos, es señal de **océano azul**; creás ese contenido con **SEO** correcto y el algoritmo trabaja para vos.\n\nEjemplo propio: 3 pilares —**negocios, productividad y mentalidad**—, siendo negocios el central. En negocios, subtemas como servicios, escalables y sistemas; ideas: la mentalidad para tener negocios, el detrás de escena, las herramientas del día a día.\n\nPuntos de gestión que remarca:\n- Volcá todo en una **plantilla de ideas** (bóveda) en ClickUp o Google Sheets, para que al grabar solo grabes.\n- Asigná **porcentajes**: 60% negocios, 20% productividad, 20% mentalidad. El pilar principal le habla al nicho; los secundarios son tu **diferencial** y construyen marca.\n- Ordená la experiencia con **listas de reproducción** por bloque, para que se consuma como una serie de Netflix (el SEO se profundiza más adelante).\n\nConclusión: los **temas son el punto de partida** de todo lo que crees; bien definidos, bajan el dolor de pensar ideas y ordenan tu canal.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 116,
        "vn": 2,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -01",
        "cardDesc": "",
        "videoId": "1XWDOIfK2E5JHYRlHWxif7LK8BJK1_qdW",
        "resumen": "Este clip del módulo **Marketing Perpetuo (YouTube)** muestra, en concreto, cómo **organizar la producción de contenido** una vez que ya tenés definidos tus **pilares temáticos**: el sistema para pasar de una idea suelta a un guion listo para grabar. Sofía y su equipo lo hacen en **ClickUp**, pero aclara que podés replicarlo en **Google Sheets** o **Word**: lo que importa es mantenerlo **simple** y llegar al día de grabación con todo pulido para hacer foco solo en grabar.\n\nPuntos clave que remarca:\n- **Estructura en ClickUp:** una carpeta \"YouTube\" con dos listas —**Ideas** y **Videos full** (videos listos para publicar o publicados)— más un documento tipo Sheets de \"ideas random\" que funciona como **memoria externa** y se filtra hacia la lista de ideas.\n- **Template de cada idea (columnas):** nombre/acercamiento al título, **responsable asignada** (en su caso Mica, a cargo del contenido), **categorías** = pilares temáticos (negocios, productividad, mentalidad; sumaron entretenimiento y libros), y **estado** (en proceso, revisión, ajustes, terminado).\n- **Instancia de check con Sofi siempre:** cada idea terminada se le asigna para su feedback; si hay correcciones deja el estado en \"ajustes\" y el equipo la retrabaja hasta \"terminado\". Si delegás esto, tené tu propia instancia de revisión.\n- **Dentro de la tarjeta (desplegable del template):** el **script de video** con la estructura **hook, introducción, nudo y desenlace**, desarrollados brevemente como disparadores para grabar; más campos de tamaños/títulos, **ideas generales** e **inspiración/referencias** (ejemplo: guardaron info de un video de **Alex Hormozi** como referencia).\n- **Flujo final:** cuando la estructura está cerrada, la tarea pasa de la lista de **Ideas** a la de **Videos full**, arrastrando la tarjeta (sin tocar nada aunque salga el cartel), lista para grabar o publicar.\n\nConclusión: pasar en limpio y mantener el orden simple para poder **accionar**; elegí la herramienta que mejor calce con tu estructura, pero llegá a grabar con los guiones listos.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 117,
        "vn": 3,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -02",
        "cardDesc": "",
        "videoId": "1IVmOP3bkvTle2VZ19i3kK9OxH3KZLOb3",
        "resumen": "Esta clase, la segunda de **YouTube**, arranca donde quedaron los **pilares temáticos** de tu marca y encara el primer paso de la estrategia: conseguir que tu contenido escale logrando **clics**. Y los clics se ganan con el **primer hook: thumbnail (miniatura) + título**, pensados siempre en conjunto. La regla de oro es que los definas **antes de guionar, grabar o editar**, porque no tiene sentido invertir tiempo si nadie va a hacer clic. De hecho, los grandes creadores le dedican la mayor parte del tiempo a esto.\n\nSobre el **título**, tiene dos funciones: meter **palabras clave** (el algoritmo lee todo el texto para posicionarte) y funcionar como hook que aporta valor y genera curiosidad. Para dar con buenos títulos te metés en la cabeza de tu **nicho dorado** (qué buscan, qué necesitan aprender) y aplicás estos recursos:\n- **Preguntas** (\"¿Cómo ganar en épocas de crisis?\")\n- **Números / rankings / pasos** (\"7 maneras de que te compren más veces\", de Alex Hormozi) que ordenan la idea\n- **Problema + solución** (\"Mi honesto consejo a alguien que se siente atrás en la vida\")\n- **Urgencia y escasez** (\"solo el top uno domina esto\")\n- **Transformación** de un estado A a uno B (\"cómo pasar de cero a millonario\")\n\nSobre las **miniaturas**, alinealas con tu identidad de marca (colores, iconografía, tu imagen personal, tu personaje legendario). Recomendaciones:\n- **Simples y claras**, imagen de alta calidad, pocos elementos\n- **Pensadas para móvil** (entre **50 y 70%** consume en celular): sin textos chicos ni ilegibles\n- **Humanización**: presencia humana que genere conexión\n- **Regla de los tercios**: los elementos clave en las intersecciones, con colores que contrastan (ejemplos de Eloísa Wolf y MrBeast)\n\nCierre: título e imagen tienen que comunicar **una idea en sí misma**. A practicar y validar cada punto con tu nicho.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 118,
        "vn": 4,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -03",
        "cardDesc": "",
        "videoId": "16zyU0t6Gr6jFEn3wxNmjoCMnrKV-dch_",
        "resumen": "Esta clase de **Dominar YouTube** desmenuza la **prueba A/B/C de miniaturas** (el test de thumbnails de YouTube Studio), la herramienta para optimizar tu **tasa de clics** con datos reales.\n\nDe qué va: la **miniatura y el título** son el primer **hook** del video y deciden si alguien hace clic o no. Por eso hay que definirlos ANTES de guionar y grabar: son el disparador de todo lo demás. La herramienta te deja **probar 3 miniaturas a la vez**, pero ojo, solo cambia la miniatura, NO el título. Las variantes tienen que hacer sentido con ese título fijo.\n\nPuntos clave que remarca:\n- Pensá mínimo **3 títulos y 3 miniaturas** por video: YouTube es una plataforma de **iteración** constante, sin límite de veces.\n- El algoritmo elige ganadora mirando **CTR** (clics sobre las impresiones) y **watch time** (cuánto se queda la gente). No gana solo la que más clics trae, sino la que atrae **audiencias de calidad**.\n- Paso 1: probá 3 miniaturas **bien distintas** entre sí, primero con tus suscriptores/audiencia cercana.\n- Paso 2: con la ganadora, corré otro test con variación **mínima** (de lo macro a lo micro), que YouTube muestra a audiencias más amplias.\n\nEjemplo: probaron 3 miniaturas muy diferentes y ganó la del medio con **37,7%** frente a 31 y 30 de las otras. Un segundo test, con miniaturas más parecidas, sigue corriendo (faltan ~12 días); un resultado contundente puede tardar de **24 h a semanas**.\n\nConclusión: si el video rinde bien, quedate con la ganadora hasta que deje de escalar; después seguí iterando. Registrá los datos y decidí siempre en base a ellos para validar qué funciona con tu nicho y hacer crecer el canal.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 119,
        "vn": 5,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -04",
        "cardDesc": "",
        "videoId": "1-RA5Lv6k-X4lNTLmiPXvBhPC4WQaj4NU",
        "resumen": "Con los **pilares temáticos**, el tema, el **thumbnail** y el **título** ya definidos, esta clase te enseña a **guionar** el video. No hace falta escribir palabra por palabra: alcanza con una **columna vertebral** para que a la hora de grabar solo tengas que enfocarte en grabar. Complementá siempre con tu **estructura de contenidos ganadores**, tu **master copy** y tu **personaje legendario**.\n\nPuntos clave que remarca:\n- El juego es **captar la atención y retenerla**: YouTube es la **plataforma de nutrición por excelencia**, donde nutrís al lead que llegó del contenido corto aportando **valor real** (calidad no es equipo técnico, es valor).\n- **Congruencia** título/thumbnail: nada de **clickbait**. Si prometés algo que no cumplís, la gente abandona, cae la **retención** y el **algoritmo** deja de mostrarte. El **watch time** y el **CTR** dependen de esto.\n- Estructura del video: **hook** (primeros 3 segundos, planteás el punto de dolor) + **promesa de valor** (qué van a llevarse si se quedan) → **desarrollo** (el cuerpo, con **storytelling**, sin divagar) → **cierre** + **call to action**.\n\nEjemplos concretos: el **hook** de un video de Sofía abre con \"no sabemos el significado de la vida, pero podemos hacer que la vida de cada uno sea significativa\" (sobre encontrar propósito). La **promesa de valor**: \"el sistema de 5 pasos para una semana altamente productiva, un libro recomendado y 3 hacks\".\n\nSobre el **CTA**: pedí **comentarios** (y respondelos), **suscripciones** y **activar la campanita**. Como YouTube tiene CRM (es de Google, como Gmail), la notificación manda un mail al suscriptor en cada estreno. Mostrá siempre el valor de suscribirse.\n\nConclusión: dejá esta estructura punteada en tu **template de ClickUp o Google Sheets**, centralizando todo en un solo lugar para grabar contenido eficiente y de calidad.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 120,
        "vn": 6,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -05",
        "cardDesc": "",
        "videoId": "12i8xsl7gsO58EPANntRolUNg2H30_PAC",
        "resumen": "Esta clase de **Dominar YouTube** cubre los dos pasos que siguen a tener listos pilares, ideas, thumbnails, títulos y guión: **grabar** y **editar**. La premisa: llegar al día de grabación con la mente puesta solo en grabar, y **bajar la barrera de entrada**. No hace falta equipo profesional; alcanza con claridad de imagen y de sonido (cámara de celular + micrófono de auricular). Sofía arrancó reciclando videos de sesiones 1‑1.\n\n**El sistema de 5 pasos (con equipo):**\n- Completar el **template de ideas**.\n- Definir la **escenografía**, ligada a tu **personaje legendario** y branding.\n- Chequear **equipo técnico** (cámaras, luces, micrófonos, set).\n- **Congelar la agenda**: bloquear el día para grabar, sin multitasking.\n- **Grabar** siguiendo el script.\n\nCon esto, en una jornada de **6 h** producen hasta **8 videos largos** = **2 meses de contenido** (publican 1 video los miércoles, 4 por mes). Versión sin equipo: misma lógica, con celular, buena ventana para iluminación y una persona que te ayude a grabar; no busques la perfección, buscá aportar valor.\n\n**Edición: 3 niveles (metodología Master):**\n- **Simple:** solo cortes, cámara fija (ej. webinar de Sofía; estilo Denkoo/Vanessa Lu).\n- **Media:** música, zoom, transiciones, textos, emojis, stock (ej. video de Sofía verano 2024; Cody Sánchez con billetes y casa).\n- **Compleja:** efectos especiales/animaciones (Alex y Leyla Hormozi, Ali Abdal).\n\nLa decisión se **mide con tu audiencia**; el foco siempre es el **storytelling**. Solo: usar **Vid** o **CapCut**. Con editores: hacerlos parte de tu cultura, mostrar referencias, dar **feedback claro de una sola vez** y armar un **manual de edición**. Organizá todo en carpetas nomencladas, dá feedback minuto a minuto en un documento, y **descargá la carpeta final para que el contenido sea tuyo**.\n\n**Conclusión:** pasá a la acción, no busques perfección: bajá la barrera y generá el hábito de crear.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 121,
        "vn": 7,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -06",
        "cardDesc": "",
        "videoId": "1Zg3nr8F5qx76k-SXgqRzeGSDQ_D_t2G9",
        "resumen": "Ya con el contenido grabado y editado, esta clase entra en el momento de **publicar y programar**, y ahí aparece la estrella: la **configuración SEO**. La idea de fondo es que YouTube es un **motor de búsqueda** con el algoritmo más avanzado y **evergreen** (el contenido no caduca), por eso es la plataforma clave del **marketing perpetuo**. El objetivo: que YouTube te recomiende a tu **nicho dorado** en videos sugeridos, exploración y páginas de inicio.\n\nPuntos clave que remarca:\n- El algoritmo **escanea el thumbnail** (imagen y textos), **cada fotograma del video** y arma su script. Todo lo que pongas son señales.\n- Apoyate en **VidIQ** (extensión en el navegador): puntúa tu SEO en vivo, genera títulos con IA (la paga da muchos, la gratis 2-3) y tiene **inspector de etiquetas**. Alternativa: ChatGPT.\n- **Título**: valor adelantado + curiosidad, con palabras clave.\n- **Descripción en 3 partes**: copy de 5-6 líneas repitiendo palabras del título; **timeline** de capítulos (escribís \"timeline\" + los minutos, ej. 00:00 intro, 02:05, 02:54 \"la fórmula del éxito\"); y bloque de **posicionamiento/marca** (quién sos, por qué quedarse).\n- **Etiquetas**: como hashtags, son refuerzo (mínimo 20, máx 500 caracteres). Pensá cómo buscarían tu video e incluí siempre tu marca (\"Sofía Contreras negocios exitosos\").\n- **Triplicá** las palabras clave entre título, descripción y etiquetas para reforzar la señal.\n- **Tarjetas**: usalas con cuidado, mejor para llevar a otros videos del canal (o a una landing/call solo si el fin es venta).\n- **Pantallas finales**: pensá como Netflix/serie: botón de suscripción + 1-2 videos propios relacionados. Si no las configurás, el algoritmo puede mostrar a tu competencia.\n- **Listas de reproducción** por pilares (productividad, negocios, mentalidad): primero los videos más largos y que mejor funcionaron.\n- **Comentario fijado**: para interactuar y meter un CTA a otro video o b-sale.\n\nConclusión: trabajá el SEO a fondo apoyándote en la IA para darle al algoritmo señales claras y que tu contenido llegue a quien querés.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 122,
        "vn": 8,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -07",
        "cardDesc": "",
        "videoId": "1mlYGkmlcPHx-1ndfGyd_Iap7WA0-rnpN",
        "resumen": "Antes de dar el último clic para lanzar tu video de YouTube (ya con título, thumbnail, video, descripción y **SEO** pulidos), esta clase te da las **buenas prácticas** para programar y difundir el contenido y poner el algoritmo a tu favor.\n\nPuntos clave que remarca:\n\n- **Programá el video como un estreno.** YouTube te deja publicar en privado, al momento, o programado. Y dentro de programado hay dos variantes: programación normal (a la hora elegida se publica) o **estreno**. La diferencia: en el estreno, al dar el clic ya aparecen el **thumbnail y el título** en pantalla de los usuarios. Eso empieza a generar movimiento en el algoritmo y capta audiencias, así al publicarse ya hay gente esperando y se genera un **pico de interacción** en los primeros segundos (la señal que le dice al algoritmo que sos relevante). Hay una casilla abajo de todo para tildar el estreno.\n- **Apalancate en el propio YouTube.** Shorts, contenido largo y publicaciones tienen algoritmos distintos. Fragmentá el video largo (**pirámide de contenidos**) y el mismo día publicá un short y una publicación para dirigir audiencia al largo. Tip: al subir el short usá la pestaña **\"agregar video vinculado\"** para conectarlo con el video del que salió.\n- **Apalancate en tus otras plataformas.** Si el miércoles sale tu video de nutrición, ese día desagregás el largo en reels, textos y posts para Instagram, TikTok, Facebook, LinkedIn y un mail a toda la base, todo apuntando al video largo.\n- **Interactuá en el chat del estreno.** Aparece un chat lateral: estar presente genera cercanía y confianza, y cada interacción (chat o comentarios) le da señales de interés al algoritmo.\n\nConclusión: al lanzar, el objetivo es **generar la mayor cantidad de señales** posibles hacia tu canal para que el algoritmo trabaje por vos y escale tu contenido.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 123,
        "vn": 9,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -08",
        "cardDesc": "",
        "videoId": "14FqYIsGBQR7hHw1248GTP54jVYUF0JPM",
        "resumen": "Este video es un **paso a paso** para subir un video a YouTube desde cero, dentro del bloque de Marketing Perpetuo en YouTube. Arrancás desde el botón **Crear** (esquina superior derecha), elegís el archivo y, mientras carga, vas completando la configuración SEO.\n\n- **Título**: la palabra clave principal.\n- **Descripción** con tres partes: la descripción del video, el **timeline** (capítulos que arrancan siempre en `00:00` y van marcando qué pasa en cada minuto, ej. `01:34`, `05:32`) y la **descripción general** de posicionamiento (quién sos, tu negocio y el valor que aporta tu canal).\n- **Miniaturas (thumbnails)**: subís archivo propio o generás una prueba.\n- **Playlists**: sumá cada video a su pilar temático (en su caso: productividad, mentalidad o negocios).\n- **Etiquetas**: palabras clave que refuercen título y descripción.\n\nHay una **puntuación SEO de 0 a 50** en el panel lateral que te va guiando. Ojo con un bug de vidIQ: si el panel no aparece, guardás como borrador, cerrás y volvés a abrir la pestaña.\n\nDespués venís: monetización (si tu canal la tiene), clasificación de políticas, y los **elementos del video**: subtítulos automáticos, **pantalla final** (poné al menos un video propio relacionado más el botón de suscripción, tipo consumo en serie de Netflix, para no perder a la audiencia) y **tarjetas** (usalas solo si estratégicamente conviene, cuidando no sacar gente de YouTube).\n\nEn la verificación de derechos de autor, usá solo música de la **librería libre de derechos de YouTube** e imágenes de stock libres. Al publicar, la clave es **programarlo como estreno** en el mejor horario que sugiere vidIQ. Si dura menos de **1 minuto**, YouTube lo manda solo al algoritmo de Shorts. Cierre: foco total en SEO, apalancate en IA, bajá la barrera de entrada y generá el hábito de crear.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 124,
        "vn": 10,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -09",
        "cardDesc": "",
        "videoId": "1sajCgC8xI2rXgSbon5s9qQW98_2APjOy",
        "resumen": "Esta clase cierra el módulo de YouTube con **medición e iteración**: a diferencia de Instagram (donde no conviene editar un post ya publicado), YouTube **premia iterar** el contenido que ya subiste para levantar su performance y conocer mejor a tu **nicho dorado**.\n\nMétricas clave que repasa:\n- **CTR** (clics por impresión): rango sano **2-10 %**, pero comparate con tu propio canal y superate. Se construye desde **título y miniatura** (tu primer hook). Ojo: a más impresiones, el CTR tiende a bajar (llega a audiencias más lejanas).\n- **Impresiones**: dependen del **SEO**, tus suscriptores, y de watch time, CTR e interacciones.\n- **Watch time** (retención): benchmarks que da: 3 min ≈ **62 %**, 6 min ≈ **50 %**, 10 min ≈ **44 %**, 15 min ≈ **37 %**, 30 min ≈ **30 %**. Se mejora con **storytelling** y estructura de contenidos ganadores; la miniatura y el título deben prometer lo que el video cumple.\n- **Visualizaciones**: una vista = **30 s** vistos (vs. ~3 s en un reel), por eso YouTube es plataforma de **nutrición**.\n- **Vistas por hora** (con VidIQ): videos viejos con vistas por hora señalan **vacantes** de contenido para posicionarte.\n\nFuentes de tráfico (gráfico circular en Analytics): querés maximizar el **orgánico** (exploración/home, videos sugeridos —configurá pantallas finales con videos propios para no regalarle clics a la competencia—, otras funciones y canales de usuarios) por sobre el **direccionado** (fuentes externas como IG/WhatsApp y anuncios).\n\nCuándo iterar:\n- **CTR bajo** tras 12 h → cambiá miniatura y/o título (por eso conviene tener varios).\n- **Impresiones bajas** → revisá el **SEO** apalancándote en VidIQ.\n- **Watch time bajo** → es storytelling; analizá la estructura y mejorá en el próximo.\n\nConclusión: registrá cada cambio (**ClickUp/Google Sheets**) y jugá el juego de optimizar de a poco para que tu contenido escale y nutra a tu audiencia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 125,
        "vn": 11,
        "grupo": "Marketing Perpetuo · YouTube (pasos para dominarlo)",
        "modulo": 6,
        "titulo": "Dominar YouTube -10",
        "cardDesc": "",
        "videoId": "1L5CFq21hD4LhcMmWNbVuehsrBMUVwsiv",
        "resumen": "En esta clase te muestran el **template de iteración y seguimiento** que usan en YouTube (armado en **ClickUp**, con una versión equivalente en **Google Sheets** por si no lo tenés). La idea es centralizar todo en un solo lugar para llevar registro de qué modificás en cada video y qué resultados da, y así tomar decisiones estratégicas en los próximos.\n\nLa lista tiene columnas simples:\n- **Nombre/título** del video, rotulado con el sistema **YGT + número** (ej. ygt84).\n- **Responsable** asignado (en el equipo hoy lo maneja Mica) y **deadline** (fecha de subida).\n- Estado de **edición**: no comenzó, en proceso o terminado (solo se marca terminado cuando queda impecable para publicar).\n- **Categoría**: negocios, productividad y mentalidad como pilares, más entretenimiento y libros (que igual caen dentro de esos pilares).\n- **Drive** (carpeta con video, ajustes y cortes), **link a la publicación** y las métricas clave: **CTR, impresiones y watch time**. Estas tres son el foco; aclara que el watch time no se puede iterar pero conviene registrar el **porcentaje de retención** para tener visión de la performance y detectar números alarmantes (buenos o malos).\n\nDentro de cada tarjeta hay desplegables con títulos pensados, **thumbnails** trabajados en **Canva**, el **script** (recomiendan un punteo como disparador, no palabra por palabra), el **mail** que sale a toda la base cada vez que se publica un video, y el **copy** de la descripción.\n\nLa clave: cada vez que iterás un elemento (título, thumbnail o config **SEO**), copiás el template de iteración en los **comentarios** con datos, título y thumbnail anterior y el nuevo, para que quede un **historial** cronológico de todas las modificaciones.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 126,
        "vn": 1,
        "grupo": "Marketing Perpetuo · YouTube (estrategia)",
        "modulo": 6,
        "titulo": "MKT Perpetuo (main)",
        "cardDesc": "",
        "videoId": "1e2UE0F9pW4eT_A1RRSLSvvE4NMXdN9Iy",
        "resumen": "Con esta clase arranca de lleno la **estrategia de YouTube**, la plataforma por excelencia del **marketing perpetuo**: si querés, podés armar todo el funnel adentro (shorts y posteos para contenido corto, videos largos para nutrición, B2B sales, links a landings y a llamadas de venta). La gran promesa es que el **contenido no caduca** y el algoritmo trabaja por vos: podés salirte de la ecuación un tiempo y, si está bien implementada la estrategia, YouTube sigue mostrando tus videos y captando/nutriendo leads.\n\nAntes de entrar, Sofía presenta a **Eloisa Wolf**, consultora estratégica de YouTube con 9 años en Google (departamento de YouTube, cuentas de negocios que monetizan). Hicieron una consultoría con ella a mediados/fines de 2023 y todo el módulo se apoya en esos aprendizajes validados. Muestra un gráfico con un **antes y después muy marcado** (en rojo) del canal tras aplicar la estrategia. Su IG: **Eloisa Wolf Marketing**.\n\nPor qué YouTube es la plataforma principal del marketing perpetuo:\n- **Motor de búsqueda**: es el 2º más grande del mundo después de Google (y pertenece a Google). La gente entra a buscar soluciones y el contenido **indexa**, así que las **palabras clave** hacen que el algoritmo muestre tu video cuando alguien busca algo relacionado.\n- **Educativa y evergreen**: se perfila como \"la universidad gratuita más grande\". A diferencia de un reel (vida útil ~48 hs), el video **no caduca** si el SEO está optimizado y aporta valor.\n- **Alcance y streaming**: se consume en la tele, la compu y el celu; en EE.UU. es más grande que Netflix. Hay un **océano azul en habla hispana** (los creadores en inglés dominan, pero ya avanzan sobre el mercado español con AI, doblajes y subtítulos), así que conviene bajar la barrera y empezar ya.\n- **Es un CRM**: si se suscriben y activan la **campanita**, cada estreno les llega por mail (Gmail también es de Google).\n- **Branding y autoridad**: el contenido largo crea vínculo y personaje; miniaturas, títulos y copies construyen marca y confianza.\n\nConclusión: incorporar YouTube es clave porque **exponencia el alcance de forma efectiva y a largo plazo**; en las próximas clases se ven sus componentes y cómo aplicar la estrategia al día a día.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 127,
        "vn": 2,
        "grupo": "Marketing Perpetuo · YouTube (estrategia)",
        "modulo": 6,
        "titulo": "MKT Perpetuo -01",
        "cardDesc": "",
        "videoId": "1wCHUtj43Sjqwz6uhsFcdJxXiEyC0jALQ",
        "resumen": "En este video arrancamos la estrategia de **Marketing Perpetuo en YouTube**, aprovechando que la plataforma tiene un algoritmo muy avanzado que te permite armar **todo el funnel de nutrición dentro de la misma plataforma**. La clave: cada formato de contenido tiene su **propio algoritmo**, así que es como tener **tres plataformas en una**, y eso te sirve para captar audiencias con conductas de consumo distintas y llevarlas a tu contenido de nutrición.\n\nLos tres formatos que trabajamos:\n\n- **Shorts**: son los reels de YouTube, verticales, con un **máximo de 60 segundos** (si pasás de ahí, el algoritmo lo toma como video largo). Tienen su interfaz tipo TikTok y una función clave: **vincular un link al video largo** de tu canal.\n- **Publicaciones**: como posts de LinkedIn. Podés subir **texto, imágenes, carruseles, encuestas** y también vincular un video con clic directo para verlo.\n- **Videos largos**: los más conocidos, de **15 a 25 minutos** promedio (nosotros usamos **15 a 20 min semanales**; los webinars pueden llegar a 1 hora). Formato horizontal, ideal para **aportar valor** en contenido educativo, documentales, entrevistas o videoblogs. Este es tu **video de nutrición**, donde generás el vínculo y la confianza.\n\nLa mecánica es la **pirámide de contenidos**: de un mismo video largo extraés varios shorts y una publicación, y todos funcionan como **trailers, adelantos o ganchos** que llevan a la audiencia a completar la experiencia en el video largo. El juego en YouTube es **retener a la audiencia dentro de tu universo**: cuanto más tiempo te consumen, más cercanas se sienten. Por eso, cuando entres a la plataforma, generá contenido que cubra estas tres variables para que el circuito de marketing perpetuo empiece a correr.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 128,
        "vn": 3,
        "grupo": "Marketing Perpetuo · YouTube (estrategia)",
        "modulo": 6,
        "titulo": "MKT Perpetuo -02",
        "cardDesc": "",
        "videoId": "1jwYTqz6x4V_jRPguWYMyDlESxTWFcEoX",
        "resumen": "Esta clase de **Marketing Perpetuo en YouTube** es un recorrido práctico por **VidIQ**, una plataforma de IA específica de YouTube para optimizar **research**, **análisis de competencia** y sobre todo la **configuración SEO** de tus videos, que es lo que le da señales al algoritmo para saber a quién mostrar tu contenido.\n\nDe qué va: se usa de dos formas, la **web de VidIQ** y la **extensión para Chrome** que integra data en cada video de YouTube. Importante: hay que crear la cuenta con el **mail del canal** para que traiga toda tu data. Existe una versión gratuita (útil) y una paga.\n\nPuntos clave que remarca:\n- **Generar**: ponés una idea (ej. \"cómo escalar mi negocio digital\") y la IA devuelve palabras clave, título, descripción, **etiquetas** (los hashtags que lee el algoritmo), thumbnails y hasta la **estructura del video** (hook, intro, problema, clímax, conclusión y CTA).\n- **Optimización**: puntúa cada video (ejemplo: título 93, miniatura 84) para detectar qué funciona y repetirlo.\n- **Palabras clave**: buscás términos con **alto volumen y baja competencia** (ej. \"productividad\", ~41.000 búsquedas, competencia media). Ojo, los resultados vienen en inglés y hay que traducir. Google/YouTube distinguen tilde.\n- **Competidores**: cargás canales de referencia (Sofía Contreras, Alex Hormozi, Mariano Rojas) y comparás suscriptores, visitas y rendimiento.\n- **Entrenador**: un ChatGPT enfocado en YouTube.\n\nEjemplo que da: con la extensión ve un video de Imán García de hace 3 años que sigue teniendo **vistas por hora**; YouTube lo posiciona porque nadie crea contenido nuevo con esas palabras clave. Espía sus **etiquetas** para replicarlas. Al subir un video, VidIQ puntúa el SEO en vivo (llegó a 98.1/100).\n\nConclusión: apóyate en esta IA para encontrar **palabras clave, ideas e insights**, pero siempre contrastá con tu criterio. El foco está en las **etiquetas** y el SEO para que el algoritmo trabaje por vos.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 129,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos",
        "modulo": 6,
        "titulo": "MKT Perpetuo-19",
        "cardDesc": "",
        "videoId": "1PjvnNaCY_rqGs8AoqeZ54ksD1T-dh2rp",
        "resumen": "Esta clase abre el módulo de **Marketing Perpetuo** con el concepto de **pirámide de contenidos**: cómo crear contenido de forma sistemática para que \"la rueda nunca deje de girar\". La **ley fundamental** que repite es que **todo contenido puede y debe convertirse en más contenido**.\n\n**Puntos clave que remarca:**\n\n- **El problema de crear contenido aislado:** aparecen muchos puntos de dolor (idear, grabar, editar, publicar), se hace a cuentagotas cuando encontrás un hueco, sin estrategia y dependiendo de las ganas y la motivación. Así la creación termina última en la lista de prioridades.\n- **La solución (la pirámide):** poner el esfuerzo en crear **una pieza larga de valor** —en su caso, videos de YouTube— y luego **fragmentarla** en piezas chicas (reels, posts, artículos, mails). Se trata de **exprimir al máximo** ese contenido largo para armar una **\"bóveda de contenidos\"**, un stock que te deja \"estrellado\" de material. Así pasás de crear contenido todos los días sin sistema a **crearlo una vez al mes**.\n- **Cubre las tres etapas del funnel de una:** arriba, contenido corto (captación de audiencias en frío); en el medio, contenido largo (nutre y convierte en leads calificados); abajo, la conversión/venta.\n- **Jornadas de grabación:** **Sophie** bloquea su agenda **una vez al mes** (a veces cada dos) y graba todo de una tirada: hasta **5 o 6 videos de YouTube de 15 a 20 minutos**, y de cada uno pueden salir **6, 7 u 8 reels**. Con eso genera material para todo el mes.\n- **Por qué todo desprende de YouTube:** es el **segundo buscador más grande** después de Google, **indexa por años** y el contenido **no caduca** si tenés buen SEO y las palabras clave; es donde más se ven videos (más que Netflix) y —a diferencia del podcast o el newsletter— **no hace falta redireccionar tráfico** porque el algoritmo posiciona solo. Es su mayor espacio de nutrición y vínculos profundos, junto con el newsletter y el podcast (que se nutre de los audios de YouTube).\n- **Crear de cero o reciclar:** sirve cualquier cosa que aporte valor a tu nicho dorado. En video: entrevistas previas o futuras, podcasts de terceros, conferencias, sesiones de consultoría o grabar desde cero. En escrito: ebooks, libros, fragmentos, documentos internos de procesos convertidos en post o artículo de LinkedIn.\n\n**Ejemplo:** cuando arrancaron con YouTube, **reciclaron contenido de las consultorías de Sophie**, sacando cortes de esos videos. Fue la forma de **bajar la barrera de entrada**, generar el hábito de publicar e ir optimizando de a poco.\n\n**Conclusión:** si ya tenés material, reciclalo; si no tenés nada, no te preocupes, se construye desde cero plataforma por plataforma. La idea es **sistematizar** para no depender nunca de la motivación ni del tiempo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 130,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos",
        "modulo": 6,
        "titulo": "MKT Perpetuo-20",
        "cardDesc": "",
        "videoId": "1cej_9kqyrOeP0ou1HeEBJwV6V72uPbAp",
        "resumen": "Esta clase de **Marketing Perpetuo** enseña cómo bajar de la **pirámide de contenidos**: agarrar un **contenido largo** (en el caso de Sofi, videos largos de YouTube) e **identificar dentro fragmentos de formato corto** para distribuir en todas las plataformas, sin depender de las ganas, la motivación ni el azar. La regla de oro: cada **micro pieza tiene que funcionar por fuera del video** y aportar valor por sí sola.\n\n**Puntos clave que remarca:**\n- **Cómo identificar el contenido corto:** volver a ver el contenido largo, pero ahora buscando fragmentarlo, teniendo presente la **estructura de contenidos ganadores: inicio, nudo y desenlace** (hook + dolor del cliente + la solución que te posiciona). Se trata de identificar hooks y momentos de valor.\n- **Herramientas para encontrar puntos de dolor/interés:**\n  - **YouTube Analytics:** muestra los **momentos clave de retención** del video; los \"piquitos\" de audiencia (ej. un pico al final) marcan un punto de interés que puede volverse un reel, un post o un artículo. Si no se puede fragmentar, sirve como disparador para próximos contenidos.\n  - **Newsletter:** comparar aperturas y retención. Ejemplo de dos cortitos de Sofi: el que peor funcionó tuvo **39% de retención** y el mejor **6% de tasa de apertura** (según transcripción); el más relevante tiene material reutilizable.\n  - **Comunidad:** las **partes más compartidas** de tus cortitos (ej. los que publican los domingos y les llegan notificaciones de fragmentos) son referencia directa para nuevos posts/reels.\n  - **Podcast:** los episodios con más reproducciones y retención señalan qué temas interesan más.\n- **El desafío de los reels (armar un \"Frankenstein\"):** los fragmentos para copy/post/artículo solo hay que redactarlos, pero encontrar un **reel de corrido** dentro del video largo no siempre pasa. La técnica es **marcar tiempos y frases** (inicio de la frase → fin de la frase, ej. desde el 00:10 \"tengo éxito...\") en un documento para el equipo de edición.\n\n**Ejemplo:** en el documento real que usan con edición, el **Reel 1** salió de corrido (una sola línea, del 01:02 al 01:54); el **Reel 2** fue un Frankenstein, uniendo un primer tramo con otro que arranca del 4:19 al 4:25. De un solo video de YouTube sacaron **6 reels, 1 episodio de podcast y 1 carrusel** (podrían ser más).\n\n**Cómo se distribuye:** el **video full** va a YouTube y Facebook; los **reels** a Shorts, Instagram, TikTok, LinkedIn y Facebook; el **audio** al podcast en Spotify; los **posts/copies** a YouTube, Instagram, LinkedIn, Facebook y mails. Una sola pieza larga multiplica las acciones en todas las plataformas: esa es la fórmula del contenido perpetuo.\n\n**Conclusión:** toda pieza —corta o larga— va a tu **bóveda de contenidos**, cuya gestión se ve en la próxima lección.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 131,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos",
        "modulo": 6,
        "titulo": "MKT Perpetuo-21",
        "cardDesc": "",
        "videoId": "1k_i0Q9JXhzBC8nP77f0LEMkTiVCy5XCQ",
        "resumen": "Esta clase de **Marketing Perpetuo** enseña a **administrar y guardar** todo el contenido que ya grabaste, editaste y fragmentaste (piezas largas y cortas), para que \"en el caudal nada se pierda\" y todo sea fácil de acceder. La herramienta central es la **Bóveda de Contenidos**: una serie de carpetas en Drive más una plantilla de Google Sheets.\n\n**Puntos clave que remarca:**\n- **La bóveda vive en Drive**, dentro de una carpeta \"Marketing\". Como su **pieza madre** de contenido es **YouTube**, nombran TODO partiendo de ahí: `YT + número de video + título`, así las carpetas quedan cronológicas.\n- Dentro de cada carpeta de video hay subcarpetas: **artículos, materiales, podcast, posts, reels, el archivo de ajustes y el video final**.\n  - **Artículos**: los insights escritos del video que sirven para copy o artículos de LinkedIn o email marketing.\n  - **Materiales**: los crudos. Insiste: NUNCA deshacerse de ellos, por si hay que reeditar.\n  - **Podcast**: los audios; de un solo video largo pueden salir varios episodios cortos.\n  - **Posts** y **Reels**: las piezas ya editadas.\n  - **Ajustes**: el documento (visto en la lección anterior) donde con el equipo de diseño detallan cortes de reels y formas de edición.\n  - **Video final**: nombrado `YT + número + \"final\"`; así como está sale a YouTube y Facebook.\n- **Regla de oro (muy insistente)**: definir UNA nomenclatura y respetarla para todo (le ponen el número de video de YouTube a cada carpeta y archivo, ej. `reel + número + video de YT`), para encontrar cualquier archivo suelto más adelante.\n\n**La plantilla de Stock de Contenidos** (descargable de la carpeta de contenidos del blog de marketing):\n- **Columna A**: número de video de YouTube (1, 2, 3…), linkeada a la carpeta del video para acceder rápido.\n- **Columna B**: título del video.\n- **Columna C**: todos los contenidos que se sacan de ese video (posts, reels, artículos, podcast, todo).\n- **Columna D**: título de cada contenido para identificarlo.\n- Luego columnas por **red social** (Instagram, TikTok, Facebook, YouTube, LinkedIn y Podcast): al planificar el calendario se va **tildando** qué contenido ya se calendarizó, para no repetir ni equivocarse.\n\n**Conclusión:** la plantilla es simple pero hay que mantenerla al día y completa, porque es la visión del stock disponible que hace funcionar la **máquina de marketing perpetuo**. En la próxima lección: cómo distribuir y calendarizar los contenidos.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 132,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos",
        "modulo": 6,
        "titulo": "MKT Perpetuo-22",
        "cardDesc": "",
        "videoId": "1HnZZjDZOCZAupT5sAka5RdkuXgG4KE8P",
        "resumen": "Esta clase del módulo **Marketing Perpetuo** (submódulo **Pirámide de contenidos**) enseña a **calendarizar y distribuir** los contenidos de todo un mes, apoyándote en dos herramientas: la **plantilla de stock de contenidos** y tu **bóveda**. La idea central es que todo funcione como una **rueda que gira todos los días**, donde cada pieza corta empuja hacia una pieza larga de nutrición.\n\n**Puntos clave que remarca:**\n\n- **Paso 1 — Definir los días del contenido largo** (nutrición / *middle of the funnel*): **lunes** sale el podcast *Paso a Acción*, **miércoles** el video de **YouTube** full y **domingos** la edición del *cortito* de **newsletter**. Hay que respetar esos días para generar **expectativa** en la comunidad.\n- **Paso 2 — Definir cantidad y frecuencia del contenido corto** (*top of the funnel*). Recomendación: subir **la mayor cantidad posible**, porque más contenido con un funnel optimizado = más leads = más clientes. Su esquema: **Instagram** 1 reel/post/carrusel por día + ~3 historias diarias, 5 veces por semana (dejan **48 hs sin historias**, decisión estratégica para potenciar el engagement al volver); **TikTok** 1 reel diario; **LinkedIn** 1 reel + 1 posteo diario, 5 veces por semana; **YouTube Shorts** 2 por semana; **YouTube Posts** 2 por semana.\n- **Paso 3 — Calendarizar con un propósito**: dirigir audiencia a los contenidos largos. Clave de algoritmo: enviar **señales de interés apenas se publica** para que el algoritmo lo muestre a más gente; por eso hay que **acercar la mayor cantidad de audiencia lo más rápido posible**.\n\n**Ejemplo del lunes (podcast):** ese día *todo* el marketing apunta al podcast. Post/reel en Instagram con la narrativa del episodio + adelanto + **CTA**; historias generando debate e insinuando el tema + CTA; reel/fragmento en TikTok + CTA; post en LinkedIn desde el **dolor que resuelve** + CTA; y un **mail a toda la base** avisando el estreno. Los días sin contenido largo, igual se publica corto pero siempre con un **CTA** que reconduce al largo.\n\nSobre el **calendario** (descargable en la carpeta de contenidos de Marketing Perpetuo): cada celda es una pieza, con colores de referencia — **violeta=Instagram, azul=LinkedIn, celeste=Facebook, negro=TikTok, rojo=YouTube, verde=Podcast**.\n\n**Automatización que muestra:** una pieza corta con el CTA *\"deja la palabra podcast\"* dispara un bot en Instagram vía **ManyChat** (se ve al final del módulo), que responde a esa palabra-disparador con un DM que lleva al episodio.\n\n**Conclusión:** calendarizá siendo objetivo y con el funnel como foco. Toda pieza corta debe llevar, con CTA claro, a una pieza larga de nutrición; esa es la máquina de marketing perpetuo girando a diario.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 133,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · General",
        "modulo": 6,
        "titulo": "MKT Perpetuo",
        "cardDesc": "",
        "videoId": "1EBeGjn-hCPGOIvqX8lblt0COwoqwhRDy",
        "resumen": "Esta clase abre el módulo de **Marketing Perpetuo**, un concepto propio del equipo de Sofía Contreras: una estrategia sistemática de posicionamiento orgánico que, atada a un funnel, se vuelve **eterna**. Sofía arranca con una prueba: casi nadie llega a ellos por un solo anuncio, sino por el **correo de los domingos**, los **videos largos de YouTube** o el **podcast**. Ese es el punto: sostener presencia en el tiempo para que la gente confíe cada vez más.\n\n**Puntos clave que remarca:**\n- **Por qué \"perpetuo\":** el contenido se apalanca en plataformas que son en sí motores de búsqueda, así que lo que creás nunca desaparece. Contenido de valor sistemático + estrategia sólida + funnel = atracción de clientes eterna.\n- **Qué genera:** audiencia, confianza y sobre todo **autoridad**. Una **marca personal** fuerte baja las barreras de la venta, disminuye el **costo de adquisición**, acorta el proceso de compra y hace que los clientes lleguen \"calientes\" en vez de \"fríos\".\n- **Analogía humana:** la confianza se construye con múltiples puntos de contacto, igual que una amistad (recién ahí le pedís al amigo que te busque al aeropuerto a las 5 a.m.).\n- **Orgánico vs. pago:** el posicionamiento se puede lograr solo con anuncios, pero hay sobrepoblación de gurús y pagar ads es fácil; lo difícil (y valioso) es el contenido orgánico constante. Quien te ve en un anuncio te va a **googlear** para corroborar, y lo orgánico es lo que te respalda.\n- **Ser dueño de tus leads:** depender solo de anuncios es frágil. Ejemplo real: con el cambio de políticas de **iOS**, Meta/Facebook perdió precisión de tracking y hubo gente que perdió **millones de dólares** de un mes para el otro.\n- **Barreras bajas en lo orgánico:** frente a un anuncio la gente tiene la guardia alta; en el scroll orgánico busca aprender o entretenerse, así que si identificás bien dolores y deseos del nicho, la relación se construye más fácil. Plataformas mencionadas: **Instagram, X (Twitter), Facebook, TikTok, LinkedIn, Spotify/podcast y YouTube**.\n- **Sistema escalable:** el objetivo es una máquina que genere cientos de piezas en muchas plataformas de forma sistemática, sin depender de la motivación. Sofía usa hoy el mismo sistema con **3 personas** que cuando era ella sola; permite subir volumen sin que se rompa.\n- **El negocio detrás:** muchos crean contenido pero no lo monetizan; vos ya tenés un negocio, y atarlo a la creación de contenido es la verdadera máquina. La meta final es **sacar su propia cara** del centro para que el negocio siga corriendo sin ella (por eso apuesta a una plataforma específica que revelará más adelante).\n\n**Conclusión:** el marketing perpetuo es el juego de largo plazo que pocos juegan; quien se compromete construye un negocio infalible sobre una marca personal sólida. En los próximos videos se desarma el funnel paso a paso y la maquinaria de contenido, con **Juan** (su content strategist hace 3+ años) y **Nika** acompañando dudas en la comunidad de Circle.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 134,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · General",
        "modulo": 6,
        "titulo": "MKT Perpetuo-01",
        "cardDesc": "",
        "videoId": "10-JzkPumAjrygolFEfBRb2hZEUYAPNPW",
        "resumen": "**De qué va:** primer video del módulo de **Marketing Perpetuo** de MasteryHaus. Sofía abre con la idea que ordena todo el módulo: cada acción de marketing —ads, orgánico, cualquier plataforma— sirve para **comprar \"real estate mental\"** (bienes raíces mentales), es decir, **comprar tiempo en la mente de las personas**. Cita a Gary Vee: *\"I day trade attention for a living\"*. El **trade-off** de esa atención es la **confianza**, y sobre esa audiencia después apalancás el negocio.\n\n**Puntos clave que remarca:**\n- Se necesitan **mínimo 5 puntos de contacto** para una decisión de compra; ellos buscan muchos más, para generar **relación y confianza con valor real**. Distingue su **contenido de valor** del **contenido de entretenimiento** (MrBeast): los dos pueden sostener negocios enormes.\n- El **juego nuevo** es captar la mayor atención **de las personas correctas, en la plataforma correcta, con el mensaje correcto**. Hablarle a todo el mundo (posicionamiento demasiado amplio) trae **leads no calificados**, encarece la venta y hace perder el tiempo de los vendedores. **El filtro se hace con el contenido.**\n- El **funnel de marketing perpetuo**: captar atención → convertir en leads interesados aportando valor en el tiempo → poner un CTA de venta → transformarlos en clientes.\n- La **bola de nieve**: contenido bueno que la gente comparte y recomienda. Hay que **facilitar el compartir** con CTAs estratégicos (el vendedor de local físico que orienta; el botón de suscribirse en YouTube; el correo del domingo que cierra con *\"si te reenviaron este correo, haz clic acá para suscribirte\"*).\n- **Anclaje marca–concepto clave** vía **temas troncales**. Ejemplo propio: **Sofía Bauter** = productividad, negocios y mentalidad. **Podcast → productividad, YouTube → negocios, newsletter → mentalidad**. Insiste en **experimentar constantemente** qué funciona, en qué plataforma y con qué mensaje.\n- **Todo comunica**: ya tenés marca personal aunque no la hayas pensado. Hay estrategia detrás de cada detalle —ella vestida de negro (con dorados), el uso de las manos, las uñas— ligado a su **arquetipo**.\n\n**Ejemplos de apalancamiento en audiencia:** Rivy con **B-Friends** (tokens cripto que dan acceso a sus eventos); **MrBeast**, que ató su masividad a negocios masivos (**hamburguesas** y **chocolate**, hoy vendido principalmente en **Walmart**); **Logan Paul** con la bebida energizante **Prime**.\n\n**Conclusión:** sí existe una **plataforma de marketing perpetuo por excelencia** —no Instagram, no por donde ella arrancó—, y adelanta que es **YouTube**. En los próximos videos explica por qué conviene incorporarlo a todo tu posicionamiento.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 135,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · General",
        "modulo": 6,
        "titulo": "MKT Perpetuo-02",
        "cardDesc": "",
        "videoId": "1u8-_xjzAJzgFVDV7ou7_JYGsskS9d-sw",
        "resumen": "Sofía desarma su **funnel de marketing perpetuo**, el único embudo que armaría si tuviera que elegir uno: el mismo que usan en su negocio. La lógica del embudo es que arriba entra mucha gente (**público frío**) y se va achicando a medida que la persona entra a tu universo, vas comprando **\"real estate mental\"** y la vas calentando hasta la conversión. Todo se sostiene en dos patas que no pueden ir separadas: **orgánico y pago** (apoyarse solo en ads es inviable por la sobreabundancia de gurús y el boom de la IA; lo orgánico da respaldo cuando te buscan).\n\n**Puntos clave que remarca:**\n- **Top of the funnel (frío / atracción):** todo **formato corto** para llegar a audiencias nuevas — TikTok, Reels de Instagram, LinkedIn, YouTube Shorts, y YouTube (con buen **SEO**, el algoritmo lo empuja). Más **anuncios** en Meta, YouTube y Google, y **shoutouts** (pagás para que una cuenta grande del nicho, con millones de seguidores, te mencione y te posicione). El objetivo es un **mecanismo de tráfico**: mensaje claro + tráfico consistente, sistematizado con la **pirámide de contenidos** para que no dependa de tu motivación.\n- **Middle of the funnel (nutrición / vínculo):** contenidos largos donde la persona profundiza — **YouTube, podcast, email**, historias (cada una enganchada a la siguiente) y hasta un **libro** (un asset que la persona se lleva a la intimidad y de vacaciones). Cada formato va atado a un momento y un sentimiento: el podcast al correr o cocinar, YouTube en el living para tomar notas, el **correo del domingo** con un café al lado. Acá se genera el **mecanismo de leads interesados**: contenido de valor consistente + recabar feedback de los leads (Juan lo detalla aparte).\n- **CTAs y remarketing:** los llamados a la acción llevan a una **landing**, un **VSL** (landing en video) o un **webinar** grabado que abre carrito. Con **remarketing** volvés a impactar a quienes ya tuvieron contacto: primero 3-4 piezas de valor, después la oferta.\n- **Bottom of the funnel (conversión):** la persona deja sus datos, tiene una llamada con vos o tu equipo, y ahí se vende con la **oferta** + un **script de ventas** único y optimizado que todo el equipo replica (eso lo vuelve **sistematizable**).\n\n**El funnel no termina en la venta:** la **entrega del servicio** también es marketing, porque los clientes satisfechos traen más clientes. Requiere **onboarding con un \"time to value\"** rápido y un mecanismo de entrega medido etapa por etapa, lo que habilita el **semáforo de salud** del cliente (**verde / amarillo / rojo**). Después viene el **mecanismo de upsell** (pasar al siguiente nivel) y el cliente se convierte en **caso de éxito**: se graba el testimonio de forma sistematizada y se vuelca a anuncios y orgánico, alimentando de nuevo el top del embudo. Parte de la facturación se **reinvierte en marketing**, sobre todo en etapas incipientes o de validación de oferta.\n\n**Conclusión:** gracias a sistematizar cada pieza —atracción, nutrición, ventas, entrega, upsell y testimonios— facturan **seis cifras todos los meses** y pueden dar saltos de nivel sin romper el negocio, en un ciclo **iterativo e incremental**. Todo un negocio, dice, se puede reducir a este único embudo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 136,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · General",
        "modulo": 6,
        "titulo": "MKT Perpetuo-03",
        "cardDesc": "",
        "videoId": "1Mvt5osY2s0Q7ldUMFzUtkw70OVeUQeeG",
        "resumen": "Esta clase de **Marketing Perpetuo** gira alrededor de un solo modelo mental, quizás el más importante para sostener contenido en el tiempo: **bajar la barrera de entrada**. Sofía lo plantea como una herramienta de mentalidad —\"como abrir una cajita de herramientas y sacar algo que me ayude a pensar\"— que su equipo aplica para todo. La pregunta madre que lo dispara: **\"¿Cómo se vería esto si hacerlo fuera simple?\"**. La lógica: lo que más cuesta es *accionar*, y una vez que arrancás es mucho más fácil mantenerlo; así se genera la bola de nieve de constancia que habilita posicionamiento y el \"éxito de la noche a la mañana\" (que en realidad viene de años de acción).\n\n**Puntos clave que remarca:**\n- **El podcast (caso estrella).** Juan quería que Sofía se pusiera a grabar; ella no tenía tiempo. En vez de eso, extrajeron los audios de los **+100 videos de YouTube** ya grabados. Resultado: Juan armó **70 episodios en dos semanas** ≈ **año y medio** de contenido (uno por semana). Sumado a anunciar la fecha por todas las plataformas y automatizar con bot (mensaje automático al escribir la palabra \"podcast\"), llegó al **puesto 2 del ranking general de Argentina en 2 semanas**, top 10 todo el primer año, y top en México (puesto 8 en negocios), Chile, Argentina y hasta puesto 132 en Colombia. \"Nos bajan los límites de las fronteras.\"\n- **El Cortito (newsletter).** Se preguntó cómo sostenerlo fácil: tenía que ser **corto y fácil de leer** (por eso \"cortitos reales\") y nutrirse de **temas que ya analizaba en la semana**. Empezó en Mailchimp y migró a **Substack** (simple, hecha para creadores, gratis al arrancar, sin límite de suscriptores, buena entregabilidad). Publicado semanalmente hace **~3 años**.\n- **YouTube.** Misma conversación con el equipo (Cési y Caro): no iba a grabar. Usaron **cientos de llamadas de consultoría grabadas**, entrevistas, charlas y **mashups** (remix de videos con conceptos similares, \"como un DJ de contenido\"). Arrancaron con **28 videos** = **7 meses** de contenido. Tip: filtrar el canal al revés para ver ese material inicial.\n- **Numerar el contenido.** Sirve psicológicamente (ves cuánto avanzaste) y para que quien llega al correo/episodio 27 sepa que hay 27 previos y pueda ir al archivo con un link.\n\n**Cómo escaló sin romperse:** cuando ya tocaba producir contenido propio, la respuesta a \"¿cómo lo hago simple?\" fue: que **grabe y edite otra persona** (no ella), en una **fecha fija recurrente cada mes** que le congela la agenda y obliga al equipo a preparar todo hacia atrás y organizarse hacia adelante. Así lo sistematizó para ella, su equipo y sus editores; un año después ya filmaba con equipo audiovisual, equipamiento (al principio alquilado) y jornadas de rodaje.\n\n**Conclusión:** no hace falta el mejor equipo —uno de sus videos más vistos (**~115.000 reproducciones**) lo grabó con el celular en vacaciones cuando se quedaron sin stock. Solemos sobrecargar las cosas; casi siempre se resuelven más simple de lo que pensamos. La clave de toda la maquinaria es la **constancia y la consistencia**, y bajar la barrera de entrada —igual que para ir al gimnasio o comer sano— es lo que la vuelve sostenible. Juan luego mostrará la **pirámide de creación de contenido** (cómo lo largo se transforma en piezas cortas: artículos, posts, etc.).",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 137,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Contenido de valor",
        "modulo": 6,
        "titulo": "MKT Perpetuo-14",
        "cardDesc": "",
        "videoId": "1oJ-sLKf-o-_z9DjONY-uULiioV4bvVkY",
        "resumen": "Clase de apertura del módulo de **Marketing Perpetuo**. La da **Juan Seguiano**, líder del equipo de marketing de Sofi (trabaja con ella hace casi tres años, terminando su licenciatura en comunicación en la UBA), que va a acompañar todo el módulo. Antes de entrar en materia, muestra la **foto del resultado**: qué logró el negocio sosteniendo estas estrategias en el tiempo, para que se vea que el marketing perpetuo funciona.\n\n**Puntos clave que remarca:**\n- **Podcast \"Pasar a la Acción\"** (lanzado el año pasado): al 2º día llegó al puesto **20**, al 3er día al puesto **3**. Estuvo todo el año en el **top 10** de Argentina y hoy también rankea en negocios en **México, Perú, Colombia y Chile**. Más de **120.000 reproducciones mensuales**, creciendo exponencialmente.\n- **YouTube**: de **8.000** a más de **254.000 visitas mensuales**; el canal pasó de **3.000** a más de **50.000 suscriptores**.\n- **Instagram**: de **134.000** a más de **470.000** seguidores (**+250%**).\n- **TikTok**: de **40.000** a más de **290.000** seguidores (**+625%**).\n- Ese **posicionamiento** los llevó a medios masivos argentinos: **Luzu TV, Urbana Play, Olga, Filo News, Infobae**, entre otros.\n\nY el punto de fondo: estas acciones diarias **se transformaron en siete cifras en dólares** para el negocio.\n\n**Conclusión:** el objetivo del marketing perpetuo es **captar audiencias, nutrirlas y convertirlas en futuros clientes** para hacer crecer el negocio. Los números no son suerte, son el reflejo de acciones sostenidas día a día, y eso es lo que el módulo va a enseñar paso a paso.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 138,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Contenido de valor",
        "modulo": 6,
        "titulo": "MKT Perpetuo-15",
        "cardDesc": "",
        "videoId": "10miJZFtQt6qG1D2A2h3Owx-TQJxRVKC_",
        "resumen": "Esta pieza del módulo de **Marketing Perpetuo** desarma un mito: el **algoritmo no es tu enemigo**, es una herramienta que hay que incorporar a la estrategia. Sofía lo define como una **red neuronal tecnológica basada en el comportamiento de los usuarios** dentro de una plataforma: si muestran o no interés en el contenido.\n\nPuntos clave que remarca:\n- **Cómo funciona:** el algoritmo toma tu pieza y la **testea con un segmento de usuarios**. Según cómo reaccionen, decide el camino. La variable que manda es el **interés/interacción**: likes, comentarios, veces que se comparte o se guarda. Cada acción es una **señal**; si es positiva, prueba la pieza con nuevos segmentos, de forma **escalonada**, hasta liberarla y, en el mejor caso, volverla viral.\n- **Si nadie interactúa**, el algoritmo entiende que el contenido no es relevante y deja de mostrarlo. Eso no es un castigo: es **información**. Quiere decir que algo falló (el mensaje, o que **no le hablaste a tu nicho dorado**). La lectura correcta es **revisar la pieza, iterar y volver a lanzarla**.\n- Ningún gran creador —**Gary V, Alex Hormozi, Mr. Beast**— culpa al algoritmo por un contenido que no funciona. Hay que tomarlo como **fuente de información** de lo que sirve y lo que no.\n- **La métrica clave es el engagement**: la suma de todas las interacciones (likes, comentarios, compartidos, guardados) **dividida por el alcance, por 100** para tener un porcentaje. Existen varias fórmulas, pero recomienda elegir una y **respetarla siempre** para no \"mezclar peras con manzanas\" al comparar datos.\n\nEjemplo con números: una publicación con **57.471 interacciones** sobre un **alcance de 518.320**, por 100, da **11%** de engagement. El engagement es la brújula para detectar tus **contenidos ganadores**, los que más \"hacen clic\" con tu nicho dorado.\n\nConclusión: el algoritmo es tu **mayor aliado** para alcanzar audiencias nuevas. Marca un camino de **iteración, optimización y mejora** del contenido diario; a partir de ahora se integra dentro de las estrategias de marketing perpetuo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 139,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Contenido de valor",
        "modulo": 6,
        "titulo": "MKT Perpetuo-16",
        "cardDesc": "",
        "videoId": "1VqmUV8yXoHFOcjCIX10thU72U4xNdglV",
        "resumen": "Esta clase de **Marketing Perpetuo** presenta el **Master Copy**, el documento madre del que sale TODO tu contenido para crearlo de forma sistemática y sin dolor. Sofía lo plantea como una herramienta para **iterar**: si un posteo no funcionó, lo analizás, ves qué falló, lo modificás y lo relanzás con nuevos aprendizajes; el Master Copy centraliza la info de valor para que esa toma de decisiones sea simple.\n\n**Puntos clave que remarca:**\n- Sirve para tres cosas: **1)** reducir el dolor de crear contenido, **2)** tomar decisiones enfocadas (sacando lo azaroso del día a día) y **3)** crear contenido que **atrae al lead correcto**.\n- Mantra: **\"views ain't shit\"** — no buscamos vistas ni seguidores por vanidad; el objetivo es captar al lead correcto que, tras pasar por el funnel de nutrición, se convierte en cliente. Todo comunica para potenciar el negocio.\n- **Componentes del Master Copy:** el **avatar** (tu nicho dorado / cliente ideal), el **objetivo principal** (su dolor principal), el **objetivo secundario** (el dolor que le sigue), la **queja principal** (de qué se queja cuando no logra lo que desea) y los **ángulos y argumentos** (soluciones alineadas a tu oferta irresistible que te posicionan).\n- Todo el contenido debe salir del Master Copy para dar **hilo conductor, congruencia y coherencia**: cuando alguien ve un anuncio y entra a tu perfil, tiene que ver un mensaje coherente.\n\n**Ejemplo desarrollado:**\n- **Avatar:** coaches, consultores, propietarios de agencias y proveedores de servicios online que generan al menos **$2000 al mes** y desean escalar con un negocio sólido y sistemático.\n- **Objetivo principal:** más clientes con menos esfuerzo y sacrificio; mejor calidad de leads, operaciones simples e ingresos recurrentes.\n- **Objetivo secundario:** dejar de ser los únicos que deciden; un equipo de expertos confiables y un negocio que funcione sin ellos, para liberar tiempo con familia y amigos.\n- **Queja principal:** clientes que son un dolor, tener que perseguirlos para que paguen, equipos y agencias de bajo rendimiento, no saber qué funciona y depender de su participación constante (\"sienten que están en el mismo lugar hace años\").\n- **Ángulos y argumentos (lista tan larga como quieran):** el negocio puede ser predecible, sin depender de lanzamientos para subsistir; debe ser una máquina sistemática de generar potenciales clientes, cerrarlos y entregar un servicio ganador que te haga recomendar; un servicio supremo permite apuntar a más volumen y baja el costo de adquisición en anuncios.\n\n**Cómo armarlo simple con ChatGPT:** pegás la definición de Master Copy del libro de Marketing Perpetuo y le pedís que confirme que la entendió respondiendo solo \"sí\"; después cargás el **desarrollador de nicho dorado** (del módulo de Nicho Dorado) y le pedís que complete cada punto cruzando ambos.\n\n**Conclusión:** usá ChatGPT como acelerador del pensamiento, **no como palabra santa** — leé y profundizá sus respuestas con lo que vos sabés de tu servicio, tu negocio y tu nicho.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 140,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Contenido de valor",
        "modulo": 6,
        "titulo": "MKT Perpetuo-17",
        "cardDesc": "",
        "videoId": "1IfXS-0JSqny9e3EYq8SafVVgLUOh18f4",
        "resumen": "Esta clase de **Marketing Perpetuo** (dentro de \"MKT Perpetuo y pirámide de contenidos / Contenido de valor\") explica la **estructura de un contenido ganador**, que Sophie compara con la de un libro: todo contenido necesita **inicio, nudo y desenlace**. La lógica de fondo es que las personas conectamos con personas y con historias, así que hay que llevar esa narrativa a cada pieza que creamos.\n\n**Puntos clave que remarca:**\n\n- **El hook (inicio):** es el gancho que capta la atención y es lo más importante del contenido. Ahí debe ir la mayor parte de tu esfuerzo, porque si el hook no funciona nadie hace clic y todo el trabajo del desarrollo se pierde. Consumimos contenido escroleando sin fin, abandonamos series en 10-15 minutos, así que el tiempo para conectar es cortísimo. El hook cambia según el formato: en un **newsletter** es el **asunto**; en **YouTube**, el **thumbnail (miniatura) + título**; en los **anuncios**, los **primeros 3 segundos**. Aplica a todo: post, reel, podcast, newsletter.\n- **El nudo:** es el **punto de dolor** al que le hablás a tu nicho. Se saca de **Master Copy** (los \"objetivo 1\", \"objetivo 2\" y la queja que bajaste ahí), y funciona como disparador para pensar los dolores. Es la parte donde tu **nicho dorado** se siente comprendido.\n- **El desenlace:** es la **solución** que aportás a ese dolor, con los argumentos y ángulos que también salen del Master Copy. Por eso insiste en completar ese documento: de ahí se abre el abanico de posibilidades para crear contenido.\n\n**Ejemplo (dos posts propios de Sophie):** mismo formato (fondo negro, texto blanco) y mismo mes, pero resultados muy distintos. El que **funcionó** (6732 interacciones) arranca con el hook contraintuitivo *\"No hacer nada en realidad es hacer mucho\"* (dirigido a gente de productividad/desarrollo personal, desafiando la creencia de que ser productivo es estar siempre ocupado). Desarrolla el nudo (vivir ajetreados, en el futuro, con baja calidad de vida), empatiza, cuenta una mini-historia sobre la importancia de descansar, cierra con un mensaje final (*\"tomate 5 minutos y vas a ver cuánto estuviste haciendo de más\"*) y suma un **call to action**: dejar la palabra \"cortito\" para recibir el newsletter y leer el contenido completo. Cumple inicio, nudo, desenlace y CTA. El que **no funcionó** (1577 interacciones) partía de un hook aceptable (*\"Cuántas veces el miedo a lo que podía pasar te impidió avanzar\"*, apoyado en la técnica de Tim Ferriss de definir/prevenir/reparar), pero el nudo quedaba poco desarrollado, **no tenía desenlace ni cierre** (ningún estado final al que llegar) y **no tenía call to action** que invitara a interactuar; mucha gente abandonó a la mitad.\n\n**Conclusión:** los contenidos que fallan es porque les falta alguno de los elementos —un buen hook, el nudo, o el desenlace con su CTA—. La clave es **aprender a contar historias** y sostener la atención durante todo el relato.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 141,
        "vn": 5,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Contenido de valor",
        "modulo": 6,
        "titulo": "MKT Perpetuo-18",
        "cardDesc": "",
        "videoId": "1-LWSqlLbYM1yNdbA3e_cvb5JXNtilDRS",
        "resumen": "Esta clase del módulo **6. Marketing Perpetuo** (\"MKT Perpetuo y pirámide de contenidos / Contenido de valor\") responde a una pregunta que aparece siempre al armar el funnel: **¿tiene sentido estar en todas las plataformas?** La respuesta es un no rotundo. Con **una sola plataforma bien gestionada** ya podés tener un negocio en marcha, y si le enchufás una **plataforma secundaria de nutrición**, tenés gran parte del juego ganado.\n\n**Puntos clave que remarca:**\n- El objetivo de todo lo que hacés en marketing es **captar audiencias nuevas del \"pincho/nicho dorado\", nutrirlas con contenido de valor y convertirlas en clientes**. No tiene sentido invertir tiempo donde no está tu nicho.\n- Recordá cómo funciona el **funnel de marketing perpetuo**: en la **punta**, contenido corto de atracción en frío (reels, posts, artículos en Instagram, LinkedIn, Facebook, TikTok); en el **medio**, contenido de nutrición largo (YouTube, podcast, newsletter).\n- **¿Por dónde empezar? La respuesta la tiene tu nicho dorado**: estar donde está, consumir y valorar lo que consume tu cliente ideal. Si todavía no la definiste, usá el **prompt del libro de Marketing Perpetuo en ChatGPT** (le pedís que sugiera plataformas según tu \"desarrollador de nicho dorado\" adjunto), pero **no lo tomes al pie de la letra**: contrastá con tu mercado real.\n- **Foco tipo láser, una plataforma a la vez**: dominás y sistematizás una, la dejás corriendo, recién ahí pasás a la siguiente. El multitasking de gestionar todo a la vez rara vez da resultados.\n\n**Ejemplo (el propio recorrido de la marca):** arrancaron con **Instagram** (captación, nutrición y conversión con posts, reels, historias y links). Una vez pulida y sistematizada, pasaron al **newsletter** (mucha intimidad con la comunidad). Después subieron a **YouTube bajando la barrera de entrada**: en vez de crear desde cero, cortaron sesiones de consultoría de Sophie con clientes para generar el hábito de publicar; ya con el canal creciendo, empezaron contenido específico. Por último, tras decir muchas veces que no, lanzaron el **podcast**, que fue **top 10 todo el año en Argentina** y sigue en el ranking. Todo gracias a hacer foco.\n\n**Sobre la plataforma secundaria de nutrición**, recomienda el **newsletter** porque te hacés con la **base de datos de tus leads** (si Instagram desapareciera mañana, te quedás sin leads ni datos) y te deja leer comportamiento (qué mails abren, qué links clickean), generar vínculo, posicionarte y cerrar ventas. Destaca **YouTube** como plataforma de excelencia porque concentra casi todo el ecosistema: **shorts** (reels de menos de 1 min) para atraer en frío, **videos largos con buen SEO** (descripción y palabras clave para que los motores de búsqueda posicionen) para nutrir y generar autoridad, y **CTA con link a un lead magnet** en la descripción para capturar mails (en B2B pedís el dato) y nutrir con email marketing. **LinkedIn** también sirve: posts, videos y reels (validaron que funcionan bien) para captar, y mensajes que llevan a un **lead magnet** a cambio de un mail.\n\n**Conclusión:** elegí **una** plataforma que se ajuste a tu nicho dorado, optimizala al máximo, recién después sumá la segunda. Foco láser, una a una, pensando la ruta que hace tu cliente de frío a caliente. Es un juego de largo plazo: **iteración, medición y acción**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 142,
        "vn": 1,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-04",
        "cardDesc": "",
        "videoId": "1pq6EOzfbLyItxxIKbiRvgT9FMt3G9RzS",
        "resumen": "Este clip del módulo **Marketing Perpetuo** (pirámide de contenidos) arranca uno de los pilares de tu comunicación: crear tu **personaje legendario**, o sea el personaje con el que las personas se van a ver reflejadas y que le da un marco a todo lo que comunicás. Sofía lo plantea como un paso previo (o correctivo) a comunicar: hacerlo **simplifica** tus mensajes, tus colores, tus palabras, tu forma de hablar y tu acercamiento a la audiencia, porque todo queda estructurado y es fácil de identificar y sostener.\n\nPuntos clave que remarca:\n- **Las personas conectan con personas**, no con motores de búsqueda: conectan con emociones, historias, personalidades. Un artículo o video engancha cuando hay una persona y una historia del otro lado; sin ese vínculo, no existe conexión.\n- El personaje legendario es el que **resiste las pruebas del tiempo** y **resalta entre la multitud**. Hoy cualquiera con un teléfono sube contenido, así que hay que destacar, y armar tu personaje es una de esas formas.\n- Se construye como un personaje de libro o película: se piensa desde la concepción, con distintos **componentes** que lo vuelven interesante. Los personajes interesantes tienen **matices** y **complejidad**.\n- La marca personal **no es un acto de creación, es un acto de autodescubrimiento**: identificar qué te hace ser vos, vivir tu esencia y sumarle los factores que te hacen resaltar y que probablemente ya tenés pero no comunicás ni visibilizás.\n\nConclusión: el recorrido se despliega en **siete puntos** que se ven uno a uno en profundidad. Al terminar la etapa, quedás con una **guía / hoja de ruta** que te deja decir, con una sola mirada, \"este es mi personaje legendario y esta es la forma en la que comunica\".",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 143,
        "vn": 2,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-05",
        "cardDesc": "",
        "videoId": "1a6-1BKlSrE6n3a373Wfdv-3QAS_QDy2G",
        "resumen": "Primer bloque para construir tu **personaje legendario**, y arranca por lo contraintuitivo: mostrar tus **desafíos, fallas y partes oscuras**, no tus aciertos. Sofía advierte que online casi todos comparten solo el éxito, y eso abre una **brecha** enorme con la audiencia (genera ansiedad y sensación de algo inalcanzable). La clave es **concordancia, no disonancia**: tu personaje es tu personalidad real con matices extra, no una máscara. Ella no muestra su vida personal, pero el mejor elogio que recibe es \"sos igual que en redes\".\n\n**Puntos clave que remarca:**\n- **Spiderman vs Batman**: Peter Parker es el personaje de Marvel más querido porque es un humano con defectos y problemas de adolescente, cercano y alcanzable; Batman (millonario, súper inteligente, artefactos) es inalcanzable y no genera identificación. Hacé tu personaje **cercano**.\n- **Carl Jung**: tenemos la **persona** (lo público que mostramos con orgullo), el **ego** que regula, y la **sombra** (lo que ocultamos o solo compartimos con íntimos). El trabajo es hacer una conjunción y **visibilizar ambas partes** —sin contar todas tus falencias todo el tiempo, sino metiéndolas en el discurso.\n\n**Ejercicios que propone:**\n1. Describí tu personalidad en **3 a 5 palabras** (rasgos que te dan orgullo) e identificá tu **superpoder**. Ejemplo de ella: *segura, enfocada, confiada*; superpoder = foco extremo → vuelve simple lo complejo.\n2. Identificá tu **palabra sombra**: eso que no compartís o de lo que no te sentís orgulloso. La de ella: *sobreexigencia* e *introversión*.\n3. Si no te sale, **mandá un mensaje a 5 personas cercanas** y preguntales qué te representa y cuál creen que es tu superpoder; mirá qué se repite. A ella las 5 le dijeron *persuasión* (nunca se había dado cuenta), y su pareja le señaló el *foco*. También podés preguntarles qué rasgo tuyo creen que no comunicás por vergüenza.\n\n**Transformar la sombra en positivo:** tomá tu palabra sombra y atale la transformación que habilitó, respondiendo: ¿qué me enseñó? ¿cómo me hizo más fuerte? Así construís tu **relato**. De ahí salen sus **anclajes de comunicación**: *\"workaholic en recuperación\"* (de sobreexigente y enfocada, pero en equilibrio) e *\"introvertida ruidosa\"* (idea que tomó del creador **Cris**, \"introvertido ruidoso\"). Aclara que **introversión/extroversión** es cómo recargás energía —solo o con muchos—, no si sos sociable (multitud = más de cinco personas que no conoce).\n\n**Conclusión:** estos anclajes se repiten en entrevistas, contenido, videos, posts y artículos para posicionarte con lo que querés comunicar. Este fue el **primer paso** (palabras + superpoder + sombra + su transformación); el siguiente son los **puntos de inflexión**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 144,
        "vn": 3,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-06",
        "cardDesc": "",
        "videoId": "1aMn3xurHUIm4WZkf7Aw0Yo1AbAxYR88C",
        "resumen": "Esta clase del módulo **Marketing Perpetuo** enseña a construir tu **Personaje Legendario** usando los **arquetipos** de **Carl Jung** (padre de la psicología analítica). La idea de fondo es el **inconsciente colectivo**: imágenes y símbolos que todos los humanos interpretamos igual, heredados de generación en generación. Jung definió **12 arquetipos** (con 4 principales: sabio rey, héroe, mago y amante). Se ven en la cultura (Ocean's Eleven, Game of Thrones, el tarot, la religión) y el marketing los explota hace años, pero las **marcas personales** casi no —ahí está la oportunidad de diferenciarse. Sofía cita a un creador que, por tener su arquetipo tan desarrollado y polarizado, vende solo dos veces al año y factura **$2 millones** en minutos.\n\n**Puntos clave que remarca:**\n- Cada persona tiene un **arquetipo principal** y uno **secundario**; el secundario determina cómo actuás. En Marvel todos son héroe + otro: héroe común (Capitán América), héroe gobernante (Thor), héroe forajido (Hulk), héroe bufón (Spider-Man).\n- Los 12 con ejemplo y sombra: **Inocente** (Tom Hanks, Disney; confía de más), **Héroe** (Messi, Zelensky; arrogancia), **Cuidador** (Hagrid, Madre Teresa; no sabe decir no), **Explorador** (los Uquidines; no se aferra a nada), **Rebelde** (Milei y Greta, opuestos pero ambos rompen el statu quo; extremismo), **Amante** (Marilyn, Brando; miedo a no ser deseado), **Creador** (bloqueos por perfeccionismo), **Bufón** (Jimmy Fallon, Robin Williams; tapa sus sentimientos con humor), **Sabio** (Oprah, Hawking, la propia Sofía; le cuesta accionar por sobreanalizar), **Mago** (el más poderoso según Jung, transforma el mundo, marca=Apple/Steve Jobs; puede volverse manipulador), **Gobernante** (control y visión temporal; autoritario, no delega), **Persona común** (Reese Witherspoon, Franco Piso; busca pertenecer y pasa desapercibida).\n\n**Cómo identificar tus arquetipos:**\n1. Elegí dos, pero **filtrando/eliminando** lo que no te representa, no eligiendo de golpe.\n2. Validá con **tests gratuitos** (recomienda dos: \"IDR Labs Academy\" y uno de Kelly Putnam en EE.UU.). A ella le dan mitad sabio rey, mitad gobernante.\n3. Complementá con el **test de las 16 personalidades** (Myers-Briggs, también basado en Jung y sus opuestos: introvertido/extrovertido, sensitivo/intuitivo, pensar/sentir, juzgar/prospecting, y el extra asertivo/turbulento). Clave: mirar los **porcentajes**. A ella le da \"comandante\", 53% extrovertida, 98/90% en juicio y asertividad. El arquetipo es \"la caja\"; la personalidad es cómo operás dentro de ella. Aclara que introvertido/extrovertido es cómo **recargás energía**, no si sos sociable.\n4. Definí principal y secundario: el principal es con el que **podrías vivir toda la vida**. Sofía: sabio (podría vivir leyendo, pensando y enseñando sin hablar) + gobernante (guía su acción, liderazgo y carisma). De ahí sale **MasteryHaus/Master House** = \"la casa de la maestría\" (sabio + gobernante) y sus colores **negro y dorado**, de la realeza.\n\n**Ejercicio de bajada (3 preguntas):** ¿cuáles son tus motivaciones y valores?; ¿qué roles recurrentes ocupás en tus relaciones?; ¿qué personajes de películas/libros te marcaron? —porque tus favoritos suelen espejar tu arquetipo. Ella lo ejemplifica con Iron Man/Tony Stark (sabio-ingeniero con pose de gobernante frente al misil Jericho) y V de Vendetta (rebelde + gobernante + antihéroe). El ejercicio sirve además para recuperar partes de tu esencia que perdiste.\n\n**Conclusión:** cuando identificás y desarrollás tu conjunción de arquetipos, tu comunicación conecta a un nivel mucho más profundo, emociona y vende más; impacta en todo el negocio. El detalle completo de cada arquetipo está en el libro de marketing perpetuo para hacer el ejercicio.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 145,
        "vn": 4,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-07",
        "cardDesc": "",
        "videoId": "14UuxGOlAeUimboZxp4TC7r7wOLhtCG0O",
        "resumen": "Esta clase de **Marketing Perpetuo** (bloque **Personaje Legendario**) enseña a construir tu personaje y tu relato de marca a partir de los **incidentes incitadores** (*inciting incidents*): esos momentos dolorosos o traumáticos que, como dice **Stanley**, tienen todos los personajes interesantes y que te incitaron a accionar o cambiar de rumbo. Sofía sostiene que es muy poco probable que no hayas vivido ninguno, y tenerlos identificados sirve para tu comunicación, entrevistas y los \"puntos de inflexión\" del relato.\n\n**Puntos clave que remarca:**\n- Los incidentes incitadores son **puntos de inflexión / momentos de transformación**: el \"nudo\" donde tu vida cambió. Son la materia prima del contenido de **antes y después**.\n- De todos tus momentos, elegí solo **3 o 4 troncales** que construyan tu historia. No es contarlos todo el tiempo: son una **parte estratégica** dentro del **funnel de marketing perpetuo**, no toda tu comunicación.\n- **La adversidad es tu aliada**: aunque vendas software o le hables a líderes de empresas complejas, tu historia conecta, porque *\"los humanos les compran a seres humanos\"*.\n- El contenido de transformación **mide más interacción** en las métricas.\n\n**Ejercicio (los pasos):** 1) reflexionar sobre los momentos difíciles que te trajeron hasta hoy (familia, relaciones, trabajo); 2) qué **decisión** tomaste tras cada uno; 3) armar una lista con **situación → decisión → a dónde me llevó**. Es el ejercicio de **Steve Jobs**: **conectar los puntos hacia atrás** (solo cobran sentido mirando en retrospectiva).\n\n**Ejemplos propios de Sofía:** la foto con **dos teléfonos** cerrando una ronda de inversión de **$30 millones** (\"workaholic en recuperación\", vida insostenible) contrastada con hablar hoy en un auditorio, con más impacto y más dinero; el **accidente de su hermano** que la trajo de Europa a Argentina y a la aceleradora; darse cuenta de la falta de mujeres en tecnología (le dijeron que \"nunca iba a funcionar\") y fundar **Chicas en Tecnología**, ONG presente en 18 países; y la **beca en Israel** con 50 líderes mundiales donde no podía pagar un hotel de ~$150 la noche (casi su sueldo mensual) y se juró no volver a transitar eso.\n\n**Conclusión:** identificá tus incidentes incitadores para que tu personaje legendario tenga momentos de cambio de rumbo que conecten emocionalmente y alimenten tu contenido perpetuo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 146,
        "vn": 5,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-08",
        "cardDesc": "",
        "videoId": "1qQ1wZl9c6fG8f697VxNTNVNsm8s3-kbX",
        "resumen": "Esta clase, dentro de **Marketing Perpetuo** y bajo el bloque del **Personaje Legendario**, enseña a construir tu historia de marca a partir de tus **incidentes incitadores** (*inciting incidents*): esos sucesos, dolorosos o de quiebre, que te \"incitan\" a cambiar de rumbo. La premisa: todos los personajes interesantes tienen una historia de origen hecha de dolor y puntos de inflexión, y esos momentos son la materia prima de tu contenido y tu comunicación.\n\n**Puntos clave que remarca:**\n- Un **incidente incitador** es el momento en que \"pasa algo y la vida cambia\": funciona como el nudo del relato, donde la historia toma rumbo. Tenerlos identificados sirve para entrevistas, contenido y cualquier comunicación.\n- **Foco: elegí 3 o 4 troncales** (no todos) que sostengan tu historia.\n- **Pasos para identificarlos:** 1) Reflexionar sobre los momentos difíciles/de dolor que te trajeron hasta hoy (familia, relaciones, trabajo). 2) Qué **decisiones** tomaste tras cada uno. 3) Armar una **lista** con: situación → qué decisión tomé → a dónde me llevó.\n- **Ejercicio de Steve Jobs:** *conectar los puntos hacia atrás* — solo mirando el pasado das sentido a las rutas que tomaste.\n- **Uso para contenido:** el material de **antes/después o transformación** es el que más conecta y, según sus métricas, el que genera **muchísima interacción**.\n- **La adversidad es tu aliada:** aunque vendas software complejo a líderes de empresas, del otro lado hay personas, y *los humanos les compran a seres humanos*. Tu historia conecta.\n- Esto es una **parte estratégica** del funnel de marketing perpetuo, no toda tu comunicación.\n\n**Ejemplos propios de Sofía:** la foto con **dos teléfonos** cerrando una ronda de inversión de **$30 millones**, con una vida insostenible (se define *workaholic en recuperación*, con ciclos que la equilibran); el **accidente de su hermano** a sus ~21 años, que la hizo dejar un máster en Europa, quedarse en Argentina y entrar a una **aceleradora** que le cambió la vida; darse cuenta ahí de que **no había mujeres en tecnología** (a los eventos solo iban hombres, los founders eran hombres) y, pese a que una empresaria poderosa le dijo que \"nunca iba a funcionar\", fundar la ONG **Chicas en Tecnología**, hoy en **18 países** impactando a millones; y la **beca en Israel** con 50 mujeres líderes, donde no pudo pagar un hotel de **$150 la noche** (casi un mes de sueldo), tuvo que irse a un hostel y decidió \"nunca más volver a transitar esto\".\n\n**Conclusión:** identificá tus incidentes incitadores, elegí los troncales y convertí tu adversidad en el relato de transformación que va a conectar con quien te compra.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 147,
        "vn": 6,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-09",
        "cardDesc": "",
        "videoId": "1yXWxbM7lqEEOT7ouu3x0ba2F8g-e2wcp",
        "resumen": "Esta clase de **Marketing Perpetuo** arma los **pilares de contenido** y el **Personaje Legendario**: los temas con los que querés que te asocien y ese condimento que te vuelve inolvidable. La pregunta madre es simple: **¿con qué quiero que me asocien?**, y el ejercicio se hace **de lo macro a lo micro**, arrancando por lo que te hace vos, no solo por el negocio.\n\n**Puntos clave que remarca:**\n- **Elegí 3 pilares** que crucen lo que te apasiona con lo que le interesa a tu cliente. Sofía usa **negocios, productividad y mentalidad** (ligados a su arquetipo del sabio). Lo que te apasiona es lo que sostiene el contenido en el tiempo y se nota.\n- **Bajá cada pilar a 3 niveles de profundidad.** Nivel 1: el tópico macro. Nivel 2: **3 (hasta 5) subtemas** — negocios→servicios digitales, desarrollo de equipos, sistematización; productividad→hábitos, sistemas y su ángulo \"anti-gurú\" (adiós club de las 5 a.m.); mentalidad→modelos mentales, libros, autoconocimiento (estoicismo, arquetipos de Jung). Nivel 3: **ángulos y ejecuciones** (mentalidad de negocios, detrás de escena, \"habilidades para desarrollar X\") que se mixean con el nivel de arriba para generar contenido infinito.\n- **Las 3 preguntas guía:** 1) ¿Cuáles son los temas atados a mi personalidad + negocio + que le interesan a mis clientes? (el **match**). 2) ¿Los 3 (o 5) subtemas de cada uno? 3) ¿Qué puedo compartir/crear/hablar de cada subtema?\n\n**El factor transversal (Personaje Legendario):** por encima de los 3 pilares hay un **cuarto elemento transversal** que te vuelve excéntrico y único —tu \"musculosa con camisa de franela\", tu \"Don Quijote\"—. Ejemplos: **Alex Hormozi** (siempre igual, casi desprolijo, como statement de \"soy millonario sin traje\"); **Coral** (negocios + fisicoculturismo); **Gary Vee** (ventas de garaje/eBay); **Roy Williams** de Wizard Academy (todo tematizado con Don Quijote, rey del radio); **Mauro Stendel** (millonario en Lamborghini que escucha cumbia); **Casey Neistat** (Ray-Bans pintados de blanco y rayados); **Robert De Niro** con lentes de sol como personaje; y **Rosalind/coleccionista de libros antiguos** con su membresía y productos derivados.\n\n**Conclusión:** identificá tus 3 pilares, desgranalos de macro a micro en 3 niveles, y encontrá (o desarrollá) ese componente transversal que te diferencia por completo. Cuando lo tengas, empezá a comunicarlo: eso es lo que hace tu marca única.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 148,
        "vn": 7,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-10",
        "cardDesc": "",
        "videoId": "17pHjj0dYXtHZFyb-2Z06Ve-OKhr3_z-M",
        "resumen": "Esta clase de **Personaje Legendario** (dentro de Marketing Perpetuo) trata sobre el rol de los **mentores** en la construcción de tu personaje: esas personas que a lo largo de tu vida —padres, un amigo, un profe, alguien cercano o lejano, incluso un personaje de un libro— moldearon tus creencias, valores y forma de ver el mundo. Sofía lo ancla en el **viaje del héroe** (o arco del héroe): el héroe vive en su **mundo ordinario**, recibe una **llamada a la aventura**, la rechaza, y ahí aparece el **mentor** que lo ayuda a transicionar al **mundo especial**.\n\n**Puntos clave que remarca:**\n- El viaje del héroe le pasó a todos los personajes: Ulises, Harry Potter, Luke Skywalker, Spiderman, Kung Fu Panda, El Rey León. Incluye adversidades, enemigos, un **momento de entrenamiento** (Luke con Yoda), un momento de muerte/resurrección, la recompensa, el **elixir** y una gran lucha final (como el cierre de Harry Potter).\n- Es el encuentro con el mentor lo que nos empuja del mundo ordinario al especial. En la vida real, muchas veces son los **puntos de inflexión** con otras personas los que nos cambian de rumbo.\n- Tres preguntas para trabajar: **1)** ¿Quién le dio forma a tus creencias, valores y pensamientos? **2)** ¿Cuáles mentores (personificados) aportaron partes de tu personalidad y qué partes se fueron transformando? **3)** ¿Qué aprendiste de ellos y en qué te resististe al principio? (eso que estaba tan arraigado que te costó cambiar).\n\n**Ejemplo personal:** un compañero de su primer trabajo fue su mentor sin saberlo. Ella venía de un contexto familiar donde se sacaban muchos **supuestos** sobre las intenciones de los demás; él, cada vez que ella daba algo por seguro, le devolvía \"podría haber sido por esto, por esto, por esto…\", enseñándole a **tomar perspectiva**. Tardó mucho tiempo en incorporarlo.\n\n**Ejemplos de posicionamiento:** nombrar a tus mentores enriquece tu narrativa porque sus historias también configuran la tuya. Cita a **Bill Gates y Warren Buffett** (la madre de Gates insistió con \"dale una cena, Bill\"; terminaron todo el día juntos y nunca más se separaron) y a **Tony Robbins con Jim Rohn** (speaker motivacional cuya conferencia le cambió la vida a Tony; y Jim Rohn a su vez tuvo sus mentores, y esos los suyos: una cadena que cuenta una historia).\n\n**Conclusión:** incorporar a tus mentores en tu relato le suma matices a tu **personaje legendario** y lo hace cada vez más interesante y creíble.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 149,
        "vn": 8,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-11",
        "cardDesc": "",
        "videoId": "1Q1usD0rH1nbVZgFAg-1JhqOInu2ZEFJA",
        "resumen": "Este clip corto del módulo **Marketing Perpetuo** (pirámide de contenidos) trabaja un componente puntual del **Personaje Legendario**: la **ciudad** como parte de tu identidad. La idea central es que el lugar donde nacimos, crecimos y donde elegimos vivir hoy **moldea quiénes somos**, y por eso sirve como material para construir el personaje con el que creás contenido.\n\n**Puntos clave que remarca:**\n- Cada ciudad tiene una **personalidad** y evoca algo: **Los Ángeles** = lo superficial, la farándula, la búsqueda de fama, el trabajar sin parar; **Nueva York** = poder, dinero, estatus; **París** = amor, arte, artistas, lo romántico, la moda.\n- Hay que entender **de dónde venimos** (la ciudad que nos formó) y **dónde elegimos estar hoy**: ¿cambió esa ciudad?, ¿por qué sigo eligiéndola?, ¿qué tiene que está alineado con mi persona e intereses?\n\n**Ejemplo personal (Sofía):** es **cordobesa** (centro de Argentina) y vivió **11 años en Buenos Aires / Capital Federal**; se mudó a los ~23 con un **objetivo profesional súper específico**: sumarse como directora de operaciones de la **aceleradora**, abrir oficina allá y posicionarla en Buenos Aires. Esa ciudad fue una **catapulta** por su ritmo acelerado y sus oportunidades. Hoy elige un universo distinto: vive en **un valle, con un lago y montañas**, buscando otro ritmo de vida acorde a su momento.\n\n**Conclusión:** preguntate qué está diciendo de vos la ciudad donde vivís hoy. Y si notás que **no te representa**, tomalo como un **llamado a la acción**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 150,
        "vn": 9,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-12",
        "cardDesc": "",
        "videoId": "1tuUL8gVHEhWKlNbmNqnlFyuOuYNKE0cL",
        "resumen": "Esta clase de **Marketing Perpetuo** (parte de la pirámide de contenidos y del **Personaje Legendario**) va sobre por qué necesitás **enemigos/villanos** para diferenciarte en un mundo saturado de gente creando contenido igual. La idea central: no podés ser **\"vainilla\"** (una persona del montón, sin opinión fuerte, sin nada que la diferencie). Para resaltar hay que buscar **polaridad/polarización** en tus mensajes, y eso exige un enemigo del otro lado.\n\n**Puntos clave que remarca:**\n- **Identificá tus villanos.** Preguntate: ¿en contra de qué estás?, ¿qué cosas te hacen enojar?, ¿qué hace tu competencia que te molesta y qué hacés vos distinto? Deben estar ligados a tus **pilares**. Los villanos no tienen que ser personas: pueden ser conceptos, productos o ideas.\n- **\"El enemigo de tu enemigo es tu amigo\".** Si tu cliente ideal ya tiene un enemigo, adoptalo como tuyo y se vuelven **aliados con un enemigo en común**. Eso genera identificación y sube el **engagement** (un bando te apoya fuerte, el otro te discute).\n- **Es más fácil y creíble decir contra qué estás que a favor.** En vez de \"estoy a favor de la honestidad / no vendemos humo\", conviene \"estoy en contra de X\". Así, del otro lado responden \"yo también estoy en contra de eso\".\n- **Etiquetá a tus enemigos.** Cuando le ponés etiqueta a algo, te adueñás del concepto y lo usás en toda tu comunicación.\n- **Frase plantilla:** \"estamos en el negocio de terminar con ___\". Variante para negocios: reformularla como una declaración fuerte (ej. \"somos la mejor aceleradora del mundo porque no tomamos equity y te hacemos ganar dinero\").\n- **Ejercicio sugerido:** analizá cuentas controversiales/polarizadas y mirá los comentarios: cuando alguien las ataca, aparecen 10-20-30 personas defendiéndolas porque comparten al mismo enemigo. Eso es lo que hay que lograr.\n\n**Ejemplos que da:** *Glucose Goddess* (villano = los picos de glucosa y comer azúcar al despertar); el enfoque **keto** contra el azúcar; **Javier Milei** con la etiqueta de \"la casta\"; **Andrew Tate** con \"la Matrix\"; **Cora Mujeres** con \"la emprendehambre\"; y su propia etiqueta pasada, **\"andá y hazé\"** (ante el miedo, hacelo o analizalo y reformulalo). Su bandera personal de polarización: **\"no hace falta despertarse temprano para tener éxito\"** / estar en contra de los gurús de la rutina matutina y del **club de las 5 a.m.**, y de quienes dicen que el éxito es ser millonario (para ella el éxito es subjetivo). También cita el caso de una clienta a la que le indignaba la falta de honestidad en su rubro, transformándolo en material de contenido.\n\n**Conclusión:** el objetivo es un mensaje claro que ejemplifique y especifique quiénes son tus enemigos, por qué sos diferente y qué te separa de ellos día a día. Hacerte enemigos + etiquetarlos + usarlos en tu comunicación te permite **polarizar la audiencia y empezar una pelea por tu propósito**, creando una audiencia que te ame.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 151,
        "vn": 10,
        "grupo": "Marketing Perpetuo · Pirámide de contenidos · Personaje Legendario",
        "modulo": 6,
        "titulo": "MKT Perpetuo-13",
        "cardDesc": "",
        "videoId": "1jQUGShJleMOXvoWXd95Ovvoo14LZ986C",
        "resumen": "**De qué va:** clase de cierre del bloque **Personaje Legendario** (tu marca personal) dentro de Marketing Perpetuo. Sofía muestra el **gráfico final** que en el libro venís completando a lo largo del camino de autodescubrimiento, y explica cómo condensarlo en una sola hoja para usarlo en todo lo que publiques.\n\n**Puntos clave que remarca:**\n- El gráfico reúne todas las piezas del personaje: **arquetipo principal**, **secundario** y **compuesto**; tu **personalidad + superpoder** (las **5 palabras que te definen**, que le preguntás a una persona cercana, más el superpoder que identificás); tu **kriptonita/sombra**; tu **historia de origen**; el **incidente incitador** (la decisión donde se bifurcan los caminos, mirando hacia atrás para \"conectar los puntos\" como **Steve Jobs**); la **resurrección** (qué aprendiste y a dónde te llevó todo); tu **ciudad actual vs. la pasada** (por qué elegiste la actual y cómo la anterior te ayudó a ser quien sos hoy); tus **mentores** (de antes y de ahora) y cómo te moldearon para meterlos en tu narrativa; los **tres pilares** con los que te van a empezar a identificar; y tu **condimento extra**, el pilar **transversal** —\"la flecha que atraviesa todo\"— que te hace diferente, te hace sobresalir y define tu negocio (\"estamos en el negocio de acabar con tal cosa\").\n- El resultado es un **one pager** (como el que en las startups resume el proyecto en una sola página): tu personaje legendario resumido en una hoja. Después le vas agregando riqueza y escribís tu historia completa, ya bajada para reutilizar.\n- Esa narrativa se usa **en todos lados**: creatividades, videos, descripciones en cada plataforma, la bio de la web, la mini bio para entrevistas, programas y colaboraciones.\n- Lo crucial es mantenerlo **constante y coherente a lo largo del tiempo**.\n\n**Conclusión:** la gente busca **conexiones humanas**; hay que demostrar que de este lado hay un ser humano, no un robot ni una IA, para que quien está del otro lado se sienta cerca. En un mundo cada vez más saturado de creadores de contenido, la ventaja se gana con **autenticidad y diferenciación**: por eso hay que terminar de pulir el personaje legendario y empezar a comunicar y crear, porque ese personaje va a guiar absolutamente todo lo que hagas con tu marca.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 152,
        "vn": 1,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine (main)",
        "cardDesc": "",
        "videoId": "1n2EHhHVUuLotLd1zzYLdWdSGuKVXD2rV",
        "resumen": "En este video Caro te muestra el **Starter Pack de MasteryHaus**: el empaquetado ya armado sobre la plataforma (**Mastery Machine** / Go High Level) para que arranques a usarla sin construir de cero.\n\nRecorre estas piezas ya creadas como template:\n\n- **Funnel B2B** (en Sites/Funnels): editás el template con las partes ya marcadas: logo, título que hable al dolor del nicho, bajada corta, formulario e imagen/gif del video. El formulario se edita desde la sección Formularios (builder).\n- **6 automatizaciones**, todas en estado **draft/borrador**: hay que entrar a cada una y darle **publish** para activarlas. Cada una tiene un trigger que dispara la acción:\n  1. **Registro opt-in + lead magnet**: al completar el formulario asigna una etiqueta y manda el correo de recurso de valor.\n  2. **Calentamiento de leads**: envía un correo, espera **2 días** y así hasta **10 correos** (podés reducir la cantidad o cambiar la espera a días/horas/minutos).\n  3. **Booking call de ventas**: cuando en el CRM cambiás el estado, manda correo de \"preseleccionado\" con link al calendario. Trae condiciones por tag (bill/one) porque la empresa madre tiene varios programas; te recomienda dejar una sola y editar los nombres. **No borres las variables entre corchetes** (traen el nombre del contacto).\n  4. **Actualizar contactos que agendaron**: pone el tag, mueve la tarjeta del CRM y avisa al closer.\n  5. **Recordatorio de entrevistas**.\n  6. **Exclusión del calentamiento** para quienes ya agendaron.\n- **CRM de ventas** template con pipeline: sin calificar, aplicaciones, agendar/agendada, 2da y 3ra llamada, seguimiento, no asistió, ganada, perdida, descartado.\n- **Calendario**: conectás tu **Google Calendar** en Configuración > Mi perfil, creás un calendario de booking (persona, duración, disponibilidad, aula virtual) y pegás el link en la automatización 3.\n- **Emails** (Marketing > Templates): los **10 correos** del calentamiento vienen iguales para que los edites; al guardar se enlazan solos. Menciona más videos y la documentación de Go High Level.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 153,
        "vn": 2,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -01",
        "cardDesc": "",
        "videoId": "1k1qk91EHseQS017PVOm1StgL9k-L8IoS",
        "resumen": "En este video, **Lucas** del equipo de implementadores te muestra cómo **configurar tu dominio en la Mastery Machine**. Arranca con un repaso teórico: un **dominio** es el nombre del sitio (ej. masteryhouse.com), la **URL** es la dirección completa, la **zona DNS** guarda toda la configuración y los **registros DNS** indican a dónde dirigir a la gente. Repasa los cuatro tipos que vas a usar:\n\n- **Registro A**: conecta el dominio con el servidor/sitio.\n- **CNAME**: para atajos o alias.\n- **MX**: para que funcionen los correos.\n- **TXT**: para verificar servicios (Google Workspace, Microsoft 365).\n\nSi todavía no compraste dominio, recomienda **GoDaddy** por precio y facilidad. Usa como ejemplo **houseofmaster.com**. En la Machine vas a **Settings → Domains** y conectás un dominio nuevo en tres partes:\n\n- **Funnel/website/store/blog/webinar**: el dominio que ven los usuarios. Agregás manualmente el registro A con el valor que da la Machine (reemplazando el \"Parked\" de GoDaddy) y el CNAME con **www** apuntando a site.lot...com, para que entre con o sin www. Aclara: al copiar, usá el botón de copiar porque el valor sigue hacia la derecha. Al final elegís la página default (el template SL del Starter Pack).\n- **Branded domain (dominio de marca)**: se usa el subdominio **app.**, un CNAME que aplica a formularios, calendarios, quizzes y links de la plataforma.\n- **Emails**: se usa un subdominio (ellos usan **go.**) para cuidar la reputación de envío. GoDaddy permite cargar varios registros juntos (TXT, CNAME, dos MX con **prioridad 10**) y recomienda sumar el **DMARC** (TXT, opcional pero útil al arrancar).\n\nLos DNS pueden tardar **entre 30 segundos y 15 minutos**; en GoDaddy suele ser casi instantáneo. Paciencia y verificar tocando el botón.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 154,
        "vn": 3,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -02",
        "cardDesc": "",
        "videoId": "1C2cjp6jGFRRJANDDDmAs7uT86nim0S49",
        "resumen": "En esta lección de la **Mastery Machine** te muestro, paso a paso, cómo **vincular tus redes sociales** a la plataforma para que trabajen conectadas a tu CRM.\n\nEl recorrido arranca en el menú de la izquierda: entrás en **Configuraciones**, bajás hasta la pestaña **Integraciones** y ahí te vas a encontrar con todas las plataformas que podés conectar: **Facebook, Instagram, TikTok y LinkedIn**. Te invito a que explores el resto también, para ver cuáles hacen sentido con tu negocio.\n\nEl foco lo ponemos en **Facebook e Instagram**, pero ojo: el proceso es igual para todas. Los pasos son:\n\n- Hacés clic en **Conectar** y la Machine te redirige automáticamente a la página de vinculación.\n- Esa página trae la cuenta que tengas abierta en tu navegador, así que **asegurate de estar logueado** en la cuenta que querés vincular (en el ejemplo, la cuenta de Sofía: \"continuar como Sofía\").\n- Elegís qué querés vincular de ese Facebook (en el ejemplo aparecen las páginas de **Sophie** y de **Mastery House**). Al tocar la cuenta, como está asociada a un Instagram, te lo trae también.\n- Cerrás con el botón **Conectar Facebook e Instagram** (en el video no lo cliqueo porque esas cuentas ya están vinculadas a la Machine).\n\nLo mismo repetís con **TikTok, LinkedIn** o las plataformas que tengas corriendo. \n\nUn punto clave que remarco: **vinculá también tu cuenta de Gmail**, porque es lo que vas a usar después para configurar los **calendarios y Google Meet**.\n\nEn resumen: identificá qué plataforma te interesa conectar, verificá que estés logueado con esa cuenta en el navegador y seguí los pasos de la conexión. Así dejás la Mastery Machine ya vinculada a todas tus redes.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 155,
        "vn": 4,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -03",
        "cardDesc": "",
        "videoId": "1ycSWOH0yUsNO0CTLmlYtP62rI3Rdm-Ik",
        "resumen": "Este video de la **Mastery Machine** muestra cómo conectar tu número de **WhatsApp** a la plataforma para poder mandarles mensajes a tus potenciales clientes desde el CRM.\n\nEl recorrido es así:\n\n- Andá a **Configuraciones** (menú de abajo) y entrá a la pestaña **WhatsApp**. Con el botón azul agregás tu número de teléfono y hacés la verificación; una vez integrado te queda listado ahí.\n- El paso siguiente es crear **templates (plantillas)**, porque para iniciar una conversación desde la Machine no se puede escribir directo: sí o sí arranca con un template. Al crearlo elegís el **nombre** (en el ejemplo le pone \"test\"), la **categoría** (usa \"marketing\"), el **lenguaje** y el tipo de contenido (texto).\n- Escribís el mensaje y lo vas viendo en la **preview** del lateral. El ejemplo que redacta es: \"Hola, ya acabamos de escribir el texto de este WhatsApp. Te contactamos de Mastery House...\". Podés sumar un texto más chico abajo y hasta un **botón** que dirija a algún lado. Tocás **crear**, esperás unos segundos y la plantilla te aparece en la lista.\n\nDespués muestra la ficha del contacto: entrás a **Contactos**, buscás la persona y ves toda su info. A la izquierda están los **campos de formularios** que completó (por ejemplo la aplicación), en el medio todas las **acciones** que hizo dentro de la Machine (oportunidad creada, mails abiertos, etc.) y a la derecha el **historial de páginas** que visitó.\n\nPara escribirle, tocás **WhatsApp** dentro del contacto, buscás el template que armaste y lo enviás. En la demo el mensaje rebota porque tenía el número mal cargado, pero con el número bien puesto llega. Así dejás el número conectado y podés chatear con tus clientes desde la Machine.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 156,
        "vn": 5,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -04",
        "cardDesc": "",
        "videoId": "1N8SF0kDAj2Ju9RqaXAr2rV4rGFQ3I-Qz",
        "resumen": "En este video te muestro **cómo migrar tus contactos a la Mastery Machine** desde tu plataforma anterior de email marketing o CRM. El proceso es 100% práctico, paso a paso:\n\n- **Primer paso:** entrá a tu plataforma actual y descargá tu base de datos en un archivo **CSV**. Asegurate de traer lo fundamental: **nombre, apellido y email**, y si tenés **etiquetas** de email marketing, también.\n- En la Mastery Machine, andá al menú lateral izquierdo, a la pestaña **Contactos**, y hacé clic en la flechita de **importar contactos**. Elegí la opción \"contactos\" y dale a siguiente.\n- **Arrastrá el archivo CSV** al campo correspondiente. Te aparecen tres opciones: crear contactos, actualizarlos, o **crear y actualizar**. Te recomiendo siempre elegir **\"crear y actualizar\"**, porque la plataforma crea los nuevos y actualiza los que ya existen identificándolos por el mail.\n- Después viene el **matcheo de columnas**: la Machine suele hacerlo automático (conecta ID con ID, nombre con nombre, email con email, y si tenés etiquetas elegís el campo **tags**). El resto de la info que no aplica —fechas de movimientos, estados de apertura— la dejás sin matchear y marcás la opción de que no importe.\n- En el paso siguiente te conviene **crear una lista** (por ejemplo \"base email marketing CRM anterior\") para tener ordenada esa base. También podés sumar los contactos a un **workflow** (automatizaciones que se ven más adelante) o agregarles una **etiqueta**, por ejemplo *\"base de datos enero 2025\"*, para identificar de dónde salieron.\n- Por último, **confirmás que los contactos son tuyos** —buena práctica de email marketing— y das comienzo a la acción. Refrescás la página y ya vas a ver los contactos cargados y la lista creada.\n\nAsí de simple importás toda tu base a la Mastery Machine sin perder información.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 157,
        "vn": 6,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -05",
        "cardDesc": "",
        "videoId": "1NxZoQEc8_yQ69LmpS-N5uczPrmNg7mLF",
        "resumen": "Este video recorre la sección de **Contactos** de la **Mastery Machine**, el CRM del método, y cómo ordenar tu base de datos con etiquetas y listas.\n\nPrimero repasa todas las **acciones** que podés hacer sobre los contactos:\n- **Agregar** un contacto manualmente o **importarlos**.\n- Mover/cambiar de CRM al contacto (seleccionás y editás su ficha).\n- Sumarlo a una **automatización**, enviarle un **SMS** o un **email**.\n- **Agregar o quitar etiquetas**, **eliminar** contactos y **exportar** (bajar toda la base).\n\nEl corazón de la clase es **filtrar** para segmentar. El ejemplo concreto: a un contacto le agregás la etiqueta **\"compró programa uno\"**. Si la etiqueta no existe, la creás escribiéndola ahí mismo (también menciona \"compró programa 2\"). Después vas a **más filtros → etiquetas**, seleccionás \"compró programa uno\" y aplicás; te queda un solo contacto. Con ese filtro guardás una **lista inteligente** llamada igual, y de ahí en más **toda persona que tenga esa etiqueta entra automáticamente** a la lista.\n\n¿Para qué sirve? Para mandar **mails específicos** a esa base sin cruzar información con el resto: ideal para **venta cruzada** o **escaleras de valor** (un producto que complementa a otro). Repite el mismo procedimiento con una etiqueta y lista **\"newsletter\"**: creás la etiqueta, filtrás, guardás la lista inteligente y después enviás los correos del newsletter solo a esa base, optimizando el proceso.\n\nLa idea clave que deja: lo más importante de esta sección es **migrar los contactos** a la plataforma y armar un **sistema de etiquetas y listas** para ordenar la base de datos según los objetivos de tu estrategia.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 158,
        "vn": 7,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -06",
        "cardDesc": "",
        "videoId": "14IG0pP3Zgb9CFKCmGRerZ6BLLYFIRy0q",
        "resumen": "Este video te muestra cómo armar y enviar **mails** desde la **Mastery Machine**, la plataforma del método. Entrás por el menú izquierdo a **Marketing → Emails**, y sirve tanto para un **newsletter** automatizado como para mails sueltos. El ejemplo que usa es la estrategia de newsletter.\n\nLos pasos concretos:\n\n- **Ordená todo en carpetas**: creá una carpeta (ej. \"Newsletter\") y adentro creás lo que la plataforma llama **campaña**.\n- Arrancás **desde cero** eligiendo \"Diseño para editar\" (también hay opción con código).\n- En el editor **arrastrás elementos** desde el menú izquierdo: primero una **columna** (por lo general una sola línea) y encima el bloque que quieras (texto, imagen, botones, logos, redes, footer). La recomendación es **mantenerlo lo más simple posible**, solo texto.\n- Parándote sobre el elemento editás **color de fondo, márgenes, espacios, tipografía, tamaño y negritas**.\n- Con los **valores customizables** traés data de la base: por ejemplo, arrancar el mail con **Contacto → first name** para que aparezca el nombre real del destinatario.\n- Le ponés **nombre** al mail para rotularlo (ej. \"Newsletter número 1\" o \"Cortito número 100\"), guardás, y en los **tres puntos** usás **test email** para enviártelo a vos y ver cómo queda.\n\nDespués hacés clic en **Enviar o programar**. Podés programar la fecha y hora (los \"cortitos\" salen los **domingos a las 3:00 p.m.**), elegís el **mail de salida** (ej. hola@masteryhouse.com, que aparece validado cuando conectás el dominio), el **nombre del remitente**, el **asunto** (también podés meterle el nombre del contacto) y el preview.\n\nClave: vinculás el envío con la **lista inteligente** (ej. \"newsletter\") o con **etiquetas de contacto**, así solo lo reciben esas personas. Truco final: en los tres puntos usás **Clonar** para reusar el template sin rearmarlo; solo cambiás texto, título y **revisás que el asunto no se repita**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 159,
        "vn": 8,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine-07",
        "cardDesc": "",
        "videoId": "19rvKo5EicchC99OHTya01VdbdF2N3fPO",
        "resumen": "Esta clase de la sección **Mastery Machine** muestra, paso a paso, cómo armar una **automatización de email marketing** dentro de la plataforma para hacer **calentamiento de leads** con foco en venta, sin escribir correos a mano todos los días. Sofía entra por el menú lateral a la pestaña **Automatizaciones**, sugiere ordenar todo en carpetas para escalar sin lío, y crea un workflow desde cero.\n\nPuntos clave que remarca:\n- **Toda automatización parte de un disparador** (regla general). Acá elige el disparador **\"etiqueta de contacto\"**, con el filtro **\"etiqueta agregada\"** (también existe \"etiqueta removida\"). Ejemplo de etiqueta: **compró programa uno** — todos los que la tengan entran al flujo. Nombra la acción y guarda el disparador.\n- Con el **botón \"+\"** agrega el paso **\"Enviar un mail\"**. Aclara que desde acá también se puede mandar SMS, mensaje por **Slack**, hacer una llamada o escribir por **Instagram/Facebook DMs**, pero la clase se enfoca en mails.\n- Configura el correo: remitente (**Sofía Contreras**), email de salida (**hola@masterhaus.com**), asunto (se puede personalizar con el nombre) y cuerpo.\n- Suma un paso de **espera** (minutos, horas o días; o \"avanzado\" para ventanas de tiempo): pone **2 días** y luego un **segundo mail**. Al terminarlo, el contacto sale del flujo.\n- Le pone nombre al workflow (**\"calentamiento de leads\"**) y recién lo enciende una vez validado.\n\nLas **dos formas de cargar los mails**: (1) escribirlos directo en la interfaz, o (2) —la que recomienda— crearlos como **Templates** (Marketing → Emails → Templates, en carpeta propia) y después traerlos al paso con el menú desplegable, así los campos superiores se llenan solos.\n\nDetalle importante: el **link de baja/desuscripción** solo se puede insertar desde el template, no desde la automatización. Se hace seleccionando el texto (\"puedes darte de baja tocando aquí\"), agregando un **hipervínculo con la etiqueta email unsubscribe link** y, opcional, pintándolo de azul.\n\nCierra con las **estadísticas** (menú izquierdo o dentro del mail): enviados, aperturas, tasa de clics, respuestas y rebotes.\n\nConclusión: distingue **newsletter** de **automatización**. La automatización es una **secuencia fija con objetivo de venta**: cada quien arranca en el mail uno y baja escalón por escalón, pensado estratégicamente. El newsletter, en cambio, se actualiza día a día — quien se suscribe hoy recibe la edición actual, no el primer envío de hace cinco años. Por eso se mantienen los entornos separados.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 160,
        "vn": 9,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine-08",
        "cardDesc": "",
        "videoId": "1DKYTs6r8DKjL6yMxSMF_z5qUI0pBL4O0",
        "resumen": "Clase práctica del módulo **Mastery Machine** (Mastery Haus-08): un tutorial paso a paso de cómo **crear formularios** dentro de la plataforma, desde cero, para captar leads y ordenarlos.\n\nPuntos clave que remarca:\n- **Dónde:** menú lateral izquierdo → pestaña **Sites** → sección **Formularios**. Podés crear **carpetas** para tener orden, usar **templates** ya preconfigurados, o armar uno **desde cero**.\n- **Constructor:** en el menú izquierdo, con el símbolo **+**, agregás elementos arrastrando (drag & drop): nombre completo, primer nombre, apellido, fecha de cumpleaños, teléfono, mail, botones, dirección, ciudad, preguntas de una línea, textos amplios, **desplegables** y **múltiples opciones**. Sacás los que vienen por defecto para empezar limpio.\n- **Customizar bloque a bloque:** al pararte encima de un campo se abre un menú a la derecha. Ahí renombrás (ej. \"First Name\" → **Nombre**), lo marcás como **campo requerido** (aparece el **asterisco**), y con el ícono de estilo cambiás tamaño, si es **caja o línea**, márgenes y colores. También agregás **títulos** (con negrita, centrado, tipo de letra) e **imágenes**.\n- **Consentimiento:** si es un **lead magnet** o querés captar base de datos, dejá siempre un texto de política/permiso (ej. *\"quiero recibir información de valor sobre negocios y productividad\"*): ese clic es el consentimiento para mandarle mails.\n- **Lógicas** (arriba a la izquierda): el diferencial. Permite **redireccionar** según la respuesta (ej. si contestan la opción 2 → van a masterlyhouse.com/x), combinar varias respuestas, mostrar **mensajes personalizados**, **descalificar leads** (mensaje de rechazo o redirección) y **ocultar/mostrar campos** condicionalmente.\n\nEjemplo del propio entorno: cuando un lead responde algo que **no califica** (ej. un negocio de producto), lo derivan a una landing que agradece la aplicación pero aclara que solo trabajan con **negocios de servicios**.\n\nConclusión: guardá siempre y **ponele nombre a cada cosa** (ej. \"formulario uno\"); con los **tres puntos → Preview** ves el formulario ya funcionando. El formulario no es solo captura: bien armado con lógicas, **filtra y califica** a los leads solo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 161,
        "vn": 10,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -09",
        "cardDesc": "",
        "videoId": "1MxWoLuQiBMhRSDb38tEGA3rilY7vHukh",
        "resumen": "Esta clase es un tutorial práctico de **Mastery Machine**: cómo armar **funnels y landings** dentro de la plataforma. Sofi arranca con una regla de oro (**orden**: carpetas y nombres a todo para escalar) y muestra un template real, el funnel **\"Vender antes de la venta\"** (captación, foco en crear marcas sólidas de influencia).\n\nEse funnel B2C tiene **4 pasos, cada uno una landing**:\n- **Opt-in**: título que segmenta (líderes que piensan y ejecutan a 10 años), **VSL** y botón. Al hacer clic se abre un **pop-up = lead magnet**: pide nombre y mail a cambio de una guía de valor + casilla de consentimiento. Quien deja el dato entra a un **calentamiento de leads** (secuencia anual, un mail día por medio).\n- **Video de venta**: Sofi explica el marketing perpetuo, más los **5 pasos del sistema de aplicación**, **casos de estudio** (win-win, ej. Pilates Heat de Sabri y Rafa) y una carta \"si es para vos\".\n- **Formulario de aplicación** embebido: segmenta (servicios, acompañamiento 1 a 1), setea la expectativa de contacto en **48 h solo si hay match**, campos obligatorios con *.\n- **Agradecimiento**: confirma, pide revisar spam y deja un video (\"tres riesgos que debes evitar\").\n\nPuntos clave del constructor:\n- Se trabaja por capas: **sección → columnas (1 a 6) → elemento** (título, imagen, botón, formulario, etc.).\n- Para espaciar usá **márgenes/padding, nunca Enter** (rompe el responsive).\n- Configurá **dominio, favicon, SEO Meta Data y códigos** (pixel de Meta/Google, Tag Manager).\n- Los botones e imágenes reciben **acciones** (pop-up, URL externa, siguiente paso).\n- Hay **A/B testing** (variación 50-50 cambiando una sola variable) y adaptación **mobile vs desktop** obligatoria.\n\nConclusión: mantenelo **simple** (secciones, colores, imágenes), reutilizá templates ajustando también el SEO, y recién ahí publicá.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 162,
        "vn": 11,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine-10",
        "cardDesc": "",
        "videoId": "1WtxI9RUXv0ldwLpAW-kc_sDX0Y1IHCxT",
        "resumen": "Clase práctica del módulo **Mastery Machine** donde Sofía muestra cómo usar el **CRM interno de la Mastermind** (lo encontrás en el menú lateral izquierdo como **Oportunidades**, un entorno de **Pipeline**). La idea es usarlo como **tracker**: podés armar un proceso de **captación** (aplicación → llamada de venta → seguimiento → conversión) o un proceso interno para ver la **salud de los clientes** y su avance en el journey map. El ejemplo es un CRM de ventas simple.\n\nPuntos clave que remarca:\n- **Antes de tocar la plataforma, volcá el proceso en un documento**: identificá las etapas reales que atraviesa el potencial cliente hasta convertirse en cliente. Las **columnas son los estados** de tu proceso.\n- **Para construir el pipeline**: pestaña superior **Pipelines** → crear nuevo → nombre (ej. \"CRM ventas\") → cargar las columnas. En el ejemplo: **Aplicación**, **Agendar llamada de ventas**, **Llamada agendada** (la agrega después, al lado de \"agendar\"), **Seguimiento**, **Cliente ganado**, **No agendó llamada de ventas** y **Cliente perdido**. Se reordenan con las flechitas y se guarda.\n- **La lógica de movimientos**: quien aplica y califica cae en *Aplicación*; ventas revisa y mueve a *Agendar llamada*, lo que **dispara automáticamente un mail** con el copy para agendar. Si agenda, la tarjeta se mueve sola a *Llamada agendada*; si pasa el tiempo sin agendar, va a *No agendó* (donde un rol puede levantar el teléfono y avisarle). Si se gana, pasa a *Seguimiento*. Cada movimiento se puede automatizar para **bajar la barrera operativa**.\n\nEjemplo de automatización (crear la tarjeta sola): ir a **Automatizaciones** → nuevo **workflow** desde cero. **Disparador**: \"Form completado\" (lo nombra \"formulario de aplicación\"), con filtro \"el formulario es → Formulario 1\". Paso 2: **crear el contacto** y agregarle la etiqueta **\"form aplicación\"**. Paso 3: **crear/actualizar una oportunidad** → acción \"crear contacto en CRM ventas\", elegir pipeline **CRM ventas**, columna **Aplicación**, y en el nombre de la oportunidad traer el **nombre del contacto** (opcionalmente valor del lead y fuente). Guardar, renombrar la automatización a **\"Form aplicación – CRM ventas\"**, publicar y guardar. Lo prueba entrando al formulario desde **Sitios**, lo completa como \"Juan / juan@masteryhouse.com\" y envía: la tarjeta aparece automáticamente en la columna *Aplicación*.\n\nTambién menciona que se puede **filtrar** la vista (por responsable, estadio, fecha de creación) y alternar entre **cuadrícula y lista**.\n\nConclusión: lo fundamental es entender que las columnas representan el estado de tu proceso y de cada potencial cliente, y que cada movimiento dentro del pipeline es automatizable. En la próxima lección profundiza en más automatizaciones para la Mastermind y el CRM.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 163,
        "vn": 12,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine-11",
        "cardDesc": "",
        "videoId": "18Asb5CVHHX4HaF1QWhoo8gAjPzXYC9_h",
        "resumen": "**De qué va:** clase práctica (tutorial de pantalla) del módulo **Mastery Machine** que muestra paso a paso cómo configurar y usar los **calendarios** dentro de la plataforma (la \"Master Machine\"), que funcionan muy parecido a **Calendly**: se pone logo, título y descripción, la persona elige un horario, completa sus datos y la reunión queda agendada automáticamente.\n\n**Puntos clave que remarca:**\n- **Primero, el equipo:** Configuraciones → pestaña **Mi staff** → Agregar. Se cargan nombre, apellido y el mail de ingreso, y se define **roles y permisos** (100% administrativo o usuario) y qué **espacios** ve cada persona dentro de la herramienta.\n- **Conectar Google Calendar por usuario:** cada miembro entra con su propio email (ej. juan@masterhouse.com), va a **Configuraciones → Mi perfil → configuraciones de calendarios → Agregar nuevo**, elige **Google Calendar** (para usar Google Calendar + **Google Meet**) y conecta su cuenta de Gmail con un clic. Al quedar listo aparece el **check verde**; después se **linkean los calendarios** y se configura la locación (Google Meet), la **zona horaria** y los días/rangos horarios de disponibilidad para tomar calls.\n- **Crear el calendario:** menú izquierdo → **Calendars → Configuración de calendarios → Crear un calendario**. Hay varios tipos: **personal, rotativo y colectivo**. En el personal se nombra (ej. \"Juan Ciglano Test\"), se **delega** al miembro que corresponde, se define la **URL**, la **duración** de las reuniones (media hora, 1 h), los días y rangos, y se confirma.\n- **Al editar** se profundiza: agregar **imagen** (el logo de MH), el copy de la **descripción**, agruparlo en una carpeta, y toda la **disponibilidad** — intervalo de horarios (se muestran cada media hora), duración, mínimo de días previos, cuántos días a futuro, **máximo de reuniones por día**, mínimo por usuario, y el **tiempo de colchón antes y después** de cada reunión.\n- Pasos extra: **formularios** para que las personas completen y **notificaciones** al agendarse una reunión (a los contactos, a la persona asignada, un email adicional) — se ve en detalle más adelante en **Automatizaciones**. También hay **customización** (vista clásica o no, colores, detalles).\n- **Compartir:** posicionarse en los **tres puntitos** → **Compartir** → ahí están los links y hasta el **código para embeber** el calendario en una landing.\n\n**Ejemplo del calendario grupal/rotativo:** funciona igual que el personal, con la única diferencia de que se agrega **más de una persona** (ej. Santiago, Paz) y se configura cómo se reparte su disponibilidad. En \"detalles de la reunión\" se les puede **asignar prioridades** a los miembros: poner a uno con prioridad máxima o a todos por igual.\n\n**Conclusión:** aunque existe la opción de **distribución equitativa**, Juan recomienda configurarlo siempre **por disponibilidad**, para darle prioridad a la agenda de la persona que va a tomar la llamada.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 164,
        "vn": 13,
        "grupo": "Mastery Machine",
        "modulo": 6,
        "titulo": "Mastery Machine -12",
        "cardDesc": "",
        "videoId": "1SkXCHzMB-jJbpqp4HDNkAYSDcCk9pnTB",
        "resumen": "Esta clase de **Mastery Machine** muestra cómo montar **automatizaciones (workflows)** desde la pestaña **Automatizaciones** del menú lateral: email marketing, CRM, calendarios, lo que necesites.\n\nDe qué va: la regla de oro es **diseñar primero el paso a paso en un doc de Word/Drive** antes de tocar la plataforma. Sofía recorre tres automatizaciones propias como guía.\n\nPuntos clave que remarca:\n- **Calificar leads desde el formulario.** Disparador: formulario de aplicación completado. Un paso **If/else** abre caminos según las respuestas. Quien trabajó con **1 a 3 clientes** cae en \"one\"; si contestó \"sí\" a **¿Cuentas con mínimo $9000?** y no es 1-3, es **Bill Top 1** (y así Top 2, Top 3). Se agrega **etiqueta** (Juan, Bill Top 1…) y se crea la **oportunidad en el CRM de ventas** (escenario \"aplicaciones\"). Los de producto o sin facturación se etiquetan pero **no entran al CRM**, para no ensuciar el trabajo del equipo.\n- **Mantené la calificación simple** para no dejar zonas grises ni perder contactos por variables cruzadas.\n- **Agenda de llamadas (5 pasos).** Disparador: estado de agenda \"confirmada\" en el calendario Mastery House 2024 → etiqueta \"agendó call\" → mueve la tarjeta en el CRM → **email** con los datos de la reunión (título, link, traídos del disparador) → **notificación interna** al vendedor asignado.\n- **Cambio de estado aplicación → agendar call.** Condición separa camino **Bill** (Top 1/2/3) y **One**, porque usan calendarios distintos. Envía **mail + WhatsApp** (mismo mensaje por si no llega el mail), etiqueta, **espera 1 día**, y revisa si ya está en \"call de venta agendada\". Si no, manda recordatorio, espera otro día, y si sigue sin agendar lo pasa al **CRM del setter** para que lo llamen por teléfono.\n\nDetalle práctico: el paso de **WhatsApp exige elegir un template** previamente creado.\n\nConclusión: hay una infinidad de disparadores y acciones; la clave es **paciencia y bajar el roadmap del cliente al papel** antes de volcarlo en la Machine.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 165,
        "vn": 1,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club (main)",
        "cardDesc": "",
        "videoId": "1WxeEk2Ea2NCuvpIoXy8QrwMJyqyipzhs",
        "resumen": "Sesión en vivo de apertura del **Mastery Club** (tercera edición, que arrancó con 15 personas y no para de crecer). Sofía Contreras abre el día con su charla central: **por qué la marca personal es tu mejor activo**, sobre todo en la era de la IA, donde el **factor humano** y tu esencia son la gran diferenciación.\n\nLa tesis: **marca = dinero = libertad**. Una marca sólida te habilita a cobrar **2, 5 o 10 veces más** que la competencia, que te recompren sin mirar a nadie más, tener preventas y listas de espera, y llegar siempre a tu objetivo de facturación. Cuenta su propio camino: dejó el mundo corporativo/inversiones, arrancó remando clientes (almuerzos, cafés, WhatsApp) y todo cambió cuando construyó marca. Resultados: **+1,3M de seguidores en 5 años**, **1300 libros vendidos en 5 min** (editó con Planeta a propósito, por el sello), varios millones facturados y 50 entradas al evento en 3 días.\n\nPuntos clave que remarca:\n- **Tres pilares de una marca sólida: influencia, dirección y alcance.**\n- **Influencia** = cambiar el comportamiento vía un **vínculo de asociación**: creá contenido que te ate al concepto que querés encarnar (ella, \"abundancia libre de estrés\"). Priorizá **educación sobre entretenimiento** (Alex Hormozi vs Mr. Beast): el lead educativo convierte muchísimo mejor. **Presentate siempre** con nombre y apellido y credenciales, incluso a público frío.\n- **Dirección** = medí con **métricas** (conversión, CTR, asistencia a webinar, show-up rate) y construí la **\"fosa alrededor del castillo\"**: Wikipedia, libro, YouTube, podcast, prensa. Es juego a **largo plazo**.\n- **Alcance** = **volumen por tiempo**. Compará tu inicio con el inicio del otro (Gary Vee de hace años, no hoy). **YouTube como plataforma principal**, LinkedIn/Instagram secundarias; menos edición, más volumen para sacar data.\n\nTodo se ordena en el **funnel de marketing perpetuo**: contenido corto que atrae (orgánico + pago) arriba, contenido largo que asocia (podcast/YouTube/newsletter) en el medio, y abajo oferta irresistible + servicio escalable + casos de éxito.\n\nCita a **Warren Buffett**: el mejor negocio es el que tiene **poder de fijación de precios**; si rezás antes de subir 10%, tenés un negocio terrible.\n\nConclusión: dejá de \"hacer un montón\" y hacé autocrítica; comprometete a largo plazo con tu marca, porque es lo único que sostiene la estrategia y te sobrevive.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 166,
        "vn": 2,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club -01",
        "cardDesc": "",
        "videoId": "1bgLteVQxG00QgXt1jZiyKY8H27vU8jBo",
        "resumen": "Sesión en vivo del **Mastery Club** con Juan Martitegui como invitado: una demo práctica de **inteligencia artificial para crear contenido**. Su tesis central: la IA es como **la imprenta**: si no multiplicás tu volumen (5x, 10x), quedás afuera. No se trata solo de más output, sino de **fabricar mucho y elegir lo mejor**.\n\nArranca con una anécdota: un cliente perdió a su **equipo de YouTube** (investigador de keywords, investigador de temas, creador de títulos/thumbnails, copywriter, guionista viral, B-roll, mails a la lista, community manager, project manager). Juan lo reconstruyó con IA usando **Flowwise** (open source, gratis): un supervisor conectado a ChatGPT que delega en agentes que usan YouTube y **Perplexity**. Costo: ~$0,30 por corrida.\n\nPuntos clave que remarca:\n- **Elegí bien tus batallas**: atacá primero tu cuello de botella. Usa su **método Valora** (Valor, Apuesta de aprendizaje, Low risk, Operatividad, Rapidez/costo, IA-fit) para priorizar; low risk + más de 4 puntos = **quick win**.\n- **Tres usos caseros**: 1) Ideas de contenido con el modo **Tareas de ChatGPT Plus** ($20/mes), noticias diarias con hook (las noticias nunca se acaban). 2) **Escribir un libro**: transcribió sus charlas con **Notta.ai**, detectó su estilo lingüístico (analogía del Unabomber) y escribió con **Claude**; su libro \"Empleados\" tiene 58.000 palabras. 3) **Productos done-for-you**: GPTs a medida (plan nutricional keto + hipnosis + afirmaciones, coach de Instagram por foto).\n- **Cultura de IA**: felicitar a quien la trae, evitar los ladrones \"ética y seguridad\", liderar con el ejemplo, hacerla obligatoria, \"you get what you expect and inspect\", pedir siempre **el descarte** (\"mostrame los 10 que no elegiste\").\n\nConclusión: el cliente quiere el **cuadro colgado, no el taladro**. La IA ya existe, es barata y divertida; dejarla pasar es el verdadero riesgo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 167,
        "vn": 3,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club -02",
        "cardDesc": "",
        "videoId": "12Zbsd9kJ1aZp4B8E9DG1sTkSUmIh2Hm9",
        "resumen": "**Sesión en vivo del Mastery Club** donde se trabajó **autoridad** y **marca personal**: en la era de la IA \"las personas conectamos con personas\", y los negocios que escalan tienen una marca personal atrás.\n\n**Puntos clave que remarca:**\n- **Las 4 etapas de marca:** (1) **diferenciada** —cuando vendés y te eligen por algo más que el precio—; (2) **posicionamiento** —te conocen en tu sector, te entrevistan, vas a paneles—; (3) **autoridad** —te subís a escenarios y cobrás por estar ahí—; (4) **estrella** —decís tu nombre y hacés *sold out* (ejemplo: Sophie)—. Primera tarea: identificá tu etapa.\n- **Dos caminos:** escalar una unidad de negocio con funnel y pauta (cortoplacista) o potenciar tu **marca personal**, que abraza todas tus unidades. Ella eligió el largo plazo.\n- **Ganancias inmediatas vs. reputación futura:** necesitás activos que den plata para bancar lo que no la da (eventos, imagen, equipo). Lo difícil es desembolsar por reputación.\n- **La marca no se delega:** es tuya, actitudinal. El título técnico no alcanza (hay doctorados con ansiedad social y sin roce).\n- **4 pilares de diferencial:** **visual** (entra por los ojos: su traje celeste, sus tatuajes, su pelo naranja), **tono** (ritmo, frases propias, dinamismo de voz), **información** (explicá con tus palabras) y **negocio sólido** (tu equipo te representa, como el mozo del restaurante).\n- **3 claves:** soltar el **guión** y buscar fluidez (nada de teleprompter); **actitud** de protagonista, energía y carisma (sonreír); e **imagen** prolija sin producción (una pared pintada, ventana con luz, un teléfono).\n\n**Ejemplo y ejercicios:** su clienta **Lore (RIMAX)** graba las charlas de los lunes a su equipo de 10 y saca contenido con IA (script + highlights). El ejercicio propuesto: apoyar el celu en la cocina con el termo del mate, cortar cebolla y contar a cámara un tema que sepas sin guión. Su primera charla fue en la **Universidad de Palermo**, por su mejor amiga. Consejo del *freestyle content*: hablar a cámara con ritmo (como rapear sin rimar) y grabar TODO con tu propio equipo (trípode, iCloud, micrófono), apalancando antes, durante y después de cada charla —aunque sean tres viejitos en un centro de jubilados, sentila como tu charla TED—.\n\n**Conclusión:** arriba del escenario venís a **bajar data**, no a contar tu vida. La gente no quiere perfección, quiere verte crecer, así que grabá desde hoy aunque no lo subas. **Ser y parecer:** tu marca personal es todo lo que decís, hacés y con quién te juntás.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 168,
        "vn": 4,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club -03",
        "cardDesc": "",
        "videoId": "1pa2LTysi0iPIOAAk7jcXT79OyDsE-Dc5",
        "resumen": "Sesión en vivo del **Mastery Club** con **Jimena Fukuda y Danny** (pareja emprendedora de Lima, comunidad \"los Fukudos\"). Ambos perdieron negocios tradicionales en la pandemia (ella eventos infantiles; él, rehabilitación de columna) y en menos de cuatro años pasaron de la quiebra a un negocio millonario apalancados en su herramienta estrella: **los lanzamientos**. Números que dan: lanzamientos orgánicos de $50-60 mil sin publicidad, y desde 2023 escalaron a **$300 mil invirtiendo solo $6 mil en ads**; 17 lanzamientos con **ROAS de 8 hasta 37**.\n\nUn lanzamiento son tres ideas: **expectativa/intriga**, **valor antes que oferta** y **deseo antes que disponibilidad**. Solo necesitás página de registro y gracias, grupos de WhatsApp, email marketing y pasarela de pago (usan **Hotmart**).\n\nPuntos clave que remarca:\n- **Cinco etapas**: distribución de contenido (siempre prendida, testeás en orgánico antes de meter ads), **calentamiento** (30 días antes, generás intriga sin revelar nada), **captación** (solo 15-18 días para que la audiencia no se enfríe), **CPLs/clases** (ella hace 5) y **ventas** (7 días).\n- **Lives** lunes/miércoles/viernes a la misma hora; adaptá el horario a tu avatar, no copies el de otros.\n- **Certificación** con palabra clave del día, tareas y examen (80%) para sostener la retención; hack de engagement: comentá el post y recibís un regalo automatizado (llegan a 2000 comentarios).\n- Oferta **una sola, clara e irresistible**, con escasez, bonos de acción rápida (primeros 10, 24h), cuotas y un **equipo de ventas** que recupera carritos abandonados al instante.\n- **Falso cierre y reapertura**: suma 30-40% de ingresos.\n- Extras: **canción con IA** (\"Fukudo de corazón\") para pertenencia, y apertura de grupos de WhatsApp con closers e IA respondiendo hasta las 3am para gatillar **FOMO y efecto manada**.\n\nConclusión: cada lanzamiento capta 50-60 mil leads y ~20 mil seguidores nuevos, así que **nunca es un fracaso**: aunque no llegues a la meta, calentás audiencia que te comprará después. Los tres factores que no fallan: valor con victoria rápida, conexión emocional y sentido de pertenencia a un movimiento.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 169,
        "vn": 5,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club -04",
        "cardDesc": "",
        "videoId": "1Rj2pYqiC08inJ9vil09eVue4eLDW9W9r",
        "resumen": "Sesión en vivo del **Mastery Club** dedicada casi entera al lanzamiento de **Astra** (el nuevo mastermind boutique de Sofía) y a la nueva estructura de **MasteryHaus**.\n\n**Astra: qué lo diferencia de otros masterminds:**\n- **Filtro alto** de ingreso y foco exclusivo en **marcas personales**.\n- Venís con tu **mano derecha** (socio/COO) sin pagar otro ticket.\n- **Nada de turismo**: 2 días full de foco, alta colaboración y confidencialidad.\n- **3 encuentros presenciales/año** de 2 días. Fechas: **noviembre 25 en Buenos Aires**, luego abril y agosto.\n\n**Dos niveles:**\n- **Orión** ($15.000, o $13.500 si sos/fuiste de MasteryHaus): 3 llamadas de 1h de estrategia, grupo de WhatsApp de networking y todo el contenido (Build, Grow, OS, Sesiones de Maestría).\n- **Cenit** ($19.000, o $17.500 miembros de Masterclass): todo lo de Orión + consultoría 1a1 presencial (día completo 10 a 16:30), sesiones de 2h, **teléfono rojo/WhatsApp para emergencias**, participación de Sofía en tu podcast y apoyo del **equipo de heads**. Solo **5 lugares**.\n\nSe reserva con **$500** + entrevista con Nicholas Bard; la seña se computa a la membresía y se devuelve si no pasás.\n\n**MasteryHaus reestructurado:** foco en aceleración de marcas personales, con 3 niveles de 6 meses:\n- **Build**: solidificar oferta, despedir clientes malos, facturar más.\n- **Grow**: destacar en mercado saturado con universo de productos.\n- **OS**: sistematizar y salir de la operación.\n\nIncluye consultor 1a1 quincenal, **AI Suite** (bots de fans, oferta, procesos, contratación), horas de oficina, sesiones semanales y el **Círculo de Maestría** con Carrie. Solo **60 clientes** en total; renovaciones con prioridad.\n\n**Conclusión:** el mensaje central es escalar la marca personal atada a un negocio sólido y rodearte de los **clientes correctos**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 170,
        "vn": 6,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club -05",
        "cardDesc": "",
        "videoId": "1K8BCHVUOQPeeDIvxuKy1I5AQZ0d4QiOY",
        "resumen": "**Sesión en vivo del Mastery Club** con un invitado especial: **Juan Martínez**, de **Scale Mastermind**, a quien Sofía presenta con su trayectoria (primer CEO de **MyValley/Mindvalley en español**, +7 millones de leads, decenas de millones de dólares, +40 sistemas de marketing en 15 industrias, desde lingotes de oro en Indonesia hasta tickets de colectivo en Malasia). Juan comparte su **framework matemático para duplicar la facturación** (y volver a duplicarla), y avisa: si aplicás las palancas, el negocio crece \"porque es matemático\".\n\n**Puntos clave que remarca:**\n\n- **Atendé las tendencias** (metáfora del que duerme bajo la sombrilla y le va a pegar la ola): el tráfico se encarece, hay saturación de e-learning y con **IA** diferenciarse será durísimo.\n- **Quedarse chiquito es causal de muerte:** el 90% de las empresas mueren antes del año; el negocio grande tiene más margen (jumbo vs. avioneta) y en digital hay dinámicas **winner-take-all**.\n- **Simplificá el modelo:** no cavar pozos de 10 cm por todos lados ni armar un \"Frankenstein\". Ejemplo: un curso de inglés factura **$15M/año** con solo landing + VSL + llamada, un producto de **$500**.\n- **Todos estamos en el mismo negocio:** impresión publicitaria + entregar el producto < plata del cliente. De ahí los **4 buckets: Atracción, Conversión, Monetización, Repetición**.\n\n**Ejemplo del interés compuesto:** subir cada bucket un **20%** da 1,2⁴ ≈ **2,07** (duplicás). Con 10.000 prospectos al 4% y ticket de $50, optimizando los cuatro la facturación se duplica y la rentabilidad se triplica. En Mindvalley cambiar el botón a **\"try now risk free\"** subió la conversión +50%. Consejo: educarte (3 libros, 10 podcasts) te pone en el **top 5%**.\n\nEsos cuatro pilares se apoyan en: **el emprendedor** (energía, creencias, ambición), **el equipo**, un **sistema operativo** (EOS/*Get a Grip*, *Scaling Up*) con reportes, y el **modelo de negocio**. Cierra con la anécdota de la software factory (entrevistas de 4 h → acceptance del 20% al 80%) y una **demo de IA con Flowise** que automatiza toda la producción de YouTube.\n\n**Conclusión:** con tecnología o con esfuerzo y lógica, elegí un solo sistema, metele foco en los cuatro buckets y repetí el ciclo del 20%. Lo aburrido es la cuenta; lo divertido es qué ideas usás para mover cada número.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 171,
        "vn": 7,
        "grupo": "Mastery Club (sesiones en vivo)",
        "modulo": 6,
        "titulo": "Mastery Club -06",
        "cardDesc": "",
        "videoId": "1ufB0fTGa3PwUcJru46vV2vsV-svAa9rQ",
        "resumen": "Sesión en vivo del **Mastery Club** donde **Gabi** entrevista a **Vicky (Victoria Monroy)**, economista de Bahía Blanca, 14 años y medio en **finanzas personales**, con un equipo de 9 asesores. Es un testimonio de proceso: lleva dos meses en el programa y cuenta cómo cambió su negocio.\n\nPuntos clave que remarca:\n- Su dolor era **no saber decir que no**: todo \"sí\", recaídas comerciales, dos episodios de **burnout**, mucho crecimiento comercial pero sin procesos ni escalabilidad.\n- Con Gabi armaron un **formulario de filtro**, construido con todo el equipo en una reunión (hubo resistencia de una asesora veterana que lo confundía con el PFP, y terminó amándolo).\n- Definió su **nicho dorado**: programadores, freelancers y emprendedores tecnológicos, sobre todo internacionales (cobran en dólares, menos restricciones que en Argentina).\n- Muestra el gráfico que usa en primeras entrevistas: **dinero vs. tiempo** con hitos (inicio laboral, edad actual, retiro, esperanza de vida). La gente ahorra para objetivos patrimoniales de corto plazo (la **carrera de la rata** de Kiyosaki). Su propuesta: invertir bien el corto plazo, armar la **estrategia de salida** y el **blindaje** (seguro de vida a conciencia; casi nadie lo tiene, a diferencia del seguro de auto que todos levantaron la mano).\n- Empezará a **cobrar el asesoramiento** (hoy vive de comisiones): paquetes **BM / PM Plus**. Señal clave: los clientes preguntan \"¿qué te debo?\".\n\nEjemplo de \"decir no\": puso **turnero** y **mínimos** para abrir cuenta de bolsa, aunque le cueste rentabilidad.\n\nConclusión: abraza el **vacío** que deja filtrar clientes porque da lugar a lo nuevo; no busca más dinero sino más tiempo. Cierra con \"abrochá el cinturón que despegamos\".",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 172,
        "vn": 1,
        "grupo": "Sesiones de Maestría (en vivo)",
        "modulo": 6,
        "titulo": "Sesión para Axel",
        "cardDesc": "",
        "videoId": "1CmED9QJYEuyzooaoIEDv-oh2zitDcXqk",
        "resumen": "Sesión en vivo de **Sesiones de Maestría**: una masterclass casi entera dedicada a **Axel** y su **aceleradora de agencias de IA**. Axel armó la **versión 2** del programa (sin acompañamiento 1 a 1 y sin garantía, para hacerla escalable) y quiere venderla a **10-15 personas** en formato **cohorte**, a **$3000** (la V1 salía $4000). Sofía revisa su lanzamiento del miércoles pieza por pieza.\n\nPuntos clave que remarca:\n- **No prometas facturación en el copy.** La promesa es aprender la metodología paso a paso, no \"ganá $5000/mes\". Su landing (\"Descubre cómo ganar más de $5000 al mes...\") reusa el VSL viejo y está mal parada en dinero; mejor \"**facturá tus primeros $3000**\".\n- **Todo esfuerzo previo a abrir carrito = captar mails.** Sin saber cuántos leads tibios/calientes tenés, no podés medir ni predecir. Ejemplo propio: el lanzamiento de **MasterYou** fue **35.000 leads × 3%**; el error fue lanzar **3 ofertas juntas** en vez de solo el paquete (habrían llegado al 5%).\n- Es un **lanzamiento semilla** (solo orgánico). En cohorte se crea la mística de avanzar en grupo, con fechas fijas y \"si te quedás atrás, te quedás atrás\".\n- **Validá a quién le hablás.** Tiene 1400-1500 en WhatsApp pero no sabe bien quiénes son; que el **setter** los audite en un Excel.\n- **Autoridad = táctico + estratégico**, explicando lo complejo de forma simple. El contenido se define por el cliente que querés tener.\n\nEl giro grande: llevar el contenido y la oferta a **B2B**, un programa educativo de IA para líderes de empresa (ejemplos: **Tiago Forte**, programa de IA de $10.000/1 mes; el **altMBA de Seth Godin**). Las empresas tienen presupuesto educativo; ella cobra **$7500** por una charla de 1h.\n\nConclusión: enfocá el foco en **una** cosa (validar la V2 escalable), no armar upsell y aceleradora a la vez. Cerró con María Eugenia: validar con 5 personas no es validación; hacen falta **100-200 conversaciones** antes de bajar un nicho.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 173,
        "vn": 2,
        "grupo": "Sesiones de Maestría (en vivo)",
        "modulo": 6,
        "titulo": "Sesiones de Maestría (main)",
        "cardDesc": "",
        "videoId": "1E2oePoh513SJOnN0yxHffr_TfuSGa_pk",
        "resumen": "Esta es una **sesión de maestría en vivo** (coaching grupal con preguntas) titulada, jugando con Covey, **\"Los siete focos de los líderes altamente efectivos\"**: los siete puntos donde la instructora cree fundamental que pongas tu energía. Arranca con la idea de **foco mercenario**: ser selectivo en dónde poner la energía y aprender a decir que sí y que no. Remite al último **Master Club**, donde explicó los niveles del negocio, para que ubiques en cuál estás.\n\nEl grueso de la sesión desarrolla el **punto número uno: \"buscarlo imperfecto\"** (no buscarlo perfecto). El mantra es priorizar la **validación acelerada** y salir a buscar **datos rápidos** según el momento del negocio, porque la **ejecución imperfecta es mucho mejor que la no ejecución**. Propone preguntas disparadoras para destrabarse: **\"¿Cómo se vería esto si fuera simple?\"** y **\"¿Qué decisiones estoy postergando por miedo a que no sea perfecto?\"**. Hace un ejercicio en vivo: que cada uno anote **tres acciones** importantes que no lanzó por miedo a la imperfección, e identifique ese miedo para poder avanzar.\n\nEjemplos y números que menciona:\n- Personal: tardó **tres años** en sacar su libro por quererlo perfecto.\n- **Airbnb**: primera versión \"horrible\", sacaron fotos ellos mismos, solo querían validar si la gente lo usaba; hoy valen **$100 billones**.\n- Un caso de **2012**: validaron recabando **1 millón de mails** con un formulario.\n- **\"Sofía\"**, diseñadora real: pasó **seis meses** puliendo el contenido y nunca salió a vender de verdad.\n- El miedo a pedir datos de facturación cuando la inversión mínima es de **$5000**.\n\nCierre: dejá un **esqueleto/estructura** detrás, no tengas todo público y salí a probar la **intención de compra**. Ella lo hacía sin ser nadie, sin 15.000 seguidores.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 174,
        "vn": 3,
        "grupo": "Sesiones de Maestría (en vivo)",
        "modulo": 6,
        "titulo": "Sesiones de Maestría -01",
        "cardDesc": "",
        "videoId": "15-Mk89SGugX7L1FjxsceagsYcoYxecvF",
        "resumen": "Sesión en vivo de arranque (la \"-01\") donde el instructor abre con dos temas de fondo antes de meterse en el contenido central.\n\n- **Novedad de IA:** anuncia que **Meta liberó su inteligencia artificial dentro de WhatsApp**. Avisa que la próxima sesión va a ser sobre IA porque \"ya no hay forma de ignorarlo\": bajan a cero las barreras de entrada (la gente ya no tiene que aprender una plataforma nueva, chatea nomás). Recomienda incorporar **agentes de IA** para tareas repetitivas y operativas, bajar carga y \"comerse a la competencia\".\n- **Autoridad:** como las barreras de entrada al mundo digital están \"por el subsuelo\" (cualquier pibe de 15 años con un celular arma un curso), lo único que te diferencia es **tu autoridad, tu confianza y la entrega de valor del servicio**.\n\nEl tema principal es el **panel de Marketing Perpetuo** y la idea de que \"la venta sucede antes de la venta\". Retoma los **momentos de venta** vistos en la sesión anterior (asegurar que el cliente llegue ya vendido para subir show rate y cierres) y desarrolla el modelo de los **momentos de la verdad**:\n\n- **Estímulo** (ver un anuncio).\n- **First Moment of Truth** (donde ocurre la compra).\n- **Second Moment of Truth** (experiencia con el producto).\n- **Zero Moment of Truth (ZMOT)**, sumado por Google: la **etapa preliminar vital** donde la persona te googlea, se educa, busca reseñas, pide referencias y **compara opciones** antes de comprar.\n\nMenciona que **Marketing Perpetuo** tiene unas **10 horas de contenido** y aconseja verlo de a poco, haciendo foco en lo que ya tenés corriendo para no abrumarte. Insiste en las **tres cosas más importantes del negocio**: cliente ideal, customer success y este trabajo previo de posicionamiento.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 175,
        "vn": 4,
        "grupo": "Sesiones de Maestría (en vivo)",
        "modulo": 6,
        "titulo": "Sesiones de Maestría -02",
        "cardDesc": "",
        "videoId": "1q-WJqUNAsKsQKblad7yybxs1zph2rdI9",
        "resumen": "Sesión de Maestría en vivo donde Sofía dedica el encuentro a **equipos y desarrollo de equipos**: cómo cualquier negocio, sin importar su tamaño, puede reclutar **talento del top 1%**.\n\nPuntos clave que remarca:\n- Distingue **talento A, B y C**. Dos empresas con el mismo objetivo: la de puros A lo alcanza en un año, la de B/C en cuatro. Su tesis: **\"el talento le gana a la estrategia todos los días\"** (la cultura genera el talento, y el talento se come a la estrategia).\n- La pregunta correcta no es **el cómo, es el quién** (recomienda el libro \"No es cómo, es quién\"). Un **A player atrae otros A players**; el B contrata C.\n- Equipo A = ágil, eficiente y pequeño; equipo B/C = lento, grande y con el costo operativo por las nubes, te deja preso de la operación (\"esposas de oro\").\n- Propone un **funnel de captación de talento** igual al de clientes: **avatar de talento ideal** + oferta irresistible. El match se arma con cinco piezas: **compensación** (paquete: salario, honorarios, bono, incentivos, vacaciones), **beneficios** (carrera, remoto, oficinas pet friendly, retiros), **cultura sólida** (cuidar la \"manzana podrida\", fit cultural con entrevistas con 3 personas), **equilibrio** y **reconocimiento**.\n- La **descripción de rol es el filtro** (ej. jefe de operaciones: \"crear un negocio de 5M anuales en 3 años\").\n- Retención: onboarding de **90-100 días**; sweet spot **15% inexperiencia / 70% desarrollados / 15% especialistas**. Los 4 pasos (de Líder 360 de John Maxwell): **yo hago y mirás → hacemos juntos → vos hacés y miro → check-in/feedback** (1:1 mensuales midiendo la salud del equipo).\n\nEjemplos propios: fueron 3 personas y lograron muchísimo; contrató a Ceci y Caro por **potencial** (aún en la facultad); en 2022 se fue 3 meses de vacaciones y el negocio **creció 300%**; cuando Caro y Ceci se fueron juntas perdió **6 años de conocimiento** por no tener a alguien \"haciendo la sombra\".\n\nConsejos en el Q&A: en pleno incendio, frenar para no tomar decisiones pobres al contratar; con un socio jugador B/C, definir expectativas y **ownership** de cada uno; si los clientes solo quieren hablar con vos, el problema no es el cliente sino que tenés que **posicionar y dar autoridad** a tu equipo.\n\nConclusión: contratar es fácil, lo difícil es sostener; con talento A + sistemas de onboarding y check-ins, el negocio deja de depender de vos.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 176,
        "vn": 5,
        "grupo": "Sesiones de Maestría (en vivo)",
        "modulo": 6,
        "titulo": "Sesiones de Maestría -03",
        "cardDesc": "",
        "videoId": "1fNQyn2kPzqXMK4IyEztRSPXQMaP7fuvB",
        "resumen": "Sesión en vivo de **Sesiones de Maestría** con Sofía (Sophie) y Juan, pensada como **puntapié al módulo de Marketing Perpetuo**. El eje: la **venta antes de la venta**, es decir, hacer bien la parte previa de marketing para que la venta se cierre casi sola.\n\nPuntos clave que remarca:\n- Un negocio tiene dos partes: **marketing (previo)** y **venta (posterior)**. Las startups fracasan por descuidar la previa.\n- Regla del **70%**: nadie decide comprar hasta recorrer ~70% de su camino, sumando muchos **puntos de contacto**. Sin eso: no-shows, leads no calificados, cierres bajos y gente que se va con la competencia.\n- Tres estados de negocio: **A** (casi todo venta fría, anuncio→landing, leads carísimos), **B** (fifty-fifty, algo de posicionamiento pero mail/**VSL** sin optimizar) y **C** (80-90% de esfuerzo previo, sistematizado). El objetivo es **C**.\n- El **VSL** (Video Sales Letter) es un **autofiltro**: define para quién es y para quién no.\n- **Funnel de marketing perpetuo** (funnel 10K): arriba = atracción (shorts, reels, TikTok, ads, **YouTube** por su algoritmo); medio = nutrición (YouTube, **podcast**, **newsletter**, historias) por ser espacios íntimos y orgánicos, en los que confiamos más. Ahí va el **70% del esfuerzo**.\n- \"**Views ain't shit**\": importa el mensaje correcto, a la persona correcta, en el momento correcto.\n- **Autoridad y apalancamiento**: entrevistas, conferencias y libro posicionan; guardar todo en un **vault** para reusar. Un video llega a miles; una llamada tiene techo de 1-1,5h.\n\nEjemplos: Flor descubre que su **podcast** es lo que más vende (\"escuchaba todas las mañanas\"); Benja tuvo 12 llamadas y cerró 1 por falta de previa; Julie con ~300k seguidores igual genera desconfianza. Escalera de precios: 12.000/5.000/3.000/1.000/500/47.\n\nConclusión: hacé **foco paso a paso** (nicho→oferta), apoyate en la comunidad y tus consultores, y pedí ayuda. El módulo se publica desde mañana con **sesiones semanales los lunes 12h**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 177,
        "vn": 1,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-01",
        "cardDesc": "",
        "videoId": "1DZSVj-vfqXQtkbNcdfquNhQRgerL86GQ",
        "resumen": "Clase de apertura del módulo **Entrega del Servicio**, la parte que —dice Sofía— **\"hace o rompe\"** un negocio de servicios porque es su core. Si el servicio no entrega la transformación que prometió la **oferta irresistible**, los clientes se vuelven **detractores** que salen a hablar mal; el objetivo inverso es que sean tus **advocates/cheerleaders** y te traigan referidos. Ubica dónde estamos en el recorrido: **Etapa 1** (validar nicho, oferta y precio) y **Etapa 2** (implementar el funnel, ya con leads y script de venta) están hechas; ahora entramos a la **Etapa 3: validar el servicio y la transformación**.\n\nPuntos clave que remarca:\n- **La entrega es tu mejor inversión de marketing**: genera recomendaciones, casos de éxito y confianza para salir con la v2 de venta. Ojo: **satisfacción del cliente ≠ caso de éxito** (podés tener un cliente satisfecho que no sea caso de éxito).\n- Un **servicio pulido y sistematizado = clientes para toda la vida = negocio sólido y escalable**. Si sabés que los pasos A-B-C-D dan resultados, podés formar **closers, setters, triagers** y un equipo para que la venta y la entrega no dependan de vos, y hacer evolucionar al cliente al siguiente escalón de la **escalera de valor**.\n- Recién con la maquinaria pulida podés **\"abrir la canilla/grifo\" de clientes**. Ejemplo: un negocio pone todo el foco en posicionamiento y captación *porque* su entrega ya está muy pulida; abrir la canilla sin servicio pulido es \"comprarse un problema gigantesco\".\n- Estás en la **versión 1** de tu oferta: todo va a ser mejorable, por eso la validación previa se hizo con poca gente y volumen controlable.\n- **Loop iterativo incremental** (del mundo tech): v1 → analizar, planificar, diseñar → v2 → v3, creciendo escalonado y manejable (de 20 a 40, de 60 a 80), nunca de 5 a 100.\n\nPrincipios de la etapa: **entregar lo que prometiste** (desvíos solo milimétricos y con expectativas ajustadas), **sobre-comunicar** (mejor pecar de dar seguimiento que estar ausente), **hacerle la vida más fácil al cliente** (templates, playbooks, consultores 1:1, ganancias rápidas), acercarte y recabar todo el feedback posible, e identificar con un **análisis 80/20** qué importa y qué no. En la v2 aplicás el **\"trim the fat\"** (sacar la grasa): quitar lo que no hace falta para que igual logren resultados y agregar lo que simplifique el camino.\n\n**Sobre-entregar y generar casos de éxito** es el punto cúspide: momentos \"guau\" y adelantarte a los desafíos del cliente. Advertencia de fondo: sin un **fulfillment** que funcione, el negocio se quiebra y no escala; se construyen \"casas de naipes\" en vez de **fundaciones sólidas**.\n\nConclusión: retoma la **fórmula \"Coca-Cola\" (nicho, oferta, precio)** más la máquina que capta y sirve leads; optimizando recursos, tiempos y experiencia se sube el ticket y se reduce el costo de entrega para llegar a **márgenes de +60%**. Anticipa la próxima unidad —**marketing perpetuo** y **\"comprar real estate mental\"** (invertir tiempo en la mente del nicho para posicionamiento perpetuo)— y cierra prometiendo bajar el **funnel de entrega del servicio** paso a paso.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 178,
        "vn": 2,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-02",
        "cardDesc": "",
        "videoId": "16VTOpgN5U9OIMyl5EX9eMmYrhuIgQJUJ",
        "resumen": "Esta clase abre el **funnel de servicio**: lo que arranca una vez que el lead se transforma en cliente, dentro del funnel mayor de **100k de ingresos recurrentes mensuales**. Sofía muestra que, para cualquier tipo de servicio (incluso productos o un SaaS como ClickUp o Circle), el funnel siempre tiene los mismos tres componentes: **onboarding**, **entrega de la oferta irresistible / generación de resultados** y **oferta back-end de evolución**.\n\n**Puntos clave que remarca:**\n- **Onboarding.** Su misión es **reforzar la decisión de compra** y combatir el *client buyers remorse* (el remordimiento de compra que aparece a los días de comprar algo de alto valor). Se logra acelerando el onboarding, **aportando valor de entrada** y generando concordancia entre lo prometido y lo que el cliente ve.\n- **Setear expectativas.** Dejar clarísimo qué puede esperar de vos y qué debe hacer él para lograr los resultados. Si no se sientan bien acá, \"te comprás un problema\": el cliente arrastra expectativas desfasadas.\n- **Visión clara del norte.** Reducir la ansiedad mostrando qué pasa cada semana, vía roadmap o agenda.\n- **Acercarse al cliente.** El onboarding es el primer paso para el vínculo, con el objetivo de generar **clientes para toda la vida**.\n- **Reducir la fricción** siempre: una experiencia *seamless* donde todo fluye y la persona casi ni nota que está siendo onboardeada.\n- **Entrega y generación de resultados.** El objetivo es **sobre-entregar** y generar *quick wins* (ganancias rápidas). Entregar resultados es lo primordial.\n- **Oferta back-end.** Cuando el cliente ya tiene su caso de éxito y completó la oferta irresistible, se le ofrece el ascenso.\n\n**Ejemplo:** en la propia **Mastery Haus**, el alumno que ya logró su facturación, nicho, oferta de software y máquinas de servicio funcionando, evoluciona a **Mastery Pro**, la siguiente etapa con desafíos de equipo, implementación y volumen a medida que escala.\n\n**Conclusión:** el back-end sirve para **incrementar la estabilidad** y seguir acompañando el crecimiento del cliente. La clase deja planteado el mapa; las próximas explican cómo hacer funcionar cada parte para lograr un \"servicio supremo\".",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 179,
        "vn": 3,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-03",
        "cardDesc": "",
        "videoId": "1FupB-PGym4sBL1Trd6YXnb-0loH0RcSD",
        "resumen": "Esta clase de **Entrega del Servicio** enseña cómo hacer la **proyección y planificación de la entrega** de tu servicio, apoyándote en el **compaginador de oferta irresistible** que ya armaste en el módulo de oferta (ahí ya está mapeado nicho, tipo de cliente, ratio de entrega 1:1 / 1:pocos / 1:muchos, camino de éxito, entregables, bonos, garantía, precio). Con esos datos ya bajados, planificar la entrega es mucho más simple.\n\n**Puntos clave que remarca:**\n- Separá tu oferta en **frontend** (lo que ve el cliente: consultorías 1:1, mentorías grupales, sesiones mensuales, fórmula, comunidad) y **backend** (lo que no ve: ventas, equipo, recursos, plataformas).\n- El primer objetivo es **bajar una versión 1** a un documento de Word, **idealmente en Drive** (si no, se pierde), con el paso a paso de cada componente. \"Bajala como puedas\": lo importante es tener estructura, no perfección.\n- Esa versión 1 va evolucionando hasta convertirse en un **SOP (Standard Operating Procedure)**, que es simplemente \"una forma elegante de decirle a **procesos**\". Ahí definís recursos necesarios, personas involucradas, cuándo y cómo sucede cada cosa, y lo vas puliendo.\n- **Proceso, flujo de trabajo y SOP** son prácticamente lo mismo: no te compliques con la diferencia.\n- Desarrollá los SOPs **de a poco y escalonado**: demandan mucho análisis (feedback de clientes, tu vínculo con ellos, conversaciones del equipo). Si querés hacerlos todos de golpe, te quemás.\n- Marcá con un **check verde** el documento que ya está 100% chequeado; sin verde = tiene mejoras pendientes.\n\n**Por qué importa:** evita construir una **casa de naipes** que se cae con una brisa; querés fundaciones sólidas. Los SOPs te dan **resultados consistentes y medibles**, reducen el **error humano**, mejoran la velocidad (una persona nueva aprende con \"mirá este video / este documento\", sin que la capacites vos) y hacen el resultado **predecible**: la misma \"maquinaria\" da los mismos resultados la ejecute quien la ejecute, para que el negocio **no dependa de vos** y sea escalable. Analogía: hasta pilotos con más de 10.000 horas siguen **checklists** para no cometer errores.\n\n**Ejemplo:** Mastery se lanzó con un documento y una organización **desalineados** (la versión 1 fue \"un volcado de ideas\") y aun así **facturó más de $100.000 en cinco días**. Una versión imperfecta puede generar muchísimo dinero.\n\n**Conclusión:** en onboarding y en toda la entrega, primero **bajá una versión 1 como salga** y después **optimizá de forma iterativa** hasta llegar a SOPs pulidos y organizados en carpetas (procesos de vendedores, consultores, mentores, servicio, ventas).",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 180,
        "vn": 4,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-04",
        "cardDesc": "",
        "videoId": "1fT_ildn6nuiXaQodXoU9momRUBpznEWi",
        "resumen": "Esta clase arranca la etapa de **Entrega del Servicio** por la primera parte del **funnel del servicio**: el **onboarding** (que Sofía extiende hasta la **semana uno**). El punto central es que **el onboarding y la semana uno definen la expectativa y la experiencia del cliente**, así que tienen que salir perfectos y sin fricción.\n\n**Los tres focos del onboarding:**\n- **Generar una experiencia sin fricción**, que fluya.\n- **Definir expectativas claras**: que el cliente sepa qué pasos y acciones le tocan a él y cuáles hacemos nosotros para que alcance sus resultados.\n- **Reforzar la decisión de compra** (llevar a cero el remordimiento de compra).\n- Como **extra**, dibujarle un **mapa hacia el futuro**: qué puede esperar de acá en adelante.\n\nPara armarlo, Sofía te deja un **\"desarrollador de onboarding\"** con preguntas guía (borrás los ejemplos y ponés lo tuyo) y, como documento de lectura para inspirarte, el **workflow real de onboarding de Mastery Haus / MasTribu**.\n\n**Puntos clave que remarca:**\n- **Objetivos y pasos:** definí qué esperás lograr con el onboarding (comunicación clara, plan de comunicación, introducción a la plataforma, otorgar accesos, presentación del equipo) volcando lo que ya mapeaste en pasos anteriores; esta es una versión optimizada de tu v1.\n- **Puntos críticos y quién interviene en cada uno:** sirve para proyectar el onboarding, tanto si tenés una plataforma con contenido como si hacés acompañamiento uno a uno (es el mismo concepto). Ejemplo propio de Sofía: en su **consultoría tradicional de 6 meses**, el **primer mes era Discovery** (meterse en el negocio y el mercado del cliente, hablar con todos los involucrados, primera sesión de Discovery, analizar los datos) y recién ahí pasaba a la **etapa de implementación**, volcando todo lo recabado. Mapeá recursos de soporte, tiempos y responsables por etapa.\n- **Herramientas y recursos:** ejemplos que usan ellos: **DocuSign** (contratos), **Calendly** (agendas/llamadas), **Tracker de onboarding** (seguimiento), **paquetes de bienvenida**, y plataformas de comunidad tipo **Circle** o Google.\n- **Expectativas de comunicación (fundamental):** comunicá precios, entregables, roles, responsabilidades y métricas. Regla que subraya: **\"lo que no está prohibido/delimitado, está permitido\"**. Si no ponés marco, el cliente te escribe por WhatsApp un sábado a las 22:00 esperando respuesta. Si lo educás desde el inicio (mejor aún por contrato), acepta las reglas y se adapta.\n\n**Reforzar la decisión de compra — ejemplos:** guía de \"5 K rápidos\" para implementar ya (ej. cómo generar $5000 apenas entra al programa), **paquete de bienvenida sorpresa** enviado a su casa con merchandising/libros, u **onboarding acelerado** inmediato post-compra. Idea de fondo: cuando cerrás un cliente, tomás ese dinero y **sobre-entregás**, no sumando cosas de más sino invirtiendo en lo que reduce el remordimiento y aporta valor (plataformas que aceleran la comunicación y la experiencia, equipo, recursos que dan resultados más rápidos y te simplifican la gestión).\n\n**Personalizar la experiencia:** que el cliente sienta que **realmente lo ves** y que es único, que no se sienta un número. Eso baja el remordimiento y construye **clientes para toda la vida**. Ejemplos: **tarjeta con mensaje personalizado** junto al paquete de bienvenida, o un **avatar personalizado por cliente** (al estilo Apple), que algunas empresas ya usan al llegar a cierto nivel.\n\n**Conclusión:** respondiendo estas preguntas armás los puntos fundamentales de tu proceso de onboarding; después inspirate en el **workflow de MasTribu** para pulirlo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 181,
        "vn": 5,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-05",
        "cardDesc": "",
        "videoId": "1w4Nd16vKCZDHroWtUQOtcYc2KxVShJOC",
        "resumen": "Quinta clase de **Entrega del Servicio**: cómo implementar tu oferta irresistible sin morir en el intento. La idea madre es **construir junto al cliente por etapas** — nada de tenerlo todo listo antes de vender. Sofía lo cuenta con su propia historia: cerró uno de sus primeros proyectos de consultoría por **cinco cifras en dólares** con el índice de entregables solo proyectado, nada implementado; fue armando el **Discovery** y cada etapa cliente por cliente, hasta convertirlo en un proceso **plug and play (dos clics)** que después evolucionó a sus programas digitales. Aplica igual si tenés muchos clientes a la vez, evergreen o uno a uno.\n\n**Puntos clave que remarca:**\n- **Proyectá los tiempos por adelantado**: la \"hoja desprolija\", dividiendo las entregas idealmente **por semana** (o por mes según tu desarrollo). Así cada semana tiene un \"esto tiene que suceder\" y podés medir si vos y el cliente avanzan.\n- **Medí el avance de cada cliente**: en Mastery ven quién consume qué contenido, quién hace el **check-in**, quién agenda su sesión de consultoría y quién no hace ningún paso. Ese mapa te deja accionar: hablar con los que quedan atrás y celebrar a los que avanzan. Si alguien no avanza, atajalo antes.\n- **Recabá feedback en cada instancia** (dejan un **SOP de recabación de feedback** de ejemplo) y **volcá lo aprendido a la semana siguiente**.\n- **Mantené lo simple** y **flexibilizá el alcance, no tu tiempo**: achicá el scope, contemplá que vas a tener poco tiempo entre entregas y otras cosas en tu vida. No necesitás estudio de grabación ni guía kilométrica; hay programas millonarios que son un simple documento de Word y funcionan. La pregunta guía: **\"¿cómo se vería esto si fuera simple?\"**\n- **No compares tu versión uno con la versión nueve** de nadie. El objetivo es sacar algo **desprolijo e incompleto** y contrastarlo con la realidad — *la realidad es lo único que existe*: lo que opinan tus clientes, no lo que imagina tu cabeza.\n\n**Ejemplo del loop:** en \"Negocios Exitosos\", su primer programa digital, la semana 1 salía el contenido de la unidad, la siguiente hacían los ejercicios, después una sesión de consultas en vivo, y dos semanas más tarde salía la unidad 2. Ese ritmo le daba tiempo para recabar feedback y optimizar sobre la marcha, repitiendo hasta acumular clientes que validaran la versión 1 y saltar a la versión 2.\n\n**Conclusión:** usá el **compaginador de oferta** y el **master planner** (semana por semana, con colores) para mapear cada paso desde que el cliente ingresa hasta que sale exitoso, y salí de acá con tu **documento de entrega de servicio** en versión desprolija. Agilidad y a la acción.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 182,
        "vn": 6,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-06",
        "cardDesc": "",
        "videoId": "12sI1BZpk61JtV-knZQCgV-2-zOo72jBx",
        "resumen": "Esta clase de **Entrega del Servicio** es una lista de **reglas generales que aceleran los resultados de tus clientes**, pensadas para incorporar en distintos puntos de tu **funnel de servicio**. Sofía las plantea como ajustes de experiencia que mejoran lo que el cliente logra y cómo lo vive.\n\n**Puntos clave que remarca:**\n\n- **Filtrá bien a tus clientes (desde la venta).** El esfuerzo de filtrar se hace en ventas, porque una vez que alguien compró es dificilísimo decirle que no es tu cliente. Solo tienen que entrar los de tu **nicho dorado / abordaje ideal**: si dejás entrar a cualquiera, \"te comprás un problema\": no avanzan con la oferta, se vuelven **detractores** y salen al mundo diciendo que tu oferta no funciona.\n- **Menos es más.** No agregues cosas solo por agregarlas; sumá únicamente lo que aporta valor real. En la **versión 1** vas a descubrir que algo que creías valioso el cliente no lo valora: sacalo, incluso dentro de la misma versión, en vez de arrastrarlo hasta la versión 2.\n- **Lo fundamental se trabaja primero.** Sentar las bases al inicio de la relación es lo que habilita los resultados. Ejemplo: arrancar por **mentalidad y expectativas** de lo que viene; en consultoría, empezar por conocer al cliente, el mercado y recabar información (y que el cliente también te conozca a vos).\n- **Generá ganancias rápidas / quick wins.** Usa la **analogía del libro**: un capítulo de 100 hojas sin títulos intermedios se siente eterno; con títulos intermedios y valor en cada uno, sentís que avanzás y hacés \"checks\". Igual que planificar el día en accionables que se empiezan y cierran en el día. Con el cliente: paso 1 completá esto, paso 2 presentate, paso 3 conocé a tu consultor —taca, taca, taca— y quick wins concretos, como **generar $5.000 al ingresar al programa**.\n- **No sobrecargues de información.** La gente se abruma. Ojo con la distinción: **sobrecomunicar ≠ sobreinformar**. Sobrecomunicar es hacer seguimiento (cómo va, si tiene dudas, por qué no aparece hace dos semanas); sobreinformar es tirarle todo el contenido sin decirle cómo avanzar. Solución: pautar semana a semana con check con el consultor, o usar **contenido tipo drip** que se va habilitando por tiempo, para que no se paralice ante \"una biblioteca entera\".\n- **Sobre-chequeá al cliente ausente.** Siempre es preferible chequear de más el recibimiento del cliente que está desaparecido: **sobre-chequear es mejor**.\n\n**Conclusión:** son puntos que profundizan la experiencia y aceleran resultados. Incorporalos en tu funnel de servicio y observá el impacto.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 183,
        "vn": 7,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-07",
        "cardDesc": "",
        "videoId": "1aF1Bh4fLnC5d3G3hZmx23PoBr-HSu7Dz",
        "resumen": "Clase de **Entrega del Servicio** dedicada a un solo tema: cómo **recopilar feedback** de los clientes para mejorar tu **oferta irresistible**. La premisa es que en la versión 1 de tu oferta el feedback es \"sí o sí\": necesitás recabar toda la información posible porque es lo que te permite iterar y que el cliente obtenga resultados.\n\n**Puntos clave que remarca:**\n- **Observá todo.** Estar con oídos y ojos en cada instancia de interacción del cliente con tu oferta (sesiones 1 a 1 con consultores, mentorías grupales, sesiones de maestría, la plataforma). Tu trabajo es observar, tomar notas y **documentar**. La belleza del online es que se puede documentar todo: grabar llamadas, capturas de pantalla, documentos.\n- **Creá una carpeta \"feedback\"** donde volcás absolutamente todo: formularios, capturas y un documento con los puntos de mejora de cada instancia.\n- **Identificá confusiones y problemas comunes.** Van a aparecer puntos de fricción y patrones repetidos entre clientes. Un **problema** ocurre cuando alguien entiende algo, lo aplica y no logra el resultado. Ejemplo real de **Mastery Build**: al inicio, los desafíos de **mentalidad** hacían que unos avanzaran rápido y otros se trabaran; detectarlo permitió incorporar instancias con \"doble clic\" en mentalidad.\n- **Mapeá todas las instancias donde recolectás feedback** usando un **SOP** (que siempre arranca con objetivo y a quién está dirigido).\n\n**Ejemplo — el SOP de feedback de MasteryBuild:** recopilan feedback en cuatro frentes: (1) la **Fórmula Master** (el contenido): mensajes que invitan a comentar y una **encuesta al final de cada módulo**; (2) las **sesiones** semanales y mensuales de maestría; (3) el **journey del usuario** en cada etapa (onboarding, evento de bienvenida, reunión del plan de acción, cada sesión 1 a 1, sesiones grupales semanales y el final del programa); y (4) el **análisis**. Herramientas: formularios en **Typeform** que se cargan automáticamente en una **planilla de Google** (integración Typeform–Drive) y encuestas dentro de **Circle** en cada sección de mentoría. El análisis combina un **reporte global** (diario y semanal, no mensual) con el **NPS (Net Promoter Score) por cliente**, para ver su evolución y detectar red flags, clientes que desaparecen o casos que van muy bien y ameritan una acción de recuperación.\n\n**Conclusión:** mapeá tus instancias de feedback y **optimizalas sobre la marcha**. Vas a descubrir que muchos clientes no completan los formularios; la solución que ellos incorporaron es que **el consultor abre el mismo formulario en una llamada y lo completa preguntándole al cliente**. La lógica de fondo: esta información es tan valiosa que hay que buscar todas las formas posibles de recolectarla sin exigirle esfuerzo al cliente.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 184,
        "vn": 8,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-08",
        "cardDesc": "",
        "videoId": "1ub3-OOsxkpKJtQleI0l8SHzxVTJ9VQx4",
        "resumen": "Esta clase del módulo **Entrega del Servicio** presenta la **ecuación de servicio y transformación**, un desarrollo propio de **Sofía Valderrama** (paralelo a la **ecuación de valor** de Alex Hormozi vista en el módulo de oferta). La fórmula tiene cuatro componentes: arriba, lo que se **incrementa** —**Satisfacción del cliente × Casos de éxito**—; abajo, lo que se **disminuye** —**Costo operativo × Tiempo de entrega**—. El resultado es un **negocio sólido y escalable**.\n\nPuntos clave que remarca:\n\n- **Satisfacción ≠ Casos de éxito** (se confunden seguido). Podés tener un cliente satisfecho, que te puntúa altísimo y ama el proceso, pero que no alcanza resultados: no es caso de éxito. Y al revés: alguien que sí logró la transformación pero quedó insatisfecho.\n- **Satisfacción del cliente**: se da cuando **la realidad alcanzada supera las expectativas**. Por eso hay que **setear bien las expectativas** en la llamada de venta y, si se desfasan durante el programa, recuperarlas con **conversaciones difíciles**. Objetivo: maximizar el **% de clientes satisfechos**, porque a mayor número, más **recomendaciones y upsell** (un cliente satisfecho recomienda aunque no sea caso de éxito). Cómo: **entregar lo que prometiste + recabar feedback** en un loop constante.\n- **Casos de éxito**: total de clientes que **alcanzan los resultados**; son la **prueba del valor real** del servicio. Objetivo: lograr el mayor **ratio de clientes → clientes exitosos** y subir la **probabilidad percibida** de que el cliente llegue a su resultado. Cómo: **reinvertir en el servicio** (recursos y equipo que aceleren resultados y te liberen tiempo) y **recabar casos de éxito**.\n- **Costo operativo**: todos los gastos de prestar el servicio. Objetivo: **minimizarlos sin comprometer la calidad**. Solo se recorta lo que no aporta valor —\"**trim the fat**\", sacar la grasa—, apoyándose en el **análisis posterior** del feedback y de cómo evoluciona el cliente en su funnel (onboarding → entrega → resultados → caso de éxito).\n- **Tiempo de entrega**: aplica tanto al servicio como a los **resultados**. Reducirlo no es acortar de seis a tres meses por decreto, sino que en ese lapso el cliente **efectivamente logre** la transformación. Objetivo: cumplir la **promesa de tiempo y de resultados** (que sea \"on point\") o acelerarlos. Cómo: un **roadmap detallado** (\"si hacés esto, lográs esto\"), que además permite **detectar desvíos** y dar seguimiento, y dejar lugar para **momentos wow** inesperados que suben la satisfacción.\n\nConclusión: pulir estos cuatro componentes —subir satisfacción y casos de éxito, bajar costo operativo y tiempo de entrega— es lo que convierte la entrega del servicio en un **negocio sólido y escalable**.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 185,
        "vn": 9,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-09",
        "cardDesc": "",
        "videoId": "1FqRp2AoQuK8Nm8yt4rjEMKEMOidmCCoh",
        "resumen": "Clase de la unidad de **Entrega del Servicio**, dada por **Jessica Barlusconi**, Customer Success Manager de Mastery Haus. Es un tutorial práctico de **DocuSign**, la plataforma de **firma electrónica** que usan para firmar contratos con los clientes (la misma con la que vos firmaste tu contrato). DocuSign es un software SaaS basado en la nube: junta firmas por **correo electrónico**, enviando a cada firmante un enlace seguro personal sobre el que debe firmar.\n\n**Puntos clave que remarca:**\n- **Seguridad y confidencialidad:** los documentos van **cifrados**; ni el proveedor de DocuSign ni nadie con acceso a la plataforma puede leer el contenido. Usa infraestructura de **clave pública (PKI)** con certificados estándar, y protocolos **HTTPS/SSL** en todo acceso y transferencia de datos.\n- **No repudio y trazabilidad:** cada transacción genera un **certificado de finalización** (registro de auditoría) que enumera quién firmó, cuándo y cómo. Una vez que las dos partes firman, el documento **ya no se puede modificar ni editar**; cualquier cambio quedaría registrado.\n- **Recomendación legal:** dejan **plantillas de contrato** propias, pero insisten en que un **abogado especializado** revise todo. No hagas modificaciones por tu cuenta sin chequearlas con tu equipo de leyes.\n\n**Cómo cargar un contrato (paso a paso del demo):** la plataforma tiene cinco pestañas (**Inicio, Gestionar, Plantillas, Informes, Configuración**). Creás la cuenta con mail y contraseña, confirmás por mail y cargás tu **firma digital**. Luego: 1) crear un **sobre** desde Inicio y subir el archivo (desde Drive, Dropbox o el escritorio) o usar una plantilla; 2) **añadir destinatarios** (vos y el cliente); 3) arrastrar los campos al final del documento —**firma y fecha** son los que siempre ponen, y hay más opciones: inicial, nombre, correo, empresa, cargo, texto, casilla de verificación—, asignando cada campo a su firmante por color; 4) **Enviar**. La fecha se completa automática el día de la firma. El sobre pasa a **Gestionar/bandeja de entrada** y muestra que falta una persona por firmar; cuando ambas partes firman, queda **completado** y podés descargar el documento firmado junto con su certificado de seguridad.\n\n**Conclusión:** firmar contratos con DocuSign es simple, rápido y seguro, y deja constancia legal inmodificable de cada acuerdo con el cliente.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 186,
        "vn": 10,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-10",
        "cardDesc": "",
        "videoId": "1moUltX5jAk3EYT0LasZVG7yP531FHf7r",
        "resumen": "Esta clase arma, paso a paso, el **procedimiento general de onboarding** de un cliente nuevo: desde la postventa hasta que ingresa a la comunidad/plataforma. Es un manual operativo pensado para los dos roles que lo ejecutan: **líderes de servicio / Customer Success** y **consultores**. El mapa son 7 pasos: **1) traspaso de venta a servicio, 2) firma de contrato, 3) bienvenida y formulario, 4) asignación de consultor, 5) plan de acción, 6) sesión estratégica, 7) bienvenida a la comunidad en plataforma.**\n\n**Puntos clave que remarca:**\n- **Paso 1 – Venta a servicio (a cargo del closer):** en la misma llamada de cierre se piden los datos para el contrato (**número de documento, nombre completo y dirección**), se avisa al cliente que lo contactarán, se completa el **CRM** (datos, forma de pago), se comunica al área de servicio y se sube la llamada de cierre a la carpeta de ventas.\n- **Paso 2 – Contrato (Customer Success):** revisa condiciones de pago en el CRM, crea la carpeta del cliente, manda **bienvenida inmediata por WhatsApp**, envía el contrato por **DocuSign** y pone un **recordatorio de firma a 48 horas**. Regla dura: no se arranca nada sin **primer pago hecho + firma de términos y condiciones** (marco legal, por garantía). Para cuotas propone una **planilla de seguimiento de pago** con columnas: nombre, mail, teléfono, fecha de venta, ticket, rescates (autocompleta), acuerdo de pago (desplegable), tipo de pago (ej. **adelanto de 2K, dos pagos de 3000 y último de 2000**), links de pago, acciones (cancelar/retomar/contactar/cobrado), **tres vencimientos** y aclaraciones.\n- **Paso 3 – Bienvenida y formulario (Customer Success):** mail de bienvenida + **formulario Typeform** desde el correo de servicio (ej. hola@masteryhaus). Muestra los **templates de mail** (con versión para una persona y para socios: un solo formulario del negocio). Se registra la recepción en el **onboarding tracker** (planilla con casillas de check por cada paso, o automatizado en **ClickUp/Zapier**), con **recordatorio a 48 h** a quien no completó. Nomenclatura de archivos: *programa + nombre* (ej. \"Masteri Bill Juan Pérez\").\n- **Paso 4 – Asignación de consultor (Customer Success):** analiza el formulario y elige el consultor más adecuado al tipo de negocio/cliente; le informa y comparte la carpeta de identidad.\n- **Paso 5 – Agendar sesión estratégica (consultor):** se presenta y manda **Calendly** por mail (con template \"te invitamos a agendar tu sesión estratégica\"), más recordatorio si no agenda en dos días y otro de \"mañana es tu sesión\". Crea un doc con anotaciones del cliente en su carpeta.\n- **Paso 6 – Sesión estratégica (consultor):** previo, arma el **plan de acción** particular con plantilla y crea el **canal privado del cliente en Circle**. Dinámica: **grabar todo**, presentar agenda y plan de acción, mostrar la plataforma y tutoriales, chequear accesos, **agendar las próximas 1-1**, pedir feedback y bajar la app. Después: bienvenida por el canal, guardar la grabación y tildar el tracker.\n- **Paso final – Seguimiento (consultor):** verifica que el cliente **entre y use la plataforma** y dé sus primeros pasos; recordatorio si no ingresa; que haga su presentación en el canal; se tilda en el tracker/CRM. **Customer Success** cierra el loop asegurando la **encuesta de feedback** y que los consultores cumplan todos los pasos.\n\n**Conclusión:** un onboarding no se improvisa; es un checklist con dueños claros por paso, recordatorios a 48 h, todo trackeado en planilla o CRM y con **todo grabado** para iterar y mejorar.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 187,
        "vn": 11,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-11",
        "cardDesc": "",
        "videoId": "11ipdpiyn-16-oOYEi5Mz8ExftQCfL8CF",
        "resumen": "Un recorrido práctico por la plantilla **Onboarding Tracker** dentro del módulo de **Entrega del Servicio**: cómo trackear el paso a paso de cada cliente nuevo apenas entra. Sofía aclara que es solo una forma **rápida, fácil y efectiva** de hacerlo —un simple **Google Sheet**—, pero que lo mismo se puede armar con un **CRM** o en **ClickUp**.\n\n**Puntos clave que remarca:**\n- **Datos base del cliente:** nombre, mail, a quién se asigna y en cuál de tus programas está inscripto. El programa se carga con un **menú desplegable** (Insertar → menú desplegable), y las etapas con **check boxes** insertados igual; todo es personalizable en colores y nombres.\n- **Etapas de onboarding con checks:** onboarding de marketing, primer pago, seguimiento, **contrato**, **swag** (envío de un regalo o producto con la marca como recibimiento), **D-map enviado**, **formulario de onboarding enviado**, **recibido por el cliente** y **completado**. Al lado se puede pegar el **link al formulario** para que los consultores lo vean fácil.\n- **Responsable:** otro insert para el **consultor** o persona encargada de ese cliente.\n- **Etapas de entrega:** agendamiento de la **sesión estratégica** → sesión realizada → agendamiento de la **llamada de plan de acción** → llamada realizada → **ingreso a la academia/plataforma o canal educativo**.\n\n**Conclusión:** una plantilla liviana y totalmente modificable para que nada del onboarding se caiga; la herramienta importa menos que tener el proceso mapeado y visible.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 188,
        "vn": 12,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-12",
        "cardDesc": "",
        "videoId": "1jMc79jk-pixrc8rYgwDJFk09TzCeNdoS",
        "resumen": "Clip cortito del módulo **Entrega del Servicio**: Sofía repasa los **emails de onboarding** que le mandás a un cliente nuevo apenas entra al programa. La idea es que tengas las **plantillas listas para copiar, pegar y reenviar**. Son básicamente tres correos que salen desde el arranque (el primero del mes).\n\n**Puntos clave que remarca:**\n\n- **Email 1 — Invitación a agendar la sesión estratégica.** Es el primero. Cuerpo tipo: *\"Hola Juan, soy Jessie, tu consultor personal del programa; mi objetivo es acompañarte a lograr estos resultados. Como primer paso vamos a agendar nuestra primera sesión estratégica\"*, con un **link de disponibilidad/calendario**. Después anticipa **qué va a pasar en esa sesión**: conocerse, hacer preguntas en base al **formulario que completó**, presentarle su **plan de acción**, darle **acceso a la comunidad** e inducción a la plataforma, crear el **canal privado exclusivo** de comunicación de los próximos meses y repasar cada parte para despejar dudas. Cierra emocionado, con un **link a resultados de otros clientes** (\"ir calentando motores\") y un \"nos vemos en la primera sesión\".\n- **Email 2 — Recordatorio.** Asunto *\"Recuerda que mañana es tu sesión estratégica\"*. Breve: le recuerda que mañana es la sesión, que **entre desde el link generado en el calendario** de la llamada, y queda a disposición por cualquier consulta previa.\n- **Email 3 — Meet & Greet (opcional, si lo hacen).** Invitación a un **encuentro en vivo** para que conozca a los líderes y demás participantes del programa. Incluye **fecha, hora y banda horaria** (elegida pensando en los usos horarios), y como objetivo que **se presente y conozca al resto**.\n\n**Conclusión:** son los correos base de un buen onboarding: agendar la primera sesión, recordarla y (si aplica) sumar al cliente a la comunidad con un meet & greet. Todo con plantillas prearmadas para no escribir cada vez de cero.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 189,
        "vn": 13,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-13",
        "cardDesc": "",
        "videoId": "125jshpJHz4gCH0HaGqzToSDAslMhejcW",
        "resumen": "Esta clase de **Entrega del Servicio** es un tutorial práctico de cómo armar el **formulario de onboarding**, la herramienta con la que conocés a fondo al cliente apenas entra al programa (sus problemas, su cuello de botella, todo lo útil para implementar). Sofía descarta Google Forms por su **límite de caracteres** y recomienda siempre **Typeform**, que no tiene ese tope, es muy intuitivo, trae plantillas y automatizaciones, e integra con **Google Sheets** y **ClickUp**.\n\n**Puntos clave que remarca:**\n- **Secciones del formulario:** sobre ti, tu rutina, gestión de tu tiempo, sobre el programa, sobre tu negocio, visión, ejecución de la estrategia, clientes, oferta y servicio, competencia, marketing, ventas, operaciones, y una pregunta final de **feedback**. El de ellos tiene **más de 200 preguntas**.\n- **Al crear formulario** hay 3 opciones: con IA, importar preguntas (traer las de Google Sheets), o empezar de cero. Nombre y categoría dan igual.\n- **Primera pantalla = datos del cliente:** teléfono, nombre, apellido, correo y empresa. La imagen se puede cambiar por la de tu programa. El **correo funciona como ID del cliente** para guiar las automatizaciones; el **número de documento** también, por ser dato único (sirve para contratos).\n- **Siempre empezá con una plantilla de texto** que le explique al cliente de qué va, cuánto dura y cómo responder; y separá cada sección con otro texto.\n- **Panel pregunta/diseño/lógica:** el ojito oculta campos, diseño cambia colores, y **lógica** abre un árbol de decisión con ramas. Ejemplo: ante \"¿Tenés otra oferta? Sí/No\", el \"Sí\" reenvía a completar las preguntas de esa segunda oferta y el \"No\" sigue el cuestionario.\n- Tipos de plantilla que más usan: elección múltiple (con orden aleatorio y campos obligatorios), **sí/no** (clave para el árbol) y **puntuación** 1-5 o 1-10 (para feedback).\n\n**Integración y procesamiento:** al **publicar** te da un link para mandar por mail. En Integraciones conectás **Google Sheets** (elegís el Drive, creás una hoja nueva y activás la integración): cada respuesta cae sola en la hoja. De ahí, dos caminos: **manual** —hoja nueva por cliente, copiar los campos y **pegado especial → transpuesto** para tener pregunta y respuesta lado a lado— o **automatizar con Zapier** (que pasa por Drive y demás), tema del próximo video.\n\n**Conclusión:** nunca toques la hoja automática (borrar campos o poner filtros puede desactivar la integración); ahí solo copiás y pegás. Armá una carpeta por cliente con su hoja de onboarding.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 190,
        "vn": 14,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-14",
        "cardDesc": "",
        "videoId": "16Xc9paH8nSdNo4VAuWcSRXbCK8Lb8MSi",
        "resumen": "Este clip es un recorrido práctico por la plantilla **Onboarding Tracker**, la herramienta que Sofía propone para ordenar la **entrega del servicio** cuando entra un cliente nuevo. Aclara que no es obligatorio: lo mismo se puede armar en un **CRM** o en **ClickUp**, pero ella comparte \"la forma rápida, fácil y efectiva\": un simple **Google Sheet** con los datos y el paso a paso de lo que va pasando a medida que el cliente avanza.\n\n**Puntos clave que remarca:**\n- **Datos base del cliente:** nombre, mail y **programa** en el que ingresó (esto último con un **menú desplegable** — Insertar → menú desplegable — que se personaliza con opciones, colores y nombres).\n- **Etapas del onboarding con check boxes** (también se insertan desde el menú): primer pago y seguimiento, **contrato**, **swag** (envío de un regalo, producto de marca u obsequio de recibimiento), **D-Map enviado**, **formulario de onboarding enviado**, **recibido por el cliente** y **completado**. Al lado se puede pegar un **link al formulario** para que los consultores lo vean fácil.\n- **Responsable asignado:** otro desplegable con el consultor o persona a cargo de ese cliente.\n- **Etapas de entrega:** agendamiento y realización de la **sesión estratégica**, agendamiento y realización de la **llamada de plan de acción**, e **ingreso a la academia/plataforma o canal educativo**.\n\n**Conclusión:** todo el sheet es totalmente personalizable — colores, columnas y etiquetas se adaptan a cada negocio. La idea es tener un tablero visual y liviano que muestre en qué punto del onboarding está cada cliente sin perder ningún paso.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 191,
        "vn": 15,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-15",
        "cardDesc": "",
        "videoId": "1NXm-hvRFPK6Lz4JY5g40jLp1s5m3R-OY",
        "resumen": "Esta clase de **Entrega del Servicio** es toda sobre **recabación de feedback**: cómo escuchar sistemáticamente al cliente para ir mejorando tu oferta. La premisa: una vez que tenés la versión 1, tu trabajo es **observar, dar soporte y documentar todo** (la belleza del online es que podés grabar y registrar cada cosa), identificando **confusiones comunes** y **problemas comunes** que se repiten.\n\n**Puntos clave que remarca:**\n\n- **Mapear dónde medís:** todos los puntos de contacto del customer journey con input del cliente sirven — onboarding, módulos, planificación, sesiones 1a1/grupales/de maestría, eventos presenciales, atención por sector, hasta la experiencia de pago. Al lanzar algo nuevo, mediciones **exhaustivas**; una vez aceitado, espaciás (con evaluar la satisfacción **una vez por mes** alcanza).\n- **NPS (Net Promoter Score):** el cliente califica del **1 al 10**. **Detractores 1-6**, **neutros/pasivos 7-8**, **promotores 9-10**. Mide la probabilidad de que te recomiende (boca en boca). Dato: las empresas centradas en el cliente logran **40% más ROI** y fidelizan **60% más**. Fórmula: **% promotores − % detractores** (los neutros = 0, \"borralos de tu mente\"); en fórmula, (promotores − detractores) × 100 / total. Ejemplo: 60% promotores, 10% detractores, 30% neutros → **NPS 50**. Los detractores pesan más porque cuentan la mala experiencia a mucha más gente. Benchmark: **>0 bueno, >50 excelente, >70 world class**.\n- **Implementación en Typeform:** datos del cliente (nombre, apellido, mail) → pregunta de especificidad (qué/quién califica + fecha + mentor/sector) → pregunta de recomendación 1-10 → pregunta de contexto (\"¿cómo podríamos mejorar?\"). Integrás con **Google Sheets** o un CRM.\n- **CES (Customer Effort Score):** mide el esfuerzo del cliente; a menos esfuerzo, más NPS. Escala de **Likert** (\"¿Qué tan difícil fue resolver la solicitud?\", de 1-5 o 1-7, muy difícil→muy fácil). Se mide en **etapas específicas**, no todo el tiempo. Categorías: bajo 1-2, moderado 3, alto 4-5. Fórmula: **% alto esfuerzo − % bajo esfuerzo** (−100 a +100); por debajo de 70% hay que eliminar obstáculos. Libro recomendado: **\"Effortless Experience\" de Matthew Dixon**.\n- **Churn (tasa de cancelación):** clientes perdidos en el mes / total al inicio. Ejemplo: 100 clientes, 5 bajas → **5%**. Un buen churn mensual está entre **1% y 3%** según el mercado.\n\n**Ejemplo (del libro):** una empresa de aspiradoras metía el repuesto que solía romperse directamente en la caja; era más barato que todo el costo operativo de llamadas y soporte, y subía la satisfacción porque el cliente ni percibía el problema.\n\n**Parte práctica:** armás el formulario corto en Typeform desde cero, lo integrás a Google Sheets y aplicás una **tabla dinámica** (filas = correo electrónico, que no cambia; columnas = módulo o consultor; valores = \"cómo calificarías\" con operación **promedio/average**). Con **formato condicional de escala de colores** (rojo=detractores, amarillo=neutros, verde=promotores) queda un **semáforo** que se actualiza solo y sirve para disparar alertas de servicio al cliente.\n\n**Conclusión:** medir NPS, CES y churn de forma sencilla y cercana a cada interacción, centralizarlo en una hoja viva y, más adelante, sumarle automatizaciones (ClickUp + Zapier) para notificaciones. Priorizar bajar el esfuerzo del cliente, más que el \"wow\" caro, es lo que sostiene la satisfacción y el crecimiento orgánico.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 192,
        "vn": 16,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-16",
        "cardDesc": "",
        "videoId": "1n3vwZvOCvjyvlV4_Q3a9WTPUqOBMq8GP",
        "resumen": "Esta clase de **Entrega del Servicio** va sobre la **salud del cliente**: cómo subir la retención y bajar el **churn** (bajas y cancelaciones) anticipándote con un **semáforo** que marca cuándo un cliente está en riesgo. La salud se mide de dos formas: por **etapas completadas** (progreso) y por **interacciones en la comunidad** (engagement).\n\n**Puntos clave que remarca:**\n- **Comportamientos exitosos** (los que, repetidos, acercan al cliente a la promesa): asistir a reuniones grupales y a la **1-a-1** con su consultor, completar módulos en tiempo y forma, cumplir requerimientos y usar los canales periódicamente, aplicar los hitos de cada módulo, hacer las primeras ventas y ayudar a compañeros.\n- **Verdes**: avanzan a paso firme, comprometidos y convencidos; festejan sus logros y los ajenos. Son ideales para pedir **referidos y casos de éxito**. Hay que seguir reconociéndolos, no dejar que se acomoden ni sientan que \"ya llegaron\": darles una **visión aspiracional** (\"el hombre muere cuando el deseo se agota\"). Sirve premiarlos con **reconocimientos** físicos o virtuales (regalo, placa, etiqueta) para que sean ejemplo.\n- **Amarillos**: no progresan como deberían o no están tan comprometidos, pero todavía no se desviaron del todo; riesgo de volverse rojos. Acción: **contacto proactivo** con mensaje personalizado según su personalidad, o una llamada para **generar compromiso, identificar expectativas y obstáculos, acordar próximos pasos y crear responsabilidad**. Si en 24 h no responde, cambiá el medio o subí la autoridad de quien contacta. Regla: tratar al cliente desaparecido como una deuda por cobrar, rotando medio de contacto y jerarquía.\n- **Rojos**: máximo riesgo de abandono; desconectados, no toman llamadas ni contestan, no consumen el contenido o dicen que \"no aplica a ellos\", critican sin evidencia. Acción: agendar una llamada lo antes posible (incluso llamarlo directo). En la charla, sin exponerlo ni avergonzarlo: pedir permiso para grabar, comparar su **estado inicial vs. actual**, entender motivos y pedir **feedback honesto y brutal**. Si está enojado, usar los **documentos de recuperación de servicio**.\n\n**Gatillos y tracker:** hay que sumar al **tracker de clientes** alertas de comportamientos no esperados y automatizarlas (o seguirlas con un **Customer Success Manager**). Ejemplos de gatillos: no contesta la encuesta, deja calificaciones de **7 o menos**, desaparece, falta a reuniones seguidas, cancela la 1-1 o queda muy atrasado frente al resto. Ojo con el **\"tractor/detractor silencioso\"** que no dice nada y su ausencia es la señal. Recomienda **reuniones semanales del equipo** para revisar el estado de cada cliente y activar gatillos; una vez etiquetado amarillo o rojo, seguir los pasos de cada caso.\n\n**La planilla (plantilla que dejan):** lista participantes y responsables por cliente, columnas de **hitos del programa** (mente desbloqueada, nicho definido, oferta, primeros leads, llamadas de venta, promesa cumplida, extra de la promesa, procesos documentados, asistencia al evento, marketing perpetuo aplicado) y un **seguimiento** semanal dividido por mes: el consultor tilda cada evento y se completa una barra de avance que muestra a simple vista quién está verde (todo tildado, cumplió la promesa) y quién quedó atrás. Además, un **overview general** con nombre, fecha de compra, si hizo onboarding, consultor asignado, link a la carpeta del cliente, fecha de inicio y de fin previsto, vacaciones, si logró la promesa y si recomendaría o trae referidos.\n\n**Conclusión:** medí siempre por feedback + avance en la plataforma, poné alertas para actuar apenas alguien \"se sale del carril\" y andá a buscarlo antes de que se convierta en baja.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 193,
        "vn": 17,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-17",
        "cardDesc": "",
        "videoId": "1FcYMy_jrSHyiAJtRGNYDCiQOYhcwYG5p",
        "resumen": "Esta clase de **Entrega del Servicio** es un manual paso a paso de cómo **obtener, producir y almacenar casos de éxito**: desde que un cliente cumple la promesa del programa hasta que el testimonio queda publicado y registrado. Todo se orquesta sobre una única columna de \"casos de éxito\" en el **CRM de clientes**, que dispara automatizaciones y tarjetas en **ClickUp** para cada equipo.\n\n**El flujo de estados (siempre sobre la misma columna del CRM):**\n- **Solicitado**: el consultor detecta el logro en una 1:1, le pide al cliente una entrevista con un mensaje que explica el propósito (entender los desafíos superados, las palabras que usa el cliente, sacar feedback para marketing y para mejorar).\n- **Agendado**: se manda un **Calendly**; a la cita entran el **CEO** (lidera) y el **Customer Success Manager** (CSM). Se genera automáticamente una tarjeta en ClickUp para ambos.\n- **Editar**: el CSM sube la grabación crudo al Drive/LUM con el formato **iniciales del programa + nombre completo + facturación lograda**, y cambia el estado; se dispara tarjeta para marketing.\n- **Edición en proceso** → **Subir a YouTube** → **Subir a la web** → **paso 7 (completo)**: cada cambio de estado genera la tarjeta con el accionable correspondiente al equipo de marketing.\n\n**Puntos clave que remarca:**\n- **Antes de grabar, validar la transformación**: confirmar que el cliente realmente cumplió la promesa (estado inicial vs. actual) para que el consultor no se haya equivocado.\n- **Consentimiento**: pedir permiso para grabar y avisar que se corta la grabación si el cliente se siente incómodo; que salga natural, sin forzar.\n- **Técnica (a cargo del CSM)**: video **horizontal**, buena iluminación, **HD**, buen micrófono, sin ruidos, buen fondo. Duración ideal de la entrevista: **5 a 15 minutos**. Que el cliente **no** nombre el programa y que se meta en la emoción del logro.\n- **Nomenclatura estricta** para que corran las automatizaciones. Ejemplo de archivo: *Master House Bill – Juan Pérez – $8000*.\n- **YouTube**: título con reglas de **SEO** y resultado numérico, palabras clave copiadas de otros videos del canal, **miniatura** con el branding del programa y el número. Se sube a los canales que correspondan (Sofía Contreras / Mastery Haus o los propios).\n- **Web**: subir nombre, logo de la empresa, situación inicial y final, período de la transformación, resultado y **evidencia** (capturas que unan el programa con el resultado).\n\n**El script de entrevista** que propone (líneas generales, adaptable): presentación (\"estamos con X que logró pasar de facturación inicial a facturación final\") + edad/de dónde/a qué se dedica → **estado inicial** (problemas, obstáculos, frustraciones) → **proceso de compra** (miedos, dudas, qué lo hizo dar el paso, por qué invirtió) → **transformación** (metas no económicas, atracción de leads, ventas, precios, retención, vida personal, dónde estaría sin el programa) → **recomendación** a alguien con dudas → **llamado a la acción** al programa.\n\n**Cierre**: en el paso 7 se genera una última tarjeta para el CSM: completar la **planilla de log de casos de éxito** (plantilla que dejan). Tiene desplegables para consultor/referente, nombre, apellido, mail, país, nicho, facturación inicial y final (con fórmula que calcula el crecimiento) y checkboxes de control: feedback dejado, referido, subido a web/redes/mail, premio entregado al cliente, si sube a un programa más alto o extensión, si es caso de estudio, y si está editado y publicado.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 194,
        "vn": 18,
        "grupo": "Entrega del Servicio",
        "modulo": 6,
        "titulo": "Entrega del Servicio-18",
        "cardDesc": "",
        "videoId": "1ioh9qQ9CEw6BlS8sbH-ExOv2MLsiwAnS",
        "resumen": "Esta clase del módulo **Entrega del Servicio** es un manual completo de **recuperación de servicio**: cómo prevenir y manejar clientes insatisfechos, cancelaciones, reembolsos y disputas.\n\nArranca con la teoría del **NPS**. El cerebro está cableado para recordar el dolor: un **detractor** (califica 1 a 6) le cuenta a mínimo 5 personas que no te compren; los **neutros** (7-8) son indiferentes y no comparten; los **promotores** (9-10) recomiendan, pero solo a una o dos personas. Un estudio comparó dos planes: subir detractores a neutros vs. subir neutros a promotores. Los neutros gastan 2-3x más que los detractores, y el **plan B (neutros→promotores) generó 8.8x más ingresos**. Conclusión: no gastes energía en rescatar tóxicos; enfocate en celebrar y hacer ganar más a los clientes exitosos.\n\n**Puntos clave que remarca:**\n- **Prevención con alarmas:** tu negocio necesita indicadores tempranos (tracker cualitativo rojo/amarillo/verde, KPIs, NPS) para anticipar el fantasma, detractor o reembolso antes de que escale. Ej.: si un cliente responde 7, se dispara una notificación en Slack para que Customer Success investigue.\n- **Setear expectativas desde el onboarding** (calidad, cantidad, frecuencia, condiciones de garantía) para evitar la desalineación, causa raíz de casi toda insatisfacción. **Resolvé la causa, no el síntoma.**\n- **Siempre llevá el conflicto a llamada, nunca a chat** (se lee el tono y lenguaje corporal), preguntá el porqué, reconocé tus errores primero para bajar defensas, y hacé **seguimiento a los 3-5 días**.\n- **Documentá todo** (acuerdos, entregas, grabaciones) para tener con qué defenderte ante tóxicos.\n- **Despedir clientes:** si en la 1ª o 2ª semana no quieren avanzar, desvinculalos (\"no abonamos la tierra donde crecen ortigas\"); invertí en árboles que dan frutos.\n\n**Scripts por caso (todos dirigidos a \"Juan\"):** sin tiempo, sin resultados, dificultad financiera (renegociar plazo, cash rápido, referidos), dejó de pagar (con Stripe cobrar monto menor, cobro manual, escalar autoridad), abrumado (paso chico, módulo de mentalidad), enfermedad (pausa empática), arrepentimiento de compra (bajar emociones), no quiere seguir el proceso, y **desaparecidos** (el iceberg: hacé seguimiento exhaustivo, rotá canal y hasta el mentor).\n\n**Pausas:** eliminan la garantía porque cortan el momentum; solo una, menor a 2 meses, extendiendo el programa.\n\n**Amenazas/difamación:** calmar y negociar con empatía; si no, escalar a legales. **Disputas** (el cliente desconoce el pago ante el banco): responder en menos de 24h con evidencia contundente —grabación del ingreso voluntario, contrato firmado, capturas del onboarding, del contenido, del mentor y de las llamadas de coaching— dándole 12h para resolver antes de subirla; con esa prueba se gana la disputa.\n\n**Proceso de reembolso (con ClickUp/CRM):** el consultor llena un **Typeform** con datos completos (facturación inicial vs. actual, logros, fracasos, progreso en ventas/prospección/contenido, pruebas de no-ejecución). Estados en la columna RM: agenda de llamada → agendado → auditado → 2ª llamada → reembolso salvado o efectuado. Se agenda rápido para emparejar la urgencia. La **auditoría** revisa tiempos, volumen, calidad, check-ins, consultorías, comunicación, comunidad (3 interacciones semanales), Success Tracker y pilares de ejecución (mentalidad, nicho, oferta, farming, leads, ventas, servicio). Segunda llamada: se presentan resultados; si el cliente continúa, se firma **nuevo acuerdo** (no compartir material ni comentarios negativos); si no, se negocia o escala a legales.\n\n**Conclusión / perfil de quien retiene:** buscá a alguien con experiencia en atención al cliente, coaching, psicología de ventas, empatía, paciencia y creatividad para negociar sin subir la tensión. Repasa principios estilo Dale Carnegie (elogio sincero, hacer preguntas en vez de dar órdenes, dejar que el otro salve su prestigio, admitir errores rápido). Recomienda el libro **\"Split the Difference\"** (Chris Voss) para negociación.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [],
        "herramientas": []
      }
    ],
    "recursos": [
      {
        "slug": "mh-libro-de-introduccion",
        "label": "Libro de Introducción",
        "tipo": "pdf",
        "cardDesc": "Workbook · Introducción a la Fórmula Mastery Haus.",
        "driveId": "1TOXyuNT5wKO5wCaYbRdYHp870kLzVOOk"
      },
      {
        "slug": "mh-libro-de-mentalidad-mastery",
        "label": "Libro de Mentalidad Mastery",
        "tipo": "pdf",
        "cardDesc": "Workbook · Mentalidad & Foco.",
        "driveId": "1iAgZJv34otal318hX76xpjvOeDflpSOt"
      },
      {
        "slug": "mh-ejercicios-de-mentalidad",
        "label": "Ejercicios de Mentalidad",
        "tipo": "pdf",
        "cardDesc": "Workbook · Mentalidad & Foco · Mentalidad.",
        "driveId": "17CrB0kkFcqyRu3QIyJ9Y1krONMbonpj-"
      },
      {
        "slug": "mh-ejercicios-de-energia",
        "label": "Ejercicios de Energía",
        "tipo": "pdf",
        "cardDesc": "Workbook · Mentalidad & Foco · Energía & Foco.",
        "driveId": "1byYq1Lgiyf2HNAX8g9C0axrQu800ZXqU"
      },
      {
        "slug": "mh-libro-nicho-dorado",
        "label": "Libro Nicho Dorado",
        "tipo": "pdf",
        "cardDesc": "Workbook · Nicho Dorado.",
        "driveId": "180zB8SsV48yiMycgyA6aLZHkdGMVPjgq"
      },
      {
        "slug": "mh-desarrollador-nicho-dorado",
        "label": "Desarrollador Nicho Dorado",
        "tipo": "pdf",
        "cardDesc": "Workbook · Nicho Dorado.",
        "driveId": "1PewC5_nCEgjCxGyQMAWceFODPwT27cGU"
      },
      {
        "slug": "mh-desarrollo-de-avatar-dorado",
        "label": "Desarrollo de Avatar Dorado",
        "tipo": "pdf",
        "cardDesc": "Workbook · Nicho Dorado.",
        "driveId": "1EJxBvb957LBbvLrGHObL5aLABERphD-u"
      },
      {
        "slug": "mh-libro-oferta-irresistible",
        "label": "Libro Oferta Irresistible",
        "tipo": "pdf",
        "cardDesc": "Workbook · Oferta Irresistible.",
        "driveId": "1Xm8u6RKqzCiBFB3RVUIYbrVYsuDjkNvd"
      },
      {
        "slug": "mh-libro-de-precio",
        "label": "Libro de Precio",
        "tipo": "pdf",
        "cardDesc": "Workbook · Oferta Irresistible.",
        "driveId": "1u8lmENVfOpdmdN7TkHTMFKTxv9_NpI9T"
      },
      {
        "slug": "mh-psicologia-de-ventas",
        "label": "Psicología de ventas",
        "tipo": "pdf",
        "cardDesc": "Workbook · Oferta Irresistible.",
        "driveId": "1B6TIrfX1ZdCed480-AJ0bDw30oySXDRQ"
      },
      {
        "slug": "mh-compaginador-de-oferta-productivizacion",
        "label": "Compaginador de Oferta (Productivización)",
        "tipo": "pdf",
        "cardDesc": "Workbook · Oferta Irresistible.",
        "driveId": "1CaF0Lg4pOSsLMjKSu9dhI-je0AJ-CEy1"
      },
      {
        "slug": "mh-libro-de-validacion",
        "label": "Libro de Validación",
        "tipo": "pdf",
        "cardDesc": "Workbook · Validación de Oferta y Ventas de Alto Valor.",
        "driveId": "1h52Iel5sgnFJSqacHkrBqSgRJVe0blk6"
      },
      {
        "slug": "mh-script-de-ventas-infalible",
        "label": "Script de Ventas Infalible",
        "tipo": "pdf",
        "cardDesc": "Workbook · Validación de Oferta y Ventas de Alto Valor.",
        "driveId": "1reJvwrfQvUaeEjrzAOZiDp9A3hKq25oo"
      },
      {
        "slug": "mh-estrategia-sniper",
        "label": "Estrategia Sniper",
        "tipo": "pdf",
        "cardDesc": "Workbook · Validación de Oferta y Ventas de Alto Valor.",
        "driveId": "1HyGb1L83zv8dRZWd5Rz9nPVgD9oWzTyH"
      },
      {
        "slug": "mh-estrategia-farming-de-leads",
        "label": "Estrategia Farming de Leads",
        "tipo": "pdf",
        "cardDesc": "Workbook · Validación de Oferta y Ventas de Alto Valor.",
        "driveId": "1OFg-tr4OrVjuTu5MTHFKJyZAI0XQ5WEl"
      },
      {
        "slug": "mh-desarrollador-de-vsl",
        "label": "Desarrollador de VSL",
        "tipo": "pdf",
        "cardDesc": "Workbook · Validación de Oferta y Ventas de Alto Valor.",
        "driveId": "1O63fDwnM8D29FzzZWdugnmPosWQPgdEL"
      },
      {
        "slug": "mh-funnel-individual-a-llamada",
        "label": "Funnel Individual a Llamada",
        "tipo": "pdf",
        "cardDesc": "Workbook · Validación de Oferta y Ventas de Alto Valor.",
        "driveId": "1fgX2yGXTgh0y-RXfY2CiwZouZJqoFaHh"
      },
      {
        "slug": "mh-libro-entrega-de-servicio",
        "label": "Libro Entrega de Servicio",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "1mEAlxhe-OH58Yje3Km-a4bQlpIxefMZP"
      },
      {
        "slug": "mh-proceso-de-onboarding-de-clientes",
        "label": "Proceso de Onboarding de Clientes",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "1HHztJ6bWjlhII-YRViWoNW7_JOHt5TyM"
      },
      {
        "slug": "mh-salud-del-cliente",
        "label": "Salud del Cliente",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "148ZiGoX42HtL7xqDYG4PB4OYWRBiEfYk"
      },
      {
        "slug": "mh-obtencion-de-casos-de-exito",
        "label": "Obtención de Casos de Éxito",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "1_Q5i_OHsoeXx9NZ-1Uj92fi-hKULjQDl"
      },
      {
        "slug": "mh-recabacion-de-feedback",
        "label": "Recabación de Feedback",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "1IdAbPbz_TTY7mXJfFvIgAQjDPzF2Ja6K"
      },
      {
        "slug": "mh-recupero-de-servicio",
        "label": "Recupero de servicio",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "1dOTDb1KhVacNNxCiNF128n54qUa4eNRo"
      },
      {
        "slug": "mh-solucion-firma-electronica",
        "label": "Solución Firma Electrónica",
        "tipo": "pdf",
        "cardDesc": "Workbook · Entrega del Servicio.",
        "driveId": "1zfIrJFf0kpPsVbxk3Ief8Tf9DDbHCnJh"
      }
    ]
  },
  {
    "slug": "anuncio-ganador",
    "categoria": "Anuncios que venden",
    "eyebrow": "Reto en vivo",
    "titulo": "Anuncio Ganador",
    "cardDesc": "Reto en vivo (3 días) para encontrar el anuncio que vende: la oferta importa más que el producto, apuntá al dolor y dejá que el mercado elija al ganador.",
    "subtitulo": "Un reto en vivo con Jan para dejar de inventar anuncios y empezar a encontrarlos: cruzá audiencias, razones de compra y formas de explicar tu oferta, subnichá al dolor de cada persona y validá barato con testeos chicos. Tres días con clase principal, sala VIP y workbooks.",
    "volumen": "Reto de 3 días",
    "clases": [
      {
        "n": 1,
        "vn": 1,
        "grupo": "Día 1",
        "modulo": 1,
        "titulo": "Día 1 · Reto (clase principal)",
        "cardDesc": "",
        "videoId": "1V9oRYAeX0vj_iejVH01zcUheFRxrGx-u",
        "resumen": "**Sesión en vivo larga del Día 1 del reto \"Anuncio Ganador\"** (3 días), donde Jan expone el *porqué* detrás de encontrar un anuncio que venda. Arranca con una metáfora: estás en una bodega estilo Mr. Beast con **1000 cajas de zapatos**, una guarda **$1 millón**. El 95% se rinde tras abrir 200. El reto te da la **\"visión de rayos X\"** para ir directo a la caja.\n\nIdea central, repetida todo el tiempo: **la oferta no es el producto**, la oferta es *cómo presentás* el producto. El anuncio es la **carnada** o el **tráiler de una película comprimido en 90 segundos**; la película es la oferta. Por eso **el anuncio no se inventa, se encuentra** (se reconoce) en el mercado.\n\n**Puntos clave que remarca:**\n- **Regla 1:** el anuncio ganador ya existe; cuando uno \"se quema\" es una versión de la oferta que el mercado no quiere.\n- **80/20:** el 20% de tus anuncios trae el 80% de la facturación.\n- **Buena oferta + anuncio mediocre = vende. Mala oferta + gran anuncio = no vende.** Analogía del carro con el motor dañado: no lo pintás 5 veces (la pintura son los anuncios, el motor es la oferta).\n- No corras 100 variaciones: probá **5 a 10 versiones de la oferta** (\"anuncios Recon\", como hormigas o un equipo SEAL que recoge inteligencia). Historia: trabajaba de archivador ($600/mes) en un hotel de 850 habitaciones en Abu Dhabi y el equipo de marketing se lo explicó así.\n- El mismo producto le vende a distintas personas por distintas razones (ejemplo del esfero: una enfermera no lo compra por lo mismo que un papá). Menciona a **Russell Brunson** como referente.\n\n**Ejemplos reales:** **Squatty Potty** (unicornio vs. dinosaurio, ganó el unicornio, 42M de vistas); **MindValley** (curso UltraMind, 500 anuncios, ganó \"Helen Huxley\", **$200M** con un solo anuncio); **Dollar Shave Club** (afeitadoras a $1, \"nuestras cuchillas son una locura\", 12.000 pedidos en 48h, vendida a Unilever por $1000M). El propio reto es su anuncio ganador: gastó ~$16.5K→$18.5K en 14 días, ~222 personas, ~$2500/día rentable.\n\nDesglosa **7 mentiras** (probar más anuncios, culpar al gancho/video, perfeccionar la oferta antes de anunciar, \"mi nicho está saturado\", inventar un ángulo único, el tráfico frío no compra, un buen CTR = ganador → **falso positivo**). Adelanta el mapa: Día 2 la hoja de ruta, Día 3 su cuenta de anuncios y las **dos señales invisibles de Meta** (no el CTR ni la frecuencia).\n\n**Conclusión:** un solo anuncio ganador puede hacer crecer tu negocio, y ese anuncio **se encuentra, no se inventa**. Tarea: escribir tres líneas —qué vendés, a quién y qué resultado prometés— y publicar el mayor aprendizaje en el grupo.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "jan-d1-reto",
          "jan-d1-notas"
        ],
        "herramientas": []
      },
      {
        "n": 2,
        "vn": 2,
        "grupo": "Día 1",
        "modulo": 1,
        "titulo": "Día 1 · Sala VIP (Q&A + hot seats)",
        "cardDesc": "",
        "videoId": "1dj0wtEOGVRMxZiGbrcadE9Zu_N8dXZlE",
        "resumen": "**Sesión de preguntas y respuestas en vivo (hot seats).** Este primer encuentro de la Sala VIP fue un espacio abierto donde Jan dio feedback uno a uno sobre los negocios de los asistentes. La idea que martilló todo el tiempo: **el anuncio se encuentra, no se inventa**. Y para encontrarlo propone apoyarse en **tres palancas**.\n\n**Puntos clave / temas tratados:**\n- **Las tres palancas** para multiplicar anuncios sin ser creativo: *¿a quién le vendo?* (varias audiencias, no una sola), *¿por qué me compraría?* (acá entra el **dolor**, con varias razones) y *¿de qué otra forma puedo explicar el producto?* Cruzando audiencias × razones × explicaciones salen 10-12 anuncios de una misma oferta.\n- **La oferta no es el producto:** es *cómo* explicás el producto. Cada anuncio es una **mini versión** de la misma oferta.\n- **Testeo barato:** lanzar 10 anuncios a 7-15 USD por un día; vuelven 2 ganadores (el ~20%) y esos son los que se **escalan**. Hoy la **IA** permite sacar esas variaciones en una tarde.\n- **Subnichar al dolor:** meterse \"debajo de la piel\" de cada audiencia en vez de hablarle a todos con el mismo mensaje (free quote, aprende rápido, etc.).\n\n**Ejemplos reales de los hot seats:**\n- **Auto detailing (Nelson):** vender el detailing más caro, volver al cliente recurrente, atraer vehículos comerciales; o \"cometí 20 cagadas con mi negocio que vos te podés ahorrar\".\n- **Contabilidad y techos (Victoria):** \"tu contador te está haciendo trampa\", \"el truco de la sal\"; para roofing, \"tu techo te podría estar dando 3 señales invisibles\".\n- **Cursos de marketing (Ulises):** la **mamá** que busca un side income, el que \"no se graduó del kínder del marketing\" y el **señor de 70 años** que no quiere hacer el ridículo frente a sus nietos; o \"estrategias de caucho\".\n- **Curso de inglés (Mauricio):** cómo se comunicaban los soldados en la Segunda Guerra, cómo balbucean los bebés, cómo aprenden los futbolistas al mudarse al extranjero.\n- **App de recetas fitness (Marco):** la **\"dieta triste\"**, el drama de pedir la ensalada mientras la familia come rico. Analogía: no pintás cinco veces un carro con el motor dañado; arreglás el motor.\n- **Suplemento de melena de león (Nicolás):** el **peluche de león** y \"este pelito te duplica la concentración\"; y para la suscripción, no describir características sino la consecuencia de *no* tomarlo.\n\n**Conclusión:** más que inventar ideas geniales, se trata de dibujar tres círculos (a quién, por qué, cómo explicarlo), bajar al dolor concreto de cada persona y dejar que el mercado elija al ganador. Mañana se hace el ejercicio en detalle y se comparte un truco para sacar 15 anuncios con el celular.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "jan-d1-reto",
          "jan-d1-notas"
        ],
        "herramientas": []
      },
      {
        "n": 3,
        "vn": 1,
        "grupo": "Día 2",
        "modulo": 2,
        "titulo": "Día 2 · Reto (clase principal)",
        "cardDesc": "",
        "videoId": "1JZD7M6i5k1nYgxzrARBqr4uBl8ktJ5zc",
        "resumen": "**Día 2 · \"Anuncio Ganador\" — Del mapa al terreno**\n\nSi el Día 1 explicó el *porqué*, este es el *cómo*: la hoja de ruta para fabricar nueve o más versiones de tu oferta y dejar que el mercado elija la ganadora. Jan arranca despejando la confusión más votada en la encuesta: la diferencia entre **producto, oferta y ángulo**.\n\n**Puntos clave que remarca:**\n\n- **Tres niveles.** El **producto** es lo que vendes y no se toca. La **oferta** es *el por qué y a quién* le vendes (la razón de compra). El **ángulo** es *cómo* presentás esa razón. Para simplificar, Jan une oferta + ángulo en \"**versiones de tu oferta**\".\n- **\"Un anuncio se encuentra, no se inventa.\"** El mercado no compra el mejor producto, compra *el que mejor entiende*.\n- **No es volumen, son razones.** Cambiar gancho, música o color pero vender la misma razón por dentro es \"pintar cinco veces un carro con el motor dañado\": el anuncio es la pintura, la oferta es el motor.\n- **La fórmula 3×3.** Un producto × 3 audiencias (a quién) × 3 razones cada una = **9 versiones** listas para probar.\n- **No cambiás el qué, cambiás el para quién y el por qué.** Cirque du Soleil pasó de familias a adultos; Crocs, de comodidad médica a autoexpresión; Dan Lok apuntó a hombres jóvenes (respeto); Shelby Sapp vendió high ticket a mujeres de 20-24 (independencia).\n- **La ganadora no se inventa, se prueba.** Como buscar las llaves perdidas: preguntás dónde están, no fabricás unas nuevas. \"Cuando un anuncio no escala, no es culpa del anuncio: es la versión de tu oferta que el mercado no quiere comprar.\"\n\n**Ejemplo — Squatty Potty, P90X y afines:** el mismo banquito se vendió con dos ofertas (\"el problema es tu inodoro\" vs \"tu postura\") y el video del unicornio de tráiler. P90X no inventó el ejercicio, inventó la explicación (**confusión muscular**); Proactiv dijo \"el acné es un sistema, no un grano\"; Liquid Death volvió el agua rebelde y facturó +$700M. Con un caso real de la sala: una sola versión de oferta generó ~800 prospectos a $0,06.\n\n**Conclusión:** dejá de adivinar. Separá producto, oferta y ángulo, escribí tus versiones 3×3 y lanzalas para que el mercado señale. La tarea del día: 5 minutos con tu ficha (oferta + tres razones), publicar tu mayor aprendizaje en el grupo y llenar la encuesta. Mañana, Día 3: las señales invisibles y ese dato \"que no está en ninguna columna\" para cazar falsos positivos antes de escalar.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "jan-d2-reto",
          "jan-d2-notas"
        ],
        "herramientas": []
      },
      {
        "n": 4,
        "vn": 2,
        "grupo": "Día 2",
        "modulo": 2,
        "titulo": "Día 2 · Sala VIP (Q&A + hot seats)",
        "cardDesc": "",
        "videoId": "1rgoZMsIS5f_YgB3keftGjnrXtZnd33WM",
        "resumen": "**De qué va:** Segunda jornada del reto, esta vez en formato **Sala VIP: un Q&A en vivo con hot-seats**, donde Jan revisa uno por uno los negocios reales de los asistentes y les arma anuncios sobre la marcha. No es una clase teórica: es diagnóstico y feedback en directo, con la promesa de una sesión extra el miércoles para que pasen todos.\n\n**Puntos clave / temas tratados:**\n- El ejercicio disparador para todos: **¿cuál es el cliente que más fácil y rápido te compra, con el que más disfrutas y más rentable es?** Anotarlo antes de pensar en anuncios.\n- **No vendés el qué**: el producto es el vehículo. Vendés el **para quién**, el **porqué** o una **explicación nueva**. La gente compra lo que quiere (emoción/deseo), no lo que necesita.\n- Método de los **tres círculos**: cada avatar es una persona distinta, y de cada una salen tres razones de compra (un deseo, un dolor, una explicación diferente).\n- Antes de prometer nada o armar lead magnets: lanzar **~10 anuncios \"Recon\"** que le hablen a 10 \"quiénes\" distintos y ver **cuál pica en el \"lago de Meta\"** (carnadas). Recién ahí se define el CTA.\n- Cuidado con el lead magnet sin **fricción**: atrae \"basura\" que no compra.\n- Pintar una **escena muy viva** de la persona (no características genéricas), usar **ganchos específicos**, \"deuda mental\"/miedo (\"¿dónde vas a terminar si seguís igual?\") y **ponerle nombre a un error o efecto** (apoyándose en ChatGPT).\n\n**Ejemplos reales trabajados:**\n- **Financiera (MX):** mentoría para mujeres 40-45 con TDAH; sus 3 assets eran \"la misma persona\" en distintas circunstancias. Anclaje: las \"medias financieras\".\n- **Fabián:** plataforma B2B de subcontratistas de construcción. Ni lead magnet ni demo para arrancar: primero validar el quién.\n- **Andrés:** automatización para médicos/cirujanos. Razones: **ego**, rotación de secretarias, peleas de pareja por el WhatsApp de pacientes.\n- **Laura:** comunicación para sector tech; ganchos como el grupo de WhatsApp del equipo con tu nombre y \"jalar la cuerda\".\n- **Franco:** concentrados de limpieza (analogía Coca-Cola) para supermercados, hoteles y geriátricos; ángulos de rentabilidad.\n\n**Conclusión:** El anuncio se simplifica cuando dejás de vender el producto y bajás **al para quién y al porqué**, con escenas vivas y varios ángulos que compiten para que el mercado te diga cuál gana.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "jan-d2-reto",
          "jan-d2-notas"
        ],
        "herramientas": []
      },
      {
        "n": 5,
        "vn": 1,
        "grupo": "Día 3",
        "modulo": 3,
        "titulo": "Día 3 · Reto (clase principal)",
        "cardDesc": "",
        "videoId": "1S3AjOtjl-g4_BOSySxe5NEPPc3CpK4Dn",
        "resumen": "**Día 3 del reto: las señales que Meta te viene gritando y casi nadie sabe leer.**\n\n**De qué va:** Jan cierra el reto bajando toda la teoría a Meta. Tras repasar el mapa (día 1: el anuncio *se encuentra, no se inventa*) y el terreno (día 2: **1 producto × 3 \"para quién\" × 3 \"por qué\" = 9 anuncios**, lanzados de forma **secuencial, no simultánea**), comparte su cuenta de anuncios en vivo y revela las **dos señales invisibles** que distinguen un ganador real de un falso positivo.\n\n**Puntos clave que remarca:**\n- Las métricas del tablero **mienten**: hook rate (rompe scroll a 3s), hold rate (retención a 15s), pago iniciado, CTR e impresiones son **métricas de vanidad**. Todas miden **consumo**, no compra.\n- **Consumo vs. intención:** el consumo es lo que alguien hace sin que le cueste nada (clic, ver, opt-in, pago iniciado); la intención es entregar algo que duele —dinero, esfuerzo, tiempo— antes de saber si vas a cumplir. **Un anuncio no escala con consumo, escala con intención.**\n- **Señal 1 — Prueba de intención (fricción).** Se mide primero. Dos formas: **fricción declarada** (formulario instantáneo de Meta con código de verificación al teléfono, o varias preguntas/pasos) y **fricción comercial** (un muro simbólico de $2 a $10 antes del checkout). Separa al curioso del comprador.\n- **Señal 2 — Ritmo del presupuesto (budget pacing).** Se mide después, nunca antes. Con $50/día, si en los últimos 3 días gasta aunque sea $0,02 de más (50,21 / 51,20 / 53,20), hay audiencia y **escalas vertical**; si gasta menos (48 / 53 / 47), no está listo. El famoso **\"subir 20% diario\" es falso**: con un ganador real pasas de $20 a $200 el mismo día.\n- **Falso positivo:** el anuncio que se ve hermoso, vende una semana y después te vacía la cuenta. Hacen falta **las dos señales juntas**: intención sin ritmo = charquito de audiencia; ritmo sin intención = gente que llega pero no compra.\n- **Cómo escalar:** vertical (subir presupuesto al mismo anuncio) hasta que Meta deje de dar; ahí entra la **bola de nieve** (escalamiento horizontal): réplicas de la oferta a $40–$80 cada una. Así llegó a **$1.000/día**.\n- Objetivo siempre **ventas o clientes potenciales**, nunca tráfico. Ya no usa intereses.\n\n**Ejemplo:** para un curso de dormir bebés arma 3 versiones —mamás (recuperar la noche), niñera (volverse la profesional que toda familia busca) y abuelas (ayudar sin pelearse con la hija)—. En su cuenta muestra el infoproducto **\"olor tramposo\"** ($10,99): gastó $100 y le llegaron 7 ventas; y **\"imágenes mentales / limonada\"** ($12,50), con el que hizo ~$5.000 en una semana. En 14 días de reto invirtió ~$20.000 repartidos en 3 cuentas.\n\n**Conclusión:** el anuncio ganador **se encuentra, no se inventa**. No te enamores de números bonitos: pídele esfuerzo al cliente para probar la **intención**, deja que el **ritmo del presupuesto** te diga cuándo y cómo escalar, y cuando Meta se cierre, arma tu bola de nieve replicando lo que ya ganó.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "jan-d3-reto",
          "jan-d3-notas"
        ],
        "herramientas": []
      },
      {
        "n": 6,
        "vn": 2,
        "grupo": "Día 3",
        "modulo": 3,
        "titulo": "Día 3 · Sala VIP (Q&A + hot seats)",
        "cardDesc": "",
        "videoId": "1EEBC2Bwiu1mivSnRbHbl43dDVJPj2KzV",
        "resumen": "**Día 3 · Sala VIP — Anuncio Ganador**\n\n**De qué va:** cierre del reto en formato **sesión de preguntas en vivo (hot-seats)**. No hay clase teórica: Jan va negocio por negocio dándole a cada participante ganchos y ángulos concretos, aplicando las **tres palancas** del método (**para quién / por qué (las razones) / la explicación**). Idea que se repite: **las razones por las que te compran son en realidad problemas específicos**, y hay que ir \"a la jugular\", no quedarse en lo genérico.\n\n**Puntos clave / temas tratados:**\n- **Multiplicar anuncios**: una misma frase de dolor cambia según profesión, síntoma, vehículo probado o identidad; y se duplica al pasarla de hombre a mujer.\n- **La explicación** funciona cuando es **70% conocida y 30% innovadora**: nombres muy comunes (\"creencias limitantes\") no venden; demasiado técnicos, tampoco.\n- **Escalera de conciencia**: hablarle al problema que la persona intuye pero no sabe nombrar, en vez de competir en lo que ya dicen todos.\n- **Apuntar al mecanismo, no al producto**: \"el cliente no compra el producto, compra el proceso\"; hay que ponerle un **nombre interesante** al mecanismo.\n- **Testeo Wincon**: lanzar ~10 anuncios, cada uno con un dolor distinto, ~5 USD c/u, y ver cuál despega; test inicial de **100–300 USD en 3–4 días**.\n- **Herramientas**: grabar una **nota de voz de 10 min** vomitando todo sobre tu cliente y producto, o descargar tus mejores reels, y meterlos a **Claude** (no ChatGPT) para que devuelva razones y ganchos.\n\n**Ejemplos reales de los hot-seats:**\n- **Coach de bloqueos mentales**: gancho \"sabes lo que tienes que hacer pero no lo haces… y hay una razón\".\n- **Fábrica de correas elásticas (Colombia→EE. UU.)**: dejar el \"regalo genérico\" e ir a lo específico (la correa maltrata la cintura, verse mejor que el jefe, conquistar a alguien en el trabajo).\n- **Programa para mamás ejecutivas**: vender con la propia historia (\"esa soy yo\"); no decir \"multinivel\", mostrar el descubrimiento.\n- **Capacitación de extensiones de cabello**: embudo de 25 USD con bumps + páginas por video a 4,99 USD para testear.\n- **Certificación de desarrollo humano (hielo/meditación)**: atraían ego, no interés; solución = anclar a un problema y su mecanismo, con varias versiones de oferta.\n- **Nutrición \"Receta Flex\"**: le compraban otros entrenadores → señal de que el lenguaje atraía a proveedores; virar a dolores del target real (bajar de peso postparto, la vergüenza).\n\n**Conclusión:** el valor del VIP fue el **feedback micro** uno a uno: cada negocio salió con siete u ocho ideas de anuncio listas para replicar. Jan cerró revelando su propia secuencia del reto (**la estrategia \"de uno a 10\"**: mostrar primero lo caro y recién después ofrecer algo económico para quitar la presión de venta) y anunció una sesión extra al día siguiente.",
        "transcripcion": [],
        "hasTx": true,
        "recursoSlugs": [
          "jan-d3-reto",
          "jan-d3-notas"
        ],
        "herramientas": []
      }
    ],
    "recursos": [
      {
        "slug": "jan-d1-reto",
        "label": "Workbook del Reto · Día 1",
        "tipo": "pdf",
        "cardDesc": "Workbook del reto — Día 1.",
        "driveId": "1CxnHil7nz2SfY4gNLDGRi03SZ4NlSVDs",
        "clases": [
          1,
          2
        ]
      },
      {
        "slug": "jan-d1-notas",
        "label": "Notas de Clase · Día 1",
        "tipo": "pdf",
        "cardDesc": "Notas de la clase — Día 1.",
        "driveId": "1b878AFvT42Y8Xgt-fLen4oPPSqeW6HtM",
        "clases": [
          1,
          2
        ]
      },
      {
        "slug": "jan-d2-reto",
        "label": "Workbook del Reto · Día 2",
        "tipo": "pdf",
        "cardDesc": "Workbook del reto — Día 2.",
        "driveId": "1ddKVehUd20yY9HblROLgOKIGD3l0BT-A",
        "clases": [
          3,
          4
        ]
      },
      {
        "slug": "jan-d2-notas",
        "label": "Notas de Clase · Día 2",
        "tipo": "pdf",
        "cardDesc": "Notas de la clase — Día 2.",
        "driveId": "1L6Q43yJj-relTvxIMNIaCoue-AtT6VbJ",
        "clases": [
          3,
          4
        ]
      },
      {
        "slug": "jan-d3-reto",
        "label": "Workbook del Reto · Día 3",
        "tipo": "pdf",
        "cardDesc": "Workbook del reto — Día 3.",
        "driveId": "13wNHp1TBlNExFZtomxQpYrUF9EpvFvLN",
        "clases": [
          5,
          6
        ]
      },
      {
        "slug": "jan-d3-notas",
        "label": "Notas de Clase · Día 3",
        "tipo": "pdf",
        "cardDesc": "Notas de la clase — Día 3.",
        "driveId": "1NQeCHI2VC9Iu-haRwB8VV6hSYqfulVFz",
        "clases": [
          5,
          6
        ]
      }
    ]
  },
  
  {
    "slug": "100ads-analisis",
    "categoria": "Análisis de competencia",
    "eyebrow": "Inteligencia competitiva",
    "titulo": "100ads (Claudio Conde)",
    "cardDesc": "Análisis profundo de la app de la competencia: qué hace, qué promete, su stack, el onboarding y qué aplicar a MaKo.",
    "subtitulo": "Radiografía de 100ads.ai — la fábrica de creativos para Meta Ads de Claudio Conde: producto, promesa, los 3 módulos, el onboarding por extracción, el stack técnico, su capa de agentes (AIOS) y las conclusiones estratégicas para MaKo.",
    "volumen": "Análisis de producto",
    "clases": [
      {
        "n": 1,
        "titulo": "Qué es, qué promete y a quién",
        "cardDesc": "El producto, la promesa, el precio y cómo se diferencia.",
        "videoId": null,
        "resumen": "**100ads** es un **SaaS de generación de creativos para Meta Ads** de **Claudio Conde** (Techain AI), que se posiciona como \"el creador hispano #1 de agencias con IA\". Ojo con el nombre: en la web es *100ads*, pero en el tutorial Claudio lo llama *CienH*, *CienApps* y *Synads/Synth* indistintamente — señal de un producto **joven y en plena mutación** (renombró hace poco).\n\n**La promesa central (su gancho):**\n- **\"100 anuncios que venden, en 10 minutos.\"** Y remarca: *\"100 anuncios que venden, no 100 bonitos.\"*\n- Se define como un **\"sistema de volumen para Meta Ads\"**.\n\n**La tesis que vende** (idéntica a la de Jan/BlueHacker que ya tenemos): **los creativos se queman**. La solución no es *el* anuncio perfecto, es **volumen + testeo**: generás 100 ángulos, los tirás a Meta, matás a los perdedores y escalás a los ganadores. Por eso todo el producto gira alrededor de producir MUCHOS creativos rápido y baratos.\n\n**A quién le vende:** e-commerce, infoproductores, cursos, agencias, media buyers y servicios — cualquiera que anuncie en Meta.\n\n**Modelo de negocio:**\n- **$57/mes** (o **$470/año**, ahorrás $214). **Sin permanencia**, se cancela en un clic, **7 días de garantía** en el primer pago.\n- Planes: **Starter** (solo imágenes) · **Pro** (+ videos) · **Estudio** (+ multi-negocio y multi-cuenta). El video se cobra **por créditos** (por segundo renderizado).\n- **BYOK**: podés conectar tu propia API key y generar **sin tope** — el diferencial de la oferta de $57.\n\n**Cómo se diferencia** (según su propio copy):\n- vs **Canva / ChatGPT** → \"esos hacen imágenes bonitas; nosotros hacemos **ángulos de venta entrenados en data de performance de Meta**\".\n- vs **un diseñador** → \"$1.500/mes por 8-12 ads vs **$57 por 100+**\".\n- vs **apps de UGC genéricas** ($110-550/mes) → suma optimización en Meta, soporte en español, **soporte directo del fundador**, propiedad permanente y personas reales (no actores compartidos).\n\n**Garantías/confianza:** los creativos son **100% tuyos**, **no entrena modelos con tus datos**, y el soporte lo da **Claudio en persona** por el chat/WhatsApp (no un equipo, no un bot).\n\n**Prueba social que muestra:** Santiago Bilbao (**$41.450 en 7 días, ROAS 8.4×**), \"43 ads en una tarde\", \"conversaciones a **$0.09**\", \"**226 conversaciones** de un solo ad ganador\".\n\n**Lectura de fondo:** es una **fábrica de creativos + copiloto de media buying** ultra-nichada a Meta, con dos palancas fuertes: el ángulo de **VOLUMEN** y una capa muy marcada de **founder-led** (soporte personal, comunidad, el propio Claudio como cara). No inventó la teoría (volumen/ángulos es Jan, Hormozi, etc.); **empaquetó esa teoría en un botón**.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 2,
        "titulo": "El onboarding (extracción a-1-pregunta)",
        "cardDesc": "El wizard de 4 pasos que extrae el negocio de la web sin fricción.",
        "videoId": null,
        "resumen": "El onboarding es **lo mejor diseñado del producto** y lo que más nos conviene copiar. Es un **wizard de 4 pasos \"a-una-pregunta\"** que extrae todo del negocio casi sin fricción. *(Dato: lo onboardearon con un negocio de ejemplo tuyo, \"Director Operating System | Sistema de Ejecución para Directores\".)*\n\n**Antes del wizard — la página post-pago.** Apenas pagás, cae una pantalla **\"¡Pago exitoso!\"** con:\n- **3 pasos numerados**: (1) *Registrate con el MISMO email que usaste para pagar — otro email = no tenés acceso*, (2) *El soporte vive adentro de la app*, (3) *Empezá a generar creativos*.\n- Un **\"¿de dónde nos conociste?\"** (Instagram/TikTok/YouTube/Google/Un amigo/Otro) → **atribución** capturada en el momento de máxima atención.\n- Un campo opcional **\"¿web o Instagram de tu negocio?\"** → ya empieza a pedir el input clave.\n\n**El wizard (4 pasos):**\n\n1. **\"¿Dónde vive tu negocio?\"** — te pide **web**, **Instagram** o **\"Contámelo vos\"** (texto libre). Con UNO solo alcanza. *\"De acá sacamos qué vendés, a quién y con qué tono.\"* Es el patrón **a-1-pregunta**: mínimo input, máxima extracción.\n\n2. **\"Esto entendimos de tu negocio\"** — la IA **lee tu web y arma tu perfil sola**, y te lo muestra para **editar**: *Tu producto o servicio*, *La gran promesa (qué le resolvés al cliente)*, *Tu cliente ideal*, y *Tu marca detectada de tu web* (logo, producto, **persona**, y **paleta de colores** extraída). Es un **\"confirmá/corregí\"**, no un formulario en blanco — reduce la fricción a cero y aprovecha lo que ya existe.\n\n3. **\"Estamos creando tus ángulos de venta\" → \"Tus primeros 6 ángulos\"** — genera 6 ángulos **en paralelo** con nombres irresistibles (para tu ejemplo salieron: *El Secreto Del Agobio*, *La Ficción de la Autonomía*, *La Empresa Rehén*, *La Paz Del Director*, *El Eje de la Responsabilidad*, *El Caso Synapsis*). Preselecciona 3 y ya **te muestra 3 ads generados** → **momento \"wow\" inmediato**, antes de que hagas nada.\n\n4. **\"Conectá tu Meta y dejá de adivinar\"** — último paso opcional: conectar Meta Ads. Dos vías: **Vía Token** (disponible) y **Vía OAuth** (en Meta App Review, \"próximo\"). El flujo por token es un paso a paso claro (Business Settings → Usuarios del sistema → asignar activos → generar token con permisos `ads_read`, `ads_management`, `pages_show_list`, `business_management` → pegar). El token se **guarda cifrado (Supabase Vault)**.\n\n**Por qué funciona (y qué copiar):**\n- **Extracción automática desde la web** en vez de un formulario largo → el usuario llega al valor sin trabajo.\n- **\"Esto entendimos, corregí\"** > \"completá 20 campos\". Es exactamente el espíritu de *minimizar la config del usuario* que ya tenemos como principio en MaKo.\n- **Momento \"wow\" en el minuto 1** (3 ads listos antes de tocar nada).\n- **Atribución + el \"mismo email\"** resueltos en la pantalla de pago, no después.\n\n**El agujero:** la conexión a Meta todavía es **manual por token** (OAuth en review) — igual que la fricción que nosotros ya conocemos. Ahí MaKo, si resuelve el OAuth de un clic, gana.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 3,
        "titulo": "Módulo 1 — Fábrica de imágenes",
        "cardDesc": "Brief → ángulos de venta → creativos → variaciones → análisis.",
        "videoId": null,
        "resumen": "La app se divide en **3 áreas**: *CienApps Image* (imágenes), *CienApps Videos* (video, solo Pro/Estudio) y *CienApps Performance* (Meta). Esta es la **fábrica de imágenes** — el corazón del producto.\n\n**El flujo completo:**\n\n1. **Brief (Tu marca).** Todo el contexto del negocio, editable: nombre, **CTA personalizado** (ej. \"Agendá una llamada\"), **paleta de colores** (presets: Editorial cálido, Clásico moderno, Natural tierra, Alto foco, Vibrant, o personalizada), **tipografía** (con sugeridor por IA + lista tipo Arial/Helvetica/Times), **identidad visual** (logo), **imagen del experto** (la cara que sale en los creativos), **referencia del producto** (hasta 10; para digital, un mockup), y variables finas: uso del rostro, uso del producto, tono de voz, descripción libre, y **\"hacer / no hacer\"**.\n\n2. **Ángulos de venta.** La IA te hace **preguntas personalizadas** (podés responder por texto o **por micrófono**) para encontrar ángulos. Un ángulo = **una forma de vender el mismo producto** (el ejemplo de Claudio: vender un micrófono como \"vas a ser el mejor youtuber\" vs \"vas a parecer más profesional\"). Elegís generar **entre 5 y 100 ángulos**. Cada ángulo se clasifica por **familia** (Problema, Deseo, Mecanismo, Creencia, Social) y trae un **\"CTR Score\" predicho** (0-100). En el ejemplo salieron ideas como *El Silencio Cómplice*, *El Engranaje Invisible*, *El Cuello de Botella Eres Tú*, *Más Horas No Es Crecimiento*.\n\n3. **Fábrica creativa.** Cada ángulo → **una imagen** (elegís aspect ratio 1:1, 4:5, 9:16, etc.). Podés generar **de a una** o **la tanda completa**. Formatos como *\"Infografía con Texto\"*, estilo *\"Ultrarrealista\"*.\n\n4. **Variaciones.** Sobre cada imagen principal generás **variaciones** (1 a 9): **solo texto**, **solo imagen**, **ambos**, o **\"promptear\"** (le pedís un cambio: \"hacela más futurista\"). Con ❤️ + ✓ marcás las que te gustan → **la IA aprende y las próximas se parecen más** (feedback loop de gusto).\n\n5. **Análisis (el detalle inteligente).** Le subís **anuncios que YA te funcionaron** (tuyos) y la IA **genera ángulos nuevos a partir de esos ganadores**. También hay un **\"Análisis visual de competencia\"**: subís ads de la competencia y te los desglosa. Es el loop \"aprendé de lo que ya ganó\" incorporado al producto.\n\n6. **Historial + descarga.** Todo lo generado queda en **Historial** (filtros: Aprobados/Rechazados/Pendientes), lo seleccionás todo, lo **descargás en ZIP** ya formateado por placement (feed/story/reel) y lo **importás a Meta**.\n\n**Lo potente:** el usuario nunca escribe un prompt de imagen. Todo el prompting pesado (composición, estilo, texto sobre la imagen) lo hace la IA por detrás; el usuario solo da **contexto de negocio + ángulo + gusto**. Es la misma filosofía de \"sugerir > configurar\" que buscamos en MaKo, pero aplicada a la generación visual.\n\n**Motor:** las imágenes las genera **Nano Banana 2 (Gemini 3.1 Flash Image)** vía **KIE.ai**; el texto (hooks, copys, ángulos) lo genera **Gemini 3.1 Pro**.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 4,
        "titulo": "Módulo 2 — Fábrica de videos UGC",
        "cardDesc": "Avatares con identity-lock, hooks, script y render por chunks.",
        "videoId": null,
        "resumen": "La **fábrica de videos UGC** está solo en los planes **Pro y Estudio**. Genera **reels completos con avatares de IA** — UGC sin grabar, sin cámara y sin actor.\n\n**El flujo:**\n\n1. **Personas (avatares).** Creás un \"personaje\": subís **3-4 fotos** de una persona (real o hecha por IA — da igual, el modelo **no la clona idéntica, crea una muy similar**), le ponés **nombre, edad, género, ocupación, estilo visual** (minimalista/colorido/cinematográfico/cotidiano), **tono** (cercano/profesional/divertido/serio) y **voz** (con acento). *(En tu ejemplo crearon a \"Mauricio Bustos, 50, Coach\".)* El sistema arma por detrás un **\"identity lock\"**: un prompt larguísimo que describe cada rasgo (pelo, piel, ojos, ropa, lentes…) para que **el avatar salga idéntico en cada segmento del video**. Ese es el truco técnico que hace consistente al personaje entre clips.\n\n2. **Hooks.** Los **hooks** (lo primero que aparece en el reel) salen **de los ángulos de venta** que ya generaste — se transforman automáticamente en una **biblioteca de hooks** clasificados por tipo (First Frame, Pregunta, Stat, Provocación, Historia), con un contador de uso. Elegís uno de la biblioteca o escribís el tuyo.\n\n3. **Script.** Elegís formato (recomienda **UGC**) y la IA **genera el guión completo** del reel. Es editable, y podés definir **cuánto dura cada clip** (5 o 10 seg).\n\n4. **Render por chunks.** El video se arma en **\"chunks\"** (ej. 6 clips). Podés renderizar **uno por uno** o **la tanda completa** (ej. 6 chunks por ~200 créditos, ~6 min). El costo es **por segundo** (más segundos = más créditos). La UI muestra el progreso en vivo mientras renderiza.\n\n5. **Armar el reel + descargar.** Una vez listos los chunks, **\"armar reel completo\"** los une, y lo **descargás en MP4** para editarlo en **CapCut/Captions** y subirlo a Meta.\n\n**Features que anunció como \"muy cerca\":**\n- **Edición automática** dentro de la app (elegís un estilo y te edita el reel de un botón).\n- **Publicar y programar** el contenido directo desde la app (sin bajar/subir).\n\n**Motor:** un **\"Video Studio\"** propio con **avatares IA (identity-lock por texto)**, voz/acento y **render por chunks**, orquestable por API.\n\n**Lectura para MaKo:** el diferencial acá NO es \"generar video con IA\" (eso lo hace cualquiera) — es el **identity-lock por texto** (personaje consistente) + que **el hook sale del ángulo de venta** (todo encadenado: negocio → ángulo → hook → script → video). La cadena integrada es lo valioso, no la pieza suelta.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 5,
        "titulo": "Módulo 3 — Performance (Meta Ads)",
        "cardDesc": "Conectar Meta, métricas, recomendaciones y pausar campañas.",
        "videoId": null,
        "resumen": "*CienApps Performance* es la parte que **cierra el loop**: no solo generás creativos, sino que **medís qué funcionó y actuás sobre Meta**. Está disponible en **todos los planes** (conectando Meta).\n\n**Cómo conecta:** por **\"Meta Ads CLI\"** — pegás un **token de acceso** de tu propia cuenta de Meta Business (oficial, legal, no banea la cuenta). Claudio aclara que dan **un tutorial** de cómo generarlo, y que si usás Claude/Claude Code **te dan un prompt** para pegarle a la IA y que te guíe en la conexión (detalle muy \"de su mundo\"). El token se guarda cifrado.\n\n**Qué te muestra una vez conectado:**\n- Métricas de la cuenta: **hook rate, hold rate, CPC, CTR, conversión, CPA**, por ventana (24 h / 7 días).\n- Podés verlo en **cards o tablas**, y **exportar todo a CSV** (para pasárselo a otra IA si querés).\n- **Multi-negocio y multi-cuenta**: en Pro/Estudio conectás varias cuentas publicitarias y generás imágenes/videos por cuenta.\n\n**La capa que lo hace un copiloto (no un dashboard):** la IA **te da recomendaciones accionables** sobre tu data real:\n- *\"Escalá esta campaña que tiene buen ROAS y buena frecuencia\"*.\n- *\"Cortá esta otra: ROAS 0 y ya lleva $140 gastados\"*.\n- Y — clave — si le das **\"pausar\"**, la app **entra a tu Meta y pausa la campaña de verdad**. Es decir, **ejecuta sobre la cuenta**, no solo sugiere.\n\n**Por qué importa (y dónde MaKo ya juega):** esto es **casi exactamente el \"Ads Manager\" + \"Salud/Semáforo de Meta\" que MaKo ya tiene** — leer la cuenta, semáforo de decisiones, y **escrituras a Meta** (pausar/renombrar/escalar, que en MaKo ya funcionan). La diferencia es que 100ads lo enchufa a su fábrica de creativos: detecta fatiga → te manda a generar reemplazos. Ese **puente \"métrica mala → generá el creativo nuevo\"** es la integración que a MaKo le conviene cerrar.\n\n**El agujero (otra vez):** la conexión es **manual por token** (OAuth todavía en review). Y las recomendaciones son las **típicas de media buying** (escalar 20%, cortar ROAS 0) — Meta no las da por API, se derivan; MaKo ya deriva las suyas para el semáforo.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 6,
        "titulo": "El stack técnico y cómo está construido",
        "cardDesc": "Con qué está hecho: casi el mismo stack que MaKo.",
        "videoId": null,
        "resumen": "Claudio publicó su **stack completo** (documento \"Mi Stack & Sistema de operación\"). Esto es oro: es el mapa de **con qué está construido 100ads** y con qué opera todo su negocio. La mayoría **coincide con lo que ya usamos en MaKo**.\n\n**El software que ES 100ads (el producto):**\n- **Frontend:** React 19 + TypeScript + **Tailwind** + **Vite** (SPA). Igual que nosotros (Next/React + Tailwind).\n- **Backend/datos:** **Supabase** (Postgres + auth + storage de los assets). **Igual que MaKo.**\n- **Auth:** **Clerk** (login/usuarios) — nosotros usamos sesión propia firmada.\n- **Pagos:** **Stripe** (suscripción $57/30d + packs de créditos). Decisión explícita: \"Stripe directo, no Polar\".\n- **Hosting/deploy:** **Vercel.** Igual que nosotros.\n- **i18n:** app en **4 idiomas** (ES/EN/PT/CA).\n\n**El motor de generación (IA):**\n- **Nano Banana 2 = Gemini 3.1 Flash Image** → genera las imágenes/creativos, servido vía **KIE.ai** (reemplazó a Seedance/BytePlus).\n- **Gemini 3.1 Pro** → genera el texto (hooks, copys, ángulos de venta).\n- **Video Studio** propio → avatares IA con identity-lock, voz/acento, render por chunks.\n- **BYOK** → el usuario conecta su API key y genera sin tope (el mismo modelo de \"traé tu propia key\" que ya montamos en MaKo).\n\n**Operación / ads / medición:**\n- **Meta Marketing API** + **Pixel + CAPI** (correr y medir ads). **ManyChat** (captar leads de DMs). **Metricool** (publicar/programar reels multi-red). **Intercom + Fin** (soporte automático). **PostHog, Sentry, MS Clarity** (analítica/errores). **Bunny/Wistia** (hosting de video).\n\n**Su \"infraestructura pesada\" (para operar el negocio, no el producto):** Docker/Swarm/Portainer/VPS/systemd/tmux; Redis (cache), Minio (archivos), RabbitMQ (colas), Vector DBs (embeddings); CrewAI, Flowise, n8n (*\"casi deprecado\"*); Chatwoot, Evolution API, WhatsApp Cloud API, Discord (migrando la comunidad de WhatsApp a Discord); Resend, Notion.\n\n**Conclusión técnica:** no hay magia ni nada que no podamos igualar. **El stack es prácticamente el nuestro** (Supabase, Vercel, Stripe, Meta API, Pixel+CAPI, Evolution/WhatsApp, BYOK). El único componente de producto que MaKo hoy no tiene es la **fábrica de creativos** (Nano Banana 2 + Video Studio con identity-lock). Todo lo demás — CRM, WhatsApp, medición de Meta, integraciones — MaKo ya lo tiene, y en varios casos **más completo**.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 7,
        "titulo": "El \"segundo cerebro\" y los 5 agentes (AIOS)",
        "cardDesc": "Cómo Claudio opera todo el negocio con Claude Code + agentes.",
        "videoId": null,
        "resumen": "Esta es la parte **más interesante y menos obvia**: cómo Claudio **opera todo su negocio con IA**. No es parte del producto que vende, es su **backstage** — y es casi un espejo de lo que estamos construyendo con MaKo + Claude Code.\n\n**1) El \"Segundo Cerebro\" (context engineering con Claude Code).**\n- **Carpetas de texto plano + Claude Code como \"bibliotecario\"**. El **repo de Git ES la memoria**: le habla desde la Mac, claude.ai y el celular, y los tres ven lo mismo. *\"Lo que no está en el repo, no existe.\"*\n- **`CLAUDE.md`** = \"el cerebro del cerebro\": instrucciones que Claude lee siempre primero (quién es, sus **5 funciones: leer → organizar → responder → guardar → mejorar**, tono y contexto). ← Esto es **idéntico a nuestro sistema de memoria + CLAUDE.md**.\n- Estructura: `RAW/` (el cajón de sastre: notas de voz, transcripciones, ideas — regla: *no organizar, solo meter*), `WIKI/` (conocimiento ordenado por tema, **100% escrito por la IA**), `OUTPUTS/`, `changelog.md` (cada respuesta importante guardada con fecha → **efecto compuesto**), y **sync automático con GitHub** (se commitea y pushea solo). También un **HealthOS** (mismo principio aplicado al cuerpo: Apple Health + Cal AI + Hevy + sangre).\n\n**2) Sus Skills de Claude Code** (capacidades a demanda):\n- De contexto/negocio: `claudio-context`, `100ads-context`, `sla-consulting`, e **`inquebrantable`** (su mentalidad destilada: responsabilidad radical, cero excusas).\n- De contenido: `content-creator`, `instagram-viral-strategy`, `crear-carrusel-100ads`, `crear-stories-100ads`, `reel-editor` (edición pro con **Remotion**).\n- De sistema: `know-me`/`self-healing` (aprenden sus patrones entre sesiones), `limpieza-pc`.\n- Y la suite **gstack de Garry Tan (YC)** para el ciclo de software completo (spec → codear → QA en navegador real → review → ship → canary).\n- ← Esto es **exactamente nuestro sistema de skills del repo** (los `.claude/skills/`), pero él lo llevó también a su vida personal y su contenido.\n\n**3) AIOS — los 5 agentes que operan el negocio** (la capa que EJECUTA). Un dashboard orquesta 4 agentes + un command center. *\"El tablero humano muestra métricas + un copilot que propone; el AIOS es la capa que ejecuta. Lo que toca plata pasa por una cola de aprobación; el resto es automático.\"*\n- **Concierge** → atiende y **califica leads** en Intercom/IG/TikTok DMs, **agenda llamadas**.\n- **Scaler** → **genera 100+ creativos, testea en Meta, mata perdedores, escala ganadores**.\n- **Builder** → escribe código, corrige bugs, corre tests, **deploya**, monitorea uptime.\n- **Creator** → idea, guiona, edita y **programa contenido orgánico** (IG + TikTok) en un pipeline kanban.\n- **Command Center** → los **orquesta**: ROAS en vivo, pacing de Meta, temperatura de leads, objetivos del mes, estado de cada agente y **cola de aprobaciones**.\n\n**La joya conceptual:** *\"lo que toca plata pasa por una **cola de aprobación**; el resto es automático.\"* Es **exactamente el patrón \"MaKo propone, vos aprobás\"** que ya usamos (borradores de nutrición, campañas en pausa, tareas al plan). Claudio lo tiene sistematizado como una capa. **Esa arquitectura —copilot que propone + cola de aprobación para lo sensible— es el norte de la \"app viva\" de MaKo, y él la validó.**",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      },
      {
        "n": 8,
        "titulo": "Qué aplicar a MaKo (y qué NO)",
        "cardDesc": "El análisis estratégico: qué copiar, dónde MaKo ya gana, qué evitar.",
        "videoId": null,
        "resumen": "La conclusión importante: **100ads y MaKo se solapan en filosofía, pero atacan puntas distintas.** 100ads es una **fábrica de creativos** angosta y profunda (Meta Ads); MaKo es un **sistema operativo de agencia** ancho (CRM, nutrición, ventas, medición, conocimiento). Casi todo lo de 100ads, MaKo ya lo tiene o lo puede tener — **menos una cosa**.\n\n**Lo único que ellos tienen y MaKo no: la fábrica de creativos.**\n- Generación de **imágenes de anuncio por ángulo** (Nano Banana 2 / Gemini 3.1 Flash Image vía KIE) y **video UGC con avatar consistente** (identity-lock).\n- Es el gran gap a evaluar. Encaja natural con lo que MaKo ya tiene: **Ads Manager** (crear campañas), **Ads Analyst** (ya analiza guiones de video ads) y el **Semáforo de Meta**. El puente sería: *métrica mala / fatiga → MaKo te genera el creativo de reemplazo*.\n\n**Qué copiar (alto valor, bajo costo):**\n1. **El onboarding por extracción.** \"Pasame tu web/IG y yo entiendo tu negocio → confirmá/corregí\" es superior a un formulario. Es nuestro principio de *minimizar la config del usuario* llevado al extremo. **El momento \"wow\" (3 ads listos en el minuto 1)** es replicable con cualquier feature de MaKo.\n2. **La cadena integrada negocio → ángulo → hook → script → creativo.** Lo valioso no es cada pieza suelta, es que **todo cuelga del contexto del negocio** una sola vez. MaKo ya tiene el \"cerebro de copywriting\" y la voz de Martín; encadenarlo así es el patrón.\n3. **El \"CTR Score\" predicho por ángulo.** Poner un **número estimado** al lado de cada idea/ángulo (aunque sea heurístico) sube muchísimo la percepción de valor. Aplicable a los experimentos y a las sugerencias de MaKo.\n4. **\"Análisis de competencia\" como feature.** Subir ads de un competidor y desglosarlos. MaKo podría hacerlo con Claude sobre transcript/imagen — barato y muy vendible.\n5. **Aprender de lo que ya ganó.** \"Subí tus ads ganadores → genero variantes\" cierra el loop con la data real (que MaKo ya tiene vía Meta).\n6. **El modelo founder-led / soporte del dueño.** Es un diferencial fuerte de percepción — y MaKo ya lo encarna con la voz y la cara de Martín.\n\n**Dónde MaKo YA les gana (no imitar, capitalizar):**\n- **CRM automático, motor de nutrición por WhatsApp, Closing/Ads Analyst, multi-tenant real, Conocimientos/RAG, email con Resend.** 100ads no tiene nada de esto: termina en \"descargá el ZIP y subilo a Meta\". **MaKo acompaña todo el funnel; 100ads solo la boca del funnel.**\n- **Integración con Meta más profunda:** MaKo ya hace **escrituras a Meta** (pausar/renombrar/escalar) y deriva recomendaciones/semáforo. 100ads hace lo mismo pero es su *feature secundaria*.\n\n**Qué NO copiar (sus agujeros):**\n- **El naming caótico** (100ads/CienH/CienApps/Synads/Synth) — confunde y erosiona marca.\n- **La conexión a Meta manual por token** (OAuth todavía en review). Si MaKo resuelve el **OAuth de un clic**, gana en fricción justo donde ellos flaquean.\n- **Depender de créditos por segundo de video** como fricción de uso — el BYOK lo alivia, pero es un punto de queja.\n\n**La validación más importante para nuestro rumbo:** el **AIOS de Claudio** (copilot que propone + agentes que ejecutan + **cola de aprobación para lo que toca plata**) es **la misma arquitectura que perseguimos con la \"app viva\" de MaKo**. Un competidor real, cobrando, ya la validó. No estamos inventando el modelo — estamos corriendo la misma carrera, con más superficie de funnel a favor.\n\n**Recomendación en una línea:** MaKo **no debería volverse un 100ads** (fábrica de creativos angosta); debería **absorber su único diferencial** (generación de creativos por ángulo, empezando por imágenes) como **una pieza más** de un sistema que ellos no tienen — el resto del negocio.",
        "transcripcion": [],
        "recursoSlugs": [],
        "herramientas": []
      }
    ],
    "recursos": []
  }
];
