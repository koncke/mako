// =============================================================================
// Curso "Avatares de IA que se parecen" — portal /conocimientos
// =============================================================================
// Lo aprendido produciendo los primeros anuncios con avatar de IA de un cliente
// real. MISMO contenido que el curso de área 'producto' en /conocimiento (el RAG):
// allá lo consume MaKo, acá se lee. Fuente única del texto: lib/curso-avatar.ts.
//
// Sin video: cada clase es una lección de texto (el portal renderiza `resumen`).

import type { Curso } from './curso';

export const CURSO_AVATAR_APP: Curso = {
  slug: 'avatares-que-se-parecen',
  categoria: 'Producto y construcción',
  eyebrow: 'Cómo construimos MaKo',
  titulo: 'Avatares de IA que se parecen',
  cardDesc: 'Imagen, guion, voz y montaje de un avatar que el cliente reconozca como propio. Y cómo separar lo que es culpa nuestra de lo que es culpa del material que subió.',
  subtitulo: 'Todo lo que salió mal produciendo los primeros anuncios con avatar de Mauricio, y qué lo arregló. Cada lección sale de un error medido o de una queja real del cliente.',
  volumen: '23 lecciones',
  recursos: [],
  clases: [
  {
    "n": 1,
    "grupo": "Identidad",
    "titulo": "La regla de oro: nunca referencies IA con IA",
    "cardDesc": "El error más caro de toda la producción, y el que más veces se repitió.",
    "videoId": null,
    "resumen": "El error más caro de toda la producción, y el que más veces se repitió.\n\nLa cadena que parecía razonable era: foto real → hoja de identidad generada (character sheet) → imagen de escena generada → clip de video. Cuatro eslabones, tres de ellos generativos. El resultado fue otra persona: cara distinta, cámara equivocada, y a veces el modelo reproduciendo la propia grilla de referencia.\n\nLa causa es acumulativa. Cada generación es una INTERPRETACIÓN del material que recibe. Pedirle a un modelo que interprete la interpretación de otro modelo multiplica la deriva, y nadie mira los pasos intermedios. Lo detectó el cliente, no la herramienta: sacó la grilla, dejó solo su foto real, y salió bien a la primera.\n\nLA REGLA: la fuente de identidad es SIEMPRE una foto real de la persona. El character sheet es un refuerzo opcional para ángulos que la foto no muestra — nunca el ancla.\n\nEL MATIZ, que importa para el producto: la regla no es \"cero generaciones\", es \"cero saltos sin control\". Un solo salto (foto real → imagen de escena) es aceptable SI un humano aprueba esa imagen antes de que se propague a los 12 clips. Lo que rompe es encadenar generaciones que nadie verificó.\n\nY COROLARIO: menos referencias es mejor. Pasarle tres fotos distintas al modelo son tres encuadres distintos entre los que elige o promedia — por eso cada toma salía con otro ángulo. Una sola referencia.\n\nPARA MAKO: cualquier flujo que encadene generación sobre generación acumula deriva en cada salto. El diseño correcto ancla CADA salto en el material real del cliente, no en la salida anterior. Y si un paso intermedio se guarda, se guarda con la marca de que es material generado, para no reusarlo como fuente.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 2,
    "grupo": "Imagen",
    "titulo": "El realismo se pierde en el prompt, no en el render",
    "cardDesc": "Queja típica: \"tiene demasiada calidad, parece cine y no un celular\". La reacción instintiva es agregar una capa de degr",
    "videoId": null,
    "resumen": "Queja típica: \"tiene demasiada calidad, parece cine y no un celular\". La reacción instintiva es agregar una capa de degradado en post. Casi siempre es tarde.\n\nEl método 6C de AvatarHype, que es el que se usa para escribir estos prompts, tiene un componente de luz (C5) que dice TEXTUALMENTE \"Always include direct harsh iPhone flash\" y \"Use high contrast when appropriate\". Si el clip se generó con el 6C tal cual, el exceso de contraste lo pidió el método. No es un error del modelo.\n\nArreglar eso en post es pelear contra píxeles ya quemados: un highlight reventado no tiene información que recuperar.\n\nEL ANTÍDOTO está en el mismo curso, para el mismo escenario (una persona hablando dentro de un auto):\n\n\"Natural iPhone photo with soft ambient daylight, no dramatic flash, low contrast, muted tones, slight grain, authentic smartphone exposure, realistic shadows, candid UGC vibe.\"\n\nEsa línea reemplaza al C5 por defecto siempre que sea interior, auto o luz natural. El C5 original sirve para nocturno, fiesta, flash duro.\n\nEL REPARTO ENTRE PROMPT Y POST:\n- Va en el prompt (el render no lo inventa estable): piel con poros, dirección y dureza de la luz, encuadre descentrado, rolling shutter y autofocus hunting (para esos dos no existe filtro de ffmpeg), y el negative prompt.\n- Va en el post: grano temporal, bajar contraste y saturación, rango dinámico corto, quitar filo, deriva de exposición, temblor de mano, viñeteo suave y compresión.\n- Lo único que va en los dos lados es el grano.\n\nTRAMPA: no copiar las recetas de \"look TikTok\" que circulan. La más citada sube el contraste y sube la nitidez, o sea empeora exactamente las dos quejas típicas del material generado.\n\nREGLA: antes de escribir una capa de post, leer el prompt. Elegir mal la variante de luz es el error más caro porque no se puede deshacer.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 3,
    "grupo": "Imagen",
    "titulo": "No describas la cara con palabras: compite con la foto",
    "cardDesc": "Un prompt que decía \"hombre de unos 55 años, pelo gris corto, lentes de marco fino\" acompañado de una foto real devolvió",
    "videoId": null,
    "resumen": "Un prompt que decía \"hombre de unos 55 años, pelo gris corto, lentes de marco fino\" acompañado de una foto real devolvió a OTRA PERSONA: alguien que cumplía la descripción sin ser el cliente.\n\nLa causa: la descripción textual COMPITE con la imagen de referencia, y el modelo prefiere el texto. El propio método 6C lo dice y es fácil de violar sin darse cuenta: \"Do not invent hidden traits that cannot be observed\" y \"Preserve the visible identity and facial characteristics when a reference image is supplied\".\n\nEL REPARTO CORRECTO: el texto describe la ESCENA y la CÁMARA. La foto define la CARA.\n\nY la cámara hay que describirla con precisión, porque si no el modelo elige mal: \"selfie con el brazo estirado\" y \"visto desde el asiento del acompañante\" son tomas opuestas. Cuando la referencia es un selfie y el prompt no lo dice, sale una toma de tercera persona que no se parece en nada.\n\nLA EXCEPCIÓN, y es angosta: cuando el modelo YA está derivando la cara de forma consistente en la misma dirección, se le puede poner un bloque corto que corrija solo esas derivas concretas, nombradas por el propio cliente. No una descripción completa de la cara: una lista de correcciones.\n\nPARA MAKO: el prompt que arme el sistema nunca debe incluir rasgos físicos derivados de texto. Si el usuario cargó una foto, la foto manda. Si el usuario escribió \"soy morocho de barba\", eso NO va al prompt de imagen — va, como mucho, a validar que la foto que subió sea de él.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 4,
    "grupo": "Imagen",
    "titulo": "Un cambio por vez, y con techo: repetir un concepto lo intensifica",
    "cardDesc": "Tres correcciones seguidas salieron al extremo opuesto del problema, una tras otra:",
    "videoId": null,
    "resumen": "Tres correcciones seguidas salieron al extremo opuesto del problema, una tras otra:\n\n1. Se pidió des-perfeccionar la piel con ocho instrucciones de envejecimiento juntas (arrugas, ojeras, piel floja, cara más angosta, pómulos marcados, más canas, pelo despeinado). Devolvió a un señor enfermo de 70 años. Peor: una de esas líneas tocaba la ESTRUCTURA ÓSEA, que es identidad, no textura.\n\n2. Se pidió luz direccional describiendo la sombra en cinco frases. Devolvió el habitáculo casi negro.\n\n3. Se pidió ventanilla quemada con seis sinónimos (washed out, low contrast, pale, hazy, glare, never crisp). Devolvió niebla.\n\nEL PATRÓN: con estos modelos, cada sinónimo es otro voto en la misma dirección. Nombrar un concepto cinco veces no lo hace más preciso, lo hace más extremo.\n\nLAS DOS REGLAS QUE QUEDAN:\n\nA) Se nombra una vez, y con el límite en la MISMA oración. No \"washed out, pale, hazy, low contrast\" sino \"a little brighter and softer than the interior, but still clearly readable, with normal colour. No haze, no fog\".\n\nB) Un eje por corrección, y siempre volviendo a la imagen original — no encadenando sobre el resultado anterior, que ya viene desviado.\n\nY NUNCA se toca en una pasada de des-perfección: hueso, pelo, edad y expresión. Eso es identidad. La textura de la piel sí.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 5,
    "grupo": "Imagen",
    "titulo": "El prompt resetea todo lo que no nombra",
    "cardDesc": "Sobre una imagen ya aprobada, con su ventanilla quemada y su fondo desenfocado, se corrió un prompt para cambiar la call",
    "videoId": null,
    "resumen": "Sobre una imagen ya aprobada, con su ventanilla quemada y su fondo desenfocado, se corrió un prompt para cambiar la calle. Volvió con la calle nueva y CON TODO EL TRATAMIENTO FOTOGRÁFICO PERDIDO: nítida, bien expuesta, todo enfocado.\n\nDespués se corrió otro para la luz. Volvió con la luz bien y sin la ventanilla quemada ni el desenfoque.\n\nNo es un bug: el modelo no \"conserva\" lo que no le mencionás. Re-renderiza con sus defaults todo lo que el prompt no fija.\n\nLA REGLA: en cualquier prompt de cambio sobre una imagen, hay que REPETIR el tratamiento fotográfico completo aunque no lo estés cambiando. Vale para variantes de fondo, cambios de ropa, correcciones de piel y cualquier retoque posterior.\n\nEsto choca de frente con la regla de \"un eje por vez\" y hay que resolverlo así: se cambia UN eje, pero se DECLARAN todos. El prompt largo no es el problema; el problema es pedir varios cambios a la vez.\n\nPARA MAKO: si el producto ofrece \"cambiá el fondo\" o \"cambiá la ropa\" como acción de un clic, el prompt que se manda por debajo tiene que arrastrar el bloque de tratamiento de la imagen original. Guardar ese bloque junto con la imagen, no reconstruirlo.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 6,
    "grupo": "Imagen",
    "titulo": "La sonrisa devuelve los rasgos (y lo descubrió el cliente)",
    "cardDesc": "El cliente, comparando la imagen base con el video generado a partir de ella, dijo algo que resolvió media producción:",
    "videoId": null,
    "resumen": "El cliente, comparando la imagen base con el video generado a partir de ella, dijo algo que resolvió media producción:\n\n\"Cuando lo veo en foto sí se parece, pero cuando le pongo play, de repente cambia, y es el tema ese de la sonrisa. Cuando estoy riendo se hace más redondito esto, se hace más pronunciado mis cachetes, se hace más redonda la papada. Ahí se parece más a las fotos.\"\n\nEso explica de una todas sus otras quejas — quijada cuadrada en vez de redonda, cachetes flacos, papada perdida, cara más angosta. No eran deriva aleatoria: son exactamente los rasgos que APARECEN cuando sonríe y DESAPARECEN cuando está en reposo. El modelo, al animar, le entrega una versión neutra y estirada.\n\nLA REGLA: si la persona es de sonrisa fácil, la foto de referencia tiene que ser sonriendo, y el prompt tiene que sostener la sonrisa mientras habla:\n\n\"He keeps a light, easy smile throughout, the way he naturally speaks — never a neutral or slack expression.\"\n\nMÁS EN GENERAL: cuando alguien dice \"no me parezco\", la pregunta útil no es \"qué está mal\" sino \"¿en qué momento del video SÍ te parecés?\". Ese momento contiene la respuesta. Es mucho más productivo que pedirle una lista de defectos, porque la gente reconoce su cara pero no la sabe describir.\n\nPARA MAKO: en el flujo de feedback, en vez de un campo libre de \"qué está mal\", ofrecer marcar el SEGUNDO del video donde más se parece y el segundo donde menos. La diferencia entre esos dos frames es el dato.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 7,
    "grupo": "Guion",
    "titulo": "El guion trae el registro de donde se transcribió",
    "cardDesc": "Después de clonar la voz, ajustar todos los parámetros y probar tres clones distintos, el avatar seguía sonando a lectur",
    "videoId": null,
    "resumen": "Después de clonar la voz, ajustar todos los parámetros y probar tres clones distintos, el avatar seguía sonando a lectura. La causa no estaba en ninguna de esas capas: estaba en el TEXTO.\n\nEl guion se había transcripto de un anuncio ya publicado del cliente. Ese anuncio es su registro ACTUADO: oraciones cerradas, sin muletillas, sin conectores de habla. Se le estaba pidiendo al generador que leyera texto de anuncio y después nos quejábamos de que sonaba a anuncio.\n\nMedido sobre 1.710 palabras de habla natural de la misma persona (notas de voz) contra su anuncio publicado:\n\n- \"pues\": 0 en el anuncio, 18 hablando normal (1 cada 95 palabras)\n- \"entonces\": 0 en el anuncio, 14 hablando normal\n- \"¿no?\" de cierre: 0 en el anuncio, presente hablando normal\n- \"este\": 0 en el anuncio, 7 hablando normal\n\nY LA FIRMA MELÓDICA, que es lo que la gente oye como \"su cantito\": el tono le sube más de 3 semitonos sobre su mediana EN EL CONECTOR QUE ABRE LA FRASE, no en la palabra importante. \"entonces\" pica el 82% de las veces que lo dice, \"y\" el 72%. Arranca arriba y desciende a lo largo de la oración.\n\nCONSECUENCIA DE DISEÑO QUE NO ES OBVIA: si el guion no tiene conectores, el modelo NO TIENE DÓNDE levantar el tono. Un texto de frases que empiezan por el sujeto fuerza una entonación plana por construcción, sin importar qué voz le pongas encima.\n\nREGLA: para que un avatar suene a la persona, el guion se escribe con su habla, no con su prosa. Si la fuente del guion es material actuado, hay que reinyectar los marcadores desde material conversacional del mismo hablante.\n\nORDEN DE ATAQUE: el texto es la primera capa, no la última. Timbre, parámetros del clon y prosodia vienen después. Cuando algo suena a IA, revisar el guion ANTES de tocar el clonador.\n\nOJO CON LA CONCLUSIÓN QUE ESTO CORRIGE: una transcripción verbatim del anuncio dio cero muletillas, y de ahí se concluyó que \"el cliente habla así de limpio\". Era cierto del anuncio y falso de la persona. Cuando midas un rasgo de habla, mirá material CONVERSACIONAL, no material publicado.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 8,
    "grupo": "Guion",
    "titulo": "Los marcadores van por función, no por cuota",
    "cardDesc": "Primer intento de meterle sus muletillas al guion: se hizo una lista de las que usa y se repartieron por el texto hasta ",
    "videoId": null,
    "resumen": "Primer intento de meterle sus muletillas al guion: se hizo una lista de las que usa y se repartieron por el texto hasta llegar a una densidad parecida. Salió mal y el cliente lo marcó al instante: \"exageraste el uso del pues, lo pusiste en lugares que no tienen sentido\".\n\nEl error de método fue trabajar al revés. Se tenía una lista de marcadores y se buscaba dónde meterlos. Lo correcto es al revés: primero se identifica la FUNCIÓN que pide cada punto del texto, y después se busca qué marcador la cumple.\n\nLAS FUNCIONES, sacadas de leer las 14 ocurrencias de cada marcador en su habla real:\n\n- \"pues\" = LA BISAGRA. Va después de un arranque largo (una subordinada, una frase tópica, una pregunta) y ANTES del verbo principal. Nunca en una frase corta y simple. Ejemplo suyo: \"cuando no puede delegar PUES termina siendo el cuello de botella\".\n- \"A ver\" = ABRE UNA EXPLICACIÓN, y una sola vez. Las dos veces que aparece en 11 minutos está al principio de todo.\n- \"¿no?\" = CIERRA algo que da por acordado, y sigue de largo. Mucho más raro de lo que parece: 2 veces en 1.710 palabras. El conteo ingenuo da 36 porque cuenta las negaciones.\n- \"Entonces\" = ABRE LA CONSECUENCIA, cuando ya expuso la situación. Es el más frecuente: 14 veces.\n- \"Mira\" = INTERPELA DIRECTO. Sirve en el CTA, que suele ser lo único que le habla al espectador.\n\nY LOS MARCADORES QUE NO SON SUYOS TAMBIÉN VALEN, si la función lo pide. El guion abría una ANÉCDOTA y se le había puesto \"A ver\", que abre explicaciones. El cliente propuso \"El otro día\", que no está en su lista medida pero cumple la función exacta. Es mejor.\n\nREGLA DE DESEMPATE: cuando dos marcadores cumplen la misma función, gana el que la persona ya usa.\n\nDENSIDAD: apuntar a su frecuencia natural medida, o como mucho al doble en piezas cortas donde hay que notarlo. Al triple lee como parodia.\n\nDEJAR ESCENAS LIMPIAS es parte del trabajo. Si no hay bisagra, no va \"pues\". Un CTA va directo.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 9,
    "grupo": "Guion",
    "titulo": "La duración sale del texto: 3 palabras por segundo",
    "cardDesc": "Un clip generado más largo que su texto NO deja silencio al final: el modelo rellena el tiempo repitiendo sílabas. Suena",
    "videoId": null,
    "resumen": "Un clip generado más largo que su texto NO deja silencio al final: el modelo rellena el tiempo repitiendo sílabas. Suena a tartamudeo en medio de una frase.\n\nLA MEDIDA: 3 palabras por segundo. A 14 palabras les corresponden ~4,7 segundos.\n\nLA TOLERANCIA: se aguanta hasta ~1,5 segundos de cola sobrante. Medido: 14 palabras en un clip de 8 s (3,3 s de sobra) tartamudea; las mismas 14 en uno de 6 s (1,3 s de sobra) no.\n\nSi sobra más, bajar un escalón de duración. Si falta, subir uno.\n\nY AL REVÉS TAMBIÉN IMPORTA: cuando los clips se generan un escalón más largos de lo que pide el guion, aparece cola muerta con ambiente, que después complica el recorte automático (ver la lección de los cortes).\n\nCADA CLIP CIERRA EN UN REMATE. Ninguno deja una frase abierta esperando el siguiente. El corte va donde termina la idea, no donde se acaba el tiempo — si no, el montaje suena a rompecabezas.\n\nPARA MAKO: la duración de cada clip se CALCULA del texto, no se elige. Y el sistema debería avisar cuando un bloque de guion no entra en ninguna duración disponible, en vez de dejar que el usuario lo descubra en el render.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 10,
    "grupo": "Guion",
    "titulo": "La dirección de actuación va en pocas escenas, no en todas",
    "cardDesc": "Se escribió dirección de actuación en las 12 escenas: \"landing hard and flat\", \"lifting his pitch on\", \"starting high on",
    "videoId": null,
    "resumen": "Se escribió dirección de actuación en las 12 escenas: \"landing hard and flat\", \"lifting his pitch on\", \"starting high on the opening word\", \"picking up pace\". Cada línea, razonable por separado.\n\nEl resultado medido: el 18,7% de las palabras con un pico de énfasis, contra el 9,5% de la persona real. El doble. Y la percepción del cliente fue que NO había énfasis.\n\nPOR QUÉ: el énfasis es CONTRASTE, y el contraste necesita una base plana. Si una de cada cuatro palabras sube, ninguna sobresale. La persona real sube en una de cada diez, y por eso cuando lo hace se nota.\n\nEs el mismo error que con el contraste de la imagen y con la luz del auto: pedirlo en todos lados es no pedirlo en ninguno.\n\nLA REGLA: dirección de actuación en 3 o 4 escenas de 12 — las de los remates y el CTA — y entrega pareja pedida EXPLÍCITAMENTE en el resto. La base plana hay que escribirla, no dejarla por omisión.\n\nCÓMO SE MIDE, que es la parte que casi nos hace corregir para el lado equivocado: NO con el desvío estándar del tono. Esa métrica decía que la salida tenía MÁS variación que la persona real (7,06 semitonos contra 4,70) mientras el cliente decía que no tenía agudos, y los dos tenían razón. Lo que hay que medir es el PICO LOCAL: cuánto excede cada palabra la mediana de las cuatro que la rodean. Variación global alta con picos locales mal repartidos es ruido, no expresión.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 11,
    "grupo": "Voz",
    "titulo": "Speech-to-speech: qué hace, qué no, y por qué no hay que resincronizar labios",
    "cardDesc": "La creencia de partida era que cambiar la voz rompe el lip-sync, y que por eso hacía falta una herramienta que resincron",
    "videoId": null,
    "resumen": "La creencia de partida era que cambiar la voz rompe el lip-sync, y que por eso hacía falta una herramienta que resincronizara los labios. Es falso para este caso, y por una razón estructural.\n\nSpeech-to-speech NO es texto-a-voz: es conversión de TIMBRE que preserva el ritmo, las pausas y la entonación del audio de entrada. El video tiene los labios animados para ese ritmo exacto. Si el ritmo no cambia, los labios siguen coincidiendo.\n\nMEDIDO sobre 100 segundos: duración de entrada 100,625 s y de salida 100,635 s (10 ms). Desfase mediano 0 ms, máximo 30 ms, 0 de 50 tramos por encima de 80 ms. Palabras: 289 entran, 289 salen.\n\nLO QUE SÍ HACE: cambia el timbre, y aporta parte de la prosodia del clon.\nLO QUE NO HACE: no inventa interpretación. Copia la del audio de entrada, errores incluidos. Si el generador de video pronunció mal una palabra, la conversión la reproduce igual de mal.\n\nEL INTERCAMBIO QUE DECIDE TODO EL PIPELINE: lo que regala el lip-sync gratis es lo mismo que encierra en la actuación del generador. Si la persona graba el guion con su risa y sus acentos reales, el ritmo cambia entero y los labios dejan de servir — ahí sí hace falta un resincronizador. Actuación humana real y lip-sync gratis no se pueden tener juntos.\n\nGOTCHA IMPORTANTE: el desfase NO es determinista. Tres corridas idénticas sobre el mismo audio dieron dos con un tramo corrido 290-310 ms en el mismo punto y una limpia con 10 ms de máximo. Hay que verificar por correlación cruzada y REPETIR la corrida si aparece un tramo malo. Sale más barato que diagnosticarlo.\n\nY CÓMO VERIFICAR: por correlación cruzada de las envolventes de energía, nunca comparando timestamps de palabra. Los timestamps dan falsos positivos de hasta 840 ms sobre audio que en realidad está alineado a 0 ms, porque la alineación del transcriptor es floja en palabras cortas y átonas.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 12,
    "grupo": "Voz",
    "titulo": "Para clonar una voz, el registro pesa más que la duración y la calidad",
    "cardDesc": "Este es el hallazgo más contraintuitivo de toda la producción, y lo encontró el cliente escuchando, no el análisis.",
    "videoId": null,
    "resumen": "Este es el hallazgo más contraintuitivo de toda la producción, y lo encontró el cliente escuchando, no el análisis.\n\nPrimer clon: 97 segundos sacados de un anuncio publicado en Meta, o sea audio recomprimido a 61 kbps y normalizado casi al techo. Se dio por provisorio: era obvio que había que rehacerlo con mejor material.\n\nSegundo clon: 11 minutos limpios grabados con el celular, sin compresión de Meta, con sus muletillas puestas. Más material, mejor señal. Tenía que ganar.\n\nMEDIDO:\n\n- Objetivo (la persona en su anuncio): 139 Hz de tono, 9,5% de palabras con pico de énfasis.\n- Clon del celular (11 min limpios): 105 Hz, 20,1%.\n- Clon del anuncio (97 s a 61 kbps): 137 Hz, 10,9%.\n\nEl clon del material comprimido clava las dos métricas. El del material limpio se va 34 Hz abajo y duplica el énfasis.\n\nLA CAUSA: en el anuncio la persona está ACTUANDO; en el celular está CONVERSANDO. Son dos registros distintos de la misma voz, y el destino del clon es un anuncio.\n\nREGLA: para clonar una voz de anuncio hay que clonar DE anuncios. Pedir \"grabame dos minutos hablando natural\" produce un clon que suena a alguien contando algo, no a alguien vendiendo.\n\nY HAY UN AGRAVANTE QUE VALE COMO ADVERTENCIA APARTE: ese audio de celular lo grabó a las dos de la madrugada. Su voz estaba cansada y más grave. El clon heredó el cansancio. Cuando pidas audio, pedí también CUÁNDO grabarlo.\n\nLO QUE ESTO INVALIDA: la idea de que la compresión del material era el techo del clon. El material limpio da mejor señal y peor registro, y el registro pesó más.\n\nCÓMO DETECTARLO SIN OÍDO: dos números por corrida, tono mediano y porcentaje de palabras con pico local sobre 4 semitonos, contra los mismos dos de la persona real. Si el tono está 30 Hz abajo, el clon salió de material conversacional.\n\nEL MATERIAL DE CLONACIÓN SÍ SIRVIÓ PARA OTRA COSA: de esos 11 minutos salieron sus muletillas y su patrón de entonación, que es lo que hizo el guion. No fue trabajo perdido — fue material para el TEXTO, no para la VOZ.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 13,
    "grupo": "Voz",
    "titulo": "Speech-to-speech suprime el ambiente: hay que devolvérselo",
    "cardDesc": "Con la voz ya convertida, el cliente escuchó \"interrupciones\" en el audio. No eran cortes: era el ambiente entrando y sa",
    "videoId": null,
    "resumen": "Con la voz ya convertida, el cliente escuchó \"interrupciones\" en el audio. No eran cortes: era el ambiente entrando y saliendo.\n\nMEDIDO, comparando el nivel durante el habla contra el nivel en los huecos entre frases:\n\n- Crudo del generador: 16,9 dB de caída (el motor del auto sigue sonando entre frases).\n- Después de speech-to-speech: 33,0 dB de caída.\n\nLa conversión suprime el ambiente 11 dB de más en los huecos. Con voz continua no se nota; en las pausas, el fondo desaparece de golpe y el oído lo lee como un corte.\n\nLA SOLUCIÓN: devolverle la base de ambiente desde el audio original.\n\nCÓMO, sin reintroducir la voz vieja: filtrar el audio crudo por debajo de 120 Hz y mezclarlo debajo de la voz convertida. Ahí vive el retumbe del motor y casi nada de voz. Se probaron cuatro cortes (120, 180, 250 y 400 Hz) midiendo cuánta voz se cuela en cada uno: 120 Hz es el que mejor relación da. A 400 Hz se escucha la voz vieja por debajo como un eco.\n\nEL NIVEL: se ajusta hasta que la caída habla/huecos vuelva a la del crudo. En el caso medido, ganancia 1,6 dejó una caída de 17,2 dB contra los 16,9 originales.\n\nEL FLAG QUE NO ES OPCIONAL: amix por defecto viene con normalize=true, que DIVIDE cada entrada. Mezclando tres pistas la voz sale 9 dB más baja sin que nada lo avise. Siempre normalize=0.\n\nY ESTO NO ES UN DEFECTO A ESCONDER: el ambiente es lo que hace que el clip parezca grabado y no generado. El cliente lo dijo mejor: \"mejor si tiene sonido de ambiente, es justamente lo que lo hace más natural y humano\".",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 14,
    "grupo": "Montaje",
    "titulo": "El detector de silencio devuelve VACÍO, no error",
    "cardDesc": "Para unir los clips hay que recortarles el aire de las puntas. La herramienta estándar es el detector de silencio de ffm",
    "videoId": null,
    "resumen": "Para unir los clips hay que recortarles el aire de las puntas. La herramienta estándar es el detector de silencio de ffmpeg. Sobre 12 clips grabados dentro de un auto NO DETECTÓ NADA. Ni a -32 dB ni a -35. Sin advertencia, sin excepción: salida vacía, que se lee igual que \"no hay silencios que cortar\".\n\nLA CAUSA: el clip tiene motor y ruido de calle de punta a punta. El piso de ruido está en -30 dB y la voz en -18. Nunca hay silencio DIGITAL, así que un umbral absoluto no separa nada.\n\nEl error de fondo fue creer que \"silencio\" es una propiedad de la señal, cuando es RELATIVO a ese clip.\n\nEste es el patrón de falla más peligroso que apareció en toda la producción: una herramienta que devuelve vacío en vez de error. El código de arriba lo interpreta como \"no hay nada que hacer\" y sigue.\n\nREGLA: cuando una herramienta de audio devuelve vacío, la primera hipótesis es que el umbral está mal calibrado, no que no haya nada.\n\nPARA MAKO: cualquier paso automático que pueda devolver \"nada\" tiene que distinguir entre \"medí y no hay\" y \"no pude medir\". Si no distingue, el pipeline entrega material sin procesar y nadie se entera.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 15,
    "grupo": "Montaje",
    "titulo": "Los cortes se anclan en la palabra — y cada fuente miente en un caso distinto",
    "cardDesc": "Segundo intento de recortar el aire: medir la envolvente de energía por percentiles del propio clip y cortar donde cae. ",
    "videoId": null,
    "resumen": "Segundo intento de recortar el aire: medir la envolvente de energía por percentiles del propio clip y cortar donde cae. Pareció funcionar — quitó 5,6 s de 102. PERO 4 DE ESOS SEGUNDOS ERAN HABLA. En 6 de 12 clips el corte cayó antes de que terminara la última palabra. Lo detectó el usuario escuchando, no la herramienta.\n\nPOR QUÉ FALLA: la energía de audio NO es la palabra. La \"s\" final de \"tareas\" o la vocal átona de \"semana\" tienen 10-15 dB menos que la vocal tónica, así que caen por debajo de cualquier umbral razonable mientras la persona todavía está hablando. Subir el margen mueve el error, no lo elimina, porque el ancla sigue siendo la energía.\n\nLO QUE FUNCIONA: anclar en la PALABRA. Transcribir cada clip pidiendo timestamps por palabra y cruzar eso con la envolvente.\n\nPERO CADA FUENTE MIENTE EN UN CASO DISTINTO, y esto es lo importante:\n\n- LA CABEZA DEL TRANSCRIPTOR NO SIRVE. Ancla la primera palabra en 0.00 en 10 de 12 clips. Es un artefacto conocido de la alineación. Para el inicio, usar el mínimo entre ambas fuentes.\n- LA COLA DE LA ENERGÍA MIENTE CUANDO EL CLIP ES MÁS LARGO QUE EL TEXTO. Si el clip se generó un escalón más largo, queda cola de ambiente que la energía lee como señal. En una tanda, la energía marcaba habla 3,4 segundos después de la última palabra.\n- LA COLA DEL TRANSCRIPTOR MIENTE CUANDO SE QUEDA CORTO, que pasa cuando el clip está bien ajustado al texto.\n\nEL CRITERIO QUE RESUELVE LAS DOS: si la energía marca el final más de 0,5 s después que la última palabra, hay que VERIFICAR qué hay ahí — transcribir solo esa cola. Si el transcriptor devuelve una palabra suelta sin sentido, es ambiente y se corta por la palabra.\n\nLA FIRMA DE LA COLA MUERTA: el transcriptor alucina palabras sobre audio sin habla. En una tanda devolvió \"¡Hipo!\", \"Teresa\" y \"Gracias\" en las colas de tres clips distintos. Esas alucinaciones no son un problema: son la SEÑAL de que ahí no hay nadie hablando.\n\nY EL MARGEN: 0,25 s a cada lado. Menos que eso se come sílabas.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 16,
    "grupo": "Montaje",
    "titulo": "Un recorte sin diff de palabras no está terminado, está sin probar",
    "cardDesc": "El montaje que se comió palabras se entregó igual, y lo encontró el cliente. La verificación que faltaba cuesta una llam",
    "videoId": null,
    "resumen": "El montaje que se comió palabras se entregó igual, y lo encontró el cliente. La verificación que faltaba cuesta una llamada al transcriptor.\n\nEL MÉTODO: transcribir el montaje final y comparar la secuencia de palabras contra la concatenación de las transcripciones de los clips originales. Comparación sobre tokens normalizados (minúsculas, sin tildes, sin puntuación) con un diff de secuencias.\n\nSi falta una palabra, no sale.\n\nMEDIDO en el montaje corregido: 289 esperadas, 289 presentes, 99,65% de similitud. La única diferencia fue \"hasta\" contra \"esta\", que es ambigüedad del transcriptor sobre el mismo audio, no una pérdida.\n\nCÓMO LEER EL DIFF, que no es obvio:\n- Palabras FALTANTES en el medio de un clip NO pueden ser del recorte (el recorte solo toca las puntas). Son variación del transcriptor.\n- Palabras faltantes al borde de un clip SÍ son sospechosas.\n- Palabras DE MÁS en el montaje son normales y buena señal: el transcriptor oye mejor con más contexto.\n\nY EL COROLARIO QUE AHORRA REGENERACIONES: verificar marcadores sobre CLIPS AISLADOS da falsos negativos. Pasó dos veces. Un \"pues\" que el transcriptor no oyó en un clip suelto de 10 segundos apareció perfecto en el montaje completo, y un \"¿no?\" igual. Los marcadores se verifican SIEMPRE sobre el montaje.\n\nPARA MAKO: este diff es barato y automatizable. Debería correr solo después de cada montaje y bloquear la entrega si falta una palabra, en vez de dejar que el cliente lo escuche.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 17,
    "grupo": "Montaje",
    "titulo": "Escuchar QUÉ dijo, no solo cómo se ve",
    "cardDesc": "En la primera tanda, el generador dijo \"hablo\" donde el guion decía \"instalo\". En otra dijo \"incodó\" en vez de \"incomodó",
    "videoId": null,
    "resumen": "En la primera tanda, el generador dijo \"hablo\" donde el guion decía \"instalo\". En otra dijo \"incodó\" en vez de \"incomodó\". Los dos errores pasaron el montaje completo, la conversión de voz y la entrega sin que nadie los notara, porque todo el mundo estaba mirando la cara.\n\nSon errores del generador de video, no del clonador de voz ni del montaje. La conversión los reproduce fielmente porque hace exactamente eso: copia lo que le das.\n\nLA VERIFICACIÓN: transcribir cada clip y compararlo con el texto del guion, palabra por palabra. Diez segundos de máquina contra un anuncio publicado con una palabra mal.\n\nQUÉ MIRAR EN EL DIFF:\n- Palabras cambiadas: el generador se comió sílabas o inventó una palabra parecida. Se regenera ese clip.\n- Marcadores faltantes: verificar sobre el montaje antes de regenerar, por los falsos negativos.\n- Números escritos distinto (\"7\" contra \"siete\"): es formato del transcriptor, no un error.\n\nTRUCO PARA LA REGENERACIÓN: si el generador se come una palabra concreta dos veces seguidas, darle un respiro con una coma antes. \"que siempre instalo, en todas las empresas\" funcionó donde \"que siempre instalo en todas las empresas\" fallaba.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 18,
    "grupo": "Soporte y expectativas",
    "titulo": "La mayoría de las quejas son del input, no del modelo",
    "cardDesc": "Esta es la lección que gobierna cómo MaKo tiene que responder cuando un usuario dice \"esto no se parece a mí\".",
    "videoId": null,
    "resumen": "Esta es la lección que gobierna cómo MaKo tiene que responder cuando un usuario dice \"esto no se parece a mí\".\n\nEn esta producción hubo dos clases de problema, y conviene no confundirlas:\n\nCULPA NUESTRA (método o prompt), y todas tuvieron arreglo:\n- Encadenar generaciones sin control (IA sobre IA).\n- Pedir el acento equivocado. Se le pidió acento de Ciudad de México a un cliente norteño durante toda una tanda.\n- Describir la cara con palabras compitiendo con la foto.\n- Pedir énfasis en todas las escenas.\n- Elegir la variante de luz de alto contraste para un interior.\n- Cortar el audio por energía y comerse palabras.\n\nCULPA DEL INPUT, y ahí no hay prompt que lo salve:\n- Audio grabado a las 2 de la madrugada: el clon hereda el cansancio y sale 34 Hz más grave.\n- Audio grabado conversando cuando el destino es un anuncio: registro equivocado.\n- Foto con otra persona en el cuadro, o con un cartel tapando el torso, o de espaldas a una ventana.\n- Foto donde la persona está seria cuando su cara \"funciona\" sonriendo.\n- Tres fotos con encuadres distintos pasadas juntas como referencia.\n\nLA CLAVE PARA EL PRODUCTO: cuando un usuario reclama, no discutir. MOSTRARLE EL INPUT AL LADO DEL OUTPUT. Si tiene razón, se corrige el método. Si el problema es el material que cargó, lo va a ver solo — y con evidencia, no con una explicación.\n\nEsto no es para ganarle una discusión al cliente. Es para que el ciclo de corrección apunte al lugar correcto: se perdieron horas ajustando prompts cuando el problema era el audio de las 2 AM, y se perdieron créditos regenerando clips cuando el problema era el acento.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 19,
    "grupo": "Soporte y expectativas",
    "titulo": "Gatear el input antes de generar, no después",
    "cardDesc": "Todo lo que sale mal por el input se puede detectar ANTES de gastar un crédito. Son chequeos baratos, casi todos medible",
    "videoId": null,
    "resumen": "Todo lo que sale mal por el input se puede detectar ANTES de gastar un crédito. Son chequeos baratos, casi todos medibles sin IA.\n\nPARA LA FOTO:\n- ¿Hay más de una cara en el cuadro? Rechazar o recortar.\n- ¿La cara ocupa menos de X% del cuadro? Muy chica para ser fuente de identidad.\n- ¿Está muy oscura o a contraluz? Medir el histograma de la región de la cara.\n- ¿Está fuera de foco? Medir la varianza del laplaciano.\n- ¿Es una imagen generada? Si vino de nuestro propio flujo, lo sabemos: marcarla y no dejar usarla como ancla.\n- ¿Está sonriendo? Preguntarle al usuario si su cara \"funciona\" mejor sonriendo, que es un dato que él sabe y nosotros no.\n\nPARA EL AUDIO:\n- Duración mínima. Menos de 60 segundos no alcanza.\n- Tono mediano contra el de otro material suyo, si lo hay. Una diferencia grande delata cansancio o registro distinto.\n- Piso de ruido y presencia de música. Una base musical arruina el clon.\n- ¿Cuántos hablantes? Si hay diálogo, no sirve.\n- Bitrate y recompresión. Se puede usar material comprimido, pero conviene saberlo.\n- Y LA PREGUNTA QUE MÁS AHORRA: \"¿este audio es de vos hablando como hablarías EN UN ANUNCIO, o conversando?\". El registro no se puede medir sin contexto, pero se puede preguntar.\n\nEL PRINCIPIO: cada uno de estos chequeos existe porque ya nos costó una tanda de créditos o una llamada incómoda. El costo de pedirle al usuario que regrabe es mucho menor que el de producir 12 clips con material equivocado.\n\nY CÓMO PEDIRLO, que importa tanto como el chequeo: no con una lista de requisitos técnicos. Con un ejemplo de foto buena y uno de foto mala al lado, y el chequeo corriendo en vivo mientras sube el archivo.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 20,
    "grupo": "Soporte y expectativas",
    "titulo": "El protocolo de la queja: comparar, no discutir",
    "cardDesc": "Cuando el usuario dice \"no se parece\", la conversación productiva tiene una forma concreta. Esta es, paso por paso.",
    "videoId": null,
    "resumen": "Cuando el usuario dice \"no se parece\", la conversación productiva tiene una forma concreta. Esta es, paso por paso.\n\n1) NO PEDIR UNA LISTA DE DEFECTOS. La gente reconoce su cara pero no la sabe describir. Preguntar \"¿qué está mal?\" produce respuestas vagas y contradictorias.\n\n2) PREGUNTAR DÓNDE SÍ SE PARECE. \"Marcá el segundo donde más te parecés y el segundo donde menos.\" La diferencia entre esos dos frames contiene el diagnóstico. Así apareció el hallazgo de la sonrisa, que resolvió cinco quejas de una.\n\n3) PONER EL INPUT AL LADO DEL OUTPUT. La foto que subió contra el frame generado, en la misma pantalla. En esta producción el cliente pidió exactamente eso y lo dijo así: \"necesito verlas las dos al mismo tiempo\". Recién ahí pudo describir las diferencias con precisión: quijada, cachetes, labios, barba.\n\n4) SEPARAR LO QUE ES DERIVA DE LO QUE ES EL INPUT. Si el frame generado se parece a la foto pero la foto no se parece a la persona, el problema es la foto. Si el frame no se parece a la foto, el problema es nuestro.\n\n5) TRADUCIR SUS PALABRAS A INSTRUCCIONES, sin interpretarlas de más. El cliente dijo \"está más cuadrada la quijada, yo la tengo más redonda con papada\". Eso va casi textual al prompt. No hace falta convertirlo a jerga.\n\n6) UN EJE POR CORRECCIÓN. Si dijo cuatro cosas, no se corrigen las cuatro juntas: ya vimos que el modelo lleva cada instrucción al extremo.\n\nPARA MAKO: esto es una pantalla, no un instructivo. Input y output lado a lado, un selector de \"acá sí / acá no\" sobre la línea de tiempo, y los chequeos de calidad del input visibles con su resultado. La mayoría de las veces esa pantalla cierra el reclamo sin que intervenga nadie.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 21,
    "grupo": "Construirlo en MaKo",
    "titulo": "Qué está automatizable hoy y qué no",
    "cardDesc": "Balance honesto de todo el pipeline, con lo que ya está probado y lo que falta.",
    "videoId": null,
    "resumen": "Balance honesto de todo el pipeline, con lo que ya está probado y lo que falta.\n\nAUTOMATIZABLE HOY, TODO POR CÓDIGO:\n- El montaje: unir los clips y recortar el aire. ffmpeg, cero costo por uso. Probado.\n- La voz: clonar y convertir por API de ElevenLabs. Probado, con verificación de lip-sync incluida.\n- Devolver el ambiente: filtro y mezcla con ffmpeg. Probado.\n- Los subtítulos quemados: transcripción con timestamps por palabra, generar un archivo ASS con etiquetas de karaoke, quemar con libass. Costo por anuncio: menos de un centavo.\n- El degradado de realismo en post: cadena de filtros de ffmpeg. Valores documentados.\n\nNO AUTOMATIZABLE HOY:\n- La generación de los clips. La herramienta que se usó no tiene API. Habría que ir por la API del modelo directamente, que es otro proveedor y otro costo.\n- La música. Es un problema legal antes que técnico: las licencias por creador prohíben redistribuir el archivo, que es exactamente lo que hace un producto al entregar el render. La vía limpia (API de partner con sublicencia) existe pero no publica precio. Hoy, la pone el usuario.\n- El juicio sobre si el avatar se parece. Eso lo decide una persona mirando.\n\nLO QUE NO HAY QUE PROMETER: \"MaKo arma el anuncio solo\". Automatizar el montaje y la voz automatiza los últimos veinte minutos de un proceso que empieza mucho antes.\n\nEL ORDEN CORRECTO DEL PIPELINE, que no es obvio y se pagó descubrirlo:\n1. Foto real → imagen base, aprobada a ojo.\n2. Variantes de fondo desde esa base.\n3. Los clips.\n4. Montaje y recorte.\n5. La voz.\n6. Los subtítulos, AL FINAL. Se generan escuchando el audio; si se hacen antes del cambio de voz quedan pegados a un audio que deja de existir.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 22,
    "grupo": "Construirlo en MaKo",
    "titulo": "Los frenos concretos que hay en el repo",
    "cardDesc": "Relevado sobre el código real. Esto es lo que falta para que el pipeline viva dentro del producto.",
    "videoId": null,
    "resumen": "Relevado sobre el código real. Esto es lo que falta para que el pipeline viva dentro del producto.\n\n1) NO HAY FFMPEG EN EL RUNTIME. No hay ninguna dependencia de media en package.json. Todo el procesamiento pesado corre hoy en la máquina del desarrollador contra un binario suelto. Y el binario completo pesa 194,7 MB de los 250 MB del bundle estándar del hosting.\n\nLA SALIDA RECOMENDADA: ffmpeg compilado a WebAssembly, corriendo EN EL NAVEGADOR del cliente. Cero infraestructura, cero costo por uso, y el archivo nunca sale de su máquina. El precedente ya existe en el repo: la nota de voz de WhatsApp se transcodifica en el cliente antes de mandarla. El costo honesto: la variante multihilo exige aislamiento cross-origin, que rompería recursos embebidos de terceros; hay que arrancar monohilo y medir.\n\n2) LA TRANSCRIPCIÓN DESCARTA LOS TIMESTAMPS POR CONTRATO DE TIPO. Se pide el formato detallado pero nunca la granularidad por palabra, y el tipo de retorno no tiene campo para las palabras: aunque llegaran, se tiran. Son dos líneas en el form y dos campos en el tipo.\n   OJO: el modelo tiene que seguir siendo el que soporta granularidad por palabra. Migrar a un modelo más nuevo \"por modernizar\" rompe los subtítulos en silencio.\n   Y NO se reusa la cascada barata de IA: arranca por un proveedor cuyo prompt prohíbe explícitamente devolver timestamps.\n\n3) NO HAY DÓNDE GUARDAR EL RESULTADO. El guion se guarda como campos planos de texto dentro de un JSON único; un binario no entra ahí. Hace falta una tabla propia referenciada por el id del guion, siguiendo el precedente de otras migraciones del repo. Nada dentro del JSON existente.\n\n4) FALTA UN ESTADO. El guion salta de \"grabado\" a \"publicado\" sin nada en el medio. Si el montaje es un paso del producto, va un estado ahí.\n\n5) LIBASS NO AVISA CUANDO LE FALTA LA FUENTE. Sale con código de éxito y la tipografía cambiada. Hay que revisar el log de selección de fuente después de cada render, no el código de salida. Y no hay ni un archivo de fuente en el repo.\n\n6) DEUDA REAL: los scripts de producción no están versionados. Viven en carpetas sueltas del escritorio. Si se pierde esa carpeta, se pierde la receta.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  },
  {
    "n": 23,
    "grupo": "Método",
    "titulo": "Las trampas de medición que casi nos hacen corregir para el lado equivocado",
    "cardDesc": "Cuatro veces en esta producción la medición dijo lo contrario de lo que pasaba. Vale la pena tenerlas juntas, porque el ",
    "videoId": null,
    "resumen": "Cuatro veces en esta producción la medición dijo lo contrario de lo que pasaba. Vale la pena tenerlas juntas, porque el patrón se repite.\n\n1) VARIACIÓN GLOBAL DE TONO CONTRA ÉNFASIS. La métrica decía que la voz generada tenía MÁS variación que la persona real (7,06 semitonos contra 4,70) mientras el cliente decía que no tenía agudos. Los dos tenían razón: el énfasis es un PICO LOCAL, no dispersión global. Medir cuánto excede cada palabra a sus vecinas inmediatas, no el desvío de todo el audio.\n\n2) TIMESTAMPS DE PALABRA CONTRA ALINEACIÓN REAL. Para medir si la conversión de voz corrió los labios, comparar timestamps dio 840 ms de desfase máximo y 7,6% de palabras corridas. Era ruido del transcriptor: la correlación cruzada de las envolventes dio 0 ms mediano y 30 ms máximo. Se delató solo — un corrimiento de 840 ms con la duración total idéntica exigiría que el audio se comprima y se estire. Para medir tiempo, usar la forma de onda; los timestamps de un modelo sirven para saber QUÉ se dijo, no exactamente CUÁNDO.\n\n3) MÁS MATERIAL DE CLONACIÓN CONTRA MEJOR CLON. Once minutos limpios perdieron contra 97 segundos comprimidos, porque el registro pesa más que la cantidad. La métrica de \"cantidad de audio\" no predice nada.\n\n4) SILENCIO DIGITAL CONTRA AUSENCIA DE HABLA. El detector de silencio no encontró nada en 12 clips que tenían segundos de aire, porque el motor del auto nunca baja del umbral. Y al revés, la energía marcó habla donde solo había ambiente.\n\nEL PATRÓN COMÚN: la métrica medía algo real, pero no lo que importaba. Antes de confiar en un número, preguntarse qué percibe realmente la persona que va a juzgar el resultado, y buscar el número que mida ESO.\n\nY LA REGLA PRÁCTICA: cuando la medición contradice al oído o al ojo de alguien que conoce el material, la medición está midiendo mal. El cliente que dice \"no me parezco\" tiene razón aunque los números digan otra cosa; lo que falta es la métrica correcta.",
    "transcripcion": [],
    "recursoSlugs": [],
    "herramientas": []
  }
],
};
