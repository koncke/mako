// =============================================================================
// curso-avatar — "Avatares de IA que se parecen" (área 'producto')
// =============================================================================
// Todo lo aprendido produciendo a mano los primeros anuncios con avatar de IA de
// un cliente real (Mauricio Bustos, agosto 2026): imagen, guion, voz y montaje.
// Cada lección sale de un error que ya pagamos o de una medición que hicimos.
//
// Vive en area='producto' igual que curso-producto: FUERA del RAG general, para
// que no contamine lo que MaKo le responde a un dueño de negocio.
//
// Se siembra con scripts/seed-curso-avatar.mjs (idempotente por curso).
// El detalle técnico con rutas y números vive en docs/hallazgos-generativa.md.

export const CURSO_AVATAR = 'Avatares de IA que se parecen';

export type LeccionAvatar = { titulo: string; categoria: string; cuerpo: string };

export const CURSO_AVATAR_LECCIONES: LeccionAvatar[] = [
  {
    titulo: 'La regla de oro: nunca referencies IA con IA',
    categoria: 'Identidad',
    cuerpo: `El error más caro de toda la producción, y el que más veces se repitió.

La cadena que parecía razonable era: foto real → hoja de identidad generada (character sheet) → imagen de escena generada → clip de video. Cuatro eslabones, tres de ellos generativos. El resultado fue otra persona: cara distinta, cámara equivocada, y a veces el modelo reproduciendo la propia grilla de referencia.

La causa es acumulativa. Cada generación es una INTERPRETACIÓN del material que recibe. Pedirle a un modelo que interprete la interpretación de otro modelo multiplica la deriva, y nadie mira los pasos intermedios. Lo detectó el cliente, no la herramienta: sacó la grilla, dejó solo su foto real, y salió bien a la primera.

LA REGLA: la fuente de identidad es SIEMPRE una foto real de la persona. El character sheet es un refuerzo opcional para ángulos que la foto no muestra — nunca el ancla.

EL MATIZ, que importa para el producto: la regla no es "cero generaciones", es "cero saltos sin control". Un solo salto (foto real → imagen de escena) es aceptable SI un humano aprueba esa imagen antes de que se propague a los 12 clips. Lo que rompe es encadenar generaciones que nadie verificó.

Y COROLARIO: menos referencias es mejor. Pasarle tres fotos distintas al modelo son tres encuadres distintos entre los que elige o promedia — por eso cada toma salía con otro ángulo. Una sola referencia.

PARA MAKO: cualquier flujo que encadene generación sobre generación acumula deriva en cada salto. El diseño correcto ancla CADA salto en el material real del cliente, no en la salida anterior. Y si un paso intermedio se guarda, se guarda con la marca de que es material generado, para no reusarlo como fuente.`,
  },
  {
    titulo: 'El realismo se pierde en el prompt, no en el render',
    categoria: 'Imagen',
    cuerpo: `Queja típica: "tiene demasiada calidad, parece cine y no un celular". La reacción instintiva es agregar una capa de degradado en post. Casi siempre es tarde.

El método 6C de AvatarHype, que es el que se usa para escribir estos prompts, tiene un componente de luz (C5) que dice TEXTUALMENTE "Always include direct harsh iPhone flash" y "Use high contrast when appropriate". Si el clip se generó con el 6C tal cual, el exceso de contraste lo pidió el método. No es un error del modelo.

Arreglar eso en post es pelear contra píxeles ya quemados: un highlight reventado no tiene información que recuperar.

EL ANTÍDOTO está en el mismo curso, para el mismo escenario (una persona hablando dentro de un auto):

"Natural iPhone photo with soft ambient daylight, no dramatic flash, low contrast, muted tones, slight grain, authentic smartphone exposure, realistic shadows, candid UGC vibe."

Esa línea reemplaza al C5 por defecto siempre que sea interior, auto o luz natural. El C5 original sirve para nocturno, fiesta, flash duro.

EL REPARTO ENTRE PROMPT Y POST:
- Va en el prompt (el render no lo inventa estable): piel con poros, dirección y dureza de la luz, encuadre descentrado, rolling shutter y autofocus hunting (para esos dos no existe filtro de ffmpeg), y el negative prompt.
- Va en el post: grano temporal, bajar contraste y saturación, rango dinámico corto, quitar filo, deriva de exposición, temblor de mano, viñeteo suave y compresión.
- Lo único que va en los dos lados es el grano.

TRAMPA: no copiar las recetas de "look TikTok" que circulan. La más citada sube el contraste y sube la nitidez, o sea empeora exactamente las dos quejas típicas del material generado.

REGLA: antes de escribir una capa de post, leer el prompt. Elegir mal la variante de luz es el error más caro porque no se puede deshacer.`,
  },
  {
    titulo: 'No describas la cara con palabras: compite con la foto',
    categoria: 'Imagen',
    cuerpo: `Un prompt que decía "hombre de unos 55 años, pelo gris corto, lentes de marco fino" acompañado de una foto real devolvió a OTRA PERSONA: alguien que cumplía la descripción sin ser el cliente.

La causa: la descripción textual COMPITE con la imagen de referencia, y el modelo prefiere el texto. El propio método 6C lo dice y es fácil de violar sin darse cuenta: "Do not invent hidden traits that cannot be observed" y "Preserve the visible identity and facial characteristics when a reference image is supplied".

EL REPARTO CORRECTO: el texto describe la ESCENA y la CÁMARA. La foto define la CARA.

Y la cámara hay que describirla con precisión, porque si no el modelo elige mal: "selfie con el brazo estirado" y "visto desde el asiento del acompañante" son tomas opuestas. Cuando la referencia es un selfie y el prompt no lo dice, sale una toma de tercera persona que no se parece en nada.

LA EXCEPCIÓN, y es angosta: cuando el modelo YA está derivando la cara de forma consistente en la misma dirección, se le puede poner un bloque corto que corrija solo esas derivas concretas, nombradas por el propio cliente. No una descripción completa de la cara: una lista de correcciones.

PARA MAKO: el prompt que arme el sistema nunca debe incluir rasgos físicos derivados de texto. Si el usuario cargó una foto, la foto manda. Si el usuario escribió "soy morocho de barba", eso NO va al prompt de imagen — va, como mucho, a validar que la foto que subió sea de él.`,
  },
  {
    titulo: 'Un cambio por vez, y con techo: repetir un concepto lo intensifica',
    categoria: 'Imagen',
    cuerpo: `Tres correcciones seguidas salieron al extremo opuesto del problema, una tras otra:

1. Se pidió des-perfeccionar la piel con ocho instrucciones de envejecimiento juntas (arrugas, ojeras, piel floja, cara más angosta, pómulos marcados, más canas, pelo despeinado). Devolvió a un señor enfermo de 70 años. Peor: una de esas líneas tocaba la ESTRUCTURA ÓSEA, que es identidad, no textura.

2. Se pidió luz direccional describiendo la sombra en cinco frases. Devolvió el habitáculo casi negro.

3. Se pidió ventanilla quemada con seis sinónimos (washed out, low contrast, pale, hazy, glare, never crisp). Devolvió niebla.

EL PATRÓN: con estos modelos, cada sinónimo es otro voto en la misma dirección. Nombrar un concepto cinco veces no lo hace más preciso, lo hace más extremo.

LAS DOS REGLAS QUE QUEDAN:

A) Se nombra una vez, y con el límite en la MISMA oración. No "washed out, pale, hazy, low contrast" sino "a little brighter and softer than the interior, but still clearly readable, with normal colour. No haze, no fog".

B) Un eje por corrección, y siempre volviendo a la imagen original — no encadenando sobre el resultado anterior, que ya viene desviado.

Y NUNCA se toca en una pasada de des-perfección: hueso, pelo, edad y expresión. Eso es identidad. La textura de la piel sí.`,
  },
  {
    titulo: 'El prompt resetea todo lo que no nombra',
    categoria: 'Imagen',
    cuerpo: `Sobre una imagen ya aprobada, con su ventanilla quemada y su fondo desenfocado, se corrió un prompt para cambiar la calle. Volvió con la calle nueva y CON TODO EL TRATAMIENTO FOTOGRÁFICO PERDIDO: nítida, bien expuesta, todo enfocado.

Después se corrió otro para la luz. Volvió con la luz bien y sin la ventanilla quemada ni el desenfoque.

No es un bug: el modelo no "conserva" lo que no le mencionas. Re-renderiza con sus defaults todo lo que el prompt no fija.

LA REGLA: en cualquier prompt de cambio sobre una imagen, hay que REPETIR el tratamiento fotográfico completo aunque no lo estés cambiando. Vale para variantes de fondo, cambios de ropa, correcciones de piel y cualquier retoque posterior.

Esto choca de frente con la regla de "un eje por vez" y hay que resolverlo así: se cambia UN eje, pero se DECLARAN todos. El prompt largo no es el problema; el problema es pedir varios cambios a la vez.

PARA MAKO: si el producto ofrece "cambia el fondo" o "cambia la ropa" como acción de un clic, el prompt que se manda por debajo tiene que arrastrar el bloque de tratamiento de la imagen original. Guardar ese bloque junto con la imagen, no reconstruirlo.`,
  },
  {
    titulo: 'La sonrisa devuelve los rasgos (y lo descubrió el cliente)',
    categoria: 'Imagen',
    cuerpo: `El cliente, comparando la imagen base con el video generado a partir de ella, dijo algo que resolvió media producción:

"Cuando lo veo en foto sí se parece, pero cuando le pongo play, de repente cambia, y es el tema ese de la sonrisa. Cuando estoy riendo se hace más redondito esto, se hace más pronunciado mis cachetes, se hace más redonda la papada. Ahí se parece más a las fotos."

Eso explica de una todas sus otras quejas — quijada cuadrada en vez de redonda, cachetes flacos, papada perdida, cara más angosta. No eran deriva aleatoria: son exactamente los rasgos que APARECEN cuando sonríe y DESAPARECEN cuando está en reposo. El modelo, al animar, le entrega una versión neutra y estirada.

LA REGLA: si la persona es de sonrisa fácil, la foto de referencia tiene que ser sonriendo, y el prompt tiene que sostener la sonrisa mientras habla:

"He keeps a light, easy smile throughout, the way he naturally speaks — never a neutral or slack expression."

MÁS EN GENERAL: cuando alguien dice "no me parezco", la pregunta útil no es "qué está mal" sino "¿en qué momento del video SÍ te pareces?". Ese momento contiene la respuesta. Es mucho más productivo que pedirle una lista de defectos, porque la gente reconoce su cara pero no la sabe describir.

PARA MAKO: en el flujo de feedback, en vez de un campo libre de "qué está mal", ofrecer marcar el SEGUNDO del video donde más se parece y el segundo donde menos. La diferencia entre esos dos frames es el dato.`,
  },
  {
    titulo: 'El guion trae el registro de donde se transcribió',
    categoria: 'Guion',
    cuerpo: `Después de clonar la voz, ajustar todos los parámetros y probar tres clones distintos, el avatar seguía sonando a lectura. La causa no estaba en ninguna de esas capas: estaba en el TEXTO.

El guion se había transcripto de un anuncio ya publicado del cliente. Ese anuncio es su registro ACTUADO: oraciones cerradas, sin muletillas, sin conectores de habla. Se le estaba pidiendo al generador que leyera texto de anuncio y después nos quejábamos de que sonaba a anuncio.

Medido sobre 1.710 palabras de habla natural de la misma persona (notas de voz) contra su anuncio publicado:

- "pues": 0 en el anuncio, 18 hablando normal (1 cada 95 palabras)
- "entonces": 0 en el anuncio, 14 hablando normal
- "¿no?" de cierre: 0 en el anuncio, presente hablando normal
- "este": 0 en el anuncio, 7 hablando normal

Y LA FIRMA MELÓDICA, que es lo que la gente oye como "su cantito": el tono le sube más de 3 semitonos sobre su mediana EN EL CONECTOR QUE ABRE LA FRASE, no en la palabra importante. "entonces" pica el 82% de las veces que lo dice, "y" el 72%. Arranca arriba y desciende a lo largo de la oración.

CONSECUENCIA DE DISEÑO QUE NO ES OBVIA: si el guion no tiene conectores, el modelo NO TIENE DÓNDE levantar el tono. Un texto de frases que empiezan por el sujeto fuerza una entonación plana por construcción, sin importar qué voz le pongas encima.

REGLA: para que un avatar suene a la persona, el guion se escribe con su habla, no con su prosa. Si la fuente del guion es material actuado, hay que reinyectar los marcadores desde material conversacional del mismo hablante.

ORDEN DE ATAQUE: el texto es la primera capa, no la última. Timbre, parámetros del clon y prosodia vienen después. Cuando algo suena a IA, revisar el guion ANTES de tocar el clonador.

OJO CON LA CONCLUSIÓN QUE ESTO CORRIGE: una transcripción verbatim del anuncio dio cero muletillas, y de ahí se concluyó que "el cliente habla así de limpio". Era cierto del anuncio y falso de la persona. Cuando midas un rasgo de habla, mira material CONVERSACIONAL, no material publicado.`,
  },
  {
    titulo: 'Los marcadores van por función, no por cuota',
    categoria: 'Guion',
    cuerpo: `Primer intento de meterle sus muletillas al guion: se hizo una lista de las que usa y se repartieron por el texto hasta llegar a una densidad parecida. Salió mal y el cliente lo marcó al instante: "exageraste el uso del pues, lo pusiste en lugares que no tienen sentido".

El error de método fue trabajar al revés. Se tenía una lista de marcadores y se buscaba dónde meterlos. Lo correcto es al revés: primero se identifica la FUNCIÓN que pide cada punto del texto, y después se busca qué marcador la cumple.

LAS FUNCIONES, sacadas de leer las 14 ocurrencias de cada marcador en su habla real:

- "pues" = LA BISAGRA. Va después de un arranque largo (una subordinada, una frase tópica, una pregunta) y ANTES del verbo principal. Nunca en una frase corta y simple. Ejemplo suyo: "cuando no puede delegar PUES termina siendo el cuello de botella".
- "A ver" = ABRE UNA EXPLICACIÓN, y una sola vez. Las dos veces que aparece en 11 minutos está al principio de todo.
- "¿no?" = CIERRA algo que da por acordado, y sigue de largo. Mucho más raro de lo que parece: 2 veces en 1.710 palabras. El conteo ingenuo da 36 porque cuenta las negaciones.
- "Entonces" = ABRE LA CONSECUENCIA, cuando ya expuso la situación. Es el más frecuente: 14 veces.
- "Mira" = INTERPELA DIRECTO. Sirve en el CTA, que suele ser lo único que le habla al espectador.

Y LOS MARCADORES QUE NO SON SUYOS TAMBIÉN VALEN, si la función lo pide. El guion abría una ANÉCDOTA y se le había puesto "A ver", que abre explicaciones. El cliente propuso "El otro día", que no está en su lista medida pero cumple la función exacta. Es mejor.

REGLA DE DESEMPATE: cuando dos marcadores cumplen la misma función, gana el que la persona ya usa.

DENSIDAD: apuntar a su frecuencia natural medida, o como mucho al doble en piezas cortas donde hay que notarlo. Al triple lee como parodia.

DEJAR ESCENAS LIMPIAS es parte del trabajo. Si no hay bisagra, no va "pues". Un CTA va directo.`,
  },
  {
    titulo: 'La duración sale del texto: 3 palabras por segundo',
    categoria: 'Guion',
    cuerpo: `Un clip generado más largo que su texto NO deja silencio al final: el modelo rellena el tiempo repitiendo sílabas. Suena a tartamudeo en medio de una frase.

LA MEDIDA: 3 palabras por segundo. A 14 palabras les corresponden ~4,7 segundos.

LA TOLERANCIA: se aguanta hasta ~1,5 segundos de cola sobrante. Medido: 14 palabras en un clip de 8 s (3,3 s de sobra) tartamudea; las mismas 14 en uno de 6 s (1,3 s de sobra) no.

Si sobra más, bajar un escalón de duración. Si falta, subir uno.

Y AL REVÉS TAMBIÉN IMPORTA: cuando los clips se generan un escalón más largos de lo que pide el guion, aparece cola muerta con ambiente, que después complica el recorte automático (ver la lección de los cortes).

CADA CLIP CIERRA EN UN REMATE. Ninguno deja una frase abierta esperando el siguiente. El corte va donde termina la idea, no donde se acaba el tiempo — si no, el montaje suena a rompecabezas.

PARA MAKO: la duración de cada clip se CALCULA del texto, no se elige. Y el sistema debería avisar cuando un bloque de guion no entra en ninguna duración disponible, en vez de dejar que el usuario lo descubra en el render.`,
  },
  {
    titulo: 'La dirección de actuación va en pocas escenas, no en todas',
    categoria: 'Guion',
    cuerpo: `Se escribió dirección de actuación en las 12 escenas: "landing hard and flat", "lifting his pitch on", "starting high on the opening word", "picking up pace". Cada línea, razonable por separado.

El resultado medido: el 18,7% de las palabras con un pico de énfasis, contra el 9,5% de la persona real. El doble. Y la percepción del cliente fue que NO había énfasis.

POR QUÉ: el énfasis es CONTRASTE, y el contraste necesita una base plana. Si una de cada cuatro palabras sube, ninguna sobresale. La persona real sube en una de cada diez, y por eso cuando lo hace se nota.

Es el mismo error que con el contraste de la imagen y con la luz del auto: pedirlo en todos lados es no pedirlo en ninguno.

LA REGLA: dirección de actuación en 3 o 4 escenas de 12 — las de los remates y el CTA — y entrega pareja pedida EXPLÍCITAMENTE en el resto. La base plana hay que escribirla, no dejarla por omisión.

CÓMO SE MIDE, que es la parte que casi nos hace corregir para el lado equivocado: NO con el desvío estándar del tono. Esa métrica decía que la salida tenía MÁS variación que la persona real (7,06 semitonos contra 4,70) mientras el cliente decía que no tenía agudos, y los dos tenían razón. Lo que hay que medir es el PICO LOCAL: cuánto excede cada palabra la mediana de las cuatro que la rodean. Variación global alta con picos locales mal repartidos es ruido, no expresión.`,
  },
  {
    titulo: 'Speech-to-speech: qué hace, qué no, y por qué no hay que resincronizar labios',
    categoria: 'Voz',
    cuerpo: `La creencia de partida era que cambiar la voz rompe el lip-sync, y que por eso hacía falta una herramienta que resincronizara los labios. Es falso para este caso, y por una razón estructural.

Speech-to-speech NO es texto-a-voz: es conversión de TIMBRE que preserva el ritmo, las pausas y la entonación del audio de entrada. El video tiene los labios animados para ese ritmo exacto. Si el ritmo no cambia, los labios siguen coincidiendo.

MEDIDO sobre 100 segundos: duración de entrada 100,625 s y de salida 100,635 s (10 ms). Desfase mediano 0 ms, máximo 30 ms, 0 de 50 tramos por encima de 80 ms. Palabras: 289 entran, 289 salen.

LO QUE SÍ HACE: cambia el timbre, y aporta parte de la prosodia del clon.
LO QUE NO HACE: no inventa interpretación. Copia la del audio de entrada, errores incluidos. Si el generador de video pronunció mal una palabra, la conversión la reproduce igual de mal.

EL INTERCAMBIO QUE DECIDE TODO EL PIPELINE: lo que regala el lip-sync gratis es lo mismo que encierra en la actuación del generador. Si la persona graba el guion con su risa y sus acentos reales, el ritmo cambia entero y los labios dejan de servir — ahí sí hace falta un resincronizador. Actuación humana real y lip-sync gratis no se pueden tener juntos.

GOTCHA IMPORTANTE: el desfase NO es determinista. Tres corridas idénticas sobre el mismo audio dieron dos con un tramo corrido 290-310 ms en el mismo punto y una limpia con 10 ms de máximo. Hay que verificar por correlación cruzada y REPETIR la corrida si aparece un tramo malo. Sale más barato que diagnosticarlo.

Y CÓMO VERIFICAR: por correlación cruzada de las envolventes de energía, nunca comparando timestamps de palabra. Los timestamps dan falsos positivos de hasta 840 ms sobre audio que en realidad está alineado a 0 ms, porque la alineación del transcriptor es floja en palabras cortas y átonas.`,
  },
  {
    titulo: 'Para clonar una voz, el registro pesa más que la duración y la calidad',
    categoria: 'Voz',
    cuerpo: `Este es el hallazgo más contraintuitivo de toda la producción, y lo encontró el cliente escuchando, no el análisis.

Primer clon: 97 segundos sacados de un anuncio publicado en Meta, o sea audio recomprimido a 61 kbps y normalizado casi al techo. Se dio por provisorio: era obvio que había que rehacerlo con mejor material.

Segundo clon: 11 minutos limpios grabados con el celular, sin compresión de Meta, con sus muletillas puestas. Más material, mejor señal. Tenía que ganar.

MEDIDO:

- Objetivo (la persona en su anuncio): 139 Hz de tono, 9,5% de palabras con pico de énfasis.
- Clon del celular (11 min limpios): 105 Hz, 20,1%.
- Clon del anuncio (97 s a 61 kbps): 137 Hz, 10,9%.

El clon del material comprimido clava las dos métricas. El del material limpio se va 34 Hz abajo y duplica el énfasis.

LA CAUSA: en el anuncio la persona está ACTUANDO; en el celular está CONVERSANDO. Son dos registros distintos de la misma voz, y el destino del clon es un anuncio.

REGLA: para clonar una voz de anuncio hay que clonar DE anuncios. Pedir "grábame dos minutos hablando natural" produce un clon que suena a alguien contando algo, no a alguien vendiendo.

Y HAY UN AGRAVANTE QUE VALE COMO ADVERTENCIA APARTE: ese audio de celular lo grabó a las dos de la madrugada. Su voz estaba cansada y más grave. El clon heredó el cansancio. Cuando pidas audio, pide también CUÁNDO grabarlo.

LO QUE ESTO INVALIDA: la idea de que la compresión del material era el techo del clon. El material limpio da mejor señal y peor registro, y el registro pesó más.

CÓMO DETECTARLO SIN OÍDO: dos números por corrida, tono mediano y porcentaje de palabras con pico local sobre 4 semitonos, contra los mismos dos de la persona real. Si el tono está 30 Hz abajo, el clon salió de material conversacional.

EL MATERIAL DE CLONACIÓN SÍ SIRVIÓ PARA OTRA COSA: de esos 11 minutos salieron sus muletillas y su patrón de entonación, que es lo que hizo el guion. No fue trabajo perdido — fue material para el TEXTO, no para la VOZ.`,
  },
  {
    titulo: 'Speech-to-speech suprime el ambiente: hay que devolvérselo',
    categoria: 'Voz',
    cuerpo: `Con la voz ya convertida, el cliente escuchó "interrupciones" en el audio. No eran cortes: era el ambiente entrando y saliendo.

MEDIDO, comparando el nivel durante el habla contra el nivel en los huecos entre frases:

- Crudo del generador: 16,9 dB de caída (el motor del auto sigue sonando entre frases).
- Después de speech-to-speech: 33,0 dB de caída.

La conversión suprime el ambiente 11 dB de más en los huecos. Con voz continua no se nota; en las pausas, el fondo desaparece de golpe y el oído lo lee como un corte.

LA SOLUCIÓN: devolverle la base de ambiente desde el audio original.

CÓMO, sin reintroducir la voz vieja: filtrar el audio crudo por debajo de 120 Hz y mezclarlo debajo de la voz convertida. Ahí vive el retumbe del motor y casi nada de voz. Se probaron cuatro cortes (120, 180, 250 y 400 Hz) midiendo cuánta voz se cuela en cada uno: 120 Hz es el que mejor relación da. A 400 Hz se escucha la voz vieja por debajo como un eco.

EL NIVEL: se ajusta hasta que la caída habla/huecos vuelva a la del crudo. En el caso medido, ganancia 1,6 dejó una caída de 17,2 dB contra los 16,9 originales.

EL FLAG QUE NO ES OPCIONAL: amix por defecto viene con normalize=true, que DIVIDE cada entrada. Mezclando tres pistas la voz sale 9 dB más baja sin que nada lo avise. Siempre normalize=0.

Y ESTO NO ES UN DEFECTO A ESCONDER: el ambiente es lo que hace que el clip parezca grabado y no generado. El cliente lo dijo mejor: "mejor si tiene sonido de ambiente, es justamente lo que lo hace más natural y humano".`,
  },
  {
    titulo: 'El detector de silencio devuelve VACÍO, no error',
    categoria: 'Montaje',
    cuerpo: `Para unir los clips hay que recortarles el aire de las puntas. La herramienta estándar es el detector de silencio de ffmpeg. Sobre 12 clips grabados dentro de un auto NO DETECTÓ NADA. Ni a -32 dB ni a -35. Sin advertencia, sin excepción: salida vacía, que se lee igual que "no hay silencios que cortar".

LA CAUSA: el clip tiene motor y ruido de calle de punta a punta. El piso de ruido está en -30 dB y la voz en -18. Nunca hay silencio DIGITAL, así que un umbral absoluto no separa nada.

El error de fondo fue creer que "silencio" es una propiedad de la señal, cuando es RELATIVO a ese clip.

Este es el patrón de falla más peligroso que apareció en toda la producción: una herramienta que devuelve vacío en vez de error. El código de arriba lo interpreta como "no hay nada que hacer" y sigue.

REGLA: cuando una herramienta de audio devuelve vacío, la primera hipótesis es que el umbral está mal calibrado, no que no haya nada.

PARA MAKO: cualquier paso automático que pueda devolver "nada" tiene que distinguir entre "medí y no hay" y "no pude medir". Si no distingue, el pipeline entrega material sin procesar y nadie se entera.`,
  },
  {
    titulo: 'Los cortes se anclan en la palabra — y cada fuente miente en un caso distinto',
    categoria: 'Montaje',
    cuerpo: `Segundo intento de recortar el aire: medir la envolvente de energía por percentiles del propio clip y cortar donde cae. Pareció funcionar — quitó 5,6 s de 102. PERO 4 DE ESOS SEGUNDOS ERAN HABLA. En 6 de 12 clips el corte cayó antes de que terminara la última palabra. Lo detectó el usuario escuchando, no la herramienta.

POR QUÉ FALLA: la energía de audio NO es la palabra. La "s" final de "tareas" o la vocal átona de "semana" tienen 10-15 dB menos que la vocal tónica, así que caen por debajo de cualquier umbral razonable mientras la persona todavía está hablando. Subir el margen mueve el error, no lo elimina, porque el ancla sigue siendo la energía.

LO QUE FUNCIONA: anclar en la PALABRA. Transcribir cada clip pidiendo timestamps por palabra y cruzar eso con la envolvente.

PERO CADA FUENTE MIENTE EN UN CASO DISTINTO, y esto es lo importante:

- LA CABEZA DEL TRANSCRIPTOR NO SIRVE. Ancla la primera palabra en 0.00 en 10 de 12 clips. Es un artefacto conocido de la alineación. Para el inicio, usar el mínimo entre ambas fuentes.
- LA COLA DE LA ENERGÍA MIENTE CUANDO EL CLIP ES MÁS LARGO QUE EL TEXTO. Si el clip se generó un escalón más largo, queda cola de ambiente que la energía lee como señal. En una tanda, la energía marcaba habla 3,4 segundos después de la última palabra.
- LA COLA DEL TRANSCRIPTOR MIENTE CUANDO SE QUEDA CORTO, que pasa cuando el clip está bien ajustado al texto.

EL CRITERIO QUE RESUELVE LAS DOS: si la energía marca el final más de 0,5 s después que la última palabra, hay que VERIFICAR qué hay ahí — transcribir solo esa cola. Si el transcriptor devuelve una palabra suelta sin sentido, es ambiente y se corta por la palabra.

LA FIRMA DE LA COLA MUERTA: el transcriptor alucina palabras sobre audio sin habla. En una tanda devolvió "¡Hipo!", "Teresa" y "Gracias" en las colas de tres clips distintos. Esas alucinaciones no son un problema: son la SEÑAL de que ahí no hay nadie hablando.

Y EL MARGEN: 0,25 s a cada lado. Menos que eso se come sílabas.`,
  },
  {
    titulo: 'Un recorte sin diff de palabras no está terminado, está sin probar',
    categoria: 'Montaje',
    cuerpo: `El montaje que se comió palabras se entregó igual, y lo encontró el cliente. La verificación que faltaba cuesta una llamada al transcriptor.

EL MÉTODO: transcribir el montaje final y comparar la secuencia de palabras contra la concatenación de las transcripciones de los clips originales. Comparación sobre tokens normalizados (minúsculas, sin tildes, sin puntuación) con un diff de secuencias.

Si falta una palabra, no sale.

MEDIDO en el montaje corregido: 289 esperadas, 289 presentes, 99,65% de similitud. La única diferencia fue "hasta" contra "esta", que es ambigüedad del transcriptor sobre el mismo audio, no una pérdida.

CÓMO LEER EL DIFF, que no es obvio:
- Palabras FALTANTES en el medio de un clip NO pueden ser del recorte (el recorte solo toca las puntas). Son variación del transcriptor.
- Palabras faltantes al borde de un clip SÍ son sospechosas.
- Palabras DE MÁS en el montaje son normales y buena señal: el transcriptor oye mejor con más contexto.

Y EL COROLARIO QUE AHORRA REGENERACIONES: verificar marcadores sobre CLIPS AISLADOS da falsos negativos. Pasó dos veces. Un "pues" que el transcriptor no oyó en un clip suelto de 10 segundos apareció perfecto en el montaje completo, y un "¿no?" igual. Los marcadores se verifican SIEMPRE sobre el montaje.

PARA MAKO: este diff es barato y automatizable. Debería correr solo después de cada montaje y bloquear la entrega si falta una palabra, en vez de dejar que el cliente lo escuche.`,
  },
  {
    titulo: 'Escuchar QUÉ dijo, no solo cómo se ve',
    categoria: 'Montaje',
    cuerpo: `En la primera tanda, el generador dijo "hablo" donde el guion decía "instalo". En otra dijo "incodó" en vez de "incomodó". Los dos errores pasaron el montaje completo, la conversión de voz y la entrega sin que nadie los notara, porque todo el mundo estaba mirando la cara.

Son errores del generador de video, no del clonador de voz ni del montaje. La conversión los reproduce fielmente porque hace exactamente eso: copia lo que le das.

LA VERIFICACIÓN: transcribir cada clip y compararlo con el texto del guion, palabra por palabra. Diez segundos de máquina contra un anuncio publicado con una palabra mal.

QUÉ MIRAR EN EL DIFF:
- Palabras cambiadas: el generador se comió sílabas o inventó una palabra parecida. Se regenera ese clip.
- Marcadores faltantes: verificar sobre el montaje antes de regenerar, por los falsos negativos.
- Números escritos distinto ("7" contra "siete"): es formato del transcriptor, no un error.

TRUCO PARA LA REGENERACIÓN: si el generador se come una palabra concreta dos veces seguidas, darle un respiro con una coma antes. "que siempre instalo, en todas las empresas" funcionó donde "que siempre instalo en todas las empresas" fallaba.`,
  },
  {
    titulo: 'La mayoría de las quejas son del input, no del modelo',
    categoria: 'Soporte y expectativas',
    cuerpo: `Esta es la lección que gobierna cómo MaKo tiene que responder cuando un usuario dice "esto no se parece a mí".

En esta producción hubo dos clases de problema, y conviene no confundirlas:

CULPA NUESTRA (método o prompt), y todas tuvieron arreglo:
- Encadenar generaciones sin control (IA sobre IA).
- Pedir el acento equivocado. Se le pidió acento de Ciudad de México a un cliente norteño durante toda una tanda.
- Describir la cara con palabras compitiendo con la foto.
- Pedir énfasis en todas las escenas.
- Elegir la variante de luz de alto contraste para un interior.
- Cortar el audio por energía y comerse palabras.

CULPA DEL INPUT, y ahí no hay prompt que lo salve:
- Audio grabado a las 2 de la madrugada: el clon hereda el cansancio y sale 34 Hz más grave.
- Audio grabado conversando cuando el destino es un anuncio: registro equivocado.
- Foto con otra persona en el cuadro, o con un cartel tapando el torso, o de espaldas a una ventana.
- Foto donde la persona está seria cuando su cara "funciona" sonriendo.
- Tres fotos con encuadres distintos pasadas juntas como referencia.

LA CLAVE PARA EL PRODUCTO: cuando un usuario reclama, no discutir. MOSTRARLE EL INPUT AL LADO DEL OUTPUT. Si tiene razón, se corrige el método. Si el problema es el material que cargó, lo va a ver solo — y con evidencia, no con una explicación.

Esto no es para ganarle una discusión al cliente. Es para que el ciclo de corrección apunte al lugar correcto: se perdieron horas ajustando prompts cuando el problema era el audio de las 2 AM, y se perdieron créditos regenerando clips cuando el problema era el acento.`,
  },
  {
    titulo: 'Gatear el input antes de generar, no después',
    categoria: 'Soporte y expectativas',
    cuerpo: `Todo lo que sale mal por el input se puede detectar ANTES de gastar un crédito. Son chequeos baratos, casi todos medibles sin IA.

PARA LA FOTO:
- ¿Hay más de una cara en el cuadro? Rechazar o recortar.
- ¿La cara ocupa menos de X% del cuadro? Muy chica para ser fuente de identidad.
- ¿Está muy oscura o a contraluz? Medir el histograma de la región de la cara.
- ¿Está fuera de foco? Medir la varianza del laplaciano.
- ¿Es una imagen generada? Si vino de nuestro propio flujo, lo sabemos: marcarla y no dejar usarla como ancla.
- ¿Está sonriendo? Preguntarle al usuario si su cara "funciona" mejor sonriendo, que es un dato que él sabe y nosotros no.

PARA EL AUDIO:
- Duración mínima. Menos de 60 segundos no alcanza.
- Tono mediano contra el de otro material suyo, si lo hay. Una diferencia grande delata cansancio o registro distinto.
- Piso de ruido y presencia de música. Una base musical arruina el clon.
- ¿Cuántos hablantes? Si hay diálogo, no sirve.
- Bitrate y recompresión. Se puede usar material comprimido, pero conviene saberlo.
- Y LA PREGUNTA QUE MÁS AHORRA: "¿este audio es de ti hablando como hablarías EN UN ANUNCIO, o conversando?". El registro no se puede medir sin contexto, pero se puede preguntar.

EL PRINCIPIO: cada uno de estos chequeos existe porque ya nos costó una tanda de créditos o una llamada incómoda. El costo de pedirle al usuario que regrabe es mucho menor que el de producir 12 clips con material equivocado.

Y CÓMO PEDIRLO, que importa tanto como el chequeo: no con una lista de requisitos técnicos. Con un ejemplo de foto buena y uno de foto mala al lado, y el chequeo corriendo en vivo mientras sube el archivo.`,
  },
  {
    titulo: 'El protocolo de la queja: comparar, no discutir',
    categoria: 'Soporte y expectativas',
    cuerpo: `Cuando el usuario dice "no se parece", la conversación productiva tiene una forma concreta. Esta es, paso por paso.

1) NO PEDIR UNA LISTA DE DEFECTOS. La gente reconoce su cara pero no la sabe describir. Preguntar "¿qué está mal?" produce respuestas vagas y contradictorias.

2) PREGUNTAR DÓNDE SÍ SE PARECE. "Marca el segundo donde más te pareces y el segundo donde menos." La diferencia entre esos dos frames contiene el diagnóstico. Así apareció el hallazgo de la sonrisa, que resolvió cinco quejas de una.

3) PONER EL INPUT AL LADO DEL OUTPUT. La foto que subió contra el frame generado, en la misma pantalla. En esta producción el cliente pidió exactamente eso y lo dijo así: "necesito verlas las dos al mismo tiempo". Recién ahí pudo describir las diferencias con precisión: quijada, cachetes, labios, barba.

4) SEPARAR LO QUE ES DERIVA DE LO QUE ES EL INPUT. Si el frame generado se parece a la foto pero la foto no se parece a la persona, el problema es la foto. Si el frame no se parece a la foto, el problema es nuestro.

5) TRADUCIR SUS PALABRAS A INSTRUCCIONES, sin interpretarlas de más. El cliente dijo "está más cuadrada la quijada, yo la tengo más redonda con papada". Eso va casi textual al prompt. No hace falta convertirlo a jerga.

6) UN EJE POR CORRECCIÓN. Si dijo cuatro cosas, no se corrigen las cuatro juntas: ya vimos que el modelo lleva cada instrucción al extremo.

PARA MAKO: esto es una pantalla, no un instructivo. Input y output lado a lado, un selector de "aquí sí / aquí no" sobre la línea de tiempo, y los chequeos de calidad del input visibles con su resultado. La mayoría de las veces esa pantalla cierra el reclamo sin que intervenga nadie.`,
  },
  {
    titulo: 'Qué está automatizable hoy y qué no',
    categoria: 'Construirlo en MaKo',
    cuerpo: `Balance honesto de todo el pipeline, con lo que ya está probado y lo que falta.

AUTOMATIZABLE HOY, TODO POR CÓDIGO:
- El montaje: unir los clips y recortar el aire. ffmpeg, cero costo por uso. Probado.
- La voz: clonar y convertir por API de ElevenLabs. Probado, con verificación de lip-sync incluida.
- Devolver el ambiente: filtro y mezcla con ffmpeg. Probado.
- Los subtítulos quemados: transcripción con timestamps por palabra, generar un archivo ASS con etiquetas de karaoke, quemar con libass. Costo por anuncio: menos de un centavo.
- El degradado de realismo en post: cadena de filtros de ffmpeg. Valores documentados.

NO AUTOMATIZABLE HOY:
- La generación de los clips. La herramienta que se usó no tiene API. Habría que ir por la API del modelo directamente, que es otro proveedor y otro costo.
- La música. Es un problema legal antes que técnico: las licencias por creador prohíben redistribuir el archivo, que es exactamente lo que hace un producto al entregar el render. La vía limpia (API de partner con sublicencia) existe pero no publica precio. Hoy, la pone el usuario.
- El juicio sobre si el avatar se parece. Eso lo decide una persona mirando.

LO QUE NO HAY QUE PROMETER: "MaKo arma el anuncio solo". Automatizar el montaje y la voz automatiza los últimos veinte minutos de un proceso que empieza mucho antes.

EL ORDEN CORRECTO DEL PIPELINE, que no es obvio y se pagó descubrirlo:
1. Foto real → imagen base, aprobada a ojo.
2. Variantes de fondo desde esa base.
3. Los clips.
4. Montaje y recorte.
5. La voz.
6. Los subtítulos, AL FINAL. Se generan escuchando el audio; si se hacen antes del cambio de voz quedan pegados a un audio que deja de existir.`,
  },
  {
    titulo: 'Los frenos concretos que hay en el repo',
    categoria: 'Construirlo en MaKo',
    cuerpo: `Relevado sobre el código real. Esto es lo que falta para que el pipeline viva dentro del producto.

1) NO HAY FFMPEG EN EL RUNTIME. No hay ninguna dependencia de media en package.json. Todo el procesamiento pesado corre hoy en la máquina del desarrollador contra un binario suelto. Y el binario completo pesa 194,7 MB de los 250 MB del bundle estándar del hosting.

LA SALIDA RECOMENDADA: ffmpeg compilado a WebAssembly, corriendo EN EL NAVEGADOR del cliente. Cero infraestructura, cero costo por uso, y el archivo nunca sale de su máquina. El precedente ya existe en el repo: la nota de voz de WhatsApp se transcodifica en el cliente antes de mandarla. El costo honesto: la variante multihilo exige aislamiento cross-origin, que rompería recursos embebidos de terceros; hay que arrancar monohilo y medir.

2) LA TRANSCRIPCIÓN DESCARTA LOS TIMESTAMPS POR CONTRATO DE TIPO. Se pide el formato detallado pero nunca la granularidad por palabra, y el tipo de retorno no tiene campo para las palabras: aunque llegaran, se tiran. Son dos líneas en el form y dos campos en el tipo.
   OJO: el modelo tiene que seguir siendo el que soporta granularidad por palabra. Migrar a un modelo más nuevo "por modernizar" rompe los subtítulos en silencio.
   Y NO se reusa la cascada barata de IA: arranca por un proveedor cuyo prompt prohíbe explícitamente devolver timestamps.

3) NO HAY DÓNDE GUARDAR EL RESULTADO. El guion se guarda como campos planos de texto dentro de un JSON único; un binario no entra ahí. Hace falta una tabla propia referenciada por el id del guion, siguiendo el precedente de otras migraciones del repo. Nada dentro del JSON existente.

4) FALTA UN ESTADO. El guion salta de "grabado" a "publicado" sin nada en el medio. Si el montaje es un paso del producto, va un estado ahí.

5) LIBASS NO AVISA CUANDO LE FALTA LA FUENTE. Sale con código de éxito y la tipografía cambiada. Hay que revisar el log de selección de fuente después de cada render, no el código de salida. Y no hay ni un archivo de fuente en el repo.

6) DEUDA REAL: los scripts de producción no están versionados. Viven en carpetas sueltas del escritorio. Si se pierde esa carpeta, se pierde la receta.`,
  },
  {
    titulo: 'Las trampas de medición que casi nos hacen corregir para el lado equivocado',
    categoria: 'Método',
    cuerpo: `Cuatro veces en esta producción la medición dijo lo contrario de lo que pasaba. Vale la pena tenerlas juntas, porque el patrón se repite.

1) VARIACIÓN GLOBAL DE TONO CONTRA ÉNFASIS. La métrica decía que la voz generada tenía MÁS variación que la persona real (7,06 semitonos contra 4,70) mientras el cliente decía que no tenía agudos. Los dos tenían razón: el énfasis es un PICO LOCAL, no dispersión global. Medir cuánto excede cada palabra a sus vecinas inmediatas, no el desvío de todo el audio.

2) TIMESTAMPS DE PALABRA CONTRA ALINEACIÓN REAL. Para medir si la conversión de voz corrió los labios, comparar timestamps dio 840 ms de desfase máximo y 7,6% de palabras corridas. Era ruido del transcriptor: la correlación cruzada de las envolventes dio 0 ms mediano y 30 ms máximo. Se delató solo — un corrimiento de 840 ms con la duración total idéntica exigiría que el audio se comprima y se estire. Para medir tiempo, usar la forma de onda; los timestamps de un modelo sirven para saber QUÉ se dijo, no exactamente CUÁNDO.

3) MÁS MATERIAL DE CLONACIÓN CONTRA MEJOR CLON. Once minutos limpios perdieron contra 97 segundos comprimidos, porque el registro pesa más que la cantidad. La métrica de "cantidad de audio" no predice nada.

4) SILENCIO DIGITAL CONTRA AUSENCIA DE HABLA. El detector de silencio no encontró nada en 12 clips que tenían segundos de aire, porque el motor del auto nunca baja del umbral. Y al revés, la energía marcó habla donde solo había ambiente.

EL PATRÓN COMÚN: la métrica medía algo real, pero no lo que importaba. Antes de confiar en un número, preguntarse qué percibe realmente la persona que va a juzgar el resultado, y buscar el número que mida ESO.

Y LA REGLA PRÁCTICA: cuando la medición contradice al oído o al ojo de alguien que conoce el material, la medición está midiendo mal. El cliente que dice "no me parezco" tiene razón aunque los números digan otra cosa; lo que falta es la métrica correcta.`,
  },
];
